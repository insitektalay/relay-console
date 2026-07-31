import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMarketplacePackFactoryReview0330000000000
  implements MigrationInterface
{
  name = "AddMarketplacePackFactoryReview0330000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE marketplace_pack_generation_jobs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "workspaceId" UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        "appSlug" VARCHAR(120) NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'queued',
        "inputConfig" JSONB NOT NULL DEFAULT '{}'::jsonb,
        "resultSummary" JSONB NOT NULL DEFAULT '{}'::jsonb,
        "errorMessage" TEXT,
        "startedByUserId" UUID REFERENCES users(id) ON DELETE SET NULL,
        "startedAt" TIMESTAMPTZ,
        "completedAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE marketplace_generated_packs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "workspaceId" UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        "appSlug" VARCHAR(120) NOT NULL,
        name VARCHAR(200) NOT NULL,
        category VARCHAR(80) NOT NULL,
        "riskLevel" VARCHAR(32) NOT NULL,
        "qualityLevel" VARCHAR(32) NOT NULL DEFAULT 'generated_draft',
        "publicationStatus" VARCHAR(32) NOT NULL DEFAULT 'review_needed',
        "reviewStatus" VARCHAR(32) NOT NULL DEFAULT 'not_reviewed',
        confidence VARCHAR(16) NOT NULL DEFAULT 'low',
        "qualityScore" INTEGER NOT NULL DEFAULT 0,
        "missingSections" JSONB NOT NULL DEFAULT '[]'::jsonb,
        warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
        "officialDocsCoverage" JSONB NOT NULL DEFAULT '{}'::jsonb,
        "highRiskActionsDetected" BOOLEAN NOT NULL DEFAULT FALSE,
        "sourceUrls" JSONB NOT NULL DEFAULT '[]'::jsonb,
        "generatedPack" JSONB NOT NULL DEFAULT '{}'::jsonb,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        "generatedAt" TIMESTAMPTZ NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_marketplace_generated_packs_workspace_app UNIQUE ("workspaceId", "appSlug")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE marketplace_pack_sources (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "workspaceId" UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        "appSlug" VARCHAR(120) NOT NULL,
        "generatedPackId" UUID NOT NULL REFERENCES marketplace_generated_packs(id) ON DELETE CASCADE,
        kind VARCHAR(48) NOT NULL,
        url TEXT,
        "filePath" TEXT,
        title TEXT,
        notes TEXT,
        official BOOLEAN NOT NULL DEFAULT FALSE,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE marketplace_pack_quality_scores (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "workspaceId" UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        "appSlug" VARCHAR(120) NOT NULL,
        "generatedPackId" UUID NOT NULL REFERENCES marketplace_generated_packs(id) ON DELETE CASCADE,
        score INTEGER NOT NULL,
        confidence VARCHAR(16) NOT NULL,
        "missingSections" JSONB NOT NULL DEFAULT '[]'::jsonb,
        warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
        "officialDocsCoverage" JSONB NOT NULL DEFAULT '{}'::jsonb,
        "highRiskActionsDetected" BOOLEAN NOT NULL DEFAULT FALSE,
        "reviewStatus" VARCHAR(32) NOT NULL DEFAULT 'not_reviewed',
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE marketplace_pack_reviews (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "workspaceId" UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        "appSlug" VARCHAR(120) NOT NULL,
        "generatedPackId" UUID NOT NULL REFERENCES marketplace_generated_packs(id) ON DELETE CASCADE,
        action VARCHAR(48) NOT NULL,
        notes TEXT,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        "reviewerUserId" UUID NOT NULL REFERENCES users(id),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(
      `CREATE INDEX idx_marketplace_pack_generation_jobs_workspace_app ON marketplace_pack_generation_jobs ("workspaceId", "appSlug")`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_marketplace_pack_generation_jobs_workspace_status ON marketplace_pack_generation_jobs ("workspaceId", status)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_marketplace_generated_packs_workspace_quality ON marketplace_generated_packs ("workspaceId", "qualityLevel")`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_marketplace_generated_packs_workspace_publication ON marketplace_generated_packs ("workspaceId", "publicationStatus")`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_marketplace_generated_packs_workspace_review ON marketplace_generated_packs ("workspaceId", "reviewStatus")`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_marketplace_pack_sources_workspace_app ON marketplace_pack_sources ("workspaceId", "appSlug")`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_marketplace_pack_sources_pack ON marketplace_pack_sources ("generatedPackId")`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_marketplace_pack_quality_scores_workspace_app ON marketplace_pack_quality_scores ("workspaceId", "appSlug")`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_marketplace_pack_quality_scores_pack ON marketplace_pack_quality_scores ("generatedPackId")`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_marketplace_pack_reviews_workspace_app ON marketplace_pack_reviews ("workspaceId", "appSlug")`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_marketplace_pack_reviews_pack ON marketplace_pack_reviews ("generatedPackId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_marketplace_pack_reviews_pack`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_marketplace_pack_reviews_workspace_app`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_marketplace_pack_quality_scores_pack`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_marketplace_pack_quality_scores_workspace_app`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_marketplace_pack_sources_pack`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_marketplace_pack_sources_workspace_app`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_marketplace_generated_packs_workspace_review`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_marketplace_generated_packs_workspace_publication`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_marketplace_generated_packs_workspace_quality`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_marketplace_pack_generation_jobs_workspace_status`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_marketplace_pack_generation_jobs_workspace_app`);
    await queryRunner.query(`DROP TABLE IF EXISTS marketplace_pack_reviews`);
    await queryRunner.query(`DROP TABLE IF EXISTS marketplace_pack_quality_scores`);
    await queryRunner.query(`DROP TABLE IF EXISTS marketplace_pack_sources`);
    await queryRunner.query(`DROP TABLE IF EXISTS marketplace_generated_packs`);
    await queryRunner.query(`DROP TABLE IF EXISTS marketplace_pack_generation_jobs`);
  }
}
