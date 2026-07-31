import { MigrationInterface, QueryRunner } from "typeorm";

export class AddStripeBilling0520000000000 implements MigrationInterface {
  name = "AddStripeBilling0520000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "relay_commercial_subscriptions"
        ADD COLUMN IF NOT EXISTS "provider" varchar NOT NULL DEFAULT 'stripe',
        ADD COLUMN IF NOT EXISTS "currentPeriodEndsAt" timestamptz,
        ADD COLUMN IF NOT EXISTS "cancelAtPeriodEnd" boolean NOT NULL DEFAULT false;

      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_relay_subscription_provider_customer"
        ON "relay_commercial_subscriptions" ("provider", "providerCustomerId")
        WHERE "providerCustomerId" IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_relay_subscription_provider_subscription"
        ON "relay_commercial_subscriptions" ("provider", "providerSubscriptionId")
        WHERE "providerSubscriptionId" IS NOT NULL;

      CREATE TABLE IF NOT EXISTS "relay_billing_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "provider" varchar NOT NULL,
        "providerEventId" varchar NOT NULL,
        "eventType" varchar NOT NULL,
        "liveMode" boolean NOT NULL DEFAULT false,
        "payloadHash" varchar NOT NULL,
        "status" varchar NOT NULL DEFAULT 'processing',
        "safeErrorCode" varchar,
        "processedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_relay_billing_provider_event" UNIQUE ("provider", "providerEventId"),
        CONSTRAINT "CHK_relay_billing_event_status" CHECK ("status" IN ('processing','processed','ignored','failed'))
      );
      CREATE INDEX IF NOT EXISTS "IDX_relay_billing_event_created"
        ON "relay_billing_events" ("createdAt");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS "relay_billing_events";
      DROP INDEX IF EXISTS "IDX_relay_subscription_provider_subscription";
      DROP INDEX IF EXISTS "IDX_relay_subscription_provider_customer";
      ALTER TABLE "relay_commercial_subscriptions"
        DROP COLUMN IF EXISTS "cancelAtPeriodEnd",
        DROP COLUMN IF EXISTS "currentPeriodEndsAt",
        DROP COLUMN IF EXISTS "provider";
    `);
  }
}
