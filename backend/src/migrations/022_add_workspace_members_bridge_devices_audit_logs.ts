import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddWorkspaceMembersBridgeDevicesAuditLogs1775070000000
  implements MigrationInterface
{
  name = 'AddWorkspaceMembersBridgeDevicesAuditLogs1775070000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE workspace_members_role_enum AS ENUM ('owner', 'admin', 'member', 'viewer')
    `)
    await queryRunner.query(`
      CREATE TABLE workspace_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "workspaceId" UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role workspace_members_role_enum NOT NULL DEFAULT 'member',
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE ("workspaceId", "userId")
      )
    `)
    await queryRunner.query(`
      INSERT INTO workspace_members ("workspaceId", "userId", role, "createdAt", "updatedAt")
      SELECT id, "ownerId", 'owner', NOW(), NOW()
      FROM workspaces
      WHERE "ownerId" IS NOT NULL
      ON CONFLICT ("workspaceId", "userId") DO NOTHING
    `)

    await queryRunner.query(`
      CREATE TYPE bridge_devices_status_enum AS ENUM ('pending', 'active', 'revoked')
    `)
    await queryRunner.query(`
      CREATE TABLE bridge_devices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "workspaceId" UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        "createdByUserId" UUID REFERENCES users(id) ON DELETE SET NULL,
        label VARCHAR NOT NULL,
        "devicePublicId" VARCHAR NOT NULL UNIQUE,
        "credentialHash" VARCHAR NOT NULL,
        status bridge_devices_status_enum NOT NULL DEFAULT 'active',
        capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
        "openCoreVersion" VARCHAR,
        "pluginVersion" VARCHAR,
        "lastSeenAt" TIMESTAMPTZ,
        "revokedAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)

    await queryRunner.query(`
      CREATE TYPE bridge_enrollments_status_enum AS ENUM ('active', 'used', 'expired', 'revoked')
    `)
    await queryRunner.query(`
      CREATE TABLE bridge_enrollments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "workspaceId" UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        "createdByUserId" UUID REFERENCES users(id) ON DELETE SET NULL,
        "codeHash" VARCHAR NOT NULL,
        "deviceLabel" VARCHAR,
        status bridge_enrollments_status_enum NOT NULL DEFAULT 'active',
        "expiresAt" TIMESTAMPTZ NOT NULL,
        "usedAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)

    await queryRunner.query(`
      CREATE TABLE audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "actorType" VARCHAR NOT NULL,
        "actorId" VARCHAR,
        "workspaceId" UUID,
        "eventType" VARCHAR NOT NULL,
        "resourceType" VARCHAR,
        "resourceId" VARCHAR,
        "ipAddress" VARCHAR,
        "userAgent" VARCHAR,
        metadata JSONB,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)

    await queryRunner.query(`
      ALTER TABLE openclaw_connections
      ADD COLUMN "apiKeyCiphertext" VARCHAR,
      ADD COLUMN "apiKeyIv" VARCHAR,
      ADD COLUMN "apiKeyAuthTag" VARCHAR,
      ADD COLUMN "apiKeyKeyVersion" VARCHAR
    `)
    await queryRunner.query(`
      ALTER TABLE openclaw_connections DROP COLUMN "apiKey"
    `)

    await queryRunner.query(`
      ALTER TABLE web_sessions
      ADD COLUMN "ipAddress" VARCHAR,
      ADD COLUMN "userAgent" VARCHAR,
      ADD COLUMN "lastSeenAt" TIMESTAMPTZ
    `)

    await queryRunner.query(`
      CREATE INDEX idx_workspace_members_user ON workspace_members ("userId")
    `)
    await queryRunner.query(`
      CREATE INDEX idx_bridge_devices_workspace ON bridge_devices ("workspaceId")
    `)
    await queryRunner.query(`
      CREATE INDEX idx_bridge_enrollments_workspace_status
      ON bridge_enrollments ("workspaceId", status, "expiresAt")
    `)
    await queryRunner.query(`
      CREATE INDEX idx_audit_logs_workspace_created
      ON audit_logs ("workspaceId", "createdAt")
    `)
    await queryRunner.query(`
      CREATE INDEX idx_audit_logs_event_created
      ON audit_logs ("eventType", "createdAt")
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_audit_logs_event_created`)
    await queryRunner.query(`DROP INDEX IF EXISTS idx_audit_logs_workspace_created`)
    await queryRunner.query(`DROP INDEX IF EXISTS idx_bridge_enrollments_workspace_status`)
    await queryRunner.query(`DROP INDEX IF EXISTS idx_bridge_devices_workspace`)
    await queryRunner.query(`DROP INDEX IF EXISTS idx_workspace_members_user`)

    await queryRunner.query(`
      ALTER TABLE web_sessions
      DROP COLUMN IF EXISTS "lastSeenAt",
      DROP COLUMN IF EXISTS "userAgent",
      DROP COLUMN IF EXISTS "ipAddress"
    `)

    await queryRunner.query(`
      ALTER TABLE openclaw_connections
      ADD COLUMN "apiKey" VARCHAR,
      DROP COLUMN IF EXISTS "apiKeyKeyVersion",
      DROP COLUMN IF EXISTS "apiKeyAuthTag",
      DROP COLUMN IF EXISTS "apiKeyIv",
      DROP COLUMN IF EXISTS "apiKeyCiphertext"
    `)

    await queryRunner.query(`DROP TABLE IF EXISTS audit_logs`)
    await queryRunner.query(`DROP TABLE IF EXISTS bridge_enrollments`)
    await queryRunner.query(`DROP TABLE IF EXISTS bridge_devices`)
    await queryRunner.query(`DROP TABLE IF EXISTS workspace_members`)

    await queryRunner.query(`DROP TYPE IF EXISTS bridge_enrollments_status_enum`)
    await queryRunner.query(`DROP TYPE IF EXISTS bridge_devices_status_enum`)
    await queryRunner.query(`DROP TYPE IF EXISTS workspace_members_role_enum`)
  }
}
