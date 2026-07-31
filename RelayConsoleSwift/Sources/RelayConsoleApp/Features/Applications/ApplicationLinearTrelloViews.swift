import AppKit
import RelayConsoleCore
import SwiftUI
import UniformTypeIdentifiers

struct ApplicationsLinearDetailPanel: View {
  let app: MarketplaceCatalogApp

  var body: some View {
    VStack(spacing: 14) {
      ApplicationsExaHeroCard(app: app)
      ApplicationsLinearAgentsCard(app: app)
      ApplicationsLinearConnectionsCard(app: app)
      ApplicationsInfoCardsLayout {
        ApplicationsExaInfoCard(
          icon: "chevron.left.forwardslash.chevron.right",
          title: "Capabilities",
          items: app.capabilities,
          linkTitle: "Learn more about Linear API",
          linkURL: app.docsURL.flatMap(URL.init(string:))
        )
        ApplicationsExaInfoCard(
          icon: "lock.shield",
          title: "What Agents Can Do",
          items: [
            "Find and read bounded Linear teams, issues, comments, and projects",
            "Prepare issue changes locally without changing Linear",
            "Create or update issues and post comments through Safe approval or Direct writes",
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

struct ApplicationsLinearAgentsCard: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp

  private var selectedConnection: MarketplaceProviderConnection? {
    model.selectedProviderConnection
  }

  private var connections: [MarketplaceProviderConnection] {
    model.providerConnectionSnapshot?.connections ?? []
  }

  private var compatibleTargets: [MarketplaceCompatibleAgentTarget] {
    let query = model.linearAgentSearch.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
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
            icon: "person.2", title: "Agents with Linear",
            subtitle: "Select which agents should use the active Linear OAuth connection.")
          Spacer()
          agentControls
        }
        VStack(alignment: .leading, spacing: 12) {
          ApplicationsExaSectionHeading(
            icon: "person.2", title: "Agents with Linear",
            subtitle: "Select which agents should use the active Linear OAuth connection.")
          agentControls
        }
      }

      if compatibleTargets.isEmpty {
        EmptyMiniLight(
          title: "No available agents",
          body: "Linear can be installed on compatible Hermes and OpenClaw agents.")
      } else {
        if connections.isEmpty {
          ApplicationsExaInfoPill(text: "Connect Linear below before turning agents on.")
        }
        ApplicationsAgentGridScroll {
          ForEach(compatibleTargets) { target in
            ApplicationsLinearAgentSwitchRow(
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
          Text("of \(compatibleTargets.count) agents connected to Linear.")
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
      Text(selectedConnection.map(linearConnectionName) ?? "No account saved")
        .font(.system(size: 13, weight: .semibold))
        .padding(.horizontal, 12)
        .frame(height: 36)
        .background(RCTheme.surfaceInset)
        .clipShape(RoundedRectangle(cornerRadius: 7))
        .overlay(RoundedRectangle(cornerRadius: 7).stroke(RCTheme.borderSoft))
      ApplicationsExaSearchField(text: $model.linearAgentSearch, placeholder: "Search agents...")
        .frame(width: 250)
    }
  }

  private func activeInstall(for agentId: RelayId) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "linear" && exaInstallIsActive($0)
    }
  }

  private func displayName(for target: MarketplaceCompatibleAgentTarget) -> String {
    model.agents.first { $0.id == target.agentId }.map(model.resolveAgentDisplayName)
      ?? target.agentName
  }
}

struct ApplicationsLinearAgentSwitchRow: View {
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
    model.busy == "toggle-linear-agent-\(target.agentId)"
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
      return "Connect \(displayName) to Linear?"
    }
    return "Disconnect Linear for \(displayName)?"
  }

  private var confirmationMessage: String {
    if pendingConnectionState == true {
      return "This connects the agent to the Linear workspace or team with Standard authority."
    }
    return "This removes the agent's access to the Linear workspace or team."
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
          .help(isOn ? "Remove Linear from \(displayName)" : "Give \(displayName) access to Linear")
          .accessibilityLabel("\(isOn ? "Disconnect" : "Connect") \(displayName) from Linear")
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
        model.setLinearAgentConnection(target.agentId, enabled: enabled, for: app)
      }
    } message: {
      Text(confirmationMessage)
    }
  }
}

struct ApplicationsLinearConnectionsCard: View {
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
          subtitle: "Connect a Linear workspace or team through Relay-owned OAuth.")
        Spacer()
        ApplicationsExaInfoPill(
          text: "Railway stores and refreshes the Linear connection securely.")
      }

      VStack(alignment: .leading, spacing: 14) {
        connectForm
        connectionTable
      }

      if let status = model.linearConnectionStatus?.nilIfEmpty {
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
          Text("Linear account")
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(RCTheme.muted)
          Text(selectedConnection.map(linearAccountPreview) ?? "No account connected")
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
            model.startLinearOAuthConnect(for: app)
          } label: {
            HStack(spacing: 8) {
              Image(systemName: "link.badge.plus")
              Text(selectedConnection == nil ? "Connect Linear" : "Reconnect Linear")
            }
          }
          .buttonStyle(PrimaryLightButtonStyle())
          .frame(maxWidth: .infinity)
          .disabled(model.busy != nil || model.workspace == nil)
          .help("Open Linear's secure authorization page")
        }
      }
      Text(
        "Sign in to Linear, choose a workspace, and approve read and write access."
      )
      .font(.system(size: 12, weight: .semibold))
      .foregroundStyle(RCTheme.muted)
      HStack(spacing: 7) {
        Image(systemName: "lock")
        Text("Your Linear password is never shared with Relay Console.")
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
      ApplicationsLinearConnectionHeader()
      if connections.isEmpty {
        EmptyMiniLight(
          title: "No Linear OAuth connection", body: "Connect Linear before assigning agents."
        )
        .padding(.vertical, 22)
      } else {
        ForEach(connections) { connection in
          ApplicationsLinearConnectionRow(
            connection: connection,
            selected: selectedConnection?.id == connection.id
          )
        }
      }
      HStack(spacing: 8) {
        Image(systemName: "lightbulb")
          .foregroundStyle(RCTheme.muted)
        Text("Reconnect Linear when the OAuth grant changes or is revoked.")
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

struct ApplicationsLinearConnectionHeader: View {
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

struct ApplicationsLinearConnectionRow: View {
  let connection: MarketplaceProviderConnection
  let selected: Bool

  var body: some View {
    HStack(spacing: 12) {
      HStack(spacing: 8) {
        Text(linearConnectionName(connection))
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

      Text(linearAccountPreview(connection))
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
          systemName: linearConnectionIsValid(connection)
            ? "checkmark.circle.fill" : "exclamationmark.triangle.fill"
        )
        .foregroundStyle(
          linearConnectionIsValid(connection) ? RCTheme.accentGreen : RCTheme.accentAmber)
        Text(linearConnectionStatusText(connection))
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

struct ApplicationsTrelloDetailPanel: View {
  let app: MarketplaceCatalogApp
  var body: some View {
    VStack(spacing: 14) {
      ApplicationsExaHeroCard(app: app)
      ApplicationsTrelloAgentsCard(app: app)
      ApplicationsTrelloConnectionsCard(app: app)
      ApplicationsInfoCardsLayout {
        ApplicationsExaInfoCard(
          icon: "rectangle.split.3x1", title: "Capabilities", items: app.capabilities,
          linkTitle: "Learn more about the Trello API",
          linkURL: app.docsURL.flatMap(URL.init(string:)))
        ApplicationsExaInfoCard(
          icon: "person.crop.circle.badge.checkmark", title: "What Agents Can Do",
          items: [
            "Discover accessible Trello boards",
            "Read bounded board, list, card, member, label, and due-date context",
            "Prepare and perform reviewed card creation, updates, or comments",
          ], linkTitle: nil, linkURL: nil)
        ApplicationsExaInfoCard(
          icon: "lock.shield", title: "Requirements",
          items: marketplaceConnectionRequirements(for: app), linkTitle: nil, linkURL: nil)
      }
    }
  }
}

struct ApplicationsTrelloAgentsCard: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp
  private var connection: MarketplaceProviderConnection? { model.selectedProviderConnection }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    let q = model.trelloAgentSearch.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    return model.visibleMarketplaceCompatibleAgents.filter {
      app.runtimeSupport.contains($0.runtimeType)
    }.filter { q.isEmpty || name($0).lowercased().contains(q) }.sorted { name($0) < name($1) }
  }
  var body: some View {
    ApplicationsExaPanel {
      ViewThatFits(in: .horizontal) {
        HStack(alignment: .top) {
          ApplicationsExaSectionHeading(
            icon: "person.2", title: "Agents with Trello",
            subtitle: "Select which agents should use the active Trello connection.")
          Spacer()
          controls
        }
        VStack(alignment: .leading, spacing: 12) {
          ApplicationsExaSectionHeading(
            icon: "person.2", title: "Agents with Trello",
            subtitle: "Select which agents should use the active Trello connection.")
          controls
        }
      }
      if connection == nil {
        ApplicationsExaInfoPill(text: "Connect Trello below before turning agents on.")
      }
      if targets.isEmpty {
        EmptyMiniLight(
          title: "No available agents",
          body: "Trello can be assigned to compatible Hermes and OpenClaw agents.")
      } else {
        ApplicationsAgentGridScroll {
          ForEach(targets) { target in
            let install = active(target.agentId)
            ApplicationsTrelloAgentSwitchRow(
              app: app, target: target, install: install,
              isOn: connection != nil && install?.connectionId == connection?.id,
              disabled: connection == nil || target.status != .compatible)
          }
        }
      }
    }
  }
  private var controls: some View {
    HStack {
      Text(connection.map(trelloConnectionName) ?? "No account saved").font(
        .system(size: 13, weight: .semibold))
      ApplicationsExaSearchField(text: $model.trelloAgentSearch, placeholder: "Search agents...")
        .frame(width: 250)
    }
  }
  private func name(_ target: MarketplaceCompatibleAgentTarget) -> String {
    model.agents.first { $0.id == target.agentId }.map(model.resolveAgentDisplayName)
      ?? target.agentName
  }
  private func active(_ id: RelayId) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == id && $0.appSlug == "trello"
        && ($0.installStatus == .installed || $0.installStatus == .requested)
    }
  }
}

struct ApplicationsTrelloAgentSwitchRow: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp
  let target: MarketplaceCompatibleAgentTarget
  let install: MarketplaceInstallRecord?
  let isOn: Bool
  let disabled: Bool
  @State private var pending: Bool?
  private var name: String {
    model.agents.first { $0.id == target.agentId }.map(model.resolveAgentDisplayName)
      ?? target.agentName
  }
  private var alertBinding: Binding<Bool> {
    Binding(get: { pending != nil }, set: { if !$0 { pending = nil } })
  }
  var body: some View {
    VStack(alignment: .leading, spacing: 9) {
      HStack(spacing: 12) {
        AgentAvatarView(name: name, avatarURL: model.agentAvatar(target.agentId), size: 38)
        VStack(alignment: .leading) {
          Text(name).font(.system(size: 13, weight: .semibold))
          Text(exaRuntimeLabel(target.runtimeType)).font(.system(size: 12)).foregroundStyle(
            RCTheme.muted)
        }
        Spacer()
        Button {
          pending = !isOn
        } label: {
          ApplicationsExaSwitch(isOn: isOn)
        }.buttonStyle(.plain).disabled(
          disabled || model.busy == "toggle-trello-agent-\(target.agentId)"
        ).accessibilityLabel("\(isOn ? "Disconnect" : "Connect") \(name) from Trello")
      }
      ApplicationsAgentAuthorityRow(
        app: app, install: install,
        selectedPreset: install.flatMap { model.marketplaceActionPolicyPreset(for: $0) }
          ?? .approvalRequired, muted: !isOn)
    }
    .padding(12).background(isOn ? RCTheme.sidebarSelected.opacity(0.48) : RCTheme.surfaceInset)
    .clipShape(RoundedRectangle(cornerRadius: 8)).opacity(disabled && !isOn ? 0.72 : 1)
    .alert(
      pending == true ? "Connect \(name) to Trello?" : "Disconnect Trello for \(name)?",
      isPresented: alertBinding
    ) {
      Button("Cancel", role: .cancel) { pending = nil }
      Button(pending == true ? "Connect" : "Disconnect", role: pending == true ? nil : .destructive)
      {
        let enabled = pending ?? !isOn
        pending = nil
        model.setTrelloAgentConnection(target.agentId, enabled: enabled, for: app)
      }
    } message: {
      Text(
        pending == true
          ? "This connects the agent with Standard authority."
          : "This removes the agent's Trello access.")
    }
  }
}

struct ApplicationsTrelloConnectionsCard: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp
  private var connections: [MarketplaceProviderConnection] {
    model.providerConnectionSnapshot?.connections ?? []
  }
  private var selected: MarketplaceProviderConnection? { model.selectedProviderConnection }
  var body: some View {
    ApplicationsExaPanel {
      HStack(alignment: .top) {
        ApplicationsExaSectionHeading(
          icon: "key", title: "Manage API Connection",
          subtitle: "Connect a Trello account securely, then choose which agents may use it.")
        Spacer()
        ApplicationsExaInfoPill(
          text: "Your Trello authorization is stored securely and never shown to agents.")
      }
      ApplicationsConnectionFormGrid {
        VStack(alignment: .leading, spacing: 8) {
          Text("Trello member / Workspace").font(.system(size: 12, weight: .semibold))
            .foregroundStyle(RCTheme.muted)
          Text(selected.map(trelloAccountPreview) ?? "No member authorized").font(
            .system(size: 13, weight: .bold)
          ).frame(maxWidth: .infinity, minHeight: 36, alignment: .leading).padding(.horizontal, 11)
            .background(RCTheme.fieldBackground).clipShape(RoundedRectangle(cornerRadius: 7))
        }
        VStack(alignment: .leading, spacing: 8) {
          Text("Authorization flow").font(.system(size: 12, weight: .semibold)).foregroundStyle(
            RCTheme.muted)
          Button {
            model.startTrelloOAuthConnect(for: app)
          } label: {
            Label(
              selected == nil ? "Connect Trello" : "Reconnect Trello",
              systemImage: "link.badge.plus")
          }.buttonStyle(PrimaryLightButtonStyle()).disabled(
            model.busy == "connect-trello-oauth" || model.workspace == nil)
        }
      }
      Text(
        "Sign in to Trello, review the requested read and write access, and approve. You will return to Relay Console automatically."
      ).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
      VStack(spacing: 0) {
        ApplicationsTrelloConnectionHeader()
        if connections.isEmpty {
          EmptyMiniLight(
            title: "No Trello connection", body: "Connect Trello before assigning agents."
          ).padding(.vertical, 22)
        } else {
          ForEach(connections) { connection in
            ApplicationsTrelloConnectionRow(
              connection: connection, selected: selected?.id == connection.id,
              onSelect: { model.selectTrelloConnection(connection.id) },
              onDelete: { model.deleteTrelloConnection(connection, for: app) })
          }
        }
      }.background(RCTheme.surfaceInset).clipShape(RoundedRectangle(cornerRadius: 8)).overlay(
        RoundedRectangle(cornerRadius: 8).stroke(RCTheme.borderSoft))
      if let status = model.trelloConnectionStatus?.nilIfEmpty {
        Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
      }
    }
  }
}

struct ApplicationsTrelloConnectionHeader: View {
  var body: some View {
    HStack {
      Text("Connection").frame(maxWidth: .infinity, alignment: .leading)
      Text("Member / Workspace").frame(width: 190, alignment: .leading)
      Text("Permissions").frame(width: 90)
      Text("Status").frame(width: 90)
      Text("Actions").frame(width: 130)
    }.font(.system(size: 11, weight: .bold)).foregroundStyle(RCTheme.muted).padding(.horizontal, 14)
      .frame(height: 36)
  }
}

struct ApplicationsTrelloConnectionRow: View {
  let connection: MarketplaceProviderConnection
  let selected: Bool
  let onSelect: () -> Void
  let onDelete: () -> Void
  var body: some View {
    HStack {
      HStack {
        Button(action: onSelect) {
          Image(systemName: selected ? "largecircle.fill.circle" : "circle")
        }.buttonStyle(.plain)
        Text(trelloConnectionName(connection)).font(.system(size: 13, weight: .bold))
        if selected {
          Text("ACTIVE").font(.system(size: 9, weight: .bold)).foregroundStyle(RCTheme.accentBlue)
        }
      }.frame(maxWidth: .infinity, alignment: .leading)
      Text(trelloAccountPreview(connection)).lineLimit(1).frame(width: 190, alignment: .leading)
      Text("\(connection.grantedScopes.count)").frame(width: 90)
      Text(trelloConnectionStatusText(connection)).frame(width: 90)
      HStack {
        Button("Select", action: onSelect).disabled(selected)
        Button("Delete", role: .destructive, action: onDelete)
      }.frame(width: 130)
    }.font(.system(size: 12, weight: .semibold)).padding(.horizontal, 14).frame(height: 48)
      .background(selected ? RCTheme.sidebarSelected.opacity(0.55) : Color.clear).overlay(
        alignment: .top
      ) { Rectangle().fill(RCTheme.borderSoft).frame(height: 1) }
  }
}
