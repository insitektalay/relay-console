import Foundation

extension ProviderConnectionService {
  @discardableResult
  public func saveXRelayOwnedOAuthConnection(
    context: ServiceRequestContext,
    appIdOrSlug: RelayId,
    accessToken: String,
    refreshToken: String,
    userId: String,
    username: String,
    displayName: String,
    grantedScopes: [String],
    expiresAt: String?,
    billingReady: Bool,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "x")
    let id = createRelayId("mpc")
    let normalizedUserId = try requireNonEmptyString(userId, field: "X user id", maxLength: 128)
    let normalizedUsername = try requireNonEmptyString(
      username, field: "X username", maxLength: 128)
    let normalizedDisplayName = try requireNonEmptyString(
      displayName, field: "X display name", maxLength: 512)
    guard app.slug == "x", grantedScopes == Self.xRelayOwnedOAuthScopes, billingReady else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "X requires exact Relay-owned OAuth scopes and a funded credit balance with a spending limit."
      )
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "X OAuth access token",
      secretValue: try requireNonEmptyString(accessToken, field: "X access token", maxLength: 30000)
    )
    let refresh = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "X OAuth refresh token",
      secretValue: try requireNonEmptyString(
        refreshToken, field: "X refresh token", maxLength: 30000))
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let callbackURL = "https://relay.clawchat.app/api/v1/oauth/x/callback"
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "x_oauth_access_token", label: "X OAuth access token", required: true,
        userOwnedRequired: false, secretReferenceId: access.id, status: .verified,
        helpText: "Relay-owned OAuth token stored as a secret reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "x_oauth_refresh_token", label: "X OAuth refresh token", required: true,
        userOwnedRequired: false, secretReferenceId: refresh.id, status: .verified,
        helpText: "Rotating Relay-owned OAuth refresh token stored as a separate secret reference.",
        redactionStatus: "secret-reference-only"),
    ]
    let diagnostics: JSONRecord = [
      "apiOrigin": .string("https://api.x.com"), "authMethod": .string("oauth2_pkce"),
      "railwayCallbackOnly": .bool(true), "pkceS256": .bool(true), "stateVerified": .bool(true),
      "userBound": .bool(true), "userId": .string(normalizedUserId),
      "username": .string(normalizedUsername),
      "tokenExpiresAt": expiresAt.map(JSONValue.string) ?? .null, "billingReady": .bool(true),
      "spendingLimitRequired": .bool(true), "ownedReadDiscountAssumed": .bool(false),
      "replyAutomationEnabled": .bool(false), "urlsEnabled": .bool(false),
      "mediaEnabled": .bool(false),
      "searchEnabled": .bool(false), "automaticPagination": .bool(false),
      "rawToolsEnabled": .bool(false),
      "maxOwnPosts": .number(10), "secretStorage": .string("keychain-reference-only"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "x-relay-owned-oauth:\(normalizedUserId)", providerName: "X",
      status: .connected, authorizationState: .completed, credentialOwnership: .relayOwned,
      userOwnedCredentialsRequired: false, credentialRequirements: requirements,
      secretReferenceIds: [access.id, refresh.id], accountLabel: normalizedDisplayName,
      connectedHandle: "@\(normalizedUsername)", callbackURL: callbackURL,
      requiredScopes: Self.xRelayOwnedOAuthScopes, grantedScopes: Self.xRelayOwnedOAuthScopes,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message:
          "X is ready for bounded connected-account reads and approval-controlled plain-text publishing.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [], diagnostics: diagnostics,
        redactionStatus: "private-state-excluded"),
      senderIdentities: [], installPolicy: "relay_owned_x_bounded_social_publishing",
      lastCheckedAt: timestamp, lastError: nil, manualEvidenceNote: nil,
      reauthorizeRequired: false, disconnecting: false, betaBlocked: false,
      createdAt: timestamp, updatedAt: timestamp, redactionStatus: "private-state-excluded"
    )
    do { return try saveConnection(context: context, connection: connection) } catch {
      _ = try? secrets.delete(access.id)
      _ = try? secrets.delete(refresh.id)
      throw error
    }
  }

  @discardableResult
  public func rotateXRelayOwnedOAuthTokens(
    context: ServiceRequestContext,
    connectionId: RelayId,
    accessToken: String,
    refreshToken: String,
    expiresAt: String?,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    xTokenRotationLock.lock()
    defer { xTokenRotationLock.unlock() }
    guard
      var connection = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      connection.appSlug == "x", connection.credentialOwnership == .relayOwned,
      connection.grantedScopes == Self.xRelayOwnedOAuthScopes,
      connection.health.diagnostics["railwayCallbackOnly"]?.bool == true
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "An exact Relay-owned X OAuth connection is required.")
    }
    let oldIds = connection.secretReferenceIds
    let access = try secrets.set(
      scope: "provider_connection", scopeId: connection.id, label: "X OAuth access token",
      secretValue: try requireNonEmptyString(accessToken, field: "X access token", maxLength: 30000)
    )
    let refresh = try secrets.set(
      scope: "provider_connection", scopeId: connection.id, label: "X OAuth refresh token",
      secretValue: try requireNonEmptyString(
        refreshToken, field: "X refresh token", maxLength: 30000))
    connection.credentialRequirements = connection.credentialRequirements.map { value in
      var copy = value
      if copy.fieldKey == "x_oauth_access_token" { copy.secretReferenceId = access.id }
      if copy.fieldKey == "x_oauth_refresh_token" { copy.secretReferenceId = refresh.id }
      return copy
    }
    connection.secretReferenceIds = [access.id, refresh.id]
    connection.health.diagnostics["tokenExpiresAt"] = expiresAt.map(JSONValue.string) ?? .null
    connection.updatedAt = ISO8601DateFormatter.relayConsole.string(from: now)
    do {
      let saved = try saveConnection(context: context, connection: connection)
      for old in oldIds { _ = try? secrets.delete(old) }
      return saved
    } catch {
      _ = try? secrets.delete(access.id)
      _ = try? secrets.delete(refresh.id)
      throw error
    }
  }

  @discardableResult
  public func saveFacebookPagesRelayOwnedOAuthConnection(
    context: ServiceRequestContext,
    appIdOrSlug: RelayId,
    userAccessToken: String,
    pageAccessToken: String,
    grantingUserId: String,
    selectedPageId: String,
    selectedPageName: String,
    selectedPageLink: String?,
    callbackURL: String,
    grantedScopes: [String],
    accessExpiresAt: String?,
    selectedPageCreateContentTaskVerified: Bool,
    stateVerified: Bool,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "facebook-pages")
    let userId = try requireNonEmptyString(
      grantingUserId, field: "Facebook granting user id", maxLength: 128)
    let pageId = try requireNonEmptyString(
      selectedPageId, field: "Facebook selected Page id", maxLength: 128)
    let pageName = try requireNonEmptyString(
      selectedPageName, field: "Facebook selected Page name", maxLength: 512)
    let safeIdentifier: (String) -> Bool = {
      !$0.isEmpty && $0.allSatisfy { $0.isLetter || $0.isNumber || "-_".contains($0) }
    }
    guard let callback = URL(string: callbackURL), callback.scheme == "https",
      let host = callback.host?.lowercased(), !host.isEmpty,
      !["localhost", "localhost.localdomain", "127.0.0.1", "::1", "0.0.0.0"].contains(host),
      callback.path == "/api/v1/oauth/facebook-pages/callback",
      callback.user == nil, callback.password == nil, callback.query == nil,
      callback.fragment == nil, app.slug == "facebook-pages",
      safeIdentifier(userId), safeIdentifier(pageId),
      grantedScopes == Self.facebookPagesRelayOwnedOAuthScopes,
      selectedPageCreateContentTaskVerified, stateVerified
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "Facebook Pages requires an exact HTTPS Railway callback, verified state, exact three permissions, and one Page with create-content task access."
      )
    }
    try validateAppCanAuthorize(app, context: context)
    let id = createRelayId("mpc")
    let userToken = try secrets.set(
      scope: "provider_connection", scopeId: id,
      label: "Facebook granting-user access token",
      secretValue: try requireNonEmptyString(
        userAccessToken, field: "Facebook granting-user access token", maxLength: 30000))
    let pageToken: SecretReference
    do {
      pageToken = try secrets.set(
        scope: "provider_connection", scopeId: id,
        label: "Facebook selected-Page access token",
        secretValue: try requireNonEmptyString(
          pageAccessToken, field: "Facebook selected-Page access token", maxLength: 30000))
    } catch {
      _ = try? secrets.delete(userToken.id)
      throw error
    }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "facebook_pages_user_access_token",
        label: "Facebook granting-user access token", required: true,
        userOwnedRequired: false, secretReferenceId: userToken.id, status: .verified,
        helpText: "Railway-held granting-user token stored as a secret reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "facebook_pages_page_access_token",
        label: "Facebook selected-Page access token", required: true,
        userOwnedRequired: false, secretReferenceId: pageToken.id, status: .verified,
        helpText: "Selected-Page token stored as a separate secret reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "facebook_pages_selected_page", label: "Selected Facebook Page",
        required: true, userOwnedRequired: false, secretReferenceId: nil,
        status: .verified,
        helpText: "Immutable Page ID/name binding verified during Railway OAuth.",
        redactionStatus: "private-state-excluded"),
    ]
    let diagnostics: JSONRecord = [
      "apiOrigin": .string("https://graph.facebook.com/v25.0"),
      "railwayCallbackOnly": .bool(true), "stateVerified": .bool(true),
      "selectedPageVerified": .bool(true), "selectedPageId": .string(pageId),
      "selectedPageName": .string(pageName),
      "selectedPageLink": selectedPageLink?.providerConnectionNilIfEmpty.map(JSONValue.string)
        ?? .null,
      "grantingUserId": .string(userId),
      "selectedPageCreateContentTaskVerified": .bool(true),
      "pageAuthoredPostsOnly": .bool(true), "visitorFeedEnabled": .bool(false),
      "commentsMessagesEnabled": .bool(false), "adsInsightsEnabled": .bool(false),
      "mediaEnabled": .bool(false), "webhooksSettingsRolesEnabled": .bool(false),
      "editDeleteScheduleEnabled": .bool(false), "automaticRetry": .bool(false),
      "automaticPagination": .bool(false), "rawToolsEnabled": .bool(false),
      "maxOwnPosts": .number(10), "maxPostCharacters": .number(5000),
      "accessExpiresAt": accessExpiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string)
        ?? .null,
      "secretStorage": .string("two-keychain-references"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "facebook-pages-relay-owned-oauth:\(userId):\(pageId)",
      providerName: "Facebook Pages", status: .connected,
      authorizationState: .completed, credentialOwnership: .relayOwned,
      userOwnedCredentialsRequired: false, credentialRequirements: requirements,
      secretReferenceIds: [userToken.id, pageToken.id], accountLabel: pageName,
      connectedHandle: selectedPageLink?.providerConnectionNilIfEmpty ?? "Page \(pageId)",
      callbackURL: callback.absoluteString,
      requiredScopes: Self.facebookPagesRelayOwnedOAuthScopes,
      grantedScopes: Self.facebookPagesRelayOwnedOAuthScopes,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message:
          "Facebook Pages is ready for one selected Page, bounded Page-authored reads, local drafts, and approval-controlled plain-text publishing.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: diagnostics, redactionStatus: "private-state-excluded"),
      senderIdentities: [], installPolicy: "selected_page_bounded_text_publishing",
      lastCheckedAt: timestamp, lastError: nil, manualEvidenceNote: nil,
      reauthorizeRequired: false, disconnecting: false, betaBlocked: false,
      createdAt: timestamp, updatedAt: timestamp, redactionStatus: "private-state-excluded")
    do { return try saveConnection(context: context, connection: connection) } catch {
      _ = try? secrets.delete(userToken.id)
      _ = try? secrets.delete(pageToken.id)
      throw error
    }
  }

  @discardableResult
  public func rotateFacebookPagesRelayOwnedOAuthTokens(
    context: ServiceRequestContext,
    connectionId: RelayId,
    userAccessToken: String,
    pageAccessToken: String,
    accessExpiresAt: String?,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    facebookPagesTokenRotationLock.lock()
    defer { facebookPagesTokenRotationLock.unlock() }
    guard
      var connection = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      connection.appSlug == "facebook-pages",
      connection.credentialOwnership == .relayOwned,
      connection.grantedScopes == Self.facebookPagesRelayOwnedOAuthScopes,
      connection.health.diagnostics["railwayCallbackOnly"]?.bool == true,
      connection.health.diagnostics["selectedPageVerified"]?.bool == true
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "An exact selected-Page Meta OAuth connection is required.")
    }
    let oldIds = connection.secretReferenceIds
    let userToken = try secrets.set(
      scope: "provider_connection", scopeId: connection.id,
      label: "Facebook granting-user access token",
      secretValue: try requireNonEmptyString(
        userAccessToken, field: "Facebook granting-user access token", maxLength: 30000))
    let pageToken: SecretReference
    do {
      pageToken = try secrets.set(
        scope: "provider_connection", scopeId: connection.id,
        label: "Facebook selected-Page access token",
        secretValue: try requireNonEmptyString(
          pageAccessToken, field: "Facebook selected-Page access token", maxLength: 30000))
    } catch {
      _ = try? secrets.delete(userToken.id)
      throw error
    }
    connection.credentialRequirements = connection.credentialRequirements.map { value in
      var copy = value
      if copy.fieldKey == "facebook_pages_user_access_token" {
        copy.secretReferenceId = userToken.id
      }
      if copy.fieldKey == "facebook_pages_page_access_token" {
        copy.secretReferenceId = pageToken.id
      }
      return copy
    }
    connection.secretReferenceIds = [userToken.id, pageToken.id]
    connection.health.diagnostics["accessExpiresAt"] =
      accessExpiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null
    connection.health.state = .ready
    connection.health.message =
      "Facebook Pages tokens were atomically replaced and the selected Page binding remains ready."
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    connection.health.lastCheckedAt = timestamp
    connection.updatedAt = timestamp
    do {
      let saved = try saveConnection(context: context, connection: connection)
      for old in oldIds { _ = try? secrets.delete(old) }
      return saved
    } catch {
      _ = try? secrets.delete(userToken.id)
      _ = try? secrets.delete(pageToken.id)
      throw error
    }
  }

  @discardableResult
  public func validateSavedFacebookPagesConnection(
    context: ServiceRequestContext,
    connectionId: RelayId,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    guard
      var connection = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      connection.appSlug == "facebook-pages"
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "A Facebook Pages connection is required.")
    }
    let required = [
      "facebook_pages_user_access_token", "facebook_pages_page_access_token",
    ]
    let byKey = Dictionary(
      uniqueKeysWithValues: connection.credentialRequirements.map { ($0.fieldKey, $0) })
    let unreadable = required.filter { field in
      guard let id = byKey[field]?.secretReferenceId else { return true }
      return (try? secrets.getSecretValue(id))?.providerConnectionNilIfEmpty == nil
    }
    let exactContract =
      connection.credentialOwnership == .relayOwned
      && connection.requiredScopes == Self.facebookPagesRelayOwnedOAuthScopes
      && connection.grantedScopes == Self.facebookPagesRelayOwnedOAuthScopes
      && connection.health.diagnostics["railwayCallbackOnly"]?.bool == true
      && connection.health.diagnostics["stateVerified"]?.bool == true
      && connection.health.diagnostics["selectedPageVerified"]?.bool == true
      && connection.health.diagnostics["selectedPageCreateContentTaskVerified"]?.bool == true
      && connection.health.diagnostics["pageAuthoredPostsOnly"]?.bool == true
      && connection.health.diagnostics["visitorFeedEnabled"]?.bool == false
      && connection.health.diagnostics["commentsMessagesEnabled"]?.bool == false
      && connection.health.diagnostics["adsInsightsEnabled"]?.bool == false
      && connection.health.diagnostics["mediaEnabled"]?.bool == false
      && connection.health.diagnostics["automaticPagination"]?.bool == false
      && connection.health.diagnostics["rawToolsEnabled"]?.bool == false
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    if !unreadable.isEmpty || !exactContract {
      connection.status = .authRequired
      connection.health.state = .error
      connection.health.message =
        unreadable.isEmpty
        ? "Facebook Pages exact permission or selected-Page boundary changed; reconnect is required."
        : "Facebook Pages token references are missing or unreadable; reconnect is required."
      connection.health.unavailableTools = [
        "relay_facebook_pages_get_page", "relay_facebook_pages_list_own_posts",
        "relay_facebook_pages_draft_post", "relay_facebook_pages_publish_text_post",
      ]
      connection.health.diagnostics["unreadableSecretFields"] =
        .array(unreadable.map(JSONValue.string))
      if !unreadable.isEmpty {
        let unreadableSet = Set(unreadable)
        connection.credentialRequirements = connection.credentialRequirements.map { value in
          guard unreadableSet.contains(value.fieldKey) else { return value }
          var copy = value
          copy.secretReferenceId = nil
          copy.status = .missing
          return copy
        }
        connection.secretReferenceIds = connection.secretReferenceIds.filter {
          (try? secrets.exists($0)) == true
        }
      }
      connection.reauthorizeRequired = true
    } else {
      connection.status = .connected
      connection.health.state = .ready
      connection.health.message =
        "Facebook Pages token references, exact permissions, and selected Page binding are ready."
      connection.health.unavailableTools = []
      connection.health.diagnostics["unreadableSecretFields"] = .array([])
      connection.reauthorizeRequired = false
    }
    connection.health.lastCheckedAt = timestamp
    connection.lastCheckedAt = timestamp
    connection.updatedAt = timestamp
    return try saveConnection(context: context, connection: connection)
  }

  @discardableResult
  public func recordFacebookPagesAuthorizationFailure(
    context: ServiceRequestContext,
    connectionId: RelayId,
    providerCode: String,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    let allowed = ["invalid_token", "permission_revoked", "page_access_lost"]
    guard allowed.contains(providerCode),
      var connection = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      connection.appSlug == "facebook-pages"
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "A supported Facebook Pages authorization failure is required.")
    }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    connection.status = .authRequired
    connection.health.state = .error
    connection.health.message =
      "Facebook Pages authorization is no longer usable; reconnect and select the Page again."
    connection.health.diagnostics["authorizationFailureCode"] = .string(providerCode)
    connection.health.unavailableTools = [
      "relay_facebook_pages_get_page", "relay_facebook_pages_list_own_posts",
      "relay_facebook_pages_draft_post", "relay_facebook_pages_publish_text_post",
    ]
    connection.reauthorizeRequired = true
    connection.lastError =
      "facebook_pages_\(providerCode): Meta rejected the saved Page authorization."
    connection.health.lastCheckedAt = timestamp
    connection.lastCheckedAt = timestamp
    connection.updatedAt = timestamp
    return try saveConnection(context: context, connection: connection)
  }

  @discardableResult
  public func saveInstagramBusinessRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String,
    professionalAccountId: String, username: String, accountType: String,
    callbackURL: String, grantedScopes: [String], accessExpiresAt: String?,
    stateVerified: Bool, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "instagram-business")
    let accountId = try requireNonEmptyString(
      professionalAccountId, field: "Instagram professional account id", maxLength: 128)
    let handle = try requireNonEmptyString(
      username, field: "Instagram professional account username", maxLength: 64)
    let type = accountType.uppercased().trimmingCharacters(in: .whitespacesAndNewlines)
    let safeIdentifier: (String) -> Bool = {
      !$0.isEmpty && $0.allSatisfy { $0.isLetter || $0.isNumber || "-_".contains($0) }
    }
    guard app.slug == "instagram-business", safeIdentifier(accountId), safeIdentifier(handle),
      ["BUSINESS", "CREATOR"].contains(type),
      grantedScopes == Self.instagramBusinessRelayOwnedOAuthScopes,
      stateVerified, let callback = URL(string: callbackURL), callback.scheme == "https",
      let host = callback.host?.lowercased(), !host.isEmpty,
      !["localhost", "localhost.localdomain", "127.0.0.1", "::1", "0.0.0.0"].contains(host),
      callback.path == "/api/v1/oauth/instagram-business/callback",
      callback.user == nil, callback.password == nil, callback.query == nil,
      callback.fragment == nil
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "Instagram Business requires an exact HTTPS Railway callback, verified state, current instagram_business_basic scope, and one Business or Creator account."
      )
    }
    try validateAppCanAuthorize(app, context: context)
    let id = createRelayId("mpc")
    let token = try secrets.set(
      scope: "provider_connection", scopeId: id,
      label: "Instagram professional-account access token",
      secretValue: try requireNonEmptyString(
        accessToken, field: "Instagram User access token", maxLength: 30000))
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "instagram_business_user_access_token",
        label: "Instagram User access token", required: true,
        userOwnedRequired: false, secretReferenceId: token.id, status: .verified,
        helpText: "Railway-held Instagram User token stored as one secret reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "instagram_business_professional_account",
        label: "Instagram professional account", required: true,
        userOwnedRequired: false, secretReferenceId: nil, status: .verified,
        helpText: "Immutable Business or Creator account binding verified during OAuth.",
        redactionStatus: "private-state-excluded"),
    ]
    let diagnostics: JSONRecord = [
      "apiOrigin": .string("https://graph.instagram.com"),
      "authMethod": .string("business-login-for-instagram"),
      "railwayCallbackOnly": .bool(true), "stateVerified": .bool(true),
      "professionalAccountVerified": .bool(true),
      "professionalAccountId": .string(accountId),
      "professionalAccountUsername": .string(handle),
      "professionalAccountType": .string(type),
      "linkedFacebookPageRequired": .bool(false),
      "ownedMediaOnly": .bool(true), "consumerAccountsEnabled": .bool(false),
      "publishingEnabled": .bool(false), "commentsMessagesEnabled": .bool(false),
      "insightsAdsTaggingEnabled": .bool(false), "peopleDiscoveryEnabled": .bool(false),
      "mediaDownloadEnabled": .bool(false), "automaticRetry": .bool(false),
      "automaticPagination": .bool(false), "rawToolsEnabled": .bool(false),
      "maxOwnMedia": .number(10),
      "accessExpiresAt": accessExpiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string)
        ?? .null,
      "secretStorage": .string("one-keychain-reference"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "instagram-business-relay-owned-oauth:\(accountId)",
      providerName: "Instagram Business", status: .connected,
      authorizationState: .completed, credentialOwnership: .relayOwned,
      userOwnedCredentialsRequired: false, credentialRequirements: requirements,
      secretReferenceIds: [token.id], accountLabel: "@\(handle)",
      connectedHandle: "\(type.capitalized) · \(accountId)",
      callbackURL: callback.absoluteString,
      requiredScopes: Self.instagramBusinessRelayOwnedOAuthScopes,
      grantedScopes: Self.instagramBusinessRelayOwnedOAuthScopes,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message:
          "Instagram Business is ready for one professional account and bounded owned-media metadata reads.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: diagnostics, redactionStatus: "private-state-excluded"),
      senderIdentities: [], installPolicy: "professional_account_owned_media_read_only",
      lastCheckedAt: timestamp, lastError: nil, manualEvidenceNote: nil,
      reauthorizeRequired: false, disconnecting: false, betaBlocked: false,
      createdAt: timestamp, updatedAt: timestamp, redactionStatus: "private-state-excluded")
    do { return try saveConnection(context: context, connection: connection) } catch {
      _ = try? secrets.delete(token.id)
      throw error
    }
  }

  @discardableResult
  public func rotateInstagramBusinessAccessToken(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    accessExpiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    instagramBusinessTokenRotationLock.lock()
    defer { instagramBusinessTokenRotationLock.unlock() }
    guard
      var connection = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      connection.appSlug == "instagram-business",
      connection.credentialOwnership == .relayOwned,
      connection.grantedScopes == Self.instagramBusinessRelayOwnedOAuthScopes,
      connection.health.diagnostics["professionalAccountVerified"]?.bool == true
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "An exact Instagram professional-account connection is required."
      )
    }
    let oldIds = connection.secretReferenceIds
    let token = try secrets.set(
      scope: "provider_connection", scopeId: connection.id,
      label: "Instagram professional-account access token",
      secretValue: try requireNonEmptyString(
        accessToken, field: "Instagram User access token", maxLength: 30000))
    connection.credentialRequirements = connection.credentialRequirements.map { value in
      guard value.fieldKey == "instagram_business_user_access_token" else { return value }
      var copy = value
      copy.secretReferenceId = token.id
      copy.status = .verified
      return copy
    }
    connection.secretReferenceIds = [token.id]
    connection.health.diagnostics["accessExpiresAt"] =
      accessExpiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null
    connection.health.state = .ready
    connection.health.message =
      "Instagram access token was atomically replaced; the professional-account binding is unchanged."
    connection.status = .connected
    connection.reauthorizeRequired = false
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    connection.health.lastCheckedAt = timestamp
    connection.updatedAt = timestamp
    do {
      let saved = try saveConnection(context: context, connection: connection)
      for old in oldIds { _ = try? secrets.delete(old) }
      return saved
    } catch {
      _ = try? secrets.delete(token.id)
      throw error
    }
  }

  @discardableResult
  public func validateSavedInstagramBusinessConnection(
    context: ServiceRequestContext, connectionId: RelayId, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    guard
      var connection = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      connection.appSlug == "instagram-business"
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "An Instagram Business connection is required.")
    }
    let field = "instagram_business_user_access_token"
    let requirement = connection.credentialRequirements.first { $0.fieldKey == field }
    let readable =
      requirement?.secretReferenceId.flatMap {
        (try? secrets.getSecretValue($0))?.providerConnectionNilIfEmpty
      } != nil
    let exact =
      connection.credentialOwnership == .relayOwned
      && connection.requiredScopes == Self.instagramBusinessRelayOwnedOAuthScopes
      && connection.grantedScopes == Self.instagramBusinessRelayOwnedOAuthScopes
      && connection.health.diagnostics["apiOrigin"]?.string == "https://graph.instagram.com"
      && connection.health.diagnostics["professionalAccountVerified"]?.bool == true
      && connection.health.diagnostics["linkedFacebookPageRequired"]?.bool == false
      && connection.health.diagnostics["ownedMediaOnly"]?.bool == true
      && connection.health.diagnostics["publishingEnabled"]?.bool == false
      && connection.health.diagnostics["commentsMessagesEnabled"]?.bool == false
      && connection.health.diagnostics["automaticPagination"]?.bool == false
      && connection.health.diagnostics["rawToolsEnabled"]?.bool == false
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    if !readable || !exact {
      connection.status = .authRequired
      connection.health.state = .error
      connection.health.message =
        readable
        ? "Instagram Business scope or professional-account boundary changed; reconnect is required."
        : "Instagram Business token reference is missing or unreadable; reconnect is required."
      connection.health.unavailableTools = [
        "relay_instagram_business_get_account",
        "relay_instagram_business_list_own_media",
        "relay_instagram_business_get_own_media",
      ]
      connection.health.diagnostics["unreadableSecretFields"] =
        .array(readable ? [] : [.string(field)])
      if !readable {
        connection.credentialRequirements = connection.credentialRequirements.map { value in
          guard value.fieldKey == field else { return value }
          var copy = value
          copy.secretReferenceId = nil
          copy.status = .missing
          return copy
        }
        connection.secretReferenceIds = connection.secretReferenceIds.filter {
          (try? secrets.exists($0)) == true
        }
      }
      connection.reauthorizeRequired = true
    } else {
      connection.status = .connected
      connection.health.state = .ready
      connection.health.message =
        "Instagram token, exact scope, and professional-account binding are ready."
      connection.health.unavailableTools = []
      connection.health.diagnostics["unreadableSecretFields"] = .array([])
      connection.reauthorizeRequired = false
    }
    connection.health.lastCheckedAt = timestamp
    connection.lastCheckedAt = timestamp
    connection.updatedAt = timestamp
    return try saveConnection(context: context, connection: connection)
  }

  @discardableResult
  public func recordInstagramBusinessAuthorizationFailure(
    context: ServiceRequestContext, connectionId: RelayId, providerCode: String,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    guard ["invalid_token", "permission_revoked", "account_access_lost"].contains(providerCode),
      var connection = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      connection.appSlug == "instagram-business"
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "A supported Instagram authorization failure is required.")
    }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    connection.status = .authRequired
    connection.health.state = .error
    connection.health.message =
      "Instagram authorization is no longer usable; reconnect the professional account."
    connection.health.diagnostics["authorizationFailureCode"] = .string(providerCode)
    connection.health.unavailableTools = [
      "relay_instagram_business_get_account", "relay_instagram_business_list_own_media",
      "relay_instagram_business_get_own_media",
    ]
    connection.reauthorizeRequired = true
    connection.lastError =
      "instagram_business_\(providerCode): Meta rejected the saved authorization."
    connection.health.lastCheckedAt = timestamp
    connection.lastCheckedAt = timestamp
    connection.updatedAt = timestamp
    return try saveConnection(context: context, connection: connection)
  }

  @discardableResult
  public func saveThreadsRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String,
    profileId: String, username: String, displayName: String?, callbackURL: String,
    grantedScopes: [String], tokenExpiresAt: String?, stateVerified: Bool,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "threads")
    let idValue = try requireNonEmptyString(profileId, field: "Threads profile id", maxLength: 128)
    let handle = try requireNonEmptyString(username, field: "Threads username", maxLength: 64)
    let safe: (String) -> Bool = {
      !$0.isEmpty && $0.allSatisfy { $0.isLetter || $0.isNumber || "-_.".contains($0) }
    }
    guard app.slug == "threads", safe(idValue), safe(handle),
      grantedScopes == Self.threadsRelayOwnedOAuthScopes, stateVerified,
      let callback = URL(string: callbackURL), callback.scheme == "https",
      let host = callback.host?.lowercased(), !host.isEmpty,
      !["localhost", "localhost.localdomain", "127.0.0.1", "::1", "0.0.0.0"].contains(host),
      callback.path == "/api/v1/oauth/threads/callback", callback.user == nil,
      callback.password == nil, callback.query == nil, callback.fragment == nil
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "Threads requires exact scopes, verified state, one safe app-scoped profile, and the HTTPS Railway callback."
      )
    }
    try validateAppCanAuthorize(app, context: context)
    let connectionId = createRelayId("mpc")
    let token = try secrets.set(
      scope: "provider_connection", scopeId: connectionId,
      label: "Threads long-lived User access token",
      secretValue: try requireNonEmptyString(
        accessToken, field: "Threads access token", maxLength: 30000))
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "threads_user_access_token", label: "Threads User access token",
        required: true, userOwnedRequired: false, secretReferenceId: token.id,
        status: .verified,
        helpText: "Railway-held long-lived Threads User token stored as one secret reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "threads_connected_profile", label: "Connected Threads profile",
        required: true, userOwnedRequired: false, secretReferenceId: nil,
        status: .verified, helpText: "Immutable app-scoped Threads profile verified during OAuth.",
        redactionStatus: "private-state-excluded"),
    ]
    let diagnostics: JSONRecord = [
      "apiOrigin": .string("https://graph.threads.net"),
      "authMethod": .string("threads_authorization_code"),
      "railwayCallbackOnly": .bool(true), "stateVerified": .bool(true),
      "profileVerified": .bool(true), "connectedResourceId": .string(idValue),
      "username": .string(handle),
      "displayName": displayName?.providerConnectionNilIfEmpty.map {
        .string(String($0.prefix(512)))
      } ?? .null,
      "ownPostsOnly": .bool(true), "plainTextPublishOnly": .bool(true),
      "repliesInsightsDiscoveryEnabled": .bool(false),
      "mediaLinksPollsEnabled": .bool(false),
      "quotesRepostsDeleteEnabled": .bool(false),
      "automaticRetry": .bool(false), "automaticPagination": .bool(false),
      "rawToolsEnabled": .bool(false), "maxOwnPosts": .number(10),
      "maxPostCharacters": .number(500), "maxPublishRequests": .number(2),
      "tokenExpiresAt": tokenExpiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
      "secretStorage": .string("one-keychain-reference"),
    ]
    let connection = MarketplaceProviderConnection(
      id: connectionId, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "threads-relay-owned-oauth:\(idValue)", providerName: "Threads",
      status: .connected, authorizationState: .completed,
      credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
      credentialRequirements: requirements, secretReferenceIds: [token.id],
      accountLabel: displayName?.providerConnectionNilIfEmpty ?? "@\(handle)",
      connectedHandle: "@\(handle)",
      callbackURL: callback.absoluteString, requiredScopes: Self.threadsRelayOwnedOAuthScopes,
      grantedScopes: Self.threadsRelayOwnedOAuthScopes, selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message:
          "Threads is ready for bounded own-post reads and approval-controlled plain-text publishing.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: diagnostics, redactionStatus: "private-state-excluded"),
      senderIdentities: [], installPolicy: "bound_profile_plain_text_publishing",
      lastCheckedAt: timestamp, lastError: nil, manualEvidenceNote: nil,
      reauthorizeRequired: false, disconnecting: false, betaBlocked: false,
      createdAt: timestamp, updatedAt: timestamp, redactionStatus: "private-state-excluded")
    do { return try saveConnection(context: context, connection: connection) } catch {
      _ = try? secrets.delete(token.id)
      throw error
    }
  }

  @discardableResult
  public func rotateThreadsAccessToken(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    tokenExpiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    threadsTokenRotationLock.lock()
    defer { threadsTokenRotationLock.unlock() }
    guard
      var connection = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      connection.appSlug == "threads", connection.credentialOwnership == .relayOwned,
      connection.grantedScopes == Self.threadsRelayOwnedOAuthScopes,
      connection.health.diagnostics["profileVerified"]?.bool == true
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "An exact Threads profile connection is required.")
    }
    let oldIds = connection.secretReferenceIds
    let token = try secrets.set(
      scope: "provider_connection", scopeId: connection.id,
      label: "Threads long-lived User access token",
      secretValue: try requireNonEmptyString(
        accessToken, field: "Threads access token", maxLength: 30000))
    connection.credentialRequirements = connection.credentialRequirements.map { value in
      guard value.fieldKey == "threads_user_access_token" else { return value }
      var copy = value
      copy.secretReferenceId = token.id
      copy.status = .verified
      return copy
    }
    connection.secretReferenceIds = [token.id]
    connection.health.diagnostics["tokenExpiresAt"] =
      tokenExpiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null
    connection.status = .connected
    connection.health.state = .ready
    connection.health.message =
      "Threads access token was atomically replaced; the profile binding is unchanged."
    connection.reauthorizeRequired = false
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    connection.health.lastCheckedAt = timestamp
    connection.updatedAt = timestamp
    do {
      let saved = try saveConnection(context: context, connection: connection)
      for old in oldIds { _ = try? secrets.delete(old) }
      return saved
    } catch {
      _ = try? secrets.delete(token.id)
      throw error
    }
  }

  @discardableResult
  public func validateSavedThreadsConnection(
    context: ServiceRequestContext, connectionId: RelayId, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    guard
      var connection = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      connection.appSlug == "threads"
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "A Threads connection is required.")
    }
    let field = "threads_user_access_token"
    let requirement = connection.credentialRequirements.first { $0.fieldKey == field }
    let readable =
      requirement?.secretReferenceId.flatMap {
        (try? secrets.getSecretValue($0))?.providerConnectionNilIfEmpty
      }
      != nil
    let exact =
      connection.credentialOwnership == .relayOwned
      && connection.requiredScopes == Self.threadsRelayOwnedOAuthScopes
      && connection.grantedScopes == Self.threadsRelayOwnedOAuthScopes
      && connection.health.diagnostics["apiOrigin"]?.string == "https://graph.threads.net"
      && connection.health.diagnostics["profileVerified"]?.bool == true
      && connection.health.diagnostics["ownPostsOnly"]?.bool == true
      && connection.health.diagnostics["plainTextPublishOnly"]?.bool == true
      && connection.health.diagnostics["repliesInsightsDiscoveryEnabled"]?.bool == false
      && connection.health.diagnostics["mediaLinksPollsEnabled"]?.bool == false
      && connection.health.diagnostics["automaticPagination"]?.bool == false
      && connection.health.diagnostics["rawToolsEnabled"]?.bool == false
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    if !readable || !exact {
      connection.status = .authRequired
      connection.health.state = .error
      connection.health.message =
        readable
        ? "Threads scope or profile boundary changed; reconnect is required."
        : "Threads token reference is missing or unreadable; reconnect is required."
      connection.health.unavailableTools = [
        "relay_threads_get_profile", "relay_threads_list_own_posts",
        "relay_threads_get_own_post", "relay_threads_draft_text_post",
        "relay_threads_publish_text_post",
      ]
      connection.health.diagnostics["unreadableSecretFields"] = .array(
        readable ? [] : [.string(field)])
      if !readable {
        connection.credentialRequirements = connection.credentialRequirements.map { value in
          guard value.fieldKey == field else { return value }
          var copy = value
          copy.secretReferenceId = nil
          copy.status = .missing
          return copy
        }
        connection.secretReferenceIds = connection.secretReferenceIds.filter {
          (try? secrets.exists($0)) == true
        }
      }
      connection.reauthorizeRequired = true
    } else {
      connection.status = .connected
      connection.health.state = .ready
      connection.health.message = "Threads token, exact scopes, and profile binding are ready."
      connection.health.unavailableTools = []
      connection.health.diagnostics["unreadableSecretFields"] = .array([])
      connection.reauthorizeRequired = false
    }
    connection.health.lastCheckedAt = timestamp
    connection.lastCheckedAt = timestamp
    connection.updatedAt = timestamp
    return try saveConnection(context: context, connection: connection)
  }

  @discardableResult
  public func recordThreadsAuthorizationFailure(
    context: ServiceRequestContext, connectionId: RelayId, providerCode: String,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    guard ["invalid_token", "permission_revoked", "profile_access_lost"].contains(providerCode),
      var connection = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      connection.appSlug == "threads"
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "A supported Threads authorization failure is required.")
    }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    connection.status = .authRequired
    connection.health.state = .error
    connection.health.message = "Threads authorization is no longer usable; reconnect the profile."
    connection.health.diagnostics["authorizationFailureCode"] = .string(providerCode)
    connection.health.unavailableTools = [
      "relay_threads_get_profile", "relay_threads_list_own_posts",
      "relay_threads_get_own_post", "relay_threads_draft_text_post",
      "relay_threads_publish_text_post",
    ]
    connection.reauthorizeRequired = true
    connection.lastError = "threads_\(providerCode): Meta rejected the saved authorization."
    connection.health.lastCheckedAt = timestamp
    connection.lastCheckedAt = timestamp
    connection.updatedAt = timestamp
    return try saveConnection(context: context, connection: connection)
  }

  @discardableResult
  public func savePinterestRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId,
    accessToken: String, refreshToken: String, userId: String, username: String,
    accountType: String, displayName: String?, callbackURL: String,
    grantedScopes: [String], accessExpiresAt: String?, refreshExpiresAt: String?,
    stateVerified: Bool, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "pinterest")
    let idValue = try requireNonEmptyString(userId, field: "Pinterest user id", maxLength: 128)
    let handle = try requireNonEmptyString(username, field: "Pinterest username", maxLength: 128)
    let type = try requireNonEmptyString(
      accountType, field: "Pinterest account type", maxLength: 64)
    let safe: (String) -> Bool = {
      !$0.isEmpty && $0.allSatisfy { $0.isLetter || $0.isNumber || "-_.".contains($0) }
    }
    guard app.slug == "pinterest", safe(idValue), safe(handle), safe(type),
      grantedScopes == Self.pinterestRelayOwnedOAuthScopes, stateVerified,
      let callback = URL(string: callbackURL), callback.scheme == "https",
      let host = callback.host?.lowercased(), !host.isEmpty,
      !["localhost", "localhost.localdomain", "127.0.0.1", "::1", "0.0.0.0"].contains(host),
      callback.path == "/api/v1/oauth/pinterest/callback", callback.user == nil,
      callback.password == nil, callback.query == nil, callback.fragment == nil
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "Pinterest requires exact read scopes, verified state, one safe user account, and the HTTPS Railway callback."
      )
    }
    try validateAppCanAuthorize(app, context: context)
    let connectionId = createRelayId("mpc")
    let access = try secrets.set(
      scope: "provider_connection", scopeId: connectionId,
      label: "Pinterest OAuth access token",
      secretValue: try requireNonEmptyString(
        accessToken, field: "Pinterest access token", maxLength: 30000))
    let refresh: SecretReference
    do {
      refresh = try secrets.set(
        scope: "provider_connection", scopeId: connectionId,
        label: "Pinterest continuous refresh token",
        secretValue: try requireNonEmptyString(
          refreshToken, field: "Pinterest refresh token", maxLength: 30000))
    } catch {
      _ = try? secrets.delete(access.id)
      throw error
    }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "pinterest_oauth_access_token", label: "Pinterest OAuth access token",
        required: true, userOwnedRequired: false, secretReferenceId: access.id,
        status: .verified, helpText: "Railway-held access token stored as a secret reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "pinterest_oauth_refresh_token", label: "Pinterest continuous refresh token",
        required: true, userOwnedRequired: false, secretReferenceId: refresh.id,
        status: .verified, helpText: "Rotating continuous refresh token stored separately.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "pinterest_connected_user_account", label: "Connected Pinterest user account",
        required: true, userOwnedRequired: false, secretReferenceId: nil,
        status: .verified, helpText: "Immutable connected Pinner verified during OAuth.",
        redactionStatus: "private-state-excluded"),
    ]
    let diagnostics: JSONRecord = [
      "apiOrigin": .string("https://api.pinterest.com/v5"),
      "authMethod": .string("authorization_code_continuous_refresh"),
      "railwayCallbackOnly": .bool(true), "stateVerified": .bool(true),
      "userAccountVerified": .bool(true), "connectedResourceId": .string(idValue),
      "username": .string(handle), "accountType": .string(type),
      "displayName": displayName?.providerConnectionNilIfEmpty.map {
        .string(String($0.prefix(512)))
      } ?? .null,
      "publicContentOnly": .bool(true), "providerDataPersisted": .bool(false),
      "writesEnabled": .bool(false), "secretContentEnabled": .bool(false),
      "adsAnalyticsSearchEnabled": .bool(false), "mediaDownloadEnabled": .bool(false),
      "automaticRetry": .bool(false), "automaticPagination": .bool(false),
      "rawToolsEnabled": .bool(false), "maxResults": .number(10),
      "accessExpiresAt": accessExpiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string)
        ?? .null,
      "refreshExpiresAt": refreshExpiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string)
        ?? .null,
      "secretStorage": .string("two-keychain-references"),
    ]
    let connection = MarketplaceProviderConnection(
      id: connectionId, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "pinterest-relay-owned-oauth:\(idValue)", providerName: "Pinterest",
      status: .connected, authorizationState: .completed,
      credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
      credentialRequirements: requirements, secretReferenceIds: [access.id, refresh.id],
      accountLabel: displayName?.providerConnectionNilIfEmpty ?? "@\(handle)",
      connectedHandle: "@\(handle)",
      callbackURL: callback.absoluteString,
      requiredScopes: Self.pinterestRelayOwnedOAuthScopes,
      grantedScopes: Self.pinterestRelayOwnedOAuthScopes,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message: "Pinterest is ready for transient bounded public account, board, and Pin reads.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: diagnostics, redactionStatus: "private-state-excluded"),
      senderIdentities: [], installPolicy: "bound_user_public_content_transient_reads",
      lastCheckedAt: timestamp, lastError: nil, manualEvidenceNote: nil,
      reauthorizeRequired: false, disconnecting: false, betaBlocked: false,
      createdAt: timestamp, updatedAt: timestamp, redactionStatus: "private-state-excluded")
    do { return try saveConnection(context: context, connection: connection) } catch {
      _ = try? secrets.delete(access.id)
      _ = try? secrets.delete(refresh.id)
      throw error
    }
  }

  @discardableResult
  public func rotatePinterestOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId,
    accessToken: String, refreshToken: String, accessExpiresAt: String?,
    refreshExpiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    pinterestTokenRotationLock.lock()
    defer { pinterestTokenRotationLock.unlock() }
    guard
      var connection = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      connection.appSlug == "pinterest", connection.credentialOwnership == .relayOwned,
      connection.grantedScopes == Self.pinterestRelayOwnedOAuthScopes,
      connection.health.diagnostics["userAccountVerified"]?.bool == true
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "An exact Pinterest user connection is required.")
    }
    let oldIds = connection.secretReferenceIds
    let access = try secrets.set(
      scope: "provider_connection", scopeId: connection.id, label: "Pinterest OAuth access token",
      secretValue: try requireNonEmptyString(
        accessToken, field: "Pinterest access token", maxLength: 30000))
    let refresh: SecretReference
    do {
      refresh = try secrets.set(
        scope: "provider_connection", scopeId: connection.id,
        label: "Pinterest continuous refresh token",
        secretValue: try requireNonEmptyString(
          refreshToken, field: "Pinterest refresh token", maxLength: 30000))
    } catch {
      _ = try? secrets.delete(access.id)
      throw error
    }
    connection.credentialRequirements = connection.credentialRequirements.map { value in
      var copy = value
      if copy.fieldKey == "pinterest_oauth_access_token" {
        copy.secretReferenceId = access.id
        copy.status = .verified
      }
      if copy.fieldKey == "pinterest_oauth_refresh_token" {
        copy.secretReferenceId = refresh.id
        copy.status = .verified
      }
      return copy
    }
    connection.secretReferenceIds = [access.id, refresh.id]
    connection.health.diagnostics["accessExpiresAt"] =
      accessExpiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null
    connection.health.diagnostics["refreshExpiresAt"] =
      refreshExpiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null
    connection.status = .connected
    connection.health.state = .ready
    connection.health.message =
      "Pinterest access and continuous refresh tokens were atomically replaced; the Pinner binding is unchanged."
    connection.reauthorizeRequired = false
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    connection.health.lastCheckedAt = timestamp
    connection.updatedAt = timestamp
    do {
      let saved = try saveConnection(context: context, connection: connection)
      for old in oldIds { _ = try? secrets.delete(old) }
      return saved
    } catch {
      _ = try? secrets.delete(access.id)
      _ = try? secrets.delete(refresh.id)
      throw error
    }
  }

  @discardableResult
  public func validateSavedPinterestConnection(
    context: ServiceRequestContext, connectionId: RelayId, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    guard
      var connection = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      connection.appSlug == "pinterest"
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "A Pinterest connection is required.")
    }
    let fields = ["pinterest_oauth_access_token", "pinterest_oauth_refresh_token"]
    let unreadable = fields.filter { field in
      let requirement = connection.credentialRequirements.first { $0.fieldKey == field }
      return requirement?.secretReferenceId.flatMap {
        (try? secrets.getSecretValue($0))?.providerConnectionNilIfEmpty
      } == nil
    }
    let exact =
      connection.credentialOwnership == .relayOwned
      && connection.requiredScopes == Self.pinterestRelayOwnedOAuthScopes
      && connection.grantedScopes == Self.pinterestRelayOwnedOAuthScopes
      && connection.health.diagnostics["apiOrigin"]?.string == "https://api.pinterest.com/v5"
      && connection.health.diagnostics["userAccountVerified"]?.bool == true
      && connection.health.diagnostics["publicContentOnly"]?.bool == true
      && connection.health.diagnostics["providerDataPersisted"]?.bool == false
      && connection.health.diagnostics["writesEnabled"]?.bool == false
      && connection.health.diagnostics["secretContentEnabled"]?.bool == false
      && connection.health.diagnostics["automaticPagination"]?.bool == false
      && connection.health.diagnostics["rawToolsEnabled"]?.bool == false
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    if !unreadable.isEmpty || !exact {
      connection.status = .authRequired
      connection.health.state = .error
      connection.health.message =
        unreadable.isEmpty
        ? "Pinterest scope, no-store, or user boundary changed; reconnect is required."
        : "Pinterest token reference is missing or unreadable; reconnect is required."
      connection.health.unavailableTools = [
        "relay_pinterest_get_user_account", "relay_pinterest_list_public_boards",
        "relay_pinterest_list_public_pins", "relay_pinterest_get_public_pin",
      ]
      connection.health.diagnostics["unreadableSecretFields"] = .array(
        unreadable.map(JSONValue.string))
      if !unreadable.isEmpty {
        connection.credentialRequirements = connection.credentialRequirements.map { value in
          guard unreadable.contains(value.fieldKey) else { return value }
          var copy = value
          copy.secretReferenceId = nil
          copy.status = .missing
          return copy
        }
        connection.secretReferenceIds = connection.secretReferenceIds.filter {
          (try? secrets.exists($0)) == true
        }
      }
      connection.reauthorizeRequired = true
    } else {
      connection.status = .connected
      connection.health.state = .ready
      connection.health.message =
        "Pinterest tokens, exact read scopes, no-store boundary, and user binding are ready."
      connection.health.unavailableTools = []
      connection.health.diagnostics["unreadableSecretFields"] = .array([])
      connection.reauthorizeRequired = false
    }
    connection.health.lastCheckedAt = timestamp
    connection.lastCheckedAt = timestamp
    connection.updatedAt = timestamp
    return try saveConnection(context: context, connection: connection)
  }

  @discardableResult
  public func recordPinterestAuthorizationFailure(
    context: ServiceRequestContext, connectionId: RelayId, providerCode: String,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    guard
      ["invalid_token", "permission_revoked", "user_access_lost", "refresh_expired"].contains(
        providerCode),
      var connection = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      connection.appSlug == "pinterest"
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "A supported Pinterest authorization failure is required.")
    }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    connection.status = .authRequired
    connection.health.state = .error
    connection.health.message =
      "Pinterest authorization is no longer usable; reconnect the account."
    connection.health.diagnostics["authorizationFailureCode"] = .string(providerCode)
    connection.health.unavailableTools = [
      "relay_pinterest_get_user_account", "relay_pinterest_list_public_boards",
      "relay_pinterest_list_public_pins", "relay_pinterest_get_public_pin",
    ]
    connection.reauthorizeRequired = true
    connection.lastError = "pinterest_\(providerCode): Pinterest rejected the saved authorization."
    connection.health.lastCheckedAt = timestamp
    connection.lastCheckedAt = timestamp
    connection.updatedAt = timestamp
    return try saveConnection(context: context, connection: connection)
  }
}
