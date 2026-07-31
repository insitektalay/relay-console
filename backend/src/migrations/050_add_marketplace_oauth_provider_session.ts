import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMarketplaceOAuthProviderSession0500000000000
  implements MigrationInterface
{
  name = "AddMarketplaceOAuthProviderSession0500000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE marketplace_oauth_states
        ADD COLUMN IF NOT EXISTS "providerSessionCiphertext" TEXT,
        ADD COLUMN IF NOT EXISTS "providerSessionIv" VARCHAR(128),
        ADD COLUMN IF NOT EXISTS "providerSessionAuthTag" VARCHAR(128),
        ADD COLUMN IF NOT EXISTS "providerSessionKeyVersion" VARCHAR(32)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE marketplace_oauth_states
        DROP COLUMN IF EXISTS "providerSessionKeyVersion",
        DROP COLUMN IF EXISTS "providerSessionAuthTag",
        DROP COLUMN IF EXISTS "providerSessionIv",
        DROP COLUMN IF EXISTS "providerSessionCiphertext"
    `);
  }
}
