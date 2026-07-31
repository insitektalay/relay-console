import { MigrationInterface, QueryRunner } from "typeorm";

export class ResolveHermesRuntimeCollisions0590000000000
  implements MigrationInterface
{
  name = "ResolveHermesRuntimeCollisions0590000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Some legacy hosts reported the same external id from both OpenClaw and
    // Hermes. A live Hermes replica plus either the explicit capability or the
    // user's established Hermes naming convention is sufficient to resolve
    // that otherwise ambiguous canonical identity as Hermes.
    await queryRunner.query(`
      WITH hermes_evidence AS (
        SELECT DISTINCT a.id
        FROM agents a
        JOIN agent_runtime_replicas r
          ON r."agentId" = a.id
          AND r.status = 'active'
          AND r."runtimeType" = 'hermes'
        WHERE a.source <> 'claude_code'
          AND (
            a.capabilities @> '["clawchat.runtime.hermes"]'::jsonb OR
            lower(a.name) LIKE '%hermes%'
          )
      )
      UPDATE agents a
      SET source = 'hermes', "updatedAt" = now()
      FROM hermes_evidence e
      WHERE a.id = e.id
        AND a.source IS DISTINCT FROM 'hermes';

      UPDATE runtime_bindings b
      SET
        "runtimeType" = 'hermes',
        "adapterKind" = 'hermes_bridge',
        "routingMode" = 'explicit_only',
        "updatedAt" = now()
      FROM agents a
      WHERE b."agentId" = a.id
        AND a.source = 'hermes'
        AND b."runtimeType" IS DISTINCT FROM 'hermes';

      UPDATE relay_sync_objects o
      SET
        payload = jsonb_set(
          jsonb_set(o.payload, '{source}', '"hermes"'::jsonb, true),
          '{runtimeType}',
          '"hermes"'::jsonb,
          true
        ),
        "serverVersion" = o."serverVersion" + 1,
        "updatedAt" = now()
      FROM agents a
      WHERE o."objectType" = 'agent'
        AND o."canonicalObjectId" = a.id::text
        AND a.source = 'hermes'
        AND (
          o.payload ->> 'runtimeType' IS DISTINCT FROM 'hermes' OR
          o.payload ->> 'source' IS DISTINCT FROM 'hermes'
        );

      INSERT INTO relay_workspace_changes (
        id, "workspaceId", "changeType", "objectType", "objectId",
        "serverVersion", payload, "actorUserId", "installationId", "createdAt"
      )
      SELECT
        gen_random_uuid(), o."workspaceId", 'upsert', 'agent', o."objectId",
        o."serverVersion",
        o.payload || jsonb_build_object('canonicalObjectId', o."canonicalObjectId"),
        NULL, NULL, now()
      FROM relay_sync_objects o
      JOIN agents a ON a.id::text = o."canonicalObjectId"
      WHERE o."objectType" = 'agent'
        AND a.source = 'hermes'
        AND o.payload ->> 'runtimeType' = 'hermes';
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Reverting would restore the known cross-runtime collision.
  }
}
