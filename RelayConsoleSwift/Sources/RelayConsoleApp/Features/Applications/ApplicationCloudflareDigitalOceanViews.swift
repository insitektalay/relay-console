import AppKit
import RelayConsoleCore
import SwiftUI
import UniformTypeIdentifiers

struct ApplicationsCloudflareDetailPanel: View {
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
          icon: "person.2", title: "Agents with Cloudflare",
          subtitle: "Assign the selected read-only account and zone to compatible agents.")
        if connections.isEmpty {
          ApplicationsExaInfoPill(
            text: "Agent rows stay visible but disabled until secure Cloudflare OAuth is ready.")
        }
        LazyVGrid(
          columns: [GridItem(.adaptive(minimum: 245), spacing: 12)], alignment: .leading,
          spacing: 12
        ) {
          ForEach(targets) { target in
            ApplicationsCloudflareAgentSwitchRow(
              app: app, target: target, install: activeInstall(target.agentId),
              enabled: selected.map(cloudflareConnectionIsReady) == true
                && target.status == .compatible)
          }
        }
        if targets.isEmpty {
          EmptyMiniLight(
            title: "No available agents",
            body: "Cloudflare supports compatible Hermes and OpenClaw agents.")
        }
      }
      ApplicationsExaPanel {
        HStack(alignment: .top) {
          ApplicationsExaSectionHeading(
            icon: "key", title: "Manage API Connection",
            subtitle: "Connect through Relay's secure hosted Cloudflare OAuth flow.")
          Spacer()
          ApplicationsExaInfoPill(text: "zone.read · analytics.read · offline_access")
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
        if let status = model.cloudflareConnectionStatus?.nilIfEmpty {
          Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
      }
      LazyVGrid(
        columns: [GridItem(.adaptive(minimum: 285), spacing: 14)], alignment: .leading, spacing: 14
      ) {
        ApplicationsExaInfoCard(
          icon: "cloud", title: "Capabilities", items: app.capabilities,
          linkTitle: "Cloudflare API docs", linkURL: app.docsURL.flatMap(URL.init(string:)))
        ApplicationsExaInfoCard(
          icon: "lock.shield", title: "What Agents Can Do",
          items: [
            "List up to 25 zones in the selected account", "Inspect the exact selected zone",
            "Review aggregate traffic over at most 24 hours",
          ], linkTitle: nil, linkURL: nil)
        ApplicationsExaInfoCard(
          icon: "checklist", title: "Requirements",
          items: marketplaceConnectionRequirements(for: app), linkTitle: nil, linkURL: nil)
      }
    }
  }
  private var connectForm: some View {
    VStack(alignment: .leading, spacing: 12) {
      Text("Connect Cloudflare").font(.system(size: 15, weight: .bold))
      Text(
        "Relay uses Cloudflare authorization-code OAuth with S256 PKCE. The client secret, code exchange, refresh, and revoke stay in the authenticated Railway broker; access and refresh tokens return as separate Keychain references."
      ).font(.system(size: 12)).foregroundStyle(RCTheme.muted)
      Button {
        model.startCloudflareOAuthConnect(for: app)
      } label: {
        Label(
          selected == nil ? "Connect Cloudflare" : "Reconnect Cloudflare",
          systemImage: "link.badge.plus")
      }.buttonStyle(PrimaryLightButtonStyle()).frame(maxWidth: .infinity).disabled(
        model.busy == "connect-cloudflare-oauth"
          || model.providerConnectionSnapshot?.readOnly == true || app.availability != .available)
      Text(
        "A verified public OAuth client, exact account/zone selection, callback, and Railway broker deployment are required before live consent."
      ).font(.system(size: 11, weight: .semibold)).foregroundStyle(RCTheme.muted)
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
          Text("Account / zone").frame(width: 210, alignment: .leading)
          Text("Scopes").frame(width: 240, alignment: .leading)
          Text("Status").frame(width: 90, alignment: .leading)
          Text("Actions").frame(width: 54)
        }.font(.system(size: 11, weight: .bold)).foregroundStyle(RCTheme.muted).padding(
          .horizontal, 14
        ).frame(height: 36)
        if connections.isEmpty {
          EmptyMiniLight(
            title: "No Cloudflare OAuth connection",
            body: "Complete provider setup and consent before assigning agents."
          ).padding(.vertical, 22)
        } else {
          ForEach(connections) { connection in
            HStack {
              Button {
                model.selectCloudflareConnection(connection.id)
              } label: {
                Image(
                  systemName: selected?.id == connection.id ? "largecircle.fill.circle" : "circle")
              }.buttonStyle(.plain).frame(width: 28).disabled(
                !cloudflareConnectionIsReady(connection))
              Text(connection.accountLabel ?? "Cloudflare zone").frame(
                width: 210, alignment: .leading)
              Text(
                (connection.health.diagnostics["accountName"]?.string ?? "?") + " / "
                  + (connection.health.diagnostics["zoneName"]?.string ?? "?")
              ).frame(width: 210, alignment: .leading).lineLimit(1)
              Text(connection.grantedScopes.joined(separator: ", ")).frame(
                width: 240, alignment: .leading
              ).lineLimit(1)
              Text(cloudflareConnectionIsReady(connection) ? "Ready" : "Reconnect").frame(
                width: 90, alignment: .leading)
              Button {
                model.deleteCloudflareConnection(connection, for: app)
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
            "DNS/config writes, cache purge, logs, request dimensions, tokens/admin, raw REST/GraphQL, and automatic pagination are blocked."
          )
          Spacer()
        }.font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted).padding(
          .horizontal, 14
        ).frame(height: 38).overlay(alignment: .top) {
          Rectangle().fill(RCTheme.borderSoft).frame(height: 1)
        }
      }.frame(minWidth: 880)
    }.background(RCTheme.surfaceInset).clipShape(RoundedRectangle(cornerRadius: 8)).overlay(
      RoundedRectangle(cornerRadius: 8).stroke(RCTheme.borderSoft))
  }
  private func activeInstall(_ agentId: RelayId) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "cloudflare" && exaInstallIsActive($0)
    }
  }
}

struct ApplicationsCloudflareAgentSwitchRow: View {
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
          !enabled || model.busy == "toggle-cloudflare-agent-\(target.agentId)")
      }
      if isOn, let install {
        Text("Read-only Cloudflare zones and aggregate traffic").font(
          .system(size: 11, weight: .bold)
        ).foregroundStyle(RCTheme.muted)
        ApplicationsAgentAuthorityRow(app: app, install: install, selectedPreset: .readOnly)
      }
    }.padding(12).frame(minHeight: 86).background(
      isOn ? RCTheme.sidebarSelected.opacity(0.48) : RCTheme.surfaceInset
    ).clipShape(RoundedRectangle(cornerRadius: 8)).overlay(
      RoundedRectangle(cornerRadius: 8).stroke(
        isOn ? RCTheme.accentGreen.opacity(0.35) : RCTheme.borderSoft)
    ).opacity(!enabled && !isOn ? 0.65 : 1).alert(
      pending == true ? "Connect agent to Cloudflare?" : "Disconnect Cloudflare?",
      isPresented: Binding(get: { pending != nil }, set: { if !$0 { pending = nil } })
    ) {
      Button("Cancel", role: .cancel) { pending = nil }
      Button(pending == true ? "Connect" : "Disconnect") {
        let value = pending ?? !isOn
        pending = nil
        model.setCloudflareAgentConnection(target.agentId, enabled: value, for: app)
      }
    } message: {
      Text("This changes only the selected agent's bounded read-only Cloudflare access.")
    }
  }
}

func vercelConnectionIsReady(_ c: MarketplaceProviderConnection) -> Bool {
  c.appSlug == "vercel" && c.status == .connected && c.health.state == .ready
    && c.grantedScopes == ProviderConnectionService.vercelReadScopes
    && c.health.diagnostics["apiOrigin"]?.string == VercelProviderActionSupport.apiOrigin
    && c.health.diagnostics["configurationId"]?.string.map(VercelProviderActionSupport.safeId)
      == true
    && c.health.diagnostics["projectId"]?.string.map(VercelProviderActionSupport.safeId) == true
}
struct ApplicationsVercelDetailPanel: View {
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
          icon: "person.2", title: "Agents with Vercel",
          subtitle: "Assign the selected read-only project to compatible agents.")
        if connections.isEmpty {
          ApplicationsExaInfoPill(
            text: "Agent rows stay visible but disabled until the Vercel integration is ready.")
        }
        LazyVGrid(
          columns: [GridItem(.adaptive(minimum: 245), spacing: 12)], alignment: .leading,
          spacing: 12
        ) {
          ForEach(targets) { target in
            ApplicationsVercelAgentSwitchRow(
              app: app, target: target, install: activeInstall(target.agentId),
              enabled: selected.map(vercelConnectionIsReady) == true && target.status == .compatible
            )
          }
        }
      }
      ApplicationsExaPanel {
        HStack(alignment: .top) {
          ApplicationsExaSectionHeading(
            icon: "key", title: "Manage API Connection",
            subtitle: "Install Relay's Vercel connectable account integration.")
          Spacer()
          ApplicationsExaInfoPill(text: "Project Read · Deployment Read")
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
        if let status = model.vercelConnectionStatus?.nilIfEmpty {
          Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
      }
      LazyVGrid(
        columns: [GridItem(.adaptive(minimum: 285), spacing: 14)], alignment: .leading, spacing: 14
      ) {
        ApplicationsExaInfoCard(
          icon: "shippingbox", title: "Capabilities", items: app.capabilities,
          linkTitle: "Vercel API docs", linkURL: app.docsURL.flatMap(URL.init(string:)))
        ApplicationsExaInfoCard(
          icon: "lock.shield", title: "What Agents Can Do",
          items: [
            "List up to 25 projects", "Inspect the exact selected project",
            "Review up to 25 deployments",
          ], linkTitle: nil, linkURL: nil)
        ApplicationsExaInfoCard(
          icon: "checklist", title: "Requirements",
          items: marketplaceConnectionRequirements(for: app), linkTitle: nil, linkURL: nil)
      }
    }
  }
  private var connectForm: some View {
    VStack(alignment: .leading, spacing: 12) {
      Text("Connect Vercel").font(.system(size: 15, weight: .bold))
      Text(
        "Vercel sends a one-time 30-minute code to Relay's Railway redirect. The client secret and exchange remain in the broker; the long-lived non-refreshable installation token is stored as one Keychain reference."
      ).font(.system(size: 12)).foregroundStyle(RCTheme.muted)
      Button {
        model.startVercelIntegrationConnect(for: app)
      } label: {
        Label(
          selected == nil ? "Install Vercel integration" : "Reinstall Vercel integration",
          systemImage: "link.badge.plus")
      }.buttonStyle(PrimaryLightButtonStyle()).frame(maxWidth: .infinity).disabled(
        model.busy == "connect-vercel-integration"
          || model.providerConnectionSnapshot?.readOnly == true || app.availability != .available)
      Text(
        "Approved integration metadata, exact Railway redirect, Project Read and Deployment Read are required before live installation."
      ).font(.system(size: 11, weight: .semibold)).foregroundStyle(RCTheme.muted)
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
          Text("Team / project").frame(width: 220, alignment: .leading)
          Text("Permissions").frame(width: 220, alignment: .leading)
          Text("Status").frame(width: 90, alignment: .leading)
          Text("Actions").frame(width: 54)
        }.font(.system(size: 11, weight: .bold)).foregroundStyle(RCTheme.muted).padding(
          .horizontal, 14
        ).frame(height: 36)
        if connections.isEmpty {
          EmptyMiniLight(
            title: "No Vercel integration connection",
            body: "Complete provider setup and installation before assigning agents."
          ).padding(.vertical, 22)
        } else {
          ForEach(connections) { c in
            HStack {
              Button {
                model.selectVercelConnection(c.id)
              } label: {
                Image(systemName: selected?.id == c.id ? "largecircle.fill.circle" : "circle")
              }.buttonStyle(.plain).frame(width: 28).disabled(!vercelConnectionIsReady(c))
              Text(c.accountLabel ?? "Vercel project").frame(width: 210, alignment: .leading)
              Text(
                (c.health.diagnostics["teamName"]?.string ?? "Hobby") + " / "
                  + (c.health.diagnostics["projectName"]?.string ?? "?")
              ).frame(width: 220, alignment: .leading).lineLimit(1)
              Text(c.grantedScopes.joined(separator: ", ")).frame(width: 220, alignment: .leading)
              Text(vercelConnectionIsReady(c) ? "Ready" : "Reinstall").frame(
                width: 90, alignment: .leading)
              Button {
                model.deleteVercelConnection(c, for: app)
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
            "Logs, files, environment values, members, billing, domains, writes, raw REST and automatic pagination are blocked."
          )
          Spacer()
        }.font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted).padding(
          .horizontal, 14
        ).frame(height: 38).overlay(alignment: .top) {
          Rectangle().fill(RCTheme.borderSoft).frame(height: 1)
        }
      }.frame(minWidth: 870)
    }.background(RCTheme.surfaceInset).clipShape(RoundedRectangle(cornerRadius: 8)).overlay(
      RoundedRectangle(cornerRadius: 8).stroke(RCTheme.borderSoft))
  }
  private func activeInstall(_ agentId: RelayId) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "vercel" && exaInstallIsActive($0)
    }
  }
}
struct ApplicationsVercelAgentSwitchRow: View {
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
          !enabled || model.busy == "toggle-vercel-agent-\(target.agentId)")
      }
      if isOn, let install {
        Text("Read-only Vercel projects and deployments").font(.system(size: 11, weight: .bold))
          .foregroundStyle(RCTheme.muted)
        ApplicationsAgentAuthorityRow(app: app, install: install, selectedPreset: .readOnly)
      }
    }.padding(12).frame(minHeight: 86).background(
      isOn ? RCTheme.sidebarSelected.opacity(0.48) : RCTheme.surfaceInset
    ).clipShape(RoundedRectangle(cornerRadius: 8)).opacity(!enabled && !isOn ? 0.65 : 1).alert(
      pending == true ? "Connect agent to Vercel?" : "Disconnect Vercel?",
      isPresented: Binding(get: { pending != nil }, set: { if !$0 { pending = nil } })
    ) {
      Button("Cancel", role: .cancel) { pending = nil }
      Button(pending == true ? "Connect" : "Disconnect") {
        let value = pending ?? !isOn
        pending = nil
        model.setVercelAgentConnection(target.agentId, enabled: value, for: app)
      }
    } message: {
      Text("This changes only the selected agent's bounded read-only Vercel access.")
    }
  }
}

func herokuConnectionIsReady(_ connection: MarketplaceProviderConnection) -> Bool {
  connection.appSlug == "heroku" && connection.status == .connected
    && connection.health.state == .ready
    && connection.grantedScopes == ProviderConnectionService.herokuReadScopes
    && connection.health.diagnostics["apiOrigin"]?.string == HerokuProviderActionSupport.apiOrigin
    && connection.health.diagnostics["authorizationId"]?.string.map(
      HerokuProviderActionSupport.safeId) == true
    && connection.health.diagnostics["teamId"]?.string.map(HerokuProviderActionSupport.safeId)
      == true
    && connection.health.diagnostics["appId"]?.string.map(HerokuProviderActionSupport.safeId)
      == true
}

struct ApplicationsHerokuDetailPanel: View {
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
          icon: "person.2", title: "Agents with Heroku",
          subtitle: "Assign the selected read-only Team App to compatible agents.")
        if connections.isEmpty {
          ApplicationsExaInfoPill(
            text: "Agent rows stay visible but disabled until Heroku OAuth is ready.")
        }
        LazyVGrid(
          columns: [GridItem(.adaptive(minimum: 245), spacing: 12)], alignment: .leading,
          spacing: 12
        ) {
          ForEach(targets) { target in
            ApplicationsHerokuAgentSwitchRow(
              app: app, target: target, install: activeInstall(target.agentId),
              enabled: selected.map(herokuConnectionIsReady) == true && target.status == .compatible
            )
          }
        }
      }
      ApplicationsExaPanel {
        HStack(alignment: .top) {
          ApplicationsExaSectionHeading(
            icon: "key", title: "Manage API Connection",
            subtitle: "Authorize Relay's Heroku OAuth app for one Team and selected App.")
          Spacer()
          ApplicationsExaInfoPill(text: "read · 8-hour access · rotating pair")
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
        if let status = model.herokuConnectionStatus?.nilIfEmpty {
          Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
      }
      LazyVGrid(
        columns: [GridItem(.adaptive(minimum: 285), spacing: 14)], alignment: .leading, spacing: 14
      ) {
        ApplicationsExaInfoCard(
          icon: "shippingbox", title: "Capabilities", items: app.capabilities,
          linkTitle: "Heroku Platform API docs", linkURL: app.docsURL.flatMap(URL.init(string:)))
        ApplicationsExaInfoCard(
          icon: "lock.shield", title: "What Agents Can Do",
          items: [
            "List up to 25 Apps in one Team", "Review up to 25 Releases",
            "Review up to 25 current Dynos",
          ], linkTitle: nil, linkURL: nil)
        ApplicationsExaInfoCard(
          icon: "checklist", title: "Requirements",
          items: marketplaceConnectionRequirements(for: app), linkTitle: nil, linkURL: nil)
      }
    }
  }
  private var connectForm: some View {
    VStack(alignment: .leading, spacing: 12) {
      Text("Connect Heroku").font(.system(size: 15, weight: .bold))
      Text(
        "Heroku returns an eight-hour access token and non-expiring refresh token. Relay stores both as separate Keychain references; the client secret and exchange stay in Railway."
      ).font(.system(size: 12)).foregroundStyle(RCTheme.muted)
      Button {
        model.startHerokuOAuthConnect(for: app)
      } label: {
        Label(
          selected == nil ? "Authorize Heroku" : "Reconnect Heroku", systemImage: "link.badge.plus")
      }.buttonStyle(PrimaryLightButtonStyle()).frame(maxWidth: .infinity).disabled(
        model.busy == "connect-heroku-oauth" || model.providerConnectionSnapshot?.readOnly == true
          || app.availability != .available)
      Text(
        "Exact read scope, Team, selected App, Railway callback and confidential client are required."
      ).font(.system(size: 11, weight: .semibold)).foregroundStyle(RCTheme.muted)
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
          Text("Team / App").frame(width: 220, alignment: .leading)
          Text("Scope").frame(width: 100, alignment: .leading)
          Text("Status").frame(width: 90, alignment: .leading)
          Text("Actions").frame(width: 54)
        }.font(.system(size: 11, weight: .bold)).foregroundStyle(RCTheme.muted).padding(
          .horizontal, 14
        ).frame(height: 36)
        if connections.isEmpty {
          EmptyMiniLight(
            title: "No Heroku OAuth connection",
            body: "Complete provider setup and authorization before assigning agents."
          ).padding(.vertical, 22)
        } else {
          ForEach(connections) { connection in
            HStack {
              Button {
                model.selectHerokuConnection(connection.id)
              } label: {
                Image(
                  systemName: selected?.id == connection.id ? "largecircle.fill.circle" : "circle")
              }.buttonStyle(.plain).frame(width: 28).disabled(!herokuConnectionIsReady(connection))
              Text(connection.accountLabel ?? "Heroku App").frame(width: 210, alignment: .leading)
              Text(
                (connection.health.diagnostics["teamName"]?.string ?? "?") + " / "
                  + (connection.health.diagnostics["appName"]?.string ?? "?")
              ).frame(width: 220, alignment: .leading).lineLimit(1)
              Text(connection.grantedScopes.joined(separator: ", ")).frame(
                width: 100, alignment: .leading)
              Text(herokuConnectionIsReady(connection) ? "Ready" : "Reconnect").frame(
                width: 90, alignment: .leading)
              Button {
                model.deleteHerokuConnection(connection, for: app)
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
            "Config vars, logs, commands, output streams, add-ons, source, writes, raw API and automatic pagination are blocked."
          )
          Spacer()
        }.font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted).padding(
          .horizontal, 14
        ).frame(height: 38).overlay(alignment: .top) {
          Rectangle().fill(RCTheme.borderSoft).frame(height: 1)
        }
      }.frame(minWidth: 730)
    }.background(RCTheme.surfaceInset).clipShape(RoundedRectangle(cornerRadius: 8)).overlay(
      RoundedRectangle(cornerRadius: 8).stroke(RCTheme.borderSoft))
  }
  private func activeInstall(_ agentId: RelayId) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "heroku" && exaInstallIsActive($0)
    }
  }
}

struct ApplicationsHerokuAgentSwitchRow: View {
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
          !enabled || model.busy == "toggle-heroku-agent-\(target.agentId)")
      }
      if isOn, let install {
        Text("Read-only Heroku Apps, Releases, and Dynos").font(.system(size: 11, weight: .bold))
          .foregroundStyle(RCTheme.muted)
        ApplicationsAgentAuthorityRow(app: app, install: install, selectedPreset: .readOnly)
      }
    }.padding(12).frame(minHeight: 86).background(
      isOn ? RCTheme.sidebarSelected.opacity(0.48) : RCTheme.surfaceInset
    ).clipShape(RoundedRectangle(cornerRadius: 8)).opacity(!enabled && !isOn ? 0.65 : 1).alert(
      pending == true ? "Connect agent to Heroku?" : "Disconnect Heroku?",
      isPresented: Binding(get: { pending != nil }, set: { if !$0 { pending = nil } })
    ) {
      Button("Cancel", role: .cancel) { pending = nil }
      Button(pending == true ? "Connect" : "Disconnect") {
        let value = pending ?? !isOn
        pending = nil
        model.setHerokuAgentConnection(target.agentId, enabled: value, for: app)
      }
    } message: {
      Text("This changes only the selected agent's bounded read-only Heroku access.")
    }
  }
}

func digitalOceanConnectionIsReady(_ connection: MarketplaceProviderConnection) -> Bool {
  connection.appSlug == "digitalocean" && connection.status == .connected
    && connection.health.state == .ready
    && connection.grantedScopes == ProviderConnectionService.digitalOceanReadScopes
    && connection.health.diagnostics["apiOrigin"]?.string
      == DigitalOceanProviderActionSupport.apiOrigin
    && connection.health.diagnostics["teamId"]?.string.map(DigitalOceanProviderActionSupport.safeId)
      == true
    && connection.health.diagnostics["projectId"]?.string.map(
      DigitalOceanProviderActionSupport.safeId) == true
    && connection.health.diagnostics["resourceId"]?.string.map(
      DigitalOceanProviderActionSupport.safeId) == true
    && connection.health.diagnostics["resourceKind"]?.string.map {
      ["droplet", "app"].contains($0)
    } == true
}
struct ApplicationsDigitalOceanDetailPanel: View {
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
          icon: "person.2", title: "Agents with DigitalOcean",
          subtitle: "Assign the selected read-only Project resource to compatible agents.")
        if connections.isEmpty {
          ApplicationsExaInfoPill(
            text: "Agent rows stay visible but disabled until DigitalOcean OAuth is ready.")
        }
        LazyVGrid(
          columns: [GridItem(.adaptive(minimum: 245), spacing: 12)], alignment: .leading,
          spacing: 12
        ) {
          ForEach(targets) { target in
            ApplicationsDigitalOceanAgentSwitchRow(
              app: app, target: target, install: activeInstall(target.agentId),
              enabled: selected.map(digitalOceanConnectionIsReady) == true
                && target.status == .compatible)
          }
        }
      }
      ApplicationsExaPanel {
        HStack(alignment: .top) {
          ApplicationsExaSectionHeading(
            icon: "key", title: "Manage API Connection",
            subtitle: "Authorize one Team, Project, and selected Droplet or App.")
          Spacer()
          ApplicationsExaInfoPill(text: "Project Read · Droplet Read · App Read")
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
        if let status = model.digitalOceanConnectionStatus?.nilIfEmpty {
          Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
      }
      LazyVGrid(
        columns: [GridItem(.adaptive(minimum: 285), spacing: 14)], alignment: .leading, spacing: 14
      ) {
        ApplicationsExaInfoCard(
          icon: "shippingbox", title: "Capabilities", items: app.capabilities,
          linkTitle: "DigitalOcean API docs", linkURL: app.docsURL.flatMap(URL.init(string:)))
        ApplicationsExaInfoCard(
          icon: "lock.shield", title: "What Agents Can Do",
          items: [
            "List up to 25 Projects", "Inspect one exact Project and its resources",
            "Inspect one verified Droplet or App",
          ], linkTitle: nil, linkURL: nil)
        ApplicationsExaInfoCard(
          icon: "checklist", title: "Requirements",
          items: marketplaceConnectionRequirements(for: app), linkTitle: nil, linkURL: nil)
      }
    }
  }
  private var connectForm: some View {
    VStack(alignment: .leading, spacing: 12) {
      Text("Connect DigitalOcean").font(.system(size: 15, weight: .bold))
      Text(
        "DigitalOcean returns a 30-day access token and single-use refresh token. Relay stores both separately; the client secret, exchange, rotation, revoke, and resource verification stay in Railway."
      ).font(.system(size: 12)).foregroundStyle(RCTheme.muted)
      Button {
        model.startDigitalOceanOAuthConnect(for: app)
      } label: {
        Label(
          selected == nil ? "Authorize DigitalOcean" : "Reconnect DigitalOcean",
          systemImage: "link.badge.plus")
      }.buttonStyle(PrimaryLightButtonStyle()).frame(maxWidth: .infinity).disabled(
        model.busy == "connect-digitalocean-oauth"
          || model.providerConnectionSnapshot?.readOnly == true || app.availability != .available)
      Text(
        "Exact granular scopes, Team, Project, selected resource, and authenticated Railway callback are required."
      ).font(.system(size: 11, weight: .semibold)).foregroundStyle(RCTheme.muted)
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
          Text("Project / resource").frame(width: 250, alignment: .leading)
          Text("Scopes").frame(width: 250, alignment: .leading)
          Text("Status").frame(width: 90, alignment: .leading)
          Text("Actions").frame(width: 54)
        }.font(.system(size: 11, weight: .bold)).foregroundStyle(RCTheme.muted).padding(
          .horizontal, 14
        ).frame(height: 36)
        if connections.isEmpty {
          EmptyMiniLight(
            title: "No DigitalOcean OAuth connection",
            body: "Complete provider setup and authorization before assigning agents."
          ).padding(.vertical, 22)
        } else {
          ForEach(connections) { connection in
            HStack {
              Button {
                model.selectDigitalOceanConnection(connection.id)
              } label: {
                Image(
                  systemName: selected?.id == connection.id ? "largecircle.fill.circle" : "circle")
              }.buttonStyle(.plain).frame(width: 28).disabled(
                !digitalOceanConnectionIsReady(connection))
              Text(connection.accountLabel ?? "DigitalOcean resource").frame(
                width: 210, alignment: .leading)
              Text(
                (connection.health.diagnostics["projectName"]?.string ?? "?") + " / "
                  + (connection.health.diagnostics["resourceName"]?.string ?? "?")
              ).frame(width: 250, alignment: .leading).lineLimit(1)
              Text(connection.grantedScopes.joined(separator: ", ")).frame(
                width: 250, alignment: .leading)
              Text(digitalOceanConnectionIsReady(connection) ? "Ready" : "Reconnect").frame(
                width: 90, alignment: .leading)
              Button {
                model.deleteDigitalOceanConnection(connection, for: app)
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
            "Broad aliases, environment values, logs, console, credentials, user-data, writes, raw API, cross-Project reads, and automatic pagination are blocked."
          )
          Spacer()
        }.font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted).padding(
          .horizontal, 14
        ).frame(height: 38).overlay(alignment: .top) {
          Rectangle().fill(RCTheme.borderSoft).frame(height: 1)
        }
      }.frame(minWidth: 900)
    }.background(RCTheme.surfaceInset).clipShape(RoundedRectangle(cornerRadius: 8)).overlay(
      RoundedRectangle(cornerRadius: 8).stroke(RCTheme.borderSoft))
  }
  private func activeInstall(_ agentId: RelayId) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "digitalocean" && exaInstallIsActive($0)
    }
  }
}
