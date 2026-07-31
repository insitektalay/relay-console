import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUnifiedRuntimeDomain1775090000000 implements MigrationInterface {
  name = "AddUnifiedRuntimeDomain1775090000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE runtime_bindings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "workspaceId" UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        "agentId" UUID NOT NULL UNIQUE REFERENCES agents(id) ON DELETE CASCADE,
        "runtimeType" VARCHAR NOT NULL,
        "adapterKind" VARCHAR NOT NULL,
        "routingMode" VARCHAR NOT NULL DEFAULT 'explicit_only',
        "workspaceRoot" VARCHAR,
        "repoKey" VARCHAR,
        "isEnabled" BOOLEAN NOT NULL DEFAULT true,
        "healthStatus" VARCHAR NOT NULL DEFAULT 'unconfigured',
        "lastHealthCheckAt" TIMESTAMPTZ,
        "lastErrorCode" VARCHAR,
        "lastErrorMessage" TEXT,
        capabilities JSONB NOT NULL DEFAULT '{}'::jsonb,
        "configMetadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE runtime_thread_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "workspaceId" UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        "threadId" UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
        "threadSessionId" UUID NOT NULL REFERENCES thread_sessions(id) ON DELETE CASCADE,
        "agentId" UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
        "runtimeBindingId" UUID NOT NULL REFERENCES runtime_bindings(id) ON DELETE CASCADE,
        "runtimeSessionId" VARCHAR NOT NULL,
        status VARCHAR NOT NULL DEFAULT 'active',
        "lastDispatchedMessageId" UUID REFERENCES messages(id) ON DELETE SET NULL,
        "lastRunStartedAt" TIMESTAMPTZ,
        "lastRunFinishedAt" TIMESTAMPTZ,
        "lastErrorCode" VARCHAR,
        "lastErrorMessage" TEXT,
        "lastActivityAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "closedAt" TIMESTAMPTZ,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE ("threadSessionId", "agentId"),
        UNIQUE ("runtimeBindingId", "runtimeSessionId")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE runtime_dispatches (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "workspaceId" UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        "threadId" UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
        "threadSessionId" UUID NOT NULL REFERENCES thread_sessions(id) ON DELETE CASCADE,
        "messageId" UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        "agentId" UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
        "runtimeBindingId" UUID NOT NULL REFERENCES runtime_bindings(id) ON DELETE CASCADE,
        "runtimeThreadSessionId" UUID NOT NULL REFERENCES runtime_thread_sessions(id) ON DELETE CASCADE,
        "dispatchKey" VARCHAR NOT NULL UNIQUE,
        status VARCHAR NOT NULL DEFAULT 'queued',
        "attemptNumber" INTEGER NOT NULL DEFAULT 1,
        "startedAt" TIMESTAMPTZ,
        "completedAt" TIMESTAMPTZ,
        "timeoutAt" TIMESTAMPTZ,
        "postedMessageId" UUID REFERENCES messages(id) ON DELETE SET NULL,
        "runtimeRunId" VARCHAR,
        "errorCode" VARCHAR,
        "errorMessage" TEXT,
        "resultSummary" TEXT,
        "resultMetadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
        "correlationId" VARCHAR,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_runtime_bindings_workspace_enabled
      ON runtime_bindings ("workspaceId", "isEnabled")
    `);
    await queryRunner.query(`
      CREATE INDEX idx_runtime_bindings_type_enabled
      ON runtime_bindings ("runtimeType", "isEnabled")
    `);
    await queryRunner.query(`
      CREATE INDEX idx_runtime_thread_sessions_thread_agent
      ON runtime_thread_sessions ("threadId", "agentId")
    `);
    await queryRunner.query(`
      CREATE INDEX idx_runtime_thread_sessions_status_activity
      ON runtime_thread_sessions (status, "lastActivityAt")
    `);
    await queryRunner.query(`
      CREATE INDEX idx_runtime_dispatches_agent_created
      ON runtime_dispatches ("agentId", "createdAt")
    `);
    await queryRunner.query(`
      CREATE INDEX idx_runtime_dispatches_status_updated
      ON runtime_dispatches (status, "updatedAt")
    `);
    await queryRunner.query(`
      CREATE INDEX idx_runtime_dispatches_thread_session_agent
      ON runtime_dispatches ("threadSessionId", "agentId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_runtime_dispatches_thread_session_agent`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_runtime_dispatches_status_updated`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_runtime_dispatches_agent_created`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_runtime_thread_sessions_status_activity`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_runtime_thread_sessions_thread_agent`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_runtime_bindings_type_enabled`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_runtime_bindings_workspace_enabled`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS runtime_dispatches`);
    await queryRunner.query(`DROP TABLE IF EXISTS runtime_thread_sessions`);
    await queryRunner.query(`DROP TABLE IF EXISTS runtime_bindings`);
  }
}
