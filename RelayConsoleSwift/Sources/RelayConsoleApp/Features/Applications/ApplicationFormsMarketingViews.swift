import AppKit
import RelayConsoleCore
import SwiftUI
import UniformTypeIdentifiers

struct ApplicationsFilloutDetailPanel: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp
  private var connection: MarketplaceProviderConnection? { model.selectedProviderConnection }
  private var connections: [MarketplaceProviderConnection] {
    model.providerConnectionSnapshot?.connections ?? []
  }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    let q = model.filloutAgentSearch.lowercased()
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
            icon: "person.2", title: "Agents with Fillout",
            subtitle: "Assign the active OAuth grant and provider-returned global/EU API base URL.")
          Spacer()
          ApplicationsExaSearchField(
            text: $model.filloutAgentSearch, placeholder: "Search agents..."
          ).frame(width: 250)
        }
        if connection == nil {
          ApplicationsExaInfoPill(
            text: "Connect a reviewed Fillout OAuth app below before turning agents on.")
        }
        ApplicationsAgentGridScroll {
          ForEach(targets) { target in
            let install = active(target.agentId)
            ApplicationsFilloutAgentSwitchRow(
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
            subtitle: "Relay-owned Fillout third-party OAuth through Railway.")
          Spacer()
          ApplicationsExaInfoPill(text: "One provider-returned access token stays in Keychain.")
        }
        Text(
          "OAuth 2.0 · no documented scopes, refresh, expiry or identity endpoint · global/EU only"
        ).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        Button {
        } label: {
          Label(
            connection == nil ? "Connect Fillout" : "Reconnect Fillout",
            systemImage: "link.badge.plus")
        }.buttonStyle(PrimaryLightButtonStyle()).disabled(true).help(
          "OAuth app review and Railway exchange/base_url/invalidate broker are required")
        Text(
          "Only three approval-gated metadata wrappers exist. Submission content and identity, edit links/previews, schema names, payments, webhooks, writes, Zite/database APIs, pagination, raw APIs and export stay blocked."
        ).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        if connections.isEmpty {
          EmptyMiniLight(
            title: "No Fillout OAuth connection",
            body: "Connect a deployed and reviewed OAuth app before assigning agents."
          ).padding(.vertical, 22)
        } else {
          ForEach(connections) { value in
            HStack {
              Button {
                model.selectFilloutConnection(value.id)
              } label: {
                Image(systemName: connection?.id == value.id ? "largecircle.fill.circle" : "circle")
              }.buttonStyle(.plain)
              Text(value.accountLabel ?? "Fillout OAuth grant")
              Spacer()
              Text(value.health.diagnostics["baseURL"]?.string ?? "origin pending").lineLimit(1)
              Button("Delete", role: .destructive) {
                model.deleteFilloutOAuthConnection(value, for: app)
              }
            }.padding(12)
          }
        }
      }
      ApplicationsInfoCardsLayout {
        ApplicationsExaInfoCard(
          icon: "square.grid.3x3", title: "Capabilities", items: app.capabilities,
          linkTitle: "Fillout REST API", linkURL: app.docsURL.flatMap(URL.init(string:)))
        ApplicationsExaInfoCard(
          icon: "lock.shield", title: "Provider-semantic contract",
          items: [
            "25 Form ID/name summaries", "Exact Form structural category counts",
            "25 finished Submission lifecycle summaries without content",
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
      $0.agentId == id && $0.appSlug == "fillout"
        && ($0.installStatus == .installed || $0.installStatus == .requested)
    }
  }
}
struct ApplicationsFilloutAgentSwitchRow: View {
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
        "Change Fillout access?",
        isPresented: Binding(get: { pending != nil }, set: { if !$0 { pending = nil } })
      ) {
        Button("Cancel", role: .cancel) { pending = nil }
        Button(pending == true ? "Connect" : "Disconnect") {
          let enabled = pending ?? !isOn
          pending = nil
          model.setFilloutAgentConnection(target.agentId, enabled: enabled, for: app)
        }
      } message: {
        Text(
          "This changes only the three bounded metadata wrappers; Submission content remains unavailable."
        )
      }
  }
}
struct ApplicationsMailchimpDetailPanel: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp
  private var connection: MarketplaceProviderConnection? { model.selectedProviderConnection }
  private var connections: [MarketplaceProviderConnection] {
    model.providerConnectionSnapshot?.connections ?? []
  }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    let q = model.mailchimpAgentSearch.lowercased()
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
            icon: "person.2", title: "Agents with Mailchimp",
            subtitle: "Assign the active exact Account and OAuth metadata data-center.")
          Spacer()
          ApplicationsExaSearchField(
            text: $model.mailchimpAgentSearch, placeholder: "Search agents..."
          ).frame(width: 250)
        }
        if connection == nil {
          ApplicationsExaInfoPill(
            text: "Connect a registered Mailchimp OAuth app below before turning agents on.")
        }
        ApplicationsAgentGridScroll {
          ForEach(targets) { target in
            let install = active(target.agentId)
            ApplicationsMailchimpAgentSwitchRow(
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
            subtitle: "Relay-owned Mailchimp OAuth 2.0 through Railway.")
          Spacer()
          ApplicationsExaInfoPill(text: "The non-expiring-until-revoked token stays in Keychain.")
        }
        Text(
          "OAuth 2.0 · metadata data-center + API-root Account/role · no documented scopes or refresh"
        ).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        Button {
        } label: {
          Label(
            connection == nil ? "Connect Mailchimp" : "Reconnect Mailchimp",
            systemImage: "link.badge.plus")
        }.buttonStyle(PrimaryLightButtonStyle()).disabled(true).help(
          "Registered app, Railway exchange/metadata/root/revocation broker and live acceptance are required"
        )
        Text(
          "Only three approval-gated metadata wrappers exist. Contacts, personal data, campaign content/recipients/reports, automations, commerce, exports, batches, webhooks, writes, sends, pagination and raw APIs stay blocked."
        ).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        if connections.isEmpty {
          EmptyMiniLight(
            title: "No Mailchimp OAuth connection",
            body: "Connect a deployed Mailchimp OAuth app before assigning agents."
          ).padding(.vertical, 22)
        } else {
          ForEach(connections) { value in
            HStack {
              Button {
                model.selectMailchimpConnection(value.id)
              } label: {
                Image(systemName: connection?.id == value.id ? "largecircle.fill.circle" : "circle")
              }.buttonStyle(.plain)
              Text(value.accountLabel ?? "Mailchimp account")
              Spacer()
              Text(value.health.diagnostics["dataCenter"]?.string ?? "data center pending")
              Button("Delete", role: .destructive) {
                model.deleteMailchimpOAuthConnection(value, for: app)
              }
            }.padding(12)
          }
        }
      }
      ApplicationsInfoCardsLayout {
        ApplicationsExaInfoCard(
          icon: "square.grid.3x3", title: "Capabilities", items: app.capabilities,
          linkTitle: "Mailchimp Marketing API", linkURL: app.docsURL.flatMap(URL.init(string:)))
        ApplicationsExaInfoCard(
          icon: "lock.shield", title: "Provider-semantic contract",
          items: [
            "Exact Account identity and role", "25 Audience aggregate summaries",
            "25 sent Campaign lifecycle summaries without contacts or content",
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
      $0.agentId == id && $0.appSlug == "mailchimp"
        && ($0.installStatus == .installed || $0.installStatus == .requested)
    }
  }
}
struct ApplicationsMailchimpAgentSwitchRow: View {
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
        "Change Mailchimp access?",
        isPresented: Binding(get: { pending != nil }, set: { if !$0 { pending = nil } })
      ) {
        Button("Cancel", role: .cancel) { pending = nil }
        Button(pending == true ? "Connect" : "Disconnect") {
          let enabled = pending ?? !isOn
          pending = nil
          model.setMailchimpAgentConnection(target.agentId, enabled: enabled, for: app)
        }
      } message: {
        Text(
          "This changes only the three bounded metadata wrappers; contacts and campaign content remain unavailable."
        )
      }
  }
}

struct ApplicationsKlaviyoDetailPanel: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp
  private var connection: MarketplaceProviderConnection? { model.selectedProviderConnection }
  private var connections: [MarketplaceProviderConnection] {
    model.providerConnectionSnapshot?.connections ?? []
  }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    let q = model.klaviyoAgentSearch.lowercased()
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
            icon: "person.2", title: "Agents with Klaviyo",
            subtitle: "Assign the active exact token-bound Account and fixed API revision.")
          Spacer()
          ApplicationsExaSearchField(
            text: $model.klaviyoAgentSearch, placeholder: "Search agents..."
          ).frame(width: 250)
        }
        if connection == nil {
          ApplicationsExaInfoPill(
            text: "Connect a registered Klaviyo OAuth app below before turning agents on.")
        }
        ApplicationsAgentGridScroll {
          ForEach(targets) { target in
            let install = active(target.agentId)
            ApplicationsKlaviyoAgentSwitchRow(
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
            subtitle: "Relay-owned Klaviyo PKCE OAuth 2.0 through Railway.")
          Spacer()
          ApplicationsExaInfoPill(
            text: "The rotating access/refresh pair stays in separate Keychain references.")
        }
        Text(
          "PKCE S256 · accounts:read lists:read campaigns:read · Account-bound · revision 2026-04-15"
        ).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        Button {
        } label: {
          Label(
            connection == nil ? "Connect Klaviyo" : "Reconnect Klaviyo",
            systemImage: "link.badge.plus")
        }.buttonStyle(PrimaryLightButtonStyle()).disabled(true).help(
          "Registered app, Railway exchange/Account validation/serialized refresh/revoke broker and live acceptance are required"
        )
        Text(
          "Only three approval-gated metadata wrappers exist. Profiles, contacts, consent, events, "
            + "metrics, List membership/tags/counts, Campaign names/messages/content/audiences/"
            + "recipients/reports, writes, sends, ingestion, arbitrary cursors/revisions, pagination, "
            + "exports and raw APIs stay blocked."
        ).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        if connections.isEmpty {
          EmptyMiniLight(
            title: "No Klaviyo OAuth connection",
            body: "Connect a deployed Klaviyo OAuth app before assigning agents."
          ).padding(.vertical, 22)
        } else {
          ForEach(connections) { value in
            HStack {
              Button {
                model.selectKlaviyoConnection(value.id)
              } label: {
                Image(systemName: connection?.id == value.id ? "largecircle.fill.circle" : "circle")
              }.buttonStyle(.plain)
              Text(value.accountLabel ?? "Klaviyo account")
              Spacer()
              Text(value.health.diagnostics["apiRevision"]?.string ?? "revision pending")
              Button("Delete", role: .destructive) {
                model.deleteKlaviyoOAuthConnection(value, for: app)
              }
            }.padding(12)
          }
        }
      }
      ApplicationsInfoCardsLayout {
        ApplicationsExaInfoCard(
          icon: "square.grid.3x3", title: "Capabilities", items: app.capabilities,
          linkTitle: "Klaviyo API", linkURL: app.docsURL.flatMap(URL.init(string:)))
        ApplicationsExaInfoCard(
          icon: "lock.shield", title: "Provider-semantic contract",
          items: [
            "Exact Account identity without user identity", "10 recently updated List summaries",
            "25 recent email Campaign lifecycle summaries without names or content",
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
      $0.agentId == id && $0.appSlug == "klaviyo"
        && ($0.installStatus == .installed || $0.installStatus == .requested)
    }
  }
}
struct ApplicationsKlaviyoAgentSwitchRow: View {
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
        "Change Klaviyo access?",
        isPresented: Binding(get: { pending != nil }, set: { if !$0 { pending = nil } })
      ) {
        Button("Cancel", role: .cancel) { pending = nil }
        Button(pending == true ? "Connect" : "Disconnect") {
          let enabled = pending ?? !isOn
          pending = nil
          model.setKlaviyoAgentConnection(target.agentId, enabled: enabled, for: app)
        }
      } message: {
        Text(
          "This changes only the three bounded metadata wrappers; Profiles and Campaign content remain unavailable."
        )
      }
  }
}

struct ApplicationsConvertKitDetailPanel: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp
  private var connection: MarketplaceProviderConnection? { model.selectedProviderConnection }
  private var connections: [MarketplaceProviderConnection] {
    model.providerConnectionSnapshot?.connections ?? []
  }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    let q = model.convertKitAgentSearch.lowercased()
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
            icon: "person.2", title: "Agents with Kit",
            subtitle: "Assign the active exact Creator Account.")
          Spacer()
          ApplicationsExaSearchField(
            text: $model.convertKitAgentSearch, placeholder: "Search agents..."
          ).frame(width: 250)
        }
        if connection == nil {
          ApplicationsExaInfoPill(
            text: "Connect a reviewed Kit OAuth app before turning agents on.")
        }
        ApplicationsAgentGridScroll {
          ForEach(targets) { target in
            let install = active(target.agentId)
            ApplicationsConvertKitAgentSwitchRow(
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
            subtitle: "Relay-owned Kit API v4 OAuth through Railway.")
          Spacer()
          ApplicationsExaInfoPill(text: "The rotating access/refresh pair stays in Keychain.")
        }
        Text(
          "OAuth 2.0 · public scope · exact Creator Account · API v4 · 600 requests/rolling minute"
        ).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        Button {
        } label: {
          Label(connection == nil ? "Connect Kit" : "Reconnect Kit", systemImage: "link.badge.plus")
        }.buttonStyle(PrimaryLightButtonStyle()).disabled(true).help(
          "App Store review, Railway exchange/Account validation/serialized refresh/revoke broker and live acceptance are required"
        )
        Text(
          "Only three approval-gated metadata wrappers exist. Subscribers, contact identity, Form embed URLs, Broadcast subjects/content/audiences/templates/stats, sequences, commerce, writes, sends, cursors, bulk, export and raw APIs stay blocked."
        ).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        if connections.isEmpty {
          EmptyMiniLight(
            title: "No Kit OAuth connection",
            body: "Connect a deployed Kit App Store app before assigning agents."
          ).padding(.vertical, 22)
        } else {
          ForEach(connections) { value in
            HStack {
              Button {
                model.selectConvertKitConnection(value.id)
              } label: {
                Image(systemName: connection?.id == value.id ? "largecircle.fill.circle" : "circle")
              }.buttonStyle(.plain)
              Text(value.accountLabel ?? "Kit Account")
              Spacer()
              Text(value.health.diagnostics["planType"]?.string ?? "plan pending")
              Button("Delete", role: .destructive) {
                model.deleteConvertKitOAuthConnection(value, for: app)
              }
            }.padding(12)
          }
        }
      }
      ApplicationsInfoCardsLayout {
        ApplicationsExaInfoCard(
          icon: "square.grid.3x3", title: "Capabilities", items: app.capabilities,
          linkTitle: "Kit API v4", linkURL: app.docsURL.flatMap(URL.init(string:)))
        ApplicationsExaInfoCard(
          icon: "lock.shield", title: "Provider-semantic contract",
          items: [
            "Exact Account without user/primary emails",
            "20 active Forms without embed URLs/subscribers",
            "20 Broadcast lifecycle summaries without content or audiences",
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
      $0.agentId == id && $0.appSlug == "convertkit"
        && ($0.installStatus == .installed || $0.installStatus == .requested)
    }
  }
}
struct ApplicationsConvertKitAgentSwitchRow: View {
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
        "Change Kit access?",
        isPresented: Binding(get: { pending != nil }, set: { if !$0 { pending = nil } })
      ) {
        Button("Cancel", role: .cancel) { pending = nil }
        Button(pending == true ? "Connect" : "Disconnect") {
          let enabled = pending ?? !isOn
          pending = nil
          model.setConvertKitAgentConnection(target.agentId, enabled: enabled, for: app)
        }
      } message: {
        Text(
          "This changes only the three bounded metadata wrappers; subscribers and Broadcast content remain unavailable."
        )
      }
  }
}

struct ApplicationsCampaignMonitorDetailPanel: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp
  private var connection: MarketplaceProviderConnection? { model.selectedProviderConnection }
  private var connections: [MarketplaceProviderConnection] {
    model.providerConnectionSnapshot?.connections ?? []
  }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    let q = model.campaignMonitorAgentSearch.lowercased()
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
            icon: "person.2", title: "Agents with Campaign Monitor",
            subtitle: "Assign the active exact selected Client.")
          Spacer()
          ApplicationsExaSearchField(
            text: $model.campaignMonitorAgentSearch, placeholder: "Search agents..."
          ).frame(width: 250)
        }
        if connection == nil {
          ApplicationsExaInfoPill(
            text: "Connect a registered Campaign Monitor OAuth app before turning agents on.")
        }
        ApplicationsAgentGridScroll {
          ForEach(targets) { target in
            let install = active(target.agentId)
            ApplicationsCampaignMonitorAgentSwitchRow(
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
            subtitle: "Relay-owned Campaign Monitor OAuth through Railway.")
          Spacer()
          ApplicationsExaInfoPill(text: "The fourteen-day rotating pair stays in Keychain.")
        }
        Text("OAuth 2.0 · ViewReports only · exact selected Client · API v3.3").font(
          .system(size: 12, weight: .semibold)
        ).foregroundStyle(RCTheme.muted)
        Button {
        } label: {
          Label(
            connection == nil ? "Connect Campaign Monitor" : "Reconnect Campaign Monitor",
            systemImage: "link.badge.plus")
        }.buttonStyle(PrimaryLightButtonStyle()).disabled(true).help(
          "OAuth registration, Railway exchange/Client validation/serialized refresh/revoke broker and live acceptance are required"
        )
        Text(
          "Only three approval-gated report wrappers exist. Subscribers, identities, campaign subjects/content/sender/recipients/links, person drilldowns, lists, transactional/journeys/templates, writes, sends, pages and export stay blocked."
        ).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        if connections.isEmpty {
          EmptyMiniLight(
            title: "No Campaign Monitor OAuth connection",
            body:
              "Connect a deployed OAuth app and select one visible Client before assigning agents."
          ).padding(.vertical, 22)
        } else {
          ForEach(connections) { value in
            HStack {
              Button {
                model.selectCampaignMonitorConnection(value.id)
              } label: {
                Image(systemName: connection?.id == value.id ? "largecircle.fill.circle" : "circle")
              }.buttonStyle(.plain)
              Text(value.accountLabel ?? "Campaign Monitor Client")
              Spacer()
              Text(
                value.health.diagnostics["clientId"]?.string.map { String($0.suffix(8)) }
                  ?? "Client pending")
              Button("Delete", role: .destructive) {
                model.deleteCampaignMonitorOAuthConnection(value, for: app)
              }
            }.padding(12)
          }
        }
      }
      ApplicationsInfoCardsLayout {
        ApplicationsExaInfoCard(
          icon: "square.grid.3x3", title: "Capabilities", items: app.capabilities,
          linkTitle: "Campaign Monitor API", linkURL: app.docsURL.flatMap(URL.init(string:)))
        ApplicationsExaInfoCard(
          icon: "lock.shield", title: "Provider-semantic contract",
          items: [
            "Exact selected Client ID/name", "20 recent sent Campaign IDs/dates without content",
            "One aggregate delivery report without subscriber drilldowns",
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
      $0.agentId == id && $0.appSlug == "campaign-monitor"
        && ($0.installStatus == .installed || $0.installStatus == .requested)
    }
  }
}
struct ApplicationsCampaignMonitorAgentSwitchRow: View {
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
        "Change Campaign Monitor access?",
        isPresented: Binding(get: { pending != nil }, set: { if !$0 { pending = nil } })
      ) {
        Button("Cancel", role: .cancel) { pending = nil }
        Button(pending == true ? "Connect" : "Disconnect") {
          let enabled = pending ?? !isOn
          pending = nil
          model.setCampaignMonitorAgentConnection(target.agentId, enabled: enabled, for: app)
        }
      } message: {
        Text(
          "This changes only the three bounded report wrappers; subscribers and Campaign content remain unavailable."
        )
      }
  }
}
