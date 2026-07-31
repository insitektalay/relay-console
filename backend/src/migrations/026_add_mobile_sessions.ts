import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddMobileSessions1775200000000 implements MigrationInterface {
  name = 'AddMobileSessions1775200000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE mobile_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "refreshTokenHash" TEXT NOT NULL,
        "deviceName" VARCHAR(200),
        platform VARCHAR(32),
        "pushToken" TEXT,
        "lastSeenAt" TIMESTAMPTZ,
        "revokedAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)

    await queryRunner.query(`
      CREATE INDEX idx_mobile_sessions_user_revoked
      ON mobile_sessions ("userId", "revokedAt")
    `)

    await queryRunner.query(`
      CREATE INDEX idx_mobile_sessions_user_active
      ON mobile_sessions ("userId")
      WHERE "revokedAt" IS NULL
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_mobile_sessions_user_active`,
    )
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_mobile_sessions_user_revoked`,
    )
    await queryRunner.query(`DROP TABLE IF EXISTS mobile_sessions`)
  }
}
