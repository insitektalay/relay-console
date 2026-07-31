import Foundation

extension ProviderConnectionService {
  @discardableResult public func saveOutlookRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    accountEmail: String, accountLabel: String?, tenantId: String?, grantedScopes: [String],
    expiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "outlook")
    let email = accountEmail.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
    let tenant = tenantId?.providerConnectionNilIfEmpty
    guard app.slug == "outlook", email.count <= 320, email.contains("@"),
      !email.contains(where: { $0.isWhitespace }), tenant.map(Self.isSafeMicrosoftTenantId) ?? true,
      grantedScopes == Self.outlookRelayOwnedOAuthScopes
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "Relay-owned Outlook OAuth requires exact delegated Mail.Read, a safe account, and optional safe tenant ID."
      )
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "Outlook OAuth access token", maxLength: 30000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "Outlook OAuth refresh token", maxLength: 30000)
    let id = createRelayId("mpc")
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Outlook OAuth access token",
      secretValue: access)
    let refreshRef: SecretReference
    do {
      refreshRef = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Outlook OAuth refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "outlook_oauth_access_token", label: "Outlook OAuth access token", required: true,
        userOwnedRequired: false, secretReferenceId: accessRef.id, status: .verified,
        helpText:
          "Short-lived delegated Graph token stored as a secret reference and replaced by Railway.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "outlook_oauth_refresh_token", label: "Outlook OAuth refresh token",
        required: true, userOwnedRequired: false, secretReferenceId: refreshRef.id,
        status: .verified,
        helpText:
          "Offline refresh token stored separately; only Railway uses the Entra app secret.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "outlook_account", label: "Signed-in Outlook mailbox", required: true,
        userOwnedRequired: false, secretReferenceId: nil, status: .verified,
        helpText: "Delegated /me mailbox only; shared and application mail are excluded.",
        redactionStatus: "private-state-excluded"),
    ]
    let diagnostics: [String: JSONValue] = [
      "provider": .string("outlook"), "apiOrigin": .string("https://graph.microsoft.com/v1.0"),
      "authorizeOrigin": .string("https://login.microsoftonline.com/common/oauth2/v2.0"),
      "accountEmail": .string(email), "tenantId": tenant.map(JSONValue.string) ?? .null,
      "accessExpiresAt": expiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
      "exactScopes": .array(Self.outlookRelayOwnedOAuthScopes.map(JSONValue.string)),
      "protocolScopes": .array([.string("openid"), .string("profile"), .string("offline_access")]),
      "delegatedOnly": .bool(true), "selfMailboxOnly": .bool(true),
      "sharedMailEnabled": .bool(false), "applicationPermissionsEnabled": .bool(false),
      "attachmentsEnabled": .bool(false), "searchEnabled": .bool(false),
      "writesEnabled": .bool(false), "calendarContactsFilesDirectoryEnabled": .bool(false),
      "automaticPagination": .bool(false), "rawToolsEnabled": .bool(false),
      "maxResults": .number(25), "maxBodyCharacters": .number(8000), "pkceS256": .bool(true),
      "clientSecretLocation": .string("secure-railway-broker-only"),
      "rawTokenStoredInDatabase": .bool(false),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "outlook-relay-owned-microsoft-oauth:" + email, providerName: "Outlook",
      status: .connected, authorizationState: .completed, credentialOwnership: .relayOwned,
      userOwnedCredentialsRequired: false, credentialRequirements: requirements,
      secretReferenceIds: [accessRef.id, refreshRef.id],
      accountLabel: accountLabel?.providerConnectionNilIfEmpty ?? email, connectedHandle: email,
      callbackURL: nil,
      requiredScopes: Self.outlookRelayOwnedOAuthScopes,
      grantedScopes: Self.outlookRelayOwnedOAuthScopes, selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message: "Relay-owned Outlook OAuth is ready for four signed-in-mailbox read-only tools.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [], diagnostics: diagnostics,
        redactionStatus: "private-state-excluded"), senderIdentities: [],
      installPolicy: "delegated_self_mailbox_read_only_bounded_v1", lastCheckedAt: timestamp,
      lastError: nil, manualEvidenceNote: nil, reauthorizeRequired: false, disconnecting: false,
      betaBlocked: false, createdAt: timestamp, updatedAt: timestamp,
      redactionStatus: "private-state-excluded")
    do { return try saveConnection(context: context, connection: connection) } catch {
      _ = try? secrets.delete(accessRef.id)
      _ = try? secrets.delete(refreshRef.id)
      throw error
    }
  }

  @discardableResult public func rotateOutlookRelayOwnedOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String?, expiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    outlookTokenRotationLock.lock()
    defer { outlookTokenRotationLock.unlock() }
    guard
      var connection = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      connection.appSlug == "outlook", connection.credentialOwnership == .relayOwned,
      connection.grantedScopes == Self.outlookRelayOwnedOAuthScopes,
      connection.health.diagnostics["delegatedOnly"]?.bool == true
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "An exact delegated read-only Outlook connection is required.")
    }
    let access = try requireNonEmptyString(
      accessToken, field: "Outlook OAuth access token", maxLength: 30000)
    let oldAccess = connection.credentialRequirements.first {
      $0.fieldKey == "outlook_oauth_access_token"
    }?.secretReferenceId
    let oldRefresh = connection.credentialRequirements.first {
      $0.fieldKey == "outlook_oauth_refresh_token"
    }?.secretReferenceId
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: connection.id, label: "Outlook OAuth access token",
      secretValue: access)
    let refreshRef: SecretReference?
    do {
      refreshRef = try refreshToken?.providerConnectionNilIfEmpty.map {
        try secrets.set(
          scope: "provider_connection", scopeId: connection.id,
          label: "Outlook OAuth refresh token", secretValue: $0)
      }
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    connection.credentialRequirements = connection.credentialRequirements.map { value in
      var copy = value
      if copy.fieldKey == "outlook_oauth_access_token" { copy.secretReferenceId = accessRef.id }
      if copy.fieldKey == "outlook_oauth_refresh_token", let refreshRef {
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

  @discardableResult public func saveMicrosoftTeamsRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    accountEmail: String, accountLabel: String?, tenantId: String?, grantedScopes: [String],
    expiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "microsoft-teams")
    let email = accountEmail.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
    let tenant = tenantId?.providerConnectionNilIfEmpty
    guard app.slug == "microsoft-teams", email.count <= 320, email.contains("@"),
      !email.contains(where: { $0.isWhitespace }), tenant.map(Self.isSafeMicrosoftTenantId) ?? true,
      grantedScopes == Self.microsoftTeamsRelayOwnedOAuthScopes
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "Relay-owned Microsoft Teams OAuth requires the exact delegated Team.ReadBasic.All and Channel.ReadBasic.All scopes, a safe work account, and optional safe tenant ID."
      )
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "Microsoft Teams OAuth access token", maxLength: 30000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "Microsoft Teams OAuth refresh token", maxLength: 30000)
    let id = createRelayId("mpc")
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Microsoft Teams OAuth access token",
      secretValue: access)
    let refreshRef: SecretReference
    do {
      refreshRef = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Microsoft Teams OAuth refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "microsoft_teams_oauth_access_token", label: "Microsoft Teams OAuth access token",
        required: true, userOwnedRequired: false, secretReferenceId: accessRef.id,
        status: .verified,
        helpText:
          "Short-lived delegated Graph token stored as a secret reference and replaced by Railway.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "microsoft_teams_oauth_refresh_token",
        label: "Microsoft Teams OAuth refresh token", required: true, userOwnedRequired: false,
        secretReferenceId: refreshRef.id, status: .verified,
        helpText:
          "Offline refresh token stored separately; only Railway uses the Entra app secret.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "microsoft_teams_account", label: "Signed-in Teams work account", required: true,
        userOwnedRequired: false, secretReferenceId: nil, status: .verified,
        helpText:
          "Delegated team/channel metadata only; messages, chats and directory data are excluded.",
        redactionStatus: "private-state-excluded"),
    ]
    let diagnostics: [String: JSONValue] = [
      "provider": .string("microsoft-teams"),
      "apiOrigin": .string("https://graph.microsoft.com/v1.0"),
      "authorizeOrigin": .string("https://login.microsoftonline.com/organizations/oauth2/v2.0"),
      "accountEmail": .string(email), "tenantId": tenant.map(JSONValue.string) ?? .null,
      "accessExpiresAt": expiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
      "exactScopes": .array(Self.microsoftTeamsRelayOwnedOAuthScopes.map(JSONValue.string)),
      "protocolScopes": .array([.string("openid"), .string("profile"), .string("offline_access")]),
      "delegatedOnly": .bool(true), "workSchoolOnly": .bool(true),
      "messageContentEnabled": .bool(false), "chatsEnabled": .bool(false),
      "membersDirectoryEnabled": .bool(false), "filesMeetingsCallsEnabled": .bool(false),
      "applicationPermissionsEnabled": .bool(false), "adminConsentScopesEnabled": .bool(false),
      "meteredAPIsEnabled": .bool(false), "writesEnabled": .bool(false),
      "automaticPagination": .bool(false), "rawToolsEnabled": .bool(false),
      "maxResults": .number(25), "pkceS256": .bool(true),
      "clientSecretLocation": .string("secure-railway-broker-only"),
      "rawTokenStoredInDatabase": .bool(false),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "microsoft-teams-relay-owned-microsoft-oauth:" + email,
      providerName: "Microsoft Teams", status: .connected, authorizationState: .completed,
      credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
      credentialRequirements: requirements, secretReferenceIds: [accessRef.id, refreshRef.id],
      accountLabel: accountLabel?.providerConnectionNilIfEmpty ?? email, connectedHandle: email,
      callbackURL: nil,
      requiredScopes: Self.microsoftTeamsRelayOwnedOAuthScopes,
      grantedScopes: Self.microsoftTeamsRelayOwnedOAuthScopes,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message:
          "Relay-owned Microsoft Teams OAuth is ready for four bounded team/channel metadata tools.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [], diagnostics: diagnostics,
        redactionStatus: "private-state-excluded"), senderIdentities: [],
      installPolicy: "delegated_work_account_team_channel_metadata_only", lastCheckedAt: timestamp,
      lastError: nil, manualEvidenceNote: nil, reauthorizeRequired: false, disconnecting: false,
      betaBlocked: false, createdAt: timestamp, updatedAt: timestamp,
      redactionStatus: "private-state-excluded")
    do { return try saveConnection(context: context, connection: connection) } catch {
      _ = try? secrets.delete(accessRef.id)
      _ = try? secrets.delete(refreshRef.id)
      throw error
    }
  }

  @discardableResult public func rotateMicrosoftTeamsRelayOwnedOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String?, expiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    microsoftTeamsTokenRotationLock.lock()
    defer { microsoftTeamsTokenRotationLock.unlock() }
    guard
      var connection = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      connection.appSlug == "microsoft-teams", connection.credentialOwnership == .relayOwned,
      connection.grantedScopes == Self.microsoftTeamsRelayOwnedOAuthScopes,
      connection.health.diagnostics["delegatedOnly"]?.bool == true,
      connection.health.diagnostics["messageContentEnabled"]?.bool == false
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "An exact delegated metadata-only Microsoft Teams connection is required.")
    }
    let access = try requireNonEmptyString(
      accessToken, field: "Microsoft Teams OAuth access token", maxLength: 30000)
    let oldAccess = connection.credentialRequirements.first {
      $0.fieldKey == "microsoft_teams_oauth_access_token"
    }?.secretReferenceId
    let oldRefresh = connection.credentialRequirements.first {
      $0.fieldKey == "microsoft_teams_oauth_refresh_token"
    }?.secretReferenceId
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: connection.id,
      label: "Microsoft Teams OAuth access token", secretValue: access)
    let refreshRef: SecretReference?
    do {
      refreshRef = try refreshToken?.providerConnectionNilIfEmpty.map {
        try secrets.set(
          scope: "provider_connection", scopeId: connection.id,
          label: "Microsoft Teams OAuth refresh token", secretValue: $0)
      }
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    connection.credentialRequirements = connection.credentialRequirements.map { value in
      var copy = value
      if copy.fieldKey == "microsoft_teams_oauth_access_token" {
        copy.secretReferenceId = accessRef.id
      }
      if copy.fieldKey == "microsoft_teams_oauth_refresh_token", let refreshRef {
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

  @discardableResult public func saveOneDriveRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    accountEmail: String, accountLabel: String?, tenantId: String?, grantedScopes: [String],
    expiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "onedrive")
    let email = accountEmail.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
    let tenant = tenantId?.providerConnectionNilIfEmpty
    guard app.slug == "onedrive", email.count <= 320, email.contains("@"),
      !email.contains(where: { $0.isWhitespace }), tenant.map(Self.isSafeMicrosoftTenantId) ?? true,
      grantedScopes == Self.oneDriveRelayOwnedOAuthScopes
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "Relay-owned OneDrive OAuth requires exact delegated Files.Read, a safe account, and optional safe tenant ID."
      )
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "OneDrive OAuth access token", maxLength: 30000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "OneDrive OAuth refresh token", maxLength: 30000)
    let id = createRelayId("mpc")
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "OneDrive OAuth access token",
      secretValue: access)
    let refreshRef: SecretReference
    do {
      refreshRef = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "OneDrive OAuth refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "onedrive_oauth_access_token", label: "OneDrive OAuth access token",
        required: true, userOwnedRequired: false, secretReferenceId: accessRef.id,
        status: .verified,
        helpText:
          "Short-lived delegated Graph token stored as a secret reference and replaced by Railway.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "onedrive_oauth_refresh_token", label: "OneDrive OAuth refresh token",
        required: true, userOwnedRequired: false, secretReferenceId: refreshRef.id,
        status: .verified,
        helpText:
          "Offline refresh token stored separately; only Railway uses the Entra app secret.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "onedrive_account", label: "Signed-in OneDrive account", required: true,
        userOwnedRequired: false, secretReferenceId: nil, status: .verified,
        helpText:
          "Signed-in user's own drive metadata only; shared items and file contents are excluded.",
        redactionStatus: "private-state-excluded"),
    ]
    let diagnostics: [String: JSONValue] = [
      "provider": .string("onedrive"), "apiOrigin": .string("https://graph.microsoft.com/v1.0"),
      "authorizeOrigin": .string("https://login.microsoftonline.com/common/oauth2/v2.0"),
      "accountEmail": .string(email), "tenantId": tenant.map(JSONValue.string) ?? .null,
      "accessExpiresAt": expiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
      "exactScopes": .array(Self.oneDriveRelayOwnedOAuthScopes.map(JSONValue.string)),
      "protocolScopes": .array([.string("openid"), .string("profile"), .string("offline_access")]),
      "delegatedOnly": .bool(true), "selfDriveOnly": .bool(true), "metadataOnly": .bool(true),
      "contentDownloadEnabled": .bool(false), "sharedRemoteEnabled": .bool(false),
      "searchRecentEnabled": .bool(false), "permissionsVersionsEnabled": .bool(false),
      "applicationPermissionsEnabled": .bool(false), "writesEnabled": .bool(false),
      "automaticPagination": .bool(false), "rawToolsEnabled": .bool(false),
      "maxResults": .number(25), "pkceS256": .bool(true),
      "clientSecretLocation": .string("secure-railway-broker-only"),
      "rawTokenStoredInDatabase": .bool(false),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "onedrive-relay-owned-microsoft-oauth:" + email, providerName: "OneDrive",
      status: .connected, authorizationState: .completed, credentialOwnership: .relayOwned,
      userOwnedCredentialsRequired: false, credentialRequirements: requirements,
      secretReferenceIds: [accessRef.id, refreshRef.id],
      accountLabel: accountLabel?.providerConnectionNilIfEmpty ?? email, connectedHandle: email,
      callbackURL: nil,
      requiredScopes: Self.oneDriveRelayOwnedOAuthScopes,
      grantedScopes: Self.oneDriveRelayOwnedOAuthScopes, selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message: "Relay-owned OneDrive OAuth is ready for four bounded own-drive metadata tools.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [], diagnostics: diagnostics,
        redactionStatus: "private-state-excluded"), senderIdentities: [],
      installPolicy: "delegated_self_drive_metadata_only", lastCheckedAt: timestamp, lastError: nil,
      manualEvidenceNote: nil, reauthorizeRequired: false, disconnecting: false, betaBlocked: false,
      createdAt: timestamp, updatedAt: timestamp, redactionStatus: "private-state-excluded")
    do { return try saveConnection(context: context, connection: connection) } catch {
      _ = try? secrets.delete(accessRef.id)
      _ = try? secrets.delete(refreshRef.id)
      throw error
    }
  }

  @discardableResult public func rotateOneDriveRelayOwnedOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String?, expiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    oneDriveTokenRotationLock.lock()
    defer { oneDriveTokenRotationLock.unlock() }
    guard
      var connection = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      connection.appSlug == "onedrive", connection.credentialOwnership == .relayOwned,
      connection.grantedScopes == Self.oneDriveRelayOwnedOAuthScopes,
      connection.health.diagnostics["selfDriveOnly"]?.bool == true
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "An exact delegated metadata-only OneDrive connection is required.")
    }
    let access = try requireNonEmptyString(
      accessToken, field: "OneDrive OAuth access token", maxLength: 30000)
    let oldAccess = connection.credentialRequirements.first {
      $0.fieldKey == "onedrive_oauth_access_token"
    }?.secretReferenceId
    let oldRefresh = connection.credentialRequirements.first {
      $0.fieldKey == "onedrive_oauth_refresh_token"
    }?.secretReferenceId
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: connection.id, label: "OneDrive OAuth access token",
      secretValue: access)
    let refreshRef: SecretReference?
    do {
      refreshRef = try refreshToken?.providerConnectionNilIfEmpty.map {
        try secrets.set(
          scope: "provider_connection", scopeId: connection.id,
          label: "OneDrive OAuth refresh token", secretValue: $0)
      }
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    connection.credentialRequirements = connection.credentialRequirements.map { value in
      var copy = value
      if copy.fieldKey == "onedrive_oauth_access_token" { copy.secretReferenceId = accessRef.id }
      if copy.fieldKey == "onedrive_oauth_refresh_token", let refreshRef {
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

  @discardableResult public func saveSharePointRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    accountEmail: String, accountLabel: String?, tenantId: String, siteId: String,
    siteDisplayName: String, siteWebURL: String, siteGrantVerified: Bool, grantedScopes: [String],
    expiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "sharepoint")
    let email = accountEmail.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
    let tenant = tenantId.trimmingCharacters(in: .whitespacesAndNewlines)
    let siteName = siteDisplayName.trimmingCharacters(in: .whitespacesAndNewlines)
    guard app.slug == "sharepoint", email.count <= 320, email.contains("@"),
      !email.contains(where: { $0.isWhitespace }), Self.isSafeMicrosoftTenantId(tenant),
      SharePointProviderActionSupport.safeSiteId(siteId), !siteName.isEmpty, siteName.count <= 256,
      let siteURL = URL(string: siteWebURL), siteURL.scheme == "https",
      siteURL.host?.providerConnectionNilIfEmpty != nil, siteURL.user == nil,
      siteURL.password == nil,
      siteGrantVerified, grantedScopes == Self.sharePointRelayOwnedOAuthScopes
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "Relay-owned SharePoint OAuth requires exact delegated Sites.Selected, a safe work account/tenant, and one verified administrator-granted HTTPS site."
      )
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "SharePoint OAuth access token", maxLength: 30000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "SharePoint OAuth refresh token", maxLength: 30000)
    let id = createRelayId("mpc")
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "SharePoint OAuth access token",
      secretValue: access)
    let refreshRef: SecretReference
    do {
      refreshRef = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "SharePoint OAuth refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "sharepoint_oauth_access_token", label: "SharePoint OAuth access token",
        required: true, userOwnedRequired: false, secretReferenceId: accessRef.id,
        status: .verified,
        helpText:
          "Short-lived delegated token stored as a secret reference and replaced by Railway.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "sharepoint_oauth_refresh_token", label: "SharePoint OAuth refresh token",
        required: true, userOwnedRequired: false, secretReferenceId: refreshRef.id,
        status: .verified,
        helpText:
          "Offline refresh token stored separately; only Railway uses the Entra app secret.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "sharepoint_site", label: "Administrator-granted SharePoint site", required: true,
        userOwnedRequired: false, secretReferenceId: nil, status: .verified,
        helpText:
          "One externally granted read-only site; tenant discovery and cross-site access are excluded.",
        redactionStatus: "private-state-excluded"),
    ]
    let diagnostics: [String: JSONValue] = [
      "provider": .string("sharepoint"), "apiOrigin": .string("https://graph.microsoft.com/v1.0"),
      "authorizeOrigin": .string("https://login.microsoftonline.com/organizations/oauth2/v2.0"),
      "accountEmail": .string(email), "tenantId": .string(tenant),
      "selectedSiteId": .string(siteId), "selectedSiteDisplayName": .string(siteName),
      "selectedSiteWebURL": .string(siteWebURL), "siteGrantVerified": .bool(true),
      "accessExpiresAt": expiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
      "exactScopes": .array(Self.sharePointRelayOwnedOAuthScopes.map(JSONValue.string)),
      "protocolScopes": .array([.string("openid"), .string("profile"), .string("offline_access")]),
      "delegatedOnly": .bool(true), "workSchoolOnly": .bool(true), "selectedSiteOnly": .bool(true),
      "metadataOnly": .bool(true), "tenantSearchEnabled": .bool(false),
      "listItemsFieldsEnabled": .bool(false), "contentEnabled": .bool(false),
      "permissionsAdminEnabled": .bool(false), "writesEnabled": .bool(false),
      "automaticPagination": .bool(false), "rawToolsEnabled": .bool(false),
      "maxResults": .number(25), "pkceS256": .bool(true),
      "clientSecretLocation": .string("secure-railway-broker-only"),
      "rawTokenStoredInDatabase": .bool(false),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "sharepoint-relay-owned-microsoft-oauth:" + tenant + ":" + siteId,
      providerName: "SharePoint", status: .connected, authorizationState: .completed,
      credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
      credentialRequirements: requirements, secretReferenceIds: [accessRef.id, refreshRef.id],
      accountLabel: accountLabel?.providerConnectionNilIfEmpty ?? siteName,
      connectedHandle: siteWebURL,
      callbackURL: nil, requiredScopes: Self.sharePointRelayOwnedOAuthScopes,
      grantedScopes: Self.sharePointRelayOwnedOAuthScopes, selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message: "Relay-owned SharePoint OAuth is ready for four selected-site metadata tools.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [], diagnostics: diagnostics,
        redactionStatus: "private-state-excluded"), senderIdentities: [],
      installPolicy: "delegated_selected_site_read_metadata_only", lastCheckedAt: timestamp,
      lastError: nil, manualEvidenceNote: nil, reauthorizeRequired: false, disconnecting: false,
      betaBlocked: false, createdAt: timestamp, updatedAt: timestamp,
      redactionStatus: "private-state-excluded")
    do { return try saveConnection(context: context, connection: connection) } catch {
      _ = try? secrets.delete(accessRef.id)
      _ = try? secrets.delete(refreshRef.id)
      throw error
    }
  }
  @discardableResult public func rotateSharePointRelayOwnedOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String?, expiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    sharePointTokenRotationLock.lock()
    defer { sharePointTokenRotationLock.unlock() }
    guard
      var connection = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      connection.appSlug == "sharepoint", connection.credentialOwnership == .relayOwned,
      connection.grantedScopes == Self.sharePointRelayOwnedOAuthScopes,
      connection.health.diagnostics["selectedSiteOnly"]?.bool == true,
      connection.health.diagnostics["siteGrantVerified"]?.bool == true
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "An exact delegated selected-site SharePoint connection is required.")
    }
    let access = try requireNonEmptyString(
      accessToken, field: "SharePoint OAuth access token", maxLength: 30000)
    let oldAccess = connection.credentialRequirements.first {
      $0.fieldKey == "sharepoint_oauth_access_token"
    }?.secretReferenceId
    let oldRefresh = connection.credentialRequirements.first {
      $0.fieldKey == "sharepoint_oauth_refresh_token"
    }?.secretReferenceId
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: connection.id, label: "SharePoint OAuth access token",
      secretValue: access)
    let refreshRef: SecretReference?
    do {
      refreshRef = try refreshToken?.providerConnectionNilIfEmpty.map {
        try secrets.set(
          scope: "provider_connection", scopeId: connection.id,
          label: "SharePoint OAuth refresh token", secretValue: $0)
      }
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    connection.credentialRequirements = connection.credentialRequirements.map { value in
      var copy = value
      if copy.fieldKey == "sharepoint_oauth_access_token" { copy.secretReferenceId = accessRef.id }
      if copy.fieldKey == "sharepoint_oauth_refresh_token", let refreshRef {
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

  @discardableResult public func saveMicrosoftPlannerRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    accountEmail: String, accountLabel: String?, tenantId: String, grantedScopes: [String],
    expiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "microsoft-planner")
    let email = accountEmail.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
    let tenant = tenantId.trimmingCharacters(in: .whitespacesAndNewlines)
    guard app.slug == "microsoft-planner", email.count <= 320, email.contains("@"),
      Self.isSafeMicrosoftTenantId(tenant),
      grantedScopes == Self.microsoftPlannerRelayOwnedOAuthScopes
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "Planner requires exact delegated Tasks.Read and a safe work account/tenant.")
    }
    try validateAppCanAuthorize(app, context: context)
    let id = createRelayId("mpc")
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let a = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Planner OAuth access token",
      secretValue: try requireNonEmptyString(
        accessToken, field: "Planner access token", maxLength: 30000))
    let r = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Planner OAuth refresh token",
      secretValue: try requireNonEmptyString(
        refreshToken, field: "Planner refresh token", maxLength: 30000))
    let reqs = [
      ProviderCredentialRequirement(
        fieldKey: "microsoft_planner_oauth_access_token", label: "Planner OAuth access token",
        required: true, userOwnedRequired: false, secretReferenceId: a.id, status: .verified,
        helpText: "Railway-rotated delegated token.", redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "microsoft_planner_oauth_refresh_token", label: "Planner OAuth refresh token",
        required: true, userOwnedRequired: false, secretReferenceId: r.id, status: .verified,
        helpText: "Railway-only offline token.", redactionStatus: "secret-reference-only"),
    ]
    let d: [String: JSONValue] = [
      "apiOrigin": .string("https://graph.microsoft.com/v1.0"), "delegatedOnly": .bool(true),
      "workSchoolOnly": .bool(true), "assignmentIdentitiesEnabled": .bool(false),
      "detailsEnabled": .bool(false), "groupDirectoryEnabled": .bool(false),
      "writesEnabled": .bool(false), "applicationPermissionsEnabled": .bool(false),
      "automaticPagination": .bool(false), "rawToolsEnabled": .bool(false),
      "maxResults": .number(25), "pkceS256": .bool(true),
      "accessExpiresAt": expiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
    ]
    let c = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "microsoft-planner-relay-owned-oauth:" + tenant + ":" + email,
      providerName: "Microsoft Planner", status: .connected, authorizationState: .completed,
      credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
      credentialRequirements: reqs, secretReferenceIds: [a.id, r.id],
      accountLabel: accountLabel?.providerConnectionNilIfEmpty ?? email, connectedHandle: email,
      callbackURL: nil,
      requiredScopes: Self.microsoftPlannerRelayOwnedOAuthScopes,
      grantedScopes: Self.microsoftPlannerRelayOwnedOAuthScopes,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready, message: "Planner is ready for four bounded reads.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [], diagnostics: d,
        redactionStatus: "private-state-excluded"), senderIdentities: [],
      installPolicy: "delegated_planner_read_only", lastCheckedAt: timestamp, lastError: nil,
      manualEvidenceNote: nil, reauthorizeRequired: false, disconnecting: false, betaBlocked: false,
      createdAt: timestamp, updatedAt: timestamp, redactionStatus: "private-state-excluded")
    return try saveConnection(context: context, connection: c)
  }

  @discardableResult public func rotateMicrosoftPlannerRelayOwnedOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String?, expiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    microsoftPlannerTokenRotationLock.lock()
    defer { microsoftPlannerTokenRotationLock.unlock() }
    guard
      var connection = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      connection.appSlug == "microsoft-planner", connection.credentialOwnership == .relayOwned,
      connection.grantedScopes == Self.microsoftPlannerRelayOwnedOAuthScopes,
      connection.health.diagnostics["delegatedOnly"]?.bool == true,
      connection.health.diagnostics["workSchoolOnly"]?.bool == true
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "An exact delegated Planner Tasks.Read connection is required.")
    }
    let access = try requireNonEmptyString(
      accessToken, field: "Planner OAuth access token", maxLength: 30000)
    let oldAccess = connection.credentialRequirements.first {
      $0.fieldKey == "microsoft_planner_oauth_access_token"
    }?.secretReferenceId
    let oldRefresh = connection.credentialRequirements.first {
      $0.fieldKey == "microsoft_planner_oauth_refresh_token"
    }?.secretReferenceId
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: connection.id, label: "Planner OAuth access token",
      secretValue: access)
    let refreshRef: SecretReference?
    do {
      refreshRef = try refreshToken?.providerConnectionNilIfEmpty.map {
        try secrets.set(
          scope: "provider_connection", scopeId: connection.id,
          label: "Planner OAuth refresh token", secretValue: $0)
      }
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    connection.credentialRequirements = connection.credentialRequirements.map { value in
      var copy = value
      if copy.fieldKey == "microsoft_planner_oauth_access_token" {
        copy.secretReferenceId = accessRef.id
      }
      if copy.fieldKey == "microsoft_planner_oauth_refresh_token", let refreshRef {
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

  @discardableResult public func saveMicrosoftToDoRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    accountEmail: String, accountLabel: String?, tenantId: String, grantedScopes: [String],
    expiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "microsoft-to-do")
    let email = accountEmail.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
    let tenant = tenantId.trimmingCharacters(in: .whitespacesAndNewlines)
    guard app.slug == "microsoft-to-do", email.count <= 320, email.contains("@"),
      Self.isSafeMicrosoftTenantId(tenant), grantedScopes == Self.microsoftToDoRelayOwnedOAuthScopes
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "Microsoft To Do requires exact delegated Tasks.Read and a safe Microsoft account/tenant."
      )
    }
    try validateAppCanAuthorize(app, context: context)
    let id = createRelayId("mpc")
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let a = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Microsoft To Do OAuth access token",
      secretValue: try requireNonEmptyString(
        accessToken, field: "Microsoft To Do access token", maxLength: 30000))
    let r = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Microsoft To Do OAuth refresh token",
      secretValue: try requireNonEmptyString(
        refreshToken, field: "Microsoft To Do refresh token", maxLength: 30000))
    let reqs = [
      ProviderCredentialRequirement(
        fieldKey: "microsoft_todo_oauth_access_token", label: "Microsoft To Do OAuth access token",
        required: true, userOwnedRequired: false, secretReferenceId: a.id, status: .verified,
        helpText: "Railway-rotated delegated token.", redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "microsoft_todo_oauth_refresh_token",
        label: "Microsoft To Do OAuth refresh token", required: true, userOwnedRequired: false,
        secretReferenceId: r.id, status: .verified, helpText: "Railway-only offline token.",
        redactionStatus: "secret-reference-only"),
    ]
    let d: [String: JSONValue] = [
      "apiOrigin": .string("https://graph.microsoft.com/v1.0"), "delegatedSelfOnly": .bool(true),
      "personalAccountsSupported": .bool(true), "sharedTasksEnabled": .bool(false),
      "taskBodyEnabled": .bool(false), "relatedContentEnabled": .bool(false),
      "deltaExtensionsEnabled": .bool(false), "writesEnabled": .bool(false),
      "applicationPermissionsEnabled": .bool(false), "automaticPagination": .bool(false),
      "rawToolsEnabled": .bool(false), "maxResults": .number(25), "pkceS256": .bool(true),
      "accessExpiresAt": expiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
    ]
    let c = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "microsoft-to-do-relay-owned-oauth:" + tenant + ":" + email,
      providerName: "Microsoft To Do", status: .connected, authorizationState: .completed,
      credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
      credentialRequirements: reqs, secretReferenceIds: [a.id, r.id],
      accountLabel: accountLabel?.providerConnectionNilIfEmpty ?? email, connectedHandle: email,
      callbackURL: nil,
      requiredScopes: Self.microsoftToDoRelayOwnedOAuthScopes,
      grantedScopes: Self.microsoftToDoRelayOwnedOAuthScopes,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready, message: "Microsoft To Do is ready for four bounded reads.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [], diagnostics: d,
        redactionStatus: "private-state-excluded"), senderIdentities: [],
      installPolicy: "delegated_self_todo_read_only", lastCheckedAt: timestamp, lastError: nil,
      manualEvidenceNote: nil, reauthorizeRequired: false, disconnecting: false, betaBlocked: false,
      createdAt: timestamp, updatedAt: timestamp, redactionStatus: "private-state-excluded")
    do { return try saveConnection(context: context, connection: c) } catch {
      _ = try? secrets.delete(a.id)
      _ = try? secrets.delete(r.id)
      throw error
    }
  }
  @discardableResult public func rotateMicrosoftToDoRelayOwnedOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String?, expiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    microsoftToDoTokenRotationLock.lock()
    defer { microsoftToDoTokenRotationLock.unlock() }
    guard
      var connection = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      connection.appSlug == "microsoft-to-do", connection.credentialOwnership == .relayOwned,
      connection.grantedScopes == Self.microsoftToDoRelayOwnedOAuthScopes,
      connection.health.diagnostics["delegatedSelfOnly"]?.bool == true
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "An exact delegated Microsoft To Do Tasks.Read connection is required.")
    }
    let access = try requireNonEmptyString(
      accessToken, field: "Microsoft To Do OAuth access token", maxLength: 30000)
    let oldAccess = connection.credentialRequirements.first {
      $0.fieldKey == "microsoft_todo_oauth_access_token"
    }?.secretReferenceId
    let oldRefresh = connection.credentialRequirements.first {
      $0.fieldKey == "microsoft_todo_oauth_refresh_token"
    }?.secretReferenceId
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: connection.id,
      label: "Microsoft To Do OAuth access token", secretValue: access)
    let refreshRef = try refreshToken?.providerConnectionNilIfEmpty.map {
      try secrets.set(
        scope: "provider_connection", scopeId: connection.id,
        label: "Microsoft To Do OAuth refresh token", secretValue: $0)
    }
    connection.credentialRequirements = connection.credentialRequirements.map { value in
      var copy = value
      if copy.fieldKey == "microsoft_todo_oauth_access_token" {
        copy.secretReferenceId = accessRef.id
      }
      if copy.fieldKey == "microsoft_todo_oauth_refresh_token", let refreshRef {
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

  @discardableResult public func saveMicrosoftListsRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    accountEmail: String, accountLabel: String?, tenantId: String, siteId: String, listId: String,
    listDisplayName: String, listWebURL: String, allowedFieldNames: [String],
    listGrantVerified: Bool, grantedScopes: [String], expiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "microsoft-lists")
    let email = accountEmail.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
    let tenant = tenantId.trimmingCharacters(in: .whitespacesAndNewlines)
    let listName = listDisplayName.trimmingCharacters(in: .whitespacesAndNewlines)
    let fields = Set(allowedFieldNames.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) })
    guard app.slug == "microsoft-lists", email.count <= 320, email.contains("@"),
      Self.isSafeMicrosoftTenantId(tenant), MicrosoftListsProviderActionSupport.safeSiteId(siteId),
      (try? MicrosoftListsProviderActionSupport.identifier(.string(listId), "listId")) != nil,
      !listName.isEmpty, listName.count <= 256, let url = URL(string: listWebURL),
      url.scheme == "https", url.host?.providerConnectionNilIfEmpty != nil, listGrantVerified,
      MicrosoftListsProviderActionSupport.safeFieldSet(fields), !fields.isEmpty,
      grantedScopes == Self.microsoftListsRelayOwnedOAuthScopes
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "Microsoft Lists requires exact delegated Lists.SelectedOperations.Selected, one verified selected list, and 1-20 safe allowed field names."
      )
    }
    try validateAppCanAuthorize(app, context: context)
    let id = createRelayId("mpc")
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let a = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Microsoft Lists OAuth access token",
      secretValue: try requireNonEmptyString(
        accessToken, field: "Microsoft Lists access token", maxLength: 30000))
    let r = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Microsoft Lists OAuth refresh token",
      secretValue: try requireNonEmptyString(
        refreshToken, field: "Microsoft Lists refresh token", maxLength: 30000))
    let reqs = [
      ProviderCredentialRequirement(
        fieldKey: "microsoft_lists_oauth_access_token", label: "Microsoft Lists OAuth access token",
        required: true, userOwnedRequired: false, secretReferenceId: a.id, status: .verified,
        helpText: "Railway-rotated delegated token.", redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "microsoft_lists_oauth_refresh_token",
        label: "Microsoft Lists OAuth refresh token", required: true, userOwnedRequired: false,
        secretReferenceId: r.id, status: .verified, helpText: "Railway-only offline token.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "microsoft_lists_selected_list", label: "Administrator-granted Microsoft List",
        required: true, userOwnedRequired: false, secretReferenceId: nil, status: .verified,
        helpText: "One list grant plus an approved field allowlist.",
        redactionStatus: "private-state-excluded"),
    ]
    let d: [String: JSONValue] = [
      "apiOrigin": .string("https://graph.microsoft.com/v1.0"), "delegatedOnly": .bool(true),
      "workSchoolOnly": .bool(true), "selectedSiteId": .string(siteId),
      "selectedListId": .string(listId), "selectedListDisplayName": .string(listName),
      "selectedListWebURL": .string(listWebURL), "selectedListOnly": .bool(true),
      "listGrantVerified": .bool(true),
      "allowedFieldNames": .array(fields.sorted().map(JSONValue.string)),
      "unapprovedFieldsEnabled": .bool(false), "attachmentsDriveEnabled": .bool(false),
      "identitiesPermissionsEnabled": .bool(false), "writesEnabled": .bool(false),
      "deltaSearchExportEnabled": .bool(false), "applicationPermissionsEnabled": .bool(false),
      "automaticPagination": .bool(false), "rawToolsEnabled": .bool(false),
      "maxResults": .number(25), "pkceS256": .bool(true),
      "accessExpiresAt": expiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
    ]
    let c = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "microsoft-lists-relay-owned-oauth:" + tenant + ":" + siteId + ":" + listId,
      providerName: "Microsoft Lists", status: .connected, authorizationState: .completed,
      credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
      credentialRequirements: reqs, secretReferenceIds: [a.id, r.id],
      accountLabel: accountLabel?.providerConnectionNilIfEmpty ?? listName,
      connectedHandle: listWebURL,
      callbackURL: nil, requiredScopes: Self.microsoftListsRelayOwnedOAuthScopes,
      grantedScopes: Self.microsoftListsRelayOwnedOAuthScopes,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready, message: "Microsoft Lists is ready for four selected-list reads.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [], diagnostics: d,
        redactionStatus: "private-state-excluded"), senderIdentities: [],
      installPolicy: "delegated_selected_list_allowed_fields_read_only", lastCheckedAt: timestamp,
      lastError: nil, manualEvidenceNote: nil, reauthorizeRequired: false, disconnecting: false,
      betaBlocked: false, createdAt: timestamp, updatedAt: timestamp,
      redactionStatus: "private-state-excluded")
    do { return try saveConnection(context: context, connection: c) } catch {
      _ = try? secrets.delete(a.id)
      _ = try? secrets.delete(r.id)
      throw error
    }
  }
  @discardableResult public func rotateMicrosoftListsRelayOwnedOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String?, expiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    microsoftListsTokenRotationLock.lock()
    defer { microsoftListsTokenRotationLock.unlock() }
    guard
      var connection = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      connection.appSlug == "microsoft-lists", connection.credentialOwnership == .relayOwned,
      connection.grantedScopes == Self.microsoftListsRelayOwnedOAuthScopes,
      connection.health.diagnostics["selectedListOnly"]?.bool == true,
      connection.health.diagnostics["listGrantVerified"]?.bool == true
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "An exact selected-list Microsoft Lists connection is required.")
    }
    let access = try requireNonEmptyString(
      accessToken, field: "Microsoft Lists OAuth access token", maxLength: 30000)
    let oldAccess = connection.credentialRequirements.first {
      $0.fieldKey == "microsoft_lists_oauth_access_token"
    }?.secretReferenceId
    let oldRefresh = connection.credentialRequirements.first {
      $0.fieldKey == "microsoft_lists_oauth_refresh_token"
    }?.secretReferenceId
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: connection.id,
      label: "Microsoft Lists OAuth access token", secretValue: access)
    let refreshRef = try refreshToken?.providerConnectionNilIfEmpty.map {
      try secrets.set(
        scope: "provider_connection", scopeId: connection.id,
        label: "Microsoft Lists OAuth refresh token", secretValue: $0)
    }
    connection.credentialRequirements = connection.credentialRequirements.map { value in
      var copy = value
      if copy.fieldKey == "microsoft_lists_oauth_access_token" {
        copy.secretReferenceId = accessRef.id
      }
      if copy.fieldKey == "microsoft_lists_oauth_refresh_token", let refreshRef {
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

  @discardableResult public func saveOneNoteRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    accountEmail: String, accountLabel: String?, tenantId: String, grantedScopes: [String],
    expiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "onenote")
    let email = accountEmail.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
    let tenant = tenantId.trimmingCharacters(in: .whitespacesAndNewlines)
    guard app.slug == "onenote", email.count <= 320, email.contains("@"),
      Self.isSafeMicrosoftTenantId(tenant), grantedScopes == Self.oneNoteRelayOwnedOAuthScopes
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "OneNote requires exact delegated Notes.Read and a safe Microsoft account/tenant.")
    }
    try validateAppCanAuthorize(app, context: context)
    let id = createRelayId("mpc")
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let a = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "OneNote OAuth access token",
      secretValue: try requireNonEmptyString(
        accessToken, field: "OneNote access token", maxLength: 30000))
    let r = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "OneNote OAuth refresh token",
      secretValue: try requireNonEmptyString(
        refreshToken, field: "OneNote refresh token", maxLength: 30000))
    let reqs = [
      ProviderCredentialRequirement(
        fieldKey: "onenote_oauth_access_token", label: "OneNote OAuth access token", required: true,
        userOwnedRequired: false, secretReferenceId: a.id, status: .verified,
        helpText: "Railway-rotated delegated token.", redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "onenote_oauth_refresh_token", label: "OneNote OAuth refresh token",
        required: true, userOwnedRequired: false, secretReferenceId: r.id, status: .verified,
        helpText: "Railway-only offline token.", redactionStatus: "secret-reference-only"),
    ]
    let d: [String: JSONValue] = [
      "apiOrigin": .string("https://graph.microsoft.com/v1.0"), "delegatedSelfOnly": .bool(true),
      "personalAccountsSupported": .bool(true), "metadataOnly": .bool(true),
      "pageContentEnabled": .bool(false), "resourcesMediaOCREnabled": .bool(false),
      "sharedGroupSiteEnabled": .bool(false), "searchClassStaffEnabled": .bool(false),
      "writesEnabled": .bool(false), "permissionsWebhooksEnabled": .bool(false),
      "applicationPermissionsEnabled": .bool(false), "automaticPagination": .bool(false),
      "rawToolsEnabled": .bool(false), "maxResults": .number(25), "pkceS256": .bool(true),
      "accessExpiresAt": expiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
    ]
    let c = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "onenote-relay-owned-oauth:" + tenant + ":" + email, providerName: "OneNote",
      status: .connected, authorizationState: .completed, credentialOwnership: .relayOwned,
      userOwnedCredentialsRequired: false, credentialRequirements: reqs,
      secretReferenceIds: [a.id, r.id],
      accountLabel: accountLabel?.providerConnectionNilIfEmpty ?? email,
      connectedHandle: email, callbackURL: nil, requiredScopes: Self.oneNoteRelayOwnedOAuthScopes,
      grantedScopes: Self.oneNoteRelayOwnedOAuthScopes, selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready, message: "OneNote is ready for four bounded metadata reads.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [], diagnostics: d,
        redactionStatus: "private-state-excluded"), senderIdentities: [],
      installPolicy: "delegated_self_onenote_metadata_read_only", lastCheckedAt: timestamp,
      lastError: nil, manualEvidenceNote: nil, reauthorizeRequired: false, disconnecting: false,
      betaBlocked: false, createdAt: timestamp, updatedAt: timestamp,
      redactionStatus: "private-state-excluded")
    do { return try saveConnection(context: context, connection: c) } catch {
      _ = try? secrets.delete(a.id)
      _ = try? secrets.delete(r.id)
      throw error
    }
  }
  @discardableResult public func rotateOneNoteRelayOwnedOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String?, expiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    oneNoteTokenRotationLock.lock()
    defer { oneNoteTokenRotationLock.unlock() }
    guard
      var connection = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      connection.appSlug == "onenote", connection.credentialOwnership == .relayOwned,
      connection.grantedScopes == Self.oneNoteRelayOwnedOAuthScopes,
      connection.health.diagnostics["delegatedSelfOnly"]?.bool == true
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "An exact delegated OneNote Notes.Read connection is required.")
    }
    let access = try requireNonEmptyString(
      accessToken, field: "OneNote OAuth access token", maxLength: 30000)
    let oldAccess = connection.credentialRequirements.first {
      $0.fieldKey == "onenote_oauth_access_token"
    }?.secretReferenceId
    let oldRefresh = connection.credentialRequirements.first {
      $0.fieldKey == "onenote_oauth_refresh_token"
    }?.secretReferenceId
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: connection.id, label: "OneNote OAuth access token",
      secretValue: access)
    let refreshRef = try refreshToken?.providerConnectionNilIfEmpty.map {
      try secrets.set(
        scope: "provider_connection", scopeId: connection.id, label: "OneNote OAuth refresh token",
        secretValue: $0)
    }
    connection.credentialRequirements = connection.credentialRequirements.map { value in
      var copy = value
      if copy.fieldKey == "onenote_oauth_access_token" { copy.secretReferenceId = accessRef.id }
      if copy.fieldKey == "onenote_oauth_refresh_token", let refreshRef {
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

  @discardableResult public func saveMicrosoftBookingsRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    accountEmail: String, accountLabel: String?, tenantId: String, selectedBusinessId: String,
    selectedBusinessDisplayName: String, selectedBusinessVerified: Bool, grantedScopes: [String],
    expiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "microsoft-bookings")
    let email = accountEmail.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
    let tenant = tenantId.trimmingCharacters(in: .whitespacesAndNewlines)
    let business = try MicrosoftBookingsProviderActionSupport.identifier(
      .string(selectedBusinessId), "selectedBusinessId")
    let businessName = selectedBusinessDisplayName.trimmingCharacters(in: .whitespacesAndNewlines)
    guard app.slug == "microsoft-bookings", email.count <= 320, email.contains("@"),
      Self.isSafeMicrosoftTenantId(tenant), tenant.lowercased() != "consumers",
      selectedBusinessVerified, !businessName.isEmpty, businessName.count <= 512,
      grantedScopes == Self.microsoftBookingsRelayOwnedOAuthScopes
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "Microsoft Bookings requires exact delegated Bookings.Read.All, a work tenant, and a verified selected business."
      )
    }
    try validateAppCanAuthorize(app, context: context)
    let id = createRelayId("mpc")
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let a = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Microsoft Bookings OAuth access token",
      secretValue: try requireNonEmptyString(
        accessToken, field: "Microsoft Bookings access token", maxLength: 30000))
    let r = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Microsoft Bookings OAuth refresh token",
      secretValue: try requireNonEmptyString(
        refreshToken, field: "Microsoft Bookings refresh token", maxLength: 30000))
    let reqs = [
      ProviderCredentialRequirement(
        fieldKey: "microsoft_bookings_oauth_access_token",
        label: "Microsoft Bookings OAuth access token", required: true, userOwnedRequired: false,
        secretReferenceId: a.id, status: .verified, helpText: "Railway-rotated delegated token.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "microsoft_bookings_oauth_refresh_token",
        label: "Microsoft Bookings OAuth refresh token", required: true, userOwnedRequired: false,
        secretReferenceId: r.id, status: .verified, helpText: "Railway-only offline token.",
        redactionStatus: "secret-reference-only"),
    ]
    let d: [String: JSONValue] = [
      "apiOrigin": .string("https://graph.microsoft.com/v1.0"), "workSchoolOnly": .bool(true),
      "selectedBusinessId": .string(business), "selectedBusinessDisplayName": .string(businessName),
      "selectedBusinessVerified": .bool(true), "privacyScrubbed": .bool(true),
      "customerPIIEnabled": .bool(false), "staffIdentityEnabled": .bool(false),
      "notesJoinURLsEnabled": .bool(false), "writesEnabled": .bool(false),
      "applicationPermissionsEnabled": .bool(false), "automaticPagination": .bool(false),
      "rawToolsEnabled": .bool(false), "maxResults": .number(25),
      "maxCalendarRangeDays": .number(7), "pkceS256": .bool(true),
      "accessExpiresAt": expiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
    ]
    let c = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "microsoft-bookings-relay-owned-oauth:" + tenant + ":" + email + ":" + business,
      providerName: "Microsoft Bookings", status: .connected, authorizationState: .completed,
      credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
      credentialRequirements: reqs, secretReferenceIds: [a.id, r.id],
      accountLabel: accountLabel?.providerConnectionNilIfEmpty ?? businessName,
      connectedHandle: email,
      callbackURL: nil, requiredScopes: Self.microsoftBookingsRelayOwnedOAuthScopes,
      grantedScopes: Self.microsoftBookingsRelayOwnedOAuthScopes,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message: "Microsoft Bookings is ready for four selected-business privacy-scrubbed reads.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [], diagnostics: d,
        redactionStatus: "private-state-excluded"), senderIdentities: [],
      installPolicy: "selected_business_privacy_scrubbed_read_only", lastCheckedAt: timestamp,
      lastError: nil, manualEvidenceNote: nil, reauthorizeRequired: false, disconnecting: false,
      betaBlocked: false, createdAt: timestamp, updatedAt: timestamp,
      redactionStatus: "private-state-excluded")
    do { return try saveConnection(context: context, connection: c) } catch {
      _ = try? secrets.delete(a.id)
      _ = try? secrets.delete(r.id)
      throw error
    }
  }
  @discardableResult public func rotateMicrosoftBookingsRelayOwnedOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String?, expiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    microsoftBookingsTokenRotationLock.lock()
    defer { microsoftBookingsTokenRotationLock.unlock() }
    guard
      var connection = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      connection.appSlug == "microsoft-bookings", connection.credentialOwnership == .relayOwned,
      connection.grantedScopes == Self.microsoftBookingsRelayOwnedOAuthScopes,
      connection.health.diagnostics["selectedBusinessVerified"]?.bool == true
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "An exact selected-business Microsoft Bookings connection is required.")
    }
    let access = try requireNonEmptyString(
      accessToken, field: "Microsoft Bookings OAuth access token", maxLength: 30000)
    let oldAccess = connection.credentialRequirements.first {
      $0.fieldKey == "microsoft_bookings_oauth_access_token"
    }?.secretReferenceId
    let oldRefresh = connection.credentialRequirements.first {
      $0.fieldKey == "microsoft_bookings_oauth_refresh_token"
    }?.secretReferenceId
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: connection.id,
      label: "Microsoft Bookings OAuth access token", secretValue: access)
    let refreshRef = try refreshToken?.providerConnectionNilIfEmpty.map {
      try secrets.set(
        scope: "provider_connection", scopeId: connection.id,
        label: "Microsoft Bookings OAuth refresh token", secretValue: $0)
    }
    connection.credentialRequirements = connection.credentialRequirements.map { value in
      var copy = value
      if copy.fieldKey == "microsoft_bookings_oauth_access_token" {
        copy.secretReferenceId = accessRef.id
      }
      if copy.fieldKey == "microsoft_bookings_oauth_refresh_token", let refreshRef {
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

  @discardableResult public func saveMicrosoftPowerBIRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    accountEmail: String, accountLabel: String?, tenantId: String, selectedWorkspaceId: String,
    selectedWorkspaceName: String, selectedWorkspaceVerified: Bool, grantedScopes: [String],
    expiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "microsoft-power-bi")
    let email = accountEmail.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
    let tenant = tenantId.trimmingCharacters(in: .whitespacesAndNewlines)
    let workspaceId = try MicrosoftPowerBIProviderActionSupport.identifier(
      .string(selectedWorkspaceId), "selectedWorkspaceId")
    let workspaceName = selectedWorkspaceName.trimmingCharacters(in: .whitespacesAndNewlines)
    guard app.slug == "microsoft-power-bi", email.count <= 320, email.contains("@"),
      Self.isSafeMicrosoftTenantId(tenant), tenant.lowercased() != "consumers",
      selectedWorkspaceVerified, !workspaceName.isEmpty, workspaceName.count <= 512,
      grantedScopes == Self.microsoftPowerBIRelayOwnedOAuthScopes
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "Microsoft Power BI requires exact delegated read scopes, a work tenant, and one verified selected workspace."
      )
    }
    try validateAppCanAuthorize(app, context: context)
    let id = createRelayId("mpc")
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let a = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Microsoft Power BI OAuth access token",
      secretValue: try requireNonEmptyString(
        accessToken, field: "Microsoft Power BI access token", maxLength: 30000))
    let r = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Microsoft Power BI OAuth refresh token",
      secretValue: try requireNonEmptyString(
        refreshToken, field: "Microsoft Power BI refresh token", maxLength: 30000))
    let reqs = [
      ProviderCredentialRequirement(
        fieldKey: "microsoft_power_bi_oauth_access_token",
        label: "Microsoft Power BI OAuth access token", required: true, userOwnedRequired: false,
        secretReferenceId: a.id, status: .verified, helpText: "Railway-rotated delegated token.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "microsoft_power_bi_oauth_refresh_token",
        label: "Microsoft Power BI OAuth refresh token", required: true, userOwnedRequired: false,
        secretReferenceId: r.id, status: .verified, helpText: "Railway-only offline token.",
        redactionStatus: "secret-reference-only"),
    ]
    let d: [String: JSONValue] = [
      "apiOrigin": .string("https://api.powerbi.com/v1.0/myorg"), "workSchoolOnly": .bool(true),
      "selectedWorkspaceId": .string(workspaceId), "selectedWorkspaceName": .string(workspaceName),
      "selectedWorkspaceVerified": .bool(true), "metadataOnly": .bool(true),
      "reportContentEnabled": .bool(false), "embedURLsTokensEnabled": .bool(false),
      "datasetQueriesEnabled": .bool(false), "identitiesEnabled": .bool(false),
      "refreshGatewayAdminEnabled": .bool(false), "exportsDownloadsEnabled": .bool(false),
      "writesEnabled": .bool(false), "applicationPermissionsEnabled": .bool(false),
      "automaticPagination": .bool(false), "rawToolsEnabled": .bool(false),
      "maxResults": .number(25), "pkceS256": .bool(true),
      "accessExpiresAt": expiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
    ]
    let c = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "microsoft-power-bi-relay-owned-oauth:" + tenant + ":" + email + ":"
        + workspaceId, providerName: "Microsoft Power BI", status: .connected,
      authorizationState: .completed, credentialOwnership: .relayOwned,
      userOwnedCredentialsRequired: false, credentialRequirements: reqs,
      secretReferenceIds: [a.id, r.id],
      accountLabel: accountLabel?.providerConnectionNilIfEmpty ?? workspaceName,
      connectedHandle: email, callbackURL: nil,
      requiredScopes: Self.microsoftPowerBIRelayOwnedOAuthScopes,
      grantedScopes: Self.microsoftPowerBIRelayOwnedOAuthScopes,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message: "Microsoft Power BI is ready for four selected-workspace metadata reads.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [], diagnostics: d,
        redactionStatus: "private-state-excluded"), senderIdentities: [],
      installPolicy: "selected_workspace_metadata_read_only", lastCheckedAt: timestamp,
      lastError: nil, manualEvidenceNote: nil, reauthorizeRequired: false, disconnecting: false,
      betaBlocked: false, createdAt: timestamp, updatedAt: timestamp,
      redactionStatus: "private-state-excluded")
    do { return try saveConnection(context: context, connection: c) } catch {
      _ = try? secrets.delete(a.id)
      _ = try? secrets.delete(r.id)
      throw error
    }
  }
  @discardableResult public func rotateMicrosoftPowerBIRelayOwnedOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String?, expiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    microsoftPowerBITokenRotationLock.lock()
    defer { microsoftPowerBITokenRotationLock.unlock() }
    guard
      var connection = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      connection.appSlug == "microsoft-power-bi", connection.credentialOwnership == .relayOwned,
      connection.grantedScopes == Self.microsoftPowerBIRelayOwnedOAuthScopes,
      connection.health.diagnostics["selectedWorkspaceVerified"]?.bool == true
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "An exact selected-workspace Power BI connection is required.")
    }
    let access = try requireNonEmptyString(
      accessToken, field: "Microsoft Power BI OAuth access token", maxLength: 30000)
    let oldAccess = connection.credentialRequirements.first {
      $0.fieldKey == "microsoft_power_bi_oauth_access_token"
    }?.secretReferenceId
    let oldRefresh = connection.credentialRequirements.first {
      $0.fieldKey == "microsoft_power_bi_oauth_refresh_token"
    }?.secretReferenceId
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: connection.id,
      label: "Microsoft Power BI OAuth access token", secretValue: access)
    let refreshRef = try refreshToken?.providerConnectionNilIfEmpty.map {
      try secrets.set(
        scope: "provider_connection", scopeId: connection.id,
        label: "Microsoft Power BI OAuth refresh token", secretValue: $0)
    }
    connection.credentialRequirements = connection.credentialRequirements.map { value in
      var copy = value
      if copy.fieldKey == "microsoft_power_bi_oauth_access_token" {
        copy.secretReferenceId = accessRef.id
      }
      if copy.fieldKey == "microsoft_power_bi_oauth_refresh_token", let refreshRef {
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

  public static func microsoftDynamics365RelayOwnedOAuthScopes(environmentOrigin: String) throws
    -> [String]
  {
    [
      try MicrosoftDynamics365ProviderActionSupport.environmentOrigin(environmentOrigin)
        + "/user_impersonation"
    ]
  }
  public static let microsoftVivaEngageRelayOwnedOAuthScopes = ["access_as_user"]
  public static let zoomRelayOwnedOAuthScopes = [
    "meeting:read:list_meetings", "meeting:read:list_upcoming_meetings", "meeting:read:meeting",
  ]
  public static let discordRelayOwnedOAuthScopes = ["bot"]
}
