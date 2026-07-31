import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRelaySync0490000000000 implements MigrationInterface {
  name = "AddRelaySync0490000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "marketplace_connections"
      ADD COLUMN IF NOT EXISTS "executionAuthority" varchar(16) NOT NULL DEFAULT 'railway';
      DO $$ BEGIN
        ALTER TABLE "marketplace_connections"
        ADD CONSTRAINT "CHK_marketplace_connections_execution_authority"
        CHECK ("executionAuthority" IN ('railway', 'swift')) NOT VALID;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "relay_deployments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "deploymentKey" varchar NOT NULL UNIQUE,
        "displayName" varchar NOT NULL, "apiVersion" varchar NOT NULL, "syncContractVersion" varchar NOT NULL,
        "runtimeContractVersion" varchar NOT NULL, "marketplaceContractVersion" varchar NOT NULL,
        "ownershipType" varchar NOT NULL DEFAULT 'relay_managed', "capabilities" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS "relay_client_installations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "deploymentId" uuid NOT NULL REFERENCES "relay_deployments"("id") ON DELETE CASCADE,
        "userId" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE, "installationPublicId" varchar NOT NULL,
        "clientKind" varchar NOT NULL, "clientVersion" varchar NOT NULL, "label" varchar,
        "capabilities" jsonb NOT NULL DEFAULT '{}'::jsonb, "lastSeenAt" timestamptz, "revokedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(),
        UNIQUE ("deploymentId", "installationPublicId")
      );
      CREATE INDEX IF NOT EXISTS "IDX_relay_installations_user" ON "relay_client_installations" ("userId", "revokedAt");
      CREATE TABLE IF NOT EXISTS "relay_workspace_sync_links" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "deploymentId" uuid NOT NULL REFERENCES "relay_deployments"("id") ON DELETE CASCADE,
        "installationId" uuid NOT NULL REFERENCES "relay_client_installations"("id") ON DELETE CASCADE,
        "userId" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE, "workspaceId" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
        "localWorkspaceId" varchar NOT NULL, "status" varchar NOT NULL DEFAULT 'active', "attachmentPolicy" varchar NOT NULL DEFAULT 'metadata_only',
        "offlineRetention" boolean NOT NULL DEFAULT true, "pullCursor" bigint NOT NULL DEFAULT 0,
        "pausedAt" timestamptz, "unlinkedAt" timestamptz, "forkLocalWorkspaceId" varchar,
        "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(),
        UNIQUE ("deploymentId", "installationId", "localWorkspaceId"), UNIQUE ("workspaceId", "installationId")
      );
      CREATE TABLE IF NOT EXISTS "relay_workspace_imports" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "syncLinkId" uuid NOT NULL REFERENCES "relay_workspace_sync_links"("id") ON DELETE CASCADE,
        "workspaceId" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
        "installationId" uuid NOT NULL REFERENCES "relay_client_installations"("id") ON DELETE CASCADE,
        "manifestKey" varchar NOT NULL, "schemaVersion" varchar NOT NULL, "status" varchar NOT NULL DEFAULT 'validated',
        "counts" jsonb NOT NULL DEFAULT '{}'::jsonb, "exclusions" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "conflicts" jsonb NOT NULL DEFAULT '[]'::jsonb, "cloudStorageConsent" boolean NOT NULL DEFAULT false,
        "backupCheckpoint" varchar, "acceptedCount" integer NOT NULL DEFAULT 0, "rejectedCount" integer NOT NULL DEFAULT 0,
        "lastBatchKey" varchar, "completedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(),
        UNIQUE ("workspaceId", "installationId", "manifestKey")
      );
      CREATE TABLE IF NOT EXISTS "relay_sync_objects" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "workspaceId" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
        "objectType" varchar NOT NULL, "objectId" varchar NOT NULL, "sourceInstallationId" uuid REFERENCES "relay_client_installations"("id") ON DELETE CASCADE,
        "sourceObjectId" varchar NOT NULL, "canonicalObjectId" varchar, "serverVersion" bigint NOT NULL DEFAULT 1,
        "payload" jsonb NOT NULL DEFAULT '{}'::jsonb, "deletedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(),
        UNIQUE ("workspaceId", "objectType", "objectId"), UNIQUE ("workspaceId", "sourceInstallationId", "objectType", "sourceObjectId")
      );
      CREATE TABLE IF NOT EXISTS "relay_import_batch_receipts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "importId" uuid NOT NULL REFERENCES "relay_workspace_imports"("id") ON DELETE CASCADE,
        "batchKey" varchar NOT NULL, "outcomes" jsonb NOT NULL DEFAULT '[]'::jsonb, "finalBatch" boolean NOT NULL DEFAULT false,
        "createdAt" timestamptz NOT NULL DEFAULT now(), UNIQUE ("importId", "batchKey")
      );
      CREATE TABLE IF NOT EXISTS "relay_workspace_changes" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "workspaceId" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
        "sequence" bigserial NOT NULL UNIQUE, "changeType" varchar NOT NULL, "objectType" varchar NOT NULL,
        "objectId" varchar NOT NULL, "serverVersion" bigint NOT NULL, "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "actorUserId" uuid, "installationId" uuid, "createdAt" timestamptz NOT NULL DEFAULT now(),
        UNIQUE ("workspaceId", "sequence")
      );
      CREATE INDEX IF NOT EXISTS "IDX_relay_changes_workspace" ON "relay_workspace_changes" ("workspaceId", "sequence");
      CREATE TABLE IF NOT EXISTS "relay_client_mutation_receipts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "deploymentId" uuid NOT NULL REFERENCES "relay_deployments"("id") ON DELETE CASCADE,
        "workspaceId" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
        "installationId" uuid NOT NULL REFERENCES "relay_client_installations"("id") ON DELETE CASCADE,
        "clientMutationId" varchar NOT NULL, "operation" varchar NOT NULL, "objectType" varchar NOT NULL,
        "objectId" varchar NOT NULL, "canonicalObjectId" varchar, "serverVersion" bigint NOT NULL, "changeSequence" bigint NOT NULL,
        "result" jsonb NOT NULL DEFAULT '{}'::jsonb, "createdAt" timestamptz NOT NULL DEFAULT now(),
        UNIQUE ("deploymentId", "installationId", "clientMutationId")
      );
      CREATE TABLE IF NOT EXISTS "relay_sync_conflicts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "workspaceId" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
        "installationId" uuid NOT NULL REFERENCES "relay_client_installations"("id") ON DELETE CASCADE,
        "clientMutationId" varchar NOT NULL, "objectType" varchar NOT NULL, "objectId" varchar NOT NULL,
        "conflictType" varchar NOT NULL, "baseServerVersion" bigint, "canonicalServerVersion" bigint NOT NULL,
        "clientPayload" jsonb NOT NULL, "canonicalPayload" jsonb NOT NULL, "resolvedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS "IDX_relay_conflicts_open" ON "relay_sync_conflicts" ("workspaceId", "resolvedAt");
      CREATE TABLE IF NOT EXISTS "relay_sync_attachments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "workspaceId" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
        "attachmentId" varchar NOT NULL, "sourceInstallationId" varchar NOT NULL, "sourceAttachmentId" varchar NOT NULL,
        "fileName" varchar NOT NULL, "contentType" varchar NOT NULL, "byteSize" bigint NOT NULL, "sha256" varchar NOT NULL,
        "status" varchar NOT NULL DEFAULT 'negotiated', "availability" varchar NOT NULL DEFAULT 'cloud', "storageKey" varchar,
        "content" bytea, "uploadTokenHash" varchar, "uploadExpiresAt" timestamptz,
        "provenance" jsonb NOT NULL DEFAULT '{}'::jsonb, "deletedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(),
        UNIQUE ("workspaceId", "attachmentId")
      );
      CREATE TABLE IF NOT EXISTS "relay_execution_owner_leases" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "workspaceId" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
        "agentId" uuid NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE, "bridgeDeviceId" uuid NOT NULL REFERENCES "bridge_devices"("id") ON DELETE CASCADE,
        "ownerKind" varchar NOT NULL, "state" varchar NOT NULL DEFAULT 'active', "leaseExpiresAt" timestamptz NOT NULL,
        "drainedAt" timestamptz, "revokedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(), UNIQUE ("workspaceId", "agentId")
      );
    `);
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION relay_redact_sync_json(value jsonb) RETURNS jsonb AS $$
      DECLARE result jsonb; item record;
      BEGIN
        IF jsonb_typeof(value) = 'object' THEN
          result := '{}'::jsonb;
          FOR item IN SELECT key, val FROM jsonb_each(value) AS e(key, val) LOOP
            IF item.key !~* '(secret|token|password|credential|keychain|runtime_?home|runtimehome|hermes_?home|hermeshome|openclaw_?home|openclawhome|workspace_?root|workspaceroot|database_?path|databasepath|absolute_?path|absolutepath|local_?path|localpath|log_?content|logcontent)' THEN
              result := result || jsonb_build_object(item.key, relay_redact_sync_json(item.val));
            END IF;
          END LOOP;
          RETURN result;
        ELSIF jsonb_typeof(value) = 'array' THEN
          SELECT COALESCE(jsonb_agg(relay_redact_sync_json(element)), '[]'::jsonb) INTO result FROM jsonb_array_elements(value) AS a(element);
          RETURN result;
        END IF;
        RETURN value;
      END;
      $$ LANGUAGE plpgsql IMMUTABLE;

      CREATE OR REPLACE FUNCTION relay_capture_workspace_change() RETURNS trigger AS $$
      DECLARE
        row_data jsonb;
        workspace_uuid uuid;
        object_id text;
        next_version bigint;
        object_kind text := TG_ARGV[0];
      BEGIN
        IF current_setting('relay.sync_apply', true) = '1' THEN
          IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
        END IF;
        row_data := relay_redact_sync_json(CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END);
        object_id := row_data->>'id';
        workspace_uuid := NULLIF(row_data->>'workspaceId', '')::uuid;
        IF workspace_uuid IS NULL AND row_data ? 'threadId' THEN
          SELECT "workspaceId" INTO workspace_uuid FROM "threads" WHERE "id" = (row_data->>'threadId')::uuid;
        END IF;
        IF workspace_uuid IS NULL AND TG_TABLE_NAME = 'runs' THEN
          SELECT "workspaceId" INTO workspace_uuid FROM "tasks" WHERE "id" = (row_data->>'taskId')::uuid;
        END IF;
        IF workspace_uuid IS NULL AND TG_TABLE_NAME = 'run_events' THEN
          SELECT t."workspaceId" INTO workspace_uuid FROM "runs" r JOIN "tasks" t ON t."id" = r."taskId" WHERE r."id" = (row_data->>'runId')::uuid;
        END IF;
        IF workspace_uuid IS NULL THEN
          IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
        END IF;
        row_data := row_data - ARRAY['passwordHash','refreshToken','credentials','encryptedCredentials','token','secret','localPath','workspacePath'];
        INSERT INTO "relay_sync_objects" ("workspaceId","objectType","objectId","sourceInstallationId","sourceObjectId","canonicalObjectId","serverVersion","payload","deletedAt","createdAt","updatedAt")
        VALUES (workspace_uuid, object_kind, object_id, NULL, object_id, object_id, 1, row_data,
          CASE WHEN TG_OP = 'DELETE' THEN now() ELSE NULL END, now(), now())
        ON CONFLICT ("workspaceId","objectType","objectId") DO UPDATE SET
          "serverVersion" = "relay_sync_objects"."serverVersion" + 1,
          "payload" = EXCLUDED."payload", "canonicalObjectId" = EXCLUDED."canonicalObjectId",
          "deletedAt" = EXCLUDED."deletedAt", "updatedAt" = now()
        RETURNING "serverVersion" INTO next_version;
        INSERT INTO "relay_workspace_changes" ("workspaceId","changeType","objectType","objectId","serverVersion","payload","actorUserId","installationId","createdAt")
        VALUES (workspace_uuid, CASE WHEN TG_OP = 'DELETE' THEN 'tombstone' ELSE 'upsert' END,
          object_kind, object_id, next_version,
          CASE WHEN TG_OP = 'DELETE' THEN jsonb_build_object('deletedAt',now(),'canonicalObjectId',object_id) ELSE row_data || jsonb_build_object('canonicalObjectId',object_id) END,
          NULL, NULL, now());
        IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
      END;
      $$ LANGUAGE plpgsql;
    `);
    for (const [table, kind] of [
      ["agents", "agent"], ["threads", "thread"], ["thread_sessions", "thread_session"],
      ["messages", "message"], ["thread_read_states", "read_state"], ["thread_wrap_up_reports", "thread_wrap_up"],
      ["tasks", "task"], ["runs", "run"], ["run_events", "runtime_event"], ["approvals", "approval"],
      ["runtime_dispatches", "dispatch_status"],
    ]) {
      await queryRunner.query(`DROP TRIGGER IF EXISTS "trg_relay_sync_${table}" ON "${table}"`);
      await queryRunner.query(`CREATE TRIGGER "trg_relay_sync_${table}" AFTER INSERT OR UPDATE OR DELETE ON "${table}" FOR EACH ROW EXECUTE FUNCTION relay_capture_workspace_change('${kind}')`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of ["agents","threads","thread_sessions","messages","thread_read_states","thread_wrap_up_reports","tasks","runs","run_events","approvals","runtime_dispatches"]) {
      await queryRunner.query(`DROP TRIGGER IF EXISTS "trg_relay_sync_${table}" ON "${table}"`);
    }
    await queryRunner.query("DROP FUNCTION IF EXISTS relay_capture_workspace_change()");
    await queryRunner.query("DROP FUNCTION IF EXISTS relay_redact_sync_json(jsonb)");
    for (const table of [
      "relay_execution_owner_leases", "relay_sync_attachments", "relay_sync_conflicts",
      "relay_client_mutation_receipts", "relay_workspace_changes", "relay_import_batch_receipts", "relay_sync_objects",
      "relay_workspace_imports", "relay_workspace_sync_links", "relay_client_installations", "relay_deployments",
    ]) {
      await queryRunner.query(`DROP TABLE IF EXISTS "${table}" CASCADE`);
    }
    await queryRunner.query(`ALTER TABLE "marketplace_connections" DROP CONSTRAINT IF EXISTS "CHK_marketplace_connections_execution_authority"`);
    await queryRunner.query(`ALTER TABLE "marketplace_connections" DROP COLUMN IF EXISTS "executionAuthority"`);
  }
}
