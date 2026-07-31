import Foundation

public final class MarketplaceProviderActionPolicyCompilerService {
    public static let dangerousPolicyAcknowledgementVersion = "relay-marketplace-dangerous-policy-v1"
    public static let dangerousPolicyPreservedInvariants = [
        "workspace_and_connection_ownership",
        "provider_authentication_and_granted_authority",
        "selected_capabilities_and_blocked_actions",
        "fixed_provider_origins_and_request_bounds",
        "provider_and_relay_rate_limits",
        "audit_evidence_and_truthful_results",
        "secret_non_exposure",
    ]

    private let data: LocalDataService

    public init(data: LocalDataService) {
        self.data = data
    }

    @discardableResult
    public func compilePolicyMap(
        context: ServiceRequestContext,
        appIdOrSlug: RelayId,
        preset: MarketplaceActionPolicyPreset,
        acknowledgeDangerousPolicy: Bool = false,
        connectionId: RelayId? = nil,
        installId: RelayId? = nil,
        agentId: RelayId? = nil,
        now: Date = Date()
    ) throws -> MarketplaceActionPermissionMap {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
            throw denied
        }
        if preset == .allowDirectWrites, !acknowledgeDangerousPolicy {
            throw ServiceGuard.invalidInput(
                context: context,
                message: "Direct writes is an advanced dangerous policy and requires an explicit acknowledgement."
            )
        }
        let app = try requireProviderActionApp(context: context, appIdOrSlug: appIdOrSlug)
        let templates = try Self.templates(for: app.slug, context: context)
        let connection = try validatedConnection(connectionId, app: app, context: context)
        let install = try validatedInstall(installId, app: app, context: context)
        let executionAuthority = try resolvedExecutionAuthority(
            app: app,
            connection: connection,
            install: install,
            context: context
        )
        let effectiveAgentId = try validatedAgentId(agentId, install: install, context: context)
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)

        let definitions = try templates.map { template in
            try data.saveMarketplaceProviderActionDefinition(template.definition(
                workspaceId: context.workspaceId,
                app: app,
                timestamp: timestamp
            ))
        }

        var permissions: [String: ProviderActionPermission] = [:]
        var blockedReasons: [String: String] = [:]
        for template in templates {
            let permission = Self.permission(for: template, preset: preset)
            permissions[template.actionKey] = permission
            if permission == .blocked {
                blockedReasons[template.actionKey] = template.blockedReason ?? Self.defaultBlockedReason(template)
            }
        }

        let mapId = Self.permissionMapId(
            workspaceId: context.workspaceId,
            appId: app.id,
            connectionId: connection?.id,
            installId: install?.id,
            agentId: effectiveAgentId
        )
        let existing = try data.getMarketplaceActionPermissionMap(workspaceId: context.workspaceId, mapId: mapId)
        let map = MarketplaceActionPermissionMap(
            id: mapId,
            workspaceId: context.workspaceId,
            appId: app.id,
            appSlug: app.slug,
            connectionId: connection?.id,
            installId: install?.id,
            agentId: effectiveAgentId,
            policyPreset: preset,
            permissions: definitions.reduce(into: permissions) { output, definition in
                output[definition.actionKey] = permissions[definition.actionKey] ?? definition.defaultPermission
            },
            blockedReasons: blockedReasons,
            source: "marketplace-policy-compiler.\(app.slug)",
            createdByActorId: existing?.createdByActorId ?? context.actorId,
            updatedByActorId: context.actorId,
            createdAt: existing?.createdAt ?? timestamp,
            updatedAt: timestamp,
            executionAuthority: executionAuthority,
            executionAuthorityVersion: MarketplaceExecutionAuthority.contractVersion,
            dangerousPolicyAcknowledgementVersion: preset == .allowDirectWrites ? Self.dangerousPolicyAcknowledgementVersion : nil,
            dangerousPolicyAcknowledgedAt: preset == .allowDirectWrites ? timestamp : nil,
            dangerousPolicyAcknowledgedByActorId: preset == .allowDirectWrites ? context.actorId : nil,
            dangerousPolicyPreservedInvariants: preset == .allowDirectWrites ? Self.dangerousPolicyPreservedInvariants : nil,
            redactionStatus: "private-state-excluded"
        )
        return try data.saveMarketplaceActionPermissionMap(map)
    }

    private func resolvedExecutionAuthority(
        app: MarketplaceCatalogApp,
        connection: MarketplaceProviderConnection?,
        install: MarketplaceInstallRecord?,
        context: ServiceRequestContext
    ) throws -> MarketplaceExecutionAuthority {
        let expected = MarketplaceExecutionAuthority.currentSwiftAdapterAuthority(for: app.slug)
        if let connection {
            guard let authority = connection.resolvedExecutionAuthority else {
                throw ServiceGuard.unavailable(
                    context: context,
                    reasonCode: .featureUnavailable,
                    message: "Marketplace connection execution authority is missing or incompatible. Reconnect before compiling policy."
                )
            }
            guard authority == expected else {
                throw ServiceGuard.unavailable(
                    context: context,
                    reasonCode: .featureUnavailable,
                    message: "Marketplace connection belongs to a different execution broker and cannot be compiled by this Swift adapter."
                )
            }
        }
        if let install {
            guard let authority = install.resolvedExecutionAuthority else {
                throw ServiceGuard.unavailable(
                    context: context,
                    reasonCode: .featureUnavailable,
                    message: "Marketplace install execution authority is missing or incompatible. Reinstall before compiling policy."
                )
            }
            guard authority == expected else {
                throw ServiceGuard.unavailable(
                    context: context,
                    reasonCode: .featureUnavailable,
                    message: "Marketplace install belongs to a different execution broker and cannot be compiled by this Swift adapter."
                )
            }
        }
        return expected
    }

    public static func isDangerousPolicyAcknowledged(_ map: MarketplaceActionPermissionMap?) -> Bool {
        guard let map,
              map.policyPreset == .allowDirectWrites,
              map.dangerousPolicyAcknowledgementVersion == dangerousPolicyAcknowledgementVersion,
              map.dangerousPolicyAcknowledgedAt?.isEmpty == false,
              map.dangerousPolicyAcknowledgedByActorId?.isEmpty == false,
              let invariants = map.dangerousPolicyPreservedInvariants
        else {
            return false
        }
        return Set(invariants) == Set(dangerousPolicyPreservedInvariants)
    }

    public static func effectivePermission(
        _ permission: ProviderActionPermission,
        permissionMap: MarketplaceActionPermissionMap?
    ) -> ProviderActionPermission {
        guard permission == .autoExecute else { return permission }
        return isDangerousPolicyAcknowledged(permissionMap) ? .autoExecute : .approvalRequired
    }

    public func actionDefinitions(
        context: ServiceRequestContext,
        appIdOrSlug: RelayId,
        now: Date = Date()
    ) throws -> [MarketplaceProviderActionDefinition] {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin, .member], context: context) {
            throw denied
        }
        let app = try requireProviderActionApp(context: context, appIdOrSlug: appIdOrSlug)
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
        return try Self.templates(for: app.slug, context: context).map { template in
            try data.saveMarketplaceProviderActionDefinition(template.definition(
                workspaceId: context.workspaceId,
                app: app,
                timestamp: timestamp
            ))
        }
    }

    private func requireProviderActionApp(
        context: ServiceRequestContext,
        appIdOrSlug: RelayId
    ) throws -> MarketplaceCatalogApp {
        guard let app = try data.getMarketplaceCatalogApp(workspaceId: context.workspaceId, appIdOrSlug: appIdOrSlug) else {
            throw ServiceGuard.invalidInput(context: context, message: "Marketplace app was not found for provider action policy compilation.")
        }
        guard app.sourceType == .externalProvider,
              app.availability == .available,
              !app.localAppExcluded,
              !app.reviewExcluded,
              !app.slug.localizedCaseInsensitiveContains("paperclip")
        else {
            throw ServiceGuard.invalidInput(context: context, message: "Provider action policy compilation requires an available external Marketplace app.")
        }
        return app
    }

    private func validatedConnection(
        _ connectionId: RelayId?,
        app: MarketplaceCatalogApp,
        context: ServiceRequestContext
    ) throws -> MarketplaceProviderConnection? {
        guard let connectionId else {
            return nil
        }
        guard let connection = try data.getProviderConnection(workspaceId: context.workspaceId, connectionId: connectionId),
              connection.appId == app.id,
              connection.appSlug == app.slug
        else {
            throw ServiceGuard.invalidInput(context: context, message: "Provider action policy connection does not match the Marketplace app.")
        }
        return connection
    }

    private func validatedInstall(
        _ installId: RelayId?,
        app: MarketplaceCatalogApp,
        context: ServiceRequestContext
    ) throws -> MarketplaceInstallRecord? {
        guard let installId else {
            return nil
        }
        guard let install = try data.getMarketplaceInstall(workspaceId: context.workspaceId, installId: installId),
              install.appId == app.id,
              install.appSlug == app.slug
        else {
            throw ServiceGuard.invalidInput(context: context, message: "Provider action policy install does not match the Marketplace app.")
        }
        return install
    }

    private func validatedAgentId(
        _ agentId: RelayId?,
        install: MarketplaceInstallRecord?,
        context: ServiceRequestContext
    ) throws -> RelayId? {
        if let install, let agentId, install.agentId != agentId {
            throw ServiceGuard.invalidInput(context: context, message: "Provider action policy agent does not match the Marketplace install.")
        }
        return agentId ?? install?.agentId
    }

    private static func templates(
        for slug: String,
        context: ServiceRequestContext
    ) throws -> [ProviderActionTemplate] {
        switch slug {
        case "x":
            return xTemplates
        case "facebook-pages":
            return facebookPagesTemplates
        case "instagram-business":
            return instagramBusinessTemplates
        case "threads":
            return threadsTemplates
        case "mastodon":
            return mastodonTemplates
        case "bluesky":
            return blueskyTemplates
        case "nextdoor":
            return nextdoorTemplates
        case "meetup":
            return meetupTemplates
        case "eventbrite":
            return eventbriteTemplates
        case "luma":
            return lumaTemplates
        case "hopin":
            return hopinTemplates
        case "twist":
            return twistTemplates
        case "zoho-mail":
            return zohoMailTemplates
        case "webex":
            return webexTemplates
        case "goto-meeting":
            return goToMeetingTemplates
        case "ringcentral":
            return ringCentralTemplates
        case "dialpad":
            return dialpadTemplates
        case "aircall":
            return aircallTemplates
        case "openphone":
            return openPhoneTemplates
        case "twilio":
            return twilioTemplates
        case "vonage":
            return vonageTemplates
        case "messagebird":
            return messageBirdTemplates
        case "fred":
            return fredTemplates
        case "apollo-graphql-studio":
            return apolloGraphOSTemplates
        case "hunter-io":
            return hunterTemplates
        case "snov-io":
            return snovTemplates
        case "lusha":
            return lushaTemplates
        case "leadiq":
            return leadIQTemplates
        case "seamless-ai":
            return seamlessAITemplates
        case "rocketreach":
            return rocketReachTemplates
        case "uplead":
            return upLeadTemplates
        case "wiza":
            return wizaTemplates
        case "line":
            return lineTemplates
        case "pinterest":
            return pinterestTemplates
        case "tumblr":
            return tumblrTemplates
        case "linkedin":
            return linkedInTemplates
        case "gmail":
            return gmailTemplates
        case "google-docs":
            return googleDocsTemplates
        case "google-drive":
            return googleDriveTemplates
        case "google-sheets":
            return googleSheetsTemplates
        case "google-slides":
            return googleSlidesTemplates
        case "google-forms":
            return googleFormsTemplates
        case "google-tasks":
            return googleTasksTemplates
        case "google-contacts":
            return googleContactsTemplates
        case "google-photos":
            return googlePhotosTemplates
        case "google-meet":
            return googleMeetTemplates
        case "google-chat":
            return googleChatTemplates
        case "google-ads":
            return googleAdsTemplates
        case "google-analytics":
            return googleAnalyticsTemplates
        case "google-merchant-center":
            return googleMerchantCenterTemplates
        case "youtube":
            return youtubeTemplates
        case "google-classroom":
            return googleClassroomTemplates
        case "outlook":
            return outlookTemplates
        case "microsoft-teams":
            return microsoftTeamsTemplates
        case "onedrive":
            return oneDriveTemplates
        case "sharepoint":
            return sharePointTemplates
        case "microsoft-planner":
            return microsoftPlannerTemplates
        case "microsoft-to-do":
            return microsoftToDoTemplates
        case "microsoft-lists":
            return microsoftListsTemplates
        case "onenote":
            return oneNoteTemplates
        case "microsoft-bookings":
            return microsoftBookingsTemplates
        case "microsoft-power-bi":
            return microsoftPowerBITemplates
        case "microsoft-dynamics-365":
            return microsoftDynamics365Templates
        case "microsoft-viva-engage":
            return microsoftVivaEngageTemplates
        case "zoom":
            return zoomTemplates
        case "discord":
            return discordTemplates
        case "google-search-console":
            return googleSearchConsoleTemplates
        case "slack":
            return slackTemplates
        case "github":
            return githubTemplates
        case "gitlab":
            return gitLabTemplates
        case "bitbucket":
            return bitbucketTemplates
        case "linear":
            return linearTemplates
        case "asana":
            return asanaTemplates
        case "trello":
            return trelloTemplates
        case "clickup":
            return clickUpTemplates
        case "monday-com":
            return mondayTemplates
        case "airtable":
            return airtableTemplates
        case "dropbox":
            return dropboxTemplates
        case "box":
            return boxTemplates
        case "figma":
            return figmaTemplates
        case "miro":
            return miroTemplates
        case "canva":
            return canvaTemplates
        case "webflow":
            return webflowTemplates
        case "wordpress-com":
            return wordpressComTemplates
        case "contentful":
            return contentfulTemplates
        case "sanity":
            return sanityTemplates
        case "strapi-cloud":
            return strapiCloudTemplates
        case "shopify":
            return shopifyTemplates
        case "woocommerce":
            return wooCommerceTemplates
        case "stripe":
            return stripeTemplates
        case "xero":
            return xeroTemplates
        case "quickbooks":
            return quickBooksTemplates
        case "freshbooks":
            return freshBooksTemplates
        case "wave":
            return waveTemplates
        case "freeagent":
            return freeAgentTemplates
        case "salesforce":
            return salesforceTemplates
        case "hubspot":
            return hubSpotTemplates
        case "pipedrive":
            return pipedriveTemplates
        case "copper":
            return copperTemplates
        case "close":
            return closeTemplates
        case "zendesk":
            return zendeskTemplates
        case "intercom":
            return intercomTemplates
        case "help-scout":
            return helpScoutTemplates
        case "front":
            return frontTemplates
        case "teamwork":
            return teamworkTemplates
        case "basecamp":
            return basecampTemplates
        case "wrike":
            return wrikeTemplates
        case "smartsheet":
            return smartsheetTemplates
        case "todoist":
            return todoistTemplates
        case "harvest":
            return harvestTemplates
        case "calendly":
            return calendlyTemplates
        case "cal-com":
            return calComTemplates
        case "ironclad-clickwrap":
            return ironcladClickwrapTemplates
        case "docusign-identify":
            return docusignIdentifyTemplates
        case "docusign":
            return docusignTemplates
        case "dropbox-sign":
            return dropboxSignTemplates
        case "pandadoc":
            return pandaDocTemplates
        case "typeform":
            return typeformTemplates
        case "sendfox":
            return sendFoxTemplates
        case "beehiiv":
            return beehiivTemplates
        case "substack":
            return substackTemplates
        case "hootsuite":
            return hootsuiteTemplates
        case "buffer":
            return bufferTemplates
        case "sprout-social":
            return sproutSocialTemplates
        case "later":
            return laterTemplates
        case "agorapulse":
            return agorapulseTemplates
        case "metricool":
            return metricoolTemplates
        case "publer":
            return publerTemplates
        case "brandwatch":
            return brandwatchTemplates
        case "mention":
            return mentionTemplates
        case "meltwater":
            return meltwaterTemplates
        case "sprinklr":
            return sprinklrTemplates
        case "khoros":
            return khorosTemplates
        case "clevertap":
            return cleverTapTemplates
        case "onesignal":
            return oneSignalTemplates
        case "airship":
            return airshipTemplates
        case "pushwoosh":
            return pushwooshTemplates
        case "pusher-beams":
            return pusherBeamsTemplates
        case "firebase-cloud-messaging":
            return firebaseCloudMessagingTemplates
        case "appsflyer":
            return appsFlyerTemplates
        case "adjust":
            return adjustTemplates
        case "branch":
            return branchTemplates
        case "singular":
            return singularTemplates
        case "kochava":
            return kochavaTemplates
        case "segment-personas":
            return segmentPersonasTemplates
        case "mparticle":
            return mParticleTemplates
        case "tealium":
            return tealiumTemplates
        case "lytics":
            return lyticsTemplates
        case "blueconic":
            return blueConicTemplates
        case "treasure-data":
            return treasureDataTemplates
        case "hightouch":
            return hightouchTemplates
        case "census":
            return censusTemplates
        case "clio-manage":
            return clioManageTemplates
        case "clio-grow":
            return clioGrowTemplates
        case "mycase":
            return myCaseTemplates
        case "practicepanther":
            return practicePantherTemplates
        case "smokeball":
            return smokeballTemplates
        case "lawpay":
            return lawPayTemplates
        case "filevine":
            return filevineTemplates
        case "surveymonkey":
            return surveyMonkeyTemplates
        case "fillout":
            return filloutTemplates
        case "mailchimp":
            return mailchimpTemplates
        case "klaviyo":
            return klaviyoTemplates
        case "convertkit":
            return convertKitTemplates
        case "campaign-monitor":
            return campaignMonitorTemplates
        case "constant-contact":
            return constantContactTemplates
        case "notion":
            return notionTemplates
        case "microsoft-clarity":
            return microsoftClarityTemplates
        case "posthog":
            return postHogTemplates
        case "telemetrydeck":
            return telemetryDeckTemplates
        case "sentry":
            return sentryTemplates
        case "datadog":
            return datadogTemplates
        case "pagerduty":
            return pagerDutyTemplates
        case "cloudflare":
            return cloudflareTemplates
        case "vercel":
            return vercelTemplates
        case "heroku":
            return herokuTemplates
        case "digitalocean":
            return digitalOceanTemplates
        case "firebase":
            return firebaseTemplates
        case "supabase":
            return supabaseTemplates
        case "okta":
            return oktaTemplates
        case "bamboohr":
            return bambooHRTemplates
        case "greenhouse":
            return greenhouseTemplates
        case "lever":
            return leverTemplates
        case "google-calendar":
            return googleCalendarTemplates
        case "exa-search":
            return exaSearchTemplates
        default:
            throw ServiceGuard.invalidInput(context: context, message: "Provider action templates are not available for this Marketplace app.")
        }
    }

    private static func permission(
        for template: ProviderActionTemplate,
        preset: MarketplaceActionPolicyPreset
    ) -> ProviderActionPermission {
        if template.defaultPermission == .blocked || template.riskLevel == .destructive {
            return .blocked
        }
        switch preset {
        case .blocked:
            return .blocked
        case .readOnly:
            switch template.kind {
            case .read, .search, .draft:
                if template.defaultPermission == .approvalRequired || template.riskLevel == .high {
                    return .approvalRequired
                }
                return .allowed
            case .message, .write, .delete, .admin:
                return .blocked
            }
        case .approvalRequired:
            if template.defaultPermission == .approvalRequired {
                return .approvalRequired
            }
            switch template.kind {
            case .read, .search, .draft:
                return .allowed
            case .message, .write, .delete, .admin:
                return .approvalRequired
            }
        case .allowDirectWrites:
            if template.defaultPermission == .approvalRequired {
                switch template.kind {
                case .message, .write:
                    return .autoExecute
                case .read, .search, .draft:
                    return template.riskLevel == .high ? .approvalRequired : .allowed
                case .delete, .admin:
                    return .blocked
                }
            }
            return template.defaultPermission
        }
    }

    private static func defaultBlockedReason(_ template: ProviderActionTemplate) -> String {
        switch template.riskLevel {
        case .destructive:
            return "Destructive provider action is blocked by the Marketplace policy compiler."
        case .high:
            return "High-risk provider action is blocked by the selected policy preset."
        case .low, .medium:
            return "Provider action is blocked by the selected policy preset."
        }
    }

    private static func permissionMapId(
        workspaceId: RelayId,
        appId: RelayId,
        connectionId: RelayId?,
        installId: RelayId?,
        agentId: RelayId?
    ) -> RelayId {
        "mpperm-\([workspaceId, appId, connectionId ?? "app", installId ?? "no-install", agentId ?? "no-agent"].map(safeIdentifierComponent).joined(separator: "-"))"
    }

    fileprivate static func actionId(appId: RelayId, actionKey: String) -> RelayId {
        "mpact-\([appId, actionKey].map(safeIdentifierComponent).joined(separator: "-"))"
    }

    private static func safeIdentifierComponent(_ value: String) -> String {
        let allowed = Set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_")
        let mapped = value.map { allowed.contains($0) ? $0 : "-" }
        return String(mapped).trimmingCharacters(in: CharacterSet(charactersIn: "-")).lowercased()
    }

    private static let xTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "x_account_get",
            displayName: "Read connected account",
            summary: "Read bounded identity for the connected X account.",
            kind: .read,
            riskLevel: .low,
            adapterKind: .nativeAPI,
            defaultPermission: .allowed,
            requiredScopes: ["users.read"],
            capabilityKeys: ["read_connected_account"],
            payloadSchema: [:],
            resultSchema: [
                "account": .string("object with id, name, username")
            ]
        ),
        ProviderActionTemplate(
            actionKey: "x_own_posts_list",
            displayName: "List own Posts",
            summary: "Read at most ten recent original Posts from the connected account.",
            kind: .read,
            riskLevel: .medium,
            adapterKind: .nativeAPI,
            defaultPermission: .allowed,
            requiredScopes: ["tweet.read", "users.read"],
            capabilityKeys: ["read_own_posts"],
            payloadSchema: ["maxResults": .string("optional integer 1-10")],
            resultSchema: ["posts": .string("array of id, text, createdAt"), "count": .string("integer")]
        ),
        ProviderActionTemplate(
            actionKey: "x_post_draft",
            displayName: "Draft post",
            summary: "Prepare a bounded plain-text X Post locally without publishing it.",
            kind: .draft,
            riskLevel: .medium,
            adapterKind: .nativeAPI,
            defaultPermission: .allowed,
            requiredScopes: [],
            capabilityKeys: ["draft_posts"],
            payloadSchema: ["text": .string("string")],
            resultSchema: ["draftId": .string("string"), "text": .string("string"), "characterCount": .string("integer"), "providerCallMade": .string("false")]
        ),
        ProviderActionTemplate(
            actionKey: "x_text_post_create",
            displayName: "Publish text Post",
            summary: "Publish one original plain-text X Post with AI disclosure.",
            kind: .write,
            riskLevel: .high,
            adapterKind: .nativeAPI,
            defaultPermission: .approvalRequired,
            requiredScopes: ["tweet.write"],
            capabilityKeys: ["publish_posts"],
            payloadSchema: ["text": .string("string")],
            resultSchema: ["postId": .string("string"), "text": .string("string"), "postURL": .string("string"), "madeWithAI": .string("true"), "published": .string("true")]
        )
    ]

    private static let facebookPagesTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "facebook_pages_page_get",
            displayName: "Read selected Page",
            summary: "Read bounded identity for the immutable selected Facebook Page.",
            kind: .read, riskLevel: .low, adapterKind: .nativeAPI,
            defaultPermission: .allowed,
            requiredScopes: ["pages_read_engagement"],
            capabilityKeys: ["read_selected_page"], payloadSchema: [:],
            resultSchema: [
                "page": .string("object with id, name, optional link/category/picture availability")
            ]),
        ProviderActionTemplate(
            actionKey: "facebook_pages_own_posts_list",
            displayName: "List Page-authored posts",
            summary: "Read at most ten recent posts authored by the selected Page.",
            kind: .read, riskLevel: .medium, adapterKind: .nativeAPI,
            defaultPermission: .allowed,
            requiredScopes: ["pages_read_engagement"],
            capabilityKeys: ["read_page_authored_posts"],
            payloadSchema: ["maxResults": .string("optional integer 1-10")],
            resultSchema: [
                "posts": .string("array of id, message, createdTime, permalinkURL, isPublished"),
                "resultCount": .string("integer"), "nextPageFollowed": .string("false"),
            ]),
        ProviderActionTemplate(
            actionKey: "facebook_pages_post_draft",
            displayName: "Draft Page post",
            summary: "Validate a bounded plain-text Page post locally without a provider call.",
            kind: .draft, riskLevel: .medium, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: [],
            capabilityKeys: ["draft_page_posts"],
            payloadSchema: ["message": .string("non-empty plain text without URLs")],
            resultSchema: [
                "message": .string("string"), "characterCount": .string("integer"),
                "providerCallMade": .string("false"),
            ]),
        ProviderActionTemplate(
            actionKey: "facebook_pages_text_post_create",
            displayName: "Publish Page text post",
            summary: "Publish one plain-text post to the immutable selected Facebook Page.",
            kind: .write, riskLevel: .high, adapterKind: .nativeAPI,
            defaultPermission: .approvalRequired,
            requiredScopes: ["pages_manage_posts"],
            capabilityKeys: ["publish_page_text_posts"],
            payloadSchema: ["message": .string("non-empty plain text without URLs")],
            resultSchema: [
                "postId": .string("string"), "pageId": .string("bound selected Page ID"),
                "pageName": .string("bound selected Page name"),
                "providerAcknowledged": .string("true"), "ambiguous": .string("false"),
            ])
    ]

    private static let instagramBusinessTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "instagram_business_account_get",
            displayName: "Read professional account",
            summary: "Read fixed safe identity fields for the bound Instagram Business or Creator account.",
            kind: .read, riskLevel: .low, adapterKind: .nativeAPI,
            defaultPermission: .allowed,
            requiredScopes: ["instagram_business_basic"],
            capabilityKeys: ["read_bound_professional_account"], payloadSchema: [:],
            resultSchema: [
                "account": .string("object with id, username, optional name, accountType, mediaCount, and picture availability")
            ]),
        ProviderActionTemplate(
            actionKey: "instagram_business_own_media_list",
            displayName: "List owned media",
            summary: "Read one page of at most ten recent media items owned by the bound professional account.",
            kind: .read, riskLevel: .medium, adapterKind: .nativeAPI,
            defaultPermission: .allowed,
            requiredScopes: ["instagram_business_basic"],
            capabilityKeys: ["read_recent_owned_media"],
            payloadSchema: ["maxResults": .string("optional integer 1-10")],
            resultSchema: [
                "media": .string("array of id, caption, mediaType, mediaProductType, timestamp, permalink, and thumbnail availability"),
                "resultCount": .string("integer"), "nextPageFollowed": .string("false"),
            ]),
        ProviderActionTemplate(
            actionKey: "instagram_business_own_media_get",
            displayName: "Read owned media item",
            summary: "Read one fixed-field media item after proving it belongs to the bound professional account.",
            kind: .read, riskLevel: .medium, adapterKind: .nativeAPI,
            defaultPermission: .allowed,
            requiredScopes: ["instagram_business_basic"],
            capabilityKeys: ["read_one_owned_media_item"],
            payloadSchema: ["mediaId": .string("required owned Instagram media ID")],
            resultSchema: [
                "media": .string("object with id, caption, mediaType, mediaProductType, timestamp, permalink, and thumbnail availability"),
                "ownershipVerified": .string("true"),
            ])
    ]

    private static let threadsTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "threads_profile_get", displayName: "Read Threads profile",
            summary: "Read fixed safe identity fields for the bound app-scoped Threads profile.",
            kind: .read, riskLevel: .low, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: ["threads_basic"],
            capabilityKeys: ["read_bound_threads_profile"], payloadSchema: [:],
            resultSchema: ["profile": .string("object with id, username, optional name/biography, verification and picture availability")]),
        ProviderActionTemplate(
            actionKey: "threads_own_posts_list", displayName: "List own Threads posts",
            summary: "Read one page of at most ten recent posts owned by the bound profile.",
            kind: .read, riskLevel: .medium, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: ["threads_basic"],
            capabilityKeys: ["read_recent_own_threads_posts"],
            payloadSchema: ["maxResults": .string("optional integer 1-10")],
            resultSchema: [
                "posts": .string("array of id, text, mediaType, timestamp, permalink, shortcode, quote/reply flags"),
                "resultCount": .string("integer"), "nextPageFollowed": .string("false"),
            ]),
        ProviderActionTemplate(
            actionKey: "threads_own_post_get", displayName: "Read own Threads post",
            summary: "Read one fixed-field post after proving it belongs to the bound profile.",
            kind: .read, riskLevel: .medium, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: ["threads_basic"],
            capabilityKeys: ["read_one_own_threads_post"],
            payloadSchema: ["postId": .string("required owned Threads post ID")],
            resultSchema: ["post": .string("one normalized own post"), "ownershipVerified": .string("true")]),
        ProviderActionTemplate(
            actionKey: "threads_text_post_draft", displayName: "Draft Threads text post",
            summary: "Validate a bounded plain-text Threads post locally without a provider call.",
            kind: .draft, riskLevel: .medium, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: [],
            capabilityKeys: ["draft_threads_text_posts"],
            payloadSchema: ["text": .string("non-empty plain text, maximum 500 characters, no URLs")],
            resultSchema: ["text": .string("string"), "characterCount": .string("integer"), "providerCallMade": .string("false")]),
        ProviderActionTemplate(
            actionKey: "threads_text_post_publish", displayName: "Publish Threads text post",
            summary: "Create and publish one bounded plain-text post for the bound Threads profile.",
            kind: .write, riskLevel: .high, adapterKind: .nativeAPI,
            defaultPermission: .approvalRequired,
            requiredScopes: ["threads_basic", "threads_content_publish"],
            capabilityKeys: ["publish_threads_text_posts"],
            payloadSchema: ["text": .string("non-empty plain text, maximum 500 characters, no URLs")],
            resultSchema: [
                "postId": .string("provider Threads post ID"),
                "profileId": .string("bound app-scoped profile ID"),
                "username": .string("bound Threads username"),
                "text": .string("exact published text"), "characterCount": .string("integer"),
                "providerAcknowledged": .string("true"), "ambiguous": .string("false"),
            ])
    ]

    private static let mastodonTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "mastodon_account_get", displayName: "Read Mastodon account",
            summary: "Read fixed safe identity fields for the bound local account on its verified instance.",
            kind: .read, riskLevel: .low, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: ["read:accounts"],
            capabilityKeys: ["read_bound_mastodon_account"], payloadSchema: [:],
            resultSchema: ["account": .string("transient object with id, username, acct, display name, profile URL, avatar availability, and verified instance origin")]),
        ProviderActionTemplate(
            actionKey: "mastodon_own_statuses_list", displayName: "List own Mastodon statuses",
            summary: "Read one transient page of at most ten recent statuses authored by the bound local account, excluding replies and reblogs.",
            kind: .read, riskLevel: .medium, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: ["read:statuses"],
            capabilityKeys: ["read_recent_own_mastodon_statuses"],
            payloadSchema: ["maxResults": .string("optional integer 1-10")],
            resultSchema: [
                "statuses": .string("transient array of id, plain text, created time, URL, visibility, language, and content-warning presence"),
                "resultCount": .string("integer"), "nextPageFollowed": .string("false"),
            ]),
        ProviderActionTemplate(
            actionKey: "mastodon_text_status_draft", displayName: "Draft Mastodon text status",
            summary: "Validate one bounded public or unlisted plain-text status locally without a provider call.",
            kind: .draft, riskLevel: .medium, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: [],
            capabilityKeys: ["draft_mastodon_text_status"],
            payloadSchema: [
                "text": .string("required non-empty plain text, maximum min(500, connected instance limit) characters"),
                "visibility": .string("optional public or unlisted; defaults to public"),
                "language": .string("optional valid language tag"),
            ],
            resultSchema: [
                "text": .string("validated exact text"), "visibility": .string("public or unlisted"),
                "language": .string("optional normalized language tag"), "characterCount": .string("integer"),
                "providerCallMade": .string("false"),
            ]),
        ProviderActionTemplate(
            actionKey: "mastodon_text_status_publish", displayName: "Publish Mastodon text status",
            summary: "Publish one idempotent bounded public or unlisted text status as the bound local account on its verified instance.",
            kind: .write, riskLevel: .high, adapterKind: .nativeAPI,
            defaultPermission: .approvalRequired, requiredScopes: ["write:statuses"],
            capabilityKeys: ["publish_mastodon_text_status"],
            payloadSchema: [
                "text": .string("required non-empty plain text, maximum min(500, connected instance limit) characters"),
                "visibility": .string("optional public or unlisted; defaults to public"),
                "language": .string("optional valid language tag"),
            ],
            resultSchema: [
                "statusId": .string("provider status ID"), "accountId": .string("bound local account ID"),
                "instanceOrigin": .string("verified HTTPS instance origin"), "url": .string("published status URL"),
                "text": .string("exact published text"), "visibility": .string("public or unlisted"),
                "language": .string("optional language tag"), "characterCount": .string("integer"),
                "providerAcknowledged": .string("true"), "ambiguous": .string("false"),
            ])
    ]

    private static let blueskyTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "bluesky_profile_get", displayName: "Read Bluesky profile",
            summary: "Read useful public profile fields for the OAuth-bound DID.",
            kind: .read, riskLevel: .low, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: ["atproto"],
            capabilityKeys: ["read_bound_bluesky_profile"], payloadSchema: [:],
            resultSchema: [
                "profile": .string("transient bound-DID object with DID, handle, display name, description, avatar URL, and follower/following/post counts"),
            ]),
        ProviderActionTemplate(
            actionKey: "bluesky_own_posts_list", displayName: "List own Bluesky posts",
            summary: "Read one transient page of at most ten recent original text posts by the OAuth-bound DID.",
            kind: .read, riskLevel: .medium, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: ["atproto"],
            capabilityKeys: ["read_recent_own_bluesky_posts"],
            payloadSchema: ["maxResults": .string("optional integer 1-10")],
            resultSchema: [
                "posts": .string("transient array of URI, CID, text, created time, and canonical URL for original non-reply/non-repost/non-quote posts"),
                "resultCount": .string("integer"), "nextPageFollowed": .string("false"),
            ]),
        ProviderActionTemplate(
            actionKey: "bluesky_text_post_draft", displayName: "Draft Bluesky text post",
            summary: "Validate one bounded text-only Bluesky post locally without a provider call.",
            kind: .draft, riskLevel: .medium, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: [],
            capabilityKeys: ["draft_bluesky_text_post"],
            payloadSchema: ["text": .string("required non-empty plain text, maximum 300 graphemes")],
            resultSchema: [
                "text": .string("validated exact text"), "graphemeCount": .string("integer"),
                "providerCallMade": .string("false"),
            ]),
        ProviderActionTemplate(
            actionKey: "bluesky_text_post_publish", displayName: "Publish Bluesky text post",
            summary: "Create one bounded text-only app.bsky.feed.post record in the OAuth-bound DID repository.",
            kind: .write, riskLevel: .high, adapterKind: .nativeAPI,
            defaultPermission: .approvalRequired,
            requiredScopes: ["repo:app.bsky.feed.post?action=create"],
            capabilityKeys: ["publish_bluesky_text_post"],
            payloadSchema: ["text": .string("required non-empty plain text, maximum 300 graphemes")],
            resultSchema: [
                "uri": .string("created post AT-URI"), "cid": .string("created record CID"),
                "canonicalURL": .string("public Bluesky post URL"), "did": .string("OAuth-bound DID"),
                "text": .string("exact published text"), "createdAt": .string("record timestamp"),
                "graphemeCount": .string("integer"), "providerAcknowledged": .string("true"),
                "ambiguous": .string("false"),
            ])
    ]

    private static let nextdoorTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "nextdoor_profile_get", displayName: "Read selected Nextdoor profile",
            summary: "Read the exact verified neighbor or business profile bound by Railway OAuth.",
            kind: .read, riskLevel: .low, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: ["openid", "profile:read"],
            capabilityKeys: ["profile_read"], payloadSchema: [:],
            resultSchema: ["profile": .string("transient selected profile with ID, type, display name, neighborhood/city, and verified status")]),
        ProviderActionTemplate(
            actionKey: "nextdoor_own_posts_list", displayName: "List own Nextdoor posts",
            summary: "Read at most ten recent posts owned by the selected profile without pagination.",
            kind: .read, riskLevel: .medium, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: ["post:read"],
            capabilityKeys: ["own_posts_read"],
            payloadSchema: ["limit": .string("optional integer 1-10")],
            resultSchema: ["posts": .string("transient bounded body excerpts, share IDs/URLs, and timestamps"), "count": .string("integer")]),
        ProviderActionTemplate(
            actionKey: "nextdoor_text_post_draft", displayName: "Draft Nextdoor text post",
            summary: "Validate one bounded plain-text post locally without a provider call.",
            kind: .draft, riskLevel: .medium, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: [],
            capabilityKeys: ["text_post_draft"],
            payloadSchema: ["text": .string("required non-empty plain text, maximum 8192 UTF-8 bytes")],
            resultSchema: ["text": .string("validated exact text"), "providerSideEffect": .string("false")]),
        ProviderActionTemplate(
            actionKey: "nextdoor_text_post_publish", displayName: "Publish Nextdoor text post",
            summary: "Publish one exact plain-text post as the server-bound selected profile.",
            kind: .write, riskLevel: .high, adapterKind: .nativeAPI,
            defaultPermission: .approvalRequired, requiredScopes: ["post:write"],
            capabilityKeys: ["text_post_publish"],
            payloadSchema: ["text": .string("required non-empty plain text, maximum 8192 UTF-8 bytes")],
            resultSchema: ["postId": .string("provider share/post ID"), "bodyExcerpt": .string("published text excerpt"), "shareUrl": .string("HTTPS share URL")])
    ]

    private static let meetupTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "meetup_self_get", displayName: "Read connected Meetup member",
            summary: "Read only the OAuth-authorized Meetup member ID and human-readable name.",
            kind: .read, riskLevel: .low, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: [], capabilityKeys: ["self_read"],
            payloadSchema: [:],
            resultSchema: ["member": .string("transient object with connected member ID and name")]),
        ProviderActionTemplate(
            actionKey: "meetup_event_get", displayName: "Read one Meetup event",
            summary: "Review one explicitly identified Meetup event using a fixed GraphQL query.",
            kind: .read, riskLevel: .medium, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: [], capabilityKeys: ["event_read"],
            payloadSchema: ["eventId": .string("required Meetup event ID, maximum 128 characters")],
            resultSchema: ["event": .string("transient event ID, title, description, dateTime, and HTTPS eventUrl")])
    ]

    private static let eventbriteTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "eventbrite_user_get", displayName: "Read connected Eventbrite user",
            summary: "Verify the OAuth-authorized Eventbrite user without exposing the provider user ID.",
            kind: .read, riskLevel: .low, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: [], capabilityKeys: ["user_read"],
            payloadSchema: [:], resultSchema: ["user": .string("transient bounded name and exact-binding status")]),
        ProviderActionTemplate(
            actionKey: "eventbrite_organizations_list", displayName: "List member Eventbrite Organizations",
            summary: "List at most ten Organizations for the connected Eventbrite user.",
            kind: .read, riskLevel: .medium, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: [], capabilityKeys: ["organization_read"],
            payloadSchema: ["limit": .string("optional integer 1-10")],
            resultSchema: ["organizations": .string("transient organizationId and name array")]),
        ProviderActionTemplate(
            actionKey: "eventbrite_organization_events_list", displayName: "List Eventbrite Organization Events",
            summary: "List at most ten Events for one Organization verified against connected-user membership.",
            kind: .read, riskLevel: .medium, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: [], capabilityKeys: ["organization_event_read"],
            payloadSchema: ["organizationId": .string("required numeric Organization ID"), "limit": .string("optional integer 1-10")],
            resultSchema: ["events": .string("transient useful owned Event summaries")]),
        ProviderActionTemplate(
            actionKey: "eventbrite_event_get", displayName: "Read one Eventbrite Event",
            summary: "Read one explicit Event with useful schedule and bounded Venue fields.",
            kind: .read, riskLevel: .medium, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: [], capabilityKeys: ["event_read"],
            payloadSchema: ["eventId": .string("required numeric Event ID")],
            resultSchema: ["event": .string("transient Event and bounded Venue fields")])
    ]

    private static let lumaTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "luma_user_get", displayName: "Verify connected Luma user",
            summary: "Verify the API-key user binding without exposing the provider user ID or email.",
            kind: .read, riskLevel: .medium, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: [], capabilityKeys: ["user_read"],
            payloadSchema: [:], resultSchema: ["user": .string("transient bounded name and exact-binding status")]),
        ProviderActionTemplate(
            actionKey: "luma_calendar_get", displayName: "Read bound Luma Calendar",
            summary: "Read useful bounded fields for the one Calendar scoped to the customer-owned key.",
            kind: .read, riskLevel: .medium, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: [], capabilityKeys: ["calendar_read"],
            payloadSchema: [:], resultSchema: ["calendar": .string("transient Calendar name, URL, and city-level location")]),
        ProviderActionTemplate(
            actionKey: "luma_calendar_events_list", displayName: "List managed Luma Events",
            summary: "List at most ten approved Luma Events managed by the bound Calendar in an explicit date window.",
            kind: .read, riskLevel: .medium, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: [], capabilityKeys: ["event_read"],
            payloadSchema: [
                "after": .string("required ISO 8601 date-time with offset"),
                "before": .string("optional ISO 8601 date-time with offset; maximum 366-day window"),
                "limit": .string("optional integer 1-10"),
            ], resultSchema: ["events": .string("transient approved/manage-only Event summaries")]),
        ProviderActionTemplate(
            actionKey: "luma_event_get", displayName: "Read one Luma Event",
            summary: "Read one explicit managed Event without guest-only address, meeting, host, or guest details.",
            kind: .read, riskLevel: .medium, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: [], capabilityKeys: ["event_read"],
            payloadSchema: ["eventId": .string("required Luma evt- identifier")],
            resultSchema: ["event": .string("transient Event schedule, URL, visibility, and city-level location")])
    ]

    private static let hopinTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "hopin_organization_get", displayName: "Read bound RingCentral Events Organization", summary: "Verify the exact configured Organization without exposing its ID or email.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: [], capabilityKeys: ["organization_read"], payloadSchema: [:], resultSchema: ["organization": .string("transient bounded name and exact-binding status")]),
        ProviderActionTemplate(
            actionKey: "hopin_organization_events_list", displayName: "List RingCentral Events Organization Events", summary: "List at most ten first-page Events for the exact bound Organization.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: [], capabilityKeys: ["event_read"], payloadSchema: ["limit": .string("optional integer 1-10")], resultSchema: ["events": .string("transient bounded Event summaries")]),
        ProviderActionTemplate(
            actionKey: "hopin_event_get", displayName: "Read one RingCentral Events Event", summary: "Read one Event verified on the bound Organization's first bounded page.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: [],
            capabilityKeys: ["event_read"], payloadSchema: ["eventId": .string("required bounded Events API identifier")], resultSchema: ["event": .string("transient bounded Event fields without private metadata")]),
        ProviderActionTemplate(
            actionKey: "hopin_event_schedule_items_list", displayName: "List RingCentral Events Schedule Items", summary: "List at most ten Schedule Items for a verified Event without speaker data.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: [], capabilityKeys: ["schedule_read"], payloadSchema: ["eventId": .string("required bounded Events API identifier"), "limit": .string("optional integer 1-10")], resultSchema: ["scheduleItems": .string("transient bounded Schedule Item summaries")])
    ]

    private static let twistTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "twist_user_get", displayName: "Read connected Twist user",
            summary: "Verify the OAuth-authorized Twist user through the fixed session-user endpoint.",
            kind: .read, riskLevel: .low, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: ["user:read"], capabilityKeys: ["user_read"],
            payloadSchema: [:],
            resultSchema: ["user": .string("transient userId, name, optional email and timezone")]),
        ProviderActionTemplate(
            actionKey: "twist_workspaces_list", displayName: "List Twist workspaces",
            summary: "List at most twenty workspaces available to the connected Twist user.",
            kind: .read, riskLevel: .medium, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: ["workspaces:read"], capabilityKeys: ["workspace_read"],
            payloadSchema: ["limit": .string("optional integer 1-20")],
            resultSchema: ["workspaces": .string("transient workspaceId and name array")]),
        ProviderActionTemplate(
            actionKey: "twist_channels_list", displayName: "List Twist workspace channels",
            summary: "List at most fifty channels in one explicitly identified Twist workspace.",
            kind: .read, riskLevel: .medium, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: ["channels:read"], capabilityKeys: ["channel_read"],
            payloadSchema: [
                "workspaceId": .string("required numeric Twist workspace ID"),
                "limit": .string("optional integer 1-50"),
            ], resultSchema: ["channels": .string("transient channelId, workspaceId, name, bounded description and archived state array")]),
        ProviderActionTemplate(
            actionKey: "twist_inbox_threads_list", displayName: "List recent Twist inbox threads",
            summary: "List at most twenty recent active inbox threads in one Twist workspace.",
            kind: .read, riskLevel: .medium, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: ["threads:read"], capabilityKeys: ["inbox_thread_read"],
            payloadSchema: [
                "workspaceId": .string("required numeric Twist workspace ID"),
                "limit": .string("optional integer 1-20"),
            ], resultSchema: ["threads": .string("transient useful thread IDs, workspace/channel IDs, titles, bounded content/snippets, creator and timestamps")]),
        ProviderActionTemplate(
            actionKey: "twist_thread_comments_get", displayName: "Read one Twist thread with comments",
            summary: "Read one explicit Twist thread and at most thirty recent comments with two fixed provider requests.",
            kind: .read, riskLevel: .medium, adapterKind: .nativeAPI,
            defaultPermission: .allowed,
            requiredScopes: ["threads:read", "comments:read"], capabilityKeys: ["thread_comment_read"],
            payloadSchema: [
                "threadId": .string("required numeric Twist thread ID"),
                "commentLimit": .string("optional integer 1-30"),
            ], resultSchema: [
                "thread": .string("transient useful thread fields"),
                "comments": .string("transient bounded commentId, threadId, content, creator and timestamps array"),
                "commentCount": .string("integer returned comment count"),
            ])
    ]

    private static let zohoMailTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "zoho_mail_accounts_list", displayName: "List Zoho Mail accounts",
            summary: "List authenticated Zoho Mail accounts through one fixed regional read.",
            kind: .read, riskLevel: .low, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: ["ZohoMail.accounts.READ"],
            capabilityKeys: ["account_read"], payloadSchema: [:],
            resultSchema: ["accounts": .string("bounded accountId, email, display name and account state/type where returned")]),
        ProviderActionTemplate(
            actionKey: "zoho_mail_folders_list", displayName: "List Zoho Mail account folders",
            summary: "List bounded folders for one verified Zoho Mail account.",
            kind: .read, riskLevel: .medium, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: ["ZohoMail.folders.READ"],
            capabilityKeys: ["folder_read"],
            payloadSchema: ["accountId": .string("required numeric account ID bound to the connection")],
            resultSchema: ["folders": .string("bounded folderId, name, path, type and state array")]),
        ProviderActionTemplate(
            actionKey: "zoho_mail_messages_list_filtered", displayName: "List filtered Zoho Mail messages",
            summary: "Review one bounded filtered message list for a verified account and folder.",
            kind: .read, riskLevel: .medium, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: ["ZohoMail.messages.READ"],
            capabilityKeys: ["message_list_read"],
            payloadSchema: [
                "accountId": .string("required numeric account ID bound to the connection"),
                "folderId": .string("required numeric folder ID"),
                "limit": .string("optional integer 1-25; no automatic pagination"),
            ], resultSchema: ["messages": .string("bounded message IDs, thread IDs, subject, sender, recipients, time, flags and attachment indicator")]),
        ProviderActionTemplate(
            actionKey: "zoho_mail_message_get", displayName: "Read one Zoho Mail message",
            summary: "Read one explicit message with sanitized bounded text and attachment metadata only.",
            kind: .read, riskLevel: .medium, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: ["ZohoMail.messages.READ"],
            capabilityKeys: ["message_read"],
            payloadSchema: [
                "accountId": .string("required numeric account ID bound to the connection"),
                "folderId": .string("required numeric folder ID"),
                "messageId": .string("required numeric message ID"),
            ], resultSchema: ["message": .string("bounded IDs, subject, sender, recipients, time, flags, sanitized text and attachment metadata without binary content")])
    ]

    private static let webexTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "webex_person_get", displayName: "Read connected Webex Person",
            summary: "Read the OAuth-authorized Webex Person identity.",
            kind: .read, riskLevel: .low, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: ["spark:people_read"], capabilityKeys: ["person_read"],
            payloadSchema: [:], resultSchema: ["person": .string("transient displayName and verified binding state without provider ID or email")]),
        ProviderActionTemplate(
            actionKey: "webex_meetings_list", displayName: "List Webex Meetings",
            summary: "List at most ten Meetings accessible to the connected Person without following pagination.",
            kind: .read, riskLevel: .medium, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: ["meeting:schedules_read"], capabilityKeys: ["meeting_list"],
            payloadSchema: ["limit": .string("optional integer 1-10")], resultSchema: ["meetings": .string("transient bounded Meeting summaries")]),
        ProviderActionTemplate(
            actionKey: "webex_meeting_get", displayName: "Read one Webex Meeting",
            summary: "Read one first-page Meeting's bounded schedule fields without identities or join links.",
            kind: .read, riskLevel: .medium, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: ["meeting:schedules_read"], capabilityKeys: ["meeting_read"],
            payloadSchema: ["meetingId": .string("required safe Webex Meeting ID from the first ten Meetings, maximum 256 characters")], resultSchema: ["meeting": .string("transient bounded Meeting schedule fields without meeting numbers, host identities, or join links")])
    ]

    private static let goToMeetingTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "goto_meeting_identity_get", displayName: "Read connected GoTo organizer",
            summary: "Verify the exact OAuth-authorized organizer without returning provider IDs or email addresses.",
            kind: .read, riskLevel: .low, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: [], capabilityKeys: ["identity_read"],
            payloadSchema: [:], resultSchema: ["identity": .string("transient displayName and verified binding state without provider ID or email")]),
        ProviderActionTemplate(
            actionKey: "goto_meeting_upcoming_list", displayName: "List upcoming GoTo Meetings",
            summary: "List at most ten upcoming Meetings for the server-bound connected organizer.",
            kind: .read, riskLevel: .medium, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: [], capabilityKeys: ["meeting_list"],
            payloadSchema: ["limit": .string("optional integer 1-10")], resultSchema: ["meetings": .string("transient bounded subject/schedule/type/status summaries without identities or join data")]),
        ProviderActionTemplate(
            actionKey: "goto_meeting_get", displayName: "Read one GoTo Meeting",
            summary: "Read one Meeting only after its ID appears in the connected organizer's first ten upcoming Meetings.",
            kind: .read, riskLevel: .medium, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: [], capabilityKeys: ["meeting_read"],
            payloadSchema: ["meetingId": .string("required numeric GoTo Meeting ID from the first ten upcoming Meetings, maximum 20 digits")], resultSchema: ["meeting": .string("transient bounded schedule fields without identities, join data, or sensitive artifacts")])
    ]

    private static let ringCentralTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "ringcentral_extension_get", displayName: "Read connected RingCentral extension",
            summary: "Verify the exact OAuth-bound extension without returning provider IDs, extension number or email.",
            kind: .read, riskLevel: .high, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: ["ReadAccounts"], capabilityKeys: ["extension_read"],
            payloadSchema: [:], resultSchema: ["extension": .string("transient bounded display name and verified binding state")]),
        ProviderActionTemplate(
            actionKey: "ringcentral_call_log_list", displayName: "List recent RingCentral call activity",
            summary: "List at most ten first-page Simple-view records with names removed and phone numbers masked.",
            kind: .read, riskLevel: .high, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: ["ReadCallLog"], capabilityKeys: ["call_log_list"],
            payloadSchema: ["limit": .string("optional integer 1-10")],
            resultSchema: ["records": .string("transient bounded call summaries, count and truncation state without names or raw numbers")]),
        ProviderActionTemplate(
            actionKey: "ringcentral_call_log_get", displayName: "Read one RingCentral call-log record",
            summary: "Read one Simple-view record only after its ID appears in the connected extension's first ten recent records.",
            kind: .read, riskLevel: .high, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: ["ReadCallLog"], capabilityKeys: ["call_log_read"],
            payloadSchema: ["recordId": .string("required safe RingCentral record ID, maximum 128 characters")],
            resultSchema: ["record": .string("transient bounded call summary without names, raw numbers, recordings, content or detailed legs")])
    ]

    private static let dialpadTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "dialpad_user_get", displayName: "Read connected Dialpad user",
            summary: "Verify the exact OAuth-bound Dialpad user without returning provider IDs, email, extension or organization metadata.",
            kind: .read, riskLevel: .high, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: ["offline_access"], capabilityKeys: ["user_read"],
            payloadSchema: [:], resultSchema: ["user": .string("transient bounded display name and verified binding state")]),
        ProviderActionTemplate(
            actionKey: "dialpad_caller_id_get", displayName: "Read Dialpad caller-ID choices",
            summary: "Read at most ten deduplicated own-user caller-ID choices from the current Caller ID schema while excluding forwarding numbers.",
            kind: .read, riskLevel: .high, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: ["offline_access"], capabilityKeys: ["caller_id_read"],
            payloadSchema: [:], resultSchema: ["callerIds": .string("transient bounded labels, types, active state, masked numbers, truncation and blocked-active state")])
    ]

    private static let aircallTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "aircall_company_get", displayName: "Read connected Aircall company",
            summary: "Read bounded aggregate details for the exact OAuth-bound Aircall company without provider IDs or installer identity.",
            kind: .read, riskLevel: .high, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: ["public_api"], capabilityKeys: ["company_read"],
            payloadSchema: [:], resultSchema: ["company": .string("transient bounded company name, user/number counts and verified binding state")]),
        ProviderActionTemplate(
            actionKey: "aircall_numbers_list", displayName: "List Aircall phone numbers",
            summary: "Read only the first ten company numbers with masked digits, bounded names, country and availability state.",
            kind: .read, riskLevel: .high, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: ["public_api"], capabilityKeys: ["phone_number_read"],
            payloadSchema: [:], resultSchema: ["numbers": .string("transient first-page list of at most ten privacy-masked number summaries")]),
    ]

    private static let openPhoneTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "openphone_phone_numbers_list", displayName: "List Quo workspace phone numbers",
            summary: "Read only the first ten privacy-masked phone-number labels without provider IDs, users, forwarding, restrictions, or raw digits.",
            kind: .read, riskLevel: .high, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: [], capabilityKeys: ["phone_number_read"],
            payloadSchema: [:], resultSchema: ["numbers": .string("transient list of at most ten bounded names and privacy-masked phone numbers")]),
    ]

    private static let twilioTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "twilio_messages_list", displayName: "List Twilio message statuses",
            summary: "Read only ten privacy-masked direction, status, address-suffix and date summaries without message content or provider identifiers.",
            kind: .read, riskLevel: .high, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: [], capabilityKeys: ["message_status_read"],
            payloadSchema: [:], resultSchema: ["messageStatuses": .string("transient list of at most ten privacy-masked message delivery summaries")]),
    ]

    private static let vonageTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "vonage_account_balance_get", displayName: "Read Vonage account balance",
            summary: "Read only the current Communications APIs account balance in EUR and whether auto-reload is enabled.",
            kind: .read, riskLevel: .high, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: [], capabilityKeys: ["account_balance_read"],
            payloadSchema: [:], resultSchema: ["balanceEUR": .string("bounded current account balance in EUR"), "autoReloadEnabled": .string("current boolean auto-reload state")]),
    ]

    private static let messageBirdTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "messagebird_workspace_status_get", displayName: "Read Bird workspace status",
            summary: "Read only the selected workspace's active, disabled, terminated or deleted lifecycle status.",
            kind: .read, riskLevel: .high, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: [], capabilityKeys: ["workspace_status_read"],
            payloadSchema: [:], resultSchema: ["workspaceStatus": .string("selected Bird workspace lifecycle status")]),
    ]

    private static let fredTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "fred_series_search", displayName: "Search FRED series",
            summary: "Search for at most ten public economic-data series with bounded metadata.",
            kind: .read, riskLevel: .high, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: [], capabilityKeys: ["series_search"],
            payloadSchema: ["query": .string("required printable string, 2-80 characters")],
            resultSchema: ["series": .string("transient list of at most ten bounded series summaries")]),
        ProviderActionTemplate(
            actionKey: "fred_series_observations_get", displayName: "Read recent FRED observations",
            summary: "Read at most 25 newest date/value observations for one validated series identifier.",
            kind: .read, riskLevel: .high, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: [], capabilityKeys: ["series_observations_read"],
            payloadSchema: ["seriesId": .string("required FRED series identifier"), "limit": .string("optional integer 1-25")],
            resultSchema: ["observations": .string("transient newest date/value observations, missing values normalized to null")]),
    ]

    private static let apolloGraphOSTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "apollo_graphos_graph_artifact_get", displayName: "Read graph artifact metadata",
            summary: "Read bounded current OCI artifact location and digest metadata for the configured graph variant.",
            kind: .read, riskLevel: .high, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: [], capabilityKeys: ["graph_artifact_metadata_read"],
            payloadSchema: [:], resultSchema: ["artifact": .string("transient bounded repository, tag, digest and URI metadata")]),
        ProviderActionTemplate(
            actionKey: "apollo_graphos_launch_status_get", displayName: "Read launch status",
            summary: "Read only the status of one exact launch identifier for the configured graph variant.",
            kind: .read, riskLevel: .high, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: [], capabilityKeys: ["launch_status_read"],
            payloadSchema: ["launchId": .string("required Apollo launch identifier")],
            resultSchema: ["status": .string("transient launch status only")]),
    ]

    private static let hunterTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "hunter_account_usage_get", displayName: "Read Hunter account usage",
            summary: "Read reduced plan and current-period request usage without account identity or team data.",
            kind: .read, riskLevel: .high, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: [], capabilityKeys: ["account_usage_read"],
            payloadSchema: [:], resultSchema: ["requests": .string("transient reduced current-period usage")]),
        ProviderActionTemplate(
            actionKey: "hunter_domain_email_count_get", displayName: "Read domain email counts",
            summary: "Read only aggregate total, personal and generic email counts for one domain.",
            kind: .read, riskLevel: .high, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: [], capabilityKeys: ["domain_email_count_read"],
            payloadSchema: ["domain": .string("required validated hostname")], resultSchema: ["counts": .string("transient aggregate counts without contacts")]),
        ProviderActionTemplate(
            actionKey: "hunter_email_verify", displayName: "Verify one email address",
            summary: "Spend Hunter verification credit for one explicit email and return reduced deliverability state.",
            kind: .read, riskLevel: .high, adapterKind: .nativeAPI,
            defaultPermission: .approvalRequired, requiredScopes: [], capabilityKeys: ["email_verification"],
            payloadSchema: ["email": .string("required single email address")], resultSchema: ["verification": .string("transient status, score and technical checks without sources")]),
    ]

    private static let snovTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "snov_email_verification_start", displayName: "Start one Snov.io email verification",
            summary: "Spend one Snov.io credit to submit one explicit email and receive only a task hash.",
            kind: .read, riskLevel: .high, adapterKind: .nativeAPI,
            defaultPermission: .approvalRequired, requiredScopes: [], capabilityKeys: ["email_verification_start"],
            payloadSchema: ["email": .string("required single email address")], resultSchema: ["taskHash": .string("transient Snov.io task identifier only")]),
        ProviderActionTemplate(
            actionKey: "snov_email_verification_result_get", displayName: "Read one Snov.io verification result",
            summary: "Read reduced technical status for one exact task without returning the submitted email.",
            kind: .read, riskLevel: .high, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: [], capabilityKeys: ["email_verification_result_read"],
            payloadSchema: ["taskHash": .string("required Snov.io verification task identifier")], resultSchema: ["verification": .string("transient reduced result without email or provider metadata")]),
    ]

    private static let lushaTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "lusha_account_usage_get", displayName: "Read Lusha account usage",
            summary: "Read reduced credits, plan, rate limits and pricing without accessing business-profile data.",
            kind: .read, riskLevel: .high, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: [], capabilityKeys: ["account_usage_read"],
            payloadSchema: [:], resultSchema: ["accountUsage": .string("transient reduced account-governance snapshot without contact or company data")]),
    ]

    private static let leadIQTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "leadiq_account_usage_get", displayName: "Read LeadIQ account usage",
            summary: "Read reduced subscribed-plan and Universal Credit governance without accessing people or company data.",
            kind: .read, riskLevel: .high, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: [], capabilityKeys: ["account_usage_read"],
            payloadSchema: [:], resultSchema: ["accountUsage": .string("transient reduced no-credit account-governance snapshot without people or company data")]),
    ]

    private static let seamlessAITemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "seamless_company_search", displayName: "Search Seamless.AI companies",
            summary: "Search at most five reduced company-only records by one explicit name or root domain.",
            kind: .read, riskLevel: .high, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: ["public_api_v1"], capabilityKeys: ["company_search"],
            payloadSchema: [
                "companyName": .string("optional company name, 2-160 characters"),
                "companyDomain": .string("optional root domain without protocol"),
                "matchType": .string("default, related, or exact"),
                "limit": .string("optional integer from 1 through 5"),
            ],
            resultSchema: ["companies": .string("transient reduced company-only results without people/contact data")]),
    ]

    private static let rocketReachTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "rocketreach_account_usage_get", displayName: "Read RocketReach account usage",
            summary: "Read reduced plan, Universal Credit and rate-limit governance without accessing people or company data.",
            kind: .read, riskLevel: .high, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: [], capabilityKeys: ["account_usage_read"],
            payloadSchema: [:], resultSchema: ["accountUsage": .string("transient reduced account-governance snapshot without identity, API key, people or company data")]),
    ]

    private static let upLeadTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "uplead_credit_balance_get", displayName: "Read UpLead credit balance",
            summary: "Read only the remaining credit count without returning account email, people or company data.",
            kind: .read, riskLevel: .high, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: [], capabilityKeys: ["account_usage_read"],
            payloadSchema: [:], resultSchema: ["remainingCredits": .string("transient non-negative integer without account identity or profile data")]),
    ]

    private static let wizaTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "wiza_credit_balances_get", displayName: "Read Wiza credit balances",
            summary: "Read only email, phone, export and API credit balances without returning people, company or account-identity data.",
            kind: .read, riskLevel: .high, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: [], capabilityKeys: ["account_usage_read"],
            payloadSchema: [:], resultSchema: [
                "emailCredits": .string("unlimited or a transient non-negative integer"),
                "phoneCredits": .string("unlimited or a transient non-negative integer"),
                "exportCredits": .string("unlimited or a transient non-negative integer"),
                "apiCredits": .string("unlimited or a transient non-negative integer"),
            ]),
    ]

    private static let lineTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "line_profile_get", displayName: "Read connected LINE profile",
            summary: "Read useful public profile fields for the OIDC-bound LINE Login user.",
            kind: .read, riskLevel: .low, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: ["profile", "openid"], capabilityKeys: ["profile_read"],
            payloadSchema: [:], resultSchema: [
                "userId": .string("OIDC-bound LINE user identifier"),
                "displayName": .string("connected LINE display name"),
                "pictureUrl": .string("optional LINE profile image URL"),
                "statusMessage": .string("optional LINE status message"),
            ])
    ]

    private static let pinterestTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "pinterest_user_account_get", displayName: "Read Pinterest user account",
            summary: "Read fixed identity fields for the bound Pinterest user account without persistence.",
            kind: .read, riskLevel: .low, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: ["user_accounts:read"],
            capabilityKeys: ["read_bound_pinterest_user_account"], payloadSchema: [:],
            resultSchema: ["userAccount": .string("transient object with id, username, accountType, optional profile image and website")]),
        ProviderActionTemplate(
            actionKey: "pinterest_public_boards_list", displayName: "List public Pinterest boards",
            summary: "Read one page of at most ten public boards for the bound Pinner without persistence.",
            kind: .read, riskLevel: .medium, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: ["boards:read"],
            capabilityKeys: ["read_public_pinterest_boards"],
            payloadSchema: ["maxResults": .string("optional integer 1-10")],
            resultSchema: [
                "boards": .string("transient array of id, name, description, privacy, owner username, and Pin count"),
                "resultCount": .string("integer"), "nextPageFollowed": .string("false"),
                "providerDataPersisted": .string("false"),
            ]),
        ProviderActionTemplate(
            actionKey: "pinterest_public_pins_list", displayName: "List public Pinterest Pins",
            summary: "Read one page of at most ten public Pins for the bound Pinner without persistence.",
            kind: .read, riskLevel: .medium, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: ["pins:read"],
            capabilityKeys: ["read_public_pinterest_pins"],
            payloadSchema: ["maxResults": .string("optional integer 1-10")],
            resultSchema: [
                "pins": .string("transient array of id, title, description, alt text, link, created time, media type, board and owner"),
                "resultCount": .string("integer"), "nextPageFollowed": .string("false"),
                "providerDataPersisted": .string("false"),
            ]),
        ProviderActionTemplate(
            actionKey: "pinterest_public_pin_get", displayName: "Read public Pinterest Pin",
            summary: "Read one previously surfaced public Pin after proving the connected-account boundary, without persistence.",
            kind: .read, riskLevel: .medium, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: ["pins:read"],
            capabilityKeys: ["read_one_bound_public_pinterest_pin"],
            payloadSchema: ["pinId": .string("required Pin ID previously surfaced for the bound account")],
            resultSchema: [
                "pin": .string("one transient normalized public Pin"),
                "ownershipVerified": .string("true"),
                "providerDataPersisted": .string("false"),
            ])
    ]

    private static let tumblrTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "tumblr_account_get", displayName: "Read Tumblr account",
            summary: "Read the bound Tumblr account and its owned-blog identities without persistence.",
            kind: .read, riskLevel: .low, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: ["basic"],
            capabilityKeys: ["read_bound_tumblr_account"], payloadSchema: [:],
            resultSchema: [
                "account": .string("transient account name and selected-blog binding"),
                "ownedBlogs": .string("transient array of UUID, name, title, URL, primary and type"),
                "providerDataPersisted": .string("false"),
            ]),
        ProviderActionTemplate(
            actionKey: "tumblr_owned_blog_get", displayName: "Read selected Tumblr blog",
            summary: "Read useful profile metadata for the connection-bound owned Tumblr blog.",
            kind: .read, riskLevel: .low, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: ["basic"],
            capabilityKeys: ["read_selected_owned_tumblr_blog"], payloadSchema: [:],
            resultSchema: [
                "blog": .string("transient UUID, name, title, URL, sanitized description, updated time and post count"),
                "ownershipVerified": .string("true"),
                "providerDataPersisted": .string("false"),
            ]),
        ProviderActionTemplate(
            actionKey: "tumblr_owned_blog_recent_posts_list",
            displayName: "List recent published Tumblr posts",
            summary: "Read one page of at most ten recent published posts for the selected owned blog with useful NPF or legacy text.",
            kind: .read, riskLevel: .medium, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: ["basic"],
            capabilityKeys: ["read_selected_owned_tumblr_blog_recent_posts"],
            payloadSchema: [
                "limit": .string("optional integer 1-10"),
                "tag": .string("optional exact tag, maximum 100 characters"),
            ],
            resultSchema: [
                "posts": .string("transient array of idString, postURL, date, timestamp, state, tags, and NPF or legacy text"),
                "resultCount": .string("integer"), "nextPageFollowed": .string("false"),
                "ownershipVerified": .string("true"),
                "providerDataPersisted": .string("false"),
            ]),
    ]

    private static let linkedInTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "linkedin_profile_get",
            displayName: "Read profile",
            summary: "Read signed-in LinkedIn profile basics.",
            kind: .read,
            riskLevel: .low,
            adapterKind: .nativeAPI,
            defaultPermission: .allowed,
            requiredScopes: ["openid", "profile"],
            capabilityKeys: ["read_profile"],
            payloadSchema: [:],
            resultSchema: ["profile": .string("object")]
        ),
        ProviderActionTemplate(
            actionKey: "linkedin_post_draft",
            displayName: "Draft member post",
            summary: "Prepare a LinkedIn member post without publishing.",
            kind: .draft,
            riskLevel: .medium,
            adapterKind: .nativeAPI,
            defaultPermission: .allowed,
            requiredScopes: [],
            capabilityKeys: ["draft_member_posts"],
            payloadSchema: ["text": .string("string")],
            resultSchema: ["draftId": .string("string")]
        ),
        ProviderActionTemplate(
            actionKey: "linkedin_text_post_create",
            displayName: "Create member post",
            summary: "Publish a LinkedIn member post.",
            kind: .write,
            riskLevel: .high,
            adapterKind: .nativeAPI,
            defaultPermission: .approvalRequired,
            requiredScopes: ["w_member_social"],
            capabilityKeys: ["publish_member_posts"],
            payloadSchema: ["text": .string("string")],
            resultSchema: ["postId": .string("string")]
        ),
        ProviderActionTemplate(
            actionKey: "linkedin.dm.send",
            displayName: "Send message",
            summary: "Send a LinkedIn direct message.",
            kind: .message,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["send_message"],
            payloadSchema: ["recipient": .string("string"), "text": .string("string")],
            resultSchema: [:],
            blockedReason: "LinkedIn direct messages are blocked in the V1 Marketplace action template."
        ),
        ProviderActionTemplate(
            actionKey: "linkedin.connection.request",
            displayName: "Request connection",
            summary: "Send a LinkedIn connection request.",
            kind: .admin,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["request_connection"],
            payloadSchema: ["profileUrl": .string("string")],
            resultSchema: [:],
            blockedReason: "LinkedIn connection actions are blocked in the V1 Marketplace action template."
        ),
        ProviderActionTemplate(
            actionKey: "linkedin.browser.scrape",
            displayName: "Browser scrape",
            summary: "Browser automation or scraping against LinkedIn.",
            kind: .admin,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["browser_scrape"],
            payloadSchema: ["url": .string("string")],
            resultSchema: [:],
            blockedReason: "LinkedIn browser automation and scraping are blocked."
        )
    ]

    private static let gmailTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "gmail.messages.search",
            displayName: "Search messages",
            summary: "Search Gmail messages using a scoped query and return redacted message summaries.",
            kind: .search,
            riskLevel: .medium,
            adapterKind: .nativeAPI,
            defaultPermission: .allowed,
            requiredScopes: ["https://www.googleapis.com/auth/gmail.readonly"],
            capabilityKeys: ["search_messages"],
            payloadSchema: ["query": .string("string"), "maxResults": .string("optional integer 1-20")],
            resultSchema: [
                "messages": .string("array of message summaries with id, threadId, from, subject, date, labels, and snippet")
            ]
        ),
        ProviderActionTemplate(
            actionKey: "gmail.message.read",
            displayName: "Read message",
            summary: "Read one Gmail message as task-scoped context.",
            kind: .read,
            riskLevel: .medium,
            adapterKind: .nativeAPI,
            defaultPermission: .allowed,
            requiredScopes: ["https://www.googleapis.com/auth/gmail.readonly"],
            capabilityKeys: ["read_message"],
            payloadSchema: [
                "messageId": .string("string"),
                "format": .string("optional: summary, metadata, or body"),
                "maxBodyChars": .string("optional integer 1-8000")
            ],
            resultSchema: [
                "message": .string("object with headers, snippet, and bounded bodyExcerpt when summary/body is requested")
            ]
        ),
        ProviderActionTemplate(
            actionKey: "gmail.labels.list",
            displayName: "List labels",
            summary: "List Gmail labels available to the connected account.",
            kind: .read,
            riskLevel: .low,
            adapterKind: .nativeAPI,
            defaultPermission: .allowed,
            requiredScopes: ["https://www.googleapis.com/auth/gmail.readonly"],
            capabilityKeys: ["list_labels"],
            payloadSchema: [:],
            resultSchema: ["labels": .string("array")]
        ),
        ProviderActionTemplate(
            actionKey: "gmail.email.prepare",
            displayName: "Prepare email",
            summary: "Prepare an email payload without creating a Gmail draft.",
            kind: .draft,
            riskLevel: .medium,
            adapterKind: .nativeAPI,
            defaultPermission: .allowed,
            requiredScopes: [],
            capabilityKeys: ["prepare_email"],
            payloadSchema: [
                "to": .string("array or comma-separated string"),
                "subject": .string("string"),
                "body": .string("string")
            ],
            resultSchema: ["draftPreview": .string("object")]
        ),
        ProviderActionTemplate(
            actionKey: "gmail.draft.create",
            displayName: "Create draft",
            summary: "Create a Gmail draft for later user review.",
            kind: .write,
            riskLevel: .high,
            adapterKind: .nativeAPI,
            defaultPermission: .approvalRequired,
            requiredScopes: ["https://www.googleapis.com/auth/gmail.compose"],
            capabilityKeys: ["create_draft"],
            payloadSchema: [
                "to": .string("array or comma-separated string"),
                "subject": .string("string"),
                "body": .string("string")
            ],
            resultSchema: ["draftId": .string("string")]
        ),
        ProviderActionTemplate(
            actionKey: "gmail.email.send",
            displayName: "Send email",
            summary: "Send a Gmail message according to the selected Relay approval or Direct writes policy.",
            kind: .message,
            riskLevel: .high,
            adapterKind: .nativeAPI,
            defaultPermission: .approvalRequired,
            requiredScopes: ["https://www.googleapis.com/auth/gmail.compose"],
            capabilityKeys: ["send_email"],
            payloadSchema: [
                "to": .string("array or comma-separated string"),
                "subject": .string("string"),
                "body": .string("string")
            ],
            resultSchema: ["messageId": .string("string")]
        ),
        ProviderActionTemplate(
            actionKey: "gmail.message.delete",
            displayName: "Delete message",
            summary: "Delete a Gmail message.",
            kind: .delete,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["delete_message"],
            payloadSchema: ["messageId": .string("string")],
            resultSchema: [:],
            blockedReason: "Gmail delete actions are blocked in the V1 Marketplace action template."
        ),
        ProviderActionTemplate(
            actionKey: "gmail.settings.modify",
            displayName: "Modify settings",
            summary: "Modify Gmail mailbox settings, filters, forwarding, or delegates.",
            kind: .admin,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["modify_settings"],
            payloadSchema: ["setting": .string("string")],
            resultSchema: [:],
            blockedReason: "Gmail settings and mailbox administration are blocked in V1."
        )
    ]

    private static let googleDocsTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "google_docs_read_document",
            displayName: "Read document",
            summary: "Read bounded human-readable text and structure from one user-specified Google Docs document by URL or document ID.",
            kind: .read,
            riskLevel: .medium,
            adapterKind: .nativeAPI,
            defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.googleDocsRelayOwnedOAuthScopes,
            capabilityKeys: ["read_document", "semantic_document_read"],
            payloadSchema: [
                "documentIdOrUrl": .string("Google Docs URL or document ID"),
                "maxBodyChars": .string("optional integer 1-8000"),
                "includeTables": .string("optional boolean, defaults true"),
                "includeRevision": .string("optional boolean, defaults true")
            ],
            resultSchema: [
                "document": .string("object with documentId, title, revision/version marker when available, headings/outline, bounded paragraph/list/table text, and truncation flags")
            ]
        ),
        ProviderActionTemplate(
            actionKey: "google_docs_prepare_document_update",
            displayName: "Prepare document update",
            summary: "Prepare an exact Google Docs create or update payload locally without mutating Google Docs.",
            kind: .draft,
            riskLevel: .medium,
            adapterKind: .nativeAPI,
            defaultPermission: .allowed,
            requiredScopes: [],
            capabilityKeys: ["prepare_document_update", "prepare_document_create", "payload_hash"],
            payloadSchema: [
                "operation": .string("create or update"),
                "documentIdOrUrl": .string("optional for update"),
                "title": .string("optional title for create"),
                "body": .string("bounded document body or patch description"),
                "requiredRevisionId": .string("optional revision guard for update")
            ],
            resultSchema: [
                "draftPreview": .string("object with normalized payload preview, bounded body preview, exact payload hash, and revision guard")
            ]
        ),
        ProviderActionTemplate(
            actionKey: "google_docs_create_document",
            displayName: "Create document",
            summary: "Create a new Google Docs document from an exact reviewed title/body payload through Relay approval or Direct writes policy.",
            kind: .write,
            riskLevel: .high,
            adapterKind: .nativeAPI,
            defaultPermission: .approvalRequired,
            requiredScopes: ProviderConnectionService.googleDocsRelayOwnedOAuthScopes,
            capabilityKeys: ["create_document"],
            payloadSchema: [
                "title": .string("string"),
                "body": .string("optional bounded text body"),
                "approvalPayloadHash": .string("optional exact payload hash")
            ],
            resultSchema: [
                "documentId": .string("string"),
                "title": .string("string"),
                "revisionId": .string("optional string"),
                "payloadHash": .string("string"),
                "auditId": .string("string")
            ]
        ),
        ProviderActionTemplate(
            actionKey: "google_docs_apply_document_update",
            displayName: "Apply document update",
            summary: "Apply exact reviewed edits to an existing Google Docs document through Relay approval or Direct writes policy.",
            kind: .write,
            riskLevel: .high,
            adapterKind: .nativeAPI,
            defaultPermission: .approvalRequired,
            requiredScopes: ProviderConnectionService.googleDocsRelayOwnedOAuthScopes,
            capabilityKeys: ["apply_document_update", "write_control"],
            payloadSchema: [
                "documentIdOrUrl": .string("Google Docs URL or document ID"),
                "requests": .string("bounded array of Docs batchUpdate requests"),
                "requiredRevisionId": .string("optional stale-write guard"),
                "approvalPayloadHash": .string("optional exact payload hash")
            ],
            resultSchema: [
                "documentId": .string("string"),
                "revisionId": .string("optional string"),
                "payloadHash": .string("string"),
                "auditId": .string("string")
            ]
        ),
        ProviderActionTemplate(
            actionKey: "google_docs_drive_search",
            displayName: "Broad Drive search",
            summary: "Search or list Google Drive broadly to discover documents.",
            kind: .search,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["drive_search", "drive_list", "document_discovery"],
            payloadSchema: ["query": .string("string")],
            resultSchema: [:],
            blockedReason: "Broad Drive search/list is blocked in Google Docs V1; agents may read only user-specified document URLs or IDs."
        ),
        ProviderActionTemplate(
            actionKey: "google_docs_export_document",
            displayName: "Export document",
            summary: "Export, download, or bulk-copy Google Docs content as files.",
            kind: .read,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["export_document", "download_document", "bulk_copy"],
            payloadSchema: ["documentIdOrUrl": .string("string"), "format": .string("optional export format")],
            resultSchema: [:],
            blockedReason: "Google Docs export/download and broad content movement are deferred from V1."
        ),
        ProviderActionTemplate(
            actionKey: "google_docs_comments_suggestions",
            displayName: "Comments or suggestions",
            summary: "Read, create, resolve, or modify Google Docs comments and suggestions.",
            kind: .admin,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["comments", "suggestions", "collaboration_state"],
            payloadSchema: ["documentIdOrUrl": .string("string"), "commentOrSuggestion": .string("object")],
            resultSchema: [:],
            blockedReason: "Comments and suggestions are collaboration-sensitive and deferred from Google Docs V1."
        ),
        ProviderActionTemplate(
            actionKey: "google_docs_permissions_sharing",
            displayName: "Share or change permissions",
            summary: "Share documents, publish documents, transfer ownership, or change permissions.",
            kind: .admin,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["share_document", "change_permissions", "publish_document", "transfer_ownership"],
            payloadSchema: ["documentIdOrUrl": .string("string"), "permission": .string("object")],
            resultSchema: [:],
            blockedReason: "Google Docs sharing, permission changes, publishing, and ownership transfer are blocked in V1."
        ),
        ProviderActionTemplate(
            actionKey: "google_docs_delete_or_move_document",
            displayName: "Delete, trash, or move document",
            summary: "Delete, trash, move, or restore Google Docs documents through Drive.",
            kind: .delete,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["delete_document", "trash_document", "move_document", "restore_document"],
            payloadSchema: ["documentIdOrUrl": .string("string")],
            resultSchema: [:],
            blockedReason: "Google Docs delete, trash, move, and restore actions are blocked in V1."
        ),
        ProviderActionTemplate(
            actionKey: "google_docs_domain_wide_delegation",
            displayName: "Domain-wide delegation",
            summary: "Use service-account, admin, or domain-wide-delegation access for Google Docs.",
            kind: .admin,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["service_account", "domain_wide_delegation", "workspace_admin"],
            payloadSchema: ["serviceAccount": .string("object")],
            resultSchema: [:],
            blockedReason: "Google Docs service accounts, Workspace admin access, and domain-wide delegation are out of scope for the Relay-owned user-consent OAuth loop."
        ),
        ProviderActionTemplate(
            actionKey: "google_docs_raw_mcp_call",
            displayName: "Raw MCP call",
            summary: "Expose or invoke raw Google Workspace/Google Docs MCP tools directly.",
            kind: .admin,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["raw_mcp", "raw_workspace_tool"],
            payloadSchema: ["toolName": .string("string"), "arguments": .string("object")],
            resultSchema: [:],
            blockedReason: "Raw Google Workspace MCP exposure is blocked; agents may receive only Relay policy-scoped wrappers."
        ),
        ProviderActionTemplate(
            actionKey: "google_docs_media_extraction",
            displayName: "Extract media",
            summary: "Extract images, drawings, attachments, or embedded media from Google Docs.",
            kind: .read,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["extract_images", "extract_drawings", "extract_attachments"],
            payloadSchema: ["documentIdOrUrl": .string("string")],
            resultSchema: [:],
            blockedReason: "Google Docs embedded media extraction is blocked in V1 pending a separate size, privacy, and semantic-contract decision."
        )
    ]

    private static let slackTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "slack_conversation_search",
            displayName: "Search Slack conversations",
            summary: "Search bounded Slack channel context available to the connected Relay Slack app.",
            kind: .search,
            riskLevel: .medium,
            adapterKind: .nativeAPI,
            defaultPermission: .allowed,
            requiredScopes: ["channels:read", "channels:history"],
            capabilityKeys: ["conversation_search", "bounded_channel_context"],
            payloadSchema: [
                "query": .string("string"),
                "channelId": .string("optional Slack channel ID"),
                "maxResults": .string("optional integer 1-25"),
                "maxMessageChars": .string("optional integer 1-4000")
            ],
            resultSchema: [
                "messages": .string("bounded array with channel id/name, timestamp, sender label, excerpt, permalink when available, and truncation flags")
            ]
        ),
        ProviderActionTemplate(
            actionKey: "slack_conversation_history_read",
            displayName: "Read Slack channel history",
            summary: "Read recent bounded message history from one Slack channel available to the connected Relay Slack app.",
            kind: .read,
            riskLevel: .medium,
            adapterKind: .nativeAPI,
            defaultPermission: .allowed,
            requiredScopes: ["channels:read", "channels:history"],
            capabilityKeys: ["conversation_history_read", "bounded_channel_context"],
            payloadSchema: [
                "channelId": .string("Slack channel ID"),
                "oldest": .string("optional Slack timestamp lower bound"),
                "latest": .string("optional Slack timestamp upper bound"),
                "limit": .string("optional integer 1-50"),
                "maxMessageChars": .string("optional integer 1-4000")
            ],
            resultSchema: [
                "channel": .string("object with id/name when available"),
                "messages": .string("bounded array with timestamp, sender label, excerpt, and truncation flags")
            ]
        ),
        ProviderActionTemplate(
            actionKey: "slack_message_draft",
            displayName: "Prepare Slack message draft",
            summary: "Prepare an exact Slack channel or direct-message payload locally without sending it.",
            kind: .draft,
            riskLevel: .medium,
            adapterKind: .nativeAPI,
            defaultPermission: .allowed,
            requiredScopes: [],
            capabilityKeys: ["message_draft", "payload_hash"],
            payloadSchema: [
                "conversationId": .string("Slack channel, group, or user conversation ID"),
                "text": .string("message text"),
                "threadTs": .string("optional parent Slack timestamp"),
                "blocks": .string("optional bounded Slack Block Kit JSON"),
                "approvalPayloadHash": .string("optional exact payload hash")
            ],
            resultSchema: [
                "draftPreview": .string("object with destination summary, bounded text preview, payload hash, and blocked-content warnings")
            ]
        ),
        ProviderActionTemplate(
            actionKey: "slack_message_send",
            displayName: "Send Slack message",
            summary: "Send an exact reviewed Slack message through Relay approval or Direct writes policy.",
            kind: .message,
            riskLevel: .high,
            adapterKind: .nativeAPI,
            defaultPermission: .approvalRequired,
            requiredScopes: ["chat:write"],
            capabilityKeys: ["message_send", "approval_gated_send"],
            payloadSchema: [
                "conversationId": .string("Slack channel, group, or user conversation ID"),
                "text": .string("message text"),
                "threadTs": .string("optional parent Slack timestamp"),
                "blocks": .string("optional bounded Slack Block Kit JSON"),
                "approvalPayloadHash": .string("optional exact payload hash")
            ],
            resultSchema: [
                "channelId": .string("Slack conversation ID"),
                "messageTs": .string("Slack message timestamp"),
                "permalink": .string("optional permalink"),
                "payloadHash": .string("string"),
                "auditId": .string("string")
            ]
        ),
        ProviderActionTemplate(
            actionKey: "slack_user_lookup",
            displayName: "Look up Slack user",
            summary: "Read bounded Slack user profile metadata needed for names and message attribution.",
            kind: .read,
            riskLevel: .low,
            adapterKind: .nativeAPI,
            defaultPermission: .allowed,
            requiredScopes: ["users:read"],
            capabilityKeys: ["user_lookup", "message_attribution"],
            payloadSchema: [
                "userId": .string("Slack user ID")
            ],
            resultSchema: [
                "user": .string("object with id, display name, real name when available, and deleted/bot flags")
            ]
        ),
        ProviderActionTemplate(
            actionKey: "slack_workspace_admin",
            displayName: "Workspace administration",
            summary: "Create, modify, delete, or administer Slack workspaces, channels, users, apps, or permissions.",
            kind: .admin,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["workspace_admin", "channel_admin", "user_admin"],
            payloadSchema: ["operation": .string("string")],
            resultSchema: [:],
            blockedReason: "Slack workspace, channel, app, and user administration are blocked in V1."
        ),
        ProviderActionTemplate(
            actionKey: "slack_bulk_export",
            displayName: "Bulk export Slack data",
            summary: "Export broad Slack workspace, channel, file, or message datasets.",
            kind: .read,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["bulk_export", "file_export"],
            payloadSchema: ["scope": .string("string")],
            resultSchema: [:],
            blockedReason: "Broad Slack export, file download, and workspace-wide history export are blocked in V1."
        ),
        ProviderActionTemplate(
            actionKey: "slack_raw_api_call",
            displayName: "Raw Slack API call",
            summary: "Expose or invoke raw Slack Web API methods directly.",
            kind: .admin,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["raw_api"],
            payloadSchema: [
                "method": .string("Slack Web API method"),
                "arguments": .string("object")
            ],
            resultSchema: [:],
            blockedReason: "Raw Slack API exposure is blocked; agents may receive only Relay policy-scoped wrappers."
        )
    ]

    private static let githubTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "github_repo_search",
            displayName: "Search GitHub repositories",
            summary: "Search accessible GitHub repositories with a bounded query and return metadata-only summaries.",
            kind: .search,
            riskLevel: .medium,
            adapterKind: .nativeAPI,
            defaultPermission: .allowed,
            requiredScopes: ["public_repo"],
            capabilityKeys: ["repo_search", "bounded_repository_context"],
            payloadSchema: [
                "query": .string("string"),
                "owner": .string("optional owner or organization"),
                "maxResults": .string("optional integer 1-25")
            ],
            resultSchema: [
                "repositories": .string("bounded array with owner/name, description, visibility, default branch, updated time, URL, and truncation flags")
            ]
        ),
        ProviderActionTemplate(
            actionKey: "github_issue_list",
            displayName: "List GitHub issues",
            summary: "List bounded issue context for one selected GitHub repository.",
            kind: .read,
            riskLevel: .medium,
            adapterKind: .nativeAPI,
            defaultPermission: .allowed,
            requiredScopes: ["public_repo"],
            capabilityKeys: ["issue_list", "bounded_issue_context"],
            payloadSchema: [
                "owner": .string("repository owner"),
                "repo": .string("repository name"),
                "state": .string("optional: open, closed, or all"),
                "labels": .string("optional comma-separated labels"),
                "maxResults": .string("optional integer 1-50"),
                "maxBodyChars": .string("optional integer 1-4000")
            ],
            resultSchema: [
                "issues": .string("bounded array with number, title, state, author, labels, URL, updated time, and body excerpt")
            ]
        ),
        ProviderActionTemplate(
            actionKey: "github_pull_request_list",
            displayName: "List GitHub pull requests",
            summary: "List bounded pull request context for one selected GitHub repository.",
            kind: .read,
            riskLevel: .medium,
            adapterKind: .nativeAPI,
            defaultPermission: .allowed,
            requiredScopes: ["public_repo"],
            capabilityKeys: ["pull_request_list", "bounded_pull_request_context"],
            payloadSchema: [
                "owner": .string("repository owner"),
                "repo": .string("repository name"),
                "state": .string("optional: open, closed, or all"),
                "maxResults": .string("optional integer 1-50"),
                "maxBodyChars": .string("optional integer 1-4000")
            ],
            resultSchema: [
                "pullRequests": .string("bounded array with number, title, state, author, labels, URL, updated time, and body excerpt")
            ]
        ),
        ProviderActionTemplate(
            actionKey: "github_issue_comment_prepare",
            displayName: "Prepare GitHub issue comment",
            summary: "Prepare an exact GitHub issue comment payload locally without posting it.",
            kind: .draft,
            riskLevel: .medium,
            adapterKind: .nativeAPI,
            defaultPermission: .allowed,
            requiredScopes: [],
            capabilityKeys: ["issue_comment_draft", "payload_hash"],
            payloadSchema: [
                "owner": .string("repository owner"),
                "repo": .string("repository name"),
                "issueNumber": .string("issue number"),
                "body": .string("comment markdown"),
                "approvalPayloadHash": .string("optional exact payload hash")
            ],
            resultSchema: [
                "draftPreview": .string("object with destination summary, bounded body preview, payload hash, and blocked-content warnings")
            ]
        ),
        ProviderActionTemplate(
            actionKey: "github_issue_comment_create",
            displayName: "Create GitHub issue comment",
            summary: "Post an exact reviewed comment to a GitHub issue through Relay approval or Direct writes policy.",
            kind: .message,
            riskLevel: .high,
            adapterKind: .nativeAPI,
            defaultPermission: .approvalRequired,
            requiredScopes: ["public_repo"],
            capabilityKeys: ["issue_comment_create", "approval_gated_comment"],
            payloadSchema: [
                "owner": .string("repository owner"),
                "repo": .string("repository name"),
                "issueNumber": .string("issue number"),
                "body": .string("comment markdown"),
                "approvalPayloadHash": .string("optional exact payload hash")
            ],
            resultSchema: [
                "commentId": .string("string"),
                "htmlUrl": .string("string"),
                "payloadHash": .string("string"),
                "auditId": .string("string")
            ]
        ),
        ProviderActionTemplate(
            actionKey: "github_pull_request_comment_create",
            displayName: "Create GitHub pull request comment",
            summary: "Post an exact reviewed comment to a GitHub pull request through Relay approval or Direct writes policy.",
            kind: .message,
            riskLevel: .high,
            adapterKind: .nativeAPI,
            defaultPermission: .approvalRequired,
            requiredScopes: ["public_repo"],
            capabilityKeys: ["pull_request_comment_create", "approval_gated_comment"],
            payloadSchema: [
                "owner": .string("repository owner"),
                "repo": .string("repository name"),
                "pullNumber": .string("pull request number"),
                "body": .string("comment markdown"),
                "approvalPayloadHash": .string("optional exact payload hash")
            ],
            resultSchema: [
                "commentId": .string("string"),
                "htmlUrl": .string("string"),
                "payloadHash": .string("string"),
                "auditId": .string("string")
            ]
        ),
        ProviderActionTemplate(
            actionKey: "github_repo_admin",
            displayName: "Repository administration",
            summary: "Create, delete, transfer, archive, or administer GitHub repositories, teams, collaborators, settings, or permissions.",
            kind: .admin,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["repo_admin", "collaborator_admin", "settings_admin"],
            payloadSchema: ["operation": .string("string")],
            resultSchema: [:],
            blockedReason: "GitHub repository, team, collaborator, and settings administration are blocked in V1."
        ),
        ProviderActionTemplate(
            actionKey: "github_workflow_write",
            displayName: "Workflow mutation",
            summary: "Create, edit, dispatch, or mutate GitHub Actions workflows and workflow secrets.",
            kind: .admin,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["workflow_write", "actions_admin", "secret_mutation"],
            payloadSchema: ["operation": .string("string")],
            resultSchema: [:],
            blockedReason: "GitHub Actions workflow mutation and workflow secrets are blocked in V1."
        ),
        ProviderActionTemplate(
            actionKey: "github_branch_protection_admin",
            displayName: "Branch protection changes",
            summary: "Modify branch protection rules, required checks, environments, or deployment gates.",
            kind: .admin,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["branch_protection_admin", "environment_admin"],
            payloadSchema: ["operation": .string("string")],
            resultSchema: [:],
            blockedReason: "GitHub branch protection, environment, and deployment gate changes are blocked in V1."
        ),
        ProviderActionTemplate(
            actionKey: "github_broad_code_export",
            displayName: "Broad code export",
            summary: "Clone, download, or broadly export repositories, source trees, releases, artifacts, packages, or attachments.",
            kind: .read,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["broad_code_export", "repo_clone", "artifact_download"],
            payloadSchema: ["scope": .string("string")],
            resultSchema: [:],
            blockedReason: "Broad GitHub code export, clone, artifact download, and package extraction are blocked in V1."
        ),
        ProviderActionTemplate(
            actionKey: "github_raw_api_call",
            displayName: "Raw GitHub API call",
            summary: "Expose or invoke raw GitHub REST or GraphQL API methods directly.",
            kind: .admin,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["raw_api", "raw_graphql"],
            payloadSchema: [
                "method": .string("GitHub API method"),
                "path": .string("GitHub REST path or GraphQL operation"),
                "arguments": .string("object")
            ],
            resultSchema: [:],
            blockedReason: "Raw GitHub API exposure is blocked; agents may receive only Relay policy-scoped wrappers."
        )
    ]

    private static let gitLabTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "gitlab_project_search",
            displayName: "Search GitLab projects",
            summary: "Search accessible GitLab projects with a bounded query and return metadata-only summaries.",
            kind: .search,
            riskLevel: .medium,
            adapterKind: .nativeAPI,
            defaultPermission: .allowed,
            requiredScopes: ["read_api"],
            capabilityKeys: ["project_search", "bounded_project_context"],
            payloadSchema: [
                "query": .string("string"),
                "group": .string("optional group namespace"),
                "maxResults": .string("optional integer 1-25")
            ],
            resultSchema: [
                "projects": .string("bounded array with path, name, description, visibility, default branch, updated time, URL, and truncation flags")
            ]
        ),
        ProviderActionTemplate(
            actionKey: "gitlab_issue_list",
            displayName: "List GitLab issues",
            summary: "List bounded issue context for one selected GitLab project.",
            kind: .read,
            riskLevel: .medium,
            adapterKind: .nativeAPI,
            defaultPermission: .allowed,
            requiredScopes: ["read_api"],
            capabilityKeys: ["issue_list", "bounded_issue_context"],
            payloadSchema: [
                "projectPath": .string("project path or numeric id"),
                "state": .string("optional: opened, closed, or all"),
                "labels": .string("optional comma-separated labels"),
                "maxResults": .string("optional integer 1-50"),
                "maxBodyChars": .string("optional integer 1-4000")
            ],
            resultSchema: [
                "issues": .string("bounded array with iid, title, state, author, labels, URL, updated time, and body excerpt")
            ]
        ),
        ProviderActionTemplate(
            actionKey: "gitlab_merge_request_list",
            displayName: "List GitLab merge requests",
            summary: "List bounded merge request context for one selected GitLab project.",
            kind: .read,
            riskLevel: .medium,
            adapterKind: .nativeAPI,
            defaultPermission: .allowed,
            requiredScopes: ["read_api"],
            capabilityKeys: ["merge_request_list", "bounded_merge_request_context"],
            payloadSchema: [
                "projectPath": .string("project path or numeric id"),
                "state": .string("optional: opened, closed, merged, or all"),
                "maxResults": .string("optional integer 1-50"),
                "maxBodyChars": .string("optional integer 1-4000")
            ],
            resultSchema: [
                "mergeRequests": .string("bounded array with iid, title, state, author, reviewers, URL, updated time, and body excerpt")
            ]
        ),
        ProviderActionTemplate(
            actionKey: "gitlab_issue_comment_prepare",
            displayName: "Prepare GitLab issue comment",
            summary: "Prepare an exact GitLab issue comment payload locally without posting it.",
            kind: .draft,
            riskLevel: .medium,
            adapterKind: .nativeAPI,
            defaultPermission: .allowed,
            requiredScopes: [],
            capabilityKeys: ["issue_comment_draft", "payload_hash"],
            payloadSchema: [
                "projectPath": .string("project path or numeric id"),
                "issueIid": .string("issue iid"),
                "body": .string("comment markdown"),
                "approvalPayloadHash": .string("optional exact payload hash")
            ],
            resultSchema: [
                "draftPreview": .string("object with destination summary, bounded body preview, payload hash, and blocked-content warnings")
            ]
        ),
        ProviderActionTemplate(
            actionKey: "gitlab_issue_comment_create",
            displayName: "Create GitLab issue comment",
            summary: "Post an exact reviewed comment to a GitLab issue through Relay approval or Direct writes policy.",
            kind: .message,
            riskLevel: .high,
            adapterKind: .nativeAPI,
            defaultPermission: .approvalRequired,
            requiredScopes: ["api"],
            capabilityKeys: ["issue_comment_create", "approval_gated_comment"],
            payloadSchema: [
                "projectPath": .string("project path or numeric id"),
                "issueIid": .string("issue iid"),
                "body": .string("comment markdown"),
                "approvalPayloadHash": .string("optional exact payload hash")
            ],
            resultSchema: [
                "commentId": .string("string"),
                "webUrl": .string("string"),
                "payloadHash": .string("string"),
                "auditId": .string("string")
            ]
        ),
        ProviderActionTemplate(
            actionKey: "gitlab_merge_request_comment_create",
            displayName: "Create GitLab merge request comment",
            summary: "Post an exact reviewed comment to a GitLab merge request through Relay approval or Direct writes policy.",
            kind: .message,
            riskLevel: .high,
            adapterKind: .nativeAPI,
            defaultPermission: .approvalRequired,
            requiredScopes: ["api"],
            capabilityKeys: ["merge_request_comment_create", "approval_gated_comment"],
            payloadSchema: [
                "projectPath": .string("project path or numeric id"),
                "mergeRequestIid": .string("merge request iid"),
                "body": .string("comment markdown"),
                "approvalPayloadHash": .string("optional exact payload hash")
            ],
            resultSchema: [
                "commentId": .string("string"),
                "webUrl": .string("string"),
                "payloadHash": .string("string"),
                "auditId": .string("string")
            ]
        ),
        ProviderActionTemplate(
            actionKey: "gitlab_project_admin",
            displayName: "Project administration",
            summary: "Create, delete, archive, transfer, or administer GitLab projects, members, settings, or permissions.",
            kind: .admin,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["project_admin", "member_admin", "settings_admin"],
            payloadSchema: ["operation": .string("string")],
            resultSchema: [:],
            blockedReason: "GitLab project, member, and settings administration are blocked in V1."
        ),
        ProviderActionTemplate(
            actionKey: "gitlab_cicd_write",
            displayName: "CI/CD mutation",
            summary: "Create, edit, trigger, cancel, or mutate GitLab pipelines, jobs, variables, runners, deploy keys, or CI/CD secrets.",
            kind: .admin,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["cicd_write", "pipeline_admin", "secret_mutation"],
            payloadSchema: ["operation": .string("string")],
            resultSchema: [:],
            blockedReason: "GitLab CI/CD mutation, deploy keys, runners, and secret variables are blocked in V1."
        ),
        ProviderActionTemplate(
            actionKey: "gitlab_branch_protection_admin",
            displayName: "Branch protection changes",
            summary: "Modify protected branches, approval rules, environments, or deployment gates.",
            kind: .admin,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["branch_protection_admin", "environment_admin"],
            payloadSchema: ["operation": .string("string")],
            resultSchema: [:],
            blockedReason: "GitLab branch protection, approval rule, environment, and deployment gate changes are blocked in V1."
        ),
        ProviderActionTemplate(
            actionKey: "gitlab_broad_code_export",
            displayName: "Broad code export",
            summary: "Clone, download, or broadly export projects, source trees, artifacts, packages, registries, or attachments.",
            kind: .read,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["broad_code_export", "project_clone", "artifact_download"],
            payloadSchema: ["scope": .string("string")],
            resultSchema: [:],
            blockedReason: "Broad GitLab code export, clone, artifact download, and package extraction are blocked in V1."
        ),
        ProviderActionTemplate(
            actionKey: "gitlab_raw_api_call",
            displayName: "Raw GitLab API call",
            summary: "Expose or invoke raw GitLab REST, GraphQL, or MCP methods directly.",
            kind: .admin,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["raw_api", "raw_graphql", "raw_mcp"],
            payloadSchema: [
                "method": .string("GitLab API method"),
                "path": .string("GitLab REST path or GraphQL/MCP operation"),
                "arguments": .string("object")
            ],
            resultSchema: [:],
            blockedReason: "Raw GitLab API and MCP exposure is blocked; agents may receive only Relay policy-scoped wrappers."
        )
    ]

    private static let bitbucketTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "bitbucket_repository_search",
            displayName: "Search Bitbucket repositories",
            summary: "Search accessible Bitbucket repositories with a bounded query and return metadata-only summaries.",
            kind: .search,
            riskLevel: .medium,
            adapterKind: .nativeAPI,
            defaultPermission: .allowed,
            requiredScopes: ["repository"],
            capabilityKeys: ["repository_search", "bounded_repository_context"],
            payloadSchema: [
                "query": .string("string"),
                "workspace": .string("optional workspace slug"),
                "maxResults": .string("optional integer 1-25")
            ],
            resultSchema: [
                "repositories": .string("bounded array with full name, description, visibility, default branch, updated time, URL, and redaction status")
            ]
        ),
        ProviderActionTemplate(
            actionKey: "bitbucket_issue_list",
            displayName: "List Bitbucket issues",
            summary: "List bounded issue context for one selected Bitbucket repository.",
            kind: .read,
            riskLevel: .medium,
            adapterKind: .nativeAPI,
            defaultPermission: .allowed,
            requiredScopes: ["issue"],
            capabilityKeys: ["issue_list", "bounded_issue_context"],
            payloadSchema: [
                "repositoryPath": .string("workspace/repository slug"),
                "state": .string("optional issue state"),
                "maxResults": .string("optional integer 1-50"),
                "maxBodyChars": .string("optional integer 1-4000")
            ],
            resultSchema: [
                "issues": .string("bounded array with id, title, state, author, URL, updated time, and body excerpt")
            ]
        ),
        ProviderActionTemplate(
            actionKey: "bitbucket_pull_request_list",
            displayName: "List Bitbucket pull requests",
            summary: "List bounded pull request context for one selected Bitbucket repository.",
            kind: .read,
            riskLevel: .medium,
            adapterKind: .nativeAPI,
            defaultPermission: .allowed,
            requiredScopes: ["issue"],
            capabilityKeys: ["pull_request_list", "bounded_pull_request_context"],
            payloadSchema: [
                "repositoryPath": .string("workspace/repository slug"),
                "state": .string("optional: open, merged, declined, superseded, or all"),
                "maxResults": .string("optional integer 1-50"),
                "maxBodyChars": .string("optional integer 1-4000")
            ],
            resultSchema: [
                "projects": .string("bounded array with id, title, state, lead, URL, updated time, and description excerpt")
            ]
        ),
        ProviderActionTemplate(
            actionKey: "bitbucket_pull_request_comment_prepare",
            displayName: "Prepare Bitbucket pull request comment",
            summary: "Prepare an exact Bitbucket pull request comment payload locally without posting it.",
            kind: .draft,
            riskLevel: .medium,
            adapterKind: .nativeAPI,
            defaultPermission: .allowed,
            requiredScopes: [],
            capabilityKeys: ["pull_request_comment_draft", "payload_hash"],
            payloadSchema: [
                "repositoryPath": .string("workspace/repository slug"),
                "pullRequestId": .string("pull request id"),
                "body": .string("comment markdown"),
                "approvalPayloadHash": .string("optional exact payload hash")
            ],
            resultSchema: [
                "draftPreview": .string("object with destination summary, bounded body preview, payload hash, and blocked-content warnings")
            ]
        ),
        ProviderActionTemplate(
            actionKey: "bitbucket_pull_request_comment_create",
            displayName: "Create Bitbucket pull request comment",
            summary: "Post an exact reviewed comment to a Bitbucket pull request through Relay approval or Direct writes policy.",
            kind: .message,
            riskLevel: .high,
            adapterKind: .nativeAPI,
            defaultPermission: .approvalRequired,
            requiredScopes: ["issue"],
            capabilityKeys: ["pull_request_comment_create", "approval_gated_comment"],
            payloadSchema: [
                "repositoryPath": .string("workspace/repository slug"),
                "pullRequestId": .string("pull request id"),
                "body": .string("comment markdown"),
                "approvalPayloadHash": .string("optional exact payload hash")
            ],
            resultSchema: [
                "commentId": .string("string"),
                "webUrl": .string("string"),
                "payloadHash": .string("string"),
                "auditId": .string("string")
            ]
        ),
        ProviderActionTemplate(
            actionKey: "bitbucket_issue_comment_create",
            displayName: "Create Bitbucket issue comment",
            summary: "Post an exact reviewed comment to a Bitbucket issue through Relay approval or Direct writes policy.",
            kind: .message,
            riskLevel: .high,
            adapterKind: .nativeAPI,
            defaultPermission: .approvalRequired,
            requiredScopes: ["issue"],
            capabilityKeys: ["issue_comment_create", "approval_gated_comment"],
            payloadSchema: [
                "repositoryPath": .string("workspace/repository slug"),
                "issueId": .string("issue id"),
                "body": .string("comment markdown"),
                "approvalPayloadHash": .string("optional exact payload hash")
            ],
            resultSchema: [
                "commentId": .string("string"),
                "webUrl": .string("string"),
                "payloadHash": .string("string"),
                "auditId": .string("string")
            ]
        ),
        ProviderActionTemplate(
            actionKey: "bitbucket_repository_admin",
            displayName: "Repository administration",
            summary: "Create, delete, transfer, administer, or mutate Bitbucket repositories, permissions, branch restrictions, or workspace settings.",
            kind: .admin,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["repository_admin", "workspace_admin", "permission_admin"],
            payloadSchema: ["operation": .string("string")],
            resultSchema: [:],
            blockedReason: "Bitbucket repository, workspace, permission, and branch restriction administration are blocked in V1."
        ),
        ProviderActionTemplate(
            actionKey: "bitbucket_pipeline_write",
            displayName: "Pipeline mutation",
            summary: "Trigger, stop, configure, or mutate Bitbucket Pipelines, deployment settings, variables, or secured values.",
            kind: .admin,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["pipeline_write", "deployment_admin", "secret_mutation"],
            payloadSchema: ["operation": .string("string")],
            resultSchema: [:],
            blockedReason: "Bitbucket Webhook mutation, team administration, and secret variables are blocked in V1."
        ),
        ProviderActionTemplate(
            actionKey: "bitbucket_broad_code_export",
            displayName: "Broad code export",
            summary: "Clone, download, or broadly export repositories, source trees, attachments, artifacts, downloads, or workspaces.",
            kind: .read,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["broad_code_export", "repository_clone", "artifact_download"],
            payloadSchema: ["scope": .string("string")],
            resultSchema: [:],
            blockedReason: "Broad Bitbucket code export, clone, artifact download, and workspace extraction are blocked in V1."
        ),
        ProviderActionTemplate(
            actionKey: "bitbucket_raw_api_call",
            displayName: "Raw Bitbucket API call",
            summary: "Expose or invoke raw Bitbucket REST, GraphQL, or MCP methods directly.",
            kind: .admin,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["raw_api", "raw_graphql", "raw_mcp"],
            payloadSchema: [
                "method": .string("Bitbucket API method"),
                "path": .string("Bitbucket REST path or GraphQL/MCP operation"),
                "arguments": .string("object")
            ],
            resultSchema: [:],
            blockedReason: "Raw Bitbucket API and MCP exposure is blocked; agents may receive only Relay policy-scoped wrappers."
        )
    ]

    private static let linearTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "linear_issue_search",
            displayName: "Search Linear issues",
            summary: "Search accessible Linear issues with a bounded query and return metadata-only summaries.",
            kind: .search,
            riskLevel: .medium,
            adapterKind: .nativeAPI,
            defaultPermission: .allowed,
            requiredScopes: ["issue"],
            capabilityKeys: ["issue_search", "bounded_issue_context"],
            payloadSchema: [
                "query": .string("string"),
                "workspace": .string("optional workspace slug"),
                "maxResults": .string("optional integer 1-25")
            ],
            resultSchema: [
                "issues": .string("bounded array with identifier, title, state, updated time, URL, and redaction status")
            ]
        ),
        ProviderActionTemplate(
            actionKey: "linear_issue_list",
            displayName: "List Linear issues",
            summary: "List bounded issue context for one selected Linear issue.",
            kind: .read,
            riskLevel: .medium,
            adapterKind: .nativeAPI,
            defaultPermission: .allowed,
            requiredScopes: ["issue"],
            capabilityKeys: ["issue_list", "bounded_issue_context"],
            payloadSchema: [
                "teamKey": .string("Linear team key"),
                "state": .string("optional issue state"),
                "maxResults": .string("optional integer 1-50"),
                "maxBodyChars": .string("optional integer 1-4000")
            ],
            resultSchema: [
                "issues": .string("bounded array with id, title, state, author, URL, updated time, and body excerpt")
            ]
        ),
        ProviderActionTemplate(
            actionKey: "linear_project_list",
            displayName: "List Linear projects",
            summary: "List bounded project context for the selected Linear workspace or team.",
            kind: .read,
            riskLevel: .medium,
            adapterKind: .nativeAPI,
            defaultPermission: .allowed,
            requiredScopes: ["issue"],
            capabilityKeys: ["project_list", "bounded_project_context"],
            payloadSchema: [
                "teamKey": .string("optional Linear team key"),
                "state": .string("optional project state"),
                "maxResults": .string("optional integer 1-50"),
                "maxBodyChars": .string("optional integer 1-4000")
            ],
            resultSchema: [
                "projects": .string("bounded array with id, title, state, lead, URL, updated time, and description excerpt")
            ]
        ),
        ProviderActionTemplate(
            actionKey: "linear_issue_comment_prepare",
            displayName: "Prepare Linear issue comment",
            summary: "Prepare an exact Linear issue comment payload locally without posting it.",
            kind: .draft,
            riskLevel: .medium,
            adapterKind: .nativeAPI,
            defaultPermission: .allowed,
            requiredScopes: [],
            capabilityKeys: ["issue_comment_draft", "payload_hash"],
            payloadSchema: [
                "teamKey": .string("Linear team key"),
                "issueId": .string("issue id"),
                "body": .string("comment markdown"),
                "approvalPayloadHash": .string("optional exact payload hash")
            ],
            resultSchema: [
                "draftPreview": .string("object with destination summary, bounded body preview, payload hash, and blocked-content warnings")
            ]
        ),
        ProviderActionTemplate(
            actionKey: "linear_issue_create",
            displayName: "Create Linear issue",
            summary: "Create an exact reviewed Linear issue through Relay approval or Direct writes policy.",
            kind: .message,
            riskLevel: .high,
            adapterKind: .nativeAPI,
            defaultPermission: .approvalRequired,
            requiredScopes: ["issue"],
            capabilityKeys: ["issue_create", "approval_gated_issue_create"],
            payloadSchema: [
                "teamKey": .string("Linear team key"),
                "title": .string("issue title"),
                "description": .string("optional issue description"),
                "approvalPayloadHash": .string("optional exact payload hash")
            ],
            resultSchema: [
                "issueId": .string("string"),
                "webUrl": .string("string"),
                "payloadHash": .string("string"),
                "auditId": .string("string")
            ]
        ),
        ProviderActionTemplate(
            actionKey: "linear_issue_comment_create",
            displayName: "Create Linear issue comment",
            summary: "Post an exact reviewed comment to a Linear issue through Relay approval or Direct writes policy.",
            kind: .message,
            riskLevel: .high,
            adapterKind: .nativeAPI,
            defaultPermission: .approvalRequired,
            requiredScopes: ["issue"],
            capabilityKeys: ["issue_comment_create", "approval_gated_comment"],
            payloadSchema: [
                "teamKey": .string("Linear team key"),
                "issueId": .string("issue id"),
                "body": .string("comment markdown"),
                "approvalPayloadHash": .string("optional exact payload hash")
            ],
            resultSchema: [
                "commentId": .string("string"),
                "webUrl": .string("string"),
                "payloadHash": .string("string"),
                "auditId": .string("string")
            ]
        ),
        ProviderActionTemplate(
            actionKey: "linear_issue_admin",
            displayName: "Workspace administration",
            summary: "Delete, transfer, administer, or broadly mutate Linear issues, teams, permissions, or workspace settings.",
            kind: .admin,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["issue_admin", "workspace_admin", "permission_admin"],
            payloadSchema: ["operation": .string("string")],
            resultSchema: [:],
            blockedReason: "Linear workspace, team, permission, and destructive issue administration are blocked in V1."
        ),
        ProviderActionTemplate(
            actionKey: "linear_pipeline_write",
            displayName: "Webhook and team mutation",
            summary: "Trigger, stop, configure, or mutate Linear webhooks, team settings, variables, or secured values.",
            kind: .admin,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["webhook_write", "team_admin", "secret_mutation"],
            payloadSchema: ["operation": .string("string")],
            resultSchema: [:],
            blockedReason: "Linear Webhook mutation, team administration, and secret variables are blocked in V1."
        ),
        ProviderActionTemplate(
            actionKey: "linear_broad_code_export",
            displayName: "Broad workspace export",
            summary: "Download or broadly export issues, projects, attachments, comments, or workspaces.",
            kind: .read,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["broad_workspace_export", "issue_export", "attachment_download"],
            payloadSchema: ["scope": .string("string")],
            resultSchema: [:],
            blockedReason: "Broad Linear workspace export, issue extraction, attachment download, and workspace extraction are blocked in V1."
        ),
        ProviderActionTemplate(
            actionKey: "linear_raw_api_call",
            displayName: "Raw Linear API call",
            summary: "Expose or invoke raw Linear REST, GraphQL, or MCP methods directly.",
            kind: .admin,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["raw_api", "raw_graphql", "raw_mcp"],
            payloadSchema: [
                "method": .string("Linear API method"),
                "path": .string("Linear REST path or GraphQL/MCP operation"),
                "arguments": .string("object")
            ],
            resultSchema: [:],
            blockedReason: "Raw Linear API and MCP exposure is blocked; agents may receive only Relay policy-scoped wrappers."
        )
    ]

    private static let asanaTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "asana_task_search",
            displayName: "Search Asana tasks",
            summary: "Find bounded tasks in an Asana workspace or project with useful work context.",
            kind: .search, riskLevel: .medium, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: ["tasks:read", "projects:read", "users:read"],
            capabilityKeys: ["task_search", "bounded_task_context"],
            payloadSchema: [
                "workspaceGID": .string("Asana workspace GID"),
                "projectGID": .string("optional Asana project GID"),
                "query": .string("optional task-name query"),
                "completed": .string("optional boolean"),
                "maxResults": .string("optional integer 1-25")
            ],
            resultSchema: ["tasks": .string("bounded array with gid, name, completed, assignee, dueOn, projects, permalinkUrl, modifiedAt, notesExcerpt, and redaction status")]
        ),
        ProviderActionTemplate(
            actionKey: "asana_project_list",
            displayName: "List Asana projects",
            summary: "List bounded accessible projects in one Asana workspace.",
            kind: .read, riskLevel: .medium, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: ["projects:read", "users:read"],
            capabilityKeys: ["project_list", "bounded_project_context"],
            payloadSchema: ["workspaceGID": .string("Asana workspace GID"), "maxResults": .string("optional integer 1-25")],
            resultSchema: ["projects": .string("bounded array with gid, name, archived, owner, team, permalinkUrl, and modifiedAt")]
        ),
        ProviderActionTemplate(
            actionKey: "asana_task_get",
            displayName: "Get Asana task",
            summary: "Read one Asana task's bounded human-meaningful work context.",
            kind: .read, riskLevel: .medium, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: ["tasks:read", "projects:read", "users:read"],
            capabilityKeys: ["task_get", "semantic_task_read"],
            payloadSchema: ["taskGID": .string("Asana task GID"), "maxNotesChars": .string("optional integer 1-4000")],
            resultSchema: ["task": .string("object with gid, name, completed, assignee, dueOn, startOn, projects, permalinkUrl, modifiedAt, createdAt, resourceSubtype, and notesExcerpt")]
        ),
        ProviderActionTemplate(
            actionKey: "asana_task_prepare",
            displayName: "Prepare Asana task",
            summary: "Prepare an exact Asana task create or update payload locally without changing provider state.",
            kind: .draft, riskLevel: .medium, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: [], capabilityKeys: ["task_draft", "payload_hash"],
            payloadSchema: [
                "operation": .string("create or update"), "taskGID": .string("optional Asana task GID for update"),
                "workspaceGID": .string("optional workspace GID for create"), "projectGID": .string("optional project GID"),
                "name": .string("task name"), "notes": .string("optional bounded task notes"),
                "assigneeGID": .string("optional user GID"), "dueOn": .string("optional YYYY-MM-DD"), "completed": .string("optional boolean")
            ],
            resultSchema: ["draftPreview": .string("normalized provider payload, payload hash, and providerMutation=false")]
        ),
        ProviderActionTemplate(
            actionKey: "asana_task_create",
            displayName: "Create Asana task",
            summary: "Create an exact reviewed Asana task through Relay approval or Direct rights.",
            kind: .write, riskLevel: .high, adapterKind: .nativeAPI,
            defaultPermission: .approvalRequired, requiredScopes: ["tasks:write"], capabilityKeys: ["task_create", "approval_gated_task_write"],
            payloadSchema: [
                "workspaceGID": .string("Asana workspace GID"), "projectGID": .string("optional project GID"),
                "name": .string("task name"), "notes": .string("optional bounded task notes"),
                "assigneeGID": .string("optional user GID"), "dueOn": .string("optional YYYY-MM-DD"),
                "approvalPayloadHash": .string("optional exact payload hash")
            ],
            resultSchema: ["gid": .string("string"), "name": .string("string"), "permalinkUrl": .string("string"), "payloadHash": .string("string"), "auditId": .string("string")]
        ),
        ProviderActionTemplate(
            actionKey: "asana_task_update",
            displayName: "Update Asana task",
            summary: "Update an exact reviewed Asana task through Relay approval or Direct rights.",
            kind: .write, riskLevel: .high, adapterKind: .nativeAPI,
            defaultPermission: .approvalRequired, requiredScopes: ["tasks:write"], capabilityKeys: ["task_update", "approval_gated_task_write"],
            payloadSchema: [
                "taskGID": .string("Asana task GID"), "name": .string("optional task name"),
                "notes": .string("optional bounded task notes"), "assigneeGID": .string("optional user GID"),
                "dueOn": .string("optional YYYY-MM-DD"), "completed": .string("optional boolean"),
                "approvalPayloadHash": .string("optional exact payload hash")
            ],
            resultSchema: ["gid": .string("string"), "name": .string("string"), "completed": .string("boolean"), "permalinkUrl": .string("string"), "payloadHash": .string("string"), "auditId": .string("string")]
        ),
        ProviderActionTemplate(
            actionKey: "asana_task_delete", displayName: "Delete Asana task", summary: "Delete an Asana task.",
            kind: .delete, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["task_delete"], payloadSchema: ["taskGID": .string("string")], resultSchema: [:],
            blockedReason: "Asana task deletion is blocked in V1."
        ),
        ProviderActionTemplate(
            actionKey: "asana_project_mutate", displayName: "Mutate Asana project", summary: "Create, update, archive, delete, or change membership of Asana projects.",
            kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["project_write"], payloadSchema: ["operation": .string("string")], resultSchema: [:],
            blockedReason: "Asana project mutation is outside the task-focused V1 scope."
        ),
        ProviderActionTemplate(
            actionKey: "asana_workspace_admin", displayName: "Administer Asana workspace", summary: "Change Asana workspace, team, user, permission, or security settings.",
            kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["workspace_admin", "user_admin"], payloadSchema: ["operation": .string("string")], resultSchema: [:],
            blockedReason: "Asana workspace, team, user, and permission administration are blocked in V1."
        ),
        ProviderActionTemplate(
            actionKey: "asana_webhook_mutate", displayName: "Mutate Asana webhooks", summary: "Create, update, or delete Asana webhooks or persistent event subscriptions.",
            kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["webhook_write"], payloadSchema: ["operation": .string("string")], resultSchema: [:],
            blockedReason: "Asana webhook mutation and persistent subscriptions are blocked in V1."
        ),
        ProviderActionTemplate(
            actionKey: "asana_broad_export", displayName: "Broad Asana export", summary: "Crawl, sync, or broadly export Asana task, project, attachment, or workspace content.",
            kind: .read, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["broad_export", "bulk_task_read"], payloadSchema: ["scope": .string("string")], resultSchema: [:],
            blockedReason: "Broad Asana crawling, synchronization, and export are blocked by V1 privacy and context limits."
        ),
        ProviderActionTemplate(
            actionKey: "asana_raw_api_call", displayName: "Raw Asana API call", summary: "Expose or invoke raw Asana REST, MCP, or provider methods directly.",
            kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["raw_api", "raw_mcp"],
            payloadSchema: ["method": .string("string"), "path": .string("string"), "arguments": .string("object")], resultSchema: [:],
            blockedReason: "Raw Asana API and MCP exposure is blocked; agents receive only Relay policy-scoped wrappers."
        )
    ]

    private static let airtableTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "airtable_base_list", displayName: "List Airtable bases", summary: "List bases included in the OAuth resource grant.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: ["workspacesAndBases:read", "schema.bases:read"],
            capabilityKeys: ["base_list"], payloadSchema: ["maxResults": .string("optional integer 1-25")], resultSchema: ["bases": .string("id, name, permission level, Workspace context")]),
        ProviderActionTemplate(
            actionKey: "airtable_base_schema_get", displayName: "Get Airtable base schema", summary: "Read tables, fields, primary fields, and bounded view metadata for one base.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ["schema.bases:read"], capabilityKeys: ["base_schema"], payloadSchema: ["baseId": .string("Airtable base id"), "maxTables": .string("optional integer 1-25")], resultSchema: ["base": .string("base id plus useful table/field/view schema")]),
        ProviderActionTemplate(
            actionKey: "airtable_table_records", displayName: "List Airtable table records", summary: "Read bounded records with human-readable field values from one table.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: ["data.records:read"],
            capabilityKeys: ["table_records"], payloadSchema: ["baseId": .string("base id"), "tableId": .string("table id or name"), "filterFormula": .string("optional bounded formula"), "viewId": .string("optional view id or name"), "maxResults": .string("optional integer 1-50")],
            resultSchema: ["records": .string("id, created time, human-readable fields, attachment metadata only")]),
        ProviderActionTemplate(
            actionKey: "airtable_record_get", displayName: "Get Airtable record", summary: "Read one record with useful field and bounded comment context.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ["data.records:read", "data.recordComments:read"], capabilityKeys: ["record_get"], payloadSchema: ["baseId": .string("base id"), "tableId": .string("table id or name"), "recordId": .string("record id")],
            resultSchema: ["record": .string("record fields and bounded comments")]),
        ProviderActionTemplate(
            actionKey: "airtable_record_comments", displayName: "List Airtable record comments", summary: "Read bounded comments for one record.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: ["data.recordComments:read"],
            capabilityKeys: ["record_comments"], payloadSchema: ["baseId": .string("base id"), "tableId": .string("table id or name"), "recordId": .string("record id"), "maxResults": .string("optional integer 1-25"), "maxTextChars": .string("optional integer 1-4000")],
            resultSchema: ["comments": .string("id, text excerpt, author, timestamps, parent and reaction summary")]),
        ProviderActionTemplate(
            actionKey: "airtable_record_prepare", displayName: "Prepare Airtable record change", summary: "Prepare record create/update/comment locally without provider mutation.", kind: .draft, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: [],
            capabilityKeys: ["record_draft", "payload_hash"],
            payloadSchema: ["operation": .string("create, update, or comment"), "baseId": .string("base id"), "tableId": .string("table id or name"), "recordId": .string("optional record id"), "fields": .string("optional field object"), "comment": .string("optional comment text")],
            resultSchema: ["draftPreview": .string("normalized payload, hash, providerMutation=false")]),
        ProviderActionTemplate(
            actionKey: "airtable_record_create", displayName: "Create Airtable record", summary: "Create one exact reviewed record.", kind: .write, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: ["data.records:write"],
            capabilityKeys: ["record_create"], payloadSchema: ["baseId": .string("base id"), "tableId": .string("table id or name"), "fields": .string("field object"), "typecast": .string("optional boolean"), "approvalPayloadHash": .string("optional exact hash")],
            resultSchema: ["id": .string("string"), "createdTime": .string("string"), "fields": .string("redacted bounded object"), "payloadHash": .string("string"), "auditId": .string("string")]),
        ProviderActionTemplate(
            actionKey: "airtable_record_update", displayName: "Update Airtable record", summary: "Update exact reviewed fields on one record.", kind: .write, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: ["data.records:write"],
            capabilityKeys: ["record_update"], payloadSchema: ["baseId": .string("base id"), "tableId": .string("table id or name"), "recordId": .string("record id"), "fields": .string("field object"), "typecast": .string("optional boolean"), "approvalPayloadHash": .string("optional exact hash")],
            resultSchema: ["id": .string("string"), "fields": .string("bounded object"), "payloadHash": .string("string"), "auditId": .string("string")]),
        ProviderActionTemplate(
            actionKey: "airtable_record_comment_create", displayName: "Comment on Airtable record", summary: "Create one exact reviewed record comment.", kind: .message, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: ["data.recordComments:write"],
            capabilityKeys: ["record_comment"],
            payloadSchema: ["baseId": .string("base id"), "tableId": .string("table id or name"), "recordId": .string("record id"), "comment": .string("comment text"), "parentCommentId": .string("optional parent comment id"), "approvalPayloadHash": .string("optional exact hash")],
            resultSchema: ["commentId": .string("string"), "textExcerpt": .string("string"), "author": .string("string"), "createdTime": .string("string"), "payloadHash": .string("string"), "auditId": .string("string")]),
        ProviderActionTemplate(
            actionKey: "airtable_record_delete", displayName: "Delete Airtable record", summary: "Delete a record.", kind: .delete, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["record_delete"],
            payloadSchema: ["recordId": .string("string")], resultSchema: [:], blockedReason: "Airtable record deletion is blocked in V1."),
        ProviderActionTemplate(
            actionKey: "airtable_structure_admin", displayName: "Administer Airtable structure", summary: "Create, mutate, or delete Workspaces, bases, tables, fields, or views.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["base_admin", "schema_admin"], payloadSchema: ["operation": .string("string")], resultSchema: [:], blockedReason: "Airtable structure and schema administration are blocked in V1."),
        ProviderActionTemplate(
            actionKey: "airtable_webhook_attachment_mutate", displayName: "Mutate Airtable webhooks or attachments", summary: "Create webhooks or upload/download/delete attachments.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["webhook_write", "attachment_transfer"], payloadSchema: ["operation": .string("string")], resultSchema: [:], blockedReason: "Airtable webhooks and attachment transfer are outside V1."),
        ProviderActionTemplate(
            actionKey: "airtable_broad_export", displayName: "Broad Airtable export", summary: "Crawl, synchronize, upsert, or broadly export bases and records.", kind: .read, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["broad_export", "bulk_sync"], payloadSchema: ["scope": .string("string")], resultSchema: [:], blockedReason: "Broad Airtable sync/export is blocked by privacy, terms, and quota limits."),
        ProviderActionTemplate(
            actionKey: "airtable_raw_api_call", displayName: "Raw Airtable provider call", summary: "Expose arbitrary REST or hosted MCP.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["raw_api", "raw_mcp"],
            payloadSchema: ["method": .string("string"), "path": .string("string")], resultSchema: [:], blockedReason: "Raw Airtable API and MCP exposure is blocked; agents receive only Relay wrappers.")
    ]

    private static let dropboxTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "dropbox_folder_list", displayName: "List Dropbox folder", summary: "List bounded useful file and folder metadata in one Dropbox path.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: ["files.metadata.read"],
            capabilityKeys: ["folder_list"], payloadSchema: ["path": .string("optional Dropbox path; empty means root"), "maxResults": .string("optional integer 1-50")],
            resultSchema: ["entries": .string("entry type, id, name, path, revision, size, modified times, content hash"), "cursor": .string("bounded continuation cursor"), "hasMore": .string("boolean")]),
        ProviderActionTemplate(
            actionKey: "dropbox_entry_get", displayName: "Get Dropbox entry metadata", summary: "Inspect useful metadata for one Dropbox file or folder.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: ["files.metadata.read"],
            capabilityKeys: ["entry_get"], payloadSchema: ["path": .string("Dropbox path or id")], resultSchema: ["entry": .string("typed file/folder metadata")]),
        ProviderActionTemplate(
            actionKey: "dropbox_file_search", displayName: "Search Dropbox files", summary: "Search bounded Dropbox file and folder metadata by human query.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: ["files.metadata.read"],
            capabilityKeys: ["file_search"], payloadSchema: ["query": .string("search text"), "path": .string("optional path scope"), "maxResults": .string("optional integer 1-25")], resultSchema: ["matches": .string("match type and typed metadata"), "hasMore": .string("boolean")]),
        ProviderActionTemplate(
            actionKey: "dropbox_text_upload_prepare", displayName: "Prepare Dropbox text upload", summary: "Normalize a bounded UTF-8 text upload locally without mutating Dropbox.", kind: .draft, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: [],
            capabilityKeys: ["text_upload_draft", "payload_hash"],
            payloadSchema: ["path": .string("absolute destination path"), "text": .string("UTF-8 text up to 256 KiB"), "mode": .string("add or overwrite"), "autorename": .string("optional boolean"), "clientModified": .string("optional ISO timestamp")],
            resultSchema: ["draftPreview": .string("normalized payload, byte count, hash, providerMutation=false")]),
        ProviderActionTemplate(
            actionKey: "dropbox_folder_create", displayName: "Create Dropbox folder", summary: "Create one exact reviewed Dropbox folder.", kind: .write, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: ["files.content.write"],
            capabilityKeys: ["folder_create"], payloadSchema: ["path": .string("absolute destination path"), "autorename": .string("optional boolean"), "approvalPayloadHash": .string("optional exact hash")],
            resultSchema: ["entry": .string("created folder metadata"), "payloadHash": .string("string"), "auditId": .string("string")]),
        ProviderActionTemplate(
            actionKey: "dropbox_text_upload", displayName: "Upload Dropbox text file", summary: "Upload one exact reviewed bounded UTF-8 text file.", kind: .write, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: ["files.content.write"],
            capabilityKeys: ["text_upload"],
            payloadSchema: [
                "path": .string("absolute destination path"), "text": .string("UTF-8 text up to 256 KiB"), "mode": .string("add or overwrite"), "autorename": .string("optional boolean"), "clientModified": .string("optional ISO timestamp"), "approvalPayloadHash": .string("optional exact hash"),
            ], resultSchema: ["entry": .string("uploaded file metadata"), "payloadHash": .string("string"), "auditId": .string("string")]),
        ProviderActionTemplate(
            actionKey: "dropbox_entry_copy", displayName: "Copy Dropbox entry", summary: "Copy one exact reviewed file or folder path.", kind: .write, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: ["files.content.write"],
            capabilityKeys: ["entry_copy"], payloadSchema: ["fromPath": .string("source path or id"), "toPath": .string("absolute destination path"), "autorename": .string("optional boolean"), "approvalPayloadHash": .string("optional exact hash")],
            resultSchema: ["entry": .string("copied entry metadata"), "asyncJobId": .string("optional async job id"), "payloadHash": .string("string"), "auditId": .string("string")]),
        ProviderActionTemplate(
            actionKey: "dropbox_entry_move", displayName: "Move Dropbox entry", summary: "Move one exact reviewed file or folder path.", kind: .write, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: ["files.content.write"],
            capabilityKeys: ["entry_move"], payloadSchema: ["fromPath": .string("source path or id"), "toPath": .string("absolute destination path"), "autorename": .string("optional boolean"), "approvalPayloadHash": .string("optional exact hash")],
            resultSchema: ["entry": .string("moved entry metadata"), "asyncJobId": .string("optional async job id"), "payloadHash": .string("string"), "auditId": .string("string")]),
        ProviderActionTemplate(
            actionKey: "dropbox_entry_delete", displayName: "Delete Dropbox entry", summary: "Delete a Dropbox file or folder.", kind: .delete, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["entry_delete"],
            payloadSchema: ["path": .string("string")], resultSchema: [:], blockedReason: "Dropbox entry deletion and permanent deletion are blocked in V1."),
        ProviderActionTemplate(
            actionKey: "dropbox_sharing_team_admin", displayName: "Administer Dropbox sharing or teams", summary: "Mutate sharing links, members, team content, or administration.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["sharing_admin", "team_admin"], payloadSchema: ["operation": .string("string")], resultSchema: [:], blockedReason: "Dropbox sharing and team administration are blocked in V1."),
        ProviderActionTemplate(
            actionKey: "dropbox_broad_binary_transfer", displayName: "Transfer or export broad Dropbox content", summary: "Download/upload arbitrary binaries or recursively export/synchronize Dropbox content.", kind: .read, riskLevel: .destructive, adapterKind: .unsupported,
            defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["binary_transfer", "broad_export"], payloadSchema: ["scope": .string("string")], resultSchema: [:], blockedReason: "Broad export, sync, and arbitrary binary transfer are blocked by privacy and quota limits."),
        ProviderActionTemplate(
            actionKey: "dropbox_raw_api_call", displayName: "Raw Dropbox provider call", summary: "Expose an arbitrary Dropbox API endpoint.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["raw_api"],
            payloadSchema: ["path": .string("string")], resultSchema: [:], blockedReason: "Raw Dropbox API exposure is blocked; agents receive only Relay wrappers.")
    ]

    private static let boxTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "box_folder_items", displayName: "List Box folder items", summary: "List bounded useful files, folders, and web links in one Box folder.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: ["root_readwrite"],
            capabilityKeys: ["folder_items"], payloadSchema: ["folderId": .string("optional Box folder id; root is 0"), "marker": .string("optional marker"), "maxResults": .string("optional integer 1-50")],
            resultSchema: ["entries": .string("typed item metadata"), "nextMarker": .string("optional marker")]),
        ProviderActionTemplate(
            actionKey: "box_file_get", displayName: "Get Box file", summary: "Inspect useful metadata for one Box file.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: ["root_readwrite"], capabilityKeys: ["file_get"],
            payloadSchema: ["fileId": .string("Box file id")], resultSchema: ["item": .string("file id/name/etag/version/parent/path/owner/status metadata")]),
        ProviderActionTemplate(
            actionKey: "box_folder_get", displayName: "Get Box folder", summary: "Inspect useful metadata for one Box folder.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: ["root_readwrite"], capabilityKeys: ["folder_get"],
            payloadSchema: ["folderId": .string("Box folder id")], resultSchema: ["item": .string("folder id/name/etag/parent/path/owner/status metadata")]),
        ProviderActionTemplate(
            actionKey: "box_content_search", displayName: "Search Box content", summary: "Search bounded Box file and folder metadata.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: ["root_readwrite"], capabilityKeys: ["content_search"],
            payloadSchema: ["query": .string("search text"), "ancestorFolderIds": .string("optional comma-separated folder ids"), "marker": .string("optional marker"), "maxResults": .string("optional integer 1-25")],
            resultSchema: ["entries": .string("typed item metadata"), "nextMarker": .string("optional marker")]),
        ProviderActionTemplate(
            actionKey: "box_text_upload_prepare", displayName: "Prepare Box text upload", summary: "Normalize a bounded UTF-8 text upload locally.", kind: .draft, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: [],
            capabilityKeys: ["text_upload_draft", "payload_hash"], payloadSchema: ["parentFolderId": .string("parent folder id; root is 0"), "name": .string("file name"), "text": .string("UTF-8 text up to 256 KiB")],
            resultSchema: ["draftPreview": .string("normalized payload, bytes, hash, providerMutation=false")]),
        ProviderActionTemplate(
            actionKey: "box_folder_create", displayName: "Create Box folder", summary: "Create one exact reviewed Box folder.", kind: .write, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: ["root_readwrite"], capabilityKeys: ["folder_create"],
            payloadSchema: ["parentFolderId": .string("parent folder id"), "name": .string("folder name"), "approvalPayloadHash": .string("optional exact hash")], resultSchema: ["item": .string("created folder metadata"), "payloadHash": .string("string"), "auditId": .string("string")]),
        ProviderActionTemplate(
            actionKey: "box_text_upload", displayName: "Upload Box text file", summary: "Upload one reviewed bounded UTF-8 text file.", kind: .write, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: ["root_readwrite"], capabilityKeys: ["text_upload"],
            payloadSchema: ["parentFolderId": .string("parent folder id"), "name": .string("file name"), "text": .string("UTF-8 text up to 256 KiB"), "approvalPayloadHash": .string("optional exact hash")],
            resultSchema: ["item": .string("uploaded file metadata"), "payloadHash": .string("string"), "auditId": .string("string")]),
        ProviderActionTemplate(
            actionKey: "box_item_copy", displayName: "Copy Box item", summary: "Copy one reviewed Box file or folder.", kind: .write, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: ["root_readwrite"], capabilityKeys: ["item_copy"],
            payloadSchema: ["itemType": .string("file or folder"), "itemId": .string("Box item id"), "destinationFolderId": .string("destination folder id"), "name": .string("optional new name"), "approvalPayloadHash": .string("optional exact hash")],
            resultSchema: ["item": .string("copied item metadata"), "payloadHash": .string("string"), "auditId": .string("string")]),
        ProviderActionTemplate(
            actionKey: "box_item_move", displayName: "Move Box item", summary: "Move one reviewed Box file or folder with optional etag precondition.", kind: .write, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: ["root_readwrite"],
            capabilityKeys: ["item_move"],
            payloadSchema: ["itemType": .string("file or folder"), "itemId": .string("Box item id"), "destinationFolderId": .string("destination folder id"), "name": .string("optional new name"), "etag": .string("optional last observed etag"), "approvalPayloadHash": .string("optional exact hash")],
            resultSchema: ["item": .string("moved item metadata"), "payloadHash": .string("string"), "auditId": .string("string")]),
        ProviderActionTemplate(
            actionKey: "box_item_delete", displayName: "Delete Box item", summary: "Trash or purge a Box item.", kind: .delete, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["item_delete"],
            payloadSchema: ["itemId": .string("string")], resultSchema: [:], blockedReason: "Box deletion, trash, purge, and restore are blocked in V1."),
        ProviderActionTemplate(
            actionKey: "box_collaboration_enterprise_admin", displayName: "Administer Box collaboration or enterprise", summary: "Mutate collaboration, sharing, users, groups, enterprise, workflows, or webhooks.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported,
            defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["collaboration_admin", "enterprise_admin"], payloadSchema: ["operation": .string("string")], resultSchema: [:], blockedReason: "Box collaboration and enterprise administration are blocked in V1."),
        ProviderActionTemplate(
            actionKey: "box_broad_binary_transfer", displayName: "Transfer or export broad Box content", summary: "Download/upload arbitrary binaries or broadly export/synchronize Box content.", kind: .read, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["binary_transfer", "broad_export"], payloadSchema: ["scope": .string("string")], resultSchema: [:], blockedReason: "Broad export, sync, and arbitrary binary transfer are blocked."),
        ProviderActionTemplate(
            actionKey: "box_raw_api_call", displayName: "Raw Box provider call", summary: "Expose arbitrary Box API or As-User impersonation.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["raw_api", "as_user"],
            payloadSchema: ["path": .string("string")], resultSchema: [:], blockedReason: "Raw Box API and As-User exposure are blocked; agents receive only Relay wrappers.")
    ]

    private static let figmaTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "figma_current_user", displayName: "Get Figma current user", summary: "Read the consenting Figma user identity for connection health.", kind: .read, riskLevel: .low, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: ["current_user:read"],
            capabilityKeys: ["current_user"], payloadSchema: [:], resultSchema: ["user": .string("id, handle, email")]),
        ProviderActionTemplate(
            actionKey: "figma_file_metadata", displayName: "Get Figma file metadata", summary: "Read useful metadata for one explicit Figma file key.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: ["file_metadata:read"],
            capabilityKeys: ["file_metadata"], payloadSchema: ["fileKey": .string("explicit Figma file key")], resultSchema: ["file": .string("name, folder, creator, last toucher, version, role, link access, URL")]),
        ProviderActionTemplate(
            actionKey: "figma_file_nodes", displayName: "Read Figma file nodes", summary: "Read a bounded document/page/frame/node subtree from one explicit file key.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: ["file_content:read"],
            capabilityKeys: ["file_nodes"], payloadSchema: ["fileKey": .string("explicit file key"), "nodeIds": .string("optional comma-separated node ids"), "depth": .string("optional integer 1-4"), "maxNodes": .string("optional integer 1-200"), "maxTextChars": .string("optional integer 1-4000")],
            resultSchema: ["nodes": .string("bounded id/name/type/visibility/text/component/bounds/children"), "truncated": .string("boolean")]),
        ProviderActionTemplate(
            actionKey: "figma_file_comments", displayName: "List Figma file comments", summary: "Read bounded comments for one explicit Figma file key.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: ["file_comments:read"],
            capabilityKeys: ["file_comments"], payloadSchema: ["fileKey": .string("explicit file key"), "maxResults": .string("optional integer 1-25"), "maxTextChars": .string("optional integer 1-4000")],
            resultSchema: ["comments": .string("id, message, user, timestamps, resolution, parent, safe client metadata")]),
        ProviderActionTemplate(
            actionKey: "figma_comment_prepare", displayName: "Prepare Figma comment", summary: "Prepare a root comment or reply locally without provider mutation.", kind: .draft, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: [],
            capabilityKeys: ["comment_draft", "payload_hash"], payloadSchema: ["fileKey": .string("explicit file key"), "message": .string("comment text up to 5000 chars"), "parentCommentId": .string("optional root comment id")],
            resultSchema: ["draftPreview": .string("normalized payload, hash, providerMutation=false")]),
        ProviderActionTemplate(
            actionKey: "figma_comment_create", displayName: "Post Figma comment", summary: "Post one exact reviewed root comment.", kind: .message, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: ["file_comments:write"],
            capabilityKeys: ["comment_create"], payloadSchema: ["fileKey": .string("explicit file key"), "message": .string("comment text"), "approvalPayloadHash": .string("optional exact hash")],
            resultSchema: ["comment": .string("created Figma comment"), "payloadHash": .string("string"), "auditId": .string("string")]),
        ProviderActionTemplate(
            actionKey: "figma_comment_reply", displayName: "Reply to Figma comment", summary: "Post one exact reviewed reply to a root comment.", kind: .message, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: ["file_comments:write"],
            capabilityKeys: ["comment_reply"], payloadSchema: ["fileKey": .string("explicit file key"), "parentCommentId": .string("root comment id"), "message": .string("reply text"), "approvalPayloadHash": .string("optional exact hash")],
            resultSchema: ["comment": .string("created Figma reply"), "payloadHash": .string("string"), "auditId": .string("string")]),
        ProviderActionTemplate(
            actionKey: "figma_comment_delete_react", displayName: "Delete or react to Figma comment", summary: "Delete a comment or mutate reactions.", kind: .delete, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["comment_delete", "reaction_mutate"], payloadSchema: ["commentId": .string("string")], resultSchema: [:], blockedReason: "Figma comment deletion and reactions are blocked in V1."),
        ProviderActionTemplate(
            actionKey: "figma_project_discover", displayName: "Discover Figma projects or teams", summary: "List projects, teams, or broadly discover files.", kind: .read, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["project_discover", "team_discover"], payloadSchema: ["teamId": .string("string")], resultSchema: [:], blockedReason: "Figma project endpoints are unavailable to public OAuth apps and broad discovery is outside V1."),
        ProviderActionTemplate(
            actionKey: "figma_design_admin_mutate", displayName: "Mutate Figma design or administration", summary: "Mutate designs, variables, dev resources, libraries, webhooks, projects, teams, or organization state.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported,
            defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["design_mutate", "organization_admin"], payloadSchema: ["operation": .string("string")], resultSchema: [:], blockedReason: "Figma design and administration surfaces are outside V1."),
        ProviderActionTemplate(
            actionKey: "figma_broad_ingest_export", displayName: "Broadly ingest or export Figma files", summary: "Discover, crawl, index, render, or export broad Figma content.", kind: .read, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["broad_ingest", "asset_export"], payloadSchema: ["scope": .string("string")], resultSchema: [:], blockedReason: "Broad Figma discovery, ingestion, rendering, and export are blocked by terms, privacy, and quota constraints."),
        ProviderActionTemplate(
            actionKey: "figma_raw_api_call", displayName: "Raw Figma provider call", summary: "Expose arbitrary Figma REST or MCP tools.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["raw_api", "raw_mcp"],
            payloadSchema: ["path": .string("string")], resultSchema: [:], blockedReason: "Raw Figma REST/MCP exposure is blocked; agents receive only Relay wrappers.")
    ]

    private static let miroTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "miro_board_list", displayName: "List Miro boards", summary: "List bounded boards visible to the authorized Miro team grant.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: ["boards:read"],
            capabilityKeys: ["board_list"], payloadSchema: ["maxResults": .string("optional integer 1-25"), "cursor": .string("optional Miro cursor")], resultSchema: ["boards": .string("id, name, description, view link, owner, team, timestamps"), "cursor": .string("optional cursor")]),
        ProviderActionTemplate(
            actionKey: "miro_board_get", displayName: "Get Miro board", summary: "Read useful metadata for one explicit Miro board.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: ["boards:read"], capabilityKeys: ["board_get"],
            payloadSchema: ["boardId": .string("Miro board id")], resultSchema: ["board": .string("provider-correct board metadata")]),
        ProviderActionTemplate(
            actionKey: "miro_board_items", displayName: "List Miro board items", summary: "Read bounded cursor-paginated items from one explicit board.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: ["boards:read"],
            capabilityKeys: ["board_items"], payloadSchema: ["boardId": .string("Miro board id"), "itemType": .string("optional Miro item type"), "maxResults": .string("optional integer 1-50"), "cursor": .string("optional Miro cursor")],
            resultSchema: ["items": .string("type, content, style, position, geometry, parent, creators, timestamps"), "cursor": .string("optional cursor")]),
        ProviderActionTemplate(
            actionKey: "miro_item_get", displayName: "Get Miro board item", summary: "Read one explicit board item with spatial and authorship semantics.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: ["boards:read"],
            capabilityKeys: ["item_get"], payloadSchema: ["boardId": .string("Miro board id"), "itemId": .string("Miro item id")], resultSchema: ["item": .string("provider-correct Miro item")]),
        ProviderActionTemplate(
            actionKey: "miro_item_prepare", displayName: "Prepare Miro board item", summary: "Normalize and hash a sticky-note, card, or update payload locally without provider mutation.", kind: .draft, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: [],
            capabilityKeys: ["item_draft", "payload_hash"],
            payloadSchema: [
                "operation": .string("sticky_note, card, or update"), "boardId": .string("Miro board id"), "itemId": .string("required for update"), "itemType": .string("required for update"), "content": .string("content up to 5000 characters"), "title": .string("optional card title"),
                "x": .string("optional x position"), "y": .string("optional y position"), "width": .string("optional width"), "height": .string("optional height"), "parentId": .string("optional parent frame id"),
            ], resultSchema: ["draftPreview": .string("normalized payload, hash, providerMutation=false")]),
        ProviderActionTemplate(
            actionKey: "miro_sticky_note_create", displayName: "Create Miro sticky note", summary: "Create one exact reviewed sticky note on an explicit board.", kind: .write, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: ["boards:write"],
            capabilityKeys: ["sticky_note_create"],
            payloadSchema: ["boardId": .string("Miro board id"), "content": .string("sticky note content"), "x": .string("optional x"), "y": .string("optional y"), "parentId": .string("optional parent frame id"), "approvalPayloadHash": .string("optional exact hash")],
            resultSchema: ["item": .string("created sticky note"), "payloadHash": .string("string"), "auditId": .string("string")]),
        ProviderActionTemplate(
            actionKey: "miro_card_create", displayName: "Create Miro card", summary: "Create one exact reviewed card on an explicit board.", kind: .write, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: ["boards:write"],
            capabilityKeys: ["card_create"],
            payloadSchema: [
                "boardId": .string("Miro board id"), "title": .string("optional card title"), "content": .string("card content"), "x": .string("optional x"), "y": .string("optional y"), "parentId": .string("optional parent frame id"), "approvalPayloadHash": .string("optional exact hash"),
            ], resultSchema: ["item": .string("created card"), "payloadHash": .string("string"), "auditId": .string("string")]),
        ProviderActionTemplate(
            actionKey: "miro_item_update", displayName: "Update Miro board item", summary: "Update exact reviewed content or placement on a supported existing item.", kind: .write, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: ["boards:write"],
            capabilityKeys: ["item_update"],
            payloadSchema: [
                "boardId": .string("Miro board id"), "itemId": .string("Miro item id"), "itemType": .string("sticky_note, card, text, or shape"), "content": .string("replacement content"), "x": .string("optional x"), "y": .string("optional y"), "width": .string("optional width"),
                "height": .string("optional height"), "parentId": .string("optional parent frame id"), "approvalPayloadHash": .string("optional exact hash"),
            ], resultSchema: ["item": .string("updated Miro item"), "payloadHash": .string("string"), "auditId": .string("string")]),
        ProviderActionTemplate(
            actionKey: "miro_item_delete", displayName: "Delete Miro item", summary: "Delete a Miro board item.", kind: .delete, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["item_delete"],
            payloadSchema: ["boardId": .string("string"), "itemId": .string("string")], resultSchema: [:], blockedReason: "Miro item deletion is blocked in V1."),
        ProviderActionTemplate(
            actionKey: "miro_board_connector_admin", displayName: "Administer Miro board or connectors", summary: "Mutate board sharing, members, connectors, tags, webhooks, or application administration.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported,
            defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["board_admin", "connector_mutate", "tag_mutate", "webhook_admin"], payloadSchema: ["operation": .string("string")], resultSchema: [:],
            blockedReason: "Miro board administration, connectors, tags, and webhooks are outside V1."),
        ProviderActionTemplate(
            actionKey: "miro_binary_broad_transfer", displayName: "Transfer or ingest broad Miro content", summary: "Upload or download images, documents, embeds, or broadly crawl board content.", kind: .read, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["binary_transfer", "broad_ingest"], payloadSchema: ["scope": .string("string")], resultSchema: [:], blockedReason: "Miro binary transfer and broad ingestion are blocked by V1 privacy and quota bounds."),
        ProviderActionTemplate(
            actionKey: "miro_raw_api_call", displayName: "Raw Miro provider call", summary: "Expose an arbitrary Miro REST operation.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["raw_api"],
            payloadSchema: ["path": .string("string")], resultSchema: [:], blockedReason: "Raw Miro API exposure is blocked; agents receive only Relay wrappers.")
    ]

    private static let canvaTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "canva_user_get", displayName: "Get Canva user", summary: "Read the consenting Canva user and team identity for connection health.", kind: .read, riskLevel: .low, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: [], capabilityKeys: ["user_get"],
            payloadSchema: [:], resultSchema: ["user": .string("userId, teamId")]),
        ProviderActionTemplate(
            actionKey: "canva_design_list", displayName: "List Canva designs", summary: "Search or list one bounded page of owned/shared Canva design metadata.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: ["design:meta:read"],
            capabilityKeys: ["design_list"], payloadSchema: ["query": .string("optional search, max 255"), "ownership": .string("any, owned, or shared"), "sort_by": .string("Canva design sort"), "maxResults": .string("1-25"), "continuation": .string("opaque Canva continuation")],
            resultSchema: ["designs": .string("title, owner, timestamps, page count, thumbnail dimensions, temporary navigation"), "continuation": .string("opaque continuation")]),
        ProviderActionTemplate(
            actionKey: "canva_design_get", displayName: "Get Canva design", summary: "Read useful metadata for one explicit Canva design.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: ["design:meta:read"], capabilityKeys: ["design_get"],
            payloadSchema: ["designId": .string("Canva design id")], resultSchema: ["design": .string("useful Canva design metadata")]),
        ProviderActionTemplate(
            actionKey: "canva_folder_items", displayName: "List Canva folder items", summary: "List one bounded page of typed items from root, uploads, or an explicit Canva folder.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ["folder:read"], capabilityKeys: ["folder_items"], payloadSchema: ["folderId": .string("default root"), "maxResults": .string("1-25"), "continuation": .string("opaque continuation")],
            resultSchema: ["items": .string("typed folder/design/image safe metadata"), "continuation": .string("opaque continuation")]),
        ProviderActionTemplate(
            actionKey: "canva_design_prepare", displayName: "Prepare Canva design", summary: "Normalize and hash a stable preset/custom blank design request locally.", kind: .draft, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: [],
            capabilityKeys: ["design_draft", "payload_hash"], payloadSchema: ["type": .string("preset or custom"), "presetName": .string("doc, email, presentation, or whiteboard"), "width": .string("custom 40-8000"), "height": .string("custom 40-8000"), "title": .string("optional 1-255")],
            resultSchema: ["draftPreview": .string("normalized payload, hash, providerMutation=false")]),
        ProviderActionTemplate(
            actionKey: "canva_design_create", displayName: "Create Canva design", summary: "Create one reviewed stable preset or custom blank Canva design.", kind: .write, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: ["design:content:write"],
            capabilityKeys: ["design_create"],
            payloadSchema: ["type": .string("preset or custom"), "presetName": .string("stable preset"), "width": .string("custom width"), "height": .string("custom height"), "title": .string("optional title"), "approvalPayloadHash": .string("optional exact hash")],
            resultSchema: ["design": .string("created design metadata"), "payloadHash": .string("string"), "blankDesignWarning": .string("seven-day warning")]),
        ProviderActionTemplate(
            actionKey: "canva_preview_content_export", displayName: "Use Canva preview/content/export APIs", summary: "Read design content/pages, copy/brand-template preview paths, export, or download binary output.", kind: .read, riskLevel: .destructive, adapterKind: .unsupported,
            defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["preview_api", "content_read", "export"], payloadSchema: ["operation": .string("string")], resultSchema: [:],
            blockedReason: "Preview APIs cannot pass public integration review; content/export/binary retrieval is outside V1."),
        ProviderActionTemplate(
            actionKey: "canva_library_collaboration_mutate", displayName: "Mutate Canva library or collaboration", summary: "Mutate assets, folders, permissions, comments, webhooks, autofill, resize, merge, or deletion.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported,
            defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["library_mutate", "collaboration_admin", "delete"], payloadSchema: ["operation": .string("string")], resultSchema: [:], blockedReason: "Canva library, collaboration, generation, and destructive surfaces are outside V1."),
        ProviderActionTemplate(
            actionKey: "canva_raw_api_call", displayName: "Raw Canva provider call", summary: "Expose an arbitrary Canva OpenAPI operation.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["raw_api"],
            payloadSchema: ["path": .string("string")], resultSchema: [:], blockedReason: "Raw Canva API exposure is blocked; agents receive only Relay wrappers.")
    ]

    private static let webflowTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "webflow_site_list", displayName: "List Webflow sites", summary: "List one bounded page of sites authorized for the Webflow App.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: ["sites:read"],
            capabilityKeys: ["site_list"], payloadSchema: ["maxResults": .string("1-25"), "offset": .string("non-negative")], resultSchema: ["sites": .string("safe site metadata"), "pagination": .string("limit, offset, total")]),
        ProviderActionTemplate(
            actionKey: "webflow_site_get", displayName: "Get Webflow site", summary: "Read useful metadata for one explicit authorized Webflow site.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: ["sites:read"], capabilityKeys: ["site_get"],
            payloadSchema: ["siteId": .string("Webflow site id")], resultSchema: ["site": .string("safe site metadata")]),
        ProviderActionTemplate(
            actionKey: "webflow_collection_list", displayName: "List Webflow collections", summary: "List bounded CMS collection metadata for one explicit site.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: ["cms:read"],
            capabilityKeys: ["collection_list"], payloadSchema: ["siteId": .string("Webflow site id")], resultSchema: ["collections": .string("collection identity metadata")]),
        ProviderActionTemplate(
            actionKey: "webflow_collection_get", displayName: "Get Webflow collection schema", summary: "Read the bounded field schema for one explicit CMS collection before interpreting fieldData.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ["cms:read"], capabilityKeys: ["collection_schema"], payloadSchema: ["collectionId": .string("Webflow collection id")], resultSchema: ["collection": .string("identity plus up to 40 typed fields")]),
        ProviderActionTemplate(
            actionKey: "webflow_collection_items", displayName: "List Webflow collection items", summary: "Read one bounded offset-paginated page of staged CMS items.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: ["cms:read"],
            capabilityKeys: ["item_list"], payloadSchema: ["collectionId": .string("Webflow collection id"), "maxResults": .string("1-25"), "offset": .string("non-negative")], resultSchema: ["items": .string("safe staged item metadata and fieldData"), "pagination": .string("limit, offset, total")]),
        ProviderActionTemplate(
            actionKey: "webflow_item_get", displayName: "Get Webflow CMS item", summary: "Read one explicit staged CMS item with bounded useful fieldData.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: ["cms:read"],
            capabilityKeys: ["item_get"], payloadSchema: ["collectionId": .string("Webflow collection id"), "itemId": .string("Webflow item id")], resultSchema: ["item": .string("staged CMS item and fieldData")]),
        ProviderActionTemplate(
            actionKey: "webflow_item_prepare", displayName: "Prepare Webflow CMS change", summary: "Normalize and hash an exact staged item update or explicit item publication locally.", kind: .draft, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: [],
            capabilityKeys: ["item_draft", "payload_hash"],
            payloadSchema: [
                "operation": .string("update or publish"), "collectionId": .string("collection id"), "itemId": .string("required for update"), "fieldData": .string("1-40 explicit editable fields"), "cmsLocaleId": .string("optional locale id"), "itemIds": .string("1-25 explicit ids for publish"),
            ], resultSchema: ["draftPreview": .string("normalized payload, hash, providerMutation=false")]),
        ProviderActionTemplate(
            actionKey: "webflow_item_update", displayName: "Update staged Webflow CMS item", summary: "Patch explicit fieldData on one staged CMS item without publishing it.", kind: .write, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ["cms:write"], capabilityKeys: ["item_update"],
            payloadSchema: ["collectionId": .string("collection id"), "itemId": .string("item id"), "fieldData": .string("1-40 reviewed fields"), "cmsLocaleId": .string("optional locale id"), "approvalPayloadHash": .string("optional exact hash")],
            resultSchema: ["item": .string("updated staged item"), "payloadHash": .string("string"), "published": .string("false")]),
        ProviderActionTemplate(
            actionKey: "webflow_item_publish", displayName: "Publish Webflow CMS items", summary: "Publish 1-25 explicit reviewed staged item IDs from one collection.", kind: .write, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: ["cms:write"],
            capabilityKeys: ["item_publish"], payloadSchema: ["collectionId": .string("collection id"), "itemIds": .string("1-25 explicit ids"), "approvalPayloadHash": .string("optional exact hash")], resultSchema: ["publishedItemIds": .string("explicit ids"), "payloadHash": .string("string")]),
        ProviderActionTemplate(
            actionKey: "webflow_cms_create_delete", displayName: "Create, delete, archive, or unpublish Webflow CMS content", summary: "Perform destructive or lifecycle CMS operations outside the bounded staged-update contract.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported,
            defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["cms_lifecycle"], payloadSchema: ["operation": .string("string")], resultSchema: [:], blockedReason: "CMS creation, deletion, archive, and unpublish are outside V1."),
        ProviderActionTemplate(
            actionKey: "webflow_site_publish_admin", displayName: "Publish or administer Webflow site", summary: "Publish a full site or mutate pages, code, forms, assets, ecommerce, or webhooks.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["site_admin"], payloadSchema: ["operation": .string("string")], resultSchema: [:], blockedReason: "Full-site publish and site administration surfaces are outside V1."),
        ProviderActionTemplate(
            actionKey: "webflow_raw_api_call", displayName: "Raw Webflow provider call", summary: "Expose arbitrary Webflow APIs, including preview or beta surfaces.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["raw_api"], payloadSchema: ["path": .string("string")], resultSchema: [:], blockedReason: "Raw, beta, and broad Webflow API exposure is blocked; agents receive only Relay wrappers.")
    ]

    private static let wordpressComTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "wordpress_com_site_list", displayName: "List WordPress.com sites", summary: "List bounded sites authorized for the current specific-blog grant.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: ["sites"],
            capabilityKeys: ["site_list"], payloadSchema: [:], resultSchema: ["sites": .string("id, name, URL, privacy, Jetpack, capabilities")]),
        ProviderActionTemplate(
            actionKey: "wordpress_com_site_get", displayName: "Get WordPress.com site", summary: "Read useful metadata for one explicit authorized site.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: ["sites"], capabilityKeys: ["site_get"],
            payloadSchema: ["siteId": .string("numeric WordPress.com site id")], resultSchema: ["site": .string("safe site metadata")]),
        ProviderActionTemplate(
            actionKey: "wordpress_com_post_list", displayName: "List WordPress.com posts", summary: "Read one bounded page of posts for an explicit authorized site.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: ["posts"],
            capabilityKeys: ["post_list"], payloadSchema: ["siteId": .string("site id"), "status": .string("optional status"), "type": .string("post or page"), "search": .string("bounded search"), "maxResults": .string("1-25"), "offset": .string("non-negative")],
            resultSchema: ["posts": .string("useful bounded post/editor metadata"), "found": .string("provider total"), "pagination": .string("number and offset")]),
        ProviderActionTemplate(
            actionKey: "wordpress_com_post_get", displayName: "Get WordPress.com post", summary: "Read useful editable metadata and bounded content for one explicit post.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: ["posts"],
            capabilityKeys: ["post_get"], payloadSchema: ["siteId": .string("site id"), "postId": .string("post id")], resultSchema: ["post": .string("status, author, modified, URLs, bounded content and taxonomy summaries")]),
        ProviderActionTemplate(
            actionKey: "wordpress_com_post_prepare", displayName: "Prepare WordPress.com post", summary: "Normalize and hash a draft create, draft update, or publish request locally.", kind: .draft, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: [],
            capabilityKeys: ["post_draft", "payload_hash"],
            payloadSchema: [
                "operation": .string("create, update, or publish"), "siteId": .string("site id"), "postId": .string("update/publish post id"), "expectedModified": .string("update/publish concurrency value"), "title": .string("1-300"), "content": .string("1-50000"), "excerpt": .string("0-2000"),
                "tags": .string("up to 20 existing tag names"), "categories": .string("up to 20 existing category names"),
            ], resultSchema: ["draftPreview": .string("normalized payload, hash, providerMutation=false")]),
        ProviderActionTemplate(
            actionKey: "wordpress_com_post_create_draft", displayName: "Create WordPress.com draft", summary: "Create one reviewed post draft; never publish during creation.", kind: .write, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: ["posts"],
            capabilityKeys: ["post_create_draft"],
            payloadSchema: [
                "siteId": .string("site id"), "title": .string("1-300"), "content": .string("1-50000"), "excerpt": .string("optional"), "slug": .string("optional"), "tags": .string("existing names"), "categories": .string("existing names"), "approvalPayloadHash": .string("optional exact hash"),
            ], resultSchema: ["post": .string("created draft"), "contentState": .string("draft"), "payloadHash": .string("string")]),
        ProviderActionTemplate(
            actionKey: "wordpress_com_post_update_draft", displayName: "Update WordPress.com draft", summary: "Update exact reviewed fields on an existing draft after a modified-time precondition check.", kind: .write, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ["posts"], capabilityKeys: ["post_update_draft"],
            payloadSchema: [
                "siteId": .string("site id"), "postId": .string("draft post id"), "expectedModified": .string("exact last-read modified"), "title": .string("optional 1-300"), "content": .string("optional 1-50000"), "excerpt": .string("optional 0-2000"),
                "approvalPayloadHash": .string("optional exact hash"),
            ], resultSchema: ["post": .string("updated draft"), "contentState": .string("draft"), "payloadHash": .string("string")]),
        ProviderActionTemplate(
            actionKey: "wordpress_com_post_publish", displayName: "Publish WordPress.com draft", summary: "Publish one explicit reviewed draft after a modified-time precondition check.", kind: .write, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ["posts"], capabilityKeys: ["post_publish"], payloadSchema: ["siteId": .string("site id"), "postId": .string("draft post id"), "expectedModified": .string("exact last-read modified"), "approvalPayloadHash": .string("optional exact hash")],
            resultSchema: ["post": .string("published post"), "contentState": .string("published"), "payloadHash": .string("string")]),
        ProviderActionTemplate(
            actionKey: "wordpress_com_destructive_content", displayName: "Delete, restore, or bulk-mutate WordPress.com content", summary: "Perform destructive or bulk content lifecycle operations.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["destructive_content"], payloadSchema: ["operation": .string("string")], resultSchema: [:], blockedReason: "Delete, restore, and bulk mutation are outside V1."),
        ProviderActionTemplate(
            actionKey: "wordpress_com_media_admin", displayName: "Mutate WordPress.com media or site administration", summary: "Upload/sideload media or mutate comments, taxonomy, menus, widgets, themes, plugins, users, sharing, Reader, hosting, or SSH.", kind: .admin, riskLevel: .destructive,
            adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["media_admin"], payloadSchema: ["operation": .string("string")], resultSchema: [:], blockedReason: "Media and site administration surfaces are outside V1."),
        ProviderActionTemplate(
            actionKey: "wordpress_com_global_raw_api", displayName: "Use global, batch, or raw WordPress.com API", summary: "Request global all-site access or expose an arbitrary namespace/path.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["global_raw_api"], payloadSchema: ["path": .string("string")], resultSchema: [:], blockedReason: "Global scope, batch, and raw WordPress.com API exposure are blocked.")
    ]

    private static let contentfulTemplates:[ProviderActionTemplate]=[
        ProviderActionTemplate(
            actionKey: "contentful_space_list", displayName: "List Contentful spaces", summary: "List bounded CMA spaces visible to the OAuth account; live adapter filters to authorized IDs.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ["content_management_manage"], capabilityKeys: ["space_list"], payloadSchema: ["maxResults": .string("1-25"), "skip": .string("non-negative")], resultSchema: ["spaces": .string("id, name, timestamps, version"), "pagination": .string("bounded CMA paging")]),
        ProviderActionTemplate(
            actionKey: "contentful_space_get", displayName: "Get Contentful space", summary: "Read one explicitly authorized Contentful space.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: ["content_management_manage"],
            capabilityKeys: ["space_get"], payloadSchema: ["spaceId": .string("authorized space id")], resultSchema: ["space": .string("safe space metadata")]),
        ProviderActionTemplate(
            actionKey: "contentful_environment_list", displayName: "List Contentful environments", summary: "List bounded environments for an authorized space.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: ["content_management_manage"],
            capabilityKeys: ["environment_list"], payloadSchema: ["spaceId": .string("space id"), "maxResults": .string("1-25"), "skip": .string("non-negative")], resultSchema: ["environments": .string("id, name, state, version"), "pagination": .string("CMA paging")]),
        ProviderActionTemplate(
            actionKey: "contentful_content_type_list", displayName: "List Contentful content types", summary: "List bounded content schemas in an authorized environment.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ["content_management_manage"], capabilityKeys: ["content_type_list"], payloadSchema: ["spaceId": .string("space"), "environmentId": .string("environment"), "maxResults": .string("1-25"), "skip": .string("non-negative")],
            resultSchema: ["contentTypes": .string("bounded schema summaries")]),
        ProviderActionTemplate(
            actionKey: "contentful_content_type_get", displayName: "Get Contentful content type", summary: "Read up to 40 typed localized field definitions for one content type.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ["content_management_manage"], capabilityKeys: ["content_type_get"], payloadSchema: ["spaceId": .string("space"), "environmentId": .string("environment"), "contentTypeId": .string("content type")], resultSchema: ["contentType": .string("typed field schema")]),
        ProviderActionTemplate(
            actionKey: "contentful_entry_list", displayName: "List Contentful entries", summary: "Read one bounded page of localized entries from an authorized environment.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ["content_management_manage"], capabilityKeys: ["entry_list"], payloadSchema: ["spaceId": .string("space"), "environmentId": .string("environment"), "maxResults": .string("1-25"), "skip": .string("non-negative")],
            resultSchema: ["entries": .string("localized fields plus version/publication state"), "pagination": .string("CMA paging")]),
        ProviderActionTemplate(
            actionKey: "contentful_entry_get", displayName: "Get Contentful entry", summary: "Read one explicit entry with localized fields and version state.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: ["content_management_manage"],
            capabilityKeys: ["entry_get"], payloadSchema: ["spaceId": .string("space"), "environmentId": .string("environment"), "entryId": .string("entry")], resultSchema: ["entry": .string("bounded entry semantics")]),
        ProviderActionTemplate(
            actionKey: "contentful_entry_prepare", displayName: "Prepare Contentful entry", summary: "Normalize and hash complete localized fields or explicit publication locally.", kind: .draft, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: [],
            capabilityKeys: ["entry_draft", "payload_hash"],
            payloadSchema: [
                "operation": .string("create, update, publish"), "spaceId": .string("space"), "environmentId": .string("environment"), "contentTypeId": .string("create content type"), "entryId": .string("update/publish entry"), "expectedVersion": .string("positive CMA version"),
                "fields": .string("complete 1-40 localized fields"),
            ], resultSchema: ["draftPreview": .string("normalized payload/hash, no mutation")]),
        ProviderActionTemplate(
            actionKey: "contentful_entry_create_draft", displayName: "Create Contentful draft entry", summary: "Create one unpublished entry with complete reviewed localized fields.", kind: .write, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ["content_management_manage"], capabilityKeys: ["entry_create_draft"],
            payloadSchema: ["spaceId": .string("space"), "environmentId": .string("environment"), "contentTypeId": .string("content type"), "fields": .string("complete localized fields"), "approvalPayloadHash": .string("optional exact hash")],
            resultSchema: ["entry": .string("created draft"), "contentState": .string("draft")]),
        ProviderActionTemplate(
            actionKey: "contentful_entry_update_draft", displayName: "Update Contentful draft entry", summary: "Replace complete localized fields using an exact CMA version header.", kind: .write, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ["content_management_manage"], capabilityKeys: ["entry_update_draft"],
            payloadSchema: ["spaceId": .string("space"), "environmentId": .string("environment"), "entryId": .string("entry"), "expectedVersion": .string("positive version"), "fields": .string("complete localized fields"), "approvalPayloadHash": .string("optional exact hash")],
            resultSchema: ["entry": .string("updated draft"), "contentState": .string("draft")]),
        ProviderActionTemplate(
            actionKey: "contentful_entry_publish", displayName: "Publish Contentful entry", summary: "Publish one explicit reviewed entry version.", kind: .write, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: ["content_management_manage"],
            capabilityKeys: ["entry_publish"], payloadSchema: ["spaceId": .string("space"), "environmentId": .string("environment"), "entryId": .string("entry"), "expectedVersion": .string("positive version"), "approvalPayloadHash": .string("optional exact hash")],
            resultSchema: ["entry": .string("published entry"), "contentState": .string("published")]),
        ProviderActionTemplate(
            actionKey: "contentful_entry_destructive", displayName: "Delete, archive, or unpublish Contentful entry", summary: "Perform destructive entry lifecycle operations.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["entry_destructive"], payloadSchema: ["operation": .string("string")], resultSchema: [:], blockedReason: "Destructive entry lifecycle is outside V1."),
        ProviderActionTemplate(
            actionKey: "contentful_admin_mutation", displayName: "Mutate Contentful assets, schema, or administration", summary: "Mutate assets, models, locales, environments, organizations, releases, schedules, webhooks, apps, or tokens.", kind: .admin, riskLevel: .destructive,
            adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["admin"], payloadSchema: ["operation": .string("string")], resultSchema: [:], blockedReason: "Contentful administration is outside V1."),
        ProviderActionTemplate(
            actionKey: "contentful_raw_api_call", displayName: "Raw Contentful provider call", summary: "Expose arbitrary CMA, delivery, preview, query, export, or regional host access.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["raw_api"], payloadSchema: ["path": .string("string")], resultSchema: [:], blockedReason: "Raw and broad Contentful surfaces are blocked."),
    ]

    private static let sanityTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "sanity_document_type_list", displayName: "List Sanity document types", summary: "Discover bounded document types in the connected dataset.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: [],
            capabilityKeys: ["document_read"], payloadSchema: ["maxResults": .string("1-25")], resultSchema: ["types": .string("bounded document type names")]),
        ProviderActionTemplate(
            actionKey: "sanity_document_list", displayName: "List Sanity documents", summary: "List one bounded cursor page, optionally restricted to a document type.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: [],
            capabilityKeys: ["document_read"], payloadSchema: ["documentType": .string("optional type"), "maxResults": .string("1-25"), "afterId": .string("optional cursor")], resultSchema: ["documents": .string("bounded safe document summaries"), "nextCursor": .string("optional document id")]),
        ProviderActionTemplate(
            actionKey: "sanity_document_get", displayName: "Get Sanity document", summary: "Read the published and draft versions of one explicit document.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: [], capabilityKeys: ["document_read"],
            payloadSchema: ["documentId": .string("explicit document id")], resultSchema: ["published": .string("published document or null"), "draft": .string("draft document or null")]),
        ProviderActionTemplate(
            actionKey: "sanity_document_prepare", displayName: "Prepare Sanity document change", summary: "Normalize and hash one proposed draft or publication locally.", kind: .draft, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: [],
            capabilityKeys: ["document_draft"], payloadSchema: ["operation": .string("create, update, publish"), "documentId": .string("update/publish id"), "documentType": .string("create type"), "expectedRevision": .string("update/publish revision"), "fields": .string("bounded fields")],
            resultSchema: ["draftPreview": .string("normalized payload and hash")]),
        ProviderActionTemplate(
            actionKey: "sanity_document_create_draft", displayName: "Create Sanity draft", summary: "Create one reviewed draft document.", kind: .write, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: [], capabilityKeys: ["document_draft"],
            payloadSchema: ["documentId": .string("optional id"), "documentType": .string("document type"), "fields": .string("bounded fields"), "approvalPayloadHash": .string("optional exact hash")], resultSchema: ["document": .string("created draft")]),
        ProviderActionTemplate(
            actionKey: "sanity_document_update_draft", displayName: "Update Sanity draft", summary: "Patch one reviewed draft using its exact current revision.", kind: .write, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: [],
            capabilityKeys: ["document_update"], payloadSchema: ["documentId": .string("document id"), "expectedRevision": .string("exact draft revision"), "fields": .string("bounded field patch"), "approvalPayloadHash": .string("optional exact hash")],
            resultSchema: ["document": .string("updated draft")]),
        ProviderActionTemplate(
            actionKey: "sanity_document_publish", displayName: "Publish Sanity document", summary: "Publish one reviewed draft using its exact current revision.", kind: .write, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: [],
            capabilityKeys: ["document_publish"], payloadSchema: ["documentId": .string("document id"), "expectedRevision": .string("exact draft revision"), "approvalPayloadHash": .string("optional exact hash")], resultSchema: ["document": .string("published document")]),
        ProviderActionTemplate(
            actionKey: "sanity_destructive", displayName: "Delete or unpublish Sanity content", summary: "Perform destructive or bulk content lifecycle operations.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["destructive"], payloadSchema: [:], resultSchema: [:], blockedReason: "Deletion, discard, purge, unpublish, and bulk mutation are outside V1."),
        ProviderActionTemplate(
            actionKey: "sanity_admin", displayName: "Administer Sanity", summary: "Mutate projects, datasets, members, roles, tokens, schemas, webhooks, releases, assets, or AI features.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["admin"], payloadSchema: [:], resultSchema: [:], blockedReason: "Sanity administration is outside V1."),
        ProviderActionTemplate(
            actionKey: "sanity_raw", displayName: "Use arbitrary GROQ or raw Sanity APIs", summary: "Expose arbitrary query, mutation, action, export, or automatic pagination surfaces.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["raw"], payloadSchema: [:], resultSchema: [:], blockedReason: "Arbitrary GROQ and raw Sanity API access are blocked.")
    ]

    private static let strapiCloudTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "strapi_cloud_content_type_list", displayName: "List configured Strapi content types", summary: "List the plural API IDs explicitly allowed by this connection.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: [],
            capabilityKeys: ["document_read"], payloadSchema: [:], resultSchema: ["contentTypes": .string("allowed plural API IDs")]),
        ProviderActionTemplate(
            actionKey: "strapi_cloud_document_list", displayName: "List Strapi documents", summary: "List one bounded page of draft or published documents without arbitrary filters or population.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: [], capabilityKeys: ["document_read"], payloadSchema: ["pluralApiId": .string("allowed content type"), "status": .string("draft or published"), "page": .string("1-10000"), "pageSize": .string("1-25"), "locale": .string("optional locale")],
            resultSchema: ["documents": .string("flattened Strapi 5 documents"), "pagination": .string("bounded page metadata")]),
        ProviderActionTemplate(
            actionKey: "strapi_cloud_document_get", displayName: "Get Strapi document", summary: "Read one explicit draft or published document by documentId.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: [],
            capabilityKeys: ["document_read"], payloadSchema: ["pluralApiId": .string("allowed content type"), "documentId": .string("stable Strapi document ID"), "status": .string("draft or published"), "locale": .string("optional locale")],
            resultSchema: ["document": .string("flattened Strapi 5 document")]),
        ProviderActionTemplate(
            actionKey: "strapi_cloud_document_prepare", displayName: "Prepare Strapi document change", summary: "Normalize and hash one proposed draft or publication locally.", kind: .draft, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: [],
            capabilityKeys: ["document_draft"],
            payloadSchema: [
                "operation": .string("create, update, publish"), "pluralApiId": .string("allowed content type"), "documentId": .string("update/publish ID"), "expectedUpdatedAt": .string("exact reviewed timestamp"), "locale": .string("optional locale"), "fields": .string("bounded fields"),
            ], resultSchema: ["draftPreview": .string("normalized payload and hash")]),
        ProviderActionTemplate(
            actionKey: "strapi_cloud_document_create_draft", displayName: "Create Strapi draft", summary: "Create one reviewed draft document in an allowed content type.", kind: .write, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: [],
            capabilityKeys: ["document_draft"], payloadSchema: ["pluralApiId": .string("allowed content type"), "locale": .string("optional locale"), "fields": .string("bounded fields"), "approvalPayloadHash": .string("optional exact hash")], resultSchema: ["document": .string("created draft")]),
        ProviderActionTemplate(
            actionKey: "strapi_cloud_document_update_draft", displayName: "Update Strapi draft", summary: "Update one reviewed draft after an exact updated-time preflight.", kind: .write, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: [],
            capabilityKeys: ["document_update"],
            payloadSchema: [
                "pluralApiId": .string("allowed content type"), "documentId": .string("document ID"), "expectedUpdatedAt": .string("exact reviewed timestamp"), "locale": .string("optional locale"), "fields": .string("bounded fields"), "approvalPayloadHash": .string("optional exact hash"),
            ], resultSchema: ["document": .string("updated draft")]),
        ProviderActionTemplate(
            actionKey: "strapi_cloud_document_publish", displayName: "Publish Strapi document", summary: "Publish one reviewed draft after an exact updated-time preflight.", kind: .write, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: [],
            capabilityKeys: ["document_publish"],
            payloadSchema: ["pluralApiId": .string("allowed content type"), "documentId": .string("document ID"), "expectedUpdatedAt": .string("exact reviewed timestamp"), "locale": .string("optional locale"), "approvalPayloadHash": .string("optional exact hash")],
            resultSchema: ["document": .string("published document")]),
        ProviderActionTemplate(
            actionKey: "strapi_cloud_destructive", displayName: "Delete or unpublish Strapi content", summary: "Perform destructive or bulk content lifecycle operations.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["destructive"], payloadSchema: [:], resultSchema: [:], blockedReason: "Deletion, unpublishing, discarding, and bulk lifecycle changes are outside V1."),
        ProviderActionTemplate(
            actionKey: "strapi_cloud_admin", displayName: "Administer Strapi", summary: "Mutate users, roles, tokens, schemas, plugins, projects, deployments, releases, workflows, webhooks, assets, or uploads.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported,
            defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["admin"], payloadSchema: [:], resultSchema: [:], blockedReason: "Strapi administration is outside V1."),
        ProviderActionTemplate(
            actionKey: "strapi_cloud_raw", displayName: "Use arbitrary Strapi APIs", summary: "Expose arbitrary REST, GraphQL, filters, population, custom endpoints, or automatic pagination.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["raw"], payloadSchema: [:], resultSchema: [:], blockedReason: "Arbitrary and raw Strapi API access is blocked.")
    ]

    private static let shopifyTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "shopify_shop_get", displayName: "Get Shopify shop", summary: "Read safe identity, domain, currency, and plan metadata for the connected shop.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: ["write_products"],
            capabilityKeys: ["shop_get"], payloadSchema: [:], resultSchema: ["shop": .string("safe shop metadata")]),
        ProviderActionTemplate(
            actionKey: "shopify_product_list", displayName: "List Shopify products", summary: "Read one bounded cursor page of useful product catalog metadata.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: ["write_products"],
            capabilityKeys: ["product_list"], payloadSchema: ["maxResults": .string("1-25"), "after": .string("optional cursor")], resultSchema: ["products": .string("bounded product summaries"), "pageInfo": .string("cursor state")]),
        ProviderActionTemplate(
            actionKey: "shopify_product_get", displayName: "Get Shopify product", summary: "Read one product with status, SEO, options, and bounded variants.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: ["write_products"],
            capabilityKeys: ["product_get"], payloadSchema: ["productId": .string("Shopify Product GID")], resultSchema: ["product": .string("useful product semantics")]),
        ProviderActionTemplate(
            actionKey: "shopify_publication_list", displayName: "List Shopify publications", summary: "Read bounded channel/publication identifiers for explicit product publication.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ["write_publications"], capabilityKeys: ["publication_list"], payloadSchema: [:], resultSchema: ["publications": .string("publication id, name, catalog, auto-publish")]),
        ProviderActionTemplate(
            actionKey: "shopify_product_prepare", displayName: "Prepare Shopify product change", summary: "Normalize and hash a draft, update, activation, or publication payload locally.", kind: .draft, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: [],
            capabilityKeys: ["product_draft", "payload_hash"],
            payloadSchema: [
                "operation": .string("create, update, activate, publish"), "productId": .string("product GID"), "expectedUpdatedAt": .string("exact reviewed timestamp"), "publicationId": .string("publication GID"), "title": .string("title"), "descriptionHtml": .string("bounded HTML"),
                "vendor": .string("vendor"), "productType": .string("type"), "handle": .string("handle"), "tags": .string("bounded array"),
            ], resultSchema: ["draftPreview": .string("normalized payload/hash; no mutation")]),
        ProviderActionTemplate(
            actionKey: "shopify_product_create_draft", displayName: "Create Shopify draft product", summary: "Create one reviewed product forced to DRAFT status.", kind: .write, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: ["write_products"],
            capabilityKeys: ["product_create_draft"], payloadSchema: ["title": .string("required"), "descriptionHtml": .string("optional"), "vendor": .string("optional"), "productType": .string("optional"), "handle": .string("optional"), "tags": .string("optional")],
            resultSchema: ["product": .string("created DRAFT product"), "userErrors": .string("empty on success")]),
        ProviderActionTemplate(
            actionKey: "shopify_product_update_draft", displayName: "Update Shopify draft product", summary: "Update reviewed editable fields only after a DRAFT/exact-updatedAt preflight.", kind: .write, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ["write_products"], capabilityKeys: ["product_update_draft"],
            payloadSchema: [
                "productId": .string("Product GID"), "expectedUpdatedAt": .string("exact reviewed timestamp"), "title": .string("required"), "descriptionHtml": .string("optional"), "vendor": .string("optional"), "productType": .string("optional"), "handle": .string("optional"),
                "tags": .string("optional"),
            ], resultSchema: ["product": .string("updated DRAFT product")]),
        ProviderActionTemplate(
            actionKey: "shopify_product_activate", displayName: "Activate Shopify product", summary: "Transition one exact reviewed DRAFT product to ACTIVE without publishing it to a channel.", kind: .write, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ["write_products"], capabilityKeys: ["product_activate"], payloadSchema: ["productId": .string("Product GID"), "expectedUpdatedAt": .string("exact reviewed timestamp")], resultSchema: ["product": .string("ACTIVE product")]),
        ProviderActionTemplate(
            actionKey: "shopify_product_publish", displayName: "Publish Shopify product", summary: "Publish one exact reviewed ACTIVE product to one explicit publication.", kind: .write, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ["write_products", "write_publications"], capabilityKeys: ["product_publish"], payloadSchema: ["productId": .string("Product GID"), "publicationId": .string("Publication GID"), "expectedUpdatedAt": .string("exact reviewed timestamp")],
            resultSchema: ["publication": .string("publishable publication state")]),
        ProviderActionTemplate(
            actionKey: "shopify_product_destructive", displayName: "Delete, archive, or unpublish Shopify product", summary: "Perform destructive product lifecycle operations.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["product_destructive"], payloadSchema: [:], resultSchema: [:], blockedReason: "Destructive Shopify product lifecycle is outside V1."),
        ProviderActionTemplate(
            actionKey: "shopify_commerce_admin", displayName: "Mutate Shopify commerce or administration", summary: "Mutate orders, customers, payments, fulfillment, inventory, pricing, variants, discounts, files, themes, billing, or administration.", kind: .admin, riskLevel: .destructive,
            adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["commerce_admin"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broader Shopify commerce and administration are outside V1."),
        ProviderActionTemplate(
            actionKey: "shopify_raw_graphql", displayName: "Raw Shopify GraphQL", summary: "Expose arbitrary Shopify GraphQL or cross-shop access.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["raw_graphql"],
            payloadSchema: [:], resultSchema: [:], blockedReason: "Raw Shopify GraphQL is blocked."),
    ]

    private static let mondayTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "monday_board_list", displayName: "List Monday.com boards", summary: "List bounded boards visible to the authorized monday account.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ["account:read", "workspaces:read", "boards:read"], capabilityKeys: ["board_list"], payloadSchema: ["workspaceId": .string("optional Workspace id"), "maxResults": .string("optional integer 1-25")],
            resultSchema: ["boards": .string("id, name, description excerpt, state/type, Workspace, groups/columns summary, URL, updated")]),
        ProviderActionTemplate(
            actionKey: "monday_board_items", displayName: "List Monday.com board items", summary: "Read bounded useful items and column values from one board.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: ["boards:read"],
            capabilityKeys: ["board_items"], payloadSchema: ["boardId": .string("Monday.com board id"), "query": .string("optional bounded item name search"), "maxResults": .string("optional integer 1-50")],
            resultSchema: ["items": .string("id, name, URL, group, creator, timestamps, typed human-readable columns, parent/subitem state")]),
        ProviderActionTemplate(
            actionKey: "monday_item_get", displayName: "Get Monday.com item", summary: "Read one item with useful board, group, column, and bounded discussion context.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ["boards:read", "updates:read"], capabilityKeys: ["item_get"], payloadSchema: ["itemId": .string("Monday.com item id"), "maxDescriptionChars": .string("optional integer 1-4000")], resultSchema: ["item": .string("provider-correct Monday.com item")]),
        ProviderActionTemplate(
            actionKey: "monday_item_updates", displayName: "List Monday.com item updates", summary: "Read bounded discussion updates for one item.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: ["updates:read"],
            capabilityKeys: ["item_updates"], payloadSchema: ["itemId": .string("Monday.com item id"), "maxResults": .string("optional integer 1-25"), "maxBodyChars": .string("optional integer 1-4000")], resultSchema: ["updates": .string("id, body/text excerpt, creator, timestamps, reply count")]),
        ProviderActionTemplate(
            actionKey: "monday_item_prepare", displayName: "Prepare Monday.com item change", summary: "Prepare item creation, column update, or comment locally without mutation.", kind: .draft, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: [],
            capabilityKeys: ["item_draft", "payload_hash"],
            payloadSchema: [
                "operation": .string("create, update, or comment"), "boardId": .string("optional board id"), "groupId": .string("optional group id"), "itemId": .string("optional item id"), "name": .string("optional item name"), "columnValues": .string("optional typed column-value object"),
                "body": .string("optional update body"),
            ], resultSchema: ["draftPreview": .string("normalized variables, payload hash, providerMutation=false")]),
        ProviderActionTemplate(
            actionKey: "monday_item_create", displayName: "Create Monday.com item", summary: "Create an exact reviewed item on a board.", kind: .write, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: ["boards:write"], capabilityKeys: ["item_create"],
            payloadSchema: ["boardId": .string("board id"), "groupId": .string("optional group id"), "name": .string("item name"), "columnValues": .string("optional typed column-value object"), "approvalPayloadHash": .string("optional exact hash")],
            resultSchema: ["id": .string("string"), "name": .string("string"), "url": .string("string"), "boardId": .string("string"), "payloadHash": .string("string"), "auditId": .string("string")]),
        ProviderActionTemplate(
            actionKey: "monday_item_update", displayName: "Update Monday.com item", summary: "Update exact reviewed item name or column values.", kind: .write, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: ["boards:write"],
            capabilityKeys: ["item_update"], payloadSchema: ["boardId": .string("board id"), "itemId": .string("item id"), "name": .string("optional item name"), "columnValues": .string("optional typed column-value object"), "approvalPayloadHash": .string("optional exact hash")],
            resultSchema: ["id": .string("string"), "name": .string("string"), "url": .string("string"), "changedColumnIds": .string("array"), "payloadHash": .string("string"), "auditId": .string("string")]),
        ProviderActionTemplate(
            actionKey: "monday_item_comment_create", displayName: "Comment on Monday.com item", summary: "Post an exact reviewed update/comment to one item.", kind: .message, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: ["updates:write"],
            capabilityKeys: ["item_comment"], payloadSchema: ["itemId": .string("item id"), "body": .string("HTML-capable update body without implicit mentions"), "approvalPayloadHash": .string("optional exact hash")],
            resultSchema: ["updateId": .string("string"), "itemId": .string("string"), "bodyExcerpt": .string("string"), "payloadHash": .string("string"), "auditId": .string("string")]),
        ProviderActionTemplate(
            actionKey: "monday_item_delete", displayName: "Delete Monday.com item", summary: "Delete an item.", kind: .delete, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["item_delete"],
            payloadSchema: ["itemId": .string("string")], resultSchema: [:], blockedReason: "Monday.com item deletion is blocked in V1."),
        ProviderActionTemplate(
            actionKey: "monday_structure_admin", displayName: "Administer Monday.com structure", summary: "Mutate Workspaces, boards, groups, columns, users, teams, or permissions.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["structure_admin", "schema_admin", "user_admin"], payloadSchema: ["operation": .string("string")], resultSchema: [:], blockedReason: "Monday.com administration and schema mutation are blocked in V1."),
        ProviderActionTemplate(
            actionKey: "monday_webhook_file_mutate", displayName: "Mutate Monday.com webhooks or files", summary: "Create subscriptions/webhooks or upload/delete files and assets.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["webhook_write", "file_write"], payloadSchema: ["operation": .string("string")], resultSchema: [:], blockedReason: "Monday.com webhooks, subscriptions, files, and assets are outside V1."),
        ProviderActionTemplate(
            actionKey: "monday_broad_export", displayName: "Broad Monday.com export", summary: "Crawl, synchronize, or broadly export account content.", kind: .read, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["broad_export"],
            payloadSchema: ["scope": .string("string")], resultSchema: [:], blockedReason: "Broad Monday.com crawling/export is blocked by V1 privacy and quota limits."),
        ProviderActionTemplate(
            actionKey: "monday_raw_graphql", displayName: "Raw Monday.com provider call", summary: "Expose arbitrary GraphQL or raw Platform MCP.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["raw_graphql", "raw_mcp"], payloadSchema: ["query": .string("string")], resultSchema: [:], blockedReason: "Raw Monday.com GraphQL and MCP exposure is blocked; agents receive only Relay wrappers.")
    ]

    private static let wooCommerceTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "woocommerce_product_list", displayName: "List WooCommerce products", summary: "Read a bounded page of useful product catalog metadata.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: ["read_write"],
            capabilityKeys: ["product_list"], payloadSchema: ["page": .string("1-based page"), "maxResults": .string("maximum 25")], resultSchema: ["products": .string("bounded useful product semantics"), "pagination": .string("WooCommerce totals and link")]),
        ProviderActionTemplate(
            actionKey: "woocommerce_product_get", displayName: "Get WooCommerce product", summary: "Read one product with status, timestamps, categories, pricing, inventory, images, attributes, and variations.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ["read_write"], capabilityKeys: ["product_get"], payloadSchema: ["productId": .string("positive numeric product ID")], resultSchema: ["product": .string("useful product semantics")]),
        ProviderActionTemplate(
            actionKey: "woocommerce_category_list", displayName: "List WooCommerce categories", summary: "Read a bounded alphabetical category page.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: ["read_write"],
            capabilityKeys: ["category_list"], payloadSchema: [:], resultSchema: ["categories": .string("bounded category semantics")]),
        ProviderActionTemplate(
            actionKey: "woocommerce_product_prepare", displayName: "Prepare WooCommerce product change", summary: "Normalize and hash a create, update, or publish payload locally.", kind: .draft, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: [],
            capabilityKeys: ["product_draft", "payload_hash"], payloadSchema: ["operation": .string("create, update, or publish"), "productId": .string("positive ID"), "expectedDateModifiedGMT": .string("exact reviewed timestamp"), "name": .string("product name")],
            resultSchema: ["draftPreview": .string("normalized payload and hash; no mutation")]),
        ProviderActionTemplate(
            actionKey: "woocommerce_product_create_draft", displayName: "Create WooCommerce draft product", summary: "Create one reviewed product forced to draft status.", kind: .write, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: ["read_write"],
            capabilityKeys: ["product_create_draft"], payloadSchema: ["name": .string("required"), "slug": .string("optional"), "description": .string("optional"), "short_description": .string("optional"), "categories": .string("bounded ID array"), "tags": .string("bounded ID array")],
            resultSchema: ["product": .string("created draft product")]),
        ProviderActionTemplate(
            actionKey: "woocommerce_product_update_draft", displayName: "Update WooCommerce draft product", summary: "Update reviewed editable fields only after draft/date_modified_gmt preflight checks.", kind: .write, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ["read_write"], capabilityKeys: ["product_update_draft"], payloadSchema: ["productId": .string("positive ID"), "expectedDateModifiedGMT": .string("exact reviewed timestamp"), "name": .string("required")], resultSchema: ["product": .string("updated draft product")]),
        ProviderActionTemplate(
            actionKey: "woocommerce_product_publish", displayName: "Publish WooCommerce draft product", summary: "Publish one explicit reviewed draft after a non-atomic date_modified_gmt preflight.", kind: .write, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ["read_write"], capabilityKeys: ["product_publish"], payloadSchema: ["productId": .string("positive ID"), "expectedDateModifiedGMT": .string("exact reviewed timestamp")], resultSchema: ["product": .string("published product")]),
        ProviderActionTemplate(
            actionKey: "woocommerce_product_destructive", displayName: "Delete or destructively change WooCommerce product", summary: "Perform destructive product lifecycle operations.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["product_destructive"], payloadSchema: [:], resultSchema: [:], blockedReason: "Destructive WooCommerce product lifecycle is outside V1."),
        ProviderActionTemplate(
            actionKey: "woocommerce_commerce_admin", displayName: "Mutate WooCommerce commerce or administration", summary: "Access orders, customers, payments, pricing, inventory, variants, images, fulfillment, taxes, shipping, coupons, settings, or webhooks.", kind: .admin,
            riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["commerce_admin"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broader WooCommerce commerce and administration are outside V1."),
        ProviderActionTemplate(
            actionKey: "woocommerce_raw_rest", displayName: "Raw WooCommerce REST", summary: "Expose arbitrary REST routes, redirects, alternate origins, or query-string credentials.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["raw_rest"], payloadSchema: [:], resultSchema: [:], blockedReason: "Raw WooCommerce REST is blocked.")
    ]

    private static let stripeTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "stripe_balance_get", displayName: "Get Stripe balance", summary: "Read available and pending integer amount/currency buckets for the installed account.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: ["balance_read"],
            capabilityKeys: ["balance_read"], payloadSchema: [:], resultSchema: ["balance": .string("livemode plus available/pending amount and currency buckets")]),
        ProviderActionTemplate(
            actionKey: "stripe_payment_intent_list", displayName: "List Stripe payment intents", summary: "Read at most 25 privacy-redacted PaymentIntent status summaries.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ["payment_intent_read"], capabilityKeys: ["payment_intent_list"],
            payloadSchema: ["limit": .string("1...25"), "startingAfter": .string("validated pi_ cursor"), "createdGte": .string("Unix timestamp"), "createdLte": .string("Unix timestamp"), "status": .string("allowlisted PaymentIntent status")],
            resultSchema: ["paymentIntents": .string("redacted status/amount/currency/livemode summaries"), "hasMore": .string("Stripe cursor continuation")]),
        ProviderActionTemplate(
            actionKey: "stripe_payment_intent_get", displayName: "Get Stripe payment intent", summary: "Read one exact privacy-redacted PaymentIntent status summary.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ["payment_intent_read"], capabilityKeys: ["payment_intent_get"], payloadSchema: ["paymentIntentId": .string("validated pi_ identifier")], resultSchema: ["paymentIntent": .string("redacted status/amount/currency/livemode summary")]),
        ProviderActionTemplate(
            actionKey: "stripe_payment_mutation", displayName: "Mutate Stripe payments", summary: "Create, confirm, capture, cancel, refund, transfer, or pay out funds.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["payment_mutation"], payloadSchema: [:], resultSchema: [:], blockedReason: "All Stripe financial mutations are outside read-only V1."),
        ProviderActionTemplate(
            actionKey: "stripe_private_financial_data", displayName: "Read private Stripe customer or instrument data", summary: "Access customers, payment methods, receipt/shipping data, files, dispute evidence, or raw errors.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported,
            defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["private_financial_data"], payloadSchema: [:], resultSchema: [:], blockedReason: "Private customer, instrument, and evidence surfaces are outside V1."),
        ProviderActionTemplate(
            actionKey: "stripe_broader_admin", displayName: "Access broader Stripe administration", summary: "Access Connect, billing, products, subscriptions, events, reports, settings, or arbitrary expansion.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported,
            defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["broader_admin"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broader Stripe product and administrative surfaces are outside V1."),
        ProviderActionTemplate(
            actionKey: "stripe_raw_api", displayName: "Raw Stripe API", summary: "Expose arbitrary Stripe API or MCP calls.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["raw_api"], payloadSchema: [:],
            resultSchema: [:], blockedReason: "Raw Stripe API/MCP is blocked.")
    ]

    private static let xeroTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "xero_organisation_get", displayName: "Get Xero organisation", summary: "Read bounded metadata for the exact connected ORGANISATION tenant.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: ["accounting.settings.read"],
            capabilityKeys: ["organisation_read"], payloadSchema: [:], resultSchema: ["organisation": .string("redacted exact-tenant organisation metadata")]),
        ProviderActionTemplate(
            actionKey: "xero_invoice_list", displayName: "List Xero invoices", summary: "Read at most 25 privacy-redacted invoice summaries ordered by update time.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ["accounting.invoices.read"], capabilityKeys: ["invoice_list"], payloadSchema: ["page": .string("1...10000"), "limit": .string("1...25"), "status": .string("allowlisted Xero invoice status")], resultSchema: ["invoices": .string("privacy-redacted invoice summaries")]),
        ProviderActionTemplate(
            actionKey: "xero_invoice_get", displayName: "Get Xero invoice", summary: "Read one exact privacy-redacted invoice summary by UUID.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: ["accounting.invoices.read"],
            capabilityKeys: ["invoice_get"], payloadSchema: ["invoiceId": .string("validated invoice UUID")], resultSchema: ["invoice": .string("privacy-redacted invoice summary")]),
        ProviderActionTemplate(
            actionKey: "xero_accounting_mutation", displayName: "Mutate Xero accounting", summary: "Create or change invoices, payments, bank transactions, contacts, or settings.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["accounting_mutation"], payloadSchema: [:], resultSchema: [:], blockedReason: "All Xero accounting mutations are outside read-only V1."),
        ProviderActionTemplate(
            actionKey: "xero_private_accounting_data", displayName: "Read private Xero accounting data", summary: "Access contact identity, addresses, line items, references, attachments, payments, or bank details.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported,
            defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["private_accounting_data"], payloadSchema: [:], resultSchema: [:], blockedReason: "Private contact and detailed accounting surfaces are outside V1."),
        ProviderActionTemplate(
            actionKey: "xero_broader_admin", displayName: "Access broader Xero administration", summary: "Access reports, journals, payroll, files, assets, projects, connections, or app administration.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["broader_admin"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broader Xero product and administrative surfaces are outside V1."),
        ProviderActionTemplate(
            actionKey: "xero_raw_api", displayName: "Raw Xero API", summary: "Expose arbitrary Xero API or MCP calls.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["raw_api"], payloadSchema: [:],
            resultSchema: [:], blockedReason: "Raw Xero API/MCP is blocked.")
    ]

    private static let quickBooksTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "quickbooks_company_info_get", displayName: "Get QuickBooks company info", summary: "Read bounded metadata for the exact connected QuickBooks Online company.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ["com.intuit.quickbooks.accounting"], capabilityKeys: ["company_info_read"], payloadSchema: [:], resultSchema: ["companyInfo": .string("redacted exact-realm CompanyInfo")]),
        ProviderActionTemplate(
            actionKey: "quickbooks_invoice_list", displayName: "List QuickBooks invoices", summary: "Read at most 25 privacy-redacted Invoice balance summaries ordered by update time.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ["com.intuit.quickbooks.accounting"], capabilityKeys: ["invoice_list"], payloadSchema: ["startPosition": .string("positive QuickBooks query offset"), "limit": .string("1...25")], resultSchema: ["invoices": .string("privacy-redacted invoice balance summaries")]),
        ProviderActionTemplate(
            actionKey: "quickbooks_invoice_get", displayName: "Get QuickBooks invoice", summary: "Read one exact privacy-redacted Invoice balance summary by numeric entity ID.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ["com.intuit.quickbooks.accounting"], capabilityKeys: ["invoice_get"], payloadSchema: ["invoiceId": .string("positive numeric QuickBooks Invoice ID")], resultSchema: ["invoice": .string("privacy-redacted invoice balance summary")]),
        ProviderActionTemplate(
            actionKey: "quickbooks_payroll_compensations_list", displayName: "List QuickBooks employee pay types", summary: "Read at most 10 bounded pay-type assignments for one exact numeric employee ID.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ["payroll.compensation.read"], capabilityKeys: ["payroll_compensation_read"],
            payloadSchema: ["employeeId": .string("positive numeric QuickBooks employee ID"), "activeOnly": .string("boolean, defaults true"), "countryCode": .string("optional uppercase two-letter country")],
            resultSchema: ["compensations": .string("pay-type IDs, names, active state, and types only")]),
        ProviderActionTemplate(
            actionKey: "quickbooks_payment_charge_get", displayName: "Get QuickBooks payment charge", summary: "Read one exact privacy-redacted QuickBooks Payments charge status by opaque ID.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ["com.intuit.quickbooks.payment"], capabilityKeys: ["payment_charge_read"], payloadSchema: ["chargeId": .string("validated opaque QuickBooks Payments charge ID")], resultSchema: ["charge": .string("ID, status, amount, currency, created time, and capture state only")]),
        ProviderActionTemplate(
            actionKey: "quickbooks_accounting_mutation", displayName: "Mutate QuickBooks accounting", summary: "Create, update, delete, send, void, or change accounting entities.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["accounting_mutation"], payloadSchema: [:], resultSchema: [:], blockedReason: "All QuickBooks accounting mutations are outside read-only V1."),
        ProviderActionTemplate(
            actionKey: "quickbooks_private_accounting_data", displayName: "Read private QuickBooks accounting data", summary: "Access customer/vendor/employee identity, contact details, lines, notes, tax, attachments, or linked transactions.", kind: .admin, riskLevel: .destructive,
            adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["private_accounting_data"], payloadSchema: [:], resultSchema: [:], blockedReason: "Private identity and detailed accounting surfaces are outside V1."),
        ProviderActionTemplate(
            actionKey: "quickbooks_broader_accounting", displayName: "Access broader QuickBooks accounting", summary: "Access payments, bills, banking, accounts, journals, reports, tax, batch, CDC, or webhooks.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported,
            defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["broader_accounting"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broader QuickBooks Accounting scope surfaces are blocked despite provider consent."),
        ProviderActionTemplate(
            actionKey: "quickbooks_payments_payroll", displayName: "Mutate QuickBooks Payments or access broader Payroll",
            summary: "Create, capture, void, refund, tokenize, or administer payments; access payment instruments, receipts, customer identity, employee identity, payslips, deductions, benefits, tax identifiers, bank details, time writes, or payroll execution.", kind: .admin,
            riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["payments_payroll"], payloadSchema: [:], resultSchema: [:],
            blockedReason: "Every Payments surface except one redacted exact-charge read and every Payroll surface except the bounded pay-type read are outside V1."),
        ProviderActionTemplate(
            actionKey: "quickbooks_raw_api", displayName: "Raw QuickBooks API", summary: "Expose arbitrary QuickBooks query, REST, GraphQL, batch, or MCP calls.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["raw_api"], payloadSchema: [:], resultSchema: [:], blockedReason: "Raw QuickBooks API/query/MCP is blocked.")
    ]

    private static let freshBooksTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "freshbooks_business_memberships_list", displayName: "List FreshBooks businesses", summary: "Read bounded business/account membership choices without identity profile PII.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ["user:profile:read"], capabilityKeys: ["business_memberships_read"], payloadSchema: [:], resultSchema: ["businessMemberships": .string("redacted role/business/account choices")]),
        ProviderActionTemplate(
            actionKey: "freshbooks_invoice_list", displayName: "List FreshBooks invoices", summary: "Read at most 25 privacy-redacted Invoice money/status summaries.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ["user:invoices:read"], capabilityKeys: ["invoice_list"], payloadSchema: ["page": .string("positive page"), "limit": .string("1...25")], resultSchema: ["invoices": .string("privacy-redacted Invoice money/status summaries")]),
        ProviderActionTemplate(
            actionKey: "freshbooks_invoice_get", displayName: "Get FreshBooks invoice", summary: "Read one exact privacy-redacted Invoice money/status summary.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: ["user:invoices:read"],
            capabilityKeys: ["invoice_get"], payloadSchema: ["invoiceId": .string("positive numeric FreshBooks invoice ID")], resultSchema: ["invoice": .string("privacy-redacted Invoice summary")]),
        ProviderActionTemplate(
            actionKey: "freshbooks_invoice_mutation", displayName: "Mutate FreshBooks invoices", summary: "Create, update, archive, delete, send, or otherwise change invoices.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["invoice_mutation"], payloadSchema: [:], resultSchema: [:], blockedReason: "All FreshBooks Invoice mutations are outside read-only V1."),
        ProviderActionTemplate(
            actionKey: "freshbooks_private_identity", displayName: "Read private FreshBooks identity data", summary: "Access identity/client names, email, phone, address, notes, terms, lines, links, or payment detail.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported,
            defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["private_identity"], payloadSchema: [:], resultSchema: [:], blockedReason: "Profile, client identity, and detailed Invoice surfaces are outside V1."),
        ProviderActionTemplate(
            actionKey: "freshbooks_broader_accounting", displayName: "Access broader FreshBooks accounting", summary: "Access payments, bills, expenses, journals, reports, tax, projects, time, or teams.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["broader_accounting"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broader FreshBooks resource scopes are outside V1."),
        ProviderActionTemplate(
            actionKey: "freshbooks_raw_api", displayName: "Raw FreshBooks API", summary: "Expose arbitrary FreshBooks API, search/include, or MCP calls.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["raw_api"],
            payloadSchema: [:], resultSchema: [:], blockedReason: "Raw FreshBooks API/MCP is blocked.")
    ]

    private static let waveTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "wave_business_get", displayName: "Get Wave business", summary: "Read bounded metadata for the exact connected subscription-eligible business.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: ["business:read"],
            capabilityKeys: ["business_read"], payloadSchema: [:], resultSchema: ["business": .string("exact business id/name/isPersonal")]),
        ProviderActionTemplate(
            actionKey: "wave_invoice_list", displayName: "List Wave invoices", summary: "Read at most 25 privacy-redacted Invoice money/status summaries.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: ["invoice:read"],
            capabilityKeys: ["invoice_list"], payloadSchema: ["page": .string("positive page"), "limit": .string("1...25")], resultSchema: ["invoices": .string("privacy-redacted Invoice summaries"), "pageInfo": .string("Wave pagination")]),
        ProviderActionTemplate(
            actionKey: "wave_invoice_get", displayName: "Get Wave invoice", summary: "Read one exact privacy-redacted Invoice money/status summary.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: ["invoice:read"],
            capabilityKeys: ["invoice_get"], payloadSchema: ["invoiceId": .string("validated opaque Wave Invoice ID")], resultSchema: ["invoice": .string("privacy-redacted Invoice summary")]),
        ProviderActionTemplate(
            actionKey: "wave_invoice_mutation", displayName: "Mutate Wave invoices", summary: "Create, update, send, or otherwise change invoices.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["invoice_mutation"], payloadSchema: [:], resultSchema: [:], blockedReason: "All Wave Invoice mutations are outside read-only V1."),
        ProviderActionTemplate(
            actionKey: "wave_private_accounting", displayName: "Read private Wave accounting data", summary: "Access customer identity, lines, tax, memos, URLs, payment controls, or history.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["private_accounting"], payloadSchema: [:], resultSchema: [:], blockedReason: "Private customer and detailed Invoice surfaces are outside V1."),
        ProviderActionTemplate(
            actionKey: "wave_broader_accounting", displayName: "Access broader Wave accounting", summary: "Access accounts, products, tax, transactions, vendors, estimates, or user identity.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["broader_accounting"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broader Wave GraphQL resources are outside V1."),
        ProviderActionTemplate(
            actionKey: "wave_payment_wallet", displayName: "Access Wave payment wallet APIs", summary: "Use Wave Business wallet, checkout, payout, reconciliation, or payment APIs.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["payment_wallet"], payloadSchema: [:], resultSchema: [:], blockedReason: "The separate Wave Business payment-wallet API is outside V1."),
        ProviderActionTemplate(
            actionKey: "wave_raw_graphql", displayName: "Raw Wave GraphQL", summary: "Expose arbitrary GraphQL, introspection, or unrelated Wave API/MCP calls.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["raw_graphql"], payloadSchema: [:], resultSchema: [:], blockedReason: "Raw Wave GraphQL/API/MCP is blocked.")
    ]

    private static let freeAgentTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "freeagent_company_get", displayName: "Get FreeAgent company", summary: "Read bounded metadata for the exact token-bound company.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: [], capabilityKeys: ["company_read"],
            payloadSchema: [:], resultSchema: ["company": .string("exact company id/name/type/base currency")]),
        ProviderActionTemplate(
            actionKey: "freeagent_invoice_list", displayName: "List FreeAgent invoices", summary: "Read at most 25 privacy-redacted Invoice value/status summaries.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: [],
            capabilityKeys: ["invoice_list"], payloadSchema: ["page": .string("positive page"), "view": .string("optional allowlisted FreeAgent invoice view")], resultSchema: ["invoices": .string("privacy-redacted Invoice summaries"), "page": .string("FreeAgent page")]),
        ProviderActionTemplate(
            actionKey: "freeagent_invoice_get", displayName: "Get FreeAgent invoice", summary: "Read one exact privacy-redacted Invoice value/status summary.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: [],
            capabilityKeys: ["invoice_get"], payloadSchema: ["invoiceId": .string("positive numeric FreeAgent Invoice ID")], resultSchema: ["invoice": .string("privacy-redacted Invoice summary")]),
        ProviderActionTemplate(
            actionKey: "freeagent_invoice_mutation", displayName: "Mutate FreeAgent invoices", summary: "Create, update, delete, email, transition, or take payment for an Invoice.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["invoice_mutation"], payloadSchema: [:], resultSchema: [:], blockedReason: "All FreeAgent Invoice mutations are outside read-only V1."),
        ProviderActionTemplate(
            actionKey: "freeagent_private_accounting", displayName: "Read private FreeAgent accounting detail", summary: "Access identity, lines, comments, tax, bank/payment fields, email, PDF, or timeline.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported,
            defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["private_accounting"], payloadSchema: [:], resultSchema: [:], blockedReason: "Private and detailed FreeAgent Invoice surfaces are outside V1."),
        ProviderActionTemplate(
            actionKey: "freeagent_broader_accounting", displayName: "Access broader FreeAgent accounting", summary: "Access contacts, projects, bills, banking, tax, payroll, expenses, users, or files.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["broader_accounting"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broader FreeAgent company resources are outside V1."),
        ProviderActionTemplate(
            actionKey: "freeagent_practice_api", displayName: "Access FreeAgent Practice API", summary: "Access accountant or bookkeeper client lists through the separately registered Practice API.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["practice_api"], payloadSchema: [:], resultSchema: [:], blockedReason: "The separate FreeAgent Accountancy Practice API is outside this company app."),
        ProviderActionTemplate(
            actionKey: "freeagent_raw_api", displayName: "Raw FreeAgent API", summary: "Expose arbitrary paths, XML, or raw provider calls.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["raw_api"],
            payloadSchema: [:], resultSchema: [:], blockedReason: "Raw FreeAgent API access is blocked.")
    ]

    private static let salesforceTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "salesforce_account_list", displayName: "List Salesforce accounts", summary: "Read at most 25 Account summaries from one exact org.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: ["api", "refresh_token"],
            capabilityKeys: ["account_list"], payloadSchema: [:], resultSchema: ["accounts": .string("bounded Salesforce Account summaries")]),
        ProviderActionTemplate(
            actionKey: "salesforce_opportunity_list", displayName: "List Salesforce opportunities", summary: "Read at most 25 Opportunity stage/value summaries from one exact org.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ["api", "refresh_token"], capabilityKeys: ["opportunity_list"], payloadSchema: [:], resultSchema: ["opportunities": .string("bounded Salesforce Opportunity summaries")]),
        ProviderActionTemplate(
            actionKey: "salesforce_opportunity_get", displayName: "Get Salesforce opportunity", summary: "Read one exact Opportunity stage/value summary.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: ["api", "refresh_token"],
            capabilityKeys: ["opportunity_get"], payloadSchema: ["opportunityId": .string("15- or 18-character Salesforce Opportunity ID")], resultSchema: ["opportunity": .string("Salesforce Opportunity summary")]),
        ProviderActionTemplate(
            actionKey: "salesforce_record_mutation", displayName: "Mutate Salesforce records", summary: "Create, update, merge, convert, or delete Salesforce records.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["record_mutation"], payloadSchema: [:], resultSchema: [:], blockedReason: "All Salesforce mutations are outside read-only V1."),
        ProviderActionTemplate(
            actionKey: "salesforce_private_crm", displayName: "Read private Salesforce CRM data", summary: "Access contacts, leads, users, cases, activities, notes, files, or email.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["private_crm"], payloadSchema: [:], resultSchema: [:], blockedReason: "Private identity and communication surfaces are outside V1."),
        ProviderActionTemplate(
            actionKey: "salesforce_broader_api", displayName: "Access broader Salesforce APIs", summary: "Access custom objects or Bulk, Composite, Tooling, Metadata, Connect, GraphQL, or frontdoor APIs.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["broader_api"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broader Salesforce APIs and session bridging are outside V1."),
        ProviderActionTemplate(
            actionKey: "salesforce_raw_query", displayName: "Run raw Salesforce query", summary: "Execute caller-provided SOQL, SOSL, object, field, host, cursor, or REST path.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["raw_query"], payloadSchema: [:], resultSchema: [:], blockedReason: "Arbitrary Salesforce queries and paths are blocked."),
        ProviderActionTemplate(
            actionKey: "salesforce_bulk_export", displayName: "Export Salesforce data", summary: "Paginate, queryAll, crawl, synchronize, or bulk export org data.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["bulk_export"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broad Salesforce export and automatic pagination are blocked.")
    ]

    private static let hubSpotTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "hubspot_company_list", displayName: "List HubSpot companies", summary: "Read at most 25 Company summaries from one exact account.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ["oauth", "crm.objects.companies.read", "crm.objects.deals.read"], capabilityKeys: ["company_list"], payloadSchema: [:], resultSchema: ["companies": .string("bounded HubSpot Company summaries")]),
        ProviderActionTemplate(
            actionKey: "hubspot_deal_list", displayName: "List HubSpot deals", summary: "Read at most 25 Deal pipeline/value summaries from one exact account.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ["oauth", "crm.objects.companies.read", "crm.objects.deals.read"], capabilityKeys: ["deal_list"], payloadSchema: [:], resultSchema: ["deals": .string("bounded HubSpot Deal summaries")]),
        ProviderActionTemplate(
            actionKey: "hubspot_deal_get", displayName: "Get HubSpot deal", summary: "Read one exact Deal pipeline/value summary.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ["oauth", "crm.objects.companies.read", "crm.objects.deals.read"], capabilityKeys: ["deal_get"], payloadSchema: ["dealId": .string("positive numeric HubSpot Deal ID")], resultSchema: ["deal": .string("HubSpot Deal summary")]),
        ProviderActionTemplate(
            actionKey: "hubspot_record_mutation", displayName: "Mutate HubSpot records", summary: "Create, update, associate, archive, restore, or delete CRM records.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["record_mutation"], payloadSchema: [:], resultSchema: [:], blockedReason: "All HubSpot mutations are outside read-only V1."),
        ProviderActionTemplate(
            actionKey: "hubspot_private_crm", displayName: "Read private HubSpot CRM data", summary: "Access contacts, owners, users, email, calls, meetings, notes, tickets, or payments.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["private_crm"], payloadSchema: [:], resultSchema: [:], blockedReason: "Private identity and engagement surfaces are outside V1."),
        ProviderActionTemplate(
            actionKey: "hubspot_broader_crm", displayName: "Access broader HubSpot CRM", summary: "Access custom objects/properties, associations/history, products, quotes, line items, webhooks, or extensions.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported,
            defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["broader_crm"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broader HubSpot CRM and app-extension surfaces are outside V1."),
        ProviderActionTemplate(
            actionKey: "hubspot_raw_search", displayName: "Run raw HubSpot search", summary: "Supply arbitrary object, query, filter, property, association, cursor, archive flag, or path.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["raw_search"], payloadSchema: [:], resultSchema: [:], blockedReason: "Arbitrary HubSpot search and path access is blocked."),
        ProviderActionTemplate(
            actionKey: "hubspot_bulk_export", displayName: "Export HubSpot data", summary: "Paginate, crawl, synchronize, or broadly export account records.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["bulk_export"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broad HubSpot export and automatic pagination are blocked.")
    ]

    private static let pipedriveTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "pipedrive_organization_list", displayName: "List Pipedrive organizations", summary: "Read at most 25 Organization summaries from one exact company.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ["base", "contacts:read", "deals:read"], capabilityKeys: ["organization_list"], payloadSchema: [:], resultSchema: ["organizations": .string("bounded Pipedrive Organization summaries")]),
        ProviderActionTemplate(
            actionKey: "pipedrive_deal_list", displayName: "List Pipedrive deals", summary: "Read at most 25 Deal pipeline/value summaries from one exact company.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ["base", "contacts:read", "deals:read"], capabilityKeys: ["deal_list"], payloadSchema: [:], resultSchema: ["deals": .string("bounded Pipedrive Deal summaries")]),
        ProviderActionTemplate(
            actionKey: "pipedrive_deal_get", displayName: "Get Pipedrive deal", summary: "Read one exact Deal pipeline/value summary.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: ["base", "contacts:read", "deals:read"],
            capabilityKeys: ["deal_get"], payloadSchema: ["dealId": .string("positive numeric Pipedrive Deal ID")], resultSchema: ["deal": .string("Pipedrive Deal summary")]),
        ProviderActionTemplate(
            actionKey: "pipedrive_record_mutation", displayName: "Mutate Pipedrive records", summary: "Create, update, merge, archive, or delete CRM records.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["record_mutation"], payloadSchema: [:], resultSchema: [:], blockedReason: "All Pipedrive mutations are outside read-only V1."),
        ProviderActionTemplate(
            actionKey: "pipedrive_private_crm", displayName: "Read private Pipedrive CRM data", summary: "Access persons, owners, users, email, phone, address, activities, notes, files, participants, or followers.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported,
            defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["private_crm"], payloadSchema: [:], resultSchema: [:], blockedReason: "Private identity and engagement surfaces are outside V1."),
        ProviderActionTemplate(
            actionKey: "pipedrive_broader_crm", displayName: "Access broader Pipedrive CRM", summary: "Access products, leads, projects, filters, pipelines, stages, statistics, custom fields, labels, or archived data.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported,
            defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["broader_crm"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broader Pipedrive CRM surfaces are outside V1."),
        ProviderActionTemplate(
            actionKey: "pipedrive_raw_search", displayName: "Run raw Pipedrive search", summary: "Supply arbitrary search, field, include, filter, cursor, domain, or path parameters.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["raw_search"], payloadSchema: [:], resultSchema: [:], blockedReason: "Arbitrary Pipedrive search and path access is blocked."),
        ProviderActionTemplate(
            actionKey: "pipedrive_bulk_export", displayName: "Export Pipedrive data", summary: "Paginate, crawl, synchronize, or broadly export company records.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["bulk_export"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broad Pipedrive export and automatic pagination are blocked.")
    ]

    private static let copperTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "copper_account_get", displayName: "Get Copper account", summary: "Read bounded metadata for the exact token-bound Copper account.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: ["developer/v1/all"],
            capabilityKeys: ["account_get"], payloadSchema: [:], resultSchema: ["account": .string("exact Copper Account ID/name/timezone")]),
        ProviderActionTemplate(
            actionKey: "copper_opportunity_list", displayName: "List Copper opportunities", summary: "Read at most 25 modified-recent Opportunity pipeline/value summaries.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ["developer/v1/all"], capabilityKeys: ["opportunity_list"], payloadSchema: [:], resultSchema: ["opportunities": .string("bounded Copper Opportunity summaries")]),
        ProviderActionTemplate(
            actionKey: "copper_opportunity_get", displayName: "Get Copper opportunity", summary: "Read one exact Opportunity pipeline/value summary.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: ["developer/v1/all"],
            capabilityKeys: ["opportunity_get"], payloadSchema: ["opportunityId": .string("positive numeric Copper Opportunity ID")], resultSchema: ["opportunity": .string("Copper Opportunity summary")]),
        ProviderActionTemplate(
            actionKey: "copper_record_mutation", displayName: "Mutate Copper records", summary: "Create, update, convert, relate, bulk-change, or delete CRM records.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["record_mutation"], payloadSchema: [:], resultSchema: [:], blockedReason: "All Copper mutations are outside read-only V1."),
        ProviderActionTemplate(
            actionKey: "copper_private_crm", displayName: "Read private Copper CRM data", summary: "Access People, Leads, Users, contact data, activities, descriptions, custom fields, tags, files, or relationships.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported,
            defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["private_crm"], payloadSchema: [:], resultSchema: [:], blockedReason: "Private identity and engagement surfaces are outside V1."),
        ProviderActionTemplate(
            actionKey: "copper_broader_crm", displayName: "Access broader Copper CRM", summary: "Access Projects, Tasks, pipelines, sources, loss reasons, field layouts, webhooks, or administration.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["broader_crm"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broader Copper CRM surfaces are outside V1."),
        ProviderActionTemplate(
            actionKey: "copper_raw_search", displayName: "Run raw Copper search", summary: "Supply arbitrary filters, paths, bodies, sort fields, pages, or API-key headers.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["raw_search"], payloadSchema: [:], resultSchema: [:], blockedReason: "Arbitrary Copper search and path access is blocked."),
        ProviderActionTemplate(
            actionKey: "copper_bulk_export", displayName: "Export Copper data", summary: "Paginate, crawl, synchronize, or broadly export account records.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["bulk_export"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broad Copper export and automatic pagination are blocked.")
    ]

    private static let closeTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "close_organization_get", displayName: "Get Close Organization", summary: "Read bounded metadata for the exact token-bound Close Organization.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ["all.full_access", "offline_access"], capabilityKeys: ["organization_get"], payloadSchema: [:], resultSchema: ["organization": .string("exact Close Organization metadata")]),
        ProviderActionTemplate(
            actionKey: "close_opportunity_list", displayName: "List Close Opportunities", summary: "Read at most 25 recently updated Opportunity pipeline/value summaries.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ["all.full_access", "offline_access"], capabilityKeys: ["opportunity_list"], payloadSchema: [:], resultSchema: ["opportunities": .string("bounded Close Opportunity summaries")]),
        ProviderActionTemplate(
            actionKey: "close_opportunity_get", displayName: "Get Close Opportunity", summary: "Read one exact Opportunity pipeline/value summary.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: ["all.full_access", "offline_access"],
            capabilityKeys: ["opportunity_get"], payloadSchema: ["opportunityId": .string("Close oppo_ Opportunity ID")], resultSchema: ["opportunity": .string("Close Opportunity summary")]),
        ProviderActionTemplate(
            actionKey: "close_record_mutation", displayName: "Mutate Close records", summary: "Create, update, convert, merge, send, relate, or delete records.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["record_mutation"], payloadSchema: [:], resultSchema: [:], blockedReason: "All Close mutations are outside read-only V1."),
        ProviderActionTemplate(
            actionKey: "close_private_crm", displayName: "Read private Close CRM data", summary: "Access Contacts, Users, memberships, email, phone, notes, activities, files, comments, or custom fields.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["private_crm"], payloadSchema: [:], resultSchema: [:], blockedReason: "Private identity and communication surfaces are outside V1."),
        ProviderActionTemplate(
            actionKey: "close_broader_crm", displayName: "Access broader Close CRM", summary: "Access Leads, tasks, sequences, roles, groups, integrations, webhooks, or administration.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["broader_crm"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broader Close CRM surfaces are outside V1."),
        ProviderActionTemplate(
            actionKey: "close_raw_search", displayName: "Run raw Close search", summary: "Supply arbitrary query, filter, grouping, report, field, pagination, or path inputs.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["raw_search"], payloadSchema: [:], resultSchema: [:], blockedReason: "Arbitrary Close search, reporting, and path access is blocked."),
        ProviderActionTemplate(
            actionKey: "close_bulk_export", displayName: "Export Close data", summary: "Paginate, crawl, synchronize, or broadly export Organization records.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["bulk_export"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broad Close export and automatic pagination are blocked.")
    ]

    private static let zendeskTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "zendesk_ticket_count", displayName: "Count Zendesk tickets", summary: "Read the provider-maintained ticket count for one exact Support instance.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: ["tickets:read"],
            capabilityKeys: ["ticket_count"], payloadSchema: [:], resultSchema: ["ticketCount": .string("ticket count"), "refreshedAt": .string("provider refresh timestamp")]),
        ProviderActionTemplate(
            actionKey: "zendesk_ticket_list", displayName: "List Zendesk tickets", summary: "Read at most 25 recently updated privacy-redacted ticket summaries.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: ["tickets:read"],
            capabilityKeys: ["ticket_list"], payloadSchema: [:], resultSchema: ["tickets": .string("bounded Zendesk ticket triage summaries")]),
        ProviderActionTemplate(
            actionKey: "zendesk_ticket_get", displayName: "Get Zendesk ticket", summary: "Read one exact privacy-redacted ticket summary.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: ["tickets:read"], capabilityKeys: ["ticket_get"],
            payloadSchema: ["ticketId": .string("positive numeric Zendesk ticket ID")], resultSchema: ["ticket": .string("Zendesk ticket triage summary")]),
        ProviderActionTemplate(
            actionKey: "zendesk_ticket_mutation", displayName: "Mutate Zendesk tickets", summary: "Create, update, merge, comment, solve, close, or delete tickets.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["ticket_mutation"], payloadSchema: [:], resultSchema: [:], blockedReason: "All Zendesk ticket mutations are outside read-only V1."),
        ProviderActionTemplate(
            actionKey: "zendesk_private_support", displayName: "Read private Zendesk support data", summary: "Access identities, descriptions, comments, audits, attachments, collaborators, followers, tags, or custom fields.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported,
            defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["private_support"], payloadSchema: [:], resultSchema: [:], blockedReason: "Private customer-support content is outside V1."),
        ProviderActionTemplate(
            actionKey: "zendesk_broader_admin", displayName: "Access broader Zendesk administration", summary: "Access users, organizations, macros, triggers, automations, apps, webhooks, Help Center, Chat, Sell, or Sunshine.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported,
            defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["broader_admin"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broader Zendesk products and administration are outside V1."),
        ProviderActionTemplate(
            actionKey: "zendesk_raw_search", displayName: "Run raw Zendesk search", summary: "Supply arbitrary origins, paths, queries, side-loads, filters, fields, pages, or impersonation.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["raw_search"], payloadSchema: [:], resultSchema: [:], blockedReason: "Arbitrary Zendesk search and path access is blocked."),
        ProviderActionTemplate(
            actionKey: "zendesk_bulk_export", displayName: "Export Zendesk data", summary: "Paginate, crawl, synchronize, or broadly export Support records.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["bulk_export"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broad Zendesk export and automatic pagination are blocked.")
    ]

    private static let intercomTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "intercom_conversation_count", displayName: "Count Intercom conversations", summary: "Read the provider total for one exact Intercom workspace.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ["Read conversations", "Read admins"], capabilityKeys: ["conversation_count"], payloadSchema: [:], resultSchema: ["conversationCount": .string("conversation total")]),
        ProviderActionTemplate(
            actionKey: "intercom_conversation_list", displayName: "List Intercom conversations", summary: "Read at most 25 privacy-redacted conversation metadata summaries.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ["Read conversations", "Read admins"], capabilityKeys: ["conversation_list"], payloadSchema: [:], resultSchema: ["conversationCount": .string("conversation total"), "conversations": .string("bounded Intercom conversation metadata summaries")]),
        ProviderActionTemplate(
            actionKey: "intercom_conversation_get", displayName: "Get Intercom conversation", summary: "Read one exact privacy-redacted conversation metadata summary.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ["Read conversations", "Read admins"], capabilityKeys: ["conversation_get"], payloadSchema: ["conversationId": .string("positive numeric Intercom conversation ID")], resultSchema: ["conversation": .string("Intercom conversation metadata summary")]),
        ProviderActionTemplate(
            actionKey: "intercom_conversation_mutation", displayName: "Mutate Intercom conversations", summary: "Create, reply, note, mark read, assign, open, close, snooze, delete, redact, or tag conversations.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported,
            defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["conversation_mutation"], payloadSchema: [:], resultSchema: [:], blockedReason: "All Intercom conversation mutations are outside read-only V1."),
        ProviderActionTemplate(
            actionKey: "intercom_private_communication", displayName: "Read private Intercom communication", summary: "Access message bodies, contacts, teammate identity, parts, attachments, URLs, tags, custom attributes, linked objects, or ratings.", kind: .admin, riskLevel: .destructive,
            adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["private_communication"], payloadSchema: [:], resultSchema: [:], blockedReason: "Private customer communication content is outside V1."),
        ProviderActionTemplate(
            actionKey: "intercom_broader_workspace", displayName: "Access broader Intercom workspace", summary: "Access People, Companies, Admin lists, Tickets, Articles, Fin, Messenger, Inbox, Canvas, events, webhooks, or administration.", kind: .admin, riskLevel: .destructive,
            adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["broader_workspace"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broader Intercom workspace and product surfaces are outside V1."),
        ProviderActionTemplate(
            actionKey: "intercom_raw_search", displayName: "Run raw Intercom search", summary: "Supply arbitrary origins, versions, paths, queries, search payloads, filters, cursors, or pagination.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["raw_search"], payloadSchema: [:], resultSchema: [:], blockedReason: "Arbitrary Intercom search and path access is blocked."),
        ProviderActionTemplate(
            actionKey: "intercom_bulk_export", displayName: "Export Intercom data", summary: "Paginate, crawl, synchronize, or broadly export workspace records.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["bulk_export"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broad Intercom export and automatic pagination are blocked.")
    ]

    private static let helpScoutTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "help_scout_conversation_count", displayName: "Count Help Scout Conversations", summary: "Read the active Conversation total for one exact company.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: [],
            capabilityKeys: ["conversation_count"], payloadSchema: [:], resultSchema: ["conversationCount": .string("active Conversation total")]),
        ProviderActionTemplate(
            actionKey: "help_scout_conversation_list", displayName: "List Help Scout Conversations", summary: "Read at most 25 newest active privacy-redacted Conversation metadata summaries.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: [], capabilityKeys: ["conversation_list"], payloadSchema: [:], resultSchema: ["conversationCount": .string("active Conversation total"), "conversations": .string("bounded Help Scout Conversation metadata")]),
        ProviderActionTemplate(
            actionKey: "help_scout_conversation_get", displayName: "Get Help Scout Conversation", summary: "Read one exact privacy-redacted Conversation metadata summary.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: [],
            capabilityKeys: ["conversation_get"], payloadSchema: ["conversationId": .string("positive numeric Help Scout Conversation ID")], resultSchema: ["conversation": .string("Help Scout Conversation metadata summary")]),
        ProviderActionTemplate(
            actionKey: "help_scout_conversation_mutation", displayName: "Mutate Help Scout Conversations", summary: "Create, reply, note, assign, move, publish, status-change, snooze, merge, or delete Conversations.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported,
            defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["conversation_mutation"], payloadSchema: [:], resultSchema: [:], blockedReason: "All Help Scout Conversation mutations are outside read-only V1."),
        ProviderActionTemplate(
            actionKey: "help_scout_private_communication", displayName: "Read private Help Scout communication", summary: "Access previews, thread bodies, identities, email addresses, cc/bcc, attachments, tags, custom fields, or web links.", kind: .admin, riskLevel: .destructive,
            adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["private_communication"], payloadSchema: [:], resultSchema: [:], blockedReason: "Private communication content and identity are outside V1."),
        ProviderActionTemplate(
            actionKey: "help_scout_broader_account", displayName: "Access broader Help Scout account", summary: "Access Customers, Users, Mailboxes, Teams, Docs, Beacon, workflows, webhooks, or account administration.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported,
            defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["broader_account"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broader Help Scout account surfaces are outside V1."),
        ProviderActionTemplate(
            actionKey: "help_scout_raw_search", displayName: "Run raw Help Scout search", summary: "Supply arbitrary queries, filters, links, embeds, pages, origins, or paths.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["raw_search"], payloadSchema: [:], resultSchema: [:], blockedReason: "Arbitrary Help Scout search and resource traversal are blocked."),
        ProviderActionTemplate(
            actionKey: "help_scout_bulk_export", displayName: "Export Help Scout data", summary: "Paginate, crawl, synchronize, or broadly export company records.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["bulk_export"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broad Help Scout export and automatic pagination are blocked.")
    ]

    private static let frontTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "front_conversation_list", displayName: "List Front Conversations", summary: "Read at most 25 newest company-visible privacy-redacted Front Conversation metadata summaries.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ["conversations:read"], capabilityKeys: ["conversation_list"], payloadSchema: [:], resultSchema: ["conversations": .string("bounded Front Conversation metadata")]),
        ProviderActionTemplate(
            actionKey: "front_conversation_get", displayName: "Get Front Conversation", summary: "Read one exact privacy-redacted Front Conversation metadata summary.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ["conversations:read"], capabilityKeys: ["conversation_get"], payloadSchema: ["conversationId": .string("Front Conversation ID in cnv_ form")], resultSchema: ["conversation": .string("Front Conversation metadata summary")]),
        ProviderActionTemplate(
            actionKey: "front_conversation_mutation", displayName: "Mutate Front Conversations", summary: "Create, assign, move, status-change, archive, restore, tag, merge, or delete Conversations.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["conversation_mutation"], payloadSchema: [:], resultSchema: [:], blockedReason: "All Front Conversation mutations are outside read-only V1."),
        ProviderActionTemplate(
            actionKey: "front_private_communication", displayName: "Read or send Front communication", summary: "Access messages, comments, drafts, bodies, recipients, teammate/contact identity, handles, attachments, or replies.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported,
            defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["private_communication"], payloadSchema: [:], resultSchema: [:], blockedReason: "Private Front communication content and identity are outside V1."),
        ProviderActionTemplate(
            actionKey: "front_broader_company", displayName: "Access broader Front company resources", summary: "Access private resources, inboxes, channels, teammates, contacts, accounts, tags, rules, events, analytics, webhooks, or MCP tools.", kind: .admin, riskLevel: .destructive,
            adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["broader_company"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broader Front company resources are outside V1."),
        ProviderActionTemplate(
            actionKey: "front_raw_search", displayName: "Run raw Front search", summary: "Supply arbitrary search queries, filters, links, page tokens, origins, or paths.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["raw_search"], payloadSchema: [:], resultSchema: [:], blockedReason: "Arbitrary Front search and resource traversal are blocked."),
        ProviderActionTemplate(
            actionKey: "front_bulk_export", displayName: "Export Front data", summary: "Paginate, crawl, synchronize, or broadly export company records.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["bulk_export"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broad Front export and automatic pagination are blocked.")
    ]

    private static let teamworkTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "teamwork_project_list", displayName: "List Teamwork Projects", summary: "Read at most 25 accessible privacy-redacted Teamwork Project metadata summaries.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ["Teamwork.com"], capabilityKeys: ["project_list"], payloadSchema: [:], resultSchema: ["projects": .string("bounded Teamwork Project metadata")]),
        ProviderActionTemplate(
            actionKey: "teamwork_task_list", displayName: "List Teamwork Tasks", summary: "Read at most 25 accessible privacy-redacted Teamwork Task metadata summaries.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: ["Teamwork.com"],
            capabilityKeys: ["task_list"], payloadSchema: [:], resultSchema: ["tasks": .string("bounded Teamwork Task metadata")]),
        ProviderActionTemplate(
            actionKey: "teamwork_task_get", displayName: "Get Teamwork Task", summary: "Read one exact privacy-redacted Teamwork Task metadata summary.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: ["Teamwork.com"],
            capabilityKeys: ["task_get"], payloadSchema: ["taskId": .string("positive decimal Teamwork Task ID")], resultSchema: ["task": .string("Teamwork Task metadata summary")]),
        ProviderActionTemplate(
            actionKey: "teamwork_mutation", displayName: "Mutate Teamwork work", summary: "Create, update, complete, reopen, move, assign, archive, or delete Teamwork objects.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["mutation"], payloadSchema: [:], resultSchema: [:], blockedReason: "All Teamwork mutations are outside read-only V1."),
        ProviderActionTemplate(
            actionKey: "teamwork_private_content", displayName: "Access Teamwork content or identity", summary: "Access descriptions, comments, people, assignees, email, files, links, notebooks, messages, or identity.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported,
            defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["private_content"], payloadSchema: [:], resultSchema: [:], blockedReason: "Teamwork collaboration content and identity are outside V1."),
        ProviderActionTemplate(
            actionKey: "teamwork_financial_time", displayName: "Access Teamwork time or financial data", summary: "Access time entries, rates, costs, budgets, billing, invoices, or reports.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["financial_time"], payloadSchema: [:], resultSchema: [:], blockedReason: "Teamwork time and financial surfaces are outside V1."),
        ProviderActionTemplate(
            actionKey: "teamwork_raw_query", displayName: "Run raw Teamwork query", summary: "Supply arbitrary origins, paths, fields, includes, filters, searches, or page controls.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["raw_query"], payloadSchema: [:], resultSchema: [:], blockedReason: "Arbitrary Teamwork traversal and query injection are blocked."),
        ProviderActionTemplate(
            actionKey: "teamwork_bulk_export", displayName: "Export Teamwork data", summary: "Paginate, crawl, synchronize, or broadly export installation records.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["bulk_export"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broad Teamwork export and automatic pagination are blocked.")
    ]

    private static let basecampTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "basecamp_project_list", displayName: "List Basecamp Projects", summary: "Read at most 25 first-page accessible privacy-redacted Project summaries.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: [],
            capabilityKeys: ["project_list"], payloadSchema: [:], resultSchema: ["projects": .string("bounded Basecamp Project metadata")]),
        ProviderActionTemplate(
            actionKey: "basecamp_project_get", displayName: "Get Basecamp Project", summary: "Read one exact privacy-redacted Basecamp Project summary.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: [], capabilityKeys: ["project_get"],
            payloadSchema: ["projectId": .string("positive decimal Basecamp Project ID")], resultSchema: ["project": .string("Basecamp Project metadata")]),
        ProviderActionTemplate(
            actionKey: "basecamp_todo_get", displayName: "Get Basecamp To-do", summary: "Read one exact privacy-redacted Basecamp To-do summary.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: [], capabilityKeys: ["todo_get"],
            payloadSchema: ["todoId": .string("positive decimal Basecamp To-do ID")], resultSchema: ["todo": .string("Basecamp To-do metadata")]),
        ProviderActionTemplate(
            actionKey: "basecamp_mutation", displayName: "Mutate Basecamp work", summary: "Create, update, complete, uncomplete, reposition, archive, or trash Basecamp records.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["mutation"], payloadSchema: [:], resultSchema: [:], blockedReason: "All Basecamp mutations are outside V1."),
        ProviderActionTemplate(
            actionKey: "basecamp_private_collaboration", displayName: "Access Basecamp collaboration content", summary: "Access descriptions, people, assignees, comments, boosts, files, messages, documents, chat, or forwards.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported,
            defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["private_collaboration"], payloadSchema: [:], resultSchema: [:], blockedReason: "Basecamp collaboration content and identity are outside V1."),
        ProviderActionTemplate(
            actionKey: "basecamp_broader_account", displayName: "Access broader Basecamp account", summary: "Access schedules, timesheets, reports, templates, notifications, people, admin, or webhooks.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["broader_account"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broader Basecamp account surfaces are outside V1."),
        ProviderActionTemplate(
            actionKey: "basecamp_raw_query", displayName: "Run raw Basecamp query", summary: "Supply arbitrary account, origin, path, filters, search, links, or pages.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["raw_query"], payloadSchema: [:], resultSchema: [:], blockedReason: "Arbitrary Basecamp traversal and Link pagination are blocked."),
        ProviderActionTemplate(
            actionKey: "basecamp_bulk_export", displayName: "Export Basecamp data", summary: "Paginate, crawl, synchronize, or broadly export account records.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["bulk_export"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broad Basecamp export is blocked.")
    ]

    private static let wrikeTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "wrike_project_list", displayName: "List Wrike Projects", summary: "Read at most 25 privacy-redacted Wrike Project metadata summaries.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: ["wsReadOnly"],
            capabilityKeys: ["project_list"], payloadSchema: [:], resultSchema: ["projects": .string("bounded Wrike Project metadata")]),
        ProviderActionTemplate(
            actionKey: "wrike_task_list", displayName: "List Wrike Tasks", summary: "Read at most 25 updated-recent privacy-redacted Wrike Task metadata summaries.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: ["wsReadOnly"],
            capabilityKeys: ["task_list"], payloadSchema: [:], resultSchema: ["tasks": .string("bounded Wrike Task metadata")]),
        ProviderActionTemplate(
            actionKey: "wrike_task_get", displayName: "Get Wrike Task", summary: "Read one exact privacy-redacted Wrike Task metadata summary.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: ["wsReadOnly"], capabilityKeys: ["task_get"],
            payloadSchema: ["taskId": .string("bounded Wrike opaque Task ID")], resultSchema: ["task": .string("Wrike Task metadata")]),
        ProviderActionTemplate(
            actionKey: "wrike_mutation", displayName: "Mutate Wrike work", summary: "Create, update, move, assign, status-change, or delete Wrike records.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["mutation"], payloadSchema: [:], resultSchema: [:], blockedReason: "All Wrike mutations are outside read-only V1."),
        ProviderActionTemplate(
            actionKey: "wrike_private_content", displayName: "Access Wrike private content", summary: "Access descriptions, people, assignees, comments, attachments, sharing, followers, or identity.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["private_content"], payloadSchema: [:], resultSchema: [:], blockedReason: "Wrike private content and identity are outside V1."),
        ProviderActionTemplate(
            actionKey: "wrike_broader_account", displayName: "Access broader Wrike account", summary: "Access custom fields/statuses, workflows, timelogs, effort, billing, dependencies, webhooks, BI Export, or administration.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported,
            defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["broader_account"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broader Wrike account surfaces are outside V1."),
        ProviderActionTemplate(
            actionKey: "wrike_raw_query", displayName: "Run raw Wrike query", summary: "Supply arbitrary host, paths, fields, filters, searches, or page tokens.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["raw_query"], payloadSchema: [:], resultSchema: [:], blockedReason: "Arbitrary Wrike traversal and query injection are blocked."),
        ProviderActionTemplate(
            actionKey: "wrike_bulk_export", displayName: "Export Wrike data", summary: "Paginate, crawl, synchronize, or broadly export account records.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["bulk_export"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broad Wrike export and automatic pagination are blocked.")
    ]

    private static let smartsheetTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "smartsheet_sheet_list", displayName: "List Smartsheet Sheets", summary: "Read at most 25 Smartsheet Sheet metadata summaries.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: ["READ_SHEETS"],
            capabilityKeys: ["sheet_list"], payloadSchema: [:], resultSchema: ["sheets": .string("bounded Smartsheet Sheet metadata")]),
        ProviderActionTemplate(
            actionKey: "smartsheet_sheet_get", displayName: "Get Smartsheet Sheet", summary: "Read one exact Sheet with at most 25 rows and 100 columns/cells per row.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: ["READ_SHEETS"],
            capabilityKeys: ["sheet_get"], payloadSchema: ["sheetId": .string("exact numeric Smartsheet Sheet ID")], resultSchema: ["sheet": .string("bounded Smartsheet Sheet and Row data")]),
        ProviderActionTemplate(
            actionKey: "smartsheet_row_get", displayName: "Get Smartsheet Row", summary: "Read one exact Row with bounded displayed cell values and column context.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: ["READ_SHEETS"],
            capabilityKeys: ["row_get"], payloadSchema: ["sheetId": .string("exact numeric Smartsheet Sheet ID"), "rowId": .string("exact numeric Smartsheet Row ID")], resultSchema: ["row": .string("bounded Smartsheet Row data")]),
        ProviderActionTemplate(
            actionKey: "smartsheet_mutation", displayName: "Mutate Smartsheet work", summary: "Create, update, move, share, or delete Smartsheet resources.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["mutation"], payloadSchema: [:], resultSchema: [:], blockedReason: "All Smartsheet mutations are outside read-only V1."),
        ProviderActionTemplate(
            actionKey: "smartsheet_private_collaboration", displayName: "Access Smartsheet collaboration content", summary: "Access attachments, discussions, comments, contacts, formulas, links, images, proofs, or identity.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported,
            defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["private_collaboration"], payloadSchema: [:], resultSchema: [:], blockedReason: "Smartsheet collaboration and identity surfaces are outside V1."),
        ProviderActionTemplate(
            actionKey: "smartsheet_broader_account", displayName: "Access broader Smartsheet account", summary: "Access users, groups, workspaces, dashboards, reports, events, webhooks, administration, or sharing.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported,
            defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["broader_account"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broader Smartsheet account surfaces are outside V1."),
        ProviderActionTemplate(
            actionKey: "smartsheet_raw_query", displayName: "Run raw Smartsheet query", summary: "Supply arbitrary region, paths, includes, excludes, filters, row IDs, pages, or page sizes.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["raw_query"], payloadSchema: [:], resultSchema: [:], blockedReason: "Arbitrary Smartsheet traversal and query injection are blocked."),
        ProviderActionTemplate(
            actionKey: "smartsheet_bulk_export", displayName: "Export Smartsheet data", summary: "Paginate, crawl, synchronize, or broadly export sheets and rows.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["bulk_export"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broad Smartsheet export and automatic pagination are blocked.")
    ]

    private static let todoistTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "todoist_project_list", displayName: "List Todoist Projects", summary: "Read at most 25 Todoist Project summaries.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: ["data:read"], capabilityKeys: ["project_list"],
            payloadSchema: [:], resultSchema: ["projects": .string("bounded Todoist Project summaries")]),
        ProviderActionTemplate(
            actionKey: "todoist_task_list", displayName: "List Todoist Tasks", summary: "Read at most 25 active Todoist Task summaries.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: ["data:read"], capabilityKeys: ["task_list"],
            payloadSchema: [:], resultSchema: ["tasks": .string("bounded Todoist active Task summaries")]),
        ProviderActionTemplate(
            actionKey: "todoist_task_get", displayName: "Get Todoist Task", summary: "Read one exact active Todoist Task summary.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: ["data:read"], capabilityKeys: ["task_get"],
            payloadSchema: ["taskId": .string("exact bounded Todoist Task ID")], resultSchema: ["task": .string("Todoist active Task summary")]),
        ProviderActionTemplate(
            actionKey: "todoist_mutation", displayName: "Mutate Todoist work", summary: "Create, update, complete, archive, move, or delete Todoist resources.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["mutation"], payloadSchema: [:], resultSchema: [:], blockedReason: "All Todoist mutations are outside read-only V1."),
        ProviderActionTemplate(
            actionKey: "todoist_private_collaboration", displayName: "Access Todoist private collaboration", summary: "Access descriptions, labels, people, comments, files, links, reminders, or activity.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["private_collaboration"], payloadSchema: [:], resultSchema: [:], blockedReason: "Todoist private and collaboration surfaces are outside V1."),
        ProviderActionTemplate(
            actionKey: "todoist_broader_account", displayName: "Access broader Todoist account", summary: "Access workspaces, teams, collaborators, filters, notifications, backups, webhooks, settings, or administration.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported,
            defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["broader_account"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broader Todoist account surfaces are outside V1."),
        ProviderActionTemplate(
            actionKey: "todoist_raw_query", displayName: "Run raw Todoist query", summary: "Supply arbitrary host, path, filters, labels, IDs, cursors, Sync, or MCP input.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["raw_query"], payloadSchema: [:], resultSchema: [:], blockedReason: "Arbitrary Todoist traversal, Sync, hosted MCP and query injection are blocked."),
        ProviderActionTemplate(
            actionKey: "todoist_bulk_export", displayName: "Export Todoist data", summary: "Paginate, synchronize, back up, crawl, or broadly export Todoist data.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["bulk_export"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broad Todoist export and automatic pagination are blocked.")
    ]

    private static let harvestTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "harvest_project_assignment_list", displayName: "List Harvest Project Assignments", summary: "Read at most 25 active Harvest Project Assignment summaries.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: [],
            capabilityKeys: ["project_assignment_list"], payloadSchema: [:], resultSchema: ["projectAssignments": .string("bounded Harvest Project Assignment summaries")]),
        ProviderActionTemplate(
            actionKey: "harvest_time_entry_list", displayName: "List Harvest Time Entries", summary: "Read at most 25 current-user Time Entries from the last fourteen days.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: [],
            capabilityKeys: ["time_entry_list"], payloadSchema: [:], resultSchema: ["timeEntries": .string("bounded recent Harvest Time Entry summaries")]),
        ProviderActionTemplate(
            actionKey: "harvest_time_entry_get", displayName: "Get Harvest Time Entry", summary: "Read one exact privacy- and financial-redacted Harvest Time Entry.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: [],
            capabilityKeys: ["time_entry_get"], payloadSchema: ["timeEntryId": .string("exact positive Harvest Time Entry ID")], resultSchema: ["timeEntry": .string("Harvest Time Entry summary")]),
        ProviderActionTemplate(
            actionKey: "harvest_mutation", displayName: "Mutate Harvest work", summary: "Create, edit, start, stop, restart, approve, invoice, or delete Harvest records.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["mutation"], payloadSchema: [:], resultSchema: [:], blockedReason: "All Harvest mutations and timers are outside read-only V1."),
        ProviderActionTemplate(
            actionKey: "harvest_private_financial", displayName: "Access Harvest private or financial data", summary: "Access descriptions, clients, people, bills, invoices, rates, costs, budgets, expenses, approvals, or external references.", kind: .admin, riskLevel: .destructive,
            adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["private_financial"], payloadSchema: [:], resultSchema: [:], blockedReason: "Harvest private, client, people and financial surfaces are outside V1."),
        ProviderActionTemplate(
            actionKey: "harvest_broader_account", displayName: "Access broader Harvest account", summary: "Access users, teams, reports, estimates, invoices, expenses, roles, company settings, or administration.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported,
            defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["broader_account"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broader Harvest account and Reports APIs are outside V1."),
        ProviderActionTemplate(
            actionKey: "harvest_raw_query", displayName: "Run raw Harvest query", summary: "Supply arbitrary account, user, dates, filters, paths, page links, or page sizes.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["raw_query"], payloadSchema: [:], resultSchema: [:], blockedReason: "Arbitrary Harvest traversal and query injection are blocked."),
        ProviderActionTemplate(
            actionKey: "harvest_bulk_export", displayName: "Export Harvest data", summary: "Paginate, report, crawl, synchronize, or broadly export Harvest data.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["bulk_export"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broad Harvest export and automatic pagination are blocked.")
    ]

    private static let calendlyTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "calendly_event_type_list", displayName: "List Calendly Event Types", summary: "Read at most 25 active Event Type summaries for the exact Calendly user.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ["users:read", "event_types:read"], capabilityKeys: ["event_type_list"], payloadSchema: [:], resultSchema: ["eventTypes": .string("bounded Calendly Event Type summaries")]),
        ProviderActionTemplate(
            actionKey: "calendly_scheduled_event_list", displayName: "List Calendly Scheduled Events", summary: "Read at most 25 active exact-user Scheduled Events in the next fourteen days.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ["users:read", "scheduled_events:read"], capabilityKeys: ["scheduled_event_list"], payloadSchema: [:], resultSchema: ["scheduledEvents": .string("bounded upcoming Scheduled Event summaries")]),
        ProviderActionTemplate(
            actionKey: "calendly_scheduled_event_get", displayName: "Get Calendly Scheduled Event", summary: "Read one exact privacy-redacted Scheduled Event.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ["users:read", "scheduled_events:read"], capabilityKeys: ["scheduled_event_get"], payloadSchema: ["scheduledEventId": .string("exact Calendly Scheduled Event UUID")], resultSchema: ["scheduledEvent": .string("Calendly Scheduled Event summary")]),
        ProviderActionTemplate(
            actionKey: "calendly_mutation", displayName: "Mutate Calendly scheduling", summary: "Create, cancel, reschedule, mark no-show, change availability or create links.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["mutation"], payloadSchema: [:], resultSchema: [:], blockedReason: "All Calendly writes are outside read-only V1."),
        ProviderActionTemplate(
            actionKey: "calendly_invitee_private", displayName: "Access Calendly invitee private data", summary: "Access invitees, contacts, emails, questions, answers, notes, locations, conferencing, tracking or private links.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported,
            defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["invitee_private"], payloadSchema: [:], resultSchema: [:], blockedReason: "Calendly invitee/contact and private meeting surfaces are outside V1."),
        ProviderActionTemplate(
            actionKey: "calendly_broader_account", displayName: "Access broader Calendly account", summary: "Access organizations, memberships, routing, contacts, availability, webhooks, activity or compliance.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported,
            defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["broader_account"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broader Calendly account and administration surfaces are outside V1."),
        ProviderActionTemplate(
            actionKey: "calendly_raw_query", displayName: "Run raw Calendly query", summary: "Supply arbitrary user, organization, dates, status, paths, cursors or page sizes.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["raw_query"], payloadSchema: [:], resultSchema: [:], blockedReason: "Arbitrary Calendly traversal and query injection are blocked."),
        ProviderActionTemplate(
            actionKey: "calendly_bulk_export", displayName: "Export Calendly data", summary: "Paginate, synchronize, crawl or broadly export Calendly data.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["bulk_export"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broad Calendly export and automatic pagination are blocked.")
    ]

    private static let calComTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "cal_com_booking_list", displayName: "List Cal.com Bookings", summary: "Read at most 25 upcoming exact-user Booking summaries.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: ["PROFILE_READ", "BOOKING_READ"],
            capabilityKeys: ["booking_list"], payloadSchema: [:], resultSchema: ["bookings": .string("bounded upcoming Cal.com Booking summaries")]),
        ProviderActionTemplate(
            actionKey: "cal_com_booking_get", displayName: "Get Cal.com Booking", summary: "Read one exact privacy-redacted Booking.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: ["PROFILE_READ", "BOOKING_READ"],
            capabilityKeys: ["booking_get"], payloadSchema: ["bookingUid": .string("exact safe Cal.com Booking UID")], resultSchema: ["booking": .string("Cal.com Booking summary")]),
        ProviderActionTemplate(
            actionKey: "cal_com_event_type_get", displayName: "Get Cal.com Event Type", summary: "Read one exact privacy-redacted Event Type.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: ["PROFILE_READ", "EVENT_TYPE_READ"],
            capabilityKeys: ["event_type_get"], payloadSchema: ["eventTypeId": .string("exact positive Cal.com Event Type ID")], resultSchema: ["eventType": .string("Cal.com Event Type summary")]),
        ProviderActionTemplate(
            actionKey: "cal_com_mutation", displayName: "Mutate Cal.com scheduling", summary: "Create, cancel, reschedule, confirm, decline, reassign or change Event Types.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["mutation"], payloadSchema: [:], resultSchema: [:], blockedReason: "All Cal.com writes are outside read-only V1."),
        ProviderActionTemplate(
            actionKey: "cal_com_private_scheduling", displayName: "Access Cal.com private scheduling data", summary: "Access people, contacts, descriptions, locations, conferencing, recordings, answers, private links or metadata.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported,
            defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["private_scheduling"], payloadSchema: [:], resultSchema: [:], blockedReason: "Cal.com people and private meeting surfaces are outside V1."),
        ProviderActionTemplate(
            actionKey: "cal_com_broader_account", displayName: "Access broader Cal.com account", summary: "Access teams, organizations, routing, calendars, schedules, webhooks, insights or administration.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported,
            defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["broader_account"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broader Cal.com account/organization surfaces are outside V1."),
        ProviderActionTemplate(
            actionKey: "cal_com_raw_query", displayName: "Run raw Cal.com query", summary: "Supply arbitrary status, people, teams, dates, paths, cursors or page sizes.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["raw_query"], payloadSchema: [:], resultSchema: [:], blockedReason: "Arbitrary Cal.com traversal and query injection are blocked."),
        ProviderActionTemplate(
            actionKey: "cal_com_bulk_export", displayName: "Export Cal.com data", summary: "Paginate, synchronize, crawl or broadly export Cal.com data.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["bulk_export"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broad Cal.com export and automatic pagination are blocked.")
    ]

    private static let ironcladClickwrapTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "ironclad_clickwrap_site_get", displayName: "Read Ironclad Clickwrap Site", summary: "Read one exact privacy-reduced Clickwrap Site summary.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: [],
            capabilityKeys: ["site_get"], payloadSchema: [:], resultSchema: ["site": .string("exact Clickwrap Site summary")]),
        ProviderActionTemplate(
            actionKey: "ironclad_clickwrap_contract_list", displayName: "List Ironclad Clickwrap Contracts", summary: "Read page one of at most 25 privacy-reduced Contract summaries for the exact Site.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: [], capabilityKeys: ["contract_list"], payloadSchema: [:], resultSchema: ["contracts": .string("bounded Clickwrap Contract summaries")]),
        ProviderActionTemplate(
            actionKey: "ironclad_clickwrap_group_list", displayName: "List Ironclad Clickwrap Groups", summary: "Read page one of at most 25 privacy-reduced Group summaries for the exact Site.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: [], capabilityKeys: ["group_list"], payloadSchema: [:], resultSchema: ["groups": .string("bounded Clickwrap Group summaries")]),
        ProviderActionTemplate(
            actionKey: "ironclad_clickwrap_private_data", displayName: "Access private Clickwrap data", summary: "Access signers, membership, acceptance activity, agreement content, records or snapshots.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["private_data"], payloadSchema: [:], resultSchema: [:], blockedReason: "Clickwrap people, agreement content and acceptance evidence are outside V1."),
        ProviderActionTemplate(
            actionKey: "ironclad_clickwrap_mutation", displayName: "Mutate Ironclad Clickwrap", summary: "Create, edit, publish, archive, delete or otherwise mutate Clickwrap resources.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["mutation"], payloadSchema: [:], resultSchema: [:], blockedReason: "All Ironclad Clickwrap writes are outside read-only V1."),
        ProviderActionTemplate(
            actionKey: "ironclad_clickwrap_bulk_export", displayName: "Export Ironclad Clickwrap data", summary: "Download, paginate, crawl, synchronize or broadly export Clickwrap data.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["bulk_export"], payloadSchema: [:], resultSchema: [:], blockedReason: "Clickwrap downloads, exports and automatic pagination are blocked.")
    ]

    private static let docusignTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "docusign_envelope_list_recent", displayName: "List recent Docusign Envelopes", summary: "Read at most 25 Envelope summaries changed in the fixed previous fourteen days.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ["signature", "extended"], capabilityKeys: ["envelope_list_recent"], payloadSchema: [:], resultSchema: ["envelopes": .string("bounded recent Docusign Envelope summaries")]),
        ProviderActionTemplate(
            actionKey: "docusign_envelope_list_action_required", displayName: "List Docusign Envelopes awaiting signature", summary: "Read at most 25 Envelope summaries awaiting the authenticated user's signature.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI,
            defaultPermission: .approvalRequired, requiredScopes: ["signature", "extended"], capabilityKeys: ["envelope_list_action_required"], payloadSchema: [:], resultSchema: ["envelopes": .string("bounded action-required Docusign Envelope summaries")]),
        ProviderActionTemplate(
            actionKey: "docusign_envelope_get", displayName: "Get Docusign Envelope", summary: "Read one exact privacy-redacted Envelope subject/status summary with a fifteen-minute polling guard.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ["signature", "extended"], capabilityKeys: ["envelope_get"], payloadSchema: ["envelopeId": .string("exact Docusign Envelope UUID")], resultSchema: ["envelope": .string("Docusign Envelope summary")]),
        ProviderActionTemplate(
            actionKey: "docusign_mutation", displayName: "Mutate Docusign agreements", summary: "Create, send, sign, correct, void, delete, update or otherwise mutate Envelopes and templates.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["mutation"], payloadSchema: [:], resultSchema: [:], blockedReason: "All Docusign eSignature writes are outside read-only V1."),
        ProviderActionTemplate(
            actionKey: "docusign_private_agreement", displayName: "Access private Docusign agreement data", summary: "Access recipients, senders, documents, tabs, forms, payment, authentication, messages, reasons or audit data.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported,
            defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["private_agreement"], payloadSchema: [:], resultSchema: [:], blockedReason: "Docusign participant, content and private agreement surfaces are outside V1."),
        ProviderActionTemplate(
            actionKey: "docusign_broader_account", displayName: "Access broader Docusign account", summary: "Access users, groups, brands, folders, templates, Connect, administration or other Agreement Cloud products.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported,
            defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["broader_account"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broader Docusign account and administration surfaces are outside V1."),
        ProviderActionTemplate(
            actionKey: "docusign_raw_query", displayName: "Run raw Docusign query", summary: "Supply arbitrary account, base URI, date, status, folder, include, start-position, path or query input.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["raw_query"], payloadSchema: [:], resultSchema: [:], blockedReason: "Arbitrary Docusign traversal and query injection are blocked."),
        ProviderActionTemplate(
            actionKey: "docusign_bulk_export", displayName: "Download or export Docusign data", summary: "Download, paginate, synchronize, crawl or broadly export agreements or account data.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["bulk_export"], payloadSchema: [:], resultSchema: [:], blockedReason: "Docusign downloads, broad export and automatic pagination are blocked.")
    ]

    private static let docusignIdentifyTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "docusign_identify_workflow_list", displayName: "List Docusign identity-verification workflows", summary: "Read at most 100 privacy-reduced workflow configuration summaries for one exact account.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI,
            defaultPermission: .approvalRequired, requiredScopes: ["signature", "extended"], capabilityKeys: ["identity_verification_workflow_read"], payloadSchema: [:], resultSchema: ["workflows": .string("bounded Docusign identity-verification workflow summaries")]),
        ProviderActionTemplate(
            actionKey: "docusign_identify_private_data", displayName: "Access Docusign identity data", summary: "Access signers, identity evidence, documents, biometrics, liveness results or other PII.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["private_data"], payloadSchema: [:], resultSchema: [:], blockedReason: "All signer and identity-evidence surfaces are outside metadata-only V1."),
        ProviderActionTemplate(
            actionKey: "docusign_identify_mutation", displayName: "Mutate Docusign verification workflows", summary: "Create envelopes, configure recipients, select workflows or otherwise mutate Docusign resources.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported,
            defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["mutation"], payloadSchema: [:], resultSchema: [:], blockedReason: "All Docusign Identify and eSignature writes are outside read-only V1."),
        ProviderActionTemplate(
            actionKey: "docusign_identify_raw_export", displayName: "Run raw or bulk Docusign Identify access", summary: "Use raw paths, paginate, crawl, download or export identity data.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["raw_export"], payloadSchema: [:], resultSchema: [:], blockedReason: "Raw APIs, automatic pagination, evidence downloads and export are blocked.")
    ]

    private static let dropboxSignTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "dropbox_sign_signature_request_list", displayName: "List Dropbox Sign Signature Requests", summary: "Read the first 25 app-visible privacy-redacted Signature Request summaries.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ["account_access", "signature_request_access"], capabilityKeys: ["signature_request_list"], payloadSchema: [:], resultSchema: ["signatureRequests": .string("bounded Dropbox Sign Signature Request summaries")]),
        ProviderActionTemplate(
            actionKey: "dropbox_sign_signature_request_list_awaiting", displayName: "List Dropbox Sign requests awaiting signature", summary: "Read the first 25 app-visible requests awaiting the authenticated user's signature.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI,
            defaultPermission: .approvalRequired, requiredScopes: ["account_access", "signature_request_access"], capabilityKeys: ["signature_request_list_awaiting"], payloadSchema: [:], resultSchema: ["signatureRequests": .string("bounded awaiting-signature request summaries")]),
        ProviderActionTemplate(
            actionKey: "dropbox_sign_signature_request_get", displayName: "Get Dropbox Sign Signature Request", summary: "Read one exact privacy-redacted Signature Request and aggregate status counts.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ["account_access", "signature_request_access"], capabilityKeys: ["signature_request_get"], payloadSchema: ["signatureRequestId": .string("exact hexadecimal Dropbox Sign Signature Request ID")],
            resultSchema: ["signatureRequest": .string("Dropbox Sign Signature Request summary")]),
        ProviderActionTemplate(
            actionKey: "dropbox_sign_mutation", displayName: "Mutate Dropbox Sign Signature Requests", summary: "Create, send, update, remind, release, cancel, remove or sign requests.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["mutation"], payloadSchema: [:], resultSchema: [:], blockedReason: "All Dropbox Sign mutations are outside read-only V1."),
        ProviderActionTemplate(
            actionKey: "dropbox_sign_private_agreement", displayName: "Access private Dropbox Sign agreement data", summary: "Access participant identity, messages, URLs, metadata, form responses, documents, files or authentication data.", kind: .admin, riskLevel: .destructive,
            adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["private_agreement"], payloadSchema: [:], resultSchema: [:], blockedReason: "Dropbox Sign people, content and private agreement surfaces are outside V1."),
        ProviderActionTemplate(
            actionKey: "dropbox_sign_broader_account", displayName: "Access broader Dropbox Sign account", summary: "Access teams, templates, API Apps, faxes, callbacks, account administration or quotas.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["broader_account"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broader Dropbox Sign account and administration surfaces are outside V1."),
        ProviderActionTemplate(
            actionKey: "dropbox_sign_raw_query", displayName: "Run raw Dropbox Sign query", summary: "Supply arbitrary account, search, page, path or provider parameters.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["raw_query"], payloadSchema: [:], resultSchema: [:], blockedReason: "Arbitrary Dropbox Sign search, traversal and query injection are blocked."),
        ProviderActionTemplate(
            actionKey: "dropbox_sign_bulk_export", displayName: "Download or export Dropbox Sign data", summary: "Download files, paginate, synchronize, crawl or broadly export account data.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["bulk_export"], payloadSchema: [:], resultSchema: [:], blockedReason: "Dropbox Sign downloads, export and automatic pagination are blocked.")
    ]

    private static let pandaDocTemplates:[ProviderActionTemplate]=[
        ProviderActionTemplate(
            actionKey: "pandadoc_document_list_recent", displayName: "List recent PandaDoc Documents", summary: "Read at most 25 Documents created in the fixed previous fourteen days.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ["read"], capabilityKeys: ["document_list_recent"], payloadSchema: [:], resultSchema: ["documents": .string("bounded PandaDoc Document summaries")]),
        ProviderActionTemplate(
            actionKey: "pandadoc_document_status_get", displayName: "Get PandaDoc Document status", summary: "Read one exact lightweight privacy-redacted Document status.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: ["read"],
            capabilityKeys: ["document_status_get"], payloadSchema: ["documentId": .string("exact safe PandaDoc Document ID")], resultSchema: ["document": .string("PandaDoc Document status summary")]),
        ProviderActionTemplate(
            actionKey: "pandadoc_document_folder_list", displayName: "List PandaDoc Document Folders", summary: "Read at most 25 root Document Folder summaries.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: ["read"],
            capabilityKeys: ["document_folder_list"], payloadSchema: [:], resultSchema: ["folders": .string("bounded PandaDoc Folder summaries")]),
        ProviderActionTemplate(
            actionKey: "pandadoc_mutation", displayName: "Mutate PandaDoc Documents", summary: "Create, edit, send, share, complete, void, delete or otherwise mutate documents.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["mutation"], payloadSchema: [:], resultSchema: [:], blockedReason: "All PandaDoc writes are outside read-only V1."),
        ProviderActionTemplate(
            actionKey: "pandadoc_private_document", displayName: "Access private PandaDoc data", summary: "Access people, fields, tokens, pricing, payments, content, files, metadata, approval or details.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["private_document"], payloadSchema: [:], resultSchema: [:], blockedReason: "Private PandaDoc document surfaces are outside V1."),
        ProviderActionTemplate(
            actionKey: "pandadoc_broader_account", displayName: "Access broader PandaDoc account", summary: "Access templates, forms, members, workspaces, contacts, webhooks or administration.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["broader_account"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broader PandaDoc account surfaces are outside V1."),
        ProviderActionTemplate(
            actionKey: "pandadoc_raw_query", displayName: "Run raw PandaDoc query", summary: "Supply arbitrary filters, dates, pages, paths or provider parameters.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["raw_query"], payloadSchema: [:], resultSchema: [:], blockedReason: "Arbitrary PandaDoc query injection is blocked."),
        ProviderActionTemplate(
            actionKey: "pandadoc_bulk_export", displayName: "Download or export PandaDoc data", summary: "Download, paginate, crawl, synchronize or broadly export data.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["bulk_export"], payloadSchema: [:], resultSchema: [:], blockedReason: "PandaDoc downloads, export and automatic pagination are blocked."),
    ]

    private static let clickUpTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "clickup_workspace_list", displayName: "List ClickUp Workspaces", summary: "List bounded Workspaces selected during ClickUp authorization.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ["authorized_workspaces", "task_read"], capabilityKeys: ["workspace_list"], payloadSchema: ["maxResults": .string("optional integer 1-25")], resultSchema: ["workspaces": .string("array with id, name, color, and member count")]),
        ProviderActionTemplate(
            actionKey: "clickup_workspace_task_search", displayName: "Search ClickUp Workspace tasks", summary: "Search bounded tasks in one authorized Workspace.", kind: .search, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ["authorized_workspaces", "task_read"], capabilityKeys: ["workspace_task_search"], payloadSchema: ["workspaceId": .string("ClickUp Workspace id"), "query": .string("optional search text"), "maxResults": .string("optional integer 1-50")],
            resultSchema: ["tasks": .string("provider-correct useful task summaries")]),
        ProviderActionTemplate(
            actionKey: "clickup_list_tasks", displayName: "List ClickUp List tasks", summary: "Read bounded tasks in one ClickUp List.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: ["authorized_workspaces", "task_read"],
            capabilityKeys: ["list_tasks"], payloadSchema: ["listId": .string("ClickUp List id"), "maxResults": .string("optional integer 1-50")], resultSchema: ["tasks": .string("tasks with status, priority, assignees, dates, hierarchy, and URL")]),
        ProviderActionTemplate(
            actionKey: "clickup_task_get", displayName: "Get ClickUp task", summary: "Read one ClickUp task with bounded useful context.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: ["authorized_workspaces", "task_read"],
            capabilityKeys: ["task_get"], payloadSchema: ["taskId": .string("ClickUp task id"), "maxDescriptionChars": .string("optional integer 1-4000")], resultSchema: ["task": .string("provider-correct ClickUp task")]),
        ProviderActionTemplate(
            actionKey: "clickup_task_prepare", displayName: "Prepare ClickUp task change", summary: "Prepare task creation, update, or comment locally without provider mutation.", kind: .draft, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: [],
            capabilityKeys: ["task_draft", "payload_hash"],
            payloadSchema: [
                "operation": .string("create, update, or comment"), "listId": .string("optional List id"), "taskId": .string("optional task id"), "name": .string("optional task name"), "description": .string("optional description"), "status": .string("optional status"),
                "priority": .string("optional priority"), "assigneeIds": .string("optional user id array"), "dueDate": .string("optional Unix milliseconds"), "startDate": .string("optional Unix milliseconds"), "comment": .string("optional comment"),
            ], resultSchema: ["draftPreview": .string("normalized payload, hash, providerMutation=false")]),
        ProviderActionTemplate(
            actionKey: "clickup_task_create", displayName: "Create ClickUp task", summary: "Create an exact reviewed task in a ClickUp List.", kind: .write, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: ["authorized_workspaces", "task_write"],
            capabilityKeys: ["task_create"],
            payloadSchema: [
                "listId": .string("ClickUp List id"), "name": .string("task name"), "description": .string("optional description"), "assigneeIds": .string("optional user id array"), "priority": .string("optional priority"), "dueDate": .string("optional Unix milliseconds"),
                "approvalPayloadHash": .string("optional exact payload hash"),
            ], resultSchema: ["id": .string("string"), "name": .string("string"), "url": .string("string"), "payloadHash": .string("string"), "auditId": .string("string")]),
        ProviderActionTemplate(
            actionKey: "clickup_task_update", displayName: "Update ClickUp task", summary: "Update exact reviewed fields on one ClickUp task.", kind: .write, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: ["authorized_workspaces", "task_write"],
            capabilityKeys: ["task_update"],
            payloadSchema: [
                "taskId": .string("ClickUp task id"), "name": .string("optional task name"), "description": .string("optional description"), "status": .string("optional status"), "priority": .string("optional priority"), "assigneeIds": .string("optional user id array"),
                "dueDate": .string("optional Unix milliseconds"), "startDate": .string("optional Unix milliseconds"), "approvalPayloadHash": .string("optional exact payload hash"),
            ], resultSchema: ["id": .string("string"), "name": .string("string"), "url": .string("string"), "payloadHash": .string("string"), "auditId": .string("string")]),
        ProviderActionTemplate(
            actionKey: "clickup_task_comment_create", displayName: "Comment on ClickUp task", summary: "Add an exact reviewed comment to one ClickUp task.", kind: .message, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ["authorized_workspaces", "task_write"], capabilityKeys: ["task_comment"], payloadSchema: ["taskId": .string("ClickUp task id"), "comment": .string("comment text"), "approvalPayloadHash": .string("optional exact payload hash")],
            resultSchema: ["commentId": .string("string"), "payloadHash": .string("string"), "auditId": .string("string")]),
        ProviderActionTemplate(
            actionKey: "clickup_task_delete", displayName: "Delete ClickUp task", summary: "Delete a ClickUp task.", kind: .delete, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["task_delete"],
            payloadSchema: ["taskId": .string("string")], resultSchema: [:], blockedReason: "ClickUp task deletion is blocked in V1."),
        ProviderActionTemplate(
            actionKey: "clickup_structure_admin", displayName: "Administer ClickUp structure", summary: "Create, change, or delete Workspaces, Spaces, Folders, or Lists or administer users and permissions.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported,
            defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["workspace_admin", "structure_admin"], payloadSchema: ["operation": .string("string")], resultSchema: [:], blockedReason: "ClickUp structure, membership, permission, and administration changes are blocked in V1."),
        ProviderActionTemplate(
            actionKey: "clickup_advanced_task_mutate", displayName: "Mutate ClickUp advanced task state", summary: "Change custom fields, dependencies, links, time tracking, or bulk task state.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["custom_field_write", "dependency_write", "bulk_task_write"], payloadSchema: ["operation": .string("string")], resultSchema: [:], blockedReason: "Advanced and bulk ClickUp task mutation is outside V1."),
        ProviderActionTemplate(
            actionKey: "clickup_webhook_mutate", displayName: "Mutate ClickUp webhooks", summary: "Create or delete persistent ClickUp webhooks.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["webhook_write"],
            payloadSchema: ["operation": .string("string")], resultSchema: [:], blockedReason: "ClickUp webhook mutation is blocked in V1."),
        ProviderActionTemplate(
            actionKey: "clickup_broad_export", displayName: "Broad ClickUp export", summary: "Crawl, synchronize, or broadly export Workspace content or attachments.", kind: .read, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["broad_export"], payloadSchema: ["scope": .string("string")], resultSchema: [:], blockedReason: "Broad ClickUp export and crawling are blocked by V1 privacy and context limits."),
        ProviderActionTemplate(
            actionKey: "clickup_raw_api_call", displayName: "Raw ClickUp provider call", summary: "Expose raw ClickUp REST or MCP methods.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["raw_api", "raw_mcp"],
            payloadSchema: ["method": .string("string"), "path": .string("string")], resultSchema: [:], blockedReason: "Raw ClickUp API and MCP access is blocked; agents receive only Relay wrappers.")
    ]

    private static let typeformTemplates:[ProviderActionTemplate]=[
        ProviderActionTemplate(
            actionKey: "typeform_form_list_recent", displayName: "List recently updated Typeform Forms", summary: "Read the first 25 Forms in the selected workspace ordered by last update.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ["accounts:read", "workspaces:read", "forms:read", "responses:read", "offline"], capabilityKeys: ["form_list_recent"], payloadSchema: [:], resultSchema: ["forms": .string("bounded Typeform Form summaries")]),
        ProviderActionTemplate(
            actionKey: "typeform_form_get", displayName: "Get Typeform Form summary", summary: "Read one exact privacy-redacted Form summary.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ["accounts:read", "workspaces:read", "forms:read", "responses:read", "offline"], capabilityKeys: ["form_get"], payloadSchema: ["formId": .string("exact safe Typeform Form ID")], resultSchema: ["form": .string("redacted Typeform Form summary")]),
        ProviderActionTemplate(
            actionKey: "typeform_response_list_recent", displayName: "List recent Typeform response lifecycle", summary: "Read at most 25 completed response lifecycle summaries from the fixed previous fourteen days.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI,
            defaultPermission: .approvalRequired, requiredScopes: ["accounts:read", "workspaces:read", "forms:read", "responses:read", "offline"], capabilityKeys: ["response_list_recent"], payloadSchema: ["formId": .string("exact safe Typeform Form ID")],
            resultSchema: ["responses": .string("identity-free response lifecycle summaries")]),
        ProviderActionTemplate(
            actionKey: "typeform_mutation", displayName: "Mutate Typeform data", summary: "Create, update, move, publish, delete or otherwise mutate Typeform data.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["mutation"], payloadSchema: [:], resultSchema: [:], blockedReason: "All Typeform writes are outside V1."),
        ProviderActionTemplate(
            actionKey: "typeform_private_response", displayName: "Access private Typeform response data", summary: "Access questions, answers, respondent identity, hidden/calculated values, metadata, files or payments.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported,
            defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["private_response"], payloadSchema: [:], resultSchema: [:], blockedReason: "Respondent content and private Form data are outside V1."),
        ProviderActionTemplate(
            actionKey: "typeform_broader_account", displayName: "Access broader Typeform account", summary: "Access members, themes, images, webhooks or account administration.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["broader_account"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broader Typeform account surfaces are outside V1."),
        ProviderActionTemplate(
            actionKey: "typeform_raw_query", displayName: "Run raw Typeform query", summary: "Supply arbitrary searches, dates, fields, workspaces, origins, pages or paths.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["raw_query"], payloadSchema: [:], resultSchema: [:], blockedReason: "Arbitrary Typeform query injection is blocked."),
        ProviderActionTemplate(
            actionKey: "typeform_bulk_export", displayName: "Export Typeform data", summary: "Download, paginate, crawl, synchronize or broadly export responses.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["bulk_export"], payloadSchema: [:], resultSchema: [:], blockedReason: "Typeform downloads, export and automatic pagination are blocked."),
    ]

    private static let sendFoxTemplates:[ProviderActionTemplate]=[
        ProviderActionTemplate(
            actionKey: "sendfox_account_get", displayName: "Get SendFox account summary", summary: "Read exact account ID, contact count, contact limit, and creation date without name or email.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: [], capabilityKeys: ["account_get"], payloadSchema: [:], resultSchema: ["account": .string("redacted exact SendFox account summary")]),
        ProviderActionTemplate(
            actionKey: "sendfox_list_list", displayName: "List SendFox contact lists", summary: "Read at most 25 first-page contact-list aggregate summaries.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: [],
            capabilityKeys: ["list_list"], payloadSchema: [:], resultSchema: ["lists": .string("bounded SendFox list aggregates")]),
        ProviderActionTemplate(
            actionKey: "sendfox_campaign_list", displayName: "List SendFox Campaign lifecycle", summary: "Read at most 25 first-page content-free Campaign lifecycle summaries.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: [],
            capabilityKeys: ["campaign_list"], payloadSchema: [:], resultSchema: ["campaigns": .string("content-free SendFox Campaign lifecycle")]),
        ProviderActionTemplate(
            actionKey: "sendfox_contact_private", displayName: "Access SendFox contacts", summary: "Access contacts, emails, names, IP addresses, custom fields, subscription state, or person-level activity.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported,
            defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["contact_private"], payloadSchema: [:], resultSchema: [:], blockedReason: "Contact identity and private marketing data are outside V1."),
        ProviderActionTemplate(
            actionKey: "sendfox_campaign_content", displayName: "Access SendFox Campaign content", summary: "Access title, subject, preview, HTML, sender, recipient, or engagement data.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["campaign_content"], payloadSchema: [:], resultSchema: [:], blockedReason: "Campaign content, identity, and engagement are outside V1."),
        ProviderActionTemplate(
            actionKey: "sendfox_marketing_mutation", displayName: "Mutate SendFox marketing data", summary: "Create, update, send, schedule, unsubscribe, import, or delete SendFox resources.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["mutation"], payloadSchema: [:], resultSchema: [:], blockedReason: "All SendFox writes and sends are outside V1."),
        ProviderActionTemplate(
            actionKey: "sendfox_raw_query", displayName: "Run raw SendFox query", summary: "Supply arbitrary fields, filters, paths, pages, or API methods.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["raw_query"], payloadSchema: [:], resultSchema: [:], blockedReason: "Arbitrary SendFox query injection is blocked."),
        ProviderActionTemplate(
            actionKey: "sendfox_bulk_export", displayName: "Export SendFox data", summary: "Paginate, crawl, synchronize, batch import, or broadly export provider data.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["bulk_export"], payloadSchema: [:], resultSchema: [:], blockedReason: "SendFox exports, batch operations, and automatic pagination are blocked."),
    ]

    private static let beehiivTemplates:[ProviderActionTemplate]=[
        ProviderActionTemplate(
            actionKey: "beehiiv_account_get", displayName: "Get beehiiv OAuth account summary", summary: "Read exact organization ID and token lifetime without user or application identity.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ["identify:read", "publications:read", "posts:read"], capabilityKeys: ["account_get"], payloadSchema: [:], resultSchema: ["account": .string("redacted exact beehiiv organization summary")]),
        ProviderActionTemplate(
            actionKey: "beehiiv_publication_list", displayName: "List beehiiv publication lifecycle", summary: "Read at most 25 first-page content-free publication lifecycle summaries.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ["identify:read", "publications:read", "posts:read"], capabilityKeys: ["publication_list"], payloadSchema: [:], resultSchema: ["publications": .string("bounded redacted publication lifecycle")]),
        ProviderActionTemplate(
            actionKey: "beehiiv_post_list", displayName: "List beehiiv post lifecycle", summary: "Read at most 25 first-page content-free post lifecycle summaries for one exact publication.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ["identify:read", "publications:read", "posts:read"], capabilityKeys: ["post_list"], payloadSchema: ["publicationId": .string("exact pub_ identifier")], resultSchema: ["posts": .string("bounded redacted post lifecycle")]),
        ProviderActionTemplate(
            actionKey: "beehiiv_subscriber_private", displayName: "Access beehiiv subscribers", summary: "Access subscriber identity, email, custom fields, tags, tiers, referrals, or person-level activity.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported,
            defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["subscriber_private"], payloadSchema: [:], resultSchema: [:], blockedReason: "Subscriber identity and private audience data are outside V1."),
        ProviderActionTemplate(
            actionKey: "beehiiv_publication_content", displayName: "Access beehiiv publication content", summary: "Access names, organizations, titles, subjects, previews, authors, URLs, HTML, premium content, or engagement.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported,
            defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["publication_content"], payloadSchema: [:], resultSchema: [:], blockedReason: "Newsletter content, identity, URLs, and engagement are outside V1."),
        ProviderActionTemplate(
            actionKey: "beehiiv_newsletter_mutation", displayName: "Mutate beehiiv newsletters", summary: "Create, update, send, schedule, subscribe, tag, import, or delete beehiiv resources.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["mutation"], payloadSchema: [:], resultSchema: [:], blockedReason: "All beehiiv writes and sends are outside V1."),
        ProviderActionTemplate(
            actionKey: "beehiiv_raw_query", displayName: "Run raw beehiiv query", summary: "Supply arbitrary fields, filters, expansions, paths, pages, or methods.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["raw_query"], payloadSchema: [:], resultSchema: [:], blockedReason: "Arbitrary beehiiv query injection is blocked."),
        ProviderActionTemplate(
            actionKey: "beehiiv_bulk_export", displayName: "Export beehiiv data", summary: "Paginate, crawl, synchronize, or broadly export provider data.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["bulk_export"], payloadSchema: [:], resultSchema: [:], blockedReason: "beehiiv exports and automatic pagination are blocked."),
    ]

    private static let surveyMonkeyTemplates:[ProviderActionTemplate]=[
        ProviderActionTemplate(
            actionKey: "surveymonkey_survey_list_recent", displayName: "List recently modified SurveyMonkey Surveys", summary: "Read page 1 of 25 metadata-only Surveys sorted by modification time.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ["users_read", "surveys_read", "responses_read"], capabilityKeys: ["survey_list_recent"], payloadSchema: [:], resultSchema: ["surveys": .string("bounded Survey metadata")]),
        ProviderActionTemplate(
            actionKey: "surveymonkey_response_list", displayName: "List SurveyMonkey response references", summary: "Read page 1 of 25 response IDs for one exact Survey.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ["users_read", "surveys_read", "responses_read"], capabilityKeys: ["response_list"], payloadSchema: ["surveyId": .string("positive decimal Survey ID")], resultSchema: ["responses": .string("bounded response references")]),
        ProviderActionTemplate(
            actionKey: "surveymonkey_response_get", displayName: "Get SurveyMonkey response metadata", summary: "Read one exact response metadata resource without answer details.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ["users_read", "surveys_read", "responses_read"], capabilityKeys: ["response_get"], payloadSchema: ["surveyId": .string("positive decimal Survey ID"), "responseId": .string("positive decimal Response ID")], resultSchema: ["response": .string("redacted response metadata")]
        ),
        ProviderActionTemplate(
            actionKey: "surveymonkey_mutation", displayName: "Mutate SurveyMonkey data", summary: "Create, edit, send, collect or delete SurveyMonkey resources.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["mutation"], payloadSchema: [:], resultSchema: [:], blockedReason: "All SurveyMonkey writes are outside V1."),
        ProviderActionTemplate(
            actionKey: "surveymonkey_private_response", displayName: "Access SurveyMonkey response content", summary: "Access answers, questions, identity, contacts, IP, variables, collectors or detailed responses.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported,
            defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["private_response"], payloadSchema: [:], resultSchema: [:], blockedReason: "Response content and identity are outside V1."),
        ProviderActionTemplate(
            actionKey: "surveymonkey_broader_account", displayName: "Access broader SurveyMonkey account", summary: "Access contacts, teams, workgroups, collectors, webhooks, libraries or administration.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["broader_account"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broader SurveyMonkey account surfaces are outside V1."),
        ProviderActionTemplate(
            actionKey: "surveymonkey_raw_query", displayName: "Run raw SurveyMonkey query", summary: "Supply arbitrary filters, includes, pages, origins or paths.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["raw_query"], payloadSchema: [:], resultSchema: [:], blockedReason: "Arbitrary SurveyMonkey query injection is blocked."),
        ProviderActionTemplate(
            actionKey: "surveymonkey_bulk_export", displayName: "Export SurveyMonkey responses", summary: "Use bulk/details, paginate, analyze, crawl or export response data.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["bulk_export"], payloadSchema: [:], resultSchema: [:], blockedReason: "SurveyMonkey details, bulk export and automatic pagination are blocked."),
    ]
    private static let filloutTemplates:[ProviderActionTemplate]=[
        ProviderActionTemplate(
            actionKey: "fillout_form_list", displayName: "List Fillout Forms", summary: "Read at most 25 token-visible Form ID/name summaries.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: [], capabilityKeys: ["form_list"],
            payloadSchema: [:], resultSchema: ["forms": .string("bounded Form summaries")]),
        ProviderActionTemplate(
            actionKey: "fillout_form_get_metadata_summary", displayName: "Get Fillout Form metadata summary", summary: "Read one exact Form ID/name and structural category counts.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: [],
            capabilityKeys: ["form_metadata"], payloadSchema: ["formId": .string("bounded URL-safe Form ID")], resultSchema: ["form": .string("redacted Form metadata count summary")]),
        ProviderActionTemplate(
            actionKey: "fillout_submission_list_recent", displayName: "List recent Fillout Submission metadata", summary: "Read offset 0 of at most 25 finished Submission lifecycle summaries, newest first.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI,
            defaultPermission: .approvalRequired, requiredScopes: [], capabilityKeys: ["submission_list"], payloadSchema: ["formId": .string("bounded URL-safe Form ID")], resultSchema: ["submissions": .string("content-free Submission lifecycle summaries")]),
        ProviderActionTemplate(
            actionKey: "fillout_submission_content", displayName: "Access Fillout Submission content", summary: "Read questions, answers, respondent identity, scheduling, payment, login, files, edit links or previews.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported,
            defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["submission_content"], payloadSchema: [:], resultSchema: [:], blockedReason: "Submission content and identity are outside V1."),
        ProviderActionTemplate(
            actionKey: "fillout_submission_mutation", displayName: "Mutate Fillout Submissions", summary: "Create, import or delete Submissions.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["submission_mutation"], payloadSchema: [:], resultSchema: [:], blockedReason: "All Submission writes are outside V1."),
        ProviderActionTemplate(
            actionKey: "fillout_webhook_mutation", displayName: "Mutate Fillout webhooks", summary: "Create or remove webhook subscriptions.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["webhook_mutation"],
            payloadSchema: [:], resultSchema: [:], blockedReason: "Webhook administration is outside V1."),
        ProviderActionTemplate(
            actionKey: "fillout_raw_query", displayName: "Run raw Fillout query", summary: "Supply arbitrary filters, dates, status, pages, searches, origins or paths.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["raw_query"], payloadSchema: [:], resultSchema: [:], blockedReason: "Arbitrary Fillout query injection is blocked."),
        ProviderActionTemplate(
            actionKey: "fillout_bulk_export", displayName: "Export Fillout data", summary: "Paginate, crawl, use Zite/database APIs or export private data.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["bulk_export"], payloadSchema: [:], resultSchema: [:], blockedReason: "Automatic pagination, database access and export are blocked."),
    ]
    private static let mailchimpTemplates:[ProviderActionTemplate]=[
        ProviderActionTemplate(
            actionKey: "mailchimp_account_get", displayName: "Get Mailchimp account summary", summary: "Read exact account ID/name, authorizing role and member-since date.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: [],
            capabilityKeys: ["account_get"], payloadSchema: [:], resultSchema: ["account": .string("redacted exact Account summary")]),
        ProviderActionTemplate(
            actionKey: "mailchimp_audience_list", displayName: "List Mailchimp Audiences", summary: "Read offset 0 of at most 25 Audience aggregate summaries.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: [],
            capabilityKeys: ["audience_list"], payloadSchema: [:], resultSchema: ["audiences": .string("bounded aggregate Audience summaries")]),
        ProviderActionTemplate(
            actionKey: "mailchimp_campaign_list_recent_sent", displayName: "List recent sent Mailchimp Campaigns", summary: "Read offset 0 of at most 25 sent Campaign lifecycle summaries, newest first.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: [], capabilityKeys: ["campaign_list"], payloadSchema: [:], resultSchema: ["campaigns": .string("content-free Campaign lifecycle summaries")]),
        ProviderActionTemplate(
            actionKey: "mailchimp_contact_private", displayName: "Access Mailchimp contacts", summary: "Access members, subscriber hashes, emails, addresses, merge/GDPR/tags/segments/activity.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["contact_private"], payloadSchema: [:], resultSchema: [:], blockedReason: "Contact identity and private marketing data are outside V1."),
        ProviderActionTemplate(
            actionKey: "mailchimp_campaign_content", displayName: "Access Mailchimp Campaign content", summary: "Access subjects, content, recipients, reports, clicks or links.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["campaign_content"], payloadSchema: [:], resultSchema: [:], blockedReason: "Campaign content and recipient behavior are outside V1."),
        ProviderActionTemplate(
            actionKey: "mailchimp_marketing_mutation", displayName: "Mutate Mailchimp marketing data", summary: "Create, update, send or delete marketing resources.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["mutation"], payloadSchema: [:], resultSchema: [:], blockedReason: "All Mailchimp writes and sends are outside V1."),
        ProviderActionTemplate(
            actionKey: "mailchimp_raw_query", displayName: "Run raw Mailchimp query", summary: "Supply arbitrary fields, filters, data centers, offsets or paths.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["raw_query"], payloadSchema: [:], resultSchema: [:], blockedReason: "Arbitrary Mailchimp query injection is blocked."),
        ProviderActionTemplate(
            actionKey: "mailchimp_bulk_export", displayName: "Export Mailchimp data", summary: "Use batches, exports, webhooks, pagination or broad data extraction.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["bulk_export"], payloadSchema: [:], resultSchema: [:], blockedReason: "Batches, exports, webhooks and automatic pagination are blocked."),
    ]
    private static let klaviyoTemplates:[ProviderActionTemplate]=[
        ProviderActionTemplate(
            actionKey: "klaviyo_account_get", displayName: "Get Klaviyo Account summary", summary: "Read exact Account ID/name/timezone/currency.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ["accounts:read", "lists:read", "campaigns:read"], capabilityKeys: ["account_get"], payloadSchema: [:], resultSchema: ["account": .string("redacted Account summary")]),
        ProviderActionTemplate(
            actionKey: "klaviyo_list_list_recent", displayName: "List recently updated Klaviyo Lists", summary: "Read first page of 10 sparse List lifecycle summaries.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ["accounts:read", "lists:read", "campaigns:read"], capabilityKeys: ["list_list"], payloadSchema: [:], resultSchema: ["lists": .string("bounded List lifecycle summaries")]),
        ProviderActionTemplate(
            actionKey: "klaviyo_campaign_list_recent_email", displayName: "List recent Klaviyo email Campaigns", summary: "Read first page of 25 sparse email Campaign lifecycle summaries.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ["accounts:read", "lists:read", "campaigns:read"], capabilityKeys: ["campaign_list"], payloadSchema: [:], resultSchema: ["campaigns": .string("content-free Campaign lifecycle summaries")]),
        ProviderActionTemplate(
            actionKey: "klaviyo_profile_private", displayName: "Access Klaviyo Profiles", summary: "Access contact identity, consent, profiles, events or metrics.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["profile_private"], payloadSchema: [:], resultSchema: [:], blockedReason: "Profiles, identity and behavioral data are outside V1."),
        ProviderActionTemplate(
            actionKey: "klaviyo_campaign_content", displayName: "Access Klaviyo Campaign content", summary: "Access campaign names, messages, content, audiences, recipients or reports.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["campaign_content"], payloadSchema: [:], resultSchema: [:], blockedReason: "Campaign content and audience data are outside V1."),
        ProviderActionTemplate(
            actionKey: "klaviyo_marketing_mutation", displayName: "Mutate Klaviyo marketing data", summary: "Create, update, ingest, send or delete resources.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["mutation"], payloadSchema: [:], resultSchema: [:], blockedReason: "All Klaviyo writes, sends and ingestion are outside V1."),
        ProviderActionTemplate(
            actionKey: "klaviyo_raw_query", displayName: "Run raw Klaviyo query", summary: "Supply arbitrary filters, includes, additional fields, revisions or cursors.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["raw_query"], payloadSchema: [:], resultSchema: [:], blockedReason: "Arbitrary Klaviyo query injection is blocked."),
        ProviderActionTemplate(
            actionKey: "klaviyo_bulk_export", displayName: "Export Klaviyo data", summary: "Paginate, crawl or broadly export Klaviyo data.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["bulk_export"],
            payloadSchema: [:], resultSchema: [:], blockedReason: "Automatic pagination and export are blocked."),
    ]

    private static let convertKitTemplates:[ProviderActionTemplate]=[
        ProviderActionTemplate(
            actionKey: "convertkit_account_get", displayName: "Get Kit Account metadata", summary: "Read Account ID/name/plan/created/timezone without emails.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: ["public"],
            capabilityKeys: ["account_get"], payloadSchema: [:], resultSchema: ["account": .string("email-free Account metadata")]),
        ProviderActionTemplate(
            actionKey: "convertkit_form_list_active", displayName: "List active Kit Forms", summary: "Read first page of 20 active Form lifecycle summaries without embed URLs.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: ["public"],
            capabilityKeys: ["form_list"], payloadSchema: [:], resultSchema: ["forms": .string("bounded Form summaries")]),
        ProviderActionTemplate(
            actionKey: "convertkit_broadcast_list_recent", displayName: "List Kit Broadcast lifecycle metadata", summary: "Read first page of 20 Broadcast lifecycle summaries without content or audiences.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ["public"], capabilityKeys: ["broadcast_list"], payloadSchema: [:], resultSchema: ["broadcasts": .string("content-free Broadcast lifecycle summaries")]),
        ProviderActionTemplate(
            actionKey: "convertkit_subscriber_private", displayName: "Access Kit subscribers", summary: "Access subscriber identity, fields, tags, segments or Form membership.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["subscriber_private"], payloadSchema: [:], resultSchema: [:], blockedReason: "Subscriber identity is outside V1."),
        ProviderActionTemplate(
            actionKey: "convertkit_broadcast_content", displayName: "Access Kit Broadcast content", summary: "Access subjects, content, preview, audiences, templates, sender identity or stats.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["broadcast_content"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broadcast content and audience data are outside V1."),
        ProviderActionTemplate(
            actionKey: "convertkit_marketing_mutation", displayName: "Mutate Kit marketing data", summary: "Create, update, send, publish, subscribe or delete resources.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["mutation"], payloadSchema: [:], resultSchema: [:], blockedReason: "All Kit writes and sends are outside V1."),
        ProviderActionTemplate(
            actionKey: "convertkit_raw_query", displayName: "Run raw Kit query", summary: "Supply arbitrary filters, statuses, cursors or paths.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["raw_query"],
            payloadSchema: [:], resultSchema: [:], blockedReason: "Arbitrary Kit query injection is blocked."),
        ProviderActionTemplate(
            actionKey: "convertkit_bulk_export", displayName: "Export Kit data", summary: "Paginate, bulk process or broadly export Creator data.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["bulk_export"],
            payloadSchema: [:], resultSchema: [:], blockedReason: "Automatic pagination, bulk and export are blocked."),
    ]

    private static let campaignMonitorTemplates:[ProviderActionTemplate]=[
        ProviderActionTemplate(
            actionKey: "campaign_monitor_client_get", displayName: "Get selected Campaign Monitor Client", summary: "Read selected visible Client ID/name only.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: ["ViewReports"],
            capabilityKeys: ["client_get"], payloadSchema: [:], resultSchema: ["client": .string("selected Client ID/name")]),
        ProviderActionTemplate(
            actionKey: "campaign_monitor_campaign_list_recent_sent", displayName: "List recent sent Campaigns", summary: "Read page 1 of 20 sent Campaign IDs/dates, newest first.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ["ViewReports"], capabilityKeys: ["campaign_list"], payloadSchema: [:], resultSchema: ["campaigns": .string("content-free sent Campaign lifecycle summaries")]),
        ProviderActionTemplate(
            actionKey: "campaign_monitor_campaign_summary_get", displayName: "Get Campaign aggregate summary", summary: "Read aggregate delivery/open/click/bounce/unsubscribe/spam counts for one 32-hex Campaign ID.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI,
            defaultPermission: .approvalRequired, requiredScopes: ["ViewReports"], capabilityKeys: ["campaign_summary"], payloadSchema: ["campaignId": .string("32-hex Campaign ID from the bounded list")], resultSchema: ["summary": .string("aggregate report counts")]),
        ProviderActionTemplate(
            actionKey: "campaign_monitor_subscriber_private", displayName: "Access Campaign Monitor subscribers", summary: "Access subscriber identity, lists, segments or person-level reports.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["subscriber_private"], payloadSchema: [:], resultSchema: [:], blockedReason: "Subscriber identity and drilldowns are outside V1."),
        ProviderActionTemplate(
            actionKey: "campaign_monitor_campaign_content", displayName: "Access Campaign content", summary: "Access names, subjects, sender/reply identity, content, recipients, links, URLs or tags.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["campaign_content"], payloadSchema: [:], resultSchema: [:], blockedReason: "Campaign content and identity are outside V1."),
        ProviderActionTemplate(
            actionKey: "campaign_monitor_marketing_mutation", displayName: "Mutate Campaign Monitor", summary: "Create/import/update/send/administer marketing resources.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["mutation"], payloadSchema: [:], resultSchema: [:], blockedReason: "All writes, sends and imports are outside V1."),
        ProviderActionTemplate(
            actionKey: "campaign_monitor_raw_query", displayName: "Run raw Campaign Monitor query", summary: "Supply arbitrary Clients, dates, pages, filters or paths.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["raw_query"], payloadSchema: [:], resultSchema: [:], blockedReason: "Arbitrary query injection is blocked."),
        ProviderActionTemplate(
            actionKey: "campaign_monitor_bulk_export", displayName: "Export Campaign Monitor data", summary: "Paginate, crawl or broadly export provider data.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["bulk_export"], payloadSchema: [:], resultSchema: [:], blockedReason: "Automatic pagination and export are blocked."),
    ]

    private static let constantContactTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "constant_contact_account_get", displayName: "Get Constant Contact Account", summary: "Read the exact encoded Account ID and organization name only.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ["account_read"], capabilityKeys: ["account_get"], payloadSchema: [:], resultSchema: ["account": .string("exact encoded Account ID and organization name")]),
        ProviderActionTemplate(
            actionKey: "constant_contact_campaign_list_recent", displayName: "List recent Email Campaigns", summary: "Read the fixed first 25 Campaign lifecycle summaries without names or content.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ["campaign_data"], capabilityKeys: ["campaign_list"], payloadSchema: [:], resultSchema: ["campaigns": .string("content-free Email Campaign lifecycle summaries")]),
        ProviderActionTemplate(
            actionKey: "constant_contact_campaign_summary_list_recent", displayName: "List recent Campaign Summary Reports", summary: "Read the fixed first 25 aggregate Email Campaign performance summaries without contact drilldowns.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI,
            defaultPermission: .approvalRequired, requiredScopes: ["campaign_data"], capabilityKeys: ["campaign_summary_list"], payloadSchema: [:], resultSchema: ["summaries": .string("aggregate Email Campaign Summary Reports"), "aggregatePercents": .string("page-level aggregate percentages")]),
        ProviderActionTemplate(
            actionKey: "constant_contact_contact_private", displayName: "Access Constant Contact contacts", summary: "Access contacts, lists, segments or person-level tracking.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["contact_private"], payloadSchema: [:], resultSchema: [:], blockedReason: "Contact identity, contact_data scope and person-level drilldowns are outside V1."),
        ProviderActionTemplate(
            actionKey: "constant_contact_campaign_content", displayName: "Access Campaign content", summary: "Access names, subjects, content, activities, sender/recipient data or permalinks.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["campaign_content"], payloadSchema: [:], resultSchema: [:], blockedReason: "Campaign content and identity are outside V1."),
        ProviderActionTemplate(
            actionKey: "constant_contact_marketing_mutation", displayName: "Mutate Constant Contact", summary: "Create, update, send or administer provider resources.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["mutation"], payloadSchema: [:], resultSchema: [:], blockedReason: "All writes, sends and administration are outside V1."),
        ProviderActionTemplate(
            actionKey: "constant_contact_raw_query", displayName: "Run raw Constant Contact query", summary: "Supply arbitrary dates, cursors, pages, filters or paths.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["raw_query"], payloadSchema: [:], resultSchema: [:], blockedReason: "Arbitrary query injection is blocked."),
        ProviderActionTemplate(
            actionKey: "constant_contact_bulk_export", displayName: "Export Constant Contact data", summary: "Paginate, crawl or broadly export provider data.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["bulk_export"], payloadSchema: [:], resultSchema: [:], blockedReason: "Automatic pagination and export are blocked.")
    ]

    private static let substackTemplates:[ProviderActionTemplate]=[
        ProviderActionTemplate(
            actionKey: "substack_profile_search_linkedin", displayName: "Search public Substack creator profiles", summary: "Find at most ten public authenticity-thresholded creator profiles for one exact LinkedIn handle.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: [], capabilityKeys: ["public_creator_discovery"], payloadSchema: ["linkedinHandle": .string("exact LinkedIn handle")], resultSchema: ["results": .string("bounded public creator-profile summaries")]),
        ProviderActionTemplate(
            actionKey: "substack_publication_private", displayName: "Access private Substack publication data", summary: "Access private profiles, publication settings, drafts, or dashboards.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["publication_private"], payloadSchema: [:], resultSchema: [:], blockedReason: "Private Substack publication surfaces are not documented in the Developer API."),
        ProviderActionTemplate(
            actionKey: "substack_subscriber_private", displayName: "Access Substack subscribers", summary: "Access subscribers, emails, memberships, referrals, or person-level activity.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["subscriber_private"], payloadSchema: [:], resultSchema: [:], blockedReason: "Subscriber and membership data are outside the documented Developer API."),
        ProviderActionTemplate(
            actionKey: "substack_content_read", displayName: "Read Substack content", summary: "Read posts, Notes, Chat, podcasts, video, comments, or premium content.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["content_read"], payloadSchema: [:], resultSchema: [:], blockedReason: "Substack content access is outside the documented Developer API."),
        ProviderActionTemplate(
            actionKey: "substack_publisher_write", displayName: "Mutate Substack publishing", summary: "Publish, edit, send, subscribe, comment, message, charge, or delete Substack resources.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["publisher_write"], payloadSchema: [:], resultSchema: [:], blockedReason: "All Substack writes and publisher operations are unavailable."),
        ProviderActionTemplate(
            actionKey: "substack_scrape", displayName: "Scrape Substack", summary: "Use browser sessions, private APIs, RSS crawling, or page scraping.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["scrape"],
            payloadSchema: [:], resultSchema: [:], blockedReason: "Browser, private-API, RSS, and scraping fallbacks are prohibited."),
        ProviderActionTemplate(
            actionKey: "substack_raw_query", displayName: "Run raw Substack query", summary: "Supply arbitrary paths, methods, headers, queries, or pages.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["raw_query"], payloadSchema: [:], resultSchema: [:], blockedReason: "Raw and arbitrary Substack access is blocked.")
    ]
    private static let hootsuiteTemplates:[ProviderActionTemplate]=[
        ProviderActionTemplate(
            actionKey: "hootsuite_account_get", displayName: "Get Hootsuite member status", summary: "Read identity-redacted member lifecycle status.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: ["offline"],
            capabilityKeys: ["social_account_metadata_read"], payloadSchema: [:], resultSchema: ["account": .string("redacted member status")]),
        ProviderActionTemplate(
            actionKey: "hootsuite_social_profile_id_list", displayName: "List Hootsuite profile IDs", summary: "Read at most 25 accessible profile IDs.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: ["offline"],
            capabilityKeys: ["social_account_metadata_read"], payloadSchema: [:], resultSchema: ["profiles": .string("bounded profile IDs")]),
        ProviderActionTemplate(
            actionKey: "hootsuite_social_profile_get", displayName: "Get Hootsuite profile status", summary: "Read one exact profile status.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: ["offline"],
            capabilityKeys: ["social_account_metadata_read"], payloadSchema: ["socialProfileId": .string("positive decimal ID")], resultSchema: ["profile": .string("redacted profile status")]),
        ProviderActionTemplate(
            actionKey: "hootsuite_private_or_write", displayName: "Access broader Hootsuite", summary: "Access identity, content, publishing, administration, Inbox, SCIM, analytics, writes or raw APIs.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["blocked"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broader Hootsuite surfaces are outside V1."),
    ]
    private static let bufferTemplates:[ProviderActionTemplate]=[
        ProviderActionTemplate(
            actionKey: "buffer_account_get", displayName: "Get Buffer account status", summary: "Read identity-redacted account structure status.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: ["account:read", "offline_access"],
            capabilityKeys: ["social_structure_read"], payloadSchema: [:], resultSchema: ["account": .string("redacted account status")]),
        ProviderActionTemplate(
            actionKey: "buffer_organization_list", displayName: "List Buffer organizations", summary: "Read at most 25 organization IDs and channel counts.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ["account:read", "offline_access"], capabilityKeys: ["social_structure_read"], payloadSchema: [:], resultSchema: ["organizations": .string("bounded organization summaries")]),
        ProviderActionTemplate(
            actionKey: "buffer_channel_list", displayName: "List Buffer channels", summary: "Read at most 25 redacted channels for one exact organization.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ["account:read", "offline_access"], capabilityKeys: ["social_structure_read"], payloadSchema: ["organizationId": .string("exact Buffer organization ID")], resultSchema: ["channels": .string("bounded channel lifecycle summaries")]),
        ProviderActionTemplate(
            actionKey: "buffer_private_or_write", displayName: "Access broader Buffer", summary: "Access identity, post or idea content, analytics, publishing, administration, writes, arbitrary GraphQL or export.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported,
            defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["blocked"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broader Buffer surfaces are outside V1."),
    ]
    private static let sproutSocialTemplates:[ProviderActionTemplate]=[
        ProviderActionTemplate(
            actionKey: "sprout_social_customer_id_list", displayName: "List Sprout customer IDs", summary: "Read at most 25 accessible customer IDs without names.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: ["organization_id"],
            capabilityKeys: ["social_structure_read"], payloadSchema: [:], resultSchema: ["customerIds": .string("bounded customer IDs")]),
        ProviderActionTemplate(
            actionKey: "sprout_social_profile_structure_list", displayName: "List Sprout profile structure", summary: "Read at most 25 identity-redacted profiles for one exact customer.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ["organization_id"], capabilityKeys: ["social_structure_read"], payloadSchema: ["customerId": .string("positive decimal Sprout customer ID")], resultSchema: ["profiles": .string("bounded profile structure")]),
        ProviderActionTemplate(
            actionKey: "sprout_social_group_id_list", displayName: "List Sprout group IDs", summary: "Read at most 25 group IDs for one exact customer without names.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: ["organization_id"],
            capabilityKeys: ["social_structure_read"], payloadSchema: ["customerId": .string("positive decimal Sprout customer ID")], resultSchema: ["groupIds": .string("bounded group IDs")]),
        ProviderActionTemplate(
            actionKey: "sprout_social_private_or_write", displayName: "Access broader Sprout Social", summary: "Access identity, content, analytics, listening, cases, publishing, media, writes, arbitrary APIs or export.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported,
            defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["blocked"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broader Sprout Social surfaces are outside V1."),
    ]
    private static let laterTemplates:[ProviderActionTemplate]=[
        ProviderActionTemplate(
            actionKey: "later_instance_id_list", displayName: "List Later Influence instance IDs", summary: "Read at most 25 token-bound instance IDs without names.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: [],
            capabilityKeys: ["influence_analytics_read"], payloadSchema: [:], resultSchema: ["instanceIds": .string("bounded instance IDs")]),
        ProviderActionTemplate(
            actionKey: "later_instance_performance_get", displayName: "Get aggregate Later Influence performance", summary: "Read fixed aggregate metrics for an exact date window of at most 31 days.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: [], capabilityKeys: ["influence_analytics_read"], payloadSchema: ["startDate": .string("YYYY-MM-DD"), "endDate": .string("YYYY-MM-DD, at most 30 days after start")], resultSchema: ["metrics": .string("engagements, impressions, and reach")]),
        ProviderActionTemplate(
            actionKey: "later_campaign_performance_list", displayName: "List Later Influence campaign performance", summary: "Read at most 25 campaign IDs and fixed metrics for one exact instance and bounded date window.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI,
            defaultPermission: .approvalRequired, requiredScopes: [], capabilityKeys: ["influence_analytics_read"], payloadSchema: ["instanceId": .string("exact token-bound instance ID"), "startDate": .string("YYYY-MM-DD"), "endDate": .string("YYYY-MM-DD, at most 30 days after start")],
            resultSchema: ["campaigns": .string("bounded campaign IDs and fixed metrics")]),
        ProviderActionTemplate(
            actionKey: "later_private_or_write", displayName: "Access broader Later", summary: "Access identity, content, financial or conversion analytics, Later Social management, arbitrary APIs, pagination or export.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported,
            defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["blocked"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broader Later surfaces are outside V1."),
    ]
    private static let agorapulseTemplates:[ProviderActionTemplate]=[
        ProviderActionTemplate(
            actionKey: "agorapulse_profile_list", displayName: "List Agorapulse profiles", summary: "Read at most 25 identity-redacted profiles in the exact bound workspace.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: [],
            capabilityKeys: ["social_analytics_read"], payloadSchema: [:], resultSchema: ["profiles": .string("bounded identity-redacted profile references")]),
        ProviderActionTemplate(
            actionKey: "agorapulse_audience_report_get", displayName: "Read Agorapulse audience analytics", summary: "Read aggregate audience metrics for one exact profile and a window no longer than 31 days.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI,
            defaultPermission: .approvalRequired, requiredScopes: [], capabilityKeys: ["social_analytics_read"], payloadSchema: ["profileUid": .string("exact profile UID"), "since": .string("RFC3339 timestamp"), "until": .string("RFC3339 timestamp, at most 31 days after since")],
            resultSchema: ["metrics": .string("identity- and content-redacted aggregate metrics")]),
        ProviderActionTemplate(
            actionKey: "agorapulse_community_report_get", displayName: "Read Agorapulse community analytics", summary: "Read aggregate community-management metrics for one exact profile and a window no longer than 31 days.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI,
            defaultPermission: .approvalRequired, requiredScopes: [], capabilityKeys: ["social_analytics_read"], payloadSchema: ["profileUid": .string("exact profile UID"), "since": .string("RFC3339 timestamp"), "until": .string("RFC3339 timestamp, at most 31 days after since")],
            resultSchema: ["metrics": .string("identity- and content-redacted aggregate metrics")]),
        ProviderActionTemplate(
            actionKey: "agorapulse_content_report_get", displayName: "Read Agorapulse content analytics", summary: "Read content-performance metrics with identity and post content removed for one exact profile and a window no longer than 31 days.", kind: .read, riskLevel: .high,
            adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: [], capabilityKeys: ["social_analytics_read"],
            payloadSchema: ["profileUid": .string("exact profile UID"), "since": .string("RFC3339 timestamp"), "until": .string("RFC3339 timestamp, at most 31 days after since")], resultSchema: ["metrics": .string("identity- and content-redacted performance metrics")]),
        ProviderActionTemplate(
            actionKey: "agorapulse_private_or_write", displayName: "Access broader Agorapulse", summary: "Access identity, social content, listening, broader reports, publishing, inboxes, writes, raw APIs, pagination, bulk or export.", kind: .admin, riskLevel: .destructive,
            adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["blocked"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broader Agorapulse surfaces are outside V1."),
    ]
    private static let metricoolTemplates:[ProviderActionTemplate]=[
        ProviderActionTemplate(
            actionKey: "metricool_brand_list", displayName: "List Metricool brand references", summary: "Read at most 25 numeric brand IDs without names, URLs, owners, collaborators, social identity or content.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI,
            defaultPermission: .approvalRequired, requiredScopes: [], capabilityKeys: ["brand_structure_read"], payloadSchema: [:], resultSchema: ["brands": .string("bounded identity-redacted brand references")]),
        ProviderActionTemplate(
            actionKey: "metricool_connected_network_list", displayName: "List Metricool connected networks", summary: "Read at most 25 network types and connection booleans for the exact bound brand without profile identity or content.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI,
            defaultPermission: .approvalRequired, requiredScopes: [], capabilityKeys: ["brand_structure_read"], payloadSchema: [:], resultSchema: ["networks": .string("bounded identity-redacted network types")]),
        ProviderActionTemplate(
            actionKey: "metricool_private_or_write", displayName: "Access broader Metricool", summary: "Access identity, social content, analytics, ads, competitors, inbox, publishing, administration, writes, raw APIs, pagination, bulk or export.", kind: .admin, riskLevel: .destructive,
            adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["blocked"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broader Metricool surfaces are outside V1."),
    ]
    private static let publerTemplates:[ProviderActionTemplate]=[
        ProviderActionTemplate(
            actionKey: "publer_workspace_list", displayName: "List Publer workspace references", summary: "Read at most 25 workspace IDs without names, pictures, owners, members, plans or other identity.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ["workspaces"], capabilityKeys: ["workspace_account_structure_read"], payloadSchema: [:], resultSchema: ["workspaces": .string("bounded identity-redacted workspace references")]),
        ProviderActionTemplate(
            actionKey: "publer_account_structure_list", displayName: "List Publer account structure", summary: "Read at most 25 account IDs, providers and types for the exact bound workspace without social identity or content.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI,
            defaultPermission: .approvalRequired, requiredScopes: ["accounts"], capabilityKeys: ["workspace_account_structure_read"], payloadSchema: [:], resultSchema: ["accounts": .string("bounded identity-redacted account structure")]),
        ProviderActionTemplate(
            actionKey: "publer_private_or_write", displayName: "Access broader Publer", summary: "Access identity, members, plans, social content, posts, media, analytics, publishing, administration, writes, raw APIs, pagination, bulk or export.", kind: .admin, riskLevel: .destructive,
            adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["blocked"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broader Publer surfaces are outside V1."),
    ]
    private static let brandwatchTemplates:[ProviderActionTemplate]=[
        ProviderActionTemplate(
            actionKey: "brandwatch_project_reference_list", displayName: "List Brandwatch project references", summary: "Read at most 25 project IDs and time zones without project, client, company, user or billing identity.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI,
            defaultPermission: .approvalRequired, requiredScopes: ["read"], capabilityKeys: ["consumer_research_structure_read"], payloadSchema: [:], resultSchema: ["projects": .string("bounded identity-redacted project references")]),
        ProviderActionTemplate(
            actionKey: "brandwatch_query_structure_list", displayName: "List Brandwatch query structure", summary: "Read at most 25 query IDs and types for the exact bound project without names, expressions, authors, content or results.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI,
            defaultPermission: .approvalRequired, requiredScopes: ["read"], capabilityKeys: ["consumer_research_structure_read"], payloadSchema: [:], resultSchema: ["queries": .string("bounded identity- and content-redacted query structure")]),
        ProviderActionTemplate(
            actionKey: "brandwatch_private_or_write", displayName: "Access broader Brandwatch", summary: "Access identity, search expressions, mentions, authors, content, analytics, uploads, publishing, engagement, administration, writes, raw APIs, pagination, bulk or export.", kind: .admin,
            riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["blocked"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broader Brandwatch surfaces are outside V1."),
    ]
    private static let mentionTemplates:[ProviderActionTemplate]=[
        ProviderActionTemplate(
            actionKey: "mention_account_status_get", displayName: "Get Mention account status", summary: "Read the exact account ID, language and time zone without private identity.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: [],
            capabilityKeys: ["alert_structure_read"], payloadSchema: [:], resultSchema: ["accountId": .string("exact bound account"), "redactionStatus": .string("identity excluded")]),
        ProviderActionTemplate(
            actionKey: "mention_alert_structure_list", displayName: "List Mention alert structure", summary: "Read at most 25 alert IDs, query types and index versions without names, keywords, users, content or statistics.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI,
            defaultPermission: .approvalRequired, requiredScopes: [], capabilityKeys: ["alert_structure_read"], payloadSchema: [:], resultSchema: ["alerts": .string("bounded identity- and content-redacted alert structure")]),
        ProviderActionTemplate(
            actionKey: "mention_private_or_write", displayName: "Access broader Mention", summary: "Access identity, alert queries, Mention Content, authors, analytics, streams, publishing, administration, writes, raw APIs, pagination, bulk or export.", kind: .admin, riskLevel: .destructive,
            adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["blocked"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broader Mention surfaces are outside V1."),
    ]
    private static let meltwaterTemplates:[ProviderActionTemplate]=[
        ProviderActionTemplate(
            actionKey: "meltwater_api_usage_get", displayName: "Get Meltwater API usage", summary: "Read aggregate last-24-hours request count and units without token IDs or endpoint-level details.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: [], capabilityKeys: ["media_intelligence_structure_read"], payloadSchema: [:], resultSchema: ["count": .string("aggregate request count"), "redactionStatus": .string("token and endpoint details excluded")]),
        ProviderActionTemplate(
            actionKey: "meltwater_search_reference_list", displayName: "List Meltwater search references", summary: "Read at most 25 saved-search IDs and update timestamps without names, queries, content or analytics.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI,
            defaultPermission: .approvalRequired, requiredScopes: [], capabilityKeys: ["media_intelligence_structure_read"], payloadSchema: [:], resultSchema: ["searches": .string("bounded identity- and query-redacted search references")]),
        ProviderActionTemplate(
            actionKey: "meltwater_private_or_write", displayName: "Access broader Meltwater", summary: "Access identity, search configuration, content, authors, analytics, Mira, exports, streams, imports, administration, writes, raw APIs, pagination or bulk.", kind: .admin, riskLevel: .destructive,
            adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["blocked"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broader Meltwater surfaces are outside V1."),
    ]
    private static let sprinklrTemplates:[ProviderActionTemplate]=[
        ProviderActionTemplate(
            actionKey: "sprinklr_governance_status_get", displayName: "Get Sprinklr governance status", summary: "Verify exact environment/workspace authority and return only safe user type and binding booleans.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI,
            defaultPermission: .approvalRequired, requiredScopes: [], capabilityKeys: ["governance_status_read"], payloadSchema: [:],
            resultSchema: ["userType": .string("safe role type"), "primaryWorkspaceConfirmed": .string("boolean"), "customerBound": .string("boolean"), "redactionStatus": .string("identity and platform data excluded")]),
        ProviderActionTemplate(
            actionKey: "sprinklr_private_or_write", displayName: "Access broader Sprinklr", summary: "Access identity, governance detail, profiles, content, messages, cases, assets, listening, analytics, publishing, administration, writes, raw APIs, pagination, bulk or export.", kind: .admin,
            riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["blocked"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broader Sprinklr surfaces are outside V1."),
    ]
    private static let khorosTemplates:[ProviderActionTemplate]=[
        ProviderActionTemplate(
            actionKey: "khoros_marketing_company_authority_get", displayName: "Get Khoros Marketing company authority", summary: "Verify one exact company and return only its ID and safe environment without user or company identity.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI,
            defaultPermission: .approvalRequired, requiredScopes: [], capabilityKeys: ["marketing_company_authority_read"], payloadSchema: [:],
            resultSchema: ["companyId": .string("exact bound company"), "environment": .string("safe provider environment"), "redactionStatus": .string("user and company identity excluded")]),
        ProviderActionTemplate(
            actionKey: "khoros_private_or_write", displayName: "Access broader Khoros", summary: "Access identity, profiles, content, Care, Community, Flow, bots, analytics, publishing, administration, writes, raw APIs, pagination, bulk or export.", kind: .admin, riskLevel: .destructive,
            adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["blocked"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broader Khoros surfaces are outside V1."),
    ]
    private static let cleverTapTemplates:[ProviderActionTemplate]=[
        ProviderActionTemplate(
            actionKey: "clevertap_bound_user_profile_get", displayName: "Get bound CleverTap user profile", summary: "Read one exact connection-bound profile with custom values and device identifiers excluded.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI,
            defaultPermission: .approvalRequired, requiredScopes: [], capabilityKeys: ["bound_user_profile_read"], payloadSchema: [:],
            resultSchema: [
                "profileReference": .string("connection-bound identity"), "name": .string("bounded optional name"), "email": .string("bounded optional email"), "events": .string("at most 25 event summaries"), "platforms": .string("at most 10 platform names"),
                "customPropertyKeys": .string("at most 50 property keys"), "redactionStatus": .string("custom values and device identifiers excluded"),
            ]),
        ProviderActionTemplate(
            actionKey: "clevertap_private_or_write", displayName: "Access broader CleverTap", summary: "Access other profiles, exports, custom values, device identifiers, events, analytics, campaigns, writes, deletes, administration, raw APIs, pagination or bulk.", kind: .admin,
            riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["blocked"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broader CleverTap surfaces are outside V1."),
    ]
    private static let oneSignalTemplates:[ProviderActionTemplate]=[
        ProviderActionTemplate(
            actionKey: "onesignal_notification_delivery_summary_list", displayName: "List OneSignal notification delivery summaries", summary: "Read page 0 of at most 25 message lifecycle and aggregate delivery summaries without content, targeting or recipient data.", kind: .read, riskLevel: .high,
            adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: [], capabilityKeys: ["notification_delivery_summary_read"], payloadSchema: [:],
            resultSchema: ["appId": .string("exact bound UUID v4 app"), "totalCount": .string("aggregate provider count"), "notifications": .string("at most 25 redacted delivery summaries"), "redactionStatus": .string("content, targeting, recipient and outcome detail excluded")]),
        ProviderActionTemplate(
            actionKey: "onesignal_private_or_write", displayName: "Access broader OneSignal", summary: "Access message content, targeting, recipients, users, exports, sends, cancellation, writes, administration, raw APIs, pagination, SDKs or bulk.", kind: .admin, riskLevel: .destructive,
            adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["blocked"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broader OneSignal surfaces are outside V1."),
    ]
    private static let airshipTemplates:[ProviderActionTemplate]=[
        ProviderActionTemplate(
            actionKey: "airship_segment_reference_list", displayName: "List Airship segment references", summary: "Read page 1 of at most 25 segment UUID and lifecycle timestamp references without names, criteria or audience data.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI,
            defaultPermission: .approvalRequired, requiredScopes: [], capabilityKeys: ["segment_reference_read"], payloadSchema: [:],
            resultSchema: ["cloudSite": .string("na or eu"), "segments": .string("at most 25 redacted segment references"), "nextPageAvailable": .string("boolean without URL"), "redactionStatus": .string("names, criteria, audiences and pagination URLs excluded")]),
        ProviderActionTemplate(
            actionKey: "airship_private_or_write", displayName: "Access broader Airship", summary: "Access segment detail, audiences, channels, users, messages, analytics, sends, writes, administration, raw APIs, streams, pagination, SDKs or bulk.", kind: .admin, riskLevel: .destructive,
            adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["blocked"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broader Airship surfaces are outside V1."),
    ]
    private static let pushwooshTemplates:[ProviderActionTemplate]=[
        ProviderActionTemplate(
            actionKey: "pushwoosh_subscriber_status_summary_get", displayName: "Get Pushwoosh subscriber-status summary", summary: "Read at most 100 timestamp/platform enabled and disabled aggregates for the last 24 completed UTC hours.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI,
            defaultPermission: .approvalRequired, requiredScopes: [], capabilityKeys: ["subscriber_status_summary_read"], payloadSchema: [:],
            resultSchema: [
                "applicationCode": .string("exact bound 5-5 application code"), "intervalFrom": .string("fixed completed-hour UTC start"), "intervalTo": .string("fixed completed-hour UTC end"), "statistics": .string("at most 100 aggregate rows"),
                "redactionStatus": .string("identity, content and detailed analytics excluded"),
            ]),
        ProviderActionTemplate(
            actionKey: "pushwoosh_private_or_write", displayName: "Access broader Pushwoosh", summary: "Access users, devices, tags, events, content, targeting, detailed analytics, sends, writes, administration, raw APIs, pagination, SDKs or bulk.", kind: .admin, riskLevel: .destructive,
            adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["blocked"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broader Pushwoosh surfaces are outside V1."),
    ]
    private static let pusherBeamsTemplates:[ProviderActionTemplate]=[
        ProviderActionTemplate(
            actionKey: "pusher_beams_interest_notification_publish", displayName: "Publish Pusher Beams interest notification", summary: "Send one bounded title/body notification to the exact connection-bound anonymous Device Interest.", kind: .message, riskLevel: .high, adapterKind: .nativeAPI,
            defaultPermission: .approvalRequired, requiredScopes: [], capabilityKeys: ["interest_notification_publish"], payloadSchema: ["title": .string("required, 1-100 characters"), "body": .string("required, 1-1000 characters")],
            resultSchema: ["instanceId": .string("exact bound UUID v4 instance"), "interest": .string("exact bound anonymous Device Interest"), "publishId": .string("safe provider acknowledgement"), "providerAcknowledged": .string("boolean"), "automaticRetry": .string("always false")]),
        ProviderActionTemplate(
            actionKey: "pusher_beams_private_or_admin", displayName: "Access broader Pusher Beams", summary: "Access users, devices, tokens, arbitrary targets or payloads, deletion, configuration, administration, raw APIs, retries, SDKs or bulk.", kind: .admin, riskLevel: .destructive,
            adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["blocked"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broader Pusher Beams surfaces are outside V1."),
    ]
    private static let firebaseCloudMessagingTemplates:[ProviderActionTemplate]=[
        ProviderActionTemplate(
            actionKey: "firebase_cloud_messaging_topic_notification_publish", displayName: "Publish FCM topic notification", summary: "Send one bounded notification-only title/body message to the exact project- and topic-bound audience.", kind: .message, riskLevel: .high, adapterKind: .nativeAPI,
            defaultPermission: .approvalRequired, requiredScopes: ["https://www.googleapis.com/auth/firebase.messaging"], capabilityKeys: ["topic_notification_publish"], payloadSchema: ["title": .string("required, 1-100 characters"), "body": .string("required, 1-1000 characters")],
            resultSchema: ["projectId": .string("credential-bound project"), "topic": .string("exact bound topic"), "messageName": .string("safe provider acknowledgement"), "providerAcknowledged": .string("boolean"), "automaticRetry": .string("always false")]),
        ProviderActionTemplate(
            actionKey: "firebase_cloud_messaging_private_or_admin", displayName: "Access broader FCM", summary: "Access devices, users, conditions, subscriptions, arbitrary targets/payloads, project configuration, cross-project authority, raw APIs, retries, SDKs or bulk.", kind: .admin,
            riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["blocked"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broader FCM surfaces are outside V1."),
    ]
    private static let appsFlyerTemplates:[ProviderActionTemplate]=[
        ProviderActionTemplate(
            actionKey: "appsflyer_app_reference_list", displayName: "List AppsFlyer app references", summary: "Read page 1 of at most 25 app IDs without names, identity, attribution or pagination URLs.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: [], capabilityKeys: ["app_reference_read"], payloadSchema: [:], resultSchema: ["apps": .string("at most 25 app IDs"), "totalItems": .string("aggregate count"), "nextPageAvailable": .string("boolean without URL")]),
        ProviderActionTemplate(
            actionKey: "appsflyer_audience_connection_summary_get", displayName: "Get AppsFlyer Audiences connection summary", summary: "Return only whether premium Audiences partner connections exist and their bounded count without partner, audience, credential, member, split or upload identity.",
            kind: .read, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: [], capabilityKeys: ["audience_connection_summary_read"], payloadSchema: [:],
            resultSchema: ["configured": .string("boolean"), "connectionCount": .string("0-115"), "truncated": .string("defensive boolean")]),
        ProviderActionTemplate(
            actionKey: "appsflyer_private_or_admin", displayName: "Access broader AppsFlyer",
            summary: "Access identity, audience or partner detail, members, identifiers, splits, imports, uploads, attribution, devices, campaigns, analytics, reports, raw data, writes, administration, arbitrary APIs, pagination or bulk.", kind: .admin, riskLevel: .destructive,
            adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["blocked"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broader AppsFlyer surfaces are outside V1."),
    ]
    private static let adjustTemplates:[ProviderActionTemplate]=[
        ProviderActionTemplate(
            actionKey: "adjust_app_reference_list", displayName: "List Adjust app references", summary: "Read at most 25 app IDs without names, identity, attribution, device, campaign, revenue or report data.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI,
            defaultPermission: .approvalRequired, requiredScopes: [], capabilityKeys: ["app_reference_read"], payloadSchema: [:], resultSchema: ["apps": .string("at most 25 app IDs"), "totalItems": .string("aggregate count"), "truncated": .string("boolean")]),
        ProviderActionTemplate(
            actionKey: "adjust_private_or_admin", displayName: "Access broader Adjust", summary: "Access identity, app settings, attribution, devices, campaigns, analytics, reports, raw data, writes, administration, arbitrary APIs, filters, pagination or bulk.", kind: .admin,
            riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["blocked"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broader Adjust surfaces are outside V1."),
    ]
    private static let branchTemplates:[ProviderActionTemplate]=[
        ProviderActionTemplate(
            actionKey: "branch_bound_link_structure_inspect", displayName: "Inspect bound Branch link structure", summary: "Verify one exact bound Branch link and return only lifecycle/count/presence metadata without URL, content, identity, attribution or device values.", kind: .read,
            riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: [], capabilityKeys: ["bound_link_structure_read"], payloadSchema: [:],
            resultSchema: [
                "linkVerified": .string("boolean"), "oneTimeUse": .string("boolean or null"), "creationSource": .string("bounded integer or null"), "matchDurationSeconds": .string("bounded integer or null"), "tagCount": .string("0-100"), "tagsTruncated": .string("boolean"),
                "hasChannel": .string("boolean"), "hasFeature": .string("boolean"), "hasCampaign": .string("boolean"), "hasStage": .string("boolean"),
            ]),
        ProviderActionTemplate(
            actionKey: "branch_private_or_admin", displayName: "Access broader Branch", summary: "Access link content, identities, attribution, devices, analytics, create/update/delete, administration, arbitrary APIs, pagination, polling, SDKs or bulk.", kind: .admin, riskLevel: .destructive,
            adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["blocked"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broader Branch surfaces are outside V1."),
    ]
    private static let singularTemplates:[ProviderActionTemplate]=[
        ProviderActionTemplate(
            actionKey: "singular_app_site_reference_list", displayName: "List Singular app-site references", summary: "Read at most 25 internal app/app-site IDs and platform labels without names, bundle/public IDs, URLs, links, partners, attribution or reports.", kind: .read, riskLevel: .high,
            adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: [], capabilityKeys: ["app_site_reference_read"], payloadSchema: [:],
            resultSchema: ["appSites": .string("at most 25 appId/appSiteId/platform references"), "totalItems": .string("aggregate count"), "truncated": .string("boolean")]),
        ProviderActionTemplate(
            actionKey: "singular_private_or_admin", displayName: "Access broader Singular", summary: "Access app identity, destinations, links, partners, attribution, devices, analytics, reports, raw data, ingestion, writes, administration, arbitrary APIs, polling, SDKs or bulk.", kind: .admin,
            riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["blocked"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broader Singular surfaces are outside V1."),
    ]
    private static let kochavaTemplates:[ProviderActionTemplate]=[
        ProviderActionTemplate(
            actionKey: "kochava_app_reference_list", displayName: "List Kochava app references", summary: "Read at most 25 internal app IDs, platform labels and deleted states without names, GUIDs, store, SDK, consent, configuration, credentials, attribution, devices or reports.", kind: .read,
            riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: [], capabilityKeys: ["app_reference_read"], payloadSchema: [:],
            resultSchema: ["apps": .string("at most 25 appId/platform/deleted references"), "returnedCount": .string("validated reference count"), "nextPageAvailable": .string("boolean without token")]),
        ProviderActionTemplate(
            actionKey: "kochava_private_or_admin", displayName: "Access broader Kochava", summary: "Access identity, configuration, credentials, attribution, devices, campaigns, links, reports, raw data, writes, administration, arbitrary APIs, pagination, SDKs or bulk.", kind: .admin,
            riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["blocked"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broader Kochava surfaces are outside V1."),
    ]
    private static let segmentPersonasTemplates:[ProviderActionTemplate]=[
        ProviderActionTemplate(
            actionKey: "segment_personas_audience_readiness_summary_get", displayName: "Get Segment Personas audience readiness summary",
            summary: "Aggregate the first 25 audiences by enabled/live state, Users/Accounts/Linked type and Realtime/Batch cadence without identity, definitions, members, sizes, schedules or destinations.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI,
            defaultPermission: .approvalRequired, requiredScopes: [], capabilityKeys: ["audience_readiness_summary_read"], payloadSchema: [:],
            resultSchema: [
                "returnedCount": .string("0-25"), "totalEntries": .string("aggregate total or null"), "nextPageAvailable": .string("boolean without cursor"), "enabledCount": .string("page count"), "liveCount": .string("page count"), "userAudienceCount": .string("page count"),
                "accountAudienceCount": .string("page count"), "linkedAudienceCount": .string("page count"), "realtimeCount": .string("page count"), "batchCount": .string("page count"),
            ]),
        ProviderActionTemplate(
            actionKey: "segment_personas_private_or_admin", displayName: "Access broader Twilio Segment",
            summary: "Access audience identity, definitions, sizes, profiles, members, identifiers, traits, schedules, destinations, activation, writes, administration, arbitrary APIs, pagination, SDKs or bulk.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported,
            defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["blocked"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broader Segment surfaces are outside V1."),
    ]

    private static let mParticleTemplates:[ProviderActionTemplate]=[
        ProviderActionTemplate(
            actionKey: "mparticle_audience_readiness_summary_get", displayName: "Get mParticle audience readiness summary",
            summary: "Aggregate returned, active, calculated and connected Real-time Audience counts for one bound account and workspace without identity, size, membership, creator, workspace or output details.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI,
            defaultPermission: .approvalRequired, requiredScopes: [], capabilityKeys: ["audience_readiness_summary_read"], payloadSchema: [:],
            resultSchema: ["returnedCount": .string("aggregate count"), "activeCount": .string("aggregate count"), "calculatedCount": .string("aggregate count"), "connectedCount": .string("aggregate count")]),
        ProviderActionTemplate(
            actionKey: "mparticle_private_or_admin", displayName: "Access broader mParticle", summary: "Access audience identity, size, membership, profiles, identities, events, inputs, outputs, data plans, writes, administration, arbitrary APIs or bulk.", kind: .admin, riskLevel: .destructive,
            adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["blocked"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broader mParticle surfaces are outside V1."),
    ]

    private static let tealiumTemplates:[ProviderActionTemplate]=[
        ProviderActionTemplate(
            actionKey: "tealium_definition_readiness_summary_get", displayName: "Get Tealium definition readiness summary", summary: "Count audience and badge definitions for one exact account/profile without identity, names, visitor data, configuration or credentials.", kind: .read,
            riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: [], capabilityKeys: ["definition_readiness_summary_read"], payloadSchema: [:],
            resultSchema: ["audienceDefinitionCount": .string("aggregate count"), "badgeDefinitionCount": .string("aggregate count")]),
        ProviderActionTemplate(
            actionKey: "tealium_private_or_admin", displayName: "Access broader Tealium", summary: "Access definition identity, visitors, events, attributes, configuration, tags, integrations, publishing, authenticated APIs, administration or bulk.", kind: .admin, riskLevel: .destructive,
            adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["blocked"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broader Tealium surfaces are outside V1."),
    ]

    private static let lyticsTemplates:[ProviderActionTemplate]=[
        ProviderActionTemplate(
            actionKey: "lytics_segment_readiness_summary_get", displayName: "Get Lytics segment readiness summary", summary: "Aggregate returned, user-table, content-table and public segment counts without identity, definitions, membership size, lineage, jobs or profiles.", kind: .read,
            riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: [], capabilityKeys: ["segment_readiness_summary_read"], payloadSchema: [:],
            resultSchema: ["returnedCount": .string("aggregate count"), "userSegmentCount": .string("aggregate count"), "contentSegmentCount": .string("aggregate count"), "publicSegmentCount": .string("aggregate count")]),
        ProviderActionTemplate(
            actionKey: "lytics_private_or_admin", displayName: "Access broader Lytics", summary: "Access segment identity, definitions, profiles, content, PII, connections, journeys, activation, writes, administration, scans, raw APIs or bulk.", kind: .admin, riskLevel: .destructive,
            adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["blocked"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broader Lytics surfaces are outside V1."),
    ]

    private static let blueConicTemplates:[ProviderActionTemplate]=[
        ProviderActionTemplate(
            actionKey: "blueconic_segment_readiness_summary_get", displayName: "Get BlueConic segment readiness summary", summary: "Return only the aggregate segment count for one exact bound tenant without tenant, segment, profile, member or customer-data details.", kind: .read, riskLevel: .high,
            adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: [], capabilityKeys: ["segment_readiness_summary_read"], payloadSchema: [:], resultSchema: ["segmentCount": .string("aggregate count")]),
        ProviderActionTemplate(
            actionKey: "blueconic_private_or_admin", displayName: "Access broader BlueConic", summary: "Access tenant or segment identity, definitions, membership, profiles, interactions, audit events, activation, writes, administration, raw APIs or bulk.", kind: .admin, riskLevel: .destructive,
            adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["blocked"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broader BlueConic surfaces are outside V1."),
    ]

    private static let treasureDataTemplates:[ProviderActionTemplate]=[
        ProviderActionTemplate(
            actionKey: "treasure_data_database_readiness_summary_get", displayName: "Get Treasure Data database readiness summary", summary: "Return database and delete-protected counts without database identity, records, permissions, tables, schemas, queries, jobs or customer data.", kind: .read,
            riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: [], capabilityKeys: ["database_readiness_summary_read"], payloadSchema: [:], resultSchema: ["databaseCount": .string("aggregate count"), "deleteProtectedCount": .string("aggregate count")]),
        ProviderActionTemplate(
            actionKey: "treasure_data_private_or_admin", displayName: "Access broader Treasure Data", summary: "Access database identity, records, permissions, tables, schemas, profiles, queries, jobs, workflows, imports, exports, writes, administration, raw APIs or bulk.", kind: .admin,
            riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["blocked"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broader Treasure Data surfaces are outside V1."),
    ]

    private static let hightouchTemplates:[ProviderActionTemplate]=[
        ProviderActionTemplate(
            actionKey: "hightouch_model_readiness_summary_get", displayName: "Get Hightouch model readiness summary", summary: "Return only the aggregate model count without model identity, definitions, SQL, customer data, source, destination, sync or run details.", kind: .read, riskLevel: .high,
            adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: [], capabilityKeys: ["model_readiness_summary_read"], payloadSchema: [:], resultSchema: ["modelCount": .string("aggregate count")]),
        ProviderActionTemplate(
            actionKey: "hightouch_private_or_admin", displayName: "Access broader Hightouch", summary: "Access model identity, definitions, SQL, customer data, sources, destinations, syncs, runs, triggers, writes, administration, raw APIs or bulk.", kind: .admin, riskLevel: .destructive,
            adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["blocked"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broader Hightouch surfaces are outside V1."),
    ]

    private static let censusTemplates:[ProviderActionTemplate]=[
        ProviderActionTemplate(
            actionKey: "census_dataset_readiness_summary_get", displayName: "Get Census dataset readiness summary", summary: "Return only the aggregate dataset count without dataset identity, SQL, schemas, customer data, source, destination, sync or run details.", kind: .read, riskLevel: .high,
            adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: [], capabilityKeys: ["dataset_readiness_summary_read"], payloadSchema: [:], resultSchema: ["datasetCount": .string("aggregate count")]),
        ProviderActionTemplate(
            actionKey: "census_private_or_admin", displayName: "Access broader Census", summary: "Access dataset identity, SQL, schemas, customer data, sources, destinations, syncs, runs, triggers, writes, administration, raw APIs or bulk.", kind: .admin, riskLevel: .destructive,
            adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["blocked"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broader Census surfaces are outside V1."),
    ]

    private static let clioManageTemplates:[ProviderActionTemplate]=[
        ProviderActionTemplate(
            actionKey: "clio_manage_connection_authority_get", displayName: "Verify Clio Manage connection authority", summary: "Return only authorization, enabled state, fixed US region, and API version while discarding user identity and all legal-practice data.", kind: .read, riskLevel: .high,
            adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: [], capabilityKeys: ["connection_authority_read"], payloadSchema: [:],
            resultSchema: ["authorized": .string("boolean"), "userEnabled": .string("boolean"), "apiRegion": .string("us"), "apiVersion": .string("pinned version")]),
        ProviderActionTemplate(
            actionKey: "clio_manage_private_or_admin", displayName: "Access broader Clio Manage", summary: "Access identity, firm/client/matter data, documents, communications, calendars, tasks, activities, billing, payments, writes, webhooks, administration, other regions, raw APIs or bulk.",
            kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["blocked"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broader Clio Manage surfaces are outside V1."),
    ]

    private static let clioGrowTemplates:[ProviderActionTemplate]=[
        ProviderActionTemplate(
            actionKey: "clio_grow_connection_authority_get", displayName: "Verify Clio Grow connection authority", summary: "Return only authorization state, fixed US region, and API version while discarding user, account, firm, and all legal-intake data.", kind: .read, riskLevel: .high,
            adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: ["grow_user_read"], capabilityKeys: ["connection_authority_read"], payloadSchema: [:], resultSchema: ["authorized": .string("boolean"), "apiRegion": .string("us"), "apiVersion": .string("v2")]),
        ProviderActionTemplate(
            actionKey: "clio_grow_private_or_admin", displayName: "Access broader Clio Grow", summary: "Access identity, firm, lead, contact, matter, note, source, custom-action, write, administration, other-region, raw API or bulk surfaces.", kind: .admin, riskLevel: .destructive,
            adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["blocked"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broader Clio Grow surfaces are outside V1."),
    ]

    private static let myCaseTemplates:[ProviderActionTemplate]=[
        ProviderActionTemplate(
            actionKey: "mycase_connection_authority_get", displayName: "Verify MyCase connection authority", summary: "Return only authorization state and API version while discarding firm, user, and all legal-practice data.", kind: .read, riskLevel: .high, adapterKind: .nativeAPI,
            defaultPermission: .approvalRequired, requiredScopes: [], capabilityKeys: ["connection_authority_read"], payloadSchema: [:], resultSchema: ["authorized": .string("boolean"), "apiVersion": .string("v1")]),
        ProviderActionTemplate(
            actionKey: "mycase_private_or_admin", displayName: "Access broader MyCase", summary: "Access firm identity, cases, contacts, documents, calendars, tasks, communications, intake, billing, payments, writes, administration, raw APIs, pagination, or bulk.", kind: .admin,
            riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["blocked"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broader MyCase surfaces are outside V1."),
    ]

    private static let practicePantherTemplates:[ProviderActionTemplate]=[
        ProviderActionTemplate(
            actionKey: "practicepanther_connection_authority_get", displayName: "Verify PracticePanther connection authority", summary: "Return only authorization state and API version while discarding the OData count, identity, and all legal-practice data.", kind: .read, riskLevel: .high,
            adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: [], capabilityKeys: ["connection_authority_read"], payloadSchema: [:], resultSchema: ["authorized": .string("boolean"), "apiVersion": .string("v1")]),
        ProviderActionTemplate(
            actionKey: "practicepanther_private_or_admin", displayName: "Access broader PracticePanther", summary: "Access identity, contacts, matters, time, documents, tasks, calendars, communications, billing, payments, writes, administration, raw OData, pagination, or bulk.", kind: .admin,
            riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["blocked"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broader PracticePanther surfaces are outside V1."),
    ]

    private static let smokeballTemplates:[ProviderActionTemplate]=[
        ProviderActionTemplate(
            actionKey: "smokeball_connection_authority_get", displayName: "Verify Smokeball connection authority", summary: "Return only authorization state, US region, and API version while discarding firm identity and all legal-practice data.", kind: .read, riskLevel: .high,
            adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: [], capabilityKeys: ["connection_authority_read"], payloadSchema: [:], resultSchema: ["authorized": .string("boolean"), "apiRegion": .string("us"), "apiVersion": .string("v1")]),
        ProviderActionTemplate(
            actionKey: "smokeball_private_or_admin", displayName: "Access broader Smokeball",
            summary: "Access firm identity, staff, clients, matters, documents, calendars, tasks, communications, time, billing, payments, trust data, writes, administration, other regions, raw APIs, pagination, or bulk.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported,
            defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["blocked"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broader Smokeball surfaces are outside V1."),
    ]
    private static let lawPayTemplates:[ProviderActionTemplate]=[
        ProviderActionTemplate(
            actionKey: "lawpay_connection_authority_get", displayName: "Verify LawPay connection authority", summary: "Return only authorization state, 8am/LawPay platform, and API version while discarding merchant identity, account keys, trust, payment, and legal-practice data.", kind: .read,
            riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: ["payments"], capabilityKeys: ["connection_authority_read"], payloadSchema: [:],
            resultSchema: ["authorized": .string("boolean"), "platform": .string("8am-lawpay"), "apiVersion": .string("v1")]),
        ProviderActionTemplate(
            actionKey: "lawpay_payment_or_admin", displayName: "Access broader LawPay", summary: "Access merchant identity, account keys, trust accounts, cards, eCheck, payments, invoices, refunds, saved methods, webhooks, writes, administration, raw APIs, pagination, or bulk.", kind: .admin,
            riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: ["payments"], capabilityKeys: ["blocked"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broader LawPay payment and account surfaces are outside V1."),
    ]

    private static let filevineTemplates:[ProviderActionTemplate]=[
        ProviderActionTemplate(
            actionKey: "filevine_connection_authority_get", displayName: "Verify Filevine connection authority", summary: "Return only authorization state, US region, and API version while discarding user, firm, project, matter, document, financial, and legal-practice data.", kind: .read,
            riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: ["openid", "offline_access", "fv.api.gateway.access"], capabilityKeys: ["connection_authority_read"], payloadSchema: [:],
            resultSchema: ["authorized": .string("boolean"), "apiRegion": .string("us"), "apiVersion": .string("v2")]),
        ProviderActionTemplate(
            actionKey: "filevine_private_or_admin", displayName: "Access broader Filevine", summary: "Access users, firms, projects, matters, documents, tasks, notes, communications, financial data, writes, webhooks, administration, other regions, raw APIs, pagination, or bulk.", kind: .admin,
            riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: ["openid", "offline_access", "fv.api.gateway.access"], capabilityKeys: ["blocked"], payloadSchema: [:], resultSchema: [:],
            blockedReason: "Broader Filevine legal-practice surfaces are outside V1."),
    ]

    private static let trelloTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "trello_board_list", displayName: "List Trello boards", summary: "List bounded boards accessible to the connected Trello member.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: ["read"], capabilityKeys: ["board_list"],
            payloadSchema: ["maxResults": .string("optional integer 1-25")], resultSchema: ["boards": .string("array with id, name, description excerpt, URL, closed state, and Workspace")]),
        ProviderActionTemplate(
            actionKey: "trello_board_cards_list", displayName: "List Trello board cards", summary: "List bounded cards and list context for one Trello board.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: ["read"],
            capabilityKeys: ["board_cards", "card_triage"], payloadSchema: ["boardId": .string("Trello board id or shortLink"), "maxResults": .string("optional integer 1-50")],
            resultSchema: ["cards": .string("array with id, name, description excerpt, due, dueComplete, list, members, labels, URL, and updated time")]),
        ProviderActionTemplate(
            actionKey: "trello_card_get", displayName: "Get Trello card", summary: "Read one Trello card with board, list, member, label, due, and bounded description context.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: ["read"],
            capabilityKeys: ["card_get"], payloadSchema: ["cardId": .string("Trello card id or shortLink"), "maxDescriptionChars": .string("optional integer 1-4000")], resultSchema: ["card": .string("provider-correct Trello card object")]),
        ProviderActionTemplate(
            actionKey: "trello_search", displayName: "Search Trello", summary: "Search accessible Trello boards and cards with bounded typed results.", kind: .search, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: ["read"],
            capabilityKeys: ["board_card_search"], payloadSchema: ["query": .string("search text"), "maxResults": .string("optional integer 1-25")], resultSchema: ["boards": .string("bounded board summaries"), "cards": .string("bounded card summaries")]),
        ProviderActionTemplate(
            actionKey: "trello_card_prepare", displayName: "Prepare Trello card", summary: "Prepare a card create, update, or comment payload locally without provider mutation.", kind: .draft, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: [],
            capabilityKeys: ["card_draft", "payload_hash"],
            payloadSchema: [
                "operation": .string("create, update, or comment"), "listId": .string("optional list id"), "cardId": .string("optional card id"), "name": .string("optional card name"), "description": .string("optional description"), "due": .string("optional ISO date-time"),
                "dueComplete": .string("optional boolean"), "comment": .string("optional comment text"),
            ], resultSchema: ["draftPreview": .string("normalized payload, hash, providerMutation=false")]),
        ProviderActionTemplate(
            actionKey: "trello_card_create", displayName: "Create Trello card", summary: "Create an exact reviewed card in a Trello list.", kind: .write, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: ["write"], capabilityKeys: ["card_create"],
            payloadSchema: ["listId": .string("Trello list id"), "name": .string("card name"), "description": .string("optional description"), "due": .string("optional ISO date-time"), "approvalPayloadHash": .string("optional exact payload hash")],
            resultSchema: ["id": .string("string"), "name": .string("string"), "url": .string("string"), "listId": .string("string"), "payloadHash": .string("string"), "auditId": .string("string")]),
        ProviderActionTemplate(
            actionKey: "trello_card_update", displayName: "Update Trello card", summary: "Update an exact reviewed Trello card or move it to another list.", kind: .write, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: ["write"],
            capabilityKeys: ["card_update"],
            payloadSchema: [
                "cardId": .string("Trello card id"), "name": .string("optional name"), "description": .string("optional description"), "listId": .string("optional destination list id"), "due": .string("optional ISO date-time"), "dueComplete": .string("optional boolean"),
                "approvalPayloadHash": .string("optional exact payload hash"),
            ], resultSchema: ["id": .string("string"), "name": .string("string"), "due": .string("optional"), "dueComplete": .string("boolean"), "url": .string("string"), "payloadHash": .string("string"), "auditId": .string("string")]),
        ProviderActionTemplate(
            actionKey: "trello_card_comment_create", displayName: "Comment on Trello card", summary: "Add an exact reviewed comment to a Trello card.", kind: .message, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired, requiredScopes: ["write"],
            capabilityKeys: ["card_comment"], payloadSchema: ["cardId": .string("Trello card id"), "comment": .string("comment text"), "approvalPayloadHash": .string("optional exact payload hash")],
            resultSchema: ["actionId": .string("string"), "cardId": .string("string"), "url": .string("string"), "payloadHash": .string("string"), "auditId": .string("string")]),
        ProviderActionTemplate(
            actionKey: "trello_card_delete", displayName: "Delete Trello card", summary: "Delete a Trello card.", kind: .delete, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["card_delete"],
            payloadSchema: ["cardId": .string("string")], resultSchema: [:], blockedReason: "Trello card deletion is blocked in V1."),
        ProviderActionTemplate(
            actionKey: "trello_board_admin", displayName: "Administer Trello board or Workspace", summary: "Create/delete boards or lists, change members, permissions, settings, Power-Ups, or Workspace administration.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported,
            defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["board_admin", "workspace_admin", "member_admin"], payloadSchema: ["operation": .string("string")], resultSchema: [:], blockedReason: "Trello board, Workspace, member, and Power-Up administration are blocked in V1."),
        ProviderActionTemplate(
            actionKey: "trello_webhook_mutate", displayName: "Mutate Trello webhooks", summary: "Create or delete Trello webhooks or persistent subscriptions.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["webhook_write"], payloadSchema: ["operation": .string("string")], resultSchema: [:], blockedReason: "Trello webhook mutation is blocked in V1."),
        ProviderActionTemplate(
            actionKey: "trello_broad_export", displayName: "Broad Trello export", summary: "Crawl, sync, export, or download broad Trello content or attachments.", kind: .read, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["broad_export"], payloadSchema: ["scope": .string("string")], resultSchema: [:], blockedReason: "Broad Trello export and crawling are blocked by V1 privacy/context limits."),
        ProviderActionTemplate(
            actionKey: "trello_raw_api_call", displayName: "Raw Trello API call", summary: "Expose raw Trello REST or provider methods.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["raw_api"],
            payloadSchema: ["method": .string("string"), "path": .string("string")], resultSchema: [:], blockedReason: "Raw Trello API exposure is blocked; agents receive only Relay wrappers.")
    ]

    private static let googleTasksTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "google_tasks_tasklists_list", displayName: "List task lists", summary: "Return the first bounded page of TaskLists.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.googleTasksRelayOwnedOAuthScopes, capabilityKeys: ["list_tasklists"], payloadSchema: [:], resultSchema: ["taskLists": .string("at most 20 TaskList summaries")]),
        ProviderActionTemplate(
            actionKey: "google_tasks_tasks_list", displayName: "List tasks", summary: "Return the first bounded page of Tasks from an explicit TaskList.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.googleTasksRelayOwnedOAuthScopes, capabilityKeys: ["list_tasks"], payloadSchema: ["taskListId": .string("string")], resultSchema: ["tasks": .string("at most 100 tasks; assignment context excluded")]),
        ProviderActionTemplate(
            actionKey: "google_tasks_update_prepare", displayName: "Prepare task update", summary: "Validate task creation or safe patch locally.", kind: .draft, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: [], capabilityKeys: ["prepare_task"],
            payloadSchema: ["taskListId": .string("string"), "operation": .string("create or patch")], resultSchema: ["draftPreview": .string("non-mutating preview")]),
        ProviderActionTemplate(
            actionKey: "google_tasks_task_create", displayName: "Create task", summary: "Create a top-level Task through approval or Direct writes.", kind: .write, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ProviderConnectionService.googleTasksRelayOwnedOAuthScopes, capabilityKeys: ["create_task"], payloadSchema: ["taskListId": .string("string"), "title": .string("max 1024"), "notes": .string("optional max 8192"), "dueDate": .string("optional ISO date")],
            resultSchema: ["task": .string("bounded Task")]),
        ProviderActionTemplate(
            actionKey: "google_tasks_task_patch", displayName: "Patch task", summary: "Safely patch title, notes, date-only due, or status after assigned-task preflight.", kind: .write, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ProviderConnectionService.googleTasksRelayOwnedOAuthScopes, capabilityKeys: ["patch_task"],
            payloadSchema: ["taskListId": .string("string"), "taskId": .string("string"), "etag": .string("required"), "title": .string("optional"), "notes": .string("optional"), "dueDate": .string("optional"), "status": .string("optional")],
            resultSchema: ["task": .string("bounded Task"), "assignedTaskPreflight": .string("true")]),
        ProviderActionTemplate(
            actionKey: "google_tasks_delete_clear", displayName: "Delete or clear tasks", summary: "Delete Tasks/TaskLists or clear completed Tasks.", kind: .delete, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["delete_task", "clear_tasks"], payloadSchema: [:], resultSchema: [:], blockedReason: "Task deletion and completed-task clearing are blocked in V1."),
        ProviderActionTemplate(
            actionKey: "google_tasks_move_parent", displayName: "Move or reparent tasks", summary: "Move, reorder, indent, or change task parent.", kind: .write, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["move_task", "reparent_task"], payloadSchema: [:], resultSchema: [:], blockedReason: "Move, reorder, and parent changes are blocked in V1."),
        ProviderActionTemplate(
            actionKey: "google_tasks_tasklist_admin", displayName: "Administer task lists", summary: "Create, update, rename, or delete TaskLists.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["tasklist_admin"],
            payloadSchema: [:], resultSchema: [:], blockedReason: "TaskList administration is blocked in V1."),
        ProviderActionTemplate(
            actionKey: "google_tasks_assigned_context", displayName: "Assigned task context", summary: "Expose or mutate Docs/Chat assigned-task context.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["assignment_context"], payloadSchema: [:], resultSchema: [:], blockedReason: "Assigned-task mutation and cross-product context are blocked in V1."),
        ProviderActionTemplate(
            actionKey: "google_tasks_raw_access", displayName: "Raw or delegated Tasks access", summary: "Invoke raw endpoints, auto-pagination, service accounts, or domain delegation.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["raw_api", "domain_delegation"], payloadSchema: [:], resultSchema: [:], blockedReason: "Raw, automatically paginated, and delegated access is blocked in V1.")
    ]

    private static let googleContactsTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "google_contacts_connections_list", displayName: "List contacts", summary: "Return the first 50 contact-source People with privacy-bounded fields.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.googleContactsRelayOwnedOAuthScopes, capabilityKeys: ["list_contacts"], payloadSchema: [:], resultSchema: ["connections": .string("at most 50 contact-source People")]),
        ProviderActionTemplate(
            actionKey: "google_contacts_contact_get", displayName: "Get contact", summary: "Get one explicit contact-source Person with privacy-bounded fields.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.googleContactsRelayOwnedOAuthScopes, capabilityKeys: ["get_contact"], payloadSchema: ["resourceName": .string("people/* resource name")], resultSchema: ["contact": .string("bounded Person summary")]),
        ProviderActionTemplate(
            actionKey: "google_contacts_update_prepare", displayName: "Prepare contact update", summary: "Validate a contact creation or safe patch locally.", kind: .draft, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: [],
            capabilityKeys: ["prepare_contact"], payloadSchema: ["operation": .string("create or patch"), "resourceName": .string("required for patch")], resultSchema: ["draftPreview": .string("non-mutating preview")]),
        ProviderActionTemplate(
            actionKey: "google_contacts_contact_create", displayName: "Create contact", summary: "Create one bounded contact through approval or Direct writes.", kind: .write, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ProviderConnectionService.googleContactsRelayOwnedOAuthScopes, capabilityKeys: ["create_contact"],
            payloadSchema: ["givenName": .string("required max 256"), "familyName": .string("optional max 256"), "emailAddresses": .string("optional max 5"), "phoneNumbers": .string("optional max 5"), "organizations": .string("optional max 3")],
            resultSchema: ["contact": .string("privacy-bounded created Person")]),
        ProviderActionTemplate(
            actionKey: "google_contacts_contact_patch", displayName: "Update contact", summary: "Safely update allowlisted contact fields after a latest-source ETag preflight.", kind: .write, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ProviderConnectionService.googleContactsRelayOwnedOAuthScopes, capabilityKeys: ["update_contact"],
            payloadSchema: ["resourceName": .string("people/* resource name"), "givenName": .string("optional"), "familyName": .string("optional"), "emailAddresses": .string("optional max 5"), "phoneNumbers": .string("optional max 5"), "organizations": .string("optional max 3")],
            resultSchema: ["contact": .string("privacy-bounded updated Person"), "latestSourceEtagPreflight": .string("true")]),
        ProviderActionTemplate(
            actionKey: "google_contacts_delete", displayName: "Delete contacts", summary: "Delete one or more contacts.", kind: .delete, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["delete_contact"], payloadSchema: [:],
            resultSchema: [:], blockedReason: "Contact deletion is blocked in V1."),
        ProviderActionTemplate(
            actionKey: "google_contacts_photos", displayName: "Mutate contact photos", summary: "Read, upload, replace, or delete contact photos.", kind: .write, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["contact_photo"],
            payloadSchema: [:], resultSchema: [:], blockedReason: "Contact photos are blocked in V1."),
        ProviderActionTemplate(
            actionKey: "google_contacts_batch", displayName: "Batch contact mutations", summary: "Batch create, update, or delete contacts.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["batch_contacts"],
            payloadSchema: [:], resultSchema: [:], blockedReason: "Batch contact operations are blocked in V1."),
        ProviderActionTemplate(
            actionKey: "google_contacts_groups_memberships", displayName: "Manage contact groups", summary: "Create, update, delete, or change contact-group memberships.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["contact_groups"], payloadSchema: [:], resultSchema: [:], blockedReason: "Contact groups and memberships are blocked in V1."),
        ProviderActionTemplate(
            actionKey: "google_contacts_other_directory_search", displayName: "Access other contacts or directory", summary: "List, copy, or search other contacts or directory people.", kind: .read, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["other_contacts", "directory_people", "search"], payloadSchema: [:], resultSchema: [:], blockedReason: "Other contacts, directory profiles, and search are blocked in V1."),
        ProviderActionTemplate(
            actionKey: "google_contacts_broad_personal_fields", displayName: "Access broad personal fields", summary: "Read or change addresses, birthdays, biographies, relations, events, or other excluded Person fields.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported,
            defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["broad_person_fields"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broad personal Person fields are blocked in V1."),
        ProviderActionTemplate(
            actionKey: "google_contacts_raw_sync_delegation", displayName: "Raw, sync, or delegated People access", summary: "Invoke raw methods, page/sync automatically, or use domain delegation.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["raw_api", "sync", "domain_delegation"], payloadSchema: [:], resultSchema: [:], blockedReason: "Raw, automatically paginated, synchronized, and delegated access is blocked in V1.")
    ]

    private static let googlePhotosTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "google_photos_picker_session_create", displayName: "Create photo selection session", summary: "Create one user-controlled Picker session for at most 25 items.", kind: .write, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ProviderConnectionService.googlePhotosRelayOwnedOAuthScopes, capabilityKeys: ["create_picker_session"], payloadSchema: ["maxItemCount": .string("optional integer 1-25")], resultSchema: ["session": .string("bounded Picker session and Google-owned picker URI")]),
        ProviderActionTemplate(
            actionKey: "google_photos_picker_session_get", displayName: "Get photo selection session", summary: "Check one explicit Picker session once without automatic polling.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.googlePhotosRelayOwnedOAuthScopes, capabilityKeys: ["get_picker_session"], payloadSchema: ["sessionId": .string("explicit Picker session ID")], resultSchema: ["session": .string("bounded session readiness and polling recommendation")]),
        ProviderActionTemplate(
            actionKey: "google_photos_picked_media_list", displayName: "List selected photo metadata", summary: "List the first 25 metadata summaries explicitly selected by the user.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.googlePhotosRelayOwnedOAuthScopes, capabilityKeys: ["list_picked_media"], payloadSchema: ["sessionId": .string("completed Picker session ID")],
            resultSchema: ["mediaItems": .string("at most 25 metadata-only picked items"), "nextPageAvailable": .string("boolean; token withheld")]),
        ProviderActionTemplate(
            actionKey: "google_photos_picker_session_delete", displayName: "Clean up photo selection session", summary: "Delete one Picker session without deleting user media.", kind: .write, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ProviderConnectionService.googlePhotosRelayOwnedOAuthScopes, capabilityKeys: ["delete_picker_session"], payloadSchema: ["sessionId": .string("explicit Picker session ID")], resultSchema: ["sessionDeleted": .string("true"), "userMediaDeleted": .string("false")]),
        ProviderActionTemplate(
            actionKey: "google_photos_removed_library_scopes", displayName: "Use removed Photos Library scopes", summary: "Request removed whole-library, sharing, or broad Library scopes.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["removed_library_scopes"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broad Photos Library scopes were removed after March 2025 and are forbidden."),
        ProviderActionTemplate(
            actionKey: "google_photos_library_upload_edit", displayName: "Upload or edit Library content", summary: "Upload/import media or create/edit app-created albums and media.", kind: .write, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["library_upload", "app_created_edit"], payloadSchema: [:], resultSchema: [:], blockedReason: "Library API upload and app-created-data management are outside V1."),
        ProviderActionTemplate(
            actionKey: "google_photos_raw_media", displayName: "Access raw selected media", summary: "Return base URLs, thumbnails, or photo/video bytes.", kind: .read, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["base_url", "download_media"], payloadSchema: [:], resultSchema: [:], blockedReason: "Raw media bytes and transient base URLs are withheld from agents."),
        ProviderActionTemplate(
            actionKey: "google_photos_library_search_sharing", displayName: "Search or share Photos Library", summary: "List/search the library or manage albums and sharing.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["library_search", "albums", "sharing"], payloadSchema: [:], resultSchema: [:], blockedReason: "Whole-library, album, and sharing behavior is outside Picker-only V1."),
        ProviderActionTemplate(
            actionKey: "google_photos_face_ml_ads", displayName: "Analyze faces or repurpose Photos data", summary: "Cluster/recognize faces, train ML, advertise, broker data, or build a competing gallery.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported,
            defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["faces", "ml_training", "advertising"], payloadSchema: [:], resultSchema: [:], blockedReason: "Photos policy prohibits these data uses."),
        ProviderActionTemplate(
            actionKey: "google_photos_auto_poll_paginate", displayName: "Automatically poll or paginate", summary: "Poll sessions or follow media page tokens automatically.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["automatic_polling", "automatic_pagination"], payloadSchema: [:], resultSchema: [:], blockedReason: "Automatic polling and pagination are blocked in V1."),
        ProviderActionTemplate(
            actionKey: "google_photos_raw_delegation", displayName: "Raw or delegated Photos access", summary: "Invoke raw endpoints, service accounts, or domain-wide delegation.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["raw_api", "domain_delegation"], payloadSchema: [:], resultSchema: [:], blockedReason: "Raw and delegated access is blocked in V1.")
    ]

    private static let googleMeetTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "google_meet_space_get", displayName: "Get meeting space", summary: "Read safe metadata for one explicit Relay-app-created Space.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.googleMeetRelayOwnedOAuthScopes, capabilityKeys: ["get_space"], payloadSchema: ["spaceName": .string("spaces/* resource name")], resultSchema: ["space": .string("privacy-bounded Space and join coordination")]),
        ProviderActionTemplate(
            actionKey: "google_meet_space_update_prepare", displayName: "Prepare meeting space update", summary: "Validate safe Space creation or patch locally.", kind: .draft, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: [],
            capabilityKeys: ["prepare_space"], payloadSchema: ["operation": .string("create or patch"), "spaceName": .string("required for patch"), "accessType": .string("RESTRICTED or TRUSTED"), "entryPointAccess": .string("ALL or CREATOR_APP_ONLY")],
            resultSchema: ["draftPreview": .string("non-mutating forced-safe configuration")]),
        ProviderActionTemplate(
            actionKey: "google_meet_space_create", displayName: "Create meeting space", summary: "Create one safely configured app-owned Space through approval or Direct writes.", kind: .write, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ProviderConnectionService.googleMeetRelayOwnedOAuthScopes, capabilityKeys: ["create_space"], payloadSchema: ["accessType": .string("optional RESTRICTED or TRUSTED"), "entryPointAccess": .string("optional ALL or CREATOR_APP_ONLY")],
            resultSchema: ["space": .string("safe created Space")]),
        ProviderActionTemplate(
            actionKey: "google_meet_space_patch", displayName: "Update meeting space", summary: "Patch one app-owned Space with a forced safety configuration and explicit update mask.", kind: .write, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ProviderConnectionService.googleMeetRelayOwnedOAuthScopes, capabilityKeys: ["patch_space"],
            payloadSchema: ["spaceName": .string("spaces/* resource name"), "accessType": .string("optional RESTRICTED or TRUSTED"), "entryPointAccess": .string("optional ALL or CREATOR_APP_ONLY")], resultSchema: ["space": .string("safe updated Space"), "explicitSafetyUpdateMask": .string("true")]),
        ProviderActionTemplate(
            actionKey: "google_meet_end_conference", displayName: "End active conference", summary: "Terminate the active call in a Space.", kind: .delete, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["end_conference"],
            payloadSchema: [:], resultSchema: [:], blockedReason: "Active-conference termination is blocked in V1."),
        ProviderActionTemplate(
            actionKey: "google_meet_open_unmoderated", displayName: "Use open or unmoderated meeting settings", summary: "Set OPEN access, moderation off, unrestricted participant features, attendance, or automatic artifacts.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported,
            defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["open_access", "unmoderated", "auto_artifacts"], payloadSchema: [:], resultSchema: [:], blockedReason: "Unsafe access, moderation, attendance, and artifact settings are blocked."),
        ProviderActionTemplate(
            actionKey: "google_meet_participants_sessions", displayName: "Access meeting participants", summary: "Read participant identities, attendance, devices, or participant sessions.", kind: .read, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["participants", "participant_sessions"], payloadSchema: [:], resultSchema: [:], blockedReason: "Participant and attendance data are outside V1."),
        ProviderActionTemplate(
            actionKey: "google_meet_conference_records", displayName: "Access conference records", summary: "List or get conference record identifiers and lifecycle.", kind: .read, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["conference_records"], payloadSchema: [:], resultSchema: [:], blockedReason: "Conference records are outside V1."),
        ProviderActionTemplate(
            actionKey: "google_meet_artifacts", displayName: "Access meeting artifacts", summary: "Read recordings, transcripts, transcript entries, smart notes, Drive files, or dial-in/SIP details.", kind: .read, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["recordings", "transcripts", "smart_notes", "drive_artifacts", "dial_in"], payloadSchema: [:], resultSchema: [:], blockedReason: "Meeting artifacts, restricted Drive data, dial-in, and SIP details are outside V1."),
        ProviderActionTemplate(
            actionKey: "google_meet_events_media_hardware", displayName: "Use Meet events, media, or hardware APIs", summary: "Subscribe to events or access Meet Media, eCDN, hardware, or add-on APIs.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["events", "media_api", "hardware"], payloadSchema: [:], resultSchema: [:], blockedReason: "Events, media streams, eCDN, hardware, and add-on surfaces are outside V1."),
        ProviderActionTemplate(
            actionKey: "google_meet_broad_scopes_drive", displayName: "Use broad Meet or Drive scopes", summary: "Request settings/read-all Space or restricted recording/transcript Drive scopes.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["broad_space_scope", "drive_meet"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broader Meet and restricted Drive scopes are forbidden in V1."),
        ProviderActionTemplate(
            actionKey: "google_meet_raw_delegation", displayName: "Raw or delegated Meet access", summary: "Invoke raw endpoints, paginate automatically, or use service accounts/domain delegation.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["raw_api", "domain_delegation"], payloadSchema: [:], resultSchema: [:], blockedReason: "Raw, automatically paginated, and delegated Meet access is blocked.")
    ]

    private static let googleChatTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "google_chat_space_get", displayName: "Get Chat space", summary: "Read bounded metadata for one explicit Chat Space.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.googleChatRelayOwnedOAuthScopes, capabilityKeys: ["get_space"], payloadSchema: ["spaceName": .string("spaces/* resource name")], resultSchema: ["space": .string("bounded Space metadata without memberships")]),
        ProviderActionTemplate(
            actionKey: "google_chat_messages_list", displayName: "List Chat messages", summary: "Read the newest first page of at most 25 plain-text messages in one explicit Space.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.googleChatRelayOwnedOAuthScopes, capabilityKeys: ["list_messages"], payloadSchema: ["spaceName": .string("spaces/* resource name"), "pageSize": .string("optional integer 1-25")],
            resultSchema: ["messages": .string("bounded plain text, timing, thread, and author type; no identity or rich/private content")]),
        ProviderActionTemplate(
            actionKey: "google_chat_message_prepare", displayName: "Prepare Chat message", summary: "Validate a bounded plain-text message or explicit-thread reply locally.", kind: .draft, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: [],
            capabilityKeys: ["prepare_message"], payloadSchema: ["spaceName": .string("spaces/* resource name"), "text": .string("1-4000 plain-text characters"), "threadName": .string("optional same-space thread")],
            resultSchema: ["draftPreview": .string("non-mutating fail-closed message preview")]),
        ProviderActionTemplate(
            actionKey: "google_chat_message_create", displayName: "Send Chat message", summary: "Send one bounded plain-text message or fail-closed thread reply through approval or Direct writes.", kind: .write, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ProviderConnectionService.googleChatRelayOwnedOAuthScopes, capabilityKeys: ["create_message"],
            payloadSchema: ["spaceName": .string("spaces/* resource name"), "text": .string("1-4000 plain-text characters"), "threadName": .string("optional same-space thread"), "requestId": .string("required idempotency identifier")],
            resultSchema: ["message": .string("bounded created message without sender identity or rich/private content")]),
        ProviderActionTemplate(
            actionKey: "google_chat_space_list_search", displayName: "Discover Chat spaces", summary: "List or search all visible Chat Spaces.", kind: .read, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["space_discovery"],
            payloadSchema: [:], resultSchema: [:], blockedReason: "Broad Space discovery is blocked in V1."),
        ProviderActionTemplate(
            actionKey: "google_chat_space_admin", displayName: "Administer Chat spaces", summary: "Create, update, delete, or import Chat Spaces.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["space_admin"],
            payloadSchema: [:], resultSchema: [:], blockedReason: "Space administration and import are blocked in V1."),
        ProviderActionTemplate(
            actionKey: "google_chat_memberships", displayName: "Access Chat memberships", summary: "List, get, create, update, or delete Space memberships.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["memberships"], payloadSchema: [:], resultSchema: [:], blockedReason: "Membership and identity access are blocked in V1."),
        ProviderActionTemplate(
            actionKey: "google_chat_message_mutation", displayName: "Modify or delete Chat messages", summary: "Update or delete existing Chat messages.", kind: .delete, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["message_update", "message_delete"], payloadSchema: [:], resultSchema: [:], blockedReason: "Existing-message mutation and deletion are blocked."),
        ProviderActionTemplate(
            actionKey: "google_chat_private_rich_media", displayName: "Use private or rich Chat content", summary: "Read or send private messages, cards, widgets, annotations, attachments, or media.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["private_messages", "rich_content", "media"], payloadSchema: [:], resultSchema: [:], blockedReason: "Private, rich, and media content are outside plain-text V1."),
        ProviderActionTemplate(
            actionKey: "google_chat_reactions", displayName: "Use Chat reactions", summary: "List, create, or delete reactions and custom emoji.", kind: .write, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["reactions"],
            payloadSchema: [:], resultSchema: [:], blockedReason: "Reactions and custom emoji are blocked."),
        ProviderActionTemplate(
            actionKey: "google_chat_app_bot_admin_import", displayName: "Use app, bot, admin, or import access", summary: "Authenticate as a Chat app or administrator or use import mode.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["app_auth", "admin_access", "import_mode"], payloadSchema: [:], resultSchema: [:], blockedReason: "Only narrowly scoped user authentication is permitted."),
        ProviderActionTemplate(
            actionKey: "google_chat_raw_paginate_delegation", displayName: "Use raw, paginated, or delegated Chat access", summary: "Invoke raw endpoints, follow page tokens, retry automatically, or use delegation.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported,
            defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["raw_api", "automatic_pagination", "domain_delegation"], payloadSchema: [:], resultSchema: [:], blockedReason: "Raw, automatic, and delegated access is blocked in V1.")
    ]

    private static let googleAdsTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "google_ads_customer_summary_get", displayName: "Get Google Ads customer summary", summary: "Read bounded metadata for one explicit advertiser or manager customer.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.googleAdsRelayOwnedOAuthScopes, capabilityKeys: ["customer_summary"], payloadSchema: ["customerId": .string("ten digits without hyphens")], resultSchema: ["customer": .string("name, currency, time zone, and safe account flags")]),
        ProviderActionTemplate(
            actionKey: "google_ads_campaign_performance_report", displayName: "Get Google Ads campaign performance", summary: "Read up to 50 campaigns over the last 30 days using a fixed reporting query.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.googleAdsRelayOwnedOAuthScopes, capabilityKeys: ["campaign_performance"], payloadSchema: ["customerId": .string("ten digits without hyphens")],
            resultSchema: ["campaigns": .string("bounded campaign identity, status, channel, and aggregate performance metrics")]),
        ProviderActionTemplate(
            actionKey: "google_ads_account_discovery", displayName: "Discover Google Ads accounts", summary: "List accessible customers or traverse manager hierarchies.", kind: .read, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["account_discovery"], payloadSchema: [:], resultSchema: [:], blockedReason: "Account discovery and hierarchy traversal are blocked in V1."),
        ProviderActionTemplate(
            actionKey: "google_ads_arbitrary_query_stream_export", displayName: "Run arbitrary or bulk Google Ads reports", summary: "Supply raw GAQL, stream, paginate, export, or schedule reports.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["raw_gaql", "search_stream", "export"], payloadSchema: [:], resultSchema: [:], blockedReason: "Only two fixed one-request bounded reports are allowed."),
        ProviderActionTemplate(
            actionKey: "google_ads_campaign_mutations", displayName: "Mutate Google Ads campaigns", summary: "Create, update, pause, enable, or remove campaigns.", kind: .write, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["campaign_mutation"], payloadSchema: [:], resultSchema: [:], blockedReason: "Campaign mutation is blocked in reporting-only V1."),
        ProviderActionTemplate(
            actionKey: "google_ads_budget_bidding_mutations", displayName: "Change Google Ads budgets or bids", summary: "Create or change budgets, bidding strategies, bid modifiers, or spend controls.", kind: .write, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["budget_mutation", "bidding_mutation"], payloadSchema: [:], resultSchema: [:], blockedReason: "Financial and bidding mutations are blocked."),
        ProviderActionTemplate(
            actionKey: "google_ads_ads_keywords_assets_mutations", displayName: "Mutate ads, keywords, or assets", summary: "Create or change ads, ad groups, keywords, criteria, or assets.", kind: .write, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["ad_mutation", "keyword_mutation", "asset_mutation"], payloadSchema: [:], resultSchema: [:], blockedReason: "Advertising-object mutations are blocked."),
        ProviderActionTemplate(
            actionKey: "google_ads_planning_recommendations", displayName: "Use planning or recommendations", summary: "Research keywords, plan campaigns, or apply/dismiss recommendations.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["planning", "recommendations"], payloadSchema: [:], resultSchema: [:], blockedReason: "Planning and recommendation surfaces are outside reporting-only permissible use."),
        ProviderActionTemplate(
            actionKey: "google_ads_audiences_customer_match", displayName: "Access audiences or Customer Match", summary: "Read or mutate audiences, user lists, or Customer Match data.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["audiences", "customer_match"], payloadSchema: [:], resultSchema: [:], blockedReason: "Audience and Customer Match data are excluded."),
        ProviderActionTemplate(
            actionKey: "google_ads_search_terms_click_data", displayName: "Access search terms or click data", summary: "Read search terms, click views, GCLIDs, IP, or granular location/user data.", kind: .read, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["search_terms", "click_data"], payloadSchema: [:], resultSchema: [:], blockedReason: "Granular query and click identifiers are excluded."),
        ProviderActionTemplate(
            actionKey: "google_ads_offline_conversions", displayName: "Use offline conversions", summary: "Upload or adjust click/call conversions or customer data.", kind: .write, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["offline_conversions"], payloadSchema: [:], resultSchema: [:], blockedReason: "Offline conversion and customer-data uploads are blocked."),
        ProviderActionTemplate(
            actionKey: "google_ads_billing_users_links", displayName: "Access billing, users, or account links", summary: "Access invoices, payments, billing setup, account users, manager links, or linked-customer data.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported,
            defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["billing", "account_users", "manager_links"], payloadSchema: [:], resultSchema: [:], blockedReason: "Billing, user administration, and links are excluded."),
        ProviderActionTemplate(
            actionKey: "google_ads_raw_service_account_delegation", displayName: "Use raw or delegated Google Ads access", summary: "Invoke raw tools, service accounts, automatic retries/pagination, or delegation.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported,
            defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["raw_api", "service_account", "delegation"], payloadSchema: [:], resultSchema: [:], blockedReason: "Raw, automatic, and delegated access is blocked.")
    ]

    private static let googleMerchantCenterTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "google_merchant_center_accounts_list", displayName: "List Merchant Center accounts", summary: "Read the first bounded page of Merchant Center accounts accessible to the authorizing user.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.googleMerchantCenterRelayOwnedOAuthScopes, capabilityKeys: ["accounts_list"], payloadSchema: [:], resultSchema: ["accounts": .string("up to 50 bounded Merchant Center account records")]),
        ProviderActionTemplate(
            actionKey: "google_merchant_center_products_list", displayName: "List Merchant Center products", summary: "Read up to 50 processed products for the explicit selected account.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.googleMerchantCenterRelayOwnedOAuthScopes, capabilityKeys: ["products_list"], payloadSchema: ["accountName": .string("connection-bound accounts/{id}")],
            resultSchema: ["products": .string("bounded product identity, commerce attributes, destination status, and issue counts")]),
        ProviderActionTemplate(
            actionKey: "google_merchant_center_product_get", displayName: "Get Merchant Center product", summary: "Read one explicit processed product from the selected account.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.googleMerchantCenterRelayOwnedOAuthScopes, capabilityKeys: ["product_get"], payloadSchema: ["accountName": .string("connection-bound accounts/{id}"), "productName": .string("accounts/{id}/products/{encoded product}")],
            resultSchema: ["product": .string("bounded useful product and issue detail")]),
        ProviderActionTemplate(
            actionKey: "google_merchant_center_product_issues_summary", displayName: "Review Merchant Center product issues", summary: "Run Relay's fixed first-page product-issues query for the selected account.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.googleMerchantCenterRelayOwnedOAuthScopes, capabilityKeys: ["product_issues_summary"], payloadSchema: ["accountName": .string("connection-bound accounts/{id}")],
            resultSchema: ["rows": .string("at most 50 products with actionable item-level issues")]),
        ProviderActionTemplate(
            actionKey: "google_merchant_center_product_inventory_data_source_mutation", displayName: "Mutate Merchant catalog data", summary: "Create, update, or delete products, inventory, data sources, promotions, reviews, or conversions.", kind: .write, riskLevel: .destructive,
            adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["mutations"], payloadSchema: [:], resultSchema: [:], blockedReason: "All Merchant Center mutations are blocked in read-only V1."),
        ProviderActionTemplate(
            actionKey: "google_merchant_center_account_user_admin", displayName: "Administer Merchant Center", summary: "Create accounts/subaccounts or manage users, services, shipping, returns, registration, or quotas.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported,
            defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["account_admin"], payloadSchema: [:], resultSchema: [:], blockedReason: "Merchant account and user administration are excluded."),
        ProviderActionTemplate(
            actionKey: "google_merchant_center_arbitrary_query_pagination", displayName: "Run arbitrary or paginated Merchant reports", summary: "Supply Merchant Query Language, arbitrary fields/tables/filters, page tokens, or exports.", kind: .admin, riskLevel: .destructive,
            adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["arbitrary_query", "pagination"], payloadSchema: [:], resultSchema: [:], blockedReason: "Only Relay's fixed 50-row first-page product-issues report is allowed."),
        ProviderActionTemplate(
            actionKey: "google_merchant_center_raw_service_account_legacy", displayName: "Use raw or legacy Merchant access", summary: "Invoke raw Merchant tools, service accounts, Content API, v1beta, batch, streaming, or automatic retries.", kind: .admin, riskLevel: .destructive,
            adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["raw_api", "service_account", "legacy_api"], payloadSchema: [:], resultSchema: [:], blockedReason: "Raw, service-account, legacy, beta, batch, and automatic access are blocked.")
    ]

    private static let youtubeTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "youtube_channels_list_mine", displayName: "Get my YouTube channel", summary: "Read the connected creator channel, its uploads playlist, status, and bounded statistics.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.youTubeRelayOwnedOAuthScopes, capabilityKeys: ["channel_summary"], payloadSchema: [:], resultSchema: ["channels": .string("at most one semantic YouTube channel record")]),
        ProviderActionTemplate(
            actionKey: "youtube_playlists_list_mine", displayName: "List my YouTube playlists", summary: "Read one bounded page of playlists owned by the connected creator.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.youTubeRelayOwnedOAuthScopes, capabilityKeys: ["playlists_list"], payloadSchema: ["maxResults": .string("integer from 1 through 25")], resultSchema: ["playlists": .string("up to 25 titled playlists with item counts and privacy")]),
        ProviderActionTemplate(
            actionKey: "youtube_playlist_items_list", displayName: "List YouTube playlist items", summary: "Read one bounded page from an explicit playlist returned by the connected channel or playlist tools.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.youTubeRelayOwnedOAuthScopes, capabilityKeys: ["playlist_items_list"], payloadSchema: ["playlistId": .string("explicit YouTube playlist ID"), "maxResults": .string("integer from 1 through 25")],
            resultSchema: ["playlistItems": .string("up to 25 titled video memberships with dates and positions")]),
        ProviderActionTemplate(
            actionKey: "youtube_videos_list", displayName: "Get YouTube videos", summary: "Read semantic metadata, status, duration, and statistics for explicit video IDs from prior results.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.youTubeRelayOwnedOAuthScopes, capabilityKeys: ["videos_list"], payloadSchema: ["videoIds": .string("array of 1 through 25 explicit YouTube video IDs")], resultSchema: ["videos": .string("up to 25 semantic video records")]),
        ProviderActionTemplate(
            actionKey: "youtube_search_history_export", displayName: "Search or export YouTube activity", summary: "Search YouTube, access history or Watch Later, paginate automatically, or export broadly.", kind: .read, riskLevel: .destructive, adapterKind: .unsupported,
            defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["search", "history", "export"], payloadSchema: [:], resultSchema: [:], blockedReason: "Search, history, Watch Later, automatic pagination, and broad exports are blocked."),
        ProviderActionTemplate(
            actionKey: "youtube_content_mutations", displayName: "Mutate YouTube content", summary: "Upload, update, delete, rate, comment, caption, subscribe, or change playlists.", kind: .write, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["mutations"], payloadSchema: [:], resultSchema: [:], blockedReason: "All YouTube mutations are blocked in read-only V1."),
        ProviderActionTemplate(
            actionKey: "youtube_live_analytics_partner_raw", displayName: "Use advanced YouTube services", summary: "Access live broadcasts, analytics, reports, memberships, partner/content-owner, raw, or undocumented services.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported,
            defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["advanced_services"], payloadSchema: [:], resultSchema: [:], blockedReason: "Advanced, partner, raw, and undocumented YouTube services are excluded."),
    ]

    private static let googleClassroomTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "google_classroom_courses_list_mine", displayName: "List my Classroom courses", summary: "Read one bounded page of courses the connected user is permitted to view.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.googleClassroomRelayOwnedOAuthScopes, capabilityKeys: ["courses_list"], payloadSchema: ["maxResults": .string("integer from 1 through 25")], resultSchema: ["courses": .string("up to 25 privacy-bounded named course records")]),
        ProviderActionTemplate(
            actionKey: "google_classroom_course_get", displayName: "Get Classroom course", summary: "Read one explicit permitted course returned by the course list.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.googleClassroomRelayOwnedOAuthScopes, capabilityKeys: ["course_get"], payloadSchema: ["courseId": .string("explicit Classroom course ID")], resultSchema: ["course": .string("privacy-bounded course details")]),
        ProviderActionTemplate(
            actionKey: "google_classroom_coursework_list", displayName: "List Classroom coursework", summary: "Read one bounded newest-first page of coursework for an explicit permitted course.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.googleClassroomRelayOwnedOAuthScopes, capabilityKeys: ["coursework_list"], payloadSchema: ["courseId": .string("explicit Classroom course ID"), "maxResults": .string("integer from 1 through 25")],
            resultSchema: ["courseWork": .string("up to 25 titled work items with due dates and safe material summaries")]),
        ProviderActionTemplate(
            actionKey: "google_classroom_materials_list", displayName: "List Classroom materials", summary: "Read one bounded newest-first page of learning materials for an explicit permitted course.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.googleClassroomRelayOwnedOAuthScopes, capabilityKeys: ["materials_list"], payloadSchema: ["courseId": .string("explicit Classroom course ID"), "maxResults": .string("integer from 1 through 25")],
            resultSchema: ["courseWorkMaterials": .string("up to 25 titled material posts with safe link metadata")]),
        ProviderActionTemplate(
            actionKey: "google_classroom_rosters_profiles_guardians", displayName: "Access Classroom people", summary: "Read rosters, profiles, emails, photos, invitations, or guardians.", kind: .read, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["people"], payloadSchema: [:], resultSchema: [:], blockedReason: "Rosters, profiles, invitations, and guardians are excluded."),
        ProviderActionTemplate(
            actionKey: "google_classroom_submissions_grades", displayName: "Access student work or grades", summary: "Read student submissions, responses, attachments, histories, rubrics, or grades.", kind: .read, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["student_work"], payloadSchema: [:], resultSchema: [:], blockedReason: "Student work and grade data are excluded."),
        ProviderActionTemplate(
            actionKey: "google_classroom_mutations_admin_raw", displayName: "Mutate or administer Classroom", summary: "Create, update, delete, grade, turn in, delegate, impersonate, preview, paginate, export, or call raw services.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported,
            defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["mutations", "admin", "raw"], payloadSchema: [:], resultSchema: [:], blockedReason: "Writes, delegation, administration, previews, exports, pagination, and raw tools are blocked."),
    ]

    private static let outlookTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "outlook_mail_folders_list", displayName: "List Outlook mail folders", summary: "Read one bounded page of visible root folders in the signed-in user's mailbox.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.outlookRelayOwnedOAuthScopes, capabilityKeys: ["folders_list"], payloadSchema: [:], resultSchema: ["folders": .string("up to 25 named root folders with bounded counts")]),
        ProviderActionTemplate(
            actionKey: "outlook_inbox_messages_list", displayName: "List recent Outlook Inbox messages", summary: "Read the newest bounded page of the signed-in user's Inbox.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.outlookRelayOwnedOAuthScopes, capabilityKeys: ["inbox_list"], payloadSchema: [:], resultSchema: ["messages": .string("up to 25 recent message summaries")]),
        ProviderActionTemplate(
            actionKey: "outlook_unread_messages_list", displayName: "List unread Outlook Inbox messages", summary: "Read the newest bounded unread messages in the signed-in user's Inbox using Relay's fixed filter.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: ProviderConnectionService.outlookRelayOwnedOAuthScopes, capabilityKeys: ["unread_list"], payloadSchema: [:], resultSchema: ["messages": .string("up to 25 unread message summaries")]),
        ProviderActionTemplate(
            actionKey: "outlook_message_get", displayName: "Get Outlook message", summary: "Read one explicit prior-result message with a bounded plain-text body.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.outlookRelayOwnedOAuthScopes, capabilityKeys: ["message_get"], payloadSchema: ["messageId": .string("explicit Graph message ID")], resultSchema: ["message": .string("semantic message with plain-text body capped at 8000 characters")]),
        ProviderActionTemplate(
            actionKey: "outlook_shared_application_mail", displayName: "Access shared or tenant mail", summary: "Read shared/delegated/other-user mail or use application permissions.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["shared_mail", "application_mail"], payloadSchema: [:], resultSchema: [:], blockedReason: "Only delegated signed-in-user /me mail is allowed."),
        ProviderActionTemplate(
            actionKey: "outlook_attachments_search_export", displayName: "Access attachments or broad mail", summary: "Read attachment content, MIME/headers, search, delta, subscribe, paginate, or export.", kind: .read, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["attachments", "search", "export"], payloadSchema: [:], resultSchema: [:], blockedReason: "Attachments, raw content, search and broad collection operations are blocked."),
        ProviderActionTemplate(
            actionKey: "outlook_mail_mutations", displayName: "Mutate Outlook mail", summary: "Draft, reply, forward, send, mark, move, delete, flag, or categorize mail.", kind: .write, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["mail_write"], payloadSchema: [:], resultSchema: [:], blockedReason: "All mail writes are blocked in read-only V1."),
        ProviderActionTemplate(
            actionKey: "outlook_calendar_contacts_files_directory", displayName: "Access other Microsoft Graph data", summary: "Read calendar, contacts, people, files, Teams, or directory resources.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["other_graph"], payloadSchema: [:], resultSchema: [:], blockedReason: "Outlook V1 is mail-only."),
    ]

    private static let microsoftTeamsTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "microsoft_teams_joined_teams_list", displayName: "List joined Microsoft Teams", summary: "Read the first 25 teams where the signed-in work user is a direct member.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.microsoftTeamsRelayOwnedOAuthScopes, capabilityKeys: ["joined_teams_list"], payloadSchema: [:], resultSchema: ["teams": .string("up to 25 named team metadata summaries")]),
        ProviderActionTemplate(
            actionKey: "microsoft_teams_team_get", displayName: "Get Microsoft team", summary: "Read one explicit prior-result team's bounded metadata.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.microsoftTeamsRelayOwnedOAuthScopes, capabilityKeys: ["team_get"], payloadSchema: ["teamId": .string("explicit Microsoft Graph team ID")], resultSchema: ["team": .string("team name, description, visibility, URL and archive state")]),
        ProviderActionTemplate(
            actionKey: "microsoft_teams_channels_list", displayName: "List Microsoft Teams channels", summary: "Read the first 25 visible channels in one explicit team.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.microsoftTeamsRelayOwnedOAuthScopes, capabilityKeys: ["channels_list"], payloadSchema: ["teamId": .string("explicit Microsoft Graph team ID")], resultSchema: ["channels": .string("up to 25 named channel metadata summaries")]),
        ProviderActionTemplate(
            actionKey: "microsoft_teams_channel_get", displayName: "Get Microsoft Teams channel", summary: "Read one explicit prior-result channel's bounded metadata.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.microsoftTeamsRelayOwnedOAuthScopes, capabilityKeys: ["channel_get"], payloadSchema: ["teamId": .string("explicit Microsoft Graph team ID"), "channelId": .string("explicit Microsoft Graph channel ID")],
            resultSchema: ["channel": .string("channel name, description, membership type, URL and summary")]),
        ProviderActionTemplate(
            actionKey: "microsoft_teams_messages_chats", displayName: "Read Teams messages or chats", summary: "Read channel messages, replies, private chats, bodies, senders, reactions, or subscriptions.", kind: .read, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["messages", "chats"], payloadSchema: [:], resultSchema: [:], blockedReason: "Message content, admin-consent scopes, metered APIs and chats are outside metadata-only V1."),
        ProviderActionTemplate(
            actionKey: "microsoft_teams_members_directory", displayName: "Read Teams members or directory", summary: "Read members, owners, profiles, emails, roster, or directory data.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["members", "directory"], payloadSchema: [:], resultSchema: [:], blockedReason: "Roster and directory data are blocked."),
        ProviderActionTemplate(
            actionKey: "microsoft_teams_files_meetings_admin", displayName: "Access Teams files, meetings, calls, or administration", summary: "Access files, tabs, apps, meetings, calls, recordings, transcripts, tenant enumeration, application permissions, or RSC.", kind: .admin,
            riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["files", "meetings", "admin"], payloadSchema: [:], resultSchema: [:], blockedReason: "Non-metadata Graph workloads and administrative authority are blocked."),
        ProviderActionTemplate(
            actionKey: "microsoft_teams_mutations_export_raw", displayName: "Mutate or broadly export Teams", summary: "Create, update, archive, delete, send, edit, react, export, search, subscribe, paginate, or call raw Graph tools.", kind: .write, riskLevel: .destructive,
            adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["writes", "exports", "raw"], payloadSchema: [:], resultSchema: [:], blockedReason: "All writes and broad/raw collection operations are blocked.")
    ]

    private static let oneDriveTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "onedrive_drive_get", displayName: "Get connected OneDrive", summary: "Read bounded metadata and quota state for the signed-in user's own drive.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.oneDriveRelayOwnedOAuthScopes, capabilityKeys: ["drive_get"], payloadSchema: [:], resultSchema: ["drive": .string("drive name/type/owner display/quota metadata")]),
        ProviderActionTemplate(
            actionKey: "onedrive_root_children_list", displayName: "List OneDrive root items", summary: "Read the first 25 named files and folders at the connected drive root.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.oneDriveRelayOwnedOAuthScopes, capabilityKeys: ["root_list"], payloadSchema: [:], resultSchema: ["items": .string("up to 25 bounded file/folder metadata records")]),
        ProviderActionTemplate(
            actionKey: "onedrive_folder_children_list", displayName: "List OneDrive folder items", summary: "Read the first 25 named children of one explicit prior-result folder.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.oneDriveRelayOwnedOAuthScopes, capabilityKeys: ["folder_list"], payloadSchema: ["folderId": .string("explicit Graph driveItem folder ID")], resultSchema: ["items": .string("up to 25 bounded child metadata records")]),
        ProviderActionTemplate(
            actionKey: "onedrive_item_get", displayName: "Get OneDrive item", summary: "Read bounded metadata for one explicit prior-result file or folder.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.oneDriveRelayOwnedOAuthScopes, capabilityKeys: ["item_get"], payloadSchema: ["itemId": .string("explicit Graph driveItem ID")], resultSchema: ["item": .string("named file/folder metadata without content or download URL")]),
        ProviderActionTemplate(
            actionKey: "onedrive_content_download_preview", displayName: "Read OneDrive file content", summary: "Download, preview, thumbnail, render, parse, or access Office workbook/document content.", kind: .read, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["content", "download"], payloadSchema: [:], resultSchema: [:], blockedReason: "File bytes and content-derived surfaces are blocked in metadata-only V1."),
        ProviderActionTemplate(
            actionKey: "onedrive_shared_search_permissions", displayName: "Access broad OneDrive surfaces", summary: "Use shared items, remote items, search, recent, share tokens, versions, permissions, subscriptions, delta, or exports.", kind: .admin, riskLevel: .destructive,
            adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["shared", "search", "permissions"], payloadSchema: [:], resultSchema: [:], blockedReason: "Broad, shared and historical surfaces are blocked."),
        ProviderActionTemplate(
            actionKey: "onedrive_mutations", displayName: "Mutate OneDrive", summary: "Upload, create, rename, edit, move, copy, delete, restore, share, comment, lock, or change retention/labels.", kind: .write, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["writes"], payloadSchema: [:], resultSchema: [:], blockedReason: "All file and folder writes are blocked."),
        ProviderActionTemplate(
            actionKey: "onedrive_other_drives_admin_raw", displayName: "Access other Microsoft storage", summary: "Access other users, sites, groups, drives, SharePoint, application/selected/admin permissions, raw tools, or pagination.", kind: .admin, riskLevel: .destructive,
            adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["other_drives", "raw"], payloadSchema: [:], resultSchema: [:], blockedReason: "Only signed-in user's /me/drive metadata wrappers are allowed.")
    ]

    private static let sharePointTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "sharepoint_site_get", displayName: "Get selected SharePoint site", summary: "Read bounded metadata for the connection-bound administrator-granted site.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.sharePointRelayOwnedOAuthScopes, capabilityKeys: ["site_get"], payloadSchema: [:], resultSchema: ["site": .string("selected site name, description, URL and timestamps")]),
        ProviderActionTemplate(
            actionKey: "sharepoint_lists_list", displayName: "List SharePoint lists", summary: "Read the first 25 list metadata records without items or fields.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.sharePointRelayOwnedOAuthScopes, capabilityKeys: ["lists_list"], payloadSchema: [:], resultSchema: ["lists": .string("up to 25 named list metadata records")]),
        ProviderActionTemplate(
            actionKey: "sharepoint_drives_list", displayName: "List SharePoint document libraries", summary: "Read the first 25 document-library drive metadata records.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.sharePointRelayOwnedOAuthScopes, capabilityKeys: ["drives_list"], payloadSchema: [:], resultSchema: ["drives": .string("up to 25 named library metadata records")]),
        ProviderActionTemplate(
            actionKey: "sharepoint_default_library_root_list", displayName: "List default library root", summary: "Read the first 25 named file/folder metadata records in the selected site's default library root.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: ProviderConnectionService.sharePointRelayOwnedOAuthScopes, capabilityKeys: ["root_list"], payloadSchema: [:], resultSchema: ["items": .string("up to 25 metadata-only root items")]),
        ProviderActionTemplate(
            actionKey: "sharepoint_tenant_content", displayName: "Search or read SharePoint content", summary: "Search sites/tenant, read list items/fields/pages or file content/downloads.", kind: .read, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["search", "content"], payloadSchema: [:], resultSchema: [:], blockedReason: "Tenant discovery and content are outside selected-site metadata V1."),
        ProviderActionTemplate(
            actionKey: "sharepoint_people_permissions", displayName: "Access SharePoint identities or permissions", summary: "Read people, groups, owners, permissions, sharing, analytics, versions, delta, or subscriptions.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported,
            defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["permissions", "people"], payloadSchema: [:], resultSchema: [:], blockedReason: "Identity, permission and history surfaces are blocked."),
        ProviderActionTemplate(
            actionKey: "sharepoint_mutations", displayName: "Mutate SharePoint", summary: "Create, update, delete, upload, share, move, copy, publish, administer, or change grants.", kind: .write, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["writes"], payloadSchema: [:], resultSchema: [:], blockedReason: "All SharePoint writes and administration are blocked."),
        ProviderActionTemplate(
            actionKey: "sharepoint_other_sites_raw", displayName: "Access other sites or raw Graph", summary: "Use other sites/drives, broad/application scopes, raw endpoints, exports, or pagination.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["other_sites", "raw"], payloadSchema: [:], resultSchema: [:], blockedReason: "Only one connection-bound selected site is allowed.")
    ]

    private static let microsoftPlannerTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "microsoft_planner_assigned_tasks_list", displayName: "List my Planner tasks", summary: "Read the first 25 tasks assigned to the signed-in work account.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.microsoftPlannerRelayOwnedOAuthScopes, capabilityKeys: ["assigned_tasks"], payloadSchema: [:], resultSchema: ["tasks": .string("up to 25 privacy-bounded task records")]),
        ProviderActionTemplate(
            actionKey: "microsoft_planner_task_get", displayName: "Get Planner task", summary: "Read one explicit Planner task returned by a prior wrapper.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.microsoftPlannerRelayOwnedOAuthScopes, capabilityKeys: ["task_get"], payloadSchema: ["taskId": .string("explicit prior-result Planner task ID")], resultSchema: ["task": .string("bounded task metadata without assignment identities or details")]),
        ProviderActionTemplate(
            actionKey: "microsoft_planner_plan_get", displayName: "Get Planner plan", summary: "Read one explicit Planner plan returned through visible task context.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.microsoftPlannerRelayOwnedOAuthScopes, capabilityKeys: ["plan_get"], payloadSchema: ["planId": .string("explicit prior-result Planner plan ID")], resultSchema: ["plan": .string("bounded plan metadata without group-directory lookup")]),
        ProviderActionTemplate(
            actionKey: "microsoft_planner_plan_tasks_list", displayName: "List Planner plan tasks", summary: "Read the first 25 tasks for one explicit prior-result plan.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.microsoftPlannerRelayOwnedOAuthScopes, capabilityKeys: ["plan_tasks"], payloadSchema: ["planId": .string("explicit prior-result Planner plan ID")], resultSchema: ["tasks": .string("up to 25 privacy-bounded task records")]),
        ProviderActionTemplate(
            actionKey: "microsoft_planner_assignment_identities", displayName: "Read Planner assignment identities", summary: "Read assignment user IDs or resolve people and profile information.", kind: .read, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["assignment_identities"], payloadSchema: [:], resultSchema: [:], blockedReason: "Assignment identities and directory resolution are excluded."),
        ProviderActionTemplate(
            actionKey: "microsoft_planner_task_details", displayName: "Read Planner task details", summary: "Read descriptions, checklists, references, attachments, or detailed assignment data.", kind: .read, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["details"], payloadSchema: [:], resultSchema: [:], blockedReason: "Planner task details, checklists and references are excluded."),
        ProviderActionTemplate(
            actionKey: "microsoft_planner_groups_directory", displayName: "Access Planner groups or directory", summary: "Discover groups, members, users, plans, buckets, rosters, or containers.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["groups", "directory"], payloadSchema: [:], resultSchema: [:], blockedReason: "Group and directory discovery are outside explicit task/plan V1."),
        ProviderActionTemplate(
            actionKey: "microsoft_planner_mutations", displayName: "Mutate Planner", summary: "Create, update, assign, complete, reorder, move, or delete Planner resources.", kind: .write, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["writes"], payloadSchema: [:], resultSchema: [:], blockedReason: "All Planner writes are blocked."),
        ProviderActionTemplate(
            actionKey: "microsoft_planner_application_all_users", displayName: "Use broad Planner authority", summary: "Use application permissions, all-user access, admin impersonation, or another account.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported,
            defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["application_permissions"], payloadSchema: [:], resultSchema: [:], blockedReason: "Only delegated Tasks.Read for the signed-in work account is allowed."),
        ProviderActionTemplate(
            actionKey: "microsoft_planner_raw_pagination", displayName: "Use raw Planner Graph", summary: "Invoke raw Graph endpoints, exports, page tokens, automatic pagination, retries, or polling.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["raw", "pagination"], payloadSchema: [:], resultSchema: [:], blockedReason: "Raw access and automatic pagination are blocked.")
    ]

    private static let microsoftToDoTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "microsoft_todo_task_lists_list", displayName: "List my To Do task lists", summary: "Read the first 25 task-list metadata records for the signed-in user.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.microsoftToDoRelayOwnedOAuthScopes, capabilityKeys: ["task_lists"], payloadSchema: [:], resultSchema: ["taskLists": .string("up to 25 task-list metadata records")]),
        ProviderActionTemplate(
            actionKey: "microsoft_todo_task_list_get", displayName: "Get To Do task list", summary: "Read one explicit prior-result task list.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.microsoftToDoRelayOwnedOAuthScopes, capabilityKeys: ["task_list_get"], payloadSchema: ["taskListId": .string("explicit prior-result task-list ID")], resultSchema: ["taskList": .string("bounded task-list metadata")]),
        ProviderActionTemplate(
            actionKey: "microsoft_todo_tasks_list", displayName: "List To Do tasks", summary: "Read the first 25 tasks in one explicit prior-result list.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.microsoftToDoRelayOwnedOAuthScopes, capabilityKeys: ["tasks_list"], payloadSchema: ["taskListId": .string("explicit prior-result task-list ID")], resultSchema: ["tasks": .string("up to 25 bounded task metadata records")]),
        ProviderActionTemplate(
            actionKey: "microsoft_todo_task_get", displayName: "Get To Do task", summary: "Read one explicit prior-result task in its explicit list.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.microsoftToDoRelayOwnedOAuthScopes, capabilityKeys: ["task_get"], payloadSchema: ["taskListId": .string("explicit prior-result task-list ID"), "taskId": .string("explicit prior-result task ID")],
            resultSchema: ["task": .string("bounded task metadata without body or related content")]),
        ProviderActionTemplate(
            actionKey: "microsoft_todo_task_bodies_categories", displayName: "Read To Do task content", summary: "Read task bodies, notes, categories, or custom properties.", kind: .read, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["content"], payloadSchema: [:], resultSchema: [:], blockedReason: "Task bodies and categories are privacy-excluded."),
        ProviderActionTemplate(
            actionKey: "microsoft_todo_related_content", displayName: "Read To Do related content", summary: "Read checklist items, linked resources, attachments, or source links.", kind: .read, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["related_content"], payloadSchema: [:], resultSchema: [:], blockedReason: "Related content and attachments are excluded."),
        ProviderActionTemplate(
            actionKey: "microsoft_todo_shared_tasks", displayName: "Expand shared To Do tasks", summary: "Use shared-task scopes or enumerate collaborators.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["shared"], payloadSchema: [:], resultSchema: [:], blockedReason: "Shared-task expansion and collaborator identity are excluded."),
        ProviderActionTemplate(
            actionKey: "microsoft_todo_delta_extensions", displayName: "Sync To Do changes", summary: "Use delta, open extensions, change tracking, or local mirroring.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["delta", "extensions"], payloadSchema: [:], resultSchema: [:], blockedReason: "Delta synchronization and extensions are blocked."),
        ProviderActionTemplate(
            actionKey: "microsoft_todo_mutations", displayName: "Mutate Microsoft To Do", summary: "Create, update, complete, move, reorder, or delete lists, tasks, checklists, or links.", kind: .write, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["writes"], payloadSchema: [:], resultSchema: [:], blockedReason: "All Microsoft To Do writes are blocked."),
        ProviderActionTemplate(
            actionKey: "microsoft_todo_application_other_users", displayName: "Use broad To Do authority", summary: "Use application/all-user permissions, admin impersonation, or another user.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["application_permissions"], payloadSchema: [:], resultSchema: [:], blockedReason: "Only delegated signed-in-user Tasks.Read is allowed."),
        ProviderActionTemplate(
            actionKey: "microsoft_todo_raw_pagination", displayName: "Use raw To Do Graph", summary: "Use OData customization, raw endpoints, exports, page tokens, retries, polling, or automatic pagination.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported,
            defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["raw", "pagination"], payloadSchema: [:], resultSchema: [:], blockedReason: "Raw access and automatic pagination are blocked.")
    ]

    private static let microsoftListsTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "microsoft_lists_list_get", displayName: "Get selected Microsoft List", summary: "Read bounded metadata for the connection-bound administrator-granted list.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.microsoftListsRelayOwnedOAuthScopes, capabilityKeys: ["list_get"], payloadSchema: [:], resultSchema: ["list": .string("selected list metadata")]),
        ProviderActionTemplate(
            actionKey: "microsoft_lists_columns_list", displayName: "List approved Microsoft List columns", summary: "Read schema metadata only for the connection-approved field names.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.microsoftListsRelayOwnedOAuthScopes, capabilityKeys: ["columns_list"], payloadSchema: [:], resultSchema: ["columns": .string("approved column metadata")]),
        ProviderActionTemplate(
            actionKey: "microsoft_lists_items_list", displayName: "List Microsoft List items", summary: "Read the first 25 items with only connection-approved fields.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.microsoftListsRelayOwnedOAuthScopes, capabilityKeys: ["items_list"], payloadSchema: [:], resultSchema: ["items": .string("up to 25 allowlisted-field items")]),
        ProviderActionTemplate(
            actionKey: "microsoft_lists_item_get", displayName: "Get Microsoft List item", summary: "Read one explicit prior-result item with only connection-approved fields.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.microsoftListsRelayOwnedOAuthScopes, capabilityKeys: ["item_get"], payloadSchema: ["itemId": .string("explicit prior-result list item ID")], resultSchema: ["item": .string("allowlisted-field item metadata")]),
        ProviderActionTemplate(
            actionKey: "microsoft_lists_other_lists_sites", displayName: "Access other lists or sites", summary: "Discover or access any site/list outside the connection-bound grant.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["other_lists"], payloadSchema: [:], resultSchema: [:], blockedReason: "Only one administrator-granted list is allowed."),
        ProviderActionTemplate(
            actionKey: "microsoft_lists_unapproved_fields", displayName: "Read unapproved list fields", summary: "Read arbitrary, hidden, system, person, lookup, location, or other unapproved fields.", kind: .read, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["fields"], payloadSchema: [:], resultSchema: [:], blockedReason: "Only connection-approved field names may be returned."),
        ProviderActionTemplate(
            actionKey: "microsoft_lists_attachments_drive", displayName: "Read list attachments or drive content", summary: "Read attachments, document bytes, drive items, previews, thumbnails, or versions.", kind: .read, riskLevel: .destructive, adapterKind: .unsupported,
            defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["attachments"], payloadSchema: [:], resultSchema: [:], blockedReason: "Attachments and drive content are excluded."),
        ProviderActionTemplate(
            actionKey: "microsoft_lists_identities_permissions", displayName: "Access list identities or permissions", summary: "Read users, groups, created-by/modified-by identities, permissions, sharing, or analytics.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported,
            defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["permissions"], payloadSchema: [:], resultSchema: [:], blockedReason: "Identity and permission surfaces are excluded."),
        ProviderActionTemplate(
            actionKey: "microsoft_lists_mutations", displayName: "Mutate Microsoft Lists", summary: "Create, update, delete, move, share, approve, or administer lists, columns, items, views, or content types.", kind: .write, riskLevel: .destructive, adapterKind: .unsupported,
            defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["writes"], payloadSchema: [:], resultSchema: [:], blockedReason: "All Microsoft Lists writes are blocked."),
        ProviderActionTemplate(
            actionKey: "microsoft_lists_delta_search_export", displayName: "Sync or export Microsoft Lists", summary: "Use delta, search, broad filters, subscriptions, exports, or automatic pagination.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["delta", "export"], payloadSchema: [:], resultSchema: [:], blockedReason: "Synchronization, search, exports and pagination are blocked."),
        ProviderActionTemplate(
            actionKey: "microsoft_lists_application_raw", displayName: "Use broad or raw Lists access", summary: "Use application/all-site permissions, raw endpoints, beta APIs, arbitrary OData, retries, or polling.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported,
            defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["raw"], payloadSchema: [:], resultSchema: [:], blockedReason: "Only exact delegated selected-list wrappers are allowed.")
    ]

    private static let oneNoteTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "onenote_notebooks_list", displayName: "List my OneNote notebooks", summary: "Read the first 25 notebook metadata records for the signed-in user.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.oneNoteRelayOwnedOAuthScopes, capabilityKeys: ["notebooks"], payloadSchema: [:], resultSchema: ["notebooks": .string("up to 25 notebook metadata records")]),
        ProviderActionTemplate(
            actionKey: "onenote_notebook_sections_list", displayName: "List OneNote notebook sections", summary: "Read the first 25 sections in one explicit prior-result notebook.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.oneNoteRelayOwnedOAuthScopes, capabilityKeys: ["sections"], payloadSchema: ["notebookId": .string("explicit prior-result notebook ID")], resultSchema: ["sections": .string("up to 25 section metadata records")]),
        ProviderActionTemplate(
            actionKey: "onenote_section_pages_list", displayName: "List OneNote section pages", summary: "Read the first 25 page metadata records in one explicit prior-result section.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.oneNoteRelayOwnedOAuthScopes, capabilityKeys: ["pages"], payloadSchema: ["sectionId": .string("explicit prior-result section ID")], resultSchema: ["pages": .string("up to 25 page titles and timestamps without content")]),
        ProviderActionTemplate(
            actionKey: "onenote_page_get", displayName: "Get OneNote page metadata", summary: "Read metadata for one explicit prior-result page without fetching content.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.oneNoteRelayOwnedOAuthScopes, capabilityKeys: ["page_get"], payloadSchema: ["pageId": .string("explicit prior-result page ID")], resultSchema: ["page": .string("page title/order/timestamps without content")]),
        ProviderActionTemplate(
            actionKey: "onenote_page_content_preview", displayName: "Read OneNote page content", summary: "Fetch HTML/content URLs, previews, body text, tags, or embedded data.", kind: .read, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["content"], payloadSchema: [:], resultSchema: [:], blockedReason: "Page content and previews are excluded from metadata-only V1."),
        ProviderActionTemplate(
            actionKey: "onenote_resources_media_ocr", displayName: "Read OneNote resources or media", summary: "Read images, files, audio/video, OCR, business-card, recipe, or product captures.", kind: .read, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["resources"], payloadSchema: [:], resultSchema: [:], blockedReason: "Media, resources and content-derived data are excluded."),
        ProviderActionTemplate(
            actionKey: "onenote_shared_group_site", displayName: "Access shared or organizational notebooks", summary: "Access other users, shared notebooks, groups, SharePoint sites, or tenant notebooks.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported,
            defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["shared"], payloadSchema: [:], resultSchema: [:], blockedReason: "Only signed-in-user /me OneNote metadata is allowed."),
        ProviderActionTemplate(
            actionKey: "onenote_search_class_staff", displayName: "Search or access special OneNote notebooks", summary: "Use full-text search, class notebooks, staff notebooks, or education APIs.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["search"], payloadSchema: [:], resultSchema: [:], blockedReason: "Search and class/staff surfaces are excluded."),
        ProviderActionTemplate(
            actionKey: "onenote_mutations_copy", displayName: "Mutate OneNote", summary: "Create, update, delete, copy, move, share, or append notebooks, sections, pages, or content.", kind: .write, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["writes"], payloadSchema: [:], resultSchema: [:], blockedReason: "All OneNote writes and copy operations are blocked."),
        ProviderActionTemplate(
            actionKey: "onenote_permissions_webhooks", displayName: "Administer OneNote", summary: "Manage permissions, subscriptions, webhooks, operations, or sharing.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["admin"], payloadSchema: [:], resultSchema: [:], blockedReason: "Permissions, sharing, webhooks and operations are blocked."),
        ProviderActionTemplate(
            actionKey: "onenote_application_raw_pagination", displayName: "Use broad or raw OneNote access", summary: "Use application scopes, Notes.Read.All, raw/beta endpoints, OData customization, exports, retries, polling, or automatic pagination.", kind: .admin, riskLevel: .destructive,
            adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["raw"], payloadSchema: [:], resultSchema: [:], blockedReason: "Only exact delegated Notes.Read wrappers are allowed.")
    ]
    private static let microsoftBookingsTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "microsoft_bookings_business_get", displayName: "Get selected Bookings business", summary: "Read privacy-bounded metadata for the selected Bookings business.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.microsoftBookingsRelayOwnedOAuthScopes, capabilityKeys: ["business"], payloadSchema: [:], resultSchema: ["business": .string("selected business metadata without contact/address data")]),
        ProviderActionTemplate(
            actionKey: "microsoft_bookings_services_list", displayName: "List Bookings services", summary: "Read the first 25 services for the selected business.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.microsoftBookingsRelayOwnedOAuthScopes, capabilityKeys: ["services"], payloadSchema: [:], resultSchema: ["services": .string("up to 25 useful service metadata records")]),
        ProviderActionTemplate(
            actionKey: "microsoft_bookings_service_get", displayName: "Get Bookings service", summary: "Read one explicit prior-result service without notes or staff.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.microsoftBookingsRelayOwnedOAuthScopes, capabilityKeys: ["service_get"], payloadSchema: ["serviceId": .string("explicit prior-result service ID")], resultSchema: ["service": .string("useful service metadata with sensitive fields excluded")]),
        ProviderActionTemplate(
            actionKey: "microsoft_bookings_calendar_view", displayName: "View Bookings schedule metadata", summary: "Read privacy-scrubbed occupied schedule metadata for an explicit range of at most seven days.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.microsoftBookingsRelayOwnedOAuthScopes, capabilityKeys: ["calendar_view"], payloadSchema: ["start": .string("ISO-8601 range start"), "end": .string("ISO-8601 range end, at most seven days later")],
            resultSchema: ["appointments": .string("up to 25 schedule records without customer/staff/contact/note/join data")]),
    ]
    private static let microsoftPowerBITemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "microsoft_power_bi_workspace_get", displayName: "Get selected Power BI workspace", summary: "Read safe metadata for the connection-bound workspace.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.microsoftPowerBIRelayOwnedOAuthScopes, capabilityKeys: ["workspace"], payloadSchema: [:], resultSchema: ["workspace": .string("selected workspace name and safe flags")]),
        ProviderActionTemplate(
            actionKey: "microsoft_power_bi_reports_list", displayName: "List Power BI reports", summary: "Read the first 25 report metadata records without URLs or content.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.microsoftPowerBIRelayOwnedOAuthScopes, capabilityKeys: ["reports"], payloadSchema: [:], resultSchema: ["reports": .string("up to 25 named report metadata records")]),
        ProviderActionTemplate(
            actionKey: "microsoft_power_bi_semantic_models_list", displayName: "List Power BI semantic models", summary: "Read the first 25 semantic-model metadata records without data or owner identity.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.microsoftPowerBIRelayOwnedOAuthScopes, capabilityKeys: ["semantic_models"], payloadSchema: [:], resultSchema: ["semanticModels": .string("up to 25 named semantic-model metadata records")]),
        ProviderActionTemplate(
            actionKey: "microsoft_power_bi_semantic_model_get", displayName: "Get Power BI semantic model", summary: "Read safe metadata for one explicit prior-result semantic model.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.microsoftPowerBIRelayOwnedOAuthScopes, capabilityKeys: ["semantic_model_get"], payloadSchema: ["semanticModelId": .string("explicit prior-result semantic-model ID")], resultSchema: ["semanticModel": .string("safe model name and status flags")]),
    ]
    private static let microsoftDynamics365Templates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "microsoft_dynamics_365_organization_get", displayName: "Get Dynamics organization", summary: "Read fixed safe metadata for the selected Dataverse organization.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: [],
            capabilityKeys: ["organization"], payloadSchema: [:], resultSchema: ["organization": .string("friendly and unique name, version, and language")]),
        ProviderActionTemplate(
            actionKey: "microsoft_dynamics_365_accounts_list", displayName: "List Dynamics accounts", summary: "Read up to 25 fixed-field business account summaries.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: [],
            capabilityKeys: ["accounts"], payloadSchema: [:], resultSchema: ["accounts": .string("named account commercial metadata without contacts, addresses, owners, or notes")]),
        ProviderActionTemplate(
            actionKey: "microsoft_dynamics_365_account_get", displayName: "Get Dynamics account", summary: "Read fixed fields for one explicit prior-result account.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: [],
            capabilityKeys: ["account_get"], payloadSchema: ["accountId": .string("explicit prior-result account ID")], resultSchema: ["account": .string("safe account commercial metadata")]),
        ProviderActionTemplate(
            actionKey: "microsoft_dynamics_365_opportunities_list", displayName: "List Dynamics opportunities", summary: "Read up to 25 fixed-field opportunity pipeline summaries.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: [],
            capabilityKeys: ["opportunities"], payloadSchema: [:], resultSchema: ["opportunities": .string("named opportunity values, dates, probabilities, stages, and statuses without customer or owner lookups")]),
    ]
    private static let microsoftVivaEngageTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "microsoft_viva_engage_network_get", displayName: "Get Viva Engage network", summary: "Read safe metadata for the connected current network.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.microsoftVivaEngageRelayOwnedOAuthScopes, capabilityKeys: ["network"], payloadSchema: [:], resultSchema: ["network": .string("network name and safe permalink")]),
        ProviderActionTemplate(
            actionKey: "microsoft_viva_engage_current_user_get", displayName: "Get current Viva Engage user", summary: "Read the bound signed-in user's display name without email or profile details.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.microsoftVivaEngageRelayOwnedOAuthScopes, capabilityKeys: ["current_user"], payloadSchema: [:], resultSchema: ["currentUser": .string("identity-minimized signed-in user")]),
        ProviderActionTemplate(
            actionKey: "microsoft_viva_engage_my_communities_list", displayName: "List my Viva Engage communities", summary: "Read up to 25 communities joined by the bound current user.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.microsoftVivaEngageRelayOwnedOAuthScopes, capabilityKeys: ["communities"], payloadSchema: [:], resultSchema: ["communities": .string("named community summaries without member identities")]),
        ProviderActionTemplate(
            actionKey: "microsoft_viva_engage_selected_community_messages_list", displayName: "List selected-community conversations", summary: "Read up to 25 bounded recent conversation summaries from the selected community.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI,
            defaultPermission: .allowed, requiredScopes: ProviderConnectionService.microsoftVivaEngageRelayOwnedOAuthScopes, capabilityKeys: ["selected_community_messages"], payloadSchema: [:],
            resultSchema: ["messages": .string("bounded useful message text and timestamps without identities or attachments")]),
    ]
    private static let zoomTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "zoom_scheduled_meetings_list", displayName: "List scheduled Zoom meetings", summary: "Read up to 25 safe scheduled meeting metadata records for the signed-in user.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.zoomRelayOwnedOAuthScopes, capabilityKeys: ["scheduled_meetings"], payloadSchema: [:], resultSchema: ["meetings": .string("safe topic and schedule metadata")]),
        ProviderActionTemplate(
            actionKey: "zoom_live_meetings_list", displayName: "List live Zoom meetings", summary: "Read up to 25 safe live meeting metadata records for the signed-in user.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.zoomRelayOwnedOAuthScopes, capabilityKeys: ["live_meetings"], payloadSchema: [:], resultSchema: ["meetings": .string("safe live meeting metadata")]),
        ProviderActionTemplate(
            actionKey: "zoom_upcoming_meetings_list", displayName: "List upcoming Zoom meetings", summary: "Read up to 25 safe next-24-hour meeting metadata records for the signed-in user.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.zoomRelayOwnedOAuthScopes, capabilityKeys: ["upcoming_meetings"], payloadSchema: [:], resultSchema: ["meetings": .string("safe upcoming meeting metadata")]),
        ProviderActionTemplate(
            actionKey: "zoom_meeting_get", displayName: "Get Zoom meeting", summary: "Read safe metadata for one explicit prior-result meeting ID.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.zoomRelayOwnedOAuthScopes, capabilityKeys: ["meeting_get"], payloadSchema: ["meetingId": .string("explicit numeric prior-result meeting ID")], resultSchema: ["meeting": .string("safe topic, schedule, type, status, and settings flags")]),
    ]
    private static let discordTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "discord_bot_get", displayName: "Get Relay Discord bot", summary: "Read the installed Relay bot's bounded identity.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: ProviderConnectionService.discordRelayOwnedOAuthScopes,
            capabilityKeys: ["bot_identity"], payloadSchema: [:], resultSchema: ["bot": .string("bounded bot identity")]),
        ProviderActionTemplate(
            actionKey: "discord_selected_guild_get", displayName: "Get selected Discord guild", summary: "Read safe metadata for the administrator-selected guild.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.discordRelayOwnedOAuthScopes, capabilityKeys: ["selected_guild"], payloadSchema: [:], resultSchema: ["guild": .string("selected guild metadata")]),
        ProviderActionTemplate(
            actionKey: "discord_selected_guild_channels_list", displayName: "List selected guild channels", summary: "Read up to 25 bounded channel metadata records from the selected guild.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.discordRelayOwnedOAuthScopes, capabilityKeys: ["selected_guild_channels"], payloadSchema: [:], resultSchema: ["channels": .string("bounded selected-guild channels")]),
        ProviderActionTemplate(
            actionKey: "discord_selected_channel_messages_list", displayName: "List selected channel messages", summary: "Read up to 25 recent text messages from the selected non-NSFW text channel.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.discordRelayOwnedOAuthScopes, capabilityKeys: ["selected_channel_messages"], payloadSchema: [:], resultSchema: ["messages": .string("privacy-shaped recent text messages")]),
    ]

    private static let googleAnalyticsTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "google_analytics_property_get", displayName: "Get GA4 property", summary: "Read safe metadata for the explicit connection-bound GA4 property.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.googleAnalyticsRelayOwnedOAuthScopes, capabilityKeys: ["property_get"], payloadSchema: ["propertyId": .string("numeric GA4 property ID")],
            resultSchema: ["property": .string("bounded property name, display name, time zone, currency, category, type, and service level")]),
        ProviderActionTemplate(
            actionKey: "google_analytics_overview_report", displayName: "Get GA4 overview", summary: "Run the fixed 30-day aggregate channel overview for the explicit property.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.googleAnalyticsRelayOwnedOAuthScopes, capabilityKeys: ["overview_report"], payloadSchema: ["propertyId": .string("numeric GA4 property ID")], resultSchema: ["rows": .string("at most 25 channel-group aggregate metric rows")]),
        ProviderActionTemplate(
            actionKey: "google_analytics_property_discovery", displayName: "Discover Analytics properties", summary: "List accounts, properties, data streams, or hierarchy.", kind: .read, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["property_discovery"], payloadSchema: [:], resultSchema: [:], blockedReason: "Account and property discovery are blocked in explicit-property V1."),
        ProviderActionTemplate(
            actionKey: "google_analytics_arbitrary_realtime_advanced_reports", displayName: "Run arbitrary or advanced Analytics reports", summary: "Supply custom dimensions, metrics, dates, filters, realtime, batch, pivot, funnel, access, metadata, or compatibility requests.", kind: .admin,
            riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["arbitrary_report", "realtime", "advanced_reports"], payloadSchema: [:], resultSchema: [:], blockedReason: "Only one fixed bounded aggregate report is permitted."),
        ProviderActionTemplate(
            actionKey: "google_analytics_audience_user_detail", displayName: "Access audience or user-level Analytics data", summary: "Export audiences or read user, demographic, interest, page, search, geography, custom dimension, or event-parameter detail.", kind: .read, riskLevel: .destructive,
            adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["audiences", "user_detail"], payloadSchema: [:], resultSchema: [:], blockedReason: "Audience and granular user/content detail are excluded."),
        ProviderActionTemplate(
            actionKey: "google_analytics_admin_mutation", displayName: "Mutate Analytics administration", summary: "Create or modify properties, streams, links, filters, events, dimensions, metrics, or settings.", kind: .write, riskLevel: .destructive, adapterKind: .unsupported,
            defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["admin_mutation"], payloadSchema: [:], resultSchema: [:], blockedReason: "Analytics administration is blocked in read-only V1."),
        ProviderActionTemplate(
            actionKey: "google_analytics_user_management", displayName: "Manage Analytics users", summary: "Read or modify account/property user access bindings.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["user_management"], payloadSchema: [:], resultSchema: [:], blockedReason: "User and access management are excluded."),
        ProviderActionTemplate(
            actionKey: "google_analytics_measurement_protocol_write", displayName: "Write Analytics events", summary: "Send Measurement Protocol events or import data.", kind: .write, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["measurement_protocol", "import"], payloadSchema: [:], resultSchema: [:], blockedReason: "Measurement and import writes are blocked."),
        ProviderActionTemplate(
            actionKey: "google_analytics_property_delete", displayName: "Delete Analytics resources", summary: "Delete, trash, or restore Analytics properties or resources.", kind: .delete, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["delete"], payloadSchema: [:], resultSchema: [:], blockedReason: "Destructive Analytics actions are blocked."),
        ProviderActionTemplate(
            actionKey: "google_analytics_export_all", displayName: "Export Analytics data", summary: "Create audience/report tasks, recurring exports, broad downloads, or automatic pagination.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["export", "pagination"], payloadSchema: [:], resultSchema: [:], blockedReason: "Exports and automatic pagination are blocked."),
        ProviderActionTemplate(
            actionKey: "google_analytics_raw_delegation", displayName: "Use raw or delegated Analytics access", summary: "Invoke raw tools, service accounts, delegation, automatic retries, or polling.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["raw_api", "delegation"], payloadSchema: [:], resultSchema: [:], blockedReason: "Raw, automatic, and delegated access is blocked.")
    ]

    private static let googleFormsTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "google_forms_form_get", displayName: "Get form structure", summary: "Read bounded structure from one explicit app-visible Form without responses.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.googleFormsRelayOwnedOAuthScopes, capabilityKeys: ["get_form"], payloadSchema: ["formId": .string("string")], resultSchema: ["form": .string("bounded Form/Item/question structure; no responses")]),
        ProviderActionTemplate(
            actionKey: "google_forms_update_prepare", displayName: "Prepare form update", summary: "Validate an unpublished Form or typed question creation locally.", kind: .draft, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: [],
            capabilityKeys: ["prepare_update"], payloadSchema: ["operation": .string("form_create or question_create"), "formId": .string("optional string"), "title": .string("bounded string")], resultSchema: ["draftPreview": .string("non-mutating preview")]),
        ProviderActionTemplate(
            actionKey: "google_forms_form_create", displayName: "Create unpublished form", summary: "Create one unpublished Form through approval or Direct writes.", kind: .write, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ProviderConnectionService.googleFormsRelayOwnedOAuthScopes, capabilityKeys: ["create_form"], payloadSchema: ["title": .string("bounded string"), "documentTitle": .string("optional bounded string")], resultSchema: ["form": .string("created unpublished Form metadata")]),
        ProviderActionTemplate(
            actionKey: "google_forms_question_create", displayName: "Create form question", summary: "Create one typed text or choice question through approval or Direct writes.", kind: .write, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ProviderConnectionService.googleFormsRelayOwnedOAuthScopes, capabilityKeys: ["create_question"],
            payloadSchema: ["formId": .string("string"), "title": .string("bounded string"), "questionType": .string("text or choice"), "options": .string("optional 1-50 strings"), "requiredRevisionId": .string("optional string")], resultSchema: ["response": .string("bounded createItem response")]),
        ProviderActionTemplate(
            actionKey: "google_forms_responses", displayName: "Read form responses", summary: "Read responses, identities, answers, grades, or uploaded files.", kind: .read, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["list_responses", "get_response"], payloadSchema: [:], resultSchema: [:], blockedReason: "All Form responses and respondent data are blocked in V1."),
        ProviderActionTemplate(
            actionKey: "google_forms_watches", displayName: "Form watches", summary: "Create, renew, list, or delete response watches.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["watches"], payloadSchema: [:],
            resultSchema: [:], blockedReason: "Forms watches are blocked in V1."),
        ProviderActionTemplate(
            actionKey: "google_forms_publish_responders", displayName: "Publish or manage responders", summary: "Publish Forms, change accepting-response state, or manage responders.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["publish", "responders"], payloadSchema: [:], resultSchema: [:], blockedReason: "Publishing and responder management are blocked in V1."),
        ProviderActionTemplate(
            actionKey: "google_forms_quiz_grading", displayName: "Quiz and grading settings", summary: "Change quiz, answer key, grading, email collection, or settings.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["quiz", "grading", "settings"], payloadSchema: [:], resultSchema: [:], blockedReason: "Quiz, grading, email collection, and Form settings are blocked in V1."),
        ProviderActionTemplate(
            actionKey: "google_forms_destructive_items", displayName: "Destructive Form item mutation", summary: "Delete, move, reorder, update, or create file-upload/media items.", kind: .delete, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["delete_item", "move_item", "file_upload"], payloadSchema: [:], resultSchema: [:], blockedReason: "Destructive item changes, media, and file-upload questions are blocked in V1."),
        ProviderActionTemplate(
            actionKey: "google_forms_arbitrary_batch", displayName: "Arbitrary Forms batch", summary: "Submit arbitrary Forms batchUpdate requests.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["raw_batch"],
            payloadSchema: [:], resultSchema: [:], blockedReason: "Arbitrary Forms batch requests are blocked in V1."),
        ProviderActionTemplate(
            actionKey: "google_forms_sharing_export_raw", displayName: "Sharing, export, linked data, or raw access", summary: "Access linked Sheets, sharing, export, raw APIs, or domain delegation.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["linked_sheet", "sharing", "export", "raw_api"], payloadSchema: [:], resultSchema: [:], blockedReason: "Linked Sheet, sharing, export, raw API, and domain delegation are blocked in V1.")
    ]

    private static let googleSlidesTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "google_slides_presentation_get", displayName: "Get presentation", summary: "Read bounded semantic content from one explicit app-visible presentation.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.googleSlidesRelayOwnedOAuthScopes, capabilityKeys: ["get_presentation"], payloadSchema: ["presentationId": .string("string")], resultSchema: ["presentation": .string("bounded title, slide IDs and semantic text")]),
        ProviderActionTemplate(
            actionKey: "google_slides_page_get", displayName: "Get presentation page", summary: "Read one bounded page from an explicit app-visible presentation.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.googleSlidesRelayOwnedOAuthScopes, capabilityKeys: ["get_page"], payloadSchema: ["presentationId": .string("string"), "pageObjectId": .string("string")], resultSchema: ["page": .string("bounded semantic shape text; no media")]),
        ProviderActionTemplate(
            actionKey: "google_slides_update_prepare", displayName: "Prepare presentation update", summary: "Validate an allowlisted update locally without calling Google.", kind: .draft, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: [],
            capabilityKeys: ["prepare_update"], payloadSchema: ["presentationId": .string("string"), "operation": .string("text_replace or slide_create")], resultSchema: ["draftPreview": .string("non-mutating normalized preview")]),
        ProviderActionTemplate(
            actionKey: "google_slides_text_replace", displayName: "Replace presentation text", summary: "Atomically replace bounded exact text through approval or Direct writes.", kind: .write, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ProviderConnectionService.googleSlidesRelayOwnedOAuthScopes, capabilityKeys: ["replace_text"],
            payloadSchema: ["presentationId": .string("string"), "matchText": .string("bounded string"), "replacementText": .string("bounded string"), "matchCase": .string("boolean"), "requiredRevisionId": .string("optional string")],
            resultSchema: ["response": .string("bounded atomic batch response")]),
        ProviderActionTemplate(
            actionKey: "google_slides_slide_create", displayName: "Create presentation slide", summary: "Create one allowlisted slide through approval or Direct writes.", kind: .write, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ProviderConnectionService.googleSlidesRelayOwnedOAuthScopes, capabilityKeys: ["create_slide"],
            payloadSchema: ["presentationId": .string("string"), "slideObjectId": .string("5-50 safe characters"), "layout": .string("allowlisted predefined layout"), "titleText": .string("optional bounded text")], resultSchema: ["response": .string("bounded atomic batch response")]),
        ProviderActionTemplate(
            actionKey: "google_slides_drive_discovery", displayName: "Discover presentations", summary: "List or search presentations across Drive.", kind: .search, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["drive_search", "list_presentations"], payloadSchema: [:], resultSchema: [:], blockedReason: "Whole-Drive presentation discovery is blocked; V1 accepts only explicit app-visible IDs."),
        ProviderActionTemplate(
            actionKey: "google_slides_delete_reorder_duplicate", displayName: "Delete, reorder, or duplicate objects", summary: "Delete, move, reorder, or duplicate slides and page elements.", kind: .delete, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["delete_object", "reorder_slides", "duplicate_object"], payloadSchema: [:], resultSchema: [:], blockedReason: "Destructive and structural presentation mutations are blocked in V1."),
        ProviderActionTemplate(
            actionKey: "google_slides_arbitrary_batch", displayName: "Arbitrary batch update", summary: "Submit arbitrary Slides batchUpdate subrequests.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["raw_batch_update"], payloadSchema: [:], resultSchema: [:], blockedReason: "Arbitrary batchUpdate requests are blocked; only typed allowlisted wrappers are exposed."),
        ProviderActionTemplate(
            actionKey: "google_slides_media_and_objects", displayName: "Media and advanced objects", summary: "Use thumbnails, images, video, charts, tables, lines, or WordArt.", kind: .write, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["media", "charts", "tables"], payloadSchema: [:], resultSchema: [:], blockedReason: "Media and advanced presentation objects are blocked in V1."),
        ProviderActionTemplate(
            actionKey: "google_slides_format_theme_master", displayName: "Formatting and presentation design", summary: "Change formatting, transforms, themes, masters, layouts, or speaker notes.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked,
            requiredScopes: [], capabilityKeys: ["formatting", "themes", "masters", "speaker_notes"], payloadSchema: [:], resultSchema: [:], blockedReason: "Formatting, design-system, and speaker-note mutations are blocked in V1."),
        ProviderActionTemplate(
            actionKey: "google_slides_sharing_export_raw", displayName: "Sharing, export, or raw access", summary: "Share, export, publish, call raw APIs, or use domain delegation.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["sharing", "export", "raw_api", "domain_delegation"], payloadSchema: [:], resultSchema: [:], blockedReason: "Sharing, export, publishing, raw calls, and domain delegation are blocked in V1.")
    ]

    private static let googleSheetsTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "google_sheets_spreadsheet_get", displayName: "Get spreadsheet metadata", summary: "Read bounded metadata for one explicit app-visible spreadsheet.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.googleSheetsRelayOwnedOAuthScopes, capabilityKeys: ["get_spreadsheet_metadata"], payloadSchema: ["spreadsheetId": .string("string")], resultSchema: ["spreadsheet": .string("bounded metadata; no grid data")]),
        ProviderActionTemplate(
            actionKey: "google_sheets_values_get", displayName: "Get spreadsheet values", summary: "Read a bounded explicit A1 range from one app-visible spreadsheet.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.googleSheetsRelayOwnedOAuthScopes, capabilityKeys: ["get_values"], payloadSchema: ["spreadsheetId": .string("string"), "range": .string("explicit A1 range")], resultSchema: ["valueRange": .string("at most 200 rows, 26 columns, 5,000 cells")]),
        ProviderActionTemplate(
            actionKey: "google_sheets_values_prepare", displayName: "Prepare spreadsheet values", summary: "Validate and preview a bounded update or append locally without calling Google.", kind: .draft, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: [],
            capabilityKeys: ["prepare_values"], payloadSchema: ["spreadsheetId": .string("string"), "range": .string("explicit A1 range"), "operation": .string("update or append"), "values": .string("bounded 2-D scalar array")],
            resultSchema: ["draftPreview": .string("non-mutating normalized preview")]),
        ProviderActionTemplate(
            actionKey: "google_sheets_values_update", displayName: "Update spreadsheet values", summary: "Update one explicit bounded A1 range through approval or Direct writes.", kind: .write, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ProviderConnectionService.googleSheetsRelayOwnedOAuthScopes, capabilityKeys: ["update_values"],
            payloadSchema: ["spreadsheetId": .string("string"), "range": .string("explicit A1 range"), "values": .string("bounded 2-D scalar array"), "valueInputOption": .string("RAW or USER_ENTERED")], resultSchema: ["response": .string("bounded update counts")]),
        ProviderActionTemplate(
            actionKey: "google_sheets_values_append", displayName: "Append spreadsheet values", summary: "Append bounded rows to one explicit logical-table range through approval or Direct writes.", kind: .write, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ProviderConnectionService.googleSheetsRelayOwnedOAuthScopes, capabilityKeys: ["append_values"],
            payloadSchema: ["spreadsheetId": .string("string"), "range": .string("explicit A1 logical-table range"), "values": .string("bounded 2-D scalar array"), "valueInputOption": .string("RAW or USER_ENTERED")], resultSchema: ["response": .string("bounded append counts")]),
        ProviderActionTemplate(
            actionKey: "google_sheets_list_spreadsheets", displayName: "List or discover spreadsheets", summary: "Discover spreadsheets across Google Drive.", kind: .search, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["list_spreadsheets", "drive_search"], payloadSchema: [:], resultSchema: [:], blockedReason: "Whole-Drive spreadsheet listing and discovery are blocked; Sheets has no list endpoint and V1 accepts only app-visible explicit IDs."),
        ProviderActionTemplate(
            actionKey: "google_sheets_clear_or_structure", displayName: "Clear or mutate spreadsheet structure", summary: "Clear cells or add, delete, copy, move, or resize sheets.", kind: .delete, riskLevel: .destructive, adapterKind: .unsupported, defaultPermission: .blocked, requiredScopes: [],
            capabilityKeys: ["clear_values", "batch_update", "delete_sheet"], payloadSchema: [:], resultSchema: [:], blockedReason: "Clear and structural spreadsheet mutations are blocked in V1."),
        ProviderActionTemplate(
            actionKey: "google_sheets_formatting_and_objects", displayName: "Formatting and spreadsheet objects", summary: "Change formatting, protected or named ranges, charts, pivots, filters, metadata, or external data.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported,
            defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["formatting", "charts", "protected_ranges", "developer_metadata"], payloadSchema: [:], resultSchema: [:], blockedReason: "Formatting and advanced spreadsheet objects are blocked in V1."),
        ProviderActionTemplate(
            actionKey: "google_sheets_external_or_raw_access", displayName: "Sharing, export, scripts, or raw access", summary: "Share, export, run macros or Apps Script, use raw endpoints, or domain-wide delegation.", kind: .admin, riskLevel: .destructive, adapterKind: .unsupported,
            defaultPermission: .blocked, requiredScopes: [], capabilityKeys: ["sharing", "export", "apps_script", "raw_api", "domain_delegation"], payloadSchema: [:], resultSchema: [:], blockedReason: "Sharing, exports, scripts, raw calls, and domain-wide delegation are blocked in V1.")
    ]

    private static let googleDriveTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "google_drive_search_files",
            displayName: "Search files",
            summary: "Search the bounded app-visible drive.file corpus and return metadata-only summaries.",
            kind: .search,
            riskLevel: .medium,
            adapterKind: .nativeAPI,
            defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.googleDriveRelayOwnedOAuthScopes,
            capabilityKeys: ["search_files"],
            payloadSchema: [
                "query": .string("string"),
                "mimeTypes": .string("optional array"),
                "corpus": .string("fixed: Relay-created or explicitly selected/opened files"),
                "modifiedAfter": .string("optional ISO-8601 timestamp"),
                "maxResults": .string("optional integer 1-10"),
                "includeTrashed": .string("optional boolean, defaults false")
            ],
            resultSchema: [
                "files": .string("array with id, name, MIME type, web link, owners/creator context, parent/location context, modified time, and trashed state"),
                "automaticPagination": .string("false")
            ]
        ),
        ProviderActionTemplate(
            actionKey: "google_drive_get_file_metadata",
            displayName: "Get file metadata",
            summary: "Retrieve metadata for one file already present in Relay's app-visible drive.file corpus.",
            kind: .read,
            riskLevel: .medium,
            adapterKind: .nativeAPI,
            defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.googleDriveRelayOwnedOAuthScopes,
            capabilityKeys: ["get_file_metadata"],
            payloadSchema: [
                "fileId": .string("string")
            ],
            resultSchema: [
                "file": .string("object with id, name, MIME type, web link, owners/creator context, parent/location context, modified time, size when available, and read/copy capability summary")
            ]
        ),
        ProviderActionTemplate(
            actionKey: "google_drive_read_file_content",
            displayName: "Read file content",
            summary: "Read a bounded text or Workspace export excerpt from an app-visible Google Drive file.",
            kind: .read,
            riskLevel: .medium,
            adapterKind: .nativeAPI,
            defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.googleDriveRelayOwnedOAuthScopes,
            capabilityKeys: ["read_file_content"],
            payloadSchema: [
                "fileId": .string("string"),
                "exportMimeType": .string("optional Google Workspace export MIME type"),
                "maxContentChars": .string("optional integer 1-8000"),
                "allowBinary": .string("must remain false in V1")
            ],
            resultSchema: [
                "file": .string("object with id, name, MIME type, export/download mode, modified time, bounded text excerpt, truncation flag, and unsupported-content reason when applicable")
            ]
        ),
        ProviderActionTemplate(
            actionKey: "google_drive_prepare_file",
            displayName: "Prepare file payload",
            summary: "Prepare a Google Drive create or copy payload locally without mutating Drive.",
            kind: .draft,
            riskLevel: .medium,
            adapterKind: .nativeAPI,
            defaultPermission: .allowed,
            requiredScopes: [],
            capabilityKeys: ["prepare_file_payload"],
            payloadSchema: [
                "operation": .string("create or copy"),
                "name": .string("string"),
                "parentId": .string("optional string"),
                "mimeType": .string("optional string"),
                "textContent": .string("optional bounded text"),
                "sourceFileId": .string("optional string for copy")
            ],
            resultSchema: [
                "draftPreview": .string("object with normalized payload preview and exact payload hash")
            ]
        ),
        ProviderActionTemplate(
            actionKey: "google_drive_create_file",
            displayName: "Create file",
            summary: "Create a Google Drive file or folder according to Relay approval or Direct writes policy.",
            kind: .write,
            riskLevel: .high,
            adapterKind: .nativeAPI,
            defaultPermission: .approvalRequired,
            requiredScopes: ["https://www.googleapis.com/auth/drive.file"],
            capabilityKeys: ["create_file"],
            payloadSchema: [
                "name": .string("string"),
                "parentId": .string("optional string"),
                "mimeType": .string("string"),
                "textContent": .string("optional bounded text content"),
                "approvalPayloadHash": .string("optional exact payload hash")
            ],
            resultSchema: [
                "fileId": .string("string"),
                "name": .string("string"),
                "webViewLink": .string("optional string"),
                "payloadHash": .string("string"),
                "auditId": .string("string")
            ]
        ),
        ProviderActionTemplate(
            actionKey: "google_drive_copy_file",
            displayName: "Copy file",
            summary: "Copy a selected Google Drive file according to Relay approval or Direct writes policy.",
            kind: .write,
            riskLevel: .high,
            adapterKind: .nativeAPI,
            defaultPermission: .approvalRequired,
            requiredScopes: ["https://www.googleapis.com/auth/drive.file"],
            capabilityKeys: ["copy_file"],
            payloadSchema: [
                "sourceFileId": .string("string"),
                "name": .string("string"),
                "parentId": .string("optional string"),
                "approvalPayloadHash": .string("optional exact payload hash")
            ],
            resultSchema: [
                "fileId": .string("string"),
                "name": .string("string"),
                "sourceFileId": .string("string"),
                "webViewLink": .string("optional string"),
                "payloadHash": .string("string"),
                "auditId": .string("string")
            ]
        ),
        ProviderActionTemplate(
            actionKey: "google_drive_delete_file",
            displayName: "Delete or trash file",
            summary: "Delete, trash, untrash, or permanently erase Google Drive files or folders.",
            kind: .delete,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["delete_file", "trash_file", "erase_file"],
            payloadSchema: ["fileId": .string("string")],
            resultSchema: [:],
            blockedReason: "Google Drive delete, trash, untrash, and permanent erase actions are blocked in V1."
        ),
        ProviderActionTemplate(
            actionKey: "google_drive_share_file",
            displayName: "Share or change permissions",
            summary: "Share Google Drive files, change permissions, publish, or transfer ownership.",
            kind: .admin,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["share_file", "change_permissions", "transfer_ownership"],
            payloadSchema: ["fileId": .string("string"), "permission": .string("object")],
            resultSchema: [:],
            blockedReason: "Google Drive sharing, permission changes, publishing, and ownership transfer are blocked in V1."
        ),
        ProviderActionTemplate(
            actionKey: "google_drive_export_all",
            displayName: "Broad export or sync",
            summary: "Export, crawl, or sync broad Google Drive content.",
            kind: .read,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["broad_export", "drive_sync", "crawl_drive"],
            payloadSchema: ["query": .string("optional string"), "destination": .string("optional string")],
            resultSchema: [:],
            blockedReason: "Broad Google Drive export, crawl, and sync actions are blocked by the V1 privacy and context-budget policy."
        ),
        ProviderActionTemplate(
            actionKey: "google_drive_update_file",
            displayName: "Update existing file",
            summary: "Update existing Google Drive file content, metadata, comments, revisions, labels, or activity.",
            kind: .write,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["update_file", "modify_metadata", "manage_comments", "manage_revisions"],
            payloadSchema: ["fileId": .string("string"), "changes": .string("object")],
            resultSchema: [:],
            blockedReason: "Google Drive update, metadata-write, comments, revisions, labels, and activity actions are deferred from V1."
        ),
        ProviderActionTemplate(
            actionKey: "google_drive_raw_mcp_call",
            displayName: "Raw MCP call",
            summary: "Expose or invoke raw Google Drive MCP tools directly.",
            kind: .admin,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["raw_mcp"],
            payloadSchema: ["toolName": .string("string"), "arguments": .string("object")],
            resultSchema: [:],
            blockedReason: "Raw Google Drive MCP exposure is blocked; agents may receive only Relay policy-scoped wrappers."
        ),
        ProviderActionTemplate(
            actionKey: "google_drive_domain_wide_delegation",
            displayName: "Domain-wide delegation",
            summary: "Use service-account, admin, or domain-wide-delegation access to Google Drive.",
            kind: .admin,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["service_account", "domain_wide_delegation", "workspace_admin"],
            payloadSchema: ["serviceAccount": .string("object")],
            resultSchema: [:],
            blockedReason: "Google Drive service accounts, Workspace admin access, and domain-wide delegation are out of scope for the Relay-owned OAuth Drive route."
        )
    ]

    private static let googleSearchConsoleTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "google_search_console_properties_list",
            displayName: "List properties",
            summary: "List Google Search Console properties accessible to the connected Google account.",
            kind: .read,
            riskLevel: .medium,
            adapterKind: .nativeAPI,
            defaultPermission: .allowed,
            requiredScopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
            capabilityKeys: ["list_properties", "property_discovery", "search_console_read"],
            payloadSchema: [
                "maxResults": .string("optional integer 1-25, defaults 25")
            ],
            resultSchema: [
                "properties": .string("array with siteUrl, inferred property type, permissionLevel, account label, and truncation metadata"),
                "propertyCount": .string("integer"),
                "truncated": .string("boolean")
            ]
        ),
        ProviderActionTemplate(
            actionKey: "google_search_console_property_get",
            displayName: "Get property",
            summary: "Confirm access and permission level for one Search Console property.",
            kind: .read,
            riskLevel: .medium,
            adapterKind: .nativeAPI,
            defaultPermission: .allowed,
            requiredScopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
            capabilityKeys: ["get_property", "property_permission_read", "search_console_read"],
            payloadSchema: [
                "siteUrl": .string("optional Search Console siteUrl or sc-domain property, defaults to selected property")
            ],
            resultSchema: [
                "property": .string("object with siteUrl, inferred property type, permissionLevel, selected connection/account label, and access status")
            ]
        ),
        ProviderActionTemplate(
            actionKey: "google_search_console_search_analytics_query",
            displayName: "Query Search Analytics",
            summary: "Query bounded Search Console Search Analytics rows for a selected property and date range.",
            kind: .read,
            riskLevel: .medium,
            adapterKind: .nativeAPI,
            defaultPermission: .allowed,
            requiredScopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
            capabilityKeys: ["query_search_analytics", "search_performance_read", "semantic_search_console_read"],
            payloadSchema: [
                "siteUrl": .string("optional Search Console siteUrl, defaults to selected property"),
                "startDate": .string("YYYY-MM-DD, bounded"),
                "endDate": .string("YYYY-MM-DD, bounded"),
                "dimensions": .string("optional array from query, page, date, country, device, searchAppearance"),
                "searchType": .string("optional web, image, video, news, discover, or googleNews"),
                "rowLimit": .string("optional integer 1-25"),
                "aggregationType": .string("optional auto, byPage, byProperty")
            ],
            resultSchema: [
                "rows": .string("array with dimension keys, clicks, impressions, ctr, and position"),
                "dateRange": .string("object"),
                "searchType": .string("string"),
                "aggregationType": .string("string"),
                "truncated": .string("boolean")
            ]
        ),
        ProviderActionTemplate(
            actionKey: "google_search_console_url_inspect",
            displayName: "Inspect URL",
            summary: "Inspect one URL's Google index status under the selected Search Console property.",
            kind: .read,
            riskLevel: .medium,
            adapterKind: .nativeAPI,
            defaultPermission: .allowed,
            requiredScopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
            capabilityKeys: ["inspect_url", "index_status_read", "semantic_search_console_read"],
            payloadSchema: [
                "siteUrl": .string("optional Search Console siteUrl, defaults to selected property"),
                "inspectionUrl": .string("URL under the selected Search Console property"),
                "languageCode": .string("optional BCP-47 language code")
            ],
            resultSchema: [
                "inspection": .string("object with verdict, coverage/indexing state, robots state, page fetch state, last crawl time, canonical URLs, sitemap/referring context, issue summaries, and inspection link when returned")
            ]
        ),
        ProviderActionTemplate(
            actionKey: "google_search_console_sitemaps_list",
            displayName: "List sitemaps",
            summary: "List submitted sitemaps for a selected Search Console property with bounded status metadata.",
            kind: .read,
            riskLevel: .medium,
            adapterKind: .nativeAPI,
            defaultPermission: .allowed,
            requiredScopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
            capabilityKeys: ["list_sitemaps", "sitemap_status_read", "semantic_search_console_read"],
            payloadSchema: [
                "siteUrl": .string("optional Search Console siteUrl, defaults to selected property"),
                "maxResults": .string("optional integer 1-25, defaults 25")
            ],
            resultSchema: [
                "sitemaps": .string("array with path, type, pending/index flags, submitted/download timestamps, warnings/errors, and submitted/indexed content counts"),
                "truncated": .string("boolean")
            ]
        ),
        ProviderActionTemplate(
            actionKey: "google_search_console_sitemap_get",
            displayName: "Get sitemap",
            summary: "Get one submitted sitemap's Search Console status and indexed/submitted content counts.",
            kind: .read,
            riskLevel: .medium,
            adapterKind: .nativeAPI,
            defaultPermission: .allowed,
            requiredScopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
            capabilityKeys: ["get_sitemap", "sitemap_status_read", "semantic_search_console_read"],
            payloadSchema: [
                "siteUrl": .string("optional Search Console siteUrl, defaults to selected property"),
                "feedpath": .string("sitemap URL or feed path")
            ],
            resultSchema: [
                "sitemap": .string("object with selected siteUrl, sitemap path, type, pending/index flags, submitted/download timestamps, warnings/errors, and submitted/indexed content counts")
            ]
        ),
        ProviderActionTemplate(
            actionKey: "google_search_console_sitemap_submit",
            displayName: "Submit sitemap",
            summary: "Submit a sitemap to Google Search Console.",
            kind: .write,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["submit_sitemap", "search_console_write"],
            payloadSchema: ["siteUrl": .string("string"), "feedpath": .string("string")],
            resultSchema: [:],
            blockedReason: "Search Console sitemap submit mutates provider state and requires the broader webmasters scope; it is deferred from read-only V1."
        ),
        ProviderActionTemplate(
            actionKey: "google_search_console_sitemap_delete",
            displayName: "Delete sitemap",
            summary: "Delete or remove a sitemap from Google Search Console.",
            kind: .delete,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["delete_sitemap", "search_console_write"],
            payloadSchema: ["siteUrl": .string("string"), "feedpath": .string("string")],
            resultSchema: [:],
            blockedReason: "Search Console sitemap delete mutates provider state and requires the broader webmasters scope; it is deferred from read-only V1."
        ),
        ProviderActionTemplate(
            actionKey: "google_search_console_site_add",
            displayName: "Add site",
            summary: "Add a Search Console site/property.",
            kind: .admin,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["add_site", "property_management", "search_console_write"],
            payloadSchema: ["siteUrl": .string("string")],
            resultSchema: [:],
            blockedReason: "Search Console site/property add mutates provider state and requires the broader webmasters scope; it is deferred from read-only V1."
        ),
        ProviderActionTemplate(
            actionKey: "google_search_console_site_delete",
            displayName: "Delete site",
            summary: "Delete or remove a Search Console site/property.",
            kind: .delete,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["delete_site", "property_management", "search_console_write"],
            payloadSchema: ["siteUrl": .string("string")],
            resultSchema: [:],
            blockedReason: "Search Console site/property delete mutates provider state and requires the broader webmasters scope; it is deferred from read-only V1."
        ),
        ProviderActionTemplate(
            actionKey: "google_search_console_broad_export",
            displayName: "Broad export",
            summary: "Export, crawl, sync, or dump broad Search Console data.",
            kind: .read,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["broad_export", "bulk_search_console_export"],
            payloadSchema: ["siteUrl": .string("optional string"), "destination": .string("optional string")],
            resultSchema: [:],
            blockedReason: "Broad Search Console export, crawling, and sync are blocked by the V1 privacy and context-budget policy."
        ),
        ProviderActionTemplate(
            actionKey: "google_search_console_testing_tools_api",
            displayName: "Testing Tools API",
            summary: "Use Search Console Testing Tools, Rich Results, or public testing API surfaces.",
            kind: .admin,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["testing_tools_api", "rich_results", "public_testing_api"],
            payloadSchema: ["url": .string("string")],
            resultSchema: [:],
            blockedReason: "Search Console Testing Tools and adjacent public testing APIs are outside the private OAuth Search Console API V1 app."
        ),
        ProviderActionTemplate(
            actionKey: "google_search_console_raw_api_call",
            displayName: "Raw API call",
            summary: "Expose or invoke raw Search Console REST methods or raw provider tool dumps directly.",
            kind: .admin,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["raw_api", "raw_provider_tool"],
            payloadSchema: ["method": .string("string"), "arguments": .string("object")],
            resultSchema: [:],
            blockedReason: "Raw Search Console API exposure is blocked; agents may receive only Relay policy-scoped wrapper tools."
        )
    ]

    private static let sentryTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "sentry_list_projects",
            displayName: "List projects",
            summary: "List accessible Sentry projects for the connected organization with bounded metadata.",
            kind: .read,
            riskLevel: .medium,
            adapterKind: .nativeAPI,
            defaultPermission: .allowed,
            requiredScopes: ["org:read", "project:read"],
            capabilityKeys: ["list_projects", "project_metadata_read"],
            payloadSchema: [
                "organizationSlug": .string("optional string, defaults to the selected connection organization"),
                "limit": .string("optional integer 1-10"),
                "cursor": .string("optional")
            ],
            resultSchema: [
                "projects": .string("array with id, slug, name, platform, status, organization, and permalink when returned"),
                "nextCursor": .string("optional")
            ]
        ),
        ProviderActionTemplate(
            actionKey: "sentry_search_issues",
            displayName: "Search issues",
            summary: "Search recent Sentry issues with bounded project, environment, status, query, and result limits.",
            kind: .search,
            riskLevel: .medium,
            adapterKind: .nativeAPI,
            defaultPermission: .allowed,
            requiredScopes: ["org:read", "project:read", "event:read"],
            capabilityKeys: ["search_issues", "issue_triage_read"],
            payloadSchema: [
                "organizationSlug": .string("optional string, defaults to the selected connection organization"),
                "projectSlug": .string("optional string, defaults to the selected connection project"),
                "environment": .string("optional string, defaults to the selected connection environment"),
                "query": .string("optional bounded Sentry issue query"),
                "status": .string("optional unresolved, resolved, or ignored"),
                "sort": .string("optional date, new, priority, freq, or user"),
                "limit": .string("optional integer 1-10"),
                "statsPeriod": .string("optional bounded period")
            ],
            resultSchema: [
                "issues": .string("array with id, short id, title, culprit, permalink, project, status, priority/level, counts, first/last seen, and bounded stats"),
                "nextCursor": .string("optional")
            ]
        ),
        ProviderActionTemplate(
            actionKey: "sentry_get_issue",
            displayName: "Get issue",
            summary: "Retrieve one Sentry issue with semantic details and latest-event summary where returned.",
            kind: .read,
            riskLevel: .medium,
            adapterKind: .nativeAPI,
            defaultPermission: .allowed,
            requiredScopes: ["org:read", "project:read", "event:read"],
            capabilityKeys: ["get_issue", "issue_detail_read"],
            payloadSchema: [
                "organizationSlug": .string("optional string, defaults to the selected connection organization"),
                "issueId": .string("string"),
                "includeLatestEvent": .string("optional boolean, defaults true"),
                "maxSummaryChars": .string("optional integer 1-4000")
            ],
            resultSchema: [
                "issue": .string("object with id, title, permalink, status/substatus, project, platform/category, metadata, first/last seen, count/user count, assignment/subscription fields, and latest event summary when returned")
            ]
        ),
        ProviderActionTemplate(
            actionKey: "sentry_get_event",
            displayName: "Get event",
            summary: "Retrieve one representative Sentry event with bounded exception, tag, stacktrace, and context excerpts.",
            kind: .read,
            riskLevel: .high,
            adapterKind: .nativeAPI,
            defaultPermission: .allowed,
            requiredScopes: ["org:read", "project:read", "event:read"],
            capabilityKeys: ["get_event", "event_detail_read"],
            payloadSchema: [
                "organizationSlug": .string("optional string, defaults to the selected connection organization"),
                "projectSlug": .string("optional string, defaults to the selected connection project"),
                "eventId": .string("string"),
                "issueId": .string("optional string"),
                "maxContextChars": .string("optional integer 1-6000"),
                "maxFrames": .string("optional integer 1-20")
            ],
            resultSchema: [
                "event": .string("object with event id, issue id, project, title/message, platform, timestamp, level/type, tags, release/environment, exception/message entries, bounded stack frames, and truncation flags")
            ]
        ),
        ProviderActionTemplate(
            actionKey: "sentry_prepare_issue_update",
            displayName: "Prepare issue update",
            summary: "Prepare a bounded Sentry issue workflow update payload locally without mutating Sentry.",
            kind: .draft,
            riskLevel: .medium,
            adapterKind: .nativeAPI,
            defaultPermission: .allowed,
            requiredScopes: [],
            capabilityKeys: ["prepare_issue_update"],
            payloadSchema: [
                "issueId": .string("string"),
                "status": .string("optional resolved, unresolved, or ignored"),
                "substatus": .string("optional Sentry-supported substatus"),
                "assignedTo": .string("optional actor identifier"),
                "isBookmarked": .string("optional boolean"),
                "isSubscribed": .string("optional boolean"),
                "isPublic": .string("must remain false in V1"),
                "priority": .string("optional low, medium, high, or critical")
            ],
            resultSchema: [
                "draftPreview": .string("object with normalized update fields, blocked-field warnings, and exact payload hash")
            ]
        ),
        ProviderActionTemplate(
            actionKey: "sentry_update_issue",
            displayName: "Update issue",
            summary: "Update bounded Sentry issue workflow fields through Relay approval or Direct writes policy.",
            kind: .write,
            riskLevel: .high,
            adapterKind: .nativeAPI,
            defaultPermission: .approvalRequired,
            requiredScopes: ["org:read", "project:read", "event:read", "event:write"],
            capabilityKeys: ["update_issue", "issue_workflow_write"],
            payloadSchema: [
                "organizationSlug": .string("optional string, defaults to the selected connection organization"),
                "issueId": .string("string"),
                "status": .string("optional resolved, unresolved, or ignored"),
                "substatus": .string("optional Sentry-supported substatus"),
                "assignedTo": .string("optional actor identifier"),
                "isBookmarked": .string("optional boolean"),
                "isSubscribed": .string("optional boolean"),
                "priority": .string("optional low, medium, high, or critical"),
                "approvalPayloadHash": .string("optional exact payload hash")
            ],
            resultSchema: [
                "issueId": .string("string"),
                "status": .string("string"),
                "permalink": .string("optional string"),
                "payloadHash": .string("string"),
                "auditId": .string("string")
            ]
        ),
        ProviderActionTemplate(
            actionKey: "sentry_broad_export",
            displayName: "Broad issue or event export",
            summary: "Export, crawl, sync, or dump broad Sentry issue/event data.",
            kind: .read,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["broad_export", "bulk_event_export"],
            payloadSchema: ["query": .string("optional string"), "destination": .string("optional string")],
            resultSchema: [:],
            blockedReason: "Broad Sentry issue/event export, crawling, and sync are blocked by the V1 privacy and context-budget policy."
        ),
        ProviderActionTemplate(
            actionKey: "sentry_attachment_download",
            displayName: "Download attachments",
            summary: "Download Sentry event attachments, minidumps, or raw files.",
            kind: .read,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["attachment_download", "minidump_download"],
            payloadSchema: ["eventId": .string("string")],
            resultSchema: [:],
            blockedReason: "Sentry attachment, minidump, and raw file downloads are blocked in V1 pending a separate data-handling decision."
        ),
        ProviderActionTemplate(
            actionKey: "sentry_source_map_upload",
            displayName: "Upload source maps or files",
            summary: "Upload source maps, release files, debug files, snapshots, or artifacts to Sentry.",
            kind: .write,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["source_map_upload", "release_file_upload", "debug_file_upload"],
            payloadSchema: ["release": .string("optional string"), "files": .string("array")],
            resultSchema: [:],
            blockedReason: "Sentry source map, release file, debug file, snapshot, and artifact uploads are blocked in V1."
        ),
        ProviderActionTemplate(
            actionKey: "sentry_admin_operation",
            displayName: "Administer Sentry",
            summary: "Administer Sentry organizations, projects, teams, members, integrations, service hooks, or inbound filters.",
            kind: .admin,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["org_admin", "project_admin", "team_admin", "member_admin", "service_hook_manage", "inbound_filter_manage"],
            payloadSchema: ["operation": .string("string")],
            resultSchema: [:],
            blockedReason: "Sentry organization, project, team, member, integration, service hook, and inbound-filter administration are blocked in V1."
        ),
        ProviderActionTemplate(
            actionKey: "sentry_bulk_mutate",
            displayName: "Bulk mutate or delete",
            summary: "Bulk update, delete, remove, merge, or erase Sentry issues, events, snapshots, or groups.",
            kind: .delete,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["bulk_mutate", "delete_issue", "delete_event", "merge_issues"],
            payloadSchema: ["ids": .string("array"), "operation": .string("string")],
            resultSchema: [:],
            blockedReason: "Sentry bulk mutation, delete, remove, merge, and erase operations are blocked in V1."
        ),
        ProviderActionTemplate(
            actionKey: "sentry_raw_mcp_call",
            displayName: "Raw MCP call",
            summary: "Expose or invoke raw Sentry MCP tools directly.",
            kind: .admin,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["raw_mcp", "raw_sentry_tool"],
            payloadSchema: ["toolName": .string("string"), "arguments": .string("object")],
            resultSchema: [:],
            blockedReason: "Raw Sentry MCP exposure is blocked; agents may receive only Relay policy-scoped wrappers."
        ),
        ProviderActionTemplate(
            actionKey: "sentry_seer_ai",
            displayName: "Use Seer or AI actions",
            summary: "Use Sentry Seer, AI-powered issue search, or external LLM-backed Sentry workflows.",
            kind: .search,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["seer_ai", "ai_search", "external_llm"],
            payloadSchema: ["query": .string("string")],
            resultSchema: [:],
            blockedReason: "Sentry Seer and AI-powered workflows are deferred pending explicit product, plan, and external-provider decisions."
        )
    ]

    private static let notionTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "notion_search",
            displayName: "Search workspace",
            summary: "Search accessible Notion pages and data sources with bounded result limits.",
            kind: .search,
            riskLevel: .medium,
            adapterKind: .nativeAPI,
            defaultPermission: .allowed,
            requiredScopes: ["read_content"],
            capabilityKeys: ["search_workspace"],
            payloadSchema: [
                "query": .string("string"),
                "objectType": .string("optional: page or data_source"),
                "limit": .string("optional integer 1-10"),
                "sort": .string("optional"),
                "startCursor": .string("optional")
            ],
            resultSchema: [
                "results": .string("array with object id, type, title, URL, parent/context, timestamps, and archived/in-trash flags when returned"),
                "nextCursor": .string("optional")
            ]
        ),
        ProviderActionTemplate(
            actionKey: "notion_fetch_page",
            displayName: "Fetch page",
            summary: "Fetch one Notion page by URL or id with metadata and bounded markdown context.",
            kind: .read,
            riskLevel: .medium,
            adapterKind: .nativeAPI,
            defaultPermission: .allowed,
            requiredScopes: ["read_content"],
            capabilityKeys: ["fetch_page"],
            payloadSchema: [
                "pageUrlOrId": .string("string"),
                "maxMarkdownChars": .string("optional integer 1-8000"),
                "includeProperties": .string("optional boolean"),
                "includeTranscript": .string("must remain false in V1")
            ],
            resultSchema: [
                "page": .string("object with id, URL, title, parent/context, last edited time, property summary, bounded markdown excerpt, truncation flag, and unknown block count")
            ]
        ),
        ProviderActionTemplate(
            actionKey: "notion_query_data_source",
            displayName: "Query data source",
            summary: "Query a known Notion data source with explicit filters, selected properties, and bounded rows.",
            kind: .search,
            riskLevel: .medium,
            adapterKind: .nativeAPI,
            defaultPermission: .allowed,
            requiredScopes: ["read_content"],
            capabilityKeys: ["query_data_source"],
            payloadSchema: [
                "dataSourceId": .string("string"),
                "filter": .string("optional object"),
                "sorts": .string("optional array"),
                "limit": .string("optional integer 1-10"),
                "propertyNames": .string("optional array")
            ],
            resultSchema: [
                "rows": .string("array with row/page id, row title, selected property summaries, URL, and last edited time")
            ]
        ),
        ProviderActionTemplate(
            actionKey: "notion_prepare_page",
            displayName: "Prepare page update",
            summary: "Prepare a Notion page, update, or comment payload locally without mutating Notion.",
            kind: .draft,
            riskLevel: .medium,
            adapterKind: .nativeAPI,
            defaultPermission: .allowed,
            requiredScopes: [],
            capabilityKeys: ["prepare_page_payload"],
            payloadSchema: [
                "intent": .string("create_page, update_page, or create_comment"),
                "parentId": .string("optional string"),
                "title": .string("optional string"),
                "markdown": .string("optional string"),
                "properties": .string("optional object"),
                "comment": .string("optional string")
            ],
            resultSchema: [
                "draftPreview": .string("object with normalized payload preview and exact payload hash")
            ]
        ),
        ProviderActionTemplate(
            actionKey: "notion_create_page",
            displayName: "Create page",
            summary: "Create a Notion page under an explicit parent according to Relay approval or Direct writes policy.",
            kind: .write,
            riskLevel: .high,
            adapterKind: .nativeAPI,
            defaultPermission: .approvalRequired,
            requiredScopes: ["insert_content"],
            capabilityKeys: ["create_page"],
            payloadSchema: [
                "parentId": .string("string"),
                "parentType": .string("page_id or data_source_id"),
                "title": .string("string"),
                "markdown": .string("optional bounded markdown"),
                "properties": .string("optional object"),
                "approvalPayloadHash": .string("optional exact payload hash")
            ],
            resultSchema: [
                "pageId": .string("string"),
                "url": .string("string"),
                "payloadHash": .string("string"),
                "auditId": .string("string")
            ]
        ),
        ProviderActionTemplate(
            actionKey: "notion_update_page",
            displayName: "Update page",
            summary: "Update Notion page properties or append bounded content according to Relay approval or Direct writes policy.",
            kind: .write,
            riskLevel: .high,
            adapterKind: .nativeAPI,
            defaultPermission: .approvalRequired,
            requiredScopes: ["update_content", "insert_content"],
            capabilityKeys: ["update_page", "append_blocks"],
            payloadSchema: [
                "pageId": .string("string"),
                "propertyChanges": .string("optional object"),
                "appendMarkdown": .string("optional bounded markdown"),
                "position": .string("optional append position"),
                "approvalPayloadHash": .string("optional exact payload hash")
            ],
            resultSchema: [
                "pageId": .string("string"),
                "url": .string("string"),
                "payloadHash": .string("string"),
                "auditId": .string("string")
            ]
        ),
        ProviderActionTemplate(
            actionKey: "notion_create_comment",
            displayName: "Create comment",
            summary: "Create a bounded Notion comment according to Relay approval or Direct writes policy.",
            kind: .message,
            riskLevel: .high,
            adapterKind: .nativeAPI,
            defaultPermission: .approvalRequired,
            requiredScopes: ["insert_comments"],
            capabilityKeys: ["create_comment"],
            payloadSchema: [
                "pageId": .string("optional string"),
                "blockId": .string("optional string"),
                "discussionId": .string("optional string"),
                "markdown": .string("string"),
                "approvalPayloadHash": .string("optional exact payload hash")
            ],
            resultSchema: [
                "commentId": .string("string"),
                "payloadHash": .string("string"),
                "auditId": .string("string")
            ]
        ),
        ProviderActionTemplate(
            actionKey: "notion_trash_content",
            displayName: "Trash or erase content",
            summary: "Trash, delete, archive, or erase Notion content.",
            kind: .delete,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["trash_content", "erase_content"],
            payloadSchema: ["pageId": .string("string")],
            resultSchema: [:],
            blockedReason: "Notion trash, delete, archive, and erase-content actions are blocked in V1."
        ),
        ProviderActionTemplate(
            actionKey: "notion_move_duplicate_page",
            displayName: "Move or duplicate page",
            summary: "Move or duplicate Notion pages.",
            kind: .admin,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["move_page", "duplicate_page"],
            payloadSchema: ["pageId": .string("string"), "targetParentId": .string("string")],
            resultSchema: [:],
            blockedReason: "Notion move and duplicate page actions are deferred because they can restructure workspaces or create large async copies."
        ),
        ProviderActionTemplate(
            actionKey: "notion_data_source_schema_modify",
            displayName: "Modify data source schema",
            summary: "Create or update Notion databases, data sources, schemas, or views.",
            kind: .admin,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["modify_data_source_schema"],
            payloadSchema: ["dataSourceId": .string("optional string"), "schema": .string("object")],
            resultSchema: [:],
            blockedReason: "Notion database, data source, schema, and view changes are blocked in V1."
        ),
        ProviderActionTemplate(
            actionKey: "notion_file_export",
            displayName: "Export files or media",
            summary: "Download, upload, or export Notion files, media, or workspace content.",
            kind: .read,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["file_export", "file_upload"],
            payloadSchema: ["objectId": .string("string"), "destination": .string("optional string")],
            resultSchema: [:],
            blockedReason: "Notion file upload, download, media export, and broad export actions are blocked in V1."
        ),
        ProviderActionTemplate(
            actionKey: "notion_public_oauth_connect",
            displayName: "Public OAuth connection",
            summary: "Use a Relay-owned public Notion OAuth app or shared callback.",
            kind: .admin,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["public_oauth_connection"],
            payloadSchema: [:],
            resultSchema: [:],
            blockedReason: "Relay-owned Notion OAuth apps and shared callbacks are out of scope for this user-owned credential loop."
        ),
        ProviderActionTemplate(
            actionKey: "notion_raw_mcp_call",
            displayName: "Raw MCP call",
            summary: "Expose or invoke raw Notion MCP tools directly.",
            kind: .admin,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["raw_mcp"],
            payloadSchema: ["toolName": .string("string"), "arguments": .string("object")],
            resultSchema: [:],
            blockedReason: "Raw Notion MCP exposure is blocked; agents may receive only Relay policy-scoped wrappers."
        ),
        ProviderActionTemplate(
            actionKey: "notion_ai_query",
            displayName: "Notion AI query",
            summary: "Use Notion AI plan-gated connected workspace query tools.",
            kind: .search,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["notion_ai_query"],
            payloadSchema: ["query": .string("string")],
            resultSchema: [:],
            blockedReason: "Notion AI plan-gated query tools are deferred pending explicit product and plan decisions."
        ),
        ProviderActionTemplate(
            actionKey: "notion_admin_operation",
            displayName: "Workspace admin operation",
            summary: "Perform Notion organization, workspace, member, or tenant-admin operations.",
            kind: .admin,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["workspace_admin"],
            payloadSchema: ["operation": .string("string")],
            resultSchema: [:],
            blockedReason: "Notion workspace admin and organization-bot operations are blocked in this app install."
        )
    ]

    private static let exaSearchTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "exa.search.web",
            displayName: "Search web",
            summary: "Run a standard Exa web search.",
            kind: .search,
            riskLevel: .low,
            adapterKind: .nativeAPI,
            defaultPermission: .allowed,
            requiredScopes: ["search"],
            capabilityKeys: ["external_search"],
            payloadSchema: ["query": .string("string"), "numResults": .string("integer")],
            resultSchema: ["results": .string("array")]
        ),
        ProviderActionTemplate(
            actionKey: "exa.answer.read",
            displayName: "Read answer",
            summary: "Read Exa answer output for a query.",
            kind: .read,
            riskLevel: .low,
            adapterKind: .nativeAPI,
            defaultPermission: .allowed,
            requiredScopes: ["answer"],
            capabilityKeys: ["answer_read"],
            payloadSchema: ["query": .string("string")],
            resultSchema: ["answer": .string("string")]
        ),
        ProviderActionTemplate(
            actionKey: "exa.search.deep",
            displayName: "Deep search",
            summary: "Run a higher-cost Exa search that should respect budget review.",
            kind: .search,
            riskLevel: .high,
            adapterKind: .nativeAPI,
            defaultPermission: .approvalRequired,
            requiredScopes: ["search"],
            capabilityKeys: ["deep_search"],
            payloadSchema: ["query": .string("string"), "budget": .string("number")],
            resultSchema: ["results": .string("array")]
        ),
        ProviderActionTemplate(
            actionKey: "exa.result.export",
            displayName: "Export results",
            summary: "Export Exa result data outside the current task context.",
            kind: .write,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["export_results"],
            payloadSchema: ["destination": .string("string")],
            resultSchema: [:],
            blockedReason: "Exa result export is blocked until privacy and destination policy exists."
        )
    ]

    private static let microsoftClarityTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "microsoft_clarity_get_project_live_insights",
            displayName: "Get project live insights",
            summary: "Read recent Microsoft Clarity project-live-insights for 1 to 3 days with up to three dimensions.",
            kind: .read,
            riskLevel: .medium,
            adapterKind: .nativeAPI,
            defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.microsoftClarityDataExportCapabilities,
            capabilityKeys: ["project_live_insights_read", "clarity_data_export_api"],
            payloadSchema: [
                "numOfDays": .string("optional integer 1-3, defaults 1"),
                "dimension1": .string("optional: Browser, Device, Country/Region, OS, Source, Medium, Campaign, Channel, URL"),
                "dimension2": .string("optional second supported dimension"),
                "dimension3": .string("optional third supported dimension"),
                "maxRowsPerMetric": .string("optional integer 1-100, defaults 25"),
                "redactUrls": .string("optional boolean, defaults true")
            ],
            resultSchema: [
                "metricGroups": .string("array of Clarity metric groups"),
                "rowCount": .string("integer"),
                "dimensions": .string("array"),
                "dayWindow": .string("integer"),
                "warnings": .string("array")
            ]
        ),
        ProviderActionTemplate(
            actionKey: "microsoft_clarity_raw_session_recording_export",
            displayName: "Export raw session recordings",
            summary: "Export or download raw Microsoft Clarity session recordings.",
            kind: .read,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["raw_session_recording_export"],
            payloadSchema: ["projectId": .string("optional string")],
            resultSchema: [:],
            blockedReason: "Microsoft Clarity raw session recording export is not part of the read-only V1 Data Export API install."
        ),
        ProviderActionTemplate(
            actionKey: "microsoft_clarity_heatmap_export",
            displayName: "Export heatmaps",
            summary: "Export or download Microsoft Clarity heatmap assets.",
            kind: .read,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["heatmap_export"],
            payloadSchema: ["projectId": .string("optional string")],
            resultSchema: [:],
            blockedReason: "Microsoft Clarity heatmap export is not exposed in the V1 Marketplace wrapper."
        ),
        ProviderActionTemplate(
            actionKey: "microsoft_clarity_client_instrumentation_update",
            displayName: "Change instrumentation",
            summary: "Change Microsoft Clarity tracking script, masking, tags, events, or custom identifiers.",
            kind: .write,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["instrumentation_write", "custom_identifier_write", "masking_write"],
            payloadSchema: ["change": .string("object")],
            resultSchema: [:],
            blockedReason: "Microsoft Clarity client-side instrumentation, masking, tags, events, and custom identifiers are blocked in V1."
        ),
        ProviderActionTemplate(
            actionKey: "microsoft_clarity_project_admin",
            displayName: "Administer project",
            summary: "Create, modify, delete, or administer Microsoft Clarity projects, users, settings, or API tokens.",
            kind: .admin,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["project_admin", "token_admin", "user_admin"],
            payloadSchema: ["operation": .string("string")],
            resultSchema: [:],
            blockedReason: "Microsoft Clarity project administration and token generation are blocked in V1."
        )
    ]

    private static let pagerDutyTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "pagerduty_incident_list", displayName: "List incidents", summary: "List one bounded page of PagerDuty incident lifecycle summaries.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: ["incidents.read"],
            capabilityKeys: ["incident_list"], payloadSchema: ["statuses": .string("optional subset of triggered, acknowledged, resolved"), "limit": .string("optional integer 1-25")],
            resultSchema: ["incidents": .string("array of incident number/title/status/urgency/timestamps/service/escalation summaries"), "returnedCount": .string("integer"), "more": .string("boolean")]),
        ProviderActionTemplate(
            actionKey: "pagerduty_incident_get", displayName: "Get incident", summary: "Read one exact PagerDuty incident summary by safe incident ID.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: ["incidents.read"],
            capabilityKeys: ["incident_read"], payloadSchema: ["incidentId": .string("required safe PagerDuty incident ID")], resultSchema: ["incident": .string("incident lifecycle and service/escalation summary")]),
        ProviderActionTemplate(
            actionKey: "pagerduty_service_list", displayName: "List services", summary: "List one bounded page of PagerDuty service ownership summaries.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: ["services.read"],
            capabilityKeys: ["service_list"], payloadSchema: ["limit": .string("optional integer 1-25")], resultSchema: ["services": .string("array of name/description/status/escalation/team/integration-count summaries"), "returnedCount": .string("integer"), "more": .string("boolean")])
    ]

    private static let cloudflareTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "cloudflare_zone_list", displayName: "List zones", summary: "List one bounded page of zones for the exact selected Cloudflare account.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: ["zone.read"],
            capabilityKeys: ["zone_list"], payloadSchema: ["limit": .string("optional integer 1-25")], resultSchema: ["zones": .string("array of zone name/status/type/account/lifecycle/name-server summaries"), "returnedCount": .string("integer"), "more": .string("boolean")]),
        ProviderActionTemplate(
            actionKey: "cloudflare_zone_get", displayName: "Get selected zone", summary: "Read the exact selected Cloudflare zone summary.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: ["zone.read"], capabilityKeys: ["zone_read"],
            payloadSchema: [:], resultSchema: ["zone": .string("selected zone identity/status/type/account/lifecycle summary")]),
        ProviderActionTemplate(
            actionKey: "cloudflare_zone_traffic_overview", displayName: "Review zone traffic", summary: "Read a static aggregate traffic overview for the selected zone over at most 24 hours.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ["analytics.read"], capabilityKeys: ["traffic_overview"], payloadSchema: ["hours": .string("optional integer 1-24")], resultSchema: ["traffic": .string("aggregate request/data-transfer/visit summary with UTC window and data availability")])
    ]

    private static let vercelTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "vercel_project_list", displayName: "List projects", summary: "List one bounded page of projects for the exact installed Vercel scope.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: ["project:read"],
            capabilityKeys: ["project_list"], payloadSchema: ["limit": .string("optional integer 1-25")], resultSchema: ["projects": .string("array of project/framework/lifecycle/latest-deployment summaries"), "returnedCount": .string("integer"), "more": .string("boolean")]),
        ProviderActionTemplate(
            actionKey: "vercel_project_get", displayName: "Get selected project", summary: "Read the exact selected Vercel project summary.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: ["project:read"], capabilityKeys: ["project_read"],
            payloadSchema: [:], resultSchema: ["project": .string("selected project/framework/lifecycle/latest-deployment summary")]),
        ProviderActionTemplate(
            actionKey: "vercel_deployment_list", displayName: "List deployments", summary: "List one bounded page of deployments for the selected Vercel project.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: ["deployment:read"],
            capabilityKeys: ["deployment_list"], payloadSchema: ["limit": .string("optional integer 1-25")], resultSchema: ["deployments": .string("array of deployment URL/state/target/project/creator/Git/lifecycle summaries"), "returnedCount": .string("integer"), "more": .string("boolean")])
    ]

    private static let herokuTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "heroku_team_app_list", displayName: "List team apps", summary: "List one bounded page of Apps for the exact selected Heroku Team.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: ["read"],
            capabilityKeys: ["team_app_list"], payloadSchema: ["limit": .string("optional integer 1-25")], resultSchema: ["apps": .string("array of App state/region/stack/lifecycle summaries"), "returnedCount": .string("integer"), "more": .string("boolean")]),
        ProviderActionTemplate(
            actionKey: "heroku_app_release_list", displayName: "List app releases", summary: "List up to 25 recent Releases for the exact selected Heroku App.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: ["read"],
            capabilityKeys: ["app_release_list"], payloadSchema: ["limit": .string("optional integer 1-25")], resultSchema: ["releases": .string("array of Release version/status/lifecycle summaries"), "returnedCount": .string("integer"), "more": .string("boolean")]),
        ProviderActionTemplate(
            actionKey: "heroku_app_dyno_list", displayName: "List app dynos", summary: "List up to 25 current Dynos for the exact selected Heroku App.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: ["read"], capabilityKeys: ["app_dyno_list"],
            payloadSchema: ["limit": .string("optional integer 1-25")], resultSchema: ["dynos": .string("array of Dyno type/size/state/release summaries"), "returnedCount": .string("integer"), "more": .string("boolean")])
    ]

    private static let digitalOceanTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "digitalocean_project_list", displayName: "List projects", summary: "List one bounded page of Projects for the exact OAuth Team.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: ["project:read"],
            capabilityKeys: ["project_list"], payloadSchema: ["limit": .string("optional integer 1-25")], resultSchema: ["projects": .string("array of Project purpose/environment/lifecycle summaries"), "returnedCount": .string("integer"), "more": .string("boolean")]),
        ProviderActionTemplate(
            actionKey: "digitalocean_project_get", displayName: "Get selected project", summary: "Read the exact selected DigitalOcean Project.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: ["project:read"], capabilityKeys: ["project_read"],
            payloadSchema: [:], resultSchema: ["project": .string("selected Project purpose/environment/lifecycle summary")]),
        ProviderActionTemplate(
            actionKey: "digitalocean_project_resource_list", displayName: "List project resources", summary: "List one bounded page of resources assigned to the selected Project.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ["project:read"], capabilityKeys: ["project_resource_list"], payloadSchema: ["limit": .string("optional integer 1-25")],
            resultSchema: ["resources": .string("array of resource URN/status/assignment summaries"), "returnedCount": .string("integer"), "more": .string("boolean")]),
        ProviderActionTemplate(
            actionKey: "digitalocean_selected_resource_get", displayName: "Get selected resource", summary: "Read one selected Droplet or App after bounded Project-membership verification.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.digitalOceanReadScopes, capabilityKeys: ["selected_resource_read"], payloadSchema: [:],
            resultSchema: ["resourceKind": .string("droplet or app"), "resource": .string("provider-correct selected resource summary"), "projectMembershipVerified": .string("boolean")])
    ]

    private static let firebaseTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "firebase_project_list", displayName: "List Firebase projects", summary: "List one bounded first page of active Firebase Projects accessible to the consenting user.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.firebaseReadScopes, capabilityKeys: ["firebase_project_list"], payloadSchema: ["limit": .string("optional integer 1-25")],
            resultSchema: ["projects": .string("bounded Firebase Project summaries"), "more": .string("provider next-page token exists")]),
        ProviderActionTemplate(
            actionKey: "firebase_project_get", displayName: "Get selected Firebase project", summary: "Read the exact selected Firebase Project.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: ProviderConnectionService.firebaseReadScopes,
            capabilityKeys: ["firebase_project_read"], payloadSchema: [:], resultSchema: ["project": .string("selected Firebase Project summary")]),
        ProviderActionTemplate(
            actionKey: "firebase_app_list", displayName: "List Firebase apps", summary: "List one bounded first page of registered Apps in the exact selected Firebase Project.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.firebaseReadScopes, capabilityKeys: ["firebase_app_list"], payloadSchema: ["limit": .string("optional integer 1-25")], resultSchema: ["apps": .string("bounded Firebase App summaries"), "more": .string("provider next-page token exists")])
    ]

    private static let supabaseTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "supabase_organization_get", displayName: "Get Supabase organization", summary: "Read the exact selected Supabase Organization.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.supabaseReadScopes, capabilityKeys: ["supabase_organization_read"], payloadSchema: [:], resultSchema: ["organization": .string("selected Supabase Organization summary")]),
        ProviderActionTemplate(
            actionKey: "supabase_organization_project_list", displayName: "List Supabase organization projects", summary: "List one bounded first page of Projects in the exact selected Supabase Organization.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.supabaseReadScopes, capabilityKeys: ["supabase_project_list"], payloadSchema: ["limit": .string("optional integer 1-25")],
            resultSchema: ["projects": .string("bounded Supabase Project summaries"), "pagination": .string("count, limit, and offset zero")]),
        ProviderActionTemplate(
            actionKey: "supabase_project_get", displayName: "Get selected Supabase project", summary: "Read the exact selected Supabase Project.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: ProviderConnectionService.supabaseReadScopes,
            capabilityKeys: ["supabase_project_read"], payloadSchema: [:], resultSchema: ["project": .string("selected Supabase Project summary")])
    ]

    private static let oktaTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "okta_application_list", displayName: "List Okta applications", summary: "List one bounded first page of Applications in the exact connected Okta org.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.oktaReadScopes, capabilityKeys: ["okta_application_list"], payloadSchema: ["limit": .string("optional integer 1-25")], resultSchema: ["applications": .string("bounded Okta Application summaries")]),
        ProviderActionTemplate(
            actionKey: "okta_application_get", displayName: "Get selected Okta application", summary: "Read the exact selected Okta Application.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: ProviderConnectionService.oktaReadScopes,
            capabilityKeys: ["okta_application_read"], payloadSchema: [:], resultSchema: ["application": .string("selected Okta Application summary")]),
        ProviderActionTemplate(
            actionKey: "okta_application_group_list", displayName: "List assigned Okta groups", summary: "List one bounded first page of Groups assigned to the exact selected Application.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.oktaReadScopes, capabilityKeys: ["okta_application_group_list"], payloadSchema: ["limit": .string("optional integer 1-25")], resultSchema: ["groups": .string("bounded assigned Group summaries")])
    ]
    private static let bambooHRTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "bamboohr_location_list", displayName: "List BambooHR locations", summary: "List one bounded first page of job Locations.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: ProviderConnectionService.bambooHRReadScopes,
            capabilityKeys: ["bamboohr_location_list"], payloadSchema: ["limit": .string("optional integer 1-25")], resultSchema: ["locations": .string("bounded safe Location summaries")]),
        ProviderActionTemplate(
            actionKey: "bamboohr_location_get", displayName: "Get selected BambooHR location", summary: "Read the exact selected job Location with address details excluded.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.bambooHRReadScopes, capabilityKeys: ["bamboohr_location_read"], payloadSchema: [:], resultSchema: ["location": .string("selected safe Location summary")]),
        ProviderActionTemplate(
            actionKey: "bamboohr_country_list", displayName: "List BambooHR country options", summary: "List one bounded page of country options.", kind: .read, riskLevel: .low, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: ProviderConnectionService.bambooHRReadScopes,
            capabilityKeys: ["bamboohr_country_list"], payloadSchema: ["limit": .string("optional integer 1-25")], resultSchema: ["countries": .string("bounded country option summaries")]),
    ]
    private static let greenhouseTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "greenhouse_job_list", displayName: "List Greenhouse jobs", summary: "List one bounded first page of safe Job summaries.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: ProviderConnectionService.greenhouseReadScopes,
            capabilityKeys: ["greenhouse_job_list"], payloadSchema: ["limit": .string("optional integer 1-25")], resultSchema: ["jobs": .string("bounded Job summaries")]),
        ProviderActionTemplate(
            actionKey: "greenhouse_office_list", displayName: "List Greenhouse offices", summary: "List one bounded first page of safe Office summaries.", kind: .read, riskLevel: .low, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.greenhouseReadScopes, capabilityKeys: ["greenhouse_office_list"], payloadSchema: ["limit": .string("optional integer 1-25")], resultSchema: ["offices": .string("bounded Office summaries")]),
        ProviderActionTemplate(
            actionKey: "greenhouse_department_list", displayName: "List Greenhouse departments", summary: "List one bounded first page of Department summaries.", kind: .read, riskLevel: .low, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.greenhouseReadScopes, capabilityKeys: ["greenhouse_department_list"], payloadSchema: ["limit": .string("optional integer 1-25")], resultSchema: ["departments": .string("bounded Department summaries")]),
    ]
    private static let leverTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "lever_posting_list", displayName: "List Lever postings", summary: "List one bounded first page of non-confidential Posting summaries without content or people fields.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.leverReadScopes, capabilityKeys: ["lever_posting_list"], payloadSchema: ["limit": .string("optional integer 1-25")], resultSchema: ["postings": .string("bounded non-confidential Posting summaries")]),
        ProviderActionTemplate(
            actionKey: "lever_stage_list", displayName: "List Lever stages", summary: "List bounded customer-defined Stage labels without Opportunity membership.", kind: .read, riskLevel: .low, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.leverReadScopes, capabilityKeys: ["lever_stage_list"], payloadSchema: ["limit": .string("optional integer 1-25")], resultSchema: ["stages": .string("bounded Stage labels")]),
    ]
    private static let googleCalendarTemplates:[ProviderActionTemplate]=[
        ProviderActionTemplate(
            actionKey: "google_calendar_calendar_list", displayName: "List Google calendars", summary: "List one bounded first page of accessible Calendar summaries without ACL data.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.googleCalendarRelayOwnedOAuthScopes, capabilityKeys: ["calendar_list"], payloadSchema: ["limit": .string("optional integer 1-25")], resultSchema: ["calendars": .string("bounded Calendar summaries")]),
        ProviderActionTemplate(
            actionKey: "google_calendar_event_list", displayName: "List Google Calendar events", summary: "List one bounded first page of Events in an explicit Calendar and time range.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.googleCalendarRelayOwnedOAuthScopes, capabilityKeys: ["event_list"], payloadSchema: ["calendarId": .string("required Calendar ID"), "timeMin": .string("RFC3339"), "timeMax": .string("RFC3339"), "limit": .string("optional integer 1-25")],
            resultSchema: ["events": .string("bounded Event summaries")]),
        ProviderActionTemplate(
            actionKey: "google_calendar_freebusy_query", displayName: "Check Google Calendar free/busy", summary: "Return bounded busy intervals for 1-10 explicit Calendars and a time range.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.googleCalendarRelayOwnedOAuthScopes, capabilityKeys: ["freebusy_query"], payloadSchema: ["calendarIds": .string("1-10 Calendar IDs"), "timeMin": .string("RFC3339"), "timeMax": .string("RFC3339")],
            resultSchema: ["busy": .string("bounded busy intervals")]),
        ProviderActionTemplate(
            actionKey: "google_calendar_event_create", displayName: "Create Google Calendar event", summary: "Create one exact reviewed Event without guest notifications.", kind: .write, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ProviderConnectionService.googleCalendarRelayOwnedOAuthScopes, capabilityKeys: ["event_create"],
            payloadSchema: ["calendarId": .string("required"), "summary": .string("1-500"), "start": .string("date/dateTime object"), "end": .string("date/dateTime object"), "attendees": .string("optional max 25")], resultSchema: ["event": .string("created Event summary")]),
        ProviderActionTemplate(
            actionKey: "google_calendar_event_update", displayName: "Update Google Calendar event", summary: "Patch one exact reviewed Event without guest notifications.", kind: .write, riskLevel: .high, adapterKind: .nativeAPI, defaultPermission: .approvalRequired,
            requiredScopes: ProviderConnectionService.googleCalendarRelayOwnedOAuthScopes, capabilityKeys: ["event_update"],
            payloadSchema: ["calendarId": .string("required"), "eventId": .string("required"), "summary": .string("optional 1-500"), "start": .string("date/dateTime object"), "end": .string("date/dateTime object")], resultSchema: ["event": .string("updated Event summary")])
    ]

    private static let datadogTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "datadog_search_monitors", displayName: "Search monitors", summary: "Search a bounded page of Datadog monitor summaries.", kind: .search, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: ["monitors_read"],
            capabilityKeys: ["monitor_search"], payloadSchema: ["query": .string("optional Datadog monitor search string"), "limit": .string("optional integer 1-25")],
            resultSchema: ["monitors": .string("array of name/status/type/tags/last-triggered/priority summaries"), "returnedCount": .string("integer"), "truncated": .string("boolean")]),
        ProviderActionTemplate(
            actionKey: "datadog_search_incidents", displayName: "Search incidents", summary: "Search a bounded page of Datadog incident summaries.", kind: .search, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: ["incident_read"],
            capabilityKeys: ["incident_search"], payloadSchema: ["query": .string("optional bounded query"), "limit": .string("optional integer 1-25")],
            resultSchema: ["incidents": .string("array of title/status/severity/timestamps/commander/services summaries"), "returnedCount": .string("integer"), "truncated": .string("boolean")]),
        ProviderActionTemplate(
            actionKey: "datadog_list_services", displayName: "List services", summary: "List a bounded page of Datadog service definitions and ownership context.", kind: .read, riskLevel: .medium, adapterKind: .nativeAPI, defaultPermission: .allowed, requiredScopes: ["apm_service_catalog_read"],
            capabilityKeys: ["service_catalog_read"], payloadSchema: ["limit": .string("optional integer 1-25")], resultSchema: ["services": .string("array of name/description/lifecycle/owner/contact/link/tag summaries"), "returnedCount": .string("integer"), "truncated": .string("boolean")])
    ]

    private static let telemetryDeckTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "telemetrydeck_user_info_read",
            displayName: "Read user info",
            summary: "Read TelemetryDeck user and organization identity for connection health context.",
            kind: .read,
            riskLevel: .low,
            adapterKind: .nativeAPI,
            defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.telemetryDeckReadCapabilities,
            capabilityKeys: ["user_info_read", "organization_health_read"],
            payloadSchema: [:],
            resultSchema: [
                "user": .string("object with user id and email when available"),
                "organization": .string("object with organization name when available"),
                "checkedAt": .string("ISO-8601 timestamp")
            ]
        ),
        ProviderActionTemplate(
            actionKey: "telemetrydeck_tql_query_read",
            displayName: "Run bounded TQL query",
            summary: "Run a bounded read-only TelemetryDeck TQL usage query for the selected app.",
            kind: .search,
            riskLevel: .high,
            adapterKind: .nativeAPI,
            defaultPermission: .approvalRequired,
            requiredScopes: ProviderConnectionService.telemetryDeckReadCapabilities,
            capabilityKeys: ["tql_query_read", "bounded_analytics_query"],
            payloadSchema: [
                "query": .string("read-only TQL query object or saved bounded query id"),
                "namespace": .string("optional namespace, defaults to the saved connection namespace"),
                "appId": .string("optional TelemetryDeck app ID, defaults to the saved selected app"),
                "maxRows": .string("optional integer 1-100"),
                "maxLookbackDays": .string("optional integer 1-90")
            ],
            resultSchema: [
                "columns": .string("array"),
                "rows": .string("bounded array"),
                "truncated": .string("boolean"),
                "warnings": .string("array")
            ]
        ),
        ProviderActionTemplate(
            actionKey: "telemetrydeck_saved_insight_read",
            displayName: "Read saved insight",
            summary: "Read one saved TelemetryDeck insight for the selected app with bounded result rows.",
            kind: .read,
            riskLevel: .medium,
            adapterKind: .nativeAPI,
            defaultPermission: .allowed,
            requiredScopes: ProviderConnectionService.telemetryDeckReadCapabilities,
            capabilityKeys: ["saved_insight_read", "bounded_insight_result"],
            payloadSchema: [
                "insightId": .string("optional saved insight ID, defaults to the connection's configured insight"),
                "namespace": .string("optional namespace, defaults to the saved connection namespace"),
                "appId": .string("optional TelemetryDeck app ID, defaults to the saved selected app"),
                "maxRows": .string("optional integer 1-100")
            ],
            resultSchema: [
                "insight": .string("object with insight id, label, query summary, and bounded result preview"),
                "truncated": .string("boolean"),
                "warnings": .string("array")
            ]
        ),
        ProviderActionTemplate(
            actionKey: "telemetrydeck_ingest_signal",
            displayName: "Ingest signal",
            summary: "Send, backfill, or modify TelemetryDeck analytics signals.",
            kind: .write,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["signal_ingest", "event_backfill"],
            payloadSchema: ["signal": .string("object")],
            resultSchema: [:],
            blockedReason: "TelemetryDeck signal ingest and backfill writes are blocked in the V1 read-only Marketplace install."
        ),
        ProviderActionTemplate(
            actionKey: "telemetrydeck_raw_scan_export",
            displayName: "Export raw scan data",
            summary: "Export broad or raw TelemetryDeck scan data outside the task context.",
            kind: .read,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["raw_scan_export", "bulk_export"],
            payloadSchema: ["destination": .string("optional string")],
            resultSchema: [:],
            blockedReason: "TelemetryDeck raw scan exports are blocked by the V1 privacy and context-budget policy."
        ),
        ProviderActionTemplate(
            actionKey: "telemetrydeck_app_admin",
            displayName: "Administer app",
            summary: "Create, modify, delete, or configure TelemetryDeck apps, app settings, or instrumentation.",
            kind: .admin,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["app_admin", "instrumentation_admin"],
            payloadSchema: ["operation": .string("string")],
            resultSchema: [:],
            blockedReason: "TelemetryDeck app administration and instrumentation changes are blocked in V1."
        ),
        ProviderActionTemplate(
            actionKey: "telemetrydeck_org_admin",
            displayName: "Administer organization",
            summary: "Administer TelemetryDeck organizations, members, billing, access, or Personal Access Tokens.",
            kind: .admin,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["organization_admin", "member_admin", "billing_admin", "token_admin"],
            payloadSchema: ["operation": .string("string")],
            resultSchema: [:],
            blockedReason: "TelemetryDeck organization, member, billing, and PAT administration are blocked."
        ),
        ProviderActionTemplate(
            actionKey: "telemetrydeck_unbounded_query",
            displayName: "Run unbounded query",
            summary: "Run unbounded TelemetryDeck TQL, raw SQL-like, or cross-app analytics queries.",
            kind: .search,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["unbounded_query", "cross_app_query"],
            payloadSchema: ["query": .string("string")],
            resultSchema: [:],
            blockedReason: "TelemetryDeck unbounded and cross-app queries are blocked; agents may use only bounded Relay wrappers."
        ),
        ProviderActionTemplate(
            actionKey: "telemetrydeck_scheduled_polling",
            displayName: "Configure scheduled polling",
            summary: "Create, modify, or run scheduled TelemetryDeck polling jobs.",
            kind: .admin,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["scheduled_polling", "background_sync"],
            payloadSchema: ["schedule": .string("object")],
            resultSchema: [:],
            blockedReason: "TelemetryDeck scheduled polling and background sync are deferred from V1."
        ),
        ProviderActionTemplate(
            actionKey: "telemetrydeck_mcp_beta",
            displayName: "Use beta MCP surface",
            summary: "Expose TelemetryDeck beta MCP tools or raw provider tools directly to agents.",
            kind: .admin,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["raw_mcp", "beta_mcp"],
            payloadSchema: ["toolName": .string("optional string"), "payload": .string("object")],
            resultSchema: [:],
            blockedReason: "TelemetryDeck beta MCP and raw provider tool exposure are blocked; agents may use only Relay policy-scoped wrappers."
        )
    ]

    private static let postHogTemplates: [ProviderActionTemplate] = [
        ProviderActionTemplate(
            actionKey: "posthog_projects_list",
            displayName: "List projects",
            summary: "List PostHog projects and environments available to the connected read-only OAuth grant.",
            kind: .read,
            riskLevel: .low,
            adapterKind: .nativeAPI,
            defaultPermission: .allowed,
            requiredScopes: ["organization:read", "project:read"],
            capabilityKeys: ["projects_read", "environments_read"],
            payloadSchema: [
                "limit": .string("optional integer 1-25"),
                "cursor": .string("optional")
            ],
            resultSchema: [
                "projects": .string("array with project id, name, organization, and API base URL context"),
                "nextCursor": .string("optional")
            ]
        ),
        ProviderActionTemplate(
            actionKey: "posthog_dashboards_list",
            displayName: "List dashboards",
            summary: "List PostHog dashboards with bounded metadata for the selected project.",
            kind: .read,
            riskLevel: .medium,
            adapterKind: .nativeAPI,
            defaultPermission: .allowed,
            requiredScopes: ["dashboard:read", "project:read"],
            capabilityKeys: ["dashboards_read"],
            payloadSchema: [
                "projectId": .string("optional string"),
                "limit": .string("optional integer 1-25"),
                "cursor": .string("optional")
            ],
            resultSchema: [
                "dashboards": .string("array with dashboard id, name, description, item count, and URL when available"),
                "nextCursor": .string("optional")
            ]
        ),
        ProviderActionTemplate(
            actionKey: "posthog_dashboard_read",
            displayName: "Read dashboard",
            summary: "Read one PostHog dashboard summary with bounded insight metadata.",
            kind: .read,
            riskLevel: .medium,
            adapterKind: .nativeAPI,
            defaultPermission: .allowed,
            requiredScopes: ["dashboard:read", "insight:read", "project:read"],
            capabilityKeys: ["dashboard_read", "insights_read"],
            payloadSchema: [
                "dashboardId": .string("string"),
                "projectId": .string("optional string"),
                "maxInsights": .string("optional integer 1-25")
            ],
            resultSchema: [
                "dashboard": .string("object with dashboard metadata and bounded insight summaries")
            ]
        ),
        ProviderActionTemplate(
            actionKey: "posthog_insights_list",
            displayName: "List insights",
            summary: "List PostHog insights with bounded metadata for the selected project.",
            kind: .read,
            riskLevel: .medium,
            adapterKind: .nativeAPI,
            defaultPermission: .allowed,
            requiredScopes: ["insight:read", "project:read"],
            capabilityKeys: ["insights_read"],
            payloadSchema: [
                "projectId": .string("optional string"),
                "query": .string("optional name search"),
                "limit": .string("optional integer 1-25"),
                "cursor": .string("optional")
            ],
            resultSchema: [
                "insights": .string("array with insight id, short id, name, type, filters summary, and URL when available"),
                "nextCursor": .string("optional")
            ]
        ),
        ProviderActionTemplate(
            actionKey: "posthog_insight_read",
            displayName: "Read insight",
            summary: "Read one PostHog insight configuration and bounded result summary.",
            kind: .read,
            riskLevel: .medium,
            adapterKind: .nativeAPI,
            defaultPermission: .allowed,
            requiredScopes: ["insight:read", "query:read", "project:read"],
            capabilityKeys: ["insight_read", "query_read"],
            payloadSchema: [
                "insightId": .string("string"),
                "projectId": .string("optional string"),
                "maxResultRows": .string("optional integer 1-100")
            ],
            resultSchema: [
                "insight": .string("object with metadata, filter summary, bounded result preview, and truncation flags")
            ]
        ),
        ProviderActionTemplate(
            actionKey: "posthog_query_bounded",
            displayName: "Run bounded query",
            summary: "Run an approved bounded PostHog read query with row and time limits.",
            kind: .search,
            riskLevel: .high,
            adapterKind: .nativeAPI,
            defaultPermission: .approvalRequired,
            requiredScopes: ["query:read", "project:read"],
            capabilityKeys: ["bounded_query_read"],
            payloadSchema: [
                "query": .string("object with explicit read-only query type and filters"),
                "projectId": .string("optional string"),
                "maxRows": .string("optional integer 1-100"),
                "maxLookbackDays": .string("optional integer 1-90")
            ],
            resultSchema: [
                "columns": .string("array"),
                "rows": .string("bounded array"),
                "truncated": .string("boolean"),
                "warnings": .string("array")
            ]
        ),
        ProviderActionTemplate(
            actionKey: "posthog_schema_read",
            displayName: "Read event schema",
            summary: "Read PostHog event and property definitions as bounded schema context.",
            kind: .read,
            riskLevel: .low,
            adapterKind: .nativeAPI,
            defaultPermission: .allowed,
            requiredScopes: ["event_definition:read", "property_definition:read", "project:read"],
            capabilityKeys: ["event_schema_read", "property_schema_read"],
            payloadSchema: [
                "projectId": .string("optional string"),
                "eventQuery": .string("optional event-name filter"),
                "propertyQuery": .string("optional property-name filter"),
                "limit": .string("optional integer 1-100")
            ],
            resultSchema: [
                "events": .string("array of event definitions"),
                "properties": .string("array of property definitions")
            ]
        ),
        ProviderActionTemplate(
            actionKey: "posthog_event_capture",
            displayName: "Capture event",
            summary: "Send or backfill PostHog analytics events.",
            kind: .write,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["event_capture", "event_backfill"],
            payloadSchema: ["event": .string("object")],
            resultSchema: [:],
            blockedReason: "PostHog event capture and backfill writes are blocked in the V1 read-only app install."
        ),
        ProviderActionTemplate(
            actionKey: "posthog_dashboard_write",
            displayName: "Modify dashboard or insight",
            summary: "Create, update, delete, duplicate, or share PostHog dashboards and insights.",
            kind: .write,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["dashboard_write", "insight_write", "sharing_write"],
            payloadSchema: ["change": .string("object")],
            resultSchema: [:],
            blockedReason: "PostHog dashboard and insight mutations are deferred from V1."
        ),
        ProviderActionTemplate(
            actionKey: "posthog_feature_flag_write",
            displayName: "Modify feature flags",
            summary: "Create, update, delete, or roll out PostHog feature flags.",
            kind: .admin,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["feature_flag_write", "release_control"],
            payloadSchema: ["flag": .string("object")],
            resultSchema: [:],
            blockedReason: "PostHog feature flag changes are blocked because they can affect production product behavior."
        ),
        ProviderActionTemplate(
            actionKey: "posthog_experiment_write",
            displayName: "Modify experiments",
            summary: "Create, update, start, stop, or delete PostHog experiments.",
            kind: .admin,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["experiment_write"],
            payloadSchema: ["experiment": .string("object")],
            resultSchema: [:],
            blockedReason: "PostHog experiment writes are blocked in the V1 read-only app install."
        ),
        ProviderActionTemplate(
            actionKey: "posthog_admin_operation",
            displayName: "Administer organization",
            summary: "Administer PostHog organizations, projects, members, billing, settings, or API keys.",
            kind: .admin,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["organization_admin", "project_admin", "member_admin", "billing_admin", "api_key_admin"],
            payloadSchema: ["operation": .string("string")],
            resultSchema: [:],
            blockedReason: "PostHog organization, project, member, billing, settings, and API-key administration are blocked."
        ),
        ProviderActionTemplate(
            actionKey: "posthog_broad_export",
            displayName: "Broad export",
            summary: "Export, sync, or crawl broad PostHog analytics data outside the current task context.",
            kind: .read,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["broad_export", "warehouse_export", "bulk_sync"],
            payloadSchema: ["destination": .string("optional string")],
            resultSchema: [:],
            blockedReason: "Broad PostHog exports, warehouse syncs, and crawls are blocked by the V1 privacy and context-budget policy."
        ),
        ProviderActionTemplate(
            actionKey: "posthog_person_session_replay_read",
            displayName: "Read persons, sessions, or replays",
            summary: "Read person profiles, session recordings, replay payloads, logs, or support-ticket-linked records.",
            kind: .read,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["person_read", "session_read", "replay_read", "log_read", "support_ticket_read"],
            payloadSchema: ["selector": .string("object")],
            resultSchema: [:],
            blockedReason: "PostHog person, session, replay, log, and support-ticket reads are not exposed in the V1 Marketplace wrapper."
        ),
        ProviderActionTemplate(
            actionKey: "posthog_raw_hogql_or_mcp_call",
            displayName: "Raw HogQL or MCP call",
            summary: "Expose arbitrary HogQL, SQL, or raw PostHog MCP tools directly to agents.",
            kind: .admin,
            riskLevel: .destructive,
            adapterKind: .unsupported,
            defaultPermission: .blocked,
            requiredScopes: [],
            capabilityKeys: ["raw_hogql", "raw_sql", "raw_mcp"],
            payloadSchema: ["query": .string("string"), "toolName": .string("optional string")],
            resultSchema: [:],
            blockedReason: "Raw PostHog MCP, arbitrary SQL, and arbitrary HogQL exposure are blocked; agents may use only Relay policy-scoped wrappers."
        )
    ]
}

private struct ProviderActionTemplate {
    var actionKey: String
    var displayName: String
    var summary: String
    var kind: ProviderActionKind
    var riskLevel: ProviderActionRiskLevel
    var adapterKind: ProviderAdapterKind
    var defaultPermission: ProviderActionPermission
    var requiredScopes: [String]
    var capabilityKeys: [String]
    var payloadSchema: JSONRecord
    var resultSchema: JSONRecord
    var blockedReason: String?

    init(
        actionKey: String,
        displayName: String,
        summary: String,
        kind: ProviderActionKind,
        riskLevel: ProviderActionRiskLevel,
        adapterKind: ProviderAdapterKind,
        defaultPermission: ProviderActionPermission,
        requiredScopes: [String],
        capabilityKeys: [String],
        payloadSchema: JSONRecord,
        resultSchema: JSONRecord,
        blockedReason: String? = nil
    ) {
        self.actionKey = actionKey
        self.displayName = displayName
        self.summary = summary
        self.kind = kind
        self.riskLevel = riskLevel
        self.adapterKind = adapterKind
        self.defaultPermission = defaultPermission
        self.requiredScopes = requiredScopes
        self.capabilityKeys = capabilityKeys
        self.payloadSchema = payloadSchema
        self.resultSchema = resultSchema
        self.blockedReason = blockedReason
    }

    func definition(
        workspaceId: RelayId,
        app: MarketplaceCatalogApp,
        timestamp: IsoTimestamp
    ) -> MarketplaceProviderActionDefinition {
        MarketplaceProviderActionDefinition(
            id: MarketplaceProviderActionPolicyCompilerService.actionId(appId: app.id, actionKey: actionKey),
            workspaceId: workspaceId,
            appId: app.id,
            appSlug: app.slug,
            providerKey: app.slug,
            actionKey: actionKey,
            displayName: displayName,
            summary: summary,
            kind: kind,
            riskLevel: riskLevel,
            adapterKind: adapterKind,
            defaultPermission: defaultPermission,
            requiredScopes: requiredScopes,
            capabilityKeys: capabilityKeys,
            payloadSchema: payloadSchema,
            resultSchema: resultSchema,
            enabled: true,
            createdAt: timestamp,
            updatedAt: timestamp,
            redactionStatus: "private-state-excluded"
        )
    }
}
