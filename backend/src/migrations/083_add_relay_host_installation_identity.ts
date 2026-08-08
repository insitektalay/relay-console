import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Adds one stable installation identity above runtime-specific bridge
 * credentials. Existing device rows are grouped by workspace, host type, and
 * the device label with the known runtime suffix removed. Runtime hosts adopt
 * the identity lazily when the first adapter reports fresh inventory, which
 * avoids rewriting historical authority and dispatch records in this schema
 * migration.
 */
export class AddRelayHostInstallationIdentity1786176000083
  implements MigrationInterface
{
  name = "AddRelayHostInstallationIdentity1786176000083";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bridge_devices"
        ADD COLUMN IF NOT EXISTS "hostInstallationId" varchar;
      ALTER TABLE "bridge_devices"
        ADD COLUMN IF NOT EXISTS "adapterRole" varchar NOT NULL DEFAULT 'runtime';
      ALTER TABLE "bridge_enrollments"
        ADD COLUMN IF NOT EXISTS "hostInstallationId" varchar;
      ALTER TABLE "runtime_hosts"
        ADD COLUMN IF NOT EXISTS "hostInstallationId" varchar;

      WITH normalized AS (
        SELECT
          id,
          md5(
            "workspaceId"::text || '|' || COALESCE("hostType", 'unknown') || '|' ||
            lower(regexp_replace(label, ' · (Hermes Agent|OpenClaw) bridge$', '', 'i'))
          ) AS digest
        FROM "bridge_devices"
        WHERE "hostInstallationId" IS NULL
      )
      UPDATE "bridge_devices" AS device
      SET "hostInstallationId" =
        'relayhost_' ||
        substr(normalized.digest, 1, 8) || '-' ||
        substr(normalized.digest, 9, 4) || '-4' ||
        substr(normalized.digest, 14, 3) || '-8' ||
        substr(normalized.digest, 18, 3) || '-' ||
        substr(normalized.digest, 21, 12)
      FROM normalized
      WHERE device.id = normalized.id;

      UPDATE "bridge_devices"
      SET "adapterRole" = CASE
        WHEN label ~* ' · (Hermes Agent|OpenClaw) bridge$' THEN 'runtime'
        ELSE 'host'
      END;

      CREATE INDEX IF NOT EXISTS "IDX_bridge_devices_workspace_host_installation_role"
        ON "bridge_devices" ("workspaceId", "hostInstallationId", "adapterRole");
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_runtime_hosts_workspace_host_installation"
        ON "runtime_hosts" ("workspaceId", "hostInstallationId")
        WHERE "hostInstallationId" IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "UQ_runtime_hosts_workspace_host_installation";
      DROP INDEX IF EXISTS "IDX_bridge_devices_workspace_host_installation_role";
      ALTER TABLE "runtime_hosts" DROP COLUMN IF EXISTS "hostInstallationId";
      ALTER TABLE "bridge_enrollments" DROP COLUMN IF EXISTS "hostInstallationId";
      ALTER TABLE "bridge_devices" DROP COLUMN IF EXISTS "adapterRole";
      ALTER TABLE "bridge_devices" DROP COLUMN IF EXISTS "hostInstallationId";
    `);
  }
}
