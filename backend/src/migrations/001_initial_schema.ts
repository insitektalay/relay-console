import { MigrationInterface, QueryRunner } from 'typeorm'

export class InitialSchema1710000000001 implements MigrationInterface {
  name = 'InitialSchema1710000000001'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ─── ENUMS ───────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TYPE workspace_type_enum AS ENUM ('personal', 'business')
    `)
    await queryRunner.query(`
      CREATE TYPE permission_scope_enum AS ENUM (
        'workspace', 'company', 'department', 'team', 'agent'
      )
    `)
    await queryRunner.query(`
      CREATE TYPE team_memory_item_type_enum AS ENUM (
        'rule', 'context', 'document', 'SOP', 'note'
      )
    `)
    await queryRunner.query(`
      CREATE TYPE coaching_note_type_enum AS ENUM (
        'correction', 'improvement', 'praise', 'instruction', 'warning'
      )
    `)
    await queryRunner.query(`
      CREATE TYPE bridge_event_status_enum AS ENUM (
        'pending', 'processed', 'failed', 'retrying'
      )
    `)

    // ─── USERS ───────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR NOT NULL UNIQUE,
        name VARCHAR NOT NULL,
        "passwordHash" VARCHAR NOT NULL,
        "avatarUrl" VARCHAR,
        "refreshToken" VARCHAR,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
    await queryRunner.query(`CREATE INDEX idx_users_email ON users (email)`)

    // ─── WORKSPACES ──────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE workspaces (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR NOT NULL,
        type workspace_type_enum NOT NULL DEFAULT 'business',
        "avatarUrl" VARCHAR,
        description TEXT,
        "ownerId" UUID REFERENCES users(id) ON DELETE SET NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
    await queryRunner.query(`CREATE INDEX idx_workspaces_owner ON workspaces ("ownerId")`)

    // ─── COMPANIES ───────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE companies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR NOT NULL,
        "workspaceId" UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        "avatarUrl" VARCHAR,
        description TEXT,
        industry VARCHAR,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
    await queryRunner.query(`CREATE INDEX idx_companies_workspace ON companies ("workspaceId")`)

    // ─── DEPARTMENTS ─────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE departments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR NOT NULL,
        "companyId" UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        "headAgentId" UUID,
        description TEXT,
        color VARCHAR NOT NULL DEFAULT '#0A84FF',
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
    await queryRunner.query(`CREATE INDEX idx_departments_company ON departments ("companyId")`)

    // ─── TEAMS ───────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE teams (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR NOT NULL,
        "departmentId" UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
        "leadAgentId" UUID,
        description TEXT,
        color VARCHAR NOT NULL DEFAULT '#30D158',
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
    await queryRunner.query(`CREATE INDEX idx_teams_department ON teams ("departmentId")`)

    // ─── AGENTS ──────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE agents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR NOT NULL,
        role VARCHAR NOT NULL,
        "avatarUrl" VARCHAR,
        status VARCHAR NOT NULL DEFAULT 'off_duty',
        "workspaceId" UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        "teamId" UUID REFERENCES teams(id) ON DELETE SET NULL,
        "departmentId" UUID,
        "companyId" UUID,
        "managerId" UUID,
        description TEXT,
        capabilities JSONB NOT NULL DEFAULT '[]',
        "workingHoursMode" VARCHAR NOT NULL DEFAULT 'scheduled',
        timezone VARCHAR NOT NULL DEFAULT 'UTC',
        "currentTaskId" UUID,
        "tasksCompletedToday" INTEGER NOT NULL DEFAULT 0,
        "successRate" FLOAT NOT NULL DEFAULT 0,
        "avgCompletionMinutes" INTEGER NOT NULL DEFAULT 0,
        "totalMinutesWorked" INTEGER NOT NULL DEFAULT 0,
        "budgetUsed" FLOAT NOT NULL DEFAULT 0,
        "budgetLimit" FLOAT,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
    await queryRunner.query(`CREATE INDEX idx_agents_workspace ON agents ("workspaceId")`)
    await queryRunner.query(`CREATE INDEX idx_agents_team ON agents ("teamId")`)
    await queryRunner.query(`CREATE INDEX idx_agents_status ON agents (status)`)

    // ─── OPENCLAW CONNECTIONS ─────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE openclaw_connections (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "workspaceId" UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        "instanceUrl" VARCHAR NOT NULL,
        "apiKey" VARCHAR,
        status VARCHAR NOT NULL DEFAULT 'disconnected',
        "lastConnectedAt" TIMESTAMPTZ,
        "lastEventAt" TIMESTAMPTZ,
        "agentsSynced" INTEGER NOT NULL DEFAULT 0,
        "useMockMode" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
    await queryRunner.query(`CREATE INDEX idx_openclaw_connections_workspace ON openclaw_connections ("workspaceId")`)

    // ─── THREADS ─────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE threads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR NOT NULL,
        type VARCHAR NOT NULL,
        "workspaceId" UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        "avatarUrl" VARCHAR,
        "participantIds" JSONB NOT NULL DEFAULT '[]',
        "agentIds" JSONB NOT NULL DEFAULT '[]',
        "isPinned" BOOLEAN NOT NULL DEFAULT false,
        "isMuted" BOOLEAN NOT NULL DEFAULT false,
        status VARCHAR NOT NULL DEFAULT 'active',
        "teamId" UUID,
        "departmentId" UUID,
        "lastMessage" JSONB,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
    await queryRunner.query(`CREATE INDEX idx_threads_workspace ON threads ("workspaceId")`)
    await queryRunner.query(`CREATE INDEX idx_threads_type ON threads (type)`)
    await queryRunner.query(`CREATE INDEX idx_threads_updated_at ON threads ("updatedAt")`)

    // ─── THREAD READ STATES ───────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE thread_read_states (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "threadId" UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
        "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "lastReadMessageId" UUID,
        "unreadCount" INTEGER NOT NULL DEFAULT 0,
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT uq_thread_read_states UNIQUE ("threadId", "userId")
      )
    `)
    await queryRunner.query(`CREATE INDEX idx_thread_read_states_thread_user ON thread_read_states ("threadId", "userId")`)

    // ─── MESSAGES ────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "threadId" UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
        "senderId" UUID NOT NULL,
        "senderName" VARCHAR NOT NULL,
        "senderAvatarUrl" VARCHAR,
        content TEXT NOT NULL,
        type VARCHAR NOT NULL DEFAULT 'text',
        "embeddedCard" JSONB,
        attachments JSONB NOT NULL DEFAULT '[]',
        "isFromUser" BOOLEAN NOT NULL DEFAULT false,
        "isEdited" BOOLEAN NOT NULL DEFAULT false,
        "replyToId" UUID,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
    await queryRunner.query(`CREATE INDEX idx_messages_thread_created ON messages ("threadId", "createdAt")`)

    // ─── TASKS ───────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR NOT NULL,
        description TEXT,
        status VARCHAR NOT NULL DEFAULT 'queued',
        priority VARCHAR NOT NULL DEFAULT 'normal',
        "assignedAgentId" UUID,
        "teamId" UUID,
        "workspaceId" UUID NOT NULL,
        "createdByUserId" UUID,
        "createdByAgentId" UUID,
        "dueAt" TIMESTAMPTZ,
        "completedAt" TIMESTAMPTZ,
        tags TEXT[],
        "budgetUsed" FLOAT NOT NULL DEFAULT 0,
        "estimatedMinutes" INTEGER,
        "actualMinutes" INTEGER,
        "runCount" INTEGER NOT NULL DEFAULT 0,
        "lastRunAt" TIMESTAMPTZ,
        "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
        "approvalId" UUID,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
    await queryRunner.query(`CREATE INDEX idx_tasks_workspace_status ON tasks ("workspaceId", status)`)
    await queryRunner.query(`CREATE INDEX idx_tasks_assigned_agent ON tasks ("assignedAgentId")`)
    await queryRunner.query(`CREATE INDEX idx_tasks_team ON tasks ("teamId")`)

    // ─── RUNS ─────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE runs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "taskId" UUID NOT NULL,
        "agentId" UUID NOT NULL,
        status VARCHAR NOT NULL DEFAULT 'running',
        "startedAt" TIMESTAMPTZ NOT NULL,
        "completedAt" TIMESTAMPTZ,
        "errorMessage" TEXT,
        "eventsCount" INTEGER NOT NULL DEFAULT 0,
        "tokensUsed" INTEGER NOT NULL DEFAULT 0,
        cost FLOAT NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
    await queryRunner.query(`CREATE INDEX idx_runs_task ON runs ("taskId")`)
    await queryRunner.query(`CREATE INDEX idx_runs_agent ON runs ("agentId")`)

    // ─── RUN EVENTS ───────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE run_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "runId" UUID NOT NULL,
        type VARCHAR NOT NULL,
        content TEXT NOT NULL,
        timestamp TIMESTAMPTZ NOT NULL,
        metadata JSONB NOT NULL DEFAULT '{}'
      )
    `)
    await queryRunner.query(`CREATE INDEX idx_run_events_run_ts ON run_events ("runId", timestamp)`)

    // ─── APPROVALS ────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE approvals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR NOT NULL,
        description TEXT NOT NULL,
        status VARCHAR NOT NULL DEFAULT 'pending',
        "requestedByAgentId" UUID NOT NULL,
        "taskId" UUID,
        "workspaceId" UUID NOT NULL,
        risk VARCHAR NOT NULL DEFAULT 'medium',
        steps JSONB NOT NULL DEFAULT '[]',
        notes TEXT,
        "resolvedAt" TIMESTAMPTZ,
        "expiresAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
    await queryRunner.query(`CREATE INDEX idx_approvals_workspace_status ON approvals ("workspaceId", status)`)

    // ─── INCIDENTS ────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE incidents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR NOT NULL,
        description TEXT NOT NULL,
        status VARCHAR NOT NULL DEFAULT 'open',
        severity VARCHAR NOT NULL DEFAULT 'medium',
        "agentId" UUID,
        "teamId" UUID,
        "workspaceId" UUID NOT NULL,
        "taskId" UUID,
        "runId" UUID,
        tags TEXT[],
        "affectedSystems" TEXT[],
        "resolutionNotes" TEXT,
        "resolvedAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
    await queryRunner.query(`CREATE INDEX idx_incidents_workspace_status ON incidents ("workspaceId", status)`)
    await queryRunner.query(`CREATE INDEX idx_incidents_severity ON incidents (severity)`)

    // ─── WORK LOGS ────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE work_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "agentId" UUID NOT NULL,
        "taskId" UUID,
        "runId" UUID,
        action VARCHAR NOT NULL,
        details TEXT NOT NULL,
        timestamp TIMESTAMPTZ NOT NULL,
        "durationMinutes" INTEGER,
        metadata JSONB NOT NULL DEFAULT '{}'
      )
    `)
    await queryRunner.query(`CREATE INDEX idx_work_logs_agent_ts ON work_logs ("agentId", timestamp)`)
    await queryRunner.query(`CREATE INDEX idx_work_logs_task ON work_logs ("taskId")`)

    // ─── SCHEDULES ────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE schedules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "agentId" UUID,
        "teamId" UUID,
        "departmentId" UUID,
        mode VARCHAR NOT NULL DEFAULT 'scheduled',
        timezone VARCHAR NOT NULL DEFAULT 'UTC',
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
    await queryRunner.query(`CREATE INDEX idx_schedules_agent ON schedules ("agentId")`)
    await queryRunner.query(`CREATE INDEX idx_schedules_team ON schedules ("teamId")`)
    await queryRunner.query(`CREATE INDEX idx_schedules_department ON schedules ("departmentId")`)

    // ─── SHIFT RULES ──────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE shift_rules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "scheduleId" UUID NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
        "dayOfWeek" SMALLINT NOT NULL CHECK ("dayOfWeek" >= 0 AND "dayOfWeek" <= 6),
        "startTime" TIME NOT NULL,
        "endTime" TIME NOT NULL,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
    await queryRunner.query(`CREATE INDEX idx_shift_rules_schedule ON shift_rules ("scheduleId")`)

    // ─── AVAILABILITY STATES ──────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE availability_states (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "agentId" UUID NOT NULL,
        status VARCHAR NOT NULL,
        reason TEXT,
        since TIMESTAMPTZ NOT NULL,
        until TIMESTAMPTZ,
        "setByUserId" UUID,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
    await queryRunner.query(`CREATE INDEX idx_availability_states_agent ON availability_states ("agentId")`)

    // ─── HANDOVER NOTES ───────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE handover_notes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "fromAgentId" UUID NOT NULL,
        "toAgentId" UUID,
        "toTeamId" UUID,
        content TEXT NOT NULL,
        "taskIds" JSONB NOT NULL DEFAULT '[]',
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "acknowledgedAt" TIMESTAMPTZ
      )
    `)
    await queryRunner.query(`CREATE INDEX idx_handover_notes_from ON handover_notes ("fromAgentId")`)
    await queryRunner.query(`CREATE INDEX idx_handover_notes_to_agent ON handover_notes ("toAgentId")`)
    await queryRunner.query(`CREATE INDEX idx_handover_notes_to_team ON handover_notes ("toTeamId")`)

    // ─── PERFORMANCE METRICS ──────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE performance_metrics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "agentId" UUID NOT NULL,
        period VARCHAR NOT NULL,
        "periodStart" TIMESTAMPTZ NOT NULL,
        "periodEnd" TIMESTAMPTZ NOT NULL,
        "tasksCompleted" INTEGER NOT NULL DEFAULT 0,
        "tasksFailed" INTEGER NOT NULL DEFAULT 0,
        "tasksRetried" INTEGER NOT NULL DEFAULT 0,
        "successRate" FLOAT NOT NULL DEFAULT 0,
        "avgCompletionMinutes" FLOAT NOT NULL DEFAULT 0,
        "totalMinutesWorked" INTEGER NOT NULL DEFAULT 0,
        "tokensUsed" INTEGER NOT NULL DEFAULT 0,
        cost FLOAT NOT NULL DEFAULT 0,
        "qualityScore" FLOAT,
        "incidentCount" INTEGER NOT NULL DEFAULT 0,
        "approvalCount" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
    await queryRunner.query(`CREATE INDEX idx_perf_metrics_agent_period ON performance_metrics ("agentId", period, "periodStart")`)

    // ─── REVIEWS ──────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE reviews (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "agentId" UUID NOT NULL,
        "reviewerId" UUID NOT NULL,
        period VARCHAR NOT NULL,
        "periodStart" TIMESTAMPTZ NOT NULL,
        "periodEnd" TIMESTAMPTZ NOT NULL,
        "overallRating" SMALLINT NOT NULL CHECK ("overallRating" >= 1 AND "overallRating" <= 5),
        summary TEXT NOT NULL,
        strengths JSONB NOT NULL DEFAULT '[]',
        improvements JSONB NOT NULL DEFAULT '[]',
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
    await queryRunner.query(`CREATE INDEX idx_reviews_agent_period ON reviews ("agentId", "periodStart")`)

    // ─── COACHING NOTES ───────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE coaching_notes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "agentId" UUID NOT NULL,
        "authorId" UUID NOT NULL,
        content TEXT NOT NULL,
        type coaching_note_type_enum NOT NULL DEFAULT 'improvement',
        "relatedTaskId" UUID,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
    await queryRunner.query(`CREATE INDEX idx_coaching_notes_agent ON coaching_notes ("agentId")`)
    await queryRunner.query(`CREATE INDEX idx_coaching_notes_author ON coaching_notes ("authorId")`)

    // ─── PERMISSION POLICIES ──────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE permission_policies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR NOT NULL,
        "workspaceId" UUID NOT NULL,
        scope permission_scope_enum NOT NULL DEFAULT 'workspace',
        "scopeId" UUID,
        permissions JSONB NOT NULL DEFAULT '[]',
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
    await queryRunner.query(`CREATE INDEX idx_permission_policies_workspace ON permission_policies ("workspaceId")`)
    await queryRunner.query(`CREATE INDEX idx_permission_policies_scope ON permission_policies (scope, "scopeId")`)

    // ─── TEAM MEMORY ITEMS ────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE team_memory_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "teamId" UUID NOT NULL,
        title VARCHAR NOT NULL,
        content TEXT NOT NULL,
        type team_memory_item_type_enum NOT NULL DEFAULT 'note',
        tags JSONB NOT NULL DEFAULT '[]',
        "createdById" UUID,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
    await queryRunner.query(`CREATE INDEX idx_team_memory_items_team ON team_memory_items ("teamId")`)
    await queryRunner.query(`CREATE INDEX idx_team_memory_items_type ON team_memory_items (type)`)

    // ─── ALERTS ───────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE alerts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR NOT NULL,
        message TEXT NOT NULL,
        type VARCHAR NOT NULL,
        severity VARCHAR NOT NULL DEFAULT 'medium',
        "workspaceId" UUID NOT NULL,
        "agentId" UUID,
        "taskId" UUID,
        "isRead" BOOLEAN NOT NULL DEFAULT false,
        "expiresAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
    await queryRunner.query(`CREATE INDEX idx_alerts_workspace_read ON alerts ("workspaceId", "isRead")`)

    // ─── BUDGET USAGE ─────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE budget_usage (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "agentId" UUID,
        "teamId" UUID,
        "departmentId" UUID,
        "workspaceId" UUID NOT NULL,
        "tokensUsed" INTEGER NOT NULL DEFAULT 0,
        cost FLOAT NOT NULL DEFAULT 0,
        period VARCHAR NOT NULL,
        "periodStart" TIMESTAMPTZ NOT NULL,
        "periodEnd" TIMESTAMPTZ NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
    await queryRunner.query(`CREATE INDEX idx_budget_usage_workspace ON budget_usage ("workspaceId", period, "periodStart")`)
    await queryRunner.query(`CREATE INDEX idx_budget_usage_agent ON budget_usage ("agentId")`)
    await queryRunner.query(`CREATE INDEX idx_budget_usage_team ON budget_usage ("teamId")`)
    await queryRunner.query(`CREATE INDEX idx_budget_usage_dept ON budget_usage ("departmentId")`)

    // ─── REPORT SNAPSHOTS ─────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE report_snapshots (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR NOT NULL,
        type VARCHAR NOT NULL,
        "workspaceId" UUID NOT NULL,
        period VARCHAR NOT NULL,
        "periodStart" TIMESTAMPTZ NOT NULL,
        "periodEnd" TIMESTAMPTZ NOT NULL,
        data JSONB NOT NULL DEFAULT '{}',
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
    await queryRunner.query(`CREATE INDEX idx_report_snapshots_workspace ON report_snapshots ("workspaceId", type, "periodStart")`)

    // ─── BRIDGE EVENTS ────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE bridge_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "connectionId" UUID NOT NULL,
        type VARCHAR NOT NULL,
        payload JSONB NOT NULL DEFAULT '{}',
        status bridge_event_status_enum NOT NULL DEFAULT 'pending',
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "processedAt" TIMESTAMPTZ,
        error TEXT
      )
    `)
    await queryRunner.query(`CREATE INDEX idx_bridge_events_connection_created ON bridge_events ("connectionId", "createdAt")`)
    await queryRunner.query(`CREATE INDEX idx_bridge_events_status ON bridge_events (status)`)

    // ─── MANAGER RELATIONSHIPS ────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE manager_relationships (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "managerId" UUID NOT NULL,
        "reportId" UUID NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT uq_manager_report UNIQUE ("managerId", "reportId")
      )
    `)
    await queryRunner.query(`CREATE INDEX idx_manager_relationships_manager ON manager_relationships ("managerId")`)
    await queryRunner.query(`CREATE INDEX idx_manager_relationships_report ON manager_relationships ("reportId")`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop in reverse order to respect foreign key constraints
    await queryRunner.query(`DROP TABLE IF EXISTS manager_relationships`)
    await queryRunner.query(`DROP TABLE IF EXISTS bridge_events`)
    await queryRunner.query(`DROP TABLE IF EXISTS report_snapshots`)
    await queryRunner.query(`DROP TABLE IF EXISTS budget_usage`)
    await queryRunner.query(`DROP TABLE IF EXISTS alerts`)
    await queryRunner.query(`DROP TABLE IF EXISTS team_memory_items`)
    await queryRunner.query(`DROP TABLE IF EXISTS permission_policies`)
    await queryRunner.query(`DROP TABLE IF EXISTS coaching_notes`)
    await queryRunner.query(`DROP TABLE IF EXISTS reviews`)
    await queryRunner.query(`DROP TABLE IF EXISTS performance_metrics`)
    await queryRunner.query(`DROP TABLE IF EXISTS handover_notes`)
    await queryRunner.query(`DROP TABLE IF EXISTS availability_states`)
    await queryRunner.query(`DROP TABLE IF EXISTS shift_rules`)
    await queryRunner.query(`DROP TABLE IF EXISTS schedules`)
    await queryRunner.query(`DROP TABLE IF EXISTS work_logs`)
    await queryRunner.query(`DROP TABLE IF EXISTS incidents`)
    await queryRunner.query(`DROP TABLE IF EXISTS approvals`)
    await queryRunner.query(`DROP TABLE IF EXISTS run_events`)
    await queryRunner.query(`DROP TABLE IF EXISTS runs`)
    await queryRunner.query(`DROP TABLE IF EXISTS tasks`)
    await queryRunner.query(`DROP TABLE IF EXISTS messages`)
    await queryRunner.query(`DROP TABLE IF EXISTS thread_read_states`)
    await queryRunner.query(`DROP TABLE IF EXISTS threads`)
    await queryRunner.query(`DROP TABLE IF EXISTS openclaw_connections`)
    await queryRunner.query(`DROP TABLE IF EXISTS agents`)
    await queryRunner.query(`DROP TABLE IF EXISTS teams`)
    await queryRunner.query(`DROP TABLE IF EXISTS departments`)
    await queryRunner.query(`DROP TABLE IF EXISTS companies`)
    await queryRunner.query(`DROP TABLE IF EXISTS workspaces`)
    await queryRunner.query(`DROP TABLE IF EXISTS users`)

    await queryRunner.query(`DROP TYPE IF EXISTS bridge_event_status_enum`)
    await queryRunner.query(`DROP TYPE IF EXISTS coaching_note_type_enum`)
    await queryRunner.query(`DROP TYPE IF EXISTS team_memory_item_type_enum`)
    await queryRunner.query(`DROP TYPE IF EXISTS permission_scope_enum`)
    await queryRunner.query(`DROP TYPE IF EXISTS workspace_type_enum`)
  }
}
