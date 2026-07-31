import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDocumentationVersionHistory0380000000000
  implements MigrationInterface
{
  name = "AddDocumentationVersionHistory0380000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS application_documentation_versions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "workspaceId" UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        "appSlug" VARCHAR(120) NOT NULL,
        "linkedApplicationId" UUID REFERENCES linked_applications(id) ON DELETE SET NULL,
        "generatedPackId" UUID REFERENCES marketplace_generated_packs(id) ON DELETE SET NULL,
        version INTEGER NOT NULL,
        "sourceHash" VARCHAR(128),
        "packHash" VARCHAR(128),
        "sourceFiles" JSONB NOT NULL DEFAULT '[]'::jsonb,
        "generatedFiles" JSONB NOT NULL DEFAULT '[]'::jsonb,
        "sourceDiff" JSONB NOT NULL DEFAULT '{}'::jsonb,
        status VARCHAR(64) NOT NULL DEFAULT 'generated',
        trigger VARCHAR(64) NOT NULL DEFAULT 'manual',
        "createdByUserId" UUID REFERENCES users(id) ON DELETE SET NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_application_documentation_versions_sequence UNIQUE ("workspaceId", "appSlug", version)
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS agent_documentation_versions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "workspaceId" UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        "appSlug" VARCHAR(120) NOT NULL,
        "agentId" UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
        role VARCHAR(32) NOT NULL,
        "marketplaceInstallId" UUID REFERENCES marketplace_installs(id) ON DELETE SET NULL,
        "agentDocumentationInstallId" UUID REFERENCES agent_documentation_installs(id) ON DELETE SET NULL,
        "applicationDocumentationVersionId" UUID REFERENCES application_documentation_versions(id) ON DELETE SET NULL,
        "packId" UUID REFERENCES application_documentation_packs(id) ON DELETE SET NULL,
        version INTEGER NOT NULL,
        status VARCHAR(64) NOT NULL DEFAULT 'installed',
        "workspaceFileManifest" JSONB NOT NULL DEFAULT '[]'::jsonb,
        "fileChanges" JSONB NOT NULL DEFAULT '{}'::jsonb,
        trigger VARCHAR(64) NOT NULL DEFAULT 'manual',
        "installedByUserId" UUID REFERENCES users(id) ON DELETE SET NULL,
        "installedAt" TIMESTAMPTZ,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_agent_documentation_versions_sequence UNIQUE ("workspaceId", "appSlug", "agentId", role, version)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_application_doc_versions_workspace_app_created ON application_documentation_versions ("workspaceId", "appSlug", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_application_doc_versions_generated_pack ON application_documentation_versions ("workspaceId", "generatedPackId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_agent_doc_versions_workspace_app_created ON agent_documentation_versions ("workspaceId", "appSlug", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_agent_doc_versions_workspace_agent_created ON agent_documentation_versions ("workspaceId", "agentId", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_agent_doc_versions_app_version ON agent_documentation_versions ("workspaceId", "applicationDocumentationVersionId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_agent_doc_versions_app_version`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_agent_doc_versions_workspace_agent_created`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_agent_doc_versions_workspace_app_created`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_application_doc_versions_generated_pack`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_application_doc_versions_workspace_app_created`);
    await queryRunner.query(`DROP TABLE IF EXISTS agent_documentation_versions`);
    await queryRunner.query(`DROP TABLE IF EXISTS application_documentation_versions`);
  }
}
