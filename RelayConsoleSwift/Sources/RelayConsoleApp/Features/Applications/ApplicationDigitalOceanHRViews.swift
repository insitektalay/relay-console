import AppKit
import RelayConsoleCore
import SwiftUI
import UniformTypeIdentifiers

struct ApplicationsDigitalOceanAgentSwitchRow: View {
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
          !enabled || model.busy == "toggle-digitalocean-agent-\(target.agentId)")
      }
      if isOn, let install {
        Text("Read-only DigitalOcean Project and verified resource").font(
          .system(size: 11, weight: .bold)
        ).foregroundStyle(RCTheme.muted)
        ApplicationsAgentAuthorityRow(app: app, install: install, selectedPreset: .readOnly)
      }
    }.padding(12).frame(minHeight: 86).background(
      isOn ? RCTheme.sidebarSelected.opacity(0.48) : RCTheme.surfaceInset
    ).clipShape(RoundedRectangle(cornerRadius: 8)).opacity(!enabled && !isOn ? 0.65 : 1).alert(
      pending == true ? "Connect agent to DigitalOcean?" : "Disconnect DigitalOcean?",
      isPresented: Binding(get: { pending != nil }, set: { if !$0 { pending = nil } })
    ) {
      Button("Cancel", role: .cancel) { pending = nil }
      Button(pending == true ? "Connect" : "Disconnect") {
        let value = pending ?? !isOn
        pending = nil
        model.setDigitalOceanAgentConnection(target.agentId, enabled: value, for: app)
      }
    } message: {
      Text("This changes only the selected agent's bounded read-only DigitalOcean access.")
    }
  }
}

func firebaseConnectionIsReady(_ connection: MarketplaceProviderConnection) -> Bool {
  connection.appSlug == "firebase" && connection.status == .connected
    && connection.health.state == .ready
    && connection.grantedScopes == ProviderConnectionService.firebaseReadScopes
    && connection.health.diagnostics["apiOrigin"]?.string == FirebaseProviderActionSupport.apiOrigin
    && connection.health.diagnostics["projectId"]?.string.map(FirebaseProviderActionSupport.safeId)
      == true
}
struct ApplicationsFirebaseDetailPanel: View {
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
          icon: "person.2", title: "Agents with Firebase",
          subtitle: "Assign the selected read-only Firebase Project inventory to compatible agents."
        )
        if connections.isEmpty {
          ApplicationsExaInfoPill(
            text: "Agent rows stay visible but disabled until Firebase OAuth is ready.")
        }
        LazyVGrid(
          columns: [GridItem(.adaptive(minimum: 245), spacing: 12)], alignment: .leading,
          spacing: 12
        ) {
          ForEach(targets) { target in
            ApplicationsFirebaseAgentSwitchRow(
              app: app, target: target, install: activeInstall(target.agentId),
              enabled: selected.map(firebaseConnectionIsReady) == true
                && target.status == .compatible)
          }
        }
      }
      ApplicationsExaPanel {
        HStack(alignment: .top) {
          ApplicationsExaSectionHeading(
            icon: "key", title: "Manage API Connection",
            subtitle: "Authorize firebase.readonly and select one exact Firebase Project.")
          Spacer()
          ApplicationsExaInfoPill(text: "firebase.readonly")
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
        if let status = model.firebaseConnectionStatus?.nilIfEmpty {
          Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
      }
      LazyVGrid(
        columns: [GridItem(.adaptive(minimum: 285), spacing: 14)], alignment: .leading, spacing: 14
      ) {
        ApplicationsExaInfoCard(
          icon: "shippingbox", title: "Capabilities", items: app.capabilities,
          linkTitle: "Firebase Management API docs", linkURL: app.docsURL.flatMap(URL.init(string:))
        )
        ApplicationsExaInfoCard(
          icon: "lock.shield", title: "What Agents Can Do",
          items: [
            "List up to 25 active Firebase Projects", "Inspect the exact selected Firebase Project",
            "List its first 25 registered Firebase Apps",
          ], linkTitle: nil, linkURL: nil)
        ApplicationsExaInfoCard(
          icon: "checklist", title: "Requirements",
          items: marketplaceConnectionRequirements(for: app), linkTitle: nil, linkURL: nil)
      }
    }
  }
  private var connectForm: some View {
    VStack(alignment: .leading, spacing: 12) {
      Text("Connect Firebase").font(.system(size: 15, weight: .bold))
      Text(
        "Relay uses Google's confidential offline authorization-code flow. Access and refresh tokens are stored as separate Keychain references; the client secret, exchange, refresh, revoke, and exact Project selection stay in Railway."
      ).font(.system(size: 12)).foregroundStyle(RCTheme.muted)
      Button {
        model.startFirebaseOAuthConnect(for: app)
      } label: {
        Label(
          selected == nil ? "Authorize Firebase" : "Reconnect Firebase",
          systemImage: "link.badge.plus")
      }.buttonStyle(PrimaryLightButtonStyle()).frame(maxWidth: .infinity).disabled(
        model.busy == "connect-firebase-oauth" || model.providerConnectionSnapshot?.readOnly == true
          || app.availability != .available)
      Text(
        "Google OAuth branding/verification, exact callback, firebase.readonly consent, and one selected Project are required."
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
          Text("Firebase Project").frame(width: 230, alignment: .leading)
          Text("Scope").frame(width: 300, alignment: .leading)
          Text("Status").frame(width: 90, alignment: .leading)
          Text("Actions").frame(width: 54)
        }.font(.system(size: 11, weight: .bold)).foregroundStyle(RCTheme.muted).padding(
          .horizontal, 14
        ).frame(height: 36)
        if connections.isEmpty {
          EmptyMiniLight(
            title: "No Firebase OAuth connection",
            body:
              "Complete provider setup, consent, and exact Project selection before assigning agents."
          ).padding(.vertical, 22)
        } else {
          ForEach(connections) { connection in
            HStack {
              Button {
                model.selectFirebaseConnection(connection.id)
              } label: {
                Image(
                  systemName: selected?.id == connection.id ? "largecircle.fill.circle" : "circle")
              }.buttonStyle(.plain).frame(width: 28).disabled(
                !firebaseConnectionIsReady(connection))
              Text(connection.accountLabel ?? "Firebase Project").frame(
                width: 210, alignment: .leading)
              Text(connection.health.diagnostics["projectId"]?.string ?? "?").frame(
                width: 230, alignment: .leading
              ).lineLimit(1)
              Text(connection.grantedScopes.joined(separator: ", ")).frame(
                width: 300, alignment: .leading
              ).lineLimit(1)
              Text(firebaseConnectionIsReady(connection) ? "Ready" : "Reconnect").frame(
                width: 90, alignment: .leading)
              Button {
                model.deleteFirebaseConnection(connection, for: app)
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
            "API key IDs, Admin SDK/config artifacts, Firebase product data, writes, raw APIs, cross-Project reads, and automatic pagination are blocked."
          )
          Spacer()
        }.font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted).padding(
          .horizontal, 14
        ).frame(height: 38).overlay(alignment: .top) {
          Rectangle().fill(RCTheme.borderSoft).frame(height: 1)
        }
      }.frame(minWidth: 920)
    }.background(RCTheme.surfaceInset).clipShape(RoundedRectangle(cornerRadius: 8)).overlay(
      RoundedRectangle(cornerRadius: 8).stroke(RCTheme.borderSoft))
  }
  private func activeInstall(_ agentId: RelayId) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "firebase" && exaInstallIsActive($0)
    }
  }
}
struct ApplicationsFirebaseAgentSwitchRow: View {
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
          !enabled || model.busy == "toggle-firebase-agent-\(target.agentId)")
      }
      if isOn, let install {
        Text("Read-only Firebase Project and App inventory").font(.system(size: 11, weight: .bold))
          .foregroundStyle(RCTheme.muted)
        ApplicationsAgentAuthorityRow(app: app, install: install, selectedPreset: .readOnly)
      }
    }.padding(12).frame(minHeight: 86).background(
      isOn ? RCTheme.sidebarSelected.opacity(0.48) : RCTheme.surfaceInset
    ).clipShape(RoundedRectangle(cornerRadius: 8)).opacity(!enabled && !isOn ? 0.65 : 1).alert(
      pending == true ? "Connect agent to Firebase?" : "Disconnect Firebase?",
      isPresented: Binding(get: { pending != nil }, set: { if !$0 { pending = nil } })
    ) {
      Button("Cancel", role: .cancel) { pending = nil }
      Button(pending == true ? "Connect" : "Disconnect") {
        let value = pending ?? !isOn
        pending = nil
        model.setFirebaseAgentConnection(target.agentId, enabled: value, for: app)
      }
    } message: {
      Text("This changes only the selected agent's bounded read-only Firebase access.")
    }
  }
}

func supabaseConnectionIsReady(_ connection: MarketplaceProviderConnection) -> Bool {
  connection.appSlug == "supabase" && connection.status == .connected
    && connection.health.state == .ready
    && connection.grantedScopes == ProviderConnectionService.supabaseReadScopes
    && connection.health.diagnostics["apiOrigin"]?.string == SupabaseProviderActionSupport.apiOrigin
    && connection.health.diagnostics["organizationSlug"]?.string.map(
      SupabaseProviderActionSupport.safeSlug) == true
    && connection.health.diagnostics["projectRef"]?.string.map(
      SupabaseProviderActionSupport.safeRef) == true
}
struct ApplicationsSupabaseDetailPanel: View {
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
          icon: "person.2", title: "Agents with Supabase",
          subtitle:
            "Assign the selected read-only Organization and Project inventory to compatible agents."
        )
        if connections.isEmpty {
          ApplicationsExaInfoPill(
            text: "Agent rows stay visible but disabled until Supabase OAuth is ready.")
        }
        LazyVGrid(
          columns: [GridItem(.adaptive(minimum: 245), spacing: 12)], alignment: .leading,
          spacing: 12
        ) {
          ForEach(targets) { target in
            ApplicationsSupabaseAgentSwitchRow(
              app: app, target: target, install: activeInstall(target.agentId),
              enabled: selected.map(supabaseConnectionIsReady) == true
                && target.status == .compatible)
          }
        }
      }
      ApplicationsExaPanel {
        HStack(alignment: .top) {
          ApplicationsExaSectionHeading(
            icon: "key", title: "Manage API Connection",
            subtitle:
              "Authorize organizations:read and projects:read, then select one exact Organization and Project."
          )
          Spacer()
          ApplicationsExaInfoPill(text: "organizations:read + projects:read")
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
        if let status = model.supabaseConnectionStatus?.nilIfEmpty {
          Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
      }
      LazyVGrid(
        columns: [GridItem(.adaptive(minimum: 285), spacing: 14)], alignment: .leading, spacing: 14
      ) {
        ApplicationsExaInfoCard(
          icon: "shippingbox", title: "Capabilities", items: app.capabilities,
          linkTitle: "Supabase Management API docs", linkURL: app.docsURL.flatMap(URL.init(string:))
        )
        ApplicationsExaInfoCard(
          icon: "lock.shield", title: "What Agents Can Do",
          items: [
            "Inspect the exact Supabase Organization", "List its first 25 Projects at offset zero",
            "Inspect the exact selected Project",
          ], linkTitle: nil, linkURL: nil)
        ApplicationsExaInfoCard(
          icon: "checklist", title: "Requirements",
          items: marketplaceConnectionRequirements(for: app), linkTitle: nil, linkURL: nil)
      }
    }
  }
  private var connectForm: some View {
    VStack(alignment: .leading, spacing: 12) {
      Text("Connect Supabase").font(.system(size: 15, weight: .bold))
      Text(
        "Relay uses Supabase's confidential authorization-code flow with S256 PKCE. Access and refresh tokens are separate Keychain references; client secret, exchange, refresh, revoke, and exact Organization/Project selection stay in Railway."
      ).font(.system(size: 12)).foregroundStyle(RCTheme.muted)
      Button {
        model.startSupabaseOAuthConnect(for: app)
      } label: {
        Label(
          selected == nil ? "Authorize Supabase" : "Reconnect Supabase",
          systemImage: "link.badge.plus")
      }.buttonStyle(PrimaryLightButtonStyle()).frame(maxWidth: .infinity).disabled(
        model.busy == "connect-supabase-oauth" || model.providerConnectionSnapshot?.readOnly == true
          || app.availability != .available)
      Text(
        "Published OAuth App setup, exact callback, exact read scopes, and one selected Organization/Project are required."
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
          Text("Organization").frame(width: 150, alignment: .leading)
          Text("Project ref").frame(width: 190, alignment: .leading)
          Text("Status").frame(width: 90, alignment: .leading)
          Text("Actions").frame(width: 54)
        }.font(.system(size: 11, weight: .bold)).foregroundStyle(RCTheme.muted).padding(
          .horizontal, 14
        ).frame(height: 36)
        if connections.isEmpty {
          EmptyMiniLight(
            title: "No Supabase OAuth connection",
            body:
              "Complete provider setup, consent, and exact Organization/Project selection before assigning agents."
          ).padding(.vertical, 22)
        } else {
          ForEach(connections) { connection in
            HStack {
              Button {
                model.selectSupabaseConnection(connection.id)
              } label: {
                Image(
                  systemName: selected?.id == connection.id ? "largecircle.fill.circle" : "circle")
              }.buttonStyle(.plain).frame(width: 28).disabled(
                !supabaseConnectionIsReady(connection))
              Text(connection.accountLabel ?? "Supabase Project").frame(
                width: 210, alignment: .leading)
              Text(connection.health.diagnostics["organizationSlug"]?.string ?? "?").frame(
                width: 150, alignment: .leading
              ).lineLimit(1)
              Text(connection.health.diagnostics["projectRef"]?.string ?? "?").frame(
                width: 190, alignment: .leading
              ).lineLimit(1)
              Text(supabaseConnectionIsReady(connection) ? "Ready" : "Reconnect").frame(
                width: 90, alignment: .leading)
              Button {
                model.deleteSupabaseConnection(connection, for: app)
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
            "Database details/data, credentials, secrets, config, members, logs, writes, raw APIs, cross-Organization reads, and automatic pagination are blocked."
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
      $0.agentId == agentId && $0.appSlug == "supabase" && exaInstallIsActive($0)
    }
  }
}
struct ApplicationsSupabaseAgentSwitchRow: View {
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
          !enabled || model.busy == "toggle-supabase-agent-\(target.agentId)")
      }
      if isOn, let install {
        Text("Read-only Supabase Organization and Project inventory").font(
          .system(size: 11, weight: .bold)
        ).foregroundStyle(RCTheme.muted)
        ApplicationsAgentAuthorityRow(app: app, install: install, selectedPreset: .readOnly)
      }
    }.padding(12).frame(minHeight: 86).background(
      isOn ? RCTheme.sidebarSelected.opacity(0.48) : RCTheme.surfaceInset
    ).clipShape(RoundedRectangle(cornerRadius: 8)).opacity(!enabled && !isOn ? 0.65 : 1).alert(
      pending == true ? "Connect agent to Supabase?" : "Disconnect Supabase?",
      isPresented: Binding(get: { pending != nil }, set: { if !$0 { pending = nil } })
    ) {
      Button("Cancel", role: .cancel) { pending = nil }
      Button(pending == true ? "Connect" : "Disconnect") {
        let value = pending ?? !isOn
        pending = nil
        model.setSupabaseAgentConnection(target.agentId, enabled: value, for: app)
      }
    } message: {
      Text("This changes only the selected agent's bounded read-only Supabase access.")
    }
  }
}

func oktaConnectionIsReady(_ connection: MarketplaceProviderConnection) -> Bool {
  connection.appSlug == "okta" && connection.status == .connected
    && connection.health.state == .ready
    && connection.grantedScopes == ProviderConnectionService.oktaReadScopes
    && connection.health.diagnostics["apiOrigin"]?.string.flatMap(
      OktaProviderActionSupport.safeOrigin) != nil
    && connection.health.diagnostics["clientId"]?.string.map(OktaProviderActionSupport.safeId)
      == true
    && connection.health.diagnostics["applicationId"]?.string.map(OktaProviderActionSupport.safeId)
      == true
}
struct ApplicationsOktaDetailPanel: View {
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
          icon: "person.2", title: "Agents with Okta",
          subtitle: "Assign the selected read-only Okta Application inventory to compatible agents."
        )
        if connections.isEmpty {
          ApplicationsExaInfoPill(
            text: "Agent rows stay visible but disabled until the OIN credentials are ready.")
        }
        LazyVGrid(
          columns: [GridItem(.adaptive(minimum: 245), spacing: 12)], alignment: .leading,
          spacing: 12
        ) {
          ForEach(targets) { target in
            ApplicationsOktaAgentSwitchRow(
              app: app, target: target, install: activeInstall(target.agentId),
              enabled: selected.map(oktaConnectionIsReady) == true && target.status == .compatible)
          }
        }
      }
      ApplicationsExaPanel {
        HStack(alignment: .top) {
          ApplicationsExaSectionHeading(
            icon: "key", title: "Manage API Connection",
            subtitle:
              "Enter the unique credentials generated when this org installs Relay's OIN API service integration."
          )
          Spacer()
          ApplicationsExaInfoPill(text: "okta.apps.read")
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
        if let status = model.oktaConnectionStatus?.nilIfEmpty {
          Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
      }
      LazyVGrid(
        columns: [GridItem(.adaptive(minimum: 285), spacing: 14)], alignment: .leading, spacing: 14
      ) {
        ApplicationsExaInfoCard(
          icon: "shippingbox", title: "Capabilities", items: app.capabilities,
          linkTitle: "Okta API service integration guide",
          linkURL: app.docsURL.flatMap(URL.init(string:)))
        ApplicationsExaInfoCard(
          icon: "lock.shield", title: "What Agents Can Do",
          items: [
            "List the first 25 Applications in one Okta org",
            "Inspect the exact selected Application",
            "List its first 25 assigned Groups without members",
          ], linkTitle: nil, linkURL: nil)
        ApplicationsExaInfoCard(
          icon: "checklist", title: "Requirements",
          items: marketplaceConnectionRequirements(for: app), linkTitle: nil, linkURL: nil)
      }
    }
  }
  private var connectForm: some View {
    VStack(alignment: .leading, spacing: 10) {
      Text("Connect Okta").font(.system(size: 15, weight: .bold))
      Text(
        "Install and authorize Relay in Okta's OIN, then copy the org domain, generated client ID, one-time client secret, and selected Application. The secret is stored only in Keychain; one-hour access tokens are never persisted."
      ).font(.system(size: 12)).foregroundStyle(RCTheme.muted)
      TextField("acme.okta.com", text: $model.oktaOrgDomainDraft).textFieldStyle(.roundedBorder)
      TextField("OIN client ID", text: $model.oktaClientIdDraft).textFieldStyle(.roundedBorder)
      SecureField("One-time client secret", text: $model.oktaClientSecretDraft).textFieldStyle(
        .roundedBorder)
      TextField("Selected Application ID", text: $model.oktaApplicationIdDraft).textFieldStyle(
        .roundedBorder)
      TextField("Selected Application label", text: $model.oktaApplicationLabelDraft)
        .textFieldStyle(.roundedBorder)
      Button {
        model.saveOktaOINConnection(for: app)
      } label: {
        Label("Save Okta connection", systemImage: "link.badge.plus")
      }.buttonStyle(PrimaryLightButtonStyle()).frame(maxWidth: .infinity).disabled(
        model.busy == "connect-okta-oin" || model.providerConnectionSnapshot?.readOnly == true
          || app.availability != .available)
      Text(
        "Only okta.apps.read is accepted. Revoke the OIN instance in Okta before deleting it here when disconnecting."
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
          Text("Okta org").frame(width: 180, alignment: .leading)
          Text("Application").frame(width: 190, alignment: .leading)
          Text("Status").frame(width: 90, alignment: .leading)
          Text("Actions").frame(width: 54)
        }.font(.system(size: 11, weight: .bold)).foregroundStyle(RCTheme.muted).padding(
          .horizontal, 14
        ).frame(height: 36)
        if connections.isEmpty {
          EmptyMiniLight(
            title: "No Okta OIN connection",
            body:
              "Install Relay in the customer org and enter its one-time credentials before assigning agents."
          ).padding(.vertical, 22)
        } else {
          ForEach(connections) { connection in
            HStack {
              Button {
                model.selectOktaConnection(connection.id)
              } label: {
                Image(
                  systemName: selected?.id == connection.id ? "largecircle.fill.circle" : "circle")
              }.buttonStyle(.plain).frame(width: 28).disabled(!oktaConnectionIsReady(connection))
              Text(connection.accountLabel ?? "Okta Application").frame(
                width: 210, alignment: .leading)
              Text(connection.health.diagnostics["orgDomain"]?.string ?? "?").frame(
                width: 180, alignment: .leading
              ).lineLimit(1)
              Text(connection.health.diagnostics["applicationLabel"]?.string ?? "?").frame(
                width: 190, alignment: .leading
              ).lineLimit(1)
              Text(oktaConnectionIsReady(connection) ? "Ready" : "Reconnect").frame(
                width: 90, alignment: .leading)
              Button {
                model.deleteOktaConnection(connection, for: app)
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
            "Credentials, access tokens, settings, users, assignments, group members, logs, policies, writes, raw APIs, cross-org reads, and automatic pagination are blocked."
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
      $0.agentId == agentId && $0.appSlug == "okta" && exaInstallIsActive($0)
    }
  }
}
struct ApplicationsOktaAgentSwitchRow: View {
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
          !enabled || model.busy == "toggle-okta-agent-\(target.agentId)")
      }
      if isOn, let install {
        Text("Read-only Okta Application and assigned-Group inventory").font(
          .system(size: 11, weight: .bold)
        ).foregroundStyle(RCTheme.muted)
        ApplicationsAgentAuthorityRow(app: app, install: install, selectedPreset: .readOnly)
      }
    }.padding(12).frame(minHeight: 86).background(
      isOn ? RCTheme.sidebarSelected.opacity(0.48) : RCTheme.surfaceInset
    ).clipShape(RoundedRectangle(cornerRadius: 8)).opacity(!enabled && !isOn ? 0.65 : 1).alert(
      pending == true ? "Connect agent to Okta?" : "Disconnect Okta?",
      isPresented: Binding(get: { pending != nil }, set: { if !$0 { pending = nil } })
    ) {
      Button("Cancel", role: .cancel) { pending = nil }
      Button(pending == true ? "Connect" : "Disconnect") {
        let value = pending ?? !isOn
        pending = nil
        model.setOktaAgentConnection(target.agentId, enabled: value, for: app)
      }
    } message: {
      Text("This changes only the selected agent's bounded read-only Okta access.")
    }
  }
}

func bambooHRConnectionIsReady(_ connection: MarketplaceProviderConnection) -> Bool {
  connection.appSlug == "bamboohr" && connection.status == .connected
    && connection.health.state == .ready
    && connection.grantedScopes == ProviderConnectionService.bambooHRReadScopes
    && connection.health.diagnostics["companyDomain"]?.string.map(
      BambooHRProviderActionSupport.safeCompany) == true
    && connection.health.diagnostics["locationId"]?.string.map(BambooHRProviderActionSupport.safeId)
      == true
}
