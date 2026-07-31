import Foundation

extension ProviderConnectionService {
  @discardableResult public func saveGoogleCalendarRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    accountEmail: String, defaultCalendarId: String, grantedScopes: [String], expiresAt: String?,
    displayName: String? = nil, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "google-calendar")
    let email = accountEmail.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
    let calendar = defaultCalendarId.trimmingCharacters(in: .whitespacesAndNewlines)
    guard app.slug == "google-calendar", email.count <= 320, email.contains("@"),
      !email.contains(where: { $0.isWhitespace }), !calendar.isEmpty, calendar.count <= 320,
      grantedScopes == Self.googleCalendarRelayOwnedOAuthScopes
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "Relay-owned Google Calendar OAuth requires exact scopes plus safe account and default Calendar metadata."
      )
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "Google Calendar OAuth access token", maxLength: 30000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "Google Calendar OAuth refresh token", maxLength: 30000)
    let id = createRelayId("mpc")
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let a = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Google Calendar OAuth access token",
      secretValue: access)
    let r: SecretReference
    do {
      r = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Google Calendar OAuth refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(a.id)
      throw error
    }
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "google_calendar_oauth_access_token", label: "Google Calendar OAuth access token",
        required: true, userOwnedRequired: false, secretReferenceId: a.id, status: .verified,
        helpText:
          "Short-lived access token stored only as a Keychain reference and replaced by the Railway broker.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "google_calendar_oauth_refresh_token",
        label: "Google Calendar OAuth refresh token", required: true, userOwnedRequired: false,
        secretReferenceId: r.id, status: .verified,
        helpText:
          "Offline refresh token stored separately; only Railway uses the Relay client secret.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "google_calendar_account", label: "Google Calendar account and default Calendar",
        required: true, userOwnedRequired: false, secretReferenceId: nil, status: .verified,
        helpText: "Exact authorized account and default Calendar ID.",
        redactionStatus: "private-state-excluded"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "google-calendar-relay-owned-google-oauth:" + email,
      providerName: "Google Calendar", status: .connected, authorizationState: .completed,
      credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
      credentialRequirements: requirements, secretReferenceIds: [a.id, r.id],
      accountLabel: displayName?.providerConnectionNilIfEmpty ?? email, connectedHandle: email,
      callbackURL: nil,
      requiredScopes: Self.googleCalendarRelayOwnedOAuthScopes,
      grantedScopes: Self.googleCalendarRelayOwnedOAuthScopes,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message: "Relay-owned Google Calendar OAuth is ready for brokered Calendar actions.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("google-calendar"),
          "authMethod": .string("google_oauth_confidential_web_server_offline"),
          "apiOrigin": .string(GoogleCalendarProviderActionSupport.apiOrigin),
          "tokenOrigin": .string("https://oauth2.googleapis.com/token"),
          "accountEmail": .string(email), "defaultCalendarId": .string(calendar),
          "accessExpiresAt": expiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
          "exactScopes": .array(Self.googleCalendarRelayOwnedOAuthScopes.map(JSONValue.string)),
          "redundantReadonlyScopeRequested": .bool(false), "automaticPagination": .bool(false),
          "clientSecretLocation": .string("secure-railway-broker-only"),
          "rawTokenStoredInDatabase": .bool(false),
        ], redactionStatus: "private-state-excluded"),
      senderIdentities: [
        ProviderSenderIdentity(
          id: "google-calendar:" + email, email: email, validationStatus: .verified, agentId: nil,
          installId: nil, lastCheckedAt: timestamp, errorMessage: nil,
          redactionStatus: "private-state-excluded")
      ], installPolicy: "approval_gated_calendar_actions_with_direct_write_option",
      lastCheckedAt: timestamp, lastError: nil, manualEvidenceNote: nil, reauthorizeRequired: false,
      disconnecting: false, betaBlocked: false, createdAt: timestamp, updatedAt: timestamp,
      redactionStatus: "private-state-excluded")
    do { return try saveConnection(context: context, connection: connection) } catch {
      _ = try? secrets.delete(a.id)
      _ = try? secrets.delete(r.id)
      throw error
    }
  }

  @discardableResult public func rotateGoogleCalendarRelayOwnedOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String?, expiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    googleCalendarTokenRotationLock.lock()
    defer { googleCalendarTokenRotationLock.unlock() }
    guard
      var connection = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      connection.appSlug == "google-calendar", connection.credentialOwnership == .relayOwned
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "A Relay-owned Google Calendar OAuth connection is required.")
    }
    let access = try requireNonEmptyString(
      accessToken, field: "Google Calendar OAuth access token", maxLength: 30000)
    let oldAccess = connection.credentialRequirements.first(where: {
      $0.fieldKey == "google_calendar_oauth_access_token"
    })?.secretReferenceId
    let oldRefresh = connection.credentialRequirements.first(where: {
      $0.fieldKey == "google_calendar_oauth_refresh_token"
    })?.secretReferenceId
    let a = try secrets.set(
      scope: "provider_connection", scopeId: connection.id,
      label: "Google Calendar OAuth access token", secretValue: access)
    let newRefresh = refreshToken?.providerConnectionNilIfEmpty
    let r: SecretReference?
    do {
      r = try newRefresh.map {
        try secrets.set(
          scope: "provider_connection", scopeId: connection.id,
          label: "Google Calendar OAuth refresh token", secretValue: $0)
      }
    } catch {
      _ = try? secrets.delete(a.id)
      throw error
    }
    connection.credentialRequirements = connection.credentialRequirements.map { value in
      var copy = value
      if copy.fieldKey == "google_calendar_oauth_access_token" { copy.secretReferenceId = a.id }
      if copy.fieldKey == "google_calendar_oauth_refresh_token", let r {
        copy.secretReferenceId = r.id
      }
      return copy
    }
    connection.secretReferenceIds = [a.id, r?.id ?? oldRefresh].compactMap { $0 }
    connection.updatedAt = ISO8601DateFormatter.relayConsole.string(from: now)
    connection.health.diagnostics["accessExpiresAt"] =
      expiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null
    do {
      let saved = try saveConnection(context: context, connection: connection)
      if let oldAccess { _ = try? secrets.delete(oldAccess) }
      if r != nil, let oldRefresh { _ = try? secrets.delete(oldRefresh) }
      return saved
    } catch {
      _ = try? secrets.delete(a.id)
      if let r { _ = try? secrets.delete(r.id) }
      throw error
    }
  }

  @discardableResult public func saveGoogleDriveRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String,
    refreshToken: String, accountEmail: String, grantedScopes: [String], expiresAt: String?,
    displayName: String? = nil, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "google-drive")
    let email = accountEmail.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
    guard app.slug == "google-drive", email.count <= 320, email.contains("@"),
      !email.contains(where: { $0.isWhitespace }),
      grantedScopes == Self.googleDriveRelayOwnedOAuthScopes
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "Relay-owned Google Drive OAuth requires exact drive.file scope and a safe account.")
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "Google Drive OAuth access token", maxLength: 30000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "Google Drive OAuth refresh token", maxLength: 30000)
    let id = createRelayId("mpc")
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Google Drive OAuth access token",
      secretValue: access)
    let refreshRef: SecretReference
    do {
      refreshRef = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Google Drive OAuth refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "google_drive_oauth_access_token", label: "Google Drive OAuth access token",
        required: true, userOwnedRequired: false, secretReferenceId: accessRef.id,
        status: .verified,
        helpText:
          "Short-lived access token stored as a Keychain reference and replaced by Railway.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "google_drive_oauth_refresh_token", label: "Google Drive OAuth refresh token",
        required: true, userOwnedRequired: false, secretReferenceId: refreshRef.id,
        status: .verified,
        helpText: "Offline refresh token stored separately; only Railway uses the client secret.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "google_drive_account", label: "Google Drive account and app-visible corpus",
        required: true, userOwnedRequired: false, secretReferenceId: nil, status: .verified,
        helpText: "Authorized account; drive.file is limited to Relay-created or selected files.",
        redactionStatus: "private-state-excluded"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "google-drive-relay-owned-google-oauth:" + email,
      providerName: "Google Drive", status: .connected, authorizationState: .completed,
      credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
      credentialRequirements: requirements,
      secretReferenceIds: [accessRef.id, refreshRef.id],
      accountLabel: displayName?.providerConnectionNilIfEmpty ?? email, connectedHandle: email,
      callbackURL: nil,
      requiredScopes: Self.googleDriveRelayOwnedOAuthScopes,
      grantedScopes: Self.googleDriveRelayOwnedOAuthScopes, selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message: "Relay-owned Google Drive OAuth is ready for the app-visible drive.file corpus.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("google-drive"),
          "authMethod": .string("google_oauth_confidential_web_server_offline"),
          "apiOrigin": .string("https://www.googleapis.com/drive/v3"),
          "uploadOrigin": .string("https://www.googleapis.com/upload/drive/v3"),
          "tokenOrigin": .string("https://oauth2.googleapis.com/token"),
          "accountEmail": .string(email),
          "accessExpiresAt": expiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
          "exactScopes": .array(Self.googleDriveRelayOwnedOAuthScopes.map(JSONValue.string)),
          "appVisibleFileCorpusEnforced": .bool(true),
          "wholeDriveDiscovery": .bool(false), "automaticPagination": .bool(false),
          "clientSecretLocation": .string("secure-railway-broker-only"),
          "rawTokenStoredInDatabase": .bool(false),
        ], redactionStatus: "private-state-excluded"),
      senderIdentities: [
        ProviderSenderIdentity(
          id: "google-drive:" + email, email: email, validationStatus: .verified, agentId: nil,
          installId: nil, lastCheckedAt: timestamp, errorMessage: nil,
          redactionStatus: "private-state-excluded")
      ], installPolicy: "approval_gated_drive_file_actions_with_direct_write_option",
      lastCheckedAt: timestamp, lastError: nil, manualEvidenceNote: nil,
      reauthorizeRequired: false, disconnecting: false, betaBlocked: false,
      createdAt: timestamp, updatedAt: timestamp, redactionStatus: "private-state-excluded")
    do { return try saveConnection(context: context, connection: connection) } catch {
      _ = try? secrets.delete(accessRef.id)
      _ = try? secrets.delete(refreshRef.id)
      throw error
    }
  }

  @discardableResult public func rotateGoogleDriveRelayOwnedOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String?, expiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    googleDriveTokenRotationLock.lock()
    defer { googleDriveTokenRotationLock.unlock() }
    guard
      var connection = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      connection.appSlug == "google-drive", connection.credentialOwnership == .relayOwned
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "A Relay-owned Google Drive OAuth connection is required.")
    }
    let access = try requireNonEmptyString(
      accessToken, field: "Google Drive OAuth access token", maxLength: 30000)
    let oldAccess = connection.credentialRequirements.first {
      $0.fieldKey == "google_drive_oauth_access_token"
    }?.secretReferenceId
    let oldRefresh = connection.credentialRequirements.first {
      $0.fieldKey == "google_drive_oauth_refresh_token"
    }?.secretReferenceId
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: connection.id,
      label: "Google Drive OAuth access token", secretValue: access)
    let replacement = refreshToken?.providerConnectionNilIfEmpty
    let refreshRef: SecretReference?
    do {
      refreshRef = try replacement.map {
        try secrets.set(
          scope: "provider_connection", scopeId: connection.id,
          label: "Google Drive OAuth refresh token", secretValue: $0)
      }
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    connection.credentialRequirements = connection.credentialRequirements.map { value in
      var copy = value
      if copy.fieldKey == "google_drive_oauth_access_token" {
        copy.secretReferenceId = accessRef.id
      }
      if copy.fieldKey == "google_drive_oauth_refresh_token", let refreshRef {
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

  @discardableResult public func saveGoogleSheetsRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String,
    refreshToken: String, accountEmail: String, grantedScopes: [String], expiresAt: String?,
    displayName: String? = nil, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "google-sheets")
    let email = accountEmail.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
    guard app.slug == "google-sheets", email.count <= 320, email.contains("@"),
      !email.contains(where: { $0.isWhitespace }),
      grantedScopes == Self.googleSheetsRelayOwnedOAuthScopes
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "Relay-owned Google Sheets OAuth requires exact drive.file scope and a safe account.")
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "Google Sheets OAuth access token", maxLength: 30000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "Google Sheets OAuth refresh token", maxLength: 30000)
    let id = createRelayId("mpc")
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Google Sheets OAuth access token",
      secretValue: access)
    let refreshRef: SecretReference
    do {
      refreshRef = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Google Sheets OAuth refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "google_sheets_oauth_access_token", label: "Google Sheets OAuth access token",
        required: true, userOwnedRequired: false, secretReferenceId: accessRef.id,
        status: .verified,
        helpText:
          "Short-lived access token stored as a Keychain reference and replaced by Railway.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "google_sheets_oauth_refresh_token", label: "Google Sheets OAuth refresh token",
        required: true, userOwnedRequired: false, secretReferenceId: refreshRef.id,
        status: .verified,
        helpText: "Offline refresh token stored separately; only Railway uses the client secret.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "google_sheets_account", label: "Google Sheets account and app-visible corpus",
        required: true, userOwnedRequired: false, secretReferenceId: nil, status: .verified,
        helpText:
          "Authorized account; drive.file is limited to Relay-created or explicitly selected/opened spreadsheets.",
        redactionStatus: "private-state-excluded"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "google-sheets-relay-owned-google-oauth:" + email,
      providerName: "Google Sheets", status: .connected, authorizationState: .completed,
      credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
      credentialRequirements: requirements, secretReferenceIds: [accessRef.id, refreshRef.id],
      accountLabel: displayName?.providerConnectionNilIfEmpty ?? email, connectedHandle: email,
      callbackURL: nil,
      requiredScopes: Self.googleSheetsRelayOwnedOAuthScopes,
      grantedScopes: Self.googleSheetsRelayOwnedOAuthScopes, selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message:
          "Relay-owned Google Sheets OAuth is ready for the app-visible drive.file spreadsheet corpus.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("google-sheets"),
          "authMethod": .string("google_oauth_confidential_web_server_offline"),
          "apiOrigin": .string("https://sheets.googleapis.com/v4"),
          "tokenOrigin": .string("https://oauth2.googleapis.com/token"),
          "accountEmail": .string(email),
          "accessExpiresAt": expiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
          "exactScopes": .array(Self.googleSheetsRelayOwnedOAuthScopes.map(JSONValue.string)),
          "appVisibleSpreadsheetCorpusEnforced": .bool(true),
          "wholeDriveDiscovery": .bool(false), "automaticPagination": .bool(false),
          "clientSecretLocation": .string("secure-railway-broker-only"),
          "rawTokenStoredInDatabase": .bool(false),
        ], redactionStatus: "private-state-excluded"),
      senderIdentities: [
        ProviderSenderIdentity(
          id: "google-sheets:" + email, email: email, validationStatus: .verified, agentId: nil,
          installId: nil, lastCheckedAt: timestamp, errorMessage: nil,
          redactionStatus: "private-state-excluded")
      ],
      installPolicy: "approval_gated_explicit_spreadsheet_writes_with_direct_write_option",
      lastCheckedAt: timestamp, lastError: nil, manualEvidenceNote: nil,
      reauthorizeRequired: false, disconnecting: false, betaBlocked: false,
      createdAt: timestamp, updatedAt: timestamp, redactionStatus: "private-state-excluded")
    do { return try saveConnection(context: context, connection: connection) } catch {
      _ = try? secrets.delete(accessRef.id)
      _ = try? secrets.delete(refreshRef.id)
      throw error
    }
  }

  @discardableResult public func rotateGoogleSheetsRelayOwnedOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String?, expiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    googleSheetsTokenRotationLock.lock()
    defer { googleSheetsTokenRotationLock.unlock() }
    guard
      var connection = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      connection.appSlug == "google-sheets", connection.credentialOwnership == .relayOwned,
      connection.grantedScopes == Self.googleSheetsRelayOwnedOAuthScopes
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "A Relay-owned exact-scope Google Sheets OAuth connection is required.")
    }
    let access = try requireNonEmptyString(
      accessToken, field: "Google Sheets OAuth access token", maxLength: 30000)
    let oldAccess = connection.credentialRequirements.first {
      $0.fieldKey == "google_sheets_oauth_access_token"
    }?.secretReferenceId
    let oldRefresh = connection.credentialRequirements.first {
      $0.fieldKey == "google_sheets_oauth_refresh_token"
    }?.secretReferenceId
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: connection.id,
      label: "Google Sheets OAuth access token", secretValue: access)
    let refreshRef: SecretReference?
    do {
      refreshRef = try refreshToken?.providerConnectionNilIfEmpty.map {
        try secrets.set(
          scope: "provider_connection", scopeId: connection.id,
          label: "Google Sheets OAuth refresh token", secretValue: $0)
      }
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    connection.credentialRequirements = connection.credentialRequirements.map { value in
      var copy = value
      if copy.fieldKey == "google_sheets_oauth_access_token" {
        copy.secretReferenceId = accessRef.id
      }
      if copy.fieldKey == "google_sheets_oauth_refresh_token", let refreshRef {
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

  @discardableResult public func saveGoogleSlidesRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String,
    refreshToken: String, accountEmail: String, grantedScopes: [String], expiresAt: String?,
    displayName: String? = nil, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "google-slides")
    let email = accountEmail.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
    guard app.slug == "google-slides", email.count <= 320, email.contains("@"),
      !email.contains(where: { $0.isWhitespace }),
      grantedScopes == Self.googleSlidesRelayOwnedOAuthScopes
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "Relay-owned Google Slides OAuth requires exact drive.file scope and a safe account.")
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "Google Slides OAuth access token", maxLength: 30000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "Google Slides OAuth refresh token", maxLength: 30000)
    let id = createRelayId("mpc")
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Google Slides OAuth access token",
      secretValue: access)
    let refreshRef: SecretReference
    do {
      refreshRef = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Google Slides OAuth refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "google_slides_oauth_access_token", label: "Google Slides OAuth access token",
        required: true, userOwnedRequired: false, secretReferenceId: accessRef.id,
        status: .verified,
        helpText:
          "Short-lived access token stored as a Keychain reference and replaced by Railway.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "google_slides_oauth_refresh_token", label: "Google Slides OAuth refresh token",
        required: true, userOwnedRequired: false, secretReferenceId: refreshRef.id,
        status: .verified,
        helpText: "Offline refresh token stored separately; only Railway uses the client secret.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "google_slides_account", label: "Google Slides account and app-visible corpus",
        required: true, userOwnedRequired: false, secretReferenceId: nil, status: .verified,
        helpText:
          "Authorized account; drive.file is limited to Relay-created or explicitly selected/opened presentations.",
        redactionStatus: "private-state-excluded"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "google-slides-relay-owned-google-oauth:" + email, providerName: "Google Slides",
      status: .connected, authorizationState: .completed, credentialOwnership: .relayOwned,
      userOwnedCredentialsRequired: false, credentialRequirements: requirements,
      secretReferenceIds: [accessRef.id, refreshRef.id],
      accountLabel: displayName?.providerConnectionNilIfEmpty ?? email,
      connectedHandle: email, callbackURL: nil,
      requiredScopes: Self.googleSlidesRelayOwnedOAuthScopes,
      grantedScopes: Self.googleSlidesRelayOwnedOAuthScopes, selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message:
          "Relay-owned Google Slides OAuth is ready for the app-visible drive.file presentation corpus.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("google-slides"),
          "authMethod": .string("google_oauth_confidential_web_server_offline"),
          "apiOrigin": .string("https://slides.googleapis.com/v1"),
          "tokenOrigin": .string("https://oauth2.googleapis.com/token"),
          "accountEmail": .string(email),
          "accessExpiresAt": expiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
          "exactScopes": .array(Self.googleSlidesRelayOwnedOAuthScopes.map(JSONValue.string)),
          "appVisiblePresentationCorpusEnforced": .bool(true), "wholeDriveDiscovery": .bool(false),
          "automaticPagination": .bool(false),
          "clientSecretLocation": .string("secure-railway-broker-only"),
          "rawTokenStoredInDatabase": .bool(false),
        ], redactionStatus: "private-state-excluded"),
      senderIdentities: [
        ProviderSenderIdentity(
          id: "google-slides:" + email, email: email, validationStatus: .verified, agentId: nil,
          installId: nil, lastCheckedAt: timestamp, errorMessage: nil,
          redactionStatus: "private-state-excluded")
      ],
      installPolicy: "approval_gated_explicit_presentation_writes_with_direct_write_option",
      lastCheckedAt: timestamp, lastError: nil, manualEvidenceNote: nil, reauthorizeRequired: false,
      disconnecting: false, betaBlocked: false, createdAt: timestamp, updatedAt: timestamp,
      redactionStatus: "private-state-excluded")
    do { return try saveConnection(context: context, connection: connection) } catch {
      _ = try? secrets.delete(accessRef.id)
      _ = try? secrets.delete(refreshRef.id)
      throw error
    }
  }

  @discardableResult public func rotateGoogleSlidesRelayOwnedOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String?, expiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    googleSlidesTokenRotationLock.lock()
    defer { googleSlidesTokenRotationLock.unlock() }
    guard
      var connection = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      connection.appSlug == "google-slides", connection.credentialOwnership == .relayOwned,
      connection.grantedScopes == Self.googleSlidesRelayOwnedOAuthScopes
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "A Relay-owned exact-scope Google Slides OAuth connection is required.")
    }
    let access = try requireNonEmptyString(
      accessToken, field: "Google Slides OAuth access token", maxLength: 30000)
    let oldAccess = connection.credentialRequirements.first {
      $0.fieldKey == "google_slides_oauth_access_token"
    }?.secretReferenceId
    let oldRefresh = connection.credentialRequirements.first {
      $0.fieldKey == "google_slides_oauth_refresh_token"
    }?.secretReferenceId
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: connection.id,
      label: "Google Slides OAuth access token", secretValue: access)
    let refreshRef: SecretReference?
    do {
      refreshRef = try refreshToken?.providerConnectionNilIfEmpty.map {
        try secrets.set(
          scope: "provider_connection", scopeId: connection.id,
          label: "Google Slides OAuth refresh token", secretValue: $0)
      }
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    connection.credentialRequirements = connection.credentialRequirements.map { value in
      var copy = value
      if copy.fieldKey == "google_slides_oauth_access_token" {
        copy.secretReferenceId = accessRef.id
      }
      if copy.fieldKey == "google_slides_oauth_refresh_token", let refreshRef {
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

  @discardableResult public func saveGoogleFormsRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String,
    refreshToken: String, accountEmail: String, grantedScopes: [String], expiresAt: String?,
    displayName: String? = nil, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "google-forms")
    let email = accountEmail.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
    guard app.slug == "google-forms", email.count <= 320, email.contains("@"),
      !email.contains(where: { $0.isWhitespace }),
      grantedScopes == Self.googleFormsRelayOwnedOAuthScopes
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "Relay-owned Google Forms OAuth requires exact drive.file scope and a safe account.")
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "Google Forms OAuth access token", maxLength: 30000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "Google Forms OAuth refresh token", maxLength: 30000)
    let id = createRelayId("mpc")
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Google Forms OAuth access token",
      secretValue: access)
    let refreshRef: SecretReference
    do {
      refreshRef = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Google Forms OAuth refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "google_forms_oauth_access_token", label: "Google Forms OAuth access token",
        required: true, userOwnedRequired: false, secretReferenceId: accessRef.id,
        status: .verified,
        helpText:
          "Short-lived access token stored as a Keychain reference and replaced by Railway.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "google_forms_oauth_refresh_token", label: "Google Forms OAuth refresh token",
        required: true, userOwnedRequired: false, secretReferenceId: refreshRef.id,
        status: .verified,
        helpText: "Offline refresh token stored separately; only Railway uses the client secret.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "google_forms_account", label: "Google Forms account and app-visible corpus",
        required: true, userOwnedRequired: false, secretReferenceId: nil, status: .verified,
        helpText:
          "Authorized account; drive.file is limited to Relay-created or explicitly selected/opened forms.",
        redactionStatus: "private-state-excluded"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "google-forms-relay-owned-google-oauth:" + email, providerName: "Google Forms",
      status: .connected, authorizationState: .completed, credentialOwnership: .relayOwned,
      userOwnedCredentialsRequired: false, credentialRequirements: requirements,
      secretReferenceIds: [accessRef.id, refreshRef.id],
      accountLabel: displayName?.providerConnectionNilIfEmpty ?? email, connectedHandle: email,
      callbackURL: nil,
      requiredScopes: Self.googleFormsRelayOwnedOAuthScopes,
      grantedScopes: Self.googleFormsRelayOwnedOAuthScopes, selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message:
          "Relay-owned Google Forms OAuth is ready for the app-visible drive.file form corpus.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("google-forms"),
          "authMethod": .string("google_oauth_confidential_web_server_offline"),
          "apiOrigin": .string("https://forms.googleapis.com/v1"),
          "tokenOrigin": .string("https://oauth2.googleapis.com/token"),
          "accountEmail": .string(email),
          "accessExpiresAt": expiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
          "exactScopes": .array(Self.googleFormsRelayOwnedOAuthScopes.map(JSONValue.string)),
          "appVisibleFormCorpusEnforced": .bool(true), "responsesAccessEnabled": .bool(false),
          "wholeDriveDiscovery": .bool(false), "automaticPagination": .bool(false),
          "clientSecretLocation": .string("secure-railway-broker-only"),
          "rawTokenStoredInDatabase": .bool(false),
        ], redactionStatus: "private-state-excluded"),
      senderIdentities: [
        ProviderSenderIdentity(
          id: "google-forms:" + email, email: email, validationStatus: .verified, agentId: nil,
          installId: nil, lastCheckedAt: timestamp, errorMessage: nil,
          redactionStatus: "private-state-excluded")
      ], installPolicy: "approval_gated_unpublished_form_structure_with_responses_blocked",
      lastCheckedAt: timestamp, lastError: nil, manualEvidenceNote: nil, reauthorizeRequired: false,
      disconnecting: false, betaBlocked: false, createdAt: timestamp, updatedAt: timestamp,
      redactionStatus: "private-state-excluded")
    do { return try saveConnection(context: context, connection: connection) } catch {
      _ = try? secrets.delete(accessRef.id)
      _ = try? secrets.delete(refreshRef.id)
      throw error
    }
  }

  @discardableResult public func rotateGoogleFormsRelayOwnedOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String?, expiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    googleFormsTokenRotationLock.lock()
    defer { googleFormsTokenRotationLock.unlock() }
    guard
      var connection = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      connection.appSlug == "google-forms", connection.credentialOwnership == .relayOwned,
      connection.grantedScopes == Self.googleFormsRelayOwnedOAuthScopes
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "A Relay-owned exact-scope Google Forms OAuth connection is required.")
    }
    let access = try requireNonEmptyString(
      accessToken, field: "Google Forms OAuth access token", maxLength: 30000)
    let oldAccess = connection.credentialRequirements.first {
      $0.fieldKey == "google_forms_oauth_access_token"
    }?.secretReferenceId
    let oldRefresh = connection.credentialRequirements.first {
      $0.fieldKey == "google_forms_oauth_refresh_token"
    }?.secretReferenceId
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: connection.id,
      label: "Google Forms OAuth access token", secretValue: access)
    let refreshRef: SecretReference?
    do {
      refreshRef = try refreshToken?.providerConnectionNilIfEmpty.map {
        try secrets.set(
          scope: "provider_connection", scopeId: connection.id,
          label: "Google Forms OAuth refresh token", secretValue: $0)
      }
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    connection.credentialRequirements = connection.credentialRequirements.map { value in
      var copy = value
      if copy.fieldKey == "google_forms_oauth_access_token" {
        copy.secretReferenceId = accessRef.id
      }
      if copy.fieldKey == "google_forms_oauth_refresh_token", let refreshRef {
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

  @discardableResult public func saveGoogleTasksRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    accountEmail: String, grantedScopes: [String], expiresAt: String?, displayName: String? = nil,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "google-tasks")
    let email = accountEmail.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
    guard app.slug == "google-tasks", email.count <= 320, email.contains("@"),
      !email.contains(where: { $0.isWhitespace }),
      grantedScopes == Self.googleTasksRelayOwnedOAuthScopes
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "Relay-owned Google Tasks OAuth requires exact tasks scope and a safe account.")
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "Google Tasks OAuth access token", maxLength: 30000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "Google Tasks OAuth refresh token", maxLength: 30000)
    let id = createRelayId("mpc")
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Google Tasks OAuth access token",
      secretValue: access)
    let refreshRef: SecretReference
    do {
      refreshRef = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Google Tasks OAuth refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "google_tasks_oauth_access_token", label: "Google Tasks OAuth access token",
        required: true, userOwnedRequired: false, secretReferenceId: accessRef.id,
        status: .verified,
        helpText:
          "Short-lived access token stored as a Keychain reference and replaced by Railway.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "google_tasks_oauth_refresh_token", label: "Google Tasks OAuth refresh token",
        required: true, userOwnedRequired: false, secretReferenceId: refreshRef.id,
        status: .verified,
        helpText: "Offline refresh token stored separately; only Railway uses the client secret.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "google_tasks_account", label: "Authorized Google Tasks account", required: true,
        userOwnedRequired: false, secretReferenceId: nil, status: .verified,
        helpText: "Exact account binding; destructive and assigned-task actions remain blocked.",
        redactionStatus: "private-state-excluded"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "google-tasks-relay-owned-google-oauth:" + email, providerName: "Google Tasks",
      status: .connected, authorizationState: .completed, credentialOwnership: .relayOwned,
      userOwnedCredentialsRequired: false, credentialRequirements: requirements,
      secretReferenceIds: [accessRef.id, refreshRef.id],
      accountLabel: displayName?.providerConnectionNilIfEmpty ?? email, connectedHandle: email,
      callbackURL: nil,
      requiredScopes: Self.googleTasksRelayOwnedOAuthScopes,
      grantedScopes: Self.googleTasksRelayOwnedOAuthScopes, selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message: "Relay-owned Google Tasks OAuth is ready for bounded TaskList and Task wrappers.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("google-tasks"),
          "authMethod": .string("google_oauth_confidential_web_server_offline"),
          "apiOrigin": .string("https://tasks.googleapis.com/tasks/v1"),
          "tokenOrigin": .string("https://oauth2.googleapis.com/token"),
          "accountEmail": .string(email),
          "accessExpiresAt": expiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
          "exactScopes": .array(Self.googleTasksRelayOwnedOAuthScopes.map(JSONValue.string)),
          "assignedTaskMutationEnabled": .bool(false), "destructiveActionsEnabled": .bool(false),
          "automaticPagination": .bool(false),
          "clientSecretLocation": .string("secure-railway-broker-only"),
          "rawTokenStoredInDatabase": .bool(false),
        ], redactionStatus: "private-state-excluded"),
      senderIdentities: [
        ProviderSenderIdentity(
          id: "google-tasks:" + email, email: email, validationStatus: .verified, agentId: nil,
          installId: nil, lastCheckedAt: timestamp, errorMessage: nil,
          redactionStatus: "private-state-excluded")
      ], installPolicy: "approval_gated_non_destructive_task_actions", lastCheckedAt: timestamp,
      lastError: nil, manualEvidenceNote: nil, reauthorizeRequired: false, disconnecting: false,
      betaBlocked: false, createdAt: timestamp, updatedAt: timestamp,
      redactionStatus: "private-state-excluded")
    do { return try saveConnection(context: context, connection: connection) } catch {
      _ = try? secrets.delete(accessRef.id)
      _ = try? secrets.delete(refreshRef.id)
      throw error
    }
  }

  @discardableResult public func rotateGoogleTasksRelayOwnedOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String?, expiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    googleTasksTokenRotationLock.lock()
    defer { googleTasksTokenRotationLock.unlock() }
    guard
      var connection = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      connection.appSlug == "google-tasks", connection.credentialOwnership == .relayOwned,
      connection.grantedScopes == Self.googleTasksRelayOwnedOAuthScopes
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "A Relay-owned exact-scope Google Tasks OAuth connection is required.")
    }
    let access = try requireNonEmptyString(
      accessToken, field: "Google Tasks OAuth access token", maxLength: 30000)
    let oldAccess = connection.credentialRequirements.first {
      $0.fieldKey == "google_tasks_oauth_access_token"
    }?.secretReferenceId
    let oldRefresh = connection.credentialRequirements.first {
      $0.fieldKey == "google_tasks_oauth_refresh_token"
    }?.secretReferenceId
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: connection.id,
      label: "Google Tasks OAuth access token", secretValue: access)
    let refreshRef: SecretReference?
    do {
      refreshRef = try refreshToken?.providerConnectionNilIfEmpty.map {
        try secrets.set(
          scope: "provider_connection", scopeId: connection.id,
          label: "Google Tasks OAuth refresh token", secretValue: $0)
      }
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    connection.credentialRequirements = connection.credentialRequirements.map { value in
      var copy = value
      if copy.fieldKey == "google_tasks_oauth_access_token" {
        copy.secretReferenceId = accessRef.id
      }
      if copy.fieldKey == "google_tasks_oauth_refresh_token", let refreshRef {
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

  @discardableResult public func saveGoogleContactsRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    accountEmail: String, grantedScopes: [String], expiresAt: String?, displayName: String? = nil,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "google-contacts")
    let email = accountEmail.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
    guard app.slug == "google-contacts", email.count <= 320, email.contains("@"),
      !email.contains(where: { $0.isWhitespace }),
      grantedScopes == Self.googleContactsRelayOwnedOAuthScopes
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "Relay-owned Google Contacts OAuth requires exact contacts scope and a safe account.")
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "Google Contacts OAuth access token", maxLength: 30000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "Google Contacts OAuth refresh token", maxLength: 30000)
    let id = createRelayId("mpc")
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Google Contacts OAuth access token",
      secretValue: access)
    let refreshRef: SecretReference
    do {
      refreshRef = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Google Contacts OAuth refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "google_contacts_oauth_access_token", label: "Google Contacts OAuth access token",
        required: true, userOwnedRequired: false, secretReferenceId: accessRef.id,
        status: .verified,
        helpText:
          "Short-lived access token stored as a Keychain reference and replaced by Railway.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "google_contacts_oauth_refresh_token",
        label: "Google Contacts OAuth refresh token", required: true, userOwnedRequired: false,
        secretReferenceId: refreshRef.id, status: .verified,
        helpText: "Offline refresh token stored separately; only Railway uses the client secret.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "google_contacts_account", label: "Authorized Google Contacts account",
        required: true, userOwnedRequired: false, secretReferenceId: nil, status: .verified,
        helpText:
          "Exact account binding; directory, other-contact, broad personal-field, and destructive actions remain blocked.",
        redactionStatus: "private-state-excluded"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "google-contacts-relay-owned-google-oauth:" + email,
      providerName: "Google Contacts", status: .connected, authorizationState: .completed,
      credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
      credentialRequirements: requirements, secretReferenceIds: [accessRef.id, refreshRef.id],
      accountLabel: displayName?.providerConnectionNilIfEmpty ?? email, connectedHandle: email,
      callbackURL: nil,
      requiredScopes: Self.googleContactsRelayOwnedOAuthScopes,
      grantedScopes: Self.googleContactsRelayOwnedOAuthScopes,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message: "Relay-owned Google Contacts OAuth is ready for privacy-bounded Person wrappers.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("google-contacts"),
          "authMethod": .string("google_oauth_confidential_web_server_offline"),
          "apiOrigin": .string("https://people.googleapis.com/v1"),
          "tokenOrigin": .string("https://oauth2.googleapis.com/token"),
          "accountEmail": .string(email),
          "accessExpiresAt": expiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
          "exactScopes": .array(Self.googleContactsRelayOwnedOAuthScopes.map(JSONValue.string)),
          "contactSourceOnly": .bool(true), "directoryAccessEnabled": .bool(false),
          "otherContactsAccessEnabled": .bool(false), "broadPersonalFieldsEnabled": .bool(false),
          "destructiveActionsEnabled": .bool(false), "automaticPagination": .bool(false),
          "clientSecretLocation": .string("secure-railway-broker-only"),
          "rawTokenStoredInDatabase": .bool(false),
        ], redactionStatus: "private-state-excluded"),
      senderIdentities: [
        ProviderSenderIdentity(
          id: "google-contacts:" + email, email: email, validationStatus: .verified, agentId: nil,
          installId: nil, lastCheckedAt: timestamp, errorMessage: nil,
          redactionStatus: "private-state-excluded")
      ], installPolicy: "approval_gated_privacy_bounded_contact_actions", lastCheckedAt: timestamp,
      lastError: nil, manualEvidenceNote: nil, reauthorizeRequired: false, disconnecting: false,
      betaBlocked: false, createdAt: timestamp, updatedAt: timestamp,
      redactionStatus: "private-state-excluded")
    do { return try saveConnection(context: context, connection: connection) } catch {
      _ = try? secrets.delete(accessRef.id)
      _ = try? secrets.delete(refreshRef.id)
      throw error
    }
  }

  @discardableResult public func rotateGoogleContactsRelayOwnedOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String?, expiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    googleContactsTokenRotationLock.lock()
    defer { googleContactsTokenRotationLock.unlock() }
    guard
      var connection = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      connection.appSlug == "google-contacts", connection.credentialOwnership == .relayOwned,
      connection.grantedScopes == Self.googleContactsRelayOwnedOAuthScopes
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "A Relay-owned exact-scope Google Contacts OAuth connection is required.")
    }
    let access = try requireNonEmptyString(
      accessToken, field: "Google Contacts OAuth access token", maxLength: 30000)
    let oldAccess = connection.credentialRequirements.first {
      $0.fieldKey == "google_contacts_oauth_access_token"
    }?.secretReferenceId
    let oldRefresh = connection.credentialRequirements.first {
      $0.fieldKey == "google_contacts_oauth_refresh_token"
    }?.secretReferenceId
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: connection.id,
      label: "Google Contacts OAuth access token", secretValue: access)
    let refreshRef: SecretReference?
    do {
      refreshRef = try refreshToken?.providerConnectionNilIfEmpty.map {
        try secrets.set(
          scope: "provider_connection", scopeId: connection.id,
          label: "Google Contacts OAuth refresh token", secretValue: $0)
      }
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    connection.credentialRequirements = connection.credentialRequirements.map { value in
      var copy = value
      if copy.fieldKey == "google_contacts_oauth_access_token" {
        copy.secretReferenceId = accessRef.id
      }
      if copy.fieldKey == "google_contacts_oauth_refresh_token", let refreshRef {
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
