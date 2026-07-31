import { MigrationInterface, QueryRunner } from "typeorm";

export class AddXMarketplaceOAuth0360000000000 implements MigrationInterface {
  name = "AddXMarketplaceOAuth0360000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE marketplace_oauth_states (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "workspaceId" UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "appSlug" VARCHAR(120) NOT NULL,
        "stateHash" VARCHAR(128) NOT NULL,
        "codeVerifier" TEXT NOT NULL,
        "clientId" TEXT NOT NULL,
        "clientSecretCiphertext" TEXT,
        "clientSecretIv" VARCHAR(128),
        "clientSecretAuthTag" VARCHAR(128),
        "clientSecretKeyVersion" VARCHAR(32),
        scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
        "selectedCapabilities" JSONB NOT NULL DEFAULT '[]'::jsonb,
        "displayName" VARCHAR(200) NOT NULL,
        environment VARCHAR(80) NOT NULL DEFAULT 'default',
        "redirectUri" TEXT NOT NULL,
        "returnTo" TEXT,
        "expiresAt" TIMESTAMPTZ NOT NULL,
        "consumedAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX idx_marketplace_oauth_states_state_hash ON marketplace_oauth_states ("stateHash")`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_marketplace_oauth_states_workspace_app ON marketplace_oauth_states ("workspaceId", "appSlug")`,
    );
    await queryRunner.query(`
      ALTER TABLE approvals
      ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE approvals DROP COLUMN IF EXISTS metadata`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_marketplace_oauth_states_workspace_app`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_marketplace_oauth_states_state_hash`);
    await queryRunner.query(`DROP TABLE IF EXISTS marketplace_oauth_states`);
  }
}
