import { MigrationInterface, QueryRunner } from "typeorm";

export class RoleAwareMarketplaceInstalls0350000000000 implements MigrationInterface {
  name = "RoleAwareMarketplaceInstalls0350000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "agent_documentation_installs"
      DROP CONSTRAINT IF EXISTS "agent_documentation_installs_workspaceId_agentId_packId_key"
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_agent_doc_installs_workspace_agent_pack_role"
      ON "agent_documentation_installs" ("workspaceId", "agentId", "packId", "role")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_marketplace_installs_workspace_app_role"
      ON "marketplace_installs" ("workspaceId", "appSlug", "role")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_marketplace_installs_workspace_app_role"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_agent_doc_installs_workspace_agent_pack_role"`);
    await queryRunner.query(`
      ALTER TABLE "agent_documentation_installs"
      ADD CONSTRAINT "agent_documentation_installs_workspaceId_agentId_packId_key"
      UNIQUE ("workspaceId", "agentId", "packId")
    `);
  }
}
