import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddMaxAgentTurns1774300000000 implements MigrationInterface {
  name = 'AddMaxAgentTurns1774300000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE threads
      ADD COLUMN IF NOT EXISTS "maxAgentTurns" integer NULL
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE threads DROP COLUMN IF EXISTS "maxAgentTurns"
    `)
  }
}
