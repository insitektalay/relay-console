import Foundation

extension ProviderConnectionService {
  @discardableResult
  public func connectTelemetryDeckPAT(
    context: ServiceRequestContext,
    appIdOrSlug: RelayId,
    personalAccessToken: String,
    namespace: String,
    telemetryDeckAppId: String,
    appDisplayName: String?,
    defaultInsightId: String?,
    displayName: String? = nil,
    now: Date = Date()
  ) async throws -> MarketplaceProviderConnection {
    let validation = await validateTelemetryDeckPAT(personalAccessToken: personalAccessToken)
    guard validation.isReady else {
      throw ServiceGuard.unavailable(
        context: context,
        reasonCode: Self.telemetryDeckReauthorizeRequired(for: validation)
          ? .authRequired : .runtimeUnavailable,
        message: validation.message
      )
    }
    return try saveTelemetryDeckPATConnection(
      context: context,
      appIdOrSlug: appIdOrSlug,
      personalAccessToken: personalAccessToken,
      namespace: namespace,
      telemetryDeckAppId: telemetryDeckAppId,
      appDisplayName: appDisplayName,
      defaultInsightId: defaultInsightId,
      displayName: displayName,
      validationResult: validation,
      now: now
    )
  }

  @discardableResult
  public func saveGitLabRelayOwnedOAuthConnection(
    context: ServiceRequestContext,
    appIdOrSlug: RelayId,
    accessToken: String,
    refreshToken: String?,
    username: String?,
    group: String?,
    projectPath: String?,
    displayName: String? = nil,
    grantedScopes: [String] = ProviderConnectionService.gitLabRelayOwnedOAuthScopes,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "gitlab")
    guard app.slug == "gitlab" else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "GitLab OAuth credentials can only be saved for the GitLab Marketplace app.")
    }
    try validateAppCanAuthorize(app, context: context)
    let trimmedAccessToken = try requireNonEmptyString(
      accessToken, field: "GitLab access token", maxLength: 20000)
    let trimmedRefreshToken = refreshToken?.providerConnectionNilIfEmpty
    let trimmedUsername = username?.providerConnectionNilIfEmpty
    let trimmedGroup = group?.providerConnectionNilIfEmpty
    let trimmedProjectPath = projectPath?.providerConnectionNilIfEmpty
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let connectionId = existing?.id ?? createRelayId("mpc")
    let existingSecretIds = existing.map { Self.secretReferenceIds(in: $0) } ?? []
    for secretId in existingSecretIds {
      _ = try? secrets.delete(secretId)
    }

    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let accessTokenReference = try secrets.set(
      scope: "provider_connection",
      scopeId: connectionId,
      label: "GitLab OAuth access token",
      secretValue: trimmedAccessToken
    )
    let refreshTokenReference = try trimmedRefreshToken.map { token in
      try secrets.set(
        scope: "provider_connection",
        scopeId: connectionId,
        label: "GitLab OAuth refresh token",
        secretValue: token
      )
    }
    var secretReferenceIds = [accessTokenReference.id]
    if let refreshTokenReference {
      secretReferenceIds.append(refreshTokenReference.id)
    }
    let normalizedGrantedScopes =
      grantedScopes.isEmpty ? Self.gitLabRelayOwnedOAuthScopes : grantedScopes
    let missingScopes = Self.gitLabRelayOwnedOAuthScopes.filter {
      !normalizedGrantedScopes.contains($0)
    }
    let connectionStatus: ProviderConnectionStatus =
      missingScopes.isEmpty ? .connected : .authRequired
    let healthState: ProviderConnectorHealthState = missingScopes.isEmpty ? .ready : .degraded
    let accountLabel =
      displayName?.providerConnectionNilIfEmpty
      ?? existing?.accountLabel
      ?? trimmedProjectPath
      ?? trimmedGroup
      ?? trimmedUsername
      ?? "GitLab account"
    let connection = MarketplaceProviderConnection(
      id: connectionId,
      workspaceId: context.workspaceId,
      appId: app.id,
      appSlug: app.slug,
      providerKey:
        "gitlab-relay-owned-oauth:\(trimmedProjectPath ?? trimmedGroup ?? trimmedUsername ?? connectionId)",
      providerName: "GitLab",
      status: connectionStatus,
      authorizationState: connectionStatus == .connected ? .completed : .manualEvidenceRequired,
      credentialOwnership: .relayOwned,
      userOwnedCredentialsRequired: false,
      credentialRequirements: [
        ProviderCredentialRequirement(
          fieldKey: "gitlab_oauth_access_token",
          label: "GitLab OAuth access token",
          required: true,
          userOwnedRequired: false,
          secretReferenceId: accessTokenReference.id,
          status: .verified,
          helpText:
            "Granted through Relay-owned GitLab OAuth and stored only as a Keychain reference.",
          redactionStatus: "secret-reference-only"
        ),
        ProviderCredentialRequirement(
          fieldKey: "gitlab_oauth_refresh_token",
          label: "GitLab OAuth refresh token",
          required: false,
          userOwnedRequired: false,
          secretReferenceId: refreshTokenReference?.id,
          status: refreshTokenReference == nil ? .missing : .verified,
          helpText: "Optional refresh token when the GitLab OAuth grant is refreshable.",
          redactionStatus: "secret-reference-only"
        ),
        ProviderCredentialRequirement(
          fieldKey: "gitlab_username",
          label: "GitLab username",
          required: false,
          userOwnedRequired: false,
          secretReferenceId: nil,
          status: trimmedUsername == nil ? .missing : .verified,
          helpText: "Non-secret GitLab username returned by OAuth.",
          redactionStatus: "private-state-excluded"
        ),
        ProviderCredentialRequirement(
          fieldKey: "gitlab_group",
          label: "GitLab group",
          required: false,
          userOwnedRequired: false,
          secretReferenceId: nil,
          status: trimmedGroup == nil ? .missing : .verified,
          helpText: "Optional non-secret group context selected for this connection.",
          redactionStatus: "private-state-excluded"
        ),
      ],
      secretReferenceIds: secretReferenceIds,
      accountLabel: accountLabel,
      connectedHandle: trimmedProjectPath ?? trimmedGroup ?? trimmedUsername,
      callbackURL: Self.defaultCallbackURL(for: app),
      requiredScopes: Self.gitLabRelayOwnedOAuthScopes,
      grantedScopes: normalizedGrantedScopes,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: healthState,
        message: missingScopes.isEmpty
          ? "GitLab OAuth grant saved as Keychain references. GitLab calls remain routed through Relay provider-action wrappers."
          : "GitLab OAuth grant is missing required scopes: \(missingScopes.joined(separator: ", ")).",
        lastCheckedAt: timestamp,
        missingScopes: missingScopes,
        unavailableTools: missingScopes.isEmpty
          ? [] : ["gitlab.issue.comment.create", "gitlab.merge_request.comment.create"],
        diagnostics: [
          "provider": .string("gitlab"),
          "authMethod": .string("gitlab_oauth_relay_owned"),
          "callbackURLRequired": .bool(true),
          "callbackURL": .string(Self.defaultCallbackURL(for: app)),
          "credentialOwnership": .string(ProviderCredentialOwnership.relayOwned.rawValue),
          "relayOwnedGitLabApp": .bool(true),
          "secretStorage": .string("keychain-reference-only"),
          "accessTokenProvided": .bool(true),
          "refreshTokenProvided": .bool(refreshTokenReference != nil),
          "username": trimmedUsername.map(JSONValue.string) ?? .null,
          "group": trimmedGroup.map(JSONValue.string) ?? .null,
          "projectPath": trimmedProjectPath.map(JSONValue.string) ?? .null,
          "rawTokenStoredInDatabase": .bool(false),
          "rawMCPExposure": .bool(false),
        ],
        redactionStatus: "private-state-excluded"
      ),
      senderIdentities: [],
      installPolicy: "approval_gated_gitlab_comments",
      lastCheckedAt: timestamp,
      lastError: missingScopes.isEmpty
        ? nil : "Missing GitLab scopes: \(missingScopes.joined(separator: ", "))",
      manualEvidenceNote: nil,
      reauthorizeRequired: !missingScopes.isEmpty,
      disconnecting: false,
      betaBlocked: false,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
      redactionStatus: "private-state-excluded"
    )
    return try saveConnection(context: context, connection: connection)
  }

  @discardableResult
  public func saveBitbucketRelayOwnedOAuthConnection(
    context: ServiceRequestContext,
    appIdOrSlug: RelayId,
    accessToken: String,
    refreshToken: String?,
    username: String?,
    workspace: String?,
    repositoryPath: String?,
    displayName: String? = nil,
    grantedScopes: [String] = ProviderConnectionService.bitbucketRelayOwnedOAuthScopes,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "bitbucket")
    guard app.slug == "bitbucket" else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "Bitbucket OAuth credentials can only be saved for the Bitbucket Marketplace app.")
    }
    try validateAppCanAuthorize(app, context: context)
    let trimmedAccessToken = try requireNonEmptyString(
      accessToken, field: "Bitbucket access token", maxLength: 20000)
    let trimmedRefreshToken = refreshToken?.providerConnectionNilIfEmpty
    let trimmedUsername = username?.providerConnectionNilIfEmpty
    let trimmedWorkspace = workspace?.providerConnectionNilIfEmpty
    let trimmedRepositoryPath = repositoryPath?.providerConnectionNilIfEmpty
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let connectionId = existing?.id ?? createRelayId("mpc")
    let existingSecretIds = existing.map { Self.secretReferenceIds(in: $0) } ?? []
    for secretId in existingSecretIds {
      _ = try? secrets.delete(secretId)
    }

    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let accessTokenReference = try secrets.set(
      scope: "provider_connection",
      scopeId: connectionId,
      label: "Bitbucket OAuth access token",
      secretValue: trimmedAccessToken
    )
    let refreshTokenReference = try trimmedRefreshToken.map { token in
      try secrets.set(
        scope: "provider_connection",
        scopeId: connectionId,
        label: "Bitbucket OAuth refresh token",
        secretValue: token
      )
    }
    var secretReferenceIds = [accessTokenReference.id]
    if let refreshTokenReference {
      secretReferenceIds.append(refreshTokenReference.id)
    }
    let normalizedGrantedScopes =
      grantedScopes.isEmpty ? Self.bitbucketRelayOwnedOAuthScopes : grantedScopes
    let missingScopes = Self.bitbucketRelayOwnedOAuthScopes.filter {
      !normalizedGrantedScopes.contains($0)
    }
    let connectionStatus: ProviderConnectionStatus =
      missingScopes.isEmpty ? .connected : .authRequired
    let healthState: ProviderConnectorHealthState = missingScopes.isEmpty ? .ready : .degraded
    let accountLabel =
      displayName?.providerConnectionNilIfEmpty
      ?? existing?.accountLabel
      ?? trimmedRepositoryPath
      ?? trimmedWorkspace
      ?? trimmedUsername
      ?? "Bitbucket account"
    let connection = MarketplaceProviderConnection(
      id: connectionId,
      workspaceId: context.workspaceId,
      appId: app.id,
      appSlug: app.slug,
      providerKey:
        "bitbucket-relay-owned-oauth:\(trimmedRepositoryPath ?? trimmedWorkspace ?? trimmedUsername ?? connectionId)",
      providerName: "Bitbucket",
      status: connectionStatus,
      authorizationState: connectionStatus == .connected ? .completed : .manualEvidenceRequired,
      credentialOwnership: .relayOwned,
      userOwnedCredentialsRequired: false,
      credentialRequirements: [
        ProviderCredentialRequirement(
          fieldKey: "bitbucket_oauth_access_token",
          label: "Bitbucket OAuth access token",
          required: true,
          userOwnedRequired: false,
          secretReferenceId: accessTokenReference.id,
          status: .verified,
          helpText:
            "Granted through Relay-owned Bitbucket OAuth and stored only as a Keychain reference.",
          redactionStatus: "secret-reference-only"
        ),
        ProviderCredentialRequirement(
          fieldKey: "bitbucket_oauth_refresh_token",
          label: "Bitbucket OAuth refresh token",
          required: false,
          userOwnedRequired: false,
          secretReferenceId: refreshTokenReference?.id,
          status: refreshTokenReference == nil ? .missing : .verified,
          helpText: "Optional refresh token when the Bitbucket OAuth grant is refreshable.",
          redactionStatus: "secret-reference-only"
        ),
        ProviderCredentialRequirement(
          fieldKey: "bitbucket_username",
          label: "Bitbucket username",
          required: false,
          userOwnedRequired: false,
          secretReferenceId: nil,
          status: trimmedUsername == nil ? .missing : .verified,
          helpText: "Non-secret Bitbucket username returned by OAuth.",
          redactionStatus: "private-state-excluded"
        ),
        ProviderCredentialRequirement(
          fieldKey: "bitbucket_workspace",
          label: "Bitbucket workspace",
          required: false,
          userOwnedRequired: false,
          secretReferenceId: nil,
          status: trimmedWorkspace == nil ? .missing : .verified,
          helpText: "Optional non-secret workspace context selected for this connection.",
          redactionStatus: "private-state-excluded"
        ),
      ],
      secretReferenceIds: secretReferenceIds,
      accountLabel: accountLabel,
      connectedHandle: trimmedRepositoryPath ?? trimmedWorkspace ?? trimmedUsername,
      callbackURL: Self.defaultCallbackURL(for: app),
      requiredScopes: Self.bitbucketRelayOwnedOAuthScopes,
      grantedScopes: normalizedGrantedScopes,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: healthState,
        message: missingScopes.isEmpty
          ? "Bitbucket OAuth grant saved as Keychain references. Bitbucket calls remain routed through Relay provider-action wrappers."
          : "Bitbucket OAuth grant is missing required scopes: \(missingScopes.joined(separator: ", ")).",
        lastCheckedAt: timestamp,
        missingScopes: missingScopes,
        unavailableTools: missingScopes.isEmpty
          ? [] : ["bitbucket.issue.comment.create", "bitbucket.pull_request.comment.create"],
        diagnostics: [
          "provider": .string("bitbucket"),
          "authMethod": .string("bitbucket_oauth_relay_owned"),
          "callbackURLRequired": .bool(true),
          "callbackURL": .string(Self.defaultCallbackURL(for: app)),
          "credentialOwnership": .string(ProviderCredentialOwnership.relayOwned.rawValue),
          "relayOwnedBitbucketApp": .bool(true),
          "secretStorage": .string("keychain-reference-only"),
          "accessTokenProvided": .bool(true),
          "refreshTokenProvided": .bool(refreshTokenReference != nil),
          "username": trimmedUsername.map(JSONValue.string) ?? .null,
          "workspace": trimmedWorkspace.map(JSONValue.string) ?? .null,
          "repositoryPath": trimmedRepositoryPath.map(JSONValue.string) ?? .null,
          "rawTokenStoredInDatabase": .bool(false),
          "rawMCPExposure": .bool(false),
        ],
        redactionStatus: "private-state-excluded"
      ),
      senderIdentities: [],
      installPolicy: "approval_gated_bitbucket_comments",
      lastCheckedAt: timestamp,
      lastError: missingScopes.isEmpty
        ? nil : "Missing Bitbucket scopes: \(missingScopes.joined(separator: ", "))",
      manualEvidenceNote: nil,
      reauthorizeRequired: !missingScopes.isEmpty,
      disconnecting: false,
      betaBlocked: false,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
      redactionStatus: "private-state-excluded"
    )
    return try saveConnection(context: context, connection: connection)
  }

  @discardableResult
  public func saveTelemetryDeckPATConnection(
    context: ServiceRequestContext,
    appIdOrSlug: RelayId,
    personalAccessToken: String,
    namespace: String,
    telemetryDeckAppId: String,
    appDisplayName: String?,
    defaultInsightId: String?,
    displayName: String? = nil,
    validationResult: TelemetryDeckPATValidationResult? = nil,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "telemetrydeck")
    guard app.slug == "telemetrydeck" else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "TelemetryDeck Personal Access Tokens can only be saved for the TelemetryDeck Marketplace app."
      )
    }
    try validateAppCanAuthorize(app, context: context)
    let trimmedToken = try requireNonEmptyString(
      personalAccessToken, field: "TelemetryDeck Personal Access Token", maxLength: 20000)
    let trimmedNamespace = try requireNonEmptyString(
      namespace, field: "TelemetryDeck namespace", maxLength: 256)
    let trimmedAppId = try requireNonEmptyString(
      telemetryDeckAppId, field: "TelemetryDeck app ID", maxLength: 256)
    let trimmedAppDisplayName = appDisplayName?.providerConnectionNilIfEmpty
    let trimmedDefaultInsightId = defaultInsightId?.providerConnectionNilIfEmpty
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
      ?? TelemetryDeckPATValidationResult(
        status: .ready,
        message:
          "TelemetryDeck Personal Access Token saved as a Keychain reference. Run a connection check to verify live TelemetryDeck access."
      )
    let tokenReference = try secrets.set(
      scope: "provider_connection",
      scopeId: connectionId,
      label: "TelemetryDeck Personal Access Token",
      secretValue: trimmedToken
    )
    let accountName =
      displayName?.providerConnectionNilIfEmpty
      ?? existing?.accountLabel
      ?? trimmedAppDisplayName
      ?? "TelemetryDeck \(trimmedNamespace)"
    let connection = MarketplaceProviderConnection(
      id: connectionId,
      workspaceId: context.workspaceId,
      appId: app.id,
      appSlug: app.slug,
      providerKey: "telemetrydeck-user-pat:\(connectionId)",
      providerName: "TelemetryDeck",
      status: validation.isReady ? .connected : Self.telemetryDeckConnectionStatus(for: validation),
      authorizationState: validation.isReady ? .completed : .error,
      credentialOwnership: .userOwned,
      userOwnedCredentialsRequired: true,
      credentialRequirements: [
        ProviderCredentialRequirement(
          fieldKey: "telemetrydeck_personal_access_token",
          label: "Personal Access Token",
          required: true,
          userOwnedRequired: true,
          secretReferenceId: tokenReference.id,
          status: .verified,
          helpText: "User-owned TelemetryDeck PAT stored only as a Keychain reference.",
          redactionStatus: "secret-reference-only"
        ),
        ProviderCredentialRequirement(
          fieldKey: "telemetrydeck_namespace",
          label: "Organization namespace",
          required: true,
          userOwnedRequired: false,
          secretReferenceId: nil,
          status: .verified,
          helpText: "Non-secret TelemetryDeck namespace/data source used to scope reads.",
          redactionStatus: "private-state-excluded"
        ),
        ProviderCredentialRequirement(
          fieldKey: "telemetrydeck_app_id",
          label: "TelemetryDeck app ID",
          required: true,
          userOwnedRequired: false,
          secretReferenceId: nil,
          status: .verified,
          helpText:
            "Non-secret selected TelemetryDeck app ID. Agents cannot be assigned until this is set.",
          redactionStatus: "private-state-excluded"
        ),
        ProviderCredentialRequirement(
          fieldKey: "telemetrydeck_app_display_name",
          label: "App display name",
          required: false,
          userOwnedRequired: false,
          secretReferenceId: nil,
          status: trimmedAppDisplayName == nil ? .missing : .verified,
          helpText: "Optional non-secret label for the selected TelemetryDeck app.",
          redactionStatus: "private-state-excluded"
        ),
        ProviderCredentialRequirement(
          fieldKey: "telemetrydeck_default_insight_id",
          label: "Default insight ID",
          required: false,
          userOwnedRequired: false,
          secretReferenceId: nil,
          status: trimmedDefaultInsightId == nil ? .missing : .verified,
          helpText: "Optional non-secret saved insight ID used by the saved-insight wrapper.",
          redactionStatus: "private-state-excluded"
        ),
      ],
      secretReferenceIds: [tokenReference.id],
      accountLabel: accountName,
      connectedHandle: "\(trimmedNamespace) / \(trimmedAppId)",
      callbackURL: nil,
      requiredScopes: Self.telemetryDeckReadCapabilities,
      grantedScopes: Self.telemetryDeckReadCapabilities,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
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
          "namespace": .string(trimmedNamespace),
          "telemetryDeckAppId": .string(trimmedAppId),
          "appDisplayName": trimmedAppDisplayName.map(JSONValue.string) ?? .null,
          "defaultInsightId": trimmedDefaultInsightId.map(JSONValue.string) ?? .null,
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
      ),
      senderIdentities: [],
      installPolicy: "read_only_telemetrydeck_analytics",
      lastCheckedAt: timestamp,
      lastError: validation.isReady ? nil : validation.message,
      manualEvidenceNote: nil,
      reauthorizeRequired: Self.telemetryDeckReauthorizeRequired(for: validation),
      disconnecting: false,
      betaBlocked: false,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
      redactionStatus: "private-state-excluded"
    )
    return try saveConnection(context: context, connection: connection)
  }

  @discardableResult
  public func validateSavedTelemetryDeckConnection(
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
      context: context, appIdOrSlug: connection.appId, fallbackSlug: "telemetrydeck")
    guard app.slug == "telemetrydeck", connection.appId == app.id else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Only TelemetryDeck PAT connections can be checked here.")
    }
    let secretId =
      connection.credentialRequirements.first {
        $0.fieldKey == "telemetrydeck_personal_access_token"
      }?.secretReferenceId
      ?? Self.secretReferenceIds(in: connection).first
    guard let secretId else {
      let validation = TelemetryDeckPATValidationResult(
        status: .missingSecret,
        message: "TelemetryDeck connection is missing a Keychain PAT reference."
      )
      return try saveTelemetryDeckHealthResult(
        validation, connection: &connection, app: app, now: now)
    }
    let token: String
    do {
      token = try secrets.getSecretValue(secretId)
    } catch {
      let validation = TelemetryDeckPATValidationResult(
        status: .secretUnavailable,
        message:
          "Relay could not read the saved TelemetryDeck PAT from the OS secret store. Replace the TelemetryDeck token in Marketplace."
      )
      return try saveTelemetryDeckHealthResult(
        validation, connection: &connection, app: app, now: now)
    }
    let validation = await validateTelemetryDeckPAT(personalAccessToken: token)
    return try saveTelemetryDeckHealthResult(
      validation, connection: &connection, app: app, now: now)
  }
}
