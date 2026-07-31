import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddWaitlistEntries1760000000041 implements MigrationInterface {
  name = 'AddWaitlistEntries1760000000041'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE waitlist_entries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(254) NOT NULL UNIQUE,
        source VARCHAR(80),
        origin TEXT,
        "userAgent" TEXT,
        "ipAddress" VARCHAR(80),
        "submissionCount" INTEGER NOT NULL DEFAULT 1,
        "lastSubmittedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
    await queryRunner.query(`CREATE INDEX idx_waitlist_entries_email ON waitlist_entries (email)`)
    await queryRunner.query(
      `CREATE INDEX idx_waitlist_entries_last_submitted_at ON waitlist_entries ("lastSubmittedAt")`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_waitlist_entries_last_submitted_at`)
    await queryRunner.query(`DROP INDEX IF EXISTS idx_waitlist_entries_email`)
    await queryRunner.query(`DROP TABLE waitlist_entries`)
  }
}
