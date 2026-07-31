import AppKit
import RelayConsoleCore
import SwiftUI
import UniformTypeIdentifiers

struct ApplicationsTwistDetailPanel: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  @State private var pendingDeleteConnectionId: RelayId?

  private var connections: [MarketplaceProviderConnection] {
    (model.providerConnectionSnapshot?.connections ?? []).filter { $0.appSlug == "twist" }
  }
  private var selected: MarketplaceProviderConnection? {
    model.selectedProviderConnection?.appSlug == "twist" ? model.selectedProviderConnection : nil
  }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    let query = model.twistAgentSearch.trimmingCharacters(in: .whitespacesAndNewlines)
    return model.visibleMarketplaceCompatibleAgents.filter {
      app.runtimeSupport.contains($0.runtimeType)
        && (query.isEmpty || $0.agentName.localizedCaseInsensitiveContains(query))
    }
  }
  private func install(_ agentId: RelayId) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "twist" && exaInstallIsActive($0)
    }
  }
  private var connectedCount: Int {
    guard let selected else { return 0 }
    return targets.filter { install($0.agentId)?.connectionId == selected.id }.count
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      ApplicationsExaHeroCard(app: app)
      ApplicationsExaPanel {
        ViewThatFits(in: .horizontal) {
          HStack(alignment: .top, spacing: 14) {
            twistAgentHeading
            Spacer()
            twistAgentControls
          }
          VStack(alignment: .leading, spacing: 12) {
            twistAgentHeading
            twistAgentControls
          }
        }
        if selected == nil {
          ApplicationsExaInfoPill(
            text:
              "Connect and select one verified Twist user before enabling agents. Rows remain visible with Read only and No access authority."
          )
        }
        ApplicationsAgentGridScroll {
          ForEach(targets) { target in
            ApplicationsTwistAgentRow(
              app: app, target: target, install: install(target.agentId),
              selectedConnection: selected,
              disabled: !twistConnectionIsReady(selected) || target.status != .compatible)
          }
        }
        HStack {
          Spacer()
          Text("\(connectedCount)").font(.system(size: 13, weight: .bold)).foregroundStyle(
            RCTheme.accentGreen)
          Text("of \(targets.count) agents connected to Twist.")
            .font(.system(size: 13, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
      }
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "key", title: "Manage API Connection",
          subtitle:
            "Railway brokers the approved Twist General Integration and five fixed read-only wrappers."
        )
        ApplicationsConnectionFormGrid {
          VStack(alignment: .leading, spacing: 8) {
            Text("AUTHENTICATION").font(.system(size: 10, weight: .bold)).foregroundStyle(
              RCTheme.muted)
            Text("Twist OAuth 2.0 authorization-code flow").font(
              .system(size: 13, weight: .semibold))
            Text("Exact read scopes: user, workspaces, channels, threads, and comments.")
              .font(.system(size: 10, weight: .semibold)).foregroundStyle(RCTheme.muted)
          }
          VStack(alignment: .leading, spacing: 8) {
            Text("PROVIDER REQUIREMENTS").font(.system(size: 10, weight: .bold)).foregroundStyle(
              RCTheme.muted)
            Text(
              "General Integration, exact Railway callback, production client ID/secret, and any required provider review."
            )
            .font(.system(size: 11, weight: .semibold))
          }
        }
        Button {
          model.startTwistOAuthConnect(for: app)
        } label: {
          Label(
            connections.isEmpty ? "Connect Twist" : "Connect another user",
            systemImage: "person.badge.key")
        }.buttonStyle(PrimaryLightButtonStyle())
          .disabled(model.providerConnectionSnapshot?.readOnly == true)
        HStack(spacing: 7) {
          Image(systemName: "lock")
          Text(
            "Client secret, authorization code, and access token stay encrypted in Railway. Agents never receive provider credentials or raw API access."
          )
        }.font(.system(size: 11, weight: .semibold)).foregroundStyle(RCTheme.muted)
        if let status = model.twistConnectionStatus?.nilIfEmpty {
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
              title: "No Twist connections",
              body:
                "A production Twist General Integration, exact Railway callback and backend deployment are required before agents can be assigned."
            )
            .padding(.vertical, 10)
          } else {
            ForEach(connections) { connection in
              HStack(spacing: 12) {
                Button {
                  model.selectTwistConnection(connection.id)
                } label: {
                  Image(
                    systemName: selected?.id == connection.id ? "checkmark.circle.fill" : "circle")
                }.buttonStyle(.plain).frame(width: 38)
                  .disabled(!twistConnectionIsReady(connection))
                Text(connection.accountLabel ?? "Twist user")
                  .font(.system(size: 13, weight: .bold))
                  .frame(maxWidth: .infinity, alignment: .leading)
                Text(twistConnectionIsReady(connection) ? "Ready" : "Blocked")
                  .font(.system(size: 11, weight: .bold))
                  .frame(width: 90, alignment: .leading)
                HStack(spacing: 6) {
                  Button {
                    model.testTwistConnection(connection, for: app)
                  } label: {
                    Image(systemName: "arrow.clockwise")
                  }.buttonStyle(IconLightButtonStyle()).help("Test Twist connection")
                  Button {
                    pendingDeleteConnectionId = connection.id
                  } label: {
                    Image(systemName: "trash")
                  }.buttonStyle(IconLightButtonStyle()).help(
                    "Disconnect and delete Twist connection")
                }.frame(width: 100, alignment: .trailing)
              }.padding(10).overlay(alignment: .bottom) { Divider() }
            }
          }
          Text(
            "Only a healthy exact-scope, user-bound, fixed-endpoint Twist connection can be selected. Remove the integration in Twist for upstream revocation after disconnecting Relay."
          )
          .font(.system(size: 10, weight: .semibold)).foregroundStyle(RCTheme.muted)
          .frame(maxWidth: .infinity, alignment: .leading).padding(10)
        }.overlay(RoundedRectangle(cornerRadius: 8).stroke(RCTheme.borderSoft))
      }
      ApplicationsInfoCardsLayout {
        ApplicationsExaInfoCard(
          icon: "bubble.left.and.bubble.right", title: "Capabilities", items: app.capabilities,
          linkTitle: "Twist API v3 documentation", linkURL: app.docsURL.flatMap(URL.init(string:)))
        ApplicationsExaInfoCard(
          icon: "sparkles", title: "What Agents Can Do",
          items: [
            "Verify the connected Twist user",
            "List bounded workspaces, channels, and recent inbox threads",
            "Read one thread with useful title, content, authors, timestamps, and recent comments",
          ],
          linkTitle: nil, linkURL: nil)
        ApplicationsExaInfoCard(
          icon: "checklist", title: "Requirements",
          items: [
            "Twist General Integration with five exact read scopes",
            "Exact Railway callback and encrypted client secret/access token",
            "No direct messages, search, attachments, writes, webhooks, bulk export, pagination, or raw API",
          ],
          linkTitle: nil, linkURL: nil)
      }
    }
    .alert(
      "Disconnect and delete Twist connection?",
      isPresented: Binding(
        get: { pendingDeleteConnectionId != nil },
        set: { if !$0 { pendingDeleteConnectionId = nil } })
    ) {
      Button("Cancel", role: .cancel) { pendingDeleteConnectionId = nil }
      Button("Disconnect and delete", role: .destructive) {
        guard let id = pendingDeleteConnectionId,
          let connection = connections.first(where: { $0.id == id })
        else {
          pendingDeleteConnectionId = nil
          return
        }
        pendingDeleteConnectionId = nil
        model.deleteTwistConnection(connection, for: app)
      }
    } message: {
      Text(
        "Assigned agents will lose the five Twist read wrappers. Remove the integration in Twist separately to revoke upstream access."
      )
    }
  }

  private var twistAgentHeading: some View {
    ApplicationsExaSectionHeading(
      icon: "person.2", title: "Agents with Twist",
      subtitle: "Assign bounded read-only access to asynchronous workspace threads and comments.")
  }

  private var twistAgentControls: some View {
    HStack(spacing: 10) {
      Text("Active connection:").font(.system(size: 12, weight: .semibold)).foregroundStyle(
        RCTheme.muted)
      Menu {
        ForEach(connections) { connection in
          Button(connection.accountLabel ?? "Twist user") {
            model.selectTwistConnection(connection.id)
          }.disabled(!twistConnectionIsReady(connection))
        }
      } label: {
        HStack(spacing: 8) {
          Text(selected?.accountLabel ?? "No Twist user selected").lineLimit(1)
          Image(systemName: "chevron.down").font(.system(size: 10, weight: .bold)).foregroundStyle(
            RCTheme.muted)
        }.font(.system(size: 13, weight: .semibold)).padding(.horizontal, 12)
          .frame(height: 36).background(RCTheme.surfaceInset)
          .clipShape(RoundedRectangle(cornerRadius: 7))
          .overlay(RoundedRectangle(cornerRadius: 7).stroke(RCTheme.borderSoft))
      }.menuStyle(.borderlessButton).disabled(connections.isEmpty)
      ApplicationsExaSearchField(text: $model.twistAgentSearch, placeholder: "Search agents...")
        .frame(width: 250)
    }
  }
}

struct ApplicationsTwistAgentRow: View {
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
        .buttonStyle(.plain)
        .disabled(disabled || model.busy == "toggle-twist-agent-\(target.agentId)")
      }
      ApplicationsAgentAuthorityRow(
        app: app, install: install,
        selectedPreset: install.flatMap { model.marketplaceActionPolicyPreset(for: $0) }
          ?? .readOnly,
        muted: !isOn)
    }.padding(12)
      .frame(minHeight: 86, alignment: .topLeading)
      .background(isOn ? RCTheme.sidebarSelected.opacity(0.48) : RCTheme.surfaceInset)
      .clipShape(RoundedRectangle(cornerRadius: 8))
      .overlay(
        RoundedRectangle(cornerRadius: 8).stroke(
          isOn ? RCTheme.accentGreen.opacity(0.24) : RCTheme.borderSoft)
      )
      .opacity(disabled && !isOn ? 0.72 : 1)
      .alert(
        pending == true ? "Connect agent to Twist?" : "Disconnect Twist for this agent?",
        isPresented: Binding(get: { pending != nil }, set: { if !$0 { pending = nil } })
      ) {
        Button("Cancel", role: .cancel) { pending = nil }
        Button(
          pending == true ? "Connect" : "Disconnect", role: pending == true ? nil : .destructive
        ) {
          let enabled = pending ?? !isOn
          pending = nil
          model.setTwistAgentConnection(target.agentId, enabled: enabled, for: app)
        }
      } message: {
        Text("This changes only the agent's five fixed read-only Twist Relay wrappers.")
      }
  }
}

let zohoMailRequiredScopes = Set([
  "ZohoMail.accounts.READ", "ZohoMail.folders.READ", "ZohoMail.messages.READ",
])

func zohoMailConnectionIsReady(_ connection: MarketplaceProviderConnection?) -> Bool {
  guard let connection else { return false }
  return connection.appSlug == "zoho-mail" && connection.status == .connected
    && connection.health.state == .ready
    && connection.credentialOwnership == .relayOwned
    && Set(connection.grantedScopes) == zohoMailRequiredScopes
    && connection.health.diagnostics["railwayCallbackOnly"]?.bool == true
    && connection.health.diagnostics["stateVerified"]?.bool == true
    && connection.health.diagnostics["accountVerified"]?.bool == true
    && connection.health.diagnostics["regionalAuthorityBound"]?.bool == true
    && connection.health.diagnostics["fixedEndpointsOnly"]?.bool == true
    && connection.health.diagnostics["readOnlyScopes"]?.bool == true
    && connection.health.diagnostics["writesEnabled"]?.bool == false
    && connection.health.diagnostics["attachmentDownloadsEnabled"]?.bool == false
    && connection.health.diagnostics["automaticPagination"]?.bool == false
    && connection.health.diagnostics["rawToolsEnabled"]?.bool == false
}

struct ApplicationsZohoMailDetailPanel: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  @State private var pendingDeleteConnectionId: RelayId?

  private var connections: [MarketplaceProviderConnection] {
    (model.providerConnectionSnapshot?.connections ?? []).filter { $0.appSlug == "zoho-mail" }
  }
  private var selected: MarketplaceProviderConnection? {
    model.selectedProviderConnection?.appSlug == "zoho-mail"
      ? model.selectedProviderConnection : nil
  }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    let query = model.zohoMailAgentSearch.trimmingCharacters(in: .whitespacesAndNewlines)
    return model.visibleMarketplaceCompatibleAgents.filter {
      app.runtimeSupport.contains($0.runtimeType)
        && (query.isEmpty || $0.agentName.localizedCaseInsensitiveContains(query))
    }
  }
  private func install(_ agentId: RelayId) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "zoho-mail" && exaInstallIsActive($0)
    }
  }
  private var connectedCount: Int {
    guard let selected else { return 0 }
    return targets.filter { install($0.agentId)?.connectionId == selected.id }.count
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
              "Connect and select one verified regional Zoho Mail account before enabling agents. Rows remain visible with Read only and No access authority."
          )
        }
        ApplicationsAgentGridScroll {
          ForEach(targets) { target in
            ApplicationsZohoMailAgentRow(
              app: app, target: target, install: install(target.agentId),
              selectedConnection: selected,
              disabled: !zohoMailConnectionIsReady(selected) || target.status != .compatible)
          }
        }
        HStack {
          Spacer()
          Text("\(connectedCount)").font(.system(size: 13, weight: .bold)).foregroundStyle(
            RCTheme.accentGreen)
          Text("of \(targets.count) agents connected to Zoho Mail.")
            .font(.system(size: 13, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
      }
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "key", title: "Manage API Connection",
          subtitle:
            "Railway brokers Zoho OAuth and four fixed read-only Mail API wrappers in the account's data center."
        )
        ApplicationsConnectionFormGrid {
          VStack(alignment: .leading, spacing: 8) {
            Text("AUTHENTICATION").font(.system(size: 10, weight: .bold)).foregroundStyle(
              RCTheme.muted)
            Text("Zoho OAuth 2.0 server-based application").font(
              .system(size: 13, weight: .semibold))
            Text("Exact scopes: accounts.READ, folders.READ, and messages.READ.")
              .font(.system(size: 10, weight: .semibold)).foregroundStyle(RCTheme.muted)
          }
          VStack(alignment: .leading, spacing: 8) {
            Text("PROVIDER REQUIREMENTS").font(.system(size: 10, weight: .bold)).foregroundStyle(
              RCTheme.muted)
            Text(
              "Exact Railway callback, offline refresh, regional Accounts and Mail hosts, production client credentials, and provider-policy review."
            )
            .font(.system(size: 11, weight: .semibold))
          }
        }
        Button {
          model.startZohoMailOAuthConnect(for: app)
        } label: {
          Label(
            connections.isEmpty ? "Connect Zoho Mail" : "Connect another account",
            systemImage: "person.badge.key")
        }.buttonStyle(PrimaryLightButtonStyle())
          .disabled(
            model.providerConnectionSnapshot?.readOnly == true || app.availability != .available)
        HStack(spacing: 7) {
          Image(systemName: "lock")
          Text(
            "The client secret, authorization code, refresh token, and access token stay encrypted in Railway. Agents receive only four bounded wrappers."
          )
        }.font(.system(size: 11, weight: .semibold)).foregroundStyle(RCTheme.muted)
        if let status = model.zohoMailConnectionStatus?.nilIfEmpty {
          Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
        VStack(spacing: 0) {
          HStack {
            Text("SELECT").frame(width: 50, alignment: .leading)
            Text("ACCOUNT").frame(maxWidth: .infinity, alignment: .leading)
            Text("STATUS").frame(width: 90, alignment: .leading)
            Text("ACTIONS").frame(width: 100, alignment: .trailing)
          }.font(.system(size: 10, weight: .bold)).foregroundStyle(RCTheme.muted)
            .padding(10).background(RCTheme.surfaceInset)
          if connections.isEmpty {
            EmptyMiniLight(
              title: "No Zoho Mail connections",
              body:
                "A production server-based Zoho OAuth client, exact Railway callback, regional configuration, and deployed backend are required before agents can be assigned."
            )
            .padding(.vertical, 10)
          } else {
            ForEach(connections) { connection in
              HStack(spacing: 12) {
                Button {
                  model.selectZohoMailConnection(connection.id)
                } label: {
                  Image(
                    systemName: selected?.id == connection.id ? "checkmark.circle.fill" : "circle")
                }.buttonStyle(.plain).frame(width: 38)
                  .disabled(!zohoMailConnectionIsReady(connection))
                VStack(alignment: .leading, spacing: 2) {
                  Text(connection.accountLabel ?? "Zoho Mail account")
                    .font(.system(size: 13, weight: .bold))
                  if let handle = connection.connectedHandle?.nilIfEmpty {
                    Text(handle).font(.system(size: 10, weight: .semibold)).foregroundStyle(
                      RCTheme.muted)
                  }
                }.frame(maxWidth: .infinity, alignment: .leading)
                Text(zohoMailConnectionIsReady(connection) ? "Ready" : "Blocked")
                  .font(.system(size: 11, weight: .bold))
                  .foregroundStyle(
                    zohoMailConnectionIsReady(connection)
                      ? RCTheme.accentGreen : RCTheme.accentAmber
                  )
                  .frame(width: 90, alignment: .leading)
                HStack(spacing: 6) {
                  Button {
                    model.testZohoMailConnection(connection, for: app)
                  } label: {
                    Image(systemName: "arrow.clockwise")
                  }.buttonStyle(IconLightButtonStyle()).help("Test Zoho Mail connection")
                  Button {
                    pendingDeleteConnectionId = connection.id
                  } label: {
                    Image(systemName: "trash")
                  }.buttonStyle(IconLightButtonStyle()).help(
                    "Revoke and delete Zoho Mail connection")
                }.frame(width: 100, alignment: .trailing)
              }.padding(10).overlay(alignment: .bottom) { Divider() }
            }
          }
          Text(
            "Only a healthy, region-bound connection with exactly the three .READ scopes can be selected. Revocation is sent through Railway when a connection is deleted."
          )
          .font(.system(size: 10, weight: .semibold)).foregroundStyle(RCTheme.muted)
          .frame(maxWidth: .infinity, alignment: .leading).padding(10)
        }.overlay(RoundedRectangle(cornerRadius: 8).stroke(RCTheme.borderSoft))
      }
      ApplicationsInfoCardsLayout {
        ApplicationsExaInfoCard(
          icon: "envelope", title: "Capabilities", items: app.capabilities,
          linkTitle: "Zoho Mail API documentation", linkURL: app.docsURL.flatMap(URL.init(string:)))
        ApplicationsExaInfoCard(
          icon: "sparkles", title: "What Agents Can Do",
          items: [
            "List authenticated mail accounts and their folders",
            "Review one bounded filtered message list",
            "Read one explicit message with sanitized bounded text and attachment metadata",
          ],
          linkTitle: nil, linkURL: nil)
        ApplicationsExaInfoCard(
          icon: "checklist", title: "Requirements",
          items: [
            "Three exact Zoho Mail .READ scopes with offline refresh",
            "Regional Accounts and Mail hosts bound by Railway",
            "No sending, drafts, mutations, attachment downloads, administration, export, pagination, or raw API",
          ],
          linkTitle: nil, linkURL: nil)
      }
    }
    .alert(
      "Revoke and delete Zoho Mail connection?",
      isPresented: Binding(
        get: { pendingDeleteConnectionId != nil },
        set: { if !$0 { pendingDeleteConnectionId = nil } })
    ) {
      Button("Cancel", role: .cancel) { pendingDeleteConnectionId = nil }
      Button("Revoke and delete", role: .destructive) {
        guard let id = pendingDeleteConnectionId,
          let connection = connections.first(where: { $0.id == id })
        else {
          pendingDeleteConnectionId = nil
          return
        }
        pendingDeleteConnectionId = nil
        model.deleteZohoMailConnection(connection, for: app)
      }
    } message: {
      Text(
        "Assigned agents will lose all four read-only Zoho Mail wrappers. Railway will revoke provider access before deleting the local connection reference."
      )
    }
  }

  private var agentHeading: some View {
    ApplicationsExaSectionHeading(
      icon: "person.2", title: "Agents with Zoho Mail",
      subtitle: "Assign bounded read-only account, folder, and message context.")
  }

  private var agentControls: some View {
    HStack(spacing: 10) {
      Text("Active connection:").font(.system(size: 12, weight: .semibold)).foregroundStyle(
        RCTheme.muted)
      Menu {
        ForEach(connections) { connection in
          Button(connection.accountLabel ?? "Zoho Mail account") {
            model.selectZohoMailConnection(connection.id)
          }.disabled(!zohoMailConnectionIsReady(connection))
        }
      } label: {
        HStack(spacing: 8) {
          Text(selected?.accountLabel ?? "No Zoho Mail account selected").lineLimit(1)
          Image(systemName: "chevron.down").font(.system(size: 10, weight: .bold)).foregroundStyle(
            RCTheme.muted)
        }.font(.system(size: 13, weight: .semibold)).padding(.horizontal, 12)
          .frame(height: 36).background(RCTheme.surfaceInset)
          .clipShape(RoundedRectangle(cornerRadius: 7))
          .overlay(RoundedRectangle(cornerRadius: 7).stroke(RCTheme.borderSoft))
      }.menuStyle(.borderlessButton).disabled(connections.isEmpty)
      ApplicationsExaSearchField(text: $model.zohoMailAgentSearch, placeholder: "Search agents...")
        .frame(width: 250)
    }
  }
}

struct ApplicationsZohoMailAgentRow: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  let target: MarketplaceCompatibleAgentTarget
  let install: MarketplaceInstallRecord?
  let selectedConnection: MarketplaceProviderConnection?
  let disabled: Bool
  @State private var pending: Bool?
  private var isOn: Bool { install?.connectionId == selectedConnection?.id }
  private var busy: Bool {
    model.busy == "toggle-zoho-mail-agent-\(target.agentId)"
  }
  private var controlsDisabled: Bool {
    disabled || busy || model.providerConnectionSnapshot?.readOnly == true
      || app.availability != .available
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 9) {
      HStack(spacing: 12) {
        AgentAvatarView(
          name: target.agentName, avatarURL: model.agentAvatar(target.agentId), size: 38)
        VStack(alignment: .leading, spacing: 3) {
          Text(target.agentName).font(.system(size: 13, weight: .semibold))
          Text(
            target.status == .compatible
              ? exaRuntimeLabel(target.runtimeType)
              : (target.unavailableReason ?? "Unavailable")
          )
          .font(.system(size: 12, weight: .semibold))
          .foregroundStyle(target.status == .compatible ? RCTheme.muted : RCTheme.accentAmber)
          .lineLimit(1)
        }
        Spacer()
        if busy {
          ProgressView()
            .controlSize(.small)
            .scaleEffect(0.75)
            .frame(width: 32, height: 20)
        } else {
          Button {
            pending = !isOn
          } label: {
            ApplicationsExaSwitch(isOn: isOn)
          }
          .buttonStyle(.plain)
          .disabled(controlsDisabled)
          .help(
            isOn
              ? "Remove Zoho Mail from \(target.agentName)"
              : "Give \(target.agentName) access to the selected Zoho Mail account"
          )
          .accessibilityLabel(
            "\(isOn ? "Disconnect" : "Connect") \(target.agentName) from Zoho Mail")
        }
      }
      ApplicationsAgentAuthorityRow(
        app: app, install: install,
        selectedPreset: install.flatMap { model.marketplaceActionPolicyPreset(for: $0) }
          ?? .readOnly,
        muted: !isOn)
    }.padding(12)
      .frame(minHeight: 86, alignment: .topLeading)
      .background(isOn ? RCTheme.sidebarSelected.opacity(0.48) : RCTheme.surfaceInset)
      .clipShape(RoundedRectangle(cornerRadius: 8))
      .overlay(
        RoundedRectangle(cornerRadius: 8).stroke(
          isOn ? RCTheme.accentGreen.opacity(0.24) : RCTheme.borderSoft)
      )
      .opacity(disabled && !isOn ? 0.72 : 1)
      .alert(
        pending == true ? "Connect agent to Zoho Mail?" : "Disconnect Zoho Mail for this agent?",
        isPresented: Binding(get: { pending != nil }, set: { if !$0 { pending = nil } })
      ) {
        Button("Cancel", role: .cancel) { pending = nil }
        Button(
          pending == true ? "Connect" : "Disconnect", role: pending == true ? nil : .destructive
        ) {
          let enabled = pending ?? !isOn
          pending = nil
          model.setZohoMailAgentConnection(target.agentId, enabled: enabled, for: app)
        }
      } message: {
        Text("This changes only the agent's four fixed read-only Zoho Mail Relay wrappers.")
      }
  }
}

struct ApplicationsLinkedInDetailPanel: View {
  let app: MarketplaceCatalogApp

  var body: some View {
    VStack(spacing: 14) {
      ApplicationsExaHeroCard(app: app)
      ApplicationsLinkedInAgentsCard(app: app)
      ApplicationsLinkedInConnectionsCard(app: app)
      ApplicationsInfoCardsLayout {
        linkedInInfoCards
      }
    }
  }

  @ViewBuilder
  private var linkedInInfoCards: some View {
    ApplicationsExaInfoCard(
      icon: "sparkles",
      title: "Capabilities",
      items: app.capabilities,
      linkTitle: "Learn more about LinkedIn API",
      linkURL: app.docsURL.flatMap(URL.init(string:))
    )
    .frame(maxWidth: .infinity, alignment: .topLeading)

    ApplicationsExaInfoCard(
      icon: "wand.and.stars",
      title: "What Agents Can Do",
      items: [
        "Read bounded connected-member profile context",
        "Draft text-only member posts locally without publishing",
        "Publish public text posts through approval or Direct writes",
      ],
      linkTitle: nil,
      linkURL: nil
    )
    .frame(maxWidth: .infinity, alignment: .topLeading)

    ApplicationsExaInfoCard(
      icon: "checklist",
      title: "Requirements",
      items: marketplaceConnectionRequirements(for: app),
      linkTitle: nil,
      linkURL: nil
    )
    .frame(maxWidth: .infinity, alignment: .topLeading)
  }
}

struct ApplicationsLinkedInAgentsCard: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp

  private var selectedConnection: MarketplaceProviderConnection? {
    model.selectedProviderConnection
  }

  private var connections: [MarketplaceProviderConnection] {
    model.providerConnectionSnapshot?.connections ?? []
  }

  private var compatibleTargets: [MarketplaceCompatibleAgentTarget] {
    let query = model.linkedinAgentSearch.trimmingCharacters(in: .whitespacesAndNewlines)
      .lowercased()
    return model.visibleMarketplaceCompatibleAgents
      .filter { app.runtimeSupport.contains($0.runtimeType) }
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
    guard let selectedConnection else { return 0 }
    return compatibleTargets.filter {
      activeInstall(for: $0.agentId)?.connectionId == selectedConnection.id
    }.count
  }

  var body: some View {
    ApplicationsExaPanel {
      ViewThatFits(in: .horizontal) {
        HStack(alignment: .top, spacing: 14) {
          ApplicationsExaSectionHeading(
            icon: "person.2", title: "Agents with LinkedIn",
            subtitle:
              "Select which agents should use the active Relay-owned LinkedIn member connection.")
          Spacer()
          agentControls
        }
        VStack(alignment: .leading, spacing: 12) {
          ApplicationsExaSectionHeading(
            icon: "person.2", title: "Agents with LinkedIn",
            subtitle:
              "Select which agents should use the active Relay-owned LinkedIn member connection.")
          agentControls
        }
      }

      if compatibleTargets.isEmpty {
        EmptyMiniLight(
          title: "No available agents",
          body: "LinkedIn can be installed on compatible Hermes and OpenClaw agents.")
      } else {
        if connections.isEmpty {
          ApplicationsExaInfoPill(
            text: "Connect LinkedIn through Railway before turning agents on.")
        }
        ApplicationsAgentGridScroll {
          ForEach(compatibleTargets) { target in
            ApplicationsLinkedInAgentSwitchRow(
              app: app,
              target: target,
              install: activeInstall(for: target.agentId),
              isOn: selectedConnection != nil
                && activeInstall(for: target.agentId)?.connectionId == selectedConnection?.id,
              disabled: selectedConnection == nil || target.status != .compatible
            )
          }
        }
        HStack {
          Spacer()
          Text("\(connectedCount)")
            .font(.system(size: 13, weight: .bold))
            .foregroundStyle(RCTheme.accentGreen)
          Text("of \(compatibleTargets.count) agents connected to LinkedIn.")
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
      Text(selectedConnection.map(linkedinConnectionName) ?? "No member connected")
        .font(.system(size: 13, weight: .semibold))
        .padding(.horizontal, 12)
        .frame(height: 36)
        .background(RCTheme.surfaceInset)
        .clipShape(RoundedRectangle(cornerRadius: 7))
        .overlay(RoundedRectangle(cornerRadius: 7).stroke(RCTheme.borderSoft))
      ApplicationsExaSearchField(text: $model.linkedinAgentSearch, placeholder: "Search agents...")
        .frame(width: 250)
    }
  }

  private func activeInstall(for agentId: RelayId) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "linkedin" && exaInstallIsActive($0)
    }
  }

  private func displayName(for target: MarketplaceCompatibleAgentTarget) -> String {
    model.agents.first { $0.id == target.agentId }.map(model.resolveAgentDisplayName)
      ?? target.agentName
  }
}

struct ApplicationsLinkedInAgentSwitchRow: View {
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
    model.busy == "toggle-linkedin-agent-\(target.agentId)"
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
      return "Connect \(displayName) to LinkedIn?"
    }
    return "Disconnect LinkedIn for \(displayName)?"
  }

  private var confirmationMessage: String {
    if pendingConnectionState == true {
      return
        "This connects the agent to the Relay-owned LinkedIn member connection with Standard authority."
    }
    return "This removes the agent's access to the LinkedIn member connection."
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
              ? "Remove LinkedIn from \(displayName)"
              : "Give \(displayName) access to the LinkedIn member connection"
          )
          .accessibilityLabel("\(isOn ? "Disconnect" : "Connect") \(displayName) from LinkedIn")
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
        model.setLinkedInAgentConnection(target.agentId, enabled: enabled, for: app)
      }
    } message: {
      Text(confirmationMessage)
    }
  }
}
