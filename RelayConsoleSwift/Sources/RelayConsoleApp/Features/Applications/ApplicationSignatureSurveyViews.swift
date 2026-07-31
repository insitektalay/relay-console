import AppKit
import RelayConsoleCore
import SwiftUI
import UniformTypeIdentifiers

struct ApplicationsDropboxSignDetailPanel: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp
  private var connection: MarketplaceProviderConnection? { model.selectedProviderConnection }
  private var connections: [MarketplaceProviderConnection] {
    model.providerConnectionSnapshot?.connections ?? []
  }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    let query = model.dropboxSignAgentSearch.trimmingCharacters(in: .whitespacesAndNewlines)
      .lowercased()
    return model.visibleMarketplaceCompatibleAgents.filter {
      app.runtimeSupport.contains($0.runtimeType)
    }.filter { query.isEmpty || name($0).lowercased().contains(query) }.sorted {
      name($0) < name($1)
    }
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
            text: "Connect one exact Dropbox Sign account below before turning agents on.")
        }
        if targets.isEmpty {
          EmptyMiniLight(
            title: "No available agents",
            body: "Dropbox Sign can be assigned to compatible Hermes and OpenClaw agents.")
        } else {
          ApplicationsAgentGridScroll {
            ForEach(targets) { target in
              let install = active(target.agentId)
              ApplicationsDropboxSignAgentSwitchRow(
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
            subtitle: "Connect one account through Relay-owned Dropbox Sign OAuth.")
          Spacer()
          ApplicationsExaInfoPill(
            text:
              "Provider-expiring access and refresh credentials stay in two Keychain references.")
        }
        ApplicationsConnectionFormGrid {
          VStack(alignment: .leading, spacing: 8) {
            Text("Dropbox Sign account").font(.system(size: 12, weight: .semibold)).foregroundStyle(
              RCTheme.muted)
            Text(connection.map(preview) ?? "No Dropbox Sign account connected").font(
              .system(size: 13, weight: .bold)
            ).frame(maxWidth: .infinity, minHeight: 36, alignment: .leading).padding(
              .horizontal, 11
            ).background(RCTheme.fieldBackground).clipShape(RoundedRectangle(cornerRadius: 7))
          }
          VStack(alignment: .leading, spacing: 8) {
            Text("OAuth 2.0 · exact account_access signature_request_access").font(
              .system(size: 12, weight: .semibold)
            ).foregroundStyle(RCTheme.muted)
            Button {
            } label: {
              Label(
                connection == nil ? "Connect Dropbox Sign" : "Reconnect Dropbox Sign",
                systemImage: "link.badge.plus")
            }.buttonStyle(PrimaryLightButtonStyle()).disabled(true).help(
              "Relay's user-charged Dropbox Sign API App, production approval and Railway exchange/account-validation/serialized-refresh broker must be configured before consent can open"
            )
          }
        }
        Text(
          "Relay permits only three approval-gated first-page or exact Signature Request reads. "
            + "Participant identity, messages, URLs, metadata, forms, documents/downloads, "
            + "authentication, callbacks, writes, arbitrary searches, pagination, raw APIs, and "
            + "export remain blocked. OAuth can see only requests created through Relay's API App."
        ).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        VStack(spacing: 0) {
          HStack {
            Text("Connection").frame(maxWidth: .infinity, alignment: .leading)
            Text("Account").frame(width: 200, alignment: .leading)
            Text("Scopes").frame(width: 160)
            Text("Status").frame(width: 90)
            Text("Actions").frame(width: 130)
          }.font(.system(size: 11, weight: .bold)).foregroundStyle(RCTheme.muted).padding(
            .horizontal, 14
          ).frame(height: 36)
          if connections.isEmpty {
            EmptyMiniLight(
              title: "No Dropbox Sign OAuth connection",
              body: "Connect an approved Dropbox Sign account before assigning agents."
            ).padding(.vertical, 22)
          } else {
            ForEach(connections) { row($0) }
          }
          HStack {
            Image(systemName: "lightbulb")
            Text(
              "Reconnect after account, plan, app approval, scope, permission, token expiry, refresh, or access changes."
            )
            Spacer()
          }.font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted).padding(
            .horizontal, 14
          ).frame(height: 38).overlay(alignment: .top) {
            Rectangle().fill(RCTheme.borderSoft).frame(height: 1)
          }
        }.background(RCTheme.surfaceInset).clipShape(RoundedRectangle(cornerRadius: 8)).overlay(
          RoundedRectangle(cornerRadius: 8).stroke(RCTheme.borderSoft))
        if let status = model.dropboxSignConnectionStatus?.nilIfEmpty {
          Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
      }
      ApplicationsInfoCardsLayout {
        ApplicationsExaInfoCard(
          icon: "square.grid.3x3", title: "Capabilities", items: app.capabilities,
          linkTitle: "Learn about Dropbox Sign API v3",
          linkURL: app.docsURL.flatMap(URL.init(string:)))
        ApplicationsExaInfoCard(
          icon: "person.crop.circle.badge.checkmark", title: "What Agents Can Do",
          items: [
            "List the first 25 app-visible Signature Request summaries",
            "List 25 app-visible requests awaiting your signature",
            "Inspect one exact Signature Request and aggregate status counts",
          ], linkTitle: nil, linkURL: nil)
        ApplicationsExaInfoCard(
          icon: "lock.shield", title: "Requirements",
          items: marketplaceConnectionRequirements(for: app), linkTitle: nil, linkURL: nil)
      }
    }
  }
  private var heading: some View {
    ApplicationsExaSectionHeading(
      icon: "person.2", title: "Agents with Dropbox Sign",
      subtitle:
        "Assign the exact user-charged account_access and signature_request_access grant and choose approval-gated reads, Read only, or No access."
    )
  }
  private var controls: some View {
    HStack {
      Text(connection?.accountLabel ?? "No account saved").font(
        .system(size: 13, weight: .semibold))
      ApplicationsExaSearchField(
        text: $model.dropboxSignAgentSearch, placeholder: "Search agents..."
      ).frame(width: 250)
    }
  }
  private func name(_ target: MarketplaceCompatibleAgentTarget) -> String {
    model.agents.first { $0.id == target.agentId }.map(model.resolveAgentDisplayName)
      ?? target.agentName
  }
  private func active(_ id: RelayId) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == id && $0.appSlug == "dropbox-sign"
        && ($0.installStatus == .installed || $0.installStatus == .requested)
    }
  }
  private func preview(_ value: MarketplaceProviderConnection) -> String {
    let accountId = value.health.diagnostics["accountId"]?.string ?? "unknown"
    return "\(value.accountLabel ?? "Dropbox Sign account") · …\(String(accountId.suffix(8)))"
  }
  @ViewBuilder private func row(_ value: MarketplaceProviderConnection) -> some View {
    let selected = connection?.id == value.id
    HStack {
      HStack {
        Button {
          model.selectDropboxSignConnection(value.id)
        } label: {
          Image(systemName: selected ? "largecircle.fill.circle" : "circle")
        }.buttonStyle(.plain)
        Text(value.accountLabel ?? "Dropbox Sign account").font(.system(size: 13, weight: .bold))
        if selected {
          Text("ACTIVE").font(.system(size: 9, weight: .bold)).foregroundStyle(RCTheme.accentBlue)
        }
      }.frame(maxWidth: .infinity, alignment: .leading)
      Text(preview(value)).lineLimit(1).frame(width: 200, alignment: .leading)
      Text("account + request access").frame(width: 160)
      Text(value.status == .connected ? "Ready" : "Setup").frame(width: 90)
      HStack {
        Button("Select") { model.selectDropboxSignConnection(value.id) }.disabled(selected)
        Button("Delete", role: .destructive) {
          model.deleteDropboxSignOAuthConnection(value, for: app)
        }
      }.frame(width: 130)
    }.font(.system(size: 12, weight: .semibold)).padding(.horizontal, 14).frame(height: 48)
      .background(selected ? RCTheme.sidebarSelected.opacity(0.55) : Color.clear).overlay(
        alignment: .top
      ) { Rectangle().fill(RCTheme.borderSoft).frame(height: 1) }
  }
}

struct ApplicationsDropboxSignAgentSwitchRow: View {
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
          disabled || model.busy == "toggle-dropbox-sign-agent-\(target.agentId)")
      }
      ApplicationsAgentAuthorityRow(
        app: app, install: install,
        selectedPreset: install.flatMap { model.marketplaceActionPolicyPreset(for: $0) }
          ?? .approvalRequired, muted: !isOn)
    }.padding(12).background(isOn ? RCTheme.sidebarSelected.opacity(0.48) : RCTheme.surfaceInset)
      .clipShape(RoundedRectangle(cornerRadius: 8)).opacity(disabled && !isOn ? 0.72 : 1).alert(
        pending == true
          ? "Connect \(name) to Dropbox Sign?" : "Disconnect Dropbox Sign for \(name)?",
        isPresented: confirmation
      ) {
        Button("Cancel", role: .cancel) { pending = nil }
        Button(
          pending == true ? "Connect" : "Disconnect", role: pending == true ? nil : .destructive
        ) {
          let enabled = pending ?? !isOn
          pending = nil
          model.setDropboxSignAgentConnection(target.agentId, enabled: enabled, for: app)
        }
      } message: {
        Text(
          pending == true
            ? "This connects three approval-gated bounded Signature Request reads for the exact account; no participant, document, write, pagination, download, raw API, or export surface exists."
            : "This removes the agent's Dropbox Sign access.")
      }
  }
}

struct ApplicationsPandaDocDetailPanel: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp
  private var connection: MarketplaceProviderConnection? { model.selectedProviderConnection }
  private var connections: [MarketplaceProviderConnection] {
    model.providerConnectionSnapshot?.connections ?? []
  }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    let query = model.pandaDocAgentSearch.trimmingCharacters(in: .whitespacesAndNewlines)
      .lowercased()
    return model.visibleMarketplaceCompatibleAgents.filter {
      app.runtimeSupport.contains($0.runtimeType)
    }.filter { query.isEmpty || name($0).lowercased().contains(query) }.sorted {
      name($0) < name($1)
    }
  }
  var body: some View {
    VStack(spacing: 14) {
      ApplicationsExaHeroCard(app: app)
      ApplicationsExaPanel {
        HStack {
          ApplicationsExaSectionHeading(
            icon: "person.2", title: "Agents with PandaDoc",
            subtitle:
              "Assign one exact membership and selected token-bound workspace with only the read scope."
          )
          Spacer()
          ApplicationsExaSearchField(
            text: $model.pandaDocAgentSearch, placeholder: "Search agents..."
          ).frame(width: 250)
        }
        if connection == nil {
          ApplicationsExaInfoPill(
            text:
              "Connect one exact PandaDoc membership and workspace below before turning agents on.")
        }
        ApplicationsAgentGridScroll {
          ForEach(targets) { target in
            let install = active(target.agentId)
            ApplicationsPandaDocAgentSwitchRow(
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
            subtitle: "Relay-owned PandaDoc OAuth through the Railway callback.")
          Spacer()
          ApplicationsExaInfoPill(
            text: "Access and refresh credentials stay in two Keychain references.")
        }
        Text("OAuth 2.0 · exact read scope · exact membership/workspace").font(
          .system(size: 12, weight: .semibold)
        ).foregroundStyle(RCTheme.muted)
        Button {
        } label: {
          Label(
            connection == nil ? "Connect PandaDoc" : "Reconnect PandaDoc",
            systemImage: "link.badge.plus")
        }.buttonStyle(PrimaryLightButtonStyle()).disabled(true).help(
          "PandaDoc Developer Dashboard/API plan access and the Railway exchange/membership-workspace-validation/serialized-refresh broker must be configured before consent can open"
        )
        Text(
          "Only three approval-gated wrappers are exposed: 25 recent Document summaries, one exact lightweight Document status, and 25 root Folder summaries. People, fields, pricing/payments, content/files, metadata, details, writes, arbitrary query, pagination, raw APIs, and export stay blocked."
        ).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        if connections.isEmpty {
          EmptyMiniLight(
            title: "No PandaDoc OAuth connection",
            body: "Connect an approved PandaDoc workspace before assigning agents."
          ).padding(.vertical, 22)
        } else {
          ForEach(connections) { value in
            HStack {
              Button {
                model.selectPandaDocConnection(value.id)
              } label: {
                Image(systemName: connection?.id == value.id ? "largecircle.fill.circle" : "circle")
              }.buttonStyle(.plain)
              Text(value.accountLabel ?? "PandaDoc workspace").font(
                .system(size: 13, weight: .bold))
              Spacer()
              Text("read")
              Text(value.status == .connected ? "Ready" : "Setup")
              Button("Delete", role: .destructive) {
                model.deletePandaDocOAuthConnection(value, for: app)
              }
            }.padding(12)
          }
        }
        if let status = model.pandaDocConnectionStatus?.nilIfEmpty {
          Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
      }
      ApplicationsInfoCardsLayout {
        ApplicationsExaInfoCard(
          icon: "square.grid.3x3", title: "Capabilities", items: app.capabilities,
          linkTitle: "Learn about PandaDoc API v1", linkURL: app.docsURL.flatMap(URL.init(string:)))
        ApplicationsExaInfoCard(
          icon: "lock.shield", title: "Provider-semantic contract",
          items: [
            "Fixed previous fourteen-day window; count 25; page 1",
            "Lightweight status endpoint only; never /details",
            "Root folders only; no automatic pagination",
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
      $0.agentId == id && $0.appSlug == "pandadoc"
        && ($0.installStatus == .installed || $0.installStatus == .requested)
    }
  }
}

struct ApplicationsPandaDocAgentSwitchRow: View {
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
          disabled || model.busy == "toggle-pandadoc-agent-\(target.agentId)")
      }
      ApplicationsAgentAuthorityRow(
        app: app, install: install,
        selectedPreset: install.flatMap { model.marketplaceActionPolicyPreset(for: $0) }
          ?? .approvalRequired, muted: !isOn)
    }.padding(12).background(isOn ? RCTheme.sidebarSelected.opacity(0.48) : RCTheme.surfaceInset)
      .clipShape(RoundedRectangle(cornerRadius: 8)).alert(
        pending == true ? "Connect \(name) to PandaDoc?" : "Disconnect PandaDoc for \(name)?",
        isPresented: confirmation
      ) {
        Button("Cancel", role: .cancel) { pending = nil }
        Button(
          pending == true ? "Connect" : "Disconnect", role: pending == true ? nil : .destructive
        ) {
          let enabled = pending ?? !isOn
          pending = nil
          model.setPandaDocAgentConnection(target.agentId, enabled: enabled, for: app)
        }
      } message: {
        Text(
          pending == true
            ? "This connects three approval-gated bounded Document/Folder reads for the exact workspace; private document state, details, writes, pagination, raw APIs, and export remain unavailable."
            : "This removes the agent's PandaDoc access.")
      }
  }
}

struct ApplicationsTypeformDetailPanel: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp
  private var connection: MarketplaceProviderConnection? { model.selectedProviderConnection }
  private var connections: [MarketplaceProviderConnection] {
    model.providerConnectionSnapshot?.connections ?? []
  }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    let q = model.typeformAgentSearch.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    return model.visibleMarketplaceCompatibleAgents.filter {
      app.runtimeSupport.contains($0.runtimeType)
    }.filter { q.isEmpty || name($0).lowercased().contains(q) }.sorted { name($0) < name($1) }
  }
  var body: some View {
    VStack(spacing: 14) {
      ApplicationsExaHeroCard(app: app)
      ApplicationsExaPanel {
        HStack {
          ApplicationsExaSectionHeading(
            icon: "person.2", title: "Agents with Typeform",
            subtitle:
              "Assign one exact account, token-visible workspace and validated global/EU data region."
          )
          Spacer()
          ApplicationsExaSearchField(
            text: $model.typeformAgentSearch, placeholder: "Search agents..."
          ).frame(width: 250)
        }
        if connection == nil {
          ApplicationsExaInfoPill(
            text: "Connect one exact Typeform account and workspace below before turning agents on."
          )
        }
        ApplicationsAgentGridScroll {
          ForEach(targets) { target in
            let install = active(target.agentId)
            ApplicationsTypeformAgentSwitchRow(
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
            subtitle: "Relay-owned Typeform OAuth through the exact Railway callback.")
          Spacer()
          ApplicationsExaInfoPill(
            text: "One-week access and single-use refresh tokens stay in Keychain references.")
        }
        Text("OAuth 2.0 · accounts:read workspaces:read forms:read responses:read offline").font(
          .system(size: 12, weight: .semibold)
        ).foregroundStyle(RCTheme.muted)
        Button {
        } label: {
          Label(
            connection == nil ? "Connect Typeform" : "Reconnect Typeform",
            systemImage: "link.badge.plus")
        }.buttonStyle(PrimaryLightButtonStyle()).disabled(true).help(
          "Typeform Developer App and Railway exchange/account-workspace-region/serialized-refresh broker must be configured before consent can open"
        )
        Text(
          "Three approval-gated wrappers expose only bounded Form summaries and completed response lifecycle metadata. Questions, answers, respondent identity, hidden/calculated values, metadata, files, payments, webhooks, writes, arbitrary filters, pagination, raw APIs, and export stay blocked."
        ).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        if connections.isEmpty {
          EmptyMiniLight(
            title: "No Typeform OAuth connection",
            body: "Connect an approved Typeform workspace before assigning agents."
          ).padding(.vertical, 22)
        } else {
          ForEach(connections) { value in
            HStack {
              Button {
                model.selectTypeformConnection(value.id)
              } label: {
                Image(systemName: connection?.id == value.id ? "largecircle.fill.circle" : "circle")
              }.buttonStyle(.plain)
              Text(value.accountLabel ?? "Typeform workspace").font(
                .system(size: 13, weight: .bold))
              Spacer()
              Text(value.health.diagnostics["apiOrigin"]?.string ?? "region pending").lineLimit(1)
              Text(value.status == .connected ? "Ready" : "Setup")
              Button("Delete", role: .destructive) {
                model.deleteTypeformOAuthConnection(value, for: app)
              }
            }.padding(12)
          }
        }
        if let status = model.typeformConnectionStatus?.nilIfEmpty {
          Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
      }
      ApplicationsInfoCardsLayout {
        ApplicationsExaInfoCard(
          icon: "square.grid.3x3", title: "Capabilities", items: app.capabilities,
          linkTitle: "Learn about Typeform APIs", linkURL: app.docsURL.flatMap(URL.init(string:)))
        ApplicationsExaInfoCard(
          icon: "lock.shield", title: "Provider-semantic contract",
          items: [
            "Selected workspace; page 1; 25 Forms; newest updates first",
            "Exact Form summary without questions or logic",
            "Completed response lifecycle only; fixed fourteen days; 25 maximum",
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
      $0.agentId == id && $0.appSlug == "typeform"
        && ($0.installStatus == .installed || $0.installStatus == .requested)
    }
  }
}

struct ApplicationsTypeformAgentSwitchRow: View {
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
          disabled || model.busy == "toggle-typeform-agent-\(target.agentId)")
      }
      ApplicationsAgentAuthorityRow(
        app: app, install: install,
        selectedPreset: install.flatMap { model.marketplaceActionPolicyPreset(for: $0) }
          ?? .approvalRequired, muted: !isOn)
    }.padding(12).background(isOn ? RCTheme.sidebarSelected.opacity(0.48) : RCTheme.surfaceInset)
      .clipShape(RoundedRectangle(cornerRadius: 8)).alert(
        pending == true ? "Connect \(name) to Typeform?" : "Disconnect Typeform for \(name)?",
        isPresented: confirmation
      ) {
        Button("Cancel", role: .cancel) { pending = nil }
        Button(
          pending == true ? "Connect" : "Disconnect", role: pending == true ? nil : .destructive
        ) {
          let enabled = pending ?? !isOn
          pending = nil
          model.setTypeformAgentConnection(target.agentId, enabled: enabled, for: app)
        }
      } message: {
        Text(
          pending == true
            ? "This connects three approval-gated bounded Form and response-lifecycle reads; no questions, answers, respondent identity, writes, pagination, raw API, or export surface exists."
            : "This removes the agent's Typeform access.")
      }
  }
}

struct ApplicationsSurveyMonkeyDetailPanel: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp
  private var connection: MarketplaceProviderConnection? { model.selectedProviderConnection }
  private var connections: [MarketplaceProviderConnection] {
    model.providerConnectionSnapshot?.connections ?? []
  }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    let q = model.surveyMonkeyAgentSearch.lowercased()
    return model.visibleMarketplaceCompatibleAgents.filter {
      app.runtimeSupport.contains($0.runtimeType)
    }.filter { q.isEmpty || name($0).lowercased().contains(q) }
  }
  var body: some View {
    VStack(spacing: 14) {
      ApplicationsExaHeroCard(app: app)
      ApplicationsExaPanel {
        HStack {
          ApplicationsExaSectionHeading(
            icon: "person.2", title: "Agents with SurveyMonkey",
            subtitle: "Assign one exact OAuth user and provider-returned US/EU/Canada API origin.")
          Spacer()
          ApplicationsExaSearchField(
            text: $model.surveyMonkeyAgentSearch, placeholder: "Search agents..."
          ).frame(width: 250)
        }
        if connection == nil {
          ApplicationsExaInfoPill(
            text: "Connect one exact SurveyMonkey user below before turning agents on.")
        }
        ApplicationsAgentGridScroll {
          ForEach(targets) { target in
            let install = active(target.agentId)
            ApplicationsSurveyMonkeyAgentSwitchRow(
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
            subtitle: "Relay-owned SurveyMonkey Public App OAuth through Railway.")
          Spacer()
          ApplicationsExaInfoPill(
            text: "The currently non-expiring revocable access token stays in Keychain.")
        }
        Text("OAuth 2.0 · users_read surveys_read responses_read · no response details").font(
          .system(size: 12, weight: .semibold)
        ).foregroundStyle(RCTheme.muted)
        Button {
        } label: {
          Label(
            connection == nil ? "Connect SurveyMonkey" : "Reconnect SurveyMonkey",
            systemImage: "link.badge.plus")
        }.buttonStyle(PrimaryLightButtonStyle()).disabled(true).help(
          "Public App deployment and Railway exchange/user/access_url/revoke broker are required")
        Text(
          "Only three approval-gated metadata wrappers exist. Answers, questions, contacts, recipients, IP/custom variables, collectors, detailed/bulk responses, analysis, writes, pagination, raw APIs, and export stay blocked."
        ).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        if connections.isEmpty {
          EmptyMiniLight(
            title: "No SurveyMonkey OAuth connection",
            body: "Connect a deployed Public App before assigning agents."
          ).padding(.vertical, 22)
        } else {
          ForEach(connections) { value in
            HStack {
              Button {
                model.selectSurveyMonkeyConnection(value.id)
              } label: {
                Image(systemName: connection?.id == value.id ? "largecircle.fill.circle" : "circle")
              }.buttonStyle(.plain)
              Text(value.accountLabel ?? "SurveyMonkey user")
              Spacer()
              Text(value.health.diagnostics["accessURL"]?.string ?? "origin pending").lineLimit(1)
              Button("Delete", role: .destructive) {
                model.deleteSurveyMonkeyOAuthConnection(value, for: app)
              }
            }.padding(12)
          }
        }
      }
      ApplicationsInfoCardsLayout {
        ApplicationsExaInfoCard(
          icon: "square.grid.3x3", title: "Capabilities", items: app.capabilities,
          linkTitle: "SurveyMonkey API v3", linkURL: app.docsURL.flatMap(URL.init(string:)))
        ApplicationsExaInfoCard(
          icon: "lock.shield", title: "Provider-semantic contract",
          items: [
            "25 Surveys sorted by modification time", "25 response references for one exact Survey",
            "Exact response metadata without /details or /bulk",
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
      $0.agentId == id && $0.appSlug == "surveymonkey"
        && ($0.installStatus == .installed || $0.installStatus == .requested)
    }
  }
}
struct ApplicationsSurveyMonkeyAgentSwitchRow: View {
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
        "Change SurveyMonkey access?",
        isPresented: Binding(get: { pending != nil }, set: { if !$0 { pending = nil } })
      ) {
        Button("Cancel", role: .cancel) { pending = nil }
        Button(pending == true ? "Connect" : "Disconnect") {
          let enabled = pending ?? !isOn
          pending = nil
          model.setSurveyMonkeyAgentConnection(target.agentId, enabled: enabled, for: app)
        }
      } message: {
        Text(
          "This changes only the three bounded metadata wrappers; response content remains unavailable."
        )
      }
  }
}
