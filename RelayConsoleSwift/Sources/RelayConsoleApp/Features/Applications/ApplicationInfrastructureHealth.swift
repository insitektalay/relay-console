import AppKit
import RelayConsoleCore
import SwiftUI
import UniformTypeIdentifiers

struct ApplicationsTelemetryDeckConnectionsCard: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp

  private var connections: [MarketplaceProviderConnection] {
    model.providerConnectionSnapshot?.connections ?? []
  }

  private var selectedConnection: MarketplaceProviderConnection? {
    model.selectedProviderConnection
  }

  private var canSave: Bool {
    model.telemetryDeckPATDraft.nilIfEmpty != nil
      && model.telemetryDeckNamespaceDraft.nilIfEmpty != nil
      && model.telemetryDeckAppIdDraft.nilIfEmpty != nil
      && model.busy != "save-telemetrydeck-pat"
  }

  var body: some View {
    ApplicationsExaPanel {
      HStack(alignment: .top, spacing: 14) {
        ApplicationsExaSectionHeading(
          icon: "key", title: "Manage API Connection",
          subtitle: "Save the user-owned TelemetryDeck PAT and selected app scope.")
        Spacer()
        ApplicationsExaInfoPill(
          text: "Read-only V1. No Relay-owned TelemetryDeck app or callback is used.")
      }

      ViewThatFits(in: .horizontal) {
        HStack(alignment: .top, spacing: 24) {
          credentialForm
          connectionTable
        }
        VStack(alignment: .leading, spacing: 14) {
          credentialForm
          connectionTable
        }
      }

      if let status = model.telemetryDeckConnectionStatus?.nilIfEmpty {
        HStack(spacing: 8) {
          Image(
            systemName: status.localizedCaseInsensitiveContains("deleted")
              || status.localizedCaseInsensitiveContains("disconnected")
              ? "info.circle" : "checkmark.circle.fill"
          )
          .foregroundStyle(
            status.localizedCaseInsensitiveContains("saved")
              || status.localizedCaseInsensitiveContains("connected")
              ? RCTheme.accentGreen : RCTheme.accentAmber)
          Text(status)
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(RCTheme.muted)
          Spacer()
        }
      }
    }
  }

  private var credentialForm: some View {
    VStack(alignment: .leading, spacing: 12) {
      Text(connections.isEmpty ? "Add PAT connection" : "Replace PAT")
        .font(.system(size: 15, weight: .bold))
      ApplicationsExaInput(
        label: "Connection name optional", placeholder: "TelemetryDeck analytics",
        text: $model.telemetryDeckConnectionNameDraft, secure: false)
      ApplicationsExaInput(
        label: "Personal Access Token", placeholder: "Paste TelemetryDeck PAT",
        text: $model.telemetryDeckPATDraft, secure: true)
      ApplicationsExaInput(
        label: "Organization namespace", placeholder: "organization namespace",
        text: $model.telemetryDeckNamespaceDraft, secure: false)
      ApplicationsExaInput(
        label: "TelemetryDeck app ID", placeholder: "Selected app ID",
        text: $model.telemetryDeckAppIdDraft, secure: false)
      ApplicationsExaInput(
        label: "App display name optional", placeholder: "iOS app analytics",
        text: $model.telemetryDeckAppDisplayNameDraft, secure: false)
      ApplicationsExaInput(
        label: "Default insight ID optional", placeholder: "Saved insight ID",
        text: $model.telemetryDeckDefaultInsightIdDraft, secure: false)
      Button {
        model.saveTelemetryDeckPAT(for: app)
      } label: {
        if model.busy == "save-telemetrydeck-pat" {
          HStack(spacing: 7) {
            ProgressView()
              .controlSize(.small)
              .scaleEffect(0.75)
            Text("Saving...")
          }
        } else {
          Text(connections.isEmpty ? "Add connection" : "Replace PAT")
        }
      }
      .buttonStyle(PrimaryLightButtonStyle())
      .frame(maxWidth: .infinity)
      .disabled(
        !canSave || model.providerConnectionSnapshot?.readOnly == true
          || app.availability != .available)
      HStack(spacing: 7) {
        Image(systemName: "lock")
        Text(
          "The PAT is stored in Keychain only. Namespace and app metadata are saved without secrets."
        )
      }
      .font(.system(size: 11, weight: .semibold))
      .foregroundStyle(RCTheme.muted)
    }
    .padding(16)
    .frame(width: 410, alignment: .topLeading)
    .background(RCTheme.surfaceInset)
    .clipShape(RoundedRectangle(cornerRadius: 8))
    .overlay(RoundedRectangle(cornerRadius: 8).stroke(RCTheme.borderSoft))
  }

  private var connectionTable: some View {
    ScrollView(.horizontal, showsIndicators: false) {
      VStack(spacing: 0) {
        ApplicationsTelemetryDeckConnectionHeader()
        if connections.isEmpty {
          EmptyMiniLight(
            title: "No TelemetryDeck PAT connection",
            body:
              "Add a user-owned TelemetryDeck PAT, namespace, and app ID before assigning agents."
          )
          .padding(.vertical, 22)
        } else {
          ForEach(connections) { connection in
            ApplicationsTelemetryDeckConnectionRow(
              app: app,
              connection: connection,
              selected: selectedConnection?.id == connection.id
            )
          }
        }
        HStack(spacing: 8) {
          Image(systemName: "lightbulb")
            .foregroundStyle(RCTheme.muted)
          Text(
            "Check validates the PAT against TelemetryDeck user-info before agents use read-only analytics wrappers."
          )
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
      .frame(minWidth: 880, alignment: .topLeading)
    }
    .frame(maxWidth: .infinity, alignment: .topLeading)
    .background(RCTheme.surfaceInset)
    .clipShape(RoundedRectangle(cornerRadius: 8))
    .overlay(RoundedRectangle(cornerRadius: 8).stroke(RCTheme.borderSoft))
  }
}

struct ApplicationsTelemetryDeckConnectionHeader: View {
  var body: some View {
    HStack(spacing: 12) {
      Text("")
        .frame(width: 28)
      Text("Connection name")
        .frame(minWidth: 180, maxWidth: .infinity, alignment: .leading)
      Text("App scope")
        .frame(width: 190, alignment: .leading)
      Text("Insight")
        .frame(width: 140, alignment: .leading)
      Text("Last check")
        .frame(width: 120, alignment: .leading)
      Text("Status")
        .frame(width: 100, alignment: .leading)
      Text("Actions")
        .frame(width: 92, alignment: .center)
    }
    .font(.system(size: 11, weight: .bold))
    .foregroundStyle(RCTheme.muted)
    .padding(.horizontal, 14)
    .frame(height: 36)
  }
}

struct ApplicationsTelemetryDeckConnectionRow: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp
  let connection: MarketplaceProviderConnection
  let selected: Bool

  private var isTesting: Bool {
    model.busy == "test-telemetrydeck-connection-\(connection.id)"
  }

  private var isDeleting: Bool {
    model.busy == "delete-telemetrydeck-connection-\(connection.id)"
  }

  var body: some View {
    HStack(spacing: 12) {
      Button {
        model.selectTelemetryDeckConnection(connection.id)
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
      .disabled(!telemetryDeckConnectionIsAssignable(connection))
      .help("Select \(telemetryDeckConnectionName(connection))")
      .accessibilityLabel("Select \(telemetryDeckConnectionName(connection))")

      VStack(alignment: .leading, spacing: 2) {
        HStack(spacing: 8) {
          Text(telemetryDeckConnectionName(connection))
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
        Text(telemetryDeckTokenPreview(connection))
          .font(.system(size: 11, weight: .semibold, design: .monospaced))
          .foregroundStyle(RCTheme.muted)
      }
      .frame(minWidth: 180, maxWidth: .infinity, alignment: .leading)

      Text(telemetryDeckScopePreview(connection))
        .font(.system(size: 13, weight: .semibold))
        .foregroundStyle(RCTheme.muted)
        .lineLimit(1)
        .frame(width: 190, alignment: .leading)

      Text(telemetryDeckDefaultInsightPreview(connection))
        .font(.system(size: 12, weight: .semibold))
        .foregroundStyle(RCTheme.muted)
        .lineLimit(1)
        .frame(width: 140, alignment: .leading)

      Text(telemetryDeckLastCheckedText(connection))
        .font(.system(size: 12, weight: .semibold))
        .foregroundStyle(RCTheme.muted)
        .lineLimit(1)
        .frame(width: 120, alignment: .leading)

      HStack(spacing: 7) {
        Image(
          systemName: telemetryDeckConnectionIsReady(connection)
            ? "checkmark.circle.fill" : "exclamationmark.triangle.fill"
        )
        .foregroundStyle(
          telemetryDeckConnectionIsReady(connection) ? RCTheme.accentGreen : RCTheme.accentAmber)
        Text(telemetryDeckConnectionStatusText(connection))
          .font(.system(size: 12, weight: .semibold))
      }
      .frame(width: 100, alignment: .leading)

      HStack(spacing: 8) {
        Button {
          model.testTelemetryDeckConnection(connection, for: app)
        } label: {
          if isTesting {
            ProgressView()
              .controlSize(.small)
              .scaleEffect(0.65)
          } else {
            Image(systemName: "arrow.triangle.2.circlepath")
          }
        }
        .buttonStyle(IconLightButtonStyle())
        .disabled(isTesting || model.providerConnectionSnapshot?.readOnly == true)
        .help("Check \(telemetryDeckConnectionName(connection))")
        .accessibilityLabel("Check \(telemetryDeckConnectionName(connection))")

        Button {
          model.deleteTelemetryDeckConnection(connection, for: app)
        } label: {
          Image(systemName: "trash")
        }
        .buttonStyle(IconLightButtonStyle())
        .disabled(isDeleting || model.providerConnectionSnapshot?.readOnly == true)
        .help("Delete \(telemetryDeckConnectionName(connection))")
        .accessibilityLabel("Delete \(telemetryDeckConnectionName(connection))")
      }
      .frame(width: 92, alignment: .center)
    }
    .padding(.horizontal, 14)
    .frame(height: 52)
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

struct ApplicationsDatadogDetailPanel: View {
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
          icon: "person.2", title: "Agents with Datadog",
          subtitle: "Assign the selected read-only Datadog organization to compatible agents.")
        if connections.isEmpty {
          ApplicationsExaInfoPill(
            text:
              "Agent rows stay visible but disabled until the secure Datadog OAuth connection is ready."
          )
        }
        LazyVGrid(
          columns: [GridItem(.adaptive(minimum: 245), spacing: 12)], alignment: .leading,
          spacing: 12
        ) {
          ForEach(targets) { target in
            ApplicationsDatadogAgentSwitchRow(
              app: app, target: target, install: activeInstall(target.agentId),
              enabled: selected.map(datadogConnectionIsReady) == true
                && target.status == .compatible)
          }
        }
        if targets.isEmpty {
          EmptyMiniLight(
            title: "No available agents",
            body: "Datadog supports compatible Hermes and OpenClaw agents.")
        }
      }
      ApplicationsExaPanel {
        HStack(alignment: .top) {
          ApplicationsExaSectionHeading(
            icon: "key", title: "Manage API Connection",
            subtitle: "Connect through Relay's secure hosted Datadog OAuth flow.")
          Spacer()
          ApplicationsExaInfoPill(text: "monitors_read · incident_read · apm_service_catalog_read")
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
        if let status = model.datadogConnectionStatus?.nilIfEmpty {
          Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
      }
      LazyVGrid(
        columns: [GridItem(.adaptive(minimum: 285), spacing: 14)], alignment: .leading, spacing: 14
      ) {
        ApplicationsExaInfoCard(
          icon: "waveform.path.ecg", title: "Capabilities", items: app.capabilities,
          linkTitle: "Datadog API docs", linkURL: app.docsURL.flatMap(URL.init(string:)))
        ApplicationsExaInfoCard(
          icon: "lock.shield", title: "What Agents Can Do",
          items: [
            "Search bounded monitor summaries", "Review bounded incident summaries",
            "Find service ownership and lifecycle context",
          ], linkTitle: nil, linkURL: nil)
        ApplicationsExaInfoCard(
          icon: "checklist", title: "Requirements",
          items: marketplaceConnectionRequirements(for: app), linkTitle: nil, linkURL: nil)
      }
    }
  }
  private var connectForm: some View {
    VStack(alignment: .leading, spacing: 12) {
      Text("Connect Datadog").font(.system(size: 15, weight: .bold))
      Text(
        "Relay uses Datadog authorization-code OAuth with S256 PKCE. The client secret and code exchange stay in the authenticated Railway broker; access and refresh tokens are returned as separate Keychain references."
      ).font(.system(size: 12)).foregroundStyle(RCTheme.muted)
      Button {
        model.startDatadogOAuthConnect(for: app)
      } label: {
        Label(
          selected == nil ? "Connect Datadog" : "Reconnect Datadog", systemImage: "link.badge.plus")
      }.buttonStyle(PrimaryLightButtonStyle()).frame(maxWidth: .infinity).disabled(
        model.busy == "connect-datadog-oauth" || model.providerConnectionSnapshot?.readOnly == true
          || app.availability != .available)
      Text(
        "Partner Sandbox client, callback registration, scope review, and Railway broker deployment are required before live consent."
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
          Text("Site").frame(width: 190, alignment: .leading)
          Text("Scopes").frame(width: 220, alignment: .leading)
          Text("Status").frame(width: 100, alignment: .leading)
          Text("Actions").frame(width: 54)
        }.font(.system(size: 11, weight: .bold)).foregroundStyle(RCTheme.muted).padding(
          .horizontal, 14
        ).frame(height: 36)
        if connections.isEmpty {
          EmptyMiniLight(
            title: "No Datadog OAuth connection",
            body: "Complete hosted provider setup and Datadog consent before assigning agents."
          ).padding(.vertical, 22)
        } else {
          ForEach(connections) { connection in
            HStack {
              Button {
                model.selectDatadogConnection(connection.id)
              } label: {
                Image(
                  systemName: selected?.id == connection.id ? "largecircle.fill.circle" : "circle")
              }.buttonStyle(.plain).frame(width: 28).disabled(!datadogConnectionIsReady(connection))
              Text(connection.accountLabel ?? "Datadog organization").frame(
                width: 210, alignment: .leading)
              Text(connection.health.diagnostics["apiOrigin"]?.string ?? "Unknown").frame(
                width: 190, alignment: .leading)
              Text(connection.grantedScopes.joined(separator: ", ")).frame(
                width: 220, alignment: .leading
              ).lineLimit(1)
              Text(datadogConnectionIsReady(connection) ? "Ready" : "Reconnect").frame(
                width: 100, alignment: .leading)
              Button {
                model.deleteDatadogConnection(connection, for: app)
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
            "Only exact allowlisted Datadog API sites are accepted; arbitrary callback domains are rejected."
          )
          Spacer()
        }.font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted).padding(
          .horizontal, 14
        ).frame(height: 38).overlay(alignment: .top) {
          Rectangle().fill(RCTheme.borderSoft).frame(height: 1)
        }
      }.frame(minWidth: 850)
    }.background(RCTheme.surfaceInset).clipShape(RoundedRectangle(cornerRadius: 8)).overlay(
      RoundedRectangle(cornerRadius: 8).stroke(RCTheme.borderSoft))
  }
  private func activeInstall(_ agentId: RelayId) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "datadog" && exaInstallIsActive($0)
    }
  }
}

struct ApplicationsDatadogAgentSwitchRow: View {
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
          !enabled || model.busy == "toggle-datadog-agent-\(target.agentId)")
      }
      if isOn, let install {
        Text("Read-only Datadog observability").font(.system(size: 11, weight: .bold))
          .foregroundStyle(RCTheme.muted)
        ApplicationsAgentAuthorityRow(app: app, install: install, selectedPreset: .readOnly)
      }
    }.padding(12).frame(minHeight: 86).background(
      isOn ? RCTheme.sidebarSelected.opacity(0.48) : RCTheme.surfaceInset
    ).clipShape(RoundedRectangle(cornerRadius: 8)).overlay(
      RoundedRectangle(cornerRadius: 8).stroke(
        isOn ? RCTheme.accentGreen.opacity(0.35) : RCTheme.borderSoft)
    ).opacity(!enabled && !isOn ? 0.65 : 1).alert(
      pending == true ? "Connect agent to Datadog?" : "Disconnect Datadog?",
      isPresented: Binding(get: { pending != nil }, set: { if !$0 { pending = nil } })
    ) {
      Button("Cancel", role: .cancel) { pending = nil }
      Button(pending == true ? "Connect" : "Disconnect") {
        let value = pending ?? !isOn
        pending = nil
        model.setDatadogAgentConnection(target.agentId, enabled: value, for: app)
      }
    } message: {
      Text("This changes only the selected agent's bounded read-only Datadog access.")
    }
  }
}

func datadogConnectionIsReady(_ connection: MarketplaceProviderConnection) -> Bool {
  connection.appSlug == "datadog" && connection.status == .connected
    && connection.health.state == .ready
    && connection.grantedScopes == ProviderConnectionService.datadogReadScopes
    && connection.health.diagnostics["apiOrigin"]?.string.map(
      DatadogProviderActionSupport.allowedAPIOrigins.contains) == true
}

func pagerDutyConnectionIsReadyForAssignment(_ connection: MarketplaceProviderConnection) -> Bool {
  connection.appSlug == "pagerduty" && connection.status == .connected
    && connection.health.state == .ready && connection.grantedScopes == connection.requiredScopes
    && Set(ProviderConnectionService.pagerDutyReadScopes).isSubset(
      of: Set(connection.grantedScopes))
    && connection.health.diagnostics["apiOrigin"]?.string.map(
      PagerDutyProviderActionSupport.allowedAPIOrigins.contains) == true
}

struct ApplicationsPagerDutyDetailPanel: View {
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
          icon: "person.2", title: "Agents with PagerDuty",
          subtitle: "Assign the selected read-only PagerDuty account to compatible agents.")
        if connections.isEmpty {
          ApplicationsExaInfoPill(
            text: "Agent rows stay visible but disabled until secure Scoped OAuth is ready.")
        }
        LazyVGrid(
          columns: [GridItem(.adaptive(minimum: 245), spacing: 12)], alignment: .leading,
          spacing: 12
        ) {
          ForEach(targets) { target in
            ApplicationsPagerDutyAgentSwitchRow(
              app: app, target: target, install: activeInstall(target.agentId),
              enabled: selected.map(pagerDutyConnectionIsReadyForAssignment) == true
                && target.status == .compatible)
          }
        }
        if targets.isEmpty {
          EmptyMiniLight(
            title: "No available agents",
            body: "PagerDuty supports compatible Hermes and OpenClaw agents.")
        }
      }
      ApplicationsExaPanel {
        HStack(alignment: .top) {
          ApplicationsExaSectionHeading(
            icon: "key", title: "Manage API Connection",
            subtitle: "Connect through Relay's secure hosted PagerDuty Scoped OAuth flow.")
          Spacer()
          ApplicationsExaInfoPill(
            text: "openid · incidents.read · services.read · exact account audience")
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
        if let status = model.pagerDutyConnectionStatus?.nilIfEmpty {
          Text(status).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
      }
      LazyVGrid(
        columns: [GridItem(.adaptive(minimum: 285), spacing: 14)], alignment: .leading, spacing: 14
      ) {
        ApplicationsExaInfoCard(
          icon: "bell.and.waves.left.and.right", title: "Capabilities", items: app.capabilities,
          linkTitle: "PagerDuty API docs", linkURL: app.docsURL.flatMap(URL.init(string:)))
        ApplicationsExaInfoCard(
          icon: "lock.shield", title: "What Agents Can Do",
          items: [
            "List bounded incident summaries", "Inspect one incident's operational context",
            "List bounded service ownership summaries",
          ], linkTitle: nil, linkURL: nil)
        ApplicationsExaInfoCard(
          icon: "checklist", title: "Requirements",
          items: marketplaceConnectionRequirements(for: app), linkTitle: nil, linkURL: nil)
      }
    }
  }
  private var connectForm: some View {
    VStack(alignment: .leading, spacing: 12) {
      Text("Connect PagerDuty").font(.system(size: 15, weight: .bold))
      Text(
        "Relay uses PagerDuty confidential Scoped OAuth. The client secret, authorization-code exchange, refresh, and revoke stay in the authenticated Railway broker; access and refresh tokens return as separate Keychain references."
      ).font(.system(size: 12)).foregroundStyle(RCTheme.muted)
      Button {
        model.startPagerDutyOAuthConnect(for: app)
      } label: {
        Label(
          selected == nil ? "Connect PagerDuty" : "Reconnect PagerDuty",
          systemImage: "link.badge.plus")
      }.buttonStyle(PrimaryLightButtonStyle()).frame(maxWidth: .infinity).disabled(
        model.busy == "connect-pagerduty-oauth"
          || model.providerConnectionSnapshot?.readOnly == true || app.availability != .available)
      Text(
        "A registered confidential app, exact US/EU account audience, callback, and Railway broker deployment are required before live consent."
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
          Text("Connection").frame(width: 190, alignment: .leading)
          Text("Region / account").frame(width: 180, alignment: .leading)
          Text("Scopes").frame(width: 250, alignment: .leading)
          Text("Status").frame(width: 90, alignment: .leading)
          Text("Actions").frame(width: 54)
        }.font(.system(size: 11, weight: .bold)).foregroundStyle(RCTheme.muted).padding(
          .horizontal, 14
        ).frame(height: 36)
        if connections.isEmpty {
          EmptyMiniLight(
            title: "No PagerDuty OAuth connection",
            body: "Complete provider setup and consent before assigning agents."
          ).padding(.vertical, 22)
        } else {
          ForEach(connections) { connection in
            HStack {
              Button {
                model.selectPagerDutyConnection(connection.id)
              } label: {
                Image(
                  systemName: selected?.id == connection.id ? "largecircle.fill.circle" : "circle")
              }.buttonStyle(.plain).frame(width: 28).disabled(
                !pagerDutyConnectionIsReadyForAssignment(connection))
              Text(connection.accountLabel ?? "PagerDuty account").frame(
                width: 190, alignment: .leading)
              Text(
                (connection.health.diagnostics["accountRegion"]?.string ?? "?") + " / "
                  + (connection.health.diagnostics["accountSubdomain"]?.string ?? "?")
              ).frame(width: 180, alignment: .leading)
              Text(connection.grantedScopes.joined(separator: ", ")).frame(
                width: 250, alignment: .leading
              ).lineLimit(1)
              Text(pagerDutyConnectionIsReadyForAssignment(connection) ? "Ready" : "Reconnect")
                .frame(width: 90, alignment: .leading)
              Button {
                model.deletePagerDutyConnection(connection, for: app)
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
            "Writes, contacts, on-calls, alert bodies/logs, Events ingestion, raw REST, and automatic pagination are blocked."
          )
          Spacer()
        }.font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted).padding(
          .horizontal, 14
        ).frame(height: 38).overlay(alignment: .top) {
          Rectangle().fill(RCTheme.borderSoft).frame(height: 1)
        }
      }.frame(minWidth: 850)
    }.background(RCTheme.surfaceInset).clipShape(RoundedRectangle(cornerRadius: 8)).overlay(
      RoundedRectangle(cornerRadius: 8).stroke(RCTheme.borderSoft))
  }
  private func activeInstall(_ agentId: RelayId) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "pagerduty" && exaInstallIsActive($0)
    }
  }
}

struct ApplicationsPagerDutyAgentSwitchRow: View {
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
          !enabled || model.busy == "toggle-pagerduty-agent-\(target.agentId)")
      }
      if isOn, let install {
        Text("Read-only PagerDuty incidents and services").font(.system(size: 11, weight: .bold))
          .foregroundStyle(RCTheme.muted)
        ApplicationsAgentAuthorityRow(app: app, install: install, selectedPreset: .readOnly)
      }
    }.padding(12).frame(minHeight: 86).background(
      isOn ? RCTheme.sidebarSelected.opacity(0.48) : RCTheme.surfaceInset
    ).clipShape(RoundedRectangle(cornerRadius: 8)).overlay(
      RoundedRectangle(cornerRadius: 8).stroke(
        isOn ? RCTheme.accentGreen.opacity(0.35) : RCTheme.borderSoft)
    ).opacity(!enabled && !isOn ? 0.65 : 1).alert(
      pending == true ? "Connect agent to PagerDuty?" : "Disconnect PagerDuty?",
      isPresented: Binding(get: { pending != nil }, set: { if !$0 { pending = nil } })
    ) {
      Button("Cancel", role: .cancel) { pending = nil }
      Button(pending == true ? "Connect" : "Disconnect") {
        let value = pending ?? !isOn
        pending = nil
        model.setPagerDutyAgentConnection(target.agentId, enabled: value, for: app)
      }
    } message: {
      Text("This changes only the selected agent's bounded read-only PagerDuty access.")
    }
  }
}

func cloudflareConnectionIsReady(_ connection: MarketplaceProviderConnection) -> Bool {
  connection.appSlug == "cloudflare" && connection.status == .connected
    && connection.health.state == .ready
    && connection.grantedScopes == ProviderConnectionService.cloudflareReadScopes
    && connection.health.diagnostics["apiOrigin"]?.string
      == CloudflareProviderActionSupport.apiOrigin
    && connection.health.diagnostics["accountId"]?.string.map(
      CloudflareProviderActionSupport.safeId) == true
    && connection.health.diagnostics["zoneId"]?.string.map(CloudflareProviderActionSupport.safeId)
      == true
}
