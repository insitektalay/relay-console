import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateWebSessions1774395000000 implements MigrationInterface {
  name = 'CreateWebSessions1774395000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "web_sessions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "refreshTokenHash" character varying NOT NULL,
        "revokedAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_web_sessions_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_web_sessions_user" FOREIGN KEY ("userId")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_web_sessions_user_revoked"
      ON "web_sessions" ("userId", "revokedAt")
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_web_sessions_user_revoked"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "web_sessions"`)
  }
}
