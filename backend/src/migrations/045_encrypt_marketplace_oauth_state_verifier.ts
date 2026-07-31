import { MigrationInterface, QueryRunner } from "typeorm";

export class EncryptMarketplaceOAuthStateVerifier0450000000000 implements MigrationInterface {
  name = "EncryptMarketplaceOAuthStateVerifier0450000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE marketplace_oauth_states
        ADD COLUMN IF NOT EXISTS "codeVerifierCiphertext" TEXT,
        ADD COLUMN IF NOT EXISTS "codeVerifierIv" VARCHAR(128),
        ADD COLUMN IF NOT EXISTS "codeVerifierAuthTag" VARCHAR(128),
        ADD COLUMN IF NOT EXISTS "codeVerifierKeyVersion" VARCHAR(32)
    `);
    await queryRunner.query(`
      ALTER TABLE marketplace_oauth_states
        ALTER COLUMN "codeVerifier" DROP NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_marketplace_oauth_states_expires_at
      ON marketplace_oauth_states ("expiresAt")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_marketplace_oauth_states_consumed_at
      ON marketplace_oauth_states ("consumedAt")
      WHERE "consumedAt" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_marketplace_oauth_states_consumed_at`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_marketplace_oauth_states_expires_at`);
    await queryRunner.query(`
      UPDATE marketplace_oauth_states
      SET "codeVerifier" = ''
      WHERE "codeVerifier" IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE marketplace_oauth_states
        ALTER COLUMN "codeVerifier" SET NOT NULL,
        DROP COLUMN IF EXISTS "codeVerifierKeyVersion",
        DROP COLUMN IF EXISTS "codeVerifierAuthTag",
        DROP COLUMN IF EXISTS "codeVerifierIv",
        DROP COLUMN IF EXISTS "codeVerifierCiphertext"
    `);
  }
}
