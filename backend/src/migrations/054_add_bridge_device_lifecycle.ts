import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddBridgeDeviceLifecycle0540000000000 implements MigrationInterface {
  name = 'AddBridgeDeviceLifecycle0540000000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bridge_devices"
        ADD COLUMN IF NOT EXISTS "runtimeType" varchar,
        ADD COLUMN IF NOT EXISTS "hostType" varchar,
        ADD COLUMN IF NOT EXISTS "credentialVersion" integer NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS "credentialRotatedAt" timestamptz;

      ALTER TABLE "bridge_devices"
        DROP CONSTRAINT IF EXISTS "CHK_bridge_device_runtime_type",
        DROP CONSTRAINT IF EXISTS "CHK_bridge_device_host_type";

      ALTER TABLE "bridge_devices"
        ADD CONSTRAINT "CHK_bridge_device_runtime_type"
          CHECK ("runtimeType" IS NULL OR "runtimeType" IN ('hermes', 'openclaw')),
        ADD CONSTRAINT "CHK_bridge_device_host_type"
          CHECK ("hostType" IS NULL OR "hostType" IN ('macos-launchd', 'linux-systemd'));
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bridge_devices"
        DROP CONSTRAINT IF EXISTS "CHK_bridge_device_runtime_type",
        DROP CONSTRAINT IF EXISTS "CHK_bridge_device_host_type",
        DROP COLUMN IF EXISTS "credentialRotatedAt",
        DROP COLUMN IF EXISTS "credentialVersion",
        DROP COLUMN IF EXISTS "hostType",
        DROP COLUMN IF EXISTS "runtimeType";
    `)
  }
}
