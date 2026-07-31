import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBetaInviteRedemptionAudit0460000000000 implements MigrationInterface {
  name = "AddBetaInviteRedemptionAudit0460000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE beta_invites
        ADD COLUMN IF NOT EXISTS "lastUsedByUserId" UUID,
        ADD COLUMN IF NOT EXISTS "lastUsedEmail" VARCHAR(254)
    `);
    await queryRunner.query(`
      ALTER TABLE beta_invites
        ADD CONSTRAINT fk_beta_invites_last_used_by_user
        FOREIGN KEY ("lastUsedByUserId")
        REFERENCES users(id)
        ON DELETE SET NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_beta_invites_last_used_by_user
      ON beta_invites ("lastUsedByUserId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_beta_invites_last_used_by_user`);
    await queryRunner.query(`
      ALTER TABLE beta_invites
        DROP CONSTRAINT IF EXISTS fk_beta_invites_last_used_by_user,
        DROP COLUMN IF EXISTS "lastUsedEmail",
        DROP COLUMN IF EXISTS "lastUsedByUserId"
    `);
  }
}
