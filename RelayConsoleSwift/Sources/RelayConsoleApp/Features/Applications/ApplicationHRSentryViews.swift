import AppKit
import RelayConsoleCore
import SwiftUI
import UniformTypeIdentifiers

struct ApplicationsBambooHRDetailPanel: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp
  private var connections: [MarketplaceProviderConnection] {
    model.providerConnectionSnapshot?.connections ?? []
  }
  private var selected: MarketplaceProviderConnection? { model.selectedProviderConnection }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    model.visibleMarketplaceCompatibleAgents.filter {
      app.runtimeSupport.contains($0.runtimeType)
    }.sorted { $0.agentName < $1.agentName }
  }
  var body: some View {
    VStack(spacing: 14) {
      ApplicationsExaHeroCard(app: app)
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "person.2", title: "Agents with BambooHR",
          subtitle: "Assign non-employee Location and Country metadata to compatible agents.")
        if connections.isEmpty {
          ApplicationsExaInfoPill(
            text: "Agent rows stay visible but disabled until BambooHR OAuth is ready.")
        }
        LazyVGrid(
          columns: [GridItem(.adaptive(minimum: 245), spacing: 12)], alignment: .leading,
          spacing: 12
        ) {
          ForEach(targets) { target in
            ApplicationsBambooHRAgentSwitchRow(
              app: app, target: target, install: activeInstall(target.agentId),
              enabled: selected.map(bambooHRConnectionIsReady) == true
                && target.status == .compatible)
          }
        }
      }
      ApplicationsExaPanel {
        HStack(alignment: .top) {
          ApplicationsExaSectionHeading(
            icon: "key", title: "Manage API Connection",
            subtitle: "Authorize field + offline_access, then select one exact company Location.")
          Spacer()
          ApplicationsExaInfoPill(text: "field + offline_access")
        }
        ViewThatFits(in: .horizontal) {
          HStack(alignment: .top, spacing: 24) {
            connectForm
            connectionTable
          }
          VStack(alignment: .leading, spacing: 14) {
            connectForm
            connectionTable
          }
        }
        if let status = model.bambooHRConnectionStatus?.nilIfEmpty {
          Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
      }
      LazyVGrid(
        columns: [GridItem(.adaptive(minimum: 285), spacing: 14)], alignment: .leading, spacing: 14
      ) {
        ApplicationsExaInfoCard(
          icon: "shippingbox", title: "Capabilities", items: app.capabilities,
          linkTitle: "BambooHR OAuth docs", linkURL: app.docsURL.flatMap(URL.init(string:)))
        ApplicationsExaInfoCard(
          icon: "lock.shield", title: "What Agents Can Do",
          items: [
            "List the first 25 job Locations",
            "Inspect one selected Location without address details",
            "List up to 25 country options",
          ], linkTitle: nil, linkURL: nil)
        ApplicationsExaInfoCard(
          icon: "checklist", title: "Requirements",
          items: marketplaceConnectionRequirements(for: app), linkTitle: nil, linkURL: nil)
      }
    }
  }
  private var connectForm: some View {
    VStack(alignment: .leading, spacing: 12) {
      Text("Connect BambooHR").font(.system(size: 15, weight: .bold))
      Text(
        "Relay uses BambooHR's confidential authorization-code flow. Access and refresh tokens are separate Keychain references; the client secret, exchange, refresh, revoke, and exact company/Location selection stay in Railway."
      ).font(.system(size: 12)).foregroundStyle(RCTheme.muted)
      Button {
        model.startBambooHROAuthConnect(for: app)
      } label: {
        Label(
          selected == nil ? "Authorize BambooHR" : "Reconnect BambooHR",
          systemImage: "link.badge.plus")
      }.buttonStyle(PrimaryLightButtonStyle()).frame(maxWidth: .infinity).disabled(
        model.busy == "connect-bamboohr-oauth" || model.providerConnectionSnapshot?.readOnly == true
          || app.availability != .available)
      Text("No employee scope or employee data is requested.").font(
        .system(size: 11, weight: .semibold)
      ).foregroundStyle(RCTheme.muted)
    }.padding(16).frame(width: 410, alignment: .topLeading).background(RCTheme.surfaceInset)
      .clipShape(RoundedRectangle(cornerRadius: 8)).overlay(
        RoundedRectangle(cornerRadius: 8).stroke(RCTheme.borderSoft))
  }
  private var connectionTable: some View {
    ScrollView(.horizontal, showsIndicators: false) {
      VStack(spacing: 0) {
        HStack {
          Text("").frame(width: 28)
          Text("Connection").frame(width: 210, alignment: .leading)
          Text("Company").frame(width: 170, alignment: .leading)
          Text("Location").frame(width: 190, alignment: .leading)
          Text("Status").frame(width: 90, alignment: .leading)
          Text("Actions").frame(width: 54)
        }.font(.system(size: 11, weight: .bold)).foregroundStyle(RCTheme.muted).padding(
          .horizontal, 14
        ).frame(height: 36)
        if connections.isEmpty {
          EmptyMiniLight(
            title: "No BambooHR OAuth connection",
            body: "Complete Marketplace OAuth and exact Location selection before assigning agents."
          ).padding(.vertical, 22)
        } else {
          ForEach(connections) { connection in
            HStack {
              Button {
                model.selectBambooHRConnection(connection.id)
              } label: {
                Image(
                  systemName: selected?.id == connection.id ? "largecircle.fill.circle" : "circle")
              }.buttonStyle(.plain).frame(width: 28).disabled(
                !bambooHRConnectionIsReady(connection))
              Text(connection.accountLabel ?? "BambooHR Location").frame(
                width: 210, alignment: .leading)
              Text(connection.health.diagnostics["companyDomain"]?.string ?? "?").frame(
                width: 170, alignment: .leading)
              Text(connection.health.diagnostics["locationLabel"]?.string ?? "?").frame(
                width: 190, alignment: .leading)
              Text(bambooHRConnectionIsReady(connection) ? "Ready" : "Reconnect").frame(
                width: 90, alignment: .leading)
              Button {
                model.deleteBambooHRConnection(connection, for: app)
              } label: {
                Image(systemName: "trash")
              }.buttonStyle(IconLightButtonStyle()).frame(width: 54)
            }.font(.system(size: 12, weight: .semibold)).padding(.horizontal, 14).frame(height: 46)
              .overlay(alignment: .top) { Rectangle().fill(RCTheme.borderSoft).frame(height: 1) }
          }
        }
        HStack {
          Image(systemName: "lightbulb")
          Text(
            "Employee data/scopes, address details, reports, sensitive HR data, writes, raw APIs, cross-company reads, and automatic pagination are blocked."
          )
          Spacer()
        }.font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted).padding(
          .horizontal, 14
        ).frame(height: 38).overlay(alignment: .top) {
          Rectangle().fill(RCTheme.borderSoft).frame(height: 1)
        }
      }.frame(minWidth: 790)
    }.background(RCTheme.surfaceInset).clipShape(RoundedRectangle(cornerRadius: 8)).overlay(
      RoundedRectangle(cornerRadius: 8).stroke(RCTheme.borderSoft))
  }
  private func activeInstall(_ agentId: RelayId) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "bamboohr" && exaInstallIsActive($0)
    }
  }
}
struct ApplicationsBambooHRAgentSwitchRow: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp
  let target: MarketplaceCompatibleAgentTarget
  let install: MarketplaceInstallRecord?
  let enabled: Bool
  @State private var pending: Bool?
  private var isOn: Bool { install?.connectionId == model.selectedProviderConnection?.id }
  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      HStack {
        AgentAvatarView(
          name: target.agentName, avatarURL: model.agentAvatar(target.agentId), size: 38)
        VStack(alignment: .leading) {
          Text(target.agentName).font(.system(size: 13, weight: .semibold))
          Text(exaRuntimeLabel(target.runtimeType)).font(.system(size: 12)).foregroundStyle(
            RCTheme.muted)
        }
        Spacer()
        Button {
          pending = !isOn
        } label: {
          ApplicationsExaSwitch(isOn: isOn)
        }.buttonStyle(.plain).disabled(
          !enabled || model.busy == "toggle-bamboohr-agent-\(target.agentId)")
      }
      if isOn, let install {
        Text("Read-only BambooHR Location and Country metadata").font(
          .system(size: 11, weight: .bold)
        ).foregroundStyle(RCTheme.muted)
        ApplicationsAgentAuthorityRow(app: app, install: install, selectedPreset: .readOnly)
      }
    }.padding(12).frame(minHeight: 86).background(
      isOn ? RCTheme.sidebarSelected.opacity(0.48) : RCTheme.surfaceInset
    ).clipShape(RoundedRectangle(cornerRadius: 8)).opacity(!enabled && !isOn ? 0.65 : 1).alert(
      pending == true ? "Connect agent to BambooHR?" : "Disconnect BambooHR?",
      isPresented: Binding(get: { pending != nil }, set: { if !$0 { pending = nil } })
    ) {
      Button("Cancel", role: .cancel) { pending = nil }
      Button(pending == true ? "Connect" : "Disconnect") {
        let value = pending ?? !isOn
        pending = nil
        model.setBambooHRAgentConnection(target.agentId, enabled: value, for: app)
      }
    } message: {
      Text("This changes only bounded non-employee BambooHR metadata access.")
    }
  }
}

func greenhouseConnectionIsReady(_ c: MarketplaceProviderConnection) -> Bool {
  c.appSlug == "greenhouse" && c.status == .connected && c.health.state == .ready
    && c.grantedScopes == ProviderConnectionService.greenhouseReadScopes
    && c.health.diagnostics["apiOrigin"]?.string == GreenhouseProviderActionSupport.apiOrigin
    && c.health.diagnostics["organizationId"]?.string.map(GreenhouseProviderActionSupport.safeId)
      == true
}
struct ApplicationsGreenhouseDetailPanel: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp
  private var connections: [MarketplaceProviderConnection] {
    model.providerConnectionSnapshot?.connections ?? []
  }
  private var selected: MarketplaceProviderConnection? { model.selectedProviderConnection }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    model.visibleMarketplaceCompatibleAgents.filter {
      app.runtimeSupport.contains($0.runtimeType)
    }
  }
  var body: some View {
    VStack(spacing: 14) {
      ApplicationsExaHeroCard(app: app)
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "person.2", title: "Agents with Greenhouse",
          subtitle: "Assign safe Job, Office, and Department inventory.")
        if connections.isEmpty {
          ApplicationsExaInfoPill(
            text: "Agent rows stay visible but disabled until partner OAuth is ready.")
        }
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 245), spacing: 12)], spacing: 12) {
          ForEach(targets) { target in
            ApplicationsGreenhouseAgentSwitchRow(
              app: app, target: target, install: activeInstall(target.agentId),
              enabled: selected.map(greenhouseConnectionIsReady) == true
                && target.status == .compatible)
          }
        }
      }
      ApplicationsExaPanel {
        HStack {
          ApplicationsExaSectionHeading(
            icon: "key", title: "Manage API Connection",
            subtitle: "Authorize only the three Harvest v3 list scopes.")
          Spacer()
          ApplicationsExaInfoPill(text: "Jobs + Offices + Departments")
        }
        ViewThatFits(in: .horizontal) {
          HStack(alignment: .top, spacing: 24) {
            connectForm
            connectionTable
          }
          VStack {
            connectForm
            connectionTable
          }
        }
        if let status = model.greenhouseConnectionStatus?.nilIfEmpty {
          Text(status).foregroundStyle(RCTheme.muted)
        }
      }
      LazyVGrid(columns: [GridItem(.adaptive(minimum: 285), spacing: 14)], spacing: 14) {
        ApplicationsExaInfoCard(
          icon: "shippingbox", title: "Capabilities", items: app.capabilities,
          linkTitle: "Harvest v3 partner OAuth", linkURL: app.docsURL.flatMap(URL.init(string:)))
        ApplicationsExaInfoCard(
          icon: "lock.shield", title: "Blocked",
          items: [
            "Candidates, applications, interviews, offers, and users",
            "Hiring teams, notes, custom fields, physical office locations",
            "Writes, raw endpoints, and automatic pagination",
          ], linkTitle: nil, linkURL: nil)
        ApplicationsExaInfoCard(
          icon: "checklist", title: "Requirements",
          items: marketplaceConnectionRequirements(for: app), linkTitle: nil, linkURL: nil)
      }
    }
  }
  private var connectForm: some View {
    VStack(alignment: .leading, spacing: 12) {
      Text("Connect Greenhouse").font(.system(size: 15, weight: .bold))
      Text(
        "Relay uses Greenhouse partner authorization code. Tokens stay in separate Keychain references; exchange, refresh, revoke and organization selection stay in Railway."
      ).font(.system(size: 12)).foregroundStyle(RCTheme.muted)
      Button {
        model.startGreenhouseOAuthConnect(for: app)
      } label: {
        Label(
          selected == nil ? "Authorize Greenhouse" : "Reconnect Greenhouse",
          systemImage: "link.badge.plus")
      }.buttonStyle(PrimaryLightButtonStyle()).disabled(model.busy == "connect-greenhouse-oauth")
      Text("A Site Admin must authorize the exact three list scopes.").font(
        .system(size: 11, weight: .semibold)
      ).foregroundStyle(RCTheme.muted)
    }.padding(16).frame(width: 410).background(RCTheme.surfaceInset).clipShape(
      RoundedRectangle(cornerRadius: 8))
  }
  private var connectionTable: some View {
    VStack(spacing: 0) {
      if connections.isEmpty {
        EmptyMiniLight(
          title: "No Greenhouse OAuth connection",
          body: "Complete partner authorization before assigning agents."
        ).padding(22)
      } else {
        ForEach(connections) { c in
          HStack {
            Button {
              model.selectGreenhouseConnection(c.id)
            } label: {
              Image(systemName: selected?.id == c.id ? "largecircle.fill.circle" : "circle")
            }.buttonStyle(.plain).disabled(!greenhouseConnectionIsReady(c))
            Text(c.accountLabel ?? "Greenhouse").frame(width: 250, alignment: .leading)
            Text(greenhouseConnectionIsReady(c) ? "Ready" : "Reconnect")
            Button {
              model.deleteGreenhouseConnection(c, for: app)
            } label: {
              Image(systemName: "trash")
            }.buttonStyle(IconLightButtonStyle())
          }.padding(12)
        }
      }
    }.frame(minWidth: 440).background(RCTheme.surfaceInset).clipShape(
      RoundedRectangle(cornerRadius: 8))
  }
  private func activeInstall(_ id: RelayId) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == id && $0.appSlug == "greenhouse" && exaInstallIsActive($0)
    }
  }
}
struct ApplicationsGreenhouseAgentSwitchRow: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp
  let target: MarketplaceCompatibleAgentTarget
  let install: MarketplaceInstallRecord?
  let enabled: Bool
  @State private var pending: Bool?
  private var isOn: Bool { install?.connectionId == model.selectedProviderConnection?.id }
  var body: some View {
    VStack(alignment: .leading) {
      HStack {
        AgentAvatarView(
          name: target.agentName, avatarURL: model.agentAvatar(target.agentId), size: 38)
        Text(target.agentName)
        Spacer()
        Button {
          pending = !isOn
        } label: {
          ApplicationsExaSwitch(isOn: isOn)
        }.buttonStyle(.plain).disabled(
          !enabled || model.busy == "toggle-greenhouse-agent-\(target.agentId)")
      }
      if isOn, let install {
        Text("Read-only Greenhouse recruiting structure").font(.system(size: 11, weight: .bold))
        ApplicationsAgentAuthorityRow(app: app, install: install, selectedPreset: .readOnly)
      }
    }.padding(12).background(RCTheme.surfaceInset).clipShape(RoundedRectangle(cornerRadius: 8))
      .alert(
        pending == true ? "Connect agent to Greenhouse?" : "Disconnect Greenhouse?",
        isPresented: Binding(get: { pending != nil }, set: { if !$0 { pending = nil } })
      ) {
        Button("Cancel", role: .cancel) { pending = nil }
        Button(pending == true ? "Connect" : "Disconnect") {
          let v = pending ?? !isOn
          pending = nil
          model.setGreenhouseAgentConnection(target.agentId, enabled: v, for: app)
        }
      }
  }
}

func leverConnectionIsReady(_ connection: MarketplaceProviderConnection) -> Bool {
  connection.appSlug == "lever"
    && connection.status == .connected
    && connection.health.state == .ready
    && connection.grantedScopes == ProviderConnectionService.leverReadScopes
    && connection.health.diagnostics["apiOrigin"]?.string == LeverProviderActionSupport.apiOrigin
    && connection.health.diagnostics["accountId"]?.string.map(LeverProviderActionSupport.safeId)
      == true
}

struct ApplicationsLeverDetailPanel: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp
  private var connections: [MarketplaceProviderConnection] {
    model.providerConnectionSnapshot?.connections ?? []
  }
  private var selected: MarketplaceProviderConnection? { model.selectedProviderConnection }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    model.visibleMarketplaceCompatibleAgents.filter {
      app.runtimeSupport.contains($0.runtimeType)
    }
  }

  var body: some View {
    VStack(spacing: 14) {
      ApplicationsExaHeroCard(app: app)
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "person.2", title: "Agents with Lever",
          subtitle: "Assign safe non-confidential Posting and Stage inventory.")
        if connections.isEmpty {
          ApplicationsExaInfoPill(
            text: "Agent rows stay visible but disabled until partner OAuth is ready.")
        }
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 245), spacing: 12)], spacing: 12) {
          ForEach(targets) { target in
            ApplicationsLeverAgentSwitchRow(
              app: app, target: target, install: activeInstall(target.agentId),
              enabled: selected.map(leverConnectionIsReady) == true && target.status == .compatible)
          }
        }
      }
      ApplicationsExaPanel {
        HStack {
          ApplicationsExaSectionHeading(
            icon: "key", title: "Manage API Connection",
            subtitle: "Authorize only offline access plus Posting and Stage reads.")
          Spacer()
          ApplicationsExaInfoPill(text: "Postings + Stages")
        }
        ViewThatFits(in: .horizontal) {
          HStack(alignment: .top, spacing: 24) {
            connectForm
            connectionTable
          }
          VStack {
            connectForm
            connectionTable
          }
        }
        if let status = model.leverConnectionStatus?.nilIfEmpty {
          Text(status).foregroundStyle(RCTheme.muted)
        }
      }
      LazyVGrid(columns: [GridItem(.adaptive(minimum: 285), spacing: 14)], spacing: 14) {
        ApplicationsExaInfoCard(
          icon: "shippingbox", title: "Capabilities", items: app.capabilities,
          linkTitle: "Lever partner OAuth", linkURL: app.docsURL.flatMap(URL.init(string:)))
        ApplicationsExaInfoCard(
          icon: "lock.shield", title: "Blocked",
          items: [
            "Opportunities, candidates, contacts, applications, interviews, and offers",
            "Confidential postings, content, salary, owners, hiring managers, and followers",
            "Writes, apply endpoints, raw tools, and automatic offset pagination",
          ], linkTitle: nil, linkURL: nil)
        ApplicationsExaInfoCard(
          icon: "checklist", title: "Requirements",
          items: marketplaceConnectionRequirements(for: app), linkTitle: nil, linkURL: nil)
      }
    }
  }

  private var connectForm: some View {
    VStack(alignment: .leading, spacing: 12) {
      Text("Connect Lever").font(.system(size: 15, weight: .bold))
      Text(
        "Relay uses Lever partner authorization code. Access and rotating refresh tokens stay in separate Keychain references; exchange, refresh, revoke, and account selection stay in Railway."
      ).font(.system(size: 12)).foregroundStyle(RCTheme.muted)
      Button {
        model.startLeverOAuthConnect(for: app)
      } label: {
        Label(
          selected == nil ? "Authorize Lever" : "Reconnect Lever", systemImage: "link.badge.plus")
      }.buttonStyle(PrimaryLightButtonStyle()).disabled(model.busy == "connect-lever-oauth")
      Text("A Lever Super Admin must authorize the exact three scopes.").font(
        .system(size: 11, weight: .semibold)
      ).foregroundStyle(RCTheme.muted)
    }.padding(16).frame(width: 410).background(RCTheme.surfaceInset).clipShape(
      RoundedRectangle(cornerRadius: 8))
  }

  private var connectionTable: some View {
    VStack(spacing: 0) {
      if connections.isEmpty {
        EmptyMiniLight(
          title: "No Lever OAuth connection",
          body: "Complete partner authorization before assigning agents."
        ).padding(22)
      } else {
        ForEach(connections) { connection in
          HStack {
            Button {
              model.selectLeverConnection(connection.id)
            } label: {
              Image(
                systemName: selected?.id == connection.id ? "largecircle.fill.circle" : "circle")
            }.buttonStyle(.plain).disabled(!leverConnectionIsReady(connection))
            Text(connection.accountLabel ?? "Lever").frame(width: 250, alignment: .leading)
            Text(leverConnectionIsReady(connection) ? "Ready" : "Reconnect")
            Button {
              model.deleteLeverConnection(connection, for: app)
            } label: {
              Image(systemName: "trash")
            }.buttonStyle(IconLightButtonStyle())
          }.padding(12)
        }
      }
    }.frame(minWidth: 440).background(RCTheme.surfaceInset).clipShape(
      RoundedRectangle(cornerRadius: 8))
  }

  private func activeInstall(_ agentId: RelayId) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "lever" && exaInstallIsActive($0)
    }
  }
}

struct ApplicationsLeverAgentSwitchRow: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp
  let target: MarketplaceCompatibleAgentTarget
  let install: MarketplaceInstallRecord?
  let enabled: Bool
  @State private var pending: Bool?
  private var isOn: Bool { install?.connectionId == model.selectedProviderConnection?.id }
  var body: some View {
    VStack(alignment: .leading) {
      HStack {
        AgentAvatarView(
          name: target.agentName, avatarURL: model.agentAvatar(target.agentId), size: 38)
        Text(target.agentName)
        Spacer()
        Button {
          pending = !isOn
        } label: {
          ApplicationsExaSwitch(isOn: isOn)
        }.buttonStyle(.plain).disabled(
          !enabled || model.busy == "toggle-lever-agent-\(target.agentId)")
      }
      if isOn, let install {
        Text("Read-only Lever Posting and Stage structure").font(.system(size: 11, weight: .bold))
        ApplicationsAgentAuthorityRow(app: app, install: install, selectedPreset: .readOnly)
      }
    }.padding(12).background(RCTheme.surfaceInset).clipShape(RoundedRectangle(cornerRadius: 8))
      .alert(
        pending == true ? "Connect agent to Lever?" : "Disconnect Lever?",
        isPresented: Binding(get: { pending != nil }, set: { if !$0 { pending = nil } })
      ) {
        Button("Cancel", role: .cancel) { pending = nil }
        Button(pending == true ? "Connect" : "Disconnect") {
          let value = pending ?? !isOn
          pending = nil
          model.setLeverAgentConnection(target.agentId, enabled: value, for: app)
        }
      }
  }
}

struct ApplicationsSentryDetailPanel: View {
  let app: MarketplaceCatalogApp

  var body: some View {
    VStack(spacing: 14) {
      ApplicationsExaHeroCard(app: app)
      ApplicationsSentryAgentsCard(app: app)
      ApplicationsSentryConnectionsCard(app: app)
      LazyVGrid(
        columns: [GridItem(.adaptive(minimum: 285), spacing: 14)], alignment: .leading, spacing: 14
      ) {
        ApplicationsExaInfoCard(
          icon: "exclamationmark.triangle",
          title: "Capabilities",
          items: app.capabilities,
          linkTitle: "Sentry API docs",
          linkURL: app.docsURL.flatMap(URL.init(string:))
        )
        ApplicationsExaInfoCard(
          icon: "lock.shield",
          title: "What Agents Can Do",
          items: [
            "List projects in the selected organization",
            "Search recent issues with bounded filters",
            "Inspect issue and event details for debugging",
            "Prepare issue workflow updates through the selected authority",
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

struct ApplicationsSentryAgentsCard: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp

  private var selectedConnection: MarketplaceProviderConnection? {
    model.selectedProviderConnection
  }

  private var connections: [MarketplaceProviderConnection] {
    model.providerConnectionSnapshot?.connections ?? []
  }

  private var compatibleTargets: [MarketplaceCompatibleAgentTarget] {
    let query = model.sentryAgentSearch.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
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

  private var selectedConnectionReady: Bool {
    selectedConnection.map(sentryConnectionIsAssignable) ?? false
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
            icon: "person.2", title: "Agents with Sentry",
            subtitle: "Select which agents should use the active Sentry organization connection.")
          Spacer()
          agentControls
        }
        VStack(alignment: .leading, spacing: 12) {
          ApplicationsExaSectionHeading(
            icon: "person.2", title: "Agents with Sentry",
            subtitle: "Select which agents should use the active Sentry organization connection.")
          agentControls
        }
      }

      if compatibleTargets.isEmpty {
        EmptyMiniLight(
          title: "No available agents",
          body: "Sentry can be installed on compatible Hermes and OpenClaw agents.")
      } else {
        if connections.isEmpty {
          ApplicationsExaInfoPill(
            text: "Connect one Sentry organization through OAuth before turning agents on.")
        } else if !selectedConnectionReady {
          ApplicationsExaInfoPill(
            text: "Select a ready Sentry connection before turning agents on.")
        }
        LazyVGrid(
          columns: [GridItem(.adaptive(minimum: 245), spacing: 12)], alignment: .leading,
          spacing: 12
        ) {
          ForEach(compatibleTargets) { target in
            ApplicationsSentryAgentSwitchRow(
              app: app,
              target: target,
              install: activeInstall(for: target.agentId),
              isOn: selectedConnection != nil
                && activeInstall(for: target.agentId)?.connectionId == selectedConnection?.id,
              disabled: !selectedConnectionReady || target.status != .compatible
            )
          }
        }
        HStack {
          Spacer()
          Text("\(connectedCount)")
            .font(.system(size: 13, weight: .bold))
            .foregroundStyle(RCTheme.accentGreen)
          Text("of \(compatibleTargets.count) agents connected to Sentry.")
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(RCTheme.muted)
        }
      }
    }
  }

  private var agentControls: some View {
    HStack(spacing: 10) {
      Text("Active organization:")
        .font(.system(size: 12, weight: .semibold))
        .foregroundStyle(RCTheme.muted)
      Text(selectedConnection.map(sentryOrganizationPreview) ?? "No organization saved")
        .font(.system(size: 13, weight: .semibold))
        .padding(.horizontal, 12)
        .frame(height: 36)
        .background(RCTheme.surfaceInset)
        .clipShape(RoundedRectangle(cornerRadius: 7))
        .overlay(RoundedRectangle(cornerRadius: 7).stroke(RCTheme.borderSoft))
      ApplicationsExaSearchField(text: $model.sentryAgentSearch, placeholder: "Search agents...")
        .frame(width: 250)
    }
  }

  private func activeInstall(for agentId: RelayId) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "sentry" && exaInstallIsActive($0)
    }
  }

  private func displayName(for target: MarketplaceCompatibleAgentTarget) -> String {
    model.agents.first { $0.id == target.agentId }.map(model.resolveAgentDisplayName)
      ?? target.agentName
  }
}
