import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBillingProviderStateOrder0560000000000
  implements MigrationInterface
{
  name = "AddBillingProviderStateOrder0560000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "relay_commercial_subscriptions"
      ADD COLUMN IF NOT EXISTS "providerStateAt" timestamptz NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "relay_commercial_subscriptions"
      DROP COLUMN IF EXISTS "providerStateAt";
    `);
  }
}
