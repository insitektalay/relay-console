import Foundation

extension ProviderConnectionService {
  @discardableResult
  public func saveGmailOAuthCredentials(
    context: ServiceRequestContext,
    appIdOrSlug: RelayId,
    clientId: String,
    clientSecret: String,
    refreshToken: String,
    accessToken: String?,
    accountEmail: String?,
    displayName: String? = nil,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "gmail")
    guard app.slug == "gmail" else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "Gmail OAuth credentials can only be saved for the Gmail Marketplace app.")
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
      label: "Gmail Google OAuth Client ID",
      secretValue: trimmedClientId
    )
    let clientSecretReference = try secrets.set(
      scope: "provider_connection",
      scopeId: connectionId,
      label: "Gmail Google OAuth Client Secret",
      secretValue: trimmedClientSecret
    )
    let refreshTokenReference = try secrets.set(
      scope: "provider_connection",
      scopeId: connectionId,
      label: "Gmail Google OAuth Refresh Token",
      secretValue: trimmedRefreshToken
    )
    let accessTokenReference = try trimmedAccessToken.map { token in
      try secrets.set(
        scope: "provider_connection",
        scopeId: connectionId,
        label: "Gmail Google OAuth Access Token",
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
      providerKey: "gmail-user-oauth",
      providerName: "Gmail",
      status: .connected,
      authorizationState: .completed,
      credentialOwnership: .userOwned,
      userOwnedCredentialsRequired: true,
      credentialRequirements: [
        ProviderCredentialRequirement(
          fieldKey: "google_oauth_client_id",
          label: "Google OAuth client ID",
          required: true,
          userOwnedRequired: true,
          secretReferenceId: clientIdReference.id,
          status: .verified,
          helpText:
            "From the user's own Google Cloud OAuth client. Stored locally as a Keychain reference.",
          redactionStatus: "secret-reference-only"
        ),
        ProviderCredentialRequirement(
          fieldKey: "google_oauth_client_secret",
          label: "Google OAuth client secret",
          required: true,
          userOwnedRequired: true,
          secretReferenceId: clientSecretReference.id,
          status: .verified,
          helpText:
            "From the user's own Google Cloud OAuth client. Stored locally as a Keychain reference.",
          redactionStatus: "secret-reference-only"
        ),
        ProviderCredentialRequirement(
          fieldKey: "google_oauth_refresh_token",
          label: "Google OAuth refresh token",
          required: true,
          userOwnedRequired: true,
          secretReferenceId: refreshTokenReference.id,
          status: .verified,
          helpText: "Refresh token granted by the user's own Google OAuth app and Gmail account.",
          redactionStatus: "secret-reference-only"
        ),
        ProviderCredentialRequirement(
          fieldKey: "google_oauth_access_token",
          label: "Google OAuth access token",
          required: false,
          userOwnedRequired: true,
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
        ?? "Gmail OAuth account",
      connectedHandle: trimmedAccountEmail,
      callbackURL: nil,
      requiredScopes: Self.gmailOAuthScopes,
      grantedScopes: Self.gmailOAuthScopes,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message:
          "Gmail OAuth credentials saved as Keychain references. Live Gmail calls remain routed through Relay provider-action wrappers.",
        lastCheckedAt: timestamp,
        missingScopes: [],
        unavailableTools: [],
        diagnostics: [
          "provider": .string("gmail"),
          "authMethod": .string("google_oauth_user_owned"),
          "callbackURLRequired": .bool(false),
          "credentialOwnership": .string("user-owned"),
          "relayOwnedGoogleApp": .bool(false),
          "secretStorage": .string("keychain-reference-only"),
          "clientSecretProvided": .bool(true),
          "accessTokenProvided": .bool(accessTokenReference != nil),
          "restrictedScopes": .bool(true),
        ],
        redactionStatus: "private-state-excluded"
      ),
      senderIdentities: trimmedAccountEmail.map {
        [
          ProviderSenderIdentity(
            id: "gmail:\($0)",
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
      installPolicy: "approval_gated_email_actions",
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
  public func saveGmailRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    accountEmail: String, grantedScopes: [String], expiresAt: String?, displayName: String? = nil,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "gmail")
    let email = accountEmail.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
    guard app.slug == "gmail", email.count <= 320, email.contains("@"),
      !email.contains(where: { $0.isWhitespace }), grantedScopes == Self.gmailOAuthScopes
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "Relay-owned Gmail OAuth requires an authorized account email and exact gmail.readonly/gmail.compose scopes."
      )
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "Gmail OAuth access token", maxLength: 30000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "Gmail OAuth refresh token", maxLength: 30000)
    let id = createRelayId("mpc")
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let a = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Gmail OAuth access token",
      secretValue: access)
    let r: SecretReference
    do {
      r = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Gmail OAuth refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(a.id)
      throw error
    }
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "google_oauth_access_token", label: "Google OAuth access token", required: true,
        userOwnedRequired: false, secretReferenceId: a.id, status: .verified,
        helpText:
          "Short-lived access token stored only as a Keychain reference and replaced by the secure Railway broker.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "google_oauth_refresh_token", label: "Google OAuth refresh token", required: true,
        userOwnedRequired: false, secretReferenceId: r.id, status: .verified,
        helpText:
          "Offline refresh token stored separately; only the secure Railway broker uses the Relay client secret.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "gmail_google_account", label: "Authorized Gmail account", required: true,
        userOwnedRequired: false, secretReferenceId: nil, status: .verified,
        helpText: "Exact Google account returned by the verified Relay OAuth flow.",
        redactionStatus: "private-state-excluded"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "gmail-relay-owned-google-oauth:" + email, providerName: "Gmail",
      status: .connected, authorizationState: .completed, credentialOwnership: .relayOwned,
      userOwnedCredentialsRequired: false, credentialRequirements: requirements,
      secretReferenceIds: [a.id, r.id],
      accountLabel: displayName?.providerConnectionNilIfEmpty ?? email,
      connectedHandle: email, callbackURL: nil, requiredScopes: Self.gmailOAuthScopes,
      grantedScopes: Self.gmailOAuthScopes, selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message: "Relay-owned Gmail OAuth is ready for brokered semantic mail actions.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("gmail"),
          "authMethod": .string("google_oauth_confidential_web_server_offline"),
          "apiOrigin": .string("https://gmail.googleapis.com"),
          "tokenOrigin": .string("https://oauth2.googleapis.com/token"),
          "accountEmail": .string(email),
          "accessExpiresAt": expiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
          "exactScopes": .array(Self.gmailOAuthScopes.map(JSONValue.string)),
          "restrictedScopes": .bool(true), "restrictedScopeVerificationRequired": .bool(true),
          "annualSecurityAssessmentRequired": .bool(true),
          "clientSecretLocation": .string("secure-railway-broker-only"),
          "rawTokenStoredInDatabase": .bool(false),
        ], redactionStatus: "private-state-excluded"),
      senderIdentities: [
        ProviderSenderIdentity(
          id: "gmail:" + email, email: email, validationStatus: .verified, agentId: nil,
          installId: nil, lastCheckedAt: timestamp, errorMessage: nil,
          redactionStatus: "private-state-excluded")
      ], installPolicy: "approval_gated_email_actions_with_direct_write_option",
      lastCheckedAt: timestamp, lastError: nil, manualEvidenceNote: nil, reauthorizeRequired: false,
      disconnecting: false, betaBlocked: false, createdAt: timestamp, updatedAt: timestamp,
      redactionStatus: "private-state-excluded")
    do { return try saveConnection(context: context, connection: connection) } catch {
      _ = try? secrets.delete(a.id)
      _ = try? secrets.delete(r.id)
      throw error
    }
  }

  @discardableResult
  public func rotateGmailRelayOwnedOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String?, expiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    gmailTokenRotationLock.lock()
    defer { gmailTokenRotationLock.unlock() }
    guard
      var connection = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      connection.appSlug == "gmail", connection.credentialOwnership == .relayOwned
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "A Relay-owned Gmail OAuth connection is required.")
    }
    let access = try requireNonEmptyString(
      accessToken, field: "Gmail OAuth access token", maxLength: 30000)
    let oldAccess = connection.credentialRequirements.first(where: {
      $0.fieldKey == "google_oauth_access_token"
    })?.secretReferenceId
    let oldRefresh = connection.credentialRequirements.first(where: {
      $0.fieldKey == "google_oauth_refresh_token"
    })?.secretReferenceId
    let a = try secrets.set(
      scope: "provider_connection", scopeId: connection.id, label: "Gmail OAuth access token",
      secretValue: access)
    let newRefresh = refreshToken?.providerConnectionNilIfEmpty
    let r: SecretReference?
    do {
      r = try newRefresh.map {
        try secrets.set(
          scope: "provider_connection", scopeId: connection.id, label: "Gmail OAuth refresh token",
          secretValue: $0)
      }
    } catch {
      _ = try? secrets.delete(a.id)
      throw error
    }
    connection.credentialRequirements = connection.credentialRequirements.map { value in
      var copy = value
      if copy.fieldKey == "google_oauth_access_token" { copy.secretReferenceId = a.id }
      if copy.fieldKey == "google_oauth_refresh_token", let r { copy.secretReferenceId = r.id }
      return copy
    }
    connection.secretReferenceIds = [a.id, r?.id ?? oldRefresh].compactMap { $0 }
    connection.updatedAt = ISO8601DateFormatter.relayConsole.string(from: now)
    connection.health.diagnostics["accessExpiresAt"] =
      expiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null
    do {
      let saved = try saveConnection(context: context, connection: connection)
      if let oldAccess { _ = try? secrets.delete(oldAccess) }
      if r != nil, let oldRefresh { _ = try? secrets.delete(oldRefresh) }
      return saved
    } catch {
      _ = try? secrets.delete(a.id)
      if let r { _ = try? secrets.delete(r.id) }
      throw error
    }
  }
}
