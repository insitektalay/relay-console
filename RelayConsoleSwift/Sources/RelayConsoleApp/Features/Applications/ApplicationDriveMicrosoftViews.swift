import AppKit
import RelayConsoleCore
import SwiftUI
import UniformTypeIdentifiers

struct ApplicationsGoogleDriveConnectionRow: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp
  let connection: MarketplaceProviderConnection
  let selected: Bool

  private var isDeleting: Bool {
    model.busy == "delete-google-drive-oauth-connection-\(connection.id)"
  }

  var body: some View {
    HStack(spacing: 12) {
      Button {
        model.selectGoogleDriveConnection(connection.id)
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
      .disabled(!googleDriveConnectionIsValid(connection))
      .help("Select \(googleDriveConnectionName(connection))")
      .accessibilityLabel("Select \(googleDriveConnectionName(connection))")

      HStack(spacing: 8) {
        Text(googleDriveConnectionName(connection))
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
      .frame(minWidth: 180, maxWidth: .infinity, alignment: .leading)

      Text(googleDriveAccountPreview(connection))
        .font(.system(size: 13, weight: .semibold))
        .foregroundStyle(RCTheme.muted)
        .lineLimit(1)
        .frame(width: 175, alignment: .leading)

      Text("\(connection.grantedScopes.count) granted")
        .font(.system(size: 12, weight: .semibold))
        .foregroundStyle(RCTheme.muted)
        .frame(width: 130, alignment: .leading)

      HStack(spacing: 7) {
        Image(
          systemName: googleDriveConnectionIsValid(connection)
            ? "checkmark.circle.fill" : "exclamationmark.triangle.fill"
        )
        .foregroundStyle(
          googleDriveConnectionIsValid(connection) ? RCTheme.accentGreen : RCTheme.accentAmber)
        Text(googleDriveConnectionStatusText(connection))
          .font(.system(size: 12, weight: .semibold))
      }
      .frame(width: 110, alignment: .leading)

      Button {
        model.deleteGoogleDriveOAuthConnection(connection, for: app)
      } label: {
        Image(systemName: "trash")
      }
      .buttonStyle(IconLightButtonStyle())
      .disabled(isDeleting || model.providerConnectionSnapshot?.readOnly == true)
      .help("Delete \(googleDriveConnectionName(connection))")
      .accessibilityLabel("Delete \(googleDriveConnectionName(connection))")
      .frame(width: 58, alignment: .center)
    }
    .padding(.horizontal, 14)
    .frame(height: 46)
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

struct ApplicationsGoogleAnalyticsDetailPanel: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  private var connections: [MarketplaceProviderConnection] {
    (model.providerConnectionSnapshot?.connections ?? []).filter {
      $0.appSlug == "google-analytics"
    }
  }
  private var selected: MarketplaceProviderConnection? { model.selectedProviderConnection }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    model.visibleMarketplaceCompatibleAgents.filter { app.runtimeSupport.contains($0.runtimeType) }
  }
  private func install(_ target: MarketplaceCompatibleAgentTarget) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == target.agentId && $0.appSlug == "google-analytics" && exaInstallIsActive($0)
    }
  }
  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      ApplicationsExaHeroCard(app: app)
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "chart.xyaxis.line", title: "Google Analytics connection",
          subtitle:
            "OAuth, offline refresh, revocation, and explicit GA4 property binding are brokered on Railway. The desktop never receives Relay's client secret, runs a loopback callback, or exchanges authorization codes."
        )
        Text(
          "Read-only V1 is bound to one explicit GA4 property and exposes only safe property metadata plus one fixed 30-day, 25-row aggregate channel overview."
        ).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        Button {
          model.startGoogleAnalyticsOAuthConnect(for: app)
        } label: {
          if model.busy == "connect-google-analytics-oauth" {
            ProgressView().controlSize(.small)
          } else {
            Text(connections.isEmpty ? "Connect Google Analytics" : "Reconnect Google Analytics")
          }
        }.buttonStyle(PrimaryLightButtonStyle()).disabled(
          model.providerConnectionSnapshot?.readOnly == true || app.availability != .available)
        if let status = model.googleAnalyticsConnectionStatus {
          Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
        if connections.isEmpty {
          EmptyMiniLight(
            title: "No verified Google Analytics connection",
            body:
              "Complete the Relay-owned OAuth and explicit-property selection flow on Railway before assigning agents."
          )
        } else {
          ForEach(connections) { connection in
            HStack(spacing: 10) {
              Button {
                model.selectGoogleAnalyticsConnection(connection.id)
              } label: {
                Image(
                  systemName: selected?.id == connection.id ? "checkmark.circle.fill" : "circle")
              }.buttonStyle(.plain)
              VStack(alignment: .leading, spacing: 2) {
                Text(connection.accountLabel ?? "GA4 property").font(
                  .system(size: 13, weight: .bold))
                Text("Exact analytics.readonly scope · explicit property · fixed reports only")
                  .font(.system(size: 11, weight: .semibold)).foregroundStyle(RCTheme.muted)
              }
              Spacer()
              Button {
                model.deleteGoogleAnalyticsOAuthConnection(connection, for: app)
              } label: {
                Image(systemName: "trash")
              }.buttonStyle(IconLightButtonStyle())
            }.padding(12).background(RCTheme.surfaceInset).clipShape(
              RoundedRectangle(cornerRadius: 8))
          }
        }
      }
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "person.2", title: "Agents with Google Analytics",
          subtitle:
            "Assignments are read-only. Available authority modes are Read only and No access.")
        if selected == nil {
          ApplicationsExaInfoPill(
            text: "Connect and select a verified explicit GA4 property before turning agents on.")
        }
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 245), spacing: 12)], spacing: 12) {
          ForEach(targets) { target in
            let active = install(target)
            HStack {
              VStack(alignment: .leading) {
                Text(target.agentName).font(.system(size: 13, weight: .bold))
                Text(exaRuntimeLabel(target.runtimeType)).font(.system(size: 11, weight: .semibold))
                  .foregroundStyle(RCTheme.muted)
              }
              Spacer()
              Button {
                model.setGoogleAnalyticsAgentConnection(
                  target.agentId, enabled: active == nil, for: app)
              } label: {
                ApplicationsExaSwitch(isOn: active != nil)
              }.buttonStyle(.plain).disabled(
                selected == nil || target.status != .compatible
                  || model.providerConnectionSnapshot?.readOnly == true)
            }.padding(12).background(
              active == nil ? RCTheme.surfaceInset : RCTheme.sidebarSelected.opacity(0.48)
            ).clipShape(RoundedRectangle(cornerRadius: 8))
          }
        }
      }
      LazyVGrid(columns: [GridItem(.adaptive(minimum: 285), spacing: 14)], spacing: 14) {
        ApplicationsExaInfoCard(
          icon: "chart.xyaxis.line", title: "Capabilities", items: app.capabilities,
          linkTitle: "Google Analytics API documentation",
          linkURL: app.docsURL.flatMap(URL.init(string:)))
        ApplicationsExaInfoCard(
          icon: "doc.text.magnifyingglass", title: "What Agents Can Do",
          items: [
            "Read safe metadata for one explicit GA4 property",
            "Run one fixed aggregate overview for 30daysAgo through yesterday",
            "Compare up to 25 channel groups across active users, sessions, engagement, events, key events, and revenue",
          ], linkTitle: nil, linkURL: nil)
        ApplicationsExaInfoCard(
          icon: "lock.shield", title: "Requirements",
          items: [
            "Railway-brokered exact analytics.readonly OAuth and explicit property binding",
            "Read only or No access; no Direct writes or mutation approval path",
            "No discovery, arbitrary/realtime/advanced reports, audience/user detail, admin writes, exports, raw tools, or pagination",
          ], linkTitle: nil, linkURL: nil)
      }
    }
  }
}
struct ApplicationsGoogleMerchantCenterDetailPanel: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  private var connections: [MarketplaceProviderConnection] {
    (model.providerConnectionSnapshot?.connections ?? []).filter { $0.appSlug == app.slug }
  }
  private var selected: MarketplaceProviderConnection? { model.selectedProviderConnection }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    model.visibleMarketplaceCompatibleAgents.filter { app.runtimeSupport.contains($0.runtimeType) }
  }
  private func install(_ target: MarketplaceCompatibleAgentTarget) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == target.agentId && $0.appSlug == app.slug && exaInstallIsActive($0)
    }
  }
  private func ready(_ connection: MarketplaceProviderConnection?) -> Bool {
    guard let connection else { return false }
    return connection.status == .connected && connection.health.state == .ready
      && connection.credentialOwnership == .relayOwned
      && connection.grantedScopes
        == ProviderConnectionService.googleMerchantCenterRelayOwnedOAuthScopes
      && connection.health.diagnostics["selectedAccountName"]?.string?.hasPrefix("accounts/")
        == true
      && connection.health.diagnostics["readOnlyV1"]?.bool == true
      && connection.health.diagnostics["writesEnabled"]?.bool == false
      && connection.health.diagnostics["fixedReportsOnly"]?.bool == true
      && connection.health.diagnostics["automaticPagination"]?.bool == false
      && connection.health.diagnostics["serviceAccountEnabled"]?.bool == false
      && connection.health.diagnostics["v1BetaEnabled"]?.bool == false
      && connection.health.diagnostics["contentAPIEnabled"]?.bool == false
      && connection.health.diagnostics["rawToolsEnabled"]?.bool == false
  }
  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      ApplicationsExaHeroCard(app: app)
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "person.2", title: "Agents with Google Merchant Center",
          subtitle:
            "Assignments expose Read only and No access for one explicit Merchant Center account.")
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 245), spacing: 12)], spacing: 12) {
          ForEach(targets) { target in
            ApplicationsGoogleMerchantCenterAgentRow(
              app: app, target: target, install: install(target),
              disabled: !ready(selected) || target.status != .compatible)
          }
        }
      }
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "key", title: "Google Merchant Center connection",
          subtitle:
            "OAuth, offline refresh, revocation, developer registration, and explicit account binding are brokered on Railway. The desktop never receives Relay's client secret or service-account keys."
        )
        ApplicationsExaInfoPill(
          text: "Exact content scope · provider scope can write · Relay V1 remains Read only")
        Button {
          model.startGoogleMerchantCenterOAuthConnect(for: app)
        } label: {
          Text(
            connections.isEmpty
              ? "Connect Google Merchant Center" : "Reconnect Google Merchant Center")
        }.buttonStyle(PrimaryLightButtonStyle()).disabled(
          model.providerConnectionSnapshot?.readOnly == true || app.availability != .available)
        if let status = model.googleMerchantCenterConnectionStatus {
          Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
        if connections.isEmpty {
          EmptyMiniLight(
            title: "No verified Merchant Center connection",
            body:
              "Complete Relay-owned OAuth, developer registration, and explicit account selection on Railway before assigning agents."
          )
        } else {
          ForEach(connections) { connection in
            HStack {
              Button {
                model.selectGoogleMerchantCenterConnection(connection.id)
              } label: {
                Image(
                  systemName: selected?.id == connection.id ? "checkmark.circle.fill" : "circle")
              }.buttonStyle(.plain)
              VStack(alignment: .leading) {
                Text(connection.accountLabel ?? "Merchant Center account").font(
                  .system(size: 13, weight: .bold))
                Text(
                  connection.health.diagnostics["selectedAccountName"]?.string
                    ?? "Account binding missing"
                ).font(.system(size: 11, weight: .semibold)).foregroundStyle(RCTheme.muted)
              }
              Spacer()
              Text(ready(connection) ? "Ready" : "Blocked").foregroundStyle(
                ready(connection) ? RCTheme.accentGreen : RCTheme.accentAmber)
              Button {
                model.deleteGoogleMerchantCenterOAuthConnection(connection, for: app)
              } label: {
                Image(systemName: "trash")
              }.buttonStyle(IconLightButtonStyle())
            }.padding(12).background(RCTheme.surfaceInset).clipShape(
              RoundedRectangle(cornerRadius: 8))
          }
        }
      }
      LazyVGrid(columns: [GridItem(.adaptive(minimum: 285), spacing: 14)], spacing: 14) {
        ApplicationsExaInfoCard(
          icon: "shippingbox", title: "Capabilities", items: app.capabilities,
          linkTitle: "Merchant API documentation", linkURL: app.docsURL.flatMap(URL.init(string:)))
        ApplicationsExaInfoCard(
          icon: "doc.text.magnifyingglass", title: "What Agents Can Do",
          items: [
            "List the first 50 accessible accounts",
            "Inspect up to 50 processed products for one selected account",
            "Review fixed, actionable destination and item-level issues",
          ], linkTitle: nil, linkURL: nil)
        ApplicationsExaInfoCard(
          icon: "lock.shield", title: "Requirements",
          items: [
            "Railway-brokered exact content OAuth, Google verification, developer registration, and explicit account binding",
            "Read only or No access; no Direct writes despite the provider scope",
            "No mutation, arbitrary query, page tokens, automatic pagination, service account, raw tools, v1beta, or Content API",
          ], linkTitle: nil, linkURL: nil)
      }
    }
  }
}

struct ApplicationsGoogleMerchantCenterAgentRow: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  let target: MarketplaceCompatibleAgentTarget
  let install: MarketplaceInstallRecord?
  let disabled: Bool
  @State private var pending = false
  var body: some View {
    HStack {
      VStack(alignment: .leading) {
        Text(target.agentName).font(.system(size: 13, weight: .bold))
        Text(exaRuntimeLabel(target.runtimeType)).font(.system(size: 11, weight: .semibold))
          .foregroundStyle(RCTheme.muted)
      }
      Spacer()
      Button {
        pending = true
      } label: {
        ApplicationsExaSwitch(isOn: install != nil)
      }.buttonStyle(.plain).disabled(disabled || model.providerConnectionSnapshot?.readOnly == true)
    }.padding(12).background(
      install == nil ? RCTheme.surfaceInset : RCTheme.sidebarSelected.opacity(0.48)
    ).clipShape(RoundedRectangle(cornerRadius: 8)).alert(
      install == nil
        ? "Connect agent to Google Merchant Center?" : "Remove Google Merchant Center access?",
      isPresented: $pending
    ) {
      Button("Cancel", role: .cancel) {}
      Button(install == nil ? "Connect" : "Remove", role: install == nil ? nil : .destructive) {
        model.setGoogleMerchantCenterAgentConnection(
          target.agentId, enabled: install == nil, for: app)
      }
    } message: {
      Text(
        install == nil
          ? "This grants read-only access to the selected Merchant Center account through four bounded Relay wrappers."
          : "This removes the agent's Merchant Center runtime tools and account access.")
    }
  }
}

struct ApplicationsYouTubeDetailPanel: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  private var connections: [MarketplaceProviderConnection] {
    (model.providerConnectionSnapshot?.connections ?? []).filter { $0.appSlug == app.slug }
  }
  private var selected: MarketplaceProviderConnection? { model.selectedProviderConnection }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    model.visibleMarketplaceCompatibleAgents.filter { app.runtimeSupport.contains($0.runtimeType) }
  }
  private func install(_ target: MarketplaceCompatibleAgentTarget) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == target.agentId && $0.appSlug == app.slug && exaInstallIsActive($0)
    }
  }
  private func ready(_ connection: MarketplaceProviderConnection?) -> Bool {
    guard let connection else { return false }
    return connection.status == .connected && connection.health.state == .ready
      && connection.credentialOwnership == .relayOwned
      && connection.grantedScopes == ProviderConnectionService.youTubeRelayOwnedOAuthScopes
      && connection.health.diagnostics["channelId"]?.string?.isEmpty == false
      && connection.health.diagnostics["readOnlyV1"]?.bool == true
      && connection.health.diagnostics["writesEnabled"]?.bool == false
      && connection.health.diagnostics["searchEnabled"]?.bool == false
      && connection.health.diagnostics["historyEnabled"]?.bool == false
      && connection.health.diagnostics["automaticPagination"]?.bool == false
      && connection.health.diagnostics["analyticsEnabled"]?.bool == false
      && connection.health.diagnostics["partnerEnabled"]?.bool == false
      && connection.health.diagnostics["serviceAccountEnabled"]?.bool == false
      && connection.health.diagnostics["rawToolsEnabled"]?.bool == false
      && connection.health.diagnostics["maxResults"]?.number == 25
  }
  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      ApplicationsExaHeroCard(app: app)
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "person.2", title: "Agents with YouTube",
          subtitle: "Assignments expose Read only and No access for the connected creator channel.")
        if selected == nil {
          ApplicationsExaInfoPill(
            text: "Connect and select a verified YouTube channel before turning agents on.")
        }
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 245), spacing: 12)], spacing: 12) {
          ForEach(targets) { target in
            ApplicationsYouTubeAgentRow(
              app: app, target: target, install: install(target),
              disabled: !ready(selected) || target.status != .compatible)
          }
        }
      }
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "key", title: "YouTube connection",
          subtitle:
            "OAuth, offline refresh, revocation, and connected-channel binding are brokered on Railway. The desktop never receives Relay's Google client secret."
        )
        ApplicationsExaInfoPill(
          text: "Exact youtube.readonly scope · connected channel · four bounded wrappers")
        Button {
          model.startYouTubeOAuthConnect(for: app)
        } label: {
          Text(connections.isEmpty ? "Connect YouTube" : "Reconnect YouTube")
        }.buttonStyle(PrimaryLightButtonStyle()).disabled(
          model.providerConnectionSnapshot?.readOnly == true || app.availability != .available)
        if let status = model.youTubeConnectionStatus {
          Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
        if connections.isEmpty {
          EmptyMiniLight(
            title: "No verified YouTube connection",
            body:
              "Complete Relay-owned OAuth, Google verification, and connected-channel binding on Railway before assigning agents."
          )
        } else {
          ForEach(connections) { connection in
            HStack {
              Button {
                model.selectYouTubeConnection(connection.id)
              } label: {
                Image(
                  systemName: selected?.id == connection.id ? "checkmark.circle.fill" : "circle")
              }.buttonStyle(.plain)
              VStack(alignment: .leading) {
                Text(connection.accountLabel ?? "YouTube channel").font(
                  .system(size: 13, weight: .bold))
                Text(
                  connection.health.diagnostics["channelId"]?.string ?? "Channel binding missing"
                ).font(.system(size: 11, weight: .semibold)).foregroundStyle(RCTheme.muted)
              }
              Spacer()
              Text(ready(connection) ? "Ready" : "Blocked").foregroundStyle(
                ready(connection) ? RCTheme.accentGreen : RCTheme.accentAmber)
              Button {
                model.deleteYouTubeOAuthConnection(connection, for: app)
              } label: {
                Image(systemName: "trash")
              }.buttonStyle(IconLightButtonStyle())
            }.padding(12).background(RCTheme.surfaceInset).clipShape(
              RoundedRectangle(cornerRadius: 8))
          }
        }
      }
      LazyVGrid(columns: [GridItem(.adaptive(minimum: 285), spacing: 14)], spacing: 14) {
        ApplicationsExaInfoCard(
          icon: "play.rectangle", title: "Capabilities", items: app.capabilities,
          linkTitle: "YouTube Data API documentation",
          linkURL: app.docsURL.flatMap(URL.init(string:)))
        ApplicationsExaInfoCard(
          icon: "doc.text.magnifyingglass", title: "What Agents Can Do",
          items: [
            "Summarize the connected channel and identify its uploads playlist",
            "List up to 25 owned playlists or explicit playlist items",
            "Compare up to 25 explicit videos by metadata, duration, visibility, captions, and returned statistics",
          ], linkTitle: nil, linkURL: nil)
        ApplicationsExaInfoCard(
          icon: "lock.shield", title: "Requirements",
          items: [
            "Railway-brokered exact youtube.readonly OAuth, Google verification, and connected-channel binding",
            "Read only or No access; no Standard or Direct writes",
            "YouTube attribution; no search, history, export, automatic pagination, mutations, analytics, partner, service-account, or raw access",
          ], linkTitle: nil, linkURL: nil)
      }
    }
  }
}

struct ApplicationsYouTubeAgentRow: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  let target: MarketplaceCompatibleAgentTarget
  let install: MarketplaceInstallRecord?
  let disabled: Bool
  @State private var pending = false
  var body: some View {
    HStack {
      VStack(alignment: .leading) {
        Text(target.agentName).font(.system(size: 13, weight: .bold))
        Text(exaRuntimeLabel(target.runtimeType)).font(.system(size: 11, weight: .semibold))
          .foregroundStyle(RCTheme.muted)
      }
      Spacer()
      Button {
        pending = true
      } label: {
        ApplicationsExaSwitch(isOn: install != nil)
      }.buttonStyle(.plain).disabled(disabled || model.providerConnectionSnapshot?.readOnly == true)
    }.padding(12).background(
      install == nil ? RCTheme.surfaceInset : RCTheme.sidebarSelected.opacity(0.48)
    ).clipShape(RoundedRectangle(cornerRadius: 8)).alert(
      install == nil ? "Connect agent to YouTube?" : "Remove YouTube access?", isPresented: $pending
    ) {
      Button("Cancel", role: .cancel) {}
      Button(install == nil ? "Connect" : "Remove", role: install == nil ? nil : .destructive) {
        model.setYouTubeAgentConnection(target.agentId, enabled: install == nil, for: app)
      }
    } message: {
      Text(
        install == nil
          ? "This grants read-only access to the connected YouTube channel through four bounded Relay wrappers."
          : "This removes the agent's YouTube runtime tools and channel access.")
    }
  }
}

struct ApplicationsGoogleClassroomDetailPanel: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  private var connections: [MarketplaceProviderConnection] {
    (model.providerConnectionSnapshot?.connections ?? []).filter { $0.appSlug == app.slug }
  }
  private var selected: MarketplaceProviderConnection? { model.selectedProviderConnection }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    model.visibleMarketplaceCompatibleAgents.filter { app.runtimeSupport.contains($0.runtimeType) }
  }
  private func install(_ target: MarketplaceCompatibleAgentTarget) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == target.agentId && $0.appSlug == app.slug && exaInstallIsActive($0)
    }
  }
  private func ready(_ c: MarketplaceProviderConnection?) -> Bool {
    guard let c else { return false }
    return c.status == .connected && c.health.state == .ready
      && c.credentialOwnership == .relayOwned
      && c.grantedScopes == ProviderConnectionService.googleClassroomRelayOwnedOAuthScopes
      && c.health.diagnostics["requestingUserOnly"]?.bool == true
      && c.health.diagnostics["readOnlyV1"]?.bool == true
      && c.health.diagnostics["rostersEnabled"]?.bool == false
      && c.health.diagnostics["studentSubmissionsGradesEnabled"]?.bool == false
      && c.health.diagnostics["writesEnabled"]?.bool == false
      && c.health.diagnostics["domainDelegationEnabled"]?.bool == false
      && c.health.diagnostics["automaticPagination"]?.bool == false
      && c.health.diagnostics["rawToolsEnabled"]?.bool == false
  }
  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      ApplicationsExaHeroCard(app: app)
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "person.2", title: "Agents with Google Classroom",
          subtitle: "Assignments expose Read only and No access for the connected requesting user.")
        if selected == nil {
          ApplicationsExaInfoPill(
            text: "Connect and select a verified Classroom account before turning agents on.")
        }
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 245), spacing: 12)], spacing: 12) {
          ForEach(targets) { target in
            ApplicationsGoogleClassroomAgentRow(
              app: app, target: target, install: install(target),
              disabled: !ready(selected) || target.status != .compatible)
          }
        }
      }
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "key", title: "Google Classroom connection",
          subtitle:
            "OAuth, offline refresh, revocation, and requesting-user binding are brokered on Railway. No domain-wide delegation or desktop client secret is used."
        )
        ApplicationsExaInfoPill(
          text: "Exact three read-only scopes · requesting user only · no student work or grades")
        Button {
          model.startGoogleClassroomOAuthConnect(for: app)
        } label: {
          Text(connections.isEmpty ? "Connect Google Classroom" : "Reconnect Google Classroom")
        }.buttonStyle(PrimaryLightButtonStyle()).disabled(
          model.providerConnectionSnapshot?.readOnly == true || app.availability != .available)
        if let status = model.googleClassroomConnectionStatus {
          Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
        if connections.isEmpty {
          EmptyMiniLight(
            title: "No verified Classroom connection",
            body:
              "Complete Relay-owned OAuth, Google verification, and any required Workspace for Education administrator approval on Railway before assigning agents."
          )
        } else {
          ForEach(connections) { connection in
            HStack {
              Button {
                model.selectGoogleClassroomConnection(connection.id)
              } label: {
                Image(
                  systemName: selected?.id == connection.id ? "checkmark.circle.fill" : "circle")
              }.buttonStyle(.plain)
              VStack(alignment: .leading) {
                Text(connection.accountLabel ?? "Classroom account").font(
                  .system(size: 13, weight: .bold))
                Text(connection.connectedHandle ?? "Requesting user").font(
                  .system(size: 11, weight: .semibold)
                ).foregroundStyle(RCTheme.muted)
              }
              Spacer()
              Text(ready(connection) ? "Ready" : "Blocked").foregroundStyle(
                ready(connection) ? RCTheme.accentGreen : RCTheme.accentAmber)
              Button {
                model.deleteGoogleClassroomOAuthConnection(connection, for: app)
              } label: {
                Image(systemName: "trash")
              }.buttonStyle(IconLightButtonStyle())
            }.padding(12).background(RCTheme.surfaceInset).clipShape(
              RoundedRectangle(cornerRadius: 8))
          }
        }
      }
      LazyVGrid(columns: [GridItem(.adaptive(minimum: 285), spacing: 14)], spacing: 14) {
        ApplicationsExaInfoCard(
          icon: "graduationcap", title: "Capabilities", items: app.capabilities,
          linkTitle: "Google Classroom API documentation",
          linkURL: app.docsURL.flatMap(URL.init(string:)))
        ApplicationsExaInfoCard(
          icon: "doc.text.magnifyingglass", title: "What Agents Can Do",
          items: [
            "List and summarize up to 25 courses permitted to the connected user",
            "Review up to 25 recent coursework items with due dates",
            "Read up to 25 published material posts with safe link metadata",
          ], linkTitle: nil, linkURL: nil)
        ApplicationsExaInfoCard(
          icon: "lock.shield", title: "Requirements",
          items: [
            "Exact courses.readonly, coursework.me.readonly, and courseworkmaterials.readonly OAuth",
            "Workspace administrator approval is required for under-18 users",
            "No rosters, profiles, submissions, grades, guardians, writes, delegation, previews, pagination, exports, or raw tools",
          ], linkTitle: nil, linkURL: nil)
      }
    }
  }
}

struct ApplicationsGoogleClassroomAgentRow: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  let target: MarketplaceCompatibleAgentTarget
  let install: MarketplaceInstallRecord?
  let disabled: Bool
  @State private var pending = false
  var body: some View {
    HStack {
      VStack(alignment: .leading) {
        Text(target.agentName).font(.system(size: 13, weight: .bold))
        Text(exaRuntimeLabel(target.runtimeType)).font(.system(size: 11, weight: .semibold))
          .foregroundStyle(RCTheme.muted)
      }
      Spacer()
      Button {
        pending = true
      } label: {
        ApplicationsExaSwitch(isOn: install != nil)
      }.buttonStyle(.plain).disabled(disabled || model.providerConnectionSnapshot?.readOnly == true)
    }.padding(12).background(
      install == nil ? RCTheme.surfaceInset : RCTheme.sidebarSelected.opacity(0.48)
    ).clipShape(RoundedRectangle(cornerRadius: 8)).alert(
      install == nil ? "Connect agent to Google Classroom?" : "Remove Google Classroom access?",
      isPresented: $pending
    ) {
      Button("Cancel", role: .cancel) {}
      Button(install == nil ? "Connect" : "Remove", role: install == nil ? nil : .destructive) {
        model.setGoogleClassroomAgentConnection(target.agentId, enabled: install == nil, for: app)
      }
    } message: {
      Text(
        install == nil
          ? "This grants requesting-user read-only access through four privacy-bounded Relay wrappers."
          : "This removes the agent's Classroom runtime tools and course access.")
    }
  }
}

struct ApplicationsOutlookDetailPanel: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  private var connections: [MarketplaceProviderConnection] {
    (model.providerConnectionSnapshot?.connections ?? []).filter { $0.appSlug == app.slug }
  }
  private var selected: MarketplaceProviderConnection? { model.selectedProviderConnection }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    model.visibleMarketplaceCompatibleAgents.filter { app.runtimeSupport.contains($0.runtimeType) }
  }
  private func install(_ t: MarketplaceCompatibleAgentTarget) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == t.agentId && $0.appSlug == app.slug && exaInstallIsActive($0)
    }
  }
  private func ready(_ c: MarketplaceProviderConnection?) -> Bool {
    guard let c else { return false }
    return c.status == .connected && c.health.state == .ready
      && c.credentialOwnership == .relayOwned
      && c.grantedScopes == ProviderConnectionService.outlookRelayOwnedOAuthScopes
      && c.health.diagnostics["delegatedOnly"]?.bool == true
      && c.health.diagnostics["selfMailboxOnly"]?.bool == true
      && c.health.diagnostics["sharedMailEnabled"]?.bool == false
      && c.health.diagnostics["applicationPermissionsEnabled"]?.bool == false
      && c.health.diagnostics["attachmentsEnabled"]?.bool == false
      && c.health.diagnostics["searchEnabled"]?.bool == false
      && c.health.diagnostics["writesEnabled"]?.bool == false
      && c.health.diagnostics["automaticPagination"]?.bool == false
      && c.health.diagnostics["rawToolsEnabled"]?.bool == false
  }
  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      ApplicationsExaHeroCard(app: app)
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "person.2", title: "Agents with Outlook",
          subtitle: "Assignments expose Read only and No access for the signed-in user's mailbox.")
        if selected == nil {
          ApplicationsExaInfoPill(
            text: "Connect and select a verified Outlook mailbox before turning agents on.")
        }
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 245), spacing: 12)], spacing: 12) {
          ForEach(targets) { target in
            ApplicationsOutlookAgentRow(
              app: app, target: target, install: install(target),
              disabled: !ready(selected) || target.status != .compatible)
          }
        }
      }
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "key", title: "Outlook connection",
          subtitle:
            "Delegated auth-code OAuth with PKCE, offline refresh, and revocation is brokered on Railway. The desktop never receives Relay's Entra app secret."
        )
        ApplicationsExaInfoPill(
          text: "Exact delegated Mail.Read · signed-in mailbox only · no sends or attachments")
        Button {
          model.startOutlookOAuthConnect(for: app)
        } label: {
          Text(connections.isEmpty ? "Connect Outlook" : "Reconnect Outlook")
        }.buttonStyle(PrimaryLightButtonStyle()).disabled(
          model.providerConnectionSnapshot?.readOnly == true || app.availability != .available)
        if let status = model.outlookConnectionStatus {
          Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
        if connections.isEmpty {
          EmptyMiniLight(
            title: "No verified Outlook connection",
            body:
              "Complete Relay-owned Microsoft OAuth and any tenant consent policy on Railway before assigning agents."
          )
        } else {
          ForEach(connections) { c in
            HStack {
              Button {
                model.selectOutlookConnection(c.id)
              } label: {
                Image(systemName: selected?.id == c.id ? "checkmark.circle.fill" : "circle")
              }.buttonStyle(.plain)
              VStack(alignment: .leading) {
                Text(c.accountLabel ?? "Outlook mailbox").font(.system(size: 13, weight: .bold))
                Text(c.connectedHandle ?? "Signed-in user").font(
                  .system(size: 11, weight: .semibold)
                ).foregroundStyle(RCTheme.muted)
              }
              Spacer()
              Text(ready(c) ? "Ready" : "Blocked").foregroundStyle(
                ready(c) ? RCTheme.accentGreen : RCTheme.accentAmber)
              Button {
                model.deleteOutlookOAuthConnection(c, for: app)
              } label: {
                Image(systemName: "trash")
              }.buttonStyle(IconLightButtonStyle())
            }.padding(12).background(RCTheme.surfaceInset).clipShape(
              RoundedRectangle(cornerRadius: 8))
          }
        }
      }
      LazyVGrid(columns: [GridItem(.adaptive(minimum: 285), spacing: 14)], spacing: 14) {
        ApplicationsExaInfoCard(
          icon: "envelope", title: "Capabilities", items: app.capabilities,
          linkTitle: "Microsoft Graph mail documentation",
          linkURL: app.docsURL.flatMap(URL.init(string:)))
        ApplicationsExaInfoCard(
          icon: "doc.text.magnifyingglass", title: "What Agents Can Do",
          items: [
            "List root mail folders and unread counts",
            "Triage up to 25 recent or unread Inbox messages",
            "Read one explicit message as at most 8,000 plain-text characters",
          ], linkTitle: nil, linkURL: nil)
        ApplicationsExaInfoCard(
          icon: "lock.shield", title: "Requirements",
          items: [
            "Delegated Mail.Read with openid/profile/offline_access through Railway",
            "Read only or No access; no Standard or Direct writes",
            "No shared/application mail, attachments/MIME, search/export/pagination, sending/mutations, calendar, contacts, files, Teams, or directory",
          ], linkTitle: nil, linkURL: nil)
      }
    }
  }
}
struct ApplicationsOutlookAgentRow: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  let target: MarketplaceCompatibleAgentTarget
  let install: MarketplaceInstallRecord?
  let disabled: Bool
  @State private var pending = false
  var body: some View {
    HStack {
      VStack(alignment: .leading) {
        Text(target.agentName).font(.system(size: 13, weight: .bold))
        Text(exaRuntimeLabel(target.runtimeType)).font(.system(size: 11, weight: .semibold))
          .foregroundStyle(RCTheme.muted)
      }
      Spacer()
      Button {
        pending = true
      } label: {
        ApplicationsExaSwitch(isOn: install != nil)
      }.buttonStyle(.plain).disabled(disabled || model.providerConnectionSnapshot?.readOnly == true)
    }.padding(12).background(
      install == nil ? RCTheme.surfaceInset : RCTheme.sidebarSelected.opacity(0.48)
    ).clipShape(RoundedRectangle(cornerRadius: 8)).alert(
      install == nil ? "Connect agent to Outlook?" : "Remove Outlook access?", isPresented: $pending
    ) {
      Button("Cancel", role: .cancel) {}
      Button(install == nil ? "Connect" : "Remove", role: install == nil ? nil : .destructive) {
        model.setOutlookAgentConnection(target.agentId, enabled: install == nil, for: app)
      }
    } message: {
      Text(
        install == nil
          ? "This grants signed-in-mailbox read-only access through four bounded Relay wrappers."
          : "This removes the agent's Outlook runtime tools and mailbox access.")
    }
  }
}

struct ApplicationsMicrosoftTeamsDetailPanel: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  private var connections: [MarketplaceProviderConnection] {
    (model.providerConnectionSnapshot?.connections ?? []).filter { $0.appSlug == app.slug }
  }
  private var selected: MarketplaceProviderConnection? { model.selectedProviderConnection }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    model.visibleMarketplaceCompatibleAgents.filter { app.runtimeSupport.contains($0.runtimeType) }
  }
  private func install(_ target: MarketplaceCompatibleAgentTarget) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == target.agentId && $0.appSlug == app.slug && exaInstallIsActive($0)
    }
  }
  private func ready(_ connection: MarketplaceProviderConnection?) -> Bool {
    guard let connection else { return false }
    return connection.status == .connected && connection.health.state == .ready
      && connection.credentialOwnership == .relayOwned
      && connection.grantedScopes == ProviderConnectionService.microsoftTeamsRelayOwnedOAuthScopes
      && connection.health.diagnostics["delegatedOnly"]?.bool == true
      && connection.health.diagnostics["workSchoolOnly"]?.bool == true
      && connection.health.diagnostics["messageContentEnabled"]?.bool == false
      && connection.health.diagnostics["adminConsentScopesEnabled"]?.bool == false
      && connection.health.diagnostics["meteredAPIsEnabled"]?.bool == false
      && connection.health.diagnostics["writesEnabled"]?.bool == false
      && connection.health.diagnostics["automaticPagination"]?.bool == false
      && connection.health.diagnostics["rawToolsEnabled"]?.bool == false
  }
  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      ApplicationsExaHeroCard(app: app)
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "person.2", title: "Agents with Microsoft Teams",
          subtitle: "Assignments expose Read only and No access for team/channel metadata.")
        if selected == nil {
          ApplicationsExaInfoPill(
            text: "Connect and select a verified Teams work account before turning agents on.")
        }
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 245), spacing: 12)], spacing: 12) {
          ForEach(targets) { target in
            ApplicationsMicrosoftTeamsAgentRow(
              app: app, target: target, install: install(target),
              disabled: !ready(selected) || target.status != .compatible)
          }
        }
      }
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "key", title: "Microsoft Teams connection",
          subtitle:
            "Delegated auth-code OAuth with PKCE, offline refresh, and revocation is brokered on Railway; Relay's Entra secret never reaches desktop."
        )
        ApplicationsExaInfoPill(
          text:
            "Exact Team.ReadBasic.All + Channel.ReadBasic.All · work accounts only · no messages or metered APIs"
        )
        Button {
          model.startMicrosoftTeamsOAuthConnect(for: app)
        } label: {
          Text(connections.isEmpty ? "Connect Microsoft Teams" : "Reconnect Microsoft Teams")
        }.buttonStyle(PrimaryLightButtonStyle()).disabled(
          model.providerConnectionSnapshot?.readOnly == true || app.availability != .available)
        if let status = model.microsoftTeamsConnectionStatus {
          Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
        if connections.isEmpty {
          EmptyMiniLight(
            title: "No verified Microsoft Teams connection",
            body:
              "Complete Relay-owned Microsoft OAuth, publisher verification, and tenant policy on Railway before assigning agents."
          )
        } else {
          ForEach(connections) { connection in
            HStack {
              Button {
                model.selectMicrosoftTeamsConnection(connection.id)
              } label: {
                Image(
                  systemName: selected?.id == connection.id ? "checkmark.circle.fill" : "circle")
              }.buttonStyle(.plain)
              VStack(alignment: .leading) {
                Text(connection.accountLabel ?? "Teams work account").font(
                  .system(size: 13, weight: .bold))
                Text(connection.connectedHandle ?? "Signed-in work user").font(
                  .system(size: 11, weight: .semibold)
                ).foregroundStyle(RCTheme.muted)
              }
              Spacer()
              Text(ready(connection) ? "Ready" : "Blocked").foregroundStyle(
                ready(connection) ? RCTheme.accentGreen : RCTheme.accentAmber)
              Button {
                model.deleteMicrosoftTeamsOAuthConnection(connection, for: app)
              } label: {
                Image(systemName: "trash")
              }.buttonStyle(IconLightButtonStyle())
            }.padding(12).background(RCTheme.surfaceInset).clipShape(
              RoundedRectangle(cornerRadius: 8))
          }
        }
      }
      LazyVGrid(columns: [GridItem(.adaptive(minimum: 285), spacing: 14)], spacing: 14) {
        ApplicationsExaInfoCard(
          icon: "person.3", title: "Capabilities", items: app.capabilities,
          linkTitle: "Microsoft Graph Teams documentation",
          linkURL: app.docsURL.flatMap(URL.init(string:)))
        ApplicationsExaInfoCard(
          icon: "rectangle.3.group", title: "What Agents Can Do",
          items: [
            "List up to 25 directly joined teams", "Inspect one explicit team's useful metadata",
            "List or inspect up to 25 visible channels in an explicit team",
          ], linkTitle: nil, linkURL: nil)
        ApplicationsExaInfoCard(
          icon: "lock.shield", title: "Requirements",
          items: [
            "Delegated work/school OAuth with Team.ReadBasic.All and Channel.ReadBasic.All",
            "Read only or No access; no Standard or Direct writes",
            "No messages, chats, members, directory, files, meetings, writes, admin/application scopes, metered APIs, exports, pagination, or raw tools",
          ], linkTitle: nil, linkURL: nil)
      }
    }
  }
}
struct ApplicationsMicrosoftTeamsAgentRow: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  let target: MarketplaceCompatibleAgentTarget
  let install: MarketplaceInstallRecord?
  let disabled: Bool
  @State private var pending = false
  var body: some View {
    HStack {
      VStack(alignment: .leading) {
        Text(target.agentName).font(.system(size: 13, weight: .bold))
        Text(exaRuntimeLabel(target.runtimeType)).font(.system(size: 11, weight: .semibold))
          .foregroundStyle(RCTheme.muted)
      }
      Spacer()
      Button {
        pending = true
      } label: {
        ApplicationsExaSwitch(isOn: install != nil)
      }.buttonStyle(.plain).disabled(disabled || model.providerConnectionSnapshot?.readOnly == true)
    }.padding(12).background(
      install == nil ? RCTheme.surfaceInset : RCTheme.sidebarSelected.opacity(0.48)
    ).clipShape(RoundedRectangle(cornerRadius: 8)).alert(
      install == nil ? "Connect agent to Microsoft Teams?" : "Remove Microsoft Teams access?",
      isPresented: $pending
    ) {
      Button("Cancel", role: .cancel) {}
      Button(install == nil ? "Connect" : "Remove", role: install == nil ? nil : .destructive) {
        model.setMicrosoftTeamsAgentConnection(target.agentId, enabled: install == nil, for: app)
      }
    } message: {
      Text(
        install == nil
          ? "This grants team/channel metadata-only access through four bounded Relay wrappers."
          : "This removes the agent's Microsoft Teams runtime tools and metadata access.")
    }
  }
}

struct ApplicationsOneDriveDetailPanel: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  private var connections: [MarketplaceProviderConnection] {
    (model.providerConnectionSnapshot?.connections ?? []).filter { $0.appSlug == app.slug }
  }
  private var selected: MarketplaceProviderConnection? { model.selectedProviderConnection }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    model.visibleMarketplaceCompatibleAgents.filter { app.runtimeSupport.contains($0.runtimeType) }
  }
  private func install(_ target: MarketplaceCompatibleAgentTarget) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == target.agentId && $0.appSlug == app.slug && exaInstallIsActive($0)
    }
  }
  private func ready(_ connection: MarketplaceProviderConnection?) -> Bool {
    guard let connection else { return false }
    return connection.status == .connected && connection.health.state == .ready
      && connection.credentialOwnership == .relayOwned
      && connection.grantedScopes == ProviderConnectionService.oneDriveRelayOwnedOAuthScopes
      && connection.health.diagnostics["delegatedOnly"]?.bool == true
      && connection.health.diagnostics["selfDriveOnly"]?.bool == true
      && connection.health.diagnostics["metadataOnly"]?.bool == true
      && connection.health.diagnostics["contentDownloadEnabled"]?.bool == false
      && connection.health.diagnostics["sharedRemoteEnabled"]?.bool == false
      && connection.health.diagnostics["writesEnabled"]?.bool == false
      && connection.health.diagnostics["automaticPagination"]?.bool == false
      && connection.health.diagnostics["rawToolsEnabled"]?.bool == false
  }
  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      ApplicationsExaHeroCard(app: app)
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "person.2", title: "Agents with OneDrive",
          subtitle: "Assignments expose Read only and No access for own-drive metadata.")
        if selected == nil {
          ApplicationsExaInfoPill(
            text: "Connect and select a verified OneDrive account before turning agents on.")
        }
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 245), spacing: 12)], spacing: 12) {
          ForEach(targets) { target in
            ApplicationsOneDriveAgentRow(
              app: app, target: target, install: install(target),
              disabled: !ready(selected) || target.status != .compatible)
          }
        }
      }
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "key", title: "OneDrive connection",
          subtitle:
            "Delegated OAuth with PKCE, offline refresh, and revocation is brokered on Railway; Relay's Entra secret never reaches desktop."
        )
        ApplicationsExaInfoPill(
          text:
            "Exact delegated Files.Read · signed-in /me/drive metadata only · no file content or writes"
        )
        Button {
          model.startOneDriveOAuthConnect(for: app)
        } label: {
          Text(connections.isEmpty ? "Connect OneDrive" : "Reconnect OneDrive")
        }.buttonStyle(PrimaryLightButtonStyle()).disabled(
          model.providerConnectionSnapshot?.readOnly == true || app.availability != .available)
        if let status = model.oneDriveConnectionStatus {
          Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
        if connections.isEmpty {
          EmptyMiniLight(
            title: "No verified OneDrive connection",
            body:
              "Complete Relay-owned Microsoft OAuth and provider setup on Railway before assigning agents."
          )
        } else {
          ForEach(connections) { connection in
            HStack {
              Button {
                model.selectOneDriveConnection(connection.id)
              } label: {
                Image(
                  systemName: selected?.id == connection.id ? "checkmark.circle.fill" : "circle")
              }.buttonStyle(.plain)
              VStack(alignment: .leading) {
                Text(connection.accountLabel ?? "OneDrive account").font(
                  .system(size: 13, weight: .bold))
                Text(connection.connectedHandle ?? "Signed-in user").font(
                  .system(size: 11, weight: .semibold)
                ).foregroundStyle(RCTheme.muted)
              }
              Spacer()
              Text(ready(connection) ? "Ready" : "Blocked").foregroundStyle(
                ready(connection) ? RCTheme.accentGreen : RCTheme.accentAmber)
              Button {
                model.deleteOneDriveOAuthConnection(connection, for: app)
              } label: {
                Image(systemName: "trash")
              }.buttonStyle(IconLightButtonStyle())
            }.padding(12).background(RCTheme.surfaceInset).clipShape(
              RoundedRectangle(cornerRadius: 8))
          }
        }
      }
      LazyVGrid(columns: [GridItem(.adaptive(minimum: 285), spacing: 14)], spacing: 14) {
        ApplicationsExaInfoCard(
          icon: "cloud", title: "Capabilities", items: app.capabilities,
          linkTitle: "Microsoft Graph OneDrive documentation",
          linkURL: app.docsURL.flatMap(URL.init(string:)))
        ApplicationsExaInfoCard(
          icon: "folder", title: "What Agents Can Do",
          items: [
            "Summarize connected drive type and quota state",
            "List up to 25 root or explicit-folder items",
            "Inspect one explicit file or folder's useful metadata",
          ], linkTitle: nil, linkURL: nil)
        ApplicationsExaInfoCard(
          icon: "lock.shield", title: "Requirements",
          items: [
            "Delegated Files.Read with openid/profile/offline_access through Railway",
            "Read only or No access; no Standard or Direct writes",
            "No file bytes/downloads, shared/remote/search, permissions/versions, writes, other drives/sites, application scopes, exports, pagination, or raw tools",
          ], linkTitle: nil, linkURL: nil)
      }
    }
  }
}
struct ApplicationsOneDriveAgentRow: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  let target: MarketplaceCompatibleAgentTarget
  let install: MarketplaceInstallRecord?
  let disabled: Bool
  @State private var pending = false
  var body: some View {
    HStack {
      VStack(alignment: .leading) {
        Text(target.agentName).font(.system(size: 13, weight: .bold))
        Text(exaRuntimeLabel(target.runtimeType)).font(.system(size: 11, weight: .semibold))
          .foregroundStyle(RCTheme.muted)
      }
      Spacer()
      Button {
        pending = true
      } label: {
        ApplicationsExaSwitch(isOn: install != nil)
      }.buttonStyle(.plain).disabled(disabled || model.providerConnectionSnapshot?.readOnly == true)
    }.padding(12).background(
      install == nil ? RCTheme.surfaceInset : RCTheme.sidebarSelected.opacity(0.48)
    ).clipShape(RoundedRectangle(cornerRadius: 8)).alert(
      install == nil ? "Connect agent to OneDrive?" : "Remove OneDrive access?",
      isPresented: $pending
    ) {
      Button("Cancel", role: .cancel) {}
      Button(install == nil ? "Connect" : "Remove", role: install == nil ? nil : .destructive) {
        model.setOneDriveAgentConnection(target.agentId, enabled: install == nil, for: app)
      }
    } message: {
      Text(
        install == nil
          ? "This grants own-drive metadata-only access through four bounded Relay wrappers."
          : "This removes the agent's OneDrive runtime tools and metadata access.")
    }
  }
}

struct ApplicationsSharePointDetailPanel: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  private var connections: [MarketplaceProviderConnection] {
    (model.providerConnectionSnapshot?.connections ?? []).filter { $0.appSlug == app.slug }
  }
  private var selected: MarketplaceProviderConnection? { model.selectedProviderConnection }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    model.visibleMarketplaceCompatibleAgents.filter { app.runtimeSupport.contains($0.runtimeType) }
  }
  private func install(_ target: MarketplaceCompatibleAgentTarget) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == target.agentId && $0.appSlug == app.slug && exaInstallIsActive($0)
    }
  }
  private func ready(_ c: MarketplaceProviderConnection?) -> Bool {
    guard let c else { return false }
    return c.status == .connected && c.health.state == .ready
      && c.grantedScopes == ProviderConnectionService.sharePointRelayOwnedOAuthScopes
      && c.health.diagnostics["selectedSiteOnly"]?.bool == true
      && c.health.diagnostics["siteGrantVerified"]?.bool == true
      && c.health.diagnostics["metadataOnly"]?.bool == true
      && c.health.diagnostics["tenantSearchEnabled"]?.bool == false
      && c.health.diagnostics["contentEnabled"]?.bool == false
      && c.health.diagnostics["writesEnabled"]?.bool == false
      && c.health.diagnostics["automaticPagination"]?.bool == false
      && c.health.diagnostics["rawToolsEnabled"]?.bool == false
  }
  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      ApplicationsExaHeroCard(app: app)
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "person.2", title: "Agents with SharePoint",
          subtitle: "Assignments expose Read only and No access for one administrator-granted site."
        )
        if selected == nil {
          ApplicationsExaInfoPill(
            text: "Connect and select a verified SharePoint site before turning agents on.")
        }
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 245), spacing: 12)], spacing: 12) {
          ForEach(targets) { target in
            ApplicationsSharePointAgentRow(
              app: app, target: target, install: install(target),
              disabled: !ready(selected) || target.status != .compatible)
          }
        }
      }
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "key", title: "SharePoint connection",
          subtitle:
            "Railway brokers delegated OAuth and binds one administrator-granted site; desktop never receives Relay's Entra secret."
        )
        ApplicationsExaInfoPill(
          text: "Exact delegated Sites.Selected · one verified read grant · metadata only")
        Button {
          model.startSharePointOAuthConnect(for: app)
        } label: {
          Text(connections.isEmpty ? "Connect SharePoint site" : "Reconnect SharePoint site")
        }.buttonStyle(PrimaryLightButtonStyle())
        if let status = model.sharePointConnectionStatus {
          Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
        if connections.isEmpty {
          EmptyMiniLight(
            title: "No verified selected-site connection",
            body:
              "An administrator must grant Relay read access to one site and complete Railway OAuth."
          )
        } else {
          ForEach(connections) { c in
            HStack {
              Button {
                model.selectSharePointConnection(c.id)
              } label: {
                Image(systemName: selected?.id == c.id ? "checkmark.circle.fill" : "circle")
              }.buttonStyle(.plain)
              VStack(alignment: .leading) {
                Text(c.accountLabel ?? "SharePoint site").font(.system(size: 13, weight: .bold))
                Text(c.connectedHandle ?? "Selected site").font(.system(size: 11)).foregroundStyle(
                  RCTheme.muted)
              }
              Spacer()
              Text(ready(c) ? "Ready" : "Blocked")
              Button {
                model.deleteSharePointOAuthConnection(c, for: app)
              } label: {
                Image(systemName: "trash")
              }.buttonStyle(IconLightButtonStyle())
            }.padding(12).background(RCTheme.surfaceInset).clipShape(
              RoundedRectangle(cornerRadius: 8))
          }
        }
      }
      LazyVGrid(columns: [GridItem(.adaptive(minimum: 285), spacing: 14)], spacing: 14) {
        ApplicationsExaInfoCard(
          icon: "building.2", title: "Capabilities", items: app.capabilities,
          linkTitle: "Microsoft Graph SharePoint documentation",
          linkURL: app.docsURL.flatMap(URL.init(string:)))
        ApplicationsExaInfoCard(
          icon: "list.bullet.rectangle", title: "What Agents Can Do",
          items: [
            "Summarize the selected site", "List up to 25 named lists or document libraries",
            "List up to 25 metadata-only root files/folders",
          ], linkTitle: nil, linkURL: nil)
        ApplicationsExaInfoCard(
          icon: "lock.shield", title: "Requirements",
          items: [
            "Delegated Sites.Selected plus administrator read grant", "Read only or No access",
            "No tenant search, list-item fields, content, identities, permissions, writes, other sites, broad scopes, exports, pagination, or raw tools",
          ], linkTitle: nil, linkURL: nil)
      }
    }
  }
}
struct ApplicationsSharePointAgentRow: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  let target: MarketplaceCompatibleAgentTarget
  let install: MarketplaceInstallRecord?
  let disabled: Bool
  @State private var pending = false
  var body: some View {
    HStack {
      VStack(alignment: .leading) {
        Text(target.agentName).font(.system(size: 13, weight: .bold))
        Text(exaRuntimeLabel(target.runtimeType)).font(.system(size: 11)).foregroundStyle(
          RCTheme.muted)
      }
      Spacer()
      Button {
        pending = true
      } label: {
        ApplicationsExaSwitch(isOn: install != nil)
      }.buttonStyle(.plain).disabled(disabled)
    }.padding(12).background(RCTheme.surfaceInset).clipShape(RoundedRectangle(cornerRadius: 8))
      .alert(
        install == nil ? "Connect agent to SharePoint?" : "Remove SharePoint access?",
        isPresented: $pending
      ) {
        Button("Cancel", role: .cancel) {}
        Button(install == nil ? "Connect" : "Remove", role: install == nil ? nil : .destructive) {
          model.setSharePointAgentConnection(target.agentId, enabled: install == nil, for: app)
        }
      } message: {
        Text("This changes selected-site metadata access through four bounded Relay wrappers.")
      }
  }
}

struct ApplicationsMicrosoftPlannerDetailPanel: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  private var connections: [MarketplaceProviderConnection] {
    (model.providerConnectionSnapshot?.connections ?? []).filter { $0.appSlug == app.slug }
  }
  private var selected: MarketplaceProviderConnection? { model.selectedProviderConnection }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    model.visibleMarketplaceCompatibleAgents.filter { app.runtimeSupport.contains($0.runtimeType) }
  }
  private func install(_ target: MarketplaceCompatibleAgentTarget) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == target.agentId && $0.appSlug == app.slug && exaInstallIsActive($0)
    }
  }
  private func ready(_ c: MarketplaceProviderConnection?) -> Bool {
    guard let c else { return false }
    return c.status == .connected && c.health.state == .ready
      && c.grantedScopes == ProviderConnectionService.microsoftPlannerRelayOwnedOAuthScopes
      && c.health.diagnostics["delegatedOnly"]?.bool == true
      && c.health.diagnostics["workSchoolOnly"]?.bool == true
      && c.health.diagnostics["assignmentIdentitiesEnabled"]?.bool == false
      && c.health.diagnostics["detailsEnabled"]?.bool == false
      && c.health.diagnostics["writesEnabled"]?.bool == false
      && c.health.diagnostics["automaticPagination"]?.bool == false
      && c.health.diagnostics["rawToolsEnabled"]?.bool == false
  }
  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      ApplicationsExaHeroCard(app: app)
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "checklist", title: "Agents with Planner",
          subtitle: "Assignments expose Read only and No access for bounded task and plan metadata."
        )
        if selected == nil {
          ApplicationsExaInfoPill(
            text: "Connect and select a work or school Planner account before turning agents on.")
        }
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 245), spacing: 12)], spacing: 12) {
          ForEach(targets) { target in
            ApplicationsMicrosoftPlannerAgentRow(
              app: app, target: target, install: install(target),
              disabled: !ready(selected) || target.status != .compatible)
          }
        }
      }
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "key", title: "Planner connection",
          subtitle:
            "Railway brokers delegated Microsoft OAuth; desktop never receives Relay's Entra secret."
        )
        ApplicationsExaInfoPill(
          text: "Exact delegated Tasks.Read · work/school account · read only")
        Button {
          model.startMicrosoftPlannerOAuthConnect(for: app)
        } label: {
          Text(connections.isEmpty ? "Connect Microsoft Planner" : "Reconnect Microsoft Planner")
        }.buttonStyle(PrimaryLightButtonStyle())
        if let status = model.microsoftPlannerConnectionStatus {
          Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
        if connections.isEmpty {
          EmptyMiniLight(
            title: "No Planner connection",
            body: "Complete delegated Tasks.Read OAuth through Railway.")
        } else {
          ForEach(connections) { c in
            HStack {
              Button {
                model.selectMicrosoftPlannerConnection(c.id)
              } label: {
                Image(systemName: selected?.id == c.id ? "checkmark.circle.fill" : "circle")
              }.buttonStyle(.plain)
              VStack(alignment: .leading) {
                Text(c.accountLabel ?? "Planner account").font(.system(size: 13, weight: .bold))
                Text(c.connectedHandle ?? "Work or school account").font(.system(size: 11))
                  .foregroundStyle(RCTheme.muted)
              }
              Spacer()
              Text(ready(c) ? "Ready" : "Blocked")
              Button {
                model.deleteMicrosoftPlannerOAuthConnection(c, for: app)
              } label: {
                Image(systemName: "trash")
              }.buttonStyle(IconLightButtonStyle())
            }.padding(12).background(RCTheme.surfaceInset).clipShape(
              RoundedRectangle(cornerRadius: 8))
          }
        }
      }
      LazyVGrid(columns: [GridItem(.adaptive(minimum: 285), spacing: 14)], spacing: 14) {
        ApplicationsExaInfoCard(
          icon: "checklist", title: "Capabilities", items: app.capabilities,
          linkTitle: "Microsoft Graph Planner documentation",
          linkURL: app.docsURL.flatMap(URL.init(string:)))
        ApplicationsExaInfoCard(
          icon: "list.bullet.rectangle", title: "What Agents Can Do",
          items: [
            "List up to 25 assigned tasks", "Inspect one explicit task or plan",
            "List up to 25 tasks for an explicit plan",
          ], linkTitle: nil, linkURL: nil)
        ApplicationsExaInfoCard(
          icon: "lock.shield", title: "Requirements",
          items: [
            "Delegated Tasks.Read on a work or school account", "Read only or No access",
            "No assignment identities, details, checklists, references, directory discovery, writes, broad scopes, exports, pagination, or raw tools",
          ], linkTitle: nil, linkURL: nil)
      }
    }
  }
}
struct ApplicationsMicrosoftPlannerAgentRow: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  let target: MarketplaceCompatibleAgentTarget
  let install: MarketplaceInstallRecord?
  let disabled: Bool
  @State private var pending = false
  var body: some View {
    HStack {
      VStack(alignment: .leading) {
        Text(target.agentName).font(.system(size: 13, weight: .bold))
        Text(exaRuntimeLabel(target.runtimeType)).font(.system(size: 11)).foregroundStyle(
          RCTheme.muted)
      }
      Spacer()
      Button {
        pending = true
      } label: {
        ApplicationsExaSwitch(isOn: install != nil)
      }.buttonStyle(.plain).disabled(disabled)
    }.padding(12).background(RCTheme.surfaceInset).clipShape(RoundedRectangle(cornerRadius: 8))
      .alert(
        install == nil ? "Connect agent to Planner?" : "Remove Planner access?",
        isPresented: $pending
      ) {
        Button("Cancel", role: .cancel) {}
        Button(install == nil ? "Connect" : "Remove", role: install == nil ? nil : .destructive) {
          model.setMicrosoftPlannerAgentConnection(
            target.agentId, enabled: install == nil, for: app)
        }
      } message: {
        Text("This changes bounded Planner read access through four Relay wrappers.")
      }
  }
}

struct ApplicationsMicrosoftToDoDetailPanel: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  private var connections: [MarketplaceProviderConnection] {
    (model.providerConnectionSnapshot?.connections ?? []).filter { $0.appSlug == app.slug }
  }
  private var selected: MarketplaceProviderConnection? { model.selectedProviderConnection }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    model.visibleMarketplaceCompatibleAgents.filter { app.runtimeSupport.contains($0.runtimeType) }
  }
  private func install(_ target: MarketplaceCompatibleAgentTarget) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == target.agentId && $0.appSlug == app.slug && exaInstallIsActive($0)
    }
  }
  private func ready(_ c: MarketplaceProviderConnection?) -> Bool {
    guard let c else { return false }
    return c.status == .connected && c.health.state == .ready
      && c.grantedScopes == ProviderConnectionService.microsoftToDoRelayOwnedOAuthScopes
      && c.health.diagnostics["delegatedSelfOnly"]?.bool == true
      && c.health.diagnostics["sharedTasksEnabled"]?.bool == false
      && c.health.diagnostics["taskBodyEnabled"]?.bool == false
      && c.health.diagnostics["relatedContentEnabled"]?.bool == false
      && c.health.diagnostics["writesEnabled"]?.bool == false
      && c.health.diagnostics["automaticPagination"]?.bool == false
      && c.health.diagnostics["rawToolsEnabled"]?.bool == false
  }
  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      ApplicationsExaHeroCard(app: app)
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "checkmark.circle", title: "Agents with Microsoft To Do",
          subtitle: "Assignments expose Read only and No access for bounded list and task metadata."
        )
        if selected == nil {
          ApplicationsExaInfoPill(
            text: "Connect and select a Microsoft To Do account before turning agents on.")
        }
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 245), spacing: 12)], spacing: 12) {
          ForEach(targets) { target in
            ApplicationsMicrosoftToDoAgentRow(
              app: app, target: target, install: install(target),
              disabled: !ready(selected) || target.status != .compatible)
          }
        }
      }
      ApplicationsExaPanel {
        ApplicationsExaSectionHeading(
          icon: "key", title: "Microsoft To Do connection",
          subtitle:
            "Railway brokers delegated Microsoft OAuth; desktop never receives Relay's Entra secret."
        )
        ApplicationsExaInfoPill(text: "Exact delegated Tasks.Read · signed-in user · read only")
        Button {
          model.startMicrosoftToDoOAuthConnect(for: app)
        } label: {
          Text(connections.isEmpty ? "Connect Microsoft To Do" : "Reconnect Microsoft To Do")
        }.buttonStyle(PrimaryLightButtonStyle())
        if let status = model.microsoftToDoConnectionStatus {
          Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
        if connections.isEmpty {
          EmptyMiniLight(
            title: "No Microsoft To Do connection",
            body: "Complete delegated Tasks.Read OAuth through Railway.")
        } else {
          ForEach(connections) { c in
            HStack {
              Button {
                model.selectMicrosoftToDoConnection(c.id)
              } label: {
                Image(systemName: selected?.id == c.id ? "checkmark.circle.fill" : "circle")
              }.buttonStyle(.plain)
              VStack(alignment: .leading) {
                Text(c.accountLabel ?? "Microsoft To Do account").font(
                  .system(size: 13, weight: .bold))
                Text(c.connectedHandle ?? "Microsoft account").font(.system(size: 11))
                  .foregroundStyle(RCTheme.muted)
              }
              Spacer()
              Text(ready(c) ? "Ready" : "Blocked")
              Button {
                model.deleteMicrosoftToDoOAuthConnection(c, for: app)
              } label: {
                Image(systemName: "trash")
              }.buttonStyle(IconLightButtonStyle())
            }.padding(12).background(RCTheme.surfaceInset).clipShape(
              RoundedRectangle(cornerRadius: 8))
          }
        }
      }
      LazyVGrid(columns: [GridItem(.adaptive(minimum: 285), spacing: 14)], spacing: 14) {
        ApplicationsExaInfoCard(
          icon: "checkmark.circle", title: "Capabilities", items: app.capabilities,
          linkTitle: "Microsoft Graph To Do documentation",
          linkURL: app.docsURL.flatMap(URL.init(string:)))
        ApplicationsExaInfoCard(
          icon: "list.bullet.rectangle", title: "What Agents Can Do",
          items: [
            "List up to 25 task lists", "List up to 25 tasks in an explicit list",
            "Inspect one explicit task's status, importance, reminders, and dates",
          ], linkTitle: nil, linkURL: nil)
        ApplicationsExaInfoCard(
          icon: "lock.shield", title: "Requirements",
          items: [
            "Delegated Tasks.Read for the signed-in Microsoft account", "Read only or No access",
            "No bodies, categories, checklists, linked resources, attachments, shared expansion, writes, delta, other users, exports, pagination, or raw tools",
          ], linkTitle: nil, linkURL: nil)
      }
    }
  }
}
struct ApplicationsMicrosoftToDoAgentRow: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  let target: MarketplaceCompatibleAgentTarget
  let install: MarketplaceInstallRecord?
  let disabled: Bool
  @State private var pending = false
  var body: some View {
    HStack {
      VStack(alignment: .leading) {
        Text(target.agentName).font(.system(size: 13, weight: .bold))
        Text(exaRuntimeLabel(target.runtimeType)).font(.system(size: 11)).foregroundStyle(
          RCTheme.muted)
      }
      Spacer()
      Button {
        pending = true
      } label: {
        ApplicationsExaSwitch(isOn: install != nil)
      }.buttonStyle(.plain).disabled(disabled)
    }.padding(12).background(RCTheme.surfaceInset).clipShape(RoundedRectangle(cornerRadius: 8))
      .alert(
        install == nil ? "Connect agent to Microsoft To Do?" : "Remove Microsoft To Do access?",
        isPresented: $pending
      ) {
        Button("Cancel", role: .cancel) {}
        Button(install == nil ? "Connect" : "Remove", role: install == nil ? nil : .destructive) {
          model.setMicrosoftToDoAgentConnection(target.agentId, enabled: install == nil, for: app)
        }
      } message: {
        Text("This changes bounded Microsoft To Do read access through four Relay wrappers.")
      }
  }
}
