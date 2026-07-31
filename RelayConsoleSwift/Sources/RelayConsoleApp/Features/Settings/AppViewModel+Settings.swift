import AppKit
import CryptoKit
import Foundation
import RelayConsoleCore
import SwiftUI
import UniformTypeIdentifiers

extension AppViewModel {
  func scheduleAccountSettingsSave(immediately: Bool = false) {
    scheduledAccountSettingsSaveTask?.cancel()
    let snapshot = userProfile
    scheduledAccountSettingsSaveTask = Task { [weak self] in
      if !immediately {
        try? await Task.sleep(for: .milliseconds(500))
      }
      guard !Task.isCancelled, let self else { return }
      self.persistAccountSettings(snapshot)
    }
  }

  func setProductAnalyticsEnabled(_ enabled: Bool) {
    userProfile.telemetryEnabled = productAnalyticsAvailable && enabled
    scheduleAccountSettingsSave(immediately: true)
  }

  func setCrashReportingEnabled(_ enabled: Bool) {
    userProfile.crashReportingEnabled = crashReportingAvailable && enabled
    scheduleAccountSettingsSave(immediately: true)
  }

  func disableUnavailableTelemetryPreferences() {
    let normalizedAnalytics = productAnalyticsAvailable && userProfile.telemetryEnabled
    let normalizedCrashes = crashReportingAvailable && userProfile.crashReportingEnabled
    guard normalizedAnalytics != userProfile.telemetryEnabled
      || normalizedCrashes != userProfile.crashReportingEnabled
    else { return }
    userProfile.telemetryEnabled = normalizedAnalytics
    userProfile.crashReportingEnabled = normalizedCrashes
    scheduleAccountSettingsSave(immediately: true)
  }

  private func persistAccountSettings(_ snapshot: UserProfilePreference) {
    guard let services, let profile = appState?.activeProfile, let workspace else {
      error = "Local profile is unavailable."
      return
    }
    do {
      let saved = try services.settingsPreferences.saveAccount(
        context: chatContext(workspaceId: workspace.id, profileId: profile.id),
        profileId: profile.id,
        input: AccountSettingsInput(
          displayName: snapshot.displayName,
          email: profile.email ?? "",
          avatarUrl: snapshot.avatarUrl,
          telemetryEnabled: snapshot.telemetryEnabled,
          crashReportingEnabled: snapshot.crashReportingEnabled
        )
      )
      if userProfile == snapshot {
        userProfile = UserProfilePreference(profile: saved)
      }
      telemetry.applyConsent(
        .init(
          productAnalytics: saved.telemetryEnabled,
          crashReporting: saved.crashReportingEnabled
        ),
        profileId: saved.id
      )
      settingsStatus = "Profile updated"
      error = nil
    } catch {
      self.error = error.localizedDescription
    }
  }

  func completeTelemetryChoice(
    productAnalytics: Bool,
    crashReporting: Bool
  ) {
    guard !telemetryChoiceSaving else { return }
    guard let services, let profile = appState?.activeProfile, let workspace else {
      telemetryChoiceError =
        "Relay could not save these choices yet. Finish loading, then try again."
      return
    }

    telemetryChoiceSaving = true
    telemetryChoiceError = nil
    let availableProductAnalytics = productAnalyticsAvailable && productAnalytics
    let availableCrashReporting = crashReportingAvailable && crashReporting
    Task {
      defer { telemetryChoiceSaving = false }
      do {
        let saved = try services.settingsPreferences.saveAccount(
          context: chatContext(workspaceId: workspace.id, profileId: profile.id),
          profileId: profile.id,
          input: AccountSettingsInput(
            displayName: profile.displayName,
            email: profile.email ?? "",
            avatarUrl: profile.avatarUrl,
            telemetryEnabled: availableProductAnalytics,
            crashReportingEnabled: availableCrashReporting
          )
        )
        try services.data.setAppSetting(
          Self.telemetryChoiceCompletedSettingKey,
          value: true
        )
        userProfile = UserProfilePreference(profile: saved)
        telemetry.applyConsent(
          .init(
            productAnalytics: saved.telemetryEnabled,
            crashReporting: saved.crashReportingEnabled
          ),
          profileId: saved.id
        )
        telemetryChoiceRequired = false
      } catch {
        telemetryChoiceError =
          "Relay could not finish saving these choices. Review them and try again."
      }
    }
  }

  func saveAppearanceSettings() {
    runAction("save-appearance-settings", refresh: .settings) {
      guard let services = self.services, let profile = self.appState?.activeProfile,
        let workspace = self.workspace
      else {
        throw RelayError(.profileMissing, "Local profile is unavailable.")
      }
      let saved = try services.settingsPreferences.saveAppearance(
        context: self.chatContext(workspaceId: workspace.id, profileId: profile.id),
        profileId: profile.id,
        input: AppearanceSettingsInput(theme: self.userProfile.theme)
      )
      self.userProfile = UserProfilePreference(profile: saved)
      self.settingsStatus = "Profile updated"
      return self.selectedThreadId
    }
  }

  func saveWorkspaceSettings() {
    runAction("save-workspace-settings", refresh: .settings) {
      guard let services = self.services, let workspace = self.workspace else {
        throw RelayError(.workspaceMissing, "Workspace unavailable.")
      }
      let saved = try services.settingsPreferences.saveWorkspace(
        context: self.chatContext(workspaceId: workspace.id),
        workspaceId: workspace.id,
        input: WorkspaceSettingsInput(
          name: self.workspaceSettingsDraft.name,
          workspaceType: self.workspaceSettingsDraft.workspaceType
        )
      )
      self.workspaceSettingsDraft = WorkspaceSettingsDraft(workspace: saved)
      self.settingsStatus = "Workspace updated"
      return self.selectedThreadId
    }
  }

  func retrySettingsIntegrationSummary() {
    runAction("settings-integration-retry", refresh: .settings) {
      guard let services = self.services, let workspace = self.workspace else {
        throw RelayError(.workspaceMissing, "Workspace unavailable.")
      }
      self.settingsIntegrationSummary = try services.settingsStatus.refreshIntegrationSummary(
        context: self.chatContext(workspaceId: workspace.id)
      )
      return self.selectedThreadId
    }
  }

  func setSettingsAlertsUnreadOnly(_ unreadOnly: Bool) {
    settingsAlertsUnreadOnly = unreadOnly
    Task { await refreshSettingsState() }
  }

  func markSettingsAlertRead(_ alert: SettingsAlertRecord) {
    runAction("settings-alert-read", refresh: .settings) {
      guard let services = self.services, let workspace = self.workspace else {
        throw RelayError(.workspaceMissing, "Workspace unavailable.")
      }
      _ = try services.settingsStatus.markAlertRead(
        context: self.chatContext(workspaceId: workspace.id),
        alertId: alert.id
      )
      return self.selectedThreadId
    }
  }

  func markAllSettingsAlertsRead() {
    runAction("settings-alert-read-all", refresh: .settings) {
      guard let services = self.services, let workspace = self.workspace else {
        throw RelayError(.workspaceMissing, "Workspace unavailable.")
      }
      _ = try services.settingsStatus.markAllAlertsRead(
        context: self.chatContext(workspaceId: workspace.id)
      )
      return self.selectedThreadId
    }
  }

  func saveNotificationPreferences(inAppAlertsEnabled: Bool? = nil, unreadBadgeEnabled: Bool? = nil)
  {
    runAction("save-notification-preferences", refresh: .settings) {
      guard let services = self.services,
        let workspace = self.workspace,
        let profile = self.appState?.activeProfile
      else {
        throw RelayError(.profileMissing, "Local profile is unavailable.")
      }
      let current: SettingsNotificationPreferences
      if let existing = self.settingsNotificationPreferences {
        current = existing
      } else {
        current = try services.settingsStatus.notificationPreferences(
          context: self.chatContext(workspaceId: workspace.id, profileId: profile.id),
          profileId: profile.id
        )
      }
      self.settingsNotificationPreferences = try services.settingsStatus
        .saveNotificationPreferences(
          context: self.chatContext(workspaceId: workspace.id, profileId: profile.id),
          profileId: profile.id,
          input: NotificationPreferenceInput(
            inAppAlertsEnabled: inAppAlertsEnabled ?? current.inAppAlertsEnabled,
            unreadBadgeEnabled: unreadBadgeEnabled ?? current.unreadBadgeEnabled
          )
        )
      self.settingsStatus = "Notification preferences updated"
      return self.selectedThreadId
    }
  }

  func prepareLocalAccountExport() {
    let panel = NSSavePanel()
    panel.allowedContentTypes = [.json]
    panel.canCreateDirectories = true
    panel.nameFieldStringValue = "relay-console-local-data-export.json"
    panel.title = "Export Relay Console Data"
    panel.message =
      "Exports local profiles, workspace data, agents, chats, and runtime metadata. Keychain values are excluded."
    guard panel.runModal() == .OK, let destination = panel.url else { return }
    runAction("write-local-account-export", refresh: .none) {
      guard let services = self.services,
        let workspace = self.workspace,
        let profile = self.appState?.activeProfile
      else {
        throw RelayError(.profileMissing, "Local profile is unavailable.")
      }
      let export = try services.dataLifecycle.writeRedactedExport(
        context: self.chatContext(workspaceId: workspace.id, profileId: profile.id),
        profileId: profile.id,
        destination: destination
      )
      _ = try services.data.saveSettingsLocalAccountExport(export)
      self.settingsSecuritySummary = try services.settingsSecurity.securitySummary(
        context: self.chatContext(workspaceId: workspace.id, profileId: profile.id),
        profileId: profile.id
      )
      self.settingsStatus = "Local export saved"
      return self.selectedThreadId
    }
  }

  func executeLocalDataCleanup(_ kind: LocalDataCleanupKind, confirmation: String) {
    busy = "local-data-cleanup"
    error = nil
    Task {
      do {
        guard let services else {
          throw RelayError(.databaseUnavailable, "Local services are unavailable.")
        }
        _ = try await services.dataLifecycle.executeCleanup(kind: kind, confirmation: confirmation)
        busy = nil
        NSApplication.shared.terminate(nil)
      } catch {
        busy = nil
        self.error = error.localizedDescription
      }
    }
  }

  func triggerDecisionGatedSecurityAction(_ action: SettingsSecurityBlockedAction) {
    runAction("settings-security-\(action.rawValue)", refresh: .settings) {
      guard let services = self.services, let workspace = self.workspace else {
        throw RelayError(.workspaceMissing, "Workspace unavailable.")
      }
      try services.settingsSecurity.blockDecisionGatedAction(
        context: self.chatContext(workspaceId: workspace.id),
        action: action
      )
      return self.selectedThreadId
    }
  }

  func selectSettingsPanel(_ panel: SettingsPanelKey) {
    let resolvedPanel: SettingsPanelKey = panel.isVisibleInFirstLaunch ? panel : .account
    settingsPanel = resolvedPanel
    if resolvedPanel == .security,
      let services,
      let workspace,
      let profile = appState?.activeProfile
    {
      settingsSecuritySummary = try? services.settingsSecurity.securitySummary(
        context: chatContext(workspaceId: workspace.id, profileId: profile.id),
        profileId: profile.id
      )
    }
    runAction("select-settings-panel", refresh: .settings) {
      guard let services = self.services else { return self.selectedThreadId }
      try services.data.setSelectedSettingsPanel(resolvedPanel.rawValue)
      return self.selectedThreadId
    }
  }

  func setShowRelayCloudAgents(_ show: Bool) {
    guard showRelayCloudAgents != show else { return }
    showRelayCloudAgents = show

    if !show {
      let hiddenAgentIds = Set(agents.filter(isRelayCloudAgent).map(\.id))
      newChatTeamAgentIds.subtract(hiddenAgentIds)
      if hiddenAgentIds.contains(newChatSelectedAgentId) {
        newChatSelectedAgentId = visibleAgents.first?.id ?? ""
      }
      if hiddenAgentIds.contains(selectedAgentId) {
        selectedAgentId = visibleAgents.first?.id ?? ""
      }

      if let selectedThreadId,
        !filteredThreads.contains(where: { $0.id == selectedThreadId })
      {
        if let replacement = filteredThreads.first {
          selectThread(replacement.id)
        } else {
          self.selectedThreadId = nil
          selectedThreadDetail = nil
          messages = []
          resetMessageWindowSelection()
        }
      }
    }

    runAction("save-relay-cloud-agent-visibility", refresh: .settings) {
      guard let services = self.services else {
        throw RelayError(.databaseUnavailable, "Settings storage is unavailable.")
      }
      try services.data.setAppSetting(Self.showRelayCloudAgentsSettingKey, value: show)
      self.settingsStatus = show ? "Remotely synced agents shown" : "Remotely synced agents hidden"
      self.scheduleRefresh(.agents)
      return self.selectedThreadId
    }
  }

  func linkAgentToRelayConnect(_ agentId: RelayId) async throws {
    guard let services, let workspace else {
      throw RelayError(.databaseUnavailable, "Relay is unavailable.")
    }
    try await services.cloudSync.linkConnectAgent(
      localWorkspaceId: workspace.id,
      localAgentId: agentId
    )
    await refreshAgentsState()
  }

  func unlinkAgentFromRelayConnect(_ agentId: RelayId) async throws {
    guard let services, let workspace else {
      throw RelayError(.databaseUnavailable, "Relay is unavailable.")
    }
    try await services.cloudSync.unlinkConnectAgent(
      localWorkspaceId: workspace.id,
      localAgentId: agentId
    )
    await refreshAgentsState()
  }

  func setRuntimeActivityDetailEnabled(_ enabled: Bool) {
    runtimeActivityDetailEnabled = enabled
    saveRuntimeExperienceSetting(
      RuntimeExperienceSettings.detailedActivityEnabledKey, value: enabled)
  }

  func setRuntimeApprovalMode(_ mode: RuntimeApprovalMode) {
    runtimeApprovalMode = mode
    runtimeRunConfirmationEnabled = mode.requiresRunConfirmation
    runAction("save-runtime-approval-mode", refresh: .settings) {
      guard let services = self.services else {
        throw RelayError(.databaseUnavailable, "Settings storage is unavailable.")
      }
      try services.data.setAppSetting(RuntimeExperienceSettings.approvalModeKey, value: mode)
      try services.data.setAppSetting(
        RuntimeExperienceSettings.runConfirmationEnabledKey, value: mode.requiresRunConfirmation)
      self.settingsStatus = "Runtime preferences updated"
      return self.selectedThreadId
    }
  }

  func setRuntimeRunConfirmationEnabled(_ enabled: Bool) {
    setRuntimeApprovalMode(RuntimeApprovalMode.fromLegacyRunConfirmation(enabled))
  }

  func saveRuntimeExperienceSetting(_ key: String, value: Bool) {
    runAction("save-runtime-experience-settings", refresh: .settings) {
      guard let services = self.services else {
        throw RelayError(.databaseUnavailable, "Settings storage is unavailable.")
      }
      try services.data.setAppSetting(key, value: value)
      self.settingsStatus = "Runtime preferences updated"
      return self.selectedThreadId
    }
  }
}
