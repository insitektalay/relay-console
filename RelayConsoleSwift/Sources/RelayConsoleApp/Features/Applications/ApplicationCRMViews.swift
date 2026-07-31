import AppKit
import RelayConsoleCore
import SwiftUI
import UniformTypeIdentifiers

struct ApplicationsHubSpotDetailPanel: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp
  private var connection: MarketplaceProviderConnection? { model.selectedProviderConnection }
  private var connections: [MarketplaceProviderConnection] {
    model.providerConnectionSnapshot?.connections ?? []
  }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    let q = model.hubSpotAgentSearch.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    return model.visibleMarketplaceCompatibleAgents.filter {
      app.runtimeSupport.contains($0.runtimeType)
    }.filter { q.isEmpty || name($0).lowercased().contains(q) }.sorted { name($0) < name($1) }
  }
  var body: some View {
    VStack(spacing: 14) {
      ApplicationsExaHeroCard(app: app)
      ApplicationsExaPanel {
        ViewThatFits(in: .horizontal) {
          HStack(alignment: .top) {
            heading
            Spacer()
            controls
          }
          VStack(alignment: .leading, spacing: 12) {
            heading
            controls
          }
        }
        if connection == nil {
          ApplicationsExaInfoPill(
            text: "Connect one exact HubSpot account below before turning agents on.")
        }
        if targets.isEmpty {
          EmptyMiniLight(
            title: "No available agents",
            body: "HubSpot can be assigned to compatible Hermes and OpenClaw agents.")
        } else {
          ApplicationsAgentGridScroll {
            ForEach(targets) { target in
              let install = active(target.agentId)
              ApplicationsHubSpotAgentSwitchRow(
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
            icon: "key", title: "Connect HubSpot",
            subtitle: "Choose the HubSpot account your agents should use.")
          Spacer()
          ApplicationsExaInfoPill(
            text: "Relay Console keeps the connection secure.")
        }
        ApplicationsConnectionFormGrid {
          VStack(alignment: .leading, spacing: 8) {
            Text("Connected account").font(.system(size: 12, weight: .semibold))
              .foregroundStyle(RCTheme.muted)
            Text(connection.map(preview) ?? "No HubSpot account connected").font(
              .system(size: 13, weight: .bold)
            ).frame(maxWidth: .infinity, minHeight: 36, alignment: .leading).padding(
              .horizontal, 11
            ).background(RCTheme.fieldBackground).clipShape(RoundedRectangle(cornerRadius: 7))
          }
          VStack(alignment: .leading, spacing: 8) {
            Text("HubSpot sign-in").font(.system(size: 12, weight: .semibold))
              .foregroundStyle(RCTheme.muted)
            Button {
              model.connectHubSpotOAuth(for: app)
            } label: {
              Label(
                connection == nil ? "Connect HubSpot" : "Reconnect HubSpot",
                systemImage: "link.badge.plus")
            }.buttonStyle(PrimaryLightButtonStyle()).disabled(model.busy != nil)
          }
        }
        Text(
          "Agents can read a limited set of Company and Deal details from this account. They cannot view contacts or private communications, change CRM records, run unrestricted searches, or export the account."
        ).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        VStack(spacing: 0) {
          HStack {
            Text("Connection").frame(maxWidth: .infinity, alignment: .leading)
            Text("Account").frame(width: 190, alignment: .leading)
            Text("Scopes").frame(width: 80)
            Text("Status").frame(width: 90)
            Text("Actions").frame(width: 130)
          }.font(.system(size: 11, weight: .bold)).foregroundStyle(RCTheme.muted).padding(
            .horizontal, 14
          ).frame(height: 36)
          if connections.isEmpty {
            EmptyMiniLight(
              title: "No HubSpot OAuth connection", body: "Connect HubSpot before assigning agents."
            ).padding(.vertical, 22)
          } else {
            ForEach(connections) { row($0) }
          }
          HStack {
            Image(systemName: "lightbulb")
            Text(
              "Reconnect if you choose a different HubSpot account or change who can access it.")
            Spacer()
          }.font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted).padding(
            .horizontal, 14
          ).frame(height: 38).overlay(alignment: .top) {
            Rectangle().fill(RCTheme.borderSoft).frame(height: 1)
          }
        }.background(RCTheme.surfaceInset).clipShape(RoundedRectangle(cornerRadius: 8)).overlay(
          RoundedRectangle(cornerRadius: 8).stroke(RCTheme.borderSoft))
        if let status = model.hubSpotConnectionStatus?.nilIfEmpty {
          Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
      }
      ApplicationsInfoCardsLayout {
        ApplicationsExaInfoCard(
          icon: "square.grid.3x3", title: "Capabilities", items: app.capabilities,
          linkTitle: "Learn more about HubSpot OAuth",
          linkURL: app.docsURL.flatMap(URL.init(string:)))
        ApplicationsExaInfoCard(
          icon: "person.crop.circle.badge.checkmark", title: "What Agents Can Do",
          items: [
            "List at most 25 Company summaries", "List at most 25 Deal pipeline/value summaries",
            "Inspect one exact Deal with native HubSpot semantics",
          ], linkTitle: nil, linkURL: nil)
        ApplicationsExaInfoCard(
          icon: "lock.shield", title: "Requirements",
          items: marketplaceConnectionRequirements(for: app), linkTitle: nil, linkURL: nil)
      }
    }
  }
  private var heading: some View {
    ApplicationsExaSectionHeading(
      icon: "person.2", title: "Agents with HubSpot",
      subtitle:
        "Assign the exact account grant and choose approval-gated reads, Read only, or No access.")
  }
  private var controls: some View {
    HStack {
      Text(connection?.accountLabel ?? "No account saved").font(
        .system(size: 13, weight: .semibold))
      ApplicationsExaSearchField(text: $model.hubSpotAgentSearch, placeholder: "Search agents...")
        .frame(width: 250)
    }
  }
  private func name(_ target: MarketplaceCompatibleAgentTarget) -> String {
    model.agents.first { $0.id == target.agentId }.map(model.resolveAgentDisplayName)
      ?? target.agentName
  }
  private func active(_ id: RelayId) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == id && $0.appSlug == "hubspot"
        && ($0.installStatus == .installed || $0.installStatus == .requested)
    }
  }
  private func preview(_ value: MarketplaceProviderConnection) -> String {
    "\(value.accountLabel ?? "HubSpot account") · Hub \(value.connectedHandle ?? "unavailable") · \(value.health.diagnostics["crmAPIVersion"]?.string ?? "API unknown")"
  }
  @ViewBuilder private func row(_ value: MarketplaceProviderConnection) -> some View {
    let selected = connection?.id == value.id
    HStack {
      HStack {
        Button {
          model.selectHubSpotConnection(value.id)
        } label: {
          Image(systemName: selected ? "largecircle.fill.circle" : "circle")
        }.buttonStyle(.plain)
        Text(value.accountLabel ?? "HubSpot account").font(.system(size: 13, weight: .bold))
        if selected {
          Text("ACTIVE").font(.system(size: 9, weight: .bold)).foregroundStyle(RCTheme.accentBlue)
        }
      }.frame(maxWidth: .infinity, alignment: .leading)
      Text(preview(value)).lineLimit(1).frame(width: 190, alignment: .leading)
      Text("\(value.grantedScopes.count)").frame(width: 80)
      Text(value.status == .connected ? "Ready" : "Setup").frame(width: 90)
      HStack {
        Button("Select") { model.selectHubSpotConnection(value.id) }.disabled(selected)
        Button("Delete", role: .destructive) { model.deleteHubSpotOAuthConnection(value, for: app) }
      }.frame(width: 130)
    }.font(.system(size: 12, weight: .semibold)).padding(.horizontal, 14).frame(height: 48)
      .background(selected ? RCTheme.sidebarSelected.opacity(0.55) : Color.clear).overlay(
        alignment: .top
      ) { Rectangle().fill(RCTheme.borderSoft).frame(height: 1) }
  }
}

struct ApplicationsHubSpotAgentSwitchRow: View {
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
          disabled || model.busy == "toggle-hubspot-agent-\(target.agentId)"
        ).accessibilityLabel("\(isOn ? "Disconnect" : "Connect") \(name) from HubSpot")
      }
      ApplicationsAgentAuthorityRow(
        app: app, install: install,
        selectedPreset: install.flatMap { model.marketplaceActionPolicyPreset(for: $0) }
          ?? .approvalRequired, muted: !isOn)
    }.padding(12).background(isOn ? RCTheme.sidebarSelected.opacity(0.48) : RCTheme.surfaceInset)
      .clipShape(RoundedRectangle(cornerRadius: 8)).opacity(disabled && !isOn ? 0.72 : 1).alert(
        pending == true ? "Connect \(name) to HubSpot?" : "Disconnect HubSpot for \(name)?",
        isPresented: confirmation
      ) {
        Button("Cancel", role: .cancel) { pending = nil }
        Button(
          pending == true ? "Connect" : "Disconnect", role: pending == true ? nil : .destructive
        ) {
          let enabled = pending ?? !isOn
          pending = nil
          model.setHubSpotAgentConnection(target.agentId, enabled: enabled, for: app)
        }
      } message: {
        Text(
          pending == true
            ? "This connects approval-gated bounded Company and Deal reads; no CRM writes exist."
            : "This removes the agent's HubSpot access.")
      }
  }
}

struct ApplicationsPipedriveDetailPanel: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp
  private var connection: MarketplaceProviderConnection? { model.selectedProviderConnection }
  private var connections: [MarketplaceProviderConnection] {
    model.providerConnectionSnapshot?.connections ?? []
  }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    let q = model.pipedriveAgentSearch.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    return model.visibleMarketplaceCompatibleAgents.filter {
      app.runtimeSupport.contains($0.runtimeType)
    }.filter { q.isEmpty || name($0).lowercased().contains(q) }.sorted { name($0) < name($1) }
  }
  var body: some View {
    VStack(spacing: 14) {
      ApplicationsExaHeroCard(app: app)
      ApplicationsExaPanel {
        ViewThatFits(in: .horizontal) {
          HStack(alignment: .top) {
            heading
            Spacer()
            controls
          }
          VStack(alignment: .leading, spacing: 12) {
            heading
            controls
          }
        }
        if connection == nil {
          ApplicationsExaInfoPill(
            text: "Connect one exact Pipedrive company below before turning agents on.")
        }
        if targets.isEmpty {
          EmptyMiniLight(
            title: "No available agents",
            body: "Pipedrive can be assigned to compatible Hermes and OpenClaw agents.")
        } else {
          ApplicationsAgentGridScroll {
            ForEach(targets) { target in
              let install = active(target.agentId)
              ApplicationsPipedriveAgentSwitchRow(
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
            icon: "link", title: "Connect Pipedrive",
            subtitle: "Sign in to Pipedrive and choose the company you want agents to use.")
        }
        ApplicationsConnectionFormGrid {
          VStack(alignment: .leading, spacing: 8) {
            Text("Connected company").font(.system(size: 12, weight: .semibold))
              .foregroundStyle(RCTheme.muted)
            Text(connection.map(preview) ?? "No Pipedrive company connected").font(
              .system(size: 13, weight: .bold)
            ).frame(maxWidth: .infinity, minHeight: 36, alignment: .leading).padding(
              .horizontal, 11
            ).background(RCTheme.fieldBackground).clipShape(RoundedRectangle(cornerRadius: 7))
          }
          VStack(alignment: .leading, spacing: 8) {
            Text("Connection").font(.system(size: 12, weight: .semibold)).foregroundStyle(
              RCTheme.muted)
            Button {
              model.connectPipedriveOAuth(for: app)
            } label: {
              Label(
                connection == nil ? "Connect Pipedrive" : "Reconnect Pipedrive",
                systemImage: "link.badge.plus")
            }.buttonStyle(PrimaryLightButtonStyle())
          }
        }
        Text(
          "Agents can list organizations and deals or inspect one exact deal. Personal contact details and changes to your CRM stay unavailable."
        ).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        VStack(spacing: 0) {
          HStack {
            Text("Connection").frame(maxWidth: .infinity, alignment: .leading)
            Text("Company").frame(width: 190, alignment: .leading)
            Text("Access").frame(width: 80)
            Text("Status").frame(width: 90)
            Text("Actions").frame(width: 130)
          }.font(.system(size: 11, weight: .bold)).foregroundStyle(RCTheme.muted).padding(
            .horizontal, 14
          ).frame(height: 36)
          if connections.isEmpty {
            EmptyMiniLight(
              title: "No Pipedrive OAuth connection",
              body: "Connect Pipedrive before assigning agents."
            ).padding(.vertical, 22)
          } else {
            ForEach(connections) { row($0) }
          }
          HStack {
            Image(systemName: "lightbulb")
            Text(
              "Reconnect if you want to use a different Pipedrive company."
            )
            Spacer()
          }.font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted).padding(
            .horizontal, 14
          ).frame(height: 38).overlay(alignment: .top) {
            Rectangle().fill(RCTheme.borderSoft).frame(height: 1)
          }
        }.background(RCTheme.surfaceInset).clipShape(RoundedRectangle(cornerRadius: 8)).overlay(
          RoundedRectangle(cornerRadius: 8).stroke(RCTheme.borderSoft))
        if let status = model.pipedriveConnectionStatus?.nilIfEmpty {
          Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
      }
      ApplicationsInfoCardsLayout {
        ApplicationsExaInfoCard(
          icon: "square.grid.3x3", title: "Capabilities", items: app.capabilities,
          linkTitle: "Learn more about Pipedrive OAuth",
          linkURL: app.docsURL.flatMap(URL.init(string:)))
        ApplicationsExaInfoCard(
          icon: "person.crop.circle.badge.checkmark", title: "What Agents Can Do",
          items: [
            "List at most 25 Organization summaries",
            "List at most 25 Deal pipeline/value summaries",
            "Inspect one exact Deal with native Pipedrive semantics",
          ], linkTitle: nil, linkURL: nil)
        ApplicationsExaInfoCard(
          icon: "lock.shield", title: "Requirements",
          items: marketplaceConnectionRequirements(for: app), linkTitle: nil, linkURL: nil)
      }
    }
  }
  private var heading: some View {
    ApplicationsExaSectionHeading(
      icon: "person.2", title: "Agents with Pipedrive",
      subtitle:
        "Assign the exact company grant and choose approval-gated reads, Read only, or No access.")
  }
  private var controls: some View {
    HStack {
      Text(connection?.accountLabel ?? "No company saved").font(
        .system(size: 13, weight: .semibold))
      ApplicationsExaSearchField(text: $model.pipedriveAgentSearch, placeholder: "Search agents...")
        .frame(width: 250)
    }
  }
  private func name(_ target: MarketplaceCompatibleAgentTarget) -> String {
    model.agents.first { $0.id == target.agentId }.map(model.resolveAgentDisplayName)
      ?? target.agentName
  }
  private func active(_ id: RelayId) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == id && $0.appSlug == "pipedrive"
        && ($0.installStatus == .installed || $0.installStatus == .requested)
    }
  }
  private func preview(_ value: MarketplaceProviderConnection) -> String {
    "\(value.accountLabel ?? "Pipedrive company") · Company \(value.connectedHandle ?? "unavailable") · \(value.health.diagnostics["apiVersion"]?.string ?? "API unknown")"
  }
  @ViewBuilder private func row(_ value: MarketplaceProviderConnection) -> some View {
    let selected = connection?.id == value.id
    HStack {
      HStack {
        Button {
          model.selectPipedriveConnection(value.id)
        } label: {
          Image(systemName: selected ? "largecircle.fill.circle" : "circle")
        }.buttonStyle(.plain)
        Text(value.accountLabel ?? "Pipedrive company").font(.system(size: 13, weight: .bold))
        if selected {
          Text("ACTIVE").font(.system(size: 9, weight: .bold)).foregroundStyle(RCTheme.accentBlue)
        }
      }.frame(maxWidth: .infinity, alignment: .leading)
      Text(preview(value)).lineLimit(1).frame(width: 190, alignment: .leading)
      Text("\(value.grantedScopes.count)").frame(width: 80)
      Text(value.status == .connected ? "Ready" : "Setup").frame(width: 90)
      HStack {
        Button("Select") { model.selectPipedriveConnection(value.id) }.disabled(selected)
        Button("Delete", role: .destructive) {
          model.deletePipedriveOAuthConnection(value, for: app)
        }
      }.frame(width: 130)
    }.font(.system(size: 12, weight: .semibold)).padding(.horizontal, 14).frame(height: 48)
      .background(selected ? RCTheme.sidebarSelected.opacity(0.55) : Color.clear).overlay(
        alignment: .top
      ) { Rectangle().fill(RCTheme.borderSoft).frame(height: 1) }
  }
}

struct ApplicationsPipedriveAgentSwitchRow: View {
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
          disabled || model.busy == "toggle-pipedrive-agent-\(target.agentId)"
        ).accessibilityLabel("\(isOn ? "Disconnect" : "Connect") \(name) from Pipedrive")
      }
      ApplicationsAgentAuthorityRow(
        app: app, install: install,
        selectedPreset: install.flatMap { model.marketplaceActionPolicyPreset(for: $0) }
          ?? .approvalRequired, muted: !isOn)
    }.padding(12).background(isOn ? RCTheme.sidebarSelected.opacity(0.48) : RCTheme.surfaceInset)
      .clipShape(RoundedRectangle(cornerRadius: 8)).opacity(disabled && !isOn ? 0.72 : 1).alert(
        pending == true ? "Connect \(name) to Pipedrive?" : "Disconnect Pipedrive for \(name)?",
        isPresented: confirmation
      ) {
        Button("Cancel", role: .cancel) { pending = nil }
        Button(
          pending == true ? "Connect" : "Disconnect", role: pending == true ? nil : .destructive
        ) {
          let enabled = pending ?? !isOn
          pending = nil
          model.setPipedriveAgentConnection(target.agentId, enabled: enabled, for: app)
        }
      } message: {
        Text(
          pending == true
            ? "This connects approval-gated bounded Organization and Deal reads; no CRM writes exist."
            : "This removes the agent's Pipedrive access.")
      }
  }
}

struct ApplicationsCopperDetailPanel: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp
  private var connection: MarketplaceProviderConnection? { model.selectedProviderConnection }
  private var connections: [MarketplaceProviderConnection] {
    model.providerConnectionSnapshot?.connections ?? []
  }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    let q = model.copperAgentSearch.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    return model.visibleMarketplaceCompatibleAgents.filter {
      app.runtimeSupport.contains($0.runtimeType)
    }.filter { q.isEmpty || name($0).lowercased().contains(q) }.sorted { name($0) < name($1) }
  }
  var body: some View {
    VStack(spacing: 14) {
      ApplicationsExaHeroCard(app: app)
      ApplicationsExaPanel {
        ViewThatFits(in: .horizontal) {
          HStack(alignment: .top) {
            heading
            Spacer()
            controls
          }
          VStack(alignment: .leading, spacing: 12) {
            heading
            controls
          }
        }
        if connection == nil {
          ApplicationsExaInfoPill(
            text: "Connect one exact Copper account below before turning agents on.")
        }
        if targets.isEmpty {
          EmptyMiniLight(
            title: "No available agents",
            body: "Copper can be assigned to compatible Hermes and OpenClaw agents.")
        } else {
          ApplicationsAgentGridScroll {
            ForEach(targets) { target in
              let install = active(target.agentId)
              ApplicationsCopperAgentSwitchRow(
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
            icon: "link", title: "Connect Copper",
            subtitle: "Connect one Copper account through Relay-owned partner OAuth.")
          Spacer()
          ApplicationsExaInfoPill(
            text: "The non-expiring access token stays in one Keychain reference.")
        }
        ApplicationsConnectionFormGrid {
          VStack(alignment: .leading, spacing: 8) {
            Text("Account / ID / Timezone").font(.system(size: 12, weight: .semibold))
              .foregroundStyle(RCTheme.muted)
            Text(connection.map(preview) ?? "No Copper account connected").font(
              .system(size: 13, weight: .bold)
            ).frame(maxWidth: .infinity, minHeight: 36, alignment: .leading).padding(
              .horizontal, 11
            ).background(RCTheme.fieldBackground).clipShape(RoundedRectangle(cornerRadius: 7))
          }
          VStack(alignment: .leading, spacing: 8) {
            Text("Copper OAuth 2.0").font(.system(size: 12, weight: .semibold)).foregroundStyle(
              RCTheme.muted)
            Button {
              model.connectCopperOAuth(for: app)
            } label: {
              Label(
                connection == nil ? "Connect Copper" : "Reconnect Copper",
                systemImage: "link.badge.plus")
            }.buttonStyle(PrimaryLightButtonStyle()).disabled(
              model.busy == "connect-copper-oauth"
            ).help("Open Copper to approve this connection")
          }
        }
        Text(
          "developer/v1/all grants full read and modify access. Relay exposes only three approval-gated Account/Opportunity reads; People, Leads, Users, contact data, activities, descriptions, custom fields, files, writes, arbitrary searches, webhooks, and exports remain blocked."
        ).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        VStack(spacing: 0) {
          HStack {
            Text("Connection").frame(maxWidth: .infinity, alignment: .leading)
            Text("Account / Timezone").frame(width: 190, alignment: .leading)
            Text("Scopes").frame(width: 80)
            Text("Status").frame(width: 90)
            Text("Actions").frame(width: 130)
          }.font(.system(size: 11, weight: .bold)).foregroundStyle(RCTheme.muted).padding(
            .horizontal, 14
          ).frame(height: 36)
          if connections.isEmpty {
            EmptyMiniLight(
              title: "No Copper OAuth connection", body: "Connect Copper before assigning agents."
            ).padding(.vertical, 22)
          } else {
            ForEach(connections) { row($0) }
          }
          HStack {
            Image(systemName: "lightbulb")
            Text(
              "Reconnect after account, scope, app registration, token revocation, or permission changes."
            )
            Spacer()
          }.font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted).padding(
            .horizontal, 14
          ).frame(height: 38).overlay(alignment: .top) {
            Rectangle().fill(RCTheme.borderSoft).frame(height: 1)
          }
        }.background(RCTheme.surfaceInset).clipShape(RoundedRectangle(cornerRadius: 8)).overlay(
          RoundedRectangle(cornerRadius: 8).stroke(RCTheme.borderSoft))
        if let status = model.copperConnectionStatus?.nilIfEmpty {
          Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
      }
      ApplicationsInfoCardsLayout {
        ApplicationsExaInfoCard(
          icon: "square.grid.3x3", title: "Capabilities", items: app.capabilities,
          linkTitle: "Learn more about Copper OAuth",
          linkURL: app.docsURL.flatMap(URL.init(string:)))
        ApplicationsExaInfoCard(
          icon: "person.crop.circle.badge.checkmark", title: "What Agents Can Do",
          items: [
            "Inspect exact Account identity",
            "List at most 25 modified-recent Opportunity summaries",
            "Inspect one exact Opportunity with native Copper semantics",
          ], linkTitle: nil, linkURL: nil)
        ApplicationsExaInfoCard(
          icon: "lock.shield", title: "Requirements",
          items: marketplaceConnectionRequirements(for: app), linkTitle: nil, linkURL: nil)
      }
    }
  }
  private var heading: some View {
    ApplicationsExaSectionHeading(
      icon: "person.2", title: "Agents with Copper",
      subtitle:
        "Assign the exact account grant and choose approval-gated reads, Read only, or No access.")
  }
  private var controls: some View {
    HStack {
      Text(connection?.accountLabel ?? "No account saved").font(
        .system(size: 13, weight: .semibold))
      ApplicationsExaSearchField(text: $model.copperAgentSearch, placeholder: "Search agents...")
        .frame(width: 250)
    }
  }
  private func name(_ target: MarketplaceCompatibleAgentTarget) -> String {
    model.agents.first { $0.id == target.agentId }.map(model.resolveAgentDisplayName)
      ?? target.agentName
  }
  private func active(_ id: RelayId) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == id && $0.appSlug == "copper"
        && ($0.installStatus == .installed || $0.installStatus == .requested)
    }
  }
  private func preview(_ value: MarketplaceProviderConnection) -> String {
    "\(value.accountLabel ?? "Copper account") · Account \(value.connectedHandle ?? "unavailable") · \(value.health.diagnostics["primaryTimezone"]?.string ?? "timezone unknown")"
  }
  @ViewBuilder private func row(_ value: MarketplaceProviderConnection) -> some View {
    let selected = connection?.id == value.id
    HStack {
      HStack {
        Button {
          model.selectCopperConnection(value.id)
        } label: {
          Image(systemName: selected ? "largecircle.fill.circle" : "circle")
        }.buttonStyle(.plain)
        Text(value.accountLabel ?? "Copper account").font(.system(size: 13, weight: .bold))
        if selected {
          Text("ACTIVE").font(.system(size: 9, weight: .bold)).foregroundStyle(RCTheme.accentBlue)
        }
      }.frame(maxWidth: .infinity, alignment: .leading)
      Text(preview(value)).lineLimit(1).frame(width: 190, alignment: .leading)
      Text("\(value.grantedScopes.count)").frame(width: 80)
      Text(value.status == .connected ? "Ready" : "Setup").frame(width: 90)
      HStack {
        Button("Select") { model.selectCopperConnection(value.id) }.disabled(selected)
        Button("Delete", role: .destructive) { model.deleteCopperOAuthConnection(value, for: app) }
      }.frame(width: 130)
    }.font(.system(size: 12, weight: .semibold)).padding(.horizontal, 14).frame(height: 48)
      .background(selected ? RCTheme.sidebarSelected.opacity(0.55) : Color.clear).overlay(
        alignment: .top
      ) { Rectangle().fill(RCTheme.borderSoft).frame(height: 1) }
  }
}

struct ApplicationsCopperAgentSwitchRow: View {
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
          disabled || model.busy == "toggle-copper-agent-\(target.agentId)"
        ).accessibilityLabel("\(isOn ? "Disconnect" : "Connect") \(name) from Copper")
      }
      ApplicationsAgentAuthorityRow(
        app: app, install: install,
        selectedPreset: install.flatMap { model.marketplaceActionPolicyPreset(for: $0) }
          ?? .approvalRequired, muted: !isOn)
    }.padding(12).background(isOn ? RCTheme.sidebarSelected.opacity(0.48) : RCTheme.surfaceInset)
      .clipShape(RoundedRectangle(cornerRadius: 8)).opacity(disabled && !isOn ? 0.72 : 1).alert(
        pending == true ? "Connect \(name) to Copper?" : "Disconnect Copper for \(name)?",
        isPresented: confirmation
      ) {
        Button("Cancel", role: .cancel) { pending = nil }
        Button(
          pending == true ? "Connect" : "Disconnect", role: pending == true ? nil : .destructive
        ) {
          let enabled = pending ?? !isOn
          pending = nil
          model.setCopperAgentConnection(target.agentId, enabled: enabled, for: app)
        }
      } message: {
        Text(
          pending == true
            ? "This connects approval-gated bounded Account and Opportunity reads; Copper's broad scope never enables CRM writes in Relay."
            : "This removes the agent's Copper access.")
      }
  }
}
