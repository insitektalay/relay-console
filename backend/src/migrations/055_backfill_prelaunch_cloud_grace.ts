import { MigrationInterface, QueryRunner } from "typeorm";

export class BackfillPrelaunchCloudGrace0550000000000
  implements MigrationInterface
{
  name = "BackfillPrelaunchCloudGrace0550000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "relay_commercial_subscriptions" (
        "id", "workspaceId", "plan", "status", "provider",
        "providerCustomerId", "providerSubscriptionId", "limits", "features",
        "trialEndsAt", "graceEndsAt", "readOnlyAt", "deletionEligibleAt",
        "cancelledAt", "currentPeriodEndsAt", "cancelAtPeriodEnd",
        "createdAt", "updatedAt"
      )
      SELECT
        gen_random_uuid(), workspace.id, 'relay_cloud_migration_grace', 'grace',
        'relay_migration', NULL, NULL, '{}'::jsonb,
        '{"cloudControlPlane":true,"customerRuntimeHosts":true,"managedRuntime":false}'::jsonb,
        NULL, NOW() + INTERVAL '7 days', NOW() + INTERVAL '7 days', NULL,
        NULL, NULL, false, NOW(), NOW()
      FROM "workspaces" workspace
      WHERE workspace.type = 'personal'
        AND NOT EXISTS (
          SELECT 1
          FROM "relay_commercial_subscriptions" subscription
          WHERE subscription."workspaceId" = workspace.id
        )
      ON CONFLICT ("workspaceId") DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "relay_commercial_subscriptions"
      WHERE provider = 'relay_migration'
        AND plan = 'relay_cloud_migration_grace'
        AND "providerCustomerId" IS NULL
        AND "providerSubscriptionId" IS NULL;
    `);
  }
}
