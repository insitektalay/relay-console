import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Adds explicit native-agent consent state and deterministic provisioning
 * targets. Existing bindings remain authoritative. The migration does not map
 * agents by display name and does not read or persist native filesystem paths.
 */
export class AddNativeAgentConnection1722009600065
  implements MigrationInterface
{
  name = "AddNativeAgentConnection1722009600065";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "runtime_observations"
        ADD COLUMN IF NOT EXISTS "connectionState" varchar NOT NULL DEFAULT 'discovered',
        ADD COLUMN IF NOT EXISTS "origin" varchar NOT NULL DEFAULT 'legacy_unknown',
        ADD COLUMN IF NOT EXISTS "displayMetadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS "capabilitySnapshot" jsonb NOT NULL DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS "compatibilityStatus" varchar NOT NULL DEFAULT 'unknown',
        ADD COLUMN IF NOT EXISTS "compatibilityReason" text,
        ADD COLUMN IF NOT EXISTS "inventoryGeneration" varchar,
        ADD COLUMN IF NOT EXISTS "firstSeenAt" timestamptz,
        ADD COLUMN IF NOT EXISTS "lastScannedAt" timestamptz,
        ADD COLUMN IF NOT EXISTS "connectedAt" timestamptz,
        ADD COLUMN IF NOT EXISTS "disconnectedAt" timestamptz,
        ADD COLUMN IF NOT EXISTS "documentConsentVersion" integer;

      UPDATE "runtime_observations"
      SET
        "connectionState" = CASE
          WHEN status = 'quarantined' THEN 'quarantined'
          WHEN "agentId" IS NOT NULL THEN 'connected'
          WHEN status = 'stale' THEN 'unavailable'
          ELSE 'discovered'
        END,
        "origin" = 'legacy_unknown',
        "firstSeenAt" = COALESCE("firstSeenAt", "createdAt"),
        "lastScannedAt" = COALESCE("lastScannedAt", "lastSeenAt", "updatedAt"),
        "connectedAt" = CASE
          WHEN "agentId" IS NOT NULL
          THEN COALESCE("connectedAt", "updatedAt")
          ELSE "connectedAt"
        END;

      CREATE INDEX IF NOT EXISTS "IDX_runtime_observations_connection_state"
        ON "runtime_observations" ("workspaceId", "connectionState");
      CREATE INDEX IF NOT EXISTS "IDX_runtime_observations_host_connection"
        ON "runtime_observations" ("runtimeHostId", "connectionState");

      CREATE TABLE IF NOT EXISTS "runtime_provisioning_targets" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "workspaceId" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
        "runtimeType" varchar NOT NULL,
        "runtimeHostId" uuid REFERENCES "runtime_hosts"("id") ON DELETE SET NULL,
        "status" varchar NOT NULL DEFAULT 'needs_review',
        "selectionSource" varchar NOT NULL DEFAULT 'initial_connection',
        "selectedByUserId" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "lastValidatedAt" timestamptz,
        "statusReason" text,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        UNIQUE ("workspaceId", "runtimeType")
      );
      CREATE INDEX IF NOT EXISTS "IDX_runtime_provisioning_targets_host_status"
        ON "runtime_provisioning_targets" ("runtimeHostId", status);

      WITH binding_candidates AS (
        SELECT
          b."workspaceId",
          b."runtimeType",
          MIN(b."runtimeHostId"::text)::uuid AS "runtimeHostId"
        FROM "runtime_bindings" b
        JOIN "runtime_hosts" h
          ON h.id = b."runtimeHostId"
         AND h."workspaceId" = b."workspaceId"
        WHERE b."runtimeHostId" IS NOT NULL
          AND b."isEnabled" = true
          AND h.status NOT IN ('retired', 'quarantined')
        GROUP BY b."workspaceId", b."runtimeType"
        HAVING COUNT(DISTINCT b."runtimeHostId") = 1
      )
      INSERT INTO "runtime_provisioning_targets" (
        "workspaceId", "runtimeType", "runtimeHostId", status,
        "selectionSource", "lastValidatedAt", "statusReason"
      )
      SELECT
        "workspaceId", "runtimeType", "runtimeHostId", 'active',
        'legacy_backfill', now(), 'derived_from_single_active_binding_host'
      FROM binding_candidates
      ON CONFLICT ("workspaceId", "runtimeType") DO NOTHING;

      WITH eligible_hosts AS (
        SELECT
          h."workspaceId",
          runtime.value AS "runtimeType",
          h.id AS "runtimeHostId"
        FROM "runtime_hosts" h
        CROSS JOIN LATERAL jsonb_array_elements_text(h."supportedRuntimes")
          AS runtime(value)
        WHERE h.status NOT IN ('retired', 'quarantined')
      ),
      sole_hosts AS (
        SELECT
          "workspaceId",
          "runtimeType",
          MIN("runtimeHostId"::text)::uuid AS "runtimeHostId"
        FROM eligible_hosts
        GROUP BY "workspaceId", "runtimeType"
        HAVING COUNT(*) = 1
      )
      INSERT INTO "runtime_provisioning_targets" (
        "workspaceId", "runtimeType", "runtimeHostId", status,
        "selectionSource", "lastValidatedAt", "statusReason"
      )
      SELECT
        "workspaceId", "runtimeType", "runtimeHostId", 'active',
        'sole_eligible_host', now(), 'derived_from_sole_eligible_host'
      FROM sole_hosts
      ON CONFLICT ("workspaceId", "runtimeType") DO NOTHING;

      WITH eligible_hosts AS (
        SELECT
          h."workspaceId",
          runtime.value AS "runtimeType"
        FROM "runtime_hosts" h
        CROSS JOIN LATERAL jsonb_array_elements_text(h."supportedRuntimes")
          AS runtime(value)
        WHERE h.status NOT IN ('retired', 'quarantined')
      ),
      ambiguous AS (
        SELECT "workspaceId", "runtimeType"
        FROM eligible_hosts
        GROUP BY "workspaceId", "runtimeType"
        HAVING COUNT(*) > 1
      )
      INSERT INTO "runtime_provisioning_targets" (
        "workspaceId", "runtimeType", "runtimeHostId", status,
        "selectionSource", "lastValidatedAt", "statusReason"
      )
      SELECT
        "workspaceId", "runtimeType", NULL, 'needs_review',
        'legacy_backfill', now(), 'multiple_eligible_hosts'
      FROM ambiguous
      ON CONFLICT ("workspaceId", "runtimeType") DO NOTHING;

      ALTER TABLE "agent_provisioning_jobs"
        ADD COLUMN IF NOT EXISTS "runtimeType" varchar,
        ADD COLUMN IF NOT EXISTS "runtimeHostId" uuid
          REFERENCES "runtime_hosts"("id") ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS "targetResolutionSource" varchar,
        ADD COLUMN IF NOT EXISTS "idempotencyKey" varchar,
        ADD COLUMN IF NOT EXISTS "dispatchedAt" timestamptz,
        ADD COLUMN IF NOT EXISTS "acknowledgedAt" timestamptz,
        ADD COLUMN IF NOT EXISTS "nativeCreatedAt" timestamptz,
        ADD COLUMN IF NOT EXISTS "failedAt" timestamptz,
        ADD COLUMN IF NOT EXISTS "errorCode" varchar;

      UPDATE "agent_provisioning_jobs"
      SET
        "runtimeType" = COALESCE(
          "runtimeType",
          NULLIF(payload->>'runtimeType', ''),
          'openclaw'
        ),
        "idempotencyKey" = COALESCE("idempotencyKey", 'legacy:' || id::text),
        "targetResolutionSource" = COALESCE(
          "targetResolutionSource",
          'legacy_untargeted'
        ),
        "failedAt" = CASE
          WHEN status = 'failed' THEN COALESCE("failedAt", "completedAt", "updatedAt")
          ELSE "failedAt"
        END;

      ALTER TABLE "agent_provisioning_jobs"
        ALTER COLUMN "idempotencyKey" SET NOT NULL;

      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_agent_provisioning_jobs_workspace_idempotency"
        ON "agent_provisioning_jobs" ("workspaceId", "idempotencyKey");
      CREATE INDEX IF NOT EXISTS "IDX_agent_provisioning_jobs_host_status"
        ON "agent_provisioning_jobs" ("runtimeHostId", status);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_agent_provisioning_jobs_host_status";
      DROP INDEX IF EXISTS "UQ_agent_provisioning_jobs_workspace_idempotency";
      ALTER TABLE "agent_provisioning_jobs"
        DROP COLUMN IF EXISTS "errorCode",
        DROP COLUMN IF EXISTS "failedAt",
        DROP COLUMN IF EXISTS "nativeCreatedAt",
        DROP COLUMN IF EXISTS "acknowledgedAt",
        DROP COLUMN IF EXISTS "dispatchedAt",
        DROP COLUMN IF EXISTS "idempotencyKey",
        DROP COLUMN IF EXISTS "targetResolutionSource",
        DROP COLUMN IF EXISTS "runtimeHostId",
        DROP COLUMN IF EXISTS "runtimeType";

      DROP TABLE IF EXISTS "runtime_provisioning_targets";

      DROP INDEX IF EXISTS "IDX_runtime_observations_host_connection";
      DROP INDEX IF EXISTS "IDX_runtime_observations_connection_state";
      ALTER TABLE "runtime_observations"
        DROP COLUMN IF EXISTS "documentConsentVersion",
        DROP COLUMN IF EXISTS "disconnectedAt",
        DROP COLUMN IF EXISTS "connectedAt",
        DROP COLUMN IF EXISTS "lastScannedAt",
        DROP COLUMN IF EXISTS "firstSeenAt",
        DROP COLUMN IF EXISTS "inventoryGeneration",
        DROP COLUMN IF EXISTS "compatibilityReason",
        DROP COLUMN IF EXISTS "compatibilityStatus",
        DROP COLUMN IF EXISTS "capabilitySnapshot",
        DROP COLUMN IF EXISTS "displayMetadata",
        DROP COLUMN IF EXISTS "origin",
        DROP COLUMN IF EXISTS "connectionState";
    `);
  }
}
