import Foundation
import AppKit

public final class RelayConsoleServices {
    public static let temporaryUserDataPathEnvironmentKey = "RELAY_CONSOLE_USER_DATA_PATH"

    public let paths: RelayConsolePaths
    public let database: DatabaseService
    public let eventBus: RelayEventBus
    public let data: LocalDataService
    public let chat: ChatService
    public let organization: AgentOrganizationService
    public let work: AgentWorkDashboardService
    public let agentOps: AgentOpsService
    public let applications: ApplicationsService
    public let insights: InsightsService
    public let providerConnections: ProviderConnectionService
    public let marketplaceInstalls: MarketplaceInstallService
    public let providerActionPolicies: MarketplaceProviderActionPolicyCompilerService
    public let providerActionApprovals: MarketplaceProviderActionApprovalService
    public let providerActionApprovalInbox: MarketplaceProviderActionApprovalInboxService
    public let providerActionBroker: MarketplaceProviderActionBrokerService
    public let providerWrapperTools: RelayProviderWrapperToolCompilerService
    public let marketplaceRuntimeMounts: MarketplaceRuntimeMountService
    public let marketplaceRuntimeToolBridge: MarketplaceRuntimeToolBridgeService
    private let cloudMarketplaceRuntimeToolProxy: CloudMarketplaceRuntimeToolProxy
    public let providerFoundations: MarketplaceProviderFoundationService
    public let toolRequests: ToolRequestService
    public let settingsPreferences: SettingsPreferenceService
    public let settingsStatus: SettingsStatusService
    public let settingsSecurity: SettingsSecurityService
    public let permissions: PermissionPolicyService
    public let auditSecurity: AuditSecurityService
    public let nativeFilePermissions: NativeFilePermissionService
    public let runtimeWorkspace: RuntimeWorkspaceService
    public let hermesCronScheduler: HermesCronSchedulerService
    public let hermesProfileBackups: HermesProfileBackupService
    public let artifacts: ArtifactLibraryService
    public let controlledActions: ControlledActionService
    public let workSafetyTasks: WorkSafetyTaskService
    public let runtimeDashboard: RuntimeDashboardService
    public let runtimeActions: RuntimeActionService
    public let runtimeRecovery: RuntimeRecoveryService
    public let residentAgents: ResidentAgentService
    public let secrets: SecretService
    public let registry: RuntimeBridgeRegistry
    public let dispatch: DispatchService
    public let harnessInstall: HarnessInstallManager
    public let provisioning: AgentProvisioningService
    public let agentTeardown: AgentTeardownService
    public let dataLifecycle: LocalDataLifecycleService
    public let cloudConnections: CloudRelayConnectionService
    public let entitlement: RelayEntitlementService
    public let cloudSync: CloudRelaySyncService
    private var launchRefreshTask: Task<Void, Never>?
    private var marketplaceRuntimeBrokerServer: MarketplaceRuntimeBrokerServer?

    public init(
        userDataPath: URL? = nil,
        appVersion: String = RelayConsoleReleaseMetadata.current.version,
        runner: CommandRunning = ProcessCommandRunner(),
        secretStore: SecretStore = KeychainSecretStore(),
        providerActionAdapter: (any MarketplaceProviderActionAdapter)? = nil,
        applicationsBetaPolicyOverride: ApplicationsBetaPolicy? = nil,
        refreshInstalledHarnessesOnLaunch: Bool = true,
        startRuntimeBrokerServer: Bool? = nil,
        environment: [String: String] = ProcessInfo.processInfo.environment,
        openExternal: @escaping (String) -> Void = { url in
            if let parsed = URL(string: url) {
                NSWorkspace.shared.open(parsed)
            }
        }
    ) throws {
        let effectiveUserDataPath = userDataPath ?? Self.userDataPathOverride(from: environment)
        let paths = try AppPathsService(basePath: effectiveUserDataPath).ensure()
        let database = DatabaseService(databasePath: paths.databasePath)
        try database.open()
        try runMigrations(database: database)
        let eventBus = RelayEventBus()
        let data = LocalDataService(database: database, eventBus: eventBus, appVersion: appVersion)
        let persistedRailwayOrigin = try? data.getAppSetting(
            RelayDeploymentConfiguration.persistedRailwayOriginSettingKey,
            fallback: ""
        )
        let deploymentOrigins = try RelayDeploymentConfiguration.resolve(
            environment: environment,
            infoDictionary: Bundle.main.infoDictionary ?? [:],
            persistedRailwayOrigin: persistedRailwayOrigin?.isEmpty == false ? persistedRailwayOrigin : nil
        )
        RelayCloudLaunchContract.configure(origins: deploymentOrigins)
        let chat = ChatService(data: data, eventBus: eventBus)
        let organization = AgentOrganizationService(data: data)
        let work = AgentWorkDashboardService(data: data)
        let agentOps = AgentOpsService(data: data)
        let applications = ApplicationsService(
            data: data,
            betaPolicyOverride: applicationsBetaPolicyOverride,
            catalogRefreshDataLoader: effectiveUserDataPath == nil ? {
                do {
                    return try await ApplicationsService.loadRailwayMarketplaceCatalogData(
                        origin: RelayCloudLaunchContract.railwayOrigin
                    )
                } catch {
                    return try ApplicationsService.loadBundledMarketplaceCatalogData()
                }
            } : nil,
            catalogPageDataLoader: effectiveUserDataPath == nil ? {
                query, category, cursor, limit in
                do {
                    return try await ApplicationsService.loadRailwayMarketplaceCatalogPageData(
                        origin: RelayCloudLaunchContract.railwayOrigin,
                        query: query,
                        category: category,
                        cursor: cursor,
                        limit: limit
                    )
                } catch {
                    return try ApplicationsService.loadBundledMarketplaceCatalogData()
                }
            } : nil,
            catalogDetailDataLoader: effectiveUserDataPath == nil ? { slug in
                try await ApplicationsService.loadRailwayMarketplaceAppData(
                    origin: RelayCloudLaunchContract.railwayOrigin,
                    slug: slug
                )
            } : nil
        )
        let insights = InsightsService(data: data, eventBus: eventBus)
        let runtimeDashboard = RuntimeDashboardService(data: data)
        let runtimeActions = RuntimeActionService(data: data)
        let runtimeRecovery = RuntimeRecoveryService(data: data)
        let defaultState = try data.ensureDefaultLocalState()
        let permissions = PermissionPolicyService(data: data)
        try permissions.ensureDefaultPolicies(workspaceId: defaultState.workspace.id)
        let secrets = SecretService(database: database, store: secretStore)
        let cloudConnections = CloudRelayConnectionService(database: database, secrets: secrets)
        let entitlement = RelayEntitlementService(
            database: database,
            data: data,
            secrets: secrets,
            connections: cloudConnections
        )
        let cloudSync = CloudRelaySyncService(
            database: database,
            paths: paths,
            data: data,
            connections: cloudConnections,
            entitlement: entitlement,
            eventBus: eventBus
        )
        let providerConnections = ProviderConnectionService(data: data, secrets: secrets)
        let providerActionPolicies = MarketplaceProviderActionPolicyCompilerService(data: data)
        let marketplaceInstalls = MarketplaceInstallService(
            data: data,
            secrets: secrets,
            providerActionPolicies: providerActionPolicies
        )
        let providerActionApprovals = MarketplaceProviderActionApprovalService(data: data)
        let providerActionApprovalInbox = MarketplaceProviderActionApprovalInboxService(data: data)
        let providerFoundations = MarketplaceProviderFoundationService(
            data: data,
            applications: applications,
            policies: providerActionPolicies
        )
        let auditSecurity = AuditSecurityService(data: data)
        let providerWrapperTools = RelayProviderWrapperToolCompilerService(data: data)
        let marketplaceRuntimeMounts = MarketplaceRuntimeMountService(data: data, wrapperTools: providerWrapperTools)
        let providerActionBroker = MarketplaceProviderActionBrokerService(
            data: data,
            approvals: providerActionApprovals,
            auditSecurity: auditSecurity,
            adapter: providerActionAdapter ?? RoutingMarketplaceProviderActionAdapter(
                xAdapter: XProviderActionAdapter(client: LiveXProviderActionClient(data: data, secrets: secrets)),
                blueskyAdapter: BlueskyProviderActionAdapter(
                    client: RailwayBlueskyProviderActionClient(cloudSync: cloudSync)
                ),
                nextdoorAdapter: NextdoorProviderActionAdapter(
                    client: RailwayNextdoorProviderActionClient(cloudSync: cloudSync)
                ),
                meetupAdapter: MeetupProviderActionAdapter(
                    client: RailwayMeetupProviderActionClient(cloudSync: cloudSync)
                ),
                eventbriteAdapter: EventbriteProviderActionAdapter(
                    client: RailwayEventbriteProviderActionClient(cloudSync: cloudSync)
                ),
                lumaAdapter: LumaProviderActionAdapter(
                    client: RailwayLumaProviderActionClient(cloudSync: cloudSync)
                ),
                hopinAdapter: HopinProviderActionAdapter(
                    client: RailwayHopinProviderActionClient(cloudSync: cloudSync)
                ),
                twistAdapter: TwistProviderActionAdapter(
                    client: RailwayTwistProviderActionClient(cloudSync: cloudSync)
                ),
                zohoMailAdapter: ZohoMailProviderActionAdapter(
                    client: RailwayZohoMailProviderActionClient(cloudSync: cloudSync)
                ),
                webexAdapter: WebexProviderActionAdapter(
                    client: RailwayWebexProviderActionClient(cloudSync: cloudSync)
                ),
                goToMeetingAdapter: GoToMeetingProviderActionAdapter(
                    client: RailwayGoToMeetingProviderActionClient(cloudSync: cloudSync)
                ),
                ringCentralAdapter: RingCentralProviderActionAdapter(
                    client: RailwayRingCentralProviderActionClient(cloudSync: cloudSync)
                ),
                dialpadAdapter: DialpadProviderActionAdapter(
                    client: RailwayDialpadProviderActionClient(cloudSync: cloudSync)
                ),
                aircallAdapter: AircallProviderActionAdapter(
                    client: RailwayAircallProviderActionClient(cloudSync: cloudSync)
                ),
                openPhoneAdapter: OpenPhoneProviderActionAdapter(
                    client: RailwayOpenPhoneProviderActionClient(cloudSync: cloudSync)
                ),
                twilioAdapter: TwilioProviderActionAdapter(
                    client: RailwayTwilioProviderActionClient(cloudSync: cloudSync)
                ),
                vonageAdapter: VonageProviderActionAdapter(
                    client: RailwayVonageProviderActionClient(cloudSync: cloudSync)
                ),
                messageBirdAdapter: MessageBirdProviderActionAdapter(
                    client: RailwayMessageBirdProviderActionClient(cloudSync: cloudSync)
                ),
                fredAdapter: FREDProviderActionAdapter(
                    client: RailwayFREDProviderActionClient(cloudSync: cloudSync)
                ),
                apolloGraphOSAdapter: ApolloGraphOSProviderActionAdapter(
                    client: RailwayApolloGraphOSProviderActionClient(cloudSync: cloudSync)
                ),
                hunterAdapter: HunterProviderActionAdapter(
                    client: RailwayHunterProviderActionClient(cloudSync: cloudSync)
                ),
                snovAdapter: SnovProviderActionAdapter(
                    client: RailwaySnovProviderActionClient(cloudSync: cloudSync)
                ),
                lushaAdapter: LushaProviderActionAdapter(
                    client: RailwayLushaProviderActionClient(cloudSync: cloudSync)
                ),
                leadIQAdapter: LeadIQProviderActionAdapter(
                    client: RailwayLeadIQProviderActionClient(cloudSync: cloudSync)
                ),
                seamlessAIAdapter: SeamlessAIProviderActionAdapter(
                    client: RailwaySeamlessAIProviderActionClient(cloudSync: cloudSync)
                ),
                rocketReachAdapter: RocketReachProviderActionAdapter(
                    client: RailwayRocketReachProviderActionClient(cloudSync: cloudSync)
                ),
                upLeadAdapter: UpLeadProviderActionAdapter(
                    client: RailwayUpLeadProviderActionClient(cloudSync: cloudSync)
                ),
                wizaAdapter: WizaProviderActionAdapter(
                    client: RailwayWizaProviderActionClient(cloudSync: cloudSync)
                ),
                lineAdapter: LINEProviderActionAdapter(
                    client: RailwayLINEProviderActionClient(cloudSync: cloudSync)
                ),
                linkedInAdapter: LinkedInProviderActionAdapter(
                    client: LiveLinkedInProviderActionClient(data: data, secrets: secrets)
                ),
                gmailAdapter: GmailProviderActionAdapter(
                    client: LiveGmailProviderActionClient(data: data, secrets: secrets)
                ),
                googleDocsAdapter: GoogleDocsProviderActionAdapter(
                    client: LiveGoogleDocsProviderActionClient(data: data, secrets: secrets)
                ),
                googleSearchConsoleAdapter: GoogleSearchConsoleProviderActionAdapter(
                    client: LiveGoogleSearchConsoleProviderActionClient(data: data, secrets: secrets)
                ),
                slackAdapter: SlackProviderActionAdapter(
                    client: LiveSlackProviderActionClient(data: data, secrets: secrets)
                ),
                githubAdapter: GitHubProviderActionAdapter(
                    client: LiveGitHubProviderActionClient(data: data, secrets: secrets)
                ),
                gitLabAdapter: GitLabProviderActionAdapter(
                    client: LiveGitLabProviderActionClient(data: data, secrets: secrets)
                ),
                bitbucketAdapter: BitbucketProviderActionAdapter(
                    client: LiveBitbucketProviderActionClient(data: data, secrets: secrets)
                ),
                asanaAdapter: AsanaProviderActionAdapter(
                    client: LiveAsanaProviderActionClient(data: data, secrets: secrets)
                ),
                trelloAdapter: TrelloProviderActionAdapter(
                    client: LiveTrelloProviderActionClient(data: data, secrets: secrets)
                ),
                clickUpAdapter: ClickUpProviderActionAdapter(
                    client: LiveClickUpProviderActionClient(data: data, secrets: secrets)
                ),
                mondayAdapter: MondayProviderActionAdapter(
                    client: LiveMondayProviderActionClient(data: data, secrets: secrets)
                ),
                airtableAdapter: AirtableProviderActionAdapter(
                    client: LiveAirtableProviderActionClient(data: data, secrets: secrets)
                ),
                dropboxAdapter: DropboxProviderActionAdapter(
                    client: LiveDropboxProviderActionClient(data: data, secrets: secrets)
                ),
                boxAdapter: BoxProviderActionAdapter(
                    client: LiveBoxProviderActionClient(data: data, secrets: secrets)
                ),
                figmaAdapter: FigmaProviderActionAdapter(
                    client: LiveFigmaProviderActionClient(data: data, secrets: secrets)
                ),
                miroAdapter: MiroProviderActionAdapter(
                    client: LiveMiroProviderActionClient(data: data, secrets: secrets)
                ),
                canvaAdapter: CanvaProviderActionAdapter(
                    client: LiveCanvaProviderActionClient(data: data, secrets: secrets)
                ),
                webflowAdapter: WebflowProviderActionAdapter(
                    client: LiveWebflowProviderActionClient(data: data, secrets: secrets)
                ),
                wordpressComAdapter: WordPressComProviderActionAdapter(
                    client: LiveWordPressComProviderActionClient(data: data, secrets: secrets)
                ),
                contentfulAdapter: ContentfulProviderActionAdapter(
                    client: LiveContentfulProviderActionClient(data: data, secrets: secrets)
                ),
                shopifyAdapter: ShopifyProviderActionAdapter(
                    client: LiveShopifyProviderActionClient(data: data, secrets: secrets)
                ),
                wooCommerceAdapter: WooCommerceProviderActionAdapter(
                    client: LiveWooCommerceProviderActionClient(data: data, secrets: secrets)
                ),
                stripeAdapter: StripeProviderActionAdapter(
                    client: LiveStripeProviderActionClient(data: data, secrets: secrets)
                ),
                payPalAdapter: PayPalProviderActionAdapter(
                    client: LivePayPalProviderActionClient(data: data, secrets: secrets)
                ),
                xeroAdapter: XeroProviderActionAdapter(
                    client: LiveXeroProviderActionClient(data: data, secrets: secrets)
                ),
                quickBooksAdapter: QuickBooksProviderActionAdapter(
                    client: LiveQuickBooksProviderActionClient(data: data, secrets: secrets)
                ),
                freshBooksAdapter: FreshBooksProviderActionAdapter(
                    client: LiveFreshBooksProviderActionClient(data: data, secrets: secrets)
                ),
                waveAdapter: WaveProviderActionAdapter(
                    client: LiveWaveProviderActionClient(data: data, secrets: secrets)
                ),
                freeAgentAdapter: FreeAgentProviderActionAdapter(
                    client: LiveFreeAgentProviderActionClient(data: data, secrets: secrets)
                ),
                salesforceAdapter: SalesforceProviderActionAdapter(
                    client: LiveSalesforceProviderActionClient(data: data, secrets: secrets)
                ),
                hubSpotAdapter: HubSpotProviderActionAdapter(
                    client: LiveHubSpotProviderActionClient(data: data, secrets: secrets)
                ),
                pipedriveAdapter: PipedriveProviderActionAdapter(
                    client: LivePipedriveProviderActionClient(data: data, secrets: secrets)
                ),
                copperAdapter: CopperProviderActionAdapter(
                    client: LiveCopperProviderActionClient(data: data, secrets: secrets)
                ),
                closeAdapter: CloseProviderActionAdapter(
                    client: LiveCloseProviderActionClient(data: data, secrets: secrets)
                ),
                zendeskAdapter: ZendeskProviderActionAdapter(
                    client: LiveZendeskProviderActionClient(data: data, secrets: secrets)
                ),
                intercomAdapter: IntercomProviderActionAdapter(
                    client: LiveIntercomProviderActionClient(data: data, secrets: secrets)
                ),
                helpScoutAdapter: HelpScoutProviderActionAdapter(
                    client: LiveHelpScoutProviderActionClient(data: data, secrets: secrets)
                ),
                frontAdapter: FrontProviderActionAdapter(
                    client: LiveFrontProviderActionClient(data: data, secrets: secrets)
                ),
                teamworkAdapter: TeamworkProviderActionAdapter(
                    client: LiveTeamworkProviderActionClient(data: data, secrets: secrets)
                ),
                basecampAdapter: BasecampProviderActionAdapter(
                    client: LiveBasecampProviderActionClient(data: data, secrets: secrets)
                ),
                wrikeAdapter: WrikeProviderActionAdapter(
                    client: LiveWrikeProviderActionClient(data: data, secrets: secrets)
                ),
                smartsheetAdapter: SmartsheetProviderActionAdapter(
                    client: LiveSmartsheetProviderActionClient(data: data, secrets: secrets)
                ),
                todoistAdapter: TodoistProviderActionAdapter(
                    client: LiveTodoistProviderActionClient(data: data, secrets: secrets)
                ),
                harvestAdapter: HarvestProviderActionAdapter(
                    client: LiveHarvestProviderActionClient(data: data, secrets: secrets)
                ),
                calendlyAdapter: CalendlyProviderActionAdapter(
                    client: LiveCalendlyProviderActionClient(data: data, secrets: secrets)
                ),
                calComAdapter: CalComProviderActionAdapter(
                    client: LiveCalComProviderActionClient(data: data, secrets: secrets)
                ),
                docusignAdapter: DocusignProviderActionAdapter(
                    client: LiveDocusignProviderActionClient(data: data, secrets: secrets)
                ),
                dropboxSignAdapter: DropboxSignProviderActionAdapter(
                    client: LiveDropboxSignProviderActionClient(data: data, secrets: secrets)
                ),
                pandaDocAdapter: PandaDocProviderActionAdapter(
                    client: LivePandaDocProviderActionClient(data: data, secrets: secrets)
                ),
                typeformAdapter: TypeformProviderActionAdapter(
                    client: LiveTypeformProviderActionClient(data: data, secrets: secrets)
                ),
                sendFoxAdapter: SendFoxProviderActionAdapter(
                    client: LiveSendFoxProviderActionClient(data: data, secrets: secrets)
                ),
                beehiivAdapter: BeehiivProviderActionAdapter(
                    client: LiveBeehiivProviderActionClient(data: data, secrets: secrets)
                ),
                substackAdapter: SubstackProviderActionAdapter(
                    client: LiveSubstackProviderActionClient(data: data, secrets: secrets)
                ),
                hootsuiteAdapter: HootsuiteProviderActionAdapter(
                    client: LiveHootsuiteProviderActionClient(data: data, secrets: secrets)
                ),
                bufferAdapter: BufferProviderActionAdapter(
                    client: LiveBufferProviderActionClient(data: data, secrets: secrets)
                ),
                sproutSocialAdapter: SproutSocialProviderActionAdapter(
                    client: LiveSproutSocialProviderActionClient(data: data, secrets: secrets)
                ),
                agorapulseAdapter: AgorapulseProviderActionAdapter(
                    client: LiveAgorapulseProviderActionClient(data: data, secrets: secrets)
                ),
                metricoolAdapter: MetricoolProviderActionAdapter(
                    client: LiveMetricoolProviderActionClient(data: data, secrets: secrets)
                ),
                publerAdapter: PublerProviderActionAdapter(
                    client: LivePublerProviderActionClient(data: data, secrets: secrets)
                ),
                brandwatchAdapter: BrandwatchProviderActionAdapter(
                    client: LiveBrandwatchProviderActionClient(data: data, secrets: secrets)
                ),
                mentionAdapter: MentionProviderActionAdapter(
                    client: LiveMentionProviderActionClient(data: data, secrets: secrets)
                ),
                meltwaterAdapter: MeltwaterProviderActionAdapter(
                    client: LiveMeltwaterProviderActionClient(data: data, secrets: secrets)
                ),
                sprinklrAdapter: SprinklrProviderActionAdapter(
                    client: LiveSprinklrProviderActionClient(data: data, secrets: secrets)
                ),
                khorosAdapter: KhorosProviderActionAdapter(
                    client: LiveKhorosProviderActionClient(data: data, secrets: secrets)
                ),
                cleverTapAdapter: CleverTapProviderActionAdapter(
                    client: LiveCleverTapProviderActionClient(data: data, secrets: secrets)
                ),
                oneSignalAdapter: OneSignalProviderActionAdapter(
                    client: LiveOneSignalProviderActionClient(data: data, secrets: secrets)
                ),
                airshipAdapter: AirshipProviderActionAdapter(
                    client: LiveAirshipProviderActionClient(data: data, secrets: secrets)
                ),
                pushwooshAdapter: PushwooshProviderActionAdapter(
                    client: LivePushwooshProviderActionClient(data: data, secrets: secrets)
                ),
                pusherBeamsAdapter: PusherBeamsProviderActionAdapter(
                    client: LivePusherBeamsProviderActionClient(data: data, secrets: secrets)
                ),
                firebaseCloudMessagingAdapter: FirebaseCloudMessagingProviderActionAdapter(
                    client: RailwayFirebaseCloudMessagingProviderActionClient(cloudSync: cloudSync)
                ),
                appsFlyerAdapter: AppsFlyerProviderActionAdapter(
                    client: LiveAppsFlyerProviderActionClient(data: data, secrets: secrets)
                ),
                adjustAdapter: AdjustProviderActionAdapter(
                    client: LiveAdjustProviderActionClient(data: data, secrets: secrets)
                ),
                branchAdapter: BranchProviderActionAdapter(
                    client: LiveBranchProviderActionClient(data: data, secrets: secrets)
                ),
                singularAdapter: SingularProviderActionAdapter(
                    client: LiveSingularProviderActionClient(data: data, secrets: secrets)
                ),
                kochavaAdapter: KochavaProviderActionAdapter(
                    client: LiveKochavaProviderActionClient(data: data, secrets: secrets)
                ),
                segmentAdapter: SegmentProviderActionAdapter(
                    client: LiveSegmentProviderActionClient(data: data, secrets: secrets)
                ),
                mParticleAdapter: MParticleProviderActionAdapter(
                    client: LiveMParticleProviderActionClient(data: data, secrets: secrets)
                ),
                tealiumAdapter: TealiumProviderActionAdapter(
                    client: LiveTealiumProviderActionClient(data: data, secrets: secrets)
                ),
                lyticsAdapter: LyticsProviderActionAdapter(
                    client: LiveLyticsProviderActionClient(data: data, secrets: secrets)
                ),
                blueConicAdapter: BlueConicProviderActionAdapter(
                    client: LiveBlueConicProviderActionClient(data: data, secrets: secrets)
                ),
                treasureDataAdapter: TreasureDataProviderActionAdapter(
                    client: LiveTreasureDataProviderActionClient(data: data, secrets: secrets)
                ),
                hightouchAdapter: HightouchProviderActionAdapter(
                    client: LiveHightouchProviderActionClient(data: data, secrets: secrets)
                ),
                censusAdapter: CensusProviderActionAdapter(
                    client: LiveCensusProviderActionClient(data: data, secrets: secrets)
                ),
                clioManageAdapter: ClioManageProviderActionAdapter(
                    client: LiveClioManageProviderActionClient(data: data, secrets: secrets)
                ),
                clioGrowAdapter: ClioGrowProviderActionAdapter(
                    client: LiveClioGrowProviderActionClient(data: data, secrets: secrets)
                ),
                myCaseAdapter: MyCaseProviderActionAdapter(
                    client: LiveMyCaseProviderActionClient(data: data, secrets: secrets)
                ),
                practicePantherAdapter: PracticePantherProviderActionAdapter(
                    client: LivePracticePantherProviderActionClient(data: data, secrets: secrets)
                ),
                smokeballAdapter: SmokeballProviderActionAdapter(
                    client: LiveSmokeballProviderActionClient(data: data, secrets: secrets)
                ),
                lawPayAdapter: LawPayProviderActionAdapter(
                    client: LiveLawPayProviderActionClient(data: data, secrets: secrets)
                ),
                filevineAdapter: FilevineProviderActionAdapter(
                    client: LiveFilevineProviderActionClient(data: data, secrets: secrets)
                ),
                laterAdapter: LaterProviderActionAdapter(
                    client: LiveLaterProviderActionClient(data: data, secrets: secrets)
                ),
                surveyMonkeyAdapter: SurveyMonkeyProviderActionAdapter(
                    client: LiveSurveyMonkeyProviderActionClient(data: data, secrets: secrets)
                ),
                filloutAdapter: FilloutProviderActionAdapter(
                    client: LiveFilloutProviderActionClient(data: data, secrets: secrets)
                ),
                mailchimpAdapter: MailchimpProviderActionAdapter(
                    client: LiveMailchimpProviderActionClient(data: data, secrets: secrets)
                ),
                klaviyoAdapter: KlaviyoProviderActionAdapter(
                    client: LiveKlaviyoProviderActionClient(data: data, secrets: secrets)
                ),
                convertKitAdapter: ConvertKitProviderActionAdapter(
                    client: LiveConvertKitProviderActionClient(data: data, secrets: secrets)
                ),
                campaignMonitorAdapter: CampaignMonitorProviderActionAdapter(
                    client: LiveCampaignMonitorProviderActionClient(data: data, secrets: secrets)
                ),
                notionAdapter: NotionProviderActionAdapter(
                    client: LiveNotionProviderActionClient(data: data, secrets: secrets)
                ),
                microsoftClarityAdapter: MicrosoftClarityProviderActionAdapter(
                    data: data,
                    secrets: secrets
                ),
                postHogAdapter: PostHogProviderActionAdapter(
                    client: LivePostHogProviderActionClient(data: data, secrets: secrets)
                ),
                telemetryDeckAdapter: TelemetryDeckProviderActionAdapter(
                    client: LiveTelemetryDeckProviderActionClient(data: data, secrets: secrets)
                ),
                sentryAdapter: SentryProviderActionAdapter(
                    client: LiveSentryProviderActionClient(data: data, secrets: secrets)
                ),
                datadogAdapter: DatadogProviderActionAdapter(
                    client: LiveDatadogProviderActionClient(data: data, secrets: secrets)
                ),
                pagerDutyAdapter: PagerDutyProviderActionAdapter(
                    client: LivePagerDutyProviderActionClient(data: data, secrets: secrets)
                ),
                cloudflareAdapter: CloudflareProviderActionAdapter(
                    client: LiveCloudflareProviderActionClient(data: data, secrets: secrets)
                ),
                vercelAdapter: VercelProviderActionAdapter(
                    client: LiveVercelProviderActionClient(data: data, secrets: secrets)
                ),
                herokuAdapter: HerokuProviderActionAdapter(
                    client: LiveHerokuProviderActionClient(data: data, secrets: secrets)
                ),
                digitalOceanAdapter: DigitalOceanProviderActionAdapter(
                    client: LiveDigitalOceanProviderActionClient(data: data, secrets: secrets)
                ),
                firebaseAdapter: FirebaseProviderActionAdapter(
                    client: LiveFirebaseProviderActionClient(data: data, secrets: secrets)
                ),
                supabaseAdapter: SupabaseProviderActionAdapter(
                    client: LiveSupabaseProviderActionClient(data: data, secrets: secrets)
                ),
                oktaAdapter: OktaProviderActionAdapter(
                    client: LiveOktaProviderActionClient(data: data, secrets: secrets)
                ),
                bambooHRAdapter: BambooHRProviderActionAdapter(
                    client: LiveBambooHRProviderActionClient(data: data, secrets: secrets)
                ),
                greenhouseAdapter: GreenhouseProviderActionAdapter(
                    client: LiveGreenhouseProviderActionClient(data: data, secrets: secrets)
                ),
                leverAdapter: LeverProviderActionAdapter(
                    client: LiveLeverProviderActionClient(data: data, secrets: secrets)
                ),
                googleCalendarAdapter: GoogleCalendarProviderActionAdapter(
                    client: LiveGoogleCalendarProviderActionClient(data: data, secrets: secrets)
                ),
                googleDriveAdapter: GoogleDriveProviderActionAdapter(
                    client: LiveGoogleDriveProviderActionClient(data: data, secrets: secrets)
                ),
                googleSheetsAdapter: GoogleSheetsProviderActionAdapter(
                    client: LiveGoogleSheetsProviderActionClient(data: data, secrets: secrets)
                ),
                googleSlidesAdapter: GoogleSlidesProviderActionAdapter(
                    client: LiveGoogleSlidesProviderActionClient(data: data, secrets: secrets)
                ),
                googleFormsAdapter: GoogleFormsProviderActionAdapter(
                    client: LiveGoogleFormsProviderActionClient(data: data, secrets: secrets)
                ),
                googleTasksAdapter: GoogleTasksProviderActionAdapter(
                    client: LiveGoogleTasksProviderActionClient(data: data, secrets: secrets)
                ),
                googleContactsAdapter: GoogleContactsProviderActionAdapter(
                    client: LiveGoogleContactsProviderActionClient(data: data, secrets: secrets)
                ),
                googlePhotosAdapter: GooglePhotosProviderActionAdapter(
                    client: LiveGooglePhotosProviderActionClient(data: data, secrets: secrets)
                ),
                googleMeetAdapter: GoogleMeetProviderActionAdapter(
                    client: LiveGoogleMeetProviderActionClient(data: data, secrets: secrets)
                ),
                googleChatAdapter: GoogleChatProviderActionAdapter(
                    client: LiveGoogleChatProviderActionClient(data: data, secrets: secrets)
                ),
                googleAdsAdapter: GoogleAdsProviderActionAdapter(
                    client: LiveGoogleAdsProviderActionClient(data: data, secrets: secrets)
                ),
                googleAnalyticsAdapter: GoogleAnalyticsProviderActionAdapter(
                    client: LiveGoogleAnalyticsProviderActionClient(data: data, secrets: secrets)
                ),
                googleMerchantCenterAdapter: GoogleMerchantCenterProviderActionAdapter(
                    client: LiveGoogleMerchantCenterProviderActionClient(data: data, secrets: secrets)
                ),
                youTubeAdapter: YouTubeProviderActionAdapter(
                    client: LiveYouTubeProviderActionClient(data: data, secrets: secrets)
                ),
                googleClassroomAdapter: GoogleClassroomProviderActionAdapter(
                    client: LiveGoogleClassroomProviderActionClient(data: data, secrets: secrets)
                ),
                outlookAdapter: OutlookProviderActionAdapter(
                    client: LiveOutlookProviderActionClient(data: data, secrets: secrets)
                ),
                microsoftTeamsAdapter: MicrosoftTeamsProviderActionAdapter(
                    client: LiveMicrosoftTeamsProviderActionClient(data: data, secrets: secrets)
                ),
                oneDriveAdapter: OneDriveProviderActionAdapter(
                    client: LiveOneDriveProviderActionClient(data: data, secrets: secrets)
                ),
                sharePointAdapter: SharePointProviderActionAdapter(
                    client: LiveSharePointProviderActionClient(data: data, secrets: secrets)
                ),
                microsoftPlannerAdapter: MicrosoftPlannerProviderActionAdapter(
                    client: LiveMicrosoftPlannerProviderActionClient(data: data, secrets: secrets)
                ),
                microsoftToDoAdapter: MicrosoftToDoProviderActionAdapter(
                    client: LiveMicrosoftToDoProviderActionClient(data: data, secrets: secrets)
                ),
                microsoftListsAdapter: MicrosoftListsProviderActionAdapter(
                    client: LiveMicrosoftListsProviderActionClient(data: data, secrets: secrets)
                ),
                oneNoteAdapter: OneNoteProviderActionAdapter(
                    client: LiveOneNoteProviderActionClient(data: data, secrets: secrets)
                ),
                microsoftBookingsAdapter: MicrosoftBookingsProviderActionAdapter(
                    client: LiveMicrosoftBookingsProviderActionClient(data: data, secrets: secrets)
                ),
                microsoftPowerBIAdapter: MicrosoftPowerBIProviderActionAdapter(
                    client: LiveMicrosoftPowerBIProviderActionClient(data: data, secrets: secrets)
                ),
                microsoftDynamics365Adapter: MicrosoftDynamics365ProviderActionAdapter(
                    client: LiveMicrosoftDynamics365ProviderActionClient(data: data, secrets: secrets)
                ),
                microsoftVivaEngageAdapter: MicrosoftVivaEngageProviderActionAdapter(
                    client: LiveMicrosoftVivaEngageProviderActionClient(data: data, secrets: secrets)
                ),
                zoomAdapter: ZoomProviderActionAdapter(
                    client: LiveZoomProviderActionClient(data: data, secrets: secrets)
                ),
                discordAdapter: DiscordProviderActionAdapter(
                    client: LiveDiscordProviderActionClient(data: data, secrets: secrets)
                )
            )
        )
        let cloudMarketplaceRuntimeToolProxy = CloudMarketplaceRuntimeToolProxy()
        let marketplaceRuntimeToolBridge = MarketplaceRuntimeToolBridgeService(
            data: data,
            runtimeMounts: marketplaceRuntimeMounts,
            broker: providerActionBroker,
            cloudProxy: cloudMarketplaceRuntimeToolProxy,
            openExternal: openExternal
        )
        let toolRequests = ToolRequestService(data: data, permissions: permissions, auditSecurity: auditSecurity)
        let settingsPreferences = SettingsPreferenceService(data: data, eventBus: eventBus)
        let settingsStatus = SettingsStatusService(data: data, eventBus: eventBus)
        let settingsSecurity = SettingsSecurityService(data: data, eventBus: eventBus, auditSecurity: auditSecurity)
        let nativeFilePermissions = NativeFilePermissionService(data: data, permissions: permissions, auditSecurity: auditSecurity)
        let hermesProfileBackups = HermesProfileBackupService(
            backupsRoot: paths.hermesProfileBackupsDir
        )
        let runtimeWorkspace = RuntimeWorkspaceService(
            paths: paths,
            nativeFilePermissions: nativeFilePermissions,
            database: database,
            hermesProfileBackups: hermesProfileBackups
        )
        let hermesCronScheduler = HermesCronSchedulerService(paths: paths, runner: runner)
        let artifacts = ArtifactLibraryService(paths: paths, hermesCronScheduler: hermesCronScheduler)
        let controlledActions = ControlledActionService(
            data: data,
            permissions: permissions,
            auditSecurity: auditSecurity,
            nativeFilePermissions: nativeFilePermissions
        )
        let workSafetyTasks = WorkSafetyTaskService(data: data, permissions: permissions)
        let harnessInstall = HarnessInstallManager(
            paths: paths,
            data: data,
            runner: runner,
            eventBus: eventBus,
            marketplaceRuntimeMounts: marketplaceRuntimeMounts,
            cloudMarketplaceRuntimeToolProxy: cloudMarketplaceRuntimeToolProxy,
            hermesCronScheduler: hermesCronScheduler,
            hermesProfileBackups: hermesProfileBackups,
            openExternal: openExternal
        )
        harnessInstall.runHermesLegacyRuntimeOverrideMigrationIfNeeded()
        let provisioning = AgentProvisioningService(data: data, harnessInstall: harnessInstall)
        let agentTeardown = AgentTeardownService(data: data, harnessInstall: harnessInstall)
        let dataLifecycle = LocalDataLifecycleService(
            paths: paths,
            database: database,
            secrets: secrets,
            harnessInstall: harnessInstall,
            hermesCronScheduler: hermesCronScheduler
        )
        let residentAgents = ResidentAgentService(
            data: data,
            chat: chat,
            provisioning: provisioning,
            harnessInstall: harnessInstall,
            runtimeWorkspace: runtimeWorkspace
        )
        let registry = RuntimeBridgeRegistry()
        registry.register(HermesAgentAdapter(installManager: harnessInstall))
        registry.register(OpenClawAdapter(installManager: harnessInstall))
        let dispatch = DispatchService(
            paths: paths,
            data: data,
            registry: registry,
            entitlement: entitlement,
            eventBus: eventBus
        )
        self.paths = paths
        self.database = database
        self.eventBus = eventBus
        self.data = data
        self.chat = chat
        self.organization = organization
        self.work = work
        self.agentOps = agentOps
        self.applications = applications
        self.insights = insights
        self.providerConnections = providerConnections
        self.marketplaceInstalls = marketplaceInstalls
        self.providerActionPolicies = providerActionPolicies
        self.providerActionApprovals = providerActionApprovals
        self.providerActionApprovalInbox = providerActionApprovalInbox
        self.providerActionBroker = providerActionBroker
        self.providerWrapperTools = providerWrapperTools
        self.marketplaceRuntimeMounts = marketplaceRuntimeMounts
        self.marketplaceRuntimeToolBridge = marketplaceRuntimeToolBridge
        self.cloudMarketplaceRuntimeToolProxy = cloudMarketplaceRuntimeToolProxy
        self.providerFoundations = providerFoundations
        self.toolRequests = toolRequests
        self.settingsPreferences = settingsPreferences
        self.settingsStatus = settingsStatus
        self.settingsSecurity = settingsSecurity
        self.permissions = permissions
        self.auditSecurity = auditSecurity
        self.nativeFilePermissions = nativeFilePermissions
        self.runtimeWorkspace = runtimeWorkspace
        self.hermesCronScheduler = hermesCronScheduler
        self.hermesProfileBackups = hermesProfileBackups
        self.artifacts = artifacts
        self.controlledActions = controlledActions
        self.workSafetyTasks = workSafetyTasks
        self.runtimeDashboard = runtimeDashboard
        self.runtimeActions = runtimeActions
        self.runtimeRecovery = runtimeRecovery
        self.residentAgents = residentAgents
        self.secrets = secrets
        self.registry = registry
        self.dispatch = dispatch
        self.harnessInstall = harnessInstall
        self.provisioning = provisioning
        self.agentTeardown = agentTeardown
        self.dataLifecycle = dataLifecycle
        self.cloudConnections = cloudConnections
        self.entitlement = entitlement
        self.cloudSync = cloudSync
        cloudSync.startAutomaticSync()
        _ = try? data.log(severity: "info", category: "app", message: "Relay Console initialized.")
        if startRuntimeBrokerServer ?? refreshInstalledHarnessesOnLaunch {
            let brokerServer = MarketplaceRuntimeBrokerServer(root: paths.root, bridge: marketplaceRuntimeToolBridge)
            try brokerServer.start()
            marketplaceRuntimeBrokerServer = brokerServer
        }
        if refreshInstalledHarnessesOnLaunch {
            // User-owned runtimes are never started, updated, or inspected just
            // because Relay Console launched. Health checks are explicit.
            launchRefreshTask = nil
        }
    }

    public func cloudRuntimeDeviceTransport(using transport: RelayCloudTransport) -> CloudRuntimeDeviceTransport {
        CloudRuntimeDeviceTransport(
            database: database,
            data: data,
            secrets: secrets,
            registry: registry,
            harnessInstall: harnessInstall,
            transport: transport,
            marketplaceToolProxy: cloudMarketplaceRuntimeToolProxy
        )
    }

    deinit {
        launchRefreshTask?.cancel()
        marketplaceRuntimeBrokerServer?.stop()
        harnessInstall.stopAll()
        database.close()
    }

    public static func userDataPathOverride(from environment: [String: String]) -> URL? {
        guard let rawValue = environment[temporaryUserDataPathEnvironmentKey] else {
            return nil
        }
        let trimmed = rawValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            return nil
        }
        return URL(fileURLWithPath: trimmed, isDirectory: true)
    }
}
