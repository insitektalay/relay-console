import { MigrationInterface, QueryRunner } from "typeorm";

export class AddManagedRuntimeMetering1721750400063
  implements MigrationInterface
{
  name = "AddManagedRuntimeMetering1721750400063";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "managed_runtimes"
        ADD COLUMN IF NOT EXISTS "runtimeMinutesUsed" numeric(20,6) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "lastMeteredAt" timestamptz
    `);
    await queryRunner.query(`
      ALTER TABLE "managed_runtimes"
        ADD CONSTRAINT "CHK_managed_runtime_minutes_nonnegative"
        CHECK ("runtimeMinutesUsed" >= 0)
    `);
    await queryRunner.query(`
      ALTER TABLE "managed_runtimes"
        ADD CONSTRAINT "CHK_managed_runtime_storage_nonnegative"
        CHECK ("storageUsedBytes" >= 0)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "managed_runtimes"
        DROP CONSTRAINT IF EXISTS "CHK_managed_runtime_storage_nonnegative"
    `);
    await queryRunner.query(`
      ALTER TABLE "managed_runtimes"
        DROP CONSTRAINT IF EXISTS "CHK_managed_runtime_minutes_nonnegative"
    `);
    await queryRunner.query(`
      ALTER TABLE "managed_runtimes"
        DROP COLUMN IF EXISTS "lastMeteredAt",
        DROP COLUMN IF EXISTS "runtimeMinutesUsed"
    `);
  }
}
