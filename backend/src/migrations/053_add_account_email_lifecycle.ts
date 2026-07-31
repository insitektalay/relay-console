import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddAccountEmailLifecycle0530000000000 implements MigrationInterface {
  name = 'AddAccountEmailLifecycle0530000000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "emailVerifiedAt" timestamptz;

      UPDATE "users"
      SET "emailVerifiedAt" = COALESCE("createdAt", now())
      WHERE "emailVerifiedAt" IS NULL;

      CREATE TABLE IF NOT EXISTS "account_action_tokens" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "purpose" varchar NOT NULL,
        "tokenHash" varchar(64) NOT NULL,
        "expiresAt" timestamptz NOT NULL,
        "usedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_account_action_token_hash" UNIQUE ("tokenHash"),
        CONSTRAINT "CHK_account_action_token_purpose"
          CHECK ("purpose" IN ('email_verification', 'password_reset'))
      );
      CREATE INDEX IF NOT EXISTS "IDX_account_action_token_user_purpose"
        ON "account_action_tokens" ("userId", "purpose", "usedAt");
      CREATE INDEX IF NOT EXISTS "IDX_account_action_token_expiry"
        ON "account_action_tokens" ("expiresAt");
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS "account_action_tokens";
      ALTER TABLE "users" DROP COLUMN IF EXISTS "emailVerifiedAt";
    `)
  }
}
