import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAgentDocumentation0290000000000 implements MigrationInterface {
  name = "AddAgentDocumentation0290000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "linked_applications" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "workspaceId" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
        "createdByUserId" uuid NULL REFERENCES "users"("id") ON DELETE SET NULL,
        "name" varchar(160) NOT NULL,
        "slug" varchar(180) NOT NULL,
        "repoPath" text NOT NULL,
        "repoKey" varchar(180) NULL,
        "frameworkMetadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "apiStyleMetadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "agentOperableStatus" varchar(64) NOT NULL DEFAULT 'unknown',
        "currentGitCommit" varchar(64) NULL,
        "dirtyState" boolean NOT NULL DEFAULT false,
        "lastScannedAt" timestamptz NULL,
        "generatedDocsPath" text NOT NULL DEFAULT '.clawchat/agent-docs',
        "documentationPackStatus" varchar(64) NOT NULL DEFAULT 'not_generated',
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_linked_applications_workspace_slug"
        ON "linked_applications" ("workspaceId", "slug")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_linked_applications_workspace_pack_status"
        ON "linked_applications" ("workspaceId", "documentationPackStatus")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "documentation_blueprints" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "workspaceId" uuid NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
        "createdByUserId" uuid NULL REFERENCES "users"("id") ON DELETE SET NULL,
        "forkedFromBlueprintId" uuid NULL REFERENCES "documentation_blueprints"("id") ON DELETE SET NULL,
        "systemKey" varchar(140) NOT NULL,
        "name" varchar(180) NOT NULL,
        "version" varchar(48) NOT NULL,
        "status" varchar(32) NOT NULL DEFAULT 'published',
        "isSystem" boolean NOT NULL DEFAULT false,
        "protected" boolean NOT NULL DEFAULT false,
        "compilerPromptVersion" varchar(80) NOT NULL,
        "content" text NOT NULL,
        "changelog" text NOT NULL DEFAULT '',
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_documentation_blueprints_workspace_key_version"
        ON "documentation_blueprints" (COALESCE("workspaceId", '00000000-0000-0000-0000-000000000000'::uuid), "systemKey", "version")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_documentation_blueprints_workspace_status"
        ON "documentation_blueprints" ("workspaceId", "status")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "application_documentation_packs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "workspaceId" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
        "linkedApplicationId" uuid NOT NULL REFERENCES "linked_applications"("id") ON DELETE CASCADE,
        "packPath" text NOT NULL DEFAULT '.clawchat/agent-docs',
        "blueprintVersionSet" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "compilerVersion" varchar(80) NOT NULL,
        "repoCommit" varchar(64) NULL,
        "repoDirtyState" boolean NOT NULL DEFAULT false,
        "packHash" varchar(128) NULL,
        "generatedFileManifest" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "reviewStatus" varchar(64) NOT NULL DEFAULT 'pending_review',
        "syncStatus" varchar(64) NOT NULL DEFAULT 'not_synced',
        "libraryTargetFolder" text NULL,
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_app_doc_packs_workspace_app" ON "application_documentation_packs" ("workspaceId", "linkedApplicationId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_app_doc_packs_workspace_sync" ON "application_documentation_packs" ("workspaceId", "syncStatus")`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "documentation_generation_proposals" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "workspaceId" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
        "linkedApplicationId" uuid NOT NULL REFERENCES "linked_applications"("id") ON DELETE CASCADE,
        "packId" uuid NULL REFERENCES "application_documentation_packs"("id") ON DELETE SET NULL,
        "mode" varchar(80) NOT NULL,
        "status" varchar(64) NOT NULL DEFAULT 'pending_review',
        "summaries" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "conflicts" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "reviewNotes" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "suggestedApplyActions" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "compilerInputMetadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "compilerOutputMetadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "createdByUserId" uuid NULL REFERENCES "users"("id") ON DELETE SET NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_doc_proposals_workspace_status" ON "documentation_generation_proposals" ("workspaceId", "status")`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "documentation_proposal_files" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "workspaceId" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
        "proposalId" uuid NOT NULL REFERENCES "documentation_generation_proposals"("id") ON DELETE CASCADE,
        "relativePath" text NOT NULL,
        "previousContent" text NULL,
        "updatedContent" text NOT NULL,
        "previousHash" varchar(128) NULL,
        "updatedHash" varchar(128) NOT NULL,
        "classification" varchar(80) NOT NULL,
        "refreshPolicy" varchar(80) NOT NULL,
        "conflictStatus" varchar(64) NOT NULL DEFAULT 'none',
        "requiresManualReview" boolean NOT NULL DEFAULT false,
        "applyStatus" varchar(64) NOT NULL DEFAULT 'pending',
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        UNIQUE ("proposalId", "relativePath")
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_doc_proposal_files_workspace_classification" ON "documentation_proposal_files" ("workspaceId", "classification")`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "documentation_sync_mappings" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "workspaceId" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
        "packId" uuid NOT NULL REFERENCES "application_documentation_packs"("id") ON DELETE CASCADE,
        "targetKind" varchar(32) NOT NULL,
        "sourcePath" text NOT NULL,
        "targetPath" text NOT NULL,
        "sourceHash" varchar(128) NULL,
        "targetHash" varchar(128) NULL,
        "status" varchar(64) NOT NULL DEFAULT 'current',
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_doc_sync_pack" ON "documentation_sync_mappings" ("workspaceId", "packId")`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "agent_documentation_installs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "workspaceId" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
        "agentId" uuid NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
        "packId" uuid NOT NULL REFERENCES "application_documentation_packs"("id") ON DELETE CASCADE,
        "role" varchar(32) NOT NULL,
        "installedBlueprintVersions" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "workspaceFileManifest" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "localOverrides" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "installStatus" varchar(64) NOT NULL DEFAULT 'not_installed',
        "driftStatus" varchar(64) NOT NULL DEFAULT 'unknown',
        "lastInstalledAt" timestamptz NULL,
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        UNIQUE ("workspaceId", "agentId", "packId")
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_agent_doc_installs_workspace_drift" ON "agent_documentation_installs" ("workspaceId", "driftStatus")`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "agent_documentation_state_snapshots" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "workspaceId" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
        "packId" uuid NULL REFERENCES "application_documentation_packs"("id") ON DELETE SET NULL,
        "agentId" uuid NULL REFERENCES "agents"("id") ON DELETE SET NULL,
        "snapshotKind" varchar(80) NOT NULL,
        "state" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "exportedLibraryPath" text NULL,
        "exportStatus" varchar(64) NOT NULL DEFAULT 'not_exported',
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "agent_documentation_state_snapshots"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "agent_documentation_installs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "documentation_sync_mappings"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "documentation_proposal_files"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "documentation_generation_proposals"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "application_documentation_packs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "documentation_blueprints"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "linked_applications"`);
  }
}
