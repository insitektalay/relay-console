import Foundation

public struct Migration {
    public var version: Int
    public var name: String
    public var up: (DatabaseService) throws -> Void
}

public let migrations: [Migration] = [
    Migration(version: 1, name: "initial_local_schema") { database in
        try database.exec("""
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          applied_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS local_profiles (
          id TEXT PRIMARY KEY,
          display_name TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS workspaces (
          id TEXT PRIMARY KEY,
          profile_id TEXT NOT NULL REFERENCES local_profiles(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          default_folder_path TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_workspaces_profile_id ON workspaces(profile_id);

        CREATE TABLE IF NOT EXISTS harnesses (
          id TEXT PRIMARY KEY,
          runtime_type TEXT NOT NULL,
          display_name TEXT NOT NULL,
          mode TEXT NOT NULL,
          config_json TEXT NOT NULL DEFAULT '{}',
          secret_reference_id TEXT,
          status TEXT NOT NULL DEFAULT 'active',
          built_in INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_harnesses_builtin_runtime ON harnesses(runtime_type, built_in) WHERE built_in = 1;

        CREATE TABLE IF NOT EXISTS agents (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          description TEXT,
          status TEXT NOT NULL DEFAULT 'active',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_agents_workspace_id ON agents(workspace_id);

        CREATE TABLE IF NOT EXISTS runtime_bindings (
          id TEXT PRIMARY KEY,
          agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
          harness_id TEXT NOT NULL REFERENCES harnesses(id),
          runtime_type TEXT NOT NULL,
          adapter_kind TEXT NOT NULL,
          routing_mode TEXT NOT NULL,
          external_agent_id TEXT,
          workspace_folder_path TEXT,
          config_json TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_runtime_bindings_agent_id ON runtime_bindings(agent_id);
        CREATE INDEX IF NOT EXISTS idx_runtime_bindings_harness_id ON runtime_bindings(harness_id);

        CREATE TABLE IF NOT EXISTS threads (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          selected_agent_id TEXT REFERENCES agents(id),
          status TEXT NOT NULL DEFAULT 'active',
          last_message_snippet TEXT,
          last_message_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_threads_workspace_status ON threads(workspace_id, status, updated_at);

        CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY,
          thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
          sender_type TEXT NOT NULL,
          sender_id TEXT,
          sender_name TEXT NOT NULL,
          content TEXT NOT NULL,
          content_format TEXT NOT NULL DEFAULT 'plain',
          metadata_json TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_messages_thread_created ON messages(thread_id, created_at);

        CREATE TABLE IF NOT EXISTS runtime_sessions (
          id TEXT PRIMARY KEY,
          thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
          agent_id TEXT NOT NULL REFERENCES agents(id),
          runtime_binding_id TEXT NOT NULL REFERENCES runtime_bindings(id),
          external_session_id TEXT,
          status TEXT NOT NULL DEFAULT 'active',
          metadata_json TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_runtime_sessions_thread_agent ON runtime_sessions(thread_id, agent_id, status);

        CREATE TABLE IF NOT EXISTS runtime_dispatches (
          id TEXT PRIMARY KEY,
          thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
          message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
          agent_id TEXT NOT NULL REFERENCES agents(id),
          harness_id TEXT NOT NULL REFERENCES harnesses(id),
          session_id TEXT NOT NULL REFERENCES runtime_sessions(id),
          status TEXT NOT NULL,
          correlation_id TEXT NOT NULL,
          input_snapshot_json TEXT NOT NULL DEFAULT '{}',
          result_snapshot_json TEXT,
          error_snapshot_json TEXT,
          started_at TEXT,
          completed_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_runtime_dispatches_thread ON runtime_dispatches(thread_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_runtime_dispatches_status ON runtime_dispatches(status, updated_at);

        CREATE TABLE IF NOT EXISTS settings (
          id TEXT PRIMARY KEY,
          scope TEXT NOT NULL,
          scope_id TEXT,
          key TEXT NOT NULL,
          value_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_settings_scope_key ON settings(scope, COALESCE(scope_id, ''), key);

        CREATE TABLE IF NOT EXISTS event_log (
          id TEXT PRIMARY KEY,
          timestamp TEXT NOT NULL,
          severity TEXT NOT NULL,
          category TEXT NOT NULL,
          message TEXT NOT NULL,
          correlation_id TEXT,
          dispatch_id TEXT,
          harness_id TEXT,
          thread_id TEXT,
          detail_json TEXT NOT NULL DEFAULT '{}'
        );
        CREATE INDEX IF NOT EXISTS idx_event_log_timestamp ON event_log(timestamp);
        CREATE INDEX IF NOT EXISTS idx_event_log_category ON event_log(category, timestamp);
        CREATE INDEX IF NOT EXISTS idx_event_log_dispatch ON event_log(dispatch_id, timestamp);

        CREATE TABLE IF NOT EXISTS secret_references (
          id TEXT PRIMARY KEY,
          scope TEXT NOT NULL,
          scope_id TEXT,
          label TEXT NOT NULL,
          provider TEXT NOT NULL,
          keychain_service TEXT NOT NULL,
          keychain_account TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS bridge_plugin_installations (
          id TEXT PRIMARY KEY,
          harness_id TEXT NOT NULL REFERENCES harnesses(id) ON DELETE CASCADE,
          plugin_id TEXT NOT NULL,
          source_type TEXT NOT NULL,
          source_ref TEXT NOT NULL,
          source_commit TEXT,
          compatibility_mode TEXT NOT NULL,
          manifest_json TEXT NOT NULL DEFAULT '{}',
          local_identity_secret_reference_id TEXT,
          registered_external_agent_ids_json TEXT NOT NULL DEFAULT '[]',
          last_checked_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_bridge_plugin_installations_harness ON bridge_plugin_installations(harness_id);
        """)
        let timestamp = nowIso()
        for (key, value) in [
            ("message.maxLength", "32000"),
            ("diagnostics.enabled", "false")
        ] {
            try database.run(
                "INSERT OR IGNORE INTO settings (id, scope, scope_id, key, value_json, created_at, updated_at) VALUES (?, 'app', NULL, ?, ?, ?, ?)",
                [.text(createRelayId("set")), .text(key), .text(value), .text(timestamp), .text(timestamp)]
            )
        }
    },
    Migration(version: 2, name: "deduplicate_hermes_workspace_agents") { _ in
        // Current Relay Console intentionally preserves multiple Hermes agents.
    },
    Migration(version: 3, name: "remove_orphan_runtime_bindings") { database in
        try database.run("""
        DELETE FROM runtime_bindings
        WHERE agent_id NOT IN (SELECT id FROM agents)
          AND id NOT IN (SELECT runtime_binding_id FROM runtime_sessions)
        """)
    },
    Migration(version: 4, name: "add_hermes_agent_profiles") { database in
        try? database.exec("ALTER TABLE runtime_bindings ADD COLUMN hermes_profile_slug TEXT;")
        try? database.exec("ALTER TABLE runtime_bindings ADD COLUMN hermes_home_path TEXT;")
        try? database.exec("ALTER TABLE runtime_bindings ADD COLUMN hermes_identity_file_path TEXT;")
        try database.exec("""
        CREATE UNIQUE INDEX IF NOT EXISTS idx_runtime_bindings_hermes_profile
          ON runtime_bindings(harness_id, hermes_profile_slug)
          WHERE hermes_profile_slug IS NOT NULL;
        CREATE UNIQUE INDEX IF NOT EXISTS idx_runtime_bindings_external_agent
          ON runtime_bindings(harness_id, external_agent_id)
          WHERE external_agent_id IS NOT NULL;
        """)
    },
    Migration(version: 5, name: "remove_generated_agent_welcome_messages") { database in
        try database.run("""
        DELETE FROM messages
        WHERE sender_type = 'agent'
          AND (
            metadata_json LIKE '%agent_welcome%'
            OR content LIKE 'Hi, fake local welcome.%'
            OR content LIKE 'Welcome to Relay Console%'
          )
        """)
    },
    Migration(version: 6, name: "profile_workspace_preferences") { database in
        try? database.exec("ALTER TABLE local_profiles ADD COLUMN email TEXT;")
        try? database.exec("ALTER TABLE local_profiles ADD COLUMN avatar_url TEXT;")
        try? database.exec("ALTER TABLE local_profiles ADD COLUMN telemetry_enabled INTEGER NOT NULL DEFAULT 1;")
        try? database.exec("ALTER TABLE local_profiles ADD COLUMN crash_reporting_enabled INTEGER NOT NULL DEFAULT 1;")
        try? database.exec("ALTER TABLE local_profiles ADD COLUMN theme TEXT NOT NULL DEFAULT 'classic';")
        try? database.exec("ALTER TABLE workspaces ADD COLUMN workspace_type TEXT NOT NULL DEFAULT 'personal';")
        try? database.exec("ALTER TABLE workspaces ADD COLUMN settings_json TEXT NOT NULL DEFAULT '{}';")
        try database.exec("""
        CREATE INDEX IF NOT EXISTS idx_local_profiles_updated_at ON local_profiles(updated_at);
        CREATE INDEX IF NOT EXISTS idx_workspaces_profile_type ON workspaces(profile_id, workspace_type);
        """)
    },
    Migration(version: 7, name: "chat_thread_session_read_state") { database in
        try? database.exec("ALTER TABLE threads ADD COLUMN thread_type TEXT NOT NULL DEFAULT 'direct';")
        try? database.exec("ALTER TABLE threads ADD COLUMN active_session_id TEXT;")
        try? database.exec("ALTER TABLE threads ADD COLUMN read_state TEXT NOT NULL DEFAULT 'read';")
        try? database.exec("ALTER TABLE threads ADD COLUMN unread_count INTEGER NOT NULL DEFAULT 0;")
        try? database.exec("ALTER TABLE threads ADD COLUMN is_archived INTEGER NOT NULL DEFAULT 0;")
        try? database.exec("ALTER TABLE threads ADD COLUMN archived_at TEXT;")
        try? database.exec("ALTER TABLE threads ADD COLUMN last_read_at TEXT;")
        try? database.exec("ALTER TABLE threads ADD COLUMN latest_wrap_up_report_id TEXT;")
        try? database.exec("ALTER TABLE messages ADD COLUMN thread_session_id TEXT;")
        try database.exec("""
        CREATE TABLE IF NOT EXISTS thread_sessions (
          id TEXT PRIMARY KEY,
          thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
          sequence_number INTEGER NOT NULL,
          status TEXT NOT NULL DEFAULT 'active',
          is_read_only INTEGER NOT NULL DEFAULT 0,
          started_at TEXT NOT NULL,
          ended_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_thread_sessions_sequence ON thread_sessions(thread_id, sequence_number);
        CREATE INDEX IF NOT EXISTS idx_thread_sessions_status ON thread_sessions(thread_id, status, updated_at);

        CREATE TABLE IF NOT EXISTS thread_participants (
          id TEXT PRIMARY KEY,
          thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
          participant_type TEXT NOT NULL,
          participant_id TEXT,
          display_name TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'member',
          is_manager INTEGER NOT NULL DEFAULT 0,
          joined_at TEXT NOT NULL,
          left_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_thread_participants_thread ON thread_participants(thread_id, left_at);
        CREATE INDEX IF NOT EXISTS idx_thread_participants_identity ON thread_participants(participant_type, participant_id);

        CREATE TABLE IF NOT EXISTS thread_read_states (
          id TEXT PRIMARY KEY,
          thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
          profile_id TEXT REFERENCES local_profiles(id) ON DELETE CASCADE,
          last_read_message_id TEXT,
          last_read_at TEXT,
          unread_count INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_thread_read_states_scope
          ON thread_read_states(thread_id, COALESCE(profile_id, ''));
        CREATE INDEX IF NOT EXISTS idx_thread_read_states_profile ON thread_read_states(profile_id, updated_at);

        CREATE TABLE IF NOT EXISTS thread_wrap_up_reports (
          id TEXT PRIMARY KEY,
          thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
          session_id TEXT REFERENCES thread_sessions(id) ON DELETE SET NULL,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          status TEXT NOT NULL DEFAULT 'pending',
          title TEXT,
          markdown TEXT,
          summary TEXT,
          metadata_json TEXT NOT NULL DEFAULT '{}',
          message_count INTEGER NOT NULL DEFAULT 0,
          provider TEXT,
          model TEXT,
          error_json TEXT,
          completed_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_thread_wrap_up_reports_thread ON thread_wrap_up_reports(thread_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_thread_wrap_up_reports_workspace ON thread_wrap_up_reports(workspace_id, status, updated_at);

        CREATE INDEX IF NOT EXISTS idx_threads_workspace_type_status ON threads(workspace_id, thread_type, status, updated_at);
        CREATE INDEX IF NOT EXISTS idx_threads_active_session ON threads(active_session_id);
        CREATE INDEX IF NOT EXISTS idx_threads_archive_state ON threads(workspace_id, is_archived, updated_at);
        CREATE INDEX IF NOT EXISTS idx_messages_thread_session ON messages(thread_session_id, created_at);
        """)
        try database.run("""
        INSERT OR IGNORE INTO thread_sessions (
          id, thread_id, sequence_number, status, is_read_only, started_at, ended_at, created_at, updated_at
        )
        SELECT
          'chs-' || id,
          id,
          1,
          CASE WHEN status = 'archived' THEN 'archived' ELSE 'active' END,
          CASE WHEN status = 'archived' THEN 1 ELSE 0 END,
          created_at,
          CASE WHEN status = 'archived' THEN updated_at ELSE NULL END,
          created_at,
          updated_at
        FROM threads
        """)
        try database.run("""
        UPDATE threads
        SET active_session_id = CASE WHEN status = 'archived' THEN NULL ELSE 'chs-' || id END,
            is_archived = CASE WHEN status = 'archived' THEN 1 ELSE 0 END,
            archived_at = CASE WHEN status = 'archived' THEN COALESCE(archived_at, updated_at) ELSE archived_at END
        WHERE active_session_id IS NULL
        """)
        try database.run("""
        UPDATE messages
        SET thread_session_id = 'chs-' || thread_id
        WHERE thread_session_id IS NULL
          AND thread_id IN (SELECT id FROM threads)
        """)
    },
    Migration(version: 8, name: "chat_composer_drafts") { database in
        try database.exec("""
        CREATE TABLE IF NOT EXISTS chat_composer_drafts (
          id TEXT PRIMARY KEY,
          thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
          profile_id TEXT REFERENCES local_profiles(id) ON DELETE CASCADE,
          content TEXT NOT NULL DEFAULT '',
          metadata_json TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_composer_drafts_scope
          ON chat_composer_drafts(thread_id, COALESCE(profile_id, ''));
        CREATE INDEX IF NOT EXISTS idx_chat_composer_drafts_updated
          ON chat_composer_drafts(thread_id, updated_at);
        """)
    },
    Migration(version: 9, name: "chat_attachments_document_references") { database in
        try database.exec("""
        CREATE TABLE IF NOT EXISTS chat_attachments (
          id TEXT PRIMARY KEY,
          thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
          message_id TEXT REFERENCES messages(id) ON DELETE SET NULL,
          profile_id TEXT REFERENCES local_profiles(id) ON DELETE SET NULL,
          file_name TEXT NOT NULL,
          mime_type TEXT NOT NULL,
          byte_size INTEGER NOT NULL DEFAULT 0,
          sha256 TEXT NOT NULL,
          kind TEXT NOT NULL DEFAULT 'file',
          status TEXT NOT NULL DEFAULT 'staged',
          progress INTEGER NOT NULL DEFAULT 0,
          provenance_json TEXT NOT NULL DEFAULT '{}',
          error_json TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_chat_attachments_thread_status
          ON chat_attachments(thread_id, status, updated_at);
        CREATE INDEX IF NOT EXISTS idx_chat_attachments_message
          ON chat_attachments(message_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_chat_attachments_profile
          ON chat_attachments(thread_id, profile_id, message_id, updated_at);

        CREATE TABLE IF NOT EXISTS chat_document_references (
          id TEXT PRIMARY KEY,
          message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          reference_kind TEXT NOT NULL DEFAULT 'document',
          display_path TEXT,
          token_count INTEGER,
          is_sensitive INTEGER NOT NULL DEFAULT 0,
          is_redacted INTEGER NOT NULL DEFAULT 0,
          metadata_json TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_chat_document_references_message
          ON chat_document_references(message_id, created_at);
        """)
    },
    Migration(version: 10, name: "agents_org_provisioning_foundation") { database in
        try? database.exec("ALTER TABLE agents ADD COLUMN role TEXT;")
        try? database.exec("ALTER TABLE agents ADD COLUMN source TEXT;")
        try? database.exec("ALTER TABLE agents ADD COLUMN external_id TEXT;")
        try? database.exec("ALTER TABLE agents ADD COLUMN group_type TEXT;")
        try? database.exec("ALTER TABLE agents ADD COLUMN family_label TEXT;")
        try? database.exec("ALTER TABLE agents ADD COLUMN company_id TEXT;")
        try? database.exec("ALTER TABLE agents ADD COLUMN department_id TEXT;")
        try? database.exec("ALTER TABLE agents ADD COLUMN team_id TEXT;")
        try? database.exec("ALTER TABLE agents ADD COLUMN manager_agent_id TEXT;")
        try? database.exec("ALTER TABLE agents ADD COLUMN classification TEXT;")
        try? database.exec("ALTER TABLE agents ADD COLUMN model TEXT;")
        try? database.exec("ALTER TABLE agents ADD COLUMN response_presentation TEXT;")
        try? database.exec("ALTER TABLE agents ADD COLUMN provisioning_status TEXT;")
        try? database.exec("ALTER TABLE agents ADD COLUMN current_task_id TEXT;")
        try? database.exec("ALTER TABLE agents ADD COLUMN metrics_json TEXT NOT NULL DEFAULT '{}';")
        try? database.exec("ALTER TABLE agents ADD COLUMN budget_json TEXT NOT NULL DEFAULT '{}';")
        try database.exec("""
        CREATE TABLE IF NOT EXISTS companies (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          industry TEXT,
          status TEXT NOT NULL DEFAULT 'active',
          metadata_json TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_companies_workspace
          ON companies(workspace_id, status, updated_at);

        CREATE TABLE IF NOT EXISTS departments (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          company_id TEXT REFERENCES companies(id) ON DELETE SET NULL,
          name TEXT NOT NULL,
          color_hex TEXT,
          head_agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
          agentops_room_id TEXT,
          status TEXT NOT NULL DEFAULT 'active',
          metadata_json TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_departments_workspace
          ON departments(workspace_id, status, updated_at);
        CREATE INDEX IF NOT EXISTS idx_departments_company
          ON departments(company_id, status);

        CREATE TABLE IF NOT EXISTS teams (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
          name TEXT NOT NULL,
          lead_agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
          agentops_room_id TEXT,
          status TEXT NOT NULL DEFAULT 'active',
          metadata_json TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_teams_workspace
          ON teams(workspace_id, status, updated_at);
        CREATE INDEX IF NOT EXISTS idx_teams_department
          ON teams(department_id, status);

        CREATE TABLE IF NOT EXISTS agent_manager_relationships (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          manager_agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
          report_agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
          relationship_type TEXT NOT NULL DEFAULT 'manager',
          metadata_json TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_manager_relationship_unique
          ON agent_manager_relationships(manager_agent_id, report_agent_id, relationship_type);
        CREATE INDEX IF NOT EXISTS idx_agent_manager_relationship_workspace
          ON agent_manager_relationships(workspace_id, relationship_type);

        CREATE TABLE IF NOT EXISTS agent_provisioning_jobs (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          requested_by_profile_id TEXT REFERENCES local_profiles(id) ON DELETE SET NULL,
          harness_id TEXT REFERENCES harnesses(id) ON DELETE SET NULL,
          runtime_type TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'queued',
          stage TEXT,
          message TEXT,
          error_json TEXT,
          created_agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
          external_agent_id TEXT,
          payload_json TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          completed_at TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_agent_provisioning_jobs_workspace
          ON agent_provisioning_jobs(workspace_id, status, updated_at);
        CREATE INDEX IF NOT EXISTS idx_agent_provisioning_jobs_agent
          ON agent_provisioning_jobs(created_agent_id, updated_at);
        """)
    },

    Migration(version: 11, name: "agent_identity_preferences") { database in
        try database.exec("""
        CREATE TABLE IF NOT EXISTS agent_preferences (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
          cosmetic_display_name TEXT,
          avatar_reference TEXT,
          avatar_state TEXT NOT NULL DEFAULT 'fallback',
          response_presentation TEXT NOT NULL DEFAULT 'markdown',
          metadata_json TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_preferences_agent
          ON agent_preferences(agent_id);
        CREATE INDEX IF NOT EXISTS idx_agent_preferences_workspace
          ON agent_preferences(workspace_id, updated_at);
        """)
    },

    Migration(version: 12, name: "agent_provisioning_job_lifecycle") { database in
        try? database.exec("ALTER TABLE agent_provisioning_jobs ADD COLUMN runtime_binding_id TEXT REFERENCES runtime_bindings(id) ON DELETE SET NULL;")
        try? database.exec("ALTER TABLE agent_provisioning_jobs ADD COLUMN files_metadata_json TEXT NOT NULL DEFAULT '{}';")
        try database.exec("""
        CREATE INDEX IF NOT EXISTS idx_agent_provisioning_jobs_binding
          ON agent_provisioning_jobs(runtime_binding_id, updated_at);
        """)
    },

    Migration(version: 13, name: "agent_work_dashboard_read_models") { database in
        try database.exec("""
        CREATE TABLE IF NOT EXISTS agent_tasks (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          assigned_agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
          target_agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
          target_team_id TEXT REFERENCES teams(id) ON DELETE SET NULL,
          title TEXT NOT NULL,
          message TEXT NOT NULL,
          priority TEXT NOT NULL DEFAULT 'normal',
          target_type TEXT NOT NULL DEFAULT 'direct',
          status TEXT NOT NULL DEFAULT 'queued',
          requires_approval INTEGER NOT NULL DEFAULT 0,
          scheduled_at TEXT,
          time_zone TEXT,
          recurrence TEXT,
          last_error TEXT,
          thread_id TEXT REFERENCES threads(id) ON DELETE SET NULL,
          metadata_json TEXT NOT NULL DEFAULT '{}',
          archived_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_agent_tasks_workspace_status
          ON agent_tasks(workspace_id, status, updated_at);
        CREATE INDEX IF NOT EXISTS idx_agent_tasks_assigned_agent
          ON agent_tasks(assigned_agent_id, status, scheduled_at);
        CREATE INDEX IF NOT EXISTS idx_agent_tasks_target_agent
          ON agent_tasks(target_agent_id, status, scheduled_at);
        CREATE INDEX IF NOT EXISTS idx_agent_tasks_target_team
          ON agent_tasks(target_team_id, status, scheduled_at);

        CREATE TABLE IF NOT EXISTS agent_task_runs (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          task_id TEXT NOT NULL REFERENCES agent_tasks(id) ON DELETE CASCADE,
          agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
          dispatch_id TEXT REFERENCES runtime_dispatches(id) ON DELETE SET NULL,
          status TEXT NOT NULL DEFAULT 'queued',
          tokens_used INTEGER NOT NULL DEFAULT 0,
          started_at TEXT,
          completed_at TEXT,
          error_json TEXT,
          metadata_json TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_agent_task_runs_task
          ON agent_task_runs(task_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_agent_task_runs_workspace
          ON agent_task_runs(workspace_id, status, updated_at);
        CREATE INDEX IF NOT EXISTS idx_agent_task_runs_agent
          ON agent_task_runs(agent_id, status, updated_at);

        CREATE TABLE IF NOT EXISTS agent_team_memory (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          memory_type TEXT NOT NULL DEFAULT 'note',
          content TEXT NOT NULL,
          is_sensitive INTEGER NOT NULL DEFAULT 0,
          metadata_json TEXT NOT NULL DEFAULT '{}',
          created_by_agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_agent_team_memory_team
          ON agent_team_memory(team_id, updated_at);
        CREATE INDEX IF NOT EXISTS idx_agent_team_memory_workspace
          ON agent_team_memory(workspace_id, updated_at);

        CREATE TABLE IF NOT EXISTS agent_team_handovers (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
          from_agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          is_sensitive INTEGER NOT NULL DEFAULT 0,
          metadata_json TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_agent_team_handovers_team
          ON agent_team_handovers(team_id, updated_at);
        CREATE INDEX IF NOT EXISTS idx_agent_team_handovers_workspace
          ON agent_team_handovers(workspace_id, updated_at);
        """)
    },

    Migration(version: 14, name: "runtime_dashboard_snapshots") { database in
        try database.exec("""
        CREATE TABLE IF NOT EXISTS runtime_dashboard_snapshots (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          state TEXT NOT NULL,
          refreshed_at TEXT NOT NULL,
          last_successful_refresh_at TEXT,
          stale_after_seconds INTEGER NOT NULL DEFAULT 300,
          local_status_state TEXT NOT NULL,
          local_status_reason TEXT NOT NULL,
          disabled_reason TEXT,
          error_json TEXT,
          retry_available INTEGER NOT NULL DEFAULT 0,
          read_only INTEGER NOT NULL DEFAULT 1,
          snapshot_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_runtime_dashboard_snapshots_workspace
          ON runtime_dashboard_snapshots(workspace_id, refreshed_at);
        CREATE INDEX IF NOT EXISTS idx_runtime_dashboard_snapshots_state
          ON runtime_dashboard_snapshots(workspace_id, state, updated_at);

        CREATE TABLE IF NOT EXISTS runtime_dashboard_rows (
          id TEXT PRIMARY KEY,
          snapshot_id TEXT NOT NULL REFERENCES runtime_dashboard_snapshots(id) ON DELETE CASCADE,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          row_kind TEXT NOT NULL,
          runtime_type TEXT,
          harness_id TEXT REFERENCES harnesses(id) ON DELETE SET NULL,
          connected_app_id TEXT,
          display_name TEXT NOT NULL,
          status TEXT NOT NULL,
          reachability TEXT NOT NULL,
          active_dispatch_count INTEGER NOT NULL DEFAULT 0,
          failed_dispatch_count INTEGER NOT NULL DEFAULT 0,
          retryable_dispatch_count INTEGER NOT NULL DEFAULT 0,
          assigned_agent_count INTEGER NOT NULL DEFAULT 0,
          latest_dispatch_id TEXT,
          last_activity_at TEXT,
          row_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_runtime_dashboard_rows_snapshot
          ON runtime_dashboard_rows(snapshot_id, row_kind);
        CREATE INDEX IF NOT EXISTS idx_runtime_dashboard_rows_workspace
          ON runtime_dashboard_rows(workspace_id, row_kind, updated_at);
        CREATE INDEX IF NOT EXISTS idx_runtime_dashboard_rows_harness
          ON runtime_dashboard_rows(harness_id, status, updated_at);
        """)
    },

    Migration(version: 15, name: "runtime_action_capabilities") { database in
        try database.exec("""
        CREATE TABLE IF NOT EXISTS runtime_action_capabilities (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          action_kind TEXT NOT NULL,
          display_name TEXT NOT NULL,
          availability TEXT NOT NULL,
          state_kind TEXT NOT NULL,
          reason_code TEXT NOT NULL,
          message TEXT NOT NULL,
          recovery TEXT,
          scope_type TEXT NOT NULL,
          runtime_type TEXT,
          harness_id TEXT REFERENCES harnesses(id) ON DELETE SET NULL,
          dispatch_id TEXT REFERENCES runtime_dispatches(id) ON DELETE SET NULL,
          agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
          destructive INTEGER NOT NULL DEFAULT 0,
          dry_run_supported INTEGER NOT NULL DEFAULT 0,
          execution_supported INTEGER NOT NULL DEFAULT 0,
          read_only INTEGER NOT NULL DEFAULT 1,
          stale_after_seconds INTEGER NOT NULL DEFAULT 300,
          evaluated_at TEXT NOT NULL,
          source TEXT NOT NULL,
          redaction_status TEXT NOT NULL,
          capability_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_runtime_action_capabilities_workspace
          ON runtime_action_capabilities(workspace_id, action_kind, updated_at);
        CREATE INDEX IF NOT EXISTS idx_runtime_action_capabilities_dispatch
          ON runtime_action_capabilities(dispatch_id, action_kind);
        CREATE INDEX IF NOT EXISTS idx_runtime_action_capabilities_harness
          ON runtime_action_capabilities(harness_id, action_kind);

        CREATE TABLE IF NOT EXISTS runtime_action_runs (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          capability_id TEXT REFERENCES runtime_action_capabilities(id) ON DELETE SET NULL,
          action_kind TEXT NOT NULL,
          status TEXT NOT NULL,
          state_kind TEXT NOT NULL,
          reason_code TEXT NOT NULL,
          idempotency_key TEXT NOT NULL,
          actor_id TEXT NOT NULL,
          scope_type TEXT NOT NULL,
          runtime_type TEXT,
          harness_id TEXT REFERENCES harnesses(id) ON DELETE SET NULL,
          dispatch_id TEXT REFERENCES runtime_dispatches(id) ON DELETE SET NULL,
          agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
          destructive INTEGER NOT NULL DEFAULT 0,
          dry_run INTEGER NOT NULL DEFAULT 0,
          execution_attempted INTEGER NOT NULL DEFAULT 0,
          request_json TEXT NOT NULL DEFAULT '{}',
          result_json TEXT,
          failure_json TEXT,
          retention_expires_at TEXT,
          action_run_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          completed_at TEXT,
          redaction_status TEXT NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_runtime_action_runs_idempotency
          ON runtime_action_runs(workspace_id, action_kind, idempotency_key);
        CREATE INDEX IF NOT EXISTS idx_runtime_action_runs_workspace
          ON runtime_action_runs(workspace_id, status, updated_at);
        CREATE INDEX IF NOT EXISTS idx_runtime_action_runs_dispatch
          ON runtime_action_runs(dispatch_id, action_kind, updated_at);
        CREATE INDEX IF NOT EXISTS idx_runtime_action_runs_retention
          ON runtime_action_runs(workspace_id, retention_expires_at);
        """)
    },

    Migration(version: 16, name: "runtime_recovery_records") { database in
        try database.exec("""
        CREATE TABLE IF NOT EXISTS runtime_structured_jobs (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          dispatch_id TEXT REFERENCES runtime_dispatches(id) ON DELETE SET NULL,
          action_run_id TEXT REFERENCES runtime_action_runs(id) ON DELETE SET NULL,
          job_type TEXT NOT NULL,
          status TEXT NOT NULL,
          title TEXT NOT NULL,
          retryable INTEGER NOT NULL DEFAULT 0,
          context_usage_json TEXT,
          participant_health_json TEXT NOT NULL DEFAULT '[]',
          follow_up_failure_json TEXT,
          recovery_json TEXT NOT NULL DEFAULT '{}',
          source_host_excluded INTEGER NOT NULL DEFAULT 1,
          metadata_json TEXT NOT NULL DEFAULT '{}',
          structured_job_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          completed_at TEXT,
          redaction_status TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_runtime_structured_jobs_workspace
          ON runtime_structured_jobs(workspace_id, status, updated_at);
        CREATE INDEX IF NOT EXISTS idx_runtime_structured_jobs_dispatch
          ON runtime_structured_jobs(dispatch_id, status, updated_at);
        CREATE INDEX IF NOT EXISTS idx_runtime_structured_jobs_action_run
          ON runtime_structured_jobs(action_run_id, status);

        CREATE TABLE IF NOT EXISTS runtime_missing_tool_events (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          dispatch_id TEXT REFERENCES runtime_dispatches(id) ON DELETE SET NULL,
          agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
          tool_name TEXT NOT NULL,
          status TEXT NOT NULL,
          request_json TEXT NOT NULL DEFAULT '{}',
          auto_install_attempted INTEGER NOT NULL DEFAULT 0,
          fake_grant_created INTEGER NOT NULL DEFAULT 0,
          source TEXT NOT NULL,
          missing_tool_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          redaction_status TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_runtime_missing_tools_workspace
          ON runtime_missing_tool_events(workspace_id, status, updated_at);
        CREATE INDEX IF NOT EXISTS idx_runtime_missing_tools_dispatch
          ON runtime_missing_tool_events(dispatch_id, status, updated_at);
        CREATE INDEX IF NOT EXISTS idx_runtime_missing_tools_agent
          ON runtime_missing_tool_events(agent_id, status, updated_at);

        CREATE TABLE IF NOT EXISTS runtime_recovery_records (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          dispatch_id TEXT REFERENCES runtime_dispatches(id) ON DELETE SET NULL,
          job_id TEXT REFERENCES runtime_structured_jobs(id) ON DELETE SET NULL,
          state TEXT NOT NULL,
          retryable INTEGER NOT NULL DEFAULT 0,
          reason_code TEXT NOT NULL,
          message TEXT NOT NULL,
          follow_up_action TEXT,
          source_host_excluded INTEGER NOT NULL DEFAULT 1,
          recovery_json TEXT NOT NULL DEFAULT '{}',
          recovery_record_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          resolved_at TEXT,
          redaction_status TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_runtime_recovery_workspace
          ON runtime_recovery_records(workspace_id, state, updated_at);
        CREATE INDEX IF NOT EXISTS idx_runtime_recovery_dispatch
          ON runtime_recovery_records(dispatch_id, state, updated_at);
        CREATE INDEX IF NOT EXISTS idx_runtime_recovery_job
          ON runtime_recovery_records(job_id, state, updated_at);
        """)
    },

    Migration(version: 17, name: "applications_marketplace_catalog") { database in
        try database.exec("""
        CREATE TABLE IF NOT EXISTS applications_navigation_records (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          section_key TEXT NOT NULL,
          label TEXT NOT NULL,
          policy TEXT NOT NULL,
          state_kind TEXT,
          reason_code TEXT,
          visible_to_roles_json TEXT NOT NULL DEFAULT '[]',
          message TEXT NOT NULL,
          navigation_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          redaction_status TEXT NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_applications_navigation_unique
          ON applications_navigation_records(workspace_id, section_key);
        CREATE INDEX IF NOT EXISTS idx_applications_navigation_policy
          ON applications_navigation_records(workspace_id, policy, updated_at);

        CREATE TABLE IF NOT EXISTS marketplace_catalog_apps (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          slug TEXT NOT NULL,
          name TEXT NOT NULL,
          summary TEXT NOT NULL,
          description TEXT NOT NULL,
          category TEXT NOT NULL,
          source_type TEXT NOT NULL,
          risk_level TEXT NOT NULL,
          auth_type TEXT NOT NULL,
          connection_type TEXT NOT NULL,
          capabilities_json TEXT NOT NULL DEFAULT '[]',
          runtime_support_json TEXT NOT NULL DEFAULT '[]',
          role_manifest_json TEXT NOT NULL DEFAULT '{}',
          availability TEXT NOT NULL,
          availability_reason TEXT,
          connection_state TEXT NOT NULL,
          install_state TEXT NOT NULL,
          installed_agent_count INTEGER NOT NULL DEFAULT 0,
          installed_agent_ids_json TEXT NOT NULL DEFAULT '[]',
          docs_url TEXT,
          website_url TEXT,
          beta_notice TEXT,
          icon_initials TEXT NOT NULL,
          icon_color_name TEXT NOT NULL,
          read_only INTEGER NOT NULL DEFAULT 1,
          local_app_excluded INTEGER NOT NULL DEFAULT 0,
          review_excluded INTEGER NOT NULL DEFAULT 0,
          app_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          redaction_status TEXT NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_marketplace_catalog_apps_slug
          ON marketplace_catalog_apps(workspace_id, slug);
        CREATE INDEX IF NOT EXISTS idx_marketplace_catalog_apps_category
          ON marketplace_catalog_apps(workspace_id, category, name);
        CREATE INDEX IF NOT EXISTS idx_marketplace_catalog_apps_risk
          ON marketplace_catalog_apps(workspace_id, risk_level, name);
        CREATE INDEX IF NOT EXISTS idx_marketplace_catalog_apps_state
          ON marketplace_catalog_apps(workspace_id, availability, connection_state, install_state);
        CREATE INDEX IF NOT EXISTS idx_marketplace_catalog_apps_source
          ON marketplace_catalog_apps(workspace_id, source_type, updated_at);

        CREATE TABLE IF NOT EXISTS applications_catalog_snapshots (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          state TEXT NOT NULL,
          view TEXT NOT NULL,
          search_query TEXT NOT NULL DEFAULT '',
          selected_category TEXT,
          risk_level TEXT,
          selected_app_id TEXT REFERENCES marketplace_catalog_apps(id) ON DELETE SET NULL,
          response_count INTEGER NOT NULL DEFAULT 0,
          demo_fallback_used INTEGER NOT NULL DEFAULT 0,
          read_only INTEGER NOT NULL DEFAULT 1,
          snapshot_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          redaction_status TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_applications_catalog_snapshots_workspace
          ON applications_catalog_snapshots(workspace_id, updated_at);
        CREATE INDEX IF NOT EXISTS idx_applications_catalog_snapshots_state
          ON applications_catalog_snapshots(workspace_id, state, updated_at);
        """)
    },

    Migration(version: 18, name: "applications_provider_connections") { database in
        try database.exec("""
        CREATE TABLE IF NOT EXISTS applications_provider_connections (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          app_id TEXT NOT NULL REFERENCES marketplace_catalog_apps(id) ON DELETE CASCADE,
          app_slug TEXT NOT NULL,
          provider_key TEXT NOT NULL,
          provider_name TEXT NOT NULL,
          connection_status TEXT NOT NULL,
          authorization_state TEXT NOT NULL,
          credential_ownership TEXT NOT NULL,
          user_owned_credentials_required INTEGER NOT NULL DEFAULT 0,
          credential_requirements_json TEXT NOT NULL DEFAULT '[]',
          secret_reference_ids_json TEXT NOT NULL DEFAULT '[]',
          account_label TEXT,
          connected_handle TEXT,
          callback_url TEXT,
          required_scopes_json TEXT NOT NULL DEFAULT '[]',
          granted_scopes_json TEXT NOT NULL DEFAULT '[]',
          selected_capabilities_json TEXT NOT NULL DEFAULT '[]',
          health_json TEXT NOT NULL DEFAULT '{}',
          sender_identities_json TEXT NOT NULL DEFAULT '[]',
          install_policy TEXT,
          last_checked_at TEXT,
          last_error TEXT,
          manual_evidence_note TEXT,
          reauthorize_required INTEGER NOT NULL DEFAULT 0,
          disconnecting INTEGER NOT NULL DEFAULT 0,
          beta_blocked INTEGER NOT NULL DEFAULT 0,
          connection_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          redaction_status TEXT NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_applications_provider_connections_unique
          ON applications_provider_connections(workspace_id, app_id, provider_key);
        CREATE INDEX IF NOT EXISTS idx_applications_provider_connections_app
          ON applications_provider_connections(workspace_id, app_id, updated_at);
        CREATE INDEX IF NOT EXISTS idx_applications_provider_connections_status
          ON applications_provider_connections(workspace_id, connection_status, updated_at);
        CREATE INDEX IF NOT EXISTS idx_applications_provider_connections_auth
          ON applications_provider_connections(workspace_id, authorization_state, updated_at);
        CREATE INDEX IF NOT EXISTS idx_applications_provider_connections_secret_refs
          ON applications_provider_connections(workspace_id, credential_ownership, user_owned_credentials_required);

        CREATE TABLE IF NOT EXISTS applications_provider_authorization_flows (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          app_id TEXT NOT NULL REFERENCES marketplace_catalog_apps(id) ON DELETE CASCADE,
          connection_id TEXT REFERENCES applications_provider_connections(id) ON DELETE SET NULL,
          provider_key TEXT NOT NULL,
          state TEXT NOT NULL,
          callback_url TEXT,
          authorization_url TEXT,
          deep_link_url TEXT,
          manual_evidence_note TEXT,
          error_message TEXT,
          started_by_actor_id TEXT NOT NULL,
          started_at TEXT NOT NULL,
          completed_at TEXT,
          flow_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          redaction_status TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_applications_provider_authorization_workspace
          ON applications_provider_authorization_flows(workspace_id, state, updated_at);
        CREATE INDEX IF NOT EXISTS idx_applications_provider_authorization_app
          ON applications_provider_authorization_flows(workspace_id, app_id, updated_at);
        CREATE INDEX IF NOT EXISTS idx_applications_provider_authorization_connection
          ON applications_provider_authorization_flows(connection_id, state, updated_at);

        CREATE TABLE IF NOT EXISTS applications_provider_connection_snapshots (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          app_id TEXT REFERENCES marketplace_catalog_apps(id) ON DELETE SET NULL,
          state TEXT NOT NULL,
          connection_count INTEGER NOT NULL DEFAULT 0,
          authorization_flow_count INTEGER NOT NULL DEFAULT 0,
          selected_connection_id TEXT REFERENCES applications_provider_connections(id) ON DELETE SET NULL,
          read_only INTEGER NOT NULL DEFAULT 1,
          snapshot_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          redaction_status TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_applications_provider_snapshots_workspace
          ON applications_provider_connection_snapshots(workspace_id, updated_at);
        CREATE INDEX IF NOT EXISTS idx_applications_provider_snapshots_app
          ON applications_provider_connection_snapshots(workspace_id, app_id, updated_at);
        CREATE INDEX IF NOT EXISTS idx_applications_provider_snapshots_state
          ON applications_provider_connection_snapshots(workspace_id, state, updated_at);
        """)
    },

    Migration(version: 19, name: "applications_marketplace_installs") { database in
        try database.exec("""
        CREATE TABLE IF NOT EXISTS applications_marketplace_installs (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          app_id TEXT NOT NULL REFERENCES marketplace_catalog_apps(id) ON DELETE CASCADE,
          app_slug TEXT NOT NULL,
          connection_id TEXT REFERENCES applications_provider_connections(id) ON DELETE SET NULL,
          agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
          runtime_binding_id TEXT NOT NULL REFERENCES runtime_bindings(id) ON DELETE CASCADE,
          harness_id TEXT NOT NULL REFERENCES harnesses(id) ON DELETE CASCADE,
          runtime_type TEXT NOT NULL,
          role_id TEXT NOT NULL,
          role_label TEXT NOT NULL,
          selected_capabilities_json TEXT NOT NULL DEFAULT '[]',
          approval_profile_id TEXT,
          runtime_format TEXT NOT NULL,
          target_mode TEXT NOT NULL,
          risk_acknowledged INTEGER NOT NULL DEFAULT 0,
          install_status TEXT NOT NULL,
          drift_status TEXT NOT NULL,
          last_installed_at TEXT,
          removed_at TEXT,
          failure_message TEXT,
          metadata_json TEXT NOT NULL DEFAULT '{}',
          created_by_actor_id TEXT NOT NULL,
          install_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          redaction_status TEXT NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_applications_marketplace_installs_active_target
          ON applications_marketplace_installs(workspace_id, app_id, agent_id, role_id, runtime_format)
          WHERE install_status IN ('requested', 'installed');
        CREATE INDEX IF NOT EXISTS idx_applications_marketplace_installs_workspace
          ON applications_marketplace_installs(workspace_id, install_status, updated_at);
        CREATE INDEX IF NOT EXISTS idx_applications_marketplace_installs_app
          ON applications_marketplace_installs(workspace_id, app_id, updated_at);
        CREATE INDEX IF NOT EXISTS idx_applications_marketplace_installs_agent
          ON applications_marketplace_installs(workspace_id, agent_id, role_id, updated_at);
        CREATE INDEX IF NOT EXISTS idx_applications_marketplace_installs_drift
          ON applications_marketplace_installs(workspace_id, drift_status, updated_at);

        CREATE TABLE IF NOT EXISTS applications_marketplace_install_snapshots (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          app_id TEXT REFERENCES marketplace_catalog_apps(id) ON DELETE SET NULL,
          state TEXT NOT NULL,
          install_count INTEGER NOT NULL DEFAULT 0,
          compatible_agent_count INTEGER NOT NULL DEFAULT 0,
          selected_install_id TEXT REFERENCES applications_marketplace_installs(id) ON DELETE SET NULL,
          read_only INTEGER NOT NULL DEFAULT 1,
          snapshot_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          redaction_status TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_applications_marketplace_install_snapshots_workspace
          ON applications_marketplace_install_snapshots(workspace_id, updated_at);
        CREATE INDEX IF NOT EXISTS idx_applications_marketplace_install_snapshots_app
          ON applications_marketplace_install_snapshots(workspace_id, app_id, updated_at);
        CREATE INDEX IF NOT EXISTS idx_applications_marketplace_install_snapshots_state
          ON applications_marketplace_install_snapshots(workspace_id, state, updated_at);
        """)
    },

    Migration(version: 20, name: "applications_needed_tools") { database in
        try database.exec("""
        CREATE TABLE IF NOT EXISTS applications_tool_requests (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          requested_capability TEXT NOT NULL,
          normalized_capability TEXT NOT NULL,
          app_id TEXT REFERENCES marketplace_catalog_apps(id) ON DELETE SET NULL,
          app_slug TEXT,
          agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
          thread_id TEXT REFERENCES threads(id) ON DELETE SET NULL,
          dispatch_id TEXT REFERENCES runtime_dispatches(id) ON DELETE SET NULL,
          missing_tool_event_id TEXT REFERENCES runtime_missing_tool_events(id) ON DELETE SET NULL,
          related_task_id TEXT,
          related_record_id TEXT,
          campaign TEXT,
          reason TEXT NOT NULL,
          required_action TEXT NOT NULL,
          evidence TEXT,
          request_status TEXT NOT NULL,
          policy_allowed INTEGER NOT NULL DEFAULT 1,
          tool_available INTEGER NOT NULL DEFAULT 0,
          tool_connected INTEGER NOT NULL DEFAULT 0,
          tool_granted INTEGER NOT NULL DEFAULT 0,
          availability_state TEXT NOT NULL,
          suggested_apps_json TEXT NOT NULL DEFAULT '[]',
          metadata_json TEXT NOT NULL DEFAULT '{}',
          request_json TEXT NOT NULL,
          requested_at TEXT NOT NULL,
          last_seen_at TEXT NOT NULL,
          resolved_at TEXT,
          resolution_note TEXT,
          created_by_actor_id TEXT,
          updated_by_actor_id TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          redaction_status TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_applications_tool_requests_workspace
          ON applications_tool_requests(workspace_id, request_status, updated_at);
        CREATE INDEX IF NOT EXISTS idx_applications_tool_requests_capability
          ON applications_tool_requests(workspace_id, normalized_capability, request_status, updated_at);
        CREATE INDEX IF NOT EXISTS idx_applications_tool_requests_app
          ON applications_tool_requests(workspace_id, app_id, request_status, updated_at);
        CREATE INDEX IF NOT EXISTS idx_applications_tool_requests_agent
          ON applications_tool_requests(workspace_id, agent_id, request_status, updated_at);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_applications_tool_requests_open_dedupe
          ON applications_tool_requests(workspace_id, normalized_capability, COALESCE(app_slug, ''), COALESCE(agent_id, ''), COALESCE(related_record_id, ''))
          WHERE request_status IN ('requested', 'connected', 'granted', 'unavailable');

        CREATE TABLE IF NOT EXISTS applications_needed_tools_snapshots (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          app_id TEXT REFERENCES marketplace_catalog_apps(id) ON DELETE SET NULL,
          state TEXT NOT NULL,
          query_status TEXT NOT NULL,
          open_request_count INTEGER NOT NULL DEFAULT 0,
          connected_count INTEGER NOT NULL DEFAULT 0,
          granted_count INTEGER NOT NULL DEFAULT 0,
          unavailable_count INTEGER NOT NULL DEFAULT 0,
          selected_request_id TEXT REFERENCES applications_tool_requests(id) ON DELETE SET NULL,
          read_only INTEGER NOT NULL DEFAULT 1,
          snapshot_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          redaction_status TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_applications_needed_tools_snapshots_workspace
          ON applications_needed_tools_snapshots(workspace_id, updated_at);
        CREATE INDEX IF NOT EXISTS idx_applications_needed_tools_snapshots_app
          ON applications_needed_tools_snapshots(workspace_id, app_id, updated_at);
        CREATE INDEX IF NOT EXISTS idx_applications_needed_tools_snapshots_state
          ON applications_needed_tools_snapshots(workspace_id, state, updated_at);
        """)
    },

    Migration(version: 21, name: "work_safety_task_approval_foundation") { database in
        try database.exec("""
        CREATE TABLE IF NOT EXISTS work_safety_tasks (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          message TEXT,
          task_status TEXT NOT NULL,
          target_type TEXT NOT NULL,
          target_id TEXT,
          assigned_agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
          thread_id TEXT REFERENCES threads(id) ON DELETE SET NULL,
          runtime_binding_id TEXT REFERENCES runtime_bindings(id) ON DELETE SET NULL,
          action_run_id TEXT REFERENCES runtime_action_runs(id) ON DELETE SET NULL,
          dispatch_id TEXT REFERENCES runtime_dispatches(id) ON DELETE SET NULL,
          structured_job_id TEXT REFERENCES runtime_structured_jobs(id) ON DELETE SET NULL,
          approval_required INTEGER NOT NULL DEFAULT 0,
          approval_id TEXT,
          scheduled_message_id TEXT,
          source_host_record_id TEXT,
          scheduled_at TEXT,
          recurrence_rule TEXT,
          priority INTEGER NOT NULL DEFAULT 0,
          risk_level TEXT NOT NULL,
          metadata_json TEXT NOT NULL DEFAULT '{}',
          task_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          completed_at TEXT,
          redaction_status TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_work_safety_tasks_workspace_status
          ON work_safety_tasks(workspace_id, task_status, updated_at);
        CREATE INDEX IF NOT EXISTS idx_work_safety_tasks_assigned_agent
          ON work_safety_tasks(workspace_id, assigned_agent_id, task_status);
        CREATE INDEX IF NOT EXISTS idx_work_safety_tasks_thread
          ON work_safety_tasks(thread_id, task_status, updated_at);
        CREATE INDEX IF NOT EXISTS idx_work_safety_tasks_approval
          ON work_safety_tasks(workspace_id, approval_id, approval_required);
        CREATE INDEX IF NOT EXISTS idx_work_safety_tasks_action
          ON work_safety_tasks(workspace_id, action_run_id, dispatch_id);
        CREATE INDEX IF NOT EXISTS idx_work_safety_tasks_schedule
          ON work_safety_tasks(workspace_id, scheduled_at, task_status);

        CREATE TABLE IF NOT EXISTS work_safety_task_runs (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          task_id TEXT NOT NULL REFERENCES work_safety_tasks(id) ON DELETE CASCADE,
          run_status TEXT NOT NULL,
          action_run_id TEXT REFERENCES runtime_action_runs(id) ON DELETE SET NULL,
          dispatch_id TEXT REFERENCES runtime_dispatches(id) ON DELETE SET NULL,
          structured_job_id TEXT REFERENCES runtime_structured_jobs(id) ON DELETE SET NULL,
          attempt INTEGER NOT NULL DEFAULT 1,
          started_at TEXT,
          completed_at TEXT,
          failure_message TEXT,
          metadata_json TEXT NOT NULL DEFAULT '{}',
          run_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          redaction_status TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_work_safety_task_runs_task
          ON work_safety_task_runs(task_id, run_status, updated_at);
        CREATE INDEX IF NOT EXISTS idx_work_safety_task_runs_workspace
          ON work_safety_task_runs(workspace_id, run_status, updated_at);
        CREATE INDEX IF NOT EXISTS idx_work_safety_task_runs_action
          ON work_safety_task_runs(workspace_id, action_run_id, dispatch_id);

        CREATE TABLE IF NOT EXISTS work_safety_task_events (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          task_id TEXT NOT NULL REFERENCES work_safety_tasks(id) ON DELETE CASCADE,
          run_id TEXT REFERENCES work_safety_task_runs(id) ON DELETE SET NULL,
          approval_id TEXT,
          event_type TEXT NOT NULL,
          status TEXT NOT NULL,
          detail_json TEXT NOT NULL DEFAULT '{}',
          event_json TEXT NOT NULL,
          occurred_at TEXT NOT NULL,
          redaction_status TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_work_safety_task_events_task
          ON work_safety_task_events(task_id, occurred_at);
        CREATE INDEX IF NOT EXISTS idx_work_safety_task_events_workspace
          ON work_safety_task_events(workspace_id, event_type, occurred_at);
        CREATE INDEX IF NOT EXISTS idx_work_safety_task_events_approval
          ON work_safety_task_events(workspace_id, approval_id, occurred_at);

        CREATE TABLE IF NOT EXISTS work_safety_approvals (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          task_id TEXT REFERENCES work_safety_tasks(id) ON DELETE SET NULL,
          title TEXT NOT NULL,
          description TEXT,
          approval_status TEXT NOT NULL,
          risk_level TEXT NOT NULL,
          requested_by_agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
          resolver_agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
          expires_at TEXT,
          resolved_at TEXT,
          metadata_json TEXT NOT NULL DEFAULT '{}',
          approval_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          redaction_status TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_work_safety_approvals_workspace_status
          ON work_safety_approvals(workspace_id, approval_status, updated_at);
        CREATE INDEX IF NOT EXISTS idx_work_safety_approvals_task
          ON work_safety_approvals(task_id, approval_status);
        CREATE INDEX IF NOT EXISTS idx_work_safety_approvals_resolver
          ON work_safety_approvals(workspace_id, resolver_agent_id, approval_status);
        CREATE INDEX IF NOT EXISTS idx_work_safety_approvals_expiry
          ON work_safety_approvals(workspace_id, expires_at, approval_status);

        CREATE TABLE IF NOT EXISTS work_safety_approval_steps (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          approval_id TEXT NOT NULL REFERENCES work_safety_approvals(id) ON DELETE CASCADE,
          label TEXT NOT NULL,
          value TEXT,
          step_status TEXT NOT NULL,
          sort_index INTEGER NOT NULL DEFAULT 0,
          step_json TEXT NOT NULL,
          redaction_status TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_work_safety_approval_steps_approval
          ON work_safety_approval_steps(approval_id, sort_index);
        CREATE INDEX IF NOT EXISTS idx_work_safety_approval_steps_workspace
          ON work_safety_approval_steps(workspace_id, approval_id);

        CREATE TABLE IF NOT EXISTS work_safety_approval_notes (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          approval_id TEXT NOT NULL REFERENCES work_safety_approvals(id) ON DELETE CASCADE,
          author_agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
          note TEXT NOT NULL,
          note_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          redaction_status TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_work_safety_approval_notes_approval
          ON work_safety_approval_notes(approval_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_work_safety_approval_notes_workspace
          ON work_safety_approval_notes(workspace_id, approval_id);
        """)
    },

    Migration(version: 22, name: "permission_policy_authority") { database in
        try database.exec("""
        CREATE TABLE IF NOT EXISTS permission_policies (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          policy_name TEXT NOT NULL,
          effect TEXT NOT NULL,
          policy_status TEXT NOT NULL,
          role_targets_json TEXT NOT NULL DEFAULT '[]',
          resource_type TEXT NOT NULL,
          resource_id TEXT,
          action TEXT NOT NULL,
          priority INTEGER NOT NULL DEFAULT 0,
          reason_code TEXT NOT NULL,
          message TEXT NOT NULL,
          metadata_json TEXT NOT NULL DEFAULT '{}',
          created_by_actor_id TEXT NOT NULL,
          updated_by_actor_id TEXT NOT NULL,
          policy_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          redaction_status TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_permission_policies_workspace
          ON permission_policies(workspace_id, policy_status, updated_at);
        CREATE INDEX IF NOT EXISTS idx_permission_policies_lookup
          ON permission_policies(workspace_id, resource_type, resource_id, action, policy_status);
        CREATE INDEX IF NOT EXISTS idx_permission_policies_effect
          ON permission_policies(workspace_id, effect, priority);
        CREATE INDEX IF NOT EXISTS idx_permission_policies_actor
          ON permission_policies(workspace_id, updated_by_actor_id, updated_at);
        """)
    },

    Migration(version: 23, name: "audit_security_metrics") { database in
        try database.exec("""
        CREATE TABLE IF NOT EXISTS audit_log_records (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          actor_id TEXT NOT NULL,
          actor_type TEXT NOT NULL,
          event_type TEXT NOT NULL,
          resource_type TEXT NOT NULL,
          resource_id TEXT,
          severity TEXT NOT NULL,
          message TEXT NOT NULL,
          correlation_id TEXT,
          task_id TEXT,
          approval_id TEXT,
          action_run_id TEXT,
          dispatch_id TEXT,
          thread_id TEXT,
          harness_id TEXT,
          source TEXT NOT NULL,
          context_json TEXT NOT NULL DEFAULT '{}',
          write_status TEXT NOT NULL,
          record_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          redaction_status TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_audit_log_workspace_time
          ON audit_log_records(workspace_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_audit_log_event_time
          ON audit_log_records(workspace_id, event_type, created_at);
        CREATE INDEX IF NOT EXISTS idx_audit_log_resource
          ON audit_log_records(workspace_id, resource_type, resource_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_audit_log_actor
          ON audit_log_records(workspace_id, actor_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_audit_log_correlation
          ON audit_log_records(correlation_id, created_at);

        CREATE TABLE IF NOT EXISTS security_metric_snapshots (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          window_started_at TEXT,
          window_ended_at TEXT,
          generated_at TEXT NOT NULL,
          audit_event_count INTEGER NOT NULL DEFAULT 0,
          denied_action_count INTEGER NOT NULL DEFAULT 0,
          permission_denied_count INTEGER NOT NULL DEFAULT 0,
          approval_decision_count INTEGER NOT NULL DEFAULT 0,
          policy_mutation_count INTEGER NOT NULL DEFAULT 0,
          task_transition_count INTEGER NOT NULL DEFAULT 0,
          tool_request_transition_count INTEGER NOT NULL DEFAULT 0,
          command_rejection_count INTEGER NOT NULL DEFAULT 0,
          high_risk_execution_count INTEGER NOT NULL DEFAULT 0,
          file_permission_change_count INTEGER NOT NULL DEFAULT 0,
          export_reset_attempt_count INTEGER NOT NULL DEFAULT 0,
          recovery_event_count INTEGER NOT NULL DEFAULT 0,
          audit_write_failure_count INTEGER NOT NULL DEFAULT 0,
          redaction_applied_count INTEGER NOT NULL DEFAULT 0,
          category_counts_json TEXT NOT NULL DEFAULT '{}',
          snapshot_json TEXT NOT NULL,
          redaction_status TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_security_metric_snapshots_workspace
          ON security_metric_snapshots(workspace_id, generated_at);
        CREATE INDEX IF NOT EXISTS idx_security_metric_snapshots_window
          ON security_metric_snapshots(workspace_id, window_started_at, window_ended_at);
        """)
    },

    Migration(version: 24, name: "native_file_permissions") { database in
        try database.exec("""
        CREATE TABLE IF NOT EXISTS native_file_permissions (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          target_kind TEXT NOT NULL,
          display_name TEXT NOT NULL,
          display_path TEXT NOT NULL,
          path_hash TEXT,
          bookmark_ref TEXT,
          access_level TEXT NOT NULL,
          permission_status TEXT NOT NULL,
          related_task_id TEXT REFERENCES work_safety_tasks(id) ON DELETE SET NULL,
          related_tool_request_id TEXT REFERENCES applications_tool_requests(id) ON DELETE SET NULL,
          related_action_run_id TEXT REFERENCES runtime_action_runs(id) ON DELETE SET NULL,
          last_validated_at TEXT,
          last_synced_at TEXT,
          failure_reason TEXT,
          metadata_json TEXT NOT NULL DEFAULT '{}',
          permission_json TEXT NOT NULL,
          created_by_actor_id TEXT NOT NULL,
          updated_by_actor_id TEXT NOT NULL,
          revoked_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          redaction_status TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_native_file_permissions_workspace
          ON native_file_permissions(workspace_id, permission_status, updated_at);
        CREATE INDEX IF NOT EXISTS idx_native_file_permissions_target
          ON native_file_permissions(workspace_id, target_kind, path_hash);
        CREATE INDEX IF NOT EXISTS idx_native_file_permissions_task
          ON native_file_permissions(workspace_id, related_task_id, updated_at);
        CREATE INDEX IF NOT EXISTS idx_native_file_permissions_tool_request
          ON native_file_permissions(workspace_id, related_tool_request_id, updated_at);
        CREATE INDEX IF NOT EXISTS idx_native_file_permissions_action_run
          ON native_file_permissions(workspace_id, related_action_run_id, updated_at);
        """)
    },

    Migration(version: 25, name: "settings_alerts_notifications") { database in
        try database.exec("""
        CREATE TABLE IF NOT EXISTS settings_alerts (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          message TEXT NOT NULL,
          severity TEXT NOT NULL,
          category TEXT NOT NULL,
          source_kind TEXT NOT NULL,
          source_id TEXT,
          action_label TEXT,
          action_target TEXT,
          expires_at TEXT,
          read_at TEXT,
          metadata_json TEXT NOT NULL DEFAULT '{}',
          alert_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          redaction_status TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_settings_alerts_workspace
          ON settings_alerts(workspace_id, updated_at);
        CREATE INDEX IF NOT EXISTS idx_settings_alerts_read
          ON settings_alerts(workspace_id, read_at, updated_at);
        CREATE INDEX IF NOT EXISTS idx_settings_alerts_expiry
          ON settings_alerts(workspace_id, expires_at);
        CREATE INDEX IF NOT EXISTS idx_settings_alerts_source
          ON settings_alerts(workspace_id, source_kind, source_id);

        CREATE TABLE IF NOT EXISTS settings_notification_preferences (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          profile_id TEXT REFERENCES local_profiles(id) ON DELETE CASCADE,
          in_app_alerts_enabled INTEGER NOT NULL DEFAULT 1,
          unread_badge_enabled INTEGER NOT NULL DEFAULT 1,
          email_delivery_state TEXT NOT NULL DEFAULT 'unavailable',
          mobile_delivery_state TEXT NOT NULL DEFAULT 'unavailable',
          metadata_json TEXT NOT NULL DEFAULT '{}',
          preferences_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          redaction_status TEXT NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_settings_notification_preferences_scope
          ON settings_notification_preferences(workspace_id, COALESCE(profile_id, ''));
        CREATE INDEX IF NOT EXISTS idx_settings_notification_preferences_workspace
          ON settings_notification_preferences(workspace_id, updated_at);
        """)
    },

    Migration(version: 26, name: "settings_security_lifecycle") { database in
        try database.exec("""
        CREATE TABLE IF NOT EXISTS settings_decision_gate_dispositions (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          decision_id TEXT NOT NULL,
          surface TEXT NOT NULL,
          disposition_state TEXT NOT NULL,
          reason_code TEXT NOT NULL,
          current_ui_state TEXT NOT NULL,
          missing_prerequisites TEXT NOT NULL,
          activation_requirement TEXT NOT NULL,
          release_impact TEXT NOT NULL,
          metadata_json TEXT NOT NULL DEFAULT '{}',
          disposition_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          redaction_status TEXT NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_settings_decision_gate_dispositions_unique
          ON settings_decision_gate_dispositions(workspace_id, decision_id, surface);
        CREATE INDEX IF NOT EXISTS idx_settings_decision_gate_dispositions_workspace
          ON settings_decision_gate_dispositions(workspace_id, disposition_state, updated_at);
        CREATE INDEX IF NOT EXISTS idx_settings_decision_gate_dispositions_decision
          ON settings_decision_gate_dispositions(decision_id, updated_at);

        CREATE TABLE IF NOT EXISTS settings_local_account_exports (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          profile_id TEXT REFERENCES local_profiles(id) ON DELETE SET NULL,
          export_status TEXT NOT NULL,
          file_name TEXT NOT NULL,
          record_count INTEGER NOT NULL DEFAULT 0,
          includes_secrets INTEGER NOT NULL DEFAULT 0,
          export_metadata_json TEXT NOT NULL DEFAULT '{}',
          export_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          redaction_status TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_settings_local_account_exports_workspace
          ON settings_local_account_exports(workspace_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_settings_local_account_exports_profile
          ON settings_local_account_exports(workspace_id, profile_id, created_at);
        """)
    },

    Migration(version: 27, name: "insights_reports_snapshots") { database in
        try? database.exec("ALTER TABLE thread_wrap_up_reports ADD COLUMN archived_at TEXT;")
        try? database.exec("ALTER TABLE thread_wrap_up_reports ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0;")
        try? database.exec("ALTER TABLE thread_wrap_up_reports ADD COLUMN last_retry_at TEXT;")
        try? database.exec("ALTER TABLE thread_wrap_up_reports ADD COLUMN redaction_status TEXT NOT NULL DEFAULT 'private-state-excluded';")
        try database.exec("""
        CREATE INDEX IF NOT EXISTS idx_thread_wrap_up_reports_archive
          ON thread_wrap_up_reports(workspace_id, archived_at, updated_at);

        CREATE TABLE IF NOT EXISTS insights_report_snapshots (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          summary TEXT NOT NULL,
          snapshot_type TEXT NOT NULL,
          period_label TEXT,
          range_start TEXT,
          range_end TEXT,
          payload_json TEXT NOT NULL DEFAULT '{}',
          archived_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          redaction_status TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_insights_report_snapshots_workspace
          ON insights_report_snapshots(workspace_id, archived_at, updated_at);
        CREATE INDEX IF NOT EXISTS idx_insights_report_snapshots_type
          ON insights_report_snapshots(workspace_id, snapshot_type, updated_at);
        """)
    },

    Migration(version: 28, name: "team_relay_cycle_controls") { database in
        try? database.exec("ALTER TABLE thread_sessions ADD COLUMN relay_run_state TEXT NOT NULL DEFAULT 'running';")
        try? database.exec("ALTER TABLE thread_sessions ADD COLUMN relay_pause_reason TEXT;")
        try? database.exec("ALTER TABLE thread_sessions ADD COLUMN relay_reply_limit INTEGER NOT NULL DEFAULT 50;")
    },

    Migration(version: 29, name: "marketplace_provider_action_framework") { database in
        try database.exec("""
        CREATE TABLE IF NOT EXISTS marketplace_provider_action_definitions (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          app_id TEXT NOT NULL REFERENCES marketplace_catalog_apps(id) ON DELETE CASCADE,
          app_slug TEXT NOT NULL,
          provider_key TEXT NOT NULL,
          action_key TEXT NOT NULL,
          display_name TEXT NOT NULL,
          action_kind TEXT NOT NULL,
          risk_level TEXT NOT NULL,
          adapter_kind TEXT NOT NULL,
          default_permission TEXT NOT NULL,
          enabled INTEGER NOT NULL DEFAULT 1,
          definition_json TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          redaction_status TEXT NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_marketplace_provider_action_definitions_unique
          ON marketplace_provider_action_definitions(workspace_id, app_id, action_key);
        CREATE INDEX IF NOT EXISTS idx_marketplace_provider_action_definitions_app
          ON marketplace_provider_action_definitions(workspace_id, app_id, enabled, updated_at);
        CREATE INDEX IF NOT EXISTS idx_marketplace_provider_action_definitions_kind
          ON marketplace_provider_action_definitions(workspace_id, action_kind, risk_level);

        CREATE TABLE IF NOT EXISTS marketplace_action_permission_maps (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          app_id TEXT NOT NULL REFERENCES marketplace_catalog_apps(id) ON DELETE CASCADE,
          app_slug TEXT NOT NULL,
          connection_id TEXT REFERENCES applications_provider_connections(id) ON DELETE SET NULL,
          install_id TEXT REFERENCES applications_marketplace_installs(id) ON DELETE SET NULL,
          agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
          policy_preset TEXT NOT NULL,
          permissions_json TEXT NOT NULL DEFAULT '{}',
          map_json TEXT NOT NULL DEFAULT '{}',
          created_by_actor_id TEXT NOT NULL,
          updated_by_actor_id TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          redaction_status TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_marketplace_action_permission_maps_scope
          ON marketplace_action_permission_maps(workspace_id, app_id, policy_preset, updated_at);
        CREATE INDEX IF NOT EXISTS idx_marketplace_action_permission_maps_install
          ON marketplace_action_permission_maps(workspace_id, install_id, updated_at);
        CREATE INDEX IF NOT EXISTS idx_marketplace_action_permission_maps_connection
          ON marketplace_action_permission_maps(workspace_id, connection_id, updated_at);
        CREATE INDEX IF NOT EXISTS idx_marketplace_action_permission_maps_agent
          ON marketplace_action_permission_maps(workspace_id, agent_id, updated_at);

        CREATE TABLE IF NOT EXISTS marketplace_provider_action_approvals (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          app_id TEXT NOT NULL REFERENCES marketplace_catalog_apps(id) ON DELETE CASCADE,
          app_slug TEXT NOT NULL,
          connection_id TEXT REFERENCES applications_provider_connections(id) ON DELETE SET NULL,
          install_id TEXT REFERENCES applications_marketplace_installs(id) ON DELETE SET NULL,
          agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
          provider_action_id TEXT NOT NULL REFERENCES marketplace_provider_action_definitions(id) ON DELETE CASCADE,
          action_key TEXT NOT NULL,
          approval_status TEXT NOT NULL,
          proposed_payload_hash TEXT NOT NULL,
          idempotency_key TEXT NOT NULL,
          expires_at TEXT,
          resolved_at TEXT,
          execution_id TEXT,
          approval_json TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          redaction_status TEXT NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_marketplace_provider_action_approvals_idempotency
          ON marketplace_provider_action_approvals(workspace_id, provider_action_id, idempotency_key);
        CREATE INDEX IF NOT EXISTS idx_marketplace_provider_action_approvals_status
          ON marketplace_provider_action_approvals(workspace_id, approval_status, updated_at);
        CREATE INDEX IF NOT EXISTS idx_marketplace_provider_action_approvals_app
          ON marketplace_provider_action_approvals(workspace_id, app_id, updated_at);
        CREATE INDEX IF NOT EXISTS idx_marketplace_provider_action_approvals_install
          ON marketplace_provider_action_approvals(workspace_id, install_id, updated_at);

        CREATE TABLE IF NOT EXISTS marketplace_provider_action_executions (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          app_id TEXT NOT NULL REFERENCES marketplace_catalog_apps(id) ON DELETE CASCADE,
          app_slug TEXT NOT NULL,
          connection_id TEXT REFERENCES applications_provider_connections(id) ON DELETE SET NULL,
          install_id TEXT REFERENCES applications_marketplace_installs(id) ON DELETE SET NULL,
          agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
          provider_action_id TEXT NOT NULL REFERENCES marketplace_provider_action_definitions(id) ON DELETE CASCADE,
          action_key TEXT NOT NULL,
          permission TEXT NOT NULL,
          execution_status TEXT NOT NULL,
          idempotency_key TEXT NOT NULL,
          approval_id TEXT REFERENCES marketplace_provider_action_approvals(id) ON DELETE SET NULL,
          adapter_kind TEXT NOT NULL,
          execution_json TEXT NOT NULL DEFAULT '{}',
          started_at TEXT,
          completed_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          redaction_status TEXT NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_marketplace_provider_action_executions_idempotency
          ON marketplace_provider_action_executions(workspace_id, provider_action_id, idempotency_key);
        CREATE INDEX IF NOT EXISTS idx_marketplace_provider_action_executions_status
          ON marketplace_provider_action_executions(workspace_id, execution_status, updated_at);
        CREATE INDEX IF NOT EXISTS idx_marketplace_provider_action_executions_app
          ON marketplace_provider_action_executions(workspace_id, app_id, updated_at);
        CREATE INDEX IF NOT EXISTS idx_marketplace_provider_action_executions_approval
          ON marketplace_provider_action_executions(workspace_id, approval_id, updated_at);
        """)
    },

    Migration(version: 30, name: "local_railway_connected_relay") { database in
        try database.exec("""
        CREATE TABLE IF NOT EXISTS cloud_deployments (
          id TEXT PRIMARY KEY,
          deployment_id TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          api_base_url TEXT NOT NULL,
          websocket_base_url TEXT NOT NULL,
          api_version TEXT NOT NULL,
          sync_contract_version TEXT NOT NULL,
          runtime_contract_version TEXT NOT NULL,
          marketplace_contract_version TEXT NOT NULL,
          capabilities_json TEXT NOT NULL DEFAULT '{}',
          compatibility_state TEXT NOT NULL DEFAULT 'compatible',
          is_active INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_cloud_deployments_active ON cloud_deployments(is_active, updated_at);

        CREATE TABLE IF NOT EXISTS cloud_accounts (
          id TEXT PRIMARY KEY,
          deployment_id TEXT NOT NULL REFERENCES cloud_deployments(id) ON DELETE CASCADE,
          remote_user_id TEXT NOT NULL,
          display_name TEXT NOT NULL,
          email TEXT,
          access_secret_reference_id TEXT REFERENCES secret_references(id) ON DELETE SET NULL,
          refresh_secret_reference_id TEXT REFERENCES secret_references(id) ON DELETE SET NULL,
          access_expires_at TEXT,
          status TEXT NOT NULL DEFAULT 'signed_in',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE(deployment_id, remote_user_id)
        );

        CREATE TABLE IF NOT EXISTS workspace_sync_links (
          id TEXT PRIMARY KEY,
          local_workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          deployment_id TEXT NOT NULL REFERENCES cloud_deployments(id) ON DELETE RESTRICT,
          account_id TEXT NOT NULL REFERENCES cloud_accounts(id) ON DELETE RESTRICT,
          remote_installation_id TEXT NOT NULL,
          remote_workspace_id TEXT NOT NULL,
          remote_sync_link_id TEXT,
          state TEXT NOT NULL DEFAULT 'preview',
          attachment_policy TEXT NOT NULL DEFAULT 'metadata_only',
          offline_retention INTEGER NOT NULL DEFAULT 1,
          hosting_enabled INTEGER NOT NULL DEFAULT 0,
          pull_cursor TEXT NOT NULL DEFAULT '0',
          last_acknowledgement TEXT,
          pending_dispatch_confirmation_count INTEGER NOT NULL DEFAULT 0,
          last_successful_sync_at TEXT,
          last_error_code TEXT,
          fork_workspace_id TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_sync_links_one_active
          ON workspace_sync_links(local_workspace_id) WHERE state != 'unlinked';
        CREATE INDEX IF NOT EXISTS idx_workspace_sync_links_remote ON workspace_sync_links(deployment_id, remote_workspace_id);

        CREATE TABLE IF NOT EXISTS sync_imports (
          id TEXT PRIMARY KEY,
          sync_link_id TEXT NOT NULL REFERENCES workspace_sync_links(id) ON DELETE CASCADE,
          remote_import_id TEXT,
          manifest_key TEXT NOT NULL,
          state TEXT NOT NULL,
          counts_json TEXT NOT NULL DEFAULT '{}',
          attachment_bytes INTEGER NOT NULL DEFAULT 0,
          exclusions_json TEXT NOT NULL DEFAULT '[]',
          conflicts_json TEXT NOT NULL DEFAULT '[]',
          consented_at TEXT,
          backup_checkpoint_path TEXT,
          backup_checkpoint_sha256 TEXT,
          accepted_count INTEGER NOT NULL DEFAULT 0,
          rejected_count INTEGER NOT NULL DEFAULT 0,
          last_batch_key TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE(sync_link_id, manifest_key)
        );
        CREATE TABLE IF NOT EXISTS sync_import_items (
          id TEXT PRIMARY KEY,
          import_id TEXT NOT NULL REFERENCES sync_imports(id) ON DELETE CASCADE,
          object_type TEXT NOT NULL,
          object_id TEXT NOT NULL,
          dependency_rank INTEGER NOT NULL,
          outcome TEXT NOT NULL DEFAULT 'pending',
          canonical_object_id TEXT,
          server_version TEXT,
          error_code TEXT,
          updated_at TEXT NOT NULL,
          UNIQUE(import_id, object_type, object_id)
        );

        CREATE TABLE IF NOT EXISTS sync_outbox (
          id TEXT PRIMARY KEY,
          sync_link_id TEXT NOT NULL REFERENCES workspace_sync_links(id) ON DELETE CASCADE,
          client_mutation_id TEXT NOT NULL UNIQUE,
          object_type TEXT NOT NULL,
          object_id TEXT NOT NULL,
          base_server_version TEXT,
          operation TEXT NOT NULL,
          payload_json TEXT NOT NULL DEFAULT '{}',
          dependencies_json TEXT NOT NULL DEFAULT '[]',
          state TEXT NOT NULL DEFAULT 'pending',
          retry_count INTEGER NOT NULL DEFAULT 0,
          next_retry_at TEXT,
          requires_dispatch_confirmation INTEGER NOT NULL DEFAULT 0,
          target_fingerprint TEXT,
          last_error_code TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_sync_outbox_work ON sync_outbox(sync_link_id, state, next_retry_at, created_at);

        CREATE TABLE IF NOT EXISTS remote_object_versions (
          sync_link_id TEXT NOT NULL REFERENCES workspace_sync_links(id) ON DELETE CASCADE,
          object_type TEXT NOT NULL,
          local_object_id TEXT NOT NULL,
          canonical_object_id TEXT,
          server_version TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          PRIMARY KEY(sync_link_id, object_type, local_object_id)
        );
        CREATE TABLE IF NOT EXISTS cloud_replica_objects (
          sync_link_id TEXT NOT NULL REFERENCES workspace_sync_links(id) ON DELETE CASCADE,
          object_type TEXT NOT NULL,
          remote_object_id TEXT NOT NULL,
          local_object_id TEXT,
          server_version TEXT NOT NULL,
          payload_json TEXT NOT NULL DEFAULT '{}',
          deleted_at TEXT,
          updated_at TEXT NOT NULL,
          PRIMARY KEY(sync_link_id, object_type, remote_object_id)
        );
        CREATE TABLE IF NOT EXISTS sync_conflicts (
          id TEXT PRIMARY KEY,
          sync_link_id TEXT NOT NULL REFERENCES workspace_sync_links(id) ON DELETE CASCADE,
          client_mutation_id TEXT,
          object_type TEXT NOT NULL,
          object_id TEXT NOT NULL,
          conflict_type TEXT NOT NULL,
          base_server_version TEXT,
          canonical_server_version TEXT,
          local_payload_json TEXT NOT NULL DEFAULT '{}',
          canonical_payload_json TEXT NOT NULL DEFAULT '{}',
          resolution TEXT,
          resolved_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_sync_conflicts_open ON sync_conflicts(sync_link_id, resolved_at, created_at);
        CREATE TABLE IF NOT EXISTS sync_tombstones (
          sync_link_id TEXT NOT NULL REFERENCES workspace_sync_links(id) ON DELETE CASCADE,
          object_type TEXT NOT NULL,
          object_id TEXT NOT NULL,
          server_version TEXT NOT NULL,
          deleted_at TEXT NOT NULL,
          applied_at TEXT NOT NULL,
          PRIMARY KEY(sync_link_id, object_type, object_id)
        );
        CREATE TABLE IF NOT EXISTS sync_apply_guard (
          id INTEGER PRIMARY KEY CHECK(id = 1),
          active INTEGER NOT NULL DEFAULT 0
        );
        INSERT OR IGNORE INTO sync_apply_guard(id, active) VALUES (1, 0);

        CREATE TABLE IF NOT EXISTS cloud_runtime_devices (
          id TEXT PRIMARY KEY,
          sync_link_id TEXT NOT NULL REFERENCES workspace_sync_links(id) ON DELETE CASCADE,
          remote_device_id TEXT,
          device_public_id TEXT,
          credential_secret_reference_id TEXT REFERENCES secret_references(id) ON DELETE SET NULL,
          label TEXT NOT NULL,
          state TEXT NOT NULL DEFAULT 'unenrolled',
          capability_json TEXT NOT NULL DEFAULT '{}',
          last_seen_at TEXT,
          lease_expires_at TEXT,
          revoked_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS cloud_runtime_bindings (
          id TEXT PRIMARY KEY,
          runtime_device_id TEXT NOT NULL REFERENCES cloud_runtime_devices(id) ON DELETE CASCADE,
          local_agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
          remote_agent_id TEXT NOT NULL,
          remote_binding_id TEXT,
          publication_state TEXT NOT NULL DEFAULT 'draft',
          owner_lease_state TEXT NOT NULL DEFAULT 'none',
          capability_json TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE(runtime_device_id, local_agent_id),
          UNIQUE(runtime_device_id, remote_agent_id)
        );
        CREATE TABLE IF NOT EXISTS cloud_dispatch_receipts (
          cloud_dispatch_id TEXT PRIMARY KEY,
          runtime_device_id TEXT NOT NULL REFERENCES cloud_runtime_devices(id) ON DELETE CASCADE,
          local_dispatch_id TEXT,
          remote_agent_id TEXT NOT NULL,
          thread_id TEXT NOT NULL,
          runtime_session_id TEXT NOT NULL,
          native_session_id TEXT,
          state TEXT NOT NULL,
          last_event_sequence INTEGER NOT NULL DEFAULT 0,
          terminal_event_json TEXT,
          terminal_acknowledged_at TEXT,
          received_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS attachment_sync_state (
          sync_link_id TEXT NOT NULL REFERENCES workspace_sync_links(id) ON DELETE CASCADE,
          local_attachment_id TEXT NOT NULL,
          remote_attachment_id TEXT,
          policy TEXT NOT NULL,
          state TEXT NOT NULL,
          byte_size INTEGER NOT NULL DEFAULT 0,
          sha256 TEXT,
          provenance_json TEXT NOT NULL DEFAULT '{}',
          last_error_code TEXT,
          updated_at TEXT NOT NULL,
          PRIMARY KEY(sync_link_id, local_attachment_id)
        );

        ALTER TABLE applications_provider_connections ADD COLUMN execution_authority TEXT NOT NULL DEFAULT 'swift';
        ALTER TABLE applications_provider_connections ADD COLUMN remote_connection_id TEXT;
        """)

        let trackedTables: [(String, String)] = [
            ("agents", "agent"), ("agent_preferences", "agent_preference"),
            ("threads", "thread"), ("thread_sessions", "thread_session"),
            ("thread_participants", "thread_participant"), ("messages", "message"),
            ("thread_read_states", "read_state"), ("thread_wrap_up_reports", "thread_wrap_up"),
            ("agent_tasks", "task"), ("agent_task_runs", "run"),
            ("runtime_structured_jobs", "runtime_event"), ("work_safety_tasks", "task"),
            ("work_safety_task_runs", "run"), ("work_safety_task_events", "runtime_event"),
            ("work_safety_approvals", "approval"), ("chat_attachments", "attachment"),
            ("applications_provider_connections", "application_connection"),
            ("applications_marketplace_installs", "application_install"),
            ("permission_policies", "application_policy"), ("runtime_dispatches", "dispatch_status")
        ]
        for (table, objectType) in trackedTables {
            let workspaceExpression: String
            switch table {
            case "messages", "thread_sessions", "thread_participants", "thread_read_states", "thread_wrap_up_reports", "chat_attachments", "runtime_dispatches":
                workspaceExpression = "(SELECT workspace_id FROM threads WHERE id = NEW.thread_id)"
            case "agent_task_runs":
                workspaceExpression = "NEW.workspace_id"
            default:
                workspaceExpression = "NEW.workspace_id"
            }
            try database.exec("""
            CREATE TRIGGER IF NOT EXISTS trg_\(table)_cloud_upsert
            AFTER INSERT ON \(table)
            WHEN (SELECT active FROM sync_apply_guard WHERE id = 1) = 0
             AND EXISTS (SELECT 1 FROM workspace_sync_links l WHERE l.local_workspace_id = \(workspaceExpression) AND l.state IN ('linked','syncing','offline'))
            BEGIN
              INSERT INTO sync_outbox(id, sync_link_id, client_mutation_id, object_type, object_id, operation, payload_json, dependencies_json, state, created_at, updated_at)
              SELECT lower(hex(randomblob(16))), l.id, lower(hex(randomblob(16))), '\(objectType)', NEW.id, 'upsert', '{}', '[]', 'pending', strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')
              FROM workspace_sync_links l WHERE l.local_workspace_id = \(workspaceExpression) AND l.state IN ('linked','syncing','offline') LIMIT 1;
            END;
            """)
            let oldWorkspaceExpression = workspaceExpression.replacingOccurrences(of: "NEW.", with: "OLD.")
            try database.exec("""
            CREATE TRIGGER IF NOT EXISTS trg_\(table)_cloud_update
            AFTER UPDATE ON \(table)
            WHEN (SELECT active FROM sync_apply_guard WHERE id = 1) = 0
             AND EXISTS (SELECT 1 FROM workspace_sync_links l WHERE l.local_workspace_id = \(workspaceExpression) AND l.state IN ('linked','syncing','offline'))
            BEGIN
              INSERT INTO sync_outbox(id, sync_link_id, client_mutation_id, object_type, object_id, operation, payload_json, dependencies_json, state, created_at, updated_at)
              SELECT lower(hex(randomblob(16))), l.id, lower(hex(randomblob(16))), '\(objectType)', NEW.id, 'upsert', '{}', '[]', 'pending', strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')
              FROM workspace_sync_links l WHERE l.local_workspace_id = \(workspaceExpression) AND l.state IN ('linked','syncing','offline') LIMIT 1;
            END;
            CREATE TRIGGER IF NOT EXISTS trg_\(table)_cloud_delete
            BEFORE DELETE ON \(table)
            WHEN (SELECT active FROM sync_apply_guard WHERE id = 1) = 0
             AND EXISTS (SELECT 1 FROM workspace_sync_links l WHERE l.local_workspace_id = \(oldWorkspaceExpression) AND l.state IN ('linked','syncing','offline'))
            BEGIN
              INSERT INTO sync_outbox(id, sync_link_id, client_mutation_id, object_type, object_id, operation, payload_json, dependencies_json, state, created_at, updated_at)
              SELECT lower(hex(randomblob(16))), l.id, lower(hex(randomblob(16))), '\(objectType)', OLD.id, 'delete', '{}', '[]', 'pending', strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')
              FROM workspace_sync_links l WHERE l.local_workspace_id = \(oldWorkspaceExpression) AND l.state IN ('linked','syncing','offline') LIMIT 1;
            END;
            """)
        }
    },

    Migration(version: 31, name: "bound_rebuildable_snapshot_history") { database in
        // These rows are derived UI/runtime cache snapshots, not user-authored
        // records. Older builds appended one on every refresh without a
        // retention ceiling, which could grow the local database by tens of
        // gigabytes. Clear the rebuildable history once; write paths now retain
        // only a small rolling window per workspace.
        try database.exec("""
        DELETE FROM runtime_dashboard_rows;
        DELETE FROM runtime_dashboard_snapshots;
        DELETE FROM applications_catalog_snapshots;
        DELETE FROM applications_provider_connection_snapshots;
        DELETE FROM applications_marketplace_install_snapshots;
        DELETE FROM applications_needed_tools_snapshots;
        """)
    },

    Migration(version: 32, name: "message_history_cursor_pagination") { database in
        try database.exec("""
        CREATE INDEX IF NOT EXISTS idx_messages_thread_session_created_id
        ON messages(thread_id, thread_session_id, created_at, id);
        """)
    },

    Migration(version: 33, name: "cloud_agent_documents") { database in
        try database.exec("""
        CREATE TABLE IF NOT EXISTS agent_documents (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
          runtime_type TEXT NOT NULL,
          root TEXT NOT NULL DEFAULT 'agent',
          folder TEXT NOT NULL DEFAULT '',
          filename TEXT NOT NULL,
          document_kind TEXT NOT NULL,
          content TEXT NOT NULL,
          content_hash TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE(agent_id, root, folder, filename)
        );
        CREATE INDEX IF NOT EXISTS idx_agent_documents_workspace_agent
        ON agent_documents(workspace_id, agent_id, root, folder, filename);

        CREATE TRIGGER IF NOT EXISTS trg_agent_documents_cloud_upsert
        AFTER INSERT ON agent_documents
        WHEN (SELECT active FROM sync_apply_guard WHERE id = 1) = 0
         AND EXISTS (SELECT 1 FROM workspace_sync_links l WHERE l.local_workspace_id = NEW.workspace_id AND l.state IN ('linked','syncing','offline'))
        BEGIN
          INSERT INTO sync_outbox(id, sync_link_id, client_mutation_id, object_type, object_id, operation, payload_json, dependencies_json, state, created_at, updated_at)
          SELECT lower(hex(randomblob(16))), l.id, lower(hex(randomblob(16))), 'agent_document', NEW.id, 'upsert', '{}', '[]', 'pending', strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')
          FROM workspace_sync_links l WHERE l.local_workspace_id = NEW.workspace_id AND l.state IN ('linked','syncing','offline') LIMIT 1;
        END;
        CREATE TRIGGER IF NOT EXISTS trg_agent_documents_cloud_update
        AFTER UPDATE ON agent_documents
        WHEN (SELECT active FROM sync_apply_guard WHERE id = 1) = 0
         AND EXISTS (SELECT 1 FROM workspace_sync_links l WHERE l.local_workspace_id = NEW.workspace_id AND l.state IN ('linked','syncing','offline'))
        BEGIN
          INSERT INTO sync_outbox(id, sync_link_id, client_mutation_id, object_type, object_id, operation, payload_json, dependencies_json, state, created_at, updated_at)
          SELECT lower(hex(randomblob(16))), l.id, lower(hex(randomblob(16))), 'agent_document', NEW.id, 'upsert', '{}', '[]', 'pending', strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')
          FROM workspace_sync_links l WHERE l.local_workspace_id = NEW.workspace_id AND l.state IN ('linked','syncing','offline') LIMIT 1;
        END;
        CREATE TRIGGER IF NOT EXISTS trg_agent_documents_cloud_delete
        BEFORE DELETE ON agent_documents
        WHEN (SELECT active FROM sync_apply_guard WHERE id = 1) = 0
         AND EXISTS (SELECT 1 FROM workspace_sync_links l WHERE l.local_workspace_id = OLD.workspace_id AND l.state IN ('linked','syncing','offline'))
        BEGIN
          INSERT INTO sync_outbox(id, sync_link_id, client_mutation_id, object_type, object_id, operation, payload_json, dependencies_json, state, created_at, updated_at)
          SELECT lower(hex(randomblob(16))), l.id, lower(hex(randomblob(16))), 'agent_document', OLD.id, 'delete', '{}', '[]', 'pending', strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')
          FROM workspace_sync_links l WHERE l.local_workspace_id = OLD.workspace_id AND l.state IN ('linked','syncing','offline') LIMIT 1;
        END;
        """)
    },

    Migration(version: 34, name: "refresh_cloud_agent_replica_snapshot") { database in
        // Earlier cloud snapshots could project a legacy source label instead
        // of the canonical runtime binding. Replay the idempotent Railway
        // snapshot once so runtime type, avatar metadata, and agent documents
        // are refreshed together after the user authenticates again.
        try database.run(
            "UPDATE workspace_sync_links SET pull_cursor='0',updated_at=? WHERE state IN ('linked','syncing','offline')",
            [.text(nowIso())]
        )
    },

    Migration(version: 35, name: "repair_cached_cloud_agent_runtime_types") { database in
        // Legacy Railway agent snapshots often identified the runtime in
        // `source` rather than `runtimeType`. Old clients defaulted those
        // agents to Hermes. Repair only Relay Connect bindings from the cached
        // canonical payload so this is safe while the account is offline.
        let rows = try database.all("""
        SELECT b.agent_id,b.harness_id,c.payload_json
        FROM runtime_bindings b
        JOIN cloud_replica_objects c
          ON c.object_type='agent' AND c.local_object_id=b.agent_id
        WHERE b.adapter_kind='railway_cloud' AND c.deleted_at IS NULL
        """)
        for row in rows {
            guard let agentId = row["agent_id"]?.string,
                  let payloadJSON = row["payload_json"]?.string,
                  let payloadData = payloadJSON.data(using: .utf8),
                  let payload = try? JSONSerialization.jsonObject(with: payloadData) as? [String: Any]
            else { continue }
            let rawValue = ((payload["runtimeType"] as? String) ?? (payload["source"] as? String) ?? "")
                .trimmingCharacters(in: .whitespacesAndNewlines)
                .lowercased()
            let runtimeType: String
            switch rawValue {
            case "openclaw", "open_claw", "open-claw":
                runtimeType = "openclaw"
            case "hermes":
                runtimeType = "hermes"
            default:
                continue
            }
            try database.run(
                "UPDATE runtime_bindings SET runtime_type=?,updated_at=? WHERE agent_id=? AND adapter_kind='railway_cloud'",
                [.text(runtimeType), .text(nowIso()), .text(agentId)]
            )
            if let harnessId = row["harness_id"]?.string {
                try database.run(
                    "UPDATE harnesses SET runtime_type=?,updated_at=? WHERE id=?",
                    [.text(runtimeType), .text(nowIso()), .text(harnessId)]
                )
            }
        }
    },

    Migration(version: 36, name: "restore_cached_claude_cloud_runtime_types") { database in
        // v35 repaired Hermes/OpenClaw values but omitted the already-supported
        // Claude Code runtime, leaving those cloud agents on a stale fallback.
        let rows = try database.all("""
        SELECT b.agent_id,b.harness_id,c.payload_json
        FROM runtime_bindings b
        JOIN cloud_replica_objects c
          ON c.object_type='agent' AND c.local_object_id=b.agent_id
        WHERE b.adapter_kind='railway_cloud' AND c.deleted_at IS NULL
        """)
        for row in rows {
            guard let agentId = row["agent_id"]?.string,
                  let payloadJSON = row["payload_json"]?.string,
                  let payloadData = payloadJSON.data(using: .utf8),
                  let payload = try? JSONSerialization.jsonObject(with: payloadData) as? [String: Any]
            else { continue }
            let rawValue = ((payload["runtimeType"] as? String) ?? (payload["source"] as? String) ?? "")
                .trimmingCharacters(in: .whitespacesAndNewlines)
                .lowercased()
            guard ["claude_code", "claude-code", "claude"].contains(rawValue) else { continue }
            try database.run(
                "UPDATE runtime_bindings SET runtime_type='claude_code',updated_at=? WHERE agent_id=? AND adapter_kind='railway_cloud'",
                [.text(nowIso()), .text(agentId)]
            )
            if let harnessId = row["harness_id"]?.string {
                try database.run(
                    "UPDATE harnesses SET runtime_type='claude_code',updated_at=? WHERE id=?",
                    [.text(nowIso()), .text(harnessId)]
                )
            }
        }
    },

    Migration(version: 37, name: "split_cloud_harnesses_by_runtime") { database in
        // Older clients attached every cloud agent in a workspace to one
        // mutable harness. Since a harness has one runtime_type, the last
        // synced agent made every other agent appear to use that runtime.
        // Runtime bindings are already per-agent and canonical, so materialize
        // a stable cloud harness for each link/runtime pair and repoint only
        // railway_cloud bindings. Legacy harnesses remain for safe rollback.
        let rows = try database.all("""
        SELECT b.id AS binding_id,
               b.runtime_type,
               COALESCE(
                 (SELECT c.sync_link_id
                    FROM cloud_replica_objects c
                   WHERE c.object_type='agent'
                     AND c.local_object_id=b.agent_id
                     AND c.deleted_at IS NULL
                   ORDER BY c.updated_at DESC
                   LIMIT 1),
                 (SELECT l.id
                    FROM agents a
                    JOIN workspace_sync_links l ON l.local_workspace_id=a.workspace_id
                   WHERE a.id=b.agent_id
                   ORDER BY l.updated_at DESC
                   LIMIT 1)
               ) AS sync_link_id
          FROM runtime_bindings b
         WHERE b.adapter_kind='railway_cloud'
        """)
        for row in rows {
            guard let bindingId = row["binding_id"]?.string,
                  let runtimeRaw = row["runtime_type"]?.string,
                  let runtimeType = RuntimeType(rawValue: runtimeRaw),
                  let syncLinkId = row["sync_link_id"]?.string,
                  !syncLinkId.isEmpty
            else { continue }
            let harnessId = "cloud_harness_\(syncLinkId)_\(runtimeType.rawValue)"
            let timestamp = nowIso()
            try database.run(
                """
                    INSERT INTO harnesses(id,runtime_type,display_name,mode,config_json,status,built_in,created_at,updated_at) \
                    VALUES(?,?,?,'app_managed','{\"executionAuthority\":\"railway\",\"kind\":\"cloud_runtime_proxy\"}','active',0,?,?) ON CONFLICT(id) DO UPDATE SET \
                    runtime_type=excluded.runtime_type,display_name=excluded.display_name,mode='app_managed',config_json=excluded.config_json,status='active',updated_at=excluded.updated_at
                    """,
                [.text(harnessId), .text(runtimeType.rawValue), .text("Relay Connect \(runtimeLabel(runtimeType))"), .text(timestamp), .text(timestamp)]
            )
            try database.run(
                "UPDATE runtime_bindings SET harness_id=?,updated_at=? WHERE id=? AND adapter_kind='railway_cloud'",
                [.text(harnessId), .text(timestamp), .text(bindingId)]
            )
        }
    },

    Migration(version: 38, name: "separate_local_harnesses_from_cloud_proxies") { database in
        // v37 correctly split cloud routing by runtime, but the local Harness
        // lifecycle lookup historically chose the newest active record for a
        // runtime. Explicitly identify every Relay Connect routing record so it
        // can never shadow or be mutated as a local runtime installation.
        let rows = try database.all("""
        SELECT DISTINCT h.id,h.runtime_type
          FROM harnesses h
          LEFT JOIN runtime_bindings b
            ON b.harness_id=h.id AND b.adapter_kind='railway_cloud'
         WHERE h.id LIKE 'cloud_harness_%'
            OR b.id IS NOT NULL
            OR json_extract(h.config_json, '$.executionAuthority')='railway'
        """)
        for row in rows {
            guard let harnessId = row["id"]?.string,
                  let runtimeRaw = row["runtime_type"]?.string,
                  let runtimeType = RuntimeType(rawValue: runtimeRaw)
            else { continue }
            try database.run(
                "UPDATE harnesses SET display_name=?,mode='app_managed',config_json='{\"executionAuthority\":\"railway\",\"kind\":\"cloud_runtime_proxy\"}',status='active',updated_at=? WHERE id=?",
                [.text("Relay Connect \(runtimeLabel(runtimeType))"), .text(nowIso()), .text(harnessId)]
            )
        }
    },

    Migration(version: 39, name: "runtime_authority_and_lifecycle_contract") { database in
        try? database.exec("ALTER TABLE agents ADD COLUMN lifecycle_status TEXT NOT NULL DEFAULT 'active';")
        try? database.exec("ALTER TABLE agents ADD COLUMN lifecycle_reason TEXT;")
        try? database.exec("ALTER TABLE agents ADD COLUMN retired_at TEXT;")
        try? database.exec("ALTER TABLE runtime_bindings ADD COLUMN runtime_host_id TEXT;")
        try? database.exec("ALTER TABLE runtime_bindings ADD COLUMN canonical_agent_id TEXT;")
        try? database.exec("ALTER TABLE runtime_bindings ADD COLUMN assignment_epoch INTEGER NOT NULL DEFAULT 0;")
        try? database.exec("ALTER TABLE runtime_bindings ADD COLUMN ownership_state TEXT NOT NULL DEFAULT 'local';")
        try? database.exec("ALTER TABLE runtime_bindings ADD COLUMN host_status TEXT NOT NULL DEFAULT 'online';")
        try? database.exec("ALTER TABLE agent_documents ADD COLUMN desired_version TEXT NOT NULL DEFAULT '1';")
        try? database.exec("ALTER TABLE agent_documents ADD COLUMN applied_version TEXT NOT NULL DEFAULT '0';")
        try? database.exec("ALTER TABLE agent_documents ADD COLUMN sync_state TEXT NOT NULL DEFAULT 'saved';")
        try? database.exec("ALTER TABLE agent_documents ADD COLUMN last_sync_error TEXT;")
        try? database.exec("ALTER TABLE agent_documents ADD COLUMN tombstoned_at TEXT;")
        try database.exec("""
        CREATE TABLE IF NOT EXISTS runtime_hosts (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          installation_id TEXT,
          remote_host_id TEXT,
          display_name TEXT NOT NULL,
          product_mode TEXT NOT NULL,
          host_kind TEXT NOT NULL,
          platform TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'offline',
          protocol_version TEXT,
          software_version TEXT,
          supported_runtimes_json TEXT NOT NULL DEFAULT '[]',
          last_seen_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_runtime_hosts_remote
          ON runtime_hosts(workspace_id, remote_host_id) WHERE remote_host_id IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_runtime_hosts_workspace_status
          ON runtime_hosts(workspace_id, status);

        CREATE TABLE IF NOT EXISTS runtime_observations (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
          runtime_host_id TEXT NOT NULL,
          runtime_type TEXT NOT NULL,
          external_agent_id TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'active',
          manifest_hash TEXT,
          quarantine_reason TEXT,
          last_seen_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE(workspace_id,runtime_host_id,runtime_type,external_agent_id)
        );

        CREATE TABLE IF NOT EXISTS agent_identity_suppressions (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          runtime_type TEXT NOT NULL,
          external_agent_id TEXT NOT NULL,
          runtime_host_id TEXT,
          reason TEXT NOT NULL,
          retired_at TEXT,
          lifted_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_agent_identity_suppressions_active
          ON agent_identity_suppressions(workspace_id,runtime_type,external_agent_id,lifted_at);
        """)
        let timestamp = nowIso()
        for workspace in try database.all("SELECT id,name FROM workspaces") {
            guard let workspaceId = workspace["id"]?.string else { continue }
            let hostId = "local_host_\(workspaceId)"
            try database.run(
                """
                    INSERT OR IGNORE INTO runtime_hosts(id,workspace_id,display_name,product_mode,host_kind,platform,status,protocol_version,software_version,supported_runtimes_json,last_seen_at,created_at,updated_at) \
                    VALUES(?,?,?,'local','swift_installation','macos','online','2',NULL,'[\"hermes\",\"openclaw\",\"claude_code\",\"codex_cli\"]',?,?,?)
                    """,
                [.text(hostId), .text(workspaceId), .text("This Mac — \(workspace["name"]?.string ?? "Relay Local")"), .text(timestamp), .text(timestamp), .text(timestamp)]
            )
            try database.run(
                "UPDATE runtime_bindings SET runtime_host_id=?,ownership_state='local',host_status='online' WHERE agent_id IN (SELECT id FROM agents WHERE workspace_id=?) AND adapter_kind<>'railway_cloud' AND runtime_host_id IS NULL",
                [.text(hostId), .text(workspaceId)]
            )
        }
    },

    Migration(version: 40, name: "explicit_relay_connect_agent_links") { database in
        try? database.exec("ALTER TABLE runtime_bindings ADD COLUMN connect_linked INTEGER NOT NULL DEFAULT 0;")
        try? database.exec("ALTER TABLE runtime_bindings ADD COLUMN connect_remote_agent_id TEXT;")
        try database.exec("CREATE INDEX IF NOT EXISTS idx_runtime_bindings_connect_linked ON runtime_bindings(connect_linked,agent_id);")
    },

    Migration(version: 41, name: "native_document_revision_state") { database in
        try database.exec("""
        CREATE TABLE IF NOT EXISTS native_document_sync_state (
          runtime_device_id TEXT NOT NULL REFERENCES cloud_runtime_devices(id) ON DELETE CASCADE,
          runtime_type TEXT NOT NULL,
          external_agent_id TEXT NOT NULL,
          folder TEXT NOT NULL DEFAULT '',
          filename TEXT NOT NULL,
          object_id TEXT NOT NULL,
          server_version TEXT NOT NULL,
          content_hash TEXT,
          acknowledgement_pending INTEGER NOT NULL DEFAULT 0,
          updated_at TEXT NOT NULL,
          PRIMARY KEY(runtime_device_id,runtime_type,external_agent_id,folder,filename)
        );
        CREATE INDEX IF NOT EXISTS idx_native_document_sync_ack
          ON native_document_sync_state(runtime_device_id,runtime_type,acknowledgement_pending);
        """)
    },

    Migration(version: 42, name: "coalesce_pending_cloud_mutations") { database in
        // Runtime status rows can change many times before a sync succeeds. A
        // separate outbox row for every snapshot multiplies the current payload
        // and can turn one bounded record into an oversized upload. Keep only
        // the newest unsent mutation for each object; acknowledged history is
        // retained for idempotency and diagnostics.
        try database.exec("""
        DELETE FROM sync_outbox
        WHERE state IN ('pending','retry')
          AND EXISTS (
            SELECT 1
            FROM sync_outbox newer
            WHERE newer.sync_link_id = sync_outbox.sync_link_id
              AND newer.object_type = sync_outbox.object_type
              AND newer.object_id = sync_outbox.object_id
              AND newer.state IN ('pending','retry')
              AND newer.rowid > sync_outbox.rowid
          );

        CREATE TRIGGER IF NOT EXISTS trg_sync_outbox_coalesce_pending
        AFTER INSERT ON sync_outbox
        WHEN NEW.state IN ('pending','retry')
        BEGIN
          DELETE FROM sync_outbox
          WHERE sync_link_id = NEW.sync_link_id
            AND object_type = NEW.object_type
            AND object_id = NEW.object_id
            AND state IN ('pending','retry')
            AND id <> NEW.id;
        END;
        """)
    },

    Migration(version: 43, name: "automatic_relay_connect_agent_links") { database in
        try? database.exec(
            "ALTER TABLE runtime_bindings ADD COLUMN connect_auto_link_suppressed INTEGER NOT NULL DEFAULT 0;"
        )
        try database.exec(
            "CREATE INDEX IF NOT EXISTS idx_runtime_bindings_connect_auto_link ON runtime_bindings(connect_auto_link_suppressed,connect_linked,agent_id);"
        )
    },

    Migration(version: 44, name: "stable_relay_host_installation_identity") { database in
        try? database.exec(
            "ALTER TABLE cloud_runtime_devices ADD COLUMN host_installation_id TEXT;"
        )
        try database.exec(
            "CREATE INDEX IF NOT EXISTS idx_cloud_runtime_devices_host_installation ON cloud_runtime_devices(host_installation_id);"
        )
    }
]

public func runMigrations(database: DatabaseService) throws {
    try database.exec("""
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
    """)
    let applied = try Set(database.all("SELECT version FROM schema_migrations").compactMap { row -> Int? in
        guard case .integer(let value)? = row["version"] else { return nil }
        return Int(value)
    })
    for migration in migrations where !applied.contains(migration.version) {
        try database.transaction {
            try migration.up(database)
            try database.run(
                "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)",
                [.integer(Int64(migration.version)), .text(migration.name), .text(nowIso())]
            )
        }
    }
}
