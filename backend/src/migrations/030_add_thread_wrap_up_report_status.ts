import { MigrationInterface, QueryRunner } from "typeorm";

export class AddThreadWrapUpReportStatus1775700000000 implements MigrationInterface {
  name = "AddThreadWrapUpReportStatus1775700000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "thread_wrap_up_reports"
      ADD COLUMN IF NOT EXISTS "status" varchar NOT NULL DEFAULT 'completed'
    `);
    await queryRunner.query(`
      ALTER TABLE "thread_wrap_up_reports"
      ADD COLUMN IF NOT EXISTS "errorMessage" text
    `);
    await queryRunner.query(`
      ALTER TABLE "thread_wrap_up_reports"
      ADD COLUMN IF NOT EXISTS "completedAt" timestamptz
    `);
    await queryRunner.query(`
      UPDATE "thread_wrap_up_reports"
      SET "completedAt" = COALESCE("completedAt", "updatedAt")
      WHERE "status" = 'completed'
    `);
    await queryRunner.query(`
      ALTER TABLE "thread_wrap_up_reports"
      ALTER COLUMN "status" SET DEFAULT 'generating'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "thread_wrap_up_reports"
      DROP COLUMN IF EXISTS "completedAt"
    `);
    await queryRunner.query(`
      ALTER TABLE "thread_wrap_up_reports"
      DROP COLUMN IF EXISTS "errorMessage"
    `);
    await queryRunner.query(`
      ALTER TABLE "thread_wrap_up_reports"
      DROP COLUMN IF EXISTS "status"
    `);
  }
}
