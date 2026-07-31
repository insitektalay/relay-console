import { MigrationInterface, QueryRunner } from "typeorm";

export class ReconcileTeamRelayParity0480000000000
  implements MigrationInterface
{
  name = "ReconcileTeamRelayParity0480000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "thread_sessions" DROP CONSTRAINT IF EXISTS "CHK_thread_sessions_relay_reply_limit"`,
    );
    await queryRunner.query(`
      ALTER TABLE "thread_sessions"
      ALTER COLUMN "relayReplyLimit" SET DEFAULT 50
    `);
    await queryRunner.query(`
      UPDATE "thread_sessions"
      SET "relayReplyLimit" = 50
      WHERE "relayReplyLimit" = 6
    `);
    await queryRunner.query(`
      ALTER TABLE "thread_sessions"
      ADD COLUMN IF NOT EXISTS "relayCatchUpCursors" jsonb NOT NULL DEFAULT '{}'::jsonb
    `);
    await queryRunner.query(`
      ALTER TABLE "thread_sessions"
      ADD CONSTRAINT "CHK_thread_sessions_relay_reply_limit"
      CHECK ("relayReplyLimit" BETWEEN 1 AND 100000)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "thread_sessions" DROP CONSTRAINT IF EXISTS "CHK_thread_sessions_relay_reply_limit"`,
    );
    await queryRunner.query(`
      UPDATE "thread_sessions"
      SET "relayReplyLimit" = LEAST("relayReplyLimit", 100)
    `);
    await queryRunner.query(`
      ALTER TABLE "thread_sessions"
      ALTER COLUMN "relayReplyLimit" SET DEFAULT 6
    `);
    await queryRunner.query(`
      ALTER TABLE "thread_sessions"
      ADD CONSTRAINT "CHK_thread_sessions_relay_reply_limit"
      CHECK ("relayReplyLimit" BETWEEN 1 AND 100)
    `);
    await queryRunner.query(
      `ALTER TABLE "thread_sessions" DROP COLUMN IF EXISTS "relayCatchUpCursors"`,
    );
  }
}
