import Foundation

public final class ProviderConnectionService {
  public static let xRelayOwnedOAuthScopes = [
    "tweet.read", "users.read", "tweet.write", "offline.access",
  ]
  public static let facebookPagesRelayOwnedOAuthScopes = [
    "pages_show_list", "pages_read_engagement", "pages_manage_posts",
  ]
  public static let instagramBusinessRelayOwnedOAuthScopes = ["instagram_business_basic"]
  public static let threadsRelayOwnedOAuthScopes = ["threads_basic", "threads_content_publish"]
  public static let pinterestRelayOwnedOAuthScopes = [
    "user_accounts:read", "boards:read", "pins:read",
  ]
  public static let tumblrRelayOwnedOAuthScopes = ["basic", "offline_access"]
  public static let mastodonRelayOwnedOAuthScopes = [
    "read:accounts", "read:statuses", "write:statuses",
  ]
  public static let blueskyRelayOwnedOAuthScopes = [
    "atproto", "repo:app.bsky.feed.post?action=create",
  ]
  public static let nextdoorRelayOwnedOAuthScopes = [
    "openid", "profile:read", "post:read", "post:write",
  ]
  public static let lineRelayOwnedOAuthScopes = ["profile", "openid"]
  public static let linkedInManualTokenScopes = ["openid", "profile", "email", "w_member_social"]
  public static let linkedInRelayOwnedOAuthScopes = ["openid", "profile", "w_member_social"]
  public static let gmailOAuthScopes = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.compose",
  ]
  public static let googleDocsOAuthScopes = [
    "https://www.googleapis.com/auth/documents.readonly",
    "https://www.googleapis.com/auth/documents",
  ]
  public static let googleDocsRelayOwnedOAuthScopes = [
    "https://www.googleapis.com/auth/drive.file"
  ]
  public static let googleDriveOAuthScopes = [
    "https://www.googleapis.com/auth/drive.metadata.readonly",
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/drive.file",
  ]
  public static let googleDriveRelayOwnedOAuthScopes = [
    "https://www.googleapis.com/auth/drive.file"
  ]
  public static let googleSheetsRelayOwnedOAuthScopes = [
    "https://www.googleapis.com/auth/drive.file"
  ]
  public static let googleSlidesRelayOwnedOAuthScopes = [
    "https://www.googleapis.com/auth/drive.file"
  ]
  public static let googleFormsRelayOwnedOAuthScopes = [
    "https://www.googleapis.com/auth/drive.file"
  ]
  public static let googleTasksRelayOwnedOAuthScopes = [
    "https://www.googleapis.com/auth/tasks"
  ]
  public static let googleContactsRelayOwnedOAuthScopes = [
    "https://www.googleapis.com/auth/contacts"
  ]
  public static let googlePhotosRelayOwnedOAuthScopes = [
    "https://www.googleapis.com/auth/photospicker.mediaitems.readonly"
  ]
  public static let googleMeetRelayOwnedOAuthScopes = [
    "https://www.googleapis.com/auth/meetings.space.created"
  ]
  public static let googleChatRelayOwnedOAuthScopes = [
    "https://www.googleapis.com/auth/chat.spaces.readonly",
    "https://www.googleapis.com/auth/chat.messages.readonly",
    "https://www.googleapis.com/auth/chat.messages.create",
  ]
  public static let googleAdsRelayOwnedOAuthScopes = [
    "https://www.googleapis.com/auth/adwords"
  ]
  public static let googleCalendarOAuthScopes = [
    "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
    "https://www.googleapis.com/auth/calendar.events.readonly",
    "https://www.googleapis.com/auth/calendar.events.freebusy",
    "https://www.googleapis.com/auth/calendar.events",
  ]
  public static let googleCalendarRelayOwnedOAuthScopes = [
    "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
    "https://www.googleapis.com/auth/calendar.events.freebusy",
    "https://www.googleapis.com/auth/calendar.events",
  ]
  public static let googleAnalyticsOAuthScopes = [
    "https://www.googleapis.com/auth/analytics.readonly"
  ]
  public static let googleAnalyticsRelayOwnedOAuthScopes = googleAnalyticsOAuthScopes
  public static let googleSearchConsoleOAuthScopes = [
    "https://www.googleapis.com/auth/webmasters.readonly"
  ]
  public static let googleSearchConsoleRelayOwnedOAuthScopes = googleSearchConsoleOAuthScopes
  public static let googleMerchantCenterRelayOwnedOAuthScopes = [
    "https://www.googleapis.com/auth/content"
  ]
  public static let youTubeRelayOwnedOAuthScopes = [
    "https://www.googleapis.com/auth/youtube.readonly"
  ]
  public static let googleClassroomRelayOwnedOAuthScopes = [
    "https://www.googleapis.com/auth/classroom.courses.readonly",
    "https://www.googleapis.com/auth/classroom.coursework.me.readonly",
    "https://www.googleapis.com/auth/classroom.courseworkmaterials.readonly",
  ]
  public static let outlookRelayOwnedOAuthScopes = ["https://graph.microsoft.com/Mail.Read"]
  public static let microsoftTeamsRelayOwnedOAuthScopes = [
    "https://graph.microsoft.com/Team.ReadBasic.All",
    "https://graph.microsoft.com/Channel.ReadBasic.All",
  ]
  public static let oneDriveRelayOwnedOAuthScopes = ["https://graph.microsoft.com/Files.Read"]
  public static let sharePointRelayOwnedOAuthScopes = ["https://graph.microsoft.com/Sites.Selected"]
  public static let microsoftPlannerRelayOwnedOAuthScopes = [
    "https://graph.microsoft.com/Tasks.Read"
  ]
  public static let microsoftToDoRelayOwnedOAuthScopes = ["https://graph.microsoft.com/Tasks.Read"]
  public static let microsoftListsRelayOwnedOAuthScopes = [
    "https://graph.microsoft.com/Lists.SelectedOperations.Selected"
  ]
  public static let oneNoteRelayOwnedOAuthScopes = ["https://graph.microsoft.com/Notes.Read"]
  public static let microsoftBookingsRelayOwnedOAuthScopes = [
    "https://graph.microsoft.com/Bookings.Read.All"
  ]
  public static let microsoftPowerBIRelayOwnedOAuthScopes = [
    "https://analysis.windows.net/powerbi/api/Workspace.Read.All",
    "https://analysis.windows.net/powerbi/api/Report.Read.All",
    "https://analysis.windows.net/powerbi/api/Dataset.Read.All",
  ]
  public static let postHogReadScopes = [
    "organization:read",
    "project:read",
    "dashboard:read",
    "insight:read",
    "query:read",
    "event_definition:read",
    "property_definition:read",
  ]
  public static let microsoftClarityDataExportCapabilities = [
    "clarity_data_export_api",
    "project_live_insights_read",
  ]
  public static let sentryAuthTokenScopes = [
    "org:read",
    "project:read",
    "event:read",
    "event:write",
  ]
  public static let datadogReadScopes = [
    "monitors_read", "incident_read", "apm_service_catalog_read",
  ]
  public static let pagerDutyReadScopes = ["openid", "incidents.read", "services.read"]
  public static let cloudflareReadScopes = ["zone.read", "analytics.read", "offline_access"]
  public static let vercelReadScopes = ["project:read", "deployment:read"]
  public static let herokuReadScopes = ["read"]
  public static let digitalOceanReadScopes = [
    "project:read", "droplet:read", "app:read", "regions:read", "sizes:read", "actions:read",
    "image:read",
  ]
  public static let firebaseReadScopes = ["https://www.googleapis.com/auth/firebase.readonly"]
  public static let supabaseReadScopes = ["organizations:read", "projects:read"]
  public static let oktaReadScopes = ["okta.apps.read"]
  public static let bambooHRReadScopes = ["field", "meta", "offline_access"]
  public static let greenhouseReadScopes = [
    "harvest:jobs:list", "harvest:offices:list", "harvest:departments:list",
  ]
  public static let leverReadScopes = [
    "offline_access", "postings:read:admin", "stages:read:admin",
  ]
  public static func pagerDutyRequiredScopes(accountRegion: String, accountSubdomain: String)
    -> [String]
  { pagerDutyReadScopes + ["as_account-\(accountRegion).\(accountSubdomain)"] }
  public static let telemetryDeckReadCapabilities = [
    "telemetrydeck_user_info_read",
    "telemetrydeck_tql_query_read",
    "telemetrydeck_saved_insight_read",
  ]
  public static let notionTokenCapabilities = [
    "read_content",
    "insert_content",
    "update_content",
    "read_comments",
    "insert_comments",
  ]
  public static let slackRelayOwnedOAuthScopes = [
    "channels:read",
    "channels:history",
    "chat:write",
    "users:read",
  ]
  public static let githubRelayOwnedOAuthScopes = [
    "read:user",
    "public_repo",
    "repo:status",
    "issues:read",
    "pull_requests:read",
  ]
  public static let gitLabRelayOwnedOAuthScopes = [
    "read_user",
    "read_api",
    "api",
  ]
  public static let bitbucketRelayOwnedOAuthScopes = [
    "account",
    "repository",
    "pullrequest",
    "issue",
  ]

  public static let linearRelayOwnedOAuthScopes = [
    "read",
    "write",
  ]
  public static let asanaRelayOwnedOAuthScopes = [
    "tasks:read",
    "projects:read",
    "users:read",
    "tasks:write",
  ]
  public static let trelloRelayOwnedPermissions = ["read", "write"]
  public static let clickUpRelayOwnedOAuthCapabilities = [
    "authorized_workspaces", "task_read", "task_write",
  ]
  public static let mondayRelayOwnedOAuthScopes = [
    "me:read", "account:read", "workspaces:read", "boards:read", "updates:read", "boards:write",
    "updates:write",
  ]
  public static let airtableRelayOwnedOAuthScopes = [
    "workspacesAndBases:read", "schema.bases:read", "data.records:read", "data.recordComments:read",
    "data.records:write", "data.recordComments:write",
  ]
  public static let dropboxRelayOwnedOAuthScopes = [
    "account_info.read", "files.metadata.read", "files.content.read", "files.content.write",
  ]
  public static let boxRelayOwnedOAuthScopes = ["root_readwrite"]
  public static let figmaRelayOwnedOAuthScopes = [
    "current_user:read", "file_metadata:read", "file_content:read", "file_comments:read",
    "file_comments:write",
  ]
  public static let miroRelayOwnedOAuthScopes = ["boards:read", "boards:write"]
  public static let canvaRelayOwnedOAuthScopes = [
    "design:meta:read", "folder:read", "design:content:write",
  ]
  public static let webflowRelayOwnedOAuthScopes = ["sites:read", "cms:read", "cms:write"]
  public static let wordpressComRelayOwnedOAuthScopes = ["sites", "posts"]
  public static let contentfulRelayOwnedOAuthScopes = ["content_management_manage"]
  public static let shopifyRelayOwnedOAuthScopes = ["write_products", "write_publications"]
  public static let wooCommerceApplicationPermissions = ["read_write"]
  public static let stripeAppsOAuthPermissions = ["balance_read", "payment_intent_read"]
  public static let xeroRelayOwnedOAuthScopes = [
    "offline_access", "accounting.settings.read", "accounting.invoices.read",
  ]
  public static let quickBooksRelayOwnedOAuthScopes = [
    "com.intuit.quickbooks.accounting", "payroll.compensation.read",
    "com.intuit.quickbooks.payment",
  ]
  public static let freshBooksRelayOwnedOAuthScopes = ["user:profile:read", "user:invoices:read"]
  public static let waveRelayOwnedOAuthScopes = ["business:read", "invoice:read"]
  public static let freeAgentPermissionRequirements = ["permission-level-4-invoices"]
  public static let salesforceRelayOwnedOAuthScopes = ["api", "refresh_token"]
  public static let hubSpotRelayOwnedOAuthScopes = [
    "oauth", "crm.objects.companies.read", "crm.objects.deals.read",
  ]
  public static let pipedriveRelayOwnedOAuthScopes = ["base", "contacts:read", "deals:read"]
  public static let copperRelayOwnedOAuthScopes = ["developer/v1/all"]
  public static let closeRelayOwnedOAuthScopes = ["all.full_access", "offline_access"]
  public static let zendeskRelayOwnedOAuthScopes = ["tickets:read"]
  public static let intercomRelayOwnedOAuthScopes = ["Read conversations", "Read admins"]
  public static let helpScoutOAuthPermissions: [String] = []
  public static let frontRelayOwnedOAuthScopes = ["conversations:read"]
  public static let teamworkRelayOwnedOAuthScopes = ["Teamwork.com"]
  public static let basecampOAuthPermissions: [String] = []
  public static let wrikeRelayOwnedOAuthScopes = ["wsReadOnly"]
  public static let smartsheetRelayOwnedOAuthScopes = ["READ_SHEETS"]
  public static let todoistRelayOwnedOAuthScopes = ["data:read"]
  public static func harvestRelayOwnedOAuthScopes(accountId: String) -> [String] {
    ["harvest:" + accountId]
  }
  public static let calendlyRelayOwnedOAuthScopes = [
    "event_types:read", "scheduled_events:read", "users:read",
  ]
  public static let calComRelayOwnedOAuthScopes = [
    "BOOKING_READ", "EVENT_TYPE_READ", "PROFILE_READ",
  ]
  public static let docusignRelayOwnedOAuthScopes = ["signature", "extended"]
  public static let dropboxSignRelayOwnedOAuthScopes = [
    "account_access", "signature_request_access",
  ]
  public static let pandaDocRelayOwnedOAuthScopes = ["read"]
  public static let typeformRelayOwnedOAuthScopes = [
    "accounts:read", "workspaces:read", "forms:read", "responses:read", "offline",
  ]
  public static let surveyMonkeyRelayOwnedOAuthScopes = [
    "users_read", "surveys_read", "responses_read",
  ]
  public static let filloutOAuthPermissions: [String] = []
  public static let mailchimpOAuthPermissions: [String] = []
  public static let sendFoxOAuthPermissions: [String] = []
  public static let beehiivRelayOwnedOAuthScopes = [
    "identify:read", "publications:read", "posts:read",
  ]
  public static let klaviyoRelayOwnedOAuthScopes = [
    "accounts:read", "lists:read", "campaigns:read",
  ]
  public static let convertKitRelayOwnedOAuthScopes = ["public"]
  public static let campaignMonitorRelayOwnedOAuthScopes = ["ViewReports"]
  public static let constantContactRelayOwnedOAuthScopes = [
    "account_read", "campaign_data", "offline_access",
  ]
  public static let constantContactRequiredPrivileges = [
    "account:read", "campaign:read", "ui:campaign:metrics",
  ]

  let data: LocalDataService
  let secrets: SecretService
  let adapterRegistry: ProviderConnectionAdapterRegistry
  let exaValidator: ExaAPIKeyValidating
  let linkedInValidator: LinkedInTokenValidating
  let xTokenRotationLock = NSLock()
  let facebookPagesTokenRotationLock = NSLock()
  let instagramBusinessTokenRotationLock = NSLock()
  let threadsTokenRotationLock = NSLock()
  let pinterestTokenRotationLock = NSLock()
  let tumblrTokenRotationLock = NSLock()
  let mastodonSecretReplacementLock = NSLock()
  let blueskySecretReplacementLock = NSLock()
  let linkedInTokenRotationLock = NSLock()
  let notionValidator: NotionTokenValidating
  let postHogValidator: PostHogTokenValidating
  let microsoftClarityValidator: MicrosoftClarityTokenValidating
  let sentryValidator: SentryTokenValidating
  let telemetryDeckValidator: TelemetryDeckPATValidating
  let postHogTokenRotationLock = NSLock()
  let gmailTokenRotationLock = NSLock()
  let googleCalendarTokenRotationLock = NSLock()
  let googleDriveTokenRotationLock = NSLock()
  let googleSheetsTokenRotationLock = NSLock()
  let googleSlidesTokenRotationLock = NSLock()
  let googleFormsTokenRotationLock = NSLock()
  let googleTasksTokenRotationLock = NSLock()
  let googleContactsTokenRotationLock = NSLock()
  let googlePhotosTokenRotationLock = NSLock()
  let googleMeetTokenRotationLock = NSLock()
  let googleChatTokenRotationLock = NSLock()
  let googleAdsTokenRotationLock = NSLock()
  let googleAnalyticsTokenRotationLock = NSLock()
  let googleSearchConsoleTokenRotationLock = NSLock()
  let googleMerchantCenterTokenRotationLock = NSLock()
  let youTubeTokenRotationLock = NSLock()
  let googleClassroomTokenRotationLock = NSLock()
  let outlookTokenRotationLock = NSLock()
  let microsoftTeamsTokenRotationLock = NSLock()
  let oneDriveTokenRotationLock = NSLock()
  let sharePointTokenRotationLock = NSLock()
  let microsoftPlannerTokenRotationLock = NSLock()
  let microsoftToDoTokenRotationLock = NSLock()
  let microsoftListsTokenRotationLock = NSLock()
  let oneNoteTokenRotationLock = NSLock()
  let microsoftBookingsTokenRotationLock = NSLock()
  let microsoftPowerBITokenRotationLock = NSLock()
  let microsoftDynamics365TokenRotationLock = NSLock()
  let microsoftVivaEngageTokenRotationLock = NSLock()
  let zoomTokenRotationLock = NSLock()
  let discordTokenRotationLock = NSLock()
  let googleDocsTokenRotationLock = NSLock()
  let sentryTokenRotationLock = NSLock()
  let datadogTokenRotationLock = NSLock()
  let pagerDutyTokenRotationLock = NSLock()
  let cloudflareTokenRotationLock = NSLock()
  let herokuTokenRotationLock = NSLock()
  let digitalOceanTokenRotationLock = NSLock()
  let firebaseTokenRotationLock = NSLock()
  let supabaseTokenRotationLock = NSLock()
  let bambooHRTokenRotationLock = NSLock()
  let greenhouseTokenRotationLock = NSLock()
  let leverTokenRotationLock = NSLock()
  let airtableTokenRotationLock = NSLock()
  let dropboxTokenRefreshLock = NSLock()
  let boxTokenRotationLock = NSLock()
  let figmaTokenRefreshLock = NSLock()
  let miroTokenRotationLock = NSLock()
  let canvaTokenRotationLock = NSLock()
  let shopifyTokenRotationLock = NSLock()
  let stripeTokenRotationLock = NSLock()
  let xeroTokenRotationLock = NSLock()
  let quickBooksTokenRotationLock = NSLock()
  let freshBooksTokenRotationLock = NSLock()
  let waveTokenRotationLock = NSLock()
  let freeAgentTokenRotationLock = NSLock()
  let salesforceTokenRotationLock = NSLock()
  let hubSpotTokenRotationLock = NSLock()
  let pipedriveTokenRotationLock = NSLock()
  let closeTokenRotationLock = NSLock()
  let zendeskTokenRotationLock = NSLock()
  let helpScoutTokenRotationLock = NSLock()
  let frontTokenRotationLock = NSLock()
  let basecampTokenRotationLock = NSLock()
  let wrikeTokenRotationLock = NSLock()
  let smartsheetTokenRotationLock = NSLock()
  let todoistTokenRotationLock = NSLock()
  let harvestTokenRotationLock = NSLock()
  let calendlyTokenRotationLock = NSLock()
  let calComTokenRotationLock = NSLock()
  let docusignTokenRotationLock = NSLock()
  let dropboxSignTokenRotationLock = NSLock()
  let pandaDocTokenRotationLock = NSLock()
  let typeformTokenRotationLock = NSLock()
  let klaviyoTokenRotationLock = NSLock()
  let convertKitTokenRotationLock = NSLock()
  let campaignMonitorTokenRotationLock = NSLock()
  let constantContactTokenRotationLock = NSLock()
  let googleOAuthValidator: GoogleOAuthCredentialValidating

  public init(
    data: LocalDataService,
    secrets: SecretService,
    exaValidator: ExaAPIKeyValidating = URLSessionExaAPIKeyValidator(),
    linkedInValidator: LinkedInTokenValidating = URLSessionLinkedInTokenValidator(),
    notionValidator: NotionTokenValidating = URLSessionNotionTokenValidator(),
    postHogValidator: PostHogTokenValidating = URLSessionPostHogTokenValidator(),
    microsoftClarityValidator: MicrosoftClarityTokenValidating =
      URLSessionMicrosoftClarityTokenValidator(),
    sentryValidator: SentryTokenValidating = URLSessionSentryTokenValidator(),
    telemetryDeckValidator: TelemetryDeckPATValidating = URLSessionTelemetryDeckPATValidator(),
    googleOAuthValidator: GoogleOAuthCredentialValidating =
      URLSessionGoogleOAuthCredentialValidator(),
    adapterRegistry: ProviderConnectionAdapterRegistry = .production
  ) {
    self.data = data
    self.secrets = secrets
    self.adapterRegistry = adapterRegistry
    self.exaValidator = exaValidator
    self.linkedInValidator = linkedInValidator
    self.notionValidator = notionValidator
    self.postHogValidator = postHogValidator
    self.microsoftClarityValidator = microsoftClarityValidator
    self.sentryValidator = sentryValidator
    self.telemetryDeckValidator = telemetryDeckValidator
    self.googleOAuthValidator = googleOAuthValidator
  }

  @discardableResult
  public func saveConnection(
    context: ServiceRequestContext,
    connection: MarketplaceProviderConnection
  ) throws -> MarketplaceProviderConnection {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    guard connection.workspaceId == context.workspaceId else {
      throw ServiceGuard.invalidInput(
        context: context,
        message: "Provider connection workspace does not match the request context.")
    }
    let app = try requireProviderApp(
      context: context, appIdOrSlug: connection.appId, fallbackSlug: connection.appSlug)
    guard connection.resolvedExecutionAuthority == .railway,
      connection.secretReferenceIds.isEmpty
    else {
      throw ServiceGuard.unavailable(
        context: context,
        reasonCode: .featureUnavailable,
        message:
          "External Marketplace credentials must be saved and executed by Railway. The macOS Swift credential store is not an execution fallback."
      )
    }
    try validateConnection(connection, app: app, context: context)

    let saved = try data.saveProviderConnection(connection)
    try synchronizeCatalogConnectionState(workspaceId: context.workspaceId, app: app)
    return saved
  }

  @discardableResult
  public func startAuthorizationFlow(
    context: ServiceRequestContext,
    appIdOrSlug: RelayId,
    providerKey: String,
    connectionId: RelayId? = nil,
    callbackURL: String? = nil,
    authorizationURL: String? = nil,
    deepLinkURL: String? = nil,
    manualEvidenceNote: String? = nil,
    errorMessage: String? = nil,
    now: Date = Date()
  ) throws -> ProviderAuthorizationFlow {
    if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
      throw denied
    }
    let app = try requireProviderApp(context: context, appIdOrSlug: appIdOrSlug, fallbackSlug: nil)
    try validateAppCanAuthorize(app, context: context)
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    let state: ProviderAuthorizationState
    if errorMessage?.providerConnectionNilIfEmpty != nil {
      state = .error
    } else if manualEvidenceNote?.providerConnectionNilIfEmpty != nil {
      state = .manualEvidenceRequired
    } else if authorizationURL?.providerConnectionNilIfEmpty != nil
      || deepLinkURL?.providerConnectionNilIfEmpty != nil
    {
      state = .deepLinkPending
    } else {
      state = .pending
    }
    let flow = ProviderAuthorizationFlow(
      id: createRelayId("poauth"),
      workspaceId: context.workspaceId,
      appId: app.id,
      connectionId: connectionId,
      providerKey: providerKey,
      state: state,
      callbackURL: callbackURL,
      authorizationURL: authorizationURL,
      deepLinkURL: deepLinkURL,
      manualEvidenceNote: manualEvidenceNote,
      errorMessage: errorMessage,
      startedByActorId: context.actorId,
      startedAt: timestamp,
      completedAt: state == .completed ? timestamp : nil,
      createdAt: timestamp,
      updatedAt: timestamp,
      redactionStatus: "private-state-excluded"
    )
    return try data.saveProviderAuthorizationFlow(flow)
  }

  public func validateExaAPIKey(apiKey: String) async -> ExaAPIKeyValidationResult {
    await exaValidator.validate(apiKey: apiKey)
  }

  public func validateNotionAPIToken(apiToken: String) async -> NotionTokenValidationResult {
    await notionValidator.validate(apiToken: apiToken)
  }

  public func validatePostHogPersonalAPIKey(
    personalAPIKey: String, baseURL: String, projectId: String?
  ) async -> PostHogTokenValidationResult {
    await postHogValidator.validate(
      personalAPIKey: personalAPIKey, baseURL: baseURL, projectId: projectId)
  }

  public func validateMicrosoftClarityAPIToken(apiToken: String) async
    -> MicrosoftClarityTokenValidationResult
  {
    await microsoftClarityValidator.validate(apiToken: apiToken)
  }

  public func validateSentryAuthToken(authToken: String, organizationSlug: String, baseURL: String?)
    async -> SentryTokenValidationResult
  {
    await sentryValidator.validate(
      authToken: authToken, organizationSlug: organizationSlug, baseURL: baseURL)
  }

  public func validateTelemetryDeckPAT(personalAccessToken: String) async
    -> TelemetryDeckPATValidationResult
  {
    await telemetryDeckValidator.validate(personalAccessToken: personalAccessToken)
  }
}

extension String {
  var providerConnectionNilIfEmpty: String? {
    let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
    return trimmed.isEmpty ? nil : trimmed
  }
}
