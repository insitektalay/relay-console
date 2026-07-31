import Foundation

public struct SettingsAlertInput: Codable, Equatable, Sendable {
    public var title: String
    public var message: String
    public var severity: SettingsAlertSeverity
    public var category: String
    public var sourceKind: String
    public var sourceId: RelayId?
    public var actionLabel: String?
    public var actionTarget: String?
    public var expiresAt: IsoTimestamp?
    public var metadata: JSONRecord

    public init(
        title: String,
        message: String,
        severity: SettingsAlertSeverity,
        category: String,
        sourceKind: String,
        sourceId: RelayId? = nil,
        actionLabel: String? = nil,
        actionTarget: String? = nil,
        expiresAt: IsoTimestamp? = nil,
        metadata: JSONRecord = [:]
    ) {
        self.title = title
        self.message = message
        self.severity = severity
        self.category = category
        self.sourceKind = sourceKind
        self.sourceId = sourceId
        self.actionLabel = actionLabel
        self.actionTarget = actionTarget
        self.expiresAt = expiresAt
        self.metadata = metadata
    }
}

public struct NotificationPreferenceInput: Codable, Equatable, Sendable {
    public var inAppAlertsEnabled: Bool
    public var unreadBadgeEnabled: Bool

    public init(inAppAlertsEnabled: Bool, unreadBadgeEnabled: Bool) {
        self.inAppAlertsEnabled = inAppAlertsEnabled
        self.unreadBadgeEnabled = unreadBadgeEnabled
    }
}

public final class SettingsStatusService {
    private let data: LocalDataService
    private let eventBus: RelayEventBus

    public init(data: LocalDataService, eventBus: RelayEventBus) {
        self.data = data
        self.eventBus = eventBus
    }

    @discardableResult
    public func createAlert(
        context: ServiceRequestContext,
        input: SettingsAlertInput,
        now: Date = Date()
    ) throws -> SettingsAlertRecord {
        try requireWorkspaceRead(context: context)
        if let denied = ServiceGuard.requireAnyRole(
            [.owner, .admin, .operator],
            context: context,
            message: "Creating settings alerts requires owner, admin, or operator access.",
            recovery: "Ask a workspace owner or admin to create this alert."
        ) {
            throw denied
        }
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
        let alert = SettingsAlertRecord(
            id: createRelayId("salert"),
            workspaceId: context.workspaceId,
            title: try requireNonEmptyString(input.title, field: "Alert title", maxLength: 160),
            message: try requireNonEmptyString(input.message, field: "Alert message", maxLength: 1_000),
            severity: input.severity,
            category: try requireNonEmptyString(input.category, field: "Alert category", maxLength: 80),
            sourceKind: try requireNonEmptyString(input.sourceKind, field: "Alert source", maxLength: 80),
            sourceId: try optionalTrimmedString(input.sourceId, field: "Alert source id", maxLength: 120),
            actionLabel: try optionalTrimmedString(input.actionLabel, field: "Alert action label", maxLength: 80),
            actionTarget: try optionalTrimmedString(input.actionTarget, field: "Alert action target", maxLength: 160),
            expiresAt: input.expiresAt,
            readAt: nil,
            metadata: input.metadata.merging([
                "createdByActorId": .string(context.actorId),
                "deliveryScope": .string("in_app")
            ]) { _, new in new },
            createdAt: timestamp,
            updatedAt: timestamp,
            redactionStatus: "private-state-excluded"
        )
        return try data.saveSettingsAlert(alert)
    }

    public func alerts(
        context: ServiceRequestContext,
        unreadOnly: Bool = false,
        includeExpired: Bool = false,
        now: Date = Date()
    ) throws -> [SettingsAlertRecord] {
        try requireWorkspaceRead(context: context)
        return try data.listSettingsAlerts(
            workspaceId: context.workspaceId,
            unreadOnly: unreadOnly,
            includeExpired: includeExpired,
            now: ISO8601DateFormatter.relayConsole.string(from: now)
        )
    }

    public func unreadAlertCount(
        context: ServiceRequestContext,
        now: Date = Date()
    ) throws -> Int {
        try requireWorkspaceRead(context: context)
        return try data.unreadSettingsAlertCount(
            workspaceId: context.workspaceId,
            now: ISO8601DateFormatter.relayConsole.string(from: now)
        )
    }

    @discardableResult
    public func markAlertRead(
        context: ServiceRequestContext,
        alertId: RelayId,
        now: Date = Date()
    ) throws -> SettingsAlertRecord {
        try requireWorkspaceRead(context: context)
        return try data.markSettingsAlertRead(
            workspaceId: context.workspaceId,
            alertId: alertId,
            readAt: ISO8601DateFormatter.relayConsole.string(from: now)
        )
    }

    @discardableResult
    public func markAllAlertsRead(
        context: ServiceRequestContext,
        now: Date = Date()
    ) throws -> [SettingsAlertRecord] {
        try requireWorkspaceRead(context: context)
        return try data.markAllSettingsAlertsRead(
            workspaceId: context.workspaceId,
            readAt: ISO8601DateFormatter.relayConsole.string(from: now)
        )
    }

    public func notificationPreferences(
        context: ServiceRequestContext,
        profileId: RelayId?
    ) throws -> SettingsNotificationPreferences {
        try requireWorkspaceRead(context: context)
        return try data.ensureSettingsNotificationPreferences(
            workspaceId: context.workspaceId,
            profileId: profileId
        )
    }

    @discardableResult
    public func saveNotificationPreferences(
        context: ServiceRequestContext,
        profileId: RelayId?,
        input: NotificationPreferenceInput
    ) throws -> SettingsNotificationPreferences {
        try requireWorkspaceRead(context: context)
        try requirePreferenceMutationAuthority(context: context, profileId: profileId)
        let current = try data.ensureSettingsNotificationPreferences(
            workspaceId: context.workspaceId,
            profileId: profileId
        )
        let timestamp = nowIso()
        let updated = SettingsNotificationPreferences(
            id: current.id,
            workspaceId: current.workspaceId,
            profileId: current.profileId,
            inAppAlertsEnabled: input.inAppAlertsEnabled,
            unreadBadgeEnabled: input.unreadBadgeEnabled,
            emailDeliveryState: .unavailable,
            mobileDeliveryState: .unavailable,
            metadata: current.metadata.merging([
                "deliveryScope": .string("in_app_only"),
                "emailDeliveryControl": .string("hidden_until_persisted_native_delivery"),
                "mobileDeliveryControl": .string("hidden_until_persisted_native_delivery")
            ]) { _, new in new },
            createdAt: current.createdAt,
            updatedAt: timestamp,
            redactionStatus: "private-state-excluded"
        )
        return try data.saveSettingsNotificationPreferences(updated)
    }

    public func integrationSummary(
        context: ServiceRequestContext,
        now: Date = Date()
    ) throws -> SettingsIntegrationSummary {
        try requireWorkspaceRead(context: context)
        let provider = try data.latestProviderConnectionSnapshot(workspaceId: context.workspaceId)
        let marketplace = try data.latestMarketplaceInstallSnapshot(workspaceId: context.workspaceId)
        let neededTools = try data.latestNeededToolsSnapshot(workspaceId: context.workspaceId)
        let providerSecretCount = Set(provider?.connections.flatMap(\.secretReferenceIds) ?? []).count
        let adminSetupAvailable = context.hasAnyRole([.owner, .admin])
        return SettingsIntegrationSummary(
            workspaceId: context.workspaceId,
            refreshedAt: ISO8601DateFormatter.relayConsole.string(from: now),
            harnesses: try harnessSummaries(),
            providerState: provider?.state,
            providerConnectionCount: provider?.connections.count ?? 0,
            providerSecretReferenceCount: providerSecretCount,
            marketplaceState: marketplace?.state,
            marketplaceInstallCount: marketplace?.installs.count ?? 0,
            neededToolsOpenCount: neededTools?.summary.openRequestCount ?? 0,
            adminSetupAvailable: adminSetupAvailable,
            readOnly: !adminSetupAvailable,
            paperclipState: "excluded",
            redactionStatus: "private-state-excluded"
        )
    }

    @discardableResult
    public func refreshIntegrationSummary(
        context: ServiceRequestContext,
        now: Date = Date()
    ) throws -> SettingsIntegrationSummary {
        let summary = try integrationSummary(context: context, now: now)
        eventBus.emit(.settingsIntegrationSummaryUpdated, summary)
        return summary
    }

    private func requireWorkspaceRead(context: ServiceRequestContext) throws {
        if let denied = ServiceGuard.requireAnyRole(
            [.owner, .admin, .member, .viewer],
            context: context,
            message: "Settings are unavailable for your current role.",
            auditRequired: false
        ) {
            throw denied
        }
    }

    private func requirePreferenceMutationAuthority(
        context: ServiceRequestContext,
        profileId: RelayId?
    ) throws {
        guard profileId == nil || context.actorId == profileId || context.hasAnyRole([.owner, .admin]) else {
            throw ServiceGuardResult(
                stateKind: .readOnly,
                reasonCode: .authorityReadOnly,
                message: "Only the matching local profile can change notification preferences.",
                recovery: "Switch to the matching local profile before saving notification preferences.",
                correlationId: context.correlationId,
                auditRequired: false
            )
        }
    }

    private func harnessSummaries() throws -> [SettingsHarnessSummary] {
        let harnesses = try data.listHarnesses()
        let byKey = Dictionary(grouping: harnesses) { harnessKey(for: $0) }
        return HarnessKey.allCases.map { key in
            let harness = byKey[key]?.first
            return SettingsHarnessSummary(
                harnessId: harness?.id,
                harnessKey: key,
                displayName: catalog[key]?.displayName ?? displayName(for: key),
                lifecycleState: harness.flatMap(lifecycleState) ?? .notInstalled,
                modelAuthStatus: harness.flatMap(modelAuthStatus) ?? .unknown,
                source: harness.flatMap(installSource) ?? .missing,
                healthStatus: harness.flatMap(healthStatus),
                secretReferencePresent: harness?.secretReferenceId != nil,
                lastError: harness.flatMap(lastError)
            )
        }
    }

    private func harnessKey(for harness: Harness) -> HarnessKey {
        stringValue(harness.config["harnessKey"]).flatMap(HarnessKey.init(rawValue:))
            ?? (harness.runtimeType == .openclaw ? .openclaw : .hermes)
    }

    private func lifecycleState(_ harness: Harness) -> HarnessLifecycleState {
        stringValue(harness.config["lifecycleState"]).flatMap(HarnessLifecycleState.init(rawValue:))
            ?? (harness.status == "active" ? .installed : .notInstalled)
    }

    private func modelAuthStatus(_ harness: Harness) -> HarnessModelAuthStatus {
        stringValue(harness.config["modelAuthStatus"]).flatMap(HarnessModelAuthStatus.init(rawValue:)) ?? .unknown
    }

    private func installSource(_ harness: Harness) -> HarnessInstallSource {
        stringValue(harness.config["source"]).flatMap(HarnessInstallSource.init(rawValue:)) ?? .located
    }

    private func healthStatus(_ harness: Harness) -> HarnessHealthStatus? {
        stringValue(harness.config["healthStatus"]).flatMap(HarnessHealthStatus.init(rawValue:))
            ?? stringValue(harness.config["status"]).flatMap(HarnessHealthStatus.init(rawValue:))
    }

    private func lastError(_ harness: Harness) -> String? {
        stringValue(harness.config["lastError"])
            ?? stringValue(harness.config["modelAuthLastError"])
            ?? stringValue(harness.config["lastTechnicalError"])
    }

    private func displayName(for key: HarnessKey) -> String {
        switch key {
        case .hermes: return "Hermes Agent"
        case .openclaw: return "OpenClaw"
        }
    }
}
