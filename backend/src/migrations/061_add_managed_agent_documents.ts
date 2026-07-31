import { MigrationInterface, QueryRunner } from "typeorm";

export class AddManagedAgentDocuments0610000000000 implements MigrationInterface {
  name = "AddManagedAgentDocuments0610000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "managed_agent_documents" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "workspaceId" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
        "agentId" uuid NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
        "runtimeHostId" uuid REFERENCES "runtime_hosts"("id") ON DELETE SET NULL,
        "runtimeObservationId" uuid REFERENCES "runtime_observations"("id") ON DELETE SET NULL,
        "runtimeType" varchar NOT NULL,
        "authorityClass" varchar NOT NULL DEFAULT 'managed',
        "documentKind" varchar NOT NULL,
        "relativePath" varchar NOT NULL,
        folder varchar NOT NULL,
        filename varchar NOT NULL,
        "desiredContent" text,
        "desiredHash" varchar,
        "desiredVersion" bigint NOT NULL DEFAULT 1,
        "appliedVersion" bigint NOT NULL DEFAULT 0,
        "appliedHash" varchar,
        "byteSize" bigint NOT NULL DEFAULT 0,
        "syncState" varchar NOT NULL DEFAULT 'saved',
        "editPolicy" jsonb NOT NULL DEFAULT '{}'::jsonb,
        conflict jsonb,
        "lastError" text,
        "lastObservedAt" timestamptz,
        "tombstonedAt" timestamptz,
        "legacyObjectId" varchar,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        UNIQUE ("workspaceId", "agentId", "runtimeType", "relativePath")
      );
      CREATE INDEX IF NOT EXISTS "IDX_managed_agent_documents_state"
        ON "managed_agent_documents" ("workspaceId", "agentId", "syncState");
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_managed_agent_documents_legacy_object"
        ON "managed_agent_documents" ("workspaceId", "legacyObjectId")
        WHERE "legacyObjectId" IS NOT NULL;

      CREATE TABLE IF NOT EXISTS "runtime_document_manifests" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "workspaceId" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
        "agentId" uuid NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
        "runtimeObservationId" uuid NOT NULL REFERENCES "runtime_observations"("id") ON DELETE CASCADE,
        "manifestHash" varchar NOT NULL,
        complete boolean NOT NULL DEFAULT false,
        "acceptedCount" integer NOT NULL DEFAULT 0,
        "excludedCount" integer NOT NULL DEFAULT 0,
        exclusions jsonb NOT NULL DEFAULT '[]'::jsonb,
        "observedAt" timestamptz NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        UNIQUE ("runtimeObservationId", "manifestHash")
      );

      INSERT INTO "managed_agent_documents" (
        "workspaceId", "agentId", "runtimeType", "authorityClass",
        "documentKind", "relativePath", folder, filename, "desiredContent",
        "desiredHash", "desiredVersion", "byteSize", "syncState",
        "editPolicy", "legacyObjectId", "createdAt", "updatedAt"
      )
      SELECT
        o."workspaceId", a.id,
        CASE WHEN o.payload ->> 'runtimeType' IN ('hermes', 'openclaw')
          THEN o.payload ->> 'runtimeType' ELSE a.source END,
        'managed', COALESCE(o.payload ->> 'documentKind', 'instruction'),
        concat_ws('/', NULLIF(o.payload ->> 'folder', ''), o.payload ->> 'filename'),
        COALESCE(o.payload ->> 'folder', ''), o.payload ->> 'filename',
        o.payload ->> 'content', o.payload ->> 'contentHash',
        o."serverVersion",
        octet_length(convert_to(COALESCE(o.payload ->> 'content', ''), 'UTF8')),
        'saved', '{"editable":true}'::jsonb, o."objectId",
        o."createdAt", o."updatedAt"
      FROM relay_sync_objects o
      LEFT JOIN relay_sync_objects m
        ON m."workspaceId" = o."workspaceId"
       AND m."objectType" = 'agent'
       AND (m."objectId" = o.payload ->> 'agentId'
         OR m."sourceObjectId" = o.payload ->> 'agentId')
      JOIN agents a
        ON a.id::text = COALESCE(m."canonicalObjectId", o.payload ->> 'agentId')
      WHERE o."objectType" = 'agent_document'
        AND o."deletedAt" IS NULL
        AND o.payload ->> 'filename' IS NOT NULL
        AND o.payload ->> 'content' IS NOT NULL
        AND octet_length(convert_to(o.payload ->> 'content', 'UTF8')) <= 1048576
      ON CONFLICT ("workspaceId", "agentId", "runtimeType", "relativePath")
      DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS "runtime_document_manifests";
      DROP TABLE IF EXISTS "managed_agent_documents";
    `);
  }
}
