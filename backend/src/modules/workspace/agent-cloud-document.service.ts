import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { createHash, randomUUID } from "crypto";
import { IsNull, Repository } from "typeorm";
import { validate as isUuid } from "uuid";
import {
  AgentEntity,
  ManagedAgentDocumentEntity,
  RelaySyncObjectEntity,
  RelayWorkspaceChangeEntity,
  RuntimeBindingEntity,
} from "../../entities";
import { AuditLogService } from "../audit-log/audit-log.service";
import {
  MANAGED_DOCUMENT_AGENT_MAX_BYTES,
  MANAGED_DOCUMENT_MAX_COUNT,
  validateManagedDocumentContent,
  validateManagedDocumentPath,
  validateNativeAgentDocumentPath,
} from "./managed-document-policy";

type CloudDocumentPayload = {
  agentId: string;
  runtimeType: "hermes" | "openclaw";
  root: "agent";
  folder: string;
  filename: string;
  documentKind: string;
  content: string;
  contentHash: string;
  updatedAt: string;
};

@Injectable()
export class AgentCloudDocumentService {
  constructor(
    @InjectRepository(AgentEntity)
    private readonly agents: Repository<AgentEntity>,
    @InjectRepository(RelaySyncObjectEntity)
    private readonly objects: Repository<RelaySyncObjectEntity>,
    @InjectRepository(RelayWorkspaceChangeEntity)
    private readonly changes: Repository<RelayWorkspaceChangeEntity>,
    @InjectRepository(RuntimeBindingEntity)
    private readonly runtimeBindings: Repository<RuntimeBindingEntity>,
    @Optional()
    @InjectRepository(ManagedAgentDocumentEntity)
    private readonly managedDocuments?: Repository<ManagedAgentDocumentEntity>,
    @Optional()
    private readonly auditLogService?: AuditLogService,
  ) {}

  async list(
    workspaceId: string,
    agentReference: string,
    folder = "",
    userId?: string,
  ) {
    const agent = await this.requireAgent(workspaceId, agentReference);
    const normalizedFolder = this.normalizeFolder(folder);
    const documents = await this.documentsForAgent(workspaceId, agent);
    const folders = new Map<string, { name: string; path: string }>();
    const files: Array<{
      filename: string;
      path: string;
      size: number;
      updatedAt: string | null;
    }> = [];

    for (const object of documents) {
      const payload = this.payload(object);
      if (!payload) continue;
      if (payload.folder === normalizedFolder) {
        files.push({
          filename: payload.filename,
          path: this.join(normalizedFolder, payload.filename),
          size: Buffer.byteLength(payload.content, "utf8"),
          updatedAt:
            payload.updatedAt ?? object.updatedAt?.toISOString() ?? null,
          ...(await this.documentState(
            workspaceId,
            agent.id,
            payload.runtimeType,
            this.join(payload.folder, payload.filename),
          )),
        });
        continue;
      }
      const prefix = normalizedFolder ? `${normalizedFolder}/` : "";
      if (!payload.folder.startsWith(prefix)) continue;
      const child = payload.folder.slice(prefix.length).split("/")[0];
      if (child)
        folders.set(child, {
          name: child,
          path: this.join(normalizedFolder, child),
        });
    }

    const result = {
      requestId: "cloud",
      folder: normalizedFolder,
      folders: [...folders.values()].sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
      files: files.sort((a, b) => a.filename.localeCompare(b.filename)),
    };
    if (userId) {
      await this.recordDocumentAudit(
        workspaceId,
        userId,
        agent.id,
        "native_agent.document.list",
        files.length,
      );
    }
    return result;
  }

  async read(
    workspaceId: string,
    agentReference: string,
    folder: string,
    filename: string,
    userId?: string,
  ) {
    const agent = await this.requireAgent(workspaceId, agentReference);
    const normalizedFolder = this.normalizeFolder(folder);
    const normalizedFilename = this.normalizeFilename(filename);
    const documents = await this.documentsForAgent(workspaceId, agent);
    const object = documents.find((candidate) => {
      const payload = this.payload(candidate);
      return (
        payload?.folder === normalizedFolder &&
        payload.filename === normalizedFilename
      );
    });
    const payload = object ? this.payload(object) : null;
    if (!payload || !object)
      throw new NotFoundException("AGENT_DOCUMENT_NOT_FOUND");
    const result = {
      requestId: "cloud",
      folder: normalizedFolder,
      filename: normalizedFilename,
      content: payload.content,
      size: Buffer.byteLength(payload.content, "utf8"),
      updatedAt: payload.updatedAt ?? object.updatedAt?.toISOString() ?? null,
      serverVersion: object.serverVersion,
      ...(await this.documentState(
        workspaceId,
        agent.id,
        payload.runtimeType,
        this.join(payload.folder, payload.filename),
      )),
    };
    if (userId) {
      await this.recordDocumentAudit(
        workspaceId,
        userId,
        agent.id,
        "native_agent.document.read",
        1,
      );
    }
    return result;
  }

  async write(
    workspaceId: string,
    userId: string,
    agentReference: string,
    folder: string,
    files: Array<{
      filename: string;
      content: string;
      encoding?: "utf8" | "base64";
      contentEncoding?: "utf8" | "base64";
      baseDesiredVersion?: string | number | null;
    }>,
  ) {
    const agent = await this.requireAgent(workspaceId, agentReference);
    this.requireEditableAgent(agent);
    await this.runtimeTypeForAgent(agent);
    const normalizedFolder = this.normalizeFolder(folder);
    const documents = await this.documentsForAgent(workspaceId, agent);
    const written: string[] = [];
    const currentBytes = documents.reduce((total, object) => {
      const payload = this.payload(object);
      return total + (payload ? Buffer.byteLength(payload.content, "utf8") : 0);
    }, 0);
    const projectedPaths = new Set(
      documents
        .map((object) => this.payload(object))
        .filter((payload): payload is CloudDocumentPayload => payload !== null)
        .map((payload) => this.join(payload.folder, payload.filename)),
    );
    let projectedBytes = currentBytes;

    for (const file of files) {
      const path = validateNativeAgentDocumentPath(
        normalizedFolder,
        file.filename,
      );
      if (!projectedPaths.has(path.relativePath)) {
        if (projectedPaths.size >= MANAGED_DOCUMENT_MAX_COUNT) {
          throw new BadRequestException("AGENT_DOCUMENT_COUNT_LIMIT_EXCEEDED");
        }
        projectedPaths.add(path.relativePath);
      }
      const filename = path.filename;
      const encoding = file.encoding ?? file.contentEncoding ?? "utf8";
      const decoded =
        encoding === "base64"
          ? Buffer.from(file.content, "base64").toString("utf8")
          : file.content;
      const { content, byteSize } = validateManagedDocumentContent(decoded);
      const existing = documents.find((candidate) => {
        const payload = this.payload(candidate);
        return (
          payload?.folder === normalizedFolder && payload.filename === filename
        );
      });
      const previousPayload = existing ? this.payload(existing) : null;
      projectedBytes =
        projectedBytes -
        (previousPayload
          ? Buffer.byteLength(previousPayload.content, "utf8")
          : 0) +
        byteSize;
      if (projectedBytes > MANAGED_DOCUMENT_AGENT_MAX_BYTES) {
        throw new BadRequestException(
          "AGENT_DOCUMENT_AGGREGATE_LIMIT_EXCEEDED",
        );
      }
      if (
        existing &&
        file.baseDesiredVersion != null &&
        String(file.baseDesiredVersion) !== String(existing.serverVersion)
      ) {
        throw new ConflictException({
          code: "AGENT_DOCUMENT_VERSION_CONFLICT",
          relativePath: path.relativePath,
          baseDesiredVersion: String(file.baseDesiredVersion),
          canonicalDesiredVersion: String(existing.serverVersion),
        });
      }
      await this.saveDocument(
        workspaceId,
        userId,
        agent,
        existing ?? null,
        normalizedFolder,
        filename,
        content,
      );
      written.push(filename);
    }
    await this.recordDocumentAudit(
      workspaceId,
      userId,
      agent.id,
      "native_agent.document.write",
      written.length,
    );

    return {
      requestId: "cloud",
      folder: normalizedFolder,
      written,
      createdFolder: false,
    };
  }

  async createFolder(folder: string) {
    const normalizedFolder = this.normalizeFolder(folder, true);
    validateNativeAgentDocumentPath(normalizedFolder, "placeholder.md");
    return {
      requestId: "cloud",
      folder: normalizedFolder,
      written: [],
      createdFolder: true,
    };
  }

  async deleteFile(
    workspaceId: string,
    userId: string,
    agentReference: string,
    folder: string,
    filename: string,
  ) {
    const agent = await this.requireAgent(workspaceId, agentReference);
    this.requireEditableAgent(agent);
    const normalizedFolder = this.normalizeFolder(folder);
    const normalizedFilename = this.normalizeFilename(filename);
    const documents = await this.documentsForAgent(workspaceId, agent);
    const object = documents.find((candidate) => {
      const payload = this.payload(candidate);
      return (
        payload?.folder === normalizedFolder &&
        payload.filename === normalizedFilename
      );
    });
    if (!object) throw new NotFoundException("AGENT_DOCUMENT_NOT_FOUND");
    await this.tombstone(workspaceId, userId, object);
    await this.recordDocumentAudit(
      workspaceId,
      userId,
      agent.id,
      "native_agent.document.delete",
      1,
    );
    return {
      requestId: "cloud",
      agentId: agent.externalId ?? agent.id,
      folder: normalizedFolder,
      filename: normalizedFilename,
      deleted: true,
    };
  }

  async deleteFolder(
    workspaceId: string,
    userId: string,
    agentReference: string,
    folder: string,
  ) {
    const agent = await this.requireAgent(workspaceId, agentReference);
    this.requireEditableAgent(agent);
    const normalizedFolder = this.normalizeFolder(folder, true);
    validateNativeAgentDocumentPath(normalizedFolder, "placeholder.md");
    const documents = await this.documentsForAgent(workspaceId, agent);
    const prefix = `${normalizedFolder}/`;
    let deletedCount = 0;
    for (const object of documents) {
      const payload = this.payload(object);
      if (
        payload &&
        (payload.folder === normalizedFolder ||
          payload.folder.startsWith(prefix))
      ) {
        await this.tombstone(workspaceId, userId, object);
        deletedCount += 1;
      }
    }
    await this.recordDocumentAudit(
      workspaceId,
      userId,
      agent.id,
      "native_agent.document.folder_delete",
      deletedCount,
    );
    return {
      agentId: agent.externalId ?? agent.id,
      folder: normalizedFolder,
      deleted: true,
    };
  }

  private async saveDocument(
    workspaceId: string,
    userId: string,
    agent: AgentEntity,
    existing: RelaySyncObjectEntity | null,
    folder: string,
    filename: string,
    content: string,
  ) {
    const now = new Date();
    const version = String(Number(existing?.serverVersion ?? "0") + 1);
    const runtimeType = await this.runtimeTypeForAgent(agent);
    const payload: CloudDocumentPayload = {
      agentId: agent.id,
      runtimeType,
      root: "agent",
      folder,
      filename,
      documentKind: this.documentKind(folder, filename),
      content,
      contentHash: createHash("sha256").update(content).digest("hex"),
      updatedAt: now.toISOString(),
    };
    if (!this.managedDocuments) {
      throw new Error("MANAGED_AGENT_DOCUMENTS_UNAVAILABLE");
    }
    const relativePath = this.join(folder, filename);
    const managed = await this.managedDocuments
      .createQueryBuilder("document")
      .addSelect('document."desiredContent"')
      .where('document."workspaceId" = :workspaceId', { workspaceId })
      .andWhere('document."agentId" = :agentId', { agentId: agent.id })
      .andWhere('document."runtimeType" = :runtimeType', { runtimeType })
      .andWhere('document."relativePath" = :relativePath', { relativePath })
      .getOne();
    const saved = await this.managedDocuments.save(
      this.managedDocuments.create({
        ...managed,
        workspaceId,
        agentId: agent.id,
        runtimeHostId: managed?.runtimeHostId ?? null,
        runtimeObservationId: managed?.runtimeObservationId ?? null,
        runtimeType,
        authorityClass: "managed",
        documentKind: payload.documentKind,
        relativePath,
        folder,
        filename,
        desiredContent: content,
        desiredHash: payload.contentHash,
        desiredVersion: version,
        appliedVersion: managed?.appliedVersion ?? "0",
        appliedHash: managed?.appliedHash ?? null,
        byteSize: String(Buffer.byteLength(content, "utf8")),
        syncState: "pending",
        editPolicy: { editable: true, optimisticConcurrency: true },
        conflict: null,
        lastError: null,
        lastObservedAt: managed?.lastObservedAt ?? null,
        tombstonedAt: null,
        legacyObjectId:
          managed?.legacyObjectId ??
          existing?.objectId ??
          `agd_${randomUUID()}`,
      }),
    );
    const objectId = saved.legacyObjectId ?? saved.id;
    await this.changes.save(
      this.changes.create({
        workspaceId,
        changeType: "upsert",
        objectType: "agent_document",
        objectId,
        serverVersion: saved.desiredVersion,
        payload: { ...payload, canonicalObjectId: saved.id },
        actorUserId: userId,
        installationId: null,
      }),
    );
  }

  private async tombstone(
    workspaceId: string,
    userId: string,
    object: RelaySyncObjectEntity,
  ) {
    if (!this.managedDocuments) {
      throw new Error("MANAGED_AGENT_DOCUMENTS_UNAVAILABLE");
    }
    const managed = await this.managedDocuments
      .createQueryBuilder("document")
      .addSelect('document."desiredContent"')
      .where('document."workspaceId" = :workspaceId', { workspaceId })
      .andWhere(
        '(document.id = :canonicalId OR document."legacyObjectId" = :objectId)',
        {
          canonicalId: object.canonicalObjectId ?? object.objectId,
          objectId: object.objectId,
        },
      )
      .getOne();
    if (!managed) throw new NotFoundException("AGENT_DOCUMENT_NOT_FOUND");
    const deletedAt = new Date();
    managed.desiredVersion = String(Number(managed.desiredVersion) + 1);
    managed.desiredContent = null;
    managed.desiredHash = null;
    managed.byteSize = "0";
    managed.syncState = "pending";
    managed.tombstonedAt = deletedAt;
    const saved = await this.managedDocuments.save(managed);
    const objectId = saved.legacyObjectId ?? saved.id;
    await this.changes.save(
      this.changes.create({
        workspaceId,
        changeType: "tombstone",
        objectType: "agent_document",
        objectId,
        serverVersion: saved.desiredVersion,
        payload: {
          deletedAt: deletedAt.toISOString(),
          canonicalObjectId: saved.id,
        },
        actorUserId: userId,
        installationId: null,
      }),
    );
  }

  private async documentsForAgent(workspaceId: string, agent: AgentEntity) {
    const runtimeType = await this.runtimeTypeForAgent(agent, false);
    if (this.managedDocuments) {
      const query = this.managedDocuments
        .createQueryBuilder("document")
        .addSelect('document."desiredContent"')
        .where('document."workspaceId" = :workspaceId', { workspaceId })
        .andWhere('document."agentId" = :agentId', { agentId: agent.id })
        .andWhere('document."tombstonedAt" IS NULL')
        .orderBy('document."relativePath"', "ASC");
      if (runtimeType) {
        query.andWhere('document."runtimeType" = :runtimeType', {
          runtimeType,
        });
      }
      const managed = await query.getMany();
      return managed
        .filter((document) => typeof document.desiredContent === "string")
        .map((document) => this.managedAsSyncObject(document));
    }
    const documents = await this.objects.find({
      where: { workspaceId, objectType: "agent_document", deletedAt: IsNull() },
      order: { updatedAt: "ASC" },
    });
    const mapping = await this.objects.findOne({
      where: {
        workspaceId,
        objectType: "agent",
        canonicalObjectId: agent.id,
        deletedAt: IsNull(),
      },
    });
    const references = new Set(
      [
        agent.id,
        agent.externalId,
        mapping?.objectId,
        mapping?.sourceObjectId,
      ].filter((value): value is string => Boolean(value)),
    );
    return documents.filter((object) => {
      const payload = this.payload(object);
      if (!payload || !references.has(payload.agentId)) return false;
      try {
        validateNativeAgentDocumentPath(payload.folder, payload.filename);
      } catch {
        return false;
      }
      // A legacy external id can be present on more than one runtime host.
      // Keep those document replicas isolated instead of mixing OpenClaw and
      // Hermes files in one agent view.
      return runtimeType == null || payload.runtimeType === runtimeType;
    });
  }

  private managedAsSyncObject(
    document: ManagedAgentDocumentEntity,
  ): RelaySyncObjectEntity {
    const updatedAt = document.updatedAt ?? new Date();
    return {
      id: document.id,
      workspaceId: document.workspaceId,
      objectType: "agent_document",
      objectId: document.legacyObjectId ?? document.id,
      sourceInstallationId: null,
      sourceObjectId: document.legacyObjectId ?? document.id,
      canonicalObjectId: document.id,
      serverVersion: document.desiredVersion,
      payload: {
        agentId: document.agentId,
        runtimeType: document.runtimeType,
        root: "agent",
        folder: document.folder,
        filename: document.filename,
        documentKind: document.documentKind,
        content: document.desiredContent ?? "",
        contentHash: document.desiredHash ?? "",
        updatedAt: updatedAt.toISOString(),
      },
      deletedAt: document.tombstonedAt,
      createdAt: document.createdAt,
      updatedAt,
    } as RelaySyncObjectEntity;
  }

  private async runtimeTypeForAgent(
    agent: AgentEntity,
    required = true,
  ): Promise<"hermes" | "openclaw" | null> {
    const binding = await this.runtimeBindings.findOne({
      where: { agentId: agent.id, workspaceId: agent.workspaceId! },
    });
    const candidate = binding?.runtimeType ?? agent.source;
    if (candidate === "hermes" || candidate === "openclaw") return candidate;
    if (!required) return null;
    throw new BadRequestException("AGENT_DOCUMENT_RUNTIME_UNRESOLVED");
  }

  private async requireAgent(workspaceId: string, reference: string) {
    if (isUuid(reference)) {
      const direct = await this.agents.findOne({
        where: { workspaceId, id: reference },
      });
      if (direct) return direct;
    }
    const external = await this.agents.findOne({
      where: { workspaceId, externalId: reference },
    });
    if (external) return external;
    throw new NotFoundException("AGENT_NOT_FOUND");
  }

  private requireEditableAgent(agent: AgentEntity) {
    if (agent.lifecycleStatus && agent.lifecycleStatus !== "active") {
      throw new ConflictException("AGENT_LIFECYCLE_INELIGIBLE");
    }
  }

  private async documentState(
    workspaceId: string,
    agentId: string,
    runtimeType: string,
    relativePath: string,
  ) {
    if (!this.managedDocuments) return {};
    const document = await this.managedDocuments.findOne({
      where: { workspaceId, agentId, runtimeType, relativePath },
    });
    return document
      ? {
          documentId: document.id,
          documentKind: document.documentKind,
          desiredVersion: document.desiredVersion,
          appliedVersion: document.appliedVersion,
          syncState: document.syncState,
          runtimeHostId: document.runtimeHostId,
          lastObservedAt: document.lastObservedAt?.toISOString() ?? null,
          tombstoned: Boolean(document.tombstonedAt),
        }
      : {};
  }

  private payload(object: RelaySyncObjectEntity): CloudDocumentPayload | null {
    const payload = object.payload as Partial<CloudDocumentPayload>;
    if (
      payload.root !== "agent" ||
      typeof payload.agentId !== "string" ||
      typeof payload.folder !== "string" ||
      typeof payload.filename !== "string" ||
      typeof payload.content !== "string"
    )
      return null;
    return payload as CloudDocumentPayload;
  }

  private normalizeFolder(value: string, requireNonEmpty = false) {
    const normalized = value.trim().replace(/^\/+|\/+$/g, "");
    const parts = normalized ? normalized.split("/") : [];
    if (
      (requireNonEmpty && !parts.length) ||
      parts.length > 6 ||
      parts.some(
        (part) =>
          !part ||
          part === "." ||
          part === ".." ||
          part.includes("\\") ||
          part.includes("\0"),
      )
    )
      throw new BadRequestException("INVALID_AGENT_DOCUMENT_FOLDER");
    const result = parts.join("/");
    if (result) {
      validateManagedDocumentPath(result, "placeholder.md");
    }
    return result;
  }

  private normalizeFilename(value: string) {
    return validateManagedDocumentPath("", value).filename;
  }

  private async recordDocumentAudit(
    workspaceId: string,
    userId: string,
    agentId: string,
    eventType: string,
    documentCount: number,
  ) {
    await this.auditLogService?.record({
      actorType: "user",
      actorId: userId,
      workspaceId,
      eventType,
      resourceType: "agent",
      resourceId: agentId,
      metadata: {
        correlationId: randomUUID(),
        documentCount,
        contentRedacted: true,
        pathRedacted: true,
      },
    });
  }

  private documentKind(folder: string, filename: string) {
    const path = this.join(folder, filename).toLowerCase();
    if (path === "cron/jobs.json") return "cron";
    if (folder.toLowerCase().split("/").includes("skills")) return "skill";
    if (
      folder
        .toLowerCase()
        .split("/")
        .some((part) => part === "memory" || part === "memories")
    )
      return "memory";
    return "instruction";
  }

  private join(folder: string, name: string) {
    return folder ? `${folder}/${name}` : name;
  }
}
