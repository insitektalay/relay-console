import Foundation

public enum RelayEventName: String, CaseIterable, Sendable {
    case appStateChanged = "relay:app-state-changed"
    case harnessInstallProgress = "relay:harness-install-progress"
    case harnessHealthChanged = "relay:harness-health-changed"
    case agentProvisioningUpdated = "relay:agent-provisioning-updated"
    case agentOrganizationUpdated = "relay:agent-organization-updated"
    case agentWorkUpdated = "relay:agent-work-updated"
    case dispatchUpdated = "relay:dispatch-updated"
    case runtimeEvent = "relay:runtime-event"
    case runtimeStructuredJobUpdated = "relay:runtime-structured-job-updated"
    case runtimeMissingToolUpdated = "relay:runtime-missing-tool-updated"
    case runtimeRecoveryUpdated = "relay:runtime-recovery-updated"
    case applicationsCatalogUpdated = "relay:applications-catalog-updated"
    case applicationsProviderConnectionUpdated = "relay:applications-provider-connection-updated"
    case applicationsMarketplaceInstallUpdated = "relay:applications-marketplace-install-updated"
    case applicationsProviderActionUpdated = "relay:applications-provider-action-updated"
    case applicationsNeededToolsUpdated = "relay:applications-needed-tools-updated"
    case insightsReportsUpdated = "relay:insights-reports-updated"
    case insightsAnalyticsUpdated = "relay:insights-analytics-updated"
    case settingsProfileUpdated = "relay:settings-profile-updated"
    case settingsWorkspaceUpdated = "relay:settings-workspace-updated"
    case settingsAlertUpdated = "relay:settings-alert-updated"
    case settingsNotificationPreferencesUpdated = "relay:settings-notification-preferences-updated"
    case settingsIntegrationSummaryUpdated = "relay:settings-integration-summary-updated"
    case settingsSecurityUpdated = "relay:settings-security-updated"
    case settingsLocalExportPrepared = "relay:settings-local-export-prepared"
    case settingsSaveFailed = "relay:settings-save-failed"
    case workSafetyTaskUpdated = "relay:work-safety-task-updated"
    case workSafetyApprovalUpdated = "relay:work-safety-approval-updated"
    case permissionPolicyUpdated = "relay:permission-policy-updated"
    case nativeFilePermissionUpdated = "relay:native-file-permission-updated"
    case auditLogUpdated = "relay:audit-log-updated"
    case securityMetricsUpdated = "relay:security-metrics-updated"
    case messageCreated = "relay:message-created"
    case threadUpdated = "relay:thread-updated"
    case chatMessageNew = "message.new"
    case chatThreadUpdate = "thread.update"
    case chatReadStateUpdate = "thread.read_state.update"
    case chatThreadArchived = "thread.archived"
    case chatWrapUpUpdate = "thread.wrap_up.update"
}

public final class RelayEventBus {
    public typealias Handler = @Sendable (Any) -> Void
    private let lock = NSLock()
    private var handlers: [RelayEventName: [UUID: Handler]] = [:]

    public init() {}

    @discardableResult
    public func on(_ eventName: RelayEventName, handler: @escaping Handler) -> UUID {
        let id = UUID()
        lock.lock()
        handlers[eventName, default: [:]][id] = handler
        lock.unlock()
        return id
    }

    public func off(_ eventName: RelayEventName, id: UUID) {
        lock.lock()
        handlers[eventName]?[id] = nil
        lock.unlock()
    }

    public func emit(_ eventName: RelayEventName, _ payload: Any) {
        lock.lock()
        let current = handlers[eventName]?.values.map { $0 } ?? []
        lock.unlock()
        for handler in current {
            handler(payload)
        }
    }
}
