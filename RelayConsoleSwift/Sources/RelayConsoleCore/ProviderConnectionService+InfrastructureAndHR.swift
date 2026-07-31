import Foundation

extension ProviderConnectionService {
  @discardableResult
  public func saveCloudflareRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    accountId: String, accountName: String, zoneId: String, zoneName: String,
    grantedScopes: [String], expiresAt: String?, displayName: String? = nil, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "cloudflare")
    let account = accountId.lowercased()
    let zone = zoneId.lowercased()
    let accountLabel = accountName.trimmingCharacters(in: .whitespacesAndNewlines)
    let zoneLabel = zoneName.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    guard app.slug == "cloudflare", CloudflareProviderActionSupport.safeId(account),
      CloudflareProviderActionSupport.safeId(zone), !accountLabel.isEmpty,
      accountLabel.count <= 120, !zoneLabel.isEmpty, zoneLabel.count <= 253,
      !zoneLabel.contains("/"), Set(grantedScopes) == Set(Self.cloudflareReadScopes),
      grantedScopes.count == Self.cloudflareReadScopes.count
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "Cloudflare OAuth requires the exact read scopes and one safe account and selected zone.")
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "Cloudflare OAuth access token", maxLength: 30000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "Cloudflare OAuth refresh token", maxLength: 30000)
    let id = createRelayId("mpc")
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let a = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Cloudflare OAuth access token",
      secretValue: access)
    let r: SecretReference
    do {
      r = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Cloudflare OAuth refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(a.id)
      throw error
    }
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "cloudflare-relay-owned-oauth:" + account + ":" + zone,
      providerName: "Cloudflare", status: .connected, authorizationState: .completed,
      credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
      credentialRequirements: [
        ProviderCredentialRequirement(
          fieldKey: "cloudflare_oauth_access_token", label: "Cloudflare OAuth access token",
          required: true, userOwnedRequired: false, secretReferenceId: a.id, status: .verified,
          helpText: "Scoped access token stored only as a Keychain reference.",
          redactionStatus: "secret-reference-only"),
        ProviderCredentialRequirement(
          fieldKey: "cloudflare_oauth_refresh_token", label: "Cloudflare OAuth refresh token",
          required: true, userOwnedRequired: false, secretReferenceId: r.id, status: .verified,
          helpText: "Refresh token stored separately for serialized full-pair replacement.",
          redactionStatus: "secret-reference-only"),
        ProviderCredentialRequirement(
          fieldKey: "cloudflare_account_zone", label: "Cloudflare account and selected zone",
          required: true, userOwnedRequired: false, secretReferenceId: nil, status: .verified,
          helpText:
            "One exact consented account and selected zone are bound as non-secret metadata.",
          redactionStatus: "private-state-excluded"),
      ], secretReferenceIds: [a.id, r.id],
      accountLabel: displayName?.providerConnectionNilIfEmpty ?? accountLabel + " · " + zoneLabel,
      connectedHandle: zoneLabel, callbackURL: nil, requiredScopes: Self.cloudflareReadScopes,
      grantedScopes: Self.cloudflareReadScopes, selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message:
          "Cloudflare OAuth is ready for bounded selected-account zone and aggregate traffic reads.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("cloudflare"),
          "authMethod": .string("oauth2_authorization_code_s256_confidential_hosted_broker"),
          "apiOrigin": .string(CloudflareProviderActionSupport.apiOrigin),
          "accountId": .string(account), "accountName": .string(accountLabel),
          "zoneId": .string(zone), "zoneName": .string(zoneLabel),
          "accessExpiresAt": expiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
          "tokenPairReplacement": .string("serialized-complete-provider-returned-pair-replacement"),
          "exactScopes": .array(Self.cloudflareReadScopes.map(JSONValue.string)),
          "clientSecretLocation": .string("secure-railway-broker-only"),
          "publicClientPublisherDomain": .string("verified-required"),
          "rawTokenStoredInDatabase": .bool(false), "rawProviderToolExposure": .bool(false),
        ], redactionStatus: "private-state-excluded"), senderIdentities: [],
      installPolicy: "read_only_cloudflare_zone_analytics", lastCheckedAt: timestamp,
      lastError: nil, manualEvidenceNote: nil, reauthorizeRequired: false, disconnecting: false,
      betaBlocked: false, createdAt: timestamp, updatedAt: timestamp,
      redactionStatus: "private-state-excluded")
    do { return try saveConnection(context: context, connection: connection) } catch {
      _ = try? secrets.delete(a.id)
      _ = try? secrets.delete(r.id)
      throw error
    }
  }

  @discardableResult
  public func rotateCloudflareOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String, expiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    cloudflareTokenRotationLock.lock()
    defer { cloudflareTokenRotationLock.unlock() }
    guard
      var connection = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      connection.appSlug == "cloudflare", connection.credentialOwnership == .relayOwned
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "A Relay-owned Cloudflare OAuth connection is required.")
    }
    let access = try requireNonEmptyString(
      accessToken, field: "Cloudflare OAuth access token", maxLength: 30000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "Cloudflare OAuth refresh token", maxLength: 30000)
    let old = Self.secretReferenceIds(in: connection)
    let a = try secrets.set(
      scope: "provider_connection", scopeId: connection.id, label: "Cloudflare OAuth access token",
      secretValue: access)
    let r: SecretReference
    do {
      r = try secrets.set(
        scope: "provider_connection", scopeId: connection.id,
        label: "Cloudflare OAuth refresh token", secretValue: refresh)
    } catch {
      _ = try? secrets.delete(a.id)
      throw error
    }
    connection.credentialRequirements = connection.credentialRequirements.map { value in
      var copy = value
      if copy.fieldKey == "cloudflare_oauth_access_token" { copy.secretReferenceId = a.id }
      if copy.fieldKey == "cloudflare_oauth_refresh_token" { copy.secretReferenceId = r.id }
      return copy
    }
    connection.secretReferenceIds = [a.id, r.id]
    connection.updatedAt = ISO8601DateFormatter.relayConsole.string(from: now)
    connection.health.diagnostics["accessExpiresAt"] =
      expiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null
    do {
      let saved = try saveConnection(context: context, connection: connection)
      old.forEach { _ = try? secrets.delete($0) }
      return saved
    } catch {
      _ = try? secrets.delete(a.id)
      _ = try? secrets.delete(r.id)
      throw error
    }
  }

  @discardableResult
  public func saveVercelIntegrationConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, teamId: String?,
    teamName: String?, configurationId: String, projectId: String, projectName: String,
    grantedScopes: [String], displayName: String? = nil, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "vercel")
    let team = teamId?.providerConnectionNilIfEmpty
    let configuration = configurationId.trimmingCharacters(in: .whitespacesAndNewlines)
    let project = projectId.trimmingCharacters(in: .whitespacesAndNewlines)
    let projectLabel = projectName.trimmingCharacters(in: .whitespacesAndNewlines)
    guard app.slug == "vercel", team.map(VercelProviderActionSupport.safeId) ?? true,
      VercelProviderActionSupport.safeId(configuration),
      VercelProviderActionSupport.safeId(project), !projectLabel.isEmpty, projectLabel.count <= 120,
      Set(grantedScopes) == Set(Self.vercelReadScopes),
      grantedScopes.count == Self.vercelReadScopes.count
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "Vercel integration requires exact Project Read and Deployment Read permissions plus safe configuration/team/project identifiers."
      )
    }
    try validateAppCanAuthorize(app, context: context)
    let token = try requireNonEmptyString(
      accessToken, field: "Vercel integration access token", maxLength: 30000)
    let id = createRelayId("mpc")
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let secret = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Vercel integration access token",
      secretValue: token)
    let scopeLabel =
      teamName?.providerConnectionNilIfEmpty ?? (team == nil ? "Vercel Hobby" : "Vercel Team")
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "vercel-relay-owned-integration:" + configuration, providerName: "Vercel",
      status: .connected, authorizationState: .completed, credentialOwnership: .relayOwned,
      userOwnedCredentialsRequired: false,
      credentialRequirements: [
        ProviderCredentialRequirement(
          fieldKey: "vercel_integration_access_token", label: "Vercel integration access token",
          required: true, userOwnedRequired: false, secretReferenceId: secret.id, status: .verified,
          helpText:
            "Long-lived non-refreshable installation token stored only as a Keychain reference.",
          redactionStatus: "secret-reference-only"),
        ProviderCredentialRequirement(
          fieldKey: "vercel_installation_scope",
          label: "Vercel configuration, team and selected project", required: true,
          userOwnedRequired: false, secretReferenceId: nil, status: .verified,
          helpText: "Exact integration configuration and selected project metadata.",
          redactionStatus: "private-state-excluded"),
      ], secretReferenceIds: [secret.id],
      accountLabel: displayName?.providerConnectionNilIfEmpty ?? scopeLabel + " · " + projectLabel,
      connectedHandle: projectLabel, callbackURL: nil, requiredScopes: Self.vercelReadScopes,
      grantedScopes: Self.vercelReadScopes, selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message: "Vercel integration is ready for bounded project and deployment reads.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("vercel"),
          "authMethod": .string("integration_authorization_code_confidential_one_time_exchange"),
          "apiOrigin": .string(VercelProviderActionSupport.apiOrigin),
          "configurationId": .string(configuration), "teamId": team.map(JSONValue.string) ?? .null,
          "teamName": teamName?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
          "projectId": .string(project), "projectName": .string(projectLabel),
          "tokenLifecycle": .string(
            "long-lived-non-refreshable-reinstall-on-revoke-removal-owner-loss"),
          "exactScopes": .array(Self.vercelReadScopes.map(JSONValue.string)),
          "clientSecretLocation": .string("secure-railway-broker-only"),
          "rawTokenStoredInDatabase": .bool(false), "rawProviderToolExposure": .bool(false),
        ], redactionStatus: "private-state-excluded"), senderIdentities: [],
      installPolicy: "read_only_vercel_projects_deployments", lastCheckedAt: timestamp,
      lastError: nil, manualEvidenceNote: nil, reauthorizeRequired: false, disconnecting: false,
      betaBlocked: false, createdAt: timestamp, updatedAt: timestamp,
      redactionStatus: "private-state-excluded")
    do { return try saveConnection(context: context, connection: connection) } catch {
      _ = try? secrets.delete(secret.id)
      throw error
    }
  }

  @discardableResult
  public func saveHerokuRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    authorizationId: String, teamId: String, teamName: String, appId: String, appName: String,
    grantedScopes: [String], expiresAt: String?, displayName: String? = nil, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "heroku")
    let team = teamId.trimmingCharacters(in: .whitespacesAndNewlines)
    let selectedApp = appId.trimmingCharacters(in: .whitespacesAndNewlines)
    let authorization = authorizationId.trimmingCharacters(in: .whitespacesAndNewlines)
    let teamLabel = teamName.trimmingCharacters(in: .whitespacesAndNewlines)
    let appLabel = appName.trimmingCharacters(in: .whitespacesAndNewlines)
    guard app.slug == "heroku", HerokuProviderActionSupport.safeId(team),
      HerokuProviderActionSupport.safeId(selectedApp),
      HerokuProviderActionSupport.safeId(authorization), !teamLabel.isEmpty, teamLabel.count <= 120,
      !appLabel.isEmpty, appLabel.count <= 120, grantedScopes == Self.herokuReadScopes
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "Heroku OAuth requires exact read scope and safe authorization, Team, and selected App identifiers."
      )
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "Heroku OAuth access token", maxLength: 30000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "Heroku OAuth refresh token", maxLength: 30000)
    let id = createRelayId("mpc")
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let a = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Heroku OAuth access token",
      secretValue: access)
    let r: SecretReference
    do {
      r = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Heroku OAuth refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(a.id)
      throw error
    }
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "heroku-relay-owned-oauth:" + team + ":" + selectedApp, providerName: "Heroku",
      status: .connected, authorizationState: .completed, credentialOwnership: .relayOwned,
      userOwnedCredentialsRequired: false,
      credentialRequirements: [
        ProviderCredentialRequirement(
          fieldKey: "heroku_oauth_access_token", label: "Heroku OAuth access token", required: true,
          userOwnedRequired: false, secretReferenceId: a.id, status: .verified,
          helpText: "Eight-hour read-scope access token stored only as a Keychain reference.",
          redactionStatus: "secret-reference-only"),
        ProviderCredentialRequirement(
          fieldKey: "heroku_oauth_refresh_token", label: "Heroku OAuth refresh token",
          required: true, userOwnedRequired: false, secretReferenceId: r.id, status: .verified,
          helpText:
            "Non-expiring refresh token stored separately for serialized full-pair replacement.",
          redactionStatus: "secret-reference-only"),
        ProviderCredentialRequirement(
          fieldKey: "heroku_team_app", label: "Heroku Team and selected App", required: true,
          userOwnedRequired: false, secretReferenceId: nil, status: .verified,
          helpText: "Exact Team and selected App metadata.",
          redactionStatus: "private-state-excluded"),
      ], secretReferenceIds: [a.id, r.id],
      accountLabel: displayName?.providerConnectionNilIfEmpty ?? teamLabel + " · " + appLabel,
      connectedHandle: appLabel, callbackURL: nil, requiredScopes: Self.herokuReadScopes,
      grantedScopes: Self.herokuReadScopes, selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message: "Heroku OAuth is ready for bounded Team App, Release, and Dyno reads.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("heroku"),
          "authMethod": .string("oauth2_authorization_code_confidential_hosted_broker"),
          "apiOrigin": .string(HerokuProviderActionSupport.apiOrigin),
          "authorizationId": .string(authorization), "teamId": .string(team),
          "teamName": .string(teamLabel), "appId": .string(selectedApp),
          "appName": .string(appLabel),
          "accessExpiresAt": expiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
          "accessLifetimeSeconds": .number(28800),
          "refreshTokenLifetime": .string("non-expiring-until-revoked"),
          "tokenPairReplacement": .string("serialized-complete-provider-returned-pair-replacement"),
          "exactScopes": .array(Self.herokuReadScopes.map(JSONValue.string)),
          "clientSecretLocation": .string("secure-railway-broker-only"),
          "teamThirdPartyOAuthMayDisableAccess": .bool(true),
          "configAndCredentialMetadataReturned": .bool(false),
          "rawTokenStoredInDatabase": .bool(false), "rawProviderToolExposure": .bool(false),
        ], redactionStatus: "private-state-excluded"), senderIdentities: [],
      installPolicy: "read_only_heroku_team_app_release_dyno", lastCheckedAt: timestamp,
      lastError: nil, manualEvidenceNote: nil, reauthorizeRequired: false, disconnecting: false,
      betaBlocked: false, createdAt: timestamp, updatedAt: timestamp,
      redactionStatus: "private-state-excluded")
    do { return try saveConnection(context: context, connection: connection) } catch {
      _ = try? secrets.delete(a.id)
      _ = try? secrets.delete(r.id)
      throw error
    }
  }

  @discardableResult
  public func rotateHerokuOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String, expiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    herokuTokenRotationLock.lock()
    defer { herokuTokenRotationLock.unlock() }
    guard
      var connection = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      connection.appSlug == "heroku", connection.credentialOwnership == .relayOwned
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "A Relay-owned Heroku OAuth connection is required.")
    }
    let access = try requireNonEmptyString(
      accessToken, field: "Heroku OAuth access token", maxLength: 30000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "Heroku OAuth refresh token", maxLength: 30000)
    let old = Self.secretReferenceIds(in: connection)
    let a = try secrets.set(
      scope: "provider_connection", scopeId: connection.id, label: "Heroku OAuth access token",
      secretValue: access)
    let r: SecretReference
    do {
      r = try secrets.set(
        scope: "provider_connection", scopeId: connection.id, label: "Heroku OAuth refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(a.id)
      throw error
    }
    connection.credentialRequirements = connection.credentialRequirements.map { value in
      var copy = value
      if copy.fieldKey == "heroku_oauth_access_token" { copy.secretReferenceId = a.id }
      if copy.fieldKey == "heroku_oauth_refresh_token" { copy.secretReferenceId = r.id }
      return copy
    }
    connection.secretReferenceIds = [a.id, r.id]
    connection.updatedAt = ISO8601DateFormatter.relayConsole.string(from: now)
    connection.health.diagnostics["accessExpiresAt"] =
      expiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null
    do {
      let saved = try saveConnection(context: context, connection: connection)
      old.forEach { _ = try? secrets.delete($0) }
      return saved
    } catch {
      _ = try? secrets.delete(a.id)
      _ = try? secrets.delete(r.id)
      throw error
    }
  }

  @discardableResult
  public func saveDigitalOceanRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    teamId: String, teamName: String, projectId: String, projectName: String, resourceKind: String,
    resourceId: String, resourceName: String, grantedScopes: [String], expiresAt: String?,
    displayName: String? = nil, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "digitalocean")
    let team = teamId.trimmingCharacters(in: .whitespacesAndNewlines)
    let project = projectId.trimmingCharacters(in: .whitespacesAndNewlines)
    let resource = resourceId.trimmingCharacters(in: .whitespacesAndNewlines)
    let kind = resourceKind.lowercased()
    let teamLabel = teamName.trimmingCharacters(in: .whitespacesAndNewlines)
    let projectLabel = projectName.trimmingCharacters(in: .whitespacesAndNewlines)
    let resourceLabel = resourceName.trimmingCharacters(in: .whitespacesAndNewlines)
    guard app.slug == "digitalocean", DigitalOceanProviderActionSupport.safeId(team),
      DigitalOceanProviderActionSupport.safeId(project),
      DigitalOceanProviderActionSupport.safeId(resource), ["droplet", "app"].contains(kind),
      !teamLabel.isEmpty, !projectLabel.isEmpty, !resourceLabel.isEmpty, teamLabel.count <= 120,
      projectLabel.count <= 120, resourceLabel.count <= 120,
      grantedScopes == Self.digitalOceanReadScopes
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "DigitalOcean OAuth requires exact granular read scopes and safe Team, Project, and selected resource metadata."
      )
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "DigitalOcean OAuth access token", maxLength: 30000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "DigitalOcean OAuth refresh token", maxLength: 30000)
    let id = createRelayId("mpc")
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let a = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "DigitalOcean OAuth access token",
      secretValue: access)
    let r: SecretReference
    do {
      r = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "DigitalOcean OAuth refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(a.id)
      throw error
    }
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "digitalocean-relay-owned-oauth:" + team + ":" + project + ":" + kind + ":"
        + resource, providerName: "DigitalOcean", status: .connected,
      authorizationState: .completed, credentialOwnership: .relayOwned,
      userOwnedCredentialsRequired: false,
      credentialRequirements: [
        ProviderCredentialRequirement(
          fieldKey: "digitalocean_oauth_access_token", label: "DigitalOcean OAuth access token",
          required: true, userOwnedRequired: false, secretReferenceId: a.id, status: .verified,
          helpText: "Thirty-day granular-scope access token stored only as a Keychain reference.",
          redactionStatus: "secret-reference-only"),
        ProviderCredentialRequirement(
          fieldKey: "digitalocean_oauth_refresh_token", label: "DigitalOcean OAuth refresh token",
          required: true, userOwnedRequired: false, secretReferenceId: r.id, status: .verified,
          helpText:
            "Single-use refresh token stored separately for serialized complete-pair replacement.",
          redactionStatus: "secret-reference-only"),
        ProviderCredentialRequirement(
          fieldKey: "digitalocean_project_resource",
          label: "DigitalOcean Team, Project, and selected resource", required: true,
          userOwnedRequired: false, secretReferenceId: nil, status: .verified,
          helpText: "Exact Team and membership-verified Project/resource metadata.",
          redactionStatus: "private-state-excluded"),
      ], secretReferenceIds: [a.id, r.id],
      accountLabel: displayName?.providerConnectionNilIfEmpty ?? teamLabel + " · " + projectLabel
        + " · "
        + resourceLabel, connectedHandle: resourceLabel, callbackURL: nil,
      requiredScopes: Self.digitalOceanReadScopes, grantedScopes: Self.digitalOceanReadScopes,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message: "DigitalOcean OAuth is ready for bounded Project and selected resource reads.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("digitalocean"),
          "authMethod": .string("oauth2_authorization_code_confidential_single_use_refresh"),
          "apiOrigin": .string(DigitalOceanProviderActionSupport.apiOrigin),
          "teamId": .string(team), "teamName": .string(teamLabel), "projectId": .string(project),
          "projectName": .string(projectLabel), "resourceKind": .string(kind),
          "resourceId": .string(resource), "resourceName": .string(resourceLabel),
          "resourceUrn": .string("do:" + kind + ":" + resource),
          "accessExpiresAt": expiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
          "accessLifetimeSeconds": .number(2_592_000), "refreshRotation": .string("single-use"),
          "tokenPairReplacement": .string("serialized-complete-provider-returned-pair-replacement"),
          "exactScopes": .array(Self.digitalOceanReadScopes.map(JSONValue.string)),
          "broadAliasScopesAllowed": .bool(false),
          "clientSecretLocation": .string("secure-railway-broker-only"),
          "rawTokenStoredInDatabase": .bool(false), "rawProviderToolExposure": .bool(false),
        ], redactionStatus: "private-state-excluded"), senderIdentities: [],
      installPolicy: "read_only_digitalocean_project_selected_resource", lastCheckedAt: timestamp,
      lastError: nil, manualEvidenceNote: nil, reauthorizeRequired: false, disconnecting: false,
      betaBlocked: false, createdAt: timestamp, updatedAt: timestamp,
      redactionStatus: "private-state-excluded")
    do { return try saveConnection(context: context, connection: connection) } catch {
      _ = try? secrets.delete(a.id)
      _ = try? secrets.delete(r.id)
      throw error
    }
  }

  @discardableResult
  public func rotateDigitalOceanOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String, expiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    digitalOceanTokenRotationLock.lock()
    defer { digitalOceanTokenRotationLock.unlock() }
    guard
      var connection = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      connection.appSlug == "digitalocean", connection.credentialOwnership == .relayOwned
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "A Relay-owned DigitalOcean OAuth connection is required.")
    }
    let access = try requireNonEmptyString(
      accessToken, field: "DigitalOcean OAuth access token", maxLength: 30000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "DigitalOcean OAuth refresh token", maxLength: 30000)
    let old = Self.secretReferenceIds(in: connection)
    let a = try secrets.set(
      scope: "provider_connection", scopeId: connection.id,
      label: "DigitalOcean OAuth access token", secretValue: access)
    let r: SecretReference
    do {
      r = try secrets.set(
        scope: "provider_connection", scopeId: connection.id,
        label: "DigitalOcean OAuth refresh token", secretValue: refresh)
    } catch {
      _ = try? secrets.delete(a.id)
      throw error
    }
    connection.credentialRequirements = connection.credentialRequirements.map { value in
      var copy = value
      if copy.fieldKey == "digitalocean_oauth_access_token" { copy.secretReferenceId = a.id }
      if copy.fieldKey == "digitalocean_oauth_refresh_token" { copy.secretReferenceId = r.id }
      return copy
    }
    connection.secretReferenceIds = [a.id, r.id]
    connection.updatedAt = ISO8601DateFormatter.relayConsole.string(from: now)
    connection.health.diagnostics["accessExpiresAt"] =
      expiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null
    do {
      let saved = try saveConnection(context: context, connection: connection)
      old.forEach { _ = try? secrets.delete($0) }
      return saved
    } catch {
      _ = try? secrets.delete(a.id)
      _ = try? secrets.delete(r.id)
      throw error
    }
  }

  @discardableResult
  public func saveFirebaseRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    projectId: String, projectName: String, grantedScopes: [String], expiresAt: String?,
    displayName: String? = nil, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "firebase")
    let project = projectId.trimmingCharacters(in: .whitespacesAndNewlines)
    let label = projectName.trimmingCharacters(in: .whitespacesAndNewlines)
    guard app.slug == "firebase", FirebaseProviderActionSupport.safeId(project), !label.isEmpty,
      label.count <= 120, grantedScopes == Self.firebaseReadScopes
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "Firebase OAuth requires exact firebase.readonly scope and safe selected Project metadata."
      )
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "Firebase OAuth access token", maxLength: 30000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "Firebase OAuth refresh token", maxLength: 30000)
    let id = createRelayId("mpc")
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let a = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Firebase OAuth access token",
      secretValue: access)
    let r: SecretReference
    do {
      r = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Firebase OAuth refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(a.id)
      throw error
    }
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "firebase_oauth_access_token", label: "Firebase OAuth access token",
        required: true, userOwnedRequired: false, secretReferenceId: a.id, status: .verified,
        helpText: "Short-lived access token stored only as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "firebase_oauth_refresh_token", label: "Firebase OAuth refresh token",
        required: true, userOwnedRequired: false, secretReferenceId: r.id, status: .verified,
        helpText:
          "Offline refresh token stored separately and retained unless Google returns a replacement.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "firebase_project", label: "Selected Firebase Project", required: true,
        userOwnedRequired: false, secretReferenceId: nil, status: .verified,
        helpText: "Exact selected Firebase Project ID and display name.",
        redactionStatus: "private-state-excluded"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "firebase-relay-owned-google-oauth:" + project, providerName: "Firebase",
      status: .connected, authorizationState: .completed, credentialOwnership: .relayOwned,
      userOwnedCredentialsRequired: false, credentialRequirements: requirements,
      secretReferenceIds: [a.id, r.id],
      accountLabel: displayName?.providerConnectionNilIfEmpty ?? label,
      connectedHandle: project, callbackURL: nil, requiredScopes: Self.firebaseReadScopes,
      grantedScopes: Self.firebaseReadScopes, selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message: "Firebase OAuth is ready for bounded Project and App inventory reads.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("firebase"),
          "authMethod": .string(
            "google_oauth2_authorization_code_offline_confidential_hosted_broker"),
          "apiOrigin": .string(FirebaseProviderActionSupport.apiOrigin),
          "projectId": .string(project), "projectName": .string(label),
          "accessExpiresAt": expiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
          "exactScopes": .array(Self.firebaseReadScopes.map(JSONValue.string)),
          "refreshReplacement": .string("preserve-existing-unless-provider-returns-replacement"),
          "clientSecretLocation": .string("secure-railway-broker-only"),
          "apiKeysAcceptedAsCredentials": .bool(false), "productDataReturned": .bool(false),
          "rawTokenStoredInDatabase": .bool(false), "rawProviderToolExposure": .bool(false),
        ], redactionStatus: "private-state-excluded"), senderIdentities: [],
      installPolicy: "read_only_firebase_selected_project_inventory", lastCheckedAt: timestamp,
      lastError: nil, manualEvidenceNote: nil, reauthorizeRequired: false, disconnecting: false,
      betaBlocked: false, createdAt: timestamp, updatedAt: timestamp,
      redactionStatus: "private-state-excluded")
    do { return try saveConnection(context: context, connection: connection) } catch {
      _ = try? secrets.delete(a.id)
      _ = try? secrets.delete(r.id)
      throw error
    }
  }

  @discardableResult
  public func rotateFirebaseOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String?, expiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    firebaseTokenRotationLock.lock()
    defer { firebaseTokenRotationLock.unlock() }
    guard
      var connection = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      connection.appSlug == "firebase", connection.credentialOwnership == .relayOwned
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "A Relay-owned Firebase OAuth connection is required.")
    }
    let access = try requireNonEmptyString(
      accessToken, field: "Firebase OAuth access token", maxLength: 30000)
    let oldAccess = connection.credentialRequirements.first(where: {
      $0.fieldKey == "firebase_oauth_access_token"
    })?.secretReferenceId
    let oldRefresh = connection.credentialRequirements.first(where: {
      $0.fieldKey == "firebase_oauth_refresh_token"
    })?.secretReferenceId
    guard let retainedRefresh = oldRefresh else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Firebase refresh requires an existing refresh-token reference.")
    }
    let a = try secrets.set(
      scope: "provider_connection", scopeId: connection.id, label: "Firebase OAuth access token",
      secretValue: access)
    var replacementRefresh: SecretReference?
    if let value = refreshToken?.providerConnectionNilIfEmpty {
      do {
        replacementRefresh = try secrets.set(
          scope: "provider_connection", scopeId: connection.id,
          label: "Firebase OAuth refresh token", secretValue: value)
      } catch {
        _ = try? secrets.delete(a.id)
        throw error
      }
    }
    let nextRefresh = replacementRefresh?.id ?? retainedRefresh
    connection.credentialRequirements = connection.credentialRequirements.map { value in
      var copy = value
      if copy.fieldKey == "firebase_oauth_access_token" { copy.secretReferenceId = a.id }
      if copy.fieldKey == "firebase_oauth_refresh_token" { copy.secretReferenceId = nextRefresh }
      return copy
    }
    connection.secretReferenceIds = [a.id, nextRefresh]
    connection.updatedAt = ISO8601DateFormatter.relayConsole.string(from: now)
    connection.health.diagnostics["accessExpiresAt"] =
      expiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null
    do {
      let saved = try saveConnection(context: context, connection: connection)
      if let oldAccess { _ = try? secrets.delete(oldAccess) }
      if replacementRefresh != nil { _ = try? secrets.delete(retainedRefresh) }
      return saved
    } catch {
      _ = try? secrets.delete(a.id)
      if let replacementRefresh { _ = try? secrets.delete(replacementRefresh.id) }
      throw error
    }
  }

  @discardableResult
  public func saveSupabaseRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    organizationSlug: String, organizationName: String, projectRef: String, projectName: String,
    grantedScopes: [String], expiresAt: String?, displayName: String? = nil, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "supabase")
    let organization = organizationSlug.trimmingCharacters(in: .whitespacesAndNewlines)
    let organizationLabel = organizationName.trimmingCharacters(in: .whitespacesAndNewlines)
    let project = projectRef.trimmingCharacters(in: .whitespacesAndNewlines)
    let projectLabel = projectName.trimmingCharacters(in: .whitespacesAndNewlines)
    guard app.slug == "supabase", SupabaseProviderActionSupport.safeSlug(organization),
      SupabaseProviderActionSupport.safeRef(project), !organizationLabel.isEmpty,
      organizationLabel.count <= 120, !projectLabel.isEmpty, projectLabel.count <= 120,
      grantedScopes == Self.supabaseReadScopes
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "Supabase OAuth requires exact organizations:read and projects:read scopes plus safe Organization and selected Project metadata."
      )
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "Supabase OAuth access token", maxLength: 30000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "Supabase OAuth refresh token", maxLength: 30000)
    let id = createRelayId("mpc")
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let a = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Supabase OAuth access token",
      secretValue: access)
    let r: SecretReference
    do {
      r = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Supabase OAuth refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(a.id)
      throw error
    }
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "supabase_oauth_access_token", label: "Supabase OAuth access token",
        required: true, userOwnedRequired: false, secretReferenceId: a.id, status: .verified,
        helpText: "Short-lived access token stored only as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "supabase_oauth_refresh_token", label: "Supabase OAuth refresh token",
        required: true, userOwnedRequired: false, secretReferenceId: r.id, status: .verified,
        helpText:
          "Refresh token stored separately and replaced atomically with each provider token pair.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "supabase_organization_project",
        label: "Selected Supabase Organization and Project", required: true,
        userOwnedRequired: false, secretReferenceId: nil, status: .verified,
        helpText:
          "Exact Organization slug and Project ref selected during the hosted connection flow.",
        redactionStatus: "private-state-excluded"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "supabase-relay-owned-oauth:" + organization + ":" + project,
      providerName: "Supabase", status: .connected, authorizationState: .completed,
      credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
      credentialRequirements: requirements, secretReferenceIds: [a.id, r.id],
      accountLabel: displayName?.providerConnectionNilIfEmpty ?? organizationLabel + " · "
        + projectLabel,
      connectedHandle: project, callbackURL: nil, requiredScopes: Self.supabaseReadScopes,
      grantedScopes: Self.supabaseReadScopes, selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message: "Supabase OAuth is ready for bounded Organization and Project inventory reads.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("supabase"),
          "authMethod": .string("oauth2_authorization_code_confidential_pkce_hosted_broker"),
          "apiOrigin": .string(SupabaseProviderActionSupport.apiOrigin),
          "organizationSlug": .string(organization), "organizationName": .string(organizationLabel),
          "projectRef": .string(project), "projectName": .string(projectLabel),
          "accessExpiresAt": expiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
          "exactScopes": .array(Self.supabaseReadScopes.map(JSONValue.string)),
          "tokenPairReplacement": .string("serialized-complete-provider-returned-pair-replacement"),
          "clientSecretLocation": .string("secure-railway-broker-only"),
          "personalAccessTokensAccepted": .bool(false), "projectCredentialsAccepted": .bool(false),
          "databaseDetailsReturned": .bool(false), "automaticPagination": .bool(false),
          "rawTokenStoredInDatabase": .bool(false), "rawProviderToolExposure": .bool(false),
        ], redactionStatus: "private-state-excluded"), senderIdentities: [],
      installPolicy: "read_only_supabase_selected_organization_project", lastCheckedAt: timestamp,
      lastError: nil, manualEvidenceNote: nil, reauthorizeRequired: false, disconnecting: false,
      betaBlocked: false, createdAt: timestamp, updatedAt: timestamp,
      redactionStatus: "private-state-excluded")
    do { return try saveConnection(context: context, connection: connection) } catch {
      _ = try? secrets.delete(a.id)
      _ = try? secrets.delete(r.id)
      throw error
    }
  }

  @discardableResult
  public func rotateSupabaseOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String, expiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    supabaseTokenRotationLock.lock()
    defer { supabaseTokenRotationLock.unlock() }
    guard
      var connection = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      connection.appSlug == "supabase", connection.credentialOwnership == .relayOwned
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "A Relay-owned Supabase OAuth connection is required.")
    }
    let access = try requireNonEmptyString(
      accessToken, field: "Supabase OAuth access token", maxLength: 30000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "Supabase OAuth refresh token", maxLength: 30000)
    let old = Self.secretReferenceIds(in: connection)
    let a = try secrets.set(
      scope: "provider_connection", scopeId: connection.id, label: "Supabase OAuth access token",
      secretValue: access)
    let r: SecretReference
    do {
      r = try secrets.set(
        scope: "provider_connection", scopeId: connection.id, label: "Supabase OAuth refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(a.id)
      throw error
    }
    connection.credentialRequirements = connection.credentialRequirements.map { value in
      var copy = value
      if copy.fieldKey == "supabase_oauth_access_token" { copy.secretReferenceId = a.id }
      if copy.fieldKey == "supabase_oauth_refresh_token" { copy.secretReferenceId = r.id }
      return copy
    }
    connection.secretReferenceIds = [a.id, r.id]
    connection.updatedAt = ISO8601DateFormatter.relayConsole.string(from: now)
    connection.health.diagnostics["accessExpiresAt"] =
      expiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null
    do {
      let saved = try saveConnection(context: context, connection: connection)
      old.forEach { _ = try? secrets.delete($0) }
      return saved
    } catch {
      _ = try? secrets.delete(a.id)
      _ = try? secrets.delete(r.id)
      throw error
    }
  }

  @discardableResult
  public func saveOktaOINConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, orgDomain: String, clientId: String,
    clientSecret: String, applicationId: String, applicationLabel: String, grantedScopes: [String],
    displayName: String? = nil, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "okta")
    let rawOrigin = orgDomain.contains("://") ? orgDomain : "https://" + orgDomain
    guard app.slug == "okta", let origin = OktaProviderActionSupport.safeOrigin(rawOrigin),
      let host = URL(string: origin)?.host, OktaProviderActionSupport.safeId(clientId),
      OktaProviderActionSupport.safeId(applicationId),
      !applicationLabel.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
      applicationLabel.count <= 120, grantedScopes == Self.oktaReadScopes
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "Okta requires an allowlisted org domain, safe customer-specific OIN client/Application metadata, and exact okta.apps.read scope."
      )
    }
    try validateAppCanAuthorize(app, context: context)
    let secret = try requireNonEmptyString(
      clientSecret, field: "Okta OIN client secret", maxLength: 30000)
    let id = createRelayId("mpc")
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let ref = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Okta OIN client secret",
      secretValue: secret)
    let label = applicationLabel.trimmingCharacters(in: .whitespacesAndNewlines)
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "okta_oin_client_secret", label: "Okta OIN client secret", required: true,
        userOwnedRequired: false, secretReferenceId: ref.id, status: .verified,
        helpText:
          "Customer-specific one-time-displayed OIN secret stored only as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "okta_oin_client_id", label: "Okta OIN client ID", required: true,
        userOwnedRequired: false, secretReferenceId: nil, status: .verified,
        helpText: "Customer-specific OIN client ID stored as redacted connection metadata.",
        redactionStatus: "private-state-excluded"),
      ProviderCredentialRequirement(
        fieldKey: "okta_org_application", label: "Okta org and selected Application",
        required: true, userOwnedRequired: false, secretReferenceId: nil, status: .verified,
        helpText: "Exact org domain and selected Application ID/label.",
        redactionStatus: "private-state-excluded"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "okta-relay-owned-oin-api-service:" + host + ":" + applicationId,
      providerName: "Okta", status: .connected, authorizationState: .completed,
      credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
      credentialRequirements: requirements, secretReferenceIds: [ref.id],
      accountLabel: displayName?.providerConnectionNilIfEmpty ?? host + " · " + label,
      connectedHandle: host,
      callbackURL: nil, requiredScopes: Self.oktaReadScopes, grantedScopes: Self.oktaReadScopes,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message: "Okta OIN integration is ready for bounded Application inventory reads.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("okta"), "authMethod": .string("oin_api_service_client_credentials"),
          "apiOrigin": .string(origin), "orgDomain": .string(host), "clientId": .string(clientId),
          "applicationId": .string(applicationId), "applicationLabel": .string(label),
          "exactScopes": .array(Self.oktaReadScopes.map(JSONValue.string)),
          "tokenEndpoint": .string(origin + "/oauth2/v1/token"),
          "accessTokenLifetimeSeconds": .number(3600), "accessTokenPersistence": .string("none"),
          "clientSecretLocation": .string("relay-keychain-customer-specific-reference"),
          "rawProviderToolExposure": .bool(false), "automaticPagination": .bool(false),
          "usersAndMembersReturned": .bool(false),
        ], redactionStatus: "private-state-excluded"), senderIdentities: [],
      installPolicy: "read_only_okta_selected_application_inventory", lastCheckedAt: timestamp,
      lastError: nil, manualEvidenceNote: nil, reauthorizeRequired: false, disconnecting: false,
      betaBlocked: false, createdAt: timestamp, updatedAt: timestamp,
      redactionStatus: "private-state-excluded")
    do { return try saveConnection(context: context, connection: connection) } catch {
      _ = try? secrets.delete(ref.id)
      throw error
    }
  }
  @discardableResult public func saveBambooHRRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    companyDomain: String, locationId: String, locationLabel: String, grantedScopes: [String],
    expiresAt: String?, displayName: String? = nil, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "bamboohr")
    let company = companyDomain.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
    let location = locationId.trimmingCharacters(in: .whitespacesAndNewlines)
    let label = locationLabel.trimmingCharacters(in: .whitespacesAndNewlines)
    guard app.slug == "bamboohr", BambooHRProviderActionSupport.safeCompany(company),
      BambooHRProviderActionSupport.safeId(location), !label.isEmpty, label.count <= 120,
      grantedScopes == Self.bambooHRReadScopes
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "BambooHR OAuth requires exact field/offline_access scopes plus safe company and selected Location metadata."
      )
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "BambooHR OAuth access token", maxLength: 30000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "BambooHR OAuth refresh token", maxLength: 30000)
    let id = createRelayId("mpc")
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let a = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "BambooHR OAuth access token",
      secretValue: access)
    let r: SecretReference
    do {
      r = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "BambooHR OAuth refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(a.id)
      throw error
    }
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "bamboohr_oauth_access_token", label: "BambooHR OAuth access token",
        required: true, userOwnedRequired: false, secretReferenceId: a.id, status: .verified,
        helpText: "One-hour access token stored only as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "bamboohr_oauth_refresh_token", label: "BambooHR OAuth refresh token",
        required: true, userOwnedRequired: false, secretReferenceId: r.id, status: .verified,
        helpText: "Offline refresh token stored separately for serialized pair replacement.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "bamboohr_company_location", label: "BambooHR company and selected Location",
        required: true, userOwnedRequired: false, secretReferenceId: nil, status: .verified,
        helpText: "Exact company subdomain and selected job Location.",
        redactionStatus: "private-state-excluded"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "bamboohr-relay-owned-oauth:" + company + ":" + location,
      providerName: "BambooHR", status: .connected, authorizationState: .completed,
      credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
      credentialRequirements: requirements, secretReferenceIds: [a.id, r.id],
      accountLabel: displayName?.providerConnectionNilIfEmpty ?? company + " · " + label,
      connectedHandle: company,
      callbackURL: nil, requiredScopes: Self.bambooHRReadScopes,
      grantedScopes: Self.bambooHRReadScopes, selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message: "BambooHR OAuth is ready for bounded organizational metadata reads.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("bamboohr"),
          "authMethod": .string("oauth2_authorization_code_confidential_offline"),
          "apiOrigin": .string(BambooHRProviderActionSupport.origin(company)),
          "companyDomain": .string(company), "locationId": .string(location),
          "locationLabel": .string(label),
          "accessExpiresAt": expiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
          "exactScopes": .array(Self.bambooHRReadScopes.map(JSONValue.string)),
          "employeeScopesGranted": .bool(false), "employeeDataReturned": .bool(false),
          "addressDetailsReturned": .bool(false), "automaticPagination": .bool(false),
          "clientSecretLocation": .string("secure-railway-broker-only"),
          "rawTokenStoredInDatabase": .bool(false),
        ], redactionStatus: "private-state-excluded"), senderIdentities: [],
      installPolicy: "read_only_bamboohr_location_country_metadata", lastCheckedAt: timestamp,
      lastError: nil, manualEvidenceNote: nil, reauthorizeRequired: false, disconnecting: false,
      betaBlocked: false, createdAt: timestamp, updatedAt: timestamp,
      redactionStatus: "private-state-excluded")
    do { return try saveConnection(context: context, connection: connection) } catch {
      _ = try? secrets.delete(a.id)
      _ = try? secrets.delete(r.id)
      throw error
    }
  }
  @discardableResult public func rotateBambooHROAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String, expiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    bambooHRTokenRotationLock.lock()
    defer { bambooHRTokenRotationLock.unlock() }
    guard
      var connection = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      connection.appSlug == "bamboohr", connection.credentialOwnership == .relayOwned
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "A Relay-owned BambooHR OAuth connection is required.")
    }
    let access = try requireNonEmptyString(
      accessToken, field: "BambooHR OAuth access token", maxLength: 30000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "BambooHR OAuth refresh token", maxLength: 30000)
    let old = Self.secretReferenceIds(in: connection)
    let a = try secrets.set(
      scope: "provider_connection", scopeId: connection.id, label: "BambooHR OAuth access token",
      secretValue: access)
    let r: SecretReference
    do {
      r = try secrets.set(
        scope: "provider_connection", scopeId: connection.id, label: "BambooHR OAuth refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(a.id)
      throw error
    }
    connection.credentialRequirements = connection.credentialRequirements.map { value in
      var copy = value
      if copy.fieldKey == "bamboohr_oauth_access_token" { copy.secretReferenceId = a.id }
      if copy.fieldKey == "bamboohr_oauth_refresh_token" { copy.secretReferenceId = r.id }
      return copy
    }
    connection.secretReferenceIds = [a.id, r.id]
    connection.updatedAt = ISO8601DateFormatter.relayConsole.string(from: now)
    connection.health.diagnostics["accessExpiresAt"] =
      expiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null
    do {
      let saved = try saveConnection(context: context, connection: connection)
      old.forEach { _ = try? secrets.delete($0) }
      return saved
    } catch {
      _ = try? secrets.delete(a.id)
      _ = try? secrets.delete(r.id)
      throw error
    }
  }
  @discardableResult public func saveGreenhouseRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    organizationId: String, organizationName: String, grantedScopes: [String], expiresAt: String?,
    displayName: String? = nil, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "greenhouse")
    let org = organizationId.trimmingCharacters(in: .whitespacesAndNewlines)
    let label = organizationName.trimmingCharacters(in: .whitespacesAndNewlines)
    guard app.slug == "greenhouse", GreenhouseProviderActionSupport.safeId(org), !label.isEmpty,
      label.count <= 120, grantedScopes == Self.greenhouseReadScopes
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "Greenhouse OAuth requires exact Harvest v3 list scopes and safe organization metadata.")
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "Greenhouse OAuth access token", maxLength: 30000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "Greenhouse OAuth refresh token", maxLength: 30000)
    let id = createRelayId("mpc")
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let a = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Greenhouse OAuth access token",
      secretValue: access)
    let r: SecretReference
    do {
      r = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Greenhouse OAuth refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(a.id)
      throw error
    }
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "greenhouse_oauth_access_token", label: "Greenhouse OAuth access token",
        required: true, userOwnedRequired: false, secretReferenceId: a.id, status: .verified,
        helpText: "Harvest v3 access token stored only as Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "greenhouse_oauth_refresh_token", label: "Greenhouse OAuth refresh token",
        required: true, userOwnedRequired: false, secretReferenceId: r.id, status: .verified,
        helpText: "Partner refresh token stored separately for serialized pair replacement.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "greenhouse_organization", label: "Greenhouse Recruiting organization",
        required: true, userOwnedRequired: false, secretReferenceId: nil, status: .verified,
        helpText: "Exact organization selected during partner authorization.",
        redactionStatus: "private-state-excluded"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "greenhouse-relay-owned-harvest-v3-oauth:" + org, providerName: "Greenhouse",
      status: .connected, authorizationState: .completed, credentialOwnership: .relayOwned,
      userOwnedCredentialsRequired: false, credentialRequirements: requirements,
      secretReferenceIds: [a.id, r.id],
      accountLabel: displayName?.providerConnectionNilIfEmpty ?? label,
      connectedHandle: org, callbackURL: nil, requiredScopes: Self.greenhouseReadScopes,
      grantedScopes: Self.greenhouseReadScopes, selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message: "Greenhouse Harvest v3 OAuth is ready for bounded recruiting-structure reads.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("greenhouse"),
          "authMethod": .string("harvest_v3_partner_oauth_authorization_code"),
          "apiOrigin": .string(GreenhouseProviderActionSupport.apiOrigin),
          "tokenOrigin": .string("https://auth.greenhouse.io"), "organizationId": .string(org),
          "organizationName": .string(label),
          "accessExpiresAt": expiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
          "exactScopes": .array(Self.greenhouseReadScopes.map(JSONValue.string)),
          "candidateDataReturned": .bool(false), "automaticPagination": .bool(false),
          "clientSecretLocation": .string("secure-railway-broker-only"),
          "rawTokenStoredInDatabase": .bool(false),
        ], redactionStatus: "private-state-excluded"), senderIdentities: [],
      installPolicy: "read_only_greenhouse_recruiting_structure", lastCheckedAt: timestamp,
      lastError: nil, manualEvidenceNote: nil, reauthorizeRequired: false, disconnecting: false,
      betaBlocked: false, createdAt: timestamp, updatedAt: timestamp,
      redactionStatus: "private-state-excluded")
    do { return try saveConnection(context: context, connection: connection) } catch {
      _ = try? secrets.delete(a.id)
      _ = try? secrets.delete(r.id)
      throw error
    }
  }
  @discardableResult public func rotateGreenhouseOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String, expiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    greenhouseTokenRotationLock.lock()
    defer { greenhouseTokenRotationLock.unlock() }
    guard
      var connection = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      connection.appSlug == "greenhouse", connection.credentialOwnership == .relayOwned
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "A Relay-owned Greenhouse OAuth connection is required.")
    }
    let access = try requireNonEmptyString(
      accessToken, field: "Greenhouse OAuth access token", maxLength: 30000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "Greenhouse OAuth refresh token", maxLength: 30000)
    let old = Self.secretReferenceIds(in: connection)
    let a = try secrets.set(
      scope: "provider_connection", scopeId: connection.id, label: "Greenhouse OAuth access token",
      secretValue: access)
    let r: SecretReference
    do {
      r = try secrets.set(
        scope: "provider_connection", scopeId: connection.id,
        label: "Greenhouse OAuth refresh token", secretValue: refresh)
    } catch {
      _ = try? secrets.delete(a.id)
      throw error
    }
    connection.credentialRequirements = connection.credentialRequirements.map { value in
      var copy = value
      if copy.fieldKey == "greenhouse_oauth_access_token" { copy.secretReferenceId = a.id }
      if copy.fieldKey == "greenhouse_oauth_refresh_token" { copy.secretReferenceId = r.id }
      return copy
    }
    connection.secretReferenceIds = [a.id, r.id]
    connection.updatedAt = ISO8601DateFormatter.relayConsole.string(from: now)
    connection.health.diagnostics["accessExpiresAt"] =
      expiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null
    do {
      let saved = try saveConnection(context: context, connection: connection)
      old.forEach { _ = try? secrets.delete($0) }
      return saved
    } catch {
      _ = try? secrets.delete(a.id)
      _ = try? secrets.delete(r.id)
      throw error
    }
  }
  @discardableResult public func saveLeverRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    accountId: String, accountName: String, grantedScopes: [String], expiresAt: String?,
    displayName: String? = nil, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "lever")
    let account = accountId.trimmingCharacters(in: .whitespacesAndNewlines)
    let label = accountName.trimmingCharacters(in: .whitespacesAndNewlines)
    guard app.slug == "lever", LeverProviderActionSupport.safeId(account), !label.isEmpty,
      label.count <= 120, grantedScopes == Self.leverReadScopes
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "Lever OAuth requires exact offline/Postings/Stages scopes and safe account metadata.")
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "Lever OAuth access token", maxLength: 30000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "Lever OAuth refresh token", maxLength: 30000)
    let id = createRelayId("mpc")
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let a = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Lever OAuth access token",
      secretValue: access)
    let r: SecretReference
    do {
      r = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Lever OAuth refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(a.id)
      throw error
    }
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "lever_oauth_access_token", label: "Lever OAuth access token", required: true,
        userOwnedRequired: false, secretReferenceId: a.id, status: .verified,
        helpText: "One-hour bearer stored only as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "lever_oauth_refresh_token", label: "Lever OAuth refresh token", required: true,
        userOwnedRequired: false, secretReferenceId: r.id, status: .verified,
        helpText: "Rotating refresh token stored separately for serialized pair replacement.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "lever_account", label: "Lever account", required: true, userOwnedRequired: false,
        secretReferenceId: nil, status: .verified,
        helpText: "Exact account authorized by a Lever Super Admin.",
        redactionStatus: "private-state-excluded"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "lever-relay-owned-partner-oauth:" + account, providerName: "Lever",
      status: .connected, authorizationState: .completed, credentialOwnership: .relayOwned,
      userOwnedCredentialsRequired: false, credentialRequirements: requirements,
      secretReferenceIds: [a.id, r.id],
      accountLabel: displayName?.providerConnectionNilIfEmpty ?? label,
      connectedHandle: account, callbackURL: nil, requiredScopes: Self.leverReadScopes,
      grantedScopes: Self.leverReadScopes, selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message: "Lever OAuth is ready for bounded non-confidential Posting and Stage reads.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("lever"), "authMethod": .string("partner_oauth_authorization_code"),
          "apiOrigin": .string(LeverProviderActionSupport.apiOrigin),
          "tokenOrigin": .string("https://auth.lever.co/oauth/token"),
          "accountId": .string(account), "accountName": .string(label),
          "accessExpiresAt": expiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
          "exactScopes": .array(Self.leverReadScopes.map(JSONValue.string)),
          "candidateDataReturned": .bool(false), "confidentialDataReturned": .bool(false),
          "contentReturned": .bool(false), "salaryReturned": .bool(false),
          "automaticPagination": .bool(false),
          "clientSecretLocation": .string("secure-railway-broker-only"),
          "rawTokenStoredInDatabase": .bool(false),
        ], redactionStatus: "private-state-excluded"), senderIdentities: [],
      installPolicy: "read_only_lever_posting_stage_structure", lastCheckedAt: timestamp,
      lastError: nil, manualEvidenceNote: nil, reauthorizeRequired: false, disconnecting: false,
      betaBlocked: false, createdAt: timestamp, updatedAt: timestamp,
      redactionStatus: "private-state-excluded")
    do { return try saveConnection(context: context, connection: connection) } catch {
      _ = try? secrets.delete(a.id)
      _ = try? secrets.delete(r.id)
      throw error
    }
  }
  @discardableResult public func rotateLeverOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String, expiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    leverTokenRotationLock.lock()
    defer { leverTokenRotationLock.unlock() }
    guard
      var connection = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      connection.appSlug == "lever", connection.credentialOwnership == .relayOwned
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "A Relay-owned Lever OAuth connection is required.")
    }
    let access = try requireNonEmptyString(
      accessToken, field: "Lever OAuth access token", maxLength: 30000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "Lever OAuth refresh token", maxLength: 30000)
    let old = Self.secretReferenceIds(in: connection)
    let a = try secrets.set(
      scope: "provider_connection", scopeId: connection.id, label: "Lever OAuth access token",
      secretValue: access)
    let r: SecretReference
    do {
      r = try secrets.set(
        scope: "provider_connection", scopeId: connection.id, label: "Lever OAuth refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(a.id)
      throw error
    }
    connection.credentialRequirements = connection.credentialRequirements.map { value in
      var copy = value
      if copy.fieldKey == "lever_oauth_access_token" { copy.secretReferenceId = a.id }
      if copy.fieldKey == "lever_oauth_refresh_token" { copy.secretReferenceId = r.id }
      return copy
    }
    connection.secretReferenceIds = [a.id, r.id]
    connection.updatedAt = ISO8601DateFormatter.relayConsole.string(from: now)
    connection.health.diagnostics["accessExpiresAt"] =
      expiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null
    do {
      let saved = try saveConnection(context: context, connection: connection)
      old.forEach { _ = try? secrets.delete($0) }
      return saved
    } catch {
      _ = try? secrets.delete(a.id)
      _ = try? secrets.delete(r.id)
      throw error
    }
  }
}
