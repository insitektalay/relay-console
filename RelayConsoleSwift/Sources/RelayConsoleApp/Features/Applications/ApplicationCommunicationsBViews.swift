import AppKit
import RelayConsoleCore
import SwiftUI
import UniformTypeIdentifiers

struct ApplicationsEventbriteDetailPanel: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  private var connections: [MarketplaceProviderConnection] {
    (model.providerConnectionSnapshot?.connections ?? []).filter { $0.appSlug == "eventbrite" }
  }
  private var selected: MarketplaceProviderConnection? {
    model.selectedProviderConnection?.appSlug == "eventbrite"
      ? model.selectedProviderConnection : nil
  }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    let query = model.eventbriteAgentSearch.trimmingCharacters(in: .whitespacesAndNewlines)
    return model.visibleMarketplaceCompatibleAgents.filter {
      app.runtimeSupport.contains($0.runtimeType)
        && (query.isEmpty || $0.agentName.localizedCaseInsensitiveContains(query))
    }
  }
  private func install(_ agentId: RelayId) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "eventbrite" && exaInstallIsActive($0)
    }
  }
  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      ApplicationsExaHeroCard(app: app)
      ApplicationsExaPanel {
        HStack {
          ApplicationsExaSectionHeading(
            icon: "person.2", title: "Agents with Eventbrite",
            subtitle: "Assign bounded read-only access to member Organizations and owned Events.")
          Spacer()
          Menu {
            ForEach(connections) { connection in
              Button(connection.accountLabel ?? "Eventbrite user") {
                model.selectEventbriteConnection(connection.id)
              }.disabled(!eventbriteConnectionIsReady(connection))
            }
          } label: {
            Text(selected?.accountLabel ?? "No Eventbrite user selected")
              .font(.system(size: 13, weight: .semibold)).padding(10)
          }.disabled(connections.isEmpty)
          ApplicationsExaSearchField(
            text: $model.eventbriteAgentSearch, placeholder: "Search agents..."
          )
          .frame(width: 240)
        }
        if selected == nil {
          ApplicationsExaInfoPill(
            text:
              "Connect and select one verified Eventbrite user before enabling agents. Rows remain visible with Read only and No access authority."
          )
        }
        ApplicationsAgentGridScroll {
          ForEach(targets) { target in
            ApplicationsEventbriteAgentRow(
              app: app, target: target, install: install(target.agentId),
              selectedConnection: selected,
              disabled: !eventbriteConnectionIsReady(selected) || target.status != .compatible)
          }
        }
      }
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "key", title: "Manage API Connection",
          subtitle: "Railway brokers the approved Eventbrite app and four fixed REST reads.")
        ApplicationsConnectionFormGrid {
          VStack(alignment: .leading, spacing: 8) {
            Text("AUTHENTICATION").font(.system(size: 10, weight: .bold)).foregroundStyle(
              RCTheme.muted)
            Text("Eventbrite OAuth 2.0 server flow").font(.system(size: 13, weight: .semibold))
            Text(
              "Eventbrite documents no selectable OAuth scopes or refresh flow; Relay invents neither."
            )
            .font(.system(size: 10, weight: .semibold)).foregroundStyle(RCTheme.muted)
          }
          VStack(alignment: .leading, spacing: 8) {
            Text("PROVIDER REQUIREMENTS").font(.system(size: 10, weight: .bold)).foregroundStyle(
              RCTheme.muted)
            Text(
              "Approved API application, exact Railway callback, API/privacy/legal review, and Railway-held app key/client secret."
            )
            .font(.system(size: 11, weight: .semibold))
          }
        }
        Button {
          model.startEventbriteOAuthConnect(for: app)
        } label: {
          Label(
            connections.isEmpty ? "Connect Eventbrite" : "Connect another user",
            systemImage: "person.badge.key")
        }.buttonStyle(PrimaryLightButtonStyle()).disabled(
          model.providerConnectionSnapshot?.readOnly == true)
        HStack(spacing: 7) {
          Image(systemName: "lock")
          Text(
            "App secret, authorization code, and user token stay encrypted in Railway; agents receive four fixed Relay wrappers and no attendee, order, ticket, payment, cursor, or raw API access."
          )
        }.font(.system(size: 11, weight: .semibold)).foregroundStyle(RCTheme.muted)
        if let status = model.eventbriteConnectionStatus?.nilIfEmpty {
          Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
        VStack(spacing: 0) {
          HStack {
            Text("SELECT").frame(width: 50, alignment: .leading)
            Text("USER").frame(maxWidth: .infinity, alignment: .leading)
            Text("STATUS").frame(width: 90, alignment: .leading)
            Text("ACTIONS").frame(width: 100, alignment: .trailing)
          }.font(.system(size: 10, weight: .bold)).foregroundStyle(RCTheme.muted)
            .padding(10).background(RCTheme.surfaceInset)
          if connections.isEmpty {
            EmptyMiniLight(
              title: "No Eventbrite connections",
              body:
                "Eventbrite app approval, exact Railway callback and backend deployment are required before agents can be assigned."
            )
            .padding(.vertical, 10)
          } else {
            ForEach(connections) { connection in
              HStack(spacing: 12) {
                Button {
                  model.selectEventbriteConnection(connection.id)
                } label: {
                  Image(
                    systemName: selected?.id == connection.id ? "checkmark.circle.fill" : "circle")
                }.buttonStyle(.plain).frame(width: 38).disabled(
                  !eventbriteConnectionIsReady(connection))
                Text(connection.accountLabel ?? "Eventbrite user").font(
                  .system(size: 13, weight: .bold)
                )
                .frame(maxWidth: .infinity, alignment: .leading)
                Text(eventbriteConnectionIsReady(connection) ? "Ready" : "Blocked")
                  .font(.system(size: 11, weight: .bold)).frame(width: 90, alignment: .leading)
                HStack(spacing: 6) {
                  Button {
                    model.testEventbriteConnection(connection, for: app)
                  } label: {
                    Image(systemName: "arrow.clockwise")
                  }
                  .buttonStyle(IconLightButtonStyle()).help("Test Eventbrite connection")
                  Button {
                    model.deleteEventbriteConnection(connection, for: app)
                  } label: {
                    Image(systemName: "trash")
                  }
                  .buttonStyle(IconLightButtonStyle()).help("Delete Eventbrite connection")
                }.frame(width: 100, alignment: .trailing)
              }.padding(10).overlay(alignment: .bottom) { Divider() }
            }
          }
          Text(
            "Only a healthy user-bound connection with fixed-endpoint and Organization-membership diagnostics can be selected."
          )
          .font(.system(size: 10, weight: .semibold)).foregroundStyle(RCTheme.muted)
          .frame(maxWidth: .infinity, alignment: .leading).padding(10)
        }.overlay(RoundedRectangle(cornerRadius: 8).stroke(RCTheme.borderSoft))
      }
      ApplicationsInfoCardsLayout {
        ApplicationsExaInfoCard(
          icon: "calendar", title: "Capabilities", items: app.capabilities,
          linkTitle: "Eventbrite Platform documentation",
          linkURL: app.docsURL.flatMap(URL.init(string:)))
        ApplicationsExaInfoCard(
          icon: "sparkles", title: "What Agents Can Do",
          items: [
            "Verify the connected Eventbrite user",
            "List member Organizations and bounded owned Events",
            "Inspect one Event's useful schedule and Venue fields",
          ], linkTitle: nil, linkURL: nil)
        ApplicationsExaInfoCard(
          icon: "checklist", title: "Requirements",
          items: [
            "Approved Eventbrite API app and exact Railway callback",
            "Railway-held app key, client secret, and user token",
            "No writes, attendees, orders, tickets, payments, pagination, Manage ESR, or raw API",
          ], linkTitle: nil, linkURL: nil)
      }
    }
  }
}

struct ApplicationsEventbriteAgentRow: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  let target: MarketplaceCompatibleAgentTarget
  let install: MarketplaceInstallRecord?
  let selectedConnection: MarketplaceProviderConnection?
  let disabled: Bool
  @State private var pending: Bool?
  private var isOn: Bool { install?.connectionId == selectedConnection?.id }
  var body: some View {
    VStack(alignment: .leading, spacing: 9) {
      HStack(spacing: 12) {
        AgentAvatarView(
          name: target.agentName, avatarURL: model.agentAvatar(target.agentId), size: 38)
        VStack(alignment: .leading, spacing: 3) {
          Text(target.agentName).font(.system(size: 13, weight: .semibold))
          Text(exaRuntimeLabel(target.runtimeType)).font(.system(size: 12, weight: .semibold))
            .foregroundStyle(RCTheme.muted)
        }
        Spacer()
        Button {
          pending = !isOn
        } label: {
          ApplicationsExaSwitch(isOn: isOn)
        }
        .buttonStyle(.plain).disabled(
          disabled || model.busy == "toggle-eventbrite-agent-\(target.agentId)")
      }
      ApplicationsAgentAuthorityRow(
        app: app, install: install,
        selectedPreset: install.flatMap { model.marketplaceActionPolicyPreset(for: $0) }
          ?? .readOnly,
        muted: !isOn)
    }.padding(12).background(isOn ? RCTheme.sidebarSelected.opacity(0.48) : RCTheme.surfaceInset)
      .clipShape(RoundedRectangle(cornerRadius: 8)).opacity(disabled && !isOn ? 0.72 : 1)
      .alert(
        pending == true ? "Connect agent to Eventbrite?" : "Disconnect Eventbrite for this agent?",
        isPresented: Binding(get: { pending != nil }, set: { if !$0 { pending = nil } })
      ) {
        Button("Cancel", role: .cancel) { pending = nil }
        Button(
          pending == true ? "Connect" : "Disconnect", role: pending == true ? nil : .destructive
        ) {
          let enabled = pending ?? !isOn
          pending = nil
          model.setEventbriteAgentConnection(target.agentId, enabled: enabled, for: app)
        }
      } message: {
        Text("This changes only the agent's four fixed read-only Eventbrite Relay wrappers.")
      }
  }
}

func webexConnectionIsReady(_ connection: MarketplaceProviderConnection?) -> Bool {
  guard let connection else { return false }
  return connection.appSlug == "webex" && connection.status == .connected
    && connection.health.state == .ready
    && Set(connection.grantedScopes) == Set(["spark:people_read", "meeting:schedules_read"])
    && connection.health.diagnostics["railwayCallbackOnly"]?.bool == true
    && connection.health.diagnostics["stateVerified"]?.bool == true
    && connection.health.diagnostics["pkceS256"]?.bool == true
    && connection.health.diagnostics["personVerified"]?.bool == true
    && connection.health.diagnostics["fixedEndpointsOnly"]?.bool == true
    && connection.health.diagnostics["automaticRetry"]?.bool == false
    && connection.health.diagnostics["automaticPagination"]?.bool == false
    && connection.health.diagnostics["rawToolsEnabled"]?.bool == false
}

struct ApplicationsWebexDetailPanel: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  private var connections: [MarketplaceProviderConnection] {
    (model.providerConnectionSnapshot?.connections ?? []).filter { $0.appSlug == "webex" }
  }
  private var selected: MarketplaceProviderConnection? {
    model.selectedProviderConnection?.appSlug == "webex" ? model.selectedProviderConnection : nil
  }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    let query = model.webexAgentSearch.trimmingCharacters(in: .whitespacesAndNewlines)
    return model.visibleMarketplaceCompatibleAgents.filter {
      app.runtimeSupport.contains($0.runtimeType)
        && (query.isEmpty || $0.agentName.localizedCaseInsensitiveContains(query))
    }
  }
  private func install(_ agentId: RelayId) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "webex" && exaInstallIsActive($0)
    }
  }
  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      ApplicationsExaHeroCard(app: app)
      ApplicationsExaPanel {
        HStack {
          ApplicationsExaSectionHeading(
            icon: "person.2", title: "Agents with Webex",
            subtitle: "Assign bounded first-page Meeting schedule access to the connected Person.")
          Spacer()
          Menu {
            ForEach(connections) { connection in
              Button(connection.accountLabel ?? "Webex user") {
                model.selectWebexConnection(connection.id)
              }.disabled(!webexConnectionIsReady(connection))
            }
          } label: {
            Text(selected?.accountLabel ?? "No Webex user selected")
              .font(.system(size: 13, weight: .semibold)).padding(10)
          }.disabled(connections.isEmpty)
          ApplicationsExaSearchField(text: $model.webexAgentSearch, placeholder: "Search agents...")
            .frame(width: 240)
        }
        if selected == nil {
          ApplicationsExaInfoPill(
            text:
              "Connect and select one verified Webex Person before enabling agents. Safe and dangerous profiles expose the same three fixed reads; provider and secret bounds always remain enforced."
          )
        }
        ApplicationsAgentGridScroll {
          ForEach(targets) { target in
            ApplicationsWebexAgentRow(
              app: app, target: target, install: install(target.agentId),
              selectedConnection: selected,
              disabled: !webexConnectionIsReady(selected) || target.status != .compatible)
          }
        }
      }
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "key", title: "Manage API Connection",
          subtitle:
            "Railway brokers Webex authorization-code OAuth with S256 PKCE and three fixed Meetings reads."
        )
        ApplicationsConnectionFormGrid {
          VStack(alignment: .leading, spacing: 8) {
            Text("REQUIRED SCOPES").font(.system(size: 10, weight: .bold)).foregroundStyle(
              RCTheme.muted)
            Text("spark:people_read · meeting:schedules_read").font(
              .system(size: 13, weight: .semibold))
            Text(
              "No messaging, Calling, Contact Center, admin, compliance, attendee, transcript, recording or write scopes."
            )
            .font(.system(size: 10, weight: .semibold)).foregroundStyle(RCTheme.muted)
          }
          VStack(alignment: .leading, spacing: 8) {
            Text("PROVIDER REQUIREMENTS").font(.system(size: 10, weight: .bold)).foregroundStyle(
              RCTheme.muted)
            Text(
              "Registered Webex Integration, exact Railway callback, confidential client, S256 PKCE, Cisco terms and brand review."
            )
            .font(.system(size: 11, weight: .semibold))
          }
        }
        Button {
          model.startWebexOAuthConnect(for: app)
        } label: {
          Label(
            connections.isEmpty ? "Connect Webex" : "Connect another user",
            systemImage: "person.badge.key")
        }.buttonStyle(PrimaryLightButtonStyle()).disabled(
          model.providerConnectionSnapshot?.readOnly == true)
        HStack(spacing: 7) {
          Image(systemName: "lock")
          Text(
            "Client secret, authorization code, PKCE verifier, access token and rotating refresh token stay encrypted in Railway; agents receive three fixed Relay wrappers."
          )
        }.font(.system(size: 11, weight: .semibold)).foregroundStyle(RCTheme.muted)
        if let status = model.webexConnectionStatus?.nilIfEmpty {
          Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
        VStack(spacing: 0) {
          HStack {
            Text("SELECT").frame(width: 50, alignment: .leading)
            Text("PERSON").frame(maxWidth: .infinity, alignment: .leading)
            Text("STATUS").frame(width: 90, alignment: .leading)
            Text("ACTIONS").frame(width: 100, alignment: .trailing)
          }.font(.system(size: 10, weight: .bold)).foregroundStyle(RCTheme.muted)
            .padding(10).background(RCTheme.surfaceInset)
          if connections.isEmpty {
            EmptyMiniLight(
              title: "No Webex connections",
              body:
                "A registered Webex Integration, exact Railway callback and backend deployment are required before agents can be assigned."
            )
            .padding(.vertical, 10)
          } else {
            ForEach(connections) { connection in
              HStack(spacing: 12) {
                Button {
                  model.selectWebexConnection(connection.id)
                } label: {
                  Image(
                    systemName: selected?.id == connection.id ? "checkmark.circle.fill" : "circle")
                }.buttonStyle(.plain).frame(width: 38).disabled(!webexConnectionIsReady(connection))
                Text(connection.accountLabel ?? "Webex user").font(.system(size: 13, weight: .bold))
                  .frame(maxWidth: .infinity, alignment: .leading)
                Text(webexConnectionIsReady(connection) ? "Ready" : "Blocked")
                  .font(.system(size: 11, weight: .bold)).frame(width: 90, alignment: .leading)
                HStack(spacing: 6) {
                  Button {
                    model.testWebexConnection(connection, for: app)
                  } label: {
                    Image(systemName: "arrow.clockwise")
                  }
                  .buttonStyle(IconLightButtonStyle()).help("Test Webex connection")
                  Button {
                    model.deleteWebexConnection(connection, for: app)
                  } label: {
                    Image(systemName: "trash")
                  }
                  .buttonStyle(IconLightButtonStyle()).help("Delete Webex connection")
                }.frame(width: 100, alignment: .trailing)
              }.padding(10).overlay(alignment: .bottom) { Divider() }
            }
          }
          Text(
            "Only a healthy person-bound connection with exact scopes, S256 PKCE and fixed-endpoint diagnostics can be selected."
          )
          .font(.system(size: 10, weight: .semibold)).foregroundStyle(RCTheme.muted)
          .frame(maxWidth: .infinity, alignment: .leading).padding(10)
        }.overlay(RoundedRectangle(cornerRadius: 8).stroke(RCTheme.borderSoft))
      }
      ApplicationsInfoCardsLayout {
        ApplicationsExaInfoCard(
          icon: "video", title: "Capabilities", items: app.capabilities,
          linkTitle: "Webex Meetings documentation", linkURL: app.docsURL.flatMap(URL.init(string:))
        )
        ApplicationsExaInfoCard(
          icon: "sparkles", title: "What Agents Can Do",
          items: [
            "Verify the connected Webex Person without returning provider IDs or email",
            "List up to ten first-page Meeting schedules",
            "Inspect one first-page Meeting without host identity, meeting number or join link",
          ], linkTitle: nil, linkURL: nil)
        ApplicationsExaInfoCard(
          icon: "checklist", title: "Requirements",
          items: [
            "Registered Webex Integration and exact Railway callback",
            "Exact two read scopes and encrypted rotating tokens",
            "No identities, join links, meeting writes, messaging, attendees, transcripts, recordings, admin, pagination or raw API",
          ], linkTitle: nil, linkURL: nil)
      }
    }
  }
}

struct ApplicationsWebexAgentRow: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  let target: MarketplaceCompatibleAgentTarget
  let install: MarketplaceInstallRecord?
  let selectedConnection: MarketplaceProviderConnection?
  let disabled: Bool
  @State private var pending: Bool?
  private var isOn: Bool { install?.connectionId == selectedConnection?.id }
  var body: some View {
    VStack(alignment: .leading, spacing: 9) {
      HStack(spacing: 12) {
        AgentAvatarView(
          name: target.agentName, avatarURL: model.agentAvatar(target.agentId), size: 38)
        VStack(alignment: .leading, spacing: 3) {
          Text(target.agentName).font(.system(size: 13, weight: .semibold))
          Text(exaRuntimeLabel(target.runtimeType)).font(.system(size: 12, weight: .semibold))
            .foregroundStyle(RCTheme.muted)
        }
        Spacer()
        Button {
          pending = !isOn
        } label: {
          ApplicationsExaSwitch(isOn: isOn)
        }
        .buttonStyle(.plain).disabled(
          disabled || model.busy == "toggle-webex-agent-\(target.agentId)")
      }
      ApplicationsAgentAuthorityRow(
        app: app, install: install,
        selectedPreset: install.flatMap { model.marketplaceActionPolicyPreset(for: $0) }
          ?? .approvalRequired,
        muted: !isOn)
    }.padding(12).background(isOn ? RCTheme.sidebarSelected.opacity(0.48) : RCTheme.surfaceInset)
      .clipShape(RoundedRectangle(cornerRadius: 8)).opacity(disabled && !isOn ? 0.72 : 1)
      .alert(
        pending == true ? "Connect agent to Webex?" : "Disconnect Webex for this agent?",
        isPresented: Binding(get: { pending != nil }, set: { if !$0 { pending = nil } })
      ) {
        Button("Cancel", role: .cancel) { pending = nil }
        Button(
          pending == true ? "Connect" : "Disconnect", role: pending == true ? nil : .destructive
        ) {
          let enabled = pending ?? !isOn
          pending = nil
          model.setWebexAgentConnection(target.agentId, enabled: enabled, for: app)
        }
      } message: {
        Text("This changes only the agent's three fixed read-only Webex Relay wrappers.")
      }
  }
}

func goToMeetingConnectionIsReady(_ connection: MarketplaceProviderConnection?) -> Bool {
  guard let connection else { return false }
  return connection.appSlug == "goto-meeting" && connection.status == .connected
    && connection.health.state == .ready && connection.grantedScopes.isEmpty
    && connection.health.diagnostics["railwayCallbackOnly"]?.bool == true
    && connection.health.diagnostics["stateVerified"]?.bool == true
    && connection.health.diagnostics["identityVerified"]?.bool == true
    && connection.health.diagnostics["organizerBound"]?.bool == true
    && connection.health.diagnostics["gotoMeetingClientOnly"]?.bool == true
    && connection.health.diagnostics["fixedEndpointsOnly"]?.bool == true
    && connection.health.diagnostics["automaticRetry"]?.bool == false
    && connection.health.diagnostics["automaticPagination"]?.bool == false
    && connection.health.diagnostics["rawToolsEnabled"]?.bool == false
}

struct ApplicationsGoToMeetingDetailPanel: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  private var connections: [MarketplaceProviderConnection] {
    (model.providerConnectionSnapshot?.connections ?? []).filter { $0.appSlug == "goto-meeting" }
  }
  private var selected: MarketplaceProviderConnection? {
    model.selectedProviderConnection?.appSlug == "goto-meeting"
      ? model.selectedProviderConnection : nil
  }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    let query = model.goToMeetingAgentSearch.trimmingCharacters(in: .whitespacesAndNewlines)
    return model.visibleMarketplaceCompatibleAgents.filter {
      app.runtimeSupport.contains($0.runtimeType)
        && (query.isEmpty || $0.agentName.localizedCaseInsensitiveContains(query))
    }
  }
  private func install(_ agentId: RelayId) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "goto-meeting" && exaInstallIsActive($0)
    }
  }
  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      ApplicationsExaHeroCard(app: app)
      ApplicationsExaPanel {
        HStack {
          ApplicationsExaSectionHeading(
            icon: "person.2", title: "Agents with GoTo Meeting",
            subtitle: "Assign three bounded read-only tools for one exact connected organizer.")
          Spacer()
          Menu {
            ForEach(connections) { connection in
              Button(connection.accountLabel ?? "GoTo organizer") {
                model.selectGoToMeetingConnection(connection.id)
              }.disabled(!goToMeetingConnectionIsReady(connection))
            }
          } label: {
            Text(selected?.accountLabel ?? "No GoTo organizer selected")
              .font(.system(size: 13, weight: .semibold)).padding(10)
          }.disabled(connections.isEmpty)
          ApplicationsExaSearchField(
            text: $model.goToMeetingAgentSearch, placeholder: "Search agents..."
          )
          .frame(width: 240)
        }
        if selected == nil {
          ApplicationsExaInfoPill(
            text:
              "Connect and select one verified GoTo organizer before enabling agents. Rows remain visible with Safe and dangerous authority choices."
          )
        }
        ApplicationsAgentGridScroll {
          ForEach(targets) { target in
            ApplicationsGoToMeetingAgentRow(
              app: app, target: target, install: install(target.agentId),
              selectedConnection: selected,
              disabled: !goToMeetingConnectionIsReady(selected) || target.status != .compatible)
          }
        }
      }
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "key", title: "Manage API Connection",
          subtitle:
            "Railway brokers confidential GoTo OAuth and three fixed organizer/Meeting reads.")
        ApplicationsConnectionFormGrid {
          VStack(alignment: .leading, spacing: 8) {
            Text("OAUTH CLIENT BOUNDARY").font(.system(size: 10, weight: .bold)).foregroundStyle(
              RCTheme.muted)
            Text("GoTo Meeting-only client · no explicit scope parameter").font(
              .system(size: 13, weight: .semibold))
            Text(
              "GoTo assigns every client-configured scope when scope is omitted; the client must exclude Admin, SCIM management, Connect, Webinar, Training, and other products."
            )
            .font(.system(size: 10, weight: .semibold)).foregroundStyle(RCTheme.muted)
          }
          VStack(alignment: .leading, spacing: 8) {
            Text("PROVIDER REQUIREMENTS").font(.system(size: 10, weight: .bold)).foregroundStyle(
              RCTheme.muted)
            Text(
              "GoTo developer account, Meeting-only confidential client, exact Railway callback, active organizer account, terms and trademark review."
            )
            .font(.system(size: 11, weight: .semibold))
          }
        }
        Button {
          model.startGoToMeetingOAuthConnect(for: app)
        } label: {
          Label(
            connections.isEmpty ? "Connect GoTo Meeting" : "Connect another organizer",
            systemImage: "person.badge.key")
        }.buttonStyle(PrimaryLightButtonStyle()).disabled(
          model.providerConnectionSnapshot?.readOnly == true)
        HStack(spacing: 7) {
          Image(systemName: "lock")
          Text(
            "Client secret, authorization code, one-hour access token and conditionally rotating 30-day refresh token stay encrypted in Railway; agents receive three fixed Relay wrappers."
          )
        }.font(.system(size: 11, weight: .semibold)).foregroundStyle(RCTheme.muted)
        if let status = model.goToMeetingConnectionStatus?.nilIfEmpty {
          Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
        VStack(spacing: 0) {
          HStack {
            Text("SELECT").frame(width: 50, alignment: .leading)
            Text("ORGANIZER").frame(maxWidth: .infinity, alignment: .leading)
            Text("STATUS").frame(width: 90, alignment: .leading)
            Text("ACTIONS").frame(width: 100, alignment: .trailing)
          }.font(.system(size: 10, weight: .bold)).foregroundStyle(RCTheme.muted)
            .padding(10).background(RCTheme.surfaceInset)
          if connections.isEmpty {
            EmptyMiniLight(
              title: "No GoTo Meeting connections",
              body:
                "A Meeting-only GoTo OAuth client, exact Railway callback and backend deployment are required before agents can be assigned."
            )
            .padding(.vertical, 10)
          } else {
            ForEach(connections) { connection in
              HStack(spacing: 12) {
                Button {
                  model.selectGoToMeetingConnection(connection.id)
                } label: {
                  Image(
                    systemName: selected?.id == connection.id ? "checkmark.circle.fill" : "circle")
                }.buttonStyle(.plain).frame(width: 38).disabled(
                  !goToMeetingConnectionIsReady(connection))
                Text(connection.accountLabel ?? "GoTo organizer").font(
                  .system(size: 13, weight: .bold)
                )
                .frame(maxWidth: .infinity, alignment: .leading)
                Text(goToMeetingConnectionIsReady(connection) ? "Ready" : "Blocked")
                  .font(.system(size: 11, weight: .bold)).frame(width: 90, alignment: .leading)
                HStack(spacing: 6) {
                  Button {
                    model.testGoToMeetingConnection(connection, for: app)
                  } label: {
                    Image(systemName: "arrow.clockwise")
                  }
                  .buttonStyle(IconLightButtonStyle()).help("Test GoTo Meeting connection")
                  Button {
                    model.deleteGoToMeetingConnection(connection, for: app)
                  } label: {
                    Image(systemName: "trash")
                  }
                  .buttonStyle(IconLightButtonStyle()).help("Delete GoTo Meeting connection")
                }.frame(width: 100, alignment: .trailing)
              }.padding(10).overlay(alignment: .bottom) { Divider() }
            }
          }
          Text(
            "Only a healthy SCIM-current-user-bound connection with a Meeting-only client and fixed-endpoint diagnostics can be selected."
          )
          .font(.system(size: 10, weight: .semibold)).foregroundStyle(RCTheme.muted)
          .frame(maxWidth: .infinity, alignment: .leading).padding(10)
        }.overlay(RoundedRectangle(cornerRadius: 8).stroke(RCTheme.borderSoft))
      }
      ApplicationsInfoCardsLayout {
        ApplicationsExaInfoCard(
          icon: "video", title: "Capabilities", items: app.capabilities,
          linkTitle: "GoTo Meeting API documentation",
          linkURL: app.docsURL.flatMap(URL.init(string:)))
        ApplicationsExaInfoCard(
          icon: "sparkles", title: "What Agents Can Do",
          items: [
            "Verify the connected GoTo organizer without provider identity",
            "List up to ten upcoming Meeting schedules",
            "Inspect one first-ten Meeting's subject, schedule, type and status",
          ], linkTitle: nil, linkURL: nil)
        ApplicationsExaInfoCard(
          icon: "checklist", title: "Requirements",
          items: [
            "Meeting-only GoTo OAuth client and exact Railway callback",
            "Encrypted one-hour access and conditionally rotating 30-day refresh token",
            "No identities, join links, credentials, writes, attendees, history, recordings, transcripts, AI summaries, admin, pagination or raw API",
          ], linkTitle: nil, linkURL: nil)
      }
    }
  }
}

struct ApplicationsGoToMeetingAgentRow: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  let target: MarketplaceCompatibleAgentTarget
  let install: MarketplaceInstallRecord?
  let selectedConnection: MarketplaceProviderConnection?
  let disabled: Bool
  @State private var pending: Bool?
  private var isOn: Bool { install?.connectionId == selectedConnection?.id }
  var body: some View {
    VStack(alignment: .leading, spacing: 9) {
      HStack(spacing: 12) {
        AgentAvatarView(
          name: target.agentName, avatarURL: model.agentAvatar(target.agentId), size: 38)
        VStack(alignment: .leading, spacing: 3) {
          Text(target.agentName).font(.system(size: 13, weight: .semibold))
          Text(exaRuntimeLabel(target.runtimeType)).font(.system(size: 12, weight: .semibold))
            .foregroundStyle(RCTheme.muted)
        }
        Spacer()
        Button {
          pending = !isOn
        } label: {
          ApplicationsExaSwitch(isOn: isOn)
        }
        .buttonStyle(.plain).disabled(
          disabled || model.busy == "toggle-goto-meeting-agent-\(target.agentId)")
      }
      ApplicationsAgentAuthorityRow(
        app: app, install: install,
        selectedPreset: install.flatMap { model.marketplaceActionPolicyPreset(for: $0) }
          ?? .approvalRequired,
        muted: !isOn)
    }.padding(12).background(isOn ? RCTheme.sidebarSelected.opacity(0.48) : RCTheme.surfaceInset)
      .clipShape(RoundedRectangle(cornerRadius: 8)).opacity(disabled && !isOn ? 0.72 : 1)
      .alert(
        pending == true
          ? "Connect agent to GoTo Meeting?" : "Disconnect GoTo Meeting for this agent?",
        isPresented: Binding(get: { pending != nil }, set: { if !$0 { pending = nil } })
      ) {
        Button("Cancel", role: .cancel) { pending = nil }
        Button(
          pending == true ? "Connect" : "Disconnect", role: pending == true ? nil : .destructive
        ) {
          let enabled = pending ?? !isOn
          pending = nil
          model.setGoToMeetingAgentConnection(target.agentId, enabled: enabled, for: app)
        }
      } message: {
        Text(
          "This changes only the agent's three fixed read-only GoTo Meeting Relay wrappers; broad OAuth client authority remains unavailable."
        )
      }
  }
}

func ringCentralConnectionIsReady(_ connection: MarketplaceProviderConnection?) -> Bool {
  guard let connection else { return false }
  return connection.appSlug == "ringcentral" && connection.status == .connected
    && connection.health.state == .ready
    && Set(connection.grantedScopes) == Set(["ReadAccounts", "ReadCallLog"])
    && connection.health.diagnostics["railwayCallbackOnly"]?.bool == true
    && connection.health.diagnostics["stateVerified"]?.bool == true
    && connection.health.diagnostics["pkceS256"]?.bool == true
    && connection.health.diagnostics["extensionVerified"]?.bool == true
    && connection.health.diagnostics["selfExtensionOnly"]?.bool == true
    && connection.health.diagnostics["canonicalPlatformOnly"]?.bool == true
    && connection.health.diagnostics["privacyMasked"]?.bool == true
    && connection.health.diagnostics["fixedEndpointsOnly"]?.bool == true
    && connection.health.diagnostics["automaticRetry"]?.bool == false
    && connection.health.diagnostics["automaticPagination"]?.bool == false
    && connection.health.diagnostics["rawToolsEnabled"]?.bool == false
}

struct ApplicationsRingCentralDetailPanel: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  private var connections: [MarketplaceProviderConnection] {
    (model.providerConnectionSnapshot?.connections ?? []).filter { $0.appSlug == "ringcentral" }
  }
  private var selected: MarketplaceProviderConnection? {
    model.selectedProviderConnection?.appSlug == "ringcentral"
      ? model.selectedProviderConnection : nil
  }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    let query = model.ringCentralAgentSearch.trimmingCharacters(in: .whitespacesAndNewlines)
    return model.visibleMarketplaceCompatibleAgents.filter {
      app.runtimeSupport.contains($0.runtimeType)
        && (query.isEmpty || $0.agentName.localizedCaseInsensitiveContains(query))
    }
  }
  private func install(_ agentId: RelayId) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "ringcentral" && exaInstallIsActive($0)
    }
  }
  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      ApplicationsExaHeroCard(app: app)
      ApplicationsExaPanel {
        HStack {
          ApplicationsExaSectionHeading(
            icon: "person.2", title: "Agents with RingCentral",
            subtitle:
              "Assign three fixed reads for one exact extension and bounded privacy-masked call activity."
          )
          Spacer()
          Menu {
            ForEach(connections) { connection in
              Button(connection.accountLabel ?? "RingCentral extension") {
                model.selectRingCentralConnection(connection.id)
              }
              .disabled(!ringCentralConnectionIsReady(connection))
            }
          } label: {
            Text(selected?.accountLabel ?? "No RingCentral extension selected")
              .font(.system(size: 13, weight: .semibold)).padding(10)
          }.disabled(connections.isEmpty)
          ApplicationsExaSearchField(
            text: $model.ringCentralAgentSearch, placeholder: "Search agents..."
          ).frame(width: 240)
        }
        if selected == nil {
          ApplicationsExaInfoPill(
            text:
              "Connect and select one verified self extension before enabling agents. Rows remain visible with Read only and No access authority."
          )
        }
        ApplicationsAgentGridScroll {
          ForEach(targets) { target in
            ApplicationsRingCentralAgentRow(
              app: app, target: target, install: install(target.agentId),
              selectedConnection: selected,
              disabled: !ringCentralConnectionIsReady(selected) || target.status != .compatible)
          }
        }
      }
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "key", title: "Manage API Connection",
          subtitle:
            "Railway brokers S256 PKCE, single-use refresh replacement, session revocation, and three fixed reads."
        )
        ApplicationsConnectionFormGrid {
          VStack(alignment: .leading, spacing: 8) {
            Text("EXACT APP PERMISSIONS").font(.system(size: 10, weight: .bold)).foregroundStyle(
              RCTheme.muted)
            Text("ReadAccounts · ReadCallLog").font(.system(size: 13, weight: .semibold))
            Text(
              "The authorization scope parameter is omitted; RingCentral uses permissions fixed on the developer app."
            )
            .font(.system(size: 10, weight: .semibold)).foregroundStyle(RCTheme.muted)
          }
          VStack(alignment: .leading, spacing: 8) {
            Text("PRIVACY BOUNDARY").font(.system(size: 10, weight: .bold)).foregroundStyle(
              RCTheme.muted)
            Text(
              "Canonical platform only, exact extension only, first-page Simple view, at most ten records, first-ten detail preflight, names removed, phone numbers masked, 512 KiB response cap, transient no-store results."
            )
            .font(.system(size: 11, weight: .semibold))
          }
        }
        Button {
          model.startRingCentralOAuthConnect(for: app)
        } label: {
          Label(
            connections.isEmpty ? "Connect RingCentral" : "Connect another extension",
            systemImage: "person.badge.key")
        }.buttonStyle(PrimaryLightButtonStyle()).disabled(
          model.providerConnectionSnapshot?.readOnly == true)
        HStack(spacing: 7) {
          Image(systemName: "lock")
          Text(
            "Client secret, authorization code, PKCE verifier, access token and single-use refresh token stay encrypted in Railway. Disconnect revokes the authorization session."
          )
        }.font(.system(size: 11, weight: .semibold)).foregroundStyle(RCTheme.muted)
        if let status = model.ringCentralConnectionStatus?.nilIfEmpty {
          Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
        VStack(spacing: 0) {
          HStack {
            Text("SELECT").frame(width: 50, alignment: .leading)
            Text("EXTENSION").frame(maxWidth: .infinity, alignment: .leading)
            Text("STATUS").frame(width: 90, alignment: .leading)
            Text("ACTIONS").frame(width: 100, alignment: .trailing)
          }.font(.system(size: 10, weight: .bold)).foregroundStyle(RCTheme.muted).padding(10)
            .background(RCTheme.surfaceInset)
          if connections.isEmpty {
            EmptyMiniLight(
              title: "No RingCentral connections",
              body:
                "A reviewed canonical RingCentral app, exact Railway callback and backend deployment are required before agents can be assigned."
            ).padding(.vertical, 10)
          } else {
            ForEach(connections) { connection in
              HStack(spacing: 12) {
                Button {
                  model.selectRingCentralConnection(connection.id)
                } label: {
                  Image(
                    systemName: selected?.id == connection.id ? "checkmark.circle.fill" : "circle")
                }.buttonStyle(.plain).frame(width: 38).disabled(
                  !ringCentralConnectionIsReady(connection))
                Text(connection.accountLabel ?? "RingCentral extension").font(
                  .system(size: 13, weight: .bold)
                ).frame(maxWidth: .infinity, alignment: .leading)
                Text(ringCentralConnectionIsReady(connection) ? "Ready" : "Blocked").font(
                  .system(size: 11, weight: .bold)
                ).frame(width: 90, alignment: .leading)
                HStack(spacing: 6) {
                  Button {
                    model.testRingCentralConnection(connection, for: app)
                  } label: {
                    Image(systemName: "arrow.clockwise")
                  }
                  .buttonStyle(IconLightButtonStyle()).help("Test RingCentral connection")
                  Button {
                    model.deleteRingCentralConnection(connection, for: app)
                  } label: {
                    Image(systemName: "trash")
                  }
                  .buttonStyle(IconLightButtonStyle()).help(
                    "Revoke and delete RingCentral connection")
                }.frame(width: 100, alignment: .trailing)
              }.padding(10).overlay(alignment: .bottom) { Divider() }
            }
          }
          Text(
            "Only a healthy exact-permission, PKCE, self-extension, canonical-platform and privacy-masking connection can be selected."
          )
          .font(.system(size: 10, weight: .semibold)).foregroundStyle(RCTheme.muted)
          .frame(maxWidth: .infinity, alignment: .leading).padding(10)
        }.overlay(RoundedRectangle(cornerRadius: 8).stroke(RCTheme.borderSoft))
      }
      ApplicationsInfoCardsLayout {
        ApplicationsExaInfoCard(
          icon: "phone", title: "Capabilities", items: app.capabilities,
          linkTitle: "RingCentral Call Log documentation",
          linkURL: app.docsURL.flatMap(URL.init(string:)))
        ApplicationsExaInfoCard(
          icon: "sparkles", title: "What Agents Can Do",
          items: [
            "Verify the exact signed-in extension without provider identity",
            "List up to ten first-page Simple-view recent calls",
            "Inspect one first-ten record with names removed and phone numbers masked",
          ], linkTitle: nil, linkURL: nil)
        ApplicationsExaInfoCard(
          icon: "checklist", title: "Requirements",
          items: [
            "Canonical RingCentral app with exactly ReadAccounts and ReadCallLog",
            "Exact Railway callback, S256 PKCE, encrypted single-use refresh tokens, and confidential revocation secret",
            "No identities, raw numbers, other extensions, detailed legs, recordings, messages, calling, admin, other products, later pages, writes, or raw API",
          ], linkTitle: nil, linkURL: nil)
      }
    }
  }
}

struct ApplicationsRingCentralAgentRow: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  let target: MarketplaceCompatibleAgentTarget
  let install: MarketplaceInstallRecord?
  let selectedConnection: MarketplaceProviderConnection?
  let disabled: Bool
  @State private var pending: Bool?
  private var isOn: Bool { install?.connectionId == selectedConnection?.id }
  var body: some View {
    VStack(alignment: .leading, spacing: 9) {
      HStack(spacing: 12) {
        AgentAvatarView(
          name: target.agentName, avatarURL: model.agentAvatar(target.agentId), size: 38)
        VStack(alignment: .leading, spacing: 3) {
          Text(target.agentName).font(.system(size: 13, weight: .semibold))
          Text(exaRuntimeLabel(target.runtimeType)).font(.system(size: 12, weight: .semibold))
            .foregroundStyle(RCTheme.muted)
        }
        Spacer()
        Button {
          pending = !isOn
        } label: {
          ApplicationsExaSwitch(isOn: isOn)
        }
        .buttonStyle(.plain).disabled(
          disabled || model.busy == "toggle-ringcentral-agent-\(target.agentId)")
      }
      ApplicationsAgentAuthorityRow(
        app: app, install: install,
        selectedPreset: install.flatMap { model.marketplaceActionPolicyPreset(for: $0) }
          ?? .approvalRequired, muted: !isOn)
    }.padding(12).background(isOn ? RCTheme.sidebarSelected.opacity(0.48) : RCTheme.surfaceInset)
      .clipShape(RoundedRectangle(cornerRadius: 8)).opacity(disabled && !isOn ? 0.72 : 1)
      .alert(
        pending == true
          ? "Connect agent to RingCentral?" : "Disconnect RingCentral for this agent?",
        isPresented: Binding(get: { pending != nil }, set: { if !$0 { pending = nil } })
      ) {
        Button("Cancel", role: .cancel) { pending = nil }
        Button(
          pending == true ? "Connect" : "Disconnect", role: pending == true ? nil : .destructive
        ) {
          let enabled = pending ?? !isOn
          pending = nil
          model.setRingCentralAgentConnection(target.agentId, enabled: enabled, for: app)
        }
      } message: {
        Text(
          "This changes only the agent's three fixed RingCentral reads; exact extension, first-ten, response, permission, audit, and secret boundaries remain enforced."
        )
      }
  }
}

func dialpadConnectionIsReady(_ connection: MarketplaceProviderConnection?) -> Bool {
  guard let connection else { return false }
  return connection.appSlug == "dialpad" && connection.status == .connected
    && connection.health.state == .ready
    && Set(connection.grantedScopes) == Set(["offline_access"])
    && connection.health.diagnostics["railwayCallbackOnly"]?.bool == true
    && connection.health.diagnostics["stateVerified"]?.bool == true
    && connection.health.diagnostics["pkceS256"]?.bool == true
    && connection.health.diagnostics["userVerified"]?.bool == true
    && connection.health.diagnostics["selfUserOnly"]?.bool == true
    && connection.health.diagnostics["canonicalDialpadOnly"]?.bool == true
    && connection.health.diagnostics["privacyMasked"]?.bool == true
    && connection.health.diagnostics["forwardingNumbers"]?.string == "blocked"
    && connection.health.diagnostics["maxResponseBytes"]?.number == 524_288
    && connection.health.diagnostics["fixedEndpointsOnly"]?.bool == true
    && connection.health.diagnostics["automaticRetry"]?.bool == false
    && connection.health.diagnostics["automaticPagination"]?.bool == false
    && connection.health.diagnostics["rawToolsEnabled"]?.bool == false
}

struct ApplicationsDialpadDetailPanel: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  private var connections: [MarketplaceProviderConnection] {
    (model.providerConnectionSnapshot?.connections ?? []).filter { $0.appSlug == "dialpad" }
  }
  private var selected: MarketplaceProviderConnection? {
    model.selectedProviderConnection?.appSlug == "dialpad" ? model.selectedProviderConnection : nil
  }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    model.visibleMarketplaceCompatibleAgents.filter { app.runtimeSupport.contains($0.runtimeType) }
  }
  private func install(_ agentId: RelayId) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "dialpad" && exaInstallIsActive($0)
    }
  }
  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      ApplicationsExaHeroCard(app: app)
      ApplicationsExaPanel {
        HStack {
          ApplicationsExaSectionHeading(
            icon: "person.2", title: "Agents with Dialpad",
            subtitle: "Assign two fixed privacy-masked reads for the exact connected Dialpad user.")
          Spacer()
          Menu {
            ForEach(connections) { connection in
              Button(connection.accountLabel ?? "Dialpad user") {
                model.selectDialpadConnection(connection.id)
              }.disabled(!dialpadConnectionIsReady(connection))
            }
          } label: {
            Text(selected?.accountLabel ?? "No Dialpad user selected").font(
              .system(size: 13, weight: .semibold)
            ).padding(10)
          }.disabled(connections.isEmpty)
        }
        if selected == nil {
          ApplicationsExaInfoPill(
            text:
              "Connect and select one verified own user before enabling agents. Rows remain visible with Safe and Dangerously skip permissions authority."
          )
        }
        ApplicationsAgentGridScroll {
          ForEach(targets) { target in
            ApplicationsDialpadAgentRow(
              app: app, target: target, install: install(target.agentId),
              selectedConnection: selected,
              disabled: !dialpadConnectionIsReady(selected) || target.status != .compatible)
          }
        }
      }
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "key", title: "Manage API Connection",
          subtitle:
            "Railway brokers confidential S256 PKCE, rotating refresh and two fixed own-user Dialpad reads."
        )
        ApplicationsConnectionFormGrid {
          VStack(alignment: .leading, spacing: 8) {
            Text("EXACT OAUTH SCOPE").font(.system(size: 10, weight: .bold)).foregroundStyle(
              RCTheme.muted)
            Text("offline_access").font(.system(size: 13, weight: .semibold))
            Text(
              "Dialpad default/basic app authority remains provider-defined. calls:list, recordings_export, message exports, screen_pop, change_log and fax scopes are excluded."
            ).font(.system(size: 10, weight: .semibold)).foregroundStyle(RCTheme.muted)
          }
          VStack(alignment: .leading, spacing: 8) {
            Text("PRIVACY BOUNDARY").font(.system(size: 10, weight: .bold)).foregroundStyle(
              RCTheme.muted)
            Text(
              "Production dialpad.com only; exact /users/me and /users/me/caller_id GETs; current schema; forwarding numbers excluded; at most ten deduplicated masked choices; strict JSON and 512 KiB responses."
            ).font(.system(size: 11, weight: .semibold))
          }
        }
        Button {
          model.startDialpadOAuthConnect(for: app)
        } label: {
          Label(
            connections.isEmpty ? "Connect Dialpad" : "Connect another user",
            systemImage: "person.badge.key")
        }
        .buttonStyle(PrimaryLightButtonStyle()).disabled(
          model.providerConnectionSnapshot?.readOnly == true)
        HStack(spacing: 7) {
          Image(systemName: "lock")
          Text(
            "Client secret, code, S256 PKCE verifier, access token and rotating refresh token stay encrypted in Railway. Disconnect deauthorizes all Dialpad tokens for the user before local deletion."
          )
        }
        .font(.system(size: 11, weight: .semibold)).foregroundStyle(RCTheme.muted)
        if let status = model.dialpadConnectionStatus?.nilIfEmpty {
          Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
        VStack(spacing: 0) {
          HStack {
            Text("SELECT").frame(width: 50, alignment: .leading)
            Text("USER").frame(maxWidth: .infinity, alignment: .leading)
            Text("STATUS").frame(width: 90, alignment: .leading)
            Text("ACTIONS").frame(width: 100, alignment: .trailing)
          }
          .font(.system(size: 10, weight: .bold)).foregroundStyle(RCTheme.muted).padding(10)
          .background(RCTheme.surfaceInset)
          if connections.isEmpty {
            EmptyMiniLight(
              title: "No Dialpad connections",
              body:
                "A reviewed OAuth app, exact Railway callback and backend deployment are required before agents can be assigned."
            ).padding(.vertical, 10)
          } else {
            ForEach(connections) { connection in
              HStack(spacing: 12) {
                Button {
                  model.selectDialpadConnection(connection.id)
                } label: {
                  Image(
                    systemName: selected?.id == connection.id ? "checkmark.circle.fill" : "circle")
                }.buttonStyle(.plain).frame(width: 38).disabled(
                  !dialpadConnectionIsReady(connection))
                Text(connection.accountLabel ?? "Dialpad user").font(
                  .system(size: 13, weight: .bold)
                ).frame(maxWidth: .infinity, alignment: .leading)
                Text(dialpadConnectionIsReady(connection) ? "Ready" : "Blocked").font(
                  .system(size: 11, weight: .bold)
                ).frame(width: 90, alignment: .leading)
                HStack(spacing: 6) {
                  Button {
                    model.testDialpadConnection(connection, for: app)
                  } label: {
                    Image(systemName: "arrow.clockwise")
                  }.buttonStyle(IconLightButtonStyle()).help("Test Dialpad connection")
                  Button {
                    model.deleteDialpadConnection(connection, for: app)
                  } label: {
                    Image(systemName: "trash")
                  }.buttonStyle(IconLightButtonStyle()).help(
                    "Deauthorize and delete Dialpad connection")
                }.frame(width: 100, alignment: .trailing)
              }.padding(10).overlay(alignment: .bottom) { Divider() }
            }
          }
          Text(
            "Only a healthy exact-additional-scope, S256 PKCE, own-user, canonical-host, 512 KiB bounded and privacy-masking connection can be selected."
          ).font(.system(size: 10, weight: .semibold)).foregroundStyle(RCTheme.muted).frame(
            maxWidth: .infinity, alignment: .leading
          ).padding(10)
        }.overlay(RoundedRectangle(cornerRadius: 8).stroke(RCTheme.borderSoft))
      }
      ApplicationsInfoCardsLayout {
        ApplicationsExaInfoCard(
          icon: "person.crop.circle", title: "Capabilities", items: app.capabilities,
          linkTitle: "Dialpad OAuth documentation", linkURL: app.docsURL.flatMap(URL.init(string:)))
        ApplicationsExaInfoCard(
          icon: "sparkles", title: "What Agents Can Do",
          items: [
            "Verify the exact connected user without provider identity",
            "Inspect up to ten masked primary, user, office and group Caller ID choices",
            "Receive truncation or blocked-active state without forwarding numbers",
          ], linkTitle: nil, linkURL: nil)
        ApplicationsExaInfoCard(
          icon: "checklist", title: "Requirements",
          items: [
            "Approved Dialpad OAuth access with only additional offline_access",
            "Exact Railway callback, state, mandatory S256 PKCE, encrypted rotating tokens and upstream deauthorization",
            "No provider IDs, email, extension, organization data, forwarding numbers, calls, recordings, transcripts, messages, special scopes, admin, pagination, writes or raw API",
          ], linkTitle: nil, linkURL: nil)
      }
    }
  }
}

struct ApplicationsDialpadAgentRow: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  let target: MarketplaceCompatibleAgentTarget
  let install: MarketplaceInstallRecord?
  let selectedConnection: MarketplaceProviderConnection?
  let disabled: Bool
  @State private var pending: Bool?
  private var isOn: Bool { install?.connectionId == selectedConnection?.id }
  var body: some View {
    VStack(alignment: .leading, spacing: 9) {
      HStack(spacing: 12) {
        AgentAvatarView(
          name: target.agentName, avatarURL: model.agentAvatar(target.agentId), size: 38)
        VStack(alignment: .leading, spacing: 3) {
          Text(target.agentName).font(.system(size: 13, weight: .semibold))
          Text(exaRuntimeLabel(target.runtimeType)).font(.system(size: 12, weight: .semibold))
            .foregroundStyle(RCTheme.muted)
        }
        Spacer()
        Button {
          pending = !isOn
        } label: {
          ApplicationsExaSwitch(isOn: isOn)
        }.buttonStyle(.plain).disabled(
          disabled || model.busy == "toggle-dialpad-agent-\(target.agentId)")
      }
      ApplicationsAgentAuthorityRow(
        app: app, install: install,
        selectedPreset: install.flatMap { model.marketplaceActionPolicyPreset(for: $0) }
          ?? .approvalRequired, muted: !isOn)
    }.padding(12).background(isOn ? RCTheme.sidebarSelected.opacity(0.48) : RCTheme.surfaceInset)
      .clipShape(RoundedRectangle(cornerRadius: 8)).opacity(disabled && !isOn ? 0.72 : 1)
      .alert(
        pending == true ? "Connect agent to Dialpad?" : "Disconnect Dialpad for this agent?",
        isPresented: Binding(get: { pending != nil }, set: { if !$0 { pending = nil } })
      ) {
        Button("Cancel", role: .cancel) { pending = nil }
        Button(
          pending == true ? "Connect" : "Disconnect", role: pending == true ? nil : .destructive
        ) {
          let enabled = pending ?? !isOn
          pending = nil
          model.setDialpadAgentConnection(target.agentId, enabled: enabled, for: app)
        }
      } message: {
        Text(
          "This changes only the agent's two fixed Dialpad reads; exact user, current schema, response, masking, permission, audit and secret boundaries remain enforced."
        )
      }
  }
}

func aircallConnectionIsReady(_ connection: MarketplaceProviderConnection?) -> Bool {
  guard let connection else { return false }
  return connection.appSlug == "aircall" && connection.status == .connected
    && connection.health.state == .ready
    && Set(connection.grantedScopes) == Set(["public_api"])
    && connection.health.diagnostics["railwayCallbackOnly"]?.bool == true
    && connection.health.diagnostics["stateVerified"]?.bool == true
    && connection.health.diagnostics["pkceS256"]?.bool == false
    && connection.health.diagnostics["companyBindingVerified"]?.bool == true
    && connection.health.diagnostics["integrationActive"]?.bool == true
    && connection.health.diagnostics["canonicalAircallOnly"]?.bool == true
    && connection.health.diagnostics["privacyMasked"]?.bool == true
    && connection.health.diagnostics["maxResponseBytes"]?.number == 524_288
    && connection.health.diagnostics["fixedEndpointsOnly"]?.bool == true
    && connection.health.diagnostics["automaticRetry"]?.bool == false
    && connection.health.diagnostics["automaticPagination"]?.bool == false
    && connection.health.diagnostics["rawToolsEnabled"]?.bool == false
}
