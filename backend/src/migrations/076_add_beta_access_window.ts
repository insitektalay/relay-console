import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBetaAccessWindow1785270600076 implements MigrationInterface {
  name = "AddBetaAccessWindow1785270600076";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN "betaAccessEndsAt" timestamptz
    `);
    await queryRunner.query(`
      UPDATE "users" AS "user"
      SET "betaAccessEndsAt" = "invite"."lastUsedAt" + INTERVAL '60 days'
      FROM "beta_invites" AS "invite"
      WHERE "invite"."lastUsedByUserId" = "user"."id"
        AND "invite"."lastUsedAt" IS NOT NULL
        AND (
          "user"."betaAccessEndsAt" IS NULL
          OR "user"."betaAccessEndsAt" < "invite"."lastUsedAt" + INTERVAL '60 days'
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "betaAccessEndsAt"
    `);
  }
}
