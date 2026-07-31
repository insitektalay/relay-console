import AppKit
import RelayConsoleCore
import SwiftUI
import UniformTypeIdentifiers

struct ApplicationsGitLabAgentSwitchRow: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp
  let target: MarketplaceCompatibleAgentTarget
  let install: MarketplaceInstallRecord?
  let isOn: Bool
  let disabled: Bool
  @State private var pendingConnectionState: Bool?

  private var displayName: String {
    model.agents.first { $0.id == target.agentId }.map(model.resolveAgentDisplayName)
      ?? target.agentName
  }

  private var busy: Bool {
    model.busy == "toggle-gitlab-agent-\(target.agentId)"
  }

  private var controlsDisabled: Bool {
    disabled || busy || model.providerConnectionSnapshot?.readOnly == true
      || app.availability != .available
  }

  private var confirmationBinding: Binding<Bool> {
    Binding(
      get: { pendingConnectionState != nil },
      set: { newValue in
        if !newValue {
          pendingConnectionState = nil
        }
      }
    )
  }

  private var confirmationTitle: String {
    if pendingConnectionState == true {
      return "Connect \(displayName) to GitLab?"
    }
    return "Disconnect GitLab for \(displayName)?"
  }

  private var confirmationMessage: String {
    if pendingConnectionState == true {
      return
        "This connects the agent to the GitLab account, group, or project with Standard authority."
    }
    return "This removes the agent's access to the GitLab account, group, or project."
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 9) {
      HStack(spacing: 12) {
        AgentAvatarView(name: displayName, avatarURL: model.agentAvatar(target.agentId), size: 38)
        VStack(alignment: .leading, spacing: 3) {
          Text(displayName)
            .font(.system(size: 13, weight: .semibold))
            .lineLimit(1)
          Text(
            target.status == .compatible
              ? exaRuntimeLabel(target.runtimeType) : (target.unavailableReason ?? "Unavailable")
          )
          .font(.system(size: 12, weight: .semibold))
          .foregroundStyle(target.status == .compatible ? RCTheme.muted : RCTheme.accentAmber)
          .lineLimit(1)
        }
        Spacer(minLength: 8)
        if busy {
          ProgressView()
            .controlSize(.small)
            .scaleEffect(0.75)
            .frame(width: 32, height: 20)
        } else {
          Button {
            pendingConnectionState = !isOn
          } label: {
            ApplicationsExaSwitch(isOn: isOn)
          }
          .buttonStyle(.plain)
          .disabled(controlsDisabled)
          .help(isOn ? "Remove GitLab from \(displayName)" : "Give \(displayName) access to GitLab")
          .accessibilityLabel("\(isOn ? "Disconnect" : "Connect") \(displayName) from GitLab")
        }
      }
      ApplicationsAgentAuthorityRow(
        app: app,
        install: install,
        selectedPreset: install.flatMap { model.marketplaceActionPolicyPreset(for: $0) }
          ?? .approvalRequired,
        muted: !isOn
      )
    }
    .padding(.horizontal, 12)
    .padding(.vertical, 10)
    .frame(minHeight: 86)
    .background(isOn ? RCTheme.sidebarSelected.opacity(0.48) : RCTheme.surfaceInset)
    .clipShape(RoundedRectangle(cornerRadius: 8))
    .overlay(
      RoundedRectangle(cornerRadius: 8).stroke(
        isOn ? RCTheme.accentGreen.opacity(0.35) : RCTheme.borderSoft)
    )
    .opacity(disabled && !isOn ? 0.72 : 1)
    .alert(confirmationTitle, isPresented: confirmationBinding) {
      Button("Cancel", role: .cancel) {
        pendingConnectionState = nil
      }
      Button(
        pendingConnectionState == true ? "Connect" : "Disconnect",
        role: pendingConnectionState == true ? nil : .destructive
      ) {
        let enabled = pendingConnectionState ?? !isOn
        pendingConnectionState = nil
        model.setGitLabAgentConnection(target.agentId, enabled: enabled, for: app)
      }
    } message: {
      Text(confirmationMessage)
    }
  }
}

struct ApplicationsGitLabConnectionsCard: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp

  private var connections: [MarketplaceProviderConnection] {
    model.providerConnectionSnapshot?.connections ?? []
  }

  private var selectedConnection: MarketplaceProviderConnection? {
    model.selectedProviderConnection
  }

  var body: some View {
    ApplicationsExaPanel {
      HStack(alignment: .top, spacing: 14) {
        ApplicationsExaSectionHeading(
          icon: "key", title: "Manage API Connection",
          subtitle: "Connect your GitLab account securely with one click.")
        Spacer()
        ApplicationsExaInfoPill(
          text: "Your GitLab access stays encrypted and is never shown to agents.")
      }

      VStack(alignment: .leading, spacing: 14) {
        connectForm
        connectionTable
      }

      if let status = model.gitLabConnectionStatus?.nilIfEmpty {
        HStack(spacing: 8) {
          Image(
            systemName: status.localizedCaseInsensitiveContains("connected")
              ? "checkmark.circle.fill" : "info.circle"
          )
          .foregroundStyle(
            status.localizedCaseInsensitiveContains("connected")
              ? RCTheme.accentGreen : RCTheme.accentAmber)
          Text(status)
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(RCTheme.muted)
          Spacer()
        }
      }
    }
  }

  private var connectForm: some View {
    VStack(alignment: .leading, spacing: 12) {
      ApplicationsConnectionFormGrid {
        VStack(alignment: .leading, spacing: 8) {
          Text("GitLab account")
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(RCTheme.muted)
          Text(selectedConnection.map(gitLabAccountPreview) ?? "No account connected")
            .font(.system(size: 13, weight: .bold))
            .foregroundStyle(RCTheme.text)
            .frame(maxWidth: .infinity, minHeight: 36, alignment: .leading)
            .padding(.horizontal, 11)
            .background(RCTheme.fieldBackground)
            .clipShape(RoundedRectangle(cornerRadius: 7))
            .overlay(RoundedRectangle(cornerRadius: 7).stroke(RCTheme.borderSoft))
        }
        VStack(alignment: .leading, spacing: 8) {
          Text("OAuth flow")
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(RCTheme.muted)
          Button {
            model.startGitLabOAuthConnect(for: app)
          } label: {
            HStack(spacing: 8) {
              Image(systemName: "link.badge.plus")
              Text(selectedConnection == nil ? "Connect GitLab" : "Reconnect GitLab")
            }
          }
          .buttonStyle(PrimaryLightButtonStyle())
          .frame(maxWidth: .infinity)
          .disabled(model.providerConnectionSnapshot?.readOnly == true)
          .help("Open GitLab to approve access")
        }
      }
      Text(
        "GitLab will show the permissions Relay Console is requesting before you approve the connection."
      )
      .font(.system(size: 12, weight: .semibold))
      .foregroundStyle(RCTheme.muted)
      HStack(spacing: 7) {
        Image(systemName: "lock")
        Text("Connection credentials are encrypted by Relay Console and never exposed to agents.")
      }
      .font(.system(size: 11, weight: .semibold))
      .foregroundStyle(RCTheme.muted)
    }
    .padding(16)
    .frame(maxWidth: .infinity, alignment: .topLeading)
    .background(RCTheme.surfaceInset)
    .clipShape(RoundedRectangle(cornerRadius: 8))
    .overlay(RoundedRectangle(cornerRadius: 8).stroke(RCTheme.borderSoft))
  }

  private var connectionTable: some View {
    VStack(spacing: 0) {
      ApplicationsGitLabConnectionHeader()
      if connections.isEmpty {
        EmptyMiniLight(
          title: "No GitLab OAuth connection", body: "Connect GitLab before assigning agents."
        )
        .padding(.vertical, 22)
      } else {
        ForEach(connections) { connection in
          ApplicationsGitLabConnectionRow(
            connection: connection,
            selected: selectedConnection?.id == connection.id
          )
        }
      }
      HStack(spacing: 8) {
        Image(systemName: "lightbulb")
          .foregroundStyle(RCTheme.muted)
        Text("Reconnect GitLab when the OAuth grant changes or is revoked.")
          .font(.system(size: 12, weight: .semibold))
          .foregroundStyle(RCTheme.muted)
        Spacer()
      }
      .padding(.horizontal, 14)
      .frame(height: 38)
      .overlay(alignment: .top) {
        Rectangle().fill(RCTheme.borderSoft).frame(height: 1)
      }
    }
    .frame(maxWidth: .infinity, alignment: .topLeading)
    .background(RCTheme.surfaceInset)
    .clipShape(RoundedRectangle(cornerRadius: 8))
    .overlay(RoundedRectangle(cornerRadius: 8).stroke(RCTheme.borderSoft))
  }
}

struct ApplicationsGitLabConnectionHeader: View {
  var body: some View {
    HStack(spacing: 12) {
      Text("Connection name")
        .frame(minWidth: 180, maxWidth: .infinity, alignment: .leading)
      Text("Account")
        .frame(width: 190, alignment: .leading)
      Text("Scopes")
        .frame(width: 130, alignment: .leading)
      Text("Status")
        .frame(width: 110, alignment: .leading)
    }
    .font(.system(size: 11, weight: .bold))
    .foregroundStyle(RCTheme.muted)
    .padding(.horizontal, 14)
    .frame(height: 36)
    .frame(maxWidth: .infinity)
  }
}

struct ApplicationsGitLabConnectionRow: View {
  let connection: MarketplaceProviderConnection
  let selected: Bool

  var body: some View {
    HStack(spacing: 12) {
      HStack(spacing: 8) {
        Text(gitLabConnectionName(connection))
          .font(.system(size: 13, weight: .bold))
          .lineLimit(1)
        if selected {
          Text("ACTIVE")
            .font(.system(size: 9, weight: .bold))
            .foregroundStyle(RCTheme.accentBlue)
            .padding(.horizontal, 7)
            .frame(height: 20)
            .background(RCTheme.accentBlue.opacity(0.12))
            .clipShape(RoundedRectangle(cornerRadius: 4))
            .overlay(RoundedRectangle(cornerRadius: 4).stroke(RCTheme.accentBlue.opacity(0.35)))
        }
      }
      .frame(minWidth: 180, maxWidth: .infinity, alignment: .leading)

      Text(gitLabAccountPreview(connection))
        .font(.system(size: 13, weight: .semibold))
        .foregroundStyle(RCTheme.muted)
        .lineLimit(1)
        .frame(width: 190, alignment: .leading)

      Text("\(connection.grantedScopes.count) granted")
        .font(.system(size: 12, weight: .semibold))
        .foregroundStyle(RCTheme.muted)
        .frame(width: 130, alignment: .leading)

      HStack(spacing: 7) {
        Image(
          systemName: gitLabConnectionIsValid(connection)
            ? "checkmark.circle.fill" : "exclamationmark.triangle.fill"
        )
        .foregroundStyle(
          gitLabConnectionIsValid(connection) ? RCTheme.accentGreen : RCTheme.accentAmber)
        Text(gitLabConnectionStatusText(connection))
          .font(.system(size: 12, weight: .semibold))
      }
      .frame(width: 110, alignment: .leading)
    }
    .padding(.horizontal, 14)
    .frame(height: 46)
    .frame(maxWidth: .infinity)
    .background(selected ? RCTheme.sidebarSelected.opacity(0.55) : Color.clear)
    .overlay(alignment: .top) {
      Rectangle().fill(selected ? RCTheme.accentBlue.opacity(0.55) : RCTheme.borderSoft).frame(
        height: selected ? 1.2 : 1)
    }
  }
}

struct ApplicationsGoogleCalendarDetailPanel: View {
  let app: MarketplaceCatalogApp

  var body: some View {
    VStack(spacing: 14) {
      ApplicationsExaHeroCard(app: app)
      ApplicationsGoogleCalendarAgentsCard(app: app)
      ApplicationsGoogleCalendarConnectionsCard(app: app)
      LazyVGrid(
        columns: [GridItem(.adaptive(minimum: 285), spacing: 14)], alignment: .leading, spacing: 14
      ) {
        ApplicationsExaInfoCard(
          icon: "calendar",
          title: "Capabilities",
          items: app.capabilities,
          linkTitle: "Learn more about Calendar API",
          linkURL: app.docsURL.flatMap(URL.init(string:))
        )
        ApplicationsExaInfoCard(
          icon: "lock.shield",
          title: "What Agents Can Do",
          items: [
            "List calendars and read bounded event context through Relay wrappers",
            "Check free/busy availability for meeting planning",
            "Create or update Calendar events through approval or Direct writes",
          ],
          linkTitle: nil,
          linkURL: nil
        )
        ApplicationsExaInfoCard(
          icon: "checklist",
          title: "Requirements",
          items: marketplaceConnectionRequirements(for: app),
          linkTitle: nil,
          linkURL: nil
        )
      }
    }
  }
}

struct ApplicationsGoogleCalendarAgentsCard: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp

  private var selectedConnection: MarketplaceProviderConnection? {
    model.selectedProviderConnection
  }

  private var connections: [MarketplaceProviderConnection] {
    model.providerConnectionSnapshot?.connections ?? []
  }

  private var compatibleTargets: [MarketplaceCompatibleAgentTarget] {
    let query = model.googleCalendarAgentSearch.trimmingCharacters(in: .whitespacesAndNewlines)
      .lowercased()
    return model.visibleMarketplaceCompatibleAgents
      .filter { app.runtimeSupport.contains($0.runtimeType) }
      .filter { target in
        guard !query.isEmpty else { return true }
        return [displayName(for: target), exaRuntimeLabel(target.runtimeType)]
          .joined(separator: " ")
          .lowercased()
          .contains(query)
      }
      .sorted {
        displayName(for: $0).localizedCaseInsensitiveCompare(displayName(for: $1))
          == .orderedAscending
      }
  }

  private var connectedCount: Int {
    guard let selectedConnection else { return 0 }
    return compatibleTargets.filter {
      activeInstall(for: $0.agentId)?.connectionId == selectedConnection.id
    }.count
  }

  var body: some View {
    ApplicationsExaPanel {
      ViewThatFits(in: .horizontal) {
        HStack(alignment: .top, spacing: 14) {
          ApplicationsExaSectionHeading(
            icon: "person.2", title: "Agents with Google Calendar",
            subtitle: "Select which agents should use the active Google Calendar OAuth connection.")
          Spacer()
          agentControls
        }
        VStack(alignment: .leading, spacing: 12) {
          ApplicationsExaSectionHeading(
            icon: "person.2", title: "Agents with Google Calendar",
            subtitle: "Select which agents should use the active Google Calendar OAuth connection.")
          agentControls
        }
      }

      if compatibleTargets.isEmpty {
        EmptyMiniLight(
          title: "No available agents",
          body: "Google Calendar can be installed on compatible Hermes and OpenClaw agents.")
      } else {
        if connections.isEmpty {
          ApplicationsExaInfoPill(
            text: "Save Google Calendar OAuth credentials below before turning agents on.")
        }
        LazyVGrid(
          columns: [GridItem(.adaptive(minimum: 245), spacing: 12)], alignment: .leading,
          spacing: 12
        ) {
          ForEach(compatibleTargets) { target in
            ApplicationsGoogleCalendarAgentSwitchRow(
              app: app,
              target: target,
              install: activeInstall(for: target.agentId),
              isOn: selectedConnection != nil
                && activeInstall(for: target.agentId)?.connectionId == selectedConnection?.id,
              disabled: selectedConnection == nil || target.status != .compatible
            )
          }
        }
        HStack {
          Spacer()
          Text("\(connectedCount)")
            .font(.system(size: 13, weight: .bold))
            .foregroundStyle(RCTheme.accentGreen)
          Text("of \(compatibleTargets.count) agents connected to Google Calendar.")
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(RCTheme.muted)
        }
      }
    }
  }

  private var agentControls: some View {
    HStack(spacing: 10) {
      Text("Active connection:")
        .font(.system(size: 12, weight: .semibold))
        .foregroundStyle(RCTheme.muted)
      Text(selectedConnection.map(googleCalendarConnectionName) ?? "No OAuth account saved")
        .font(.system(size: 13, weight: .semibold))
        .padding(.horizontal, 12)
        .frame(height: 36)
        .background(RCTheme.surfaceInset)
        .clipShape(RoundedRectangle(cornerRadius: 7))
        .overlay(RoundedRectangle(cornerRadius: 7).stroke(RCTheme.borderSoft))
      ApplicationsExaSearchField(
        text: $model.googleCalendarAgentSearch, placeholder: "Search agents..."
      )
      .frame(width: 250)
    }
  }

  private func activeInstall(for agentId: RelayId) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "google-calendar" && exaInstallIsActive($0)
    }
  }

  private func displayName(for target: MarketplaceCompatibleAgentTarget) -> String {
    model.agents.first { $0.id == target.agentId }.map(model.resolveAgentDisplayName)
      ?? target.agentName
  }
}

struct ApplicationsGoogleCalendarAgentSwitchRow: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp
  let target: MarketplaceCompatibleAgentTarget
  let install: MarketplaceInstallRecord?
  let isOn: Bool
  let disabled: Bool
  @State private var pendingConnectionState: Bool?

  private var displayName: String {
    model.agents.first { $0.id == target.agentId }.map(model.resolveAgentDisplayName)
      ?? target.agentName
  }

  private var busy: Bool {
    model.busy == "toggle-google-calendar-agent-\(target.agentId)"
  }

  private var controlsDisabled: Bool {
    disabled || busy || model.providerConnectionSnapshot?.readOnly == true
      || app.availability != .available
  }

  private var confirmationBinding: Binding<Bool> {
    Binding(
      get: { pendingConnectionState != nil },
      set: { newValue in
        if !newValue {
          pendingConnectionState = nil
        }
      }
    )
  }

  private var confirmationTitle: String {
    if pendingConnectionState == true {
      return "Connect \(displayName) to Google Calendar?"
    }
    return "Disconnect Google Calendar for \(displayName)?"
  }

  private var confirmationMessage: String {
    if pendingConnectionState == true {
      return "This connects the agent to the Google Calendar OAuth account with Standard authority."
    }
    return "This removes the agent's access to the Google Calendar OAuth account."
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 9) {
      HStack(spacing: 12) {
        AgentAvatarView(name: displayName, avatarURL: model.agentAvatar(target.agentId), size: 38)
        VStack(alignment: .leading, spacing: 3) {
          Text(displayName)
            .font(.system(size: 13, weight: .semibold))
            .lineLimit(1)
          Text(
            target.status == .compatible
              ? exaRuntimeLabel(target.runtimeType) : (target.unavailableReason ?? "Unavailable")
          )
          .font(.system(size: 12, weight: .semibold))
          .foregroundStyle(target.status == .compatible ? RCTheme.muted : RCTheme.accentAmber)
          .lineLimit(1)
        }
        Spacer(minLength: 8)
        if busy {
          ProgressView()
            .controlSize(.small)
            .scaleEffect(0.75)
            .frame(width: 32, height: 20)
        } else {
          Button {
            pendingConnectionState = !isOn
          } label: {
            ApplicationsExaSwitch(isOn: isOn)
          }
          .buttonStyle(.plain)
          .disabled(controlsDisabled)
          .help(
            isOn
              ? "Remove Google Calendar from \(displayName)"
              : "Give \(displayName) access to Google Calendar"
          )
          .accessibilityLabel(
            "\(isOn ? "Disconnect" : "Connect") \(displayName) from Google Calendar")
        }
      }
      if isOn, let install {
        ApplicationsAgentAuthorityRow(
          app: app, install: install,
          selectedPreset: model.marketplaceActionPolicyPreset(for: install) ?? .approvalRequired)
      }
    }
    .padding(.horizontal, 12)
    .padding(.vertical, 10)
    .frame(minHeight: 86)
    .background(isOn ? RCTheme.sidebarSelected.opacity(0.48) : RCTheme.surfaceInset)
    .clipShape(RoundedRectangle(cornerRadius: 8))
    .overlay(
      RoundedRectangle(cornerRadius: 8).stroke(
        isOn ? RCTheme.accentGreen.opacity(0.35) : RCTheme.borderSoft)
    )
    .opacity(disabled && !isOn ? 0.72 : 1)
    .alert(confirmationTitle, isPresented: confirmationBinding) {
      Button("Cancel", role: .cancel) {
        pendingConnectionState = nil
      }
      Button(
        pendingConnectionState == true ? "Connect" : "Disconnect",
        role: pendingConnectionState == true ? nil : .destructive
      ) {
        let enabled = pendingConnectionState ?? !isOn
        pendingConnectionState = nil
        model.setGoogleCalendarAgentConnection(target.agentId, enabled: enabled, for: app)
      }
    } message: {
      Text(confirmationMessage)
    }
  }
}

struct ApplicationsGoogleCalendarConnectionsCard: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp

  private var connections: [MarketplaceProviderConnection] {
    model.providerConnectionSnapshot?.connections ?? []
  }

  private var selectedConnection: MarketplaceProviderConnection? {
    model.selectedProviderConnection
  }

  private var canConnect: Bool {
    model.busy != "connect-google-calendar-oauth"
  }

  var body: some View {
    ApplicationsExaPanel {
      HStack(alignment: .top, spacing: 14) {
        ApplicationsExaSectionHeading(
          icon: "key", title: "Manage API Connection",
          subtitle:
            "Authorize Google Calendar through Relay-owned OAuth with the exact V1 Calendar scopes."
        )
        Spacer()
        ApplicationsExaInfoPill(text: "Client secrets stay in the Railway broker.")
      }

      ViewThatFits(in: .horizontal) {
        HStack(alignment: .top, spacing: 24) {
          credentialForm
          connectionTable
        }
        VStack(alignment: .leading, spacing: 14) {
          credentialForm
          connectionTable
        }
      }

      if let status = model.googleCalendarConnectionStatus?.nilIfEmpty {
        HStack(spacing: 8) {
          Image(
            systemName: status.localizedCaseInsensitiveContains("deleted")
              || status.localizedCaseInsensitiveContains("disconnected")
              ? "info.circle" : "checkmark.circle.fill"
          )
          .foregroundStyle(
            status.localizedCaseInsensitiveContains("saved")
              || status.localizedCaseInsensitiveContains("connected")
              ? RCTheme.accentGreen : RCTheme.accentAmber)
          Text(status)
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(RCTheme.muted)
          Spacer()
        }
      }
    }
  }

  private var credentialForm: some View {
    VStack(alignment: .leading, spacing: 12) {
      Text(connections.isEmpty ? "Authorize Google Calendar" : "Add another Calendar account")
        .font(.system(size: 15, weight: .bold))
      ApplicationsExaInput(
        label: "Connection name", placeholder: "Calendar account",
        text: $model.googleCalendarConnectionNameDraft, secure: false)
      ApplicationsExaInput(
        label: "Default calendar ID optional", placeholder: "primary",
        text: $model.googleCalendarDefaultCalendarIdDraft, secure: false)
      Button {
        model.startGoogleCalendarOAuthConnect(for: app)
      } label: {
        if model.busy == "connect-google-calendar-oauth" {
          HStack(spacing: 7) {
            ProgressView()
              .controlSize(.small)
              .scaleEffect(0.75)
            Text("Connecting...")
          }
        } else {
          Text("Connect Google Calendar")
        }
      }
      .buttonStyle(PrimaryLightButtonStyle())
      .frame(maxWidth: .infinity)
      .disabled(
        !canConnect || model.providerConnectionSnapshot?.readOnly == true
          || app.availability != .available)
      HStack(spacing: 7) {
        Image(systemName: "lock")
        Text(
          "Access and refresh tokens use separate Keychain references. Relay's client secret stays on Railway."
        )
      }
      .font(.system(size: 11, weight: .semibold))
      .foregroundStyle(RCTheme.muted)
    }
    .padding(16)
    .frame(width: 410, alignment: .topLeading)
    .background(RCTheme.surfaceInset)
    .clipShape(RoundedRectangle(cornerRadius: 8))
    .overlay(RoundedRectangle(cornerRadius: 8).stroke(RCTheme.borderSoft))
  }

  private var connectionTable: some View {
    ScrollView(.horizontal, showsIndicators: false) {
      VStack(spacing: 0) {
        ApplicationsGoogleCalendarConnectionHeader()
        if connections.isEmpty {
          EmptyMiniLight(
            title: "No verified Google Calendar connection",
            body: "Authorize a Relay-owned Google OAuth account before assigning agents."
          )
          .padding(.vertical, 22)
        } else {
          ForEach(connections) { connection in
            ApplicationsGoogleCalendarConnectionRow(
              app: app,
              connection: connection,
              selected: selectedConnection?.id == connection.id
            )
          }
        }
        HStack(spacing: 8) {
          Image(systemName: "lightbulb")
            .foregroundStyle(RCTheme.muted)
          Text("Replace credentials when the user's Google OAuth grant changes or is revoked.")
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(RCTheme.muted)
          Spacer()
        }
        .padding(.horizontal, 14)
        .frame(height: 38)
        .overlay(alignment: .top) {
          Rectangle().fill(RCTheme.borderSoft).frame(height: 1)
        }
      }
      .frame(minWidth: 720, alignment: .topLeading)
    }
    .frame(maxWidth: .infinity, alignment: .topLeading)
    .background(RCTheme.surfaceInset)
    .clipShape(RoundedRectangle(cornerRadius: 8))
    .overlay(RoundedRectangle(cornerRadius: 8).stroke(RCTheme.borderSoft))
  }
}

struct ApplicationsGoogleCalendarConnectionHeader: View {
  var body: some View {
    HStack(spacing: 12) {
      Text("")
        .frame(width: 28)
      Text("Connection name")
        .frame(minWidth: 180, maxWidth: .infinity, alignment: .leading)
      Text("Account")
        .frame(width: 175, alignment: .leading)
      Text("Scopes")
        .frame(width: 130, alignment: .leading)
      Text("Status")
        .frame(width: 110, alignment: .leading)
      Text("Actions")
        .frame(width: 58, alignment: .center)
    }
    .font(.system(size: 11, weight: .bold))
    .foregroundStyle(RCTheme.muted)
    .padding(.horizontal, 14)
    .frame(height: 36)
  }
}
