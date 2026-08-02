import Foundation

extension ProviderConnectionService {
  @discardableResult
  public func saveWrikeRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    accountId: String, accountName: String, authorizerContactId: String, providerHost: String,
    accountLabel: String?, accessExpiresAt: String?,
    grantedScopes: [String] = ProviderConnectionService.wrikeRelayOwnedOAuthScopes,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "wrike")
    guard app.slug == "wrike" else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Wrike OAuth can only be saved for the Wrike Marketplace app.")
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "Wrike OAuth access token", maxLength: 30000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "Wrike OAuth refresh token", maxLength: 30000)
    let exactAccountId = try requireNonEmptyString(
      accountId, field: "Wrike account ID", maxLength: 128)
    let exactAccountName = try requireNonEmptyString(
      accountName, field: "Wrike account name", maxLength: 256)
    let contactId = try requireNonEmptyString(
      authorizerContactId, field: "Wrike authorizer contact ID", maxLength: 128)
    guard Self.isSafeWrikeOpaqueId(exactAccountId), Self.isSafeWrikeOpaqueId(contactId),
      let origin = Self.safeWrikeAPIOrigin(providerHost),
      grantedScopes == Self.wrikeRelayOwnedOAuthScopes
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "Wrike requires exact safe Account/Contact IDs, one provider-returned wrike.com regional host, and only wsReadOnly."
      )
    }
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let oldRefs = existing.map(Self.secretReferenceIds(in:)) ?? []
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Wrike OAuth access token",
      secretValue: access)
    let refreshRef: SecretReference
    do {
      refreshRef = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Wrike OAuth rotating refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    let railway = RelayCloudLaunchContract.configuredRailwayOrigin
    let callback = railway.map { $0 + "/api/v1/oauth/wrike/callback" }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "wrike_oauth_access_token", label: "Wrike OAuth access token", required: true,
        userOwnedRequired: false, secretReferenceId: accessRef.id, status: .verified,
        helpText: "One-hour regional bearer token stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "wrike_oauth_refresh_token", label: "Wrike single-use refresh token",
        required: true, userOwnedRequired: false, secretReferenceId: refreshRef.id,
        status: .verified,
        helpText: "Single-use refresh token atomically replaced with every returned pair.",
        redactionStatus: "secret-reference-only"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "wrike-relay-owned-oauth:\(exactAccountId):\(contactId)", providerName: "Wrike",
      status: .connected, authorizationState: .completed, credentialOwnership: .relayOwned,
      userOwnedCredentialsRequired: false, credentialRequirements: requirements,
      secretReferenceIds: [accessRef.id, refreshRef.id],
      accountLabel: accountLabel?.providerConnectionNilIfEmpty ?? exactAccountName,
      connectedHandle: exactAccountId,
      callbackURL: callback, requiredScopes: Self.wrikeRelayOwnedOAuthScopes,
      grantedScopes: grantedScopes, selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message:
          "Wrike OAuth references are ready for the exact account Project/Task metadata boundary.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("wrike"),
          "authMethod": .string("oauth2_authorization_code_single_use_refresh_pair"),
          "relayOwnedWrikeOAuth": .bool(true), "readOnlyV1": .bool(true),
          "accountId": .string(exactAccountId), "accountName": .string(exactAccountName),
          "authorizerContactId": .string(contactId), "providerHost": .string(origin.host ?? ""),
          "apiOrigin": .string(
            origin.absoluteString.trimmingCharacters(in: CharacterSet(charactersIn: "/"))),
          "accessExpiresAt": accessExpiresAt.map(JSONValue.string) ?? .null,
          "accessTokenLifetimeSeconds": .number(3600),
          "refreshRotation": .string("new-pair-invalidates-prior-refresh-token"),
          "tokenPairReplacement": .string("serialized-atomic-single-use-pair-replacement"),
          "exactScope": .string("wsReadOnly"), "defaultWriteScopeRequested": .bool(false),
          "projectOrTaskWritesAllowed": .bool(false), "descriptionOrIdentityReturned": .bool(false),
          "customFieldsReturned": .bool(false), "financialOrTimeDataReturned": .bool(false),
          "automaticPaginationAllowed": .bool(false), "arbitraryQueryAllowed": .bool(false),
          "requiresSecureWebBackend": .bool(true),
          "productionCallbackConfigured": .bool(callback != nil),
          "callbackTransport": .string("railway-https-only"),
          "rawTokenStoredInDatabase": .bool(false), "rawProviderToolExposure": .bool(false),
        ], redactionStatus: "private-state-excluded"), senderIdentities: [],
      installPolicy: "approval_gated_wrike_project_task_metadata_reads", lastCheckedAt: timestamp,
      lastError: nil,
      manualEvidenceNote: callback == nil
        ? "Production Wrike OAuth requires CLAWCHAT_RAILWAY_ORIGIN and a deployed exchange/serialized-refresh/revoke/disconnect broker."
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

  @discardableResult public func rotateWrikeOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String, accessExpiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    wrikeTokenRotationLock.lock()
    defer { wrikeTokenRotationLock.unlock() }
    guard
      let existing = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId), existing.appSlug == "wrike"
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Wrike connection is required for token rotation.")
    }
    let d = existing.health.diagnostics
    return try saveWrikeRelayOwnedOAuthConnection(
      context: context, appIdOrSlug: existing.appId, accessToken: accessToken,
      refreshToken: refreshToken, accountId: d["accountId"]?.string ?? "",
      accountName: d["accountName"]?.string ?? "",
      authorizerContactId: d["authorizerContactId"]?.string ?? "",
      providerHost: d["providerHost"]?.string ?? "", accountLabel: existing.accountLabel,
      accessExpiresAt: accessExpiresAt, grantedScopes: existing.grantedScopes, now: now)
  }

  @discardableResult
  public func saveSmartsheetRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    accountId: String, accountName: String, authorizerUserId: String, apiOrigin: String,
    accountLabel: String?, accessExpiresAt: String?,
    grantedScopes: [String] = ProviderConnectionService.smartsheetRelayOwnedOAuthScopes,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "smartsheet")
    guard app.slug == "smartsheet" else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "Smartsheet OAuth can only be saved for the Smartsheet Marketplace app.")
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "Smartsheet OAuth access token", maxLength: 30000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "Smartsheet OAuth refresh token", maxLength: 30000)
    let exactAccountId = try requireNonEmptyString(
      accountId, field: "Smartsheet account ID", maxLength: 20)
    let exactAccountName = try requireNonEmptyString(
      accountName, field: "Smartsheet account name", maxLength: 256)
    let userId = try requireNonEmptyString(
      authorizerUserId, field: "Smartsheet authorizer user ID", maxLength: 20)
    guard Self.isSafeSmartsheetNumericId(exactAccountId), Self.isSafeSmartsheetNumericId(userId),
      let origin = Self.safeSmartsheetAPIOrigin(apiOrigin),
      grantedScopes == Self.smartsheetRelayOwnedOAuthScopes
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "Smartsheet requires exact numeric Account/User IDs, one official regional API 2.0 origin, and only READ_SHEETS."
      )
    }
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let oldRefs = existing.map(Self.secretReferenceIds(in:)) ?? []
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Smartsheet OAuth access token",
      secretValue: access)
    let refreshRef: SecretReference
    do {
      refreshRef = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Smartsheet OAuth refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    let railway = RelayCloudLaunchContract.configuredRailwayOrigin
    let callback = railway.map { $0 + "/api/v1/oauth/smartsheet/callback" }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "smartsheet_oauth_access_token", label: "Smartsheet OAuth access token",
        required: true, userOwnedRequired: false, secretReferenceId: accessRef.id,
        status: .verified,
        helpText: "Seven-day regional bearer token stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "smartsheet_oauth_refresh_token", label: "Smartsheet OAuth refresh token",
        required: true, userOwnedRequired: false, secretReferenceId: refreshRef.id,
        status: .verified,
        helpText:
          "Provider-returned refresh credential replaced atomically with every returned pair.",
        redactionStatus: "secret-reference-only"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "smartsheet-relay-owned-oauth:\(exactAccountId):\(userId)",
      providerName: "Smartsheet", status: .connected, authorizationState: .completed,
      credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
      credentialRequirements: requirements, secretReferenceIds: [accessRef.id, refreshRef.id],
      accountLabel: accountLabel?.providerConnectionNilIfEmpty ?? exactAccountName,
      connectedHandle: exactAccountId,
      callbackURL: callback, requiredScopes: Self.smartsheetRelayOwnedOAuthScopes,
      grantedScopes: grantedScopes, selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message:
          "Smartsheet OAuth references are ready for the exact account/region bounded Sheet and Row boundary.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("smartsheet"),
          "authMethod": .string("oauth2_authorization_code_access_refresh_pair"),
          "relayOwnedSmartsheetOAuth": .bool(true), "readOnlyV1": .bool(true),
          "accountId": .string(exactAccountId), "accountName": .string(exactAccountName),
          "authorizerUserId": .string(userId),
          "apiOrigin": .string(
            origin.absoluteString.trimmingCharacters(in: CharacterSet(charactersIn: "/"))),
          "providerHost": .string(origin.host ?? ""),
          "accessExpiresAt": accessExpiresAt.map(JSONValue.string) ?? .null,
          "accessTokenLifetimeSeconds": .number(604_799), "refreshRotationDocumented": .bool(false),
          "tokenPairReplacement": .string("serialized-atomic-provider-returned-pair-replacement"),
          "exactScope": .string("READ_SHEETS"), "readUsersScopeRequested": .bool(false),
          "sheetOrRowWritesAllowed": .bool(false), "collaborationContentReturned": .bool(false),
          "formulaLinkImageReturned": .bool(false), "automaticPaginationAllowed": .bool(false),
          "arbitraryQueryAllowed": .bool(false), "requiresSecureWebBackend": .bool(true),
          "productionCallbackConfigured": .bool(callback != nil),
          "callbackTransport": .string("railway-https-only"),
          "rawTokenStoredInDatabase": .bool(false), "rawProviderToolExposure": .bool(false),
        ], redactionStatus: "private-state-excluded"), senderIdentities: [],
      installPolicy: "approval_gated_smartsheet_sheet_row_reads", lastCheckedAt: timestamp,
      lastError: nil,
      manualEvidenceNote: callback == nil
        ? "Production Smartsheet OAuth requires CLAWCHAT_RAILWAY_ORIGIN and a deployed region-aware exchange/serialized-refresh/revoke/disconnect broker."
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

  @discardableResult public func rotateSmartsheetOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String, accessExpiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    smartsheetTokenRotationLock.lock()
    defer { smartsheetTokenRotationLock.unlock() }
    guard
      let existing = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      existing.appSlug == "smartsheet"
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Smartsheet connection is required for token replacement.")
    }
    let d = existing.health.diagnostics
    return try saveSmartsheetRelayOwnedOAuthConnection(
      context: context, appIdOrSlug: existing.appId, accessToken: accessToken,
      refreshToken: refreshToken, accountId: d["accountId"]?.string ?? "",
      accountName: d["accountName"]?.string ?? "",
      authorizerUserId: d["authorizerUserId"]?.string ?? "",
      apiOrigin: d["apiOrigin"]?.string ?? "", accountLabel: existing.accountLabel,
      accessExpiresAt: accessExpiresAt, grantedScopes: existing.grantedScopes, now: now)
  }

  @discardableResult
  public func saveTodoistRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    userId: String, userDisplayName: String, accountLabel: String?, accessExpiresAt: String?,
    grantedScopes: [String] = ProviderConnectionService.todoistRelayOwnedOAuthScopes,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "todoist")
    guard app.slug == "todoist" else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "Todoist OAuth can only be saved for the Todoist Marketplace app.")
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "Todoist OAuth access token", maxLength: 30000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "Todoist rotating refresh token", maxLength: 30000)
    let exactUserId = try requireNonEmptyString(userId, field: "Todoist user ID", maxLength: 20)
    let displayName = try requireNonEmptyString(
      userDisplayName, field: "Todoist user display name", maxLength: 256)
    guard Self.isSafeTodoistUserId(exactUserId), grantedScopes == Self.todoistRelayOwnedOAuthScopes
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Todoist requires one exact positive User ID and only data:read."
      )
    }
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let oldRefs = existing.map(Self.secretReferenceIds(in:)) ?? []
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Todoist OAuth access token",
      secretValue: access)
    let refreshRef: SecretReference
    do {
      refreshRef = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Todoist rotating refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    let railway = RelayCloudLaunchContract.configuredRailwayOrigin
    let callback = railway.map { $0 + "/api/v1/oauth/todoist/callback" }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "todoist_oauth_access_token", label: "Todoist OAuth access token", required: true,
        userOwnedRequired: false, secretReferenceId: accessRef.id, status: .verified,
        helpText: "One-hour bearer token stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "todoist_oauth_refresh_token", label: "Todoist rotating refresh token",
        required: true, userOwnedRequired: false, secretReferenceId: refreshRef.id,
        status: .verified,
        helpText:
          "Single-use refresh token replaced atomically; grace retries must never erase the stored replacement.",
        redactionStatus: "secret-reference-only"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "todoist-relay-owned-oauth:\(exactUserId)", providerName: "Todoist",
      status: .connected, authorizationState: .completed, credentialOwnership: .relayOwned,
      userOwnedCredentialsRequired: false, credentialRequirements: requirements,
      secretReferenceIds: [accessRef.id, refreshRef.id],
      accountLabel: accountLabel?.providerConnectionNilIfEmpty ?? displayName,
      connectedHandle: exactUserId,
      callbackURL: callback, requiredScopes: Self.todoistRelayOwnedOAuthScopes,
      grantedScopes: grantedScopes, selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message:
          "Todoist OAuth references are ready for the exact user bounded Project/Task boundary.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("todoist"),
          "authMethod": .string("oauth2_authorization_code_rotating_refresh_pair"),
          "relayOwnedTodoistOAuth": .bool(true), "readOnlyV1": .bool(true),
          "userId": .string(exactUserId), "userDisplayName": .string(displayName),
          "apiOrigin": .string("https://api.todoist.com/api/v1"),
          "accessExpiresAt": accessExpiresAt.map(JSONValue.string) ?? .null,
          "accessTokenLifetimeSeconds": .number(3600),
          "refreshRotation": .string("single-use-rotating-with-60-second-grace"),
          "refreshGraceRetryOmitsReplacement": .bool(true),
          "refreshReplayRevokesTokenFamily": .bool(true),
          "tokenPairReplacement": .string("serialized-atomic-first-complete-pair-wins"),
          "exactScope": .string("data:read"), "readWriteOrDeleteScopeRequested": .bool(false),
          "projectOrTaskWritesAllowed": .bool(false), "privateCollaborationReturned": .bool(false),
          "automaticPaginationAllowed": .bool(false), "syncOrHostedMCPAllowed": .bool(false),
          "arbitraryQueryAllowed": .bool(false), "requiresSecureWebBackend": .bool(true),
          "productionCallbackConfigured": .bool(callback != nil),
          "callbackTransport": .string("railway-https-only"),
          "rawTokenStoredInDatabase": .bool(false), "rawProviderToolExposure": .bool(false),
        ], redactionStatus: "private-state-excluded"), senderIdentities: [],
      installPolicy: "approval_gated_todoist_project_task_reads", lastCheckedAt: timestamp,
      lastError: nil,
      manualEvidenceNote: callback == nil
        ? "Production Todoist OAuth requires CLAWCHAT_RAILWAY_ORIGIN and a deployed exchange/serialized grace-aware refresh/revoke/disconnect broker."
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

  @discardableResult public func rotateTodoistOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String?, accessExpiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    todoistTokenRotationLock.lock()
    defer { todoistTokenRotationLock.unlock() }
    guard
      let existing = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId), existing.appSlug == "todoist"
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Todoist connection is required for token rotation.")
    }
    guard let refreshToken = refreshToken?.providerConnectionNilIfEmpty else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "Todoist grace-window refresh response omitted the replacement refresh token; retain the already stored complete pair."
      )
    }
    let d = existing.health.diagnostics
    return try saveTodoistRelayOwnedOAuthConnection(
      context: context, appIdOrSlug: existing.appId, accessToken: accessToken,
      refreshToken: refreshToken, userId: d["userId"]?.string ?? "",
      userDisplayName: d["userDisplayName"]?.string ?? "", accountLabel: existing.accountLabel,
      accessExpiresAt: accessExpiresAt, grantedScopes: existing.grantedScopes, now: now)
  }

  @discardableResult
  public func saveHarvestRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    harvestIdUserId: String, accountId: String, accountName: String, apiUserId: String,
    apiUserDisplayName: String, accountLabel: String?, accessExpiresAt: String?,
    grantedScopes: [String], now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "harvest")
    guard app.slug == "harvest" else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "Harvest OAuth can only be saved for the Harvest Marketplace app.")
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "Harvest OAuth access token", maxLength: 30000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "Harvest OAuth refresh token", maxLength: 30000)
    let harvestUser = try requireNonEmptyString(
      harvestIdUserId, field: "Harvest ID user ID", maxLength: 20)
    let exactAccount = try requireNonEmptyString(
      accountId, field: "Harvest account ID", maxLength: 20)
    let name = try requireNonEmptyString(accountName, field: "Harvest account name", maxLength: 256)
    let apiUser = try requireNonEmptyString(apiUserId, field: "Harvest API user ID", maxLength: 20)
    let displayName = try requireNonEmptyString(
      apiUserDisplayName, field: "Harvest API user display name", maxLength: 256)
    let exactScopes = Self.harvestRelayOwnedOAuthScopes(accountId: exactAccount)
    guard Self.isSafeHarvestNumericId(harvestUser), Self.isSafeHarvestNumericId(exactAccount),
      Self.isSafeHarvestNumericId(apiUser), grantedScopes == exactScopes
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "Harvest requires exact positive Harvest-ID/Account/API-user IDs and exactly one harvest:{accountId} scope."
      )
    }
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let oldRefs = existing.map(Self.secretReferenceIds(in:)) ?? []
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Harvest OAuth access token",
      secretValue: access)
    let refreshRef: SecretReference
    do {
      refreshRef = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Harvest OAuth refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    let railway = RelayCloudLaunchContract.configuredRailwayOrigin
    let callback = railway.map { $0 + "/api/v1/oauth/harvest/callback" }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "harvest_oauth_access_token", label: "Harvest OAuth access token", required: true,
        userOwnedRequired: false, secretReferenceId: accessRef.id, status: .verified,
        helpText: "Fourteen-day bearer token stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "harvest_oauth_refresh_token", label: "Harvest OAuth refresh token",
        required: true, userOwnedRequired: false, secretReferenceId: refreshRef.id,
        status: .verified,
        helpText:
          "Provider-returned refresh credential atomically replaced with each complete pair.",
        redactionStatus: "secret-reference-only"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "harvest-relay-owned-oauth:\(exactAccount):\(harvestUser):\(apiUser)",
      providerName: "Harvest", status: .connected, authorizationState: .completed,
      credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
      credentialRequirements: requirements, secretReferenceIds: [accessRef.id, refreshRef.id],
      accountLabel: accountLabel?.providerConnectionNilIfEmpty ?? name,
      connectedHandle: exactAccount,
      callbackURL: callback, requiredScopes: exactScopes, grantedScopes: grantedScopes,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message:
          "Harvest OAuth references are ready for the exact account/current-user Project Assignment and Time Entry boundary.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("harvest"),
          "authMethod": .string("oauth2_authorization_code_access_refresh_pair"),
          "relayOwnedHarvestOAuth": .bool(true), "readOnlyV1": .bool(true),
          "harvestIdUserId": .string(harvestUser), "accountId": .string(exactAccount),
          "accountName": .string(name), "accountProduct": .string("harvest"),
          "apiUserId": .string(apiUser), "apiUserDisplayName": .string(displayName),
          "apiOrigin": .string("https://api.harvestapp.com/v2"),
          "accessExpiresAt": accessExpiresAt.map(JSONValue.string) ?? .null,
          "accessTokenLifetimeSeconds": .number(1_209_600),
          "refreshRotationDocumented": .bool(false),
          "tokenPairReplacement": .string("serialized-atomic-provider-returned-pair-replacement"),
          "exactAccountScope": .string("harvest:" + exactAccount),
          "multiAccountOrForecastScopeRequested": .bool(false),
          "projectOrTimeEntryWritesAllowed": .bool(false),
          "privateOrFinancialDataReturned": .bool(false), "reportsAPIAllowed": .bool(false),
          "automaticPaginationAllowed": .bool(false), "arbitraryQueryAllowed": .bool(false),
          "requiresSecureWebBackend": .bool(true),
          "productionCallbackConfigured": .bool(callback != nil),
          "callbackTransport": .string("railway-https-only"),
          "rawTokenStoredInDatabase": .bool(false), "rawProviderToolExposure": .bool(false),
        ], redactionStatus: "private-state-excluded"), senderIdentities: [],
      installPolicy: "approval_gated_harvest_project_time_reads", lastCheckedAt: timestamp,
      lastError: nil,
      manualEvidenceNote: callback == nil
        ? "Production Harvest OAuth requires CLAWCHAT_RAILWAY_ORIGIN and a deployed exchange/account-user-validation/serialized-refresh/disconnect broker."
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

  @discardableResult public func rotateHarvestOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String, accessExpiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    harvestTokenRotationLock.lock()
    defer { harvestTokenRotationLock.unlock() }
    guard
      let existing = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId), existing.appSlug == "harvest"
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Harvest connection is required for token replacement.")
    }
    let d = existing.health.diagnostics
    return try saveHarvestRelayOwnedOAuthConnection(
      context: context, appIdOrSlug: existing.appId, accessToken: accessToken,
      refreshToken: refreshToken, harvestIdUserId: d["harvestIdUserId"]?.string ?? "",
      accountId: d["accountId"]?.string ?? "", accountName: d["accountName"]?.string ?? "",
      apiUserId: d["apiUserId"]?.string ?? "",
      apiUserDisplayName: d["apiUserDisplayName"]?.string ?? "",
      accountLabel: existing.accountLabel, accessExpiresAt: accessExpiresAt,
      grantedScopes: existing.grantedScopes, now: now)
  }

  @discardableResult
  public func saveCalendlyRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    userUri: String, userName: String, organizationUri: String, organizationName: String,
    accountLabel: String?, accessExpiresAt: String?,
    grantedScopes: [String] = ProviderConnectionService.calendlyRelayOwnedOAuthScopes,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "calendly")
    guard app.slug == "calendly" else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "Calendly OAuth can only be saved for the Calendly Marketplace app.")
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "Calendly OAuth access token", maxLength: 30000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "Calendly OAuth rotating refresh token", maxLength: 30000)
    let exactUserUri = try requireNonEmptyString(
      userUri, field: "Calendly user URI", maxLength: 256)
    let name = try requireNonEmptyString(userName, field: "Calendly user name", maxLength: 256)
    let exactOrganizationUri = try requireNonEmptyString(
      organizationUri, field: "Calendly organization URI", maxLength: 256)
    let organization = try requireNonEmptyString(
      organizationName, field: "Calendly organization name", maxLength: 256)
    guard Self.isSafeCalendlyResourceUri(exactUserUri, resource: "users") else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Calendly requires one exact api.calendly.com User URI.")
    }
    guard Self.isSafeCalendlyResourceUri(exactOrganizationUri, resource: "organizations") else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Calendly requires one exact api.calendly.com Organization URI.")
    }
    guard grantedScopes == Self.calendlyRelayOwnedOAuthScopes else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "Calendly requires only users:read, event_types:read and scheduled_events:read.")
    }
    let userId = URL(string: exactUserUri)!.lastPathComponent
    let organizationId = URL(string: exactOrganizationUri)!.lastPathComponent
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let oldRefs = existing.map(Self.secretReferenceIds(in:)) ?? []
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Calendly OAuth access token",
      secretValue: access)
    let refreshRef: SecretReference
    do {
      refreshRef = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Calendly single-use refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    let railway = RelayCloudLaunchContract.configuredRailwayOrigin
    let callback = railway.map { $0 + "/api/v1/oauth/calendly/callback" }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "calendly_oauth_access_token", label: "Calendly OAuth access token",
        required: true, userOwnedRequired: false, secretReferenceId: accessRef.id,
        status: .verified, helpText: "Two-hour bearer token stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "calendly_oauth_refresh_token", label: "Calendly rotating refresh token",
        required: true, userOwnedRequired: false, secretReferenceId: refreshRef.id,
        status: .verified,
        helpText: "Single-use refresh token atomically replaced after every successful refresh.",
        redactionStatus: "secret-reference-only"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "calendly-relay-owned-oauth:\(organizationId):\(userId)",
      providerName: "Calendly", status: .connected, authorizationState: .completed,
      credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
      credentialRequirements: requirements, secretReferenceIds: [accessRef.id, refreshRef.id],
      accountLabel: accountLabel?.providerConnectionNilIfEmpty ?? name + " · " + organization,
      connectedHandle: userId, callbackURL: callback,
      requiredScopes: Self.calendlyRelayOwnedOAuthScopes, grantedScopes: grantedScopes,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message:
          "Calendly OAuth references are ready for the exact user/current-organization Event Type and Scheduled Event boundary.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("calendly"),
          "authMethod": .string("oauth2_1_authorization_code_pkce_rotating_refresh_pair"),
          "relayOwnedCalendlyOAuth": .bool(true), "readOnlyV1": .bool(true),
          "userUri": .string(exactUserUri), "userId": .string(userId), "userName": .string(name),
          "organizationUri": .string(exactOrganizationUri),
          "organizationId": .string(organizationId), "organizationName": .string(organization),
          "apiOrigin": .string("https://api.calendly.com"),
          "accessExpiresAt": accessExpiresAt.map(JSONValue.string) ?? .null,
          "accessTokenLifetimeSeconds": .number(7200),
          "authorizationCodeLifetimeSeconds": .number(600), "pkceMethod": .string("S256"),
          "refreshRotation": .string("single-use-rotating"), "invalidGrantClearsPair": .bool(true),
          "tokenPairReplacement": .string("serialized-atomic-provider-returned-pair-replacement"),
          "exactScopes": .array(Self.calendlyRelayOwnedOAuthScopes.map(JSONValue.string)),
          "scheduledEventWritesAllowed": .bool(false), "inviteePIIReturned": .bool(false),
          "automaticPaginationAllowed": .bool(false), "hostedMCPAllowed": .bool(false),
          "arbitraryQueryAllowed": .bool(false), "requiresSecureWebBackend": .bool(true),
          "productionCallbackConfigured": .bool(callback != nil),
          "callbackTransport": .string("railway-https-only"),
          "rawTokenStoredInDatabase": .bool(false), "rawProviderToolExposure": .bool(false),
        ], redactionStatus: "private-state-excluded"), senderIdentities: [],
      installPolicy: "approval_gated_calendly_event_reads", lastCheckedAt: timestamp,
      lastError: nil,
      manualEvidenceNote: callback == nil
        ? "Production Calendly OAuth requires CLAWCHAT_RAILWAY_ORIGIN and a deployed PKCE exchange/user-organization-validation/serialized-refresh/revoke/disconnect broker."
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

  @discardableResult public func rotateCalendlyOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String, accessExpiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    calendlyTokenRotationLock.lock()
    defer { calendlyTokenRotationLock.unlock() }
    guard
      let existing = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      existing.appSlug == "calendly"
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Calendly connection is required for token rotation.")
    }
    let d = existing.health.diagnostics
    let userId = d["userId"]?.string ?? ""
    let organizationId = d["organizationId"]?.string ?? ""
    return try saveCalendlyRelayOwnedOAuthConnection(
      context: context, appIdOrSlug: existing.appId, accessToken: accessToken,
      refreshToken: refreshToken, userUri: "https://api.calendly.com/users/" + userId,
      userName: d["userName"]?.string ?? "",
      organizationUri: "https://api.calendly.com/organizations/" + organizationId,
      organizationName: d["organizationName"]?.string ?? "", accountLabel: existing.accountLabel,
      accessExpiresAt: accessExpiresAt, grantedScopes: existing.grantedScopes, now: now)
  }

  @discardableResult
  public func saveCalComRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    userId: String, userName: String, username: String, accountLabel: String?,
    accessExpiresAt: String?,
    grantedScopes: [String] = ProviderConnectionService.calComRelayOwnedOAuthScopes,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "cal-com")
    guard app.slug == "cal-com" else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "Cal.com OAuth can only be saved for the Cal.com Marketplace app.")
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "Cal.com OAuth access token", maxLength: 30000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "Cal.com OAuth refresh token", maxLength: 30000)
    let exactUserId = try requireNonEmptyString(userId, field: "Cal.com user ID", maxLength: 20)
    let name = try requireNonEmptyString(userName, field: "Cal.com user name", maxLength: 256)
    let handle = try requireNonEmptyString(username, field: "Cal.com username", maxLength: 128)
    guard Self.isSafeCalComNumericId(exactUserId), Self.isSafeCalComHandle(handle),
      grantedScopes == Self.calComRelayOwnedOAuthScopes
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "Cal.com requires one exact positive /me User ID, safe username and only BOOKING_READ, EVENT_TYPE_READ, PROFILE_READ."
      )
    }
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let oldRefs = existing.map(Self.secretReferenceIds(in:)) ?? []
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Cal.com OAuth access token",
      secretValue: access)
    let refreshRef: SecretReference
    do {
      refreshRef = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Cal.com OAuth refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    let railway = RelayCloudLaunchContract.configuredRailwayOrigin
    let callback = railway.map { $0 + "/api/v1/oauth/cal-com/callback" }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "cal_com_oauth_access_token", label: "Cal.com OAuth access token", required: true,
        userOwnedRequired: false, secretReferenceId: accessRef.id, status: .verified,
        helpText: "Thirty-minute bearer token stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "cal_com_oauth_refresh_token", label: "Cal.com OAuth refresh token",
        required: true, userOwnedRequired: false, secretReferenceId: refreshRef.id,
        status: .verified,
        helpText:
          "Provider-returned refresh credential atomically replaced with each complete pair.",
        redactionStatus: "secret-reference-only"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "cal-com-relay-owned-oauth:\(exactUserId)", providerName: "Cal.com",
      status: .connected, authorizationState: .completed, credentialOwnership: .relayOwned,
      userOwnedCredentialsRequired: false, credentialRequirements: requirements,
      secretReferenceIds: [accessRef.id, refreshRef.id],
      accountLabel: accountLabel?.providerConnectionNilIfEmpty ?? name, connectedHandle: handle,
      callbackURL: callback, requiredScopes: Self.calComRelayOwnedOAuthScopes,
      grantedScopes: grantedScopes, selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message:
          "Cal.com OAuth references are ready for the exact-user Booking and Event Type boundary.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("cal-com"),
          "authMethod": .string("oauth2_authorization_code_access_refresh_pair"),
          "relayOwnedCalComOAuth": .bool(true), "readOnlyV1": .bool(true),
          "userId": .string(exactUserId), "userName": .string(name), "username": .string(handle),
          "apiOrigin": .string("https://api.cal.com/v2"),
          "accessExpiresAt": accessExpiresAt.map(JSONValue.string) ?? .null,
          "accessTokenLifetimeSeconds": .number(1800), "refreshRotationDocumented": .bool(false),
          "tokenPairReplacement": .string("serialized-atomic-provider-returned-pair-replacement"),
          "exactScopes": .array(Self.calComRelayOwnedOAuthScopes.map(JSONValue.string)),
          "legacyBroadTokenAllowed": .bool(false), "teamOrOrganizationScopesAllowed": .bool(false),
          "bookingOrEventTypeWritesAllowed": .bool(false),
          "privateSchedulingDataReturned": .bool(false), "automaticPaginationAllowed": .bool(false),
          "unboundedEventTypeListAllowed": .bool(false), "arbitraryQueryAllowed": .bool(false),
          "requiresSecureWebBackend": .bool(true),
          "productionCallbackConfigured": .bool(callback != nil),
          "callbackTransport": .string("railway-https-only"),
          "rawTokenStoredInDatabase": .bool(false), "rawProviderToolExposure": .bool(false),
        ], redactionStatus: "private-state-excluded"), senderIdentities: [],
      installPolicy: "approval_gated_cal_com_booking_event_type_reads", lastCheckedAt: timestamp,
      lastError: nil,
      manualEvidenceNote: callback == nil
        ? "Production Cal.com OAuth requires CLAWCHAT_RAILWAY_ORIGIN and a reviewed scoped client plus deployed exchange/me-validation/serialized-refresh/disconnect broker."
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

  @discardableResult public func rotateCalComOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String, accessExpiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    calComTokenRotationLock.lock()
    defer { calComTokenRotationLock.unlock() }
    guard
      let existing = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId), existing.appSlug == "cal-com"
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Cal.com connection is required for token replacement.")
    }
    let d = existing.health.diagnostics
    return try saveCalComRelayOwnedOAuthConnection(
      context: context, appIdOrSlug: existing.appId, accessToken: accessToken,
      refreshToken: refreshToken, userId: d["userId"]?.string ?? "",
      userName: d["userName"]?.string ?? "", username: d["username"]?.string ?? "",
      accountLabel: existing.accountLabel, accessExpiresAt: accessExpiresAt,
      grantedScopes: existing.grantedScopes, now: now)
  }

  @discardableResult
  public func saveDocusignRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    userId: String, userName: String, accountId: String, accountName: String, baseURI: String,
    accessExpiresAt: String?,
    grantedScopes: [String] = ProviderConnectionService.docusignRelayOwnedOAuthScopes,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "docusign")
    guard app.slug == "docusign" else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "Docusign OAuth can only be saved for the Docusign Marketplace app.")
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "Docusign OAuth access token", maxLength: 30000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "Docusign OAuth refresh token", maxLength: 30000)
    let exactUserId = try requireNonEmptyString(
      userId, field: "Docusign UserInfo subject", maxLength: 64)
    let name = try requireNonEmptyString(userName, field: "Docusign user name", maxLength: 256)
    let exactAccountId = try requireNonEmptyString(
      accountId, field: "Docusign account ID", maxLength: 64)
    let selectedAccountName = try requireNonEmptyString(
      accountName, field: "Docusign account name", maxLength: 256)
    let exactBaseURI = try requireNonEmptyString(
      baseURI, field: "Docusign account base URI", maxLength: 256)
    guard Self.isSafeDocusignIdentifier(exactUserId), Self.isSafeDocusignIdentifier(exactAccountId),
      Self.isSafeDocusignBaseURI(exactBaseURI), grantedScopes == Self.docusignRelayOwnedOAuthScopes
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "Docusign requires an exact UserInfo user/account, official HTTPS base URI, and only signature extended."
      )
    }
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let oldRefs = existing.map(Self.secretReferenceIds(in:)) ?? []
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Docusign OAuth access token",
      secretValue: access)
    let refreshRef: SecretReference
    do {
      refreshRef = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Docusign OAuth refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    let railway = RelayCloudLaunchContract.configuredRailwayOrigin
    let callback = railway.map { $0 + "/api/v1/oauth/docusign/callback" }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "docusign_oauth_access_token", label: "Docusign OAuth access token",
        required: true, userOwnedRequired: false, secretReferenceId: accessRef.id,
        status: .verified, helpText: "Eight-hour bearer token stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "docusign_oauth_refresh_token", label: "Docusign OAuth refresh token",
        required: true, userOwnedRequired: false, secretReferenceId: refreshRef.id,
        status: .verified,
        helpText:
          "Extended 30-day refresh token atomically replaced with each provider-returned value.",
        redactionStatus: "secret-reference-only"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "docusign-relay-owned-oauth:" + exactAccountId, providerName: "Docusign",
      status: .connected, authorizationState: .completed, credentialOwnership: .relayOwned,
      userOwnedCredentialsRequired: false, credentialRequirements: requirements,
      secretReferenceIds: [accessRef.id, refreshRef.id], accountLabel: selectedAccountName,
      connectedHandle: name, callbackURL: callback,
      requiredScopes: Self.docusignRelayOwnedOAuthScopes, grantedScopes: grantedScopes,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message:
          "Docusign OAuth references are ready for the exact user and selected-account Envelope boundary.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("docusign"),
          "authMethod": .string("oauth2_authorization_code_pkce_access_refresh_pair"),
          "relayOwnedDocusignOAuth": .bool(true), "readOnlyV1": .bool(true),
          "userId": .string(exactUserId), "userName": .string(name),
          "accountId": .string(exactAccountId), "accountName": .string(selectedAccountName),
          "baseURI": .string(exactBaseURI),
          "accessExpiresAt": accessExpiresAt.map(JSONValue.string) ?? .null,
          "accessTokenLifetimeSeconds": .number(28800), "refreshTokenLifetimeDays": .number(30),
          "extendedRefreshLifetimeRenewedOnUse": .bool(true),
          "tokenPairReplacement": .string("serialized-atomic-provider-returned-pair-replacement"),
          "exactScopes": .array(Self.docusignRelayOwnedOAuthScopes.map(JSONValue.string)),
          "selectedAccountRequired": .bool(true), "recipientOrSenderIdentityReturned": .bool(false),
          "documentOrTabDataReturned": .bool(false), "envelopeWritesAllowed": .bool(false),
          "automaticPaginationAllowed": .bool(false),
          "exactResourcePollingMinimumSeconds": .number(900), "arbitraryQueryAllowed": .bool(false),
          "requiresSecureWebBackend": .bool(true),
          "productionCallbackConfigured": .bool(callback != nil),
          "callbackTransport": .string("railway-https-only"),
          "rawTokenStoredInDatabase": .bool(false), "rawProviderToolExposure": .bool(false),
        ], redactionStatus: "private-envelope-state-excluded"), senderIdentities: [],
      installPolicy: "approval_gated_docusign_envelope_reads", lastCheckedAt: timestamp,
      lastError: nil,
      manualEvidenceNote: callback == nil
        ? "Production Docusign OAuth requires CLAWCHAT_RAILWAY_ORIGIN, a Go-Live integration key and deployed exchange/UserInfo/account-routing/serialized-refresh/disconnect broker."
        : nil, reauthorizeRequired: false, disconnecting: false, betaBlocked: false,
      createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp,
      redactionStatus: "private-envelope-state-excluded")
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

  @discardableResult public func rotateDocusignOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String, accessExpiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    docusignTokenRotationLock.lock()
    defer { docusignTokenRotationLock.unlock() }
    guard
      let existing = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      existing.appSlug == "docusign"
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Docusign connection is required for token replacement.")
    }
    let d = existing.health.diagnostics
    return try saveDocusignRelayOwnedOAuthConnection(
      context: context, appIdOrSlug: existing.appId, accessToken: accessToken,
      refreshToken: refreshToken, userId: d["userId"]?.string ?? "",
      userName: d["userName"]?.string ?? "", accountId: d["accountId"]?.string ?? "",
      accountName: d["accountName"]?.string ?? "", baseURI: d["baseURI"]?.string ?? "",
      accessExpiresAt: accessExpiresAt, grantedScopes: existing.grantedScopes, now: now)
  }

  @discardableResult
  public func saveDropboxSignRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    accountId: String, accountLabel: String?, locale: String?, isLocked: Bool, isPaid: Bool,
    accessExpiresAt: String?,
    grantedScopes: [String] = ProviderConnectionService.dropboxSignRelayOwnedOAuthScopes,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "dropbox-sign")
    guard app.slug == "dropbox-sign" else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "Dropbox Sign OAuth can only be saved for the Dropbox Sign Marketplace app.")
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "Dropbox Sign OAuth access token", maxLength: 30000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "Dropbox Sign OAuth refresh token", maxLength: 30000)
    let exactAccountId = try requireNonEmptyString(
      accountId, field: "Dropbox Sign account ID", maxLength: 64)
    let safeLocale = locale?.providerConnectionNilIfEmpty
    guard Self.isSafeDropboxSignIdentifier(exactAccountId),
      safeLocale == nil || Self.isSafeDropboxSignLocale(safeLocale!),
      grantedScopes == Self.dropboxSignRelayOwnedOAuthScopes
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "Dropbox Sign requires the exact token/account-validated hexadecimal account ID and only account_access signature_request_access."
      )
    }
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let oldRefs = existing.map(Self.secretReferenceIds(in:)) ?? []
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Dropbox Sign OAuth access token",
      secretValue: access)
    let refreshRef: SecretReference
    do {
      refreshRef = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Dropbox Sign OAuth refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    let railway = RelayCloudLaunchContract.configuredRailwayOrigin
    let callback = railway.map { $0 + "/api/v1/oauth/dropbox-sign/callback" }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let display =
      accountLabel?.providerConnectionNilIfEmpty ?? "Dropbox Sign account "
      + String(exactAccountId.suffix(8))
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "dropbox_sign_oauth_access_token", label: "Dropbox Sign OAuth access token",
        required: true, userOwnedRequired: false, secretReferenceId: accessRef.id,
        status: .verified,
        helpText: "Provider-expiring bearer token stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "dropbox_sign_oauth_refresh_token", label: "Dropbox Sign OAuth refresh token",
        required: true, userOwnedRequired: false, secretReferenceId: refreshRef.id,
        status: .verified,
        helpText: "Provider-returned refresh token atomically replaced with each complete pair.",
        redactionStatus: "secret-reference-only"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "dropbox-sign-relay-owned-oauth:" + exactAccountId, providerName: "Dropbox Sign",
      status: isLocked ? .healthError : .connected, authorizationState: .completed,
      credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
      credentialRequirements: requirements, secretReferenceIds: [accessRef.id, refreshRef.id],
      accountLabel: display, connectedHandle: String(exactAccountId.suffix(8)),
      callbackURL: callback, requiredScopes: Self.dropboxSignRelayOwnedOAuthScopes,
      grantedScopes: grantedScopes, selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: isLocked ? .degraded : .ready,
        message: isLocked
          ? "Dropbox Sign reports this exact account locked."
          : "Dropbox Sign OAuth references are ready for the exact-account app-visible Signature Request boundary.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("dropbox-sign"),
          "authMethod": .string("oauth2_authorization_code_access_refresh_pair"),
          "relayOwnedDropboxSignOAuth": .bool(true), "userChargedBillingModel": .bool(true),
          "readOnlyV1": .bool(true), "accountId": .string(exactAccountId),
          "locale": safeLocale.map(JSONValue.string) ?? .null, "accountLocked": .bool(isLocked),
          "accountPaid": .bool(isPaid), "apiOrigin": .string("https://api.hellosign.com/v3"),
          "accessExpiresAt": accessExpiresAt.map(JSONValue.string) ?? .null,
          "documentedTypicalAccessTokenLifetimeSeconds": .number(3600),
          "providerExpiresInAuthoritative": .bool(true), "refreshRotationDocumented": .bool(false),
          "tokenPairReplacement": .string("serialized-atomic-provider-returned-pair-replacement"),
          "exactScopes": .array(Self.dropboxSignRelayOwnedOAuthScopes.map(JSONValue.string)),
          "apiAppCreatedRequestsOnly": .bool(true), "participantIdentityReturned": .bool(false),
          "documentsOrFormResponsesReturned": .bool(false),
          "signatureRequestWritesAllowed": .bool(false), "automaticPaginationAllowed": .bool(false),
          "arbitraryQueryAllowed": .bool(false), "requiresSecureWebBackend": .bool(true),
          "productionCallbackConfigured": .bool(callback != nil),
          "callbackTransport": .string("railway-https-only"),
          "rawTokenStoredInDatabase": .bool(false), "rawProviderToolExposure": .bool(false),
        ], redactionStatus: "private-signature-request-state-excluded"), senderIdentities: [],
      installPolicy: "approval_gated_dropbox_sign_signature_request_reads",
      lastCheckedAt: timestamp, lastError: nil,
      manualEvidenceNote: callback == nil
        ? "Production Dropbox Sign OAuth requires CLAWCHAT_RAILWAY_ORIGIN, approved user-charged API App scopes and deployed exchange/account-validation/serialized-refresh/disconnect broker."
        : nil, reauthorizeRequired: false, disconnecting: false, betaBlocked: false,
      createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp,
      redactionStatus: "private-signature-request-state-excluded")
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

  @discardableResult public func rotateDropboxSignOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String, accessExpiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    dropboxSignTokenRotationLock.lock()
    defer { dropboxSignTokenRotationLock.unlock() }
    guard
      let existing = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      existing.appSlug == "dropbox-sign"
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Dropbox Sign connection is required for token replacement.")
    }
    let d = existing.health.diagnostics
    return try saveDropboxSignRelayOwnedOAuthConnection(
      context: context, appIdOrSlug: existing.appId, accessToken: accessToken,
      refreshToken: refreshToken, accountId: d["accountId"]?.string ?? "",
      accountLabel: existing.accountLabel, locale: d["locale"]?.string,
      isLocked: d["accountLocked"]?.bool ?? false, isPaid: d["accountPaid"]?.bool ?? false,
      accessExpiresAt: accessExpiresAt, grantedScopes: existing.grantedScopes, now: now)
  }

  @discardableResult
  public func savePandaDocRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    membershipId: String, membershipLabel: String?, workspaceId: String, workspaceName: String?,
    accessExpiresAt: String?,
    grantedScopes: [String] = ProviderConnectionService.pandaDocRelayOwnedOAuthScopes,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "pandadoc")
    guard app.slug == "pandadoc" else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "PandaDoc OAuth can only be saved for the PandaDoc Marketplace app.")
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "PandaDoc OAuth access token", maxLength: 30000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "PandaDoc OAuth refresh token", maxLength: 30000)
    let exactMembershipId = try requireNonEmptyString(
      membershipId, field: "PandaDoc membership ID", maxLength: 64)
    let exactWorkspaceId = try requireNonEmptyString(
      workspaceId, field: "PandaDoc workspace ID", maxLength: 64)
    guard Self.isSafePandaDocIdentifier(exactMembershipId),
      Self.isSafePandaDocIdentifier(exactWorkspaceId),
      grantedScopes == Self.pandaDocRelayOwnedOAuthScopes
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "PandaDoc requires exact token-validated membership/workspace IDs and only the read scope."
      )
    }
    let safeMembershipLabel = membershipLabel?.providerConnectionNilIfEmpty.map {
      String($0.prefix(200))
    }
    let safeWorkspaceName = workspaceName?.providerConnectionNilIfEmpty.map {
      String($0.prefix(200))
    }
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let oldRefs = existing.map(Self.secretReferenceIds(in:)) ?? []
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "PandaDoc OAuth access token",
      secretValue: access)
    let refreshRef: SecretReference
    do {
      refreshRef = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "PandaDoc OAuth refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    let railway = RelayCloudLaunchContract.configuredRailwayOrigin
    let callback = railway.map { $0 + "/api/v1/oauth/pandadoc/callback" }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let display = safeWorkspaceName ?? "PandaDoc workspace " + String(exactWorkspaceId.suffix(8))
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "pandadoc_oauth_access_token", label: "PandaDoc OAuth access token",
        required: true, userOwnedRequired: false, secretReferenceId: accessRef.id,
        status: .verified,
        helpText: "Provider-expiring bearer token stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "pandadoc_oauth_refresh_token", label: "PandaDoc OAuth refresh token",
        required: true, userOwnedRequired: false, secretReferenceId: refreshRef.id,
        status: .verified,
        helpText: "Provider-returned refresh token atomically replaced with each complete pair.",
        redactionStatus: "secret-reference-only"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "pandadoc-relay-owned-oauth:" + exactWorkspaceId, providerName: "PandaDoc",
      status: .connected, authorizationState: .completed, credentialOwnership: .relayOwned,
      userOwnedCredentialsRequired: false, credentialRequirements: requirements,
      secretReferenceIds: [accessRef.id, refreshRef.id], accountLabel: display,
      connectedHandle: safeMembershipLabel ?? String(exactMembershipId.suffix(8)),
      callbackURL: callback, requiredScopes: Self.pandaDocRelayOwnedOAuthScopes,
      grantedScopes: grantedScopes, selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message:
          "PandaDoc OAuth references are ready for the exact membership and selected token-bound workspace.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("pandadoc"),
          "authMethod": .string("oauth2_authorization_code_access_refresh_pair"),
          "relayOwnedPandaDocOAuth": .bool(true), "readOnlyV1": .bool(true),
          "membershipId": .string(exactMembershipId),
          "membershipLabel": safeMembershipLabel.map(JSONValue.string) ?? .null,
          "workspaceId": .string(exactWorkspaceId),
          "workspaceName": safeWorkspaceName.map(JSONValue.string) ?? .null,
          "apiOrigin": .string("https://api.pandadoc.com/public/v1"),
          "accessExpiresAt": accessExpiresAt.map(JSONValue.string) ?? .null,
          "accessTokenLifetimeSeconds": .number(31_535_999),
          "providerExpiresInAuthoritative": .bool(true), "refreshRotationDocumented": .bool(false),
          "tokenPairReplacement": .string("serialized-atomic-provider-returned-pair-replacement"),
          "exactScopes": .array(Self.pandaDocRelayOwnedOAuthScopes.map(JSONValue.string)),
          "detailsEndpointAllowed": .bool(false), "privateDocumentDataReturned": .bool(false),
          "documentWritesAllowed": .bool(false), "automaticPaginationAllowed": .bool(false),
          "arbitraryQueryAllowed": .bool(false), "requiresSecureWebBackend": .bool(true),
          "productionCallbackConfigured": .bool(callback != nil),
          "callbackTransport": .string("railway-https-only"),
          "rawTokenStoredInDatabase": .bool(false), "rawProviderToolExposure": .bool(false),
        ], redactionStatus: "private-document-state-excluded"), senderIdentities: [],
      installPolicy: "approval_gated_pandadoc_document_reads", lastCheckedAt: timestamp,
      lastError: nil,
      manualEvidenceNote: callback == nil
        ? "Production PandaDoc OAuth requires CLAWCHAT_RAILWAY_ORIGIN, Developer Dashboard/API plan access, exact membership/workspace validation, and deployed exchange/serialized-refresh/disconnect broker."
        : nil, reauthorizeRequired: false, disconnecting: false, betaBlocked: false,
      createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp,
      redactionStatus: "private-document-state-excluded")
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

  @discardableResult public func rotatePandaDocOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String, accessExpiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    pandaDocTokenRotationLock.lock()
    defer { pandaDocTokenRotationLock.unlock() }
    guard
      let existing = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      existing.appSlug == "pandadoc"
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "PandaDoc connection is required for token replacement.")
    }
    let d = existing.health.diagnostics
    return try savePandaDocRelayOwnedOAuthConnection(
      context: context, appIdOrSlug: existing.appId, accessToken: accessToken,
      refreshToken: refreshToken, membershipId: d["membershipId"]?.string ?? "",
      membershipLabel: d["membershipLabel"]?.string, workspaceId: d["workspaceId"]?.string ?? "",
      workspaceName: d["workspaceName"]?.string, accessExpiresAt: accessExpiresAt,
      grantedScopes: existing.grantedScopes, now: now)
  }
}
