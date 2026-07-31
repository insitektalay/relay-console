import Foundation

extension ProviderConnectionService {
  @discardableResult
  public func saveSentryAuthToken(
    context: ServiceRequestContext,
    appIdOrSlug: RelayId,
    authToken: String,
    organizationSlug: String,
    baseURL: String?,
    defaultProjectSlug: String?,
    defaultEnvironment: String?,
    displayName: String? = nil,
    validationResult: SentryTokenValidationResult? = nil,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "sentry")
    guard app.slug == "sentry" else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "Sentry auth tokens can only be saved for the Sentry Marketplace app.")
    }
    try validateAppCanAuthorize(app, context: context)
    let trimmedToken = try requireNonEmptyString(
      authToken, field: "Sentry auth token", maxLength: 20000)
    let trimmedOrganization = try requireNonEmptyString(
      organizationSlug, field: "Sentry organization slug or id", maxLength: 256)
    let trimmedBaseURL = baseURL?.providerConnectionNilIfEmpty ?? "https://sentry.io"
    let trimmedProjectSlug = defaultProjectSlug?.providerConnectionNilIfEmpty
    let trimmedEnvironment = defaultEnvironment?.providerConnectionNilIfEmpty
    let existingCount = try data.listProviderConnections(
      workspaceId: context.workspaceId, appId: app.id
    ).count
    let connectionId = createRelayId("mpc")
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let validation = validationResult
    let connectionName =
      displayName?.providerConnectionNilIfEmpty
      ?? trimmedProjectSlug.map { "\(trimmedOrganization) / \($0)" }
      ?? (trimmedOrganization.isEmpty
        ? "Sentry connection \(existingCount + 1)" : "Sentry \(trimmedOrganization)")
    let tokenReference = try secrets.set(
      scope: "provider_connection",
      scopeId: connectionId,
      label: "Sentry auth token",
      secretValue: trimmedToken
    )
    let healthMessage =
      validation?.message
      ?? "Sentry auth token saved as a Keychain reference. Run Check connection before assigning agents."
    let healthState: ProviderConnectorHealthState
    let connectionStatus: ProviderConnectionStatus
    let reauthorizeRequired: Bool
    if let validation {
      healthState = validation.isReady ? .ready : .error
      connectionStatus =
        validation.isReady ? .connected : Self.sentryConnectionStatus(for: validation)
      reauthorizeRequired = Self.sentryReauthorizeRequired(for: validation)
    } else {
      healthState = .degraded
      connectionStatus = .authRequired
      reauthorizeRequired = true
    }
    let checkedAt = validation == nil ? nil : timestamp
    let resolvedBaseURL = validation?.baseURL?.providerConnectionNilIfEmpty ?? trimmedBaseURL
    let organizationName =
      validation?.organizationName?.providerConnectionNilIfEmpty ?? validation?.organizationSlug?
      .providerConnectionNilIfEmpty
      ?? trimmedOrganization
    let connection = MarketplaceProviderConnection(
      id: connectionId,
      workspaceId: context.workspaceId,
      appId: app.id,
      appSlug: app.slug,
      providerKey: "sentry-user-auth-token:\(trimmedOrganization)",
      providerName: "Sentry",
      status: connectionStatus,
      authorizationState: connectionStatus == .connected ? .completed : .error,
      credentialOwnership: .userOwned,
      userOwnedCredentialsRequired: true,
      credentialRequirements: [
        ProviderCredentialRequirement(
          fieldKey: "sentry_auth_token",
          label: "Sentry auth token",
          required: true,
          userOwnedRequired: true,
          secretReferenceId: tokenReference.id,
          status: .verified,
          helpText: "User-owned Sentry auth token stored only as a Keychain reference.",
          redactionStatus: "secret-reference-only"
        ),
        ProviderCredentialRequirement(
          fieldKey: "sentry_organization_slug",
          label: "Organization slug or id",
          required: true,
          userOwnedRequired: false,
          secretReferenceId: nil,
          status: .verified,
          helpText:
            "Non-secret Sentry organization slug or id used to scope reads and issue updates.",
          redactionStatus: "private-state-excluded"
        ),
        ProviderCredentialRequirement(
          fieldKey: "sentry_base_url",
          label: "Sentry base URL",
          required: false,
          userOwnedRequired: false,
          secretReferenceId: nil,
          status: .verified,
          helpText: "HTTPS Sentry host. Leave blank for https://sentry.io.",
          redactionStatus: "private-state-excluded"
        ),
        ProviderCredentialRequirement(
          fieldKey: "sentry_default_project_slug",
          label: "Default project slug or id",
          required: false,
          userOwnedRequired: false,
          secretReferenceId: nil,
          status: trimmedProjectSlug == nil ? .missing : .verified,
          helpText: "Optional non-secret project slug/id used as the default issue triage scope.",
          redactionStatus: "private-state-excluded"
        ),
        ProviderCredentialRequirement(
          fieldKey: "sentry_default_environment",
          label: "Default environment",
          required: false,
          userOwnedRequired: false,
          secretReferenceId: nil,
          status: trimmedEnvironment == nil ? .missing : .verified,
          helpText: "Optional non-secret Sentry environment filter for issue triage.",
          redactionStatus: "private-state-excluded"
        ),
      ],
      secretReferenceIds: [tokenReference.id],
      accountLabel: connectionName,
      connectedHandle: organizationName,
      callbackURL: nil,
      requiredScopes: Self.sentryAuthTokenScopes,
      grantedScopes: Self.sentryAuthTokenScopes,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: healthState,
        message: healthMessage,
        lastCheckedAt: checkedAt,
        missingScopes: validation?.status == .insufficientScope
          ? ["org:read", "project:read"] : [],
        unavailableTools: validation?.status == .insufficientScope
          ? [
            "sentry_list_projects", "sentry_search_issues", "sentry_get_issue", "sentry_get_event",
            "sentry_update_issue",
          ] : [],
        diagnostics: [
          "provider": .string("sentry"),
          "authMethod": .string("user_auth_token"),
          "validation": validation.map { .string($0.status.rawValue) }
            ?? .string("saved_unverified"),
          "httpStatusCode": validation?.httpStatusCode.map { .number(Double($0)) } ?? .null,
          "organizationSlug": .string(trimmedOrganization),
          "organizationName": .string(organizationName),
          "baseURL": .string(resolvedBaseURL),
          "defaultProjectSlug": trimmedProjectSlug.map(JSONValue.string) ?? .null,
          "defaultEnvironment": trimmedEnvironment.map(JSONValue.string) ?? .null,
          "projectCountSampled": .number(Double(validation?.projectCount ?? 0)),
          "callbackURLRequired": .bool(false),
          "credentialOwnership": .string("user-owned"),
          "relayOwnedSentryApp": .bool(false),
          "secretStorage": .string("keychain-reference-only"),
          "rawTokenStoredInDatabase": .bool(false),
          "requiredScopes": .array(Self.sentryAuthTokenScopes.map(JSONValue.string)),
          "blockedAdminScopes": .array(
            [
              "project:write", "project:admin", "team:write", "team:admin", "org:write",
              "org:admin", "member:read", "member:write", "member:admin", "event:admin",
            ].map(JSONValue.string)),
          "healthEndpoint": .string(
            "GET /api/0/organizations/{organization_slug}/projects/?per_page=1"),
        ],
        redactionStatus: "private-state-excluded"
      ),
      senderIdentities: [],
      installPolicy: "approval_gated_observability_issue_updates",
      lastCheckedAt: checkedAt,
      lastError: validation?.isReady == false ? validation?.message : nil,
      manualEvidenceNote: nil,
      reauthorizeRequired: reauthorizeRequired,
      disconnecting: false,
      betaBlocked: false,
      createdAt: timestamp,
      updatedAt: timestamp,
      redactionStatus: "private-state-excluded"
    )
    return try saveConnection(context: context, connection: connection)
  }

  @discardableResult
  public func validateSavedSentryConnection(
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
      context: context, appIdOrSlug: connection.appId, fallbackSlug: "sentry")
    guard app.slug == "sentry", connection.appId == app.id else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Only Sentry auth token connections can be checked here.")
    }
    let secretId =
      connection.credentialRequirements.first {
        $0.fieldKey == "sentry_oauth_access_token" || $0.fieldKey == "sentry_auth_token"
      }?.secretReferenceId
      ?? Self.secretReferenceIds(in: connection).first
    guard let secretId else {
      let validation = SentryTokenValidationResult(
        status: .missingSecret,
        message: "Sentry connection is missing a Keychain token reference."
      )
      return try saveSentryHealthResult(validation, connection: &connection, app: app, now: now)
    }
    let token: String
    do {
      token = try secrets.getSecretValue(secretId)
    } catch {
      let validation = SentryTokenValidationResult(
        status: .secretUnavailable,
        message:
          "Relay could not read the saved Sentry token from the OS secret store. Replace the token in Marketplace."
      )
      return try saveSentryHealthResult(validation, connection: &connection, app: app, now: now)
    }
    let organizationSlug =
      connection.health.diagnostics["organizationSlug"]?.string?.providerConnectionNilIfEmpty
      ?? connection.connectedHandle?.providerConnectionNilIfEmpty
      ?? ""
    let baseURL = connection.health.diagnostics["baseURL"]?.string?.providerConnectionNilIfEmpty
    let validation = await validateSentryAuthToken(
      authToken: token, organizationSlug: organizationSlug, baseURL: baseURL)
    return try saveSentryHealthResult(validation, connection: &connection, app: app, now: now)
  }

  @discardableResult
  public func connectExaAPIKey(
    context: ServiceRequestContext,
    appIdOrSlug: RelayId,
    apiKey: String,
    now: Date = Date()
  ) async throws -> MarketplaceProviderConnection {
    let validation = await validateExaAPIKey(apiKey: apiKey)
    return try saveExaAPIKeyConnection(
      context: context,
      appIdOrSlug: appIdOrSlug,
      apiKey: apiKey,
      validationResult: validation,
      now: now
    )
  }

  @discardableResult
  public func saveExaAPIKeyConnection(
    context: ServiceRequestContext,
    appIdOrSlug: RelayId,
    apiKey: String,
    validationResult: ExaAPIKeyValidationResult,
    displayName: String? = nil,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "exa-search")
    guard app.slug == "exa-search" else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Exa API keys can only be saved for Exa Search.")
    }
    try validateAppCanAuthorize(app, context: context)
    let trimmed = try requireNonEmptyString(apiKey, field: "Exa API key", maxLength: 10000)
    guard validationResult.isReady else {
      throw ServiceGuard.unavailable(
        context: context,
        reasonCode: validationResult.status == .invalidKey ? .authRequired : .runtimeUnavailable,
        message: validationResult.message
      )
    }
    let connectionId = createRelayId("mpc")
    let existingCount = try data.listProviderConnections(
      workspaceId: context.workspaceId, appId: app.id
    ).count
    let connectionName = try requireNonEmptyString(
      displayName?.providerConnectionNilIfEmpty ?? "Research Key \(existingCount + 1)",
      field: "Connection name",
      maxLength: 80
    )
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let secret = try secrets.set(
      scope: "provider_connection",
      scopeId: connectionId,
      label: "\(connectionName) Exa API key",
      secretValue: trimmed
    )
    let connection = MarketplaceProviderConnection(
      id: connectionId,
      workspaceId: context.workspaceId,
      appId: app.id,
      appSlug: app.slug,
      providerKey: "exa:\(connectionId)",
      providerName: "Exa Search",
      status: .connected,
      authorizationState: .completed,
      credentialOwnership: .userOwned,
      userOwnedCredentialsRequired: true,
      credentialRequirements: [
        ProviderCredentialRequirement(
          fieldKey: "exa_api_key",
          label: "Exa API key",
          required: true,
          userOwnedRequired: true,
          secretReferenceId: secret.id,
          status: .verified,
          helpText:
            "Stored locally in Keychain and copied into selected agent runtime profiles as EXA_API_KEY.",
          redactionStatus: "secret-reference-only"
        )
      ],
      secretReferenceIds: [secret.id],
      accountLabel: connectionName,
      connectedHandle: nil,
      callbackURL: nil,
      requiredScopes: ["search", "contents"],
      grantedScopes: ["search", "contents"],
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message: validationResult.message,
        lastCheckedAt: timestamp,
        missingScopes: [],
        unavailableTools: [],
        diagnostics: [
          "provider": .string("exa"),
          "validation": .string(validationResult.status.rawValue),
          "httpStatusCode": validationResult.httpStatusCode.map { .number(Double($0)) } ?? .null,
          "secretStorage": .string("keychain-reference-only"),
        ],
        redactionStatus: "private-state-excluded"
      ),
      senderIdentities: [],
      installPolicy: "hermes_profile_skill_and_env",
      lastCheckedAt: timestamp,
      lastError: nil,
      manualEvidenceNote: nil,
      reauthorizeRequired: false,
      disconnecting: false,
      betaBlocked: false,
      createdAt: timestamp,
      updatedAt: timestamp,
      redactionStatus: "private-state-excluded"
    )
    return try saveConnection(context: context, connection: connection)
  }

  @discardableResult
  public func validateSavedExaAPIKeyConnection(
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
      context: context, appIdOrSlug: connection.appId, fallbackSlug: "exa-search")
    guard app.slug == "exa-search", connection.appId == app.id else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Only Exa Search API key connections can be tested here.")
    }
    guard let secretId = Self.secretReferenceIds(in: connection).first else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Exa Search connection is missing a Keychain secret reference.")
    }
    let apiKey = try secrets.getSecretValue(secretId)
    let validation = await validateExaAPIKey(apiKey: apiKey)
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    connection.status =
      validation.isReady
      ? .connected : (validation.status == .invalidKey ? .authRequired : .healthError)
    connection.authorizationState = validation.isReady ? .completed : .error
    connection.health = ProviderConnectorHealth(
      state: validation.isReady ? .ready : .error,
      message: validation.message,
      lastCheckedAt: timestamp,
      missingScopes: [],
      unavailableTools: [],
      diagnostics: [
        "provider": .string("exa"),
        "validation": .string(validation.status.rawValue),
        "httpStatusCode": validation.httpStatusCode.map { .number(Double($0)) } ?? .null,
        "secretStorage": .string("keychain-reference-only"),
      ],
      redactionStatus: "private-state-excluded"
    )
    connection.lastCheckedAt = timestamp
    connection.lastError = validation.isReady ? nil : validation.message
    connection.reauthorizeRequired = validation.status == .invalidKey
    connection.updatedAt = timestamp
    return try saveConnection(context: context, connection: connection)
  }

  @discardableResult
  public func deleteConnection(
    context: ServiceRequestContext,
    connectionId: RelayId
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    guard
      let connection = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId)
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Provider connection was not found.")
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: connection.appId, fallbackSlug: connection.appSlug)
    _ = try data.deleteProviderConnection(
      workspaceId: context.workspaceId, connectionId: connection.id)
    for secretId in Self.secretReferenceIds(in: connection) {
      _ = try? secrets.delete(secretId)
    }
    try synchronizeCatalogConnectionState(workspaceId: context.workspaceId, app: app)
    return connection
  }

  @discardableResult
  func saveGoogleDocsHealthResult(
    _ validation: GoogleOAuthCredentialValidationResult,
    connection: inout MarketplaceProviderConnection,
    app: MarketplaceCatalogApp,
    now: Date
  ) throws -> MarketplaceProviderConnection {
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let unavailableFieldValues = validation.unavailableFields.map(JSONValue.string)
    let unavailableFieldSet = Set(validation.unavailableFields)
    let grantedScopeValues = validation.grantedScopes.map(JSONValue.string)
    let missingScopeValues = validation.missingScopes.map(JSONValue.string)
    let requirementsByKey = Dictionary(
      uniqueKeysWithValues: connection.credentialRequirements.map { ($0.fieldKey, $0) })
    let projectId = connection.health.diagnostics["projectId"]?.string?.providerConnectionNilIfEmpty
    let projectIdProvided = projectId != nil
    let relayOwnedGoogleApp =
      connection.health.diagnostics["relayOwnedGoogleApp"]?.bool
      ?? (connection.credentialOwnership == .relayOwned)
    let accessTokenProvided =
      requirementsByKey["google_docs_oauth_access_token"]?.secretReferenceId?
      .providerConnectionNilIfEmpty != nil
    connection.credentialRequirements = connection.credentialRequirements.map { requirement in
      var copy = requirement
      if unavailableFieldSet.contains(copy.fieldKey) {
        copy.status = validation.status == .missingSecret ? .missing : .unavailable
      } else if copy.required && copy.secretReferenceId != nil {
        copy.status = .verified
      }
      return copy
    }
    connection.status =
      validation.isReady ? .connected : Self.googleOAuthConnectionStatus(for: validation)
    connection.authorizationState = validation.isReady ? .completed : .error
    connection.requiredScopes = Self.googleDocsOAuthScopes
    if validation.isReady && !validation.grantedScopes.isEmpty {
      connection.grantedScopes = validation.grantedScopes
    }
    connection.health = ProviderConnectorHealth(
      state: validation.isReady ? .ready : .error,
      message: validation.message,
      lastCheckedAt: timestamp,
      missingScopes: validation.missingScopes,
      unavailableTools: validation.missingScopes.isEmpty
        ? []
        : [
          "google_docs_read_document", "google_docs_create_document",
          "google_docs_apply_document_update",
        ],
      diagnostics: [
        "provider": .string("google-docs"),
        "authMethod": .string(
          relayOwnedGoogleApp ? "google_oauth_relay_owned_docs" : "google_oauth_user_owned_docs"),
        "validation": .string(validation.status.rawValue),
        "unavailableCredentialFields": .array(unavailableFieldValues),
        "grantedScopes": .array(grantedScopeValues),
        "missingScopes": .array(missingScopeValues),
        "httpStatusCode": validation.httpStatusCode.map { .number(Double($0)) } ?? .null,
        "callbackURLRequired": .bool(false),
        "credentialOwnership": .string(connection.credentialOwnership.rawValue),
        "relayOwnedGoogleApp": .bool(relayOwnedGoogleApp),
        "secretStorage": .string("keychain-reference-only"),
        "clientSecretProvided": .bool(true),
        "accessTokenProvided": .bool(accessTokenProvided),
        "projectIdProvided": .bool(projectIdProvided),
        "projectId": projectId.map(JSONValue.string) ?? .null,
        "docsOnlyV1": .bool(true),
        "driveSearchEnabled": .bool(false),
        "scopePreset": .string("docs_readonly_documents"),
        "healthCheck": .string("google_oauth_refresh_docs_scope"),
      ],
      redactionStatus: "private-state-excluded"
    )
    connection.lastCheckedAt = timestamp
    connection.lastError = validation.isReady ? nil : validation.message
    connection.reauthorizeRequired = Self.googleOAuthReauthorizeRequired(for: validation)
    connection.updatedAt = timestamp
    let saved = try data.saveProviderConnection(connection)
    try synchronizeCatalogConnectionState(workspaceId: connection.workspaceId, app: app)
    return saved
  }

  @discardableResult
  func saveGoogleDriveHealthResult(
    _ validation: GoogleOAuthCredentialValidationResult,
    connection: inout MarketplaceProviderConnection,
    app: MarketplaceCatalogApp,
    now: Date
  ) throws -> MarketplaceProviderConnection {
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let unavailableFieldValues = validation.unavailableFields.map(JSONValue.string)
    let unavailableFieldSet = Set(validation.unavailableFields)
    let relayOwnedGoogleApp =
      connection.credentialOwnership == .relayOwned
      || connection.providerKey.localizedCaseInsensitiveContains("relay")
    let scopePreset = relayOwnedGoogleApp ? "drive_file" : "drive_metadata_readonly_readonly_file"
    connection.credentialRequirements = connection.credentialRequirements.map { requirement in
      var copy = requirement
      if unavailableFieldSet.contains(copy.fieldKey) {
        copy.status = validation.status == .missingSecret ? .missing : .unavailable
      } else if copy.required && copy.secretReferenceId != nil {
        copy.status = .verified
      }
      return copy
    }
    connection.status = validation.isReady ? .connected : .authRequired
    connection.authorizationState = validation.isReady ? .completed : .error
    connection.health = ProviderConnectorHealth(
      state: validation.isReady ? .ready : .error,
      message: validation.message,
      lastCheckedAt: timestamp,
      missingScopes: [],
      unavailableTools: [],
      diagnostics: [
        "provider": .string("google-drive"),
        "authMethod": .string(
          relayOwnedGoogleApp ? "google_oauth_relay_owned_drive" : "google_oauth_user_owned_drive"),
        "validation": .string(validation.status.rawValue),
        "unavailableCredentialFields": .array(unavailableFieldValues),
        "callbackURLRequired": .bool(false),
        "credentialOwnership": .string(connection.credentialOwnership.rawValue),
        "relayOwnedGoogleApp": .bool(relayOwnedGoogleApp),
        "secretStorage": .string("keychain-reference-only"),
        "restrictedScopes": .bool(!relayOwnedGoogleApp),
        "scopePreset": .string(scopePreset),
        "healthCheck": .string("keychain_reference_readability"),
      ],
      redactionStatus: "private-state-excluded"
    )
    connection.lastCheckedAt = timestamp
    connection.lastError = validation.isReady ? nil : validation.message
    connection.reauthorizeRequired = !validation.isReady
    connection.updatedAt = timestamp
    let saved = try data.saveProviderConnection(connection)
    try synchronizeCatalogConnectionState(workspaceId: connection.workspaceId, app: app)
    return saved
  }

  @discardableResult
  func saveGoogleCalendarHealthResult(
    _ validation: GoogleOAuthCredentialValidationResult,
    connection: inout MarketplaceProviderConnection,
    app: MarketplaceCatalogApp,
    now: Date
  ) throws -> MarketplaceProviderConnection {
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let unavailableFieldValues = validation.unavailableFields.map(JSONValue.string)
    let unavailableFieldSet = Set(validation.unavailableFields)
    let grantedScopeValues = validation.grantedScopes.map(JSONValue.string)
    let missingScopeValues = validation.missingScopes.map(JSONValue.string)
    let defaultCalendarId =
      connection.health.diagnostics["defaultCalendarId"]?.string?.providerConnectionNilIfEmpty
      ?? "primary"
    let relayOwnedGoogleApp =
      connection.health.diagnostics["relayOwnedGoogleApp"]?.bool
      ?? (connection.credentialOwnership == .relayOwned)
    connection.credentialRequirements = connection.credentialRequirements.map { requirement in
      var copy = requirement
      if unavailableFieldSet.contains(copy.fieldKey) {
        copy.status = validation.status == .missingSecret ? .missing : .unavailable
      } else if copy.required && copy.secretReferenceId != nil {
        copy.status = .verified
      }
      return copy
    }
    connection.status =
      validation.isReady ? .connected : Self.googleOAuthConnectionStatus(for: validation)
    connection.authorizationState = validation.isReady ? .completed : .error
    connection.requiredScopes = Self.googleCalendarOAuthScopes
    if validation.isReady && !validation.grantedScopes.isEmpty {
      connection.grantedScopes = validation.grantedScopes
    }
    connection.health = ProviderConnectorHealth(
      state: validation.isReady ? .ready : .error,
      message: validation.message,
      lastCheckedAt: timestamp,
      missingScopes: validation.missingScopes,
      unavailableTools: validation.missingScopes.isEmpty
        ? [] : ["google_calendar_create_event", "google_calendar_update_event"],
      diagnostics: [
        "provider": .string("google-calendar"),
        "authMethod": .string(
          relayOwnedGoogleApp
            ? "google_oauth_relay_owned_calendar" : "google_oauth_user_owned_calendar"),
        "validation": .string(validation.status.rawValue),
        "unavailableCredentialFields": .array(unavailableFieldValues),
        "grantedScopes": .array(grantedScopeValues),
        "missingScopes": .array(missingScopeValues),
        "httpStatusCode": validation.httpStatusCode.map { .number(Double($0)) } ?? .null,
        "callbackURLRequired": .bool(false),
        "credentialOwnership": .string(connection.credentialOwnership.rawValue),
        "relayOwnedGoogleApp": .bool(relayOwnedGoogleApp),
        "secretStorage": .string("keychain-reference-only"),
        "restrictedScopes": .bool(true),
        "defaultCalendarId": .string(defaultCalendarId),
        "scopePreset": .string("calendar_events_read_write_freebusy"),
        "healthCheck": .string("google_oauth_refresh_calendarlist"),
      ],
      redactionStatus: "private-state-excluded"
    )
    connection.lastCheckedAt = timestamp
    connection.lastError = validation.isReady ? nil : validation.message
    connection.reauthorizeRequired = Self.googleOAuthReauthorizeRequired(for: validation)
    connection.updatedAt = timestamp
    let saved = try data.saveProviderConnection(connection)
    try synchronizeCatalogConnectionState(workspaceId: connection.workspaceId, app: app)
    return saved
  }

  @discardableResult
  func saveGoogleSearchConsoleHealthResult(
    _ validation: GoogleOAuthCredentialValidationResult,
    connection: inout MarketplaceProviderConnection,
    app: MarketplaceCatalogApp,
    now: Date
  ) throws -> MarketplaceProviderConnection {
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let unavailableFieldValues = validation.unavailableFields.map(JSONValue.string)
    let unavailableFieldSet = Set(validation.unavailableFields)
    let grantedScopeValues = validation.grantedScopes.map(JSONValue.string)
    let missingScopeValues = validation.missingScopes.map(JSONValue.string)
    let requirementsByKey = Dictionary(
      uniqueKeysWithValues: connection.credentialRequirements.map { ($0.fieldKey, $0) })
    let projectId = connection.health.diagnostics["projectId"]?.string?.providerConnectionNilIfEmpty
    let selectedSiteUrl =
      validation.selectedResourceId?.providerConnectionNilIfEmpty
      ?? connection.health.diagnostics["selectedSiteUrl"]?.string?.providerConnectionNilIfEmpty
    let accessTokenProvided =
      requirementsByKey["google_search_console_oauth_access_token"]?.secretReferenceId?
      .providerConnectionNilIfEmpty
      != nil
    let relayOwnedGoogleApp =
      connection.health.diagnostics["relayOwnedGoogleApp"]?.bool
      ?? (connection.credentialOwnership == .relayOwned)
    let ownershipLabel = connection.credentialOwnership.rawValue
    let authMethod =
      connection.credentialOwnership == .relayOwned
      ? "google_oauth_relay_owned_search_console"
      : "google_oauth_user_owned_search_console"
    connection.credentialRequirements = connection.credentialRequirements.map { requirement in
      var copy = requirement
      if unavailableFieldSet.contains(copy.fieldKey) {
        copy.status = validation.status == .missingSecret ? .missing : .unavailable
      } else if copy.fieldKey == "google_search_console_default_site_url" {
        if selectedSiteUrl == nil {
          copy.status = .missing
        } else if validation.status == .selectedPropertyUnavailable
          || validation.status == .noProperties
        {
          copy.status = .unavailable
        } else {
          copy.status = .verified
        }
      } else if copy.required && copy.secretReferenceId != nil {
        copy.status = .verified
      }
      return copy
    }
    connection.status =
      validation.isReady ? .connected : Self.googleOAuthConnectionStatus(for: validation)
    connection.authorizationState = validation.isReady ? .completed : .error
    connection.requiredScopes = Self.googleSearchConsoleOAuthScopes
    if validation.isReady && !validation.grantedScopes.isEmpty {
      connection.grantedScopes = validation.grantedScopes
    }
    let unavailableTools: [String] =
      validation.isReady
      ? []
      : [
        "google_search_console_properties_list",
        "google_search_console_search_analytics_query",
        "google_search_console_url_inspect",
        "google_search_console_sitemaps_list",
      ]
    connection.health = ProviderConnectorHealth(
      state: validation.isReady ? .ready : .error,
      message: validation.message,
      lastCheckedAt: timestamp,
      missingScopes: validation.missingScopes,
      unavailableTools: unavailableTools,
      diagnostics: [
        "provider": .string("google-search-console"),
        "authMethod": .string(authMethod),
        "validation": .string(validation.status.rawValue),
        "unavailableCredentialFields": .array(unavailableFieldValues),
        "grantedScopes": .array(grantedScopeValues),
        "missingScopes": .array(missingScopeValues),
        "httpStatusCode": validation.httpStatusCode.map { .number(Double($0)) } ?? .null,
        "callbackURLRequired": .bool(false),
        "credentialOwnership": .string(ownershipLabel),
        "relayOwnedGoogleApp": .bool(relayOwnedGoogleApp),
        "secretStorage": .string("keychain-reference-only"),
        "clientSecretProvided": .bool(true),
        "accessTokenProvided": .bool(accessTokenProvided),
        "projectIdProvided": .bool(projectId != nil),
        "projectId": projectId.map(JSONValue.string) ?? .null,
        "selectedSiteUrl": selectedSiteUrl.map(JSONValue.string) ?? .null,
        "accessiblePropertyCount": validation.accessibleResourceCount.map { .number(Double($0)) }
          ?? .null,
        "readOnlyV1": .bool(true),
        "writeScopeRequested": .bool(false),
        "scopePreset": .string("webmasters_readonly"),
        "healthCheck": .string("google_oauth_refresh_search_console_sites"),
      ],
      redactionStatus: "private-state-excluded"
    )
    connection.lastCheckedAt = timestamp
    connection.lastError = validation.isReady ? nil : validation.message
    connection.reauthorizeRequired = Self.googleOAuthReauthorizeRequired(for: validation)
    connection.updatedAt = timestamp
    let saved = try data.saveProviderConnection(connection)
    try synchronizeCatalogConnectionState(workspaceId: connection.workspaceId, app: app)
    return saved
  }

  @discardableResult
  func saveTelemetryDeckHealthResult(
    _ validation: TelemetryDeckPATValidationResult,
    connection: inout MarketplaceProviderConnection,
    app: MarketplaceCatalogApp,
    now: Date
  ) throws -> MarketplaceProviderConnection {
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let namespace = connection.health.diagnostics["namespace"]?.string?.providerConnectionNilIfEmpty
    let telemetryDeckAppId = connection.health.diagnostics["telemetryDeckAppId"]?.string?
      .providerConnectionNilIfEmpty
    let appDisplayName = connection.health.diagnostics["appDisplayName"]?.string?
      .providerConnectionNilIfEmpty
    let defaultInsightId = connection.health.diagnostics["defaultInsightId"]?.string?
      .providerConnectionNilIfEmpty
    connection.credentialRequirements = connection.credentialRequirements.map { requirement in
      var copy = requirement
      if copy.fieldKey == "telemetrydeck_personal_access_token" {
        switch validation.status {
        case .missingSecret:
          copy.status = .missing
        case .secretUnavailable:
          copy.status = .unavailable
        default:
          if copy.secretReferenceId != nil {
            copy.status = .verified
          }
        }
      }
      return copy
    }
    connection.status =
      validation.isReady ? .connected : Self.telemetryDeckConnectionStatus(for: validation)
    connection.authorizationState = validation.isReady ? .completed : .error
    connection.health = ProviderConnectorHealth(
      state: validation.isReady ? .ready : .error,
      message: validation.message,
      lastCheckedAt: timestamp,
      missingScopes: [],
      unavailableTools: [],
      diagnostics: [
        "provider": .string("telemetrydeck"),
        "authMethod": .string("personal_access_token"),
        "validation": .string(validation.status.rawValue),
        "httpStatusCode": validation.httpStatusCode.map { .number(Double($0)) } ?? .null,
        "userId": validation.userId.map(JSONValue.string) ?? .null,
        "userEmail": validation.userEmail.map(JSONValue.string) ?? .null,
        "organizationName": validation.organizationName.map(JSONValue.string) ?? .null,
        "namespace": namespace.map(JSONValue.string) ?? .null,
        "telemetryDeckAppId": telemetryDeckAppId.map(JSONValue.string) ?? .null,
        "appDisplayName": appDisplayName.map(JSONValue.string) ?? .null,
        "defaultInsightId": defaultInsightId.map(JSONValue.string) ?? .null,
        "callbackURLRequired": .bool(false),
        "credentialOwnership": .string("user-owned"),
        "relayOwnedTelemetryDeckApp": .bool(false),
        "secretStorage": .string("keychain-reference-only"),
        "rawTokenStoredInDatabase": .bool(false),
        "readOnlyV1": .bool(true),
        "ingestWrites": .string("blocked"),
        "rawScanExports": .string("blocked"),
        "adminActions": .string("blocked"),
        "healthEndpoint": .string("GET /api/v3/users/info"),
      ],
      redactionStatus: "private-state-excluded"
    )
    connection.lastCheckedAt = timestamp
    connection.lastError = validation.isReady ? nil : validation.message
    connection.reauthorizeRequired = Self.telemetryDeckReauthorizeRequired(for: validation)
    connection.updatedAt = timestamp
    let saved = try data.saveProviderConnection(connection)
    try synchronizeCatalogConnectionState(workspaceId: connection.workspaceId, app: app)
    return saved
  }

  @discardableResult
  func saveNotionHealthResult(
    _ validation: NotionTokenValidationResult,
    connection: inout MarketplaceProviderConnection,
    app: MarketplaceCatalogApp,
    now: Date
  ) throws -> MarketplaceProviderConnection {
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let authMethod =
      connection.health.diagnostics["authMethod"]?.string?.providerConnectionNilIfEmpty
      ?? connection.providerKey.split(separator: ":").last.map(String.init)
      ?? "personal_access_token"
    let modeLabel =
      connection.health.diagnostics["credentialModeLabel"]?.string?.providerConnectionNilIfEmpty
      ?? (authMethod == "internal_connection_token"
        ? "Internal connection token" : "Personal access token")

    connection.status =
      validation.isReady ? .connected : Self.notionConnectionStatus(for: validation)
    connection.authorizationState = validation.isReady ? .completed : .error
    connection.health = ProviderConnectorHealth(
      state: validation.isReady ? .ready : .error,
      message: validation.message,
      lastCheckedAt: timestamp,
      missingScopes: [],
      unavailableTools: [],
      diagnostics: [
        "provider": .string("notion"),
        "authMethod": .string(authMethod),
        "credentialModeLabel": .string(modeLabel),
        "validation": .string(validation.status.rawValue),
        "httpStatusCode": validation.httpStatusCode.map { .number(Double($0)) } ?? .null,
        "notionUserId": validation.userId.map { .string($0) } ?? .null,
        "notionUserType": validation.userType.map { .string($0) } ?? .null,
        "callbackURLRequired": .bool(false),
        "credentialOwnership": .string("user-owned"),
        "relayOwnedNotionApp": .bool(false),
        "secretStorage": .string("keychain-reference-only"),
        "rawTokenStoredInDatabase": .bool(false),
        "healthEndpoint": .string("GET /v1/users/me"),
      ],
      redactionStatus: "private-state-excluded"
    )
    connection.lastCheckedAt = timestamp
    connection.lastError = validation.isReady ? nil : validation.message
    connection.reauthorizeRequired = Self.notionReauthorizeRequired(for: validation)
    connection.updatedAt = timestamp
    let saved = try data.saveProviderConnection(connection)
    try synchronizeCatalogConnectionState(workspaceId: connection.workspaceId, app: app)
    return saved
  }

  @discardableResult
  func saveMicrosoftClarityHealthResult(
    _ validation: MicrosoftClarityTokenValidationResult,
    connection: inout MarketplaceProviderConnection,
    app: MarketplaceCatalogApp,
    now: Date
  ) throws -> MarketplaceProviderConnection {
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let projectLabel = connection.health.diagnostics["projectLabel"]?.string?
      .providerConnectionNilIfEmpty
    let projectURL = connection.health.diagnostics["projectURL"]?.string?
      .providerConnectionNilIfEmpty
    let projectId = connection.health.diagnostics["projectId"]?.string?.providerConnectionNilIfEmpty

    connection.status =
      validation.isReady ? .connected : Self.microsoftClarityConnectionStatus(for: validation)
    connection.authorizationState = validation.isReady ? .completed : .error
    connection.health = ProviderConnectorHealth(
      state: validation.isReady ? .ready : .error,
      message: validation.message,
      lastCheckedAt: timestamp,
      missingScopes: [],
      unavailableTools: [],
      diagnostics: [
        "provider": .string("microsoft-clarity"),
        "authMethod": .string("data_export_api_token"),
        "validation": .string(validation.status.rawValue),
        "httpStatusCode": validation.httpStatusCode.map { .number(Double($0)) } ?? .null,
        "metricGroupCount": .number(Double(validation.metricGroupCount)),
        "rowCount": .number(Double(validation.rowCount)),
        "projectLabel": projectLabel.map(JSONValue.string) ?? .null,
        "projectURL": projectURL.map(JSONValue.string) ?? .null,
        "projectId": projectId.map(JSONValue.string) ?? .null,
        "callbackURLRequired": .bool(false),
        "credentialOwnership": .string("user-owned"),
        "relayOwnedMicrosoftClarityApp": .bool(false),
        "secretStorage": .string("keychain-reference-only"),
        "rawTokenStoredInDatabase": .bool(false),
        "healthEndpoint": .string(
          "GET /export-data/api/v1/project-live-insights?numOfDays=1&dimension1=OS"),
        "quotaWarning": .string(
          "Each explicit check or live read may consume one of the 10 Microsoft Clarity Data Export API requests per project per day."
        ),
      ],
      redactionStatus: "private-state-excluded"
    )
    connection.lastCheckedAt = timestamp
    connection.lastError = validation.isReady ? nil : validation.message
    connection.reauthorizeRequired = Self.microsoftClarityReauthorizeRequired(for: validation)
    connection.updatedAt = timestamp
    let saved = try data.saveProviderConnection(connection)
    try synchronizeCatalogConnectionState(workspaceId: connection.workspaceId, app: app)
    return saved
  }

  @discardableResult
  func saveSentryHealthResult(
    _ validation: SentryTokenValidationResult,
    connection: inout MarketplaceProviderConnection,
    app: MarketplaceCatalogApp,
    now: Date
  ) throws -> MarketplaceProviderConnection {
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let organizationSlug =
      validation.organizationSlug?.providerConnectionNilIfEmpty
      ?? connection.health.diagnostics["organizationSlug"]?.string?.providerConnectionNilIfEmpty
      ?? connection.connectedHandle?.providerConnectionNilIfEmpty
      ?? ""
    let organizationName =
      validation.organizationName?.providerConnectionNilIfEmpty
      ?? connection.health.diagnostics["organizationName"]?.string?.providerConnectionNilIfEmpty
      ?? organizationSlug
    let baseURL =
      validation.baseURL?.providerConnectionNilIfEmpty
      ?? connection.health.diagnostics["baseURL"]?.string?.providerConnectionNilIfEmpty
      ?? "https://sentry.io"
    let defaultProjectSlug = connection.health.diagnostics["defaultProjectSlug"]?.string?
      .providerConnectionNilIfEmpty
    let defaultEnvironment = connection.health.diagnostics["defaultEnvironment"]?.string?
      .providerConnectionNilIfEmpty
    let missingScopes = validation.status == .insufficientScope ? ["org:read", "project:read"] : []
    let unavailableTools =
      validation.status == .insufficientScope
      ? [
        "sentry_list_projects", "sentry_search_issues", "sentry_get_issue", "sentry_get_event",
        "sentry_update_issue",
      ]
      : []

    connection.credentialRequirements = connection.credentialRequirements.map { requirement in
      var copy = requirement
      if copy.fieldKey == "sentry_auth_token" {
        switch validation.status {
        case .missingSecret:
          copy.status = .missing
        case .secretUnavailable:
          copy.status = .unavailable
        default:
          if copy.secretReferenceId != nil {
            copy.status = .verified
          }
        }
      }
      return copy
    }
    connection.status =
      validation.isReady ? .connected : Self.sentryConnectionStatus(for: validation)
    connection.authorizationState = validation.isReady ? .completed : .error
    connection.health = ProviderConnectorHealth(
      state: validation.isReady ? .ready : .error,
      message: validation.message,
      lastCheckedAt: timestamp,
      missingScopes: missingScopes,
      unavailableTools: unavailableTools,
      diagnostics: [
        "provider": .string("sentry"),
        "authMethod": .string("user_auth_token"),
        "validation": .string(validation.status.rawValue),
        "httpStatusCode": validation.httpStatusCode.map { .number(Double($0)) } ?? .null,
        "organizationSlug": .string(organizationSlug),
        "organizationName": .string(organizationName),
        "baseURL": .string(baseURL),
        "defaultProjectSlug": defaultProjectSlug.map(JSONValue.string) ?? .null,
        "defaultEnvironment": defaultEnvironment.map(JSONValue.string) ?? .null,
        "projectCountSampled": .number(Double(validation.projectCount)),
        "callbackURLRequired": .bool(false),
        "credentialOwnership": .string("user-owned"),
        "relayOwnedSentryApp": .bool(false),
        "secretStorage": .string("keychain-reference-only"),
        "rawTokenStoredInDatabase": .bool(false),
        "requiredScopes": .array(Self.sentryAuthTokenScopes.map(JSONValue.string)),
        "blockedAdminScopes": .array(
          [
            "project:write", "project:admin", "team:write", "team:admin", "org:write", "org:admin",
            "member:read", "member:write", "member:admin", "event:admin",
          ].map(JSONValue.string)),
        "healthEndpoint": .string(
          "GET /api/0/organizations/{organization_slug}/projects/?per_page=1"),
      ],
      redactionStatus: "private-state-excluded"
    )
    connection.connectedHandle = organizationName
    connection.lastCheckedAt = timestamp
    connection.lastError = validation.isReady ? nil : validation.message
    connection.reauthorizeRequired = Self.sentryReauthorizeRequired(for: validation)
    connection.updatedAt = timestamp
    let saved = try data.saveProviderConnection(connection)
    try synchronizeCatalogConnectionState(workspaceId: connection.workspaceId, app: app)
    return saved
  }

  @discardableResult
  func savePostHogHealthResult(
    _ validation: PostHogTokenValidationResult,
    connection: inout MarketplaceProviderConnection,
    app: MarketplaceCatalogApp,
    now: Date
  ) throws -> MarketplaceProviderConnection {
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let baseURL =
      validation.baseURL?.providerConnectionNilIfEmpty
      ?? connection.health.diagnostics["apiBaseURL"]?.string?.providerConnectionNilIfEmpty
      ?? "https://us.posthog.com"
    let organizationId =
      validation.organizationId?.providerConnectionNilIfEmpty
      ?? connection.health.diagnostics["organizationId"]?.string?.providerConnectionNilIfEmpty
    let organizationName =
      validation.organizationName?.providerConnectionNilIfEmpty
      ?? connection.health.diagnostics["organizationName"]?.string?.providerConnectionNilIfEmpty
    let projectId =
      validation.projectId?.providerConnectionNilIfEmpty
      ?? connection.health.diagnostics["projectId"]?.string?.providerConnectionNilIfEmpty
    let projectName =
      validation.projectName?.providerConnectionNilIfEmpty
      ?? connection.health.diagnostics["projectName"]?.string?.providerConnectionNilIfEmpty

    connection.status =
      validation.isReady ? .connected : Self.postHogConnectionStatus(for: validation)
    connection.authorizationState = validation.isReady ? .completed : .error
    connection.connectedHandle =
      projectName ?? projectId ?? organizationName ?? connection.connectedHandle
    connection.health = ProviderConnectorHealth(
      state: validation.isReady ? .ready : .error,
      message: validation.message,
      lastCheckedAt: timestamp,
      missingScopes: [],
      unavailableTools: [],
      diagnostics: [
        "provider": .string("posthog"),
        "authMethod": .string("personal_api_key"),
        "apiBaseURL": .string(baseURL),
        "organizationId": organizationId.map(JSONValue.string) ?? .null,
        "organizationName": organizationName.map(JSONValue.string) ?? .null,
        "projectId": projectId.map(JSONValue.string) ?? .null,
        "projectName": projectName.map(JSONValue.string) ?? .null,
        "validation": .string(validation.status.rawValue),
        "httpStatusCode": validation.httpStatusCode.map { .number(Double($0)) } ?? .null,
        "projectCount": .number(Double(validation.projectCount)),
        "callbackURLRequired": .bool(false),
        "credentialOwnership": .string("user-owned"),
        "relayOwnedPostHogApp": .bool(false),
        "secretStorage": .string("keychain-reference-only"),
        "rawTokenStoredInDatabase": .bool(false),
        "rawMCPExposure": .bool(false),
        "healthEndpoint": .string("GET /api/projects/"),
      ],
      redactionStatus: "private-state-excluded"
    )
    connection.lastCheckedAt = timestamp
    connection.lastError = validation.isReady ? nil : validation.message
    connection.reauthorizeRequired = Self.postHogReauthorizeRequired(for: validation)
    connection.updatedAt = timestamp
    let saved = try data.saveProviderConnection(connection)
    try synchronizeCatalogConnectionState(workspaceId: connection.workspaceId, app: app)
    return saved
  }
}
