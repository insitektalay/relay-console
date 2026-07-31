import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAgentProvisioning1774600000000 implements MigrationInterface {
  name = "AddAgentProvisioning1774600000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "agents"
      ADD COLUMN IF NOT EXISTS "externalId" character varying
    `);

    await queryRunner.query(`
      ALTER TABLE "agents"
      ADD COLUMN IF NOT EXISTS "source" character varying NOT NULL DEFAULT 'manual'
    `);

    await queryRunner.query(`
      ALTER TABLE "agents"
      ADD COLUMN IF NOT EXISTS "connectionId" character varying
    `);

    await queryRunner.query(`
      ALTER TABLE "agents"
      ADD COLUMN IF NOT EXISTS "modelPrimary" character varying
    `);

    await queryRunner.query(`
      ALTER TABLE "agents"
      ADD COLUMN IF NOT EXISTS "provisioningStatus" character varying
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_agents_workspace_externalId"
      ON "agents" ("workspaceId", "externalId")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "agent_provisioning_jobs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "workspaceId" character varying NOT NULL,
        "requestedByUserId" character varying,
        "name" character varying NOT NULL,
        "slug" character varying NOT NULL,
        "role" character varying NOT NULL,
        "connectionId" character varying,
        "createdAgentId" character varying,
        "externalAgentId" character varying,
        "status" character varying NOT NULL DEFAULT 'queued',
        "stage" character varying NOT NULL DEFAULT 'queued',
        "message" text,
        "error" text,
        "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "files" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "completedAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_agent_provisioning_jobs_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_agent_provisioning_jobs_workspace_created"
      ON "agent_provisioning_jobs" ("workspaceId", "createdAt")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_agent_provisioning_jobs_status"
      ON "agent_provisioning_jobs" ("status")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_agent_provisioning_jobs_externalAgentId"
      ON "agent_provisioning_jobs" ("externalAgentId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_agent_provisioning_jobs_externalAgentId"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_agent_provisioning_jobs_status"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_agent_provisioning_jobs_workspace_created"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "agent_provisioning_jobs"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_agents_workspace_externalId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "agents" DROP COLUMN IF EXISTS "provisioningStatus"`,
    );
    await queryRunner.query(
      `ALTER TABLE "agents" DROP COLUMN IF EXISTS "modelPrimary"`,
    );
    await queryRunner.query(
      `ALTER TABLE "agents" DROP COLUMN IF EXISTS "connectionId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "agents" DROP COLUMN IF EXISTS "source"`,
    );
    await queryRunner.query(
      `ALTER TABLE "agents" DROP COLUMN IF EXISTS "externalId"`,
    );
  }
}
