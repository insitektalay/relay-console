import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddBetaInvites1760000000042 implements MigrationInterface {
  name = 'AddBetaInvites1760000000042'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE beta_invites (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "codeHash" VARCHAR(128) NOT NULL UNIQUE,
        email VARCHAR(254),
        "maxUses" INTEGER NOT NULL DEFAULT 1,
        "useCount" INTEGER NOT NULL DEFAULT 0,
        "expiresAt" TIMESTAMPTZ,
        "revokedAt" TIMESTAMPTZ,
        "lastUsedAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
    await queryRunner.query(`CREATE INDEX idx_beta_invites_email ON beta_invites (email)`)
    await queryRunner.query(`CREATE INDEX idx_beta_invites_expires_at ON beta_invites ("expiresAt")`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_beta_invites_expires_at`)
    await queryRunner.query(`DROP INDEX IF EXISTS idx_beta_invites_email`)
    await queryRunner.query(`DROP TABLE beta_invites`)
  }
}
