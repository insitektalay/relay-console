import Foundation

extension ProviderConnectionService {
  @discardableResult
  public func saveTumblrRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId,
    accessToken: String, refreshToken: String, accountName: String,
    selectedBlogUUID: String, selectedBlogName: String, selectedBlogTitle: String,
    selectedBlogURL: String, selectedBlogPrimary: Bool, selectedBlogType: String,
    callbackURL: String, grantedScopes: [String], accessExpiresAt: String?,
    stateVerified: Bool, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "tumblr")
    let account = try requireNonEmptyString(
      accountName, field: "Tumblr account name", maxLength: 128)
    let blogUUID = try requireNonEmptyString(
      selectedBlogUUID, field: "Tumblr selected blog UUID", maxLength: 160)
    let blogName = try requireNonEmptyString(
      selectedBlogName, field: "Tumblr selected blog name", maxLength: 128)
    let blogTitle = try requireNonEmptyString(
      selectedBlogTitle, field: "Tumblr selected blog title", maxLength: 512)
    let blogType = try requireNonEmptyString(
      selectedBlogType, field: "Tumblr selected blog type", maxLength: 32)
    let safeName: (String) -> Bool = {
      !$0.isEmpty && $0.allSatisfy { $0.isLetter || $0.isNumber || "-_.".contains($0) }
    }
    let safeUUID =
      blogUUID.hasPrefix("t:")
      && blogUUID.dropFirst(2).allSatisfy {
        $0.isLetter || $0.isNumber || "-_".contains($0)
      }
    guard app.slug == "tumblr", safeName(account), safeName(blogName), safeUUID,
      ["public", "private"].contains(blogType.lowercased()),
      grantedScopes == Self.tumblrRelayOwnedOAuthScopes, stateVerified,
      let blogURL = URL(string: selectedBlogURL), blogURL.scheme == "https",
      let blogHost = blogURL.host?.lowercased(), !blogHost.isEmpty,
      blogURL.user == nil, blogURL.password == nil,
      let callback = URL(string: callbackURL), callback.scheme == "https",
      let callbackHost = callback.host?.lowercased(), !callbackHost.isEmpty,
      !["localhost", "localhost.localdomain", "127.0.0.1", "::1", "0.0.0.0"].contains(callbackHost),
      callback.path == "/api/v1/oauth/tumblr/callback", callback.user == nil,
      callback.password == nil, callback.query == nil, callback.fragment == nil
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "Tumblr requires exact read/offline scopes, verified state, one safe account-owned blog, and the HTTPS Railway callback."
      )
    }
    try validateAppCanAuthorize(app, context: context)
    let connectionId = createRelayId("mpc")
    let access = try secrets.set(
      scope: "provider_connection", scopeId: connectionId,
      label: "Tumblr OAuth access token",
      secretValue: try requireNonEmptyString(
        accessToken, field: "Tumblr access token", maxLength: 30000))
    let refresh: SecretReference
    do {
      refresh = try secrets.set(
        scope: "provider_connection", scopeId: connectionId,
        label: "Tumblr OAuth refresh token",
        secretValue: try requireNonEmptyString(
          refreshToken, field: "Tumblr refresh token", maxLength: 30000))
    } catch {
      _ = try? secrets.delete(access.id)
      throw error
    }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "tumblr_oauth_access_token", label: "Tumblr OAuth access token",
        required: true, userOwnedRequired: false, secretReferenceId: access.id,
        status: .verified, helpText: "Railway-exchanged access token stored as a secret reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "tumblr_oauth_refresh_token", label: "Tumblr OAuth refresh token",
        required: true, userOwnedRequired: false, secretReferenceId: refresh.id,
        status: .verified, helpText: "Offline refresh token stored and rotated separately.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "tumblr_connected_account_blog",
        label: "Connected Tumblr account and selected owned blog",
        required: true, userOwnedRequired: false, secretReferenceId: nil,
        status: .verified,
        helpText: "Account and owned-blog binding verified from Tumblr user info.",
        redactionStatus: "private-state-excluded"),
    ]
    let diagnostics: JSONRecord = [
      "apiOrigin": .string("https://api.tumblr.com"),
      "authMethod": .string("oauth2_authorization_code_offline_refresh"),
      "railwayCallbackOnly": .bool(true), "stateVerified": .bool(true),
      "accountVerified": .bool(true), "accountName": .string(account),
      "ownedBlogVerified": .bool(true), "selectedBlogUUID": .string(blogUUID),
      "selectedBlogName": .string(blogName), "selectedBlogTitle": .string(blogTitle),
      "selectedBlogURL": .string(blogURL.absoluteString),
      "selectedBlogPrimary": .bool(selectedBlogPrimary),
      "selectedBlogType": .string(blogType.lowercased()),
      "publishedPostsOnly": .bool(true), "npfPreferred": .bool(true),
      "providerDataPersisted": .bool(false), "writesEnabled": .bool(false),
      "dashboardCloneEnabled": .bool(false), "privateUnpublishedEnabled": .bool(false),
      "engagementSchedulingEnabled": .bool(false), "mediaTransferEnabled": .bool(false),
      "automaticRetry": .bool(false), "automaticPagination": .bool(false),
      "rawToolsEnabled": .bool(false), "maxResults": .number(10),
      "accessExpiresAt": accessExpiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string)
        ?? .null,
      "secretStorage": .string("two-keychain-references"),
    ]
    let connection = MarketplaceProviderConnection(
      id: connectionId, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "tumblr-relay-owned-oauth:\(account):\(blogUUID)", providerName: "Tumblr",
      status: .connected, authorizationState: .completed,
      credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
      credentialRequirements: requirements, secretReferenceIds: [access.id, refresh.id],
      accountLabel: "@\(account) · \(blogTitle)", connectedHandle: "@\(blogName)",
      callbackURL: callback.absoluteString,
      requiredScopes: Self.tumblrRelayOwnedOAuthScopes,
      grantedScopes: Self.tumblrRelayOwnedOAuthScopes,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message: "Tumblr is ready for transient bounded reads from the selected owned blog.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: diagnostics, redactionStatus: "provider-content-not-stored"),
      senderIdentities: [], installPolicy: "bound_owned_blog_transient_published_reads",
      lastCheckedAt: timestamp, lastError: nil, manualEvidenceNote: nil,
      reauthorizeRequired: false, disconnecting: false, betaBlocked: false,
      createdAt: timestamp, updatedAt: timestamp,
      redactionStatus: "provider-content-not-stored")
    do { return try saveConnection(context: context, connection: connection) } catch {
      _ = try? secrets.delete(access.id)
      _ = try? secrets.delete(refresh.id)
      throw error
    }
  }

  @discardableResult
  public func rotateTumblrOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId,
    accessToken: String, refreshToken: String, accessExpiresAt: String?,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    tumblrTokenRotationLock.lock()
    defer { tumblrTokenRotationLock.unlock() }
    guard
      var connection = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      connection.appSlug == "tumblr", connection.credentialOwnership == .relayOwned,
      connection.grantedScopes == Self.tumblrRelayOwnedOAuthScopes,
      connection.health.diagnostics["accountVerified"]?.bool == true,
      connection.health.diagnostics["ownedBlogVerified"]?.bool == true
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "An exact bound Tumblr account and owned-blog connection is required.")
    }
    let oldIds = connection.secretReferenceIds
    let access = try secrets.set(
      scope: "provider_connection", scopeId: connection.id, label: "Tumblr OAuth access token",
      secretValue: try requireNonEmptyString(
        accessToken, field: "Tumblr access token", maxLength: 30000))
    let refresh: SecretReference
    do {
      refresh = try secrets.set(
        scope: "provider_connection", scopeId: connection.id, label: "Tumblr OAuth refresh token",
        secretValue: try requireNonEmptyString(
          refreshToken, field: "Tumblr refresh token", maxLength: 30000))
    } catch {
      _ = try? secrets.delete(access.id)
      throw error
    }
    connection.credentialRequirements = connection.credentialRequirements.map { value in
      var copy = value
      if copy.fieldKey == "tumblr_oauth_access_token" {
        copy.secretReferenceId = access.id
        copy.status = .verified
      }
      if copy.fieldKey == "tumblr_oauth_refresh_token" {
        copy.secretReferenceId = refresh.id
        copy.status = .verified
      }
      return copy
    }
    connection.secretReferenceIds = [access.id, refresh.id]
    connection.health.diagnostics["accessExpiresAt"] =
      accessExpiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null
    connection.status = .connected
    connection.health.state = .ready
    connection.health.message =
      "Tumblr access and refresh tokens were atomically replaced; account and blog bindings are unchanged."
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
  public func validateSavedTumblrConnection(
    context: ServiceRequestContext, connectionId: RelayId, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    guard
      var connection = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      connection.appSlug == "tumblr"
    else {
      throw ServiceGuard.invalidInput(context: context, message: "A Tumblr connection is required.")
    }
    let fields = ["tumblr_oauth_access_token", "tumblr_oauth_refresh_token"]
    let unreadable = fields.filter { field in
      let requirement = connection.credentialRequirements.first { $0.fieldKey == field }
      return requirement?.secretReferenceId.flatMap {
        (try? secrets.getSecretValue($0))?.providerConnectionNilIfEmpty
      } == nil
    }
    let exact =
      connection.credentialOwnership == .relayOwned
      && connection.requiredScopes == Self.tumblrRelayOwnedOAuthScopes
      && connection.grantedScopes == Self.tumblrRelayOwnedOAuthScopes
      && connection.health.diagnostics["apiOrigin"]?.string == "https://api.tumblr.com"
      && connection.health.diagnostics["railwayCallbackOnly"]?.bool == true
      && connection.health.diagnostics["accountVerified"]?.bool == true
      && connection.health.diagnostics["ownedBlogVerified"]?.bool == true
      && connection.health.diagnostics["selectedBlogUUID"]?.string?.hasPrefix("t:") == true
      && connection.health.diagnostics["publishedPostsOnly"]?.bool == true
      && connection.health.diagnostics["providerDataPersisted"]?.bool == false
      && connection.health.diagnostics["writesEnabled"]?.bool == false
      && connection.health.diagnostics["automaticPagination"]?.bool == false
      && connection.health.diagnostics["rawToolsEnabled"]?.bool == false
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    if !unreadable.isEmpty || !exact {
      connection.status = .authRequired
      connection.health.state = .error
      connection.health.message =
        unreadable.isEmpty
        ? "Tumblr scope, no-store, account, or owned-blog boundary changed; reconnect is required."
        : "Tumblr token reference is missing or unreadable; reconnect is required."
      connection.health.unavailableTools = [
        "relay_tumblr_get_account", "relay_tumblr_get_owned_blog",
        "relay_tumblr_list_owned_blog_recent_posts",
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
        "Tumblr tokens, exact scopes, no-store boundary, account, and selected owned blog are ready."
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
  public func recordTumblrAuthorizationFailure(
    context: ServiceRequestContext, connectionId: RelayId, providerCode: String,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    guard
      [
        "invalid_token", "refresh_expired", "permission_revoked", "account_access_lost",
        "blog_access_lost",
      ].contains(providerCode),
      var connection = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      connection.appSlug == "tumblr"
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "A supported Tumblr authorization failure is required.")
    }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    connection.status = .authRequired
    connection.health.state = .error
    connection.health.message =
      "Tumblr authorization or selected-blog access is no longer usable; reconnect the account."
    connection.health.diagnostics["authorizationFailureCode"] = .string(providerCode)
    connection.health.unavailableTools = [
      "relay_tumblr_get_account", "relay_tumblr_get_owned_blog",
      "relay_tumblr_list_owned_blog_recent_posts",
    ]
    connection.reauthorizeRequired = true
    connection.lastError =
      "tumblr_\(providerCode): Tumblr rejected the saved authorization or blog binding."
    connection.health.lastCheckedAt = timestamp
    connection.lastCheckedAt = timestamp
    connection.updatedAt = timestamp
    return try saveConnection(context: context, connection: connection)
  }

  @discardableResult
  public func saveMastodonRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId,
    clientSecret: String, accessToken: String, clientId: String,
    instanceOrigin: String, instanceDomain: String, softwareVersion: String,
    accountId: String, username: String, acct: String, displayName: String?, profileURL: String,
    maxStatusCharacters: Int, callbackURL: String, grantedScopes: [String],
    stateVerified: Bool, instanceVerified: Bool, issuerVerified: Bool,
    serverOriginRestricted: Bool, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "mastodon")
    let safeClientId = try requireNonEmptyString(
      clientId, field: "Mastodon client ID", maxLength: 512)
    let domain = try requireNonEmptyString(
      instanceDomain, field: "Mastodon instance domain", maxLength: 253
    ).lowercased()
    let version = try requireNonEmptyString(
      softwareVersion, field: "Mastodon software version", maxLength: 128)
    let boundAccountId = try requireNonEmptyString(
      accountId, field: "Mastodon account ID", maxLength: 256)
    let safeUsername = try requireNonEmptyString(
      username, field: "Mastodon username", maxLength: 128)
    let safeAcct = try requireNonEmptyString(acct, field: "Mastodon account handle", maxLength: 320)
    guard app.slug == "mastodon", grantedScopes == Self.mastodonRelayOwnedOAuthScopes,
      stateVerified, instanceVerified, issuerVerified, serverOriginRestricted,
      (1...500).contains(maxStatusCharacters),
      safeUsername.allSatisfy({ $0.isLetter || $0.isNumber || "_-".contains($0) }),
      let origin = URL(string: instanceOrigin), origin.scheme == "https",
      origin.host?.lowercased() == domain, origin.port == nil || origin.port == 443,
      origin.user == nil, origin.password == nil,
      origin.path.isEmpty || origin.path == "/", origin.query == nil, origin.fragment == nil,
      let profile = URL(string: profileURL), profile.scheme == "https",
      profile.host?.lowercased() == domain, profile.user == nil, profile.password == nil,
      let callback = URL(string: callbackURL), callback.scheme == "https",
      let callbackHost = callback.host?.lowercased(), !callbackHost.isEmpty,
      !["localhost", "localhost.localdomain", "127.0.0.1", "::1", "0.0.0.0"].contains(callbackHost),
      callback.path == "/api/v1/marketplace/oauth/mastodon/callback", callback.user == nil,
      callback.password == nil, callback.query == nil, callback.fragment == nil
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "Mastodon requires one verified public HTTPS instance, exact granular scopes, a bound local account, and the HTTPS Railway callback."
      )
    }
    try validateAppCanAuthorize(app, context: context)
    let connectionId = createRelayId("mpc")
    let client = try secrets.set(
      scope: "provider_connection", scopeId: connectionId,
      label: "Mastodon per-instance OAuth client secret",
      secretValue: try requireNonEmptyString(
        clientSecret, field: "Mastodon client secret", maxLength: 30000))
    let access: SecretReference
    do {
      access = try secrets.set(
        scope: "provider_connection", scopeId: connectionId,
        label: "Mastodon account access token",
        secretValue: try requireNonEmptyString(
          accessToken, field: "Mastodon access token", maxLength: 30000))
    } catch {
      _ = try? secrets.delete(client.id)
      throw error
    }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "mastodon_oauth_client_secret", label: "Per-instance OAuth client secret",
        required: true, userOwnedRequired: false, secretReferenceId: client.id,
        status: .verified,
        helpText: "Dynamically registered confidential-client secret stored only by reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "mastodon_oauth_access_token", label: "Mastodon account access token",
        required: true, userOwnedRequired: false, secretReferenceId: access.id,
        status: .verified,
        helpText: "Bound user token stored separately and revoked on disconnect.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "mastodon_connected_instance_account",
        label: "Verified instance and local account",
        required: true, userOwnedRequired: false, secretReferenceId: nil,
        status: .verified,
        helpText: "Exact server origin, issuer and local account were verified by Railway.",
        redactionStatus: "private-state-excluded"),
    ]
    let diagnostics: JSONRecord = [
      "apiOrigin": .string(
        origin.absoluteString.trimmingCharacters(in: CharacterSet(charactersIn: "/"))),
      "instanceDomain": .string(domain), "softwareVersion": .string(version),
      "authMethod": .string("per_instance_authorization_code"),
      "clientId": .string(safeClientId), "railwayCallbackOnly": .bool(true),
      "stateVerified": .bool(true), "instanceVerified": .bool(true),
      "issuerVerified": .bool(true), "serverOriginRestricted": .bool(true),
      "dnsRevalidationRequired": .bool(true), "redirectsAllowed": .bool(false),
      "ipLiteralOriginsAllowed": .bool(false),
      "accountVerified": .bool(true), "accountId": .string(boundAccountId),
      "username": .string(safeUsername), "acct": .string(safeAcct),
      "profileURL": .string(profile.absoluteString),
      "ownStatusesOnly": .bool(true), "providerDataPersisted": .bool(false),
      "writesTextOnly": .bool(true), "publicUnlistedOnly": .bool(true),
      "engagementMediaSchedulingEnabled": .bool(false),
      "destructiveAdminFederationEnabled": .bool(false),
      "automaticRetry": .bool(false), "automaticPagination": .bool(false),
      "rawToolsEnabled": .bool(false), "maxOwnStatuses": .number(10),
      "maxStatusCharacters": .number(Double(maxStatusCharacters)),
      "secretStorage": .string("two-keychain-references"),
    ]
    let label = displayName?.providerConnectionNilIfEmpty ?? safeAcct
    let connection = MarketplaceProviderConnection(
      id: connectionId, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "mastodon-relay-owned-oauth:\(domain):\(boundAccountId)",
      providerName: "Mastodon",
      status: .connected, authorizationState: .completed,
      credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
      credentialRequirements: requirements, secretReferenceIds: [client.id, access.id],
      accountLabel: "@\(safeAcct) · \(label)", connectedHandle: domain,
      callbackURL: callback.absoluteString,
      requiredScopes: Self.mastodonRelayOwnedOAuthScopes,
      grantedScopes: Self.mastodonRelayOwnedOAuthScopes,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message: "Mastodon is ready for bound-account reads and policy-controlled text publishing.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: diagnostics, redactionStatus: "provider-content-not-stored"),
      senderIdentities: [], installPolicy: "bound_instance_account_text_statuses",
      lastCheckedAt: timestamp, lastError: nil, manualEvidenceNote: nil,
      reauthorizeRequired: false, disconnecting: false, betaBlocked: false,
      createdAt: timestamp, updatedAt: timestamp,
      redactionStatus: "provider-content-not-stored")
    do { return try saveConnection(context: context, connection: connection) } catch {
      _ = try? secrets.delete(client.id)
      _ = try? secrets.delete(access.id)
      throw error
    }
  }

  @discardableResult
  public func replaceMastodonOAuthSecrets(
    context: ServiceRequestContext, connectionId: RelayId,
    clientSecret: String, accessToken: String, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    mastodonSecretReplacementLock.lock()
    defer { mastodonSecretReplacementLock.unlock() }
    guard
      var connection = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      connection.appSlug == "mastodon", connection.credentialOwnership == .relayOwned,
      connection.grantedScopes == Self.mastodonRelayOwnedOAuthScopes,
      connection.health.diagnostics["instanceVerified"]?.bool == true,
      connection.health.diagnostics["accountVerified"]?.bool == true
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "An exact bound Mastodon instance and account connection is required.")
    }
    let oldIds = connection.secretReferenceIds
    let client = try secrets.set(
      scope: "provider_connection", scopeId: connection.id,
      label: "Mastodon per-instance OAuth client secret",
      secretValue: try requireNonEmptyString(
        clientSecret, field: "Mastodon client secret", maxLength: 30000))
    let access: SecretReference
    do {
      access = try secrets.set(
        scope: "provider_connection", scopeId: connection.id,
        label: "Mastodon account access token",
        secretValue: try requireNonEmptyString(
          accessToken, field: "Mastodon access token", maxLength: 30000))
    } catch {
      _ = try? secrets.delete(client.id)
      throw error
    }
    connection.credentialRequirements = connection.credentialRequirements.map { value in
      var copy = value
      if copy.fieldKey == "mastodon_oauth_client_secret" {
        copy.secretReferenceId = client.id
        copy.status = .verified
      }
      if copy.fieldKey == "mastodon_oauth_access_token" {
        copy.secretReferenceId = access.id
        copy.status = .verified
      }
      return copy
    }
    connection.secretReferenceIds = [client.id, access.id]
    connection.status = .connected
    connection.health.state = .ready
    connection.health.message =
      "Mastodon client and account secrets were atomically replaced; instance and account bindings are unchanged."
    connection.reauthorizeRequired = false
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    connection.health.lastCheckedAt = timestamp
    connection.updatedAt = timestamp
    do {
      let saved = try saveConnection(context: context, connection: connection)
      for old in oldIds { _ = try? secrets.delete(old) }
      return saved
    } catch {
      _ = try? secrets.delete(client.id)
      _ = try? secrets.delete(access.id)
      throw error
    }
  }

  @discardableResult
  public func validateSavedMastodonConnection(
    context: ServiceRequestContext, connectionId: RelayId, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    guard
      var connection = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      connection.appSlug == "mastodon"
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "A Mastodon connection is required.")
    }
    let fields = ["mastodon_oauth_client_secret", "mastodon_oauth_access_token"]
    let unreadable = fields.filter { field in
      let requirement = connection.credentialRequirements.first { $0.fieldKey == field }
      return requirement?.secretReferenceId.flatMap {
        (try? secrets.getSecretValue($0))?.providerConnectionNilIfEmpty
      } == nil
    }
    let exact =
      connection.credentialOwnership == .relayOwned
      && connection.requiredScopes == Self.mastodonRelayOwnedOAuthScopes
      && connection.grantedScopes == Self.mastodonRelayOwnedOAuthScopes
      && connection.health.diagnostics["instanceVerified"]?.bool == true
      && connection.health.diagnostics["issuerVerified"]?.bool == true
      && connection.health.diagnostics["serverOriginRestricted"]?.bool == true
      && connection.health.diagnostics["accountVerified"]?.bool == true
      && connection.health.diagnostics["ownStatusesOnly"]?.bool == true
      && connection.health.diagnostics["providerDataPersisted"]?.bool == false
      && connection.health.diagnostics["writesTextOnly"]?.bool == true
      && connection.health.diagnostics["publicUnlistedOnly"]?.bool == true
      && connection.health.diagnostics["automaticPagination"]?.bool == false
      && connection.health.diagnostics["rawToolsEnabled"]?.bool == false
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    if !unreadable.isEmpty || !exact {
      connection.status = .authRequired
      connection.health.state = .error
      connection.health.message =
        unreadable.isEmpty
        ? "Mastodon scope, instance, account, or text-only boundary changed; reconnect is required."
        : "Mastodon client or account secret reference is missing or unreadable; reconnect is required."
      connection.health.unavailableTools = [
        "relay_mastodon_get_account", "relay_mastodon_list_own_statuses",
        "relay_mastodon_draft_text_status", "relay_mastodon_publish_text_status",
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
        "Mastodon secrets, exact scopes, verified instance and bound account are ready."
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
  public func recordMastodonAuthorizationFailure(
    context: ServiceRequestContext, connectionId: RelayId, providerCode: String,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    guard
      [
        "invalid_token", "permission_revoked", "account_access_lost", "instance_unavailable",
        "issuer_changed", "client_invalid",
      ].contains(providerCode),
      var connection = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      connection.appSlug == "mastodon"
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "A supported Mastodon authorization failure is required.")
    }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    connection.status = .authRequired
    connection.health.state = .error
    connection.health.message =
      "Mastodon authorization, instance identity, or account access is no longer usable; reconnect the server account."
    connection.health.diagnostics["authorizationFailureCode"] = .string(providerCode)
    connection.health.unavailableTools = [
      "relay_mastodon_get_account", "relay_mastodon_list_own_statuses",
      "relay_mastodon_draft_text_status", "relay_mastodon_publish_text_status",
    ]
    connection.reauthorizeRequired = true
    connection.lastError =
      "mastodon_\(providerCode): Mastodon rejected the saved authorization, client, instance, or account binding."
    connection.health.lastCheckedAt = timestamp
    connection.lastCheckedAt = timestamp
    connection.updatedAt = timestamp
    return try saveConnection(context: context, connection: connection)
  }

  @discardableResult
  public func saveBlueskyRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId,
    accessToken: String, refreshToken: String, dpopPrivateKey: String,
    did: String, handle: String, displayName: String?,
    pdsOrigin: String, authorizationIssuer: String, callbackURL: String,
    grantedScopes: [String], stateVerified: Bool, pkceVerified: Bool,
    parVerified: Bool, dpopBound: Bool, didVerified: Bool,
    pdsVerified: Bool, issuerVerified: Bool, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "bluesky")
    let boundDID = try requireNonEmptyString(did, field: "AT Protocol DID", maxLength: 2048)
    let accountHandle = try requireNonEmptyString(
      handle, field: "AT Protocol handle", maxLength: 253
    ).lowercased()
    guard app.slug == "bluesky", boundDID.hasPrefix("did:"),
      !boundDID.contains(where: { $0.isWhitespace }),
      accountHandle.contains("."), !accountHandle.contains(where: { $0.isWhitespace }),
      grantedScopes == Self.blueskyRelayOwnedOAuthScopes,
      stateVerified, pkceVerified, parVerified, dpopBound, didVerified, pdsVerified, issuerVerified,
      let pds = URL(string: pdsOrigin), pds.scheme == "https",
      pds.host?.providerConnectionNilIfEmpty != nil,
      pds.user == nil, pds.password == nil, pds.path.isEmpty || pds.path == "/",
      pds.query == nil, pds.fragment == nil,
      let issuer = URL(string: authorizationIssuer), issuer.scheme == "https",
      issuer.host?.providerConnectionNilIfEmpty != nil, issuer.user == nil, issuer.password == nil,
      issuer.query == nil, issuer.fragment == nil,
      let callback = URL(string: callbackURL), callback.scheme == "https",
      let callbackHost = callback.host?.lowercased(), !callbackHost.isEmpty,
      !["localhost", "localhost.localdomain", "127.0.0.1", "::1", "0.0.0.0"].contains(callbackHost),
      callback.path == "/api/v1/marketplace/oauth/bluesky/callback", callback.user == nil,
      callback.password == nil, callback.query == nil, callback.fragment == nil
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "Bluesky requires exact create-only scope, verified DID/PDS/issuer binding, DPoP, PAR, PKCE, and the HTTPS Railway callback."
      )
    }
    try validateAppCanAuthorize(app, context: context)
    let connectionId = createRelayId("mpc")
    let access = try secrets.set(
      scope: "provider_connection", scopeId: connectionId, label: "Bluesky OAuth access token",
      secretValue: try requireNonEmptyString(
        accessToken, field: "Bluesky access token", maxLength: 30000))
    let refresh: SecretReference
    do {
      refresh = try secrets.set(
        scope: "provider_connection", scopeId: connectionId, label: "Bluesky OAuth refresh token",
        secretValue: try requireNonEmptyString(
          refreshToken, field: "Bluesky refresh token", maxLength: 30000))
    } catch {
      _ = try? secrets.delete(access.id)
      throw error
    }
    let dpop: SecretReference
    do {
      dpop = try secrets.set(
        scope: "provider_connection", scopeId: connectionId, label: "Bluesky DPoP key",
        secretValue: try requireNonEmptyString(
          dpopPrivateKey, field: "Bluesky DPoP key", maxLength: 30000))
    } catch {
      _ = try? secrets.delete(access.id)
      _ = try? secrets.delete(refresh.id)
      throw error
    }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "bluesky_oauth_access_token", label: "Bluesky OAuth access token",
        required: true, userOwnedRequired: false, secretReferenceId: access.id,
        status: .verified,
        helpText: "Short-lived DPoP-bound token stored only by secret reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "bluesky_oauth_refresh_token", label: "Bluesky OAuth refresh token",
        required: true, userOwnedRequired: false, secretReferenceId: refresh.id,
        status: .verified, helpText: "Refresh token stored and rotated separately.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "bluesky_dpop_private_key", label: "Bluesky DPoP key",
        required: true, userOwnedRequired: false, secretReferenceId: dpop.id,
        status: .verified,
        helpText: "Proof-of-possession key material never leaves secret storage.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "bluesky_bound_identity", label: "Verified Bluesky identity and service binding",
        required: true, userOwnedRequired: false, secretReferenceId: nil,
        status: .verified,
        helpText: "DID, handle, PDS, and authorization issuer verified by Railway.",
        redactionStatus: "private-state-excluded"),
    ]
    let diagnostics: JSONRecord = [
      "authMethod": .string("atproto_authorization_code_refresh"),
      "railwayCallbackOnly": .bool(true), "stateVerified": .bool(true),
      "pkceVerified": .bool(true), "parVerified": .bool(true), "dpopBound": .bool(true),
      "didVerified": .bool(true), "did": .string(boundDID), "handle": .string(accountHandle),
      "pdsVerified": .bool(true),
      "pdsOrigin": .string(
        pds.absoluteString.trimmingCharacters(in: CharacterSet(charactersIn: "/"))),
      "issuerVerified": .bool(true), "authorizationIssuer": .string(issuer.absoluteString),
      "dnsRevalidationRequired": .bool(true), "ipLiteralOriginsAllowed": .bool(false),
      "redirectsAllowed": .bool(false), "ownOriginalPostsOnly": .bool(true),
      "providerDataPersisted": .bool(false), "textOnlyCreate": .bool(true),
      "automaticRetry": .bool(false), "automaticPagination": .bool(false),
      "rawToolsEnabled": .bool(false), "maxOwnPosts": .number(10),
      "maxPostGraphemes": .number(300), "secretStorage": .string("three-keychain-references"),
    ]
    let label = displayName?.providerConnectionNilIfEmpty ?? accountHandle
    let connection = MarketplaceProviderConnection(
      id: connectionId, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "bluesky-relay-owned-oauth:\(boundDID)", providerName: "Bluesky",
      status: .connected, authorizationState: .completed,
      credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
      credentialRequirements: requirements,
      secretReferenceIds: [access.id, refresh.id, dpop.id],
      accountLabel: label, connectedHandle: "@\(accountHandle) · \(boundDID)",
      callbackURL: callback.absoluteString,
      requiredScopes: Self.blueskyRelayOwnedOAuthScopes,
      grantedScopes: Self.blueskyRelayOwnedOAuthScopes,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message: "Bluesky is ready for bound-account reads and policy-controlled text publishing.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: diagnostics, redactionStatus: "provider-content-not-stored"),
      senderIdentities: [], installPolicy: "bound_did_original_posts_text_create",
      lastCheckedAt: timestamp, lastError: nil, manualEvidenceNote: nil,
      reauthorizeRequired: false, disconnecting: false, betaBlocked: false,
      createdAt: timestamp, updatedAt: timestamp,
      redactionStatus: "provider-content-not-stored")
    do { return try saveConnection(context: context, connection: connection) } catch {
      _ = try? secrets.delete(access.id)
      _ = try? secrets.delete(refresh.id)
      _ = try? secrets.delete(dpop.id)
      throw error
    }
  }

  @discardableResult
  public func replaceBlueskyOAuthSecrets(
    context: ServiceRequestContext, connectionId: RelayId,
    accessToken: String, refreshToken: String, dpopPrivateKey: String,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    blueskySecretReplacementLock.lock()
    defer { blueskySecretReplacementLock.unlock() }
    guard
      var connection = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      connection.appSlug == "bluesky", connection.credentialOwnership == .relayOwned,
      connection.grantedScopes == Self.blueskyRelayOwnedOAuthScopes,
      connection.health.diagnostics["didVerified"]?.bool == true,
      connection.health.diagnostics["pdsVerified"]?.bool == true,
      connection.health.diagnostics["issuerVerified"]?.bool == true,
      connection.health.diagnostics["dpopBound"]?.bool == true
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "An exact DID-bound Bluesky OAuth connection is required.")
    }
    let oldIds = connection.secretReferenceIds
    var created: [RelayId] = []
    func store(_ label: String, _ value: String, _ field: String) throws -> SecretReference {
      let reference = try secrets.set(
        scope: "provider_connection", scopeId: connection.id, label: label,
        secretValue: try requireNonEmptyString(value, field: field, maxLength: 30000))
      created.append(reference.id)
      return reference
    }
    do {
      let access = try store("Bluesky OAuth access token", accessToken, "Bluesky access token")
      let refresh = try store("Bluesky OAuth refresh token", refreshToken, "Bluesky refresh token")
      let dpop = try store("Bluesky DPoP key", dpopPrivateKey, "Bluesky DPoP key")
      connection.credentialRequirements = connection.credentialRequirements.map { value in
        var copy = value
        if copy.fieldKey == "bluesky_oauth_access_token" {
          copy.secretReferenceId = access.id
          copy.status = .verified
        }
        if copy.fieldKey == "bluesky_oauth_refresh_token" {
          copy.secretReferenceId = refresh.id
          copy.status = .verified
        }
        if copy.fieldKey == "bluesky_dpop_private_key" {
          copy.secretReferenceId = dpop.id
          copy.status = .verified
        }
        return copy
      }
      connection.secretReferenceIds = [access.id, refresh.id, dpop.id]
      connection.status = .connected
      connection.health.state = .ready
      connection.health.message =
        "Bluesky OAuth and DPoP secrets were atomically replaced; DID/PDS/issuer bindings are unchanged."
      connection.reauthorizeRequired = false
      let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
      connection.health.lastCheckedAt = timestamp
      connection.updatedAt = timestamp
      let saved = try saveConnection(context: context, connection: connection)
      for old in oldIds { _ = try? secrets.delete(old) }
      return saved
    } catch {
      for id in created { _ = try? secrets.delete(id) }
      throw error
    }
  }

  @discardableResult
  public func validateSavedBlueskyConnection(
    context: ServiceRequestContext, connectionId: RelayId, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    guard
      var connection = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      connection.appSlug == "bluesky"
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "A Bluesky connection is required.")
    }
    let fields = [
      "bluesky_oauth_access_token", "bluesky_oauth_refresh_token", "bluesky_dpop_private_key",
    ]
    let unreadable = fields.filter { field in
      let requirement = connection.credentialRequirements.first { $0.fieldKey == field }
      return requirement?.secretReferenceId.flatMap {
        (try? secrets.getSecretValue($0))?.providerConnectionNilIfEmpty
      } == nil
    }
    let exact =
      connection.credentialOwnership == .relayOwned
      && connection.requiredScopes == Self.blueskyRelayOwnedOAuthScopes
      && connection.grantedScopes == Self.blueskyRelayOwnedOAuthScopes
      && connection.health.diagnostics["stateVerified"]?.bool == true
      && connection.health.diagnostics["pkceVerified"]?.bool == true
      && connection.health.diagnostics["parVerified"]?.bool == true
      && connection.health.diagnostics["dpopBound"]?.bool == true
      && connection.health.diagnostics["didVerified"]?.bool == true
      && connection.health.diagnostics["pdsVerified"]?.bool == true
      && connection.health.diagnostics["issuerVerified"]?.bool == true
      && connection.health.diagnostics["ownOriginalPostsOnly"]?.bool == true
      && connection.health.diagnostics["textOnlyCreate"]?.bool == true
      && connection.health.diagnostics["automaticPagination"]?.bool == false
      && connection.health.diagnostics["rawToolsEnabled"]?.bool == false
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    if !unreadable.isEmpty || !exact {
      connection.status = .authRequired
      connection.health.state = .error
      connection.health.message =
        unreadable.isEmpty
        ? "Bluesky scope or DID/PDS/issuer/DPoP boundary changed; reconnect is required."
        : "Bluesky OAuth or DPoP secret reference is missing or unreadable; reconnect is required."
      connection.health.unavailableTools = [
        "relay_bluesky_get_profile", "relay_bluesky_list_own_posts",
        "relay_bluesky_draft_text_post", "relay_bluesky_publish_text_post",
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
        "Bluesky secret references and exact DID/PDS/issuer/DPoP binding are ready."
      connection.health.unavailableTools = []
      connection.health.diagnostics["unreadableSecretFields"] = .array([])
      connection.reauthorizeRequired = false
    }
    connection.health.lastCheckedAt = timestamp
    connection.lastCheckedAt = timestamp
    connection.updatedAt = timestamp
    return try saveConnection(context: context, connection: connection)
  }
}
