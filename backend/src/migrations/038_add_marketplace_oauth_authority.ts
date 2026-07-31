import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMarketplaceOAuthAuthority0380000000000 implements MigrationInterface {
  name = "AddMarketplaceOAuthAuthority0380000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE marketplace_oauth_states
      ADD COLUMN IF NOT EXISTS "authorityMode" varchar(48),
      ADD COLUMN IF NOT EXISTS "authorityTenantId" text,
      ADD COLUMN IF NOT EXISTS "authorityAuthorizeUrl" text,
      ADD COLUMN IF NOT EXISTS "authorityTokenUrl" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE marketplace_oauth_states
      DROP COLUMN IF EXISTS "authorityTokenUrl",
      DROP COLUMN IF EXISTS "authorityAuthorizeUrl",
      DROP COLUMN IF EXISTS "authorityTenantId",
      DROP COLUMN IF EXISTS "authorityMode"
    `);
  }
}
