import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAgentRuntimeReplicas0570000000000 implements MigrationInterface {
  name = "AddAgentRuntimeReplicas0570000000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "agent_runtime_replicas" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "workspaceId" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
        "agentId" uuid NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
        "bridgeDeviceId" uuid NOT NULL REFERENCES "bridge_devices"("id") ON DELETE CASCADE,
        "runtimeType" varchar NOT NULL,
        "externalAgentId" varchar NOT NULL,
        "status" varchar NOT NULL DEFAULT 'active',
        "manifestHash" varchar,
        "lastSeenAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        UNIQUE ("workspaceId", "bridgeDeviceId", "runtimeType", "externalAgentId")
      );
      CREATE INDEX IF NOT EXISTS "IDX_agent_runtime_replicas_agent"
        ON "agent_runtime_replicas" ("workspaceId", "agentId");

      CREATE TABLE IF NOT EXISTS "agent_document_replicas" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "workspaceId" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
        "agentId" uuid NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
        "runtimeReplicaId" uuid NOT NULL REFERENCES "agent_runtime_replicas"("id") ON DELETE CASCADE,
        "objectId" varchar NOT NULL,
        "appliedServerVersion" bigint NOT NULL DEFAULT 0,
        "contentHash" varchar,
        "status" varchar NOT NULL DEFAULT 'pending',
        "lastError" varchar,
        "lastSeenAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        UNIQUE ("runtimeReplicaId", "objectId")
      );
      CREATE INDEX IF NOT EXISTS "IDX_agent_document_replicas_agent"
        ON "agent_document_replicas" ("workspaceId", "agentId");
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "agent_document_replicas"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "agent_runtime_replicas"`);
  }
}
