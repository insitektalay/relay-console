import Foundation

public struct MarketplaceProviderCredentialFoundation: Identifiable, Codable, Equatable, Sendable {
    public var id: String { fieldKey }
    public var fieldKey: String
    public var label: String
    public var required: Bool
    public var userOwnedRequired: Bool
    public var secretStorage: String
    public var redactionStatus: String

    public init(
        fieldKey: String,
        label: String,
        required: Bool,
        userOwnedRequired: Bool,
        secretStorage: String,
        redactionStatus: String
    ) {
        self.fieldKey = fieldKey
        self.label = label
        self.required = required
        self.userOwnedRequired = userOwnedRequired
        self.secretStorage = secretStorage
        self.redactionStatus = redactionStatus
    }
}

public struct MarketplaceProviderActionFoundation: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var actionKey: String
    public var displayName: String
    public var kind: ProviderActionKind
    public var riskLevel: ProviderActionRiskLevel
    public var adapterKind: ProviderAdapterKind
    public var defaultPermission: ProviderActionPermission
    public var policyPermission: ProviderActionPermission
    public var requiredScopes: [String]
    public var capabilityKeys: [String]
    public var wrapperToolName: String?
    public var redactionStatus: String

    public init(
        id: RelayId,
        actionKey: String,
        displayName: String,
        kind: ProviderActionKind,
        riskLevel: ProviderActionRiskLevel,
        adapterKind: ProviderAdapterKind,
        defaultPermission: ProviderActionPermission,
        policyPermission: ProviderActionPermission,
        requiredScopes: [String],
        capabilityKeys: [String],
        wrapperToolName: String?,
        redactionStatus: String
    ) {
        self.id = id
        self.actionKey = actionKey
        self.displayName = displayName
        self.kind = kind
        self.riskLevel = riskLevel
        self.adapterKind = adapterKind
        self.defaultPermission = defaultPermission
        self.policyPermission = policyPermission
        self.requiredScopes = requiredScopes
        self.capabilityKeys = capabilityKeys
        self.wrapperToolName = wrapperToolName
        self.redactionStatus = redactionStatus
    }
}

public struct MarketplaceProviderFoundationSnapshot: Codable, Equatable, Sendable {
    public var workspaceId: RelayId
    public var appId: RelayId
    public var appSlug: String
    public var providerName: String
    public var providerFamily: String
    public var connectionMode: String
    public var credentialOwnership: ProviderCredentialOwnership
    public var userOwnedCredentialsRequired: Bool
    public var supportedPolicyPresets: [MarketplaceActionPolicyPreset]
    public var defaultPolicyPreset: MarketplaceActionPolicyPreset
    public var defaultPermissionMapId: RelayId
    public var adapterBoundary: String
    public var actionMapVersion: String
    public var budgetPolicy: JSONRecord
    public var privacyPolicy: JSONRecord
    public var actions: [MarketplaceProviderActionFoundation]
    public var credentials: [MarketplaceProviderCredentialFoundation]
    public var agentFacingWrapperToolNames: [String]
    public var blockedActionKeys: [String]
    public var rawProviderToolExposure: Bool
    public var suppressedRawProviderToolCount: Int
    public var generatedAt: IsoTimestamp
    public var redactionStatus: String

    public init(
        workspaceId: RelayId,
        appId: RelayId,
        appSlug: String,
        providerName: String,
        providerFamily: String,
        connectionMode: String,
        credentialOwnership: ProviderCredentialOwnership,
        userOwnedCredentialsRequired: Bool,
        supportedPolicyPresets: [MarketplaceActionPolicyPreset],
        defaultPolicyPreset: MarketplaceActionPolicyPreset,
        defaultPermissionMapId: RelayId,
        adapterBoundary: String,
        actionMapVersion: String,
        budgetPolicy: JSONRecord = [:],
        privacyPolicy: JSONRecord = [:],
        actions: [MarketplaceProviderActionFoundation],
        credentials: [MarketplaceProviderCredentialFoundation],
        agentFacingWrapperToolNames: [String],
        blockedActionKeys: [String],
        rawProviderToolExposure: Bool,
        suppressedRawProviderToolCount: Int,
        generatedAt: IsoTimestamp,
        redactionStatus: String
    ) {
        self.workspaceId = workspaceId
        self.appId = appId
        self.appSlug = appSlug
        self.providerName = providerName
        self.providerFamily = providerFamily
        self.connectionMode = connectionMode
        self.credentialOwnership = credentialOwnership
        self.userOwnedCredentialsRequired = userOwnedCredentialsRequired
        self.supportedPolicyPresets = supportedPolicyPresets
        self.defaultPolicyPreset = defaultPolicyPreset
        self.defaultPermissionMapId = defaultPermissionMapId
        self.adapterBoundary = adapterBoundary
        self.actionMapVersion = actionMapVersion
        self.budgetPolicy = budgetPolicy
        self.privacyPolicy = privacyPolicy
        self.actions = actions
        self.credentials = credentials
        self.agentFacingWrapperToolNames = agentFacingWrapperToolNames
        self.blockedActionKeys = blockedActionKeys
        self.rawProviderToolExposure = rawProviderToolExposure
        self.suppressedRawProviderToolCount = suppressedRawProviderToolCount
        self.generatedAt = generatedAt
        self.redactionStatus = redactionStatus
    }
}

public final class MarketplaceProviderFoundationService {
    private let data: LocalDataService
    private let applications: ApplicationsService
    private let policies: MarketplaceProviderActionPolicyCompilerService

    public init(
        data: LocalDataService,
        applications: ApplicationsService,
        policies: MarketplaceProviderActionPolicyCompilerService
    ) {
        self.data = data
        self.applications = applications
        self.policies = policies
    }

    public func registerXFoundation(
        context: ServiceRequestContext,
        now: Date = Date()
    ) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
            throw denied
        }
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
        let catalog = try applications.catalogSnapshot(
            context: context,
            selectedAppId: "x",
            now: now
        )
        let app = try requireXApp(catalog: catalog, context: context)
        let permissionMap = try policies.compilePolicyMap(
            context: context,
            appIdOrSlug: app.id,
            preset: .approvalRequired,
            now: now
        )
        let definitions = try data.listMarketplaceProviderActionDefinitions(
            workspaceId: context.workspaceId,
            appId: app.id,
            limit: 500
        ).sorted { $0.actionKey < $1.actionKey }
        let actions = definitions.map { definition in
            actionFoundation(definition: definition, permissionMap: permissionMap)
        }
        let wrapperToolNames = actions.compactMap(\.wrapperToolName).sorted()
        let blockedActionKeys = actions
            .filter { $0.policyPermission == .blocked || $0.riskLevel == .destructive }
            .map(\.actionKey)
            .sorted()
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId,
            appId: app.id,
            appSlug: app.slug,
            providerName: app.name,
            providerFamily: "public-social",
            connectionMode: "relay-owned-x-oauth2-pkce",
            credentialOwnership: .relayOwned,
            userOwnedCredentialsRequired: false,
            supportedPolicyPresets: [.approvalRequired, .allowDirectWrites, .readOnly, .blocked],
            defaultPolicyPreset: permissionMap.policyPreset,
            defaultPermissionMapId: permissionMap.id,
            adapterBoundary: "brokered-native-x-api-v2-adapter",
            actionMapVersion: "x-relay-owned-v1",
            actions: actions,
            credentials: Self.xCredentialRequirements,
            agentFacingWrapperToolNames: wrapperToolNames,
            blockedActionKeys: blockedActionKeys,
            rawProviderToolExposure: false,
            suppressedRawProviderToolCount: definitions.count,
            generatedAt: timestamp,
            redactionStatus: "private-state-excluded"
        )
    }

    public func registerFacebookPagesFoundation(
        context: ServiceRequestContext,
        now: Date = Date()
    ) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
            throw denied
        }
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
        let catalog = try applications.catalogSnapshot(
            context: context, selectedAppId: "facebook-pages", now: now)
        guard let app = catalog.apps.first(where: { $0.slug == "facebook-pages" }),
              app.availability == .available, app.sourceType == .externalProvider else {
            throw ServiceGuard.invalidInput(
                context: context,
                message: "Facebook Pages Marketplace app is unavailable for foundation registration.")
        }
        let permissionMap = try policies.compilePolicyMap(
            context: context, appIdOrSlug: app.id, preset: .approvalRequired, now: now)
        let definitions = try data.listMarketplaceProviderActionDefinitions(
            workspaceId: context.workspaceId, appId: app.id, limit: 500
        ).sorted { $0.actionKey < $1.actionKey }
        let actions = definitions.map {
            actionFoundation(definition: $0, permissionMap: permissionMap)
        }
        let wrapperToolNames = actions.compactMap(\.wrapperToolName).sorted()
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
            providerName: app.name, providerFamily: "selected-facebook-page-publishing",
            connectionMode: "relay-owned-meta-selected-page-oauth",
            credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
            supportedPolicyPresets: [.approvalRequired, .allowDirectWrites, .readOnly, .blocked],
            defaultPolicyPreset: permissionMap.policyPreset,
            defaultPermissionMapId: permissionMap.id,
            adapterBoundary: "brokered-native-facebook-graph-v25-selected-page-adapter",
            actionMapVersion: "facebook-pages-selected-page-v1",
            budgetPolicy: [
                "maxWrapperTools": .number(4), "maxOwnPosts": .number(10),
                "maxPostCharacters": .number(5000), "providerRequestsPerAction": .number(1),
                "automaticPagination": .bool(false), "automaticRetry": .bool(false),
            ],
            privacyPolicy: [
                "selectedPageOnly": .bool(true), "pageAuthoredPostsOnly": .bool(true),
                "visitorFeedCommentsMessages": .string("blocked"),
                "adsInsightsMediaWebhooksSettingsRoles": .string("blocked"),
                "editDeleteScheduleBulkRaw": .string("blocked"),
                "rawCredentials": .string("two-keychain-references"),
            ],
            actions: actions, credentials: Self.facebookPagesCredentialRequirements,
            agentFacingWrapperToolNames: wrapperToolNames, blockedActionKeys: [],
            rawProviderToolExposure: false,
            suppressedRawProviderToolCount: definitions.count,
            generatedAt: timestamp, redactionStatus: "private-state-excluded")
    }

    public func registerInstagramBusinessFoundation(
        context: ServiceRequestContext,
        now: Date = Date()
    ) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
            throw denied
        }
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
        let catalog = try applications.catalogSnapshot(
            context: context, selectedAppId: "instagram-business", now: now)
        guard let app = catalog.apps.first(where: { $0.slug == "instagram-business" }),
              app.availability == .available, app.sourceType == .externalProvider else {
            throw ServiceGuard.invalidInput(
                context: context,
                message: "Instagram Business Marketplace app is unavailable for foundation registration.")
        }
        let permissionMap = try policies.compilePolicyMap(
            context: context, appIdOrSlug: app.id, preset: .readOnly, now: now)
        let definitions = try data.listMarketplaceProviderActionDefinitions(
            workspaceId: context.workspaceId, appId: app.id, limit: 500
        ).sorted { $0.actionKey < $1.actionKey }
        let actions = definitions.map {
            actionFoundation(definition: $0, permissionMap: permissionMap)
        }
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
            providerName: app.name, providerFamily: "instagram-professional-owned-media",
            connectionMode: "relay-owned-instagram-login-professional-account",
            credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
            supportedPolicyPresets: [.readOnly, .blocked],
            defaultPolicyPreset: permissionMap.policyPreset,
            defaultPermissionMapId: permissionMap.id,
            adapterBoundary: "brokered-native-instagram-graph-owned-media-adapter",
            actionMapVersion: "instagram-business-owned-media-v1",
            budgetPolicy: [
                "maxWrapperTools": .number(3), "maxOwnMedia": .number(10),
                "providerRequestsPerAction": .number(1),
                "automaticPagination": .bool(false), "automaticRetry": .bool(false),
            ],
            privacyPolicy: [
                "boundProfessionalAccountOnly": .bool(true), "ownedMediaOnly": .bool(true),
                "consumerAccountsPeopleDiscovery": .string("blocked"),
                "publishingCommentsMessages": .string("blocked"),
                "insightsAdsTaggingDownloads": .string("blocked"),
                "rawCredentials": .string("one-keychain-reference"),
            ],
            actions: actions, credentials: Self.instagramBusinessCredentialRequirements,
            agentFacingWrapperToolNames: actions.compactMap(\.wrapperToolName).sorted(),
            blockedActionKeys: [], rawProviderToolExposure: false,
            suppressedRawProviderToolCount: definitions.count,
            generatedAt: timestamp, redactionStatus: "private-state-excluded")
    }

    public func registerThreadsFoundation(
        context: ServiceRequestContext, now: Date = Date()
    ) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) { throw denied }
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
        let catalog = try applications.catalogSnapshot(context: context, selectedAppId: "threads", now: now)
        guard let app = catalog.apps.first(where: { $0.slug == "threads" }),
              app.availability == .available, app.sourceType == .externalProvider else {
            throw ServiceGuard.invalidInput(context: context, message: "Threads Marketplace app is unavailable for foundation registration.")
        }
        let permissionMap = try policies.compilePolicyMap(
            context: context, appIdOrSlug: app.id, preset: .approvalRequired, now: now)
        let definitions = try data.listMarketplaceProviderActionDefinitions(
            workspaceId: context.workspaceId, appId: app.id, limit: 500).sorted { $0.actionKey < $1.actionKey }
        let actions = definitions.map { actionFoundation(definition: $0, permissionMap: permissionMap) }
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
            providerName: app.name, providerFamily: "threads-bound-profile-text-publishing",
            connectionMode: "relay-owned-threads-user-oauth",
            credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
            supportedPolicyPresets: [.approvalRequired, .allowDirectWrites, .readOnly, .blocked],
            defaultPolicyPreset: permissionMap.policyPreset, defaultPermissionMapId: permissionMap.id,
            adapterBoundary: "brokered-native-threads-graph-text-adapter",
            actionMapVersion: "threads-bound-profile-text-v1",
            budgetPolicy: [
                "maxWrapperTools": .number(5), "maxOwnPosts": .number(10),
                "maxPostCharacters": .number(500), "maxReadRequests": .number(1),
                "maxPublishRequests": .number(2), "automaticPagination": .bool(false),
                "automaticRetry": .bool(false),
            ],
            privacyPolicy: [
                "boundProfileOnly": .bool(true), "ownPostsOnly": .bool(true),
                "plainTextPublishOnly": .bool(true),
                "repliesMentionsInsightsDiscovery": .string("blocked"),
                "mediaLinksPollsLocationsTopics": .string("blocked"),
                "quotesRepostsDeleteEmbedsWebhooks": .string("blocked"),
                "rawCredentials": .string("one-keychain-reference"),
            ], actions: actions, credentials: Self.threadsCredentialRequirements,
            agentFacingWrapperToolNames: actions.compactMap(\.wrapperToolName).sorted(),
            blockedActionKeys: [], rawProviderToolExposure: false,
            suppressedRawProviderToolCount: definitions.count,
            generatedAt: timestamp, redactionStatus: "private-state-excluded")
    }

    public func registerMastodonFoundation(
        context: ServiceRequestContext, now: Date = Date()
    ) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) { throw denied }
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
        let catalog = try applications.catalogSnapshot(context: context, selectedAppId: "mastodon", now: now)
        guard let app = catalog.apps.first(where: { $0.slug == "mastodon" }),
              app.availability == .available, app.sourceType == .externalProvider else {
            throw ServiceGuard.invalidInput(context: context, message: "Mastodon Marketplace app is unavailable for foundation registration.")
        }
        let permissionMap = try policies.compilePolicyMap(
            context: context, appIdOrSlug: app.id, preset: .approvalRequired, now: now)
        let definitions = try data.listMarketplaceProviderActionDefinitions(
            workspaceId: context.workspaceId, appId: app.id, limit: 500).sorted { $0.actionKey < $1.actionKey }
        let actions = definitions.map { actionFoundation(definition: $0, permissionMap: permissionMap) }
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
            providerName: app.name, providerFamily: "mastodon-bound-instance-account-statuses",
            connectionMode: "relay-owned-mastodon-per-instance-authorization-code",
            credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
            supportedPolicyPresets: [.approvalRequired, .allowDirectWrites, .readOnly, .blocked],
            defaultPolicyPreset: permissionMap.policyPreset, defaultPermissionMapId: permissionMap.id,
            adapterBoundary: "brokered-native-mastodon-bound-instance-status-adapter",
            actionMapVersion: "mastodon-bound-instance-account-status-v1",
            budgetPolicy: [
                "maxWrapperTools": .number(4), "maxOwnStatuses": .number(10),
                "maxStatusCharacters": .number(500), "maxProviderRequestsPerAction": .number(1),
                "automaticPagination": .bool(false), "automaticRetry": .bool(false),
            ],
            privacyPolicy: [
                "verifiedInstanceOnly": .bool(true), "boundLocalAccountOnly": .bool(true),
                "ownStatusesOnly": .bool(true), "transientReadsNoStore": .bool(true),
                "publicOrUnlistedTextOnly": .bool(true),
                "federationTimelinesDiscoveryOtherAccounts": .string("blocked"),
                "repliesQuotesPrivateDirectEngagement": .string("blocked"),
                "mediaPollsContentWarningsSchedulingDestructiveAdminRaw": .string("blocked"),
                "rawCredentials": .string("two-keychain-references"),
            ], actions: actions, credentials: Self.mastodonCredentialRequirements,
            agentFacingWrapperToolNames: actions.compactMap(\.wrapperToolName).sorted(),
            blockedActionKeys: [], rawProviderToolExposure: false,
            suppressedRawProviderToolCount: definitions.count,
            generatedAt: timestamp, redactionStatus: "private-state-excluded")
    }

    public func registerBlueskyFoundation(
        context: ServiceRequestContext, now: Date = Date()
    ) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) { throw denied }
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
        let catalog = try applications.catalogSnapshot(context: context, selectedAppId: "bluesky", now: now)
        guard let app = catalog.apps.first(where: { $0.slug == "bluesky" }),
              app.availability == .available, app.sourceType == .externalProvider else {
            throw ServiceGuard.invalidInput(context: context, message: "Bluesky Marketplace app is unavailable for foundation registration.")
        }
        let permissionMap = try policies.compilePolicyMap(
            context: context, appIdOrSlug: app.id, preset: .approvalRequired, now: now)
        let definitions = try data.listMarketplaceProviderActionDefinitions(
            workspaceId: context.workspaceId, appId: app.id, limit: 500).sorted { $0.actionKey < $1.actionKey }
        let actions = definitions.map { actionFoundation(definition: $0, permissionMap: permissionMap) }
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
            providerName: app.name, providerFamily: "bluesky-atproto-bound-did-posts",
            connectionMode: "relay-owned-atproto-authorization-code-refresh-dpop",
            credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
            supportedPolicyPresets: [.approvalRequired, .allowDirectWrites, .readOnly, .blocked],
            defaultPolicyPreset: permissionMap.policyPreset, defaultPermissionMapId: permissionMap.id,
            adapterBoundary: "brokered-native-atproto-bound-did-post-adapter",
            actionMapVersion: "bluesky-bound-did-text-post-v1",
            budgetPolicy: [
                "maxWrapperTools": .number(4), "maxOwnPosts": .number(10),
                "maxPostGraphemes": .number(300), "maxProviderRequestsPerAction": .number(1),
                "automaticPagination": .bool(false), "automaticRetry": .bool(false),
            ],
            privacyPolicy: [
                "boundDIDOnly": .bool(true), "verifiedPDSIssuerOnly": .bool(true),
                "ownOriginalPostsOnly": .bool(true), "transientReadsNoStore": .bool(true),
                "textOnlyCreate": .bool(true),
                "repliesQuotesRepostsEngagementFollows": .string("blocked"),
                "mediaFacetsEditingDeletionDiscoveryPrivateModerationRaw": .string("blocked"),
                "rawCredentials": .string("three-keychain-references"),
            ], actions: actions, credentials: Self.blueskyCredentialRequirements,
            agentFacingWrapperToolNames: actions.compactMap(\.wrapperToolName).sorted(),
            blockedActionKeys: [], rawProviderToolExposure: false,
            suppressedRawProviderToolCount: definitions.count,
            generatedAt: timestamp, redactionStatus: "private-state-excluded")
    }

    public func registerNextdoorFoundation(
        context: ServiceRequestContext, now: Date = Date()
    ) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) { throw denied }
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
        let catalog = try applications.catalogSnapshot(context: context, selectedAppId: "nextdoor", now: now)
        guard let app = catalog.apps.first(where: { $0.slug == "nextdoor" }),
              app.availability == .available, app.sourceType == .externalProvider else {
            throw ServiceGuard.invalidInput(context: context, message: "Nextdoor Marketplace app is unavailable for foundation registration.")
        }
        let permissionMap = try policies.compilePolicyMap(
            context: context, appIdOrSlug: app.id, preset: .approvalRequired, now: now)
        let definitions = try data.listMarketplaceProviderActionDefinitions(
            workspaceId: context.workspaceId, appId: app.id, limit: 500).sorted { $0.actionKey < $1.actionKey }
        let actions = definitions.map { actionFoundation(definition: $0, permissionMap: permissionMap) }
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
            providerName: app.name, providerFamily: "nextdoor-bound-verified-profile-own-posts",
            connectionMode: "relay-owned-nextdoor-confidential-authorization-code-refresh",
            credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
            supportedPolicyPresets: [.approvalRequired, .allowDirectWrites, .readOnly, .blocked],
            defaultPolicyPreset: permissionMap.policyPreset, defaultPermissionMapId: permissionMap.id,
            adapterBoundary: "railway-brokered-nextdoor-publish-api-adapter",
            actionMapVersion: "nextdoor-selected-profile-text-post-v1",
            budgetPolicy: [
                "maxWrapperTools": .number(4), "maxOwnPosts": .number(10),
                "maxPostBytes": .number(8192), "maxProviderRequestsPerAction": .number(1),
                "automaticPagination": .bool(false), "automaticRetry": .bool(false),
            ],
            privacyPolicy: [
                "selectedVerifiedProfileOnly": .bool(true), "ownPostsOnly": .bool(true),
                "transientReadsNoStore": .bool(true), "textOnlyCreate": .bool(true),
                "crossProductCommunityMediaGeoBulkDestructiveRaw": .string("blocked"),
                "rawCredentials": .string("railway-encrypted-only"),
            ], actions: actions, credentials: Self.nextdoorCredentialRequirements,
            agentFacingWrapperToolNames: actions.compactMap(\.wrapperToolName).sorted(),
            blockedActionKeys: [], rawProviderToolExposure: false,
            suppressedRawProviderToolCount: definitions.count,
            generatedAt: timestamp, redactionStatus: "provider-content-not-stored")
    }

    public func registerMeetupFoundation(
        context: ServiceRequestContext, now: Date = Date()
    ) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) { throw denied }
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
        let catalog = try applications.catalogSnapshot(context: context, selectedAppId: "meetup", now: now)
        guard let app = catalog.apps.first(where: { $0.slug == "meetup" }),
              app.sourceType == .externalProvider else {
            throw ServiceGuard.invalidInput(context: context, message: "Meetup Marketplace app is unavailable for foundation registration.")
        }
        let permissionMap = try policies.compilePolicyMap(
            context: context, appIdOrSlug: app.id, preset: .approvalRequired, now: now)
        let definitions = try data.listMarketplaceProviderActionDefinitions(
            workspaceId: context.workspaceId, appId: app.id, limit: 500).sorted { $0.actionKey < $1.actionKey }
        let actions = definitions.map { actionFoundation(definition: $0, permissionMap: permissionMap) }
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
            providerName: app.name, providerFamily: "meetup-connected-member-explicit-event",
            connectionMode: "relay-owned-meetup-confidential-oauth-single-use-refresh",
            credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
            supportedPolicyPresets: [.approvalRequired, .allowDirectWrites, .readOnly, .blocked],
            defaultPolicyPreset: .approvalRequired,
            defaultPermissionMapId: permissionMap.id,
            adapterBoundary: "railway-brokered-meetup-fixed-graphql-adapter",
            actionMapVersion: "meetup-member-event-read-v1",
            budgetPolicy: [
                "maxWrapperTools": .number(2), "maxProviderRequestsPerAction": .number(1),
                "maxResponseBytes": .number(524_288),
                "automaticPagination": .bool(false), "automaticRetry": .bool(false),
            ], privacyPolicy: [
                "connectedMemberOnly": .bool(true), "explicitEventOnly": .bool(true),
                "transientReadsNoStore": .bool(true), "fixedQueriesOnly": .bool(true),
                "mutationsListsDiscoveryBulkIntrospectionRaw": .string("blocked"),
                "rawCredentials": .string("railway-encrypted-only"),
            ], actions: actions, credentials: Self.meetupCredentialRequirements,
            agentFacingWrapperToolNames: actions.compactMap(\.wrapperToolName).sorted(),
            blockedActionKeys: [], rawProviderToolExposure: false,
            suppressedRawProviderToolCount: definitions.count,
            generatedAt: timestamp, redactionStatus: "provider-content-not-stored")
    }

    public func registerEventbriteFoundation(
        context: ServiceRequestContext, now: Date = Date()
    ) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) { throw denied }
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
        let catalog = try applications.catalogSnapshot(context: context, selectedAppId: "eventbrite", now: now)
        guard let app = catalog.apps.first(where: { $0.slug == "eventbrite" }),
              app.sourceType == .externalProvider else {
            throw ServiceGuard.invalidInput(context: context, message: "Eventbrite Marketplace app is unavailable for foundation registration.")
        }
        let permissionMap = try policies.compilePolicyMap(
            context: context, appIdOrSlug: app.id, preset: .approvalRequired, now: now)
        let definitions = try data.listMarketplaceProviderActionDefinitions(
            workspaceId: context.workspaceId, appId: app.id, limit: 500).sorted { $0.actionKey < $1.actionKey }
        let actions = definitions.map { actionFoundation(definition: $0, permissionMap: permissionMap) }
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
            providerName: app.name, providerFamily: "eventbrite-user-organization-event",
            connectionMode: "relay-owned-eventbrite-confidential-oauth-no-refresh",
            credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
            supportedPolicyPresets: [.approvalRequired, .allowDirectWrites, .readOnly, .blocked],
            defaultPolicyPreset: .approvalRequired,
            defaultPermissionMapId: permissionMap.id,
            adapterBoundary: "railway-brokered-eventbrite-fixed-rest-adapter",
            actionMapVersion: "eventbrite-organizer-event-read-v1",
            budgetPolicy: [
                "maxWrapperTools": .number(4), "maxProviderRequestsPerAction": .number(2),
                "maxResults": .number(10), "automaticPagination": .bool(false), "automaticRetry": .bool(false),
            ], privacyPolicy: [
                "connectedUserOnly": .bool(true), "memberOrganizationsOnly": .bool(true),
                "ownedOrganizationEventsOnly": .bool(true), "transientReadsNoStore": .bool(true),
                "attendeesOrdersTicketsPaymentsContacts": .string("blocked"),
                "writesPaginationManageESRRaw": .string("blocked"),
                "rawCredentials": .string("railway-encrypted-only"),
            ], actions: actions, credentials: Self.eventbriteCredentialRequirements,
            agentFacingWrapperToolNames: actions.compactMap(\.wrapperToolName).sorted(),
            blockedActionKeys: [], rawProviderToolExposure: false,
            suppressedRawProviderToolCount: definitions.count,
            generatedAt: timestamp, redactionStatus: "provider-content-not-stored")
    }

    public func registerLumaFoundation(
        context: ServiceRequestContext, now: Date = Date()
    ) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) { throw denied }
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
        let catalog = try applications.catalogSnapshot(context: context, selectedAppId: "luma", now: now)
        guard let app = catalog.apps.first(where: { $0.slug == "luma" }),
              app.sourceType == .externalProvider,
              app.readOnly else {
            throw ServiceGuard.invalidInput(context: context, message: "Luma Marketplace app is unavailable for foundation registration.")
        }
        let permissionMap = try policies.compilePolicyMap(
            context: context, appIdOrSlug: app.id, preset: .approvalRequired, now: now)
        let definitions = try data.listMarketplaceProviderActionDefinitions(
            workspaceId: context.workspaceId, appId: app.id, limit: 500).sorted { $0.actionKey < $1.actionKey }
        let actions = definitions.map { actionFoundation(definition: $0, permissionMap: permissionMap) }
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
            providerName: app.name, providerFamily: "luma-user-calendar-event",
            connectionMode: "customer-owned-luma-calendar-api-key",
            credentialOwnership: .userOwned, userOwnedCredentialsRequired: true,
            supportedPolicyPresets: [.approvalRequired, .allowDirectWrites, .readOnly, .blocked],
            defaultPolicyPreset: .approvalRequired,
            defaultPermissionMapId: permissionMap.id,
            adapterBoundary: "railway-brokered-luma-fixed-public-api-adapter",
            actionMapVersion: "luma-bound-calendar-event-read-v1",
            budgetPolicy: [
                "maxWrapperTools": .number(4), "maxProviderRequestsPerAction": .number(1),
                "maxResults": .number(10), "maxEventWindowDays": .number(366),
                "maxResponseBytes": .number(524_288), "automaticPagination": .bool(false),
                "automaticRetry": .bool(false),
            ], privacyPolicy: [
                "exactUserAndCalendarBinding": .bool(true), "managedApprovedLumaEventsOnly": .bool(true),
                "transientReadsNoStore": .bool(true), "fullCalendarAuthority": .string("read-surface-only"),
                "guestsRegistrationsEmailsMeetingLinksExactAddresses": .string("blocked"),
                "writesPaginationArbitraryFiltersRaw": .string("blocked"),
                "rawCredentials": .string("railway-encrypted-only"),
            ], actions: actions, credentials: Self.lumaCredentialRequirements,
            agentFacingWrapperToolNames: actions.compactMap(\.wrapperToolName).sorted(),
            blockedActionKeys: [], rawProviderToolExposure: false,
            suppressedRawProviderToolCount: definitions.count,
            generatedAt: timestamp, redactionStatus: "provider-content-not-stored")
    }

    public func registerHopinFoundation(context: ServiceRequestContext, now: Date = Date()) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) { throw denied }
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
        let catalog = try applications.catalogSnapshot(context: context, selectedAppId: "hopin", now: now)
        guard let app = catalog.apps.first(where: { $0.slug == "hopin" }), app.name == "RingCentral Events", app.readOnly else { throw ServiceGuard.invalidInput(context: context, message: "RingCentral Events Marketplace app is unavailable for foundation registration.") }
        let permissionMap = try policies.compilePolicyMap(context: context, appIdOrSlug: app.id, preset: .approvalRequired, now: now)
        let definitions = try data.listMarketplaceProviderActionDefinitions(workspaceId: context.workspaceId, appId: app.id, limit: 500).sorted { $0.actionKey < $1.actionKey }
        let actions = definitions.map { actionFoundation(definition: $0, permissionMap: permissionMap) }
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug, providerName: app.name, providerFamily: "ringcentral-events-organization-event-schedule", connectionMode: "customer-owned-ringcentral-events-oauth-bearer", credentialOwnership: .userOwned,
            userOwnedCredentialsRequired: true, supportedPolicyPresets: [.approvalRequired, .allowDirectWrites, .readOnly, .blocked], defaultPolicyPreset: .approvalRequired, defaultPermissionMapId: permissionMap.id, adapterBoundary: "railway-brokered-ringcentral-events-fixed-rest-adapter",
            actionMapVersion: "ringcentral-events-bound-organization-read-v1",
            budgetPolicy: ["maxWrapperTools": .number(4), "maxProviderRequestsPerAction": .number(2), "maxResults": .number(10), "automaticPagination": .bool(false), "automaticRetry": .bool(false), "maxResponseBytes": .number(524_288)],
            privacyPolicy: [
                "exactOrganizationBinding": .bool(true), "firstEventPageOnly": .bool(true), "transientReadsNoStore": .bool(true), "attendeesRegistrationsTicketsReportsEmailsSpeakers": .string("blocked"), "writesPaginationDownloadsRaw": .string("blocked"),
                "rawCredentials": .string("railway-encrypted-only"), "currentProviderIdentity": .string("RingCentral Events; legacy hopin slug"),
            ], actions: actions, credentials: Self.hopinCredentialRequirements, agentFacingWrapperToolNames: actions.compactMap(\.wrapperToolName).sorted(), blockedActionKeys: [], rawProviderToolExposure: false, suppressedRawProviderToolCount: definitions.count, generatedAt: timestamp,
            redactionStatus: "provider-content-not-stored")
    }

    public func registerTwistFoundation(
        context: ServiceRequestContext, now: Date = Date()
    ) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) { throw denied }
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
        let catalog = try applications.catalogSnapshot(context: context, selectedAppId: "twist", now: now)
        guard let app = catalog.apps.first(where: { $0.slug == "twist" }),
              app.sourceType == .externalProvider,
              app.readOnly else {
            throw ServiceGuard.invalidInput(context: context, message: "Twist Marketplace app is unavailable for foundation registration.")
        }
        let permissionMap = try policies.compilePolicyMap(
            context: context, appIdOrSlug: app.id, preset: .readOnly, now: now)
        let definitions = try data.listMarketplaceProviderActionDefinitions(
            workspaceId: context.workspaceId, appId: app.id, limit: 500).sorted { $0.actionKey < $1.actionKey }
        let actions = definitions.map { actionFoundation(definition: $0, permissionMap: permissionMap) }
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
            providerName: app.name, providerFamily: "twist-workspace-channel-thread-comment",
            connectionMode: "relay-owned-twist-confidential-oauth-no-refresh",
            credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
            supportedPolicyPresets: [.readOnly, .blocked], defaultPolicyPreset: .readOnly,
            defaultPermissionMapId: permissionMap.id,
            adapterBoundary: "railway-brokered-twist-fixed-api-v3-adapter",
            actionMapVersion: "twist-asynchronous-thread-read-v1",
            budgetPolicy: [
                "maxWrapperTools": .number(5), "maxProviderRequestsPerAction": .number(2),
                "maxWorkspaces": .number(20), "maxChannels": .number(50),
                "maxInboxThreads": .number(20), "maxComments": .number(30),
                "automaticPagination": .bool(false), "automaticRetry": .bool(false),
            ], privacyPolicy: [
                "connectedUserOnly": .bool(true), "transientReadsNoStore": .bool(true),
                "fixedEndpointsOnly": .bool(true),
                "directMessagesSearchAttachmentsNotificationsMembers": .string("blocked"),
                "writesRemovesWebhooksBotsBulkExportRawAPI": .string("blocked"),
                "rawCredentials": .string("railway-encrypted-only"),
            ], actions: actions, credentials: Self.twistCredentialRequirements,
            agentFacingWrapperToolNames: actions.compactMap(\.wrapperToolName).sorted(),
            blockedActionKeys: [], rawProviderToolExposure: false,
            suppressedRawProviderToolCount: definitions.count,
            generatedAt: timestamp, redactionStatus: "provider-content-not-stored")
    }

    public func registerZohoMailFoundation(
        context: ServiceRequestContext, now: Date = Date()
    ) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) { throw denied }
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
        let catalog = try applications.catalogSnapshot(context: context, selectedAppId: "zoho-mail", now: now)
        guard let app = catalog.apps.first(where: { $0.slug == "zoho-mail" }),
              app.sourceType == .externalProvider,
              app.readOnly else {
            throw ServiceGuard.invalidInput(context: context, message: "Zoho Mail Marketplace app is unavailable for foundation registration.")
        }
        let permissionMap = try policies.compilePolicyMap(
            context: context, appIdOrSlug: app.id, preset: .readOnly, now: now)
        let definitions = try data.listMarketplaceProviderActionDefinitions(
            workspaceId: context.workspaceId, appId: app.id, limit: 500).sorted { $0.actionKey < $1.actionKey }
        let actions = definitions.map { actionFoundation(definition: $0, permissionMap: permissionMap) }
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
            providerName: app.name, providerFamily: "zoho-mail-account-folder-message",
            connectionMode: "relay-owned-zoho-confidential-oauth-offline-refresh-multidc",
            credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
            supportedPolicyPresets: [.readOnly, .blocked], defaultPolicyPreset: .readOnly,
            defaultPermissionMapId: permissionMap.id,
            adapterBoundary: "railway-brokered-zoho-mail-fixed-regional-rest-adapter",
            actionMapVersion: "zoho-mail-bounded-read-v1",
            budgetPolicy: [
                "maxWrapperTools": .number(4), "maxProviderRequestsPerAction": .number(3),
                "maxListResults": .number(25), "maxMessageTextCharacters": .number(8000),
                "readTimeoutSeconds": .number(20), "automaticPagination": .bool(false),
                "automaticRetry": .bool(false),
            ], privacyPolicy: [
                "connectedAccountOnly": .bool(true), "regionalAuthorityBound": .bool(true),
                "transientReadsNoStore": .bool(true), "sanitizedMessageText": .bool(true),
                "attachmentMetadataOnly": .bool(true),
                "mailWritesAndAdministration": .string("blocked"),
                "bulkExportPaginationRawAPI": .string("blocked"),
                "rawCredentials": .string("railway-encrypted-only"),
            ], actions: actions, credentials: Self.zohoMailCredentialRequirements,
            agentFacingWrapperToolNames: actions.compactMap(\.wrapperToolName).sorted(),
            blockedActionKeys: [], rawProviderToolExposure: false,
            suppressedRawProviderToolCount: definitions.count,
            generatedAt: timestamp, redactionStatus: "provider-content-not-stored")
    }

    public func registerWebexFoundation(
        context: ServiceRequestContext, now: Date = Date()
    ) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) { throw denied }
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
        let catalog = try applications.catalogSnapshot(context: context, selectedAppId: "webex", now: now)
        guard let app = catalog.apps.first(where: { $0.slug == "webex" }),
              app.sourceType == .externalProvider else {
            throw ServiceGuard.invalidInput(context: context, message: "Webex Marketplace app is unavailable for foundation registration.")
        }
        let permissionMap = try policies.compilePolicyMap(context: context, appIdOrSlug: app.id, preset: .approvalRequired, now: now)
        let definitions = try data.listMarketplaceProviderActionDefinitions(
            workspaceId: context.workspaceId, appId: app.id, limit: 500).sorted { $0.actionKey < $1.actionKey }
        let actions = definitions.map { actionFoundation(definition: $0, permissionMap: permissionMap) }
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
            providerName: app.name, providerFamily: "webex-connected-person-meetings",
            connectionMode: "relay-owned-webex-confidential-oauth-pkce-rotating-refresh",
            credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
            supportedPolicyPresets: [.approvalRequired, .allowDirectWrites, .readOnly, .blocked], defaultPolicyPreset: .approvalRequired,
            defaultPermissionMapId: permissionMap.id,
            adapterBoundary: "railway-brokered-webex-fixed-rest-adapter",
            actionMapVersion: "webex-person-meeting-read-v1",
            budgetPolicy: [
                "maxWrapperTools": .number(3), "maxProviderRequestsPerAction": .number(2),
                "maxResults": .number(10), "maxResponseBytes": .number(524_288),
                "automaticPagination": .bool(false), "automaticRetry": .bool(false),
            ], privacyPolicy: [
                "connectedPersonOnly": .bool(true), "firstMeetingPageOnly": .bool(true),
                "transientReadsNoStore": .bool(true), "personIdsEmailsJoinLinks": .string("blocked"),
                "inviteesAttendeesRecordingsTranscriptsSummaries": .string("blocked"),
                "messagingCallingAdminComplianceAnalyticsRaw": .string("blocked"),
                "mutationsPaginationExports": .string("blocked"),
                "rawCredentials": .string("railway-encrypted-only"),
            ], actions: actions, credentials: Self.webexCredentialRequirements,
            agentFacingWrapperToolNames: actions.compactMap(\.wrapperToolName).sorted(),
            blockedActionKeys: [], rawProviderToolExposure: false,
            suppressedRawProviderToolCount: definitions.count,
            generatedAt: timestamp, redactionStatus: "provider-content-not-stored")
    }

    public func registerGoToMeetingFoundation(
        context: ServiceRequestContext, now: Date = Date()
    ) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) { throw denied }
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
        let catalog = try applications.catalogSnapshot(context: context, selectedAppId: "goto-meeting", now: now)
        guard let app = catalog.apps.first(where: { $0.slug == "goto-meeting" }),
              app.sourceType == .externalProvider else {
            throw ServiceGuard.invalidInput(context: context, message: "GoTo Meeting Marketplace app is unavailable for foundation registration.")
        }
        let permissionMap = try policies.compilePolicyMap(context: context, appIdOrSlug: app.id, preset: .approvalRequired, now: now)
        let definitions = try data.listMarketplaceProviderActionDefinitions(
            workspaceId: context.workspaceId, appId: app.id, limit: 500).sorted { $0.actionKey < $1.actionKey }
        let actions = definitions.map { actionFoundation(definition: $0, permissionMap: permissionMap) }
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
            providerName: app.name, providerFamily: "goto-connected-organizer-upcoming-meetings",
            connectionMode: "relay-owned-goto-confidential-oauth-basic-conditional-refresh",
            credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
            supportedPolicyPresets: [.approvalRequired, .allowDirectWrites, .readOnly, .blocked], defaultPolicyPreset: .approvalRequired,
            defaultPermissionMapId: permissionMap.id,
            adapterBoundary: "railway-brokered-goto-meeting-fixed-rest-adapter",
            actionMapVersion: "goto-organizer-upcoming-meeting-read-v1",
            budgetPolicy: ["maxWrapperTools": .number(3), "maxProviderRequestsPerAction": .number(2),
                "maxResults": .number(10), "maxResponseBytes": .number(524_288),
                "automaticPagination": .bool(false), "automaticRetry": .bool(false)],
            privacyPolicy: ["connectedOrganizerOnly": .bool(true), "firstTenUpcomingMeetingsOnly": .bool(true),
                "transientReadsNoStore": .bool(true), "organizerIdsEmailsJoinLinks": .string("blocked"),
                "attendeesHistorySessionsRecordingsTranscriptsSummaries": .string("blocked"),
                "passwordsConferenceCredentials": .string("blocked"),
                "adminOtherProductsPaginationExportsRaw": .string("blocked"),
                "rawCredentials": .string("railway-encrypted-only")],
            actions: actions, credentials: Self.goToMeetingCredentialRequirements,
            agentFacingWrapperToolNames: actions.compactMap(\.wrapperToolName).sorted(),
            blockedActionKeys: [], rawProviderToolExposure: false,
            suppressedRawProviderToolCount: definitions.count,
            generatedAt: timestamp, redactionStatus: "provider-content-not-stored")
    }

    public func registerRingCentralFoundation(
        context: ServiceRequestContext, now: Date = Date()
    ) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) { throw denied }
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
        let catalog = try applications.catalogSnapshot(context: context, selectedAppId: "ringcentral", now: now)
        guard let app = catalog.apps.first(where: { $0.slug == "ringcentral" }),
              app.sourceType == .externalProvider else {
            throw ServiceGuard.invalidInput(context: context, message: "RingCentral Marketplace app is unavailable for foundation registration.")
        }
        let permissionMap = try policies.compilePolicyMap(context: context, appIdOrSlug: app.id, preset: .approvalRequired, now: now)
        let definitions = try data.listMarketplaceProviderActionDefinitions(
            workspaceId: context.workspaceId, appId: app.id, limit: 500).sorted { $0.actionKey < $1.actionKey }
        let actions = definitions.map { actionFoundation(definition: $0, permissionMap: permissionMap) }
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
            providerName: app.name, providerFamily: "ringcentral-self-extension-call-log",
            connectionMode: "relay-owned-ringcentral-pkce-rotating-refresh",
            credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
            supportedPolicyPresets: [.approvalRequired, .allowDirectWrites, .readOnly, .blocked], defaultPolicyPreset: .approvalRequired,
            defaultPermissionMapId: permissionMap.id,
            adapterBoundary: "railway-brokered-ringcentral-fixed-rest-adapter",
            actionMapVersion: "ringcentral-self-extension-call-log-read-v1",
            budgetPolicy: ["maxWrapperTools": .number(3), "maxProviderRequestsPerAction": .number(2),
                "maxResults": .number(10), "maxResponseBytes": .number(524_288),
                "automaticPagination": .bool(false), "automaticRetry": .bool(false)],
            privacyPolicy: ["connectedExtensionOnly": .bool(true), "firstTenRecentRecordsOnly": .bool(true),
                "privacyMaskedNumbers": .bool(true), "namesEmailProviderIds": .string("blocked"),
                "transientReadsNoStore": .bool(true), "recordingsMessagesDetailedLegs": .string("blocked"),
                "otherExtensionsAdminOtherProductsLaterPagesWritesRaw": .string("blocked"),
                "rawCredentials": .string("railway-encrypted-only")],
            actions: actions, credentials: Self.ringCentralCredentialRequirements,
            agentFacingWrapperToolNames: actions.compactMap(\.wrapperToolName).sorted(),
            blockedActionKeys: [], rawProviderToolExposure: false,
            suppressedRawProviderToolCount: definitions.count,
            generatedAt: timestamp, redactionStatus: "provider-content-not-stored")
    }

    public func registerDialpadFoundation(
        context: ServiceRequestContext, now: Date = Date()
    ) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) { throw denied }
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
        let catalog = try applications.catalogSnapshot(context: context, selectedAppId: "dialpad", now: now)
        guard let app = catalog.apps.first(where: { $0.slug == "dialpad" }), app.sourceType == .externalProvider else {
            throw ServiceGuard.invalidInput(context: context, message: "Dialpad Marketplace app is unavailable for foundation registration.")
        }
        let permissionMap = try policies.compilePolicyMap(context: context, appIdOrSlug: app.id, preset: .approvalRequired, now: now)
        let definitions = try data.listMarketplaceProviderActionDefinitions(workspaceId: context.workspaceId, appId: app.id, limit: 500).sorted { $0.actionKey < $1.actionKey }
        let actions = definitions.map { actionFoundation(definition: $0, permissionMap: permissionMap) }
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug, providerName: app.name,
            providerFamily: "dialpad-own-user-caller-id", connectionMode: "relay-owned-dialpad-confidential-pkce-refresh",
            credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
            supportedPolicyPresets: [.approvalRequired, .allowDirectWrites, .readOnly, .blocked], defaultPolicyPreset: .approvalRequired,
            defaultPermissionMapId: permissionMap.id, adapterBoundary: "railway-brokered-dialpad-fixed-rest-adapter",
            actionMapVersion: "dialpad-own-user-caller-id-read-v1",
            budgetPolicy: ["maxWrapperTools": .number(2), "maxProviderRequestsPerAction": .number(1), "maxResults": .number(10), "maxResponseBytes": .number(524_288), "automaticPagination": .bool(false), "automaticRetry": .bool(false)],
            privacyPolicy: [
                "connectedUserOnly": .bool(true), "providerIdentityEmailExtensionOrganization": .string("blocked"), "privacyMaskedNumbers": .bool(true), "forwardingNumbers": .string("blocked"), "transientReadsNoStore": .bool(true), "callsRecordingsTranscriptsMessages": .string("blocked"),
                "companyAdminCommunicationsEventsWritesRaw": .string("blocked"), "rawCredentials": .string("railway-encrypted-only"),
            ],
            actions: actions, credentials: Self.dialpadCredentialRequirements,
            agentFacingWrapperToolNames: actions.compactMap(\.wrapperToolName).sorted(), blockedActionKeys: [],
            rawProviderToolExposure: false, suppressedRawProviderToolCount: definitions.count,
            generatedAt: timestamp, redactionStatus: "provider-content-not-stored")
    }

    public func registerAircallFoundation(
        context: ServiceRequestContext, now: Date = Date()
    ) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) { throw denied }
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
        let catalog = try applications.catalogSnapshot(context: context, selectedAppId: "aircall", now: now)
        guard let app = catalog.apps.first(where: { $0.slug == "aircall" }), app.sourceType == .externalProvider else {
            throw ServiceGuard.invalidInput(context: context, message: "Aircall Marketplace app is unavailable for foundation registration.")
        }
        let permissionMap = try policies.compilePolicyMap(context: context, appIdOrSlug: app.id, preset: .approvalRequired, now: now)
        let definitions = try data.listMarketplaceProviderActionDefinitions(workspaceId: context.workspaceId, appId: app.id, limit: 500).sorted { $0.actionKey < $1.actionKey }
        let actions = definitions.map { actionFoundation(definition: $0, permissionMap: permissionMap) }
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug, providerName: app.name,
            providerFamily: "aircall-company-phone-numbers", connectionMode: "relay-owned-aircall-confidential-nonexpiring-token",
            credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
            supportedPolicyPresets: [.approvalRequired, .allowDirectWrites, .readOnly, .blocked], defaultPolicyPreset: .approvalRequired,
            defaultPermissionMapId: permissionMap.id, adapterBoundary: "railway-brokered-aircall-fixed-rest-adapter",
            actionMapVersion: "aircall-company-number-read-v1",
            budgetPolicy: ["maxWrapperTools": .number(2), "maxProviderRequestsPerAction": .number(3), "maxResults": .number(10), "maxResponseBytes": .number(524_288), "automaticPagination": .bool(false), "automaticRetry": .bool(false)],
            privacyPolicy: [
                "connectedCompanyOnly": .bool(true), "providerIdsInstallerUsers": .string("blocked"), "privacyMaskedNumbers": .bool(true), "firstPageOnly": .bool(true), "transientReadsNoStore": .bool(true), "callsRecordingsTranscriptsMessagesRouting": .string("blocked"),
                "administrationExportsWritesRaw": .string("blocked"), "rawCredentials": .string("railway-encrypted-only"),
            ],
            actions: actions, credentials: Self.aircallCredentialRequirements,
            agentFacingWrapperToolNames: actions.compactMap(\.wrapperToolName).sorted(), blockedActionKeys: [],
            rawProviderToolExposure: false, suppressedRawProviderToolCount: definitions.count,
            generatedAt: timestamp, redactionStatus: "provider-content-not-stored")
    }

    public func registerOpenPhoneFoundation(
        context: ServiceRequestContext, now: Date = Date()
    ) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) { throw denied }
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
        let catalog = try applications.catalogSnapshot(context: context, selectedAppId: "openphone", now: now)
        guard let app = catalog.apps.first(where: { $0.slug == "openphone" }), app.sourceType == .externalProvider else {
            throw ServiceGuard.invalidInput(context: context, message: "Quo Marketplace app is unavailable for foundation registration.")
        }
        let permissionMap = try policies.compilePolicyMap(context: context, appIdOrSlug: app.id, preset: .approvalRequired, now: now)
        let definitions = try data.listMarketplaceProviderActionDefinitions(workspaceId: context.workspaceId, appId: app.id, limit: 500).sorted { $0.actionKey < $1.actionKey }
        let actions = definitions.map { actionFoundation(definition: $0, permissionMap: permissionMap) }
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug, providerName: app.name,
            providerFamily: "quo-openphone-workspace-phone-numbers", connectionMode: "customer-owned-full-access-workspace-api-key",
            credentialOwnership: .userOwned, userOwnedCredentialsRequired: true,
            supportedPolicyPresets: [.approvalRequired, .allowDirectWrites, .readOnly, .blocked], defaultPolicyPreset: .approvalRequired,
            defaultPermissionMapId: permissionMap.id, adapterBoundary: "railway-brokered-quo-fixed-phone-number-adapter",
            actionMapVersion: "quo-openphone-masked-number-read-v1",
            budgetPolicy: ["maxWrapperTools": .number(1), "maxProviderRequestsPerAction": .number(1), "maxResults": .number(10), "maxResponseBytes": .number(524_288), "automaticPagination": .bool(false), "automaticRetry": .bool(false)],
            privacyPolicy: [
                "fullAccessWorkspaceKey": .bool(true), "readSurfaceOnly": .bool(true), "privacyMaskedNumbers": .bool(true), "providerIdsUsersContactsForwarding": .string("blocked"), "transientReadsNoStore": .bool(true), "callsRecordingsTranscriptsMessages": .string("blocked"),
                "writesBillingLaterPagesRaw": .string("blocked"), "rawCredentials": .string("railway-encrypted-only"),
            ],
            actions: actions, credentials: Self.openPhoneCredentialRequirements,
            agentFacingWrapperToolNames: actions.compactMap(\.wrapperToolName).sorted(), blockedActionKeys: [],
            rawProviderToolExposure: false, suppressedRawProviderToolCount: definitions.count,
            generatedAt: timestamp, redactionStatus: "provider-content-not-stored")
    }

    public func registerLINEFoundation(
        context: ServiceRequestContext, now: Date = Date()
    ) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) { throw denied }
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
        let catalog = try applications.catalogSnapshot(context: context, selectedAppId: "line", now: now)
        guard let app = catalog.apps.first(where: { $0.slug == "line" }), app.sourceType == .externalProvider else {
            throw ServiceGuard.invalidInput(context: context, message: "LINE Marketplace app is unavailable for foundation registration.")
        }
        let permissionMap = try policies.compilePolicyMap(context: context, appIdOrSlug: app.id, preset: .readOnly, now: now)
        let definitions = try data.listMarketplaceProviderActionDefinitions(workspaceId: context.workspaceId, appId: app.id, limit: 500).sorted { $0.actionKey < $1.actionKey }
        let actions = definitions.map { actionFoundation(definition: $0, permissionMap: permissionMap) }
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug, providerName: app.name,
            providerFamily: "line-login-connected-profile", connectionMode: "relay-owned-line-confidential-oidc-pkce-refresh",
            credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
            supportedPolicyPresets: [.readOnly, .blocked], defaultPolicyPreset: .readOnly,
            defaultPermissionMapId: permissionMap.id, adapterBoundary: "railway-brokered-line-fixed-profile-adapter",
            actionMapVersion: "line-login-connected-profile-read-v1",
            budgetPolicy: ["maxWrapperTools": .number(1), "maxProviderRequestsPerAction": .number(1), "automaticPagination": .bool(false), "automaticRetry": .bool(false)],
            privacyPolicy: ["oidcSubjectBound": .bool(true), "transientReadsNoStore": .bool(true), "emailFriendshipSocialGraph": .string("blocked"), "messagingApiBotMessagesWritesRaw": .string("blocked"), "rawCredentials": .string("railway-encrypted-only")],
            actions: actions, credentials: Self.lineCredentialRequirements,
            agentFacingWrapperToolNames: actions.compactMap(\.wrapperToolName).sorted(), blockedActionKeys: [],
            rawProviderToolExposure: false, suppressedRawProviderToolCount: definitions.count,
            generatedAt: timestamp, redactionStatus: "provider-content-not-stored")
    }

    public func registerTwilioFoundation(
        context: ServiceRequestContext, now: Date = Date()
    ) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) { throw denied }
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
        let catalog = try applications.catalogSnapshot(context: context, selectedAppId: "twilio", now: now)
        guard let app = catalog.apps.first(where: { $0.slug == "twilio" }), app.sourceType == .externalProvider else {
            throw ServiceGuard.invalidInput(context: context, message: "Twilio Marketplace app is unavailable for foundation registration.")
        }
        let permissionMap = try policies.compilePolicyMap(context: context, appIdOrSlug: app.id, preset: .approvalRequired, now: now)
        let definitions = try data.listMarketplaceProviderActionDefinitions(workspaceId: context.workspaceId, appId: app.id, limit: 500).sorted { $0.actionKey < $1.actionKey }
        let actions = definitions.map { actionFoundation(definition: $0, permissionMap: permissionMap) }
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug, providerName: app.name,
            providerFamily: "twilio-restricted-message-status", connectionMode: "customer-owned-restricted-api-key",
            credentialOwnership: .userOwned, userOwnedCredentialsRequired: true,
            supportedPolicyPresets: [.approvalRequired, .allowDirectWrites, .readOnly, .blocked], defaultPolicyPreset: .approvalRequired,
            defaultPermissionMapId: permissionMap.id, adapterBoundary: "railway-brokered-twilio-fixed-message-status-adapter",
            actionMapVersion: "twilio-masked-message-status-read-v1",
            budgetPolicy: ["maxWrapperTools": .number(1), "maxProviderRequestsPerAction": .number(1), "maxResults": .number(10), "maxResponseBytes": .number(524_288), "automaticPagination": .bool(false), "automaticRetry": .bool(false)],
            privacyPolicy: [
                "restrictedMessageReadOnly": .bool(true), "privacyMaskedAddresses": .bool(true), "messageBodiesMediaSidsAccountIdentity": .string("blocked"), "transientReadsNoStore": .bool(true), "liveCommunications": .string("blocked"), "administrationWritesPaginationRaw": .string("blocked"),
                "rawCredentials": .string("railway-encrypted-only"),
            ],
            actions: actions, credentials: Self.twilioCredentialRequirements,
            agentFacingWrapperToolNames: actions.compactMap(\.wrapperToolName).sorted(), blockedActionKeys: [],
            rawProviderToolExposure: false, suppressedRawProviderToolCount: definitions.count,
            generatedAt: timestamp, redactionStatus: "provider-content-not-stored")
    }

    public func registerVonageFoundation(
        context: ServiceRequestContext, now: Date = Date()
    ) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) { throw denied }
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
        let catalog = try applications.catalogSnapshot(context: context, selectedAppId: "vonage", now: now)
        guard let app = catalog.apps.first(where: { $0.slug == "vonage" }), app.sourceType == .externalProvider else {
            throw ServiceGuard.invalidInput(context: context, message: "Vonage Marketplace app is unavailable for foundation registration.")
        }
        let permissionMap = try policies.compilePolicyMap(context: context, appIdOrSlug: app.id, preset: .approvalRequired, now: now)
        let definitions = try data.listMarketplaceProviderActionDefinitions(workspaceId: context.workspaceId, appId: app.id, limit: 500).sorted { $0.actionKey < $1.actionKey }
        let actions = definitions.map { actionFoundation(definition: $0, permissionMap: permissionMap) }
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug, providerName: app.name,
            providerFamily: "vonage-communications-api-account-balance", connectionMode: "customer-owned-api-key-dedicated-secondary-secret",
            credentialOwnership: .userOwned, userOwnedCredentialsRequired: true,
            supportedPolicyPresets: [.approvalRequired, .allowDirectWrites, .readOnly, .blocked], defaultPolicyPreset: .approvalRequired,
            defaultPermissionMapId: permissionMap.id, adapterBoundary: "railway-brokered-vonage-fixed-balance-adapter",
            actionMapVersion: "vonage-account-balance-read-v1",
            budgetPolicy: ["maxWrapperTools": .number(1), "maxProviderRequestsPerAction": .number(1), "maxResponseBytes": .number(65_536), "automaticPagination": .bool(false), "automaticRetry": .bool(false)],
            privacyPolicy: [
                "fullAccountSecret": .bool(true), "dedicatedSecondarySecretRequired": .bool(true), "financialReadOnly": .bool(true), "balanceCurrency": .string("EUR"), "transientReadsNoStore": .bool(true), "communicationsContentIdentity": .string("blocked"),
                "topupsSettingsSecretAdminWritesRaw": .string("blocked"), "rawCredentials": .string("railway-encrypted-only"),
            ],
            actions: actions, credentials: Self.vonageCredentialRequirements,
            agentFacingWrapperToolNames: actions.compactMap(\.wrapperToolName).sorted(), blockedActionKeys: [],
            rawProviderToolExposure: false, suppressedRawProviderToolCount: definitions.count,
            generatedAt: timestamp, redactionStatus: "provider-content-not-stored")
    }

    public func registerMessageBirdFoundation(
        context: ServiceRequestContext, now: Date = Date()
    ) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) { throw denied }
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
        let catalog = try applications.catalogSnapshot(context: context, selectedAppId: "messagebird", now: now)
        guard let app = catalog.apps.first(where: { $0.slug == "messagebird" }), app.sourceType == .externalProvider else {
            throw ServiceGuard.invalidInput(context: context, message: "Bird Marketplace app is unavailable for foundation registration.")
        }
        let permissionMap = try policies.compilePolicyMap(context: context, appIdOrSlug: app.id, preset: .approvalRequired, now: now)
        let definitions = try data.listMarketplaceProviderActionDefinitions(workspaceId: context.workspaceId, appId: app.id, limit: 500).sorted { $0.actionKey < $1.actionKey }
        let actions = definitions.map { actionFoundation(definition: $0, permissionMap: permissionMap) }
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug, providerName: app.name,
            providerFamily: "bird-messagebird-workspace-metadata", connectionMode: "customer-owned-role-bound-access-key",
            credentialOwnership: .userOwned, userOwnedCredentialsRequired: true,
            supportedPolicyPresets: [.approvalRequired, .allowDirectWrites, .readOnly, .blocked], defaultPolicyPreset: .approvalRequired,
            defaultPermissionMapId: permissionMap.id, adapterBoundary: "railway-brokered-messagebird-fixed-workspace-status-adapter",
            actionMapVersion: "messagebird-workspace-status-read-v1",
            budgetPolicy: ["maxWrapperTools": .number(1), "maxProviderRequestsPerAction": .number(1), "maxResponseBytes": .number(65_536), "automaticPagination": .bool(false), "automaticRetry": .bool(false)],
            privacyPolicy: [
                "fullAccessKey": .bool(true), "dedicatedRoleBoundKeyRequired": .bool(true), "workspaceMetadataOnly": .bool(true), "selectedOrganizationWorkspace": .bool(true), "transientReadsNoStore": .bool(true), "customerCommunicationsContentContacts": .string("blocked"),
                "billingAdministrationKeyAdminWritesRaw": .string("blocked"), "rawCredentials": .string("railway-encrypted-only"),
            ],
            actions: actions, credentials: Self.messageBirdCredentialRequirements,
            agentFacingWrapperToolNames: actions.compactMap(\.wrapperToolName).sorted(), blockedActionKeys: [],
            rawProviderToolExposure: false, suppressedRawProviderToolCount: definitions.count,
            generatedAt: timestamp, redactionStatus: "provider-content-not-stored")
    }

    public func registerFREDFoundation(
        context: ServiceRequestContext, now: Date = Date()
    ) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) { throw denied }
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
        let catalog = try applications.catalogSnapshot(context: context, selectedAppId: "fred", now: now)
        guard let app = catalog.apps.first(where: { $0.slug == "fred" }), app.sourceType == .externalProvider else {
            throw ServiceGuard.invalidInput(context: context, message: "FRED Marketplace app is unavailable for foundation registration.")
        }
        let permissionMap = try policies.compilePolicyMap(context: context, appIdOrSlug: app.id, preset: .approvalRequired, now: now)
        let definitions = try data.listMarketplaceProviderActionDefinitions(workspaceId: context.workspaceId, appId: app.id, limit: 500).sorted { $0.actionKey < $1.actionKey }
        let actions = definitions.map { actionFoundation(definition: $0, permissionMap: permissionMap) }
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug, providerName: app.name,
            providerFamily: "fred-public-economic-series", connectionMode: "customer-owned-api-key",
            credentialOwnership: .userOwned, userOwnedCredentialsRequired: true,
            supportedPolicyPresets: [.approvalRequired, .allowDirectWrites, .readOnly, .blocked], defaultPolicyPreset: .approvalRequired,
            defaultPermissionMapId: permissionMap.id, adapterBoundary: "railway-brokered-fred-fixed-series-read-adapter",
            actionMapVersion: "fred-bounded-series-reads-v1",
            budgetPolicy: ["maxWrapperTools": .number(2), "maxProviderRequestsPerAction": .number(1), "maxSeriesResults": .number(10), "maxObservationResults": .number(25), "maxResponseBytes": .number(262_144), "automaticPagination": .bool(false), "automaticRetry": .bool(false)],
            privacyPolicy: [
                "fullAPIKey": .bool(true), "publicEconomicDataReadOnly": .bool(true), "transientReadsNoStore": .bool(true), "thirdPartySeriesRightsReviewRequired": .bool(true), "bulkVintageTransformsBroaderMetadata": .string("blocked"), "arbitraryRequestsWritesRaw": .string("blocked"),
                "rawCredentials": .string("railway-encrypted-only"),
            ],
            actions: actions, credentials: Self.fredCredentialRequirements,
            agentFacingWrapperToolNames: actions.compactMap(\.wrapperToolName).sorted(), blockedActionKeys: [],
            rawProviderToolExposure: false, suppressedRawProviderToolCount: definitions.count,
            generatedAt: timestamp, redactionStatus: "provider-content-not-stored")
    }

    public func registerApolloGraphOSFoundation(
        context: ServiceRequestContext, now: Date = Date()
    ) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) { throw denied }
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
        let catalog = try applications.catalogSnapshot(context: context, selectedAppId: "apollo-graphql-studio", now: now)
        guard let app = catalog.apps.first(where: { $0.slug == "apollo-graphql-studio" }), app.sourceType == .externalProvider else {
            throw ServiceGuard.invalidInput(context: context, message: "Apollo GraphQL Studio Marketplace app is unavailable for foundation registration.")
        }
        let permissionMap = try policies.compilePolicyMap(context: context, appIdOrSlug: app.id, preset: .approvalRequired, now: now)
        let definitions = try data.listMarketplaceProviderActionDefinitions(workspaceId: context.workspaceId, appId: app.id, limit: 500).sorted { $0.actionKey < $1.actionKey }
        let actions = definitions.map { actionFoundation(definition: $0, permissionMap: permissionMap) }
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug, providerName: app.name,
            providerFamily: "apollo-graphos-platform-metadata", connectionMode: "customer-owned-graph-api-key",
            credentialOwnership: .userOwned, userOwnedCredentialsRequired: true,
            supportedPolicyPresets: [.approvalRequired, .allowDirectWrites, .readOnly, .blocked], defaultPolicyPreset: .approvalRequired,
            defaultPermissionMapId: permissionMap.id, adapterBoundary: "railway-brokered-apollo-fixed-graphql-document-adapter",
            actionMapVersion: "apollo-graphos-fixed-metadata-reads-v1",
            budgetPolicy: ["maxWrapperTools": .number(2), "maxProviderRequestsPerAction": .number(2), "maxResponseBytes": .number(262_144), "automaticPagination": .bool(false), "automaticRetry": .bool(false)],
            privacyPolicy: [
                "fullGraphAPIKey": .bool(true), "dedicatedGraphScopedKeyRequired": .bool(true), "exactGraphVariantBinding": .bool(true), "transientReadsNoStore": .bool(true), "schemasOperationsTelemetry": .string("blocked"), "mutationsAdministrationRawGraphQL": .string("blocked"),
                "rawCredentials": .string("railway-encrypted-only"),
            ],
            actions: actions, credentials: Self.apolloGraphOSCredentialRequirements,
            agentFacingWrapperToolNames: actions.compactMap(\.wrapperToolName).sorted(), blockedActionKeys: [],
            rawProviderToolExposure: false, suppressedRawProviderToolCount: definitions.count,
            generatedAt: timestamp, redactionStatus: "provider-content-not-stored")
    }

    public func registerHunterFoundation(
        context: ServiceRequestContext, now: Date = Date()
    ) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) { throw denied }
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
        let catalog = try applications.catalogSnapshot(context: context, selectedAppId: "hunter-io", now: now)
        guard let app = catalog.apps.first(where: { $0.slug == "hunter-io" }), app.sourceType == .externalProvider else {
            throw ServiceGuard.invalidInput(context: context, message: "Hunter Marketplace app is unavailable for foundation registration.")
        }
        let permissionMap = try policies.compilePolicyMap(context: context, appIdOrSlug: app.id, preset: .approvalRequired, now: now)
        let definitions = try data.listMarketplaceProviderActionDefinitions(workspaceId: context.workspaceId, appId: app.id, limit: 500).sorted { $0.actionKey < $1.actionKey }
        let actions = definitions.map { actionFoundation(definition: $0, permissionMap: permissionMap) }
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug, providerName: app.name,
            providerFamily: "hunter-bounded-email-verification", connectionMode: "customer-owned-api-key",
            credentialOwnership: .userOwned, userOwnedCredentialsRequired: true,
            supportedPolicyPresets: [.approvalRequired, .allowDirectWrites, .readOnly, .blocked], defaultPolicyPreset: .approvalRequired,
            defaultPermissionMapId: permissionMap.id, adapterBoundary: "railway-brokered-hunter-fixed-reduced-read-adapter",
            actionMapVersion: "hunter-usage-count-verify-v1",
            budgetPolicy: ["maxWrapperTools": .number(3), "maxProviderRequestsPerAction": .number(1), "maxEmailsPerVerification": .number(1), "verificationCreditCost": .number(0.5), "maxResponseBytes": .number(262_144), "automaticPagination": .bool(false), "automaticRetry": .bool(false)],
            privacyPolicy: [
                "fullAPIKey": .bool(true), "singleExplicitEmailOnly": .bool(true), "emailExcludedFromResultsAndAudit": .bool(true), "transientReadsNoStore": .bool(true), "claimedEmail451DoNotProcess": .bool(true), "contactDiscoveryEnrichmentOutreach": .string("blocked"),
                "resourceManagementAdminBulkRaw": .string("blocked"), "rawCredentials": .string("railway-encrypted-only"),
            ],
            actions: actions, credentials: Self.hunterCredentialRequirements,
            agentFacingWrapperToolNames: actions.compactMap(\.wrapperToolName).sorted(), blockedActionKeys: [],
            rawProviderToolExposure: false, suppressedRawProviderToolCount: definitions.count,
            generatedAt: timestamp, redactionStatus: "provider-content-not-stored")
    }

    public func registerSnovFoundation(
        context: ServiceRequestContext, now: Date = Date()
    ) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) { throw denied }
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
        let catalog = try applications.catalogSnapshot(context: context, selectedAppId: "snov-io", now: now)
        guard let app = catalog.apps.first(where: { $0.slug == "snov-io" }), app.sourceType == .externalProvider else {
            throw ServiceGuard.invalidInput(context: context, message: "Snov.io Marketplace app is unavailable for foundation registration.")
        }
        let permissionMap = try policies.compilePolicyMap(context: context, appIdOrSlug: app.id, preset: .approvalRequired, now: now)
        let definitions = try data.listMarketplaceProviderActionDefinitions(workspaceId: context.workspaceId, appId: app.id, limit: 500).sorted { $0.actionKey < $1.actionKey }
        let actions = definitions.map { actionFoundation(definition: $0, permissionMap: permissionMap) }
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug, providerName: app.name,
            providerFamily: "snov-bounded-email-verification", connectionMode: "customer-owned-client-credentials",
            credentialOwnership: .userOwned, userOwnedCredentialsRequired: true,
            supportedPolicyPresets: [.approvalRequired, .allowDirectWrites, .readOnly, .blocked], defaultPolicyPreset: .approvalRequired,
            defaultPermissionMapId: permissionMap.id, adapterBoundary: "railway-brokered-snov-fixed-single-email-verification-adapter",
            actionMapVersion: "snov-one-email-start-result-v1",
            budgetPolicy: [
                "maxWrapperTools": .number(2), "maxProviderRequestsPerAction": .number(2), "maxEmailsPerStart": .number(1), "verificationCreditCost": .number(1), "providerRequestsPerMinute": .number(60), "maxResponseBytes": .number(262_144), "automaticPagination": .bool(false),
                "automaticRetry": .bool(false),
            ],
            privacyPolicy: [
                "fullClientCredentials": .bool(true), "ephemeralOneHourBearer": .bool(true), "singleExplicitEmailOnly": .bool(true), "emailExcludedFromResultsAndAudit": .bool(true), "hiddenByOwnerDoNotProcess": .bool(true), "transientReadsNoStore": .bool(true),
                "discoveryEnrichmentProspectsOutreach": .string("blocked"), "mailboxesWarmupCrmAdminBulkRaw": .string("blocked"), "webhooks": .string("blocked"), "rawCredentials": .string("railway-encrypted-only"),
            ],
            actions: actions, credentials: Self.snovCredentialRequirements,
            agentFacingWrapperToolNames: actions.compactMap(\.wrapperToolName).sorted(), blockedActionKeys: [],
            rawProviderToolExposure: false, suppressedRawProviderToolCount: definitions.count,
            generatedAt: timestamp, redactionStatus: "provider-content-not-stored")
    }

    public func registerLushaFoundation(
        context: ServiceRequestContext, now: Date = Date()
    ) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) { throw denied }
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
        let catalog = try applications.catalogSnapshot(context: context, selectedAppId: "lusha", now: now)
        guard let app = catalog.apps.first(where: { $0.slug == "lusha" }), app.sourceType == .externalProvider else {
            throw ServiceGuard.invalidInput(context: context, message: "Lusha Marketplace app is unavailable for foundation registration.")
        }
        let permissionMap = try policies.compilePolicyMap(context: context, appIdOrSlug: app.id, preset: .readOnly, now: now)
        let definitions = try data.listMarketplaceProviderActionDefinitions(workspaceId: context.workspaceId, appId: app.id, limit: 500).sorted { $0.actionKey < $1.actionKey }
        let actions = definitions.map { actionFoundation(definition: $0, permissionMap: permissionMap) }
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug, providerName: app.name,
            providerFamily: "lusha-account-governance", connectionMode: "customer-owned-api-key",
            credentialOwnership: .userOwned, userOwnedCredentialsRequired: true,
            supportedPolicyPresets: [.readOnly, .allowDirectWrites, .approvalRequired, .blocked], defaultPolicyPreset: .readOnly,
            defaultPermissionMapId: permissionMap.id, adapterBoundary: "railway-brokered-lusha-fixed-account-usage-adapter",
            actionMapVersion: "lusha-account-usage-only-v1",
            budgetPolicy: ["maxWrapperTools": .number(1), "maxProviderRequestsPerAction": .number(1), "providerRequestsPerMinute": .number(5), "maxResponseBytes": .number(262_144), "automaticPagination": .bool(false), "automaticRetry": .bool(false)],
            privacyPolicy: [
                "fullAccountAPIKey": .bool(true), "parameterlessAccountUsageOnly": .bool(true), "transientReadsNoStore": .bool(true), "businessProfileData": .string("blocked"), "prospectingSignalsAutomation": .string("blocked"), "webhooksAdminMcpRaw": .string("blocked"),
                "rawCredentials": .string("railway-encrypted-only"),
            ],
            actions: actions, credentials: Self.lushaCredentialRequirements,
            agentFacingWrapperToolNames: actions.compactMap(\.wrapperToolName).sorted(), blockedActionKeys: [],
            rawProviderToolExposure: false, suppressedRawProviderToolCount: definitions.count,
            generatedAt: timestamp, redactionStatus: "provider-content-not-stored")
    }

    public func registerLeadIQFoundation(
        context: ServiceRequestContext, now: Date = Date()
    ) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) { throw denied }
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
        let catalog = try applications.catalogSnapshot(context: context, selectedAppId: "leadiq", now: now)
        guard let app = catalog.apps.first(where: { $0.slug == "leadiq" }), app.sourceType == .externalProvider else {
            throw ServiceGuard.invalidInput(context: context, message: "LeadIQ Marketplace app is unavailable for foundation registration.")
        }
        let permissionMap = try policies.compilePolicyMap(context: context, appIdOrSlug: app.id, preset: .readOnly, now: now)
        let definitions = try data.listMarketplaceProviderActionDefinitions(workspaceId: context.workspaceId, appId: app.id, limit: 500).sorted { $0.actionKey < $1.actionKey }
        let actions = definitions.map { actionFoundation(definition: $0, permissionMap: permissionMap) }
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug, providerName: app.name,
            providerFamily: "leadiq-account-governance", connectionMode: "customer-owned-api-key",
            credentialOwnership: .userOwned, userOwnedCredentialsRequired: true,
            supportedPolicyPresets: [.readOnly, .allowDirectWrites, .approvalRequired, .blocked], defaultPolicyPreset: .readOnly,
            defaultPermissionMapId: permissionMap.id, adapterBoundary: "railway-brokered-leadiq-fixed-account-query-adapter",
            actionMapVersion: "leadiq-account-usage-only-v1",
            budgetPolicy: ["maxWrapperTools": .number(1), "maxProviderRequestsPerAction": .number(1), "maxResponseBytes": .number(131_072), "automaticPagination": .bool(false), "automaticRetry": .bool(false)],
            privacyPolicy: [
                "fullAccountAPIKey": .bool(true), "parameterlessAccountUsageOnly": .bool(true), "noCreditOperationOnly": .bool(true), "transientReadsNoStore": .bool(true), "peopleCompanyData": .string("blocked"), "prospectingListsExportsFeedback": .string("blocked"),
                "mcpAdminRaw": .string("blocked"), "rawCredentials": .string("railway-encrypted-only"),
            ],
            actions: actions, credentials: Self.leadIQCredentialRequirements,
            agentFacingWrapperToolNames: actions.compactMap(\.wrapperToolName).sorted(), blockedActionKeys: [],
            rawProviderToolExposure: false, suppressedRawProviderToolCount: definitions.count,
            generatedAt: timestamp, redactionStatus: "provider-content-not-stored")
    }

    public func registerSeamlessAIFoundation(
        context: ServiceRequestContext, now: Date = Date()
    ) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) { throw denied }
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
        let catalog = try applications.catalogSnapshot(context: context, selectedAppId: "seamless-ai", now: now)
        guard let app = catalog.apps.first(where: { $0.slug == "seamless-ai" }), app.sourceType == .externalProvider else {
            throw ServiceGuard.invalidInput(context: context, message: "Seamless.AI Marketplace app is unavailable for foundation registration.")
        }
        let permissionMap = try policies.compilePolicyMap(context: context, appIdOrSlug: app.id, preset: .readOnly, now: now)
        let definitions = try data.listMarketplaceProviderActionDefinitions(workspaceId: context.workspaceId, appId: app.id, limit: 500).sorted { $0.actionKey < $1.actionKey }
        let actions = definitions.map { actionFoundation(definition: $0, permissionMap: permissionMap) }
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug, providerName: app.name,
            providerFamily: "seamless-bounded-company-search", connectionMode: "customer-owned-api-key",
            credentialOwnership: .userOwned, userOwnedCredentialsRequired: true,
            supportedPolicyPresets: [.readOnly, .allowDirectWrites, .approvalRequired, .blocked], defaultPolicyPreset: .readOnly,
            defaultPermissionMapId: permissionMap.id, adapterBoundary: "railway-brokered-seamless-fixed-company-search-adapter",
            actionMapVersion: "seamless-company-search-only-v1",
            budgetPolicy: ["maxWrapperTools": .number(1), "maxProviderRequestsPerAction": .number(1), "maxResults": .number(5), "maxResponseBytes": .number(262_144), "automaticPagination": .bool(false), "automaticRetry": .bool(false)],
            privacyPolicy: [
                "fullAccountAPIKey": .bool(true), "publicApiV1Only": .bool(true), "transientReadsNoStore": .bool(true), "peopleContactData": .string("blocked"), "researchOutreachCampaigns": .string("blocked"), "mcpAdminBulkRaw": .string("blocked"),
                "rawCredentials": .string("railway-encrypted-only"),
            ],
            actions: actions, credentials: Self.seamlessAICredentialRequirements,
            agentFacingWrapperToolNames: actions.compactMap(\.wrapperToolName).sorted(), blockedActionKeys: [],
            rawProviderToolExposure: false, suppressedRawProviderToolCount: definitions.count,
            generatedAt: timestamp, redactionStatus: "provider-content-not-stored")
    }

    public func registerRocketReachFoundation(
        context: ServiceRequestContext, now: Date = Date()
    ) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) { throw denied }
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
        let catalog = try applications.catalogSnapshot(context: context, selectedAppId: "rocketreach", now: now)
        guard let app = catalog.apps.first(where: { $0.slug == "rocketreach" }), app.sourceType == .externalProvider else {
            throw ServiceGuard.invalidInput(context: context, message: "RocketReach Marketplace app is unavailable for foundation registration.")
        }
        let permissionMap = try policies.compilePolicyMap(context: context, appIdOrSlug: app.id, preset: .readOnly, now: now)
        let definitions = try data.listMarketplaceProviderActionDefinitions(workspaceId: context.workspaceId, appId: app.id, limit: 500).sorted { $0.actionKey < $1.actionKey }
        let actions = definitions.map { actionFoundation(definition: $0, permissionMap: permissionMap) }
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug, providerName: app.name,
            providerFamily: "rocketreach-account-governance", connectionMode: "customer-owned-api-key",
            credentialOwnership: .userOwned, userOwnedCredentialsRequired: true,
            supportedPolicyPresets: [.readOnly, .allowDirectWrites, .approvalRequired, .blocked], defaultPolicyPreset: .readOnly,
            defaultPermissionMapId: permissionMap.id, adapterBoundary: "railway-brokered-rocketreach-fixed-universal-account-adapter",
            actionMapVersion: "rocketreach-account-usage-only-v1",
            budgetPolicy: ["maxWrapperTools": .number(1), "maxProviderRequestsPerAction": .number(1), "maxResponseBytes": .number(131_072), "automaticPagination": .bool(false), "automaticRetry": .bool(false)],
            privacyPolicy: [
                "fullAccountAPIKey": .bool(true), "parameterlessAccountUsageOnly": .bool(true), "fixedUniversalAccountReadOnly": .bool(true), "accountIdentityStripped": .bool(true), "transientReadsNoStore": .bool(true), "peopleCompanyData": .string("blocked"),
                "bulkExportsWebhooksCommunity": .string("blocked"), "mcpAdminRaw": .string("blocked"), "rawCredentials": .string("railway-encrypted-only"),
            ],
            actions: actions, credentials: Self.rocketReachCredentialRequirements,
            agentFacingWrapperToolNames: actions.compactMap(\.wrapperToolName).sorted(), blockedActionKeys: [],
            rawProviderToolExposure: false, suppressedRawProviderToolCount: definitions.count,
            generatedAt: timestamp, redactionStatus: "provider-content-not-stored")
    }

    public func registerUpLeadFoundation(
        context: ServiceRequestContext, now: Date = Date()
    ) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) { throw denied }
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
        let catalog = try applications.catalogSnapshot(context: context, selectedAppId: "uplead", now: now)
        guard let app = catalog.apps.first(where: { $0.slug == "uplead" }), app.sourceType == .externalProvider else {
            throw ServiceGuard.invalidInput(context: context, message: "UpLead Marketplace app is unavailable for foundation registration.")
        }
        let permissionMap = try policies.compilePolicyMap(context: context, appIdOrSlug: app.id, preset: .readOnly, now: now)
        let definitions = try data.listMarketplaceProviderActionDefinitions(workspaceId: context.workspaceId, appId: app.id, limit: 500).sorted { $0.actionKey < $1.actionKey }
        let actions = definitions.map { actionFoundation(definition: $0, permissionMap: permissionMap) }
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug, providerName: app.name,
            providerFamily: "uplead-credit-governance", connectionMode: "customer-owned-api-key",
            credentialOwnership: .userOwned, userOwnedCredentialsRequired: true,
            supportedPolicyPresets: [.readOnly, .allowDirectWrites, .approvalRequired, .blocked], defaultPolicyPreset: .readOnly,
            defaultPermissionMapId: permissionMap.id, adapterBoundary: "railway-brokered-uplead-fixed-credits-adapter",
            actionMapVersion: "uplead-credit-balance-only-v1",
            budgetPolicy: ["maxWrapperTools": .number(1), "maxProviderRequestsPerAction": .number(1), "maxResponseBytes": .number(65_536), "automaticPagination": .bool(false), "automaticRetry": .bool(false)],
            privacyPolicy: [
                "fullAccountAPIKey": .bool(true), "parameterlessCreditBalanceOnly": .bool(true), "fixedCreditsReadOnly": .bool(true), "accountEmailStripped": .bool(true), "transientReadsNoStore": .bool(true), "peopleCompanyIntentData": .string("blocked"),
                "prospectingPreviewListsExports": .string("blocked"), "adminRaw": .string("blocked"), "rawCredentials": .string("railway-encrypted-only"),
            ],
            actions: actions, credentials: Self.upLeadCredentialRequirements,
            agentFacingWrapperToolNames: actions.compactMap(\.wrapperToolName).sorted(), blockedActionKeys: [],
            rawProviderToolExposure: false, suppressedRawProviderToolCount: definitions.count,
            generatedAt: timestamp, redactionStatus: "provider-content-not-stored")
    }

    public func registerWizaFoundation(
        context: ServiceRequestContext, now: Date = Date()
    ) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) { throw denied }
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
        let catalog = try applications.catalogSnapshot(context: context, selectedAppId: "wiza", now: now)
        guard let app = catalog.apps.first(where: { $0.slug == "wiza" }), app.sourceType == .externalProvider else {
            throw ServiceGuard.invalidInput(context: context, message: "Wiza Marketplace app is unavailable for foundation registration.")
        }
        let permissionMap = try policies.compilePolicyMap(context: context, appIdOrSlug: app.id, preset: .readOnly, now: now)
        let definitions = try data.listMarketplaceProviderActionDefinitions(workspaceId: context.workspaceId, appId: app.id, limit: 500).sorted { $0.actionKey < $1.actionKey }
        let actions = definitions.map { actionFoundation(definition: $0, permissionMap: permissionMap) }
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug, providerName: app.name,
            providerFamily: "wiza-credit-governance", connectionMode: "customer-owned-api-key",
            credentialOwnership: .userOwned, userOwnedCredentialsRequired: true,
            supportedPolicyPresets: [.readOnly, .allowDirectWrites, .approvalRequired, .blocked], defaultPolicyPreset: .readOnly,
            defaultPermissionMapId: permissionMap.id, adapterBoundary: "railway-brokered-wiza-fixed-credit-balances-adapter",
            actionMapVersion: "wiza-credit-balances-only-v1",
            budgetPolicy: ["maxWrapperTools": .number(1), "maxProviderRequestsPerAction": .number(1), "maxResponseBytes": .number(65_536), "automaticPagination": .bool(false), "automaticRetry": .bool(false)],
            privacyPolicy: [
                "fullAccountAPIKey": .bool(true), "parameterlessCreditBalancesOnly": .bool(true), "fixedCreditBalancesReadOnly": .bool(true), "accountIdentityStripped": .bool(true), "transientReadsNoStore": .bool(true), "peopleCompanyContactData": .string("blocked"),
                "bulkListsWebhooksExports": .string("blocked"), "adminFinancialRaw": .string("blocked"), "rawCredentials": .string("railway-encrypted-only"),
            ],
            actions: actions, credentials: Self.wizaCredentialRequirements,
            agentFacingWrapperToolNames: actions.compactMap(\.wrapperToolName).sorted(), blockedActionKeys: [],
            rawProviderToolExposure: false, suppressedRawProviderToolCount: definitions.count,
            generatedAt: timestamp, redactionStatus: "provider-content-not-stored")
    }

    public func registerPinterestFoundation(
        context: ServiceRequestContext, now: Date = Date()
    ) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) { throw denied }
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
        let catalog = try applications.catalogSnapshot(context: context, selectedAppId: "pinterest", now: now)
        guard let app = catalog.apps.first(where: { $0.slug == "pinterest" }),
              app.availability == .available, app.sourceType == .externalProvider else {
            throw ServiceGuard.invalidInput(context: context, message: "Pinterest Marketplace app is unavailable for foundation registration.")
        }
        let permissionMap = try policies.compilePolicyMap(
            context: context, appIdOrSlug: app.id, preset: .readOnly, now: now)
        let definitions = try data.listMarketplaceProviderActionDefinitions(
            workspaceId: context.workspaceId, appId: app.id, limit: 500).sorted { $0.actionKey < $1.actionKey }
        let actions = definitions.map { actionFoundation(definition: $0, permissionMap: permissionMap) }
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
            providerName: app.name, providerFamily: "pinterest-bound-user-public-content",
            connectionMode: "relay-owned-pinterest-authorization-code-continuous-refresh",
            credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
            supportedPolicyPresets: [.readOnly, .blocked],
            defaultPolicyPreset: permissionMap.policyPreset, defaultPermissionMapId: permissionMap.id,
            adapterBoundary: "brokered-native-pinterest-api-v5-transient-result-adapter",
            actionMapVersion: "pinterest-public-content-no-store-v1",
            budgetPolicy: [
                "maxWrapperTools": .number(4), "maxResults": .number(10),
                "providerRequestsPerAction": .number(1), "readTimeoutSeconds": .number(20),
                "automaticPagination": .bool(false), "automaticRetry": .bool(false),
            ],
            privacyPolicy: [
                "boundUserAccountOnly": .bool(true), "publicContentOnly": .bool(true),
                "providerDataPersisted": .bool(false), "writesAndEngagement": .string("blocked"),
                "secretContent": .string("blocked"), "adsAnalyticsSearch": .string("blocked"),
                "mediaTransfer": .string("blocked"),
                "rawCredentials": .string("two-keychain-references"),
            ], actions: actions, credentials: Self.pinterestCredentialRequirements,
            agentFacingWrapperToolNames: actions.compactMap(\.wrapperToolName).sorted(),
            blockedActionKeys: [], rawProviderToolExposure: false,
            suppressedRawProviderToolCount: definitions.count,
            generatedAt: timestamp, redactionStatus: "private-state-excluded")
    }

    public func registerTumblrFoundation(
        context: ServiceRequestContext, now: Date = Date()
    ) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) { throw denied }
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
        let catalog = try applications.catalogSnapshot(context: context, selectedAppId: "tumblr", now: now)
        guard let app = catalog.apps.first(where: { $0.slug == "tumblr" }),
              app.availability == .available, app.sourceType == .externalProvider else {
            throw ServiceGuard.invalidInput(context: context, message: "Tumblr Marketplace app is unavailable for foundation registration.")
        }
        let permissionMap = try policies.compilePolicyMap(
            context: context, appIdOrSlug: app.id, preset: .readOnly, now: now)
        let definitions = try data.listMarketplaceProviderActionDefinitions(
            workspaceId: context.workspaceId, appId: app.id, limit: 500).sorted {
                $0.actionKey < $1.actionKey
            }
        let actions = definitions.map { actionFoundation(definition: $0, permissionMap: permissionMap) }
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
            providerName: app.name, providerFamily: "tumblr-bound-account-owned-blog-posts",
            connectionMode: "relay-owned-tumblr-oauth2-offline-refresh",
            credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
            supportedPolicyPresets: [.readOnly, .blocked],
            defaultPolicyPreset: permissionMap.policyPreset,
            defaultPermissionMapId: permissionMap.id,
            adapterBoundary: "brokered-native-tumblr-api-v2-transient-result-adapter",
            actionMapVersion: "tumblr-owned-blog-published-posts-no-store-v1",
            budgetPolicy: [
                "maxWrapperTools": .number(3), "maxResults": .number(10),
                "providerRequestsPerAction": .number(1), "readTimeoutSeconds": .number(20),
                "maxPostTextCharacters": .number(8000),
                "automaticPagination": .bool(false), "automaticRetry": .bool(false),
            ],
            privacyPolicy: [
                "boundAccountOnly": .bool(true), "selectedOwnedBlogOnly": .bool(true),
                "publishedPostsOnly": .bool(true), "npfPreferred": .bool(true),
                "providerDataPersisted": .bool(false),
                "writesEngagementScheduling": .string("blocked"),
                "dashboardPrivateUnpublished": .string("blocked"),
                "mediaTransferBulkExport": .string("blocked"),
                "rawCredentials": .string("two-keychain-references"),
            ], actions: actions, credentials: Self.tumblrCredentialRequirements,
            agentFacingWrapperToolNames: actions.compactMap(\.wrapperToolName).sorted(),
            blockedActionKeys: [], rawProviderToolExposure: false,
            suppressedRawProviderToolCount: definitions.count,
            generatedAt: timestamp, redactionStatus: "provider-content-not-stored")
    }

    public func registerExaSearchFoundation(
        context: ServiceRequestContext,
        now: Date = Date()
    ) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
            throw denied
        }
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
        let catalog = try applications.catalogSnapshot(
            context: context,
            selectedAppId: "exa-search",
            now: now
        )
        let app = try requireExaSearchApp(catalog: catalog, context: context)
        let permissionMap = try policies.compilePolicyMap(
            context: context,
            appIdOrSlug: app.id,
            preset: .approvalRequired,
            now: now
        )
        let definitions = try data.listMarketplaceProviderActionDefinitions(
            workspaceId: context.workspaceId,
            appId: app.id,
            limit: 500
        ).sorted { $0.actionKey < $1.actionKey }
        let actions = definitions.map { definition in
            actionFoundation(definition: definition, permissionMap: permissionMap)
        }
        let wrapperToolNames = actions.compactMap(\.wrapperToolName).sorted()
        let blockedActionKeys = actions
            .filter { $0.policyPermission == .blocked || $0.riskLevel == .destructive }
            .map(\.actionKey)
            .sorted()
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId,
            appId: app.id,
            appSlug: app.slug,
            providerName: app.name,
            providerFamily: "research",
            connectionMode: "user-owned-exa-api-key",
            credentialOwnership: .userOwned,
            userOwnedCredentialsRequired: true,
            supportedPolicyPresets: [.approvalRequired, .allowDirectWrites, .readOnly, .blocked],
            defaultPolicyPreset: permissionMap.policyPreset,
            defaultPermissionMapId: permissionMap.id,
            adapterBoundary: "brokered-native-exa-api-adapter",
            actionMapVersion: "exa-v1",
            budgetPolicy: [
                "standardSearch": .string("allowed"),
                "answerRead": .string("allowed"),
                "deepSearch": .string("approval_required"),
                "maxDefaultResults": .number(10),
                "redactionStatus": .string("private-state-excluded")
            ],
            privacyPolicy: [
                "resultExport": .string("blocked"),
                "sensitiveQueries": .string("approval_required"),
                "rawPageContent": .string("task_context_only"),
                "redactionStatus": .string("private-state-excluded")
            ],
            actions: actions,
            credentials: Self.exaSearchCredentialRequirements,
            agentFacingWrapperToolNames: wrapperToolNames,
            blockedActionKeys: blockedActionKeys,
            rawProviderToolExposure: false,
            suppressedRawProviderToolCount: definitions.count,
            generatedAt: timestamp,
            redactionStatus: "private-state-excluded"
        )
    }

    public func registerLinkedInFoundation(
        context: ServiceRequestContext,
        now: Date = Date()
    ) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
            throw denied
        }
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
        let catalog = try applications.catalogSnapshot(
            context: context,
            selectedAppId: "linkedin",
            now: now
        )
        let app = try requireLinkedInApp(catalog: catalog, context: context)
        let permissionMap = try policies.compilePolicyMap(
            context: context,
            appIdOrSlug: app.id,
            preset: .approvalRequired,
            now: now
        )
        let definitions = try data.listMarketplaceProviderActionDefinitions(
            workspaceId: context.workspaceId,
            appId: app.id,
            limit: 500
        ).sorted { $0.actionKey < $1.actionKey }
        let actions = definitions.map { definition in
            actionFoundation(definition: definition, permissionMap: permissionMap)
        }
        let wrapperToolNames = actions.compactMap(\.wrapperToolName).sorted()
        let blockedActionKeys = actions
            .filter { $0.policyPermission == .blocked || $0.riskLevel == .destructive }
            .map(\.actionKey)
            .sorted()
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId,
            appId: app.id,
            appSlug: app.slug,
            providerName: app.name,
            providerFamily: "connected-member-text-publishing",
            connectionMode: "relay-owned-linkedin-member-oauth",
            credentialOwnership: .relayOwned,
            userOwnedCredentialsRequired: false,
            supportedPolicyPresets: [.approvalRequired, .allowDirectWrites, .readOnly, .blocked],
            defaultPolicyPreset: permissionMap.policyPreset,
            defaultPermissionMapId: permissionMap.id,
            adapterBoundary: "brokered-native-linkedin-member-api-adapter",
            actionMapVersion: "linkedin-member-text-v2",
            budgetPolicy: ["maxWrapperTools": .number(3), "providerRequestsPerAction": .number(1), "maxPostCharacters": .number(3000), "automaticRetry": .bool(false), "automaticPagination": .bool(false)],
            privacyPolicy: [
                "memberPublishing": .string("approval_required_or_direct_write_by_policy"),
                "memberSocialReads": .string("blocked_closed_permission"),
                "emailAndPicture": .string("blocked"),
                "commentsLikesMediaOrganizations": .string("blocked"),
                "directMessages": .string("blocked"),
                "connectionRequests": .string("blocked"),
                "browserScraping": .string("blocked"),
                "accessToken": .string("keychain-reference-only"),
                "redactionStatus": .string("private-state-excluded")
            ],
            actions: actions,
            credentials: Self.linkedInCredentialRequirements,
            agentFacingWrapperToolNames: wrapperToolNames,
            blockedActionKeys: blockedActionKeys,
            rawProviderToolExposure: false,
            suppressedRawProviderToolCount: definitions.count,
            generatedAt: timestamp,
            redactionStatus: "private-state-excluded"
        )
    }

    public func registerGmailFoundation(
        context: ServiceRequestContext,
        now: Date = Date()
    ) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
            throw denied
        }
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
        let catalog = try applications.catalogSnapshot(
            context: context,
            selectedAppId: "gmail",
            now: now
        )
        let app = try requireGmailApp(catalog: catalog, context: context)
        let permissionMap = try policies.compilePolicyMap(
            context: context,
            appIdOrSlug: app.id,
            preset: .approvalRequired,
            now: now
        )
        let definitions = try data.listMarketplaceProviderActionDefinitions(
            workspaceId: context.workspaceId,
            appId: app.id,
            limit: 500
        ).sorted { $0.actionKey < $1.actionKey }
        let actions = definitions.map { definition in
            actionFoundation(definition: definition, permissionMap: permissionMap)
        }
        let wrapperToolNames = actions.compactMap(\.wrapperToolName).sorted()
        let blockedActionKeys = actions
            .filter { $0.policyPermission == .blocked || $0.riskLevel == .destructive }
            .map(\.actionKey)
            .sorted()
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId,
            appId: app.id,
            appSlug: app.slug,
            providerName: app.name,
            providerFamily: "email",
            connectionMode: "relay-owned-google-oauth-gmail-confidential-web-server",
            credentialOwnership: .relayOwned,
            userOwnedCredentialsRequired: false,
            supportedPolicyPresets: [.approvalRequired, .allowDirectWrites, .readOnly, .blocked],
            defaultPolicyPreset: permissionMap.policyPreset,
            defaultPermissionMapId: permissionMap.id,
            adapterBoundary: "brokered-native-gmail-api-adapter",
            actionMapVersion: "gmail-v1",
            privacyPolicy: [
                "messageBodies": .string("task_context_only"),
                "restrictedScopes": .string("gmail_readonly_and_compose"),
                "sending": .string("approval_required_or_direct_write_by_policy"),
                "deleteModifySettings": .string("blocked"),
                "rawCredentials": .string("secret-reference-only"),
                "redactionStatus": .string("private-state-excluded")
            ],
            actions: actions,
            credentials: Self.gmailCredentialRequirements,
            agentFacingWrapperToolNames: wrapperToolNames,
            blockedActionKeys: blockedActionKeys,
            rawProviderToolExposure: false,
            suppressedRawProviderToolCount: definitions.count,
            generatedAt: timestamp,
            redactionStatus: "private-state-excluded"
        )
    }

    public func registerGoogleCalendarFoundation(context: ServiceRequestContext, now: Date = Date()) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) { throw denied }; let timestamp = ISO8601DateFormatter.relayConsole.string(from: now), catalog = try applications.catalogSnapshot(context: context, selectedAppId: "google-calendar", now: now);
        guard let app = catalog.apps.first(where: { $0.slug == "google-calendar" }), app.availability == .available else { throw ServiceGuard.invalidInput(context: context, message: "Google Calendar Marketplace app is unavailable.") };
        let map = try policies.compilePolicyMap(context: context, appIdOrSlug: app.id, preset: .approvalRequired, now: now), definitions = try data.listMarketplaceProviderActionDefinitions(workspaceId: context.workspaceId, appId: app.id, limit: 500).sorted { $0.actionKey < $1.actionKey },
            actions = definitions.map { actionFoundation(definition: $0, permissionMap: map) }, wrappers = actions.compactMap(\.wrapperToolName).sorted(),
            credentials = [
                MarketplaceProviderCredentialFoundation(fieldKey: "google_calendar_oauth_access_token", label: "Google Calendar OAuth access token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
                MarketplaceProviderCredentialFoundation(fieldKey: "google_calendar_oauth_refresh_token", label: "Google Calendar OAuth refresh token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
                MarketplaceProviderCredentialFoundation(fieldKey: "google_calendar_account", label: "Authorized Google Calendar account and default Calendar", required: true, userOwnedRequired: false, secretStorage: "metadata-only", redactionStatus: "private-state-excluded"),
            ]
        ;
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug, providerName: app.name, providerFamily: "calendar-and-scheduling", connectionMode: "relay-owned-google-calendar-confidential-web-server-oauth", credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
            supportedPolicyPresets: [.approvalRequired, .allowDirectWrites, .readOnly, .blocked], defaultPolicyPreset: map.policyPreset, defaultPermissionMapId: map.id, adapterBoundary: "brokered-native-google-calendar-api-v3-adapter", actionMapVersion: "google-calendar-v1",
            budgetPolicy: ["maxWrapperTools": .number(5), "maxListResults": .number(25), "maxFreeBusyCalendars": .number(10), "readTimeoutSeconds": .number(20), "automaticPagination": .bool(false)],
            privacyPolicy: [
                "semanticReads": .string("calendar_event_freebusy"), "eventWrites": .string("approval_required_or_direct_write"), "guestNotifications": .string("disabled"), "deleteAclCalendarSettingsAttachmentsPrivateProperties": .string("blocked"),
                "rawCredentials": .string("secret-reference-only"),
            ], actions: actions, credentials: credentials, agentFacingWrapperToolNames: wrappers, blockedActionKeys: [], rawProviderToolExposure: false, suppressedRawProviderToolCount: definitions.count, generatedAt: timestamp, redactionStatus: "private-state-excluded")
    }

    public func registerGoogleDocsFoundation(
        context: ServiceRequestContext,
        now: Date = Date()
    ) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
            throw denied
        }
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
        let catalog = try applications.catalogSnapshot(
            context: context,
            selectedAppId: "google-docs",
            now: now
        )
        let app = try requireGoogleDocsApp(catalog: catalog, context: context)
        let permissionMap = try policies.compilePolicyMap(
            context: context,
            appIdOrSlug: app.id,
            preset: .approvalRequired,
            now: now
        )
        let definitions = try data.listMarketplaceProviderActionDefinitions(
            workspaceId: context.workspaceId,
            appId: app.id,
            limit: 500
        ).sorted { $0.actionKey < $1.actionKey }
        let actions = definitions.map { definition in
            actionFoundation(definition: definition, permissionMap: permissionMap)
        }
        let wrapperToolNames = actions.compactMap(\.wrapperToolName).sorted()
        let blockedActionKeys = actions
            .filter { $0.policyPermission == .blocked || $0.riskLevel == .destructive }
            .map(\.actionKey)
            .sorted()
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId,
            appId: app.id,
            appSlug: app.slug,
            providerName: app.name,
            providerFamily: "documents",
            connectionMode: "relay-owned-google-oauth-docs",
            credentialOwnership: .relayOwned,
            userOwnedCredentialsRequired: false,
            supportedPolicyPresets: [.approvalRequired, .allowDirectWrites, .readOnly, .blocked],
            defaultPolicyPreset: permissionMap.policyPreset,
            defaultPermissionMapId: permissionMap.id,
            adapterBoundary: "brokered-native-google-docs-api-adapter",
            actionMapVersion: "google-docs-v1",
            budgetPolicy: [
                "maxWrapperTools": .number(4),
                "promptSummaryMaxCharacters": .number(1200),
                "maxBodyChars": .number(8000),
                "readTimeoutSeconds": .number(20),
                "writeTimeoutSeconds": .number(30),
                "redactionStatus": .string("private-state-excluded")
            ],
            privacyPolicy: [
                "documentContent": .string("task_context_only"),
                "semanticReads": .string("document_id_or_url_bounded_text"),
                "writes": .string("approval_required_or_direct_write_by_policy"),
                "driveSearch": .string("blocked"),
                "exportsDownloads": .string("blocked"),
                "commentsSuggestions": .string("blocked"),
                "sharingPermissions": .string("blocked"),
                "destructiveContent": .string("blocked"),
                "rawMCPExposure": .string("blocked"),
                "relayOwnedGoogleApp": .string("supported"),
                "rawCredentials": .string("secret-reference-only"),
                "redactionStatus": .string("private-state-excluded")
            ],
            actions: actions,
            credentials: Self.googleDocsCredentialRequirements,
            agentFacingWrapperToolNames: wrapperToolNames,
            blockedActionKeys: blockedActionKeys,
            rawProviderToolExposure: false,
            suppressedRawProviderToolCount: definitions.count,
            generatedAt: timestamp,
            redactionStatus: "private-state-excluded"
        )
    }

    public func registerGoogleTasksFoundation(context: ServiceRequestContext, now: Date = Date()) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) { throw denied }
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now), catalog = try applications.catalogSnapshot(context: context, selectedAppId: "google-tasks", now: now)
        let app = try requireGoogleTasksApp(catalog: catalog, context: context), map = try policies.compilePolicyMap(context: context, appIdOrSlug: app.id, preset: .approvalRequired, now: now),
            definitions = try data.listMarketplaceProviderActionDefinitions(workspaceId: context.workspaceId, appId: app.id, limit: 500).sorted { $0.actionKey < $1.actionKey }
        let actions = definitions.map { actionFoundation(definition: $0, permissionMap: map) }, wrappers = actions.compactMap(\.wrapperToolName).sorted(), blocked = actions.filter { $0.policyPermission == .blocked || $0.riskLevel == .destructive }.map(\.actionKey).sorted()
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug, providerName: app.name, providerFamily: "task-management", connectionMode: "relay-owned-google-tasks-oauth", credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
            supportedPolicyPresets: [.approvalRequired, .allowDirectWrites, .readOnly, .blocked], defaultPolicyPreset: map.policyPreset, defaultPermissionMapId: map.id, adapterBoundary: "brokered-native-google-tasks-api-v1-adapter", actionMapVersion: "google-tasks-v1",
            budgetPolicy: ["maxWrapperTools": .number(5), "maxTaskLists": .number(20), "maxTasks": .number(100), "maxTitleCharacters": .number(1024), "maxNotesCharacters": .number(8192), "patchProviderRequests": .number(2), "automaticPagination": .bool(false)],
            privacyPolicy: [
                "assignedTaskMutation": .string("blocked_with_provider_preflight"), "assignmentLinksDriveKeysChatSpaces": .string("excluded"), "destructiveActions": .string("blocked"), "writes": .string("approval_required_or_direct_write_by_policy"), "dueSemantics": .string("date_only"),
                "rawCredentials": .string("secret-reference-only"),
            ], actions: actions, credentials: Self.googleTasksCredentialRequirements, agentFacingWrapperToolNames: wrappers, blockedActionKeys: blocked, rawProviderToolExposure: false, suppressedRawProviderToolCount: definitions.count, generatedAt: timestamp,
            redactionStatus: "private-state-excluded")
    }

    public func registerGoogleContactsFoundation(context: ServiceRequestContext, now: Date = Date()) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) { throw denied }
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now), catalog = try applications.catalogSnapshot(context: context, selectedAppId: "google-contacts", now: now)
        let app = try requireGoogleContactsApp(catalog: catalog, context: context), map = try policies.compilePolicyMap(context: context, appIdOrSlug: app.id, preset: .approvalRequired, now: now),
            definitions = try data.listMarketplaceProviderActionDefinitions(workspaceId: context.workspaceId, appId: app.id, limit: 500).sorted { $0.actionKey < $1.actionKey }
        let actions = definitions.map { actionFoundation(definition: $0, permissionMap: map) }, wrappers = actions.compactMap(\.wrapperToolName).sorted(), blocked = actions.filter { $0.policyPermission == .blocked || $0.riskLevel == .destructive }.map(\.actionKey).sorted()
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug, providerName: app.name, providerFamily: "contact-management", connectionMode: "relay-owned-google-contacts-oauth", credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
            supportedPolicyPresets: [.approvalRequired, .allowDirectWrites, .readOnly, .blocked], defaultPolicyPreset: map.policyPreset, defaultPermissionMapId: map.id, adapterBoundary: "brokered-native-google-people-api-v1-adapter", actionMapVersion: "google-contacts-v1",
            budgetPolicy: ["maxWrapperTools": .number(5), "maxConnections": .number(50), "maxEmailAddresses": .number(5), "maxPhoneNumbers": .number(5), "maxOrganizations": .number(3), "maxResponseBytes": .number(2000000), "patchProviderRequests": .number(2), "automaticPagination": .bool(false)],
            privacyPolicy: [
                "contactSourceOnly": .bool(true), "returnedFields": .string("resourceName_etag_names_emailAddresses_phoneNumbers_organizations"), "directoryOtherContactsGroupsPhotosBroadPersonalFields": .string("blocked"), "destructiveBatchRawSyncDelegation": .string("blocked"),
                "writes": .string("approval_required_or_direct_write_by_policy"), "rawCredentials": .string("secret-reference-only"),
            ], actions: actions, credentials: Self.googleContactsCredentialRequirements, agentFacingWrapperToolNames: wrappers, blockedActionKeys: blocked, rawProviderToolExposure: false, suppressedRawProviderToolCount: definitions.count, generatedAt: timestamp,
            redactionStatus: "private-state-excluded")
    }

    public func registerGooglePhotosFoundation(context: ServiceRequestContext, now: Date = Date()) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) { throw denied }
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now), catalog = try applications.catalogSnapshot(context: context, selectedAppId: "google-photos", now: now)
        let app = try requireGooglePhotosApp(catalog: catalog, context: context), map = try policies.compilePolicyMap(context: context, appIdOrSlug: app.id, preset: .approvalRequired, now: now),
            definitions = try data.listMarketplaceProviderActionDefinitions(workspaceId: context.workspaceId, appId: app.id, limit: 500).sorted { $0.actionKey < $1.actionKey }
        let actions = definitions.map { actionFoundation(definition: $0, permissionMap: map) }, wrappers = actions.compactMap(\.wrapperToolName).sorted(), blocked = actions.filter { $0.policyPermission == .blocked || $0.riskLevel == .destructive }.map(\.actionKey).sorted()
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug, providerName: app.name, providerFamily: "user-selected-media", connectionMode: "relay-owned-google-photos-picker-oauth", credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
            supportedPolicyPresets: [.approvalRequired, .allowDirectWrites, .readOnly, .blocked], defaultPolicyPreset: map.policyPreset, defaultPermissionMapId: map.id, adapterBoundary: "brokered-native-google-photos-picker-api-v1-adapter", actionMapVersion: "google-photos-picker-v1",
            budgetPolicy: ["maxWrapperTools": .number(4), "maxSelectedItems": .number(25), "maxResponseBytes": .number(1000000), "automaticPolling": .bool(false), "automaticPagination": .bool(false)],
            privacyPolicy: [
                "userSelectionRequired": .bool(true), "pickerOnly": .bool(true), "rawMediaBytesAndBaseURLs": .string("blocked"), "cameraExifAndLibraryData": .string("excluded"), "removedLibraryScopes": .string("forbidden"), "writes": .string("session_create_cleanup_approval_or_direct_only"),
                "rawCredentials": .string("secret-reference-only"),
            ], actions: actions, credentials: Self.googlePhotosCredentialRequirements, agentFacingWrapperToolNames: wrappers, blockedActionKeys: blocked, rawProviderToolExposure: false, suppressedRawProviderToolCount: definitions.count, generatedAt: timestamp,
            redactionStatus: "private-state-excluded")
    }

    public func registerGoogleMeetFoundation(context: ServiceRequestContext, now: Date = Date()) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) { throw denied }
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now), catalog = try applications.catalogSnapshot(context: context, selectedAppId: "google-meet", now: now)
        let app = try requireGoogleMeetApp(catalog: catalog, context: context), map = try policies.compilePolicyMap(context: context, appIdOrSlug: app.id, preset: .approvalRequired, now: now),
            definitions = try data.listMarketplaceProviderActionDefinitions(workspaceId: context.workspaceId, appId: app.id, limit: 500).sorted { $0.actionKey < $1.actionKey }
        let actions = definitions.map { actionFoundation(definition: $0, permissionMap: map) }, wrappers = actions.compactMap(\.wrapperToolName).sorted(), blocked = actions.filter { $0.policyPermission == .blocked || $0.riskLevel == .destructive }.map(\.actionKey).sorted()
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug, providerName: app.name, providerFamily: "video-meeting-spaces", connectionMode: "relay-owned-google-meet-app-created-spaces-oauth", credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
            supportedPolicyPresets: [.approvalRequired, .allowDirectWrites, .readOnly, .blocked], defaultPolicyPreset: map.policyPreset, defaultPermissionMapId: map.id, adapterBoundary: "brokered-native-google-meet-api-v2-adapter", actionMapVersion: "google-meet-spaces-v1",
            budgetPolicy: ["maxWrapperTools": .number(4), "providerRequestsPerAction": .number(1), "maxResponseBytes": .number(1000000), "automaticPagination": .bool(false)],
            privacyPolicy: [
                "appCreatedSpacesOnly": .bool(true), "forcedSafetyConfig": .string("restricted_or_trusted_moderated_host_only_viewer_default_no_attendance_or_artifacts"), "participantsConferenceRecordsArtifactsDialInSip": .string("excluded"),
                "endConferenceBroadScopesEventsMediaDelegation": .string("blocked"), "writes": .string("approval_required_or_direct_write_by_policy"), "rawCredentials": .string("secret-reference-only"),
            ], actions: actions, credentials: Self.googleMeetCredentialRequirements, agentFacingWrapperToolNames: wrappers, blockedActionKeys: blocked, rawProviderToolExposure: false, suppressedRawProviderToolCount: definitions.count, generatedAt: timestamp, redactionStatus: "private-state-excluded"
        )
    }

    public func registerGoogleChatFoundation(context: ServiceRequestContext, now: Date = Date()) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) { throw denied }
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now), catalog = try applications.catalogSnapshot(context: context, selectedAppId: "google-chat", now: now)
        let app = try requireGoogleChatApp(catalog: catalog, context: context), map = try policies.compilePolicyMap(context: context, appIdOrSlug: app.id, preset: .approvalRequired, now: now),
            definitions = try data.listMarketplaceProviderActionDefinitions(workspaceId: context.workspaceId, appId: app.id, limit: 500).sorted { $0.actionKey < $1.actionKey }
        let actions = definitions.map { actionFoundation(definition: $0, permissionMap: map) }, wrappers = actions.compactMap(\.wrapperToolName).sorted(), blocked = actions.filter { $0.policyPermission == .blocked || $0.riskLevel == .destructive }.map(\.actionKey).sorted()
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug, providerName: app.name, providerFamily: "workspace-messaging", connectionMode: "relay-owned-google-chat-user-oauth", credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
            supportedPolicyPresets: [.approvalRequired, .allowDirectWrites, .readOnly, .blocked], defaultPolicyPreset: map.policyPreset, defaultPermissionMapId: map.id, adapterBoundary: "brokered-native-google-chat-api-v1-adapter", actionMapVersion: "google-chat-explicit-space-messages-v1",
            budgetPolicy: ["maxWrapperTools": .number(4), "maxMessages": .number(25), "maxTextCharacters": .number(4000), "providerRequestsPerAction": .number(1), "maxResponseBytes": .number(1000000), "automaticPagination": .bool(false)],
            privacyPolicy: [
                "userAuthOnly": .bool(true), "explicitSpacesOnly": .bool(true), "senderIdentityMembershipsRichPrivateMediaReactions": .string("excluded"), "spaceAdminMessageMutationAppBotAdminImportDelegation": .string("blocked"), "writes": .string("approval_required_or_direct_write_by_policy"),
                "rawCredentials": .string("secret-reference-only"),
            ], actions: actions, credentials: Self.googleChatCredentialRequirements, agentFacingWrapperToolNames: wrappers, blockedActionKeys: blocked, rawProviderToolExposure: false, suppressedRawProviderToolCount: definitions.count, generatedAt: timestamp, redactionStatus: "private-state-excluded"
        )
    }

    public func registerGoogleAdsFoundation(context: ServiceRequestContext, now: Date = Date()) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) { throw denied }
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now), catalog = try applications.catalogSnapshot(context: context, selectedAppId: "google-ads", now: now)
        let app = try requireGoogleAdsApp(catalog: catalog, context: context), map = try policies.compilePolicyMap(context: context, appIdOrSlug: app.id, preset: .readOnly, now: now),
            definitions = try data.listMarketplaceProviderActionDefinitions(workspaceId: context.workspaceId, appId: app.id, limit: 500).sorted { $0.actionKey < $1.actionKey }
        let actions = definitions.map { actionFoundation(definition: $0, permissionMap: map) }, wrappers = actions.compactMap(\.wrapperToolName).sorted(), blocked = actions.filter { $0.policyPermission == .blocked || $0.riskLevel == .destructive }.map(\.actionKey).sorted()
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug, providerName: app.name, providerFamily: "advertising-reporting", connectionMode: "relay-owned-google-ads-user-oauth-and-developer-token", credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
            supportedPolicyPresets: [.readOnly, .blocked], defaultPolicyPreset: map.policyPreset, defaultPermissionMapId: map.id, adapterBoundary: "brokered-native-google-ads-api-v24-fixed-query-adapter", actionMapVersion: "google-ads-reporting-v1",
            budgetPolicy: ["maxWrapperTools": .number(2), "maxCampaignRows": .number(50), "dateRange": .string("LAST_30_DAYS"), "providerRequestsPerAction": .number(1), "maxResponseBytes": .number(1000000), "searchStream": .bool(false), "automaticPagination": .bool(false)],
            privacyPolicy: [
                "reportingPermissibleUseOnly": .bool(true), "explicitCustomerOnly": .bool(true), "arbitraryGAQLAccountDiscovery": .string("blocked"), "audiencesSearchTermsClickIdentifiersOfflineConversionsBilling": .string("excluded"),
                "mutationsPlanningRecommendationsRawDelegation": .string("blocked"), "rawCredentials": .string("secret-reference-only"),
            ], actions: actions, credentials: Self.googleAdsCredentialRequirements, agentFacingWrapperToolNames: wrappers, blockedActionKeys: blocked, rawProviderToolExposure: false, suppressedRawProviderToolCount: definitions.count, generatedAt: timestamp, redactionStatus: "private-state-excluded")
    }

    public func registerGoogleAnalyticsFoundation(context: ServiceRequestContext, now: Date = Date()) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) { throw denied }
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now), catalog = try applications.catalogSnapshot(context: context, selectedAppId: "google-analytics", now: now)
        let app = try requireGoogleAnalyticsApp(catalog: catalog, context: context), map = try policies.compilePolicyMap(context: context, appIdOrSlug: app.id, preset: .readOnly, now: now),
            definitions = try data.listMarketplaceProviderActionDefinitions(workspaceId: context.workspaceId, appId: app.id, limit: 500).sorted { $0.actionKey < $1.actionKey }
        let actions = definitions.map { actionFoundation(definition: $0, permissionMap: map) }, wrappers = actions.compactMap(\.wrapperToolName).sorted(), blocked = actions.filter { $0.policyPermission == .blocked || $0.riskLevel == .destructive }.map(\.actionKey).sorted()
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug, providerName: app.name, providerFamily: "web-and-app-analytics", connectionMode: "relay-owned-google-analytics-explicit-property-oauth", credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
            supportedPolicyPresets: [.readOnly, .blocked], defaultPolicyPreset: map.policyPreset, defaultPermissionMapId: map.id, adapterBoundary: "brokered-native-google-analytics-admin-data-api-fixed-report-adapter", actionMapVersion: "google-analytics-explicit-property-v1",
            budgetPolicy: ["maxWrapperTools": .number(2), "maxReportRows": .number(25), "dateRange": .string("30daysAgo_to_yesterday"), "providerRequestsPerAction": .number(1), "maxResponseBytes": .number(1000000), "automaticPagination": .bool(false)],
            privacyPolicy: [
                "exactScope": .string("analytics.readonly"), "explicitPropertyOnly": .bool(true), "propertyDiscoveryArbitraryRealtimeAdvancedReports": .string("blocked"), "audienceUserDemographicPageSearchGeoCustomDetail": .string("excluded"),
                "mutationsMeasurementExportsRawDelegation": .string("blocked"), "rawCredentials": .string("secret-reference-only"),
            ], actions: actions, credentials: Self.googleAnalyticsCredentialRequirements, agentFacingWrapperToolNames: wrappers, blockedActionKeys: blocked, rawProviderToolExposure: false, suppressedRawProviderToolCount: definitions.count, generatedAt: timestamp,
            redactionStatus: "private-state-excluded")
    }

    public func registerGoogleMerchantCenterFoundation(context: ServiceRequestContext, now: Date = Date()) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) { throw denied }
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now), catalog = try applications.catalogSnapshot(context: context, selectedAppId: "google-merchant-center", now: now)
        let app = try requireGoogleMerchantCenterApp(catalog: catalog, context: context), map = try policies.compilePolicyMap(context: context, appIdOrSlug: app.id, preset: .readOnly, now: now),
            definitions = try data.listMarketplaceProviderActionDefinitions(workspaceId: context.workspaceId, appId: app.id, limit: 500).sorted { $0.actionKey < $1.actionKey }
        let actions = definitions.map { actionFoundation(definition: $0, permissionMap: map) }, wrappers = actions.compactMap(\.wrapperToolName).sorted(), blocked = actions.filter { $0.policyPermission == .blocked || $0.riskLevel == .destructive }.map(\.actionKey).sorted()
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug, providerName: app.name, providerFamily: "commerce-catalog-health", connectionMode: "relay-owned-google-merchant-center-explicit-account-oauth", credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
            supportedPolicyPresets: [.readOnly, .blocked], defaultPolicyPreset: map.policyPreset, defaultPermissionMapId: map.id, adapterBoundary: "brokered-native-google-merchant-api-v1-fixed-read-adapter", actionMapVersion: "google-merchant-center-stable-v1",
            budgetPolicy: ["maxWrapperTools": .number(4), "maxAccounts": .number(50), "maxProducts": .number(50), "maxReportRows": .number(50), "providerRequestsPerAction": .number(1), "maxResponseBytes": .number(1000000), "automaticPagination": .bool(false)],
            privacyPolicy: [
                "exactScope": .string("content"), "explicitAccountOnly": .bool(true), "providerScopeCanWrite": .bool(true), "relayWrites": .string("blocked"), "fixedReportsOnly": .bool(true), "arbitraryQueryPaginationExports": .string("blocked"),
                "mutationsAdminReviewsConversionsRawServiceAccount": .string("blocked"), "stableV1Only": .bool(true), "rawCredentials": .string("secret-reference-only"),
            ], actions: actions, credentials: Self.googleMerchantCenterCredentialRequirements, agentFacingWrapperToolNames: wrappers, blockedActionKeys: blocked, rawProviderToolExposure: false, suppressedRawProviderToolCount: definitions.count, generatedAt: timestamp,
            redactionStatus: "private-state-excluded")
    }

    public func registerYouTubeFoundation(context: ServiceRequestContext, now: Date = Date()) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) { throw denied }
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now), catalog = try applications.catalogSnapshot(context: context, selectedAppId: "youtube", now: now)
        let app = try requireYouTubeApp(catalog: catalog, context: context), map = try policies.compilePolicyMap(context: context, appIdOrSlug: app.id, preset: .readOnly, now: now),
            definitions = try data.listMarketplaceProviderActionDefinitions(workspaceId: context.workspaceId, appId: app.id, limit: 500).sorted { $0.actionKey < $1.actionKey }
        let actions = definitions.map { actionFoundation(definition: $0, permissionMap: map) }, wrappers = actions.compactMap(\.wrapperToolName).sorted(), blocked = actions.filter { $0.policyPermission == .blocked || $0.riskLevel == .destructive }.map(\.actionKey).sorted()
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug, providerName: app.name, providerFamily: "creator-video", connectionMode: "relay-owned-google-youtube-connected-channel-oauth", credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
            supportedPolicyPresets: [.readOnly, .blocked], defaultPolicyPreset: map.policyPreset, defaultPermissionMapId: map.id, adapterBoundary: "brokered-native-youtube-data-api-v3-bounded-read-adapter", actionMapVersion: "youtube-connected-channel-v1",
            budgetPolicy: ["maxWrapperTools": .number(4), "maxResults": .number(25), "providerRequestsPerAction": .number(1), "maxResponseBytes": .number(1000000), "automaticPagination": .bool(false)],
            privacyPolicy: [
                "exactScope": .string("youtube.readonly"), "connectedChannelOnly": .bool(true), "searchHistoryWatchLaterExports": .string("blocked"), "mutationsAnalyticsPartnerRaw": .string("blocked"), "youtubeAttributionRequired": .bool(true), "apiDataRefreshOrDeleteDays": .number(30),
                "rawCredentials": .string("secret-reference-only"),
            ], actions: actions, credentials: Self.youTubeCredentialRequirements, agentFacingWrapperToolNames: wrappers, blockedActionKeys: blocked, rawProviderToolExposure: false, suppressedRawProviderToolCount: definitions.count, generatedAt: timestamp, redactionStatus: "private-state-excluded")
    }

    public func registerGoogleClassroomFoundation(context: ServiceRequestContext, now: Date = Date()) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) { throw denied }
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now), catalog = try applications.catalogSnapshot(context: context, selectedAppId: "google-classroom", now: now)
        let app = try requireGoogleClassroomApp(catalog: catalog, context: context), map = try policies.compilePolicyMap(context: context, appIdOrSlug: app.id, preset: .readOnly, now: now),
            definitions = try data.listMarketplaceProviderActionDefinitions(workspaceId: context.workspaceId, appId: app.id, limit: 500).sorted { $0.actionKey < $1.actionKey }
        let actions = definitions.map { actionFoundation(definition: $0, permissionMap: map) }, wrappers = actions.compactMap(\.wrapperToolName).sorted(), blocked = actions.filter { $0.policyPermission == .blocked || $0.riskLevel == .destructive }.map(\.actionKey).sorted()
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug, providerName: app.name, providerFamily: "education-coursework", connectionMode: "relay-owned-google-classroom-requesting-user-oauth", credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
            supportedPolicyPresets: [.readOnly, .blocked], defaultPolicyPreset: map.policyPreset, defaultPermissionMapId: map.id, adapterBoundary: "brokered-native-google-classroom-api-v1-bounded-read-adapter", actionMapVersion: "google-classroom-requesting-user-v1",
            budgetPolicy: ["maxWrapperTools": .number(4), "maxResults": .number(25), "providerRequestsPerAction": .number(1), "maxResponseBytes": .number(1000000), "automaticPagination": .bool(false)],
            privacyPolicy: [
                "requestingUserOnly": .bool(true), "rostersProfilesGuardians": .string("excluded"), "studentSubmissionsGrades": .string("excluded"), "writesDelegationAdminPreviewRaw": .string("blocked"), "under18AdminApprovalRequired": .bool(true), "rawCredentials": .string("secret-reference-only"),
            ], actions: actions, credentials: Self.googleClassroomCredentialRequirements, agentFacingWrapperToolNames: wrappers, blockedActionKeys: blocked, rawProviderToolExposure: false, suppressedRawProviderToolCount: definitions.count, generatedAt: timestamp,
            redactionStatus: "private-state-excluded")
    }

    public func registerOutlookFoundation(context: ServiceRequestContext, now: Date = Date()) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) { throw denied }
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now), catalog = try applications.catalogSnapshot(context: context, selectedAppId: "outlook", now: now), app = try requireOutlookApp(catalog: catalog, context: context),
            map = try policies.compilePolicyMap(context: context, appIdOrSlug: app.id, preset: .readOnly, now: now), definitions = try data.listMarketplaceProviderActionDefinitions(workspaceId: context.workspaceId, appId: app.id, limit: 500).sorted { $0.actionKey < $1.actionKey },
            actions = definitions.map { actionFoundation(definition: $0, permissionMap: map) }, wrappers = actions.compactMap(\.wrapperToolName).sorted(), blocked = actions.filter { $0.policyPermission == .blocked || $0.riskLevel == .destructive }.map(\.actionKey).sorted()
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug, providerName: app.name, providerFamily: "email", connectionMode: "relay-owned-microsoft-delegated-self-mailbox-oauth", credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
            supportedPolicyPresets: [.readOnly, .blocked], defaultPolicyPreset: map.policyPreset, defaultPermissionMapId: map.id, adapterBoundary: "brokered-native-microsoft-graph-v1-bounded-mail-adapter", actionMapVersion: "outlook-self-mailbox-v1",
            budgetPolicy: ["maxWrapperTools": .number(4), "maxResults": .number(25), "maxBodyCharacters": .number(8000), "providerRequestsPerAction": .number(1), "maxResponseBytes": .number(1000000), "automaticPagination": .bool(false)],
            privacyPolicy: [
                "delegatedSelfMailboxOnly": .bool(true), "sharedApplicationMail": .string("blocked"), "attachmentsMimeHeadersSearchExport": .string("blocked"), "writesOtherGraphRaw": .string("blocked"), "plainTextBodiesOnly": .bool(true), "rawCredentials": .string("secret-reference-only"),
            ], actions: actions, credentials: Self.outlookCredentialRequirements, agentFacingWrapperToolNames: wrappers, blockedActionKeys: blocked, rawProviderToolExposure: false, suppressedRawProviderToolCount: definitions.count, generatedAt: timestamp, redactionStatus: "private-state-excluded")
    }

    public func registerMicrosoftTeamsFoundation(context: ServiceRequestContext, now: Date = Date()) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) { throw denied }
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now), catalog = try applications.catalogSnapshot(context: context, selectedAppId: "microsoft-teams", now: now), app = try requireMicrosoftTeamsApp(catalog: catalog, context: context),
            map = try policies.compilePolicyMap(context: context, appIdOrSlug: app.id, preset: .readOnly, now: now), definitions = try data.listMarketplaceProviderActionDefinitions(workspaceId: context.workspaceId, appId: app.id, limit: 500).sorted { $0.actionKey < $1.actionKey },
            actions = definitions.map { actionFoundation(definition: $0, permissionMap: map) }, wrappers = actions.compactMap(\.wrapperToolName).sorted(), blocked = actions.filter { $0.policyPermission == .blocked || $0.riskLevel == .destructive }.map(\.actionKey).sorted()
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug, providerName: app.name, providerFamily: "team-collaboration-metadata", connectionMode: "relay-owned-microsoft-delegated-work-account-oauth", credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
            supportedPolicyPresets: [.readOnly, .blocked], defaultPolicyPreset: map.policyPreset, defaultPermissionMapId: map.id, adapterBoundary: "brokered-native-microsoft-graph-v1-bounded-team-channel-adapter", actionMapVersion: "microsoft-teams-metadata-v1",
            budgetPolicy: ["maxWrapperTools": .number(4), "maxResults": .number(25), "providerRequestsPerAction": .number(1), "maxResponseBytes": .number(1000000), "automaticPagination": .bool(false)],
            privacyPolicy: ["delegatedWorkAccountOnly": .bool(true), "directMembershipsOnly": .bool(true), "messagesChatsMembersDirectory": .string("blocked"), "filesMeetingsCallsWritesAdminMetered": .string("blocked"), "rawCredentials": .string("secret-reference-only")], actions: actions,
            credentials: Self.microsoftTeamsCredentialRequirements, agentFacingWrapperToolNames: wrappers, blockedActionKeys: blocked, rawProviderToolExposure: false, suppressedRawProviderToolCount: definitions.count, generatedAt: timestamp, redactionStatus: "private-state-excluded")
    }

    public func registerOneDriveFoundation(context: ServiceRequestContext, now: Date = Date()) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) { throw denied }
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now), catalog = try applications.catalogSnapshot(context: context, selectedAppId: "onedrive", now: now), app = try requireOneDriveApp(catalog: catalog, context: context),
            map = try policies.compilePolicyMap(context: context, appIdOrSlug: app.id, preset: .readOnly, now: now), definitions = try data.listMarketplaceProviderActionDefinitions(workspaceId: context.workspaceId, appId: app.id, limit: 500).sorted { $0.actionKey < $1.actionKey },
            actions = definitions.map { actionFoundation(definition: $0, permissionMap: map) }, wrappers = actions.compactMap(\.wrapperToolName).sorted(), blocked = actions.filter { $0.policyPermission == .blocked || $0.riskLevel == .destructive }.map(\.actionKey).sorted()
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug, providerName: app.name, providerFamily: "personal-cloud-file-metadata", connectionMode: "relay-owned-microsoft-delegated-self-drive-oauth", credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
            supportedPolicyPresets: [.readOnly, .blocked], defaultPolicyPreset: map.policyPreset, defaultPermissionMapId: map.id, adapterBoundary: "brokered-native-microsoft-graph-v1-bounded-onedrive-adapter", actionMapVersion: "onedrive-self-drive-metadata-v1",
            budgetPolicy: ["maxWrapperTools": .number(4), "maxResults": .number(25), "providerRequestsPerAction": .number(1), "maxResponseBytes": .number(1000000), "automaticPagination": .bool(false)],
            privacyPolicy: ["delegatedSelfDriveOnly": .bool(true), "metadataOnly": .bool(true), "contentDownloadSharedRemoteSearch": .string("blocked"), "permissionsVersionsWritesOtherDrivesRaw": .string("blocked"), "rawCredentials": .string("secret-reference-only")], actions: actions,
            credentials: Self.oneDriveCredentialRequirements, agentFacingWrapperToolNames: wrappers, blockedActionKeys: blocked, rawProviderToolExposure: false, suppressedRawProviderToolCount: definitions.count, generatedAt: timestamp, redactionStatus: "private-state-excluded")
    }

    public func registerSharePointFoundation(context: ServiceRequestContext, now: Date = Date()) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) { throw denied }
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now), catalog = try applications.catalogSnapshot(context: context, selectedAppId: "sharepoint", now: now), app = try requireSharePointApp(catalog: catalog, context: context),
            map = try policies.compilePolicyMap(context: context, appIdOrSlug: app.id, preset: .readOnly, now: now), definitions = try data.listMarketplaceProviderActionDefinitions(workspaceId: context.workspaceId, appId: app.id, limit: 500).sorted { $0.actionKey < $1.actionKey },
            actions = definitions.map { actionFoundation(definition: $0, permissionMap: map) }, wrappers = actions.compactMap(\.wrapperToolName).sorted(), blocked = actions.filter { $0.policyPermission == .blocked || $0.riskLevel == .destructive }.map(\.actionKey).sorted()
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug, providerName: app.name, providerFamily: "selected-site-knowledge-metadata", connectionMode: "relay-owned-microsoft-delegated-sites-selected-oauth", credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
            supportedPolicyPresets: [.readOnly, .blocked], defaultPolicyPreset: map.policyPreset, defaultPermissionMapId: map.id, adapterBoundary: "brokered-native-microsoft-graph-v1-selected-site-adapter", actionMapVersion: "sharepoint-selected-site-metadata-v1",
            budgetPolicy: ["maxWrapperTools": .number(4), "maxResults": .number(25), "providerRequestsPerAction": .number(1), "maxResponseBytes": .number(1000000), "automaticPagination": .bool(false)],
            privacyPolicy: ["selectedSiteOnly": .bool(true), "siteGrantRequired": .bool(true), "metadataOnly": .bool(true), "tenantSearchContentIdentitiesPermissions": .string("blocked"), "writesOtherSitesBroadScopesRaw": .string("blocked"), "rawCredentials": .string("secret-reference-only")],
            actions: actions, credentials: Self.sharePointCredentialRequirements, agentFacingWrapperToolNames: wrappers, blockedActionKeys: blocked, rawProviderToolExposure: false, suppressedRawProviderToolCount: definitions.count, generatedAt: timestamp, redactionStatus: "private-state-excluded")
    }

    public func registerMicrosoftPlannerFoundation(context: ServiceRequestContext, now: Date = Date()) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) { throw denied }
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now), catalog = try applications.catalogSnapshot(context: context, selectedAppId: "microsoft-planner", now: now), app = try requireMicrosoftPlannerApp(catalog: catalog, context: context),
            map = try policies.compilePolicyMap(context: context, appIdOrSlug: app.id, preset: .readOnly, now: now), definitions = try data.listMarketplaceProviderActionDefinitions(workspaceId: context.workspaceId, appId: app.id, limit: 500).sorted { $0.actionKey < $1.actionKey },
            actions = definitions.map { actionFoundation(definition: $0, permissionMap: map) }, wrappers = actions.compactMap(\.wrapperToolName).sorted(), blocked = actions.filter { $0.policyPermission == .blocked || $0.riskLevel == .destructive }.map(\.actionKey).sorted()
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug, providerName: app.name, providerFamily: "work-task-planning", connectionMode: "relay-owned-microsoft-delegated-planner-tasks-read-oauth", credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
            supportedPolicyPresets: [.readOnly, .blocked], defaultPolicyPreset: map.policyPreset, defaultPermissionMapId: map.id, adapterBoundary: "brokered-native-microsoft-graph-v1-bounded-planner-adapter", actionMapVersion: "microsoft-planner-task-plan-read-v1",
            budgetPolicy: ["maxWrapperTools": .number(4), "maxResults": .number(25), "providerRequestsPerAction": .number(1), "maxResponseBytes": .number(1000000), "automaticPagination": .bool(false)],
            privacyPolicy: ["delegatedWorkSchoolAccountOnly": .bool(true), "assignmentIdentities": .string("excluded"), "taskDetailsChecklistsReferences": .string("excluded"), "groupsDirectoryWritesApplicationRaw": .string("blocked"), "rawCredentials": .string("secret-reference-only")],
            actions: actions, credentials: Self.microsoftPlannerCredentialRequirements, agentFacingWrapperToolNames: wrappers, blockedActionKeys: blocked, rawProviderToolExposure: false, suppressedRawProviderToolCount: definitions.count, generatedAt: timestamp,
            redactionStatus: "private-state-excluded")
    }

    public func registerMicrosoftToDoFoundation(context: ServiceRequestContext, now: Date = Date()) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) { throw denied };
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now), catalog = try applications.catalogSnapshot(context: context, selectedAppId: "microsoft-to-do", now: now), app = try requireMicrosoftToDoApp(catalog: catalog, context: context),
            map = try policies.compilePolicyMap(context: context, appIdOrSlug: app.id, preset: .readOnly, now: now), definitions = try data.listMarketplaceProviderActionDefinitions(workspaceId: context.workspaceId, appId: app.id, limit: 500).sorted { $0.actionKey < $1.actionKey },
            actions = definitions.map { actionFoundation(definition: $0, permissionMap: map) }, wrappers = actions.compactMap(\.wrapperToolName).sorted(), blocked = actions.filter { $0.policyPermission == .blocked || $0.riskLevel == .destructive }.map(\.actionKey).sorted()
        ;
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug, providerName: app.name, providerFamily: "personal-task-management", connectionMode: "relay-owned-microsoft-delegated-self-todo-read-oauth", credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
            supportedPolicyPresets: [.readOnly, .blocked], defaultPolicyPreset: map.policyPreset, defaultPermissionMapId: map.id, adapterBoundary: "brokered-native-microsoft-graph-v1-bounded-todo-adapter", actionMapVersion: "microsoft-todo-metadata-v1",
            budgetPolicy: ["maxWrapperTools": .number(4), "maxResults": .number(25), "providerRequestsPerAction": .number(1), "maxResponseBytes": .number(1000000), "automaticPagination": .bool(false)],
            privacyPolicy: ["delegatedSelfOnly": .bool(true), "taskBodiesCategories": .string("excluded"), "checklistsLinksAttachmentsExtensionsShared": .string("blocked"), "writesDeltaApplicationOtherUsersRaw": .string("blocked"), "rawCredentials": .string("secret-reference-only")],
            actions: actions, credentials: Self.microsoftToDoCredentialRequirements, agentFacingWrapperToolNames: wrappers, blockedActionKeys: blocked, rawProviderToolExposure: false, suppressedRawProviderToolCount: definitions.count, generatedAt: timestamp, redactionStatus: "private-state-excluded"
        )
    }
    public func registerMicrosoftListsFoundation(context: ServiceRequestContext, now: Date = Date()) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) { throw denied };
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now), catalog = try applications.catalogSnapshot(context: context, selectedAppId: "microsoft-lists", now: now), app = try requireMicrosoftListsApp(catalog: catalog, context: context),
            map = try policies.compilePolicyMap(context: context, appIdOrSlug: app.id, preset: .readOnly, now: now), definitions = try data.listMarketplaceProviderActionDefinitions(workspaceId: context.workspaceId, appId: app.id, limit: 500).sorted { $0.actionKey < $1.actionKey },
            actions = definitions.map { actionFoundation(definition: $0, permissionMap: map) }, wrappers = actions.compactMap(\.wrapperToolName).sorted(), blocked = actions.filter { $0.policyPermission == .blocked || $0.riskLevel == .destructive }.map(\.actionKey).sorted()
        ;
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug, providerName: app.name, providerFamily: "selected-structured-list-data", connectionMode: "relay-owned-microsoft-delegated-selected-list-oauth", credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
            supportedPolicyPresets: [.readOnly, .blocked], defaultPolicyPreset: map.policyPreset, defaultPermissionMapId: map.id, adapterBoundary: "brokered-native-microsoft-graph-v1-selected-list-adapter", actionMapVersion: "microsoft-lists-selected-list-fields-v1",
            budgetPolicy: ["maxWrapperTools": .number(4), "maxResults": .number(25), "maxAllowedFields": .number(20), "providerRequestsPerAction": .number(1), "maxResponseBytes": .number(1000000), "automaticPagination": .bool(false)],
            privacyPolicy: ["selectedListOnly": .bool(true), "listGrantRequired": .bool(true), "allowedFieldsOnly": .bool(true), "attachmentsIdentitiesPermissions": .string("blocked"), "writesOtherListsBroadScopesRaw": .string("blocked"), "rawCredentials": .string("secret-reference-only")],
            actions: actions, credentials: Self.microsoftListsCredentialRequirements, agentFacingWrapperToolNames: wrappers, blockedActionKeys: blocked, rawProviderToolExposure: false, suppressedRawProviderToolCount: definitions.count, generatedAt: timestamp,
            redactionStatus: "private-state-excluded")
    }
    public func registerOneNoteFoundation(context: ServiceRequestContext, now: Date = Date()) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) { throw denied };
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now), catalog = try applications.catalogSnapshot(context: context, selectedAppId: "onenote", now: now), app = try requireOneNoteApp(catalog: catalog, context: context),
            map = try policies.compilePolicyMap(context: context, appIdOrSlug: app.id, preset: .readOnly, now: now), definitions = try data.listMarketplaceProviderActionDefinitions(workspaceId: context.workspaceId, appId: app.id, limit: 500).sorted { $0.actionKey < $1.actionKey },
            actions = definitions.map { actionFoundation(definition: $0, permissionMap: map) }, wrappers = actions.compactMap(\.wrapperToolName).sorted(), blocked = actions.filter { $0.policyPermission == .blocked || $0.riskLevel == .destructive }.map(\.actionKey).sorted()
        ;
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug, providerName: app.name, providerFamily: "digital-notebook-metadata", connectionMode: "relay-owned-microsoft-delegated-self-onenote-read-oauth", credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
            supportedPolicyPresets: [.readOnly, .blocked], defaultPolicyPreset: map.policyPreset, defaultPermissionMapId: map.id, adapterBoundary: "brokered-native-microsoft-graph-v1-bounded-onenote-metadata-adapter", actionMapVersion: "onenote-self-metadata-v1",
            budgetPolicy: ["maxWrapperTools": .number(4), "maxResults": .number(25), "providerRequestsPerAction": .number(1), "maxResponseBytes": .number(1000000), "automaticPagination": .bool(false)],
            privacyPolicy: ["delegatedSelfOnly": .bool(true), "metadataOnly": .bool(true), "pageContentResourcesOCR": .string("blocked"), "sharedGroupSiteSearchWritesPermissionsRaw": .string("blocked"), "rawCredentials": .string("secret-reference-only")], actions: actions,
            credentials: Self.oneNoteCredentialRequirements, agentFacingWrapperToolNames: wrappers, blockedActionKeys: blocked, rawProviderToolExposure: false, suppressedRawProviderToolCount: definitions.count, generatedAt: timestamp, redactionStatus: "private-state-excluded")
    }
    public func registerMicrosoftBookingsFoundation(context: ServiceRequestContext, now: Date = Date()) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) { throw denied };
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now), catalog = try applications.catalogSnapshot(context: context, selectedAppId: "microsoft-bookings", now: now), app = try requireMicrosoftBookingsApp(catalog: catalog, context: context),
            map = try policies.compilePolicyMap(context: context, appIdOrSlug: app.id, preset: .readOnly, now: now), definitions = try data.listMarketplaceProviderActionDefinitions(workspaceId: context.workspaceId, appId: app.id, limit: 500).sorted { $0.actionKey < $1.actionKey },
            actions = definitions.map { actionFoundation(definition: $0, permissionMap: map) }, wrappers = actions.compactMap(\.wrapperToolName).sorted(), blocked = actions.filter { $0.policyPermission == .blocked || $0.riskLevel == .destructive }.map(\.actionKey).sorted()
        ;
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug, providerName: app.name, providerFamily: "selected-business-scheduling-metadata", connectionMode: "relay-owned-microsoft-delegated-selected-bookings-business-oauth", credentialOwnership: .relayOwned,
            userOwnedCredentialsRequired: false, supportedPolicyPresets: [.readOnly, .blocked], defaultPolicyPreset: map.policyPreset, defaultPermissionMapId: map.id, adapterBoundary: "brokered-native-microsoft-graph-v1-selected-bookings-business-adapter",
            actionMapVersion: "microsoft-bookings-selected-business-privacy-v1",
            budgetPolicy: ["maxWrapperTools": .number(4), "maxResults": .number(25), "maxCalendarRangeDays": .number(7), "providerRequestsPerAction": .number(1), "maxResponseBytes": .number(1000000), "automaticPagination": .bool(false)],
            privacyPolicy: ["selectedBusinessOnly": .bool(true), "customerStaffContactNotesJoin": .string("blocked"), "writesApplicationRaw": .string("blocked"), "rawCredentials": .string("secret-reference-only")], actions: actions, credentials: Self.microsoftBookingsCredentialRequirements,
            agentFacingWrapperToolNames: wrappers, blockedActionKeys: blocked, rawProviderToolExposure: false, suppressedRawProviderToolCount: definitions.count, generatedAt: timestamp, redactionStatus: "private-state-excluded")
    }
    public func registerMicrosoftPowerBIFoundation(context: ServiceRequestContext, now: Date = Date()) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) { throw denied };
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now), catalog = try applications.catalogSnapshot(context: context, selectedAppId: "microsoft-power-bi", now: now), app = try requireMicrosoftPowerBIApp(catalog: catalog, context: context),
            map = try policies.compilePolicyMap(context: context, appIdOrSlug: app.id, preset: .readOnly, now: now), definitions = try data.listMarketplaceProviderActionDefinitions(workspaceId: context.workspaceId, appId: app.id, limit: 500).sorted { $0.actionKey < $1.actionKey },
            actions = definitions.map { actionFoundation(definition: $0, permissionMap: map) }, wrappers = actions.compactMap(\.wrapperToolName).sorted(), blocked = actions.filter { $0.policyPermission == .blocked || $0.riskLevel == .destructive }.map(\.actionKey).sorted()
        ;
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug, providerName: app.name, providerFamily: "selected-workspace-analytics-metadata", connectionMode: "relay-owned-microsoft-delegated-selected-power-bi-workspace-oauth", credentialOwnership: .relayOwned,
            userOwnedCredentialsRequired: false, supportedPolicyPresets: [.readOnly, .blocked], defaultPolicyPreset: map.policyPreset, defaultPermissionMapId: map.id, adapterBoundary: "brokered-native-power-bi-rest-v1-selected-workspace-adapter",
            actionMapVersion: "microsoft-power-bi-selected-workspace-metadata-v1", budgetPolicy: ["maxWrapperTools": .number(4), "maxResults": .number(25), "providerRequestsPerAction": .number(1), "maxResponseBytes": .number(1000000), "automaticPagination": .bool(false)],
            privacyPolicy: ["selectedWorkspaceOnly": .bool(true), "contentQueriesIdentitiesURLs": .string("blocked"), "refreshExportAdminWritesRaw": .string("blocked"), "rawCredentials": .string("secret-reference-only")], actions: actions, credentials: Self.microsoftPowerBICredentialRequirements,
            agentFacingWrapperToolNames: wrappers, blockedActionKeys: blocked, rawProviderToolExposure: false, suppressedRawProviderToolCount: definitions.count, generatedAt: timestamp, redactionStatus: "private-state-excluded")
    }
    public func registerMicrosoftDynamics365Foundation(context: ServiceRequestContext, now: Date = Date()) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) { throw denied };
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now), catalog = try applications.catalogSnapshot(context: context, selectedAppId: "microsoft-dynamics-365", now: now), app = try requireMicrosoftDynamics365App(catalog: catalog, context: context),
            map = try policies.compilePolicyMap(context: context, appIdOrSlug: app.id, preset: .readOnly, now: now), definitions = try data.listMarketplaceProviderActionDefinitions(workspaceId: context.workspaceId, appId: app.id, limit: 500).sorted { $0.actionKey < $1.actionKey },
            actions = definitions.map { actionFoundation(definition: $0, permissionMap: map) }, wrappers = actions.compactMap(\.wrapperToolName).sorted(), blocked = actions.filter { $0.policyPermission == .blocked || $0.riskLevel == .destructive }.map(\.actionKey).sorted()
        ;
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug, providerName: app.name, providerFamily: "selected-dataverse-sales-crm-metadata", connectionMode: "relay-owned-microsoft-delegated-selected-dataverse-environment-oauth", credentialOwnership: .relayOwned,
            userOwnedCredentialsRequired: false, supportedPolicyPresets: [.readOnly, .blocked], defaultPolicyPreset: map.policyPreset, defaultPermissionMapId: map.id, adapterBoundary: "brokered-native-dataverse-v9-2-fixed-get-adapter",
            actionMapVersion: "microsoft-dynamics-365-selected-environment-sales-v1", budgetPolicy: ["maxWrapperTools": .number(4), "maxResults": .number(25), "providerRequestsPerAction": .number(1), "maxResponseBytes": .number(1000000), "automaticPagination": .bool(false)],
            privacyPolicy: ["selectedEnvironmentOnly": .bool(true), "getOnlyFixedSelect": .bool(true), "contactsOwnersNotesCustomSearch": .string("blocked"), "actionsWritesExportRaw": .string("blocked")], actions: actions, credentials: Self.microsoftDynamics365CredentialRequirements,
            agentFacingWrapperToolNames: wrappers, blockedActionKeys: blocked, rawProviderToolExposure: false, suppressedRawProviderToolCount: definitions.count, generatedAt: timestamp, redactionStatus: "private-state-excluded")
    }
    public func registerMicrosoftVivaEngageFoundation(context: ServiceRequestContext, now: Date = Date()) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) { throw denied };
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now), catalog = try applications.catalogSnapshot(context: context, selectedAppId: "microsoft-viva-engage", now: now), app = try requireMicrosoftVivaEngageApp(catalog: catalog, context: context),
            map = try policies.compilePolicyMap(context: context, appIdOrSlug: app.id, preset: .readOnly, now: now), definitions = try data.listMarketplaceProviderActionDefinitions(workspaceId: context.workspaceId, appId: app.id, limit: 500).sorted { $0.actionKey < $1.actionKey },
            actions = definitions.map { actionFoundation(definition: $0, permissionMap: map) }, wrappers = actions.compactMap(\.wrapperToolName).sorted(), blocked = actions.filter { $0.policyPermission == .blocked || $0.riskLevel == .destructive }.map(\.actionKey).sorted()
        ;
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug, providerName: app.name, providerFamily: "selected-community-conversation-metadata", connectionMode: "relay-owned-microsoft-entra-delegated-viva-engage-oauth", credentialOwnership: .relayOwned,
            userOwnedCredentialsRequired: false, supportedPolicyPresets: [.readOnly, .blocked], defaultPolicyPreset: map.policyPreset, defaultPermissionMapId: map.id, adapterBoundary: "brokered-native-yammer-core-v1-selected-community-get-adapter",
            actionMapVersion: "microsoft-viva-engage-selected-community-v1", budgetPolicy: ["maxWrapperTools": .number(4), "maxResults": .number(25), "providerRequestsPerAction": .number(1), "maxResponseBytes": .number(1000000), "automaticPagination": .bool(false)],
            privacyPolicy: ["selectedCommunityOnly": .bool(true), "getOnly": .bool(true), "privateFeedsIdentitiesAttachments": .string("blocked"), "searchExportWritesRaw": .string("blocked")], actions: actions, credentials: Self.microsoftVivaEngageCredentialRequirements,
            agentFacingWrapperToolNames: wrappers, blockedActionKeys: blocked, rawProviderToolExposure: false, suppressedRawProviderToolCount: definitions.count, generatedAt: timestamp, redactionStatus: "private-state-excluded")
    }
    public func registerZoomFoundation(context: ServiceRequestContext, now: Date = Date()) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) { throw denied };
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now), catalog = try applications.catalogSnapshot(context: context, selectedAppId: "zoom", now: now), app = try requireZoomApp(catalog: catalog, context: context),
            map = try policies.compilePolicyMap(context: context, appIdOrSlug: app.id, preset: .readOnly, now: now), definitions = try data.listMarketplaceProviderActionDefinitions(workspaceId: context.workspaceId, appId: app.id, limit: 500).sorted { $0.actionKey < $1.actionKey },
            actions = definitions.map { actionFoundation(definition: $0, permissionMap: map) }, wrappers = actions.compactMap(\.wrapperToolName).sorted(), blocked = actions.filter { $0.policyPermission == .blocked || $0.riskLevel == .destructive }.map(\.actionKey).sorted()
        ;
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug, providerName: app.name, providerFamily: "self-user-meeting-metadata", connectionMode: "relay-owned-zoom-user-managed-oauth", credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
            supportedPolicyPresets: [.readOnly, .blocked], defaultPolicyPreset: map.policyPreset, defaultPermissionMapId: map.id, adapterBoundary: "brokered-native-zoom-rest-v2-self-user-metadata-adapter", actionMapVersion: "zoom-self-user-meeting-metadata-v1",
            budgetPolicy: ["maxWrapperTools": .number(4), "maxResults": .number(25), "providerRequestsPerAction": .number(1), "maxResponseBytes": .number(1000000), "automaticPagination": .bool(false)],
            privacyPolicy: ["selfUserOnly": .bool(true), "metadataOnly": .bool(true), "credentialsPeopleContent": .string("blocked"), "adminWritesPaginationRaw": .string("blocked")], actions: actions, credentials: Self.zoomCredentialRequirements, agentFacingWrapperToolNames: wrappers,
            blockedActionKeys: blocked, rawProviderToolExposure: false, suppressedRawProviderToolCount: definitions.count, generatedAt: timestamp, redactionStatus: "private-state-excluded")
    }
    public func registerDiscordFoundation(context: ServiceRequestContext, now: Date = Date()) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) { throw denied };
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now), catalog = try applications.catalogSnapshot(context: context, selectedAppId: "discord", now: now), app = try requireDiscordApp(catalog: catalog, context: context),
            map = try policies.compilePolicyMap(context: context, appIdOrSlug: app.id, preset: .readOnly, now: now), definitions = try data.listMarketplaceProviderActionDefinitions(workspaceId: context.workspaceId, appId: app.id, limit: 500).sorted { $0.actionKey < $1.actionKey },
            actions = definitions.map { actionFoundation(definition: $0, permissionMap: map) }, wrappers = actions.compactMap(\.wrapperToolName).sorted(), blocked = actions.filter { $0.policyPermission == .blocked || $0.riskLevel == .destructive }.map(\.actionKey).sorted()
        ;
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug, providerName: app.name, providerFamily: "selected-guild-channel-bot", connectionMode: "relay-owned-discord-bot-install", credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
            supportedPolicyPresets: [.readOnly, .blocked], defaultPolicyPreset: map.policyPreset, defaultPermissionMapId: map.id, adapterBoundary: "brokered-native-discord-rest-v10-selected-channel-adapter", actionMapVersion: "discord-selected-guild-channel-v1",
            budgetPolicy: ["maxWrapperTools": .number(4), "maxResults": .number(25), "providerRequestsPerAction": .number(1), "maxResponseBytes": .number(1000000), "automaticPagination": .bool(false)],
            privacyPolicy: ["selectedGuildChannelOnly": .bool(true), "botInstallOnly": .bool(true), "peopleMediaSearch": .string("blocked"), "writesModerationGatewayPaginationRaw": .string("blocked")], actions: actions, credentials: Self.discordCredentialRequirements,
            agentFacingWrapperToolNames: wrappers, blockedActionKeys: blocked, rawProviderToolExposure: false, suppressedRawProviderToolCount: definitions.count, generatedAt: timestamp, redactionStatus: "private-state-excluded")
    }

    public func registerGoogleFormsFoundation(context: ServiceRequestContext, now: Date = Date()) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) { throw denied }
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now), catalog = try applications.catalogSnapshot(context: context, selectedAppId: "google-forms", now: now)
        let app = try requireGoogleFormsApp(catalog: catalog, context: context), map = try policies.compilePolicyMap(context: context, appIdOrSlug: app.id, preset: .approvalRequired, now: now)
        let definitions = try data.listMarketplaceProviderActionDefinitions(workspaceId: context.workspaceId, appId: app.id, limit: 500).sorted { $0.actionKey < $1.actionKey }
        let actions = definitions.map { actionFoundation(definition: $0, permissionMap: map) }, wrappers = actions.compactMap(\.wrapperToolName).sorted(), blocked = actions.filter { $0.policyPermission == .blocked || $0.riskLevel == .destructive }.map(\.actionKey).sorted()
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug, providerName: app.name, providerFamily: "forms-and-surveys", connectionMode: "relay-owned-google-oauth-drive-file-forms", credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
            supportedPolicyPresets: [.approvalRequired, .allowDirectWrites, .readOnly, .blocked], defaultPolicyPreset: map.policyPreset, defaultPermissionMapId: map.id, adapterBoundary: "brokered-native-google-forms-api-v1-adapter", actionMapVersion: "google-forms-v1",
            budgetPolicy: [
                "maxWrapperTools": .number(4), "maxItems": .number(100), "maxChoices": .number(50), "maxReadTextCharacters": .number(10000), "maxWriteCharacters": .number(20000), "maxBatchSubrequests": .number(20), "maxResponseBytes": .number(2000000), "providerRequestsPerAction": .number(1),
                "automaticPagination": .bool(false),
            ],
            privacyPolicy: [
                "authorizedFormCorpus": .string("relay_created_or_explicitly_selected_opened"), "responsesAndRespondentData": .string("blocked"), "formsCreatedUnpublished": .bool(true), "writes": .string("approval_required_or_direct_write_by_policy"),
                "watchesPublishQuizDestructiveArbitraryBatchLinkedSheetsSharingExportRaw": .string("blocked"), "rawCredentials": .string("secret-reference-only"),
            ], actions: actions, credentials: Self.googleFormsCredentialRequirements, agentFacingWrapperToolNames: wrappers, blockedActionKeys: blocked, rawProviderToolExposure: false, suppressedRawProviderToolCount: definitions.count, generatedAt: timestamp,
            redactionStatus: "private-state-excluded")
    }

    public func registerGoogleSlidesFoundation(context: ServiceRequestContext, now: Date = Date()) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) { throw denied }
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
        let catalog = try applications.catalogSnapshot(context: context, selectedAppId: "google-slides", now: now)
        let app = try requireGoogleSlidesApp(catalog: catalog, context: context)
        let map = try policies.compilePolicyMap(context: context, appIdOrSlug: app.id, preset: .approvalRequired, now: now)
        let definitions = try data.listMarketplaceProviderActionDefinitions(workspaceId: context.workspaceId, appId: app.id, limit: 500).sorted { $0.actionKey < $1.actionKey }
        let actions = definitions.map { actionFoundation(definition: $0, permissionMap: map) }
        let wrappers = actions.compactMap(\.wrapperToolName).sorted()
        let blocked = actions.filter { $0.policyPermission == .blocked || $0.riskLevel == .destructive }.map(\.actionKey).sorted()
        return MarketplaceProviderFoundationSnapshot(workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug, providerName: app.name,
            providerFamily: "presentations", connectionMode: "relay-owned-google-oauth-drive-file-slides",
            credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
            supportedPolicyPresets: [.approvalRequired, .allowDirectWrites, .readOnly, .blocked],
            defaultPolicyPreset: map.policyPreset, defaultPermissionMapId: map.id,
            adapterBoundary: "brokered-native-google-slides-api-v1-adapter", actionMapVersion: "google-slides-v1",
            budgetPolicy: [
                "maxWrapperTools": .number(5), "maxSlides": .number(50), "maxPageElements": .number(100), "maxReadTextCharacters": .number(10000), "maxBatchSubrequests": .number(20), "maxWriteCharacters": .number(20000), "maxResponseBytes": .number(2000000), "providerRequestsPerAction": .number(1),
                "automaticPagination": .bool(false),
            ],
            privacyPolicy: [
                "authorizedPresentationCorpus": .string("relay_created_or_explicitly_selected_opened"), "wholeDriveDiscovery": .string("blocked"), "thumbnailsMediaSpeakerNotes": .string("excluded"), "writes": .string("approval_required_or_direct_write_by_policy"),
                "deleteReorderDuplicateArbitraryBatchObjectsFormattingSharingExportRaw": .string("blocked"), "rawCredentials": .string("secret-reference-only"),
            ],
            actions: actions, credentials: Self.googleSlidesCredentialRequirements,
            agentFacingWrapperToolNames: wrappers, blockedActionKeys: blocked, rawProviderToolExposure: false,
            suppressedRawProviderToolCount: definitions.count, generatedAt: timestamp, redactionStatus: "private-state-excluded")
    }

    public func registerGoogleSheetsFoundation(
        context: ServiceRequestContext,
        now: Date = Date()
    ) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) { throw denied }
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
        let catalog = try applications.catalogSnapshot(context: context, selectedAppId: "google-sheets", now: now)
        let app = try requireGoogleSheetsApp(catalog: catalog, context: context)
        let map = try policies.compilePolicyMap(context: context, appIdOrSlug: app.id, preset: .approvalRequired, now: now)
        let definitions = try data.listMarketplaceProviderActionDefinitions(workspaceId: context.workspaceId, appId: app.id, limit: 500).sorted { $0.actionKey < $1.actionKey }
        let actions = definitions.map { actionFoundation(definition: $0, permissionMap: map) }
        let wrappers = actions.compactMap(\.wrapperToolName).sorted()
        let blocked = actions.filter { $0.policyPermission == .blocked || $0.riskLevel == .destructive }.map(\.actionKey).sorted()
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug,
            providerName: app.name, providerFamily: "spreadsheets",
            connectionMode: "relay-owned-google-oauth-drive-file-sheets",
            credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
            supportedPolicyPresets: [.approvalRequired, .allowDirectWrites, .readOnly, .blocked],
            defaultPolicyPreset: map.policyPreset, defaultPermissionMapId: map.id,
            adapterBoundary: "brokered-native-google-sheets-api-v4-adapter",
            actionMapVersion: "google-sheets-v1",
            budgetPolicy: ["maxWrapperTools": .number(5), "maxRows": .number(200),
                "maxColumns": .number(26), "maxCells": .number(5000),
                "maxValueCharacters": .number(100000), "maxResponseBytes": .number(2000000),
                "automaticPagination": .bool(false), "providerRequestsPerAction": .number(1)],
            privacyPolicy: ["authorizedSpreadsheetCorpus": .string("relay_created_or_explicitly_selected_opened"),
                "wholeDriveDiscovery": .string("blocked"), "explicitA1Range": .string("required"),
                "writes": .string("approval_required_or_direct_write_by_policy"),
                "clearStructureFormattingSharingExportScriptsRawAPI": .string("blocked"),
                "rawCredentials": .string("secret-reference-only")],
            actions: actions, credentials: Self.googleSheetsCredentialRequirements,
            agentFacingWrapperToolNames: wrappers, blockedActionKeys: blocked,
            rawProviderToolExposure: false, suppressedRawProviderToolCount: definitions.count,
            generatedAt: timestamp, redactionStatus: "private-state-excluded")
    }

    public func registerGoogleDriveFoundation(
        context: ServiceRequestContext,
        now: Date = Date()
    ) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
            throw denied
        }
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
        let catalog = try applications.catalogSnapshot(
            context: context,
            selectedAppId: "google-drive",
            now: now
        )
        let app = try requireGoogleDriveApp(catalog: catalog, context: context)
        let permissionMap = try policies.compilePolicyMap(
            context: context,
            appIdOrSlug: app.id,
            preset: .approvalRequired,
            now: now
        )
        let definitions = try data.listMarketplaceProviderActionDefinitions(
            workspaceId: context.workspaceId,
            appId: app.id,
            limit: 500
        ).sorted { $0.actionKey < $1.actionKey }
        let actions = definitions.map { definition in
            actionFoundation(definition: definition, permissionMap: permissionMap)
        }
        let wrapperToolNames = actions.compactMap(\.wrapperToolName).sorted()
        let blockedActionKeys = actions
            .filter { $0.policyPermission == .blocked || $0.riskLevel == .destructive }
            .map(\.actionKey)
            .sorted()
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId,
            appId: app.id,
            appSlug: app.slug,
            providerName: app.name,
            providerFamily: "cloud-storage",
            connectionMode: "relay-owned-google-oauth-drive",
            credentialOwnership: .relayOwned,
            userOwnedCredentialsRequired: false,
            supportedPolicyPresets: [.approvalRequired, .allowDirectWrites, .readOnly, .blocked],
            defaultPolicyPreset: permissionMap.policyPreset,
            defaultPermissionMapId: permissionMap.id,
            adapterBoundary: "brokered-native-google-drive-api-adapter",
            actionMapVersion: "google-drive-v1",
            budgetPolicy: [
                "maxWrapperTools": .number(6),
                "promptSummaryMaxCharacters": .number(1200),
                "maxSearchResults": .number(10),
                "maxContentChars": .number(8000),
                "automaticPagination": .bool(false),
                "readTimeoutSeconds": .number(20),
                "writeTimeoutSeconds": .number(30),
                "redactionStatus": .string("private-state-excluded")
            ],
            privacyPolicy: [
                "fileContent": .string("task_context_only"),
                "semanticReads": .string("app_visible_drive_file_metadata_and_bounded_content"),
                "authorizedFileCorpus": .string("relay_created_or_explicitly_selected_opened"),
                "wholeDriveDiscovery": .string("blocked"),
                "writes": .string("approval_required_or_direct_write_by_policy"),
                "destructiveContent": .string("blocked"),
                "sharingPermissions": .string("blocked"),
                "broadExport": .string("blocked"),
                "rawMCPExposure": .string("blocked"),
                "relayOwnedGoogleApp": .string("supported"),
                "rawCredentials": .string("secret-reference-only"),
                "redactionStatus": .string("private-state-excluded")
            ],
            actions: actions,
            credentials: Self.googleDriveCredentialRequirements,
            agentFacingWrapperToolNames: wrapperToolNames,
            blockedActionKeys: blockedActionKeys,
            rawProviderToolExposure: false,
            suppressedRawProviderToolCount: definitions.count,
            generatedAt: timestamp,
            redactionStatus: "private-state-excluded"
        )
    }

    public func registerGoogleSearchConsoleFoundation(
        context: ServiceRequestContext,
        now: Date = Date()
    ) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
            throw denied
        }
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
        let catalog = try applications.catalogSnapshot(
            context: context,
            selectedAppId: "google-search-console",
            now: now
        )
        let app = try requireGoogleSearchConsoleApp(catalog: catalog, context: context)
        let permissionMap = try policies.compilePolicyMap(
            context: context,
            appIdOrSlug: app.id,
            preset: .readOnly,
            now: now
        )
        let definitions = try data.listMarketplaceProviderActionDefinitions(
            workspaceId: context.workspaceId,
            appId: app.id,
            limit: 500
        ).sorted { $0.actionKey < $1.actionKey }
        let actions = definitions.map { definition in
            actionFoundation(definition: definition, permissionMap: permissionMap)
        }
        let wrapperToolNames = actions.compactMap(\.wrapperToolName).sorted()
        let blockedActionKeys = actions
            .filter { $0.policyPermission == .blocked || $0.riskLevel == .destructive }
            .map(\.actionKey)
            .sorted()
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId,
            appId: app.id,
            appSlug: app.slug,
            providerName: app.name,
            providerFamily: "search-performance",
            connectionMode: "relay-owned-google-oauth-search-console",
            credentialOwnership: .relayOwned,
            userOwnedCredentialsRequired: false,
            supportedPolicyPresets: [.readOnly, .blocked],
            defaultPolicyPreset: permissionMap.policyPreset,
            defaultPermissionMapId: permissionMap.id,
            adapterBoundary: "brokered-native-google-search-console-api-adapter",
            actionMapVersion: "google-search-console-v1",
            budgetPolicy: [
                "maxWrapperTools": .number(6),
                "promptSummaryMaxCharacters": .number(1200),
                "maxProperties": .number(25),
                "maxSearchAnalyticsRows": .number(25),
                "maxSearchAnalyticsLookbackDays": .number(28),
                "maxSitemaps": .number(25),
                "readTimeoutSeconds": .number(20),
                "writeActions": .string("blocked"),
                "redactionStatus": .string("private-state-excluded")
            ],
            privacyPolicy: [
                "searchConsoleContext": .string("task_context_only"),
                "semanticReads": .string("properties_analytics_url_inspection_sitemaps_bounded"),
                "writes": .string("blocked"),
                "broadExports": .string("blocked"),
                "testingToolsAPI": .string("blocked"),
                "propertyAdministration": .string("blocked"),
                "sitemapSubmissionAndDeletion": .string("blocked"),
                "rawAPIExposure": .string("blocked"),
                "rawMCPExposure": .string("blocked"),
                "relayOwnedGoogleApp": .string("supported"),
                "rawCredentials": .string("secret-reference-only"),
                "redactionStatus": .string("private-state-excluded")
            ],
            actions: actions,
            credentials: Self.googleSearchConsoleCredentialRequirements,
            agentFacingWrapperToolNames: wrapperToolNames,
            blockedActionKeys: blockedActionKeys,
            rawProviderToolExposure: false,
            suppressedRawProviderToolCount: definitions.count,
            generatedAt: timestamp,
            redactionStatus: "private-state-excluded"
        )
    }

    public func registerNotionFoundation(
        context: ServiceRequestContext,
        now: Date = Date()
    ) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
            throw denied
        }
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
        let catalog = try applications.catalogSnapshot(
            context: context,
            selectedAppId: "notion",
            now: now
        )
        let app = try requireNotionApp(catalog: catalog, context: context)
        let permissionMap = try policies.compilePolicyMap(
            context: context,
            appIdOrSlug: app.id,
            preset: .approvalRequired,
            now: now
        )
        let definitions = try data.listMarketplaceProviderActionDefinitions(
            workspaceId: context.workspaceId,
            appId: app.id,
            limit: 500
        ).sorted { $0.actionKey < $1.actionKey }
        let actions = definitions.map { definition in
            actionFoundation(definition: definition, permissionMap: permissionMap)
        }
        let wrapperToolNames = actions.compactMap(\.wrapperToolName).sorted()
        let blockedActionKeys = actions
            .filter { $0.policyPermission == .blocked || $0.riskLevel == .destructive }
            .map(\.actionKey)
            .sorted()
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId,
            appId: app.id,
            appSlug: app.slug,
            providerName: app.name,
            providerFamily: "workspace",
            connectionMode: "user-owned-notion-api-token",
            credentialOwnership: .userOwned,
            userOwnedCredentialsRequired: true,
            supportedPolicyPresets: [.approvalRequired, .allowDirectWrites, .readOnly, .blocked],
            defaultPolicyPreset: permissionMap.policyPreset,
            defaultPermissionMapId: permissionMap.id,
            adapterBoundary: "brokered-native-notion-rest-api-adapter",
            actionMapVersion: "notion-v1",
            budgetPolicy: [
                "maxWrapperTools": .number(7),
                "promptSummaryMaxCharacters": .number(1200),
                "maxSearchResults": .number(10),
                "maxSemanticReadResults": .number(5),
                "maxMarkdownChars": .number(8000),
                "readTimeoutSeconds": .number(20),
                "writeTimeoutSeconds": .number(30),
                "redactionStatus": .string("private-state-excluded")
            ],
            privacyPolicy: [
                "workspaceContent": .string("task_context_only"),
                "semanticReads": .string("search_fetch_query_bounded"),
                "writes": .string("approval_required_or_direct_write_by_policy"),
                "destructiveContent": .string("blocked"),
                "filesMediaAndExports": .string("blocked"),
                "rawMCPExposure": .string("blocked"),
                "relayOwnedNotionApp": .string("blocked"),
                "rawCredentials": .string("secret-reference-only"),
                "redactionStatus": .string("private-state-excluded")
            ],
            actions: actions,
            credentials: Self.notionCredentialRequirements,
            agentFacingWrapperToolNames: wrapperToolNames,
            blockedActionKeys: blockedActionKeys,
            rawProviderToolExposure: false,
            suppressedRawProviderToolCount: definitions.count,
            generatedAt: timestamp,
            redactionStatus: "private-state-excluded"
        )
    }

    public func registerSentryFoundation(
        context: ServiceRequestContext,
        now: Date = Date()
    ) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
            throw denied
        }
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
        let catalog = try applications.catalogSnapshot(
            context: context,
            selectedAppId: "sentry",
            now: now
        )
        let app = try requireSentryApp(catalog: catalog, context: context)
        let permissionMap = try policies.compilePolicyMap(
            context: context,
            appIdOrSlug: app.id,
            preset: .approvalRequired,
            now: now
        )
        let definitions = try data.listMarketplaceProviderActionDefinitions(
            workspaceId: context.workspaceId,
            appId: app.id,
            limit: 500
        ).sorted { $0.actionKey < $1.actionKey }
        let actions = definitions.map { definition in
            actionFoundation(definition: definition, permissionMap: permissionMap)
        }
        let wrapperToolNames = actions.compactMap(\.wrapperToolName).sorted()
        let blockedActionKeys = actions
            .filter { $0.policyPermission == .blocked || $0.riskLevel == .destructive }
            .map(\.actionKey)
            .sorted()
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId,
            appId: app.id,
            appSlug: app.slug,
            providerName: app.name,
            providerFamily: "observability",
            connectionMode: "relay-owned-sentry-device-oauth",
            credentialOwnership: .relayOwned,
            userOwnedCredentialsRequired: false,
            supportedPolicyPresets: [.approvalRequired, .allowDirectWrites, .readOnly, .blocked],
            defaultPolicyPreset: permissionMap.policyPreset,
            defaultPermissionMapId: permissionMap.id,
            adapterBoundary: "brokered-native-sentry-rest-api-adapter",
            actionMapVersion: "sentry-v1",
            budgetPolicy: [
                "maxWrapperTools": .number(6),
                "promptSummaryMaxCharacters": .number(1200),
                "maxProjectResults": .number(10),
                "maxIssueResults": .number(10),
                "maxEventContextChars": .number(6000),
                "readTimeoutSeconds": .number(20),
                "writeTimeoutSeconds": .number(30),
                "redactionStatus": .string("private-state-excluded")
            ],
            privacyPolicy: [
                "semanticReads": .string("project_issue_event_bounded_debug_context"),
                "eventContext": .string("task_context_only"),
                "writes": .string("approval_required_or_direct_write_by_policy"),
                "attachments": .string("blocked"),
                "sourceMapsAndReleaseFiles": .string("blocked"),
                "adminOperations": .string("blocked"),
                "bulkMutations": .string("blocked"),
                "rawMCPExposure": .string("blocked"),
                "seerAI": .string("blocked"),
                "relayOwnedSentryApp": .string("approved-device-oauth"),
                "rawCredentials": .string("secret-reference-only"),
                "redactionStatus": .string("private-state-excluded")
            ],
            actions: actions,
            credentials: Self.sentryCredentialRequirements,
            agentFacingWrapperToolNames: wrapperToolNames,
            blockedActionKeys: blockedActionKeys,
            rawProviderToolExposure: false,
            suppressedRawProviderToolCount: definitions.count,
            generatedAt: timestamp,
            redactionStatus: "private-state-excluded"
        )
    }

    public func registerMicrosoftClarityFoundation(
        context: ServiceRequestContext,
        now: Date = Date()
    ) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
            throw denied
        }
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
        let catalog = try applications.catalogSnapshot(
            context: context,
            selectedAppId: "microsoft-clarity",
            now: now
        )
        let app = try requireMicrosoftClarityApp(catalog: catalog, context: context)
        let permissionMap = try policies.compilePolicyMap(
            context: context,
            appIdOrSlug: app.id,
            preset: .approvalRequired,
            now: now
        )
        let definitions = try data.listMarketplaceProviderActionDefinitions(
            workspaceId: context.workspaceId,
            appId: app.id,
            limit: 500
        ).sorted { $0.actionKey < $1.actionKey }
        let actions = definitions.map { definition in
            actionFoundation(definition: definition, permissionMap: permissionMap)
        }
        let wrapperToolNames = actions.compactMap(\.wrapperToolName).sorted()
        let blockedActionKeys = actions
            .filter { $0.policyPermission == .blocked || $0.riskLevel == .destructive }
            .map(\.actionKey)
            .sorted()
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId,
            appId: app.id,
            appSlug: app.slug,
            providerName: app.name,
            providerFamily: "analytics",
            connectionMode: "user-owned-microsoft-clarity-data-export-api-token",
            credentialOwnership: .userOwned,
            userOwnedCredentialsRequired: true,
            supportedPolicyPresets: [.approvalRequired, .readOnly, .blocked],
            defaultPolicyPreset: permissionMap.policyPreset,
            defaultPermissionMapId: permissionMap.id,
            adapterBoundary: "brokered-native-microsoft-clarity-data-export-api-adapter",
            actionMapVersion: "microsoft-clarity-v1",
            budgetPolicy: [
                "maxWrapperTools": .number(1),
                "promptSummaryMaxCharacters": .number(900),
                "providerDailyRequestLimitPerProject": .number(10),
                "readTimeoutSeconds": .number(15),
                "maxDimensions": .number(3),
                "maxRowsPerProviderResponse": .number(1000),
                "redactionStatus": .string("private-state-excluded")
            ],
            privacyPolicy: [
                "projectInsights": .string("task_context_only"),
                "semanticReads": .string("project_live_insights_bounded_1_to_3_days"),
                "writes": .string("blocked"),
                "rawRecordings": .string("blocked"),
                "heatmaps": .string("blocked"),
                "instrumentation": .string("blocked"),
                "projectAdministration": .string("blocked"),
                "rawMCPExposure": .string("blocked"),
                "relayOwnedMicrosoftApp": .string("blocked"),
                "rawCredentials": .string("secret-reference-only"),
                "redactionStatus": .string("private-state-excluded")
            ],
            actions: actions,
            credentials: Self.microsoftClarityCredentialRequirements,
            agentFacingWrapperToolNames: wrapperToolNames,
            blockedActionKeys: blockedActionKeys,
            rawProviderToolExposure: false,
            suppressedRawProviderToolCount: definitions.count,
            generatedAt: timestamp,
            redactionStatus: "private-state-excluded"
        )
    }

    public func registerPostHogFoundation(
        context: ServiceRequestContext,
        now: Date = Date()
    ) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
            throw denied
        }
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
        let catalog = try applications.catalogSnapshot(
            context: context,
            selectedAppId: "posthog",
            now: now
        )
        let app = try requirePostHogApp(catalog: catalog, context: context)
        let permissionMap = try policies.compilePolicyMap(
            context: context,
            appIdOrSlug: app.id,
            preset: .readOnly,
            now: now
        )
        let definitions = try data.listMarketplaceProviderActionDefinitions(
            workspaceId: context.workspaceId,
            appId: app.id,
            limit: 500
        ).sorted { $0.actionKey < $1.actionKey }
        let actions = definitions.map { definition in
            actionFoundation(definition: definition, permissionMap: permissionMap)
        }
        let wrapperToolNames = actions.compactMap(\.wrapperToolName).sorted()
        let blockedActionKeys = actions
            .filter { $0.policyPermission == .blocked || $0.riskLevel == .destructive }
            .map(\.actionKey)
            .sorted()
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId,
            appId: app.id,
            appSlug: app.slug,
            providerName: app.name,
            providerFamily: "product-analytics",
            connectionMode: "relay-owned-posthog-oauth-pkce-cimd",
            credentialOwnership: .relayOwned,
            userOwnedCredentialsRequired: false,
            supportedPolicyPresets: [.readOnly, .blocked],
            defaultPolicyPreset: permissionMap.policyPreset,
            defaultPermissionMapId: permissionMap.id,
            adapterBoundary: "brokered-native-posthog-api-adapter",
            actionMapVersion: "posthog-v1",
            budgetPolicy: [
                "maxWrapperTools": .number(7),
                "promptSummaryMaxCharacters": .number(1200),
                "maxListResults": .number(25),
                "maxQueryRows": .number(100),
                "maxQueryLookbackDays": .number(90),
                "readTimeoutSeconds": .number(20),
                "writeActions": .string("blocked"),
                "redactionStatus": .string("private-state-excluded")
            ],
            privacyPolicy: [
                "analyticsContext": .string("task_context_only"),
                "semanticReads": .string("projects_dashboards_insights_bounded_queries_schema"),
                "eventCapture": .string("blocked"),
                "dashboardInsightWrites": .string("blocked"),
                "featureFlagsAndExperiments": .string("blocked"),
                "adminOperations": .string("blocked"),
                "personSessionReplayLogsAndTickets": .string("blocked"),
                "broadExports": .string("blocked"),
                "rawMCPExposure": .string("blocked"),
                "arbitrarySQLOrHogQL": .string("blocked"),
                "relayOwnedPostHogApp": .string("approved-read-only-oauth"),
                "rawCredentials": .string("secret-reference-only"),
                "redactionStatus": .string("private-state-excluded")
            ],
            actions: actions,
            credentials: Self.postHogCredentialRequirements,
            agentFacingWrapperToolNames: wrapperToolNames,
            blockedActionKeys: blockedActionKeys,
            rawProviderToolExposure: false,
            suppressedRawProviderToolCount: definitions.count,
            generatedAt: timestamp,
            redactionStatus: "private-state-excluded"
        )
    }

    public func registerDatadogFoundation(context: ServiceRequestContext, now: Date = Date()) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) { throw denied }
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now), catalog = try applications.catalogSnapshot(context: context, selectedAppId: "datadog", now: now)
        guard let app = catalog.apps.first(where: { $0.slug == "datadog" }), app.availability == .available else { throw ServiceGuard.invalidInput(context: context, message: "Datadog Marketplace app is unavailable.") }
        let map = try policies.compilePolicyMap(context: context, appIdOrSlug: app.id, preset: .readOnly, now: now), definitions = try data.listMarketplaceProviderActionDefinitions(workspaceId: context.workspaceId, appId: app.id, limit: 500).sorted { $0.actionKey < $1.actionKey },
            actions = definitions.map { actionFoundation(definition: $0, permissionMap: map) }, wrappers = actions.compactMap(\.wrapperToolName).sorted()
        let credentials = [
            MarketplaceProviderCredentialFoundation(fieldKey: "datadog_oauth_access_token", label: "Datadog OAuth access token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
            MarketplaceProviderCredentialFoundation(fieldKey: "datadog_oauth_refresh_token", label: "Datadog OAuth refresh token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
            MarketplaceProviderCredentialFoundation(fieldKey: "datadog_api_origin", label: "Datadog API site", required: true, userOwnedRequired: false, secretStorage: "metadata-only", redactionStatus: "private-state-excluded"),
        ]
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug, providerName: app.name, providerFamily: "observability", connectionMode: "relay-owned-datadog-oauth-pkce-confidential-hosted", credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
            supportedPolicyPresets: [.readOnly, .blocked], defaultPolicyPreset: map.policyPreset, defaultPermissionMapId: map.id, adapterBoundary: "brokered-native-datadog-rest-api-adapter", actionMapVersion: "datadog-v1",
            budgetPolicy: ["maxWrapperTools": .number(3), "maxListResults": .number(25), "readTimeoutSeconds": .number(20), "writeActions": .string("blocked")],
            privacyPolicy: [
                "semanticReads": .string("monitor_incident_service_summaries"), "logsTracesEventsMetricsExport": .string("blocked"), "telemetryIngestion": .string("blocked"), "keyAndAdminOperations": .string("blocked"), "rawProviderToolExposure": .string("blocked"),
                "rawCredentials": .string("secret-reference-only"),
            ], actions: actions, credentials: credentials, agentFacingWrapperToolNames: wrappers, blockedActionKeys: [], rawProviderToolExposure: false, suppressedRawProviderToolCount: definitions.count, generatedAt: timestamp, redactionStatus: "private-state-excluded")
    }

    public func registerPagerDutyFoundation(context: ServiceRequestContext, now: Date = Date()) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) { throw denied }
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
        let catalog = try applications.catalogSnapshot(context: context, selectedAppId: "pagerduty", now: now)
        guard let app = catalog.apps.first(where: { $0.slug == "pagerduty" }), app.availability == .available else { throw ServiceGuard.invalidInput(context: context, message: "PagerDuty Marketplace app is unavailable.") }
        let map = try policies.compilePolicyMap(context: context, appIdOrSlug: app.id, preset: .readOnly, now: now)
        let definitions = try data.listMarketplaceProviderActionDefinitions(workspaceId: context.workspaceId, appId: app.id, limit: 500).sorted { $0.actionKey < $1.actionKey }
        let actions = definitions.map { actionFoundation(definition: $0, permissionMap: map) }
        let wrappers = actions.compactMap(\.wrapperToolName).sorted()
        let credentials = [
            MarketplaceProviderCredentialFoundation(fieldKey: "pagerduty_oauth_access_token", label: "PagerDuty OAuth access token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
            MarketplaceProviderCredentialFoundation(fieldKey: "pagerduty_oauth_refresh_token", label: "PagerDuty OAuth refresh token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
            MarketplaceProviderCredentialFoundation(fieldKey: "pagerduty_account", label: "PagerDuty account audience and API region", required: true, userOwnedRequired: false, secretStorage: "metadata-only", redactionStatus: "private-state-excluded")
        ]
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug, providerName: app.name, providerFamily: "incident-response", connectionMode: "relay-owned-pagerduty-scoped-oauth-confidential-hosted", credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
            supportedPolicyPresets: [.readOnly, .blocked], defaultPolicyPreset: map.policyPreset, defaultPermissionMapId: map.id, adapterBoundary: "brokered-native-pagerduty-rest-v2-adapter", actionMapVersion: "pagerduty-v1",
            budgetPolicy: ["maxWrapperTools": .number(3), "maxListResults": .number(25), "readTimeoutSeconds": .number(20), "writeActions": .string("blocked")],
            privacyPolicy: [
                "semanticReads": .string("incident_and_service_summaries"), "contactsSchedulesOnCallsAlertBodiesLogs": .string("blocked"), "eventsIngestionAndIncidentMutation": .string("blocked"), "adminAndRawREST": .string("blocked"), "rawProviderToolExposure": .string("blocked"),
                "rawCredentials": .string("secret-reference-only"),
            ], actions: actions, credentials: credentials, agentFacingWrapperToolNames: wrappers, blockedActionKeys: [], rawProviderToolExposure: false, suppressedRawProviderToolCount: definitions.count, generatedAt: timestamp, redactionStatus: "private-state-excluded")
    }

    public func registerCloudflareFoundation(context: ServiceRequestContext, now: Date = Date()) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) { throw denied }
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now), catalog = try applications.catalogSnapshot(context: context, selectedAppId: "cloudflare", now: now)
        guard let app = catalog.apps.first(where: { $0.slug == "cloudflare" }), app.availability == .available else { throw ServiceGuard.invalidInput(context: context, message: "Cloudflare Marketplace app is unavailable.") }
        let map = try policies.compilePolicyMap(context: context, appIdOrSlug: app.id, preset: .readOnly, now: now), definitions = try data.listMarketplaceProviderActionDefinitions(workspaceId: context.workspaceId, appId: app.id, limit: 500).sorted { $0.actionKey < $1.actionKey },
            actions = definitions.map { actionFoundation(definition: $0, permissionMap: map) }, wrappers = actions.compactMap(\.wrapperToolName).sorted()
        let credentials = [
            MarketplaceProviderCredentialFoundation(fieldKey: "cloudflare_oauth_access_token", label: "Cloudflare OAuth access token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
            MarketplaceProviderCredentialFoundation(fieldKey: "cloudflare_oauth_refresh_token", label: "Cloudflare OAuth refresh token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
            MarketplaceProviderCredentialFoundation(fieldKey: "cloudflare_account_zone", label: "Cloudflare account and selected zone", required: true, userOwnedRequired: false, secretStorage: "metadata-only", redactionStatus: "private-state-excluded"),
        ]
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug, providerName: app.name, providerFamily: "web-infrastructure", connectionMode: "relay-owned-cloudflare-oauth-s256-confidential-hosted", credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
            supportedPolicyPresets: [.readOnly, .blocked], defaultPolicyPreset: map.policyPreset, defaultPermissionMapId: map.id, adapterBoundary: "brokered-native-cloudflare-rest-graphql-adapter", actionMapVersion: "cloudflare-v1",
            budgetPolicy: ["maxWrapperTools": .number(3), "maxListResults": .number(25), "analyticsWindowHours": .number(24), "readTimeoutSeconds": .number(20), "writeActions": .string("blocked")],
            privacyPolicy: [
                "semanticReads": .string("zone_and_aggregate_traffic_summaries"), "logsAndRequestDimensions": .string("blocked"), "dnsRulesSettingsWorkersAccess": .string("blocked"), "tokensUsersBillingAdmin": .string("blocked"), "rawRESTGraphQL": .string("blocked"),
                "rawCredentials": .string("secret-reference-only"),
            ], actions: actions, credentials: credentials, agentFacingWrapperToolNames: wrappers, blockedActionKeys: [], rawProviderToolExposure: false, suppressedRawProviderToolCount: definitions.count, generatedAt: timestamp, redactionStatus: "private-state-excluded")
    }

    public func registerVercelFoundation(context: ServiceRequestContext, now: Date = Date()) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) { throw denied }; let timestamp = ISO8601DateFormatter.relayConsole.string(from: now), catalog = try applications.catalogSnapshot(context: context, selectedAppId: "vercel", now: now);
        guard let app = catalog.apps.first(where: { $0.slug == "vercel" }), app.availability == .available else { throw ServiceGuard.invalidInput(context: context, message: "Vercel Marketplace app is unavailable.") };
        let map = try policies.compilePolicyMap(context: context, appIdOrSlug: app.id, preset: .readOnly, now: now), definitions = try data.listMarketplaceProviderActionDefinitions(workspaceId: context.workspaceId, appId: app.id, limit: 500).sorted { $0.actionKey < $1.actionKey },
            actions = definitions.map { actionFoundation(definition: $0, permissionMap: map) }, wrappers = actions.compactMap(\.wrapperToolName).sorted(),
            credentials = [
                MarketplaceProviderCredentialFoundation(fieldKey: "vercel_integration_access_token", label: "Vercel integration access token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
                MarketplaceProviderCredentialFoundation(fieldKey: "vercel_installation_scope", label: "Vercel configuration, team and selected project", required: true, userOwnedRequired: false, secretStorage: "metadata-only", redactionStatus: "private-state-excluded"),
            ]
        ;
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug, providerName: app.name, providerFamily: "deployment-platform", connectionMode: "relay-owned-vercel-connectable-integration-one-time-exchange", credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
            supportedPolicyPresets: [.readOnly, .blocked], defaultPolicyPreset: map.policyPreset, defaultPermissionMapId: map.id, adapterBoundary: "brokered-native-vercel-rest-api-adapter", actionMapVersion: "vercel-v1",
            budgetPolicy: ["maxWrapperTools": .number(3), "maxListResults": .number(25), "readTimeoutSeconds": .number(20), "writeActions": .string("blocked")],
            privacyPolicy: ["semanticReads": .string("project_and_deployment_summaries"), "logsFilesEnvironmentValues": .string("blocked"), "membersBillingDomainsCertificates": .string("blocked"), "rawREST": .string("blocked"), "rawCredentials": .string("secret-reference-only")], actions: actions,
            credentials: credentials, agentFacingWrapperToolNames: wrappers, blockedActionKeys: [], rawProviderToolExposure: false, suppressedRawProviderToolCount: definitions.count, generatedAt: timestamp, redactionStatus: "private-state-excluded")
    }

    public func registerHerokuFoundation(context: ServiceRequestContext, now: Date = Date()) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) { throw denied }; let timestamp = ISO8601DateFormatter.relayConsole.string(from: now), catalog = try applications.catalogSnapshot(context: context, selectedAppId: "heroku", now: now);
        guard let app = catalog.apps.first(where: { $0.slug == "heroku" }), app.availability == .available else { throw ServiceGuard.invalidInput(context: context, message: "Heroku Marketplace app is unavailable.") };
        let map = try policies.compilePolicyMap(context: context, appIdOrSlug: app.id, preset: .readOnly, now: now), definitions = try data.listMarketplaceProviderActionDefinitions(workspaceId: context.workspaceId, appId: app.id, limit: 500).sorted { $0.actionKey < $1.actionKey },
            actions = definitions.map { actionFoundation(definition: $0, permissionMap: map) }, wrappers = actions.compactMap(\.wrapperToolName).sorted(),
            credentials = [
                MarketplaceProviderCredentialFoundation(fieldKey: "heroku_oauth_access_token", label: "Heroku OAuth access token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
                MarketplaceProviderCredentialFoundation(fieldKey: "heroku_oauth_refresh_token", label: "Heroku OAuth refresh token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
                MarketplaceProviderCredentialFoundation(fieldKey: "heroku_team_app", label: "Heroku Team and selected App", required: true, userOwnedRequired: false, secretStorage: "metadata-only", redactionStatus: "private-state-excluded"),
            ]
        ;
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug, providerName: app.name, providerFamily: "deployment-platform", connectionMode: "relay-owned-heroku-oauth-authorization-code-rotating-pair", credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
            supportedPolicyPresets: [.readOnly, .blocked], defaultPolicyPreset: map.policyPreset, defaultPermissionMapId: map.id, adapterBoundary: "brokered-native-heroku-platform-api-adapter", actionMapVersion: "heroku-v1",
            budgetPolicy: ["maxWrapperTools": .number(3), "maxListResults": .number(25), "readTimeoutSeconds": .number(20), "writeActions": .string("blocked")],
            privacyPolicy: ["semanticReads": .string("team_app_release_dyno_summaries"), "configLogsCommandsOutputStreams": .string("blocked"), "addonsSourceMembersBillingAdmin": .string("blocked"), "rawPlatformAPI": .string("blocked"), "rawCredentials": .string("secret-reference-only")],
            actions: actions, credentials: credentials, agentFacingWrapperToolNames: wrappers, blockedActionKeys: [], rawProviderToolExposure: false, suppressedRawProviderToolCount: definitions.count, generatedAt: timestamp, redactionStatus: "private-state-excluded")
    }

    public func registerDigitalOceanFoundation(context: ServiceRequestContext, now: Date = Date()) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) { throw denied }; let timestamp = ISO8601DateFormatter.relayConsole.string(from: now), catalog = try applications.catalogSnapshot(context: context, selectedAppId: "digitalocean", now: now);
        guard let app = catalog.apps.first(where: { $0.slug == "digitalocean" }), app.availability == .available else { throw ServiceGuard.invalidInput(context: context, message: "DigitalOcean Marketplace app is unavailable.") };
        let map = try policies.compilePolicyMap(context: context, appIdOrSlug: app.id, preset: .readOnly, now: now), definitions = try data.listMarketplaceProviderActionDefinitions(workspaceId: context.workspaceId, appId: app.id, limit: 500).sorted { $0.actionKey < $1.actionKey },
            actions = definitions.map { actionFoundation(definition: $0, permissionMap: map) }, wrappers = actions.compactMap(\.wrapperToolName).sorted(),
            credentials = [
                MarketplaceProviderCredentialFoundation(fieldKey: "digitalocean_oauth_access_token", label: "DigitalOcean OAuth access token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
                MarketplaceProviderCredentialFoundation(fieldKey: "digitalocean_oauth_refresh_token", label: "DigitalOcean OAuth refresh token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
                MarketplaceProviderCredentialFoundation(fieldKey: "digitalocean_project_resource", label: "DigitalOcean Team, Project, and selected resource", required: true, userOwnedRequired: false, secretStorage: "metadata-only", redactionStatus: "private-state-excluded"),
            ]
        ;
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug, providerName: app.name, providerFamily: "cloud-infrastructure", connectionMode: "relay-owned-digitalocean-oauth-authorization-code-single-use-refresh", credentialOwnership: .relayOwned,
            userOwnedCredentialsRequired: false, supportedPolicyPresets: [.readOnly, .blocked], defaultPolicyPreset: map.policyPreset, defaultPermissionMapId: map.id, adapterBoundary: "brokered-native-digitalocean-v2-api-adapter", actionMapVersion: "digitalocean-v1",
            budgetPolicy: ["maxWrapperTools": .number(4), "maxListResults": .number(25), "readTimeoutSeconds": .number(20), "writeActions": .string("blocked")],
            privacyPolicy: [
                "semanticReads": .string("project_and_membership_verified_resource_summaries"), "environmentLogsConsoleCredentialsUserData": .string("blocked"), "databasesKubernetesRegistrySpacesNetworkingAdmin": .string("blocked"), "rawAPI": .string("blocked"),
                "rawCredentials": .string("secret-reference-only"),
            ], actions: actions, credentials: credentials, agentFacingWrapperToolNames: wrappers, blockedActionKeys: [], rawProviderToolExposure: false, suppressedRawProviderToolCount: definitions.count, generatedAt: timestamp, redactionStatus: "private-state-excluded")
    }

    public func registerFirebaseFoundation(context: ServiceRequestContext, now: Date = Date()) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) { throw denied }; let timestamp = ISO8601DateFormatter.relayConsole.string(from: now), catalog = try applications.catalogSnapshot(context: context, selectedAppId: "firebase", now: now);
        guard let app = catalog.apps.first(where: { $0.slug == "firebase" }), app.availability == .available else { throw ServiceGuard.invalidInput(context: context, message: "Firebase Marketplace app is unavailable.") };
        let map = try policies.compilePolicyMap(context: context, appIdOrSlug: app.id, preset: .readOnly, now: now), definitions = try data.listMarketplaceProviderActionDefinitions(workspaceId: context.workspaceId, appId: app.id, limit: 500).sorted { $0.actionKey < $1.actionKey },
            actions = definitions.map { actionFoundation(definition: $0, permissionMap: map) }, wrappers = actions.compactMap(\.wrapperToolName).sorted(),
            credentials = [
                MarketplaceProviderCredentialFoundation(fieldKey: "firebase_oauth_access_token", label: "Firebase OAuth access token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
                MarketplaceProviderCredentialFoundation(fieldKey: "firebase_oauth_refresh_token", label: "Firebase OAuth refresh token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
                MarketplaceProviderCredentialFoundation(fieldKey: "firebase_project", label: "Selected Firebase Project", required: true, userOwnedRequired: false, secretStorage: "metadata-only", redactionStatus: "private-state-excluded"),
            ]
        ;
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug, providerName: app.name, providerFamily: "application-development-platform", connectionMode: "relay-owned-google-oauth-authorization-code-offline-firebase-readonly", credentialOwnership: .relayOwned,
            userOwnedCredentialsRequired: false, supportedPolicyPresets: [.readOnly, .blocked], defaultPolicyPreset: map.policyPreset, defaultPermissionMapId: map.id, adapterBoundary: "brokered-native-firebase-management-api-adapter", actionMapVersion: "firebase-v1",
            budgetPolicy: ["maxWrapperTools": .number(3), "maxListResults": .number(25), "readTimeoutSeconds": .number(20), "writeActions": .string("blocked")],
            privacyPolicy: ["semanticReads": .string("firebase_project_and_registered_app_inventory"), "productDataAndConfiguration": .string("blocked"), "apiKeysAdminSDKAndRawAPI": .string("blocked"), "rawCredentials": .string("secret-reference-only")], actions: actions, credentials: credentials,
            agentFacingWrapperToolNames: wrappers, blockedActionKeys: [], rawProviderToolExposure: false, suppressedRawProviderToolCount: definitions.count, generatedAt: timestamp, redactionStatus: "private-state-excluded")
    }

    public func registerSupabaseFoundation(context: ServiceRequestContext, now: Date = Date()) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) { throw denied }; let timestamp = ISO8601DateFormatter.relayConsole.string(from: now), catalog = try applications.catalogSnapshot(context: context, selectedAppId: "supabase", now: now);
        guard let app = catalog.apps.first(where: { $0.slug == "supabase" }), app.availability == .available else { throw ServiceGuard.invalidInput(context: context, message: "Supabase Marketplace app is unavailable.") };
        let map = try policies.compilePolicyMap(context: context, appIdOrSlug: app.id, preset: .readOnly, now: now), definitions = try data.listMarketplaceProviderActionDefinitions(workspaceId: context.workspaceId, appId: app.id, limit: 500).sorted { $0.actionKey < $1.actionKey },
            actions = definitions.map { actionFoundation(definition: $0, permissionMap: map) }, wrappers = actions.compactMap(\.wrapperToolName).sorted(),
            credentials = [
                MarketplaceProviderCredentialFoundation(fieldKey: "supabase_oauth_access_token", label: "Supabase OAuth access token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
                MarketplaceProviderCredentialFoundation(fieldKey: "supabase_oauth_refresh_token", label: "Supabase OAuth refresh token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
                MarketplaceProviderCredentialFoundation(fieldKey: "supabase_organization_project", label: "Selected Supabase Organization and Project", required: true, userOwnedRequired: false, secretStorage: "metadata-only", redactionStatus: "private-state-excluded"),
            ]
        ;
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug, providerName: app.name, providerFamily: "application-development-platform", connectionMode: "relay-owned-supabase-oauth-authorization-code-pkce-readonly", credentialOwnership: .relayOwned,
            userOwnedCredentialsRequired: false, supportedPolicyPresets: [.readOnly, .blocked], defaultPolicyPreset: map.policyPreset, defaultPermissionMapId: map.id, adapterBoundary: "brokered-native-supabase-management-api-adapter", actionMapVersion: "supabase-v1",
            budgetPolicy: ["maxWrapperTools": .number(3), "maxListResults": .number(25), "listOffset": .number(0), "readTimeoutSeconds": .number(20), "automaticPagination": .bool(false), "writeActions": .string("blocked")],
            privacyPolicy: ["semanticReads": .string("supabase_organization_and_project_inventory"), "databaseSecretsConfigMembersLogs": .string("blocked"), "rawManagementAPI": .string("blocked"), "rawCredentials": .string("secret-reference-only")], actions: actions, credentials: credentials,
            agentFacingWrapperToolNames: wrappers, blockedActionKeys: [], rawProviderToolExposure: false, suppressedRawProviderToolCount: definitions.count, generatedAt: timestamp, redactionStatus: "private-state-excluded")
    }

    public func registerOktaFoundation(context: ServiceRequestContext, now: Date = Date()) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) { throw denied }; let timestamp = ISO8601DateFormatter.relayConsole.string(from: now), catalog = try applications.catalogSnapshot(context: context, selectedAppId: "okta", now: now);
        guard let app = catalog.apps.first(where: { $0.slug == "okta" }), app.availability == .available else { throw ServiceGuard.invalidInput(context: context, message: "Okta Marketplace app is unavailable.") };
        let map = try policies.compilePolicyMap(context: context, appIdOrSlug: app.id, preset: .readOnly, now: now), definitions = try data.listMarketplaceProviderActionDefinitions(workspaceId: context.workspaceId, appId: app.id, limit: 500).sorted { $0.actionKey < $1.actionKey },
            actions = definitions.map { actionFoundation(definition: $0, permissionMap: map) }, wrappers = actions.compactMap(\.wrapperToolName).sorted(),
            credentials = [
                MarketplaceProviderCredentialFoundation(fieldKey: "okta_oin_client_secret", label: "Okta OIN client secret", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
                MarketplaceProviderCredentialFoundation(fieldKey: "okta_oin_client_id", label: "Okta OIN client ID", required: true, userOwnedRequired: false, secretStorage: "metadata-only", redactionStatus: "private-state-excluded"),
                MarketplaceProviderCredentialFoundation(fieldKey: "okta_org_application", label: "Okta org and selected Application", required: true, userOwnedRequired: false, secretStorage: "metadata-only", redactionStatus: "private-state-excluded"),
            ]
        ;
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug, providerName: app.name, providerFamily: "identity-and-access-management", connectionMode: "relay-owned-okta-oin-api-service-client-credentials", credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
            supportedPolicyPresets: [.readOnly, .blocked], defaultPolicyPreset: map.policyPreset, defaultPermissionMapId: map.id, adapterBoundary: "brokered-native-okta-management-api-adapter", actionMapVersion: "okta-v1",
            budgetPolicy: ["maxWrapperTools": .number(3), "maxListResults": .number(25), "readTimeoutSeconds": .number(20), "accessTokenLifetimeSeconds": .number(3600), "automaticPagination": .bool(false), "writeActions": .string("blocked")],
            privacyPolicy: ["semanticReads": .string("okta_application_and_assigned_group_inventory"), "credentialsUsersMembersSettings": .string("blocked"), "rawManagementAPI": .string("blocked"), "rawCredentials": .string("secret-reference-only")], actions: actions, credentials: credentials,
            agentFacingWrapperToolNames: wrappers, blockedActionKeys: [], rawProviderToolExposure: false, suppressedRawProviderToolCount: definitions.count, generatedAt: timestamp, redactionStatus: "private-state-excluded")
    }
    public func registerBambooHRFoundation(context: ServiceRequestContext, now: Date = Date()) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) { throw denied }; let timestamp = ISO8601DateFormatter.relayConsole.string(from: now), catalog = try applications.catalogSnapshot(context: context, selectedAppId: "bamboohr", now: now);
        guard let app = catalog.apps.first(where: { $0.slug == "bamboohr" }), app.availability == .available else { throw ServiceGuard.invalidInput(context: context, message: "BambooHR Marketplace app is unavailable.") };
        let map = try policies.compilePolicyMap(context: context, appIdOrSlug: app.id, preset: .readOnly, now: now), definitions = try data.listMarketplaceProviderActionDefinitions(workspaceId: context.workspaceId, appId: app.id, limit: 500).sorted { $0.actionKey < $1.actionKey },
            actions = definitions.map { actionFoundation(definition: $0, permissionMap: map) }, wrappers = actions.compactMap(\.wrapperToolName).sorted(),
            credentials = [
                MarketplaceProviderCredentialFoundation(fieldKey: "bamboohr_oauth_access_token", label: "BambooHR OAuth access token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
                MarketplaceProviderCredentialFoundation(fieldKey: "bamboohr_oauth_refresh_token", label: "BambooHR OAuth refresh token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
                MarketplaceProviderCredentialFoundation(fieldKey: "bamboohr_company_location", label: "BambooHR company and selected Location", required: true, userOwnedRequired: false, secretStorage: "metadata-only", redactionStatus: "private-state-excluded"),
            ]
        ;
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug, providerName: app.name, providerFamily: "human-resources-organizational-metadata", connectionMode: "relay-owned-bamboohr-oauth-authorization-code-offline", credentialOwnership: .relayOwned,
            userOwnedCredentialsRequired: false, supportedPolicyPresets: [.readOnly, .blocked], defaultPolicyPreset: map.policyPreset, defaultPermissionMapId: map.id, adapterBoundary: "brokered-native-bamboohr-api-adapter", actionMapVersion: "bamboohr-v1",
            budgetPolicy: ["maxWrapperTools": .number(3), "maxListResults": .number(25), "readTimeoutSeconds": .number(20), "automaticPagination": .bool(false), "writeActions": .string("blocked")],
            privacyPolicy: ["semanticReads": .string("bamboohr_location_and_country_metadata"), "employeeAndSensitiveData": .string("blocked"), "addressDetails": .string("blocked"), "rawCredentials": .string("secret-reference-only")], actions: actions, credentials: credentials,
            agentFacingWrapperToolNames: wrappers, blockedActionKeys: [], rawProviderToolExposure: false, suppressedRawProviderToolCount: definitions.count, generatedAt: timestamp, redactionStatus: "private-state-excluded")
    }
    public func registerGreenhouseFoundation(context: ServiceRequestContext, now: Date = Date()) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) { throw denied }; let timestamp = ISO8601DateFormatter.relayConsole.string(from: now), catalog = try applications.catalogSnapshot(context: context, selectedAppId: "greenhouse", now: now);
        guard let app = catalog.apps.first(where: { $0.slug == "greenhouse" }), app.availability == .available else { throw ServiceGuard.invalidInput(context: context, message: "Greenhouse Marketplace app is unavailable.") };
        let map = try policies.compilePolicyMap(context: context, appIdOrSlug: app.id, preset: .readOnly, now: now), definitions = try data.listMarketplaceProviderActionDefinitions(workspaceId: context.workspaceId, appId: app.id, limit: 500).sorted { $0.actionKey < $1.actionKey },
            actions = definitions.map { actionFoundation(definition: $0, permissionMap: map) }, wrappers = actions.compactMap(\.wrapperToolName).sorted(),
            credentials = [
                MarketplaceProviderCredentialFoundation(fieldKey: "greenhouse_oauth_access_token", label: "Greenhouse OAuth access token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
                MarketplaceProviderCredentialFoundation(fieldKey: "greenhouse_oauth_refresh_token", label: "Greenhouse OAuth refresh token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
                MarketplaceProviderCredentialFoundation(fieldKey: "greenhouse_organization", label: "Greenhouse Recruiting organization", required: true, userOwnedRequired: false, secretStorage: "metadata-only", redactionStatus: "private-state-excluded"),
            ]
        ;
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug, providerName: app.name, providerFamily: "recruiting-structure", connectionMode: "relay-owned-greenhouse-harvest-v3-partner-oauth", credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
            supportedPolicyPresets: [.readOnly, .blocked], defaultPolicyPreset: map.policyPreset, defaultPermissionMapId: map.id, adapterBoundary: "brokered-native-greenhouse-harvest-v3-adapter", actionMapVersion: "greenhouse-v1",
            budgetPolicy: ["maxWrapperTools": .number(3), "maxListResults": .number(25), "readTimeoutSeconds": .number(20), "automaticPagination": .bool(false), "writeActions": .string("blocked")],
            privacyPolicy: ["semanticReads": .string("greenhouse_job_office_department_inventory"), "candidateApplicationInterviewUserContent": .string("blocked"), "rawHarvestAPI": .string("blocked"), "rawCredentials": .string("secret-reference-only")], actions: actions, credentials: credentials,
            agentFacingWrapperToolNames: wrappers, blockedActionKeys: [], rawProviderToolExposure: false, suppressedRawProviderToolCount: definitions.count, generatedAt: timestamp, redactionStatus: "private-state-excluded")
    }
    public func registerLeverFoundation(context: ServiceRequestContext, now: Date = Date()) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) { throw denied }; let timestamp = ISO8601DateFormatter.relayConsole.string(from: now), catalog = try applications.catalogSnapshot(context: context, selectedAppId: "lever", now: now);
        guard let app = catalog.apps.first(where: { $0.slug == "lever" }), app.availability == .available else { throw ServiceGuard.invalidInput(context: context, message: "Lever Marketplace app is unavailable.") };
        let map = try policies.compilePolicyMap(context: context, appIdOrSlug: app.id, preset: .readOnly, now: now), definitions = try data.listMarketplaceProviderActionDefinitions(workspaceId: context.workspaceId, appId: app.id, limit: 500).sorted { $0.actionKey < $1.actionKey },
            actions = definitions.map { actionFoundation(definition: $0, permissionMap: map) }, wrappers = actions.compactMap(\.wrapperToolName).sorted(),
            credentials = [
                MarketplaceProviderCredentialFoundation(fieldKey: "lever_oauth_access_token", label: "Lever OAuth access token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
                MarketplaceProviderCredentialFoundation(fieldKey: "lever_oauth_refresh_token", label: "Lever OAuth refresh token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
                MarketplaceProviderCredentialFoundation(fieldKey: "lever_account", label: "Lever account", required: true, userOwnedRequired: false, secretStorage: "metadata-only", redactionStatus: "private-state-excluded"),
            ]
        ;
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId, appId: app.id, appSlug: app.slug, providerName: app.name, providerFamily: "recruiting-structure", connectionMode: "relay-owned-lever-partner-oauth", credentialOwnership: .relayOwned, userOwnedCredentialsRequired: false,
            supportedPolicyPresets: [.readOnly, .blocked], defaultPolicyPreset: map.policyPreset, defaultPermissionMapId: map.id, adapterBoundary: "brokered-native-lever-data-api-v1-adapter", actionMapVersion: "lever-v1",
            budgetPolicy: ["maxWrapperTools": .number(2), "maxListResults": .number(25), "readTimeoutSeconds": .number(20), "automaticPagination": .bool(false), "writeActions": .string("blocked")],
            privacyPolicy: [
                "semanticReads": .string("lever_non_confidential_posting_stage_inventory"), "candidateOpportunityContactApplicationData": .string("blocked"), "confidentialContentSalaryPeopleFields": .string("blocked"), "rawLeverAPI": .string("blocked"),
                "rawCredentials": .string("secret-reference-only"),
            ], actions: actions, credentials: credentials, agentFacingWrapperToolNames: wrappers, blockedActionKeys: [], rawProviderToolExposure: false, suppressedRawProviderToolCount: definitions.count, generatedAt: timestamp, redactionStatus: "private-state-excluded")
    }

    public func registerTelemetryDeckFoundation(
        context: ServiceRequestContext,
        now: Date = Date()
    ) throws -> MarketplaceProviderFoundationSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
            throw denied
        }
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
        let catalog = try applications.catalogSnapshot(
            context: context,
            selectedAppId: "telemetrydeck",
            now: now
        )
        let app = try requireTelemetryDeckApp(catalog: catalog, context: context)
        let permissionMap = try policies.compilePolicyMap(
            context: context,
            appIdOrSlug: app.id,
            preset: .readOnly,
            now: now
        )
        let definitions = try data.listMarketplaceProviderActionDefinitions(
            workspaceId: context.workspaceId,
            appId: app.id,
            limit: 500
        ).sorted { $0.actionKey < $1.actionKey }
        let actions = definitions.map { definition in
            actionFoundation(definition: definition, permissionMap: permissionMap)
        }
        let wrapperToolNames = actions.compactMap(\.wrapperToolName).sorted()
        let blockedActionKeys = actions
            .filter { $0.policyPermission == .blocked || $0.riskLevel == .destructive }
            .map(\.actionKey)
            .sorted()
        return MarketplaceProviderFoundationSnapshot(
            workspaceId: context.workspaceId,
            appId: app.id,
            appSlug: app.slug,
            providerName: app.name,
            providerFamily: "app-analytics",
            connectionMode: "user-owned-telemetrydeck-pat",
            credentialOwnership: .userOwned,
            userOwnedCredentialsRequired: true,
            supportedPolicyPresets: [.readOnly, .blocked],
            defaultPolicyPreset: permissionMap.policyPreset,
            defaultPermissionMapId: permissionMap.id,
            adapterBoundary: "brokered-native-telemetrydeck-api-adapter",
            actionMapVersion: "telemetrydeck-v1",
            budgetPolicy: [
                "maxWrapperTools": .number(3),
                "promptSummaryMaxCharacters": .number(1000),
                "maxQueryRows": .number(100),
                "maxQueryLookbackDays": .number(90),
                "readTimeoutSeconds": .number(15),
                "scheduledPolling": .string("blocked"),
                "writeActions": .string("blocked"),
                "redactionStatus": .string("private-state-excluded")
            ],
            privacyPolicy: [
                "analyticsContext": .string("task_context_only"),
                "semanticReads": .string("user_info_bounded_tql_saved_insights"),
                "signalIngest": .string("blocked"),
                "rawScanExport": .string("blocked"),
                "appAdministration": .string("blocked"),
                "organizationAdministration": .string("blocked"),
                "unboundedQueries": .string("blocked"),
                "scheduledPolling": .string("blocked"),
                "rawMCPExposure": .string("blocked"),
                "relayOwnedTelemetryDeckApp": .string("blocked"),
                "rawCredentials": .string("secret-reference-only"),
                "redactionStatus": .string("private-state-excluded")
            ],
            actions: actions,
            credentials: Self.telemetryDeckCredentialRequirements,
            agentFacingWrapperToolNames: wrapperToolNames,
            blockedActionKeys: blockedActionKeys,
            rawProviderToolExposure: false,
            suppressedRawProviderToolCount: definitions.count,
            generatedAt: timestamp,
            redactionStatus: "private-state-excluded"
        )
    }

    private func requireXApp(
        catalog: ApplicationsCatalogSnapshot,
        context: ServiceRequestContext
    ) throws -> MarketplaceCatalogApp {
        guard let app = catalog.apps.first(where: { $0.slug == "x" }) else {
            throw ServiceGuard.invalidInput(context: context, message: "X Marketplace app was not available for provider foundation registration.")
        }
        guard app.sourceType == .externalProvider,
              app.availability == .available,
              app.roleManifest.approvalRequired
        else {
            throw ServiceGuard.invalidInput(context: context, message: "X provider foundation requires an available Relay-owned OAuth public social provider app.")
        }
        return app
    }

    private func requireLinkedInApp(
        catalog: ApplicationsCatalogSnapshot,
        context: ServiceRequestContext
    ) throws -> MarketplaceCatalogApp {
        guard let app = catalog.apps.first(where: { $0.slug == "linkedin" }) else {
            throw ServiceGuard.invalidInput(context: context, message: "LinkedIn Marketplace app was not available for provider foundation registration.")
        }
        guard app.sourceType == .externalProvider,
              app.availability == .available,
              app.roleManifest.approvalRequired
        else {
            throw ServiceGuard.invalidInput(context: context, message: "LinkedIn foundation requires an available user-owned public social provider app.")
        }
        return app
    }

    private func requireExaSearchApp(
        catalog: ApplicationsCatalogSnapshot,
        context: ServiceRequestContext
    ) throws -> MarketplaceCatalogApp {
        guard let app = catalog.apps.first(where: { $0.slug == "exa-search" }) else {
            throw ServiceGuard.invalidInput(context: context, message: "Exa Search Marketplace app was not available for provider foundation registration.")
        }
        guard app.sourceType == .externalProvider,
              app.availability == .available,
              Set(app.capabilityIds ?? []).isSuperset(
                of: ["search", "contents", "similar", "answer"])
        else {
            throw ServiceGuard.invalidInput(context: context, message: "Exa Search foundation requires an available user-owned research provider app.")
        }
        return app
    }

    private func requireGmailApp(
        catalog: ApplicationsCatalogSnapshot,
        context: ServiceRequestContext
    ) throws -> MarketplaceCatalogApp {
        guard let app = catalog.apps.first(where: { $0.slug == "gmail" }) else {
            throw ServiceGuard.invalidInput(context: context, message: "Gmail Marketplace app was not available for provider foundation registration.")
        }
        guard app.sourceType == .externalProvider,
              app.availability == .available,
              app.roleManifest.approvalRequired
        else {
            throw ServiceGuard.invalidInput(context: context, message: "Gmail foundation requires an available user-owned email provider app.")
        }
        return app
    }

    private func requireGoogleDocsApp(
        catalog: ApplicationsCatalogSnapshot,
        context: ServiceRequestContext
    ) throws -> MarketplaceCatalogApp {
        guard let app = catalog.apps.first(where: { $0.slug == "google-docs" }) else {
            throw ServiceGuard.invalidInput(context: context, message: "Google Docs Marketplace app was not available for provider foundation registration.")
        }
        guard app.sourceType == .externalProvider,
              app.availability == .available,
              app.roleManifest.approvalRequired
        else {
            throw ServiceGuard.invalidInput(context: context, message: "Google Docs foundation requires an available Relay-owned OAuth document provider app.")
        }
        return app
    }

    private func requireGoogleDriveApp(
        catalog: ApplicationsCatalogSnapshot,
        context: ServiceRequestContext
    ) throws -> MarketplaceCatalogApp {
        guard let app = catalog.apps.first(where: { $0.slug == "google-drive" }) else {
            throw ServiceGuard.invalidInput(context: context, message: "Google Drive Marketplace app was not available for provider foundation registration.")
        }
        guard app.sourceType == .externalProvider,
              app.availability == .available,
              app.roleManifest.approvalRequired
        else {
            throw ServiceGuard.invalidInput(context: context, message: "Google Drive foundation requires an available Relay-owned Google OAuth cloud-storage provider app.")
        }
        return app
    }

    private func requireGoogleSheetsApp(
        catalog: ApplicationsCatalogSnapshot,
        context: ServiceRequestContext
    ) throws -> MarketplaceCatalogApp {
        guard let app = catalog.apps.first(where: { $0.slug == "google-sheets" }) else {
            throw ServiceGuard.invalidInput(context: context, message: "Google Sheets Marketplace app was not available for provider foundation registration.")
        }
        guard app.sourceType == .externalProvider, app.availability == .available,
              app.roleManifest.approvalRequired
        else {
            throw ServiceGuard.invalidInput(context: context, message: "Google Sheets foundation requires an available Relay-owned Google OAuth spreadsheet provider app.")
        }
        return app
    }

    private func requireGoogleSlidesApp(catalog: ApplicationsCatalogSnapshot, context: ServiceRequestContext) throws -> MarketplaceCatalogApp {
        guard let app = catalog.apps.first(where: { $0.slug == "google-slides" }) else { throw ServiceGuard.invalidInput(context: context, message: "Google Slides Marketplace app was not available for provider foundation registration.") }
        guard app.sourceType == .externalProvider, app.availability == .available,
              app.roleManifest.approvalRequired
        else { throw ServiceGuard.invalidInput(context: context, message: "Google Slides foundation requires an available Relay-owned Google OAuth presentation provider app.") }
        return app
    }

    private func requireGoogleFormsApp(catalog: ApplicationsCatalogSnapshot, context: ServiceRequestContext) throws -> MarketplaceCatalogApp {
        guard let app = catalog.apps.first(where: { $0.slug == "google-forms" }) else { throw ServiceGuard.invalidInput(context: context, message: "Google Forms Marketplace app was not available for provider foundation registration.") }
        guard app.sourceType == .externalProvider, app.availability == .available, app.roleManifest.approvalRequired else { throw ServiceGuard.invalidInput(context: context, message: "Google Forms foundation requires an available Relay-owned Google OAuth form provider app.") }
        return app
    }

    private func requireGoogleTasksApp(catalog: ApplicationsCatalogSnapshot, context: ServiceRequestContext) throws -> MarketplaceCatalogApp {
        guard let app = catalog.apps.first(where: { $0.slug == "google-tasks" }) else { throw ServiceGuard.invalidInput(context: context, message: "Google Tasks Marketplace app was not available for provider foundation registration.") }
        guard app.sourceType == .externalProvider, app.availability == .available, app.roleManifest.approvalRequired else { throw ServiceGuard.invalidInput(context: context, message: "Google Tasks foundation requires an available Relay-owned Google OAuth task provider app.") }
        return app
    }

    private func requireGoogleContactsApp(catalog: ApplicationsCatalogSnapshot, context: ServiceRequestContext) throws -> MarketplaceCatalogApp {
        guard let app = catalog.apps.first(where: { $0.slug == "google-contacts" }) else { throw ServiceGuard.invalidInput(context: context, message: "Google Contacts Marketplace app was not available for provider foundation registration.") }
        guard app.sourceType == .externalProvider, app.availability == .available, app.roleManifest.approvalRequired else { throw ServiceGuard.invalidInput(context: context, message: "Google Contacts foundation requires an available Relay-owned Google OAuth contact provider app.") }
        return app
    }

    private func requireGooglePhotosApp(catalog: ApplicationsCatalogSnapshot, context: ServiceRequestContext) throws -> MarketplaceCatalogApp {
        guard let app = catalog.apps.first(where: { $0.slug == "google-photos" }) else { throw ServiceGuard.invalidInput(context: context, message: "Google Photos Marketplace app was not available for provider foundation registration.") }
        guard app.sourceType == .externalProvider, app.availability == .available, app.roleManifest.approvalRequired else { throw ServiceGuard.invalidInput(context: context, message: "Google Photos foundation requires an available Relay-owned Google OAuth Picker provider app.") }
        return app
    }

    private func requireGoogleMeetApp(catalog: ApplicationsCatalogSnapshot, context: ServiceRequestContext) throws -> MarketplaceCatalogApp {
        guard let app = catalog.apps.first(where: { $0.slug == "google-meet" }) else { throw ServiceGuard.invalidInput(context: context, message: "Google Meet Marketplace app was not available for provider foundation registration.") }
        guard app.sourceType == .externalProvider, app.availability == .available, app.roleManifest.approvalRequired else { throw ServiceGuard.invalidInput(context: context, message: "Google Meet foundation requires an available Relay-owned Google OAuth Space provider app.") }
        return app
    }

    private func requireGoogleChatApp(catalog: ApplicationsCatalogSnapshot, context: ServiceRequestContext) throws -> MarketplaceCatalogApp {
        guard let app = catalog.apps.first(where: { $0.slug == "google-chat" }) else { throw ServiceGuard.invalidInput(context: context, message: "Google Chat Marketplace app was not available for provider foundation registration.") }
        guard app.sourceType == .externalProvider, app.availability == .available, app.roleManifest.approvalRequired else { throw ServiceGuard.invalidInput(context: context, message: "Google Chat foundation requires an available Relay-owned Google OAuth user messaging provider app.") }
        return app
    }

    private func requireGoogleAdsApp(catalog: ApplicationsCatalogSnapshot, context: ServiceRequestContext) throws -> MarketplaceCatalogApp {
        guard let app = catalog.apps.first(where: { $0.slug == "google-ads" }) else { throw ServiceGuard.invalidInput(context: context, message: "Google Ads Marketplace app was not available for provider foundation registration.") }
        guard app.sourceType == .externalProvider, app.availability == .available, app.readOnly, !app.roleManifest.approvalRequired else { throw ServiceGuard.invalidInput(context: context, message: "Google Ads foundation requires an available reporting-only Relay-owned provider app.") }
        return app
    }

    private func requireGoogleAnalyticsApp(catalog: ApplicationsCatalogSnapshot, context: ServiceRequestContext) throws -> MarketplaceCatalogApp {
        guard let app = catalog.apps.first(where: { $0.slug == "google-analytics" }) else { throw ServiceGuard.invalidInput(context: context, message: "Google Analytics Marketplace app was not available for provider foundation registration.") }
        guard app.sourceType == .externalProvider, app.availability == .available, app.readOnly, !app.roleManifest.approvalRequired else { throw ServiceGuard.invalidInput(context: context, message: "Google Analytics foundation requires an available read-only Relay-owned provider app.") }; return app
    }

    private func requireGoogleMerchantCenterApp(catalog: ApplicationsCatalogSnapshot, context: ServiceRequestContext) throws -> MarketplaceCatalogApp {
        guard let app = catalog.apps.first(where: { $0.slug == "google-merchant-center" }) else { throw ServiceGuard.invalidInput(context: context, message: "Google Merchant Center Marketplace app was not available for provider foundation registration.") }
        guard app.sourceType == .externalProvider, app.availability == .available, app.readOnly, !app.roleManifest.approvalRequired else { throw ServiceGuard.invalidInput(context: context, message: "Merchant Center foundation requires an available read-only Relay-owned provider app.") }; return app
    }

    private func requireYouTubeApp(catalog: ApplicationsCatalogSnapshot, context: ServiceRequestContext) throws -> MarketplaceCatalogApp {
        guard let app = catalog.apps.first(where: { $0.slug == "youtube" }) else { throw ServiceGuard.invalidInput(context: context, message: "YouTube Marketplace app was not available for provider foundation registration.") }
        guard app.sourceType == .externalProvider, app.availability == .available, app.readOnly, !app.roleManifest.approvalRequired else { throw ServiceGuard.invalidInput(context: context, message: "YouTube foundation requires an available read-only Relay-owned provider app.") }; return app
    }

    private func requireGoogleClassroomApp(catalog: ApplicationsCatalogSnapshot, context: ServiceRequestContext) throws -> MarketplaceCatalogApp {
        guard let app = catalog.apps.first(where: { $0.slug == "google-classroom" }) else { throw ServiceGuard.invalidInput(context: context, message: "Google Classroom Marketplace app was not available for provider foundation registration.") };
        guard app.sourceType == .externalProvider, app.availability == .available, app.readOnly, !app.roleManifest.approvalRequired else { throw ServiceGuard.invalidInput(context: context, message: "Google Classroom foundation requires an available read-only Relay-owned provider app.") }; return app
    }

    private func requireOutlookApp(catalog: ApplicationsCatalogSnapshot, context: ServiceRequestContext) throws -> MarketplaceCatalogApp {
        guard let app = catalog.apps.first(where: { $0.slug == "outlook" }), app.sourceType == .externalProvider, app.availability == .available, app.readOnly, !app.roleManifest.approvalRequired else {
            throw ServiceGuard.invalidInput(context: context, message: "Outlook requires an available read-only Marketplace app.")
        }; return app
    }

    private func requireMicrosoftTeamsApp(catalog: ApplicationsCatalogSnapshot, context: ServiceRequestContext) throws -> MarketplaceCatalogApp {
        guard let app = catalog.apps.first(where: { $0.slug == "microsoft-teams" }), app.sourceType == .externalProvider, app.availability == .available, app.readOnly, !app.roleManifest.approvalRequired else {
            throw ServiceGuard.invalidInput(context: context, message: "Microsoft Teams requires an available read-only Marketplace app.")
        }; return app
    }

    private func requireOneDriveApp(catalog: ApplicationsCatalogSnapshot, context: ServiceRequestContext) throws -> MarketplaceCatalogApp {
        guard let app = catalog.apps.first(where: { $0.slug == "onedrive" }), app.sourceType == .externalProvider, app.availability == .available, app.readOnly, !app.roleManifest.approvalRequired else {
            throw ServiceGuard.invalidInput(context: context, message: "OneDrive requires an available read-only Marketplace app.")
        }; return app
    }
    private func requireSharePointApp(catalog: ApplicationsCatalogSnapshot, context: ServiceRequestContext) throws -> MarketplaceCatalogApp {
        guard let app = catalog.apps.first(where: { $0.slug == "sharepoint" }), app.sourceType == .externalProvider, app.availability == .available, app.readOnly, !app.roleManifest.approvalRequired else {
            throw ServiceGuard.invalidInput(context: context, message: "SharePoint requires an available read-only Marketplace app.")
        }; return app
    }
    private func requireMicrosoftPlannerApp(catalog: ApplicationsCatalogSnapshot, context: ServiceRequestContext) throws -> MarketplaceCatalogApp {
        guard let app = catalog.apps.first(where: { $0.slug == "microsoft-planner" }), app.sourceType == .externalProvider, app.availability == .available, app.readOnly, !app.roleManifest.approvalRequired else {
            throw ServiceGuard.invalidInput(context: context, message: "Microsoft Planner requires an available read-only Marketplace app.")
        }; return app
    }
    private func requireMicrosoftToDoApp(catalog: ApplicationsCatalogSnapshot, context: ServiceRequestContext) throws -> MarketplaceCatalogApp {
        guard let app = catalog.apps.first(where: { $0.slug == "microsoft-to-do" }), app.sourceType == .externalProvider, app.availability == .available, app.readOnly, !app.roleManifest.approvalRequired else {
            throw ServiceGuard.invalidInput(context: context, message: "Microsoft To Do requires an available read-only Marketplace app.")
        }; return app
    }
    private func requireMicrosoftListsApp(catalog: ApplicationsCatalogSnapshot, context: ServiceRequestContext) throws -> MarketplaceCatalogApp {
        guard let app = catalog.apps.first(where: { $0.slug == "microsoft-lists" }), app.sourceType == .externalProvider, app.availability == .available, app.readOnly, !app.roleManifest.approvalRequired else {
            throw ServiceGuard.invalidInput(context: context, message: "Microsoft Lists requires an available read-only Marketplace app.")
        }; return app
    }
    private func requireOneNoteApp(catalog: ApplicationsCatalogSnapshot, context: ServiceRequestContext) throws -> MarketplaceCatalogApp {
        guard let app = catalog.apps.first(where: { $0.slug == "onenote" }), app.sourceType == .externalProvider, app.availability == .available, app.readOnly, !app.roleManifest.approvalRequired else {
            throw ServiceGuard.invalidInput(context: context, message: "OneNote requires an available read-only Marketplace app.")
        }; return app
    }
    private func requireMicrosoftBookingsApp(catalog: ApplicationsCatalogSnapshot, context: ServiceRequestContext) throws -> MarketplaceCatalogApp {
        guard let app = catalog.apps.first(where: { $0.slug == "microsoft-bookings" }), app.sourceType == .externalProvider, app.availability == .available, app.readOnly, !app.roleManifest.approvalRequired else {
            throw ServiceGuard.invalidInput(context: context, message: "Microsoft Bookings requires an available read-only Marketplace app.")
        }; return app
    }
    private func requireMicrosoftPowerBIApp(catalog: ApplicationsCatalogSnapshot, context: ServiceRequestContext) throws -> MarketplaceCatalogApp {
        guard let app = catalog.apps.first(where: { $0.slug == "microsoft-power-bi" }), app.sourceType == .externalProvider, app.availability == .available, app.readOnly, !app.roleManifest.approvalRequired else {
            throw ServiceGuard.invalidInput(context: context, message: "Microsoft Power BI requires an available read-only Marketplace app.")
        }; return app
    }
    private func requireMicrosoftDynamics365App(catalog: ApplicationsCatalogSnapshot, context: ServiceRequestContext) throws -> MarketplaceCatalogApp {
        guard let app = catalog.apps.first(where: { $0.slug == "microsoft-dynamics-365" }), app.sourceType == .externalProvider, app.availability == .available, app.readOnly, !app.roleManifest.approvalRequired else {
            throw ServiceGuard.invalidInput(context: context, message: "Microsoft Dynamics 365 requires an available read-only Marketplace app.")
        }; return app
    }
    private func requireMicrosoftVivaEngageApp(catalog: ApplicationsCatalogSnapshot, context: ServiceRequestContext) throws -> MarketplaceCatalogApp {
        guard let app = catalog.apps.first(where: { $0.slug == "microsoft-viva-engage" }), app.sourceType == .externalProvider, app.availability == .available, app.readOnly, !app.roleManifest.approvalRequired else {
            throw ServiceGuard.invalidInput(context: context, message: "Microsoft Viva Engage requires an available read-only Marketplace app.")
        }; return app
    }
    private func requireZoomApp(catalog: ApplicationsCatalogSnapshot, context: ServiceRequestContext) throws -> MarketplaceCatalogApp {
        guard let app = catalog.apps.first(where: { $0.slug == "zoom" }), app.sourceType == .externalProvider, app.availability == .available, app.readOnly, !app.roleManifest.approvalRequired else {
            throw ServiceGuard.invalidInput(context: context, message: "Zoom requires an available read-only Marketplace app.")
        }; return app
    }
    private func requireDiscordApp(catalog: ApplicationsCatalogSnapshot, context: ServiceRequestContext) throws -> MarketplaceCatalogApp {
        guard let app = catalog.apps.first(where: { $0.slug == "discord" }), app.sourceType == .externalProvider, app.availability == .available, app.readOnly, !app.roleManifest.approvalRequired else {
            throw ServiceGuard.invalidInput(context: context, message: "Discord requires an available read-only Marketplace app.")
        }; return app
    }

    private func requireGoogleSearchConsoleApp(
        catalog: ApplicationsCatalogSnapshot,
        context: ServiceRequestContext
    ) throws -> MarketplaceCatalogApp {
        guard let app = catalog.apps.first(where: { $0.slug == "google-search-console" }) else {
            throw ServiceGuard.invalidInput(context: context, message: "Google Search Console Marketplace app was not available for provider foundation registration.")
        }
        guard app.sourceType == .externalProvider,
              app.availability == .available,
              app.readOnly,
              Set(app.capabilityIds ?? []).isSuperset(
                of: [
                  "properties_list", "property_get", "search_analytics_query", "url_inspect",
                  "sitemaps_list", "sitemap_get",
                ])
        else {
            throw ServiceGuard.invalidInput(context: context, message: "Google Search Console foundation requires an available read-only user-owned Google OAuth provider app.")
        }
        return app
    }

    private func requireNotionApp(
        catalog: ApplicationsCatalogSnapshot,
        context: ServiceRequestContext
    ) throws -> MarketplaceCatalogApp {
        guard let app = catalog.apps.first(where: { $0.slug == "notion" }) else {
            throw ServiceGuard.invalidInput(context: context, message: "Notion Marketplace app was not available for provider foundation registration.")
        }
        guard app.sourceType == .externalProvider,
              app.availability == .available,
              app.roleManifest.approvalRequired
        else {
            throw ServiceGuard.invalidInput(context: context, message: "Notion foundation requires an available user-owned workspace provider app.")
        }
        return app
    }

    private func requireSentryApp(
        catalog: ApplicationsCatalogSnapshot,
        context: ServiceRequestContext
    ) throws -> MarketplaceCatalogApp {
        guard let app = catalog.apps.first(where: { $0.slug == "sentry" }) else {
            throw ServiceGuard.invalidInput(context: context, message: "Sentry Marketplace app was not available for provider foundation registration.")
        }
        guard app.sourceType == .externalProvider,
              app.availability == .available,
              app.roleManifest.approvalRequired
        else {
            throw ServiceGuard.invalidInput(context: context, message: "Sentry foundation requires the available Relay-owned device OAuth observability app.")
        }
        return app
    }

    private func requireMicrosoftClarityApp(
        catalog: ApplicationsCatalogSnapshot,
        context: ServiceRequestContext
    ) throws -> MarketplaceCatalogApp {
        guard let app = catalog.apps.first(where: { $0.slug == "microsoft-clarity" }) else {
            throw ServiceGuard.invalidInput(context: context, message: "Microsoft Clarity Marketplace app was not available for provider foundation registration.")
        }
        guard app.sourceType == .externalProvider,
              app.availability == .available,
              app.authType == "personal_access_token",
              app.credentialRequirements?.contains(where: {
                  $0.name == "microsoft_clarity_api_token" && $0.required && $0.secret
              }) == true
        else {
            throw ServiceGuard.invalidInput(context: context, message: "Microsoft Clarity foundation requires an available user-owned analytics provider app.")
        }
        return app
    }

    private func requirePostHogApp(
        catalog: ApplicationsCatalogSnapshot,
        context: ServiceRequestContext
    ) throws -> MarketplaceCatalogApp {
        guard let app = catalog.apps.first(where: { $0.slug == "posthog" }) else {
            throw ServiceGuard.invalidInput(context: context, message: "PostHog Marketplace app was not available for provider foundation registration.")
        }
        guard app.sourceType == .externalProvider,
              app.availability == .available,
              app.readOnly,
              Set(app.capabilityIds ?? []).isSuperset(
                of: ["projects", "dashboards", "insights", "bounded_query", "schema"])
        else {
            throw ServiceGuard.invalidInput(context: context, message: "PostHog foundation requires an available read-only user-owned analytics provider app.")
        }
        return app
    }

    private func requireTelemetryDeckApp(
        catalog: ApplicationsCatalogSnapshot,
        context: ServiceRequestContext
    ) throws -> MarketplaceCatalogApp {
        guard let app = catalog.apps.first(where: { $0.slug == "telemetrydeck" }) else {
            throw ServiceGuard.invalidInput(context: context, message: "TelemetryDeck Marketplace app was not available for provider foundation registration.")
        }
        guard app.sourceType == .externalProvider,
              app.availability == .available,
              app.authType == "personal_access_token",
              app.credentialRequirements?.contains(where: {
                  $0.name == "telemetrydeck_personal_access_token" && $0.required && $0.secret
              }) == true,
              app.credentialRequirements?.contains(where: {
                  $0.name == "telemetrydeck_namespace" && $0.required && !$0.secret
              }) == true,
              app.credentialRequirements?.contains(where: {
                  $0.name == "telemetrydeck_app_id" && $0.required && !$0.secret
              }) == true
        else {
            throw ServiceGuard.invalidInput(context: context, message: "TelemetryDeck foundation requires an available read-only user-owned analytics provider app.")
        }
        return app
    }

    private func actionFoundation(
        definition: MarketplaceProviderActionDefinition,
        permissionMap: MarketplaceActionPermissionMap
    ) -> MarketplaceProviderActionFoundation {
        let permission = MarketplaceProviderActionPolicyCompilerService.effectivePermission(
            permissionMap.permissions[definition.actionKey] ?? definition.defaultPermission,
            permissionMap: permissionMap
        )
        return MarketplaceProviderActionFoundation(
            id: definition.id,
            actionKey: definition.actionKey,
            displayName: definition.displayName,
            kind: definition.kind,
            riskLevel: definition.riskLevel,
            adapterKind: definition.adapterKind,
            defaultPermission: definition.defaultPermission,
            policyPermission: permission,
            requiredScopes: definition.requiredScopes,
            capabilityKeys: definition.capabilityKeys,
            wrapperToolName: wrapperToolName(definition: definition, permission: permission),
            redactionStatus: "private-state-excluded"
        )
    }

    private func wrapperToolName(
        definition: MarketplaceProviderActionDefinition,
        permission: ProviderActionPermission
    ) -> String? {
        guard permission != .blocked, definition.riskLevel != .destructive else {
            return nil
        }
        switch definition.adapterKind {
        case .unsupported, .manualOnly:
            return nil
        case .officialMCP, .communityMCP, .nativeAPI, .browserAutomation, .localScript:
            return RelayProviderWrapperToolCompilerService.wrapperToolName(appSlug: definition.appSlug, definition: definition)
        }
    }

    private static let xCredentialRequirements: [MarketplaceProviderCredentialFoundation] = [
        MarketplaceProviderCredentialFoundation(
            fieldKey: "x_oauth_access_token",
            label: "X OAuth access token",
            required: true,
            userOwnedRequired: false,
            secretStorage: "keychain-reference-only",
            redactionStatus: "secret-reference-only"
        ),
        MarketplaceProviderCredentialFoundation(
            fieldKey: "x_oauth_refresh_token",
            label: "X OAuth refresh token",
            required: true,
            userOwnedRequired: false,
            secretStorage: "keychain-reference-only",
            redactionStatus: "secret-reference-only"
        ),
        MarketplaceProviderCredentialFoundation(
            fieldKey: "x_connected_account",
            label: "Connected X account",
            required: true,
            userOwnedRequired: false,
            secretStorage: "metadata-only",
            redactionStatus: "private-state-excluded"
        )
    ]

    private static let facebookPagesCredentialRequirements: [MarketplaceProviderCredentialFoundation] = [
        MarketplaceProviderCredentialFoundation(
            fieldKey: "facebook_pages_user_access_token",
            label: "Facebook granting-user access token", required: true,
            userOwnedRequired: false, secretStorage: "keychain-reference-only",
            redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(
            fieldKey: "facebook_pages_page_access_token",
            label: "Facebook selected-Page access token", required: true,
            userOwnedRequired: false, secretStorage: "keychain-reference-only",
            redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(
            fieldKey: "facebook_pages_selected_page",
            label: "Selected Facebook Page", required: true,
            userOwnedRequired: false, secretStorage: "metadata-only",
            redactionStatus: "private-state-excluded"),
    ]

    private static let instagramBusinessCredentialRequirements: [MarketplaceProviderCredentialFoundation] = [
        MarketplaceProviderCredentialFoundation(
            fieldKey: "instagram_business_user_access_token",
            label: "Instagram User access token", required: true,
            userOwnedRequired: false, secretStorage: "keychain-reference-only",
            redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(
            fieldKey: "instagram_business_professional_account",
            label: "Instagram professional account", required: true,
            userOwnedRequired: false, secretStorage: "metadata-only",
            redactionStatus: "private-state-excluded"),
    ]

    private static let threadsCredentialRequirements: [MarketplaceProviderCredentialFoundation] = [
        MarketplaceProviderCredentialFoundation(
            fieldKey: "threads_user_access_token", label: "Threads User access token",
            required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only",
            redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(
            fieldKey: "threads_connected_profile", label: "Connected Threads profile",
            required: true, userOwnedRequired: false, secretStorage: "metadata-only",
            redactionStatus: "private-state-excluded"),
    ]

    private static let mastodonCredentialRequirements: [MarketplaceProviderCredentialFoundation] = [
        MarketplaceProviderCredentialFoundation(
            fieldKey: "mastodon_client_secret", label: "Per-instance Mastodon OAuth client secret",
            required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only",
            redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(
            fieldKey: "mastodon_account_access_token", label: "Bound Mastodon account access token",
            required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only",
            redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(
            fieldKey: "mastodon_verified_instance_account", label: "Verified instance and connected local account",
            required: true, userOwnedRequired: false, secretStorage: "metadata-only",
            redactionStatus: "private-state-excluded"),
    ]

    private static let blueskyCredentialRequirements: [MarketplaceProviderCredentialFoundation] = [
        MarketplaceProviderCredentialFoundation(
            fieldKey: "bluesky_oauth_access_token", label: "Bluesky OAuth access token",
            required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only",
            redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(
            fieldKey: "bluesky_oauth_refresh_token", label: "Bluesky OAuth refresh token",
            required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only",
            redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(
            fieldKey: "bluesky_dpop_private_key", label: "Bluesky DPoP private key",
            required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only",
            redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(
            fieldKey: "bluesky_bound_identity", label: "Verified DID, handle, PDS, and authorization issuer",
            required: true, userOwnedRequired: false, secretStorage: "metadata-only",
            redactionStatus: "private-state-excluded"),
    ]

    private static let nextdoorCredentialRequirements: [MarketplaceProviderCredentialFoundation] = [
        MarketplaceProviderCredentialFoundation(
            fieldKey: "nextdoor_railway_confidential_client", label: "Railway-held Nextdoor confidential client",
            required: true, userOwnedRequired: false, secretStorage: "railway-encrypted-only",
            redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(
            fieldKey: "nextdoor_oauth_token_bundle", label: "Nextdoor OAuth token bundle",
            required: true, userOwnedRequired: false, secretStorage: "railway-encrypted-only",
            redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(
            fieldKey: "nextdoor_selected_profile", label: "Verified selected neighbor or business profile",
            required: true, userOwnedRequired: false, secretStorage: "metadata-only",
            redactionStatus: "private-state-excluded"),
    ]

    private static let meetupCredentialRequirements: [MarketplaceProviderCredentialFoundation] = [
        MarketplaceProviderCredentialFoundation(
            fieldKey: "meetup_railway_confidential_client", label: "Railway-held Meetup OAuth consumer",
            required: true, userOwnedRequired: false, secretStorage: "railway-encrypted-only",
            redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(
            fieldKey: "meetup_oauth_token_bundle", label: "Meetup rotating OAuth token bundle",
            required: true, userOwnedRequired: false, secretStorage: "railway-encrypted-only",
            redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(
            fieldKey: "meetup_connected_member", label: "Verified connected Meetup member",
            required: true, userOwnedRequired: false, secretStorage: "metadata-only",
            redactionStatus: "private-state-excluded"),
    ]

    private static let eventbriteCredentialRequirements: [MarketplaceProviderCredentialFoundation] = [
        MarketplaceProviderCredentialFoundation(
            fieldKey: "eventbrite_railway_confidential_app", label: "Railway-held Eventbrite API application",
            required: true, userOwnedRequired: false, secretStorage: "railway-encrypted-only",
            redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(
            fieldKey: "eventbrite_oauth_access_token", label: "Eventbrite user OAuth token",
            required: true, userOwnedRequired: false, secretStorage: "railway-encrypted-only",
            redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(
            fieldKey: "eventbrite_connected_user", label: "Verified connected Eventbrite user",
            required: true, userOwnedRequired: false, secretStorage: "metadata-only",
            redactionStatus: "private-state-excluded"),
    ]

    private static let lumaCredentialRequirements: [MarketplaceProviderCredentialFoundation] = [
        MarketplaceProviderCredentialFoundation(
            fieldKey: "luma_calendar_api_key", label: "Customer-owned Luma Calendar API key",
            required: true, userOwnedRequired: true, secretStorage: "railway-encrypted-only",
            redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(
            fieldKey: "luma_bound_user", label: "Verified Luma user binding",
            required: true, userOwnedRequired: false, secretStorage: "metadata-only",
            redactionStatus: "private-state-excluded"),
        MarketplaceProviderCredentialFoundation(
            fieldKey: "luma_bound_calendar", label: "Verified Luma Calendar binding",
            required: true, userOwnedRequired: false, secretStorage: "metadata-only",
            redactionStatus: "private-state-excluded"),
    ]

    private static let hopinCredentialRequirements: [MarketplaceProviderCredentialFoundation] = [
        MarketplaceProviderCredentialFoundation(fieldKey: "ringcentral_events_access_token", label: "Customer-owned RingCentral Events OAuth bearer token", required: true, userOwnedRequired: true, secretStorage: "railway-encrypted-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "ringcentral_events_organization_id", label: "Exact RingCentral Events Organization ID", required: true, userOwnedRequired: true, secretStorage: "railway-encrypted-only", redactionStatus: "private-state-excluded"),
        MarketplaceProviderCredentialFoundation(fieldKey: "ringcentral_events_bound_organization", label: "Verified RingCentral Events Organization binding", required: true, userOwnedRequired: false, secretStorage: "metadata-only", redactionStatus: "private-state-excluded"),
    ]

    private static let twistCredentialRequirements: [MarketplaceProviderCredentialFoundation] = [
        MarketplaceProviderCredentialFoundation(
            fieldKey: "twist_railway_general_integration", label: "Railway-held Twist General Integration",
            required: true, userOwnedRequired: false, secretStorage: "railway-encrypted-only",
            redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(
            fieldKey: "twist_oauth_access_token", label: "Twist user OAuth access token",
            required: true, userOwnedRequired: false, secretStorage: "railway-encrypted-only",
            redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(
            fieldKey: "twist_connected_user", label: "Verified connected Twist user",
            required: true, userOwnedRequired: false, secretStorage: "metadata-only",
            redactionStatus: "private-state-excluded"),
    ]

    private static let zohoMailCredentialRequirements: [MarketplaceProviderCredentialFoundation] = [
        MarketplaceProviderCredentialFoundation(
            fieldKey: "zoho_mail_railway_server_client", label: "Railway-held Zoho server OAuth client",
            required: true, userOwnedRequired: false, secretStorage: "railway-encrypted-only",
            redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(
            fieldKey: "zoho_mail_oauth_token_bundle", label: "Zoho Mail offline OAuth token bundle",
            required: true, userOwnedRequired: false, secretStorage: "railway-encrypted-only",
            redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(
            fieldKey: "zoho_mail_regional_account", label: "Verified regional Zoho Mail account",
            required: true, userOwnedRequired: false, secretStorage: "metadata-only",
            redactionStatus: "private-state-excluded"),
    ]

    private static let webexCredentialRequirements: [MarketplaceProviderCredentialFoundation] = [
        MarketplaceProviderCredentialFoundation(
            fieldKey: "webex_railway_confidential_integration", label: "Railway-held Webex Integration",
            required: true, userOwnedRequired: false, secretStorage: "railway-encrypted-only",
            redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(
            fieldKey: "webex_oauth_token_bundle", label: "Webex rotating OAuth token bundle",
            required: true, userOwnedRequired: false, secretStorage: "railway-encrypted-only",
            redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(
            fieldKey: "webex_connected_person", label: "Verified connected Webex Person",
            required: true, userOwnedRequired: false, secretStorage: "metadata-only",
            redactionStatus: "private-state-excluded"),
    ]

    private static let goToMeetingCredentialRequirements: [MarketplaceProviderCredentialFoundation] = [
        MarketplaceProviderCredentialFoundation(
            fieldKey: "goto_meeting_railway_confidential_client", label: "Railway-held GoTo Meeting OAuth client",
            required: true, userOwnedRequired: false, secretStorage: "railway-encrypted-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(
            fieldKey: "goto_meeting_oauth_token_bundle", label: "GoTo one-hour access and conditionally rotating refresh token bundle",
            required: true, userOwnedRequired: false, secretStorage: "railway-encrypted-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(
            fieldKey: "goto_meeting_connected_organizer", label: "Verified connected GoTo organizer",
            required: true, userOwnedRequired: false, secretStorage: "metadata-only", redactionStatus: "private-state-excluded"),
    ]

    private static let ringCentralCredentialRequirements: [MarketplaceProviderCredentialFoundation] = [
        MarketplaceProviderCredentialFoundation(
            fieldKey: "ringcentral_railway_oauth_client", label: "Railway-held RingCentral OAuth client",
            required: true, userOwnedRequired: false, secretStorage: "railway-encrypted-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(
            fieldKey: "ringcentral_rotating_token_bundle", label: "RingCentral rotating OAuth token bundle",
            required: true, userOwnedRequired: false, secretStorage: "railway-encrypted-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(
            fieldKey: "ringcentral_connected_extension", label: "Verified connected RingCentral extension",
            required: true, userOwnedRequired: false, secretStorage: "metadata-only", redactionStatus: "private-state-excluded"),
    ]

    private static let dialpadCredentialRequirements: [MarketplaceProviderCredentialFoundation] = [
        MarketplaceProviderCredentialFoundation(fieldKey: "dialpad_railway_oauth_client", label: "Railway-held Dialpad OAuth client", required: true, userOwnedRequired: false, secretStorage: "railway-encrypted-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "dialpad_rotating_token_bundle", label: "Dialpad rotating OAuth token bundle", required: true, userOwnedRequired: false, secretStorage: "railway-encrypted-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "dialpad_connected_user", label: "Verified connected Dialpad user", required: true, userOwnedRequired: false, secretStorage: "metadata-only", redactionStatus: "private-state-excluded"),
    ]

    private static let aircallCredentialRequirements: [MarketplaceProviderCredentialFoundation] = [
        MarketplaceProviderCredentialFoundation(fieldKey: "aircall_railway_oauth_client", label: "Railway-held Aircall OAuth client", required: true, userOwnedRequired: false, secretStorage: "railway-encrypted-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "aircall_nonexpiring_access_token", label: "Aircall non-expiring OAuth access token", required: true, userOwnedRequired: false, secretStorage: "railway-encrypted-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "aircall_connected_company", label: "Verified active Aircall integration and company binding", required: true, userOwnedRequired: false, secretStorage: "metadata-only", redactionStatus: "private-state-excluded"),
    ]

    private static let openPhoneCredentialRequirements: [MarketplaceProviderCredentialFoundation] = [
        MarketplaceProviderCredentialFoundation(fieldKey: "openphone_workspace_api_key", label: "Customer-owned full-access Quo workspace API key", required: true, userOwnedRequired: true, secretStorage: "railway-encrypted-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "openphone_manual_revocation", label: "Manual Quo Workspace Settings key deletion", required: true, userOwnedRequired: true, secretStorage: "external-provider-control", redactionStatus: "manual-revocation-required"),
    ]

    private static let lineCredentialRequirements: [MarketplaceProviderCredentialFoundation] = [
        MarketplaceProviderCredentialFoundation(fieldKey: "line_railway_login_channel", label: "Railway-held LINE Login channel", required: true, userOwnedRequired: false, secretStorage: "railway-encrypted-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "line_rotating_token_bundle", label: "LINE rotating OAuth token bundle", required: true, userOwnedRequired: false, secretStorage: "railway-encrypted-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "line_oidc_bound_profile", label: "Verified OIDC-bound LINE profile", required: true, userOwnedRequired: false, secretStorage: "metadata-only", redactionStatus: "private-state-excluded"),
    ]

    private static let twilioCredentialRequirements: [MarketplaceProviderCredentialFoundation] = [
        MarketplaceProviderCredentialFoundation(fieldKey: "twilio_account_sid", label: "Exact Twilio Account SID", required: true, userOwnedRequired: true, secretStorage: "railway-encrypted-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "twilio_restricted_api_key_sid", label: "Customer-owned Restricted API Key SID", required: true, userOwnedRequired: true, secretStorage: "railway-encrypted-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "twilio_restricted_api_key_secret", label: "Customer-owned Restricted API Key secret", required: true, userOwnedRequired: true, secretStorage: "railway-encrypted-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "twilio_manual_revocation", label: "Manual Twilio Console key deletion", required: true, userOwnedRequired: true, secretStorage: "external-provider-control", redactionStatus: "manual-revocation-required"),
    ]

    private static let vonageCredentialRequirements: [MarketplaceProviderCredentialFoundation] = [
        MarketplaceProviderCredentialFoundation(fieldKey: "vonage_api_key", label: "Customer-owned Vonage Communications APIs key", required: true, userOwnedRequired: true, secretStorage: "railway-encrypted-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "vonage_dedicated_secondary_api_secret", label: "Dedicated secondary Vonage API secret", required: true, userOwnedRequired: true, secretStorage: "railway-encrypted-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "vonage_manual_revocation", label: "Manual Vonage Dashboard secondary-secret revocation", required: true, userOwnedRequired: true, secretStorage: "external-provider-control", redactionStatus: "manual-revocation-required"),
    ]

    private static let messageBirdCredentialRequirements: [MarketplaceProviderCredentialFoundation] = [
        MarketplaceProviderCredentialFoundation(fieldKey: "messagebird_organization_id", label: "Selected Bird organization UUID", required: true, userOwnedRequired: true, secretStorage: "railway-encrypted-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "messagebird_workspace_id", label: "Selected Bird workspace UUID", required: true, userOwnedRequired: true, secretStorage: "railway-encrypted-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "messagebird_dedicated_access_key", label: "Dedicated role-bound Bird AccessKey", required: true, userOwnedRequired: true, secretStorage: "railway-encrypted-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "messagebird_manual_revocation", label: "Manual Bird Security access-key deletion", required: true, userOwnedRequired: true, secretStorage: "external-provider-control", redactionStatus: "manual-revocation-required"),
    ]

    private static let fredCredentialRequirements: [MarketplaceProviderCredentialFoundation] = [
        MarketplaceProviderCredentialFoundation(fieldKey: "fred_customer_api_key", label: "Customer-owned 32-character FRED API key", required: true, userOwnedRequired: true, secretStorage: "railway-encrypted-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "fred_manual_revocation", label: "Manual FRED account key replacement or revocation", required: true, userOwnedRequired: true, secretStorage: "external-provider-control", redactionStatus: "manual-revocation-required"),
    ]

    private static let apolloGraphOSCredentialRequirements: [MarketplaceProviderCredentialFoundation] = [
        MarketplaceProviderCredentialFoundation(fieldKey: "apollo_graphos_graph_api_key", label: "Dedicated customer-owned graph-scoped Consumer or Observer API key", required: true, userOwnedRequired: true, secretStorage: "railway-encrypted-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "apollo_graphos_graph_id", label: "Exact Apollo GraphOS graph ID", required: true, userOwnedRequired: true, secretStorage: "railway-encrypted-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "apollo_graphos_variant", label: "Exact Apollo GraphOS graph variant", required: true, userOwnedRequired: true, secretStorage: "railway-encrypted-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "apollo_graphos_manual_revocation", label: "Manual GraphOS Studio graph-key deletion", required: true, userOwnedRequired: true, secretStorage: "external-provider-control", redactionStatus: "manual-revocation-required"),
    ]

    private static let hunterCredentialRequirements: [MarketplaceProviderCredentialFoundation] = [
        MarketplaceProviderCredentialFoundation(fieldKey: "hunter_dedicated_api_key", label: "Dedicated customer-owned Hunter API key", required: true, userOwnedRequired: true, secretStorage: "railway-encrypted-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "hunter_manual_revocation", label: "Manual Hunter API-key deletion", required: true, userOwnedRequired: true, secretStorage: "external-provider-control", redactionStatus: "manual-revocation-required"),
        MarketplaceProviderCredentialFoundation(fieldKey: "hunter_lawful_business_purpose", label: "Customer responsibility for lawful business-email processing", required: true, userOwnedRequired: true, secretStorage: "external-legal-control", redactionStatus: "customer-attestation-required"),
    ]

    private static let snovCredentialRequirements: [MarketplaceProviderCredentialFoundation] = [
        MarketplaceProviderCredentialFoundation(fieldKey: "snov_api_user_id", label: "Dedicated customer-owned Snov.io API User ID", required: true, userOwnedRequired: true, secretStorage: "railway-encrypted-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "snov_api_secret", label: "Dedicated customer-owned Snov.io API Secret", required: true, userOwnedRequired: true, secretStorage: "railway-encrypted-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "snov_manual_rotation", label: "Manual Snov.io API Secret rotation after disconnect", required: true, userOwnedRequired: true, secretStorage: "external-provider-control", redactionStatus: "manual-revocation-required"),
        MarketplaceProviderCredentialFoundation(fieldKey: "snov_lawful_business_purpose", label: "Customer responsibility for lawful business-email processing", required: true, userOwnedRequired: true, secretStorage: "external-legal-control", redactionStatus: "customer-attestation-required"),
    ]

    private static let lushaCredentialRequirements: [MarketplaceProviderCredentialFoundation] = [
        MarketplaceProviderCredentialFoundation(fieldKey: "lusha_api_key", label: "Dedicated customer-owned Lusha API key", required: true, userOwnedRequired: true, secretStorage: "railway-encrypted-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "lusha_plan_and_role", label: "Eligible Lusha plan and authorized Admin or Manager", required: true, userOwnedRequired: true, secretStorage: "external-provider-control", redactionStatus: "provider-eligibility-required"),
        MarketplaceProviderCredentialFoundation(fieldKey: "lusha_manual_rotation", label: "Manual Lusha API-key rotation after disconnect", required: true, userOwnedRequired: true, secretStorage: "external-provider-control", redactionStatus: "manual-revocation-required"),
        MarketplaceProviderCredentialFoundation(fieldKey: "lusha_terms_review", label: "Current Lusha API terms and privacy review", required: true, userOwnedRequired: true, secretStorage: "external-legal-control", redactionStatus: "customer-review-required"),
    ]

    private static let leadIQCredentialRequirements: [MarketplaceProviderCredentialFoundation] = [
        MarketplaceProviderCredentialFoundation(fieldKey: "leadiq_api_key", label: "Dedicated customer-owned LeadIQ Base64 API key", required: true, userOwnedRequired: true, secretStorage: "railway-encrypted-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "leadiq_account_and_api_access", label: "Active LeadIQ account with API entitlement", required: true, userOwnedRequired: true, secretStorage: "external-provider-control", redactionStatus: "provider-eligibility-required"),
        MarketplaceProviderCredentialFoundation(fieldKey: "leadiq_manual_rotation", label: "Manual LeadIQ API-key rotation after disconnect", required: true, userOwnedRequired: true, secretStorage: "external-provider-control", redactionStatus: "manual-revocation-required"),
        MarketplaceProviderCredentialFoundation(fieldKey: "leadiq_terms_review", label: "Current LeadIQ terms and privacy review", required: true, userOwnedRequired: true, secretStorage: "external-legal-control", redactionStatus: "customer-review-required"),
    ]

    private static let seamlessAICredentialRequirements: [MarketplaceProviderCredentialFoundation] = [
        MarketplaceProviderCredentialFoundation(fieldKey: "seamless_api_key", label: "Dedicated customer-owned Seamless.AI Public API v1 key", required: true, userOwnedRequired: true, secretStorage: "railway-encrypted-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "seamless_account_and_public_api", label: "Seamless.AI account with Public API v1 access", required: true, userOwnedRequired: true, secretStorage: "external-provider-control", redactionStatus: "provider-eligibility-required"),
        MarketplaceProviderCredentialFoundation(fieldKey: "seamless_permitted_b2b_purpose", label: "Customer-confirmed permitted B2B purpose and privacy duties", required: true, userOwnedRequired: true, secretStorage: "external-legal-control", redactionStatus: "customer-attestation-required"),
        MarketplaceProviderCredentialFoundation(fieldKey: "seamless_manual_rotation", label: "Manual Seamless.AI API-key rotation after disconnect", required: true, userOwnedRequired: true, secretStorage: "external-provider-control", redactionStatus: "manual-revocation-required"),
    ]

    private static let rocketReachCredentialRequirements: [MarketplaceProviderCredentialFoundation] = [
        MarketplaceProviderCredentialFoundation(fieldKey: "rocketreach_api_key", label: "Dedicated customer-owned RocketReach API key", required: true, userOwnedRequired: true, secretStorage: "railway-encrypted-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "rocketreach_account_and_api_access", label: "Active RocketReach account with API entitlement", required: true, userOwnedRequired: true, secretStorage: "external-provider-control", redactionStatus: "provider-eligibility-required"),
        MarketplaceProviderCredentialFoundation(fieldKey: "rocketreach_manual_rotation", label: "Manual RocketReach API-key rotation after disconnect", required: true, userOwnedRequired: true, secretStorage: "external-provider-control", redactionStatus: "manual-revocation-required"),
        MarketplaceProviderCredentialFoundation(fieldKey: "rocketreach_terms_review", label: "Current RocketReach terms and privacy review", required: true, userOwnedRequired: true, secretStorage: "external-legal-control", redactionStatus: "customer-review-required"),
    ]

    private static let upLeadCredentialRequirements: [MarketplaceProviderCredentialFoundation] = [
        MarketplaceProviderCredentialFoundation(fieldKey: "uplead_api_key", label: "Dedicated customer-owned UpLead API key", required: true, userOwnedRequired: true, secretStorage: "railway-encrypted-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "uplead_account_and_api_access", label: "Active UpLead account with API entitlement", required: true, userOwnedRequired: true, secretStorage: "external-provider-control", redactionStatus: "provider-eligibility-required"),
        MarketplaceProviderCredentialFoundation(fieldKey: "uplead_manual_rotation", label: "Manual UpLead API-key rotation after disconnect", required: true, userOwnedRequired: true, secretStorage: "external-provider-control", redactionStatus: "manual-revocation-required"),
        MarketplaceProviderCredentialFoundation(fieldKey: "uplead_terms_review", label: "Current UpLead terms and privacy review", required: true, userOwnedRequired: true, secretStorage: "external-legal-control", redactionStatus: "customer-review-required"),
    ]

    private static let wizaCredentialRequirements: [MarketplaceProviderCredentialFoundation] = [
        MarketplaceProviderCredentialFoundation(fieldKey: "wiza_api_key", label: "Dedicated customer-owned Wiza API key", required: true, userOwnedRequired: true, secretStorage: "railway-encrypted-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "wiza_account_and_api_access", label: "Active Wiza account with API entitlement", required: true, userOwnedRequired: true, secretStorage: "external-provider-control", redactionStatus: "provider-eligibility-required"),
        MarketplaceProviderCredentialFoundation(fieldKey: "wiza_manual_rotation", label: "Manual Wiza API-key rotation after disconnect", required: true, userOwnedRequired: true, secretStorage: "external-provider-control", redactionStatus: "manual-revocation-required"),
        MarketplaceProviderCredentialFoundation(fieldKey: "wiza_terms_review", label: "Current Wiza terms and privacy review", required: true, userOwnedRequired: true, secretStorage: "external-legal-control", redactionStatus: "customer-review-required"),
    ]

    private static let pinterestCredentialRequirements: [MarketplaceProviderCredentialFoundation] = [
        MarketplaceProviderCredentialFoundation(
            fieldKey: "pinterest_oauth_access_token", label: "Pinterest OAuth access token",
            required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only",
            redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(
            fieldKey: "pinterest_oauth_refresh_token", label: "Pinterest continuous refresh token",
            required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only",
            redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(
            fieldKey: "pinterest_connected_user_account", label: "Connected Pinterest user account",
            required: true, userOwnedRequired: false, secretStorage: "metadata-only",
            redactionStatus: "private-state-excluded"),
    ]

    private static let tumblrCredentialRequirements: [MarketplaceProviderCredentialFoundation] = [
        MarketplaceProviderCredentialFoundation(
            fieldKey: "tumblr_oauth_access_token", label: "Tumblr OAuth access token",
            required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only",
            redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(
            fieldKey: "tumblr_oauth_refresh_token", label: "Tumblr OAuth refresh token",
            required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only",
            redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(
            fieldKey: "tumblr_connected_account_blog",
            label: "Connected Tumblr account and selected owned blog",
            required: true, userOwnedRequired: false, secretStorage: "metadata-only",
            redactionStatus: "private-state-excluded"),
    ]

    private static let linkedInCredentialRequirements: [MarketplaceProviderCredentialFoundation] = [
        MarketplaceProviderCredentialFoundation(fieldKey: "linkedin_oauth_access_token", label: "LinkedIn OAuth access token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "linkedin_connected_member", label: "Connected LinkedIn member", required: true, userOwnedRequired: false, secretStorage: "metadata-only", redactionStatus: "private-state-excluded"),
    ]

    private static let exaSearchCredentialRequirements: [MarketplaceProviderCredentialFoundation] = [
        MarketplaceProviderCredentialFoundation(
            fieldKey: "exa_api_key",
            label: "Exa API key",
            required: true,
            userOwnedRequired: true,
            secretStorage: "keychain-reference-only",
            redactionStatus: "secret-reference-only"
        )
    ]

    private static let gmailCredentialRequirements: [MarketplaceProviderCredentialFoundation] = [
        MarketplaceProviderCredentialFoundation(
            fieldKey: "google_oauth_refresh_token",
            label: "Google OAuth refresh token",
            required: true,
            userOwnedRequired: false,
            secretStorage: "keychain-reference-only",
            redactionStatus: "secret-reference-only"
        ),
        MarketplaceProviderCredentialFoundation(
            fieldKey: "google_oauth_access_token",
            label: "Google OAuth access token",
            required: true,
            userOwnedRequired: false,
            secretStorage: "keychain-reference-only",
            redactionStatus: "secret-reference-only"
        ),
        MarketplaceProviderCredentialFoundation(
            fieldKey: "gmail_google_account",
            label: "Authorized Gmail account",
            required: true,
            userOwnedRequired: false,
            secretStorage: "metadata-only",
            redactionStatus: "private-state-excluded"
        )
    ]

    private static let googleDocsCredentialRequirements: [MarketplaceProviderCredentialFoundation] = [
        MarketplaceProviderCredentialFoundation(
            fieldKey: "google_docs_oauth_access_token",
            label: "Google Docs OAuth access token",
            required: true,
            userOwnedRequired: false,
            secretStorage: "keychain-reference-only",
            redactionStatus: "secret-reference-only"
        ),
        MarketplaceProviderCredentialFoundation(
            fieldKey: "google_docs_oauth_refresh_token",
            label: "Google Docs OAuth refresh token",
            required: true,
            userOwnedRequired: false,
            secretStorage: "keychain-reference-only",
            redactionStatus: "secret-reference-only"
        ),
        MarketplaceProviderCredentialFoundation(
            fieldKey: "google_docs_account",
            label: "Authorized Google Docs account",
            required: true,
            userOwnedRequired: false,
            secretStorage: "metadata-only",
            redactionStatus: "private-state-excluded"
        )
    ]

    private static let googleTasksCredentialRequirements: [MarketplaceProviderCredentialFoundation] = [
        MarketplaceProviderCredentialFoundation(fieldKey: "google_tasks_oauth_access_token", label: "Google Tasks OAuth access token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "google_tasks_oauth_refresh_token", label: "Google Tasks OAuth refresh token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "google_tasks_account", label: "Authorized Google Tasks account", required: true, userOwnedRequired: false, secretStorage: "metadata-only", redactionStatus: "private-state-excluded")
    ]

    private static let googleContactsCredentialRequirements: [MarketplaceProviderCredentialFoundation] = [
        MarketplaceProviderCredentialFoundation(fieldKey: "google_contacts_oauth_access_token", label: "Google Contacts OAuth access token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "google_contacts_oauth_refresh_token", label: "Google Contacts OAuth refresh token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "google_contacts_account", label: "Authorized Google Contacts account", required: true, userOwnedRequired: false, secretStorage: "metadata-only", redactionStatus: "private-state-excluded")
    ]

    private static let googlePhotosCredentialRequirements: [MarketplaceProviderCredentialFoundation] = [
        MarketplaceProviderCredentialFoundation(fieldKey: "google_photos_oauth_access_token", label: "Google Photos OAuth access token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "google_photos_oauth_refresh_token", label: "Google Photos OAuth refresh token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "google_photos_account", label: "Authorized Google Photos Picker account", required: true, userOwnedRequired: false, secretStorage: "metadata-only", redactionStatus: "private-state-excluded")
    ]

    private static let googleMeetCredentialRequirements: [MarketplaceProviderCredentialFoundation] = [
        MarketplaceProviderCredentialFoundation(fieldKey: "google_meet_oauth_access_token", label: "Google Meet OAuth access token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "google_meet_oauth_refresh_token", label: "Google Meet OAuth refresh token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "google_meet_account", label: "Authorized Google Meet account", required: true, userOwnedRequired: false, secretStorage: "metadata-only", redactionStatus: "private-state-excluded")
    ]

    private static let googleChatCredentialRequirements: [MarketplaceProviderCredentialFoundation] = [
        MarketplaceProviderCredentialFoundation(fieldKey: "google_chat_oauth_access_token", label: "Google Chat OAuth access token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "google_chat_oauth_refresh_token", label: "Google Chat OAuth refresh token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "google_chat_account", label: "Authorized Google Chat account", required: true, userOwnedRequired: false, secretStorage: "metadata-only", redactionStatus: "private-state-excluded")
    ]

    private static let googleAdsCredentialRequirements: [MarketplaceProviderCredentialFoundation] = [
        MarketplaceProviderCredentialFoundation(fieldKey: "google_ads_oauth_access_token", label: "Google Ads OAuth access token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "google_ads_oauth_refresh_token", label: "Google Ads OAuth refresh token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "google_ads_developer_token", label: "Google Ads developer token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "google_ads_customer", label: "Authorized Google Ads customer", required: true, userOwnedRequired: false, secretStorage: "metadata-only", redactionStatus: "private-state-excluded")
    ]

    private static let googleAnalyticsCredentialRequirements: [MarketplaceProviderCredentialFoundation] = [
        MarketplaceProviderCredentialFoundation(fieldKey: "google_analytics_oauth_access_token", label: "Google Analytics OAuth access token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "google_analytics_oauth_refresh_token", label: "Google Analytics OAuth refresh token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "google_analytics_property", label: "Selected GA4 property", required: true, userOwnedRequired: false, secretStorage: "metadata-only", redactionStatus: "private-state-excluded")
    ]

    private static let googleMerchantCenterCredentialRequirements: [MarketplaceProviderCredentialFoundation] = [
        MarketplaceProviderCredentialFoundation(fieldKey: "google_merchant_center_oauth_access_token", label: "Merchant Center OAuth access token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "google_merchant_center_oauth_refresh_token", label: "Merchant Center OAuth refresh token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "google_merchant_center_account", label: "Selected Merchant Center account", required: true, userOwnedRequired: false, secretStorage: "metadata-only", redactionStatus: "private-state-excluded")
    ]

    private static let youTubeCredentialRequirements: [MarketplaceProviderCredentialFoundation] = [
        MarketplaceProviderCredentialFoundation(fieldKey: "youtube_oauth_access_token", label: "YouTube OAuth access token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "youtube_oauth_refresh_token", label: "YouTube OAuth refresh token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "youtube_channel", label: "Connected YouTube channel", required: true, userOwnedRequired: false, secretStorage: "metadata-only", redactionStatus: "private-state-excluded")
    ]

    private static let googleClassroomCredentialRequirements: [MarketplaceProviderCredentialFoundation] = [
        MarketplaceProviderCredentialFoundation(fieldKey: "google_classroom_oauth_access_token", label: "Google Classroom OAuth access token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "google_classroom_oauth_refresh_token", label: "Google Classroom OAuth refresh token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "google_classroom_account", label: "Connected Classroom account", required: true, userOwnedRequired: false, secretStorage: "metadata-only", redactionStatus: "private-state-excluded")
    ]

    private static let outlookCredentialRequirements: [MarketplaceProviderCredentialFoundation] = [
        MarketplaceProviderCredentialFoundation(fieldKey: "outlook_oauth_access_token", label: "Outlook OAuth access token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "outlook_oauth_refresh_token", label: "Outlook OAuth refresh token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "outlook_account", label: "Signed-in Outlook mailbox", required: true, userOwnedRequired: false, secretStorage: "metadata-only", redactionStatus: "private-state-excluded"),
    ]

    private static let microsoftTeamsCredentialRequirements: [MarketplaceProviderCredentialFoundation] = [
        MarketplaceProviderCredentialFoundation(fieldKey: "microsoft_teams_oauth_access_token", label: "Microsoft Teams OAuth access token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "microsoft_teams_oauth_refresh_token", label: "Microsoft Teams OAuth refresh token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "microsoft_teams_account", label: "Signed-in Teams work account", required: true, userOwnedRequired: false, secretStorage: "metadata-only", redactionStatus: "private-state-excluded"),
    ]

    private static let oneDriveCredentialRequirements: [MarketplaceProviderCredentialFoundation] = [
        MarketplaceProviderCredentialFoundation(fieldKey: "onedrive_oauth_access_token", label: "OneDrive OAuth access token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "onedrive_oauth_refresh_token", label: "OneDrive OAuth refresh token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "onedrive_account", label: "Signed-in OneDrive account", required: true, userOwnedRequired: false, secretStorage: "metadata-only", redactionStatus: "private-state-excluded"),
    ]
    private static let sharePointCredentialRequirements: [MarketplaceProviderCredentialFoundation] = [
        MarketplaceProviderCredentialFoundation(fieldKey: "sharepoint_oauth_access_token", label: "SharePoint OAuth access token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "sharepoint_oauth_refresh_token", label: "SharePoint OAuth refresh token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "sharepoint_site", label: "Administrator-granted SharePoint site", required: true, userOwnedRequired: false, secretStorage: "metadata-only", redactionStatus: "private-state-excluded"),
    ]
    private static let microsoftPlannerCredentialRequirements: [MarketplaceProviderCredentialFoundation] = [
        MarketplaceProviderCredentialFoundation(fieldKey: "microsoft_planner_oauth_access_token", label: "Planner OAuth access token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "microsoft_planner_oauth_refresh_token", label: "Planner OAuth refresh token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "microsoft_planner_account", label: "Signed-in Planner work or school account", required: true, userOwnedRequired: false, secretStorage: "metadata-only", redactionStatus: "private-state-excluded"),
    ]
    private static let microsoftToDoCredentialRequirements: [MarketplaceProviderCredentialFoundation] = [
        MarketplaceProviderCredentialFoundation(fieldKey: "microsoft_todo_oauth_access_token", label: "Microsoft To Do OAuth access token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "microsoft_todo_oauth_refresh_token", label: "Microsoft To Do OAuth refresh token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "microsoft_todo_account", label: "Signed-in Microsoft To Do account", required: true, userOwnedRequired: false, secretStorage: "metadata-only", redactionStatus: "private-state-excluded"),
    ]
    private static let microsoftListsCredentialRequirements: [MarketplaceProviderCredentialFoundation] = [
        MarketplaceProviderCredentialFoundation(fieldKey: "microsoft_lists_oauth_access_token", label: "Microsoft Lists OAuth access token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "microsoft_lists_oauth_refresh_token", label: "Microsoft Lists OAuth refresh token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "microsoft_lists_selected_list", label: "Administrator-granted Microsoft List and allowed fields", required: true, userOwnedRequired: false, secretStorage: "metadata-only", redactionStatus: "private-state-excluded"),
    ]
    private static let oneNoteCredentialRequirements: [MarketplaceProviderCredentialFoundation] = [
        MarketplaceProviderCredentialFoundation(fieldKey: "onenote_oauth_access_token", label: "OneNote OAuth access token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "onenote_oauth_refresh_token", label: "OneNote OAuth refresh token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "onenote_account", label: "Signed-in OneNote account", required: true, userOwnedRequired: false, secretStorage: "metadata-only", redactionStatus: "private-state-excluded"),
    ]
    private static let microsoftBookingsCredentialRequirements: [MarketplaceProviderCredentialFoundation] = [
        MarketplaceProviderCredentialFoundation(fieldKey: "microsoft_bookings_oauth_access_token", label: "Microsoft Bookings OAuth access token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "microsoft_bookings_oauth_refresh_token", label: "Microsoft Bookings OAuth refresh token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "microsoft_bookings_selected_business", label: "Selected Microsoft Bookings business", required: true, userOwnedRequired: false, secretStorage: "metadata-only", redactionStatus: "private-state-excluded"),
    ]
    private static let microsoftPowerBICredentialRequirements: [MarketplaceProviderCredentialFoundation] = [
        MarketplaceProviderCredentialFoundation(fieldKey: "microsoft_power_bi_oauth_access_token", label: "Microsoft Power BI OAuth access token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "microsoft_power_bi_oauth_refresh_token", label: "Microsoft Power BI OAuth refresh token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "microsoft_power_bi_selected_workspace", label: "Selected Power BI workspace", required: true, userOwnedRequired: false, secretStorage: "metadata-only", redactionStatus: "private-state-excluded"),
    ]
    private static let microsoftDynamics365CredentialRequirements: [MarketplaceProviderCredentialFoundation] = [
        MarketplaceProviderCredentialFoundation(fieldKey: "microsoft_dynamics_365_oauth_access_token", label: "Dynamics 365 OAuth access token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "microsoft_dynamics_365_oauth_refresh_token", label: "Dynamics 365 OAuth refresh token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "microsoft_dynamics_365_selected_environment", label: "Selected Dataverse environment", required: true, userOwnedRequired: false, secretStorage: "metadata-only", redactionStatus: "private-state-excluded"),
    ]
    private static let microsoftVivaEngageCredentialRequirements: [MarketplaceProviderCredentialFoundation] = [
        MarketplaceProviderCredentialFoundation(fieldKey: "microsoft_viva_engage_oauth_access_token", label: "Viva Engage OAuth access token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "microsoft_viva_engage_oauth_refresh_token", label: "Viva Engage OAuth refresh token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "microsoft_viva_engage_selected_community", label: "Selected Viva Engage community", required: true, userOwnedRequired: false, secretStorage: "metadata-only", redactionStatus: "private-state-excluded"),
    ]
    private static let zoomCredentialRequirements: [MarketplaceProviderCredentialFoundation] = [
        MarketplaceProviderCredentialFoundation(fieldKey: "zoom_oauth_access_token", label: "Zoom OAuth access token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "zoom_oauth_refresh_token", label: "Zoom OAuth refresh token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "zoom_user_account", label: "Connected Zoom user", required: true, userOwnedRequired: false, secretStorage: "metadata-only", redactionStatus: "private-state-excluded"),
    ]
    private static let discordCredentialRequirements: [MarketplaceProviderCredentialFoundation] = [
        MarketplaceProviderCredentialFoundation(fieldKey: "discord_bot_token", label: "Discord bot token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "discord_selected_channel", label: "Selected Discord guild and channel", required: true, userOwnedRequired: false, secretStorage: "metadata-only", redactionStatus: "private-state-excluded"),
    ]

    private static let googleFormsCredentialRequirements: [MarketplaceProviderCredentialFoundation] = [
        MarketplaceProviderCredentialFoundation(fieldKey: "google_forms_oauth_access_token", label: "Google Forms OAuth access token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "google_forms_oauth_refresh_token", label: "Google Forms OAuth refresh token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "google_forms_account", label: "Authorized Google Forms account and app-visible corpus", required: true, userOwnedRequired: false, secretStorage: "metadata-only", redactionStatus: "private-state-excluded")
    ]

    private static let googleSlidesCredentialRequirements: [MarketplaceProviderCredentialFoundation] = [
        MarketplaceProviderCredentialFoundation(fieldKey: "google_slides_oauth_access_token", label: "Google Slides OAuth access token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "google_slides_oauth_refresh_token", label: "Google Slides OAuth refresh token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "google_slides_account", label: "Authorized Google Slides account and app-visible corpus", required: true, userOwnedRequired: false, secretStorage: "metadata-only", redactionStatus: "private-state-excluded")
    ]

    private static let googleSheetsCredentialRequirements: [MarketplaceProviderCredentialFoundation] = [
        MarketplaceProviderCredentialFoundation(fieldKey: "google_sheets_oauth_access_token", label: "Google Sheets OAuth access token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "google_sheets_oauth_refresh_token", label: "Google Sheets OAuth refresh token", required: true, userOwnedRequired: false, secretStorage: "keychain-reference-only", redactionStatus: "secret-reference-only"),
        MarketplaceProviderCredentialFoundation(fieldKey: "google_sheets_account", label: "Authorized Google Sheets account and app-visible corpus", required: true, userOwnedRequired: false, secretStorage: "metadata-only", redactionStatus: "private-state-excluded")
    ]

    private static let googleDriveCredentialRequirements: [MarketplaceProviderCredentialFoundation] = [
        MarketplaceProviderCredentialFoundation(
            fieldKey: "google_drive_oauth_access_token",
            label: "Google Drive OAuth access token",
            required: true,
            userOwnedRequired: false,
            secretStorage: "keychain-reference-only",
            redactionStatus: "secret-reference-only"
        ),
        MarketplaceProviderCredentialFoundation(
            fieldKey: "google_drive_oauth_refresh_token",
            label: "Google Drive OAuth refresh token",
            required: true,
            userOwnedRequired: false,
            secretStorage: "keychain-reference-only",
            redactionStatus: "secret-reference-only"
        ),
        MarketplaceProviderCredentialFoundation(
            fieldKey: "google_drive_account",
            label: "Authorized Google Drive account and app-visible corpus",
            required: true,
            userOwnedRequired: false,
            secretStorage: "metadata-only",
            redactionStatus: "private-state-excluded"
        )
    ]

    private static let googleSearchConsoleCredentialRequirements: [MarketplaceProviderCredentialFoundation] = [
        MarketplaceProviderCredentialFoundation(
            fieldKey: "google_search_console_oauth_client_id",
            label: "Google OAuth client ID",
            required: true,
            userOwnedRequired: false,
            secretStorage: "keychain-reference-only",
            redactionStatus: "secret-reference-only"
        ),
        MarketplaceProviderCredentialFoundation(
            fieldKey: "google_search_console_oauth_client_secret",
            label: "Google OAuth client secret",
            required: true,
            userOwnedRequired: false,
            secretStorage: "keychain-reference-only",
            redactionStatus: "secret-reference-only"
        ),
        MarketplaceProviderCredentialFoundation(
            fieldKey: "google_search_console_oauth_refresh_token",
            label: "Google OAuth refresh token",
            required: true,
            userOwnedRequired: false,
            secretStorage: "keychain-reference-only",
            redactionStatus: "secret-reference-only"
        ),
        MarketplaceProviderCredentialFoundation(
            fieldKey: "google_search_console_oauth_access_token",
            label: "Google OAuth access token",
            required: false,
            userOwnedRequired: false,
            secretStorage: "keychain-reference-only",
            redactionStatus: "secret-reference-only"
        ),
        MarketplaceProviderCredentialFoundation(
            fieldKey: "google_search_console_project_id",
            label: "Google Cloud project ID",
            required: false,
            userOwnedRequired: false,
            secretStorage: "metadata-only",
            redactionStatus: "private-state-excluded"
        ),
        MarketplaceProviderCredentialFoundation(
            fieldKey: "google_search_console_default_site_url",
            label: "Default Search Console property",
            required: true,
            userOwnedRequired: false,
            secretStorage: "metadata-only",
            redactionStatus: "private-state-excluded"
        )
    ]

    private static let notionCredentialRequirements: [MarketplaceProviderCredentialFoundation] = [
        MarketplaceProviderCredentialFoundation(
            fieldKey: "notion_credential_mode",
            label: "Credential mode",
            required: true,
            userOwnedRequired: true,
            secretStorage: "metadata-only",
            redactionStatus: "private-state-excluded"
        ),
        MarketplaceProviderCredentialFoundation(
            fieldKey: "notion_api_token",
            label: "Notion API token",
            required: true,
            userOwnedRequired: true,
            secretStorage: "keychain-reference-only",
            redactionStatus: "secret-reference-only"
        ),
        MarketplaceProviderCredentialFoundation(
            fieldKey: "notion_workspace_label",
            label: "Workspace label",
            required: false,
            userOwnedRequired: false,
            secretStorage: "metadata-only",
            redactionStatus: "private-state-excluded"
        )
    ]

    private static let sentryCredentialRequirements: [MarketplaceProviderCredentialFoundation] = [
        MarketplaceProviderCredentialFoundation(
            fieldKey: "sentry_oauth_access_token",
            label: "Sentry OAuth access token",
            required: true,
            userOwnedRequired: false,
            secretStorage: "keychain-reference-only",
            redactionStatus: "secret-reference-only"
        ),
        MarketplaceProviderCredentialFoundation(
            fieldKey: "sentry_oauth_refresh_token",
            label: "Sentry OAuth refresh token",
            required: true,
            userOwnedRequired: false,
            secretStorage: "keychain-reference-only",
            redactionStatus: "secret-reference-only"
        ),
        MarketplaceProviderCredentialFoundation(
            fieldKey: "sentry_organization_slug",
            label: "Sentry organization slug or ID",
            required: true,
            userOwnedRequired: false,
            secretStorage: "metadata-only",
            redactionStatus: "private-state-excluded"
        ),
        MarketplaceProviderCredentialFoundation(
            fieldKey: "sentry_base_url",
            label: "Sentry base URL",
            required: false,
            userOwnedRequired: false,
            secretStorage: "metadata-only",
            redactionStatus: "private-state-excluded"
        ),
        MarketplaceProviderCredentialFoundation(
            fieldKey: "sentry_default_project_slug",
            label: "Default project slug or ID",
            required: false,
            userOwnedRequired: false,
            secretStorage: "metadata-only",
            redactionStatus: "private-state-excluded"
        ),
        MarketplaceProviderCredentialFoundation(
            fieldKey: "sentry_default_environment",
            label: "Default environment",
            required: false,
            userOwnedRequired: false,
            secretStorage: "metadata-only",
            redactionStatus: "private-state-excluded"
        )
    ]

    private static let microsoftClarityCredentialRequirements: [MarketplaceProviderCredentialFoundation] = [
        MarketplaceProviderCredentialFoundation(
            fieldKey: "microsoft_clarity_api_token",
            label: "Data Export API token",
            required: true,
            userOwnedRequired: true,
            secretStorage: "keychain-reference-only",
            redactionStatus: "secret-reference-only"
        ),
        MarketplaceProviderCredentialFoundation(
            fieldKey: "microsoft_clarity_project_label",
            label: "Project or site label",
            required: false,
            userOwnedRequired: false,
            secretStorage: "metadata-only",
            redactionStatus: "private-state-excluded"
        ),
        MarketplaceProviderCredentialFoundation(
            fieldKey: "microsoft_clarity_project_url",
            label: "Project or site URL",
            required: false,
            userOwnedRequired: false,
            secretStorage: "metadata-only",
            redactionStatus: "private-state-excluded"
        ),
        MarketplaceProviderCredentialFoundation(
            fieldKey: "microsoft_clarity_project_id",
            label: "Project ID",
            required: false,
            userOwnedRequired: false,
            secretStorage: "metadata-only",
            redactionStatus: "private-state-excluded"
        )
    ]

    private static let telemetryDeckCredentialRequirements: [MarketplaceProviderCredentialFoundation] = [
        MarketplaceProviderCredentialFoundation(
            fieldKey: "telemetrydeck_personal_access_token",
            label: "TelemetryDeck Personal Access Token",
            required: true,
            userOwnedRequired: true,
            secretStorage: "keychain-reference-only",
            redactionStatus: "secret-reference-only"
        ),
        MarketplaceProviderCredentialFoundation(
            fieldKey: "telemetrydeck_namespace",
            label: "Organization namespace",
            required: true,
            userOwnedRequired: false,
            secretStorage: "metadata-only",
            redactionStatus: "private-state-excluded"
        ),
        MarketplaceProviderCredentialFoundation(
            fieldKey: "telemetrydeck_app_id",
            label: "TelemetryDeck app ID",
            required: true,
            userOwnedRequired: false,
            secretStorage: "metadata-only",
            redactionStatus: "private-state-excluded"
        ),
        MarketplaceProviderCredentialFoundation(
            fieldKey: "telemetrydeck_app_display_name",
            label: "App display name",
            required: false,
            userOwnedRequired: false,
            secretStorage: "metadata-only",
            redactionStatus: "private-state-excluded"
        ),
        MarketplaceProviderCredentialFoundation(
            fieldKey: "telemetrydeck_default_insight_id",
            label: "Default saved insight ID",
            required: false,
            userOwnedRequired: false,
            secretStorage: "metadata-only",
            redactionStatus: "private-state-excluded"
        )
    ]

    private static let postHogCredentialRequirements: [MarketplaceProviderCredentialFoundation] = [
        MarketplaceProviderCredentialFoundation(
            fieldKey: "posthog_api_base_url",
            label: "PostHog API base URL",
            required: true,
            userOwnedRequired: false,
            secretStorage: "metadata-only",
            redactionStatus: "private-state-excluded"
        ),
        MarketplaceProviderCredentialFoundation(
            fieldKey: "posthog_oauth_access_token",
            label: "PostHog OAuth access token",
            required: true,
            userOwnedRequired: false,
            secretStorage: "keychain-reference-only",
            redactionStatus: "secret-reference-only"
        ),
        MarketplaceProviderCredentialFoundation(
            fieldKey: "posthog_oauth_refresh_token",
            label: "PostHog OAuth refresh token",
            required: true,
            userOwnedRequired: false,
            secretStorage: "keychain-reference-only",
            redactionStatus: "secret-reference-only"
        ),
        MarketplaceProviderCredentialFoundation(
            fieldKey: "posthog_organization_id",
            label: "Organization ID",
            required: false,
            userOwnedRequired: false,
            secretStorage: "metadata-only",
            redactionStatus: "private-state-excluded"
        ),
        MarketplaceProviderCredentialFoundation(
            fieldKey: "posthog_project_id",
            label: "Project or environment ID",
            required: false,
            userOwnedRequired: false,
            secretStorage: "metadata-only",
            redactionStatus: "private-state-excluded"
        )
    ]

    private static func stableSuffix(_ value: String) -> String {
        var hash: UInt64 = 1469598103934665603
        for byte in value.utf8 {
            hash ^= UInt64(byte)
            hash &*= 1099511628211
        }
        let hex = String(hash, radix: 16)
        return String(hex.suffix(8))
    }

    private static func safeIdentifierComponent(_ value: String) -> String {
        let allowed = Set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_")
        let mapped = value.replacingOccurrences(of: "-", with: "_").map { allowed.contains($0) ? $0 : "_" }
        let normalized = String(mapped)
            .trimmingCharacters(in: CharacterSet(charactersIn: "_"))
            .lowercased()
        return normalized.isEmpty ? "provider" : normalized
    }
}
