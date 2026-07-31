import Foundation

extension ProviderConnectionService {
  @discardableResult public func saveDiscordRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, botToken: String, botUserId: String,
    botUsername: String, selectedGuildId: String, selectedGuildName: String,
    selectedChannelId: String, selectedChannelName: String, selectedGuildVerified: Bool,
    selectedChannelVerified: Bool, selectedChannelIsNSFW: Bool, messageContentEnabled: Bool,
    grantedScopes: [String], now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "discord")
    let botId = try DiscordProviderActionSupport.snowflake(botUserId, "botUserId")
    let guildId = try DiscordProviderActionSupport.snowflake(selectedGuildId, "selectedGuildId")
    let channelId = try DiscordProviderActionSupport.snowflake(
      selectedChannelId, "selectedChannelId")
    let username = try requireNonEmptyString(
      botUsername, field: "Discord bot username", maxLength: 512)
    let guildName = try requireNonEmptyString(
      selectedGuildName, field: "Discord guild name", maxLength: 512)
    let channelName = try requireNonEmptyString(
      selectedChannelName, field: "Discord channel name", maxLength: 512)
    guard app.slug == "discord", selectedGuildVerified, selectedChannelVerified,
      !selectedChannelIsNSFW, messageContentEnabled,
      grantedScopes == Self.discordRelayOwnedOAuthScopes
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "Discord requires exact bot scope, one verified guild and non-NSFW text channel, Message Content approval, and permissions integer 66560."
      )
    }
    try validateAppCanAuthorize(app, context: context)
    let id = createRelayId("mpc")
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let token = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Discord bot token",
      secretValue: try requireNonEmptyString(botToken, field: "Discord bot token", maxLength: 30000)
    )
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "discord_bot_token", label: "Discord bot token", required: true,
        userOwnedRequired: false, secretReferenceId: token.id, status: .verified,
        helpText: "Relay-owned bot token stored as a secret reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "discord_selected_channel", label: "Selected Discord guild and channel",
        required: true, userOwnedRequired: false, secretReferenceId: nil, status: .verified,
        helpText: "One administrator-selected non-NSFW text channel.",
        redactionStatus: "private-state-excluded"),
    ]
    let diagnostics: [String: JSONValue] = [
      "apiOrigin": .string("https://discord.com/api/v10"), "botInstallOnly": .bool(true),
      "botUserId": .string(botId), "botUsername": .string(username),
      "selectedGuildId": .string(guildId), "selectedGuildName": .string(guildName),
      "selectedGuildVerified": .bool(true), "selectedChannelId": .string(channelId),
      "selectedChannelName": .string(channelName), "selectedChannelVerified": .bool(true),
      "selectedChannelIsNSFW": .bool(false), "messageContentEnabled": .bool(true),
      "requestedPermissions": .string("66560"), "selfBotEnabled": .bool(false),
      "dmAccessEnabled": .bool(false), "peopleMediaSearchEnabled": .bool(false),
      "writesEnabled": .bool(false), "moderationAdminEnabled": .bool(false),
      "gatewayWebhooksEnabled": .bool(false), "automaticPagination": .bool(false),
      "rawToolsEnabled": .bool(false), "maxResults": .number(25),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "discord-relay-owned-bot:" + guildId + ":" + channelId, providerName: "Discord",
      status: .connected, authorizationState: .completed, credentialOwnership: .relayOwned,
      userOwnedCredentialsRequired: false, credentialRequirements: requirements,
      secretReferenceIds: [token.id], accountLabel: guildName + " #" + channelName,
      connectedHandle: "@" + username, callbackURL: nil,
      requiredScopes: Self.discordRelayOwnedOAuthScopes,
      grantedScopes: Self.discordRelayOwnedOAuthScopes, selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready, message: "Discord is ready for four selected-guild/channel bot reads.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [], diagnostics: diagnostics,
        redactionStatus: "private-state-excluded"), senderIdentities: [],
      installPolicy: "selected_guild_channel_bot_read_only", lastCheckedAt: timestamp,
      lastError: nil, manualEvidenceNote: nil, reauthorizeRequired: false, disconnecting: false,
      betaBlocked: false, createdAt: timestamp, updatedAt: timestamp,
      redactionStatus: "private-state-excluded")
    do { return try saveConnection(context: context, connection: connection) } catch {
      _ = try? secrets.delete(token.id)
      throw error
    }
  }
  @discardableResult public func rotateDiscordRelayOwnedBotToken(
    context: ServiceRequestContext, connectionId: RelayId, botToken: String, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    discordTokenRotationLock.lock()
    defer { discordTokenRotationLock.unlock() }
    guard
      var connection = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      connection.appSlug == "discord", connection.credentialOwnership == .relayOwned,
      connection.grantedScopes == Self.discordRelayOwnedOAuthScopes,
      connection.health.diagnostics["botInstallOnly"]?.bool == true,
      connection.health.diagnostics["selectedGuildVerified"]?.bool == true,
      connection.health.diagnostics["selectedChannelVerified"]?.bool == true
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "An exact selected-guild/channel Discord bot connection is required.")
    }
    let old = connection.credentialRequirements.first { $0.fieldKey == "discord_bot_token" }?
      .secretReferenceId
    let token = try secrets.set(
      scope: "provider_connection", scopeId: connection.id, label: "Discord bot token",
      secretValue: try requireNonEmptyString(botToken, field: "Discord bot token", maxLength: 30000)
    )
    connection.credentialRequirements = connection.credentialRequirements.map { value in
      var copy = value
      if copy.fieldKey == "discord_bot_token" { copy.secretReferenceId = token.id }
      return copy
    }
    connection.secretReferenceIds = [token.id]
    connection.updatedAt = ISO8601DateFormatter.relayConsole.string(from: now)
    do {
      let saved = try saveConnection(context: context, connection: connection)
      if let old { _ = try? secrets.delete(old) }
      return saved
    } catch {
      _ = try? secrets.delete(token.id)
      throw error
    }
  }
  @discardableResult public func saveZoomRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    accountEmail: String, accountLabel: String?, zoomUserId: String, zoomDisplayName: String,
    userVerified: Bool, grantedScopes: [String], expiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "zoom")
    let email = accountEmail.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
    let userId = try requireNonEmptyString(zoomUserId, field: "Zoom user ID", maxLength: 128)
    let displayName = try requireNonEmptyString(
      zoomDisplayName, field: "Zoom display name", maxLength: 512)
    guard app.slug == "zoom", email.count <= 320, email.contains("@"), userVerified,
      userId.allSatisfy({ $0.isLetter || $0.isNumber || "-_".contains($0) }),
      grantedScopes == Self.zoomRelayOwnedOAuthScopes
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "Zoom requires exact non-admin granular meeting-read scopes and one verified user-managed account."
      )
    }
    try validateAppCanAuthorize(app, context: context)
    let id = createRelayId("mpc")
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let access = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Zoom OAuth access token",
      secretValue: try requireNonEmptyString(
        accessToken, field: "Zoom access token", maxLength: 30000))
    let refresh = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Zoom OAuth refresh token",
      secretValue: try requireNonEmptyString(
        refreshToken, field: "Zoom refresh token", maxLength: 30000))
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "zoom_oauth_access_token", label: "Zoom OAuth access token", required: true,
        userOwnedRequired: false, secretReferenceId: access.id, status: .verified,
        helpText: "Railway-rotated user-managed token.", redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "zoom_oauth_refresh_token", label: "Zoom OAuth refresh token", required: true,
        userOwnedRequired: false, secretReferenceId: refresh.id, status: .verified,
        helpText: "Railway-only refresh token.", redactionStatus: "secret-reference-only"),
    ]
    let diagnostics: [String: JSONValue] = [
      "apiOrigin": .string("https://api.zoom.us/v2"), "userManagedOnly": .bool(true),
      "selfUserOnly": .bool(true), "userVerified": .bool(true), "zoomUserId": .string(userId),
      "zoomDisplayName": .string(displayName), "metadataOnly": .bool(true),
      "joinStartCredentialsEnabled": .bool(false), "peopleContentEnabled": .bool(false),
      "recordingsTranscriptsChatEnabled": .bool(false), "assetsPollsMediaEnabled": .bool(false),
      "adminEnabled": .bool(false), "writesEnabled": .bool(false), "webhooksEnabled": .bool(false),
      "automaticPagination": .bool(false), "rawToolsEnabled": .bool(false),
      "maxResults": .number(25),
      "accessExpiresAt": expiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "zoom-relay-owned-oauth:" + email + ":" + userId, providerName: "Zoom",
      status: .connected, authorizationState: .completed, credentialOwnership: .relayOwned,
      userOwnedCredentialsRequired: false, credentialRequirements: requirements,
      secretReferenceIds: [access.id, refresh.id],
      accountLabel: accountLabel?.providerConnectionNilIfEmpty ?? displayName,
      connectedHandle: email,
      callbackURL: nil, requiredScopes: Self.zoomRelayOwnedOAuthScopes,
      grantedScopes: Self.zoomRelayOwnedOAuthScopes, selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready, message: "Zoom is ready for four self-user meeting metadata reads.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [], diagnostics: diagnostics,
        redactionStatus: "private-state-excluded"), senderIdentities: [],
      installPolicy: "self_user_meeting_metadata_get_only", lastCheckedAt: timestamp,
      lastError: nil, manualEvidenceNote: nil, reauthorizeRequired: false, disconnecting: false,
      betaBlocked: false, createdAt: timestamp, updatedAt: timestamp,
      redactionStatus: "private-state-excluded")
    do { return try saveConnection(context: context, connection: connection) } catch {
      _ = try? secrets.delete(access.id)
      _ = try? secrets.delete(refresh.id)
      throw error
    }
  }
  @discardableResult public func rotateZoomRelayOwnedOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String?, expiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    zoomTokenRotationLock.lock()
    defer { zoomTokenRotationLock.unlock() }
    guard
      var connection = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId), connection.appSlug == "zoom",
      connection.credentialOwnership == .relayOwned,
      connection.grantedScopes == Self.zoomRelayOwnedOAuthScopes,
      connection.health.diagnostics["userVerified"]?.bool == true
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "An exact self-user Zoom connection is required.")
    }
    let value = try requireNonEmptyString(
      accessToken, field: "Zoom OAuth access token", maxLength: 30000)
    let oldAccess = connection.credentialRequirements.first {
      $0.fieldKey == "zoom_oauth_access_token"
    }?.secretReferenceId
    let oldRefresh = connection.credentialRequirements.first {
      $0.fieldKey == "zoom_oauth_refresh_token"
    }?.secretReferenceId
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: connection.id, label: "Zoom OAuth access token",
      secretValue: value)
    let refreshRef = try refreshToken?.providerConnectionNilIfEmpty.map {
      try secrets.set(
        scope: "provider_connection", scopeId: connection.id, label: "Zoom OAuth refresh token",
        secretValue: $0)
    }
    connection.credentialRequirements = connection.credentialRequirements.map { item in
      var copy = item
      if copy.fieldKey == "zoom_oauth_access_token" { copy.secretReferenceId = accessRef.id }
      if copy.fieldKey == "zoom_oauth_refresh_token", let refreshRef {
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
