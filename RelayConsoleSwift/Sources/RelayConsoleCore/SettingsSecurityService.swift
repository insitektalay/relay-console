import Foundation

public enum SettingsSecurityBlockedAction: String, Codable, CaseIterable, Sendable {
    case resetLocalData = "reset_local_data"
    case removeLocalProfile = "remove_local_profile"
    case changePassword = "change_password"
    case browserSessions = "browser_sessions"
    case logOut = "log_out"
    case support = "support"
    case privacy = "privacy"
    case terms = "terms"
    case status = "status"
}

public final class SettingsSecurityService {
    private let data: LocalDataService
    private let eventBus: RelayEventBus
    private let auditSecurity: AuditSecurityService?

    public init(
        data: LocalDataService,
        eventBus: RelayEventBus,
        auditSecurity: AuditSecurityService? = nil
    ) {
        self.data = data
        self.eventBus = eventBus
        self.auditSecurity = auditSecurity
    }

    public func securitySummary(
        context: ServiceRequestContext,
        profileId: RelayId?,
        now: Date = Date()
    ) throws -> SettingsSecuritySummary {
        try requireWorkspaceRead(context: context)
        let decisions = try ensureDecisionDispositions(
            workspaceId: context.workspaceId,
            now: ISO8601DateFormatter.relayConsole.string(from: now)
        )
        return SettingsSecuritySummary(
            workspaceId: context.workspaceId,
            profileId: profileId,
            mode: "local-first",
            generatedAt: ISO8601DateFormatter.relayConsole.string(from: now),
            decisionDispositions: decisions,
            actionDispositions: actionDispositions(),
            latestExport: try data.latestSettingsLocalAccountExport(
                workspaceId: context.workspaceId,
                profileId: profileId
            ),
            supportEvidenceState: .decisionGated,
            cloudAccountState: .unavailable,
            destructiveLifecycleState: .available,
            redactionStatus: "private-state-excluded"
        )
    }

    @discardableResult
    public func refreshSecuritySummary(
        context: ServiceRequestContext,
        profileId: RelayId?,
        now: Date = Date()
    ) throws -> SettingsSecuritySummary {
        let summary = try securitySummary(context: context, profileId: profileId, now: now)
        eventBus.emit(.settingsSecurityUpdated, summary)
        return summary
    }

    @discardableResult
    public func prepareLocalAccountExport(
        context: ServiceRequestContext,
        profileId: RelayId?,
        now: Date = Date()
    ) throws -> SettingsLocalAccountExportRecord {
        try requireWorkspaceRead(context: context)
        try requireProfileScope(context: context, profileId: profileId)
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
        let export = SettingsLocalAccountExportRecord(
            id: createRelayId("slx"),
            workspaceId: context.workspaceId,
            profileId: profileId,
            status: "prepared",
            fileName: "relay-console-local-account-export.json",
            recordCount: 4,
            includesSecrets: false,
            exportMetadata: [
                "mode": .string("local-first"),
                "recordTypes": .array([
                    .string("profile_metadata"),
                    .string("workspace_metadata"),
                    .string("settings_preferences"),
                    .string("decision_dispositions")
                ]),
                "profileValuesIncluded": .bool(false),
                "workspaceValuesIncluded": .bool(false),
                "rawSecretsIncluded": .bool(false),
                "browserSessionsIncluded": .bool(false),
                "supportPayloadIncluded": .bool(false),
                "decisionIds": .array([.string("D-0001"), .string("D-0004"), .string("D-0006")])
            ],
            createdAt: timestamp,
            updatedAt: timestamp,
            redactionStatus: "private-state-excluded"
        )
        let saved = try data.saveSettingsLocalAccountExport(export)
        _ = auditSecurity?.record(
            context: context,
            request: AuditLogRecordRequest(
                eventType: "settings.local_export.prepared",
                resourceType: "settings_security",
                resourceId: saved.id,
                severity: "info",
                message: "Prepared redacted local account export metadata.",
                source: "SettingsSecurityService",
                context: [
                    "includesSecrets": .bool(false),
                    "rawValuesIncluded": .bool(false),
                    "decisionId": .string("D-0006")
                ]
            ),
            now: now
        )
        eventBus.emit(.settingsSecurityUpdated, try securitySummary(context: context, profileId: profileId, now: now))
        return saved
    }

    public func blockDecisionGatedAction(
        context: ServiceRequestContext,
        action: SettingsSecurityBlockedAction
    ) throws {
        try requireWorkspaceRead(context: context)
        let decisionId = decisionId(for: action)
        _ = auditSecurity?.record(
            context: context,
            request: AuditLogRecordRequest(
                eventType: "settings.lifecycle.blocked",
                resourceType: "settings_security",
                resourceId: action.rawValue,
                severity: "warning",
                message: "Blocked decision-gated Settings security action.",
                source: "SettingsSecurityService",
                context: [
                    "action": .string(action.rawValue),
                    "decisionId": .string(decisionId),
                    "reasonCode": .string(GuardReasonCode.decisionRequired.rawValue),
                    "executionAttempted": .bool(false)
                ]
            )
        )
        throw ServiceGuard.decisionRequired(
            context: context,
            decisionId: decisionId,
            message: blockedMessage(for: action)
        )
    }

    private func ensureDecisionDispositions(
        workspaceId: RelayId,
        now: IsoTimestamp
    ) throws -> [SettingsDecisionGateDisposition] {
        let defaults = defaultDecisionDispositions(workspaceId: workspaceId, now: now)
        for disposition in defaults {
            _ = try data.saveSettingsDecisionGateDisposition(disposition)
        }
        return try data.listSettingsDecisionGateDispositions(workspaceId: workspaceId)
    }

    private func defaultDecisionDispositions(
        workspaceId: RelayId,
        now: IsoTimestamp
    ) -> [SettingsDecisionGateDisposition] {
        [
            SettingsDecisionGateDisposition(
                id: createRelayId("sdg"),
                workspaceId: workspaceId,
                decisionId: "D-0001",
                surface: "support_legal_status",
                state: .decisionGated,
                reasonCode: .decisionRequired,
                currentUiState: "Support, legal, status, privacy, terms, and about actions are shown as decision-required rows without external links.",
                missingPrerequisites: "Human-approved native placement, content ownership, and release-impact signoff.",
                activationRequirement: "Resolve D-0001 and add service/source, visual, accessibility, and manual evidence before enabling actions.",
                releaseImpact: "Unavailable residual until placement and content ownership are approved.",
                metadata: ["stateKind": .string(GuardedStateKind.decisionGated.rawValue)],
                createdAt: now,
                updatedAt: now,
                redactionStatus: "private-state-excluded"
            ),
            SettingsDecisionGateDisposition(
                id: createRelayId("sdg"),
                workspaceId: workspaceId,
                decisionId: "D-0004",
                surface: "cloud_account_mode",
                state: .unavailable,
                reasonCode: .decisionRequired,
                currentUiState: "Password changes, browser sessions, mobile sessions, and logout are unavailable in local-first mode.",
                missingPrerequisites: "Human-approved cloud account mode and optional account adapter.",
                activationRequirement: "Resolve D-0004 before enabling Railway/web account session controls in native Settings.",
                releaseImpact: "Cloud account behavior cannot be required or counted as native parity.",
                metadata: ["stateKind": .string(GuardedStateKind.unavailable.rawValue)],
                createdAt: now,
                updatedAt: now,
                redactionStatus: "private-state-excluded"
            ),
            SettingsDecisionGateDisposition(
                id: createRelayId("sdg"),
                workspaceId: workspaceId,
                decisionId: "D-0006",
                surface: "local_lifecycle_destructive_actions",
                state: .approved,
                reasonCode: .available,
                currentUiState: "Local export writes a redacted JSON file. Reset, profile removal, and app-removal cleanup require typed confirmation and terminate the app after managed cleanup.",
                missingPrerequisites: "None for local execution; signed release-machine evidence remains part of release-candidate acceptance.",
                activationRequirement: "Type the action-specific confirmation phrase before cleanup runs.",
                releaseImpact: "Local lifecycle controls are available with secret, runtime, background-job, database, and managed-path cleanup.",
                metadata: ["stateKind": .string(GuardedStateKind.decisionGated.rawValue)],
                createdAt: now,
                updatedAt: now,
                redactionStatus: "private-state-excluded"
            )
        ]
    }

    private func actionDispositions() -> [SettingsSecurityActionDisposition] {
        [
            action("export_account", "Export local data", "Writes a user-selected redacted JSON file with mode 0600 and no Keychain values.", .available, .available, nil, true, true, false),
            action("reset_local_data", "Reset local data", "Stops runtimes and background jobs, removes Keychain references and the managed data root, then exits for a clean next launch.", .available, .available, "D-0006", true, true, true),
            action("remove_local_profile", "Remove local profile", "Removes the current single-profile beta state, secrets, runtimes, background jobs, and managed data after typed confirmation.", .available, .available, "D-0006", true, true, true),
            action("prepare_for_app_removal", "Prepare for app removal", "Removes Relay Console managed data, Keychain references, runtimes, and background jobs before the app is moved to Trash.", .available, .available, "D-0006", true, true, true),
            action("change_password", "Change password", "Unavailable because local-first Swift has no Railway browser-session account authority.", .unavailable, .decisionRequired, "D-0004", false, false, false),
            action("browser_sessions", "Browser sessions", "Unavailable until optional cloud account mode is approved.", .unavailable, .decisionRequired, "D-0004", false, false, false),
            action("support_legal_status", "Support, legal, and status", "Decision-required placement only; no placeholder links are shipped as native actions.", .decisionGated, .decisionRequired, "D-0001", false, false, false)
        ]
    }

    private func action(
        _ id: RelayId,
        _ title: String,
        _ detail: String,
        _ state: SettingsDispositionState,
        _ reasonCode: GuardReasonCode,
        _ decisionId: String?,
        _ enabled: Bool,
        _ auditRequired: Bool,
        _ destructive: Bool
    ) -> SettingsSecurityActionDisposition {
        SettingsSecurityActionDisposition(
            id: id,
            title: title,
            detail: detail,
            state: state,
            reasonCode: reasonCode,
            decisionId: decisionId,
            enabled: enabled,
            auditRequired: auditRequired,
            destructive: destructive,
            redactionStatus: "private-state-excluded"
        )
    }

    private func requireWorkspaceRead(context: ServiceRequestContext) throws {
        if let denied = ServiceGuard.requireAnyRole(
            [.owner, .admin, .member, .viewer],
            context: context,
            message: "Security settings are unavailable for your current role.",
            auditRequired: false
        ) {
            throw denied
        }
    }

    private func requireProfileScope(
        context: ServiceRequestContext,
        profileId: RelayId?
    ) throws {
        guard profileId == nil || profileId == context.actorId || context.hasAnyRole([.owner, .admin]) else {
            throw ServiceGuardResult(
                stateKind: .readOnly,
                reasonCode: .authorityReadOnly,
                message: "Only the matching local profile can prepare account export metadata.",
                recovery: "Switch to the matching local profile before preparing export metadata.",
                correlationId: context.correlationId,
                auditRequired: true
            )
        }
    }

    private func decisionId(for action: SettingsSecurityBlockedAction) -> String {
        switch action {
        case .resetLocalData, .removeLocalProfile:
            return "D-0006"
        case .changePassword, .browserSessions, .logOut:
            return "D-0004"
        case .support, .privacy, .terms, .status:
            return "D-0001"
        }
    }

    private func blockedMessage(for action: SettingsSecurityBlockedAction) -> String {
        switch action {
        case .resetLocalData:
            return "Reset local data is decision-gated until local retention semantics are approved."
        case .removeLocalProfile:
            return "Remove local profile is decision-gated until local removal semantics are approved."
        case .changePassword:
            return "Password changes require an approved cloud account mode."
        case .browserSessions:
            return "Browser sessions require an approved cloud account mode."
        case .logOut:
            return "Log out is unavailable in local-first mode without cloud account authority."
        case .support:
            return "Support placement requires a native support/legal decision."
        case .privacy:
            return "Privacy placement requires a native support/legal decision."
        case .terms:
            return "Terms placement requires a native support/legal decision."
        case .status:
            return "Status placement requires a native support/legal decision."
        }
    }
}
