import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBridgeCredentialReplayState1785185000070 implements MigrationInterface {
  name = "AddBridgeCredentialReplayState1785185000070";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bridge_devices"
        ADD COLUMN IF NOT EXISTS "previousCredentialHash" character varying,
        ADD COLUMN IF NOT EXISTS "previousCredentialVersion" integer,
        ADD COLUMN IF NOT EXISTS "previousCredentialConsumedAt" timestamptz
    `);
    await queryRunner.query(`
      ALTER TABLE "bridge_devices"
        ADD CONSTRAINT "CHK_bridge_previous_credential_state"
        CHECK (
          (
            "previousCredentialHash" IS NULL
            AND "previousCredentialVersion" IS NULL
            AND "previousCredentialConsumedAt" IS NULL
          )
          OR
          (
            "previousCredentialHash" ~ '^[0-9a-f]{64}$'
            AND "previousCredentialVersion" >= 1
            AND "previousCredentialConsumedAt" IS NOT NULL
          )
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bridge_devices"
        DROP CONSTRAINT IF EXISTS "CHK_bridge_previous_credential_state",
        DROP COLUMN IF EXISTS "previousCredentialConsumedAt",
        DROP COLUMN IF EXISTS "previousCredentialVersion",
        DROP COLUMN IF EXISTS "previousCredentialHash"
    `);
  }
}
