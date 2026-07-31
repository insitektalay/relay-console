import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBridgeRuntimeModelCatalog1721836800064 implements MigrationInterface {
  name = "AddBridgeRuntimeModelCatalog1721836800064";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bridge_devices"
        ADD COLUMN IF NOT EXISTS "runtimeModelCatalog" jsonb,
        ADD COLUMN IF NOT EXISTS "runtimeModelCatalogObservedAt" timestamptz
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_bridge_devices_runtime_model_catalog"
      ON "bridge_devices" ("workspaceId", "runtimeModelCatalogObservedAt" DESC)
      WHERE "runtimeModelCatalog" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_bridge_devices_runtime_model_catalog"`,
    );
    await queryRunner.query(`
      ALTER TABLE "bridge_devices"
        DROP COLUMN IF EXISTS "runtimeModelCatalogObservedAt",
        DROP COLUMN IF EXISTS "runtimeModelCatalog"
    `);
  }
}
