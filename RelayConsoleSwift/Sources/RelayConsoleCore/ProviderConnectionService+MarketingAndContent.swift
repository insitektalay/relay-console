import Foundation

extension ProviderConnectionService {
  @discardableResult public func saveKlaviyoRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    accountId: String, accountName: String?, accountTimezone: String?, accountCurrency: String?,
    accessExpiresAt: String?,
    grantedScopes: [String] = ProviderConnectionService.klaviyoRelayOwnedOAuthScopes,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "klaviyo")
    guard app.slug == "klaviyo" else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Klaviyo OAuth can only be saved for Klaviyo.")
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "Klaviyo OAuth access token", maxLength: 30000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "Klaviyo OAuth refresh token", maxLength: 30000)
    let account = try requireNonEmptyString(accountId, field: "Klaviyo account ID", maxLength: 64)
    guard Self.isSafeKlaviyoIdentifier(account), grantedScopes == Self.klaviyoRelayOwnedOAuthScopes
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "Klaviyo requires an exact token-bound Account ID and only accounts:read lists:read campaigns:read."
      )
    }
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let oldRefs = existing.map(Self.secretReferenceIds(in:)) ?? []
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Klaviyo OAuth access token",
      secretValue: access)
    let refreshRef: SecretReference
    do {
      refreshRef = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Klaviyo OAuth refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    let railway = ProcessInfo.processInfo.environment["CLAWCHAT_RAILWAY_ORIGIN"]?
      .providerConnectionNilIfEmpty?
      .trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    let callback = railway.map { $0 + "/api/v1/oauth/klaviyo/callback" }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let name = accountName?.providerConnectionNilIfEmpty.map { String($0.prefix(200)) }
    let timezone = accountTimezone?.providerConnectionNilIfEmpty.map { String($0.prefix(100)) }
    let currency = accountCurrency?.providerConnectionNilIfEmpty.map { String($0.prefix(16)) }
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "klaviyo_oauth_access_token", label: "Klaviyo OAuth access token", required: true,
        userOwnedRequired: false, secretReferenceId: accessRef.id, status: .verified,
        helpText: "Provider-expiring bearer token stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "klaviyo_oauth_refresh_token", label: "Klaviyo OAuth refresh token",
        required: true, userOwnedRequired: false, secretReferenceId: refreshRef.id,
        status: .verified,
        helpText:
          "Refresh token stored separately and replaced with the complete provider-returned pair.",
        redactionStatus: "secret-reference-only"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "klaviyo-relay-owned-oauth:" + account, providerName: "Klaviyo",
      status: .connected, authorizationState: .completed, credentialOwnership: .relayOwned,
      userOwnedCredentialsRequired: false, credentialRequirements: requirements,
      secretReferenceIds: [accessRef.id, refreshRef.id],
      accountLabel: name ?? "Klaviyo account " + String(account.suffix(8)),
      connectedHandle: String(account.suffix(8)), callbackURL: callback,
      requiredScopes: Self.klaviyoRelayOwnedOAuthScopes, grantedScopes: grantedScopes,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message:
          "Klaviyo OAuth references are ready for the exact token-bound Account and fixed API revision.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("klaviyo"),
          "authMethod": .string("oauth2_authorization_code_pkce_rotating_access_refresh_pair"),
          "relayOwnedKlaviyoOAuth": .bool(true), "accountId": .string(account),
          "accountName": name.map(JSONValue.string) ?? .null,
          "accountTimezone": timezone.map(JSONValue.string) ?? .null,
          "accountCurrency": currency.map(JSONValue.string) ?? .null,
          "apiOrigin": .string("https://a.klaviyo.com"), "apiRevision": .string("2026-04-15"),
          "pkceS256Required": .bool(true), "authorizationCodeLifetimeSeconds": .number(300),
          "accessExpiresAt": accessExpiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string)
            ?? .null,
          "providerExpiresInAuthoritative": .bool(true), "refreshIdleRevocationDays": .number(90),
          "refreshRequestsPerMinute": .number(10),
          "tokenPairReplacement": .string("serialized-atomic-provider-returned-pair-replacement"),
          "exactScopes": .array(Self.klaviyoRelayOwnedOAuthScopes.map(JSONValue.string)),
          "profileOrContactDataReturned": .bool(false), "campaignContentReturned": .bool(false),
          "automaticPaginationAllowed": .bool(false), "rateLimitHeadersAuthoritative": .bool(true),
          "requiresSecureWebBackend": .bool(true),
          "productionCallbackConfigured": .bool(callback != nil),
          "callbackTransport": .string("railway-https-only"),
          "rawTokenStoredInDatabase": .bool(false), "rawProviderToolExposure": .bool(false),
        ], redactionStatus: "profile-and-content-excluded"), senderIdentities: [],
      installPolicy: "approval_gated_klaviyo_metadata_reads", lastCheckedAt: timestamp,
      lastError: nil,
      manualEvidenceNote: callback == nil
        ? "Production Klaviyo OAuth requires CLAWCHAT_RAILWAY_ORIGIN, registered app/PKCE, deployed exchange/Account validation/serialized-refresh/revoke/disconnect broker and live acceptance."
        : nil, reauthorizeRequired: false, disconnecting: false, betaBlocked: false,
      createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp,
      redactionStatus: "profile-and-content-excluded")
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
  @discardableResult public func rotateKlaviyoOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String, accessExpiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    klaviyoTokenRotationLock.lock()
    defer { klaviyoTokenRotationLock.unlock() }
    guard
      let existing = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId), existing.appSlug == "klaviyo"
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "Klaviyo connection is required for complete token-pair replacement.")
    }
    let d = existing.health.diagnostics
    return try saveKlaviyoRelayOwnedOAuthConnection(
      context: context, appIdOrSlug: existing.appId, accessToken: accessToken,
      refreshToken: refreshToken, accountId: d["accountId"]?.string ?? "",
      accountName: d["accountName"]?.string, accountTimezone: d["accountTimezone"]?.string,
      accountCurrency: d["accountCurrency"]?.string, accessExpiresAt: accessExpiresAt,
      grantedScopes: existing.grantedScopes, now: now)
  }

  @discardableResult public func saveConvertKitRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    accountId: String, accountName: String?, planType: String?, accountCreatedAt: String?,
    accountTimezone: String?, accessExpiresAt: String?,
    grantedScopes: [String] = ProviderConnectionService.convertKitRelayOwnedOAuthScopes,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "convertkit")
    guard app.slug == "convertkit" else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Kit OAuth can only be saved for ConvertKit.")
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "Kit OAuth access token", maxLength: 30000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "Kit OAuth refresh token", maxLength: 30000)
    let account = try requireNonEmptyString(accountId, field: "Kit Account ID", maxLength: 20)
    guard Self.isSafeConvertKitAccountId(account),
      grantedScopes == Self.convertKitRelayOwnedOAuthScopes
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "Kit requires an exact numeric Account ID and only the current public scope.")
    }
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let oldRefs = existing.map(Self.secretReferenceIds(in:)) ?? []
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Kit OAuth access token",
      secretValue: access)
    let refreshRef: SecretReference
    do {
      refreshRef = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Kit OAuth refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    let railway = ProcessInfo.processInfo.environment["CLAWCHAT_RAILWAY_ORIGIN"]?
      .providerConnectionNilIfEmpty?
      .trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    let callback = railway.map { $0 + "/api/v1/oauth/convertkit/callback" }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let name = accountName?.providerConnectionNilIfEmpty.map { String($0.prefix(200)) }
    let plan = planType?.providerConnectionNilIfEmpty.map { String($0.prefix(64)) }
    let timezone = accountTimezone?.providerConnectionNilIfEmpty.map { String($0.prefix(100)) }
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "convertkit_oauth_access_token", label: "Kit OAuth access token", required: true,
        userOwnedRequired: false, secretReferenceId: accessRef.id, status: .verified,
        helpText: "Provider-expiring bearer token stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "convertkit_oauth_refresh_token", label: "Kit OAuth refresh token",
        required: true, userOwnedRequired: false, secretReferenceId: refreshRef.id,
        status: .verified,
        helpText: "Rotating refresh token replaced with the complete provider-returned pair.",
        redactionStatus: "secret-reference-only"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "convertkit-relay-owned-oauth:" + account, providerName: "Kit",
      status: .connected, authorizationState: .completed, credentialOwnership: .relayOwned,
      userOwnedCredentialsRequired: false, credentialRequirements: requirements,
      secretReferenceIds: [accessRef.id, refreshRef.id],
      accountLabel: name ?? "Kit Account " + account, connectedHandle: account,
      callbackURL: callback, requiredScopes: Self.convertKitRelayOwnedOAuthScopes,
      grantedScopes: grantedScopes, selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message: "Kit OAuth references are ready for the exact Creator Account and API v4.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("convertkit"), "providerBrand": .string("Kit"),
          "relayOwnedConvertKitOAuth": .bool(true), "accountId": .string(account),
          "accountName": name.map(JSONValue.string) ?? .null,
          "planType": plan.map(JSONValue.string) ?? .null,
          "accountCreatedAt": accountCreatedAt?.providerConnectionNilIfEmpty.map(JSONValue.string)
            ?? .null,
          "accountTimezone": timezone.map(JSONValue.string) ?? .null,
          "apiOrigin": .string("https://api.kit.com/v4"),
          "accessExpiresAt": accessExpiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string)
            ?? .null,
          "providerExpiresInAuthoritative": .bool(true),
          "tokenPairReplacement": .string("serialized-atomic-provider-returned-pair-replacement"),
          "exactScopes": .array(Self.convertKitRelayOwnedOAuthScopes.map(JSONValue.string)),
          "fineGrainedAPIScopesAvailable": .bool(false),
          "oauthRequestsPerRollingMinute": .number(600), "accountEmailsReturned": .bool(false),
          "subscriberDataReturned": .bool(false), "broadcastContentReturned": .bool(false),
          "automaticPaginationAllowed": .bool(false),
          "callbackTransport": .string("railway-https-only"),
          "rawTokenStoredInDatabase": .bool(false),
        ], redactionStatus: "subscriber-and-content-excluded"), senderIdentities: [],
      installPolicy: "approval_gated_convertkit_metadata_reads", lastCheckedAt: timestamp,
      lastError: nil,
      manualEvidenceNote: callback == nil
        ? "Production Kit OAuth requires CLAWCHAT_RAILWAY_ORIGIN, App Store review, deployed state/code exchange, Account validation, serialized refresh/revoke/disconnect and live acceptance."
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
  @discardableResult public func rotateConvertKitOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String, accessExpiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    convertKitTokenRotationLock.lock()
    defer { convertKitTokenRotationLock.unlock() }
    guard
      let existing = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      existing.appSlug == "convertkit"
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Kit connection is required for complete token-pair replacement."
      )
    }
    let d = existing.health.diagnostics
    return try saveConvertKitRelayOwnedOAuthConnection(
      context: context, appIdOrSlug: existing.appId, accessToken: accessToken,
      refreshToken: refreshToken, accountId: d["accountId"]?.string ?? "",
      accountName: d["accountName"]?.string, planType: d["planType"]?.string,
      accountCreatedAt: d["accountCreatedAt"]?.string,
      accountTimezone: d["accountTimezone"]?.string, accessExpiresAt: accessExpiresAt,
      grantedScopes: existing.grantedScopes, now: now)
  }

  @discardableResult public func saveCampaignMonitorRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    clientId: String, clientName: String, accessExpiresAt: String?,
    grantedScopes: [String] = ProviderConnectionService.campaignMonitorRelayOwnedOAuthScopes,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "campaign-monitor")
    guard app.slug == "campaign-monitor" else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Campaign Monitor OAuth can only be saved for Campaign Monitor.")
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "Campaign Monitor OAuth access token", maxLength: 30000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "Campaign Monitor OAuth refresh token", maxLength: 30000)
    let client = clientId.lowercased()
    let name = try requireNonEmptyString(
      clientName, field: "Campaign Monitor Client name", maxLength: 200)
    guard Self.isSafeCampaignMonitorId(client),
      grantedScopes == Self.campaignMonitorRelayOwnedOAuthScopes
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "Campaign Monitor requires one exact selected 32-hex Client and only ViewReports.")
    }
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let oldRefs = existing.map(Self.secretReferenceIds(in:)) ?? []
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Campaign Monitor OAuth access token",
      secretValue: access)
    let refreshRef: SecretReference
    do {
      refreshRef = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Campaign Monitor OAuth refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    let railway = ProcessInfo.processInfo.environment["CLAWCHAT_RAILWAY_ORIGIN"]?
      .providerConnectionNilIfEmpty?
      .trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    let callback = railway.map { $0 + "/api/v1/oauth/campaign-monitor/callback" }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "campaign_monitor_oauth_access_token",
        label: "Campaign Monitor OAuth access token", required: true, userOwnedRequired: false,
        secretReferenceId: accessRef.id, status: .verified,
        helpText: "Fourteen-day provider-expiring bearer token stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "campaign_monitor_oauth_refresh_token",
        label: "Campaign Monitor OAuth refresh token", required: true, userOwnedRequired: false,
        secretReferenceId: refreshRef.id, status: .verified,
        helpText: "Rotating refresh token replaced with the complete provider-returned pair.",
        redactionStatus: "secret-reference-only"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "campaign-monitor-relay-owned-oauth:" + client, providerName: "Campaign Monitor",
      status: .connected, authorizationState: .completed, credentialOwnership: .relayOwned,
      userOwnedCredentialsRequired: false, credentialRequirements: requirements,
      secretReferenceIds: [accessRef.id, refreshRef.id], accountLabel: name,
      connectedHandle: String(client.suffix(8)), callbackURL: callback,
      requiredScopes: Self.campaignMonitorRelayOwnedOAuthScopes, grantedScopes: grantedScopes,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message:
          "Campaign Monitor OAuth references are ready for the exact selected Client and ViewReports.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("campaign-monitor"), "relayOwnedCampaignMonitorOAuth": .bool(true),
          "clientId": .string(client), "clientName": .string(name),
          "apiOrigin": .string("https://api.createsend.com/api/v3.3"),
          "accessExpiresAt": accessExpiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string)
            ?? .null,
          "documentedAccessLifetimeSeconds": .number(1_209_600),
          "providerExpiresInAuthoritative": .bool(true),
          "tokenPairReplacement": .string("serialized-atomic-provider-returned-pair-replacement"),
          "exactScopes": .array(Self.campaignMonitorRelayOwnedOAuthScopes.map(JSONValue.string)),
          "subscriberDataReturned": .bool(false), "campaignContentReturned": .bool(false),
          "subscriberDrilldownsAllowed": .bool(false), "automaticPaginationAllowed": .bool(false),
          "callbackTransport": .string("railway-https-only"),
          "rawTokenStoredInDatabase": .bool(false),
        ], redactionStatus: "subscriber-and-content-excluded"), senderIdentities: [],
      installPolicy: "approval_gated_campaign_monitor_reports", lastCheckedAt: timestamp,
      lastError: nil,
      manualEvidenceNote: callback == nil
        ? "Production Campaign Monitor requires CLAWCHAT_RAILWAY_ORIGIN, registered OAuth app, selected-Client validation, deployed exchange/serialized-refresh/revoke/disconnect and live acceptance."
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
  @discardableResult public func rotateCampaignMonitorOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String, accessExpiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    campaignMonitorTokenRotationLock.lock()
    defer { campaignMonitorTokenRotationLock.unlock() }
    guard
      let existing = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      existing.appSlug == "campaign-monitor"
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "Campaign Monitor connection is required for complete token-pair replacement.")
    }
    let d = existing.health.diagnostics
    return try saveCampaignMonitorRelayOwnedOAuthConnection(
      context: context, appIdOrSlug: existing.appId, accessToken: accessToken,
      refreshToken: refreshToken, clientId: d["clientId"]?.string ?? "",
      clientName: d["clientName"]?.string ?? "", accessExpiresAt: accessExpiresAt,
      grantedScopes: existing.grantedScopes, now: now)
  }

  @discardableResult
  public func saveConstantContactRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    encodedAccountId: String, organizationName: String, grantedPrivileges: [String],
    accessExpiresAt: String?,
    grantedScopes: [String] = ProviderConnectionService.constantContactRelayOwnedOAuthScopes,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "constant-contact")
    guard app.slug == "constant-contact" else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Constant Contact OAuth can only be saved for Constant Contact.")
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "Constant Contact OAuth access token", maxLength: 30000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "Constant Contact OAuth refresh token", maxLength: 30000)
    let accountId = encodedAccountId.trimmingCharacters(in: .whitespacesAndNewlines)
    let accountName = try requireNonEmptyString(
      organizationName, field: "Constant Contact organization name", maxLength: 200)
    let missingPrivileges = Self.constantContactRequiredPrivileges.filter {
      !grantedPrivileges.contains($0)
    }
    guard ConstantContactSupport.safeAccountId(accountId),
      grantedScopes == Self.constantContactRelayOwnedOAuthScopes, missingPrivileges.isEmpty
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "Constant Contact requires one exact encoded Account, exact account_read campaign_data offline_access scopes, and account/report privileges."
      )
    }
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let oldRefs = existing.map(Self.secretReferenceIds(in:)) ?? []
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Constant Contact OAuth access token",
      secretValue: access)
    let refreshRef: SecretReference
    do {
      refreshRef = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Constant Contact OAuth refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    let railway = ProcessInfo.processInfo.environment["CLAWCHAT_RAILWAY_ORIGIN"]?
      .providerConnectionNilIfEmpty?
      .trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    let callback = railway.map { $0 + "/api/v1/oauth/constant-contact/callback" }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "constant_contact_oauth_access_token",
        label: "Constant Contact OAuth access token", required: true, userOwnedRequired: false,
        secretReferenceId: accessRef.id, status: .verified,
        helpText: "Provider-expiring JWT access token stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "constant_contact_oauth_refresh_token",
        label: "Constant Contact OAuth refresh token", required: true, userOwnedRequired: false,
        secretReferenceId: refreshRef.id, status: .verified,
        helpText:
          "Provider-returned refresh token replaced with the complete pair after near-expiry refresh.",
        redactionStatus: "secret-reference-only"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "constant-contact-relay-owned-oauth:" + accountId,
      providerName: "Constant Contact",
      status: .connected, authorizationState: .completed, credentialOwnership: .relayOwned,
      userOwnedCredentialsRequired: false, credentialRequirements: requirements,
      secretReferenceIds: [accessRef.id, refreshRef.id],
      accountLabel: accountName, connectedHandle: String(accountId.suffix(8)),
      callbackURL: callback,
      requiredScopes: Self.constantContactRelayOwnedOAuthScopes, grantedScopes: grantedScopes,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message:
          "Constant Contact OAuth references, exact Account, scopes and report privileges are ready.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("constant-contact"), "relayOwnedConstantContactOAuth": .bool(true),
          "encodedAccountId": .string(accountId),
          "organizationName": .string(accountName), "apiOrigin": .string("https://api.cc.email/v3"),
          "authorizationOrigin": .string("https://authz.constantcontact.com/oauth2/default/v1"),
          "accessExpiresAt": accessExpiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string)
            ?? .null,
          "documentedAccessLifetimeSeconds": .number(86400),
          "unusedRefreshTokenMaximumAgeDays": .number(180),
          "refreshOnlyNearExpiry": .bool(true),
          "tokenPairReplacement": .string("serialized-atomic-provider-returned-pair-replacement"),
          "exactScopes": .array(Self.constantContactRelayOwnedOAuthScopes.map(JSONValue.string)),
          "verifiedPrivileges": .array(grantedPrivileges.sorted().map(JSONValue.string)),
          "requiredPrivilegesVerified": .bool(true),
          "contactDataScopeRequested": .bool(false), "contactDataReturned": .bool(false),
          "campaignContentReturned": .bool(false),
          "personLevelTrackingAllowed": .bool(false), "automaticPaginationAllowed": .bool(false),
          "callbackTransport": .string("railway-https-only"),
          "rawTokenStoredInDatabase": .bool(false),
        ], redactionStatus: "contact-and-content-excluded"),
      senderIdentities: [], installPolicy: "approval_gated_constant_contact_campaign_reports",
      lastCheckedAt: timestamp,
      lastError: nil,
      manualEvidenceNote: callback == nil
        ? "Production Constant Contact requires CLAWCHAT_RAILWAY_ORIGIN, registered V3 app, deployed state/code exchange, exact Account/privilege validation, serialized refresh/revoke/disconnect and live acceptance."
        : nil,
      reauthorizeRequired: false, disconnecting: false, betaBlocked: false,
      createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp,
      redactionStatus: "contact-and-content-excluded"
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
  public func rotateConstantContactOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String, accessExpiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    constantContactTokenRotationLock.lock()
    defer { constantContactTokenRotationLock.unlock() }
    guard
      let existing = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      existing.appSlug == "constant-contact"
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "Constant Contact connection is required for complete token-pair replacement.")
    }
    let diagnostics = existing.health.diagnostics
    let privileges: [String]
    if case .array(let values)? = diagnostics["verifiedPrivileges"] {
      privileges = values.compactMap(\.string)
    } else {
      privileges = []
    }
    return try saveConstantContactRelayOwnedOAuthConnection(
      context: context, appIdOrSlug: existing.appId, accessToken: accessToken,
      refreshToken: refreshToken, encodedAccountId: diagnostics["encodedAccountId"]?.string ?? "",
      organizationName: diagnostics["organizationName"]?.string ?? existing.accountLabel ?? "",
      grantedPrivileges: privileges, accessExpiresAt: accessExpiresAt,
      grantedScopes: existing.grantedScopes, now: now)
  }

  @discardableResult
  public func saveWebflowRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String,
    authorizedSiteIds: [String], authorizedSiteNames: [String] = [], workspaceNames: [String] = [],
    accountLabel: String?,
    grantedScopes: [String] = ProviderConnectionService.webflowRelayOwnedOAuthScopes,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "webflow")
    guard app.slug == "webflow" else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "Webflow OAuth can only be saved for the Webflow Marketplace app.")
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "Webflow OAuth access token", maxLength: 20000)
    let scopes = grantedScopes.isEmpty ? Self.webflowRelayOwnedOAuthScopes : grantedScopes
    let missing = Self.webflowRelayOwnedOAuthScopes.filter { !scopes.contains($0) }
    let ready = missing.isEmpty
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let oldRefs = existing.map(Self.secretReferenceIds(in:)) ?? []
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Webflow OAuth access token",
      secretValue: access)
    let railwayOrigin = ProcessInfo.processInfo.environment["CLAWCHAT_RAILWAY_ORIGIN"]?
      .providerConnectionNilIfEmpty?
      .trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    let callback = railwayOrigin.map { $0 + "/api/v1/oauth/webflow/callback" }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let sites = authorizedSiteIds.compactMap(\.providerConnectionNilIfEmpty)
    let names = authorizedSiteNames.compactMap(\.providerConnectionNilIfEmpty)
    let workspaces = workspaceNames.compactMap(\.providerConnectionNilIfEmpty)
    let label =
      accountLabel?.providerConnectionNilIfEmpty ?? names.first ?? workspaces.first
      ?? "Webflow App grant"
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "webflow_oauth_access_token", label: "Webflow OAuth access token", required: true,
        userOwnedRequired: false, secretReferenceId: accessRef.id, status: .verified,
        helpText:
          "Current non-refreshable Webflow App access token stored as a Keychain reference and replaced only by reauthorization.",
        redactionStatus: "secret-reference-only")
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "webflow-relay-owned-oauth:" + (sites.first ?? id), providerName: "Webflow",
      status: ready ? .connected : .authRequired,
      authorizationState: ready ? .completed : .manualEvidenceRequired,
      credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
      credentialRequirements: requirements, secretReferenceIds: [accessRef.id], accountLabel: label,
      connectedHandle: sites.first ?? workspaces.first, callbackURL: callback,
      requiredScopes: Self.webflowRelayOwnedOAuthScopes, grantedScopes: scopes,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: ready ? .ready : .degraded,
        message: ready
          ? "Webflow App access-token reference is ready; Data API v2 calls remain brokered by Relay."
          : "Webflow OAuth is missing scopes: " + missing.joined(separator: ", "),
        lastCheckedAt: timestamp, missingScopes: missing,
        unavailableTools: ready
          ? []
          : [
            "webflow.site.list", "webflow.collection.get", "webflow.item.update",
            "webflow.item.publish",
          ],
        diagnostics: [
          "provider": .string("webflow"),
          "authMethod": .string("webflow_relay_owned_oauth2_authorization_code_non_refreshable"),
          "relayOwnedWebflowOAuth": .bool(true),
          "secretStorage": .string("keychain-reference-only"), "refreshSupported": .bool(false),
          "reauthorizationReplacesAccessToken": .bool(true),
          "requiresSecureWebBackend": .bool(true),
          "productionCallbackConfigured": .bool(callback != nil),
          "callbackTransport": .string("railway-https-only"),
          "authorizedSiteIds": .array(sites.map(JSONValue.string)),
          "authorizedSiteNames": .array(names.map(JSONValue.string)),
          "authorizedWorkspaceNames": .array(workspaces.map(JSONValue.string)),
          "stagedUpdatesOnly": .bool(true), "explicitItemPublishOnly": .bool(true),
          "fullSitePublishSupported": .bool(false), "rawTokenStoredInDatabase": .bool(false),
          "rawProviderToolExposure": .bool(false),
        ], redactionStatus: "private-state-excluded"), senderIdentities: [],
      installPolicy: "approval_gated_webflow_staged_item_writes", lastCheckedAt: timestamp,
      lastError: ready ? nil : "Missing Webflow scopes: " + missing.joined(separator: ", "),
      manualEvidenceNote: callback == nil
        ? "Production Webflow consent requires CLAWCHAT_RAILWAY_ORIGIN and a deployed HTTPS callback broker."
        : nil, reauthorizeRequired: !ready, disconnecting: false, betaBlocked: false,
      createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp,
      redactionStatus: "private-state-excluded")
    do {
      let saved = try saveConnection(context: context, connection: connection)
      for ref in oldRefs where !saved.secretReferenceIds.contains(ref) {
        _ = try? secrets.delete(ref)
      }
      return saved
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
  }

  @discardableResult
  public func saveWordPressComRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, blogId: String,
    blogURL: String?, blogName: String?,
    grantedScopes: [String] = ProviderConnectionService.wordpressComRelayOwnedOAuthScopes,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "wordpress-com")
    guard app.slug == "wordpress-com" else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "WordPress.com OAuth can only be saved for the WordPress.com Marketplace app.")
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "WordPress.com OAuth access token", maxLength: 20000)
    let siteId = try requireNonEmptyString(blogId, field: "WordPress.com blog ID", maxLength: 100)
    let scopes = grantedScopes.isEmpty ? Self.wordpressComRelayOwnedOAuthScopes : grantedScopes
    let missing = Self.wordpressComRelayOwnedOAuthScopes.filter { !scopes.contains($0) }
    let ready = missing.isEmpty
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let oldRefs = existing.map(Self.secretReferenceIds(in:)) ?? []
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "WordPress.com OAuth access token",
      secretValue: access)
    let railwayOrigin = ProcessInfo.processInfo.environment["CLAWCHAT_RAILWAY_ORIGIN"]?
      .providerConnectionNilIfEmpty?
      .trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    let callback = railwayOrigin.map { $0 + "/api/v1/oauth/wordpress-com/callback" }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let label =
      blogName?.providerConnectionNilIfEmpty ?? blogURL?.providerConnectionNilIfEmpty
      ?? "WordPress.com site " + siteId
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "wordpress_com_oauth_access_token", label: "WordPress.com OAuth access token",
        required: true, userOwnedRequired: false, secretReferenceId: accessRef.id,
        status: .verified,
        helpText:
          "Current WordPress.com server-side OAuth access token stored as one Keychain reference and replaced by reauthorization.",
        redactionStatus: "secret-reference-only")
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "wordpress-com-relay-owned-oauth:" + siteId, providerName: "WordPress.com",
      status: ready ? .connected : .authRequired,
      authorizationState: ready ? .completed : .manualEvidenceRequired,
      credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
      credentialRequirements: requirements, secretReferenceIds: [accessRef.id], accountLabel: label,
      connectedHandle: siteId, callbackURL: callback,
      requiredScopes: Self.wordpressComRelayOwnedOAuthScopes, grantedScopes: scopes,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: ready ? .ready : .degraded,
        message: ready
          ? "WordPress.com single-blog OAuth access reference is ready; REST v1.1 calls remain brokered by Relay."
          : "WordPress.com OAuth is missing scopes: " + missing.joined(separator: ", "),
        lastCheckedAt: timestamp, missingScopes: missing,
        unavailableTools: ready
          ? []
          : [
            "wordpress_com.site.get", "wordpress_com.post.list", "wordpress_com.post.create_draft",
            "wordpress_com.post.publish",
          ],
        diagnostics: [
          "provider": .string("wordpress-com"),
          "authMethod": .string(
            "wordpress_com_relay_owned_oauth2_authorization_code_non_refreshable"),
          "relayOwnedWordPressComOAuth": .bool(true),
          "secretStorage": .string("keychain-reference-only"), "refreshSupported": .bool(false),
          "reauthorizationReplacesAccessToken": .bool(true),
          "requiresSecureWebBackend": .bool(true),
          "productionCallbackConfigured": .bool(callback != nil),
          "callbackTransport": .string("railway-https-only"), "blogId": .string(siteId),
          "blogURL": blogURL?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
          "blogName": blogName?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
          "singleBlogGrant": .bool(true), "globalScopeAllowed": .bool(false),
          "draftFirstWrites": .bool(true), "staleModifiedPrecondition": .bool(true),
          "rawTokenStoredInDatabase": .bool(false), "rawProviderToolExposure": .bool(false),
        ], redactionStatus: "private-state-excluded"), senderIdentities: [],
      installPolicy: "approval_gated_wordpress_com_draft_writes", lastCheckedAt: timestamp,
      lastError: ready ? nil : "Missing WordPress.com scopes: " + missing.joined(separator: ", "),
      manualEvidenceNote: callback == nil
        ? "Production WordPress.com consent requires CLAWCHAT_RAILWAY_ORIGIN and a deployed HTTPS callback broker."
        : nil, reauthorizeRequired: !ready, disconnecting: false, betaBlocked: false,
      createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp,
      redactionStatus: "private-state-excluded")
    do {
      let saved = try saveConnection(context: context, connection: connection)
      for ref in oldRefs where !saved.secretReferenceIds.contains(ref) {
        _ = try? secrets.delete(ref)
      }
      return saved
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
  }

  @discardableResult
  public func saveContentfulRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String,
    authorizedSpaceIds: [String], authorizedSpaceNames: [String] = [],
    authorizedEnvironmentIds: [String], organizationNames: [String] = [],
    cmaHost: String = "https://api.contentful.com", accountLabel: String?,
    grantedScopes: [String] = ProviderConnectionService.contentfulRelayOwnedOAuthScopes,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "contentful")
    guard app.slug == "contentful" else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "Contentful OAuth can only be saved for the Contentful Marketplace app.")
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "Contentful OAuth access token", maxLength: 20000)
    let spaces = authorizedSpaceIds.compactMap(\.providerConnectionNilIfEmpty)
    let envs = authorizedEnvironmentIds.compactMap(\.providerConnectionNilIfEmpty)
    guard !spaces.isEmpty, !envs.isEmpty else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "At least one authorized Contentful space and environment are required.")
    }
    guard ["https://api.contentful.com", "https://api.eu.contentful.com"].contains(cmaHost) else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Contentful CMA host must be the documented US or EU endpoint.")
    }
    let scopes = grantedScopes.isEmpty ? Self.contentfulRelayOwnedOAuthScopes : grantedScopes
    let missing = Self.contentfulRelayOwnedOAuthScopes.filter { !scopes.contains($0) }
    let ready = missing.isEmpty
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let oldRefs = existing.map(Self.secretReferenceIds(in:)) ?? []
    let ref = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Contentful OAuth access token",
      secretValue: access)
    let origin = ProcessInfo.processInfo.environment["CLAWCHAT_RAILWAY_ORIGIN"]?
      .providerConnectionNilIfEmpty?
      .trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    let callback = origin.map { $0 + "/api/v1/oauth/contentful/callback" }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let names = authorizedSpaceNames.compactMap(\.providerConnectionNilIfEmpty)
    let orgs = organizationNames.compactMap(\.providerConnectionNilIfEmpty)
    let label = accountLabel?.providerConnectionNilIfEmpty ?? names.first ?? "Contentful space"
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "contentful_oauth_access_token", label: "Contentful CMA OAuth access token",
        required: true, userOwnedRequired: false, secretReferenceId: ref.id, status: .verified,
        helpText:
          "Contentful CMA OAuth access token stored as one Keychain reference and replaced by reauthorization.",
        redactionStatus: "secret-reference-only")
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "contentful-relay-owned-oauth:" + (spaces.first ?? id),
      providerName: "Contentful", status: ready ? .connected : .authRequired,
      authorizationState: ready ? .completed : .manualEvidenceRequired,
      credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
      credentialRequirements: requirements, secretReferenceIds: [ref.id], accountLabel: label,
      connectedHandle: spaces.first, callbackURL: callback,
      requiredScopes: Self.contentfulRelayOwnedOAuthScopes, grantedScopes: scopes,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: ready ? .ready : .degraded,
        message: ready
          ? "Contentful CMA OAuth reference is ready and constrained to explicit spaces/environments."
          : "Contentful OAuth is missing content_management_manage.", lastCheckedAt: timestamp,
        missingScopes: missing,
        unavailableTools: ready
          ? []
          : [
            "contentful.space.list", "contentful.content_type.get", "contentful.entry.update_draft",
            "contentful.entry.publish",
          ],
        diagnostics: [
          "provider": .string("contentful"),
          "authMethod": .string("contentful_relay_owned_oauth2_confidential_cma"),
          "relayOwnedContentfulOAuth": .bool(true),
          "secretStorage": .string("keychain-reference-only"), "refreshSupported": .bool(false),
          "reauthorizationReplacesAccessToken": .bool(true),
          "requiresSecureWebBackend": .bool(true),
          "productionCallbackConfigured": .bool(callback != nil),
          "callbackTransport": .string("railway-https-only"),
          "authorizedSpaceIds": .array(spaces.map(JSONValue.string)),
          "authorizedSpaceNames": .array(names.map(JSONValue.string)),
          "authorizedEnvironmentIds": .array(envs.map(JSONValue.string)),
          "organizationNames": .array(orgs.map(JSONValue.string)), "cmaHost": .string(cmaHost),
          "coarseManageScopeConstrained": .bool(true), "completeFieldsRequired": .bool(true),
          "versionHeaderRequired": .bool(true), "rawTokenStoredInDatabase": .bool(false),
          "rawProviderToolExposure": .bool(false),
        ], redactionStatus: "private-state-excluded"), senderIdentities: [],
      installPolicy: "approval_gated_contentful_versioned_entry_writes", lastCheckedAt: timestamp,
      lastError: ready ? nil : "Missing Contentful scope: content_management_manage",
      manualEvidenceNote: callback == nil
        ? "Production Contentful consent requires CLAWCHAT_RAILWAY_ORIGIN and a deployed HTTPS callback broker."
        : nil, reauthorizeRequired: !ready, disconnecting: false, betaBlocked: false,
      createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp,
      redactionStatus: "private-state-excluded")
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
}
