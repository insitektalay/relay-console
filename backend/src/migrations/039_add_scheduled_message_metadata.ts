import { MigrationInterface, QueryRunner } from "typeorm";

export class AddScheduledMessageMetadata0390000000000 implements MigrationInterface {
  name = "AddScheduledMessageMetadata0390000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "scheduled_thread_messages"
      ADD COLUMN IF NOT EXISTS "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "scheduled_thread_messages"
      DROP COLUMN IF EXISTS "metadata"
    `);
  }
}
