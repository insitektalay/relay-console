import Foundation

extension ProviderConnectionService {
  @discardableResult public func saveMicrosoftVivaEngageRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    accountEmail: String, accountLabel: String?, tenantId: String, currentUserId: String,
    currentUserDisplayName: String, networkId: String, networkName: String,
    selectedCommunityId: String, selectedCommunityName: String, selectedCommunityVerified: Bool,
    grantedScopes: [String], expiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "microsoft-viva-engage")
    let email = accountEmail.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
    let tenant = tenantId.trimmingCharacters(in: .whitespacesAndNewlines)
    let userId = try MicrosoftVivaEngageProviderActionSupport.identifier(
      currentUserId, "currentUserId")
    let netId = try MicrosoftVivaEngageProviderActionSupport.identifier(networkId, "networkId")
    let communityId = try MicrosoftVivaEngageProviderActionSupport.identifier(
      selectedCommunityId, "selectedCommunityId")
    let userName = currentUserDisplayName.trimmingCharacters(in: .whitespacesAndNewlines)
    let netName = networkName.trimmingCharacters(in: .whitespacesAndNewlines)
    let communityName = selectedCommunityName.trimmingCharacters(in: .whitespacesAndNewlines)
    guard app.slug == "microsoft-viva-engage", email.count <= 320, email.contains("@"),
      Self.isSafeMicrosoftTenantId(tenant), tenant.lowercased() != "consumers",
      selectedCommunityVerified, !userName.isEmpty, !netName.isEmpty, !communityName.isEmpty,
      userName.count <= 512, netName.count <= 512, communityName.count <= 512,
      grantedScopes == Self.microsoftVivaEngageRelayOwnedOAuthScopes
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "Viva Engage requires exact delegated access_as_user, a work tenant, bound current user/network, and one verified selected community."
      )
    }
    try validateAppCanAuthorize(app, context: context)
    let id = createRelayId("mpc")
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let access = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Viva Engage OAuth access token",
      secretValue: try requireNonEmptyString(
        accessToken, field: "Viva Engage access token", maxLength: 30000))
    let refresh = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Viva Engage OAuth refresh token",
      secretValue: try requireNonEmptyString(
        refreshToken, field: "Viva Engage refresh token", maxLength: 30000))
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "microsoft_viva_engage_oauth_access_token",
        label: "Viva Engage OAuth access token", required: true, userOwnedRequired: false,
        secretReferenceId: access.id, status: .verified,
        helpText: "Railway-rotated delegated token.", redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "microsoft_viva_engage_oauth_refresh_token",
        label: "Viva Engage OAuth refresh token", required: true, userOwnedRequired: false,
        secretReferenceId: refresh.id, status: .verified, helpText: "Railway-only offline token.",
        redactionStatus: "secret-reference-only"),
    ]
    let diagnostics: [String: JSONValue] = [
      "apiOrigin": .string("https://www.yammer.com/api/v1"), "workSchoolOnly": .bool(true),
      "entraTokensOnly": .bool(true), "currentUserId": .string(userId),
      "currentUserDisplayName": .string(userName), "networkId": .string(netId),
      "networkName": .string(netName), "selectedCommunityId": .string(communityId),
      "selectedCommunityName": .string(communityName), "selectedCommunityVerified": .bool(true),
      "getOnly": .bool(true), "privateMessagesEnabled": .bool(false),
      "globalFeedsEnabled": .bool(false), "identitiesMembersEnabled": .bool(false),
      "attachmentsEnabled": .bool(false), "searchExportEnabled": .bool(false),
      "writesEnabled": .bool(false), "adminEnabled": .bool(false),
      "automaticPagination": .bool(false), "rawToolsEnabled": .bool(false),
      "maxResults": .number(25), "pkceS256": .bool(true),
      "accessExpiresAt": expiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "microsoft-viva-engage-relay-owned-oauth:" + tenant + ":" + email + ":"
        + communityId, providerName: "Microsoft Viva Engage", status: .connected,
      authorizationState: .completed, credentialOwnership: .relayOwned,
      userOwnedCredentialsRequired: false, credentialRequirements: requirements,
      secretReferenceIds: [access.id, refresh.id],
      accountLabel: accountLabel?.providerConnectionNilIfEmpty ?? communityName,
      connectedHandle: email,
      callbackURL: nil, requiredScopes: Self.microsoftVivaEngageRelayOwnedOAuthScopes,
      grantedScopes: Self.microsoftVivaEngageRelayOwnedOAuthScopes,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready, message: "Viva Engage is ready for four selected-community GET reads.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [], diagnostics: diagnostics,
        redactionStatus: "private-state-excluded"), senderIdentities: [],
      installPolicy: "selected_viva_engage_community_get_only", lastCheckedAt: timestamp,
      lastError: nil, manualEvidenceNote: nil, reauthorizeRequired: false, disconnecting: false,
      betaBlocked: false, createdAt: timestamp, updatedAt: timestamp,
      redactionStatus: "private-state-excluded")
    do { return try saveConnection(context: context, connection: connection) } catch {
      _ = try? secrets.delete(access.id)
      _ = try? secrets.delete(refresh.id)
      throw error
    }
  }
  @discardableResult public func rotateMicrosoftVivaEngageRelayOwnedOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String?, expiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    microsoftVivaEngageTokenRotationLock.lock()
    defer { microsoftVivaEngageTokenRotationLock.unlock() }
    guard
      var connection = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      connection.appSlug == "microsoft-viva-engage", connection.credentialOwnership == .relayOwned,
      connection.grantedScopes == Self.microsoftVivaEngageRelayOwnedOAuthScopes,
      connection.health.diagnostics["selectedCommunityVerified"]?.bool == true
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "An exact selected-community Viva Engage connection is required."
      )
    }
    let accessValue = try requireNonEmptyString(
      accessToken, field: "Viva Engage OAuth access token", maxLength: 30000)
    let oldAccess = connection.credentialRequirements.first {
      $0.fieldKey == "microsoft_viva_engage_oauth_access_token"
    }?.secretReferenceId
    let oldRefresh = connection.credentialRequirements.first {
      $0.fieldKey == "microsoft_viva_engage_oauth_refresh_token"
    }?.secretReferenceId
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: connection.id, label: "Viva Engage OAuth access token",
      secretValue: accessValue)
    let refreshRef = try refreshToken?.providerConnectionNilIfEmpty.map {
      try secrets.set(
        scope: "provider_connection", scopeId: connection.id,
        label: "Viva Engage OAuth refresh token", secretValue: $0)
    }
    connection.credentialRequirements = connection.credentialRequirements.map { value in
      var copy = value
      if copy.fieldKey == "microsoft_viva_engage_oauth_access_token" {
        copy.secretReferenceId = accessRef.id
      }
      if copy.fieldKey == "microsoft_viva_engage_oauth_refresh_token", let refreshRef {
        copy.secretReferenceId = refreshRef.id
      }
      return copy
    }
    connection.secretReferenceIds = [accessRef.id, refreshRef?.id ?? oldRefresh].compactMap { $0 }
    connection.updatedAt = ISO8601DateFormatter.relayConsole.string(from: now)
    connection.health.diagnostics["accessExpiresAt"] =
      expiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null
    do {
      let saved = try saveConnection(context: context, connection: connection)
      if let oldAccess { _ = try? secrets.delete(oldAccess) }
      if refreshRef != nil, let oldRefresh { _ = try? secrets.delete(oldRefresh) }
      return saved
    } catch {
      _ = try? secrets.delete(accessRef.id)
      if let refreshRef { _ = try? secrets.delete(refreshRef.id) }
      throw error
    }
  }
  @discardableResult public func saveMicrosoftDynamics365RelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    accountEmail: String, accountLabel: String?, tenantId: String, environmentOrigin: String,
    environmentDisplayName: String, selectedEnvironmentVerified: Bool,
    standardSalesTablesVerified: Bool, grantedScopes: [String], expiresAt: String?,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "microsoft-dynamics-365")
    let email = accountEmail.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
    let tenant = tenantId.trimmingCharacters(in: .whitespacesAndNewlines)
    let origin = try MicrosoftDynamics365ProviderActionSupport.environmentOrigin(environmentOrigin)
    let displayName = environmentDisplayName.trimmingCharacters(in: .whitespacesAndNewlines)
    let exactScopes = try Self.microsoftDynamics365RelayOwnedOAuthScopes(environmentOrigin: origin)
    guard app.slug == "microsoft-dynamics-365", email.count <= 320, email.contains("@"),
      Self.isSafeMicrosoftTenantId(tenant), tenant.lowercased() != "consumers",
      selectedEnvironmentVerified, standardSalesTablesVerified, !displayName.isEmpty,
      displayName.count <= 512, grantedScopes == exactScopes
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "Dynamics 365 requires an exact environment user_impersonation scope, work tenant, and verified standard Sales environment."
      )
    }
    try validateAppCanAuthorize(app, context: context)
    let id = createRelayId("mpc")
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let a = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Dynamics 365 OAuth access token",
      secretValue: try requireNonEmptyString(
        accessToken, field: "Dynamics 365 access token", maxLength: 30000))
    let r = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Dynamics 365 OAuth refresh token",
      secretValue: try requireNonEmptyString(
        refreshToken, field: "Dynamics 365 refresh token", maxLength: 30000))
    let reqs = [
      ProviderCredentialRequirement(
        fieldKey: "microsoft_dynamics_365_oauth_access_token",
        label: "Dynamics 365 OAuth access token", required: true, userOwnedRequired: false,
        secretReferenceId: a.id, status: .verified, helpText: "Railway-rotated delegated token.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "microsoft_dynamics_365_oauth_refresh_token",
        label: "Dynamics 365 OAuth refresh token", required: true, userOwnedRequired: false,
        secretReferenceId: r.id, status: .verified, helpText: "Railway-only offline token.",
        redactionStatus: "secret-reference-only"),
    ]
    let d: [String: JSONValue] = [
      "environmentOrigin": .string(origin), "apiRoot": .string(origin + "/api/data/v9.2"),
      "workSchoolOnly": .bool(true), "environmentDisplayName": .string(displayName),
      "selectedEnvironmentVerified": .bool(true), "standardSalesTablesVerified": .bool(true),
      "getOnly": .bool(true), "fixedSelectOnly": .bool(true), "customTablesEnabled": .bool(false),
      "identitiesContactsEnabled": .bool(false), "searchExpandFetchXMLEnabled": .bool(false),
      "schemaActionsBatchEnabled": .bool(false), "writesEnabled": .bool(false),
      "applicationPermissionsEnabled": .bool(false), "exportsEnabled": .bool(false),
      "automaticPagination": .bool(false), "rawToolsEnabled": .bool(false),
      "maxResults": .number(25), "pkceS256": .bool(true),
      "accessExpiresAt": expiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
    ]
    let c = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "microsoft-dynamics-365-relay-owned-oauth:" + tenant + ":" + email + ":"
        + origin, providerName: "Microsoft Dynamics 365", status: .connected,
      authorizationState: .completed, credentialOwnership: .relayOwned,
      userOwnedCredentialsRequired: false, credentialRequirements: reqs,
      secretReferenceIds: [a.id, r.id],
      accountLabel: accountLabel?.providerConnectionNilIfEmpty ?? displayName,
      connectedHandle: email, callbackURL: nil, requiredScopes: exactScopes,
      grantedScopes: exactScopes, selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message: "Dynamics 365 is ready for four fixed selected-environment GET reads.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [], diagnostics: d,
        redactionStatus: "private-state-excluded"), senderIdentities: [],
      installPolicy: "selected_dataverse_environment_fixed_get_only", lastCheckedAt: timestamp,
      lastError: nil, manualEvidenceNote: nil, reauthorizeRequired: false, disconnecting: false,
      betaBlocked: false, createdAt: timestamp, updatedAt: timestamp,
      redactionStatus: "private-state-excluded")
    do { return try saveConnection(context: context, connection: c) } catch {
      _ = try? secrets.delete(a.id)
      _ = try? secrets.delete(r.id)
      throw error
    }
  }
  @discardableResult public func rotateMicrosoftDynamics365RelayOwnedOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String?, expiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    microsoftDynamics365TokenRotationLock.lock()
    defer { microsoftDynamics365TokenRotationLock.unlock() }
    guard
      var connection = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      connection.appSlug == "microsoft-dynamics-365", connection.credentialOwnership == .relayOwned,
      let origin = connection.health.diagnostics["environmentOrigin"]?.string,
      connection.grantedScopes
        == (try Self.microsoftDynamics365RelayOwnedOAuthScopes(environmentOrigin: origin)),
      connection.health.diagnostics["selectedEnvironmentVerified"]?.bool == true
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "An exact selected-environment Dynamics 365 connection is required.")
    }
    let access = try requireNonEmptyString(
      accessToken, field: "Dynamics 365 OAuth access token", maxLength: 30000)
    let oldAccess = connection.credentialRequirements.first {
      $0.fieldKey == "microsoft_dynamics_365_oauth_access_token"
    }?.secretReferenceId
    let oldRefresh = connection.credentialRequirements.first {
      $0.fieldKey == "microsoft_dynamics_365_oauth_refresh_token"
    }?.secretReferenceId
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: connection.id,
      label: "Dynamics 365 OAuth access token", secretValue: access)
    let refreshRef = try refreshToken?.providerConnectionNilIfEmpty.map {
      try secrets.set(
        scope: "provider_connection", scopeId: connection.id,
        label: "Dynamics 365 OAuth refresh token", secretValue: $0)
    }
    connection.credentialRequirements = connection.credentialRequirements.map { value in
      var copy = value
      if copy.fieldKey == "microsoft_dynamics_365_oauth_access_token" {
        copy.secretReferenceId = accessRef.id
      }
      if copy.fieldKey == "microsoft_dynamics_365_oauth_refresh_token", let refreshRef {
        copy.secretReferenceId = refreshRef.id
      }
      return copy
    }
    connection.secretReferenceIds = [accessRef.id, refreshRef?.id ?? oldRefresh].compactMap { $0 }
    connection.updatedAt = ISO8601DateFormatter.relayConsole.string(from: now)
    connection.health.diagnostics["accessExpiresAt"] =
      expiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null
    do {
      let saved = try saveConnection(context: context, connection: connection)
      if let oldAccess { _ = try? secrets.delete(oldAccess) }
      if refreshRef != nil, let oldRefresh { _ = try? secrets.delete(oldRefresh) }
      return saved
    } catch {
      _ = try? secrets.delete(accessRef.id)
      if let refreshRef { _ = try? secrets.delete(refreshRef.id) }
      throw error
    }
  }
}
