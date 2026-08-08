import { MigrationInterface, QueryRunner } from "typeorm";

export class RequireRailwayMarketplaceAuthority1786110000000
  implements MigrationInterface
{
  name = "RequireRailwayMarketplaceAuthority1786110000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "marketplace_connections"
      SET
        "executionAuthority" = 'railway',
        "environment" = 'default',
        "authType" = 'api_key',
        "status" = 'needs_credentials',
        "lastValidatedAt" = NULL,
        "lastErrorCode" = 'RAILWAY_RECONNECT_REQUIRED',
        "lastErrorMessage" = 'Reconnect this Marketplace app so Railway can verify and store its credentials.',
        "metadata" = COALESCE("metadata", '{}'::jsonb) || jsonb_build_object(
          'executionAuthorityMigration',
          jsonb_build_object(
            'from', 'swift',
            'to', 'railway',
            'credentialsMigrated', false
          )
        )
      WHERE "executionAuthority" = 'swift'
    `);
    await queryRunner.query(`
      ALTER TABLE "marketplace_connections"
      DROP CONSTRAINT IF EXISTS "CHK_marketplace_connections_execution_authority"
    `);
    await queryRunner.query(`
      ALTER TABLE "marketplace_connections"
      ADD CONSTRAINT "CHK_marketplace_connections_execution_authority"
      CHECK ("executionAuthority" = 'railway')
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "marketplace_connections"
      DROP CONSTRAINT IF EXISTS "CHK_marketplace_connections_execution_authority"
    `);
    await queryRunner.query(`
      ALTER TABLE "marketplace_connections"
      ADD CONSTRAINT "CHK_marketplace_connections_execution_authority"
      CHECK ("executionAuthority" IN ('railway', 'swift'))
    `);
  }
}
