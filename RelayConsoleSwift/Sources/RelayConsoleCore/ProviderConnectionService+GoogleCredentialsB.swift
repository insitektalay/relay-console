import Foundation

extension ProviderConnectionService {
  @discardableResult
  public func saveGoogleAnalyticsOAuthCredentials(
    context: ServiceRequestContext,
    appIdOrSlug: RelayId,
    clientId: String,
    clientSecret: String,
    refreshToken: String,
    accessToken: String?,
    accountEmail: String?,
    propertyId: String,
    propertyDisplayName: String?,
    displayName: String? = nil,
    credentialOwnership: ProviderCredentialOwnership = .userOwned,
    userOwnedCredentialsRequired: Bool = true,
    relayOwnedGoogleApp: Bool = false,
    providerKey: String = "google-analytics-user-oauth",
    scopes: [String]? = nil,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    guard credentialOwnership == .userOwned || !userOwnedCredentialsRequired else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "Relay-owned Google Analytics OAuth connections cannot require user-owned credentials.")
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "google-analytics")
    guard app.slug == "google-analytics" else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "Google Analytics OAuth credentials can only be saved for the Google Analytics Marketplace app."
      )
    }
    try validateAppCanAuthorize(app, context: context)
    let trimmedClientId = try requireNonEmptyString(
      clientId, field: "Google OAuth client ID", maxLength: 2000)
    let trimmedClientSecret = try requireNonEmptyString(
      clientSecret, field: "Google OAuth client secret", maxLength: 20000)
    let trimmedRefreshToken = try requireNonEmptyString(
      refreshToken, field: "Google OAuth refresh token", maxLength: 20000)
    let trimmedAccessToken = accessToken?.providerConnectionNilIfEmpty
    let trimmedAccountEmail = accountEmail?.providerConnectionNilIfEmpty
    let trimmedPropertyId = try Self.normalizedGoogleAnalyticsPropertyId(propertyId)
    let selectedPropertyName = "properties/\(trimmedPropertyId)"
    let trimmedPropertyDisplayName = propertyDisplayName?.providerConnectionNilIfEmpty
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let connectionId = existing?.id ?? createRelayId("mpc")
    let existingSecretIds = existing.map { Self.secretReferenceIds(in: $0) } ?? []
    for secretId in existingSecretIds {
      _ = try? secrets.delete(secretId)
    }

    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let clientIdReference = try secrets.set(
      scope: "provider_connection",
      scopeId: connectionId,
      label: "Google Analytics OAuth Client ID",
      secretValue: trimmedClientId
    )
    let clientSecretReference = try secrets.set(
      scope: "provider_connection",
      scopeId: connectionId,
      label: "Google Analytics OAuth Client Secret",
      secretValue: trimmedClientSecret
    )
    let refreshTokenReference = try secrets.set(
      scope: "provider_connection",
      scopeId: connectionId,
      label: "Google Analytics OAuth Refresh Token",
      secretValue: trimmedRefreshToken
    )
    let accessTokenReference = try trimmedAccessToken.map { token in
      try secrets.set(
        scope: "provider_connection",
        scopeId: connectionId,
        label: "Google Analytics OAuth Access Token",
        secretValue: token
      )
    }
    var secretReferenceIds = [
      clientIdReference.id, clientSecretReference.id, refreshTokenReference.id,
    ]
    if let accessTokenReference {
      secretReferenceIds.append(accessTokenReference.id)
    }
    let propertyLabel = trimmedPropertyDisplayName ?? selectedPropertyName
    let requiredScopes = scopes ?? Self.googleAnalyticsOAuthScopes
    let ownershipLabel = credentialOwnership.rawValue
    let authMethod =
      relayOwnedGoogleApp
      ? "google_oauth_relay_owned_analytics" : "google_oauth_user_owned_analytics"
    let connection = MarketplaceProviderConnection(
      id: connectionId,
      workspaceId: context.workspaceId,
      appId: app.id,
      appSlug: app.slug,
      providerKey: providerKey,
      providerName: "Google Analytics",
      status: .connected,
      authorizationState: .completed,
      credentialOwnership: credentialOwnership,
      userOwnedCredentialsRequired: userOwnedCredentialsRequired,
      credentialRequirements: [
        ProviderCredentialRequirement(
          fieldKey: "google_analytics_oauth_client_id",
          label: "Google OAuth client ID",
          required: true,
          userOwnedRequired: userOwnedCredentialsRequired,
          secretReferenceId: clientIdReference.id,
          status: .verified,
          helpText: relayOwnedGoogleApp
            ? "From Relay's Google Cloud OAuth client with Google Analytics API access enabled. Stored locally as a Keychain reference."
            : "From the user's own Google Cloud OAuth client with Google Analytics API access enabled. Stored locally as a Keychain reference.",
          redactionStatus: "secret-reference-only"
        ),
        ProviderCredentialRequirement(
          fieldKey: "google_analytics_oauth_client_secret",
          label: "Google OAuth client secret",
          required: true,
          userOwnedRequired: userOwnedCredentialsRequired,
          secretReferenceId: clientSecretReference.id,
          status: .verified,
          helpText: relayOwnedGoogleApp
            ? "From Relay's Google OAuth client configuration. Stored locally as a Keychain reference."
            : "From the user's own Google Cloud OAuth client. Stored locally as a Keychain reference.",
          redactionStatus: "secret-reference-only"
        ),
        ProviderCredentialRequirement(
          fieldKey: "google_analytics_oauth_refresh_token",
          label: "Google OAuth refresh token",
          required: true,
          userOwnedRequired: userOwnedCredentialsRequired,
          secretReferenceId: refreshTokenReference.id,
          status: .verified,
          helpText: relayOwnedGoogleApp
            ? "Refresh token granted by the user's Google account through Relay-owned OAuth."
            : "Refresh token granted by the user's own Google OAuth app and Google Analytics account.",
          redactionStatus: "secret-reference-only"
        ),
        ProviderCredentialRequirement(
          fieldKey: "google_analytics_oauth_access_token",
          label: "Google OAuth access token",
          required: false,
          userOwnedRequired: userOwnedCredentialsRequired,
          secretReferenceId: accessTokenReference?.id,
          status: accessTokenReference == nil ? .missing : .verified,
          helpText:
            "Optional short-lived access token for immediate health checks; refresh token remains the durable credential.",
          redactionStatus: "secret-reference-only"
        ),
        ProviderCredentialRequirement(
          fieldKey: "google_analytics_property_id",
          label: "GA4 property ID",
          required: true,
          userOwnedRequired: false,
          secretReferenceId: nil,
          status: .verified,
          helpText:
            "Selected non-secret GA4 property ID. Agents cannot be assigned until this is set.",
          redactionStatus: "private-state-excluded"
        ),
        ProviderCredentialRequirement(
          fieldKey: "google_analytics_property_display_name",
          label: "Property display name",
          required: false,
          userOwnedRequired: false,
          secretReferenceId: nil,
          status: trimmedPropertyDisplayName == nil ? .missing : .verified,
          helpText: "Optional non-secret label for the selected GA4 property.",
          redactionStatus: "private-state-excluded"
        ),
      ],
      secretReferenceIds: secretReferenceIds,
      accountLabel: displayName?.providerConnectionNilIfEmpty ?? existing?.accountLabel
        ?? trimmedAccountEmail
        ?? "Google Analytics \(propertyLabel)",
      connectedHandle: trimmedAccountEmail,
      callbackURL: nil,
      requiredScopes: requiredScopes,
      grantedScopes: requiredScopes,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message:
          "Google Analytics OAuth credentials and selected GA4 property saved as Keychain references and redacted metadata. Live Analytics validation runs in the health-check phase.",
        lastCheckedAt: timestamp,
        missingScopes: [],
        unavailableTools: [],
        diagnostics: [
          "provider": .string("google-analytics"),
          "authMethod": .string(authMethod),
          "callbackURLRequired": .bool(false),
          "credentialOwnership": .string(ownershipLabel),
          "relayOwnedGoogleApp": .bool(relayOwnedGoogleApp),
          "secretStorage": .string("keychain-reference-only"),
          "clientSecretProvided": .bool(true),
          "accessTokenProvided": .bool(accessTokenReference != nil),
          "selectedPropertyId": .string(trimmedPropertyId),
          "selectedPropertyName": .string(selectedPropertyName),
          "selectedPropertyDisplayName": trimmedPropertyDisplayName.map(JSONValue.string) ?? .null,
          "readOnlyV1": .bool(true),
          "adminMutations": .string("blocked"),
          "measurementProtocolWrites": .string("blocked"),
          "scopePreset": .string("analytics_readonly"),
        ],
        redactionStatus: "private-state-excluded"
      ),
      senderIdentities: [],
      installPolicy: "read_only_analytics_reports",
      lastCheckedAt: timestamp,
      lastError: nil,
      manualEvidenceNote: nil,
      reauthorizeRequired: false,
      disconnecting: false,
      betaBlocked: false,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
      redactionStatus: "private-state-excluded"
    )
    return try saveConnection(context: context, connection: connection)
  }

  @discardableResult
  public func saveGoogleSearchConsoleOAuthCredentials(
    context: ServiceRequestContext,
    appIdOrSlug: RelayId,
    clientId: String,
    clientSecret: String,
    refreshToken: String,
    accessToken: String?,
    accountEmail: String?,
    projectId: String?,
    defaultSiteUrl: String?,
    displayName: String? = nil,
    credentialOwnership: ProviderCredentialOwnership = .userOwned,
    userOwnedCredentialsRequired: Bool = true,
    relayOwnedGoogleApp: Bool = false,
    providerKey: String = "google-search-console-user-oauth",
    scopes: [String]? = nil,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    throw ServiceGuard.invalidInput(
      context: context,
      message:
        "Desktop-supplied Search Console OAuth credentials are disabled. Use the authenticated Railway Relay-owned OAuth lifecycle with exact webmasters.readonly scope and explicit property binding."
    )
  }

  public func validateSavedGoogleSearchConsoleConnection(
    context: ServiceRequestContext,
    connectionId: RelayId,
    now: Date = Date()
  ) async throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    guard
      var connection = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId)
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Provider connection was not found.")
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: connection.appId, fallbackSlug: "google-search-console")
    guard app.slug == "google-search-console", connection.appId == app.id else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "Only Google Search Console OAuth connections can be tested here.")
    }
    let requiredFields = [
      "google_search_console_oauth_client_id",
      "google_search_console_oauth_client_secret",
      "google_search_console_oauth_refresh_token",
    ]
    let requirementsByKey = Dictionary(
      uniqueKeysWithValues: connection.credentialRequirements.map { ($0.fieldKey, $0) })
    let missingFields = requiredFields.filter {
      requirementsByKey[$0]?.secretReferenceId?.providerConnectionNilIfEmpty == nil
    }
    guard missingFields.isEmpty else {
      let validation = GoogleOAuthCredentialValidationResult(
        status: .missingSecret,
        message:
          "Google Search Console connection is missing Keychain references for required OAuth credentials. Replace the Google Search Console connection in Marketplace.",
        unavailableFields: missingFields,
        missingScopes: Self.googleSearchConsoleOAuthScopes,
        selectedResourceId: connection.health.diagnostics["selectedSiteUrl"]?.string?
          .providerConnectionNilIfEmpty
      )
      return try saveGoogleSearchConsoleHealthResult(
        validation, connection: &connection, app: app, now: now)
    }

    var secretValuesByField: [String: String] = [:]
    var unreadableFields: [String] = []
    for field in requiredFields {
      guard let secretId = requirementsByKey[field]?.secretReferenceId else {
        unreadableFields.append(field)
        continue
      }
      do {
        secretValuesByField[field] = try secrets.getSecretValue(secretId)
      } catch {
        unreadableFields.append(field)
      }
    }
    guard unreadableFields.isEmpty else {
      let validation = GoogleOAuthCredentialValidationResult(
        status: .secretUnavailable,
        message:
          "Relay could not read the saved Google Search Console OAuth credentials from the OS secret store. Replace the Google Search Console connection in Marketplace.",
        unavailableFields: unreadableFields,
        missingScopes: Self.googleSearchConsoleOAuthScopes,
        selectedResourceId: connection.health.diagnostics["selectedSiteUrl"]?.string?
          .providerConnectionNilIfEmpty
      )
      return try saveGoogleSearchConsoleHealthResult(
        validation, connection: &connection, app: app, now: now)
    }

    let validation = await googleOAuthValidator.validateSearchConsoleCredentials(
      clientId: secretValuesByField["google_search_console_oauth_client_id"] ?? "",
      clientSecret: secretValuesByField["google_search_console_oauth_client_secret"] ?? "",
      refreshToken: secretValuesByField["google_search_console_oauth_refresh_token"] ?? "",
      selectedSiteUrl: connection.health.diagnostics["selectedSiteUrl"]?.string?
        .providerConnectionNilIfEmpty,
      requiredScopes: Self.googleSearchConsoleOAuthScopes
    )
    return try saveGoogleSearchConsoleHealthResult(
      validation, connection: &connection, app: app, now: now)
  }
}
