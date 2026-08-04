import Foundation

public final class LocalDataService {
    private let database: DatabaseService
    private let eventBus: RelayEventBus
    private let appVersion: String

    public init(database: DatabaseService, eventBus: RelayEventBus, appVersion: String) {
        self.database = database
        self.eventBus = eventBus
        self.appVersion = appVersion
    }

    public func getAppState() throws -> AppState {
        let profile = try getActiveProfile()
        let workspace = try getActiveWorkspace()
        return AppState(
            appName: "Relay Console",
            appVersion: appVersion,
            hasProfile: profile != nil,
            activeProfile: profile,
            activeWorkspace: workspace,
            firstRunRequired: profile == nil || workspace == nil
        )
    }

    @discardableResult
    public func ensureDefaultLocalState() throws -> (profile: LocalProfile, workspace: Workspace, created: Bool) {
        var created = false
        let profile: LocalProfile
        if let existing = try getActiveProfile() {
            profile = existing
        } else {
            profile = try createProfile(displayName: "Local user")
            created = true
        }

        let workspace: Workspace
        if let existing = try getActiveWorkspace() {
            workspace = existing
        } else {
            workspace = try createWorkspace(profileId: profile.id, name: "Local workspace", defaultFolderPath: nil)
            created = true
        }

        if created {
            _ = try log(severity: "info", category: "app", message: "Default local Relay Console workspace initialized.", detail: [
                "profileId": .string(profile.id),
                "workspaceId": .string(workspace.id)
            ])
            if let state = try? getAppState() {
                eventBus.emit(.appStateChanged, state)
            }
        }
        return (profile, workspace, created)
    }

    public func createProfile(
        displayName: String,
        email: String? = nil,
        avatarUrl: String? = nil,
        telemetryEnabled: Bool = false,
        crashReportingEnabled: Bool = false,
        theme: String = "classic"
    ) throws -> LocalProfile {
        let name = try requireNonEmptyString(displayName, field: "Display name", maxLength: 120)
        let email = try normalizedEmail(email)
        let avatar = try optionalTrimmedString(avatarUrl, field: "Avatar", maxLength: profileAvatarMaxLength)
        let theme = try normalizedTheme(theme)
        let id = createRelayId("prof")
        let timestamp = nowIso()
        try database.run(
            """
            INSERT INTO local_profiles (
              id, display_name, email, avatar_url, telemetry_enabled, crash_reporting_enabled,
              theme, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                .text(id),
                .text(name),
                email.sqliteText,
                avatar.sqliteText,
                .integer(telemetryEnabled ? 1 : 0),
                .integer(crashReportingEnabled ? 1 : 0),
                .text(theme),
                .text(timestamp),
                .text(timestamp)
            ]
        )
        return try getProfile(id)
    }

    public func updateProfile(
        profileId: String,
        displayName: String,
        email: String?,
        avatarUrl: String?,
        telemetryEnabled: Bool,
        crashReportingEnabled: Bool,
        theme: String
    ) throws -> LocalProfile {
        _ = try getProfile(profileId)
        let name = try requireNonEmptyString(displayName, field: "Display name", maxLength: 120)
        let email = try normalizedEmail(email)
        let avatar = try optionalTrimmedString(avatarUrl, field: "Avatar", maxLength: profileAvatarMaxLength)
        let theme = try normalizedTheme(theme)
        try database.run(
            """
            UPDATE local_profiles
            SET display_name = ?, email = ?, avatar_url = ?, telemetry_enabled = ?,
                crash_reporting_enabled = ?, theme = ?, updated_at = ?
            WHERE id = ?
            """,
            [
                .text(name),
                email.sqliteText,
                avatar.sqliteText,
                .integer(telemetryEnabled ? 1 : 0),
                .integer(crashReportingEnabled ? 1 : 0),
                .text(theme),
                .text(nowIso()),
                .text(profileId)
            ]
        )
        let updated = try getProfile(profileId)
        if let state = try? getAppState() {
            eventBus.emit(.appStateChanged, state)
        }
        return updated
    }

    @discardableResult
    public func migrateLegacyUserProfilePreference(_ legacy: LocalProfilePreferenceSnapshot?) throws -> LocalProfile? {
        guard try getAppSetting("profile.legacyUserDefaultsMigrated", fallback: false) == false else {
            return try getActiveProfile()
        }
        defer {
            try? setAppSetting("profile.legacyUserDefaultsMigrated", value: true)
        }
        guard let profile = try getActiveProfile(), let legacy else {
            return try getActiveProfile()
        }

        let displayName = (try? requireNonEmptyString(legacy.displayName, field: "Display name", maxLength: 120)) ?? profile.displayName
        let email = (try? normalizedEmail(legacy.email)) ?? profile.email
        let avatar = (try? optionalTrimmedString(legacy.avatarUrl, field: "Avatar", maxLength: profileAvatarMaxLength)) ?? profile.avatarUrl
        let theme = (try? normalizedTheme(legacy.theme)) ?? profile.theme
        return try updateProfile(
            profileId: profile.id,
            displayName: displayName,
            email: email,
            avatarUrl: avatar,
            telemetryEnabled: legacy.telemetryEnabled ?? profile.telemetryEnabled,
            crashReportingEnabled: legacy.crashReportingEnabled ?? profile.crashReportingEnabled,
            theme: theme
        )
    }

    public func getActiveProfile() throws -> LocalProfile? {
        guard let row = try database.get("SELECT * FROM local_profiles ORDER BY created_at ASC LIMIT 1") else {
            return nil
        }
        return try mapProfile(row)
    }

    public func getProfile(_ profileId: String) throws -> LocalProfile {
        guard let row = try database.get("SELECT * FROM local_profiles WHERE id = ?", [.text(profileId)]) else {
            throw RelayError(.profileMissing, "Local profile was not found.")
        }
        return try mapProfile(row)
    }

    public func createWorkspace(
        profileId: String,
        name: String,
        defaultFolderPath: String?,
        workspaceType: String = "personal",
        settings: JSONRecord = [:]
    ) throws -> Workspace {
        _ = try getProfile(profileId)
        let name = try requireNonEmptyString(name, field: "Workspace name", maxLength: 160)
        let folder = try optionalTrimmedString(defaultFolderPath, field: "Workspace folder", maxLength: 2000)
        let workspaceType = try normalizedWorkspaceType(workspaceType)
        let id = createRelayId("wks")
        let timestamp = nowIso()
        try database.run(
            """
            INSERT INTO workspaces (
              id, profile_id, name, default_folder_path, workspace_type, settings_json,
              created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                .text(id),
                .text(profileId),
                .text(name),
                folder.sqliteText,
                .text(workspaceType),
                .text(encodeJSONRecord(redactRecord(settings))),
                .text(timestamp),
                .text(timestamp)
            ]
        )
        if try getSelectedWorkspaceId() == nil {
            try setSelectedWorkspaceId(id)
        }
        return try getWorkspace(id)
    }

    @discardableResult
    public func createAndSelectEmptyWorkspace(
        profileId: String,
        name: String
    ) throws -> Workspace {
        let workspace = try createWorkspace(
            profileId: profileId,
            name: name,
            defaultFolderPath: nil,
            workspaceType: "personal",
            settings: [
                "accountIsolatedLocalData": .bool(true),
                "residentAgentAutoBootstrap": .bool(false),
            ]
        )
        try setSelectedWorkspaceId(workspace.id)
        return workspace
    }

    @discardableResult
    public func markWorkspaceAsAccountIsolated(_ workspaceId: String) throws -> Workspace {
        let workspace = try getWorkspace(workspaceId)
        var settings = workspace.settings
        settings["accountIsolatedLocalData"] = .bool(true)
        settings["residentAgentAutoBootstrap"] = .bool(false)
        return try updateWorkspaceSettings(
            workspaceId: workspace.id,
            name: workspace.name,
            defaultFolderPath: workspace.defaultFolderPath,
            workspaceType: workspace.workspaceType,
            settings: settings
        )
    }

    public func getActiveWorkspace() throws -> Workspace? {
        if let selectedId = try getSelectedWorkspaceId(),
           let row = try database.get("SELECT * FROM workspaces WHERE id = ?", [.text(selectedId)]) {
            return try mapWorkspace(row)
        }
        guard let row = try database.get("SELECT * FROM workspaces ORDER BY created_at ASC LIMIT 1") else {
            return nil
        }
        return try mapWorkspace(row)
    }

    public func getWorkspace(_ workspaceId: String) throws -> Workspace {
        guard let row = try database.get("SELECT * FROM workspaces WHERE id = ?", [.text(workspaceId)]) else {
            throw RelayError(.workspaceMissing, "Local workspace was not found.")
        }
        return try mapWorkspace(row)
    }

    public func updateWorkspaceSettings(
        workspaceId: String,
        name: String,
        defaultFolderPath: String?,
        workspaceType: String,
        settings: JSONRecord
    ) throws -> Workspace {
        _ = try getWorkspace(workspaceId)
        let name = try requireNonEmptyString(name, field: "Workspace name", maxLength: 160)
        let folder = try optionalTrimmedString(defaultFolderPath, field: "Workspace folder", maxLength: 2000)
        let workspaceType = try normalizedWorkspaceType(workspaceType)
        try database.run(
            """
            UPDATE workspaces
            SET name = ?, default_folder_path = ?, workspace_type = ?, settings_json = ?, updated_at = ?
            WHERE id = ?
            """,
            [
                .text(name),
                folder.sqliteText,
                .text(workspaceType),
                .text(encodeJSONRecord(redactRecord(settings))),
                .text(nowIso()),
                .text(workspaceId)
            ]
        )
        let updated = try getWorkspace(workspaceId)
        if let state = try? getAppState() {
            eventBus.emit(.appStateChanged, state)
        }
        return updated
    }

    public func getSelectedWorkspaceId() throws -> String? {
        let value: String = try getAppSetting("workspace.selectedId", fallback: "")
        return value.nilIfBlank
    }

    public func setSelectedWorkspaceId(_ workspaceId: String) throws {
        _ = try getWorkspace(workspaceId)
        try setAppSetting("workspace.selectedId", value: workspaceId)
        if let state = try? getAppState() {
            eventBus.emit(.appStateChanged, state)
        }
    }

    public func getSelectedSettingsPanel() throws -> String {
        try getAppSetting("settings.selectedPanel", fallback: "account")
    }

    public func setSelectedSettingsPanel(_ panel: String) throws {
        let normalized = try normalizedSettingsPanel(panel)
        try setAppSetting("settings.selectedPanel", value: normalized)
    }

    @discardableResult
    public func saveSettingsAlert(_ alert: SettingsAlertRecord) throws -> SettingsAlertRecord {
        let sanitized = sanitizeSettingsAlertRecord(alert)
        let alertJSON = encodeJSONString(sanitized) ?? "{}"
        try database.run(
            """
            INSERT INTO settings_alerts (
              id, workspace_id, title, message, severity, category, source_kind,
              source_id, action_label, action_target, expires_at, read_at,
              metadata_json, alert_json, created_at, updated_at, redaction_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              workspace_id = excluded.workspace_id,
              title = excluded.title,
              message = excluded.message,
              severity = excluded.severity,
              category = excluded.category,
              source_kind = excluded.source_kind,
              source_id = excluded.source_id,
              action_label = excluded.action_label,
              action_target = excluded.action_target,
              expires_at = excluded.expires_at,
              read_at = excluded.read_at,
              metadata_json = excluded.metadata_json,
              alert_json = excluded.alert_json,
              updated_at = excluded.updated_at,
              redaction_status = excluded.redaction_status
            """,
            [
                .text(sanitized.id),
                .text(sanitized.workspaceId),
                .text(sanitized.title),
                .text(sanitized.message),
                .text(sanitized.severity.rawValue),
                .text(sanitized.category),
                .text(sanitized.sourceKind),
                sanitized.sourceId.sqliteText,
                sanitized.actionLabel.sqliteText,
                sanitized.actionTarget.sqliteText,
                sanitized.expiresAt.sqliteText,
                sanitized.readAt.sqliteText,
                .text(encodeJSONRecord(sanitized.metadata)),
                .text(alertJSON),
                .text(sanitized.createdAt),
                .text(sanitized.updatedAt),
                .text(sanitized.redactionStatus)
            ]
        )
        eventBus.emit(.settingsAlertUpdated, sanitized)
        return sanitized
    }

    public func listSettingsAlerts(
        workspaceId: RelayId,
        unreadOnly: Bool = false,
        includeExpired: Bool = false,
        now: IsoTimestamp = nowIso()
    ) throws -> [SettingsAlertRecord] {
        var whereClauses = ["workspace_id = ?"]
        var params: [SQLiteValue] = [.text(workspaceId)]
        if unreadOnly {
            whereClauses.append("read_at IS NULL")
        }
        if !includeExpired {
            whereClauses.append("(expires_at IS NULL OR expires_at > ?)")
            params.append(.text(now))
        }
        let rows = try database.all(
            """
            SELECT * FROM settings_alerts
            WHERE \(whereClauses.joined(separator: " AND "))
            ORDER BY created_at DESC
            """,
            params
        )
        return try rows.map(mapSettingsAlert)
    }

    public func unreadSettingsAlertCount(
        workspaceId: RelayId,
        now: IsoTimestamp = nowIso()
    ) throws -> Int {
        try Int(database.get(
            """
            SELECT COUNT(*) AS count FROM settings_alerts
            WHERE workspace_id = ?
              AND read_at IS NULL
              AND (expires_at IS NULL OR expires_at > ?)
            """,
            [.text(workspaceId), .text(now)]
        )?["count"]?.int ?? 0)
    }

    @discardableResult
    public func markSettingsAlertRead(
        workspaceId: RelayId,
        alertId: RelayId,
        readAt: IsoTimestamp = nowIso()
    ) throws -> SettingsAlertRecord {
        guard var alert = try database.get(
            "SELECT * FROM settings_alerts WHERE workspace_id = ? AND id = ? LIMIT 1",
            [.text(workspaceId), .text(alertId)]
        ).map(mapSettingsAlert) else {
            throw RelayError(.notFound, "Settings alert was not found.")
        }
        alert.readAt = readAt
        alert.updatedAt = readAt
        return try saveSettingsAlert(alert)
    }

    public func markAllSettingsAlertsRead(
        workspaceId: RelayId,
        readAt: IsoTimestamp = nowIso()
    ) throws -> [SettingsAlertRecord] {
        let unread = try listSettingsAlerts(workspaceId: workspaceId, unreadOnly: true, includeExpired: true, now: readAt)
        return try unread.map { alert in
            var updated = alert
            updated.readAt = readAt
            updated.updatedAt = readAt
            return try saveSettingsAlert(updated)
        }
    }

    public func getSettingsNotificationPreferences(
        workspaceId: RelayId,
        profileId: RelayId?
    ) throws -> SettingsNotificationPreferences? {
        try database.get(
            """
            SELECT * FROM settings_notification_preferences
            WHERE workspace_id = ? AND COALESCE(profile_id, '') = ?
            LIMIT 1
            """,
            [.text(workspaceId), .text(profileId ?? "")]
        ).map(mapSettingsNotificationPreferences)
    }

    @discardableResult
    public func saveSettingsNotificationPreferences(
        _ preferences: SettingsNotificationPreferences
    ) throws -> SettingsNotificationPreferences {
        let sanitized = sanitizeSettingsNotificationPreferences(preferences)
        let preferencesJSON = encodeJSONString(sanitized) ?? "{}"
        if let existing = try getSettingsNotificationPreferences(
            workspaceId: sanitized.workspaceId,
            profileId: sanitized.profileId
        ) {
            try database.run(
                """
                UPDATE settings_notification_preferences
                SET in_app_alerts_enabled = ?,
                    unread_badge_enabled = ?,
                    email_delivery_state = ?,
                    mobile_delivery_state = ?,
                    metadata_json = ?,
                    preferences_json = ?,
                    updated_at = ?,
                    redaction_status = ?
                WHERE id = ?
                """,
                [
                    .integer(sanitized.inAppAlertsEnabled ? 1 : 0),
                    .integer(sanitized.unreadBadgeEnabled ? 1 : 0),
                    .text(sanitized.emailDeliveryState.rawValue),
                    .text(sanitized.mobileDeliveryState.rawValue),
                    .text(encodeJSONRecord(sanitized.metadata)),
                    .text(preferencesJSON),
                    .text(sanitized.updatedAt),
                    .text(sanitized.redactionStatus),
                    .text(existing.id)
                ]
            )
            let updated = try getSettingsNotificationPreferences(
                workspaceId: sanitized.workspaceId,
                profileId: sanitized.profileId
            ) ?? sanitized
            eventBus.emit(.settingsNotificationPreferencesUpdated, updated)
            return updated
        }
        try database.run(
            """
            INSERT INTO settings_notification_preferences (
              id, workspace_id, profile_id, in_app_alerts_enabled,
              unread_badge_enabled, email_delivery_state, mobile_delivery_state,
              metadata_json, preferences_json, created_at, updated_at, redaction_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                .text(sanitized.id),
                .text(sanitized.workspaceId),
                sanitized.profileId.sqliteText,
                .integer(sanitized.inAppAlertsEnabled ? 1 : 0),
                .integer(sanitized.unreadBadgeEnabled ? 1 : 0),
                .text(sanitized.emailDeliveryState.rawValue),
                .text(sanitized.mobileDeliveryState.rawValue),
                .text(encodeJSONRecord(sanitized.metadata)),
                .text(preferencesJSON),
                .text(sanitized.createdAt),
                .text(sanitized.updatedAt),
                .text(sanitized.redactionStatus)
            ]
        )
        eventBus.emit(.settingsNotificationPreferencesUpdated, sanitized)
        return sanitized
    }

    @discardableResult
    public func ensureSettingsNotificationPreferences(
        workspaceId: RelayId,
        profileId: RelayId?
    ) throws -> SettingsNotificationPreferences {
        if let existing = try getSettingsNotificationPreferences(workspaceId: workspaceId, profileId: profileId) {
            return existing
        }
        let timestamp = nowIso()
        return try saveSettingsNotificationPreferences(
            SettingsNotificationPreferences(
                id: createRelayId("snprefs"),
                workspaceId: workspaceId,
                profileId: profileId,
                inAppAlertsEnabled: true,
                unreadBadgeEnabled: true,
                emailDeliveryState: .unavailable,
                mobileDeliveryState: .unavailable,
                metadata: ["deliveryScope": .string("in_app_only")],
                createdAt: timestamp,
                updatedAt: timestamp,
                redactionStatus: "private-state-excluded"
            )
        )
    }

    public func listSettingsDecisionGateDispositions(
        workspaceId: RelayId
    ) throws -> [SettingsDecisionGateDisposition] {
        try database.all(
            """
            SELECT * FROM settings_decision_gate_dispositions
            WHERE workspace_id = ?
            ORDER BY decision_id ASC, surface ASC
            """,
            [.text(workspaceId)]
        ).map(mapSettingsDecisionGateDisposition)
    }

    public func getSettingsDecisionGateDisposition(
        workspaceId: RelayId,
        decisionId: String,
        surface: String
    ) throws -> SettingsDecisionGateDisposition? {
        try database.get(
            """
            SELECT * FROM settings_decision_gate_dispositions
            WHERE workspace_id = ? AND decision_id = ? AND surface = ?
            LIMIT 1
            """,
            [.text(workspaceId), .text(decisionId), .text(surface)]
        ).map(mapSettingsDecisionGateDisposition)
    }

    @discardableResult
    public func saveSettingsDecisionGateDisposition(
        _ disposition: SettingsDecisionGateDisposition
    ) throws -> SettingsDecisionGateDisposition {
        let sanitized = sanitizeSettingsDecisionGateDisposition(disposition)
        let dispositionJSON = encodeJSONString(sanitized) ?? "{}"
        if let existing = try getSettingsDecisionGateDisposition(
            workspaceId: sanitized.workspaceId,
            decisionId: sanitized.decisionId,
            surface: sanitized.surface
        ) {
            try database.run(
                """
                UPDATE settings_decision_gate_dispositions
                SET disposition_state = ?,
                    reason_code = ?,
                    current_ui_state = ?,
                    missing_prerequisites = ?,
                    activation_requirement = ?,
                    release_impact = ?,
                    metadata_json = ?,
                    disposition_json = ?,
                    updated_at = ?,
                    redaction_status = ?
                WHERE id = ?
                """,
                [
                    .text(sanitized.state.rawValue),
                    .text(sanitized.reasonCode.rawValue),
                    .text(sanitized.currentUiState),
                    .text(sanitized.missingPrerequisites),
                    .text(sanitized.activationRequirement),
                    .text(sanitized.releaseImpact),
                    .text(encodeJSONRecord(sanitized.metadata)),
                    .text(dispositionJSON),
                    .text(sanitized.updatedAt),
                    .text(sanitized.redactionStatus),
                    .text(existing.id)
                ]
            )
            return try getSettingsDecisionGateDisposition(
                workspaceId: sanitized.workspaceId,
                decisionId: sanitized.decisionId,
                surface: sanitized.surface
            ) ?? sanitized
        }
        try database.run(
            """
            INSERT INTO settings_decision_gate_dispositions (
              id, workspace_id, decision_id, surface, disposition_state,
              reason_code, current_ui_state, missing_prerequisites,
              activation_requirement, release_impact, metadata_json,
              disposition_json, created_at, updated_at, redaction_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                .text(sanitized.id),
                .text(sanitized.workspaceId),
                .text(sanitized.decisionId),
                .text(sanitized.surface),
                .text(sanitized.state.rawValue),
                .text(sanitized.reasonCode.rawValue),
                .text(sanitized.currentUiState),
                .text(sanitized.missingPrerequisites),
                .text(sanitized.activationRequirement),
                .text(sanitized.releaseImpact),
                .text(encodeJSONRecord(sanitized.metadata)),
                .text(dispositionJSON),
                .text(sanitized.createdAt),
                .text(sanitized.updatedAt),
                .text(sanitized.redactionStatus)
            ]
        )
        return sanitized
    }

    @discardableResult
    public func saveSettingsLocalAccountExport(
        _ export: SettingsLocalAccountExportRecord
    ) throws -> SettingsLocalAccountExportRecord {
        let sanitized = sanitizeSettingsLocalAccountExport(export)
        let exportJSON = encodeJSONString(sanitized) ?? "{}"
        try database.run(
            """
            INSERT INTO settings_local_account_exports (
              id, workspace_id, profile_id, export_status, file_name,
              record_count, includes_secrets, export_metadata_json,
              export_json, created_at, updated_at, redaction_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              workspace_id = excluded.workspace_id,
              profile_id = excluded.profile_id,
              export_status = excluded.export_status,
              file_name = excluded.file_name,
              record_count = excluded.record_count,
              includes_secrets = excluded.includes_secrets,
              export_metadata_json = excluded.export_metadata_json,
              export_json = excluded.export_json,
              updated_at = excluded.updated_at,
              redaction_status = excluded.redaction_status
            """,
            [
                .text(sanitized.id),
                .text(sanitized.workspaceId),
                sanitized.profileId.sqliteText,
                .text(sanitized.status),
                .text(sanitized.fileName),
                .integer(Int64(sanitized.recordCount)),
                .integer(sanitized.includesSecrets ? 1 : 0),
                .text(encodeJSONRecord(sanitized.exportMetadata)),
                .text(exportJSON),
                .text(sanitized.createdAt),
                .text(sanitized.updatedAt),
                .text(sanitized.redactionStatus)
            ]
        )
        eventBus.emit(.settingsLocalExportPrepared, sanitized)
        return sanitized
    }

    public func latestSettingsLocalAccountExport(
        workspaceId: RelayId,
        profileId: RelayId?
    ) throws -> SettingsLocalAccountExportRecord? {
        try database.get(
            """
            SELECT * FROM settings_local_account_exports
            WHERE workspace_id = ? AND COALESCE(profile_id, '') = ?
            ORDER BY created_at DESC
            LIMIT 1
            """,
            [.text(workspaceId), .text(profileId ?? "")]
        ).map(mapSettingsLocalAccountExport)
    }

    public func listHarnesses() throws -> [Harness] {
        try database.all("SELECT * FROM harnesses ORDER BY built_in DESC, display_name ASC").map(mapHarness)
    }

    public func getHarnessByRuntimeType(_ runtimeType: RuntimeType) throws -> Harness? {
        guard let row = try database.get(
            """
            SELECT * FROM harnesses
            WHERE runtime_type = ?
              AND status = 'active'
              AND COALESCE(json_extract(config_json, '$.executionAuthority'), '') != 'railway'
              AND COALESCE(json_extract(config_json, '$.kind'), '') != 'cloud_runtime_proxy'
            ORDER BY updated_at DESC
            LIMIT 1
            """,
            [.text(runtimeType.rawValue)]
        ) else {
            return nil
        }
        return try mapHarness(row)
    }

    public func getHarness(_ harnessId: String) throws -> Harness {
        guard let row = try database.get("SELECT * FROM harnesses WHERE id = ?", [.text(harnessId)]) else {
            throw RelayError(.harnessMissing, "Harness was not found.")
        }
        return try mapHarness(row)
    }

    public func upsertHarness(
        runtimeType: RuntimeType,
        displayName: String,
        mode: HarnessMode,
        config: JSONRecord,
        secretReferenceId: String? = nil,
        status: String = "active",
        builtIn: Bool = false
    ) throws -> Harness {
        let name = try requireNonEmptyString(displayName, field: "Harness name", maxLength: 120)
        let timestamp = nowIso()
        let redacted = redactHarnessConfigForStorage(config)
        if let current = try getHarnessByRuntimeType(runtimeType) {
            try database.run(
                """
                UPDATE harnesses
                SET display_name = ?, mode = ?, config_json = ?, secret_reference_id = ?, status = ?, built_in = ?, updated_at = ?
                WHERE id = ?
                """,
                [
                    .text(name),
                    .text(mode.rawValue),
                    .text(encodeJSONRecord(redacted)),
                    (secretReferenceId ?? current.secretReferenceId).sqliteText,
                    .text(status),
                    .integer(builtIn ? 1 : 0),
                    .text(timestamp),
                    .text(current.id)
                ]
            )
            let updated = try getHarness(current.id)
            if let state = try? getAppState() {
                eventBus.emit(.appStateChanged, state)
            }
            return updated
        }

        let id = createRelayId("hrn")
        try database.run(
            """
            INSERT INTO harnesses (id, runtime_type, display_name, mode, config_json, secret_reference_id, status, built_in, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                .text(id),
                .text(runtimeType.rawValue),
                .text(name),
                .text(mode.rawValue),
                .text(encodeJSONRecord(redacted)),
                secretReferenceId.sqliteText,
                .text(status),
                .integer(builtIn ? 1 : 0),
                .text(timestamp),
                .text(timestamp)
            ]
        )
        let created = try getHarness(id)
        if let state = try? getAppState() {
            eventBus.emit(.appStateChanged, state)
        }
        return created
    }

    public func listAgents(workspaceId: String) throws -> [AgentWithBinding] {
        _ = try getWorkspace(workspaceId)
        return try database
            .all("SELECT * FROM agents WHERE workspace_id = ? ORDER BY updated_at DESC", [.text(workspaceId)])
            .compactMap { row in try getAgent(row.requireText("id")) }
    }

    public func getAgent(_ agentId: String) throws -> AgentWithBinding {
        guard let agentRow = try database.get("SELECT * FROM agents WHERE id = ?", [.text(agentId)]) else {
            throw RelayError(.notFound, "Agent was not found.")
        }
        guard let bindingRow = try database.get("SELECT * FROM runtime_bindings WHERE agent_id = ?", [.text(agentId)]) else {
            throw RelayError(.notFound, "Agent runtime binding was not found.")
        }
        let agent = try mapAgent(agentRow)
        let binding = try mapRuntimeBinding(bindingRow)
        return AgentWithBinding(
            id: agent.id,
            workspaceId: agent.workspaceId,
            name: agent.name,
            description: agent.description,
            status: agent.status,
            role: agent.role,
            source: agent.source,
            externalId: agent.externalId,
            lifecycleStatus: agent.lifecycleStatus,
            lifecycleReason: agent.lifecycleReason,
            retiredAt: agent.retiredAt,
            groupType: agent.groupType,
            familyLabel: agent.familyLabel,
            companyId: agent.companyId,
            departmentId: agent.departmentId,
            teamId: agent.teamId,
            managerAgentId: agent.managerAgentId,
            classification: agent.classification,
            model: agent.model,
            responsePresentation: agent.responsePresentation,
            provisioningStatus: agent.provisioningStatus,
            currentTaskId: agent.currentTaskId,
            metrics: agent.metrics,
            budget: agent.budget,
            createdAt: agent.createdAt,
            updatedAt: agent.updatedAt,
            binding: binding,
            harness: try getHarness(binding.harnessId)
        )
    }

    public func getAgentForHarness(workspaceId: String, harnessId: String) throws -> AgentWithBinding? {
        _ = try getWorkspace(workspaceId)
        _ = try getHarness(harnessId)
        guard let row = try database.get(
            """
            SELECT a.id
            FROM agents a
            JOIN runtime_bindings rb ON rb.agent_id = a.id
            WHERE a.workspace_id = ? AND rb.harness_id = ?
            ORDER BY CASE WHEN a.status = 'active' THEN 0 ELSE 1 END, a.updated_at DESC, a.created_at DESC
            LIMIT 1
            """,
            [.text(workspaceId), .text(harnessId)]
        ) else {
            return nil
        }
        return try getAgent(row.requireText("id"))
    }

    public func listAgentOrgCompanies(workspaceId: String, includeDeleted: Bool = false) throws -> [AgentOrgCompany] {
        _ = try getWorkspace(workspaceId)
        let statusFilter = includeDeleted ? "" : " AND status != 'deleted'"
        return try database
            .all("SELECT * FROM companies WHERE workspace_id = ?\(statusFilter) ORDER BY updated_at DESC", [.text(workspaceId)])
            .map(mapAgentOrgCompany)
    }

    public func getAgentOrgCompany(_ companyId: String) throws -> AgentOrgCompany {
        guard let row = try database.get("SELECT * FROM companies WHERE id = ?", [.text(companyId)]) else {
            throw RelayError(.notFound, "Organization was not found.")
        }
        return try mapAgentOrgCompany(row)
    }

    @discardableResult
    public func createAgentOrgCompany(
        workspaceId: String,
        name: String,
        industry: String? = nil,
        metadata: JSONRecord = [:]
    ) throws -> AgentOrgCompany {
        _ = try getWorkspace(workspaceId)
        let name = try requireNonEmptyString(name, field: "Organization name", maxLength: 160)
        let industry = try optionalTrimmedString(industry, field: "Industry", maxLength: 160)
        let timestamp = nowIso()
        let id = createRelayId("cmp")
        try database.run(
            """
            INSERT INTO companies (id, workspace_id, name, industry, status, metadata_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'active', ?, ?, ?)
            """,
            [
                .text(id),
                .text(workspaceId),
                .text(name),
                industry.sqliteText,
                .text(encodeJSONRecord(redactRecord(metadata))),
                .text(timestamp),
                .text(timestamp)
            ]
        )
        let company = try getAgentOrgCompany(id)
        eventBus.emit(.agentOrganizationUpdated, company)
        _ = try log(severity: "info", category: "agents.org", message: "Organization created.", detail: [
            "companyId": .string(company.id),
            "workspaceId": .string(workspaceId)
        ])
        return company
    }

    public func listAgentOrgDepartments(workspaceId: String, includeDeleted: Bool = false) throws -> [AgentOrgDepartment] {
        _ = try getWorkspace(workspaceId)
        let statusFilter = includeDeleted ? "" : " AND status != 'deleted'"
        return try database
            .all("SELECT * FROM departments WHERE workspace_id = ?\(statusFilter) ORDER BY updated_at DESC", [.text(workspaceId)])
            .map(mapAgentOrgDepartment)
    }

    public func getAgentOrgDepartment(_ departmentId: String) throws -> AgentOrgDepartment {
        guard let row = try database.get("SELECT * FROM departments WHERE id = ?", [.text(departmentId)]) else {
            throw RelayError(.notFound, "Department was not found.")
        }
        return try mapAgentOrgDepartment(row)
    }

    @discardableResult
    public func createAgentOrgDepartment(
        workspaceId: String,
        companyId: String?,
        name: String,
        colorHex: String? = nil,
        headAgentId: String? = nil,
        agentOpsRoomId: String? = nil,
        metadata: JSONRecord = [:]
    ) throws -> AgentOrgDepartment {
        _ = try getWorkspace(workspaceId)
        if let companyId {
            let company = try getAgentOrgCompany(companyId)
            guard company.workspaceId == workspaceId else {
                throw RelayError(.invalidInput, "Organization does not belong to this workspace.")
            }
        }
        if let headAgentId {
            let agent = try getAgent(headAgentId)
            guard agent.workspaceId == workspaceId else {
                throw RelayError(.invalidInput, "Department manager does not belong to this workspace.")
            }
        }
        let name = try requireNonEmptyString(name, field: "Department name", maxLength: 160)
        let colorHex = try optionalTrimmedString(colorHex, field: "Department color", maxLength: 20)
        let agentOpsRoomId = try optionalTrimmedString(agentOpsRoomId, field: "AgentOps room", maxLength: 160)
        let timestamp = nowIso()
        let id = createRelayId("dep")
        try database.run(
            """
            INSERT INTO departments (
              id, workspace_id, company_id, name, color_hex, head_agent_id,
              agentops_room_id, status, metadata_json, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
            """,
            [
                .text(id),
                .text(workspaceId),
                companyId.sqliteText,
                .text(name),
                colorHex.sqliteText,
                headAgentId.sqliteText,
                agentOpsRoomId.sqliteText,
                .text(encodeJSONRecord(redactRecord(metadata))),
                .text(timestamp),
                .text(timestamp)
            ]
        )
        let department = try getAgentOrgDepartment(id)
        eventBus.emit(.agentOrganizationUpdated, department)
        _ = try log(severity: "info", category: "agents.org", message: "Department created.", detail: [
            "departmentId": .string(department.id),
            "companyId": department.companyId.map(JSONValue.string) ?? .null
        ])
        return department
    }

    @discardableResult
    public func setAgentOrgDepartmentHead(
        departmentId: String,
        headAgentId: String?,
        metadata: JSONRecord = [:]
    ) throws -> AgentOrgDepartment {
        let current = try getAgentOrgDepartment(departmentId)
        if let headAgentId {
            let agent = try getAgent(headAgentId)
            guard agent.workspaceId == current.workspaceId else {
                throw RelayError(.invalidInput, "Department manager does not belong to this workspace.")
            }
        }
        let mergedMetadata = current.metadata.merging(redactRecord(metadata)) { _, new in new }
        try database.run(
            """
            UPDATE departments
            SET head_agent_id = ?, metadata_json = ?, updated_at = ?
            WHERE id = ?
            """,
            [
                headAgentId.sqliteText,
                .text(encodeJSONRecord(mergedMetadata)),
                .text(nowIso()),
                .text(departmentId)
            ]
        )
        let department = try getAgentOrgDepartment(departmentId)
        eventBus.emit(.agentOrganizationUpdated, department)
        _ = try log(severity: "info", category: "agents.org", message: "Department manager updated.", detail: [
            "departmentId": .string(department.id),
            "headAgentId": department.headAgentId.map(JSONValue.string) ?? .null
        ])
        return department
    }

    @discardableResult
    public func setAgentOrgDepartmentAgentOpsRoom(
        departmentId: String,
        agentOpsRoomId: String?,
        metadata: JSONRecord = [:]
    ) throws -> AgentOrgDepartment {
        let current = try getAgentOrgDepartment(departmentId)
        let agentOpsRoomId = try optionalTrimmedString(agentOpsRoomId, field: "AgentOps room", maxLength: 160)
        let mergedMetadata = current.metadata.merging(redactRecord(metadata)) { _, new in new }
        try database.run(
            """
            UPDATE departments
            SET agentops_room_id = ?, metadata_json = ?, updated_at = ?
            WHERE id = ?
            """,
            [
                agentOpsRoomId.sqliteText,
                .text(encodeJSONRecord(mergedMetadata)),
                .text(nowIso()),
                .text(departmentId)
            ]
        )
        let department = try getAgentOrgDepartment(departmentId)
        eventBus.emit(.agentOrganizationUpdated, department)
        _ = try log(severity: "info", category: "agents.org", message: "Department AgentOps room updated.", detail: [
            "departmentId": .string(department.id),
            "agentOpsRoomId": department.agentOpsRoomId.map(JSONValue.string) ?? .null
        ])
        return department
    }

    public func listAgentOrgTeams(workspaceId: String, includeDeleted: Bool = false) throws -> [AgentOrgTeam] {
        _ = try getWorkspace(workspaceId)
        let statusFilter = includeDeleted ? "" : " AND status != 'deleted'"
        return try database
            .all("SELECT * FROM teams WHERE workspace_id = ?\(statusFilter) ORDER BY updated_at DESC", [.text(workspaceId)])
            .map(mapAgentOrgTeam)
    }

    public func getAgentOrgTeam(_ teamId: String) throws -> AgentOrgTeam {
        guard let row = try database.get("SELECT * FROM teams WHERE id = ?", [.text(teamId)]) else {
            throw RelayError(.notFound, "Team was not found.")
        }
        return try mapAgentOrgTeam(row)
    }

    @discardableResult
    public func createAgentOrgTeam(
        workspaceId: String,
        departmentId: String?,
        name: String,
        leadAgentId: String? = nil,
        agentOpsRoomId: String? = nil,
        metadata: JSONRecord = [:]
    ) throws -> AgentOrgTeam {
        _ = try getWorkspace(workspaceId)
        if let departmentId {
            let department = try getAgentOrgDepartment(departmentId)
            guard department.workspaceId == workspaceId else {
                throw RelayError(.invalidInput, "Department does not belong to this workspace.")
            }
        }
        if let leadAgentId {
            let agent = try getAgent(leadAgentId)
            guard agent.workspaceId == workspaceId else {
                throw RelayError(.invalidInput, "Team lead does not belong to this workspace.")
            }
        }
        let name = try requireNonEmptyString(name, field: "Team name", maxLength: 160)
        let agentOpsRoomId = try optionalTrimmedString(agentOpsRoomId, field: "AgentOps room", maxLength: 160)
        let timestamp = nowIso()
        let id = createRelayId("team")
        try database.run(
            """
            INSERT INTO teams (
              id, workspace_id, department_id, name, lead_agent_id,
              agentops_room_id, status, metadata_json, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
            """,
            [
                .text(id),
                .text(workspaceId),
                departmentId.sqliteText,
                .text(name),
                leadAgentId.sqliteText,
                agentOpsRoomId.sqliteText,
                .text(encodeJSONRecord(redactRecord(metadata))),
                .text(timestamp),
                .text(timestamp)
            ]
        )
        let team = try getAgentOrgTeam(id)
        eventBus.emit(.agentOrganizationUpdated, team)
        _ = try log(severity: "info", category: "agents.org", message: "Team created.", detail: [
            "teamId": .string(team.id),
            "departmentId": team.departmentId.map(JSONValue.string) ?? .null
        ])
        return team
    }

    @discardableResult
    public func setAgentOrgTeamLead(
        teamId: String,
        leadAgentId: String?,
        metadata: JSONRecord = [:]
    ) throws -> AgentOrgTeam {
        let current = try getAgentOrgTeam(teamId)
        if let leadAgentId {
            let agent = try getAgent(leadAgentId)
            guard agent.workspaceId == current.workspaceId else {
                throw RelayError(.invalidInput, "Team lead does not belong to this workspace.")
            }
        }
        let mergedMetadata = current.metadata.merging(redactRecord(metadata)) { _, new in new }
        try database.run(
            """
            UPDATE teams
            SET lead_agent_id = ?, metadata_json = ?, updated_at = ?
            WHERE id = ?
            """,
            [
                leadAgentId.sqliteText,
                .text(encodeJSONRecord(mergedMetadata)),
                .text(nowIso()),
                .text(teamId)
            ]
        )
        let team = try getAgentOrgTeam(teamId)
        eventBus.emit(.agentOrganizationUpdated, team)
        _ = try log(severity: "info", category: "agents.org", message: "Team lead updated.", detail: [
            "teamId": .string(team.id),
            "leadAgentId": team.leadAgentId.map(JSONValue.string) ?? .null
        ])
        return team
    }

    @discardableResult
    public func setAgentOrgTeamAgentOpsRoom(
        teamId: String,
        agentOpsRoomId: String?,
        metadata: JSONRecord = [:]
    ) throws -> AgentOrgTeam {
        let current = try getAgentOrgTeam(teamId)
        let agentOpsRoomId = try optionalTrimmedString(agentOpsRoomId, field: "AgentOps room", maxLength: 160)
        let mergedMetadata = current.metadata.merging(redactRecord(metadata)) { _, new in new }
        try database.run(
            """
            UPDATE teams
            SET agentops_room_id = ?, metadata_json = ?, updated_at = ?
            WHERE id = ?
            """,
            [
                agentOpsRoomId.sqliteText,
                .text(encodeJSONRecord(mergedMetadata)),
                .text(nowIso()),
                .text(teamId)
            ]
        )
        let team = try getAgentOrgTeam(teamId)
        eventBus.emit(.agentOrganizationUpdated, team)
        _ = try log(severity: "info", category: "agents.org", message: "Team AgentOps room updated.", detail: [
            "teamId": .string(team.id),
            "agentOpsRoomId": team.agentOpsRoomId.map(JSONValue.string) ?? .null
        ])
        return team
    }

    @discardableResult
    public func updateAgentOrgPlacement(
        agentId: String,
        groupType: AgentGroupType,
        familyLabel: String?,
        companyId: String?,
        departmentId: String?,
        teamId: String?,
        managerAgentId: String?,
        classification: String?
    ) throws -> AgentWithBinding {
        let current = try getAgent(agentId)
        if let companyId {
            let company = try getAgentOrgCompany(companyId)
            guard company.workspaceId == current.workspaceId else {
                throw RelayError(.invalidInput, "Organization does not belong to this workspace.")
            }
        }
        if let departmentId {
            let department = try getAgentOrgDepartment(departmentId)
            guard department.workspaceId == current.workspaceId else {
                throw RelayError(.invalidInput, "Department does not belong to this workspace.")
            }
        }
        if let teamId {
            let team = try getAgentOrgTeam(teamId)
            guard team.workspaceId == current.workspaceId else {
                throw RelayError(.invalidInput, "Team does not belong to this workspace.")
            }
        }
        if let managerAgentId {
            let manager = try getAgent(managerAgentId)
            guard manager.workspaceId == current.workspaceId else {
                throw RelayError(.invalidInput, "Manager does not belong to this workspace.")
            }
        }
        let familyLabel = try optionalTrimmedString(familyLabel, field: "Family label", maxLength: 160)
        let classification = try optionalTrimmedString(classification, field: "Classification", maxLength: 160)
        try database.run(
            """
            UPDATE agents
            SET group_type = ?, family_label = ?, company_id = ?, department_id = ?,
                team_id = ?, manager_agent_id = ?, classification = ?, updated_at = ?
            WHERE id = ?
            """,
            [
                .text(groupType.rawValue),
                familyLabel.sqliteText,
                companyId.sqliteText,
                departmentId.sqliteText,
                teamId.sqliteText,
                managerAgentId.sqliteText,
                classification.sqliteText,
                .text(nowIso()),
                .text(agentId)
            ]
        )
        let agent = try getAgent(agentId)
        eventBus.emit(.agentOrganizationUpdated, agent)
        _ = try log(severity: "info", category: "agents.org", message: "Agent placement updated.", detail: [
            "agentId": .string(agent.id),
            "groupType": .string(groupType.rawValue),
            "companyId": agent.companyId.map(JSONValue.string) ?? .null,
            "departmentId": agent.departmentId.map(JSONValue.string) ?? .null,
            "teamId": agent.teamId.map(JSONValue.string) ?? .null
        ])
        return agent
    }

    @discardableResult
    public func setAgentManagerRelationship(
        workspaceId: String,
        reportAgentId: String,
        managerAgentId: String?,
        relationshipType: String = "manager",
        metadata: JSONRecord = [:]
    ) throws -> AgentWithBinding {
        _ = try getWorkspace(workspaceId)
        let report = try getAgent(reportAgentId)
        guard report.workspaceId == workspaceId else {
            throw RelayError(.invalidInput, "Report agent does not belong to this workspace.")
        }
        let manager: AgentWithBinding?
        if let managerAgentId {
            guard managerAgentId != reportAgentId else {
                throw RelayError(.invalidInput, "An agent cannot manage itself.")
            }
            let loaded = try getAgent(managerAgentId)
            guard loaded.workspaceId == workspaceId else {
                throw RelayError(.invalidInput, "Manager agent does not belong to this workspace.")
            }
            manager = loaded
        } else {
            manager = nil
        }
        let relationshipType = try requireNonEmptyString(relationshipType, field: "Relationship type", maxLength: 80)
        let timestamp = nowIso()
        try database.transaction {
            try database.run(
                "DELETE FROM agent_manager_relationships WHERE workspace_id = ? AND report_agent_id = ? AND relationship_type = ?",
                [.text(workspaceId), .text(reportAgentId), .text(relationshipType)]
            )
            if let manager {
                try database.run(
                    """
                    INSERT INTO agent_manager_relationships (
                      id, workspace_id, manager_agent_id, report_agent_id,
                      relationship_type, metadata_json, created_at, updated_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    [
                        .text(createRelayId("mgr")),
                        .text(workspaceId),
                        .text(manager.id),
                        .text(reportAgentId),
                        .text(relationshipType),
                        .text(encodeJSONRecord(redactRecord(metadata))),
                        .text(timestamp),
                        .text(timestamp)
                    ]
                )
            }
            try database.run(
                "UPDATE agents SET manager_agent_id = ?, updated_at = ? WHERE id = ?",
                [managerAgentId.sqliteText, .text(timestamp), .text(reportAgentId)]
            )
        }
        let agent = try getAgent(reportAgentId)
        eventBus.emit(.agentOrganizationUpdated, agent)
        _ = try log(severity: "info", category: "agents.org", message: "Agent manager relationship updated.", detail: [
            "reportAgentId": .string(reportAgentId),
            "managerAgentId": managerAgentId.map(JSONValue.string) ?? .null,
            "relationshipType": .string(relationshipType)
        ])
        return agent
    }

    public func listAgentManagerRelationships(workspaceId: String) throws -> [AgentManagerRelationship] {
        _ = try getWorkspace(workspaceId)
        return try database
            .all("SELECT * FROM agent_manager_relationships WHERE workspace_id = ? ORDER BY updated_at DESC", [.text(workspaceId)])
            .map(mapAgentManagerRelationship)
    }

    @discardableResult
    public func createAgentTask(
        workspaceId: String,
        title: String,
        message: String,
        assignedAgentId: String? = nil,
        targetAgentId: String? = nil,
        targetTeamId: String? = nil,
        priority: AgentTaskPriority = .normal,
        targetType: AgentTaskTargetType = .direct,
        status: AgentTaskStatus = .queued,
        requiresApproval: Bool = false,
        scheduledAt: String? = nil,
        timeZone: String? = nil,
        recurrence: String? = nil,
        lastError: String? = nil,
        threadId: String? = nil,
        metadata: JSONRecord = [:]
    ) throws -> AgentTask {
        _ = try getWorkspace(workspaceId)
        if let assignedAgentId {
            try requireAgentInWorkspace(assignedAgentId, workspaceId: workspaceId, field: "Assigned agent")
        }
        if let targetAgentId {
            try requireAgentInWorkspace(targetAgentId, workspaceId: workspaceId, field: "Target agent")
        }
        if let targetTeamId {
            let team = try getAgentOrgTeam(targetTeamId)
            guard team.workspaceId == workspaceId else {
                throw RelayError(.invalidInput, "Target team does not belong to this workspace.")
            }
        }
        if let threadId {
            let thread = try getThread(threadId)
            guard thread.workspaceId == workspaceId else {
                throw RelayError(.invalidInput, "Task thread does not belong to this workspace.")
            }
        }
        switch targetType {
        case .direct:
            guard targetAgentId != nil else {
                throw RelayError(.invalidInput, "Direct task target requires an agent.")
            }
        case .team:
            guard targetTeamId != nil else {
                throw RelayError(.invalidInput, "Team task target requires a team.")
            }
        }
        let title = try requireNonEmptyString(title, field: "Task title", maxLength: 200)
        let message = try requireNonEmptyString(message, field: "Task message", maxLength: 32000)
        let timeZone = try optionalTrimmedString(timeZone, field: "Time zone", maxLength: 120)
        let recurrence = try optionalTrimmedString(recurrence, field: "Recurrence", maxLength: 80)
        let lastError = try optionalTrimmedString(lastError, field: "Last error", maxLength: 1000)
        let id = createRelayId("tsk")
        let timestamp = nowIso()
        try database.run(
            """
            INSERT INTO agent_tasks (
              id, workspace_id, assigned_agent_id, target_agent_id, target_team_id,
              title, message, priority, target_type, status, requires_approval,
              scheduled_at, time_zone, recurrence, last_error, thread_id,
              metadata_json, archived_at, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
            """,
            [
                .text(id),
                .text(workspaceId),
                assignedAgentId.sqliteText,
                targetAgentId.sqliteText,
                targetTeamId.sqliteText,
                .text(title),
                .text(message),
                .text(priority.rawValue),
                .text(targetType.rawValue),
                .text(status.rawValue),
                .integer(requiresApproval ? 1 : 0),
                scheduledAt.sqliteText,
                timeZone.sqliteText,
                recurrence.sqliteText,
                lastError.sqliteText,
                threadId.sqliteText,
                .text(encodeJSONRecord(redactRecord(metadata))),
                .text(timestamp),
                .text(timestamp)
            ]
        )
        let task = try getAgentTask(id)
        eventBus.emit(.agentWorkUpdated, task)
        _ = try log(severity: "info", category: "agents.work", message: "Agent task read model created.", detail: [
            "taskId": .string(task.id),
            "targetType": .string(task.targetType.rawValue),
            "status": .string(task.status.rawValue)
        ])
        return task
    }

    public func getAgentTask(_ taskId: String) throws -> AgentTask {
        guard let row = try database.get("SELECT * FROM agent_tasks WHERE id = ?", [.text(taskId)]) else {
            throw RelayError(.notFound, "Task was not found.")
        }
        return try mapAgentTask(row)
    }

    public func listAgentTasks(
        workspaceId: String,
        agentId: String? = nil,
        teamId: String? = nil,
        includeArchived: Bool = false
    ) throws -> [AgentTask] {
        _ = try getWorkspace(workspaceId)
        var clauses = ["workspace_id = ?"]
        var params: [SQLiteValue] = [.text(workspaceId)]
        if !includeArchived {
            clauses.append("status != 'archived'")
            clauses.append("archived_at IS NULL")
        }
        if let agentId {
            clauses.append("(assigned_agent_id = ? OR target_agent_id = ?)")
            params.append(.text(agentId))
            params.append(.text(agentId))
        }
        if let teamId {
            clauses.append("target_team_id = ?")
            params.append(.text(teamId))
        }
        return try database
            .all("SELECT * FROM agent_tasks WHERE \(clauses.joined(separator: " AND ")) ORDER BY COALESCE(scheduled_at, updated_at) DESC", params)
            .map(mapAgentTask)
    }

    public func claimDueAgentTasks(now: IsoTimestamp, limit: Int = 20) throws -> [AgentTask] {
        let boundedLimit = min(max(limit, 1), 100)
        return try database.transaction {
            let ids = try database.all(
                """
                SELECT id FROM agent_tasks
                WHERE status = 'queued'
                  AND requires_approval = 0
                  AND scheduled_at IS NOT NULL
                  AND scheduled_at <= ?
                ORDER BY scheduled_at ASC
                LIMIT ?
                """,
                [.text(now), .integer(Int64(boundedLimit))]
            ).compactMap { $0["id"]?.string }
            guard !ids.isEmpty else { return [] }
            var claimed: [AgentTask] = []
            for id in ids {
                let changed = try database.run(
                    "UPDATE agent_tasks SET status = 'running', last_error = NULL, updated_at = ? WHERE id = ? AND status = 'queued'",
                    [.text(now), .text(id)]
                )
                if changed == 1 {
                    claimed.append(try getAgentTask(id))
                }
            }
            return claimed
        }
    }

    @discardableResult
    public func updateAgentTaskDelivery(
        taskId: String,
        status: AgentTaskStatus,
        scheduledAt: IsoTimestamp?,
        threadId: RelayId? = nil,
        lastError: String? = nil
    ) throws -> AgentTask {
        let current = try getAgentTask(taskId)
        let timestamp = nowIso()
        let safeError = try optionalTrimmedString(lastError, field: "Task delivery error", maxLength: 1000)
        try database.run(
            """
            UPDATE agent_tasks
            SET status = ?, scheduled_at = ?, thread_id = ?, last_error = ?, updated_at = ?
            WHERE id = ?
            """,
            [
                .text(status.rawValue),
                scheduledAt.sqliteText,
                (threadId ?? current.threadId).sqliteText,
                safeError.sqliteText,
                .text(timestamp),
                .text(taskId)
            ]
        )
        let updated = try getAgentTask(taskId)
        eventBus.emit(.agentWorkUpdated, updated)
        return updated
    }

    @discardableResult
    public func createAgentTaskRun(
        workspaceId: String,
        taskId: String,
        agentId: String? = nil,
        dispatchId: String? = nil,
        status: AgentTaskStatus = .queued,
        tokensUsed: Int = 0,
        startedAt: String? = nil,
        completedAt: String? = nil,
        error: JSONRecord? = nil,
        metadata: JSONRecord = [:]
    ) throws -> AgentTaskRun {
        _ = try getWorkspace(workspaceId)
        let task = try getAgentTask(taskId)
        guard task.workspaceId == workspaceId else {
            throw RelayError(.invalidInput, "Task run does not belong to this workspace.")
        }
        if let agentId {
            try requireAgentInWorkspace(agentId, workspaceId: workspaceId, field: "Task run agent")
        }
        if let dispatchId {
            let dispatch = try getDispatch(dispatchId)
            guard dispatch.threadId == task.threadId || task.threadId == nil else {
                throw RelayError(.invalidInput, "Task run dispatch does not match the task thread.")
            }
        }
        let id = createRelayId("run")
        let timestamp = nowIso()
        try database.run(
            """
            INSERT INTO agent_task_runs (
              id, workspace_id, task_id, agent_id, dispatch_id, status, tokens_used,
              started_at, completed_at, error_json, metadata_json, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                .text(id),
                .text(workspaceId),
                .text(taskId),
                agentId.sqliteText,
                dispatchId.sqliteText,
                .text(status.rawValue),
                .integer(Int64(max(tokensUsed, 0))),
                startedAt.sqliteText,
                completedAt.sqliteText,
                error.map { encodeJSONRecord(redactRecord($0)) }.sqliteText,
                .text(encodeJSONRecord(redactRecord(metadata))),
                .text(timestamp),
                .text(timestamp)
            ]
        )
        let run = try getAgentTaskRun(id)
        eventBus.emit(.agentWorkUpdated, run)
        return run
    }

    public func getAgentTaskRun(_ runId: String) throws -> AgentTaskRun {
        guard let row = try database.get("SELECT * FROM agent_task_runs WHERE id = ?", [.text(runId)]) else {
            throw RelayError(.notFound, "Task run was not found.")
        }
        return try mapAgentTaskRun(row)
    }

    public func listAgentTaskRuns(taskId: String) throws -> [AgentTaskRun] {
        _ = try getAgentTask(taskId)
        return try database
            .all("SELECT * FROM agent_task_runs WHERE task_id = ? ORDER BY created_at DESC", [.text(taskId)])
            .map(mapAgentTaskRun)
    }

    public func listAgentTaskRuns(workspaceId: String) throws -> [AgentTaskRun] {
        _ = try getWorkspace(workspaceId)
        return try database
            .all("SELECT * FROM agent_task_runs WHERE workspace_id = ? ORDER BY created_at DESC", [.text(workspaceId)])
            .map(mapAgentTaskRun)
    }

    public func scheduledTaskMessage(taskId: RelayId) throws -> Message? {
        guard let row = try database.get(
            """
            SELECT * FROM messages
            WHERE json_extract(metadata_json, '$.scheduledTaskId') = ?
            ORDER BY created_at DESC
            LIMIT 1
            """,
            [.text(taskId)]
        ) else { return nil }
        return try mapMessage(row)
    }

    @discardableResult
    public func createAgentTeamMemoryEntry(
        workspaceId: String,
        teamId: String,
        title: String,
        memoryType: AgentTeamMemoryType,
        content: String,
        isSensitive: Bool = false,
        createdByAgentId: String? = nil,
        metadata: JSONRecord = [:]
    ) throws -> AgentTeamMemoryEntry {
        _ = try getWorkspace(workspaceId)
        let team = try getAgentOrgTeam(teamId)
        guard team.workspaceId == workspaceId else {
            throw RelayError(.invalidInput, "Team memory does not belong to this workspace.")
        }
        if let createdByAgentId {
            try requireAgentInWorkspace(createdByAgentId, workspaceId: workspaceId, field: "Memory author")
        }
        let title = try requireNonEmptyString(title, field: "Memory title", maxLength: 200)
        let content = try requireNonEmptyString(content, field: "Memory content", maxLength: 10000)
        let id = createRelayId("mem")
        let timestamp = nowIso()
        try database.run(
            """
            INSERT INTO agent_team_memory (
              id, workspace_id, team_id, title, memory_type, content, is_sensitive,
              metadata_json, created_by_agent_id, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                .text(id),
                .text(workspaceId),
                .text(teamId),
                .text(title),
                .text(memoryType.rawValue),
                .text(content),
                .integer(isSensitive ? 1 : 0),
                .text(encodeJSONRecord(redactRecord(metadata))),
                createdByAgentId.sqliteText,
                .text(timestamp),
                .text(timestamp)
            ]
        )
        let entry = try getAgentTeamMemoryEntry(id)
        eventBus.emit(.agentWorkUpdated, entry)
        return entry
    }

    public func getAgentTeamMemoryEntry(_ id: String) throws -> AgentTeamMemoryEntry {
        guard let row = try database.get("SELECT * FROM agent_team_memory WHERE id = ?", [.text(id)]) else {
            throw RelayError(.notFound, "Team memory item was not found.")
        }
        return try mapAgentTeamMemoryEntry(row)
    }

    public func listAgentTeamMemoryEntries(workspaceId: String, teamId: String? = nil) throws -> [AgentTeamMemoryEntry] {
        _ = try getWorkspace(workspaceId)
        var params: [SQLiteValue] = [.text(workspaceId)]
        var whereClause = "workspace_id = ?"
        if let teamId {
            whereClause += " AND team_id = ?"
            params.append(.text(teamId))
        }
        return try database
            .all("SELECT * FROM agent_team_memory WHERE \(whereClause) ORDER BY updated_at DESC", params)
            .map(mapAgentTeamMemoryEntry)
    }

    @discardableResult
    public func createAgentTeamHandover(
        workspaceId: String,
        teamId: String,
        fromAgentId: String?,
        title: String,
        content: String,
        isSensitive: Bool = false,
        metadata: JSONRecord = [:]
    ) throws -> AgentTeamHandover {
        _ = try getWorkspace(workspaceId)
        let team = try getAgentOrgTeam(teamId)
        guard team.workspaceId == workspaceId else {
            throw RelayError(.invalidInput, "Team handover does not belong to this workspace.")
        }
        if let fromAgentId {
            try requireAgentInWorkspace(fromAgentId, workspaceId: workspaceId, field: "Handover agent")
        }
        let title = try requireNonEmptyString(title, field: "Handover title", maxLength: 200)
        let content = try requireNonEmptyString(content, field: "Handover content", maxLength: 10000)
        let id = createRelayId("hnd")
        let timestamp = nowIso()
        try database.run(
            """
            INSERT INTO agent_team_handovers (
              id, workspace_id, team_id, from_agent_id, title, content,
              is_sensitive, metadata_json, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                .text(id),
                .text(workspaceId),
                .text(teamId),
                fromAgentId.sqliteText,
                .text(title),
                .text(content),
                .integer(isSensitive ? 1 : 0),
                .text(encodeJSONRecord(redactRecord(metadata))),
                .text(timestamp),
                .text(timestamp)
            ]
        )
        let handover = try getAgentTeamHandover(id)
        eventBus.emit(.agentWorkUpdated, handover)
        return handover
    }

    public func getAgentTeamHandover(_ id: String) throws -> AgentTeamHandover {
        guard let row = try database.get("SELECT * FROM agent_team_handovers WHERE id = ?", [.text(id)]) else {
            throw RelayError(.notFound, "Team handover was not found.")
        }
        return try mapAgentTeamHandover(row)
    }

    public func listAgentTeamHandovers(workspaceId: String, teamId: String? = nil) throws -> [AgentTeamHandover] {
        _ = try getWorkspace(workspaceId)
        var params: [SQLiteValue] = [.text(workspaceId)]
        var whereClause = "workspace_id = ?"
        if let teamId {
            whereClause += " AND team_id = ?"
            params.append(.text(teamId))
        }
        return try database
            .all("SELECT * FROM agent_team_handovers WHERE \(whereClause) ORDER BY updated_at DESC", params)
            .map(mapAgentTeamHandover)
    }

    @discardableResult
    public func markAgentOrgCompanyDeleted(_ companyId: String) throws -> AgentOrgCompany {
        _ = try getAgentOrgCompany(companyId)
        try database.run(
            "UPDATE companies SET status = 'deleted', updated_at = ? WHERE id = ?",
            [.text(nowIso()), .text(companyId)]
        )
        let company = try getAgentOrgCompany(companyId)
        eventBus.emit(.agentOrganizationUpdated, company)
        _ = try log(severity: "info", category: "agents.org", message: "Organization deleted.", detail: [
            "companyId": .string(company.id)
        ])
        return company
    }

    @discardableResult
    public func cascadeDeleteAgentOrgCompany(_ companyId: String) throws -> AgentOrgCascadeDeleteResult {
        let result = try database.transaction {
            let company = try getAgentOrgCompany(companyId)
            let departments = try listAgentOrgDepartments(workspaceId: company.workspaceId)
                .filter { $0.companyId == company.id }
            let departmentIds = Set(departments.map(\.id))
            let teams = try listAgentOrgTeams(workspaceId: company.workspaceId)
                .filter { team in
                    guard let departmentId = team.departmentId else { return false }
                    return departmentIds.contains(departmentId)
                }
            let teamIds = Set(teams.map(\.id))
            let agents = try listAgents(workspaceId: company.workspaceId)
                .filter { agent in
                    agent.companyId == company.id
                        || agent.departmentId.map(departmentIds.contains) == true
                        || agent.teamId.map(teamIds.contains) == true
                }

            var unassignedAgents: [AgentWithBinding] = []
            for agent in agents {
                let updated = try updateAgentOrgPlacement(
                    agentId: agent.id,
                    groupType: .unassigned,
                    familyLabel: nil,
                    companyId: nil,
                    departmentId: nil,
                    teamId: nil,
                    managerAgentId: nil,
                    classification: agent.classification
                )
                unassignedAgents.append(updated)
            }

            for team in teams {
                _ = try markAgentOrgTeamDeleted(team.id)
            }
            for department in departments {
                _ = try markAgentOrgDepartmentDeleted(department.id)
            }
            let deletedCompany = try markAgentOrgCompanyDeleted(company.id)
            return AgentOrgCascadeDeleteResult(
                company: deletedCompany,
                departments: departments,
                teams: teams,
                unassignedAgents: unassignedAgents
            )
        }

        _ = try log(severity: "warning", category: "agents.org", message: "Organization cascade deleted.", detail: [
            "companyId": .string(result.company.id),
            "departmentCount": .number(Double(result.departments.count)),
            "teamCount": .number(Double(result.teams.count)),
            "unassignedAgentCount": .number(Double(result.unassignedAgents.count))
        ])
        eventBus.emit(.agentOrganizationUpdated, result)
        return result
    }

    @discardableResult
    public func markAgentOrgDepartmentDeleted(_ departmentId: String) throws -> AgentOrgDepartment {
        _ = try getAgentOrgDepartment(departmentId)
        try database.run(
            "UPDATE departments SET status = 'deleted', updated_at = ? WHERE id = ?",
            [.text(nowIso()), .text(departmentId)]
        )
        let department = try getAgentOrgDepartment(departmentId)
        eventBus.emit(.agentOrganizationUpdated, department)
        _ = try log(severity: "info", category: "agents.org", message: "Department deleted.", detail: [
            "departmentId": .string(department.id)
        ])
        return department
    }

    @discardableResult
    public func markAgentOrgTeamDeleted(_ teamId: String) throws -> AgentOrgTeam {
        _ = try getAgentOrgTeam(teamId)
        try database.run(
            "UPDATE teams SET status = 'deleted', updated_at = ? WHERE id = ?",
            [.text(nowIso()), .text(teamId)]
        )
        let team = try getAgentOrgTeam(teamId)
        eventBus.emit(.agentOrganizationUpdated, team)
        _ = try log(severity: "info", category: "agents.org", message: "Team deleted.", detail: [
            "teamId": .string(team.id)
        ])
        return team
    }

    public func listAgentPreferences(workspaceId: String) throws -> [AgentPreferences] {
        _ = try getWorkspace(workspaceId)
        return try database
            .all("SELECT * FROM agent_preferences WHERE workspace_id = ? ORDER BY updated_at DESC", [.text(workspaceId)])
            .map(mapAgentPreferences)
    }

    public func getAgentPreferences(agentId: String) throws -> AgentPreferences {
        let agent = try getAgent(agentId)
        if let row = try database.get("SELECT * FROM agent_preferences WHERE agent_id = ?", [.text(agentId)]) {
            return try mapAgentPreferences(row)
        }
        return defaultAgentPreferences(for: agent)
    }

    public func saveAgentDisplayPreference(agentId: String, displayName: String?) throws -> AgentPreferences {
        let agent = try getAgent(agentId)
        let current = try getAgentPreferences(agentId: agentId)
        let display = try optionalTrimmedString(displayName, field: "Display name", maxLength: 120)
        let cosmeticDisplayName = display == agent.name ? nil : display
        return try upsertAgentPreferences(
            agent: agent,
            current: current,
            cosmeticDisplayName: cosmeticDisplayName,
            avatarReference: current.avatarReference,
            avatarState: current.avatarState,
            responsePresentation: current.responsePresentation,
            metadata: current.metadata
        )
    }

    public func saveAgentAvatarPreference(
        agentId: String,
        avatarReference: String?,
        avatarState: AgentAvatarState
    ) throws -> AgentPreferences {
        let agent = try getAgent(agentId)
        let current = try getAgentPreferences(agentId: agentId)
        let reference = try normalizedAvatarReference(avatarReference, avatarState: avatarState)
        return try upsertAgentPreferences(
            agent: agent,
            current: current,
            cosmeticDisplayName: current.cosmeticDisplayName,
            avatarReference: reference,
            avatarState: avatarState,
            responsePresentation: current.responsePresentation,
            metadata: current.metadata
        )
    }

    public func saveAgentResponsePresentation(
        agentId: String,
        responsePresentation: AgentResponsePresentation
    ) throws -> AgentPreferences {
        let agent = try getAgent(agentId)
        let current = try getAgentPreferences(agentId: agentId)
        return try upsertAgentPreferences(
            agent: agent,
            current: current,
            cosmeticDisplayName: current.cosmeticDisplayName,
            avatarReference: current.avatarReference,
            avatarState: current.avatarState,
            responsePresentation: responsePresentation,
            metadata: current.metadata
        )
    }

    private func upsertAgentPreferences(
        agent: AgentWithBinding,
        current: AgentPreferences,
        cosmeticDisplayName: String?,
        avatarReference: String?,
        avatarState: AgentAvatarState,
        responsePresentation: AgentResponsePresentation,
        metadata: JSONRecord
    ) throws -> AgentPreferences {
        let timestamp = nowIso()
        let row = try database.get("SELECT id FROM agent_preferences WHERE agent_id = ?", [.text(agent.id)])
        if let row {
            try database.run(
                """
                UPDATE agent_preferences
                SET cosmetic_display_name = ?, avatar_reference = ?, avatar_state = ?,
                    response_presentation = ?, metadata_json = ?, updated_at = ?
                WHERE id = ?
                """,
                [
                    cosmeticDisplayName.sqliteText,
                    avatarReference.sqliteText,
                    .text(avatarState.rawValue),
                    .text(responsePresentation.rawValue),
                    .text(encodeJSONRecord(redactRecord(metadata))),
                    .text(timestamp),
                    .text(try row.requireText("id"))
                ]
            )
        } else {
            try database.run(
                """
                INSERT INTO agent_preferences (
                  id, workspace_id, agent_id, cosmetic_display_name, avatar_reference,
                  avatar_state, response_presentation, metadata_json, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    .text(current.id),
                    .text(agent.workspaceId),
                    .text(agent.id),
                    cosmeticDisplayName.sqliteText,
                    avatarReference.sqliteText,
                    .text(avatarState.rawValue),
                    .text(responsePresentation.rawValue),
                    .text(encodeJSONRecord(redactRecord(metadata))),
                    .text(timestamp),
                    .text(timestamp)
                ]
            )
        }
        _ = try log(severity: "info", category: "agents", message: "Agent preferences updated.", detail: [
            "agentId": .string(agent.id),
            "avatarState": .string(avatarState.rawValue),
            "responsePresentation": .string(responsePresentation.rawValue),
            "runtimeIdentityPreserved": .bool(true)
        ])
        return try getAgentPreferences(agentId: agent.id)
    }

    public func listAgentProvisioningJobs(workspaceId: String) throws -> [AgentProvisioningJob] {
        _ = try getWorkspace(workspaceId)
        return try database
            .all("SELECT * FROM agent_provisioning_jobs WHERE workspace_id = ? ORDER BY updated_at DESC", [.text(workspaceId)])
            .map(mapAgentProvisioningJob)
    }

    public func getAgentProvisioningJob(_ jobId: String) throws -> AgentProvisioningJob {
        guard let row = try database.get("SELECT * FROM agent_provisioning_jobs WHERE id = ?", [.text(jobId)]) else {
            throw RelayError(.notFound, "Agent provisioning job was not found.")
        }
        return try mapAgentProvisioningJob(row)
    }

    @discardableResult
    public func createAgentProvisioningJob(
        workspaceId: String,
        requestedByProfileId: String?,
        harnessId: String?,
        runtimeType: RuntimeType,
        externalAgentId: String?,
        payload: JSONRecord = [:],
        filesMetadata: JSONRecord = [:],
        stage: String = "queued",
        message: String = "Provisioning queued."
    ) throws -> AgentProvisioningJob {
        _ = try getWorkspace(workspaceId)
        if let requestedByProfileId {
            _ = try getProfile(requestedByProfileId)
        }
        if let harnessId {
            _ = try getHarness(harnessId)
        }
        let externalAgentId = try optionalTrimmedString(externalAgentId, field: "External agent ID", maxLength: 160)
        let stage = try optionalTrimmedString(stage, field: "Provisioning stage", maxLength: 120)
        let message = try optionalTrimmedString(message, field: "Provisioning message", maxLength: 500)
        let timestamp = nowIso()
        let id = createRelayId("apj")
        try database.run(
            """
            INSERT INTO agent_provisioning_jobs (
              id, workspace_id, requested_by_profile_id, harness_id, runtime_type, status,
              stage, message, error_json, created_agent_id, runtime_binding_id,
              external_agent_id, payload_json, files_metadata_json, created_at,
              updated_at, completed_at
            )
            VALUES (?, ?, ?, ?, ?, 'queued', ?, ?, NULL, NULL, NULL, ?, ?, ?, ?, ?, NULL)
            """,
            [
                .text(id),
                .text(workspaceId),
                requestedByProfileId.sqliteText,
                harnessId.sqliteText,
                .text(runtimeType.rawValue),
                stage.sqliteText,
                message.sqliteText,
                externalAgentId.sqliteText,
                .text(encodeJSONRecord(redactProvisioningRecord(payload))),
                .text(encodeJSONRecord(redactProvisioningRecord(filesMetadata))),
                .text(timestamp),
                .text(timestamp)
            ]
        )
        let job = try getAgentProvisioningJob(id)
        eventBus.emit(.agentProvisioningUpdated, job)
        return job
    }

    @discardableResult
    public func updateAgentProvisioningJob(
        jobId: String,
        status: AgentProvisioningStatus,
        stage: String?,
        message: String?,
        error: JSONRecord? = nil,
        createdAgentId: String? = nil,
        runtimeBindingId: String? = nil,
        externalAgentId: String? = nil,
        payload: JSONRecord? = nil,
        filesMetadata: JSONRecord? = nil,
        completedAt: String? = nil
    ) throws -> AgentProvisioningJob {
        let current = try getAgentProvisioningJob(jobId)
        if let createdAgentId {
            _ = try getAgent(createdAgentId)
        }
        let terminalCompletedAt: String?
        switch status {
        case .completed, .failed, .cancelled, .authRequired, .missingHarness, .duplicateId:
            terminalCompletedAt = completedAt ?? current.completedAt ?? nowIso()
        case .queued, .running:
            terminalCompletedAt = completedAt ?? current.completedAt
        }
        let stage = try optionalTrimmedString(stage, field: "Provisioning stage", maxLength: 120)
        let message = try optionalTrimmedString(message, field: "Provisioning message", maxLength: 500)
        let externalAgentId = externalAgentId == nil ? current.externalAgentId : try optionalTrimmedString(externalAgentId, field: "External agent ID", maxLength: 160)
        try database.run(
            """
            UPDATE agent_provisioning_jobs
            SET status = ?, stage = ?, message = ?, error_json = ?,
                created_agent_id = ?, runtime_binding_id = ?, external_agent_id = ?,
                payload_json = ?, files_metadata_json = ?, updated_at = ?, completed_at = ?
            WHERE id = ?
            """,
            [
                .text(status.rawValue),
                stage.sqliteText,
                message.sqliteText,
                error.map { encodeJSONRecord(redactProvisioningRecord($0)) }.sqliteText,
                (createdAgentId ?? current.createdAgentId).sqliteText,
                (runtimeBindingId ?? current.runtimeBindingId).sqliteText,
                externalAgentId.sqliteText,
                .text(encodeJSONRecord(redactProvisioningRecord(payload ?? current.payload))),
                .text(encodeJSONRecord(redactProvisioningRecord(filesMetadata ?? current.filesMetadata))),
                .text(nowIso()),
                terminalCompletedAt.sqliteText,
                .text(jobId)
            ]
        )
        let job = try getAgentProvisioningJob(jobId)
        eventBus.emit(.agentProvisioningUpdated, job)
        return job
    }

    @discardableResult
    public func setAgentProvisioningStatus(agentId: String, status: AgentProvisioningStatus) throws -> AgentWithBinding {
        _ = try getAgent(agentId)
        try database.run(
            "UPDATE agents SET provisioning_status = ?, updated_at = ? WHERE id = ?",
            [.text(status.rawValue), .text(nowIso()), .text(agentId)]
        )
        return try getAgent(agentId)
    }

    public func runtimeBindingExists(harnessId: String, externalAgentId: String, excludingAgentId: String? = nil) throws -> Bool {
        _ = try getHarness(harnessId)
        let externalAgentId = try requireNonEmptyString(externalAgentId, field: "External agent ID", maxLength: 160)
        var parameters: [SQLiteValue] = [.text(harnessId), .text(externalAgentId)]
        var query = "SELECT id FROM runtime_bindings WHERE harness_id = ? AND external_agent_id = ?"
        if let excludingAgentId {
            query += " AND agent_id != ?"
            parameters.append(.text(excludingAgentId))
        }
        query += " LIMIT 1"
        return try database.get(query, parameters) != nil
    }

    public func ensureAgentForHarness(
        workspaceId: String,
        name: String,
        description: String? = nil,
        harnessId: String,
        externalAgentId: String? = nil,
        hermesProfileSlug: String? = nil,
        hermesHomePath: String? = nil,
        hermesIdentityFilePath: String? = nil,
        workspaceFolderPath: String? = nil,
        config: JSONRecord = [:]
    ) throws -> AgentWithBinding {
        if let existing = try getAgentForHarness(workspaceId: workspaceId, harnessId: harnessId) {
            return existing
        }
        return try createAgent(
            workspaceId: workspaceId,
            name: name,
            description: description,
            harnessId: harnessId,
            externalAgentId: externalAgentId,
            hermesProfileSlug: hermesProfileSlug,
            hermesHomePath: hermesHomePath,
            hermesIdentityFilePath: hermesIdentityFilePath,
            workspaceFolderPath: workspaceFolderPath,
            config: config
        )
    }

    public func createAgent(
        workspaceId: String,
        name: String,
        description: String? = nil,
        model: String? = nil,
        harnessId: String,
        externalAgentId: String? = nil,
        hermesProfileSlug: String? = nil,
        hermesHomePath: String? = nil,
        hermesIdentityFilePath: String? = nil,
        workspaceFolderPath: String? = nil,
        config: JSONRecord = [:]
    ) throws -> AgentWithBinding {
        _ = try getWorkspace(workspaceId)
        let harness = try getHarness(harnessId)
        let name = try requireNonEmptyString(name, field: "Agent name", maxLength: 120)
        let description = try optionalTrimmedString(description, field: "Description", maxLength: 1000)
        let model = try optionalTrimmedString(model, field: "Model", maxLength: 160)
        let externalAgentId = try optionalTrimmedString(externalAgentId, field: "External agent ID", maxLength: 160)
        let hermesProfileSlug = try optionalTrimmedString(hermesProfileSlug, field: "Hermes profile", maxLength: 160)
        let hermesHomePath = try optionalTrimmedString(hermesHomePath, field: "Hermes home", maxLength: 2000)
        let hermesIdentityFilePath = try optionalTrimmedString(hermesIdentityFilePath, field: "Hermes identity file", maxLength: 2000)
        let folder = try optionalTrimmedString(workspaceFolderPath, field: "Workspace folder", maxLength: 2000)
        let timestamp = nowIso()
        let agentId = createRelayId("agt")
        let bindingId = createRelayId("rb")
        try database.transaction {
            try database.run(
                "INSERT INTO agents (id, workspace_id, name, description, model, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'active', ?, ?)",
                [.text(agentId), .text(workspaceId), .text(name), description.sqliteText, model.sqliteText, .text(timestamp), .text(timestamp)]
            )
            try database.run(
                """
                INSERT INTO runtime_bindings (
                  id, agent_id, harness_id, runtime_type, adapter_kind, routing_mode, external_agent_id,
                  hermes_profile_slug, hermes_home_path, hermes_identity_file_path,
                  workspace_folder_path, config_json, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, 'local', ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    .text(bindingId),
                    .text(agentId),
                    .text(harness.id),
                    .text(harness.runtimeType.rawValue),
                    .text(harness.mode.rawValue),
                    externalAgentId.sqliteText,
                    hermesProfileSlug.sqliteText,
                    hermesHomePath.sqliteText,
                    hermesIdentityFilePath.sqliteText,
                    folder.sqliteText,
                    .text(encodeJSONRecord(config)),
                    .text(timestamp),
                    .text(timestamp)
                ]
            )
        }
        _ = try log(severity: "info", category: "agents", message: "Local agent created.", detail: [
            "agentId": .string(agentId),
            "harnessId": .string(harness.id)
        ])
        return try getAgent(agentId)
    }

    public func updateAgent(
        agentId: String,
        name: String? = nil,
        description: String? = nil,
        model: String? = nil,
        status: String? = nil,
        harnessId: String? = nil,
        externalAgentId: String? = nil,
        hermesProfileSlug: String? = nil,
        hermesHomePath: String? = nil,
        hermesIdentityFilePath: String? = nil,
        workspaceFolderPath: String? = nil,
        config: JSONRecord? = nil
    ) throws -> AgentWithBinding {
        let current = try getAgent(agentId)
        let harness = try harnessId.map { try getHarness($0) } ?? current.harness
        let name = try name.map { try requireNonEmptyString($0, field: "Agent name", maxLength: 120) } ?? current.name
        let description = description == nil ? current.description : try optionalTrimmedString(description, field: "Description", maxLength: 1000)
        let model = model == nil ? current.model : try optionalTrimmedString(model, field: "Model", maxLength: 160)
        let externalAgentId = externalAgentId == nil ? current.binding.externalAgentId : try optionalTrimmedString(externalAgentId, field: "External agent ID", maxLength: 160)
        let hermesProfileSlug = hermesProfileSlug == nil ? current.binding.hermesProfileSlug : try optionalTrimmedString(hermesProfileSlug, field: "Hermes profile", maxLength: 160)
        let hermesHomePath = hermesHomePath == nil ? current.binding.hermesHomePath : try optionalTrimmedString(hermesHomePath, field: "Hermes home", maxLength: 2000)
        let hermesIdentityFilePath = hermesIdentityFilePath == nil ? current.binding.hermesIdentityFilePath : try optionalTrimmedString(hermesIdentityFilePath, field: "Hermes identity file", maxLength: 2000)
        let folder = workspaceFolderPath == nil ? current.binding.workspaceFolderPath : try optionalTrimmedString(workspaceFolderPath, field: "Workspace folder", maxLength: 2000)
        let timestamp = nowIso()
        try database.transaction {
            try database.run(
                "UPDATE agents SET name = ?, description = ?, model = ?, status = ?, updated_at = ? WHERE id = ?",
                [.text(name), description.sqliteText, model.sqliteText, .text(status ?? current.status), .text(timestamp), .text(agentId)]
            )
            try database.run(
                """
                UPDATE runtime_bindings
                SET harness_id = ?, runtime_type = ?, adapter_kind = ?, external_agent_id = ?,
                    hermes_profile_slug = ?, hermes_home_path = ?, hermes_identity_file_path = ?,
                    workspace_folder_path = ?, config_json = ?, updated_at = ?
                WHERE agent_id = ?
                """,
                [
                    .text(harness.id),
                    .text(harness.runtimeType.rawValue),
                    .text(harness.mode.rawValue),
                    externalAgentId.sqliteText,
                    hermesProfileSlug.sqliteText,
                    hermesHomePath.sqliteText,
                    hermesIdentityFilePath.sqliteText,
                    folder.sqliteText,
                    .text(encodeJSONRecord(config ?? current.binding.config)),
                    .text(timestamp),
                    .text(agentId)
                ]
            )
        }
        return try getAgent(agentId)
    }

    public func updateAgentRole(agentId: String, role: String?) throws -> AgentWithBinding {
        _ = try getAgent(agentId)
        let normalizedRole = try optionalTrimmedString(role, field: "Role", maxLength: 160)
        try database.run(
            "UPDATE agents SET role = ?, updated_at = ? WHERE id = ?",
            [normalizedRole.sqliteText, .text(nowIso()), .text(agentId)]
        )
        return try getAgent(agentId)
    }

    public func setRuntimeBindingHermesProfile(
        agentId: String,
        profileSlug: String,
        hermesHomePath: String,
        identityFilePath: String,
        ownershipNonce: String? = nil
    ) throws -> AgentWithBinding {
        let current = try getAgent(agentId)
        guard current.binding.runtimeType == .hermes else {
            throw RelayError(.invalidInput, "Only Hermes agents can have Hermes profiles.")
        }
        let slug = try requireNonEmptyString(profileSlug, field: "Hermes profile", maxLength: 160)
        let home = try requireNonEmptyString(hermesHomePath, field: "Hermes home", maxLength: 2000)
        let identity = try requireNonEmptyString(identityFilePath, field: "Hermes identity file", maxLength: 2000)
        var config = current.binding.config
        if let ownershipNonce {
            config["relayProfileOwnershipNonce"] = .string(ownershipNonce)
        } else {
            config["relayProfileOwnershipNonce"] = nil
        }
        try database.run(
            """
            UPDATE runtime_bindings
            SET hermes_profile_slug = ?, hermes_home_path = ?, hermes_identity_file_path = ?,
                config_json = ?, updated_at = ?
            WHERE agent_id = ?
            """,
            [
                .text(slug),
                .text(home),
                .text(identity),
                .text(encodeJSONRecord(config)),
                .text(nowIso()),
                .text(agentId)
            ]
        )
        return try getAgent(agentId)
    }

    public func agentDeletionImpact(agentId: String) throws -> AgentDeletionImpact {
        let agent = try getAgent(agentId)
        let directThreadIds = try agentDeletionDirectThreadIds(agentId: agentId, workspaceId: agent.workspaceId)
        let teamThreadIds = try agentDeletionTeamThreadIds(agentId: agentId, workspaceId: agent.workspaceId)
        let directMessageCount = try database
            .get(
                """
                SELECT COUNT(*) AS value
                FROM messages
                WHERE thread_id IN (
                  SELECT id FROM threads
                  WHERE workspace_id = ?
                    AND thread_type = 'direct'
                    AND (
                      selected_agent_id = ?
                      OR EXISTS (
                        SELECT 1 FROM thread_participants
                        WHERE thread_id = threads.id
                          AND participant_type = 'agent'
                          AND participant_id = ?
                      )
                      OR EXISTS (
                        SELECT 1 FROM messages m
                        WHERE m.thread_id = threads.id
                          AND m.sender_type = 'agent'
                          AND m.sender_id = ?
                      )
                    )
                )
                """,
                [.text(agent.workspaceId), .text(agentId), .text(agentId), .text(agentId)]
            )?["value"]?.int ?? 0
        let teamMessageCount = try agentDeletionTeamMessageCount(agentId: agentId, workspaceId: agent.workspaceId)
        let runtimeDispatchCount = try database
            .get("SELECT COUNT(*) AS value FROM runtime_dispatches WHERE agent_id = ?", [.text(agentId)])?["value"]?.int ?? 0
        let activeDispatchCount = try database
            .get(
                "SELECT COUNT(*) AS value FROM runtime_dispatches WHERE agent_id = ? AND status IN ('queued', 'started', 'streaming')",
                [.text(agentId)]
            )?["value"]?.int ?? 0
        let runtimeSessionCount = try database
            .get("SELECT COUNT(*) AS value FROM runtime_sessions WHERE agent_id = ?", [.text(agentId)])?["value"]?.int ?? 0
        return AgentDeletionImpact(
            agentId: agent.id,
            agentName: agent.name,
            directThreadCount: directThreadIds.count,
            directMessageCount: directMessageCount,
            teamThreadCount: teamThreadIds.count,
            teamMessageCount: teamMessageCount,
            runtimeDispatchCount: runtimeDispatchCount,
            activeDispatchCount: activeDispatchCount,
            runtimeSessionCount: runtimeSessionCount
        )
    }

    @discardableResult
    public func deleteAgentCascade(agentId: String) throws -> AgentDeletionResult {
        let agent = try getAgent(agentId)
        let impact = try agentDeletionImpact(agentId: agentId)
        let directThreadIds = try agentDeletionDirectThreadIds(agentId: agentId, workspaceId: agent.workspaceId)
        let teamThreadIds = try agentDeletionTeamThreadIds(agentId: agentId, workspaceId: agent.workspaceId)
        let timestamp = nowIso()
        var deletedTeamMessageCount = 0
        try database.transaction {
            try database.run(
                """
                DELETE FROM runtime_dispatches
                WHERE agent_id = ?
                """,
                [.text(agentId)]
            )
            try database.run(
                """
                DELETE FROM runtime_sessions
                WHERE agent_id = ?
                """,
                [.text(agentId)]
            )
            try database.run(
                """
                UPDATE thread_read_states
                SET last_read_message_id = NULL, updated_at = ?
                WHERE last_read_message_id IN (
                  SELECT m.id
                  FROM messages m
                  JOIN threads t ON t.id = m.thread_id
                  WHERE t.workspace_id = ?
                    AND t.thread_type = 'team'
                    AND m.sender_type = 'agent'
                    AND m.sender_id = ?
                )
                """,
                [.text(timestamp), .text(agent.workspaceId), .text(agentId)]
            )
            try database.run(
                """
                DELETE FROM chat_attachments
                WHERE message_id IN (
                  SELECT m.id
                  FROM messages m
                  JOIN threads t ON t.id = m.thread_id
                  WHERE t.workspace_id = ?
                    AND t.thread_type = 'team'
                    AND m.sender_type = 'agent'
                    AND m.sender_id = ?
                )
                """,
                [.text(agent.workspaceId), .text(agentId)]
            )
            deletedTeamMessageCount = try database.run(
                """
                DELETE FROM messages
                WHERE id IN (
                  SELECT m.id
                  FROM messages m
                  JOIN threads t ON t.id = m.thread_id
                  WHERE t.workspace_id = ?
                    AND t.thread_type = 'team'
                    AND m.sender_type = 'agent'
                    AND m.sender_id = ?
                )
                """,
                [.text(agent.workspaceId), .text(agentId)]
            )
            try database.run(
                """
                UPDATE thread_participants
                SET left_at = COALESCE(left_at, ?), updated_at = ?
                WHERE participant_type = 'agent'
                  AND participant_id = ?
                  AND thread_id IN (SELECT id FROM threads WHERE workspace_id = ?)
                """,
                [.text(timestamp), .text(timestamp), .text(agentId), .text(agent.workspaceId)]
            )
            try database.run(
                """
                UPDATE threads
                SET selected_agent_id = (
                      SELECT participant_id
                      FROM thread_participants
                      WHERE thread_id = threads.id
                        AND participant_type = 'agent'
                        AND participant_id IS NOT NULL
                        AND left_at IS NULL
                      ORDER BY joined_at ASC, id ASC
                      LIMIT 1
                    ),
                    updated_at = ?
                WHERE workspace_id = ?
                  AND selected_agent_id = ?
                """,
                [.text(timestamp), .text(agent.workspaceId), .text(agentId)]
            )
            for threadId in teamThreadIds {
                try refreshThreadLastMessageFromDatabase(threadId: threadId, timestamp: timestamp)
            }
            for threadId in directThreadIds {
                try database.run("DELETE FROM threads WHERE id = ?", [.text(threadId)])
            }
            try database.run(
                """
                UPDATE agents
                SET manager_agent_id = NULL, updated_at = ?
                WHERE workspace_id = ?
                  AND manager_agent_id = ?
                """,
                [.text(timestamp), .text(agent.workspaceId), .text(agentId)]
            )
            try database.run("DELETE FROM agents WHERE id = ?", [.text(agentId)])
        }
        for threadId in teamThreadIds {
            if let thread = try? getThread(threadId) {
                eventBus.emit(.threadUpdated, thread)
                eventBus.emit(.chatThreadUpdate, thread)
            }
        }
        if let state = try? getAppState() {
            eventBus.emit(.appStateChanged, state)
        }
        eventBus.emit(.agentOrganizationUpdated, [
            "action": .string("agentDeleted"),
            "agentId": .string(agentId),
            "workspaceId": .string(agent.workspaceId)
        ] as JSONRecord)
        return AgentDeletionResult(
            impact: impact,
            deletedDirectThreadIds: directThreadIds,
            affectedTeamThreadIds: teamThreadIds,
            deletedTeamMessageCount: deletedTeamMessageCount,
            deletedAt: timestamp
        )
    }

    public func deleteAgent(agentId: String) throws {
        _ = try deleteAgentCascade(agentId: agentId)
    }

    public func listThreads(workspaceId: String, status: String = "active") throws -> [ThreadSummary] {
        _ = try getWorkspace(workspaceId)
        return try database
            .all("SELECT * FROM threads WHERE workspace_id = ? AND status = ? ORDER BY updated_at DESC", [.text(workspaceId), .text(status)])
            .map(mapThreadSummary)
    }

    public func createThread(
        workspaceId: String,
        title: String? = nil,
        selectedAgentId: String? = nil,
        threadType: ThreadType = .direct
    ) throws -> ThreadDetail {
        _ = try getWorkspace(workspaceId)
        guard threadType == .direct || threadType == .team else {
            throw RelayError(.unsupported, "This thread type is not enabled in Relay Console Swift.")
        }
        let title = try optionalTrimmedString(title, field: "Thread title", maxLength: 160) ?? "New local chat"
        let selectedAgent: AgentWithBinding?
        if let selectedAgentId {
            let agent = try getAgent(selectedAgentId)
            guard agent.workspaceId == workspaceId else {
                throw RelayError(.invalidInput, "Selected agent does not belong to this workspace.")
            }
            selectedAgent = agent
        } else {
            selectedAgent = nil
        }
        let id = createRelayId("thr")
        let sessionId = createRelayId("chs")
        let timestamp = nowIso()
        try database.transaction {
            try database.run(
                """
                INSERT INTO threads (
                  id, workspace_id, title, thread_type, selected_agent_id, active_session_id, status,
                  read_state, unread_count, is_archived, last_message_snippet, last_message_at,
                  created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, 'active', 'read', 0, 0, NULL, NULL, ?, ?)
                """,
                [
                    .text(id),
                    .text(workspaceId),
                    .text(title),
                    .text(threadType.rawValue),
                    selectedAgentId.sqliteText,
                    .text(sessionId),
                    .text(timestamp),
                    .text(timestamp)
                ]
            )
            try database.run(
                """
                INSERT INTO thread_sessions (
                  id, thread_id, sequence_number, status, is_read_only, started_at, ended_at, created_at, updated_at
                )
                VALUES (?, ?, 1, 'active', 0, ?, NULL, ?, ?)
                """,
                [.text(sessionId), .text(id), .text(timestamp), .text(timestamp), .text(timestamp)]
            )
            if let selectedAgent {
                try database.run(
                    """
                    INSERT INTO thread_participants (
                      id, thread_id, participant_type, participant_id, display_name, role, is_manager,
                      joined_at, left_at, created_at, updated_at
                    )
                    VALUES (?, ?, 'agent', ?, ?, 'member', 0, ?, NULL, ?, ?)
                    """,
                    [
                        .text(createRelayId("thp")),
                        .text(id),
                        .text(selectedAgent.id),
                        .text(selectedAgent.name),
                        .text(timestamp),
                        .text(timestamp),
                        .text(timestamp)
                    ]
                )
            }
        }
        let thread = try getThread(id)
        eventBus.emit(.threadUpdated, thread)
        return thread
    }

    public func addThreadParticipant(
        threadId: String,
        participantType: ThreadParticipantType,
        participantId: String?,
        displayName: String,
        role: ThreadParticipantRole = .member,
        isManager: Bool = false
    ) throws -> ThreadParticipant {
        let thread = try getThread(threadId)
        let displayName = try requireNonEmptyString(displayName, field: "Participant display name", maxLength: 160)
        let participantId = try optionalTrimmedString(participantId, field: "Participant id", maxLength: 160)
        switch participantType {
        case .agent:
            guard let participantId else {
                throw RelayError(.invalidInput, "Agent participants require an agent id.")
            }
            let agent = try getAgent(participantId)
            guard agent.workspaceId == thread.workspaceId else {
                throw RelayError(.invalidInput, "Agent participant does not belong to this workspace.")
            }
        case .team:
            guard let participantId else {
                throw RelayError(.invalidInput, "Team participants require a team id.")
            }
            let team = try getAgentOrgTeam(participantId)
            guard team.workspaceId == thread.workspaceId else {
                throw RelayError(.invalidInput, "Team participant does not belong to this workspace.")
            }
        case .user, .system:
            break
        }
        if let participantId,
           let row = try database.get(
                """
                SELECT * FROM thread_participants
                WHERE thread_id = ? AND participant_type = ? AND participant_id = ? AND left_at IS NULL
                LIMIT 1
                """,
                [.text(threadId), .text(participantType.rawValue), .text(participantId)]
           ) {
            let current = try mapThreadParticipant(row)
            if current.displayName != displayName || current.role != role || current.isManager != isManager {
                let timestamp = nowIso()
                try database.run(
                    """
                    UPDATE thread_participants
                    SET display_name = ?, role = ?, is_manager = ?, updated_at = ?
                    WHERE id = ?
                    """,
                    [.text(displayName), .text(role.rawValue), .integer(isManager ? 1 : 0), .text(timestamp), .text(current.id)]
                )
                guard let updatedRow = try database.get("SELECT * FROM thread_participants WHERE id = ?", [.text(current.id)]) else {
                    throw RelayError(.notFound, "Thread participant was not found after update.")
                }
                eventBus.emit(.threadUpdated, try getThread(threadId))
                return try mapThreadParticipant(updatedRow)
            }
            return current
        }
        let id = createRelayId("thp")
        let timestamp = nowIso()
        try database.run(
            """
            INSERT INTO thread_participants (
              id, thread_id, participant_type, participant_id, display_name, role, is_manager,
              joined_at, left_at, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
            """,
            [
                .text(id),
                .text(threadId),
                .text(participantType.rawValue),
                participantId.sqliteText,
                .text(displayName),
                .text(role.rawValue),
                .integer(isManager ? 1 : 0),
                .text(timestamp),
                .text(timestamp),
                .text(timestamp)
            ]
        )
        guard let row = try database.get("SELECT * FROM thread_participants WHERE id = ?", [.text(id)]) else {
            throw RelayError(.notFound, "Thread participant was not found after creation.")
        }
        eventBus.emit(.threadUpdated, try getThread(threadId))
        return try mapThreadParticipant(row)
    }

    public func getThread(_ threadId: String) throws -> ThreadDetail {
        guard let row = try database.get("SELECT * FROM threads WHERE id = ?", [.text(threadId)]) else {
            throw RelayError(.notFound, "Thread was not found.")
        }
        let summary = try mapThreadSummary(row)
        return ThreadDetail(
            id: summary.id,
            workspaceId: summary.workspaceId,
            title: summary.title,
            threadType: summary.threadType,
            selectedAgentId: summary.selectedAgentId,
            activeSessionId: summary.activeSessionId,
            status: summary.status,
            readState: summary.readState,
            unreadCount: summary.unreadCount,
            isArchived: summary.isArchived,
            archivedAt: summary.archivedAt,
            lastReadAt: summary.lastReadAt,
            latestWrapUpReportId: summary.latestWrapUpReportId,
            lastMessageSnippet: summary.lastMessageSnippet,
            lastMessageAt: summary.lastMessageAt,
            createdAt: summary.createdAt,
            updatedAt: summary.updatedAt,
            participants: try listThreadParticipants(threadId: threadId),
            sessions: try listChatSessions(threadId: threadId),
            readStates: try listThreadReadStates(threadId: threadId),
            wrapUpReports: try listThreadWrapUpReports(threadId: threadId),
            messages: try listMessages(threadId: threadId)
        )
    }

    public func updateThread(threadId: String, title: String? = nil, selectedAgentId: String? = nil, status: String? = nil) throws -> ThreadDetail {
        let current = try getThread(threadId)
        let title = try title.map { try requireNonEmptyString($0, field: "Thread title", maxLength: 160) } ?? current.title
        if let selectedAgentId {
            let agent = try getAgent(selectedAgentId)
            guard agent.workspaceId == current.workspaceId else {
                throw RelayError(.invalidInput, "Selected agent does not belong to this workspace.")
            }
        }
        try database.run(
            """
            UPDATE threads
            SET title = ?, selected_agent_id = ?, status = ?,
                is_archived = CASE WHEN ? = 'archived' THEN 1 ELSE is_archived END,
                archived_at = CASE WHEN ? = 'archived' THEN COALESCE(archived_at, ?) ELSE archived_at END,
                updated_at = ?
            WHERE id = ?
            """,
            [
                .text(title),
                (selectedAgentId ?? current.selectedAgentId).sqliteText,
                .text(status ?? current.status),
                .text(status ?? current.status),
                .text(status ?? current.status),
                .text(nowIso()),
                .text(nowIso()),
                .text(threadId)
            ]
        )
        let thread = try getThread(threadId)
        eventBus.emit(.threadUpdated, thread)
        return thread
    }

    public func archiveThread(threadId: String) throws -> ThreadDetail {
        let current = try getThread(threadId)
        let timestamp = nowIso()
        try database.transaction {
            if let activeSessionId = current.activeSessionId {
                try database.run(
                    """
                    UPDATE thread_sessions
                    SET status = 'archived', is_read_only = 1, ended_at = COALESCE(ended_at, ?), updated_at = ?
                    WHERE id = ?
                    """,
                    [.text(timestamp), .text(timestamp), .text(activeSessionId)]
                )
            }
            try database.run(
                """
                UPDATE threads
                SET status = 'archived',
                    is_archived = 1,
                    archived_at = COALESCE(archived_at, ?),
                    active_session_id = NULL,
                    read_state = 'read',
                    updated_at = ?
                WHERE id = ?
                """,
                [.text(timestamp), .text(timestamp), .text(threadId)]
            )
        }
        let thread = try getThread(threadId)
        eventBus.emit(.threadUpdated, thread)
        return thread
    }

    public func listMessages(threadId: String, limit: Int = 200, before: String? = nil, sessionId: String? = nil) throws -> [Message] {
        var params: [SQLiteValue] = [.text(threadId)]
        var whereClause = "thread_id = ?"
        if let sessionId {
            whereClause += " AND thread_session_id = ?"
            params.append(.text(sessionId))
        }
        if let before {
            whereClause += " AND created_at < ?"
            params.append(.text(before))
        }
        params.append(.integer(Int64(min(max(limit, 1), 500))))
        let newestFirst = try database
            .all("SELECT * FROM messages WHERE \(whereClause) ORDER BY created_at DESC, id DESC LIMIT ?", params)
            .map(mapMessage)
        return Array(newestFirst.reversed())
    }

    public func listMessagePage(
        threadId: String,
        sessionId: String? = nil,
        limit: Int = 50,
        before: MessageCursor? = nil,
        after: MessageCursor? = nil
    ) throws -> MessagePage {
        guard before == nil || after == nil else {
            throw RelayError(.invalidInput, "Message history accepts either an older or newer cursor, not both.")
        }
        let pageLimit = min(max(limit, 1), 100)
        var params: [SQLiteValue] = [.text(threadId)]
        var whereClause = "thread_id = ?"
        if let sessionId {
            whereClause += " AND thread_session_id = ?"
            params.append(.text(sessionId))
        }
        let ascending: Bool
        if let before {
            whereClause += " AND (created_at < ? OR (created_at = ? AND id < ?))"
            params.append(contentsOf: [.text(before.createdAt), .text(before.createdAt), .text(before.id)])
            ascending = false
        } else if let after {
            whereClause += " AND (created_at > ? OR (created_at = ? AND id > ?))"
            params.append(contentsOf: [.text(after.createdAt), .text(after.createdAt), .text(after.id)])
            ascending = true
        } else {
            ascending = false
        }
        params.append(.integer(Int64(pageLimit + 1)))
        let direction = ascending ? "ASC" : "DESC"
        var pageMessages = try database
            .all("SELECT * FROM messages WHERE \(whereClause) ORDER BY created_at \(direction), id \(direction) LIMIT ?", params)
            .map(mapMessage)
        let hasExtra = pageMessages.count > pageLimit
        if hasExtra { pageMessages.removeLast(pageMessages.count - pageLimit) }
        if !ascending { pageMessages.reverse() }
        return MessagePage(
            messages: pageMessages,
            hasOlder: before != nil ? hasExtra : (after != nil || hasExtra),
            hasNewer: after != nil ? hasExtra : before != nil
        )
    }

    public func countMessages(
        threadId: String,
        sessionId: String? = nil,
        after cursor: MessageCursor? = nil
    ) throws -> Int {
        var params: [SQLiteValue] = [.text(threadId)]
        var whereClause = "thread_id = ?"
        if let sessionId {
            whereClause += " AND thread_session_id = ?"
            params.append(.text(sessionId))
        }
        if let cursor {
            whereClause += " AND (created_at > ? OR (created_at = ? AND id > ?))"
            params.append(contentsOf: [.text(cursor.createdAt), .text(cursor.createdAt), .text(cursor.id)])
        }
        return Int(try database.get("SELECT COUNT(*) AS count FROM messages WHERE \(whereClause)", params)?["count"]?.int ?? 0)
    }

    public func listMessagesInThreadOrder(threadId: String, sessionId: String? = nil) throws -> [Message] {
        _ = try getThread(threadId)
        var params: [SQLiteValue] = [.text(threadId)]
        var whereClause = "thread_id = ?"
        if let sessionId {
            whereClause += " AND thread_session_id = ?"
            params.append(.text(sessionId))
        }
        return try database
            .all("SELECT * FROM messages WHERE \(whereClause) ORDER BY created_at ASC, id ASC", params)
            .map(mapMessage)
    }

    public func createMessage(
        threadId: String,
        senderType: SenderType,
        senderId: String? = nil,
        senderName: String,
        content: String,
        contentFormat: MessageFormat = .plain,
        metadata: JSONRecord = [:]
    ) throws -> Message {
        let thread = try getThread(threadId)
        try assertThreadWritable(thread)
        let senderName = try requireNonEmptyString(senderName, field: "Sender name", maxLength: 120)
        let content = try requireNonEmptyString(content, field: "Message", maxLength: 32000)
        let sessionId = try ensureActiveChatSession(thread: thread).id
        let id = createRelayId("msg")
        let timestamp = nowIso()
        try database.run(
            """
            INSERT INTO messages (
              id, thread_id, thread_session_id, sender_type, sender_id, sender_name,
              content, content_format, metadata_json, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                .text(id),
                .text(threadId),
                .text(sessionId),
                .text(senderType.rawValue),
                senderId.sqliteText,
                .text(senderName),
                .text(content),
                .text(contentFormat.rawValue),
                .text(encodeJSONRecord(redactRecord(metadata))),
                .text(timestamp)
            ]
        )
        try updateThreadLastMessage(threadId: threadId, content: content, timestamp: timestamp, senderType: senderType)
        guard let row = try database.get("SELECT * FROM messages WHERE id = ?", [.text(id)]) else {
            throw RelayError(.internalError, "Created message could not be reloaded.")
        }
        let message = try mapMessage(row)
        eventBus.emit(.messageCreated, message)
        return message
    }

    public func getMessage(_ messageId: String) throws -> Message {
        guard let row = try database.get("SELECT * FROM messages WHERE id = ?", [.text(messageId)]) else {
            throw RelayError(.notFound, "Message was not found.")
        }
        return try mapMessage(row)
    }

    @discardableResult
    public func updateMessageMetadata(messageId: String, metadata: JSONRecord) throws -> Message {
        let current = try getMessage(messageId)
        let redacted = redactRecord(metadata)
        try database.run(
            "UPDATE messages SET metadata_json = ? WHERE id = ?",
            [.text(encodeJSONRecord(redacted)), .text(messageId)]
        )
        let updated = try getMessage(messageId)
        eventBus.emit(.messageCreated, updated)
        eventBus.emit(.threadUpdated, try getThread(current.threadId))
        return updated
    }

    public func createChatSession(threadId: String, status: ThreadSessionStatus = .active, isReadOnly: Bool = false) throws -> ChatSession {
        let thread = try getThread(threadId)
        if thread.isArchived || thread.status == "archived" {
            throw ServiceGuardResult(
                stateKind: .readOnly,
                reasonCode: .authorityReadOnly,
                message: "Archived threads cannot start a new chat session.",
                recovery: "Create or select an active thread before starting a session.",
                correlationId: "thread-\(thread.id)"
            )
        }
        let nextSequence = try nextChatSessionSequence(threadId: threadId)
        let id = createRelayId("chs")
        let timestamp = nowIso()
        try database.transaction {
            if status == .active {
                try database.run(
                    "UPDATE thread_sessions SET status = 'wrapped', is_read_only = 1, ended_at = COALESCE(ended_at, ?), updated_at = ? WHERE thread_id = ? AND status = 'active'",
                    [.text(timestamp), .text(timestamp), .text(threadId)]
                )
            }
            try database.run(
                """
                INSERT INTO thread_sessions (
                  id, thread_id, sequence_number, status, is_read_only, started_at, ended_at, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)
                """,
                [
                    .text(id),
                    .text(threadId),
                    .integer(Int64(nextSequence)),
                    .text(status.rawValue),
                    .integer(isReadOnly ? 1 : 0),
                    .text(timestamp),
                    .text(timestamp),
                    .text(timestamp)
                ]
            )
            if status == .active && !isReadOnly {
                try database.run(
                    "UPDATE threads SET active_session_id = ?, status = 'active', is_archived = 0, updated_at = ? WHERE id = ?",
                    [.text(id), .text(timestamp), .text(thread.id)]
                )
            }
        }
        let session = try getChatSession(id)
        eventBus.emit(.threadUpdated, try getThread(threadId))
        return session
    }

    public func listChatSessions(threadId: String) throws -> [ChatSession] {
        try database
            .all("SELECT * FROM thread_sessions WHERE thread_id = ? ORDER BY sequence_number ASC", [.text(threadId)])
            .map(mapChatSession)
    }

    @discardableResult
    public func updateChatSessionRelayControls(
        sessionId: String,
        runState: TeamRelayRunState,
        pauseReason: TeamRelayPauseReason?,
        replyLimit: Int
    ) throws -> ChatSession {
        let current = try getChatSession(sessionId)
        let timestamp = nowIso()
        try database.run(
            """
            UPDATE thread_sessions
            SET relay_run_state = ?, relay_pause_reason = ?, relay_reply_limit = ?, updated_at = ?
            WHERE id = ?
            """,
            [
                .text(runState.rawValue),
                pauseReason.map { SQLiteValue.text($0.rawValue) } ?? .null,
                .integer(Int64(TeamRelayReplyLimits.normalized(replyLimit))),
                .text(timestamp),
                .text(sessionId)
            ]
        )
        let updated = try getChatSession(sessionId)
        eventBus.emit(.threadUpdated, try getThread(current.threadId))
        return updated
    }

    public func countAgentMessages(threadId: String, sessionId: String? = nil) throws -> Int {
        _ = try getThread(threadId)
        var params: [SQLiteValue] = [.text(threadId), .text(SenderType.agent.rawValue)]
        var whereClause = "thread_id = ? AND sender_type = ?"
        if let sessionId {
            whereClause += " AND thread_session_id = ?"
            params.append(.text(sessionId))
        }
        let row = try database.get("SELECT COUNT(*) AS agent_count FROM messages WHERE \(whereClause)", params)
        return row?["agent_count"]?.int ?? 0
    }

    public func listThreadParticipants(threadId: String) throws -> [ThreadParticipant] {
        try database
            .all("SELECT * FROM thread_participants WHERE thread_id = ? ORDER BY joined_at ASC, id ASC", [.text(threadId)])
            .map(mapThreadParticipant)
    }

    public func listThreadReadStates(threadId: String) throws -> [ThreadReadState] {
        try database
            .all("SELECT * FROM thread_read_states WHERE thread_id = ? ORDER BY updated_at DESC", [.text(threadId)])
            .map(mapThreadReadState)
    }

    public func listThreadWrapUpReports(threadId: String) throws -> [ThreadWrapUpReport] {
        try database
            .all("SELECT * FROM thread_wrap_up_reports WHERE thread_id = ? ORDER BY created_at DESC", [.text(threadId)])
            .map(mapThreadWrapUpReport)
    }

    public func listThreadWrapUpReports(workspaceId: String, includeArchived: Bool = false, limit: Int = 200) throws -> [ThreadWrapUpReport] {
        _ = try getWorkspace(workspaceId)
        var params: [SQLiteValue] = [.text(workspaceId)]
        var archiveClause = ""
        if !includeArchived {
            archiveClause = " AND archived_at IS NULL"
        }
        params.append(.integer(Int64(min(max(limit, 1), 500))))
        return try database
            .all(
                """
                SELECT * FROM thread_wrap_up_reports
                WHERE workspace_id = ?\(archiveClause)
                ORDER BY updated_at DESC, created_at DESC
                LIMIT ?
                """,
                params
            )
            .map(mapThreadWrapUpReport)
    }

    public func getThreadWrapUpReport(_ id: String) throws -> ThreadWrapUpReport {
        guard let row = try database.get("SELECT * FROM thread_wrap_up_reports WHERE id = ?", [.text(id)]) else {
            throw RelayError(.notFound, "Thread wrap-up report was not found.")
        }
        return try mapThreadWrapUpReport(row)
    }

    public func getComposerDraft(threadId: String, profileId: String? = nil) throws -> ChatComposerDraft? {
        _ = try getThread(threadId)
        return try database.get(
            "SELECT * FROM chat_composer_drafts WHERE thread_id = ? AND COALESCE(profile_id, '') = COALESCE(?, '')",
            [.text(threadId), profileId.sqliteText]
        ).map(mapChatComposerDraft)
    }

    @discardableResult
    public func saveComposerDraft(
        threadId: String,
        profileId: String? = nil,
        content: String,
        metadata: JSONRecord = [:]
    ) throws -> ChatComposerDraft? {
        _ = try getThread(threadId)
        let messageLimit = try getMessageLimit()
        guard content.count <= messageLimit else {
            throw RelayError(.invalidInput, "Draft is too long.")
        }
        let redactedMetadata = redactRecord(metadata)
        let timestamp = nowIso()
        if content.isEmpty && redactedMetadata.isEmpty {
            try clearComposerDraft(threadId: threadId, profileId: profileId)
            return nil
        }
        if let existing = try getComposerDraft(threadId: threadId, profileId: profileId) {
            try database.run(
                """
                UPDATE chat_composer_drafts
                SET content = ?, metadata_json = ?, updated_at = ?
                WHERE id = ?
                """,
                [.text(content), .text(encodeJSONRecord(redactedMetadata)), .text(timestamp), .text(existing.id)]
            )
            return try getComposerDraft(threadId: threadId, profileId: profileId)
        }
        let id = createRelayId("cdt")
        try database.run(
            """
            INSERT INTO chat_composer_drafts (
              id, thread_id, profile_id, content, metadata_json, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            [
                .text(id),
                .text(threadId),
                profileId.sqliteText,
                .text(content),
                .text(encodeJSONRecord(redactedMetadata)),
                .text(timestamp),
                .text(timestamp)
            ]
        )
        return try getComposerDraft(threadId: threadId, profileId: profileId)
    }

    public func clearComposerDraft(threadId: String, profileId: String? = nil) throws {
        _ = try getThread(threadId)
        try database.run(
            "DELETE FROM chat_composer_drafts WHERE thread_id = ? AND COALESCE(profile_id, '') = COALESCE(?, '')",
            [.text(threadId), profileId.sqliteText]
        )
    }

    public func listComposerAttachments(threadId: String, profileId: String? = nil) throws -> [ChatAttachment] {
        _ = try getThread(threadId)
        return try database
            .all(
                """
                SELECT * FROM chat_attachments
                WHERE thread_id = ?
                  AND COALESCE(profile_id, '') = COALESCE(?, '')
                  AND message_id IS NULL
                  AND status != 'cancelled'
                ORDER BY created_at ASC, id ASC
                """,
                [.text(threadId), profileId.sqliteText]
            )
            .map(mapChatAttachment)
    }

    public func listMessageAttachments(messageId: String) throws -> [ChatAttachment] {
        _ = try getMessage(messageId)
        return try database
            .all("SELECT * FROM chat_attachments WHERE message_id = ? ORDER BY created_at ASC, id ASC", [.text(messageId)])
            .map(mapChatAttachment)
    }

    public func getAttachment(_ id: String) throws -> ChatAttachment {
        guard let row = try database.get("SELECT * FROM chat_attachments WHERE id = ?", [.text(id)]) else {
            throw RelayError(.notFound, "Attachment was not found.")
        }
        return try mapChatAttachment(row)
    }

    @discardableResult
    public func stageAttachment(
        threadId: String,
        profileId: String? = nil,
        fileName rawFileName: String,
        mimeType rawMimeType: String,
        byteSize: Int,
        sha256: String,
        kind: ChatAttachmentKind,
        status: ChatAttachmentStatus = .uploaded,
        progress: Int = 100,
        provenance: JSONRecord = [:]
    ) throws -> ChatAttachment {
        _ = try getThread(threadId)
        let activeCount = try listComposerAttachments(threadId: threadId, profileId: profileId)
            .filter { ![ChatAttachmentStatus.failed, .cancelled].contains($0.status) }
            .count
        guard activeCount < 10 else {
            throw RelayError(.invalidInput, "Messages can include at most 10 attachments.")
        }
        let fileName = try requireNonEmptyString(
            URL(fileURLWithPath: rawFileName).lastPathComponent,
            field: "Attachment filename",
            maxLength: 255
        )
        let mimeType = try requireNonEmptyString(rawMimeType, field: "Attachment MIME type", maxLength: 160)
        let digest = try requireNonEmptyString(sha256, field: "Attachment SHA-256", maxLength: 128)
        let timestamp = nowIso()
        let id = createRelayId("att")
        try database.run(
            """
            INSERT INTO chat_attachments (
              id, thread_id, message_id, profile_id, file_name, mime_type, byte_size,
              sha256, kind, status, progress, provenance_json, error_json, created_at, updated_at
            )
            VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
            """,
            [
                .text(id),
                .text(threadId),
                profileId.sqliteText,
                .text(fileName),
                .text(mimeType),
                .integer(Int64(max(byteSize, 0))),
                .text(digest),
                .text(kind.rawValue),
                .text(status.rawValue),
                .integer(Int64(min(max(progress, 0), 100))),
                .text(encodeJSONRecord(redactRecord(provenance))),
                .text(timestamp),
                .text(timestamp)
            ]
        )
        return try getAttachment(id)
    }

    @discardableResult
    public func updateAttachmentStatus(
        attachmentId: String,
        status: ChatAttachmentStatus,
        progress: Int? = nil,
        error: JSONRecord? = nil
    ) throws -> ChatAttachment {
        let current = try getAttachment(attachmentId)
        let timestamp = nowIso()
        try database.run(
            """
            UPDATE chat_attachments
            SET status = ?, progress = ?, error_json = ?, updated_at = ?
            WHERE id = ?
            """,
            [
                .text(status.rawValue),
                .integer(Int64(min(max(progress ?? current.progress, 0), 100))),
                error.map { encodeJSONRecord(redactRecord($0)) }.sqliteText,
                .text(timestamp),
                .text(attachmentId)
            ]
        )
        return try getAttachment(attachmentId)
    }

    @discardableResult
    public func assignAttachmentsToMessage(
        threadId: String,
        profileId: String? = nil,
        messageId: String,
        attachmentIds: [String]
    ) throws -> [ChatAttachment] {
        guard !attachmentIds.isEmpty else { return [] }
        let message = try getMessage(messageId)
        guard message.threadId == threadId else {
            throw RelayError(.invalidInput, "Attachment message does not belong to this thread.")
        }
        let attachments = try attachmentIds.map { try getAttachment($0) }
        for attachment in attachments {
            guard attachment.threadId == threadId,
                  attachment.profileId == profileId,
                  attachment.messageId == nil,
                  ![ChatAttachmentStatus.cancelled, .failed].contains(attachment.status)
            else {
                throw RelayError(.invalidInput, "Attachment is not available for this message.")
            }
        }
        var assigned: [ChatAttachment] = []
        let timestamp = nowIso()
        for attachment in attachments {
            try database.run(
                """
                UPDATE chat_attachments
                SET message_id = ?, status = 'uploaded', progress = 100, updated_at = ?
                WHERE id = ?
                """,
                [.text(messageId), .text(timestamp), .text(attachment.id)]
            )
            assigned.append(try getAttachment(attachment.id))
        }
        return assigned
    }

    @discardableResult
    public func createDocumentReference(
        messageId: String,
        title rawTitle: String,
        referenceKind: ChatDocumentReferenceKind,
        displayPath: String? = nil,
        tokenCount: Int? = nil,
        isSensitive: Bool = false,
        isRedacted: Bool = false,
        metadata: JSONRecord = [:]
    ) throws -> ChatDocumentReference {
        _ = try getMessage(messageId)
        let title = try requireNonEmptyString(rawTitle, field: "Reference title", maxLength: 255)
        let safePath = safeReferenceDisplayPath(displayPath, isRedacted: isRedacted || isSensitive)
        let id = createRelayId("ref")
        let timestamp = nowIso()
        try database.run(
            """
            INSERT INTO chat_document_references (
              id, message_id, title, reference_kind, display_path, token_count,
              is_sensitive, is_redacted, metadata_json, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                .text(id),
                .text(messageId),
                .text(isRedacted || isSensitive ? "[REDACTED]" : title),
                .text(referenceKind.rawValue),
                safePath.sqliteText,
                tokenCount.map { SQLiteValue.integer(Int64(max($0, 0))) } ?? .null,
                .integer(isSensitive ? 1 : 0),
                .integer((isRedacted || isSensitive) ? 1 : 0),
                .text(encodeJSONRecord(redactRecord(metadata))),
                .text(timestamp)
            ]
        )
        return try getDocumentReference(id)
    }

    public func listDocumentReferences(messageId: String) throws -> [ChatDocumentReference] {
        _ = try getMessage(messageId)
        return try database
            .all("SELECT * FROM chat_document_references WHERE message_id = ? ORDER BY created_at ASC, id ASC", [.text(messageId)])
            .map(mapChatDocumentReference)
    }

    @discardableResult
    public func markThreadRead(threadId: String, profileId: String? = nil, lastReadMessageId: String? = nil) throws -> ThreadReadState {
        _ = try getThread(threadId)
        let timestamp = nowIso()
        let existing = try database.get(
            "SELECT id FROM thread_read_states WHERE thread_id = ? AND COALESCE(profile_id, '') = COALESCE(?, '')",
            [.text(threadId), profileId.sqliteText]
        )
        let id = try existing?.requireText("id") ?? createRelayId("trs")
        try database.transaction {
            if existing != nil {
                try database.run(
                    """
                    UPDATE thread_read_states
                    SET last_read_message_id = ?, last_read_at = ?, unread_count = 0, updated_at = ?
                    WHERE id = ?
                    """,
                    [lastReadMessageId.sqliteText, .text(timestamp), .text(timestamp), .text(id)]
                )
            } else {
                try database.run(
                    """
                    INSERT INTO thread_read_states (
                      id, thread_id, profile_id, last_read_message_id, last_read_at,
                      unread_count, created_at, updated_at
                    )
                    VALUES (?, ?, ?, ?, ?, 0, ?, ?)
                    """,
                    [
                        .text(id),
                        .text(threadId),
                        profileId.sqliteText,
                        lastReadMessageId.sqliteText,
                        .text(timestamp),
                        .text(timestamp),
                        .text(timestamp)
                    ]
                )
            }
            try database.run(
                "UPDATE threads SET read_state = 'read', unread_count = 0, last_read_at = ?, updated_at = ? WHERE id = ?",
                [.text(timestamp), .text(timestamp), .text(threadId)]
            )
        }
        let readState = try getThreadReadState(id)
        eventBus.emit(.threadUpdated, try getThread(threadId))
        return readState
    }

    @discardableResult
    public func createThreadWrapUpReport(
        threadId: String,
        sessionId: String?,
        status: ThreadWrapUpStatus = .pending,
        title: String? = nil,
        markdown: String? = nil,
        summary: String? = nil,
        metadata: JSONRecord = [:],
        messageCount: Int = 0,
        provider: String? = nil,
        model: String? = nil,
        error: JSONRecord? = nil
    ) throws -> ThreadWrapUpReport {
        let thread = try getThread(threadId)
        if let sessionId {
            let session = try getChatSession(sessionId)
            guard session.threadId == threadId else {
                throw RelayError(.invalidInput, "Wrap-up session does not belong to this thread.")
            }
        }
        let id = createRelayId("twr")
        let timestamp = nowIso()
        try database.run(
            """
            INSERT INTO thread_wrap_up_reports (
              id, thread_id, session_id, workspace_id, status, title, markdown, summary,
              metadata_json, message_count, provider, model, error_json, completed_at, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                .text(id),
                .text(threadId),
                sessionId.sqliteText,
                .text(thread.workspaceId),
                .text(status.rawValue),
                title.sqliteText,
                markdown.sqliteText,
                summary.sqliteText,
                .text(encodeJSONRecord(redactRecord(metadata))),
                .integer(Int64(max(messageCount, 0))),
                provider.sqliteText,
                model.sqliteText,
                error.map { encodeJSONRecord(redactRecord($0)) }.sqliteText,
                (status == .completed ? timestamp : nil).sqliteText,
                .text(timestamp),
                .text(timestamp)
            ]
        )
        try database.run(
            "UPDATE threads SET latest_wrap_up_report_id = ?, updated_at = ? WHERE id = ?",
            [.text(id), .text(timestamp), .text(threadId)]
        )
        let report = try getThreadWrapUpReport(id)
        eventBus.emit(.threadUpdated, try getThread(threadId))
        return report
    }

    @discardableResult
    public func archiveThreadWrapUpReport(id: String, archivedAt: IsoTimestamp? = nil) throws -> ThreadWrapUpReport {
        let report = try getThreadWrapUpReport(id)
        let timestamp = archivedAt ?? nowIso()
        try database.run(
            """
            UPDATE thread_wrap_up_reports
            SET archived_at = COALESCE(archived_at, ?), updated_at = ?
            WHERE id = ?
            """,
            [.text(timestamp), .text(timestamp), .text(report.id)]
        )
        let archived = try getThreadWrapUpReport(id)
        eventBus.emit(.threadUpdated, try getThread(report.threadId))
        return archived
    }

    @discardableResult
    public func markThreadWrapUpRetryAttempted(id: String, retryAt: IsoTimestamp? = nil) throws -> ThreadWrapUpReport {
        let report = try getThreadWrapUpReport(id)
        let timestamp = retryAt ?? nowIso()
        try database.run(
            """
            UPDATE thread_wrap_up_reports
            SET retry_count = retry_count + 1, last_retry_at = ?, updated_at = ?
            WHERE id = ?
            """,
            [.text(timestamp), .text(timestamp), .text(report.id)]
        )
        let retried = try getThreadWrapUpReport(id)
        eventBus.emit(.threadUpdated, try getThread(report.threadId))
        return retried
    }

    @discardableResult
    public func saveInsightsReportSnapshot(_ snapshot: InsightsReportSnapshot) throws -> InsightsReportSnapshot {
        _ = try getWorkspace(snapshot.workspaceId)
        let sanitized = InsightsReportSnapshot(
            id: snapshot.id,
            workspaceId: snapshot.workspaceId,
            title: try requireNonEmptyString(redactString(snapshot.title), field: "Snapshot title", maxLength: 180),
            summary: try requireNonEmptyString(redactString(snapshot.summary), field: "Snapshot summary", maxLength: 500),
            snapshotType: try requireNonEmptyString(snapshot.snapshotType, field: "Snapshot type", maxLength: 80),
            periodLabel: snapshot.periodLabel.map(redactString),
            rangeStart: snapshot.rangeStart,
            rangeEnd: snapshot.rangeEnd,
            payload: redactRecord(snapshot.payload),
            archivedAt: snapshot.archivedAt,
            createdAt: snapshot.createdAt,
            updatedAt: snapshot.updatedAt,
            redactionStatus: "private-state-excluded"
        )
        try database.run(
            """
            INSERT OR REPLACE INTO insights_report_snapshots (
              id, workspace_id, title, summary, snapshot_type, period_label,
              range_start, range_end, payload_json, archived_at, created_at,
              updated_at, redaction_status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                .text(sanitized.id),
                .text(sanitized.workspaceId),
                .text(sanitized.title),
                .text(sanitized.summary),
                .text(sanitized.snapshotType),
                sanitized.periodLabel.sqliteText,
                sanitized.rangeStart.sqliteText,
                sanitized.rangeEnd.sqliteText,
                .text(encodeJSONRecord(sanitized.payload)),
                sanitized.archivedAt.sqliteText,
                .text(sanitized.createdAt),
                .text(sanitized.updatedAt),
                .text(sanitized.redactionStatus)
            ]
        )
        return try getInsightsReportSnapshot(sanitized.id)
    }

    public func listInsightsReportSnapshots(workspaceId: String, includeArchived: Bool = false, limit: Int = 200) throws -> [InsightsReportSnapshot] {
        _ = try getWorkspace(workspaceId)
        var params: [SQLiteValue] = [.text(workspaceId)]
        var archiveClause = ""
        if !includeArchived {
            archiveClause = " AND archived_at IS NULL"
        }
        params.append(.integer(Int64(min(max(limit, 1), 500))))
        return try database
            .all(
                """
                SELECT * FROM insights_report_snapshots
                WHERE workspace_id = ?\(archiveClause)
                ORDER BY updated_at DESC, created_at DESC
                LIMIT ?
                """,
                params
            )
            .map(mapInsightsReportSnapshot)
    }

    public func getInsightsReportSnapshot(_ id: String) throws -> InsightsReportSnapshot {
        guard let row = try database.get("SELECT * FROM insights_report_snapshots WHERE id = ?", [.text(id)]) else {
            throw RelayError(.notFound, "Insights report snapshot was not found.")
        }
        return try mapInsightsReportSnapshot(row)
    }

    @discardableResult
    public func archiveInsightsReportSnapshot(id: String, archivedAt: IsoTimestamp? = nil) throws -> InsightsReportSnapshot {
        let snapshot = try getInsightsReportSnapshot(id)
        let timestamp = archivedAt ?? nowIso()
        try database.run(
            """
            UPDATE insights_report_snapshots
            SET archived_at = COALESCE(archived_at, ?), updated_at = ?
            WHERE id = ?
            """,
            [.text(timestamp), .text(timestamp), .text(snapshot.id)]
        )
        return try getInsightsReportSnapshot(id)
    }

    public func createRuntimeSession(threadId: String, agentId: String, runtimeBindingId: String) throws -> RuntimeSession {
        if let existing = try database.get(
            "SELECT * FROM runtime_sessions WHERE thread_id = ? AND agent_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1",
            [.text(threadId), .text(agentId)]
        ) {
            return try mapRuntimeSession(existing)
        }
        let id = createRelayId("rts")
        let timestamp = nowIso()
        try database.run(
            """
            INSERT INTO runtime_sessions (id, thread_id, agent_id, runtime_binding_id, external_session_id, status, metadata_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, NULL, 'active', '{}', ?, ?)
            """,
            [.text(id), .text(threadId), .text(agentId), .text(runtimeBindingId), .text(timestamp), .text(timestamp)]
        )
        guard let row = try database.get("SELECT * FROM runtime_sessions WHERE id = ?", [.text(id)]) else {
            throw RelayError(.internalError, "Created runtime session could not be reloaded.")
        }
        return try mapRuntimeSession(row)
    }

    public func getRuntimeSession(_ id: String) throws -> RuntimeSession {
        guard let row = try database.get("SELECT * FROM runtime_sessions WHERE id = ?", [.text(id)]) else {
            throw RelayError(.notFound, "Runtime session not found.")
        }
        return try mapRuntimeSession(row)
    }

    public func updateRuntimeSessionExternalSessionId(_ id: String, externalSessionId: String?, metadata: JSONRecord? = nil) throws -> RuntimeSession {
        let timestamp = nowIso()
        if let metadata {
            try database.run(
                "UPDATE runtime_sessions SET external_session_id = ?, metadata_json = ?, updated_at = ? WHERE id = ?",
                [externalSessionId.sqliteText, .text(encodeJSONRecord(metadata)), .text(timestamp), .text(id)]
            )
        } else {
            try database.run(
                "UPDATE runtime_sessions SET external_session_id = ?, updated_at = ? WHERE id = ?",
                [externalSessionId.sqliteText, .text(timestamp), .text(id)]
            )
        }
        return try getRuntimeSession(id)
    }

    @discardableResult
    public func wrapActiveRuntimeSessions(threadId: String) throws -> Int {
        let timestamp = nowIso()
        return try database.run(
            "UPDATE runtime_sessions SET status = 'wrapped', updated_at = ? WHERE thread_id = ? AND status = 'active'",
            [.text(timestamp), .text(threadId)]
        )
    }

    public func createDispatch(threadId: String, messageId: String, agentId: String, harnessId: String, sessionId: String, correlationId: String, inputSnapshot: JSONRecord) throws -> RuntimeDispatch {
        let id = createRelayId("rtd")
        let timestamp = nowIso()
        try database.run(
            """
            INSERT INTO runtime_dispatches (
              id, thread_id, message_id, agent_id, harness_id, session_id, status, correlation_id,
              input_snapshot_json, result_snapshot_json, error_snapshot_json, started_at, completed_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, 'queued', ?, ?, NULL, NULL, NULL, NULL, ?, ?)
            """,
            [.text(id), .text(threadId), .text(messageId), .text(agentId), .text(harnessId), .text(sessionId), .text(correlationId), .text(encodeJSONRecord(redactRecord(inputSnapshot))), .text(timestamp), .text(timestamp)]
        )
        return try getDispatch(id)
    }

    public func getDispatch(_ dispatchId: String) throws -> RuntimeDispatch {
        guard let row = try database.get("SELECT * FROM runtime_dispatches WHERE id = ?", [.text(dispatchId)]) else {
            throw RelayError(.notFound, "Dispatch was not found.")
        }
        return try mapRuntimeDispatch(row)
    }

    public func listDispatchesForThread(_ threadId: String) throws -> [RuntimeDispatch] {
        _ = try getThread(threadId)
        return try database
            .all("SELECT * FROM runtime_dispatches WHERE thread_id = ? ORDER BY created_at ASC", [.text(threadId)])
            .map(mapRuntimeDispatch)
    }

    public func updateDispatch(dispatchId: String, status: DispatchStatus, resultSnapshot: JSONRecord? = nil, errorSnapshot: JSONRecord? = nil) throws -> RuntimeDispatch {
        let current = try getDispatch(dispatchId)
        let timestamp = nowIso()
        let startedAt = current.startedAt ?? ((status == .started || status == .streaming) ? timestamp : nil)
        let completedAt = [.completed, .failed, .cancelled].contains(status) ? timestamp : current.completedAt
        try database.run(
            """
            UPDATE runtime_dispatches
            SET status = ?, result_snapshot_json = ?, error_snapshot_json = ?, started_at = ?, completed_at = ?, updated_at = ?
            WHERE id = ?
            """,
            [
                .text(status.rawValue),
                (resultSnapshot ?? current.resultSnapshot).map { encodeJSONRecord(redactRecord($0)) }.sqliteText,
                (errorSnapshot ?? current.errorSnapshot).map { encodeJSONRecord(redactRecord($0)) }.sqliteText,
                startedAt.sqliteText,
                completedAt.sqliteText,
                .text(timestamp),
                .text(dispatchId)
            ]
        )
        let updated = try getDispatch(dispatchId)
        eventBus.emit(.dispatchUpdated, updated)
        return updated
    }

    @discardableResult
    public func log(
        severity: String,
        category: String,
        message: String,
        correlationId: String? = nil,
        dispatchId: String? = nil,
        harnessId: String? = nil,
        threadId: String? = nil,
        detail: JSONRecord = [:]
    ) throws -> LogEvent {
        let event = LogEvent(
            id: createRelayId("evt"),
            timestamp: nowIso(),
            severity: severity,
            category: category,
            message: redactString(message),
            correlationId: correlationId,
            dispatchId: dispatchId,
            harnessId: harnessId,
            threadId: threadId,
            detail: redactRecord(detail)
        )
        try database.run(
            """
            INSERT INTO event_log (id, timestamp, severity, category, message, correlation_id, dispatch_id, harness_id, thread_id, detail_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [.text(event.id), .text(event.timestamp), .text(event.severity), .text(event.category), .text(event.message), event.correlationId.sqliteText, event.dispatchId.sqliteText, event.harnessId.sqliteText, event.threadId.sqliteText, .text(encodeJSONRecord(event.detail))]
        )
        _ = try? mirrorAuditLogEvent(event)
        return event
    }

    public func queryEventLog(limit: Int = 200) throws -> [LogEvent] {
        try database
            .all("SELECT * FROM event_log ORDER BY timestamp DESC LIMIT ?", [.integer(Int64(min(max(limit, 1), 1000)))])
            .map(mapLogEvent)
    }

    @discardableResult
    public func saveAuditLogRecord(_ record: AuditLogRecord) throws -> AuditLogRecord {
        let sanitized = sanitizeAuditLogRecord(record)
        let recordJSON = encodeJSONString(sanitized) ?? "{}"
        try database.run(
            """
            INSERT INTO audit_log_records (
              id, workspace_id, actor_id, actor_type, event_type, resource_type,
              resource_id, severity, message, correlation_id, task_id,
              approval_id, action_run_id, dispatch_id, thread_id, harness_id,
              source, context_json, write_status, record_json, created_at,
              redaction_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              workspace_id = excluded.workspace_id,
              actor_id = excluded.actor_id,
              actor_type = excluded.actor_type,
              event_type = excluded.event_type,
              resource_type = excluded.resource_type,
              resource_id = excluded.resource_id,
              severity = excluded.severity,
              message = excluded.message,
              correlation_id = excluded.correlation_id,
              task_id = excluded.task_id,
              approval_id = excluded.approval_id,
              action_run_id = excluded.action_run_id,
              dispatch_id = excluded.dispatch_id,
              thread_id = excluded.thread_id,
              harness_id = excluded.harness_id,
              source = excluded.source,
              context_json = excluded.context_json,
              write_status = excluded.write_status,
              record_json = excluded.record_json,
              created_at = excluded.created_at,
              redaction_status = excluded.redaction_status
            """,
            [
                .text(sanitized.id),
                .text(sanitized.workspaceId),
                .text(sanitized.actorId),
                .text(sanitized.actorType),
                .text(sanitized.eventType),
                .text(sanitized.resourceType),
                sanitized.resourceId.sqliteText,
                .text(sanitized.severity),
                .text(sanitized.message),
                sanitized.correlationId.sqliteText,
                sanitized.taskId.sqliteText,
                sanitized.approvalId.sqliteText,
                sanitized.actionRunId.sqliteText,
                sanitized.dispatchId.sqliteText,
                sanitized.threadId.sqliteText,
                sanitized.harnessId.sqliteText,
                .text(sanitized.source),
                .text(encodeJSONRecord(sanitized.context)),
                .text(sanitized.writeStatus),
                .text(recordJSON),
                .text(sanitized.createdAt),
                .text(sanitized.redactionStatus)
            ]
        )
        eventBus.emit(.auditLogUpdated, sanitized)
        return sanitized
    }

    public func listAuditLogRecords(
        workspaceId: RelayId,
        limit: Int = 100,
        offset: Int = 0,
        eventType: String? = nil,
        resourceType: String? = nil,
        resourceId: RelayId? = nil,
        severity: String? = nil,
        from: IsoTimestamp? = nil,
        to: IsoTimestamp? = nil
    ) throws -> [AuditLogRecord] {
        var filters = ["workspace_id = ?"]
        var params: [SQLiteValue] = [.text(workspaceId)]
        appendAuditFilters(
            filters: &filters,
            params: &params,
            eventType: eventType,
            resourceType: resourceType,
            resourceId: resourceId,
            severity: severity,
            from: from,
            to: to
        )
        params.append(.integer(Int64(min(max(limit, 1), 500))))
        params.append(.integer(Int64(max(offset, 0))))
        return try database.all(
            """
            SELECT record_json FROM audit_log_records
            WHERE \(filters.joined(separator: " AND "))
            ORDER BY created_at DESC, id DESC
            LIMIT ? OFFSET ?
            """,
            params
        ).compactMap { decodeJSON(AuditLogRecord.self, from: $0["record_json"]?.string) }
    }

    public func countAuditLogRecords(
        workspaceId: RelayId,
        eventType: String? = nil,
        resourceType: String? = nil,
        resourceId: RelayId? = nil,
        severity: String? = nil,
        from: IsoTimestamp? = nil,
        to: IsoTimestamp? = nil
    ) throws -> Int {
        var filters = ["workspace_id = ?"]
        var params: [SQLiteValue] = [.text(workspaceId)]
        appendAuditFilters(
            filters: &filters,
            params: &params,
            eventType: eventType,
            resourceType: resourceType,
            resourceId: resourceId,
            severity: severity,
            from: from,
            to: to
        )
        let row = try database.get(
            "SELECT COUNT(*) AS count FROM audit_log_records WHERE \(filters.joined(separator: " AND "))",
            params
        )
        return row?["count"]?.int ?? 0
    }

    @discardableResult
    public func saveSecurityMetricSnapshot(_ snapshot: SecurityMetricSnapshot) throws -> SecurityMetricSnapshot {
        let sanitized = sanitizeSecurityMetricSnapshot(snapshot)
        let snapshotJSON = encodeJSONString(sanitized) ?? "{}"
        try database.run(
            """
            INSERT INTO security_metric_snapshots (
              id, workspace_id, window_started_at, window_ended_at, generated_at,
              audit_event_count, denied_action_count, permission_denied_count,
              approval_decision_count, policy_mutation_count,
              task_transition_count, tool_request_transition_count,
              command_rejection_count, high_risk_execution_count,
              file_permission_change_count, export_reset_attempt_count,
              recovery_event_count, audit_write_failure_count,
              redaction_applied_count, category_counts_json, snapshot_json,
              redaction_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              workspace_id = excluded.workspace_id,
              window_started_at = excluded.window_started_at,
              window_ended_at = excluded.window_ended_at,
              generated_at = excluded.generated_at,
              audit_event_count = excluded.audit_event_count,
              denied_action_count = excluded.denied_action_count,
              permission_denied_count = excluded.permission_denied_count,
              approval_decision_count = excluded.approval_decision_count,
              policy_mutation_count = excluded.policy_mutation_count,
              task_transition_count = excluded.task_transition_count,
              tool_request_transition_count = excluded.tool_request_transition_count,
              command_rejection_count = excluded.command_rejection_count,
              high_risk_execution_count = excluded.high_risk_execution_count,
              file_permission_change_count = excluded.file_permission_change_count,
              export_reset_attempt_count = excluded.export_reset_attempt_count,
              recovery_event_count = excluded.recovery_event_count,
              audit_write_failure_count = excluded.audit_write_failure_count,
              redaction_applied_count = excluded.redaction_applied_count,
              category_counts_json = excluded.category_counts_json,
              snapshot_json = excluded.snapshot_json,
              redaction_status = excluded.redaction_status
            """,
            [
                .text(sanitized.id),
                .text(sanitized.workspaceId),
                sanitized.windowStartedAt.sqliteText,
                sanitized.windowEndedAt.sqliteText,
                .text(sanitized.generatedAt),
                .integer(Int64(sanitized.auditEventCount)),
                .integer(Int64(sanitized.deniedActionCount)),
                .integer(Int64(sanitized.permissionDeniedCount)),
                .integer(Int64(sanitized.approvalDecisionCount)),
                .integer(Int64(sanitized.policyMutationCount)),
                .integer(Int64(sanitized.taskTransitionCount)),
                .integer(Int64(sanitized.toolRequestTransitionCount)),
                .integer(Int64(sanitized.commandRejectionCount)),
                .integer(Int64(sanitized.highRiskExecutionCount)),
                .integer(Int64(sanitized.filePermissionChangeCount)),
                .integer(Int64(sanitized.exportResetAttemptCount)),
                .integer(Int64(sanitized.recoveryEventCount)),
                .integer(Int64(sanitized.auditWriteFailureCount)),
                .integer(Int64(sanitized.redactionAppliedCount)),
                .text(encodeJSONRecord(sanitized.categoryCounts)),
                .text(snapshotJSON),
                .text(sanitized.redactionStatus)
            ]
        )
        eventBus.emit(.securityMetricsUpdated, sanitized)
        return sanitized
    }

    public func latestSecurityMetricSnapshot(workspaceId: RelayId) throws -> SecurityMetricSnapshot? {
        try database.get(
            """
            SELECT snapshot_json FROM security_metric_snapshots
            WHERE workspace_id = ?
            ORDER BY generated_at DESC, id DESC
            LIMIT 1
            """,
            [.text(workspaceId)]
        ).flatMap { decodeJSON(SecurityMetricSnapshot.self, from: $0["snapshot_json"]?.string) }
    }

    @discardableResult
    public func saveRuntimeDashboardSnapshot(_ snapshot: RuntimeDashboardSnapshot) throws -> RuntimeDashboardSnapshot {
        let timestamp = nowIso()
        let snapshotJSON = encodeJSONString(snapshot) ?? "{}"
        let errorJSON: String? = snapshot.errorMessage.map { message in
            encodeJSONRecord([
                "message": .string(redactString(message)),
                "retryAvailable": .bool(snapshot.retryAvailable),
                "redactionStatus": .string("redacted")
            ])
        }
        try database.transaction {
            try database.run(
                """
                INSERT OR REPLACE INTO runtime_dashboard_snapshots (
                  id, workspace_id, state, refreshed_at, last_successful_refresh_at,
                  stale_after_seconds, local_status_state, local_status_reason,
                  disabled_reason, error_json, retry_available, read_only,
                  snapshot_json, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    .text(snapshot.id),
                    .text(snapshot.workspaceId),
                    .text(snapshot.state.rawValue),
                    .text(snapshot.refreshedAt),
                    snapshot.lastSuccessfulRefreshAt.sqliteText,
                    .integer(Int64(snapshot.staleAfterSeconds)),
                    .text(snapshot.localStatusState.rawValue),
                    .text(snapshot.localStatusReason),
                    snapshot.disabledReason.sqliteText,
                    errorJSON.sqliteText,
                    .integer(snapshot.retryAvailable ? 1 : 0),
                    .integer(snapshot.readOnly ? 1 : 0),
                    .text(snapshotJSON),
                    .text(timestamp),
                    .text(timestamp)
                ]
            )
            try database.run("DELETE FROM runtime_dashboard_rows WHERE snapshot_id = ?", [.text(snapshot.id)])
            for row in snapshot.rows {
                let rowJSON = encodeJSONString(row) ?? "{}"
                try database.run(
                    """
                    INSERT INTO runtime_dashboard_rows (
                      id, snapshot_id, workspace_id, row_kind, runtime_type, harness_id,
                      connected_app_id, display_name, status, reachability,
                      active_dispatch_count, failed_dispatch_count, retryable_dispatch_count,
                      assigned_agent_count, latest_dispatch_id, last_activity_at,
                      row_json, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    [
                        .text(row.id),
                        .text(snapshot.id),
                        .text(snapshot.workspaceId),
                        .text(row.kind.rawValue),
                        row.runtimeType.map(\.rawValue).sqliteText,
                        row.harnessId.sqliteText,
                        row.connectedAppId.sqliteText,
                        .text(row.displayName),
                        .text(row.status.rawValue),
                        .text(row.reachability.rawValue),
                        .integer(Int64(row.activeDispatchCount)),
                        .integer(Int64(row.failedDispatchCount)),
                        .integer(Int64(row.retryableDispatchCount)),
                        .integer(Int64(row.assignedAgents.count)),
                        row.latestDispatchId.sqliteText,
                        row.lastActivityAt.sqliteText,
                        .text(rowJSON),
                        .text(timestamp),
                        .text(timestamp)
                    ]
                )
            }
            try database.run(
                "DELETE FROM runtime_dashboard_snapshots WHERE workspace_id=? AND id NOT IN (SELECT id FROM runtime_dashboard_snapshots WHERE workspace_id=? ORDER BY refreshed_at DESC,id DESC LIMIT 25)",
                [.text(snapshot.workspaceId), .text(snapshot.workspaceId)]
            )
        }
        return snapshot
    }

    public func latestRuntimeDashboardSnapshot(workspaceId: String) throws -> RuntimeDashboardSnapshot? {
        guard let row = try database.get(
            """
            SELECT snapshot_json FROM runtime_dashboard_snapshots
            WHERE workspace_id = ?
            ORDER BY refreshed_at DESC, updated_at DESC
            LIMIT 1
            """,
            [.text(workspaceId)]
        ) else {
            return nil
        }
        return decodeJSON(RuntimeDashboardSnapshot.self, from: row["snapshot_json"]?.string)
    }

    @discardableResult
    public func upsertRuntimeActionCapability(_ capability: RuntimeActionCapability) throws -> RuntimeActionCapability {
        let timestamp = nowIso()
        var sanitized = capability
        sanitized.message = redactString(capability.message)
        sanitized.recovery = capability.recovery.map(redactString)
        sanitized.redactionStatus = "private-state-excluded"
        let capabilityJSON = encodeJSONString(sanitized) ?? "{}"
        try database.run(
            """
            INSERT OR REPLACE INTO runtime_action_capabilities (
              id, workspace_id, action_kind, display_name, availability,
              state_kind, reason_code, message, recovery, scope_type,
              runtime_type, harness_id, dispatch_id, agent_id, destructive,
              dry_run_supported, execution_supported, read_only,
              stale_after_seconds, evaluated_at, source, redaction_status,
              capability_json, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                .text(sanitized.id),
                .text(sanitized.workspaceId),
                .text(sanitized.kind.rawValue),
                .text(sanitized.displayName),
                .text(sanitized.availability.rawValue),
                .text(sanitized.stateKind.rawValue),
                .text(sanitized.reasonCode.rawValue),
                .text(sanitized.message),
                sanitized.recovery.sqliteText,
                .text(sanitized.scopeType.rawValue),
                sanitized.runtimeType.map(\.rawValue).sqliteText,
                sanitized.harnessId.sqliteText,
                sanitized.dispatchId.sqliteText,
                sanitized.agentId.sqliteText,
                .integer(sanitized.destructive ? 1 : 0),
                .integer(sanitized.dryRunSupported ? 1 : 0),
                .integer(sanitized.executionSupported ? 1 : 0),
                .integer(sanitized.readOnly ? 1 : 0),
                .integer(Int64(sanitized.staleAfterSeconds)),
                .text(sanitized.evaluatedAt),
                .text(sanitized.source),
                .text(sanitized.redactionStatus),
                .text(capabilityJSON),
                .text(timestamp),
                .text(timestamp)
            ]
        )
        return sanitized
    }

    @discardableResult
    public func saveRuntimeActionCapabilities(_ capabilities: [RuntimeActionCapability]) throws -> [RuntimeActionCapability] {
        try database.transaction {
            for capability in capabilities {
                _ = try upsertRuntimeActionCapability(capability)
            }
        }
        return capabilities
    }

    public func listRuntimeActionCapabilities(workspaceId: String, limit: Int = 100) throws -> [RuntimeActionCapability] {
        try database
            .all(
                """
                SELECT capability_json FROM runtime_action_capabilities
                WHERE workspace_id = ?
                ORDER BY updated_at DESC
                LIMIT ?
                """,
                [.text(workspaceId), .integer(Int64(min(max(limit, 1), 500)))]
            )
            .compactMap { decodeJSON(RuntimeActionCapability.self, from: $0["capability_json"]?.string) }
    }

    @discardableResult
    public func createRuntimeActionRun(_ run: RuntimeActionRun) throws -> RuntimeActionRun {
        if let existing = try database.get(
            """
            SELECT action_run_json FROM runtime_action_runs
            WHERE workspace_id = ? AND action_kind = ? AND idempotency_key = ?
            LIMIT 1
            """,
            [.text(run.workspaceId), .text(run.kind.rawValue), .text(run.idempotencyKey)]
        ).flatMap({ decodeJSON(RuntimeActionRun.self, from: $0["action_run_json"]?.string) }) {
            return existing
        }

        var sanitized = run
        sanitized.request = redactProvisioningRecord(run.request)
        sanitized.result = run.result.map(redactProvisioningRecord)
        sanitized.failure = run.failure.map(redactProvisioningRecord)
        sanitized.redactionStatus = "private-state-excluded"
        let actionRunJSON = encodeJSONString(sanitized) ?? "{}"
        try database.run(
            """
            INSERT INTO runtime_action_runs (
              id, workspace_id, capability_id, action_kind, status, state_kind,
              reason_code, idempotency_key, actor_id, scope_type, runtime_type,
              harness_id, dispatch_id, agent_id, destructive, dry_run,
              execution_attempted, request_json, result_json, failure_json,
              retention_expires_at, action_run_json, created_at, updated_at,
              completed_at, redaction_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                .text(sanitized.id),
                .text(sanitized.workspaceId),
                sanitized.capabilityId.sqliteText,
                .text(sanitized.kind.rawValue),
                .text(sanitized.status.rawValue),
                .text(sanitized.stateKind.rawValue),
                .text(sanitized.reasonCode.rawValue),
                .text(sanitized.idempotencyKey),
                .text(sanitized.actorId),
                .text(sanitized.scopeType.rawValue),
                sanitized.runtimeType.map(\.rawValue).sqliteText,
                sanitized.harnessId.sqliteText,
                sanitized.dispatchId.sqliteText,
                sanitized.agentId.sqliteText,
                .integer(sanitized.destructive ? 1 : 0),
                .integer(sanitized.dryRun ? 1 : 0),
                .integer(sanitized.executionAttempted ? 1 : 0),
                .text(encodeJSONRecord(sanitized.request)),
                sanitized.result.map(encodeJSONRecord).sqliteText,
                sanitized.failure.map(encodeJSONRecord).sqliteText,
                sanitized.retentionExpiresAt.sqliteText,
                .text(actionRunJSON),
                .text(sanitized.createdAt),
                .text(sanitized.updatedAt),
                sanitized.completedAt.sqliteText,
                .text(sanitized.redactionStatus)
            ]
        )
        return sanitized
    }

    public func getRuntimeActionRun(_ id: RelayId) throws -> RuntimeActionRun {
        guard let row = try database.get("SELECT action_run_json FROM runtime_action_runs WHERE id = ?", [.text(id)]),
              let run = decodeJSON(RuntimeActionRun.self, from: row["action_run_json"]?.string)
        else {
            throw RelayError(.notFound, "Runtime action run was not found.")
        }
        return run
    }

    public func listRuntimeActionRuns(workspaceId: String, limit: Int = 50) throws -> [RuntimeActionRun] {
        try database
            .all(
                """
                SELECT action_run_json FROM runtime_action_runs
                WHERE workspace_id = ?
                ORDER BY updated_at DESC
                LIMIT ?
                """,
                [.text(workspaceId), .integer(Int64(min(max(limit, 1), 500)))]
            )
            .compactMap { decodeJSON(RuntimeActionRun.self, from: $0["action_run_json"]?.string) }
    }

    @discardableResult
    public func trimRuntimeActionRuns(workspaceId: String, keepLatest: Int) throws -> Int {
        let keep = max(keepLatest, 0)
        let rows = try database.all(
            """
            SELECT id FROM runtime_action_runs
            WHERE workspace_id = ?
            ORDER BY updated_at DESC
            LIMIT -1 OFFSET ?
            """,
            [.text(workspaceId), .integer(Int64(keep))]
        )
        let ids = rows.compactMap { $0["id"]?.string }
        for id in ids {
            try database.run("DELETE FROM runtime_action_runs WHERE id = ?", [.text(id)])
        }
        return ids.count
    }

    @discardableResult
    public func saveRuntimeStructuredJob(_ job: RuntimeStructuredJob) throws -> RuntimeStructuredJob {
        var sanitized = job
        sanitized.followUpFailure = job.followUpFailure.map(redactProvisioningRecord)
        sanitized.recovery = redactProvisioningRecord(job.recovery)
        sanitized.metadata = redactProvisioningRecord(job.metadata)
        sanitized.redactionStatus = "private-state-excluded"
        let jobJSON = encodeJSONString(sanitized) ?? "{}"
        try database.run(
            """
            INSERT OR REPLACE INTO runtime_structured_jobs (
              id, workspace_id, dispatch_id, action_run_id, job_type, status,
              title, retryable, context_usage_json, participant_health_json,
              follow_up_failure_json, recovery_json, source_host_excluded,
              metadata_json, structured_job_json, created_at, updated_at,
              completed_at, redaction_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                .text(sanitized.id),
                .text(sanitized.workspaceId),
                sanitized.dispatchId.sqliteText,
                sanitized.actionRunId.sqliteText,
                .text(sanitized.jobType),
                .text(sanitized.status.rawValue),
                .text(redactString(sanitized.title)),
                .integer(sanitized.retryable ? 1 : 0),
                encodeJSONString(sanitized.contextUsage).sqliteText,
                .text(encodeJSONString(sanitized.participantHealth) ?? "[]"),
                sanitized.followUpFailure.map(encodeJSONRecord).sqliteText,
                .text(encodeJSONRecord(sanitized.recovery)),
                .integer(sanitized.sourceHostExcluded ? 1 : 0),
                .text(encodeJSONRecord(sanitized.metadata)),
                .text(jobJSON),
                .text(sanitized.createdAt),
                .text(sanitized.updatedAt),
                sanitized.completedAt.sqliteText,
                .text(sanitized.redactionStatus)
            ]
        )
        eventBus.emit(.runtimeStructuredJobUpdated, sanitized)
        return sanitized
    }

    public func listRuntimeStructuredJobs(workspaceId: String, limit: Int = 100) throws -> [RuntimeStructuredJob] {
        try database
            .all(
                """
                SELECT structured_job_json FROM runtime_structured_jobs
                WHERE workspace_id = ?
                ORDER BY updated_at DESC
                LIMIT ?
                """,
                [.text(workspaceId), .integer(Int64(min(max(limit, 1), 500)))]
            )
            .compactMap { decodeJSON(RuntimeStructuredJob.self, from: $0["structured_job_json"]?.string) }
    }

    @discardableResult
    public func saveRuntimeMissingToolEvent(_ event: RuntimeMissingToolEvent) throws -> RuntimeMissingToolEvent {
        var sanitized = event
        sanitized.request = redactProvisioningRecord(event.request)
        sanitized.redactionStatus = "private-state-excluded"
        let eventJSON = encodeJSONString(sanitized) ?? "{}"
        try database.run(
            """
            INSERT OR REPLACE INTO runtime_missing_tool_events (
              id, workspace_id, dispatch_id, agent_id, tool_name, status,
              request_json, auto_install_attempted, fake_grant_created, source,
              missing_tool_json, created_at, updated_at, redaction_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                .text(sanitized.id),
                .text(sanitized.workspaceId),
                sanitized.dispatchId.sqliteText,
                sanitized.agentId.sqliteText,
                .text(redactString(sanitized.toolName)),
                .text(sanitized.status.rawValue),
                .text(encodeJSONRecord(sanitized.request)),
                .integer(sanitized.autoInstallAttempted ? 1 : 0),
                .integer(sanitized.fakeGrantCreated ? 1 : 0),
                .text(sanitized.source),
                .text(eventJSON),
                .text(sanitized.createdAt),
                .text(sanitized.updatedAt),
                .text(sanitized.redactionStatus)
            ]
        )
        eventBus.emit(.runtimeMissingToolUpdated, sanitized)
        return sanitized
    }

    public func listRuntimeMissingToolEvents(workspaceId: String, limit: Int = 100) throws -> [RuntimeMissingToolEvent] {
        try database
            .all(
                """
                SELECT missing_tool_json FROM runtime_missing_tool_events
                WHERE workspace_id = ?
                ORDER BY updated_at DESC
                LIMIT ?
                """,
                [.text(workspaceId), .integer(Int64(min(max(limit, 1), 500)))]
            )
            .compactMap { decodeJSON(RuntimeMissingToolEvent.self, from: $0["missing_tool_json"]?.string) }
    }

    @discardableResult
    public func saveRuntimeRecoveryRecord(_ record: RuntimeRecoveryRecord) throws -> RuntimeRecoveryRecord {
        var sanitized = record
        sanitized.message = redactString(record.message)
        sanitized.recovery = redactProvisioningRecord(record.recovery)
        sanitized.redactionStatus = "private-state-excluded"
        let recordJSON = encodeJSONString(sanitized) ?? "{}"
        try database.run(
            """
            INSERT OR REPLACE INTO runtime_recovery_records (
              id, workspace_id, dispatch_id, job_id, state, retryable,
              reason_code, message, follow_up_action, source_host_excluded,
              recovery_json, recovery_record_json, created_at, updated_at,
              resolved_at, redaction_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                .text(sanitized.id),
                .text(sanitized.workspaceId),
                sanitized.dispatchId.sqliteText,
                sanitized.jobId.sqliteText,
                .text(sanitized.state.rawValue),
                .integer(sanitized.retryable ? 1 : 0),
                .text(sanitized.reasonCode.rawValue),
                .text(sanitized.message),
                sanitized.followUpAction.map(redactString).sqliteText,
                .integer(sanitized.sourceHostExcluded ? 1 : 0),
                .text(encodeJSONRecord(sanitized.recovery)),
                .text(recordJSON),
                .text(sanitized.createdAt),
                .text(sanitized.updatedAt),
                sanitized.resolvedAt.sqliteText,
                .text(sanitized.redactionStatus)
            ]
        )
        eventBus.emit(.runtimeRecoveryUpdated, sanitized)
        return sanitized
    }

    public func listRuntimeRecoveryRecords(workspaceId: String, limit: Int = 100) throws -> [RuntimeRecoveryRecord] {
        try database
            .all(
                """
                SELECT recovery_record_json FROM runtime_recovery_records
                WHERE workspace_id = ?
                ORDER BY updated_at DESC
                LIMIT ?
                """,
                [.text(workspaceId), .integer(Int64(min(max(limit, 1), 500)))]
            )
            .compactMap { decodeJSON(RuntimeRecoveryRecord.self, from: $0["recovery_record_json"]?.string) }
    }

    @discardableResult
    public func saveWorkSafetyTask(_ task: WorkSafetyTaskRecord) throws -> WorkSafetyTaskRecord {
        let sanitized = sanitizeWorkSafetyTaskRecord(task)
        let taskJSON = encodeJSONString(sanitized) ?? "{}"
        try database.run(
            """
            INSERT INTO work_safety_tasks (
              id, workspace_id, title, message, task_status, target_type,
              target_id, assigned_agent_id, thread_id, runtime_binding_id,
              action_run_id, dispatch_id, structured_job_id, approval_required,
              approval_id, scheduled_message_id, source_host_record_id,
              scheduled_at, recurrence_rule, priority, risk_level, metadata_json,
              task_json, created_at, updated_at, completed_at, redaction_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              workspace_id = excluded.workspace_id,
              title = excluded.title,
              message = excluded.message,
              task_status = excluded.task_status,
              target_type = excluded.target_type,
              target_id = excluded.target_id,
              assigned_agent_id = excluded.assigned_agent_id,
              thread_id = excluded.thread_id,
              runtime_binding_id = excluded.runtime_binding_id,
              action_run_id = excluded.action_run_id,
              dispatch_id = excluded.dispatch_id,
              structured_job_id = excluded.structured_job_id,
              approval_required = excluded.approval_required,
              approval_id = excluded.approval_id,
              scheduled_message_id = excluded.scheduled_message_id,
              source_host_record_id = excluded.source_host_record_id,
              scheduled_at = excluded.scheduled_at,
              recurrence_rule = excluded.recurrence_rule,
              priority = excluded.priority,
              risk_level = excluded.risk_level,
              metadata_json = excluded.metadata_json,
              task_json = excluded.task_json,
              created_at = excluded.created_at,
              updated_at = excluded.updated_at,
              completed_at = excluded.completed_at,
              redaction_status = excluded.redaction_status
            """,
            [
                .text(sanitized.id),
                .text(sanitized.workspaceId),
                .text(sanitized.title),
                sanitized.message.sqliteText,
                .text(sanitized.status.rawValue),
                .text(sanitized.targetType.rawValue),
                sanitized.targetId.sqliteText,
                sanitized.assignedAgentId.sqliteText,
                sanitized.threadId.sqliteText,
                sanitized.runtimeBindingId.sqliteText,
                sanitized.linkedReferences.actionRunId.sqliteText,
                sanitized.linkedReferences.dispatchId.sqliteText,
                sanitized.linkedReferences.structuredJobId.sqliteText,
                .integer(sanitized.approvalRequired ? 1 : 0),
                sanitized.approvalId.sqliteText,
                sanitized.linkedReferences.scheduledMessageId.sqliteText,
                sanitized.linkedReferences.sourceHostRecordId.sqliteText,
                sanitized.scheduledAt.sqliteText,
                sanitized.recurrenceRule.sqliteText,
                .integer(Int64(sanitized.priority)),
                .text(sanitized.riskLevel.rawValue),
                .text(encodeJSONRecord(sanitized.metadata)),
                .text(taskJSON),
                .text(sanitized.createdAt),
                .text(sanitized.updatedAt),
                sanitized.completedAt.sqliteText,
                .text(sanitized.redactionStatus)
            ]
        )
        eventBus.emit(.workSafetyTaskUpdated, sanitized)
        return sanitized
    }

    public func listWorkSafetyTasks(workspaceId: RelayId, limit: Int = 100) throws -> [WorkSafetyTaskRecord] {
        try database
            .all(
                """
                SELECT task_json FROM work_safety_tasks
                WHERE workspace_id = ?
                ORDER BY updated_at DESC
                LIMIT ?
                """,
                [.text(workspaceId), .integer(Int64(min(max(limit, 1), 500)))]
            )
            .compactMap { decodeJSON(WorkSafetyTaskRecord.self, from: $0["task_json"]?.string) }
    }

    public func getWorkSafetyTask(_ taskId: RelayId) throws -> WorkSafetyTaskRecord {
        guard let row = try database.get("SELECT task_json FROM work_safety_tasks WHERE id = ?", [.text(taskId)]),
              let task = decodeJSON(WorkSafetyTaskRecord.self, from: row["task_json"]?.string)
        else {
            throw RelayError(.notFound, "Work-safety task was not found.")
        }
        return task
    }

    @discardableResult
    public func saveWorkSafetyTaskRun(_ run: WorkSafetyTaskRunRecord) throws -> WorkSafetyTaskRunRecord {
        let sanitized = sanitizeWorkSafetyTaskRunRecord(run)
        let runJSON = encodeJSONString(sanitized) ?? "{}"
        try database.run(
            """
            INSERT INTO work_safety_task_runs (
              id, workspace_id, task_id, run_status, action_run_id, dispatch_id,
              structured_job_id, attempt, started_at, completed_at,
              failure_message, metadata_json, run_json, created_at, updated_at,
              redaction_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              workspace_id = excluded.workspace_id,
              task_id = excluded.task_id,
              run_status = excluded.run_status,
              action_run_id = excluded.action_run_id,
              dispatch_id = excluded.dispatch_id,
              structured_job_id = excluded.structured_job_id,
              attempt = excluded.attempt,
              started_at = excluded.started_at,
              completed_at = excluded.completed_at,
              failure_message = excluded.failure_message,
              metadata_json = excluded.metadata_json,
              run_json = excluded.run_json,
              created_at = excluded.created_at,
              updated_at = excluded.updated_at,
              redaction_status = excluded.redaction_status
            """,
            [
                .text(sanitized.id),
                .text(sanitized.workspaceId),
                .text(sanitized.taskId),
                .text(sanitized.status.rawValue),
                sanitized.linkedReferences.actionRunId.sqliteText,
                sanitized.linkedReferences.dispatchId.sqliteText,
                sanitized.linkedReferences.structuredJobId.sqliteText,
                .integer(Int64(sanitized.attempt)),
                sanitized.startedAt.sqliteText,
                sanitized.completedAt.sqliteText,
                sanitized.failureMessage.sqliteText,
                .text(encodeJSONRecord(sanitized.metadata)),
                .text(runJSON),
                .text(sanitized.createdAt),
                .text(sanitized.updatedAt),
                .text(sanitized.redactionStatus)
            ]
        )
        eventBus.emit(.workSafetyTaskUpdated, sanitized)
        return sanitized
    }

    public func listWorkSafetyTaskRuns(workspaceId: RelayId, taskId: RelayId? = nil, limit: Int = 100) throws -> [WorkSafetyTaskRunRecord] {
        let limitValue = SQLiteValue.integer(Int64(min(max(limit, 1), 500)))
        if let taskId {
            return try database.all(
                """
                SELECT run_json FROM work_safety_task_runs
                WHERE workspace_id = ? AND task_id = ?
                ORDER BY updated_at DESC
                LIMIT ?
                """,
                [.text(workspaceId), .text(taskId), limitValue]
            ).compactMap { decodeJSON(WorkSafetyTaskRunRecord.self, from: $0["run_json"]?.string) }
        }
        return try database.all(
            """
            SELECT run_json FROM work_safety_task_runs
            WHERE workspace_id = ?
            ORDER BY updated_at DESC
            LIMIT ?
            """,
            [.text(workspaceId), limitValue]
        ).compactMap { decodeJSON(WorkSafetyTaskRunRecord.self, from: $0["run_json"]?.string) }
    }

    public func getWorkSafetyTaskRun(_ runId: RelayId) throws -> WorkSafetyTaskRunRecord {
        guard let row = try database.get("SELECT run_json FROM work_safety_task_runs WHERE id = ?", [.text(runId)]),
              let run = decodeJSON(WorkSafetyTaskRunRecord.self, from: row["run_json"]?.string)
        else {
            throw RelayError(.notFound, "Work-safety task run was not found.")
        }
        return run
    }

    @discardableResult
    public func saveWorkSafetyTaskEvent(_ event: WorkSafetyTaskEventRecord) throws -> WorkSafetyTaskEventRecord {
        let sanitized = sanitizeWorkSafetyTaskEventRecord(event)
        let eventJSON = encodeJSONString(sanitized) ?? "{}"
        try database.run(
            """
            INSERT OR REPLACE INTO work_safety_task_events (
              id, workspace_id, task_id, run_id, approval_id, event_type,
              status, detail_json, event_json, occurred_at, redaction_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                .text(sanitized.id),
                .text(sanitized.workspaceId),
                .text(sanitized.taskId),
                sanitized.runId.sqliteText,
                sanitized.approvalId.sqliteText,
                .text(sanitized.eventType.rawValue),
                .text(sanitized.status),
                .text(encodeJSONRecord(sanitized.detail)),
                .text(eventJSON),
                .text(sanitized.occurredAt),
                .text(sanitized.redactionStatus)
            ]
        )
        eventBus.emit(.workSafetyTaskUpdated, sanitized)
        return sanitized
    }

    public func listWorkSafetyTaskEvents(workspaceId: RelayId, taskId: RelayId? = nil, limit: Int = 100) throws -> [WorkSafetyTaskEventRecord] {
        let limitValue = SQLiteValue.integer(Int64(min(max(limit, 1), 500)))
        if let taskId {
            return try database.all(
                """
                SELECT event_json FROM work_safety_task_events
                WHERE workspace_id = ? AND task_id = ?
                ORDER BY occurred_at DESC
                LIMIT ?
                """,
                [.text(workspaceId), .text(taskId), limitValue]
            ).compactMap { decodeJSON(WorkSafetyTaskEventRecord.self, from: $0["event_json"]?.string) }
        }
        return try database.all(
            """
            SELECT event_json FROM work_safety_task_events
            WHERE workspace_id = ?
            ORDER BY occurred_at DESC
            LIMIT ?
            """,
            [.text(workspaceId), limitValue]
        ).compactMap { decodeJSON(WorkSafetyTaskEventRecord.self, from: $0["event_json"]?.string) }
    }

    @discardableResult
    public func saveWorkSafetyApproval(_ approval: WorkSafetyApprovalRecord) throws -> WorkSafetyApprovalRecord {
        let sanitized = sanitizeWorkSafetyApprovalRecord(approval)
        let approvalJSON = encodeJSONString(sanitized) ?? "{}"
        try database.run(
            """
            INSERT INTO work_safety_approvals (
              id, workspace_id, task_id, title, description, approval_status,
              risk_level, requested_by_agent_id, resolver_agent_id, expires_at,
              resolved_at, metadata_json, approval_json, created_at, updated_at,
              redaction_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              workspace_id = excluded.workspace_id,
              task_id = excluded.task_id,
              title = excluded.title,
              description = excluded.description,
              approval_status = excluded.approval_status,
              risk_level = excluded.risk_level,
              requested_by_agent_id = excluded.requested_by_agent_id,
              resolver_agent_id = excluded.resolver_agent_id,
              expires_at = excluded.expires_at,
              resolved_at = excluded.resolved_at,
              metadata_json = excluded.metadata_json,
              approval_json = excluded.approval_json,
              created_at = excluded.created_at,
              updated_at = excluded.updated_at,
              redaction_status = excluded.redaction_status
            """,
            [
                .text(sanitized.id),
                .text(sanitized.workspaceId),
                sanitized.taskId.sqliteText,
                .text(sanitized.title),
                sanitized.description.sqliteText,
                .text(sanitized.status.rawValue),
                .text(sanitized.riskLevel.rawValue),
                sanitized.requestedByAgentId.sqliteText,
                sanitized.resolverAgentId.sqliteText,
                sanitized.expiresAt.sqliteText,
                sanitized.resolvedAt.sqliteText,
                .text(encodeJSONRecord(sanitized.metadata)),
                .text(approvalJSON),
                .text(sanitized.createdAt),
                .text(sanitized.updatedAt),
                .text(sanitized.redactionStatus)
            ]
        )
        for step in sanitized.steps {
            try saveWorkSafetyApprovalStep(step)
        }
        for note in sanitized.notes {
            try saveWorkSafetyApprovalNote(note)
        }
        eventBus.emit(.workSafetyApprovalUpdated, sanitized)
        return sanitized
    }

    public func listWorkSafetyApprovals(workspaceId: RelayId, taskId: RelayId? = nil, limit: Int = 100) throws -> [WorkSafetyApprovalRecord] {
        let limitValue = SQLiteValue.integer(Int64(min(max(limit, 1), 500)))
        if let taskId {
            return try database.all(
                """
                SELECT approval_json FROM work_safety_approvals
                WHERE workspace_id = ? AND task_id = ?
                ORDER BY updated_at DESC
                LIMIT ?
                """,
                [.text(workspaceId), .text(taskId), limitValue]
            ).compactMap { decodeJSON(WorkSafetyApprovalRecord.self, from: $0["approval_json"]?.string) }
        }
        return try database.all(
            """
            SELECT approval_json FROM work_safety_approvals
            WHERE workspace_id = ?
            ORDER BY updated_at DESC
            LIMIT ?
            """,
            [.text(workspaceId), limitValue]
        ).compactMap { decodeJSON(WorkSafetyApprovalRecord.self, from: $0["approval_json"]?.string) }
    }

    public func getWorkSafetyApproval(_ approvalId: RelayId) throws -> WorkSafetyApprovalRecord {
        guard let row = try database.get("SELECT approval_json FROM work_safety_approvals WHERE id = ?", [.text(approvalId)]),
              let approval = decodeJSON(WorkSafetyApprovalRecord.self, from: row["approval_json"]?.string)
        else {
            throw RelayError(.notFound, "Work-safety approval was not found.")
        }
        return approval
    }

    @discardableResult
    public func saveWorkSafetyApprovalStep(_ step: WorkSafetyApprovalStepRecord) throws -> WorkSafetyApprovalStepRecord {
        let sanitized = sanitizeWorkSafetyApprovalStep(step)
        let stepJSON = encodeJSONString(sanitized) ?? "{}"
        try database.run(
            """
            INSERT OR REPLACE INTO work_safety_approval_steps (
              id, workspace_id, approval_id, label, value, step_status,
              sort_index, step_json, redaction_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                .text(sanitized.id),
                .text(sanitized.workspaceId),
                .text(sanitized.approvalId),
                .text(sanitized.label),
                sanitized.value.sqliteText,
                .text(sanitized.status.rawValue),
                .integer(Int64(sanitized.sortIndex)),
                .text(stepJSON),
                .text(sanitized.redactionStatus)
            ]
        )
        eventBus.emit(.workSafetyApprovalUpdated, sanitized)
        return sanitized
    }

    public func listWorkSafetyApprovalSteps(workspaceId: RelayId, approvalId: RelayId, limit: Int = 100) throws -> [WorkSafetyApprovalStepRecord] {
        try database
            .all(
                """
                SELECT step_json FROM work_safety_approval_steps
                WHERE workspace_id = ? AND approval_id = ?
                ORDER BY sort_index ASC
                LIMIT ?
                """,
                [.text(workspaceId), .text(approvalId), .integer(Int64(min(max(limit, 1), 500)))]
            )
            .compactMap { decodeJSON(WorkSafetyApprovalStepRecord.self, from: $0["step_json"]?.string) }
    }

    @discardableResult
    public func saveWorkSafetyApprovalNote(_ note: WorkSafetyApprovalNoteRecord) throws -> WorkSafetyApprovalNoteRecord {
        let sanitized = sanitizeWorkSafetyApprovalNote(note)
        let noteJSON = encodeJSONString(sanitized) ?? "{}"
        try database.run(
            """
            INSERT OR REPLACE INTO work_safety_approval_notes (
              id, workspace_id, approval_id, author_agent_id, note, note_json,
              created_at, redaction_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                .text(sanitized.id),
                .text(sanitized.workspaceId),
                .text(sanitized.approvalId),
                sanitized.authorAgentId.sqliteText,
                .text(sanitized.note),
                .text(noteJSON),
                .text(sanitized.createdAt),
                .text(sanitized.redactionStatus)
            ]
        )
        eventBus.emit(.workSafetyApprovalUpdated, sanitized)
        return sanitized
    }

    public func listWorkSafetyApprovalNotes(workspaceId: RelayId, approvalId: RelayId, limit: Int = 100) throws -> [WorkSafetyApprovalNoteRecord] {
        try database
            .all(
                """
                SELECT note_json FROM work_safety_approval_notes
                WHERE workspace_id = ? AND approval_id = ?
                ORDER BY created_at DESC
                LIMIT ?
                """,
                [.text(workspaceId), .text(approvalId), .integer(Int64(min(max(limit, 1), 500)))]
            )
            .compactMap { decodeJSON(WorkSafetyApprovalNoteRecord.self, from: $0["note_json"]?.string) }
    }

    @discardableResult
    public func savePermissionPolicy(_ policy: PermissionPolicyRecord) throws -> PermissionPolicyRecord {
        let sanitized = sanitizePermissionPolicy(policy)
        let policyJSON = encodeJSONString(sanitized) ?? "{}"
        try database.run(
            """
            INSERT INTO permission_policies (
              id, workspace_id, policy_name, effect, policy_status,
              role_targets_json, resource_type, resource_id, action, priority,
              reason_code, message, metadata_json, created_by_actor_id,
              updated_by_actor_id, policy_json, created_at, updated_at,
              redaction_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              workspace_id = excluded.workspace_id,
              policy_name = excluded.policy_name,
              effect = excluded.effect,
              policy_status = excluded.policy_status,
              role_targets_json = excluded.role_targets_json,
              resource_type = excluded.resource_type,
              resource_id = excluded.resource_id,
              action = excluded.action,
              priority = excluded.priority,
              reason_code = excluded.reason_code,
              message = excluded.message,
              metadata_json = excluded.metadata_json,
              created_by_actor_id = excluded.created_by_actor_id,
              updated_by_actor_id = excluded.updated_by_actor_id,
              policy_json = excluded.policy_json,
              created_at = excluded.created_at,
              updated_at = excluded.updated_at,
              redaction_status = excluded.redaction_status
            """,
            [
                .text(sanitized.id),
                .text(sanitized.workspaceId),
                .text(sanitized.name),
                .text(sanitized.effect.rawValue),
                .text(sanitized.status.rawValue),
                .text(encodeJSONString(sanitized.roleTargets) ?? "[]"),
                .text(sanitized.resourceType),
                sanitized.resourceId.sqliteText,
                .text(sanitized.action),
                .integer(Int64(sanitized.priority)),
                .text(sanitized.reasonCode.rawValue),
                .text(sanitized.message),
                .text(encodeJSONRecord(sanitized.metadata)),
                .text(sanitized.createdByActorId),
                .text(sanitized.updatedByActorId),
                .text(policyJSON),
                .text(sanitized.createdAt),
                .text(sanitized.updatedAt),
                .text(sanitized.redactionStatus)
            ]
        )
        eventBus.emit(.permissionPolicyUpdated, sanitized)
        return sanitized
    }

    public func listPermissionPolicies(workspaceId: RelayId, includeDisabled: Bool = false, limit: Int = 500) throws -> [PermissionPolicyRecord] {
        let limitValue = SQLiteValue.integer(Int64(min(max(limit, 1), 1_000)))
        if includeDisabled {
            return try database.all(
                """
                SELECT policy_json FROM permission_policies
                WHERE workspace_id = ?
                ORDER BY priority DESC, updated_at DESC
                LIMIT ?
                """,
                [.text(workspaceId), limitValue]
            ).compactMap { decodeJSON(PermissionPolicyRecord.self, from: $0["policy_json"]?.string) }
        }
        return try database.all(
            """
            SELECT policy_json FROM permission_policies
            WHERE workspace_id = ? AND policy_status = ?
            ORDER BY priority DESC, updated_at DESC
            LIMIT ?
            """,
            [.text(workspaceId), .text(PermissionPolicyStatus.active.rawValue), limitValue]
        ).compactMap { decodeJSON(PermissionPolicyRecord.self, from: $0["policy_json"]?.string) }
    }

    public func getPermissionPolicy(_ policyId: RelayId) throws -> PermissionPolicyRecord {
        guard let row = try database.get("SELECT policy_json FROM permission_policies WHERE id = ?", [.text(policyId)]),
              let policy = decodeJSON(PermissionPolicyRecord.self, from: row["policy_json"]?.string)
        else {
            throw RelayError(.notFound, "Permission policy was not found.")
        }
        return policy
    }

    @discardableResult
    public func deletePermissionPolicy(policyId: RelayId, workspaceId: RelayId) throws -> PermissionPolicyRecord {
        let policy = try getPermissionPolicy(policyId)
        guard policy.workspaceId == workspaceId else {
            throw RelayError(.notFound, "Permission policy was not found in this workspace.")
        }
        try database.run("DELETE FROM permission_policies WHERE id = ? AND workspace_id = ?", [.text(policyId), .text(workspaceId)])
        eventBus.emit(.permissionPolicyUpdated, policy)
        return policy
    }

    @discardableResult
    public func saveNativeFilePermission(_ permission: NativeFilePermissionRecord) throws -> NativeFilePermissionRecord {
        let sanitized = sanitizeNativeFilePermissionRecord(permission)
        let permissionJSON = encodeJSONString(sanitized) ?? "{}"
        try database.run(
            """
            INSERT INTO native_file_permissions (
              id, workspace_id, target_kind, display_name, display_path,
              path_hash, bookmark_ref, access_level, permission_status,
              related_task_id, related_tool_request_id, related_action_run_id,
              last_validated_at, last_synced_at, failure_reason, metadata_json,
              permission_json, created_by_actor_id, updated_by_actor_id,
              revoked_at, created_at, updated_at, redaction_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              target_kind = excluded.target_kind,
              display_name = excluded.display_name,
              display_path = excluded.display_path,
              path_hash = excluded.path_hash,
              bookmark_ref = excluded.bookmark_ref,
              access_level = excluded.access_level,
              permission_status = excluded.permission_status,
              related_task_id = excluded.related_task_id,
              related_tool_request_id = excluded.related_tool_request_id,
              related_action_run_id = excluded.related_action_run_id,
              last_validated_at = excluded.last_validated_at,
              last_synced_at = excluded.last_synced_at,
              failure_reason = excluded.failure_reason,
              metadata_json = excluded.metadata_json,
              permission_json = excluded.permission_json,
              updated_by_actor_id = excluded.updated_by_actor_id,
              revoked_at = excluded.revoked_at,
              updated_at = excluded.updated_at,
              redaction_status = excluded.redaction_status
            """,
            [
                .text(sanitized.id),
                .text(sanitized.workspaceId),
                .text(sanitized.targetKind.rawValue),
                .text(sanitized.displayName),
                .text(sanitized.displayPath),
                sanitized.pathHash.sqliteText,
                sanitized.bookmarkRef.sqliteText,
                .text(sanitized.accessLevel.rawValue),
                .text(sanitized.status.rawValue),
                sanitized.relatedTaskId.sqliteText,
                sanitized.relatedToolRequestId.sqliteText,
                sanitized.relatedActionRunId.sqliteText,
                sanitized.lastValidatedAt.sqliteText,
                sanitized.lastSyncedAt.sqliteText,
                sanitized.failureReason.sqliteText,
                .text(encodeJSONRecord(sanitized.metadata)),
                .text(permissionJSON),
                .text(sanitized.createdByActorId),
                .text(sanitized.updatedByActorId),
                sanitized.revokedAt.sqliteText,
                .text(sanitized.createdAt),
                .text(sanitized.updatedAt),
                .text(sanitized.redactionStatus)
            ]
        )
        eventBus.emit(.nativeFilePermissionUpdated, sanitized)
        return sanitized
    }

    public func listNativeFilePermissions(
        workspaceId: RelayId,
        status: NativeFilePermissionStatus? = nil,
        limit: Int = 100
    ) throws -> [NativeFilePermissionRecord] {
        let cappedLimit = Int64(min(max(limit, 1), 500))
        let rows: [[String: SQLiteValue]]
        if let status {
            rows = try database.all(
                """
                SELECT permission_json FROM native_file_permissions
                WHERE workspace_id = ? AND permission_status = ?
                ORDER BY updated_at DESC
                LIMIT ?
                """,
                [.text(workspaceId), .text(status.rawValue), .integer(cappedLimit)]
            )
        } else {
            rows = try database.all(
                """
                SELECT permission_json FROM native_file_permissions
                WHERE workspace_id = ?
                ORDER BY updated_at DESC
                LIMIT ?
                """,
                [.text(workspaceId), .integer(cappedLimit)]
            )
        }
        return rows.compactMap { decodeJSON(NativeFilePermissionRecord.self, from: $0["permission_json"]?.string) }
    }

    public func getNativeFilePermission(
        workspaceId: RelayId,
        permissionId: RelayId
    ) throws -> NativeFilePermissionRecord? {
        try database.get(
            """
            SELECT permission_json FROM native_file_permissions
            WHERE workspace_id = ? AND id = ?
            LIMIT 1
            """,
            [.text(workspaceId), .text(permissionId)]
        ).flatMap { decodeJSON(NativeFilePermissionRecord.self, from: $0["permission_json"]?.string) }
    }

    @discardableResult
    public func saveApplicationsNavigationRecord(
        workspaceId: RelayId,
        sectionKey: String,
        label: String,
        policy: ShellRoutePolicy,
        stateKind: GuardedStateKind?,
        reasonCode: GuardReasonCode?,
        visibleToRoles: [ServiceRole],
        message: String,
        navigation: JSONRecord
    ) throws -> RelayId {
        let id = "appnav-\(workspaceId)-\(sectionKey)"
        let timestamp = nowIso()
        let sanitizedNavigation = redactProvisioningRecord(navigation)
        let values: [SQLiteValue] = [
            .text(id),
            .text(workspaceId),
            .text(sectionKey),
            .text(redactString(label)),
            .text(policy.rawValue),
            (stateKind?.rawValue).sqliteText,
            (reasonCode?.rawValue).sqliteText,
            .text(encodeJSONString(visibleToRoles.map(\.rawValue)) ?? "[]"),
            .text(redactString(message)),
            .text(encodeJSONRecord(sanitizedNavigation)),
            .text(timestamp),
            .text(timestamp),
            .text("private-state-excluded")
        ]
        try database.run(
            """
            INSERT OR REPLACE INTO applications_navigation_records (
              id, workspace_id, section_key, label, policy, state_kind,
              reason_code, visible_to_roles_json, message, navigation_json,
              created_at, updated_at, redaction_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            values
        )
        return id
    }

    @discardableResult
    public func upsertMarketplaceCatalogApp(_ app: MarketplaceCatalogApp) throws -> MarketplaceCatalogApp {
        var sanitized = app
        sanitized.name = redactString(app.name)
        sanitized.summary = redactString(app.summary)
        sanitized.description = redactString(app.description)
        sanitized.availabilityReason = app.availabilityReason.map(redactString)
        sanitized.betaNotice = app.betaNotice.map(redactString)
        sanitized.redactionStatus = "private-state-excluded"
        let appJSON = encodeJSONString(sanitized) ?? "{}"
        try database.run(
            """
            INSERT INTO marketplace_catalog_apps (
              id, workspace_id, slug, name, summary, description, category,
              source_type, risk_level, auth_type, connection_type,
              capabilities_json, runtime_support_json, role_manifest_json,
              availability, availability_reason, connection_state, install_state,
              installed_agent_count, installed_agent_ids_json, docs_url,
              website_url, beta_notice, icon_initials, icon_color_name,
              read_only, local_app_excluded, review_excluded, app_json,
              created_at, updated_at, redaction_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              workspace_id = excluded.workspace_id,
              slug = excluded.slug,
              name = excluded.name,
              summary = excluded.summary,
              description = excluded.description,
              category = excluded.category,
              source_type = excluded.source_type,
              risk_level = excluded.risk_level,
              auth_type = excluded.auth_type,
              connection_type = excluded.connection_type,
              capabilities_json = excluded.capabilities_json,
              runtime_support_json = excluded.runtime_support_json,
              role_manifest_json = excluded.role_manifest_json,
              availability = excluded.availability,
              availability_reason = excluded.availability_reason,
              connection_state = excluded.connection_state,
              install_state = excluded.install_state,
              installed_agent_count = excluded.installed_agent_count,
              installed_agent_ids_json = excluded.installed_agent_ids_json,
              docs_url = excluded.docs_url,
              website_url = excluded.website_url,
              beta_notice = excluded.beta_notice,
              icon_initials = excluded.icon_initials,
              icon_color_name = excluded.icon_color_name,
              read_only = excluded.read_only,
              local_app_excluded = excluded.local_app_excluded,
              review_excluded = excluded.review_excluded,
              app_json = excluded.app_json,
              created_at = excluded.created_at,
              updated_at = excluded.updated_at,
              redaction_status = excluded.redaction_status
            """,
            [
                .text(sanitized.id),
                .text(sanitized.workspaceId),
                .text(sanitized.slug),
                .text(sanitized.name),
                .text(sanitized.summary),
                .text(sanitized.description),
                .text(sanitized.category),
                .text(sanitized.sourceType.rawValue),
                .text(sanitized.riskLevel.rawValue),
                .text(sanitized.authType),
                .text(sanitized.connectionType),
                .text(encodeJSONString(sanitized.capabilities) ?? "[]"),
                .text(encodeJSONString(sanitized.runtimeSupport.map(\.rawValue)) ?? "[]"),
                .text(encodeJSONString(sanitized.roleManifest) ?? "{}"),
                .text(sanitized.availability.rawValue),
                sanitized.availabilityReason.sqliteText,
                .text(sanitized.connectionState.rawValue),
                .text(sanitized.installState.rawValue),
                .integer(Int64(sanitized.installedAgentCount)),
                .text(encodeJSONString(sanitized.installedAgentIds) ?? "[]"),
                sanitized.docsURL.sqliteText,
                sanitized.websiteURL.sqliteText,
                sanitized.betaNotice.sqliteText,
                .text(sanitized.iconFallback.initials),
                .text(sanitized.iconFallback.colorName),
                .integer(sanitized.readOnly ? 1 : 0),
                .integer(sanitized.localAppExcluded ? 1 : 0),
                .integer(sanitized.reviewExcluded ? 1 : 0),
                .text(appJSON),
                .text(sanitized.createdAt),
                .text(sanitized.updatedAt),
                .text(sanitized.redactionStatus)
            ]
        )
        eventBus.emit(.applicationsCatalogUpdated, sanitized)
        return sanitized
    }

    @discardableResult
    public func saveMarketplaceCatalogApps(_ apps: [MarketplaceCatalogApp]) throws -> [MarketplaceCatalogApp] {
        var saved: [MarketplaceCatalogApp] = []
        try database.transaction {
            for app in apps {
                saved.append(try upsertMarketplaceCatalogApp(app))
            }
        }
        return saved
    }

    public func listMarketplaceCatalogApps(workspaceId: RelayId, limit: Int = 2_000) throws -> [MarketplaceCatalogApp] {
        try database
            .all(
                """
                SELECT app_json FROM marketplace_catalog_apps
                WHERE workspace_id = ?
                ORDER BY category ASC, name ASC
                LIMIT ?
                """,
                [.text(workspaceId), .integer(Int64(min(max(limit, 1), 5_000)))]
            )
            .compactMap { decodeJSON(MarketplaceCatalogApp.self, from: $0["app_json"]?.string) }
    }

    public func getMarketplaceCatalogApp(workspaceId: RelayId, appIdOrSlug: String) throws -> MarketplaceCatalogApp? {
        try database.get(
            """
            SELECT app_json FROM marketplace_catalog_apps
            WHERE workspace_id = ? AND (id = ? OR slug = ?)
            LIMIT 1
            """,
            [.text(workspaceId), .text(appIdOrSlug), .text(appIdOrSlug)]
        ).flatMap { decodeJSON(MarketplaceCatalogApp.self, from: $0["app_json"]?.string) }
    }

    @discardableResult
    public func saveApplicationsCatalogSnapshot(_ snapshot: ApplicationsCatalogSnapshot) throws -> ApplicationsCatalogSnapshot {
        let id = createRelayId("appsnap")
        let timestamp = nowIso()
        let snapshotJSON = encodeJSONString(snapshot) ?? "{}"
        try database.run(
            """
            INSERT INTO applications_catalog_snapshots (
              id, workspace_id, state, view, search_query, selected_category,
              risk_level, selected_app_id, response_count, demo_fallback_used,
              read_only, snapshot_json, created_at, updated_at, redaction_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                .text(id),
                .text(snapshot.workspaceId),
                .text(snapshot.state.rawValue),
                .text(snapshot.filter.view.rawValue),
                .text(snapshot.filter.searchQuery),
                snapshot.filter.category.sqliteText,
                (snapshot.filter.riskLevel?.rawValue).sqliteText,
                (snapshot.selectedApp?.id).sqliteText,
                .integer(Int64(snapshot.diagnostics.responseCount)),
                .integer(snapshot.diagnostics.demoFallbackUsed ? 1 : 0),
                .integer(snapshot.readOnly ? 1 : 0),
                .text(snapshotJSON),
                .text(timestamp),
                .text(timestamp),
                .text(snapshot.redactionStatus)
            ]
        )
        try retainLatestSnapshots(table: "applications_catalog_snapshots", workspaceId: snapshot.workspaceId)
        return snapshot
    }

    public func latestApplicationsCatalogSnapshot(workspaceId: RelayId) throws -> ApplicationsCatalogSnapshot? {
        try database.get(
            """
            SELECT snapshot_json FROM applications_catalog_snapshots
            WHERE workspace_id = ?
            ORDER BY updated_at DESC
            LIMIT 1
            """,
            [.text(workspaceId)]
        ).flatMap { decodeJSON(ApplicationsCatalogSnapshot.self, from: $0["snapshot_json"]?.string) }
    }

    @discardableResult
    public func saveProviderConnection(_ connection: MarketplaceProviderConnection) throws -> MarketplaceProviderConnection {
        let sanitized = sanitizeProviderConnection(connection)
        let connectionJSON = encodeJSONString(sanitized) ?? "{}"
        try database.run(
            """
            INSERT OR REPLACE INTO applications_provider_connections (
              id, workspace_id, app_id, app_slug, provider_key, provider_name,
              connection_status, authorization_state, credential_ownership,
              user_owned_credentials_required, credential_requirements_json,
              secret_reference_ids_json, account_label, connected_handle,
              callback_url, required_scopes_json, granted_scopes_json,
              selected_capabilities_json, health_json, sender_identities_json,
              install_policy, last_checked_at, last_error, manual_evidence_note,
              reauthorize_required, disconnecting, beta_blocked, connection_json,
              created_at, updated_at, redaction_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                .text(sanitized.id),
                .text(sanitized.workspaceId),
                .text(sanitized.appId),
                .text(sanitized.appSlug),
                .text(sanitized.providerKey),
                .text(sanitized.providerName),
                .text(sanitized.status.rawValue),
                .text(sanitized.authorizationState.rawValue),
                .text(sanitized.credentialOwnership.rawValue),
                .integer(sanitized.userOwnedCredentialsRequired ? 1 : 0),
                .text(encodeJSONString(sanitized.credentialRequirements) ?? "[]"),
                .text(encodeJSONString(sanitized.secretReferenceIds) ?? "[]"),
                sanitized.accountLabel.sqliteText,
                sanitized.connectedHandle.sqliteText,
                sanitized.callbackURL.sqliteText,
                .text(encodeJSONString(sanitized.requiredScopes) ?? "[]"),
                .text(encodeJSONString(sanitized.grantedScopes) ?? "[]"),
                .text(encodeJSONString(sanitized.selectedCapabilities) ?? "[]"),
                .text(encodeJSONString(sanitized.health) ?? "{}"),
                .text(encodeJSONString(sanitized.senderIdentities) ?? "[]"),
                sanitized.installPolicy.sqliteText,
                sanitized.lastCheckedAt.sqliteText,
                sanitized.lastError.sqliteText,
                sanitized.manualEvidenceNote.sqliteText,
                .integer(sanitized.reauthorizeRequired ? 1 : 0),
                .integer(sanitized.disconnecting ? 1 : 0),
                .integer(sanitized.betaBlocked ? 1 : 0),
                .text(connectionJSON),
                .text(sanitized.createdAt),
                .text(sanitized.updatedAt),
                .text(sanitized.redactionStatus)
            ]
        )
        eventBus.emit(.applicationsProviderConnectionUpdated, sanitized)
        return sanitized
    }

    public func listProviderConnections(workspaceId: RelayId, appId: RelayId? = nil, limit: Int = 100) throws -> [MarketplaceProviderConnection] {
        let cappedLimit = Int64(min(max(limit, 1), 500))
        if let appId {
            return try database
                .all(
                    """
                    SELECT connection_json FROM applications_provider_connections
                    WHERE workspace_id = ? AND app_id = ?
                    ORDER BY provider_name ASC, updated_at DESC
                    LIMIT ?
                    """,
                    [.text(workspaceId), .text(appId), .integer(cappedLimit)]
                )
                .compactMap { decodeJSON(MarketplaceProviderConnection.self, from: $0["connection_json"]?.string) }
                .map(normalizeProviderConnectionExecutionAuthority)
        }
        return try database
            .all(
                """
                SELECT connection_json FROM applications_provider_connections
                WHERE workspace_id = ?
                ORDER BY provider_name ASC, updated_at DESC
                LIMIT ?
                """,
                [.text(workspaceId), .integer(cappedLimit)]
            )
            .compactMap { decodeJSON(MarketplaceProviderConnection.self, from: $0["connection_json"]?.string) }
            .map(normalizeProviderConnectionExecutionAuthority)
    }

    public func getProviderConnection(workspaceId: RelayId, connectionId: RelayId) throws -> MarketplaceProviderConnection? {
        try database.get(
            """
            SELECT connection_json FROM applications_provider_connections
            WHERE workspace_id = ? AND id = ?
            LIMIT 1
            """,
            [.text(workspaceId), .text(connectionId)]
        ).flatMap { decodeJSON(MarketplaceProviderConnection.self, from: $0["connection_json"]?.string) }
            .map(normalizeProviderConnectionExecutionAuthority)
    }

    @discardableResult
    public func deleteProviderConnection(workspaceId: RelayId, connectionId: RelayId) throws -> MarketplaceProviderConnection? {
        let existing = try getProviderConnection(workspaceId: workspaceId, connectionId: connectionId)
        try database.run(
            """
            DELETE FROM applications_provider_connections
            WHERE workspace_id = ? AND id = ?
            """,
            [.text(workspaceId), .text(connectionId)]
        )
        if let existing {
            eventBus.emit(.applicationsProviderConnectionUpdated, existing)
        }
        return existing
    }

    @discardableResult
    public func saveProviderAuthorizationFlow(_ flow: ProviderAuthorizationFlow) throws -> ProviderAuthorizationFlow {
        let sanitized = sanitizeProviderAuthorizationFlow(flow)
        let flowJSON = encodeJSONString(sanitized) ?? "{}"
        try database.run(
            """
            INSERT OR REPLACE INTO applications_provider_authorization_flows (
              id, workspace_id, app_id, connection_id, provider_key, state,
              callback_url, authorization_url, deep_link_url, manual_evidence_note,
              error_message, started_by_actor_id, started_at, completed_at,
              flow_json, created_at, updated_at, redaction_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                .text(sanitized.id),
                .text(sanitized.workspaceId),
                .text(sanitized.appId),
                sanitized.connectionId.sqliteText,
                .text(sanitized.providerKey),
                .text(sanitized.state.rawValue),
                sanitized.callbackURL.sqliteText,
                sanitized.authorizationURL.sqliteText,
                sanitized.deepLinkURL.sqliteText,
                sanitized.manualEvidenceNote.sqliteText,
                sanitized.errorMessage.sqliteText,
                .text(sanitized.startedByActorId),
                .text(sanitized.startedAt),
                sanitized.completedAt.sqliteText,
                .text(flowJSON),
                .text(sanitized.createdAt),
                .text(sanitized.updatedAt),
                .text(sanitized.redactionStatus)
            ]
        )
        eventBus.emit(.applicationsProviderConnectionUpdated, sanitized)
        return sanitized
    }

    public func listProviderAuthorizationFlows(workspaceId: RelayId, appId: RelayId? = nil, limit: Int = 100) throws -> [ProviderAuthorizationFlow] {
        let cappedLimit = Int64(min(max(limit, 1), 500))
        if let appId {
            return try database
                .all(
                    """
                    SELECT flow_json FROM applications_provider_authorization_flows
                    WHERE workspace_id = ? AND app_id = ?
                    ORDER BY updated_at DESC
                    LIMIT ?
                    """,
                    [.text(workspaceId), .text(appId), .integer(cappedLimit)]
                )
                .compactMap { decodeJSON(ProviderAuthorizationFlow.self, from: $0["flow_json"]?.string) }
        }
        return try database
            .all(
                """
                SELECT flow_json FROM applications_provider_authorization_flows
                WHERE workspace_id = ?
                ORDER BY updated_at DESC
                LIMIT ?
                """,
                [.text(workspaceId), .integer(cappedLimit)]
            )
            .compactMap { decodeJSON(ProviderAuthorizationFlow.self, from: $0["flow_json"]?.string) }
    }

    @discardableResult
    public func saveProviderConnectionSnapshot(_ snapshot: ProviderConnectionSnapshot) throws -> ProviderConnectionSnapshot {
        let sanitized = sanitizeProviderConnectionSnapshot(snapshot)
        let id = createRelayId("pcsnap")
        let timestamp = nowIso()
        let snapshotJSON = encodeJSONString(sanitized) ?? "{}"
        try database.run(
            """
            INSERT INTO applications_provider_connection_snapshots (
              id, workspace_id, app_id, state, connection_count,
              authorization_flow_count, selected_connection_id, read_only,
              snapshot_json, created_at, updated_at, redaction_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                .text(id),
                .text(sanitized.workspaceId),
                sanitized.appId.sqliteText,
                .text(sanitized.state.rawValue),
                .integer(Int64(sanitized.connections.count)),
                .integer(Int64(sanitized.authorizationFlows.count)),
                (sanitized.selectedConnection?.id).sqliteText,
                .integer(sanitized.readOnly ? 1 : 0),
                .text(snapshotJSON),
                .text(timestamp),
                .text(timestamp),
                .text(sanitized.redactionStatus)
            ]
        )
        try retainLatestSnapshots(table: "applications_provider_connection_snapshots", workspaceId: sanitized.workspaceId)
        return sanitized
    }

    public func latestProviderConnectionSnapshot(workspaceId: RelayId, appId: RelayId? = nil) throws -> ProviderConnectionSnapshot? {
        if let appId {
            return try database.get(
                """
                SELECT snapshot_json FROM applications_provider_connection_snapshots
                WHERE workspace_id = ? AND app_id = ?
                ORDER BY updated_at DESC
                LIMIT 1
                """,
                [.text(workspaceId), .text(appId)]
            ).flatMap { decodeJSON(ProviderConnectionSnapshot.self, from: $0["snapshot_json"]?.string) }
        }
        return try database.get(
            """
            SELECT snapshot_json FROM applications_provider_connection_snapshots
            WHERE workspace_id = ?
            ORDER BY updated_at DESC
            LIMIT 1
            """,
            [.text(workspaceId)]
        ).flatMap { decodeJSON(ProviderConnectionSnapshot.self, from: $0["snapshot_json"]?.string) }
    }

    @discardableResult
    public func saveMarketplaceInstall(_ install: MarketplaceInstallRecord) throws -> MarketplaceInstallRecord {
        let sanitized = sanitizeMarketplaceInstallRecord(install)
        let installJSON = encodeJSONString(sanitized) ?? "{}"
        try database.run(
            """
            INSERT INTO applications_marketplace_installs (
              id, workspace_id, app_id, app_slug, connection_id, agent_id,
              runtime_binding_id, harness_id, runtime_type, role_id, role_label,
              selected_capabilities_json, approval_profile_id, runtime_format,
              target_mode, risk_acknowledged, install_status, drift_status,
              last_installed_at, removed_at, failure_message, metadata_json,
              created_by_actor_id, install_json, created_at, updated_at,
              redaction_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              workspace_id = excluded.workspace_id,
              app_id = excluded.app_id,
              app_slug = excluded.app_slug,
              connection_id = excluded.connection_id,
              agent_id = excluded.agent_id,
              runtime_binding_id = excluded.runtime_binding_id,
              harness_id = excluded.harness_id,
              runtime_type = excluded.runtime_type,
              role_id = excluded.role_id,
              role_label = excluded.role_label,
              selected_capabilities_json = excluded.selected_capabilities_json,
              approval_profile_id = excluded.approval_profile_id,
              runtime_format = excluded.runtime_format,
              target_mode = excluded.target_mode,
              risk_acknowledged = excluded.risk_acknowledged,
              install_status = excluded.install_status,
              drift_status = excluded.drift_status,
              last_installed_at = excluded.last_installed_at,
              removed_at = excluded.removed_at,
              failure_message = excluded.failure_message,
              metadata_json = excluded.metadata_json,
              created_by_actor_id = excluded.created_by_actor_id,
              install_json = excluded.install_json,
              created_at = excluded.created_at,
              updated_at = excluded.updated_at,
              redaction_status = excluded.redaction_status
            """,
            [
                .text(sanitized.id),
                .text(sanitized.workspaceId),
                .text(sanitized.appId),
                .text(sanitized.appSlug),
                sanitized.connectionId.sqliteText,
                .text(sanitized.agentId),
                .text(sanitized.runtimeBindingId),
                .text(sanitized.harnessId),
                .text(sanitized.runtimeType.rawValue),
                .text(sanitized.roleId),
                .text(sanitized.roleLabel),
                .text(encodeJSONString(sanitized.selectedCapabilities) ?? "[]"),
                sanitized.approvalProfileId.sqliteText,
                .text(sanitized.runtimeFormat.rawValue),
                .text(sanitized.targetMode.rawValue),
                .integer(sanitized.riskAcknowledged ? 1 : 0),
                .text(sanitized.installStatus.rawValue),
                .text(sanitized.driftStatus.rawValue),
                sanitized.lastInstalledAt.sqliteText,
                sanitized.removedAt.sqliteText,
                sanitized.failureMessage.sqliteText,
                .text(encodeJSONRecord(sanitized.metadata)),
                .text(sanitized.createdByActorId),
                .text(installJSON),
                .text(sanitized.createdAt),
                .text(sanitized.updatedAt),
                .text(sanitized.redactionStatus)
            ]
        )
        eventBus.emit(.applicationsMarketplaceInstallUpdated, sanitized)
        return sanitized
    }

    public func listMarketplaceInstalls(workspaceId: RelayId, appId: RelayId? = nil, limit: Int = 100) throws -> [MarketplaceInstallRecord] {
        let cappedLimit = Int64(min(max(limit, 1), 500))
        if let appId {
            return try database
                .all(
                    """
                    SELECT install_json FROM applications_marketplace_installs
                    WHERE workspace_id = ? AND app_id = ?
                    ORDER BY updated_at DESC
                    LIMIT ?
                    """,
                    [.text(workspaceId), .text(appId), .integer(cappedLimit)]
                )
                .compactMap { decodeJSON(MarketplaceInstallRecord.self, from: $0["install_json"]?.string) }
                .map(normalizeMarketplaceInstallExecutionAuthority)
        }
        return try database
            .all(
                """
                SELECT install_json FROM applications_marketplace_installs
                WHERE workspace_id = ?
                ORDER BY updated_at DESC
                LIMIT ?
                """,
                [.text(workspaceId), .integer(cappedLimit)]
            )
            .compactMap { decodeJSON(MarketplaceInstallRecord.self, from: $0["install_json"]?.string) }
            .map(normalizeMarketplaceInstallExecutionAuthority)
    }

    public func getMarketplaceInstall(workspaceId: RelayId, installId: RelayId) throws -> MarketplaceInstallRecord? {
        try database.get(
            """
            SELECT install_json FROM applications_marketplace_installs
            WHERE workspace_id = ? AND id = ?
            LIMIT 1
            """,
            [.text(workspaceId), .text(installId)]
        ).flatMap { decodeJSON(MarketplaceInstallRecord.self, from: $0["install_json"]?.string) }
            .map(normalizeMarketplaceInstallExecutionAuthority)
    }

    @discardableResult
    public func saveMarketplaceInstallSnapshot(_ snapshot: MarketplaceInstallSnapshot) throws -> MarketplaceInstallSnapshot {
        let sanitized = sanitizeMarketplaceInstallSnapshot(snapshot)
        let id = createRelayId("minsnap")
        let timestamp = nowIso()
        let snapshotJSON = encodeJSONString(sanitized) ?? "{}"
        try database.run(
            """
            INSERT INTO applications_marketplace_install_snapshots (
              id, workspace_id, app_id, state, install_count,
              compatible_agent_count, selected_install_id, read_only,
              snapshot_json, created_at, updated_at, redaction_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                .text(id),
                .text(sanitized.workspaceId),
                sanitized.appId.sqliteText,
                .text(sanitized.state.rawValue),
                .integer(Int64(sanitized.installs.count)),
                .integer(Int64(sanitized.compatibleAgents.count)),
                (sanitized.selectedInstall?.id).sqliteText,
                .integer(sanitized.readOnly ? 1 : 0),
                .text(snapshotJSON),
                .text(timestamp),
                .text(timestamp),
                .text(sanitized.redactionStatus)
            ]
        )
        try retainLatestSnapshots(table: "applications_marketplace_install_snapshots", workspaceId: sanitized.workspaceId)
        return sanitized
    }

    public func latestMarketplaceInstallSnapshot(workspaceId: RelayId, appId: RelayId? = nil) throws -> MarketplaceInstallSnapshot? {
        if let appId {
            return try database.get(
                """
                SELECT snapshot_json FROM applications_marketplace_install_snapshots
                WHERE workspace_id = ? AND app_id = ?
                ORDER BY updated_at DESC
                LIMIT 1
                """,
                [.text(workspaceId), .text(appId)]
            ).flatMap { decodeJSON(MarketplaceInstallSnapshot.self, from: $0["snapshot_json"]?.string) }
        }
        return try database.get(
            """
            SELECT snapshot_json FROM applications_marketplace_install_snapshots
            WHERE workspace_id = ?
            ORDER BY updated_at DESC
            LIMIT 1
            """,
            [.text(workspaceId)]
        ).flatMap { decodeJSON(MarketplaceInstallSnapshot.self, from: $0["snapshot_json"]?.string) }
    }

    @discardableResult
    public func saveMarketplaceProviderActionDefinition(_ definition: MarketplaceProviderActionDefinition) throws -> MarketplaceProviderActionDefinition {
        let sanitized = sanitizeMarketplaceProviderActionDefinition(definition)
        let definitionJSON = encodeJSONString(sanitized) ?? "{}"
        try database.run(
            """
            INSERT INTO marketplace_provider_action_definitions (
              id, workspace_id, app_id, app_slug, provider_key, action_key,
              display_name, action_kind, risk_level, adapter_kind,
              default_permission, enabled, definition_json, created_at,
              updated_at, redaction_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              workspace_id = excluded.workspace_id,
              app_id = excluded.app_id,
              app_slug = excluded.app_slug,
              provider_key = excluded.provider_key,
              action_key = excluded.action_key,
              display_name = excluded.display_name,
              action_kind = excluded.action_kind,
              risk_level = excluded.risk_level,
              adapter_kind = excluded.adapter_kind,
              default_permission = excluded.default_permission,
              enabled = excluded.enabled,
              definition_json = excluded.definition_json,
              updated_at = excluded.updated_at,
              redaction_status = excluded.redaction_status
            """,
            [
                .text(sanitized.id),
                .text(sanitized.workspaceId),
                .text(sanitized.appId),
                .text(sanitized.appSlug),
                .text(sanitized.providerKey),
                .text(sanitized.actionKey),
                .text(sanitized.displayName),
                .text(sanitized.kind.rawValue),
                .text(sanitized.riskLevel.rawValue),
                .text(sanitized.adapterKind.rawValue),
                .text(sanitized.defaultPermission.rawValue),
                .integer(sanitized.enabled ? 1 : 0),
                .text(definitionJSON),
                .text(sanitized.createdAt),
                .text(sanitized.updatedAt),
                .text(sanitized.redactionStatus)
            ]
        )
        eventBus.emit(.applicationsProviderActionUpdated, sanitized)
        return sanitized
    }

    public func listMarketplaceProviderActionDefinitions(
        workspaceId: RelayId,
        appId: RelayId? = nil,
        limit: Int = 100
    ) throws -> [MarketplaceProviderActionDefinition] {
        let cappedLimit = Int64(min(max(limit, 1), 500))
        if let appId {
            return try database
                .all(
                    """
                    SELECT definition_json FROM marketplace_provider_action_definitions
                    WHERE workspace_id = ? AND app_id = ?
                    ORDER BY updated_at DESC
                    LIMIT ?
                    """,
                    [.text(workspaceId), .text(appId), .integer(cappedLimit)]
                )
                .compactMap { decodeJSON(MarketplaceProviderActionDefinition.self, from: $0["definition_json"]?.string) }
        }
        return try database
            .all(
                """
                SELECT definition_json FROM marketplace_provider_action_definitions
                WHERE workspace_id = ?
                ORDER BY updated_at DESC
                LIMIT ?
                """,
                [.text(workspaceId), .integer(cappedLimit)]
            )
            .compactMap { decodeJSON(MarketplaceProviderActionDefinition.self, from: $0["definition_json"]?.string) }
    }

    public func getMarketplaceProviderActionDefinition(
        workspaceId: RelayId,
        actionId: RelayId
    ) throws -> MarketplaceProviderActionDefinition? {
        try database.get(
            """
            SELECT definition_json FROM marketplace_provider_action_definitions
            WHERE workspace_id = ? AND id = ?
            LIMIT 1
            """,
            [.text(workspaceId), .text(actionId)]
        ).flatMap { decodeJSON(MarketplaceProviderActionDefinition.self, from: $0["definition_json"]?.string) }
    }

    @discardableResult
    public func saveMarketplaceActionPermissionMap(_ map: MarketplaceActionPermissionMap) throws -> MarketplaceActionPermissionMap {
        let sanitized = sanitizeMarketplaceActionPermissionMap(map)
        let mapJSON = encodeJSONString(sanitized) ?? "{}"
        try database.run(
            """
            INSERT INTO marketplace_action_permission_maps (
              id, workspace_id, app_id, app_slug, connection_id, install_id,
              agent_id, policy_preset, permissions_json, map_json,
              created_by_actor_id, updated_by_actor_id, created_at, updated_at,
              redaction_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              workspace_id = excluded.workspace_id,
              app_id = excluded.app_id,
              app_slug = excluded.app_slug,
              connection_id = excluded.connection_id,
              install_id = excluded.install_id,
              agent_id = excluded.agent_id,
              policy_preset = excluded.policy_preset,
              permissions_json = excluded.permissions_json,
              map_json = excluded.map_json,
              updated_by_actor_id = excluded.updated_by_actor_id,
              updated_at = excluded.updated_at,
              redaction_status = excluded.redaction_status
            """,
            [
                .text(sanitized.id),
                .text(sanitized.workspaceId),
                .text(sanitized.appId),
                .text(sanitized.appSlug),
                sanitized.connectionId.sqliteText,
                sanitized.installId.sqliteText,
                sanitized.agentId.sqliteText,
                .text(sanitized.policyPreset.rawValue),
                .text(encodeJSONString(sanitized.permissions) ?? "{}"),
                .text(mapJSON),
                .text(sanitized.createdByActorId),
                sanitized.updatedByActorId.sqliteText,
                .text(sanitized.createdAt),
                .text(sanitized.updatedAt),
                .text(sanitized.redactionStatus)
            ]
        )
        eventBus.emit(.applicationsProviderActionUpdated, sanitized)
        return sanitized
    }

    public func listMarketplaceActionPermissionMaps(
        workspaceId: RelayId,
        appId: RelayId? = nil,
        installId: RelayId? = nil,
        connectionId: RelayId? = nil,
        agentId: RelayId? = nil,
        limit: Int = 100
    ) throws -> [MarketplaceActionPermissionMap] {
        let cappedLimit = Int64(min(max(limit, 1), 500))
        if let installId {
            return try database
                .all(
                    """
                    SELECT map_json FROM marketplace_action_permission_maps
                    WHERE workspace_id = ? AND install_id = ?
                    ORDER BY updated_at DESC
                    LIMIT ?
                    """,
                    [.text(workspaceId), .text(installId), .integer(cappedLimit)]
                )
                .compactMap { decodeJSON(MarketplaceActionPermissionMap.self, from: $0["map_json"]?.string) }
                .map(normalizeMarketplacePermissionMapExecutionAuthority)
        }
        if let connectionId {
            return try database
                .all(
                    """
                    SELECT map_json FROM marketplace_action_permission_maps
                    WHERE workspace_id = ? AND connection_id = ?
                    ORDER BY updated_at DESC
                    LIMIT ?
                    """,
                    [.text(workspaceId), .text(connectionId), .integer(cappedLimit)]
                )
                .compactMap { decodeJSON(MarketplaceActionPermissionMap.self, from: $0["map_json"]?.string) }
                .map(normalizeMarketplacePermissionMapExecutionAuthority)
        }
        if let agentId {
            return try database
                .all(
                    """
                    SELECT map_json FROM marketplace_action_permission_maps
                    WHERE workspace_id = ? AND agent_id = ?
                    ORDER BY updated_at DESC
                    LIMIT ?
                    """,
                    [.text(workspaceId), .text(agentId), .integer(cappedLimit)]
                )
                .compactMap { decodeJSON(MarketplaceActionPermissionMap.self, from: $0["map_json"]?.string) }
                .map(normalizeMarketplacePermissionMapExecutionAuthority)
        }
        if let appId {
            return try database
                .all(
                    """
                    SELECT map_json FROM marketplace_action_permission_maps
                    WHERE workspace_id = ? AND app_id = ?
                    ORDER BY updated_at DESC
                    LIMIT ?
                    """,
                    [.text(workspaceId), .text(appId), .integer(cappedLimit)]
                )
                .compactMap { decodeJSON(MarketplaceActionPermissionMap.self, from: $0["map_json"]?.string) }
                .map(normalizeMarketplacePermissionMapExecutionAuthority)
        }
        return try database
            .all(
                """
                SELECT map_json FROM marketplace_action_permission_maps
                WHERE workspace_id = ?
                ORDER BY updated_at DESC
                LIMIT ?
                """,
                [.text(workspaceId), .integer(cappedLimit)]
            )
            .compactMap { decodeJSON(MarketplaceActionPermissionMap.self, from: $0["map_json"]?.string) }
            .map(normalizeMarketplacePermissionMapExecutionAuthority)
    }

    public func getMarketplaceActionPermissionMap(
        workspaceId: RelayId,
        mapId: RelayId
    ) throws -> MarketplaceActionPermissionMap? {
        try database.get(
            """
            SELECT map_json FROM marketplace_action_permission_maps
            WHERE workspace_id = ? AND id = ?
            LIMIT 1
            """,
            [.text(workspaceId), .text(mapId)]
        ).flatMap { decodeJSON(MarketplaceActionPermissionMap.self, from: $0["map_json"]?.string) }
            .map(normalizeMarketplacePermissionMapExecutionAuthority)
    }

    @discardableResult
    public func saveMarketplaceProviderActionApproval(_ approval: MarketplaceProviderActionApprovalRecord) throws -> MarketplaceProviderActionApprovalRecord {
        if let existing = try database.get(
            """
            SELECT approval_json FROM marketplace_provider_action_approvals
            WHERE workspace_id = ? AND provider_action_id = ? AND idempotency_key = ?
            LIMIT 1
            """,
            [.text(approval.workspaceId), .text(approval.providerActionId), .text(approval.idempotencyKey)]
        ).flatMap({ decodeJSON(MarketplaceProviderActionApprovalRecord.self, from: $0["approval_json"]?.string) }) {
            guard existing.id == approval.id else {
                return existing
            }
        }

        let sanitized = sanitizeMarketplaceProviderActionApprovalRecord(approval)
        let approvalJSON = encodeJSONString(sanitized) ?? "{}"
        try database.run(
            """
            INSERT INTO marketplace_provider_action_approvals (
              id, workspace_id, app_id, app_slug, connection_id, install_id,
              agent_id, provider_action_id, action_key, approval_status,
              proposed_payload_hash, idempotency_key, expires_at, resolved_at,
              execution_id, approval_json, created_at, updated_at, redaction_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              approval_status = excluded.approval_status,
              proposed_payload_hash = excluded.proposed_payload_hash,
              expires_at = excluded.expires_at,
              resolved_at = excluded.resolved_at,
              execution_id = excluded.execution_id,
              approval_json = excluded.approval_json,
              updated_at = excluded.updated_at,
              redaction_status = excluded.redaction_status
            """,
            [
                .text(sanitized.id),
                .text(sanitized.workspaceId),
                .text(sanitized.appId),
                .text(sanitized.appSlug),
                sanitized.connectionId.sqliteText,
                sanitized.installId.sqliteText,
                sanitized.agentId.sqliteText,
                .text(sanitized.providerActionId),
                .text(sanitized.actionKey),
                .text(sanitized.status.rawValue),
                .text(sanitized.proposedPayloadHash),
                .text(sanitized.idempotencyKey),
                sanitized.expiresAt.sqliteText,
                sanitized.resolvedAt.sqliteText,
                sanitized.executionId.sqliteText,
                .text(approvalJSON),
                .text(sanitized.createdAt),
                .text(sanitized.updatedAt),
                .text(sanitized.redactionStatus)
            ]
        )
        eventBus.emit(.applicationsProviderActionUpdated, sanitized)
        return sanitized
    }

    public func listMarketplaceProviderActionApprovals(
        workspaceId: RelayId,
        appId: RelayId? = nil,
        status: WorkSafetyApprovalStatus? = nil,
        limit: Int = 100
    ) throws -> [MarketplaceProviderActionApprovalRecord] {
        let cappedLimit = Int64(min(max(limit, 1), 500))
        if let appId {
            return try database
                .all(
                    """
                    SELECT approval_json FROM marketplace_provider_action_approvals
                    WHERE workspace_id = ? AND app_id = ?
                    ORDER BY updated_at DESC
                    LIMIT ?
                    """,
                    [.text(workspaceId), .text(appId), .integer(cappedLimit)]
                )
                .compactMap { decodeJSON(MarketplaceProviderActionApprovalRecord.self, from: $0["approval_json"]?.string) }
        }
        if let status {
            return try database
                .all(
                    """
                    SELECT approval_json FROM marketplace_provider_action_approvals
                    WHERE workspace_id = ? AND approval_status = ?
                    ORDER BY updated_at DESC
                    LIMIT ?
                    """,
                    [.text(workspaceId), .text(status.rawValue), .integer(cappedLimit)]
                )
                .compactMap { decodeJSON(MarketplaceProviderActionApprovalRecord.self, from: $0["approval_json"]?.string) }
        }
        return try database
            .all(
                """
                SELECT approval_json FROM marketplace_provider_action_approvals
                WHERE workspace_id = ?
                ORDER BY updated_at DESC
                LIMIT ?
                """,
                [.text(workspaceId), .integer(cappedLimit)]
            )
            .compactMap { decodeJSON(MarketplaceProviderActionApprovalRecord.self, from: $0["approval_json"]?.string) }
    }

    public func getMarketplaceProviderActionApproval(
        workspaceId: RelayId,
        approvalId: RelayId
    ) throws -> MarketplaceProviderActionApprovalRecord? {
        try database.get(
            """
            SELECT approval_json FROM marketplace_provider_action_approvals
            WHERE workspace_id = ? AND id = ?
            LIMIT 1
            """,
            [.text(workspaceId), .text(approvalId)]
        ).flatMap { decodeJSON(MarketplaceProviderActionApprovalRecord.self, from: $0["approval_json"]?.string) }
    }

    @discardableResult
    public func saveMarketplaceProviderActionExecution(_ execution: MarketplaceProviderActionExecutionRecord) throws -> MarketplaceProviderActionExecutionRecord {
        if let existing = try database.get(
            """
            SELECT execution_json FROM marketplace_provider_action_executions
            WHERE workspace_id = ? AND provider_action_id = ? AND idempotency_key = ?
            LIMIT 1
            """,
            [.text(execution.workspaceId), .text(execution.providerActionId), .text(execution.idempotencyKey)]
        ).flatMap({ decodeJSON(MarketplaceProviderActionExecutionRecord.self, from: $0["execution_json"]?.string) }) {
            guard existing.id == execution.id else {
                return existing
            }
        }

        let sanitized = sanitizeMarketplaceProviderActionExecutionRecord(execution)
        let executionJSON = encodeJSONString(sanitized) ?? "{}"
        try database.run(
            """
            INSERT INTO marketplace_provider_action_executions (
              id, workspace_id, app_id, app_slug, connection_id, install_id,
              agent_id, provider_action_id, action_key, permission,
              execution_status, idempotency_key, approval_id, adapter_kind,
              execution_json, started_at, completed_at, created_at, updated_at,
              redaction_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              execution_status = excluded.execution_status,
              approval_id = excluded.approval_id,
              execution_json = excluded.execution_json,
              started_at = excluded.started_at,
              completed_at = excluded.completed_at,
              updated_at = excluded.updated_at,
              redaction_status = excluded.redaction_status
            """,
            [
                .text(sanitized.id),
                .text(sanitized.workspaceId),
                .text(sanitized.appId),
                .text(sanitized.appSlug),
                sanitized.connectionId.sqliteText,
                sanitized.installId.sqliteText,
                sanitized.agentId.sqliteText,
                .text(sanitized.providerActionId),
                .text(sanitized.actionKey),
                .text(sanitized.permission.rawValue),
                .text(sanitized.status.rawValue),
                .text(sanitized.idempotencyKey),
                (sanitized.approvalReference?.approvalId).sqliteText,
                .text(sanitized.adapterKind.rawValue),
                .text(executionJSON),
                sanitized.startedAt.sqliteText,
                sanitized.completedAt.sqliteText,
                .text(sanitized.createdAt),
                .text(sanitized.updatedAt),
                .text(sanitized.redactionStatus)
            ]
        )
        eventBus.emit(.applicationsProviderActionUpdated, sanitized)
        return sanitized
    }

    public func listMarketplaceProviderActionExecutions(
        workspaceId: RelayId,
        appId: RelayId? = nil,
        status: ProviderActionExecutionStatus? = nil,
        limit: Int = 100
    ) throws -> [MarketplaceProviderActionExecutionRecord] {
        let cappedLimit = Int64(min(max(limit, 1), 500))
        if let appId {
            return try database
                .all(
                    """
                    SELECT execution_json FROM marketplace_provider_action_executions
                    WHERE workspace_id = ? AND app_id = ?
                    ORDER BY updated_at DESC
                    LIMIT ?
                    """,
                    [.text(workspaceId), .text(appId), .integer(cappedLimit)]
                )
                .compactMap { decodeJSON(MarketplaceProviderActionExecutionRecord.self, from: $0["execution_json"]?.string) }
        }
        if let status {
            return try database
                .all(
                    """
                    SELECT execution_json FROM marketplace_provider_action_executions
                    WHERE workspace_id = ? AND execution_status = ?
                    ORDER BY updated_at DESC
                    LIMIT ?
                    """,
                    [.text(workspaceId), .text(status.rawValue), .integer(cappedLimit)]
                )
                .compactMap { decodeJSON(MarketplaceProviderActionExecutionRecord.self, from: $0["execution_json"]?.string) }
        }
        return try database
            .all(
                """
                SELECT execution_json FROM marketplace_provider_action_executions
                WHERE workspace_id = ?
                ORDER BY updated_at DESC
                LIMIT ?
                """,
                [.text(workspaceId), .integer(cappedLimit)]
            )
            .compactMap { decodeJSON(MarketplaceProviderActionExecutionRecord.self, from: $0["execution_json"]?.string) }
    }

    public func getMarketplaceProviderActionExecution(
        workspaceId: RelayId,
        executionId: RelayId
    ) throws -> MarketplaceProviderActionExecutionRecord? {
        try database.get(
            """
            SELECT execution_json FROM marketplace_provider_action_executions
            WHERE workspace_id = ? AND id = ?
            LIMIT 1
            """,
            [.text(workspaceId), .text(executionId)]
        ).flatMap { decodeJSON(MarketplaceProviderActionExecutionRecord.self, from: $0["execution_json"]?.string) }
    }

    @discardableResult
    public func saveToolRequest(_ request: ToolRequestRecord) throws -> ToolRequestRecord {
        let sanitized = sanitizeToolRequestRecord(request)
        let requestJSON = encodeJSONString(sanitized) ?? "{}"
        try database.run(
            """
            INSERT INTO applications_tool_requests (
              id, workspace_id, requested_capability, normalized_capability,
              app_id, app_slug, agent_id, thread_id, dispatch_id,
              missing_tool_event_id, related_task_id, related_record_id,
              campaign, reason, required_action, evidence, request_status,
              policy_allowed, tool_available, tool_connected, tool_granted,
              availability_state, suggested_apps_json, metadata_json,
              request_json, requested_at, last_seen_at, resolved_at,
              resolution_note, created_by_actor_id, updated_by_actor_id,
              created_at, updated_at, redaction_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              requested_capability = excluded.requested_capability,
              normalized_capability = excluded.normalized_capability,
              app_id = excluded.app_id,
              app_slug = excluded.app_slug,
              agent_id = excluded.agent_id,
              thread_id = excluded.thread_id,
              dispatch_id = excluded.dispatch_id,
              missing_tool_event_id = excluded.missing_tool_event_id,
              related_task_id = excluded.related_task_id,
              related_record_id = excluded.related_record_id,
              campaign = excluded.campaign,
              reason = excluded.reason,
              required_action = excluded.required_action,
              evidence = excluded.evidence,
              request_status = excluded.request_status,
              policy_allowed = excluded.policy_allowed,
              tool_available = excluded.tool_available,
              tool_connected = excluded.tool_connected,
              tool_granted = excluded.tool_granted,
              availability_state = excluded.availability_state,
              suggested_apps_json = excluded.suggested_apps_json,
              metadata_json = excluded.metadata_json,
              request_json = excluded.request_json,
              last_seen_at = excluded.last_seen_at,
              resolved_at = excluded.resolved_at,
              resolution_note = excluded.resolution_note,
              updated_by_actor_id = excluded.updated_by_actor_id,
              updated_at = excluded.updated_at,
              redaction_status = excluded.redaction_status
            """,
            [
                .text(sanitized.id),
                .text(sanitized.workspaceId),
                .text(sanitized.requestedCapability),
                .text(sanitized.normalizedCapability),
                sanitized.appId.sqliteText,
                sanitized.appSlug.sqliteText,
                sanitized.agentId.sqliteText,
                sanitized.threadId.sqliteText,
                sanitized.dispatchId.sqliteText,
                sanitized.missingToolEventId.sqliteText,
                sanitized.relatedTaskId.sqliteText,
                sanitized.relatedRecordId.sqliteText,
                sanitized.campaign.sqliteText,
                .text(sanitized.reason),
                .text(sanitized.requiredAction),
                sanitized.evidence.sqliteText,
                .text(sanitized.status.rawValue),
                .integer(sanitized.policyAllowed ? 1 : 0),
                .integer(sanitized.toolAvailable ? 1 : 0),
                .integer(sanitized.toolConnected ? 1 : 0),
                .integer(sanitized.toolGranted ? 1 : 0),
                .text(sanitized.availabilityState.rawValue),
                .text(encodeJSONString(sanitized.suggestedApps) ?? "[]"),
                .text(encodeJSONRecord(sanitized.metadata)),
                .text(requestJSON),
                .text(sanitized.requestedAt),
                .text(sanitized.lastSeenAt),
                sanitized.resolvedAt.sqliteText,
                sanitized.resolutionNote.sqliteText,
                sanitized.createdByActorId.sqliteText,
                sanitized.updatedByActorId.sqliteText,
                .text(sanitized.requestedAt),
                .text(sanitized.lastSeenAt),
                .text(sanitized.redactionStatus)
            ]
        )
        eventBus.emit(.applicationsNeededToolsUpdated, sanitized)
        return sanitized
    }

    public func listToolRequests(
        workspaceId: RelayId,
        appId: RelayId? = nil,
        appSlug: String? = nil,
        status: ToolRequestStatus? = nil,
        limit: Int = 100
    ) throws -> [ToolRequestRecord] {
        let cappedLimit = Int64(min(max(limit, 1), 500))
        let rows: [[String: SQLiteValue]]
        if let appId {
            rows = try database.all(
                """
                SELECT request_json FROM applications_tool_requests
                WHERE workspace_id = ? AND app_id = ?
                ORDER BY last_seen_at DESC
                LIMIT ?
                """,
                [.text(workspaceId), .text(appId), .integer(cappedLimit)]
            )
        } else if let appSlug {
            rows = try database.all(
                """
                SELECT request_json FROM applications_tool_requests
                WHERE workspace_id = ? AND app_slug = ?
                ORDER BY last_seen_at DESC
                LIMIT ?
                """,
                [.text(workspaceId), .text(redactString(appSlug)), .integer(cappedLimit)]
            )
        } else {
            rows = try database.all(
                """
                SELECT request_json FROM applications_tool_requests
                WHERE workspace_id = ?
                ORDER BY last_seen_at DESC
                LIMIT ?
                """,
                [.text(workspaceId), .integer(cappedLimit)]
            )
        }
        let decoded = rows.compactMap { decodeJSON(ToolRequestRecord.self, from: $0["request_json"]?.string) }
        guard let status else { return decoded }
        return decoded.filter { $0.status == status }
    }

    public func getToolRequest(workspaceId: RelayId, requestId: RelayId) throws -> ToolRequestRecord? {
        try database.get(
            """
            SELECT request_json FROM applications_tool_requests
            WHERE workspace_id = ? AND id = ?
            LIMIT 1
            """,
            [.text(workspaceId), .text(requestId)]
        ).flatMap { decodeJSON(ToolRequestRecord.self, from: $0["request_json"]?.string) }
    }

    @discardableResult
    public func saveNeededToolsSnapshot(_ snapshot: NeededToolsSnapshot) throws -> NeededToolsSnapshot {
        let sanitized = sanitizeNeededToolsSnapshot(snapshot)
        let id = createRelayId("ntsnap")
        let timestamp = nowIso()
        let snapshotJSON = encodeJSONString(sanitized) ?? "{}"
        try database.run(
            """
            INSERT INTO applications_needed_tools_snapshots (
              id, workspace_id, app_id, state, query_status,
              open_request_count, connected_count, granted_count,
              unavailable_count, selected_request_id, read_only,
              snapshot_json, created_at, updated_at, redaction_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                .text(id),
                .text(sanitized.workspaceId),
                sanitized.appId.sqliteText,
                .text(sanitized.state.rawValue),
                .text(sanitized.queryStatus),
                .integer(Int64(sanitized.summary.openRequestCount)),
                .integer(Int64(sanitized.summary.connectedCount)),
                .integer(Int64(sanitized.summary.grantedCount)),
                .integer(Int64(sanitized.summary.unavailableCount)),
                (sanitized.selectedRequest?.id).sqliteText,
                .integer(sanitized.readOnly ? 1 : 0),
                .text(snapshotJSON),
                .text(timestamp),
                .text(timestamp),
                .text(sanitized.redactionStatus)
            ]
        )
        try retainLatestSnapshots(table: "applications_needed_tools_snapshots", workspaceId: sanitized.workspaceId)
        return sanitized
    }

    public func latestNeededToolsSnapshot(workspaceId: RelayId, appId: RelayId? = nil) throws -> NeededToolsSnapshot? {
        if let appId {
            return try database.get(
                """
                SELECT snapshot_json FROM applications_needed_tools_snapshots
                WHERE workspace_id = ? AND app_id = ?
                ORDER BY updated_at DESC
                LIMIT 1
                """,
                [.text(workspaceId), .text(appId)]
            ).flatMap { decodeJSON(NeededToolsSnapshot.self, from: $0["snapshot_json"]?.string) }
        }
        return try database.get(
            """
            SELECT snapshot_json FROM applications_needed_tools_snapshots
            WHERE workspace_id = ?
            ORDER BY updated_at DESC
            LIMIT 1
            """,
            [.text(workspaceId)]
        ).flatMap { decodeJSON(NeededToolsSnapshot.self, from: $0["snapshot_json"]?.string) }
    }

    public func getMessageLimit() throws -> Int {
        guard let row = try database.get("SELECT value_json FROM settings WHERE scope = 'app' AND scope_id IS NULL AND key = 'message.maxLength'"),
              let value = row["value_json"]?.string,
              let number = Int(value.trimmingCharacters(in: CharacterSet(charactersIn: "\"")))
        else {
            return 32000
        }
        return number
    }

    public func getAppSetting<T: Decodable>(_ key: String, fallback: T) throws -> T {
        guard let row = try database.get("SELECT value_json FROM settings WHERE scope = 'app' AND scope_id IS NULL AND key = ?", [.text(key)]),
              let value = row["value_json"]?.string,
              let data = value.data(using: .utf8),
              let parsed = try? JSONDecoder().decode(T.self, from: data)
        else {
            return fallback
        }
        return parsed
    }

    public func setAppSetting<T: Encodable>(_ key: String, value: T) throws {
        let timestamp = nowIso()
        let data = try JSONEncoder().encode(value)
        let json = String(data: data, encoding: .utf8) ?? "null"
        if let existing = try database.get("SELECT id FROM settings WHERE scope = 'app' AND scope_id IS NULL AND key = ?", [.text(key)]) {
            try database.run("UPDATE settings SET value_json = ?, updated_at = ? WHERE id = ?", [.text(json), .text(timestamp), .text(existing.requireText("id"))])
        } else {
            try database.run(
                "INSERT INTO settings (id, scope, scope_id, key, value_json, created_at, updated_at) VALUES (?, 'app', NULL, ?, ?, ?, ?)",
                [.text(createRelayId("set")), .text(key), .text(json), .text(timestamp), .text(timestamp)]
            )
        }
    }

    private func assertThreadWritable(_ thread: ThreadDetail) throws {
        if thread.isArchived || thread.status == "archived" {
            throw ServiceGuardResult(
                stateKind: .readOnly,
                reasonCode: .authorityReadOnly,
                message: "Archived threads are read-only.",
                recovery: "Return to an active chat before sending.",
                correlationId: "thread-\(thread.id)"
            )
        }
        if let activeSessionId = thread.activeSessionId,
           let row = try database.get("SELECT is_read_only FROM thread_sessions WHERE id = ?", [.text(activeSessionId)]),
           row["is_read_only"]?.bool == true {
            throw ServiceGuardResult(
                stateKind: .readOnly,
                reasonCode: .authorityReadOnly,
                message: "Historical transcripts are read-only.",
                recovery: "Return to the current chat cycle before sending.",
                correlationId: "thread-\(thread.id)"
            )
        }
    }

    private func ensureActiveChatSession(thread: ThreadDetail) throws -> ChatSession {
        if let activeSessionId = thread.activeSessionId,
           let row = try database.get("SELECT * FROM thread_sessions WHERE id = ?", [.text(activeSessionId)]) {
            let session = try mapChatSession(row)
            if !session.isReadOnly && session.status == .active {
                return session
            }
        }
        return try createChatSession(threadId: thread.id)
    }

    private func getChatSession(_ id: String) throws -> ChatSession {
        guard let row = try database.get("SELECT * FROM thread_sessions WHERE id = ?", [.text(id)]) else {
            throw RelayError(.notFound, "Chat session was not found.")
        }
        return try mapChatSession(row)
    }

    private func getThreadReadState(_ id: String) throws -> ThreadReadState {
        guard let row = try database.get("SELECT * FROM thread_read_states WHERE id = ?", [.text(id)]) else {
            throw RelayError(.notFound, "Thread read state was not found.")
        }
        return try mapThreadReadState(row)
    }

    private func getDocumentReference(_ id: String) throws -> ChatDocumentReference {
        guard let row = try database.get("SELECT * FROM chat_document_references WHERE id = ?", [.text(id)]) else {
            throw RelayError(.notFound, "Document reference was not found.")
        }
        return try mapChatDocumentReference(row)
    }

    private func nextChatSessionSequence(threadId: String) throws -> Int {
        let row = try database.get("SELECT COALESCE(MAX(sequence_number), 0) AS sequence_number FROM thread_sessions WHERE thread_id = ?", [.text(threadId)])
        return (row?["sequence_number"]?.int ?? 0) + 1
    }

    private func updateThreadLastMessage(threadId: String, content: String, timestamp: String, senderType: SenderType) throws {
        let snippet = content.count > 160 ? String(content.prefix(157)) + "..." : content
        let unreadFragment = senderType == .user
            ? "read_state = 'read', unread_count = 0, last_read_at = ?,"
            : "read_state = 'unread', unread_count = unread_count + 1,"
        var params: [SQLiteValue] = [.text(snippet), .text(timestamp)]
        if senderType == .user {
            params.append(.text(timestamp))
        }
        params.append(contentsOf: [.text(timestamp), .text(threadId)])
        try database.run(
            "UPDATE threads SET last_message_snippet = ?, last_message_at = ?, \(unreadFragment) updated_at = ? WHERE id = ?",
            params
        )
        if let thread = try? getThread(threadId) {
            eventBus.emit(.threadUpdated, thread)
        }
    }

    private func refreshThreadLastMessageFromDatabase(threadId: String, timestamp: String) throws {
        if let row = try database.get(
            """
            SELECT content, created_at
            FROM messages
            WHERE thread_id = ?
            ORDER BY created_at DESC, id DESC
            LIMIT 1
            """,
            [.text(threadId)]
        ) {
            let content = try row.requireText("content")
            let snippet = content.count > 160 ? String(content.prefix(157)) + "..." : content
            try database.run(
                """
                UPDATE threads
                SET last_message_snippet = ?, last_message_at = ?, updated_at = ?
                WHERE id = ?
                """,
                [.text(snippet), .text(try row.requireText("created_at")), .text(timestamp), .text(threadId)]
            )
        } else {
            try database.run(
                """
                UPDATE threads
                SET last_message_snippet = NULL,
                    last_message_at = NULL,
                    read_state = 'read',
                    unread_count = 0,
                    updated_at = ?
                WHERE id = ?
                """,
                [.text(timestamp), .text(threadId)]
            )
        }
    }

    private func agentDeletionDirectThreadIds(agentId: String, workspaceId: String) throws -> [RelayId] {
        try database
            .all(
                """
                SELECT DISTINCT id
                FROM threads
                WHERE workspace_id = ?
                  AND thread_type = 'direct'
                  AND (
                    selected_agent_id = ?
                    OR EXISTS (
                      SELECT 1
                      FROM thread_participants
                      WHERE thread_id = threads.id
                        AND participant_type = 'agent'
                        AND participant_id = ?
                    )
                    OR EXISTS (
                      SELECT 1
                      FROM messages m
                      WHERE m.thread_id = threads.id
                        AND m.sender_type = 'agent'
                        AND m.sender_id = ?
                    )
                  )
                ORDER BY updated_at DESC, id ASC
                """,
                [.text(workspaceId), .text(agentId), .text(agentId), .text(agentId)]
            )
            .compactMap { $0["id"]?.string }
    }

    private func agentDeletionTeamThreadIds(agentId: String, workspaceId: String) throws -> [RelayId] {
        try database
            .all(
                """
                SELECT DISTINCT id
                FROM threads
                WHERE workspace_id = ?
                  AND thread_type = 'team'
                  AND (
                    selected_agent_id = ?
                    OR EXISTS (
                      SELECT 1
                      FROM thread_participants
                      WHERE thread_id = threads.id
                        AND participant_type = 'agent'
                        AND participant_id = ?
                    )
                    OR EXISTS (
                      SELECT 1
                      FROM messages m
                      WHERE m.thread_id = threads.id
                        AND m.sender_type = 'agent'
                        AND m.sender_id = ?
                    )
                    OR EXISTS (
                      SELECT 1
                      FROM runtime_dispatches rd
                      WHERE rd.thread_id = threads.id
                        AND rd.agent_id = ?
                    )
                  )
                ORDER BY updated_at DESC, id ASC
                """,
                [.text(workspaceId), .text(agentId), .text(agentId), .text(agentId), .text(agentId)]
            )
            .compactMap { $0["id"]?.string }
    }

    private func agentDeletionTeamMessageCount(agentId: String, workspaceId: String) throws -> Int {
        try database
            .get(
                """
                SELECT COUNT(*) AS value
                FROM messages m
                JOIN threads t ON t.id = m.thread_id
                WHERE t.workspace_id = ?
                  AND t.thread_type = 'team'
                  AND m.sender_type = 'agent'
                  AND m.sender_id = ?
                """,
                [.text(workspaceId), .text(agentId)]
            )?["value"]?.int ?? 0
    }

    private func safeReferenceDisplayPath(_ value: String?, isRedacted: Bool) -> String? {
        guard let value, !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return nil }
        if isRedacted {
            return "[REDACTED]"
        }
        let lastComponent = URL(fileURLWithPath: value).lastPathComponent
        return lastComponent.isEmpty ? nil : lastComponent
    }

    private func requireAgentInWorkspace(_ agentId: String, workspaceId: String, field: String) throws {
        let agent = try getAgent(agentId)
        guard agent.workspaceId == workspaceId else {
            throw RelayError(.invalidInput, "\(field) does not belong to this workspace.")
        }
    }

    private func appendAuditFilters(
        filters: inout [String],
        params: inout [SQLiteValue],
        eventType: String?,
        resourceType: String?,
        resourceId: RelayId?,
        severity: String?,
        from: IsoTimestamp?,
        to: IsoTimestamp?
    ) {
        if let eventType = eventType?.nilIfBlank {
            filters.append("event_type = ?")
            params.append(.text(redactString(eventType)))
        }
        if let resourceType = resourceType?.nilIfBlank {
            filters.append("resource_type = ?")
            params.append(.text(redactString(resourceType)))
        }
        if let resourceId = resourceId?.nilIfBlank {
            filters.append("resource_id = ?")
            params.append(.text(redactString(resourceId)))
        }
        if let severity = severity?.nilIfBlank {
            filters.append("severity = ?")
            params.append(.text(redactString(severity)))
        }
        if let from = from?.nilIfBlank {
            filters.append("created_at >= ?")
            params.append(.text(from))
        }
        if let to = to?.nilIfBlank {
            filters.append("created_at <= ?")
            params.append(.text(to))
        }
    }

    @discardableResult
    private func mirrorAuditLogEvent(_ event: LogEvent) throws -> AuditLogRecord? {
        guard let workspaceId = event.detail["workspaceId"]?.string?.nilIfBlank else {
            return nil
        }
        let actorId = event.detail["actorId"]?.string
            ?? event.detail["resolvedByActorId"]?.string
            ?? event.detail["expiredByActorId"]?.string
            ?? event.detail["updatedByActorId"]?.string
            ?? event.detail["createdByActorId"]?.string
            ?? "system"
        let actorType = event.detail["actorType"]?.string ?? (actorId == "system" ? "system" : "user")
        let approvalId = event.detail["approvalId"]?.string
        let taskId = event.detail["taskId"]?.string
        let actionRunId = event.detail["actionRunId"]?.string
        let resourceType = event.detail["resourceType"]?.string
            ?? auditResourceType(category: event.category, detail: event.detail)
        let resourceId = event.category == "permission.policy"
            ? event.detail["policyId"]?.string
            : event.detail["resourceId"]?.string
            ?? approvalId
            ?? taskId
            ?? actionRunId
            ?? event.dispatchId
            ?? event.threadId
        var context = event.detail
        context["eventLogId"] = .string(event.id)
        context["eventCategory"] = .string(event.category)
        context["redactionStatus"] = .string("private-state-excluded")
        let audit = AuditLogRecord(
            id: "aud-\(event.id)",
            workspaceId: workspaceId,
            actorId: actorId,
            actorType: actorType,
            eventType: auditEventType(category: event.category, detail: event.detail, message: event.message),
            resourceType: resourceType,
            resourceId: resourceId,
            severity: event.severity,
            message: event.message,
            correlationId: event.correlationId,
            taskId: taskId,
            approvalId: approvalId,
            actionRunId: actionRunId,
            dispatchId: event.dispatchId ?? event.detail["dispatchId"]?.string,
            threadId: event.threadId ?? event.detail["threadId"]?.string,
            harnessId: event.harnessId ?? event.detail["harnessId"]?.string,
            source: "event_log.\(event.category)",
            context: context,
            writeStatus: "mirrored",
            createdAt: event.timestamp,
            redactionStatus: "private-state-excluded"
        )
        return try saveAuditLogRecord(audit)
    }

    private func auditEventType(category: String, detail: JSONRecord, message: String) -> String {
        switch category {
        case "permission.denied":
            return "permission.denied"
        case "permission.policy":
            let action = detail["action"]?.string ?? "changed"
            return action.hasPrefix("permission_policy.") ? action : "permission_policy.\(action)"
        case "authority":
            return "authority.denied_action"
        case "work-safety.approval":
            if message.lowercased().contains("denied") {
                return "approval.denied"
            }
            return "approval.decision"
        case "work-safety.task":
            return "task.transition"
        case "applications.tool-request":
            return "tool_request.transition"
        case "runtime.recovery":
            return "recovery.event"
        case "command.rejection":
            return "command.rejected"
        case "file.permission":
            return "file_permission.changed"
        case "export.reset":
            return "export_reset.attempt"
        case "audit.writer":
            return "audit.writer_failure"
        default:
            if category.contains("recovery") { return "recovery.event" }
            if category.contains("tool") { return "tool_request.transition" }
            if category.contains("command") { return "command.rejected" }
            if category.contains("runtime") { return "runtime.event" }
            return category.replacingOccurrences(of: "-", with: "_")
        }
    }

    private func auditResourceType(category: String, detail: JSONRecord) -> String {
        switch category {
        case "permission.policy":
            return "permission_policy"
        case "permission.denied":
            return detail["resourceType"]?.string ?? "permission"
        case "authority":
            return detail["action"]?.string ?? "authority"
        case "work-safety.approval":
            return "work_safety_approval"
        case "work-safety.task":
            return "work_safety_task"
        case "applications.tool-request":
            return "tool_request"
        case "runtime.recovery":
            return "runtime_recovery"
        case "command.rejection":
            return "command"
        case "file.permission":
            return "file_permission"
        case "export.reset":
            return "export_reset"
        case "audit.writer":
            return "audit_writer"
        default:
            return category.replacingOccurrences(of: "-", with: "_")
        }
    }

    private func retainLatestSnapshots(table: String, workspaceId: String, limit: Int = 25) throws {
        let allowed = [
            "applications_catalog_snapshots",
            "applications_provider_connection_snapshots",
            "applications_marketplace_install_snapshots",
            "applications_needed_tools_snapshots"
        ]
        guard allowed.contains(table) else {
            throw RelayError(.invalidInput, "Unsupported snapshot retention table.")
        }
        try database.run(
            "DELETE FROM \(table) WHERE workspace_id=? AND id NOT IN (SELECT id FROM \(table) WHERE workspace_id=? ORDER BY updated_at DESC,id DESC LIMIT ?)",
            [.text(workspaceId), .text(workspaceId), .integer(Int64(max(1, min(limit, 100))))]
        )
    }
}

private extension Optional where Wrapped == String {
    var sqliteText: SQLiteValue {
        guard let self else { return .null }
        return .text(self)
    }
}

private extension Optional where Wrapped == JSONRecord {
    var sqliteText: SQLiteValue {
        guard let self else { return .null }
        return .text(encodeJSONRecord(self))
    }
}

private extension String {
    var nilIfBlank: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}

private let profileAvatarMaxLength = 4_250_000
private let supportedThemes = Set(["classic"])
private let supportedWorkspaceTypes = Set(["personal", "business", "team"])
private let supportedSettingsPanels = Set([
    "account",
    "appearance",
    "workspace",
    "team",
    "integrations",
    "notifications",
    "security",
    "harnesses",
    "runtime"
])

private func normalizedEmail(_ value: String?) throws -> String? {
    guard let email = try optionalTrimmedString(value, field: "Email", maxLength: 254) else {
        return nil
    }
    guard email.contains("@"), !email.hasPrefix("@"), !email.hasSuffix("@") else {
        throw RelayError(.invalidInput, "Email must contain a local part and domain.")
    }
    return email
}

private func normalizedTheme(_ value: String?) throws -> String {
    let theme = try optionalTrimmedString(value, field: "Theme", maxLength: 40) ?? "classic"
    guard supportedThemes.contains(theme) else {
        throw RelayError(.unsupported, "Selected theme is not available yet.")
    }
    return theme
}

private func normalizedWorkspaceType(_ value: String?) throws -> String {
    let workspaceType = try optionalTrimmedString(value, field: "Workspace type", maxLength: 40) ?? "personal"
    guard supportedWorkspaceTypes.contains(workspaceType) else {
        throw RelayError(.unsupported, "Selected workspace type is not available.")
    }
    return workspaceType
}

private func normalizedSettingsPanel(_ value: String) throws -> String {
    let panel = try requireNonEmptyString(value, field: "Settings panel", maxLength: 80)
    guard supportedSettingsPanels.contains(panel) else {
        throw RelayError(.unsupported, "Selected settings panel is not available.")
    }
    return panel
}

private let harnessOperationalConfigKeys: Set<String> = [
    "installPath",
    "selectedLocalPath",
    "hermesHome",
    "openClawHome",
    "openClawStateDir",
    "openClawConfigPath",
    "openClawNodePath",
    "openClawPnpmPath",
    "openClawInstallLogPath",
    "modelAuthCommand",
    "runtimeCommand",
    "healthCheckCommand"
]

private func redactHarnessConfigForStorage(_ value: JSONRecord) -> JSONRecord {
    var redacted = redactRecord(value)
    for key in harnessOperationalConfigKeys {
        if let operationalValue = value[key] {
            redacted[key] = redactHarnessOperationalConfigValue(operationalValue)
        }
    }
    return redacted
}

private func redactHarnessOperationalConfigValue(_ value: JSONValue) -> JSONValue {
    switch value {
    case .string(let string):
        return .string(redactString(string))
    case .object(let object):
        return .object(Dictionary(uniqueKeysWithValues: object.map { key, value in
            (key, redactHarnessOperationalConfigValue(value))
        }))
    case .array(let array):
        return .array(array.map(redactHarnessOperationalConfigValue))
    default:
        return value
    }
}

private func normalizedAvatarReference(_ value: String?, avatarState: AgentAvatarState) throws -> String? {
    switch avatarState {
    case .fallback, .noAvatar:
        return nil
    case .illustrated:
        guard let reference = try optionalTrimmedString(value, field: "Avatar", maxLength: profileAvatarMaxLength),
              reference.hasPrefix("avatars/")
        else {
            throw RelayError(.invalidInput, "Choose a bundled avatar.")
        }
        return reference
    case .uploaded:
        guard let reference = try optionalTrimmedString(value, field: "Avatar", maxLength: profileAvatarMaxLength) else {
            throw RelayError(.invalidInput, "Choose an uploaded avatar.")
        }
        return reference
    }
}

private func redactProvisioningRecord(_ value: JSONRecord) -> JSONRecord {
    Dictionary(uniqueKeysWithValues: value.map { key, value in
        (key, redactProvisioningValue(keyHint: key, value: value))
    })
}

private func redactProvisioningValue(keyHint: String?, value: JSONValue) -> JSONValue {
    switch value {
    case .string(let string):
        if shouldRedactProvisioningValue(keyHint) {
            return .string("[REDACTED]")
        }
        if isProvisioningPathKey(keyHint) || looksLikeLocalPath(string) {
            return .string("[REDACTED]")
        }
        return .string(redactString(string))
    case .object(let object):
        if shouldRedactProvisioningValue(keyHint) {
            return .string("[REDACTED]")
        }
        return .object(Dictionary(uniqueKeysWithValues: object.map { key, value in
            (key, redactProvisioningValue(keyHint: key, value: value))
        }))
    case .array(let array):
        if shouldRedactProvisioningValue(keyHint) {
            return .string("[REDACTED]")
        }
        return .array(array.map { redactProvisioningValue(keyHint: keyHint, value: $0) })
    default:
        return value
    }
}

private func shouldRedactProvisioningValue(_ keyHint: String?) -> Bool {
    guard let keyHint else { return false }
    let normalized = keyHint
        .trimmingCharacters(in: .whitespacesAndNewlines)
        .lowercased()
        .replacingOccurrences(of: "-", with: "_")
    if [
        "password",
        "secret",
        "token",
        "credential",
        "authorization",
        "auth_header",
        "private_key",
        "client_secret",
        "access_token",
        "refresh_token",
        "raw_bridge_payload",
        "raw_command",
        "command_line",
        "commandline",
        "arguments",
        "argv",
        "runtime_payload"
    ].contains(normalized) {
        return true
    }
    if normalized.contains("password")
        || normalized.contains("credential")
        || normalized.contains("authorization")
        || normalized.contains("_token")
        || normalized.hasSuffix("token")
        || normalized.contains("access_token")
        || normalized.contains("refresh_token")
        || normalized.contains("client_secret")
        || normalized.contains("private_key") {
        return true
    }
    if normalized.contains("command") && !normalized.hasSuffix("id") {
        return true
    }
    return false
}

private func sanitizeProviderConnection(_ connection: MarketplaceProviderConnection) -> MarketplaceProviderConnection {
    var sanitized = normalizeProviderConnectionExecutionAuthority(connection)
    sanitized.appSlug = redactString(connection.appSlug)
    sanitized.providerKey = redactString(connection.providerKey)
    sanitized.providerName = redactProviderSecretText(connection.providerName)
    sanitized.credentialRequirements = connection.credentialRequirements.map(sanitizeProviderCredentialRequirement)
    sanitized.secretReferenceIds = uniqueStrings(connection.secretReferenceIds)
    sanitized.accountLabel = connection.accountLabel.map(redactProviderSecretText)
    sanitized.connectedHandle = connection.connectedHandle.map(redactProviderSecretText)
    sanitized.callbackURL = redactExternalAuthorizationURL(connection.callbackURL)
    sanitized.requiredScopes = sanitizeStringList(connection.requiredScopes)
    sanitized.grantedScopes = sanitizeStringList(connection.grantedScopes)
    sanitized.selectedCapabilities = sanitizeStringList(connection.selectedCapabilities)
    sanitized.health = sanitizeProviderConnectorHealth(connection.health)
    sanitized.senderIdentities = connection.senderIdentities.map(sanitizeProviderSenderIdentity)
    sanitized.installPolicy = connection.installPolicy.map(redactProviderSecretText)
    sanitized.lastError = connection.lastError.map(redactProviderSecretText)
    sanitized.manualEvidenceNote = connection.manualEvidenceNote.map(redactProviderSecretText)
    sanitized.redactionStatus = "private-state-excluded"
    return sanitized
}

private func sanitizeProviderCredentialRequirement(_ requirement: ProviderCredentialRequirement) -> ProviderCredentialRequirement {
    var sanitized = requirement
    sanitized.fieldKey = redactString(requirement.fieldKey)
    sanitized.label = redactProviderSecretText(requirement.label)
    sanitized.helpText = requirement.helpText.map(redactProviderSecretText)
    sanitized.redactionStatus = "secret-reference-only"
    return sanitized
}

private func sanitizeProviderConnectorHealth(_ health: ProviderConnectorHealth) -> ProviderConnectorHealth {
    var sanitized = health
    sanitized.message = redactProviderSecretText(health.message)
    sanitized.missingScopes = sanitizeStringList(health.missingScopes)
    sanitized.unavailableTools = sanitizeStringList(health.unavailableTools)
    sanitized.diagnostics = redactProvisioningRecord(health.diagnostics)
    sanitized.redactionStatus = "private-state-excluded"
    return sanitized
}

private func sanitizeProviderSenderIdentity(_ identity: ProviderSenderIdentity) -> ProviderSenderIdentity {
    var sanitized = identity
    sanitized.email = redactProviderSecretText(identity.email)
    sanitized.errorMessage = identity.errorMessage.map(redactProviderSecretText)
    sanitized.redactionStatus = "private-state-excluded"
    return sanitized
}

private func sanitizeProviderAuthorizationFlow(_ flow: ProviderAuthorizationFlow) -> ProviderAuthorizationFlow {
    var sanitized = flow
    sanitized.providerKey = redactString(flow.providerKey)
    sanitized.callbackURL = redactExternalAuthorizationURL(flow.callbackURL)
    sanitized.authorizationURL = redactExternalAuthorizationURL(flow.authorizationURL)
    sanitized.deepLinkURL = redactExternalAuthorizationURL(flow.deepLinkURL)
    sanitized.manualEvidenceNote = flow.manualEvidenceNote.map(redactProviderSecretText)
    sanitized.errorMessage = flow.errorMessage.map(redactProviderSecretText)
    sanitized.redactionStatus = "private-state-excluded"
    return sanitized
}

private func sanitizeProviderConnectionSnapshot(_ snapshot: ProviderConnectionSnapshot) -> ProviderConnectionSnapshot {
    var sanitized = snapshot
    sanitized.appSlug = snapshot.appSlug.map(redactString)
    sanitized.connections = snapshot.connections.map(sanitizeProviderConnection)
    sanitized.authorizationFlows = snapshot.authorizationFlows.map(sanitizeProviderAuthorizationFlow)
    sanitized.selectedConnection = snapshot.selectedConnection.map(sanitizeProviderConnection)
    sanitized.diagnostics = ProviderConnectionDiagnostics(
        connectorHealthSummary: redactProviderSecretText(snapshot.diagnostics.connectorHealthSummary),
        oauthStateSummary: redactProviderSecretText(snapshot.diagnostics.oauthStateSummary),
        keychainReferenceSummary: redactProviderSecretText(snapshot.diagnostics.keychainReferenceSummary),
        senderIdentitySummary: redactProviderSecretText(snapshot.diagnostics.senderIdentitySummary),
        userOwnedCredentialSummary: redactProviderSecretText(snapshot.diagnostics.userOwnedCredentialSummary),
        manualEvidenceSummary: redactProviderSecretText(snapshot.diagnostics.manualEvidenceSummary),
        message: redactProviderSecretText(snapshot.diagnostics.message)
    )
    sanitized.redactionStatus = "private-state-excluded"
    return sanitized
}

private func sanitizeMarketplaceInstallRecord(_ install: MarketplaceInstallRecord) -> MarketplaceInstallRecord {
    var sanitized = normalizeMarketplaceInstallExecutionAuthority(install)
    sanitized.appSlug = redactString(install.appSlug)
    sanitized.agentName = redactProviderSecretText(install.agentName)
    sanitized.roleId = redactString(install.roleId)
    sanitized.roleLabel = redactProviderSecretText(install.roleLabel)
    sanitized.selectedCapabilities = sanitizeStringList(install.selectedCapabilities)
    sanitized.failureMessage = install.failureMessage.map(redactProviderSecretText)
    sanitized.metadata = redactProvisioningRecord(install.metadata)
    sanitized.redactionStatus = "private-state-excluded"
    return sanitized
}

private func sanitizeMarketplaceCompatibleAgentTarget(_ target: MarketplaceCompatibleAgentTarget) -> MarketplaceCompatibleAgentTarget {
    var sanitized = target
    sanitized.agentName = redactProviderSecretText(target.agentName)
    sanitized.agentRole = target.agentRole.map(redactProviderSecretText)
    sanitized.supportedRoles = sanitizeStringList(target.supportedRoles)
    sanitized.unavailableReason = target.unavailableReason.map(redactProviderSecretText)
    sanitized.redactionStatus = "private-state-excluded"
    return sanitized
}

private func sanitizeMarketplaceInstallDiagnostics(_ diagnostics: MarketplaceInstallDiagnostics) -> MarketplaceInstallDiagnostics {
    MarketplaceInstallDiagnostics(
        compatibleAgentSummary: redactProviderSecretText(diagnostics.compatibleAgentSummary),
        installSummary: redactProviderSecretText(diagnostics.installSummary),
        driftSummary: redactProviderSecretText(diagnostics.driftSummary),
        runtimeWriteSummary: redactProviderSecretText(diagnostics.runtimeWriteSummary),
        removalSummary: redactProviderSecretText(diagnostics.removalSummary),
        message: redactProviderSecretText(diagnostics.message)
    )
}

private func sanitizeMarketplaceInstallSnapshot(_ snapshot: MarketplaceInstallSnapshot) -> MarketplaceInstallSnapshot {
    var sanitized = snapshot
    sanitized.appSlug = snapshot.appSlug.map(redactString)
    sanitized.installs = snapshot.installs.map(sanitizeMarketplaceInstallRecord)
    sanitized.compatibleAgents = snapshot.compatibleAgents.map(sanitizeMarketplaceCompatibleAgentTarget)
    sanitized.selectedInstall = snapshot.selectedInstall.map(sanitizeMarketplaceInstallRecord)
    sanitized.diagnostics = sanitizeMarketplaceInstallDiagnostics(snapshot.diagnostics)
    sanitized.redactionStatus = "private-state-excluded"
    return sanitized
}

private func sanitizeMarketplaceProviderActionDefinition(_ definition: MarketplaceProviderActionDefinition) -> MarketplaceProviderActionDefinition {
    var sanitized = definition
    sanitized.appSlug = redactString(definition.appSlug)
    sanitized.providerKey = redactString(definition.providerKey)
    sanitized.actionKey = redactString(definition.actionKey)
    sanitized.displayName = redactProviderSecretText(definition.displayName)
    sanitized.summary = redactProviderSecretText(definition.summary)
    sanitized.requiredScopes = sanitizeStringList(definition.requiredScopes)
    sanitized.capabilityKeys = sanitizeStringList(definition.capabilityKeys)
    sanitized.payloadSchema = redactProvisioningRecord(definition.payloadSchema)
    sanitized.resultSchema = redactProvisioningRecord(definition.resultSchema)
    sanitized.redactionStatus = "private-state-excluded"
    return sanitized
}

private func sanitizeMarketplaceActionPermissionMap(_ map: MarketplaceActionPermissionMap) -> MarketplaceActionPermissionMap {
    var sanitized = normalizeMarketplacePermissionMapExecutionAuthority(map)
    sanitized.appSlug = redactString(map.appSlug)
    var reasons: [String: String] = [:]
    for (key, value) in map.blockedReasons {
        reasons[redactString(key)] = redactProviderSecretText(value)
    }
    sanitized.blockedReasons = reasons
    sanitized.source = redactString(map.source)
    sanitized.redactionStatus = "private-state-excluded"
    return sanitized
}

private func normalizeProviderConnectionExecutionAuthority(
    _ connection: MarketplaceProviderConnection
) -> MarketplaceProviderConnection {
    guard connection.executionAuthority == nil, connection.executionAuthorityVersion == nil else {
        return connection
    }
    var normalized = connection
    normalized.executionAuthority = MarketplaceExecutionAuthority.inferredLegacyConnectionAuthority(
        appSlug: connection.appSlug,
        secretReferenceIds: connection.secretReferenceIds
    )
    normalized.executionAuthorityVersion = MarketplaceExecutionAuthority.contractVersion
    return normalized
}

private func normalizeMarketplaceInstallExecutionAuthority(
    _ install: MarketplaceInstallRecord
) -> MarketplaceInstallRecord {
    guard install.executionAuthority == nil, install.executionAuthorityVersion == nil else {
        return install
    }
    var normalized = install
    normalized.executionAuthority = MarketplaceExecutionAuthority.currentSwiftAdapterAuthority(for: install.appSlug)
    normalized.executionAuthorityVersion = MarketplaceExecutionAuthority.contractVersion
    return normalized
}

private func normalizeMarketplacePermissionMapExecutionAuthority(
    _ map: MarketplaceActionPermissionMap
) -> MarketplaceActionPermissionMap {
    guard map.executionAuthority == nil, map.executionAuthorityVersion == nil else {
        return map
    }
    var normalized = map
    normalized.executionAuthority = MarketplaceExecutionAuthority.currentSwiftAdapterAuthority(for: map.appSlug)
    normalized.executionAuthorityVersion = MarketplaceExecutionAuthority.contractVersion
    return normalized
}

private func sanitizeProviderActionApprovalReference(_ reference: ProviderActionApprovalReference) -> ProviderActionApprovalReference {
    var sanitized = reference
    sanitized.redactionStatus = "private-state-excluded"
    return sanitized
}

private func sanitizeMarketplaceProviderActionApprovalRecord(_ approval: MarketplaceProviderActionApprovalRecord) -> MarketplaceProviderActionApprovalRecord {
    var sanitized = approval
    sanitized.appSlug = redactString(approval.appSlug)
    sanitized.actionKey = redactString(approval.actionKey)
    sanitized.proposedPayload = redactProvisioningRecord(approval.proposedPayload)
    sanitized.metadata = redactProvisioningRecord(approval.metadata)
    sanitized.redactionStatus = "private-state-excluded"
    return sanitized
}

private func sanitizeProviderExecutionAuditIdentity(_ identity: ProviderExecutionAuditIdentity) -> ProviderExecutionAuditIdentity {
    var sanitized = identity
    sanitized.actorRole = identity.actorRole.map(redactProviderSecretText)
    sanitized.appSlug = redactString(identity.appSlug)
    sanitized.source = redactString(identity.source)
    sanitized.redactionStatus = "private-state-excluded"
    return sanitized
}

private func sanitizeMarketplaceProviderActionExecutionRecord(_ execution: MarketplaceProviderActionExecutionRecord) -> MarketplaceProviderActionExecutionRecord {
    var sanitized = execution
    sanitized.appSlug = redactString(execution.appSlug)
    sanitized.actionKey = redactString(execution.actionKey)
    sanitized.requestedPayload = redactProvisioningRecord(execution.requestedPayload)
    sanitized.approvalReference = execution.approvalReference.map(sanitizeProviderActionApprovalReference)
    sanitized.auditIdentity = sanitizeProviderExecutionAuditIdentity(execution.auditIdentity)
    sanitized.providerResult = execution.providerResult.map(redactProvisioningRecord)
    sanitized.providerError = execution.providerError.map(redactProvisioningRecord)
    sanitized.redactionStatus = "private-state-excluded"
    return sanitized
}

private func sanitizeToolRequestSuggestedApp(_ app: ToolRequestSuggestedApp) -> ToolRequestSuggestedApp {
    var sanitized = app
    sanitized.appSlug = redactString(app.appSlug)
    sanitized.appName = redactProviderSecretText(app.appName)
    sanitized.category = redactProviderSecretText(app.category)
    sanitized.matchingCapabilities = sanitizeStringList(app.matchingCapabilities)
    sanitized.guidance = redactToolRequestText(app.guidance)
    sanitized.redactionStatus = "private-state-excluded"
    return sanitized
}

private func sanitizeToolRequestRecord(_ request: ToolRequestRecord) -> ToolRequestRecord {
    var sanitized = request
    sanitized.requestedCapability = redactToolRequestText(request.requestedCapability)
    sanitized.normalizedCapability = redactToolRequestText(request.normalizedCapability)
    sanitized.appSlug = request.appSlug.map(redactString)
    sanitized.agentName = request.agentName.map(redactProviderSecretText)
    sanitized.campaign = request.campaign.map(redactToolRequestText)
    sanitized.reason = redactToolRequestText(request.reason)
    sanitized.requiredAction = redactToolRequestText(request.requiredAction)
    sanitized.evidence = request.evidence.map(redactToolRequestText)
    sanitized.suggestedApps = request.suggestedApps.map(sanitizeToolRequestSuggestedApp)
    sanitized.metadata = redactProvisioningRecord(request.metadata)
    sanitized.resolutionNote = request.resolutionNote.map(redactToolRequestText)
    sanitized.redactionStatus = "private-state-excluded"
    return sanitized
}

private func sanitizeNeededToolsSummary(_ summary: NeededToolsSummary) -> NeededToolsSummary {
    var sanitized = summary
    sanitized.appSlug = summary.appSlug.map(redactString)
    sanitized.queryStatus = redactToolRequestText(summary.queryStatus)
    sanitized.redactionStatus = "private-state-excluded"
    return sanitized
}

private func sanitizeNeededToolsDiagnostics(_ diagnostics: NeededToolsDiagnostics) -> NeededToolsDiagnostics {
    NeededToolsDiagnostics(
        openSummary: redactToolRequestText(diagnostics.openSummary),
        connectionSummary: redactToolRequestText(diagnostics.connectionSummary),
        grantSummary: redactToolRequestText(diagnostics.grantSummary),
        unavailableSummary: redactToolRequestText(diagnostics.unavailableSummary),
        message: redactToolRequestText(diagnostics.message)
    )
}

private func sanitizeNeededToolsSnapshot(_ snapshot: NeededToolsSnapshot) -> NeededToolsSnapshot {
    var sanitized = snapshot
    sanitized.appSlug = snapshot.appSlug.map(redactString)
    sanitized.queryStatus = redactToolRequestText(snapshot.queryStatus)
    sanitized.requests = snapshot.requests.map(sanitizeToolRequestRecord)
    sanitized.selectedRequest = snapshot.selectedRequest.map(sanitizeToolRequestRecord)
    sanitized.summary = sanitizeNeededToolsSummary(snapshot.summary)
    sanitized.diagnostics = sanitizeNeededToolsDiagnostics(snapshot.diagnostics)
    sanitized.redactionStatus = "private-state-excluded"
    return sanitized
}

private func sanitizeSettingsAlertRecord(_ alert: SettingsAlertRecord) -> SettingsAlertRecord {
    var sanitized = alert
    sanitized.title = redactString(alert.title)
    sanitized.message = redactString(alert.message)
    sanitized.category = redactString(alert.category)
    sanitized.sourceKind = redactString(alert.sourceKind)
    sanitized.actionLabel = alert.actionLabel.map(redactString)
    sanitized.actionTarget = alert.actionTarget.map(redactString)
    sanitized.metadata = redactRecord(alert.metadata)
    sanitized.redactionStatus = "private-state-excluded"
    return sanitized
}

private func sanitizeSettingsNotificationPreferences(
    _ preferences: SettingsNotificationPreferences
) -> SettingsNotificationPreferences {
    var sanitized = preferences
    sanitized.emailDeliveryState = .unavailable
    sanitized.mobileDeliveryState = .unavailable
    sanitized.metadata = redactRecord(preferences.metadata.merging([
        "emailDeliveryPersisted": .bool(false),
        "mobileDeliveryPersisted": .bool(false)
    ]) { _, new in new })
    sanitized.redactionStatus = "private-state-excluded"
    return sanitized
}

private func sanitizeSettingsDecisionGateDisposition(
    _ disposition: SettingsDecisionGateDisposition
) -> SettingsDecisionGateDisposition {
    var sanitized = disposition
    sanitized.decisionId = redactString(disposition.decisionId)
    sanitized.surface = redactString(disposition.surface)
    sanitized.currentUiState = redactString(disposition.currentUiState)
    sanitized.missingPrerequisites = redactString(disposition.missingPrerequisites)
    sanitized.activationRequirement = redactString(disposition.activationRequirement)
    sanitized.releaseImpact = redactString(disposition.releaseImpact)
    sanitized.metadata = redactRecord(disposition.metadata)
    sanitized.redactionStatus = "private-state-excluded"
    return sanitized
}

private func sanitizeSettingsLocalAccountExport(
    _ export: SettingsLocalAccountExportRecord
) -> SettingsLocalAccountExportRecord {
    var sanitized = export
    sanitized.status = redactString(export.status)
    sanitized.fileName = redactString(export.fileName)
    sanitized.includesSecrets = false
    sanitized.exportMetadata = redactRecord(export.exportMetadata.merging([
        "includesSecrets": .bool(false),
        "rawValuesIncluded": .bool(false)
    ]) { _, new in new })
    sanitized.redactionStatus = "private-state-excluded"
    return sanitized
}

private func sanitizeWorkSafetyLinkedReferences(_ references: WorkSafetyLinkedReferences) -> WorkSafetyLinkedReferences {
    WorkSafetyLinkedReferences(
        actionRunId: references.actionRunId.map(redactWorkSafetyText),
        dispatchId: references.dispatchId.map(redactWorkSafetyText),
        structuredJobId: references.structuredJobId.map(redactWorkSafetyText),
        sourceHostRecordId: references.sourceHostRecordId.map(redactWorkSafetyText),
        scheduledMessageId: references.scheduledMessageId.map(redactWorkSafetyText)
    )
}

private func sanitizeWorkSafetyTaskRecord(_ task: WorkSafetyTaskRecord) -> WorkSafetyTaskRecord {
    var sanitized = task
    sanitized.title = redactWorkSafetyText(task.title)
    sanitized.message = task.message.map(redactWorkSafetyText)
    sanitized.targetId = task.targetId.map(redactWorkSafetyText)
    sanitized.linkedReferences = sanitizeWorkSafetyLinkedReferences(task.linkedReferences)
    sanitized.recurrenceRule = task.recurrenceRule.map(redactWorkSafetyText)
    sanitized.metadata = redactProvisioningRecord(task.metadata)
    sanitized.redactionStatus = "private-state-excluded"
    return sanitized
}

private func sanitizeWorkSafetyTaskRunRecord(_ run: WorkSafetyTaskRunRecord) -> WorkSafetyTaskRunRecord {
    var sanitized = run
    sanitized.linkedReferences = sanitizeWorkSafetyLinkedReferences(run.linkedReferences)
    sanitized.failureMessage = run.failureMessage.map(redactWorkSafetyText)
    sanitized.metadata = redactProvisioningRecord(run.metadata)
    sanitized.redactionStatus = "private-state-excluded"
    return sanitized
}

private func sanitizeWorkSafetyTaskEventRecord(_ event: WorkSafetyTaskEventRecord) -> WorkSafetyTaskEventRecord {
    var sanitized = event
    sanitized.status = redactWorkSafetyText(event.status)
    sanitized.detail = redactProvisioningRecord(event.detail)
    sanitized.redactionStatus = "private-state-excluded"
    return sanitized
}

private func sanitizeWorkSafetyApprovalStep(_ step: WorkSafetyApprovalStepRecord) -> WorkSafetyApprovalStepRecord {
    var sanitized = step
    sanitized.label = redactWorkSafetyText(step.label)
    sanitized.value = step.value.map(redactWorkSafetyText)
    sanitized.redactionStatus = "private-state-excluded"
    return sanitized
}

private func sanitizeWorkSafetyApprovalNote(_ note: WorkSafetyApprovalNoteRecord) -> WorkSafetyApprovalNoteRecord {
    var sanitized = note
    sanitized.note = redactWorkSafetyText(note.note)
    sanitized.redactionStatus = "private-state-excluded"
    return sanitized
}

private func sanitizeWorkSafetyApprovalRecord(_ approval: WorkSafetyApprovalRecord) -> WorkSafetyApprovalRecord {
    var sanitized = approval
    sanitized.title = redactWorkSafetyText(approval.title)
    sanitized.description = approval.description.map(redactWorkSafetyText)
    sanitized.steps = approval.steps.map(sanitizeWorkSafetyApprovalStep)
    sanitized.notes = approval.notes.map(sanitizeWorkSafetyApprovalNote)
    sanitized.metadata = redactProvisioningRecord(approval.metadata)
    sanitized.redactionStatus = "private-state-excluded"
    return sanitized
}

private func sanitizeAuditLogRecord(_ record: AuditLogRecord) -> AuditLogRecord {
    var sanitized = record
    sanitized.actorId = redactWorkSafetyText(record.actorId)
    sanitized.actorType = redactWorkSafetyText(record.actorType)
    sanitized.eventType = redactWorkSafetyText(record.eventType.trimmingCharacters(in: .whitespacesAndNewlines).lowercased())
    sanitized.resourceType = redactWorkSafetyText(record.resourceType.trimmingCharacters(in: .whitespacesAndNewlines).lowercased())
    sanitized.resourceId = record.resourceId.map(redactWorkSafetyText)
    sanitized.severity = redactWorkSafetyText(record.severity.trimmingCharacters(in: .whitespacesAndNewlines).lowercased())
    sanitized.message = redactWorkSafetyText(record.message)
    sanitized.correlationId = record.correlationId.map(redactWorkSafetyText)
    sanitized.taskId = record.taskId.map(redactWorkSafetyText)
    sanitized.approvalId = record.approvalId.map(redactWorkSafetyText)
    sanitized.actionRunId = record.actionRunId.map(redactWorkSafetyText)
    sanitized.dispatchId = record.dispatchId.map(redactWorkSafetyText)
    sanitized.threadId = record.threadId.map(redactWorkSafetyText)
    sanitized.harnessId = record.harnessId.map(redactWorkSafetyText)
    sanitized.source = redactWorkSafetyText(record.source)
    sanitized.context = redactProvisioningRecord(record.context)
    sanitized.writeStatus = redactWorkSafetyText(record.writeStatus.trimmingCharacters(in: .whitespacesAndNewlines).lowercased())
    sanitized.redactionStatus = "private-state-excluded"
    return sanitized
}

private func sanitizeSecurityMetricSnapshot(_ snapshot: SecurityMetricSnapshot) -> SecurityMetricSnapshot {
    var sanitized = snapshot
    sanitized.categoryCounts = redactProvisioningRecord(snapshot.categoryCounts)
    sanitized.redactionStatus = "private-state-excluded"
    return sanitized
}

private func sanitizePermissionPolicy(_ policy: PermissionPolicyRecord) -> PermissionPolicyRecord {
    var sanitized = policy
    sanitized.name = redactWorkSafetyText(policy.name)
    sanitized.roleTargets = uniqueStrings(sanitizeStringList(policy.roleTargets.map { $0.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() }))
    sanitized.resourceType = redactWorkSafetyText(policy.resourceType.trimmingCharacters(in: .whitespacesAndNewlines).lowercased())
    sanitized.resourceId = policy.resourceId.map(redactWorkSafetyText)
    sanitized.action = redactWorkSafetyText(policy.action.trimmingCharacters(in: .whitespacesAndNewlines).lowercased())
    sanitized.message = redactWorkSafetyText(policy.message)
    sanitized.metadata = redactProvisioningRecord(policy.metadata)
    sanitized.redactionStatus = "private-state-excluded"
    return sanitized
}

private func sanitizeNativeFilePermissionRecord(_ permission: NativeFilePermissionRecord) -> NativeFilePermissionRecord {
    var sanitized = permission
    sanitized.displayName = redactWorkSafetyText(permission.displayName)
    sanitized.displayPath = redactWorkSafetyText(permission.displayPath)
    sanitized.pathHash = permission.pathHash.map(redactWorkSafetyText)
    sanitized.bookmarkRef = permission.bookmarkRef.map(redactWorkSafetyText)
    sanitized.relatedTaskId = permission.relatedTaskId.map(redactWorkSafetyText)
    sanitized.relatedToolRequestId = permission.relatedToolRequestId.map(redactWorkSafetyText)
    sanitized.relatedActionRunId = permission.relatedActionRunId.map(redactWorkSafetyText)
    sanitized.failureReason = permission.failureReason.map(redactWorkSafetyText)
    sanitized.metadata = redactProvisioningRecord(permission.metadata)
    sanitized.redactionStatus = "private-state-excluded"
    return sanitized
}

private func redactWorkSafetyText(_ value: String) -> String {
    redactToolRequestText(value)
}

private func redactToolRequestText(_ value: String) -> String {
    let redacted = redactProviderSecretText(value)
    let lowercased = redacted.lowercased()
    if lowercased.contains("/private/")
        || lowercased.contains("/tmp/")
        || lowercased.contains("\\users\\")
        || lowercased.contains("/users/")
        || redacted.hasPrefix("/")
        || redacted.hasPrefix("~") {
        return "[REDACTED]"
    }
    return redacted
}

private func sanitizeStringList(_ values: [String]) -> [String] {
    values.map(redactProviderSecretText)
}

private func uniqueStrings(_ values: [String]) -> [String] {
    var seen = Set<String>()
    return values.filter { seen.insert($0).inserted }
}

private func redactExternalAuthorizationURL(_ value: String?) -> String? {
    guard let trimmed = value?.nilIfBlank else { return nil }
    let redacted = redactString(trimmed)
    if let query = redacted.firstIndex(of: "?") {
        return "\(redacted[..<query])?[REDACTED]"
    }
    if let fragment = redacted.firstIndex(of: "#") {
        return "\(redacted[..<fragment])#[REDACTED]"
    }
    return redacted
}

private let providerSecretPatterns: [NSRegularExpression] = [
    try! NSRegularExpression(pattern: #"(?i)(bearer)\s+[^,\s;]+"#),
    try! NSRegularExpression(pattern: #"(?i)(authorization|auth|token|code|api[_-]?key|client[_-]?secret|secret|credential)[=:]\s*[^,\s;]+"#)
]

private func redactProviderSecretText(_ value: String) -> String {
    var output = value
    for pattern in providerSecretPatterns {
        let range = NSRange(output.startIndex..<output.endIndex, in: output)
        output = pattern.stringByReplacingMatches(in: output, range: range, withTemplate: "$1=[REDACTED]")
    }
    return redactString(output)
}

private func isProvisioningPathKey(_ key: String?) -> Bool {
    guard let key = key?.lowercased() else { return false }
    return ["path", "root", "home", "dir", "file"].contains { key.contains($0) }
}

private func looksLikeLocalPath(_ value: String) -> Bool {
    value.hasPrefix("/")
        || value.hasPrefix("~")
        || value.localizedCaseInsensitiveContains("/users/")
        || value.localizedCaseInsensitiveContains("\\users\\")
}

private func mapProfile(_ row: [String: SQLiteValue]) throws -> LocalProfile {
    LocalProfile(
        id: try row.requireText("id"),
        displayName: try row.requireText("display_name"),
        email: row["email"]?.string,
        avatarUrl: row["avatar_url"]?.string,
        telemetryEnabled: row["telemetry_enabled"]?.bool ?? false,
        crashReportingEnabled: row["crash_reporting_enabled"]?.bool ?? false,
        theme: row["theme"]?.string ?? "classic",
        createdAt: try row.requireText("created_at"),
        updatedAt: try row.requireText("updated_at")
    )
}

private func mapWorkspace(_ row: [String: SQLiteValue]) throws -> Workspace {
    Workspace(
        id: try row.requireText("id"),
        profileId: try row.requireText("profile_id"),
        name: try row.requireText("name"),
        defaultFolderPath: row["default_folder_path"]?.string,
        workspaceType: row["workspace_type"]?.string ?? "personal",
        settings: decodeJSONRecord(row["settings_json"]?.string),
        createdAt: try row.requireText("created_at"),
        updatedAt: try row.requireText("updated_at")
    )
}

private func mapSettingsAlert(_ row: [String: SQLiteValue]) throws -> SettingsAlertRecord {
    if let stored = decodeJSON(SettingsAlertRecord.self, from: row["alert_json"]?.string) {
        return stored
    }
    return SettingsAlertRecord(
        id: try row.requireText("id"),
        workspaceId: try row.requireText("workspace_id"),
        title: try row.requireText("title"),
        message: try row.requireText("message"),
        severity: SettingsAlertSeverity(rawValue: try row.requireText("severity")) ?? .info,
        category: try row.requireText("category"),
        sourceKind: try row.requireText("source_kind"),
        sourceId: row["source_id"]?.string,
        actionLabel: row["action_label"]?.string,
        actionTarget: row["action_target"]?.string,
        expiresAt: row["expires_at"]?.string,
        readAt: row["read_at"]?.string,
        metadata: decodeJSONRecord(row["metadata_json"]?.string),
        createdAt: try row.requireText("created_at"),
        updatedAt: try row.requireText("updated_at"),
        redactionStatus: try row.requireText("redaction_status")
    )
}

private func mapSettingsNotificationPreferences(
    _ row: [String: SQLiteValue]
) throws -> SettingsNotificationPreferences {
    if let stored = decodeJSON(SettingsNotificationPreferences.self, from: row["preferences_json"]?.string) {
        return stored
    }
    return SettingsNotificationPreferences(
        id: try row.requireText("id"),
        workspaceId: try row.requireText("workspace_id"),
        profileId: row["profile_id"]?.string,
        inAppAlertsEnabled: row["in_app_alerts_enabled"]?.bool ?? true,
        unreadBadgeEnabled: row["unread_badge_enabled"]?.bool ?? true,
        emailDeliveryState: row["email_delivery_state"]?.string.flatMap(NotificationDeliveryState.init(rawValue:)) ?? .unavailable,
        mobileDeliveryState: row["mobile_delivery_state"]?.string.flatMap(NotificationDeliveryState.init(rawValue:)) ?? .unavailable,
        metadata: decodeJSONRecord(row["metadata_json"]?.string),
        createdAt: try row.requireText("created_at"),
        updatedAt: try row.requireText("updated_at"),
        redactionStatus: try row.requireText("redaction_status")
    )
}

private func mapSettingsDecisionGateDisposition(
    _ row: [String: SQLiteValue]
) throws -> SettingsDecisionGateDisposition {
    if let stored = decodeJSON(SettingsDecisionGateDisposition.self, from: row["disposition_json"]?.string) {
        return stored
    }
    return SettingsDecisionGateDisposition(
        id: try row.requireText("id"),
        workspaceId: try row.requireText("workspace_id"),
        decisionId: try row.requireText("decision_id"),
        surface: try row.requireText("surface"),
        state: row["disposition_state"]?.string.flatMap(SettingsDispositionState.init(rawValue:)) ?? .decisionGated,
        reasonCode: row["reason_code"]?.string.flatMap(GuardReasonCode.init(rawValue:)) ?? .decisionRequired,
        currentUiState: try row.requireText("current_ui_state"),
        missingPrerequisites: try row.requireText("missing_prerequisites"),
        activationRequirement: try row.requireText("activation_requirement"),
        releaseImpact: try row.requireText("release_impact"),
        metadata: decodeJSONRecord(row["metadata_json"]?.string),
        createdAt: try row.requireText("created_at"),
        updatedAt: try row.requireText("updated_at"),
        redactionStatus: try row.requireText("redaction_status")
    )
}

private func mapSettingsLocalAccountExport(
    _ row: [String: SQLiteValue]
) throws -> SettingsLocalAccountExportRecord {
    if let stored = decodeJSON(SettingsLocalAccountExportRecord.self, from: row["export_json"]?.string) {
        return stored
    }
    return SettingsLocalAccountExportRecord(
        id: try row.requireText("id"),
        workspaceId: try row.requireText("workspace_id"),
        profileId: row["profile_id"]?.string,
        status: try row.requireText("export_status"),
        fileName: try row.requireText("file_name"),
        recordCount: row["record_count"]?.int ?? 0,
        includesSecrets: row["includes_secrets"]?.bool ?? false,
        exportMetadata: decodeJSONRecord(row["export_metadata_json"]?.string),
        createdAt: try row.requireText("created_at"),
        updatedAt: try row.requireText("updated_at"),
        redactionStatus: try row.requireText("redaction_status")
    )
}

private func mapHarness(_ row: [String: SQLiteValue]) throws -> Harness {
    Harness(
        id: try row.requireText("id"),
        runtimeType: RuntimeType(rawValue: try row.requireText("runtime_type")) ?? .hermes,
        displayName: try row.requireText("display_name"),
        mode: HarnessMode(rawValue: try row.requireText("mode")) ?? .appManaged,
        config: decodeJSONRecord(row["config_json"]?.string),
        secretReferenceId: row["secret_reference_id"]?.string,
        status: try row.requireText("status"),
        builtIn: row["built_in"]?.bool ?? false,
        createdAt: try row.requireText("created_at"),
        updatedAt: try row.requireText("updated_at")
    )
}

private func mapAgent(_ row: [String: SQLiteValue]) throws -> Agent {
    Agent(
        id: try row.requireText("id"),
        workspaceId: try row.requireText("workspace_id"),
        name: try row.requireText("name"),
        description: row["description"]?.string,
        status: try row.requireText("status"),
        role: row["role"]?.string,
        source: row["source"]?.string,
        externalId: row["external_id"]?.string,
        lifecycleStatus: row["lifecycle_status"]?.string.flatMap(AgentLifecycleStatus.init(rawValue:)) ?? .active,
        lifecycleReason: row["lifecycle_reason"]?.string,
        retiredAt: row["retired_at"]?.string,
        groupType: row["group_type"]?.string.flatMap(AgentGroupType.init(rawValue:)),
        familyLabel: row["family_label"]?.string,
        companyId: row["company_id"]?.string,
        departmentId: row["department_id"]?.string,
        teamId: row["team_id"]?.string,
        managerAgentId: row["manager_agent_id"]?.string,
        classification: row["classification"]?.string,
        model: row["model"]?.string,
        responsePresentation: row["response_presentation"]?.string.flatMap(AgentResponsePresentation.init(rawValue:)),
        provisioningStatus: row["provisioning_status"]?.string.flatMap(AgentProvisioningStatus.init(rawValue:)),
        currentTaskId: row["current_task_id"]?.string,
        metrics: decodeJSONRecord(row["metrics_json"]?.string),
        budget: decodeJSONRecord(row["budget_json"]?.string),
        createdAt: try row.requireText("created_at"),
        updatedAt: try row.requireText("updated_at")
    )
}

private func mapAgentOrgCompany(_ row: [String: SQLiteValue]) throws -> AgentOrgCompany {
    AgentOrgCompany(
        id: try row.requireText("id"),
        workspaceId: try row.requireText("workspace_id"),
        name: try row.requireText("name"),
        industry: row["industry"]?.string,
        status: try row.requireText("status"),
        metadata: decodeJSONRecord(row["metadata_json"]?.string),
        createdAt: try row.requireText("created_at"),
        updatedAt: try row.requireText("updated_at")
    )
}

private func mapAgentOrgDepartment(_ row: [String: SQLiteValue]) throws -> AgentOrgDepartment {
    AgentOrgDepartment(
        id: try row.requireText("id"),
        workspaceId: try row.requireText("workspace_id"),
        companyId: row["company_id"]?.string,
        name: try row.requireText("name"),
        colorHex: row["color_hex"]?.string,
        headAgentId: row["head_agent_id"]?.string,
        agentOpsRoomId: row["agentops_room_id"]?.string,
        status: try row.requireText("status"),
        metadata: decodeJSONRecord(row["metadata_json"]?.string),
        createdAt: try row.requireText("created_at"),
        updatedAt: try row.requireText("updated_at")
    )
}

private func mapAgentOrgTeam(_ row: [String: SQLiteValue]) throws -> AgentOrgTeam {
    AgentOrgTeam(
        id: try row.requireText("id"),
        workspaceId: try row.requireText("workspace_id"),
        departmentId: row["department_id"]?.string,
        name: try row.requireText("name"),
        leadAgentId: row["lead_agent_id"]?.string,
        agentOpsRoomId: row["agentops_room_id"]?.string,
        status: try row.requireText("status"),
        metadata: decodeJSONRecord(row["metadata_json"]?.string),
        createdAt: try row.requireText("created_at"),
        updatedAt: try row.requireText("updated_at")
    )
}

private func mapAgentManagerRelationship(_ row: [String: SQLiteValue]) throws -> AgentManagerRelationship {
    AgentManagerRelationship(
        id: try row.requireText("id"),
        workspaceId: try row.requireText("workspace_id"),
        managerAgentId: try row.requireText("manager_agent_id"),
        reportAgentId: try row.requireText("report_agent_id"),
        relationshipType: try row.requireText("relationship_type"),
        metadata: decodeJSONRecord(row["metadata_json"]?.string),
        createdAt: try row.requireText("created_at"),
        updatedAt: try row.requireText("updated_at")
    )
}

private func mapAgentTask(_ row: [String: SQLiteValue]) throws -> AgentTask {
    AgentTask(
        id: try row.requireText("id"),
        workspaceId: try row.requireText("workspace_id"),
        assignedAgentId: row["assigned_agent_id"]?.string,
        targetAgentId: row["target_agent_id"]?.string,
        targetTeamId: row["target_team_id"]?.string,
        title: try row.requireText("title"),
        message: try row.requireText("message"),
        priority: row["priority"]?.string.flatMap(AgentTaskPriority.init(rawValue:)) ?? .normal,
        targetType: row["target_type"]?.string.flatMap(AgentTaskTargetType.init(rawValue:)) ?? .direct,
        status: row["status"]?.string.flatMap(AgentTaskStatus.init(rawValue:)) ?? .queued,
        requiresApproval: row["requires_approval"]?.bool ?? false,
        scheduledAt: row["scheduled_at"]?.string,
        timeZone: row["time_zone"]?.string,
        recurrence: row["recurrence"]?.string,
        lastError: row["last_error"]?.string,
        threadId: row["thread_id"]?.string,
        metadata: decodeJSONRecord(row["metadata_json"]?.string),
        archivedAt: row["archived_at"]?.string,
        createdAt: try row.requireText("created_at"),
        updatedAt: try row.requireText("updated_at")
    )
}

private func mapAgentTaskRun(_ row: [String: SQLiteValue]) throws -> AgentTaskRun {
    AgentTaskRun(
        id: try row.requireText("id"),
        workspaceId: try row.requireText("workspace_id"),
        taskId: try row.requireText("task_id"),
        agentId: row["agent_id"]?.string,
        dispatchId: row["dispatch_id"]?.string,
        status: row["status"]?.string.flatMap(AgentTaskStatus.init(rawValue:)) ?? .queued,
        tokensUsed: row["tokens_used"]?.int ?? 0,
        startedAt: row["started_at"]?.string,
        completedAt: row["completed_at"]?.string,
        error: row["error_json"]?.string.map(decodeJSONRecord),
        metadata: decodeJSONRecord(row["metadata_json"]?.string),
        createdAt: try row.requireText("created_at"),
        updatedAt: try row.requireText("updated_at")
    )
}

private func mapAgentTeamMemoryEntry(_ row: [String: SQLiteValue]) throws -> AgentTeamMemoryEntry {
    AgentTeamMemoryEntry(
        id: try row.requireText("id"),
        workspaceId: try row.requireText("workspace_id"),
        teamId: try row.requireText("team_id"),
        title: try row.requireText("title"),
        memoryType: row["memory_type"]?.string.flatMap(AgentTeamMemoryType.init(rawValue:)) ?? .note,
        content: try row.requireText("content"),
        isSensitive: row["is_sensitive"]?.bool ?? false,
        metadata: decodeJSONRecord(row["metadata_json"]?.string),
        createdByAgentId: row["created_by_agent_id"]?.string,
        createdAt: try row.requireText("created_at"),
        updatedAt: try row.requireText("updated_at")
    )
}

private func mapAgentTeamHandover(_ row: [String: SQLiteValue]) throws -> AgentTeamHandover {
    AgentTeamHandover(
        id: try row.requireText("id"),
        workspaceId: try row.requireText("workspace_id"),
        teamId: try row.requireText("team_id"),
        fromAgentId: row["from_agent_id"]?.string,
        title: try row.requireText("title"),
        content: try row.requireText("content"),
        isSensitive: row["is_sensitive"]?.bool ?? false,
        metadata: decodeJSONRecord(row["metadata_json"]?.string),
        createdAt: try row.requireText("created_at"),
        updatedAt: try row.requireText("updated_at")
    )
}

private func mapAgentPreferences(_ row: [String: SQLiteValue]) throws -> AgentPreferences {
    AgentPreferences(
        id: try row.requireText("id"),
        workspaceId: try row.requireText("workspace_id"),
        agentId: try row.requireText("agent_id"),
        cosmeticDisplayName: row["cosmetic_display_name"]?.string,
        avatarReference: row["avatar_reference"]?.string,
        avatarState: row["avatar_state"]?.string.flatMap(AgentAvatarState.init(rawValue:)) ?? .fallback,
        responsePresentation: row["response_presentation"]?.string.flatMap(AgentResponsePresentation.init(rawValue:)) ?? .markdown,
        metadata: decodeJSONRecord(row["metadata_json"]?.string),
        createdAt: try row.requireText("created_at"),
        updatedAt: try row.requireText("updated_at")
    )
}

private func mapAgentProvisioningJob(_ row: [String: SQLiteValue]) throws -> AgentProvisioningJob {
    AgentProvisioningJob(
        id: try row.requireText("id"),
        workspaceId: try row.requireText("workspace_id"),
        requestedByProfileId: row["requested_by_profile_id"]?.string,
        harnessId: row["harness_id"]?.string,
        runtimeType: RuntimeType(rawValue: try row.requireText("runtime_type")) ?? .hermes,
        status: AgentProvisioningStatus(rawValue: row["status"]?.string ?? "") ?? .failed,
        stage: row["stage"]?.string,
        message: row["message"]?.string,
        error: row["error_json"]?.string.map(decodeJSONRecord),
        createdAgentId: row["created_agent_id"]?.string,
        runtimeBindingId: row["runtime_binding_id"]?.string,
        externalAgentId: row["external_agent_id"]?.string,
        payload: decodeJSONRecord(row["payload_json"]?.string),
        filesMetadata: decodeJSONRecord(row["files_metadata_json"]?.string),
        createdAt: try row.requireText("created_at"),
        updatedAt: try row.requireText("updated_at"),
        completedAt: row["completed_at"]?.string
    )
}

private func defaultAgentPreferences(for agent: AgentWithBinding) -> AgentPreferences {
    AgentPreferences(
        id: "apref-\(agent.id)",
        workspaceId: agent.workspaceId,
        agentId: agent.id,
        cosmeticDisplayName: nil,
        avatarReference: nil,
        avatarState: .fallback,
        responsePresentation: agent.responsePresentation ?? .markdown,
        metadata: [:],
        createdAt: agent.createdAt,
        updatedAt: agent.updatedAt
    )
}

private func mapRuntimeBinding(_ row: [String: SQLiteValue]) throws -> RuntimeBinding {
    RuntimeBinding(
        id: try row.requireText("id"),
        agentId: try row.requireText("agent_id"),
        harnessId: try row.requireText("harness_id"),
        runtimeType: RuntimeType(rawValue: try row.requireText("runtime_type")) ?? .hermes,
        adapterKind: try row.requireText("adapter_kind"),
        routingMode: try row.requireText("routing_mode"),
        externalAgentId: row["external_agent_id"]?.string,
        runtimeHostId: row["runtime_host_id"]?.string,
        canonicalAgentId: row["canonical_agent_id"]?.string,
        assignmentEpoch: row["assignment_epoch"]?.int ?? 0,
        ownershipState: row["ownership_state"]?.string ?? "local",
        hostStatus: row["host_status"]?.string ?? "online",
        connectLinked: row["connect_linked"]?.bool ?? false,
        connectRemoteAgentId: row["connect_remote_agent_id"]?.string,
        hermesProfileSlug: row["hermes_profile_slug"]?.string,
        hermesHomePath: row["hermes_home_path"]?.string,
        hermesIdentityFilePath: row["hermes_identity_file_path"]?.string,
        workspaceFolderPath: row["workspace_folder_path"]?.string,
        config: decodeJSONRecord(row["config_json"]?.string),
        createdAt: try row.requireText("created_at"),
        updatedAt: try row.requireText("updated_at")
    )
}

private func mapThreadSummary(_ row: [String: SQLiteValue]) throws -> ThreadSummary {
    ThreadSummary(
        id: try row.requireText("id"),
        workspaceId: try row.requireText("workspace_id"),
        title: try row.requireText("title"),
        threadType: ThreadType(rawValue: row["thread_type"]?.string ?? "direct") ?? .unknown,
        selectedAgentId: row["selected_agent_id"]?.string,
        activeSessionId: row["active_session_id"]?.string,
        status: try row.requireText("status"),
        readState: ThreadReadStateValue(rawValue: row["read_state"]?.string ?? "read") ?? .read,
        unreadCount: row["unread_count"]?.int ?? 0,
        isArchived: row["is_archived"]?.bool ?? (row["status"]?.string == "archived"),
        archivedAt: row["archived_at"]?.string,
        lastReadAt: row["last_read_at"]?.string,
        latestWrapUpReportId: row["latest_wrap_up_report_id"]?.string,
        lastMessageSnippet: row["last_message_snippet"]?.string,
        lastMessageAt: row["last_message_at"]?.string,
        createdAt: try row.requireText("created_at"),
        updatedAt: try row.requireText("updated_at")
    )
}

private func mapMessage(_ row: [String: SQLiteValue]) throws -> Message {
    Message(
        id: try row.requireText("id"),
        threadId: try row.requireText("thread_id"),
        threadSessionId: row["thread_session_id"]?.string,
        senderType: SenderType(rawValue: try row.requireText("sender_type")) ?? .system,
        senderId: row["sender_id"]?.string,
        senderName: try row.requireText("sender_name"),
        content: try row.requireText("content"),
        contentFormat: MessageFormat(rawValue: try row.requireText("content_format")) ?? .plain,
        metadata: decodeJSONRecord(row["metadata_json"]?.string),
        createdAt: try row.requireText("created_at")
    )
}

private func mapChatComposerDraft(_ row: [String: SQLiteValue]) throws -> ChatComposerDraft {
    ChatComposerDraft(
        id: try row.requireText("id"),
        threadId: try row.requireText("thread_id"),
        profileId: row["profile_id"]?.string,
        content: try row.requireText("content"),
        metadata: decodeJSONRecord(row["metadata_json"]?.string),
        createdAt: try row.requireText("created_at"),
        updatedAt: try row.requireText("updated_at")
    )
}

private func mapChatAttachment(_ row: [String: SQLiteValue]) throws -> ChatAttachment {
    ChatAttachment(
        id: try row.requireText("id"),
        threadId: try row.requireText("thread_id"),
        messageId: row["message_id"]?.string,
        profileId: row["profile_id"]?.string,
        fileName: try row.requireText("file_name"),
        mimeType: try row.requireText("mime_type"),
        byteSize: row["byte_size"]?.int ?? 0,
        sha256: try row.requireText("sha256"),
        kind: ChatAttachmentKind(rawValue: try row.requireText("kind")) ?? .file,
        status: ChatAttachmentStatus(rawValue: try row.requireText("status")) ?? .failed,
        progress: row["progress"]?.int ?? 0,
        provenance: decodeJSONRecord(row["provenance_json"]?.string),
        error: row["error_json"]?.string.map(decodeJSONRecord),
        createdAt: try row.requireText("created_at"),
        updatedAt: try row.requireText("updated_at")
    )
}

private func mapChatDocumentReference(_ row: [String: SQLiteValue]) throws -> ChatDocumentReference {
    ChatDocumentReference(
        id: try row.requireText("id"),
        messageId: try row.requireText("message_id"),
        title: try row.requireText("title"),
        referenceKind: ChatDocumentReferenceKind(rawValue: try row.requireText("reference_kind")) ?? .unknown,
        displayPath: row["display_path"]?.string,
        tokenCount: row["token_count"]?.int,
        isSensitive: row["is_sensitive"]?.bool ?? false,
        isRedacted: row["is_redacted"]?.bool ?? false,
        metadata: decodeJSONRecord(row["metadata_json"]?.string),
        createdAt: try row.requireText("created_at")
    )
}

private func mapChatSession(_ row: [String: SQLiteValue]) throws -> ChatSession {
    ChatSession(
        id: try row.requireText("id"),
        threadId: try row.requireText("thread_id"),
        sequenceNumber: row["sequence_number"]?.int ?? 1,
        status: ThreadSessionStatus(rawValue: try row.requireText("status")) ?? .closed,
        isReadOnly: row["is_read_only"]?.bool ?? false,
        relayRunState: TeamRelayRunState(rawValue: row["relay_run_state"]?.string ?? "") ?? .running,
        relayPauseReason: row["relay_pause_reason"]?.string.flatMap(TeamRelayPauseReason.init(rawValue:)),
        relayReplyLimit: row["relay_reply_limit"]?.int ?? TeamRelayReplyLimits.defaultLimit,
        startedAt: try row.requireText("started_at"),
        endedAt: row["ended_at"]?.string,
        createdAt: try row.requireText("created_at"),
        updatedAt: try row.requireText("updated_at")
    )
}

private func mapThreadParticipant(_ row: [String: SQLiteValue]) throws -> ThreadParticipant {
    ThreadParticipant(
        id: try row.requireText("id"),
        threadId: try row.requireText("thread_id"),
        participantType: ThreadParticipantType(rawValue: try row.requireText("participant_type")) ?? .system,
        participantId: row["participant_id"]?.string,
        displayName: try row.requireText("display_name"),
        role: ThreadParticipantRole(rawValue: try row.requireText("role")) ?? .member,
        isManager: row["is_manager"]?.bool ?? false,
        joinedAt: try row.requireText("joined_at"),
        leftAt: row["left_at"]?.string,
        createdAt: try row.requireText("created_at"),
        updatedAt: try row.requireText("updated_at")
    )
}

private func mapThreadReadState(_ row: [String: SQLiteValue]) throws -> ThreadReadState {
    ThreadReadState(
        id: try row.requireText("id"),
        threadId: try row.requireText("thread_id"),
        profileId: row["profile_id"]?.string,
        lastReadMessageId: row["last_read_message_id"]?.string,
        lastReadAt: row["last_read_at"]?.string,
        unreadCount: row["unread_count"]?.int ?? 0,
        createdAt: try row.requireText("created_at"),
        updatedAt: try row.requireText("updated_at")
    )
}

private func mapThreadWrapUpReport(_ row: [String: SQLiteValue]) throws -> ThreadWrapUpReport {
    ThreadWrapUpReport(
        id: try row.requireText("id"),
        threadId: try row.requireText("thread_id"),
        sessionId: row["session_id"]?.string,
        workspaceId: try row.requireText("workspace_id"),
        status: ThreadWrapUpStatus(rawValue: try row.requireText("status")) ?? .pending,
        title: row["title"]?.string,
        markdown: row["markdown"]?.string,
        summary: row["summary"]?.string,
        metadata: decodeJSONRecord(row["metadata_json"]?.string),
        messageCount: row["message_count"]?.int ?? 0,
        provider: row["provider"]?.string,
        model: row["model"]?.string,
        error: row["error_json"]?.string.map(decodeJSONRecord),
        completedAt: row["completed_at"]?.string,
        archivedAt: row["archived_at"]?.string,
        retryCount: row["retry_count"]?.int ?? 0,
        lastRetryAt: row["last_retry_at"]?.string,
        createdAt: try row.requireText("created_at"),
        updatedAt: try row.requireText("updated_at"),
        redactionStatus: row["redaction_status"]?.string ?? "private-state-excluded"
    )
}

private func mapInsightsReportSnapshot(_ row: [String: SQLiteValue]) throws -> InsightsReportSnapshot {
    InsightsReportSnapshot(
        id: try row.requireText("id"),
        workspaceId: try row.requireText("workspace_id"),
        title: try row.requireText("title"),
        summary: try row.requireText("summary"),
        snapshotType: try row.requireText("snapshot_type"),
        periodLabel: row["period_label"]?.string,
        rangeStart: row["range_start"]?.string,
        rangeEnd: row["range_end"]?.string,
        payload: decodeJSONRecord(row["payload_json"]?.string),
        archivedAt: row["archived_at"]?.string,
        createdAt: try row.requireText("created_at"),
        updatedAt: try row.requireText("updated_at"),
        redactionStatus: row["redaction_status"]?.string ?? "private-state-excluded"
    )
}

private func mapRuntimeSession(_ row: [String: SQLiteValue]) throws -> RuntimeSession {
    RuntimeSession(
        id: try row.requireText("id"),
        threadId: try row.requireText("thread_id"),
        agentId: try row.requireText("agent_id"),
        runtimeBindingId: try row.requireText("runtime_binding_id"),
        externalSessionId: row["external_session_id"]?.string,
        status: try row.requireText("status"),
        metadata: decodeJSONRecord(row["metadata_json"]?.string),
        createdAt: try row.requireText("created_at"),
        updatedAt: try row.requireText("updated_at")
    )
}

private func mapRuntimeDispatch(_ row: [String: SQLiteValue]) throws -> RuntimeDispatch {
    RuntimeDispatch(
        id: try row.requireText("id"),
        threadId: try row.requireText("thread_id"),
        messageId: try row.requireText("message_id"),
        agentId: try row.requireText("agent_id"),
        harnessId: try row.requireText("harness_id"),
        sessionId: try row.requireText("session_id"),
        status: DispatchStatus(rawValue: try row.requireText("status")) ?? .failed,
        correlationId: try row.requireText("correlation_id"),
        inputSnapshot: decodeJSONRecord(row["input_snapshot_json"]?.string),
        resultSnapshot: row["result_snapshot_json"]?.string.map(decodeJSONRecord),
        errorSnapshot: row["error_snapshot_json"]?.string.map(decodeJSONRecord),
        startedAt: row["started_at"]?.string,
        completedAt: row["completed_at"]?.string,
        createdAt: try row.requireText("created_at"),
        updatedAt: try row.requireText("updated_at")
    )
}

private func mapLogEvent(_ row: [String: SQLiteValue]) throws -> LogEvent {
    LogEvent(
        id: try row.requireText("id"),
        timestamp: try row.requireText("timestamp"),
        severity: try row.requireText("severity"),
        category: try row.requireText("category"),
        message: try row.requireText("message"),
        correlationId: row["correlation_id"]?.string,
        dispatchId: row["dispatch_id"]?.string,
        harnessId: row["harness_id"]?.string,
        threadId: row["thread_id"]?.string,
        detail: decodeJSONRecord(row["detail_json"]?.string)
    )
}

private extension Dictionary where Key == String, Value == SQLiteValue {
    func requireText(_ key: String) throws -> String {
        guard let value = self[key]?.string else {
            throw RelayError(.databaseUnavailable, "Missing SQLite column \(key).")
        }
        return value
    }
}
