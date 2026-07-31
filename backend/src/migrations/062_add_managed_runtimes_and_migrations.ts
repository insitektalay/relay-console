import { MigrationInterface, QueryRunner } from "typeorm";

export class AddManagedRuntimesAndMigrations0620000000000 implements MigrationInterface {
  name = "AddManagedRuntimesAndMigrations0620000000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "managed_runtimes" (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "workspaceId" uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        "agentId" uuid REFERENCES agents(id) ON DELETE SET NULL,
        "runtimeHostId" uuid REFERENCES runtime_hosts(id) ON DELETE SET NULL,
        "runtimeType" varchar NOT NULL DEFAULT 'hermes',
        status varchar NOT NULL DEFAULT 'provisioning',
        "ownershipType" varchar NOT NULL DEFAULT 'relay_managed',
        region varchar,
        "providerRuntimeReference" varchar,
        "providerVolumeReference" varchar,
        "storageQuotaBytes" bigint NOT NULL DEFAULT 21474836480,
        "storageUsedBytes" bigint NOT NULL DEFAULT 0,
        "modelAuthorizationStatus" varchar,
        "lastHealthyAt" timestamptz,
        "suspendedAt" timestamptz,
        "cancellationRequestedAt" timestamptz,
        "retentionEndsAt" timestamptz,
        "deletedAt" timestamptz,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_managed_runtimes_hermes_only" CHECK ("runtimeType" = 'hermes')
      );
      CREATE INDEX IF NOT EXISTS "IDX_managed_runtimes_workspace_status"
        ON managed_runtimes ("workspaceId", status);
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_managed_runtimes_host"
        ON managed_runtimes ("runtimeHostId") WHERE "runtimeHostId" IS NOT NULL;

      CREATE TABLE IF NOT EXISTS "runtime_migrations" (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "workspaceId" uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        "agentId" uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
        "operationKey" varchar NOT NULL,
        "runtimeType" varchar NOT NULL,
        "sourceRuntimeHostId" uuid NOT NULL REFERENCES runtime_hosts(id),
        "destinationRuntimeHostId" uuid NOT NULL REFERENCES runtime_hosts(id),
        "sourceObservationId" uuid REFERENCES runtime_observations(id) ON DELETE SET NULL,
        "destinationObservationId" uuid REFERENCES runtime_observations(id) ON DELETE SET NULL,
        status varchar NOT NULL DEFAULT 'planned',
        "sourceAssignmentEpoch" bigint,
        "destinationAssignmentEpoch" bigint,
        "manifestHash" varchar,
        manifest jsonb NOT NULL DEFAULT '{}'::jsonb,
        "credentialsReauthorizationRequired" boolean NOT NULL DEFAULT true,
        "validationChecks" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "lastError" text,
        "sourcePausedAt" timestamptz,
        "switchedAt" timestamptz,
        "completedAt" timestamptz,
        "rolledBackAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        UNIQUE ("workspaceId", "operationKey"),
        CONSTRAINT "CHK_runtime_migrations_same_harness" CHECK ("runtimeType" IN ('hermes', 'openclaw')),
        CONSTRAINT "CHK_runtime_migrations_distinct_hosts" CHECK ("sourceRuntimeHostId" <> "destinationRuntimeHostId")
      );
      CREATE INDEX IF NOT EXISTS "IDX_runtime_migrations_agent_status"
        ON runtime_migrations ("agentId", status);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS runtime_migrations;
      DROP TABLE IF EXISTS managed_runtimes;
    `);
  }
}
