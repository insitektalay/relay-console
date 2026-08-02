import Foundation

extension ProviderConnectionService {
  @discardableResult
  public func saveLinearRelayOwnedOAuthConnection(
    context: ServiceRequestContext,
    appIdOrSlug: RelayId,
    accessToken: String,
    refreshToken: String?,
    username: String?,
    workspace: String?,
    teamKey: String?,
    displayName: String? = nil,
    grantedScopes: [String] = ProviderConnectionService.linearRelayOwnedOAuthScopes,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "linear")
    guard app.slug == "linear" else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "Linear OAuth credentials can only be saved for the Linear Marketplace app.")
    }
    try validateAppCanAuthorize(app, context: context)
    let trimmedAccessToken = try requireNonEmptyString(
      accessToken, field: "Linear access token", maxLength: 20000)
    let trimmedRefreshToken = refreshToken?.providerConnectionNilIfEmpty
    let trimmedUsername = username?.providerConnectionNilIfEmpty
    let trimmedWorkspace = workspace?.providerConnectionNilIfEmpty
    let trimmedTeamKey = teamKey?.providerConnectionNilIfEmpty
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
      label: "Linear OAuth access token",
      secretValue: trimmedAccessToken
    )
    let refreshTokenReference = try trimmedRefreshToken.map { token in
      try secrets.set(
        scope: "provider_connection",
        scopeId: connectionId,
        label: "Linear OAuth refresh token",
        secretValue: token
      )
    }
    var secretReferenceIds = [accessTokenReference.id]
    if let refreshTokenReference {
      secretReferenceIds.append(refreshTokenReference.id)
    }
    let normalizedGrantedScopes =
      grantedScopes.isEmpty ? Self.linearRelayOwnedOAuthScopes : grantedScopes
    let missingScopes = Self.linearRelayOwnedOAuthScopes.filter {
      !normalizedGrantedScopes.contains($0)
    }
    let connectionStatus: ProviderConnectionStatus =
      missingScopes.isEmpty ? .connected : .authRequired
    let healthState: ProviderConnectorHealthState = missingScopes.isEmpty ? .ready : .degraded
    let accountLabel =
      displayName?.providerConnectionNilIfEmpty
      ?? existing?.accountLabel
      ?? trimmedTeamKey
      ?? trimmedWorkspace
      ?? trimmedUsername
      ?? "Linear account"
    let connection = MarketplaceProviderConnection(
      id: connectionId,
      workspaceId: context.workspaceId,
      appId: app.id,
      appSlug: app.slug,
      providerKey:
        "linear-relay-owned-oauth:\(trimmedTeamKey ?? trimmedWorkspace ?? trimmedUsername ?? connectionId)",
      providerName: "Linear",
      status: connectionStatus,
      authorizationState: connectionStatus == .connected ? .completed : .manualEvidenceRequired,
      credentialOwnership: .relayOwned,
      userOwnedCredentialsRequired: false,
      credentialRequirements: [
        ProviderCredentialRequirement(
          fieldKey: "linear_oauth_access_token",
          label: "Linear OAuth access token",
          required: true,
          userOwnedRequired: false,
          secretReferenceId: accessTokenReference.id,
          status: .verified,
          helpText:
            "Granted through Relay-owned Linear OAuth and stored only as a Keychain reference.",
          redactionStatus: "secret-reference-only"
        ),
        ProviderCredentialRequirement(
          fieldKey: "linear_oauth_refresh_token",
          label: "Linear OAuth refresh token",
          required: false,
          userOwnedRequired: false,
          secretReferenceId: refreshTokenReference?.id,
          status: refreshTokenReference == nil ? .missing : .verified,
          helpText: "Optional refresh token when the Linear OAuth grant is refreshable.",
          redactionStatus: "secret-reference-only"
        ),
        ProviderCredentialRequirement(
          fieldKey: "linear_username",
          label: "Linear username",
          required: false,
          userOwnedRequired: false,
          secretReferenceId: nil,
          status: trimmedUsername == nil ? .missing : .verified,
          helpText: "Non-secret Linear username returned by OAuth.",
          redactionStatus: "private-state-excluded"
        ),
        ProviderCredentialRequirement(
          fieldKey: "linear_workspace",
          label: "Linear workspace",
          required: false,
          userOwnedRequired: false,
          secretReferenceId: nil,
          status: trimmedWorkspace == nil ? .missing : .verified,
          helpText: "Optional non-secret workspace context selected for this connection.",
          redactionStatus: "private-state-excluded"
        ),
      ],
      secretReferenceIds: secretReferenceIds,
      accountLabel: accountLabel,
      connectedHandle: trimmedTeamKey ?? trimmedWorkspace ?? trimmedUsername,
      callbackURL: Self.defaultCallbackURL(for: app),
      requiredScopes: Self.linearRelayOwnedOAuthScopes,
      grantedScopes: normalizedGrantedScopes,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: healthState,
        message: missingScopes.isEmpty
          ? "Linear OAuth grant saved as Keychain references. Linear calls remain routed through Relay provider-action wrappers."
          : "Linear OAuth grant is missing required scopes: \(missingScopes.joined(separator: ", ")).",
        lastCheckedAt: timestamp,
        missingScopes: missingScopes,
        unavailableTools: missingScopes.isEmpty
          ? [] : ["linear.issue.comment.create", "linear.pull_request.comment.create"],
        diagnostics: [
          "provider": .string("linear"),
          "authMethod": .string("linear_oauth_relay_owned"),
          "callbackURLRequired": .bool(true),
          "callbackURL": .string(Self.defaultCallbackURL(for: app)),
          "credentialOwnership": .string(ProviderCredentialOwnership.relayOwned.rawValue),
          "relayOwnedLinearApp": .bool(true),
          "secretStorage": .string("keychain-reference-only"),
          "accessTokenProvided": .bool(true),
          "refreshTokenProvided": .bool(refreshTokenReference != nil),
          "username": trimmedUsername.map(JSONValue.string) ?? .null,
          "workspace": trimmedWorkspace.map(JSONValue.string) ?? .null,
          "teamKey": trimmedTeamKey.map(JSONValue.string) ?? .null,
          "rawTokenStoredInDatabase": .bool(false),
          "rawMCPExposure": .bool(false),
        ],
        redactionStatus: "private-state-excluded"
      ),
      senderIdentities: [],
      installPolicy: "approval_gated_linear_issue_comments",
      lastCheckedAt: timestamp,
      lastError: missingScopes.isEmpty
        ? nil : "Missing Linear scopes: \(missingScopes.joined(separator: ", "))",
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
  public func saveAsanaRelayOwnedOAuthConnection(
    context: ServiceRequestContext,
    appIdOrSlug: RelayId,
    accessToken: String,
    refreshToken: String?,
    userName: String?,
    userEmail: String?,
    workspaceGID: String?,
    workspaceName: String?,
    displayName: String? = nil,
    grantedScopes: [String] = ProviderConnectionService.asanaRelayOwnedOAuthScopes,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "asana")
    guard app.slug == "asana" else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "Asana OAuth credentials can only be saved for the Asana Marketplace app.")
    }
    try validateAppCanAuthorize(app, context: context)
    let token = try requireNonEmptyString(
      accessToken, field: "Asana access token", maxLength: 20000)
    let refresh = refreshToken?.providerConnectionNilIfEmpty
    let normalizedUserName = userName?.providerConnectionNilIfEmpty
    let normalizedUserEmail = userEmail?.providerConnectionNilIfEmpty
    let normalizedWorkspaceGID = workspaceGID?.providerConnectionNilIfEmpty
    let normalizedWorkspaceName = workspaceName?.providerConnectionNilIfEmpty
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let connectionId = existing?.id ?? createRelayId("mpc")
    for secretId in existing.map({ Self.secretReferenceIds(in: $0) }) ?? [] {
      _ = try? secrets.delete(secretId)
    }

    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let accessReference = try secrets.set(
      scope: "provider_connection", scopeId: connectionId,
      label: "Asana OAuth access token", secretValue: token
    )
    let refreshReference = try refresh.map {
      try secrets.set(
        scope: "provider_connection", scopeId: connectionId, label: "Asana OAuth refresh token",
        secretValue: $0)
    }
    var secretReferenceIds = [accessReference.id]
    if let refreshReference { secretReferenceIds.append(refreshReference.id) }
    let normalizedScopes = grantedScopes.isEmpty ? Self.asanaRelayOwnedOAuthScopes : grantedScopes
    let missingScopes = Self.asanaRelayOwnedOAuthScopes.filter { !normalizedScopes.contains($0) }
    let ready = missingScopes.isEmpty
    let accountLabel =
      displayName?.providerConnectionNilIfEmpty ?? existing?.accountLabel ?? normalizedWorkspaceName
      ?? normalizedUserName ?? "Asana account"
    let connection = MarketplaceProviderConnection(
      id: connectionId,
      workspaceId: context.workspaceId,
      appId: app.id,
      appSlug: app.slug,
      providerKey:
        "asana-relay-owned-oauth:\(normalizedWorkspaceGID ?? normalizedUserEmail ?? connectionId)",
      providerName: "Asana",
      status: ready ? .connected : .authRequired,
      authorizationState: ready ? .completed : .manualEvidenceRequired,
      credentialOwnership: .relayOwned,
      userOwnedCredentialsRequired: false,
      credentialRequirements: [
        ProviderCredentialRequirement(
          fieldKey: "asana_oauth_access_token", label: "Asana OAuth access token",
          required: true, userOwnedRequired: false, secretReferenceId: accessReference.id,
          status: .verified,
          helpText:
            "Granted through Relay-owned Asana OAuth and stored only as a Keychain reference.",
          redactionStatus: "secret-reference-only"
        ),
        ProviderCredentialRequirement(
          fieldKey: "asana_oauth_refresh_token", label: "Asana OAuth refresh token",
          required: false, userOwnedRequired: false, secretReferenceId: refreshReference?.id,
          status: refreshReference == nil ? .missing : .verified,
          helpText: "Refreshes Asana's one-hour access token without repeating consent.",
          redactionStatus: "secret-reference-only"
        ),
        ProviderCredentialRequirement(
          fieldKey: "asana_workspace_gid", label: "Asana workspace GID",
          required: false, userOwnedRequired: false, secretReferenceId: nil,
          status: normalizedWorkspaceGID == nil ? .missing : .verified,
          helpText: "Non-secret Asana workspace identifier returned or selected after OAuth.",
          redactionStatus: "private-state-excluded"
        ),
      ],
      secretReferenceIds: secretReferenceIds,
      accountLabel: accountLabel,
      connectedHandle: normalizedWorkspaceGID ?? normalizedUserEmail ?? normalizedUserName,
      callbackURL: Self.defaultCallbackURL(for: app),
      requiredScopes: Self.asanaRelayOwnedOAuthScopes,
      grantedScopes: normalizedScopes,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: ready ? .ready : .degraded,
        message: ready
          ? "Asana OAuth grant saved as Keychain references. Provider calls remain routed through Relay wrappers."
          : "Asana OAuth grant is missing required scopes: \(missingScopes.joined(separator: ", ")).",
        lastCheckedAt: timestamp,
        missingScopes: missingScopes,
        unavailableTools: ready
          ? []
          : [
            "asana.task.search", "asana.project.list", "asana.task.get", "asana.task.create",
            "asana.task.update",
          ],
        diagnostics: [
          "provider": .string("asana"),
          "authMethod": .string("asana_oauth_relay_owned"),
          "callbackURLRequired": .bool(true),
          "callbackURL": .string(Self.defaultCallbackURL(for: app)),
          "credentialOwnership": .string(ProviderCredentialOwnership.relayOwned.rawValue),
          "relayOwnedAsanaApp": .bool(true),
          "secretStorage": .string("keychain-reference-only"),
          "accessTokenProvided": .bool(true),
          "refreshTokenProvided": .bool(refreshReference != nil),
          "userName": normalizedUserName.map(JSONValue.string) ?? .null,
          "userEmail": normalizedUserEmail.map(JSONValue.string) ?? .null,
          "workspaceGID": normalizedWorkspaceGID.map(JSONValue.string) ?? .null,
          "workspaceName": normalizedWorkspaceName.map(JSONValue.string) ?? .null,
          "rawTokenStoredInDatabase": .bool(false),
          "rawMCPExposure": .bool(false),
        ],
        redactionStatus: "private-state-excluded"
      ),
      senderIdentities: [],
      installPolicy: "approval_gated_asana_task_writes",
      lastCheckedAt: timestamp,
      lastError: ready ? nil : "Missing Asana scopes: \(missingScopes.joined(separator: ", "))",
      manualEvidenceNote: nil,
      reauthorizeRequired: !ready,
      disconnecting: false,
      betaBlocked: false,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
      redactionStatus: "private-state-excluded"
    )
    return try saveConnection(context: context, connection: connection)
  }

  @discardableResult
  public func saveTrelloRelayOwnedAuthorizationConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId,
    apiKey: String, userToken: String, oauthSecret: String?,
    memberId: String?, username: String?, fullName: String?, workspaceName: String?,
    expiration: String?, displayName: String? = nil,
    grantedPermissions: [String] = ProviderConnectionService.trelloRelayOwnedPermissions,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "trello")
    guard app.slug == "trello" else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "Trello authorization can only be saved for the Trello Marketplace app.")
    }
    try validateAppCanAuthorize(app, context: context)
    let key = try requireNonEmptyString(apiKey, field: "Trello API key", maxLength: 10000)
    let token = try requireNonEmptyString(userToken, field: "Trello user token", maxLength: 20000)
    let secret = oauthSecret?.providerConnectionNilIfEmpty
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let connectionId = existing?.id ?? createRelayId("mpc")
    for id in existing.map({ Self.secretReferenceIds(in: $0) }) ?? [] {
      _ = try? secrets.delete(id)
    }
    let keyRef = try secrets.set(
      scope: "provider_connection", scopeId: connectionId, label: "Trello API key", secretValue: key
    )
    let tokenRef = try secrets.set(
      scope: "provider_connection", scopeId: connectionId, label: "Trello user token",
      secretValue: token)
    let secretRef = try secret.map {
      try secrets.set(
        scope: "provider_connection", scopeId: connectionId, label: "Trello OAuth 1.0 secret",
        secretValue: $0)
    }
    var refs = [keyRef.id, tokenRef.id]
    if let secretRef { refs.append(secretRef.id) }
    let permissions =
      grantedPermissions.isEmpty ? Self.trelloRelayOwnedPermissions : grantedPermissions
    let missing = Self.trelloRelayOwnedPermissions.filter { !permissions.contains($0) }
    let ready = missing.isEmpty
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let account =
      displayName?.providerConnectionNilIfEmpty ?? workspaceName?.providerConnectionNilIfEmpty
      ?? fullName?.providerConnectionNilIfEmpty ?? username?
      .providerConnectionNilIfEmpty ?? "Trello account"
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "trello_api_key", label: "Trello API key", required: true,
        userOwnedRequired: false, secretReferenceId: keyRef.id, status: .verified,
        helpText: "Relay-owned Trello Power-Up API key stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "trello_user_token", label: "Trello user token", required: true,
        userOwnedRequired: false, secretReferenceId: tokenRef.id, status: .verified,
        helpText: "User-granted Trello token stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "trello_oauth_secret", label: "Trello OAuth 1.0 secret", required: false,
        userOwnedRequired: false, secretReferenceId: secretRef?.id,
        status: secretRef == nil ? .missing : .verified,
        helpText: "Used only when Relay completes Trello's OAuth 1.0 handshake.",
        redactionStatus: "secret-reference-only"),
    ]
    let connection = MarketplaceProviderConnection(
      id: connectionId, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey:
        "trello-relay-owned-authorization:\(memberId?.providerConnectionNilIfEmpty ?? username?.providerConnectionNilIfEmpty ?? connectionId)",
      providerName: "Trello",
      status: ready ? .connected : .authRequired,
      authorizationState: ready ? .completed : .manualEvidenceRequired,
      credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
      credentialRequirements: requirements,
      secretReferenceIds: refs, accountLabel: account,
      connectedHandle: memberId?.providerConnectionNilIfEmpty
        ?? username?.providerConnectionNilIfEmpty,
      callbackURL: Self.defaultCallbackURL(for: app),
      requiredScopes: Self.trelloRelayOwnedPermissions, grantedScopes: permissions,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: ready ? .ready : .degraded,
        message: ready
          ? "Trello authorization saved as Keychain references; calls remain brokered by Relay."
          : "Trello authorization is missing permissions: \(missing.joined(separator: ", ")).",
        lastCheckedAt: timestamp, missingScopes: missing,
        unavailableTools: ready
          ? []
          : [
            "trello.board.list", "trello.card.get", "trello.card.create", "trello.card.update",
            "trello.card.comment.create",
          ],
        diagnostics: [
          "provider": .string("trello"),
          "authMethod": .string("trello_relay_owned_api_key_token_or_oauth1"),
          "relayOwnedTrelloPowerUp": .bool(true),
          "secretStorage": .string("keychain-reference-only"),
          "memberId": memberId?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
          "username": username?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
          "fullName": fullName?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
          "workspaceName": workspaceName?.providerConnectionNilIfEmpty.map(JSONValue.string)
            ?? .null,
          "expiration": expiration?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
          "rawTokenStoredInDatabase": .bool(false), "rawProviderToolExposure": .bool(false),
        ],
        redactionStatus: "private-state-excluded"
      ), senderIdentities: [], installPolicy: "approval_gated_trello_card_writes",
      lastCheckedAt: timestamp,
      lastError: ready ? nil : "Missing Trello permissions: \(missing.joined(separator: ", "))",
      manualEvidenceNote: nil,
      reauthorizeRequired: !ready, disconnecting: false, betaBlocked: false,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp, redactionStatus: "private-state-excluded"
    )
    return try saveConnection(context: context, connection: connection)
  }

  @discardableResult
  public func saveClickUpRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String,
    accountId: String?, accountName: String?, authorizedWorkspaceIds: [String],
    authorizedWorkspaceNames: [String],
    displayName: String? = nil,
    grantedCapabilities: [String] = ProviderConnectionService.clickUpRelayOwnedOAuthCapabilities,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "clickup")
    guard app.slug == "clickup" else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "ClickUp OAuth can only be saved for the ClickUp Marketplace app.")
    }
    try validateAppCanAuthorize(app, context: context)
    let token = try requireNonEmptyString(
      accessToken, field: "ClickUp OAuth access token", maxLength: 20000)
    let workspaceIds = authorizedWorkspaceIds.compactMap(\.providerConnectionNilIfEmpty)
    let capabilities =
      grantedCapabilities.isEmpty ? Self.clickUpRelayOwnedOAuthCapabilities : grantedCapabilities
    let missing = Self.clickUpRelayOwnedOAuthCapabilities.filter { !capabilities.contains($0) }
    let ready = missing.isEmpty && !workspaceIds.isEmpty
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let connectionId = existing?.id ?? createRelayId("mpc")
    for id in existing.map({ Self.secretReferenceIds(in: $0) }) ?? [] {
      _ = try? secrets.delete(id)
    }
    let tokenRef = try secrets.set(
      scope: "provider_connection", scopeId: connectionId, label: "ClickUp OAuth access token",
      secretValue: token)
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let workspaceLabel =
      authorizedWorkspaceNames.compactMap(\.providerConnectionNilIfEmpty).joined(separator: ", ")
      .providerConnectionNilIfEmpty
      ?? workspaceIds.joined(separator: ", ")
    let account =
      displayName?.providerConnectionNilIfEmpty ?? accountName?.providerConnectionNilIfEmpty
      ?? workspaceLabel.providerConnectionNilIfEmpty
      ?? "ClickUp account"
    let requirement = ProviderCredentialRequirement(
      fieldKey: "clickup_oauth_access_token", label: "ClickUp OAuth access token", required: true,
      userOwnedRequired: false, secretReferenceId: tokenRef.id, status: .verified,
      helpText: "Relay-owned ClickUp OAuth access token stored as a Keychain reference.",
      redactionStatus: "secret-reference-only")
    let reason =
      !workspaceIds.isEmpty
      ? "Missing Relay capability proof: \(missing.joined(separator: ", "))."
      : "No ClickUp Workspace was authorized."
    let connection = MarketplaceProviderConnection(
      id: connectionId, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey:
        "clickup-relay-owned-oauth:\(accountId?.providerConnectionNilIfEmpty ?? connectionId)",
      providerName: "ClickUp",
      status: ready ? .connected : .authRequired,
      authorizationState: ready ? .completed : .manualEvidenceRequired,
      credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
      credentialRequirements: [requirement],
      secretReferenceIds: [tokenRef.id], accountLabel: account,
      connectedHandle: accountId?.providerConnectionNilIfEmpty,
      callbackURL: Self.defaultCallbackURL(for: app),
      requiredScopes: Self.clickUpRelayOwnedOAuthCapabilities, grantedScopes: capabilities,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: ready ? .ready : .degraded,
        message: ready
          ? "ClickUp OAuth is stored as a Keychain reference for \(workspaceIds.count) authorized Workspace(s); calls remain brokered by Relay."
          : reason, lastCheckedAt: timestamp, missingScopes: missing,
        unavailableTools: ready
          ? []
          : [
            "clickup.workspace.list", "clickup.task.get", "clickup.task.create",
            "clickup.task.update", "clickup.task.comment.create",
          ],
        diagnostics: [
          "provider": .string("clickup"),
          "authMethod": .string("clickup_relay_owned_oauth2_authorization_code"),
          "relayOwnedClickUpOAuth": .bool(true),
          "secretStorage": .string("keychain-reference-only"),
          "accountId": accountId?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
          "accountName": accountName?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
          "authorizedWorkspaceIds": .array(workspaceIds.map(JSONValue.string)),
          "authorizedWorkspaceNames": .array(
            authorizedWorkspaceNames.compactMap(\.providerConnectionNilIfEmpty).map(
              JSONValue.string)),
          "providerTokenExpires": .bool(false), "rawTokenStoredInDatabase": .bool(false),
          "rawProviderToolExposure": .bool(false),
        ], redactionStatus: "private-state-excluded"),
      senderIdentities: [], installPolicy: "approval_gated_clickup_task_writes",
      lastCheckedAt: timestamp,
      lastError: ready ? nil : reason, manualEvidenceNote: nil, reauthorizeRequired: !ready,
      disconnecting: false, betaBlocked: false,
      createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp,
      redactionStatus: "private-state-excluded"
    )
    return try saveConnection(context: context, connection: connection)
  }

  @discardableResult
  public func saveMondayRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String,
    userId: String?, userName: String?, accountId: String?, accountName: String?,
    accountSlug: String?,
    workspaceIds: [String], workspaceNames: [String], displayName: String? = nil,
    grantedScopes: [String] = ProviderConnectionService.mondayRelayOwnedOAuthScopes,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "monday-com")
    guard app.slug == "monday-com" else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "Monday.com OAuth can only be saved for the Monday.com Marketplace app.")
    }
    try validateAppCanAuthorize(app, context: context)
    let token = try requireNonEmptyString(
      accessToken, field: "Monday.com OAuth access token", maxLength: 20000)
    let scopes = grantedScopes.isEmpty ? Self.mondayRelayOwnedOAuthScopes : grantedScopes
    let missing = Self.mondayRelayOwnedOAuthScopes.filter { !scopes.contains($0) }
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let connectionId = existing?.id ?? createRelayId("mpc")
    for id in existing.map({ Self.secretReferenceIds(in: $0) }) ?? [] {
      _ = try? secrets.delete(id)
    }
    let tokenRef = try secrets.set(
      scope: "provider_connection", scopeId: connectionId, label: "Monday.com OAuth access token",
      secretValue: token)
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let ready = missing.isEmpty
    let account =
      displayName?.providerConnectionNilIfEmpty ?? accountName?.providerConnectionNilIfEmpty
      ?? userName?.providerConnectionNilIfEmpty
      ?? "Monday.com account"
    let requirement = ProviderCredentialRequirement(
      fieldKey: "monday_oauth_access_token", label: "Monday.com OAuth access token", required: true,
      userOwnedRequired: false, secretReferenceId: tokenRef.id, status: .verified,
      helpText: "Relay-owned Monday.com OAuth token stored as a Keychain reference.",
      redactionStatus: "secret-reference-only")
    let connection = MarketplaceProviderConnection(
      id: connectionId, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey:
        "monday-relay-owned-oauth:\(accountId?.providerConnectionNilIfEmpty ?? userId?.providerConnectionNilIfEmpty ?? connectionId)",
      providerName: "Monday.com",
      status: ready ? .connected : .authRequired,
      authorizationState: ready ? .completed : .manualEvidenceRequired,
      credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
      credentialRequirements: [requirement], secretReferenceIds: [tokenRef.id],
      accountLabel: account,
      connectedHandle: accountId?.providerConnectionNilIfEmpty
        ?? userId?.providerConnectionNilIfEmpty,
      callbackURL: Self.defaultCallbackURL(for: app),
      requiredScopes: Self.mondayRelayOwnedOAuthScopes, grantedScopes: scopes,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: ready ? .ready : .degraded,
        message: ready
          ? "Monday.com OAuth is stored as a Keychain reference; GraphQL calls remain brokered by Relay."
          : "Monday.com OAuth is missing scopes: \(missing.joined(separator: ", ")).",
        lastCheckedAt: timestamp, missingScopes: missing,
        unavailableTools: ready
          ? []
          : [
            "monday.board.list", "monday.item.get", "monday.item.create", "monday.item.update",
            "monday.item.comment.create",
          ],
        diagnostics: [
          "provider": .string("monday-com"),
          "authMethod": .string("monday_relay_owned_oauth2_authorization_code"),
          "relayOwnedMondayOAuth": .bool(true), "secretStorage": .string("keychain-reference-only"),
          "userId": userId?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
          "userName": userName?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
          "accountId": accountId?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
          "accountName": accountName?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
          "accountSlug": accountSlug?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
          "workspaceIds": .array(
            workspaceIds.compactMap(\.providerConnectionNilIfEmpty).map(JSONValue.string)),
          "workspaceNames": .array(
            workspaceNames.compactMap(\.providerConnectionNilIfEmpty).map(JSONValue.string)),
          "providerTokenExpires": .bool(false), "refreshTokenSupported": .bool(false),
          "rawTokenStoredInDatabase": .bool(false), "rawProviderToolExposure": .bool(false),
        ], redactionStatus: "private-state-excluded"),
      senderIdentities: [], installPolicy: "approval_gated_monday_item_writes",
      lastCheckedAt: timestamp,
      lastError: ready ? nil : "Missing Monday.com scopes: \(missing.joined(separator: ", "))",
      manualEvidenceNote: nil, reauthorizeRequired: !ready,
      disconnecting: false, betaBlocked: false, createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp, redactionStatus: "private-state-excluded"
    )
    return try saveConnection(context: context, connection: connection)
  }

  @discardableResult
  public func saveAirtableRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    userId: String?, userEmail: String?, grantId: String?, authorizedBaseIds: [String],
    authorizedBaseNames: [String], authorizedWorkspaceNames: [String],
    expiresAt: String?, displayName: String? = nil,
    grantedScopes: [String] = ProviderConnectionService.airtableRelayOwnedOAuthScopes,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "airtable")
    guard app.slug == "airtable" else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "Airtable OAuth can only be saved for the Airtable Marketplace app.")
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "Airtable OAuth access token", maxLength: 20000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "Airtable OAuth refresh token", maxLength: 20000)
    let scopes = grantedScopes.isEmpty ? Self.airtableRelayOwnedOAuthScopes : grantedScopes
    let missing = Self.airtableRelayOwnedOAuthScopes.filter { !scopes.contains($0) }
    let ready = missing.isEmpty
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let connectionId = existing?.id ?? createRelayId("mpc")
    let oldRefs = existing.map(Self.secretReferenceIds(in:)) ?? []
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: connectionId, label: "Airtable OAuth access token",
      secretValue: access)
    let refreshRef: SecretReference
    do {
      refreshRef = try secrets.set(
        scope: "provider_connection", scopeId: connectionId,
        label: "Airtable rotating OAuth refresh token", secretValue: refresh)
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let account =
      displayName?.providerConnectionNilIfEmpty ?? userEmail?.providerConnectionNilIfEmpty
      ?? authorizedBaseNames.first?.providerConnectionNilIfEmpty
      ?? "Airtable account"
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "airtable_oauth_access_token", label: "Airtable OAuth access token",
        required: true, userOwnedRequired: false, secretReferenceId: accessRef.id,
        status: .verified,
        helpText: "60-minute Airtable access token stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "airtable_oauth_refresh_token", label: "Airtable rotating refresh token",
        required: true, userOwnedRequired: false, secretReferenceId: refreshRef.id,
        status: .verified,
        helpText:
          "Single-use rotating refresh token stored as a Keychain reference and replaced atomically after refresh.",
        redactionStatus: "secret-reference-only"),
    ]
    let connection = MarketplaceProviderConnection(
      id: connectionId, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey:
        "airtable-relay-owned-oauth:\(grantId?.providerConnectionNilIfEmpty ?? userId?.providerConnectionNilIfEmpty ?? connectionId)",
      providerName: "Airtable", status: ready ? .connected : .authRequired,
      authorizationState: ready ? .completed : .manualEvidenceRequired,
      credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
      credentialRequirements: requirements, secretReferenceIds: [accessRef.id, refreshRef.id],
      accountLabel: account,
      connectedHandle: userId?.providerConnectionNilIfEmpty
        ?? userEmail?.providerConnectionNilIfEmpty,
      callbackURL: Self.defaultCallbackURL(for: app),
      requiredScopes: Self.airtableRelayOwnedOAuthScopes, grantedScopes: scopes,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: ready ? .ready : .degraded,
        message: ready
          ? "Airtable OAuth access and rotating refresh tokens are stored as Keychain references; REST calls remain brokered by Relay."
          : "Airtable OAuth is missing scopes: \(missing.joined(separator: ", ")).",
        lastCheckedAt: timestamp, missingScopes: missing,
        unavailableTools: ready
          ? []
          : [
            "airtable.base.list", "airtable.record.get", "airtable.record.create",
            "airtable.record.update", "airtable.record.comment.create",
          ],
        diagnostics: [
          "provider": .string("airtable"),
          "authMethod": .string("airtable_relay_owned_oauth2_pkce_rotating_refresh"),
          "relayOwnedAirtableOAuth": .bool(true),
          "secretStorage": .string("keychain-reference-only"),
          "refreshTokenRotation": .string("single-use-atomic-replacement-required"),
          "userId": userId?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
          "userEmail": userEmail?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
          "grantId": grantId?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
          "authorizedBaseIds": .array(
            authorizedBaseIds.compactMap(\.providerConnectionNilIfEmpty).map(JSONValue.string)),
          "authorizedBaseNames": .array(
            authorizedBaseNames.compactMap(\.providerConnectionNilIfEmpty).map(JSONValue.string)),
          "authorizedWorkspaceNames": .array(
            authorizedWorkspaceNames.compactMap(\.providerConnectionNilIfEmpty).map(
              JSONValue.string)),
          "expiresAt": expiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
          "accessTokenLifetimeSeconds": .number(3600), "refreshTokenMaximumAgeDays": .number(60),
          "rawTokenStoredInDatabase": .bool(false), "rawProviderToolExposure": .bool(false),
        ], redactionStatus: "private-state-excluded"), senderIdentities: [],
      installPolicy: "approval_gated_airtable_record_writes", lastCheckedAt: timestamp,
      lastError: ready ? nil : "Missing Airtable scopes: \(missing.joined(separator: ", "))",
      manualEvidenceNote: nil, reauthorizeRequired: !ready, disconnecting: false,
      betaBlocked: false, createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp,
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

  @discardableResult
  public func rotateAirtableOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String, expiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    airtableTokenRotationLock.lock()
    defer { airtableTokenRotationLock.unlock() }
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    guard
      let existing = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      existing.appSlug == "airtable"
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Airtable connection is required for token rotation.")
    }
    let oldAccess = existing.health.diagnostics["userId"]?.string
    let oldEmail = existing.health.diagnostics["userEmail"]?.string
    let grant = existing.health.diagnostics["grantId"]?.string
    func strings(_ key: String) -> [String] {
      if case .array(let values)? = existing.health.diagnostics[key] {
        return values.compactMap(\.string)
      }
      return []
    }
    return try saveAirtableRelayOwnedOAuthConnection(
      context: context, appIdOrSlug: existing.appId, accessToken: accessToken,
      refreshToken: refreshToken, userId: oldAccess, userEmail: oldEmail, grantId: grant,
      authorizedBaseIds: strings("authorizedBaseIds"),
      authorizedBaseNames: strings("authorizedBaseNames"),
      authorizedWorkspaceNames: strings("authorizedWorkspaceNames"), expiresAt: expiresAt,
      displayName: existing.accountLabel, grantedScopes: existing.grantedScopes, now: now)
  }

  @discardableResult
  public func saveDropboxRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    accountId: String?, email: String?, displayName: String?, accountType: String?,
    rootNamespaceId: String?,
    expiresAt: String?,
    grantedScopes: [String] = ProviderConnectionService.dropboxRelayOwnedOAuthScopes,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "dropbox")
    guard app.slug == "dropbox" else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "Dropbox OAuth can only be saved for the Dropbox Marketplace app.")
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "Dropbox OAuth access token", maxLength: 20000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "Dropbox OAuth refresh token", maxLength: 20000)
    let scopes = grantedScopes.isEmpty ? Self.dropboxRelayOwnedOAuthScopes : grantedScopes
    let missing = Self.dropboxRelayOwnedOAuthScopes.filter { !scopes.contains($0) }
    let ready = missing.isEmpty
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let connectionId = existing?.id ?? createRelayId("mpc")
    let oldRefs = existing.map(Self.secretReferenceIds(in:)) ?? []
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: connectionId, label: "Dropbox OAuth access token",
      secretValue: access)
    let refreshRef: SecretReference
    do {
      refreshRef = try secrets.set(
        scope: "provider_connection", scopeId: connectionId, label: "Dropbox OAuth refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let account =
      displayName?.providerConnectionNilIfEmpty ?? email?.providerConnectionNilIfEmpty
      ?? "Dropbox account"
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "dropbox_oauth_access_token", label: "Dropbox OAuth access token", required: true,
        userOwnedRequired: false, secretReferenceId: accessRef.id, status: .verified,
        helpText: "Short-lived Dropbox access token stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "dropbox_oauth_refresh_token", label: "Dropbox OAuth refresh token",
        required: true, userOwnedRequired: false, secretReferenceId: refreshRef.id,
        status: .verified,
        helpText:
          "Offline refresh token stored as a Keychain reference and used to replace expired access tokens.",
        redactionStatus: "secret-reference-only"),
    ]
    let connection = MarketplaceProviderConnection(
      id: connectionId, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey:
        "dropbox-relay-owned-oauth:\(accountId?.providerConnectionNilIfEmpty ?? connectionId)",
      providerName: "Dropbox", status: ready ? .connected : .authRequired,
      authorizationState: ready ? .completed : .manualEvidenceRequired,
      credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
      credentialRequirements: requirements, secretReferenceIds: [accessRef.id, refreshRef.id],
      accountLabel: account,
      connectedHandle: email?.providerConnectionNilIfEmpty
        ?? accountId?.providerConnectionNilIfEmpty,
      callbackURL: Self.defaultCallbackURL(for: app),
      requiredScopes: Self.dropboxRelayOwnedOAuthScopes, grantedScopes: scopes,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: ready ? .ready : .degraded,
        message: ready
          ? "Dropbox OAuth access and refresh tokens are stored as Keychain references; API v2 calls remain brokered by Relay."
          : "Dropbox OAuth is missing scopes: \(missing.joined(separator: ", ")).",
        lastCheckedAt: timestamp, missingScopes: missing,
        unavailableTools: ready
          ? []
          : [
            "dropbox.folder.list", "dropbox.entry.get", "dropbox.file.search",
            "dropbox.text.upload",
          ],
        diagnostics: [
          "provider": .string("dropbox"),
          "authMethod": .string("dropbox_relay_owned_oauth2_pkce_offline"),
          "relayOwnedDropboxOAuth": .bool(true), "contentAccess": .string("full_dropbox"),
          "secretStorage": .string("keychain-reference-only"),
          "accountId": accountId?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
          "email": email?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
          "displayName": displayName?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
          "accountType": accountType?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
          "rootNamespaceId": rootNamespaceId?.providerConnectionNilIfEmpty.map(JSONValue.string)
            ?? .null,
          "expiresAt": expiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
          "rawTokenStoredInDatabase": .bool(false), "rawProviderToolExposure": .bool(false),
        ], redactionStatus: "private-state-excluded"), senderIdentities: [],
      installPolicy: "approval_gated_dropbox_entry_writes", lastCheckedAt: timestamp,
      lastError: ready ? nil : "Missing Dropbox scopes: \(missing.joined(separator: ", "))",
      manualEvidenceNote: nil, reauthorizeRequired: !ready, disconnecting: false,
      betaBlocked: false, createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp,
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

  @discardableResult
  public func refreshDropboxOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String? = nil, expiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    dropboxTokenRefreshLock.lock()
    defer { dropboxTokenRefreshLock.unlock() }
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    guard
      let existing = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId), existing.appSlug == "dropbox"
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Dropbox connection is required for token refresh.")
    }
    let oldRefreshRef = existing.credentialRequirements.first {
      $0.fieldKey == "dropbox_oauth_refresh_token"
    }?.secretReferenceId
    guard let oldRefreshRef, let retainedRefresh = try? secrets.getSecretValue(oldRefreshRef) else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Dropbox refresh token is unavailable; reconnect Dropbox.")
    }
    let diagnostics = existing.health.diagnostics
    return try saveDropboxRelayOwnedOAuthConnection(
      context: context, appIdOrSlug: existing.appId, accessToken: accessToken,
      refreshToken: refreshToken?.providerConnectionNilIfEmpty ?? retainedRefresh,
      accountId: diagnostics["accountId"]?.string, email: diagnostics["email"]?.string,
      displayName: existing.accountLabel, accountType: diagnostics["accountType"]?.string,
      rootNamespaceId: diagnostics["rootNamespaceId"]?.string, expiresAt: expiresAt,
      grantedScopes: existing.grantedScopes, now: now)
  }

  @discardableResult
  public func saveBoxRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    userId: String?, login: String?, displayName: String?, enterpriseId: String?,
    enterpriseName: String?, expiresAt: String?,
    grantedScopes: [String] = ProviderConnectionService.boxRelayOwnedOAuthScopes, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "box")
    guard app.slug == "box" else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Box OAuth can only be saved for the Box Marketplace app.")
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "Box OAuth access token", maxLength: 20000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "Box OAuth refresh token", maxLength: 20000)
    let scopes = grantedScopes.isEmpty ? Self.boxRelayOwnedOAuthScopes : grantedScopes
    let missing = Self.boxRelayOwnedOAuthScopes.filter { !scopes.contains($0) }
    let ready = missing.isEmpty
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let connectionId = existing?.id ?? createRelayId("mpc")
    let oldRefs = existing.map(Self.secretReferenceIds(in:)) ?? []
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: connectionId, label: "Box OAuth access token",
      secretValue: access)
    let refreshRef: SecretReference
    do {
      refreshRef = try secrets.set(
        scope: "provider_connection", scopeId: connectionId,
        label: "Box rotating OAuth refresh token", secretValue: refresh)
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let account =
      displayName?.providerConnectionNilIfEmpty ?? login?.providerConnectionNilIfEmpty
      ?? "Box account"
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "box_oauth_access_token", label: "Box OAuth access token", required: true,
        userOwnedRequired: false, secretReferenceId: accessRef.id, status: .verified,
        helpText: "Short-lived Box access token stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "box_oauth_refresh_token", label: "Box rotating refresh token", required: true,
        userOwnedRequired: false, secretReferenceId: refreshRef.id, status: .verified,
        helpText: "Single-use 60-day Box refresh token replaced atomically after refresh.",
        redactionStatus: "secret-reference-only"),
    ]
    let connection = MarketplaceProviderConnection(
      id: connectionId, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "box-relay-owned-oauth:"
        + (userId?.providerConnectionNilIfEmpty ?? connectionId),
      providerName: "Box", status: ready ? .connected : .authRequired,
      authorizationState: ready ? .completed : .manualEvidenceRequired,
      credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
      credentialRequirements: requirements, secretReferenceIds: [accessRef.id, refreshRef.id],
      accountLabel: account,
      connectedHandle: login?.providerConnectionNilIfEmpty ?? userId?.providerConnectionNilIfEmpty,
      callbackURL: Self.defaultCallbackURL(for: app), requiredScopes: Self.boxRelayOwnedOAuthScopes,
      grantedScopes: scopes, selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: ready ? .ready : .degraded,
        message: ready
          ? "Box OAuth access and rotating refresh tokens are stored as Keychain references; API calls remain brokered by Relay."
          : "Box OAuth is missing required root_readwrite scope.", lastCheckedAt: timestamp,
        missingScopes: missing,
        unavailableTools: ready
          ? [] : ["box.folder.items", "box.file.get", "box.content.search", "box.text.upload"],
        diagnostics: [
          "provider": .string("box"),
          "authMethod": .string("box_relay_owned_oauth2_confidential_rotating_refresh"),
          "relayOwnedBoxOAuth": .bool(true), "secretStorage": .string("keychain-reference-only"),
          "refreshTokenRotation": .string("single-use-atomic-replacement-required"),
          "userId": userId?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
          "login": login?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
          "enterpriseId": enterpriseId?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
          "enterpriseName": enterpriseName?.providerConnectionNilIfEmpty.map(JSONValue.string)
            ?? .null,
          "expiresAt": expiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
          "rawTokenStoredInDatabase": .bool(false), "rawProviderToolExposure": .bool(false),
          "asUserImpersonation": .bool(false),
        ], redactionStatus: "private-state-excluded"), senderIdentities: [],
      installPolicy: "approval_gated_box_item_writes", lastCheckedAt: timestamp,
      lastError: ready ? nil : "Missing Box scope: root_readwrite", manualEvidenceNote: nil,
      reauthorizeRequired: !ready, disconnecting: false, betaBlocked: false,
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

  @discardableResult
  public func rotateBoxOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String, expiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    boxTokenRotationLock.lock()
    defer { boxTokenRotationLock.unlock() }
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    guard
      let existing = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId), existing.appSlug == "box"
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Box connection is required for token rotation.")
    }
    let d = existing.health.diagnostics
    return try saveBoxRelayOwnedOAuthConnection(
      context: context, appIdOrSlug: existing.appId, accessToken: accessToken,
      refreshToken: refreshToken, userId: d["userId"]?.string, login: d["login"]?.string,
      displayName: existing.accountLabel, enterpriseId: d["enterpriseId"]?.string,
      enterpriseName: d["enterpriseName"]?.string, expiresAt: expiresAt,
      grantedScopes: existing.grantedScopes, now: now)
  }

  @discardableResult
  public func saveFigmaRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    userId: String?, handle: String?, email: String?, expiresAt: String?,
    grantedScopes: [String] = ProviderConnectionService.figmaRelayOwnedOAuthScopes,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "figma")
    guard app.slug == "figma" else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Figma OAuth can only be saved for the Figma Marketplace app.")
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "Figma OAuth access token", maxLength: 20000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "Figma OAuth refresh token", maxLength: 20000)
    let scopes = grantedScopes.isEmpty ? Self.figmaRelayOwnedOAuthScopes : grantedScopes
    let missing = Self.figmaRelayOwnedOAuthScopes.filter { !scopes.contains($0) }
    let ready = missing.isEmpty
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let oldRefs = existing.map(Self.secretReferenceIds(in:)) ?? []
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Figma OAuth access token",
      secretValue: access)
    let refreshRef: SecretReference
    do {
      refreshRef = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Figma reusable OAuth refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let account =
      handle?.providerConnectionNilIfEmpty ?? email?.providerConnectionNilIfEmpty ?? "Figma user"
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "figma_oauth_access_token", label: "Figma OAuth access token", required: true,
        userOwnedRequired: false, secretReferenceId: accessRef.id, status: .verified,
        helpText: "Current Figma access token stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "figma_oauth_refresh_token", label: "Figma OAuth refresh token", required: true,
        userOwnedRequired: false, secretReferenceId: refreshRef.id, status: .verified,
        helpText: "Reusable Figma refresh token stored as a stable Keychain reference.",
        redactionStatus: "secret-reference-only"),
    ]
    let c = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "figma-relay-owned-oauth:" + (userId?.providerConnectionNilIfEmpty ?? id),
      providerName: "Figma",
      status: ready ? .connected : .authRequired,
      authorizationState: ready ? .completed : .manualEvidenceRequired,
      credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
      credentialRequirements: requirements, secretReferenceIds: [accessRef.id, refreshRef.id],
      accountLabel: account,
      connectedHandle: email?.providerConnectionNilIfEmpty ?? handle?.providerConnectionNilIfEmpty,
      callbackURL: Self.defaultCallbackURL(for: app),
      requiredScopes: Self.figmaRelayOwnedOAuthScopes, grantedScopes: scopes,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: ready ? .ready : .degraded,
        message: ready
          ? "Figma OAuth tokens are stored as Keychain references; task-scoped file calls remain brokered by Relay."
          : "Figma OAuth is missing scopes: " + missing.joined(separator: ", "),
        lastCheckedAt: timestamp, missingScopes: missing,
        unavailableTools: ready
          ? []
          : [
            "figma.file.metadata", "figma.file.nodes", "figma.file.comments",
            "figma.comment.create",
          ],
        diagnostics: [
          "provider": .string("figma"),
          "authMethod": .string("figma_relay_owned_oauth2_reusable_refresh"),
          "relayOwnedFigmaOAuth": .bool(true),
          "refreshTokenReuse": .string("reusable-stable-reference"),
          "taskScopedFileKeysOnly": .bool(true), "projectDiscoverySupported": .bool(false),
          "userId": userId?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
          "handle": handle?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
          "email": email?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
          "expiresAt": expiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
          "rawTokenStoredInDatabase": .bool(false), "rawProviderToolExposure": .bool(false),
        ], redactionStatus: "private-state-excluded"), senderIdentities: [],
      installPolicy: "approval_gated_figma_comment_writes", lastCheckedAt: timestamp,
      lastError: ready ? nil : "Missing Figma scopes: " + missing.joined(separator: ", "),
      manualEvidenceNote: nil, reauthorizeRequired: !ready, disconnecting: false,
      betaBlocked: false, createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp,
      redactionStatus: "private-state-excluded")
    do {
      let saved = try saveConnection(context: context, connection: c)
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

  @discardableResult
  public func refreshFigmaOAuthAccessToken(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String, expiresAt: String?,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    figmaTokenRefreshLock.lock()
    defer { figmaTokenRefreshLock.unlock() }
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    guard
      var c = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId), c.appSlug == "figma",
      let oldAccess = c.credentialRequirements.first(where: {
        $0.fieldKey == "figma_oauth_access_token"
      })?.secretReferenceId,
      let refreshRef = c.credentialRequirements.first(where: {
        $0.fieldKey == "figma_oauth_refresh_token"
      })?.secretReferenceId, (try? secrets.getSecretValue(refreshRef)) != nil
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Figma connection and reusable refresh token are required.")
    }
    let access = try requireNonEmptyString(
      accessToken, field: "Figma OAuth access token", maxLength: 20000)
    let newRef = try secrets.set(
      scope: "provider_connection", scopeId: connectionId, label: "Figma OAuth access token",
      secretValue: access)
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    c.credentialRequirements = c.credentialRequirements.map {
      var r = $0
      if r.fieldKey == "figma_oauth_access_token" { r.secretReferenceId = newRef.id }
      return r
    }
    c.secretReferenceIds = [newRef.id, refreshRef]
    c.health.diagnostics["expiresAt"] =
      expiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null
    c.health.lastCheckedAt = timestamp
    c.lastCheckedAt = timestamp
    c.updatedAt = timestamp
    do {
      let saved = try saveConnection(context: context, connection: c)
      _ = try? secrets.delete(oldAccess)
      return saved
    } catch {
      _ = try? secrets.delete(newRef.id)
      throw error
    }
  }

  @discardableResult
  public func saveMiroRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    userId: String?, teamId: String?, accountLabel: String?, expiresAt: String?,
    grantedScopes: [String] = ProviderConnectionService.miroRelayOwnedOAuthScopes,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "miro")
    guard app.slug == "miro" else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Miro OAuth can only be saved for the Miro Marketplace app.")
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "Miro OAuth access token", maxLength: 20000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "Miro OAuth refresh token", maxLength: 20000)
    let scopes = grantedScopes.isEmpty ? Self.miroRelayOwnedOAuthScopes : grantedScopes
    let missing = Self.miroRelayOwnedOAuthScopes.filter { !scopes.contains($0) }
    let ready = missing.isEmpty
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let oldRefs = existing.map(Self.secretReferenceIds(in:)) ?? []
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Miro OAuth access token",
      secretValue: access)
    let refreshRef: SecretReference
    do {
      refreshRef = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Miro rotating OAuth refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let label =
      accountLabel?.providerConnectionNilIfEmpty ?? teamId?.providerConnectionNilIfEmpty.map {
        "Miro team " + $0
      } ?? "Miro team"
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "miro_oauth_access_token", label: "Miro OAuth access token", required: true,
        userOwnedRequired: false, secretReferenceId: accessRef.id, status: .verified,
        helpText: "Short-lived Miro access token stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "miro_oauth_refresh_token", label: "Miro rotating refresh token", required: true,
        userOwnedRequired: false, secretReferenceId: refreshRef.id, status: .verified,
        helpText:
          "Rotating Miro refresh token replaced atomically with the access token after refresh.",
        redactionStatus: "secret-reference-only"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "miro-relay-owned-oauth:"
        + (teamId?.providerConnectionNilIfEmpty ?? userId?.providerConnectionNilIfEmpty ?? id),
      providerName: "Miro", status: ready ? .connected : .authRequired,
      authorizationState: ready ? .completed : .manualEvidenceRequired,
      credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
      credentialRequirements: requirements, secretReferenceIds: [accessRef.id, refreshRef.id],
      accountLabel: label,
      connectedHandle: teamId?.providerConnectionNilIfEmpty ?? userId?.providerConnectionNilIfEmpty,
      callbackURL: Self.defaultCallbackURL(for: app),
      requiredScopes: Self.miroRelayOwnedOAuthScopes, grantedScopes: scopes,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: ready ? .ready : .degraded,
        message: ready
          ? "Miro OAuth access and rotating refresh tokens are stored as Keychain references; REST v2 calls remain brokered by Relay."
          : "Miro OAuth is missing scopes: " + missing.joined(separator: ", "),
        lastCheckedAt: timestamp, missingScopes: missing,
        unavailableTools: ready
          ? []
          : ["miro.board.list", "miro.board.items", "miro.sticky_note.create", "miro.item.update"],
        diagnostics: [
          "provider": .string("miro"),
          "authMethod": .string("miro_relay_owned_oauth2_rotating_refresh"),
          "relayOwnedMiroOAuth": .bool(true), "secretStorage": .string("keychain-reference-only"),
          "refreshTokenRotation": .string("serialized-atomic-two-reference-replacement"),
          "userId": userId?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
          "teamId": teamId?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
          "expiresAt": expiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
          "accessTokenLifetimeSeconds": .number(3600), "refreshTokenMaximumAgeDays": .number(60),
          "rawTokenStoredInDatabase": .bool(false), "rawProviderToolExposure": .bool(false),
        ], redactionStatus: "private-state-excluded"), senderIdentities: [],
      installPolicy: "approval_gated_miro_board_item_writes", lastCheckedAt: timestamp,
      lastError: ready ? nil : "Missing Miro scopes: " + missing.joined(separator: ", "),
      manualEvidenceNote: nil, reauthorizeRequired: !ready, disconnecting: false,
      betaBlocked: false, createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp,
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

  @discardableResult
  public func rotateMiroOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String, expiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    miroTokenRotationLock.lock()
    defer { miroTokenRotationLock.unlock() }
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    guard
      let existing = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId), existing.appSlug == "miro"
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Miro connection is required for token rotation.")
    }
    let diagnostics = existing.health.diagnostics
    return try saveMiroRelayOwnedOAuthConnection(
      context: context, appIdOrSlug: existing.appId, accessToken: accessToken,
      refreshToken: refreshToken, userId: diagnostics["userId"]?.string,
      teamId: diagnostics["teamId"]?.string, accountLabel: existing.accountLabel,
      expiresAt: expiresAt, grantedScopes: existing.grantedScopes, now: now)
  }

  @discardableResult
  public func saveCanvaRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    userId: String?, teamId: String?, accountLabel: String?, expiresAt: String?,
    grantedScopes: [String] = ProviderConnectionService.canvaRelayOwnedOAuthScopes,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "canva")
    guard app.slug == "canva" else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Canva OAuth can only be saved for the Canva Marketplace app.")
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "Canva OAuth access token", maxLength: 20000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "Canva OAuth refresh token", maxLength: 20000)
    let scopes = grantedScopes.isEmpty ? Self.canvaRelayOwnedOAuthScopes : grantedScopes
    let missing = Self.canvaRelayOwnedOAuthScopes.filter { !scopes.contains($0) }
    let ready = missing.isEmpty
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let oldRefs = existing.map(Self.secretReferenceIds(in:)) ?? []
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Canva OAuth access token",
      secretValue: access)
    let refreshRef: SecretReference
    do {
      refreshRef = try secrets.set(
        scope: "provider_connection", scopeId: id,
        label: "Canva single-use rotating OAuth refresh token", secretValue: refresh)
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    let railwayOrigin = RelayCloudLaunchContract.configuredRailwayOrigin
    let callback = railwayOrigin.map { $0 + "/api/v1/oauth/canva/callback" }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let label =
      accountLabel?.providerConnectionNilIfEmpty ?? teamId?.providerConnectionNilIfEmpty.map {
        "Canva team " + $0
      } ?? "Canva team"
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "canva_oauth_access_token", label: "Canva OAuth access token", required: true,
        userOwnedRequired: false, secretReferenceId: accessRef.id, status: .verified,
        helpText: "Current Canva access token stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "canva_oauth_refresh_token", label: "Canva rotating refresh token",
        required: true, userOwnedRequired: false, secretReferenceId: refreshRef.id,
        status: .verified,
        helpText: "Single-use Canva refresh token atomically replaced with the access token.",
        redactionStatus: "secret-reference-only"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "canva-relay-owned-oauth:"
        + (teamId?.providerConnectionNilIfEmpty ?? userId?.providerConnectionNilIfEmpty ?? id),
      providerName: "Canva", status: ready ? .connected : .authRequired,
      authorizationState: ready ? .completed : .manualEvidenceRequired,
      credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
      credentialRequirements: requirements, secretReferenceIds: [accessRef.id, refreshRef.id],
      accountLabel: label,
      connectedHandle: teamId?.providerConnectionNilIfEmpty ?? userId?.providerConnectionNilIfEmpty,
      callbackURL: callback, requiredScopes: Self.canvaRelayOwnedOAuthScopes, grantedScopes: scopes,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: ready ? .ready : .degraded,
        message: ready
          ? "Canva OAuth references are ready; stable Connect API calls remain brokered by Relay."
          : "Canva OAuth is missing scopes: " + missing.joined(separator: ", "),
        lastCheckedAt: timestamp, missingScopes: missing,
        unavailableTools: ready
          ? [] : ["canva.design.list", "canva.folder.items", "canva.design.create"],
        diagnostics: [
          "provider": .string("canva"),
          "authMethod": .string("canva_relay_owned_oauth2_pkce_backend_rotating_refresh"),
          "relayOwnedCanvaOAuth": .bool(true), "secretStorage": .string("keychain-reference-only"),
          "refreshTokenRotation": .string("single-use-serialized-atomic-two-reference-replacement"),
          "requiresSecureWebBackend": .bool(true),
          "productionCallbackConfigured": .bool(callback != nil),
          "callbackTransport": .string("railway-https-only"), "previewApisAllowed": .bool(false),
          "userId": userId?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
          "teamId": teamId?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
          "expiresAt": expiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
          "accessTokenLifetimeSecondsCurrent": .number(14400),
          "rawTokenStoredInDatabase": .bool(false), "rawProviderToolExposure": .bool(false),
        ], redactionStatus: "private-state-excluded"), senderIdentities: [],
      installPolicy: "approval_gated_canva_stable_design_create", lastCheckedAt: timestamp,
      lastError: ready ? nil : "Missing Canva scopes: " + missing.joined(separator: ", "),
      manualEvidenceNote: callback == nil
        ? "Production Canva consent requires CLAWCHAT_RAILWAY_ORIGIN and a deployed HTTPS callback broker."
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

  @discardableResult
  public func rotateCanvaOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String, expiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    canvaTokenRotationLock.lock()
    defer { canvaTokenRotationLock.unlock() }
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    guard
      let existing = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId), existing.appSlug == "canva"
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Canva connection is required for token rotation.")
    }
    let d = existing.health.diagnostics
    return try saveCanvaRelayOwnedOAuthConnection(
      context: context, appIdOrSlug: existing.appId, accessToken: accessToken,
      refreshToken: refreshToken, userId: d["userId"]?.string, teamId: d["teamId"]?.string,
      accountLabel: existing.accountLabel, expiresAt: expiresAt,
      grantedScopes: existing.grantedScopes, now: now)
  }
}
