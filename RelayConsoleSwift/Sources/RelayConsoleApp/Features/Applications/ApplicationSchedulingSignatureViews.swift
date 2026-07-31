import AppKit
import RelayConsoleCore
import SwiftUI
import UniformTypeIdentifiers

struct ApplicationsCalendlyDetailPanel: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp
  private var connection: MarketplaceProviderConnection? { model.selectedProviderConnection }
  private var connections: [MarketplaceProviderConnection] {
    model.providerConnectionSnapshot?.connections ?? []
  }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    let q = model.calendlyAgentSearch.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
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
            text:
              "Connect one exact Calendly user and current organization below before turning agents on."
          )
        }
        if targets.isEmpty {
          EmptyMiniLight(
            title: "No available agents",
            body: "Calendly can be assigned to compatible Hermes and OpenClaw agents.")
        } else {
          ApplicationsAgentGridScroll {
            ForEach(targets) { target in
              let install = active(target.agentId)
              ApplicationsCalendlyAgentSwitchRow(
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
            subtitle: "Connect one user through Relay-owned Calendly OAuth.")
          Spacer()
          ApplicationsExaInfoPill(
            text:
              "Two-hour access and single-use rotating refresh credentials stay in two Keychain references."
          )
        }
        ApplicationsConnectionFormGrid {
          VStack(alignment: .leading, spacing: 8) {
            Text("Calendly user / organization").font(.system(size: 12, weight: .semibold))
              .foregroundStyle(RCTheme.muted)
            Text(connection.map(preview) ?? "No Calendly user connected").font(
              .system(size: 13, weight: .bold)
            ).frame(maxWidth: .infinity, minHeight: 36, alignment: .leading).padding(
              .horizontal, 11
            ).background(RCTheme.fieldBackground).clipShape(RoundedRectangle(cornerRadius: 7))
          }
          VStack(alignment: .leading, spacing: 8) {
            Text("OAuth 2.1 PKCE · exact read scopes").font(.system(size: 12, weight: .semibold))
              .foregroundStyle(RCTheme.muted)
            Button {
            } label: {
              Label(
                connection == nil ? "Connect Calendly" : "Reconnect Calendly",
                systemImage: "link.badge.plus")
            }.buttonStyle(PrimaryLightButtonStyle()).disabled(true).help(
              "Relay's Calendly OAuth 2.1 app and production Railway PKCE exchange/serialized-refresh/revoke broker must be configured before consent can open"
            )
          }
        }
        Text(
          "Relay permits only three approval-gated, bounded Event Type and exact-user upcoming "
            + "Scheduled Event reads. Invitee/contact identity, emails, answers, notes, locations, "
            + "conferencing, tracking, broader organization data, webhooks, writes, arbitrary "
            + "queries, pagination, raw APIs, and export remain blocked."
        ).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        VStack(spacing: 0) {
          HStack {
            Text("Connection").frame(maxWidth: .infinity, alignment: .leading)
            Text("User / Organization").frame(width: 190, alignment: .leading)
            Text("Scopes").frame(width: 130)
            Text("Status").frame(width: 90)
            Text("Actions").frame(width: 130)
          }.font(.system(size: 11, weight: .bold)).foregroundStyle(RCTheme.muted).padding(
            .horizontal, 14
          ).frame(height: 36)
          if connections.isEmpty {
            EmptyMiniLight(
              title: "No Calendly OAuth connection",
              body: "Connect Calendly before assigning agents."
            ).padding(.vertical, 22)
          } else {
            ForEach(connections) { row($0) }
          }
          HStack {
            Image(systemName: "lightbulb")
            Text(
              "Reconnect after user, organization, scope, permission, token refresh, or access changes."
            )
            Spacer()
          }.font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted).padding(
            .horizontal, 14
          ).frame(height: 38).overlay(alignment: .top) {
            Rectangle().fill(RCTheme.borderSoft).frame(height: 1)
          }
        }.background(RCTheme.surfaceInset).clipShape(RoundedRectangle(cornerRadius: 8)).overlay(
          RoundedRectangle(cornerRadius: 8).stroke(RCTheme.borderSoft))
        if let status = model.calendlyConnectionStatus?.nilIfEmpty {
          Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
      }
      ApplicationsInfoCardsLayout {
        ApplicationsExaInfoCard(
          icon: "square.grid.3x3", title: "Capabilities", items: app.capabilities,
          linkTitle: "Learn about Calendly API v2", linkURL: app.docsURL.flatMap(URL.init(string:)))
        ApplicationsExaInfoCard(
          icon: "person.crop.circle.badge.checkmark", title: "What Agents Can Do",
          items: [
            "List at most 25 active Event Type summaries",
            "List at most 25 exact-user Scheduled Events in fourteen days",
            "Inspect one exact Scheduled Event summary",
          ], linkTitle: nil, linkURL: nil)
        ApplicationsExaInfoCard(
          icon: "lock.shield", title: "Requirements",
          items: marketplaceConnectionRequirements(for: app), linkTitle: nil, linkURL: nil)
      }
    }
  }
  private var heading: some View {
    ApplicationsExaSectionHeading(
      icon: "person.2", title: "Agents with Calendly",
      subtitle:
        "Assign the exact user/current-organization users:read, event_types:read and scheduled_events:read grant and choose approval-gated reads, Read only, or No access."
    )
  }
  private var controls: some View {
    HStack {
      Text(connection?.accountLabel ?? "No user saved").font(.system(size: 13, weight: .semibold))
      ApplicationsExaSearchField(text: $model.calendlyAgentSearch, placeholder: "Search agents...")
        .frame(width: 250)
    }
  }
  private func name(_ t: MarketplaceCompatibleAgentTarget) -> String {
    model.agents.first { $0.id == t.agentId }.map(model.resolveAgentDisplayName) ?? t.agentName
  }
  private func active(_ id: RelayId) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == id && $0.appSlug == "calendly"
        && ($0.installStatus == .installed || $0.installStatus == .requested)
    }
  }
  private func preview(_ c: MarketplaceProviderConnection) -> String {
    "\(c.health.diagnostics["userName"]?.string ?? c.accountLabel ?? "Calendly user") · \(c.health.diagnostics["organizationName"]?.string ?? "unknown organization")"
  }
  @ViewBuilder private func row(_ c: MarketplaceProviderConnection) -> some View {
    let selected = connection?.id == c.id
    HStack {
      HStack {
        Button {
          model.selectCalendlyConnection(c.id)
        } label: {
          Image(systemName: selected ? "largecircle.fill.circle" : "circle")
        }.buttonStyle(.plain)
        Text(c.accountLabel ?? "Calendly user").font(.system(size: 13, weight: .bold))
        if selected {
          Text("ACTIVE").font(.system(size: 9, weight: .bold)).foregroundStyle(RCTheme.accentBlue)
        }
      }.frame(maxWidth: .infinity, alignment: .leading)
      Text(preview(c)).lineLimit(1).frame(width: 190, alignment: .leading)
      Text("3 read scopes").frame(width: 130)
      Text(c.status == .connected ? "Ready" : "Setup").frame(width: 90)
      HStack {
        Button("Select") { model.selectCalendlyConnection(c.id) }.disabled(selected)
        Button("Delete", role: .destructive) { model.deleteCalendlyOAuthConnection(c, for: app) }
      }.frame(width: 130)
    }.font(.system(size: 12, weight: .semibold)).padding(.horizontal, 14).frame(height: 48)
      .background(selected ? RCTheme.sidebarSelected.opacity(0.55) : Color.clear).overlay(
        alignment: .top
      ) { Rectangle().fill(RCTheme.borderSoft).frame(height: 1) }
  }
}

struct ApplicationsCalendlyAgentSwitchRow: View {
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
          disabled || model.busy == "toggle-calendly-agent-\(target.agentId)")
      }
      ApplicationsAgentAuthorityRow(
        app: app, install: install,
        selectedPreset: install.flatMap { model.marketplaceActionPolicyPreset(for: $0) }
          ?? .approvalRequired, muted: !isOn)
    }.padding(12).background(isOn ? RCTheme.sidebarSelected.opacity(0.48) : RCTheme.surfaceInset)
      .clipShape(RoundedRectangle(cornerRadius: 8)).opacity(disabled && !isOn ? 0.72 : 1).alert(
        pending == true ? "Connect \(name) to Calendly?" : "Disconnect Calendly for \(name)?",
        isPresented: confirmation
      ) {
        Button("Cancel", role: .cancel) { pending = nil }
        Button(
          pending == true ? "Connect" : "Disconnect", role: pending == true ? nil : .destructive
        ) {
          let enabled = pending ?? !isOn
          pending = nil
          model.setCalendlyAgentConnection(target.agentId, enabled: enabled, for: app)
        }
      } message: {
        Text(
          pending == true
            ? "This connects three approval-gated bounded Event Type/Scheduled Event reads under the exact Calendly user and current organization; no invitee PII, organization, webhook, write, pagination, or export surface exists."
            : "This removes the agent's Calendly access.")
      }
  }
}

struct ApplicationsCalComDetailPanel: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp
  private var connection: MarketplaceProviderConnection? { model.selectedProviderConnection }
  private var connections: [MarketplaceProviderConnection] {
    model.providerConnectionSnapshot?.connections ?? []
  }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    let q = model.calComAgentSearch.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
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
            text: "Connect one exact Cal.com user below before turning agents on.")
        }
        if targets.isEmpty {
          EmptyMiniLight(
            title: "No available agents",
            body: "Cal.com can be assigned to compatible Hermes and OpenClaw agents.")
        } else {
          ApplicationsAgentGridScroll {
            ForEach(targets) { target in
              let install = active(target.agentId)
              ApplicationsCalComAgentSwitchRow(
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
            subtitle: "Connect one user through Relay-owned Cal.com OAuth.")
          Spacer()
          ApplicationsExaInfoPill(
            text:
              "Thirty-minute access and provider-returned refresh credentials stay in two Keychain references."
          )
        }
        ApplicationsConnectionFormGrid {
          VStack(alignment: .leading, spacing: 8) {
            Text("Cal.com user / profile").font(.system(size: 12, weight: .semibold))
              .foregroundStyle(RCTheme.muted)
            Text(connection.map(preview) ?? "No Cal.com user connected").font(
              .system(size: 13, weight: .bold)
            ).frame(maxWidth: .infinity, minHeight: 36, alignment: .leading).padding(
              .horizontal, 11
            ).background(RCTheme.fieldBackground).clipShape(RoundedRectangle(cornerRadius: 7))
          }
          VStack(alignment: .leading, spacing: 8) {
            Text("OAuth 2.0 · exact PROFILE_READ, EVENT_TYPE_READ, BOOKING_READ").font(
              .system(size: 12, weight: .semibold)
            ).foregroundStyle(RCTheme.muted)
            Button {
            } label: {
              Label(
                connection == nil ? "Connect Cal.com" : "Reconnect Cal.com",
                systemImage: "link.badge.plus")
            }.buttonStyle(PrimaryLightButtonStyle()).disabled(true).help(
              "Relay's Cal.com OAuth 2.0 app and production Railway exchange/serialized-refresh broker must be configured before consent can open"
            )
          }
        }
        Text(
          "Relay permits only three approval-gated, bounded Booking and exact Event Type reads. "
            + "Descriptions, hosts/attendees/guests and contact identity, locations, conferencing, "
            + "recordings, private links, booking-field answers, cancellation/reschedule details, "
            + "metadata/ratings/ICS, team/organization data, writes, arbitrary queries, pagination, "
            + "raw APIs, and export remain blocked."
        ).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        VStack(spacing: 0) {
          HStack {
            Text("Connection").frame(maxWidth: .infinity, alignment: .leading)
            Text("User / Profile").frame(width: 190, alignment: .leading)
            Text("Scopes").frame(width: 130)
            Text("Status").frame(width: 90)
            Text("Actions").frame(width: 130)
          }.font(.system(size: 11, weight: .bold)).foregroundStyle(RCTheme.muted).padding(
            .horizontal, 14
          ).frame(height: 36)
          if connections.isEmpty {
            EmptyMiniLight(
              title: "No Cal.com OAuth connection", body: "Connect Cal.com before assigning agents."
            ).padding(.vertical, 22)
          } else {
            ForEach(connections) { row($0) }
          }
          HStack {
            Image(systemName: "lightbulb")
            Text(
              "Reconnect after user, profile, scope, permission, token refresh, or access changes.")
            Spacer()
          }.font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted).padding(
            .horizontal, 14
          ).frame(height: 38).overlay(alignment: .top) {
            Rectangle().fill(RCTheme.borderSoft).frame(height: 1)
          }
        }.background(RCTheme.surfaceInset).clipShape(RoundedRectangle(cornerRadius: 8)).overlay(
          RoundedRectangle(cornerRadius: 8).stroke(RCTheme.borderSoft))
        if let status = model.calComConnectionStatus?.nilIfEmpty {
          Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
      }
      ApplicationsInfoCardsLayout {
        ApplicationsExaInfoCard(
          icon: "square.grid.3x3", title: "Capabilities", items: app.capabilities,
          linkTitle: "Learn about Cal.com API v2", linkURL: app.docsURL.flatMap(URL.init(string:)))
        ApplicationsExaInfoCard(
          icon: "person.crop.circle.badge.checkmark", title: "What Agents Can Do",
          items: [
            "List at most 25 upcoming Booking summaries", "Inspect one exact Booking UID",
            "Inspect one exact Event Type ID",
          ], linkTitle: nil, linkURL: nil)
        ApplicationsExaInfoCard(
          icon: "lock.shield", title: "Requirements",
          items: marketplaceConnectionRequirements(for: app), linkTitle: nil, linkURL: nil)
      }
    }
  }
  private var heading: some View {
    ApplicationsExaSectionHeading(
      icon: "person.2", title: "Agents with Cal.com",
      subtitle:
        "Assign the exact-user PROFILE_READ, EVENT_TYPE_READ and BOOKING_READ grant and choose approval-gated reads, Read only, or No access."
    )
  }
  private var controls: some View {
    HStack {
      Text(connection?.accountLabel ?? "No user saved").font(.system(size: 13, weight: .semibold))
      ApplicationsExaSearchField(text: $model.calComAgentSearch, placeholder: "Search agents...")
        .frame(width: 250)
    }
  }
  private func name(_ t: MarketplaceCompatibleAgentTarget) -> String {
    model.agents.first { $0.id == t.agentId }.map(model.resolveAgentDisplayName) ?? t.agentName
  }
  private func active(_ id: RelayId) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == id && $0.appSlug == "cal-com"
        && ($0.installStatus == .installed || $0.installStatus == .requested)
    }
  }
  private func preview(_ c: MarketplaceProviderConnection) -> String {
    "\(c.health.diagnostics["userName"]?.string ?? c.accountLabel ?? "Cal.com user") · \(c.health.diagnostics["username"]?.string ?? "unknown profile")"
  }
  @ViewBuilder private func row(_ c: MarketplaceProviderConnection) -> some View {
    let selected = connection?.id == c.id
    HStack {
      HStack {
        Button {
          model.selectCalComConnection(c.id)
        } label: {
          Image(systemName: selected ? "largecircle.fill.circle" : "circle")
        }.buttonStyle(.plain)
        Text(c.accountLabel ?? "Cal.com user").font(.system(size: 13, weight: .bold))
        if selected {
          Text("ACTIVE").font(.system(size: 9, weight: .bold)).foregroundStyle(RCTheme.accentBlue)
        }
      }.frame(maxWidth: .infinity, alignment: .leading)
      Text(preview(c)).lineLimit(1).frame(width: 190, alignment: .leading)
      Text("3 individual read scopes").frame(width: 130)
      Text(c.status == .connected ? "Ready" : "Setup").frame(width: 90)
      HStack {
        Button("Select") { model.selectCalComConnection(c.id) }.disabled(selected)
        Button("Delete", role: .destructive) { model.deleteCalComOAuthConnection(c, for: app) }
      }.frame(width: 130)
    }.font(.system(size: 12, weight: .semibold)).padding(.horizontal, 14).frame(height: 48)
      .background(selected ? RCTheme.sidebarSelected.opacity(0.55) : Color.clear).overlay(
        alignment: .top
      ) { Rectangle().fill(RCTheme.borderSoft).frame(height: 1) }
  }
}

struct ApplicationsCalComAgentSwitchRow: View {
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
          disabled || model.busy == "toggle-cal-com-agent-\(target.agentId)")
      }
      ApplicationsAgentAuthorityRow(
        app: app, install: install,
        selectedPreset: install.flatMap { model.marketplaceActionPolicyPreset(for: $0) }
          ?? .approvalRequired, muted: !isOn)
    }.padding(12).background(isOn ? RCTheme.sidebarSelected.opacity(0.48) : RCTheme.surfaceInset)
      .clipShape(RoundedRectangle(cornerRadius: 8)).opacity(disabled && !isOn ? 0.72 : 1).alert(
        pending == true ? "Connect \(name) to Cal.com?" : "Disconnect Cal.com for \(name)?",
        isPresented: confirmation
      ) {
        Button("Cancel", role: .cancel) { pending = nil }
        Button(
          pending == true ? "Connect" : "Disconnect", role: pending == true ? nil : .destructive
        ) {
          let enabled = pending ?? !isOn
          pending = nil
          model.setCalComAgentConnection(target.agentId, enabled: enabled, for: app)
        }
      } message: {
        Text(
          pending == true
            ? "This connects three approval-gated bounded Booking/Event Type reads under the exact Cal.com user; no people/private meeting, team/organization, write, pagination, or export surface exists."
            : "This removes the agent's Cal.com access.")
      }
  }
}

struct ApplicationsDocusignDetailPanel: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp
  private var connection: MarketplaceProviderConnection? { model.selectedProviderConnection }
  private var connections: [MarketplaceProviderConnection] {
    model.providerConnectionSnapshot?.connections ?? []
  }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    let query = model.docusignAgentSearch.trimmingCharacters(in: .whitespacesAndNewlines)
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
            text:
              "Connect one exact Docusign user and select one account below before turning agents on."
          )
        }
        if targets.isEmpty {
          EmptyMiniLight(
            title: "No available agents",
            body: "Docusign can be assigned to compatible Hermes and OpenClaw agents.")
        } else {
          ApplicationsAgentGridScroll {
            ForEach(targets) { target in
              let install = active(target.agentId)
              ApplicationsDocusignAgentSwitchRow(
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
              "Connect one user and explicitly selected Docusign account through Relay-owned OAuth."
          )
          Spacer()
          ApplicationsExaInfoPill(
            text:
              "Eight-hour access and extended 30-day refresh credentials stay in two Keychain references."
          )
        }
        ApplicationsConnectionFormGrid {
          VStack(alignment: .leading, spacing: 8) {
            Text("Docusign user / selected account").font(.system(size: 12, weight: .semibold))
              .foregroundStyle(RCTheme.muted)
            Text(connection.map(preview) ?? "No Docusign account connected").font(
              .system(size: 13, weight: .bold)
            ).frame(maxWidth: .infinity, minHeight: 36, alignment: .leading).padding(
              .horizontal, 11
            ).background(RCTheme.fieldBackground).clipShape(RoundedRectangle(cornerRadius: 7))
          }
          VStack(alignment: .leading, spacing: 8) {
            Text("Authorization Code + PKCE · exact signature extended").font(
              .system(size: 12, weight: .semibold)
            ).foregroundStyle(RCTheme.muted)
            Button {
            } label: {
              Label(
                connection == nil ? "Connect Docusign" : "Reconnect Docusign",
                systemImage: "link.badge.plus")
            }.buttonStyle(PrimaryLightButtonStyle()).disabled(true).help(
              "Relay's Docusign integration key, Go-Live review, Railway exchange/UserInfo/account-routing and serialized-refresh broker must be configured before consent can open"
            )
          }
        }
        Text(
          "Relay permits only three approval-gated bounded Envelope reads. Participant identity, "
            + "documents, tabs, forms, payments, authentication, messages, reasons, audits, "
            + "templates, Connect/admin, writes, arbitrary filters, pagination, downloads, raw APIs, "
            + "and export remain blocked. Exact Envelope reads enforce Docusign's fifteen-minute "
            + "polling rule."
        ).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        VStack(spacing: 0) {
          HStack {
            Text("Connection").frame(maxWidth: .infinity, alignment: .leading)
            Text("User / Account").frame(width: 220, alignment: .leading)
            Text("Scopes").frame(width: 120)
            Text("Status").frame(width: 90)
            Text("Actions").frame(width: 130)
          }.font(.system(size: 11, weight: .bold)).foregroundStyle(RCTheme.muted).padding(
            .horizontal, 14
          ).frame(height: 36)
          if connections.isEmpty {
            EmptyMiniLight(
              title: "No Docusign OAuth connection",
              body: "Connect Docusign and select an account before assigning agents."
            ).padding(.vertical, 22)
          } else {
            ForEach(connections) { row($0) }
          }
          HStack {
            Image(systemName: "lightbulb")
            Text(
              "Reconnect after user, account membership/base URI, scope, permission, token refresh, Go-Live, or access changes."
            )
            Spacer()
          }.font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted).padding(
            .horizontal, 14
          ).frame(height: 38).overlay(alignment: .top) {
            Rectangle().fill(RCTheme.borderSoft).frame(height: 1)
          }
        }.background(RCTheme.surfaceInset).clipShape(RoundedRectangle(cornerRadius: 8)).overlay(
          RoundedRectangle(cornerRadius: 8).stroke(RCTheme.borderSoft))
        if let status = model.docusignConnectionStatus?.nilIfEmpty {
          Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
      }
      ApplicationsInfoCardsLayout {
        ApplicationsExaInfoCard(
          icon: "square.grid.3x3", title: "Capabilities", items: app.capabilities,
          linkTitle: "Learn about Docusign eSignature API v2.1",
          linkURL: app.docsURL.flatMap(URL.init(string:)))
        ApplicationsExaInfoCard(
          icon: "person.crop.circle.badge.checkmark", title: "What Agents Can Do",
          items: [
            "List at most 25 recent Envelope summaries",
            "List at most 25 Envelopes awaiting your signature",
            "Inspect one exact Envelope UUID subject and status",
          ], linkTitle: nil, linkURL: nil)
        ApplicationsExaInfoCard(
          icon: "lock.shield", title: "Requirements",
          items: marketplaceConnectionRequirements(for: app), linkTitle: nil, linkURL: nil)
      }
    }
  }
  private var heading: some View {
    ApplicationsExaSectionHeading(
      icon: "person.2", title: "Agents with Docusign",
      subtitle:
        "Assign the exact selected-account signature extended grant and choose approval-gated reads, Read only, or No access."
    )
  }
  private var controls: some View {
    HStack {
      Text(connection?.accountLabel ?? "No account saved").font(
        .system(size: 13, weight: .semibold))
      ApplicationsExaSearchField(text: $model.docusignAgentSearch, placeholder: "Search agents...")
        .frame(width: 250)
    }
  }
  private func name(_ target: MarketplaceCompatibleAgentTarget) -> String {
    model.agents.first { $0.id == target.agentId }.map(model.resolveAgentDisplayName)
      ?? target.agentName
  }
  private func active(_ id: RelayId) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == id && $0.appSlug == "docusign"
        && ($0.installStatus == .installed || $0.installStatus == .requested)
    }
  }
  private func preview(_ value: MarketplaceProviderConnection) -> String {
    "\(value.health.diagnostics["userName"]?.string ?? "Docusign user") · \(value.health.diagnostics["accountName"]?.string ?? value.accountLabel ?? "selected account")"
  }
  @ViewBuilder private func row(_ value: MarketplaceProviderConnection) -> some View {
    let selected = connection?.id == value.id
    HStack {
      HStack {
        Button {
          model.selectDocusignConnection(value.id)
        } label: {
          Image(systemName: selected ? "largecircle.fill.circle" : "circle")
        }.buttonStyle(.plain)
        Text(value.accountLabel ?? "Docusign account").font(.system(size: 13, weight: .bold))
        if selected {
          Text("ACTIVE").font(.system(size: 9, weight: .bold)).foregroundStyle(RCTheme.accentBlue)
        }
      }.frame(maxWidth: .infinity, alignment: .leading)
      Text(preview(value)).lineLimit(1).frame(width: 220, alignment: .leading)
      Text("signature extended").frame(width: 120)
      Text(value.status == .connected ? "Ready" : "Setup").frame(width: 90)
      HStack {
        Button("Select") { model.selectDocusignConnection(value.id) }.disabled(selected)
        Button("Delete", role: .destructive) {
          model.deleteDocusignOAuthConnection(value, for: app)
        }
      }.frame(width: 130)
    }.font(.system(size: 12, weight: .semibold)).padding(.horizontal, 14).frame(height: 48)
      .background(selected ? RCTheme.sidebarSelected.opacity(0.55) : Color.clear).overlay(
        alignment: .top
      ) { Rectangle().fill(RCTheme.borderSoft).frame(height: 1) }
  }
}

struct ApplicationsDocusignAgentSwitchRow: View {
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
          disabled || model.busy == "toggle-docusign-agent-\(target.agentId)")
      }
      ApplicationsAgentAuthorityRow(
        app: app, install: install,
        selectedPreset: install.flatMap { model.marketplaceActionPolicyPreset(for: $0) }
          ?? .approvalRequired, muted: !isOn)
    }.padding(12).background(isOn ? RCTheme.sidebarSelected.opacity(0.48) : RCTheme.surfaceInset)
      .clipShape(RoundedRectangle(cornerRadius: 8)).opacity(disabled && !isOn ? 0.72 : 1).alert(
        pending == true ? "Connect \(name) to Docusign?" : "Disconnect Docusign for \(name)?",
        isPresented: confirmation
      ) {
        Button("Cancel", role: .cancel) { pending = nil }
        Button(
          pending == true ? "Connect" : "Disconnect", role: pending == true ? nil : .destructive
        ) {
          let enabled = pending ?? !isOn
          pending = nil
          model.setDocusignAgentConnection(target.agentId, enabled: enabled, for: app)
        }
      } message: {
        Text(
          pending == true
            ? "This connects three approval-gated bounded Envelope reads for the exact selected account; no participant, document, write, pagination, download, raw API, or export surface exists."
            : "This removes the agent's Docusign access.")
      }
  }
}
