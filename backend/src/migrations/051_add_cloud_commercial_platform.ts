import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCloudCommercialPlatform0510000000000 implements MigrationInterface {
  name = "AddCloudCommercialPlatform0510000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "relay_commercial_subscriptions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "workspaceId" uuid NOT NULL UNIQUE REFERENCES "workspaces"("id") ON DELETE CASCADE,
        "plan" varchar NOT NULL DEFAULT 'managed_personal', "status" varchar NOT NULL DEFAULT 'active',
        "providerCustomerId" varchar, "providerSubscriptionId" varchar,
        "limits" jsonb NOT NULL DEFAULT '{}'::jsonb, "features" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "trialEndsAt" timestamptz, "graceEndsAt" timestamptz, "readOnlyAt" timestamptz,
        "deletionEligibleAt" timestamptz, "cancelledAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_relay_subscription_status" CHECK ("status" IN ('trial','active','past_due','grace','read_only','cancelled','deletion_scheduled'))
      );
      CREATE TABLE IF NOT EXISTS "relay_support_access_grants" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "workspaceId" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
        "grantedByUserId" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE, "supportPrincipalId" varchar NOT NULL,
        "scopes" jsonb NOT NULL DEFAULT '[]'::jsonb, "reason" varchar, "expiresAt" timestamptz NOT NULL,
        "revokedAt" timestamptz, "createdAt" timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS "IDX_relay_support_grants_workspace_expiry" ON "relay_support_access_grants" ("workspaceId", "expiresAt");
      CREATE TABLE IF NOT EXISTS "relay_backup_records" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "deploymentKey" varchar NOT NULL, "workspaceId" uuid,
        "provider" varchar NOT NULL, "backupReference" varchar NOT NULL, "status" varchar NOT NULL DEFAULT 'pending',
        "encrypted" boolean NOT NULL DEFAULT true, "databaseMigration" varchar, "sizeBytes" bigint,
        "completedAt" timestamptz, "restoreTestedAt" timestamptz, "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS "IDX_relay_backups_deployment_completed" ON "relay_backup_records" ("deploymentKey", "completedAt");
      CREATE TABLE IF NOT EXISTS "relay_operator_deployments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "deploymentKey" varchar NOT NULL UNIQUE, "ownershipType" varchar NOT NULL,
        "customerReference" varchar, "railwayProjectId" varchar, "railwayEnvironmentId" varchar,
        "backendOrigin" varchar, "webOrigin" varchar, "status" varchar NOT NULL DEFAULT 'provisioning',
        "releaseVersion" varchar, "migrationVersion" varchar, "lastHealthyAt" timestamptz,
        "capacity" jsonb NOT NULL DEFAULT '{}'::jsonb, "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_relay_deployment_ownership" CHECK ("ownershipType" IN ('self_hosted','relay_managed_shared','relay_managed_dedicated','managed_runtime'))
      );
      CREATE TABLE IF NOT EXISTS "relay_operator_provisioning_jobs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "idempotencyKey" varchar NOT NULL UNIQUE, "ownershipType" varchar NOT NULL,
        "state" varchar NOT NULL DEFAULT 'authorizing_railway', "deploymentKey" varchar, "railwayProjectId" varchar,
        "serviceIds" jsonb NOT NULL DEFAULT '{}'::jsonb, "safeErrorCode" varchar, "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "completedAt" timestamptz, "cancelledAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS "relay_service_incidents" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "deploymentKey" varchar NOT NULL, "severity" varchar NOT NULL,
        "status" varchar NOT NULL, "publicSummary" varchar NOT NULL, "startedAt" timestamptz NOT NULL,
        "resolvedAt" timestamptz, "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS "IDX_relay_incidents_deployment_started" ON "relay_service_incidents" ("deploymentKey", "startedAt");
      CREATE TABLE IF NOT EXISTS "relay_owner_bootstraps" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "deploymentKey" varchar NOT NULL UNIQUE, "tokenHash" varchar NOT NULL,
        "expiresAt" timestamptz NOT NULL, "redeemedAt" timestamptz, "redeemedByUserId" uuid,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of [
      "relay_owner_bootstraps", "relay_service_incidents", "relay_operator_provisioning_jobs",
      "relay_operator_deployments", "relay_backup_records", "relay_support_access_grants",
      "relay_commercial_subscriptions",
    ]) {
      await queryRunner.query(`DROP TABLE IF EXISTS "${table}" CASCADE`);
    }
  }
}
