import AppKit
import RelayConsoleCore
import SwiftUI
import UniformTypeIdentifiers

struct ApplicationsAsanaAgentSwitchRow: View {
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
  private var busy: Bool { model.busy == "toggle-asana-agent-\(target.agentId)" }
  private var controlsDisabled: Bool {
    disabled || busy || model.providerConnectionSnapshot?.readOnly == true
      || app.availability != .available
  }
  private var confirmationBinding: Binding<Bool> {
    Binding(
      get: { pendingConnectionState != nil }, set: { if !$0 { pendingConnectionState = nil } })
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 9) {
      HStack(spacing: 12) {
        AgentAvatarView(name: displayName, avatarURL: model.agentAvatar(target.agentId), size: 38)
        VStack(alignment: .leading, spacing: 3) {
          Text(displayName).font(.system(size: 13, weight: .semibold)).lineLimit(1)
          Text(
            target.status == .compatible
              ? exaRuntimeLabel(target.runtimeType) : (target.unavailableReason ?? "Unavailable")
          )
          .font(.system(size: 12, weight: .semibold)).foregroundStyle(
            target.status == .compatible ? RCTheme.muted : RCTheme.accentAmber
          ).lineLimit(1)
        }
        Spacer(minLength: 8)
        if busy {
          ProgressView().controlSize(.small).scaleEffect(0.75).frame(width: 32, height: 20)
        } else {
          Button {
            pendingConnectionState = !isOn
          } label: {
            ApplicationsExaSwitch(isOn: isOn)
          }
          .buttonStyle(.plain).disabled(controlsDisabled)
          .help(isOn ? "Remove Asana from \(displayName)" : "Give \(displayName) access to Asana")
          .accessibilityLabel("\(isOn ? "Disconnect" : "Connect") \(displayName) from Asana")
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
    .padding(.horizontal, 12).padding(.vertical, 10).frame(minHeight: 86)
    .background(isOn ? RCTheme.sidebarSelected.opacity(0.48) : RCTheme.surfaceInset)
    .clipShape(RoundedRectangle(cornerRadius: 8))
    .overlay(
      RoundedRectangle(cornerRadius: 8).stroke(
        isOn ? RCTheme.accentGreen.opacity(0.35) : RCTheme.borderSoft)
    )
    .opacity(disabled && !isOn ? 0.72 : 1)
    .alert(
      pendingConnectionState == true
        ? "Connect \(displayName) to Asana?" : "Disconnect Asana for \(displayName)?",
      isPresented: confirmationBinding
    ) {
      Button("Cancel", role: .cancel) { pendingConnectionState = nil }
      Button(
        pendingConnectionState == true ? "Connect" : "Disconnect",
        role: pendingConnectionState == true ? nil : .destructive
      ) {
        let enabled = pendingConnectionState ?? !isOn
        pendingConnectionState = nil
        model.setAsanaAgentConnection(target.agentId, enabled: enabled, for: app)
      }
    } message: {
      Text(
        pendingConnectionState == true
          ? "This connects the agent to the Asana workspace with Standard authority."
          : "This removes the agent's access to the Asana workspace.")
    }
  }
}

struct ApplicationsAsanaConnectionsCard: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp
  private var connections: [MarketplaceProviderConnection] {
    model.providerConnectionSnapshot?.connections ?? []
  }
  private var selected: MarketplaceProviderConnection? { model.selectedProviderConnection }

  var body: some View {
    ApplicationsExaPanel {
      HStack(alignment: .top, spacing: 14) {
        ApplicationsExaSectionHeading(
          icon: "key", title: "Manage API Connection",
          subtitle: "Connect an Asana account and workspace through Relay-owned OAuth.")
        Spacer()
        ApplicationsExaInfoPill(text: "Relay Console stores and refreshes the connection securely.")
      }
      VStack(alignment: .leading, spacing: 14) {
        connectForm
        connectionTable
      }
      if let status = model.asanaConnectionStatus?.nilIfEmpty {
        HStack(spacing: 8) {
          Image(
            systemName: status.localizedCaseInsensitiveContains("connected")
              ? "checkmark.circle.fill" : "info.circle"
          )
          .foregroundStyle(
            status.localizedCaseInsensitiveContains("connected")
              ? RCTheme.accentGreen : RCTheme.accentAmber)
          Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
          Spacer()
        }
      }
    }
  }

  private var connectForm: some View {
    VStack(alignment: .leading, spacing: 12) {
      ApplicationsConnectionFormGrid {
        VStack(alignment: .leading, spacing: 8) {
          Text("Asana workspace").font(.system(size: 12, weight: .semibold)).foregroundStyle(
            RCTheme.muted)
          Text(selected.map(asanaAccountPreview) ?? "No workspace connected")
            .font(.system(size: 13, weight: .bold)).frame(
              maxWidth: .infinity, minHeight: 36, alignment: .leading
            )
            .padding(.horizontal, 11).background(RCTheme.fieldBackground).clipShape(
              RoundedRectangle(cornerRadius: 7)
            )
            .overlay(RoundedRectangle(cornerRadius: 7).stroke(RCTheme.borderSoft))
        }
        VStack(alignment: .leading, spacing: 8) {
          Text("OAuth flow").font(.system(size: 12, weight: .semibold)).foregroundStyle(
            RCTheme.muted)
          Button {
            model.startAsanaOAuthConnect(for: app)
          } label: {
            HStack(spacing: 8) {
              Image(systemName: "link.badge.plus")
              Text(selected == nil ? "Connect Asana" : "Reconnect Asana")
            }
          }
          .buttonStyle(PrimaryLightButtonStyle()).frame(maxWidth: .infinity)
          .disabled(model.busy != nil || model.workspace == nil)
          .help("Open Asana's secure authorization page")
        }
      }
      Text(
        "Sign in to Asana, approve task and project access, and return here automatically."
      )
      .font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
    }
    .padding(16).frame(maxWidth: .infinity, alignment: .topLeading).background(RCTheme.surfaceInset)
    .clipShape(RoundedRectangle(cornerRadius: 8)).overlay(
      RoundedRectangle(cornerRadius: 8).stroke(RCTheme.borderSoft))
  }

  private var connectionTable: some View {
    VStack(spacing: 0) {
      ApplicationsAsanaConnectionHeader()
      if connections.isEmpty {
        EmptyMiniLight(
          title: "No Asana OAuth connection", body: "Connect Asana before assigning agents."
        ).padding(.vertical, 22)
      } else {
        ForEach(connections) { connection in
          ApplicationsAsanaConnectionRow(
            connection: connection,
            selected: selected?.id == connection.id,
            onSelect: { model.selectAsanaConnection(connection.id) },
            onDelete: { model.deleteAsanaOAuthConnection(connection, for: app) }
          )
        }
      }
      HStack(spacing: 8) {
        Image(systemName: "lightbulb").foregroundStyle(RCTheme.muted)
        Text("Select one active workspace grant; reconnect after scope or authorization changes.")
          .font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        Spacer()
      }
      .padding(.horizontal, 14).frame(height: 38).overlay(alignment: .top) {
        Rectangle().fill(RCTheme.borderSoft).frame(height: 1)
      }
    }
    .frame(maxWidth: .infinity, alignment: .topLeading).background(RCTheme.surfaceInset)
    .clipShape(RoundedRectangle(cornerRadius: 8)).overlay(
      RoundedRectangle(cornerRadius: 8).stroke(RCTheme.borderSoft))
  }
}

struct ApplicationsAsanaConnectionHeader: View {
  var body: some View {
    HStack(spacing: 12) {
      Text("Connection").frame(minWidth: 150, maxWidth: .infinity, alignment: .leading)
      Text("Workspace").frame(width: 175, alignment: .leading)
      Text("Scopes").frame(width: 90, alignment: .leading)
      Text("Status").frame(width: 90, alignment: .leading)
      Text("Actions").frame(width: 130, alignment: .leading)
    }
    .font(.system(size: 11, weight: .bold)).foregroundStyle(RCTheme.muted).padding(.horizontal, 14)
    .frame(height: 36)
  }
}

struct ApplicationsAsanaConnectionRow: View {
  let connection: MarketplaceProviderConnection
  let selected: Bool
  let onSelect: () -> Void
  let onDelete: () -> Void

  var body: some View {
    HStack(spacing: 12) {
      HStack(spacing: 8) {
        Button(action: onSelect) {
          Image(systemName: selected ? "largecircle.fill.circle" : "circle")
        }.buttonStyle(.plain)
        Text(asanaConnectionName(connection)).font(.system(size: 13, weight: .bold)).lineLimit(1)
        if selected {
          Text("ACTIVE").font(.system(size: 9, weight: .bold)).foregroundStyle(RCTheme.accentBlue)
        }
      }.frame(minWidth: 150, maxWidth: .infinity, alignment: .leading)
      Text(asanaAccountPreview(connection)).font(.system(size: 13, weight: .semibold))
        .foregroundStyle(RCTheme.muted).lineLimit(1).frame(width: 175, alignment: .leading)
      Text("\(connection.grantedScopes.count)").font(.system(size: 12, weight: .semibold))
        .foregroundStyle(RCTheme.muted).frame(width: 90, alignment: .leading)
      HStack(spacing: 6) {
        Image(
          systemName: asanaConnectionIsValid(connection)
            ? "checkmark.circle.fill" : "exclamationmark.triangle.fill"
        )
        .foregroundStyle(
          asanaConnectionIsValid(connection) ? RCTheme.accentGreen : RCTheme.accentAmber)
        Text(asanaConnectionStatusText(connection)).font(.system(size: 12, weight: .semibold))
      }.frame(width: 90, alignment: .leading)
      HStack(spacing: 8) {
        Button("Select", action: onSelect).buttonStyle(SecondaryLightButtonStyle()).disabled(
          selected)
        Button("Delete", role: .destructive, action: onDelete).buttonStyle(.borderless)
      }.frame(width: 130, alignment: .leading)
    }
    .padding(.horizontal, 14).frame(height: 48).background(
      selected ? RCTheme.sidebarSelected.opacity(0.55) : Color.clear
    )
    .overlay(alignment: .top) {
      Rectangle().fill(selected ? RCTheme.accentBlue.opacity(0.55) : RCTheme.borderSoft).frame(
        height: selected ? 1.2 : 1)
    }
  }
}


struct ApplicationsExaHeroCard: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp

  private var connection: MarketplaceProviderConnection? {
    guard let connection = model.selectedProviderConnection,
      connection.appSlug == app.slug
    else { return nil }
    return connection
  }

  var body: some View {
    ZStack(alignment: .trailing) {
      ApplicationsExaHeroWave()
        .opacity(0.72)
        .padding(.trailing, 12)
      HStack(alignment: .center, spacing: 18) {
        ApplicationsAppIconView(app: app, size: 76)
          .overlay(
            RoundedRectangle(cornerRadius: 7).stroke(
              RCTheme.accentBlue.opacity(0.55), lineWidth: 1.2))
        VStack(alignment: .leading, spacing: 10) {
          HStack(spacing: 10) {
            Text(app.name)
              .font(.system(size: 30, weight: .bold))
              .lineLimit(1)
            StatusBadge(
              title: app.category.uppercased(), tone: .neutral,
              accessibilityLabelText: "Category \(app.category)")
            StatusBadge(
              title: ProviderConnectionService.providerStatusTitle(for: connection).uppercased(),
              tone: providerConnectionTone(connection),
              accessibilityLabelText: "\(app.name) status"
            )
          }
          Text(app.description)
            .font(.system(size: 15, weight: .semibold))
            .foregroundStyle(RCTheme.muted)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: 720, alignment: .leading)
        }
        Spacer(minLength: 12)
      }
      .padding(24)
    }
    .frame(maxWidth: .infinity, minHeight: 132, alignment: .leading)
    .background(
      LinearGradient(
        colors: [
          RCTheme.sidebarSurfaceAlt, RCTheme.sidebarSelected.opacity(0.55), RCTheme.surfaceInset,
        ],
        startPoint: .leading,
        endPoint: .trailing
      )
    )
    .clipShape(RoundedRectangle(cornerRadius: 8))
    .overlay(RoundedRectangle(cornerRadius: 8).stroke(RCTheme.borderSoft))
  }
}

struct ApplicationsExaHeroWave: View {
  var body: some View {
    GeometryReader { proxy in
      ForEach(0..<12, id: \.self) { index in
        Path { path in
          let height = proxy.size.height
          let width = proxy.size.width
          let offset = CGFloat(index) * 7
          path.move(to: CGPoint(x: width * 0.22, y: height * 0.22 + offset))
          path.addCurve(
            to: CGPoint(x: width * 0.98, y: height * 0.08 + offset * 0.22),
            control1: CGPoint(x: width * 0.48, y: height * 0.78 + offset),
            control2: CGPoint(x: width * 0.72, y: height * 0.72 - offset)
          )
        }
        .stroke(RCTheme.accentBlue.opacity(0.18 + Double(index) * 0.018), lineWidth: 1)
      }
    }
    .allowsHitTesting(false)
  }
}

struct ApplicationsExaAgentsCard: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp

  private var selectedConnection: MarketplaceProviderConnection? {
    model.selectedProviderConnection
  }

  private var connections: [MarketplaceProviderConnection] {
    model.providerConnectionSnapshot?.connections ?? []
  }

  private var compatibleTargets: [MarketplaceCompatibleAgentTarget] {
    let query = model.exaAgentSearch.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    return model.visibleMarketplaceCompatibleAgents
      .filter { app.runtimeSupport.contains($0.runtimeType) }
      .filter { target in
        guard let install = activeInstall(for: target.agentId) else { return true }
        return install.connectionId == selectedConnection?.id
      }
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
    compatibleTargets.filter {
      activeInstall(for: $0.agentId)?.connectionId == selectedConnection?.id
    }.count
  }

  var body: some View {
    ApplicationsExaPanel {
      ViewThatFits(in: .horizontal) {
        HStack(alignment: .top, spacing: 14) {
          ApplicationsExaSectionHeading(
            icon: "person.2", title: "Agents with Exa Search",
            subtitle: "Select which agents should have access to the active Exa connection.")
          Spacer()
          agentControls
        }
        VStack(alignment: .leading, spacing: 12) {
          ApplicationsExaSectionHeading(
            icon: "person.2", title: "Agents with Exa Search",
            subtitle: "Select which agents should have access to the active Exa connection.")
          agentControls
        }
      }

      if connections.isEmpty {
        EmptyMiniLight(
          title: "Add an API connection",
          body: "Create a named Exa key below before assigning agents.")
      } else if compatibleTargets.isEmpty {
        EmptyMiniLight(
          title: "No available agents",
          body: "Agents assigned to other Exa keys are hidden from this active connection.")
      } else {
        ApplicationsAgentGridScroll {
          ForEach(compatibleTargets) { target in
            ApplicationsExaAgentSwitchRow(
              app: app,
              target: target,
              install: activeInstall(for: target.agentId),
              isOn: activeInstall(for: target.agentId)?.connectionId == selectedConnection?.id,
              disabled: selectedConnection == nil || target.status != .compatible
            )
          }
        }
        HStack {
          Spacer()
          Text("\(connectedCount)")
            .font(.system(size: 13, weight: .bold))
            .foregroundStyle(RCTheme.accentGreen)
          Text("of \(compatibleTargets.count) agents connected to this key.")
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
      ApplicationsExaConnectionMenu(
        connections: connections, selectedConnection: selectedConnection)
      ApplicationsExaSearchField(text: $model.exaAgentSearch, placeholder: "Search agents...")
        .frame(width: 250)
    }
  }

  private func activeInstall(for agentId: RelayId) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "exa-search" && exaInstallIsActive($0)
    }
  }

  private func displayName(for target: MarketplaceCompatibleAgentTarget) -> String {
    model.agents.first { $0.id == target.agentId }.map(model.resolveAgentDisplayName)
      ?? target.agentName
  }
}

struct ApplicationsExaAgentSwitchRow: View {
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
    model.busy == "toggle-exa-agent-\(target.agentId)"
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
      return "Connect \(displayName) to Exa Search?"
    }
    return "Disconnect Exa Search for \(displayName)?"
  }

  private var confirmationMessage: String {
    if pendingConnectionState == true {
      return "This connects the agent to the active Exa connection with Standard authority."
    }
    return "This removes the agent's access to the active Exa connection."
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
              ? "Remove Exa Search from \(displayName)"
              : "Give \(displayName) access to the active Exa connection"
          )
          .accessibilityLabel("\(isOn ? "Disconnect" : "Connect") \(displayName) from Exa Search")
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
        model.setExaAgentConnection(target.agentId, enabled: enabled, for: app)
      }
    } message: {
      Text(confirmationMessage)
    }
  }
}
