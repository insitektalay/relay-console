import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddWebSessionFields1774400000000 implements MigrationInterface {
  name = 'AddWebSessionFields1774400000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS "webRefreshToken" character varying NULL,
      ADD COLUMN IF NOT EXISTS "webSessionId" character varying NULL
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
      DROP COLUMN IF EXISTS "webRefreshToken",
      DROP COLUMN IF EXISTS "webSessionId"
    `)
  }
}
