import AppKit
import RelayConsoleCore
import SwiftUI
import UniformTypeIdentifiers

func marketplaceRequiredScopes(for app: MarketplaceCatalogApp) -> [String] {
  if marketplaceUsesSharedProviderPage(app) { return [] }
  if app.slug == "exa-search" {
    return ["x-api-key", "search", "contents"]
  }
  if app.slug == "x" {
    return ProviderConnectionService.xRelayOwnedOAuthScopes
  }
  if app.slug == "facebook-pages" {
    return ProviderConnectionService.facebookPagesRelayOwnedOAuthScopes
  }
  if app.slug == "linkedin" {
    return ProviderConnectionService.linkedInManualTokenScopes
  }
  if app.slug == "gmail" {
    return ProviderConnectionService.gmailOAuthScopes
  }
  if app.slug == "google-docs" {
    return ProviderConnectionService.googleDocsOAuthScopes
  }
  if app.slug == "google-calendar" {
    return ProviderConnectionService.googleCalendarOAuthScopes
  }
  if app.slug == "google-drive" {
    return ProviderConnectionService.googleDriveOAuthScopes
  }
  if app.slug == "google-search-console" {
    return ProviderConnectionService.googleSearchConsoleOAuthScopes
  }
  if app.slug == "google-analytics" {
    return ProviderConnectionService.googleAnalyticsOAuthScopes
  }
  if app.slug == "posthog" {
    return ProviderConnectionService.postHogReadScopes
  }
  if app.slug == "microsoft-clarity" {
    return ProviderConnectionService.microsoftClarityDataExportCapabilities
  }
  if app.slug == "telemetrydeck" {
    return ProviderConnectionService.telemetryDeckReadCapabilities
  }
  if app.slug == "sentry" {
    return ProviderConnectionService.sentryAuthTokenScopes
  }
  if app.slug == "notion" {
    return ProviderConnectionService.notionTokenCapabilities
  }
  if app.slug == "slack" {
    return ProviderConnectionService.slackRelayOwnedOAuthScopes
  }
  if app.slug == "github" {
    return ProviderConnectionService.githubRelayOwnedOAuthScopes
  }
  if app.slug == "gitlab" {
    return ProviderConnectionService.gitLabRelayOwnedOAuthScopes
  }
  if app.slug == "bitbucket" {
    return ProviderConnectionService.bitbucketRelayOwnedOAuthScopes
  }
  if app.slug == "linear" {
    return ProviderConnectionService.linearRelayOwnedOAuthScopes
  }
  if app.slug == "asana" {
    return ProviderConnectionService.asanaRelayOwnedOAuthScopes
  }
  if app.slug == "trello" { return ProviderConnectionService.trelloRelayOwnedPermissions }
  if app.slug == "clickup" { return ProviderConnectionService.clickUpRelayOwnedOAuthCapabilities }
  if app.slug == "monday-com" { return ProviderConnectionService.mondayRelayOwnedOAuthScopes }
  if app.slug == "airtable" { return ProviderConnectionService.airtableRelayOwnedOAuthScopes }
  return []
}

func marketplaceUsesSharedProviderPage(_ app: MarketplaceCatalogApp) -> Bool {
  app.roleManifest.roleDefinitions?.contains {
    $0.source.hasPrefix("shared-") || $0.source.hasPrefix("retained-")
  } == true
}

func marketplaceUsesConnectorOAuthPage(_ app: MarketplaceCatalogApp) -> Bool {
  let connectorOAuthTypes: Set<String> = ["oauth_connector", "oauth1_xauth"]
  let connectionTypes = Set((app.connectionTypes ?? []).map { $0.lowercased() })
  return !connectionTypes.isDisjoint(with: connectorOAuthTypes)
}

struct ApplicationsUniversalSavedConnectionsCard: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  let onEdit: (MarketplaceProviderConnection) -> Void

  private var savedConnections: [MarketplaceProviderConnection] {
    model.marketplaceConnections(for: app).sorted { $0.updatedAt > $1.updatedAt }
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 9) {
      Text("Saved connections")
        .font(.system(size: 13, weight: .bold))
      if savedConnections.isEmpty {
        Text("No saved connections yet.")
          .font(.system(size: 12, weight: .semibold))
          .foregroundStyle(RCTheme.muted)
      } else {
        ForEach(savedConnections) { connection in
          ApplicationsUniversalSavedConnectionRow(
            app: app,
            connection: connection,
            onEdit: { onEdit(connection) }
          )
        }
      }
    }
  }
}

struct ApplicationsUniversalSavedConnectionRow: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  let connection: MarketplaceProviderConnection
  let onEdit: () -> Void

  private var selected: Bool {
    model.selectedProviderConnection?.id == connection.id
  }

  private var ready: Bool {
    connection.status == .connected && connection.health.state == .ready
  }

  private var configuredCredentialLabels: [String] {
    connection.credentialRequirements
      .filter { $0.status == .verified || $0.status == .referenced }
      .map(\.label)
  }

  var body: some View {
    HStack(spacing: 8) {
      Button {
        model.selectSharedMarketplaceConnection(connection.id)
      } label: {
        HStack(spacing: 11) {
          ZStack {
            Circle()
              .stroke(selected ? RCTheme.accentBlue : RCTheme.borderStrong, lineWidth: 1.5)
              .frame(width: 17, height: 17)
            if selected {
              Circle()
                .fill(RCTheme.accentBlue)
                .frame(width: 8, height: 8)
            }
          }
          VStack(alignment: .leading, spacing: 3) {
            HStack(spacing: 7) {
              Text(connection.accountLabel?.nilIfEmpty ?? "\(app.name) connection")
                .font(.system(size: 12, weight: .bold))
                .lineLimit(1)
              if selected {
                Text("ACTIVE")
                  .font(.system(size: 8, weight: .bold))
                  .foregroundStyle(RCTheme.accentBlue)
              }
            }
            Text(
              configuredCredentialLabels.isEmpty
                ? "Credentials stored securely by Railway"
                : "\(configuredCredentialLabels.joined(separator: ", ")) configured"
            )
            .font(.system(size: 11, weight: .semibold))
            .foregroundStyle(RCTheme.muted)
            .lineLimit(1)
          }
          Spacer()
          HStack(spacing: 6) {
            Image(systemName: ready ? "checkmark.circle.fill" : "exclamationmark.triangle.fill")
            Text(ready ? "Connected" : connection.health.message)
              .lineLimit(1)
          }
          .font(.system(size: 11, weight: .semibold))
          .foregroundStyle(ready ? RCTheme.accentGreen : RCTheme.accentAmber)
        }
      }
      .buttonStyle(.plain)
      .disabled(!ready)
      Button("Edit", action: onEdit)
        .buttonStyle(SecondaryLightButtonStyle())
        .help("Edit this connection")
    }
    .padding(10)
    .background(selected ? RCTheme.accentBlue.opacity(0.08) : RCTheme.surfaceLevel2)
    .clipShape(RoundedRectangle(cornerRadius: 7))
    .overlay(
      RoundedRectangle(cornerRadius: 7)
        .stroke(selected ? RCTheme.accentBlue.opacity(0.45) : RCTheme.borderSoft)
    )
  }
}

struct ApplicationsProviderOAuthActions: View {
  @EnvironmentObject private var model: AppViewModel
  @State private var selectedAccessOptionId = ""
  @State private var disconnectRequested = false
  let app: MarketplaceCatalogApp
  let connection: MarketplaceProviderConnection?
  let disabled: Bool

  private var accessOptions: [MarketplaceOAuthAccessOption] {
    app.oauthAccessOptions ?? []
  }
  private var savedConnections: [MarketplaceProviderConnection] {
    model.marketplaceConnections(for: app)
  }
  private var selectedAccessOption: MarketplaceOAuthAccessOption? {
    if let selected = accessOptions.first(where: { $0.id == selectedAccessOptionId }) {
      return selected
    }
    if let connection,
      let matching = accessOptions.first(where: {
        Set($0.capabilityIds) == Set(connection.selectedCapabilities)
      })
    {
      return matching
    }
    return accessOptions.first(where: \.defaultSelected) ?? accessOptions.first
  }
  private var isBusy: Bool {
    model.busy == "start-provider-setup-\(app.slug)"
  }
  private var isDisconnecting: Bool {
    model.busy == "disconnect-provider-oauth-\(app.slug)"
  }
  private var isConnected: Bool {
    connection?.status == .connected && connection?.health.state == .ready
  }
  private var accountCreationURL: URL? {
    guard !isConnected,
      let rawURL = app.accountCreationURL,
      let url = URL(string: rawURL),
      url.scheme?.lowercased() == "https",
      url.host?.isEmpty == false
    else { return nil }
    return url
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      if !savedConnections.isEmpty {
        ApplicationsUniversalSavedConnectionsCard(app: app) { _ in
          model.startProviderSetup(for: app, accessOption: selectedAccessOption)
        }
      }

      if !isConnected, accessOptions.count > 1 {
        Picker(
          "Access",
          selection: Binding(
            get: { selectedAccessOption?.id ?? "" },
            set: { selectedAccessOptionId = $0 }
          )
        ) {
          ForEach(accessOptions) { option in
            Text(option.label).tag(option.id)
          }
        }
        .pickerStyle(.segmented)
        .frame(maxWidth: 420)

        if let selectedAccessOption {
          Text(selectedAccessOption.description)
            .font(.caption)
            .foregroundStyle(.secondary)
        }
      }

      HStack(spacing: 8) {
        if !isConnected {
          Button {
            model.startProviderSetup(for: app, accessOption: selectedAccessOption)
          } label: {
            if isBusy {
              HStack(spacing: 7) {
                ProgressView().controlSize(.small)
                Text("Waiting for \(app.name)…")
              }
            } else {
              Label("Connect \(app.name)", systemImage: "link")
            }
          }
          .buttonStyle(PrimaryLightButtonStyle())
          .disabled(disabled || model.busy != nil)
          .help("Connect \(app.name)")
          .accessibilityLabel(
            isBusy ? "Preparing secure \(app.name) sign-in" : "Connect \(app.name)"
          )
        }

        if isConnected {
          Button(role: .destructive) {
            disconnectRequested = true
          } label: {
            Label(
              isDisconnecting ? "Disconnecting \(app.name)…" : "Disconnect \(app.name)",
              systemImage: "xmark.circle"
            )
          }
          .buttonStyle(SecondaryLightButtonStyle())
          .disabled(disabled || model.busy != nil)
          .help("Disconnect \(app.name) and remove Relay's stored credentials")
          .accessibilityLabel("Disconnect \(app.name)")
        }

        if let accountCreationURL {
          Link(destination: accountCreationURL) {
            Label("Create a \(app.name) account", systemImage: "person.badge.plus")
          }
          .buttonStyle(SecondaryLightButtonStyle())
          .disabled(model.busy != nil)
          .help("Create a \(app.name) account")
          .accessibilityLabel("Create a \(app.name) account")
        }

        Spacer()
      }

      if isBusy {
        Text(
          model.marketplaceOAuthConnectionStatus?.nilIfEmpty
            ?? "Relay is asking \(app.name) to prepare secure sign-in. Your web browser will open automatically."
        )
        .font(.caption)
        .foregroundStyle(.secondary)
        .accessibilityAddTraits(.updatesFrequently)
      } else if let status = model.marketplaceOAuthConnectionStatus?.nilIfEmpty {
        Label(status, systemImage: "exclamationmark.triangle.fill")
          .font(.caption)
          .foregroundStyle(.red)
          .textSelection(.enabled)
      }
    }
    .confirmationDialog(
      "Disconnect \(app.name)?",
      isPresented: $disconnectRequested,
      titleVisibility: .visible
    ) {
      Button("Disconnect \(app.name)", role: .destructive) {
        guard let connection else { return }
        model.disconnectRailwayMarketplaceOAuthConnection(connection, for: app)
      }
      Button("Cancel", role: .cancel) {}
    } message: {
      Text(
        "Relay will revoke provider access when supported and remove its stored credentials. Agent assignments remain in place but cannot use \(app.name) until you connect again."
      )
    }
  }
}

struct ApplicationsSharedMarketplaceAgentsCard: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp

  private var connections: [MarketplaceProviderConnection] {
    model.marketplaceConnections(for: app)
  }
  private var selected: MarketplaceProviderConnection? {
    model.marketplaceConnection(for: app)
  }
  private var targets: [MarketplaceCompatibleAgentTarget] {
    let query = model.exaAgentSearch.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    return model.visibleMarketplaceCompatibleAgents
      .filter { app.runtimeSupport.contains($0.runtimeType) }
      .filter {
        query.isEmpty
          || [$0.agentName, exaRuntimeLabel($0.runtimeType)].joined(separator: " ").lowercased()
            .contains(query)
      }
      .sorted { $0.agentName.localizedCaseInsensitiveCompare($1.agentName) == .orderedAscending }
  }
  private func install(_ target: MarketplaceCompatibleAgentTarget) -> MarketplaceInstallRecord? {
    (model.exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == target.agentId && $0.appSlug == app.slug && exaInstallIsActive($0)
    }
  }

  var body: some View {
    ApplicationsExaPanel {
      ViewThatFits(in: .horizontal) {
        HStack(alignment: .top, spacing: 14) {
          heading
          Spacer()
          controls
        }
        VStack(alignment: .leading, spacing: 12) {
          heading
          controls
        }
      }
      if targets.isEmpty {
        EmptyMiniLight(
          title: "No compatible agents",
          body: "No Hermes or OpenClaw agents are currently available for this app.")
      } else {
        ApplicationsAgentGridScroll {
          ForEach(targets) { target in
            ApplicationsSharedMarketplaceAgentRow(
              app: app, target: target, install: install(target), selectedConnection: selected)
          }
        }
      }
      if let status = model.marketplaceAgentAssignmentStatus?.nilIfEmpty {
        Text(status)
          .font(.caption)
          .foregroundStyle(
            status.hasPrefix("Assignment failed:") ? RCTheme.accentRed : RCTheme.muted
          )
      }
    }
  }
  private var heading: some View {
    ApplicationsExaSectionHeading(
      icon: "person.2", title: "Agents with \(app.name)",
      subtitle: "Select which agents should use the active \(app.name) connection.")
  }
  private var controls: some View {
    HStack(spacing: 10) {
      Menu {
        ForEach(connections) { connection in
          Button(connection.accountLabel ?? connection.connectedHandle ?? "\(app.name) connection")
          { model.selectSharedMarketplaceConnection(connection.id) }
          .disabled(connection.status != .connected || connection.health.state != .ready)
        }
      } label: {
        HStack(spacing: 8) {
          Text(selected?.accountLabel ?? selected?.connectedHandle ?? "No connection selected")
            .lineLimit(1)
          Image(systemName: "chevron.down").font(.system(size: 10, weight: .bold))
        }
        .font(.system(size: 13, weight: .semibold)).padding(.horizontal, 12).frame(height: 36)
        .background(RCTheme.surfaceInset).clipShape(RoundedRectangle(cornerRadius: 7))
        .overlay(RoundedRectangle(cornerRadius: 7).stroke(RCTheme.borderSoft))
      }.menuStyle(.borderlessButton).disabled(connections.isEmpty)
      ApplicationsExaSearchField(text: $model.exaAgentSearch, placeholder: "Search agents...")
        .frame(width: 250)
    }
  }
}

struct ApplicationsSharedMarketplaceAgentRow: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  let target: MarketplaceCompatibleAgentTarget
  let install: MarketplaceInstallRecord?
  let selectedConnection: MarketplaceProviderConnection?

  private var isOn: Bool {
    guard let install, let selectedConnection else { return false }
    return install.connectionId == selectedConnection.id
  }
  private var ready: Bool {
    selectedConnection?.status == .connected && selectedConnection?.health.state == .ready
      && target.status == .compatible
  }
  var body: some View {
    VStack(alignment: .leading, spacing: 9) {
      HStack(spacing: 12) {
        AgentAvatarView(
          name: target.agentName, avatarURL: model.agentAvatar(target.agentId), size: 38)
        VStack(alignment: .leading, spacing: 3) {
          Text(target.agentName).font(.system(size: 13, weight: .semibold)).lineLimit(1)
          Text(
            target.status == .compatible
              ? exaRuntimeLabel(target.runtimeType) : (target.unavailableReason ?? "Unavailable")
          ).font(.system(size: 12, weight: .semibold)).foregroundStyle(RCTheme.muted)
        }
        Spacer()
        Button {
          model.setSharedMarketplaceAgentConnection(target.agentId, enabled: !isOn, for: app)
        } label: {
          ApplicationsExaSwitch(isOn: isOn)
        }.buttonStyle(.plain)
          .disabled(
            (!ready && !isOn) || model.providerConnectionSnapshot?.readOnly == true
              || app.availability != .available
              || model.busy == "toggle-shared-marketplace-agent-\(app.slug)-\(target.agentId)")
      }
      ApplicationsAgentAuthorityRow(
        app: app, install: install,
        selectedPreset: install.flatMap { model.marketplaceActionPolicyPreset(for: $0) }
          ?? .approvalRequired, muted: !isOn)
    }
    .padding(.horizontal, 12).padding(.vertical, 10).frame(minHeight: 86)
    .background(isOn ? RCTheme.sidebarSelected.opacity(0.48) : RCTheme.surfaceInset)
    .clipShape(RoundedRectangle(cornerRadius: 8)).overlay(
      RoundedRectangle(cornerRadius: 8).stroke(
        isOn ? RCTheme.accentGreen.opacity(0.35) : RCTheme.borderSoft)
    )
  }
}

struct ApplicationsProviderConnectionPanel: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp

  private var snapshot: ProviderConnectionSnapshot? {
    model.providerConnectionSnapshot
  }

  private var connection: MarketplaceProviderConnection? {
    model.marketplaceConnection(for: app)
  }

  private var latestFlow: ProviderAuthorizationFlow? {
    snapshot?.authorizationFlows.first
  }

  private var usesManifestCredentialForm: Bool {
    guard !(app.credentialRequirements ?? []).isEmpty else { return false }
    return !marketplaceUsesConnectorOAuthPage(app)
  }

  var body: some View {
    standardProviderPanel
  }

  private var standardProviderPanel: some View {
    let connectionReady = connection?.status == .connected && connection?.health.state == .ready
    return ApplicationsExaPanel {
      ApplicationsExaSectionHeading(
        icon: "key",
        title: "Manage Connection",
        subtitle: connectionReady
          ? "This account is ready for the agents selected above."
          : "Connect your \(app.name) account so selected agents can use it."
      )
      if connection != nil {
        HStack(alignment: .top, spacing: 12) {
          VStack(alignment: .leading, spacing: 5) {
            Text(
              connection?.accountLabel ?? connection?.connectedHandle
                ?? ProviderConnectionService.providerTitle(for: app, connection: connection)
            )
            .font(.system(size: 13, weight: .semibold))
          }
          Spacer()
          StatusBadge(
            title: ProviderConnectionService.providerStatusTitle(for: connection),
            tone: providerConnectionTone(connection),
            accessibilityLabelText: "Provider connection status"
          )
        }
      }

      if !usesManifestCredentialForm
        && !(marketplaceUsesSharedProviderPage(app) || marketplaceUsesConnectorOAuthPage(app))
        && !model.marketplaceConnections(for: app).isEmpty
      {
        ApplicationsUniversalSavedConnectionsCard(app: app) { _ in
          model.startProviderSetup(for: app)
        }
      }

      if usesManifestCredentialForm {
        ApplicationsManifestCredentialForm(app: app)
      }

      if !usesManifestCredentialForm
        && (marketplaceUsesSharedProviderPage(app) || marketplaceUsesConnectorOAuthPage(app))
      {
        ApplicationsProviderOAuthActions(
          app: app,
          connection: connection,
          disabled: snapshot?.readOnly == true || app.availability != .available
        )
      } else if !usesManifestCredentialForm
        && !marketplaceUsesSharedProviderPage(app)
      {
        HStack(spacing: 8) {
          Button {
            model.startProviderSetup(for: app)
          } label: {
            Label(
              connection == nil ? "Connect \(app.name)" : "Review \(app.name) connection",
              systemImage: "person.badge.key"
            )
          }
          .buttonStyle(PrimaryLightButtonStyle())
          .disabled(snapshot?.readOnly == true || app.availability != .available)
          .help("Configure \(app.name) connection")
          .accessibilityLabel("Configure \(app.name) connection")

          Button {
          } label: {
            Label("Re-authorize", systemImage: "arrow.triangle.2.circlepath")
          }
          .buttonStyle(SecondaryLightButtonStyle())
          .disabled(true)
          .help("Re-authorize")
          .accessibilityLabel("Re-authorize provider")

          Button {
          } label: {
            Label("Disconnect", systemImage: "xmark.circle")
          }
          .buttonStyle(SecondaryLightButtonStyle())
          .disabled(true)
          .help("Disconnect")
          .accessibilityLabel("Disconnect provider")

          if let helper = ProviderConnectionService.missingFieldHelper(
            for: app, connection: connection)
          {
            Text(helper)
              .font(.caption)
              .foregroundStyle(RCTheme.accentAmber)
          }
          Spacer()
        }

        Text(
          snapshot?.diagnostics.message
            ?? "Connection status will appear here once the provider is configured."
        )
        .font(.caption)
        .foregroundStyle(RCTheme.muted)
        if let note = latestFlow?.manualEvidenceNote?.nilIfEmpty {
          Text(note)
            .font(.caption)
            .foregroundStyle(RCTheme.accentAmber)
        }
        ProviderConnectionAdvancedDetails(app: app, connection: connection, latestFlow: latestFlow)
      }
    }
  }
}

struct ApplicationsManifestCredentialForm: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  @State private var displayName: String
  @State private var authType: String
  @State private var credentials: [String: String] = [:]
  @State private var editingConnectionId: RelayId?

  init(app: MarketplaceCatalogApp) {
    self.app = app
    _displayName = State(initialValue: app.name)
    _authType = State(initialValue: app.connectionTypes?.first ?? app.authType)
    _credentials = State(
      initialValue: Dictionary(
        uniqueKeysWithValues: (app.credentialRequirements ?? []).compactMap { requirement in
          guard let defaultValue = requirement.defaultValue else { return nil }
          return (requirement.name, defaultValue)
        }
      )
    )
  }

  private var requirements: [MarketplaceCatalogCredentialRequirement] {
    (app.credentialRequirements ?? []).filter { requirement in
      requirement.requiredForAuthTypes == nil
        || requirement.requiredForAuthTypes?.contains(authType) == true
    }
  }

  private var canSave: Bool {
    requirements.allSatisfy { requirement in
      !requirement.required
        || !(credentials[requirement.name] ?? "")
          .trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }
  }

  private var saveInProgress: Bool {
    model.busy == "connect-manifest-provider-\(app.slug)"
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      ApplicationsUniversalSavedConnectionsCard(app: app) { connection in
        editingConnectionId = connection.id
        displayName = connection.accountLabel?.nilIfEmpty ?? app.name
        credentials = Dictionary(
          uniqueKeysWithValues: (app.credentialRequirements ?? []).compactMap { requirement in
            guard let defaultValue = requirement.defaultValue else { return nil }
            return (requirement.name, defaultValue)
          }
        )
      }
      Divider()
      ApplicationsConnectionFormGrid {
        ApplicationsExaInput(
          label: "Connection name",
          placeholder: app.name,
          text: $displayName,
          secure: false
        )
        if let connectionTypes = app.connectionTypes, connectionTypes.count > 1 {
          VStack(alignment: .leading, spacing: 6) {
            Text("Authentication")
              .font(.system(size: 11, weight: .bold))
              .foregroundStyle(RCTheme.muted)
            Picker("Authentication", selection: $authType) {
              ForEach(connectionTypes, id: \.self) { type in
                Text(type.replacingOccurrences(of: "_", with: " ").capitalized)
                  .tag(type)
              }
            }
            .labelsHidden()
          }
        }
        ForEach(requirements) { requirement in
          if requirement.inputType == "select",
            let options = requirement.options,
            !options.isEmpty
          {
            VStack(alignment: .leading, spacing: 6) {
              Text(requirement.label + (requirement.required ? "" : " (optional)"))
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(RCTheme.muted)
              Picker(requirement.label, selection: credentialBinding(requirement.name)) {
                ForEach(options, id: \.value) { option in
                  Text(option.label).tag(option.value)
                }
              }
              .labelsHidden()
              .frame(maxWidth: .infinity, alignment: .leading)
            }
          } else {
            ApplicationsExaInput(
              label: requirement.label + (requirement.required ? "" : " (optional)"),
              placeholder: requirement.secret ? "••••••••••••" : requirement.label,
              text: credentialBinding(requirement.name),
              secure: requirement.secret
            )
          }
        }
      }
      ForEach(requirements.filter { !$0.helpText.isEmpty }) { requirement in
        HStack(alignment: .top, spacing: 7) {
          Image(systemName: "info.circle")
          Text("\(requirement.label): \(requirement.helpText)")
        }
        .font(.system(size: 11, weight: .semibold))
        .foregroundStyle(RCTheme.muted)
      }
      Button {
        model.saveManifestDefinedConnection(
          for: app,
          connectionId: editingConnectionId,
          displayName: displayName,
          authType: authType,
          credentials: credentials
        )
      } label: {
        HStack(spacing: 8) {
          if saveInProgress {
            ProgressView()
              .controlSize(.small)
          }
          Text(
            saveInProgress
              ? "Saving connection…"
              : editingConnectionId == nil ? "Save connection" : "Update connection"
          )
        }
      }
      .buttonStyle(PrimaryLightButtonStyle())
      .disabled(
        !canSave
          || saveInProgress
          || model.providerConnectionSnapshot?.readOnly == true
          || app.availability != .available
      )
      if let status = model.marketplaceManifestConnectionStatus?.nilIfEmpty {
        Text(status)
          .font(.caption)
          .foregroundStyle(
            status.hasPrefix("Connection failed:") ? RCTheme.accentRed : RCTheme.muted
          )
      }
      HStack(spacing: 7) {
        Image(systemName: "lock")
        Text(
          "Credentials are sent only to the authenticated Railway broker and stored as encrypted secret references."
        )
      }
      .font(.system(size: 11, weight: .semibold))
      .foregroundStyle(RCTheme.muted)
    }
    .padding(16)
    .background(RCTheme.surfaceInset)
    .clipShape(RoundedRectangle(cornerRadius: 8))
    .overlay(RoundedRectangle(cornerRadius: 8).stroke(RCTheme.borderSoft))
    .task(id: app.slug) {
      await model.loadManifestDefinedConnections(for: app)
    }
  }

  private func credentialBinding(_ name: String) -> Binding<String> {
    Binding(
      get: { credentials[name] ?? "" },
      set: { credentials[name] = $0 }
    )
  }
}

struct ApplicationsPayPalCredentialForm: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      TextField("PayPal REST app client ID", text: $model.paypalClientIdDraft)
        .textFieldStyle(.roundedBorder)
      SecureField("PayPal REST app secret", text: $model.paypalClientSecretDraft)
        .textFieldStyle(.roundedBorder)
      Picker("Account", selection: $model.paypalEnvironmentDraft) {
        Text("Sandbox").tag("sandbox")
        Text("Live").tag("live")
      }
      .pickerStyle(.segmented)
      Text(
        "Use credentials from a REST app in your PayPal business account. Sandbox is recommended until you have tested the connection."
      )
      .font(.caption)
      .foregroundStyle(RCTheme.muted)
      Button("Connect PayPal") { model.savePayPalRailwayConnection(for: app) }
        .buttonStyle(PrimaryLightButtonStyle())
      if let status = model.paypalConnectionStatus?.nilIfEmpty {
        Text(status).font(.caption).foregroundStyle(RCTheme.muted)
      }
    }
  }
}

struct ApplicationsMailgunCredentialForm: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      SecureField("API key", text: $model.mailgunAPIKeyDraft)
        .textFieldStyle(.roundedBorder)
      TextField("Your Mailgun domain (for example mg.example.com)", text: $model.mailgunDomainDraft)
        .textFieldStyle(.roundedBorder)
      DisclosureGroup("More options") {
        VStack(alignment: .leading, spacing: 8) {
          Picker("Region", selection: $model.mailgunRegionDraft) {
            Text("US").tag("US")
            Text("EU").tag("EU")
          }
          .pickerStyle(.segmented)
          Picker("API key access", selection: $model.mailgunKeyTypeDraft) {
            Text("Full account access").tag("account")
            Text("Send from this domain only").tag("domain_sending")
          }
          .pickerStyle(.segmented)
        }
      }
      Button("Connect Mailgun") {
        model.saveMailgunRailwayConnection(for: app)
      }
      .buttonStyle(PrimaryLightButtonStyle())
      if let status = model.mailgunConnectionStatus?.nilIfEmpty {
        Text(status).font(.caption).foregroundStyle(RCTheme.muted)
      }
    }
  }
}

struct ApplicationsSendGridCredentialForm: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp
  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      SecureField("API key", text: $model.sendGridAPIKeyDraft).textFieldStyle(.roundedBorder)
      TextField("Your sender email or domain", text: $model.sendGridSenderBoundaryDraft)
        .textFieldStyle(.roundedBorder)
      DisclosureGroup("More options") {
        Picker("Account region", selection: $model.sendGridRegionDraft) {
          Text("Global").tag("GLOBAL")
          Text("EU").tag("EU")
        }.pickerStyle(.segmented)
      }
      Button("Connect SendGrid") { model.saveSendGridRailwayConnection(for: app) }.buttonStyle(
        PrimaryLightButtonStyle())
      if let status = model.sendGridConnectionStatus?.nilIfEmpty {
        Text(status).font(.caption).foregroundStyle(RCTheme.muted)
      }
    }
  }
}

struct ApplicationsPostmarkCredentialForm: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp
  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      SecureField("Server token", text: $model.postmarkServerTokenDraft).textFieldStyle(
        .roundedBorder)
      TextField("Your sender email or domain", text: $model.postmarkSenderBoundaryDraft)
        .textFieldStyle(.roundedBorder)
      DisclosureGroup("More options") {
        VStack(alignment: .leading, spacing: 8) {
          SecureField("Account token (optional)", text: $model.postmarkAccountTokenDraft)
            .textFieldStyle(.roundedBorder)
          TextField("Message stream", text: $model.postmarkMessageStreamDraft).textFieldStyle(
            .roundedBorder)
        }
      }
      Button("Connect Postmark") { model.savePostmarkRailwayConnection(for: app) }.buttonStyle(
        PrimaryLightButtonStyle())
      if let status = model.postmarkConnectionStatus?.nilIfEmpty {
        Text(status).font(.caption).foregroundStyle(RCTheme.muted)
      }
    }
  }
}

struct ApplicationsResendCredentialForm: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp
  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      SecureField("API key", text: $model.resendAPITokenDraft).textFieldStyle(.roundedBorder)
      TextField("Your sender domain", text: $model.resendDomainDraft).textFieldStyle(.roundedBorder)
      DisclosureGroup("More options") {
        Picker("API key access", selection: $model.resendKeyPermissionDraft) {
          Text("Sending only").tag("SENDING")
          Text("Full account access").tag("FULL")
        }.pickerStyle(.segmented)
      }
      Button("Connect Resend") { model.saveResendRailwayConnection(for: app) }.buttonStyle(
        PrimaryLightButtonStyle())
      if let status = model.resendConnectionStatus?.nilIfEmpty {
        Text(status).font(.caption).foregroundStyle(RCTheme.muted)
      }
    }
  }
}

struct ApplicationsSparkPostCredentialForm: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp
  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      SecureField("API key", text: $model.sparkPostAPIKeyDraft).textFieldStyle(.roundedBorder)
      TextField("Your sender domain", text: $model.sparkPostSenderDomainDraft).textFieldStyle(
        .roundedBorder)
      DisclosureGroup("More options") {
        VStack(alignment: .leading, spacing: 8) {
          Picker("Account region", selection: $model.sparkPostRegionDraft) {
            Text("US").tag("US")
            Text("EU").tag("EU")
          }.pickerStyle(.segmented)
          TextField("Subaccount ID (optional)", text: $model.sparkPostSubaccountDraft)
            .textFieldStyle(.roundedBorder)
        }
      }
      Button("Connect SparkPost") { model.saveSparkPostRailwayConnection(for: app) }.buttonStyle(
        PrimaryLightButtonStyle())
      if let status = model.sparkPostConnectionStatus?.nilIfEmpty {
        Text(status).font(.caption).foregroundStyle(RCTheme.muted)
      }
    }
  }
}

struct ApplicationsBrevoCredentialForm: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp
  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      SecureField("Brevo API key", text: $model.brevoAPIKeyDraft).textFieldStyle(.roundedBorder)
      TextField(
        "Registered sender email or authenticated domain", text: $model.brevoSenderBoundaryDraft
      ).textFieldStyle(.roundedBorder)
      Button("Connect Brevo") { model.saveBrevoRailwayConnection(for: app) }.buttonStyle(
        PrimaryLightButtonStyle())
      if let status = model.brevoConnectionStatus?.nilIfEmpty {
        Text(status).font(.caption).foregroundStyle(RCTheme.muted)
      }
    }
  }
}
struct ApplicationsMailjetCredentialForm: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp
  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      SecureField("Mailjet API Key", text: $model.mailjetAPIKeyDraft).textFieldStyle(.roundedBorder)
      SecureField("Mailjet Secret Key", text: $model.mailjetSecretKeyDraft).textFieldStyle(
        .roundedBorder)
      TextField("Verified sender email or domain", text: $model.mailjetSenderBoundaryDraft)
        .textFieldStyle(.roundedBorder)
      Button("Connect Sinch Mailjet") { model.saveMailjetRailwayConnection(for: app) }.buttonStyle(
        PrimaryLightButtonStyle())
      if let status = model.mailjetConnectionStatus?.nilIfEmpty {
        Text(status).font(.caption).foregroundStyle(RCTheme.muted)
      }
    }
  }
}

struct ApplicationsFuseBaseCredentialForm: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp
  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      SecureField("FuseBase MCP URL", text: $model.fuseBaseMCPURLDraft).textFieldStyle(
        .roundedBorder)
      SecureField("FuseBase MCP token", text: $model.fuseBaseMCPTokenDraft).textFieldStyle(
        .roundedBorder)
      Button("Connect FuseBase") { model.saveFuseBaseRailwayConnection(for: app) }.buttonStyle(
        PrimaryLightButtonStyle())
      if let status = model.fuseBaseConnectionStatus?.nilIfEmpty {
        Text(status).font(.caption).foregroundStyle(RCTheme.muted)
      }
    }
  }
}

struct ApplicationsMemCredentialForm: View {
  @EnvironmentObject var model: AppViewModel
  let app: MarketplaceCatalogApp
  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      SecureField("Mem API key", text: $model.memAPIKeyDraft).textFieldStyle(.roundedBorder)
      Button("Connect Mem") { model.saveMemRailwayConnection(for: app) }.buttonStyle(
        PrimaryLightButtonStyle())
      if let status = model.memConnectionStatus?.nilIfEmpty {
        Text(status).font(.caption).foregroundStyle(RCTheme.muted)
      }
    }
  }
}

struct ApplicationsReadwiseCredentialForm: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      SecureField("Readwise access token", text: $model.readwiseAccessTokenDraft).textFieldStyle(
        .roundedBorder)
      Button("Connect Readwise") { model.saveReadwiseRailwayConnection(for: app) }.buttonStyle(
        PrimaryLightButtonStyle())
      if let status = model.readwiseConnectionStatus?.nilIfEmpty {
        Text(status).font(.caption).foregroundStyle(RCTheme.muted)
      }
      Link(
        "Create token in Readwise", destination: URL(string: "https://readwise.io/access_token")!)
    }
  }
}

struct ApplicationsInstapaperCredentialForm: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      TextField("Instapaper email or username", text: $model.instapaperUsernameDraft)
        .textFieldStyle(.roundedBorder)
      SecureField("Password, if the account has one", text: $model.instapaperPasswordDraft)
        .textFieldStyle(.roundedBorder)
      SecureField(
        "Optional customer-owned Instaparser API key", text: $model.instaparserAPIKeyDraft
      ).textFieldStyle(.roundedBorder)
      Text(
        "Your password is used once to connect and is not saved. The optional Instaparser key enables article text extraction."
      ).font(.caption).foregroundStyle(RCTheme.muted)
      Button("Connect Instapaper") { model.connectInstapaperXAuth(for: app) }.buttonStyle(
        PrimaryLightButtonStyle())
      if let status = model.instapaperConnectionStatus?.nilIfEmpty {
        Text(status).font(.caption).foregroundStyle(RCTheme.muted)
      }
    }
  }
}

struct ApplicationsFeedlyCredentialForm: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      SecureField("Feedly Enterprise API access token", text: $model.feedlyAccessTokenDraft)
        .textFieldStyle(.roundedBorder)
      Text("Feedly Enterprise with API access is required. Your team admin can create this token.")
        .font(.caption).foregroundStyle(RCTheme.muted)
      Button("Connect Feedly") { model.saveFeedlyRailwayConnection(for: app) }.buttonStyle(
        PrimaryLightButtonStyle())
      if let status = model.feedlyConnectionStatus?.nilIfEmpty {
        Text(status).font(.caption).foregroundStyle(RCTheme.muted)
      }
      Link(
        "Open Feedly API self-service", destination: URL(string: "https://feedly.com/i/team/api")!)
    }
  }
}

struct ApplicationsReadMeCredentialForm: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      SecureField("ReadMe project API key", text: $model.readMeAPIKeyDraft).textFieldStyle(
        .roundedBorder)
      Text("Find this in ReadMe under Configuration → API Keys.").font(.caption).foregroundStyle(
        RCTheme.muted)
      Button("Connect ReadMe") { model.saveReadMeRailwayConnection(for: app) }.buttonStyle(
        PrimaryLightButtonStyle())
      if let status = model.readMeConnectionStatus?.nilIfEmpty {
        Text(status).font(.caption).foregroundStyle(RCTheme.muted)
      }
      Link("Open ReadMe dashboard", destination: URL(string: "https://dash.readme.com/")!)
    }
  }
}

struct ApplicationsDocument360CredentialForm: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      SecureField("Document360 project API token", text: $model.document360APITokenDraft)
        .textFieldStyle(.roundedBorder)
      TextField("Document360 API address", text: $model.document360APIOriginDraft).textFieldStyle(
        .roundedBorder)
      Text("Find these in Document360 under Settings → Knowledge base portal → API tokens.").font(
        .caption
      ).foregroundStyle(RCTheme.muted)
      Button("Connect Document360") { model.saveDocument360RailwayConnection(for: app) }
        .buttonStyle(PrimaryLightButtonStyle())
      if let status = model.document360ConnectionStatus?.nilIfEmpty {
        Text(status).font(.caption).foregroundStyle(RCTheme.muted)
      }
      Link("Open Document360", destination: URL(string: "https://app.document360.com/")!)
    }
  }
}

struct ApplicationsArchbeeCredentialForm: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      TextField("Archbee DocSpace ID", text: $model.archbeeDocSpaceIDDraft).textFieldStyle(
        .roundedBorder)
      SecureField("Archbee API key", text: $model.archbeeAPIKeyDraft).textFieldStyle(.roundedBorder)
      Text("Copy both from your Archbee workspace settings.").font(.caption).foregroundStyle(
        RCTheme.muted)
      Button("Connect Archbee") { model.saveArchbeeRailwayConnection(for: app) }.buttonStyle(
        PrimaryLightButtonStyle())
      if let status = model.archbeeConnectionStatus?.nilIfEmpty {
        Text(status).font(.caption).foregroundStyle(RCTheme.muted)
      }
      Link("Open Archbee", destination: URL(string: "https://app.archbee.com/")!)
    }
  }
}

struct ApplicationsTettraCredentialForm: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      TextField("Tettra numeric team ID", text: $model.tettraTeamIDDraft).textFieldStyle(
        .roundedBorder)
      SecureField("Tettra API key", text: $model.tettraAPIKeyDraft).textFieldStyle(.roundedBorder)
      Text("Find these in Tettra under My settings.").font(.caption).foregroundStyle(RCTheme.muted)
      Button("Connect Tettra") { model.saveTettraRailwayConnection(for: app) }.buttonStyle(
        PrimaryLightButtonStyle())
      if let status = model.tettraConnectionStatus?.nilIfEmpty {
        Text(status).font(.caption).foregroundStyle(RCTheme.muted)
      }
      Link("Open Tettra", destination: URL(string: "https://app.tettra.co/")!)
    }
  }
}

struct ApplicationsKnowledgeOwlCredentialForm: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      TextField("Knowledge base ID", text: $model.knowledgeOwlProjectIDDraft).textFieldStyle(
        .roundedBorder)
      SecureField("API key", text: $model.knowledgeOwlAPIKeyDraft).textFieldStyle(.roundedBorder)
      Text("Find both in KnowledgeOwl under Account → API.").font(.caption).foregroundStyle(
        RCTheme.muted)
      Button("Connect KnowledgeOwl") { model.saveKnowledgeOwlRailwayConnection(for: app) }
        .buttonStyle(PrimaryLightButtonStyle())
      if let status = model.knowledgeOwlConnectionStatus?.nilIfEmpty {
        Text(status).font(.caption).foregroundStyle(RCTheme.muted)
      }
      Link("Open KnowledgeOwl", destination: URL(string: "https://app.knowledgeowl.com/")!)
    }
  }
}

struct ApplicationsFreshdeskCredentialForm: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      TextField("Your Freshdesk domain", text: $model.freshdeskDomainDraft).textFieldStyle(
        .roundedBorder)
      SecureField("Your Freshdesk API key", text: $model.freshdeskAPIKeyDraft).textFieldStyle(
        .roundedBorder)
      Text(
        "Use the account name before .freshdesk.com and the API key from your Freshdesk profile."
      ).font(.caption).foregroundStyle(RCTheme.muted)
      Button("Connect Freshdesk") { model.saveFreshdeskConnection(for: app) }.buttonStyle(
        PrimaryLightButtonStyle())
      if let status = model.freshdeskConnectionStatus?.nilIfEmpty {
        Text(status).font(.caption).foregroundStyle(RCTheme.muted)
      }
      Link(
        "Open Freshdesk help",
        destination: URL(
          string:
            "https://support.freshdesk.com/support/solutions/articles/215517-how-to-find-your-api-key-"
        )!)
    }
  }
}

struct ApplicationsSanityCredentialForm: View {
  @EnvironmentObject private var model: AppViewModel
  let app: MarketplaceCatalogApp
  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      TextField("Project ID", text: $model.sanityProjectIDDraft).textFieldStyle(.roundedBorder)
      TextField("Dataset", text: $model.sanityDatasetDraft).textFieldStyle(.roundedBorder)
      SecureField("Robot token", text: $model.sanityAPITokenDraft).textFieldStyle(.roundedBorder)
      Text("Create a dedicated robot token in Sanity project Settings → API → Tokens.")
        .font(.caption).foregroundStyle(RCTheme.muted)
      Button("Connect Sanity") { model.saveSanityRailwayConnection(for: app) }
        .buttonStyle(PrimaryLightButtonStyle())
      if let status = model.sanityConnectionStatus?.nilIfEmpty {
        Text(status).font(.caption).foregroundStyle(RCTheme.muted)
      }
      Link("Open Sanity", destination: URL(string: "https://www.sanity.io/manage")!)
    }
  }
}
