import { MigrationInterface, QueryRunner } from "typeorm";

export class AddClaudeRuntimeDomain1775080000000 implements MigrationInterface {
  name = "AddClaudeRuntimeDomain1775080000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE claude_agent_bindings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "workspaceId" UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        "agentId" UUID NOT NULL UNIQUE REFERENCES agents(id) ON DELETE CASCADE,
        "repoKey" VARCHAR NOT NULL,
        "routingMode" VARCHAR NOT NULL DEFAULT 'explicit_only',
        model VARCHAR,
        "isEnabled" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE ("workspaceId", "repoKey")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE claude_thread_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "workspaceId" UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        "threadId" UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
        "threadSessionId" UUID NOT NULL REFERENCES thread_sessions(id) ON DELETE CASCADE,
        "agentId" UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
        "claudeSessionId" UUID NOT NULL UNIQUE,
        status VARCHAR NOT NULL DEFAULT 'active',
        "lastDispatchedMessageId" UUID REFERENCES messages(id) ON DELETE SET NULL,
        "lastRunStartedAt" TIMESTAMPTZ,
        "lastRunFinishedAt" TIMESTAMPTZ,
        "lastErrorCode" VARCHAR,
        "lastErrorMessage" TEXT,
        "lastActivityAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "closedAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE ("threadSessionId", "agentId")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE claude_dispatches (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "workspaceId" UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        "threadId" UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
        "threadSessionId" UUID NOT NULL REFERENCES thread_sessions(id) ON DELETE CASCADE,
        "messageId" UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        "agentId" UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
        "dispatchKey" VARCHAR NOT NULL UNIQUE,
        status VARCHAR NOT NULL DEFAULT 'queued',
        "bridgeDeviceId" UUID REFERENCES bridge_devices(id) ON DELETE SET NULL,
        "startedAt" TIMESTAMPTZ,
        "completedAt" TIMESTAMPTZ,
        "timeoutAt" TIMESTAMPTZ,
        "postedMessageId" UUID REFERENCES messages(id) ON DELETE SET NULL,
        "errorCode" VARCHAR,
        "errorMessage" TEXT,
        "resultSummary" TEXT,
        "resultMetadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_claude_agent_bindings_workspace_enabled
      ON claude_agent_bindings ("workspaceId", "isEnabled")
    `);
    await queryRunner.query(`
      CREATE INDEX idx_claude_thread_sessions_thread_agent
      ON claude_thread_sessions ("threadId", "agentId")
    `);
    await queryRunner.query(`
      CREATE INDEX idx_claude_thread_sessions_status_activity
      ON claude_thread_sessions (status, "lastActivityAt")
    `);
    await queryRunner.query(`
      CREATE INDEX idx_claude_dispatches_agent_created
      ON claude_dispatches ("agentId", "createdAt")
    `);
    await queryRunner.query(`
      CREATE INDEX idx_claude_dispatches_status_updated
      ON claude_dispatches (status, "updatedAt")
    `);
    await queryRunner.query(`
      CREATE INDEX idx_claude_dispatches_thread_session_agent
      ON claude_dispatches ("threadSessionId", "agentId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_claude_dispatches_thread_session_agent`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_claude_dispatches_status_updated`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_claude_dispatches_agent_created`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_claude_thread_sessions_status_activity`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_claude_thread_sessions_thread_agent`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_claude_agent_bindings_workspace_enabled`);
    await queryRunner.query(`DROP TABLE IF EXISTS claude_dispatches`);
    await queryRunner.query(`DROP TABLE IF EXISTS claude_thread_sessions`);
    await queryRunner.query(`DROP TABLE IF EXISTS claude_agent_bindings`);
  }
}
