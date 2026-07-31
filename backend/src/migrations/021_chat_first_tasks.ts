import { MigrationInterface, QueryRunner } from "typeorm";

export class ChatFirstTasks1774900000000 implements MigrationInterface {
  name = "ChatFirstTasks1774900000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tasks"
      ADD COLUMN IF NOT EXISTS "departmentId" character varying
    `);

    await queryRunner.query(`
      ALTER TABLE "tasks"
      ADD COLUMN IF NOT EXISTS "targetType" character varying NOT NULL DEFAULT 'direct'
    `);

    await queryRunner.query(`
      ALTER TABLE "tasks"
      ADD COLUMN IF NOT EXISTS "threadId" uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "tasks"
      ADD COLUMN IF NOT EXISTS "targetAgentId" uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "tasks"
      ADD COLUMN IF NOT EXISTS "targetAgentTwoId" uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "tasks"
      ADD COLUMN IF NOT EXISTS "scheduledFor" TIMESTAMPTZ
    `);

    await queryRunner.query(`
      ALTER TABLE "tasks"
      ADD COLUMN IF NOT EXISTS "nextRunAt" TIMESTAMPTZ
    `);

    await queryRunner.query(`
      ALTER TABLE "tasks"
      ADD COLUMN IF NOT EXISTS "timezone" character varying NOT NULL DEFAULT 'UTC'
    `);

    await queryRunner.query(`
      ALTER TABLE "tasks"
      ADD COLUMN IF NOT EXISTS "recurrenceRule" character varying
    `);

    await queryRunner.query(`
      ALTER TABLE "tasks"
      ADD COLUMN IF NOT EXISTS "messageBody" text
    `);

    await queryRunner.query(`
      ALTER TABLE "tasks"
      ADD COLUMN IF NOT EXISTS "scheduledMessageId" uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "tasks"
      ADD COLUMN IF NOT EXISTS "dispatchedMessageId" uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "tasks"
      ADD COLUMN IF NOT EXISTS "lastDispatchedAt" TIMESTAMPTZ
    `);

    await queryRunner.query(`
      ALTER TABLE "tasks"
      ADD COLUMN IF NOT EXISTS "lastError" text
    `);

    await queryRunner.query(`
      ALTER TABLE "tasks"
      ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMPTZ
    `);

    await queryRunner.query(`
      UPDATE "tasks"
      SET
        "targetType" = CASE
          WHEN "teamId" IS NOT NULL THEN 'team'
          WHEN "assignedAgentId" IS NOT NULL THEN 'direct'
          ELSE 'direct'
        END,
        "targetAgentId" = COALESCE("targetAgentId", "assignedAgentId"),
        "scheduledFor" = COALESCE("scheduledFor", "dueAt"),
        "nextRunAt" = COALESCE("nextRunAt", "dueAt"),
        "messageBody" = COALESCE(NULLIF("messageBody", ''), "description", "title")
    `);

    await queryRunner.query(`
      ALTER TABLE "scheduled_thread_messages"
      ADD COLUMN IF NOT EXISTS "taskId" uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "scheduled_thread_messages"
      ADD COLUMN IF NOT EXISTS "recurrenceRule" character varying
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_tasks_threadId"
      ON "tasks" ("threadId")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_tasks_targetType"
      ON "tasks" ("targetType")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_tasks_nextRunAt"
      ON "tasks" ("nextRunAt")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_scheduled_thread_messages_taskId"
      ON "scheduled_thread_messages" ("taskId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_scheduled_thread_messages_taskId"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tasks_nextRunAt"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tasks_targetType"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tasks_threadId"`);

    await queryRunner.query(`
      ALTER TABLE "scheduled_thread_messages"
      DROP COLUMN IF EXISTS "recurrenceRule"
    `);

    await queryRunner.query(`
      ALTER TABLE "scheduled_thread_messages"
      DROP COLUMN IF EXISTS "taskId"
    `);

    await queryRunner.query(`
      ALTER TABLE "tasks"
      DROP COLUMN IF EXISTS "cancelledAt"
    `);

    await queryRunner.query(`
      ALTER TABLE "tasks"
      DROP COLUMN IF EXISTS "lastError"
    `);

    await queryRunner.query(`
      ALTER TABLE "tasks"
      DROP COLUMN IF EXISTS "lastDispatchedAt"
    `);

    await queryRunner.query(`
      ALTER TABLE "tasks"
      DROP COLUMN IF EXISTS "dispatchedMessageId"
    `);

    await queryRunner.query(`
      ALTER TABLE "tasks"
      DROP COLUMN IF EXISTS "scheduledMessageId"
    `);

    await queryRunner.query(`
      ALTER TABLE "tasks"
      DROP COLUMN IF EXISTS "messageBody"
    `);

    await queryRunner.query(`
      ALTER TABLE "tasks"
      DROP COLUMN IF EXISTS "recurrenceRule"
    `);

    await queryRunner.query(`
      ALTER TABLE "tasks"
      DROP COLUMN IF EXISTS "timezone"
    `);

    await queryRunner.query(`
      ALTER TABLE "tasks"
      DROP COLUMN IF EXISTS "nextRunAt"
    `);

    await queryRunner.query(`
      ALTER TABLE "tasks"
      DROP COLUMN IF EXISTS "scheduledFor"
    `);

    await queryRunner.query(`
      ALTER TABLE "tasks"
      DROP COLUMN IF EXISTS "targetAgentTwoId"
    `);

    await queryRunner.query(`
      ALTER TABLE "tasks"
      DROP COLUMN IF EXISTS "targetAgentId"
    `);

    await queryRunner.query(`
      ALTER TABLE "tasks"
      DROP COLUMN IF EXISTS "threadId"
    `);

    await queryRunner.query(`
      ALTER TABLE "tasks"
      DROP COLUMN IF EXISTS "targetType"
    `);

    await queryRunner.query(`
      ALTER TABLE "tasks"
      DROP COLUMN IF EXISTS "departmentId"
    `);
  }
}
