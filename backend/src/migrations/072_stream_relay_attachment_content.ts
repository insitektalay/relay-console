import { MigrationInterface, QueryRunner } from "typeorm";

export class StreamRelayAttachmentContent1785187000072 implements MigrationInterface {
  name = "StreamRelayAttachmentContent1785187000072";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "relay_sync_attachments"
        ADD COLUMN IF NOT EXISTS "uploadClaimToken" uuid,
        ADD COLUMN IF NOT EXISTS "uploadClaimExpiresAt" timestamptz,
        ADD COLUMN IF NOT EXISTS "uploadAttemptCount" integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "storageVersion" uuid
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "relay_sync_attachment_chunks" (
        "attachmentRowId" uuid NOT NULL,
        "uploadVersion" uuid NOT NULL,
        "chunkIndex" integer NOT NULL,
        "byteLength" integer NOT NULL,
        "content" bytea NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_relay_sync_attachment_chunks"
          PRIMARY KEY ("attachmentRowId", "uploadVersion", "chunkIndex"),
        CONSTRAINT "FK_relay_sync_attachment_chunks_attachment"
          FOREIGN KEY ("attachmentRowId")
          REFERENCES "relay_sync_attachments"("id")
          ON DELETE CASCADE,
        CONSTRAINT "CHK_relay_sync_attachment_chunk_index"
          CHECK ("chunkIndex" >= 0),
        CONSTRAINT "CHK_relay_sync_attachment_chunk_size"
          CHECK (
            "byteLength" BETWEEN 1 AND 65536
            AND octet_length("content") = "byteLength"
          )
      )
    `);
    await queryRunner.query(`
      UPDATE "relay_sync_attachments"
      SET "storageVersion" = gen_random_uuid()
      WHERE "content" IS NOT NULL
        AND octet_length("content") > 0
        AND "storageVersion" IS NULL
    `);
    await queryRunner.query(`
      INSERT INTO "relay_sync_attachment_chunks" (
        "attachmentRowId",
        "uploadVersion",
        "chunkIndex",
        "byteLength",
        "content"
      )
      SELECT
        attachment.id,
        attachment."storageVersion",
        series.chunk_number - 1,
        octet_length(
          substring(
            attachment."content"
            FROM ((series.chunk_number - 1) * 65536) + 1
            FOR 65536
          )
        ),
        substring(
          attachment."content"
          FROM ((series.chunk_number - 1) * 65536) + 1
          FOR 65536
        )
      FROM "relay_sync_attachments" attachment
      CROSS JOIN LATERAL generate_series(
        1,
        CEIL(octet_length(attachment."content") / 65536.0)::integer
      ) AS series(chunk_number)
      WHERE attachment."content" IS NOT NULL
        AND octet_length(attachment."content") > 0
      ON CONFLICT DO NOTHING
    `);
    await queryRunner.query(`
      UPDATE "relay_sync_attachments"
      SET
        "storageKey" = 'postgres-chunks:' || id::text,
        "content" = NULL
      WHERE "storageVersion" IS NOT NULL
        AND "content" IS NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "relay_sync_attachments"
        ADD CONSTRAINT "CHK_relay_sync_attachment_upload_attempts"
          CHECK ("uploadAttemptCount" >= 0),
        ADD CONSTRAINT "CHK_relay_sync_attachment_upload_claim"
          CHECK (
            status <> 'uploading'
            OR (
              "uploadClaimToken" IS NOT NULL
              AND "uploadClaimExpiresAt" IS NOT NULL
              AND "uploadAttemptCount" >= 1
            )
          )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_relay_sync_attachment_stale_claim"
        ON "relay_sync_attachments" (status, "uploadClaimExpiresAt")
        WHERE status = 'uploading'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "relay_sync_attachments" attachment
      SET "content" = restored.content
      FROM (
        SELECT
          chunks."attachmentRowId",
          chunks."uploadVersion",
          string_agg(chunks."content", ''::bytea ORDER BY chunks."chunkIndex") AS content
        FROM "relay_sync_attachment_chunks" chunks
        GROUP BY chunks."attachmentRowId", chunks."uploadVersion"
      ) restored
      WHERE attachment.id = restored."attachmentRowId"
        AND attachment."storageVersion" = restored."uploadVersion"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_relay_sync_attachment_stale_claim";
      DROP TABLE IF EXISTS "relay_sync_attachment_chunks";
      ALTER TABLE "relay_sync_attachments"
        DROP CONSTRAINT IF EXISTS "CHK_relay_sync_attachment_upload_claim",
        DROP CONSTRAINT IF EXISTS "CHK_relay_sync_attachment_upload_attempts",
        DROP COLUMN IF EXISTS "storageVersion",
        DROP COLUMN IF EXISTS "uploadAttemptCount",
        DROP COLUMN IF EXISTS "uploadClaimExpiresAt",
        DROP COLUMN IF EXISTS "uploadClaimToken"
    `);
  }
}
