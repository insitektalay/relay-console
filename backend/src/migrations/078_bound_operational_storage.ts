import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Converts workspace-seeded Marketplace drafts into one shared global copy and
 * removes operational history that has outlived the product features that use
 * it. User and agent messages are deliberately outside this migration.
 */
export class BoundOperationalStorage1785416400000 implements MigrationInterface {
  name = "BoundOperationalStorage1785416400000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS relay_storage_maintenance_requests (
        id varchar PRIMARY KEY,
        "requestedAt" timestamptz NOT NULL DEFAULT now(),
        "completedAt" timestamptz
      )
    `);
    await queryRunner.query(`
      ALTER TABLE marketplace_generated_packs
      ALTER COLUMN "workspaceId" DROP NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE marketplace_generated_packs
      DROP CONSTRAINT IF EXISTS uq_marketplace_generated_packs_workspace_app
    `);

    await queryRunner.query(`
      WITH ranked AS (
        SELECT
          id,
          row_number() OVER (
            PARTITION BY "appSlug"
            ORDER BY "updatedAt" DESC, id
          ) AS row_number
        FROM marketplace_generated_packs
        WHERE metadata ->> 'source' = 'pack_factory'
      )
      DELETE FROM marketplace_generated_packs AS pack
      USING ranked
      WHERE pack.id = ranked.id
        AND ranked.row_number > 1
    `);
    await queryRunner.query(`
      UPDATE marketplace_generated_packs
      SET "workspaceId" = NULL
      WHERE metadata ->> 'source' = 'pack_factory'
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS
        uq_marketplace_generated_packs_global_app
      ON marketplace_generated_packs ("appSlug")
      WHERE "workspaceId" IS NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS
        uq_marketplace_generated_packs_workspace_app
      ON marketplace_generated_packs ("workspaceId", "appSlug")
      WHERE "workspaceId" IS NOT NULL
    `);

    await queryRunner.query(`
      INSERT INTO managed_agent_documents (
        "workspaceId", "agentId", "runtimeType", "authorityClass",
        "documentKind", "relativePath", folder, filename, "desiredContent",
        "desiredHash", "desiredVersion", "byteSize", "syncState",
        "editPolicy", "legacyObjectId", "createdAt", "updatedAt"
      )
      SELECT
        object."workspaceId",
        agent.id,
        CASE
          WHEN object.payload ->> 'runtimeType' IN ('hermes', 'openclaw')
            THEN object.payload ->> 'runtimeType'
          WHEN agent.source IN ('hermes', 'openclaw') THEN agent.source
          ELSE 'openclaw'
        END,
        'managed',
        COALESCE(object.payload ->> 'documentKind', 'instruction'),
        concat_ws(
          '/',
          NULLIF(object.payload ->> 'folder', ''),
          object.payload ->> 'filename'
        ),
        COALESCE(object.payload ->> 'folder', ''),
        object.payload ->> 'filename',
        object.payload ->> 'content',
        COALESCE(
          object.payload ->> 'contentHash',
          md5(COALESCE(object.payload ->> 'content', ''))
        ),
        object."serverVersion",
        octet_length(
          convert_to(COALESCE(object.payload ->> 'content', ''), 'UTF8')
        ),
        'saved',
        '{"editable":true,"optimisticConcurrency":true}'::jsonb,
        object."objectId",
        object."createdAt",
        object."updatedAt"
      FROM relay_sync_objects AS object
      LEFT JOIN relay_sync_objects AS mapping
        ON mapping."workspaceId" = object."workspaceId"
       AND mapping."objectType" = 'agent'
       AND (
         mapping."objectId" = object.payload ->> 'agentId'
         OR mapping."sourceObjectId" = object.payload ->> 'agentId'
       )
      JOIN agents AS agent
        ON agent.id::text = COALESCE(
          mapping."canonicalObjectId",
          object.payload ->> 'agentId'
        )
      WHERE object."objectType" = 'agent_document'
        AND object."deletedAt" IS NULL
        AND object.payload ->> 'filename' IS NOT NULL
        AND object.payload ->> 'content' IS NOT NULL
        AND octet_length(
          convert_to(object.payload ->> 'content', 'UTF8')
        ) <= 1048576
      ON CONFLICT ("workspaceId", "agentId", "runtimeType", "relativePath")
      DO NOTHING
    `);
    await queryRunner.query(`
      DELETE FROM relay_sync_objects
      WHERE "objectType" = 'agent_document'
    `);

    await queryRunner.query(`
      UPDATE runtime_dispatches
      SET "resultSummary" = NULL,
          "resultMetadata" = '{}'::jsonb
      WHERE status IN ('completed', 'failed', 'cancelled')
        AND "updatedAt" < now() - interval '1 day'
    `);
    await queryRunner.query(`
      DELETE FROM runtime_dispatches
      WHERE status IN ('completed', 'failed', 'cancelled')
    `);

    await queryRunner.query(`
      DELETE FROM audit_logs
    `);

    await queryRunner.query(`
      DELETE FROM relay_workspace_changes AS change
      WHERE change.sequence < (
          SELECT MAX(latest.sequence)
          FROM relay_workspace_changes AS latest
          WHERE latest."workspaceId" = change."workspaceId"
        )
    `);
    await queryRunner.query(`
      DELETE FROM relay_client_mutation_receipts
    `);

    for (const table of [
      "agents",
      "threads",
      "runtime_dispatches",
      "audit_logs",
      "relay_workspace_changes",
      "relay_sync_objects",
      "managed_agent_documents",
      "marketplace_generated_packs",
    ]) {
      await queryRunner.query(`
        ALTER TABLE "${table}" SET (
          autovacuum_vacuum_scale_factor = 0.05,
          autovacuum_analyze_scale_factor = 0.02
        )
      `);
    }
    await queryRunner.query(`
      INSERT INTO relay_storage_maintenance_requests (id)
      VALUES ('bound-operational-storage-v1')
      ON CONFLICT (id) DO UPDATE
      SET "requestedAt" = now(), "completedAt" = NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS uq_marketplace_generated_packs_workspace_app
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS uq_marketplace_generated_packs_global_app
    `);
    await queryRunner.query(`
      DELETE FROM marketplace_generated_packs WHERE "workspaceId" IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE marketplace_generated_packs
      ALTER COLUMN "workspaceId" SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE marketplace_generated_packs
      ADD CONSTRAINT uq_marketplace_generated_packs_workspace_app
      UNIQUE ("workspaceId", "appSlug")
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS relay_storage_maintenance_requests
    `);
  }
}
