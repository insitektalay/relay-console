import { MigrationInterface, QueryRunner } from "typeorm";

export class AddXOAuthReauthorizeConnection0370000000000 implements MigrationInterface {
  name = "AddXOAuthReauthorizeConnection0370000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE marketplace_oauth_states
      ADD COLUMN IF NOT EXISTS "reauthorizeConnectionId" uuid
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_marketplace_oauth_states_reauthorize_connection
      ON marketplace_oauth_states ("reauthorizeConnectionId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_marketplace_oauth_states_reauthorize_connection`);
    await queryRunner.query(`
      ALTER TABLE marketplace_oauth_states
      DROP COLUMN IF EXISTS "reauthorizeConnectionId"
    `);
  }
}
