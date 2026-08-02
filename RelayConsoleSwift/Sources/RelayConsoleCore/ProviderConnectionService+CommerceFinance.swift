import Foundation

extension ProviderConnectionService {
  @discardableResult
  public func saveShopifyRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    shopDomain: String, shopName: String?, accessExpiresAt: String?, refreshExpiresAt: String?,
    grantedScopes: [String] = ProviderConnectionService.shopifyRelayOwnedOAuthScopes,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "shopify")
    guard app.slug == "shopify" else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "Shopify OAuth can only be saved for the Shopify Marketplace app.")
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "Shopify OAuth access token", maxLength: 20000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "Shopify OAuth refresh token", maxLength: 20000)
    let shop = shopDomain.lowercased()
    guard ShopifyProviderActionSupport.validShop(shop), shop == shopDomain else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "Shopify shop domain must be the exact lowercase myshopify.com host.")
    }
    let scopes = grantedScopes.isEmpty ? Self.shopifyRelayOwnedOAuthScopes : grantedScopes
    let missing = Self.shopifyRelayOwnedOAuthScopes.filter { !scopes.contains($0) }
    let ready = missing.isEmpty
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let oldRefs = existing.map(Self.secretReferenceIds(in:)) ?? []
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Shopify expiring offline access token",
      secretValue: access)
    let refreshRef: SecretReference
    do {
      refreshRef = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Shopify rotating offline refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    let origin = RelayCloudLaunchContract.configuredRailwayOrigin
    let callback = origin.map { $0 + "/api/v1/marketplace/oauth/shopify/callback" }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let label = shopName?.providerConnectionNilIfEmpty ?? shop
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "shopify_oauth_access_token", label: "Shopify expiring offline access token",
        required: true, userOwnedRequired: false, secretReferenceId: accessRef.id,
        status: .verified, helpText: "Current 60-minute Shopify offline access token in Keychain.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "shopify_oauth_refresh_token", label: "Shopify rotating offline refresh token",
        required: true, userOwnedRequired: false, secretReferenceId: refreshRef.id,
        status: .verified,
        helpText: "One-time Shopify refresh token atomically replaced with both references.",
        redactionStatus: "secret-reference-only"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "shopify-relay-owned-oauth:" + shop, providerName: "Shopify",
      status: ready ? .connected : .authRequired,
      authorizationState: ready ? .completed : .manualEvidenceRequired,
      credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
      credentialRequirements: requirements, secretReferenceIds: [accessRef.id, refreshRef.id],
      accountLabel: label, connectedHandle: shop, callbackURL: callback,
      requiredScopes: Self.shopifyRelayOwnedOAuthScopes, grantedScopes: scopes,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: ready ? .ready : .degraded,
        message: ready
          ? "Shopify expiring offline OAuth references are ready for the exact shop."
          : "Shopify OAuth is missing scopes: " + missing.joined(separator: ", "),
        lastCheckedAt: timestamp, missingScopes: missing,
        unavailableTools: ready
          ? []
          : ["shopify.product.list", "shopify.product.create_draft", "shopify.product.publish"],
        diagnostics: [
          "provider": .string("shopify"),
          "authMethod": .string("shopify_public_app_authorization_code_expiring_offline"),
          "relayOwnedShopifyOAuth": .bool(true),
          "secretStorage": .string("keychain-reference-only"),
          "refreshTokenRotation": .string(
            "single-use-serialized-atomic-two-reference-replacement-with-one-hour-retry-window"),
          "shopDomain": .string(shop),
          "shopName": shopName?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
          "apiVersion": .string("2026-07"),
          "accessExpiresAt": accessExpiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string)
            ?? .null,
          "refreshExpiresAt": refreshExpiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string)
            ?? .null,
          "accessTokenLifetimeSeconds": .number(3600),
          "refreshTokenLifetimeSeconds": .number(7_776_000),
          "requiresSecureWebBackend": .bool(true),
          "productionCallbackConfigured": .bool(callback != nil),
          "callbackTransport": .string("railway-https-only"),
          "complianceWebhooksRequired": .bool(true), "protectedCustomerDataRequested": .bool(false),
          "atomicProductConcurrencySupported": .bool(false),
          "rawTokenStoredInDatabase": .bool(false), "rawProviderToolExposure": .bool(false),
        ], redactionStatus: "private-state-excluded"), senderIdentities: [],
      installPolicy: "approval_gated_shopify_draft_activate_publish", lastCheckedAt: timestamp,
      lastError: ready ? nil : "Missing Shopify scopes: " + missing.joined(separator: ", "),
      manualEvidenceNote: callback == nil
        ? "Production Shopify consent requires CLAWCHAT_RAILWAY_ORIGIN and a deployed HTTPS callback/token-refresh/webhook broker."
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
  public func rotateShopifyOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String, accessExpiresAt: String?, refreshExpiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    shopifyTokenRotationLock.lock()
    defer { shopifyTokenRotationLock.unlock() }
    guard
      let existing = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId), existing.appSlug == "shopify"
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Shopify connection is required for token rotation.")
    }
    let diagnostics = existing.health.diagnostics
    return try saveShopifyRelayOwnedOAuthConnection(
      context: context, appIdOrSlug: existing.appId, accessToken: accessToken,
      refreshToken: refreshToken, shopDomain: diagnostics["shopDomain"]?.string ?? "",
      shopName: diagnostics["shopName"]?.string, accessExpiresAt: accessExpiresAt,
      refreshExpiresAt: refreshExpiresAt, grantedScopes: existing.grantedScopes, now: now)
  }

  @discardableResult
  public func saveWooCommerceApplicationConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, consumerKey: String,
    consumerSecret: String, storeOrigin: String, storeName: String?, keyId: String? = nil,
    keyPermissions: String = "read_write", now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "woocommerce")
    guard app.slug == "woocommerce" else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "WooCommerce Application Authentication can only be saved for the WooCommerce Marketplace app."
      )
    }
    try validateAppCanAuthorize(app, context: context)
    let key = try requireNonEmptyString(
      consumerKey, field: "WooCommerce consumer key", maxLength: 20000)
    let secret = try requireNonEmptyString(
      consumerSecret, field: "WooCommerce consumer secret", maxLength: 20000)
    guard WooCommerceProviderActionSupport.validOrigin(storeOrigin) else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "WooCommerce store origin must be one exact public HTTPS origin without a path, credentials, query, or fragment."
      )
    }
    guard keyPermissions == "read_write" else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "WooCommerce V1 requires the exact read_write application permission.")
    }
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let oldRefs = existing.map(Self.secretReferenceIds(in:)) ?? []
    let keyRef = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "WooCommerce consumer key", secretValue: key
    )
    let secretRef: SecretReference
    do {
      secretRef = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "WooCommerce consumer secret",
        secretValue: secret)
    } catch {
      _ = try? secrets.delete(keyRef.id)
      throw error
    }
    let railwayOrigin = RelayCloudLaunchContract.configuredRailwayOrigin
    let callback = railwayOrigin.map { $0 + "/api/v1/oauth/woocommerce/callback" }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let label =
      storeName?.providerConnectionNilIfEmpty ?? URL(string: storeOrigin)?.host
      ?? "WooCommerce store"
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "woocommerce_consumer_key", label: "WooCommerce consumer key", required: true,
        userOwnedRequired: false, secretReferenceId: keyRef.id, status: .verified,
        helpText: "Application Authentication consumer key stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "woocommerce_consumer_secret", label: "WooCommerce consumer secret",
        required: true, userOwnedRequired: false, secretReferenceId: secretRef.id,
        status: .verified,
        helpText:
          "Application Authentication consumer secret stored as a separate Keychain reference.",
        redactionStatus: "secret-reference-only"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "woocommerce-relay-owned-app-auth:" + storeOrigin, providerName: "WooCommerce",
      status: .connected, authorizationState: .completed, credentialOwnership: .relayOwned,
      userOwnedCredentialsRequired: false, credentialRequirements: requirements,
      secretReferenceIds: [keyRef.id, secretRef.id], accountLabel: label,
      connectedHandle: storeOrigin, callbackURL: callback,
      requiredScopes: Self.wooCommerceApplicationPermissions, grantedScopes: [keyPermissions],
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message:
          "WooCommerce consumer credential references are ready for the exact public HTTPS store origin.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("woocommerce"),
          "authMethod": .string("woocommerce_application_auth_endpoint_consumer_credentials"),
          "relayOwnedWooCommerceApplicationAuth": .bool(true), "storeOrigin": .string(storeOrigin),
          "storeName": storeName?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
          "keyId": keyId?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
          "keyPermissions": .string(keyPermissions), "apiNamespace": .string("wc/v3"),
          "secretStorage": .string("two-keychain-references-only"),
          "refreshSupported": .bool(false), "reauthorizationReplacesBoth": .bool(true),
          "requiresSecureWebBackend": .bool(true),
          "productionCallbackConfigured": .bool(callback != nil),
          "callbackTransport": .string("railway-https-only"),
          "publicHttpsOriginRequired": .bool(true), "queryStringAuthAllowed": .bool(false),
          "redirectsAllowed": .bool(false), "basicAuthorizationHeaderOnly": .bool(true),
          "atomicProductConcurrencySupported": .bool(false),
          "rawCredentialStoredInDatabase": .bool(false), "rawProviderToolExposure": .bool(false),
        ], redactionStatus: "private-state-excluded"), senderIdentities: [],
      installPolicy: "approval_gated_woocommerce_draft_publish", lastCheckedAt: timestamp,
      lastError: nil,
      manualEvidenceNote: callback == nil
        ? "Production WooCommerce key generation requires CLAWCHAT_RAILWAY_ORIGIN and a deployed HTTPS Application Authentication callback."
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
      _ = try? secrets.delete(keyRef.id)
      _ = try? secrets.delete(secretRef.id)
      throw error
    }
  }

  @discardableResult
  public func saveStripeAppsOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    accountId: String, accountLabel: String?, livemode: Bool, accessExpiresAt: String?,
    refreshExpiresAt: String?,
    grantedPermissions: [String] = ProviderConnectionService.stripeAppsOAuthPermissions,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "stripe")
    guard app.slug == "stripe" else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "Stripe Apps OAuth can only be saved for the Stripe Marketplace app.")
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "Stripe Apps OAuth access token", maxLength: 20000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "Stripe Apps rolling refresh token", maxLength: 20000)
    let account = try requireNonEmptyString(accountId, field: "Stripe account ID", maxLength: 128)
    guard
      account.hasPrefix("acct_") && account.dropFirst(5).allSatisfy({ $0.isLetter || $0.isNumber })
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Stripe account ID must be a valid acct_ identifier.")
    }
    let permissions =
      grantedPermissions.isEmpty ? Self.stripeAppsOAuthPermissions : grantedPermissions
    let missing = Self.stripeAppsOAuthPermissions.filter { !permissions.contains($0) }
    let extras = permissions.filter { !Self.stripeAppsOAuthPermissions.contains($0) }
    guard extras.isEmpty else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "Stripe V1 rejects permissions broader than balance_read and payment_intent_read.")
    }
    let ready = missing.isEmpty
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let oldRefs = existing.map(Self.secretReferenceIds(in:)) ?? []
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Stripe Apps OAuth access token",
      secretValue: access)
    let refreshRef: SecretReference
    do {
      refreshRef = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Stripe Apps rolling OAuth refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    let origin = RelayCloudLaunchContract.configuredRailwayOrigin
    let callback = origin.map { $0 + "/api/v1/oauth/stripe/callback" }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let label = accountLabel?.providerConnectionNilIfEmpty ?? "Stripe " + account
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "stripe_apps_oauth_access_token", label: "Stripe Apps OAuth access token",
        required: true, userOwnedRequired: false, secretReferenceId: accessRef.id,
        status: .verified,
        helpText: "Current one-hour Stripe Apps access token stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "stripe_apps_oauth_refresh_token", label: "Stripe Apps rolling refresh token",
        required: true, userOwnedRequired: false, secretReferenceId: refreshRef.id,
        status: .verified,
        helpText:
          "Single-use rolling refresh token atomically replaced with each new access token.",
        redactionStatus: "secret-reference-only"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "stripe-apps-oauth:" + account + ":" + (livemode ? "live" : "test"),
      providerName: "Stripe", status: ready ? .connected : .authRequired,
      authorizationState: ready ? .completed : .manualEvidenceRequired,
      credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
      credentialRequirements: requirements, secretReferenceIds: [accessRef.id, refreshRef.id],
      accountLabel: label, connectedHandle: account, callbackURL: callback,
      requiredScopes: Self.stripeAppsOAuthPermissions, grantedScopes: permissions,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: ready ? .ready : .degraded,
        message: ready
          ? "Stripe Apps OAuth references are ready for bounded read-only financial status."
          : "Stripe permissions must be exactly balance_read and payment_intent_read.",
        lastCheckedAt: timestamp, missingScopes: missing,
        unavailableTools: ready
          ? [] : ["stripe.balance.get", "stripe.payment_intent.list", "stripe.payment_intent.get"],
        diagnostics: [
          "provider": .string("stripe"),
          "authMethod": .string("stripe_apps_marketplace_oauth_v2_rolling_refresh"),
          "relayOwnedStripeAppsOAuth": .bool(true), "readOnlyV1": .bool(true),
          "stripeAccountId": .string(account), "livemode": .bool(livemode),
          "apiVersion": .string("2026-06-24.dahlia"),
          "accessExpiresAt": accessExpiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string)
            ?? .null,
          "refreshExpiresAt": refreshExpiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string)
            ?? .null,
          "accessTokenLifetimeSeconds": .number(3600),
          "refreshTokenLifetimeSeconds": .number(31_536_000),
          "refreshTokenRotation": .string("single-use-serialized-atomic-two-reference-replacement"),
          "requiresSecureWebBackend": .bool(true),
          "productionCallbackConfigured": .bool(callback != nil),
          "callbackTransport": .string("railway-https-only"),
          "deprecatedConnectOAuthUsed": .bool(false), "financialWritesAllowed": .bool(false),
          "privatePaymentFieldsReturned": .bool(false), "rawTokenStoredInDatabase": .bool(false),
          "rawProviderToolExposure": .bool(false),
        ], redactionStatus: "private-state-excluded"), senderIdentities: [],
      installPolicy: "read_only_stripe_financial_status", lastCheckedAt: timestamp,
      lastError: ready ? nil : "Stripe permission mismatch",
      manualEvidenceNote: callback == nil
        ? "Production Stripe Apps OAuth requires CLAWCHAT_RAILWAY_ORIGIN and a deployed HTTPS callback/token-refresh broker."
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
  public func rotateStripeAppsOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String, accessExpiresAt: String?, refreshExpiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    stripeTokenRotationLock.lock()
    defer { stripeTokenRotationLock.unlock() }
    guard
      let existing = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId), existing.appSlug == "stripe"
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Stripe connection is required for token rotation.")
    }
    let d = existing.health.diagnostics
    return try saveStripeAppsOAuthConnection(
      context: context, appIdOrSlug: existing.appId, accessToken: accessToken,
      refreshToken: refreshToken, accountId: d["stripeAccountId"]?.string ?? "",
      accountLabel: existing.accountLabel, livemode: d["livemode"]?.bool ?? false,
      accessExpiresAt: accessExpiresAt, refreshExpiresAt: refreshExpiresAt,
      grantedPermissions: existing.grantedScopes, now: now)
  }

  @discardableResult
  public func saveXeroRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    tenantId: String, connectionId: String, tenantName: String?, tenantType: String,
    accessExpiresAt: String?, refreshExpiresAt: String?,
    grantedScopes: [String] = ProviderConnectionService.xeroRelayOwnedOAuthScopes,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "xero")
    guard app.slug == "xero" else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Xero OAuth can only be saved for the Xero Marketplace app.")
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "Xero OAuth access token", maxLength: 20000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "Xero rolling refresh token", maxLength: 20000)
    let tenant = try requireNonEmptyString(tenantId, field: "Xero tenant ID", maxLength: 128)
    let grant = try requireNonEmptyString(connectionId, field: "Xero connection ID", maxLength: 128)
    guard UUID(uuidString: tenant) != nil, UUID(uuidString: grant) != nil,
      tenantType == "ORGANISATION"
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "Xero requires exact UUID tenant/connection IDs and an ORGANISATION tenant.")
    }
    let scopes = grantedScopes.isEmpty ? Self.xeroRelayOwnedOAuthScopes : grantedScopes
    let missing = Self.xeroRelayOwnedOAuthScopes.filter { !scopes.contains($0) }
    let extras = scopes.filter { !Self.xeroRelayOwnedOAuthScopes.contains($0) }
    guard extras.isEmpty && !scopes.contains("accounting.transactions.read") else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "Xero V1 rejects deprecated or broader scopes; use only offline_access, accounting.settings.read, and accounting.invoices.read."
      )
    }
    let ready = missing.isEmpty
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let oldRefs = existing.map(Self.secretReferenceIds(in:)) ?? []
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Xero OAuth access token",
      secretValue: access)
    let refreshRef: SecretReference
    do {
      refreshRef = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Xero rolling OAuth refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    let origin = RelayCloudLaunchContract.configuredRailwayOrigin
    let callback = origin.map { $0 + "/api/v1/oauth/xero/callback" }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let label = tenantName?.providerConnectionNilIfEmpty ?? "Xero organisation"
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "xero_oauth_access_token", label: "Xero OAuth access token", required: true,
        userOwnedRequired: false, secretReferenceId: accessRef.id, status: .verified,
        helpText: "Current 30-minute access token stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "xero_oauth_refresh_token", label: "Xero rolling refresh token", required: true,
        userOwnedRequired: false, secretReferenceId: refreshRef.id, status: .verified,
        helpText: "Rolling refresh token atomically replaced as a token pair.",
        redactionStatus: "secret-reference-only"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "xero-relay-owned-oauth:" + tenant, providerName: "Xero",
      status: ready ? .connected : .authRequired,
      authorizationState: ready ? .completed : .manualEvidenceRequired,
      credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
      credentialRequirements: requirements, secretReferenceIds: [accessRef.id, refreshRef.id],
      accountLabel: label, connectedHandle: tenant, callbackURL: callback,
      requiredScopes: Self.xeroRelayOwnedOAuthScopes, grantedScopes: scopes,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: ready ? .ready : .degraded,
        message: ready
          ? "Xero OAuth references are ready for the exact read-only organisation tenant."
          : "Xero granular scopes are incomplete.", lastCheckedAt: timestamp,
        missingScopes: missing,
        unavailableTools: ready
          ? [] : ["xero.organisation.get", "xero.invoice.list", "xero.invoice.get"],
        diagnostics: [
          "provider": .string("xero"),
          "authMethod": .string("oauth2_authorization_code_rolling_refresh"),
          "relayOwnedXeroOAuth": .bool(true), "readOnlyV1": .bool(true),
          "tenantId": .string(tenant), "connectionId": .string(grant),
          "tenantName": tenantName?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
          "tenantType": .string(tenantType),
          "accessExpiresAt": accessExpiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string)
            ?? .null,
          "refreshExpiresAt": refreshExpiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string)
            ?? .null,
          "accessTokenLifetimeSeconds": .number(1800),
          "refreshTokenLifetimeSeconds": .number(5_184_000),
          "refreshTokenRotation": .string(
            "serialized-atomic-two-reference-replacement-with-30-minute-retry-grace"),
          "exactTenantRequired": .bool(true), "granularScopes": .bool(true),
          "deprecatedAccountingTransactionsScopeUsed": .bool(false),
          "financialWritesAllowed": .bool(false), "requiresSecureWebBackend": .bool(true),
          "productionCallbackConfigured": .bool(callback != nil),
          "callbackTransport": .string("railway-https-only"),
          "rawTokenStoredInDatabase": .bool(false), "rawProviderToolExposure": .bool(false),
        ], redactionStatus: "private-state-excluded"), senderIdentities: [],
      installPolicy: "read_only_xero_accounting_status", lastCheckedAt: timestamp,
      lastError: ready ? nil : "Xero granular scope mismatch",
      manualEvidenceNote: callback == nil
        ? "Production Xero OAuth requires CLAWCHAT_RAILWAY_ORIGIN and a deployed HTTPS callback/token-refresh broker."
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
  public func rotateXeroOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String, accessExpiresAt: String?, refreshExpiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    xeroTokenRotationLock.lock()
    defer { xeroTokenRotationLock.unlock() }
    guard
      let existing = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId), existing.appSlug == "xero"
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Xero connection is required for token rotation.")
    }
    let d = existing.health.diagnostics
    return try saveXeroRelayOwnedOAuthConnection(
      context: context, appIdOrSlug: existing.appId, accessToken: accessToken,
      refreshToken: refreshToken, tenantId: d["tenantId"]?.string ?? "",
      connectionId: d["connectionId"]?.string ?? "", tenantName: existing.accountLabel,
      tenantType: d["tenantType"]?.string ?? "", accessExpiresAt: accessExpiresAt,
      refreshExpiresAt: refreshExpiresAt, grantedScopes: existing.grantedScopes, now: now)
  }

  @discardableResult
  public func saveQuickBooksRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    realmId: String, companyName: String?, environment: String, accessExpiresAt: String?,
    refreshExpiresAt: String?, refreshHardExpiresAt: String?,
    grantedScopes: [String] = ProviderConnectionService.quickBooksRelayOwnedOAuthScopes,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "quickbooks")
    guard app.slug == "quickbooks" else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "QuickBooks OAuth can only be saved for the QuickBooks Online Marketplace app.")
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "QuickBooks OAuth access token", maxLength: 20000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "QuickBooks rolling refresh token", maxLength: 20000)
    let realm = try requireNonEmptyString(realmId, field: "QuickBooks realm ID", maxLength: 32)
    guard realm.allSatisfy(\.isNumber), !realm.isEmpty,
      ["sandbox", "production"].contains(environment)
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "QuickBooks requires a numeric realm ID and explicit sandbox or production environment.")
    }
    let scopes = grantedScopes.isEmpty ? Self.quickBooksRelayOwnedOAuthScopes : grantedScopes
    let missing = Self.quickBooksRelayOwnedOAuthScopes.filter { !scopes.contains($0) }
    let extras = scopes.filter { !Self.quickBooksRelayOwnedOAuthScopes.contains($0) }
    guard extras.isEmpty else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "QuickBooks V1 rejects OpenID, broader payroll/payment scopes, and all scopes beyond com.intuit.quickbooks.accounting, payroll.compensation.read, and com.intuit.quickbooks.payment."
      )
    }
    let ready = missing.isEmpty
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let oldRefs = existing.map(Self.secretReferenceIds(in:)) ?? []
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "QuickBooks OAuth access token",
      secretValue: access)
    let refreshRef: SecretReference
    do {
      refreshRef = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "QuickBooks rolling OAuth refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    let origin = RelayCloudLaunchContract.configuredRailwayOrigin
    let callback = origin.map { $0 + "/api/v1/oauth/quickbooks/callback" }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let label = companyName?.providerConnectionNilIfEmpty ?? "QuickBooks company " + realm
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "quickbooks_oauth_access_token", label: "QuickBooks OAuth access token",
        required: true, userOwnedRequired: false, secretReferenceId: accessRef.id,
        status: .verified,
        helpText: "Current one-hour access token stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "quickbooks_oauth_refresh_token", label: "QuickBooks rolling refresh token",
        required: true, userOwnedRequired: false, secretReferenceId: refreshRef.id,
        status: .verified,
        helpText: "Newest rolling refresh token atomically replaces the prior token pair.",
        redactionStatus: "secret-reference-only"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "quickbooks-relay-owned-oauth:" + environment + ":" + realm,
      providerName: "QuickBooks Online", status: ready ? .connected : .authRequired,
      authorizationState: ready ? .completed : .manualEvidenceRequired,
      credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
      credentialRequirements: requirements, secretReferenceIds: [accessRef.id, refreshRef.id],
      accountLabel: label, connectedHandle: realm, callbackURL: callback,
      requiredScopes: Self.quickBooksRelayOwnedOAuthScopes, grantedScopes: scopes,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: ready ? .ready : .degraded,
        message: ready
          ? "QuickBooks OAuth references are ready for the exact read-only company wrapper boundary."
          : "A required QuickBooks Accounting, Payroll Compensation, or Payments scope is missing.",
        lastCheckedAt: timestamp,
        missingScopes: missing,
        unavailableTools: ready
          ? []
          : [
            "quickbooks.company_info.get", "quickbooks.invoice.list", "quickbooks.invoice.get",
            "quickbooks.payroll_compensations.list", "quickbooks.payment_charge.get",
          ],
        diagnostics: [
          "provider": .string("quickbooks"),
          "authMethod": .string("intuit_oauth2_authorization_code_rolling_refresh"),
          "relayOwnedQuickBooksOAuth": .bool(true), "readOnlyWrapperV1": .bool(true),
          "providerScopeIsBroadReadWrite": .bool(true), "realmId": .string(realm),
          "payrollCompensationScopeOnly": .bool(true),
          "workforceProductionOnly": .bool(true),
          "paymentChargeReadOnly": .bool(true),
          "companyName": companyName?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
          "environment": .string(environment), "minorVersion": .number(75),
          "accessExpiresAt": accessExpiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string)
            ?? .null,
          "refreshExpiresAt": refreshExpiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string)
            ?? .null,
          "refreshHardExpiresAt": refreshHardExpiresAt?.providerConnectionNilIfEmpty.map(
            JSONValue.string) ?? .null,
          "accessTokenLifetimeSeconds": .number(3600),
          "refreshTokenRollingLifetimeSeconds": .number(8_640_000),
          "refreshTokenHardLifetimeSeconds": .number(157_680_000),
          "refreshTokenRotation": .string("serialized-atomic-newest-two-reference-replacement"),
          "financialWritesAllowed": .bool(false), "customerIdentityReturned": .bool(false),
          "requiresSecureWebBackend": .bool(true),
          "productionCallbackConfigured": .bool(callback != nil),
          "callbackTransport": .string("railway-https-only"),
          "rawTokenStoredInDatabase": .bool(false), "rawProviderToolExposure": .bool(false),
        ], redactionStatus: "private-state-excluded"), senderIdentities: [],
      installPolicy: "read_only_quickbooks_invoice_status", lastCheckedAt: timestamp,
      lastError: ready
        ? nil : "QuickBooks Accounting, Payroll Compensation, or Payments scope missing",
      manualEvidenceNote: callback == nil
        ? "Production QuickBooks OAuth requires CLAWCHAT_RAILWAY_ORIGIN and a deployed HTTPS callback/token-refresh/revocation broker."
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
  public func rotateQuickBooksOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String, accessExpiresAt: String?, refreshExpiresAt: String?,
    refreshHardExpiresAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    quickBooksTokenRotationLock.lock()
    defer { quickBooksTokenRotationLock.unlock() }
    guard
      let existing = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      existing.appSlug == "quickbooks"
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "QuickBooks connection is required for token rotation.")
    }
    let d = existing.health.diagnostics
    return try saveQuickBooksRelayOwnedOAuthConnection(
      context: context, appIdOrSlug: existing.appId, accessToken: accessToken,
      refreshToken: refreshToken, realmId: d["realmId"]?.string ?? "",
      companyName: existing.accountLabel, environment: d["environment"]?.string ?? "",
      accessExpiresAt: accessExpiresAt, refreshExpiresAt: refreshExpiresAt,
      refreshHardExpiresAt: refreshHardExpiresAt, grantedScopes: existing.grantedScopes, now: now)
  }

  @discardableResult
  public func saveFreshBooksRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    businessId: String, businessUUID: String, businessName: String?, accountId: String,
    membershipRole: String?, accessExpiresAt: String?, accessExpiresInSeconds: Int?,
    grantedScopes: [String] = ProviderConnectionService.freshBooksRelayOwnedOAuthScopes,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "freshbooks")
    guard app.slug == "freshbooks" else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "FreshBooks OAuth can only be saved for the FreshBooks Marketplace app.")
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "FreshBooks Bearer token", maxLength: 20000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "FreshBooks single-use refresh token", maxLength: 20000)
    let business = try requireNonEmptyString(
      businessId, field: "FreshBooks business ID", maxLength: 32)
    let account = try requireNonEmptyString(
      accountId, field: "FreshBooks account ID", maxLength: 64)
    guard business.allSatisfy(\.isNumber), UUID(uuidString: businessUUID) != nil,
      account.allSatisfy({ $0.isLetter || $0.isNumber || $0 == "-" || $0 == "_" })
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "FreshBooks requires an exact numeric business ID, business UUID, and safe account ID.")
    }
    let scopes = grantedScopes.isEmpty ? Self.freshBooksRelayOwnedOAuthScopes : grantedScopes
    let missing = Self.freshBooksRelayOwnedOAuthScopes.filter { !scopes.contains($0) }
    let extras = scopes.filter { !Self.freshBooksRelayOwnedOAuthScopes.contains($0) }
    guard extras.isEmpty else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "FreshBooks V1 rejects scopes beyond user:profile:read and user:invoices:read.")
    }
    let ready = missing.isEmpty
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let oldRefs = existing.map(Self.secretReferenceIds(in:)) ?? []
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "FreshBooks Bearer token",
      secretValue: access)
    let refreshRef: SecretReference
    do {
      refreshRef = try secrets.set(
        scope: "provider_connection", scopeId: id,
        label: "FreshBooks single-use rolling refresh token", secretValue: refresh)
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    let origin = RelayCloudLaunchContract.configuredRailwayOrigin
    let callback = origin.map { $0 + "/api/v1/oauth/freshbooks/callback" }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let label = businessName?.providerConnectionNilIfEmpty ?? "FreshBooks business " + business
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "freshbooks_oauth_access_token", label: "FreshBooks Bearer token", required: true,
        userOwnedRequired: false, secretReferenceId: accessRef.id, status: .verified,
        helpText: "Current response-expiring Bearer token stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "freshbooks_oauth_refresh_token", label: "FreshBooks single-use refresh token",
        required: true, userOwnedRequired: false, secretReferenceId: refreshRef.id,
        status: .verified,
        helpText: "Only live refresh token atomically replaced with every newly issued token pair.",
        redactionStatus: "secret-reference-only"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "freshbooks-relay-owned-oauth:" + business + ":" + account,
      providerName: "FreshBooks", status: ready ? .connected : .authRequired,
      authorizationState: ready ? .completed : .manualEvidenceRequired,
      credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
      credentialRequirements: requirements, secretReferenceIds: [accessRef.id, refreshRef.id],
      accountLabel: label, connectedHandle: account, callbackURL: callback,
      requiredScopes: Self.freshBooksRelayOwnedOAuthScopes, grantedScopes: scopes,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: ready ? .ready : .degraded,
        message: ready
          ? "FreshBooks OAuth references are ready for the exact business/account read boundary."
          : "FreshBooks read scopes are incomplete.", lastCheckedAt: timestamp,
        missingScopes: missing,
        unavailableTools: ready
          ? []
          : [
            "freshbooks.business_memberships.list", "freshbooks.invoice.list",
            "freshbooks.invoice.get",
          ],
        diagnostics: [
          "provider": .string("freshbooks"),
          "authMethod": .string("oauth2_authorization_code_single_use_rolling_refresh"),
          "relayOwnedFreshBooksOAuth": .bool(true), "readOnlyV1": .bool(true),
          "businessId": .string(business), "businessUUID": .string(businessUUID),
          "businessName": businessName?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
          "accountId": .string(account),
          "membershipRole": membershipRole?.providerConnectionNilIfEmpty.map(JSONValue.string)
            ?? .null,
          "accessExpiresAt": accessExpiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string)
            ?? .null,
          "accessExpiresInSeconds": accessExpiresInSeconds.map { .number(Double($0)) } ?? .null,
          "refreshTokenLifetime": .string("perpetual-until-use-revocation-or-reauthorization"),
          "refreshTokenRotation": .string("serialized-single-use-atomic-two-reference-replacement"),
          "financialWritesAllowed": .bool(false), "profilePIIReturned": .bool(false),
          "requiresSecureWebBackend": .bool(true),
          "productionCallbackConfigured": .bool(callback != nil),
          "callbackTransport": .string("railway-https-only"),
          "rawTokenStoredInDatabase": .bool(false), "rawProviderToolExposure": .bool(false),
        ], redactionStatus: "private-state-excluded"), senderIdentities: [],
      installPolicy: "read_only_freshbooks_invoice_status", lastCheckedAt: timestamp,
      lastError: ready ? nil : "FreshBooks scope mismatch",
      manualEvidenceNote: callback == nil
        ? "Production FreshBooks OAuth requires CLAWCHAT_RAILWAY_ORIGIN and a deployed HTTPS callback/token-refresh/revocation broker."
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
  @discardableResult public func rotateFreshBooksOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String, accessExpiresAt: String?, accessExpiresInSeconds: Int?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    freshBooksTokenRotationLock.lock()
    defer { freshBooksTokenRotationLock.unlock() }
    guard
      let existing = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      existing.appSlug == "freshbooks"
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "FreshBooks connection is required for token rotation.")
    }
    let d = existing.health.diagnostics
    return try saveFreshBooksRelayOwnedOAuthConnection(
      context: context, appIdOrSlug: existing.appId, accessToken: accessToken,
      refreshToken: refreshToken, businessId: d["businessId"]?.string ?? "",
      businessUUID: d["businessUUID"]?.string ?? "", businessName: existing.accountLabel,
      accountId: d["accountId"]?.string ?? "", membershipRole: d["membershipRole"]?.string,
      accessExpiresAt: accessExpiresAt, accessExpiresInSeconds: accessExpiresInSeconds,
      grantedScopes: existing.grantedScopes, now: now)
  }

  @discardableResult
  public func saveWaveRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    userId: String, businessId: String, businessName: String?, isPersonal: Bool,
    subscriptionEligible: Bool, accessExpiresAt: String?, accessExpiresInSeconds: Int?,
    grantedScopes: [String] = ProviderConnectionService.waveRelayOwnedOAuthScopes,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "wave")
    guard app.slug == "wave" else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Wave OAuth can only be saved for the Wave Marketplace app.")
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "Wave OAuth access token", maxLength: 20000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "Wave OAuth refresh token", maxLength: 20000)
    let user = try requireNonEmptyString(userId, field: "Wave user ID", maxLength: 256)
    let business = try requireNonEmptyString(businessId, field: "Wave business ID", maxLength: 256)
    let safe: (String) -> Bool = {
      !$0.isEmpty && $0.allSatisfy { $0.isLetter || $0.isNumber || "+/=_-".contains($0) }
    }
    guard safe(user), safe(business), subscriptionEligible else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "Wave requires safe opaque user/business IDs and an active Pro or Wave Advisor subscription."
      )
    }
    let scopes = grantedScopes.isEmpty ? Self.waveRelayOwnedOAuthScopes : grantedScopes
    let missing = Self.waveRelayOwnedOAuthScopes.filter { !scopes.contains($0) }
    let extras = scopes.filter { !Self.waveRelayOwnedOAuthScopes.contains($0) }
    guard extras.isEmpty else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Wave V1 rejects scopes beyond business:read and invoice:read.")
    }
    let ready = missing.isEmpty
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let oldRefs = existing.map(Self.secretReferenceIds(in:)) ?? []
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Wave OAuth access token",
      secretValue: access)
    let refreshRef: SecretReference
    do {
      refreshRef = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Wave OAuth refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    let origin = RelayCloudLaunchContract.configuredRailwayOrigin
    let callback = origin.map { $0 + "/api/v1/oauth/wave/callback" }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let label = businessName?.providerConnectionNilIfEmpty ?? "Wave business"
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "wave_oauth_access_token", label: "Wave OAuth access token", required: true,
        userOwnedRequired: false, secretReferenceId: accessRef.id, status: .verified,
        helpText: "Response-expiring access token stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "wave_oauth_refresh_token", label: "Wave OAuth refresh token", required: true,
        userOwnedRequired: false, secretReferenceId: refreshRef.id, status: .verified,
        helpText:
          "Refresh credential stored separately and replaced with the newest returned value.",
        redactionStatus: "secret-reference-only"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "wave-relay-owned-oauth:" + business, providerName: "Wave",
      status: ready ? .connected : .authRequired,
      authorizationState: ready ? .completed : .manualEvidenceRequired,
      credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
      credentialRequirements: requirements, secretReferenceIds: [accessRef.id, refreshRef.id],
      accountLabel: label, connectedHandle: business, callbackURL: callback,
      requiredScopes: Self.waveRelayOwnedOAuthScopes, grantedScopes: scopes,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: ready ? .ready : .degraded,
        message: ready
          ? "Wave OAuth references are ready for the exact subscription-eligible business."
          : "Wave read scopes are incomplete.", lastCheckedAt: timestamp, missingScopes: missing,
        unavailableTools: ready
          ? [] : ["wave.business.get", "wave.invoice.list", "wave.invoice.get"],
        diagnostics: [
          "provider": .string("wave"), "authMethod": .string("oauth2_authorization_code_refresh"),
          "relayOwnedWaveOAuth": .bool(true), "readOnlyV1": .bool(true), "userId": .string(user),
          "businessId": .string(business),
          "businessName": businessName?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
          "isPersonal": .bool(isPersonal), "subscriptionEligible": .bool(subscriptionEligible),
          "accessExpiresAt": accessExpiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string)
            ?? .null,
          "accessExpiresInSeconds": accessExpiresInSeconds.map { .number(Double($0)) } ?? .null,
          "tokenRotation": .string("serialized-atomic-newest-two-reference-replacement"),
          "graphqlEndpoint": .string("gql.waveapps.com/graphql/public"),
          "financialWritesAllowed": .bool(false), "customerPIIReturned": .bool(false),
          "requiresSecureWebBackend": .bool(true),
          "productionCallbackConfigured": .bool(callback != nil),
          "callbackTransport": .string("railway-https-only"), "fullAccessTokenUsed": .bool(false),
          "rawTokenStoredInDatabase": .bool(false), "rawProviderToolExposure": .bool(false),
        ], redactionStatus: "private-state-excluded"), senderIdentities: [],
      installPolicy: "read_only_wave_invoice_status", lastCheckedAt: timestamp,
      lastError: ready ? nil : "Wave scope mismatch",
      manualEvidenceNote: callback == nil
        ? "Production Wave OAuth requires CLAWCHAT_RAILWAY_ORIGIN and a deployed HTTPS callback/token-refresh/revocation broker."
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
  @discardableResult public func rotateWaveOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String, accessExpiresAt: String?, accessExpiresInSeconds: Int?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    waveTokenRotationLock.lock()
    defer { waveTokenRotationLock.unlock() }
    guard
      let existing = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId), existing.appSlug == "wave"
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Wave connection is required for token rotation.")
    }
    let d = existing.health.diagnostics
    return try saveWaveRelayOwnedOAuthConnection(
      context: context, appIdOrSlug: existing.appId, accessToken: accessToken,
      refreshToken: refreshToken, userId: d["userId"]?.string ?? "",
      businessId: d["businessId"]?.string ?? "", businessName: existing.accountLabel,
      isPersonal: d["isPersonal"]?.bool ?? false,
      subscriptionEligible: d["subscriptionEligible"]?.bool ?? false,
      accessExpiresAt: accessExpiresAt, accessExpiresInSeconds: accessExpiresInSeconds,
      grantedScopes: existing.grantedScopes, now: now)
  }

  @discardableResult
  public func saveFreeAgentRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    userId: String, companyId: Int, companyName: String?, companyType: String?, currency: String?,
    permissionLevel: Int, environment: String = "production", accessExpiresAt: String?,
    accessExpiresInSeconds: Int?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "freeagent")
    guard app.slug == "freeagent" else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "FreeAgent OAuth can only be saved for the FreeAgent Marketplace app.")
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "FreeAgent OAuth access token", maxLength: 20000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "FreeAgent OAuth refresh token", maxLength: 20000)
    let user = try requireNonEmptyString(userId, field: "FreeAgent user ID", maxLength: 256)
    let env = environment.lowercased()
    guard user.allSatisfy({ $0.isLetter || $0.isNumber || "_-".contains($0) }), companyId > 0,
      (4...8).contains(permissionLevel), ["production", "sandbox"].contains(env)
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "FreeAgent requires safe opaque user/company binding, production or sandbox, and permission level 4 or higher for Invoice reads."
      )
    }
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let oldRefs = existing.map(Self.secretReferenceIds(in:)) ?? []
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "FreeAgent OAuth access token",
      secretValue: access)
    let refreshRef: SecretReference
    do {
      refreshRef = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "FreeAgent OAuth refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    let origin = RelayCloudLaunchContract.configuredRailwayOrigin
    let callback = origin.map { $0 + "/api/v1/oauth/freeagent/callback" }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let label = companyName?.providerConnectionNilIfEmpty ?? "FreeAgent company \(companyId)"
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "freeagent_oauth_access_token", label: "FreeAgent OAuth access token",
        required: true, userOwnedRequired: false, secretReferenceId: accessRef.id,
        status: .verified,
        helpText: "Response-expiring Bearer token stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "freeagent_oauth_refresh_token", label: "FreeAgent OAuth refresh token",
        required: true, userOwnedRequired: false, secretReferenceId: refreshRef.id,
        status: .verified,
        helpText:
          "Newest refresh token stored separately and replaced with each returned token pair.",
        redactionStatus: "secret-reference-only"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "freeagent-relay-owned-oauth:\(env):\(companyId)", providerName: "FreeAgent",
      status: .connected, authorizationState: .completed, credentialOwnership: .relayOwned,
      userOwnedCredentialsRequired: false, credentialRequirements: requirements,
      secretReferenceIds: [accessRef.id, refreshRef.id], accountLabel: label,
      connectedHandle: String(companyId), callbackURL: callback,
      requiredScopes: Self.freeAgentPermissionRequirements,
      grantedScopes: Self.freeAgentPermissionRequirements, selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message:
          "FreeAgent OAuth references are ready for the exact token-bound company read boundary.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("freeagent"),
          "authMethod": .string("oauth2_authorization_code_refresh"),
          "relayOwnedFreeAgentOAuth": .bool(true), "readOnlyV1": .bool(true),
          "oauthGranularScopesAvailable": .bool(false), "broadUserPermissionConsent": .bool(true),
          "userId": .string(user), "companyId": .number(Double(companyId)),
          "companyName": companyName?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
          "companyType": companyType?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
          "currency": currency?.providerConnectionNilIfEmpty.map(JSONValue.string) ?? .null,
          "permissionLevel": .number(Double(permissionLevel)), "environment": .string(env),
          "accessExpiresAt": accessExpiresAt?.providerConnectionNilIfEmpty.map(JSONValue.string)
            ?? .null,
          "accessExpiresInSeconds": accessExpiresInSeconds.map { .number(Double($0)) } ?? .null,
          "tokenRotation": .string("serialized-atomic-newest-two-reference-replacement"),
          "financialWritesAllowed": .bool(false), "identityPIIReturned": .bool(false),
          "practiceAPIAccessAllowed": .bool(false), "requiresSecureWebBackend": .bool(true),
          "productionCallbackConfigured": .bool(callback != nil),
          "callbackTransport": .string("railway-https-only"),
          "rawTokenStoredInDatabase": .bool(false), "rawProviderToolExposure": .bool(false),
        ], redactionStatus: "private-state-excluded"), senderIdentities: [],
      installPolicy: "read_only_freeagent_invoice_status", lastCheckedAt: timestamp, lastError: nil,
      manualEvidenceNote: callback == nil
        ? "Production FreeAgent OAuth requires CLAWCHAT_RAILWAY_ORIGIN and a deployed HTTPS callback/token-refresh/disconnect broker."
        : "FreeAgent OAuth inherits the user permission level; Relay exposes only bounded reads.",
      reauthorizeRequired: false, disconnecting: false, betaBlocked: false,
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

  @discardableResult public func rotateFreeAgentOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String, accessExpiresAt: String?, accessExpiresInSeconds: Int?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    freeAgentTokenRotationLock.lock()
    defer { freeAgentTokenRotationLock.unlock() }
    guard
      let existing = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      existing.appSlug == "freeagent"
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "FreeAgent connection is required for token rotation.")
    }
    let d = existing.health.diagnostics
    return try saveFreeAgentRelayOwnedOAuthConnection(
      context: context, appIdOrSlug: existing.appId, accessToken: accessToken,
      refreshToken: refreshToken, userId: d["userId"]?.string ?? "",
      companyId: Int(d["companyId"]?.number ?? 0), companyName: existing.accountLabel,
      companyType: d["companyType"]?.string, currency: d["currency"]?.string,
      permissionLevel: Int(d["permissionLevel"]?.number ?? 0),
      environment: d["environment"]?.string ?? "production", accessExpiresAt: accessExpiresAt,
      accessExpiresInSeconds: accessExpiresInSeconds, now: now)
  }

  @discardableResult
  public func saveSalesforceRelayOwnedOAuthConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, accessToken: String, refreshToken: String,
    organizationId: String, userId: String, instanceURL: String, orgLabel: String?,
    accessIssuedAt: String?,
    grantedScopes: [String] = ProviderConnectionService.salesforceRelayOwnedOAuthScopes,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "salesforce")
    guard app.slug == "salesforce" else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "Salesforce OAuth can only be saved for the Salesforce Marketplace app.")
    }
    try validateAppCanAuthorize(app, context: context)
    let access = try requireNonEmptyString(
      accessToken, field: "Salesforce OAuth access token", maxLength: 20000)
    let refresh = try requireNonEmptyString(
      refreshToken, field: "Salesforce OAuth refresh token", maxLength: 20000)
    let org = try requireNonEmptyString(
      organizationId, field: "Salesforce organization ID", maxLength: 18)
    let user = try requireNonEmptyString(userId, field: "Salesforce user ID", maxLength: 18)
    let validId: (String) -> Bool = {
      [15, 18].contains($0.count) && $0.allSatisfy { $0.isLetter || $0.isNumber }
    }
    guard validId(org), validId(user),
      let instance = SalesforceProviderActionSupport.instanceURL(instanceURL)
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "Salesforce requires valid org/user IDs and an exact HTTPS salesforce.com instance URL.")
    }
    let scopes = grantedScopes.map { $0 == "offline_access" ? "refresh_token" : $0 }
    let missing = Self.salesforceRelayOwnedOAuthScopes.filter { !scopes.contains($0) }
    let extras = scopes.filter { !Self.salesforceRelayOwnedOAuthScopes.contains($0) }
    guard extras.isEmpty else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Salesforce V1 rejects scopes beyond api and refresh_token.")
    }
    let ready = missing.isEmpty
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let oldRefs = existing.map(Self.secretReferenceIds(in:)) ?? []
    let accessRef = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Salesforce OAuth access token",
      secretValue: access)
    let refreshRef: SecretReference
    do {
      refreshRef = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Salesforce OAuth refresh token",
        secretValue: refresh)
    } catch {
      _ = try? secrets.delete(accessRef.id)
      throw error
    }
    let origin = RelayCloudLaunchContract.configuredRailwayOrigin
    let callback = origin.map { $0 + "/api/v1/oauth/salesforce/callback" }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let label = orgLabel?.providerConnectionNilIfEmpty ?? "Salesforce org " + org
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "salesforce_oauth_access_token", label: "Salesforce OAuth access token",
        required: true, userOwnedRequired: false, secretReferenceId: accessRef.id,
        status: .verified,
        helpText: "Current Salesforce Bearer token stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "salesforce_oauth_refresh_token", label: "Salesforce OAuth refresh token",
        required: true, userOwnedRequired: false, secretReferenceId: refreshRef.id,
        status: .verified,
        helpText:
          "Admin-policy-controlled refresh credential stored separately and replaced when Salesforce returns a new value.",
        redactionStatus: "secret-reference-only"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "salesforce-relay-owned-eca-oauth:" + org + ":" + user,
      providerName: "Salesforce", status: ready ? .connected : .authRequired,
      authorizationState: ready ? .completed : .manualEvidenceRequired,
      credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
      credentialRequirements: requirements, secretReferenceIds: [accessRef.id, refreshRef.id],
      accountLabel: label, connectedHandle: org, callbackURL: callback,
      requiredScopes: Self.salesforceRelayOwnedOAuthScopes, grantedScopes: scopes,
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: ready ? .ready : .degraded,
        message: ready
          ? "Salesforce ECA OAuth references are ready for the exact org/user/instance read boundary."
          : "Salesforce OAuth scopes are incomplete.", lastCheckedAt: timestamp,
        missingScopes: missing,
        unavailableTools: ready
          ? []
          : [
            "salesforce.account.list", "salesforce.opportunity.list", "salesforce.opportunity.get",
          ],
        diagnostics: [
          "provider": .string("salesforce"),
          "authMethod": .string("oauth2_web_server_external_client_app"),
          "relayOwnedSalesforceECAOAuth": .bool(true), "readOnlyV1": .bool(true),
          "organizationId": .string(org), "userId": .string(user),
          "instanceURL": .string(instance.absoluteString),
          "apiVersion": .string(LiveSalesforceProviderActionClient.apiVersion),
          "accessIssuedAt": accessIssuedAt?.providerConnectionNilIfEmpty.map(JSONValue.string)
            ?? .null,
          "refreshTokenPolicy": .string("subscriber-admin-controlled-serialized-replacement"),
          "broadAPIScopeConstrained": .bool(true), "recordWritesAllowed": .bool(false),
          "identityPIIReturned": .bool(false), "arbitrarySOQLAllowed": .bool(false),
          "requiresSecureWebBackend": .bool(true),
          "productionCallbackConfigured": .bool(callback != nil),
          "callbackTransport": .string("railway-https-only"),
          "rawTokenStoredInDatabase": .bool(false), "rawProviderToolExposure": .bool(false),
        ], redactionStatus: "private-state-excluded"), senderIdentities: [],
      installPolicy: "approval_gated_salesforce_account_opportunity_reads",
      lastCheckedAt: timestamp, lastError: ready ? nil : "Salesforce scope mismatch",
      manualEvidenceNote: callback == nil
        ? "Production Salesforce ECA OAuth requires CLAWCHAT_RAILWAY_ORIGIN and a deployed HTTPS callback/identity/refresh/revocation broker."
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

  @discardableResult public func rotateSalesforceOAuthTokens(
    context: ServiceRequestContext, connectionId: RelayId, accessToken: String,
    refreshToken: String? = nil, accessIssuedAt: String?, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    salesforceTokenRotationLock.lock()
    defer { salesforceTokenRotationLock.unlock() }
    guard
      let existing = try data.getProviderConnection(
        workspaceId: context.workspaceId, connectionId: connectionId),
      existing.appSlug == "salesforce",
      let existingRefreshRef = existing.credentialRequirements.first(where: {
        $0.fieldKey == "salesforce_oauth_refresh_token"
      })?.secretReferenceId
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Salesforce connection is required for token rotation.")
    }
    let d = existing.health.diagnostics
    let refresh =
      try refreshToken?.providerConnectionNilIfEmpty ?? secrets.getSecretValue(existingRefreshRef)
    return try saveSalesforceRelayOwnedOAuthConnection(
      context: context, appIdOrSlug: existing.appId, accessToken: accessToken,
      refreshToken: refresh, organizationId: d["organizationId"]?.string ?? "",
      userId: d["userId"]?.string ?? "", instanceURL: d["instanceURL"]?.string ?? "",
      orgLabel: existing.accountLabel, accessIssuedAt: accessIssuedAt,
      grantedScopes: existing.grantedScopes, now: now)
  }
}
