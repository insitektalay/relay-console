import AppKit
import RelayConsoleCore
import SwiftUI
import UniformTypeIdentifiers

struct ApplicationsSentryAgentSwitchRow: View {
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
    model.busy == "toggle-sentry-agent-\(target.agentId)"
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
      return "Connect \(displayName) to Sentry?"
    }
    return "Disconnect Sentry for \(displayName)?"
  }

  private var confirmationMessage: String {
    if pendingConnectionState == true {
      return
        "This connects the agent to the selected Sentry organization with approval-gated issue updates."
    }
    return "This removes the agent's access to the selected Sentry organization."
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
          .help(isOn ? "Remove Sentry from \(displayName)" : "Give \(displayName) Sentry access")
          .accessibilityLabel("\(isOn ? "Disconnect" : "Connect") \(displayName) from Sentry")
        }
      }
      if isOn {
        HStack(spacing: 6) {
          Image(systemName: "checkmark.shield")
          Text("Approval-gated Sentry issue updates")
        }
        .font(.system(size: 11, weight: .bold))
        .foregroundStyle(RCTheme.muted)
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
        model.setSentryAgentConnection(target.agentId, enabled: enabled, for: app)
      }
    } message: {
      Text(confirmationMessage)
    }
  }
}

struct ApplicationsSentryConnectionsCard: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp

  private var connections: [MarketplaceProviderConnection] {
    model.providerConnectionSnapshot?.connections ?? []
  }

  private var selectedConnection: MarketplaceProviderConnection? {
    model.selectedProviderConnection
  }

  private var canConnect: Bool {
    model.sentryOrganizationSlugDraft.nilIfEmpty != nil
      && model.busy != "connect-sentry-oauth"
  }

  var body: some View {
    ApplicationsExaPanel {
      HStack(alignment: .top, spacing: 14) {
        ApplicationsExaSectionHeading(
          icon: "key", title: "Manage API Connection",
          subtitle: "Connect one Sentry organization through Relay-owned device OAuth.")
        Spacer()
        ApplicationsExaInfoPill(
          text:
            "Exact org/project/event scopes. Source-map upload, admin actions, and raw MCP stay blocked."
        )
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

      if let status = model.sentryConnectionStatus?.nilIfEmpty {
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
      Text("Connect Sentry")
        .font(.system(size: 15, weight: .bold))
      ApplicationsExaInput(
        label: "Connection name optional", placeholder: "Production errors",
        text: $model.sentryConnectionNameDraft, secure: false)
      ApplicationsExaInput(
        label: "Organization slug or id", placeholder: "acme",
        text: $model.sentryOrganizationSlugDraft, secure: false)
      ApplicationsExaInput(
        label: "Base URL optional", placeholder: "https://sentry.io",
        text: $model.sentryBaseURLDraft, secure: false)
      ApplicationsExaInput(
        label: "Default project optional", placeholder: "web-app",
        text: $model.sentryDefaultProjectSlugDraft, secure: false)
      ApplicationsExaInput(
        label: "Default environment optional", placeholder: "production",
        text: $model.sentryDefaultEnvironmentDraft, secure: false)
      Button {
        model.startSentryOAuthConnect(for: app)
      } label: {
        if model.busy == "connect-sentry-oauth" {
          HStack(spacing: 7) {
            ProgressView()
              .controlSize(.small)
              .scaleEffect(0.75)
            Text("Waiting for Sentry...")
          }
        } else {
          Label(
            selectedConnection == nil ? "Connect Sentry" : "Reconnect Sentry",
            systemImage: "link.badge.plus")
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
          "Sentry shows a short device code in your browser. Access and refresh tokens use separate Keychain references."
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
        ApplicationsSentryConnectionHeader()
        if connections.isEmpty {
          EmptyMiniLight(
            title: "No Sentry OAuth connection",
            body:
              "Enter the organization slug, then complete Sentry's device authorization before assigning agents."
          )
          .padding(.vertical, 22)
        } else {
          ForEach(connections) { connection in
            ApplicationsSentryConnectionRow(
              app: app,
              connection: connection,
              selected: selectedConnection?.id == connection.id
            )
          }
        }
        HStack(spacing: 8) {
          Image(systemName: "lightbulb")
            .foregroundStyle(RCTheme.muted)
          Text(
            "Check validates the token against a bounded organization projects request before agents use Sentry wrappers."
          )
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
      .frame(minWidth: 890, alignment: .topLeading)
    }
    .frame(maxWidth: .infinity, alignment: .topLeading)
    .background(RCTheme.surfaceInset)
    .clipShape(RoundedRectangle(cornerRadius: 8))
    .overlay(RoundedRectangle(cornerRadius: 8).stroke(RCTheme.borderSoft))
  }
}

struct ApplicationsSentryConnectionHeader: View {
  var body: some View {
    HStack(spacing: 12) {
      Text("")
        .frame(width: 28)
      Text("Connection name")
        .frame(minWidth: 180, maxWidth: .infinity, alignment: .leading)
      Text("Organization")
        .frame(width: 165, alignment: .leading)
      Text("Project")
        .frame(width: 140, alignment: .leading)
      Text("Last check")
        .frame(width: 120, alignment: .leading)
      Text("Status")
        .frame(width: 100, alignment: .leading)
      Text("Actions")
        .frame(width: 92, alignment: .center)
    }
    .font(.system(size: 11, weight: .bold))
    .foregroundStyle(RCTheme.muted)
    .padding(.horizontal, 14)
    .frame(height: 36)
  }
}

struct ApplicationsSentryConnectionRow: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp
  let connection: MarketplaceProviderConnection
  let selected: Bool

  private var isTesting: Bool {
    model.busy == "test-sentry-connection-\(connection.id)"
  }

  private var isDeleting: Bool {
    model.busy == "delete-sentry-connection-\(connection.id)"
  }

  var body: some View {
    HStack(spacing: 12) {
      Button {
        model.selectSentryConnection(connection.id)
      } label: {
        ZStack {
          Circle()
            .stroke(selected ? RCTheme.accentBlue : RCTheme.borderStrong, lineWidth: 1.6)
            .frame(width: 18, height: 18)
          if selected {
            Circle()
              .fill(RCTheme.accentBlue)
              .frame(width: 9, height: 9)
          }
        }
      }
      .buttonStyle(.plain)
      .frame(width: 28)
      .disabled(!sentryConnectionIsAssignable(connection))
      .help("Select \(sentryConnectionName(connection))")
      .accessibilityLabel("Select \(sentryConnectionName(connection))")

      VStack(alignment: .leading, spacing: 2) {
        HStack(spacing: 8) {
          Text(sentryConnectionName(connection))
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
        Text(sentryTokenPreview(connection))
          .font(.system(size: 11, weight: .semibold, design: .monospaced))
          .foregroundStyle(RCTheme.muted)
      }
      .frame(minWidth: 180, maxWidth: .infinity, alignment: .leading)

      Text(sentryOrganizationPreview(connection))
        .font(.system(size: 13, weight: .semibold))
        .foregroundStyle(RCTheme.muted)
        .lineLimit(1)
        .frame(width: 165, alignment: .leading)

      Text(sentryProjectPreview(connection))
        .font(.system(size: 12, weight: .semibold))
        .foregroundStyle(RCTheme.muted)
        .lineLimit(1)
        .frame(width: 140, alignment: .leading)

      Text(sentryLastCheckedText(connection))
        .font(.system(size: 12, weight: .semibold))
        .foregroundStyle(RCTheme.muted)
        .lineLimit(1)
        .frame(width: 120, alignment: .leading)

      HStack(spacing: 7) {
        Image(
          systemName: sentryConnectionIsReady(connection)
            ? "checkmark.circle.fill" : "exclamationmark.triangle.fill"
        )
        .foregroundStyle(
          sentryConnectionIsReady(connection) ? RCTheme.accentGreen : RCTheme.accentAmber)
        Text(sentryConnectionStatusText(connection))
          .font(.system(size: 12, weight: .semibold))
      }
      .frame(width: 100, alignment: .leading)

      HStack(spacing: 8) {
        Button {
          model.testSentryConnection(connection, for: app)
        } label: {
          if isTesting {
            ProgressView()
              .controlSize(.small)
              .scaleEffect(0.65)
          } else {
            Image(systemName: "arrow.triangle.2.circlepath")
          }
        }
        .buttonStyle(IconLightButtonStyle())
        .disabled(isTesting || model.providerConnectionSnapshot?.readOnly == true)
        .help("Check \(sentryConnectionName(connection))")
        .accessibilityLabel("Check \(sentryConnectionName(connection))")

        Button {
          model.deleteSentryConnection(connection, for: app)
        } label: {
          Image(systemName: "trash")
        }
        .buttonStyle(IconLightButtonStyle())
        .disabled(isDeleting || model.providerConnectionSnapshot?.readOnly == true)
        .help("Delete \(sentryConnectionName(connection))")
        .accessibilityLabel("Delete \(sentryConnectionName(connection))")
      }
      .frame(width: 92, alignment: .center)
    }
    .padding(.horizontal, 14)
    .frame(height: 52)
    .background(selected ? RCTheme.sidebarSelected.opacity(0.55) : Color.clear)
    .overlay(alignment: .top) {
      Rectangle().fill(selected ? RCTheme.accentBlue.opacity(0.55) : RCTheme.borderSoft).frame(
        height: selected ? 1.2 : 1)
    }
    .overlay(alignment: .bottom) {
      if selected {
        Rectangle().fill(RCTheme.accentBlue.opacity(0.55)).frame(height: 1.2)
      }
    }
  }
}

struct ApplicationsNotionDetailPanel: View {
  let app: MarketplaceCatalogApp

  var body: some View {
    VStack(spacing: 14) {
      ApplicationsExaHeroCard(app: app)
      ApplicationsNotionAgentsCard(app: app)
      ApplicationsNotionConnectionsCard(app: app)
      LazyVGrid(
        columns: [GridItem(.adaptive(minimum: 285), spacing: 14)], alignment: .leading, spacing: 14
      ) {
        ApplicationsExaInfoCard(
          icon: "doc.text.magnifyingglass",
          title: "Capabilities",
          items: app.capabilities,
          linkTitle: "Learn more about Notion API",
          linkURL: app.docsURL.flatMap(URL.init(string:))
        )
        ApplicationsExaInfoCard(
          icon: "lock.shield",
          title: "What Agents Can Do",
          items: [
            "Search Notion pages and data sources through Relay wrappers",
            "Fetch bounded page content for summaries and citations",
            "Create pages, append updates, and comment through approval or Direct writes",
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

struct ApplicationsNotionAgentsCard: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp

  private var selectedConnection: MarketplaceProviderConnection? {
    model.selectedProviderConnection
  }

  private var connections: [MarketplaceProviderConnection] {
    model.providerConnectionSnapshot?.connections ?? []
  }

  private var compatibleTargets: [MarketplaceCompatibleAgentTarget] {
    let query = model.notionAgentSearch.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
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
            icon: "person.2", title: "Agents with Notion",
            subtitle: "Select which agents should use the active Notion token.")
          Spacer()
          agentControls
        }
        VStack(alignment: .leading, spacing: 12) {
          ApplicationsExaSectionHeading(
            icon: "person.2", title: "Agents with Notion",
            subtitle: "Select which agents should use the active Notion token.")
          agentControls
        }
      }

      if compatibleTargets.isEmpty {
        EmptyMiniLight(
          title: "No available agents",
          body: "Notion can be installed on compatible Hermes and OpenClaw agents.")
      } else {
        if connections.isEmpty {
          ApplicationsExaInfoPill(text: "Save a Notion API token below before turning agents on.")
        }
        LazyVGrid(
          columns: [GridItem(.adaptive(minimum: 245), spacing: 12)], alignment: .leading,
          spacing: 12
        ) {
          ForEach(compatibleTargets) { target in
            ApplicationsNotionAgentSwitchRow(
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
          Text("of \(compatibleTargets.count) agents connected to Notion.")
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
      Text(selectedConnection.map(notionConnectionName) ?? "No token saved")
        .font(.system(size: 13, weight: .semibold))
        .padding(.horizontal, 12)
        .frame(height: 36)
        .background(RCTheme.surfaceInset)
        .clipShape(RoundedRectangle(cornerRadius: 7))
        .overlay(RoundedRectangle(cornerRadius: 7).stroke(RCTheme.borderSoft))
      ApplicationsExaSearchField(text: $model.notionAgentSearch, placeholder: "Search agents...")
        .frame(width: 250)
    }
  }

  private func activeInstall(for agentId: RelayId) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "notion" && exaInstallIsActive($0)
    }
  }

  private func displayName(for target: MarketplaceCompatibleAgentTarget) -> String {
    model.agents.first { $0.id == target.agentId }.map(model.resolveAgentDisplayName)
      ?? target.agentName
  }
}

struct ApplicationsNotionAgentSwitchRow: View {
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
    model.busy == "toggle-notion-agent-\(target.agentId)"
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
      return "Connect \(displayName) to Notion?"
    }
    return "Disconnect Notion for \(displayName)?"
  }

  private var confirmationMessage: String {
    if pendingConnectionState == true {
      return "This connects the agent to the Notion API token with Standard authority."
    }
    return "This removes the agent's access to the Notion API token."
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
          .help(isOn ? "Remove Notion from \(displayName)" : "Give \(displayName) access to Notion")
          .accessibilityLabel("\(isOn ? "Disconnect" : "Connect") \(displayName) from Notion")
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
        model.setNotionAgentConnection(target.agentId, enabled: enabled, for: app)
      }
    } message: {
      Text(confirmationMessage)
    }
  }
}
