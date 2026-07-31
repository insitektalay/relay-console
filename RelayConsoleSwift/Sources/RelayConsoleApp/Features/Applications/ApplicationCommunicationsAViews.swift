import AppKit
import RelayConsoleCore
import SwiftUI
import UniformTypeIdentifiers

struct ApplicationsXConnectionRow: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp
  let connection: MarketplaceProviderConnection
  let selected: Bool

  private var isDeleting: Bool {
    model.busy == "delete-x-token-connection-\(connection.id)"
  }

  var body: some View {
    HStack(spacing: 12) {
      Button {
        model.selectXTokenConnection(connection.id)
      } label: {
        ZStack {
          Circle()
            .stroke(selected ? RCTheme.accentBlue : RCTheme.borderStrong, lineWidth: 1.6)
            .frame(width: 18, height: 18)
          if selected {
            Circle()
              .fill(RCTheme.accentBlue)
              .frame(width: 9, height: 9)
          }
        }
      }
      .buttonStyle(.plain)
      .frame(width: 28)
      .disabled(!xConnectionIsValid(connection))
      .help("Select \(xConnectionName(connection))")
      .accessibilityLabel("Select \(xConnectionName(connection))")

      HStack(spacing: 8) {
        Text(xConnectionName(connection))
          .font(.system(size: 13, weight: .bold))
          .lineLimit(1)
        if selected {
          Text("ACTIVE")
            .font(.system(size: 9, weight: .bold))
            .foregroundStyle(RCTheme.accentBlue)
            .padding(.horizontal, 7)
            .frame(height: 20)
            .background(RCTheme.accentBlue.opacity(0.12))
            .clipShape(RoundedRectangle(cornerRadius: 4))
            .overlay(RoundedRectangle(cornerRadius: 4).stroke(RCTheme.accentBlue.opacity(0.35)))
        }
      }
      .frame(minWidth: 160, maxWidth: .infinity, alignment: .leading)

      Text(xTokenPreview(connection))
        .font(.system(size: 13, weight: .semibold, design: .monospaced))
        .foregroundStyle(RCTheme.muted)
        .frame(width: 150, alignment: .leading)

      HStack(spacing: 7) {
        Image(
          systemName: xConnectionIsValid(connection)
            ? "checkmark.circle.fill" : "exclamationmark.triangle.fill"
        )
        .foregroundStyle(xConnectionIsValid(connection) ? RCTheme.accentGreen : RCTheme.accentAmber)
        Text(xConnectionStatusText(connection))
          .font(.system(size: 12, weight: .semibold))
      }
      .frame(width: 110, alignment: .leading)

      Text(xLastSavedText(connection))
        .font(.system(size: 12, weight: .semibold))
        .foregroundStyle(RCTheme.muted)
        .frame(width: 110, alignment: .leading)

      Button {
        model.deleteXTokenConnection(connection, for: app)
      } label: {
        Image(systemName: "trash")
      }
      .buttonStyle(IconLightButtonStyle())
      .disabled(isDeleting || model.providerConnectionSnapshot?.readOnly == true)
      .help("Delete \(xConnectionName(connection))")
      .accessibilityLabel("Delete \(xConnectionName(connection))")
      .frame(width: 58, alignment: .center)
    }
    .padding(.horizontal, 14)
    .frame(height: 46)
    .frame(maxWidth: .infinity)
    .background(selected ? RCTheme.sidebarSelected.opacity(0.55) : Color.clear)
    .overlay(alignment: .top) {
      Rectangle().fill(selected ? RCTheme.accentBlue.opacity(0.55) : RCTheme.borderSoft).frame(
        height: selected ? 1.2 : 1)
    }
    .overlay(alignment: .bottom) {
      if selected {
        Rectangle().fill(RCTheme.accentBlue.opacity(0.55)).frame(height: 1.2)
      }
    }
  }
}

struct ApplicationsXConnectionMenu: View {
  @EnvironmentObject var model: AppViewModel
  let connections: [MarketplaceProviderConnection]
  let selectedConnection: MarketplaceProviderConnection?

  var body: some View {
    Menu {
      ForEach(connections) { connection in
        Button {
          model.selectXTokenConnection(connection.id)
        } label: {
          Text(xConnectionName(connection))
        }
        .disabled(!xConnectionIsValid(connection))
      }
    } label: {
      HStack(spacing: 8) {
        Text(selectedConnection.map(xConnectionName) ?? "No X account selected")
          .lineLimit(1)
        Image(systemName: "chevron.down")
          .font(.system(size: 10, weight: .bold))
          .foregroundStyle(RCTheme.muted)
      }
      .font(.system(size: 13, weight: .semibold))
      .padding(.horizontal, 12)
      .frame(height: 36)
      .background(RCTheme.surfaceInset)
      .clipShape(RoundedRectangle(cornerRadius: 7))
      .overlay(RoundedRectangle(cornerRadius: 7).stroke(RCTheme.borderSoft))
    }
    .menuStyle(.borderlessButton)
    .disabled(connections.isEmpty)
  }
}

struct ApplicationsBlueskyDetailPanel: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp

  private var connections: [MarketplaceProviderConnection] {
    (model.providerConnectionSnapshot?.connections ?? []).filter { $0.appSlug == app.slug }
  }
  private var selected: MarketplaceProviderConnection? {
    model.selectedProviderConnection?.appSlug == app.slug ? model.selectedProviderConnection : nil
  }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    let query = model.blueskyAgentSearch.trimmingCharacters(in: .whitespacesAndNewlines)
    return model.visibleMarketplaceCompatibleAgents.filter {
      app.runtimeSupport.contains($0.runtimeType)
        && (query.isEmpty || $0.agentName.localizedCaseInsensitiveContains(query)
          || exaRuntimeLabel($0.runtimeType).localizedCaseInsensitiveContains(query))
    }
  }
  private func install(_ target: MarketplaceCompatibleAgentTarget) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == target.agentId && $0.appSlug == app.slug && exaInstallIsActive($0)
    }
  }
  private func ready(_ connection: MarketplaceProviderConnection?) -> Bool {
    guard let connection else { return false }
    return connection.status == .connected && connection.health.state == .ready
      && Set(connection.grantedScopes) == Set(["atproto", "repo:app.bsky.feed.post?action=create"])
      && connection.health.diagnostics["didVerified"]?.bool == true
      && connection.health.diagnostics["pdsVerified"]?.bool == true
      && connection.health.diagnostics["issuerVerified"]?.bool == true
      && connection.health.diagnostics["dpopBound"]?.bool == true
      && connection.health.diagnostics["ownOriginalPostsOnly"]?.bool == true
      && connection.health.diagnostics["textOnlyCreate"]?.bool == true
      && connection.health.diagnostics["automaticPagination"]?.bool == false
      && connection.health.diagnostics["rawToolsEnabled"]?.bool == false
  }
  private var connectedCount: Int {
    targets.filter { install($0)?.connectionId == selected?.id }.count
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      ApplicationsExaHeroCard(app: app)
      agentsPanel
      connectionPanel
      ApplicationsInfoCardsLayout {
        ApplicationsExaInfoCard(
          icon: "text.bubble", title: "Capabilities", items: app.capabilities,
          linkTitle: "Bluesky developer documentation",
          linkURL: app.docsURL.flatMap(URL.init(string:)))
        ApplicationsExaInfoCard(
          icon: "doc.text.magnifyingglass", title: "What Agents Can Do",
          items: [
            "Identify the OAuth-bound Bluesky account and public profile",
            "Review up to ten recent original text posts from that account",
            "Draft locally and intentionally publish one text-only post",
          ], linkTitle: nil, linkURL: nil)
        ApplicationsExaInfoCard(
          icon: "lock.shield", title: "Requirements",
          items: [
            "AT Protocol OAuth through the authenticated Railway callback",
            "Standard, Direct writes, Read only, or No access authority",
            "No replies, quotes, engagement, media, destructive actions, discovery, private messages, paging, or raw XRPC",
          ], linkTitle: nil, linkURL: nil)
      }
    }
  }

  private var agentsPanel: some View {
    ApplicationsExaPanel {
      ViewThatFits(in: .horizontal) {
        HStack(alignment: .top, spacing: 14) {
          agentHeading
          Spacer()
          agentControls
        }
        VStack(alignment: .leading, spacing: 12) {
          agentHeading
          agentControls
        }
      }
      if selected == nil {
        ApplicationsExaInfoPill(
          text:
            "Connect and select one verified Bluesky account before turning agents on. Controls remain visible while unavailable."
        )
      }
      ApplicationsAgentGridScroll {
        ForEach(targets) { target in
          ApplicationsBlueskyAgentRow(
            app: app, target: target, install: install(target),
            selectedConnection: selected,
            disabled: !ready(selected) || target.status != .compatible)
        }
      }
      HStack {
        Spacer()
        Text("\(connectedCount)").font(.system(size: 13, weight: .bold)).foregroundStyle(
          RCTheme.accentGreen)
        Text("of \(targets.count) agents connected to Bluesky.").font(
          .system(size: 13, weight: .semibold)
        ).foregroundStyle(RCTheme.muted)
      }
    }
  }

  private var agentHeading: some View {
    ApplicationsExaSectionHeading(
      icon: "person.2", title: "Agents with Bluesky",
      subtitle: "Assign the active account with explicit read and text-publish authority.")
  }
  private var agentControls: some View {
    HStack(spacing: 10) {
      Text("Active connection:").font(.system(size: 12, weight: .semibold)).foregroundStyle(
        RCTheme.muted)
      Menu {
        ForEach(connections) { connection in
          Button(connection.accountLabel ?? "Bluesky account") {
            model.selectBlueskyConnection(connection.id)
          }.disabled(!ready(connection))
        }
      } label: {
        HStack(spacing: 8) {
          Text(selected?.accountLabel ?? "No Bluesky account selected").lineLimit(1)
          Image(systemName: "chevron.down").font(.system(size: 10, weight: .bold)).foregroundStyle(
            RCTheme.muted)
        }
        .font(.system(size: 13, weight: .semibold)).padding(.horizontal, 12)
        .frame(height: 36).background(RCTheme.surfaceInset)
        .clipShape(RoundedRectangle(cornerRadius: 7))
        .overlay(RoundedRectangle(cornerRadius: 7).stroke(RCTheme.borderSoft))
      }.menuStyle(.borderlessButton).disabled(connections.isEmpty)
      ApplicationsExaSearchField(text: $model.blueskyAgentSearch, placeholder: "Search agents...")
        .frame(width: 250)
    }
  }

  private var connectionPanel: some View {
    ApplicationsExaPanel {
      ApplicationsExaSectionHeading(
        icon: "key", title: "Manage API Connections",
        subtitle:
          "Relay brokers minimal AT Protocol OAuth through Railway for one account at a time.")
      ApplicationsConnectionFormGrid {
        VStack(alignment: .leading, spacing: 8) {
          Text("BLUESKY OR AT PROTOCOL HANDLE").font(.system(size: 10, weight: .bold))
            .foregroundStyle(RCTheme.muted)
          TextField("name.bsky.social", text: $model.blueskyHandleDraft).textFieldStyle(
            .roundedBorder)
          Text(
            "Used only to discover and authorize the account's DID, PDS, and authorization server."
          )
          .font(.system(size: 10, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
        VStack(alignment: .leading, spacing: 8) {
          Text("REQUESTED ACCESS").font(.system(size: 10, weight: .bold)).foregroundStyle(
            RCTheme.muted)
          Text("Identity · create text posts").font(.system(size: 12, weight: .semibold))
          Text(
            "Create-only post access; no media, edit, delete, engagement, private data, or broad transition scope."
          )
          .font(.system(size: 10, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
      }
      Button {
        model.startBlueskyOAuthConnect(for: app)
      } label: {
        Label(
          connections.isEmpty ? "Connect Bluesky" : "Connect another account",
          systemImage: "person.badge.key")
      }
      .buttonStyle(PrimaryLightButtonStyle())
      .disabled(
        model.providerConnectionSnapshot?.readOnly == true
          || model.blueskyHandleDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
      HStack(spacing: 7) {
        Image(systemName: "lock")
        Text(
          "OAuth tokens and DPoP key material stay behind secret references; agents receive only Relay wrappers."
        )
      }.font(.system(size: 11, weight: .semibold)).foregroundStyle(RCTheme.muted)
      if let status = model.blueskyConnectionStatus?.nilIfEmpty {
        Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
      }
      VStack(spacing: 0) {
        HStack {
          Text("SELECT")
          Text("ACCOUNT / DID").frame(maxWidth: .infinity, alignment: .leading)
          Text("STATUS")
          Text("ACTIONS").frame(width: 100, alignment: .trailing)
        }.font(.system(size: 10, weight: .bold)).foregroundStyle(RCTheme.muted)
          .padding(10).background(RCTheme.surfaceInset)
        if connections.isEmpty {
          EmptyMiniLight(
            title: "No Bluesky connections",
            body: "Enter a handle and authorize Bluesky before assigning agents."
          )
          .padding(.vertical, 10)
        } else {
          ForEach(connections) { connection in
            HStack(spacing: 12) {
              Button {
                model.selectBlueskyConnection(connection.id)
              } label: {
                Image(
                  systemName: selected?.id == connection.id ? "checkmark.circle.fill" : "circle")
              }.buttonStyle(.plain).disabled(!ready(connection))
              VStack(alignment: .leading, spacing: 3) {
                Text(connection.accountLabel ?? "Bluesky account").font(
                  .system(size: 13, weight: .bold))
                Text(connection.connectedHandle ?? "Verified DID").font(.system(size: 11))
                  .foregroundStyle(RCTheme.muted).lineLimit(1)
              }.frame(maxWidth: .infinity, alignment: .leading)
              Text(ready(connection) ? "Ready" : "Blocked").font(.system(size: 11, weight: .bold))
              HStack(spacing: 6) {
                if model.busy == "test-bluesky-connection-\(connection.id)" {
                  ProgressView().controlSize(.small).scaleEffect(0.75)
                } else {
                  Button {
                    model.testBlueskyConnection(connection, for: app)
                  } label: {
                    Image(systemName: "arrow.clockwise")
                  }.buttonStyle(IconLightButtonStyle()).help("Test Bluesky connection")
                }
                Button {
                  model.deleteBlueskyConnection(connection, for: app)
                } label: {
                  Image(systemName: "trash")
                }.buttonStyle(IconLightButtonStyle()).help("Delete Bluesky connection")
              }.frame(width: 100, alignment: .trailing)
            }.padding(10).overlay(alignment: .bottom) { Divider() }
          }
        }
        HStack(spacing: 7) {
          Image(systemName: "lightbulb")
          Text("Only a healthy DID-bound OAuth connection can be selected for agents.")
        }.font(.system(size: 10, weight: .semibold)).foregroundStyle(RCTheme.muted)
          .frame(maxWidth: .infinity, alignment: .leading).padding(10)
      }.overlay(RoundedRectangle(cornerRadius: 8).stroke(RCTheme.borderSoft))
    }
  }
}

struct ApplicationsBlueskyAgentRow: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  let target: MarketplaceCompatibleAgentTarget
  let install: MarketplaceInstallRecord?
  let selectedConnection: MarketplaceProviderConnection?
  let disabled: Bool
  @State private var pending: Bool?
  private var isOn: Bool { install?.connectionId == selectedConnection?.id }
  private var busy: Bool { model.busy == "toggle-bluesky-agent-\(target.agentId)" }
  private var displayName: String {
    model.agents.first { $0.id == target.agentId }.map(model.resolveAgentDisplayName)
      ?? target.agentName
  }
  var body: some View {
    VStack(alignment: .leading, spacing: 9) {
      HStack(spacing: 12) {
        AgentAvatarView(name: displayName, avatarURL: model.agentAvatar(target.agentId), size: 38)
        VStack(alignment: .leading, spacing: 3) {
          Text(displayName).font(.system(size: 13, weight: .semibold))
          Text(
            target.status == .compatible
              ? exaRuntimeLabel(target.runtimeType) : (target.unavailableReason ?? "Unavailable")
          )
          .font(.system(size: 12, weight: .semibold))
          .foregroundStyle(target.status == .compatible ? RCTheme.muted : RCTheme.accentAmber)
        }
        Spacer()
        if busy {
          ProgressView().controlSize(.small).scaleEffect(0.75).frame(width: 32, height: 20)
        } else {
          Button {
            pending = !isOn
          } label: {
            ApplicationsExaSwitch(isOn: isOn)
          }
          .buttonStyle(.plain).disabled(disabled)
          .help(isOn ? "Disconnect Bluesky" : "Connect Bluesky")
        }
      }
      ApplicationsAgentAuthorityRow(
        app: app, install: install,
        selectedPreset: install.flatMap { model.marketplaceActionPolicyPreset(for: $0) }
          ?? .approvalRequired,
        muted: !isOn)
    }
    .padding(.horizontal, 12).padding(.vertical, 10).frame(minHeight: 86)
    .background(isOn ? RCTheme.sidebarSelected.opacity(0.48) : RCTheme.surfaceInset)
    .clipShape(RoundedRectangle(cornerRadius: 8))
    .overlay(
      RoundedRectangle(cornerRadius: 8).stroke(
        isOn ? RCTheme.accentGreen.opacity(0.22) : RCTheme.borderSoft)
    )
    .opacity(disabled && !isOn ? 0.72 : 1)
    .alert(
      pending == true
        ? "Connect \(displayName) to Bluesky?" : "Disconnect Bluesky for \(displayName)?",
      isPresented: Binding(get: { pending != nil }, set: { if !$0 { pending = nil } })
    ) {
      Button("Cancel", role: .cancel) { pending = nil }
      Button(pending == true ? "Connect" : "Disconnect", role: pending == true ? nil : .destructive)
      {
        let enabled = pending ?? !isOn
        pending = nil
        model.setBlueskyAgentConnection(target.agentId, enabled: enabled, for: app)
      }
    } message: {
      Text(
        pending == true
          ? "This grants the selected authority through four bounded Bluesky Relay wrappers."
          : "This removes the agent's Bluesky tools and bound-account access.")
    }
  }
}

func nextdoorConnectionIsReady(_ connection: MarketplaceProviderConnection?) -> Bool {
  guard let connection else { return false }
  return connection.appSlug == "nextdoor" && connection.status == .connected
    && connection.health.state == .ready
    && Set(connection.grantedScopes) == Set(["openid", "profile:read", "post:read", "post:write"])
    && connection.health.diagnostics["railwayCallbackOnly"]?.bool == true
    && connection.health.diagnostics["stateVerified"]?.bool == true
    && connection.health.diagnostics["profileVerified"]?.bool == true
    && connection.health.diagnostics["selectedProfileIdBound"]?.bool == true
    && ["neighbor", "business"].contains(
      connection.health.diagnostics["selectedProfileType"]?.string ?? "")
    && connection.health.diagnostics["ownPostsOnly"]?.bool == true
    && connection.health.diagnostics["textOnlyCreate"]?.bool == true
    && connection.health.diagnostics["automaticRetry"]?.bool == false
    && connection.health.diagnostics["automaticPagination"]?.bool == false
    && connection.health.diagnostics["rawToolsEnabled"]?.bool == false
}

struct ApplicationsNextdoorDetailPanel: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp

  private var connections: [MarketplaceProviderConnection] {
    (model.providerConnectionSnapshot?.connections ?? []).filter { $0.appSlug == "nextdoor" }
  }
  private var selected: MarketplaceProviderConnection? {
    model.selectedProviderConnection?.appSlug == "nextdoor" ? model.selectedProviderConnection : nil
  }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    let query = model.nextdoorAgentSearch.trimmingCharacters(in: .whitespacesAndNewlines)
    return model.visibleMarketplaceCompatibleAgents.filter {
      app.runtimeSupport.contains($0.runtimeType)
        && (query.isEmpty || $0.agentName.localizedCaseInsensitiveContains(query)
          || exaRuntimeLabel($0.runtimeType).localizedCaseInsensitiveContains(query))
    }.sorted { $0.agentName.localizedCaseInsensitiveCompare($1.agentName) == .orderedAscending }
  }
  private func install(for agentId: RelayId) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "nextdoor" && exaInstallIsActive($0)
    }
  }
  private var connectedCount: Int {
    guard let selected else { return 0 }
    return targets.filter { install(for: $0.agentId)?.connectionId == selected.id }.count
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      ApplicationsExaHeroCard(app: app)
      ApplicationsExaPanel {
        ViewThatFits(in: .horizontal) {
          HStack(alignment: .top, spacing: 14) {
            agentHeading
            Spacer()
            agentControls
          }
          VStack(alignment: .leading, spacing: 12) {
            agentHeading
            agentControls
          }
        }
        if selected == nil {
          ApplicationsExaInfoPill(
            text:
              "Connect and select one verified Nextdoor neighbor or business profile before enabling agents. Rows and authority controls remain visible."
          )
        }
        ApplicationsAgentGridScroll {
          ForEach(targets) { target in
            ApplicationsNextdoorAgentRow(
              app: app, target: target, install: install(for: target.agentId),
              selectedConnection: selected,
              disabled: !nextdoorConnectionIsReady(selected) || target.status != .compatible)
          }
        }
        HStack {
          Spacer()
          Text("\(connectedCount)").font(.system(size: 13, weight: .bold)).foregroundStyle(
            RCTheme.accentGreen)
          Text("of \(targets.count) agents connected to Nextdoor.").font(
            .system(size: 13, weight: .semibold)
          ).foregroundStyle(RCTheme.muted)
        }
      }
      connectionPanel
      ApplicationsInfoCardsLayout {
        ApplicationsExaInfoCard(
          icon: "person.crop.circle.badge.checkmark", title: "Capabilities",
          items: app.capabilities,
          linkTitle: "Nextdoor Publish API documentation",
          linkURL: app.docsURL.flatMap(URL.init(string:)))
        ApplicationsExaInfoCard(
          icon: "text.bubble", title: "What Agents Can Do",
          items: [
            "Inspect the selected verified neighbor or business profile",
            "Review up to ten own recent posts without pagination",
            "Draft locally and publish one plain-text post through Relay authority",
          ], linkTitle: nil, linkURL: nil)
        ApplicationsExaInfoCard(
          icon: "checklist", title: "Requirements",
          items: [
            "Nextdoor Publish API partner approval and exact Railway callback",
            "openid · profile:read · post:read · post:write",
            "No Display Content, Ads, Share Plugin, agencies, comments, media, geo, bulk, edit/delete, pagination, or raw APIs",
          ], linkTitle: nil, linkURL: nil)
      }
    }
  }

  private var agentHeading: some View {
    ApplicationsExaSectionHeading(
      icon: "person.2", title: "Agents with Nextdoor",
      subtitle: "Assign the selected profile with explicit read and plain-text publish authority.")
  }
  private var agentControls: some View {
    HStack(spacing: 10) {
      Text("Active connection:").font(.system(size: 12, weight: .semibold)).foregroundStyle(
        RCTheme.muted)
      Menu {
        ForEach(connections) { connection in
          Button(connection.accountLabel ?? "Nextdoor profile") {
            model.selectNextdoorConnection(connection.id)
          }.disabled(!nextdoorConnectionIsReady(connection))
        }
      } label: {
        HStack(spacing: 8) {
          Text(selected?.accountLabel ?? "No Nextdoor profile selected").lineLimit(1)
          Image(systemName: "chevron.down").font(.system(size: 10, weight: .bold)).foregroundStyle(
            RCTheme.muted)
        }.font(.system(size: 13, weight: .semibold)).padding(.horizontal, 12)
          .frame(height: 36).background(RCTheme.surfaceInset)
          .clipShape(RoundedRectangle(cornerRadius: 7))
          .overlay(RoundedRectangle(cornerRadius: 7).stroke(RCTheme.borderSoft))
      }.menuStyle(.borderlessButton).disabled(connections.isEmpty)
      ApplicationsExaSearchField(text: $model.nextdoorAgentSearch, placeholder: "Search agents...")
        .frame(width: 250)
    }
  }

  private var connectionPanel: some View {
    ApplicationsExaPanel {
      ApplicationsExaSectionHeading(
        icon: "key", title: "Manage API Connection",
        subtitle: "Relay brokers the partner-approved Nextdoor Publish API through Railway.")
      ApplicationsConnectionFormGrid {
        VStack(alignment: .leading, spacing: 8) {
          Text("EXPECTED PROFILE LABEL (OPTIONAL)").font(.system(size: 10, weight: .bold))
            .foregroundStyle(RCTheme.muted)
          TextField("Neighborhood or business name", text: $model.nextdoorExpectedProfileDraft)
            .textFieldStyle(.roundedBorder)
          Text("Used only as a consent-time check; Railway binds the provider-returned profile ID.")
            .font(.system(size: 10, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
        VStack(alignment: .leading, spacing: 8) {
          Text("REQUESTED ACCESS").font(.system(size: 10, weight: .bold)).foregroundStyle(
            RCTheme.muted)
          Text("openid · profile:read · post:read · post:write")
            .font(.system(size: 12, weight: .semibold))
          Text(
            "Exact Publish API scopes; no superscope, comments, agencies, ads, or display-content access."
          )
          .font(.system(size: 10, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
      }
      Button {
        model.startNextdoorOAuthConnect(for: app)
      } label: {
        Label(
          connections.isEmpty ? "Connect Nextdoor" : "Connect another profile",
          systemImage: "person.badge.key")
      }.buttonStyle(PrimaryLightButtonStyle())
        .disabled(
          model.providerConnectionSnapshot?.readOnly == true
            || model.nextdoorExpectedProfileDraft.count > 120)
      HStack(spacing: 7) {
        Image(systemName: "lock")
        Text(
          "Client secret, authorization code, access token, and refresh token stay in Railway; agents receive only four Relay wrappers."
        )
      }.font(.system(size: 11, weight: .semibold)).foregroundStyle(RCTheme.muted)
      if let status = model.nextdoorConnectionStatus?.nilIfEmpty {
        Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
      }
      VStack(spacing: 0) {
        HStack {
          Text("SELECT").frame(width: 50, alignment: .leading)
          Text("PROFILE").frame(maxWidth: .infinity, alignment: .leading)
          Text("TYPE").frame(width: 90, alignment: .leading)
          Text("STATUS").frame(width: 80, alignment: .leading)
          Text("ACTIONS").frame(width: 100, alignment: .trailing)
        }.font(.system(size: 10, weight: .bold)).foregroundStyle(RCTheme.muted)
          .padding(10).background(RCTheme.surfaceInset)
        if connections.isEmpty {
          EmptyMiniLight(
            title: "No Nextdoor connections",
            body:
              "Partner approval, Railway deployment, and Nextdoor consent are required before assigning agents."
          )
          .padding(.vertical, 10)
        } else {
          ForEach(connections) { connection in
            HStack(spacing: 12) {
              Button {
                model.selectNextdoorConnection(connection.id)
              } label: {
                Image(
                  systemName: selected?.id == connection.id ? "checkmark.circle.fill" : "circle")
              }.buttonStyle(.plain).frame(width: 38).disabled(
                !nextdoorConnectionIsReady(connection))
              VStack(alignment: .leading, spacing: 3) {
                Text(connection.accountLabel ?? "Nextdoor profile").font(
                  .system(size: 13, weight: .bold))
                Text(connection.connectedHandle ?? "Provider-bound profile").font(.system(size: 11))
                  .foregroundStyle(RCTheme.muted).lineLimit(1)
              }.frame(maxWidth: .infinity, alignment: .leading)
              Text(
                connection.health.diagnostics["selectedProfileType"]?.string?.capitalized
                  ?? "Unknown"
              )
              .font(.system(size: 11, weight: .semibold)).frame(width: 90, alignment: .leading)
              Text(nextdoorConnectionIsReady(connection) ? "Ready" : "Blocked")
                .font(.system(size: 11, weight: .bold)).frame(width: 80, alignment: .leading)
              HStack(spacing: 6) {
                Button {
                  model.testNextdoorConnection(connection, for: app)
                } label: {
                  Image(systemName: "arrow.clockwise")
                }.buttonStyle(IconLightButtonStyle()).help("Test Nextdoor connection")
                Button {
                  model.deleteNextdoorConnection(connection, for: app)
                } label: {
                  Image(systemName: "trash")
                }.buttonStyle(IconLightButtonStyle()).help("Delete Nextdoor connection")
              }.frame(width: 100, alignment: .trailing)
            }.padding(10).overlay(alignment: .bottom) { Divider() }
          }
        }
        HStack(spacing: 7) {
          Image(systemName: "lightbulb")
          Text(
            "Only a healthy provider-verified, server-bound neighbor or business profile can be selected."
          )
        }.font(.system(size: 10, weight: .semibold)).foregroundStyle(RCTheme.muted)
          .frame(maxWidth: .infinity, alignment: .leading).padding(10)
      }.overlay(RoundedRectangle(cornerRadius: 8).stroke(RCTheme.borderSoft))
    }
  }
}

struct ApplicationsNextdoorAgentRow: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  let target: MarketplaceCompatibleAgentTarget
  let install: MarketplaceInstallRecord?
  let selectedConnection: MarketplaceProviderConnection?
  let disabled: Bool
  @State private var pending: Bool?
  private var isOn: Bool { install?.connectionId == selectedConnection?.id }
  private var displayName: String {
    model.agents.first { $0.id == target.agentId }.map(model.resolveAgentDisplayName)
      ?? target.agentName
  }
  var body: some View {
    VStack(alignment: .leading, spacing: 9) {
      HStack(spacing: 12) {
        AgentAvatarView(name: displayName, avatarURL: model.agentAvatar(target.agentId), size: 38)
        VStack(alignment: .leading, spacing: 3) {
          Text(displayName).font(.system(size: 13, weight: .semibold))
          Text(
            target.status == .compatible
              ? exaRuntimeLabel(target.runtimeType) : (target.unavailableReason ?? "Unavailable")
          )
          .font(.system(size: 12, weight: .semibold))
          .foregroundStyle(target.status == .compatible ? RCTheme.muted : RCTheme.accentAmber)
        }
        Spacer()
        Button {
          pending = !isOn
        } label: {
          ApplicationsExaSwitch(isOn: isOn)
        }
        .buttonStyle(.plain).disabled(
          disabled || model.busy == "toggle-nextdoor-agent-\(target.agentId)")
      }
      ApplicationsAgentAuthorityRow(
        app: app, install: install,
        selectedPreset: install.flatMap { model.marketplaceActionPolicyPreset(for: $0) }
          ?? .approvalRequired,
        muted: !isOn)
    }.padding(.horizontal, 12).padding(.vertical, 10).frame(minHeight: 86)
      .background(isOn ? RCTheme.sidebarSelected.opacity(0.48) : RCTheme.surfaceInset)
      .clipShape(RoundedRectangle(cornerRadius: 8))
      .overlay(
        RoundedRectangle(cornerRadius: 8).stroke(
          isOn ? RCTheme.accentGreen.opacity(0.22) : RCTheme.borderSoft)
      )
      .opacity(disabled && !isOn ? 0.72 : 1)
      .alert(
        pending == true
          ? "Connect \(displayName) to Nextdoor?" : "Disconnect Nextdoor for \(displayName)?",
        isPresented: Binding(get: { pending != nil }, set: { if !$0 { pending = nil } })
      ) {
        Button("Cancel", role: .cancel) { pending = nil }
        Button(
          pending == true ? "Connect" : "Disconnect", role: pending == true ? nil : .destructive
        ) {
          let enabled = pending ?? !isOn
          pending = nil
          model.setNextdoorAgentConnection(target.agentId, enabled: enabled, for: app)
        }
      } message: {
        Text(
          pending == true
            ? "This grants the selected authority through four bounded Nextdoor Relay wrappers."
            : "This removes the agent's Nextdoor tools and selected-profile access.")
      }
  }
}

func meetupConnectionIsReady(_ connection: MarketplaceProviderConnection?) -> Bool {
  guard let connection else { return false }
  return connection.appSlug == "meetup" && connection.status == .connected
    && connection.health.state == .ready && connection.grantedScopes.isEmpty
    && connection.health.diagnostics["railwayCallbackOnly"]?.bool == true
    && connection.health.diagnostics["stateVerified"]?.bool == true
    && connection.health.diagnostics["memberVerified"]?.bool == true
    && connection.health.diagnostics["fixedQueriesOnly"]?.bool == true
    && connection.health.diagnostics["automaticRetry"]?.bool == false
    && connection.health.diagnostics["automaticPagination"]?.bool == false
    && connection.health.diagnostics["rawToolsEnabled"]?.bool == false
}

struct ApplicationsMeetupDetailPanel: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  private var connections: [MarketplaceProviderConnection] {
    (model.providerConnectionSnapshot?.connections ?? []).filter { $0.appSlug == "meetup" }
  }
  private var selected: MarketplaceProviderConnection? {
    model.selectedProviderConnection?.appSlug == "meetup" ? model.selectedProviderConnection : nil
  }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    let query = model.meetupAgentSearch.trimmingCharacters(in: .whitespacesAndNewlines)
    return model.visibleMarketplaceCompatibleAgents.filter {
      app.runtimeSupport.contains($0.runtimeType)
        && (query.isEmpty || $0.agentName.localizedCaseInsensitiveContains(query))
    }
  }
  private func install(_ agentId: RelayId) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "meetup" && exaInstallIsActive($0)
    }
  }
  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      ApplicationsExaHeroCard(app: app)
      ApplicationsExaPanel {
        HStack {
          ApplicationsExaSectionHeading(
            icon: "person.2", title: "Agents with Meetup",
            subtitle: "Assign read-only access to the connected member and fixed event query.")
          Spacer()
          Menu {
            ForEach(connections) { connection in
              Button(connection.accountLabel ?? "Meetup member") {
                model.selectMeetupConnection(connection.id)
              }.disabled(!meetupConnectionIsReady(connection))
            }
          } label: {
            Text(selected?.accountLabel ?? "No Meetup member selected")
              .font(.system(size: 13, weight: .semibold)).padding(10)
          }.disabled(connections.isEmpty)
          ApplicationsExaSearchField(
            text: $model.meetupAgentSearch, placeholder: "Search agents..."
          )
          .frame(width: 240)
        }
        if selected == nil {
          ApplicationsExaInfoPill(
            text:
              "Connect and select one verified Meetup member before enabling agents. Rows remain visible with Read only and No access authority."
          )
        }
        ApplicationsAgentGridScroll {
          ForEach(targets) { target in
            ApplicationsMeetupAgentRow(
              app: app, target: target, install: install(target.agentId),
              selectedConnection: selected,
              disabled: !meetupConnectionIsReady(selected) || target.status != .compatible)
          }
        }
      }
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "key", title: "Manage API Connection",
          subtitle: "Railway brokers the approved Meetup OAuth consumer and fixed GraphQL queries.")
        ApplicationsConnectionFormGrid {
          VStack(alignment: .leading, spacing: 8) {
            Text("AUTHENTICATION").font(.system(size: 10, weight: .bold)).foregroundStyle(
              RCTheme.muted)
            Text("Meetup OAuth 2.0 server flow").font(.system(size: 13, weight: .semibold))
            Text("No user-selectable OAuth scopes are documented; Relay does not invent scopes.")
              .font(.system(size: 10, weight: .semibold)).foregroundStyle(RCTheme.muted)
          }
          VStack(alignment: .leading, spacing: 8) {
            Text("PROVIDER REQUIREMENTS").font(.system(size: 10, weight: .bold)).foregroundStyle(
              RCTheme.muted)
            Text(
              "Active Meetup Pro OAuth-consumer owner, provider approval, exact Railway callback, privacy policy, and API License compliance."
            )
            .font(.system(size: 11, weight: .semibold))
          }
        }
        Button {
          model.startMeetupOAuthConnect(for: app)
        } label: {
          Label(
            connections.isEmpty ? "Connect Meetup" : "Connect another member",
            systemImage: "person.badge.key")
        }.buttonStyle(PrimaryLightButtonStyle()).disabled(
          model.providerConnectionSnapshot?.readOnly == true)
        HStack(spacing: 7) {
          Image(systemName: "lock")
          Text(
            "Client secret, authorization code, access token, and single-use rotating refresh token stay encrypted in Railway; agents receive two fixed Relay wrappers."
          )
        }.font(.system(size: 11, weight: .semibold)).foregroundStyle(RCTheme.muted)
        if let status = model.meetupConnectionStatus?.nilIfEmpty {
          Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
        VStack(spacing: 0) {
          HStack {
            Text("SELECT").frame(width: 50, alignment: .leading)
            Text("MEMBER").frame(maxWidth: .infinity, alignment: .leading)
            Text("STATUS").frame(width: 90, alignment: .leading)
            Text("ACTIONS").frame(width: 100, alignment: .trailing)
          }.font(.system(size: 10, weight: .bold)).foregroundStyle(RCTheme.muted)
            .padding(10).background(RCTheme.surfaceInset)
          if connections.isEmpty {
            EmptyMiniLight(
              title: "No Meetup connections",
              body:
                "Meetup Pro OAuth approval and Railway deployment are required before agents can be assigned."
            )
            .padding(.vertical, 10)
          } else {
            ForEach(connections) { connection in
              HStack(spacing: 12) {
                Button {
                  model.selectMeetupConnection(connection.id)
                } label: {
                  Image(
                    systemName: selected?.id == connection.id ? "checkmark.circle.fill" : "circle")
                }.buttonStyle(.plain).frame(width: 38).disabled(
                  !meetupConnectionIsReady(connection))
                Text(connection.accountLabel ?? "Meetup member").font(
                  .system(size: 13, weight: .bold)
                )
                .frame(maxWidth: .infinity, alignment: .leading)
                Text(meetupConnectionIsReady(connection) ? "Ready" : "Blocked")
                  .font(.system(size: 11, weight: .bold)).frame(width: 90, alignment: .leading)
                HStack(spacing: 6) {
                  Button {
                    model.testMeetupConnection(connection, for: app)
                  } label: {
                    Image(systemName: "arrow.clockwise")
                  }
                  .buttonStyle(IconLightButtonStyle()).help("Test Meetup connection")
                  Button {
                    model.deleteMeetupConnection(connection, for: app)
                  } label: {
                    Image(systemName: "trash")
                  }
                  .buttonStyle(IconLightButtonStyle()).help("Delete Meetup connection")
                }.frame(width: 100, alignment: .trailing)
              }.padding(10).overlay(alignment: .bottom) { Divider() }
            }
          }
          Text(
            "Only a healthy identity-bound connection with fixed-query-only diagnostics can be selected."
          )
          .font(.system(size: 10, weight: .semibold)).foregroundStyle(RCTheme.muted)
          .frame(maxWidth: .infinity, alignment: .leading).padding(10)
        }.overlay(RoundedRectangle(cornerRadius: 8).stroke(RCTheme.borderSoft))
      }
      ApplicationsInfoCardsLayout {
        ApplicationsExaInfoCard(
          icon: "calendar", title: "Capabilities", items: app.capabilities,
          linkTitle: "Meetup GraphQL documentation", linkURL: app.docsURL.flatMap(URL.init(string:))
        )
        ApplicationsExaInfoCard(
          icon: "sparkles", title: "What Agents Can Do",
          items: [
            "Verify the connected Meetup member", "Review one event by explicit event ID",
            "Return useful title, description, date/time, and canonical link",
          ], linkTitle: nil, linkURL: nil)
        ApplicationsExaInfoCard(
          icon: "checklist", title: "Requirements",
          items: [
            "Meetup Pro OAuth-consumer owner and provider approval",
            "Exact Railway callback and rotating refresh-token handling",
            "No writes, member lists, discovery, pagination, introspection, or raw GraphQL",
          ], linkTitle: nil, linkURL: nil)
      }
    }
  }
}

struct ApplicationsMeetupAgentRow: View {
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
          disabled || model.busy == "toggle-meetup-agent-\(target.agentId)")
      }
      ApplicationsAgentAuthorityRow(
        app: app, install: install,
        selectedPreset: install.flatMap { model.marketplaceActionPolicyPreset(for: $0) }
          ?? .readOnly,
        muted: !isOn)
    }.padding(12).background(isOn ? RCTheme.sidebarSelected.opacity(0.48) : RCTheme.surfaceInset)
      .clipShape(RoundedRectangle(cornerRadius: 8)).opacity(disabled && !isOn ? 0.72 : 1)
      .alert(
        pending == true ? "Connect agent to Meetup?" : "Disconnect Meetup for this agent?",
        isPresented: Binding(get: { pending != nil }, set: { if !$0 { pending = nil } })
      ) {
        Button("Cancel", role: .cancel) { pending = nil }
        Button(
          pending == true ? "Connect" : "Disconnect", role: pending == true ? nil : .destructive
        ) {
          let enabled = pending ?? !isOn
          pending = nil
          model.setMeetupAgentConnection(target.agentId, enabled: enabled, for: app)
        }
      } message: {
        Text("This changes only the agent's two fixed read-only Meetup Relay wrappers.")
      }
  }
}

func eventbriteConnectionIsReady(_ connection: MarketplaceProviderConnection?) -> Bool {
  guard let connection else { return false }
  return connection.appSlug == "eventbrite" && connection.status == .connected
    && connection.health.state == .ready && connection.grantedScopes.isEmpty
    && connection.health.diagnostics["railwayCallbackOnly"]?.bool == true
    && connection.health.diagnostics["stateVerified"]?.bool == true
    && connection.health.diagnostics["userVerified"]?.bool == true
    && connection.health.diagnostics["fixedEndpointsOnly"]?.bool == true
    && connection.health.diagnostics["organizationMembershipRequired"]?.bool == true
    && connection.health.diagnostics["automaticRetry"]?.bool == false
    && connection.health.diagnostics["automaticPagination"]?.bool == false
    && connection.health.diagnostics["rawToolsEnabled"]?.bool == false
}
