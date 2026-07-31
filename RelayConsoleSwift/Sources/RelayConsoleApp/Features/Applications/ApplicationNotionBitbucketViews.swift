import AppKit
import RelayConsoleCore
import SwiftUI
import UniformTypeIdentifiers

struct ApplicationsNotionConnectionsCard: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp

  private var connections: [MarketplaceProviderConnection] {
    model.providerConnectionSnapshot?.connections ?? []
  }

  private var selectedConnection: MarketplaceProviderConnection? {
    model.selectedProviderConnection
  }

  private var canSave: Bool {
    model.notionAPITokenDraft.nilIfEmpty != nil
      && model.busy != "save-notion-api-token"
  }

  var body: some View {
    ApplicationsExaPanel {
      HStack(alignment: .top, spacing: 14) {
        ApplicationsExaSectionHeading(
          icon: "key", title: "Manage API Connection",
          subtitle: "Connect your Notion workspace securely with one click.")
        Spacer()
        ApplicationsExaInfoPill(
          text: "Your Notion access stays encrypted and is never shown to agents.")
      }

      VStack(alignment: .leading, spacing: 10) {
        Button {
          model.startNotionOAuthConnect(for: app)
        } label: {
          HStack(spacing: 8) {
            Image(systemName: "link.badge.plus")
            Text(selectedConnection == nil ? "Connect Notion" : "Reconnect Notion")
          }
        }
        .buttonStyle(PrimaryLightButtonStyle())
        .disabled(
          model.providerConnectionSnapshot?.readOnly == true || app.availability != .available)
        Text("Notion will ask you to choose which workspace pages Relay Console can access.")
          .font(.system(size: 12, weight: .semibold))
          .foregroundStyle(RCTheme.muted)
      }
      .padding(16)
      .frame(maxWidth: .infinity, alignment: .leading)
      .background(RCTheme.surfaceInset)
      .clipShape(RoundedRectangle(cornerRadius: 8))
      .overlay(RoundedRectangle(cornerRadius: 8).stroke(RCTheme.borderSoft))

      ViewThatFits(in: .horizontal) {
        HStack(alignment: .top, spacing: 24) {
          tokenForm
          connectionTable
        }
        VStack(alignment: .leading, spacing: 14) {
          tokenForm
          connectionTable
        }
      }

      if let status = model.notionConnectionStatus?.nilIfEmpty {
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

  private var tokenForm: some View {
    VStack(alignment: .leading, spacing: 12) {
      Text("Local Mac connection")
        .font(.system(size: 15, weight: .bold))
      Text(
        "Optional for a fully local Mac. Cloud-linked Mac, iPhone, and web use Connect Notion above."
      )
      .font(.system(size: 11, weight: .semibold))
      .foregroundStyle(RCTheme.muted)
      ApplicationsExaInput(
        label: "Connection name optional", placeholder: "Workspace token",
        text: $model.notionConnectionNameDraft, secure: false)
      VStack(alignment: .leading, spacing: 6) {
        Text("Credential mode")
          .font(.system(size: 12, weight: .semibold))
          .foregroundStyle(RCTheme.muted)
        Picker("Credential mode", selection: $model.notionCredentialModeDraft) {
          Text("Personal access token").tag("personal_access_token")
          Text("Internal connection token").tag("internal_connection_token")
        }
        .labelsHidden()
        .pickerStyle(.segmented)
      }
      ApplicationsExaInput(
        label: "Notion API token", placeholder: "ntn_...", text: $model.notionAPITokenDraft,
        secure: true)
      ApplicationsExaInput(
        label: "Workspace label optional", placeholder: "Workspace name",
        text: $model.notionWorkspaceLabelDraft, secure: false)
      Button {
        model.saveNotionAPIToken(for: app)
      } label: {
        if model.busy == "save-notion-api-token" {
          HStack(spacing: 7) {
            ProgressView()
              .controlSize(.small)
              .scaleEffect(0.75)
            Text("Saving...")
          }
        } else {
          Text(connections.isEmpty ? "Add connection" : "Replace token")
        }
      }
      .buttonStyle(PrimaryLightButtonStyle())
      .frame(maxWidth: .infinity)
      .disabled(
        !canSave || model.providerConnectionSnapshot?.readOnly == true
          || app.availability != .available)
      HStack(spacing: 7) {
        Image(systemName: "lock")
        Text("The token is stored securely in your local Keychain.")
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
        ApplicationsNotionConnectionHeader()
        if connections.isEmpty {
          EmptyMiniLight(
            title: "No Notion API token",
            body: "Add a user-owned Notion API token before assigning agents."
          )
          .padding(.vertical, 22)
        } else {
          ForEach(connections) { connection in
            ApplicationsNotionConnectionRow(
              app: app,
              connection: connection,
              selected: selectedConnection?.id == connection.id
            )
          }
        }
        HStack(spacing: 8) {
          Image(systemName: "lightbulb")
            .foregroundStyle(RCTheme.muted)
          Text("Replace the token when Notion access changes or the user revokes the integration.")
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
      .frame(minWidth: 760, alignment: .topLeading)
    }
    .frame(maxWidth: .infinity, alignment: .topLeading)
    .background(RCTheme.surfaceInset)
    .clipShape(RoundedRectangle(cornerRadius: 8))
    .overlay(RoundedRectangle(cornerRadius: 8).stroke(RCTheme.borderSoft))
  }
}

struct ApplicationsNotionConnectionHeader: View {
  var body: some View {
    HStack(spacing: 12) {
      Text("")
        .frame(width: 28)
      Text("Connection name")
        .frame(minWidth: 180, maxWidth: .infinity, alignment: .leading)
      Text("Workspace")
        .frame(width: 150, alignment: .leading)
      Text("Mode")
        .frame(width: 150, alignment: .leading)
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

struct ApplicationsNotionConnectionRow: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp
  let connection: MarketplaceProviderConnection
  let selected: Bool

  private var isDeleting: Bool {
    model.busy == "delete-notion-connection-\(connection.id)"
  }

  private var isTesting: Bool {
    model.busy == "test-notion-connection-\(connection.id)"
  }

  var body: some View {
    HStack(spacing: 12) {
      Button {
        model.selectNotionConnection(connection.id)
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
      .disabled(!notionConnectionIsValid(connection))
      .help("Select \(notionConnectionName(connection))")
      .accessibilityLabel("Select \(notionConnectionName(connection))")

      VStack(alignment: .leading, spacing: 2) {
        HStack(spacing: 8) {
          Text(notionConnectionName(connection))
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
        Text(notionTokenPreview(connection))
          .font(.system(size: 11, weight: .semibold, design: .monospaced))
          .foregroundStyle(RCTheme.muted)
      }
      .frame(minWidth: 180, maxWidth: .infinity, alignment: .leading)

      Text(notionWorkspacePreview(connection))
        .font(.system(size: 13, weight: .semibold))
        .foregroundStyle(RCTheme.muted)
        .lineLimit(1)
        .frame(width: 150, alignment: .leading)

      Text(notionCredentialModeLabel(connection))
        .font(.system(size: 12, weight: .semibold))
        .foregroundStyle(RCTheme.muted)
        .lineLimit(1)
        .frame(width: 150, alignment: .leading)

      HStack(spacing: 7) {
        Image(
          systemName: notionConnectionIsValid(connection)
            ? "checkmark.circle.fill" : "exclamationmark.triangle.fill"
        )
        .foregroundStyle(
          notionConnectionIsValid(connection) ? RCTheme.accentGreen : RCTheme.accentAmber)
        Text(notionConnectionStatusText(connection))
          .font(.system(size: 12, weight: .semibold))
      }
      .frame(width: 110, alignment: .leading)

      HStack(spacing: 8) {
        Button {
          model.testNotionConnection(connection, for: app)
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
        .help("Test \(notionConnectionName(connection))")
        .accessibilityLabel("Test \(notionConnectionName(connection))")

        Button {
          model.deleteNotionConnection(connection, for: app)
        } label: {
          Image(systemName: "trash")
        }
        .buttonStyle(IconLightButtonStyle())
        .disabled(isDeleting || model.providerConnectionSnapshot?.readOnly == true)
        .help("Delete \(notionConnectionName(connection))")
        .accessibilityLabel("Delete \(notionConnectionName(connection))")
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

struct ApplicationsBitbucketDetailPanel: View {
  let app: MarketplaceCatalogApp

  var body: some View {
    VStack(spacing: 14) {
      ApplicationsExaHeroCard(app: app)
      ApplicationsBitbucketAgentsCard(app: app)
      ApplicationsBitbucketConnectionsCard(app: app)
      ApplicationsInfoCardsLayout {
        ApplicationsExaInfoCard(
          icon: "chevron.left.forwardslash.chevron.right",
          title: "Capabilities",
          items: app.capabilities,
          linkTitle: "Learn more about Bitbucket API",
          linkURL: app.docsURL.flatMap(URL.init(string:))
        )
        ApplicationsExaInfoCard(
          icon: "lock.shield",
          title: "What Agents Can Do",
          items: [
            "Search accessible Bitbucket repositories through Relay wrappers",
            "Read bounded issue and pull request context",
            "Prepare and post approved Bitbucket comments",
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

struct ApplicationsBitbucketAgentsCard: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp

  private var selectedConnection: MarketplaceProviderConnection? {
    model.selectedProviderConnection
  }

  private var connections: [MarketplaceProviderConnection] {
    model.providerConnectionSnapshot?.connections ?? []
  }

  private var compatibleTargets: [MarketplaceCompatibleAgentTarget] {
    let query = model.bitbucketAgentSearch.trimmingCharacters(in: .whitespacesAndNewlines)
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
            icon: "person.2", title: "Agents with Bitbucket",
            subtitle: "Select which agents should use the active Bitbucket OAuth connection.")
          Spacer()
          agentControls
        }
        VStack(alignment: .leading, spacing: 12) {
          ApplicationsExaSectionHeading(
            icon: "person.2", title: "Agents with Bitbucket",
            subtitle: "Select which agents should use the active Bitbucket OAuth connection.")
          agentControls
        }
      }

      if compatibleTargets.isEmpty {
        EmptyMiniLight(
          title: "No available agents",
          body: "Bitbucket can be installed on compatible Hermes and OpenClaw agents.")
      } else {
        if connections.isEmpty {
          ApplicationsExaInfoPill(text: "Connect Bitbucket below before turning agents on.")
        }
        ApplicationsAgentGridScroll {
          ForEach(compatibleTargets) { target in
            ApplicationsBitbucketAgentSwitchRow(
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
          Text("of \(compatibleTargets.count) agents connected to Bitbucket.")
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
      Text(selectedConnection.map(bitbucketConnectionName) ?? "No account saved")
        .font(.system(size: 13, weight: .semibold))
        .padding(.horizontal, 12)
        .frame(height: 36)
        .background(RCTheme.surfaceInset)
        .clipShape(RoundedRectangle(cornerRadius: 7))
        .overlay(RoundedRectangle(cornerRadius: 7).stroke(RCTheme.borderSoft))
      ApplicationsExaSearchField(text: $model.bitbucketAgentSearch, placeholder: "Search agents...")
        .frame(width: 250)
    }
  }

  private func activeInstall(for agentId: RelayId) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "bitbucket" && exaInstallIsActive($0)
    }
  }

  private func displayName(for target: MarketplaceCompatibleAgentTarget) -> String {
    model.agents.first { $0.id == target.agentId }.map(model.resolveAgentDisplayName)
      ?? target.agentName
  }
}

struct ApplicationsBitbucketAgentSwitchRow: View {
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
    model.busy == "toggle-bitbucket-agent-\(target.agentId)"
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
      return "Connect \(displayName) to Bitbucket?"
    }
    return "Disconnect Bitbucket for \(displayName)?"
  }

  private var confirmationMessage: String {
    if pendingConnectionState == true {
      return
        "This connects the agent to the Bitbucket account, group, or repository with Standard authority."
    }
    return "This removes the agent's access to the Bitbucket account, group, or repository."
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
              ? "Remove Bitbucket from \(displayName)" : "Give \(displayName) access to Bitbucket"
          )
          .accessibilityLabel("\(isOn ? "Disconnect" : "Connect") \(displayName) from Bitbucket")
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
        model.setBitbucketAgentConnection(target.agentId, enabled: enabled, for: app)
      }
    } message: {
      Text(confirmationMessage)
    }
  }
}

struct ApplicationsBitbucketConnectionsCard: View {
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
          subtitle: "Connect your Bitbucket account securely with one click.")
        Spacer()
        ApplicationsExaInfoPill(
          text: "Your Bitbucket access stays encrypted and is never shown to agents.")
      }

      VStack(alignment: .leading, spacing: 14) {
        connectForm
        connectionTable
      }

      if let status = model.bitbucketConnectionStatus?.nilIfEmpty {
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
          Text("Bitbucket account")
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(RCTheme.muted)
          Text(selectedConnection.map(bitbucketAccountPreview) ?? "No account connected")
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
            model.startBitbucketOAuthConnect(for: app)
          } label: {
            HStack(spacing: 8) {
              Image(systemName: "link.badge.plus")
              Text(selectedConnection == nil ? "Connect Bitbucket" : "Reconnect Bitbucket")
            }
          }
          .buttonStyle(PrimaryLightButtonStyle())
          .frame(maxWidth: .infinity)
          .disabled(model.providerConnectionSnapshot?.readOnly == true)
          .help("Open Bitbucket to approve access")
        }
      }
      Text(
        "Bitbucket will show the permissions Relay Console is requesting before you approve the connection."
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
      ApplicationsBitbucketConnectionHeader()
      if connections.isEmpty {
        EmptyMiniLight(
          title: "No Bitbucket OAuth connection", body: "Connect Bitbucket before assigning agents."
        )
        .padding(.vertical, 22)
      } else {
        ForEach(connections) { connection in
          ApplicationsBitbucketConnectionRow(
            connection: connection,
            selected: selectedConnection?.id == connection.id
          )
        }
      }
      HStack(spacing: 8) {
        Image(systemName: "lightbulb")
          .foregroundStyle(RCTheme.muted)
        Text("Reconnect Bitbucket when the OAuth grant changes or is revoked.")
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

struct ApplicationsBitbucketConnectionHeader: View {
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

struct ApplicationsBitbucketConnectionRow: View {
  let connection: MarketplaceProviderConnection
  let selected: Bool

  var body: some View {
    HStack(spacing: 12) {
      HStack(spacing: 8) {
        Text(bitbucketConnectionName(connection))
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

      Text(bitbucketAccountPreview(connection))
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
          systemName: bitbucketConnectionIsValid(connection)
            ? "checkmark.circle.fill" : "exclamationmark.triangle.fill"
        )
        .foregroundStyle(
          bitbucketConnectionIsValid(connection) ? RCTheme.accentGreen : RCTheme.accentAmber)
        Text(bitbucketConnectionStatusText(connection))
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
