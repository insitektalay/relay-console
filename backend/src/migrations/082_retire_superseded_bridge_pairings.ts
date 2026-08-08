import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Retires duplicate active bridge pairings that represent the same labelled
 * runtime on the same host type. The newest observed pairing remains active;
 * older credentials cannot reconnect after this migration.
 */
export class RetireSupersededBridgePairings1786172400082
  implements MigrationInterface
{
  name = "RetireSupersededBridgePairings1786172400082";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      WITH ranked_pairings AS (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY "workspaceId", label, "runtimeType", "hostType"
            ORDER BY
              "lastSeenAt" DESC NULLS LAST,
              "updatedAt" DESC,
              "createdAt" DESC,
              id DESC
          ) AS pairing_rank
        FROM "bridge_devices"
        WHERE status = 'active'
          AND "runtimeType" IS NOT NULL
          AND "hostType" IS NOT NULL
      )
      UPDATE "bridge_devices" AS device
      SET
        status = 'revoked',
        "revokedAt" = COALESCE(device."revokedAt", NOW()),
        "updatedAt" = NOW()
      FROM ranked_pairings
      WHERE device.id = ranked_pairings.id
        AND ranked_pairings.pairing_rank > 1
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Forward-only: superseded credentials must never become valid again.
  }
}
