import { MigrationInterface, QueryRunner } from "typeorm";

export class MarketplaceActiveInstallUniqueness1781000000044 implements MigrationInterface {
  name = "MarketplaceActiveInstallUniqueness1781000000044";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      WITH ranked AS (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY
              "workspaceId",
              "appSlug",
              "agentId",
              "role",
              COALESCE(metadata ->> 'runtimeFormat', 'openclaw')
            ORDER BY
              CASE "installStatus"
                WHEN 'installed' THEN 0
                WHEN 'requested' THEN 1
                WHEN 'failed' THEN 2
                ELSE 3
              END,
              "updatedAt" DESC NULLS LAST,
              "createdAt" DESC NULLS LAST,
              id DESC
          ) AS row_number
        FROM "marketplace_installs"
        WHERE "installStatus" <> 'removed'
      )
      UPDATE "marketplace_installs" install
      SET
        "installStatus" = 'removed',
        "driftStatus" = 'superseded',
        metadata = COALESCE(install.metadata, '{}'::jsonb) || jsonb_build_object(
          'supersededByActiveInstallUniquenessMigration', true,
          'supersededAt', NOW()
        ),
        "updatedAt" = NOW()
      FROM ranked
      WHERE install.id = ranked.id
        AND ranked.row_number > 1
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_marketplace_installs_active_target_unique"
      ON "marketplace_installs" (
        "workspaceId",
        "appSlug",
        "agentId",
        "role",
        (COALESCE(metadata ->> 'runtimeFormat', 'openclaw'))
      )
      WHERE "installStatus" <> 'removed'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_marketplace_installs_active_target_unique"`,
    );
  }
}
