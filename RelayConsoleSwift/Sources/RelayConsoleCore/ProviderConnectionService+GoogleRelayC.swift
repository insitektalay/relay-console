import Foundation

extension ProviderConnectionService {
  @discardableResult public func saveGoogleAnalyticsRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    accountEmail: String, propertyId: String, propertyDisplayName: String?, grantedScopes: [String],
    expiresAt: String?, displayName: String? = nil, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "google-analytics")
    let email = accountEmail.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
    let property = try Self.normalizedGoogleAnalyticsPropertyId(propertyId)
    guard app.slug == "google-analytics", email.count <= 320, email.contains("@"),
      !email.contains(where: { $0.isWhitespace }),
      grantedScopes == Self.googleAnalyticsRelayOwnedOAuthScopes
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "Relay-owned Google Analytics OAuth requires exact analytics.readonly scope, a safe account, and an explicit GA4 property."
      )
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "Google Analytics OAuth access token", maxLength: 30000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "Google Analytics OAuth refresh token", maxLength: 30000)
    let id = createRelayId("mpc")
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let propertyName = "properties/" + property
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Google Analytics OAuth access token",
      secretValue: access)
    let refreshRef: SecretReference
    do {
      refreshRef = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Google Analytics OAuth refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "google_analytics_oauth_access_token",
        label: "Google Analytics OAuth access token", required: true, userOwnedRequired: false,
        secretReferenceId: accessRef.id, status: .verified,
        helpText:
          "Short-lived Analytics token stored as a Keychain reference and replaced by Railway.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "google_analytics_oauth_refresh_token",
        label: "Google Analytics OAuth refresh token", required: true, userOwnedRequired: false,
        secretReferenceId: refreshRef.id, status: .verified,
        helpText: "Offline refresh token stored separately; only Railway uses the client secret.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "google_analytics_property", label: "Selected GA4 property", required: true,
        userOwnedRequired: false, secretReferenceId: nil, status: .verified,
        helpText: "Explicit non-secret GA4 property bound during Railway OAuth.",
        redactionStatus: "private-state-excluded"),
    ]
    let diagnostics: [String: JSONValue] = [
      "provider": .string("google-analytics"),
      "authMethod": .string("google_oauth_confidential_web_server_offline"),
      "adminApiOrigin": .string("https://analyticsadmin.googleapis.com/v1beta"),
      "dataApiOrigin": .string("https://analyticsdata.googleapis.com/v1beta"),
      "tokenOrigin": .string("https://oauth2.googleapis.com/token"), "accountEmail": .string(email),
      "selectedPropertyId": .string(property), "selectedPropertyName": .string(propertyName),
      "selectedPropertyDisplayName": propertyDisplayName?.providerConnectionNilIfEmpty.map(
        JSONValue.string) ?? .null,
      "accessExpiresAt": expiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
      "exactScopes": .array(Self.googleAnalyticsRelayOwnedOAuthScopes.map(JSONValue.string)),
      "explicitPropertyOnly": .bool(true), "propertyDiscoveryEnabled": .bool(false),
      "arbitraryReportsEnabled": .bool(false),
      "realtimeBatchPivotFunnelAccessEnabled": .bool(false), "audienceExportsEnabled": .bool(false),
      "userDemographicPageSearchGeoCustomDetailEnabled": .bool(false),
      "mutationsEnabled": .bool(false), "measurementProtocolEnabled": .bool(false),
      "automaticPagination": .bool(false), "serviceAccountEnabled": .bool(false),
      "domainDelegationEnabled": .bool(false),
      "clientSecretLocation": .string("secure-railway-broker-only"),
      "rawTokenStoredInDatabase": .bool(false),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "google-analytics-relay-owned-google-oauth:" + property,
      providerName: "Google Analytics", status: .connected, authorizationState: .completed,
      credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
      credentialRequirements: requirements, secretReferenceIds: [accessRef.id, refreshRef.id],
      accountLabel: displayName?.providerConnectionNilIfEmpty ?? propertyDisplayName?
        .providerConnectionNilIfEmpty ?? "GA4 property "
        + property, connectedHandle: email, callbackURL: nil,
      requiredScopes: Self.googleAnalyticsRelayOwnedOAuthScopes,
      grantedScopes: Self.googleAnalyticsRelayOwnedOAuthScopes,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message:
          "Relay-owned Google Analytics OAuth is ready for fixed reports on the explicit GA4 property.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [], diagnostics: diagnostics,
        redactionStatus: "private-state-excluded"), senderIdentities: [],
      installPolicy: "read_only_explicit_property_fixed_reports", lastCheckedAt: timestamp,
      lastError: nil, manualEvidenceNote: nil, reauthorizeRequired: false, disconnecting: false,
      betaBlocked: false, createdAt: timestamp, updatedAt: timestamp,
      redactionStatus: "private-state-excluded")
    do { return try saveConnection(context: context, connection: connection) } catch {
      _ = try? secrets.delete(accessRef.id)
      _ = try? secrets.delete(refreshRef.id)
      throw error
    }
  }

  @discardableResult public func rotateGoogleAnalyticsRelayOwnedOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String?, expiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    googleAnalyticsTokenRotationLock.lock()
    defer { googleAnalyticsTokenRotationLock.unlock() }
    guard
      var connection = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      connection.appSlug == "google-analytics", connection.credentialOwnership == .relayOwned,
      connection.grantedScopes == Self.googleAnalyticsRelayOwnedOAuthScopes,
      connection.health.diagnostics["explicitPropertyOnly"]?.bool == true
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "A Relay-owned exact-scope explicit-property Google Analytics connection is required.")
    }
    let access = try requireNonEmptyString(
      accessToken, field: "Google Analytics OAuth access token", maxLength: 30000)
    let oldAccess = connection.credentialRequirements.first {
      $0.fieldKey == "google_analytics_oauth_access_token"
    }?.secretReferenceId
    let oldRefresh = connection.credentialRequirements.first {
      $0.fieldKey == "google_analytics_oauth_refresh_token"
    }?.secretReferenceId
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: connection.id,
      label: "Google Analytics OAuth access token", secretValue: access)
    let refreshRef: SecretReference?
    do {
      refreshRef = try refreshToken?.providerConnectionNilIfEmpty.map {
        try secrets.set(
          scope: "provider_connection", scopeId: connection.id,
          label: "Google Analytics OAuth refresh token", secretValue: $0)
      }
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    connection.credentialRequirements = connection.credentialRequirements.map { value in
      var copy = value
      if copy.fieldKey == "google_analytics_oauth_access_token" {
        copy.secretReferenceId = accessRef.id
      }
      if copy.fieldKey == "google_analytics_oauth_refresh_token", let refreshRef {
        copy.secretReferenceId = refreshRef.id
      }
      return copy
    }
    connection.secretReferenceIds = [accessRef.id, refreshRef?.id ?? oldRefresh].compactMap { $0 }
    connection.updatedAt = ISO8601DateFormatter.relayConsole.string(from: now)
    connection.health.diagnostics["accessExpiresAt"] =
      expiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null
    do {
      let saved = try saveConnection(context: context, connection: connection)
      if let oldAccess { _ = try? secrets.delete(oldAccess) }
      if refreshRef != nil, let oldRefresh { _ = try? secrets.delete(oldRefresh) }
      return saved
    } catch {
      _ = try? secrets.delete(accessRef.id)
      if let refreshRef { _ = try? secrets.delete(refreshRef.id) }
      throw error
    }
  }

  @discardableResult public func saveGoogleSearchConsoleRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    accountEmail: String, selectedSiteUrl: String, grantedScopes: [String], expiresAt: String?,
    displayName: String? = nil, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "google-search-console")
    let email = accountEmail.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
    let site = selectedSiteUrl.trimmingCharacters(in: .whitespacesAndNewlines)
    guard app.slug == "google-search-console", email.count <= 320, email.contains("@"),
      !email.contains(where: { $0.isWhitespace }), Self.isSafeSearchConsoleSiteURL(site),
      grantedScopes == Self.googleSearchConsoleRelayOwnedOAuthScopes
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "Relay-owned Search Console OAuth requires exact webmasters.readonly scope, a safe account, and an explicit site property."
      )
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "Google Search Console OAuth access token", maxLength: 30000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "Google Search Console OAuth refresh token", maxLength: 30000)
    let id = createRelayId("mpc")
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Google Search Console OAuth access token",
      secretValue: access)
    let refreshRef: SecretReference
    do {
      refreshRef = try secrets.set(
        scope: "provider_connection", scopeId: id,
        label: "Google Search Console OAuth refresh token", secretValue: refresh)
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "google_search_console_oauth_access_token",
        label: "Google Search Console OAuth access token", required: true, userOwnedRequired: false,
        secretReferenceId: accessRef.id, status: .verified,
        helpText:
          "Short-lived Search Console token stored as a Keychain reference and replaced by Railway.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "google_search_console_oauth_refresh_token",
        label: "Google Search Console OAuth refresh token", required: true,
        userOwnedRequired: false, secretReferenceId: refreshRef.id, status: .verified,
        helpText: "Offline refresh token stored separately; only Railway uses the client secret.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "google_search_console_site", label: "Selected Search Console property",
        required: true, userOwnedRequired: false, secretReferenceId: nil, status: .verified,
        helpText: "Explicit URL-prefix or sc-domain property bound during Railway OAuth.",
        redactionStatus: "private-state-excluded"),
    ]
    let diagnostics: [String: JSONValue] = [
      "provider": .string("google-search-console"),
      "authMethod": .string("google_oauth_confidential_web_server_offline"),
      "apiOrigin": .string("https://www.googleapis.com/webmasters/v3"),
      "inspectionOrigin": .string("https://searchconsole.googleapis.com/v1"),
      "tokenOrigin": .string("https://oauth2.googleapis.com/token"), "accountEmail": .string(email),
      "selectedSiteUrl": .string(site),
      "accessExpiresAt": expiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
      "exactScopes": .array(Self.googleSearchConsoleRelayOwnedOAuthScopes.map(JSONValue.string)),
      "readOnlyV1": .bool(true), "writesEnabled": .bool(false), "automaticPagination": .bool(false),
      "serviceAccountEnabled": .bool(false), "domainDelegationEnabled": .bool(false),
      "clientSecretLocation": .string("secure-railway-broker-only"),
      "rawTokenStoredInDatabase": .bool(false),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "google-search-console-relay-owned-google-oauth:" + site,
      providerName: "Google Search Console", status: .connected, authorizationState: .completed,
      credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
      credentialRequirements: requirements, secretReferenceIds: [accessRef.id, refreshRef.id],
      accountLabel: displayName?.providerConnectionNilIfEmpty ?? site, connectedHandle: email,
      callbackURL: nil,
      requiredScopes: Self.googleSearchConsoleRelayOwnedOAuthScopes,
      grantedScopes: Self.googleSearchConsoleRelayOwnedOAuthScopes,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message:
          "Relay-owned Search Console OAuth is ready for bounded reads on the selected property.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [], diagnostics: diagnostics,
        redactionStatus: "private-state-excluded"), senderIdentities: [],
      installPolicy: "read_only_selected_search_console_property", lastCheckedAt: timestamp,
      lastError: nil, manualEvidenceNote: nil, reauthorizeRequired: false, disconnecting: false,
      betaBlocked: false, createdAt: timestamp, updatedAt: timestamp,
      redactionStatus: "private-state-excluded")
    do { return try saveConnection(context: context, connection: connection) } catch {
      _ = try? secrets.delete(accessRef.id)
      _ = try? secrets.delete(refreshRef.id)
      throw error
    }
  }

  @discardableResult public func rotateGoogleSearchConsoleRelayOwnedOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String?, expiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    googleSearchConsoleTokenRotationLock.lock()
    defer { googleSearchConsoleTokenRotationLock.unlock() }
    guard
      var connection = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      connection.appSlug == "google-search-console", connection.credentialOwnership == .relayOwned,
      connection.grantedScopes == Self.googleSearchConsoleRelayOwnedOAuthScopes,
      connection.health.diagnostics["readOnlyV1"]?.bool == true
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "A Relay-owned exact-scope Search Console connection is required.")
    }
    let access = try requireNonEmptyString(
      accessToken, field: "Google Search Console OAuth access token", maxLength: 30000)
    let oldAccess = connection.credentialRequirements.first {
      $0.fieldKey == "google_search_console_oauth_access_token"
    }?.secretReferenceId
    let oldRefresh = connection.credentialRequirements.first {
      $0.fieldKey == "google_search_console_oauth_refresh_token"
    }?.secretReferenceId
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: connection.id,
      label: "Google Search Console OAuth access token", secretValue: access)
    let refreshRef: SecretReference?
    do {
      refreshRef = try refreshToken?.providerConnectionNilIfEmpty.map {
        try secrets.set(
          scope: "provider_connection", scopeId: connection.id,
          label: "Google Search Console OAuth refresh token", secretValue: $0)
      }
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    connection.credentialRequirements = connection.credentialRequirements.map { value in
      var copy = value
      if copy.fieldKey == "google_search_console_oauth_access_token" {
        copy.secretReferenceId = accessRef.id
      }
      if copy.fieldKey == "google_search_console_oauth_refresh_token", let refreshRef {
        copy.secretReferenceId = refreshRef.id
      }
      return copy
    }
    connection.secretReferenceIds = [accessRef.id, refreshRef?.id ?? oldRefresh].compactMap { $0 }
    connection.updatedAt = ISO8601DateFormatter.relayConsole.string(from: now)
    connection.health.diagnostics["accessExpiresAt"] =
      expiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null
    do {
      let saved = try saveConnection(context: context, connection: connection)
      if let oldAccess { _ = try? secrets.delete(oldAccess) }
      if refreshRef != nil, let oldRefresh { _ = try? secrets.delete(oldRefresh) }
      return saved
    } catch {
      _ = try? secrets.delete(accessRef.id)
      if let refreshRef { _ = try? secrets.delete(refreshRef.id) }
      throw error
    }
  }

  @discardableResult public func saveGoogleDocsRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String,
    refreshToken: String, accountEmail: String, projectId: String?, grantedScopes: [String],
    expiresAt: String?, displayName: String? = nil, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "google-docs")
    let email = accountEmail.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
    guard app.slug == "google-docs", email.count <= 320, email.contains("@"),
      !email.contains(where: { $0.isWhitespace }),
      grantedScopes == Self.googleDocsRelayOwnedOAuthScopes
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "Relay-owned Google Docs OAuth requires exact documents scope and a safe account.")
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "Google Docs OAuth access token", maxLength: 30000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "Google Docs OAuth refresh token", maxLength: 30000)
    let id = createRelayId("mpc")
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Google Docs OAuth access token",
      secretValue: access)
    let refreshRef: SecretReference
    do {
      refreshRef = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Google Docs OAuth refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "google_docs_oauth_access_token", label: "Google Docs OAuth access token",
        required: true, userOwnedRequired: false, secretReferenceId: accessRef.id,
        status: .verified,
        helpText:
          "Short-lived access token stored as a Keychain reference and replaced by Railway.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "google_docs_oauth_refresh_token", label: "Google Docs OAuth refresh token",
        required: true, userOwnedRequired: false, secretReferenceId: refreshRef.id,
        status: .verified,
        helpText: "Offline refresh token stored separately; only Railway uses the client secret.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "google_docs_account", label: "Google Docs account",
        required: true, userOwnedRequired: false, secretReferenceId: nil, status: .verified,
        helpText: "Authorized Google account for explicit document-targeted wrappers.",
        redactionStatus: "private-state-excluded"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "google-docs-relay-owned-google-oauth:" + email,
      providerName: "Google Docs", status: .connected, authorizationState: .completed,
      credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
      credentialRequirements: requirements, secretReferenceIds: [accessRef.id, refreshRef.id],
      accountLabel: displayName?.providerConnectionNilIfEmpty ?? email, connectedHandle: email,
      callbackURL: nil,
      requiredScopes: Self.googleDocsRelayOwnedOAuthScopes,
      grantedScopes: Self.googleDocsRelayOwnedOAuthScopes, selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message: "Relay-owned Google Docs OAuth is ready for explicit document wrappers.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("google-docs"),
          "authMethod": .string("google_oauth_confidential_web_server_offline"),
          "apiOrigin": .string("https://docs.googleapis.com/v1"),
          "tokenOrigin": .string("https://oauth2.googleapis.com/token"),
          "accountEmail": .string(email),
          "projectId": projectId?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
          "accessExpiresAt": expiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
          "exactScopes": .array(Self.googleDocsRelayOwnedOAuthScopes.map(JSONValue.string)),
          "redundantReadonlyScopeRequested": .bool(false),
          "documentTargetRequired": .bool(true), "automaticPagination": .bool(false),
          "clientSecretLocation": .string("secure-railway-broker-only"),
          "rawTokenStoredInDatabase": .bool(false),
        ], redactionStatus: "private-state-excluded"),
      senderIdentities: [
        ProviderSenderIdentity(
          id: "google-docs:" + email, email: email, validationStatus: .verified, agentId: nil,
          installId: nil, lastCheckedAt: timestamp, errorMessage: nil,
          redactionStatus: "private-state-excluded")
      ], installPolicy: "approval_gated_document_actions_with_direct_write_option",
      lastCheckedAt: timestamp, lastError: nil, manualEvidenceNote: nil,
      reauthorizeRequired: false, disconnecting: false, betaBlocked: false,
      createdAt: timestamp, updatedAt: timestamp, redactionStatus: "private-state-excluded")
    do { return try saveConnection(context: context, connection: connection) } catch {
      _ = try? secrets.delete(accessRef.id)
      _ = try? secrets.delete(refreshRef.id)
      throw error
    }
  }

  @discardableResult public func rotateGoogleDocsRelayOwnedOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String?, expiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    googleDocsTokenRotationLock.lock()
    defer { googleDocsTokenRotationLock.unlock() }
    guard
      var connection = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      connection.appSlug == "google-docs", connection.credentialOwnership == .relayOwned
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "A Relay-owned Google Docs OAuth connection is required.")
    }
    let access = try requireNonEmptyString(
      accessToken, field: "Google Docs OAuth access token", maxLength: 30000)
    let oldAccess = connection.credentialRequirements.first {
      $0.fieldKey == "google_docs_oauth_access_token"
    }?.secretReferenceId
    let oldRefresh = connection.credentialRequirements.first {
      $0.fieldKey == "google_docs_oauth_refresh_token"
    }?.secretReferenceId
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: connection.id,
      label: "Google Docs OAuth access token", secretValue: access)
    let replacement = refreshToken?.providerConnectionNilIfEmpty
    let refreshRef: SecretReference?
    do {
      refreshRef = try replacement.map {
        try secrets.set(
          scope: "provider_connection", scopeId: connection.id,
          label: "Google Docs OAuth refresh token", secretValue: $0)
      }
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    connection.credentialRequirements = connection.credentialRequirements.map { value in
      var copy = value
      if copy.fieldKey == "google_docs_oauth_access_token" { copy.secretReferenceId = accessRef.id }
      if copy.fieldKey == "google_docs_oauth_refresh_token", let refreshRef {
        copy.secretReferenceId = refreshRef.id
      }
      return copy
    }
    connection.secretReferenceIds = [accessRef.id, refreshRef?.id ?? oldRefresh].compactMap { $0 }
    connection.updatedAt = ISO8601DateFormatter.relayConsole.string(from: now)
    connection.health.diagnostics["accessExpiresAt"] =
      expiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null
    do {
      let saved = try saveConnection(context: context, connection: connection)
      if let oldAccess { _ = try? secrets.delete(oldAccess) }
      if refreshRef != nil, let oldRefresh { _ = try? secrets.delete(oldRefresh) }
      return saved
    } catch {
      _ = try? secrets.delete(accessRef.id)
      if let refreshRef { _ = try? secrets.delete(refreshRef.id) }
      throw error
    }
  }

  public static func defaultCallbackURL(for app: MarketplaceCatalogApp) -> String {
    railwayOAuthCallbackURL(appSlug: app.slug, environment: ProcessInfo.processInfo.environment)
      ?? ""
  }

  public static func railwayOAuthCallbackURL(appSlug: String, environment: [String: String])
    -> String?
  {
    guard appSlug.range(of: "^[a-z0-9]+(?:-[a-z0-9]+)*$", options: .regularExpression) != nil,
      let rawOrigin = environment["CLAWCHAT_RAILWAY_ORIGIN"]?.trimmingCharacters(
        in: .whitespacesAndNewlines),
      !rawOrigin.isEmpty,
      let originURL = URL(string: rawOrigin),
      originURL.scheme == "https",
      originURL.user == nil,
      originURL.password == nil,
      originURL.query == nil,
      originURL.fragment == nil,
      originURL.host?.isEmpty == false,
      !["localhost", "localhost.localdomain", "127.0.0.1", "::1", "0.0.0.0"].contains(
        originURL.host?.lowercased() ?? ""),
      ["", "/", "/api/v1", "/api/v1/"].contains(originURL.path),
      var components = URLComponents(url: originURL, resolvingAgainstBaseURL: false)
    else {
      return nil
    }
    components.path = ""
    components.query = nil
    components.fragment = nil
    guard let origin = components.string?.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    else { return nil }
    return "\(origin)/api/v1/marketplace/oauth/\(appSlug)/callback"
  }
}
