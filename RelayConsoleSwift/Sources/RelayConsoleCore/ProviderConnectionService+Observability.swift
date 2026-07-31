import Foundation

extension ProviderConnectionService {
  @discardableResult
  public func connectNotionAPIToken(
    context: ServiceRequestContext,
    appIdOrSlug: RelayId,
    credentialMode: String,
    apiToken: String,
    workspaceLabel: String?,
    displayName: String? = nil,
    now: Date = Date()
  ) async throws -> MarketplaceProviderConnection {
    let validation = await validateNotionAPIToken(apiToken: apiToken)
    guard validation.isReady else {
      throw ServiceGuard.unavailable(
        context: context,
        reasonCode: validation.status == .invalidToken ? .authRequired : .runtimeUnavailable,
        message: validation.message
      )
    }
    return try saveNotionAPIToken(
      context: context,
      appIdOrSlug: appIdOrSlug,
      credentialMode: credentialMode,
      apiToken: apiToken,
      workspaceLabel: workspaceLabel,
      displayName: displayName,
      validationResult: validation,
      now: now
    )
  }

  @discardableResult
  public func saveNotionAPIToken(
    context: ServiceRequestContext,
    appIdOrSlug: RelayId,
    credentialMode: String,
    apiToken: String,
    workspaceLabel: String?,
    displayName: String? = nil,
    validationResult: NotionTokenValidationResult? = nil,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "notion")
    guard app.slug == "notion" else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "Notion API tokens can only be saved for the Notion Marketplace app.")
    }
    try validateAppCanAuthorize(app, context: context)
    let trimmedMode = credentialMode.trimmingCharacters(in: .whitespacesAndNewlines)
    let allowedModes = Set(["personal_access_token", "internal_connection_token"])
    guard allowedModes.contains(trimmedMode) else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "Choose Personal access token or Internal connection token for Notion.")
    }
    let trimmedToken = try requireNonEmptyString(
      apiToken, field: "Notion API token", maxLength: 20000)
    let trimmedWorkspaceLabel = workspaceLabel?.providerConnectionNilIfEmpty
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let connectionId = existing?.id ?? createRelayId("mpc")
    let existingSecretIds = existing.map { Self.secretReferenceIds(in: $0) } ?? []
    for secretId in existingSecretIds {
      _ = try? secrets.delete(secretId)
    }

    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let validation =
      validationResult
      ?? NotionTokenValidationResult(
        status: .ready,
        message:
          "Notion API token saved as a Keychain reference. Run a health check to verify live Notion access."
      )
    let tokenReference = try secrets.set(
      scope: "provider_connection",
      scopeId: connectionId,
      label: "Notion API token",
      secretValue: trimmedToken
    )
    let modeLabel =
      trimmedMode == "personal_access_token" ? "Personal access token" : "Internal connection token"
    let connection = MarketplaceProviderConnection(
      id: connectionId,
      workspaceId: context.workspaceId,
      appId: app.id,
      appSlug: app.slug,
      providerKey: "notion-user-token:\(trimmedMode)",
      providerName: "Notion",
      status: validation.isReady ? .connected : Self.notionConnectionStatus(for: validation),
      authorizationState: validation.isReady ? .completed : .error,
      credentialOwnership: .userOwned,
      userOwnedCredentialsRequired: true,
      credentialRequirements: [
        ProviderCredentialRequirement(
          fieldKey: "notion_credential_mode",
          label: "Credential mode",
          required: true,
          userOwnedRequired: true,
          secretReferenceId: nil,
          status: .verified,
          helpText: "Selected by the user in Relay. This is non-secret metadata.",
          redactionStatus: "private-state-excluded"
        ),
        ProviderCredentialRequirement(
          fieldKey: "notion_api_token",
          label: "Notion API token",
          required: true,
          userOwnedRequired: true,
          secretReferenceId: tokenReference.id,
          status: .verified,
          helpText: "User-owned Notion bearer token stored only as a Keychain reference.",
          redactionStatus: "secret-reference-only"
        ),
        ProviderCredentialRequirement(
          fieldKey: "notion_workspace_label",
          label: "Workspace label",
          required: false,
          userOwnedRequired: false,
          secretReferenceId: nil,
          status: trimmedWorkspaceLabel == nil ? .missing : .verified,
          helpText: "Optional non-secret label to help identify the connected workspace.",
          redactionStatus: "private-state-excluded"
        ),
      ],
      secretReferenceIds: [tokenReference.id],
      accountLabel: displayName?.providerConnectionNilIfEmpty ?? existing?.accountLabel
        ?? trimmedWorkspaceLabel
        ?? "Notion workspace token",
      connectedHandle: trimmedWorkspaceLabel,
      callbackURL: nil,
      requiredScopes: Self.notionTokenCapabilities,
      grantedScopes: Self.notionTokenCapabilities,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: validation.isReady ? .ready : .error,
        message: validation.message,
        lastCheckedAt: timestamp,
        missingScopes: [],
        unavailableTools: [],
        diagnostics: [
          "provider": .string("notion"),
          "authMethod": .string(trimmedMode),
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
        ],
        redactionStatus: "private-state-excluded"
      ),
      senderIdentities: [],
      installPolicy: "approval_gated_workspace_content",
      lastCheckedAt: timestamp,
      lastError: validation.isReady ? nil : validation.message,
      manualEvidenceNote: nil,
      reauthorizeRequired: Self.notionReauthorizeRequired(for: validation),
      disconnecting: false,
      betaBlocked: false,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
      redactionStatus: "private-state-excluded"
    )
    return try saveConnection(context: context, connection: connection)
  }

  @discardableResult
  public func validateSavedNotionConnection(
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
      context: context, appIdOrSlug: connection.appId, fallbackSlug: "notion")
    guard app.slug == "notion", connection.appId == app.id else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Only Notion API token connections can be tested here.")
    }
    let secretId =
      connection.credentialRequirements.first { $0.fieldKey == "notion_api_token" }?
      .secretReferenceId
      ?? Self.secretReferenceIds(in: connection).first
    guard let secretId else {
      let validation = NotionTokenValidationResult(
        status: .missingSecret,
        message: "Notion connection is missing a Keychain token reference."
      )
      return try saveNotionHealthResult(validation, connection: &connection, app: app, now: now)
    }
    let token: String
    do {
      token = try secrets.getSecretValue(secretId)
    } catch {
      let validation = NotionTokenValidationResult(
        status: .secretUnavailable,
        message:
          "Relay could not read the saved Notion token from the OS secret store. Replace the Notion token in Marketplace."
      )
      return try saveNotionHealthResult(validation, connection: &connection, app: app, now: now)
    }
    let validation = await validateNotionAPIToken(apiToken: token)
    return try saveNotionHealthResult(validation, connection: &connection, app: app, now: now)
  }

  @discardableResult
  public func connectPostHogPersonalAPIKey(
    context: ServiceRequestContext,
    appIdOrSlug: RelayId,
    baseURL: String,
    personalAPIKey: String,
    organizationId: String?,
    organizationName: String?,
    projectId: String?,
    projectName: String?,
    displayName: String? = nil,
    now: Date = Date()
  ) async throws -> MarketplaceProviderConnection {
    let validation = await validatePostHogPersonalAPIKey(
      personalAPIKey: personalAPIKey,
      baseURL: baseURL,
      projectId: projectId
    )
    guard validation.isReady else {
      throw ServiceGuard.unavailable(
        context: context,
        reasonCode: validation.status == .invalidToken || validation.status == .forbidden
          ? .authRequired : .runtimeUnavailable,
        message: validation.message
      )
    }
    return try savePostHogPersonalAPIKeyConnection(
      context: context,
      appIdOrSlug: appIdOrSlug,
      baseURL: validation.baseURL ?? baseURL,
      personalAPIKey: personalAPIKey,
      organizationId: organizationId?.providerConnectionNilIfEmpty ?? validation.organizationId,
      organizationName: organizationName?.providerConnectionNilIfEmpty
        ?? validation.organizationName,
      projectId: projectId?.providerConnectionNilIfEmpty ?? validation.projectId,
      projectName: projectName?.providerConnectionNilIfEmpty ?? validation.projectName,
      displayName: displayName,
      validationResult: validation,
      now: now
    )
  }

  @discardableResult
  public func savePostHogPersonalAPIKeyConnection(
    context: ServiceRequestContext,
    appIdOrSlug: RelayId,
    baseURL: String,
    personalAPIKey: String,
    organizationId: String?,
    organizationName: String?,
    projectId: String?,
    projectName: String?,
    displayName: String? = nil,
    validationResult: PostHogTokenValidationResult? = nil,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "posthog")
    guard app.slug == "posthog" else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "PostHog personal API keys can only be saved for the PostHog Marketplace app.")
    }
    try validateAppCanAuthorize(app, context: context)
    let trimmedKey = try requireNonEmptyString(
      personalAPIKey, field: "PostHog personal API key", maxLength: 20000)
    let normalizedBaseURL = try Self.normalizedPostHogBaseURLString(baseURL)
    let trimmedOrganizationId =
      organizationId?.providerConnectionNilIfEmpty ?? validationResult?.organizationId
    let trimmedOrganizationName =
      organizationName?.providerConnectionNilIfEmpty ?? validationResult?.organizationName
    let trimmedProjectId = projectId?.providerConnectionNilIfEmpty ?? validationResult?.projectId
    let trimmedProjectName =
      projectName?.providerConnectionNilIfEmpty ?? validationResult?.projectName
    let existingCount = try data.listProviderConnections(
      workspaceId: context.workspaceId, appId: app.id
    ).count
    let connectionId = createRelayId("mpc")
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let connectionName = try requireNonEmptyString(
      displayName?.providerConnectionNilIfEmpty
        ?? trimmedProjectName
        ?? trimmedOrganizationName
        ?? "PostHog project \(existingCount + 1)",
      field: "Connection name",
      maxLength: 120
    )
    let tokenReference = try secrets.set(
      scope: "provider_connection",
      scopeId: connectionId,
      label: "PostHog personal API key",
      secretValue: trimmedKey
    )
    let healthMessage =
      validationResult?.message
      ?? "PostHog personal API key saved as a Keychain reference. Use Check connection or a bounded live read to verify project access."
    let healthState: ProviderConnectorHealthState =
      validationResult.map { $0.isReady ? .ready : .error } ?? .degraded
    let connectionStatus: ProviderConnectionStatus =
      validationResult.map { $0.isReady ? .connected : Self.postHogConnectionStatus(for: $0) }
      ?? .connected
    let checkedAt = validationResult == nil ? nil : timestamp
    let connection = MarketplaceProviderConnection(
      id: connectionId,
      workspaceId: context.workspaceId,
      appId: app.id,
      appSlug: app.slug,
      providerKey: "posthog-personal-api-key:\(trimmedProjectId ?? connectionId)",
      providerName: "PostHog",
      status: connectionStatus,
      authorizationState: connectionStatus == .connected ? .completed : .error,
      credentialOwnership: .userOwned,
      userOwnedCredentialsRequired: true,
      credentialRequirements: [
        ProviderCredentialRequirement(
          fieldKey: "posthog_api_base_url",
          label: "PostHog API base URL",
          required: true,
          userOwnedRequired: true,
          secretReferenceId: nil,
          status: .verified,
          helpText:
            "Non-secret PostHog API base URL, such as https://us.posthog.com, https://eu.posthog.com, or a self-hosted domain.",
          redactionStatus: "private-state-excluded"
        ),
        ProviderCredentialRequirement(
          fieldKey: "posthog_personal_api_key",
          label: "PostHog personal API key",
          required: true,
          userOwnedRequired: true,
          secretReferenceId: tokenReference.id,
          status: .verified,
          helpText: "User-owned PostHog personal API key stored only as a Keychain reference.",
          redactionStatus: "secret-reference-only"
        ),
        ProviderCredentialRequirement(
          fieldKey: "posthog_organization_id",
          label: "Organization ID",
          required: false,
          userOwnedRequired: false,
          secretReferenceId: nil,
          status: trimmedOrganizationId == nil ? .missing : .verified,
          helpText: "Optional non-secret PostHog organization identifier.",
          redactionStatus: "private-state-excluded"
        ),
        ProviderCredentialRequirement(
          fieldKey: "posthog_project_id",
          label: "Project ID",
          required: false,
          userOwnedRequired: false,
          secretReferenceId: nil,
          status: trimmedProjectId == nil ? .missing : .verified,
          helpText:
            "Optional non-secret PostHog project or environment id. When empty, Relay uses bounded project discovery.",
          redactionStatus: "private-state-excluded"
        ),
      ],
      secretReferenceIds: [tokenReference.id],
      accountLabel: connectionName,
      connectedHandle: trimmedProjectName ?? trimmedProjectId ?? trimmedOrganizationName,
      callbackURL: nil,
      requiredScopes: Self.postHogReadScopes,
      grantedScopes: Self.postHogReadScopes,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: healthState,
        message: healthMessage,
        lastCheckedAt: checkedAt,
        missingScopes: [],
        unavailableTools: [],
        diagnostics: [
          "provider": .string("posthog"),
          "authMethod": .string("personal_api_key"),
          "apiBaseURL": .string(normalizedBaseURL),
          "organizationId": trimmedOrganizationId.map(JSONValue.string) ?? .null,
          "organizationName": trimmedOrganizationName.map(JSONValue.string) ?? .null,
          "projectId": trimmedProjectId.map(JSONValue.string) ?? .null,
          "projectName": trimmedProjectName.map(JSONValue.string) ?? .null,
          "validation": validationResult.map { .string($0.status.rawValue) }
            ?? .string("saved_unverified"),
          "httpStatusCode": validationResult?.httpStatusCode.map { .number(Double($0)) } ?? .null,
          "projectCount": .number(Double(validationResult?.projectCount ?? 0)),
          "callbackURLRequired": .bool(false),
          "credentialOwnership": .string("user-owned"),
          "relayOwnedPostHogApp": .bool(false),
          "secretStorage": .string("keychain-reference-only"),
          "rawTokenStoredInDatabase": .bool(false),
          "rawMCPExposure": .bool(false),
          "healthEndpoint": .string("GET /api/projects/"),
        ],
        redactionStatus: "private-state-excluded"
      ),
      senderIdentities: [],
      installPolicy: "read_only_product_analytics",
      lastCheckedAt: checkedAt,
      lastError: validationResult?.isReady == false ? validationResult?.message : nil,
      manualEvidenceNote: nil,
      reauthorizeRequired: validationResult.map { Self.postHogReauthorizeRequired(for: $0) }
        ?? false,
      disconnecting: false,
      betaBlocked: false,
      createdAt: timestamp,
      updatedAt: timestamp,
      redactionStatus: "private-state-excluded"
    )
    return try saveConnection(context: context, connection: connection)
  }

  @discardableResult
  public func connectPostHogRelayOwnedOAuth(
    context: ServiceRequestContext,
    appIdOrSlug: RelayId,
    apiBaseURL: String,
    accessToken: String,
    refreshToken: String,
    clientMetadataURL: String,
    redirectURI: String,
    grantedScopes: [String],
    expiresAt: String?,
    organizationId: String?,
    organizationName: String?,
    projectId: String?,
    projectName: String?,
    displayName: String? = nil,
    now: Date = Date()
  ) async throws -> MarketplaceProviderConnection {
    let validation = await validatePostHogPersonalAPIKey(
      personalAPIKey: accessToken,
      baseURL: apiBaseURL,
      projectId: projectId
    )
    guard validation.isReady else {
      throw ServiceGuard.unavailable(
        context: context,
        reasonCode: validation.status == .invalidToken || validation.status == .forbidden
          ? .authRequired : .runtimeUnavailable,
        message: validation.message
      )
    }
    return try savePostHogRelayOwnedOAuthConnection(
      context: context,
      appIdOrSlug: appIdOrSlug,
      apiBaseURL: validation.baseURL ?? apiBaseURL,
      accessToken: accessToken,
      refreshToken: refreshToken,
      clientMetadataURL: clientMetadataURL,
      redirectURI: redirectURI,
      grantedScopes: grantedScopes,
      expiresAt: expiresAt,
      organizationId: organizationId?.providerConnectionNilIfEmpty ?? validation.organizationId,
      organizationName: organizationName?.providerConnectionNilIfEmpty
        ?? validation.organizationName,
      projectId: projectId?.providerConnectionNilIfEmpty ?? validation.projectId,
      projectName: projectName?.providerConnectionNilIfEmpty ?? validation.projectName,
      displayName: displayName,
      validationResult: validation,
      now: now
    )
  }

  @discardableResult
  public func savePostHogRelayOwnedOAuthConnection(
    context: ServiceRequestContext,
    appIdOrSlug: RelayId,
    apiBaseURL: String,
    accessToken: String,
    refreshToken: String,
    clientMetadataURL: String,
    redirectURI: String,
    grantedScopes: [String] = ProviderConnectionService.postHogReadScopes,
    expiresAt: String?,
    organizationId: String?,
    organizationName: String?,
    projectId: String?,
    projectName: String?,
    displayName: String? = nil,
    validationResult: PostHogTokenValidationResult? = nil,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "posthog")
    guard app.slug == "posthog" else {
      throw ServiceGuard.invalidInput(
        context: context, message: "PostHog OAuth can only be saved for PostHog.")
    }
    try validateAppCanAuthorize(app, context: context)
    guard grantedScopes == Self.postHogReadScopes else {
      throw ServiceGuard.invalidInput(
        context: context, message: "PostHog OAuth requires the exact seven read-only V1 scopes.")
    }
    let access = try requireNonEmptyString(
      accessToken, field: "PostHog OAuth access token", maxLength: 30000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "PostHog OAuth refresh token", maxLength: 30000)
    let normalizedBaseURL = try Self.normalizedPostHogBaseURLString(apiBaseURL)
    guard let metadataURL = URL(string: clientMetadataURL), metadataURL.scheme == "https",
      metadataURL.host?.providerConnectionNilIfEmpty != nil
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "PostHog OAuth client metadata must use an HTTPS URL owned by Relay.")
    }
    guard let callback = URL(string: redirectURI), callback.scheme == "http",
      callback.host == "127.0.0.1", callback.path == "/oauth/posthog/callback"
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "PostHog native OAuth must return to Relay's fixed loopback callback path.")
    }
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first { $0.credentialOwnership == .relayOwned }
    let connectionId = existing?.id ?? createRelayId("mpc")
    let oldRefs = existing.map(Self.secretReferenceIds(in:)) ?? []
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: connectionId, label: "PostHog OAuth access token",
      secretValue: access)
    let refreshRef: SecretReference
    do {
      refreshRef = try secrets.set(
        scope: "provider_connection", scopeId: connectionId, label: "PostHog OAuth refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let resolvedOrganizationId =
      organizationId?.providerConnectionNilIfEmpty ?? validationResult?.organizationId
    let resolvedOrganizationName =
      organizationName?.providerConnectionNilIfEmpty ?? validationResult?.organizationName
    let resolvedProjectId = projectId?.providerConnectionNilIfEmpty ?? validationResult?.projectId
    let resolvedProjectName =
      projectName?.providerConnectionNilIfEmpty ?? validationResult?.projectName
    let label =
      displayName?.providerConnectionNilIfEmpty ?? resolvedProjectName ?? resolvedOrganizationName
      ?? "PostHog OAuth project"
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "posthog_oauth_access_token", label: "PostHog OAuth access token", required: true,
        userOwnedRequired: false, secretReferenceId: accessRef.id, status: .verified,
        helpText: "Short-lived access token stored only as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "posthog_oauth_refresh_token", label: "PostHog OAuth refresh token",
        required: true, userOwnedRequired: false, secretReferenceId: refreshRef.id,
        status: .verified,
        helpText:
          "Refresh token stored separately for complete provider-returned pair replacement.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "posthog_api_base_url", label: "PostHog API base URL", required: true,
        userOwnedRequired: false, secretReferenceId: nil, status: .verified,
        helpText: "Exact US or EU PostHog Cloud API origin selected before consent.",
        redactionStatus: "private-state-excluded"),
      ProviderCredentialRequirement(
        fieldKey: "posthog_project_id", label: "Project or environment ID", required: false,
        userOwnedRequired: false, secretReferenceId: nil,
        status: resolvedProjectId == nil ? .missing : .verified,
        helpText: "Non-secret project boundary discovered from the grant.",
        redactionStatus: "private-state-excluded"),
    ]
    let connection = MarketplaceProviderConnection(
      id: connectionId, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "posthog-relay-owned-oauth:" + (resolvedProjectId ?? connectionId),
      providerName: "PostHog",
      status: .connected, authorizationState: .completed, credentialOwnership: .relayOwned,
      userOwnedCredentialsRequired: false,
      credentialRequirements: requirements, secretReferenceIds: [accessRef.id, refreshRef.id],
      accountLabel: String(label.prefix(120)),
      connectedHandle: resolvedProjectName ?? resolvedProjectId ?? resolvedOrganizationName,
      callbackURL: redirectURI,
      requiredScopes: Self.postHogReadScopes, grantedScopes: grantedScopes,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message: validationResult?.message
          ?? "PostHog OAuth grant is ready for bounded read-only V1.", lastCheckedAt: timestamp,
        missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("posthog"),
          "authMethod": .string("oauth2_authorization_code_pkce_cimd"),
          "relayOwnedPostHogOAuth": .bool(true),
          "clientMetadataURL": .string(metadataURL.absoluteString),
          "apiBaseURL": .string(normalizedBaseURL),
          "organizationId": resolvedOrganizationId.map(JSONValue.string) ?? .null,
          "organizationName": resolvedOrganizationName.map(JSONValue.string) ?? .null,
          "projectId": resolvedProjectId.map(JSONValue.string) ?? .null,
          "projectName": resolvedProjectName.map(JSONValue.string) ?? .null,
          "accessExpiresAt": expiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
          "pkceMethod": .string("S256"),
          "exactScopes": .array(Self.postHogReadScopes.map(JSONValue.string)),
          "refreshPairReplacement": .string(
            "serialized-complete-provider-returned-pair-replacement"),
          "rawTokenStoredInDatabase": .bool(false), "rawMCPExposure": .bool(false),
          "writeScopesAllowed": .bool(false), "arbitraryHogQLAllowed": .bool(false),
        ], redactionStatus: "private-state-excluded"), senderIdentities: [],
      installPolicy: "read_only_product_analytics",
      lastCheckedAt: timestamp, lastError: nil, manualEvidenceNote: nil, reauthorizeRequired: false,
      disconnecting: false, betaBlocked: false,
      createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp,
      redactionStatus: "private-state-excluded"
    )
    do {
      let saved = try saveConnection(context: context, connection: connection)
      for old in oldRefs where !saved.secretReferenceIds.contains(old) {
        _ = try? secrets.delete(old)
      }
      return saved
    } catch {
      _ = try? secrets.delete(accessRef.id)
      _ = try? secrets.delete(refreshRef.id)
      throw error
    }
  }

  @discardableResult
  public func rotatePostHogOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String, expiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    postHogTokenRotationLock.lock()
    defer { postHogTokenRotationLock.unlock() }
    guard
      let existing = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      existing.appSlug == "posthog", existing.credentialOwnership == .relayOwned
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "A Relay-owned PostHog OAuth connection is required for token rotation.")
    }
    let d = existing.health.diagnostics
    return try savePostHogRelayOwnedOAuthConnection(
      context: context, appIdOrSlug: existing.appId, apiBaseURL: d["apiBaseURL"]?.string ?? "",
      accessToken: accessToken, refreshToken: refreshToken,
      clientMetadataURL: d["clientMetadataURL"]?.string ?? "",
      redirectURI: existing.callbackURL ?? "", grantedScopes: existing.grantedScopes,
      expiresAt: expiresAt, organizationId: d["organizationId"]?.string,
      organizationName: d["organizationName"]?.string, projectId: d["projectId"]?.string,
      projectName: d["projectName"]?.string, displayName: existing.accountLabel, now: now)
  }

  @discardableResult
  public func validateSavedPostHogConnection(
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
      context: context, appIdOrSlug: connection.appId, fallbackSlug: "posthog")
    guard app.slug == "posthog", connection.appId == app.id else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Only PostHog provider connections can be checked here.")
    }
    let secretId =
      connection.credentialRequirements.first {
        $0.fieldKey == "posthog_oauth_access_token" || $0.fieldKey == "posthog_personal_api_key"
      }?.secretReferenceId
      ?? Self.secretReferenceIds(in: connection).first
    guard let secretId else {
      let validation = PostHogTokenValidationResult(
        status: .invalidToken,
        message: "PostHog connection is missing a Keychain token reference."
      )
      return try savePostHogHealthResult(validation, connection: &connection, app: app, now: now)
    }
    let token: String
    do {
      token = try secrets.getSecretValue(secretId)
    } catch {
      let validation = PostHogTokenValidationResult(
        status: .invalidToken,
        message:
          "Relay could not read the saved PostHog key from the OS secret store. Replace the key in Marketplace."
      )
      return try savePostHogHealthResult(validation, connection: &connection, app: app, now: now)
    }
    let baseURL =
      connection.health.diagnostics["apiBaseURL"]?.string?.providerConnectionNilIfEmpty
      ?? "https://us.posthog.com"
    let projectId = connection.health.diagnostics["projectId"]?.string?.providerConnectionNilIfEmpty
    let validation = await validatePostHogPersonalAPIKey(
      personalAPIKey: token, baseURL: baseURL, projectId: projectId)
    return try savePostHogHealthResult(validation, connection: &connection, app: app, now: now)
  }

  @discardableResult
  public func saveMicrosoftClarityAPIToken(
    context: ServiceRequestContext,
    appIdOrSlug: RelayId,
    apiToken: String,
    projectLabel: String?,
    projectURL: String?,
    projectId: String?,
    displayName: String? = nil,
    validationResult: MicrosoftClarityTokenValidationResult? = nil,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "microsoft-clarity")
    guard app.slug == "microsoft-clarity" else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "Microsoft Clarity API tokens can only be saved for the Microsoft Clarity Marketplace app."
      )
    }
    try validateAppCanAuthorize(app, context: context)
    let trimmedToken = try requireNonEmptyString(
      apiToken, field: "Microsoft Clarity Data Export API token", maxLength: 20000)
    let trimmedProjectLabel = projectLabel?.providerConnectionNilIfEmpty
    let trimmedProjectURL = projectURL?.providerConnectionNilIfEmpty
    let trimmedProjectId = projectId?.providerConnectionNilIfEmpty
    let existingCount = try data.listProviderConnections(
      workspaceId: context.workspaceId, appId: app.id
    ).count
    let connectionId = createRelayId("mpc")
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let validation = validationResult
    let fallbackProjectName = trimmedProjectId.map { "Clarity project \($0)" }
    let connectionName: String
    if let trimmedDisplayName = displayName?.providerConnectionNilIfEmpty {
      connectionName = trimmedDisplayName
    } else if let trimmedProjectLabel {
      connectionName = trimmedProjectLabel
    } else if let trimmedProjectURL {
      connectionName = trimmedProjectURL
    } else if let fallbackProjectName {
      connectionName = fallbackProjectName
    } else {
      connectionName = "Microsoft Clarity project \(existingCount + 1)"
    }
    let tokenReference = try secrets.set(
      scope: "provider_connection",
      scopeId: connectionId,
      label: "Microsoft Clarity Data Export API token",
      secretValue: trimmedToken
    )
    let healthMessage =
      validation?.message
      ?? "Microsoft Clarity API token saved as a Keychain reference. Use Check connection or a bounded live read to verify; each check may consume one of the 10 daily Data Export API requests."
    let healthState: ProviderConnectorHealthState
    let connectionStatus: ProviderConnectionStatus
    let reauthorizeRequired: Bool
    if let validation {
      healthState = validation.isReady ? .ready : .error
      connectionStatus =
        validation.isReady ? .connected : Self.microsoftClarityConnectionStatus(for: validation)
      reauthorizeRequired = Self.microsoftClarityReauthorizeRequired(for: validation)
    } else {
      healthState = .degraded
      connectionStatus = .connected
      reauthorizeRequired = false
    }
    let checkedAt = validation == nil ? nil : timestamp
    let connection = MarketplaceProviderConnection(
      id: connectionId,
      workspaceId: context.workspaceId,
      appId: app.id,
      appSlug: app.slug,
      providerKey: "microsoft-clarity-data-export:\(trimmedProjectId ?? connectionId)",
      providerName: "Microsoft Clarity",
      status: connectionStatus,
      authorizationState: connectionStatus == .connected ? .completed : .error,
      credentialOwnership: .userOwned,
      userOwnedCredentialsRequired: true,
      credentialRequirements: [
        ProviderCredentialRequirement(
          fieldKey: "microsoft_clarity_api_token",
          label: "Data Export API token",
          required: true,
          userOwnedRequired: true,
          secretReferenceId: tokenReference.id,
          status: .verified,
          helpText:
            "User-owned Microsoft Clarity project Data Export API token stored only as a Keychain reference.",
          redactionStatus: "secret-reference-only"
        ),
        ProviderCredentialRequirement(
          fieldKey: "microsoft_clarity_project_label",
          label: "Project or site label",
          required: false,
          userOwnedRequired: false,
          secretReferenceId: nil,
          status: trimmedProjectLabel == nil ? .missing : .verified,
          helpText: "Optional non-secret label for the connected Microsoft Clarity project.",
          redactionStatus: "private-state-excluded"
        ),
        ProviderCredentialRequirement(
          fieldKey: "microsoft_clarity_project_url",
          label: "Project or site URL",
          required: false,
          userOwnedRequired: false,
          secretReferenceId: nil,
          status: trimmedProjectURL == nil ? .missing : .verified,
          helpText: "Optional non-secret site URL to help identify the connected project.",
          redactionStatus: "private-state-excluded"
        ),
        ProviderCredentialRequirement(
          fieldKey: "microsoft_clarity_project_id",
          label: "Project ID",
          required: false,
          userOwnedRequired: false,
          secretReferenceId: nil,
          status: trimmedProjectId == nil ? .missing : .verified,
          helpText: "Optional non-secret Microsoft Clarity project identifier.",
          redactionStatus: "private-state-excluded"
        ),
      ],
      secretReferenceIds: [tokenReference.id],
      accountLabel: connectionName,
      connectedHandle: trimmedProjectLabel ?? trimmedProjectURL ?? trimmedProjectId,
      callbackURL: nil,
      requiredScopes: Self.microsoftClarityDataExportCapabilities,
      grantedScopes: Self.microsoftClarityDataExportCapabilities,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: healthState,
        message: healthMessage,
        lastCheckedAt: checkedAt,
        missingScopes: [],
        unavailableTools: [],
        diagnostics: [
          "provider": .string("microsoft-clarity"),
          "authMethod": .string("data_export_api_token"),
          "validation": validation.map { .string($0.status.rawValue) }
            ?? .string("saved_unverified"),
          "httpStatusCode": validation?.httpStatusCode.map { .number(Double($0)) } ?? .null,
          "metricGroupCount": .number(Double(validation?.metricGroupCount ?? 0)),
          "rowCount": .number(Double(validation?.rowCount ?? 0)),
          "projectLabel": trimmedProjectLabel.map(JSONValue.string) ?? .null,
          "projectURL": trimmedProjectURL.map(JSONValue.string) ?? .null,
          "projectId": trimmedProjectId.map(JSONValue.string) ?? .null,
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
      ),
      senderIdentities: [],
      installPolicy: "read_only_project_live_insights",
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
  public func validateSavedMicrosoftClarityConnection(
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
      context: context, appIdOrSlug: connection.appId, fallbackSlug: "microsoft-clarity")
    guard app.slug == "microsoft-clarity", connection.appId == app.id else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "Only Microsoft Clarity API token connections can be checked here.")
    }
    let secretId =
      connection.credentialRequirements.first { $0.fieldKey == "microsoft_clarity_api_token" }?
      .secretReferenceId
      ?? Self.secretReferenceIds(in: connection).first
    guard let secretId else {
      let validation = MicrosoftClarityTokenValidationResult(
        status: .missingSecret,
        message: "Microsoft Clarity connection is missing a Keychain token reference."
      )
      return try saveMicrosoftClarityHealthResult(
        validation, connection: &connection, app: app, now: now)
    }
    let token: String
    do {
      token = try secrets.getSecretValue(secretId)
    } catch {
      let validation = MicrosoftClarityTokenValidationResult(
        status: .secretUnavailable,
        message:
          "Relay could not read the saved Microsoft Clarity token from the OS secret store. Replace the token in Marketplace."
      )
      return try saveMicrosoftClarityHealthResult(
        validation, connection: &connection, app: app, now: now)
    }
    let validation = await validateMicrosoftClarityAPIToken(apiToken: token)
    return try saveMicrosoftClarityHealthResult(
      validation, connection: &connection, app: app, now: now)
  }

  @discardableResult
  public func connectSentryAuthToken(
    context: ServiceRequestContext,
    appIdOrSlug: RelayId,
    authToken: String,
    organizationSlug: String,
    baseURL: String?,
    defaultProjectSlug: String?,
    defaultEnvironment: String?,
    displayName: String? = nil,
    now: Date = Date()
  ) async throws -> MarketplaceProviderConnection {
    let validation = await validateSentryAuthToken(
      authToken: authToken,
      organizationSlug: organizationSlug,
      baseURL: baseURL
    )
    guard validation.isReady else {
      throw ServiceGuard.unavailable(
        context: context,
        reasonCode: Self.sentryReauthorizeRequired(for: validation)
          ? .authRequired : .runtimeUnavailable,
        message: validation.message
      )
    }
    return try saveSentryAuthToken(
      context: context,
      appIdOrSlug: appIdOrSlug,
      authToken: authToken,
      organizationSlug: organizationSlug,
      baseURL: baseURL,
      defaultProjectSlug: defaultProjectSlug,
      defaultEnvironment: defaultEnvironment,
      displayName: displayName,
      validationResult: validation,
      now: now
    )
  }

  @discardableResult
  public func connectSentryRelayOwnedOAuth(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    clientId: String, organizationSlug: String, baseURL: String?, defaultProjectSlug: String?,
    defaultEnvironment: String?, grantedScopes: [String], expiresAt: String?,
    displayName: String? = nil, now: Date = Date()
  ) async throws -> MarketplaceProviderConnection {
    guard grantedScopes == Self.sentryAuthTokenScopes else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Sentry OAuth requires the exact V1 scopes.")
    }
    let validation = await validateSentryAuthToken(
      authToken: accessToken, organizationSlug: organizationSlug, baseURL: baseURL)
    guard validation.isReady else {
      throw ServiceGuard.unavailable(
        context: context,
        reasonCode: Self.sentryReauthorizeRequired(for: validation)
          ? .authRequired : .runtimeUnavailable, message: validation.message)
    }
    var connection = try saveSentryAuthToken(
      context: context, appIdOrSlug: appIdOrSlug, authToken: accessToken,
      organizationSlug: organizationSlug, baseURL: baseURL, defaultProjectSlug: defaultProjectSlug,
      defaultEnvironment: defaultEnvironment, displayName: displayName,
      validationResult: validation, now: now)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "Sentry OAuth refresh token", maxLength: 30000)
    let cid = try requireNonEmptyString(clientId, field: "Sentry OAuth client ID", maxLength: 500)
    let refreshRef = try secrets.set(
      scope: "provider_connection", scopeId: connection.id, label: "Sentry OAuth refresh token",
      secretValue: refresh)
    connection.credentialRequirements =
      connection.credentialRequirements.map { value in
        var copy = value
        if copy.fieldKey == "sentry_auth_token" {
          copy.fieldKey = "sentry_oauth_access_token"
          copy.label = "Sentry OAuth access token"
          copy.userOwnedRequired = false
          copy.helpText = "30-day OAuth access token stored only as a Keychain reference."
        }
        return copy
      } + [
        ProviderCredentialRequirement(
          fieldKey: "sentry_oauth_refresh_token", label: "Sentry OAuth refresh token",
          required: true, userOwnedRequired: false, secretReferenceId: refreshRef.id,
          status: .verified,
          helpText: "OAuth refresh token stored separately for complete pair replacement.",
          redactionStatus: "secret-reference-only")
      ]
    connection.secretReferenceIds.append(refreshRef.id)
    connection.providerKey = "sentry-relay-owned-device-oauth:" + organizationSlug
    connection.credentialOwnership = .relayOwned
    connection.userOwnedCredentialsRequired = false
    connection.health.diagnostics["authMethod"] = .string(
      "oauth2_device_authorization_rotating_pair")
    connection.health.diagnostics["relayOwnedSentryOAuth"] = .bool(true)
    connection.health.diagnostics["oauthClientId"] = .string(cid)
    connection.health.diagnostics["accessExpiresAt"] =
      expiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null
    connection.health.diagnostics["accessLifetimeSeconds"] = .number(2_591_999)
    connection.health.diagnostics["tokenPairReplacement"] = .string(
      "serialized-complete-provider-returned-pair-replacement")
    connection.health.diagnostics["exactScopes"] = .array(
      Self.sentryAuthTokenScopes.map(JSONValue.string))
    connection.health.diagnostics["rawTokenStoredInDatabase"] = .bool(false)
    do { return try saveConnection(context: context, connection: connection) } catch {
      _ = try? secrets.delete(refreshRef.id)
      throw error
    }
  }

  @discardableResult
  public func rotateSentryOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String, expiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    sentryTokenRotationLock.lock()
    defer { sentryTokenRotationLock.unlock() }
    guard
      var connection = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      connection.appSlug == "sentry", connection.credentialOwnership == .relayOwned
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "A Relay-owned Sentry OAuth connection is required.")
    }
    let access = try requireNonEmptyString(
      accessToken, field: "Sentry OAuth access token", maxLength: 30000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "Sentry OAuth refresh token", maxLength: 30000)
    let old = Self.secretReferenceIds(in: connection)
    let a = try secrets.set(
      scope: "provider_connection", scopeId: connection.id, label: "Sentry OAuth access token",
      secretValue: access)
    let r: SecretReference
    do {
      r = try secrets.set(
        scope: "provider_connection", scopeId: connection.id, label: "Sentry OAuth refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(a.id)
      throw error
    }
    connection.credentialRequirements = connection.credentialRequirements.map { value in
      var copy = value
      if copy.fieldKey == "sentry_oauth_access_token" { copy.secretReferenceId = a.id }
      if copy.fieldKey == "sentry_oauth_refresh_token" { copy.secretReferenceId = r.id }
      return copy
    }
    connection.secretReferenceIds = [a.id, r.id]
    connection.updatedAt = ISO8601DateFormatter.relayConsole.string(from: now)
    connection.health.diagnostics["accessExpiresAt"] =
      expiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null
    do {
      let saved = try saveConnection(context: context, connection: connection)
      for id in old { _ = try? secrets.delete(id) }
      return saved
    } catch {
      _ = try? secrets.delete(a.id)
      _ = try? secrets.delete(r.id)
      throw error
    }
  }

  @discardableResult
  public func saveDatadogRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    apiOrigin: String, organizationName: String?, grantedScopes: [String], expiresAt: String?,
    displayName: String? = nil, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "datadog")
    guard app.slug == "datadog", Set(grantedScopes) == Set(Self.datadogReadScopes),
      grantedScopes.count == Self.datadogReadScopes.count,
      DatadogProviderActionSupport.allowedAPIOrigins.contains(apiOrigin)
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "Datadog OAuth requires the exact read scopes and an allowlisted Datadog API site."
      )
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "Datadog OAuth access token", maxLength: 30000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "Datadog OAuth refresh token", maxLength: 30000)
    let id = createRelayId("mpc")
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let a = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Datadog OAuth access token",
      secretValue: access)
    let r: SecretReference
    do {
      r = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Datadog OAuth refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(a.id)
      throw error
    }
    let site = URL(string: apiOrigin)?.host ?? "Datadog"
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "datadog-relay-owned-oauth:" + site, providerName: "Datadog", status: .connected,
      authorizationState: .completed, credentialOwnership: .relayOwned,
      userOwnedCredentialsRequired: false,
      credentialRequirements: [
        ProviderCredentialRequirement(
          fieldKey: "datadog_oauth_access_token", label: "Datadog OAuth access token",
          required: true, userOwnedRequired: false, secretReferenceId: a.id, status: .verified,
          helpText: "One-hour access token stored only as a Keychain reference.",
          redactionStatus: "secret-reference-only"),
        ProviderCredentialRequirement(
          fieldKey: "datadog_oauth_refresh_token", label: "Datadog OAuth refresh token",
          required: true, userOwnedRequired: false, secretReferenceId: r.id, status: .verified,
          helpText:
            "Long-lived Marketplace refresh token stored separately for full-pair replacement.",
          redactionStatus: "secret-reference-only"),
        ProviderCredentialRequirement(
          fieldKey: "datadog_api_origin", label: "Datadog API site", required: true,
          userOwnedRequired: false, secretReferenceId: nil, status: .verified,
          helpText: "Exact API site validated from Datadog's OAuth callback domain.",
          redactionStatus: "private-state-excluded"),
      ], secretReferenceIds: [a.id, r.id],
      accountLabel: displayName?.providerConnectionNilIfEmpty ?? organizationName?
        .providerConnectionNilIfEmpty ?? "Datadog " + site,
      connectedHandle: organizationName?.providerConnectionNilIfEmpty ?? site, callbackURL: nil,
      requiredScopes: Self.datadogReadScopes, grantedScopes: Self.datadogReadScopes,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message: "Datadog OAuth handoff is ready for bounded monitor, incident, and service reads.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("datadog"),
          "authMethod": .string("oauth2_authorization_code_pkce_confidential_hosted_broker"),
          "apiOrigin": .string(apiOrigin),
          "organizationName": organizationName?.providerConnectionNilIfEmpty.map(JSONValue.string)
            ?? .null,
          "accessExpiresAt": expiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
          "accessLifetimeSeconds": .number(3600),
          "refreshTokenLifetime": .string("marketplace-long-lived-until-revoked"),
          "tokenPairReplacement": .string("serialized-complete-provider-returned-pair-replacement"),
          "exactScopes": .array(Self.datadogReadScopes.map(JSONValue.string)),
          "clientSecretLocation": .string("secure-railway-broker-only"),
          "rawTokenStoredInDatabase": .bool(false), "rawProviderToolExposure": .bool(false),
        ], redactionStatus: "private-state-excluded"), senderIdentities: [],
      installPolicy: "read_only_datadog_observability", lastCheckedAt: timestamp, lastError: nil,
      manualEvidenceNote: nil, reauthorizeRequired: false, disconnecting: false, betaBlocked: false,
      createdAt: timestamp, updatedAt: timestamp, redactionStatus: "private-state-excluded")
    do { return try saveConnection(context: context, connection: connection) } catch {
      _ = try? secrets.delete(a.id)
      _ = try? secrets.delete(r.id)
      throw error
    }
  }

  @discardableResult
  public func rotateDatadogOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String, expiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    datadogTokenRotationLock.lock()
    defer { datadogTokenRotationLock.unlock() }
    guard
      var connection = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      connection.appSlug == "datadog", connection.credentialOwnership == .relayOwned
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "A Relay-owned Datadog OAuth connection is required.")
    }
    let access = try requireNonEmptyString(
      accessToken, field: "Datadog OAuth access token", maxLength: 30000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "Datadog OAuth refresh token", maxLength: 30000)
    let old = Self.secretReferenceIds(in: connection)
    let a = try secrets.set(
      scope: "provider_connection", scopeId: connection.id, label: "Datadog OAuth access token",
      secretValue: access)
    let r: SecretReference
    do {
      r = try secrets.set(
        scope: "provider_connection", scopeId: connection.id, label: "Datadog OAuth refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(a.id)
      throw error
    }
    connection.credentialRequirements = connection.credentialRequirements.map { value in
      var copy = value
      if copy.fieldKey == "datadog_oauth_access_token" { copy.secretReferenceId = a.id }
      if copy.fieldKey == "datadog_oauth_refresh_token" { copy.secretReferenceId = r.id }
      return copy
    }
    connection.secretReferenceIds = [a.id, r.id]
    connection.updatedAt = ISO8601DateFormatter.relayConsole.string(from: now)
    connection.health.diagnostics["accessExpiresAt"] =
      expiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null
    do {
      let saved = try saveConnection(context: context, connection: connection)
      old.forEach { _ = try? secrets.delete($0) }
      return saved
    } catch {
      _ = try? secrets.delete(a.id)
      _ = try? secrets.delete(r.id)
      throw error
    }
  }

  @discardableResult
  public func savePagerDutyRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    apiOrigin: String, accountSubdomain: String, accountRegion: String, grantedScopes: [String],
    expiresAt: String?, displayName: String? = nil, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "pagerduty")
    let region = accountRegion.lowercased()
    let subdomain = accountSubdomain.lowercased()
    let safeSubdomain =
      !subdomain.isEmpty && subdomain.count <= 63 && subdomain.first?.isLetter == true
      && subdomain.last?.isLetter == true
      && subdomain.allSatisfy { $0.isLetter || $0.isNumber || $0 == "-" }
    let required = Self.pagerDutyRequiredScopes(accountRegion: region, accountSubdomain: subdomain)
    let expectedOrigin =
      region == "eu" ? "https://api.eu.pagerduty.com" : "https://api.pagerduty.com"
    guard app.slug == "pagerduty", ["us", "eu"].contains(region), safeSubdomain,
      apiOrigin == expectedOrigin, Set(grantedScopes) == Set(required),
      grantedScopes.count == required.count
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "PagerDuty OAuth requires an exact US/EU account audience, matching API origin, and the exact read scopes."
      )
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "PagerDuty OAuth access token", maxLength: 30000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "PagerDuty OAuth refresh token", maxLength: 30000)
    let id = createRelayId("mpc")
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let a = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "PagerDuty OAuth access token",
      secretValue: access)
    let r: SecretReference
    do {
      r = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "PagerDuty OAuth refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(a.id)
      throw error
    }
    let audience = "as_account-\(region).\(subdomain)"
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "pagerduty-relay-owned-oauth:" + region + ":" + subdomain,
      providerName: "PagerDuty", status: .connected, authorizationState: .completed,
      credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
      credentialRequirements: [
        ProviderCredentialRequirement(
          fieldKey: "pagerduty_oauth_access_token", label: "PagerDuty OAuth access token",
          required: true, userOwnedRequired: false, secretReferenceId: a.id, status: .verified,
          helpText: "24-hour access token stored only as a Keychain reference.",
          redactionStatus: "secret-reference-only"),
        ProviderCredentialRequirement(
          fieldKey: "pagerduty_oauth_refresh_token", label: "PagerDuty OAuth refresh token",
          required: true, userOwnedRequired: false, secretReferenceId: r.id, status: .verified,
          helpText: "Refresh token stored separately for serialized full-pair replacement.",
          redactionStatus: "secret-reference-only"),
        ProviderCredentialRequirement(
          fieldKey: "pagerduty_account", label: "PagerDuty account audience and API region",
          required: true, userOwnedRequired: false, secretReferenceId: nil, status: .verified,
          helpText:
            "Exact account audience and matching US/EU API origin from the hosted callback.",
          redactionStatus: "private-state-excluded"),
      ], secretReferenceIds: [a.id, r.id],
      accountLabel: displayName?.providerConnectionNilIfEmpty ?? "PagerDuty " + subdomain,
      connectedHandle: subdomain,
      callbackURL: nil, requiredScopes: required, grantedScopes: required,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message: "PagerDuty Scoped OAuth is ready for bounded incident and service reads.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("pagerduty"),
          "authMethod": .string("oauth2_scoped_authorization_code_confidential_hosted_broker"),
          "apiOrigin": .string(apiOrigin), "accountSubdomain": .string(subdomain),
          "accountRegion": .string(region), "accountAudience": .string(audience),
          "accessExpiresAt": expiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
          "accessLifetimeSeconds": .number(86400),
          "tokenPairReplacement": .string("serialized-complete-provider-returned-pair-replacement"),
          "exactScopes": .array(required.map(JSONValue.string)),
          "clientSecretLocation": .string("secure-railway-broker-only"),
          "rawTokenStoredInDatabase": .bool(false), "rawProviderToolExposure": .bool(false),
        ], redactionStatus: "private-state-excluded"), senderIdentities: [],
      installPolicy: "read_only_pagerduty_incidents_services", lastCheckedAt: timestamp,
      lastError: nil, manualEvidenceNote: nil, reauthorizeRequired: false, disconnecting: false,
      betaBlocked: false, createdAt: timestamp, updatedAt: timestamp,
      redactionStatus: "private-state-excluded")
    do { return try saveConnection(context: context, connection: connection) } catch {
      _ = try? secrets.delete(a.id)
      _ = try? secrets.delete(r.id)
      throw error
    }
  }

  @discardableResult
  public func rotatePagerDutyOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String, expiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    pagerDutyTokenRotationLock.lock()
    defer { pagerDutyTokenRotationLock.unlock() }
    guard
      var connection = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      connection.appSlug == "pagerduty", connection.credentialOwnership == .relayOwned
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "A Relay-owned PagerDuty OAuth connection is required.")
    }
    let access = try requireNonEmptyString(
      accessToken, field: "PagerDuty OAuth access token", maxLength: 30000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "PagerDuty OAuth refresh token", maxLength: 30000)
    let old = Self.secretReferenceIds(in: connection)
    let a = try secrets.set(
      scope: "provider_connection", scopeId: connection.id, label: "PagerDuty OAuth access token",
      secretValue: access)
    let r: SecretReference
    do {
      r = try secrets.set(
        scope: "provider_connection", scopeId: connection.id,
        label: "PagerDuty OAuth refresh token", secretValue: refresh)
    } catch {
      _ = try? secrets.delete(a.id)
      throw error
    }
    connection.credentialRequirements = connection.credentialRequirements.map { value in
      var copy = value
      if copy.fieldKey == "pagerduty_oauth_access_token" { copy.secretReferenceId = a.id }
      if copy.fieldKey == "pagerduty_oauth_refresh_token" { copy.secretReferenceId = r.id }
      return copy
    }
    connection.secretReferenceIds = [a.id, r.id]
    connection.updatedAt = ISO8601DateFormatter.relayConsole.string(from: now)
    connection.health.diagnostics["accessExpiresAt"] =
      expiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null
    do {
      let saved = try saveConnection(context: context, connection: connection)
      old.forEach { _ = try? secrets.delete($0) }
      return saved
    } catch {
      _ = try? secrets.delete(a.id)
      _ = try? secrets.delete(r.id)
      throw error
    }
  }
}
