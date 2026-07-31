import Foundation

extension ProviderConnectionService {
  @discardableResult public func saveLinkedInRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String,
    memberSubject: String, memberName: String, memberLocale: String?, grantedScopes: [String],
    expiresAt: String, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "linkedin")
    let subject = try requireNonEmptyString(
      memberSubject, field: "LinkedIn member subject", maxLength: 256)
    let name = try requireNonEmptyString(memberName, field: "LinkedIn member name", maxLength: 512)
    let expiry = try requireNonEmptyString(expiresAt, field: "LinkedIn token expiry", maxLength: 64)
    guard app.slug == "linkedin",
      subject.allSatisfy({ $0.isLetter || $0.isNumber || "-_.".contains($0) }),
      (ISO8601DateFormatter.relayConsole.date(from: expiry)
        ?? ISO8601DateFormatter().date(from: expiry)) != nil,
      grantedScopes == Self.linkedInRelayOwnedOAuthScopes
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "LinkedIn requires exact openid, profile, and w_member_social scopes, one verified member, and a finite access-token expiry."
      )
    }
    try validateAppCanAuthorize(app, context: context)
    let id = createRelayId("mpc")
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let token = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "LinkedIn OAuth access token",
      secretValue: try requireNonEmptyString(
        accessToken, field: "LinkedIn OAuth access token", maxLength: 30000))
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "linkedin_oauth_access_token", label: "LinkedIn OAuth access token",
        required: true, userOwnedRequired: false, secretReferenceId: token.id, status: .verified,
        helpText:
          "Short-lived Relay-owned token; reauthorize on expiry because self-serve refresh is not assumed.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "linkedin_connected_member", label: "Connected LinkedIn member", required: true,
        userOwnedRequired: false, secretReferenceId: nil, status: .verified,
        helpText: "Bound OIDC member subject; email and picture are excluded.",
        redactionStatus: "private-state-excluded"),
    ]
    let diagnostics: [String: JSONValue] = [
      "apiOrigin": .string("https://api.linkedin.com"),
      "authorizeOrigin": .string("https://www.linkedin.com/oauth/v2/authorization"),
      "railwayCallbackOnly": .bool(true), "memberSubject": .string(subject),
      "memberName": .string(name),
      "memberLocale": memberLocale?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
      "memberVerified": .bool(true), "tokenExpiresAt": .string(expiry),
      "refreshTokenAssumed": .bool(false), "emailScopeEnabled": .bool(false),
      "memberSocialReadEnabled": .bool(false), "commentsLikesEnabled": .bool(false),
      "mediaOrganizationEnabled": .bool(false), "searchScrapingEnabled": .bool(false),
      "automaticRetry": .bool(false), "automaticPagination": .bool(false),
      "rawToolsEnabled": .bool(false), "maxPostCharacters": .number(3000),
      "linkedinVersion": .string("202603"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "linkedin-relay-owned-oauth:" + subject, providerName: "LinkedIn",
      status: .connected, authorizationState: .completed, credentialOwnership: .relayOwned,
      userOwnedCredentialsRequired: false, credentialRequirements: requirements,
      secretReferenceIds: [token.id], accountLabel: name, connectedHandle: nil, callbackURL: nil,
      requiredScopes: Self.linkedInRelayOwnedOAuthScopes,
      grantedScopes: Self.linkedInRelayOwnedOAuthScopes, selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message:
          "LinkedIn is ready for bounded member identity, local draft, and approval-gated text posting.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [], diagnostics: diagnostics,
        redactionStatus: "private-state-excluded"), senderIdentities: [],
      installPolicy: "connected_member_text_posting", lastCheckedAt: timestamp, lastError: nil,
      manualEvidenceNote: nil, reauthorizeRequired: false, disconnecting: false, betaBlocked: false,
      createdAt: timestamp, updatedAt: timestamp, redactionStatus: "private-state-excluded")
    do { return try saveConnection(context: context, connection: connection) } catch {
      _ = try? secrets.delete(token.id)
      throw error
    }
  }

  @discardableResult public func rotateLinkedInRelayOwnedOAuthAccessToken(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String, expiresAt: String,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    linkedInTokenRotationLock.lock()
    defer { linkedInTokenRotationLock.unlock() }
    let expiry = try requireNonEmptyString(expiresAt, field: "LinkedIn token expiry", maxLength: 64)
    guard
      (ISO8601DateFormatter.relayConsole.date(from: expiry)
        ?? ISO8601DateFormatter().date(from: expiry)) != nil,
      var connection = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      connection.appSlug == "linkedin", connection.credentialOwnership == .relayOwned,
      connection.grantedScopes == Self.linkedInRelayOwnedOAuthScopes,
      connection.health.diagnostics["memberVerified"]?.bool == true
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "An exact Relay-owned LinkedIn member connection is required.")
    }
    let old = connection.credentialRequirements.first {
      $0.fieldKey == "linkedin_oauth_access_token"
    }?.secretReferenceId
    let token = try secrets.set(
      scope: "provider_connection", scopeId: connection.id, label: "LinkedIn OAuth access token",
      secretValue: try requireNonEmptyString(
        accessToken, field: "LinkedIn OAuth access token", maxLength: 30000))
    connection.credentialRequirements = connection.credentialRequirements.map { value in
      var copy = value
      if copy.fieldKey == "linkedin_oauth_access_token" { copy.secretReferenceId = token.id }
      return copy
    }
    connection.secretReferenceIds = [token.id]
    connection.health.diagnostics["tokenExpiresAt"] = .string(expiry)
    connection.updatedAt = ISO8601DateFormatter.relayConsole.string(from: now)
    do {
      let saved = try saveConnection(context: context, connection: connection)
      if let old { _ = try? secrets.delete(old) }
      return saved
    } catch {
      _ = try? secrets.delete(token.id)
      throw error
    }
  }

  @discardableResult
  public func connectLinkedInManualAccessToken(
    context: ServiceRequestContext,
    appIdOrSlug: RelayId,
    clientId: String,
    clientSecret: String,
    accessToken: String,
    refreshToken: String?,
    expiresAt: String?,
    displayName: String? = nil,
    now: Date = Date()
  ) async throws -> MarketplaceProviderConnection {
    let validation = await linkedInValidator.validate(
      accessToken: accessToken,
      clientId: clientId,
      clientSecret: clientSecret,
      requiredScopes: Self.linkedInManualTokenScopes
    )
    return try saveLinkedInManualAccessToken(
      context: context,
      appIdOrSlug: appIdOrSlug,
      clientId: clientId,
      clientSecret: clientSecret,
      accessToken: accessToken,
      refreshToken: refreshToken,
      expiresAt: validation.expiresAt ?? expiresAt,
      displayName: displayName,
      validationResult: validation,
      now: now
    )
  }

  @discardableResult
  public func saveLinkedInManualAccessToken(
    context: ServiceRequestContext,
    appIdOrSlug: RelayId,
    clientId: String? = nil,
    clientSecret: String? = nil,
    accessToken: String,
    refreshToken: String?,
    expiresAt: String?,
    displayName: String? = nil,
    validationResult: LinkedInTokenValidationResult? = nil,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "linkedin")
    guard app.slug == "linkedin" else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "LinkedIn manual access tokens can only be saved for the LinkedIn Marketplace app."
      )
    }
    try validateAppCanAuthorize(app, context: context)
    let trimmedClientId = clientId?.providerConnectionNilIfEmpty
    let trimmedClientSecret = clientSecret?.providerConnectionNilIfEmpty
    let trimmedAccessToken = try requireNonEmptyString(
      accessToken, field: "LinkedIn Access Token", maxLength: 20000)
    let trimmedRefreshToken = refreshToken?.providerConnectionNilIfEmpty
    let trimmedExpiresAt =
      validationResult?.expiresAt?.providerConnectionNilIfEmpty
      ?? expiresAt?.providerConnectionNilIfEmpty
    if let validationResult, !validationResult.isReady {
      throw ServiceGuard.unavailable(
        context: context,
        reasonCode: validationResult.status == .invalidToken
          || validationResult.status == .expiredToken ? .authRequired : .runtimeUnavailable,
        message: validationResult.message
      )
    }
    let validatedGrantedScopes = validationResult?.grantedScopes ?? []
    let grantedScopes =
      validatedGrantedScopes.isEmpty ? Self.linkedInManualTokenScopes : validatedGrantedScopes
    let grantedScopeSet = Set(grantedScopes.map { $0.lowercased() })
    let missingScopes =
      validationResult?.missingScopes
      ?? Self.linkedInManualTokenScopes.filter { !grantedScopeSet.contains($0.lowercased()) }
    let tokenReadVerified = validationResult?.isReady == true
    let unavailableTools =
      missingScopes.contains("w_member_social")
      ? ["linkedin_text_post_create", "linkedin_comment_create"]
      : []
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let connectionId = existing?.id ?? createRelayId("mpc")
    let existingSecretIds = existing.map { Self.secretReferenceIds(in: $0) } ?? []
    for secretId in existingSecretIds {
      _ = try? secrets.delete(secretId)
    }

    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let clientIdReference = try trimmedClientId.map { value in
      try secrets.set(
        scope: "provider_connection",
        scopeId: connectionId,
        label: "LinkedIn Client ID",
        secretValue: value
      )
    }
    let clientSecretReference = try trimmedClientSecret.map { value in
      try secrets.set(
        scope: "provider_connection",
        scopeId: connectionId,
        label: "LinkedIn Client Secret",
        secretValue: value
      )
    }
    let accessTokenReference = try secrets.set(
      scope: "provider_connection",
      scopeId: connectionId,
      label: "LinkedIn Access Token",
      secretValue: trimmedAccessToken
    )
    let refreshTokenReference = try trimmedRefreshToken.map { token in
      try secrets.set(
        scope: "provider_connection",
        scopeId: connectionId,
        label: "LinkedIn Refresh Token",
        secretValue: token
      )
    }
    var secretReferenceIds = [accessTokenReference.id]
    if let clientIdReference {
      secretReferenceIds.append(clientIdReference.id)
    }
    if let clientSecretReference {
      secretReferenceIds.append(clientSecretReference.id)
    }
    if let refreshTokenReference {
      secretReferenceIds.append(refreshTokenReference.id)
    }
    let connection = MarketplaceProviderConnection(
      id: connectionId,
      workspaceId: context.workspaceId,
      appId: app.id,
      appSlug: app.slug,
      providerKey: "linkedin-manual-token",
      providerName: "LinkedIn",
      status: .connected,
      authorizationState: .completed,
      credentialOwnership: .userOwned,
      userOwnedCredentialsRequired: true,
      credentialRequirements: [
        ProviderCredentialRequirement(
          fieldKey: "linkedin_client_id",
          label: "LinkedIn Client ID",
          required: true,
          userOwnedRequired: true,
          secretReferenceId: clientIdReference?.id,
          status: clientIdReference == nil ? .missing : .verified,
          helpText:
            "Client ID from the user's own LinkedIn developer app. Used with token introspection to verify token health and scopes.",
          redactionStatus: "secret-reference-only"
        ),
        ProviderCredentialRequirement(
          fieldKey: "linkedin_client_secret",
          label: "LinkedIn Client Secret",
          required: true,
          userOwnedRequired: true,
          secretReferenceId: clientSecretReference?.id,
          status: clientSecretReference == nil ? .missing : .verified,
          helpText:
            "Client secret from the user's own LinkedIn developer app. Stored only as a Keychain reference and used for token introspection.",
          redactionStatus: "secret-reference-only"
        ),
        ProviderCredentialRequirement(
          fieldKey: "linkedin_access_token",
          label: "LinkedIn Access Token",
          required: true,
          userOwnedRequired: true,
          secretReferenceId: accessTokenReference.id,
          status: .verified,
          helpText:
            "Manually generated by the user from their own LinkedIn developer app and stored as a Keychain reference.",
          redactionStatus: "secret-reference-only"
        ),
        ProviderCredentialRequirement(
          fieldKey: "linkedin_refresh_token",
          label: "LinkedIn Refresh Token",
          required: false,
          userOwnedRequired: true,
          secretReferenceId: refreshTokenReference?.id,
          status: refreshTokenReference == nil ? .missing : .verified,
          helpText:
            "Optional refresh token from the user's own LinkedIn app when LinkedIn grants programmatic refresh tokens.",
          redactionStatus: "secret-reference-only"
        ),
      ],
      secretReferenceIds: secretReferenceIds,
      accountLabel: displayName?.providerConnectionNilIfEmpty ?? validationResult?.displayName?
        .providerConnectionNilIfEmpty
        ?? existing?.accountLabel ?? "Manual LinkedIn member token",
      connectedHandle: nil,
      callbackURL: nil,
      requiredScopes: Self.linkedInManualTokenScopes,
      grantedScopes: grantedScopes,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: missingScopes.isEmpty && tokenReadVerified ? .ready : .degraded,
        message: validationResult?.message
          ?? "Manual LinkedIn access token saved. No Relay callback URL, Railway callback URL, or shared Relay-owned LinkedIn app is used.",
        lastCheckedAt: timestamp,
        missingScopes: missingScopes,
        unavailableTools: unavailableTools,
        diagnostics: [
          "provider": .string("linkedin"),
          "authMethod": .string("oauth2_manual_bearer_token"),
          "callbackURLRequired": .bool(false),
          "credentialOwnership": .string("user-owned"),
          "relayOwnedLinkedInApp": .bool(false),
          "secretStorage": .string("keychain-reference-only"),
          "clientCredentialsProvided": .bool(
            clientIdReference != nil && clientSecretReference != nil),
          "refreshTokenProvided": .bool(refreshTokenReference != nil),
          "tokenExpiresAt": .string(trimmedExpiresAt ?? "user-managed"),
          "tokenReadVerified": .bool(tokenReadVerified),
          "requiredPostingScopePresent": .bool(grantedScopeSet.contains("w_member_social")),
          "validationStatus": .string(validationResult?.status.rawValue ?? "manual_unverified"),
          "memberSub": validationResult?.memberSub.map(JSONValue.string) ?? .null,
          "email": validationResult?.email.map(JSONValue.string) ?? .null,
          "httpStatusCode": validationResult?.httpStatusCode.map { .number(Double($0)) } ?? .null,
        ],
        redactionStatus: "private-state-excluded"
      ),
      senderIdentities: [],
      installPolicy: "approval_gated_member_publishing",
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
}
