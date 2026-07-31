import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateThreadSessions1774800000000 implements MigrationInterface {
  name = "CreateThreadSessions1774800000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "thread_sessions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "threadId" uuid NOT NULL,
        "sequenceNumber" integer NOT NULL,
        "status" character varying NOT NULL DEFAULT 'active',
        "startedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "endedAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_thread_sessions_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_thread_sessions_threadId"
          FOREIGN KEY ("threadId") REFERENCES "threads"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_thread_sessions_thread_sequence"
      ON "thread_sessions" ("threadId", "sequenceNumber")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_thread_sessions_thread_status"
      ON "thread_sessions" ("threadId", "status")
    `);

    await queryRunner.query(`
      ALTER TABLE "threads"
      ADD COLUMN IF NOT EXISTS "activeSessionId" uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "messages"
      ADD COLUMN IF NOT EXISTS "threadSessionId" uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "thread_wrap_up_reports"
      ADD COLUMN IF NOT EXISTS "threadSessionId" uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "thread_wrap_up_reports"
      ADD COLUMN IF NOT EXISTS "threadSessionSequenceNumber" integer NOT NULL DEFAULT 1
    `);

    await queryRunner.query(`
      ALTER TABLE "thread_wrap_up_reports"
      ADD COLUMN IF NOT EXISTS "teamId" character varying
    `);

    await queryRunner.query(`
      INSERT INTO "thread_sessions" (
        "threadId",
        "sequenceNumber",
        "status",
        "startedAt",
        "endedAt",
        "createdAt",
        "updatedAt"
      )
      SELECT
        t."id",
        1,
        CASE WHEN t."status" = 'archived' THEN 'wrapped_up' ELSE 'active' END,
        COALESCE(t."createdAt", now()),
        CASE
          WHEN t."status" = 'archived'
          THEN COALESCE(
            (
              SELECT MAX(r."createdAt")
              FROM "thread_wrap_up_reports" r
              WHERE r."threadId" = t."id"
            ),
            t."updatedAt",
            now()
          )
          ELSE NULL
        END,
        COALESCE(t."createdAt", now()),
        COALESCE(t."updatedAt", now())
      FROM "threads" t
      WHERE NOT EXISTS (
        SELECT 1
        FROM "thread_sessions" s
        WHERE s."threadId" = t."id"
      )
    `);

    await queryRunner.query(`
      UPDATE "threads" t
      SET "activeSessionId" = s."id"
      FROM "thread_sessions" s
      WHERE s."threadId" = t."id"
        AND s."sequenceNumber" = 1
        AND t."activeSessionId" IS NULL
    `);

    await queryRunner.query(`
      UPDATE "messages" m
      SET "threadSessionId" = s."id"
      FROM "thread_sessions" s
      WHERE s."threadId" = m."threadId"
        AND s."sequenceNumber" = 1
        AND m."threadSessionId" IS NULL
    `);

    await queryRunner.query(`
      UPDATE "thread_wrap_up_reports" r
      SET
        "threadSessionId" = s."id",
        "threadSessionSequenceNumber" = s."sequenceNumber",
        "teamId" = t."teamId"
      FROM "thread_sessions" s,
        "threads" t
      WHERE s."threadId" = r."threadId"
        AND t."id" = r."threadId"
        AND s."sequenceNumber" = 1
        AND r."threadSessionId" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "messages"
      ALTER COLUMN "threadSessionId" SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "thread_wrap_up_reports"
      ALTER COLUMN "threadSessionId" SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "messages"
      ADD CONSTRAINT "FK_messages_threadSessionId"
      FOREIGN KEY ("threadSessionId") REFERENCES "thread_sessions"("id") ON DELETE CASCADE
    `).catch(() => undefined);

    await queryRunner.query(`
      ALTER TABLE "thread_wrap_up_reports"
      ADD CONSTRAINT "FK_thread_wrap_up_reports_threadSessionId"
      FOREIGN KEY ("threadSessionId") REFERENCES "thread_sessions"("id") ON DELETE CASCADE
    `).catch(() => undefined);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_messages_thread_session_created"
      ON "messages" ("threadId", "threadSessionId", "createdAt")
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_thread_wrap_up_reports_threadId"
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_thread_wrap_up_reports_threadSessionId"
      ON "thread_wrap_up_reports" ("threadSessionId")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_thread_wrap_up_reports_thread_created"
      ON "thread_wrap_up_reports" ("threadId", "createdAt")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_thread_wrap_up_reports_team_created"
      ON "thread_wrap_up_reports" ("teamId", "createdAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_thread_wrap_up_reports_team_created"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_thread_wrap_up_reports_thread_created"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_thread_wrap_up_reports_threadSessionId"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_thread_wrap_up_reports_threadId"
      ON "thread_wrap_up_reports" ("threadId")`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_messages_thread_session_created"`,
    );
    await queryRunner.query(
      `ALTER TABLE "thread_wrap_up_reports"
      DROP CONSTRAINT IF EXISTS "FK_thread_wrap_up_reports_threadSessionId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages"
      DROP CONSTRAINT IF EXISTS "FK_messages_threadSessionId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "thread_wrap_up_reports"
      DROP COLUMN IF EXISTS "teamId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "thread_wrap_up_reports"
      DROP COLUMN IF EXISTS "threadSessionSequenceNumber"`,
    );
    await queryRunner.query(
      `ALTER TABLE "thread_wrap_up_reports"
      DROP COLUMN IF EXISTS "threadSessionId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages"
      DROP COLUMN IF EXISTS "threadSessionId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "threads"
      DROP COLUMN IF EXISTS "activeSessionId"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_thread_sessions_thread_status"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_thread_sessions_thread_sequence"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "thread_sessions"`);
  }
}
