import Foundation

extension ProviderConnectionService {
  @discardableResult public func saveGooglePhotosRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    accountEmail: String, grantedScopes: [String], expiresAt: String?, displayName: String? = nil,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "google-photos")
    let email = accountEmail.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
    guard app.slug == "google-photos", email.count <= 320, email.contains("@"),
      !email.contains(where: { $0.isWhitespace }),
      grantedScopes == Self.googlePhotosRelayOwnedOAuthScopes
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "Relay-owned Google Photos OAuth requires the exact Picker-only scope and a safe account."
      )
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "Google Photos OAuth access token", maxLength: 30000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "Google Photos OAuth refresh token", maxLength: 30000)
    let id = createRelayId("mpc")
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Google Photos OAuth access token",
      secretValue: access)
    let refreshRef: SecretReference
    do {
      refreshRef = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Google Photos OAuth refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "google_photos_oauth_access_token", label: "Google Photos OAuth access token",
        required: true, userOwnedRequired: false, secretReferenceId: accessRef.id,
        status: .verified,
        helpText:
          "Short-lived Picker access token stored as a Keychain reference and replaced by Railway.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "google_photos_oauth_refresh_token", label: "Google Photos OAuth refresh token",
        required: true, userOwnedRequired: false, secretReferenceId: refreshRef.id,
        status: .verified,
        helpText: "Offline refresh token stored separately; only Railway uses the client secret.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "google_photos_account", label: "Authorized Google Photos Picker account",
        required: true, userOwnedRequired: false, secretReferenceId: nil, status: .verified,
        helpText:
          "Exact account binding; only media explicitly selected in a bounded Picker session is visible.",
        redactionStatus: "private-state-excluded"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "google-photos-relay-owned-google-oauth:" + email, providerName: "Google Photos",
      status: .connected, authorizationState: .completed, credentialOwnership: .relayOwned,
      userOwnedCredentialsRequired: false, credentialRequirements: requirements,
      secretReferenceIds: [accessRef.id, refreshRef.id],
      accountLabel: displayName?.providerConnectionNilIfEmpty ?? email, connectedHandle: email,
      callbackURL: nil,
      requiredScopes: Self.googlePhotosRelayOwnedOAuthScopes,
      grantedScopes: Self.googlePhotosRelayOwnedOAuthScopes, selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message:
          "Relay-owned Google Photos OAuth is ready for bounded user-controlled Picker sessions.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("google-photos"),
          "authMethod": .string("google_oauth_confidential_web_server_offline"),
          "apiOrigin": .string("https://photospicker.googleapis.com/v1"),
          "tokenOrigin": .string("https://oauth2.googleapis.com/token"),
          "accountEmail": .string(email),
          "accessExpiresAt": expiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
          "exactScopes": .array(Self.googlePhotosRelayOwnedOAuthScopes.map(JSONValue.string)),
          "pickerOnly": .bool(true), "userSelectionRequired": .bool(true),
          "libraryAPIEnabled": .bool(false), "removedLibraryScopesEnabled": .bool(false),
          "rawMediaBytesEnabled": .bool(false), "baseURLReturnedToAgents": .bool(false),
          "automaticPolling": .bool(false), "automaticPagination": .bool(false),
          "clientSecretLocation": .string("secure-railway-broker-only"),
          "rawTokenStoredInDatabase": .bool(false),
        ], redactionStatus: "private-state-excluded"),
      senderIdentities: [
        ProviderSenderIdentity(
          id: "google-photos:" + email, email: email, validationStatus: .verified, agentId: nil,
          installId: nil, lastCheckedAt: timestamp, errorMessage: nil,
          redactionStatus: "private-state-excluded")
      ], installPolicy: "approval_gated_user_selected_picker_sessions", lastCheckedAt: timestamp,
      lastError: nil, manualEvidenceNote: nil, reauthorizeRequired: false, disconnecting: false,
      betaBlocked: false, createdAt: timestamp, updatedAt: timestamp,
      redactionStatus: "private-state-excluded")
    do { return try saveConnection(context: context, connection: connection) } catch {
      _ = try? secrets.delete(accessRef.id)
      _ = try? secrets.delete(refreshRef.id)
      throw error
    }
  }

  @discardableResult public func rotateGooglePhotosRelayOwnedOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String?, expiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    googlePhotosTokenRotationLock.lock()
    defer { googlePhotosTokenRotationLock.unlock() }
    guard
      var connection = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      connection.appSlug == "google-photos", connection.credentialOwnership == .relayOwned,
      connection.grantedScopes == Self.googlePhotosRelayOwnedOAuthScopes
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "A Relay-owned exact-scope Google Photos Picker OAuth connection is required.")
    }
    let access = try requireNonEmptyString(
      accessToken, field: "Google Photos OAuth access token", maxLength: 30000)
    let oldAccess = connection.credentialRequirements.first {
      $0.fieldKey == "google_photos_oauth_access_token"
    }?.secretReferenceId
    let oldRefresh = connection.credentialRequirements.first {
      $0.fieldKey == "google_photos_oauth_refresh_token"
    }?.secretReferenceId
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: connection.id,
      label: "Google Photos OAuth access token", secretValue: access)
    let refreshRef: SecretReference?
    do {
      refreshRef = try refreshToken?.providerConnectionNilIfEmpty.map {
        try secrets.set(
          scope: "provider_connection", scopeId: connection.id,
          label: "Google Photos OAuth refresh token", secretValue: $0)
      }
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    connection.credentialRequirements = connection.credentialRequirements.map { value in
      var copy = value
      if copy.fieldKey == "google_photos_oauth_access_token" {
        copy.secretReferenceId = accessRef.id
      }
      if copy.fieldKey == "google_photos_oauth_refresh_token", let refreshRef {
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

  @discardableResult public func saveGoogleMeetRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    accountEmail: String, grantedScopes: [String], expiresAt: String?, displayName: String? = nil,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "google-meet")
    let email = accountEmail.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
    guard app.slug == "google-meet", email.count <= 320, email.contains("@"),
      !email.contains(where: { $0.isWhitespace }),
      grantedScopes == Self.googleMeetRelayOwnedOAuthScopes
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "Relay-owned Google Meet OAuth requires the exact app-created-space scope and a safe account."
      )
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "Google Meet OAuth access token", maxLength: 30000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "Google Meet OAuth refresh token", maxLength: 30000)
    let id = createRelayId("mpc")
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Google Meet OAuth access token",
      secretValue: access)
    let refreshRef: SecretReference
    do {
      refreshRef = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Google Meet OAuth refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "google_meet_oauth_access_token", label: "Google Meet OAuth access token",
        required: true, userOwnedRequired: false, secretReferenceId: accessRef.id,
        status: .verified,
        helpText:
          "Short-lived Meet access token stored as a Keychain reference and replaced by Railway.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "google_meet_oauth_refresh_token", label: "Google Meet OAuth refresh token",
        required: true, userOwnedRequired: false, secretReferenceId: refreshRef.id,
        status: .verified,
        helpText: "Offline refresh token stored separately; only Railway uses the client secret.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "google_meet_account", label: "Authorized Google Meet account", required: true,
        userOwnedRequired: false, secretReferenceId: nil, status: .verified,
        helpText:
          "Exact account binding; only spaces created by Relay's Google Cloud app are accessible.",
        redactionStatus: "private-state-excluded"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "google-meet-relay-owned-google-oauth:" + email, providerName: "Google Meet",
      status: .connected, authorizationState: .completed, credentialOwnership: .relayOwned,
      userOwnedCredentialsRequired: false, credentialRequirements: requirements,
      secretReferenceIds: [accessRef.id, refreshRef.id],
      accountLabel: displayName?.providerConnectionNilIfEmpty ?? email, connectedHandle: email,
      callbackURL: nil,
      requiredScopes: Self.googleMeetRelayOwnedOAuthScopes,
      grantedScopes: Self.googleMeetRelayOwnedOAuthScopes, selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message: "Relay-owned Google Meet OAuth is ready for safely configured app-created Spaces.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("google-meet"),
          "authMethod": .string("google_oauth_confidential_web_server_offline"),
          "apiOrigin": .string("https://meet.googleapis.com/v2"),
          "tokenOrigin": .string("https://oauth2.googleapis.com/token"),
          "accountEmail": .string(email),
          "accessExpiresAt": expiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
          "exactScopes": .array(Self.googleMeetRelayOwnedOAuthScopes.map(JSONValue.string)),
          "appCreatedSpacesOnly": .bool(true), "broadSpaceAccessEnabled": .bool(false),
          "participantsAccessEnabled": .bool(false), "conferenceRecordsAccessEnabled": .bool(false),
          "recordingsTranscriptsSmartNotesEnabled": .bool(false),
          "driveArtifactsEnabled": .bool(false), "dialInSipReturned": .bool(false),
          "endConferenceEnabled": .bool(false), "automaticPagination": .bool(false),
          "domainDelegationEnabled": .bool(false),
          "clientSecretLocation": .string("secure-railway-broker-only"),
          "rawTokenStoredInDatabase": .bool(false),
        ], redactionStatus: "private-state-excluded"),
      senderIdentities: [
        ProviderSenderIdentity(
          id: "google-meet:" + email, email: email, validationStatus: .verified, agentId: nil,
          installId: nil, lastCheckedAt: timestamp, errorMessage: nil,
          redactionStatus: "private-state-excluded")
      ], installPolicy: "approval_gated_safe_app_created_space_actions", lastCheckedAt: timestamp,
      lastError: nil, manualEvidenceNote: nil, reauthorizeRequired: false, disconnecting: false,
      betaBlocked: false, createdAt: timestamp, updatedAt: timestamp,
      redactionStatus: "private-state-excluded")
    do { return try saveConnection(context: context, connection: connection) } catch {
      _ = try? secrets.delete(accessRef.id)
      _ = try? secrets.delete(refreshRef.id)
      throw error
    }
  }

  @discardableResult public func rotateGoogleMeetRelayOwnedOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String?, expiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    googleMeetTokenRotationLock.lock()
    defer { googleMeetTokenRotationLock.unlock() }
    guard
      var connection = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      connection.appSlug == "google-meet", connection.credentialOwnership == .relayOwned,
      connection.grantedScopes == Self.googleMeetRelayOwnedOAuthScopes
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "A Relay-owned exact-scope Google Meet OAuth connection is required.")
    }
    let access = try requireNonEmptyString(
      accessToken, field: "Google Meet OAuth access token", maxLength: 30000)
    let oldAccess = connection.credentialRequirements.first {
      $0.fieldKey == "google_meet_oauth_access_token"
    }?.secretReferenceId
    let oldRefresh = connection.credentialRequirements.first {
      $0.fieldKey == "google_meet_oauth_refresh_token"
    }?.secretReferenceId
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: connection.id, label: "Google Meet OAuth access token",
      secretValue: access)
    let refreshRef: SecretReference?
    do {
      refreshRef = try refreshToken?.providerConnectionNilIfEmpty.map {
        try secrets.set(
          scope: "provider_connection", scopeId: connection.id,
          label: "Google Meet OAuth refresh token", secretValue: $0)
      }
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    connection.credentialRequirements = connection.credentialRequirements.map { value in
      var copy = value
      if copy.fieldKey == "google_meet_oauth_access_token" { copy.secretReferenceId = accessRef.id }
      if copy.fieldKey == "google_meet_oauth_refresh_token", let refreshRef {
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

  @discardableResult public func saveGoogleChatRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    accountEmail: String, grantedScopes: [String], expiresAt: String?, displayName: String? = nil,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "google-chat")
    let email = accountEmail.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
    guard app.slug == "google-chat", email.count <= 320, email.contains("@"),
      !email.contains(where: { $0.isWhitespace }),
      grantedScopes == Self.googleChatRelayOwnedOAuthScopes
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "Relay-owned Google Chat OAuth requires the exact user-auth space/message scopes and a safe account."
      )
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "Google Chat OAuth access token", maxLength: 30000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "Google Chat OAuth refresh token", maxLength: 30000)
    let id = createRelayId("mpc")
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Google Chat OAuth access token",
      secretValue: access)
    let refreshRef: SecretReference
    do {
      refreshRef = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Google Chat OAuth refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "google_chat_oauth_access_token", label: "Google Chat OAuth access token",
        required: true, userOwnedRequired: false, secretReferenceId: accessRef.id,
        status: .verified,
        helpText:
          "Short-lived Chat user token stored as a Keychain reference and replaced by Railway.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "google_chat_oauth_refresh_token", label: "Google Chat OAuth refresh token",
        required: true, userOwnedRequired: false, secretReferenceId: refreshRef.id,
        status: .verified,
        helpText: "Offline refresh token stored separately; only Railway uses the client secret.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "google_chat_account", label: "Authorized Google Chat account", required: true,
        userOwnedRequired: false, secretReferenceId: nil, status: .verified,
        helpText: "Exact user binding for explicit-space, bounded message workflows.",
        redactionStatus: "private-state-excluded"),
    ]
    let diagnostics: [String: JSONValue] = [
      "provider": .string("google-chat"),
      "authMethod": .string("google_oauth_confidential_web_server_offline_user_auth"),
      "apiOrigin": .string("https://chat.googleapis.com/v1"),
      "tokenOrigin": .string("https://oauth2.googleapis.com/token"), "accountEmail": .string(email),
      "accessExpiresAt": expiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
      "exactScopes": .array(Self.googleChatRelayOwnedOAuthScopes.map(JSONValue.string)),
      "userAuthOnly": .bool(true), "explicitSpacesOnly": .bool(true),
      "spaceDiscoveryEnabled": .bool(false), "membershipsEnabled": .bool(false),
      "adminAccessEnabled": .bool(false), "appBotAuthEnabled": .bool(false),
      "importModeEnabled": .bool(false), "privateMessagesEnabled": .bool(false),
      "attachmentsMediaEnabled": .bool(false), "reactionsEnabled": .bool(false),
      "messageMutationExceptCreateEnabled": .bool(false), "automaticPagination": .bool(false),
      "domainDelegationEnabled": .bool(false),
      "clientSecretLocation": .string("secure-railway-broker-only"),
      "rawTokenStoredInDatabase": .bool(false),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "google-chat-relay-owned-google-oauth:" + email, providerName: "Google Chat",
      status: .connected, authorizationState: .completed, credentialOwnership: .relayOwned,
      userOwnedCredentialsRequired: false, credentialRequirements: requirements,
      secretReferenceIds: [accessRef.id, refreshRef.id],
      accountLabel: displayName?.providerConnectionNilIfEmpty ?? email, connectedHandle: email,
      callbackURL: nil,
      requiredScopes: Self.googleChatRelayOwnedOAuthScopes,
      grantedScopes: Self.googleChatRelayOwnedOAuthScopes, selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message:
          "Relay-owned Google Chat OAuth is ready for explicit-space bounded reads and brokered plain-text messages.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [], diagnostics: diagnostics,
        redactionStatus: "private-state-excluded"),
      senderIdentities: [
        ProviderSenderIdentity(
          id: "google-chat:" + email, email: email, validationStatus: .verified, agentId: nil,
          installId: nil, lastCheckedAt: timestamp, errorMessage: nil,
          redactionStatus: "private-state-excluded")
      ], installPolicy: "approval_gated_explicit_space_plain_text_messages",
      lastCheckedAt: timestamp, lastError: nil, manualEvidenceNote: nil, reauthorizeRequired: false,
      disconnecting: false, betaBlocked: false, createdAt: timestamp, updatedAt: timestamp,
      redactionStatus: "private-state-excluded")
    do { return try saveConnection(context: context, connection: connection) } catch {
      _ = try? secrets.delete(accessRef.id)
      _ = try? secrets.delete(refreshRef.id)
      throw error
    }
  }

  @discardableResult public func rotateGoogleChatRelayOwnedOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String?, expiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    googleChatTokenRotationLock.lock()
    defer { googleChatTokenRotationLock.unlock() }
    guard
      var connection = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      connection.appSlug == "google-chat", connection.credentialOwnership == .relayOwned,
      connection.grantedScopes == Self.googleChatRelayOwnedOAuthScopes
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "A Relay-owned exact-scope Google Chat user OAuth connection is required.")
    }
    let access = try requireNonEmptyString(
      accessToken, field: "Google Chat OAuth access token", maxLength: 30000)
    let oldAccess = connection.credentialRequirements.first {
      $0.fieldKey == "google_chat_oauth_access_token"
    }?.secretReferenceId
    let oldRefresh = connection.credentialRequirements.first {
      $0.fieldKey == "google_chat_oauth_refresh_token"
    }?.secretReferenceId
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: connection.id, label: "Google Chat OAuth access token",
      secretValue: access)
    let refreshRef: SecretReference?
    do {
      refreshRef = try refreshToken?.providerConnectionNilIfEmpty.map {
        try secrets.set(
          scope: "provider_connection", scopeId: connection.id,
          label: "Google Chat OAuth refresh token", secretValue: $0)
      }
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    connection.credentialRequirements = connection.credentialRequirements.map { value in
      var copy = value
      if copy.fieldKey == "google_chat_oauth_access_token" { copy.secretReferenceId = accessRef.id }
      if copy.fieldKey == "google_chat_oauth_refresh_token", let refreshRef {
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

  @discardableResult public func saveGoogleAdsRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    developerToken: String, accountEmail: String, customerId: String, loginCustomerId: String?,
    grantedScopes: [String], accessLevel: String, expiresAt: String?, displayName: String? = nil,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "google-ads")
    let email = accountEmail.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
    let login = loginCustomerId?.providerConnectionNilIfEmpty
    guard app.slug == "google-ads", email.count <= 320, email.contains("@"),
      !email.contains(where: { $0.isWhitespace }), Self.isGoogleAdsCustomerId(customerId),
      login.map(Self.isGoogleAdsCustomerId) ?? true,
      grantedScopes == Self.googleAdsRelayOwnedOAuthScopes,
      ["test", "explorer", "basic", "standard"].contains(accessLevel.lowercased())
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "Relay-owned Google Ads OAuth requires exact adwords scope, safe ten-digit customer IDs, and a recognized access level."
      )
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "Google Ads OAuth access token", maxLength: 30000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "Google Ads OAuth refresh token", maxLength: 30000)
    let developer = try requireNonEmptyString(
      developerToken, field: "Google Ads developer token", maxLength: 128)
    guard developer.allSatisfy({ $0.isLetter || $0.isNumber || $0 == "-" || $0 == "_" }) else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Google Ads developer token has an unsafe format.")
    }
    let id = createRelayId("mpc")
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Google Ads OAuth access token",
      secretValue: access)
    let refreshRef: SecretReference
    do {
      refreshRef = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Google Ads OAuth refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    let developerRef: SecretReference
    do {
      developerRef = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Google Ads developer token",
        secretValue: developer)
    } catch {
      _ = try? secrets.delete(accessRef.id)
      _ = try? secrets.delete(refreshRef.id)
      throw error
    }
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "google_ads_oauth_access_token", label: "Google Ads OAuth access token",
        required: true, userOwnedRequired: false, secretReferenceId: accessRef.id,
        status: .verified,
        helpText: "Short-lived user token stored as a Keychain reference and replaced by Railway.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "google_ads_oauth_refresh_token", label: "Google Ads OAuth refresh token",
        required: true, userOwnedRequired: false, secretReferenceId: refreshRef.id,
        status: .verified,
        helpText:
          "Offline refresh token stored separately; only Railway uses the OAuth client secret.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "google_ads_developer_token", label: "Google Ads developer token", required: true,
        userOwnedRequired: false, secretReferenceId: developerRef.id, status: .verified,
        helpText: "Relay-held developer token approved by Google for reporting permissible use.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "google_ads_customer", label: "Authorized Google Ads customer", required: true,
        userOwnedRequired: false, secretReferenceId: nil, status: .verified,
        helpText:
          "Explicit advertiser customer ID; manager login customer ID is optional metadata.",
        redactionStatus: "private-state-excluded"),
    ]
    let diagnostics: [String: JSONValue] = [
      "provider": .string("google-ads"),
      "authMethod": .string("google_oauth_confidential_web_server_offline_user_auth"),
      "apiOrigin": .string("https://googleads.googleapis.com/v24"),
      "tokenOrigin": .string("https://oauth2.googleapis.com/token"), "accountEmail": .string(email),
      "customerId": .string(customerId), "loginCustomerId": login.map(JSONValue.string) ?? .null,
      "accessLevel": .string(accessLevel.lowercased()), "permissibleUse": .string("reporting"),
      "accessExpiresAt": expiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
      "exactScopes": .array(Self.googleAdsRelayOwnedOAuthScopes.map(JSONValue.string)),
      "explicitCustomerOnly": .bool(true), "arbitraryGAQLEnabled": .bool(false),
      "searchStreamEnabled": .bool(false), "accountDiscoveryEnabled": .bool(false),
      "mutationsEnabled": .bool(false), "planningRecommendationsEnabled": .bool(false),
      "audiencesCustomerMatchEnabled": .bool(false), "searchTermsClickDataEnabled": .bool(false),
      "offlineConversionsEnabled": .bool(false), "billingAccessEnabled": .bool(false),
      "automaticPagination": .bool(false), "serviceAccountEnabled": .bool(false),
      "domainDelegationEnabled": .bool(false),
      "clientSecretLocation": .string("secure-railway-broker-only"),
      "rawTokenStoredInDatabase": .bool(false),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "google-ads-relay-owned-google-oauth:" + customerId, providerName: "Google Ads",
      status: .connected, authorizationState: .completed, credentialOwnership: .relayOwned,
      userOwnedCredentialsRequired: false, credentialRequirements: requirements,
      secretReferenceIds: [accessRef.id, refreshRef.id, developerRef.id],
      accountLabel: displayName?.providerConnectionNilIfEmpty ?? "Google Ads customer "
        + customerId,
      connectedHandle: customerId, callbackURL: nil,
      requiredScopes: Self.googleAdsRelayOwnedOAuthScopes,
      grantedScopes: Self.googleAdsRelayOwnedOAuthScopes, selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message:
          "Relay-owned Google Ads reporting credentials are ready for fixed explicit-customer reports.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [], diagnostics: diagnostics,
        redactionStatus: "private-state-excluded"), senderIdentities: [],
      installPolicy: "bounded_reporting_only_explicit_customer", lastCheckedAt: timestamp,
      lastError: nil, manualEvidenceNote: nil, reauthorizeRequired: false, disconnecting: false,
      betaBlocked: false, createdAt: timestamp, updatedAt: timestamp,
      redactionStatus: "private-state-excluded")
    do { return try saveConnection(context: context, connection: connection) } catch {
      _ = try? secrets.delete(accessRef.id)
      _ = try? secrets.delete(refreshRef.id)
      _ = try? secrets.delete(developerRef.id)
      throw error
    }
  }

  @discardableResult public func rotateGoogleAdsRelayOwnedOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String?, expiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    googleAdsTokenRotationLock.lock()
    defer { googleAdsTokenRotationLock.unlock() }
    guard
      var connection = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      connection.appSlug == "google-ads", connection.credentialOwnership == .relayOwned,
      connection.grantedScopes == Self.googleAdsRelayOwnedOAuthScopes,
      connection.health.diagnostics["permissibleUse"]?.string == "reporting"
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "A Relay-owned reporting-only Google Ads OAuth connection is required.")
    }
    let access = try requireNonEmptyString(
      accessToken, field: "Google Ads OAuth access token", maxLength: 30000)
    let oldAccess = connection.credentialRequirements.first {
      $0.fieldKey == "google_ads_oauth_access_token"
    }?.secretReferenceId
    let oldRefresh = connection.credentialRequirements.first {
      $0.fieldKey == "google_ads_oauth_refresh_token"
    }?.secretReferenceId
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: connection.id, label: "Google Ads OAuth access token",
      secretValue: access)
    let refreshRef: SecretReference?
    do {
      refreshRef = try refreshToken?.providerConnectionNilIfEmpty.map {
        try secrets.set(
          scope: "provider_connection", scopeId: connection.id,
          label: "Google Ads OAuth refresh token", secretValue: $0)
      }
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    connection.credentialRequirements = connection.credentialRequirements.map { value in
      var copy = value
      if copy.fieldKey == "google_ads_oauth_access_token" { copy.secretReferenceId = accessRef.id }
      if copy.fieldKey == "google_ads_oauth_refresh_token", let refreshRef {
        copy.secretReferenceId = refreshRef.id
      }
      return copy
    }
    let developerRef = connection.credentialRequirements.first {
      $0.fieldKey == "google_ads_developer_token"
    }?.secretReferenceId
    connection.secretReferenceIds = [accessRef.id, refreshRef?.id ?? oldRefresh, developerRef]
      .compactMap { $0 }
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

  @discardableResult public func saveGoogleMerchantCenterRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    accountEmail: String, selectedAccountName: String, selectedAccountDisplayName: String?,
    grantedScopes: [String], expiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "google-merchant-center")
    let email = accountEmail.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
    let account = selectedAccountName.trimmingCharacters(in: .whitespacesAndNewlines)
    guard app.slug == "google-merchant-center", email.count <= 320, email.contains("@"),
      !email.contains(where: { $0.isWhitespace }), Self.isSafeMerchantCenterAccountName(account),
      grantedScopes == Self.googleMerchantCenterRelayOwnedOAuthScopes
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "Relay-owned Merchant Center OAuth requires exact content scope, a safe email, and an explicit accounts/{id} resource."
      )
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "Merchant Center OAuth access token", maxLength: 30000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "Merchant Center OAuth refresh token", maxLength: 30000)
    let id = createRelayId("mpc")
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Merchant Center OAuth access token",
      secretValue: access)
    let refreshRef: SecretReference
    do {
      refreshRef = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Merchant Center OAuth refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "google_merchant_center_oauth_access_token",
        label: "Merchant Center OAuth access token", required: true, userOwnedRequired: false,
        secretReferenceId: accessRef.id, status: .verified,
        helpText: "Short-lived access token replaced by Railway.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "google_merchant_center_oauth_refresh_token",
        label: "Merchant Center OAuth refresh token", required: true, userOwnedRequired: false,
        secretReferenceId: refreshRef.id, status: .verified,
        helpText: "Offline refresh token stored separately; only Railway uses the client secret.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "google_merchant_center_account", label: "Selected Merchant Center account",
        required: true, userOwnedRequired: false, secretReferenceId: nil, status: .verified,
        helpText: "Explicit accounts/{id} binding selected during Railway OAuth.",
        redactionStatus: "private-state-excluded"),
    ]
    let diagnostics: [String: JSONValue] = [
      "provider": .string("google-merchant-center"),
      "apiOrigin": .string("https://merchantapi.googleapis.com"), "apiVersion": .string("v1"),
      "tokenOrigin": .string("https://oauth2.googleapis.com/token"), "accountEmail": .string(email),
      "selectedAccountName": .string(account),
      "selectedAccountDisplayName": selectedAccountDisplayName?.providerConnectionNilIfEmpty.map(
        JSONValue.string)
        ?? .null,
      "accessExpiresAt": expiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
      "exactScopes": .array(Self.googleMerchantCenterRelayOwnedOAuthScopes.map(JSONValue.string)),
      "readOnlyV1": .bool(true), "providerScopeCanWrite": .bool(true),
      "writesEnabled": .bool(false), "fixedReportsOnly": .bool(true), "maxRows": .number(50),
      "automaticPagination": .bool(false), "serviceAccountEnabled": .bool(false),
      "v1BetaEnabled": .bool(false), "contentAPIEnabled": .bool(false),
      "rawToolsEnabled": .bool(false),
      "clientSecretLocation": .string("secure-railway-broker-only"),
      "rawTokenStoredInDatabase": .bool(false),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "google-merchant-center-relay-owned-google-oauth:" + account,
      providerName: "Google Merchant Center", status: .connected, authorizationState: .completed,
      credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
      credentialRequirements: requirements, secretReferenceIds: [accessRef.id, refreshRef.id],
      accountLabel: selectedAccountDisplayName?.providerConnectionNilIfEmpty ?? account,
      connectedHandle: email,
      callbackURL: nil, requiredScopes: Self.googleMerchantCenterRelayOwnedOAuthScopes,
      grantedScopes: Self.googleMerchantCenterRelayOwnedOAuthScopes,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message:
          "Relay-owned Merchant Center OAuth is ready for bounded read-only stable-v1 tools on the selected account.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [], diagnostics: diagnostics,
        redactionStatus: "private-state-excluded"), senderIdentities: [],
      installPolicy: "read_only_selected_merchant_account_fixed_reports", lastCheckedAt: timestamp,
      lastError: nil, manualEvidenceNote: nil, reauthorizeRequired: false, disconnecting: false,
      betaBlocked: false, createdAt: timestamp, updatedAt: timestamp,
      redactionStatus: "private-state-excluded")
    do { return try saveConnection(context: context, connection: connection) } catch {
      _ = try? secrets.delete(accessRef.id)
      _ = try? secrets.delete(refreshRef.id)
      throw error
    }
  }

  @discardableResult public func rotateGoogleMerchantCenterRelayOwnedOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String?, expiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    googleMerchantCenterTokenRotationLock.lock()
    defer { googleMerchantCenterTokenRotationLock.unlock() }
    guard
      var connection = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      connection.appSlug == "google-merchant-center", connection.credentialOwnership == .relayOwned,
      connection.grantedScopes == Self.googleMerchantCenterRelayOwnedOAuthScopes,
      connection.health.diagnostics["readOnlyV1"]?.bool == true
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "A Relay-owned exact-scope read-only Merchant Center connection is required.")
    }
    let access = try requireNonEmptyString(
      accessToken, field: "Merchant Center OAuth access token", maxLength: 30000)
    let oldAccess = connection.credentialRequirements.first {
      $0.fieldKey == "google_merchant_center_oauth_access_token"
    }?.secretReferenceId
    let oldRefresh = connection.credentialRequirements.first {
      $0.fieldKey == "google_merchant_center_oauth_refresh_token"
    }?.secretReferenceId
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: connection.id,
      label: "Merchant Center OAuth access token", secretValue: access)
    let refreshRef: SecretReference?
    do {
      refreshRef = try refreshToken?.providerConnectionNilIfEmpty.map {
        try secrets.set(
          scope: "provider_connection", scopeId: connection.id,
          label: "Merchant Center OAuth refresh token", secretValue: $0)
      }
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    connection.credentialRequirements = connection.credentialRequirements.map { value in
      var copy = value
      if copy.fieldKey == "google_merchant_center_oauth_access_token" {
        copy.secretReferenceId = accessRef.id
      }
      if copy.fieldKey == "google_merchant_center_oauth_refresh_token", let refreshRef {
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

  @discardableResult public func saveYouTubeRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    accountEmail: String, channelId: String, channelTitle: String?, grantedScopes: [String],
    expiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "youtube")
    let email = accountEmail.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
    let channel = channelId.trimmingCharacters(in: .whitespacesAndNewlines)
    guard app.slug == "youtube", email.count <= 320, email.contains("@"),
      !email.contains(where: { $0.isWhitespace }), Self.isSafeYouTubeResourceId(channel),
      grantedScopes == Self.youTubeRelayOwnedOAuthScopes
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "Relay-owned YouTube OAuth requires exact youtube.readonly scope, a safe account, and an explicit connected channel ID."
      )
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "YouTube OAuth access token", maxLength: 30000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "YouTube OAuth refresh token", maxLength: 30000)
    let id = createRelayId("mpc")
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "YouTube OAuth access token",
      secretValue: access)
    let refreshRef: SecretReference
    do {
      refreshRef = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "YouTube OAuth refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "youtube_oauth_access_token", label: "YouTube OAuth access token", required: true,
        userOwnedRequired: false, secretReferenceId: accessRef.id, status: .verified,
        helpText: "Short-lived token stored as a secret reference and replaced by Railway.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "youtube_oauth_refresh_token", label: "YouTube OAuth refresh token",
        required: true, userOwnedRequired: false, secretReferenceId: refreshRef.id,
        status: .verified,
        helpText:
          "Offline refresh token stored separately; only Railway uses the Google client secret.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "youtube_channel", label: "Connected YouTube channel", required: true,
        userOwnedRequired: false, secretReferenceId: nil, status: .verified,
        helpText: "Explicit channel returned by channels.list(mine=true).",
        redactionStatus: "private-state-excluded"),
    ]
    let diagnostics: [String: JSONValue] = [
      "provider": .string("youtube"), "apiOrigin": .string("https://www.googleapis.com/youtube/v3"),
      "tokenOrigin": .string("https://oauth2.googleapis.com/token"), "accountEmail": .string(email),
      "channelId": .string(channel),
      "channelTitle": channelTitle?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
      "accessExpiresAt": expiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
      "exactScopes": .array(Self.youTubeRelayOwnedOAuthScopes.map(JSONValue.string)),
      "readOnlyV1": .bool(true), "writesEnabled": .bool(false), "searchEnabled": .bool(false),
      "historyEnabled": .bool(false), "automaticPagination": .bool(false),
      "analyticsEnabled": .bool(false), "partnerEnabled": .bool(false),
      "serviceAccountEnabled": .bool(false), "rawToolsEnabled": .bool(false),
      "maxResults": .number(25), "clientSecretLocation": .string("secure-railway-broker-only"),
      "rawTokenStoredInDatabase": .bool(false),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "youtube-relay-owned-google-oauth:" + channel, providerName: "YouTube",
      status: .connected, authorizationState: .completed, credentialOwnership: .relayOwned,
      userOwnedCredentialsRequired: false, credentialRequirements: requirements,
      secretReferenceIds: [accessRef.id, refreshRef.id],
      accountLabel: channelTitle?.providerConnectionNilIfEmpty ?? "YouTube channel "
        + String(channel.suffix(6)),
      connectedHandle: email, callbackURL: nil, requiredScopes: Self.youTubeRelayOwnedOAuthScopes,
      grantedScopes: Self.youTubeRelayOwnedOAuthScopes, selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message:
          "Relay-owned YouTube OAuth is ready for four bounded read-only channel and video tools.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [], diagnostics: diagnostics,
        redactionStatus: "private-state-excluded"), senderIdentities: [],
      installPolicy: "read_only_connected_channel_bounded_v1", lastCheckedAt: timestamp,
      lastError: nil, manualEvidenceNote: nil, reauthorizeRequired: false, disconnecting: false,
      betaBlocked: false, createdAt: timestamp, updatedAt: timestamp,
      redactionStatus: "private-state-excluded")
    do { return try saveConnection(context: context, connection: connection) } catch {
      _ = try? secrets.delete(accessRef.id)
      _ = try? secrets.delete(refreshRef.id)
      throw error
    }
  }

  @discardableResult public func rotateYouTubeRelayOwnedOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String?, expiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    youTubeTokenRotationLock.lock()
    defer { youTubeTokenRotationLock.unlock() }
    guard
      var connection = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      connection.appSlug == "youtube", connection.credentialOwnership == .relayOwned,
      connection.grantedScopes == Self.youTubeRelayOwnedOAuthScopes,
      connection.health.diagnostics["readOnlyV1"]?.bool == true
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "A Relay-owned exact-scope read-only YouTube connection is required.")
    }
    let access = try requireNonEmptyString(
      accessToken, field: "YouTube OAuth access token", maxLength: 30000)
    let oldAccess = connection.credentialRequirements.first {
      $0.fieldKey == "youtube_oauth_access_token"
    }?.secretReferenceId
    let oldRefresh = connection.credentialRequirements.first {
      $0.fieldKey == "youtube_oauth_refresh_token"
    }?.secretReferenceId
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: connection.id, label: "YouTube OAuth access token",
      secretValue: access)
    let refreshRef: SecretReference?
    do {
      refreshRef = try refreshToken?.providerConnectionNilIfEmpty.map {
        try secrets.set(
          scope: "provider_connection", scopeId: connection.id,
          label: "YouTube OAuth refresh token", secretValue: $0)
      }
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    connection.credentialRequirements = connection.credentialRequirements.map { value in
      var copy = value
      if copy.fieldKey == "youtube_oauth_access_token" { copy.secretReferenceId = accessRef.id }
      if copy.fieldKey == "youtube_oauth_refresh_token", let refreshRef {
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

  @discardableResult public func saveGoogleClassroomRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    accountEmail: String, accountLabel: String?, grantedScopes: [String], expiresAt: String?,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "google-classroom")
    let email = accountEmail.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
    guard app.slug == "google-classroom", email.count <= 320, email.contains("@"),
      !email.contains(where: { $0.isWhitespace }),
      grantedScopes == Self.googleClassroomRelayOwnedOAuthScopes
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "Relay-owned Google Classroom OAuth requires the exact three read-only scopes and a safe connected account."
      )
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "Google Classroom OAuth access token", maxLength: 30000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "Google Classroom OAuth refresh token", maxLength: 30000)
    let id = createRelayId("mpc")
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Google Classroom OAuth access token",
      secretValue: access)
    let refreshRef: SecretReference
    do {
      refreshRef = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Google Classroom OAuth refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "google_classroom_oauth_access_token",
        label: "Google Classroom OAuth access token", required: true, userOwnedRequired: false,
        secretReferenceId: accessRef.id, status: .verified,
        helpText: "Short-lived token stored as a secret reference and replaced by Railway.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "google_classroom_oauth_refresh_token",
        label: "Google Classroom OAuth refresh token", required: true, userOwnedRequired: false,
        secretReferenceId: refreshRef.id, status: .verified,
        helpText:
          "Offline refresh token stored separately; only Railway uses the Google client secret.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "google_classroom_account", label: "Connected Classroom account", required: true,
        userOwnedRequired: false, secretReferenceId: nil, status: .verified,
        helpText: "Requesting-user account; no domain-wide delegation or impersonation.",
        redactionStatus: "private-state-excluded"),
    ]
    let diagnostics: [String: JSONValue] = [
      "provider": .string("google-classroom"),
      "apiOrigin": .string("https://classroom.googleapis.com/v1"),
      "tokenOrigin": .string("https://oauth2.googleapis.com/token"), "accountEmail": .string(email),
      "accessExpiresAt": expiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
      "exactScopes": .array(Self.googleClassroomRelayOwnedOAuthScopes.map(JSONValue.string)),
      "requestingUserOnly": .bool(true), "readOnlyV1": .bool(true), "rostersEnabled": .bool(false),
      "studentSubmissionsGradesEnabled": .bool(false), "guardiansInvitationsEnabled": .bool(false),
      "writesEnabled": .bool(false), "domainDelegationEnabled": .bool(false),
      "adminImpersonationEnabled": .bool(false), "previewEnabled": .bool(false),
      "automaticPagination": .bool(false), "rawToolsEnabled": .bool(false),
      "maxResults": .number(25), "clientSecretLocation": .string("secure-railway-broker-only"),
      "rawTokenStoredInDatabase": .bool(false),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "google-classroom-relay-owned-google-oauth:" + email,
      providerName: "Google Classroom", status: .connected, authorizationState: .completed,
      credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
      credentialRequirements: requirements, secretReferenceIds: [accessRef.id, refreshRef.id],
      accountLabel: accountLabel?.providerConnectionNilIfEmpty ?? email, connectedHandle: email,
      callbackURL: nil,
      requiredScopes: Self.googleClassroomRelayOwnedOAuthScopes,
      grantedScopes: Self.googleClassroomRelayOwnedOAuthScopes,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message: "Relay-owned Classroom OAuth is ready for four requesting-user read-only tools.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [], diagnostics: diagnostics,
        redactionStatus: "private-state-excluded"), senderIdentities: [],
      installPolicy: "requesting_user_courses_coursework_materials_read_only",
      lastCheckedAt: timestamp, lastError: nil, manualEvidenceNote: nil, reauthorizeRequired: false,
      disconnecting: false, betaBlocked: false, createdAt: timestamp, updatedAt: timestamp,
      redactionStatus: "private-state-excluded")
    do { return try saveConnection(context: context, connection: connection) } catch {
      _ = try? secrets.delete(accessRef.id)
      _ = try? secrets.delete(refreshRef.id)
      throw error
    }
  }

  @discardableResult public func rotateGoogleClassroomRelayOwnedOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String?, expiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    googleClassroomTokenRotationLock.lock()
    defer { googleClassroomTokenRotationLock.unlock() }
    guard
      var connection = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      connection.appSlug == "google-classroom", connection.credentialOwnership == .relayOwned,
      connection.grantedScopes == Self.googleClassroomRelayOwnedOAuthScopes,
      connection.health.diagnostics["requestingUserOnly"]?.bool == true
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "An exact-scope requesting-user Classroom OAuth connection is required.")
    }
    let access = try requireNonEmptyString(
      accessToken, field: "Google Classroom OAuth access token", maxLength: 30000)
    let oldAccess = connection.credentialRequirements.first {
      $0.fieldKey == "google_classroom_oauth_access_token"
    }?.secretReferenceId
    let oldRefresh = connection.credentialRequirements.first {
      $0.fieldKey == "google_classroom_oauth_refresh_token"
    }?.secretReferenceId
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: connection.id,
      label: "Google Classroom OAuth access token", secretValue: access)
    let refreshRef: SecretReference?
    do {
      refreshRef = try refreshToken?.providerConnectionNilIfEmpty.map {
        try secrets.set(
          scope: "provider_connection", scopeId: connection.id,
          label: "Google Classroom OAuth refresh token", secretValue: $0)
      }
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    connection.credentialRequirements = connection.credentialRequirements.map { value in
      var copy = value
      if copy.fieldKey == "google_classroom_oauth_access_token" {
        copy.secretReferenceId = accessRef.id
      }
      if copy.fieldKey == "google_classroom_oauth_refresh_token", let refreshRef {
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
