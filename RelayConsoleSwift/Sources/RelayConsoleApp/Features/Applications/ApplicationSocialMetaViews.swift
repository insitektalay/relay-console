import AppKit
import RelayConsoleCore
import SwiftUI
import UniformTypeIdentifiers

struct ApplicationsFacebookPagesDetailPanel: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp

  private var connections: [MarketplaceProviderConnection] {
    (model.providerConnectionSnapshot?.connections ?? []).filter { $0.appSlug == app.slug }
  }

  private var selected: MarketplaceProviderConnection? {
    guard model.selectedProviderConnection?.appSlug == app.slug else { return nil }
    return model.selectedProviderConnection
  }

  private var targets: [MarketplaceCompatibleAgentTarget] {
    let query = model.facebookPagesAgentSearch
      .trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    return model.visibleMarketplaceCompatibleAgents
      .filter { app.runtimeSupport.contains($0.runtimeType) }
      .filter { target in
        guard !query.isEmpty else { return true }
        return [
          displayName(for: target), exaRuntimeLabel(target.runtimeType),
          target.unavailableReason ?? "",
        ]
        .joined(separator: " ").lowercased().contains(query)
      }
      .sorted {
        displayName(for: $0).localizedCaseInsensitiveCompare(displayName(for: $1))
          == .orderedAscending
      }
  }

  private var connectedCount: Int {
    targets.filter { install(for: $0.agentId)?.connectionId == selected?.id }.count
  }

  private func displayName(for target: MarketplaceCompatibleAgentTarget) -> String {
    model.agents.first { $0.id == target.agentId }.map(model.resolveAgentDisplayName)
      ?? target.agentName
  }

  private func install(for agentId: RelayId) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == app.slug && exaInstallIsActive($0)
    }
  }

  private func connectionIsReady(_ connection: MarketplaceProviderConnection?) -> Bool {
    guard let connection else { return false }
    return connection.status == .connected && connection.health.state == .ready
      && connection.grantedScopes == ProviderConnectionService.facebookPagesRelayOwnedOAuthScopes
      && connection.health.diagnostics["railwayCallbackOnly"]?.bool == true
      && connection.health.diagnostics["selectedPageVerified"]?.bool == true
      && connection.health.diagnostics["pageAuthoredPostsOnly"]?.bool == true
      && connection.health.diagnostics["visitorFeedEnabled"]?.bool == false
      && connection.health.diagnostics["commentsMessagesEnabled"]?.bool == false
      && connection.health.diagnostics["adsInsightsEnabled"]?.bool == false
      && connection.health.diagnostics["mediaEnabled"]?.bool == false
      && connection.health.diagnostics["automaticPagination"]?.bool == false
      && connection.health.diagnostics["rawToolsEnabled"]?.bool == false
  }

  var body: some View {
    VStack(spacing: 14) {
      ApplicationsExaHeroCard(app: app)
      ApplicationsExaPanel {
        ViewThatFits(in: .horizontal) {
          HStack(alignment: .top, spacing: 14) {
            ApplicationsExaSectionHeading(
              icon: "person.2", title: "Agents with Facebook Pages",
              subtitle:
                "Assign the selected Page with Standard, Direct writes, Read only, or No access authority."
            )
            Spacer()
            facebookPagesAgentControls
          }
          VStack(alignment: .leading, spacing: 12) {
            ApplicationsExaSectionHeading(
              icon: "person.2", title: "Agents with Facebook Pages",
              subtitle:
                "Assign the selected Page with Standard, Direct writes, Read only, or No access authority."
            )
            facebookPagesAgentControls
          }
        }
        if selected == nil {
          ApplicationsExaInfoPill(
            text:
              "Connect and select a verified Facebook Page before turning agents on. Controls remain visible while unavailable."
          )
        }
        ApplicationsAgentGridScroll {
          ForEach(targets) { target in
            ApplicationsFacebookPagesAgentRow(
              app: app, target: target, install: install(for: target.agentId),
              selectedConnection: selected,
              disabled: !connectionIsReady(selected) || target.status != .compatible)
          }
        }
        HStack {
          Spacer()
          Text("\(connectedCount)")
            .font(.system(size: 13, weight: .bold)).foregroundStyle(RCTheme.accentGreen)
          Text("of \(targets.count) agents connected to Facebook Pages.")
            .font(.system(size: 13, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
      }
      ApplicationsExaPanel {
        HStack(alignment: .top, spacing: 14) {
          ApplicationsExaSectionHeading(
            icon: "key", title: "Manage API Connections",
            subtitle:
              "Connect, select, reconnect, and remove one-Page Relay-owned Meta OAuth grants.")
          Spacer()
          ApplicationsExaInfoPill(
            text: "3 exact permissions · one selected Page · Railway callback only")
        }
        LazyVGrid(
          columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)],
          spacing: 12
        ) {
          VStack(alignment: .leading, spacing: 8) {
            Text("OAuth owner").font(.system(size: 11, weight: .bold)).foregroundStyle(
              RCTheme.muted)
            Text(
              "Relay owns the Meta app, App Review, callback, token lifecycle, quota, and incident response."
            )
            .font(.system(size: 12, weight: .semibold))
          }
          VStack(alignment: .leading, spacing: 8) {
            Text("Required permissions").font(.system(size: 11, weight: .bold)).foregroundStyle(
              RCTheme.muted)
            Text(
              ProviderConnectionService.facebookPagesRelayOwnedOAuthScopes.joined(separator: " · ")
            )
            .font(.system(size: 12, weight: .semibold))
          }
        }
        Button {
          model.startFacebookPagesOAuthConnect(for: app)
        } label: {
          Label(
            connections.isEmpty ? "Connect Facebook Page" : "Reconnect Facebook Page",
            systemImage: "person.badge.key")
        }
        .buttonStyle(PrimaryLightButtonStyle())
        .disabled(model.providerConnectionSnapshot?.readOnly == true)
        if let status = model.facebookPagesConnectionStatus?.nilIfEmpty {
          Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
        VStack(spacing: 0) {
          HStack {
            Text("SELECT")
            Text("PAGE").frame(maxWidth: .infinity, alignment: .leading)
            Text("STATUS")
            Text("ACTIONS").frame(width: 100, alignment: .trailing)
          }
          .font(.system(size: 10, weight: .bold)).foregroundStyle(RCTheme.muted)
          .padding(10).background(RCTheme.surfaceInset)
          if connections.isEmpty {
            EmptyMiniLight(
              title: "No Facebook Page connections",
              body:
                "Complete the production Railway OAuth flow and select exactly one manageable Page."
            )
            .padding(.vertical, 10)
          } else {
            ForEach(connections) { connection in
              HStack(spacing: 12) {
                Button {
                  model.selectFacebookPagesConnection(connection.id)
                } label: {
                  Image(
                    systemName: selected?.id == connection.id ? "checkmark.circle.fill" : "circle")
                }.buttonStyle(.plain)
                VStack(alignment: .leading, spacing: 3) {
                  Text(connection.accountLabel ?? "Facebook Page").font(
                    .system(size: 13, weight: .bold))
                  Text(connection.connectedHandle ?? "Selected Page").font(.system(size: 11))
                    .foregroundStyle(RCTheme.muted)
                }.frame(maxWidth: .infinity, alignment: .leading)
                Text(connection.health.state == .ready ? "Ready" : "Blocked")
                  .font(.system(size: 11, weight: .bold))
                Button {
                  model.deleteFacebookPagesOAuthConnection(connection, for: app)
                } label: {
                  Image(systemName: "trash")
                }
                .buttonStyle(IconLightButtonStyle()).frame(width: 100, alignment: .trailing)
              }
              .padding(10).overlay(alignment: .bottom) { Divider() }
            }
          }
          Text(
            "Page tokens and the granting user token never appear in this table or agent runtime."
          )
          .font(.system(size: 10, weight: .semibold)).foregroundStyle(RCTheme.muted)
          .frame(maxWidth: .infinity, alignment: .leading).padding(10)
        }
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(RCTheme.borderSoft))
      }
      ApplicationsInfoCardsLayout {
        ApplicationsExaInfoCard(
          icon: "sparkles", title: "Capabilities", items: app.capabilities,
          linkTitle: "Facebook Pages API documentation",
          linkURL: app.docsURL.flatMap(URL.init(string:)))
        ApplicationsExaInfoCard(
          icon: "doc.text", title: "What Agents Can Do",
          items: [
            "Read the bound Page name and safe identity fields",
            "Summarize at most 10 recent Page-authored posts",
            "Draft locally and publish one plain-text post through approval or Direct writes",
          ], linkTitle: nil, linkURL: nil)
        ApplicationsExaInfoCard(
          icon: "checklist", title: "Requirements",
          items: [
            "Exact pages_show_list, pages_read_engagement, and pages_manage_posts permissions",
            "Verified Relay Meta app, App Review, Railway callback, and selected Page task access",
            "No visitor feed, comments, messages, ads, insights, media, webhooks, edit/delete, pagination, or raw Graph tools",
          ], linkTitle: nil, linkURL: nil)
      }
    }
  }

  private var facebookPagesAgentControls: some View {
    HStack(spacing: 10) {
      Text("Active connection:")
        .font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
      Menu {
        ForEach(connections) { connection in
          Button(connection.accountLabel ?? "Facebook Page") {
            model.selectFacebookPagesConnection(connection.id)
          }
          .disabled(!connectionIsReady(connection))
        }
      } label: {
        HStack(spacing: 8) {
          Text(selected?.accountLabel ?? "No Facebook Page selected").lineLimit(1)
          Image(systemName: "chevron.down")
            .font(.system(size: 10, weight: .bold)).foregroundStyle(RCTheme.muted)
        }
        .font(.system(size: 13, weight: .semibold)).padding(.horizontal, 12)
        .frame(height: 36).background(RCTheme.surfaceInset)
        .clipShape(RoundedRectangle(cornerRadius: 7))
        .overlay(RoundedRectangle(cornerRadius: 7).stroke(RCTheme.borderSoft))
      }
      .menuStyle(.borderlessButton).disabled(connections.isEmpty)
      ApplicationsExaSearchField(
        text: $model.facebookPagesAgentSearch, placeholder: "Search agents..."
      )
      .frame(width: 250)
    }
  }
}

struct ApplicationsFacebookPagesAgentRow: View {
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
  private var busy: Bool { model.busy == "toggle-facebook-pages-agent-\(target.agentId)" }

  var body: some View {
    VStack(alignment: .leading, spacing: 9) {
      HStack(spacing: 12) {
        AgentAvatarView(
          name: displayName, avatarURL: model.agentAvatar(target.agentId), size: 38)
        VStack(alignment: .leading, spacing: 3) {
          Text(displayName).font(.system(size: 13, weight: .semibold))
          Text(
            target.status == .compatible
              ? exaRuntimeLabel(target.runtimeType)
              : (target.unavailableReason ?? "Unavailable")
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
          .help(
            isOn
              ? "Remove Facebook Pages from \(displayName)"
              : "Assign the selected Facebook Page to \(displayName)")
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
        ? "Connect \(displayName) to Facebook Pages?"
        : "Disconnect Facebook Pages for \(displayName)?",
      isPresented: Binding(
        get: { pending != nil },
        set: { if !$0 { pending = nil } })
    ) {
      Button("Cancel", role: .cancel) { pending = nil }
      Button(pending == true ? "Connect" : "Disconnect", role: pending == true ? nil : .destructive)
      {
        let enabled = pending ?? !isOn
        pending = nil
        model.setFacebookPagesAgentConnection(target.agentId, enabled: enabled, for: app)
      }
    } message: {
      Text(
        pending == true
          ? "This assigns the active Page with Standard authority. You can then choose Direct writes, Read only, or No access."
          : "This removes the agent's access to the active Facebook Page connection.")
    }
  }
}

struct ApplicationsInstagramBusinessDetailPanel: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp

  private var connections: [MarketplaceProviderConnection] {
    (model.providerConnectionSnapshot?.connections ?? []).filter { $0.appSlug == app.slug }
  }
  private var selected: MarketplaceProviderConnection? {
    guard model.selectedProviderConnection?.appSlug == app.slug else { return nil }
    return model.selectedProviderConnection
  }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    let query = model.instagramBusinessAgentSearch
      .trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    return model.visibleMarketplaceCompatibleAgents
      .filter { app.runtimeSupport.contains($0.runtimeType) }
      .filter {
        query.isEmpty
          || [$0.agentName, exaRuntimeLabel($0.runtimeType), $0.unavailableReason ?? ""]
            .joined(separator: " ").lowercased().contains(query)
      }
      .sorted { $0.agentName.localizedCaseInsensitiveCompare($1.agentName) == .orderedAscending }
  }
  private func install(_ target: MarketplaceCompatibleAgentTarget) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == target.agentId && $0.appSlug == app.slug && exaInstallIsActive($0)
    }
  }
  private var connectedCount: Int {
    targets.filter { install($0)?.connectionId == selected?.id }.count
  }
  private func ready(_ connection: MarketplaceProviderConnection?) -> Bool {
    guard let connection else { return false }
    return connection.status == .connected && connection.health.state == .ready
      && connection.credentialOwnership == .relayOwned
  }

  var body: some View {
    VStack(spacing: 14) {
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
              "Connect and select a verified Instagram professional account before turning agents on. Controls remain visible while unavailable."
          )
        }
        ApplicationsAgentGridScroll {
          ForEach(targets) { target in
            ApplicationsInstagramBusinessAgentRow(
              app: app, target: target, install: install(target),
              selectedConnection: selected,
              disabled: !ready(selected) || target.status != .compatible)
          }
        }
        HStack {
          Spacer()
          Text("\(connectedCount)").font(.system(size: 13, weight: .bold)).foregroundStyle(
            RCTheme.accentGreen)
          Text("of \(targets.count) agents connected to Instagram Business.").font(
            .system(size: 13, weight: .semibold)
          ).foregroundStyle(RCTheme.muted)
        }
      }
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "key", title: "Manage API Connections",
          subtitle:
            "Business Login for Instagram, token exchange/refresh/revocation, and professional-account binding are brokered on Railway."
        )
        LazyVGrid(
          columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)],
          spacing: 12
        ) {
          VStack(alignment: .leading, spacing: 7) {
            Text("OAuth owner").font(.system(size: 11, weight: .bold)).foregroundStyle(
              RCTheme.muted)
            Text(
              "Relay owns the Meta app, exact callback, App Review, token lifecycle, quota, and incident response."
            ).font(.system(size: 12, weight: .semibold))
          }
          VStack(alignment: .leading, spacing: 7) {
            Text("Required permission").font(.system(size: 11, weight: .bold)).foregroundStyle(
              RCTheme.muted)
            Text("instagram_business_basic · professional account only · read only").font(
              .system(size: 12, weight: .semibold))
          }
        }
        Button {
          model.startInstagramBusinessOAuthConnect(for: app)
        } label: {
          Label(
            connections.isEmpty ? "Connect Instagram Business" : "Reconnect Instagram Business",
            systemImage: "person.badge.key")
        }.buttonStyle(PrimaryLightButtonStyle()).disabled(
          model.providerConnectionSnapshot?.readOnly == true)
        if let status = model.instagramBusinessConnectionStatus?.nilIfEmpty {
          Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
        VStack(spacing: 0) {
          HStack {
            Text("SELECT")
            Text("PROFESSIONAL ACCOUNT").frame(maxWidth: .infinity, alignment: .leading)
            Text("STATUS")
            Text("ACTIONS").frame(width: 100, alignment: .trailing)
          }.font(.system(size: 10, weight: .bold)).foregroundStyle(RCTheme.muted).padding(10)
            .background(RCTheme.surfaceInset)
          if connections.isEmpty {
            EmptyMiniLight(
              title: "No Instagram Business connections",
              body:
                "Complete production Business Login for Instagram and bind one professional account."
            ).padding(.vertical, 10)
          } else {
            ForEach(connections) { connection in
              HStack(spacing: 12) {
                Button {
                  model.selectInstagramBusinessConnection(connection.id)
                } label: {
                  Image(
                    systemName: selected?.id == connection.id ? "checkmark.circle.fill" : "circle")
                }.buttonStyle(.plain)
                VStack(alignment: .leading, spacing: 3) {
                  Text(connection.accountLabel ?? "Instagram professional account").font(
                    .system(size: 13, weight: .bold))
                  Text(connection.connectedHandle ?? "Business or Creator").font(.system(size: 11))
                    .foregroundStyle(RCTheme.muted)
                }.frame(maxWidth: .infinity, alignment: .leading)
                Text(ready(connection) ? "Ready" : "Blocked").font(.system(size: 11, weight: .bold))
                Button {
                  model.deleteInstagramBusinessConnection(connection, for: app)
                } label: {
                  Image(systemName: "trash")
                }.buttonStyle(IconLightButtonStyle()).frame(width: 100, alignment: .trailing)
              }.padding(10).overlay(alignment: .bottom) { Divider() }
            }
          }
          Text(
            "Instagram User access tokens never appear in this table, prompts, or agent runtime."
          ).font(.system(size: 10, weight: .semibold)).foregroundStyle(RCTheme.muted).frame(
            maxWidth: .infinity, alignment: .leading
          ).padding(10)
        }.overlay(RoundedRectangle(cornerRadius: 8).stroke(RCTheme.borderSoft))
      }
      ApplicationsInfoCardsLayout {
        ApplicationsExaInfoCard(
          icon: "photo.on.rectangle", title: "Capabilities", items: app.capabilities,
          linkTitle: "Instagram API documentation", linkURL: app.docsURL.flatMap(URL.init(string:)))
        ApplicationsExaInfoCard(
          icon: "doc.text.magnifyingglass", title: "What Agents Can Do",
          items: [
            "Read the bound Business or Creator account identity",
            "Summarize up to ten recent owned media captions, types, timestamps, and permalinks",
            "Inspect one ownership-checked media item without downloading media bytes",
          ], linkTitle: nil, linkURL: nil)
        ApplicationsExaInfoCard(
          icon: "lock.shield", title: "Requirements",
          items: [
            "Exact instagram_business_basic through Business Login for Instagram",
            "Read only or No access authority",
            "No linked Facebook Page requirement; no publishing, people, comments, messages, insights, ads, tagging, discovery, media bytes, pagination, or raw tools",
          ], linkTitle: nil, linkURL: nil)
      }
    }
  }

  private var agentHeading: some View {
    ApplicationsExaSectionHeading(
      icon: "person.2", title: "Agents with Instagram Business",
      subtitle: "Assign Read only or No access authority for the active professional account.")
  }
  private var agentControls: some View {
    HStack(spacing: 10) {
      Text("Active connection:").font(.system(size: 12, weight: .semibold)).foregroundStyle(
        RCTheme.muted)
      Menu {
        ForEach(connections) { connection in
          Button(connection.accountLabel ?? "Instagram account") {
            model.selectInstagramBusinessConnection(connection.id)
          }.disabled(!ready(connection))
        }
      } label: {
        HStack(spacing: 8) {
          Text(selected?.accountLabel ?? "No Instagram account selected").lineLimit(1)
          Image(systemName: "chevron.down").font(.system(size: 10, weight: .bold)).foregroundStyle(
            RCTheme.muted)
        }.font(.system(size: 13, weight: .semibold)).padding(.horizontal, 12).frame(height: 36)
          .background(RCTheme.surfaceInset).clipShape(RoundedRectangle(cornerRadius: 7)).overlay(
            RoundedRectangle(cornerRadius: 7).stroke(RCTheme.borderSoft))
      }.menuStyle(.borderlessButton).disabled(connections.isEmpty)
      ApplicationsExaSearchField(
        text: $model.instagramBusinessAgentSearch, placeholder: "Search agents..."
      ).frame(width: 250)
    }
  }
}

struct ApplicationsInstagramBusinessAgentRow: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  let target: MarketplaceCompatibleAgentTarget
  let install: MarketplaceInstallRecord?
  let selectedConnection: MarketplaceProviderConnection?
  let disabled: Bool
  @State private var pending: Bool?
  private var isOn: Bool { install?.connectionId == selectedConnection?.id }
  private var busy: Bool { model.busy == "toggle-instagram-business-agent-\(target.agentId)" }
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
          ).font(.system(size: 12, weight: .semibold)).foregroundStyle(
            target.status == .compatible ? RCTheme.muted : RCTheme.accentAmber)
        }
        Spacer()
        if busy {
          ProgressView().controlSize(.small).scaleEffect(0.75).frame(width: 32, height: 20)
        } else {
          Button {
            pending = !isOn
          } label: {
            ApplicationsExaSwitch(isOn: isOn)
          }.buttonStyle(.plain).disabled(disabled)
        }
      }
      ApplicationsAgentAuthorityRow(
        app: app, install: install,
        selectedPreset: install.flatMap { model.marketplaceActionPolicyPreset(for: $0) }
          ?? .readOnly, muted: !isOn)
    }
    .padding(.horizontal, 12).padding(.vertical, 10).frame(minHeight: 86)
    .background(isOn ? RCTheme.sidebarSelected.opacity(0.48) : RCTheme.surfaceInset)
    .clipShape(RoundedRectangle(cornerRadius: 8)).overlay(
      RoundedRectangle(cornerRadius: 8).stroke(
        isOn ? RCTheme.accentGreen.opacity(0.22) : RCTheme.borderSoft)
    ).opacity(disabled && !isOn ? 0.72 : 1)
    .alert(
      pending == true
        ? "Connect \(displayName) to Instagram Business?"
        : "Disconnect Instagram Business for \(displayName)?",
      isPresented: Binding(get: { pending != nil }, set: { if !$0 { pending = nil } })
    ) {
      Button("Cancel", role: .cancel) { pending = nil }
      Button(pending == true ? "Connect" : "Disconnect", role: pending == true ? nil : .destructive)
      {
        let enabled = pending ?? !isOn
        pending = nil
        model.setInstagramBusinessAgentConnection(target.agentId, enabled: enabled, for: app)
      }
    } message: {
      Text(
        pending == true
          ? "This grants read-only access to the active professional account through three bounded Relay wrappers."
          : "This removes the agent's Instagram Business tools and account access.")
    }
  }
}

struct ApplicationsPinterestDetailPanel: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  private var connections: [MarketplaceProviderConnection] {
    (model.providerConnectionSnapshot?.connections ?? []).filter { $0.appSlug == app.slug }
  }
  private var selected: MarketplaceProviderConnection? {
    model.selectedProviderConnection?.appSlug == app.slug ? model.selectedProviderConnection : nil
  }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    let query = model.pinterestAgentSearch.trimmingCharacters(in: .whitespacesAndNewlines)
    return model.visibleMarketplaceCompatibleAgents.filter { target in
      app.runtimeSupport.contains(target.runtimeType)
        && (query.isEmpty || target.agentName.localizedCaseInsensitiveContains(query)
          || exaRuntimeLabel(target.runtimeType).localizedCaseInsensitiveContains(query))
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
      && Set(connection.grantedScopes) == Set(["user_accounts:read", "boards:read", "pins:read"])
      && connection.health.diagnostics["userAccountVerified"]?.bool == true
      && connection.health.diagnostics["publicContentOnly"]?.bool == true
      && connection.health.diagnostics["providerDataPersisted"]?.bool == false
      && connection.health.diagnostics["automaticPagination"]?.bool == false
      && connection.health.diagnostics["rawToolsEnabled"]?.bool == false
  }
  private var connectedCount: Int {
    targets.filter { install($0)?.connectionId == selected?.id }.count
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
              "Connect and select a verified Pinterest account before turning agents on. Controls remain visible while unavailable."
          )
        }
        ApplicationsAgentGridScroll {
          ForEach(targets) { target in
            ApplicationsPinterestAgentRow(
              app: app, target: target, install: install(target), selectedConnection: selected,
              disabled: !ready(selected) || target.status != .compatible)
          }
        }
        HStack {
          Spacer()
          Text("\(connectedCount)").font(.system(size: 13, weight: .bold)).foregroundStyle(
            RCTheme.accentGreen)
          Text("of \(targets.count) agents connected to Pinterest.").font(
            .system(size: 13, weight: .semibold)
          ).foregroundStyle(RCTheme.muted)
        }
      }
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "key", title: "Manage API Connections",
          subtitle:
            "Pinterest authorization, token exchange/continuous refresh/revocation, and connected-Pinner binding are brokered on Railway."
        )
        LazyVGrid(
          columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)],
          spacing: 12
        ) {
          VStack(alignment: .leading, spacing: 7) {
            Text("OAuth owner").font(.system(size: 11, weight: .bold)).foregroundStyle(
              RCTheme.muted)
            Text(
              "Relay owns the Pinterest app, exact callback, Standard-access review, token lifecycle, quota, and incident response."
            ).font(.system(size: 12, weight: .semibold))
          }
          VStack(alignment: .leading, spacing: 7) {
            Text("Required permissions").font(.system(size: 11, weight: .bold)).foregroundStyle(
              RCTheme.muted)
            Text("user_accounts:read · boards:read · pins:read · public content only").font(
              .system(size: 12, weight: .semibold))
          }
        }
        Button {
          model.startPinterestOAuthConnect(for: app)
        } label: {
          Label(
            connections.isEmpty ? "Connect Pinterest" : "Reconnect Pinterest",
            systemImage: "person.badge.key")
        }.buttonStyle(PrimaryLightButtonStyle()).disabled(
          model.providerConnectionSnapshot?.readOnly == true)
        if let status = model.pinterestConnectionStatus?.nilIfEmpty {
          Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
        VStack(spacing: 0) {
          HStack {
            Text("SELECT")
            Text("PINTEREST ACCOUNT").frame(maxWidth: .infinity, alignment: .leading)
            Text("STATUS")
            Text("ACTIONS").frame(width: 100, alignment: .trailing)
          }.font(.system(size: 10, weight: .bold)).foregroundStyle(RCTheme.muted).padding(10)
            .background(RCTheme.surfaceInset)
          if connections.isEmpty {
            EmptyMiniLight(
              title: "No Pinterest connections",
              body: "Complete production Pinterest OAuth and bind one authorized Pinner."
            ).padding(.vertical, 10)
          } else {
            ForEach(connections) { connection in
              HStack(spacing: 12) {
                Button {
                  model.selectPinterestConnection(connection.id)
                } label: {
                  Image(
                    systemName: selected?.id == connection.id ? "checkmark.circle.fill" : "circle")
                }.buttonStyle(.plain)
                VStack(alignment: .leading, spacing: 3) {
                  Text(connection.accountLabel ?? "Pinterest account").font(
                    .system(size: 13, weight: .bold))
                  Text(connection.connectedHandle ?? "Authorized Pinner").font(.system(size: 11))
                    .foregroundStyle(RCTheme.muted)
                }.frame(maxWidth: .infinity, alignment: .leading)
                Text(ready(connection) ? "Ready" : "Blocked").font(.system(size: 11, weight: .bold))
                Button {
                  model.deletePinterestConnection(connection, for: app)
                } label: {
                  Image(systemName: "trash")
                }.buttonStyle(IconLightButtonStyle()).frame(width: 100, alignment: .trailing)
              }.padding(10).overlay(alignment: .bottom) { Divider() }
            }
          }
          Text(
            "Pinterest access and refresh tokens—and all API profile, board, and Pin content—never appear in this table, prompts, or persisted execution history."
          ).font(.system(size: 10, weight: .semibold)).foregroundStyle(RCTheme.muted).frame(
            maxWidth: .infinity, alignment: .leading
          ).padding(10)
        }.overlay(RoundedRectangle(cornerRadius: 8).stroke(RCTheme.borderSoft))
      }
      ApplicationsInfoCardsLayout {
        ApplicationsExaInfoCard(
          icon: "rectangle.grid.2x2", title: "Capabilities", items: app.capabilities,
          linkTitle: "Pinterest API documentation", linkURL: app.docsURL.flatMap(URL.init(string:)))
        ApplicationsExaInfoCard(
          icon: "doc.text.magnifyingglass", title: "What Agents Can Do",
          items: [
            "Read the bound Pinner account", "Summarize up to ten public boards",
            "Summarize up to ten public Pins transiently without storing provider content",
          ], linkTitle: nil, linkURL: nil)
        ApplicationsExaInfoCard(
          icon: "lock.shield", title: "Requirements",
          items: [
            "Exact user_accounts:read, boards:read, and pins:read",
            "Read only or No access authority",
            "No secret content, writes, saves, follows, messages, comments, scheduling, ads, analytics, search, paging, downloads, or raw tools",
          ], linkTitle: nil, linkURL: nil)
      }
    }
  }
  private var agentHeading: some View {
    ApplicationsExaSectionHeading(
      icon: "person.2", title: "Agents with Pinterest",
      subtitle: "Assign the active account with Read only or No access authority.")
  }
  private var agentControls: some View {
    HStack(spacing: 10) {
      Text("Active connection:").font(.system(size: 12, weight: .semibold)).foregroundStyle(
        RCTheme.muted)
      Menu {
        ForEach(connections) { connection in
          Button(connection.accountLabel ?? "Pinterest account") {
            model.selectPinterestConnection(connection.id)
          }.disabled(!ready(connection))
        }
      } label: {
        HStack(spacing: 8) {
          Text(selected?.accountLabel ?? "No Pinterest account selected").lineLimit(1)
          Image(systemName: "chevron.down").font(.system(size: 10, weight: .bold)).foregroundStyle(
            RCTheme.muted)
        }.font(.system(size: 13, weight: .semibold)).padding(.horizontal, 12).frame(height: 36)
          .background(RCTheme.surfaceInset).clipShape(RoundedRectangle(cornerRadius: 7)).overlay(
            RoundedRectangle(cornerRadius: 7).stroke(RCTheme.borderSoft))
      }.menuStyle(.borderlessButton).disabled(connections.isEmpty)
      ApplicationsExaSearchField(text: $model.pinterestAgentSearch, placeholder: "Search agents...")
        .frame(width: 250)
    }
  }
}

struct ApplicationsPinterestAgentRow: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  let target: MarketplaceCompatibleAgentTarget
  let install: MarketplaceInstallRecord?
  let selectedConnection: MarketplaceProviderConnection?
  let disabled: Bool
  @State private var pending: Bool?
  private var isOn: Bool { install?.connectionId == selectedConnection?.id }
  private var busy: Bool { model.busy == "toggle-pinterest-agent-\(target.agentId)" }
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
          ).font(.system(size: 12, weight: .semibold)).foregroundStyle(
            target.status == .compatible ? RCTheme.muted : RCTheme.accentAmber)
        }
        Spacer()
        if busy {
          ProgressView().controlSize(.small).scaleEffect(0.75).frame(width: 32, height: 20)
        } else {
          Button {
            pending = !isOn
          } label: {
            ApplicationsExaSwitch(isOn: isOn)
          }.buttonStyle(.plain).disabled(disabled)
        }
      }
      ApplicationsAgentAuthorityRow(
        app: app, install: install,
        selectedPreset: install.flatMap { model.marketplaceActionPolicyPreset(for: $0) }
          ?? .readOnly, muted: !isOn)
    }.padding(.horizontal, 12).padding(.vertical, 10).frame(minHeight: 86)
      .background(isOn ? RCTheme.sidebarSelected.opacity(0.48) : RCTheme.surfaceInset).clipShape(
        RoundedRectangle(cornerRadius: 8)
      ).overlay(
        RoundedRectangle(cornerRadius: 8).stroke(
          isOn ? RCTheme.accentGreen.opacity(0.22) : RCTheme.borderSoft)
      ).opacity(disabled && !isOn ? 0.72 : 1)
      .alert(
        pending == true
          ? "Connect \(displayName) to Pinterest?" : "Disconnect Pinterest for \(displayName)?",
        isPresented: Binding(get: { pending != nil }, set: { if !$0 { pending = nil } })
      ) {
        Button("Cancel", role: .cancel) { pending = nil }
        Button(
          pending == true ? "Connect" : "Disconnect", role: pending == true ? nil : .destructive
        ) {
          let enabled = pending ?? !isOn
          pending = nil
          model.setPinterestAgentConnection(target.agentId, enabled: enabled, for: app)
        }
      } message: {
        Text(
          pending == true
            ? "This grants read-only transient access through four bounded Pinterest Relay wrappers."
            : "This removes the agent's Pinterest tools and account access.")
      }
  }
}

struct ApplicationsTumblrDetailPanel: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp

  private var connections: [MarketplaceProviderConnection] {
    (model.providerConnectionSnapshot?.connections ?? []).filter { $0.appSlug == app.slug }
  }
  private var selected: MarketplaceProviderConnection? {
    model.selectedProviderConnection?.appSlug == app.slug ? model.selectedProviderConnection : nil
  }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    let query = model.tumblrAgentSearch.trimmingCharacters(in: .whitespacesAndNewlines)
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
      && Set(connection.grantedScopes) == Set(["basic", "offline_access"])
      && connection.health.diagnostics["accountVerified"]?.bool == true
      && connection.health.diagnostics["ownedBlogVerified"]?.bool == true
      && connection.health.diagnostics["providerDataPersisted"]?.bool == false
      && connection.health.diagnostics["writesEnabled"]?.bool == false
      && connection.health.diagnostics["automaticPagination"]?.bool == false
      && connection.health.diagnostics["rawToolsEnabled"]?.bool == false
  }
  private var connectedCount: Int {
    targets.filter { install($0)?.connectionId == selected?.id }.count
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
              "Connect Tumblr and select a verified owned blog before turning agents on. Controls remain visible while unavailable."
          )
        }
        ApplicationsAgentGridScroll {
          ForEach(targets) { target in
            ApplicationsTumblrAgentRow(
              app: app, target: target, install: install(target),
              selectedConnection: selected,
              disabled: !ready(selected) || target.status != .compatible)
          }
        }
        HStack {
          Spacer()
          Text("\(connectedCount)").font(.system(size: 13, weight: .bold)).foregroundStyle(
            RCTheme.accentGreen)
          Text("of \(targets.count) agents connected to Tumblr.").font(
            .system(size: 13, weight: .semibold)
          ).foregroundStyle(RCTheme.muted)
        }
      }
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "key", title: "Manage API Connections",
          subtitle:
            "Tumblr authorization, consumer-secret code exchange, rotating refresh, and owned-blog binding are brokered on Railway."
        )
        LazyVGrid(
          columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)],
          spacing: 12
        ) {
          VStack(alignment: .leading, spacing: 7) {
            Text("OAuth owner").font(.system(size: 11, weight: .bold)).foregroundStyle(
              RCTheme.muted)
            Text(
              "Relay owns the registered Tumblr app, exact callback, token lifecycle, quota, policy compliance, and incident response."
            ).font(.system(size: 12, weight: .semibold))
          }
          VStack(alignment: .leading, spacing: 7) {
            Text("Required permissions").font(.system(size: 11, weight: .bold)).foregroundStyle(
              RCTheme.muted)
            Text("basic · offline_access · one selected owned blog · read only").font(
              .system(size: 12, weight: .semibold))
          }
        }
        Button {
          model.startTumblrOAuthConnect(for: app)
        } label: {
          Label(
            connections.isEmpty ? "Connect Tumblr" : "Reconnect Tumblr",
            systemImage: "person.badge.key")
        }
        .buttonStyle(PrimaryLightButtonStyle())
        .disabled(model.providerConnectionSnapshot?.readOnly == true)
        if let status = model.tumblrConnectionStatus?.nilIfEmpty {
          Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
        VStack(spacing: 0) {
          HStack {
            Text("SELECT")
            Text("TUMBLR ACCOUNT / OWNED BLOG").frame(maxWidth: .infinity, alignment: .leading)
            Text("STATUS")
            Text("ACTIONS").frame(width: 100, alignment: .trailing)
          }
          .font(.system(size: 10, weight: .bold)).foregroundStyle(RCTheme.muted)
          .padding(10).background(RCTheme.surfaceInset)
          if connections.isEmpty {
            EmptyMiniLight(
              title: "No Tumblr connections",
              body:
                "Complete production Tumblr OAuth and bind one blog returned for the authorized account."
            )
            .padding(.vertical, 10)
          } else {
            ForEach(connections) { connection in
              HStack(spacing: 12) {
                Button {
                  model.selectTumblrConnection(connection.id)
                } label: {
                  Image(
                    systemName: selected?.id == connection.id ? "checkmark.circle.fill" : "circle")
                }.buttonStyle(.plain)
                VStack(alignment: .leading, spacing: 3) {
                  Text(connection.accountLabel ?? "Tumblr account").font(
                    .system(size: 13, weight: .bold))
                  Text(connection.connectedHandle ?? "Selected owned blog").font(.system(size: 11))
                    .foregroundStyle(RCTheme.muted)
                }.frame(maxWidth: .infinity, alignment: .leading)
                Text(ready(connection) ? "Ready" : "Blocked").font(.system(size: 11, weight: .bold))
                Button {
                  model.deleteTumblrConnection(connection, for: app)
                } label: {
                  Image(systemName: "trash")
                }.buttonStyle(IconLightButtonStyle()).frame(width: 100, alignment: .trailing)
              }.padding(10).overlay(alignment: .bottom) { Divider() }
            }
          }
          Text(
            "Tumblr access/refresh tokens and account, blog, NPF, and post content never appear in this table, prompts, or persisted execution history."
          )
          .font(.system(size: 10, weight: .semibold)).foregroundStyle(RCTheme.muted)
          .frame(maxWidth: .infinity, alignment: .leading).padding(10)
        }.overlay(RoundedRectangle(cornerRadius: 8).stroke(RCTheme.borderSoft))
      }
      ApplicationsInfoCardsLayout {
        ApplicationsExaInfoCard(
          icon: "text.bubble", title: "Capabilities", items: app.capabilities,
          linkTitle: "Tumblr API documentation", linkURL: app.docsURL.flatMap(URL.init(string:)))
        ApplicationsExaInfoCard(
          icon: "doc.text.magnifyingglass", title: "What Agents Can Do",
          items: [
            "Identify the connected account and its owned blogs",
            "Read useful metadata for the selected owned blog",
            "Summarize up to ten recent published posts using NPF or legacy text",
          ], linkTitle: nil, linkURL: nil)
        ApplicationsExaInfoCard(
          icon: "lock.shield", title: "Requirements",
          items: [
            "Exact basic and offline_access scopes through Railway OAuth",
            "Read only or No access authority",
            "No writes, Dashboard clone, private content, engagement, scheduling, paging, media transfer, export, or raw tools",
          ], linkTitle: nil, linkURL: nil)
      }
    }
  }

  private var agentHeading: some View {
    ApplicationsExaSectionHeading(
      icon: "person.2", title: "Agents with Tumblr",
      subtitle: "Assign the selected owned blog with Read only or No access authority.")
  }
  private var agentControls: some View {
    HStack(spacing: 10) {
      Text("Active connection:").font(.system(size: 12, weight: .semibold)).foregroundStyle(
        RCTheme.muted)
      Menu {
        ForEach(connections) { connection in
          Button(connection.accountLabel ?? "Tumblr account") {
            model.selectTumblrConnection(connection.id)
          }.disabled(!ready(connection))
        }
      } label: {
        HStack(spacing: 8) {
          Text(selected?.accountLabel ?? "No Tumblr account selected").lineLimit(1)
          Image(systemName: "chevron.down").font(.system(size: 10, weight: .bold)).foregroundStyle(
            RCTheme.muted)
        }
        .font(.system(size: 13, weight: .semibold)).padding(.horizontal, 12)
        .frame(height: 36).background(RCTheme.surfaceInset)
        .clipShape(RoundedRectangle(cornerRadius: 7))
        .overlay(RoundedRectangle(cornerRadius: 7).stroke(RCTheme.borderSoft))
      }.menuStyle(.borderlessButton).disabled(connections.isEmpty)
      ApplicationsExaSearchField(text: $model.tumblrAgentSearch, placeholder: "Search agents...")
        .frame(width: 250)
    }
  }
}

struct ApplicationsTumblrAgentRow: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  let target: MarketplaceCompatibleAgentTarget
  let install: MarketplaceInstallRecord?
  let selectedConnection: MarketplaceProviderConnection?
  let disabled: Bool
  @State private var pending: Bool?
  private var isOn: Bool { install?.connectionId == selectedConnection?.id }
  private var busy: Bool { model.busy == "toggle-tumblr-agent-\(target.agentId)" }
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
        }
      }
      ApplicationsAgentAuthorityRow(
        app: app, install: install,
        selectedPreset: install.flatMap { model.marketplaceActionPolicyPreset(for: $0) }
          ?? .readOnly,
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
        ? "Connect \(displayName) to Tumblr?" : "Disconnect Tumblr for \(displayName)?",
      isPresented: Binding(get: { pending != nil }, set: { if !$0 { pending = nil } })
    ) {
      Button("Cancel", role: .cancel) { pending = nil }
      Button(pending == true ? "Connect" : "Disconnect", role: pending == true ? nil : .destructive)
      {
        let enabled = pending ?? !isOn
        pending = nil
        model.setTumblrAgentConnection(target.agentId, enabled: enabled, for: app)
      }
    } message: {
      Text(
        pending == true
          ? "This grants read-only transient access through three bounded Tumblr Relay wrappers."
          : "This removes the agent's Tumblr tools and selected-blog access.")
    }
  }
}
