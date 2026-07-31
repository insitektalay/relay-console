import { MigrationInterface, QueryRunner } from "typeorm";

export class RepairCanonicalAgentRuntimeIdentity0580000000000
  implements MigrationInterface
{
  name = "RepairCanonicalAgentRuntimeIdentity0580000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Runtime replicas and the explicit Hermes capability are authoritative
    // evidence. Repair rows that were previously defaulted to OpenClaw. An
    // agent with conflicting replicas is left unchanged unless it carries the
    // explicit Hermes capability (the known legacy collision case).
    await queryRunner.query(`
      WITH runtime_evidence AS (
        SELECT
          a.id AS "agentId",
          CASE
            WHEN a.capabilities @> '["clawchat.runtime.hermes"]'::jsonb
              THEN 'hermes'
            WHEN COUNT(DISTINCT r."runtimeType") FILTER (WHERE r.status = 'active') = 1
              THEN MIN(r."runtimeType") FILTER (WHERE r.status = 'active')
            ELSE NULL
          END AS "runtimeType"
        FROM agents a
        LEFT JOIN agent_runtime_replicas r ON r."agentId" = a.id
        WHERE a.source <> 'claude_code'
        GROUP BY a.id
      )
      UPDATE agents a
      SET source = e."runtimeType", "updatedAt" = now()
      FROM runtime_evidence e
      WHERE a.id = e."agentId"
        AND e."runtimeType" IN ('hermes', 'openclaw')
        AND a.source IS DISTINCT FROM e."runtimeType";

      UPDATE runtime_bindings b
      SET
        "runtimeType" = a.source,
        "adapterKind" = CASE
          WHEN a.source = 'hermes' THEN 'hermes_bridge'
          ELSE 'bridge_ws'
        END,
        "routingMode" = CASE
          WHEN a.source = 'hermes' THEN 'explicit_only'
          ELSE 'default_target'
        END,
        "updatedAt" = now()
      FROM agents a
      WHERE b."agentId" = a.id
        AND a.source IN ('hermes', 'openclaw')
        AND b."runtimeType" IS DISTINCT FROM a.source;

      UPDATE relay_sync_objects o
      SET
        payload = jsonb_set(
          jsonb_set(o.payload, '{source}', to_jsonb(a.source::text), true),
          '{runtimeType}',
          to_jsonb(a.source::text),
          true
        ),
        "serverVersion" = o."serverVersion" + 1,
        "updatedAt" = now()
      FROM agents a
      WHERE o."objectType" = 'agent'
          AND o."canonicalObjectId" = a.id::text
        AND a.source IN ('hermes', 'openclaw')
        AND (
          o.payload ->> 'runtimeType' IS DISTINCT FROM a.source OR
          o.payload ->> 'source' IS DISTINCT FROM a.source
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
        AND a.source IN ('hermes', 'openclaw')
        AND o.payload ->> 'runtimeType' = a.source;
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // This migration repairs identities from durable runtime evidence. Reverting
    // to the guessed labels would knowingly restore corrupt state.
  }
}
