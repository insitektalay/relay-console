import { MigrationInterface, QueryRunner } from "typeorm";

export class AddInstallationSecretLifecycle1785686400079 implements MigrationInterface {
  name = "AddInstallationSecretLifecycle1785686400079";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "relay_installation_secret_lifecycle" (
        "id" smallint PRIMARY KEY CHECK ("id" = 1),
        "registry" jsonb NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "relay_installation_secret_lifecycle"`,
    );
  }
}
