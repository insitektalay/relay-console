import { MigrationInterface, QueryRunner } from 'typeorm'

export class FixSenderIdType1774171000000 implements MigrationInterface {
  name = 'FixSenderIdType1774171000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Allow any string as senderId (OpenClaw uses "main", not a UUID)
    await queryRunner.query(`
      ALTER TABLE messages
      ALTER COLUMN "senderId" TYPE VARCHAR(255)
      USING "senderId"::VARCHAR
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE messages
      ALTER COLUMN "senderId" TYPE UUID
      USING "senderId"::UUID
    `)
  }
}
