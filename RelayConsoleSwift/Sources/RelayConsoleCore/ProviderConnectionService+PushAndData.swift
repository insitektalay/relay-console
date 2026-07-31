import Foundation

extension ProviderConnectionService {
  @discardableResult public func saveOneSignalCustomerAPIConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, appId: String, appAPIKey: String,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "onesignal")
    guard app.slug == "onesignal" else {
      throw ServiceGuard.invalidInput(
        context: context, message: "OneSignal credentials can only be saved for OneSignal.")
    }
    try validateAppCanAuthorize(app, context: context)
    let boundApp = try requireNonEmptyString(appId, field: "OneSignal App ID", maxLength: 36)
      .lowercased()
    let key = try requireNonEmptyString(appAPIKey, field: "OneSignal App API Key", maxLength: 4096)
    guard
      boundApp.range(
        of: #"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"#,
        options: .regularExpression) != nil, !key.contains("\n"), !key.contains("\r")
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "OneSignal requires an exact UUID v4 App ID and valid App API Key.")
    }
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let old = existing.map(Self.secretReferenceIds(in:)) ?? []
    let a = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "OneSignal App ID", secretValue: boundApp)
    let k: SecretReference
    do {
      k = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "OneSignal App API Key", secretValue: key)
    } catch {
      _ = try? secrets.delete(a.id)
      throw error
    }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "onesignal_app_id", label: "OneSignal App ID", required: true,
        userOwnedRequired: true, secretReferenceId: a.id, status: .verified,
        helpText: "Exact UUID v4 App binding stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "onesignal_app_api_key", label: "OneSignal App API Key", required: true,
        userOwnedRequired: true, secretReferenceId: k.id, status: .verified,
        helpText:
          "Dedicated single-app API key stored as a Keychain reference and sent only as Authorization: Key.",
        redactionStatus: "secret-reference-only"),
    ]
    let suffix = String(boundApp.suffix(8))
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "onesignal:" + boundApp, providerName: "OneSignal", status: .connected,
      authorizationState: .completed, credentialOwnership: .userOwned,
      userOwnedCredentialsRequired: true, credentialRequirements: requirements,
      secretReferenceIds: [a.id, k.id], accountLabel: "OneSignal app …" + suffix,
      connectedHandle: "onesignal:" + suffix, callbackURL: nil, requiredScopes: [],
      grantedScopes: [], selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message: "OneSignal App API Key is ready for exact app-bound delivery-summary validation.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("onesignal"), "authMethod": .string("customer_owned_app_api_key"),
          "appId": .string(boundApp), "apiOrigin": .string("https://api.onesignal.com"),
          "readOnlyV1": .bool(true), "contentReturned": .bool(false),
          "targetingReturned": .bool(false), "recipientDataReturned": .bool(false),
          "writesEnabled": .bool(false), "offset": .number(0), "maxMessages": .number(25),
          "viewRequestsPerSecondPerApp": .number(1), "responseCapBytes": .number(1_000_000),
          "rawCredentialStoredInDatabase": .bool(false),
        ], redactionStatus: "content-targeting-recipient-and-outcome-detail-excluded"),
      senderIdentities: [], installPolicy: "approval_gated_onesignal_delivery_summary_read",
      lastCheckedAt: timestamp, lastError: nil,
      manualEvidenceNote:
        "OneSignal requires eligible app access, a dedicated App API Key, exact App ID, optional IP allowlisting, and live acceptance.",
      reauthorizeRequired: false, disconnecting: false, betaBlocked: false,
      createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp,
      redactionStatus: "content-targeting-recipient-and-outcome-detail-excluded")
    do {
      let saved = try saveConnection(context: context, connection: connection)
      for ref in old where !saved.secretReferenceIds.contains(ref) { _ = try? secrets.delete(ref) }
      return saved
    } catch {
      _ = try? secrets.delete(a.id)
      _ = try? secrets.delete(k.id)
      throw error
    }
  }
  @discardableResult public func saveAirshipCustomerBearerConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, bearerToken: String, cloudSite: String,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "airship")
    guard app.slug == "airship" else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Airship credentials can only be saved for Airship.")
    }
    try validateAppCanAuthorize(app, context: context)
    let token = try requireNonEmptyString(
      bearerToken, field: "Airship bearer token", maxLength: 30000)
    let site = try requireNonEmptyString(cloudSite, field: "Airship cloud site", maxLength: 2)
      .lowercased()
    guard !token.contains("\n"), !token.contains("\r"), site == "na" || site == "eu" else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Airship requires a valid bearer token and na or eu cloud site.")
    }
    let origin = site == "na" ? "https://go.urbanairship.com" : "https://go.airship.eu"
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let old = existing.map(Self.secretReferenceIds(in:)) ?? []
    let t = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Airship bearer token", secretValue: token)
    let s: SecretReference
    do {
      s = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Airship cloud site", secretValue: site)
    } catch {
      _ = try? secrets.delete(t.id)
      throw error
    }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "airship_bearer_token", label: "Airship bearer token", required: true,
        userOwnedRequired: true, secretReferenceId: t.id, status: .verified,
        helpText: "Customer-generated revocable role token stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "airship_cloud_site", label: "Airship cloud site", required: true,
        userOwnedRequired: true, secretReferenceId: s.id, status: .verified,
        helpText: "Exact NA/EU HTTP API origin binding stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "airship:" + site + ":token-bound-project", providerName: "Airship",
      status: .connected, authorizationState: .completed, credentialOwnership: .userOwned,
      userOwnedCredentialsRequired: true, credentialRequirements: requirements,
      secretReferenceIds: [t.id, s.id], accountLabel: "Airship " + site.uppercased() + " project",
      connectedHandle: "airship:" + site, callbackURL: nil, requiredScopes: [], grantedScopes: [],
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message: "Airship role token is ready for exact cloud-site segment-reference validation.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("airship"),
          "authMethod": .string("customer_generated_role_bearer_token"), "cloudSite": .string(site),
          "apiOrigin": .string(origin), "readOnlyV1": .bool(true),
          "segmentNamesReturned": .bool(false), "criteriaReturned": .bool(false),
          "audienceDataReturned": .bool(false), "writesEnabled": .bool(false),
          "maxSegments": .number(25), "responseCapBytes": .number(1_000_000),
          "rawCredentialStoredInDatabase": .bool(false),
        ], redactionStatus: "segment-names-criteria-audiences-and-pagination-urls-excluded"),
      senderIdentities: [], installPolicy: "approval_gated_airship_segment_reference_read",
      lastCheckedAt: timestamp, lastError: nil,
      manualEvidenceNote:
        "Airship requires eligible project access, a customer-generated least-privilege bearer token, exact cloud site, and live acceptance.",
      reauthorizeRequired: false, disconnecting: false, betaBlocked: false,
      createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp,
      redactionStatus: "segment-names-criteria-audiences-and-pagination-urls-excluded")
    do {
      let saved = try saveConnection(context: context, connection: connection)
      for ref in old where !saved.secretReferenceIds.contains(ref) { _ = try? secrets.delete(ref) }
      return saved
    } catch {
      _ = try? secrets.delete(t.id)
      _ = try? secrets.delete(s.id)
      throw error
    }
  }

  @discardableResult public func savePushwooshCustomerServerTokenConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, apiToken: String, applicationCode: String,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "pushwoosh")
    guard app.slug == "pushwoosh" else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Pushwoosh credentials can only be saved for Pushwoosh.")
    }
    try validateAppCanAuthorize(app, context: context)
    let token = try requireNonEmptyString(
      apiToken, field: "Pushwoosh Server API token", maxLength: 30000)
    let code = try requireNonEmptyString(
      applicationCode, field: "Pushwoosh application code", maxLength: 11
    ).uppercased()
    guard !token.contains("\n"), !token.contains("\r"),
      code.range(of: #"^[A-Z0-9]{5}-[A-Z0-9]{5}$"#, options: .regularExpression) != nil
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "Pushwoosh requires a valid Server API token and exact XXXXX-XXXXX application code.")
    }
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let old = existing.map(Self.secretReferenceIds(in:)) ?? []
    let t = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Pushwoosh Server API token",
      secretValue: token)
    let c: SecretReference
    do {
      c = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Pushwoosh application code",
        secretValue: code)
    } catch {
      _ = try? secrets.delete(t.id)
      throw error
    }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "pushwoosh_api_token", label: "Pushwoosh Server API token", required: true,
        userOwnedRequired: true, secretReferenceId: t.id, status: .verified,
        helpText:
          "Customer-generated project-assigned Server API token stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "pushwoosh_application_code", label: "Pushwoosh application code", required: true,
        userOwnedRequired: true, secretReferenceId: c.id, status: .verified,
        helpText: "Exact application binding stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "pushwoosh:" + code, providerName: "Pushwoosh", status: .connected,
      authorizationState: .completed, credentialOwnership: .userOwned,
      userOwnedCredentialsRequired: true, credentialRequirements: requirements,
      secretReferenceIds: [t.id, c.id], accountLabel: "Pushwoosh app " + code,
      connectedHandle: "pushwoosh:" + code, callbackURL: nil, requiredScopes: [], grantedScopes: [],
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message:
          "Pushwoosh Server API token is ready for exact app-bound aggregate subscriber-statistics validation.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("pushwoosh"),
          "authMethod": .string("customer_owned_server_api_token"),
          "applicationCode": .string(code), "apiOrigin": .string("https://api.pushwoosh.com"),
          "readOnlyV1": .bool(true), "windowHours": .number(24), "maxAggregateRows": .number(100),
          "userDataReturned": .bool(false), "deviceDataReturned": .bool(false),
          "contentReturned": .bool(false), "writesEnabled": .bool(false),
          "responseCapBytes": .number(1_000_000), "rawCredentialStoredInDatabase": .bool(false),
        ],
        redactionStatus:
          "users-devices-tags-events-content-targeting-and-detailed-analytics-excluded"),
      senderIdentities: [],
      installPolicy: "approval_gated_pushwoosh_subscriber_status_summary_read",
      lastCheckedAt: timestamp, lastError: nil,
      manualEvidenceNote:
        "Pushwoosh requires eligible project access, a customer-generated project-assigned Server API token, exact application code, and live acceptance.",
      reauthorizeRequired: false, disconnecting: false, betaBlocked: false,
      createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp,
      redactionStatus: "users-devices-tags-events-content-targeting-and-detailed-analytics-excluded"
    )
    do {
      let saved = try saveConnection(context: context, connection: connection)
      for ref in old where !saved.secretReferenceIds.contains(ref) { _ = try? secrets.delete(ref) }
      return saved
    } catch {
      _ = try? secrets.delete(t.id)
      _ = try? secrets.delete(c.id)
      throw error
    }
  }

  @discardableResult public func savePusherBeamsCustomerConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, instanceId: String, secretKey: String,
    interest: String, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "pusher-beams")
    guard app.slug == "pusher-beams" else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Pusher Beams credentials can only be saved for Pusher Beams.")
    }
    try validateAppCanAuthorize(app, context: context)
    let instance = try requireNonEmptyString(
      instanceId, field: "Pusher Beams instance ID", maxLength: 36
    ).lowercased()
    let secret = try requireNonEmptyString(
      secretKey, field: "Pusher Beams secret key", maxLength: 30000)
    let boundInterest = try requireNonEmptyString(
      interest, field: "Pusher Beams Device Interest", maxLength: 164)
    guard
      instance.range(
        of: #"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"#,
        options: .regularExpression) != nil, !secret.contains("\n"), !secret.contains("\r"),
      boundInterest.range(of: #"^[A-Za-z0-9_\-=@,.;]{1,164}$"#, options: .regularExpression) != nil
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "Pusher Beams requires a UUID v4 instance, valid secret key, and one valid Device Interest."
      )
    }
    let origin = "https://" + instance + ".pushnotifications.pusher.com"
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let old = existing.map(Self.secretReferenceIds(in:)) ?? []
    let i = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Pusher Beams instance ID",
      secretValue: instance)
    let s: SecretReference
    let c: SecretReference
    do {
      s = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Pusher Beams secret key",
        secretValue: secret)
    } catch {
      _ = try? secrets.delete(i.id)
      throw error
    }
    do {
      c = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Pusher Beams Device Interest",
        secretValue: boundInterest)
    } catch {
      _ = try? secrets.delete(i.id)
      _ = try? secrets.delete(s.id)
      throw error
    }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "pusher_beams_instance_id", label: "Pusher Beams instance ID", required: true,
        userOwnedRequired: true, secretReferenceId: i.id, status: .verified,
        helpText: "Exact UUID instance binding stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "pusher_beams_secret_key", label: "Pusher Beams secret key", required: true,
        userOwnedRequired: true, secretReferenceId: s.id, status: .verified,
        helpText: "Customer instance secret stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "pusher_beams_interest", label: "Bound Device Interest", required: true,
        userOwnedRequired: true, secretReferenceId: c.id, status: .verified,
        helpText: "Exact anonymous audience binding stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "pusher-beams:" + instance + ":" + boundInterest, providerName: "Pusher Beams",
      status: .connected, authorizationState: .completed, credentialOwnership: .userOwned,
      userOwnedCredentialsRequired: true, credentialRequirements: requirements,
      secretReferenceIds: [i.id, s.id, c.id],
      accountLabel: "Pusher Beams …" + String(instance.suffix(8)) + " / " + boundInterest,
      connectedHandle: "pusher-beams:" + String(instance.suffix(8)), callbackURL: nil,
      requiredScopes: [], grantedScopes: [], selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message:
          "Pusher Beams credentials are syntax-valid and ready for approval-controlled live publishing acceptance.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("pusher-beams"),
          "authMethod": .string("customer_owned_instance_secret"), "instanceId": .string(instance),
          "boundInterest": .string(boundInterest), "apiOrigin": .string(origin),
          "readOnlyV1": .bool(false), "approvalRequired": .bool(true), "maxInterests": .number(1),
          "maxTitleCharacters": .number(100), "maxBodyCharacters": .number(1000),
          "requestCapBytes": .number(10240), "responseCapBytes": .number(1_000_000),
          "automaticRetry": .bool(false), "rawCredentialStoredInDatabase": .bool(false),
        ], redactionStatus: "users-devices-tokens-and-arbitrary-payloads-excluded"),
      senderIdentities: [],
      installPolicy: "approval_gated_pusher_beams_interest_notification_publish",
      lastCheckedAt: timestamp, lastError: nil,
      manualEvidenceNote:
        "Pusher Beams requires an eligible configured instance, customer secret, verified Device Interest audience, and live approval-controlled acceptance.",
      reauthorizeRequired: false, disconnecting: false, betaBlocked: false,
      createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp,
      redactionStatus: "users-devices-tokens-and-arbitrary-payloads-excluded")
    do {
      let saved = try saveConnection(context: context, connection: connection)
      for ref in old where !saved.secretReferenceIds.contains(ref) { _ = try? secrets.delete(ref) }
      return saved
    } catch {
      _ = try? secrets.delete(i.id)
      _ = try? secrets.delete(s.id)
      _ = try? secrets.delete(c.id)
      throw error
    }
  }

  @discardableResult public func saveFirebaseCloudMessagingCustomerConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, serviceAccountJSON: String, topic: String,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "firebase-cloud-messaging")
    guard app.slug == "firebase-cloud-messaging" else {
      throw ServiceGuard.invalidInput(
        context: context, message: "FCM credentials can only be saved for Firebase Cloud Messaging."
      )
    }
    try validateAppCanAuthorize(app, context: context)
    let json = try requireNonEmptyString(
      serviceAccountJSON, field: "FCM service-account JSON", maxLength: 50000)
    let boundTopic = try requireNonEmptyString(topic, field: "FCM topic", maxLength: 900)
    guard let raw = json.data(using: .utf8),
      let account = (try? JSONSerialization.jsonObject(with: raw)) as? [String: Any],
      let project = account["project_id"] as? String,
      let email = account["client_email"] as? String, let key = account["private_key"] as? String,
      project.range(of: #"^[a-z][a-z0-9-]{4,28}[a-z0-9]$"#, options: .regularExpression) != nil,
      email.hasSuffix(".gserviceaccount.com"), key.contains("BEGIN PRIVATE KEY"),
      boundTopic.range(of: #"^[A-Za-z0-9_.~%-]{1,900}$"#, options: .regularExpression) != nil,
      !boundTopic.hasPrefix("/topics/")
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "FCM requires a valid project service-account JSON and one unprefixed topic.")
    }
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let old = existing.map(Self.secretReferenceIds(in:)) ?? []
    let j = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "FCM service-account JSON",
      secretValue: json)
    let t: SecretReference
    do {
      t = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "FCM topic", secretValue: boundTopic)
    } catch {
      _ = try? secrets.delete(j.id)
      throw error
    }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "fcm_service_account_json", label: "FCM service-account JSON", required: true,
        userOwnedRequired: true, secretReferenceId: j.id, status: .verified,
        helpText: "Dedicated project service account stored as one Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "fcm_topic", label: "Bound FCM topic", required: true, userOwnedRequired: true,
        secretReferenceId: t.id, status: .verified,
        helpText: "Exact public-information audience binding stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "firebase-cloud-messaging:" + project + ":" + boundTopic,
      providerName: "Firebase Cloud Messaging", status: .connected, authorizationState: .completed,
      credentialOwnership: .userOwned, userOwnedCredentialsRequired: true,
      credentialRequirements: requirements, secretReferenceIds: [j.id, t.id],
      accountLabel: "FCM " + project + " / " + boundTopic, connectedHandle: "fcm:" + project,
      callbackURL: nil, requiredScopes: ["https://www.googleapis.com/auth/firebase.messaging"],
      grantedScopes: ["https://www.googleapis.com/auth/firebase.messaging"],
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message:
          "FCM service account and topic binding are syntax-valid and ready for approval-controlled live acceptance.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("firebase-cloud-messaging"),
          "authMethod": .string("customer_owned_service_account"), "projectId": .string(project),
          "boundTopic": .string(boundTopic), "apiOrigin": .string("https://fcm.googleapis.com"),
          "tokenOrigin": .string("https://oauth2.googleapis.com"), "approvalRequired": .bool(true),
          "maxTitleCharacters": .number(100), "maxBodyCharacters": .number(1000),
          "automaticRetry": .bool(false), "rawCredentialStoredInDatabase": .bool(false),
        ], redactionStatus: "device-tokens-users-data-payloads-and-platform-overrides-excluded"),
      senderIdentities: [], installPolicy: "approval_gated_fcm_topic_notification_publish",
      lastCheckedAt: timestamp, lastError: nil,
      manualEvidenceNote:
        "FCM requires HTTP v1, configured clients, a least-privilege service account, verified topic audience, and live approval-controlled acceptance.",
      reauthorizeRequired: false, disconnecting: false, betaBlocked: false,
      createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp,
      redactionStatus: "device-tokens-users-data-payloads-and-platform-overrides-excluded")
    do {
      let saved = try saveConnection(context: context, connection: connection)
      for ref in old where !saved.secretReferenceIds.contains(ref) { _ = try? secrets.delete(ref) }
      return saved
    } catch {
      _ = try? secrets.delete(j.id)
      _ = try? secrets.delete(t.id)
      throw error
    }
  }

  @discardableResult public func saveAppsFlyerCustomerTokenConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, apiToken: String, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "appsflyer")
    guard app.slug == "appsflyer" else {
      throw ServiceGuard.invalidInput(
        context: context, message: "AppsFlyer credentials can only be saved for AppsFlyer.")
    }
    try validateAppCanAuthorize(app, context: context)
    let token = try requireNonEmptyString(
      apiToken, field: "AppsFlyer API V2 token", maxLength: 30000)
    guard !token.contains("\n"), !token.contains("\r") else {
      throw ServiceGuard.invalidInput(context: context, message: "AppsFlyer token is invalid.")
    }
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let old = existing.map(Self.secretReferenceIds(in:)) ?? []
    let ref = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "AppsFlyer API V2 token", secretValue: token
    )
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "appsflyer_api_token", label: "AppsFlyer API V2 token", required: true,
        userOwnedRequired: true, secretReferenceId: ref.id, status: .verified,
        helpText:
          "Current dedicated bearer token shared by canonical AppsFlyer and its premium Audiences module, stored as a Keychain reference.",
        redactionStatus: "secret-reference-only")
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "appsflyer:token-bound-account", providerName: "AppsFlyer", status: .connected,
      authorizationState: .completed, credentialOwnership: .userOwned,
      userOwnedCredentialsRequired: true, credentialRequirements: requirements,
      secretReferenceIds: [ref.id], accountLabel: "AppsFlyer account",
      connectedHandle: "appsflyer:account", callbackURL: nil, requiredScopes: [], grantedScopes: [],
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message:
          "AppsFlyer API V2 token is ready for bounded App List validation; premium Audiences External API access remains entitlement-dependent until live acceptance.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("appsflyer"), "authMethod": .string("customer_owned_api_v2_token"),
          "apiOrigin": .string("https://hq1.appsflyer.com"),
          "canonicalProviderForAudiences": .bool(true), "audiencesPremiumRequired": .bool(true),
          "readOnlyV1": .bool(true), "maxApps": .number(25),
          "maxAudiencePartnerConnections": .number(115), "automaticPagination": .bool(false),
          "automaticRetry": .bool(false), "responseCapBytes": .number(1_000_000),
          "rawCredentialStoredInDatabase": .bool(false),
        ],
        redactionStatus:
          "names-account-identity-audience-partner-member-attribution-content-and-pagination-urls-excluded"
      ), senderIdentities: [], installPolicy: "approval_gated_appsflyer_app_and_audience_readiness",
      lastCheckedAt: timestamp, lastError: nil,
      manualEvidenceNote:
        "AppsFlyer requires an eligible account and current API V2 token; Audiences additionally requires the premium product plus Audiences External API permission and live acceptance.",
      reauthorizeRequired: false, disconnecting: false, betaBlocked: false,
      createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp,
      redactionStatus:
        "names-account-identity-audience-partner-member-attribution-content-and-pagination-urls-excluded"
    )
    do {
      let saved = try saveConnection(context: context, connection: connection)
      for oldRef in old where !saved.secretReferenceIds.contains(oldRef) {
        _ = try? secrets.delete(oldRef)
      }
      return saved
    } catch {
      _ = try? secrets.delete(ref.id)
      throw error
    }
  }

  @discardableResult public func saveAdjustCustomerTokenConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, apiToken: String, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "adjust")
    guard app.slug == "adjust" else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Adjust credentials can only be saved for Adjust.")
    }
    try validateAppCanAuthorize(app, context: context)
    let token = try requireNonEmptyString(apiToken, field: "Adjust API token", maxLength: 30000)
    guard !token.contains("\n"), !token.contains("\r") else {
      throw ServiceGuard.invalidInput(context: context, message: "Adjust token is invalid.")
    }
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let old = existing.map(Self.secretReferenceIds(in:)) ?? []
    let ref = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Adjust API token", secretValue: token)
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "adjust_api_token", label: "Adjust API token", required: true,
        userOwnedRequired: true, secretReferenceId: ref.id, status: .verified,
        helpText: "Current dedicated bearer token stored as a Keychain reference.",
        redactionStatus: "secret-reference-only")
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "adjust:token-bound-account", providerName: "Adjust", status: .connected,
      authorizationState: .completed, credentialOwnership: .userOwned,
      userOwnedCredentialsRequired: true, credentialRequirements: requirements,
      secretReferenceIds: [ref.id], accountLabel: "Adjust account",
      connectedHandle: "adjust:account", callbackURL: nil, requiredScopes: [], grantedScopes: [],
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready, message: "Adjust API token is ready for bounded app-filter validation.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("adjust"), "authMethod": .string("customer_owned_api_token"),
          "apiOrigin": .string("https://automate.adjust.com"), "readOnlyV1": .bool(true),
          "maxApps": .number(25), "automaticPagination": .bool(false),
          "responseCapBytes": .number(1_000_000), "rawCredentialStoredInDatabase": .bool(false),
        ], redactionStatus: "names-account-identity-attribution-content-and-report-data-excluded"),
      senderIdentities: [], installPolicy: "approval_gated_adjust_app_reference_read",
      lastCheckedAt: timestamp, lastError: nil,
      manualEvidenceNote:
        "Adjust requires an eligible account, dedicated API token with Report Service app-filter permission, and live acceptance.",
      reauthorizeRequired: false, disconnecting: false, betaBlocked: false,
      createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp,
      redactionStatus: "names-account-identity-attribution-content-and-report-data-excluded")
    do {
      let saved = try saveConnection(context: context, connection: connection)
      for oldRef in old where !saved.secretReferenceIds.contains(oldRef) {
        _ = try? secrets.delete(oldRef)
      }
      return saved
    } catch {
      _ = try? secrets.delete(ref.id)
      throw error
    }
  }

  @discardableResult public func saveBranchBoundLinkConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, branchKey: String, linkURL: String,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "branch")
    guard app.slug == "branch" else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Branch credentials can only be saved for Branch.")
    }
    try validateAppCanAuthorize(app, context: context)
    let key = try requireNonEmptyString(branchKey, field: "Branch Key", maxLength: 300)
    let bound = try requireNonEmptyString(linkURL, field: "Bound Branch link URL", maxLength: 2048)
    guard
      key.range(of: #"^key_(live|test)_[A-Za-z0-9]{4,280}$"#, options: .regularExpression) != nil,
      let url = URL(string: bound), url.scheme?.lowercased() == "https", let host = url.host,
      !host.isEmpty, host.lowercased() != "localhost", !host.hasPrefix("127."), url.user == nil,
      url.password == nil, url.fragment == nil
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "Branch requires a valid live/test key and public HTTPS bound link without credentials or a fragment."
      )
    }
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let old = existing.map(Self.secretReferenceIds(in:)) ?? []
    let k = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Branch Key", secretValue: key)
    let u: SecretReference
    do {
      u = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Bound Branch link URL",
        secretValue: bound)
    } catch {
      _ = try? secrets.delete(k.id)
      throw error
    }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "branch_key", label: "Branch Key", required: true, userOwnedRequired: true,
        secretReferenceId: k.id, status: .verified,
        helpText: "Public app key encrypted as a Keychain reference and never returned to agents.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "branch_link_url", label: "Bound Branch link URL", required: true,
        userOwnedRequired: true, secretReferenceId: u.id, status: .verified,
        helpText:
          "Exact HTTPS link encrypted as a Keychain reference and never returned to agents.",
        redactionStatus: "secret-reference-only"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "branch:bound-link", providerName: "Branch", status: .connected,
      authorizationState: .completed, credentialOwnership: .userOwned,
      userOwnedCredentialsRequired: true, credentialRequirements: requirements,
      secretReferenceIds: [k.id, u.id], accountLabel: "Branch bound link",
      connectedHandle: "branch:bound-link", callbackURL: nil, requiredScopes: [], grantedScopes: [],
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message:
          "Branch Key and exact link binding are syntax-valid and ready for approval-controlled structural read acceptance.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("branch"), "authMethod": .string("customer_owned_branch_key"),
          "apiOrigin": .string("https://api2.branch.io"), "readOnlyV1": .bool(true),
          "approvalRequired": .bool(true), "exactLinkBinding": .bool(true),
          "linkValueReturned": .bool(false), "automaticPagination": .bool(false),
          "automaticRetry": .bool(false), "responseCapBytes": .number(1_000_000),
          "rawCredentialStoredInDatabase": .bool(false),
        ],
        redactionStatus:
          "link-url-destinations-tags-campaign-values-identity-attribution-and-device-data-excluded"
      ), senderIdentities: [], installPolicy: "approval_gated_branch_bound_link_structure_read",
      lastCheckedAt: timestamp, lastError: nil,
      manualEvidenceNote:
        "Branch requires an eligible app, exact live/test Branch Key, existing HTTPS Branch link, and live approval-controlled acceptance; reads may extend link expiration.",
      reauthorizeRequired: false, disconnecting: false, betaBlocked: false,
      createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp,
      redactionStatus:
        "link-url-destinations-tags-campaign-values-identity-attribution-and-device-data-excluded")
    do {
      let saved = try saveConnection(context: context, connection: connection)
      for oldRef in old where !saved.secretReferenceIds.contains(oldRef) {
        _ = try? secrets.delete(oldRef)
      }
      return saved
    } catch {
      _ = try? secrets.delete(k.id)
      _ = try? secrets.delete(u.id)
      throw error
    }
  }

  @discardableResult public func saveSingularCustomerAPIKeyConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, apiKey: String, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "singular")
    guard app.slug == "singular" else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Singular credentials can only be saved for Singular.")
    }
    try validateAppCanAuthorize(app, context: context)
    let key = try requireNonEmptyString(
      apiKey, field: "Singular Reporting API key", maxLength: 30000)
    guard !key.contains("\n"), !key.contains("\r") else {
      throw ServiceGuard.invalidInput(context: context, message: "Singular API key is invalid.")
    }
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let old = existing.map(Self.secretReferenceIds(in:)) ?? []
    let ref = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Singular Reporting API key",
      secretValue: key)
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "singular_api_key", label: "Singular Reporting API key", required: true,
        userOwnedRequired: true, secretReferenceId: ref.id, status: .verified,
        helpText: "Dedicated Authorization-header key stored as a Keychain reference.",
        redactionStatus: "secret-reference-only")
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "singular:api-key-account", providerName: "Singular", status: .connected,
      authorizationState: .completed, credentialOwnership: .userOwned,
      userOwnedCredentialsRequired: true, credentialRequirements: requirements,
      secretReferenceIds: [ref.id], accountLabel: "Singular account",
      connectedHandle: "singular:account", callbackURL: nil, requiredScopes: [], grantedScopes: [],
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message:
          "Singular Reporting API key is ready for bounded premium Singular Links Get Apps validation.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("singular"),
          "authMethod": .string("customer_owned_reporting_api_key"),
          "apiOrigin": .string("https://api.singular.net"), "readOnlyV1": .bool(true),
          "maxAppSites": .number(25), "getRequestsPerMinute": .number(4),
          "automaticPagination": .bool(false), "automaticRetry": .bool(false),
          "responseCapBytes": .number(1_000_000), "rawCredentialStoredInDatabase": .bool(false),
        ],
        redactionStatus:
          "names-store-urls-public-bundle-ids-links-partners-attribution-and-report-data-excluded"),
      senderIdentities: [], installPolicy: "approval_gated_singular_app_site_reference_read",
      lastCheckedAt: timestamp, lastError: nil,
      manualEvidenceNote:
        "Singular requires Enterprise/Commercial Singular Links API entitlement, a dedicated Reporting API key, and live acceptance.",
      reauthorizeRequired: false, disconnecting: false, betaBlocked: false,
      createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp,
      redactionStatus:
        "names-store-urls-public-bundle-ids-links-partners-attribution-and-report-data-excluded")
    do {
      let saved = try saveConnection(context: context, connection: connection)
      for oldRef in old where !saved.secretReferenceIds.contains(oldRef) {
        _ = try? secrets.delete(oldRef)
      }
      return saved
    } catch {
      _ = try? secrets.delete(ref.id)
      throw error
    }
  }
  @discardableResult public func saveKochavaCustomerAPIKeyConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, apiKey: String, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "kochava")
    guard app.slug == "kochava" else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Kochava credentials can only be saved for Kochava.")
    }
    try validateAppCanAuthorize(app, context: context)
    let key = try requireNonEmptyString(apiKey, field: "Kochava API key", maxLength: 30000)
    guard !key.contains("\n"), !key.contains("\r") else {
      throw ServiceGuard.invalidInput(context: context, message: "Kochava API key is invalid.")
    }
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let old = existing.map(Self.secretReferenceIds(in:)) ?? []
    let ref = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Kochava API key", secretValue: key)
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "kochava_api_key", label: "Kochava API key", required: true,
        userOwnedRequired: true, secretReferenceId: ref.id, status: .verified,
        helpText: "Dedicated Authentication-Key header secret stored as a Keychain reference.",
        redactionStatus: "secret-reference-only")
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "kochava:api-key-account", providerName: "Kochava", status: .connected,
      authorizationState: .completed, credentialOwnership: .userOwned,
      userOwnedCredentialsRequired: true, credentialRequirements: requirements,
      secretReferenceIds: [ref.id], accountLabel: "Kochava account",
      connectedHandle: "kochava:account", callbackURL: nil, requiredScopes: [], grantedScopes: [],
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message: "Kochava API key is ready for bounded limited-selector App Management validation.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("kochava"), "authMethod": .string("customer_owned_api_key"),
          "apiOrigin": .string("https://apps.api.kochava.com"), "readOnlyV1": .bool(true),
          "maxApps": .number(25), "pageToken": .number(1), "automaticPagination": .bool(false),
          "automaticRetry": .bool(false), "responseCapBytes": .number(1_000_000),
          "rawCredentialStoredInDatabase": .bool(false),
        ],
        redactionStatus:
          "names-guids-store-sdk-consent-configuration-credentials-links-attribution-device-and-report-data-excluded"
      ), senderIdentities: [], installPolicy: "approval_gated_kochava_app_reference_read",
      lastCheckedAt: timestamp, lastError: nil,
      manualEvidenceNote:
        "Kochava requires eligible Publisher/Premium Publisher App Management access, a dedicated API key with View Apps permission, and live acceptance.",
      reauthorizeRequired: false, disconnecting: false, betaBlocked: false,
      createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp,
      redactionStatus:
        "names-guids-store-sdk-consent-configuration-credentials-links-attribution-device-and-report-data-excluded"
    )
    do {
      let saved = try saveConnection(context: context, connection: connection)
      for oldRef in old where !saved.secretReferenceIds.contains(oldRef) {
        _ = try? secrets.delete(oldRef)
      }
      return saved
    } catch {
      _ = try? secrets.delete(ref.id)
      throw error
    }
  }

  @discardableResult public func saveSegmentPersonasPublicAPIConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, publicAPIToken: String, spaceId: String,
    apiRegion: String, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "segment-personas")
    guard app.slug == "segment-personas" else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Segment credentials can only be saved for Segment Personas.")
    }
    try validateAppCanAuthorize(app, context: context)
    let token = try requireNonEmptyString(
      publicAPIToken, field: "Segment Public API token", maxLength: 30000)
    let space = try requireNonEmptyString(spaceId, field: "Segment Space ID", maxLength: 255)
    let region = try requireNonEmptyString(apiRegion, field: "Segment API region", maxLength: 3)
      .lowercased()
    guard !token.contains("\n"), !token.contains("\r"),
      space.range(of: #"^[A-Za-z0-9_-]{1,255}$"#, options: .regularExpression) != nil,
      region == "us" || region == "eu1"
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Segment requires a valid token, Space ID, and us or eu1 region."
      )
    }
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let old = existing.map(Self.secretReferenceIds(in:)) ?? []
    let t = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Segment Public API token",
      secretValue: token)
    let s: SecretReference
    do {
      s = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Segment Space ID", secretValue: space)
    } catch {
      _ = try? secrets.delete(t.id)
      throw error
    }
    let r: SecretReference
    do {
      r = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Segment API region", secretValue: region)
    } catch {
      _ = try? secrets.delete(t.id)
      _ = try? secrets.delete(s.id)
      throw error
    }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "segment_public_api_token", label: "Segment Public API token", required: true,
        userOwnedRequired: true, secretReferenceId: t.id, status: .verified,
        helpText:
          "Dedicated workspace-scoped Public API bearer token stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "segment_space_id", label: "Bound Segment Space ID", required: true,
        userOwnedRequired: true, secretReferenceId: s.id, status: .verified,
        helpText: "Exact Unify/Engage Space binding stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "segment_api_region", label: "Bound Segment API region", required: true,
        userOwnedRequired: true, secretReferenceId: r.id, status: .verified,
        helpText: "Exact us or eu1 API origin selector stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
    ]
    let origin = region == "eu1" ? "https://eu1.api.segmentapis.com" : "https://api.segmentapis.com"
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "segment-personas:" + space + ":" + region, providerName: "Twilio Segment",
      status: .connected, authorizationState: .completed, credentialOwnership: .userOwned,
      userOwnedCredentialsRequired: true, credentialRequirements: requirements,
      secretReferenceIds: [t.id, s.id, r.id], accountLabel: "Segment bound Space",
      connectedHandle: "segment-personas:bound-space", callbackURL: nil, requiredScopes: [],
      grantedScopes: [], selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message:
          "Segment Public API token, exact Space, and region are syntax-valid and ready for bounded Audience entitlement validation.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("segment-personas"),
          "authMethod": .string("customer_owned_workspace_public_api_token"),
          "apiOrigin": .string(origin), "exactSpaceBinding": .bool(true), "readOnlyV1": .bool(true),
          "maxAudiences": .number(25), "requestsPerMinute": .number(60),
          "automaticPagination": .bool(false), "automaticRetry": .bool(false),
          "responseCapBytes": .number(1_000_000), "rawCredentialStoredInDatabase": .bool(false),
        ],
        redactionStatus:
          "audience-ids-names-keys-definitions-sizes-members-identifiers-schedules-destinations-and-creators-excluded"
      ), senderIdentities: [], installPolicy: "approval_gated_segment_personas_audience_readiness",
      lastCheckedAt: timestamp, lastError: nil,
      manualEvidenceNote:
        "Segment requires eligible Unify/Engage Audience entitlement, a dedicated read-authorized Public API token, exact Space/region binding, and live acceptance.",
      reauthorizeRequired: false, disconnecting: false, betaBlocked: false,
      createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp,
      redactionStatus:
        "audience-ids-names-keys-definitions-sizes-members-identifiers-schedules-destinations-and-creators-excluded"
    )
    do {
      let saved = try saveConnection(context: context, connection: connection)
      for oldRef in old where !saved.secretReferenceIds.contains(oldRef) {
        _ = try? secrets.delete(oldRef)
      }
      return saved
    } catch {
      _ = try? secrets.delete(t.id)
      _ = try? secrets.delete(s.id)
      _ = try? secrets.delete(r.id)
      throw error
    }
  }

  @discardableResult public func saveMParticlePlatformAPIConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, clientId: String, clientSecret: String,
    accountId: String, workspaceId: String, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "mparticle")
    guard app.slug == "mparticle" else {
      throw ServiceGuard.invalidInput(
        context: context, message: "mParticle credentials can only be saved for mParticle.")
    }
    try validateAppCanAuthorize(app, context: context)
    let client = try requireNonEmptyString(
      clientId, field: "mParticle Platform API client ID", maxLength: 2048)
    let secret = try requireNonEmptyString(
      clientSecret, field: "mParticle Platform API client secret", maxLength: 30000)
    let account = try requireNonEmptyString(accountId, field: "mParticle account ID", maxLength: 19)
    let workspace = try requireNonEmptyString(
      workspaceId, field: "mParticle workspace ID", maxLength: 19)
    guard !client.contains("\n"), !client.contains("\r"), !secret.contains("\n"),
      !secret.contains("\r"),
      account.range(of: #"^[1-9][0-9]{0,18}$"#, options: .regularExpression) != nil,
      workspace.range(of: #"^[1-9][0-9]{0,18}$"#, options: .regularExpression) != nil
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message:
          "mParticle requires valid Platform API client credentials and exact positive numeric account/workspace IDs."
      )
    }
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let old = existing.map(Self.secretReferenceIds(in:)) ?? []
    let c = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "mParticle Platform API client ID",
      secretValue: client)
    let s: SecretReference
    let a: SecretReference
    let w: SecretReference
    do {
      s = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "mParticle Platform API client secret",
        secretValue: secret)
    } catch {
      _ = try? secrets.delete(c.id)
      throw error
    }
    do {
      a = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "mParticle account ID",
        secretValue: account)
    } catch {
      _ = try? secrets.delete(c.id)
      _ = try? secrets.delete(s.id)
      throw error
    }
    do {
      w = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "mParticle workspace ID",
        secretValue: workspace)
    } catch {
      _ = try? secrets.delete(c.id)
      _ = try? secrets.delete(s.id)
      _ = try? secrets.delete(a.id)
      throw error
    }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "mparticle_client_id", label: "mParticle Platform API client ID", required: true,
        userOwnedRequired: true, secretReferenceId: c.id, status: .verified,
        helpText:
          "Dedicated customer-owned client ID stored as a Keychain reference and used only for fixed token exchange.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "mparticle_client_secret", label: "mParticle Platform API client secret",
        required: true, userOwnedRequired: true, secretReferenceId: s.id, status: .verified,
        helpText:
          "Matching customer-owned secret stored as a Keychain reference and never exposed to agents.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "mparticle_account_id", label: "Bound mParticle account ID", required: true,
        userOwnedRequired: true, secretReferenceId: a.id, status: .verified,
        helpText: "Exact numeric account binding stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "mparticle_workspace_id", label: "Bound mParticle workspace ID", required: true,
        userOwnedRequired: true, secretReferenceId: w.id, status: .verified,
        helpText: "Exact numeric workspace binding stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "mparticle:" + account + ":" + workspace, providerName: "mParticle",
      status: .connected, authorizationState: .completed, credentialOwnership: .userOwned,
      userOwnedCredentialsRequired: true, credentialRequirements: requirements,
      secretReferenceIds: [c.id, s.id, a.id, w.id],
      accountLabel: "mParticle bound account/workspace",
      connectedHandle: "mparticle:bound-workspace", callbackURL: nil, requiredScopes: [],
      grantedScopes: [], selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message:
          "mParticle Platform API credentials and exact account/workspace binding are syntax-valid and ready for bounded Real-time Audience validation.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("mparticle"),
          "authMethod": .string("customer_owned_platform_api_client_credentials"),
          "apiOrigin": .string("https://api.mparticle.com"),
          "tokenOrigin": .string("https://sso.auth.mparticle.com"),
          "exactAccountBinding": .bool(true), "exactWorkspaceBinding": .bool(true),
          "readOnlyV1": .bool(true), "accessTokenPersistence": .string("none"),
          "automaticPagination": .bool(false), "automaticRetry": .bool(false),
          "responseCapBytes": .number(1_000_000), "rawCredentialStoredInDatabase": .bool(false),
        ],
        redactionStatus:
          "audience-identity-size-membership-change-creators-workspace-and-output-details-excluded"),
      senderIdentities: [], installPolicy: "approval_gated_mparticle_audience_readiness",
      lastCheckedAt: timestamp, lastError: nil,
      manualEvidenceNote:
        "mParticle requires eligible Platform API and Real-time Audiences access, dedicated least-privilege client credentials, exact account/workspace IDs, and live acceptance.",
      reauthorizeRequired: false, disconnecting: false, betaBlocked: false,
      createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp,
      redactionStatus:
        "audience-identity-size-membership-change-creators-workspace-and-output-details-excluded")
    do {
      let saved = try saveConnection(context: context, connection: connection)
      for oldRef in old where !saved.secretReferenceIds.contains(oldRef) {
        _ = try? secrets.delete(oldRef)
      }
      return saved
    } catch {
      _ = try? secrets.delete(c.id)
      _ = try? secrets.delete(s.id)
      _ = try? secrets.delete(a.id)
      _ = try? secrets.delete(w.id)
      throw error
    }
  }

  @discardableResult public func saveTealiumPublicProfileConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, account: String, profile: String,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "tealium")
    guard app.slug == "tealium" else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Tealium bindings can only be saved for Tealium.")
    }
    try validateAppCanAuthorize(app, context: context)
    let a = try requireNonEmptyString(account, field: "Tealium account name", maxLength: 100)
    let p = try requireNonEmptyString(profile, field: "Tealium profile name", maxLength: 100)
    guard a.range(of: #"^[A-Za-z0-9_-]{1,100}$"#, options: .regularExpression) != nil,
      p.range(of: #"^[A-Za-z0-9_-]{1,100}$"#, options: .regularExpression) != nil
    else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Tealium requires valid exact account and profile names.")
    }
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let old = existing.map(Self.secretReferenceIds(in:)) ?? []
    let ar = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Tealium account name", secretValue: a)
    let pr: SecretReference
    do {
      pr = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Tealium profile name", secretValue: p)
    } catch {
      _ = try? secrets.delete(ar.id)
      throw error
    }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "tealium_account", label: "Bound Tealium account name", required: true,
        userOwnedRequired: true, secretReferenceId: ar.id, status: .verified,
        helpText:
          "Exact public account binding stored as a Keychain reference and never returned to agents.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "tealium_profile", label: "Bound Tealium profile name", required: true,
        userOwnedRequired: true, secretReferenceId: pr.id, status: .verified,
        helpText:
          "Exact public profile binding stored as a Keychain reference and never returned to agents.",
        redactionStatus: "secret-reference-only"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "tealium:bound-account-profile", providerName: "Tealium", status: .connected,
      authorizationState: .completed, credentialOwnership: .userOwned,
      userOwnedCredentialsRequired: false, credentialRequirements: requirements,
      secretReferenceIds: [ar.id, pr.id], accountLabel: "Tealium bound account/profile",
      connectedHandle: "tealium:bound-profile", callbackURL: nil, requiredScopes: [],
      grantedScopes: [], selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message:
          "Tealium exact account/profile binding is syntax-valid and ready for public Profile Definition validation.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("tealium"),
          "authMethod": .string("public_profile_definition_no_credential"),
          "apiOrigin": .string("https://visitor-service.tealiumiq.com"),
          "exactAccountBinding": .bool(true), "exactProfileBinding": .bool(true),
          "readOnlyV1": .bool(true), "credentialsRequired": .bool(false),
          "automaticPagination": .bool(false), "automaticRetry": .bool(false),
          "responseCapBytes": .number(1_000_000),
        ],
        redactionStatus: "account-profile-audience-badge-identity-names-and-visitor-data-excluded"),
      senderIdentities: [], installPolicy: "approval_gated_tealium_definition_readiness",
      lastCheckedAt: timestamp, lastError: nil,
      manualEvidenceNote:
        "Tealium requires an eligible AudienceStream account/profile, confirmation that the public Profile Definition endpoint is enabled and suitable, and live acceptance.",
      reauthorizeRequired: false, disconnecting: false, betaBlocked: false,
      createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp,
      redactionStatus: "account-profile-audience-badge-identity-names-and-visitor-data-excluded")
    do {
      let saved = try saveConnection(context: context, connection: connection)
      for oldRef in old where !saved.secretReferenceIds.contains(oldRef) {
        _ = try? secrets.delete(oldRef)
      }
      return saved
    } catch {
      _ = try? secrets.delete(ar.id)
      _ = try? secrets.delete(pr.id)
      throw error
    }
  }

  @discardableResult public func saveLyticsAPITokenConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, apiToken: String, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "lytics")
    guard app.slug == "lytics" else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Lytics credentials can only be saved for Lytics.")
    }
    try validateAppCanAuthorize(app, context: context)
    let token = try requireNonEmptyString(apiToken, field: "Lytics API token", maxLength: 30000)
    guard !token.contains("\n"), !token.contains("\r") else {
      throw ServiceGuard.invalidInput(context: context, message: "Lytics token is invalid.")
    }
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let old = existing.map(Self.secretReferenceIds(in:)) ?? []
    let ref = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Lytics API token", secretValue: token)
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "lytics_api_token", label: "Lytics API token", required: true,
        userOwnedRequired: true, secretReferenceId: ref.id, status: .verified,
        helpText: "Dedicated account-scoped v2_segment_view token stored as a Keychain reference.",
        redactionStatus: "secret-reference-only")
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "lytics:token-bound-account", providerName: "Lytics", status: .connected,
      authorizationState: .completed, credentialOwnership: .userOwned,
      userOwnedCredentialsRequired: true, credentialRequirements: requirements,
      secretReferenceIds: [ref.id], accountLabel: "Lytics account",
      connectedHandle: "lytics:account", callbackURL: nil, requiredScopes: ["v2_segment_view"],
      grantedScopes: ["v2_segment_view"], selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message:
          "Lytics token is syntax-valid and ready for account-scoped Audience View validation.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("lytics"), "authMethod": .string("customer_owned_account_api_token"),
          "apiOrigin": .string("https://api.lytics.io"),
          "requiredPermission": .string("v2_segment_view"), "piiViewRequired": .bool(false),
          "readOnlyV1": .bool(true), "automaticPagination": .bool(false),
          "automaticRetry": .bool(false), "responseCapBytes": .number(1_000_000),
          "rawCredentialStoredInDatabase": .bool(false),
        ],
        redactionStatus:
          "segment-identity-definitions-membership-size-lineage-jobs-and-profile-data-excluded"),
      senderIdentities: [], installPolicy: "approval_gated_lytics_segment_readiness",
      lastCheckedAt: timestamp, lastError: nil,
      manualEvidenceNote:
        "Lytics requires an eligible account, administrator-created dedicated expiring token with v2_segment_view and without PII View, and live acceptance.",
      reauthorizeRequired: false, disconnecting: false, betaBlocked: false,
      createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp,
      redactionStatus:
        "segment-identity-definitions-membership-size-lineage-jobs-and-profile-data-excluded")
    do {
      let saved = try saveConnection(context: context, connection: connection)
      for oldRef in old where !saved.secretReferenceIds.contains(oldRef) {
        _ = try? secrets.delete(oldRef)
      }
      return saved
    } catch {
      _ = try? secrets.delete(ref.id)
      throw error
    }
  }

  @discardableResult public func saveBlueConicClientCredentialsConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, tenantName: String, clientId: String,
    clientSecret: String, now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "blueconic")
    guard app.slug == "blueconic" else {
      throw ServiceGuard.invalidInput(
        context: context, message: "BlueConic credentials can only be saved for BlueConic.")
    }
    try validateAppCanAuthorize(app, context: context)
    let tenant = try requireNonEmptyString(
      tenantName, field: "BlueConic tenant name", maxLength: 63
    ).lowercased()
    let client = try requireNonEmptyString(
      clientId, field: "BlueConic OAuth client ID", maxLength: 500)
    let secret = try requireNonEmptyString(
      clientSecret, field: "BlueConic OAuth client secret", maxLength: 30000)
    guard
      tenant.range(of: #"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$"#, options: .regularExpression)
        != nil, !client.contains("\n"), !client.contains("\r"), !secret.contains("\n"),
      !secret.contains("\r")
    else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "BlueConic requires a valid tenant DNS label and client credentials.")
    }
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let old = existing.map(Self.secretReferenceIds(in:)) ?? []
    let tenantRef = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "BlueConic tenant name", secretValue: tenant
    )
    let clientRef: SecretReference
    do {
      clientRef = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "BlueConic OAuth client ID",
        secretValue: client)
    } catch {
      _ = try? secrets.delete(tenantRef.id)
      throw error
    }
    let secretRef: SecretReference
    do {
      secretRef = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "BlueConic OAuth client secret",
        secretValue: secret)
    } catch {
      _ = try? secrets.delete(tenantRef.id)
      _ = try? secrets.delete(clientRef.id)
      throw error
    }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "blueconic_tenant_name", label: "BlueConic tenant name", required: true,
        userOwnedRequired: true, secretReferenceId: tenantRef.id, status: .verified,
        helpText:
          "Exact BlueConic tenant DNS label stored as a Keychain reference and never returned to agents.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "blueconic_client_id", label: "BlueConic OAuth client ID", required: true,
        userOwnedRequired: true, secretReferenceId: clientRef.id, status: .verified,
        helpText: "Dedicated customer-owned client ID stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "blueconic_client_secret", label: "BlueConic OAuth client secret", required: true,
        userOwnedRequired: true, secretReferenceId: secretRef.id, status: .verified,
        helpText: "Dedicated customer-owned client secret stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "blueconic:tenant-bound-client-credentials", providerName: "BlueConic",
      status: .connected, authorizationState: .completed, credentialOwnership: .userOwned,
      userOwnedCredentialsRequired: true, credentialRequirements: requirements,
      secretReferenceIds: [tenantRef.id, clientRef.id, secretRef.id],
      accountLabel: "BlueConic bound tenant", connectedHandle: "blueconic:bound-tenant",
      callbackURL: nil, requiredScopes: [], grantedScopes: [],
      selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message:
          "BlueConic tenant and client credentials are syntax-valid and ready for least-privilege segment-read validation.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("blueconic"),
          "authMethod": .string("customer_owned_oauth2_client_credentials"),
          "apiOriginPattern": .string("https://www.{tenant}.blueconic.net"),
          "tokenPath": .string("/rest/v2/oauth/token"), "segmentPath": .string("/rest/v2/segments"),
          "exactTenantBinding": .bool(true), "shortLivedTokenPersisted": .bool(false),
          "readOnlyV1": .bool(true), "automaticPagination": .bool(false),
          "automaticRetry": .bool(false), "responseCapBytes": .number(1_000_000),
          "rawCredentialStoredInDatabase": .bool(false),
        ],
        redactionStatus:
          "tenant-segment-identity-definitions-membership-profile-and-customer-data-excluded"),
      senderIdentities: [], installPolicy: "approval_gated_blueconic_segment_readiness",
      lastCheckedAt: timestamp, lastError: nil,
      manualEvidenceNote:
        "BlueConic requires an eligible tenant, administrator-registered least-privilege client-credentials application, exact tenant selection, and live acceptance.",
      reauthorizeRequired: false, disconnecting: false, betaBlocked: false,
      createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp,
      redactionStatus:
        "tenant-segment-identity-definitions-membership-profile-and-customer-data-excluded")
    do {
      let saved = try saveConnection(context: context, connection: connection)
      for oldRef in old where !saved.secretReferenceIds.contains(oldRef) {
        _ = try? secrets.delete(oldRef)
      }
      return saved
    } catch {
      _ = try? secrets.delete(tenantRef.id)
      _ = try? secrets.delete(clientRef.id)
      _ = try? secrets.delete(secretRef.id)
      throw error
    }
  }

  @discardableResult public func saveTreasureDataRestrictedAPIKeyConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, apiKey: String, apiRegion: String,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "treasure-data")
    guard app.slug == "treasure-data" else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Treasure Data credentials can only be saved for Treasure Data.")
    }
    try validateAppCanAuthorize(app, context: context)
    let key = try requireNonEmptyString(apiKey, field: "Treasure Data API key", maxLength: 30000)
    let region = try requireNonEmptyString(
      apiRegion, field: "Treasure Data API region", maxLength: 10
    ).lowercased()
    let origins = [
      "us": "https://api.treasuredata.com", "tokyo": "https://api.treasuredata.co.jp",
      "ap02": "https://api.ap02.treasuredata.com", "eu01": "https://api.eu01.treasuredata.com",
    ]
    guard !key.contains("\n"), !key.contains("\r"), let origin = origins[region] else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "Treasure Data requires a valid API key and exact us, tokyo, ap02, or eu01 region."
      )
    }
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let old = existing.map(Self.secretReferenceIds(in:)) ?? []
    let keyRef = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Treasure Data API key", secretValue: key)
    let regionRef: SecretReference
    do {
      regionRef = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Treasure Data API region",
        secretValue: region)
    } catch {
      _ = try? secrets.delete(keyRef.id)
      throw error
    }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "treasure_data_api_key", label: "Treasure Data API key", required: true,
        userOwnedRequired: true, secretReferenceId: keyRef.id, status: .verified,
        helpText:
          "Separate Master-type key for a dedicated restricted user stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "treasure_data_api_region", label: "Treasure Data API region", required: true,
        userOwnedRequired: true, secretReferenceId: regionRef.id, status: .verified,
        helpText: "Exact us, tokyo, ap02, or eu01 region binding stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "treasure-data:" + region + ":restricted-user-key",
      providerName: "Treasure Data", status: .connected, authorizationState: .completed,
      credentialOwnership: .userOwned, userOwnedCredentialsRequired: true,
      credentialRequirements: requirements, secretReferenceIds: [keyRef.id, regionRef.id],
      accountLabel: "Treasure Data " + region.uppercased() + " region",
      connectedHandle: "treasure-data:" + region, callbackURL: nil, requiredScopes: [],
      grantedScopes: [], selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message:
          "Treasure Data key and exact region are syntax-valid and ready for restricted-user database-list validation.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("treasure-data"),
          "authMethod": .string("customer_owned_restricted_user_master_api_key"),
          "apiOrigin": .string(origin), "authorizationScheme": .string("TD1"),
          "exactRegionBinding": .bool(true), "restrictedUserRequired": .bool(true),
          "readOnlyV1": .bool(true), "databaseIdentityReturned": .bool(false),
          "recordCountsReturned": .bool(false), "customerDataReturned": .bool(false),
          "writesEnabled": .bool(false), "automaticPagination": .bool(false),
          "automaticRetry": .bool(false), "responseCapBytes": .number(1_000_000),
          "rawCredentialStoredInDatabase": .bool(false),
        ],
        redactionStatus:
          "database-identity-record-count-permission-table-schema-query-job-and-customer-data-excluded"
      ), senderIdentities: [], installPolicy: "approval_gated_treasure_data_database_readiness",
      lastCheckedAt: timestamp, lastError: nil,
      manualEvidenceNote:
        "Treasure Data requires an eligible account, dedicated restricted user, narrowly assigned database visibility, separate Master-type key, exact region, IP allowlist compatibility, and live acceptance.",
      reauthorizeRequired: false, disconnecting: false, betaBlocked: false,
      createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp,
      redactionStatus:
        "database-identity-record-count-permission-table-schema-query-job-and-customer-data-excluded"
    )
    do {
      let saved = try saveConnection(context: context, connection: connection)
      for oldRef in old where !saved.secretReferenceIds.contains(oldRef) {
        _ = try? secrets.delete(oldRef)
      }
      return saved
    } catch {
      _ = try? secrets.delete(keyRef.id)
      _ = try? secrets.delete(regionRef.id)
      throw error
    }
  }

  @discardableResult public func saveLaterCustomerReportingConnection(
    context: ServiceRequestContext, appIdOrSlug: RelayId, clientId: String, clientSecret: String,
    now: Date = Date()
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: "later")
    guard app.slug == "later" else {
      throw ServiceGuard.invalidInput(
        context: context, message: "Later Reporting API credentials can only be saved for Later.")
    }
    try validateAppCanAuthorize(app, context: context)
    let client = try requireNonEmptyString(
      clientId, field: "Later Reporting API client ID", maxLength: 500)
    let secret = try requireNonEmptyString(
      clientSecret, field: "Later Reporting API client secret", maxLength: 30000)
    let existing = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
      .first
    let id = existing?.id ?? createRelayId("mpc")
    let old = existing.map(Self.secretReferenceIds(in:)) ?? []
    let c = try secrets.set(
      scope: "provider_connection", scopeId: id, label: "Later Reporting API client ID",
      secretValue: client)
    let s: SecretReference
    do {
      s = try secrets.set(
        scope: "provider_connection", scopeId: id, label: "Later Reporting API client secret",
        secretValue: secret)
    } catch {
      _ = try? secrets.delete(c.id)
      throw error
    }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let requirements = [
      ProviderCredentialRequirement(
        fieldKey: "later_client_id", label: "Later Reporting API client ID", required: true,
        userOwnedRequired: true, secretReferenceId: c.id, status: .verified,
        helpText: "Customer-owned Reporting API client ID stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
      ProviderCredentialRequirement(
        fieldKey: "later_client_secret", label: "Later Reporting API client secret", required: true,
        userOwnedRequired: true, secretReferenceId: s.id, status: .verified,
        helpText: "Customer-owned Reporting API client secret stored as a Keychain reference.",
        redactionStatus: "secret-reference-only"),
    ]
    let connection = MarketplaceProviderConnection(
      id: id, workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
      providerKey: "later-customer-owned-reporting-api", providerName: "Later", status: .connected,
      authorizationState: .completed, credentialOwnership: .userOwned,
      userOwnedCredentialsRequired: true, credentialRequirements: requirements,
      secretReferenceIds: [c.id, s.id], accountLabel: "Later Influence Reporting API client",
      connectedHandle: "later:reporting-api", callbackURL: nil, requiredScopes: [],
      grantedScopes: [], selectedCapabilities: app.capabilities,
      health: ProviderConnectorHealth(
        state: .ready,
        message:
          "Later customer-owned Reporting API credential references are ready for bounded analytics reads.",
        lastCheckedAt: timestamp, missingScopes: [], unavailableTools: [],
        diagnostics: [
          "provider": .string("later"), "authMethod": .string("customer_owned_client_credentials"),
          "apiOrigin": .string("https://reporting.api.later.com"),
          "tokenUrl": .string("https://reporting.api.later.com/oauth/token"),
          "tokenLifetimeHours": .number(12), "accessTokenPersistence": .string("none"),
          "identityReturned": .bool(false), "contentReturned": .bool(false),
          "financialDataReturned": .bool(false), "writesEnabled": .bool(false),
          "maxResources": .number(25), "maxDateWindowDays": .number(31),
          "requestsPerMinutePerIP": .number(120), "rawCredentialStoredInDatabase": .bool(false),
        ], redactionStatus: "identity-content-and-financial-data-excluded"), senderIdentities: [],
      installPolicy: "approval_gated_later_influence_reporting_reads", lastCheckedAt: timestamp,
      lastError: nil,
      manualEvidenceNote:
        "Later Influence access and Reporting API credentials must be issued through the customer account team.",
      reauthorizeRequired: false, disconnecting: false, betaBlocked: false,
      createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp,
      redactionStatus: "identity-content-and-financial-data-excluded")
    do {
      let saved = try saveConnection(context: context, connection: connection)
      for ref in old where !saved.secretReferenceIds.contains(ref) { _ = try? secrets.delete(ref) }
      return saved
    } catch {
      _ = try? secrets.delete(c.id)
      _ = try? secrets.delete(s.id)
      throw error
    }
  }
}
