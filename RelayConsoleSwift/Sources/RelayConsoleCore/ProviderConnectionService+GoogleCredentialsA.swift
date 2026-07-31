import Foundation

extension ProviderConnectionService {
  @discardableResult
  public func saveGoogleDocsOAuthCredentials(
    context: ServiceRequestContext,
    appIdOrSlug: RelayId,
    clientId: String,
    clientSecret: String,
    refreshToken: String,
    accessToken: String?,
    accountEmail: String?,
    projectId: String?,
    displayName: String? = nil,
    credentialOwnership: ProviderCredentialOwnership = .userOwned,
    userOwnedCredentialsRequired: Bool = true,
    relayOwnedGoogleApp: Bool = false,
    providerKey: String = "google-docs-user-oauth",
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "google-docs")
    guard app.slug == "google-docs" else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "Google Docs OAuth credentials can only be saved for the Google Docs Marketplace app.")
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
    let trimmedProjectId = projectId?.providerConnectionNilIfEmpty
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
      label: "Google Docs OAuth Client ID",
      secretValue: trimmedClientId
    )
    let clientSecretReference = try secrets.set(
      scope: "provider_connection",
      scopeId: connectionId,
      label: "Google Docs OAuth Client Secret",
      secretValue: trimmedClientSecret
    )
    let refreshTokenReference = try secrets.set(
      scope: "provider_connection",
      scopeId: connectionId,
      label: "Google Docs OAuth Refresh Token",
      secretValue: trimmedRefreshToken
    )
    let accessTokenReference = try trimmedAccessToken.map { token in
      try secrets.set(
        scope: "provider_connection",
        scopeId: connectionId,
        label: "Google Docs OAuth Access Token",
        secretValue: token
      )
    }
    var secretReferenceIds = [
      clientIdReference.id, clientSecretReference.id, refreshTokenReference.id,
    ]
    if let accessTokenReference {
      secretReferenceIds.append(accessTokenReference.id)
    }
    let connection = MarketplaceProviderConnection(
      id: connectionId,
      workspaceId: context.workspaceId,
      appId: app.id,
      appSlug: app.slug,
      providerKey: providerKey,
      providerName: "Google Docs",
      status: .connected,
      authorizationState: .completed,
      credentialOwnership: credentialOwnership,
      userOwnedCredentialsRequired: userOwnedCredentialsRequired,
      credentialRequirements: [
        ProviderCredentialRequirement(
          fieldKey: "google_docs_oauth_client_id",
          label: "Google OAuth client ID",
          required: true,
          userOwnedRequired: userOwnedCredentialsRequired,
          secretReferenceId: clientIdReference.id,
          status: .verified,
          helpText: relayOwnedGoogleApp
            ? "From Relay's Google Cloud OAuth client with the Google Docs API enabled. Stored locally as a Keychain reference."
            : "From the user's own Google Cloud OAuth client with the Google Docs API enabled. Stored locally as a Keychain reference.",
          redactionStatus: "secret-reference-only"
        ),
        ProviderCredentialRequirement(
          fieldKey: "google_docs_oauth_client_secret",
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
          fieldKey: "google_docs_oauth_refresh_token",
          label: "Google OAuth refresh token",
          required: true,
          userOwnedRequired: userOwnedCredentialsRequired,
          secretReferenceId: refreshTokenReference.id,
          status: .verified,
          helpText: relayOwnedGoogleApp
            ? "Refresh token granted by the user's Google account through Relay-owned OAuth."
            : "Refresh token granted by the user's own Google OAuth app and Google Docs account.",
          redactionStatus: "secret-reference-only"
        ),
        ProviderCredentialRequirement(
          fieldKey: "google_docs_oauth_access_token",
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
          fieldKey: "google_cloud_project_id",
          label: "Google Cloud project ID",
          required: false,
          userOwnedRequired: userOwnedCredentialsRequired,
          secretReferenceId: nil,
          status: trimmedProjectId == nil ? .missing : .verified,
          helpText: relayOwnedGoogleApp
            ? "Optional non-secret Relay Google Cloud project label."
            : "Optional non-secret project label for the user's Google Cloud OAuth setup.",
          redactionStatus: "private-state-excluded"
        ),
      ],
      secretReferenceIds: secretReferenceIds,
      accountLabel: displayName?.providerConnectionNilIfEmpty ?? existing?.accountLabel
        ?? trimmedAccountEmail
        ?? "Google Docs OAuth account",
      connectedHandle: trimmedAccountEmail,
      callbackURL: nil,
      requiredScopes: Self.googleDocsOAuthScopes,
      grantedScopes: Self.googleDocsOAuthScopes,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message:
          "Google Docs OAuth credentials saved as Keychain references. Live Docs calls remain routed through Relay provider-action wrappers.",
        lastCheckedAt: timestamp,
        missingScopes: [],
        unavailableTools: [],
        diagnostics: [
          "provider": .string("google-docs"),
          "authMethod": .string(
            relayOwnedGoogleApp ? "google_oauth_relay_owned_docs" : "google_oauth_user_owned_docs"),
          "callbackURLRequired": .bool(false),
          "credentialOwnership": .string(credentialOwnership.rawValue),
          "relayOwnedGoogleApp": .bool(relayOwnedGoogleApp),
          "secretStorage": .string("keychain-reference-only"),
          "clientSecretProvided": .bool(true),
          "accessTokenProvided": .bool(accessTokenReference != nil),
          "projectIdProvided": .bool(trimmedProjectId != nil),
          "projectId": trimmedProjectId.map(JSONValue.string) ?? .null,
          "docsOnlyV1": .bool(true),
          "driveSearchEnabled": .bool(false),
          "scopePreset": .string("docs_readonly_documents"),
        ],
        redactionStatus: "private-state-excluded"
      ),
      senderIdentities: [],
      installPolicy: "approval_gated_document_actions",
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
  public func validateSavedGoogleDocsConnection(
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
      context: context, appIdOrSlug: connection.appId, fallbackSlug: "google-docs")
    guard app.slug == "google-docs", connection.appId == app.id else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Only Google Docs OAuth connections can be tested here.")
    }
    if connection.credentialOwnership == .relayOwned {
      let required = ["google_docs_oauth_access_token", "google_docs_oauth_refresh_token"]
      let byKey = Dictionary(
        uniqueKeysWithValues: connection.credentialRequirements.map { ($0.fieldKey, $0) })
      let unreadable = required.filter { field in
        guard let id = byKey[field]?.secretReferenceId else { return true }
        return (try? secrets.getSecretValue(id))?.providerConnectionNilIfEmpty == nil
      }
      guard unreadable.isEmpty,
        connection.grantedScopes == Self.googleDocsRelayOwnedOAuthScopes,
        connection.health.diagnostics["documentTargetRequired"]?.bool == true
      else {
        connection.status = .authRequired
        connection.health.state = .error
        connection.health.message =
          "Google Docs Relay-owned token references, exact scope, or document-target boundary require reconnect."
        connection.reauthorizeRequired = true
        return try saveConnection(context: context, connection: connection)
      }
      connection.status = .connected
      connection.health.state = .ready
      connection.health.message =
        "Google Docs Relay-owned token references and exact documents scope are ready."
      connection.reauthorizeRequired = false
      connection.updatedAt = ISO8601DateFormatter.relayConsole.string(from: now)
      return try saveConnection(context: context, connection: connection)
    }
    let requiredFields = [
      "google_docs_oauth_client_id",
      "google_docs_oauth_client_secret",
      "google_docs_oauth_refresh_token",
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
          "Google Docs connection is missing Keychain references for required OAuth credentials. Replace the Google Docs connection in Marketplace.",
        unavailableFields: missingFields,
        missingScopes: Self.googleDocsOAuthScopes
      )
      return try saveGoogleDocsHealthResult(validation, connection: &connection, app: app, now: now)
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
          "Relay could not read the saved Google Docs OAuth credentials from the OS secret store. Replace the Google Docs connection in Marketplace.",
        unavailableFields: unreadableFields,
        missingScopes: Self.googleDocsOAuthScopes
      )
      return try saveGoogleDocsHealthResult(validation, connection: &connection, app: app, now: now)
    }

    let validation = await googleOAuthValidator.validateDocsCredentials(
      clientId: secretValuesByField["google_docs_oauth_client_id"] ?? "",
      clientSecret: secretValuesByField["google_docs_oauth_client_secret"] ?? "",
      refreshToken: secretValuesByField["google_docs_oauth_refresh_token"] ?? "",
      requiredScopes: Self.googleDocsOAuthScopes
    )
    return try saveGoogleDocsHealthResult(validation, connection: &connection, app: app, now: now)
  }

  @discardableResult
  public func saveGoogleDriveOAuthCredentials(
    context: ServiceRequestContext,
    appIdOrSlug: RelayId,
    clientId: String,
    clientSecret: String,
    refreshToken: String,
    accessToken: String?,
    accountEmail: String?,
    displayName: String? = nil,
    credentialOwnership: ProviderCredentialOwnership = .userOwned,
    userOwnedCredentialsRequired: Bool = true,
    relayOwnedGoogleApp: Bool = false,
    providerKey: String = "google-drive-user-oauth",
    scopes: [String]? = nil,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "google-drive")
    guard app.slug == "google-drive" else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "Google Drive OAuth credentials can only be saved for the Google Drive Marketplace app.")
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
    let selectedScopes = scopes?.isEmpty == false ? scopes! : Self.googleDriveOAuthScopes
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
      label: "Google Drive OAuth Client ID",
      secretValue: trimmedClientId
    )
    let clientSecretReference = try secrets.set(
      scope: "provider_connection",
      scopeId: connectionId,
      label: "Google Drive OAuth Client Secret",
      secretValue: trimmedClientSecret
    )
    let refreshTokenReference = try secrets.set(
      scope: "provider_connection",
      scopeId: connectionId,
      label: "Google Drive OAuth Refresh Token",
      secretValue: trimmedRefreshToken
    )
    let accessTokenReference = try trimmedAccessToken.map { token in
      try secrets.set(
        scope: "provider_connection",
        scopeId: connectionId,
        label: "Google Drive OAuth Access Token",
        secretValue: token
      )
    }
    var secretReferenceIds = [
      clientIdReference.id, clientSecretReference.id, refreshTokenReference.id,
    ]
    if let accessTokenReference {
      secretReferenceIds.append(accessTokenReference.id)
    }
    let connection = MarketplaceProviderConnection(
      id: connectionId,
      workspaceId: context.workspaceId,
      appId: app.id,
      appSlug: app.slug,
      providerKey: providerKey,
      providerName: "Google Drive",
      status: .connected,
      authorizationState: .completed,
      credentialOwnership: credentialOwnership,
      userOwnedCredentialsRequired: userOwnedCredentialsRequired,
      credentialRequirements: [
        ProviderCredentialRequirement(
          fieldKey: "google_drive_oauth_client_id",
          label: "Google OAuth client ID",
          required: true,
          userOwnedRequired: userOwnedCredentialsRequired,
          secretReferenceId: clientIdReference.id,
          status: .verified,
          helpText: relayOwnedGoogleApp
            ? "From Relay's Google Cloud OAuth client with the Drive API enabled. Stored locally as a Keychain reference."
            : "From the user's own Google Cloud OAuth client with the Drive API enabled. Stored locally as a Keychain reference.",
          redactionStatus: "secret-reference-only"
        ),
        ProviderCredentialRequirement(
          fieldKey: "google_drive_oauth_client_secret",
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
          fieldKey: "google_drive_oauth_refresh_token",
          label: "Google OAuth refresh token",
          required: true,
          userOwnedRequired: userOwnedCredentialsRequired,
          secretReferenceId: refreshTokenReference.id,
          status: .verified,
          helpText: relayOwnedGoogleApp
            ? "Refresh token granted by the user's Google account through Relay-owned OAuth."
            : "Refresh token granted by the user's own Google OAuth app and Drive account.",
          redactionStatus: "secret-reference-only"
        ),
        ProviderCredentialRequirement(
          fieldKey: "google_drive_oauth_access_token",
          label: "Google OAuth access token",
          required: false,
          userOwnedRequired: userOwnedCredentialsRequired,
          secretReferenceId: accessTokenReference?.id,
          status: accessTokenReference == nil ? .missing : .verified,
          helpText:
            "Optional short-lived access token for immediate health checks; refresh token remains the durable credential.",
          redactionStatus: "secret-reference-only"
        ),
      ],
      secretReferenceIds: secretReferenceIds,
      accountLabel: displayName?.providerConnectionNilIfEmpty ?? existing?.accountLabel
        ?? trimmedAccountEmail
        ?? "Google Drive OAuth account",
      connectedHandle: trimmedAccountEmail,
      callbackURL: nil,
      requiredScopes: selectedScopes,
      grantedScopes: selectedScopes,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message:
          "Google Drive OAuth credentials saved as Keychain references. Live Drive calls remain routed through Relay provider-action wrappers.",
        lastCheckedAt: timestamp,
        missingScopes: [],
        unavailableTools: [],
        diagnostics: [
          "provider": .string("google-drive"),
          "authMethod": .string(
            relayOwnedGoogleApp ? "google_oauth_relay_owned_drive" : "google_oauth_user_owned_drive"
          ),
          "callbackURLRequired": .bool(false),
          "credentialOwnership": .string(credentialOwnership.rawValue),
          "relayOwnedGoogleApp": .bool(relayOwnedGoogleApp),
          "secretStorage": .string("keychain-reference-only"),
          "clientSecretProvided": .bool(true),
          "accessTokenProvided": .bool(accessTokenReference != nil),
          "restrictedScopes": .bool(!relayOwnedGoogleApp),
          "scopePreset": .string(
            relayOwnedGoogleApp ? "drive_file" : "drive_metadata_readonly_readonly_file"),
        ],
        redactionStatus: "private-state-excluded"
      ),
      senderIdentities: trimmedAccountEmail.map {
        [
          ProviderSenderIdentity(
            id: "google-drive:\($0)",
            email: $0,
            validationStatus: .verified,
            agentId: nil,
            installId: nil,
            lastCheckedAt: timestamp,
            errorMessage: nil,
            redactionStatus: "private-state-excluded"
          )
        ]
      } ?? [],
      installPolicy: "approval_gated_drive_file_actions",
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
  public func validateSavedGoogleDriveConnection(
    context: ServiceRequestContext,
    connectionId: RelayId,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
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
      context: context, appIdOrSlug: connection.appId, fallbackSlug: "google-drive")
    guard app.slug == "google-drive", connection.appId == app.id else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Only Google Drive OAuth connections can be tested here.")
    }
    if connection.credentialOwnership == .relayOwned {
      let required = ["google_drive_oauth_access_token", "google_drive_oauth_refresh_token"]
      let byKey = Dictionary(
        uniqueKeysWithValues: connection.credentialRequirements.map { ($0.fieldKey, $0) })
      let unreadable = required.filter { field in
        guard let id = byKey[field]?.secretReferenceId else { return true }
        return (try? secrets.getSecretValue(id))?.providerConnectionNilIfEmpty == nil
      }
      guard unreadable.isEmpty,
        connection.grantedScopes == Self.googleDriveRelayOwnedOAuthScopes,
        connection.health.diagnostics["appVisibleFileCorpusEnforced"]?.bool == true
      else {
        connection.status = .authRequired
        connection.health.state = .error
        connection.health.message =
          "Google Drive Relay-owned token references, exact scope, or app-visible corpus require reconnect."
        connection.reauthorizeRequired = true
        return try saveConnection(context: context, connection: connection)
      }
      connection.status = .connected
      connection.health.state = .ready
      connection.health.message =
        "Google Drive Relay-owned token references and exact drive.file corpus are ready."
      connection.reauthorizeRequired = false
      connection.updatedAt = ISO8601DateFormatter.relayConsole.string(from: now)
      return try saveConnection(context: context, connection: connection)
    }
    let requiredFields = [
      "google_drive_oauth_client_id",
      "google_drive_oauth_client_secret",
      "google_drive_oauth_refresh_token",
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
          "Google Drive connection is missing Keychain references for required OAuth credentials. Replace the Google Drive connection in Marketplace.",
        unavailableFields: missingFields
      )
      return try saveGoogleDriveHealthResult(
        validation, connection: &connection, app: app, now: now)
    }

    var unreadableFields: [String] = []
    for field in requiredFields {
      guard let secretId = requirementsByKey[field]?.secretReferenceId else {
        unreadableFields.append(field)
        continue
      }
      do {
        _ = try secrets.getSecretValue(secretId)
      } catch {
        unreadableFields.append(field)
      }
    }
    guard unreadableFields.isEmpty else {
      let validation = GoogleOAuthCredentialValidationResult(
        status: .secretUnavailable,
        message:
          "Relay could not read the saved Google Drive OAuth credentials from the OS secret store. Replace the Google Drive connection in Marketplace.",
        unavailableFields: unreadableFields
      )
      return try saveGoogleDriveHealthResult(
        validation, connection: &connection, app: app, now: now)
    }

    let validation = GoogleOAuthCredentialValidationResult(
      status: .ready,
      message:
        "Google Drive OAuth credential references are readable. Live Drive API proof remains routed through provider-action wrappers."
    )
    return try saveGoogleDriveHealthResult(validation, connection: &connection, app: app, now: now)
  }

  @discardableResult
  public func saveGoogleCalendarOAuthCredentials(
    context: ServiceRequestContext,
    appIdOrSlug: RelayId,
    clientId: String,
    clientSecret: String,
    refreshToken: String,
    accessToken: String?,
    accountEmail: String?,
    defaultCalendarId: String?,
    displayName: String? = nil,
    credentialOwnership: ProviderCredentialOwnership = .userOwned,
    userOwnedCredentialsRequired: Bool = true,
    relayOwnedGoogleApp: Bool = false,
    providerKey: String = "google-calendar-user-oauth",
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "google-calendar")
    guard app.slug == "google-calendar" else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "Google Calendar OAuth credentials can only be saved for the Google Calendar Marketplace app."
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
    let trimmedDefaultCalendarId = defaultCalendarId?.providerConnectionNilIfEmpty ?? "primary"
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
      label: "Google Calendar OAuth Client ID",
      secretValue: trimmedClientId
    )
    let clientSecretReference = try secrets.set(
      scope: "provider_connection",
      scopeId: connectionId,
      label: "Google Calendar OAuth Client Secret",
      secretValue: trimmedClientSecret
    )
    let refreshTokenReference = try secrets.set(
      scope: "provider_connection",
      scopeId: connectionId,
      label: "Google Calendar OAuth Refresh Token",
      secretValue: trimmedRefreshToken
    )
    let accessTokenReference = try trimmedAccessToken.map { token in
      try secrets.set(
        scope: "provider_connection",
        scopeId: connectionId,
        label: "Google Calendar OAuth Access Token",
        secretValue: token
      )
    }
    var secretReferenceIds = [
      clientIdReference.id, clientSecretReference.id, refreshTokenReference.id,
    ]
    if let accessTokenReference {
      secretReferenceIds.append(accessTokenReference.id)
    }
    let connection = MarketplaceProviderConnection(
      id: connectionId,
      workspaceId: context.workspaceId,
      appId: app.id,
      appSlug: app.slug,
      providerKey: providerKey,
      providerName: "Google Calendar",
      status: .connected,
      authorizationState: .completed,
      credentialOwnership: credentialOwnership,
      userOwnedCredentialsRequired: userOwnedCredentialsRequired,
      credentialRequirements: [
        ProviderCredentialRequirement(
          fieldKey: "google_calendar_oauth_client_id",
          label: "Google OAuth client ID",
          required: true,
          userOwnedRequired: userOwnedCredentialsRequired,
          secretReferenceId: clientIdReference.id,
          status: .verified,
          helpText: relayOwnedGoogleApp
            ? "From Relay's Google Cloud OAuth client with the Calendar API enabled. Stored locally as a Keychain reference."
            : "From the user's own Google Cloud OAuth client with the Calendar API enabled. Stored locally as a Keychain reference.",
          redactionStatus: "secret-reference-only"
        ),
        ProviderCredentialRequirement(
          fieldKey: "google_calendar_oauth_client_secret",
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
          fieldKey: "google_calendar_oauth_refresh_token",
          label: "Google OAuth refresh token",
          required: true,
          userOwnedRequired: userOwnedCredentialsRequired,
          secretReferenceId: refreshTokenReference.id,
          status: .verified,
          helpText: relayOwnedGoogleApp
            ? "Refresh token granted by the user's Google account through Relay-owned OAuth."
            : "Refresh token granted by the user's own Google OAuth app and Calendar account.",
          redactionStatus: "secret-reference-only"
        ),
        ProviderCredentialRequirement(
          fieldKey: "google_calendar_oauth_access_token",
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
          fieldKey: "google_calendar_default_calendar_id",
          label: "Default calendar ID",
          required: false,
          userOwnedRequired: false,
          secretReferenceId: nil,
          status: .verified,
          helpText:
            "Non-secret calendar id used as the default event target. Use primary unless the user chooses another calendar.",
          redactionStatus: "private-state-excluded"
        ),
      ],
      secretReferenceIds: secretReferenceIds,
      accountLabel: displayName?.providerConnectionNilIfEmpty ?? existing?.accountLabel
        ?? trimmedAccountEmail
        ?? "Google Calendar OAuth account",
      connectedHandle: trimmedAccountEmail,
      callbackURL: nil,
      requiredScopes: Self.googleCalendarOAuthScopes,
      grantedScopes: Self.googleCalendarOAuthScopes,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message:
          "Google Calendar OAuth credentials saved as Keychain references. Live Calendar calls remain routed through Relay provider-action wrappers.",
        lastCheckedAt: timestamp,
        missingScopes: [],
        unavailableTools: [],
        diagnostics: [
          "provider": .string("google-calendar"),
          "authMethod": .string(
            relayOwnedGoogleApp
              ? "google_oauth_relay_owned_calendar" : "google_oauth_user_owned_calendar"),
          "callbackURLRequired": .bool(false),
          "credentialOwnership": .string(credentialOwnership.rawValue),
          "relayOwnedGoogleApp": .bool(relayOwnedGoogleApp),
          "secretStorage": .string("keychain-reference-only"),
          "clientSecretProvided": .bool(true),
          "accessTokenProvided": .bool(accessTokenReference != nil),
          "restrictedScopes": .bool(true),
          "defaultCalendarId": .string(trimmedDefaultCalendarId),
          "scopePreset": .string("calendar_events_read_write_freebusy"),
        ],
        redactionStatus: "private-state-excluded"
      ),
      senderIdentities: trimmedAccountEmail.map {
        [
          ProviderSenderIdentity(
            id: "google-calendar:\($0)",
            email: $0,
            validationStatus: .verified,
            agentId: nil,
            installId: nil,
            lastCheckedAt: timestamp,
            errorMessage: nil,
            redactionStatus: "private-state-excluded"
          )
        ]
      } ?? [],
      installPolicy: "approval_gated_calendar_event_actions",
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
  public func validateSavedGoogleCalendarConnection(
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
      context: context, appIdOrSlug: connection.appId, fallbackSlug: "google-calendar")
    guard app.slug == "google-calendar", connection.appId == app.id else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Only Google Calendar OAuth connections can be tested here.")
    }
    if connection.credentialOwnership == .relayOwned {
      let required = ["google_calendar_oauth_access_token", "google_calendar_oauth_refresh_token"]
      let byKey = Dictionary(
        uniqueKeysWithValues: connection.credentialRequirements.map { ($0.fieldKey, $0) })
      let missing = required.filter {
        byKey[$0]?.secretReferenceId?.providerConnectionNilIfEmpty == nil
      }
      let unreadable = required.filter { field in
        guard let id = byKey[field]?.secretReferenceId else { return true }
        return (try? secrets.getSecretValue(id))?.providerConnectionNilIfEmpty == nil
      }
      guard missing.isEmpty, unreadable.isEmpty,
        connection.grantedScopes == Self.googleCalendarRelayOwnedOAuthScopes
      else {
        connection.status = .authRequired
        connection.health.state = .error
        connection.health.message =
          "Google Calendar Relay-owned token references or exact scopes require reconnect."
        connection.reauthorizeRequired = true
        return try saveConnection(context: context, connection: connection)
      }
      connection.status = .connected
      connection.health.state = .ready
      connection.health.message =
        "Google Calendar Relay-owned token references and exact scopes are ready."
      connection.reauthorizeRequired = false
      connection.updatedAt = ISO8601DateFormatter.relayConsole.string(from: now)
      return try saveConnection(context: context, connection: connection)
    }
    let requiredFields = [
      "google_calendar_oauth_client_id",
      "google_calendar_oauth_client_secret",
      "google_calendar_oauth_refresh_token",
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
          "Google Calendar connection is missing Keychain references for required OAuth credentials. Replace the Google Calendar connection in Marketplace.",
        unavailableFields: missingFields,
        missingScopes: Self.googleCalendarOAuthScopes
      )
      return try saveGoogleCalendarHealthResult(
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
          "Relay could not read the saved Google Calendar OAuth credentials from the OS secret store. Replace the Google Calendar connection in Marketplace.",
        unavailableFields: unreadableFields,
        missingScopes: Self.googleCalendarOAuthScopes
      )
      return try saveGoogleCalendarHealthResult(
        validation, connection: &connection, app: app, now: now)
    }

    let validation = await googleOAuthValidator.validateCalendarCredentials(
      clientId: secretValuesByField["google_calendar_oauth_client_id"] ?? "",
      clientSecret: secretValuesByField["google_calendar_oauth_client_secret"] ?? "",
      refreshToken: secretValuesByField["google_calendar_oauth_refresh_token"] ?? "",
      requiredScopes: Self.googleCalendarOAuthScopes
    )
    return try saveGoogleCalendarHealthResult(
      validation, connection: &connection, app: app, now: now)
  }
}
