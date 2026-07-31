import Foundation

extension ProviderConnectionService {
  @discardableResult public func saveTypeformRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    accountId: String, accountLabel: String?, workspaceId: String, workspaceName: String?,
    apiOrigin: String, accessExpiresAt: String?,
    grantedScopes: [String] = ProviderConnectionService.typeformRelayOwnedOAuthScopes,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "typeform")
    guard app.slug == "typeform" else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "Typeform OAuth can only be saved for the Typeform Marketplace app.")
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "Typeform OAuth access token", maxLength: 30000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "Typeform OAuth refresh token", maxLength: 30000)
    let account = try requireNonEmptyString(accountId, field: "Typeform account ID", maxLength: 64)
    let workspace = try requireNonEmptyString(
      workspaceId, field: "Typeform workspace ID", maxLength: 64)
    let origin = apiOrigin.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    guard Self.isSafeTypeformIdentifier(account), Self.isSafeTypeformIdentifier(workspace),
      Self.typeformAPIOrigins.contains(origin), grantedScopes == Self.typeformRelayOwnedOAuthScopes
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "Typeform requires exact account/workspace IDs, an official validated API origin, and only accounts:read workspaces:read forms:read responses:read offline."
      )
    }
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let oldRefs = existing.map(Self.secretReferenceIds(in:)) ?? []
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Typeform OAuth access token",
      secretValue: access)
    let refreshRef: SecretReference
    do {
      refreshRef = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Typeform OAuth refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    let railway = ProcessInfo.processInfo.environment["CLAWCHAT_RAILWAY_ORIGIN"]?
      .providerConnectionNilIfEmpty?
      .trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    let callback = railway.map { $0 + "/api/v1/oauth/typeform/callback" }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let accountName = accountLabel?.providerConnectionNilIfEmpty.map { String($0.prefix(200)) }
    let workspaceLabel = workspaceName?.providerConnectionNilIfEmpty.map { String($0.prefix(200)) }
    let display = workspaceLabel ?? "Typeform workspace " + String(workspace.suffix(8))
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "typeform_oauth_access_token", label: "Typeform OAuth access token",
        required: true, userOwnedRequired: false, secretReferenceId: accessRef.id,
        status: .verified,
        helpText: "One-week provider-expiring token stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "typeform_oauth_refresh_token", label: "Typeform OAuth refresh token",
        required: true, userOwnedRequired: false, secretReferenceId: refreshRef.id,
        status: .verified,
        helpText: "Single-use rotating refresh token atomically replaced with the complete pair.",
        redactionStatus: "secret-reference-only"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "typeform-relay-owned-oauth:" + workspace, providerName: "Typeform",
      status: .connected, authorizationState: .completed, credentialOwnership: .relayOwned,
      userOwnedCredentialsRequired: false, credentialRequirements: requirements,
      secretReferenceIds: [accessRef.id, refreshRef.id], accountLabel: display,
      connectedHandle: accountName ?? String(account.suffix(8)), callbackURL: callback,
      requiredScopes: Self.typeformRelayOwnedOAuthScopes, grantedScopes: grantedScopes,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message:
          "Typeform OAuth references are ready for the exact account, selected workspace and validated data region.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("typeform"),
          "authMethod": .string("oauth2_authorization_code_rotating_access_refresh_pair"),
          "relayOwnedTypeformOAuth": .bool(true), "readOnlyV1": .bool(true),
          "accountId": .string(account), "accountLabel": accountName.map(JSONValue.string) ?? .null,
          "workspaceId": .string(workspace),
          "workspaceName": workspaceLabel.map(JSONValue.string) ?? .null,
          "apiOrigin": .string(origin),
          "accessExpiresAt": accessExpiresAt.map(JSONValue.string) ?? .null,
          "documentedDefaultAccessTokenLifetimeSeconds": .number(604800),
          "providerExpiresInAuthoritative": .bool(true), "singleUseRefreshToken": .bool(true),
          "refreshRotationDocumented": .bool(true),
          "tokenPairReplacement": .string("serialized-atomic-provider-returned-pair-replacement"),
          "exactScopes": .array(Self.typeformRelayOwnedOAuthScopes.map(JSONValue.string)),
          "accountRateLimitRequestsPerSecond": .number(2),
          "responseFreshnessCaveatMinutes": .number(30), "respondentContentReturned": .bool(false),
          "formOrResponseWritesAllowed": .bool(false), "automaticPaginationAllowed": .bool(false),
          "arbitraryQueryAllowed": .bool(false), "requiresSecureWebBackend": .bool(true),
          "productionCallbackConfigured": .bool(callback != nil),
          "callbackTransport": .string("railway-https-only"),
          "rawTokenStoredInDatabase": .bool(false), "rawProviderToolExposure": .bool(false),
        ], redactionStatus: "respondent-content-excluded"), senderIdentities: [],
      installPolicy: "approval_gated_typeform_form_response_reads", lastCheckedAt: timestamp,
      lastError: nil,
      manualEvidenceNote: callback == nil
        ? "Production Typeform OAuth requires CLAWCHAT_RAILWAY_ORIGIN, Developer App setup, account/workspace/region validation and deployed serialized refresh/disconnect broker."
        : nil, reauthorizeRequired: false, disconnecting: false, betaBlocked: false,
      createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp,
      redactionStatus: "respondent-content-excluded")
    do {
      let saved = try saveConnection(context: context, connection: connection)
      for ref in oldRefs where !saved.secretReferenceIds.contains(ref) {
        _ = try? secrets.delete(ref)
      }
      return saved
    } catch {
      _ = try? secrets.delete(accessRef.id)
      _ = try? secrets.delete(refreshRef.id)
      throw error
    }
  }
  @discardableResult public func rotateTypeformOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String, accessExpiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    typeformTokenRotationLock.lock()
    defer { typeformTokenRotationLock.unlock() }
    guard
      let existing = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      existing.appSlug == "typeform"
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Typeform connection is required for token replacement.")
    }
    let d = existing.health.diagnostics
    return try saveTypeformRelayOwnedOAuthConnection(
      context: context, appIdOrSlug: existing.appId, accessToken: accessToken,
      refreshToken: refreshToken, accountId: d["accountId"]?.string ?? "",
      accountLabel: d["accountLabel"]?.string, workspaceId: d["workspaceId"]?.string ?? "",
      workspaceName: d["workspaceName"]?.string, apiOrigin: d["apiOrigin"]?.string ?? "",
      accessExpiresAt: accessExpiresAt, grantedScopes: existing.grantedScopes, now: now)
  }

  @discardableResult public func saveSurveyMonkeyRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, userId: String,
    userName: String?, accessURL: String,
    grantedScopes: [String] = ProviderConnectionService.surveyMonkeyRelayOwnedOAuthScopes,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "surveymonkey")
    guard app.slug == "surveymonkey" else {
      throw ServiceGuard.invalidInput(
        context: context, message: "SurveyMonkey OAuth can only be saved for SurveyMonkey.")
    }
    try validateAppCanAuthorize(app, context: context)
    let token = try requireNonEmptyString(
      accessToken, field: "SurveyMonkey OAuth access token", maxLength: 30000)
    let user = try requireNonEmptyString(userId, field: "SurveyMonkey user ID", maxLength: 32)
    let origin = accessURL.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    guard Self.isSafeSurveyMonkeyIdentifier(user), Self.surveyMonkeyAccessURLs.contains(origin),
      grantedScopes == Self.surveyMonkeyRelayOwnedOAuthScopes
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "SurveyMonkey requires an exact /users/me user, provider-returned official access_url, and only users_read surveys_read responses_read."
      )
    }
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let oldRefs = existing.map(Self.secretReferenceIds(in:)) ?? []
    let ref = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "SurveyMonkey OAuth access token",
      secretValue: token)
    let railway = ProcessInfo.processInfo.environment["CLAWCHAT_RAILWAY_ORIGIN"]?
      .providerConnectionNilIfEmpty?
      .trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    let callback = railway.map { $0 + "/api/v1/oauth/surveymonkey/callback" }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let name = userName?.providerConnectionNilIfEmpty.map { String($0.prefix(200)) }
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "surveymonkey_oauth_access_token", label: "SurveyMonkey OAuth access token",
        required: true, userOwnedRequired: false, secretReferenceId: ref.id, status: .verified,
        helpText: "Currently non-expiring revocable token stored as a Keychain reference.",
        redactionStatus: "secret-reference-only")
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "surveymonkey-relay-owned-oauth:" + user, providerName: "SurveyMonkey",
      status: .connected, authorizationState: .completed, credentialOwnership: .relayOwned,
      userOwnedCredentialsRequired: false, credentialRequirements: requirements,
      secretReferenceIds: [ref.id],
      accountLabel: name ?? "SurveyMonkey user " + String(user.suffix(8)),
      connectedHandle: String(user.suffix(8)), callbackURL: callback,
      requiredScopes: Self.surveyMonkeyRelayOwnedOAuthScopes, grantedScopes: grantedScopes,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message:
          "SurveyMonkey OAuth reference is ready for the exact user and provider-returned regional API origin.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("surveymonkey"), "relayOwnedSurveyMonkeyOAuth": .bool(true),
          "userId": .string(user), "userName": name.map(JSONValue.string) ?? .null,
          "accessURL": .string(origin), "accessTokenCurrentlyExpires": .bool(false),
          "refreshTokenDocumented": .bool(false), "revocationRequiresReauthorization": .bool(true),
          "exactScopes": .array(Self.surveyMonkeyRelayOwnedOAuthScopes.map(JSONValue.string)),
          "responseDetailsScopeRequested": .bool(false), "answersReturned": .bool(false),
          "automaticPaginationAllowed": .bool(false), "rateLimitHeadersAuthoritative": .bool(true),
          "callbackTransport": .string("railway-https-only"),
          "rawTokenStoredInDatabase": .bool(false),
        ], redactionStatus: "response-content-excluded"), senderIdentities: [],
      installPolicy: "approval_gated_surveymonkey_metadata_reads", lastCheckedAt: timestamp,
      lastError: nil,
      manualEvidenceNote: callback == nil
        ? "Production SurveyMonkey requires CLAWCHAT_RAILWAY_ORIGIN, deployed Public App exchange/user/access_url/revoke/disconnect broker and live acceptance."
        : nil, reauthorizeRequired: false, disconnecting: false, betaBlocked: false,
      createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp,
      redactionStatus: "response-content-excluded")
    do {
      let saved = try saveConnection(context: context, connection: connection)
      for old in oldRefs where !saved.secretReferenceIds.contains(old) {
        _ = try? secrets.delete(old)
      }
      return saved
    } catch {
      _ = try? secrets.delete(ref.id)
      throw error
    }
  }
  @discardableResult public func saveFilloutRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, baseURL: String,
    authorizationLabel: String?,
    grantedScopes: [String] = ProviderConnectionService.filloutOAuthPermissions, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "fillout")
    guard app.slug == "fillout" else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Fillout OAuth can only be saved for Fillout.")
    }
    try validateAppCanAuthorize(app, context: context)
    let token = try requireNonEmptyString(
      accessToken, field: "Fillout OAuth access token", maxLength: 30000)
    let origin = baseURL.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    guard Self.filloutAPIBaseURLs.contains(origin), grantedScopes.isEmpty else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "Fillout requires a provider-returned official global/EU base_url and no invented OAuth scopes."
      )
    }
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let oldRefs = existing.map(Self.secretReferenceIds(in:)) ?? []
    let ref = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Fillout OAuth access token",
      secretValue: token)
    let railway = ProcessInfo.processInfo.environment["CLAWCHAT_RAILWAY_ORIGIN"]?
      .providerConnectionNilIfEmpty?
      .trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    let callback = railway.map { $0 + "/api/v1/oauth/fillout/callback" }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let label = authorizationLabel?.providerConnectionNilIfEmpty.map { String($0.prefix(200)) }
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "fillout_oauth_access_token", label: "Fillout OAuth access token", required: true,
        userOwnedRequired: false, secretReferenceId: ref.id, status: .verified,
        helpText: "Provider-returned access token stored as one Keychain reference.",
        redactionStatus: "secret-reference-only")
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "fillout-relay-owned-oauth-grant", providerName: "Fillout", status: .connected,
      authorizationState: .completed, credentialOwnership: .relayOwned,
      userOwnedCredentialsRequired: false, credentialRequirements: requirements,
      secretReferenceIds: [ref.id], accountLabel: label ?? "Fillout OAuth grant",
      connectedHandle: origin.contains("eu-api") ? "EU" : "Global", callbackURL: callback,
      requiredScopes: [], grantedScopes: [], selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message:
          "Fillout OAuth reference is ready for the provider-returned official API base URL.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("fillout"), "relayOwnedFilloutOAuth": .bool(true),
          "baseURL": .string(origin), "oauthScopesDocumented": .bool(false),
          "accessTokenExpiryDocumented": .bool(false), "refreshTokenDocumented": .bool(false),
          "identityEndpointDocumented": .bool(false),
          "broadAuthorizationConfinedLocally": .bool(true),
          "tokenInvalidationDocumented": .bool(true),
          "reauthorizationRequiredAfterInvalidation": .bool(true),
          "submissionContentReturned": .bool(false), "automaticPaginationAllowed": .bool(false),
          "rateLimitRequestsPerSecond": .number(5), "selfHostedOriginsAllowed": .bool(false),
          "callbackTransport": .string("railway-https-only"),
          "rawTokenStoredInDatabase": .bool(false),
        ], redactionStatus: "submission-content-excluded"), senderIdentities: [],
      installPolicy: "approval_gated_fillout_metadata_reads", lastCheckedAt: timestamp,
      lastError: nil,
      manualEvidenceNote: callback == nil
        ? "Production Fillout requires CLAWCHAT_RAILWAY_ORIGIN, deployed OAuth exchange/base_url validation/invalidate/disconnect broker and live acceptance."
        : nil, reauthorizeRequired: false, disconnecting: false, betaBlocked: false,
      createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp,
      redactionStatus: "submission-content-excluded")
    do {
      let saved = try saveConnection(context: context, connection: connection)
      for old in oldRefs where !saved.secretReferenceIds.contains(old) {
        _ = try? secrets.delete(old)
      }
      return saved
    } catch {
      _ = try? secrets.delete(ref.id)
      throw error
    }
  }
  @discardableResult public func saveMailchimpRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, dataCenter: String,
    accountId: String, accountName: String, role: String, memberSince: String?,
    grantedScopes: [String] = ProviderConnectionService.mailchimpOAuthPermissions,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "mailchimp")
    guard app.slug == "mailchimp" else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Mailchimp OAuth can only be saved for Mailchimp.")
    }
    try validateAppCanAuthorize(app, context: context)
    let token = try requireNonEmptyString(
      accessToken, field: "Mailchimp OAuth access token", maxLength: 30000)
    let dc = dataCenter.lowercased()
    let account = try requireNonEmptyString(accountId, field: "Mailchimp account ID", maxLength: 64)
    let name = try requireNonEmptyString(
      accountName, field: "Mailchimp account name", maxLength: 200)
    let userRole = try requireNonEmptyString(
      role, field: "Mailchimp authorizing role", maxLength: 64)
    guard Self.isSafeMailchimpDataCenter(dc), Self.isSafeMailchimpIdentifier(account),
      userRole.allSatisfy({ $0.isLetter || $0.isNumber || $0 == "_" || $0 == "-" || $0 == " " }),
      grantedScopes.isEmpty
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "Mailchimp requires exact OAuth metadata data-center/API-root account and no invented OAuth scopes."
      )
    }
    let origin = "https://" + dc + ".api.mailchimp.com"
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let oldRefs = existing.map(Self.secretReferenceIds(in:)) ?? []
    let ref = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Mailchimp OAuth access token",
      secretValue: token)
    let railway = ProcessInfo.processInfo.environment["CLAWCHAT_RAILWAY_ORIGIN"]?
      .providerConnectionNilIfEmpty?
      .trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    let callback = railway.map { $0 + "/api/v1/oauth/mailchimp/callback" }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "mailchimp_oauth_access_token", label: "Mailchimp OAuth access token",
        required: true, userOwnedRequired: false, secretReferenceId: ref.id, status: .verified,
        helpText: "Non-expiring-until-revoked access token stored as one Keychain reference.",
        redactionStatus: "secret-reference-only")
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "mailchimp-relay-owned-oauth:" + account, providerName: "Mailchimp",
      status: .connected, authorizationState: .completed, credentialOwnership: .relayOwned,
      userOwnedCredentialsRequired: false, credentialRequirements: requirements,
      secretReferenceIds: [ref.id], accountLabel: name,
      connectedHandle: dc + ":" + String(account.suffix(8)), callbackURL: callback,
      requiredScopes: [], grantedScopes: [], selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message:
          "Mailchimp OAuth reference is ready for the exact account, role and metadata data-center.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("mailchimp"), "relayOwnedMailchimpOAuth": .bool(true),
          "dataCenter": .string(dc), "apiOrigin": .string(origin), "accountId": .string(account),
          "accountName": .string(name), "authorizingRole": .string(userRole),
          "memberSince": memberSince?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
          "oauthScopesDocumented": .bool(false), "accessTokenExpires": .bool(false),
          "refreshTokenRequired": .bool(false), "revocationRequiresReauthorization": .bool(true),
          "mutableUserRoleAuthority": .bool(true), "contactDataReturned": .bool(false),
          "campaignContentReturned": .bool(false), "automaticPaginationAllowed": .bool(false),
          "simultaneousConnectionLimitPerUser": .number(10),
          "callbackTransport": .string("railway-https-only"),
          "rawTokenStoredInDatabase": .bool(false),
        ], redactionStatus: "contact-and-content-excluded"), senderIdentities: [],
      installPolicy: "approval_gated_mailchimp_metadata_reads", lastCheckedAt: timestamp,
      lastError: nil,
      manualEvidenceNote: callback == nil
        ? "Production Mailchimp requires CLAWCHAT_RAILWAY_ORIGIN, deployed OAuth exchange/metadata/root binding/revocation/disconnect broker and live acceptance."
        : nil, reauthorizeRequired: false, disconnecting: false, betaBlocked: false,
      createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp,
      redactionStatus: "contact-and-content-excluded")
    do {
      let saved = try saveConnection(context: context, connection: connection)
      for old in oldRefs where !saved.secretReferenceIds.contains(old) {
        _ = try? secrets.delete(old)
      }
      return saved
    } catch {
      _ = try? secrets.delete(ref.id)
      throw error
    }
  }

  @discardableResult public func saveSendFoxRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String,
    accountId: String, accountLabel: String?,
    grantedScopes: [String] = ProviderConnectionService.sendFoxOAuthPermissions,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "sendfox")
    guard app.slug == "sendfox" else {
      throw ServiceGuard.invalidInput(
        context: context, message: "SendFox OAuth can only be saved for SendFox.")
    }
    try validateAppCanAuthorize(app, context: context)
    let token = try requireNonEmptyString(
      accessToken, field: "SendFox OAuth access token", maxLength: 30000)
    let account = try requireNonEmptyString(accountId, field: "SendFox account ID", maxLength: 19)
    guard account.first != "0", account.allSatisfy({ $0.isNumber }), grantedScopes.isEmpty else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "SendFox requires an exact positive-decimal account and no invented OAuth scopes.")
    }
    let label =
      accountLabel?.providerConnectionNilIfEmpty ?? "SendFox account …" + String(account.suffix(8))
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let oldRefs = existing.map(Self.secretReferenceIds(in:)) ?? []
    let ref = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "SendFox OAuth access token",
      secretValue: token)
    let railway = ProcessInfo.processInfo.environment["CLAWCHAT_RAILWAY_ORIGIN"]?
      .providerConnectionNilIfEmpty?
      .trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    let callback = railway.map { $0 + "/api/v1/marketplace/oauth/sendfox/callback" }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "sendfox_oauth_access_token", label: "SendFox OAuth access token", required: true,
        userOwnedRequired: false, secretReferenceId: ref.id, status: .verified,
        helpText: "Provider-managed OAuth access token stored as one Keychain reference.",
        redactionStatus: "secret-reference-only")
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "sendfox-relay-owned-oauth:" + account, providerName: "SendFox",
      status: .connected,
      authorizationState: .completed, credentialOwnership: .relayOwned,
      userOwnedCredentialsRequired: false,
      credentialRequirements: requirements, secretReferenceIds: [ref.id], accountLabel: label,
      connectedHandle: "sendfox:" + String(account.suffix(8)), callbackURL: callback,
      requiredScopes: [], grantedScopes: [],
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready, message: "SendFox OAuth reference is ready for the exact paid account.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("sendfox"), "relayOwnedSendFoxOAuth": .bool(true),
          "accountId": .string(account), "apiOrigin": .string("https://api.sendfox.com"),
          "oauthScopesDocumented": .bool(false), "refreshTokenDocumented": .bool(false),
          "paidProviderPlanRequired": .bool(true), "contactDataReturned": .bool(false),
          "campaignContentReturned": .bool(false), "automaticPaginationAllowed": .bool(false),
          "rateLimitRequestsPerMinute": .number(60),
          "callbackTransport": .string("railway-https-only"),
          "rawTokenStoredInDatabase": .bool(false),
        ], redactionStatus: "contact-and-content-excluded"), senderIdentities: [],
      installPolicy: "approval_gated_sendfox_metadata_reads", lastCheckedAt: timestamp,
      lastError: nil,
      manualEvidenceNote: callback == nil
        ? "Production SendFox requires CLAWCHAT_RAILWAY_ORIGIN, deployed OAuth exchange/exact-account broker, a paid provider plan, and live acceptance."
        : nil,
      reauthorizeRequired: false, disconnecting: false, betaBlocked: false,
      createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp,
      redactionStatus: "contact-and-content-excluded")
    do {
      let saved = try saveConnection(context: context, connection: connection)
      for old in oldRefs where !saved.secretReferenceIds.contains(old) {
        _ = try? secrets.delete(old)
      }
      return saved
    } catch {
      _ = try? secrets.delete(ref.id)
      throw error
    }
  }

  @discardableResult public func saveBeehiivRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    organizationId: String, accountLabel: String?, accessExpiresAt: String?,
    grantedScopes: [String] = ProviderConnectionService.beehiivRelayOwnedOAuthScopes,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "beehiiv")
    guard app.slug == "beehiiv" else {
      throw ServiceGuard.invalidInput(
        context: context, message: "beehiiv OAuth can only be saved for beehiiv.")
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "beehiiv OAuth access token", maxLength: 30000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "beehiiv OAuth refresh token", maxLength: 30000)
    let organization = try requireNonEmptyString(
      organizationId, field: "beehiiv organization ID", maxLength: 68)
    guard organization.range(of: #"^org_[0-9a-fA-F-]{1,64}$"#, options: .regularExpression) != nil,
      grantedScopes == Self.beehiivRelayOwnedOAuthScopes
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "beehiiv requires an exact org_ identifier and only identify:read publications:read posts:read."
      )
    }
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let oldRefs = existing.map(Self.secretReferenceIds(in:)) ?? []
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "beehiiv OAuth access token",
      secretValue: access)
    let refreshRef: SecretReference
    do {
      refreshRef = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "beehiiv OAuth refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    let railway = ProcessInfo.processInfo.environment["CLAWCHAT_RAILWAY_ORIGIN"]?
      .providerConnectionNilIfEmpty?
      .trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    let callback = railway.map { $0 + "/api/v1/marketplace/oauth/beehiiv/callback" }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let label =
      accountLabel?.providerConnectionNilIfEmpty ?? "beehiiv organization …"
      + String(organization.suffix(8))
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "beehiiv_oauth_access_token", label: "beehiiv OAuth access token", required: true,
        userOwnedRequired: false, secretReferenceId: accessRef.id, status: .verified,
        helpText: "Provider-expiring access token stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "beehiiv_oauth_refresh_token", label: "beehiiv OAuth refresh token",
        required: true, userOwnedRequired: false, secretReferenceId: refreshRef.id,
        status: .verified,
        helpText: "Provider refresh token stored separately and revoked upstream on disconnect.",
        redactionStatus: "secret-reference-only"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "beehiiv-relay-owned-oauth:" + organization, providerName: "beehiiv",
      status: .connected, authorizationState: .completed, credentialOwnership: .relayOwned,
      userOwnedCredentialsRequired: false, credentialRequirements: requirements,
      secretReferenceIds: [accessRef.id, refreshRef.id], accountLabel: label,
      connectedHandle: "beehiiv:" + String(organization.suffix(8)), callbackURL: callback,
      requiredScopes: Self.beehiivRelayOwnedOAuthScopes, grantedScopes: grantedScopes,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready, message: "beehiiv OAuth references are ready for the exact organization.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("beehiiv"), "relayOwnedBeehiivOAuth": .bool(true),
          "organizationId": .string(organization), "apiOrigin": .string("https://api.beehiiv.com"),
          "oauthOrigin": .string("https://app.beehiiv.com"),
          "accessExpiresAt": accessExpiresAt.map(JSONValue.string) ?? .null,
          "refreshTokenDocumented": .bool(true), "upstreamRevocationDocumented": .bool(true),
          "subscriberDataReturned": .bool(false), "publicationContentReturned": .bool(false),
          "automaticPaginationAllowed": .bool(false), "rateLimitRequestsPerMinute": .number(180),
          "callbackTransport": .string("railway-https-only"),
          "rawTokenStoredInDatabase": .bool(false),
        ], redactionStatus: "subscriber-and-content-excluded"), senderIdentities: [],
      installPolicy: "approval_gated_beehiiv_metadata_reads", lastCheckedAt: timestamp,
      lastError: nil,
      manualEvidenceNote: callback == nil
        ? "Production beehiiv requires CLAWCHAT_RAILWAY_ORIGIN, Support-registered OAuth client, deployed exchange/refresh/revocation broker, and live acceptance."
        : nil, reauthorizeRequired: false, disconnecting: false, betaBlocked: false,
      createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp,
      redactionStatus: "subscriber-and-content-excluded")
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

  @discardableResult public func saveSubstackCustomerTokenConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, apiToken: String,
    validationLinkedInHandle: String, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "substack")
    guard app.slug == "substack" else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Substack Developer API tokens can only be saved for Substack.")
    }
    try validateAppCanAuthorize(app, context: context)
    let token = try requireNonEmptyString(
      apiToken, field: "Substack Developer API token", maxLength: 30000)
    let handle = try requireNonEmptyString(
      validationLinkedInHandle, field: "Substack validation LinkedIn handle", maxLength: 100)
    guard
      handle.range(
        of: #"^[A-Za-z0-9](?:[A-Za-z0-9-]{0,98}[A-Za-z0-9])?$"#, options: .regularExpression) != nil
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "Substack requires one exact LinkedIn handle without a URL or path.")
    }
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let oldRefs = existing.map(Self.secretReferenceIds(in:)) ?? []
    let ref = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Substack Developer API token",
      secretValue: token)
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "substack_api_token", label: "Substack Developer API token", required: true,
        userOwnedRequired: true, secretReferenceId: ref.id, status: .verified,
        helpText: "Customer-owned, access-approved token stored only as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "substack_validation_linkedin_handle", label: "Validation LinkedIn handle",
        required: true, userOwnedRequired: true, secretReferenceId: nil, status: .verified,
        helpText: "Exact public LinkedIn handle used for a bounded connection check.",
        redactionStatus: "public-profile-only"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "substack-customer-developer-api-token", providerName: "Substack",
      status: .connected, authorizationState: .completed, credentialOwnership: .userOwned,
      userOwnedCredentialsRequired: true, credentialRequirements: requirements,
      secretReferenceIds: [ref.id], accountLabel: "Substack public-profile API",
      connectedHandle: handle, callbackURL: nil, requiredScopes: [], grantedScopes: [],
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .degraded,
        message:
          "Substack token reference is stored, but the public guide omits token transport; provider acceptance must confirm provisional Bearer authentication.",
        lastCheckedAt: nil, missingScopes: [],
        unavailableTools: ["substack_profile_search_linkedin"],
        diagnostics: [
          "provider": .string("substack"), "customerOwnedDeveloperAPIToken": .bool(true),
          "validationLinkedInHandle": .string(handle), "apiOrigin": .string("https://substack.com"),
          "documentedEndpointCount": .number(1), "tokenTransportDocumented": .bool(false),
          "provisionalBearerTransport": .bool(true), "publicProfilesOnly": .bool(true),
          "maxResults": .number(10), "maxResponseBytes": .number(1_000_000),
          "conservativeRequestsPerSecond": .number(1), "redirectsAllowed": .bool(false),
          "writesEnabled": .bool(false), "scrapingEnabled": .bool(false),
          "rawTokenStoredInDatabase": .bool(false),
        ], redactionStatus: "public-profile-only"), senderIdentities: [],
      installPolicy: "single_public_profile_lookup_after_provider_acceptance", lastCheckedAt: nil,
      lastError: nil,
      manualEvidenceNote:
        "Production remains blocked until Substack approves Developer API access and confirms the token transport omitted by its public guide through separate provider-console acceptance.",
      reauthorizeRequired: false, disconnecting: false, betaBlocked: true,
      createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp,
      redactionStatus: "public-profile-only")
    do {
      let saved = try saveConnection(context: context, connection: connection)
      for old in oldRefs where !saved.secretReferenceIds.contains(old) {
        _ = try? secrets.delete(old)
      }
      return saved
    } catch {
      _ = try? secrets.delete(ref.id)
      throw error
    }
  }

  @discardableResult public func saveHootsuiteRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    memberId: String, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "hootsuite")
    guard app.slug == "hootsuite" else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Hootsuite OAuth can only be saved for Hootsuite.")
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "Hootsuite OAuth access token", maxLength: 30000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "Hootsuite OAuth refresh token", maxLength: 30000)
    let member = try requireNonEmptyString(memberId, field: "Hootsuite member ID", maxLength: 32)
    guard member.range(of: #"^[1-9][0-9]{0,31}$"#, options: .regularExpression) != nil else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Hootsuite requires an exact positive-decimal member ID.")
    }
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let old = existing.map(Self.secretReferenceIds(in:)) ?? []
    let a = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Hootsuite OAuth access token",
      secretValue: access)
    let r: SecretReference
    do {
      r = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Hootsuite OAuth refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(a.id)
      throw error
    }
    let railway = ProcessInfo.processInfo.environment["CLAWCHAT_RAILWAY_ORIGIN"]?
      .providerConnectionNilIfEmpty?
      .trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    let callback = railway.map { $0 + "/api/v1/marketplace/oauth/hootsuite/callback" }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "hootsuite_oauth_access_token", label: "Hootsuite OAuth access token",
        required: true, userOwnedRequired: false, secretReferenceId: a.id, status: .verified,
        helpText: "Provider-expiring access token stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "hootsuite_oauth_refresh_token", label: "Hootsuite OAuth refresh token",
        required: true, userOwnedRequired: false, secretReferenceId: r.id, status: .verified,
        helpText: "Offline refresh token stored separately.",
        redactionStatus: "secret-reference-only"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "hootsuite-relay-owned-oauth:" + member, providerName: "Hootsuite",
      status: .connected, authorizationState: .completed, credentialOwnership: .relayOwned,
      userOwnedCredentialsRequired: false, credentialRequirements: requirements,
      secretReferenceIds: [a.id, r.id],
      accountLabel: "Hootsuite member …" + String(member.suffix(8)),
      connectedHandle: "hootsuite:" + String(member.suffix(8)), callbackURL: callback,
      requiredScopes: ["offline"], grantedScopes: ["offline"],
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready, message: "Hootsuite OAuth references are ready for the exact member.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("hootsuite"), "memberId": .string(member),
          "apiOrigin": .string("https://platform.hootsuite.com"), "identityReturned": .bool(false),
          "contentReturned": .bool(false), "writesEnabled": .bool(false),
          "maxProfileIds": .number(25), "rawTokenStoredInDatabase": .bool(false),
        ], redactionStatus: "identity-and-content-excluded"), senderIdentities: [],
      installPolicy: "approval_gated_hootsuite_metadata_reads", lastCheckedAt: timestamp,
      lastError: nil,
      manualEvidenceNote: callback == nil
        ? "Production Hootsuite requires CLAWCHAT_RAILWAY_ORIGIN, Developer App credentials and live OAuth acceptance."
        : nil, reauthorizeRequired: false, disconnecting: false, betaBlocked: false,
      createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp,
      redactionStatus: "identity-and-content-excluded")
    do {
      let saved = try saveConnection(context: context, connection: connection)
      for ref in old where !saved.secretReferenceIds.contains(ref) { _ = try? secrets.delete(ref) }
      return saved
    } catch {
      _ = try? secrets.delete(a.id)
      _ = try? secrets.delete(r.id)
      throw error
    }
  }

  @discardableResult public func saveBufferRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    accountId: String, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "buffer")
    guard app.slug == "buffer" else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Buffer OAuth can only be saved for Buffer.")
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "Buffer OAuth access token", maxLength: 30000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "Buffer OAuth refresh token", maxLength: 30000)
    let account = try requireNonEmptyString(accountId, field: "Buffer account ID", maxLength: 100)
    guard account.range(of: #"^[A-Za-z0-9_-]{1,100}$"#, options: .regularExpression) != nil else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Buffer requires an exact account ID.")
    }
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let old = existing.map(Self.secretReferenceIds(in:)) ?? []
    let a = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Buffer OAuth access token",
      secretValue: access)
    let r: SecretReference
    do {
      r = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Buffer rotating OAuth refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(a.id)
      throw error
    }
    let railway = ProcessInfo.processInfo.environment["CLAWCHAT_RAILWAY_ORIGIN"]?
      .providerConnectionNilIfEmpty?
      .trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    let callback = railway.map { $0 + "/api/v1/marketplace/oauth/buffer/callback" }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "buffer_oauth_access_token", label: "Buffer OAuth access token", required: true,
        userOwnedRequired: false, secretReferenceId: a.id, status: .verified,
        helpText: "One-hour provider access token stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "buffer_oauth_refresh_token", label: "Buffer rotating OAuth refresh token",
        required: true, userOwnedRequired: false, secretReferenceId: r.id, status: .verified,
        helpText:
          "Single-use rotating refresh token stored separately; every replacement must be saved atomically.",
        redactionStatus: "secret-reference-only"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "buffer-relay-owned-oauth:" + account, providerName: "Buffer",
      status: .connected, authorizationState: .completed, credentialOwnership: .relayOwned,
      userOwnedCredentialsRequired: false, credentialRequirements: requirements,
      secretReferenceIds: [a.id, r.id],
      accountLabel: "Buffer account …" + String(account.suffix(8)),
      connectedHandle: "buffer:" + String(account.suffix(8)), callbackURL: callback,
      requiredScopes: ["account:read", "offline_access"],
      grantedScopes: ["account:read", "offline_access"], selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready, message: "Buffer OAuth references are ready for the exact account.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("buffer"), "accountId": .string(account),
          "apiOrigin": .string("https://api.buffer.com"), "pkceS256Required": .bool(true),
          "singleUseRotatingRefresh": .bool(true), "identityReturned": .bool(false),
          "contentReturned": .bool(false), "writesEnabled": .bool(false),
          "maxResources": .number(25), "rawTokenStoredInDatabase": .bool(false),
        ], redactionStatus: "identity-and-content-excluded"), senderIdentities: [],
      installPolicy: "approval_gated_buffer_structure_reads", lastCheckedAt: timestamp,
      lastError: nil,
      manualEvidenceNote: callback == nil
        ? "Production Buffer requires CLAWCHAT_RAILWAY_ORIGIN, OAuth client credentials, S256 PKCE and live OAuth acceptance."
        : nil, reauthorizeRequired: false, disconnecting: false, betaBlocked: false,
      createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp,
      redactionStatus: "identity-and-content-excluded")
    do {
      let saved = try saveConnection(context: context, connection: connection)
      for ref in old where !saved.secretReferenceIds.contains(ref) { _ = try? secrets.delete(ref) }
      return saved
    } catch {
      _ = try? secrets.delete(a.id)
      _ = try? secrets.delete(r.id)
      throw error
    }
  }

  @discardableResult public func saveSproutSocialCustomerOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, clientId: String, clientSecret: String,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "sprout-social")
    guard app.slug == "sprout-social" else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "Sprout Social client credentials can only be saved for Sprout Social.")
    }
    try validateAppCanAuthorize(app, context: context)
    let client = try requireNonEmptyString(
      clientId, field: "Sprout Social OAuth client ID", maxLength: 500)
    let secret = try requireNonEmptyString(
      clientSecret, field: "Sprout Social OAuth client secret", maxLength: 30000)
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let old = existing.map(Self.secretReferenceIds(in:)) ?? []
    let c = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Sprout Social OAuth client ID",
      secretValue: client)
    let s: SecretReference
    do {
      s = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Sprout Social OAuth client secret",
        secretValue: secret)
    } catch {
      _ = try? secrets.delete(c.id)
      throw error
    }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "sprout_social_client_id", label: "Sprout Social OAuth client ID", required: true,
        userOwnedRequired: true, secretReferenceId: c.id, status: .verified,
        helpText: "Customer-owned machine-to-machine client ID stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "sprout_social_client_secret", label: "Sprout Social OAuth client secret",
        required: true, userOwnedRequired: true, secretReferenceId: s.id, status: .verified,
        helpText: "Customer-owned machine-to-machine secret stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "sprout-social-customer-owned-m2m", providerName: "Sprout Social",
      status: .connected, authorizationState: .completed, credentialOwnership: .userOwned,
      userOwnedCredentialsRequired: true, credentialRequirements: requirements,
      secretReferenceIds: [c.id, s.id], accountLabel: "Sprout Social API organization",
      connectedHandle: "sprout-social:m2m", callbackURL: nil, requiredScopes: ["organization_id"],
      grantedScopes: ["organization_id"], selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message:
          "Sprout Social customer-owned M2M credential references are ready for bounded structure reads.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("sprout-social"),
          "authMethod": .string("customer_owned_oauth_client_credentials"),
          "scope": .string("organization_id"), "apiOrigin": .string("https://api.sproutsocial.com"),
          "tokenUrl": .string(
            "https://identity.sproutsocial.com/oauth2/84e39c75-d770-45d9-90a9-7b79e3037d2c/v1/token"
          ), "accessTokenPersistence": .string("none"), "identityReturned": .bool(false),
          "contentReturned": .bool(false), "writesEnabled": .bool(false),
          "maxResources": .number(25), "requestsPerMinute": .number(60),
          "requestsPerMonth": .number(250000), "rawCredentialStoredInDatabase": .bool(false),
        ], redactionStatus: "identity-and-content-excluded"), senderIdentities: [],
      installPolicy: "approval_gated_sprout_social_structure_reads", lastCheckedAt: timestamp,
      lastError: nil,
      manualEvidenceNote:
        "Sprout API access requires an eligible plan, API Permissions, accepted API terms, and customer-owned machine-to-machine credentials.",
      reauthorizeRequired: false, disconnecting: false, betaBlocked: false,
      createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp,
      redactionStatus: "identity-and-content-excluded")
    do {
      let saved = try saveConnection(context: context, connection: connection)
      for ref in old where !saved.secretReferenceIds.contains(ref) { _ = try? secrets.delete(ref) }
      return saved
    } catch {
      _ = try? secrets.delete(c.id)
      _ = try? secrets.delete(s.id)
      throw error
    }
  }

  @discardableResult public func saveAgorapulseCustomerAPIConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, apiKey: String, organizationId: String,
    workspaceId: String, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "agorapulse")
    guard app.slug == "agorapulse" else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Agorapulse credentials can only be saved for Agorapulse.")
    }
    try validateAppCanAuthorize(app, context: context)
    let key = try requireNonEmptyString(apiKey, field: "Agorapulse API key", maxLength: 30000)
    let organization = try requireNonEmptyString(
      organizationId, field: "Agorapulse organization ID", maxLength: 128)
    let workspace = try requireNonEmptyString(
      workspaceId, field: "Agorapulse workspace ID", maxLength: 128)
    guard organization.range(of: #"^[A-Za-z0-9_-]{1,128}$"#, options: .regularExpression) != nil,
      workspace.range(of: #"^[A-Za-z0-9_-]{1,128}$"#, options: .regularExpression) != nil
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Agorapulse requires exact safe organization and workspace IDs.")
    }
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let old = existing.map(Self.secretReferenceIds(in:)) ?? []
    let k = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Agorapulse API key", secretValue: key)
    let o: SecretReference
    do {
      o = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Agorapulse organization ID",
        secretValue: organization)
    } catch {
      _ = try? secrets.delete(k.id)
      throw error
    }
    let w: SecretReference
    do {
      w = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Agorapulse workspace ID",
        secretValue: workspace)
    } catch {
      _ = try? secrets.delete(k.id)
      _ = try? secrets.delete(o.id)
      throw error
    }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "agorapulse_api_key", label: "Agorapulse API key", required: true,
        userOwnedRequired: true, secretReferenceId: k.id, status: .verified,
        helpText: "Customer-generated bearer API key stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "agorapulse_organization_id", label: "Agorapulse organization ID", required: true,
        userOwnedRequired: true, secretReferenceId: o.id, status: .verified,
        helpText: "Exact organization binding stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "agorapulse_workspace_id", label: "Agorapulse workspace ID", required: true,
        userOwnedRequired: true, secretReferenceId: w.id, status: .verified,
        helpText: "Exact workspace binding stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "agorapulse-open-api:" + organization + ":" + workspace,
      providerName: "Agorapulse", status: .connected, authorizationState: .completed,
      credentialOwnership: .userOwned, userOwnedCredentialsRequired: true,
      credentialRequirements: requirements, secretReferenceIds: [k.id, o.id, w.id],
      accountLabel: "Agorapulse workspace …" + String(workspace.suffix(8)),
      connectedHandle: "agorapulse:" + String(workspace.suffix(8)), callbackURL: nil,
      requiredScopes: [], grantedScopes: [], selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message: "Agorapulse customer API-key references are ready for bounded analytics reads.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("agorapulse"), "authMethod": .string("customer_owned_bearer_api_key"),
          "organizationId": .string(organization), "workspaceId": .string(workspace),
          "apiOrigin": .string("https://api.agorapulse.com"), "readOnlyV1": .bool(true),
          "identityReturned": .bool(false), "contentReturned": .bool(false),
          "writesEnabled": .bool(false), "maxResources": .number(25), "maxWindowDays": .number(31),
          "requestsPerThirtyMinutes": .number(500), "rawCredentialStoredInDatabase": .bool(false),
        ], redactionStatus: "identity-and-content-excluded"), senderIdentities: [],
      installPolicy: "approval_gated_agorapulse_analytics_reads", lastCheckedAt: timestamp,
      lastError: nil,
      manualEvidenceNote:
        "Agorapulse Open API access requires a Custom plan, customer-generated API key, exact organization/workspace selection, and live acceptance.",
      reauthorizeRequired: false, disconnecting: false, betaBlocked: false,
      createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp,
      redactionStatus: "identity-and-content-excluded")
    do {
      let saved = try saveConnection(context: context, connection: connection)
      for ref in old where !saved.secretReferenceIds.contains(ref) { _ = try? secrets.delete(ref) }
      return saved
    } catch {
      _ = try? secrets.delete(k.id)
      _ = try? secrets.delete(o.id)
      _ = try? secrets.delete(w.id)
      throw error
    }
  }

  @discardableResult public func saveMetricoolCustomerAPIConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, userToken: String, userId: String,
    blogId: String, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "metricool")
    guard app.slug == "metricool" else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Metricool credentials can only be saved for Metricool.")
    }
    try validateAppCanAuthorize(app, context: context)
    let token = try requireNonEmptyString(
      userToken, field: "Metricool user token", maxLength: 30000)
    let user = try requireNonEmptyString(userId, field: "Metricool user ID", maxLength: 20)
    let blog = try requireNonEmptyString(blogId, field: "Metricool brand ID", maxLength: 20)
    guard user.range(of: #"^[0-9]{1,20}$"#, options: .regularExpression) != nil,
      blog.range(of: #"^[0-9]{1,20}$"#, options: .regularExpression) != nil
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Metricool requires exact numeric user and brand IDs.")
    }
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let old = existing.map(Self.secretReferenceIds(in:)) ?? []
    let t = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Metricool user token", secretValue: token)
    let u: SecretReference
    do {
      u = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Metricool user ID", secretValue: user)
    } catch {
      _ = try? secrets.delete(t.id)
      throw error
    }
    let b: SecretReference
    do {
      b = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Metricool brand ID", secretValue: blog)
    } catch {
      _ = try? secrets.delete(t.id)
      _ = try? secrets.delete(u.id)
      throw error
    }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "metricool_user_token", label: "Metricool user token", required: true,
        userOwnedRequired: true, secretReferenceId: t.id, status: .verified,
        helpText: "Customer API token stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "metricool_user_id", label: "Metricool user ID", required: true,
        userOwnedRequired: true, secretReferenceId: u.id, status: .verified,
        helpText: "Exact numeric user binding stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "metricool_blog_id", label: "Metricool brand ID", required: true,
        userOwnedRequired: true, secretReferenceId: b.id, status: .verified,
        helpText: "Exact numeric brand binding stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "metricool-api:" + user + ":" + blog, providerName: "Metricool",
      status: .connected, authorizationState: .completed, credentialOwnership: .userOwned,
      userOwnedCredentialsRequired: true, credentialRequirements: requirements,
      secretReferenceIds: [t.id, u.id, b.id],
      accountLabel: "Metricool brand …" + String(blog.suffix(8)),
      connectedHandle: "metricool:" + String(blog.suffix(8)), callbackURL: nil, requiredScopes: [],
      grantedScopes: [], selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message:
          "Metricool customer API-token references are ready for bounded brand-structure reads.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("metricool"), "authMethod": .string("customer_owned_api_token"),
          "userId": .string(user), "blogId": .string(blog),
          "apiOrigin": .string("https://app.metricool.com/api"), "readOnlyV1": .bool(true),
          "identityReturned": .bool(false), "contentReturned": .bool(false),
          "writesEnabled": .bool(false), "maxResources": .number(25),
          "responseCapBytes": .number(1_000_000), "localRequestsPerMinute": .number(60),
          "rawCredentialStoredInDatabase": .bool(false),
        ], redactionStatus: "identity-and-content-excluded"), senderIdentities: [],
      installPolicy: "approval_gated_metricool_brand_structure_reads", lastCheckedAt: timestamp,
      lastError: nil,
      manualEvidenceNote:
        "Metricool API access requires an Advanced or Custom plan, customer token, exact user/brand selection, and live acceptance.",
      reauthorizeRequired: false, disconnecting: false, betaBlocked: false,
      createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp,
      redactionStatus: "identity-and-content-excluded")
    do {
      let saved = try saveConnection(context: context, connection: connection)
      for ref in old where !saved.secretReferenceIds.contains(ref) { _ = try? secrets.delete(ref) }
      return saved
    } catch {
      _ = try? secrets.delete(t.id)
      _ = try? secrets.delete(u.id)
      _ = try? secrets.delete(b.id)
      throw error
    }
  }

  @discardableResult public func savePublerCustomerAPIConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, apiKey: String, workspaceId: String,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "publer")
    guard app.slug == "publer" else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Publer credentials can only be saved for Publer.")
    }
    try validateAppCanAuthorize(app, context: context)
    let key = try requireNonEmptyString(apiKey, field: "Publer API key", maxLength: 30000)
    let workspace = try requireNonEmptyString(
      workspaceId, field: "Publer workspace ID", maxLength: 128)
    guard workspace.range(of: #"^[A-Za-z0-9_-]{1,128}$"#, options: .regularExpression) != nil else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Publer requires one exact safe workspace ID.")
    }
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let old = existing.map(Self.secretReferenceIds(in:)) ?? []
    let k = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Publer API key", secretValue: key)
    let w: SecretReference
    do {
      w = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Publer workspace ID",
        secretValue: workspace)
    } catch {
      _ = try? secrets.delete(k.id)
      throw error
    }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "publer_api_key", label: "Publer API key", required: true,
        userOwnedRequired: true, secretReferenceId: k.id, status: .verified,
        helpText: "Customer-created workspaces/accounts scoped key stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "publer_workspace_id", label: "Publer workspace ID", required: true,
        userOwnedRequired: true, secretReferenceId: w.id, status: .verified,
        helpText: "Exact workspace binding stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "publer-api:" + workspace, providerName: "Publer", status: .connected,
      authorizationState: .completed, credentialOwnership: .userOwned,
      userOwnedCredentialsRequired: true, credentialRequirements: requirements,
      secretReferenceIds: [k.id, w.id],
      accountLabel: "Publer workspace …" + String(workspace.suffix(8)),
      connectedHandle: "publer:" + String(workspace.suffix(8)), callbackURL: nil,
      requiredScopes: ["workspaces", "accounts"], grantedScopes: ["workspaces", "accounts"],
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message:
          "Publer customer API-key references are ready for bounded workspace/account reads.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("publer"), "authMethod": .string("customer_owned_scoped_api_key"),
          "workspaceId": .string(workspace), "apiOrigin": .string("https://app.publer.com/api/v1"),
          "readOnlyV1": .bool(true), "identityReturned": .bool(false),
          "contentReturned": .bool(false), "writesEnabled": .bool(false),
          "maxResources": .number(25), "responseCapBytes": .number(1_000_000),
          "requestsPerTwoMinutes": .number(100), "rawCredentialStoredInDatabase": .bool(false),
        ], redactionStatus: "identity-and-content-excluded"), senderIdentities: [],
      installPolicy: "approval_gated_publer_workspace_account_reads", lastCheckedAt: timestamp,
      lastError: nil,
      manualEvidenceNote:
        "Publer public API access requires an eligible plan, a customer-created workspaces/accounts scoped key, exact workspace selection, and live acceptance.",
      reauthorizeRequired: false, disconnecting: false, betaBlocked: false,
      createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp,
      redactionStatus: "identity-and-content-excluded")
    do {
      let saved = try saveConnection(context: context, connection: connection)
      for ref in old where !saved.secretReferenceIds.contains(ref) { _ = try? secrets.delete(ref) }
      return saved
    } catch {
      _ = try? secrets.delete(k.id)
      _ = try? secrets.delete(w.id)
      throw error
    }
  }

  @discardableResult public func saveBrandwatchCustomerAPIConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, projectId: String,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "brandwatch")
    guard app.slug == "brandwatch" else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Brandwatch credentials can only be saved for Brandwatch.")
    }
    try validateAppCanAuthorize(app, context: context)
    let token = try requireNonEmptyString(
      accessToken, field: "Brandwatch API access token", maxLength: 30000)
    let project = try requireNonEmptyString(
      projectId, field: "Brandwatch project ID", maxLength: 20)
    guard project.range(of: #"^[1-9][0-9]{0,19}$"#, options: .regularExpression) != nil else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Brandwatch requires one exact positive-decimal project ID.")
    }
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let old = existing.map(Self.secretReferenceIds(in:)) ?? []
    let t = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Brandwatch API access token",
      secretValue: token)
    let p: SecretReference
    do {
      p = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Brandwatch project ID",
        secretValue: project)
    } catch {
      _ = try? secrets.delete(t.id)
      throw error
    }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "brandwatch_access_token", label: "Brandwatch API access token", required: true,
        userOwnedRequired: true, secretReferenceId: t.id, status: .verified,
        helpText:
          "Customer-generated bearer token stored as a Keychain reference; Relay never requests the Brandwatch password.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "brandwatch_project_id", label: "Brandwatch project ID", required: true,
        userOwnedRequired: true, secretReferenceId: p.id, status: .verified,
        helpText: "Exact positive-decimal project binding stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "brandwatch-consumer-research:" + project, providerName: "Brandwatch",
      status: .connected, authorizationState: .completed, credentialOwnership: .userOwned,
      userOwnedCredentialsRequired: true, credentialRequirements: requirements,
      secretReferenceIds: [t.id, p.id],
      accountLabel: "Brandwatch project …" + String(project.suffix(8)),
      connectedHandle: "brandwatch:" + String(project.suffix(8)), callbackURL: nil,
      requiredScopes: ["read"], grantedScopes: ["read", "trust", "write"],
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message:
          "Brandwatch customer token reference is ready for bounded project/query structure reads.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("brandwatch"),
          "authMethod": .string("customer_generated_bearer_token"), "projectId": .string(project),
          "apiOrigin": .string("https://api.brandwatch.com"),
          "providerTokenScopes": .array([.string("read"), .string("trust"), .string("write")]),
          "readOnlyV1": .bool(true), "identityReturned": .bool(false),
          "contentReturned": .bool(false), "writesEnabled": .bool(false),
          "maxResources": .number(25), "responseCapBytes": .number(1_000_000),
          "requestsPerTenMinutes": .number(30), "rawCredentialStoredInDatabase": .bool(false),
          "brandwatchPasswordStored": .bool(false),
        ], redactionStatus: "identity-and-content-excluded"), senderIdentities: [],
      installPolicy: "approval_gated_brandwatch_structure_reads", lastCheckedAt: timestamp,
      lastError: nil,
      manualEvidenceNote:
        "Brandwatch Consumer Research API access requires an eligible account, Regular or Admin API-user permission, a customer-generated token, exact project selection, and live acceptance.",
      reauthorizeRequired: false, disconnecting: false, betaBlocked: false,
      createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp,
      redactionStatus: "identity-and-content-excluded")
    do {
      let saved = try saveConnection(context: context, connection: connection)
      for ref in old where !saved.secretReferenceIds.contains(ref) { _ = try? secrets.delete(ref) }
      return saved
    } catch {
      _ = try? secrets.delete(t.id)
      _ = try? secrets.delete(p.id)
      throw error
    }
  }

  @discardableResult public func saveMentionCustomerAPIConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, accountId: String,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "mention")
    guard app.slug == "mention" else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Mention credentials can only be saved for Mention.")
    }
    try validateAppCanAuthorize(app, context: context)
    let token = try requireNonEmptyString(
      accessToken, field: "Mention access token", maxLength: 30000)
    let account = try requireNonEmptyString(accountId, field: "Mention account ID", maxLength: 128)
    guard account.range(of: #"^[A-Za-z0-9_-]{1,128}$"#, options: .regularExpression) != nil else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Mention requires one exact safe account ID.")
    }
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let old = existing.map(Self.secretReferenceIds(in:)) ?? []
    let t = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Mention access token", secretValue: token)
    let a: SecretReference
    do {
      a = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Mention account ID", secretValue: account
      )
    } catch {
      _ = try? secrets.delete(t.id)
      throw error
    }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "mention_access_token", label: "Mention access token", required: true,
        userOwnedRequired: true, secretReferenceId: t.id, status: .verified,
        helpText: "Customer-created own-account app token stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "mention_account_id", label: "Mention account ID", required: true,
        userOwnedRequired: true, secretReferenceId: a.id, status: .verified,
        helpText: "Exact account binding stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "mention-api:" + account, providerName: "Mention", status: .connected,
      authorizationState: .completed, credentialOwnership: .userOwned,
      userOwnedCredentialsRequired: true, credentialRequirements: requirements,
      secretReferenceIds: [t.id, a.id],
      accountLabel: "Mention account …" + String(account.suffix(8)),
      connectedHandle: "mention:" + String(account.suffix(8)), callbackURL: nil, requiredScopes: [],
      grantedScopes: [], selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message: "Mention customer token reference is ready for bounded account/alert reads.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("mention"),
          "authMethod": .string("customer_owned_full_account_app_token"),
          "accountId": .string(account), "apiOrigin": .string("https://api.mention.net"),
          "apiVersion": .string("1.19"), "readOnlyV1": .bool(true),
          "identityReturned": .bool(false), "contentReturned": .bool(false),
          "writesEnabled": .bool(false), "maxAlerts": .number(25),
          "responseCapBytes": .number(1_000_000), "rawCredentialStoredInDatabase": .bool(false),
        ], redactionStatus: "identity-and-content-excluded"), senderIdentities: [],
      installPolicy: "approval_gated_mention_account_alert_reads", lastCheckedAt: timestamp,
      lastError: nil,
      manualEvidenceNote:
        "Mention API access requires a customer-created app token, exact account selection, and live acceptance.",
      reauthorizeRequired: false, disconnecting: false, betaBlocked: false,
      createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp,
      redactionStatus: "identity-and-content-excluded")
    do {
      let saved = try saveConnection(context: context, connection: connection)
      for ref in old where !saved.secretReferenceIds.contains(ref) { _ = try? secrets.delete(ref) }
      return saved
    } catch {
      _ = try? secrets.delete(t.id)
      _ = try? secrets.delete(a.id)
      throw error
    }
  }

  @discardableResult public func saveMeltwaterCustomerAPIConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, apiToken: String, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "meltwater")
    guard app.slug == "meltwater" else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Meltwater credentials can only be saved for Meltwater.")
    }
    try validateAppCanAuthorize(app, context: context)
    let token = try requireNonEmptyString(apiToken, field: "Meltwater API token", maxLength: 30000)
    guard !token.contains("\n"), !token.contains("\r") else {
      throw ServiceGuard.invalidInput(context: context, message: "Meltwater API token is invalid.")
    }
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let old = existing.map(Self.secretReferenceIds(in:)) ?? []
    let t = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Meltwater API token", secretValue: token)
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "meltwater_api_token", label: "Meltwater API token", required: true,
        userOwnedRequired: true, secretReferenceId: t.id, status: .verified,
        helpText:
          "Customer-generated API token stored as a Keychain reference and sent only in the apikey header.",
        redactionStatus: "secret-reference-only")
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "meltwater-api-default-company", providerName: "Meltwater", status: .connected,
      authorizationState: .completed, credentialOwnership: .userOwned,
      userOwnedCredentialsRequired: true, credentialRequirements: requirements,
      secretReferenceIds: [t.id], accountLabel: "Meltwater API package",
      connectedHandle: "meltwater:default-company", callbackURL: nil, requiredScopes: [],
      grantedScopes: [], selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message: "Meltwater customer token reference is ready for bounded usage/search reads.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("meltwater"), "authMethod": .string("customer_owned_api_token"),
          "authority": .string("token_default_company"),
          "apiOrigin": .string("https://api.meltwater.com"), "readOnlyV1": .bool(true),
          "identityReturned": .bool(false), "contentReturned": .bool(false),
          "analyticsReturned": .bool(false), "writesEnabled": .bool(false),
          "maxSearches": .number(25), "responseCapBytes": .number(1_000_000),
          "generalRequestsPerMinute": .number(100), "platformRequestsPerHourPerIP": .number(2000),
          "rawCredentialStoredInDatabase": .bool(false),
        ], redactionStatus: "identity-and-content-excluded"), senderIdentities: [],
      installPolicy: "approval_gated_meltwater_usage_search_reads", lastCheckedAt: timestamp,
      lastError: nil,
      manualEvidenceNote:
        "Meltwater API access requires an eligible package, Admin-level API permission, a customer-generated token, and live acceptance.",
      reauthorizeRequired: false, disconnecting: false, betaBlocked: false,
      createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp,
      redactionStatus: "identity-and-content-excluded")
    do {
      let saved = try saveConnection(context: context, connection: connection)
      for ref in old where !saved.secretReferenceIds.contains(ref) { _ = try? secrets.delete(ref) }
      return saved
    } catch {
      _ = try? secrets.delete(t.id)
      throw error
    }
  }

  @discardableResult public func saveSprinklrCustomerOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, apiKey: String, accessToken: String,
    environment: String, workspaceId: String, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "sprinklr")
    guard app.slug == "sprinklr" else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Sprinklr credentials can only be saved for Sprinklr.")
    }
    try validateAppCanAuthorize(app, context: context)
    let key = try requireNonEmptyString(apiKey, field: "Sprinklr API key", maxLength: 30000)
    let token = try requireNonEmptyString(
      accessToken, field: "Sprinklr access token", maxLength: 30000)
    let env = try requireNonEmptyString(environment, field: "Sprinklr environment", maxLength: 16)
      .lowercased()
    let workspace = try requireNonEmptyString(
      workspaceId, field: "Sprinklr workspace ID", maxLength: 19)
    guard
      env == "production" || env.range(of: #"^prod[0-9]{1,2}$"#, options: .regularExpression) != nil
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Sprinklr requires production or an exact prodN environment.")
    }
    guard workspace.range(of: #"^[1-9][0-9]{0,18}$"#, options: .regularExpression) != nil else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "Sprinklr requires one exact positive-decimal primary workspace ID.")
    }
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let old = existing.map(Self.secretReferenceIds(in:)) ?? []
    let k = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Sprinklr API key", secretValue: key)
    let t: SecretReference
    do {
      t = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Sprinklr OAuth access token",
        secretValue: token)
    } catch {
      _ = try? secrets.delete(k.id)
      throw error
    }
    let e: SecretReference
    do {
      e = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Sprinklr environment", secretValue: env)
    } catch {
      _ = try? secrets.delete(k.id)
      _ = try? secrets.delete(t.id)
      throw error
    }
    let w: SecretReference
    do {
      w = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Sprinklr primary workspace ID",
        secretValue: workspace)
    } catch {
      _ = try? secrets.delete(k.id)
      _ = try? secrets.delete(t.id)
      _ = try? secrets.delete(e.id)
      throw error
    }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "sprinklr_api_key", label: "Sprinklr API key", required: true,
        userOwnedRequired: true, secretReferenceId: k.id, status: .verified,
        helpText: "Customer-owned developer application key stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "sprinklr_access_token", label: "Sprinklr OAuth access token", required: true,
        userOwnedRequired: true, secretReferenceId: t.id, status: .verified,
        helpText: "Current customer-authorized bearer token stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "sprinklr_environment", label: "Sprinklr environment", required: true,
        userOwnedRequired: true, secretReferenceId: e.id, status: .verified,
        helpText: "Exact production/prodN authority binding stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "sprinklr_workspace_id", label: "Sprinklr primary workspace ID", required: true,
        userOwnedRequired: true, secretReferenceId: w.id, status: .verified,
        helpText: "Exact positive-decimal workspace binding stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "sprinklr:" + env + ":" + workspace, providerName: "Sprinklr",
      status: .connected, authorizationState: .completed, credentialOwnership: .userOwned,
      userOwnedCredentialsRequired: true, credentialRequirements: requirements,
      secretReferenceIds: [k.id, t.id, e.id, w.id],
      accountLabel: "Sprinklr " + env + " workspace …" + String(workspace.suffix(8)),
      connectedHandle: "sprinklr:" + env + ":" + String(workspace.suffix(8)), callbackURL: nil,
      requiredScopes: [], grantedScopes: [], selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message: "Sprinklr customer credentials are ready for exact governance-status validation.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("sprinklr"),
          "authMethod": .string("customer_owned_oauth_access_token"), "environment": .string(env),
          "workspaceId": .string(workspace), "apiOrigin": .string("https://api3.sprinklr.com"),
          "readOnlyV1": .bool(true), "identityReturned": .bool(false),
          "contentReturned": .bool(false), "writesEnabled": .bool(false),
          "responseCapBytes": .number(1_000_000), "rawCredentialStoredInDatabase": .bool(false),
        ], redactionStatus: "identity-and-platform-data-excluded"), senderIdentities: [],
      installPolicy: "approval_gated_sprinklr_governance_read", lastCheckedAt: timestamp,
      lastError: nil,
      manualEvidenceNote:
        "Sprinklr requires Enterprise API access, a customer developer application, Generate Token permission, environment/workspace authorization, current credentials, and live acceptance.",
      reauthorizeRequired: false, disconnecting: false, betaBlocked: false,
      createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp,
      redactionStatus: "identity-and-platform-data-excluded")
    do {
      let saved = try saveConnection(context: context, connection: connection)
      for ref in old where !saved.secretReferenceIds.contains(ref) { _ = try? secrets.delete(ref) }
      return saved
    } catch {
      _ = try? secrets.delete(k.id)
      _ = try? secrets.delete(t.id)
      _ = try? secrets.delete(e.id)
      _ = try? secrets.delete(w.id)
      throw error
    }
  }

  @discardableResult public func saveKhorosMarketingCustomerAPIConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, companyId: String,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "khoros")
    guard app.slug == "khoros" else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Khoros credentials can only be saved for Khoros.")
    }
    try validateAppCanAuthorize(app, context: context)
    let token = try requireNonEmptyString(
      accessToken, field: "Khoros Marketing access token", maxLength: 30000)
    let company = try requireNonEmptyString(
      companyId, field: "Khoros Marketing company ID", maxLength: 19)
    guard company.range(of: #"^[1-9][0-9]{0,18}$"#, options: .regularExpression) != nil else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "Khoros Marketing requires one exact positive-decimal company ID.")
    }
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let old = existing.map(Self.secretReferenceIds(in:)) ?? []
    let t = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Khoros Marketing access token",
      secretValue: token)
    let c: SecretReference
    do {
      c = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Khoros Marketing company ID",
        secretValue: company)
    } catch {
      _ = try? secrets.delete(t.id)
      throw error
    }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "khoros_marketing_access_token", label: "Khoros Marketing access token",
        required: true, userOwnedRequired: true, secretReferenceId: t.id, status: .verified,
        helpText: "Customer-generated long-lived bearer token stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "khoros_marketing_company_id", label: "Khoros Marketing company ID",
        required: true, userOwnedRequired: true, secretReferenceId: c.id, status: .verified,
        helpText: "Exact positive-decimal company binding stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "khoros-marketing:" + company, providerName: "Khoros", status: .connected,
      authorizationState: .completed, credentialOwnership: .userOwned,
      userOwnedCredentialsRequired: true, credentialRequirements: requirements,
      secretReferenceIds: [t.id, c.id],
      accountLabel: "Khoros Marketing company …" + String(company.suffix(8)),
      connectedHandle: "khoros:" + String(company.suffix(8)), callbackURL: nil, requiredScopes: [],
      grantedScopes: [], selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message: "Khoros Marketing customer token is ready for exact company-authority validation.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("khoros"), "product": .string("marketing"),
          "authMethod": .string("customer_generated_access_token"), "companyId": .string(company),
          "apiOrigin": .string("https://api.spredfast.com"), "readOnlyV1": .bool(true),
          "identityReturned": .bool(false), "contentReturned": .bool(false),
          "writesEnabled": .bool(false), "responseCapBytes": .number(1_000_000),
          "rawCredentialStoredInDatabase": .bool(false),
        ], redactionStatus: "user-and-company-identity-excluded"), senderIdentities: [],
      installPolicy: "approval_gated_khoros_marketing_authority_read", lastCheckedAt: timestamp,
      lastError: nil,
      manualEvidenceNote:
        "Khoros Marketing requires eligible access, a dedicated customer-generated API Access Token, exact company selection, and live acceptance.",
      reauthorizeRequired: false, disconnecting: false, betaBlocked: false,
      createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp,
      redactionStatus: "user-and-company-identity-excluded")
    do {
      let saved = try saveConnection(context: context, connection: connection)
      for ref in old where !saved.secretReferenceIds.contains(ref) { _ = try? secrets.delete(ref) }
      return saved
    } catch {
      _ = try? secrets.delete(t.id)
      _ = try? secrets.delete(c.id)
      throw error
    }
  }

  @discardableResult public func saveCleverTapCustomerAPIConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accountId: String, passcode: String,
    region: String, profileIdentity: String, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "clevertap")
    guard app.slug == "clevertap" else {
      throw ServiceGuard.invalidInput(
        context: context, message: "CleverTap credentials can only be saved for CleverTap.")
    }
    try validateAppCanAuthorize(app, context: context)
    let account = try requireNonEmptyString(
      accountId, field: "CleverTap Account ID", maxLength: 128)
    let code = try requireNonEmptyString(passcode, field: "CleverTap API passcode", maxLength: 2048)
    let regionCode = try requireNonEmptyString(region, field: "CleverTap region", maxLength: 4)
      .lowercased()
    let identity = try requireNonEmptyString(
      profileIdentity, field: "CleverTap profile identity", maxLength: 256)
    guard account.range(of: #"^[A-Za-z0-9_-]{3,128}$"#, options: .regularExpression) != nil,
      !code.contains("\n"), !code.contains("\r"),
      identity.rangeOfCharacter(from: .controlCharacters) == nil
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "CleverTap credential binding is invalid.")
    }
    let origins = [
      "eu1": "https://api.clevertap.com", "in1": "https://in1.api.clevertap.com",
      "sg1": "https://sg1.api.clevertap.com", "us1": "https://us1.api.clevertap.com",
      "aps3": "https://aps3.api.clevertap.com", "mec1": "https://mec1.api.clevertap.com",
    ]
    guard let origin = origins[regionCode] else {
      throw ServiceGuard.invalidInput(
        context: context, message: "CleverTap region must be eu1, in1, sg1, us1, aps3, or mec1.")
    }
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let old = existing.map(Self.secretReferenceIds(in:)) ?? []
    let a = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "CleverTap Account ID", secretValue: account
    )
    let p: SecretReference
    do {
      p = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "CleverTap API passcode",
        secretValue: code)
    } catch {
      _ = try? secrets.delete(a.id)
      throw error
    }
    let r: SecretReference
    do {
      r = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "CleverTap data-center region",
        secretValue: regionCode)
    } catch {
      _ = try? secrets.delete(a.id)
      _ = try? secrets.delete(p.id)
      throw error
    }
    let i: SecretReference
    do {
      i = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "CleverTap bound profile identity",
        secretValue: identity)
    } catch {
      _ = try? secrets.delete(a.id)
      _ = try? secrets.delete(p.id)
      _ = try? secrets.delete(r.id)
      throw error
    }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "clevertap_account_id", label: "CleverTap Account ID", required: true,
        userOwnedRequired: true, secretReferenceId: a.id, status: .verified,
        helpText:
          "Project ID stored as a Keychain reference and sent only in the documented account header.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "clevertap_passcode", label: "CleverTap API passcode", required: true,
        userOwnedRequired: true, secretReferenceId: p.id, status: .verified,
        helpText: "Dedicated account/user passcode stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "clevertap_region", label: "CleverTap data-center region", required: true,
        userOwnedRequired: true, secretReferenceId: r.id, status: .verified,
        helpText: "Exact official regional API-origin binding stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "clevertap_profile_identity", label: "Bound CleverTap profile identity",
        required: true, userOwnedRequired: true, secretReferenceId: i.id, status: .verified,
        helpText:
          "Exact profile identity stored as a Keychain reference and unavailable to runtime input.",
        redactionStatus: "secret-reference-only"),
    ]
    let suffix = String(account.suffix(8))
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "clevertap:" + regionCode + ":" + account, providerName: "CleverTap",
      status: .connected, authorizationState: .completed, credentialOwnership: .userOwned,
      userOwnedCredentialsRequired: true, credentialRequirements: requirements,
      secretReferenceIds: [a.id, p.id, r.id, i.id],
      accountLabel: "CleverTap " + regionCode + " project …" + suffix,
      connectedHandle: "clevertap:" + regionCode + ":" + suffix, callbackURL: nil,
      requiredScopes: [], grantedScopes: [], selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message: "CleverTap customer credentials are ready for exact bound-profile validation.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("clevertap"),
          "authMethod": .string("customer_owned_account_or_user_passcode"),
          "region": .string(regionCode), "apiOrigin": .string(origin),
          "profileIdentityBound": .bool(true), "readOnlyV1": .bool(true),
          "runtimeIdentifierInput": .bool(false), "customPropertyValuesReturned": .bool(false),
          "deviceIdentifiersReturned": .bool(false), "writesEnabled": .bool(false),
          "maxEvents": .number(25), "maxPlatforms": .number(10), "maxPropertyKeys": .number(50),
          "responseCapBytes": .number(1_000_000), "rawCredentialStoredInDatabase": .bool(false),
        ], redactionStatus: "lookup-identity-custom-values-device-tokens-and-object-ids-excluded"),
      senderIdentities: [], installPolicy: "approval_gated_clevertap_bound_profile_read",
      lastCheckedAt: timestamp, lastError: nil,
      manualEvidenceNote:
        "CleverTap requires eligible project access, a dedicated account/user passcode, exact region, one existing profile identity, and live acceptance.",
      reauthorizeRequired: false, disconnecting: false, betaBlocked: false,
      createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp,
      redactionStatus: "lookup-identity-custom-values-device-tokens-and-object-ids-excluded")
    do {
      let saved = try saveConnection(context: context, connection: connection)
      for ref in old where !saved.secretReferenceIds.contains(ref) { _ = try? secrets.delete(ref) }
      return saved
    } catch {
      _ = try? secrets.delete(a.id)
      _ = try? secrets.delete(p.id)
      _ = try? secrets.delete(r.id)
      _ = try? secrets.delete(i.id)
      throw error
    }
  }
}
