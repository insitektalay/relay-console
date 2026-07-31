import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMarketplace1781000000000 implements MigrationInterface {
  name = "AddMarketplace1781000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE marketplace_connections (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "workspaceId" UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        "appSlug" VARCHAR(120) NOT NULL,
        "displayName" VARCHAR(200) NOT NULL,
        environment VARCHAR(80) NOT NULL DEFAULT 'default',
        "authType" VARCHAR(48) NOT NULL DEFAULT 'api_key',
        "credentialNames" JSONB NOT NULL DEFAULT '[]'::jsonb,
        "secretCiphertext" TEXT,
        "secretIv" VARCHAR(128),
        "secretAuthTag" VARCHAR(128),
        "secretKeyVersion" VARCHAR(32),
        "selectedCapabilities" JSONB NOT NULL DEFAULT '[]'::jsonb,
        status VARCHAR(32) NOT NULL DEFAULT 'unverified',
        "lastValidatedAt" TIMESTAMPTZ,
        "lastErrorCode" VARCHAR(64),
        "lastErrorMessage" TEXT,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdByUserId" UUID NOT NULL REFERENCES users(id),
        "updatedByUserId" UUID NOT NULL REFERENCES users(id),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE marketplace_installs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "workspaceId" UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        "appSlug" VARCHAR(120) NOT NULL,
        "connectionId" UUID REFERENCES marketplace_connections(id) ON DELETE SET NULL,
        "agentId" UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
        "packId" UUID NOT NULL REFERENCES application_documentation_packs(id) ON DELETE CASCADE,
        "agentDocumentationInstallId" UUID REFERENCES agent_documentation_installs(id) ON DELETE SET NULL,
        role VARCHAR(32) NOT NULL DEFAULT 'worker',
        "selectedCapabilities" JSONB NOT NULL DEFAULT '[]'::jsonb,
        "installStatus" VARCHAR(64) NOT NULL DEFAULT 'installed',
        "driftStatus" VARCHAR(64) NOT NULL DEFAULT 'current',
        "lastInstalledAt" TIMESTAMPTZ,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(
      `CREATE INDEX idx_marketplace_connections_workspace_app ON marketplace_connections ("workspaceId", "appSlug")`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_marketplace_connections_workspace_status ON marketplace_connections ("workspaceId", status)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_marketplace_installs_workspace_app ON marketplace_installs ("workspaceId", "appSlug")`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_marketplace_installs_workspace_agent ON marketplace_installs ("workspaceId", "agentId")`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_marketplace_installs_workspace_connection ON marketplace_installs ("workspaceId", "connectionId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_marketplace_installs_workspace_connection`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_marketplace_installs_workspace_agent`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_marketplace_installs_workspace_app`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_marketplace_connections_workspace_status`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_marketplace_connections_workspace_app`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS marketplace_installs`);
    await queryRunner.query(`DROP TABLE IF EXISTS marketplace_connections`);
  }
}
