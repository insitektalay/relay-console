import AppKit
import RelayConsoleCore
import SwiftUI
import UniformTypeIdentifiers

struct SettingsScreen: View {
  @EnvironmentObject var model: AppViewModel

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      ScrollView {
        switch model.settingsPanel {
        case .account:
          AccountSettingsPanel()
        case .setupConnections:
          SetupConnectionsSettingsPanel()
        case .updates:
          UpdatesSettingsPanel()
        case .cloud:
          CloudRelaySettingsPanel()
        case .importAgents:
          CloudRelaySettingsPanel(presentation: .importAgents)
        case .relayDiagnostics:
          CloudRelaySettingsPanel(presentation: .advancedDiagnostics)
        case .appearance:
          AppearanceSettingsPanel()
        case .workspace:
          WorkspaceSettingsPanel()
        case .team:
          TeamMembersSettingsPanel()
        case .integrations:
          IntegrationsSettingsPanel()
        case .notifications:
          NotificationsSettingsPanel()
        case .security:
          CloudRelaySettingsPanel(presentation: .accountSecurity)
        case .dataPrivacy:
          DataPrivacySettingsPanel()
        case .harnesses:
          HarnessesPanel()
        case .runtime:
          RuntimeExperienceSettingsPanel()
        }
      }
      .frame(maxWidth: 760, alignment: .leading)
      .padding(24)
    }
  }
}

struct UpdatesSettingsPanel: View {
  @EnvironmentObject var updateController: RelayConsoleUpdateController
  @State private var railwayProjectToken = ""

  private static let lastCheckFormatter: DateFormatter = {
    let formatter = DateFormatter()
    formatter.dateStyle = .medium
    formatter.timeStyle = .short
    return formatter
  }()

  var body: some View {
    VStack(alignment: .leading, spacing: 14) {
      NativeGroupedSection(
        title: "Updates",
        subtitle: "Relay Console updates your Railway backend first, verifies compatibility, then offers the signed macOS update."
      ) {
        NativeSettingsRow(title: "Installed version", value: updateController.installedVersionAndBuild)
        NativeDivider()
        NativeSettingsRow(title: "Update channel", value: updateController.snapshot.channel)
        NativeDivider()
        NativeSettingsRow(
          title: "Last successful check",
          value: updateController.snapshot.lastSuccessfulCheck.map(Self.lastCheckFormatter.string(from:)) ?? "Not yet"
        )
        if let version = updateController.snapshot.availableVersion {
          NativeDivider()
          NativeSettingsRow(title: "Available version", value: version)
        }
        NativeDivider()
        NativeSettingsRow(
          title: "Automatically check for updates",
          subtitle: "Checks the signed Relay Console appcast about once every 24 hours.",
          value: updateController.automaticallyChecksForUpdates ? "On" : "Off"
        ) {
          Toggle(
            "Automatically check for updates",
            isOn: Binding(
              get: { updateController.automaticallyChecksForUpdates },
              set: { updateController.setAutomaticallyChecksForUpdates($0) }
            )
          )
          .labelsHidden()
          .toggleStyle(.switch)
          .disabled(updateController.snapshot.state == .unavailableConfiguration
            || updateController.snapshot.state == .unavailableOutsideInstalledBundle)
        }

        NativeDivider()
        VStack(alignment: .leading, spacing: 8) {
          Text("Railway project token")
            .font(.system(size: 13, weight: .medium))
          Text("Create a project token for the Railway environment that hosts this backend. Relay stores it only in macOS Keychain and uses it only to deploy a signed Relay release commit.")
            .font(.caption)
            .foregroundStyle(RCTheme.muted)
          SecureField(
            updateController.railwayProjectTokenConfigured ? "Saved in Keychain" : "Paste Railway project token",
            text: $railwayProjectToken
          )
          .textFieldStyle(.roundedBorder)
          HStack(spacing: 8) {
            Button(updateController.railwayProjectTokenConfigured ? "Replace Token" : "Save Token") {
              updateController.saveRailwayProjectToken(railwayProjectToken)
              if updateController.railwayProjectTokenConfigured {
                railwayProjectToken = ""
              }
            }
            .disabled(railwayProjectToken.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            if updateController.railwayProjectTokenConfigured {
              Button("Remove Token") {
                updateController.removeRailwayProjectToken()
                railwayProjectToken = ""
              }
            }
          }
          if let message = updateController.railwayCredentialMessage {
            Text(message)
              .font(.caption)
              .foregroundStyle(RCTheme.muted)
          }
        }

        if let failure = updateController.snapshot.failureMessage {
          Text(failure)
            .font(.caption)
            .foregroundStyle(RCTheme.muted)
            .accessibilityLabel("Update check failed. \(failure)")
        } else if updateController.snapshot.state == .developmentBuildNewer {
          Text("This development build is newer than the public update feed.")
            .font(.caption)
            .foregroundStyle(RCTheme.muted)
        } else if updateController.snapshot.state == .unavailableOutsideInstalledBundle {
          Text("Updates are available after Relay Console is installed in an Applications folder.")
            .font(.caption)
            .foregroundStyle(RCTheme.muted)
        } else if updateController.snapshot.state == .unavailableConfiguration {
          Text("Secure updates are unavailable because this build has no approved feed or public signing key.")
            .font(.caption)
            .foregroundStyle(RCTheme.muted)
        } else if let progress = updateController.snapshot.progressMessage {
          HStack(spacing: 8) {
            ProgressView()
              .controlSize(.small)
            Text(progress)
              .font(.caption)
              .foregroundStyle(RCTheme.muted)
          }
        }

        Button(updateController.snapshot.failureMessage == nil ? "Check for Updates" : "Try Again") {
          updateController.checkForUpdates()
        }
        .buttonStyle(PrimaryLightButtonStyle())
        .disabled(!updateController.canCheckForUpdates
          || updateController.snapshot.state == .checking
          || updateController.snapshot.state == .updatingBackend)
        .accessibilityHint("Checks the signed Relay Console update feed")
      }
    }
  }
}

struct AccountSettingsPanel: View {
  @EnvironmentObject var model: AppViewModel
  @State private var avatarCropSource: AvatarCropSource?

  var body: some View {
    VStack(alignment: .leading, spacing: 14) {
      NativeGroupedSection(
        title: "Profile", subtitle: "Shown in chats and reports.",
        showsDivider: false
      ) {
        VStack(spacing: 20) {
          ProfileOrbitView(
            name: model.profileName,
            avatarURL: model.userProfile.avatarUrl,
            onUpload: {
              model.uploadAvatar { avatarCropSource = AvatarCropSource(dataURL: $0) }
            },
            onRemove: {
              model.userProfile.avatarUrl = nil
              model.scheduleAccountSettingsSave(immediately: true)
            }
          )

          TextField("Display name", text: $model.userProfile.displayName)
            .textFieldStyle(.plain)
            .font(.system(size: 13, weight: .semibold))
            .padding(.horizontal, 16)
            .frame(maxWidth: 640)
            .frame(height: 48)
            .background(RCTheme.fieldBackground)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .overlay {
              RoundedRectangle(cornerRadius: 8)
                .stroke(
                  LinearGradient(
                    colors: [RCTheme.relayPurple, RCTheme.relayBlue, RCTheme.relayCyan],
                    startPoint: .leading,
                    endPoint: .trailing
                  ),
                  lineWidth: 1.25
                )
            }
            .onChange(of: model.userProfile.displayName) { _, _ in
              model.scheduleAccountSettingsSave()
            }

          if model.settingsStatus == "Profile updated" {
            Text("Profile updated")
              .font(.caption)
              .foregroundStyle(RCTheme.accentGreen)
          }
        }
        .frame(maxWidth: .infinity)
      }
    }
    .onAppear {
      model.disableUnavailableTelemetryPreferences()
    }
    .sheet(item: $avatarCropSource) { source in
      AvatarCropEditor(source: source) {
        avatarCropSource = nil
      } onApply: { dataURL in
        model.userProfile.avatarUrl = dataURL
        model.scheduleAccountSettingsSave(immediately: true)
        avatarCropSource = nil
      }
    }
  }
}

private struct ProfileOrbitView: View {
  let name: String
  let avatarURL: String?
  let onUpload: () -> Void
  let onRemove: () -> Void

  var body: some View {
    ZStack {
      Circle()
        .stroke(Color.white.opacity(0.025), lineWidth: 1)
        .frame(width: 320, height: 320)
      Circle()
        .stroke(Color.white.opacity(0.055), lineWidth: 1)
        .frame(width: 280, height: 280)
      Circle()
        .stroke(Color.white.opacity(0.04), lineWidth: 1)
        .frame(width: 232, height: 232)

      Circle()
        .trim(from: 0.57, to: 0.98)
        .stroke(
          LinearGradient(
            colors: [RCTheme.relayPurple, RCTheme.relayBlue],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
          ),
          style: StrokeStyle(lineWidth: 1.6, lineCap: .round)
        )
        .frame(width: 280, height: 280)
        .rotationEffect(.degrees(18))

      Circle()
        .trim(from: 0.02, to: 0.30)
        .stroke(
          LinearGradient(
            colors: [RCTheme.relayBlue, RCTheme.relayCyan],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
          ),
          style: StrokeStyle(lineWidth: 1.6, lineCap: .round)
        )
        .frame(width: 280, height: 280)
        .rotationEffect(.degrees(18))

      orbitDot(color: RCTheme.relayIndigo, size: 14, x: -134, y: -28)
      orbitDot(color: RCTheme.relayBlue, size: 10, x: 96, y: -104)
      orbitDot(color: RCTheme.relayPurple, size: 16, x: 138, y: 18)
      orbitDot(color: RCTheme.accentGreen, size: 12, x: 100, y: 118)
      RoundedRectangle(cornerRadius: 2)
        .fill(RCTheme.relayIndigo)
        .frame(width: 8, height: 8)
        .rotationEffect(.degrees(18))
        .offset(x: -94, y: 112)

      AgentAvatarView(name: name, avatarURL: avatarURL, size: 126)
        .offset(y: -10)

      HStack(spacing: 16) {
        ProfileOrbitActionButton(
          accessibilityLabel: "Upload avatar",
          borderColor: RCTheme.relayPurple,
          icon: "pencil",
          action: onUpload
        )
        ProfileOrbitActionButton(
          accessibilityLabel: "Remove avatar",
          borderColor: RCTheme.relayCyan,
          icon: "trash",
          isDisabled: avatarURL == nil,
          action: onRemove
        )
      }
      .offset(y: 130)
    }
    .frame(width: 340, height: 340)
    .accessibilityElement(children: .contain)
  }

  private func orbitDot(color: Color, size: CGFloat, x: CGFloat, y: CGFloat) -> some View {
    Circle()
      .fill(color)
      .frame(width: size, height: size)
      .shadow(color: color.opacity(0.35), radius: 5)
      .offset(x: x, y: y)
  }
}

private struct ProfileOrbitActionButton: View {
  let accessibilityLabel: String
  let borderColor: Color
  let icon: String
  var isDisabled = false
  let action: () -> Void

  var body: some View {
    Button(action: action) {
      Image(systemName: icon)
        .font(.system(size: 14, weight: .semibold))
        .frame(width: 42, height: 42)
        .contentShape(Circle())
    }
    .buttonStyle(.plain)
    .foregroundStyle(isDisabled ? RCTheme.muted.opacity(0.55) : RCTheme.text)
    .background(RCTheme.surfaceInset)
    .clipShape(Circle())
    .overlay(Circle().stroke(borderColor.opacity(isDisabled ? 0.24 : 0.58), lineWidth: 1.25))
    .shadow(color: Color.black.opacity(0.34), radius: 12, y: 6)
    .disabled(isDisabled)
    .help(accessibilityLabel)
    .accessibilityLabel(accessibilityLabel)
  }
}

struct AppearanceSettingsPanel: View {
  @EnvironmentObject var model: AppViewModel

  var body: some View {
    VStack(alignment: .leading, spacing: 14) {
      NativeGroupedSection(title: "Appearance") {
        Picker("Theme", selection: $model.userProfile.theme) {
          Text("Classic").tag("classic")
        }
        .pickerStyle(.segmented)
        .frame(maxWidth: 320)
        NativeDivider()
        NativeSettingsRow(title: "Current theme", value: model.userProfile.theme.capitalized)
        NativeDivider()
        NativeSettingsRow(title: "Theme storage", value: "Durable local profile")
        Button(model.busy == "save-appearance-settings" ? "Saving..." : "Save appearance") {
          model.saveAppearanceSettings()
        }
        .buttonStyle(PrimaryLightButtonStyle())
        .disabled(!model.appearanceSettingsCanSave)
        .help(model.appearanceSettingsCanSave ? "Save appearance" : "Save appearance unavailable")
        .accessibilityLabel("Save appearance")
      }
    }
  }
}

struct WorkspaceSettingsPanel: View {
  @EnvironmentObject var model: AppViewModel

  var body: some View {
    VStack(alignment: .leading, spacing: 14) {
      NativeGroupedSection(title: "Workspace profile") {
        TextField("Workspace name", text: $model.workspaceSettingsDraft.name)
          .textFieldStyle(.plain)
          .rcTextFieldChrome(height: 38)
        Picker("Workspace type", selection: $model.workspaceSettingsDraft.workspaceType) {
          Text("Personal").tag("personal")
          Text("Business").tag("business")
        }
        .pickerStyle(.segmented)
        .frame(maxWidth: 320)
        Text("Update the name your team sees across chats, reports, and shared workspace views.")
          .font(.caption)
          .foregroundStyle(RCTheme.muted)
        Button(model.busy == "save-workspace-settings" ? "Saving..." : "Save workspace") {
          model.saveWorkspaceSettings()
        }
        .buttonStyle(PrimaryLightButtonStyle())
        .disabled(!model.workspaceSettingsCanSave)
        .help(model.workspaceSettingsCanSave ? "Save workspace" : "Save workspace unavailable")
        .accessibilityLabel("Save workspace")
        if model.settingsStatus == "Workspace updated" {
          Text("Workspace updated")
            .font(.caption)
            .foregroundStyle(RCTheme.accentGreen)
        }
        NativeDivider()
        NativeSettingsRow(title: "Organizations", value: "\(model.orgCompanies.count)")
        NativeDivider()
        NativeSettingsRow(title: "Departments", value: "\(model.orgDepartments.count)")
        NativeDivider()
        NativeSettingsRow(title: "Teams", value: "\(model.orgTeams.count)")
        NativeDivider()
        NativeSettingsRow(title: "Agents", value: "\(model.agents.count)")
        NativeDivider()
        NativeSettingsRow(
          title: "Workspace type", value: model.workspace?.workspaceType ?? "personal")
        NativeDivider()
        NativeSettingsRow(
          title: "Current name", value: model.workspace?.name ?? "Choose a workspace")
        StatusBadge(
          title: "Read-only", tone: .amber, accessibilityLabelText: "Workspace settings read-only")
      }
    }
  }
}

struct TeamMembersSettingsPanel: View {
  @EnvironmentObject var model: AppViewModel

  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      FormCard {
        Text("Structure")
          .font(.headline)
        Text("Manage organizations, departments, teams, and agent assignments in Agents.")
          .font(.callout)
          .foregroundStyle(RCTheme.muted)
        Button("Open structure") {
          model.selectNav(.agents)
          model.selectAgentSubview(.structure)
        }
        .buttonStyle(SecondaryLightButtonStyle())
        .help("Open structure")
        .accessibilityLabel("Open structure")
      }
      FormCard {
        Text("People")
          .font(.headline)
        Text("Review the agents and members available to this workspace.")
          .font(.callout)
          .foregroundStyle(RCTheme.muted)
        Button("Open agents") {
          model.selectNav(.agents)
          model.selectAgentSubview(.instructions)
        }
        .buttonStyle(SecondaryLightButtonStyle())
        .help("Open agents")
        .accessibilityLabel("Open agents")
        Text(
          "Team and member changes now live in Agents so settings stays focused on account and workspace preferences."
        )
        .font(.caption)
        .foregroundStyle(RCTheme.muted)
      }
    }
    .padding(24)
  }
}

struct IntegrationsSettingsPanel: View {
  @EnvironmentObject var model: AppViewModel

  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      FormCard {
        HStack(alignment: .top, spacing: 12) {
          Image(systemName: "point.3.connected.trianglepath.dotted")
            .frame(width: 34, height: 34)
            .foregroundStyle(RCTheme.accentBlue)
            .background(RCTheme.accentBlue.opacity(0.12))
            .clipShape(RoundedRectangle(cornerRadius: 4))
          VStack(alignment: .leading, spacing: 10) {
            HStack {
              Text("Workspace integrations")
                .font(.headline)
              Spacer()
              StatusBadge(
                title: model.settingsIntegrationSummary?.readOnly == true
                  ? "Read-only" : "Admin setup",
                tone: model.settingsIntegrationSummary?.readOnly == true ? .amber : .green,
                accessibilityLabelText: "Integration setup state"
              )
            }
            IntegrationSummaryGrid(summary: model.settingsIntegrationSummary)
            HStack {
              Button(model.busy == "settings-integration-retry" ? "Checking..." : "Try again") {
                model.retrySettingsIntegrationSummary()
              }
              .buttonStyle(SecondaryLightButtonStyle())
              .disabled(model.busy == "settings-integration-retry")
              .help("Try again")
              .accessibilityLabel("Try again")
              StatusBadge(
                title: "Paperclip excluded", tone: .neutral,
                accessibilityLabelText: "Paperclip excluded")
            }
          }
        }
      }
      FormCard {
        Text("Native harnesses")
          .font(.headline)
        if let summary = model.settingsIntegrationSummary {
          ForEach(summary.harnesses, id: \.harnessKey) { harness in
            SettingsHarnessSummaryRow(harness: harness)
          }
        } else {
          Text("Harness state has not loaded yet.")
            .font(.callout)
            .foregroundStyle(RCTheme.muted)
        }
      }
    }
    .padding(24)
  }
}

struct IntegrationSummaryGrid: View {
  var summary: SettingsIntegrationSummary?

  var body: some View {
    LazyVGrid(columns: [GridItem(.adaptive(minimum: 132), spacing: 10)], spacing: 10) {
      SettingsStatTile(
        title: "Providers",
        value: "\(summary?.providerConnectionCount ?? 0)"
      )
      SettingsStatTile(
        title: "Keychain refs",
        value: "\(summary?.providerSecretReferenceCount ?? 0)"
      )
      SettingsStatTile(
        title: "Installs",
        value: "\(summary?.marketplaceInstallCount ?? 0)"
      )
      SettingsStatTile(
        title: "Needed tools",
        value: "\(summary?.neededToolsOpenCount ?? 0)"
      )
    }
    SettingsInfoRow(
      label: "Provider state", value: summary?.providerState.map(snapshotLabel) ?? "Not loaded")
    SettingsInfoRow(
      label: "Marketplace state",
      value: summary?.marketplaceState.map(snapshotLabel) ?? "Not loaded")
    SettingsInfoRow(label: "Secrets policy", value: "Secret references only")
  }

  private func snapshotLabel<T: RawRepresentable>(_ value: T) -> String where T.RawValue == String {
    value.rawValue
      .replacingOccurrences(of: "_", with: " ")
      .capitalized
  }
}

struct SettingsHarnessSummaryRow: View {
  var harness: SettingsHarnessSummary

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      HStack(alignment: .top, spacing: 10) {
        Image(systemName: harness.harnessKey == .openclaw ? "bolt.horizontal.circle" : "terminal")
          .frame(width: 28, height: 28)
          .foregroundStyle(RCTheme.accentBlue)
          .background(RCTheme.accentBlue.opacity(0.10))
          .clipShape(RoundedRectangle(cornerRadius: 4))
        VStack(alignment: .leading, spacing: 4) {
          Text(harness.displayName)
            .font(.callout.weight(.semibold))
          Text(harness.lastError ?? "No current error")
            .font(.caption)
            .foregroundStyle(RCTheme.muted)
            .lineLimit(2)
        }
        Spacer()
        StatusBadge(
          title: harness.lifecycleState.rawValue.replacingOccurrences(of: "_", with: " "),
          tone: harness.lifecycleState == .connected ? .green : .amber,
          accessibilityLabelText: "\(harness.displayName) lifecycle"
        )
      }
      HStack(spacing: 8) {
        StatusBadge(
          title: harness.modelAuthStatus.rawValue.replacingOccurrences(of: "_", with: " "),
          tone: harness.modelAuthStatus == .connected ? .green : .amber,
          accessibilityLabelText: "\(harness.displayName) auth"
        )
        StatusBadge(
          title: harness.source.rawValue,
          tone: harness.source == .missing ? .amber : .blue,
          accessibilityLabelText: "\(harness.displayName) source"
        )
        if harness.secretReferencePresent {
          StatusBadge(
            title: "Secret ref", tone: .neutral,
            accessibilityLabelText: "\(harness.displayName) secret reference")
        }
      }
    }
    .padding(.vertical, 8)
    Divider()
  }
}

struct NotificationsSettingsPanel: View {
  @EnvironmentObject var model: AppViewModel

  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      FormCard {
        HStack {
          Text("In-app alerts")
            .font(.headline)
          Spacer()
          StatusBadge(
            title: "\(model.settingsUnreadAlertCount) unread",
            tone: model.settingsUnreadAlertCount > 0 ? .amber : .green,
            accessibilityLabelText: "Unread alerts")
        }
        Toggle(
          "Show in-app alerts",
          isOn: Binding(
            get: { model.settingsNotificationPreferences?.inAppAlertsEnabled ?? true },
            set: { model.saveNotificationPreferences(inAppAlertsEnabled: $0) }
          )
        )
        .toggleStyle(.checkbox)
        Toggle(
          "Unread badge",
          isOn: Binding(
            get: { model.settingsNotificationPreferences?.unreadBadgeEnabled ?? true },
            set: { model.saveNotificationPreferences(unreadBadgeEnabled: $0) }
          )
        )
        .toggleStyle(.checkbox)
        SettingsInfoRow(label: "Email delivery", value: "Unavailable")
        SettingsInfoRow(label: "Mobile delivery", value: "Unavailable")
        if model.settingsStatus == "Notification preferences updated" {
          Text("Notification preferences updated")
            .font(.caption)
            .foregroundStyle(RCTheme.accentGreen)
        }
      }
      FormCard {
        HStack {
          Text("Alerts")
            .font(.headline)
          Spacer()
          Toggle(
            "Unread only",
            isOn: Binding(
              get: { model.settingsAlertsUnreadOnly },
              set: { model.setSettingsAlertsUnreadOnly($0) }
            )
          )
          .toggleStyle(.checkbox)
          Button {
            model.markAllSettingsAlertsRead()
          } label: {
            Image(systemName: "checkmark.circle")
          }
          .buttonStyle(IconLightButtonStyle())
          .disabled(model.settingsUnreadAlertCount == 0 || model.busy == "settings-alert-read-all")
          .help("Mark all read")
          .accessibilityLabel("Mark all read")
        }
        if model.settingsAlerts.isEmpty {
          Text(model.settingsAlertsUnreadOnly ? "No unread alerts." : "No active alerts.")
            .font(.callout)
            .foregroundStyle(RCTheme.muted)
        } else {
          ForEach(model.settingsAlerts) { alert in
            SettingsAlertRow(alert: alert)
          }
        }
      }
    }
    .padding(24)
  }
}

struct SettingsAlertRow: View {
  @EnvironmentObject var model: AppViewModel
  var alert: SettingsAlertRecord

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      HStack(alignment: .top, spacing: 10) {
        Image(systemName: iconName)
          .frame(width: 28, height: 28)
          .foregroundStyle(tone.color)
          .background(tone.background)
          .clipShape(RoundedRectangle(cornerRadius: 4))
        VStack(alignment: .leading, spacing: 4) {
          Text(alert.title)
            .font(.callout.weight(.semibold))
          Text(alert.message)
            .font(.caption)
            .foregroundStyle(RCTheme.muted)
            .fixedSize(horizontal: false, vertical: true)
          HStack(spacing: 8) {
            StatusBadge(
              title: alert.severity.rawValue, tone: tone,
              accessibilityLabelText: alert.severity.rawValue)
            StatusBadge(
              title: alert.category, tone: .neutral, accessibilityLabelText: alert.category)
            if alert.readAt != nil {
              StatusBadge(title: "Read", tone: .green, accessibilityLabelText: "Alert read")
            }
          }
        }
        Spacer()
        if alert.readAt == nil {
          Button {
            model.markSettingsAlertRead(alert)
          } label: {
            Image(systemName: "checkmark")
          }
          .buttonStyle(IconLightButtonStyle())
          .disabled(model.busy == "settings-alert-read")
          .help("Mark read")
          .accessibilityLabel("Mark read")
        }
      }
      Divider()
    }
    .padding(.vertical, 8)
  }

  private var tone: ComponentTone {
    switch alert.severity {
    case .info:
      return .blue
    case .success:
      return .green
    case .warning:
      return .amber
    case .critical:
      return .red
    }
  }

  private var iconName: String {
    switch alert.severity {
    case .info:
      return "info.circle"
    case .success:
      return "checkmark.circle"
    case .warning:
      return "exclamationmark.triangle"
    case .critical:
      return "xmark.octagon"
    }
  }
}

struct DataPrivacySettingsPanel: View {
  @EnvironmentObject var model: AppViewModel
  @State private var pendingCleanup: LocalDataCleanupKind?
  @State private var cleanupConfirmation = ""

  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      FormCard {
        HStack(alignment: .top, spacing: 12) {
          Image(systemName: "hand.raised")
            .frame(width: 34, height: 34)
            .foregroundStyle(RCTheme.accentGreen)
            .background(RCTheme.accentGreen.opacity(0.12))
            .clipShape(RoundedRectangle(cornerRadius: 4))
          VStack(alignment: .leading, spacing: 6) {
            Text("Data & privacy")
              .font(.headline)
            Text(
              "Control optional diagnostics, export your data, or remove local and Relay account data. Credentials are never included in exports."
            )
            .font(.callout)
            .foregroundStyle(RCTheme.muted)
            .fixedSize(horizontal: false, vertical: true)
          }
        }
      }
      FormCard {
        Text("Privacy choices")
          .font(.headline)
        Text("Product analytics and crash reporting are optional and independently controlled. Both start off.")
          .font(.callout)
          .foregroundStyle(RCTheme.muted)
        NativeSettingsRow(
          title: "Share product analytics",
          subtitle: "Share basic usage data to help improve Relay. Messages, files, credentials, and URLs are never included.",
          value: model.productAnalyticsAvailable && model.userProfile.telemetryEnabled ? "On" : "Off"
        ) {
          Toggle(
            "Share product analytics",
            isOn: Binding(
              get: { model.productAnalyticsAvailable && model.userProfile.telemetryEnabled },
              set: { model.setProductAnalyticsEnabled($0) }
            )
          )
          .labelsHidden()
          .toggleStyle(.switch)
          .disabled(!model.productAnalyticsAvailable)
        }
        NativeDivider()
        NativeSettingsRow(
          title: "Share crash and error reports",
          subtitle: "Share crash and error data to help improve stability. Screenshots, messages, files, and email are never included.",
          value: model.crashReportingAvailable && model.userProfile.crashReportingEnabled ? "On" : "Off"
        ) {
          Toggle(
            "Share crash and error reports",
            isOn: Binding(
              get: { model.crashReportingAvailable && model.userProfile.crashReportingEnabled },
              set: { model.setCrashReportingEnabled($0) }
            )
          )
          .labelsHidden()
          .toggleStyle(.switch)
          .disabled(!model.crashReportingAvailable)
        }
        Link("Read privacy policy", destination: URL(string: "https://relayconsole.work/privacy")!)
      }
      FormCard {
        Text("Local data")
          .font(.headline)
        Text(
          "Export a redacted copy of your local Relay data. Passwords and keys are never included."
        )
        .font(.callout)
        .foregroundStyle(RCTheme.muted)
        .fixedSize(horizontal: false, vertical: true)
        HStack(spacing: 10) {
          Button(
            model.busy == "write-local-account-export" ? "Exporting..." : "Export data..."
          ) {
            model.prepareLocalAccountExport()
          }
          .buttonStyle(PrimaryLightButtonStyle())
          .disabled(model.busy == "write-local-account-export")
          .help("Save a redacted local data export")
          .accessibilityLabel("Export data")

          Button("Delete local data...", role: .destructive) {
            pendingCleanup = .resetLocalData
            cleanupConfirmation = ""
          }
          .buttonStyle(SecondaryLightButtonStyle())
          .disabled(model.busy != nil)
          .help("Delete Relay data stored on this Mac")
          .accessibilityLabel("Delete local data")
        }
        if model.settingsStatus == "Local export saved" {
          Text("Local export saved")
            .font(.caption)
            .foregroundStyle(RCTheme.accentGreen)
        }
        if let export = model.settingsSecuritySummary?.latestExport {
          SettingsInfoRow(label: "Latest export", value: export.status)
          SettingsInfoRow(label: "Records", value: "\(export.recordCount)")
          SettingsInfoRow(label: "Includes secrets", value: export.includesSecrets ? "Yes" : "No")
        }
      }
      CloudRelaySettingsPanel(presentation: .dataPrivacy)
    }
    .onAppear {
      model.disableUnavailableTelemetryPreferences()
    }
    .padding(24)
    .sheet(item: $pendingCleanup) { kind in
      VStack(alignment: .leading, spacing: 16) {
        Text("Remove local Relay data?").font(.headline)
        Text(
          "This deletes Relay’s local profile, conversations, exports, caches, and Keychain references from this Mac, then quits. Hermes Agent, OpenClaw, runtime configuration, and files outside Relay’s managed data folder are preserved."
        )
        .font(.callout)
        .foregroundStyle(RCTheme.muted)
        .fixedSize(horizontal: false, vertical: true)
        Text("This action cannot be undone. Type \(kind.confirmationPhrase) to continue.")
          .font(.callout)
          .foregroundStyle(RCTheme.muted)
        TextField(kind.confirmationPhrase, text: $cleanupConfirmation)
          .textFieldStyle(.roundedBorder)
        HStack {
          Spacer()
          Button("Cancel") {
            pendingCleanup = nil
            cleanupConfirmation = ""
          }
          Button("Remove Data and Quit", role: .destructive) {
            let confirmation = cleanupConfirmation
            pendingCleanup = nil
            cleanupConfirmation = ""
            model.executeLocalDataCleanup(kind, confirmation: confirmation)
          }
          .disabled(cleanupConfirmation != kind.confirmationPhrase || model.busy != nil)
        }
      }
      .padding(24)
      .frame(width: 520)
    }
  }
}

// Retained for source-level release inventory compatibility while the visible
// destination is now named Data & privacy.
typealias SecuritySettingsPanel = DataPrivacySettingsPanel

struct SettingsUnavailablePanel: View {
  var title: String
  var message: String
  var badge: String

  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      FormCard {
        HStack(alignment: .top, spacing: 12) {
          Image(systemName: "lock.shield")
            .frame(width: 34, height: 34)
            .foregroundStyle(RCTheme.accentAmber)
            .background(RCTheme.accentAmber.opacity(0.12))
            .clipShape(RoundedRectangle(cornerRadius: 4))
          VStack(alignment: .leading, spacing: 6) {
            Text(title)
              .font(.headline)
            Text(message)
              .font(.callout)
              .foregroundStyle(RCTheme.muted)
              .fixedSize(horizontal: false, vertical: true)
            StatusBadge(title: badge, tone: .amber, accessibilityLabelText: title)
          }
        }
      }
      .padding(24)
    }
  }
}

struct SettingsInfoRow: View {
  var label: String
  var value: String

  var body: some View {
    HStack {
      Text(label)
        .font(.caption)
        .foregroundStyle(RCTheme.muted)
      Spacer()
      Text(value)
        .font(.caption.weight(.semibold))
        .foregroundStyle(RCTheme.text)
    }
  }
}

struct SettingsStatTile: View {
  var title: String
  var value: String

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      Text(value)
        .font(.headline)
      Text(title)
        .font(.caption)
        .foregroundStyle(RCTheme.muted)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(10)
    .background(RCTheme.sidebarSurface)
    .clipShape(RoundedRectangle(cornerRadius: 4))
    .overlay(RoundedRectangle(cornerRadius: 4).stroke(RCTheme.borderSoft))
  }
}

struct HarnessesPanel: View {
  @EnvironmentObject var model: AppViewModel

  var body: some View {
    VStack(alignment: .leading, spacing: 14) {
      Text("Relay connects to runtimes that you install and manage.")
        .font(.callout)
        .foregroundStyle(RCTheme.muted)
      ForEach(model.records) { record in
        HarnessCard(record: record)
      }
    }
    .padding(24)
    .task {
      await model.discoverExistingHarnesses()
    }
  }
}

struct RuntimeExperienceSettingsPanel: View {
  @EnvironmentObject var model: AppViewModel

  var body: some View {
    VStack(alignment: .leading, spacing: 14) {
      NativeGroupedSection(
        title: "Runtime experience",
        subtitle: "Choose how agents run and which actions require approval."
      ) {
        NativeSettingsRow(
          title: "Conversation start",
          subtitle: "Agents start when you send a message.",
          value: "Automatic"
        )
        NativeDivider()
        NativeSettingsRow(
          title: "Action approvals",
          subtitle: "Agents can use the internet and access files without asking.",
          value: composerApprovalModeTitle(model.runtimeApprovalMode)
        )
        NativeDivider()
        NativeSettingsRow(
          title: "Technical activity",
          subtitle: "Show technical activity in chat.",
          value: model.runtimeActivityDetailEnabled ? "Detailed" : "Compact"
        ) {
          Toggle(
            "Technical activity",
            isOn: Binding(
              get: { model.runtimeActivityDetailEnabled },
              set: { model.setRuntimeActivityDetailEnabled($0) }
            )
          )
          .labelsHidden()
          .toggleStyle(.switch)
        }
        NativeDivider()
        NativeSettingsRow(
          title: "Storage",
          subtitle: "Stored locally on this Mac"
        ) {
          Button("Manage data") {
            model.selectSettingsPanel(.security)
          }
          .buttonStyle(SecondaryLightButtonStyle())
        }
        if model.settingsStatus == "Runtime preferences updated" {
          Text("Runtime preferences updated")
            .font(.caption)
            .foregroundStyle(RCTheme.accentGreen)
            .padding(.top, 8)
        }
      }
    }
  }
}

struct HarnessCard: View {
  @EnvironmentObject var model: AppViewModel
  let record: HarnessInstallRecord
  @State private var showLegacyRemovalConfirmation = false
  @State private var showsLocationHelp = false

  var body: some View {
    FormCard {
      HStack(spacing: 12) {
        RuntimeBrandIconView(runtimeType: runtimeType, size: 44)
          .help(record.displayName)
          .accessibilityLabel(record.displayName)
        VStack(alignment: .leading, spacing: 4) {
          Text(record.displayName).font(.headline)
          if let summary = runtimeSummary {
            Text(summary).font(.caption).foregroundStyle(RCTheme.muted)
          }
        }
        Spacer()
        StatusBadge(
          title: runtimeConnectionLabel(record),
          tone: runtimeConnectionTone(record),
          accessibilityLabelText:
            "\(record.displayName) status \(runtimeConnectionLabel(record))"
        )
      }
      if record.source != .missing {
        HStack(spacing: 8) {
          StatusBadge(
            title: runtimeCompatibilityLabel(record),
            tone: runtimeCompatibilityTone(record),
            accessibilityLabelText:
              "\(record.displayName) compatibility \(runtimeCompatibilityLabel(record))"
          )
          Text(runtimeVersionSummary(record))
            .font(.caption)
            .foregroundStyle(RCTheme.muted)
        }
        if let location = runtimeLocation {
          Text(location)
            .font(.caption2.monospaced())
            .foregroundStyle(RCTheme.muted)
            .lineLimit(2)
            .textSelection(.enabled)
        }
      }
      if record.source == .missing {
        discoveryContent
      }
      HStack {
        if record.lifecycleState == .connected && record.modelAuthStatus == .connected {
          if !hasUsableAgent {
            Text(noAgentMessage)
              .font(.caption)
              .foregroundStyle(RCTheme.muted)
            Button("Create Agent") {
              model.beginCreateAgent(type: record.harnessKey)
            }
            .buttonStyle(SecondaryLightButtonStyle())
            .help("Create Agent")
            .accessibilityLabel("Create Agent")
          }
          Button("Change location…") {
            model.connectExistingHarness(record)
          }
          .buttonStyle(SecondaryLightButtonStyle())
          .disabled(model.busy != nil)
        } else if record.source == .missing {
          Button("Choose Another Location…") {
            showsLocationHelp.toggle()
          }
          .buttonStyle(SecondaryLightButtonStyle())
          .disabled(model.busy != nil)
        } else {
          Button(model.busy == "check-\(record.harnessKey.rawValue)" ? "Checking..." : "Re-check") {
            model.recheckHarness(record)
          }
          .buttonStyle(PrimaryLightButtonStyle())
          .disabled(model.busy != nil)
          Button("Change location…") {
            model.connectExistingHarness(record)
          }
          .buttonStyle(SecondaryLightButtonStyle())
          .disabled(model.busy != nil)
        }
        Spacer()
      }
      if record.source == .missing, showsLocationHelp {
        locationHelpCard
      }
      Link(
        "Official install guide",
        destination: URL(
          string: record.harnessKey == .hermes
            ? "https://hermes-agent.nousresearch.com/docs/"
            : "https://docs.openclaw.ai/install")!
      )
      .font(.caption)
      Link(
        "Bridge plugin guide · Preview",
        destination: URL(
          string:
            "https://github.com/insitektalay/relay-console-bridge-plugins/blob/main/docs/INSTALL.md")!
      )
      .font(.caption)
      if record.source == .managed {
        VStack(alignment: .leading, spacing: 8) {
          Text(
            "Previous Relay-managed installation detected. Keep it temporarily, use Change location… to connect an installation you manage, or remove only the old runtime source below."
          )
          .font(.caption)
          .foregroundStyle(RCTheme.accentAmber)
          Button("Remove Old Relay-Managed Runtime…", role: .destructive) {
            showLegacyRemovalConfirmation = true
          }
          .buttonStyle(SecondaryLightButtonStyle())
          .disabled(model.busy != nil)
        }
        .padding(10)
        .background(RCTheme.accentAmber.opacity(0.10))
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .confirmationDialog(
          "Remove the old Relay-managed \(record.displayName) source?",
          isPresented: $showLegacyRemovalConfirmation,
          titleVisibility: .visible
        ) {
          Button("Remove Old Runtime Source", role: .destructive) {
            model.removeLegacyManagedHarness(record)
          }
          Button("Cancel", role: .cancel) {}
        } message: {
          Text(
            "Relay Console removes only its old runtime source folder. Conversations, agents, workspaces, runtime-created state, and credentials are kept. Install \(record.displayName) yourself and use Connect Existing to continue."
          )
        }
      }
    }
  }

  private var hasUsableAgent: Bool {
    model.usableAgents.contains { $0.harness.id == record.harnessId }
  }

  @ViewBuilder
  private var discoveryContent: some View {
    let candidates = model.runtimeDiscoveryCandidates.filter { $0.harnessKey == record.harnessKey }
    if model.runtimeDiscoveryInProgress {
      HStack(spacing: 8) {
        ProgressView().controlSize(.small)
        Text("Looking for \(record.displayName)…")
          .font(.callout)
          .foregroundStyle(RCTheme.muted)
      }
      .accessibilityElement(children: .combine)
    } else if !candidates.isEmpty {
      VStack(alignment: .leading, spacing: 10) {
        ForEach(candidates) { candidate in
          VStack(alignment: .leading, spacing: 7) {
            HStack(alignment: .firstTextBaseline) {
              VStack(alignment: .leading, spacing: 3) {
                Text(candidate.runtimeName)
                  .font(.system(size: 13, weight: .semibold))
                Text(candidate.displayLocation)
                  .font(.caption.monospaced())
                  .foregroundStyle(RCTheme.muted)
                  .lineLimit(2)
                  .textSelection(.enabled)
              }
              Spacer()
              StatusBadge(
                title: "Compatible",
                tone: .green,
                accessibilityLabelText: "\(candidate.runtimeName) compatible"
              )
            }
            HStack(spacing: 8) {
              Text(candidate.version.map { "Version \($0)" } ?? "Version not reported")
                .font(.caption)
                .foregroundStyle(RCTheme.muted)
              Text("•")
                .foregroundStyle(RCTheme.muted)
              Text(candidate.healthMessage)
                .font(.caption)
                .foregroundStyle(RCTheme.accentGreen)
              Spacer()
              Button("Connect") {
                model.connectDiscoveredHarness(candidate)
              }
              .buttonStyle(PrimaryLightButtonStyle())
              .disabled(model.busy != nil)
              .accessibilityLabel("Connect \(candidate.runtimeName) at \(candidate.displayLocation)")
            }
          }
          .padding(10)
          .background(RCTheme.sidebarSurface)
          .clipShape(RoundedRectangle(cornerRadius: 8))
          .overlay(RoundedRectangle(cornerRadius: 8).stroke(RCTheme.borderSoft))
        }
      }
    } else if model.runtimeDiscoveryCompleted {
      Text("Relay could not find an existing \(record.displayName) installation on this Mac. You can choose another location or follow the official install guide below.")
        .font(.callout)
        .foregroundStyle(RCTheme.muted)
    }
  }

  @ViewBuilder
  private var locationHelpCard: some View {
    VStack(alignment: .leading, spacing: 8) {
      if record.harnessKey == .hermes {
        Text("Hermes Agent is normally in ~/.hermes/hermes-agent. The .hermes folder is hidden by macOS; press Command–Shift–Period (⌘⇧.) in Finder to show or hide hidden files. Select the inner hermes-agent folder containing run_agent.py.")
          .font(.caption)
          .foregroundStyle(RCTheme.muted)
        Button("Choose Hermes Folder…") {
          model.connectExistingHarness(record)
        }
        .buttonStyle(SecondaryLightButtonStyle())
        .disabled(model.busy != nil)
      } else {
        Text("Global OpenClaw installations may be under Homebrew or npm locations and may not be obvious in Finder. Select the OpenClaw command or a folder containing openclaw.mjs.")
          .font(.caption)
          .foregroundStyle(RCTheme.muted)
        Button("Choose OpenClaw Location…") {
          model.connectExistingHarness(record)
        }
        .buttonStyle(SecondaryLightButtonStyle())
        .disabled(model.busy != nil)
      }
    }
    .padding(10)
    .background(RCTheme.sidebarSurface)
    .clipShape(RoundedRectangle(cornerRadius: 8))
    .overlay(RoundedRectangle(cornerRadius: 8).stroke(RCTheme.borderSoft))
  }

  private var noAgentMessage: String {
    record.harnessKey == .openclaw
      ? "Create an OpenClaw agent to chat." : "Create a Hermes agent to chat."
  }

  private var runtimeType: RuntimeType {
    record.harnessKey == .openclaw ? .openclaw : .hermes
  }

  private var runtimeSummary: String? {
    if record.source == .missing {
      return record.harnessKey == .openclaw
        ? "Connect an existing OpenClaw installation."
        : "Connect an existing Hermes Agent installation."
    }
    if record.lifecycleState == .connected, record.modelAuthStatus == .connected {
      return nil
    }
    return statusMessage(record)
  }

  private var runtimeLocation: String? {
    record.selectedLocalPath?.nilIfEmpty ?? record.installPath?.nilIfEmpty
  }

}
