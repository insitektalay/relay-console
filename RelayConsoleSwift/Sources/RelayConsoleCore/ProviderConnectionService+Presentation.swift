import Foundation

extension ProviderConnectionService {
  public func snapshot(
    context: ServiceRequestContext,
    appIdOrSlug: RelayId? = nil,
    selectedConnectionId: RelayId? = nil,
    now: Date = Date()
  ) throws -> ProviderConnectionSnapshot {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin, .member], context: context) {
      throw denied
    }
    let app = try appIdOrSlug.flatMap {
      try requireProviderApp(context: context, appIdOrSlug: $0, fallbackSlug: nil)
    }
    let readOnly = !context.hasAnyRole([.owner, .admin])
    let connections = try data.listProviderConnections(
      workspaceId: context.workspaceId, appId: app?.id)
    let flows = try data.listProviderAuthorizationFlows(
      workspaceId: context.workspaceId, appId: app?.id)
    let selected =
      selectedConnectionId.flatMap { id in
        connections.first { $0.id == id || $0.providerKey == id }
      } ?? connections.first
    let state: ProviderConnectionSnapshotState
    if let app, app.availability != .available {
      state = .unavailable
    } else if readOnly, !connections.isEmpty {
      state = .readOnly
    } else if connections.isEmpty {
      state = .empty
    } else {
      state = .ready
    }
    let snapshot = ProviderConnectionSnapshot(
      workspaceId: context.workspaceId,
      appId: app?.id,
      appSlug: app?.slug,
      state: state,
      refreshedAt: ISO8601DateFormatter.relayConsole.string(from: now),
      connections: connections,
      authorizationFlows: flows,
      selectedConnection: selected,
      diagnostics: Self.diagnostics(app: app, connections: connections, flows: flows, state: state),
      readOnly: readOnly,
      redactionStatus: "private-state-excluded"
    )
    return try data.saveProviderConnectionSnapshot(snapshot)
  }

  public func latestSnapshot(context: ServiceRequestContext, appId: RelayId? = nil) throws
    -> ProviderConnectionSnapshot?
  {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin, .member], context: context) {
      throw denied
    }
    return try data.latestProviderConnectionSnapshot(workspaceId: context.workspaceId, appId: appId)
  }

  public static func providerTitle(
    for app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection?
  ) -> String {
    if isXProvider(app: app, connection: connection) {
      return "X connection"
    }
    if isGmailProvider(app: app, connection: connection) {
      return "Gmail connection"
    }
    if isGoogleDocsProvider(app: app, connection: connection) {
      return "Google Docs connection"
    }
    if isGoogleDriveProvider(app: app, connection: connection) {
      return "Google Drive connection"
    }
    if isGoogleSheetsProvider(app: app, connection: connection) {
      return "Google Sheets connection"
    }
    if isGoogleSearchConsoleProvider(app: app, connection: connection) {
      return "Google Search Console connection"
    }
    if Self.isSlackProvider(app: app, connection: connection) {
      return "Slack connection"
    }
    if isGoogleCalendarProvider(app: app, connection: connection) {
      return "Google Calendar connection"
    }
    if Self.isPostHogProvider(app: app, connection: connection) {
      return "PostHog connection"
    }
    if Self.isSentryProvider(app: app, connection: connection) {
      return "Sentry connection"
    }
    if isNotionProvider(app: app, connection: connection) {
      return "Notion connection"
    }
    if isMicrosoftClarityProvider(app: app, connection: connection) {
      return "Microsoft Clarity connection"
    }
    if Self.isTelemetryDeckProvider(app: app, connection: connection) {
      return "TelemetryDeck connection"
    }
    return "\(app.name) connector"
  }

  public static func providerStatusTitle(for connection: MarketplaceProviderConnection?) -> String {
    guard let connection else { return "Not connected" }
    switch connection.status {
    case .connected:
      return connection.health.state == .ready ? "Ready" : "Connected"
    case .validating:
      return "Validating"
    case .expired:
      return "Expired"
    case .authRequired:
      return "Auth required"
    case .healthError:
      return "Health error"
    case .senderInvalid:
      return "Sender invalid"
    case .disconnecting:
      return "Disconnecting"
    case .reauthorizeRequired:
      return "Re-authorize"
    case .unavailable:
      return "Unavailable"
    case .disconnected:
      return "Not connected"
    }
  }

  public static func actionTitle(
    for app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection?, readOnly: Bool
  ) -> String {
    if readOnly { return "View connection" }
    guard app.availability == .available else { return "Unavailable" }
    guard let connection else {
      if isLinkedInProvider(app: app, connection: nil) {
        return "Save LinkedIn token"
      }
      if isGmailProvider(app: app, connection: nil) {
        return "Save Gmail OAuth"
      }
      if isGoogleDocsProvider(app: app, connection: nil) {
        return "Connect Google Docs"
      }
      if isGoogleDriveProvider(app: app, connection: nil) {
        return "Connect Google Drive"
      }
      if isGoogleSheetsProvider(app: app, connection: nil) {
        return "Connect Google Sheets"
      }
      if isGoogleSearchConsoleProvider(app: app, connection: nil) {
        return "Save Search Console OAuth"
      }
      if Self.isSlackProvider(app: app, connection: nil) {
        return "Connect Slack"
      }
      if isGoogleCalendarProvider(app: app, connection: nil) {
        return "Save Calendar OAuth"
      }
      if Self.isPostHogProvider(app: app, connection: nil) {
        return "Save PostHog key"
      }
      if Self.isSentryProvider(app: app, connection: nil) {
        return "Save Sentry token"
      }
      if isNotionProvider(app: app, connection: nil) {
        return "Save Notion token"
      }
      if isMicrosoftClarityProvider(app: app, connection: nil) {
        return "Save Clarity token"
      }
      if Self.isTelemetryDeckProvider(app: app, connection: nil) {
        return "Save TelemetryDeck PAT"
      }
      return isXProvider(app: app, connection: nil)
        ? "Connect X" : "Authorize \(app.name)"
    }
    switch connection.status {
    case .connected, .healthError, .senderInvalid, .expired, .reauthorizeRequired:
      if isLinkedInProvider(app: app, connection: connection) {
        return "Review LinkedIn token"
      }
      if isGmailProvider(app: app, connection: connection) {
        return "Review Gmail OAuth"
      }
      if isGoogleDocsProvider(app: app, connection: connection) {
        return "Reconnect Google Docs"
      }
      if isGoogleDriveProvider(app: app, connection: connection) {
        return "Reconnect Google Drive"
      }
      if isGoogleSheetsProvider(app: app, connection: connection) {
        return "Reconnect Google Sheets"
      }
      if isGoogleSearchConsoleProvider(app: app, connection: connection) {
        return "Review Search Console OAuth"
      }
      if Self.isSlackProvider(app: app, connection: connection) {
        return "Reconnect Slack"
      }
      if isGoogleCalendarProvider(app: app, connection: connection) {
        return "Review Calendar OAuth"
      }
      if Self.isPostHogProvider(app: app, connection: connection) {
        return "Review PostHog key"
      }
      if Self.isSentryProvider(app: app, connection: connection) {
        return "Review Sentry token"
      }
      if isNotionProvider(app: app, connection: connection) {
        return "Review Notion token"
      }
      if isMicrosoftClarityProvider(app: app, connection: connection) {
        return "Review Clarity token"
      }
      if Self.isTelemetryDeckProvider(app: app, connection: connection) {
        return "Review TelemetryDeck PAT"
      }
      return isXProvider(app: app, connection: connection)
        ? "Reconnect X" : "Re-authorize"
    case .disconnecting:
      return "Disconnect"
    case .validating:
      return "Starting authorization..."
    case .authRequired, .disconnected:
      if isLinkedInProvider(app: app, connection: connection) {
        return "Save LinkedIn token"
      }
      if isGmailProvider(app: app, connection: connection) {
        return "Save Gmail OAuth"
      }
      if isGoogleDocsProvider(app: app, connection: connection) {
        return "Connect Google Docs"
      }
      if isGoogleDriveProvider(app: app, connection: connection) {
        return "Connect Google Drive"
      }
      if isGoogleSheetsProvider(app: app, connection: connection) {
        return "Connect Google Sheets"
      }
      if isGoogleSearchConsoleProvider(app: app, connection: connection) {
        return "Save Search Console OAuth"
      }
      if Self.isSlackProvider(app: app, connection: connection) {
        return "Connect Slack"
      }
      if isGoogleCalendarProvider(app: app, connection: connection) {
        return "Save Calendar OAuth"
      }
      if Self.isPostHogProvider(app: app, connection: connection) {
        return "Save PostHog key"
      }
      if Self.isSentryProvider(app: app, connection: connection) {
        return "Save Sentry token"
      }
      if isNotionProvider(app: app, connection: connection) {
        return "Save Notion token"
      }
      if isMicrosoftClarityProvider(app: app, connection: connection) {
        return "Save Clarity token"
      }
      if Self.isTelemetryDeckProvider(app: app, connection: connection) {
        return "Save TelemetryDeck PAT"
      }
      return isXProvider(app: app, connection: connection)
        ? "Connect X" : "Authorize \(app.name)"
    case .unavailable:
      return "Unavailable"
    }
  }

  public static func connectionSummary(
    for app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection?
  ) -> String {
    if app.roleManifest.roleDefinitions?.contains(where: { $0.source.hasPrefix("shared-") }) == true
    {
      return connection == nil
        ? "Configure the provider-specific \(app.authType) connection in Railway before assigning agents."
        : "Railway is the source of truth for this \(app.name) connection, its health, policy, and agent assignments."
    }
    if isXProvider(app: app, connection: connection) {
      return connection == nil
        ? "Connect X through Relay-owned OAuth 2.0 PKCE before agents can use bounded X tools."
        : "X OAuth tokens are stored as separate Keychain references. Reads are bounded and plain-text publishing remains approval-controlled."
    }
    if isMicrosoftClarityProvider(app: app, connection: connection) {
      return connection == nil
        ? "Paste a user-owned Microsoft Clarity Data Export API token before agents can read bounded project insights."
        : "Microsoft Clarity token is stored as a Keychain reference. Agents use read-only Relay wrapper tools; checks and live reads may consume Clarity's daily export quota."
    }
    if Self.isTelemetryDeckProvider(app: app, connection: connection) {
      return connection == nil
        ? "Paste a user-owned TelemetryDeck Personal Access Token, namespace, and app ID before agents can read bounded analytics."
        : "TelemetryDeck PAT is stored as a Keychain reference. Agents use read-only Relay wrapper tools for bounded TQL and saved-insight reads."
    }
    if Self.isPostHogProvider(app: app, connection: connection) {
      return connection == nil
        ? "Connect PostHog through Relay-owned OAuth and select the correct Cloud API region before agents can read bounded product analytics context."
        : "PostHog OAuth tokens are stored as separate Keychain references. Agents use read-only Relay wrapper tools for bounded project, dashboard, insight, query, and schema reads."
    }
    if Self.isSentryProvider(app: app, connection: connection) {
      return connection == nil
        ? "Paste a user-owned Sentry auth token and organization slug before agents can triage Sentry issues."
        : "Sentry auth token is stored as a Keychain reference. Agents use approval-scoped or Direct writes Relay wrapper tools for issue workflow updates."
    }
    if app.authType.localizedCaseInsensitiveContains("api") {
      return connection == nil
        ? "Add an Exa API key with Connect so agents can use Exa search tools."
        : "API key stored in local Keychain. Selected agents receive the Exa Search skill and EXA_API_KEY in their runtime profile."
    }
    if isLinkedInProvider(app: app, connection: connection) {
      return connection == nil
        ? "Paste a manually generated LinkedIn member access token from the user's own LinkedIn developer app. No Relay callback URL is used."
        : "Manual LinkedIn token is stored as a Keychain reference. No Relay callback URL is used; token expiry remains user-managed."
    }
    if isGmailProvider(app: app, connection: connection) {
      return connection == nil
        ? "Save user-owned Google OAuth credentials before agents can use Gmail. No Relay-owned Google app or web callback is used."
        : "Gmail OAuth credentials are stored as Keychain references. Agents use approval-scoped or Direct writes Relay wrapper tools."
    }
    if isGoogleDocsProvider(app: app, connection: connection) {
      return connection == nil
        ? "Connect Google Docs through Relay-owned OAuth before agents can use documents."
        : "Google Docs OAuth credentials are stored as Keychain references. Agents use approval-scoped or Direct writes Relay wrapper tools for user-specified documents."
    }
    if isGoogleDriveProvider(app: app, connection: connection) {
      return connection == nil
        ? "Connect Google Drive through Relay-owned OAuth before agents can use Drive wrapper tools."
        : "Google Drive OAuth credentials are stored as Keychain references. Agents use approval-scoped or Direct writes Relay wrapper tools."
    }
    if isGoogleSheetsProvider(app: app, connection: connection) {
      return connection == nil
        ? "Connect Google Sheets through authenticated Railway OAuth before agents can use bounded spreadsheet wrappers."
        : "Google Sheets OAuth tokens use separate Keychain references. Agents can use only explicit app-visible spreadsheets and bounded A1 ranges."
    }
    if isGoogleSearchConsoleProvider(app: app, connection: connection) {
      return connection == nil
        ? "Save user-owned Google OAuth credentials before agents can read Google Search Console. No Relay-owned Google app or web callback is used."
        : "Google Search Console OAuth credentials are stored as Keychain references. V1 is read-only and uses Relay wrapper tools for bounded property, analytics, URL inspection, and sitemap reads."
    }
    if isGoogleCalendarProvider(app: app, connection: connection) {
      return connection == nil
        ? "Connect Google Calendar through Relay-owned OAuth before agents can use Calendar wrapper tools."
        : "Google Calendar OAuth credentials are stored as Keychain references. Agents use approval-scoped or Direct writes Relay wrapper tools."
    }
    if isNotionProvider(app: app, connection: connection) {
      return connection == nil
        ? "Paste a user-owned Notion API bearer token before agents can use Notion. No Relay-owned Notion app or callback is used."
        : "Notion API token is stored as a Keychain reference. Agents use approval-scoped or Direct writes Relay wrapper tools."
    }
    if app.slug.localizedCaseInsensitiveContains("outlook")
      || app.name.localizedCaseInsensitiveContains("outlook")
    {
      let account = connection?.accountLabel?.providerConnectionNilIfEmpty ?? "account"
      return connection == nil
        ? "Authorize \(app.name) before agents can use \(app.name) tools."
        : "Connected to \(account). Agents can read inbox messages and create drafts; send, reply, and forward require matching approval."
    }
    let account = connection?.accountLabel?.providerConnectionNilIfEmpty ?? "account"
    return connection == nil
      ? "Authorize \(app.name) before agents can use \(app.name) tools."
      : "Connected to \(account). Agents can use approved \(app.name) actions."
  }

  public static func missingFieldHelper(
    for app: MarketplaceCatalogApp, connection: MarketplaceProviderConnection?
  ) -> String? {
    guard
      let requirement = connection?.credentialRequirements.first(where: {
        $0.required && $0.status == .missing
      })
    else {
      if isXProvider(app: app, connection: connection) {
        return "Complete the Railway X OAuth flow and confirm the Relay credit spending limit."
      }
      if isLinkedInProvider(app: app, connection: connection), connection == nil {
        return "Enter a LinkedIn access token generated from the user's own LinkedIn app."
      }
      if isGmailProvider(app: app, connection: connection), connection == nil {
        return
          "Enter the Google OAuth client ID and Gmail refresh token from the user's own Google Cloud app."
      }
      if isGoogleDocsProvider(app: app, connection: connection), connection == nil {
        return
          "Enter the Google OAuth client ID and Google Docs refresh token from the user's own Google Cloud app."
      }
      if isGoogleDriveProvider(app: app, connection: connection), connection == nil {
        return
          "Enter the Google OAuth client ID and Drive refresh token from the user's own Google Cloud app."
      }
      if isGoogleSearchConsoleProvider(app: app, connection: connection), connection == nil {
        return
          "Connect Google Search Console through Relay-owned OAuth, then choose the default property."
      }
      if isGoogleCalendarProvider(app: app, connection: connection), connection == nil {
        return
          "Connect Google Calendar through Relay-owned OAuth, then choose the connected account."
      }
      if isGoogleAnalyticsProvider(app: app, connection: connection), connection == nil {
        return
          "Connect Google Analytics through Relay-owned OAuth, then choose the selected GA4 property."
      }
      if Self.isPostHogProvider(app: app, connection: connection), connection == nil {
        return
          "Choose the PostHog Cloud API region and complete Relay-owned OAuth with the exact read scopes."
      }
      if Self.isSentryProvider(app: app, connection: connection), connection == nil {
        return "Enter a Sentry auth token and organization slug from the user's own Sentry account."
      }
      if isNotionProvider(app: app, connection: connection), connection == nil {
        return
          "Enter the Notion API token from the user's own Notion workspace or personal token settings."
      }
      if isMicrosoftClarityProvider(app: app, connection: connection), connection == nil {
        return "Enter a Microsoft Clarity Data Export API token generated by a project admin."
      }
      if Self.isTelemetryDeckProvider(app: app, connection: connection), connection == nil {
        return
          "Enter a TelemetryDeck Personal Access Token, organization namespace, and selected app ID."
      }
      return nil
    }
    return "Enter \(requirement.label) first."
  }
}
