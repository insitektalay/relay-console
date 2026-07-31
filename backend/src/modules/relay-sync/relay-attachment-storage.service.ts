import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, createHmac, randomUUID, timingSafeEqual } from "crypto";
import { Readable } from "stream";
import { DataSource } from "typeorm";
import { RelaySyncAttachmentEntity } from "../../entities";
import { AuditLogService } from "../audit-log/audit-log.service";
import { WorkspaceMembershipService } from "../workspace-membership/workspace-membership.service";
import {
  RELAY_ATTACHMENT_ALLOWED_CONTENT_TYPES,
  RELAY_ATTACHMENT_CHUNK_BYTES,
  RELAY_ATTACHMENT_MAX_BYTES,
  RELAY_ATTACHMENT_UPLOAD_LEASE_MS,
  RELAY_ATTACHMENT_UPLOAD_TOKEN_TTL_MS,
  RELAY_ATTACHMENT_UPLOAD_TOKEN_VERSION,
} from "./attachment-upload-policy";

const ATTACHMENT_CHUNK_BATCH = 16;
const ALLOWED_ATTACHMENT_TYPES = new Set<string>(
  RELAY_ATTACHMENT_ALLOWED_CONTENT_TYPES,
);
const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const isAllowedAttachmentContentType = (value: string) =>
  ALLOWED_ATTACHMENT_TYPES.has(value);

export interface AttachmentUploadClaims {
  v: number;
  rowId: string;
  attachmentId: string;
  workspaceId: string;
  installationId: string;
  contentType: string;
  byteSize: number;
  sha256: string;
  exp: number;
  nonce: string;
}

export class RelayAttachmentStorageService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly membership: WorkspaceMembershipService,
    private readonly audit: AuditLogService,
  ) {}

  createUploadGrant(input: {
    workspaceId: string;
    installationId: string;
    contentType: string;
    byteSize: number;
    sha256: string;
  }) {
    const rowId = randomUUID();
    const attachmentId = `att_${randomUUID()}`;
    const expiresAt = new Date(
      Date.now() + RELAY_ATTACHMENT_UPLOAD_TOKEN_TTL_MS,
    );
    const claims: AttachmentUploadClaims = {
      v: RELAY_ATTACHMENT_UPLOAD_TOKEN_VERSION,
      rowId,
      attachmentId,
      workspaceId: input.workspaceId,
      installationId: input.installationId,
      contentType: input.contentType,
      byteSize: input.byteSize,
      sha256: input.sha256.toLowerCase(),
      exp: expiresAt.getTime(),
      nonce: randomUUID(),
    };
    return {
      rowId,
      attachmentId,
      expiresAt,
      claims,
      token: this.issueUploadToken(claims),
    };
  }

  issueUploadToken(claims: AttachmentUploadClaims) {
    const encodedClaims = Buffer.from(JSON.stringify(claims), "utf8").toString(
      "base64url",
    );
    return `${encodedClaims}.${this.signUpload(encodedClaims)}`;
  }

  async upload(
    attachmentRowId: string,
    token: string,
    content: Readable,
    request: { contentLength: number; contentType: string },
  ) {
    const claims = this.verifyUploadToken(token);
    if (claims.rowId !== attachmentRowId)
      throw new ForbiddenException("ATTACHMENT_UPLOAD_TOKEN_INVALID");
    if (
      request.contentLength !== claims.byteSize ||
      request.contentLength < 1 ||
      request.contentLength > RELAY_ATTACHMENT_MAX_BYTES
    )
      throw new BadRequestException("ATTACHMENT_SIZE_MISMATCH");
    if (request.contentType !== claims.contentType)
      throw new BadRequestException("ATTACHMENT_CONTENT_TYPE_MISMATCH");

    const tokenHash = createHash("sha256").update(token).digest("hex");
    const uploadVersion = randomUUID();
    const claimed = await this.dataSource.query(
      `
        UPDATE "relay_sync_attachments"
        SET
          status = 'uploading',
          "uploadClaimToken" = $3::uuid,
          "uploadClaimExpiresAt" = LEAST(
            "uploadExpiresAt",
            now() + ($12::integer * interval '1 millisecond')
          ),
          "uploadAttemptCount" = "uploadAttemptCount" + 1,
          "updatedAt" = now()
        WHERE id = $1::uuid
          AND "uploadTokenHash" = $2
          AND "uploadExpiresAt" > now()
          AND "deletedAt" IS NULL
          AND "attachmentId" = $4
          AND "workspaceId" = $5::uuid
          AND "sourceInstallationId" = $6
          AND "contentType" = $7
          AND "byteSize" = $8::bigint
          AND lower(sha256) = $9
          AND floor(extract(epoch FROM "uploadExpiresAt") * 1000)::bigint =
            $10::bigint
          AND $11::uuid IS NOT NULL
          AND (
            (status = 'negotiated' AND "uploadClaimToken" IS NULL)
            OR (
              status = 'uploading'
              AND "uploadClaimExpiresAt" <= now()
            )
          )
        RETURNING id, "attachmentId", "byteSize", sha256
      `,
      [
        attachmentRowId,
        tokenHash,
        uploadVersion,
        claims.attachmentId,
        claims.workspaceId,
        claims.installationId,
        claims.contentType,
        claims.byteSize,
        claims.sha256,
        claims.exp,
        claims.nonce,
        RELAY_ATTACHMENT_UPLOAD_LEASE_MS,
      ],
    );
    if (claimed.length !== 1)
      throw new ForbiddenException("ATTACHMENT_UPLOAD_NOT_CLAIMABLE");

    await this.dataSource.query(
      `
        DELETE FROM "relay_sync_attachment_chunks"
        WHERE "attachmentRowId" = $1::uuid
          AND "uploadVersion" <> $2::uuid
      `,
      [attachmentRowId, uploadVersion],
    );

    try {
      const digest = createHash("sha256");
      let receivedBytes = 0;
      let chunkIndex = 0;
      let batchIndexes: number[] = [];
      let batchLengths: number[] = [];
      let batchContent: Buffer[] = [];

      const flush = async () => {
        if (batchContent.length === 0) return;
        const inserted = await this.dataSource.query(
          `
            WITH renewed_claim AS (
              UPDATE "relay_sync_attachments"
              SET "uploadClaimExpiresAt" = LEAST(
                "uploadExpiresAt",
                now() + ($6::integer * interval '1 millisecond')
              )
              WHERE id = $1::uuid
                AND status = 'uploading'
                AND "uploadClaimToken" = $2::uuid
                AND "uploadClaimExpiresAt" > now()
                AND "uploadExpiresAt" > now()
              RETURNING id
            )
            INSERT INTO "relay_sync_attachment_chunks" (
              "attachmentRowId",
              "uploadVersion",
              "chunkIndex",
              "byteLength",
              content
            )
            SELECT
              $1::uuid,
              $2::uuid,
              chunks."chunkIndex",
              chunks."byteLength",
              chunks.content
            FROM unnest(
              $3::integer[],
              $4::integer[],
              $5::bytea[]
            ) AS chunks("chunkIndex", "byteLength", content)
            WHERE EXISTS (SELECT 1 FROM renewed_claim)
            ON CONFLICT DO NOTHING
            RETURNING "chunkIndex"
          `,
          [
            attachmentRowId,
            uploadVersion,
            batchIndexes,
            batchLengths,
            batchContent,
            RELAY_ATTACHMENT_UPLOAD_LEASE_MS,
          ],
        );
        if (inserted.length !== batchContent.length)
          throw new ConflictException("ATTACHMENT_UPLOAD_CLAIM_LOST");
        batchIndexes = [];
        batchLengths = [];
        batchContent = [];
      };

      for await (const incoming of content) {
        const bytes = Buffer.isBuffer(incoming)
          ? incoming
          : Buffer.from(incoming as Uint8Array);
        for (
          let offset = 0;
          offset < bytes.length;
          offset += RELAY_ATTACHMENT_CHUNK_BYTES
        ) {
          const bounded = bytes.subarray(
            offset,
            Math.min(offset + RELAY_ATTACHMENT_CHUNK_BYTES, bytes.length),
          );
          receivedBytes += bounded.length;
          if (receivedBytes > claims.byteSize)
            throw new BadRequestException("ATTACHMENT_SIZE_MISMATCH");
          digest.update(bounded);
          batchIndexes.push(chunkIndex++);
          batchLengths.push(bounded.length);
          batchContent.push(Buffer.from(bounded));
          if (batchContent.length === ATTACHMENT_CHUNK_BATCH) await flush();
        }
      }
      await flush();

      if (receivedBytes !== claims.byteSize)
        throw new BadRequestException("ATTACHMENT_SIZE_MISMATCH");
      if (digest.digest("hex") !== claims.sha256)
        throw new BadRequestException("ATTACHMENT_HASH_MISMATCH");

      const published = await this.dataSource.query(
        `
          UPDATE "relay_sync_attachments" attachment
          SET
            status = 'available',
            "storageKey" = 'postgres-chunks:' || attachment.id::text,
            "storageVersion" = $2::uuid,
            content = NULL,
            "uploadTokenHash" = NULL,
            "uploadExpiresAt" = NULL,
            "uploadClaimToken" = NULL,
            "uploadClaimExpiresAt" = NULL,
            "updatedAt" = now()
          WHERE attachment.id = $1::uuid
            AND attachment.status = 'uploading'
            AND attachment."uploadClaimToken" = $2::uuid
            AND attachment."uploadClaimExpiresAt" > now()
            AND (
              SELECT COALESCE(sum(chunk."byteLength"), 0)
              FROM "relay_sync_attachment_chunks" chunk
              WHERE chunk."attachmentRowId" = attachment.id
                AND chunk."uploadVersion" = $2::uuid
            ) = attachment."byteSize"
            AND (
              SELECT count(*) = COALESCE(max(chunk."chunkIndex"), -1) + 1
                AND COALESCE(min(chunk."chunkIndex"), 0) = 0
              FROM "relay_sync_attachment_chunks" chunk
              WHERE chunk."attachmentRowId" = attachment.id
                AND chunk."uploadVersion" = $2::uuid
            )
          RETURNING "attachmentId", status, "byteSize"
        `,
        [attachmentRowId, uploadVersion],
      );
      if (published.length !== 1)
        throw new ConflictException("ATTACHMENT_UPLOAD_CLAIM_LOST");
      return {
        attachmentId: published[0].attachmentId,
        status: published[0].status,
        byteSize: Number(published[0].byteSize),
      };
    } catch (error) {
      await this.discardUpload(attachmentRowId, uploadVersion);
      throw error;
    }
  }

  async download(userId: string, workspaceId: string, attachmentId: string) {
    await this.membership.ensureWorkspaceAccess(workspaceId, userId);
    const attachment = await this.dataSource
      .getRepository(RelaySyncAttachmentEntity)
      .createQueryBuilder("attachment")
      .where(
        'attachment."workspaceId" = :workspaceId AND attachment."attachmentId" = :attachmentId',
        { workspaceId, attachmentId },
      )
      .getOne();
    if (
      !attachment ||
      attachment.deletedAt ||
      attachment.status !== "available" ||
      !attachment.storageVersion ||
      attachment.storageKey !== `postgres-chunks:${attachment.id}`
    )
      throw new NotFoundException("ATTACHMENT_NOT_AVAILABLE");

    const expectedBytes = Number(attachment.byteSize);
    const expectedDigest = attachment.sha256.toLowerCase();
    const dataSource = this.dataSource;
    async function* chunks(): AsyncGenerator<Buffer> {
      let lastIndex = -1;
      let receivedBytes = 0;
      const digest = createHash("sha256");
      while (true) {
        const rows = await dataSource.query(
          `
            SELECT "chunkIndex", "byteLength", content
            FROM "relay_sync_attachment_chunks"
            WHERE "attachmentRowId" = $1::uuid
              AND "uploadVersion" = $2::uuid
              AND "chunkIndex" > $3::integer
            ORDER BY "chunkIndex" ASC
            LIMIT $4::integer
          `,
          [
            attachment.id,
            attachment.storageVersion,
            lastIndex,
            ATTACHMENT_CHUNK_BATCH,
          ],
        );
        if (rows.length === 0) break;
        for (const row of rows) {
          if (
            row.chunkIndex !== lastIndex + 1 ||
            !Buffer.isBuffer(row.content) ||
            row.content.length !== row.byteLength ||
            row.content.length > RELAY_ATTACHMENT_CHUNK_BYTES
          )
            throw new Error("ATTACHMENT_STORAGE_INTEGRITY_INVALID");
          lastIndex = row.chunkIndex;
          receivedBytes += row.content.length;
          if (receivedBytes > expectedBytes)
            throw new Error("ATTACHMENT_STORAGE_SIZE_INVALID");
          digest.update(row.content);
          yield row.content;
        }
      }
      if (receivedBytes !== expectedBytes)
        throw new Error("ATTACHMENT_STORAGE_SIZE_INVALID");
      if (digest.digest("hex") !== expectedDigest)
        throw new Error("ATTACHMENT_STORAGE_HASH_INVALID");
    }

    return {
      metadata: {
        attachmentId,
        fileName: attachment.fileName,
        contentType: attachment.contentType,
        byteSize: expectedBytes,
        sha256: expectedDigest,
        provenance: attachment.provenance,
      },
      chunks: chunks(),
    };
  }

  async delete(userId: string, workspaceId: string, attachmentId: string) {
    await this.membership.ensureWorkspaceAccess(workspaceId, userId);
    const repo = this.dataSource.getRepository(RelaySyncAttachmentEntity);
    const attachment = await repo.findOne({
      where: { workspaceId, attachmentId },
    });
    if (!attachment) throw new NotFoundException("ATTACHMENT_NOT_FOUND");
    const deletedAt = new Date();
    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `
          DELETE FROM "relay_sync_attachment_chunks"
          WHERE "attachmentRowId" = $1::uuid
        `,
        [attachment.id],
      );
      await manager
        .getRepository(RelaySyncAttachmentEntity)
        .createQueryBuilder()
        .update()
        .set({
          deletedAt,
          status: "deleted",
          storageKey: null,
          storageVersion: null,
          content: null,
          uploadTokenHash: null,
          uploadExpiresAt: null,
          uploadClaimToken: null,
          uploadClaimExpiresAt: null,
        })
        .where("id = :id", { id: attachment.id })
        .execute();
    });
    await this.audit.record({
      actorType: "user",
      actorId: userId,
      workspaceId,
      eventType: "relay.attachment.deleted",
      resourceType: "attachment",
      resourceId: attachmentId,
    });
    return { deleted: true, attachmentId };
  }

  private verifyUploadToken(token: string): AttachmentUploadClaims {
    if (!token || token.length > 4096)
      throw new ForbiddenException("ATTACHMENT_UPLOAD_TOKEN_INVALID");
    const parts = token.split(".");
    if (parts.length !== 2 || !parts[0] || !parts[1])
      throw new ForbiddenException("ATTACHMENT_UPLOAD_TOKEN_INVALID");
    const [encodedClaims, signature] = parts;
    if (
      !this.safeEqual(signature, this.signUpload(encodedClaims)) ||
      Buffer.from(encodedClaims, "base64url").toString("base64url") !==
        encodedClaims
    )
      throw new ForbiddenException("ATTACHMENT_UPLOAD_TOKEN_INVALID");

    let value: unknown;
    try {
      value = JSON.parse(
        Buffer.from(encodedClaims, "base64url").toString("utf8"),
      );
    } catch {
      throw new ForbiddenException("ATTACHMENT_UPLOAD_TOKEN_INVALID");
    }
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new ForbiddenException("ATTACHMENT_UPLOAD_TOKEN_INVALID");
    const claims = value as Partial<AttachmentUploadClaims>;
    const keys = Object.keys(claims).sort();
    const expectedKeys = [
      "attachmentId",
      "byteSize",
      "contentType",
      "exp",
      "installationId",
      "nonce",
      "rowId",
      "sha256",
      "v",
      "workspaceId",
    ].sort();
    if (
      keys.length !== expectedKeys.length ||
      keys.some((key, index) => key !== expectedKeys[index]) ||
      claims.v !== RELAY_ATTACHMENT_UPLOAD_TOKEN_VERSION ||
      typeof claims.rowId !== "string" ||
      !UUID_V4.test(claims.rowId) ||
      typeof claims.attachmentId !== "string" ||
      !new RegExp(`^att_${UUID_V4.source.slice(1, -1)}$`, "i").test(
        claims.attachmentId,
      ) ||
      typeof claims.workspaceId !== "string" ||
      !UUID_V4.test(claims.workspaceId) ||
      typeof claims.installationId !== "string" ||
      !UUID_V4.test(claims.installationId) ||
      typeof claims.contentType !== "string" ||
      !ALLOWED_ATTACHMENT_TYPES.has(claims.contentType) ||
      !Number.isInteger(claims.byteSize) ||
      (claims.byteSize ?? 0) < 1 ||
      (claims.byteSize ?? 0) > RELAY_ATTACHMENT_MAX_BYTES ||
      typeof claims.sha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(claims.sha256) ||
      !Number.isInteger(claims.exp) ||
      (claims.exp ?? 0) <= Date.now() ||
      (claims.exp ?? 0) > Date.now() + RELAY_ATTACHMENT_UPLOAD_TOKEN_TTL_MS ||
      typeof claims.nonce !== "string" ||
      !UUID_V4.test(claims.nonce)
    )
      throw new ForbiddenException("ATTACHMENT_UPLOAD_TOKEN_INVALID");
    return claims as AttachmentUploadClaims;
  }

  private async discardUpload(
    attachmentRowId: string,
    uploadVersion: string,
  ) {
    await this.dataSource.query(
      `
        DELETE FROM "relay_sync_attachment_chunks"
        WHERE "attachmentRowId" = $1::uuid
          AND "uploadVersion" = $2::uuid
      `,
      [attachmentRowId, uploadVersion],
    );
    await this.dataSource.query(
      `
        UPDATE "relay_sync_attachments"
        SET
          status = 'negotiated',
          "uploadClaimToken" = NULL,
          "uploadClaimExpiresAt" = NULL,
          "updatedAt" = now()
        WHERE id = $1::uuid
          AND status = 'uploading'
          AND "uploadClaimToken" = $2::uuid
      `,
      [attachmentRowId, uploadVersion],
    );
  }

  private signUpload(payload: string) {
    const key = this.config.get<string>("ATTACHMENT_SIGNING_SECRET")?.trim();
    if (!key) throw new Error("ATTACHMENT_SIGNING_SECRET_MISSING");
    return createHmac("sha256", key).update(payload).digest("base64url");
  }

  private safeEqual(left: string, right: string) {
    const a = Buffer.from(left);
    const b = Buffer.from(right);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
