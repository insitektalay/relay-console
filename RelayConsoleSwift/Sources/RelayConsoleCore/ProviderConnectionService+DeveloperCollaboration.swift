import Foundation

extension ProviderConnectionService {
  @discardableResult
  public func saveSlackRelayOwnedOAuthConnection(
    context: ServiceRequestContext,
    appIdOrSlug: RelayId,
    botAccessToken: String,
    userAccessToken: String?,
    refreshToken: String?,
    teamId: String?,
    workspaceName: String?,
    botUserId: String?,
    displayName: String? = nil,
    grantedScopes: [String] = ProviderConnectionService.slackRelayOwnedOAuthScopes,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "slack")
    guard app.slug == "slack" else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "Slack OAuth credentials can only be saved for the Slack Marketplace app.")
    }
    try validateAppCanAuthorize(app, context: context)
    let trimmedBotToken = try requireNonEmptyString(
      botAccessToken, field: "Slack bot access token", maxLength: 20000)
    let trimmedUserToken = userAccessToken?.providerConnectionNilIfEmpty
    let trimmedRefreshToken = refreshToken?.providerConnectionNilIfEmpty
    let trimmedTeamId = teamId?.providerConnectionNilIfEmpty
    let trimmedWorkspaceName = workspaceName?.providerConnectionNilIfEmpty
    let trimmedBotUserId = botUserId?.providerConnectionNilIfEmpty
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let connectionId = existing?.id ?? createRelayId("mpc")
    let existingSecretIds = existing.map { Self.secretReferenceIds(in: $0) } ?? []
    for secretId in existingSecretIds {
      _ = try? secrets.delete(secretId)
    }

    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let botTokenReference = try secrets.set(
      scope: "provider_connection",
      scopeId: connectionId,
      label: "Slack bot access token",
      secretValue: trimmedBotToken
    )
    let userTokenReference = try trimmedUserToken.map { token in
      try secrets.set(
        scope: "provider_connection",
        scopeId: connectionId,
        label: "Slack user access token",
        secretValue: token
      )
    }
    let refreshTokenReference = try trimmedRefreshToken.map { token in
      try secrets.set(
        scope: "provider_connection",
        scopeId: connectionId,
        label: "Slack OAuth refresh token",
        secretValue: token
      )
    }
    var secretReferenceIds = [botTokenReference.id]
    if let userTokenReference {
      secretReferenceIds.append(userTokenReference.id)
    }
    if let refreshTokenReference {
      secretReferenceIds.append(refreshTokenReference.id)
    }
    let normalizedGrantedScopes =
      grantedScopes.isEmpty ? Self.slackRelayOwnedOAuthScopes : grantedScopes
    let missingScopes = Self.slackRelayOwnedOAuthScopes.filter {
      !normalizedGrantedScopes.contains($0)
    }
    let connectionStatus: ProviderConnectionStatus =
      missingScopes.isEmpty ? .connected : .authRequired
    let healthState: ProviderConnectorHealthState = missingScopes.isEmpty ? .ready : .degraded
    let connection = MarketplaceProviderConnection(
      id: connectionId,
      workspaceId: context.workspaceId,
      appId: app.id,
      appSlug: app.slug,
      providerKey: "slack-relay-owned-oauth:\(trimmedTeamId ?? connectionId)",
      providerName: "Slack",
      status: connectionStatus,
      authorizationState: connectionStatus == .connected ? .completed : .manualEvidenceRequired,
      credentialOwnership: .relayOwned,
      userOwnedCredentialsRequired: false,
      credentialRequirements: [
        ProviderCredentialRequirement(
          fieldKey: "slack_bot_access_token",
          label: "Slack bot access token",
          required: true,
          userOwnedRequired: false,
          secretReferenceId: botTokenReference.id,
          status: .verified,
          helpText:
            "Granted through Relay-owned Slack OAuth and stored only as a Keychain reference.",
          redactionStatus: "secret-reference-only"
        ),
        ProviderCredentialRequirement(
          fieldKey: "slack_user_access_token",
          label: "Slack user access token",
          required: false,
          userOwnedRequired: false,
          secretReferenceId: userTokenReference?.id,
          status: userTokenReference == nil ? .missing : .verified,
          helpText:
            "Optional user token granted through Slack OAuth for user-context reads where approved.",
          redactionStatus: "secret-reference-only"
        ),
        ProviderCredentialRequirement(
          fieldKey: "slack_oauth_refresh_token",
          label: "Slack OAuth refresh token",
          required: false,
          userOwnedRequired: false,
          secretReferenceId: refreshTokenReference?.id,
          status: refreshTokenReference == nil ? .missing : .verified,
          helpText: "Optional refresh token when the Slack OAuth grant is rotating.",
          redactionStatus: "secret-reference-only"
        ),
        ProviderCredentialRequirement(
          fieldKey: "slack_team_id",
          label: "Slack team ID",
          required: false,
          userOwnedRequired: false,
          secretReferenceId: nil,
          status: trimmedTeamId == nil ? .missing : .verified,
          helpText: "Non-secret Slack workspace/team identifier returned by OAuth.",
          redactionStatus: "private-state-excluded"
        ),
      ],
      secretReferenceIds: secretReferenceIds,
      accountLabel: displayName?.providerConnectionNilIfEmpty ?? existing?.accountLabel
        ?? trimmedWorkspaceName
        ?? "Slack workspace",
      connectedHandle: trimmedWorkspaceName ?? trimmedTeamId,
      callbackURL: Self.defaultCallbackURL(for: app),
      requiredScopes: Self.slackRelayOwnedOAuthScopes,
      grantedScopes: normalizedGrantedScopes,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: healthState,
        message: missingScopes.isEmpty
          ? "Slack OAuth grant saved as Keychain references. Slack calls remain routed through Relay provider-action wrappers."
          : "Slack OAuth grant is missing required scopes: \(missingScopes.joined(separator: ", ")).",
        lastCheckedAt: timestamp,
        missingScopes: missingScopes,
        unavailableTools: missingScopes.isEmpty
          ? [] : ["slack.message.send", "slack.conversation.history.read"],
        diagnostics: [
          "provider": .string("slack"),
          "authMethod": .string("slack_oauth_relay_owned"),
          "callbackURLRequired": .bool(true),
          "callbackURL": .string(Self.defaultCallbackURL(for: app)),
          "credentialOwnership": .string(ProviderCredentialOwnership.relayOwned.rawValue),
          "relayOwnedSlackApp": .bool(true),
          "secretStorage": .string("keychain-reference-only"),
          "botTokenProvided": .bool(true),
          "userTokenProvided": .bool(userTokenReference != nil),
          "refreshTokenProvided": .bool(refreshTokenReference != nil),
          "teamId": trimmedTeamId.map(JSONValue.string) ?? .null,
          "workspaceName": trimmedWorkspaceName.map(JSONValue.string) ?? .null,
          "botUserId": trimmedBotUserId.map(JSONValue.string) ?? .null,
          "rawTokenStoredInDatabase": .bool(false),
          "rawMCPExposure": .bool(false),
        ],
        redactionStatus: "private-state-excluded"
      ),
      senderIdentities: [],
      installPolicy: "approval_gated_workspace_messaging",
      lastCheckedAt: timestamp,
      lastError: missingScopes.isEmpty
        ? nil : "Missing Slack scopes: \(missingScopes.joined(separator: ", "))",
      manualEvidenceNote: nil,
      reauthorizeRequired: !missingScopes.isEmpty,
      disconnecting: false,
      betaBlocked: false,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
      redactionStatus: "private-state-excluded"
    )
    return try saveConnection(context: context, connection: connection)
  }

  @discardableResult
  public func saveGitHubRelayOwnedOAuthConnection(
    context: ServiceRequestContext,
    appIdOrSlug: RelayId,
    accessToken: String,
    refreshToken: String?,
    login: String?,
    organization: String?,
    installationId: String?,
    displayName: String? = nil,
    grantedScopes: [String] = ProviderConnectionService.githubRelayOwnedOAuthScopes,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "github")
    guard app.slug == "github" else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "GitHub OAuth credentials can only be saved for the GitHub Marketplace app.")
    }
    try validateAppCanAuthorize(app, context: context)
    let trimmedAccessToken = try requireNonEmptyString(
      accessToken, field: "GitHub access token", maxLength: 20000)
    let trimmedRefreshToken = refreshToken?.providerConnectionNilIfEmpty
    let trimmedLogin = login?.providerConnectionNilIfEmpty
    let trimmedOrganization = organization?.providerConnectionNilIfEmpty
    let trimmedInstallationId = installationId?.providerConnectionNilIfEmpty
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let connectionId = existing?.id ?? createRelayId("mpc")
    let existingSecretIds = existing.map { Self.secretReferenceIds(in: $0) } ?? []
    for secretId in existingSecretIds {
      _ = try? secrets.delete(secretId)
    }

    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let accessTokenReference = try secrets.set(
      scope: "provider_connection",
      scopeId: connectionId,
      label: "GitHub OAuth access token",
      secretValue: trimmedAccessToken
    )
    let refreshTokenReference = try trimmedRefreshToken.map { token in
      try secrets.set(
        scope: "provider_connection",
        scopeId: connectionId,
        label: "GitHub OAuth refresh token",
        secretValue: token
      )
    }
    var secretReferenceIds = [accessTokenReference.id]
    if let refreshTokenReference {
      secretReferenceIds.append(refreshTokenReference.id)
    }
    let normalizedGrantedScopes =
      grantedScopes.isEmpty ? Self.githubRelayOwnedOAuthScopes : grantedScopes
    let missingScopes = Self.githubRelayOwnedOAuthScopes.filter {
      !normalizedGrantedScopes.contains($0)
    }
    let connectionStatus: ProviderConnectionStatus =
      missingScopes.isEmpty ? .connected : .authRequired
    let healthState: ProviderConnectorHealthState = missingScopes.isEmpty ? .ready : .degraded
    let accountLabel =
      displayName?.providerConnectionNilIfEmpty
      ?? existing?.accountLabel
      ?? trimmedOrganization
      ?? trimmedLogin
      ?? "GitHub account"
    let connection = MarketplaceProviderConnection(
      id: connectionId,
      workspaceId: context.workspaceId,
      appId: app.id,
      appSlug: app.slug,
      providerKey:
        "github-relay-owned-oauth:\(trimmedOrganization ?? trimmedLogin ?? connectionId)",
      providerName: "GitHub",
      status: connectionStatus,
      authorizationState: connectionStatus == .connected ? .completed : .manualEvidenceRequired,
      credentialOwnership: .relayOwned,
      userOwnedCredentialsRequired: false,
      credentialRequirements: [
        ProviderCredentialRequirement(
          fieldKey: "github_oauth_access_token",
          label: "GitHub OAuth access token",
          required: true,
          userOwnedRequired: false,
          secretReferenceId: accessTokenReference.id,
          status: .verified,
          helpText:
            "Granted through Relay-owned GitHub OAuth and stored only as a Keychain reference.",
          redactionStatus: "secret-reference-only"
        ),
        ProviderCredentialRequirement(
          fieldKey: "github_oauth_refresh_token",
          label: "GitHub OAuth refresh token",
          required: false,
          userOwnedRequired: false,
          secretReferenceId: refreshTokenReference?.id,
          status: refreshTokenReference == nil ? .missing : .verified,
          helpText: "Optional refresh token when the GitHub OAuth grant is refreshable.",
          redactionStatus: "secret-reference-only"
        ),
        ProviderCredentialRequirement(
          fieldKey: "github_login",
          label: "GitHub login",
          required: false,
          userOwnedRequired: false,
          secretReferenceId: nil,
          status: trimmedLogin == nil ? .missing : .verified,
          helpText: "Non-secret GitHub user login returned by OAuth.",
          redactionStatus: "private-state-excluded"
        ),
        ProviderCredentialRequirement(
          fieldKey: "github_organization",
          label: "GitHub organization",
          required: false,
          userOwnedRequired: false,
          secretReferenceId: nil,
          status: trimmedOrganization == nil ? .missing : .verified,
          helpText: "Optional non-secret organization context selected for this connection.",
          redactionStatus: "private-state-excluded"
        ),
      ],
      secretReferenceIds: secretReferenceIds,
      accountLabel: accountLabel,
      connectedHandle: trimmedOrganization ?? trimmedLogin,
      callbackURL: Self.defaultCallbackURL(for: app),
      requiredScopes: Self.githubRelayOwnedOAuthScopes,
      grantedScopes: normalizedGrantedScopes,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: healthState,
        message: missingScopes.isEmpty
          ? "GitHub OAuth grant saved as Keychain references. GitHub calls remain routed through Relay provider-action wrappers."
          : "GitHub OAuth grant is missing required scopes: \(missingScopes.joined(separator: ", ")).",
        lastCheckedAt: timestamp,
        missingScopes: missingScopes,
        unavailableTools: missingScopes.isEmpty
          ? [] : ["github.issue.comment.create", "github.pull_request.comment.create"],
        diagnostics: [
          "provider": .string("github"),
          "authMethod": .string("github_oauth_relay_owned"),
          "callbackURLRequired": .bool(true),
          "callbackURL": .string(Self.defaultCallbackURL(for: app)),
          "credentialOwnership": .string(ProviderCredentialOwnership.relayOwned.rawValue),
          "relayOwnedGitHubApp": .bool(true),
          "secretStorage": .string("keychain-reference-only"),
          "accessTokenProvided": .bool(true),
          "refreshTokenProvided": .bool(refreshTokenReference != nil),
          "login": trimmedLogin.map(JSONValue.string) ?? .null,
          "organization": trimmedOrganization.map(JSONValue.string) ?? .null,
          "installationId": trimmedInstallationId.map(JSONValue.string) ?? .null,
          "rawTokenStoredInDatabase": .bool(false),
          "rawMCPExposure": .bool(false),
        ],
        redactionStatus: "private-state-excluded"
      ),
      senderIdentities: [],
      installPolicy: "approval_gated_repository_comments",
      lastCheckedAt: timestamp,
      lastError: missingScopes.isEmpty
        ? nil : "Missing GitHub scopes: \(missingScopes.joined(separator: ", "))",
      manualEvidenceNote: nil,
      reauthorizeRequired: !missingScopes.isEmpty,
      disconnecting: false,
      betaBlocked: false,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
      redactionStatus: "private-state-excluded"
    )
    return try saveConnection(context: context, connection: connection)
  }
}
