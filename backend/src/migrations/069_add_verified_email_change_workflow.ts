import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddVerifiedEmailChangeWorkflow1785182600069
  implements MigrationInterface
{
  name = 'AddVerifiedEmailChangeWorkflow1785182600069'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "email_change_requests" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "currentEmail" varchar(254) NOT NULL,
        "newEmail" varchar(254) NOT NULL,
        "tokenHash" varchar(64) NOT NULL,
        "expiresAt" timestamptz NOT NULL,
        "completedAt" timestamptz,
        "cancelledAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_email_change_token_hash" UNIQUE ("tokenHash"),
        CONSTRAINT "CHK_email_change_normalized_distinct"
          CHECK (
            "currentEmail" = lower("currentEmail")
            AND "newEmail" = lower("newEmail")
            AND "currentEmail" <> "newEmail"
          )
      )
    `)
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_email_change_active_user"
      ON "email_change_requests" ("userId")
      WHERE "completedAt" IS NULL AND "cancelledAt" IS NULL
    `)
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_email_change_active_new_email"
      ON "email_change_requests" ("newEmail")
      WHERE "completedAt" IS NULL AND "cancelledAt" IS NULL
    `)
    await queryRunner.query(`
      CREATE INDEX "IDX_email_change_expiry"
      ON "email_change_requests" ("expiresAt")
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "email_change_requests"')
  }
}
