import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Adds the runtime authority model without changing execution ownership.
 *
 * Existing replica rows are copied as observations. They are intentionally not
 * used to populate runtime_bindings.runtimeHostId: observation is evidence,
 * never authority. Ownership is assigned only by an explicit reconciliation
 * or link operation after this migration.
 */
export class AddRuntimeAuthorityFoundation0600000000000 implements MigrationInterface {
  name = "AddRuntimeAuthorityFoundation0600000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "runtime_hosts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "workspaceId" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
        "displayName" varchar NOT NULL,
        "hostKind" varchar NOT NULL,
        "platform" varchar,
        "status" varchar NOT NULL DEFAULT 'offline',
        "bridgeDeviceId" uuid REFERENCES "bridge_devices"("id") ON DELETE SET NULL,
        "clientInstallationId" uuid REFERENCES "relay_client_installations"("id") ON DELETE SET NULL,
        "managedRuntimeId" uuid,
        "softwareVersion" varchar,
        "protocolVersion" varchar,
        "supportedRuntimes" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "capabilities" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "lastSeenAt" timestamptz,
        "retiredAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS "IDX_runtime_hosts_workspace_status"
        ON "runtime_hosts" ("workspaceId", "status");
      CREATE INDEX IF NOT EXISTS "IDX_runtime_hosts_workspace_kind"
        ON "runtime_hosts" ("workspaceId", "hostKind");
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_runtime_hosts_bridge_device"
        ON "runtime_hosts" ("bridgeDeviceId") WHERE "bridgeDeviceId" IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_runtime_hosts_workspace_installation"
        ON "runtime_hosts" ("workspaceId", "clientInstallationId")
        WHERE "clientInstallationId" IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_runtime_hosts_managed_runtime"
        ON "runtime_hosts" ("managedRuntimeId") WHERE "managedRuntimeId" IS NOT NULL;

      CREATE TABLE IF NOT EXISTS "runtime_observations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "workspaceId" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
        "agentId" uuid REFERENCES "agents"("id") ON DELETE SET NULL,
        "runtimeHostId" uuid NOT NULL REFERENCES "runtime_hosts"("id") ON DELETE CASCADE,
        "runtimeType" varchar NOT NULL,
        "externalAgentId" varchar NOT NULL,
        "status" varchar NOT NULL DEFAULT 'active',
        "manifestHash" varchar,
        "observedState" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "quarantineReason" varchar,
        "lastSeenAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        UNIQUE ("workspaceId", "runtimeHostId", "runtimeType", "externalAgentId")
      );
      CREATE INDEX IF NOT EXISTS "IDX_runtime_observations_agent"
        ON "runtime_observations" ("workspaceId", "agentId");
      CREATE INDEX IF NOT EXISTS "IDX_runtime_observations_status"
        ON "runtime_observations" ("workspaceId", "status");

      CREATE TABLE IF NOT EXISTS "agent_identity_suppressions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "workspaceId" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
        "runtimeType" varchar NOT NULL,
        "externalAgentId" varchar NOT NULL,
        "runtimeHostId" uuid REFERENCES "runtime_hosts"("id") ON DELETE CASCADE,
        "scope" varchar NOT NULL DEFAULT 'all_hosts',
        "reason" text NOT NULL,
        "createdByUserId" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "retiredAt" timestamptz,
        "liftedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS "IDX_agent_identity_suppressions_lookup"
        ON "agent_identity_suppressions" ("workspaceId", "runtimeType", "externalAgentId");
      CREATE INDEX IF NOT EXISTS "IDX_agent_identity_suppressions_active"
        ON "agent_identity_suppressions" ("workspaceId", "liftedAt");
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_agent_identity_suppressions_all_hosts"
        ON "agent_identity_suppressions" ("workspaceId", "runtimeType", "externalAgentId")
        WHERE "scope" = 'all_hosts' AND "liftedAt" IS NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_agent_identity_suppressions_specific_host"
        ON "agent_identity_suppressions"
          ("workspaceId", "runtimeType", "externalAgentId", "runtimeHostId")
        WHERE "scope" = 'specific_host' AND "liftedAt" IS NULL;

      CREATE TABLE IF NOT EXISTS "relay_remediation_operations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "workspaceId" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
        "operationKey" varchar NOT NULL,
        "operationType" varchar NOT NULL,
        "status" varchar NOT NULL DEFAULT 'planned',
        "backupReference" varchar,
        "inventoryChecksum" varchar,
        "dryRunChecksum" varchar,
        "expectedCounts" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "actualCounts" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "report" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "requestedByUserId" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "appliedAt" timestamptz,
        "rolledBackAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        UNIQUE ("workspaceId", "operationKey")
      );

      ALTER TABLE "agents"
        ADD COLUMN IF NOT EXISTS "lifecycleStatus" varchar NOT NULL DEFAULT 'active',
        ADD COLUMN IF NOT EXISTS "lifecycleReason" text,
        ADD COLUMN IF NOT EXISTS "retiredAt" timestamptz,
        ADD COLUMN IF NOT EXISTS "retiredByUserId" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS "deletionEligibleAt" timestamptz;
      CREATE INDEX IF NOT EXISTS "IDX_agents_workspace_lifecycle"
        ON "agents" ("workspaceId", "lifecycleStatus");

      ALTER TABLE "runtime_bindings"
        ADD COLUMN IF NOT EXISTS "runtimeHostId" uuid REFERENCES "runtime_hosts"("id") ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS "runtimeExternalAgentId" varchar,
        ADD COLUMN IF NOT EXISTS "assignmentEpoch" bigint NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS "ownershipState" varchar NOT NULL DEFAULT 'unassigned',
        ADD COLUMN IF NOT EXISTS "assignedAt" timestamptz,
        ADD COLUMN IF NOT EXISTS "lastConfirmedAt" timestamptz,
        ADD COLUMN IF NOT EXISTS "previousRuntimeHostId" uuid REFERENCES "runtime_hosts"("id") ON DELETE SET NULL;
      CREATE INDEX IF NOT EXISTS "IDX_runtime_bindings_host_state"
        ON "runtime_bindings" ("workspaceId", "runtimeHostId", "ownershipState");

      ALTER TABLE "relay_execution_owner_leases"
        ALTER COLUMN "bridgeDeviceId" DROP NOT NULL,
        ADD COLUMN IF NOT EXISTS "runtimeHostId" uuid REFERENCES "runtime_hosts"("id") ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS "assignmentEpoch" bigint NOT NULL DEFAULT 1;

      ALTER TABLE "runtime_dispatches"
        ADD COLUMN IF NOT EXISTS "runtimeHostId" uuid REFERENCES "runtime_hosts"("id") ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS "assignmentEpoch" bigint NOT NULL DEFAULT 1;

      INSERT INTO "runtime_hosts" (
        "workspaceId", "displayName", "hostKind", "status", "bridgeDeviceId",
        "softwareVersion", "protocolVersion", "supportedRuntimes",
        "capabilities", "lastSeenAt", "createdAt", "updatedAt"
      )
      SELECT
        d."workspaceId", d.label,
        COALESCE(NULLIF(d."hostType", ''), 'bridge'),
        CASE
          WHEN d.status = 'revoked' THEN 'retired'
          WHEN d."lastSeenAt" >= now() - interval '2 minutes' THEN 'online'
          ELSE 'offline'
        END,
        d.id, COALESCE(d."pluginVersion", d."openCoreVersion"), '1',
        CASE WHEN d."runtimeType" IS NULL THEN '[]'::jsonb
          ELSE jsonb_build_array(d."runtimeType") END,
        jsonb_build_object('legacyBridgeCapabilities', d.capabilities),
        d."lastSeenAt", d."createdAt", d."updatedAt"
      FROM "bridge_devices" d
      ON CONFLICT ("bridgeDeviceId") WHERE "bridgeDeviceId" IS NOT NULL
      DO UPDATE SET
        "displayName" = EXCLUDED."displayName",
        "status" = EXCLUDED.status,
        "lastSeenAt" = EXCLUDED."lastSeenAt",
        "updatedAt" = now();

      INSERT INTO "runtime_observations" (
        id, "workspaceId", "agentId", "runtimeHostId", "runtimeType",
        "externalAgentId", status, "manifestHash", "observedState",
        "lastSeenAt", "createdAt", "updatedAt"
      )
      SELECT
        r.id, r."workspaceId", r."agentId", h.id, r."runtimeType",
        r."externalAgentId",
        CASE WHEN r.status = 'active' THEN 'active' ELSE 'stale' END,
        r."manifestHash",
        jsonb_build_object(
          'legacyReplicaStatus', r.status,
          'migratedFrom', 'agent_runtime_replicas'
        ),
        r."lastSeenAt", r."createdAt", r."updatedAt"
      FROM "agent_runtime_replicas" r
      JOIN "runtime_hosts" h ON h."bridgeDeviceId" = r."bridgeDeviceId"
      ON CONFLICT ("workspaceId", "runtimeHostId", "runtimeType", "externalAgentId")
      DO UPDATE SET
        "agentId" = EXCLUDED."agentId",
        "manifestHash" = EXCLUDED."manifestHash",
        "lastSeenAt" = EXCLUDED."lastSeenAt",
        "updatedAt" = now();

      -- Collisions are surfaced for review. They do not rewrite agent.source,
      -- runtime bindings, or execution leases.
      WITH collisions AS (
        SELECT "workspaceId", "externalAgentId"
        FROM "runtime_observations"
        WHERE status = 'active'
        GROUP BY "workspaceId", "externalAgentId"
        HAVING COUNT(DISTINCT "runtimeType") > 1
            OR COUNT(DISTINCT "runtimeHostId") > 1
      )
      UPDATE "runtime_observations" o
      SET status = 'quarantined',
          "quarantineReason" = 'external_agent_identity_collision',
          "updatedAt" = now()
      FROM collisions c
      WHERE o."workspaceId" = c."workspaceId"
        AND o."externalAgentId" = c."externalAgentId"
        AND o.status = 'active';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "relay_execution_owner_leases"
        DROP COLUMN IF EXISTS "assignmentEpoch",
        DROP COLUMN IF EXISTS "runtimeHostId";
      ALTER TABLE "relay_execution_owner_leases"
        ALTER COLUMN "bridgeDeviceId" SET NOT NULL;
      ALTER TABLE "runtime_dispatches"
        DROP COLUMN IF EXISTS "assignmentEpoch",
        DROP COLUMN IF EXISTS "runtimeHostId";
      ALTER TABLE "runtime_bindings"
        DROP COLUMN IF EXISTS "previousRuntimeHostId",
        DROP COLUMN IF EXISTS "lastConfirmedAt",
        DROP COLUMN IF EXISTS "assignedAt",
        DROP COLUMN IF EXISTS "ownershipState",
        DROP COLUMN IF EXISTS "assignmentEpoch",
        DROP COLUMN IF EXISTS "runtimeExternalAgentId",
        DROP COLUMN IF EXISTS "runtimeHostId";
      ALTER TABLE "agents"
        DROP COLUMN IF EXISTS "deletionEligibleAt",
        DROP COLUMN IF EXISTS "retiredByUserId",
        DROP COLUMN IF EXISTS "retiredAt",
        DROP COLUMN IF EXISTS "lifecycleReason",
        DROP COLUMN IF EXISTS "lifecycleStatus";
      DROP TABLE IF EXISTS "relay_remediation_operations";
      DROP TABLE IF EXISTS "agent_identity_suppressions";
      DROP TABLE IF EXISTS "runtime_observations";
      DROP TABLE IF EXISTS "runtime_hosts";
    `);
  }
}
