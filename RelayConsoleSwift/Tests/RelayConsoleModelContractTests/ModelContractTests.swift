import Foundation
import RelayConsoleCore

@main
struct RelayConsoleModelContractTests {
    static func main() throws {
        try run("JSONValue and JSONRecord round trips preserve values", testJSONValueRoundTrip)
        try run("runtime and harness enum raw values remain stable", testEnumRawValues)
        try run("message render plans preserve retained markdown/plain-text scope", testMessageRenderPlans)
        try run("runtime dispatch action state preserves retry/cancel contract", testRuntimeDispatchActionState)
        try run("runtime activity models preserve Hermes-style progress state", testRuntimeActivityModels)
        try run("current version 29 models round trip through Codable", testCurrentModelRoundTrips)
        try run("legacy profile workspace and chat contracts decode with current defaults", testVersionFiveProfileWorkspaceDefaults)
        try run("unknown web fields are ignored by current local models", testUnknownWebFieldsAreIgnored)
        try run("contract examples use redacted metadata or secret references", testSecretExamplesUseReferencesOnly)
        try run("contract fixture manifests match schema", testFixtureManifestsMatchSchema)
        print("RelayConsoleModelContractTests passed")
    }

    private static func run(_ name: String, _ test: () throws -> Void) throws {
        do {
            try test()
            print("ok - \(name)")
        } catch {
            print("not ok - \(name): \(error)")
            throw error
        }
    }

    private static func testJSONValueRoundTrip() throws {
        let value = try roundTrip(JSONValue.self, jsonValueJSON, "JSONValue")

        guard case .object(let object) = value,
              case .array(let items)? = object["items"]
        else {
            throw ModelContractFailure("JSONValue fixture did not decode as expected")
        }
        try expect(items[0] == .null, "null array item did not survive")
        try expect(items[1] == .string("alpha"), "string array item did not survive")
        try expect(items[2] == .number(2), "number array item did not survive")
        try expect(items[3] == .bool(true), "bool array item did not survive")
    }

    private static func testEnumRawValues() throws {
        try expectRawValues(RuntimeType.allCases, ["relay_echo", "hermes", "openclaw", "claude_code", "codex_cli"], "RuntimeType")
        try expectRawValues([HarnessMode.builtinTest, .userManaged, .appManaged, .bridgePluginCompat], ["builtin_test", "user_managed", "app_managed", "bridge_plugin_compat"], "HarnessMode")
        try expectRawValues([HarnessHealthStatus.unknown, .healthy, .degraded, .unhealthy, .missing, .authRequired], ["unknown", "healthy", "degraded", "unhealthy", "missing", "auth_required"], "HarnessHealthStatus")
        try expectRawValues(HarnessKey.allCases, ["hermes", "openclaw"], "HarnessKey")
        try expectRawValues([HarnessInstallSource.managed, .located, .missing], ["managed", "located", "missing"], "HarnessInstallSource")
        try expectRawValues([HarnessModelAuthStatus.unknown, .notConfigured, .checking, .connected, .failed], ["unknown", "not_configured", "checking", "connected", "failed"], "HarnessModelAuthStatus")
        try expectRawValues([HarnessLifecycleState.notInstalled, .installing, .installed, .starting, .connected, .authRequired, .chatNotWired, .error], ["not_installed", "installing", "installed", "starting", "connected", "auth_required", "chat_not_wired", "error"], "HarnessLifecycleState")
        try expectRawValues([SenderType.user, .agent, .system], ["user", "agent", "system"], "SenderType")
        try expectRawValues([MessageFormat.plain, .markdown], ["plain", "markdown"], "MessageFormat")
        try expectRawValues([DispatchStatus.queued, .started, .streaming, .completed, .failed, .cancelled], ["queued", "started", "streaming", "completed", "failed", "cancelled"], "DispatchStatus")
        try expectRawValues([RuntimeEventType.queued, .started, .status, .delta, .thinking, .tool, .context, .completed, .failed, .cancelled, .healthChanged], ["queued", "started", "status", "delta", "thinking", "tool", "context", "completed", "failed", "cancelled", "health_changed"], "RuntimeEventType")
        try expectRawValues(RuntimeRunConfirmationState.allCases, ["not_required", "pending", "accepted", "rejected", "unknown"], "RuntimeRunConfirmationState")
        try expectRawValues(RuntimeActivityKind.allCases, ["message", "thinking", "status", "tool", "tool_group", "task_list", "context", "terminal", "unknown"], "RuntimeActivityKind")
        try expectRawValues(RuntimeActivityPhase.allCases, ["pending", "running", "completed", "failed", "cancelled", "unknown"], "RuntimeActivityPhase")
        try expectRawValues(RuntimeActivityTaskStatus.allCases, ["pending", "in_progress", "completed", "cancelled", "unknown"], "RuntimeActivityTaskStatus")
        try expectRawValues(ThreadType.allCases, ["direct", "team", "department", "company_meeting", "agent_to_agent", "group_agent", "system", "approval", "incident", "report", "unknown"], "ThreadType")
        try expectRawValues(ThreadReadStateValue.allCases, ["read", "unread"], "ThreadReadStateValue")
        try expectRawValues(ThreadSessionStatus.allCases, ["active", "wrapped", "archived", "closed"], "ThreadSessionStatus")
        try expectRawValues(ThreadParticipantType.allCases, ["user", "agent", "team", "system"], "ThreadParticipantType")
        try expectRawValues(ThreadParticipantRole.allCases, ["owner", "manager", "member", "viewer"], "ThreadParticipantRole")
        try expectRawValues(ThreadWrapUpStatus.allCases, ["pending", "generating", "completed", "failed", "unavailable"], "ThreadWrapUpStatus")
        try expectRawValues(LocalSendState.allCases, ["pending", "failed", "dispatched"], "LocalSendState")
        try expectRawValues(ChatAttachmentKind.allCases, ["image", "audio", "video", "document", "file"], "ChatAttachmentKind")
        try expectRawValues(ChatAttachmentStatus.allCases, ["staged", "importing", "uploaded", "failed", "cancelled"], "ChatAttachmentStatus")
        try expectRawValues(ChatDocumentReferenceKind.allCases, ["document", "image", "code", "transcript", "unknown"], "ChatDocumentReferenceKind")
        try expectRawValues(AgentGroupType.allCases, ["personal", "family", "business", "unassigned"], "AgentGroupType")
        try expectRawValues(AgentResponsePresentation.allCases, ["markdown", "plain_text"], "AgentResponsePresentation")
        try expectRawValues(AgentProvisioningStatus.allCases, ["queued", "running", "completed", "failed", "cancelled", "auth_required", "missing_harness", "duplicate_id"], "AgentProvisioningStatus")
        try expectRawValues(AgentAvatarState.allCases, ["fallback", "illustrated", "uploaded", "no_avatar"], "AgentAvatarState")
        try expectRawValues(AgentTaskStatus.allCases, ["queued", "dispatched", "running", "blocked", "completed", "failed", "cancelled", "archived"], "AgentTaskStatus")
        try expectRawValues(AgentTaskPriority.allCases, ["low", "normal", "high", "critical"], "AgentTaskPriority")
        try expectRawValues(AgentTaskTargetType.allCases, ["direct", "team"], "AgentTaskTargetType")
        try expectRawValues(AgentTeamMemoryType.allCases, ["note", "rule", "context", "document", "SOP"], "AgentTeamMemoryType")
        try expectRawValues(AgentOpsLiveState.allCases, ["offline", "idle", "queued", "working", "thinking", "tooling", "waiting_for_approval", "error", "completed", "cancelled"], "AgentOpsLiveState")
        try expectRawValues(AgentOpsLiveStateSource.allCases, ["runtime_dispatch", "runtime_tool", "runtime_thinking", "task", "approval", "health", "message", "agent_status", "none"], "AgentOpsLiveStateSource")
        try expectRawValues(AgentOpsLiveStateConfidence.allCases, ["strong", "medium", "weak"], "AgentOpsLiveStateConfidence")
        try expectRawValues(AgentOpsVisualEntityKind.allCases, ["agent", "room", "app", "workflow", "output"], "AgentOpsVisualEntityKind")
        try expectRawValues(RuntimeDashboardSnapshotState.allCases, ["loading", "empty", "populated", "offline", "disabled", "stale", "error", "retry"], "RuntimeDashboardSnapshotState")
        try expectRawValues(RuntimeDashboardRowKind.allCases, ["runtime_harness", "connected_app"], "RuntimeDashboardRowKind")
        try expectRawValues(RuntimeDashboardRowStatus.allCases, ["connected", "degraded", "offline", "auth_required", "missing", "active", "failed", "idle"], "RuntimeDashboardRowStatus")
        try expectRawValues(RuntimeDashboardReachability.allCases, ["reachable", "unreachable", "unknown", "not_applicable"], "RuntimeDashboardReachability")
        try expectRawValues(RuntimeDashboardLocalStatusState.allCases, ["disabled", "unavailable"], "RuntimeDashboardLocalStatusState")
        try expectRawValues(RuntimeActionKind.allCases, ["cancel_dispatch", "retry_dispatch", "refresh_runtime_dashboard", "controlled_file_write", "controlled_provider_write", "host_control", "local_app_command"], "RuntimeActionKind")
        try expectRawValues(RuntimeActionAvailabilityState.allCases, ["available", "unsupported", "destructive_blocked", "missing_capability", "dry_run_only", "rejected", "failed", "running", "succeeded", "cancelled", "stale"], "RuntimeActionAvailabilityState")
        try expectRawValues(RuntimeActionRunStatus.allCases, ["dry_run", "rejected", "failed", "running", "succeeded", "cancelled", "unsupported", "stale"], "RuntimeActionRunStatus")
        try expectRawValues(RuntimeActionScopeType.allCases, ["workspace", "harness", "dispatch", "agent", "dashboard"], "RuntimeActionScopeType")
        try expectRawValues(RuntimeStructuredJobStatus.allCases, ["queued", "running", "completed", "failed", "cancelled"], "RuntimeStructuredJobStatus")
        try expectRawValues(RuntimeMissingToolStatus.allCases, ["requested", "unavailable", "resolved", "rejected"], "RuntimeMissingToolStatus")
        try expectRawValues(RuntimeRecoveryState.allCases, ["retryable", "terminal", "auth_required", "capability_missing", "participant_unhealthy", "context_warning", "source_host_excluded"], "RuntimeRecoveryState")
        try expectRawValues(WorkSafetyTaskStatus.allCases, ["pending", "queued", "dispatched", "running", "blocked", "blocked_by_approval", "completed", "failed", "cancelled"], "WorkSafetyTaskStatus")
        try expectRawValues(WorkSafetyTaskRunStatus.allCases, ["queued", "dispatched", "running", "blocked_by_approval", "completed", "failed", "cancelled"], "WorkSafetyTaskRunStatus")
        try expectRawValues(WorkSafetyTaskTargetType.allCases, ["agent", "team", "department", "thread", "runtime_binding", "action_run", "agent_to_agent"], "WorkSafetyTaskTargetType")
        try expectRawValues(WorkSafetyTaskEventType.allCases, ["created", "updated", "status_changed", "approval_requested", "approval_resolved", "dispatched", "cancelled", "failed", "completed", "relaunch_restored"], "WorkSafetyTaskEventType")
        try expectRawValues(WorkSafetyApprovalStatus.allCases, ["pending", "approved", "rejected", "expired", "cancelled"], "WorkSafetyApprovalStatus")
        try expectRawValues(WorkSafetyApprovalStepStatus.allCases, ["pending", "satisfied", "failed", "skipped"], "WorkSafetyApprovalStepStatus")
        try expectRawValues(WorkSafetyRiskLevel.allCases, ["low", "medium", "high", "destructive"], "WorkSafetyRiskLevel")
        try expectRawValues(PermissionPolicyEffect.allCases, ["allow", "deny"], "PermissionPolicyEffect")
        try expectRawValues(PermissionPolicyStatus.allCases, ["active", "disabled"], "PermissionPolicyStatus")
        try expectRawValues(PermissionPolicyDecision.allCases, ["allowed", "denied", "no_match"], "PermissionPolicyDecision")
        try expectRawValues(NativeFilePermissionTargetKind.allCases, ["file", "folder"], "NativeFilePermissionTargetKind")
        try expectRawValues(NativeFilePermissionAccessLevel.allCases, ["read_only", "read_write"], "NativeFilePermissionAccessLevel")
        try expectRawValues(NativeFilePermissionStatus.allCases, ["not_linked", "permission_needed", "linked", "read_only", "read_write_granted", "revoked", "unavailable", "synced", "stale", "sync_failed"], "NativeFilePermissionStatus")
        try expectRawValues(SettingsAlertSeverity.allCases, ["info", "success", "warning", "critical"], "SettingsAlertSeverity")
        try expectRawValues(NotificationDeliveryState.allCases, ["unavailable", "hidden"], "NotificationDeliveryState")
        try expectRawValues(SettingsDispositionState.allCases, ["available", "hidden", "unavailable", "decision_gated", "blocked", "approved", "external_link"], "SettingsDispositionState")
        try expectRawValues(SettingsSecurityBlockedAction.allCases, ["reset_local_data", "remove_local_profile", "change_password", "browser_sessions", "log_out", "support", "privacy", "terms", "status"], "SettingsSecurityBlockedAction")
        try expectRawValues(InsightsReportSourceFilter.allCases, ["all", "snapshots", "chat_reports"], "InsightsReportSourceFilter")
        try expectRawValues(InsightsReportSort.allCases, ["newest", "oldest", "title"], "InsightsReportSort")
        try expectRawValues(InsightsReportSourceType.allCases, ["snapshot", "chat_report"], "InsightsReportSourceType")
        try expectRawValues(InsightsReportListState.allCases, ["loading", "empty", "ready", "no_match", "error"], "InsightsReportListState")
        try expectRawValues(ToolRequestStatus.allCases, ["requested", "connected", "granted", "unavailable", "dismissed", "ignored", "resolved", "rejected"], "ToolRequestStatus")
        try expectRawValues(ToolRequestAvailabilityState.allCases, ["unknown", "not_connected", "connected", "granted", "unavailable"], "ToolRequestAvailabilityState")
        try expectRawValues(NeededToolsSnapshotState.allCases, ["loading", "empty", "ready", "read_only", "unavailable", "error"], "NeededToolsSnapshotState")
        try expectRawValues(ApplicationsCatalogState.allCases, ["loading", "ready", "empty", "no_match", "unavailable", "error"], "ApplicationsCatalogState")
        try expectRawValues(ApplicationsCatalogView.allCases, ["all", "external", "local", "connections", "installed", "review"], "ApplicationsCatalogView")
        try expectRawValues(MarketplaceAppSourceType.allCases, ["external_provider", "local_app_excluded"], "MarketplaceAppSourceType")
        try expectRawValues(MarketplaceRiskLevel.allCases, ["low", "medium", "high", "critical"], "MarketplaceRiskLevel")
        try expectRawValues(MarketplaceAppAvailabilityState.allCases, ["available", "beta_unavailable", "coming_soon", "unavailable"], "MarketplaceAppAvailabilityState")
        try expectRawValues(MarketplaceConnectionState.allCases, ["none", "connected", "unavailable"], "MarketplaceConnectionState")
        try expectRawValues(MarketplaceInstallState.allCases, ["not_installed", "installed", "unavailable"], "MarketplaceInstallState")
        try expectRawValues(MarketplaceInstallLifecycleStatus.allCases, ["requested", "installed", "failed", "removed", "superseded", "unavailable"], "MarketplaceInstallLifecycleStatus")
        try expectRawValues(MarketplaceInstallDriftStatus.allCases, ["unknown", "current", "refresh_needed", "unconfigured", "superseded", "runtime_files_not_removed"], "MarketplaceInstallDriftStatus")
        try expectRawValues(MarketplaceInstallTargetMode.allCases, ["existing_agent", "activate_new_agent_unavailable"], "MarketplaceInstallTargetMode")
        try expectRawValues(MarketplaceAgentCompatibilityStatus.allCases, ["compatible", "inactive_agent", "runtime_unsupported", "role_unsupported", "missing_runtime_binding", "unavailable"], "MarketplaceAgentCompatibilityStatus")
        try expectRawValues(MarketplaceInstallSnapshotState.allCases, ["loading", "empty", "ready", "read_only", "unavailable", "error"], "MarketplaceInstallSnapshotState")
        try expectRawValues(ProviderConnectionStatus.allCases, ["disconnected", "connected", "expired", "auth_required", "health_error", "validating", "sender_invalid", "disconnecting", "reauthorize_required", "unavailable"], "ProviderConnectionStatus")
        try expectRawValues(ProviderAuthorizationState.allCases, ["not_started", "pending", "deep_link_pending", "manual_evidence_required", "completed", "error", "unavailable"], "ProviderAuthorizationState")
        try expectRawValues(ProviderSecretReferenceStatus.allCases, ["missing", "referenced", "verified", "unavailable"], "ProviderSecretReferenceStatus")
        try expectRawValues(ProviderCredentialOwnership.allCases, ["user_owned", "relay_owned", "shared_relay_excluded", "not_required"], "ProviderCredentialOwnership")
        try expectRawValues(ProviderConnectorHealthState.allCases, ["unknown", "ready", "degraded", "error", "validating", "unavailable"], "ProviderConnectorHealthState")
        try expectRawValues(ProviderSenderIdentityStatus.allCases, ["not_required", "unverified", "verified", "invalid", "checking"], "ProviderSenderIdentityStatus")
        try expectRawValues(ProviderConnectionSnapshotState.allCases, ["loading", "empty", "ready", "read_only", "unavailable", "error"], "ProviderConnectionSnapshotState")
        try expectRawValues(ProviderActionKind.allCases, ["read", "search", "draft", "message", "write", "delete", "admin"], "ProviderActionKind")
        try expectRawValues(ProviderActionRiskLevel.allCases, ["low", "medium", "high", "destructive"], "ProviderActionRiskLevel")
        try expectRawValues(ProviderAdapterKind.allCases, ["official_mcp", "community_mcp", "native_api", "browser_automation", "local_script", "manual_only", "unsupported"], "ProviderAdapterKind")
        try expectRawValues(ProviderActionPermission.allCases, ["allowed", "approval_required", "auto_execute", "blocked"], "ProviderActionPermission")
        try expectRawValues(MarketplaceActionPolicyPreset.allCases, ["read_only", "approval_required", "allow_direct_writes", "blocked"], "MarketplaceActionPolicyPreset")
        try expectRawValues(ProviderActionExecutionStatus.allCases, ["queued", "pending_approval", "approved", "auto_executed", "blocked", "running", "succeeded", "failed", "cancelled", "expired"], "ProviderActionExecutionStatus")
    }

    private static func testMessageRenderPlans() throws {
        let markdown = MessageRenderer.plan(
            content: "# Title\n\n- retained **markdown**",
            format: .markdown
        )
        try expect(markdown.renderedFormat == .markdown, "markdown content should render as retained markdown")
        try expect(markdown.copyText.contains("retained **markdown**"), "markdown copy text should preserve source markdown")
        try expect(!markdown.excludedHTMLNative, "markdown should not be marked HTML-native")
        let markdownBlocks = MessageRenderer.blocks(for: markdown)
        try expect(markdownBlocks.map(\.kind) == [.heading, .unorderedList], "markdown blocks should preserve heading and list structure")
        try expect(markdownBlocks[1].items.first?.text == "retained **markdown**", "markdown list item should preserve inline markdown source")

        let paragraphMarkdown = MessageRenderer.plan(
            content: "The workspace is open.\n\nSend me what you want.",
            format: .markdown
        )
        let paragraphBlocks = MessageRenderer.blocks(for: paragraphMarkdown)
        try expect(paragraphBlocks.map(\.kind) == [.paragraph, .paragraph], "markdown paragraph breaks should survive block planning")
        try expect(paragraphBlocks.map(\.text) == ["The workspace is open.", "Send me what you want."], "paragraph block text should not be joined")

        let listMarkdown = MessageRenderer.plan(
            content: "Known for:\n- **St Agnes Head** coastal walks\n- **Trevaunance Cove** beach\n- Tin mining heritage",
            format: .markdown
        )
        let listBlocks = MessageRenderer.blocks(for: listMarkdown)
        try expect(listBlocks.map(\.kind) == [.paragraph, .unorderedList], "markdown lists should be split from the lead-in paragraph")
        try expect(listBlocks[1].items.map(\.text) == [
            "**St Agnes Head** coastal walks",
            "**Trevaunance Cove** beach",
            "Tin mining heritage"
        ], "markdown list items should remain separate instead of concatenating")

        let plain = MessageRenderer.plan(content: "Plain text only", format: .plain)
        try expect(plain.renderedFormat == .plain, "plain content should render as plain text")
        try expect(plain.copyText == "Plain text only", "plain copy text should remain unchanged")
        try expect(MessageRenderer.blocks(for: plain).map(\.text) == ["Plain text only"], "plain text should remain a single plain block")

        let long = MessageRenderer.plan(content: String(repeating: "Long line\n", count: 30), format: .markdown)
        try expect(long.isLong, "long line count should require long-message handling")

        let excludedByMetadata = MessageRenderer.plan(
            content: "<section class=\"cc-html-reply\">HTML source evidence</section>",
            format: .markdown,
            metadata: ["responsePresentation": .string("html_native")]
        )
        try expect(excludedByMetadata.renderedFormat == .plain, "html_native metadata should fall back to plain text")
        try expect(excludedByMetadata.excludedHTMLNative, "html_native metadata should be flagged as excluded")
        try expect(excludedByMetadata.warnings.contains("HTML-native rendering is excluded in Relay Console Swift."), "excluded HTML-native warning missing")
    }

    private static func testRuntimeDispatchActionState() throws {
        let failed = try decode(RuntimeDispatch.self, runtimeDispatchJSON)
        try expect(failed.status == .failed, "runtime dispatch fixture should be failed")
        try expect(failed.runtimeType == .hermes, "runtime type should be derived from snapshot")
        try expect(failed.attempt == 2, "attempt should be derived from snapshot")
        try expect(failed.retryable, "failed fixture should preserve retryable flag")
        try expect(failed.retrySourceMessageId == "msg-contract-001", "retry source message should be preserved")
        try expect(failed.retrySafetyEvidenceId == "dispatch.retry.contract-001", "retry evidence id should be preserved")

        let retryState = failed.actionState(
            capabilities: nil,
            hasActiveDispatchForThread: false,
            sourceMessageExists: true,
            sourceHasRetryableContent: true
        )
        try expect(retryState.canRetry, "retry should be allowed with source message, content, and evidence")
        try expect(retryState.retryReason == .available, "retry reason should be available")

        let active = try decode(RuntimeDispatch.self, activeRuntimeDispatchJSON)
        let capabilities = try decode(RuntimeCapabilities.self, runtimeCapabilitiesJSON)
        let cancelState = active.actionState(
            capabilities: capabilities,
            hasActiveDispatchForThread: false,
            sourceMessageExists: true,
            sourceHasRetryableContent: true
        )
        try expect(cancelState.canCancel, "active Hermes dispatch should allow cancel when capability exists")

        let unsupported = RuntimeCapabilities(
            runtimeType: .openclaw,
            supportsStreaming: false,
            supportsCancellation: false,
            supportsSessions: true,
            supportsTools: true,
            requiresWorkspaceFolder: false,
            requiresSecret: false,
            maxConcurrentDispatches: 1,
            eventTypes: []
        )
        let unsupportedCancel = active.actionState(
            capabilities: unsupported,
            hasActiveDispatchForThread: false,
            sourceMessageExists: true,
            sourceHasRetryableContent: true
        )
        try expect(!unsupportedCancel.canCancel, "unsupported runtime should not expose cancel")
        try expect(unsupportedCancel.cancelReason == .capabilityMissing, "unsupported cancel should cite capability")

        let pendingRun = try decode(RuntimeDispatch.self, runtimeDispatchPendingRunConfirmationJSON)
        try expect(pendingRun.status == .queued, "pending Run confirmation should use queued dispatch status")
        try expect(pendingRun.runConfirmationRequired, "pending Run confirmation should expose required metadata")
        try expect(pendingRun.isRunConfirmationPending, "pending Run confirmation helper should be true")
        try expect(pendingRun.runConfirmationState == .pending, "pending Run confirmation state should decode")
        try expect(pendingRun.runConfirmationTitle == "Run Contract Agent", "pending Run confirmation title should decode")

        let rejectedRun = try decode(RuntimeDispatch.self, runtimeDispatchRejectedRunConfirmationJSON)
        try expect(rejectedRun.status == .cancelled, "rejected Run confirmation should use cancelled dispatch status")
        try expect(rejectedRun.runConfirmationState == .rejected, "rejected Run confirmation should prefer error snapshot state")
        try expect(!rejectedRun.isRunConfirmationPending, "rejected Run confirmation should not stay pending")
    }

    private static func testRuntimeActivityModels() throws {
        let projection = try roundTrip(RuntimeActivityProjection.self, runtimeActivityProjectionJSON, "RuntimeActivityProjection")

        try expect(projection.schemaVersion == RuntimeActivityProjection.currentSchemaVersion, "runtime activity schema version should default to current")
        try expect(RuntimeActivityProjection.snapshotKey == "runtimeActivityProjection", "runtime activity snapshot key changed")
        try expect(projection.dispatchId == "rtd-contract-active-001", "projection dispatch id did not decode")
        try expect(projection.items.count == 3, "projection should preserve activity rows")
        try expect(projection.toolGroups.count == 1, "projection should preserve grouped tool rows")
        try expect(projection.tasks.count == 2, "projection should preserve task-list rows")
        try expect(projection.lastEventType == "tool.progress", "projection should preserve future-safe last event type")

        let tool = projection.items[0]
        try expect(tool.kind == .tool, "tool row should decode as tool")
        try expect(tool.kindRawValue == "tool", "tool raw kind should be preserved")
        try expect(tool.phase == .running, "tool row should be running")
        try expect(tool.groupId == "group-tool-actions-1", "tool group id should be preserved")
        try expect(tool.eventIds == ["rte-tool-start", "rte-tool-progress"], "tool event ids should be preserved")
        try expect(tool.detail["command"] == .string("[REDACTED]"), "tool detail should preserve redacted command")

        let group = projection.toolGroups[0]
        try expect(group.phase == .running, "tool group should be running while one step is active")
        try expect(group.itemIds == ["activity-tool-1"], "tool group should preserve member ids")
        try expect(group.runningCount == 1 && group.completedCount == 0 && group.failedCount == 0, "tool group counters should survive")

        let completedTask = projection.tasks[0]
        try expect(completedTask.status == .completed, "completed task should decode")
        try expect(completedTask.sourceToolCallId == "todo-live", "task source tool call should decode")

        let futureTask = projection.tasks[1]
        try expect(futureTask.status == .unknown, "future task status should map to unknown")
        try expect(futureTask.statusRawValue == "deferred", "future task status raw value should survive")

        let futureItem = projection.items[2]
        try expect(futureItem.kind == .unknown, "future activity kind should map to unknown")
        try expect(futureItem.kindRawValue == "future_activity", "future activity kind raw value should survive")
        try expect(futureItem.phase == .unknown, "future activity phase should map to unknown")
        try expect(futureItem.phaseRawValue == "paused", "future activity phase raw value should survive")

        let encoded = try encodedString(projection)
        try expect(encoded.contains("\"future_activity\""), "future activity kind raw value should re-encode")
        try expect(encoded.contains("\"deferred\""), "future task status raw value should re-encode")

        let persistedDispatch = try roundTrip(RuntimeDispatch.self, runtimeDispatchWithActivityProjectionJSON, "RuntimeDispatch with runtime activity projection")
        try expect(persistedDispatch.hasRuntimeActivityProjection, "dispatch should report persisted runtime activity projection")
        try expect(persistedDispatch.runtimeActivityProjection.items.count == 3, "dispatch should expose persisted projection items")
        try expect(persistedDispatch.runtimeActivityProjection.tasks[1].statusRawValue == "deferred", "dispatch should expose future task status raw value")

        let legacyDispatch = try decode(RuntimeDispatch.self, activeRuntimeDispatchJSON)
        try expect(!legacyDispatch.hasRuntimeActivityProjection, "legacy dispatch should not claim activity projection")
        try expect(legacyDispatch.runtimeActivityProjection.dispatchId == legacyDispatch.id, "legacy dispatch should expose an empty projection scoped to dispatch id")
        try expect(legacyDispatch.runtimeActivityProjection.isEmpty, "legacy dispatch empty projection should remain empty")
    }

    private static func testCurrentModelRoundTrips() throws {
        _ = try roundTrip(LocalProfile.self, localProfileJSON, "LocalProfile")
        _ = try roundTrip(Workspace.self, workspaceJSON, "Workspace")
        _ = try roundTrip(Harness.self, harnessJSON, "Harness")
        _ = try roundTrip(HarnessHealth.self, harnessHealthJSON, "HarnessHealth")
        _ = try roundTrip(RuntimeCapabilities.self, runtimeCapabilitiesJSON, "RuntimeCapabilities")
        _ = try roundTrip(Agent.self, agentJSON, "Agent")
        _ = try roundTrip(AgentOrgCompany.self, agentOrgCompanyJSON, "AgentOrgCompany")
        _ = try roundTrip(AgentOrgDepartment.self, agentOrgDepartmentJSON, "AgentOrgDepartment")
        _ = try roundTrip(AgentOrgTeam.self, agentOrgTeamJSON, "AgentOrgTeam")
        _ = try roundTrip(AgentManagerRelationship.self, agentManagerRelationshipJSON, "AgentManagerRelationship")
        _ = try roundTrip(AgentProvisioningJob.self, agentProvisioningJobJSON, "AgentProvisioningJob")
        _ = try roundTrip(AgentPreferences.self, agentPreferencesJSON, "AgentPreferences")
        _ = try roundTrip(AgentTask.self, agentTaskJSON, "AgentTask")
        _ = try roundTrip(AgentTaskRun.self, agentTaskRunJSON, "AgentTaskRun")
        _ = try roundTrip(AgentTeamMemoryEntry.self, agentTeamMemoryEntryJSON, "AgentTeamMemoryEntry")
        _ = try roundTrip(AgentTeamHandover.self, agentTeamHandoverJSON, "AgentTeamHandover")
        _ = try roundTrip(AgentStructureDashboardSnapshot.self, agentStructureDashboardJSON, "AgentStructureDashboardSnapshot")
        _ = try roundTrip(AgentWorkCalendarSnapshot.self, agentWorkCalendarJSON, "AgentWorkCalendarSnapshot")
        _ = try roundTrip(RuntimeDashboardAssignedAgentIndicator.self, runtimeDashboardAssignedAgentJSON, "RuntimeDashboardAssignedAgentIndicator")
        _ = try roundTrip(RuntimeDashboardRow.self, runtimeDashboardRowJSON, "RuntimeDashboardRow")
        _ = try roundTrip(RuntimeDashboardSnapshot.self, runtimeDashboardSnapshotJSON, "RuntimeDashboardSnapshot")
        _ = try roundTrip(RuntimeActionCapability.self, runtimeActionCapabilityJSON, "RuntimeActionCapability")
        _ = try roundTrip(RuntimeActionRun.self, runtimeActionRunJSON, "RuntimeActionRun")
        _ = try roundTrip(ControlledActionRequest.self, controlledActionRequestJSON, "ControlledActionRequest")
        _ = try roundTrip(RuntimeContextUsageRecord.self, runtimeContextUsageJSON, "RuntimeContextUsageRecord")
        _ = try roundTrip(RuntimeParticipantHealthRecord.self, runtimeParticipantHealthJSON, "RuntimeParticipantHealthRecord")
        _ = try roundTrip(RuntimeStructuredJob.self, runtimeStructuredJobJSON, "RuntimeStructuredJob")
        _ = try roundTrip(RuntimeMissingToolEvent.self, runtimeMissingToolEventJSON, "RuntimeMissingToolEvent")
        _ = try roundTrip(RuntimeRecoveryRecord.self, runtimeRecoveryRecordJSON, "RuntimeRecoveryRecord")
        _ = try roundTrip(WorkSafetyLinkedReferences.self, workSafetyLinkedReferencesJSON, "WorkSafetyLinkedReferences")
        _ = try roundTrip(WorkSafetyTaskRecord.self, workSafetyTaskRecordJSON, "WorkSafetyTaskRecord")
        _ = try roundTrip(WorkSafetyTaskRunRecord.self, workSafetyTaskRunRecordJSON, "WorkSafetyTaskRunRecord")
        _ = try roundTrip(WorkSafetyTaskEventRecord.self, workSafetyTaskEventRecordJSON, "WorkSafetyTaskEventRecord")
        _ = try roundTrip(WorkSafetyApprovalStepRecord.self, workSafetyApprovalStepRecordJSON, "WorkSafetyApprovalStepRecord")
        _ = try roundTrip(WorkSafetyApprovalNoteRecord.self, workSafetyApprovalNoteRecordJSON, "WorkSafetyApprovalNoteRecord")
        _ = try roundTrip(WorkSafetyApprovalRecord.self, workSafetyApprovalRecordJSON, "WorkSafetyApprovalRecord")
        _ = try roundTrip(PermissionPolicyRecord.self, permissionPolicyRecordJSON, "PermissionPolicyRecord")
        _ = try roundTrip(PermissionPolicyEvaluation.self, permissionPolicyEvaluationJSON, "PermissionPolicyEvaluation")
        _ = try roundTrip(AuditLogRecord.self, auditLogRecordJSON, "AuditLogRecord")
        _ = try roundTrip(AuditLogPage.self, auditLogPageJSON, "AuditLogPage")
        _ = try roundTrip(SecurityMetricSnapshot.self, securityMetricSnapshotJSON, "SecurityMetricSnapshot")
        _ = try roundTrip(NativeFilePermissionRecord.self, nativeFilePermissionRecordJSON, "NativeFilePermissionRecord")
        _ = try roundTrip(SettingsAlertRecord.self, settingsAlertRecordJSON, "SettingsAlertRecord")
        _ = try roundTrip(SettingsNotificationPreferences.self, settingsNotificationPreferencesJSON, "SettingsNotificationPreferences")
        _ = try roundTrip(SettingsHarnessSummary.self, settingsHarnessSummaryJSON, "SettingsHarnessSummary")
        _ = try roundTrip(SettingsIntegrationSummary.self, settingsIntegrationSummaryJSON, "SettingsIntegrationSummary")
        _ = try roundTrip(SettingsDecisionGateDisposition.self, settingsDecisionGateDispositionJSON, "SettingsDecisionGateDisposition")
        _ = try roundTrip(SettingsSecurityActionDisposition.self, settingsSecurityActionDispositionJSON, "SettingsSecurityActionDisposition")
        _ = try roundTrip(SettingsLocalAccountExportRecord.self, settingsLocalAccountExportRecordJSON, "SettingsLocalAccountExportRecord")
        _ = try roundTrip(SettingsSecuritySummary.self, settingsSecuritySummaryJSON, "SettingsSecuritySummary")
        _ = try roundTrip(InsightsReportSnapshot.self, insightsReportSnapshotJSON, "InsightsReportSnapshot")
        _ = try roundTrip(InsightsReportRow.self, insightsReportRowJSON, "InsightsReportRow")
        _ = try roundTrip(InsightsReportGroup.self, insightsReportGroupJSON, "InsightsReportGroup")
        _ = try roundTrip(InsightsReportListSnapshot.self, insightsReportListSnapshotJSON, "InsightsReportListSnapshot")
        _ = try roundTrip(InsightsViewState.self, insightsViewStateJSON, "InsightsViewState")
        _ = try roundTrip(InsightsReportDetail.self, insightsReportDetailJSON, "InsightsReportDetail")
        _ = try roundTrip(ThreadAnalyticsSender.self, threadAnalyticsSenderJSON, "ThreadAnalyticsSender")
        _ = try roundTrip(ThreadAnalyticsActivePeriod.self, threadAnalyticsActivePeriodJSON, "ThreadAnalyticsActivePeriod")
        _ = try roundTrip(ThreadAnalyticsSession.self, threadAnalyticsSessionJSON, "ThreadAnalyticsSession")
        _ = try roundTrip(ThreadAnalyticsSnapshot.self, threadAnalyticsSnapshotJSON, "ThreadAnalyticsSnapshot")
        _ = try roundTrip(AuditLogQuery.self, auditLogQueryJSON, "AuditLogQuery")
        _ = try roundTrip(AuditLogRecordRequest.self, auditLogRecordRequestJSON, "AuditLogRecordRequest")
        _ = try roundTrip(ToolRequestSuggestedApp.self, toolRequestSuggestedAppJSON, "ToolRequestSuggestedApp")
        _ = try roundTrip(ToolRequestRecord.self, toolRequestRecordJSON, "ToolRequestRecord")
        _ = try roundTrip(NeededToolsSummary.self, neededToolsSummaryJSON, "NeededToolsSummary")
        _ = try roundTrip(NeededToolsDiagnostics.self, neededToolsDiagnosticsJSON, "NeededToolsDiagnostics")
        _ = try roundTrip(NeededToolsSnapshot.self, neededToolsSnapshotJSON, "NeededToolsSnapshot")
        _ = try roundTrip(MarketplaceInstallRoleDefinition.self, marketplaceInstallRoleDefinitionJSON, "MarketplaceInstallRoleDefinition")
        _ = try roundTrip(MarketplaceCompatibleAgentTarget.self, marketplaceCompatibleAgentTargetJSON, "MarketplaceCompatibleAgentTarget")
        _ = try roundTrip(MarketplaceInstallRequest.self, marketplaceInstallRequestJSON, "MarketplaceInstallRequest")
        _ = try roundTrip(MarketplaceInstallRecord.self, marketplaceInstallRecordJSON, "MarketplaceInstallRecord")
        _ = try roundTrip(MarketplaceInstallDiagnostics.self, marketplaceInstallDiagnosticsJSON, "MarketplaceInstallDiagnostics")
        _ = try roundTrip(MarketplaceInstallSnapshot.self, marketplaceInstallSnapshotJSON, "MarketplaceInstallSnapshot")
        _ = try roundTrip(MarketplaceRoleManifest.self, marketplaceRoleManifestJSON, "MarketplaceRoleManifest")
        _ = try roundTrip(MarketplaceIconFallback.self, marketplaceIconFallbackJSON, "MarketplaceIconFallback")
        _ = try roundTrip(MarketplaceCatalogApp.self, marketplaceCatalogAppJSON, "MarketplaceCatalogApp")
        _ = try roundTrip(ApplicationsCatalogTab.self, applicationsCatalogTabJSON, "ApplicationsCatalogTab")
        _ = try roundTrip(ApplicationsCatalogFilter.self, applicationsCatalogFilterJSON, "ApplicationsCatalogFilter")
        _ = try roundTrip(ApplicationsCatalogDiagnostics.self, applicationsCatalogDiagnosticsJSON, "ApplicationsCatalogDiagnostics")
        _ = try roundTrip(ApplicationsCatalogSnapshot.self, applicationsCatalogSnapshotJSON, "ApplicationsCatalogSnapshot")
        _ = try roundTrip(ProviderCredentialRequirement.self, providerCredentialRequirementJSON, "ProviderCredentialRequirement")
        _ = try roundTrip(ProviderConnectorHealth.self, providerConnectorHealthJSON, "ProviderConnectorHealth")
        _ = try roundTrip(ProviderSenderIdentity.self, providerSenderIdentityJSON, "ProviderSenderIdentity")
        _ = try roundTrip(MarketplaceProviderConnection.self, marketplaceProviderConnectionJSON, "MarketplaceProviderConnection")
        _ = try roundTrip(ProviderAuthorizationFlow.self, providerAuthorizationFlowJSON, "ProviderAuthorizationFlow")
        _ = try roundTrip(ProviderConnectionDiagnostics.self, providerConnectionDiagnosticsJSON, "ProviderConnectionDiagnostics")
        _ = try roundTrip(ProviderConnectionSnapshot.self, providerConnectionSnapshotJSON, "ProviderConnectionSnapshot")
        _ = try roundTrip(MarketplaceProviderActionDefinition.self, marketplaceProviderActionDefinitionJSON, "MarketplaceProviderActionDefinition")
        _ = try roundTrip(MarketplaceActionPermissionMap.self, marketplaceActionPermissionMapJSON, "MarketplaceActionPermissionMap")
        _ = try roundTrip(ProviderActionApprovalReference.self, providerActionApprovalReferenceJSON, "ProviderActionApprovalReference")
        _ = try roundTrip(MarketplaceProviderActionApprovalRecord.self, marketplaceProviderActionApprovalRecordJSON, "MarketplaceProviderActionApprovalRecord")
        _ = try roundTrip(ProviderExecutionAuditIdentity.self, providerExecutionAuditIdentityJSON, "ProviderExecutionAuditIdentity")
        _ = try roundTrip(MarketplaceProviderActionExecutionRecord.self, marketplaceProviderActionExecutionRecordJSON, "MarketplaceProviderActionExecutionRecord")
        _ = try roundTrip(AgentOpsRuntimeOverviewSummary.self, agentOpsRuntimeOverviewSummaryJSON, "AgentOpsRuntimeOverviewSummary")
        _ = try roundTrip(AgentOpsLiveAgentState.self, agentOpsLiveAgentStateJSON, "AgentOpsLiveAgentState")
        _ = try roundTrip(AgentOpsEventFeedItem.self, agentOpsEventFeedItemJSON, "AgentOpsEventFeedItem")
        _ = try roundTrip(AgentOpsRuntimeOverviewSnapshot.self, agentOpsRuntimeOverviewSnapshotJSON, "AgentOpsRuntimeOverviewSnapshot")
        _ = try roundTrip(AgentOpsLiveStateSnapshot.self, agentOpsLiveStateSnapshotJSON, "AgentOpsLiveStateSnapshot")
        _ = try roundTrip(AgentOpsVisualRect.self, agentOpsVisualRectJSON, "AgentOpsVisualRect")
        _ = try roundTrip(AgentOpsVisualPoint.self, agentOpsVisualPointJSON, "AgentOpsVisualPoint")
        _ = try roundTrip(AgentOpsVisualFloor.self, agentOpsVisualFloorJSON, "AgentOpsVisualFloor")
        _ = try roundTrip(AgentOpsVisualRoom.self, agentOpsVisualRoomJSON, "AgentOpsVisualRoom")
        _ = try roundTrip(AgentOpsVisualEntity.self, agentOpsVisualEntityJSON, "AgentOpsVisualEntity")
        _ = try roundTrip(AgentOpsVisualConnection.self, agentOpsVisualConnectionJSON, "AgentOpsVisualConnection")
        _ = try roundTrip(AgentOpsVisualSceneSummary.self, agentOpsVisualSceneSummaryJSON, "AgentOpsVisualSceneSummary")
        _ = try roundTrip(AgentOpsVisualSceneSnapshot.self, agentOpsVisualSceneSnapshotJSON, "AgentOpsVisualSceneSnapshot")
        let legacyRuntimeBinding = try roundTrip(RuntimeBinding.self, runtimeBindingJSON, "RuntimeBinding")
        try expect(legacyRuntimeBinding.assignmentEpoch == 0, "legacy runtime bindings should default to assignment epoch zero")
        try expect(legacyRuntimeBinding.ownershipState == "local", "legacy runtime bindings should retain local execution ownership")
        try expect(legacyRuntimeBinding.hostStatus == "online", "legacy local runtime bindings should remain available")
        try expect(!legacyRuntimeBinding.connectLinked, "legacy runtime bindings must not become Relay Connect links")
        _ = try roundTrip(AgentWithBinding.self, agentWithBindingJSON, "AgentWithBinding")
        _ = try roundTrip(ThreadSummary.self, threadSummaryJSON, "ThreadSummary")
        _ = try roundTrip(Message.self, messageJSON, "Message")
        _ = try roundTrip(ChatComposerDraft.self, chatComposerDraftJSON, "ChatComposerDraft")
        _ = try roundTrip(ChatMentionAvailability.self, chatMentionAvailabilityJSON, "ChatMentionAvailability")
        _ = try roundTrip(ChatAttachment.self, chatAttachmentJSON, "ChatAttachment")
        _ = try roundTrip(ChatDocumentReference.self, chatDocumentReferenceJSON, "ChatDocumentReference")
        _ = try roundTrip(ThreadDetail.self, threadDetailJSON, "ThreadDetail")
        _ = try roundTrip(ChatSession.self, chatSessionJSON, "ChatSession")
        _ = try roundTrip(ThreadParticipant.self, threadParticipantJSON, "ThreadParticipant")
        _ = try roundTrip(ThreadReadState.self, threadReadStateJSON, "ThreadReadState")
        _ = try roundTrip(ThreadWrapUpReport.self, threadWrapUpReportJSON, "ThreadWrapUpReport")
        _ = try roundTrip(RuntimeSession.self, runtimeSessionJSON, "RuntimeSession")
        _ = try roundTrip(RuntimeDispatch.self, runtimeDispatchJSON, "RuntimeDispatch")
        _ = try roundTrip(LogEvent.self, logEventJSON, "LogEvent")
        _ = try roundTrip(SecretReference.self, secretReferenceJSON, "SecretReference")
        _ = try roundTrip(AppState.self, appStateJSON, "AppState")
        _ = try roundTrip(RuntimeEvent.self, runtimeEventJSON, "RuntimeEvent")
    }

    private static func testUnknownWebFieldsAreIgnored() throws {
        let thread = try decode(ThreadDetail.self, threadDetailWithUnknownWebFieldsJSON)

        try expect(thread.id == "thr-contract-001", "thread id did not decode")
        try expect(thread.messages.count == 1, "thread messages did not decode")
        try expect(thread.participants.count == 1, "thread participant did not decode")
        try expect(thread.sessions.count == 1, "thread session did not decode")
        try expect(thread.readStates.count == 1, "thread read state did not decode")
        try expect(thread.wrapUpReports.count == 1, "thread wrap-up report did not decode")
        try expect(thread.messages[0].metadata["unsupportedWebField"] == .string("fixture-recorded"), "metadata dictionary did not preserve explicit unknown field fixture")
    }

    private static func testVersionFiveProfileWorkspaceDefaults() throws {
        let profile = try decode(LocalProfile.self, legacyLocalProfileJSON)
        let workspace = try decode(Workspace.self, legacyWorkspaceJSON)
        let thread = try decode(ThreadSummary.self, legacyThreadSummaryJSON)
        let message = try decode(Message.self, legacyMessageJSON)
        let agent = try decode(Agent.self, legacyAgentJSON)
        let htmlNativeAgent = try decode(Agent.self, agentHTMLNativeJSON)

        try expect(profile.email == nil, "legacy profile should not invent email")
        try expect(profile.avatarUrl == nil, "legacy profile should not invent avatar")
        try expect(!profile.telemetryEnabled, "legacy profile should default telemetry to disabled")
        try expect(!profile.crashReportingEnabled, "legacy profile should default crash reporting to disabled")
        try expect(profile.theme == "classic", "legacy profile should default theme to classic")
        try expect(workspace.workspaceType == "personal", "legacy workspace should default type to personal")
        try expect(workspace.settings.isEmpty, "legacy workspace should default settings to empty")
        try expect(thread.threadType == .direct, "legacy thread should default type to direct")
        try expect(thread.readState == .read, "legacy thread should default read state to read")
        try expect(thread.unreadCount == 0, "legacy thread should not invent unread count")
        try expect(thread.activeSessionId == nil, "legacy thread should not invent active session id")
        try expect(message.threadSessionId == nil, "legacy message should not invent session id")
        try expect(agent.groupType == nil, "legacy agent should not invent group type")
        try expect(agent.companyId == nil, "legacy agent should not invent company id")
        try expect(agent.responsePresentation == nil, "legacy agent should not invent response presentation")
        try expect(agent.metrics.isEmpty, "legacy agent should default metrics to empty")
        try expect(agent.budget.isEmpty, "legacy agent should default budget to empty")
        try expect(htmlNativeAgent.responsePresentation == nil, "html_native response presentation remains excluded")
    }

    private static func testSecretExamplesUseReferencesOnly() throws {
        let secretReference = try roundTrip(SecretReference.self, secretReferenceJSON, "SecretReference")
        let harness = try roundTrip(Harness.self, harnessJSON, "Harness")
        let log = try roundTrip(LogEvent.self, logEventJSON, "LogEvent")
        let providerConnection = try roundTrip(MarketplaceProviderConnection.self, marketplaceProviderConnectionJSON, "MarketplaceProviderConnection")
        let installRecord = try roundTrip(MarketplaceInstallRecord.self, marketplaceInstallRecordJSON, "MarketplaceInstallRecord")
        let toolRequest = try roundTrip(ToolRequestRecord.self, toolRequestRecordJSON, "ToolRequestRecord")

        let encoded = [
            try encodedString(secretReference),
            try encodedString(harness),
            try encodedString(log),
            try encodedString(providerConnection),
            try encodedString(installRecord),
            try encodedString(toolRequest)
        ].joined(separator: "\n")

        try expect(secretReference.provider == "test-os-keychain", "secret provider should be a reference provider")
        try expect(harness.secretReferenceId == "sec-contract-001", "harness should reference a secret id")
        try expect(providerConnection.secretReferenceIds == ["sec-contract-001"], "provider connection should reference Keychain secret ids")
        try expect(toolRequest.metadata["autoGrantCreated"] == .bool(false), "tool request should not claim auto grants")
        try expect(toolRequest.metadata["localFileAccessAttempted"] == .bool(false), "tool request should not claim local file access")
        try expect(encoded.contains("[REDACTED]"), "contract examples should use redacted metadata")
        for forbidden in ["contract-sensitive-value", "raw_api_key", "password="] {
            try expect(!encoded.contains(forbidden), "contract examples included forbidden secret material")
        }
    }

    private static func testFixtureManifestsMatchSchema() throws {
        for path in [
            "Tests/Fixtures/contracts/core/json-value-roundtrip-001/manifest.md",
            "Tests/Fixtures/contracts/core/current-models-v006-profile-settings-001/manifest.md",
            "Tests/Fixtures/contracts/chat/thread-message-web-native-001/manifest.md",
            "Tests/Fixtures/contracts/chat/composer-draft-send-failure-001/manifest.md",
            "Tests/Fixtures/contracts/chat/attachments-references-001/manifest.md",
            "Tests/Fixtures/contracts/chat/message-rendering-001/manifest.md",
            "Tests/Fixtures/contracts/runtime/dispatch-state-001/manifest.md",
            "Tests/Fixtures/contracts/agents/org-provisioning-001/manifest.md",
            "Tests/Fixtures/contracts/agents/identity-preferences-001/manifest.md",
            "Tests/Fixtures/contracts/agents/provisioning-lifecycle-001/manifest.md",
            "Tests/Fixtures/contracts/runtime/dashboard-snapshot-001/manifest.md",
            "Tests/Fixtures/contracts/runtime/action-run-001/manifest.md",
            "Tests/Fixtures/contracts/runtime/recovery-records-001/manifest.md",
            "Tests/Fixtures/contracts/applications/marketplace-catalog-001/manifest.md",
            "Tests/Fixtures/contracts/applications/provider-connections-001/manifest.md",
            "Tests/Fixtures/contracts/applications/marketplace-installs-001/manifest.md",
            "Tests/Fixtures/contracts/applications/needed-tools-001/manifest.md",
            "Tests/Fixtures/contracts/work-safety/native-file-permissions-001/manifest.md"
        ] {
            let manifest = try readPackageFile(path)
            for field in requiredManifestFields {
                try expect(manifest.contains("\(field):"), "\(path) is missing \(field)")
            }
            try expect(manifest.contains("VC-0101"), "\(path) must link model contract command id")
        }

        let unsupported = try readPackageFile("Tests/Fixtures/contracts/chat/thread-message-web-native-001/manifest.md")
        try expect(unsupported.contains("status: `verified`"), "chat contract fixture should be verified for retained v007 fields")
        try expect(unsupported.contains("notParityStatement:"), "unsupported web fixture needs a not-parity statement")
        try expect(unsupported.contains("activationRequirement:"), "unsupported web fixture needs activation requirements")

        let agentOrg = try readPackageFile("Tests/Fixtures/contracts/agents/org-provisioning-001/manifest.md")
        try expect(agentOrg.contains("ITC-0021"), "agent org contract fixture must link ITC-0021")
        try expect(agentOrg.contains("AgentOrgCompany"), "agent org contract fixture must name company model")
        try expect(agentOrg.contains("AgentProvisioningJob"), "agent org contract fixture must name provisioning model")

        let identityPreferences = try readPackageFile("Tests/Fixtures/contracts/agents/identity-preferences-001/manifest.md")
        try expect(identityPreferences.contains("ITC-0022"), "agent identity preferences contract fixture must link ITC-0022")
        try expect(identityPreferences.contains("AgentPreferences"), "agent identity preferences contract fixture must name preferences model")
        try expect(identityPreferences.contains("html_native"), "agent identity preferences contract fixture must state html_native exclusion")

        let provisioningLifecycle = try readPackageFile("Tests/Fixtures/contracts/agents/provisioning-lifecycle-001/manifest.md")
        try expect(provisioningLifecycle.contains("ITC-0023"), "agent provisioning lifecycle contract fixture must link ITC-0023")
        try expect(provisioningLifecycle.contains("missing_harness"), "agent provisioning lifecycle contract fixture must name missing harness status")
        try expect(provisioningLifecycle.contains("duplicate_id"), "agent provisioning lifecycle contract fixture must name duplicate-id status")

        let runtimeDashboard = try readPackageFile("Tests/Fixtures/contracts/runtime/dashboard-snapshot-001/manifest.md")
        try expect(runtimeDashboard.contains("ITC-0029"), "runtime dashboard contract fixture must link ITC-0029")
        try expect(runtimeDashboard.contains("RuntimeDashboardSnapshot"), "runtime dashboard contract fixture must name snapshot model")
        try expect(runtimeDashboard.contains("host-control"), "runtime dashboard contract fixture must state host-control exclusion")

        let runtimeActionRun = try readPackageFile("Tests/Fixtures/contracts/runtime/action-run-001/manifest.md")
        try expect(runtimeActionRun.contains("ITC-0030"), "runtime action contract fixture must link ITC-0030")
        try expect(runtimeActionRun.contains("ITC-0046"), "runtime action contract fixture must link ITC-0046")
        try expect(runtimeActionRun.contains("RuntimeActionRun"), "runtime action contract fixture must name action-run model")
        try expect(runtimeActionRun.contains("ControlledActionRequest"), "runtime action contract fixture must name controlled action request model")
        try expect(runtimeActionRun.contains("controlled_file_write"), "runtime action contract fixture must name controlled file write kind")
        try expect(runtimeActionRun.contains("controlled_provider_write"), "runtime action contract fixture must name controlled provider write kind")
        try expect(runtimeActionRun.contains("SAFETY-001"), "runtime action contract fixture must name controlled write decision gate")
        try expect(runtimeActionRun.contains("host-control"), "runtime action contract fixture must state host-control exclusion")

        let runtimeRecovery = try readPackageFile("Tests/Fixtures/contracts/runtime/recovery-records-001/manifest.md")
        try expect(runtimeRecovery.contains("ITC-0031"), "runtime recovery contract fixture must link ITC-0031")
        try expect(runtimeRecovery.contains("RuntimeStructuredJob"), "runtime recovery contract fixture must name structured job model")
        try expect(runtimeRecovery.contains("source-host"), "runtime recovery contract fixture must state source-host exclusion")

        let applications = try readPackageFile("Tests/Fixtures/contracts/applications/marketplace-catalog-001/manifest.md")
        try expect(applications.contains("ITC-0032"), "applications contract fixture must link ITC-0032")
        try expect(applications.contains("MarketplaceCatalogApp"), "applications contract fixture must name marketplace app model")
        try expect(applications.contains("retained social"), "applications contract fixture must state retained social catalogue scope")

        let providerConnections = try readPackageFile("Tests/Fixtures/contracts/applications/provider-connections-001/manifest.md")
        try expect(providerConnections.contains("ITC-0033"), "provider connection contract fixture must link ITC-0033")
        try expect(providerConnections.contains("MarketplaceProviderConnection"), "provider connection contract fixture must name connection model")
        try expect(providerConnections.contains("Keychain"), "provider connection contract fixture must name Keychain references")
        try expect(providerConnections.contains("Paperclip"), "provider connection contract fixture must state Paperclip exclusion")

        let marketplaceInstalls = try readPackageFile("Tests/Fixtures/contracts/applications/marketplace-installs-001/manifest.md")
        try expect(marketplaceInstalls.contains("ITC-0034"), "marketplace install contract fixture must link ITC-0034")
        try expect(marketplaceInstalls.contains("MarketplaceInstallRecord"), "marketplace install contract fixture must name install record model")
        try expect(marketplaceInstalls.contains("MarketplaceCompatibleAgentTarget"), "marketplace install contract fixture must name compatible agent model")
        try expect(marketplaceInstalls.contains("remove-as-unconfigured"), "marketplace install contract fixture must state remove-as-unconfigured behavior")
        try expect(marketplaceInstalls.contains("Paperclip"), "marketplace install contract fixture must state Paperclip exclusion")

        let neededTools = try readPackageFile("Tests/Fixtures/contracts/applications/needed-tools-001/manifest.md")
        try expect(neededTools.contains("ITC-0036"), "Needed Tools contract fixture must link ITC-0036")
        try expect(neededTools.contains("ITC-0043"), "Needed Tools contract fixture must link ITC-0043")
        try expect(neededTools.contains("ToolRequestRecord"), "Needed Tools contract fixture must name tool request model")
        try expect(neededTools.contains("NeededToolsSnapshot"), "Needed Tools contract fixture must name snapshot model")
        try expect(neededTools.contains("scheduled continuation"), "Needed Tools contract fixture must name continuation metadata")
        try expect(neededTools.contains("auto-grant"), "Needed Tools contract fixture must state auto-grant exclusion")
        try expect(neededTools.contains("Paperclip"), "Needed Tools contract fixture must state Paperclip exclusion")

        let workSafety = try readPackageFile("Tests/Fixtures/contracts/work-safety/approval-task-permission-audit-001/manifest.md")
        try expect(workSafety.contains("ITC-0038"), "work-safety contract fixture must link ITC-0038")
        try expect(workSafety.contains("WorkSafetyTaskRecord"), "work-safety contract fixture must name task record model")
        try expect(workSafety.contains("WorkSafetyApprovalRecord"), "work-safety contract fixture must name approval record model")
        try expect(workSafety.contains("PermissionPolicyRecord"), "work-safety contract fixture must name permission policy model")
        try expect(workSafety.contains("AuditLogRecord"), "work-safety contract fixture must name audit log model")
        try expect(workSafety.contains("SecurityMetricSnapshot"), "work-safety contract fixture must name security metric model")
        try expect(workSafety.contains("standalone Approvals"), "work-safety contract fixture must state standalone Approvals exclusion")
        try expect(workSafety.contains("no-executable-work"), "work-safety contract fixture must preserve no-executable-work boundary")

        let nativeFilePermissions = try readPackageFile("Tests/Fixtures/contracts/work-safety/native-file-permissions-001/manifest.md")
        try expect(nativeFilePermissions.contains("ITC-0045"), "native file permission contract fixture must link ITC-0045")
        try expect(nativeFilePermissions.contains("NativeFilePermissionRecord"), "native file permission contract fixture must name permission model")
        try expect(nativeFilePermissions.contains("fail closed"), "native file permission contract fixture must state fail-closed behavior")
        try expect(nativeFilePermissions.contains("Paperclip"), "native file permission contract fixture must preserve Paperclip exclusion")
    }

    @discardableResult
    private static func roundTrip<T: Codable & Equatable>(_ type: T.Type, _ json: String, _ name: String) throws -> T {
        let decoded = try decode(T.self, json)
        let encoded = try encoder.encode(decoded)
        let decodedAgain = try decoder.decode(T.self, from: encoded)
        try expect(decoded == decodedAgain, "\(name) did not survive Codable round trip")
        return decoded
    }

    private static func decode<T: Decodable>(_ type: T.Type, _ json: String) throws -> T {
        try decoder.decode(T.self, from: Data(json.utf8))
    }

    private static func encodedString<T: Encodable>(_ value: T) throws -> String {
        String(decoding: try encoder.encode(value), as: UTF8.self)
    }

    private static func expectRawValues<T: Codable & RawRepresentable & Equatable>(_ values: [T], _ rawValues: [String], _ name: String) throws where T.RawValue == String {
        try expect(values.map(\.rawValue) == rawValues, "\(name) raw values changed")
        let encoded = try encoder.encode(values)
        let decoded = try decoder.decode([T].self, from: encoded)
        try expect(decoded == values, "\(name) enum values did not survive Codable round trip")
    }

    private static func readPackageFile(_ relativePath: String) throws -> String {
        let url = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
            .appendingPathComponent(relativePath)
        return try String(contentsOf: url, encoding: .utf8)
    }

    private static func expect(_ condition: @autoclosure () throws -> Bool, _ message: String) throws {
        guard try condition() else {
            throw ModelContractFailure(message)
        }
    }
}

private let decoder = JSONDecoder()
private let encoder: JSONEncoder = {
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.sortedKeys]
    return encoder
}()

private let requiredManifestFields = [
    "id",
    "layer",
    "productArea",
    "requirementIds",
    "sourceMapIds",
    "fixtureKind",
    "owner",
    "status",
    "secretsPolicy",
    "files",
    "expectedChecks",
    "determinism",
    "noFakeProductSeed",
    "noSimulatedRuntimeOutput",
    "noGeneratedWelcome",
    "privateStateExclusions",
    "redactionReview",
    "failureHandling"
]

private let jsonValueJSON = """
{
  "name": "json-value-fixture",
  "items": [null, "alpha", 2, true, {"nested": "value"}],
  "metadata": {
    "redacted": "[REDACTED]",
    "count": 3
  }
}
"""

private let localProfileJSON = """
{"id":"prof-contract-001","displayName":"Local User","email":"local@example.test","avatarUrl":null,"telemetryEnabled":true,"crashReportingEnabled":false,"theme":"classic","createdAt":"2026-01-01T00:00:00Z","updatedAt":"2026-01-01T00:00:00Z"}
"""

private let workspaceJSON = """
{"id":"wks-contract-001","profileId":"prof-contract-001","name":"Local Workspace","defaultFolderPath":null,"workspaceType":"personal","settings":{"defaultSettingsPanel":"account","sidebarCollapsed":false},"createdAt":"2026-01-01T00:00:00Z","updatedAt":"2026-01-01T00:00:00Z"}
"""

private let legacyLocalProfileJSON = """
{"id":"prof-contract-legacy-001","displayName":"Local User","createdAt":"2026-01-01T00:00:00Z","updatedAt":"2026-01-01T00:00:00Z"}
"""

private let legacyWorkspaceJSON = """
{"id":"wks-contract-legacy-001","profileId":"prof-contract-legacy-001","name":"Local Workspace","defaultFolderPath":null,"createdAt":"2026-01-01T00:00:00Z","updatedAt":"2026-01-01T00:00:00Z"}
"""

private let harnessJSON = """
{"id":"hrn-contract-001","runtimeType":"hermes","displayName":"Hermes Agent","mode":"app_managed","config":{"command":"[REDACTED]","limits":{"maxConcurrent":1}},"secretReferenceId":"sec-contract-001","status":"active","builtIn":true,"createdAt":"2026-01-01T00:00:00Z","updatedAt":"2026-01-01T00:00:00Z"}
"""

private let harnessHealthJSON = """
{"harnessId":"hrn-contract-001","runtimeType":"hermes","status":"healthy","message":"Ready","version":"1.2.3","capabilities":["dispatch","cancel"],"checkedAt":"2026-01-01T00:00:00Z","detail":{"auth":"[REDACTED]"}}
"""

private let runtimeCapabilitiesJSON = """
{"runtimeType":"hermes","supportsStreaming":true,"supportsCancellation":true,"supportsSessions":true,"supportsTools":true,"requiresWorkspaceFolder":false,"requiresSecret":true,"maxConcurrentDispatches":1,"eventTypes":["queued","started","status","delta","completed","failed","cancelled"]}
"""

private let agentJSON = """
{"id":"agt-contract-001","workspaceId":"wks-contract-001","name":"Workflow Assistant","description":null,"status":"active","role":"operator","source":"local","externalId":"agent-external-001","groupType":"business","familyLabel":null,"companyId":"cmp-contract-001","departmentId":"dep-contract-001","teamId":"team-contract-001","managerAgentId":"agt-manager-001","classification":"operations","model":"gpt-5","responsePresentation":"markdown","provisioningStatus":"completed","currentTaskId":"tsk-contract-001","metrics":{"activeTasks":2,"lastRunState":"completed"},"budget":{"monthlyUsd":100,"currency":"USD"},"createdAt":"2026-01-01T00:00:00Z","updatedAt":"2026-01-01T00:00:00Z"}
"""

private let legacyAgentJSON = """
{"id":"agt-contract-legacy-001","workspaceId":"wks-contract-001","name":"Legacy Agent","description":null,"status":"active","createdAt":"2026-01-01T00:00:00Z","updatedAt":"2026-01-01T00:00:00Z"}
"""

private let agentHTMLNativeJSON = """
{"id":"agt-contract-html-native-001","workspaceId":"wks-contract-001","name":"HTML Native Excluded Agent","description":null,"status":"active","responsePresentation":"html_native","createdAt":"2026-01-01T00:00:00Z","updatedAt":"2026-01-01T00:00:00Z"}
"""

private let runtimeBindingJSON = """
{"id":"rb-contract-001","agentId":"agt-contract-001","harnessId":"hrn-contract-001","runtimeType":"hermes","adapterKind":"app_managed","routingMode":"local","externalAgentId":"workflow_assistant","hermesProfileSlug":null,"hermesHomePath":null,"hermesIdentityFilePath":null,"workspaceFolderPath":null,"config":{"auth":"[REDACTED]"},"createdAt":"2026-01-01T00:00:00Z","updatedAt":"2026-01-01T00:00:00Z"}
"""

private let agentWithBindingJSON = """
{"id":"agt-contract-001","workspaceId":"wks-contract-001","name":"Workflow Assistant","description":null,"status":"active","role":"operator","source":"local","externalId":"agent-external-001","groupType":"business","familyLabel":null,"companyId":"cmp-contract-001","departmentId":"dep-contract-001","teamId":"team-contract-001","managerAgentId":"agt-manager-001","classification":"operations","model":"gpt-5","responsePresentation":"markdown","provisioningStatus":"completed","currentTaskId":"tsk-contract-001","metrics":{"activeTasks":2,"lastRunState":"completed"},"budget":{"monthlyUsd":100,"currency":"USD"},"createdAt":"2026-01-01T00:00:00Z","updatedAt":"2026-01-01T00:00:00Z","binding":\(runtimeBindingJSON),"harness":\(harnessJSON)}
"""

private let agentOrgCompanyJSON = """
{"id":"cmp-contract-001","workspaceId":"wks-contract-001","name":"Contract Organization Fixture","industry":"fixture","status":"active","metadata":{"source":"contract","redacted":"[REDACTED]"},"createdAt":"2026-01-01T00:00:00Z","updatedAt":"2026-01-01T00:00:00Z"}
"""

private let agentOrgDepartmentJSON = """
{"id":"dep-contract-001","workspaceId":"wks-contract-001","companyId":"cmp-contract-001","name":"Contract Department Fixture","colorHex":"#3366CC","headAgentId":"agt-manager-001","agentOpsRoomId":"thr-agentops-contract-001","status":"active","metadata":{"source":"contract","redacted":"[REDACTED]"},"createdAt":"2026-01-01T00:00:00Z","updatedAt":"2026-01-01T00:00:00Z"}
"""

private let agentOrgTeamJSON = """
{"id":"team-contract-001","workspaceId":"wks-contract-001","departmentId":"dep-contract-001","name":"Contract Team Fixture","leadAgentId":"agt-contract-001","agentOpsRoomId":"thr-agentops-contract-002","status":"active","metadata":{"source":"contract","redacted":"[REDACTED]"},"createdAt":"2026-01-01T00:00:00Z","updatedAt":"2026-01-01T00:00:00Z"}
"""

private let agentManagerRelationshipJSON = """
{"id":"mgrrel-contract-001","workspaceId":"wks-contract-001","managerAgentId":"agt-manager-001","reportAgentId":"agt-contract-001","relationshipType":"manager","metadata":{"source":"contract","redacted":"[REDACTED]"},"createdAt":"2026-01-01T00:00:00Z","updatedAt":"2026-01-01T00:00:00Z"}
"""

private let agentProvisioningJobJSON = """
{"id":"apj-contract-001","workspaceId":"wks-contract-001","requestedByProfileId":"prof-contract-001","harnessId":"hrn-contract-001","runtimeType":"hermes","status":"completed","stage":"linked","message":"Runtime identity linked","error":null,"createdAgentId":"agt-contract-001","runtimeBindingId":"rb-contract-001","externalAgentId":"agent-external-001","payload":{"source":"contract","secret":"[REDACTED]"},"filesMetadata":{"count":0,"rawPathsStored":false},"createdAt":"2026-01-01T00:00:00Z","updatedAt":"2026-01-01T00:00:01Z","completedAt":"2026-01-01T00:00:01Z"}
"""

private let agentPreferencesJSON = """
{"id":"apref-contract-001","workspaceId":"wks-contract-001","agentId":"agt-contract-001","cosmeticDisplayName":"Workflow Helper","avatarReference":"avatars/illustrated/avatar-01.png","avatarState":"illustrated","responsePresentation":"plain_text","metadata":{"source":"contract","redacted":"[REDACTED]"},"createdAt":"2026-01-01T00:00:00Z","updatedAt":"2026-01-01T00:00:01Z"}
"""

private let agentTaskJSON = """
{"id":"tsk-contract-001","workspaceId":"wks-contract-001","assignedAgentId":"agt-contract-001","targetAgentId":"agt-contract-001","targetTeamId":"team-contract-001","title":"Contract task","message":"Review retained queue item","priority":"high","targetType":"team","status":"running","requiresApproval":true,"scheduledAt":"2026-01-01T10:00:00Z","timeZone":"UTC","recurrence":null,"lastError":null,"threadId":"thr-contract-001","metadata":{"source":"contract","redacted":"[REDACTED]"},"archivedAt":null,"createdAt":"2026-01-01T00:00:00Z","updatedAt":"2026-01-01T00:00:01Z"}
"""

private let agentTaskRunJSON = """
{"id":"run-contract-001","workspaceId":"wks-contract-001","taskId":"tsk-contract-001","agentId":"agt-contract-001","dispatchId":"rtd-contract-001","status":"completed","tokensUsed":42,"startedAt":"2026-01-01T10:00:00Z","completedAt":"2026-01-01T10:01:00Z","error":null,"metadata":{"source":"contract","redacted":"[REDACTED]"},"createdAt":"2026-01-01T10:00:00Z","updatedAt":"2026-01-01T10:01:00Z"}
"""

private let agentTeamMemoryEntryJSON = """
{"id":"mem-contract-001","workspaceId":"wks-contract-001","teamId":"team-contract-001","title":"Escalation rule","memoryType":"rule","content":"Use the retained escalation checklist.","isSensitive":true,"metadata":{"source":"contract","redacted":"[REDACTED]"},"createdByAgentId":"agt-contract-001","createdAt":"2026-01-01T00:00:00Z","updatedAt":"2026-01-01T00:00:01Z"}
"""

private let agentTeamHandoverJSON = """
{"id":"hnd-contract-001","workspaceId":"wks-contract-001","teamId":"team-contract-001","fromAgentId":"agt-contract-001","title":"Shift handover","content":"Follow up on retained incident queue.","isSensitive":true,"metadata":{"source":"contract","redacted":"[REDACTED]"},"createdAt":"2026-01-01T00:00:00Z","updatedAt":"2026-01-01T00:00:01Z"}
"""

private let agentStructureDashboardJSON = """
{"workspaceId":"wks-contract-001","departments":[{"departmentId":"dep-contract-001","name":"Contract Department Fixture","teamCount":1,"agentCount":2,"runningTaskCount":1,"blockedTaskCount":1,"pendingApprovalCount":1,"openIncidentCount":0}],"teams":[{"teamId":"team-contract-001","name":"Contract Team Fixture","agentCount":2,"runningTaskCount":1,"blockedTaskCount":1,"pendingApprovalCount":1,"openIncidentCount":0,"memoryCount":1,"handoverCount":1}],"totalRunningTasks":1,"totalBlockedTasks":1,"totalPendingApprovals":1,"totalOpenIncidents":0,"totalMemoryItems":1,"totalHandovers":1}
"""

private let agentWorkCalendarJSON = """
{"workspaceId":"wks-contract-001","groupType":"business","rangeStart":"2026-01-01","rangeEnd":"2026-01-01","timeZone":"UTC","derivedFrom":"chat-derived active hours from direct and team threads","activeGapMinutes":20,"rows":[{"agentId":"agt-contract-001","agentName":"Workflow Assistant","groupType":"business","days":[{"agentId":"agt-contract-001","date":"2026-01-01","activityCount":1,"scheduledTaskCount":1,"completedRunCount":1,"activeMinutes":95}],"totalActivityCount":1,"totalScheduledTaskCount":1,"totalCompletedRunCount":1,"totalActiveMinutes":95}]}
"""

private let runtimeDashboardAssignedAgentJSON = """
{"agentId":"agt-contract-001","displayName":"Workflow Assistant","runtimeType":"hermes","status":"active"}
"""

private let runtimeDashboardRowJSON = """
{"id":"rdr-contract-001","kind":"runtime_harness","runtimeType":"hermes","harnessId":"hrn-contract-001","connectedAppId":null,"displayName":"Hermes Agent","status":"active","statusLabel":"Active","detail":"1 retained dispatch active.","reachability":"reachable","assignedAgents":[\(runtimeDashboardAssignedAgentJSON)],"activeDispatchCount":1,"failedDispatchCount":0,"retryableDispatchCount":0,"latestDispatchId":"rtd-contract-001","lastActivityAt":"2026-01-01T00:00:01Z","redactionStatus":"paths-and-command-env-excluded","source":"harnesses,runtime_bindings,runtime_dispatches,event_log"}
"""

private let runtimeDashboardSnapshotJSON = """
{"id":"rds-contract-001","workspaceId":"wks-contract-001","state":"populated","refreshedAt":"2026-01-01T00:00:02Z","lastSuccessfulRefreshAt":"2026-01-01T00:00:02Z","staleAfterSeconds":300,"localStatusState":"disabled","localStatusReason":"Mission Control host-control and local app process status are excluded from Swift scope.","disabledReason":null,"errorMessage":null,"retryAvailable":false,"readOnly":true,"rows":[\(runtimeDashboardRowJSON)],"connectedAppCount":0,"runtimeRowCount":1,"activeDispatchCount":1,"failedDispatchCount":0,"retryableDispatchCount":0,"emptyReason":null,"derivedFrom":["harnesses","runtime_bindings","runtime_dispatches","event_log"],"redactionStatus":"private-paths-secrets-command-env-excluded"}
"""

private let runtimeActionCapabilityJSON = """
{"id":"wks-contract-001-retry-dispatch-rtd-contract-001","workspaceId":"wks-contract-001","kind":"retry_dispatch","displayName":"Retry dispatch","availability":"available","stateKind":"read_only","reasonCode":"authority.read_only","message":"Retry is inspectable as a read-only capability.","recovery":"Use the guarded runtime service when execution is explicitly allowed.","scopeType":"dispatch","runtimeType":"hermes","harnessId":"hrn-contract-001","dispatchId":"rtd-contract-001","agentId":"agt-contract-001","destructive":false,"dryRunSupported":true,"executionSupported":false,"readOnly":true,"staleAfterSeconds":300,"evaluatedAt":"2026-01-01T00:00:03Z","source":"runtime_dispatch.action_state","redactionStatus":"private-state-excluded"}
"""

private let runtimeActionRunJSON = """
{"id":"rar-contract-001","workspaceId":"wks-contract-001","capabilityId":"wks-contract-001-retry-dispatch-rtd-contract-001","kind":"retry_dispatch","status":"dry_run","stateKind":"read_only","reasonCode":"authority.read_only","idempotencyKey":"retry-rtd-contract-001","actorId":"usr-contract-001","scopeType":"dispatch","runtimeType":"hermes","harnessId":"hrn-contract-001","dispatchId":"rtd-contract-001","agentId":"agt-contract-001","destructive":false,"dryRun":true,"executionAttempted":false,"request":{"redacted":"[REDACTED]"},"result":{"summary":"Dry run recorded without executing a runtime action."},"failure":null,"retentionExpiresAt":"2026-01-31T00:00:03Z","createdAt":"2026-01-01T00:00:03Z","updatedAt":"2026-01-01T00:00:03Z","completedAt":"2026-01-01T00:00:03Z","redactionStatus":"private-state-excluded"}
"""

private let controlledActionRequestJSON = """
{"kind":"controlled_file_write","idempotencyKey":"cact-contract-001","operationName":"Save markdown dry run","scopeType":"workspace","runtimeType":null,"harnessId":null,"dispatchId":null,"agentId":"agt-contract-001","approvalId":"wsa-contract-001","nativeFilePermissionId":"nfperm-contract-001","payload":{"target":"[REDACTED]","rawFileContentsPersisted":false}}
"""

private let runtimeContextUsageJSON = """
{"dispatchId":"rtd-contract-001","percentUsed":0.42,"tokenCount":4200,"maxTokens":10000,"level":"ok","isEstimate":true,"referencesCount":2,"redactionStatus":"reference-details-excluded"}
"""

private let runtimeParticipantHealthJSON = """
{"agentId":"agt-contract-001","runtimeType":"hermes","status":"healthy","message":"Runtime healthy","updatedAt":"2026-01-01T00:00:04Z","redactionStatus":"health-message-redacted"}
"""

private let runtimeStructuredJobJSON = """
{"id":"rsj-contract-001","workspaceId":"wks-contract-001","dispatchId":"rtd-contract-001","actionRunId":"rar-contract-001","jobType":"tool_recovery","status":"failed","title":"Missing tool recovery","retryable":true,"contextUsage":\(runtimeContextUsageJSON),"participantHealth":[\(runtimeParticipantHealthJSON)],"followUpFailure":{"message":"credential=[REDACTED]"},"recovery":{"sourceHostExcluded":true},"sourceHostExcluded":true,"metadata":{"redacted":"[REDACTED]"},"createdAt":"2026-01-01T00:00:04Z","updatedAt":"2026-01-01T00:00:05Z","completedAt":"2026-01-01T00:00:05Z","redactionStatus":"private-state-excluded"}
"""

private let runtimeMissingToolEventJSON = """
{"id":"rmt-contract-001","workspaceId":"wks-contract-001","dispatchId":"rtd-contract-001","agentId":"agt-contract-001","toolName":"calendar.search","status":"requested","request":{"autoInstallAttempted":false,"fakeGrantCreated":false},"autoInstallAttempted":false,"fakeGrantCreated":false,"source":"runtime_missing_tool","createdAt":"2026-01-01T00:00:05Z","updatedAt":"2026-01-01T00:00:05Z","redactionStatus":"private-state-excluded"}
"""

private let runtimeRecoveryRecordJSON = """
{"id":"rrr-contract-001","workspaceId":"wks-contract-001","dispatchId":"rtd-contract-001","jobId":"rsj-contract-001","state":"retryable","retryable":true,"reasonCode":"error.retryable","message":"Recovery can retry after tool setup.","followUpAction":"request_tool","sourceHostExcluded":true,"recovery":{"sourceHostExcluded":true},"createdAt":"2026-01-01T00:00:06Z","updatedAt":"2026-01-01T00:00:06Z","resolvedAt":null,"redactionStatus":"private-state-excluded"}
"""

private let toolRequestSuggestedAppJSON = """
{"appId":"mapp-contract-001","appSlug":"github","appName":"GitHub","category":"Engineering","connectionState":"connected","installState":"installed","availabilityState":"granted","matchingCapabilities":["issues"],"guidance":"GitHub already has a retained install grant for this capability.","redactionStatus":"private-state-excluded"}
"""

private let toolRequestRecordJSON = """
{"id":"treq-contract-001","workspaceId":"wks-contract-001","requestedCapability":"github.issues","normalizedCapability":"github_issues","appId":"mapp-contract-001","appSlug":"github","agentId":"agt-contract-001","agentName":"Workflow Assistant","threadId":"thr-contract-001","dispatchId":"rtd-contract-001","missingToolEventId":"rmt-contract-001","relatedTaskId":"tsk-contract-001","relatedRecordId":"rec-contract-001","campaign":"Contract campaign","reason":"Policy allows this action but no executable tool was present during dispatch.","requiredAction":"Connect or grant a retained Marketplace provider tool.","evidence":"token=[REDACTED]","status":"granted","policyAllowed":true,"toolAvailable":true,"toolConnected":true,"toolGranted":true,"availabilityState":"granted","suggestedApps":[\(toolRequestSuggestedAppJSON)],"metadata":{"autoInstallAttempted":false,"autoGrantCreated":false,"localFileAccessAttempted":false,"paperclipExcluded":true,"localPath":"[REDACTED]","source":"tool-request-service"},"requestedAt":"2026-01-01T00:00:13Z","lastSeenAt":"2026-01-01T00:00:14Z","resolvedAt":null,"resolutionNote":null,"createdByActorId":"usr-contract-001","updatedByActorId":"usr-contract-001","redactionStatus":"private-state-excluded"}
"""

private let neededToolsSummaryJSON = """
{"workspaceId":"wks-contract-001","appId":"mapp-contract-001","appSlug":"github","queryStatus":"open","openRequestCount":1,"connectedCount":1,"grantedCount":1,"unavailableCount":0,"dismissedCount":0,"resolvedCount":0,"suggestedAppCount":1,"generatedAt":"2026-01-01T00:00:15Z","redactionStatus":"private-state-excluded"}
"""

private let neededToolsDiagnosticsJSON = """
{"openSummary":"1 open request","connectionSummary":"1 connected","grantSummary":"1 granted","unavailableSummary":"0 unavailable","message":"Policy allows this, but no executable tool is connected or granted."}
"""

private let neededToolsSnapshotJSON = """
{"workspaceId":"wks-contract-001","appId":"mapp-contract-001","appSlug":"github","state":"ready","refreshedAt":"2026-01-01T00:00:15Z","queryStatus":"open","requests":[\(toolRequestRecordJSON)],"selectedRequest":\(toolRequestRecordJSON),"summary":\(neededToolsSummaryJSON),"diagnostics":\(neededToolsDiagnosticsJSON),"readOnly":false,"redactionStatus":"private-state-excluded"}
"""

private let marketplaceInstallRoleDefinitionJSON = """
{"roleId":"operator","label":"Operator","purpose":"Operate provider actions with approval gates.","canWrite":true,"readOnly":false,"approvalRequiredActions":["provider_write"],"blockedActions":["local_file_write","host_control","paperclip"],"required":true,"installAfterSetup":true,"installable":true,"notInstallableReason":null,"recommendedAgentRole":"operator","source":"contract-role-manifest","redactionStatus":"private-state-excluded"}
"""

private let marketplaceCompatibleAgentTargetJSON = """
{"agentId":"agt-contract-001","agentName":"Workflow Assistant","agentRole":"operator","runtimeBindingId":"rb-contract-001","harnessId":"hrn-contract-001","runtimeType":"hermes","status":"compatible","supportedRoles":["operator","auditor"],"unavailableReason":null,"existingInstallId":"minst-contract-001","redactionStatus":"private-state-excluded"}
"""

private let marketplaceInstallRequestJSON = """
{"id":"minreq-contract-001","workspaceId":"wks-contract-001","appId":"mapp-contract-001","appSlug":"github","connectionId":"mpc-contract-001","targetAgentId":"agt-contract-001","roleId":"operator","selectedCapabilities":["issues"],"approvalProfileId":"approval-contract-001","runtimeFormat":"hermes","targetMode":"existing_agent","riskAcknowledged":true,"metadata":{"rawBridgePayload":"token=[REDACTED]","localPath":"[REDACTED]","runtimeWriteDeferred":true},"requestedByActorId":"usr-contract-001","requestedAt":"2026-01-01T00:00:10Z","redactionStatus":"private-state-excluded"}
"""

private let marketplaceInstallRecordJSON = """
{"id":"minst-contract-001","workspaceId":"wks-contract-001","appId":"mapp-contract-001","appSlug":"github","connectionId":"mpc-contract-001","agentId":"agt-contract-001","agentName":"Workflow Assistant","runtimeBindingId":"rb-contract-001","harnessId":"hrn-contract-001","runtimeType":"hermes","roleId":"operator","roleLabel":"Operator","selectedCapabilities":["issues"],"approvalProfileId":"approval-contract-001","runtimeFormat":"hermes","targetMode":"existing_agent","riskAcknowledged":true,"installStatus":"installed","driftStatus":"current","lastInstalledAt":"2026-01-01T00:00:11Z","removedAt":null,"failureMessage":null,"metadata":{"rawBridgePayload":"token=[REDACTED]","localPath":"[REDACTED]","runtimeWriteDeferred":true,"providerWriteDeferred":true,"toolAutoGrantCreated":false,"runtimeCleanupPerformed":false},"createdByActorId":"usr-contract-001","createdAt":"2026-01-01T00:00:11Z","updatedAt":"2026-01-01T00:00:11Z","redactionStatus":"private-state-excluded"}
"""

private let marketplaceInstallDiagnosticsJSON = """
{"compatibleAgentSummary":"1 compatible / 1 retained agents","installSummary":"1 active / 1 retained installs","driftSummary":"0 drift or unconfigured records","runtimeWriteSummary":"Runtime writes deferred until safety cards authorize them.","removalSummary":"0 remove-as-unconfigured records","message":"Marketplace install records target real local agents and defer runtime writes."}
"""

private let marketplaceInstallSnapshotJSON = """
{"workspaceId":"wks-contract-001","appId":"mapp-contract-001","appSlug":"github","state":"ready","refreshedAt":"2026-01-01T00:00:12Z","installs":[\(marketplaceInstallRecordJSON)],"compatibleAgents":[\(marketplaceCompatibleAgentTargetJSON)],"selectedInstall":\(marketplaceInstallRecordJSON),"diagnostics":\(marketplaceInstallDiagnosticsJSON),"readOnly":false,"redactionStatus":"private-state-excluded"}
"""

private let marketplaceRoleManifestJSON = """
{"primaryRole":"operator","supportedRoles":["operator","auditor"],"compatibleRuntimeTypes":["hermes","openclaw"],"approvalRequired":true,"roleDefinitions":[\(marketplaceInstallRoleDefinitionJSON)],"redactionStatus":"private-state-excluded"}
"""

private let marketplaceIconFallbackJSON = """
{"initials":"X","colorName":"blue","source":"deterministic-slug-fallback"}
"""

private let marketplaceCatalogAppJSON = """
{"id":"mapp-contract-001","workspaceId":"wks-contract-001","slug":"x","name":"X","summary":"Read X activity and draft posts.","description":"Retained social marketplace contract fixture for X provider setup.","category":"Social","sourceType":"external_provider","riskLevel":"high","authType":"OAuth","connectionType":"User-owned X OAuth","capabilities":["Read timeline and mentions","Draft posts and replies"],"runtimeSupport":["hermes","openclaw"],"roleManifest":\(marketplaceRoleManifestJSON),"availability":"available","availabilityReason":null,"connectionState":"connected","installState":"not_installed","installedAgentCount":0,"installedAgentIds":[],"docsURL":"https://developer.x.com/en/docs/x-api","websiteURL":"https://x.com/","betaNotice":null,"iconFallback":\(marketplaceIconFallbackJSON),"readOnly":true,"localAppExcluded":false,"reviewExcluded":false,"createdAt":"2026-01-01T00:00:07Z","updatedAt":"2026-01-01T00:00:07Z","redactionStatus":"private-state-excluded"}
"""

private let applicationsCatalogTabJSON = """
{"view":"all","label":"Apps","count":1,"enabled":true,"stateKind":null,"reasonCode":null,"message":null,"visibleToRoles":["owner","admin","member"]}
"""

private let applicationsCatalogFilterJSON = """
{"view":"all","searchQuery":"x","category":"Social","riskLevel":null}
"""

private let applicationsCatalogDiagnosticsJSON = """
{"endpointLabel":"Local retained catalogue","responseCount":1,"selectedCategory":"Social","riskFilter":"Not shown","searchQuery":"x","demoFallbackUsed":false,"message":"Applications Marketplace"}
"""

private let applicationsCatalogSnapshotJSON = """
{"workspaceId":"wks-contract-001","state":"ready","refreshedAt":"2026-01-01T00:00:08Z","filter":\(applicationsCatalogFilterJSON),"tabs":[\(applicationsCatalogTabJSON)],"categories":["Social"],"riskLevels":[],"apps":[\(marketplaceCatalogAppJSON)],"selectedApp":\(marketplaceCatalogAppJSON),"diagnostics":\(applicationsCatalogDiagnosticsJSON),"betaNotice":"","readOnly":true,"redactionStatus":"private-state-excluded"}
"""

private let providerCredentialRequirementJSON = """
{"fieldKey":"client_id","label":"X Client ID","required":true,"userOwnedRequired":true,"secretReferenceId":"sec-contract-001","status":"verified","helpText":"Stored as a Keychain reference.","redactionStatus":"secret-reference-only"}
"""

private let providerConnectorHealthJSON = """
{"state":"ready","message":"Connector health ready with redacted metadata.","lastCheckedAt":"2026-01-01T00:00:09Z","missingScopes":["Mail.Send"],"unavailableTools":["send: Mail.Send missing"],"diagnostics":{"storedConnection":"redacted","scopeSource":"contract"},"redactionStatus":"private-state-excluded"}
"""

private let providerSenderIdentityJSON = """
{"id":"psi-contract-001","email":"alias@example.com","validationStatus":"verified","agentId":"agt-contract-001","installId":"minst-contract-001","lastCheckedAt":"2026-01-01T00:00:09Z","errorMessage":null,"redactionStatus":"private-state-excluded"}
"""

private let marketplaceProviderConnectionJSON = """
{"id":"mpc-contract-001","workspaceId":"wks-contract-001","appId":"mapp-contract-001","appSlug":"github","providerKey":"github","providerName":"GitHub","status":"connected","authorizationState":"completed","credentialOwnership":"user_owned","userOwnedCredentialsRequired":true,"credentialRequirements":[\(providerCredentialRequirementJSON)],"secretReferenceIds":["sec-contract-001"],"accountLabel":"contract-account","connectedHandle":"contract-handle","callbackURL":"relay-console://oauth/github/callback","requiredScopes":["repo.read"],"grantedScopes":["repo.read"],"selectedCapabilities":["issues"],"health":\(providerConnectorHealthJSON),"senderIdentities":[\(providerSenderIdentityJSON)],"installPolicy":"approval_required","lastCheckedAt":"2026-01-01T00:00:09Z","lastError":null,"manualEvidenceNote":null,"reauthorizeRequired":false,"disconnecting":false,"betaBlocked":false,"createdAt":"2026-01-01T00:00:09Z","updatedAt":"2026-01-01T00:00:09Z","redactionStatus":"private-state-excluded"}
"""

private let providerAuthorizationFlowJSON = """
{"id":"poauth-contract-001","workspaceId":"wks-contract-001","appId":"mapp-contract-001","connectionId":"mpc-contract-001","providerKey":"github","state":"deep_link_pending","callbackURL":"relay-console://oauth/github/callback","authorizationURL":"https://provider.example.invalid/oauth/authorize","deepLinkURL":"relay-console://oauth/github/callback","manualEvidenceNote":"Manual OAuth completion evidence is redacted.","errorMessage":null,"startedByActorId":"usr-contract-001","startedAt":"2026-01-01T00:00:09Z","completedAt":null,"createdAt":"2026-01-01T00:00:09Z","updatedAt":"2026-01-01T00:00:09Z","redactionStatus":"private-state-excluded"}
"""

private let providerConnectionDiagnosticsJSON = """
{"connectorHealthSummary":"1 ready / 1 retained","oauthStateSummary":"deep_link_pending","keychainReferenceSummary":"1 Keychain reference","senderIdentitySummary":"1 sender identity","userOwnedCredentialSummary":"User-owned credentials","manualEvidenceSummary":"No manual evidence pending","message":"Provider connection records are retained locally with Keychain references only."}
"""

private let providerConnectionSnapshotJSON = """
{"workspaceId":"wks-contract-001","appId":"mapp-contract-001","appSlug":"github","state":"ready","refreshedAt":"2026-01-01T00:00:10Z","connections":[\(marketplaceProviderConnectionJSON)],"authorizationFlows":[\(providerAuthorizationFlowJSON)],"selectedConnection":\(marketplaceProviderConnectionJSON),"diagnostics":\(providerConnectionDiagnosticsJSON),"readOnly":false,"redactionStatus":"private-state-excluded"}
"""

private let marketplaceProviderActionDefinitionJSON = """
{"id":"mpact-contract-001","workspaceId":"wks-contract-001","appId":"mapp-contract-001","appSlug":"github","providerKey":"github","actionKey":"github.issue.create","displayName":"Create issue","summary":"Create a provider issue after approval.","kind":"write","riskLevel":"high","adapterKind":"official_mcp","defaultPermission":"approval_required","requiredScopes":["repo.write"],"capabilityKeys":["issues.write"],"payloadSchema":{"title":"string","body":"string","secretExample":"[REDACTED]"},"resultSchema":{"issueUrl":"string"},"enabled":true,"createdAt":"2026-01-01T00:00:11Z","updatedAt":"2026-01-01T00:00:11Z","redactionStatus":"private-state-excluded"}
"""

private let marketplaceActionPermissionMapJSON = """
{"id":"mpperm-contract-001","workspaceId":"wks-contract-001","appId":"mapp-contract-001","appSlug":"github","connectionId":"mpc-contract-001","installId":"minst-contract-001","agentId":"agt-contract-001","policyPreset":"approval_required","permissions":{"github.issue.create":"approval_required","github.issue.search":"allowed","github.repository.delete":"blocked"},"blockedReasons":{"github.repository.delete":"Destructive repository deletion is blocked."},"source":"marketplace-policy-compiler","createdByActorId":"usr-contract-001","updatedByActorId":"usr-contract-001","createdAt":"2026-01-01T00:00:12Z","updatedAt":"2026-01-01T00:00:12Z","redactionStatus":"private-state-excluded"}
"""

private let providerActionApprovalReferenceJSON = """
{"approvalId":"mpapr-contract-001","status":"pending","proposedPayloadHash":"sha256:provider-action-contract","expiresAt":"2026-01-01T01:00:00Z","idempotencyKey":"github-issue-create-contract-001","executionId":"mpexec-contract-001","redactionStatus":"private-state-excluded"}
"""

private let marketplaceProviderActionApprovalRecordJSON = """
{"id":"mpapr-contract-001","workspaceId":"wks-contract-001","appId":"mapp-contract-001","appSlug":"github","connectionId":"mpc-contract-001","installId":"minst-contract-001","agentId":"agt-contract-001","providerActionId":"mpact-contract-001","actionKey":"github.issue.create","proposedPayload":{"title":"Retained issue","body":"[REDACTED]"},"proposedPayloadHash":"sha256:provider-action-contract","status":"pending","requestedByActorId":"usr-contract-001","requestedByAgentId":"agt-contract-001","resolvedByActorId":null,"expiresAt":"2026-01-01T01:00:00Z","resolvedAt":null,"idempotencyKey":"github-issue-create-contract-001","executionId":"mpexec-contract-001","metadata":{"source":"approval-card","localPath":"[REDACTED]"},"createdAt":"2026-01-01T00:00:13Z","updatedAt":"2026-01-01T00:00:13Z","redactionStatus":"private-state-excluded"}
"""

private let providerExecutionAuditIdentityJSON = """
{"workspaceId":"wks-contract-001","actorId":"usr-contract-001","actorRole":"owner","agentId":"agt-contract-001","appId":"mapp-contract-001","appSlug":"github","connectionId":"mpc-contract-001","installId":"minst-contract-001","approvalId":"mpapr-contract-001","dispatchId":"rtd-contract-001","threadId":"thr-contract-001","source":"provider-action-broker","redactionStatus":"private-state-excluded"}
"""

private let marketplaceProviderActionExecutionRecordJSON = """
{"id":"mpexec-contract-001","workspaceId":"wks-contract-001","appId":"mapp-contract-001","appSlug":"github","connectionId":"mpc-contract-001","installId":"minst-contract-001","agentId":"agt-contract-001","providerActionId":"mpact-contract-001","actionKey":"github.issue.create","permission":"approval_required","status":"pending_approval","idempotencyKey":"github-issue-create-contract-001","requestedPayload":{"title":"Retained issue","body":"[REDACTED]"},"approvedPayloadHash":"sha256:provider-action-contract","approvalReference":\(providerActionApprovalReferenceJSON),"adapterKind":"official_mcp","auditIdentity":\(providerExecutionAuditIdentityJSON),"providerResult":null,"providerError":null,"startedAt":null,"completedAt":null,"createdAt":"2026-01-01T00:00:14Z","updatedAt":"2026-01-01T00:00:14Z","redactionStatus":"private-state-excluded"}
"""

private let agentOpsRuntimeOverviewSummaryJSON = """
{"agentId":"agt-contract-001","runtimeType":"hermes","harnessDisplayName":"Hermes Agent","harnessLifecycleState":"connected","harnessHealthStatus":"healthy","activeDispatchCount":1,"queuedTaskCount":0,"waitingApprovalCount":1,"latestDispatchId":"rtd-contract-001","latestTaskId":"tsk-contract-001","latestThreadId":"thr-contract-001","latestMessageId":"msg-contract-001","redactedContext":"runtime=hermes | message=content_redacted","updatedAt":"2026-01-01T00:00:01Z"}
"""

private let agentOpsLiveAgentStateJSON = """
{"agentId":"agt-contract-001","agentName":"Workflow Assistant","groupType":"business","departmentId":"dep-contract-001","departmentName":"Contract Department Fixture","teamId":"team-contract-001","teamName":"Contract Team Fixture","roomId":"ops-room-001","realState":"waiting_for_approval","visibleState":"waiting_for_approval","source":"approval","confidence":"strong","dispatchId":"rtd-contract-001","taskId":"tsk-contract-001","threadId":"thr-contract-001","messageId":"msg-contract-001","reason":"Task is blocked on retained approval state.","expiresAt":null,"updatedAt":"2026-01-01T00:00:01Z","visualFallbackOnly":false,"runtimeOverview":\(agentOpsRuntimeOverviewSummaryJSON)}
"""

private let agentOpsEventFeedItemJSON = """
{"id":"agentops-task-tsk-contract-001","kind":"approval","title":"Approval-linked task blocked","summary":"Task tsk-contract-001 retained with redacted operator text.","severity":"warning","agentId":"agt-contract-001","dispatchId":null,"taskId":"tsk-contract-001","threadId":"thr-contract-001","messageId":null,"createdAt":"2026-01-01T00:00:01Z","redactionStatus":"operator-text-redacted"}
"""

private let agentOpsRuntimeOverviewSnapshotJSON = """
{"workspaceId":"wks-contract-001","refreshedAt":"2026-01-01T00:00:02Z","adminGuard":"owner_admin_only","activeDispatchCount":1,"queuedTaskCount":0,"waitingApprovalCount":1,"errorCount":0,"summaries":[\(agentOpsRuntimeOverviewSummaryJSON)]}
"""

private let agentOpsLiveStateSnapshotJSON = """
{"workspaceId":"wks-contract-001","refreshedAt":"2026-01-01T00:00:02Z","derivedFrom":["runtime_dispatch","approval","message"],"selectedAgentIds":["agt-contract-001"],"agents":[\(agentOpsLiveAgentStateJSON)],"events":[\(agentOpsEventFeedItemJSON)],"runtimeOverview":\(agentOpsRuntimeOverviewSnapshotJSON),"activeCount":1,"waitingApprovalCount":1,"errorCount":0,"visualFallbackCount":0}
"""

private let agentOpsVisualRectJSON = """
{"x":70,"y":120,"width":500,"height":176}
"""

private let agentOpsVisualPointJSON = """
{"x":138,"y":198}
"""

private let agentOpsVisualFloorJSON = """
{"id":"floor-business","title":"Business","subtitle":"Departments, teams, runtime work, and approvals","order":0,"bounds":{"x":0,"y":0,"width":1200,"height":760}}
"""

private let agentOpsVisualRoomJSON = """
{"id":"ops-room-001","floorId":"floor-business","title":"Contract Team Fixture","zone":"business","status":"waiting_for_approval","agentCount":1,"bounds":\(agentOpsVisualRectJSON),"deterministicFallback":true}
"""

private let agentOpsVisualEntityJSON = """
{"id":"agent-agt-contract-001","kind":"agent","title":"Workflow Assistant","subtitle":"waiting_for_approval via approval","floorId":"floor-business","roomId":"ops-room-001","agentId":"agt-contract-001","state":"waiting_for_approval","confidence":"strong","source":"approval","position":\(agentOpsVisualPointJSON),"selected":true,"visualFallbackOnly":false,"sourceRecordIds":["agent:agt-contract-001","task:tsk-contract-001","thread:thr-contract-001","message:msg-contract-001","source:approval"],"accessibilityLabel":"Agent Workflow Assistant, waiting_for_approval, strong confidence, source approval"}
"""

private let agentOpsVisualConnectionJSON = """
{"id":"agentops-connection-agent-agt-contract-001-ops-room-001","fromEntityId":"agent-agt-contract-001","toRoomId":"ops-room-001","kind":"assigned_room","sourceRecordIds":["agent:agt-contract-001","task:tsk-contract-001","source:approval"]}
"""

private let agentOpsVisualSceneSummaryJSON = """
{"activeCount":1,"waitingApprovalCount":1,"errorCount":0,"visualFallbackCount":0,"eventCount":1}
"""

private let agentOpsVisualSceneSnapshotJSON = """
{"workspaceId":"wks-contract-001","refreshedAt":"2026-01-01T00:00:02Z","sourceSnapshotRefreshedAt":"2026-01-01T00:00:02Z","activeFloorId":"floor-business","selectedEntityId":"agent-agt-contract-001","floors":[\(agentOpsVisualFloorJSON)],"rooms":[\(agentOpsVisualRoomJSON)],"entities":[\(agentOpsVisualEntityJSON)],"connections":[\(agentOpsVisualConnectionJSON)],"summary":\(agentOpsVisualSceneSummaryJSON),"assetStrategy":"bundled_web_agentops_floor_worker_assets","layoutPersistenceStatus":"web_default_operations_floor_layout_source_record_backed","redactionStatus":"operator_and_message_content_redacted","unavailableReasons":[]}
"""

private let threadSummaryJSON = """
{"id":"thr-contract-001","workspaceId":"wks-contract-001","title":"Contract Thread","threadType":"direct","selectedAgentId":"agt-contract-001","activeSessionId":"chs-contract-001","status":"active","readState":"unread","unreadCount":1,"isArchived":false,"archivedAt":null,"lastReadAt":null,"latestWrapUpReportId":"twr-contract-001","lastMessageSnippet":"Hello","lastMessageAt":"2026-01-01T00:00:00Z","createdAt":"2026-01-01T00:00:00Z","updatedAt":"2026-01-01T00:00:00Z"}
"""

private let messageJSON = """
{"id":"msg-contract-001","threadId":"thr-contract-001","threadSessionId":"chs-contract-001","senderType":"user","senderId":"prof-contract-001","senderName":"Local User","content":"Hello","contentFormat":"plain","metadata":{"unsupportedWebField":"fixture-recorded"},"createdAt":"2026-01-01T00:00:00Z"}
"""

private let chatComposerDraftJSON = """
{"id":"cdt-contract-001","threadId":"thr-contract-001","profileId":"prof-contract-001","content":"Draft body","metadata":{"state":"draft"},"createdAt":"2026-01-01T00:00:00Z","updatedAt":"2026-01-01T00:00:00Z"}
"""

private let chatMentionAvailabilityJSON = """
{"isAvailable":false,"reasonCode":"feature.missing_service","message":"Team mentions are unavailable until local team participants back suggestions.","help":"Mention suggestions stay disabled until team chat participant records are service-backed."}
"""

private let chatAttachmentJSON = """
{"id":"att-contract-001","threadId":"thr-contract-001","messageId":"msg-contract-001","profileId":"prof-contract-001","fileName":"brief.pdf","mimeType":"application/pdf","byteSize":18432,"sha256":"a1b2c3d4e5f60718293a4b5c6d7e8f90011223344556677889900aabbccddeeff","kind":"document","status":"uploaded","progress":100,"provenance":{"source":"native-file-picker","storage":"local-authorized","pathRedacted":true},"error":null,"createdAt":"2026-01-01T00:00:00Z","updatedAt":"2026-01-01T00:00:00Z"}
"""

private let chatDocumentReferenceJSON = """
{"id":"ref-contract-001","messageId":"msg-contract-001","title":"[REDACTED]","referenceKind":"document","displayPath":"[REDACTED]","tokenCount":640,"isSensitive":true,"isRedacted":true,"metadata":{"source":"local-reference","rawPath":"[REDACTED]"},"createdAt":"2026-01-01T00:00:00Z"}
"""

private let threadDetailJSON = """
{"id":"thr-contract-001","workspaceId":"wks-contract-001","title":"Contract Thread","threadType":"direct","selectedAgentId":"agt-contract-001","activeSessionId":"chs-contract-001","status":"active","readState":"unread","unreadCount":1,"isArchived":false,"archivedAt":null,"lastReadAt":null,"latestWrapUpReportId":"twr-contract-001","lastMessageSnippet":"Hello","lastMessageAt":"2026-01-01T00:00:00Z","createdAt":"2026-01-01T00:00:00Z","updatedAt":"2026-01-01T00:00:00Z","participants":[\(threadParticipantJSON)],"sessions":[\(chatSessionJSON)],"readStates":[\(threadReadStateJSON)],"wrapUpReports":[\(threadWrapUpReportJSON)],"messages":[\(messageJSON)]}
"""

private let threadDetailWithUnknownWebFieldsJSON = """
{"id":"thr-contract-001","workspaceId":"wks-contract-001","title":"Contract Thread","threadType":"direct","selectedAgentId":"agt-contract-001","activeSessionId":"chs-contract-001","status":"active","readState":"unread","unreadCount":1,"isArchived":false,"lastMessageSnippet":"Hello","lastMessageAt":"2026-01-01T00:00:00Z","createdAt":"2026-01-01T00:00:00Z","updatedAt":"2026-01-01T00:00:00Z","participants":[\(threadParticipantJSON)],"sessions":[\(chatSessionJSON)],"readStates":[\(threadReadStateJSON)],"wrapUpReports":[\(threadWrapUpReportJSON)],"messages":[\(messageJSON)],"webOnlyParticipants":[{"id":"web-only"}],"unsupportedWebField":"ignored"}
"""

private let legacyThreadSummaryJSON = """
{"id":"thr-contract-legacy-001","workspaceId":"wks-contract-001","title":"Legacy Thread","selectedAgentId":"agt-contract-001","status":"active","lastMessageSnippet":"Hello","lastMessageAt":"2026-01-01T00:00:00Z","createdAt":"2026-01-01T00:00:00Z","updatedAt":"2026-01-01T00:00:00Z"}
"""

private let legacyMessageJSON = """
{"id":"msg-contract-legacy-001","threadId":"thr-contract-legacy-001","senderType":"user","senderId":"prof-contract-001","senderName":"Local User","content":"Hello","contentFormat":"plain","metadata":{},"createdAt":"2026-01-01T00:00:00Z"}
"""

private let chatSessionJSON = """
{"id":"chs-contract-001","threadId":"thr-contract-001","sequenceNumber":1,"status":"active","isReadOnly":false,"startedAt":"2026-01-01T00:00:00Z","endedAt":null,"createdAt":"2026-01-01T00:00:00Z","updatedAt":"2026-01-01T00:00:00Z"}
"""

private let threadParticipantJSON = """
{"id":"thp-contract-001","threadId":"thr-contract-001","participantType":"agent","participantId":"agt-contract-001","displayName":"Workflow Assistant","role":"member","isManager":false,"joinedAt":"2026-01-01T00:00:00Z","leftAt":null,"createdAt":"2026-01-01T00:00:00Z","updatedAt":"2026-01-01T00:00:00Z"}
"""

private let threadReadStateJSON = """
{"id":"trs-contract-001","threadId":"thr-contract-001","profileId":"prof-contract-001","lastReadMessageId":"msg-contract-001","lastReadAt":"2026-01-01T00:00:00Z","unreadCount":0,"createdAt":"2026-01-01T00:00:00Z","updatedAt":"2026-01-01T00:00:00Z"}
"""

private let threadWrapUpReportJSON = """
{"id":"twr-contract-001","threadId":"thr-contract-001","sessionId":"chs-contract-001","workspaceId":"wks-contract-001","status":"pending","title":"Cycle 1 transcript","markdown":null,"summary":null,"metadata":{"redacted":"[REDACTED]"},"messageCount":1,"provider":null,"model":null,"error":null,"completedAt":null,"createdAt":"2026-01-01T00:00:00Z","updatedAt":"2026-01-01T00:00:00Z"}
"""

private let runtimeSessionJSON = """
{"id":"rts-contract-001","threadId":"thr-contract-001","agentId":"agt-contract-001","runtimeBindingId":"rb-contract-001","externalSessionId":null,"status":"active","metadata":{"mode":"contract"},"createdAt":"2026-01-01T00:00:00Z","updatedAt":"2026-01-01T00:00:00Z"}
"""

private let runtimeDispatchJSON = """
{"id":"rtd-contract-001","threadId":"thr-contract-001","messageId":"msg-contract-001","agentId":"agt-contract-001","harnessId":"hrn-contract-001","sessionId":"rts-contract-001","status":"failed","correlationId":"corr-contract-001","inputSnapshot":{"content":"Hello","runtimeType":"hermes","attempt":2,"retrySourceMessageId":"msg-contract-001","retryOfDispatchId":"rtd-contract-original-001","auth":"[REDACTED]"},"resultSnapshot":null,"errorSnapshot":{"category":"transport_error","message":"[REDACTED]","retryable":true,"retrySafetyEvidenceId":"dispatch.retry.contract-001","attempt":2,"runtimeType":"hermes","retrySourceMessageId":"msg-contract-001"},"startedAt":"2026-01-01T00:00:01Z","completedAt":"2026-01-01T00:00:02Z","createdAt":"2026-01-01T00:00:00Z","updatedAt":"2026-01-01T00:00:02Z"}
"""

private let activeRuntimeDispatchJSON = """
{"id":"rtd-contract-active-001","threadId":"thr-contract-001","messageId":"msg-contract-001","agentId":"agt-contract-001","harnessId":"hrn-contract-001","sessionId":"rts-contract-001","status":"started","correlationId":"corr-contract-active-001","inputSnapshot":{"content":"Hello","runtimeType":"hermes","attempt":1,"retrySourceMessageId":"msg-contract-001"},"resultSnapshot":{"runtimeStatusMessage":"Connecting to Hermes Agent","attempt":1,"runtimeType":"hermes"},"errorSnapshot":null,"startedAt":"2026-01-01T00:00:01Z","completedAt":null,"createdAt":"2026-01-01T00:00:00Z","updatedAt":"2026-01-01T00:00:01Z"}
"""

private let runtimeDispatchPendingRunConfirmationJSON = """
{"id":"rtd-contract-run-pending-001","threadId":"thr-contract-001","messageId":"msg-contract-001","agentId":"agt-contract-001","harnessId":"hrn-contract-001","sessionId":"rts-contract-001","status":"queued","correlationId":"corr-contract-run-pending-001","inputSnapshot":{"content":"Hello","runtimeType":"hermes","attempt":1,"retrySourceMessageId":"msg-contract-001","runtimeRunConfirmationRequired":true,"runtimeRunConfirmationState":"pending","runtimeRunConfirmationTitle":"Run Contract Agent","runtimeRunConfirmationSummary":"Hello","runtimeRunConfirmationRequestedAt":"2026-01-01T00:00:00Z"},"resultSnapshot":{"runtimeRunConfirmationRequired":true,"runtimeRunConfirmationState":"pending","runtimeRunConfirmationTitle":"Run Contract Agent","runtimeRunConfirmationSummary":"Hello","runtimeStatusMessage":"Waiting for Run confirmation"},"errorSnapshot":null,"startedAt":null,"completedAt":null,"createdAt":"2026-01-01T00:00:00Z","updatedAt":"2026-01-01T00:00:00Z"}
"""

private let runtimeDispatchRejectedRunConfirmationJSON = """
{"id":"rtd-contract-run-rejected-001","threadId":"thr-contract-001","messageId":"msg-contract-001","agentId":"agt-contract-001","harnessId":"hrn-contract-001","sessionId":"rts-contract-001","status":"cancelled","correlationId":"corr-contract-run-rejected-001","inputSnapshot":{"content":"Hello","runtimeType":"hermes","attempt":1,"retrySourceMessageId":"msg-contract-001","runtimeRunConfirmationRequired":true,"runtimeRunConfirmationState":"pending","runtimeRunConfirmationTitle":"Run Contract Agent","runtimeRunConfirmationSummary":"Hello","runtimeRunConfirmationRequestedAt":"2026-01-01T00:00:00Z"},"resultSnapshot":{"runtimeRunConfirmationRequired":true,"runtimeRunConfirmationState":"pending","runtimeRunConfirmationTitle":"Run Contract Agent","runtimeRunConfirmationSummary":"Hello","runtimeStatusMessage":"Waiting for Run confirmation"},"errorSnapshot":{"runtimeRunConfirmationRequired":true,"runtimeRunConfirmationState":"rejected","runtimeRunConfirmationTitle":"Run Contract Agent","runtimeRunConfirmationSummary":"Hello","category":"run_confirmation_rejected","message":"Run rejected before the runtime started.","retryable":false},"startedAt":null,"completedAt":"2026-01-01T00:00:02Z","createdAt":"2026-01-01T00:00:00Z","updatedAt":"2026-01-01T00:00:02Z"}
"""

private let runtimeDispatchWithActivityProjectionJSON = """
{"id":"rtd-contract-activity-001","threadId":"thr-contract-001","messageId":"msg-contract-001","agentId":"agt-contract-001","harnessId":"hrn-contract-001","sessionId":"rts-contract-001","status":"streaming","correlationId":"corr-contract-activity-001","inputSnapshot":{"content":"Hello","runtimeType":"hermes","attempt":1,"retrySourceMessageId":"msg-contract-001"},"resultSnapshot":{"runtimeActivityProjection":\(runtimeActivityProjectionJSON),"draftText":"Partial response","runtimeToolSummary":"python3 script.py","attempt":1,"runtimeType":"hermes"},"errorSnapshot":null,"startedAt":"2026-01-01T00:00:01Z","completedAt":null,"createdAt":"2026-01-01T00:00:00Z","updatedAt":"2026-01-01T00:00:04Z"}
"""

private let logEventJSON = """
{"id":"evt-contract-001","timestamp":"2026-01-01T00:00:00Z","severity":"info","category":"contract","message":"credential=[REDACTED]","correlationId":"corr-contract-001","dispatchId":"rtd-contract-001","harnessId":"hrn-contract-001","threadId":"thr-contract-001","detail":{"token":"[REDACTED]"}}
"""

private let secretReferenceJSON = """
{"id":"sec-contract-001","scope":"harness","scopeId":"hrn-contract-001","label":"Provider API Key","provider":"test-os-keychain","keychainService":"Relay Console","keychainAccount":"sec-contract-001:Provider API Key","createdAt":"2026-01-01T00:00:00Z","updatedAt":"2026-01-01T00:00:00Z"}
"""

private let appStateJSON = """
{"appName":"Relay Console","appVersion":"0.1.0","hasProfile":true,"activeProfile":\(localProfileJSON),"activeWorkspace":\(workspaceJSON),"firstRunRequired":false}
"""

private let runtimeEventJSON = """
{"id":"rte-contract-001","dispatchId":"rtd-contract-001","threadId":"thr-contract-001","agentId":"agt-contract-001","runtimeType":"hermes","type":"status","text":null,"status":"queued","detail":{"progress":"queued"},"timestamp":"2026-01-01T00:00:00Z"}
"""

private let runtimeActivityProjectionJSON = """
{
  "schemaVersion": 1,
  "dispatchId": "rtd-contract-active-001",
  "items": [
    {
      "id": "activity-tool-1",
      "dispatchId": "rtd-contract-active-001",
      "kind": "tool",
      "phase": "running",
      "title": "Running command",
      "summary": "python3 script.py",
      "toolName": "exec_command",
      "toolCallId": "call-tool-1",
      "groupId": "group-tool-actions-1",
      "eventIds": ["rte-tool-start", "rte-tool-progress"],
      "startedAt": "2026-01-01T00:00:01Z",
      "updatedAt": "2026-01-01T00:00:04Z",
      "durationMs": 3000,
      "detail": {"command": "[REDACTED]", "gatewayEvent": "tool.progress"},
      "result": {"preview": "2 steps"},
      "error": null,
      "compatibilityMetadata": {"source": "hermes.tool.progress"}
    },
    {
      "id": "activity-thinking-1",
      "dispatchId": "rtd-contract-active-001",
      "kind": "thinking",
      "phase": "running",
      "title": "Thinking",
      "summary": "Checking runtime state",
      "eventIds": ["rte-thinking-1"],
      "detail": {"gatewayEvent": "thinking.delta"},
      "compatibilityMetadata": {}
    },
    {
      "id": "activity-future-1",
      "kind": "future_activity",
      "phase": "paused",
      "title": "Future runtime item",
      "detail": {"futureField": true},
      "compatibilityMetadata": {"rawSource": "future"}
    }
  ],
  "toolGroups": [
    {
      "id": "group-tool-actions-1",
      "title": "Tool actions",
      "phase": "running",
      "itemIds": ["activity-tool-1"],
      "summary": "1 step",
      "runningCount": 1,
      "completedCount": 0,
      "failedCount": 0,
      "startedAt": "2026-01-01T00:00:01Z",
      "updatedAt": "2026-01-01T00:00:04Z",
      "durationMs": 3000,
      "detail": {"grouping": "consecutive_non_task_tools"},
      "compatibilityMetadata": {"source": "relay.runtime_activity_projection"}
    }
  ],
  "tasks": [
    {
      "id": "todo-1",
      "content": "Read current source",
      "status": "completed",
      "priority": 1,
      "sourceToolCallId": "todo-live",
      "startedAt": "2026-01-01T00:00:01Z",
      "completedAt": "2026-01-01T00:00:03Z",
      "detail": {"source": "hermes.todo"},
      "compatibilityMetadata": {}
    },
    {
      "id": "todo-future-1",
      "content": "Handle a future task state",
      "status": "deferred",
      "detail": {"source": "future.todo"},
      "compatibilityMetadata": {"rawStatus": "deferred"}
    }
  ],
  "draftText": "Partial response",
  "lastEventId": "rte-tool-progress",
  "lastEventType": "tool.progress",
  "updatedAt": "2026-01-01T00:00:04Z",
  "compatibilityMetadata": {"storage": "runtime_dispatches.result_snapshot_json"},
  "futureProjectionField": "ignored"
}
"""

private let workSafetyLinkedReferencesJSON = """
{"actionRunId":"rar-work-safety-001","dispatchId":"rtd-work-safety-001","structuredJobId":"rsj-work-safety-001","sourceHostRecordId":"source-host-excluded","scheduledMessageId":"sched-work-safety-001"}
"""

private let workSafetyTaskRecordJSON = """
{"id":"wst-contract-001","workspaceId":"wks-contract-001","title":"Approval-held task","message":"[REDACTED]","status":"blocked_by_approval","targetType":"agent","targetId":"agt-contract-001","assignedAgentId":"agt-contract-001","threadId":"thr-contract-001","runtimeBindingId":"rb-contract-001","linkedReferences":\(workSafetyLinkedReferencesJSON),"approvalRequired":true,"approvalId":"wsa-contract-001","scheduledAt":"2026-01-01T00:10:00Z","recurrenceRule":"FREQ=DAILY;COUNT=1","priority":2,"riskLevel":"high","metadata":{"path":"[REDACTED]","approvalBoundary":"task_scoped"},"createdAt":"2026-01-01T00:00:00Z","updatedAt":"2026-01-01T00:01:00Z","completedAt":null,"redactionStatus":"private-state-excluded"}
"""

private let workSafetyTaskRunRecordJSON = """
{"id":"wstr-contract-001","workspaceId":"wks-contract-001","taskId":"wst-contract-001","status":"blocked_by_approval","linkedReferences":\(workSafetyLinkedReferencesJSON),"attempt":1,"startedAt":null,"completedAt":null,"failureMessage":"[REDACTED]","metadata":{"command":"[REDACTED]"},"createdAt":"2026-01-01T00:00:00Z","updatedAt":"2026-01-01T00:01:00Z","redactionStatus":"private-state-excluded"}
"""

private let workSafetyTaskEventRecordJSON = """
{"id":"wste-contract-001","workspaceId":"wks-contract-001","taskId":"wst-contract-001","runId":"wstr-contract-001","approvalId":"wsa-contract-001","eventType":"approval_requested","status":"blocked_by_approval","detail":{"reason":"approval-required","payload":"[REDACTED]"},"occurredAt":"2026-01-01T00:01:00Z","redactionStatus":"private-state-excluded"}
"""

private let workSafetyApprovalStepRecordJSON = """
{"id":"wsas-contract-001","workspaceId":"wks-contract-001","approvalId":"wsa-contract-001","label":"Confirm scope","value":"[REDACTED]","status":"pending","sortIndex":1,"redactionStatus":"private-state-excluded"}
"""

private let workSafetyApprovalNoteRecordJSON = """
{"id":"wsan-contract-001","workspaceId":"wks-contract-001","approvalId":"wsa-contract-001","authorAgentId":"agt-contract-001","note":"[REDACTED]","createdAt":"2026-01-01T00:02:00Z","redactionStatus":"private-state-excluded"}
"""

private let workSafetyApprovalRecordJSON = """
{"id":"wsa-contract-001","workspaceId":"wks-contract-001","taskId":"wst-contract-001","title":"Review approval-held task","description":"[REDACTED]","status":"pending","riskLevel":"high","requestedByAgentId":"agt-contract-001","resolverAgentId":null,"expiresAt":"2026-01-01T01:00:00Z","resolvedAt":null,"steps":[\(workSafetyApprovalStepRecordJSON)],"notes":[\(workSafetyApprovalNoteRecordJSON)],"metadata":{"source":"task-scoped","secret":"[REDACTED]"},"createdAt":"2026-01-01T00:00:00Z","updatedAt":"2026-01-01T00:02:00Z","redactionStatus":"private-state-excluded"}
"""

private let permissionPolicyRecordJSON = """
{"id":"ppol-contract-001","workspaceId":"wks-contract-001","name":"Deny destructive task dispatch","effect":"deny","status":"active","roleTargets":["admin"],"resourceType":"work_safety_task","resourceId":"wst-contract-001","action":"dispatch","priority":100,"reasonCode":"policy.blocked","message":"Dispatch requires a narrower review policy.","metadata":{"path":"[REDACTED]","source":"permission-policy-service"},"createdByActorId":"usr-contract-owner","updatedByActorId":"usr-contract-admin","createdAt":"2026-01-01T00:00:00Z","updatedAt":"2026-01-01T00:01:00Z","redactionStatus":"private-state-excluded"}
"""

private let permissionPolicyEvaluationJSON = """
{"workspaceId":"wks-contract-001","actorId":"usr-contract-admin","resourceType":"work_safety_task","resourceId":"wst-contract-001","action":"dispatch","decision":"denied","allowed":false,"matchedPolicyId":"ppol-contract-001","reasonCode":"policy.blocked","message":"Dispatch requires a narrower review policy.","evaluatedAt":"2026-01-01T00:02:00Z"}
"""

private let auditLogRecordJSON = """
{"id":"aud-contract-001","workspaceId":"wks-contract-001","actorId":"usr-contract-admin","actorType":"admin_user","eventType":"permission.denied","resourceType":"work_safety_task","resourceId":"wst-contract-001","severity":"warning","message":"Permission denied for redacted retained action.","correlationId":"corr-contract-001","taskId":"wst-contract-001","approvalId":"wsa-contract-001","actionRunId":"rar-contract-001","dispatchId":"rtd-contract-001","threadId":"thr-contract-001","harnessId":"hrn-contract-001","source":"permission-policy-service","context":{"reasonCode":"policy.blocked","commandLine":"[REDACTED]","environment":{"API_TOKEN":"[REDACTED]"},"localPath":"[REDACTED]"},"writeStatus":"recorded","createdAt":"2026-01-01T00:03:00Z","redactionStatus":"private-state-excluded"}
"""

private let auditLogPageJSON = """
{"records":[\(auditLogRecordJSON)],"limit":50,"offset":0,"nextOffset":null,"totalCount":1,"redactionStatus":"private-state-excluded"}
"""

private let securityMetricSnapshotJSON = """
{"id":"secmet-contract-001","workspaceId":"wks-contract-001","windowStartedAt":"2026-01-01T00:00:00Z","windowEndedAt":"2026-01-01T01:00:00Z","generatedAt":"2026-01-01T01:00:00Z","auditEventCount":7,"deniedActionCount":2,"permissionDeniedCount":1,"approvalDecisionCount":1,"policyMutationCount":1,"taskTransitionCount":1,"toolRequestTransitionCount":1,"commandRejectionCount":1,"highRiskExecutionCount":1,"filePermissionChangeCount":0,"exportResetAttemptCount":0,"recoveryEventCount":1,"auditWriteFailureCount":0,"redactionAppliedCount":3,"categoryCounts":{"permission.denied":1,"approval.decision":1},"redactionStatus":"private-state-excluded"}
"""

private let nativeFilePermissionRecordJSON = """
{"id":"nfperm-contract-001","workspaceId":"wks-contract-001","targetKind":"folder","displayName":"Linked folder","displayPath":"folder Linked folder ([REDACTED])","pathHash":"opaque-path-hash","bookmarkRef":"bookmark-opaque","accessLevel":"read_write","status":"read_write_granted","relatedTaskId":"wst-contract-001","relatedToolRequestId":"treq-contract-001","relatedActionRunId":"rar-contract-001","lastValidatedAt":"2026-01-01T00:04:00Z","lastSyncedAt":null,"failureReason":null,"metadata":{"rawPathPersisted":false,"paperclipExcluded":true,"sourceSyncExcluded":true},"createdByActorId":"usr-contract-owner","updatedByActorId":"usr-contract-owner","revokedAt":null,"createdAt":"2026-01-01T00:04:00Z","updatedAt":"2026-01-01T00:04:00Z","redactionStatus":"private-state-excluded"}
"""

private let settingsAlertRecordJSON = """
{"id":"salert-contract-001","workspaceId":"wks-contract-001","title":"Provider reconnect required","message":"Reconnect the provider from Settings.","severity":"warning","category":"integrations","sourceKind":"provider_connection","sourceId":"mpc-contract-001","actionLabel":"Open integrations","actionTarget":"settings.integrations","expiresAt":null,"readAt":null,"metadata":{"secret":"[REDACTED]","deliveryScope":"in_app"},"createdAt":"2026-01-01T00:05:00Z","updatedAt":"2026-01-01T00:05:00Z","redactionStatus":"private-state-excluded"}
"""

private let settingsNotificationPreferencesJSON = """
{"id":"snprefs-contract-001","workspaceId":"wks-contract-001","profileId":"prof-contract-001","inAppAlertsEnabled":true,"unreadBadgeEnabled":true,"emailDeliveryState":"unavailable","mobileDeliveryState":"unavailable","metadata":{"deliveryScope":"in_app_only","emailDeliveryPersisted":false,"mobileDeliveryPersisted":false},"createdAt":"2026-01-01T00:05:00Z","updatedAt":"2026-01-01T00:05:00Z","redactionStatus":"private-state-excluded"}
"""

private let settingsHarnessSummaryJSON = """
{"harnessId":"hrn-contract-001","harnessKey":"hermes","displayName":"Hermes Agent","lifecycleState":"connected","modelAuthStatus":"connected","source":"managed","healthStatus":"healthy","secretReferencePresent":true,"lastError":null}
"""

private let settingsIntegrationSummaryJSON = """
{"workspaceId":"wks-contract-001","refreshedAt":"2026-01-01T00:05:00Z","harnesses":[\(settingsHarnessSummaryJSON)],"providerState":"ready","providerConnectionCount":1,"providerSecretReferenceCount":1,"marketplaceState":"empty","marketplaceInstallCount":0,"neededToolsOpenCount":2,"adminSetupAvailable":true,"readOnly":false,"paperclipState":"excluded","redactionStatus":"private-state-excluded"}
"""

private let settingsDecisionGateDispositionJSON = """
{"id":"sdg-contract-001","workspaceId":"wks-contract-001","decisionId":"D-0006","surface":"local_lifecycle_destructive_actions","state":"decision_gated","reasonCode":"decision.required","currentUiState":"Local export metadata can be prepared; reset and removal controls are blocked.","missingPrerequisites":"Approved local export, reset, removal, retention, support-evidence, and audit semantics.","activationRequirement":"Resolve D-0006 before destructive lifecycle execution.","releaseImpact":"Destructive lifecycle execution remains blocked.","metadata":{"stateKind":"decision_gated","secret":"[REDACTED]"},"createdAt":"2026-01-01T00:06:00Z","updatedAt":"2026-01-01T00:06:00Z","redactionStatus":"private-state-excluded"}
"""

private let settingsSecurityActionDispositionJSON = """
{"id":"reset_local_data","title":"Reset local data","detail":"Blocked until D-0006 defines local retention semantics.","state":"decision_gated","reasonCode":"decision.required","decisionId":"D-0006","enabled":false,"auditRequired":true,"destructive":true,"redactionStatus":"private-state-excluded"}
"""

private let settingsLocalAccountExportRecordJSON = """
{"id":"slx-contract-001","workspaceId":"wks-contract-001","profileId":"prof-contract-001","status":"prepared","fileName":"relay-console-local-account-export.json","recordCount":4,"includesSecrets":false,"exportMetadata":{"recordTypes":["profile_metadata","workspace_metadata","settings_preferences"],"rawSecretsIncluded":false,"profileValuesIncluded":false,"workspaceValuesIncluded":false},"createdAt":"2026-01-01T00:07:00Z","updatedAt":"2026-01-01T00:07:00Z","redactionStatus":"private-state-excluded"}
"""

private let settingsSecuritySummaryJSON = """
{"workspaceId":"wks-contract-001","profileId":"prof-contract-001","mode":"local-first","generatedAt":"2026-01-01T00:08:00Z","decisionDispositions":[\(settingsDecisionGateDispositionJSON)],"actionDispositions":[\(settingsSecurityActionDispositionJSON)],"latestExport":\(settingsLocalAccountExportRecordJSON),"supportEvidenceState":"decision_gated","cloudAccountState":"unavailable","destructiveLifecycleState":"decision_gated","redactionStatus":"private-state-excluded"}
"""

private let insightsReportSnapshotJSON = """
{"id":"irs-contract-001","workspaceId":"wks-contract-001","title":"Weekly retained snapshot","summary":"Source-backed retained metrics.","snapshotType":"workspace","periodLabel":"This week","rangeStart":"2026-01-01T00:00:00Z","rangeEnd":"2026-01-07T00:00:00Z","payload":{"messageCount":3,"redactionStatus":"private-state-excluded"},"archivedAt":null,"createdAt":"2026-01-01T00:09:00Z","updatedAt":"2026-01-01T00:09:00Z","redactionStatus":"private-state-excluded"}
"""

private let insightsReportRowJSON = """
{"id":"twr-contract-001","sourceType":"chat_report","sourceRecordId":"twr-contract-001","groupId":"thr-contract-001","groupTitle":"Source thread","groupSubtitle":"Team chat wrap-up","cycleLabel":"Cycle 1","threadId":"thr-contract-001","sessionId":"chs-contract-001","title":"Cycle 1 transcript","subtitle":"Chat report","status":"completed","statusLabel":"Completed","badge":"Chat reports","fileName":"Cycle 1 transcript.md","createdAt":"2026-01-01T00:09:00Z","updatedAt":"2026-01-01T00:09:00Z","archivedAt":null,"messageCount":3,"provider":"hermes","model":"local","hasMarkdown":true,"hasStructuredData":true,"redactionStatus":"private-state-excluded"}
"""

private let insightsReportGroupJSON = """
{"id":"thr-contract-001","title":"Source thread","subtitle":"Team chat wrap-up","badge":"Chat reports","updatedAt":"2026-01-01T00:09:00Z","archivedAt":null,"isCollapsible":true,"rows":[\(insightsReportRowJSON)]}
"""

private let insightsReportListSnapshotJSON = """
{"state":"ready","rows":[\(insightsReportRowJSON)],"groups":[\(insightsReportGroupJSON)],"selectedReportId":"twr-contract-001","searchQuery":"","sourceFilter":"all","sort":"newest","includeArchived":false,"totalCount":1,"filteredCount":1,"archivedCount":0,"emptyReason":null,"generatedAt":"2026-01-01T00:09:00Z","redactionStatus":"private-state-excluded"}
"""

private let insightsViewStateJSON = """
{"searchQuery":"cycle","sourceFilter":"chat_reports","sort":"title","includeArchived":true,"selectedReportId":"twr-contract-001","showingAnalytics":true,"activityGapMinutes":1440,"updatedAt":"2026-01-01T00:09:00Z"}
"""

private let insightsReportDetailJSON = """
{"row":\(insightsReportRowJSON),"markdown":"# Cycle 1","structuredData":{"messageCount":3},"snapshotData":{},"error":null,"metadata":{"source":"contract"},"retryAvailable":false,"retryUnavailableReason":null,"archiveAvailable":true,"redactionStatus":"private-state-excluded"}
"""

private let threadAnalyticsSenderJSON = """
{"id":"user|Local User","senderName":"Local User","senderType":"user","messageCount":2}
"""

private let threadAnalyticsActivePeriodJSON = """
{"id":"active-window-1","title":"Window 1","startedAt":"2026-01-01T00:00:00Z","endedAt":"2026-01-01T00:02:00Z","messageCount":3}
"""

private let threadAnalyticsSessionJSON = """
{"id":"chs-contract-001","sequenceNumber":1,"messageCount":3,"userMessageCount":2,"agentMessageCount":1,"status":"active","repeatAnalysisStatus":"completed","repeatedAgentMessageCount":1,"repeatedCrossAgentMessageCount":1,"agentRepeatGroupCount":1,"repeatAnalysisError":null}
"""

private let threadAnalyticsSnapshotJSON = """
{"threadId":"thr-contract-001","activityGapMinutes":30,"messageCount":3,"senderCount":2,"sessionCount":1,"threadLength":"2 minutes","yourMessageCount":2,"userMessageCount":2,"agentMessageCount":1,"activeWindowCount":1,"firstMessageAt":"2026-01-01T00:00:00Z","lastMessageAt":"2026-01-01T00:02:00Z","senders":[\(threadAnalyticsSenderJSON)],"activePeriods":[\(threadAnalyticsActivePeriodJSON)],"sessions":[\(threadAnalyticsSessionJSON)],"exportAvailable":true,"emptyReason":null,"redactionStatus":"private-state-excluded"}
"""

private let auditLogQueryJSON = """
{"limit":50,"offset":0,"eventType":"permission.denied","resourceType":"work_safety_task","resourceId":"wst-contract-001","severity":"warning","from":"2026-01-01T00:00:00Z","to":"2026-01-01T01:00:00Z"}
"""

private let auditLogRecordRequestJSON = """
{"eventType":"command.rejected","resourceType":"command","resourceId":"cmd-contract-001","severity":"warning","message":"Rejected command payload redacted.","taskId":"wst-contract-001","approvalId":"wsa-contract-001","actionRunId":"rar-contract-001","dispatchId":"rtd-contract-001","threadId":"thr-contract-001","harnessId":"hrn-contract-001","source":"contract-fixture","context":{"commandLine":"[REDACTED]","localPath":"[REDACTED]"}}
"""

private struct ModelContractFailure: Error, CustomStringConvertible {
    var description: String
    init(_ description: String) {
        self.description = description
    }
}
