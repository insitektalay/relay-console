import Foundation

extension ProviderConnectionService {
  @discardableResult public func saveHightouchAPIKeyConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, apiKey: String, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "hightouch")
    guard app.slug == "hightouch" else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Hightouch credentials can only be saved for Hightouch.")
    }
    try validateAppCanAuthorize(app, context: context)
    let key = try requireNonEmptyString(apiKey, field: "Hightouch API key", maxLength: 30000)
    guard !key.contains("\n"), !key.contains("\r") else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Hightouch requires a valid API key.")
    }
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let old = existing.map(Self.secretReferenceIds(in:)) ?? []
    let keyRef = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Hightouch API key", secretValue: key)
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "hightouch_api_key", label: "Hightouch API key", required: true,
        userOwnedRequired: true, secretReferenceId: keyRef.id, status: .verified,
        helpText: "Separate Admin-created workspace API key stored as a Keychain reference.",
        redactionStatus: "secret-reference-only")
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "hightouch:workspace-api-key", providerName: "Hightouch", status: .connected,
      authorizationState: .completed, credentialOwnership: .userOwned,
      userOwnedCredentialsRequired: true, credentialRequirements: requirements,
      secretReferenceIds: [keyRef.id], accountLabel: "Hightouch workspace",
      connectedHandle: "hightouch:workspace", callbackURL: nil, requiredScopes: [],
      grantedScopes: [], selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message: "Hightouch API key is syntax-valid and ready for model-list validation.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("hightouch"),
          "authMethod": .string("customer_owned_admin_created_api_key"),
          "apiOrigin": .string("https://api.hightouch.com"), "apiPath": .string("/api/v1/models"),
          "apiKeyReadWriteAuthority": .bool(true), "readOnlyV1": .bool(true),
          "modelIdentityReturned": .bool(false), "customerDataReturned": .bool(false),
          "writesEnabled": .bool(false), "automaticPagination": .bool(false),
          "automaticRetry": .bool(false), "responseCapBytes": .number(1_000_000),
          "providerRequestsPerTenSeconds": .number(200),
          "rawCredentialStoredInDatabase": .bool(false),
        ],
        redactionStatus:
          "model-identity-definition-query-source-destination-sync-run-and-customer-data-excluded"),
      senderIdentities: [], installPolicy: "approval_gated_hightouch_model_readiness",
      lastCheckedAt: timestamp, lastError: nil,
      manualEvidenceNote:
        "Hightouch requires an eligible workspace, separate Admin-created API key, host allowlisting compatibility, and live acceptance. The provider key has broader read/write authority than this read-only wrapper.",
      reauthorizeRequired: false, disconnecting: false, betaBlocked: false,
      createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp,
      redactionStatus:
        "model-identity-definition-query-source-destination-sync-run-and-customer-data-excluded")
    do {
      let saved = try saveConnection(context: context, connection: connection)
      for oldRef in old where !saved.secretReferenceIds.contains(oldRef) {
        _ = try? secrets.delete(oldRef)
      }
      return saved
    } catch {
      _ = try? secrets.delete(keyRef.id)
      throw error
    }
  }
  @discardableResult public func saveCensusWorkspaceAPIKeyConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, apiKey: String, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "census")
    guard app.slug == "census" else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Census credentials can only be saved for Census.")
    }
    try validateAppCanAuthorize(app, context: context)
    let key = try requireNonEmptyString(apiKey, field: "Census workspace API key", maxLength: 30000)
    guard !key.contains("\n"), !key.contains("\r") else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Census requires a valid workspace API key.")
    }
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let old = existing.map(Self.secretReferenceIds(in:)) ?? []
    let keyRef = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Census workspace API key", secretValue: key
    )
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "census_api_key", label: "Census workspace API key", required: true,
        userOwnedRequired: true, secretReferenceId: keyRef.id, status: .verified,
        helpText: "Separate workspace-scoped API key stored as a Keychain reference.",
        redactionStatus: "secret-reference-only")
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "census:workspace-api-key", providerName: "Census", status: .connected,
      authorizationState: .completed, credentialOwnership: .userOwned,
      userOwnedCredentialsRequired: true, credentialRequirements: requirements,
      secretReferenceIds: [keyRef.id], accountLabel: "Census workspace",
      connectedHandle: "census:workspace", callbackURL: nil, requiredScopes: [], grantedScopes: [],
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message: "Census workspace API key is syntax-valid and ready for dataset-list validation.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("census"), "authMethod": .string("customer_owned_workspace_api_key"),
          "apiOrigin": .string("https://app.getcensus.com"),
          "apiPath": .string("/api/v1/datasets?page=1&per_page=1&order=desc"),
          "workspaceBound": .bool(true), "readOnlyV1": .bool(true),
          "datasetIdentityReturned": .bool(false), "sqlReturned": .bool(false),
          "customerDataReturned": .bool(false), "writesEnabled": .bool(false),
          "automaticPagination": .bool(false), "automaticRetry": .bool(false),
          "responseCapBytes": .number(1_000_000), "rawCredentialStoredInDatabase": .bool(false),
        ],
        redactionStatus:
          "dataset-identity-query-source-sync-destination-run-and-customer-data-excluded"),
      senderIdentities: [], installPolicy: "approval_gated_census_dataset_readiness",
      lastCheckedAt: timestamp, lastError: nil,
      manualEvidenceNote:
        "Census/Fivetran Activations requires an eligible workspace, separate workspace API key, correct access and network-policy confirmation, rotation/revocation ownership, and live acceptance.",
      reauthorizeRequired: false, disconnecting: false, betaBlocked: false,
      createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp,
      redactionStatus:
        "dataset-identity-query-source-sync-destination-run-and-customer-data-excluded")
    do {
      let saved = try saveConnection(context: context, connection: connection)
      for oldRef in old where !saved.secretReferenceIds.contains(oldRef) {
        _ = try? secrets.delete(oldRef)
      }
      return saved
    } catch {
      _ = try? secrets.delete(keyRef.id)
      throw error
    }
  }
  @discardableResult public func saveClioManageRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    accessExpiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "clio-manage")
    guard app.slug == "clio-manage" else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Clio Manage OAuth can only be saved for Clio Manage.")
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "Clio Manage OAuth access token", maxLength: 30000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "Clio Manage OAuth refresh token", maxLength: 30000)
    guard !access.contains("\n"), !access.contains("\r"), !refresh.contains("\n"),
      !refresh.contains("\r")
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Clio Manage requires valid OAuth tokens.")
    }
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let old = existing.map(Self.secretReferenceIds(in:)) ?? []
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Clio Manage OAuth access token",
      secretValue: access)
    let refreshRef: SecretReference
    do {
      refreshRef = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Clio Manage OAuth refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    let railway = RelayCloudLaunchContract.configuredRailwayOrigin
    let callback = railway.map { $0 + "/api/v1/marketplace/oauth/clio-manage/callback" }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "clio_manage_oauth_access_token", label: "Clio Manage OAuth access token",
        required: true, userOwnedRequired: false, secretReferenceId: accessRef.id,
        status: .verified,
        helpText: "Provider-expiring access token stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "clio_manage_oauth_refresh_token", label: "Clio Manage OAuth refresh token",
        required: true, userOwnedRequired: false, secretReferenceId: refreshRef.id,
        status: .verified,
        helpText:
          "Non-expiring provider refresh token stored separately and deauthorized upstream on disconnect.",
        redactionStatus: "secret-reference-only"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "clio-manage-us-oauth", providerName: "Clio Manage", status: .connected,
      authorizationState: .completed, credentialOwnership: .relayOwned,
      userOwnedCredentialsRequired: false, credentialRequirements: requirements,
      secretReferenceIds: [accessRef.id, refreshRef.id], accountLabel: "Clio Manage US connection",
      connectedHandle: "clio-manage:us", callbackURL: callback, requiredScopes: [],
      grantedScopes: [], selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message:
          "Clio Manage US OAuth references are ready for identity-free authority validation.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("clio-manage"),
          "authMethod": .string("relay_owned_confidential_oauth_authorization_code"),
          "apiOrigin": .string("https://app.clio.com"), "apiRegion": .string("us"),
          "apiPath": .string("/api/v4/users/who_am_i?fields=id,enabled"),
          "apiVersion": .string("4.0.13"), "readOnlyUsersPermission": .bool(true),
          "userIdentityReturned": .bool(false), "userIdentityPersisted": .bool(false),
          "legalPracticeDataReturned": .bool(false), "writesEnabled": .bool(false),
          "automaticPagination": .bool(false), "automaticRetry": .bool(false),
          "responseCapBytes": .number(1_000_000),
          "accessExpiresAt": accessExpiresAt.map(JSONValue.string) ?? .null,
          "providerPeakRequestsPerMinute": .number(50), "rawTokenStoredInDatabase": .bool(false),
        ], redactionStatus: "identity-and-legal-practice-data-excluded"), senderIdentities: [],
      installPolicy: "approval_gated_clio_manage_connection_authority", lastCheckedAt: timestamp,
      lastError: nil,
      manualEvidenceNote: callback == nil
        ? "Production Clio Manage requires CLAWCHAT_RAILWAY_ORIGIN, a US developer account, public OAuth app with only read-only Users permission, exact callback, provider review as applicable, security/privacy review, and live acceptance."
        : nil, reauthorizeRequired: false, disconnecting: false, betaBlocked: false,
      createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp,
      redactionStatus: "identity-and-legal-practice-data-excluded")
    do {
      let saved = try saveConnection(context: context, connection: connection)
      for oldRef in old where !saved.secretReferenceIds.contains(oldRef) {
        _ = try? secrets.delete(oldRef)
      }
      return saved
    } catch {
      _ = try? secrets.delete(accessRef.id)
      _ = try? secrets.delete(refreshRef.id)
      throw error
    }
  }
  @discardableResult public func saveClioGrowRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    accessExpiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "clio-grow")
    guard app.slug == "clio-grow" else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Clio Grow OAuth can only be saved for Clio Grow.")
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "Clio Grow OAuth access token", maxLength: 30000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "Clio Grow OAuth refresh token", maxLength: 30000)
    guard !access.contains("\n"), !access.contains("\r"), !refresh.contains("\n"),
      !refresh.contains("\r")
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Clio Grow requires valid OAuth tokens.")
    }
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let old = existing.map(Self.secretReferenceIds(in:)) ?? []
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Clio Grow OAuth access token",
      secretValue: access)
    let refreshRef: SecretReference
    do {
      refreshRef = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Clio Grow rotating OAuth refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    let railway = RelayCloudLaunchContract.configuredRailwayOrigin
    let callback = railway.map { $0 + "/api/v1/marketplace/oauth/clio-grow/callback" }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "clio_grow_oauth_access_token", label: "Clio Grow OAuth access token",
        required: true, userOwnedRequired: false, secretReferenceId: accessRef.id,
        status: .verified,
        helpText: "24-hour provider access token stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "clio_grow_oauth_refresh_token", label: "Clio Grow rotating OAuth refresh token",
        required: true, userOwnedRequired: false, secretReferenceId: refreshRef.id,
        status: .verified,
        helpText:
          "Single-use rotating refresh token stored separately and replaced atomically after refresh.",
        redactionStatus: "secret-reference-only"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "clio-grow-us-oauth", providerName: "Clio Grow", status: .connected,
      authorizationState: .completed, credentialOwnership: .relayOwned,
      userOwnedCredentialsRequired: false, credentialRequirements: requirements,
      secretReferenceIds: [accessRef.id, refreshRef.id], accountLabel: "Clio Grow US connection",
      connectedHandle: "clio-grow:us", callbackURL: callback, requiredScopes: ["grow_user_read"],
      grantedScopes: ["grow_user_read"], selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message: "Clio Grow US OAuth references are ready for identity-free authority validation.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("clio-grow"),
          "authMethod": .string("relay_owned_confidential_oauth_authorization_code_pkce_s256"),
          "apiOrigin": .string("https://api.clio.com"),
          "oauthOrigin": .string("https://auth.api.clio.com"), "apiRegion": .string("us"),
          "apiPath": .string("/grow/users/who_am_i"), "apiVersion": .string("v2"),
          "exactScope": .string("grow_user_read"), "userIdentityReturned": .bool(false),
          "userIdentityPersisted": .bool(false), "firmIdentityReturned": .bool(false),
          "legalIntakeDataReturned": .bool(false), "writesEnabled": .bool(false),
          "automaticPagination": .bool(false), "automaticRetry": .bool(false),
          "responseCapBytes": .number(1_000_000),
          "accessExpiresAt": accessExpiresAt.map(JSONValue.string) ?? .null,
          "providerRequestsPerSecond": .number(3), "rawTokenStoredInDatabase": .bool(false),
        ], redactionStatus: "identity-firm-and-legal-intake-data-excluded"), senderIdentities: [],
      installPolicy: "approval_gated_clio_grow_connection_authority", lastCheckedAt: timestamp,
      lastError: nil,
      manualEvidenceNote: callback == nil
        ? "Production Clio Grow requires CLAWCHAT_RAILWAY_ORIGIN, a separate US Clio Platform developer account, public OAuth app with PKCE and only grow_user_read, exact callback, provider review as applicable, security/privacy review, and live acceptance."
        : nil, reauthorizeRequired: false, disconnecting: false, betaBlocked: false,
      createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp,
      redactionStatus: "identity-firm-and-legal-intake-data-excluded")
    do {
      let saved = try saveConnection(context: context, connection: connection)
      for oldRef in old where !saved.secretReferenceIds.contains(oldRef) {
        _ = try? secrets.delete(oldRef)
      }
      return saved
    } catch {
      _ = try? secrets.delete(accessRef.id)
      _ = try? secrets.delete(refreshRef.id)
      throw error
    }
  }
  @discardableResult public func saveMyCaseAccessTokenConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "mycase")
    guard app.slug == "mycase" else {
      throw ServiceGuard.invalidInput(
        context: context, message: "MyCase credentials can only be saved for MyCase.")
    }
    try validateAppCanAuthorize(app, context: context)
    let token = try requireNonEmptyString(
      accessToken, field: "MyCase Open API access token", maxLength: 30000)
    guard !token.contains("\n"), !token.contains("\r") else {
      throw ServiceGuard.invalidInput(
        context: context, message: "MyCase requires a valid access token.")
    }
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let old = existing.map(Self.secretReferenceIds(in:)) ?? []
    let tokenRef = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "MyCase Open API access token",
      secretValue: token)
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "mycase_access_token", label: "MyCase Open API access token", required: true,
        userOwnedRequired: true, secretReferenceId: tokenRef.id, status: .verified,
        helpText: "Customer-issued bearer token stored as a Keychain reference.",
        redactionStatus: "secret-reference-only")
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "mycase:customer-open-api-token", providerName: "MyCase", status: .connected,
      authorizationState: .completed, credentialOwnership: .userOwned,
      userOwnedCredentialsRequired: true, credentialRequirements: requirements,
      secretReferenceIds: [tokenRef.id], accountLabel: "MyCase firm",
      connectedHandle: "mycase:firm", callbackURL: nil, requiredScopes: [], grantedScopes: [],
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message:
          "MyCase token is syntax-valid and ready for identity-free firm-authority validation.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("mycase"),
          "authMethod": .string("customer_owned_open_api_bearer_token"),
          "apiOrigin": .string("https://external-integrations.mycase.com"),
          "apiPath": .string("/v1/firm"), "apiVersion": .string("v1"),
          "advancedTierRequired": .bool(true), "supportEnablementRequired": .bool(true),
          "firmIdentityReturned": .bool(false), "firmIdentityPersisted": .bool(false),
          "userIdentityReturned": .bool(false), "legalPracticeDataReturned": .bool(false),
          "writesEnabled": .bool(false), "automaticPagination": .bool(false),
          "automaticRetry": .bool(false), "responseCapBytes": .number(1_000_000),
          "rawCredentialStoredInDatabase": .bool(false),
        ], redactionStatus: "firm-user-and-legal-practice-data-excluded"), senderIdentities: [],
      installPolicy: "approval_gated_mycase_connection_authority", lastCheckedAt: timestamp,
      lastError: nil,
      manualEvidenceNote:
        "MyCase requires the Advanced tier, support-enabled Open API access, a current customer-issued token for the exact firm, rotation ownership, security/privacy review, and live acceptance.",
      reauthorizeRequired: false, disconnecting: false, betaBlocked: false,
      createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp,
      redactionStatus: "firm-user-and-legal-practice-data-excluded")
    do {
      let saved = try saveConnection(context: context, connection: connection)
      for oldRef in old where !saved.secretReferenceIds.contains(oldRef) {
        _ = try? secrets.delete(oldRef)
      }
      return saved
    } catch {
      _ = try? secrets.delete(tokenRef.id)
      throw error
    }
  }
  @discardableResult public func savePracticePantherRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    accessExpiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "practicepanther")
    guard app.slug == "practicepanther" else {
      throw ServiceGuard.invalidInput(
        context: context, message: "PracticePanther OAuth can only be saved for PracticePanther.")
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "PracticePanther OAuth access token", maxLength: 30000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "PracticePanther OAuth refresh token", maxLength: 30000)
    guard !access.contains("\n"), !access.contains("\r"), !refresh.contains("\n"),
      !refresh.contains("\r")
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "PracticePanther requires valid OAuth tokens.")
    }
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let old = existing.map(Self.secretReferenceIds(in:)) ?? []
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "PracticePanther OAuth access token",
      secretValue: access)
    let refreshRef: SecretReference
    do {
      refreshRef = try secrets.set(
        scope: "provider_connection", scopeId: id,
        label: "PracticePanther rotating OAuth refresh token", secretValue: refresh)
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    let railway = RelayCloudLaunchContract.configuredRailwayOrigin
    let callback = railway.map { $0 + "/api/v1/marketplace/oauth/practicepanther/callback" }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "practicepanther_oauth_access_token", label: "PracticePanther OAuth access token",
        required: true, userOwnedRequired: false, secretReferenceId: accessRef.id,
        status: .verified,
        helpText: "Provider-expiring access token stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "practicepanther_oauth_refresh_token",
        label: "PracticePanther rotating OAuth refresh token", required: true,
        userOwnedRequired: false, secretReferenceId: refreshRef.id, status: .verified,
        helpText:
          "Refresh token normally valid for 60 days or until used; replacement is required after refresh.",
        redactionStatus: "secret-reference-only"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "practicepanther-oauth", providerName: "PracticePanther", status: .connected,
      authorizationState: .completed, credentialOwnership: .relayOwned,
      userOwnedCredentialsRequired: false, credentialRequirements: requirements,
      secretReferenceIds: [accessRef.id, refreshRef.id], accountLabel: "PracticePanther connection",
      connectedHandle: "practicepanther:oauth", callbackURL: callback, requiredScopes: [],
      grantedScopes: [], selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message:
          "PracticePanther OAuth references are ready for identity-free authority validation.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("practicepanther"),
          "authMethod": .string("relay_owned_confidential_oauth_authorization_code"),
          "apiOrigin": .string("https://app.practicepanther.com"),
          "apiPath": .string("/api/TimeEntry/$count"), "apiVersion": .string("v1"),
          "scopeParameterOmitted": .bool(true), "countReturned": .bool(false),
          "identityReturned": .bool(false), "legalPracticeDataReturned": .bool(false),
          "timeDataReturned": .bool(false), "financialDataReturned": .bool(false),
          "writesEnabled": .bool(false), "automaticPagination": .bool(false),
          "automaticRetry": .bool(false), "responseCapBytes": .number(65536),
          "accessExpiresAt": accessExpiresAt.map(JSONValue.string) ?? .null,
          "refreshTokenRotationRequired": .bool(true), "rawTokenStoredInDatabase": .bool(false),
        ], redactionStatus: "identity-firm-legal-practice-time-and-financial-data-excluded"),
      senderIdentities: [], installPolicy: "approval_gated_practicepanther_connection_authority",
      lastCheckedAt: timestamp, lastError: nil,
      manualEvidenceNote: callback == nil
        ? "Production PracticePanther requires CLAWCHAT_RAILWAY_ORIGIN, case-by-case API approval, issued client credentials, exact HTTPS callback, consent, security/privacy review, refresh-rotation validation, and live acceptance."
        : nil, reauthorizeRequired: false, disconnecting: false, betaBlocked: false,
      createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp,
      redactionStatus: "identity-firm-legal-practice-time-and-financial-data-excluded")
    do {
      let saved = try saveConnection(context: context, connection: connection)
      for oldRef in old where !saved.secretReferenceIds.contains(oldRef) {
        _ = try? secrets.delete(oldRef)
      }
      return saved
    } catch {
      _ = try? secrets.delete(accessRef.id)
      _ = try? secrets.delete(refreshRef.id)
      throw error
    }
  }
  @discardableResult public func saveSmokeballRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    apiKey: String, accessExpiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "smokeball")
    guard app.slug == "smokeball" else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Smokeball OAuth can only be saved for Smokeball.")
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "Smokeball OAuth access token", maxLength: 30000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "Smokeball OAuth refresh token", maxLength: 30000)
    let key = try requireNonEmptyString(apiKey, field: "Smokeball API key", maxLength: 2000)
    guard !access.contains("\n"), !access.contains("\r"), !refresh.contains("\n"),
      !refresh.contains("\r"), !key.contains("\n"), !key.contains("\r")
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Smokeball requires valid OAuth credentials.")
    }
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let old = existing.map(Self.secretReferenceIds(in:)) ?? []
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Smokeball OAuth access token",
      secretValue: access)
    let refreshRef: SecretReference
    do {
      refreshRef = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Smokeball OAuth refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    let keyRef: SecretReference
    do {
      keyRef = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Smokeball provider-issued API key",
        secretValue: key)
    } catch {
      _ = try? secrets.delete(accessRef.id)
      _ = try? secrets.delete(refreshRef.id)
      throw error
    }
    let railway = RelayCloudLaunchContract.configuredRailwayOrigin
    let callback = railway.map { $0 + "/api/v1/marketplace/oauth/smokeball/callback" }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "smokeball_oauth_access_token", label: "Smokeball OAuth access token",
        required: true, userOwnedRequired: false, secretReferenceId: accessRef.id,
        status: .verified,
        helpText: "One-hour provider access token stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "smokeball_oauth_refresh_token", label: "Smokeball OAuth refresh token",
        required: true, userOwnedRequired: false, secretReferenceId: refreshRef.id,
        status: .verified,
        helpText: "Provider refresh token with a default 30-day lifetime stored separately.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "smokeball_api_key", label: "Smokeball API key", required: true,
        userOwnedRequired: false, secretReferenceId: keyRef.id, status: .verified,
        helpText:
          "Provider-issued application API key stored as a Keychain reference and injected only into fixed requests.",
        redactionStatus: "secret-reference-only"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "smokeball-us-oauth", providerName: "Smokeball", status: .connected,
      authorizationState: .completed, credentialOwnership: .relayOwned,
      userOwnedCredentialsRequired: false, credentialRequirements: requirements,
      secretReferenceIds: [accessRef.id, refreshRef.id, keyRef.id],
      accountLabel: "Smokeball US firm", connectedHandle: "smokeball:us", callbackURL: callback,
      requiredScopes: [], grantedScopes: [], selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message: "Smokeball US OAuth references are ready for identity-free authority validation.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("smokeball"),
          "authMethod": .string("relay_owned_confidential_oauth_authorization_code_pkce_s256"),
          "oauthOrigin": .string("https://auth.smokeball.com"),
          "apiOrigin": .string("https://api.smokeball.com"), "apiRegion": .string("us"),
          "apiPath": .string("/firm"), "apiVersion": .string("v1"),
          "scopeParameterOmitted": .bool(true), "firmReadPermissionRequired": .bool(true),
          "firmIdentityReturned": .bool(false), "firmIdentityPersisted": .bool(false),
          "legalPracticeDataReturned": .bool(false), "writesEnabled": .bool(false),
          "automaticPagination": .bool(false), "automaticRetry": .bool(false),
          "responseCapBytes": .number(65536),
          "accessExpiresAt": accessExpiresAt.map(JSONValue.string) ?? .null,
          "refreshTokenDefaultMaximumDays": .number(30),
          "rawCredentialStoredInDatabase": .bool(false),
        ],
        redactionStatus:
          "firm-identity-client-matter-document-communication-and-financial-data-excluded"),
      senderIdentities: [], installPolicy: "approval_gated_smokeball_connection_authority",
      lastCheckedAt: timestamp, lastError: nil,
      manualEvidenceNote: callback == nil
        ? "Production Smokeball requires CLAWCHAT_RAILWAY_ORIGIN, US partner approval, a reviewed public app with only firm-read authority, confidential credentials, provider-issued API key, exact callback/logout registration, customer consent, security/privacy review, and live acceptance."
        : nil, reauthorizeRequired: false, disconnecting: false, betaBlocked: false,
      createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp,
      redactionStatus:
        "firm-identity-client-matter-document-communication-and-financial-data-excluded")
    do {
      let saved = try saveConnection(context: context, connection: connection)
      for oldRef in old where !saved.secretReferenceIds.contains(oldRef) {
        _ = try? secrets.delete(oldRef)
      }
      return saved
    } catch {
      _ = try? secrets.delete(accessRef.id)
      _ = try? secrets.delete(refreshRef.id)
      _ = try? secrets.delete(keyRef.id)
      throw error
    }
  }
  @discardableResult public func saveLawPayRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String,
    accessExpiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "lawpay")
    guard app.slug == "lawpay" else {
      throw ServiceGuard.invalidInput(
        context: context, message: "LawPay OAuth can only be saved for LawPay.")
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "LawPay OAuth access token", maxLength: 30000)
    guard !access.contains("\n"), !access.contains("\r") else {
      throw ServiceGuard.invalidInput(
        context: context, message: "LawPay requires a valid OAuth access token.")
    }
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let old = existing.map(Self.secretReferenceIds(in:)) ?? []
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "LawPay OAuth access token",
      secretValue: access)
    let railway = RelayCloudLaunchContract.configuredRailwayOrigin
    let callback = railway.map { $0 + "/api/v1/marketplace/oauth/lawpay/callback" }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "lawpay_oauth_access_token", label: "LawPay OAuth access token", required: true,
        userOwnedRequired: false, secretReferenceId: accessRef.id, status: .verified,
        helpText: "8am/LawPay access token stored as a Keychain reference.",
        redactionStatus: "secret-reference-only")
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "lawpay-oauth", providerName: "LawPay", status: .connected,
      authorizationState: .completed, credentialOwnership: .relayOwned,
      userOwnedCredentialsRequired: false, credentialRequirements: requirements,
      secretReferenceIds: [accessRef.id], accountLabel: "LawPay merchant",
      connectedHandle: "lawpay:merchant", callbackURL: callback, requiredScopes: ["payments"],
      grantedScopes: ["payments"], selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message: "LawPay OAuth reference is ready for identity-free gateway authority validation.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("lawpay"),
          "authMethod": .string("relay_owned_8am_partner_oauth_authorization_code"),
          "oauthOrigin": .string("https://secure.lawpay.com"),
          "apiOrigin": .string("https://api.8am.com"), "platform": .string("8am-lawpay"),
          "apiPath": .string("/gateway-credentials"), "apiVersion": .string("v1"),
          "requiredScope": .string("payments"), "merchantIdentityReturned": .bool(false),
          "merchantIdentityPersisted": .bool(false), "accountKeysReturned": .bool(false),
          "accountKeysPersisted": .bool(false), "trustAccountDataReturned": .bool(false),
          "paymentDataReturned": .bool(false), "legalPracticeDataReturned": .bool(false),
          "writesEnabled": .bool(false), "automaticPagination": .bool(false),
          "automaticRetry": .bool(false), "responseCapBytes": .number(65536),
          "accessExpiresAt": accessExpiresAt.map(JSONValue.string) ?? .null,
          "refreshSupported": .bool(false), "rawTokenStoredInDatabase": .bool(false),
        ],
        redactionStatus:
          "merchant-identity-account-keys-trust-payment-and-legal-practice-data-excluded"),
      senderIdentities: [], installPolicy: "approval_gated_lawpay_connection_authority",
      lastCheckedAt: timestamp, lastError: nil,
      manualEvidenceNote: callback == nil
        ? "Production LawPay requires CLAWCHAT_RAILWAY_ORIGIN, 8am partner OAuth approval, exact callback, customer consent, disconnect support, integration-demo approval, security/privacy review, and live acceptance."
        : nil, reauthorizeRequired: false, disconnecting: false, betaBlocked: false,
      createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp,
      redactionStatus:
        "merchant-identity-account-keys-trust-payment-and-legal-practice-data-excluded")
    do {
      let saved = try saveConnection(context: context, connection: connection)
      for oldRef in old where !saved.secretReferenceIds.contains(oldRef) {
        _ = try? secrets.delete(oldRef)
      }
      return saved
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
  }
  @discardableResult public func saveFilevineRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    accessExpiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "filevine")
    guard app.slug == "filevine" else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Filevine OAuth can only be saved for Filevine.")
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "Filevine OAuth access token", maxLength: 30000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "Filevine OAuth refresh token", maxLength: 30000)
    guard !access.contains("\n"), !access.contains("\r"), !refresh.contains("\n"),
      !refresh.contains("\r")
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Filevine requires valid OAuth tokens.")
    }
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let old = existing.map(Self.secretReferenceIds(in:)) ?? []
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Filevine OAuth access token",
      secretValue: access)
    let refreshRef: SecretReference
    do {
      refreshRef = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Filevine OAuth refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    let railway = RelayCloudLaunchContract.configuredRailwayOrigin
    let callback = railway.map { $0 + "/api/v1/marketplace/oauth/filevine/callback" }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let scopes = ["openid", "offline_access", "fv.api.gateway.access"]
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "filevine_oauth_access_token", label: "Filevine OAuth access token",
        required: true, userOwnedRequired: false, secretReferenceId: accessRef.id,
        status: .verified,
        helpText: "Filevine provider access token stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "filevine_oauth_refresh_token", label: "Filevine OAuth refresh token",
        required: true, userOwnedRequired: false, secretReferenceId: refreshRef.id,
        status: .verified,
        helpText: "Filevine refresh token stored as a separate Keychain reference.",
        redactionStatus: "secret-reference-only"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "filevine-us-oauth", providerName: "Filevine", status: .connected,
      authorizationState: .completed, credentialOwnership: .relayOwned,
      userOwnedCredentialsRequired: false, credentialRequirements: requirements,
      secretReferenceIds: [accessRef.id, refreshRef.id], accountLabel: "Filevine US tenant",
      connectedHandle: "filevine:us", callbackURL: callback, requiredScopes: scopes,
      grantedScopes: scopes, selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message:
          "Filevine OAuth references are ready for identity-free projects authority validation.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("filevine"),
          "authMethod": .string("filevine_provisioned_confidential_oidc_authorization_code"),
          "oauthOrigin": .string("https://identity.filevine.com"),
          "apiOrigin": .string("https://api.filevine.io"), "apiRegion": .string("us"),
          "apiPath": .string("/v2/projects?limit=1"), "apiVersion": .string("v2"),
          "requiredScopes": .array(scopes.map(JSONValue.string)),
          "userIdentityReturned": .bool(false), "firmIdentityReturned": .bool(false),
          "projectDataReturned": .bool(false), "matterDataReturned": .bool(false),
          "documentDataReturned": .bool(false), "financialDataReturned": .bool(false),
          "legalPracticeDataReturned": .bool(false), "writesEnabled": .bool(false),
          "automaticPagination": .bool(false), "automaticRetry": .bool(false),
          "responseCapBytes": .number(65536),
          "accessExpiresAt": accessExpiresAt.map(JSONValue.string) ?? .null,
          "refreshSupported": .bool(true), "rawTokenStoredInDatabase": .bool(false),
        ],
        redactionStatus:
          "user-firm-project-matter-document-financial-and-legal-practice-data-excluded"),
      senderIdentities: [], installPolicy: "approval_gated_filevine_connection_authority",
      lastCheckedAt: timestamp, lastError: nil,
      manualEvidenceNote: callback == nil
        ? "Production Filevine requires CLAWCHAT_RAILWAY_ORIGIN, Filevine-provisioned OAuth/OIDC client, exact callback/logout registration, provider-approved environment and scopes, customer consent, security/privacy review, and live acceptance."
        : nil, reauthorizeRequired: false, disconnecting: false, betaBlocked: false,
      createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp,
      redactionStatus:
        "user-firm-project-matter-document-financial-and-legal-practice-data-excluded")
    do {
      let saved = try saveConnection(context: context, connection: connection)
      for oldRef in old where !saved.secretReferenceIds.contains(oldRef) {
        _ = try? secrets.delete(oldRef)
      }
      return saved
    } catch {
      _ = try? secrets.delete(accessRef.id)
      _ = try? secrets.delete(refreshRef.id)
      throw error
    }
  }
}
