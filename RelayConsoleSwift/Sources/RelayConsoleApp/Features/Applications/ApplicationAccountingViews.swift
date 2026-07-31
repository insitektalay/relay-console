import AppKit
import RelayConsoleCore
import SwiftUI
import UniformTypeIdentifiers

struct ApplicationsXeroDetailPanel: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp
  private var connection: MarketplaceProviderConnection? { model.selectedProviderConnection }
  private var connections: [MarketplaceProviderConnection] {
    model.providerConnectionSnapshot?.connections ?? []
  }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    let q = model.xeroAgentSearch.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
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
            text: "Connect one exact Xero organisation below before turning agents on.")
        }
        if targets.isEmpty {
          EmptyMiniLight(
            title: "No available agents",
            body: "Xero can be assigned to compatible Hermes and OpenClaw agents.")
        } else {
          ApplicationsAgentGridScroll {
            ForEach(targets) { target in
              let install = active(target.agentId)
              ApplicationsXeroAgentSwitchRow(
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
            subtitle: "Connect one organisation with a Xero Web app owned by your business.")
          Spacer()
          ApplicationsExaInfoPill(
            text:
              "Your client secret and Xero tokens are encrypted and never exposed to agents.")
        }
        ApplicationsConnectionFormGrid {
          VStack(alignment: .leading, spacing: 8) {
            Text("Xero client ID").font(.system(size: 12, weight: .semibold)).foregroundStyle(
              RCTheme.muted)
            TextField("Paste your Xero client ID", text: $model.xeroClientIDDraft)
              .textFieldStyle(.roundedBorder)
          }
          VStack(alignment: .leading, spacing: 8) {
            Text("Xero client secret").font(.system(size: 12, weight: .semibold)).foregroundStyle(
              RCTheme.muted)
            SecureField("Paste your Xero client secret", text: $model.xeroClientSecretDraft)
              .textFieldStyle(.roundedBorder)
          }
          VStack(alignment: .leading, spacing: 8) {
            Text("Connect Xero").font(.system(size: 12, weight: .semibold)).foregroundStyle(
              RCTheme.muted)
            Button {
              model.connectXeroOAuth(for: app)
            } label: {
              Label(
                connection == nil ? "Connect Xero" : "Reconnect Xero",
                systemImage: "link.badge.plus")
            }.buttonStyle(PrimaryLightButtonStyle()).disabled(
              model.xeroClientIDDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                || model.xeroClientSecretDraft.trimmingCharacters(in: .whitespacesAndNewlines)
                  .isEmpty
                || model.busy == "connect-xero-oauth"
            )
          }
        }
        Text(
          "In your Xero Web app, add this redirect URI: https://api.relayconsole.work/api/v1/marketplace/oauth/xero/callback. Relay asks only for organisation settings and invoice read access."
        ).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        VStack(spacing: 0) {
          HStack {
            Text("Connection").frame(maxWidth: .infinity, alignment: .leading)
            Text("Organisation / Tenant").frame(width: 190, alignment: .leading)
            Text("Scopes").frame(width: 80)
            Text("Status").frame(width: 90)
            Text("Actions").frame(width: 130)
          }.font(.system(size: 11, weight: .bold)).foregroundStyle(RCTheme.muted).padding(
            .horizontal, 14
          ).frame(height: 36)
          if connections.isEmpty {
            EmptyMiniLight(
              title: "No Xero OAuth connection", body: "Connect Xero before assigning agents."
            ).padding(.vertical, 22)
          } else {
            ForEach(connections) { row($0) }
          }
          HStack {
            Image(systemName: "lightbulb")
            Text(
              "Select one exact ORGANISATION tenant; reconnect if tenant consent, granular scopes, or the rolling token grant changes."
            )
            Spacer()
          }.font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted).padding(
            .horizontal, 14
          ).frame(height: 38).overlay(alignment: .top) {
            Rectangle().fill(RCTheme.borderSoft).frame(height: 1)
          }
        }.background(RCTheme.surfaceInset).clipShape(RoundedRectangle(cornerRadius: 8)).overlay(
          RoundedRectangle(cornerRadius: 8).stroke(RCTheme.borderSoft))
        if let status = model.xeroConnectionStatus?.nilIfEmpty {
          Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
      }
      ApplicationsInfoCardsLayout {
        ApplicationsExaInfoCard(
          icon: "square.grid.3x3", title: "Capabilities", items: app.capabilities,
          linkTitle: "Learn more about Xero OAuth", linkURL: app.docsURL.flatMap(URL.init(string:)))
        ApplicationsExaInfoCard(
          icon: "person.crop.circle.badge.checkmark", title: "What Agents Can Do",
          items: [
            "Inspect the exact connected organisation",
            "List at most 25 redacted invoice summaries",
            "Inspect one exact invoice with decimal amount, currency, date, and status semantics",
          ], linkTitle: nil, linkURL: nil)
        ApplicationsExaInfoCard(
          icon: "lock.shield", title: "Requirements",
          items: marketplaceConnectionRequirements(for: app), linkTitle: nil, linkURL: nil)
      }
    }
  }
  private var heading: some View {
    ApplicationsExaSectionHeading(
      icon: "person.2", title: "Agents with Xero",
      subtitle:
        "Assign the exact read-only organisation grant and choose approval-gated reads, Read only, or No access."
    )
  }
  private var controls: some View {
    HStack {
      Text(connection?.accountLabel ?? "No organisation saved").font(
        .system(size: 13, weight: .semibold))
      ApplicationsExaSearchField(text: $model.xeroAgentSearch, placeholder: "Search agents...")
        .frame(width: 250)
    }
  }
  private func name(_ target: MarketplaceCompatibleAgentTarget) -> String {
    model.agents.first { $0.id == target.agentId }.map(model.resolveAgentDisplayName)
      ?? target.agentName
  }
  private func active(_ id: RelayId) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == id && $0.appSlug == "xero"
        && ($0.installStatus == .installed || $0.installStatus == .requested)
    }
  }
  private func preview(_ value: MarketplaceProviderConnection) -> String {
    "\(value.accountLabel ?? "Xero organisation") · \(value.connectedHandle ?? "tenant unavailable")"
  }
  @ViewBuilder private func row(_ value: MarketplaceProviderConnection) -> some View {
    let selected = connection?.id == value.id
    HStack {
      HStack {
        Button {
          model.selectXeroConnection(value.id)
        } label: {
          Image(systemName: selected ? "largecircle.fill.circle" : "circle")
        }.buttonStyle(.plain)
        Text(value.accountLabel ?? "Xero organisation").font(.system(size: 13, weight: .bold))
        if selected {
          Text("ACTIVE").font(.system(size: 9, weight: .bold)).foregroundStyle(RCTheme.accentBlue)
        }
      }.frame(maxWidth: .infinity, alignment: .leading)
      Text(preview(value)).lineLimit(1).frame(width: 190, alignment: .leading)
      Text("\(value.grantedScopes.count)").frame(width: 80)
      Text(value.status == .connected ? "Ready" : "Setup").frame(width: 90)
      HStack {
        Button("Select") { model.selectXeroConnection(value.id) }.disabled(selected)
        Button("Delete", role: .destructive) { model.deleteXeroOAuthConnection(value, for: app) }
      }.frame(width: 130)
    }.font(.system(size: 12, weight: .semibold)).padding(.horizontal, 14).frame(height: 48)
      .background(selected ? RCTheme.sidebarSelected.opacity(0.55) : Color.clear).overlay(
        alignment: .top
      ) { Rectangle().fill(RCTheme.borderSoft).frame(height: 1) }
  }
}

struct ApplicationsXeroAgentSwitchRow: View {
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
          disabled || model.busy == "toggle-xero-agent-\(target.agentId)"
        ).accessibilityLabel("\(isOn ? "Disconnect" : "Connect") \(name) from Xero")
      }
      ApplicationsAgentAuthorityRow(
        app: app, install: install,
        selectedPreset: install.flatMap { model.marketplaceActionPolicyPreset(for: $0) }
          ?? .approvalRequired, muted: !isOn)
    }.padding(12).background(isOn ? RCTheme.sidebarSelected.opacity(0.48) : RCTheme.surfaceInset)
      .clipShape(RoundedRectangle(cornerRadius: 8)).opacity(disabled && !isOn ? 0.72 : 1).alert(
        pending == true ? "Connect \(name) to Xero?" : "Disconnect Xero for \(name)?",
        isPresented: confirmation
      ) {
        Button("Cancel", role: .cancel) { pending = nil }
        Button(
          pending == true ? "Connect" : "Disconnect", role: pending == true ? nil : .destructive
        ) {
          let enabled = pending ?? !isOn
          pending = nil
          model.setXeroAgentConnection(target.agentId, enabled: enabled, for: app)
        }
      } message: {
        Text(
          pending == true
            ? "This connects approval-gated redacted invoice reads; no accounting writes exist."
            : "This removes the agent's Xero access.")
      }
  }
}

struct ApplicationsQuickBooksDetailPanel: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp
  private var connection: MarketplaceProviderConnection? { model.selectedProviderConnection }
  private var connections: [MarketplaceProviderConnection] {
    model.providerConnectionSnapshot?.connections ?? []
  }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    let q = model.quickBooksAgentSearch.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
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
            text: "Connect one exact QuickBooks Online company below before turning agents on.")
        }
        if targets.isEmpty {
          EmptyMiniLight(
            title: "No available agents",
            body: "QuickBooks Online can be assigned to compatible Hermes and OpenClaw agents.")
        } else {
          ApplicationsAgentGridScroll {
            ForEach(targets) { target in
              let install = active(target.agentId)
              ApplicationsQuickBooksAgentSwitchRow(
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
            icon: "key", title: "Connect QuickBooks",
            subtitle: "Choose the QuickBooks Online company you want your agents to use.")
          Spacer()
          ApplicationsExaInfoPill(
            text: "Your QuickBooks sign-in stays private and can be disconnected at any time.")
        }
        ApplicationsConnectionFormGrid {
          VStack(alignment: .leading, spacing: 8) {
            Text("QuickBooks company / Realm ID / Environment").font(
              .system(size: 12, weight: .semibold)
            ).foregroundStyle(RCTheme.muted)
            Text(connection.map(preview) ?? "No QuickBooks company connected").font(
              .system(size: 13, weight: .bold)
            ).frame(maxWidth: .infinity, minHeight: 36, alignment: .leading).padding(
              .horizontal, 11
            ).background(RCTheme.fieldBackground).clipShape(RoundedRectangle(cornerRadius: 7))
          }
          VStack(alignment: .leading, spacing: 8) {
            Text("Intuit OAuth 2.0").font(.system(size: 12, weight: .semibold)).foregroundStyle(
              RCTheme.muted)
            Button {
              model.connectQuickBooksOAuth(for: app)
            } label: {
              Label(
                connection == nil ? "Connect to QuickBooks" : "Reconnect QuickBooks",
                systemImage: "link.badge.plus")
            }.buttonStyle(PrimaryLightButtonStyle()).disabled(
              model.busy == "connect-quickbooks-oauth")
          }
        }
        Text(
          "Intuit's Accounting scope is broad read/write, payroll.compensation.read is restricted, "
            + "and com.intuit.quickbooks.payment permits payment processing. Relay confines them to "
            + "CompanyInfo, approval-gated Invoice and pay-type reads, and one approval-gated exact "
            + "charge-status read. The Payments wrapper excludes customer identity, cards, bank "
            + "accounts, authorization codes, tokens, receipts, refunds, and every mutation."
        ).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        VStack(spacing: 0) {
          HStack {
            Text("Connection").frame(maxWidth: .infinity, alignment: .leading)
            Text("Company / Realm").frame(width: 190, alignment: .leading)
            Text("Scope").frame(width: 80)
            Text("Status").frame(width: 90)
            Text("Actions").frame(width: 130)
          }.font(.system(size: 11, weight: .bold)).foregroundStyle(RCTheme.muted).padding(
            .horizontal, 14
          ).frame(height: 36)
          if connections.isEmpty {
            EmptyMiniLight(
              title: "No QuickBooks OAuth connection",
              body: "Connect QuickBooks Online before assigning agents."
            ).padding(.vertical, 22)
          } else {
            ForEach(connections) { row($0) }
          }
          HStack {
            Image(systemName: "lightbulb")
            Text(
              "Select one company realm and environment; reconnect if company consent, the Accounting, Payroll Compensation, or Payments grant, or the rolling token pair changes. Payroll Compensation requires production keys and an Intuit Silver+ partner tier."
            )
            Spacer()
          }.font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted).padding(
            .horizontal, 14
          ).frame(height: 38).overlay(alignment: .top) {
            Rectangle().fill(RCTheme.borderSoft).frame(height: 1)
          }
        }.background(RCTheme.surfaceInset).clipShape(RoundedRectangle(cornerRadius: 8)).overlay(
          RoundedRectangle(cornerRadius: 8).stroke(RCTheme.borderSoft))
        if let status = model.quickBooksConnectionStatus?.nilIfEmpty {
          Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
      }
      ApplicationsInfoCardsLayout {
        ApplicationsExaInfoCard(
          icon: "square.grid.3x3", title: "Capabilities", items: app.capabilities,
          linkTitle: "Learn more about Intuit OAuth",
          linkURL: app.docsURL.flatMap(URL.init(string:)))
        ApplicationsExaInfoCard(
          icon: "person.crop.circle.badge.checkmark", title: "What Agents Can Do",
          items: [
            "Inspect the exact connected CompanyInfo",
            "List at most 25 redacted Invoice balance summaries",
            "Inspect one exact Invoice with provider amount, currency, date, delivery, and balance semantics",
            "List at most 10 pay-type assignments for one exact employee ID without identity or payroll amounts",
            "Inspect one exact redacted Payments charge status without customer or payment-instrument data",
          ], linkTitle: nil, linkURL: nil)
        ApplicationsExaInfoCard(
          icon: "lock.shield", title: "Requirements",
          items: marketplaceConnectionRequirements(for: app), linkTitle: nil, linkURL: nil)
      }
    }
  }
  private var heading: some View {
    ApplicationsExaSectionHeading(
      icon: "person.2", title: "Agents with QuickBooks Online",
      subtitle:
        "Assign the exact read-only company grant and choose approval-gated reads, Read only, or No access."
    )
  }
  private var controls: some View {
    HStack {
      Text(connection?.accountLabel ?? "No company saved").font(
        .system(size: 13, weight: .semibold))
      ApplicationsExaSearchField(
        text: $model.quickBooksAgentSearch, placeholder: "Search agents..."
      ).frame(width: 250)
    }
  }
  private func name(_ target: MarketplaceCompatibleAgentTarget) -> String {
    model.agents.first { $0.id == target.agentId }.map(model.resolveAgentDisplayName)
      ?? target.agentName
  }
  private func active(_ id: RelayId) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == id && $0.appSlug == "quickbooks"
        && ($0.installStatus == .installed || $0.installStatus == .requested)
    }
  }
  private func preview(_ value: MarketplaceProviderConnection) -> String {
    let environment = value.health.diagnostics["environment"]?.string ?? "unknown"
    return
      "\(value.accountLabel ?? "QuickBooks company") · \(value.connectedHandle ?? "realm unavailable") · \(environment)"
  }
  @ViewBuilder private func row(_ value: MarketplaceProviderConnection) -> some View {
    let selected = connection?.id == value.id
    HStack {
      HStack {
        Button {
          model.selectQuickBooksConnection(value.id)
        } label: {
          Image(systemName: selected ? "largecircle.fill.circle" : "circle")
        }.buttonStyle(.plain)
        Text(value.accountLabel ?? "QuickBooks company").font(.system(size: 13, weight: .bold))
        if selected {
          Text("ACTIVE").font(.system(size: 9, weight: .bold)).foregroundStyle(RCTheme.accentBlue)
        }
      }.frame(maxWidth: .infinity, alignment: .leading)
      Text(preview(value)).lineLimit(1).frame(width: 190, alignment: .leading)
      Text("\(value.grantedScopes.count)").frame(width: 80)
      Text(value.status == .connected ? "Ready" : "Setup").frame(width: 90)
      HStack {
        Button("Select") { model.selectQuickBooksConnection(value.id) }.disabled(selected)
        Button("Delete", role: .destructive) {
          model.deleteQuickBooksOAuthConnection(value, for: app)
        }
      }.frame(width: 130)
    }.font(.system(size: 12, weight: .semibold)).padding(.horizontal, 14).frame(height: 48)
      .background(selected ? RCTheme.sidebarSelected.opacity(0.55) : Color.clear).overlay(
        alignment: .top
      ) { Rectangle().fill(RCTheme.borderSoft).frame(height: 1) }
  }
}

struct ApplicationsQuickBooksAgentSwitchRow: View {
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
          disabled || model.busy == "toggle-quickbooks-agent-\(target.agentId)"
        ).accessibilityLabel("\(isOn ? "Disconnect" : "Connect") \(name) from QuickBooks Online")
      }
      ApplicationsAgentAuthorityRow(
        app: app, install: install,
        selectedPreset: install.flatMap { model.marketplaceActionPolicyPreset(for: $0) }
          ?? .approvalRequired, muted: !isOn)
    }.padding(12).background(isOn ? RCTheme.sidebarSelected.opacity(0.48) : RCTheme.surfaceInset)
      .clipShape(RoundedRectangle(cornerRadius: 8)).opacity(disabled && !isOn ? 0.72 : 1).alert(
        pending == true
          ? "Connect \(name) to QuickBooks Online?" : "Disconnect QuickBooks Online for \(name)?",
        isPresented: confirmation
      ) {
        Button("Cancel", role: .cancel) { pending = nil }
        Button(
          pending == true ? "Connect" : "Disconnect", role: pending == true ? nil : .destructive
        ) {
          let enabled = pending ?? !isOn
          pending = nil
          model.setQuickBooksAgentConnection(target.agentId, enabled: enabled, for: app)
        }
      } message: {
        Text(
          pending == true
            ? "This connects approval-gated redacted invoice-balance reads; no accounting writes exist."
            : "This removes the agent's QuickBooks Online access.")
      }
  }
}

struct ApplicationsFreshBooksDetailPanel: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp
  private var connection: MarketplaceProviderConnection? { model.selectedProviderConnection }
  private var connections: [MarketplaceProviderConnection] {
    model.providerConnectionSnapshot?.connections ?? []
  }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    let q = model.freshBooksAgentSearch.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
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
            text: "Connect one exact FreshBooks business/account below before turning agents on.")
        }
        if targets.isEmpty {
          EmptyMiniLight(
            title: "No available agents",
            body: "FreshBooks can be assigned to compatible Hermes and OpenClaw agents.")
        } else {
          ApplicationsAgentGridScroll {
            ForEach(targets) { target in
              let install = active(target.agentId)
              ApplicationsFreshBooksAgentSwitchRow(
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
            icon: "key", title: "Connect FreshBooks",
            subtitle: "Sign in and choose the FreshBooks business your agents should use.")
          Spacer()
          ApplicationsExaInfoPill(
            text:
              "Expiring Bearer and single-use rolling refresh tokens stay in two Keychain references."
          )
        }
        ApplicationsConnectionFormGrid {
          VStack(alignment: .leading, spacing: 8) {
            Text("Business / Account ID / Role").font(.system(size: 12, weight: .semibold))
              .foregroundStyle(RCTheme.muted)
            Text(connection.map(preview) ?? "No FreshBooks business connected").font(
              .system(size: 13, weight: .bold)
            ).frame(maxWidth: .infinity, minHeight: 36, alignment: .leading).padding(
              .horizontal, 11
            ).background(RCTheme.fieldBackground).clipShape(RoundedRectangle(cornerRadius: 7))
          }
          VStack(alignment: .leading, spacing: 8) {
            Text("FreshBooks OAuth 2.0").font(.system(size: 12, weight: .semibold)).foregroundStyle(
              RCTheme.muted)
            Button {
              model.connectFreshBooksOAuth(for: app)
            } label: {
              Label(
                connection == nil ? "Connect FreshBooks" : "Reconnect FreshBooks",
                systemImage: "link.badge.plus")
            }.buttonStyle(PrimaryLightButtonStyle()).disabled(
              model.busy == "connect-freshbooks-oauth")
          }
        }
        Text(
          "V1 requests user:profile:read and user:invoices:read only. Profile PII, client identity, addresses, notes, terms, lines, and payment detail are removed; money strings and provider statuses are never reinterpreted."
        ).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        VStack(spacing: 0) {
          HStack {
            Text("Connection").frame(maxWidth: .infinity, alignment: .leading)
            Text("Business / Account").frame(width: 190, alignment: .leading)
            Text("Scopes").frame(width: 80)
            Text("Status").frame(width: 90)
            Text("Actions").frame(width: 130)
          }.font(.system(size: 11, weight: .bold)).foregroundStyle(RCTheme.muted).padding(
            .horizontal, 14
          ).frame(height: 36)
          if connections.isEmpty {
            EmptyMiniLight(
              title: "No FreshBooks OAuth connection",
              body: "Connect FreshBooks before assigning agents."
            ).padding(.vertical, 22)
          } else {
            ForEach(connections) { row($0) }
          }
          HStack {
            Image(systemName: "lightbulb")
            Text(
              "Select one exact business/account; reconnect if membership, account, scopes, or the single-use rolling token grant changes."
            )
            Spacer()
          }.font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted).padding(
            .horizontal, 14
          ).frame(height: 38).overlay(alignment: .top) {
            Rectangle().fill(RCTheme.borderSoft).frame(height: 1)
          }
        }.background(RCTheme.surfaceInset).clipShape(RoundedRectangle(cornerRadius: 8)).overlay(
          RoundedRectangle(cornerRadius: 8).stroke(RCTheme.borderSoft))
        if let status = model.freshBooksConnectionStatus?.nilIfEmpty {
          Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
      }
      ApplicationsInfoCardsLayout {
        ApplicationsExaInfoCard(
          icon: "square.grid.3x3", title: "Capabilities", items: app.capabilities,
          linkTitle: "Learn more about FreshBooks OAuth",
          linkURL: app.docsURL.flatMap(URL.init(string:)))
        ApplicationsExaInfoCard(
          icon: "person.crop.circle.badge.checkmark", title: "What Agents Can Do",
          items: [
            "Inspect selectable business/account memberships without profile PII",
            "List at most 25 redacted Invoice summaries",
            "Inspect one exact Invoice with provider money, currency, date, and status semantics",
          ], linkTitle: nil, linkURL: nil)
        ApplicationsExaInfoCard(
          icon: "lock.shield", title: "Requirements",
          items: marketplaceConnectionRequirements(for: app), linkTitle: nil, linkURL: nil)
      }
    }
  }
  private var heading: some View {
    ApplicationsExaSectionHeading(
      icon: "person.2", title: "Agents with FreshBooks",
      subtitle:
        "Assign the exact read-only business grant and choose approval-gated reads, Read only, or No access."
    )
  }
  private var controls: some View {
    HStack {
      Text(connection?.accountLabel ?? "No business saved").font(
        .system(size: 13, weight: .semibold))
      ApplicationsExaSearchField(
        text: $model.freshBooksAgentSearch, placeholder: "Search agents..."
      ).frame(width: 250)
    }
  }
  private func name(_ target: MarketplaceCompatibleAgentTarget) -> String {
    model.agents.first { $0.id == target.agentId }.map(model.resolveAgentDisplayName)
      ?? target.agentName
  }
  private func active(_ id: RelayId) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == id && $0.appSlug == "freshbooks"
        && ($0.installStatus == .installed || $0.installStatus == .requested)
    }
  }
  private func preview(_ value: MarketplaceProviderConnection) -> String {
    "\(value.accountLabel ?? "FreshBooks business") · \(value.connectedHandle ?? "account unavailable") · \(value.health.diagnostics["membershipRole"]?.string ?? "role unknown")"
  }
  @ViewBuilder private func row(_ value: MarketplaceProviderConnection) -> some View {
    let selected = connection?.id == value.id
    HStack {
      HStack {
        Button {
          model.selectFreshBooksConnection(value.id)
        } label: {
          Image(systemName: selected ? "largecircle.fill.circle" : "circle")
        }.buttonStyle(.plain)
        Text(value.accountLabel ?? "FreshBooks business").font(.system(size: 13, weight: .bold))
        if selected {
          Text("ACTIVE").font(.system(size: 9, weight: .bold)).foregroundStyle(RCTheme.accentBlue)
        }
      }.frame(maxWidth: .infinity, alignment: .leading)
      Text(preview(value)).lineLimit(1).frame(width: 190, alignment: .leading)
      Text("\(value.grantedScopes.count)").frame(width: 80)
      Text(value.status == .connected ? "Ready" : "Setup").frame(width: 90)
      HStack {
        Button("Select") { model.selectFreshBooksConnection(value.id) }.disabled(selected)
        Button("Delete", role: .destructive) {
          model.deleteFreshBooksOAuthConnection(value, for: app)
        }
      }.frame(width: 130)
    }.font(.system(size: 12, weight: .semibold)).padding(.horizontal, 14).frame(height: 48)
      .background(selected ? RCTheme.sidebarSelected.opacity(0.55) : Color.clear).overlay(
        alignment: .top
      ) { Rectangle().fill(RCTheme.borderSoft).frame(height: 1) }
  }
}

struct ApplicationsFreshBooksAgentSwitchRow: View {
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
          disabled || model.busy == "toggle-freshbooks-agent-\(target.agentId)"
        ).accessibilityLabel("\(isOn ? "Disconnect" : "Connect") \(name) from FreshBooks")
      }
      ApplicationsAgentAuthorityRow(
        app: app, install: install,
        selectedPreset: install.flatMap { model.marketplaceActionPolicyPreset(for: $0) }
          ?? .approvalRequired, muted: !isOn)
    }.padding(12).background(isOn ? RCTheme.sidebarSelected.opacity(0.48) : RCTheme.surfaceInset)
      .clipShape(RoundedRectangle(cornerRadius: 8)).opacity(disabled && !isOn ? 0.72 : 1).alert(
        pending == true ? "Connect \(name) to FreshBooks?" : "Disconnect FreshBooks for \(name)?",
        isPresented: confirmation
      ) {
        Button("Cancel", role: .cancel) { pending = nil }
        Button(
          pending == true ? "Connect" : "Disconnect", role: pending == true ? nil : .destructive
        ) {
          let enabled = pending ?? !isOn
          pending = nil
          model.setFreshBooksAgentConnection(target.agentId, enabled: enabled, for: app)
        }
      } message: {
        Text(
          pending == true
            ? "This connects approval-gated redacted invoice reads; no accounting writes exist."
            : "This removes the agent's FreshBooks access.")
      }
  }
}
