import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateThreadWrapUpReports1774700000000 implements MigrationInterface {
  name = "CreateThreadWrapUpReports1774700000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "thread_wrap_up_reports" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "threadId" uuid NOT NULL,
        "workspaceId" character varying NOT NULL,
        "title" character varying NOT NULL,
        "fileName" character varying NOT NULL,
        "provider" character varying NOT NULL DEFAULT 'openrouter',
        "model" character varying NOT NULL,
        "markdown" text NOT NULL,
        "structuredData" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "messageCount" integer NOT NULL DEFAULT 0,
        "createdByUserId" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_thread_wrap_up_reports_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_thread_wrap_up_reports_threadId"
          FOREIGN KEY ("threadId") REFERENCES "threads"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_thread_wrap_up_reports_threadId"
      ON "thread_wrap_up_reports" ("threadId")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_thread_wrap_up_reports_workspace_created"
      ON "thread_wrap_up_reports" ("workspaceId", "createdAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_thread_wrap_up_reports_workspace_created"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_thread_wrap_up_reports_threadId"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "thread_wrap_up_reports"`);
  }
}
