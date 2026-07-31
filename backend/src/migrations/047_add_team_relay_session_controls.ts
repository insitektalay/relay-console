import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTeamRelaySessionControls0470000000000
  implements MigrationInterface
{
  name = "AddTeamRelaySessionControls0470000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "thread_sessions"
      ADD COLUMN IF NOT EXISTS "relayRunState" character varying NOT NULL DEFAULT 'running'
    `);
    await queryRunner.query(`
      ALTER TABLE "thread_sessions"
      ADD COLUMN IF NOT EXISTS "relayPauseReason" character varying
    `);
    await queryRunner.query(`
      ALTER TABLE "thread_sessions"
      ADD COLUMN IF NOT EXISTS "relayReplyLimit" integer NOT NULL DEFAULT 50
    `);
    await queryRunner.query(`
      ALTER TABLE "thread_sessions"
      ADD COLUMN IF NOT EXISTS "relayCatchUpCursors" jsonb NOT NULL DEFAULT '{}'::jsonb
    `);
    await queryRunner.query(`
      UPDATE "thread_sessions" session
      SET "relayReplyLimit" = GREATEST(1, LEAST(100000, thread."maxAgentTurns"))
      FROM "threads" thread
      WHERE thread."id" = session."threadId"
        AND thread."maxAgentTurns" IS NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "thread_sessions"
      ADD CONSTRAINT "CHK_thread_sessions_relay_run_state"
      CHECK ("relayRunState" IN ('running', 'paused'))
    `).catch(() => undefined);
    await queryRunner.query(`
      ALTER TABLE "thread_sessions"
      ADD CONSTRAINT "CHK_thread_sessions_relay_pause_reason"
      CHECK ("relayPauseReason" IS NULL OR "relayPauseReason" IN ('manual', 'reply_limit'))
    `).catch(() => undefined);
    await queryRunner.query(`
      ALTER TABLE "thread_sessions"
      ADD CONSTRAINT "CHK_thread_sessions_relay_reply_limit"
      CHECK ("relayReplyLimit" BETWEEN 1 AND 100000)
    `).catch(() => undefined);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "thread_sessions" DROP CONSTRAINT IF EXISTS "CHK_thread_sessions_relay_reply_limit"`,
    );
    await queryRunner.query(
      `ALTER TABLE "thread_sessions" DROP CONSTRAINT IF EXISTS "CHK_thread_sessions_relay_pause_reason"`,
    );
    await queryRunner.query(
      `ALTER TABLE "thread_sessions" DROP CONSTRAINT IF EXISTS "CHK_thread_sessions_relay_run_state"`,
    );
    await queryRunner.query(
      `ALTER TABLE "thread_sessions" DROP COLUMN IF EXISTS "relayCatchUpCursors"`,
    );
    await queryRunner.query(
      `ALTER TABLE "thread_sessions" DROP COLUMN IF EXISTS "relayReplyLimit"`,
    );
    await queryRunner.query(
      `ALTER TABLE "thread_sessions" DROP COLUMN IF EXISTS "relayPauseReason"`,
    );
    await queryRunner.query(
      `ALTER TABLE "thread_sessions" DROP COLUMN IF EXISTS "relayRunState"`,
    );
  }
}
