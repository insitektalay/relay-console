import Foundation

extension ProviderConnectionService {
  @discardableResult
  public func saveHubSpotRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    hubId: Int64, userId: Int64, hubDomain: String?, accessExpiresInSeconds: Int?,
    grantedScopes: [String] = ProviderConnectionService.hubSpotRelayOwnedOAuthScopes,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "hubspot")
    guard app.slug == "hubspot" else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "HubSpot OAuth can only be saved for the HubSpot Marketplace app.")
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "HubSpot OAuth access token", maxLength: 20000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "HubSpot OAuth refresh token", maxLength: 20000)
    guard hubId > 0, userId > 0 else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "HubSpot requires positive numeric Hub ID and user ID token metadata.")
    }
    let scopes = grantedScopes
    let missing = Self.hubSpotRelayOwnedOAuthScopes.filter { !scopes.contains($0) }
    let extras = scopes.filter { !Self.hubSpotRelayOwnedOAuthScopes.contains($0) }
    guard extras.isEmpty else {
      throw ServiceGuard.invalidInput(
        context: context, message: "HubSpot V1 rejects scopes beyond oauth and Company/Deal reads.")
    }
    let ready = missing.isEmpty
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let oldRefs = existing.map(Self.secretReferenceIds(in:)) ?? []
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "HubSpot OAuth access token",
      secretValue: access)
    let refreshRef: SecretReference
    do {
      refreshRef = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "HubSpot OAuth refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    let origin = ProcessInfo.processInfo.environment["CLAWCHAT_RAILWAY_ORIGIN"]?
      .providerConnectionNilIfEmpty?
      .trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    let callback = origin.map { $0 + "/api/v1/oauth/hubspot/callback" }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let label = hubDomain?.providerConnectionNilIfEmpty ?? "HubSpot account \(hubId)"
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "hubspot_oauth_access_token", label: "HubSpot OAuth access token", required: true,
        userOwnedRequired: false, secretReferenceId: accessRef.id, status: .verified,
        helpText: "Short-lived response-expiring Bearer token stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "hubspot_oauth_refresh_token", label: "HubSpot OAuth refresh token",
        required: true, userOwnedRequired: false, secretReferenceId: refreshRef.id,
        status: .verified,
        helpText:
          "Current refresh token stored separately and atomically replaced with each returned pair.",
        redactionStatus: "secret-reference-only"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "hubspot-relay-owned-oauth:\(hubId):\(userId)", providerName: "HubSpot",
      status: ready ? .connected : .authRequired,
      authorizationState: ready ? .completed : .manualEvidenceRequired,
      credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
      credentialRequirements: requirements, secretReferenceIds: [accessRef.id, refreshRef.id],
      accountLabel: label, connectedHandle: String(hubId), callbackURL: callback,
      requiredScopes: Self.hubSpotRelayOwnedOAuthScopes, grantedScopes: scopes,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: ready ? .ready : .degraded,
        message: ready
          ? "HubSpot OAuth references are ready for the exact account-wide Company/Deal read boundary."
          : "HubSpot OAuth scopes are incomplete.", lastCheckedAt: timestamp,
        missingScopes: missing,
        unavailableTools: ready
          ? [] : ["hubspot.company.list", "hubspot.deal.list", "hubspot.deal.get"],
        diagnostics: [
          "provider": .string("hubspot"),
          "authMethod": .string("oauth2_authorization_code_2026_03"),
          "relayOwnedHubSpotOAuth": .bool(true), "readOnlyV1": .bool(true),
          "hubId": .number(Double(hubId)), "userId": .number(Double(userId)),
          "hubDomain": hubDomain?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
          "accessExpiresInSeconds": accessExpiresInSeconds.map { .number(Double($0)) } ?? .null,
          "tokenRotation": .string("serialized-atomic-newest-two-reference-replacement"),
          "accountWideScopeConstrained": .bool(true), "recordWritesAllowed": .bool(false),
          "contactPIIReturned": .bool(false), "arbitrarySearchAllowed": .bool(false),
          "oauthAPIVersion": .string("2026-03"),
          "crmAPIVersion": .string(LiveHubSpotProviderActionClient.apiDateVersion),
          "requiresSecureWebBackend": .bool(true),
          "productionCallbackConfigured": .bool(callback != nil),
          "callbackTransport": .string("railway-https-only"),
          "rawTokenStoredInDatabase": .bool(false), "rawProviderToolExposure": .bool(false),
        ], redactionStatus: "private-state-excluded"), senderIdentities: [],
      installPolicy: "approval_gated_hubspot_company_deal_reads", lastCheckedAt: timestamp,
      lastError: ready ? nil : "HubSpot scope mismatch",
      manualEvidenceNote: callback == nil
        ? "Production HubSpot OAuth requires CLAWCHAT_RAILWAY_ORIGIN and a deployed HTTPS 2026-03 token/introspection/revocation broker."
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
      _ = try? secrets.delete(refreshRef.id)
      throw error
    }
  }

  @discardableResult public func rotateHubSpotOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String, accessExpiresInSeconds: Int?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    hubSpotTokenRotationLock.lock()
    defer { hubSpotTokenRotationLock.unlock() }
    guard
      let existing = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId), existing.appSlug == "hubspot"
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "HubSpot connection is required for token rotation.")
    }
    let d = existing.health.diagnostics
    return try saveHubSpotRelayOwnedOAuthConnection(
      context: context, appIdOrSlug: existing.appId, accessToken: accessToken,
      refreshToken: refreshToken, hubId: Int64(d["hubId"]?.number ?? 0),
      userId: Int64(d["userId"]?.number ?? 0), hubDomain: existing.accountLabel,
      accessExpiresInSeconds: accessExpiresInSeconds, grantedScopes: existing.grantedScopes,
      now: now)
  }

  @discardableResult
  public func savePipedriveRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    userId: Int64, companyId: Int64, companyName: String?, apiDomain: String,
    accessExpiresInSeconds: Int?,
    grantedScopes: [String] = ProviderConnectionService.pipedriveRelayOwnedOAuthScopes,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "pipedrive")
    guard app.slug == "pipedrive" else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "Pipedrive OAuth can only be saved for the Pipedrive Marketplace app.")
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "Pipedrive OAuth access token", maxLength: 30000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "Pipedrive OAuth refresh token", maxLength: 20000)
    guard userId > 0, companyId > 0,
      let domain = PipedriveProviderActionSupport.apiDomain(apiDomain)
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "Pipedrive requires positive user/company IDs and an exact HTTPS pipedrive.com API domain."
      )
    }
    let scopes = grantedScopes
    let missing = Self.pipedriveRelayOwnedOAuthScopes.filter { !scopes.contains($0) }
    let extras = scopes.filter { !Self.pipedriveRelayOwnedOAuthScopes.contains($0) }
    guard extras.isEmpty else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "Pipedrive V1 rejects scopes beyond base, contacts:read, and deals:read.")
    }
    let ready = missing.isEmpty
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let oldRefs = existing.map(Self.secretReferenceIds(in:)) ?? []
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Pipedrive OAuth access token",
      secretValue: access)
    let refreshRef: SecretReference
    do {
      refreshRef = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Pipedrive OAuth refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    let origin = ProcessInfo.processInfo.environment["CLAWCHAT_RAILWAY_ORIGIN"]?
      .providerConnectionNilIfEmpty?
      .trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    let callback = origin.map { $0 + "/api/v1/marketplace/oauth/pipedrive/callback" }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let label = companyName?.providerConnectionNilIfEmpty ?? "Pipedrive company \(companyId)"
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "pipedrive_oauth_access_token", label: "Pipedrive OAuth access token",
        required: true, userOwnedRequired: false, secretReferenceId: accessRef.id,
        status: .verified,
        helpText: "Response-expiring access token stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "pipedrive_oauth_refresh_token", label: "Pipedrive OAuth refresh token",
        required: true, userOwnedRequired: false, secretReferenceId: refreshRef.id,
        status: .verified,
        helpText:
          "Current refresh token stored separately and atomically replaced with every returned pair.",
        redactionStatus: "secret-reference-only"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "pipedrive-relay-owned-oauth:\(companyId):\(userId)", providerName: "Pipedrive",
      status: ready ? .connected : .authRequired,
      authorizationState: ready ? .completed : .manualEvidenceRequired,
      credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
      credentialRequirements: requirements, secretReferenceIds: [accessRef.id, refreshRef.id],
      accountLabel: label, connectedHandle: String(companyId), callbackURL: callback,
      requiredScopes: Self.pipedriveRelayOwnedOAuthScopes, grantedScopes: scopes,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: ready ? .ready : .degraded,
        message: ready
          ? "Pipedrive OAuth references are ready for the exact company-domain Organization/Deal read boundary."
          : "Pipedrive OAuth scopes are incomplete.", lastCheckedAt: timestamp,
        missingScopes: missing,
        unavailableTools: ready
          ? [] : ["pipedrive.organization.list", "pipedrive.deal.list", "pipedrive.deal.get"],
        diagnostics: [
          "provider": .string("pipedrive"),
          "authMethod": .string("oauth2_authorization_code_rotating_pair"),
          "relayOwnedPipedriveOAuth": .bool(true), "readOnlyV1": .bool(true),
          "userId": .number(Double(userId)), "companyId": .number(Double(companyId)),
          "companyName": companyName?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
          "apiDomain": .string(domain.absoluteString),
          "accessExpiresInSeconds": accessExpiresInSeconds.map { .number(Double($0)) } ?? .null,
          "tokenRotation": .string("serialized-atomic-newest-two-reference-replacement"),
          "broadReadScopesConstrained": .bool(true), "recordWritesAllowed": .bool(false),
          "personPIIReturned": .bool(false), "arbitrarySearchAllowed": .bool(false),
          "apiVersion": .string("v2"), "requiresSecureWebBackend": .bool(true),
          "productionCallbackConfigured": .bool(callback != nil),
          "callbackTransport": .string("railway-https-only"),
          "rawTokenStoredInDatabase": .bool(false), "rawProviderToolExposure": .bool(false),
        ], redactionStatus: "private-state-excluded"), senderIdentities: [],
      installPolicy: "approval_gated_pipedrive_organization_deal_reads", lastCheckedAt: timestamp,
      lastError: ready ? nil : "Pipedrive scope mismatch",
      manualEvidenceNote: callback == nil
        ? "Production Pipedrive OAuth requires CLAWCHAT_RAILWAY_ORIGIN and a deployed HTTPS refresh/revocation/uninstall broker."
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
      _ = try? secrets.delete(refreshRef.id)
      throw error
    }
  }

  @discardableResult public func rotatePipedriveOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String, accessExpiresInSeconds: Int?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    pipedriveTokenRotationLock.lock()
    defer { pipedriveTokenRotationLock.unlock() }
    guard
      let existing = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      existing.appSlug == "pipedrive"
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Pipedrive connection is required for token rotation.")
    }
    let d = existing.health.diagnostics
    return try savePipedriveRelayOwnedOAuthConnection(
      context: context, appIdOrSlug: existing.appId, accessToken: accessToken,
      refreshToken: refreshToken, userId: Int64(d["userId"]?.number ?? 0),
      companyId: Int64(d["companyId"]?.number ?? 0), companyName: existing.accountLabel,
      apiDomain: d["apiDomain"]?.string ?? "", accessExpiresInSeconds: accessExpiresInSeconds,
      grantedScopes: existing.grantedScopes, now: now)
  }

  @discardableResult
  public func saveCopperRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, accountId: Int64,
    accountName: String, primaryTimezone: String?,
    grantedScopes: [String] = ProviderConnectionService.copperRelayOwnedOAuthScopes,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "copper")
    guard app.slug == "copper" else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Copper OAuth can only be saved for the Copper Marketplace app.")
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "Copper OAuth access token", maxLength: 30000)
    let name = try requireNonEmptyString(accountName, field: "Copper account name", maxLength: 256)
    guard accountId > 0 else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "Copper requires a positive token-bound Account ID from GET /account.")
    }
    let scopes = grantedScopes
    let missing = Self.copperRelayOwnedOAuthScopes.filter { !scopes.contains($0) }
    let extras = scopes.filter { !Self.copperRelayOwnedOAuthScopes.contains($0) }
    guard extras.isEmpty else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "Copper V1 accepts only developer/v1/all; no additional or invented scopes are allowed.")
    }
    let ready = missing.isEmpty
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let oldRefs = existing.map(Self.secretReferenceIds(in:)) ?? []
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Copper OAuth access token",
      secretValue: access)
    let origin = ProcessInfo.processInfo.environment["CLAWCHAT_RAILWAY_ORIGIN"]?
      .providerConnectionNilIfEmpty?
      .trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    let callback = origin.map { $0 + "/api/v1/oauth/copper/callback" }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "copper_oauth_access_token", label: "Copper OAuth access token", required: true,
        userOwnedRequired: false, secretReferenceId: accessRef.id, status: .verified,
        helpText: "Currently non-expiring Bearer token stored as one Keychain reference.",
        redactionStatus: "secret-reference-only")
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "copper-relay-owned-oauth:\(accountId)", providerName: "Copper",
      status: ready ? .connected : .authRequired,
      authorizationState: ready ? .completed : .manualEvidenceRequired,
      credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
      credentialRequirements: requirements, secretReferenceIds: [accessRef.id], accountLabel: name,
      connectedHandle: String(accountId), callbackURL: callback,
      requiredScopes: Self.copperRelayOwnedOAuthScopes, grantedScopes: scopes,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: ready ? .ready : .degraded,
        message: ready
          ? "Copper OAuth reference is ready for the exact Account/Opportunity read boundary."
          : "Copper OAuth scope is missing.", lastCheckedAt: timestamp, missingScopes: missing,
        unavailableTools: ready
          ? [] : ["copper.account.get", "copper.opportunity.list", "copper.opportunity.get"],
        diagnostics: [
          "provider": .string("copper"),
          "authMethod": .string("oauth2_authorization_code_non_expiring_bearer"),
          "relayOwnedCopperOAuth": .bool(true), "readOnlyV1": .bool(true),
          "accountId": .number(Double(accountId)), "accountName": .string(name),
          "primaryTimezone": primaryTimezone?.providerConnectionNilIfEmpty.map(JSONValue.string)
            ?? .null,
          "tokenExpiry": .string("currently-non-expiring-until-revoked"),
          "refreshSupported": .bool(false), "providerScopeIsBroadReadWrite": .bool(true),
          "broadScopeConstrained": .bool(true), "recordWritesAllowed": .bool(false),
          "contactPIIReturned": .bool(false), "arbitrarySearchAllowed": .bool(false),
          "apiOrigin": .string("https://api.copper.com/developer_api/v1"),
          "requiresSecureWebBackend": .bool(true),
          "productionCallbackConfigured": .bool(callback != nil),
          "callbackTransport": .string("railway-https-post-only"),
          "rawTokenStoredInDatabase": .bool(false), "rawProviderToolExposure": .bool(false),
        ], redactionStatus: "private-state-excluded"), senderIdentities: [],
      installPolicy: "approval_gated_copper_account_opportunity_reads", lastCheckedAt: timestamp,
      lastError: ready ? nil : "Copper scope mismatch",
      manualEvidenceNote: callback == nil
        ? "Production Copper OAuth requires CLAWCHAT_RAILWAY_ORIGIN and a deployed HTTPS POST callback/token/revocation/disconnect broker."
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
  public func saveCloseRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    organizationId: String, userId: String, organizationName: String, accessExpiresInSeconds: Int?,
    grantedScopes: [String] = ProviderConnectionService.closeRelayOwnedOAuthScopes,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "close")
    guard app.slug == "close" else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Close OAuth can only be saved for the Close Marketplace app.")
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "Close OAuth access token", maxLength: 30000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "Close OAuth refresh token", maxLength: 30000)
    let name = try requireNonEmptyString(
      organizationName, field: "Close Organization name", maxLength: 256)
    guard CloseProviderActionSupport.validId(organizationId, prefix: "orga_"),
      CloseProviderActionSupport.validId(userId, prefix: "user_")
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "Close requires exact token-bound orga_ Organization and user_ IDs.")
    }
    let scopes = grantedScopes
    let missing = Self.closeRelayOwnedOAuthScopes.filter { !scopes.contains($0) }
    let extras = scopes.filter { !Self.closeRelayOwnedOAuthScopes.contains($0) }
    guard extras.isEmpty else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Close V1 accepts only all.full_access and offline_access.")
    }
    let ready = missing.isEmpty
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let oldRefs = existing.map(Self.secretReferenceIds(in:)) ?? []
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Close OAuth access token",
      secretValue: access)
    let refreshRef: SecretReference
    do {
      refreshRef = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Close OAuth refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    let origin = ProcessInfo.processInfo.environment["CLAWCHAT_RAILWAY_ORIGIN"]?
      .providerConnectionNilIfEmpty?
      .trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    let callback = origin.map { $0 + "/api/v1/oauth/close/callback" }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "close_oauth_access_token", label: "Close OAuth access token", required: true,
        userOwnedRequired: false, secretReferenceId: accessRef.id, status: .verified,
        helpText: "Short-lived Bearer token stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "close_oauth_refresh_token", label: "Close OAuth refresh token", required: true,
        userOwnedRequired: false, secretReferenceId: refreshRef.id, status: .verified,
        helpText:
          "Single-use refresh token stored separately and atomically replaced with every returned pair.",
        redactionStatus: "secret-reference-only"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "close-relay-owned-oauth:\(organizationId):\(userId)", providerName: "Close",
      status: ready ? .connected : .authRequired,
      authorizationState: ready ? .completed : .manualEvidenceRequired,
      credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
      credentialRequirements: requirements, secretReferenceIds: [accessRef.id, refreshRef.id],
      accountLabel: name, connectedHandle: organizationId, callbackURL: callback,
      requiredScopes: Self.closeRelayOwnedOAuthScopes, grantedScopes: scopes,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: ready ? .ready : .degraded,
        message: ready
          ? "Close OAuth references are ready for the exact Organization/Opportunity read boundary."
          : "Close OAuth scopes are incomplete.", lastCheckedAt: timestamp, missingScopes: missing,
        unavailableTools: ready
          ? [] : ["close.organization.get", "close.opportunity.list", "close.opportunity.get"],
        diagnostics: [
          "provider": .string("close"),
          "authMethod": .string("oauth2_authorization_code_single_use_refresh_pair"),
          "relayOwnedCloseOAuth": .bool(true), "readOnlyV1": .bool(true),
          "organizationId": .string(organizationId), "userId": .string(userId),
          "organizationName": .string(name),
          "accessExpiresInSeconds": accessExpiresInSeconds.map { .number(Double($0)) } ?? .null,
          "tokenRotation": .string("serialized-atomic-single-use-refresh-pair-replacement"),
          "providerScopeIsBroadFullAccess": .bool(true), "broadScopeConstrained": .bool(true),
          "recordWritesAllowed": .bool(false), "contactPIIReturned": .bool(false),
          "arbitrarySearchAllowed": .bool(false),
          "apiOrigin": .string("https://api.close.com/api/v1"),
          "requiresSecureWebBackend": .bool(true),
          "productionCallbackConfigured": .bool(callback != nil),
          "callbackTransport": .string("railway-https-only"),
          "rawTokenStoredInDatabase": .bool(false), "rawProviderToolExposure": .bool(false),
        ], redactionStatus: "private-state-excluded"), senderIdentities: [],
      installPolicy: "approval_gated_close_organization_opportunity_reads",
      lastCheckedAt: timestamp, lastError: ready ? nil : "Close scope mismatch",
      manualEvidenceNote: callback == nil
        ? "Production Close OAuth requires CLAWCHAT_RAILWAY_ORIGIN and a deployed HTTPS serialized refresh/revoke/disconnect broker."
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
      _ = try? secrets.delete(refreshRef.id)
      throw error
    }
  }

  @discardableResult public func rotateCloseOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String, accessExpiresInSeconds: Int?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    closeTokenRotationLock.lock()
    defer { closeTokenRotationLock.unlock() }
    guard
      let existing = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId), existing.appSlug == "close"
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Close connection is required for token rotation.")
    }
    let d = existing.health.diagnostics
    return try saveCloseRelayOwnedOAuthConnection(
      context: context, appIdOrSlug: existing.appId, accessToken: accessToken,
      refreshToken: refreshToken, organizationId: d["organizationId"]?.string ?? "",
      userId: d["userId"]?.string ?? "",
      organizationName: existing.accountLabel ?? "Close Organization",
      accessExpiresInSeconds: accessExpiresInSeconds, grantedScopes: existing.grantedScopes,
      now: now)
  }

  @discardableResult
  public func saveZendeskRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    subdomain: String, accountLabel: String?, userId: Int64, accessExpiresInSeconds: Int?,
    refreshExpiresInSeconds: Int?,
    grantedScopes: [String] = ProviderConnectionService.zendeskRelayOwnedOAuthScopes,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "zendesk")
    guard app.slug == "zendesk" else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "Zendesk OAuth can only be saved for the Zendesk Marketplace app.")
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "Zendesk OAuth access token", maxLength: 30000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "Zendesk OAuth refresh token", maxLength: 30000)
    let normalized = subdomain.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
    let rawOrigin =
      normalized.hasPrefix("https://") ? normalized : "https://\(normalized).zendesk.com"
    guard userId > 0, let originURL = ZendeskProviderActionSupport.instanceOrigin(rawOrigin),
      let host = originURL.host
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "Zendesk requires a positive user ID and one exact public HTTPS Zendesk Support subdomain."
      )
    }
    let scopes = grantedScopes
    let missing = Self.zendeskRelayOwnedOAuthScopes.filter { !scopes.contains($0) }
    let extras = scopes.filter { !Self.zendeskRelayOwnedOAuthScopes.contains($0) }
    guard extras.isEmpty else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Zendesk V1 accepts only tickets:read.")
    }
    let ready = missing.isEmpty
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let oldRefs = existing.map(Self.secretReferenceIds(in:)) ?? []
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Zendesk OAuth access token",
      secretValue: access)
    let refreshRef: SecretReference
    do {
      refreshRef = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Zendesk OAuth refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    let railway = ProcessInfo.processInfo.environment["CLAWCHAT_RAILWAY_ORIGIN"]?
      .providerConnectionNilIfEmpty?
      .trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    let callback = railway.map { $0 + "/api/v1/oauth/zendesk/callback" }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let label = accountLabel?.providerConnectionNilIfEmpty ?? host
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "zendesk_oauth_access_token", label: "Zendesk OAuth access token", required: true,
        userOwnedRequired: false, secretReferenceId: accessRef.id, status: .verified,
        helpText: "Expiring global OAuth Bearer token stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "zendesk_oauth_refresh_token", label: "Zendesk OAuth refresh token",
        required: true, userOwnedRequired: false, secretReferenceId: refreshRef.id,
        status: .verified,
        helpText: "Current refresh token stored separately and atomically replaced during refresh.",
        redactionStatus: "secret-reference-only"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "zendesk-relay-owned-global-oauth:\(host):\(userId)", providerName: "Zendesk",
      status: ready ? .connected : .authRequired,
      authorizationState: ready ? .completed : .manualEvidenceRequired,
      credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
      credentialRequirements: requirements, secretReferenceIds: [accessRef.id, refreshRef.id],
      accountLabel: label, connectedHandle: host, callbackURL: callback,
      requiredScopes: Self.zendeskRelayOwnedOAuthScopes, grantedScopes: scopes,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: ready ? .ready : .degraded,
        message: ready
          ? "Zendesk global OAuth references are ready for the exact Support-instance ticket read boundary."
          : "Zendesk tickets:read scope is missing.", lastCheckedAt: timestamp,
        missingScopes: missing,
        unavailableTools: ready
          ? [] : ["zendesk.ticket.count", "zendesk.ticket.list", "zendesk.ticket.get"],
        diagnostics: [
          "provider": .string("zendesk"),
          "authMethod": .string("global_oauth_expiring_access_refresh_pair"),
          "relayOwnedZendeskGlobalOAuth": .bool(true), "readOnlyV1": .bool(true),
          "instanceOrigin": .string(originURL.absoluteString),
          "subdomain": .string(String(host.dropLast(".zendesk.com".count))),
          "userId": .number(Double(userId)),
          "accessExpiresInSeconds": accessExpiresInSeconds.map { .number(Double($0)) } ?? .null,
          "refreshExpiresInSeconds": refreshExpiresInSeconds.map { .number(Double($0)) } ?? .null,
          "tokenRotation": .string("serialized-atomic-expiring-pair-replacement"),
          "globalOAuthClientRequired": .bool(true), "recordWritesAllowed": .bool(false),
          "customerPIIReturned": .bool(false), "arbitrarySearchAllowed": .bool(false),
          "apiVersion": .string("v2"), "requiresSecureWebBackend": .bool(true),
          "productionCallbackConfigured": .bool(callback != nil),
          "callbackTransport": .string("railway-https-only"),
          "rawTokenStoredInDatabase": .bool(false), "rawProviderToolExposure": .bool(false),
        ], redactionStatus: "private-state-excluded"), senderIdentities: [],
      installPolicy: "approval_gated_zendesk_ticket_reads", lastCheckedAt: timestamp,
      lastError: ready ? nil : "Zendesk scope mismatch",
      manualEvidenceNote: callback == nil
        ? "Production Zendesk global OAuth requires CLAWCHAT_RAILWAY_ORIGIN and a deployed refresh/revoke/disconnect broker."
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
      _ = try? secrets.delete(refreshRef.id)
      throw error
    }
  }

  @discardableResult public func rotateZendeskOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String, accessExpiresInSeconds: Int?, refreshExpiresInSeconds: Int?,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    zendeskTokenRotationLock.lock()
    defer { zendeskTokenRotationLock.unlock() }
    guard
      let existing = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId), existing.appSlug == "zendesk"
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Zendesk connection is required for token rotation.")
    }
    let d = existing.health.diagnostics
    return try saveZendeskRelayOwnedOAuthConnection(
      context: context, appIdOrSlug: existing.appId, accessToken: accessToken,
      refreshToken: refreshToken, subdomain: d["instanceOrigin"]?.string ?? "",
      accountLabel: existing.accountLabel, userId: Int64(d["userId"]?.number ?? 0),
      accessExpiresInSeconds: accessExpiresInSeconds,
      refreshExpiresInSeconds: refreshExpiresInSeconds, grantedScopes: existing.grantedScopes,
      now: now)
  }

  @discardableResult
  public func saveIntercomRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, workspaceId: String,
    workspaceName: String, adminId: String, adminEmailVerified: Bool, region: String,
    accountLabel: String?,
    grantedScopes: [String] = ProviderConnectionService.intercomRelayOwnedOAuthScopes,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "intercom")
    guard app.slug == "intercom" else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "Intercom OAuth can only be saved for the Intercom Marketplace app.")
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "Intercom OAuth access token", maxLength: 30000)
    let exactWorkspaceId = try requireNonEmptyString(
      workspaceId, field: "Intercom workspace ID", maxLength: 256)
    let exactWorkspaceName = try requireNonEmptyString(
      workspaceName, field: "Intercom workspace name", maxLength: 256)
    let exactAdminId = try requireNonEmptyString(adminId, field: "Intercom Admin ID", maxLength: 64)
    guard exactAdminId.allSatisfy(\.isNumber), adminEmailVerified,
      let apiOrigin = IntercomProviderActionSupport.apiOrigin(region: region)
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "Intercom requires a numeric Admin ID with verified email and a documented US, EU, or AU workspace region."
      )
    }
    let scopes = grantedScopes
    let missing = Self.intercomRelayOwnedOAuthScopes.filter { !scopes.contains($0) }
    let extras = scopes.filter { !Self.intercomRelayOwnedOAuthScopes.contains($0) }
    guard extras.isEmpty else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "Intercom V1 accepts only Read conversations and Read admins permissions.")
    }
    let ready = missing.isEmpty
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let oldRefs = existing.map(Self.secretReferenceIds(in:)) ?? []
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Intercom OAuth access token",
      secretValue: access)
    let railway = ProcessInfo.processInfo.environment["CLAWCHAT_RAILWAY_ORIGIN"]?
      .providerConnectionNilIfEmpty?
      .trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    let callback = railway.map { $0 + "/api/v1/oauth/intercom/callback" }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let label = accountLabel?.providerConnectionNilIfEmpty ?? exactWorkspaceName
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "intercom_oauth_access_token", label: "Intercom OAuth access token",
        required: true, userOwnedRequired: false, secretReferenceId: accessRef.id,
        status: .verified,
        helpText: "Single revocable public-app OAuth Bearer token stored as a Keychain reference.",
        redactionStatus: "secret-reference-only")
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "intercom-relay-owned-public-oauth:\(exactWorkspaceId):\(exactAdminId)",
      providerName: "Intercom", status: ready ? .connected : .authRequired,
      authorizationState: ready ? .completed : .manualEvidenceRequired,
      credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
      credentialRequirements: requirements, secretReferenceIds: [accessRef.id], accountLabel: label,
      connectedHandle: exactWorkspaceId, callbackURL: callback,
      requiredScopes: Self.intercomRelayOwnedOAuthScopes, grantedScopes: scopes,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: ready ? .ready : .degraded,
        message: ready
          ? "Intercom OAuth reference is ready for the exact workspace conversation-metadata read boundary."
          : "Intercom read permissions are incomplete.", lastCheckedAt: timestamp,
        missingScopes: missing,
        unavailableTools: ready
          ? []
          : [
            "intercom.conversation.count", "intercom.conversation.list",
            "intercom.conversation.get",
          ],
        diagnostics: [
          "provider": .string("intercom"),
          "authMethod": .string("public_app_oauth_single_revocable_access_token"),
          "relayOwnedIntercomOAuth": .bool(true), "readOnlyV1": .bool(true),
          "workspaceId": .string(exactWorkspaceId), "workspaceName": .string(exactWorkspaceName),
          "adminId": .string(exactAdminId), "adminEmailVerified": .bool(true),
          "region": .string(region.uppercased()), "apiOrigin": .string(apiOrigin.absoluteString),
          "apiVersion": .string("2.15"), "refreshSupported": .bool(false),
          "tokenReplacement": .string("reauthorization-replaces-single-access-reference"),
          "publicAppReviewRequired": .bool(true), "conversationWritesAllowed": .bool(false),
          "messageContentReturned": .bool(false), "contactOrAdminPIIReturned": .bool(false),
          "arbitrarySearchAllowed": .bool(false), "requiresSecureWebBackend": .bool(true),
          "productionCallbackConfigured": .bool(callback != nil),
          "callbackTransport": .string("railway-https-post-only"),
          "rawTokenStoredInDatabase": .bool(false), "rawProviderToolExposure": .bool(false),
        ], redactionStatus: "private-state-excluded"), senderIdentities: [],
      installPolicy: "approval_gated_intercom_conversation_metadata_reads",
      lastCheckedAt: timestamp, lastError: ready ? nil : "Intercom permission mismatch",
      manualEvidenceNote: callback == nil
        ? "Production Intercom OAuth requires CLAWCHAT_RAILWAY_ORIGIN and a deployed HTTPS exchange/revoke/uninstall/disconnect broker."
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
  public func saveHelpScoutRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    companyId: Int64, userId: Int64, userRole: String, accountLabel: String?,
    accessExpiresInSeconds: Int? = 172800,
    grantedScopes: [String] = ProviderConnectionService.helpScoutOAuthPermissions,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "help-scout")
    guard app.slug == "help-scout" else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "Help Scout OAuth can only be saved for the Help Scout Marketplace app.")
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "Help Scout OAuth access token", maxLength: 30000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "Help Scout OAuth refresh token", maxLength: 30000)
    let role = try requireNonEmptyString(userRole, field: "Help Scout user role", maxLength: 64)
      .lowercased()
    guard companyId > 0, userId > 0, ["owner", "admin", "user", "light user"].contains(role),
      grantedScopes.isEmpty
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "Help Scout requires positive company/user IDs, a documented active user role, and no invented OAuth scopes."
      )
    }
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let oldRefs = existing.map(Self.secretReferenceIds(in:)) ?? []
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Help Scout OAuth access token",
      secretValue: access)
    let refreshRef: SecretReference
    do {
      refreshRef = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Help Scout OAuth refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    let railway = ProcessInfo.processInfo.environment["CLAWCHAT_RAILWAY_ORIGIN"]?
      .providerConnectionNilIfEmpty?
      .trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    let callback = railway.map { $0 + "/api/v1/oauth/help-scout/callback" }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let label = accountLabel?.providerConnectionNilIfEmpty ?? "Help Scout company \(companyId)"
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "help_scout_oauth_access_token", label: "Help Scout OAuth access token",
        required: true, userOwnedRequired: false, secretReferenceId: accessRef.id,
        status: .verified, helpText: "48-hour bearer token stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "help_scout_oauth_refresh_token", label: "Help Scout OAuth refresh token",
        required: true, userOwnedRequired: false, secretReferenceId: refreshRef.id,
        status: .verified,
        helpText:
          "Rotating refresh token stored separately and atomically replaced with each returned pair.",
        redactionStatus: "secret-reference-only"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "help-scout-relay-owned-oauth:\(companyId):\(userId)",
      providerName: "Help Scout", status: .connected, authorizationState: .completed,
      credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
      credentialRequirements: requirements, secretReferenceIds: [accessRef.id, refreshRef.id],
      accountLabel: label, connectedHandle: String(companyId), callbackURL: callback,
      requiredScopes: [], grantedScopes: [], selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message:
          "Help Scout OAuth references are ready for the exact company Conversation-metadata boundary.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("help-scout"),
          "authMethod": .string("oauth2_authorization_code_rotating_access_refresh_pair"),
          "relayOwnedHelpScoutOAuth": .bool(true), "readOnlyV1": .bool(true),
          "companyId": .number(Double(companyId)), "userId": .number(Double(userId)),
          "userRole": .string(role),
          "accessExpiresInSeconds": accessExpiresInSeconds.map { .number(Double($0)) } ?? .null,
          "tokenRotation": .string("serialized-atomic-refresh-pair-replacement"),
          "oauthScopesDocumented": .bool(false), "inventedScopesAccepted": .bool(false),
          "conversationWritesAllowed": .bool(false), "threadContentReturned": .bool(false),
          "identityPIIReturned": .bool(false), "arbitrarySearchAllowed": .bool(false),
          "apiOrigin": .string("https://api.helpscout.net/v2"), "apiVersion": .string("v2"),
          "requiresSecureWebBackend": .bool(true),
          "productionCallbackConfigured": .bool(callback != nil),
          "callbackTransport": .string("railway-https-only"),
          "rawTokenStoredInDatabase": .bool(false), "rawProviderToolExposure": .bool(false),
        ], redactionStatus: "private-state-excluded"), senderIdentities: [],
      installPolicy: "approval_gated_help_scout_conversation_metadata_reads",
      lastCheckedAt: timestamp, lastError: nil,
      manualEvidenceNote: callback == nil
        ? "Production Help Scout OAuth requires CLAWCHAT_RAILWAY_ORIGIN and a deployed serialized refresh/disconnect broker."
        : nil, reauthorizeRequired: false, disconnecting: false, betaBlocked: false,
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
      _ = try? secrets.delete(refreshRef.id)
      throw error
    }
  }

  @discardableResult public func rotateHelpScoutOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String, accessExpiresInSeconds: Int? = 172800, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    helpScoutTokenRotationLock.lock()
    defer { helpScoutTokenRotationLock.unlock() }
    guard
      let existing = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      existing.appSlug == "help-scout"
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Help Scout connection is required for token rotation.")
    }
    let d = existing.health.diagnostics
    return try saveHelpScoutRelayOwnedOAuthConnection(
      context: context, appIdOrSlug: existing.appId, accessToken: accessToken,
      refreshToken: refreshToken, companyId: Int64(d["companyId"]?.number ?? 0),
      userId: Int64(d["userId"]?.number ?? 0), userRole: d["userRole"]?.string ?? "",
      accountLabel: existing.accountLabel, accessExpiresInSeconds: accessExpiresInSeconds, now: now)
  }

  @discardableResult
  public func saveFrontRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    companyId: String, companyName: String, authorizerTeammateId: String, authorizerIsAdmin: Bool,
    resourceNamespace: String = "shared", accountLabel: String?, accessExpiresAt: String?,
    refreshExpiresAt: String?,
    grantedScopes: [String] = ProviderConnectionService.frontRelayOwnedOAuthScopes,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "front")
    guard app.slug == "front" else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Front OAuth can only be saved for the Front Marketplace app.")
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "Front OAuth access token", maxLength: 30000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "Front OAuth refresh token", maxLength: 30000)
    let exactCompanyId = try requireNonEmptyString(
      companyId, field: "Front company ID", maxLength: 256)
    let exactCompanyName = try requireNonEmptyString(
      companyName, field: "Front company name", maxLength: 256)
    let teammateId = try requireNonEmptyString(
      authorizerTeammateId, field: "Front authorizer teammate ID", maxLength: 128)
    let scopes = grantedScopes
    let missing = Self.frontRelayOwnedOAuthScopes.filter { !scopes.contains($0) }
    let extras = scopes.filter { !Self.frontRelayOwnedOAuthScopes.contains($0) }
    guard teammateId.hasPrefix("tea_"),
      teammateId.dropFirst(4).allSatisfy({ $0.isLetter || $0.isNumber }), authorizerIsAdmin,
      resourceNamespace == "shared", missing.isEmpty, extras.isEmpty
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "Front requires an admin authorizer, exact shared-resource namespace, teammate ID, and only conversations:read."
      )
    }
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let oldRefs = existing.map(Self.secretReferenceIds(in:)) ?? []
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Front OAuth access token",
      secretValue: access)
    let refreshRef: SecretReference
    do {
      refreshRef = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Front OAuth refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    let railway = ProcessInfo.processInfo.environment["CLAWCHAT_RAILWAY_ORIGIN"]?
      .providerConnectionNilIfEmpty?
      .trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    let callback = railway.map { $0 + "/api/v1/oauth/front/callback" }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let label = accountLabel?.providerConnectionNilIfEmpty ?? exactCompanyName
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "front_oauth_access_token", label: "Front OAuth access token", required: true,
        userOwnedRequired: false, secretReferenceId: accessRef.id, status: .verified,
        helpText: "60-minute bearer token stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "front_oauth_refresh_token", label: "Front OAuth refresh token", required: true,
        userOwnedRequired: false, secretReferenceId: refreshRef.id, status: .verified,
        helpText:
          "Six-month refresh token returned with each refresh and conditionally rotated in its final 24 hours.",
        redactionStatus: "secret-reference-only"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "front-relay-owned-oauth:\(exactCompanyId):\(teammateId)", providerName: "Front",
      status: .connected, authorizationState: .completed, credentialOwnership: .relayOwned,
      userOwnedCredentialsRequired: false, credentialRequirements: requirements,
      secretReferenceIds: [accessRef.id, refreshRef.id], accountLabel: label,
      connectedHandle: exactCompanyId, callbackURL: callback,
      requiredScopes: Self.frontRelayOwnedOAuthScopes, grantedScopes: scopes,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message:
          "Front OAuth references are ready for the exact company shared-Conversation metadata boundary.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("front"),
          "authMethod": .string("oauth2_authorization_code_access_refresh_pair"),
          "relayOwnedFrontOAuth": .bool(true), "readOnlyV1": .bool(true),
          "companyId": .string(exactCompanyId), "companyName": .string(exactCompanyName),
          "authorizerTeammateId": .string(teammateId), "authorizerIsAdmin": .bool(true),
          "resourceNamespace": .string("shared"), "privateResourcesAllowed": .bool(false),
          "accessExpiresAt": accessExpiresAt.map(JSONValue.string) ?? .null,
          "refreshExpiresAt": refreshExpiresAt.map(JSONValue.string) ?? .null,
          "accessTokenLifetimeSeconds": .number(3600),
          "refreshTokenLifetimeSeconds": .number(15_552_000),
          "refreshRotation": .string("same-token-until-final-24-hours-then-new-six-month-token"),
          "tokenPairReplacement": .string("serialized-atomic-two-reference-replacement"),
          "apiOrigin": .string("https://api2.frontapp.com"),
          "conversationWritesAllowed": .bool(false),
          "messageOrCommentContentReturned": .bool(false), "identityPIIReturned": .bool(false),
          "arbitrarySearchAllowed": .bool(false), "automaticPaginationAllowed": .bool(false),
          "requiresSecureWebBackend": .bool(true),
          "productionCallbackConfigured": .bool(callback != nil),
          "callbackTransport": .string("railway-https-only"),
          "rawTokenStoredInDatabase": .bool(false), "rawProviderToolExposure": .bool(false),
        ], redactionStatus: "private-state-excluded"), senderIdentities: [],
      installPolicy: "approval_gated_front_conversation_metadata_reads", lastCheckedAt: timestamp,
      lastError: nil,
      manualEvidenceNote: callback == nil
        ? "Production Front OAuth requires CLAWCHAT_RAILWAY_ORIGIN and a deployed exchange/refresh/revoke/disconnect broker."
        : nil, reauthorizeRequired: false, disconnecting: false, betaBlocked: false,
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
      _ = try? secrets.delete(refreshRef.id)
      throw error
    }
  }

  @discardableResult public func rotateFrontOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String, accessExpiresAt: String?, refreshExpiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    frontTokenRotationLock.lock()
    defer { frontTokenRotationLock.unlock() }
    guard
      let existing = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId), existing.appSlug == "front"
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Front connection is required for token rotation.")
    }
    let d = existing.health.diagnostics
    return try saveFrontRelayOwnedOAuthConnection(
      context: context, appIdOrSlug: existing.appId, accessToken: accessToken,
      refreshToken: refreshToken, companyId: d["companyId"]?.string ?? "",
      companyName: d["companyName"]?.string ?? "",
      authorizerTeammateId: d["authorizerTeammateId"]?.string ?? "",
      authorizerIsAdmin: d["authorizerIsAdmin"] == .bool(true),
      resourceNamespace: d["resourceNamespace"]?.string ?? "", accountLabel: existing.accountLabel,
      accessExpiresAt: accessExpiresAt, refreshExpiresAt: refreshExpiresAt,
      grantedScopes: existing.grantedScopes, now: now)
  }

  @discardableResult
  public func saveTeamworkRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String,
    installationId: Int64, installationName: String, companyId: Int64, companyName: String,
    region: String, apiEndPoint: String, userId: Int64, userInfoInstallationId: Int64,
    accountLabel: String?,
    grantedScopes: [String] = ProviderConnectionService.teamworkRelayOwnedOAuthScopes,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "teamwork")
    guard app.slug == "teamwork" else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "Teamwork OAuth can only be saved for the Teamwork Marketplace app.")
    }
    try validateAppCanAuthorize(app, context: context)
    let token = try requireNonEmptyString(
      accessToken, field: "Teamwork OAuth access token", maxLength: 30000)
    let exactInstallationName = try requireNonEmptyString(
      installationName, field: "Teamwork installation name", maxLength: 256)
    let exactCompanyName = try requireNonEmptyString(
      companyName, field: "Teamwork company name", maxLength: 256)
    let exactRegion = try requireNonEmptyString(region, field: "Teamwork region", maxLength: 64)
      .uppercased()
    guard installationId > 0, companyId > 0, userId > 0, userInfoInstallationId == installationId,
      let origin = Self.safeTeamworkAPIOrigin(apiEndPoint),
      grantedScopes == Self.teamworkRelayOwnedOAuthScopes
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "Teamwork requires exact positive installation/company/user identities, matching userinfo installation, one safe Teamwork HTTPS API endpoint, and Teamwork.com product access."
      )
    }
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let oldRefs = existing.map(Self.secretReferenceIds(in:)) ?? []
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Teamwork permanent OAuth access token",
      secretValue: token)
    let railway = ProcessInfo.processInfo.environment["CLAWCHAT_RAILWAY_ORIGIN"]?
      .providerConnectionNilIfEmpty?
      .trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    let callback = railway.map { $0 + "/api/v1/oauth/teamwork/callback" }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let label = accountLabel?.providerConnectionNilIfEmpty ?? exactInstallationName
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "teamwork_oauth_access_token", label: "Teamwork permanent OAuth access token",
        required: true, userOwnedRequired: false, secretReferenceId: accessRef.id,
        status: .verified,
        helpText:
          "Permanent Teamwork bearer token stored as one Keychain reference and replaced on reauthorization.",
        redactionStatus: "secret-reference-only")
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "teamwork-relay-owned-oauth:\(installationId):\(userId)",
      providerName: "Teamwork", status: .connected, authorizationState: .completed,
      credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
      credentialRequirements: requirements, secretReferenceIds: [accessRef.id], accountLabel: label,
      connectedHandle: String(installationId), callbackURL: callback,
      requiredScopes: Self.teamworkRelayOwnedOAuthScopes, grantedScopes: grantedScopes,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message:
          "Teamwork OAuth reference is ready for the exact installation Project/Task metadata boundary.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("teamwork"), "authMethod": .string("app_login_flow_permanent_bearer"),
          "relayOwnedTeamworkOAuth": .bool(true), "readOnlyV1": .bool(true),
          "installationId": .number(Double(installationId)),
          "installationName": .string(exactInstallationName),
          "companyId": .number(Double(companyId)), "companyName": .string(exactCompanyName),
          "region": .string(exactRegion), "authorizerUserId": .number(Double(userId)),
          "userinfoInstallationId": .number(Double(userInfoInstallationId)),
          "apiOrigin": .string(origin), "oauthCodeLifetimeSeconds": .number(900),
          "accessTokenLifetime": .string("permanent-until-revoked-or-reauthorized"),
          "refreshTokenAvailable": .bool(false),
          "tokenReplacement": .string("single-reference-replacement-on-reauthorization"),
          "productPermission": .string("Teamwork.com"), "broadPermanentToken": .bool(true),
          "customDomainEndpointAllowed": .bool(false), "projectOrTaskWritesAllowed": .bool(false),
          "collaborationContentReturned": .bool(false), "identityPIIReturned": .bool(false),
          "financialOrTimeDataReturned": .bool(false), "arbitraryQueryAllowed": .bool(false),
          "automaticPaginationAllowed": .bool(false), "requiresSecureWebBackend": .bool(true),
          "productionCallbackConfigured": .bool(callback != nil),
          "callbackTransport": .string("railway-https-only"),
          "rawTokenStoredInDatabase": .bool(false), "rawProviderToolExposure": .bool(false),
        ], redactionStatus: "private-state-excluded"), senderIdentities: [],
      installPolicy: "approval_gated_teamwork_project_task_metadata_reads",
      lastCheckedAt: timestamp, lastError: nil,
      manualEvidenceNote: callback == nil
        ? "Production Teamwork OAuth requires CLAWCHAT_RAILWAY_ORIGIN and a deployed exchange/disconnect broker."
        : nil, reauthorizeRequired: false, disconnecting: false, betaBlocked: false,
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
  public func saveBasecampRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    accountId: Int64, accountName: String, accountProduct: String, accountHref: String,
    identityId: Int64, accountLabel: String?, accessExpiresAt: String?,
    grantedScopes: [String] = [], now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "basecamp")
    guard app.slug == "basecamp" else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "Basecamp OAuth can only be saved for the Basecamp Marketplace app.")
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "Basecamp OAuth access token", maxLength: 30000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "Basecamp OAuth refresh token", maxLength: 30000)
    let name = try requireNonEmptyString(
      accountName, field: "Basecamp account name", maxLength: 256)
    guard accountId > 0, identityId > 0, accountProduct == "bc3", grantedScopes.isEmpty,
      accountHref == "https://3.basecampapi.com/\(accountId)"
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "Basecamp requires one exact bc3 account ID/href, positive Launchpad identity, and no invented OAuth scopes."
      )
    }
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let oldRefs = existing.map(Self.secretReferenceIds(in:)) ?? []
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Basecamp OAuth access token",
      secretValue: access)
    let refreshRef: SecretReference
    do {
      refreshRef = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Basecamp OAuth refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    let railway = ProcessInfo.processInfo.environment["CLAWCHAT_RAILWAY_ORIGIN"]?
      .providerConnectionNilIfEmpty?
      .trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    let callback = railway.map { $0 + "/api/v1/oauth/basecamp/callback" }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "basecamp_oauth_access_token", label: "Basecamp OAuth access token",
        required: true, userOwnedRequired: false, secretReferenceId: accessRef.id,
        status: .verified, helpText: "Two-week bearer token stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "basecamp_oauth_refresh_token", label: "Basecamp OAuth refresh token",
        required: true, userOwnedRequired: false, secretReferenceId: refreshRef.id,
        status: .verified,
        helpText: "Refresh token replaced atomically with every provider-returned pair.",
        redactionStatus: "secret-reference-only"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "basecamp-relay-owned-oauth:\(accountId):\(identityId)",
      providerName: "Basecamp", status: .connected, authorizationState: .completed,
      credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
      credentialRequirements: requirements, secretReferenceIds: [accessRef.id, refreshRef.id],
      accountLabel: accountLabel?.providerConnectionNilIfEmpty ?? name,
      connectedHandle: String(accountId),
      callbackURL: callback, requiredScopes: [], grantedScopes: [],
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message: "Basecamp OAuth references are ready for the exact bc3 account metadata boundary.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("basecamp"),
          "authMethod": .string("oauth2_authorization_code_access_refresh_pair"),
          "relayOwnedBasecampOAuth": .bool(true), "readOnlyV1": .bool(true),
          "accountId": .string(String(accountId)), "accountName": .string(name),
          "product": .string("bc3"), "identityId": .number(Double(identityId)),
          "apiOrigin": .string(accountHref),
          "accessExpiresAt": accessExpiresAt.map(JSONValue.string) ?? .null,
          "accessTokenLifetimeSeconds": .number(1_209_600),
          "refreshRotationDocumented": .bool(false),
          "tokenPairReplacement": .string("serialized-atomic-provider-returned-pair-replacement"),
          "granularScopesAvailable": .bool(false), "projectOrTodoWritesAllowed": .bool(false),
          "collaborationContentReturned": .bool(false), "identityPIIReturned": .bool(false),
          "linkPaginationAllowed": .bool(false), "arbitraryQueryAllowed": .bool(false),
          "requiresSecureWebBackend": .bool(true),
          "productionCallbackConfigured": .bool(callback != nil),
          "callbackTransport": .string("railway-https-only"),
          "rawTokenStoredInDatabase": .bool(false), "rawProviderToolExposure": .bool(false),
        ], redactionStatus: "private-state-excluded"), senderIdentities: [],
      installPolicy: "approval_gated_basecamp_project_todo_metadata_reads",
      lastCheckedAt: timestamp, lastError: nil,
      manualEvidenceNote: callback == nil
        ? "Production Basecamp OAuth requires CLAWCHAT_RAILWAY_ORIGIN and a deployed exchange/refresh/disconnect broker."
        : nil, reauthorizeRequired: false, disconnecting: false, betaBlocked: false,
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
      _ = try? secrets.delete(refreshRef.id)
      throw error
    }
  }

  @discardableResult public func rotateBasecampOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String, accessExpiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    basecampTokenRotationLock.lock()
    defer { basecampTokenRotationLock.unlock() }
    guard
      let existing = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      existing.appSlug == "basecamp"
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Basecamp connection is required for token rotation.")
    }
    let d = existing.health.diagnostics
    let accountId = Int64(d["accountId"]?.string ?? "") ?? 0
    return try saveBasecampRelayOwnedOAuthConnection(
      context: context, appIdOrSlug: existing.appId, accessToken: accessToken,
      refreshToken: refreshToken, accountId: accountId, accountName: d["accountName"]?.string ?? "",
      accountProduct: d["product"]?.string ?? "", accountHref: d["apiOrigin"]?.string ?? "",
      identityId: Int64(d["identityId"]?.number ?? 0), accountLabel: existing.accountLabel,
      accessExpiresAt: accessExpiresAt, now: now)
  }
}
