import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBillingEventClaimLease1785186000071 implements MigrationInterface {
  name = "AddBillingEventClaimLease1785186000071";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "relay_billing_events"
        ADD COLUMN IF NOT EXISTS "claimToken" uuid,
        ADD COLUMN IF NOT EXISTS "claimExpiresAt" timestamptz,
        ADD COLUMN IF NOT EXISTS "attemptCount" integer NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      UPDATE "relay_billing_events"
      SET
        "claimToken" = COALESCE("claimToken", gen_random_uuid()),
        "claimExpiresAt" = COALESCE(
          "claimExpiresAt",
          "createdAt" + INTERVAL '10 minutes'
        ),
        "attemptCount" = GREATEST("attemptCount", 1)
      WHERE provider IN ('stripe', 'apple') AND status = 'processing'
    `);
    await queryRunner.query(`
      ALTER TABLE "relay_billing_events"
        ADD CONSTRAINT "CHK_relay_billing_event_attempt_count"
          CHECK ("attemptCount" >= 0),
        ADD CONSTRAINT "CHK_billing_processing_claim"
          CHECK (
            provider NOT IN ('stripe', 'apple')
            OR status <> 'processing'
            OR (
              "claimToken" IS NOT NULL
              AND "claimExpiresAt" IS NOT NULL
              AND "attemptCount" >= 1
            )
          )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_relay_billing_event_stale_claim"
        ON "relay_billing_events" (provider, status, "claimExpiresAt")
        WHERE status = 'processing'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_relay_billing_event_stale_claim";
      ALTER TABLE "relay_billing_events"
        DROP CONSTRAINT IF EXISTS "CHK_billing_processing_claim",
        DROP CONSTRAINT IF EXISTS "CHK_relay_billing_event_attempt_count",
        DROP COLUMN IF EXISTS "attemptCount",
        DROP COLUMN IF EXISTS "claimExpiresAt",
        DROP COLUMN IF EXISTS "claimToken"
    `);
  }
}
