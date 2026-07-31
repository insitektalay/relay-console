import { MigrationInterface, QueryRunner } from "typeorm";

export class AddToolRequests0400000000000 implements MigrationInterface {
  name = "AddToolRequests0400000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tool_requests" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "workspaceId" uuid NOT NULL,
        "linkedAppId" uuid NULL,
        "appSlug" varchar(180) NULL,
        "teamId" uuid NULL,
        "threadId" uuid NULL,
        "campaignId" varchar(180) NULL,
        "campaignName" varchar(240) NULL,
        "requestingAgentId" uuid NULL,
        "requestingAgentName" varchar(240) NULL,
        "role" varchar(80) NULL,
        "requestedCapability" varchar(120) NOT NULL,
        "requiredForAction" varchar(240) NOT NULL,
        "reason" text NOT NULL,
        "relatedTaskId" uuid NULL,
        "relatedRecordType" varchar(120) NULL,
        "relatedRecordId" varchar(180) NULL,
        "autonomyModeAtRequest" varchar(80) NULL,
        "policyAllowed" boolean NOT NULL DEFAULT false,
        "toolAvailable" boolean NOT NULL DEFAULT false,
        "toolConnected" boolean NOT NULL DEFAULT false,
        "toolGranted" boolean NOT NULL DEFAULT false,
        "suggestedMarketplaceAppSlugs" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "suggestedToolCategories" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "requiredEvidenceType" varchar(160) NULL,
        "status" varchar(32) NOT NULL DEFAULT 'requested',
        "resolutionNotes" text NULL,
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "lastSeenAt" timestamptz NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "resolvedAt" timestamptz NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_tool_requests_workspace_app_capability"
      ON "tool_requests" ("workspaceId", "appSlug", "requestedCapability")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_tool_requests_workspace_status"
      ON "tool_requests" ("workspaceId", "status")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_tool_requests_workspace_team"
      ON "tool_requests" ("workspaceId", "teamId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_tool_requests_workspace_thread"
      ON "tool_requests" ("workspaceId", "threadId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "tool_requests"`);
  }
}
