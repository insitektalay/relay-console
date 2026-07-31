import Foundation
import RelayConsoleCore

@main
struct RelayConsoleProfileSettingsTests {
    static func main() throws {
        try run("profile settings persist and publish app state", testProfileSettingsPersistAndPublishAppState)
        try run("legacy profile preference migration is safe and one-shot", testLegacyProfilePreferenceMigration)
        try run("workspace settings and selected workspace survive relaunch", testWorkspaceSettingsAndSelectedWorkspacePersist)
        try run("new accounts select an empty local workspace without removing the previous workspace", testNewAccountWorkspaceIsolation)
        try run("settings navigation panel selection persists for retained panes", testSettingsNavigationPanelSelectionPersists)
        try run("runtime experience settings persist and default safely", testRuntimeExperienceSettingsPersist)
        try run("settings preference service saves account appearance and workspace", testSettingsPreferenceServiceSavesAccountAppearanceWorkspace)
        try run("settings status service handles integrations notifications and alerts", testSettingsStatusServiceHandlesIntegrationsNotificationsAndAlerts)
        try run("settings security service gates account lifecycle support legal decisions", testSettingsSecurityServiceGatesAccountLifecycleSupportLegalDecisions)
        try run("invalid profile and workspace settings do not mutate persistence", testInvalidInputsDoNotMutatePersistence)
        try run("profile settings fixture manifests match schema", testFixtureManifestsMatchSchema)
        print("RelayConsoleProfileSettingsTests passed")
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

    private static func testProfileSettingsPersistAndPublishAppState() throws {
        try withTemporaryRoot { root in
            let profileId: RelayId
            let counter = EventCounter()
            do {
                let services = try makeServices(root: root)
                let profile = try unwrap(services.data.getAppState().activeProfile, "missing default profile")
                profileId = profile.id
                let subscription = services.eventBus.on(.appStateChanged) { _ in
                    counter.increment()
                }
                defer {
                    services.eventBus.off(.appStateChanged, id: subscription)
                }

                let saved = try services.data.updateProfile(
                    profileId: profile.id,
                    displayName: "Fixture Owner",
                    email: "owner@example.test",
                    avatarUrl: "data:image/png;base64,ZmFrZS1maXh0dXJl",
                    telemetryEnabled: false,
                    crashReportingEnabled: true,
                    theme: "classic"
                )

                try expect(saved.displayName == "Fixture Owner", "profile display name did not update")
                try expect(saved.email == "owner@example.test", "profile email did not update")
                try expect(saved.avatarUrl?.hasPrefix("data:image/png;base64,") == true, "profile avatar did not update")
                try expect(!saved.telemetryEnabled, "telemetry preference did not update")
                try expect(saved.crashReportingEnabled, "crash preference did not update")
                try expect(counter.value == 1, "profile update did not publish app state")
            }

            do {
                let reopened = try makeServices(root: root)
                let persisted = try reopened.data.getProfile(profileId)
                try expect(persisted.displayName == "Fixture Owner", "profile display name did not survive relaunch")
                try expect(persisted.email == "owner@example.test", "profile email did not survive relaunch")
                try expect(!persisted.telemetryEnabled, "telemetry preference did not survive relaunch")
                try expect(persisted.theme == "classic", "theme preference did not survive relaunch")
            }
        }
    }

    private static func testLegacyProfilePreferenceMigration() throws {
        try withTemporaryRoot { root in
            let services = try makeServices(root: root)
            let profile = try unwrap(services.data.getAppState().activeProfile, "missing default profile")

            let migrated = try unwrap(
                services.data.migrateLegacyUserProfilePreference(
                    LocalProfilePreferenceSnapshot(
                        displayName: "Legacy Owner",
                        email: "not-an-email",
                        avatarUrl: "data:image/png;base64,bGVnYWN5",
                        telemetryEnabled: false,
                        crashReportingEnabled: false,
                        theme: "classic"
                    )
                ),
                "legacy migration returned no profile"
            )

            try expect(migrated.displayName == "Legacy Owner", "legacy display name did not migrate")
            try expect(migrated.email == profile.email, "invalid legacy email should not overwrite durable email")
            try expect(migrated.avatarUrl?.contains("bGVnYWN5") == true, "legacy avatar did not migrate")
            try expect(!migrated.telemetryEnabled, "legacy telemetry preference did not migrate")
            try expect(!migrated.crashReportingEnabled, "legacy crash preference did not migrate")

            _ = try services.data.migrateLegacyUserProfilePreference(
                LocalProfilePreferenceSnapshot(displayName: "Second Legacy", email: "second@example.test")
            )
            let afterSecondAttempt = try services.data.getProfile(profile.id)
            try expect(afterSecondAttempt.displayName == "Legacy Owner", "legacy migration should not run twice")
            try expect(afterSecondAttempt.email == nil, "second legacy email should not overwrite after migration marker")
        }
    }

    private static func testWorkspaceSettingsAndSelectedWorkspacePersist() throws {
        try withTemporaryRoot { root in
            let profileId: RelayId
            let secondWorkspaceId: RelayId
            do {
                let services = try makeServices(root: root)
                let profile = try unwrap(services.data.getAppState().activeProfile, "missing default profile")
                profileId = profile.id
                let second = try services.data.createWorkspace(
                    profileId: profile.id,
                    name: "Research Workspace",
                    defaultFolderPath: nil,
                    workspaceType: "business",
                    settings: ["sidebarCollapsed": .bool(false)]
                )
                secondWorkspaceId = second.id

                let saved = try services.data.updateWorkspaceSettings(
                    workspaceId: second.id,
                    name: "Research Workspace",
                    defaultFolderPath: nil,
                    workspaceType: "business",
                    settings: [
                        "sidebarCollapsed": .bool(true),
                        "defaultSettingsPanel": .string("account")
                    ]
                )
                try services.data.setSelectedWorkspaceId(second.id)

                try expect(saved.profileId == profileId, "workspace profile relationship changed")
                try expect(saved.workspaceType == "business", "workspace type did not update")
                try expect(saved.settings["sidebarCollapsed"] == .bool(true), "workspace settings did not update")
            }

            do {
                let reopened = try makeServices(root: root)
                let active = try unwrap(reopened.data.getAppState().activeWorkspace, "missing reopened active workspace")
                try expect(active.id == secondWorkspaceId, "selected workspace did not survive relaunch")
                try expect(active.workspaceType == "business", "workspace type did not survive relaunch")
                try expect(active.settings["defaultSettingsPanel"] == .string("account"), "workspace settings did not survive relaunch")
            }
        }
    }

    private static func testNewAccountWorkspaceIsolation() throws {
        try withTemporaryRoot { root in
            let services = try makeServices(root: root)
            let state = try services.data.getAppState()
            let profile = try unwrap(state.activeProfile, "missing default profile")
            let previous = try unwrap(state.activeWorkspace, "missing default workspace")

            let fresh = try services.data.createAndSelectEmptyWorkspace(
                profileId: profile.id,
                name: "New Beta Workspace"
            )

            let active = try unwrap(
                services.data.getAppState().activeWorkspace,
                "new account workspace was not selected"
            )
            try expect(active.id == fresh.id, "new account did not select its own workspace")
            try expect(active.id != previous.id, "new account reused the previous local workspace")
            try expect(
                active.settings["accountIsolatedLocalData"] == .bool(true),
                "new account did not isolate unowned local data"
            )
            try expect(
                active.settings["residentAgentAutoBootstrap"] == .bool(false),
                "new account enabled an automatic resident agent"
            )
            try expect(
                try services.data.listAgents(workspaceId: fresh.id).isEmpty,
                "new account workspace inherited local agents"
            )
            try expect(
                try services.data.listThreads(workspaceId: fresh.id).isEmpty,
                "new account workspace inherited local conversations"
            )
            try expect(
                try services.data.getWorkspace(previous.id).id == previous.id,
                "creating a new account removed the previous local workspace"
            )
        }
    }

    private static func testSettingsNavigationPanelSelectionPersists() throws {
        try withTemporaryRoot { root in
            let retainedPanels = [
                "account",
                "appearance",
                "workspace",
                "team",
                "integrations",
                "notifications",
                "security",
                "harnesses",
                "runtime"
            ]
            do {
                let services = try makeServices(root: root)
                for panel in retainedPanels {
                    try services.data.setSelectedSettingsPanel(panel)
                    try expect(try services.data.getSelectedSettingsPanel() == panel, "selected settings panel \(panel) did not persist immediately")
                }
                do {
                    try services.data.setSelectedSettingsPanel("standalone_approvals")
                    throw ProfileSettingsTestFailure("unsupported settings panel unexpectedly persisted")
                } catch let error as RelayError {
                    try expect(error.code == .unsupported, "unsupported settings panel returned wrong error")
                }
            }

            do {
                let reopened = try makeServices(root: root)
                try expect(try reopened.data.getSelectedSettingsPanel() == "runtime", "selected settings panel did not survive relaunch")
            }
        }
    }

    private static func testRuntimeExperienceSettingsPersist() throws {
        try withTemporaryRoot { root in
            do {
                let services = try makeServices(root: root)
                let detailedDefault: Bool = try services.data.getAppSetting(
                    RuntimeExperienceSettings.detailedActivityEnabledKey,
                    fallback: RuntimeExperienceSettings.defaultDetailedActivityEnabled
                )
                let runConfirmationDefault: Bool = try services.data.getAppSetting(
                    RuntimeExperienceSettings.runConfirmationEnabledKey,
                    fallback: RuntimeExperienceSettings.defaultRunConfirmationEnabled
                )
                try expect(detailedDefault, "detailed runtime activity should default on")
                try expect(!runConfirmationDefault, "conversation start should default to automatic")
                try services.data.setAppSetting(RuntimeExperienceSettings.detailedActivityEnabledKey, value: false)
                try services.data.setAppSetting(RuntimeExperienceSettings.runConfirmationEnabledKey, value: false)
            }

            do {
                let reopened = try makeServices(root: root)
                let detailed: Bool = try reopened.data.getAppSetting(
                    RuntimeExperienceSettings.detailedActivityEnabledKey,
                    fallback: true
                )
                let runConfirmation: Bool = try reopened.data.getAppSetting(
                    RuntimeExperienceSettings.runConfirmationEnabledKey,
                    fallback: true
                )
                try expect(!detailed, "detailed runtime activity preference did not survive relaunch")
                try expect(!runConfirmation, "run confirmation preference did not survive relaunch")
            }
        }
    }

    private static func testSettingsPreferenceServiceSavesAccountAppearanceWorkspace() throws {
        try withTemporaryRoot { root in
            let profileId: RelayId
            let workspaceId: RelayId
            let profileEvents = EventCounter()
            let workspaceEvents = EventCounter()
            do {
                let services = try makeServices(root: root)
                let profile = try unwrap(services.data.getAppState().activeProfile, "missing default profile")
                let workspace = try unwrap(services.data.getAppState().activeWorkspace, "missing default workspace")
                profileId = profile.id
                workspaceId = workspace.id
                let profileSub = services.eventBus.on(.settingsProfileUpdated) { _ in profileEvents.increment() }
                let workspaceSub = services.eventBus.on(.settingsWorkspaceUpdated) { _ in workspaceEvents.increment() }
                defer {
                    services.eventBus.off(.settingsProfileUpdated, id: profileSub)
                    services.eventBus.off(.settingsWorkspaceUpdated, id: workspaceSub)
                }
                let ownerContext = ServiceRequestContext(
                    actorId: profile.id,
                    workspaceId: workspace.id,
                    roles: [.owner],
                    correlationId: "settings-owner"
                )

                do {
                    _ = try services.settingsPreferences.saveAccount(
                        context: ownerContext,
                        profileId: profile.id,
                        input: AccountSettingsInput(
                            displayName: " ",
                            email: "settings@example.test",
                            avatarUrl: nil,
                            telemetryEnabled: true,
                            crashReportingEnabled: true
                        )
                    )
                    throw ProfileSettingsTestFailure("blank account name did not fail")
                } catch let error as RelayError {
                    try expect(error.code == .invalidInput, "blank account name returned wrong error")
                }

                let nameOnlyAccount = try services.settingsPreferences.saveAccount(
                    context: ownerContext,
                    profileId: profile.id,
                    input: AccountSettingsInput(
                        displayName: "Settings Owner",
                        email: "",
                        avatarUrl: "data:image/png;base64,bmFtZS1vbmx5",
                        telemetryEnabled: true,
                        crashReportingEnabled: true
                    )
                )
                try expect(nameOnlyAccount.email == nil, "blank settings email should persist as nil")
                try expect(nameOnlyAccount.avatarUrl?.contains("bmFtZS1vbmx5") == true, "settings service did not persist avatar without email")

                let savedAccount = try services.settingsPreferences.saveAccount(
                    context: ownerContext,
                    profileId: profile.id,
                    input: AccountSettingsInput(
                        displayName: "Settings Owner",
                        email: "settings@example.test",
                        avatarUrl: "data:image/png;base64,c2V0dGluZ3M=",
                        telemetryEnabled: false,
                        crashReportingEnabled: false
                    )
                )
                try expect(savedAccount.displayName == "Settings Owner", "settings service did not update account name")
                try expect(savedAccount.email == "settings@example.test", "settings service did not update account email")
                try expect(savedAccount.avatarUrl?.contains("c2V0dGluZ3M=") == true, "settings service did not persist avatar")
                try expect(!savedAccount.telemetryEnabled, "settings service did not persist telemetry")
                try expect(!savedAccount.crashReportingEnabled, "settings service did not persist crash setting")

                let removedAvatar = try services.settingsPreferences.saveAccount(
                    context: ownerContext,
                    profileId: profile.id,
                    input: AccountSettingsInput(
                        displayName: "Settings Owner",
                        email: "settings@example.test",
                        avatarUrl: nil,
                        telemetryEnabled: false,
                        crashReportingEnabled: false
                    )
                )
                try expect(removedAvatar.avatarUrl == nil, "settings service did not remove avatar")

                let appearance = try services.settingsPreferences.saveAppearance(
                    context: ownerContext,
                    profileId: profile.id,
                    input: AppearanceSettingsInput(theme: "classic")
                )
                try expect(appearance.theme == "classic", "appearance default theme did not persist")

                let company = try services.data.createAgentOrgCompany(workspaceId: workspace.id, name: "Settings Co")
                let department = try services.data.createAgentOrgDepartment(workspaceId: workspace.id, companyId: company.id, name: "Settings Dept")
                _ = try services.data.createAgentOrgTeam(workspaceId: workspace.id, departmentId: department.id, name: "Settings Team")
                let harness = try services.data.upsertHarness(
                    runtimeType: .hermes,
                    displayName: "Settings Harness",
                    mode: .userManaged,
                    config: ["fixture": .string("settings")]
                )
                _ = try services.data.createAgent(workspaceId: workspace.id, name: "Settings Agent", harnessId: harness.id)
                let summary = try services.settingsPreferences.workspaceSummary(context: ownerContext, workspaceId: workspace.id)
                try expect(summary.organizations == 1, "workspace summary org count was wrong")
                try expect(summary.departments == 1, "workspace summary department count was wrong")
                try expect(summary.teams == 1, "workspace summary team count was wrong")
                try expect(summary.agents == 1, "workspace summary agent count was wrong")
                try expect(!summary.readOnly, "owner workspace summary should not be read-only")

                let savedWorkspace = try services.settingsPreferences.saveWorkspace(
                    context: ownerContext,
                    workspaceId: workspace.id,
                    input: WorkspaceSettingsInput(name: "Settings Workspace", workspaceType: "business")
                )
                try expect(savedWorkspace.name == "Settings Workspace", "workspace name did not update through settings service")
                try expect(savedWorkspace.workspaceType == "business", "workspace type did not update through settings service")

                let viewerContext = ServiceRequestContext(
                    actorId: "viewer-profile",
                    workspaceId: workspace.id,
                    roles: [.viewer],
                    correlationId: "settings-viewer"
                )
                let viewerSummary = try services.settingsPreferences.workspaceSummary(context: viewerContext, workspaceId: workspace.id)
                try expect(viewerSummary.readOnly, "viewer workspace summary should be read-only")

                for roles in [Set<ServiceRole>([.viewer]), Set<ServiceRole>([.member])] {
                    do {
                        _ = try services.settingsPreferences.saveWorkspace(
                            context: ServiceRequestContext(
                                actorId: "readonly-profile",
                                workspaceId: workspace.id,
                                roles: roles,
                                correlationId: "settings-readonly"
                            ),
                            workspaceId: workspace.id,
                            input: WorkspaceSettingsInput(name: "Denied Workspace", workspaceType: "business")
                        )
                        throw ProfileSettingsTestFailure("read-only workspace mutation unexpectedly succeeded")
                    } catch let guardResult as ServiceGuardResult {
                        try expect(guardResult.reasonCode == .authorityRoleRequired, "read-only workspace mutation returned wrong guard reason")
                    }
                }

                try expect(profileEvents.value == 4, "settings profile events did not publish")
                try expect(workspaceEvents.value == 1, "settings workspace event did not publish")
            }

            do {
                let reopened = try makeServices(root: root)
                let profile = try reopened.data.getProfile(profileId)
                let workspace = try reopened.data.getWorkspace(workspaceId)
                try expect(profile.displayName == "Settings Owner", "settings account did not survive relaunch")
                try expect(profile.email == "settings@example.test", "settings email did not survive relaunch")
                try expect(profile.avatarUrl == nil, "removed avatar did not survive relaunch")
                try expect(!profile.telemetryEnabled, "telemetry setting did not survive relaunch")
                try expect(profile.theme == "classic", "appearance theme did not survive relaunch")
                try expect(workspace.name == "Settings Workspace", "workspace settings did not survive relaunch")
                try expect(workspace.workspaceType == "business", "workspace type did not survive relaunch")
            }
        }
    }

    private static func testInvalidInputsDoNotMutatePersistence() throws {
        try withTemporaryRoot { root in
            let services = try makeServices(root: root)
            let profile = try unwrap(services.data.getAppState().activeProfile, "missing default profile")
            let workspace = try unwrap(services.data.getAppState().activeWorkspace, "missing default workspace")

            do {
                _ = try services.data.updateProfile(
                    profileId: profile.id,
                    displayName: " ",
                    email: "owner@example.test",
                    avatarUrl: nil,
                    telemetryEnabled: true,
                    crashReportingEnabled: true,
                    theme: "classic"
                )
                throw ProfileSettingsTestFailure("blank profile name did not fail")
            } catch let error as RelayError {
                try expect(error.code == .invalidInput, "blank profile name returned wrong error")
            }

            do {
                _ = try services.data.updateWorkspaceSettings(
                    workspaceId: workspace.id,
                    name: workspace.name,
                    defaultFolderPath: workspace.defaultFolderPath,
                    workspaceType: "cloud-only",
                    settings: [:]
                )
                throw ProfileSettingsTestFailure("unsupported workspace type did not fail")
            } catch let error as RelayError {
                try expect(error.code == .unsupported, "unsupported workspace type returned wrong error")
            }

            let unchangedProfile = try services.data.getProfile(profile.id)
            let unchangedWorkspace = try services.data.getWorkspace(workspace.id)
            try expect(unchangedProfile.displayName == profile.displayName, "invalid profile update mutated display name")
            try expect(unchangedWorkspace.workspaceType == workspace.workspaceType, "invalid workspace update mutated type")
        }
    }

    private static func testSettingsStatusServiceHandlesIntegrationsNotificationsAndAlerts() throws {
        try withTemporaryRoot { root in
            let profileId: RelayId
            let workspaceId: RelayId
            let alertEvents = EventCounter()
            let preferenceEvents = EventCounter()
            let integrationEvents = EventCounter()
            do {
                let services = try makeServices(root: root)
                let profile = try unwrap(services.data.getAppState().activeProfile, "missing default profile")
                let workspace = try unwrap(services.data.getAppState().activeWorkspace, "missing default workspace")
                profileId = profile.id
                workspaceId = workspace.id
                let alertSub = services.eventBus.on(.settingsAlertUpdated) { _ in alertEvents.increment() }
                let preferenceSub = services.eventBus.on(.settingsNotificationPreferencesUpdated) { _ in preferenceEvents.increment() }
                let integrationSub = services.eventBus.on(.settingsIntegrationSummaryUpdated) { _ in integrationEvents.increment() }
                defer {
                    services.eventBus.off(.settingsAlertUpdated, id: alertSub)
                    services.eventBus.off(.settingsNotificationPreferencesUpdated, id: preferenceSub)
                    services.eventBus.off(.settingsIntegrationSummaryUpdated, id: integrationSub)
                }
                let ownerContext = ServiceRequestContext(
                    actorId: profile.id,
                    workspaceId: workspace.id,
                    roles: [.owner],
                    correlationId: "settings-status-owner"
                )
                let viewerContext = ServiceRequestContext(
                    actorId: "viewer-profile",
                    workspaceId: workspace.id,
                    roles: [.viewer],
                    correlationId: "settings-status-viewer"
                )
                let baseDate = fixedDate("2026-01-01T00:00:00Z")
                let expiredDate = "2025-12-31T23:59:59Z"

                _ = try services.data.upsertHarness(
                    runtimeType: .hermes,
                    displayName: "Hermes Agent",
                    mode: .appManaged,
                    config: [
                        "harnessKey": .string(HarnessKey.hermes.rawValue),
                        "source": .string(HarnessInstallSource.managed.rawValue),
                        "lifecycleState": .string(HarnessLifecycleState.connected.rawValue),
                        "modelAuthStatus": .string(HarnessModelAuthStatus.connected.rawValue),
                        "healthStatus": .string(HarnessHealthStatus.healthy.rawValue)
                    ],
                    secretReferenceId: "sec-harness-redacted"
                )
                try services.data.saveProviderConnectionSnapshot(providerSnapshot(workspaceId: workspace.id))
                try services.data.saveMarketplaceInstallSnapshot(emptyMarketplaceSnapshot(workspaceId: workspace.id))
                try services.data.saveNeededToolsSnapshot(neededToolsSnapshot(workspaceId: workspace.id, openRequestCount: 2))

                let warning = try services.settingsStatus.createAlert(
                    context: ownerContext,
                    input: SettingsAlertInput(
                        title: "Provider reconnect required",
                        message: "Outlook auth needs attention.",
                        severity: .warning,
                        category: "integrations",
                        sourceKind: "provider_connection",
                        sourceId: "provider-redacted",
                        actionLabel: "Open integrations",
                        actionTarget: "settings.integrations",
                        metadata: ["rawToken": .string("sk-sensitive-alert-value")]
                    ),
                    now: baseDate
                )
                _ = try services.settingsStatus.createAlert(
                    context: ownerContext,
                    input: SettingsAlertInput(
                        title: "Harness ready",
                        message: "Hermes Agent is connected.",
                        severity: .success,
                        category: "harnesses",
                        sourceKind: "harness"
                    ),
                    now: baseDate
                )
                _ = try services.settingsStatus.createAlert(
                    context: ownerContext,
                    input: SettingsAlertInput(
                        title: "Expired notice",
                        message: "This alert should be filtered by default.",
                        severity: .info,
                        category: "expired",
                        sourceKind: "fixture",
                        expiresAt: expiredDate
                    ),
                    now: baseDate
                )
                do {
                    _ = try services.settingsStatus.createAlert(
                        context: viewerContext,
                        input: SettingsAlertInput(title: "Denied", message: "Denied", severity: .info, category: "x", sourceKind: "x"),
                        now: baseDate
                    )
                    throw ProfileSettingsTestFailure("viewer alert creation unexpectedly succeeded")
                } catch let guardResult as ServiceGuardResult {
                    try expect(guardResult.reasonCode == .authorityRoleRequired, "viewer alert creation returned wrong guard")
                }

                let activeAlerts = try services.settingsStatus.alerts(context: ownerContext, now: baseDate)
                try expect(activeAlerts.count == 2, "active alert filtering included expired alerts")
                try expect(!activeAlerts.description.contains("sk-sensitive-alert-value"), "alert metadata exposed raw secret-like value")
                try expect(try services.settingsStatus.unreadAlertCount(context: ownerContext, now: baseDate) == 2, "unread alert count was wrong")
                let unreadBefore = try services.settingsStatus.alerts(context: ownerContext, unreadOnly: true, now: baseDate)
                try expect(unreadBefore.count == 2, "unread-only alert list was wrong")
                let read = try services.settingsStatus.markAlertRead(context: ownerContext, alertId: warning.id, now: fixedDate("2026-01-01T00:01:00Z"))
                try expect(read.readAt != nil, "alert read state did not persist")
                try expect(try services.settingsStatus.unreadAlertCount(context: ownerContext, now: baseDate) == 1, "unread count did not update after read")
                let unreadAfter = try services.settingsStatus.alerts(context: ownerContext, unreadOnly: true, now: baseDate)
                try expect(!unreadAfter.contains(where: { $0.id == warning.id }), "read alert remained in unread-only list")
                _ = try services.settingsStatus.markAllAlertsRead(context: ownerContext, now: fixedDate("2026-01-01T00:02:00Z"))
                try expect(try services.settingsStatus.unreadAlertCount(context: ownerContext, now: baseDate) == 0, "mark-all did not clear unread count")
                let allAlerts = try services.settingsStatus.alerts(context: ownerContext, includeExpired: true, now: baseDate)
                try expect(allAlerts.count == 3, "includeExpired did not return expired alerts")

                let defaults = try services.settingsStatus.notificationPreferences(context: ownerContext, profileId: profile.id)
                try expect(defaults.inAppAlertsEnabled, "default in-app alerts should be enabled")
                try expect(defaults.unreadBadgeEnabled, "default unread badge should be enabled")
                try expect(defaults.emailDeliveryState == .unavailable, "email delivery should stay unavailable")
                try expect(defaults.mobileDeliveryState == .unavailable, "mobile delivery should stay unavailable")
                let savedPreferences = try services.settingsStatus.saveNotificationPreferences(
                    context: ownerContext,
                    profileId: profile.id,
                    input: NotificationPreferenceInput(inAppAlertsEnabled: false, unreadBadgeEnabled: true)
                )
                try expect(!savedPreferences.inAppAlertsEnabled, "in-app preference did not save")
                try expect(savedPreferences.emailDeliveryState == .unavailable, "email preference save exposed unsupported delivery")
                do {
                    _ = try services.settingsStatus.saveNotificationPreferences(
                        context: viewerContext,
                        profileId: profile.id,
                        input: NotificationPreferenceInput(inAppAlertsEnabled: true, unreadBadgeEnabled: true)
                    )
                    throw ProfileSettingsTestFailure("mismatched viewer preference mutation unexpectedly succeeded")
                } catch let guardResult as ServiceGuardResult {
                    try expect(guardResult.reasonCode == .authorityReadOnly, "mismatched preference mutation returned wrong guard")
                }

                let ownerSummary = try services.settingsStatus.refreshIntegrationSummary(context: ownerContext, now: baseDate)
                try expect(ownerSummary.providerState == .ready, "provider summary state was wrong")
                try expect(ownerSummary.providerConnectionCount == 1, "provider connection count was wrong")
                try expect(ownerSummary.providerSecretReferenceCount == 1, "provider secret reference count was wrong")
                try expect(ownerSummary.marketplaceState == .empty, "marketplace summary state was wrong")
                try expect(ownerSummary.neededToolsOpenCount == 2, "needed tools count was wrong")
                try expect(ownerSummary.paperclipState == "excluded", "Paperclip exclusion was not retained")
                try expect(!ownerSummary.readOnly && ownerSummary.adminSetupAvailable, "owner integration setup state was wrong")
                try expect(ownerSummary.harnesses.contains(where: { $0.harnessKey == .hermes && $0.lifecycleState == .connected && $0.secretReferencePresent }), "Hermes harness summary was wrong")
                let encodedSummary = encodeJSONString(ownerSummary) ?? ""
                try expect(!encodedSummary.contains("sec-provider-redacted"), "integration summary exposed raw secret reference id")
                let viewerSummary = try services.settingsStatus.integrationSummary(context: viewerContext, now: baseDate)
                try expect(viewerSummary.readOnly && !viewerSummary.adminSetupAvailable, "viewer integration summary should be read-only")

                try expect(alertEvents.value >= 5, "settings alert events did not publish")
                try expect(preferenceEvents.value >= 2, "notification preference events did not publish")
                try expect(integrationEvents.value == 1, "integration summary refresh event did not publish")
            }

            do {
                let reopened = try makeServices(root: root)
                let context = ServiceRequestContext(
                    actorId: profileId,
                    workspaceId: workspaceId,
                    roles: [.owner],
                    correlationId: "settings-status-reopen"
                )
                let persistedPreferences = try reopened.settingsStatus.notificationPreferences(context: context, profileId: profileId)
                try expect(!persistedPreferences.inAppAlertsEnabled, "notification preferences did not survive relaunch")
                let persistedAlerts = try reopened.settingsStatus.alerts(context: context, includeExpired: true, now: fixedDate("2026-01-01T00:03:00Z"))
                try expect(persistedAlerts.count == 3, "alerts did not survive relaunch")
                try expect(persistedAlerts.allSatisfy { $0.redactionStatus == "private-state-excluded" }, "persisted alerts lost redaction status")
            }
        }
    }

    private static func testSettingsSecurityServiceGatesAccountLifecycleSupportLegalDecisions() throws {
        try withTemporaryRoot { root in
            let profileId: RelayId
            let workspaceId: RelayId
            let securityEvents = EventCounter()
            let exportEvents = EventCounter()
            do {
                let services = try makeServices(root: root)
                let profile = try unwrap(services.data.getAppState().activeProfile, "missing default profile")
                let workspace = try unwrap(services.data.getAppState().activeWorkspace, "missing default workspace")
                profileId = profile.id
                workspaceId = workspace.id
                let securitySub = services.eventBus.on(.settingsSecurityUpdated) { _ in securityEvents.increment() }
                let exportSub = services.eventBus.on(.settingsLocalExportPrepared) { _ in exportEvents.increment() }
                defer {
                    services.eventBus.off(.settingsSecurityUpdated, id: securitySub)
                    services.eventBus.off(.settingsLocalExportPrepared, id: exportSub)
                }
                let ownerContext = ServiceRequestContext(
                    actorId: profile.id,
                    workspaceId: workspace.id,
                    roles: [.owner],
                    correlationId: "settings-security-owner"
                )
                let viewerContext = ServiceRequestContext(
                    actorId: "viewer-profile",
                    workspaceId: workspace.id,
                    roles: [.viewer],
                    correlationId: "settings-security-viewer"
                )
                let baseDate = fixedDate("2026-01-01T00:00:00Z")

                let summary = try services.settingsSecurity.refreshSecuritySummary(
                    context: ownerContext,
                    profileId: profile.id,
                    now: baseDate
                )
                try expect(summary.mode == "local-first", "security summary mode was wrong")
                try expect(summary.decisionDispositions.count == 3, "decision dispositions were not created")
                try expect(Set(summary.decisionDispositions.map(\.decisionId)) == Set(["D-0001", "D-0004", "D-0006"]), "decision ids were wrong")
                try expect(summary.cloudAccountState == .unavailable, "cloud account state should be unavailable")
                try expect(summary.destructiveLifecycleState == .available, "destructive lifecycle should be available with confirmation")
                try expect(summary.supportEvidenceState == .decisionGated, "support/legal/status should be decision-gated")
                try expect(summary.actionDispositions.contains(where: { $0.id == "export_account" && $0.enabled && !$0.destructive }), "export action disposition was wrong")
                try expect(summary.actionDispositions.contains(where: { $0.id == "reset_local_data" && $0.enabled && $0.state == .available && $0.decisionId == "D-0006" }), "reset action disposition was wrong")
                try expect(summary.actionDispositions.contains(where: { $0.id == "change_password" && $0.state == .unavailable && $0.decisionId == "D-0004" }), "cloud password action disposition was wrong")

                let export = try services.settingsSecurity.prepareLocalAccountExport(
                    context: ownerContext,
                    profileId: profile.id,
                    now: fixedDate("2026-01-01T00:01:00Z")
                )
                try expect(export.status == "prepared", "local export was not prepared")
                try expect(export.recordCount == 4, "local export record count was wrong")
                try expect(!export.includesSecrets, "local export metadata claimed secrets")
                try expect(export.exportMetadata["rawSecretsIncluded"] == .bool(false), "local export metadata should exclude raw secrets")
                try expect(export.exportMetadata["profileValuesIncluded"] == .bool(false), "local export metadata should exclude profile values")
                let encodedExport = encodeJSONString(export) ?? ""
                try expect(!encodedExport.contains(profile.email ?? "owner@example.test"), "local export encoded profile email")

                let afterExport = try services.settingsSecurity.securitySummary(context: ownerContext, profileId: profile.id, now: fixedDate("2026-01-01T00:02:00Z"))
                try expect(afterExport.latestExport?.id == export.id, "security summary did not include latest export")

                for (action, decision) in [
                    (SettingsSecurityBlockedAction.changePassword, "D-0004"),
                    (.support, "D-0001")
                ] {
                    do {
                        try services.settingsSecurity.blockDecisionGatedAction(context: ownerContext, action: action)
                        throw ProfileSettingsTestFailure("\(action.rawValue) unexpectedly ran")
                    } catch let guardResult as ServiceGuardResult {
                        try expect(guardResult.reasonCode == .decisionRequired, "\(action.rawValue) returned wrong reason")
                        try expect(guardResult.decisionId == decision, "\(action.rawValue) returned wrong decision id")
                    }
                }

                do {
                    _ = try services.settingsSecurity.prepareLocalAccountExport(
                        context: viewerContext,
                        profileId: profile.id,
                        now: fixedDate("2026-01-01T00:03:00Z")
                    )
                    throw ProfileSettingsTestFailure("mismatched viewer export unexpectedly succeeded")
                } catch let guardResult as ServiceGuardResult {
                    try expect(guardResult.reasonCode == .authorityReadOnly, "mismatched export returned wrong guard")
                }

                let blockedAudit = try services.auditSecurity.list(
                    context: ownerContext,
                    query: AuditLogQuery(limit: 10, eventType: "settings.lifecycle.blocked")
                )
                try expect(blockedAudit.records.count == 2, "blocked lifecycle audit count was wrong")
                try expect(blockedAudit.records.allSatisfy { $0.redactionStatus == "private-state-excluded" }, "blocked audit rows lost redaction status")
                try expect(securityEvents.value >= 2, "settings security event did not publish")
                try expect(exportEvents.value == 1, "settings local export event did not publish")
            }

            do {
                let reopened = try makeServices(root: root)
                let context = ServiceRequestContext(
                    actorId: profileId,
                    workspaceId: workspaceId,
                    roles: [.owner],
                    correlationId: "settings-security-reopen"
                )
                let summary = try reopened.settingsSecurity.securitySummary(
                    context: context,
                    profileId: profileId,
                    now: fixedDate("2026-01-01T00:04:00Z")
                )
                try expect(summary.decisionDispositions.count == 3, "decision dispositions did not survive relaunch")
                try expect(summary.latestExport?.includesSecrets == false, "local export redaction did not survive relaunch")
            }
        }
    }

    private static func testFixtureManifestsMatchSchema() throws {
        for path in [
            "Tests/Fixtures/migrations/profile-workspace/v006-profile-preferences-001/manifest.md",
            "Tests/Fixtures/services/profile-workspace/profile-save-settings-001/manifest.md",
            "Tests/Fixtures/services/settings/navigation-preferences-001/manifest.md",
            "Tests/Fixtures/services/settings/harness-alert-report-001/manifest.md",
            "Tests/Fixtures/services/settings/security-decision-gates-001/manifest.md"
        ] {
            let manifest = try readPackageFile(path)
            for field in requiredManifestFields {
                try expect(manifest.contains("\(field):"), "\(path) is missing \(field)")
            }
            try expect(manifest.contains("ITC-0009") || manifest.contains("ITC-0047") || manifest.contains("ITC-0048") || manifest.contains("ITC-0049") || manifest.contains("ITC-0050"), "\(path) must link a profile/settings task id")
            try expect(manifest.contains("RelayConsoleProfileSettingsTests"), "\(path) must name consuming test")
        }

        let profileSettings = try readPackageFile("Tests/Fixtures/services/profile-workspace/profile-save-settings-001/manifest.md")
        for expected in [
            "ITC-0048",
            "SettingsPreferenceService",
            "settingsProfileUpdated",
            "settingsWorkspaceUpdated",
            "owner/admin",
            "viewer/member"
        ] {
            try expect(profileSettings.contains(expected), "profile workspace fixture missing \(expected)")
        }

        let settingsNavigation = try readPackageFile("Tests/Fixtures/services/settings/navigation-preferences-001/manifest.md")
        for expected in [
            "ITC-0047",
            "appearance",
            "workspace",
            "team",
            "integrations",
            "notifications",
            "security",
            "harnesses",
            "standalone_approvals"
        ] {
            try expect(settingsNavigation.contains(expected), "settings navigation fixture missing \(expected)")
        }

        let harnessAlertReport = try readPackageFile("Tests/Fixtures/services/settings/harness-alert-report-001/manifest.md")
        for expected in [
            "ITC-0049",
            "SettingsStatusService",
            "settingsAlertUpdated",
            "settingsNotificationPreferencesUpdated",
            "settingsIntegrationSummaryUpdated",
            "Paperclip",
            "secret-reference-only",
            "email/mobile delivery unavailable"
        ] {
            try expect(harnessAlertReport.contains(expected), "settings status fixture missing \(expected)")
        }

        let securityDecisionGates = try readPackageFile("Tests/Fixtures/services/settings/security-decision-gates-001/manifest.md")
        for expected in [
            "ITC-0050",
            "SettingsSecurityService",
            "settingsSecurityUpdated",
            "settingsLocalExportPrepared",
            "D-0001",
            "D-0004",
            "D-0006",
            "secret-safe export",
            "decision.required"
        ] {
            try expect(securityDecisionGates.contains(expected), "settings security fixture missing \(expected)")
        }

        let decisionGate = try readPackageFile("Tests/Fixtures/manual-evidence/decision-gates/support-cloud-assets-001/manifest.md")
        try expect(decisionGate.contains("decision.required"), "decision-gated manifest must retain decision-required reason")
        try expect(decisionGate.contains("notParityStatement:"), "decision-gated manifest must retain non-parity statement")
    }

    private static func withTemporaryRoot(_ body: (URL) throws -> Void) throws {
        let root = FileManager.default.temporaryDirectory
            .appendingPathComponent("RelayConsoleProfileSettingsTests", isDirectory: true)
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        defer {
            try? FileManager.default.removeItem(at: root)
        }
        try body(root)
    }

    private static func makeServices(root: URL) throws -> RelayConsoleServices {
        try RelayConsoleServices(
            userDataPath: root,
            appVersion: "test",
            runner: StubCommandRunner(),
            secretStore: MemorySecretStore(),
            refreshInstalledHarnessesOnLaunch: false,
            openExternal: { _ in }
        )
    }

    private static func readPackageFile(_ relativePath: String) throws -> String {
        let url = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
            .appendingPathComponent(relativePath)
        return try String(contentsOf: url, encoding: .utf8)
    }

    private static func providerSnapshot(workspaceId: RelayId) -> ProviderConnectionSnapshot {
        let timestamp = "2026-01-01T00:00:00Z"
        let connection = MarketplaceProviderConnection(
            id: "mpc-settings-provider-001",
            workspaceId: workspaceId,
            appId: "app-settings-provider-001",
            appSlug: "settings-provider",
            providerKey: "settings-provider",
            providerName: "Settings Provider",
            status: .connected,
            authorizationState: .completed,
            credentialOwnership: .userOwned,
            userOwnedCredentialsRequired: true,
            credentialRequirements: [
                ProviderCredentialRequirement(
                    fieldKey: "api_token",
                    label: "API token",
                    required: true,
                    userOwnedRequired: true,
                    secretReferenceId: "sec-provider-redacted",
                    status: .verified,
                    helpText: "Stored as a Keychain secret reference.",
                    redactionStatus: "secret-reference-only"
                )
            ],
            secretReferenceIds: ["sec-provider-redacted"],
            accountLabel: "Settings account",
            connectedHandle: "settings@example.test",
            callbackURL: "relay-console://oauth/settings/callback",
            requiredScopes: ["read"],
            grantedScopes: ["read"],
            selectedCapabilities: ["read_status"],
            health: ProviderConnectorHealth(
                state: .ready,
                message: "Ready",
                lastCheckedAt: timestamp,
                missingScopes: [],
                unavailableTools: [],
                diagnostics: [:],
                redactionStatus: "private-state-excluded"
            ),
            senderIdentities: [],
            installPolicy: "approval_required",
            lastCheckedAt: timestamp,
            lastError: nil,
            manualEvidenceNote: nil,
            reauthorizeRequired: false,
            disconnecting: false,
            betaBlocked: false,
            createdAt: timestamp,
            updatedAt: timestamp,
            redactionStatus: "private-state-excluded"
        )
        return ProviderConnectionSnapshot(
            workspaceId: workspaceId,
            appId: nil,
            appSlug: nil,
            state: .ready,
            refreshedAt: timestamp,
            connections: [connection],
            authorizationFlows: [],
            selectedConnection: nil,
            diagnostics: ProviderConnectionDiagnostics(
                connectorHealthSummary: "Ready",
                oauthStateSummary: "Completed",
                keychainReferenceSummary: "1 secret reference",
                senderIdentitySummary: "None",
                userOwnedCredentialSummary: "Required",
                manualEvidenceSummary: "None",
                message: "Ready"
            ),
            readOnly: false,
            redactionStatus: "private-state-excluded"
        )
    }

    private static func emptyMarketplaceSnapshot(workspaceId: RelayId) -> MarketplaceInstallSnapshot {
        MarketplaceInstallSnapshot(
            workspaceId: workspaceId,
            appId: nil,
            appSlug: nil,
            state: .empty,
            refreshedAt: "2026-01-01T00:00:00Z",
            installs: [],
            compatibleAgents: [],
            selectedInstall: nil,
            diagnostics: MarketplaceInstallDiagnostics(
                compatibleAgentSummary: "No compatible agents",
                installSummary: "No installs",
                driftSummary: "No drift",
                runtimeWriteSummary: "No runtime writes",
                removalSummary: "No removals",
                message: "Empty"
            ),
            readOnly: false,
            redactionStatus: "private-state-excluded"
        )
    }

    private static func neededToolsSnapshot(workspaceId: RelayId, openRequestCount: Int) -> NeededToolsSnapshot {
        let timestamp = "2026-01-01T00:00:00Z"
        let summary = NeededToolsSummary(
            workspaceId: workspaceId,
            appId: nil,
            appSlug: nil,
            queryStatus: "open",
            openRequestCount: openRequestCount,
            connectedCount: 0,
            grantedCount: 0,
            unavailableCount: 0,
            dismissedCount: 0,
            resolvedCount: 0,
            suggestedAppCount: 0,
            generatedAt: timestamp,
            redactionStatus: "private-state-excluded"
        )
        return NeededToolsSnapshot(
            workspaceId: workspaceId,
            appId: nil,
            appSlug: nil,
            state: .ready,
            refreshedAt: timestamp,
            queryStatus: "open",
            requests: [],
            selectedRequest: nil,
            summary: summary,
            diagnostics: NeededToolsDiagnostics(
                openSummary: "\(openRequestCount) open",
                connectionSummary: "0 connected",
                grantSummary: "0 granted",
                unavailableSummary: "0 unavailable",
                message: "Fixture summary"
            ),
            readOnly: false,
            redactionStatus: "private-state-excluded"
        )
    }

    private static func fixedDate(_ iso: String) -> Date {
        ISO8601DateFormatter.relayConsole.date(from: iso) ?? ISO8601DateFormatter().date(from: iso) ?? Date(timeIntervalSince1970: 0)
    }

    private static func expect(_ condition: @autoclosure () throws -> Bool, _ message: String) throws {
        guard try condition() else {
            throw ProfileSettingsTestFailure(message)
        }
    }

    private static func unwrap<T>(_ value: T?, _ message: String) throws -> T {
        guard let value else {
            throw ProfileSettingsTestFailure(message)
        }
        return value
    }
}

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

private final class EventCounter: @unchecked Sendable {
    private let lock = NSLock()
    private var count = 0

    var value: Int {
        lock.lock()
        defer { lock.unlock() }
        return count
    }

    func increment() {
        lock.lock()
        count += 1
        lock.unlock()
    }
}

private final class StubCommandRunner: CommandRunning {
    func run(_ command: String, _ args: [String], options: CommandOptions) async -> CommandResult {
        CommandResult(code: 127, stdout: "", stderr: "stubbed command runner: \(command)")
    }

    func spawn(_ command: String, _ args: [String], options: CommandOptions, stdin: String?) async throws -> (process: Process, result: Task<CommandResult, Never>) {
        throw RelayError(.unsupported, "spawn is not available in tests")
    }
}

private struct ProfileSettingsTestFailure: Error, CustomStringConvertible {
    var description: String
    init(_ description: String) {
        self.description = description
    }
}
