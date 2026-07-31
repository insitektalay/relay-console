import { MigrationInterface, QueryRunner } from "typeorm";

export class AddResponsePresentation1775800000000
  implements MigrationInterface
{
  name = "AddResponsePresentation1775800000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "agents"
      ADD COLUMN "responsePresentation" character varying NOT NULL DEFAULT 'standard'
    `);
    await queryRunner.query(`
      ALTER TABLE "messages"
      ADD COLUMN "contentFormat" character varying NOT NULL DEFAULT 'markdown'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "messages"
      DROP COLUMN "contentFormat"
    `);
    await queryRunner.query(`
      ALTER TABLE "agents"
      DROP COLUMN "responsePresentation"
    `);
  }
}
