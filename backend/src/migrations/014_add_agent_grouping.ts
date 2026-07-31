import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddAgentGrouping1774395600000 implements MigrationInterface {
  name = 'AddAgentGrouping1774395600000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "agents"
      ADD COLUMN IF NOT EXISTS "groupType" character varying
    `)
    await queryRunner.query(`
      ALTER TABLE "agents"
      ADD COLUMN IF NOT EXISTS "groupLabel" character varying
    `)
    await queryRunner.query(`
      UPDATE "agents"
      SET "groupType" = CASE
        WHEN "companyId" IS NOT NULL OR "departmentId" IS NOT NULL OR "teamId" IS NOT NULL THEN 'business'
        ELSE 'personal'
      END
      WHERE "groupType" IS NULL
    `)
    await queryRunner.query(`
      ALTER TABLE "agents"
      ALTER COLUMN "groupType" SET DEFAULT 'personal'
    `)
    await queryRunner.query(`
      ALTER TABLE "agents"
      ALTER COLUMN "groupType" SET NOT NULL
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "agents"
      DROP COLUMN IF EXISTS "groupLabel"
    `)
    await queryRunner.query(`
      ALTER TABLE "agents"
      DROP COLUMN IF EXISTS "groupType"
    `)
  }
}
