import { MigrationInterface, QueryRunner } from "typeorm";

export class SwitchThreadWrapUpsToClaudeCli1775600000000 implements MigrationInterface {
  name = "SwitchThreadWrapUpsToClaudeCli1775600000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "thread_wrap_up_reports"
      ALTER COLUMN "provider" SET DEFAULT 'claude_code_cli'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "thread_wrap_up_reports"
      ALTER COLUMN "provider" SET DEFAULT 'openrouter'
    `);
  }
}
