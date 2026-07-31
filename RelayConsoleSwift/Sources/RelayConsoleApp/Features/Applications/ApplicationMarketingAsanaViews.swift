import AppKit
import RelayConsoleCore
import SwiftUI
import UniformTypeIdentifiers

struct ApplicationsConstantContactDetailPanel: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp
  private var connection: MarketplaceProviderConnection? { model.selectedProviderConnection }
  private var connections: [MarketplaceProviderConnection] {
    model.providerConnectionSnapshot?.connections ?? []
  }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    let query = model.constantContactAgentSearch.lowercased()
    return model.visibleMarketplaceCompatibleAgents.filter {
      app.runtimeSupport.contains($0.runtimeType)
    }.filter { query.isEmpty || name($0).lowercased().contains(query) }
  }
  var body: some View {
    VStack(spacing: 14) {
      ApplicationsExaHeroCard(app: app)
      ApplicationsExaPanel {
        HStack {
          ApplicationsExaSectionHeading(
            icon: "person.2", title: "Agents with Constant Contact",
            subtitle: "Assign the active exact encoded Account.")
          Spacer()
          ApplicationsExaSearchField(
            text: $model.constantContactAgentSearch, placeholder: "Search agents..."
          ).frame(width: 250)
        }
        if connection == nil {
          ApplicationsExaInfoPill(
            text: "Connect a registered Constant Contact V3 app before turning agents on.")
        }
        ApplicationsAgentGridScroll {
          ForEach(targets) { target in
            let install = active(target.agentId)
            ApplicationsConstantContactAgentSwitchRow(
              app: app, target: target, install: install,
              isOn: connection != nil && install?.connectionId == connection?.id,
              disabled: connection == nil || target.status != .compatible)
          }
        }
      }
      ApplicationsExaPanel {
        HStack {
          ApplicationsExaSectionHeading(
            icon: "key", title: "Manage API Connection",
            subtitle: "Relay-owned Constant Contact OAuth through Railway.")
          Spacer()
          ApplicationsExaInfoPill(text: "The rotating pair stays in Keychain.")
        }
        Text("OAuth 2.0 · account_read campaign_data offline_access · exact Account · V3").font(
          .system(size: 12, weight: .semibold)
        ).foregroundStyle(RCTheme.muted)
        Button {
        } label: {
          Label(
            connection == nil ? "Connect Constant Contact" : "Reconnect Constant Contact",
            systemImage: "link.badge.plus")
        }.buttonStyle(PrimaryLightButtonStyle()).disabled(true).help(
          "V3 app registration, Railway state/code exchange, Account/privilege validation, serialized refresh/revoke broker and live acceptance are required"
        )
        Text(
          "Only three approval-gated wrappers exist. Contacts, lists, person tracking, Campaign content/identity, SMS/events/social/landing pages, writes, sends, arbitrary pages and export stay blocked."
        ).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        if connections.isEmpty {
          EmptyMiniLight(
            title: "No Constant Contact OAuth connection",
            body:
              "Connect a deployed V3 app and validate one exact Account before assigning agents."
          ).padding(.vertical, 22)
        } else {
          ForEach(connections) { value in
            HStack {
              Button {
                model.selectConstantContactConnection(value.id)
              } label: {
                Image(systemName: connection?.id == value.id ? "largecircle.fill.circle" : "circle")
              }.buttonStyle(.plain)
              Text(value.accountLabel ?? "Constant Contact Account")
              Spacer()
              Text(
                value.health.diagnostics["encodedAccountId"]?.string.map { String($0.suffix(8)) }
                  ?? "Account pending")
              Button("Delete", role: .destructive) {
                model.deleteConstantContactOAuthConnection(value, for: app)
              }
            }.padding(12)
          }
        }
      }
      ApplicationsInfoCardsLayout {
        ApplicationsExaInfoCard(
          icon: "square.grid.3x3", title: "Capabilities", items: app.capabilities,
          linkTitle: "Constant Contact V3 API", linkURL: app.docsURL.flatMap(URL.init(string:)))
        ApplicationsExaInfoCard(
          icon: "lock.shield", title: "Provider-semantic contract",
          items: [
            "Exact encoded Account ID/organization",
            "25 recent content-free Email Campaign summaries",
            "25 aggregate Summary Reports without contact drilldowns",
          ], linkTitle: nil, linkURL: nil)
        ApplicationsExaInfoCard(
          icon: "checkmark.shield", title: "Requirements",
          items: marketplaceConnectionRequirements(for: app), linkTitle: nil, linkURL: nil)
      }
    }
  }
  private func name(_ target: MarketplaceCompatibleAgentTarget) -> String {
    model.agents.first { $0.id == target.agentId }.map(model.resolveAgentDisplayName)
      ?? target.agentName
  }
  private func active(_ id: RelayId) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == id && $0.appSlug == "constant-contact"
        && ($0.installStatus == .installed || $0.installStatus == .requested)
    }
  }
}
struct ApplicationsConstantContactAgentSwitchRow: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp
  let target: MarketplaceCompatibleAgentTarget
  let install: MarketplaceInstallRecord?
  let isOn: Bool
  let disabled: Bool
  @State private var pending: Bool?
  var body: some View {
    VStack(alignment: .leading, spacing: 9) {
      HStack {
        AgentAvatarView(
          name: target.agentName, avatarURL: model.agentAvatar(target.agentId), size: 38)
        Text(target.agentName)
        Spacer()
        Button {
          pending = !isOn
        } label: {
          ApplicationsExaSwitch(isOn: isOn)
        }.buttonStyle(.plain).disabled(disabled)
      }
      ApplicationsAgentAuthorityRow(
        app: app, install: install,
        selectedPreset: install.flatMap { model.marketplaceActionPolicyPreset(for: $0) }
          ?? .approvalRequired, muted: !isOn)
    }.padding(12).background(RCTheme.surfaceInset).clipShape(RoundedRectangle(cornerRadius: 8))
      .alert(
        "Change Constant Contact access?",
        isPresented: Binding(get: { pending != nil }, set: { if !$0 { pending = nil } })
      ) {
        Button("Cancel", role: .cancel) { pending = nil }
        Button(pending == true ? "Connect" : "Disconnect") {
          let enabled = pending ?? !isOn
          pending = nil
          model.setConstantContactAgentConnection(target.agentId, enabled: enabled, for: app)
        }
      } message: {
        Text(
          "This changes only the three bounded Account/Campaign/report wrappers; contacts and Campaign content remain unavailable."
        )
      }
  }
}

struct ApplicationsMondayDetailPanel: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp
  private var connection: MarketplaceProviderConnection? { model.selectedProviderConnection }
  private var connections: [MarketplaceProviderConnection] {
    model.providerConnectionSnapshot?.connections ?? []
  }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    let q = model.mondayAgentSearch.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    return model.visibleMarketplaceCompatibleAgents.filter {
      app.runtimeSupport.contains($0.runtimeType)
    }.filter { q.isEmpty || displayName($0).lowercased().contains(q) }.sorted {
      displayName($0) < displayName($1)
    }
  }
  var body: some View {
    VStack(spacing: 14) {
      ApplicationsExaHeroCard(app: app)
      ApplicationsExaPanel {
        ViewThatFits(in: .horizontal) {
          HStack(alignment: .top) {
            ApplicationsExaSectionHeading(
              icon: "person.2", title: "Agents with Monday.com",
              subtitle: "Assign the active account grant and choose one of four authority levels.")
            Spacer()
            agentControls
          }
          VStack(alignment: .leading, spacing: 12) {
            ApplicationsExaSectionHeading(
              icon: "person.2", title: "Agents with Monday.com",
              subtitle: "Assign the active account grant and choose one of four authority levels.")
            agentControls
          }
        }
        if connection == nil {
          ApplicationsExaInfoPill(text: "Connect Monday.com below before turning agents on.")
        }
        if targets.isEmpty {
          EmptyMiniLight(
            title: "No available agents",
            body: "Monday.com can be assigned to compatible Hermes and OpenClaw agents.")
        } else {
          ApplicationsAgentGridScroll {
            ForEach(targets) { target in
              let install = active(target.agentId)
              ApplicationsMondayAgentSwitchRow(
                app: app, target: target, install: install,
                isOn: connection != nil && install?.connectionId == connection?.id,
                disabled: connection == nil || target.status != .compatible)
            }
          }
        }
      }
      ApplicationsExaPanel {
        HStack(alignment: .top) {
          ApplicationsExaSectionHeading(
            icon: "key", title: "Manage API Connection",
            subtitle:
              "Connect your Monday.com account so agents can work with its boards and items.")
          Spacer()
          ApplicationsExaInfoPill(text: "Your Monday.com credentials are never shown to agents.")
        }
        ApplicationsConnectionFormGrid {
          VStack(alignment: .leading, spacing: 8) {
            Text("Monday.com account / Workspaces").font(.system(size: 12, weight: .semibold))
              .foregroundStyle(RCTheme.muted)
            Text(connection.map(mondayAccountPreview) ?? "No account authorized").font(
              .system(size: 13, weight: .bold)
            ).frame(maxWidth: .infinity, minHeight: 36, alignment: .leading).padding(
              .horizontal, 11
            ).background(RCTheme.fieldBackground).clipShape(RoundedRectangle(cornerRadius: 7))
          }
          VStack(alignment: .leading, spacing: 8) {
            Text("Secure sign-in").font(.system(size: 12, weight: .semibold))
              .foregroundStyle(RCTheme.muted)
            Button {
              model.startMondayOAuthConnect(for: app)
            } label: {
              Label(
                connection == nil ? "Connect Monday.com" : "Reconnect Monday.com",
                systemImage: "link.badge.plus")
            }.buttonStyle(PrimaryLightButtonStyle()).disabled(
              model.busy == "connect-monday-oauth" || model.workspace == nil)
          }
        }
        Text(
          "Click Connect, sign in to Monday.com, choose an account, and return automatically."
        ).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        VStack(spacing: 0) {
          HStack {
            Text("Connection").frame(maxWidth: .infinity, alignment: .leading)
            Text("Account / Workspaces").frame(width: 190, alignment: .leading)
            Text("Scopes").frame(width: 80)
            Text("Status").frame(width: 90)
            Text("Actions").frame(width: 130)
          }.font(.system(size: 11, weight: .bold)).foregroundStyle(RCTheme.muted).padding(
            .horizontal, 14
          ).frame(height: 36)
          if connections.isEmpty {
            EmptyMiniLight(
              title: "No Monday.com OAuth connection",
              body: "Connect Monday.com before assigning agents."
            ).padding(.vertical, 22)
          } else {
            ForEach(connections) { mondayConnectionRow($0) }
          }
          HStack {
            Image(systemName: "lightbulb")
            Text("Select one active account grant; reconnect after scope or installation changes.")
              .font(.system(size: 12, weight: .semibold))
            Spacer()
          }.foregroundStyle(RCTheme.muted).padding(.horizontal, 14).frame(height: 38).overlay(
            alignment: .top
          ) { Rectangle().fill(RCTheme.borderSoft).frame(height: 1) }
        }.background(RCTheme.surfaceInset).clipShape(RoundedRectangle(cornerRadius: 8)).overlay(
          RoundedRectangle(cornerRadius: 8).stroke(RCTheme.borderSoft))
        if let status = model.mondayConnectionStatus?.nilIfEmpty {
          Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
      }
      ApplicationsInfoCardsLayout {
        ApplicationsExaInfoCard(
          icon: "rectangle.grid.1x2", title: "Capabilities", items: app.capabilities,
          linkTitle: "Learn more about the Monday.com API",
          linkURL: app.docsURL.flatMap(URL.init(string:)))
        ApplicationsExaInfoCard(
          icon: "person.crop.circle.badge.checkmark", title: "What Agents Can Do",
          items: [
            "Discover authorized boards and bounded item pages",
            "Read useful group, typed column, creator, timestamp, subitem, and discussion context",
            "Prepare and perform reviewed item creation, updates, or comments",
          ], linkTitle: nil, linkURL: nil)
        ApplicationsExaInfoCard(
          icon: "lock.shield", title: "Requirements",
          items: marketplaceConnectionRequirements(for: app), linkTitle: nil, linkURL: nil)
      }
    }
  }
  private var agentControls: some View {
    HStack {
      Text(connection.map(mondayConnectionName) ?? "No account saved").font(
        .system(size: 13, weight: .semibold))
      ApplicationsExaSearchField(text: $model.mondayAgentSearch, placeholder: "Search agents...")
        .frame(width: 250)
    }
  }
  private func displayName(_ target: MarketplaceCompatibleAgentTarget) -> String {
    model.agents.first { $0.id == target.agentId }.map(model.resolveAgentDisplayName)
      ?? target.agentName
  }
  private func active(_ id: RelayId) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == id && $0.appSlug == "monday-com"
        && ($0.installStatus == .installed || $0.installStatus == .requested)
    }
  }
  @ViewBuilder private func mondayConnectionRow(_ value: MarketplaceProviderConnection) -> some View
  {
    let selected = connection?.id == value.id
    HStack {
      HStack {
        Button {
          model.selectMondayConnection(value.id)
        } label: {
          Image(systemName: selected ? "largecircle.fill.circle" : "circle")
        }.buttonStyle(.plain)
        Text(mondayConnectionName(value)).font(.system(size: 13, weight: .bold))
        if selected {
          Text("ACTIVE").font(.system(size: 9, weight: .bold)).foregroundStyle(RCTheme.accentBlue)
        }
      }.frame(maxWidth: .infinity, alignment: .leading)
      Text(mondayAccountPreview(value)).lineLimit(1).frame(width: 190, alignment: .leading)
      Text("\(value.grantedScopes.count)").frame(width: 80)
      Text(mondayConnectionStatusText(value)).frame(width: 90)
      HStack {
        Button("Select") { model.selectMondayConnection(value.id) }.disabled(selected)
        Button("Delete", role: .destructive) { model.deleteMondayOAuthConnection(value, for: app) }
      }.frame(width: 130)
    }.font(.system(size: 12, weight: .semibold)).padding(.horizontal, 14).frame(height: 48)
      .background(selected ? RCTheme.sidebarSelected.opacity(0.55) : Color.clear).overlay(
        alignment: .top
      ) { Rectangle().fill(RCTheme.borderSoft).frame(height: 1) }
  }
}

struct ApplicationsMondayAgentSwitchRow: View {
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
  private var confirmation: Binding<Bool> {
    Binding(get: { pending != nil }, set: { if !$0 { pending = nil } })
  }
  var body: some View {
    VStack(alignment: .leading, spacing: 9) {
      HStack {
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
          disabled || model.busy == "toggle-monday-agent-\(target.agentId)"
        ).accessibilityLabel("\(isOn ? "Disconnect" : "Connect") \(name) from Monday.com")
      }
      ApplicationsAgentAuthorityRow(
        app: app, install: install,
        selectedPreset: install.flatMap { model.marketplaceActionPolicyPreset(for: $0) }
          ?? .approvalRequired, muted: !isOn)
    }.padding(12).background(isOn ? RCTheme.sidebarSelected.opacity(0.48) : RCTheme.surfaceInset)
      .clipShape(RoundedRectangle(cornerRadius: 8)).opacity(disabled && !isOn ? 0.72 : 1).alert(
        pending == true ? "Connect \(name) to Monday.com?" : "Disconnect Monday.com for \(name)?",
        isPresented: confirmation
      ) {
        Button("Cancel", role: .cancel) { pending = nil }
        Button(
          pending == true ? "Connect" : "Disconnect", role: pending == true ? nil : .destructive
        ) {
          let enabled = pending ?? !isOn
          pending = nil
          model.setMondayAgentConnection(target.agentId, enabled: enabled, for: app)
        }
      } message: {
        Text(
          pending == true
            ? "This connects the agent with Standard authority."
            : "This removes the agent's Monday.com access.")
      }
  }
}

struct ApplicationsClickUpDetailPanel: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp
  private var connection: MarketplaceProviderConnection? { model.selectedProviderConnection }
  private var connections: [MarketplaceProviderConnection] {
    model.providerConnectionSnapshot?.connections ?? []
  }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    let query = model.clickUpAgentSearch.trimmingCharacters(in: .whitespacesAndNewlines)
      .lowercased()
    return model.visibleMarketplaceCompatibleAgents.filter {
      app.runtimeSupport.contains($0.runtimeType)
    }.filter { query.isEmpty || displayName($0).lowercased().contains(query) }.sorted {
      displayName($0) < displayName($1)
    }
  }
  var body: some View {
    VStack(spacing: 14) {
      ApplicationsExaHeroCard(app: app)
      ApplicationsExaPanel {
        ViewThatFits(in: .horizontal) {
          HStack(alignment: .top) {
            ApplicationsExaSectionHeading(
              icon: "person.2", title: "Agents with ClickUp",
              subtitle: "Assign the active Workspace grant and choose one of four authority levels."
            )
            Spacer()
            agentControls
          }
          VStack(alignment: .leading, spacing: 12) {
            ApplicationsExaSectionHeading(
              icon: "person.2", title: "Agents with ClickUp",
              subtitle: "Assign the active Workspace grant and choose one of four authority levels."
            )
            agentControls
          }
        }
        if connection == nil {
          ApplicationsExaInfoPill(text: "Connect ClickUp below before turning agents on.")
        }
        if targets.isEmpty {
          EmptyMiniLight(
            title: "No available agents",
            body: "ClickUp can be assigned to compatible Hermes and OpenClaw agents.")
        } else {
          ApplicationsAgentGridScroll { ForEach(targets) { target in clickUpAgentRow(target) } }
        }
      }
      ApplicationsExaPanel {
        HStack(alignment: .top) {
          ApplicationsExaSectionHeading(
            icon: "key", title: "Manage API Connection",
            subtitle: "Connect your ClickUp account and choose the Workspaces agents may use.")
          Spacer()
          ApplicationsExaInfoPill(text: "Your ClickUp credentials are never shown to agents.")
        }
        ApplicationsConnectionFormGrid {
          VStack(alignment: .leading, spacing: 8) {
            Text("ClickUp account / Workspaces").font(.system(size: 12, weight: .semibold))
              .foregroundStyle(RCTheme.muted)
            Text(connection.map(clickUpAccountPreview) ?? "No Workspace authorized").font(
              .system(size: 13, weight: .bold)
            ).frame(maxWidth: .infinity, minHeight: 36, alignment: .leading).padding(
              .horizontal, 11
            ).background(RCTheme.fieldBackground).clipShape(RoundedRectangle(cornerRadius: 7))
          }
          VStack(alignment: .leading, spacing: 8) {
            Text("OAuth 2.0 authorization code").font(.system(size: 12, weight: .semibold))
              .foregroundStyle(RCTheme.muted)
            Button {
              model.startClickUpOAuthConnect(for: app)
            } label: {
              Label(
                connection == nil ? "Connect ClickUp" : "Reconnect ClickUp",
                systemImage: "link.badge.plus")
            }.buttonStyle(PrimaryLightButtonStyle()).disabled(
              model.busy == "connect-clickup-oauth" || model.workspace == nil)
          }
        }
        Text(
          "Click Connect, sign in to ClickUp, choose one or more Workspaces, and return automatically."
        ).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        VStack(spacing: 0) {
          HStack {
            Text("Connection").frame(maxWidth: .infinity, alignment: .leading)
            Text("Account / Workspaces").frame(width: 190, alignment: .leading)
            Text("Capabilities").frame(width: 100)
            Text("Status").frame(width: 90)
            Text("Actions").frame(width: 130)
          }.font(.system(size: 11, weight: .bold)).foregroundStyle(RCTheme.muted).padding(
            .horizontal, 14
          ).frame(height: 36)
          if connections.isEmpty {
            EmptyMiniLight(
              title: "No ClickUp OAuth connection", body: "Connect ClickUp before assigning agents."
            ).padding(.vertical, 22)
          } else {
            ForEach(connections) { value in clickUpConnectionRow(value) }
          }
        }.background(RCTheme.surfaceInset).clipShape(RoundedRectangle(cornerRadius: 8)).overlay(
          RoundedRectangle(cornerRadius: 8).stroke(RCTheme.borderSoft))
        if let status = model.clickUpConnectionStatus?.nilIfEmpty {
          Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
      }
      ApplicationsInfoCardsLayout {
        ApplicationsExaInfoCard(
          icon: "checklist", title: "Capabilities", items: app.capabilities,
          linkTitle: "Learn more about the ClickUp API",
          linkURL: app.docsURL.flatMap(URL.init(string:)))
        ApplicationsExaInfoCard(
          icon: "person.crop.circle.badge.checkmark", title: "What Agents Can Do",
          items: [
            "List authorized Workspaces and search bounded tasks",
            "Inspect useful List/task status, priority, assignee, date, and hierarchy context",
            "Prepare and perform reviewed task creation, updates, or comments",
          ], linkTitle: nil, linkURL: nil)
        ApplicationsExaInfoCard(
          icon: "lock.shield", title: "Requirements",
          items: marketplaceConnectionRequirements(for: app), linkTitle: nil, linkURL: nil)
      }
    }
  }
  private var agentControls: some View {
    HStack {
      Text(connection.map(clickUpConnectionName) ?? "No Workspace saved").font(
        .system(size: 13, weight: .semibold))
      ApplicationsExaSearchField(text: $model.clickUpAgentSearch, placeholder: "Search agents...")
        .frame(width: 250)
    }
  }
  private func displayName(_ target: MarketplaceCompatibleAgentTarget) -> String {
    model.agents.first { $0.id == target.agentId }.map(model.resolveAgentDisplayName)
      ?? target.agentName
  }
  private func active(_ id: RelayId) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == id && $0.appSlug == "clickup"
        && ($0.installStatus == .installed || $0.installStatus == .requested)
    }
  }
  @ViewBuilder private func clickUpAgentRow(_ target: MarketplaceCompatibleAgentTarget) -> some View
  {
    let install = active(target.agentId)
    let on = connection != nil && install?.connectionId == connection?.id
    ApplicationsClickUpAgentSwitchRow(
      app: app, target: target, install: install, isOn: on,
      disabled: connection == nil || target.status != .compatible)
  }
  @ViewBuilder private func clickUpConnectionRow(_ value: MarketplaceProviderConnection)
    -> some View
  {
    let selected = connection?.id == value.id
    HStack {
      HStack {
        Button {
          model.selectClickUpConnection(value.id)
        } label: {
          Image(systemName: selected ? "largecircle.fill.circle" : "circle")
        }.buttonStyle(.plain)
        Text(clickUpConnectionName(value)).font(.system(size: 13, weight: .bold))
        if selected {
          Text("ACTIVE").font(.system(size: 9, weight: .bold)).foregroundStyle(RCTheme.accentBlue)
        }
      }.frame(maxWidth: .infinity, alignment: .leading)
      Text(clickUpAccountPreview(value)).lineLimit(1).frame(width: 190, alignment: .leading)
      Text("\(value.grantedScopes.count)").frame(width: 100)
      Text(clickUpConnectionStatusText(value)).frame(width: 90)
      HStack {
        Button("Select") { model.selectClickUpConnection(value.id) }.disabled(selected)
        Button("Delete", role: .destructive) { model.deleteClickUpOAuthConnection(value, for: app) }
      }.frame(width: 130)
    }.font(.system(size: 12, weight: .semibold)).padding(.horizontal, 14).frame(height: 48)
      .background(selected ? RCTheme.sidebarSelected.opacity(0.55) : Color.clear).overlay(
        alignment: .top
      ) { Rectangle().fill(RCTheme.borderSoft).frame(height: 1) }
  }
}

struct ApplicationsClickUpAgentSwitchRow: View {
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
  private var showingConfirmation: Binding<Bool> {
    Binding(get: { pending != nil }, set: { if !$0 { pending = nil } })
  }
  var body: some View {
    VStack(alignment: .leading, spacing: 9) {
      HStack {
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
          disabled || model.busy == "toggle-clickup-agent-\(target.agentId)"
        ).accessibilityLabel("\(isOn ? "Disconnect" : "Connect") \(name) from ClickUp")
      }
      ApplicationsAgentAuthorityRow(
        app: app, install: install,
        selectedPreset: install.flatMap { model.marketplaceActionPolicyPreset(for: $0) }
          ?? .approvalRequired, muted: !isOn)
    }.padding(12).background(isOn ? RCTheme.sidebarSelected.opacity(0.48) : RCTheme.surfaceInset)
      .clipShape(RoundedRectangle(cornerRadius: 8)).opacity(disabled && !isOn ? 0.72 : 1)
      .alert(
        pending == true ? "Connect \(name) to ClickUp?" : "Disconnect ClickUp for \(name)?",
        isPresented: showingConfirmation
      ) {
        Button("Cancel", role: .cancel) { pending = nil }
        Button(
          pending == true ? "Connect" : "Disconnect", role: pending == true ? nil : .destructive
        ) {
          let enabled = pending ?? !isOn
          pending = nil
          model.setClickUpAgentConnection(target.agentId, enabled: enabled, for: app)
        }
      } message: {
        Text(
          pending == true
            ? "This connects the agent with Standard authority."
            : "This removes the agent's ClickUp access.")
      }
  }
}

struct ApplicationsAsanaDetailPanel: View {
  let app: MarketplaceCatalogApp

  var body: some View {
    VStack(spacing: 14) {
      ApplicationsExaHeroCard(app: app)
      ApplicationsAsanaAgentsCard(app: app)
      ApplicationsAsanaConnectionsCard(app: app)
      ApplicationsInfoCardsLayout {
        ApplicationsExaInfoCard(
          icon: "checklist",
          title: "Capabilities",
          items: app.capabilities,
          linkTitle: "Learn more about the Asana API",
          linkURL: app.docsURL.flatMap(URL.init(string:))
        )
        ApplicationsExaInfoCard(
          icon: "person.crop.circle.badge.checkmark",
          title: "What Agents Can Do",
          items: [
            "Find bounded workspace or project tasks with useful status and ownership context",
            "List accessible projects and inspect one task by GID",
            "Prepare, create, or update tasks through Relay approval or Direct rights",
          ],
          linkTitle: nil,
          linkURL: nil
        )
        ApplicationsExaInfoCard(
          icon: "lock.shield",
          title: "Requirements",
          items: marketplaceConnectionRequirements(for: app),
          linkTitle: nil,
          linkURL: nil
        )
      }
    }
  }
}

struct ApplicationsAsanaAgentsCard: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp

  private var connection: MarketplaceProviderConnection? { model.selectedProviderConnection }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    let query = model.asanaAgentSearch.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    return model.visibleMarketplaceCompatibleAgents
      .filter { app.runtimeSupport.contains($0.runtimeType) }
      .filter { target in
        query.isEmpty
          || [displayName(target), exaRuntimeLabel(target.runtimeType)]
            .joined(separator: " ").lowercased().contains(query)
      }
      .sorted {
        displayName($0).localizedCaseInsensitiveCompare(displayName($1)) == .orderedAscending
      }
  }
  private var connectedCount: Int {
    targets.filter { activeInstall($0.agentId)?.connectionId == connection?.id }.count
  }

  var body: some View {
    ApplicationsExaPanel {
      ViewThatFits(in: .horizontal) {
        HStack(alignment: .top, spacing: 14) {
          heading
          Spacer()
          controls
        }
        VStack(alignment: .leading, spacing: 12) {
          heading
          controls
        }
      }
      if targets.isEmpty {
        EmptyMiniLight(
          title: "No available agents",
          body: "Asana can be assigned to compatible Hermes and OpenClaw agents.")
      } else {
        if connection == nil {
          ApplicationsExaInfoPill(text: "Connect Asana below before turning agents on.")
        }
        ApplicationsAgentGridScroll {
          ForEach(targets) { target in
            let install = activeInstall(target.agentId)
            ApplicationsAsanaAgentSwitchRow(
              app: app,
              target: target,
              install: install,
              isOn: connection != nil && install?.connectionId == connection?.id,
              disabled: connection == nil || target.status != .compatible
            )
          }
        }
        HStack {
          Spacer()
          Text("\(connectedCount)").font(.system(size: 13, weight: .bold)).foregroundStyle(
            RCTheme.accentGreen)
          Text("of \(targets.count) agents connected to Asana.").font(
            .system(size: 13, weight: .semibold)
          ).foregroundStyle(RCTheme.muted)
        }
      }
    }
  }

  private var heading: some View {
    ApplicationsExaSectionHeading(
      icon: "person.2", title: "Agents with Asana",
      subtitle: "Select which agents should use the active Asana workspace connection.")
  }
  private var controls: some View {
    HStack(spacing: 10) {
      Text("Active connection:").font(.system(size: 12, weight: .semibold)).foregroundStyle(
        RCTheme.muted)
      Text(connection.map(asanaConnectionName) ?? "No workspace saved")
        .font(.system(size: 13, weight: .semibold)).padding(.horizontal, 12).frame(height: 36)
        .background(RCTheme.surfaceInset).clipShape(RoundedRectangle(cornerRadius: 7))
        .overlay(RoundedRectangle(cornerRadius: 7).stroke(RCTheme.borderSoft))
      ApplicationsExaSearchField(text: $model.asanaAgentSearch, placeholder: "Search agents...")
        .frame(width: 250)
    }
  }
  private func displayName(_ target: MarketplaceCompatibleAgentTarget) -> String {
    model.agents.first { $0.id == target.agentId }.map(model.resolveAgentDisplayName)
      ?? target.agentName
  }
  private func activeInstall(_ agentId: RelayId) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "asana"
        && ($0.installStatus == .installed || $0.installStatus == .requested)
    }
  }
}
