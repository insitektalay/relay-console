import AppKit
import RelayConsoleCore
import SwiftUI
import UniformTypeIdentifiers

struct ApplicationsMastodonDetailPanel: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp

  private var connections: [MarketplaceProviderConnection] {
    (model.providerConnectionSnapshot?.connections ?? []).filter { $0.appSlug == app.slug }
  }
  private var selected: MarketplaceProviderConnection? {
    model.selectedProviderConnection?.appSlug == app.slug ? model.selectedProviderConnection : nil
  }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    let query = model.mastodonAgentSearch.trimmingCharacters(in: .whitespacesAndNewlines)
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
      && Set(connection.grantedScopes) == Set(["read:accounts", "read:statuses", "write:statuses"])
      && connection.health.diagnostics["instanceVerified"]?.bool == true
      && connection.health.diagnostics["accountVerified"]?.bool == true
      && connection.health.diagnostics["serverOriginRestricted"]?.bool == true
      && connection.health.diagnostics["providerDataPersisted"]?.bool == false
      && connection.health.diagnostics["writesTextOnly"]?.bool == true
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
              "Connect and verify one Mastodon server and local account before turning agents on. Controls remain visible while unavailable."
          )
        }
        ApplicationsAgentGridScroll {
          ForEach(targets) { target in
            ApplicationsMastodonAgentRow(
              app: app, target: target, install: install(target),
              selectedConnection: selected,
              disabled: !ready(selected) || target.status != .compatible)
          }
        }
        HStack {
          Spacer()
          Text("\(connectedCount)").font(.system(size: 13, weight: .bold)).foregroundStyle(
            RCTheme.accentGreen)
          Text("of \(targets.count) agents connected to Mastodon.").font(
            .system(size: 13, weight: .semibold)
          ).foregroundStyle(RCTheme.muted)
        }
      }
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "server.rack", title: "Manage API Connections",
          subtitle:
            "Relay verifies one public Mastodon server, dynamically registers a confidential client, and brokers OAuth only on Railway."
        )
        LazyVGrid(
          columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)],
          spacing: 12
        ) {
          VStack(alignment: .leading, spacing: 7) {
            Text("MASTODON SERVER ORIGIN").font(.system(size: 10, weight: .bold)).foregroundStyle(
              RCTheme.muted)
            TextField("https://social.example", text: $model.mastodonInstanceOriginDraft)
              .textFieldStyle(.roundedBorder)
            Text(
              "HTTPS and default port only. Relay rejects private addresses, redirects, rebinding, issuer drift, paths, queries, and credentials."
            )
            .font(.system(size: 10, weight: .semibold)).foregroundStyle(RCTheme.muted)
          }
          VStack(alignment: .leading, spacing: 7) {
            Text("REQUIRED PERMISSIONS").font(.system(size: 10, weight: .bold)).foregroundStyle(
              RCTheme.muted)
            Text("read:accounts · read:statuses · write:statuses")
              .font(.system(size: 12, weight: .semibold))
            Text(
              "Per-instance client secret and user access token stay in separate Relay Keychain references."
            )
            .font(.system(size: 10, weight: .semibold)).foregroundStyle(RCTheme.muted)
          }
        }
        Button {
          model.startMastodonOAuthConnect(for: app)
        } label: {
          Label(
            connections.isEmpty ? "Verify server and connect" : "Connect another server",
            systemImage: "person.badge.key")
        }
        .buttonStyle(PrimaryLightButtonStyle())
        .disabled(model.providerConnectionSnapshot?.readOnly == true)
        if let status = model.mastodonConnectionStatus?.nilIfEmpty {
          Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
        VStack(spacing: 0) {
          HStack {
            Text("SELECT")
            Text("ACCOUNT / SERVER").frame(maxWidth: .infinity, alignment: .leading)
            Text("STATUS")
            Text("ACTIONS").frame(width: 100, alignment: .trailing)
          }
          .font(.system(size: 10, weight: .bold)).foregroundStyle(RCTheme.muted)
          .padding(10).background(RCTheme.surfaceInset)
          if connections.isEmpty {
            EmptyMiniLight(
              title: "No Mastodon connections",
              body:
                "Enter one public Mastodon server. Railway will verify its exact origin before OAuth registration."
            )
            .padding(.vertical, 10)
          } else {
            ForEach(connections) { connection in
              HStack(spacing: 12) {
                Button {
                  model.selectMastodonConnection(connection.id)
                } label: {
                  Image(
                    systemName: selected?.id == connection.id ? "checkmark.circle.fill" : "circle")
                }.buttonStyle(.plain)
                VStack(alignment: .leading, spacing: 3) {
                  Text(connection.accountLabel ?? "Mastodon account").font(
                    .system(size: 13, weight: .bold))
                  Text(connection.connectedHandle ?? "Verified server").font(.system(size: 11))
                    .foregroundStyle(RCTheme.muted)
                }.frame(maxWidth: .infinity, alignment: .leading)
                Text(ready(connection) ? "Ready" : "Blocked").font(.system(size: 11, weight: .bold))
                Button {
                  model.deleteMastodonConnection(connection, for: app)
                } label: {
                  Image(systemName: "trash")
                }.buttonStyle(IconLightButtonStyle()).frame(width: 100, alignment: .trailing)
              }.padding(10).overlay(alignment: .bottom) { Divider() }
            }
          }
          Text(
            "Client secrets, access tokens, profile/status content, server rules, and raw provider errors never appear in this table, prompts, or persisted read history."
          )
          .font(.system(size: 10, weight: .semibold)).foregroundStyle(RCTheme.muted)
          .frame(maxWidth: .infinity, alignment: .leading).padding(10)
        }.overlay(RoundedRectangle(cornerRadius: 8).stroke(RCTheme.borderSoft))
      }
      ApplicationsInfoCardsLayout {
        ApplicationsExaInfoCard(
          icon: "text.bubble", title: "Capabilities", items: app.capabilities,
          linkTitle: "Mastodon API documentation", linkURL: app.docsURL.flatMap(URL.init(string:)))
        ApplicationsExaInfoCard(
          icon: "doc.text.magnifyingglass", title: "What Agents Can Do",
          items: [
            "Identify the account bound to one verified Mastodon server",
            "Review up to ten own non-reply statuses with useful text",
            "Draft locally and intentionally publish one public or unlisted text status",
          ], linkTitle: nil, linkURL: nil)
        ApplicationsExaInfoCard(
          icon: "lock.shield", title: "Requirements",
          items: [
            "Exact granular scopes through the authenticated Railway callback",
            "Standard, Direct writes, Read only, or No access authority",
            "No federation discovery, private/direct content, engagement, media, scheduling, destructive actions, paging, or raw APIs",
          ], linkTitle: nil, linkURL: nil)
      }
    }
  }

  private var agentHeading: some View {
    ApplicationsExaSectionHeading(
      icon: "person.2", title: "Agents with Mastodon",
      subtitle: "Assign the bound account with explicit read and text-publish authority.")
  }
  private var agentControls: some View {
    HStack(spacing: 10) {
      Text("Active connection:").font(.system(size: 12, weight: .semibold)).foregroundStyle(
        RCTheme.muted)
      Menu {
        ForEach(connections) { connection in
          Button(connection.accountLabel ?? "Mastodon account") {
            model.selectMastodonConnection(connection.id)
          }.disabled(!ready(connection))
        }
      } label: {
        HStack(spacing: 8) {
          Text(selected?.accountLabel ?? "No Mastodon account selected").lineLimit(1)
          Image(systemName: "chevron.down").font(.system(size: 10, weight: .bold)).foregroundStyle(
            RCTheme.muted)
        }
        .font(.system(size: 13, weight: .semibold)).padding(.horizontal, 12)
        .frame(height: 36).background(RCTheme.surfaceInset)
        .clipShape(RoundedRectangle(cornerRadius: 7))
        .overlay(RoundedRectangle(cornerRadius: 7).stroke(RCTheme.borderSoft))
      }.menuStyle(.borderlessButton).disabled(connections.isEmpty)
      ApplicationsExaSearchField(text: $model.mastodonAgentSearch, placeholder: "Search agents...")
        .frame(width: 250)
    }
  }
}

struct ApplicationsMastodonAgentRow: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  let target: MarketplaceCompatibleAgentTarget
  let install: MarketplaceInstallRecord?
  let selectedConnection: MarketplaceProviderConnection?
  let disabled: Bool
  @State private var pending: Bool?
  private var isOn: Bool { install?.connectionId == selectedConnection?.id }
  private var busy: Bool { model.busy == "toggle-mastodon-agent-\(target.agentId)" }
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
        ? "Connect \(displayName) to Mastodon?" : "Disconnect Mastodon for \(displayName)?",
      isPresented: Binding(get: { pending != nil }, set: { if !$0 { pending = nil } })
    ) {
      Button("Cancel", role: .cancel) { pending = nil }
      Button(pending == true ? "Connect" : "Disconnect", role: pending == true ? nil : .destructive)
      {
        let enabled = pending ?? !isOn
        pending = nil
        model.setMastodonAgentConnection(target.agentId, enabled: enabled, for: app)
      }
    } message: {
      Text(
        pending == true
          ? "This grants the selected authority through four bounded Mastodon Relay wrappers."
          : "This removes the agent's Mastodon tools and bound-account access.")
    }
  }
}

struct ApplicationsThreadsDetailPanel: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  private var connections: [MarketplaceProviderConnection] {
    (model.providerConnectionSnapshot?.connections ?? []).filter { $0.appSlug == app.slug }
  }
  private var selected: MarketplaceProviderConnection? {
    model.selectedProviderConnection?.appSlug == app.slug ? model.selectedProviderConnection : nil
  }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    let query = model.threadsAgentSearch.trimmingCharacters(in: .whitespacesAndNewlines)
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
      && connection.grantedScopes == ["threads_basic", "threads_content_publish"]
      && connection.health.diagnostics["profileVerified"]?.bool == true
      && connection.health.diagnostics["ownPostsOnly"]?.bool == true
      && connection.health.diagnostics["plainTextPublishOnly"]?.bool == true
      && connection.health.diagnostics["automaticPagination"]?.bool == false
      && connection.health.diagnostics["automaticRetry"]?.bool == false
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
              "Connect and select a verified Threads profile before turning agents on. Controls remain visible while unavailable."
          )
        }
        ApplicationsAgentGridScroll {
          ForEach(targets) { target in
            ApplicationsThreadsAgentRow(
              app: app, target: target, install: install(target), selectedConnection: selected,
              disabled: !ready(selected) || target.status != .compatible)
          }
        }
        HStack {
          Spacer()
          Text("\(connectedCount)").font(.system(size: 13, weight: .bold)).foregroundStyle(
            RCTheme.accentGreen)
          Text("of \(targets.count) agents connected to Threads.").font(
            .system(size: 13, weight: .semibold)
          ).foregroundStyle(RCTheme.muted)
        }
      }
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "key", title: "Manage API Connections",
          subtitle:
            "Threads authorization, long-lived token exchange/refresh/revocation, and app-scoped profile binding are brokered on Railway."
        )
        LazyVGrid(
          columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)],
          spacing: 12
        ) {
          VStack(alignment: .leading, spacing: 7) {
            Text("OAuth owner").font(.system(size: 11, weight: .bold)).foregroundStyle(
              RCTheme.muted)
            Text(
              "Relay owns the Meta app, exact callback, permission review, token lifecycle, quota, and incident response."
            ).font(.system(size: 12, weight: .semibold))
          }
          VStack(alignment: .leading, spacing: 7) {
            Text("Required permissions").font(.system(size: 11, weight: .bold)).foregroundStyle(
              RCTheme.muted)
            Text("threads_basic · threads_content_publish · own profile/posts only").font(
              .system(size: 12, weight: .semibold))
          }
        }
        Button {
          model.startThreadsOAuthConnect(for: app)
        } label: {
          Label(
            connections.isEmpty ? "Connect Threads" : "Reconnect Threads",
            systemImage: "person.badge.key")
        }.buttonStyle(PrimaryLightButtonStyle()).disabled(
          model.providerConnectionSnapshot?.readOnly == true)
        if let status = model.threadsConnectionStatus?.nilIfEmpty {
          Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
        VStack(spacing: 0) {
          HStack {
            Text("SELECT")
            Text("THREADS PROFILE").frame(maxWidth: .infinity, alignment: .leading)
            Text("STATUS")
            Text("ACTIONS").frame(width: 100, alignment: .trailing)
          }.font(.system(size: 10, weight: .bold)).foregroundStyle(RCTheme.muted).padding(10)
            .background(RCTheme.surfaceInset)
          if connections.isEmpty {
            EmptyMiniLight(
              title: "No Threads connections",
              body: "Complete production Threads OAuth and bind one app-scoped profile."
            ).padding(.vertical, 10)
          } else {
            ForEach(connections) { connection in
              HStack(spacing: 12) {
                Button {
                  model.selectThreadsConnection(connection.id)
                } label: {
                  Image(
                    systemName: selected?.id == connection.id ? "checkmark.circle.fill" : "circle")
                }.buttonStyle(.plain)
                VStack(alignment: .leading, spacing: 3) {
                  Text(connection.accountLabel ?? "Threads profile").font(
                    .system(size: 13, weight: .bold))
                  Text(connection.connectedHandle ?? "App-scoped user").font(.system(size: 11))
                    .foregroundStyle(RCTheme.muted)
                }.frame(maxWidth: .infinity, alignment: .leading)
                Text(ready(connection) ? "Ready" : "Blocked").font(.system(size: 11, weight: .bold))
                Button {
                  model.deleteThreadsConnection(connection, for: app)
                } label: {
                  Image(systemName: "trash")
                }.buttonStyle(IconLightButtonStyle()).frame(width: 100, alignment: .trailing)
              }.padding(10).overlay(alignment: .bottom) { Divider() }
            }
          }
          Text("Threads User access tokens never appear in this table, prompts, or agent runtime.")
            .font(.system(size: 10, weight: .semibold)).foregroundStyle(RCTheme.muted).frame(
              maxWidth: .infinity, alignment: .leading
            ).padding(10)
        }.overlay(RoundedRectangle(cornerRadius: 8).stroke(RCTheme.borderSoft))
      }
      ApplicationsInfoCardsLayout {
        ApplicationsExaInfoCard(
          icon: "text.bubble", title: "Capabilities", items: app.capabilities,
          linkTitle: "Threads API documentation", linkURL: app.docsURL.flatMap(URL.init(string:)))
        ApplicationsExaInfoCard(
          icon: "doc.text.magnifyingglass", title: "What Agents Can Do",
          items: [
            "Read the bound app-scoped Threads profile",
            "Summarize up to ten recent own post texts and permalinks",
            "Draft locally and publish one approval-controlled plain-text post",
          ], linkTitle: nil, linkURL: nil)
        ApplicationsExaInfoCard(
          icon: "lock.shield", title: "Requirements",
          items: [
            "Exact threads_basic and threads_content_publish",
            "Standard, Direct writes, Read only, or No access authority",
            "No replies, discovery, insights, media, links, polls, tags, locations, quotes, reposts, deletion, paging, or raw tools",
          ], linkTitle: nil, linkURL: nil)
      }
    }
  }
  private var agentHeading: some View {
    ApplicationsExaSectionHeading(
      icon: "person.2", title: "Agents with Threads",
      subtitle:
        "Assign the active profile with Standard, Direct writes, Read only, or No access authority."
    )
  }
  private var agentControls: some View {
    HStack(spacing: 10) {
      Text("Active connection:").font(.system(size: 12, weight: .semibold)).foregroundStyle(
        RCTheme.muted)
      Menu {
        ForEach(connections) { connection in
          Button(connection.accountLabel ?? "Threads profile") {
            model.selectThreadsConnection(connection.id)
          }.disabled(!ready(connection))
        }
      } label: {
        HStack(spacing: 8) {
          Text(selected?.accountLabel ?? "No Threads profile selected").lineLimit(1)
          Image(systemName: "chevron.down").font(.system(size: 10, weight: .bold)).foregroundStyle(
            RCTheme.muted)
        }.font(.system(size: 13, weight: .semibold)).padding(.horizontal, 12).frame(height: 36)
          .background(RCTheme.surfaceInset).clipShape(RoundedRectangle(cornerRadius: 7)).overlay(
            RoundedRectangle(cornerRadius: 7).stroke(RCTheme.borderSoft))
      }.menuStyle(.borderlessButton).disabled(connections.isEmpty)
      ApplicationsExaSearchField(text: $model.threadsAgentSearch, placeholder: "Search agents...")
        .frame(width: 250)
    }
  }
}

struct ApplicationsThreadsAgentRow: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  let target: MarketplaceCompatibleAgentTarget
  let install: MarketplaceInstallRecord?
  let selectedConnection: MarketplaceProviderConnection?
  let disabled: Bool
  @State private var pending: Bool?
  private var isOn: Bool { install?.connectionId == selectedConnection?.id }
  private var busy: Bool { model.busy == "toggle-threads-agent-\(target.agentId)" }
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
          ?? .approvalRequired, muted: !isOn)
    }.padding(.horizontal, 12).padding(.vertical, 10).frame(minHeight: 86)
      .background(isOn ? RCTheme.sidebarSelected.opacity(0.48) : RCTheme.surfaceInset).clipShape(
        RoundedRectangle(cornerRadius: 8)
      ).overlay(
        RoundedRectangle(cornerRadius: 8).stroke(
          isOn ? RCTheme.accentGreen.opacity(0.22) : RCTheme.borderSoft)
      ).opacity(disabled && !isOn ? 0.72 : 1)
      .alert(
        pending == true
          ? "Connect \(displayName) to Threads?" : "Disconnect Threads for \(displayName)?",
        isPresented: Binding(get: { pending != nil }, set: { if !$0 { pending = nil } })
      ) {
        Button("Cancel", role: .cancel) { pending = nil }
        Button(
          pending == true ? "Connect" : "Disconnect", role: pending == true ? nil : .destructive
        ) {
          let enabled = pending ?? !isOn
          pending = nil
          model.setThreadsAgentConnection(target.agentId, enabled: enabled, for: app)
        }
      } message: {
        Text(
          pending == true
            ? "This grants the selected Threads authority through five bounded Relay wrappers."
            : "This removes the agent's Threads tools and profile access.")
      }
  }
}

struct ApplicationsXDetailPanel: View {
  let app: MarketplaceCatalogApp

  var body: some View {
    VStack(spacing: 14) {
      ApplicationsExaHeroCard(app: app)
      ApplicationsXAgentsCard(app: app)
      ApplicationsXConnectionsCard(app: app)
      ApplicationsInfoCardsLayout {
        ApplicationsExaInfoCard(
          icon: "sparkles",
          title: "Capabilities",
          items: app.capabilities,
          linkTitle: "Learn more about X API",
          linkURL: app.docsURL.flatMap(URL.init(string:))
        )
        ApplicationsExaInfoCard(
          icon: "wand.and.stars",
          title: "What Agents Can Do",
          items: [
            "Read bounded identity for the connected X account",
            "List at most 10 recent original Posts and draft plain text locally",
            "Publish one plain-text Post through approval or deliberately selected Direct writes",
          ],
          linkTitle: nil,
          linkURL: nil
        )
        ApplicationsExaInfoCard(
          icon: "checklist",
          title: "Requirements",
          items: [
            "Relay-owned OAuth 2.0 PKCE with exact tweet.read, users.read, tweet.write, and offline.access scopes",
            "Funded Relay X API credits with a spending limit and no assumed owned-read discount",
            "No replies, engagement, search, URLs, media, destructive actions, loopback callback, raw tools, or automatic pagination",
          ],
          linkTitle: nil,
          linkURL: nil
        )
      }
    }
  }
}

struct ApplicationsXAgentsCard: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp

  private var selectedConnection: MarketplaceProviderConnection? {
    model.selectedProviderConnection
  }

  private var connections: [MarketplaceProviderConnection] {
    model.providerConnectionSnapshot?.connections ?? []
  }

  private var compatibleTargets: [MarketplaceCompatibleAgentTarget] {
    let query = model.xAgentSearch.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    return model.visibleMarketplaceCompatibleAgents
      .filter { app.runtimeSupport.contains($0.runtimeType) }
      .filter { target in
        guard let install = activeInstall(for: target.agentId) else { return true }
        return install.connectionId == selectedConnection?.id
      }
      .filter { target in
        guard !query.isEmpty else { return true }
        return [displayName(for: target), exaRuntimeLabel(target.runtimeType)]
          .joined(separator: " ")
          .lowercased()
          .contains(query)
      }
      .sorted {
        displayName(for: $0).localizedCaseInsensitiveCompare(displayName(for: $1))
          == .orderedAscending
      }
  }

  private var connectedCount: Int {
    compatibleTargets.filter {
      activeInstall(for: $0.agentId)?.connectionId == selectedConnection?.id
    }.count
  }

  var body: some View {
    ApplicationsExaPanel {
      ViewThatFits(in: .horizontal) {
        HStack(alignment: .top, spacing: 14) {
          ApplicationsExaSectionHeading(
            icon: "person.2", title: "Agents with X",
            subtitle: "Select which agents should use the active Relay-owned X OAuth connection.")
          Spacer()
          agentControls
        }
        VStack(alignment: .leading, spacing: 12) {
          ApplicationsExaSectionHeading(
            icon: "person.2", title: "Agents with X",
            subtitle: "Select which agents should use the active Relay-owned X OAuth connection.")
          agentControls
        }
      }

      if connections.isEmpty {
        EmptyMiniLight(
          title: "Connect X",
          body:
            "Complete the Railway OAuth flow and select the verified account before assigning agents."
        )
      } else if compatibleTargets.isEmpty {
        EmptyMiniLight(
          title: "No available agents",
          body:
            "Agents assigned to other X token connections are hidden from this active connection.")
      } else {
        ApplicationsAgentGridScroll {
          ForEach(compatibleTargets) { target in
            ApplicationsXAgentSwitchRow(
              app: app,
              target: target,
              install: activeInstall(for: target.agentId),
              isOn: activeInstall(for: target.agentId)?.connectionId == selectedConnection?.id,
              disabled: !(selectedConnection.map(xConnectionIsValid) ?? false)
                || target.status != .compatible
            )
          }
        }
        HStack {
          Spacer()
          Text("\(connectedCount)")
            .font(.system(size: 13, weight: .bold))
            .foregroundStyle(RCTheme.accentGreen)
          Text("of \(compatibleTargets.count) agents connected to this X account.")
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(RCTheme.muted)
        }
      }
    }
  }

  private var agentControls: some View {
    HStack(spacing: 10) {
      Text("Active connection:")
        .font(.system(size: 12, weight: .semibold))
        .foregroundStyle(RCTheme.muted)
      ApplicationsXConnectionMenu(connections: connections, selectedConnection: selectedConnection)
      ApplicationsExaSearchField(text: $model.xAgentSearch, placeholder: "Search agents...")
        .frame(width: 250)
    }
  }

  private func activeInstall(for agentId: RelayId) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "x" && exaInstallIsActive($0)
    }
  }

  private func displayName(for target: MarketplaceCompatibleAgentTarget) -> String {
    model.agents.first { $0.id == target.agentId }.map(model.resolveAgentDisplayName)
      ?? target.agentName
  }
}

struct ApplicationsXAgentSwitchRow: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp
  let target: MarketplaceCompatibleAgentTarget
  let install: MarketplaceInstallRecord?
  let isOn: Bool
  let disabled: Bool
  @State private var pendingConnectionState: Bool?

  private var displayName: String {
    model.agents.first { $0.id == target.agentId }.map(model.resolveAgentDisplayName)
      ?? target.agentName
  }

  private var busy: Bool {
    model.busy == "toggle-x-agent-\(target.agentId)"
  }

  private var controlsDisabled: Bool {
    disabled || busy || model.providerConnectionSnapshot?.readOnly == true
      || app.availability != .available
  }

  private var confirmationBinding: Binding<Bool> {
    Binding(
      get: { pendingConnectionState != nil },
      set: { newValue in
        if !newValue {
          pendingConnectionState = nil
        }
      }
    )
  }

  private var confirmationTitle: String {
    if pendingConnectionState == true {
      return "Connect \(displayName) to X?"
    }
    return "Disconnect X for \(displayName)?"
  }

  private var confirmationMessage: String {
    if pendingConnectionState == true {
      return "This connects the agent to the active X token connection with Standard authority."
    }
    return "This removes the agent's access to the active X token connection."
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 9) {
      HStack(spacing: 12) {
        AgentAvatarView(name: displayName, avatarURL: model.agentAvatar(target.agentId), size: 38)
        VStack(alignment: .leading, spacing: 3) {
          Text(displayName)
            .font(.system(size: 13, weight: .semibold))
            .lineLimit(1)
          Text(
            target.status == .compatible
              ? exaRuntimeLabel(target.runtimeType) : (target.unavailableReason ?? "Unavailable")
          )
          .font(.system(size: 12, weight: .semibold))
          .foregroundStyle(target.status == .compatible ? RCTheme.muted : RCTheme.accentAmber)
          .lineLimit(1)
        }
        Spacer(minLength: 8)
        if busy {
          ProgressView()
            .controlSize(.small)
            .scaleEffect(0.75)
            .frame(width: 32, height: 20)
        } else {
          Button {
            pendingConnectionState = !isOn
          } label: {
            ApplicationsExaSwitch(isOn: isOn)
          }
          .buttonStyle(.plain)
          .disabled(controlsDisabled)
          .help(
            isOn
              ? "Remove X from \(displayName)"
              : "Give \(displayName) access to the active X token connection"
          )
          .accessibilityLabel("\(isOn ? "Disconnect" : "Connect") \(displayName) from X")
        }
      }
      ApplicationsAgentAuthorityRow(
        app: app,
        install: install,
        selectedPreset: install.flatMap { model.marketplaceActionPolicyPreset(for: $0) }
          ?? .approvalRequired,
        muted: !isOn
      )
    }
    .padding(.horizontal, 12)
    .padding(.vertical, 10)
    .frame(minHeight: 86)
    .background(isOn ? RCTheme.sidebarSelected.opacity(0.48) : RCTheme.surfaceInset)
    .clipShape(RoundedRectangle(cornerRadius: 8))
    .overlay(
      RoundedRectangle(cornerRadius: 8).stroke(
        isOn ? RCTheme.accentGreen.opacity(0.35) : RCTheme.borderSoft)
    )
    .opacity(disabled && !isOn ? 0.72 : 1)
    .alert(confirmationTitle, isPresented: confirmationBinding) {
      Button("Cancel", role: .cancel) {
        pendingConnectionState = nil
      }
      Button(
        pendingConnectionState == true ? "Connect" : "Disconnect",
        role: pendingConnectionState == true ? nil : .destructive
      ) {
        let enabled = pendingConnectionState ?? !isOn
        pendingConnectionState = nil
        model.setXAgentConnection(target.agentId, enabled: enabled, for: app)
      }
    } message: {
      Text(confirmationMessage)
    }
  }
}

struct ApplicationsXConnectionsCard: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp

  private var connections: [MarketplaceProviderConnection] {
    model.providerConnectionSnapshot?.connections ?? []
  }

  private var selectedConnection: MarketplaceProviderConnection? {
    model.selectedProviderConnection
  }

  var body: some View {
    ApplicationsExaPanel {
      HStack(alignment: .top, spacing: 14) {
        ApplicationsExaSectionHeading(
          icon: "key", title: "Manage API Connections",
          subtitle: "Connect, select, reconnect, and remove Relay-owned X OAuth accounts.")
        Spacer()
        ApplicationsExaInfoPill(
          text: "Railway OAuth 2.0 PKCE · exact 4 scopes · Relay-funded credits")
      }

      VStack(alignment: .leading, spacing: 14) {
        addConnectionForm
        connectionTable
      }

      if let status = model.xConnectionStatus?.nilIfEmpty {
        HStack(spacing: 8) {
          Image(
            systemName: status.localizedCaseInsensitiveContains("deleted")
              || status.localizedCaseInsensitiveContains("disconnected")
              ? "info.circle" : "checkmark.circle.fill"
          )
          .foregroundStyle(
            status.localizedCaseInsensitiveContains("connected")
              || status.localizedCaseInsensitiveContains("saved")
              ? RCTheme.accentGreen : RCTheme.accentAmber)
          Text(status)
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(RCTheme.muted)
          Spacer()
        }
      }
    }
  }

  private var addConnectionForm: some View {
    VStack(alignment: .leading, spacing: 12) {
      Text(
        "The authenticated Railway broker owns client credentials, callback/state/PKCE verification, token exchange and refresh, revocation, account binding, credits, and spending limits. No provider secret is entered in the desktop."
      )
      .font(.system(size: 12, weight: .semibold))
      .foregroundStyle(RCTheme.muted)
      .fixedSize(horizontal: false, vertical: true)
      Button {
        model.startXOAuthConnect(for: app)
      } label: {
        if model.busy == "connect-x-oauth" {
          HStack(spacing: 7) {
            ProgressView()
              .controlSize(.small)
              .scaleEffect(0.75)
            Text("Opening X...")
          }
        } else {
          Text(connections.isEmpty ? "Connect X" : "Reconnect X")
        }
      }
      .buttonStyle(PrimaryLightButtonStyle())
      .frame(maxWidth: .infinity)
      .disabled(
        model.busy == "connect-x-oauth" || model.providerConnectionSnapshot?.readOnly == true
          || app.availability != .available)
      HStack(spacing: 7) {
        Image(systemName: "lock")
        Text("Access and refresh tokens are retained only as separate secret references.")
      }
      .font(.system(size: 11, weight: .semibold))
      .foregroundStyle(RCTheme.muted)
    }
    .padding(16)
    .frame(maxWidth: .infinity, alignment: .topLeading)
    .background(RCTheme.surfaceInset)
    .clipShape(RoundedRectangle(cornerRadius: 8))
    .overlay(RoundedRectangle(cornerRadius: 8).stroke(RCTheme.borderSoft))
  }

  private var connectionTable: some View {
    VStack(spacing: 0) {
      ApplicationsXConnectionHeader()
      if connections.isEmpty {
        EmptyMiniLight(
          title: "No X connections", body: "Complete Relay-owned OAuth to bind one X account."
        )
        .padding(.vertical, 22)
        .frame(maxWidth: .infinity)
      } else {
        ForEach(connections) { connection in
          ApplicationsXConnectionRow(
            app: app,
            connection: connection,
            selected: selectedConnection?.id == connection.id
          )
        }
      }
      HStack(spacing: 8) {
        Image(systemName: "lightbulb")
          .foregroundStyle(RCTheme.muted)
        Text("Select a ready exact-scope X account before toggling agents on above.")
          .font(.system(size: 12, weight: .semibold))
          .foregroundStyle(RCTheme.muted)
        Spacer()
      }
      .padding(.horizontal, 14)
      .frame(height: 38)
      .overlay(alignment: .top) {
        Rectangle().fill(RCTheme.borderSoft).frame(height: 1)
      }
    }
    .frame(maxWidth: .infinity, alignment: .topLeading)
    .background(RCTheme.surfaceInset)
    .clipShape(RoundedRectangle(cornerRadius: 8))
    .overlay(RoundedRectangle(cornerRadius: 8).stroke(RCTheme.borderSoft))
  }
}

struct ApplicationsXConnectionHeader: View {
  var body: some View {
    HStack(spacing: 12) {
      Text("")
        .frame(width: 28)
      Text("Connection name")
        .frame(minWidth: 160, maxWidth: .infinity, alignment: .leading)
      Text("Member binding")
        .frame(width: 150, alignment: .leading)
      Text("Status")
        .frame(width: 110, alignment: .leading)
      Text("Last saved")
        .frame(width: 110, alignment: .leading)
      Text("Actions")
        .frame(width: 58, alignment: .center)
    }
    .font(.system(size: 11, weight: .bold))
    .foregroundStyle(RCTheme.muted)
    .padding(.horizontal, 14)
    .frame(height: 36)
    .frame(maxWidth: .infinity)
  }
}
