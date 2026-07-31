import Foundation
import RelayConsoleSourceTestSupport

@main
struct RelayConsoleComponentBaselineTests {
  private static let normalizedSourceCache = NSCache<NSString, NSString>()
  private static let testFilter = ProcessInfo.processInfo.environment[
    "RELAY_CONSOLE_COMPONENT_TEST_FILTER"]?
    .trimmingCharacters(in: .whitespacesAndNewlines)
    .lowercased()

  static func main() throws {
    try run("component inventory and tokens are centralized", testComponentInventoryAndTokens)
    try run("active controls expose help and accessibility labels", testActiveControlsExposeLabels)
    try run(
      "chat composer sending state uses animated chat treatment",
      testChatComposerSendingStateUsesAnimatedChatTreatment)
    try run(
      "agent identity preference controls are source backed",
      testAgentIdentityPreferenceControlsAreSourceBacked)
    try run(
      "agent picker create and classification controls are source backed",
      testAgentPickerCreateClassificationControlsAreSourceBacked)
    try run("AgentOps entry controls are source backed", testAgentOpsEntryControlsAreSourceBacked)
    try run(
      "Applications marketplace controls are source backed",
      testApplicationsMarketplaceControlsAreSourceBacked)
    try run(
      "Applications marketplace selection is immediate and refresh safe",
      testApplicationsMarketplaceSelectionIsImmediateAndRefreshSafe)
    try run(
      "Gmail Applications controls are source backed", testGmailApplicationsControlsAreSourceBacked)
    try run(
      "Google Docs Applications controls are source backed",
      testGoogleDocsApplicationsControlsAreSourceBacked)
    try run(
      "Google Calendar Applications controls are source backed",
      testGoogleCalendarApplicationsControlsAreSourceBacked)
    try run(
      "Google Drive Applications controls are source backed",
      testGoogleDriveApplicationsControlsAreSourceBacked)
    try run(
      "Google Sheets Applications controls are source backed",
      testGoogleSheetsApplicationsControlsAreSourceBacked)
    try run(
      "Google Slides Applications controls are source backed",
      testGoogleSlidesApplicationsControlsAreSourceBacked)
    try run(
      "Google Forms Applications controls are source backed",
      testGoogleFormsApplicationsControlsAreSourceBacked)
    try run(
      "Google Tasks Applications controls are source backed",
      testGoogleTasksApplicationsControlsAreSourceBacked)
    try run(
      "Google Contacts Applications controls are source backed",
      testGoogleContactsApplicationsControlsAreSourceBacked)
    try run(
      "Google Photos Applications controls are source backed",
      testGooglePhotosApplicationsControlsAreSourceBacked)
    try run(
      "Google Meet Applications controls are source backed",
      testGoogleMeetApplicationsControlsAreSourceBacked)
    try run(
      "Google Chat Applications controls are source backed",
      testGoogleChatApplicationsControlsAreSourceBacked)
    try run(
      "Google Ads Applications controls are source backed",
      testGoogleAdsApplicationsControlsAreSourceBacked)
    try run(
      "Google Analytics Applications controls are source backed",
      testGoogleAnalyticsApplicationsControlsAreSourceBacked)
    try run(
      "Google Search Console Applications controls are source backed",
      testGoogleSearchConsoleApplicationsControlsAreSourceBacked)
    try run(
      "Google Merchant Center Applications controls are source backed",
      testGoogleMerchantCenterApplicationsControlsAreSourceBacked)
    try run(
      "YouTube Applications controls are source backed",
      testYouTubeApplicationsControlsAreSourceBacked)
    try run(
      "Google Classroom Applications controls are source backed",
      testGoogleClassroomApplicationsControlsAreSourceBacked)
    try run(
      "Google Maps Platform Applications controls are source backed",
      testGoogleMapsPlatformApplicationsControlsAreSourceBacked)
    try run(
      "Adobe Acrobat Sign Applications controls are source backed",
      testAdobeAcrobatSignApplicationsControlsAreSourceBacked)
    try run(
      "SignNow Applications controls are source backed",
      testSignNowApplicationsControlsAreSourceBacked)
    try run(
      "SignRequest Applications controls are source backed",
      testSignRequestApplicationsControlsAreSourceBacked)
    try run(
      "Signeasy Applications controls are source backed",
      testSigneasyApplicationsControlsAreSourceBacked)
    try run(
      "OneSpan Sign Applications controls are source backed",
      testOneSpanSignApplicationsControlsAreSourceBacked)
    try run(
      "RightSignature Applications controls are source backed",
      testRightSignatureApplicationsControlsAreSourceBacked)
    try run(
      "GetAccept Applications controls are source backed",
      testGetAcceptApplicationsControlsAreSourceBacked)
    try run(
      "Qwilr Applications controls are source backed", testQwilrApplicationsControlsAreSourceBacked)
    try run(
      "Proposify Applications controls are source backed",
      testProposifyApplicationsControlsAreSourceBacked)
    try run(
      "Better Proposals Applications controls are source backed",
      testBetterProposalsApplicationsControlsAreSourceBacked)
    try run(
      "Concord Applications controls are source backed",
      testConcordApplicationsControlsAreSourceBacked)
    try run(
      "Juro Applications controls are source backed", testJuroApplicationsControlsAreSourceBacked)
    try run(
      "Ironclad Applications controls are source backed",
      testIroncladApplicationsControlsAreSourceBacked)
    try run(
      "LinkSquares Applications controls are source backed",
      testLinkSquaresApplicationsControlsAreSourceBacked)
    try run(
      "SpotDraft Applications controls are source backed",
      testSpotDraftApplicationsControlsAreSourceBacked)
    try run(
      "Contractbook Applications controls are source backed",
      testContractbookApplicationsControlsAreSourceBacked)
    try run(
      "LogRocket Applications controls are source backed",
      testLogRocketApplicationsControlsAreSourceBacked)
    try run(
      "Smartlook Applications controls are source backed",
      testSmartlookApplicationsControlsAreSourceBacked)
    try run(
      "Crazy Egg Applications controls are source backed",
      testCrazyEggApplicationsControlsAreSourceBacked)
    try run(
      "Appcues Applications controls are source backed",
      testAppcuesApplicationsControlsAreSourceBacked)
    try run(
      "Userflow Applications controls are source backed",
      testUserflowApplicationsControlsAreSourceBacked)
    try run(
      "Userpilot Applications controls are source backed",
      testUserpilotApplicationsControlsAreSourceBacked)
    try run(
      "Chameleon Applications controls are source backed",
      testChameleonApplicationsControlsAreSourceBacked)
    try run(
      "Vitally Applications controls are source backed",
      testVitallyApplicationsControlsAreSourceBacked)
    try run(
      "Gainsight Applications controls are source backed",
      testGainsightApplicationsControlsAreSourceBacked)
    try run(
      "Totango Applications controls are source backed",
      testTotangoApplicationsControlsAreSourceBacked)
    try run(
      "Custify Applications controls are source backed",
      testCustifyApplicationsControlsAreSourceBacked)
    try run(
      "Planhat Applications controls are source backed",
      testPlanhatApplicationsControlsAreSourceBacked)
    try run(
      "ClientSuccess Applications controls are source backed",
      testClientSuccessApplicationsControlsAreSourceBacked)
    try run(
      "Freshsales Applications controls are source backed",
      testFreshsalesApplicationsControlsAreSourceBacked)
    try run(
      "Insightly Applications controls are source backed",
      testInsightlyApplicationsControlsAreSourceBacked)
    try run(
      "Nimble Applications controls are source backed",
      testNimbleApplicationsControlsAreSourceBacked)
    try run(
      "Capsule CRM Applications controls are source backed",
      testCapsuleCrmApplicationsControlsAreSourceBacked)
    try run(
      "Keap Applications controls are source backed", testKeapApplicationsControlsAreSourceBacked)
    try run(
      "Outlook Applications controls are source backed",
      testOutlookApplicationsControlsAreSourceBacked)
    try run(
      "Microsoft Clarity Applications controls are source backed",
      testMicrosoftClarityApplicationsControlsAreSourceBacked)
    try run(
      "PostHog OAuth Applications controls are source backed",
      testPostHogOAuthApplicationsControlsAreSourceBacked)
    try run(
      "Sentry OAuth Applications controls are source backed",
      testSentryOAuthApplicationsControlsAreSourceBacked)
    try run(
      "Datadog OAuth Applications controls are source backed",
      testDatadogOAuthApplicationsControlsAreSourceBacked)
    try run(
      "PagerDuty OAuth Applications controls are source backed",
      testPagerDutyOAuthApplicationsControlsAreSourceBacked)
    try run(
      "Cloudflare OAuth Applications controls are source backed",
      testCloudflareOAuthApplicationsControlsAreSourceBacked)
    try run(
      "Vercel integration Applications controls are source backed",
      testVercelIntegrationApplicationsControlsAreSourceBacked)
    try run(
      "Heroku OAuth Applications controls are source backed",
      testHerokuOAuthApplicationsControlsAreSourceBacked)
    try run(
      "DigitalOcean OAuth Applications controls are source backed",
      testDigitalOceanOAuthApplicationsControlsAreSourceBacked)
    try run(
      "Supabase OAuth Applications controls are source backed",
      testSupabaseOAuthApplicationsControlsAreSourceBacked)
    try run(
      "Okta OIN Applications controls are source backed",
      testOktaOINApplicationsControlsAreSourceBacked)
    try run(
      "BambooHR OAuth Applications controls are source backed",
      testBambooHROAuthApplicationsControlsAreSourceBacked)
    try run(
      "Zoho People Applications controls are source backed",
      testZohoPeopleApplicationsControlsAreSourceBacked)
    try run(
      "Zoho Campaigns Applications controls are source backed",
      testZohoCampaignsApplicationsControlsAreSourceBacked)
    try run(
      "Zoho Analytics Applications controls are source backed",
      testZohoAnalyticsApplicationsControlsAreSourceBacked)
    try run(
      "Freshservice Applications controls are source backed",
      testFreshserviceApplicationsControlsAreSourceBacked)
    try run(
      "Freshchat Applications controls are source backed",
      testFreshchatApplicationsControlsAreSourceBacked)
    try run(
      "Freshmarketer Applications controls are source backed",
      testFreshmarketerApplicationsControlsAreSourceBacked)
    try run(
      "Freshcaller Applications controls are source backed",
      testFreshcallerApplicationsControlsAreSourceBacked)
    try run(
      "LiveChat Applications controls are source backed",
      testLiveChatApplicationsControlsAreSourceBacked)
    try run(
      "LiveAgent Applications controls are source backed",
      testLiveAgentApplicationsControlsAreSourceBacked)
    try run(
      "Crisp Applications controls are source backed", testCrispApplicationsControlsAreSourceBacked)
    try run(
      "Tidio Applications controls are source backed", testTidioApplicationsControlsAreSourceBacked)
    try run(
      "Olark Applications controls are source backed", testOlarkApplicationsControlsAreSourceBacked)
    try run(
      "Userlike Applications controls are source backed",
      testUserlikeApplicationsControlsAreSourceBacked)
    try run(
      "Gladly Applications controls are source backed",
      testGladlyApplicationsControlsAreSourceBacked)
    try run(
      "Kustomer Applications controls are source backed",
      testKustomerApplicationsControlsAreSourceBacked)
    try run(
      "Gorgias Applications controls are source backed",
      testGorgiasApplicationsControlsAreSourceBacked)
    try run(
      "Re:amaze Applications controls are source backed",
      testReAmazeApplicationsControlsAreSourceBacked)
    try run(
      "eDesk Applications controls are source backed", testEDeskApplicationsControlsAreSourceBacked)
    try run(
      "Kayako Applications controls are source backed",
      testKayakoApplicationsControlsAreSourceBacked)
    try run(
      "Acquire Applications controls are source backed",
      testAcquireApplicationsControlsAreSourceBacked)
    try run(
      "Greenhouse OAuth Applications controls are source backed",
      testGreenhouseOAuthApplicationsControlsAreSourceBacked)
    try run(
      "Lever OAuth Applications controls are source backed",
      testLeverOAuthApplicationsControlsAreSourceBacked)
    try run(
      "Notion Applications controls are source backed",
      testNotionApplicationsControlsAreSourceBacked)
    try run(
      "Slack Applications controls are source backed", testSlackApplicationsControlsAreSourceBacked)
    try run(
      "GitHub Applications controls are source backed",
      testGitHubApplicationsControlsAreSourceBacked)
    try run(
      "GitLab Applications controls are source backed",
      testGitLabApplicationsControlsAreSourceBacked)
    try run(
      "Bitbucket Applications controls are source backed",
      testBitbucketApplicationsControlsAreSourceBacked)
    try run(
      "Linear Applications controls are source backed",
      testLinearApplicationsControlsAreSourceBacked)
    try run(
      "Asana Applications controls are source backed", testAsanaApplicationsControlsAreSourceBacked)
    try run(
      "Trello Applications controls are source backed",
      testTrelloApplicationsControlsAreSourceBacked)
    try run(
      "ClickUp Applications controls are source backed",
      testClickUpApplicationsControlsAreSourceBacked)
    try run(
      "Monday.com Applications controls are source backed",
      testMondayApplicationsControlsAreSourceBacked)
    try run(
      "Airtable Applications controls are source backed",
      testAirtableApplicationsControlsAreSourceBacked)
    try run(
      "Dropbox Applications controls are source backed",
      testDropboxApplicationsControlsAreSourceBacked)
    try run(
      "Box Applications controls are source backed", testBoxApplicationsControlsAreSourceBacked)
    try run(
      "Figma Applications controls are source backed", testFigmaApplicationsControlsAreSourceBacked)
    try run(
      "Miro Applications controls are source backed", testMiroApplicationsControlsAreSourceBacked)
    try run(
      "Canva Applications controls are source backed", testCanvaApplicationsControlsAreSourceBacked)
    try run(
      "Webflow Applications controls are source backed",
      testWebflowApplicationsControlsAreSourceBacked)
    try run(
      "WordPress.com Applications controls are source backed",
      testWordPressComApplicationsControlsAreSourceBacked)
    try run(
      "Contentful Applications controls are source backed",
      testContentfulApplicationsControlsAreSourceBacked)
    try run(
      "Sanity Applications controls are source backed",
      testSanityApplicationsControlsAreSourceBacked)
    try run(
      "Strapi Cloud Applications controls are source backed",
      testStrapiCloudApplicationsControlsAreSourceBacked)
    try run(
      "Shopify Applications controls are source backed",
      testShopifyApplicationsControlsAreSourceBacked)
    try run(
      "WooCommerce Applications controls are source backed",
      testWooCommerceApplicationsControlsAreSourceBacked)
    try run(
      "Stripe Applications controls are source backed",
      testStripeApplicationsControlsAreSourceBacked)
    try run(
      "PayPal Applications controls are source backed",
      testPayPalApplicationsControlsAreSourceBacked)
    try run(
      "Xero Applications controls are source backed", testXeroApplicationsControlsAreSourceBacked)
    try run(
      "QuickBooks Applications controls are source backed",
      testQuickBooksApplicationsControlsAreSourceBacked)
    try run(
      "FreshBooks Applications controls are source backed",
      testFreshBooksApplicationsControlsAreSourceBacked)
    try run(
      "Wave Applications controls are source backed", testWaveApplicationsControlsAreSourceBacked)
    try run(
      "FreeAgent Applications controls are source backed",
      testFreeAgentApplicationsControlsAreSourceBacked)
    try run(
      "Salesforce Applications controls are source backed",
      testSalesforceApplicationsControlsAreSourceBacked)
    try run(
      "HubSpot Applications controls are source backed",
      testHubSpotApplicationsControlsAreSourceBacked)
    try run(
      "Pipedrive Applications controls are source backed",
      testPipedriveApplicationsControlsAreSourceBacked)
    try run(
      "Zoho CRM shared Applications controls are source backed",
      testZohoCRMSharedApplicationsControlsAreSourceBacked)
    try run(
      "Copper Applications controls are source backed",
      testCopperApplicationsControlsAreSourceBacked)
    try run(
      "Close Applications controls are source backed", testCloseApplicationsControlsAreSourceBacked)
    try run(
      "Zendesk Applications controls are source backed",
      testZendeskApplicationsControlsAreSourceBacked)
    try run(
      "Intercom Applications controls are source backed",
      testIntercomApplicationsControlsAreSourceBacked)
    try run(
      "Help Scout Applications controls are source backed",
      testHelpScoutApplicationsControlsAreSourceBacked)
    try run(
      "Front Applications controls are source backed", testFrontApplicationsControlsAreSourceBacked)
    try run(
      "Teamwork Applications controls are source backed",
      testTeamworkApplicationsControlsAreSourceBacked)
    try run(
      "Basecamp Applications controls are source backed",
      testBasecampApplicationsControlsAreSourceBacked)
    try run(
      "Wrike Applications controls are source backed", testWrikeApplicationsControlsAreSourceBacked)
    try run(
      "Smartsheet Applications controls are source backed",
      testSmartsheetApplicationsControlsAreSourceBacked)
    try run(
      "Todoist Applications controls are source backed",
      testTodoistApplicationsControlsAreSourceBacked)
    try run(
      "Toggl Track shared Marketplace contract is source backed",
      testTogglTrackSharedMarketplaceContractIsSourceBacked)
    try run(
      "Harvest Applications controls are source backed",
      testHarvestApplicationsControlsAreSourceBacked)
    try run(
      "Tempo Timesheets shared Marketplace contract is source backed",
      testTempoTimesheetsSharedMarketplaceContractIsSourceBacked)
    try run(
      "Zephyr Scale shared Marketplace contract is source backed",
      testZephyrScaleSharedMarketplaceContractIsSourceBacked)
    try run(
      "Calendly Applications controls are source backed",
      testCalendlyApplicationsControlsAreSourceBacked)
    try run(
      "Kraken Applications controls are source backed",
      testKrakenApplicationsControlsAreSourceBacked)
    try run(
      "Binance Applications controls are source backed",
      testBinanceApplicationsControlsAreSourceBacked)
    try run(
      "Gemini Applications controls are source backed",
      testGeminiApplicationsControlsAreSourceBacked)
    try run(
      "Payoneer Applications preview is source backed",
      testPayoneerApplicationsPreviewIsSourceBacked)
    try run(
      "Remitly Applications preview is source backed", testRemitlyApplicationsPreviewIsSourceBacked)
    try run(
      "Western Union Applications preview is source backed",
      testWesternUnionApplicationsPreviewIsSourceBacked)
    try run(
      "Wise Personal Applications preview is source backed",
      testWisePersonalApplicationsPreviewIsSourceBacked)
    try run(
      "Monzo Applications preview is source backed", testMonzoApplicationsPreviewIsSourceBacked)
    try run(
      "Starling Bank Applications preview is source backed",
      testStarlingBankApplicationsPreviewIsSourceBacked)
    try run(
      "Chase Applications preview is source backed", testChaseApplicationsPreviewIsSourceBacked)
    try run(
      "Bank of America Applications preview is source backed",
      testBankOfAmericaApplicationsPreviewIsSourceBacked)
    try run(
      "Capital One Applications preview is source backed",
      testCapitalOneApplicationsPreviewIsSourceBacked)
    try run(
      "American Express Applications preview is source backed",
      testAmericanExpressApplicationsPreviewIsSourceBacked)
    try run(
      "Discover Applications preview is source backed",
      testDiscoverApplicationsPreviewIsSourceBacked)
    try run(
      "Chime Applications preview is source backed", testChimeApplicationsPreviewIsSourceBacked)
    try run("SoFi Applications preview is source backed", testSoFiApplicationsPreviewIsSourceBacked)
    try run("N26 Applications preview is source backed", testN26ApplicationsPreviewIsSourceBacked)
    try run(
      "PayPal Personal Applications preview is source backed",
      testPayPalPersonalApplicationsPreviewIsSourceBacked)
    try run(
      "eBay Motors Applications preview is source backed",
      testEBayMotorsApplicationsPreviewIsSourceBacked)
    try run(
      "Amazon Alexa Applications preview is source backed",
      testAmazonAlexaApplicationsPreviewIsSourceBacked)
    try run(
      "Cal.com Applications controls are source backed",
      testCalComApplicationsControlsAreSourceBacked)
    try run(
      "Docusign Applications controls are source backed",
      testDocusignApplicationsControlsAreSourceBacked)
    try run(
      "Dropbox Sign Applications controls are source backed",
      testDropboxSignApplicationsControlsAreSourceBacked)
    try run(
      "PandaDoc Applications controls are source backed",
      testPandaDocApplicationsControlsAreSourceBacked)
    try run(
      "Typeform Applications controls are source backed",
      testTypeformApplicationsControlsAreSourceBacked)
    try run(
      "SurveyMonkey Applications controls are source backed",
      testSurveyMonkeyApplicationsControlsAreSourceBacked)
    try run(
      "Fillout Applications controls are source backed",
      testFilloutApplicationsControlsAreSourceBacked)
    try run(
      "Mailchimp Applications controls are source backed",
      testMailchimpApplicationsControlsAreSourceBacked)
    try run(
      "Klaviyo Applications controls are source backed",
      testKlaviyoApplicationsControlsAreSourceBacked)
    try run(
      "ConvertKit Applications controls are source backed",
      testConvertKitApplicationsControlsAreSourceBacked)
    try run(
      "Campaign Monitor Applications controls are source backed",
      testCampaignMonitorApplicationsControlsAreSourceBacked)
    try run(
      "Constant Contact Applications controls are source backed",
      testConstantContactApplicationsControlsAreSourceBacked)
    try run(
      "AdvancedMD Applications preview is source backed",
      testAdvancedMDApplicationsPreviewIsSourceBacked)
    try run(
      "Practice Fusion Applications preview is source backed",
      testPracticeFusionApplicationsPreviewIsSourceBacked)
    try run(
      "Open Dental Applications preview is source backed",
      testOpenDentalApplicationsPreviewIsSourceBacked)
    try run(
      "Dentrix Ascend Applications preview is source backed",
      testDentrixAscendApplicationsPreviewIsSourceBacked)
    try run(
      "Relay Cloud agent visibility is non-destructive and source backed",
      testRelayCloudAgentVisibilityIsSourceBacked)
    try run(
      "Relay account onboarding and session controls are source backed",
      testRelayAccountOnboardingAndSessionControlsAreSourceBacked)
    try run("asset fallback inventory is deterministic", testAssetFallbackInventory)
    try run("component fixture manifests match schema", testFixtureManifestsMatchSchema)
    print("RelayConsoleComponentBaselineTests passed")
  }

  private static func run(_ name: String, _ test: () throws -> Void) throws {
    if let testFilter, !testFilter.isEmpty, !name.lowercased().contains(testFilter) {
      return
    }
    do {
      try test()
      print("ok - \(name)")
    } catch {
      print("not ok - \(name): \(error)")
      throw error
    }
  }

  private static func testRelayCloudAgentVisibilityIsSourceBacked() throws {
    let model = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let settings = try readPackageFile("Sources/RelayConsoleApp/CloudRelaySettingsView.swift")
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")

    for expected in [
      "relayCloud.showAgents",
      "showRelayCloudAgents",
      "visibleAgents",
      "isRelayCloudAgent",
      "railway_sync",
      "railway_cloud",
      "isThreadVisibleForCloudAgentSetting",
      "visibleMarketplaceCompatibleAgents",
      "setShowRelayCloudAgents",
    ] {
      try expect(
        sourceContainsIgnoringWhitespace(model, containsIgnoringWhitespace: expected),
        "Relay Cloud visibility model source missing \(expected)")
    }
    for expected in [
      "Agent visibility on this Mac",
      "Show agents synced through Relay",
      "only hides them on this Mac",
      "Syncing and stored cloud data continue unchanged",
    ] {
      try expect(
        settings.contains(expected), "Relay Cloud visibility settings source missing \(expected)")
    }
    try expect(
      views.contains("model.visibleAgents"),
      "agent-facing views should consume the filtered agent collection")
    try expect(
      views.contains("model.visibleMarketplaceCompatibleAgents"),
      "Marketplace assignment views should hide cloud agents with the same preference")
  }

  private static func testRelayAccountOnboardingAndSessionControlsAreSourceBacked() throws {
    let settings = try readPackageFile("Sources/RelayConsoleApp/CloudRelaySettingsView.swift")
    let account = try readPackageFile(
      "Sources/RelayConsoleApp/Features/Settings/SettingsViews.swift")
    let cloudSync = try readPackageFile("Sources/RelayConsoleCore/CloudRelaySync.swift")

    for expected in [
      "Create account",
      "Confirm password",
      "auth/register",
      "createWorkspaceIfNeeded",
      "Sign out on this Mac",
      "await model.refresh()",
    ] {
      try expect(
        settings.contains(expected),
        "Relay account onboarding source is missing \(expected)")
    }
    try expect(
      account.contains("CloudRelaySettingsPanel(presentation: .accountSession)"),
      "Account settings must expose the Relay session and sign-out control")
    try expect(
      sourceContainsIgnoringWhitespace(
        cloudSync,
        containsIgnoringWhitespace: #""workspaceId": remoteWorkspaceId"#),
      "Mac installation registration must identify the selected Railway workspace")
  }

  private static func testComponentInventoryAndTokens() throws {
    let components = try readPackageFile("Sources/RelayConsoleApp/UIComponents.swift")

    for expected in [
      "ComponentInventoryItem",
      "VisualSystemAuditItem",
      "AssetManifestItem",
      "AccessibilityEvidenceMatrixItem",
      "enum RCComponentBaseline",
      "enum RCVisualSystemAudit",
      "enum RCAssetManifest",
      "enum RCAccessibilityEvidenceMatrix",
      "static let cornerRadius: CGFloat = 4",
      "static let minimumWindowSize = CGSize(width: 980, height: 640)",
      "static let standardWindowSize = CGSize(width: 1280, height: 820)",
      "static let broaderAssetDecisionId = \"D-0005\"",
      "static let appIconBundleCount = 3",
      "static let curatedIllustratedAvatarBundleCount = 42",
      "static let curatedIllustratedAvatarVisibleCount = 41",
      "static let hiddenIllustratedAvatarCount = 1",
      "struct StatusBadge",
      "enum ComponentTone",
      "func statusTone",
    ] {
      try expect(components.contains(expected), "UIComponents missing \(expected)")
    }

    for inventoryKey in [
      "icon-button",
      "status-badge",
      "search-field",
      "avatar-editor",
      "form-card",
      "empty-loading-state",
      "composer",
      "guarded-nav",
      "asset-manifest",
      "app-icon-fallback",
      "badge-meta-row",
      "retry-error-state",
    ] {
      try expect(
        components.contains("key: \"\(inventoryKey)\""),
        "component inventory missing \(inventoryKey)")
    }

    try expect(
      components.contains("verified-baseline"),
      "component inventory should include verified-baseline residual status")
    try expect(
      components.contains("D-0005 broader assets remain decision-gated"),
      "component inventory should retain D-0005 asset residual")
    for expected in [
      "source-audited",
      "macOSDivergence",
      "globals.css",
      "risk-badge",
      "agent-app-badge-strip",
      "focus-disabled-selected",
    ] {
      try expect(components.contains(expected), "visual system audit missing \(expected)")
    }
    for expected in [
      "ITC-0054 accessibility-keyboard-manual-visual-evidence-matrix",
      "SM-0268",
      "standard-minimum-window-screenshots-planned-not-captured",
      "keyboard-traversal-source-anchored-manual-review-planned",
      "voiceover-help-labels-source-anchored-manual-review-planned",
      "manual-demo-8-review-planned-partial",
      "retained-surfaces-only-excluded-surfaces-stay-unavailable",
      "activeSurfaceMatrix",
      "guardedUnavailableMatrix",
    ] {
      try expect(components.contains(expected), "accessibility evidence matrix missing \(expected)")
    }
  }

  private static func testChatComposerSendingStateUsesAnimatedChatTreatment() throws {
    let components = try readPackageFile("Sources/RelayConsoleApp/UIComponents.swift")
    let chatScreen = try readPackageFile(
      "Sources/RelayConsoleApp/Features/Chats/ChatScreen.swift")

    for expected in [
      "struct ComposerSendingIndicator: View",
      "TimelineView(.animation(minimumInterval: 0.24))",
      "Image(systemName: \"paperplane.fill\")",
      "RCTheme.chatAccent.opacity(0.09)",
      "ComposerSendingIndicator(",
      "statusText: statusText ?? \"Sending your message\"",
      ".accessibilityLabel(statusText)",
    ] {
      try expect(
        components.contains(expected),
        "composer sending treatment is missing \(expected)")
    }
    try expect(
      !components.contains("Text(statusText ?? \"Sending message.\")"),
      "composer sending state must not fall back to the old warning-like text")
    try expect(
      chatScreen.contains("return \"Sending your message\""),
      "chat send state should use the friendly sending label")
    try expect(
      !chatScreen.contains("return \"Sending message.\""),
      "chat send state must not retain the old warning-like label")
  }

  private static func testActiveControlsExposeLabels() throws {
    let components = try readPackageFile("Sources/RelayConsoleApp/UIComponents.swift")
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let app = try readPackageFile("Sources/RelayConsoleAppLauncher/RelayConsoleApp.swift")
    let appEntryPoint = try readPackageFile("Sources/RelayConsoleApp/AppEntryPoint.swift")

    for expected in [
      ".accessibilityLabel(\"Clear search\")",
      ".accessibilityLabel(\"Open Account settings\")",
      ".accessibilityLabel(\"Open \\(title)\")",
      ".accessibilityLabel(\"Upload avatar\")",
      ".accessibilityLabel(\"Pick an avatar\")",
      ".accessibilityLabel(\"\\(name) avatar\")",
      ".accessibilityLabel(\"Send message\")",
      "textView.setAccessibilityLabel(\"Message composer\")",
      ".accessibilityLabel(\"\\(title) message role\")",
    ] {
      try expect(components.contains(expected), "component source missing \(expected)")
    }
    try expect(
      !components.contains(".help(\"Open \\(title)\")"),
      "Settings second-column nav rows should not render hover tooltips")

    for expected in [
      ".accessibilityLabel(model.isStartingChat ? \"Close new chat\" : \"New chat\")",
      ".accessibilityLabel(\"Copy thread\")",
      ".accessibilityLabel(\"Open \\(runtimeName) settings\")",
      ".accessibilityLabel(\"Cancel runtime dispatch\")",
      ".accessibilityLabel(\"Retry runtime dispatch\")",
      ".accessibilityLabel(\"Run runtime dispatch\")",
      ".accessibilityLabel(\"Reject runtime dispatch\")",
      ".accessibilityLabel(\"Runtime draft response\")",
      ".accessibilityLabel(\"Edit agent\")",
      ".accessibilityLabel(\"Open Direct Chat\")",
      ".accessibilityLabel(\"Create Agent\")",
      "StatusBadge(",
    ] {
      try expect(views.contains(expected), "view source missing \(expected)")
    }
    for expected in [
      "RuntimeActivityPanel(",
      "RuntimeTaskListPanel",
      "RuntimeToolGroupRow",
      "RuntimeActivityRow",
      "RuntimeDraftTextView",
      "RuntimeRunConfirmationControls",
      "RuntimeExperienceSettingsPanel",
      "runtimeActivityProjection",
      "runtimeActivityDetailEnabled",
      "Technical activity",
      "Conversation start",
      "Action approvals",
      "Show tool details",
      "Show runtime detail",
    ] {
      try expect(views.contains(expected), "runtime activity UI source missing \(expected)")
    }
    for expected in [
      "Copy thread from here",
      "Copied thread from here",
      "Copy message",
      "Copied message",
    ] {
      try expect(views.contains(expected), "view source missing copy state \(expected)")
    }

    try expect(
      app.contains("controller.startNewChat()") && appEntryPoint.contains("model.selectNav(.chat)"),
      "app command should use controller-backed nav selection"
    )
  }

  private static func testAgentIdentityPreferenceControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let components = try readPackageFile("Sources/RelayConsoleApp/UIComponents.swift")
    let appModel = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let localData = try readPackageFile("Sources/RelayConsoleCore/LocalDataService.swift")
    let manifest = try readPackageFile(
      "Tests/Fixtures/ui/agents/identity-preferences-001/manifest.md")

    for expected in [
      "AvatarEditorPreview(value: value, size: 96)",
      "AgentAvatarView(name: name, avatarURL: avatarReference, size: 52)",
      "selectedCategory.resourceNames",
      "avatarCategories",
      "AvatarCategoryMenuRow",
      "LazyVGrid(columns: [GridItem(.adaptive(minimum: 112), spacing: 8)]",
      "AvatarCropEditor(source: source)",
      "croppedAvatarDataURL(",
      "person.crop.circle.badge.plus",
    ] {
      try expect(components.contains(expected), "agent identity controls missing \(expected)")
    }
    try expect(
      !components.contains("Button(\"No avatar\")"),
      "agent identity controls should not expose No avatar")
    for removed in [
      "ResponsePresentationPicker",
      "Picker(\"Response presentation\"",
      "HTML/CSS Native is not available in Relay Console Swift.",
      "Picker(\"Avatar type\"",
    ] {
      try expect(
        !components.contains(removed), "agent identity controls should not expose \(removed)")
    }
    try expect(
      !components.contains("Text(\"Compact\").tag(\"compact\")"),
      "compact response presentation should not be offered")
    try expect(
      !components.contains("Text(\"Verbose\").tag(\"verbose\")"),
      "verbose response presentation should not be offered")

    for removed in [
      "Save response presentation",
      "model.saveAgentResponsePresentation(agent, rawValue: presentation)",
      "ResponsePresentationPicker(value:",
      "Reset display name",
    ] {
      try expect(!views.contains(removed), "agent edit panel should not expose \(removed)")
    }
    for expected in [
      "agentDisplayNameSuccess[agent.id]",
      "Display name saved",
      "syncDisplayNameFromAgent()",
      ".onChange(of: agent.id)",
      ".accessibilityLabel(\"Display name editor\")",
    ] {
      try expect(
        views.contains(expected), "agent edit panel missing display-name confirmation \(expected)")
    }
    for expected in [
      "saveAgentDisplayPreference",
      "saveAgentAvatarPreference",
      "agentDisplayNameSuccess",
      "agentPreferences",
    ] {
      try expect(
        sourceContainsIgnoringWhitespace(appModel, containsIgnoringWhitespace: expected),
        "app model missing durable preference path \(expected)")
    }
    try expect(
      localData.contains("runtimeIdentityPreserved"),
      "data service should audit runtime identity preservation")
    try expect(
      !sourceContainsIgnoringWhitespace(
        appModel,
        containsIgnoringWhitespace: "\"responsePresentation\": .string(draft.responsePresentation)"),
      "create flow should not persist response presentation in runtime config")
    try expect(
      !sourceContainsIgnoringWhitespace(
        appModel,
        containsIgnoringWhitespace:
          "var responsePresentation: String = AgentResponsePresentation.markdown.rawValue"),
      "create draft should not expose response presentation")
    try expect(
      !sourceContainsIgnoringWhitespace(
        appModel, containsIgnoringWhitespace: "var externalAgentId: String = \"\""),
      "create draft should not expose external runtime identity")

    for field in requiredManifestFields {
      try expect(manifest.contains("\(field):"), "agent identity UI manifest is missing \(field)")
    }
    for expected in [
      "ITC-0022", "VC-0105", "Demo 3", "Demo 8", "html_native", "notParityStatement:",
    ] {
      try expect(manifest.contains(expected), "agent identity UI manifest must link \(expected)")
    }
  }

  private static func testAgentPickerCreateClassificationControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let knowledgeViews = try readPackageFile("Sources/RelayConsoleApp/AgentKnowledgeViews.swift")
    let components = try readPackageFile("Sources/RelayConsoleApp/UIComponents.swift")
    let appModel = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let uiSource = views + knowledgeViews + components + appModel
    let manifest = try readPackageFile(
      "Tests/Fixtures/ui/agents/create-edit-classification-001/manifest.md")

    for expected in [
      "AgentPickerPopover",
      "No matching agents",
      "\\(filteredAgents.count) agent(s)",
      "SidebarSectionHeader(title: \"Agents\", icon: \"person.2\")",
      "Create new agent",
      "Edit Agent",
      "EditAgentSubviewRow",
      "primaryAgentSubviews",
      "operationalAgentSubviews",
      "Agent instructions",
      "Agent memory",
      "Agent skills",
      "Agent classification",
      "Calendar and schedule",
      "Agent Instructions",
      "Agent Memory",
      "Agent Skills",
      "Org Structure",
      "Agent Classification",
      "Work Calendar",
      "Schedule Tasks",
      "AgentClassificationRow",
      "AgentWorkCalendarPanel",
      "AgentTasksPanel",
      "AgentTaskDetailPanel",
      "model.saveAgentClassification(",
      "model.createRuntimeAgent(draft)",
      "model.isDuplicateRuntimeIdentity",
      "model.beginEditAgent()",
      "AgentDetailFrame(title: \"Edit Agent\")",
      "CreateAgentTypeSelector",
      "model.startDirectChat(agent)",
      ".accessibilityLabel(\"Open Direct Chat\")",
      "title: runtimeLabel(agent.binding.runtimeType)",
      "title: effectiveAgentGroup(agent).rawValue",
      "HeaderIconControl(symbolName: \"bubble.left.and.bubble.right\")",
      "static let topReservedHeight: CGFloat = 52",
      "static let topHeaderContentBottomPadding: CGFloat = 6",
      "HeaderIconControl(symbolName: deleteBusy ? \"hourglass\" : \"trash\")",
      ".frame(height: RCChromeMetrics.topReservedHeight)",
      "contentPadding: agentDetailContentPadding",
      "return EdgeInsets(top: 0, leading: 24, bottom: 24, trailing: 24)",
      "AgentBlankDetailContent",
      "AgentBlankDetailHeader",
      "knowledgeSingleColumnLayout",
      "knowledgeSelector",
      "knowledgeItems",
      "activeKnowledgeItem",
      "dropdownKnowledgeItems",
      "AgentKnowledgeSelectorCard",
      "disclosureSymbolName: dropdownItems.isEmpty ? nil : (knowledgeSelectorCollapsed ? \"chevron.down\" : \"chevron.up\")",
      "ForEach(dropdownItems)",
      "selectKnowledgeItemFromSelector",
      "knowledgeListHeight(for: dropdownItems.count)",
      "AgentKnowledgeMarkdownPreview(markdown: markdown)",
      "AgentKnowledgeMarkdownPreview(markdown: content)",
      "artifactIsMarkdown",
      "case \"md\", \"markdown\":",
      "if !markdownEditing",
      "AgentFileToolbarAction(kind: .edit",
      "markdownEditing = true",
      "if markdownEditing",
      "Text(\"Filename\")",
      "defaultFolderChildItem(parent:",
      "select(firstChild, preserveActiveFolder: true)",
      "iconOnly: true",
      "colorized: true",
      "AgentThemedCard",
      "AgentThemedIconBlock",
      "AgentThemedSectionHeader",
      "AgentThemedCard(tint: RCTheme.accentBlue)",
      "AgentThemedCard(tint: RCTheme.accentPurple)",
      "private var isSelected: Bool",
      "classificationSectionTint",
      "classificationSectionIcon",
      "autoSaveTask",
      "canAutoSaveClassification",
      "scheduleClassificationAutoSave",
      "saveClassificationNow",
      "teamId: placement == .business ? teamId.nilIfEmpty : nil",
      "systemName: taskStatusIcon(task.status), tint: taskStatusTone(task.status).color",
      "Sort agent work calendar",
      "Work calendar grid",
      "No agent work in this range",
      "Local task",
      "model.createAgentTask(",
      "This creates a local scheduled task and linked chat thread.",
      "All organizations",
      "All departments",
      "All teams",
      "Family member",
      "All family",
      "AgentStructurePanel(mode: .structure)",
      "Structure",
      "Create",
      "Create organization",
      "Organization created",
      "Organization deleted",
      "businessOrganizationalDetailCard",
      "organizationDepartmentSections",
      "departmentTeamRow",
      "agentAvatarCluster",
      "Delete organization",
      "Delete organization and unassign agents",
      "Agents will not be deleted; they will remain active without this organization assignment.",
      "Create department",
      "Department created",
      "Department deleted",
      "Delete department",
      "Department color",
      "AgentOps HQ room",
      "No room linked",
      "Create team",
      "Team created",
      "teamName = \"\"",
      "selectedTeamId = team.id",
      "teamStatusMessage = \"Team created\"",
      "model.createAgentStructureCompany",
      "model.deleteAgentStructureCompany",
      "model.createAgentStructureDepartment",
      "model.deleteAgentStructureDepartment",
      "model.createAgentStructureTeam",
    ] {
      try expect(uiSource.contains(expected), "agent UI source missing \(expected)")
    }
    try expect(
      !views.contains("People, skills, work"), "Agents sidebar should only show the Agents title")
    try expect(
      !views.contains("Text(\"Provision runtime, role, and placement\")"),
      "Create agent sidebar row should not render secondary copy")
    try expect(
      !views.contains("Text(subview.subtitle)"),
      "Agent sidebar rows should not render secondary copy")
    try expect(
      !views.contains(".help(\"Open agent picker\")"),
      "Agent selector card should not render hover tooltips")
    try expect(
      !views.contains(".help(\"Create new agent\")"),
      "Create agent sidebar row should not render hover tooltips")
    try expect(
      !views.contains(
        ".help(isDisabled ? \"Select an agent before opening \\(subview.navigationTitle)\""),
      "Agent sidebar rows should not render hover tooltips")
    try expect(
      !knowledgeViews.contains("Text(section.detail)"),
      "Agent detail header should not render the section subtitle")
    try expect(
      !knowledgeViews.contains("Text(section.title)"),
      "Agent knowledge browser should not repeat the selected subview title")
    try expect(
      !knowledgeViews.contains(
        "AgentAvatarView(name: model.resolveAgentDisplayName(agent), avatarURL: model.agentAvatar(agent.id), size: 64)"
      ), "Agent detail header should use the compact chat-header avatar size")
    try expect(
      !knowledgeViews.contains("Label(\"Chat\", systemImage: \"bubble.left.and.bubble.right\")"),
      "Agent detail header chat action should be icon-only")
    try expect(
      !knowledgeViews.contains("HeaderIconControl(symbolName: \"pencil\")"),
      "Agent detail header should not render the edit icon")
    try expect(
      !knowledgeViews.contains(
        "HeaderIconControl(symbolName: deleteBusy ? \"hourglass\" : \"trash\")"),
      "Agent detail header should not render the delete icon")
    try expect(
      !knowledgeViews.contains("model.prepareAgentDeletion(agent)"),
      "Agent detail header should not own delete confirmation")
    try expect(
      !knowledgeViews.contains("model.agentPanelMode = .edit"),
      "Agent detail header should not own edit navigation")
    try expect(
      !knowledgeViews.contains("section == .skills && skillBrowserCollapsed ? 64 : 360"),
      "Agent skills should not reserve a collapsible left browser column")
    try expect(
      !knowledgeViews.contains("collapsedSkillsBrowser"),
      "Agent skills should not render the old collapsed left skill browser")
    try expect(
      !knowledgeViews.contains("skillsBrowserContent"),
      "Agent skills should not render the old left skill list")
    try expect(
      !knowledgeViews.contains(
        "HeaderIconControl(symbolName: skillBrowserCollapsed ? \"chevron.down\" : \"chevron.up\")"),
      "Agent skill selector chevron should stay inside the selected skill card")
    try expect(
      !knowledgeViews.contains("ForEach(skills) { item in"),
      "Agent skill dropdown should not repeat the active skill")
    try expect(
      !knowledgeViews.contains("splitKnowledgeLayout"),
      "Agent knowledge pages should not render a two-column browser/editor split")
    try expect(
      !knowledgeViews.contains("Advanced developer runtime browser"),
      "Agent knowledge pages should not render the removed advanced runtime browser card")
    try expect(
      !knowledgeViews.contains("AgentRuntimeWorkspacePanel(agent: agent)"),
      "Agent knowledge pages should not expose the raw runtime workspace browser")
    try expect(
      !knowledgeViews.contains("section == .skills && !skillMarkdownEditing"),
      "Agent knowledge Markdown preview should not be skills-only")
    try expect(
      !knowledgeViews.contains("AgentSkillMarkdownPreview"),
      "Agent knowledge Markdown preview should use the shared renderer")
    try expect(
      !knowledgeViews.contains("skillMarkdownEditing"),
      "Agent knowledge edit state should not be skills-only")
    try expect(
      knowledgeViews.contains("normalizedSectionSignSeparators"),
      "Agent knowledge Markdown preview should split section-sign separators into paragraphs")
    try expect(
      !knowledgeViews.contains("folderNavigator"),
      "Agent memory and instructions should not render a repeated folder tree below the toolbar")
    try expect(
      !knowledgeViews.contains("Text(\"No visible files in this folder.\")"),
      "Agent knowledge pages should not show folder-browser empty states below the toolbar")
    try expect(
      !views.contains("Save agent classification"),
      "Agent Classification should autosave without a Save button")
    try expect(
      !views.contains("confirmReplacement"),
      "Agent Classification manager changes should autosave without an extra confirmation checkbox")
    try expect(
      !views.contains("Text(structureSubtitle)"),
      "Org Structure filter card should not render a repeated subtitle")
    try expect(
      !views.contains("var structureSubtitle"),
      "Org Structure repeated subtitle helper should stay removed")
    try expect(
      !views.contains("Text(\"Department dashboard\")"),
      "Org Structure should fold the department dashboard into organizational detail")
    try expect(
      !views.contains("Text(\"Team dashboard\")"),
      "Org Structure should not render a separate team dashboard")
    try expect(
      !views.contains("func teamDashboardRow"),
      "Team rows should be nested inside department summaries")
    try expect(
      !views.contains("Text(\"Organizational detail\")"),
      "Org Structure should not render the organizational detail heading")
    try expect(
      !views.contains("Text(\"Organizational detail:"),
      "Org Structure should not render the selected organization detail heading")
    try expect(
      !views.contains("countBadge(\"Departments\""),
      "Org Structure should not render the department count card")
    try expect(
      !views.contains("countBadge(\"Classified agents\""),
      "Org Structure should not render the classified agents count card")
    try expect(
      !views.contains("Text(\"Departments\")"),
      "Org Structure should not render the repeated departments label")

    try expect(
      sourceContainsIgnoringWhitespace(
        appModel,
        containsIgnoringWhitespace: "Choose a department before setting this agent as its manager."),
      "manager guard source missing")

    for expected in [
      "services.organization.updateAgentPlacement",
      "services.organization.assignDepartmentManager",
      ".agentOrganizationUpdated",
      ".agentWorkUpdated",
      "orgCompanies",
      "orgDepartments",
      "orgTeams",
      "agentStructureDashboard",
      "agentWorkCalendar",
      "agentTasks",
      "agentTaskRuns",
      "confirmManagerReplacement",
      "createAgentStructureCompany",
      "deleteAgentStructureCompany",
      "createAgentStructureDepartment",
      "deleteAgentStructureDepartment",
      "createAgentStructureTeam",
      "services.organization.createCompany",
      "services.organization.cascadeDeleteCompany",
      "services.organization.createDepartment",
      "services.organization.deleteDepartment",
      "services.organization.createTeam",
      "AgentStructurePanel.createOrganization",
      "AgentStructurePanel.createDepartment",
      "AgentStructurePanel.createTeam",
    ] {
      try expect(
        sourceContainsIgnoringWhitespace(appModel, containsIgnoringWhitespace: expected),
        "app model missing org-backed agent UI path \(expected)")
    }

    for field in requiredManifestFields {
      try expect(
        manifest.contains("\(field):"),
        "agent create/classification UI manifest is missing \(field)")
    }
    for expected in [
      "ITC-0025", "ITC-0024", "ITC-0026", "ITC-0027", "CODE-002-001", "VC-0105", "Demo 3", "Demo 8",
      "notParityStatement:", "service-backed", "Org Structure",
    ] {
      try expect(
        manifest.contains(expected), "agent create/classification UI manifest must link \(expected)"
      )
    }
  }

  private static func testAgentOpsEntryControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let appModel = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let shell = try readPackageFile("Sources/RelayConsoleCore/ShellNavigation.swift")
    let service = try readPackageFile("Sources/RelayConsoleCore/AgentOpsService.swift")
    let manifest = try readPackageFile(
      "Tests/Fixtures/ui/agentops/entry-live-state-001/manifest.md")

    for expected in [
      "AgentOpsHQScreen",
      "AgentOpsSidebarPanel",
      "AgentOpsMiniStats",
      "AgentOpsVisualSceneView",
      "AgentOpsSceneRoomView",
      "AgentOpsSceneEntityNode",
      "AgentOpsLayoutEditorPanel",
      "AgentOpsPathNetworkEditor",
      "AgentOpsEditablePathNetworkView",
      "AgentOpsRoomAnchorOverlay",
      "AgentOpsSceneZoomControls",
      "Zoom in AgentOps floor",
      "Zoom out AgentOps floor",
      "Edit paths",
      "Add on map",
      "Add at cursor",
      "Anchor Visibility",
      "Add Anchor At Cursor",
      "Connect from this",
      "agentOpsFloorImage",
      "agentOpsSpriteImage",
      "agentOpsClampedPanOffset",
      "agentOpsImagePoint",
      "toggleAgentOpsStatus",
    ] {
      try expect(views.contains(expected), "AgentOps UI source missing \(expected)")
    }
    try expect(
      !views.contains("Last live snapshot"),
      "AgentOps UI should not restore the removed live snapshot banner")
    try expect(
      !views.contains("unavailableReasons.first"),
      "AgentOps UI should not render fallback reason cards over the map")
    try expect(
      !views.contains("AgentOpsRealtimeAgentsPanel"),
      "AgentOps UI should not restore the duplicate real-time agents overlay")
    try expect(
      !views.contains("Show real-time agents"),
      "AgentOps UI should not restore the duplicate real-time agents header toggle")
    try expect(
      !views.contains("AgentOpsSelectedPanel"),
      "AgentOps UI should not restore the selected status drawer")
    try expect(
      !views.contains("Show AgentOps panel"),
      "AgentOps UI should not restore the selected status drawer toggle")
    try expect(
      !views.contains("AgentOpsRuntimeOverviewPanel"),
      "AgentOps UI should not restore runtime overview drawer spam")
    try expect(
      !views.contains("AgentOpsEventFeedPanel"),
      "AgentOps UI should not restore event feed drawer spam")
    for expected in [
      "agentOpsSnapshot",
      "agentOpsSceneSnapshot",
      "filteredAgentOpsStates",
      "filteredAgentOpsSceneEntities",
      "selectedAgentOpsState",
      "selectedAgentOpsEntity",
      "services.agentOps.liveStateSnapshot",
      "services.agentOps.visualSceneSnapshot",
      ".runtimeEvent",
      ".harnessHealthChanged",
      "toggleAgentOpsStatus",
      "toggleAgentOpsBounds",
      "toggleAgentOpsPaths",
      "toggleAgentOpsLayoutEditor",
    ] {
      try expect(
        sourceContainsIgnoringWhitespace(appModel, containsIgnoringWhitespace: expected),
        "AppViewModel missing AgentOps state path \(expected)")
    }
    try expect(
      shell.contains("key: .agentOpsHQ") && shell.contains("disposition: \"deferred-hidden\""),
      "Shell should retain AgentOps as an explicitly deferred hidden route")
    try expect(
      service.contains("ServiceGuard.requireAnyRole(\n            [.owner, .admin]"),
      "AgentOps service should guard runtime overview to owner/admin")
    try expect(
      service.contains("visualFallbackOnly: true"),
      "AgentOps service should mark weak idle fallback")
    try expect(
      service.contains("operator-text-redacted"),
      "AgentOps service should emit redacted operator event status")
    try expect(
      service.contains("message-content-redacted"),
      "AgentOps service should emit redacted message event status")
    try expect(
      service.contains("visualSceneSnapshot("),
      "AgentOps service should derive a native visual scene")
    try expect(
      service.contains("sourceRecordIds(for:"),
      "AgentOps service should link visual entities to source records")
    try expect(
      service.contains("bundled_web_agentops_floor_worker_assets"),
      "AgentOps service should record bundled asset strategy")
    try expect(
      !service.contains("mockAgentOps"),
      "AgentOps service should not depend on mock AgentOps events")

    for field in requiredManifestFields {
      try expect(manifest.contains("\(field):"), "AgentOps UI manifest is missing \(field)")
    }
    for expected in [
      "ITC-0027", "VC-0105", "Demo 8", "notParityStatement:", "service-backed",
      "noSimulatedRuntimeOutput:",
    ] {
      try expect(manifest.contains(expected), "AgentOps UI manifest must link \(expected)")
    }
  }

  private static func testApplicationsMarketplaceControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let appModel = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let localData = try readPackageFile("Sources/RelayConsoleCore/LocalDataService.swift")
    let service = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let providerService = try readPackageFile(
      "Sources/RelayConsoleCore/ProviderConnectionService.swift")
    let installService = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceInstallService.swift")
    let toolRequestService = try readPackageFile(
      "Sources/RelayConsoleCore/ToolRequestService.swift")
    let manifest = try readPackageFile(
      "Tests/Fixtures/ui/applications/marketplace-catalog-001/manifest.md")
    let providerManifest = try readPackageFile(
      "Tests/Fixtures/ui/applications/provider-connections-001/manifest.md")
    let uiSource = views + appModel + service + providerService

    for expected in [
      "ApplicationsScreen",
      "ApplicationsSidebarPanel",
      "ApplicationsSidebarAppRow",
      "Applications Marketplace",
      "Applications Marketplace is backed by Railway's canonical provider-manifest catalog.",
      "Search marketplace apps",
      "Apps",
      "X",
      "LinkedIn",
      "No apps match your search",
      "Try a different search or category.",
      "No apps available",
      "Retry apps",
      "Deterministic app icon fallback",
      "What agents can do",
      "Connection requirements",
      "Required credentials and scopes",
      "Configure connection",
      "Setup details",
      "Relay-owned X OAuth",
      "Relay-owned LinkedIn member OAuth",
      "tweet.read · users.read · tweet.write · offline.access",
      "authenticated Railway OAuth 2.0 PKCE broker",
      "w_member_social",
      "X connection",
      "Complete Relay-owned OAuth to bind one X account.",
      "Callback URL",
      "Required scopes",
      "Keychain references",
      "No shared Relay-owned OAuth account",
      "Manual evidence",
    ] {
      try expect(uiSource.contains(expected), "Applications UI source missing \(expected)")
    }
    try expect(
      !views.contains("Text(app.summary)"),
      "Marketplace app sidebar rows should not render secondary copy")
    try expect(
      !views.contains(".help(\"Open \\(app.name)\")"),
      "Marketplace app sidebar rows should not render hover tooltips")
    try expect(
      sourceContainsIgnoringWhitespace(
        views,
        containsIgnoringWhitespace:
          "ApplicationsUniversalDetailPanel(app: app) .id(app.id)"
      ),
      "Marketplace application detail state must be isolated by application ID")
    let visibleApplicationsSource = views + appModel + service
    for removed in [
      "Add App",
      "Classify Apps",
      "All Apps",
      "External Apps",
      "Installed Packs",
      "Local Apps",
      "Review / Updates",
      "No marketplace apps loaded",
      "The live Railway catalogue endpoint did not provide visible apps.",
      "Marketplace apps are beta allowlisted",
      "Risk filter",
      "Demo fallback catalogue",
      "Back to marketplace",
      "Provider Connections",
      "Advanced connection details",
      "ApplicationsMarketplaceInstallPanel",
      "ApplicationsNeededToolsPanel",
      "Marketplace Install",
      "Role manifest install details",
      "Remove install",
      "Remove as unconfigured",
      "Needed Tools",
      "Copy Needed Tools",
      "Needed Tools copied",
      "Mark unavailable",
      "Details / Collapse",
      "marketplaceInstallSnapshot",
      "neededToolsSnapshot",
      "selectedMarketplaceInstall",
      "selectedNeededToolRequest",
      "updateNeededToolRequest",
      "applicationsSelectedView",
      "applicationsSelectedRisk",
    ] {
      try expect(
        !visibleApplicationsSource.contains(removed),
        "Visible Applications source should not expose removed copy \(removed)")
    }
    for expected in [
      "applicationsCatalogSnapshot",
      "providerConnectionSnapshot",
      "services.applications.refreshCatalogSnapshot",
      "services.providerConnections.snapshot",
      ".applicationsCatalogUpdated",
      ".applicationsProviderConnectionUpdated",
      ".applicationsMarketplaceInstallUpdated",
      ".applicationsNeededToolsUpdated",
      ".runtimeMissingToolUpdated",
      "selectMarketplaceApp",
      "clearMarketplaceSelection",
    ] {
      try expect(
        sourceContainsIgnoringWhitespace(appModel, containsIgnoringWhitespace: expected),
        "AppViewModel missing Applications state path \(expected)")
    }
    for expected in [
      "applications_navigation_records",
      "marketplace_catalog_apps",
      "applications_catalog_snapshots",
      "applications_provider_connections",
      "applications_provider_authorization_flows",
      "applications_provider_connection_snapshots",
      "applications_marketplace_installs",
      "applications_marketplace_install_snapshots",
      "applications_tool_requests",
      "applications_needed_tools_snapshots",
    ] {
      try expect(
        localData.contains(expected), "LocalDataService missing Applications table path \(expected)"
      )
    }
    try expect(
      service.contains("demoFallbackUsed: false"),
      "Applications service should not use demo fallback catalogue")
    try expect(
      service.contains("localApps\": .string(\"excluded\")"),
      "Applications service should record local app exclusion")
    try expect(
      service.contains("paperclip\": .string(\"excluded\")"),
      "Applications service should record Paperclip exclusion")
    try expect(
      providerService.contains("SecretService"),
      "Provider connection service should validate Keychain secret references")
    try expect(
      providerService.contains(
        "High-risk provider connections require user-owned developer credentials."),
      "Provider service should enforce user-owned high-risk credentials")
    try expect(
      providerService.contains("Paperclip provider connections are excluded"),
      "Provider service should preserve Paperclip exclusion")
    try expect(
      installService.contains("targetMode == .existingAgent"),
      "Install service should target existing compatible agents only")
    try expect(
      installService.contains("runtimeWriteDeferred"), "Install service should defer runtime writes"
    )
    try expect(
      installService.contains("removeAsUnconfigured"),
      "Install service should remove as unconfigured")
    try expect(
      installService.contains("toolAutoGrantCreated"),
      "Install service should not create fake tool grants")
    try expect(
      toolRequestService.contains("tool_request.policy_denied"),
      "Needed Tools service should preserve audited policy-denied no-persist behavior")
    try expect(
      toolRequestService.contains("autoGrantCreated"),
      "Needed Tools service should not create fake tool grants")
    try expect(
      toolRequestService.contains("localFileAccessAttempted"),
      "Needed Tools service should not access local files")
    try expect(
      toolRequestService.contains("paperclipExcluded"),
      "Needed Tools service should record Paperclip exclusion")

    for field in requiredManifestFields {
      try expect(manifest.contains("\(field):"), "Applications UI manifest is missing \(field)")
      try expect(
        providerManifest.contains("\(field):"),
        "Provider connection UI manifest is missing \(field)")
    }
    for expected in [
      "ITC-0032", "VC-0105", "Demo 8", "notParityStatement:", "service-backed",
      "noSimulatedRuntimeOutput:",
    ] {
      try expect(manifest.contains(expected), "Applications UI manifest must link \(expected)")
    }
    for expected in [
      "ITC-0033", "VC-0105", "Demo 4", "Keychain", "notParityStatement:", "service-backed",
      "noSimulatedRuntimeOutput:",
    ] {
      try expect(
        providerManifest.contains(expected), "Provider connection UI manifest must link \(expected)"
      )
    }
  }

  private static func testApplicationsMarketplaceSelectionIsImmediateAndRefreshSafe() throws {
    let selection = try readPackageFile(
      "Sources/RelayConsoleApp/Features/Applications/AppViewModel+ApplicationCatalogCredentials.swift"
    )
    let refresh = try readPackageFile(
      "Sources/RelayConsoleApp/Features/Applications/AppViewModel+ApplicationRefresh.swift"
    )

    try expect(
      sourceContainsIgnoringWhitespace(
        selection,
        containsIgnoringWhitespace: """
          applicationsSelectedAppId = app.id
          if var snapshot = applicationsCatalogSnapshot {
            snapshot.selectedApp = app
            applicationsCatalogSnapshot = snapshot
          }
          scheduleApplicationsRefresh()
          """
      ),
      "Marketplace selection must publish the selected app before refreshing"
    )
    try expect(
      refresh.components(separatedBy:
        "guard applicationsSelectedAppId.nilIfEmpty == requestedSelectedAppId else"
      ).count == 3,
      "Marketplace refresh must reject a stale selection before loading detail state and before publishing it"
    )
    try expect(
      sourceContainsIgnoringWhitespace(
        refresh,
        containsIgnoringWhitespace: """
          let requestedSelectedAppId = applicationsSelectedAppId.nilIfEmpty
          """
      ),
      "Marketplace refresh must capture the selection it was started for"
    )
    try expect(
      sourceContainsIgnoringWhitespace(
        refresh,
        containsIgnoringWhitespace: """
          catch {
            guard !Task.isCancelled else { return }
          """
      ),
      "Cancelled marketplace refreshes must not surface as user-facing failures"
    )
  }

  private static func testGmailApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let appModel = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let service = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let uiSource = views + appModel + service

    for expected in [
      "ApplicationsGmailDetailPanel",
      "ApplicationsGmailAgentsCard",
      "ApplicationsGmailAgentSwitchRow",
      "ApplicationsGmailConnectionsCard",
      "ApplicationsGmailConnectionHeader",
      "ApplicationsGmailConnectionRow",
      "Search and read task-scoped Gmail context through Relay wrappers",
      "Send Gmail messages through approval or Direct writes",
      "Agents with Gmail",
      "Select which agents should use the active Gmail OAuth connection.",
      "Complete verified Gmail authorization below before turning agents on.",
      "No Gmail OAuth connection",
      "Complete verified Relay-owned Google authorization before assigning agents.",
      "Manage API Connection",
      "Authorize Gmail through Relay-owned Google OAuth with the exact two restricted scopes.",
      "Connect Gmail",
      "Authorize Gmail",
      "Reconnect Gmail",
      "RELAY_GOOGLE_OAUTH_CLIENT_ID",
      "CLAWCHAT_RAILWAY_ORIGIN",
      "Active connection:",
      "Connect \\(displayName) to Gmail?",
      "Disconnect Gmail for \\(displayName)?",
      "This connects the agent to the Gmail OAuth account with Standard authority.",
      "Direct writes",
      "This removes the agent's access to the Gmail OAuth account.",
      "ApplicationsAgentAuthorityRow",
      "startGmailRelayOwnedOAuthConnect",
      "selectGmailConnection",
      "deleteGmailOAuthConnection",
      "setGmailAgentConnection",
      "Complete verified Gmail authorization before assigning agents.",
      "Select a verified connected Gmail OAuth account before assigning agents.",
      "Gmail read-only + compose",
      "Search and read Gmail messages",
      "Prepare and create Gmail drafts",
    ] {
      try expect(uiSource.contains(expected), "Gmail Applications UI source missing \(expected)")
    }

    try expect(
      views.contains("disabled: selectedConnection == nil || target.status != .compatible"),
      "Gmail agent toggles should stay disabled until an active compatible connection exists")
    try expect(
      sourceContainsIgnoringWhitespace(
        appModel,
        containsIgnoringWhitespace:
          "\"linkedin\", \"gmail\", \"google-docs\", \"google-calendar\", \"google-drive\""),
      "Gmail authority presets should expose the Direct writes option")
    try expect(
      views.contains("model.busy == \"connect-gmail-relay-oauth\""),
      "Gmail connect flow should expose bounded busy state")
    try expect(
      views.contains("model.deleteGmailOAuthConnection(connection, for: app)"),
      "Gmail connection rows should expose delete behavior")
    try expect(
      views.contains("model.selectGmailConnection(connection.id)"),
      "Gmail connection rows should expose select-active behavior")
    try expect(
      sourceContainsIgnoringWhitespace(
        appModel,
        containsIgnoringWhitespace: "\"Connecting \\(displayName) to \\(connection.accountLabel"),
      "Gmail assignment should surface connecting status")
    try expect(
      sourceContainsIgnoringWhitespace(
        appModel,
        containsIgnoringWhitespace:
          "\"Disconnecting \\(displayName) from \\(connection.accountLabel"),
      "Gmail disconnect should surface disconnecting status")
    try expect(
      !uiSource.contains("NEXT_PUBLIC_GOOGLE_CLIENT_SECRET"),
      "Gmail desktop UI must not accept a Google client secret")
  }

  private static func testGoogleDriveApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let appModel = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let service = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let providerService = try readPackageFile(
      "Sources/RelayConsoleCore/ProviderConnectionService.swift")
    let adapter = try readPackageFile(
      "Sources/RelayConsoleCore/GoogleDriveProviderActionAdapter.swift")
    let foundation = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderFoundationService.swift")
    let policy = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let runtime = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift")
    let uiSource =
      views + appModel + service + providerService + adapter + foundation + policy + runtime

    for expected in [
      "ApplicationsGoogleDriveDetailPanel",
      "ApplicationsGoogleDriveAgentsCard",
      "ApplicationsGoogleDriveAgentSwitchRow",
      "ApplicationsGoogleDriveConnectionsCard",
      "ApplicationsGoogleDriveConnectionHeader",
      "ApplicationsGoogleDriveConnectionRow",
      "Search files Relay created or the user explicitly selected/opened for Relay",
      "Create or copy Drive files through approval or Direct writes",
      "Agents with Google Drive",
      "Select which agents should use the active Google Drive OAuth connection.",
      "Authorize Google Drive through Relay-owned OAuth with exact drive.file scope.",
      "No verified Google Drive connection",
      "Authorize a Relay-owned drive.file account before assigning agents.",
      "Connect a Google account through Relay-owned OAuth for Google Drive.",
      "No client secrets or refresh tokens are pasted into Relay Console.",
      "Google account",
      "OAuth flow",
      "Connect Google Drive",
      "Reconnect Google Drive",
      "Access and refresh tokens use separate Keychain references. Relay's client secret stays on Railway.",
      "Connect \\(displayName) to Google Drive?",
      "Disconnect Google Drive for \\(displayName)?",
      "This connects the agent to the Google Drive OAuth account with Standard authority.",
      "This removes the agent's access to the Google Drive OAuth account.",
      "startGoogleDriveOAuthConnect",
      "selectGoogleDriveConnection",
      "deleteGoogleDriveOAuthConnection",
      "setGoogleDriveAgentConnection",
      "Save Google Drive OAuth credentials before assigning agents.",
      "Save a connected Google Drive OAuth account before assigning agents.",
      "Relay-owned Google OAuth",
      "googleDriveRelayOwnedOAuthScopes",
      "google_drive_oauth_access_token",
      "google_drive_oauth_refresh_token",
      "google_drive_account",
      "appVisibleFileCorpusEnforced",
      "drive.file is limited to Relay-created or explicitly selected/opened files",
      "google-drive-provider-action-adapter",
    ] {
      try expect(
        uiSource.contains(expected), "Google Drive Applications UI source missing \(expected)")
    }

    try expect(
      views.contains("disabled: selectedConnection == nil || target.status != .compatible"),
      "Google Drive agent toggles should stay disabled until an active compatible connection exists"
    )
    let compactAppModel = appModel.split(whereSeparator: \.isWhitespace).joined(separator: " ")
    let policyPresetSection =
      compactAppModel
      .components(separatedBy: "func marketplaceActionPolicyPresets").dropFirst().first?
      .components(separatedBy: "func ").first ?? ""
    try expect(
      policyPresetSection.contains(
        "return [.approvalRequired, .allowDirectWrites, .readOnly, .blocked]"),
      "All provider authority presets, including Google Drive, should expose Direct writes")
    try expect(
      views.contains("model.busy == \"connect-google-drive-oauth\""),
      "Google Drive connect flow should expose bounded busy state")
    try expect(
      views.contains("model.deleteGoogleDriveOAuthConnection(connection, for: app)"),
      "Google Drive connection rows should expose delete behavior")
    try expect(
      views.contains("model.selectGoogleDriveConnection(connection.id)"),
      "Google Drive connection rows should expose select-active behavior")
    try expect(
      compactAppModel.contains("self.googleDriveConnectionStatus = \"Connecting"),
      "Google Drive assignment should surface connecting status")
    try expect(
      compactAppModel.contains("self.googleDriveConnectionStatus = \"Disconnecting"),
      "Google Drive disconnect should surface disconnecting status")
    let googleDriveConnectionsSection =
      views
      .components(separatedBy: "struct ApplicationsGoogleDriveConnectionsCard").dropFirst().first?
      .components(separatedBy: "struct ApplicationsGoogleDriveConnectionHeader").first ?? ""
    try expect(
      !googleDriveConnectionsSection.contains("Google OAuth client secret")
        && !googleDriveConnectionsSection.contains("googleDriveClientSecretDraft"),
      "Google Drive must not ask users to paste Relay OAuth client secrets")
    try expect(
      !sourceContainsIgnoringWhitespace(
        appModel, containsIgnoringWhitespace: "prepareGoogleDriveSession")
        && !sourceContainsIgnoringWhitespace(
          appModel, containsIgnoringWhitespace: "exchangeGoogleDriveAuthorizationCode"),
      "Google Drive must not retain desktop loopback or token exchange code")
  }

  private static func testGoogleSheetsApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let appModel = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let service = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let provider = try readPackageFile("Sources/RelayConsoleCore/ProviderConnectionService.swift")
    let adapter = try readPackageFile(
      "Sources/RelayConsoleCore/GoogleSheetsProviderActionAdapter.swift")
    let foundation = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderFoundationService.swift")
    let policy = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let runtime = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift")
    let source = views + appModel + service + provider + adapter + foundation + policy + runtime
    for expected in [
      "ApplicationsGoogleSheetsDetailPanel", "Google Sheets connection",
      "Connect Google Sheets", "Reconnect Google Sheets", "Agents with Google Sheets",
      "startGoogleSheetsOAuthConnect", "selectGoogleSheetsConnection",
      "deleteGoogleSheetsOAuthConnection", "setGoogleSheetsAgentConnection",
      "googleSheetsRelayOwnedOAuthScopes", "https://www.googleapis.com/auth/drive.file",
      "google_sheets_oauth_access_token", "google_sheets_oauth_refresh_token",
      "google_sheets_account", "appVisibleSpreadsheetCorpusEnforced",
      "wholeDriveDiscovery", "brokered-native-google-sheets-api-v4-adapter",
      "google_sheets_values_get", "google_sheets_values_prepare",
      "google_sheets_values_update", "google_sheets_values_append",
      "200 rows, 26 columns, 5,000 cells, 100,000 characters",
      "The desktop never receives Relay's client secret or exchanges authorization codes.",
    ] { try expect(source.contains(expected), "Google Sheets integration missing \(expected)") }
    try expect(
      !sourceContainsIgnoringWhitespace(
        appModel, containsIgnoringWhitespace: "prepareGoogleSheetsSession")
        && !sourceContainsIgnoringWhitespace(
          appModel, containsIgnoringWhitespace: "exchangeGoogleSheetsAuthorizationCode"),
      "Google Sheets must not contain a desktop OAuth exchange")
    try expect(
      !views.contains("googleSheetsClientSecretDraft")
        && !views.contains("googleSheetsRefreshTokenDraft"),
      "Google Sheets UI must not request secrets or refresh tokens")
    try expect(
      adapter.contains("host == \"sheets.googleapis.com\"")
        && adapter.contains("bytes.count <= 2_000_000"),
      "Google Sheets live adapter must pin host and response bound")
  }

  private static func testGoogleSlidesApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let appModel = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let service = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let provider = try readPackageFile("Sources/RelayConsoleCore/ProviderConnectionService.swift")
    let adapter = try readPackageFile(
      "Sources/RelayConsoleCore/GoogleSlidesProviderActionAdapter.swift")
    let foundation = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderFoundationService.swift")
    let policy = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let runtime = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift")
    let source = views + appModel + service + provider + adapter + foundation + policy + runtime
    for expected in [
      "ApplicationsGoogleSlidesDetailPanel", "Google Slides connection", "Connect Google Slides",
      "Reconnect Google Slides", "Agents with Google Slides", "startGoogleSlidesOAuthConnect",
      "selectGoogleSlidesConnection", "deleteGoogleSlidesOAuthConnection",
      "setGoogleSlidesAgentConnection", "googleSlidesRelayOwnedOAuthScopes",
      "google_slides_oauth_access_token", "google_slides_oauth_refresh_token",
      "google_slides_account", "appVisiblePresentationCorpusEnforced",
      "brokered-native-google-slides-api-v1-adapter", "google_slides_presentation_get",
      "google_slides_page_get", "google_slides_update_prepare", "google_slides_text_replace",
      "google_slides_slide_create",
      "The desktop never receives Relay's client secret or exchanges authorization codes.",
    ] { try expect(source.contains(expected), "Google Slides integration missing \(expected)") }
    try expect(
      !sourceContainsIgnoringWhitespace(
        appModel, containsIgnoringWhitespace: "prepareGoogleSlidesSession")
        && !sourceContainsIgnoringWhitespace(
          appModel, containsIgnoringWhitespace: "exchangeGoogleSlidesAuthorizationCode"),
      "Google Slides must not contain a desktop OAuth exchange")
    try expect(
      !views.contains("googleSlidesClientSecretDraft")
        && !views.contains("googleSlidesRefreshTokenDraft"),
      "Google Slides UI must not request OAuth secrets")
    try expect(
      adapter.contains("url.host == \"slides.googleapis.com\"")
        && adapter.contains("bytes.count <= 2_000_000"),
      "Google Slides live adapter must pin host and response bound")
  }

  private static func testGoogleFormsApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let appModel = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let service = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let provider = try readPackageFile("Sources/RelayConsoleCore/ProviderConnectionService.swift")
    let adapter = try readPackageFile(
      "Sources/RelayConsoleCore/GoogleFormsProviderActionAdapter.swift")
    let foundation = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderFoundationService.swift")
    let policy = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let runtime = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift")
    let source = views + appModel + service + provider + adapter + foundation + policy + runtime
    for expected in [
      "ApplicationsGoogleFormsDetailPanel", "Google Forms connection", "Connect Google Forms",
      "Reconnect Google Forms", "Agents with Google Forms", "startGoogleFormsOAuthConnect",
      "selectGoogleFormsConnection", "deleteGoogleFormsOAuthConnection",
      "setGoogleFormsAgentConnection", "googleFormsRelayOwnedOAuthScopes",
      "google_forms_oauth_access_token", "google_forms_oauth_refresh_token", "google_forms_account",
      "appVisibleFormCorpusEnforced", "responsesAccessEnabled",
      "brokered-native-google-forms-api-v1-adapter", "google_forms_form_get",
      "google_forms_update_prepare", "google_forms_form_create", "google_forms_question_create",
      "The desktop never receives Relay's client secret or exchanges authorization codes.",
    ] { try expect(source.contains(expected), "Google Forms integration missing \(expected)") }
    try expect(
      !sourceContainsIgnoringWhitespace(
        appModel, containsIgnoringWhitespace: "prepareGoogleFormsSession")
        && !sourceContainsIgnoringWhitespace(
          appModel, containsIgnoringWhitespace: "exchangeGoogleFormsAuthorizationCode"),
      "Google Forms must not contain desktop OAuth exchange")
    try expect(
      !views.contains("googleFormsClientSecretDraft")
        && !views.contains("googleFormsRefreshTokenDraft"),
      "Google Forms UI must not request OAuth secrets")
    try expect(
      adapter.contains("url.host == \"forms.googleapis.com\"")
        && adapter.contains("bytes.count <= 2_000_000")
        && adapter.contains("respondentDataReturned"),
      "Google Forms adapter must pin host, bound response, and exclude respondents")
  }

  private static func testGoogleTasksApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let appModel = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let service = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let provider = try readPackageFile("Sources/RelayConsoleCore/ProviderConnectionService.swift")
    let adapter = try readPackageFile(
      "Sources/RelayConsoleCore/GoogleTasksProviderActionAdapter.swift")
    let foundation = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderFoundationService.swift")
    let policy = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let runtime = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift")
    let source = views + appModel + service + provider + adapter + foundation + policy + runtime
    for expected in [
      "ApplicationsGoogleTasksDetailPanel", "Google Tasks connection", "Connect Google Tasks",
      "Reconnect Google Tasks", "Agents with Google Tasks", "startGoogleTasksOAuthConnect",
      "selectGoogleTasksConnection", "deleteGoogleTasksOAuthConnection",
      "setGoogleTasksAgentConnection", "googleTasksRelayOwnedOAuthScopes",
      "google_tasks_oauth_access_token", "google_tasks_oauth_refresh_token", "google_tasks_account",
      "assignedTaskMutationEnabled", "destructiveActionsEnabled",
      "brokered-native-google-tasks-api-v1-adapter", "google_tasks_tasklists_list",
      "google_tasks_tasks_list", "google_tasks_update_prepare", "google_tasks_task_create",
      "google_tasks_task_patch",
      "The desktop never receives Relay's client secret or exchanges authorization codes.",
    ] { try expect(source.contains(expected), "Google Tasks integration missing \(expected)") }
    try expect(
      !sourceContainsIgnoringWhitespace(
        appModel, containsIgnoringWhitespace: "prepareGoogleTasksSession")
        && !sourceContainsIgnoringWhitespace(
          appModel, containsIgnoringWhitespace: "exchangeGoogleTasksAuthorizationCode"),
      "Google Tasks must not contain desktop OAuth exchange")
    try expect(
      !views.contains("googleTasksClientSecretDraft")
        && !views.contains("googleTasksRefreshTokenDraft"),
      "Google Tasks UI must not request OAuth secrets")
    try expect(
      adapter.contains("url.host == \"tasks.googleapis.com\"")
        && adapter.contains("assigned_task_mutation_blocked") && adapter.contains("If-Match"),
      "Google Tasks adapter must pin host and enforce assigned-task/ETag safety")
  }

  private static func testGoogleContactsApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let appModel = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let service = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let provider = try readPackageFile("Sources/RelayConsoleCore/ProviderConnectionService.swift")
    let adapter = try readPackageFile(
      "Sources/RelayConsoleCore/GoogleContactsProviderActionAdapter.swift")
    let foundation = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderFoundationService.swift")
    let policy = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let runtime = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift")
    let source = views + appModel + service + provider + adapter + foundation + policy + runtime
    for expected in [
      "ApplicationsGoogleContactsDetailPanel", "Google Contacts connection",
      "Connect Google Contacts", "Reconnect Google Contacts", "Agents with Google Contacts",
      "startGoogleContactsOAuthConnect", "selectGoogleContactsConnection",
      "deleteGoogleContactsOAuthConnection", "setGoogleContactsAgentConnection",
      "googleContactsRelayOwnedOAuthScopes", "google_contacts_oauth_access_token",
      "google_contacts_oauth_refresh_token", "google_contacts_account", "contactSourceOnly",
      "directoryAccessEnabled", "otherContactsAccessEnabled", "broadPersonalFieldsEnabled",
      "brokered-native-google-people-api-v1-adapter", "google_contacts_connections_list",
      "google_contacts_contact_get", "google_contacts_update_prepare",
      "google_contacts_contact_create", "google_contacts_contact_patch",
      "The desktop never receives Relay's client secret or exchanges authorization codes.",
    ] { try expect(source.contains(expected), "Google Contacts integration missing \(expected)") }
    try expect(
      !sourceContainsIgnoringWhitespace(
        appModel, containsIgnoringWhitespace: "prepareGoogleContactsSession")
        && !sourceContainsIgnoringWhitespace(
          appModel, containsIgnoringWhitespace: "exchangeGoogleContactsAuthorizationCode"),
      "Google Contacts must not contain desktop OAuth exchange")
    try expect(
      !views.contains("googleContactsClientSecretDraft")
        && !views.contains("googleContactsRefreshTokenDraft"),
      "Google Contacts UI must not request OAuth secrets")
    try expect(
      adapter.contains("url.host == \"people.googleapis.com\"")
        && adapter.contains("bytes.count <= 2_000_000")
        && adapter.contains("READ_SOURCE_TYPE_CONTACT") && adapter.contains("updatePersonFields")
        && adapter.contains("latestSourceEtagPreflight"),
      "Google Contacts adapter must pin host, bounds, contact source, and safe update semantics")
  }

  private static func testGooglePhotosApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let appModel = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let service = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let provider = try readPackageFile("Sources/RelayConsoleCore/ProviderConnectionService.swift")
    let adapter = try readPackageFile(
      "Sources/RelayConsoleCore/GooglePhotosProviderActionAdapter.swift")
    let foundation = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderFoundationService.swift")
    let policy = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let runtime = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift")
    let source = views + appModel + service + provider + adapter + foundation + policy + runtime
    for expected in [
      "ApplicationsGooglePhotosDetailPanel", "Google Photos connection", "Connect Google Photos",
      "Reconnect Google Photos", "Agents with Google Photos", "startGooglePhotosOAuthConnect",
      "selectGooglePhotosConnection", "deleteGooglePhotosOAuthConnection",
      "setGooglePhotosAgentConnection", "googlePhotosRelayOwnedOAuthScopes",
      "google_photos_oauth_access_token", "google_photos_oauth_refresh_token",
      "google_photos_account", "pickerOnly", "userSelectionRequired", "libraryAPIEnabled",
      "removedLibraryScopesEnabled", "rawMediaBytesEnabled", "baseURLReturnedToAgents",
      "automaticPolling", "brokered-native-google-photos-picker-api-v1-adapter",
      "google_photos_picker_session_create", "google_photos_picker_session_get",
      "google_photos_picked_media_list", "google_photos_picker_session_delete",
      "The desktop never receives Relay's client secret or exchanges authorization codes.",
    ] { try expect(source.contains(expected), "Google Photos integration missing \(expected)") }
    try expect(
      !sourceContainsIgnoringWhitespace(
        appModel, containsIgnoringWhitespace: "prepareGooglePhotosSession")
        && !sourceContainsIgnoringWhitespace(
          appModel, containsIgnoringWhitespace: "exchangeGooglePhotosAuthorizationCode"),
      "Google Photos must not contain desktop OAuth exchange")
    try expect(
      !views.contains("googlePhotosClientSecretDraft")
        && !views.contains("googlePhotosRefreshTokenDraft"),
      "Google Photos UI must not request OAuth secrets")
    try expect(
      adapter.contains("url.host == \"photospicker.googleapis.com\"")
        && adapter.contains("bytes.count <= 1_000_000")
        && adapter.contains("pageSize\", value: \"25")
        && adapter.contains("baseURLReturnedToAgents") && adapter.contains("cameraExifReturned"),
      "Google Photos adapter must pin host, bounds, first page, and media redaction")
  }

  private static func testGoogleMeetApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let appModel = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let service = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let provider = try readPackageFile("Sources/RelayConsoleCore/ProviderConnectionService.swift")
    let adapter = try readPackageFile(
      "Sources/RelayConsoleCore/GoogleMeetProviderActionAdapter.swift")
    let foundation = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderFoundationService.swift")
    let policy = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let runtime = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift")
    let source = views + appModel + service + provider + adapter + foundation + policy + runtime
    for expected in [
      "ApplicationsGoogleMeetDetailPanel", "Google Meet connection", "Connect Google Meet",
      "Reconnect Google Meet", "Agents with Google Meet", "startGoogleMeetOAuthConnect",
      "selectGoogleMeetConnection", "deleteGoogleMeetOAuthConnection",
      "setGoogleMeetAgentConnection", "googleMeetRelayOwnedOAuthScopes",
      "google_meet_oauth_access_token", "google_meet_oauth_refresh_token", "google_meet_account",
      "appCreatedSpacesOnly", "participantsAccessEnabled", "conferenceRecordsAccessEnabled",
      "recordingsTranscriptsSmartNotesEnabled", "driveArtifactsEnabled", "dialInSipReturned",
      "endConferenceEnabled", "domainDelegationEnabled",
      "brokered-native-google-meet-api-v2-adapter", "google_meet_space_get",
      "google_meet_space_update_prepare", "google_meet_space_create", "google_meet_space_patch",
      "The desktop never receives Relay's client secret or exchanges authorization codes.",
    ] { try expect(source.contains(expected), "Google Meet integration missing \(expected)") }
    try expect(
      !sourceContainsIgnoringWhitespace(
        appModel, containsIgnoringWhitespace: "prepareGoogleMeetSession")
        && !sourceContainsIgnoringWhitespace(
          appModel, containsIgnoringWhitespace: "exchangeGoogleMeetAuthorizationCode"),
      "Google Meet must not contain desktop OAuth exchange")
    try expect(
      !views.contains("googleMeetClientSecretDraft")
        && !views.contains("googleMeetRefreshTokenDraft"),
      "Google Meet UI must not request OAuth secrets")
    try expect(
      adapter.contains("url.host == \"meet.googleapis.com\"")
        && adapter.contains("url.host == \"meet.google.com\"")
        && adapter.contains("bytes.count <= 1_000_000") && adapter.contains("DO_NOT_GENERATE")
        && adapter.contains("HOSTS_ONLY") && adapter.contains("explicitSafetyUpdateMask"),
      "Google Meet adapter must pin hosts, bounds, and forced safe configuration")
  }

  private static func testGoogleChatApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let appModel = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let service = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let provider = try readPackageFile("Sources/RelayConsoleCore/ProviderConnectionService.swift")
    let adapter = try readPackageFile(
      "Sources/RelayConsoleCore/GoogleChatProviderActionAdapter.swift")
    let foundation = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderFoundationService.swift")
    let policy = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let runtime = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift")
    let source = views + appModel + service + provider + adapter + foundation + policy + runtime
    for expected in [
      "ApplicationsGoogleChatDetailPanel", "Google Chat connection", "Connect Google Chat",
      "Reconnect Google Chat", "Agents with Google Chat",
      "Standard, Direct writes, Read only, and No access", "startGoogleChatOAuthConnect",
      "selectGoogleChatConnection", "deleteGoogleChatOAuthConnection",
      "setGoogleChatAgentConnection", "googleChatRelayOwnedOAuthScopes",
      "google_chat_oauth_access_token", "google_chat_oauth_refresh_token", "google_chat_account",
      "userAuthOnly", "explicitSpacesOnly", "membershipsEnabled", "appBotAuthEnabled",
      "privateMessagesEnabled", "attachmentsMediaEnabled", "reactionsEnabled",
      "messageMutationExceptCreateEnabled", "brokered-native-google-chat-api-v1-adapter",
      "google_chat_space_get", "google_chat_messages_list", "google_chat_message_prepare",
      "google_chat_message_create",
      "The desktop never receives Relay's client secret or exchanges authorization codes.",
    ] { try expect(source.contains(expected), "Google Chat integration missing \(expected)") }
    try expect(
      !sourceContainsIgnoringWhitespace(
        appModel, containsIgnoringWhitespace: "prepareGoogleChatSession")
        && !sourceContainsIgnoringWhitespace(
          appModel, containsIgnoringWhitespace: "exchangeGoogleChatAuthorizationCode"),
      "Google Chat must not contain desktop OAuth exchange")
    try expect(
      !views.contains("googleChatClientSecretDraft")
        && !views.contains("googleChatRefreshTokenDraft"),
      "Google Chat UI must not request OAuth secrets")
    try expect(
      adapter.contains("url.host == \"chat.googleapis.com\"")
        && adapter.contains("bytes.count <= 1_000_000") && adapter.contains("createTime DESC")
        && adapter.contains("REPLY_MESSAGE_OR_FAIL") && adapter.contains("senderIdentityReturned")
        && adapter.contains("automaticPagination"),
      "Google Chat adapter must pin host, bounds, newest-first fail-closed replies, and privacy redaction"
    )
  }

  private static func testGoogleAdsApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let appModel = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let service = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let provider = try readPackageFile("Sources/RelayConsoleCore/ProviderConnectionService.swift")
    let adapter = try readPackageFile(
      "Sources/RelayConsoleCore/GoogleAdsProviderActionAdapter.swift")
    let foundation = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderFoundationService.swift")
    let policy = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let runtime = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift")
    let source = views + appModel + service + provider + adapter + foundation + policy + runtime
    for expected in [
      "ApplicationsGoogleAdsDetailPanel", "Google Ads reporting connection", "Connect Google Ads",
      "Reconnect Google Ads", "Agents with Google Ads", "Read only and No access",
      "startGoogleAdsOAuthConnect", "selectGoogleAdsConnection", "deleteGoogleAdsOAuthConnection",
      "setGoogleAdsAgentConnection", "googleAdsRelayOwnedOAuthScopes",
      "google_ads_oauth_access_token", "google_ads_oauth_refresh_token",
      "google_ads_developer_token", "google_ads_customer", "permissibleUse", "explicitCustomerOnly",
      "arbitraryGAQLEnabled", "searchStreamEnabled", "mutationsEnabled",
      "brokered-native-google-ads-api-v24-fixed-query-adapter", "google_ads_customer_summary_get",
      "google_ads_campaign_performance_report",
      "The desktop never receives Relay secrets or exchanges authorization codes.",
    ] { try expect(source.contains(expected), "Google Ads integration missing \(expected)") }
    try expect(
      !sourceContainsIgnoringWhitespace(
        appModel, containsIgnoringWhitespace: "prepareGoogleAdsSession")
        && !sourceContainsIgnoringWhitespace(
          appModel, containsIgnoringWhitespace: "exchangeGoogleAdsAuthorizationCode"),
      "Google Ads must not contain desktop OAuth exchange")
    try expect(
      !views.contains("googleAdsDeveloperTokenDraft")
        && !views.contains("googleAdsClientSecretDraft")
        && !views.contains("googleAdsRefreshTokenDraft"), "Google Ads UI must not request secrets")
    try expect(
      adapter.contains("url.host == \"googleads.googleapis.com\"")
        && adapter.contains("developer-token") && adapter.contains("login-customer-id")
        && adapter.contains("LAST_30_DAYS") && adapter.contains("LIMIT 50")
        && adapter.contains("bytes.count <= 1_000_000") && adapter.contains("arbitraryGAQLEnabled")
        && adapter.contains("automaticPagination"),
      "Google Ads adapter must pin headers, host, fixed query, and bounds")
  }

  private static func testGoogleAnalyticsApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let appModel = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let service = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let provider = try readPackageFile("Sources/RelayConsoleCore/ProviderConnectionService.swift")
    let adapter = try readPackageFile(
      "Sources/RelayConsoleCore/GoogleAnalyticsProviderActionAdapter.swift")
    let foundation = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderFoundationService.swift")
    let policy = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let runtime = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift")
    let source = views + appModel + service + provider + adapter + foundation + policy + runtime
    for expected in [
      "ApplicationsGoogleAnalyticsDetailPanel", "Google Analytics connection",
      "Connect Google Analytics", "Reconnect Google Analytics", "Agents with Google Analytics",
      "Read only and No access", "startGoogleAnalyticsOAuthConnect",
      "selectGoogleAnalyticsConnection", "deleteGoogleAnalyticsOAuthConnection",
      "setGoogleAnalyticsAgentConnection", "googleAnalyticsRelayOwnedOAuthScopes",
      "google_analytics_oauth_access_token", "google_analytics_oauth_refresh_token",
      "google_analytics_property", "explicitPropertyOnly", "propertyDiscoveryEnabled",
      "arbitraryReportsEnabled", "audienceExportsEnabled",
      "brokered-native-google-analytics-admin-data-api-fixed-report-adapter",
      "google_analytics_property_get", "google_analytics_overview_report",
      "The desktop never receives Relay's client secret, runs a loopback callback, or exchanges authorization codes.",
    ] { try expect(source.contains(expected), "Google Analytics integration missing \(expected)") }
    try expect(
      !sourceContainsIgnoringWhitespace(
        appModel, containsIgnoringWhitespace: "prepareGoogleAnalyticsSession")
        && !sourceContainsIgnoringWhitespace(
          appModel, containsIgnoringWhitespace: "exchangeGoogleAnalyticsAuthorizationCode")
        && !sourceContainsIgnoringWhitespace(
          appModel, containsIgnoringWhitespace: "saveGoogleAnalyticsOAuthCredentials"),
      "Google Analytics app model must not perform desktop OAuth or raw credential save")
    for forbidden in [
      "googleAnalyticsClientIdDraft", "googleAnalyticsClientSecretDraft",
      "googleAnalyticsRefreshTokenDraft", "googleAnalyticsAccessTokenDraft",
      "googleAnalyticsAccountEmailDraft", "googleAnalyticsPropertyIdDraft",
    ] {
      try expect(
        !views.contains(forbidden)
          && !sourceContainsIgnoringWhitespace(appModel, containsIgnoringWhitespace: forbidden),
        "Google Analytics UI model still exposes \(forbidden)")
    }
    try expect(
      adapter.contains("analyticsadmin.googleapis.com")
        && adapter.contains("analyticsdata.googleapis.com") && adapter.contains("30daysAgo")
        && adapter.contains("yesterday") && adapter.contains("sessionDefaultChannelGroup")
        && adapter.contains("\"25\"") && adapter.contains("bytes.count <= 1_000_000")
        && adapter.contains("automaticPagination"),
      "Google Analytics adapter must pin hosts, fixed report, and bounds")
  }

  private static func testGoogleDocsApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let appModel = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let service = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let providerService = try readPackageFile(
      "Sources/RelayConsoleCore/ProviderConnectionService.swift")
    let adapter = try readPackageFile(
      "Sources/RelayConsoleCore/GoogleDocsProviderActionAdapter.swift")
    let foundation = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderFoundationService.swift")
    let policy = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let runtimeMount = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift")
    let runtimeBridge = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceRuntimeToolBridgeService.swift")
    let uiSource =
      views + appModel + service + providerService + adapter + foundation + policy + runtimeMount
      + runtimeBridge

    for expected in [
      "ApplicationsGoogleDocsDetailPanel",
      "ApplicationsGoogleDocsAgentsCard",
      "ApplicationsGoogleDocsAgentSwitchRow",
      "ApplicationsGoogleDocsConnectionsCard",
      "ApplicationsGoogleDocsConnectionHeader",
      "ApplicationsGoogleDocsConnectionRow",
      "Read user-specified Google Docs documents by URL or ID",
      "Prepare document updates without mutating Google Docs",
      "Create or update documents through approval or Direct writes",
      "Agents with Google Docs",
      "Select which agents should use the active Google Docs OAuth connection.",
      "Connect Google Docs below before turning agents on.",
      "No Google Docs OAuth connection",
      "Connect Google Docs before assigning agents.",
      "Connect a Google account through Relay-owned OAuth for Google Docs.",
      "No client secrets or refresh tokens are pasted into Relay Console.",
      "Google account",
      "OAuth flow",
      "Connect Google Docs",
      "Reconnect Google Docs",
      "Authorization is brokered through authenticated Railway; the desktop never receives Relay's client secret.",
      "Access and refresh tokens use separate Keychain references; Railway performs refresh and revocation.",
      "Connect \\(displayName) to Google Docs?",
      "Disconnect Google Docs for \\(displayName)?",
      "This connects the agent to the Google Docs OAuth account with Standard authority.",
      "This removes the agent's access to the Google Docs OAuth account.",
      "Changes require confirmation. Advanced options are available.",
      "Change \\(app.name) authority?",
      "This changes the assigned agent from \\(applicationsPolicyTitle(selectedPreset)) to \\(applicationsPolicyTitle(pendingPreset)).",
      "Change authority",
      "Standard",
      "Direct writes",
      "Read only",
      "No access",
      "saveGoogleDocsOAuthCredentials",
      "selectGoogleDocsConnection",
      "testGoogleDocsConnection",
      "validateSavedGoogleDocsConnection",
      "deleteGoogleDocsOAuthConnection",
      "startGoogleDocsOAuthConnect",
      "setGoogleDocsAgentConnection",
      "Save Google Docs OAuth credentials before assigning agents.",
      "Save a connected Google Docs OAuth account before assigning agents.",
      "Relay-owned Google OAuth",
      "googleDocsRelayOwnedOAuthScopes",
      "google_docs_oauth_access_token",
      "google_docs_oauth_refresh_token",
      "google_docs_account",
      "documentTargetRequired",
      "redundantReadonlyScopeRequested",
      "relayOwnedGoogleApp",
      "docsOnlyV1",
      "driveSearchEnabled",
      "google_cloud_project_id",
    ] {
      try expect(
        uiSource.contains(expected), "Google Docs Applications UI source missing \(expected)")
    }

    try expect(
      views.contains("disabled: selectedConnection == nil || target.status != .compatible"),
      "Google Docs agent toggles should stay disabled until an active compatible connection exists")
    let compactAppModel = appModel.split(whereSeparator: \.isWhitespace).joined(separator: " ")
    let policyPresetSection =
      compactAppModel
      .components(separatedBy: "func marketplaceActionPolicyPresets").dropFirst().first?
      .components(separatedBy: "func ").first ?? ""
    try expect(
      policyPresetSection.contains(
        "return [.approvalRequired, .allowDirectWrites, .readOnly, .blocked]"),
      "All provider authority presets, including Google Docs, should expose Direct writes")
    try expect(
      sourceContainsIgnoringWhitespace(
        views,
        containsIgnoringWhitespace:
          "ApplicationsAgentAuthorityRow( app: app, install: install, selectedPreset: install.flatMap { model.marketplaceActionPolicyPreset(for: $0) } ?? .approvalRequired,"
      ), "Google Docs assigned agents should expose the authority row")
    try expect(
      views.contains("ForEach(ordinaryPresets, id: \\.rawValue)"),
      "Google Docs ordinary authority choices should be rendered inline while Direct writes remains an advanced option"
    )
    try expect(
      views.contains(".alert(confirmationTitle, isPresented: confirmationBinding)"),
      "Google Docs authority changes should require confirmation")
    try expect(
      sourceContainsIgnoringWhitespace(
        appModel,
        containsIgnoringWhitespace:
          "runAction(\"toggle-google-docs-agent-\\(agentId)\", refresh: .applications)"),
      "Google Docs assignment should refresh only Applications state")
    try expect(
      sourceContainsIgnoringWhitespace(
        appModel, containsIgnoringWhitespace: "self.googleDocsSelectedConnectionId = connection.id"),
      "Google Docs assignment should preserve the selected connection across refresh")
    try expect(
      compactAppModel.contains(
        "updatedInstall.metadata[\"providerActionFrameworkSource\"] = .string(")
        && compactAppModel.contains("\"applications-agent-authority-menu\")"),
      "Google Docs authority changes should update install metadata without a full app refresh loop"
    )
    try expect(
      views.contains("model.busy == \"connect-google-docs-oauth\""),
      "Google Docs connect flow should expose bounded busy state")
    try expect(
      views.contains("model.busy == \"test-google-docs-connection-\\(connection.id)\""),
      "Google Docs connection rows should expose bounded test busy state")
    try expect(
      views.contains("model.testGoogleDocsConnection(connection, for: app)"),
      "Google Docs connection rows should expose health-check behavior")
    try expect(
      views.contains("model.deleteGoogleDocsOAuthConnection(connection, for: app)"),
      "Google Docs connection rows should expose delete behavior")
    try expect(
      views.contains("model.selectGoogleDocsConnection(connection.id)"),
      "Google Docs connection rows should expose select-active behavior")
    try expect(
      compactAppModel.contains("self.googleDocsConnectionStatus = \"Connecting"),
      "Google Docs assignment should surface connecting status")
    try expect(
      compactAppModel.contains("self.googleDocsConnectionStatus = \"Disconnecting"),
      "Google Docs disconnect should surface disconnecting status")
    try expect(
      !uiSource.contains("Configure shared Relay-owned Google app"),
      "Google Docs UI should not suggest shared Relay-owned Google app ownership")
    try expect(
      !sourceContainsIgnoringWhitespace(
        appModel, containsIgnoringWhitespace: "prepareGoogleDocsSession")
        && !sourceContainsIgnoringWhitespace(
          appModel, containsIgnoringWhitespace: "exchangeGoogleDocsAuthorizationCode"),
      "Google Docs must not retain desktop loopback or token exchange code")
    try expect(
      runtimeMount.contains("relay_console_google_docs_oauth_authorization_url")
        && runtimeMount.contains(".filter"),
      "Google Docs legacy resident OAuth tools must be filtered from runtime mounts")
    try expect(
      runtimeBridge.contains("accepted only by the authenticated Railway broker"),
      "Google Docs legacy resident OAuth calls must fail closed on Railway")
  }

  private static func testGoogleCalendarApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let appModel = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let service = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let providerService = try readPackageFile(
      "Sources/RelayConsoleCore/ProviderConnectionService.swift")
    let adapter = try readPackageFile(
      "Sources/RelayConsoleCore/GoogleCalendarProviderActionAdapter.swift")
    let foundation = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderFoundationService.swift")
    let policy = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let runtime = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift")
    let uiSource =
      views + appModel + service + providerService + adapter + foundation + policy + runtime

    for expected in [
      "ApplicationsGoogleCalendarDetailPanel",
      "ApplicationsGoogleCalendarAgentsCard",
      "ApplicationsGoogleCalendarAgentSwitchRow",
      "ApplicationsGoogleCalendarConnectionsCard",
      "ApplicationsGoogleCalendarConnectionHeader",
      "ApplicationsGoogleCalendarConnectionRow",
      "List calendars and read event details",
      "Check free/busy availability",
      "Prepare, create, and update events through approval or Direct writes",
      "Relay-owned Google OAuth",
      "Agents with Google Calendar",
      "Select which agents should use the active Google Calendar OAuth connection.",
      "Authorize Google Calendar through Relay-owned OAuth with the exact V1 Calendar scopes.",
      "No verified Google Calendar connection",
      "Authorize a Relay-owned Google OAuth account before assigning agents.",
      "Connect a Google account through Relay-owned OAuth for Google Calendar.",
      "No client secrets or refresh tokens are pasted into Relay Console.",
      "Google account",
      "OAuth flow",
      "Connect Google Calendar",
      "Reconnect Google Calendar",
      "Access and refresh tokens use separate Keychain references. Relay's client secret stays on Railway.",
      "Connect \\(displayName) to Google Calendar?",
      "Disconnect Google Calendar for \\(displayName)?",
      "This connects the agent to the Google Calendar OAuth account with Standard authority.",
      "This removes the agent's access to the Google Calendar OAuth account.",
      "startGoogleCalendarOAuthConnect",
      "selectGoogleCalendarConnection",
      "testGoogleCalendarConnection",
      "deleteGoogleCalendarOAuthConnection",
      "setGoogleCalendarAgentConnection",
      "Save Google Calendar OAuth credentials before assigning agents.",
      "Save a connected Google Calendar OAuth account before assigning agents.",
      "Connect Google Calendar through Relay-owned OAuth before agents can use Calendar wrapper tools.",
      "googleCalendarRelayOwnedOAuthScopes",
      "google_calendar_oauth_access_token",
      "google_calendar_oauth_refresh_token",
      "google_calendar_account",
      "google_calendar_calendar_list",
      "google_calendar_event_list",
      "google_calendar_freebusy_query",
      "google_calendar_event_create",
      "google_calendar_event_update",
      "secure-railway-broker-only",
    ] {
      try expect(
        uiSource.contains(expected), "Google Calendar Applications UI source missing \(expected)")
    }

    try expect(
      views.contains("disabled: selectedConnection == nil || target.status != .compatible"),
      "Google Calendar agent toggles should stay disabled until an active compatible connection exists"
    )
    let compactAppModel = appModel.split(whereSeparator: \.isWhitespace).joined(separator: " ")
    try expect(
      sourceContainsIgnoringWhitespace(
        compactAppModel,
        containsIgnoringWhitespace:
          "\"linkedin\", \"gmail\", \"google-docs\", \"google-calendar\", \"google-drive\""),
      "Google Calendar authority presets should expose the Direct writes option")
    try expect(
      views.contains("model.busy == \"connect-google-calendar-oauth\""),
      "Google Calendar connect flow should expose bounded busy state")
    try expect(
      views.contains("model.busy == \"test-google-calendar-connection-\\(connection.id)\""),
      "Google Calendar health check should expose bounded busy state")
    try expect(
      views.contains("model.deleteGoogleCalendarOAuthConnection(connection, for: app)"),
      "Google Calendar connection rows should expose delete behavior")
    try expect(
      views.contains("model.testGoogleCalendarConnection(connection, for: app)"),
      "Google Calendar connection rows should expose health-check behavior")
    try expect(
      views.contains("model.selectGoogleCalendarConnection(connection.id)"),
      "Google Calendar connection rows should expose select-active behavior")
    try expect(
      compactAppModel.contains("self.googleCalendarConnectionStatus = \"Connecting"),
      "Google Calendar assignment should surface connecting status")
    try expect(
      compactAppModel.contains("self.googleCalendarConnectionStatus = \"Disconnecting"),
      "Google Calendar disconnect should surface disconnecting status")
    try expect(
      !sourceContainsIgnoringWhitespace(
        appModel,
        containsIgnoringWhitespace:
          "GoogleOAuthLoopbackCallbackService.shared\n            let state = try callbackService.prepareGoogleCalendarSession"
      ), "Google Calendar must not retain a desktop loopback callback path")
    try expect(
      !views.contains(
        "Google OAuth client secret\", placeholder: \"Client secret\", text: $model.googleCalendarClientSecretDraft"
      ), "Google Calendar must not ask users to paste the Relay OAuth client secret")
    try expect(
      !uiSource.contains("Configure shared Relay-owned Google app"),
      "Google Calendar UI should not suggest shared Relay-owned Google app ownership")
  }

  private static func testGoogleMerchantCenterApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let appModel = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let provider = try readPackageFile("Sources/RelayConsoleCore/ProviderConnectionService.swift")
    let adapter = try readPackageFile(
      "Sources/RelayConsoleCore/GoogleMerchantCenterProviderActionAdapter.swift")
    let runtime = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift")
    let wrappers = try readPackageFile(
      "Sources/RelayConsoleCore/RelayProviderWrapperToolCompilerService.swift")
    let combined = views + appModel + provider + adapter + runtime + wrappers
    for expected in [
      "ApplicationsGoogleMerchantCenterDetailPanel", "marketplace-logo-google-merchant-center",
      "Agents with Google Merchant Center", "Connect Google Merchant Center",
      "Exact content scope · provider scope can write · Relay V1 remains Read only",
      "Complete Relay-owned OAuth, developer registration, and explicit account selection on Railway",
      "Read only or No access; no Direct writes despite the provider scope",
      "googleMerchantCenterRelayOwnedOAuthScopes",
      "saveGoogleMerchantCenterRelayOwnedOAuthConnection",
      "rotateGoogleMerchantCenterRelayOwnedOAuthTokens",
      "google_merchant_center_oauth_access_token", "relay_google_merchant_center_list_products",
      "fixedReportBody", "automaticPagination", "serviceAccountEnabled", "v1BetaEnabled",
      "contentAPIEnabled", "rawToolsEnabled",
    ] {
      try expect(combined.contains(expected), "Merchant Center source contract missing \(expected)")
    }
    for forbidden in [
      "googleMerchantCenterClientSecretDraft", "googleMerchantCenterRefreshTokenDraft",
      "prepareGoogleMerchantCenterSession(", "exchangeGoogleMerchantCenterAuthorizationCode(",
      "service-account.json",
    ] {
      try expect(
        !views.contains(forbidden)
          && !sourceContainsIgnoringWhitespace(appModel, containsIgnoringWhitespace: forbidden),
        "Merchant desktop OAuth surface must exclude \(forbidden)")
    }
    try expect(
      sourceContainsIgnoringWhitespace(
        appModel, containsIgnoringWhitespace: "connection.credentialOwnership == .relayOwned")
        && sourceContainsIgnoringWhitespace(
          appModel,
          containsIgnoringWhitespace:
            "connection.health.diagnostics[\"writesEnabled\"]?.bool == false"),
      "Merchant assignment must repeat ownership and no-write invariants")
    try expect(
      adapter.contains("request.permission == .allowed") && !adapter.contains("refreshAccessToken"),
      "Merchant adapter must be read-only and access-token-only")
  }

  private static func testYouTubeApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let appModel = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let provider = try readPackageFile("Sources/RelayConsoleCore/ProviderConnectionService.swift")
    let adapter = try readPackageFile("Sources/RelayConsoleCore/YouTubeProviderActionAdapter.swift")
    let runtime = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift")
    let wrappers = try readPackageFile(
      "Sources/RelayConsoleCore/RelayProviderWrapperToolCompilerService.swift")
    let combined = views + appModel + provider + adapter + runtime + wrappers
    for expected in [
      "ApplicationsYouTubeDetailPanel", "marketplace-logo-youtube", "Agents with YouTube",
      "Connect YouTube", "Exact youtube.readonly scope · connected channel · four bounded wrappers",
      "Read only or No access; no Standard or Direct writes", "youTubeRelayOwnedOAuthScopes",
      "saveYouTubeRelayOwnedOAuthConnection", "rotateYouTubeRelayOwnedOAuthTokens",
      "youtube_oauth_access_token", "relay_youtube_get_my_channel", "relay_youtube_get_videos",
      "youtubeAttributionRequired", "automaticPagination", "searchEnabled", "historyEnabled",
      "rawToolsEnabled",
    ] { try expect(combined.contains(expected), "YouTube source contract missing \(expected)") }
    for forbidden in [
      "youTubeClientSecretDraft", "youTubeRefreshTokenDraft", "prepareYouTubeSession(",
      "exchangeYouTubeAuthorizationCode(", "youtube.force-ssl", "youtube.upload",
    ] {
      try expect(
        !views.contains(forbidden)
          && !sourceContainsIgnoringWhitespace(appModel, containsIgnoringWhitespace: forbidden),
        "YouTube desktop surface must exclude \(forbidden)")
    }
    try expect(
      sourceContainsIgnoringWhitespace(
        appModel, containsIgnoringWhitespace: "connection.credentialOwnership == .relayOwned")
        && sourceContainsIgnoringWhitespace(
          appModel,
          containsIgnoringWhitespace:
            "connection.health.diagnostics[\"writesEnabled\"]?.bool == false"),
      "YouTube assignment must repeat ownership and no-write invariants")
    try expect(
      adapter.contains("request.permission == .allowed")
        && adapter.contains("maxResults must be an integer from 1 through 25")
        && !adapter.contains("refreshAccessToken"),
      "YouTube adapter must be bounded and access-token-only")
  }

  private static func testGoogleClassroomApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let appModel = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let provider = try readPackageFile("Sources/RelayConsoleCore/ProviderConnectionService.swift")
    let adapter = try readPackageFile(
      "Sources/RelayConsoleCore/GoogleClassroomProviderActionAdapter.swift")
    let runtime = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift")
    let wrappers = try readPackageFile(
      "Sources/RelayConsoleCore/RelayProviderWrapperToolCompilerService.swift")
    let combined = views + appModel + provider + adapter + runtime + wrappers
    for expected in [
      "ApplicationsGoogleClassroomDetailPanel", "marketplace-logo-google-classroom",
      "Agents with Google Classroom", "Connect Google Classroom",
      "Exact three read-only scopes · requesting user only · no student work or grades",
      "Workspace administrator approval is required for under-18 users",
      "googleClassroomRelayOwnedOAuthScopes", "saveGoogleClassroomRelayOwnedOAuthConnection",
      "rotateGoogleClassroomRelayOwnedOAuthTokens", "google_classroom_oauth_access_token",
      "relay_google_classroom_list_coursework", "requestingUserOnly",
      "studentSubmissionsGradesEnabled", "domainDelegationEnabled", "automaticPagination",
      "rawToolsEnabled",
    ] { try expect(combined.contains(expected), "Classroom source contract missing \(expected)") }
    for forbidden in [
      "googleClassroomClientSecretDraft", "googleClassroomRefreshTokenDraft",
      "prepareGoogleClassroomSession(", "exchangeGoogleClassroomAuthorizationCode(",
      "classroom.rosters.readonly", "classroom.student-submissions.students.readonly",
    ] {
      try expect(
        !views.contains(forbidden)
          && !sourceContainsIgnoringWhitespace(appModel, containsIgnoringWhitespace: forbidden),
        "Classroom desktop surface must exclude \(forbidden)")
    }
    try expect(
      adapter.contains("individualStudentIdsExcluded")
        && adapter.contains("request.permission == .allowed")
        && !adapter.contains("refreshAccessToken"),
      "Classroom adapter must prove privacy redaction and access-token-only dispatch")
  }

  private static func testGoogleMapsPlatformApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let applications = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let combined = views + applications
    for expected in [
      "google-maps-platform", "Google Maps Platform", "Customer-owned restricted server API key",
      "customer-owned billed-project Google Maps Platform key", "google_maps_platform_raw_maps",
      "google_maps_platform_tracking_navigation", "marketplace-logo-google-tasks",
    ] {
      try expect(
        combined.contains(expected),
        "Google Maps Platform bundled source contract missing \(expected)")
    }
    for forbidden in [
      "Relay-owned Google Maps API key", "google_maps_platform_oauth", "Maps OAuth",
    ] {
      try expect(
        !combined.contains(forbidden),
        "Google Maps Platform bundled surface must exclude \(forbidden)")
    }
  }

  private static func testAdobeAcrobatSignApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let applications = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let combined = views + applications
    for expected in [
      "adobe-acrobat-sign", "Adobe Acrobat Sign", "agreement_read:self",
      "callback-bound Adobe API shard", "adobe_acrobat_sign_private_content",
      "adobe_acrobat_sign_broader_authority",
      "participants-documents-signing-audit-writes-broader-authority-raw-excluded",
    ] {
      try expect(
        combined.contains(expected),
        "Adobe Acrobat Sign bundled source contract missing \(expected)")
    }
    for forbidden in [
      "agreement_read:account", "agreement_write", "webhook_write", "Adobe Acrobat Sign API key",
    ] {
      try expect(
        !combined.contains(forbidden),
        "Adobe Acrobat Sign bundled surface must exclude \(forbidden)")
    }
  }

  private static func testSignNowApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let applications = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let combined = views + applications
    for expected in [
      "signnow", "SignNow", "broad * scope", "signnow_private_content", "signnow_broader_authority",
      "people-content-signing-audit-writes-broad-authority-raw-excluded",
    ] {
      try expect(combined.contains(expected), "SignNow bundled source contract missing \(expected)")
    }
    for forbidden in ["SignNow API key", "SignNow password", "SignNow username", "signnow_write"] {
      try expect(!combined.contains(forbidden), "SignNow bundled surface must exclude \(forbidden)")
    }
  }

  private static func testSignRequestApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let applications = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let combined = views + applications
    for expected in [
      "signrequest", "SignRequest", "exactly SignRequest's read scope",
      "signrequest_private_content", "signrequest_broader_authority",
      "people-teams-content-signing-audit-writes-broader-authority-raw-excluded",
    ] {
      try expect(
        combined.contains(expected), "SignRequest bundled source contract missing \(expected)")
    }
    for forbidden in ["SignRequest API token", "SignRequest write scope", "scope read write"] {
      try expect(
        !combined.contains(forbidden), "SignRequest bundled surface must exclude \(forbidden)")
    }
  }

  private static func testSigneasyApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let applications = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    guard let start = applications.range(of: "private static func marketplaceSigneasyApp"),
      let end = applications.range(
        of: "private static func marketplaceOneSpanSignApp",
        range: start.upperBound..<applications.endIndex)
    else {
      throw ComponentBaselineTestFailure("Signeasy bundled source contract could not be isolated")
    }
    let signeasySurface = String(applications[start.lowerBound..<end.lowerBound])
    let combined = views + signeasySurface
    for expected in [
      "signeasy", "Signeasy", "rs:read", "offline_access", "fixed API audience",
      "signeasy_private_content",
      "people-files-signing-audit-writes-broader-authority-raw-excluded",
    ] {
      try expect(
        combined.contains(expected), "Signeasy bundled source contract missing \(expected)")
    }
    for forbidden in ["files:read", "user:read", "rs:create", "rs:update", "rs:signingurl"] {
      try expect(
        !signeasySurface.contains(forbidden), "Signeasy bundled surface must exclude \(forbidden)")
    }
  }

  private static func testOneSpanSignApplicationsControlsAreSourceBacked() throws {
    let combined =
      try readPackageFile("Sources/RelayConsoleApp/Views.swift")
      + readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    for expected in [
      "onespan-sign", "OneSpan Sign", "customer-owned OAuth 2.0 client credentials",
      "five-minute access tokens", "does not yet provide OAuth scopes",
      "onespan_sign_broad_credential_use",
      "people-documents-signing-evidence-writes-broad-authority-raw-excluded",
    ] {
      try expect(
        combined.contains(expected), "OneSpan Sign bundled source contract missing \(expected)")
    }
    for forbidden in [
      "OneSpan API key", "sender authentication token", "raw OneSpan API", "OneSpan refresh token",
    ] {
      try expect(
        !combined.contains(forbidden), "OneSpan Sign bundled surface must exclude \(forbidden)")
    }
  }

  private static func testRightSignatureApplicationsControlsAreSourceBacked() throws {
    let combined =
      try readPackageFile("Sources/RelayConsoleApp/Views.swift")
      + readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    for expected in [
      "rightsignature", "RightSignature", "exactly RightSignature's read scope",
      "rightsignature_private_content", "rightsignature_broader_authority",
      "people-files-signing-fields-certificates-writes-broader-authority-raw-excluded",
    ] {
      try expect(
        combined.contains(expected), "RightSignature bundled source contract missing \(expected)")
    }
    for forbidden in [
      "RightSignature account password", "RightSignature private API token draft",
      "read write scope", "RightSignature raw API",
    ] {
      try expect(
        !combined.contains(forbidden), "RightSignature bundled surface must exclude \(forbidden)")
    }
  }

  private static func testGetAcceptApplicationsControlsAreSourceBacked() throws {
    let combined =
      try readPackageFile("Sources/RelayConsoleApp/Views.swift")
      + readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    for expected in [
      "getaccept", "GetAccept", "customer-owned access token", "forcing automatic sending off",
      "getaccept_automatic_send", "getaccept_private_file_source",
      "token-recipients-file-url-raw-response-sending-excluded",
    ] {
      try expect(
        combined.contains(expected), "GetAccept bundled source contract missing \(expected)")
    }
    for forbidden in [
      "GetAccept OAuth callback", "GetAccept client secret", "GetAccept account password",
      "GetAccept raw API",
    ] {
      try expect(
        !combined.contains(forbidden), "GetAccept bundled surface must exclude \(forbidden)")
    }
  }

  private static func testQwilrApplicationsControlsAreSourceBacked() throws {
    let combined =
      try readPackageFile("Sources/RelayConsoleApp/Views.swift")
      + readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    for expected in [
      "qwilr", "Qwilr", "Customer-owned Qwilr access token", "publishing forced off",
      "qwilr_publish_external", "qwilr_account_mutation",
      "token-content-people-links-acceptance-payments-publishing-excluded",
    ] {
      try expect(combined.contains(expected), "Qwilr bundled source contract missing \(expected)")
    }
    for forbidden in [
      "Qwilr OAuth callback", "Qwilr client secret", "Qwilr account password", "Qwilr raw API",
    ] {
      try expect(!combined.contains(forbidden), "Qwilr bundled surface must exclude \(forbidden)")
    }
  }

  private static func testProposifyApplicationsControlsAreSourceBacked() throws {
    let combined =
      try readPackageFile("Sources/RelayConsoleApp/Views.swift")
      + readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    for expected in [
      "proposify", "Proposify", "exactly read_documents authority", "proposify_private_content",
      "proposify_broader_authority",
      "people-content-clients-signing-links-writes-broader-authority-raw-excluded",
    ] {
      try expect(
        combined.contains(expected), "Proposify bundled source contract missing \(expected)")
    }
    for forbidden in [
      "Proposify account password", "Proposify private token draft", "prismatic read_documents",
      "Proposify raw API",
    ] {
      try expect(
        !combined.contains(forbidden), "Proposify bundled surface must exclude \(forbidden)")
    }
  }

  private static func testBetterProposalsApplicationsControlsAreSourceBacked() throws {
    let combined =
      try readPackageFile("Sources/RelayConsoleApp/Views.swift")
      + readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    for expected in [
      "better-proposals", "Better Proposals", "broad Bptoken credential",
      "better_proposals_private_data", "better_proposals_account_access",
      "token-contacts-companies-pricing-signatures-payments-links-content-writes-account-raw-excluded",
    ] {
      try expect(
        combined.contains(expected), "Better Proposals bundled source contract missing \(expected)")
    }
    for forbidden in [
      "Better Proposals account password", "Better Proposals OAuth callback",
      "Better Proposals private document body", "Better Proposals raw API",
    ] {
      try expect(
        !combined.contains(forbidden), "Better Proposals bundled surface must exclude \(forbidden)")
    }
  }

  private static func testConcordApplicationsControlsAreSourceBacked() throws {
    let combined =
      try readPackageFile("Sources/RelayConsoleApp/Views.swift")
      + readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    for expected in [
      "concord", "Concord", "broad-organization X-API-KEY", "forcing DRAFT status",
      "concord_private_contract_data", "concord_administration",
      "key-content-people-signatures-finance-links-sending-admin-raw-excluded",
    ] {
      try expect(combined.contains(expected), "Concord bundled source contract missing \(expected)")
    }
    for forbidden in [
      "Concord account password", "Concord OAuth callback", "Concord private contract body",
      "Concord raw API",
    ] {
      try expect(!combined.contains(forbidden), "Concord bundled surface must exclude \(forbidden)")
    }
  }

  private static func testJuroApplicationsControlsAreSourceBacked() throws {
    let combined =
      try readPackageFile("Sources/RelayConsoleApp/Views.swift")
      + readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    for expected in [
      "juro", "Juro", "broad-account x-api-key", "end-user consent", "juro_private_template_data",
      "juro_contract_access",
      "key-links-fields-questions-people-approval-contracts-writes-account-raw-excluded",
    ] {
      try expect(combined.contains(expected), "Juro bundled source contract missing \(expected)")
    }
    for forbidden in [
      "Juro account password", "Juro OAuth callback", "Juro private contract body", "Juro raw API",
    ] {
      try expect(!combined.contains(forbidden), "Juro bundled surface must exclude \(forbidden)")
    }
  }

  private static func testIroncladApplicationsControlsAreSourceBacked() throws {
    let combined =
      try readPackageFile("Sources/RelayConsoleApp/Views.swift")
      + readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    for expected in [
      "ironclad", "Ironclad", "public.workflows.readSchemas", "as-user ID",
      "ironclad_private_schema_data", "ironclad_contract_data",
      "client-schema-fields-contracts-people-documents-approvals-signatures-writes-admin-raw-excluded",
    ] {
      try expect(
        combined.contains(expected), "Ironclad bundled source contract missing \(expected)")
    }
    for forbidden in [
      "Ironclad account password", "Ironclad legacy access token", "Ironclad private contract body",
      "Ironclad raw API",
    ] {
      try expect(
        !combined.contains(forbidden), "Ironclad bundled surface must exclude \(forbidden)")
    }
  }

  private static func testLinkSquaresApplicationsControlsAreSourceBacked() throws {
    let combined =
      try readPackageFile("Sources/RelayConsoleApp/Views.swift")
      + readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    for expected in [
      "linksquares", "LinkSquares", "broad administrator x-api-key", "linksquares_agreement_data",
      "linksquares_finalize_people",
      "key-agreements-terms-tags-files-people-finalize-writes-admin-raw-excluded",
    ] {
      try expect(
        combined.contains(expected), "LinkSquares bundled source contract missing \(expected)")
    }
    for forbidden in [
      "LinkSquares account password", "LinkSquares OAuth callback",
      "LinkSquares private agreement body", "LinkSquares raw API",
    ] {
      try expect(
        !combined.contains(forbidden), "LinkSquares bundled surface must exclude \(forbidden)")
    }
  }

  private static func testSpotDraftApplicationsControlsAreSourceBacked() throws {
    let combined =
      try readPackageFile("Sources/RelayConsoleApp/Views.swift")
      + readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    for expected in [
      "spotdraft", "SpotDraft", "one-time secret", "spotdraft_users_members",
      "spotdraft_contract_data",
      "client-secret-users-members-permissions-contracts-documents-workflows-signatures-writes-admin-raw-excluded",
    ] {
      try expect(
        combined.contains(expected), "SpotDraft bundled source contract missing \(expected)")
    }
    for forbidden in [
      "SpotDraft account password", "SpotDraft OAuth callback", "SpotDraft private contract body",
      "SpotDraft raw API",
    ] {
      try expect(
        !combined.contains(forbidden), "SpotDraft bundled surface must exclude \(forbidden)")
    }
  }

  private static func testContractbookApplicationsControlsAreSourceBacked() throws {
    let combined =
      try readPackageFile("Sources/RelayConsoleApp/Views.swift")
      + readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    for expected in [
      "contractbook", "Contractbook", "full=false", "contractbook_private_document_data",
      "contractbook_files_sharing_signing",
      "key-titles-owners-parties-fields-tags-workspaces-files-sharing-signing-writes-admin-raw-excluded",
    ] {
      try expect(
        combined.contains(expected), "Contractbook bundled source contract missing \(expected)")
    }
    for forbidden in [
      "Contractbook account password", "Contractbook OAuth callback",
      "Contractbook private agreement body", "Contractbook raw API",
    ] {
      try expect(
        !combined.contains(forbidden), "Contractbook bundled surface must exclude \(forbidden)")
    }
  }

  private static func testLogRocketApplicationsControlsAreSourceBacked() throws {
    let combined =
      try readPackageFile("Sources/RelayConsoleApp/Views.swift")
      + readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    for expected in [
      "logrocket", "LogRocket", "toolsets=issues", "logrocket_find_issues",
      "logrocket_session_data",
      "api-key-sessions-replays-users-network-dom-metrics-galileo-account-admin-export-raw-mcp-writes-excluded",
    ] {
      try expect(
        combined.contains(expected), "LogRocket bundled source contract missing \(expected)")
    }
    for forbidden in [
      "LogRocket account password", "LogRocket browser session", "LogRocket unrestricted MCP",
      "LogRocket local backend",
    ] {
      try expect(
        !combined.contains(forbidden), "LogRocket bundled surface must exclude \(forbidden)")
    }
  }

  private static func testSmartlookApplicationsControlsAreSourceBacked() throws {
    let combined =
      try readPackageFile("Sources/RelayConsoleApp/Views.swift")
      + readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    for expected in [
      "smartlook", "Smartlook", "GET /api/v1/events", "smartlook_event_definitions_list",
      "smartlook_visitor_session_data",
      "token-visitors-sessions-recordings-identities-urls-selectors-properties-funnels-writes-admin-raw-excluded",
    ] {
      try expect(
        combined.contains(expected), "Smartlook bundled source contract missing \(expected)")
    }
    for forbidden in [
      "Smartlook account password", "Smartlook browser session", "Smartlook recording playback",
      "Smartlook local backend",
    ] {
      try expect(
        !combined.contains(forbidden), "Smartlook bundled surface must exclude \(forbidden)")
    }
  }

  private static func testCrazyEggApplicationsControlsAreSourceBacked() throws {
    let combined =
      try readPackageFile("Sources/RelayConsoleApp/Views.swift")
      + readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    for expected in [
      "crazy-egg", "Crazy Egg", "track.crazyegg.com/api/v1", "crazy_egg_conversions_record",
      "crazy_egg_synthetic_conversion",
      "key-identifiers-responses-analytics-recordings-broader-writes-synthetic-events-raw-excluded",
    ] {
      try expect(
        combined.contains(expected), "Crazy Egg bundled source contract missing \(expected)")
    }
    for forbidden in [
      "Crazy Egg account password", "Crazy Egg browser session", "Crazy Egg private endpoint",
      "Crazy Egg local backend",
    ] {
      try expect(
        !combined.contains(forbidden), "Crazy Egg bundled surface must exclude \(forbidden)")
    }
  }

  private static func testAppcuesApplicationsControlsAreSourceBacked() throws {
    let combined =
      try readPackageFile("Sources/RelayConsoleApp/Views.swift")
      + readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    for expected in [
      "appcues", "Appcues", "GET /v2/accounts/{account_id}/flows", "appcues_flows_list",
      "appcues_users_segments_data",
      "key-secret-creators-tags-urls-content-users-segments-exports-writes-admin-raw-excluded",
    ] {
      try expect(combined.contains(expected), "Appcues bundled source contract missing \(expected)")
    }
    for forbidden in [
      "Appcues account password", "Appcues browser session", "Appcues raw API",
      "Appcues local backend",
    ] {
      try expect(!combined.contains(forbidden), "Appcues bundled surface must exclude \(forbidden)")
    }
  }

  private static func testUserflowApplicationsControlsAreSourceBacked() throws {
    let combined =
      try readPackageFile("Sources/RelayConsoleApp/Views.swift")
      + readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    for expected in [
      "userflow", "Userflow", "GET /content", "Userflow-Version 2020-01-03",
      "userflow_content_list", "userflow_users_groups_events",
      "key-labels-content-versions-sessions-users-groups-events-webhooks-writes-admin-raw-excluded",
    ] {
      try expect(
        combined.contains(expected), "Userflow bundled source contract missing \(expected)")
    }
    for forbidden in [
      "Userflow account password", "Userflow browser session", "Userflow raw API",
      "Userflow local backend",
    ] {
      try expect(
        !combined.contains(forbidden), "Userflow bundled surface must exclude \(forbidden)")
    }
  }

  private static func testUserpilotApplicationsControlsAreSourceBacked() throws {
    let combined =
      try readPackageFile("Sources/RelayConsoleApp/Views.swift")
      + readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    for expected in [
      "userpilot", "Userpilot", "GET /api/v1/analytics/exports/lookups/features_events",
      "userpilot_feature_event_definitions_list", "userpilot_user_company_data",
      "key-user-company-properties-segments-analytics-content-exports-imports-deletes-writes-raw-excluded",
    ] {
      try expect(
        combined.contains(expected), "Userpilot bundled source contract missing \(expected)")
    }
    for forbidden in [
      "Userpilot account password", "Userpilot browser session", "Userpilot raw API",
      "Userpilot local backend",
    ] {
      try expect(
        !combined.contains(forbidden), "Userpilot bundled surface must exclude \(forbidden)")
    }
  }

  private static func testChameleonApplicationsControlsAreSourceBacked() throws {
    let combined =
      try readPackageFile("Sources/RelayConsoleApp/Views.swift")
      + readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    for expected in [
      "chameleon", "Chameleon", "GET /v3/edit/tours", "chameleon_tours_list",
      "chameleon_profiles_companies_interactions",
      "secret-segments-tags-urls-content-audience-stats-profiles-companies-interactions-writes-raw-excluded",
    ] {
      try expect(
        combined.contains(expected), "Chameleon bundled source contract missing \(expected)")
    }
    for forbidden in [
      "Chameleon account password", "Chameleon browser session", "Chameleon raw API",
      "Chameleon local backend",
    ] {
      try expect(
        !combined.contains(forbidden), "Chameleon bundled surface must exclude \(forbidden)")
    }
  }

  private static func testVitallyApplicationsControlsAreSourceBacked() throws {
    let combined =
      try readPackageFile("Sources/RelayConsoleApp/Views.swift")
      + readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    for expected in [
      "vitally", "Vitally", "GET /resources/customFields", "vitally_custom_traits_list",
      "vitally_customer_records",
      "key-options-values-customer-records-revenue-health-nps-activities-content-writes-deletes-bulk-raw-excluded",
    ] {
      try expect(combined.contains(expected), "Vitally bundled source contract missing \(expected)")
    }
    for forbidden in [
      "Vitally account password", "Vitally browser session", "Vitally raw API",
      "Vitally local backend",
    ] {
      try expect(!combined.contains(forbidden), "Vitally bundled surface must exclude \(forbidden)")
    }
  }

  private static func testGainsightApplicationsControlsAreSourceBacked() throws {
    let combined =
      try readPackageFile("Sources/RelayConsoleApp/Views.swift")
      + readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    for expected in [
      "gainsight", "Gainsight", "GET /v1/meta/services/objects/list?po=company&em=false",
      "gainsight_objects_list", "gainsight_customer_person_data",
      "key-request-ids-prefixes-fields-lookups-permissions-customer-person-values-writes-deletes-bulk-raw-excluded",
    ] {
      try expect(
        combined.contains(expected), "Gainsight bundled source contract missing \(expected)")
    }
    for forbidden in [
      "Gainsight account password", "Gainsight browser session", "Gainsight raw API",
      "Gainsight local backend",
    ] {
      try expect(
        !combined.contains(forbidden), "Gainsight bundled surface must exclude \(forbidden)")
    }
  }

  private static func testTotangoApplicationsControlsAreSourceBacked() throws {
    let combined =
      try readPackageFile("Sources/RelayConsoleApp/Views.swift")
      + readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    for expected in [
      "totango", "Totango", "GET /api/v3/activity-types/", "totango_flows_list",
      "totango_customer_user_data",
      "token-activity-counts-icons-customers-users-events-touchpoints-tasks-objectives-writes-search-bulk-raw-excluded",
    ] {
      try expect(combined.contains(expected), "Totango bundled source contract missing \(expected)")
    }
    for forbidden in [
      "Totango account password", "Totango browser session", "Totango raw API",
      "Totango local backend",
    ] {
      try expect(!combined.contains(forbidden), "Totango bundled surface must exclude \(forbidden)")
    }
  }

  private static func testCustifyApplicationsControlsAreSourceBacked() throws {
    let combined =
      try readPackageFile("Sources/RelayConsoleApp/Views.swift")
      + readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    for expected in [
      "custify", "Custify", "GET /segment", "custify_segments_list", "custify_customer_person_data",
      "key-goals-tags-membership-customers-people-health-revenue-engagement-writes-deletes-bulk-raw-excluded",
    ] {
      try expect(combined.contains(expected), "Custify bundled source contract missing \(expected)")
    }
    for forbidden in [
      "Custify account password", "Custify browser session", "Custify raw API",
      "Custify local backend",
    ] {
      try expect(!combined.contains(forbidden), "Custify bundled surface must exclude \(forbidden)")
    }
  }

  private static func testPlanhatApplicationsControlsAreSourceBacked() throws {
    let combined =
      try readPackageFile("Sources/RelayConsoleApp/Views.swift")
      + readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    for expected in [
      "planhat", "Planhat", "GET /customfields", "planhat_custom_fields_list",
      "planhat_customer_user_data",
      "token-formulas-options-filters-references-values-customers-users-engagement-writes-mcp-bulk-raw-excluded",
    ] {
      try expect(combined.contains(expected), "Planhat bundled source contract missing \(expected)")
    }
    for forbidden in [
      "Planhat account password", "Planhat browser session", "Planhat raw API",
      "Planhat local backend",
    ] {
      try expect(!combined.contains(forbidden), "Planhat bundled surface must exclude \(forbidden)")
    }
  }

  private static func testClientSuccessApplicationsControlsAreSourceBacked() throws {
    let combined =
      try readPackageFile("Sources/RelayConsoleApp/Views.swift")
      + readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    for expected in [
      "clientsuccess", "ClientSuccess", "GET /v2/customfield/all/CLIENT",
      "clientsuccess_client_custom_fields_list", "clientsuccess_customer_contact_data",
      "authorization-values-options-usage-placeholders-customers-contacts-health-revenue-engagement-writes-admin-bulk-raw-excluded",
    ] {
      try expect(
        combined.contains(expected), "ClientSuccess bundled source contract missing \(expected)")
    }
    for forbidden in [
      "ClientSuccess account password", "ClientSuccess browser session", "ClientSuccess raw API",
      "ClientSuccess local backend",
    ] {
      try expect(
        !combined.contains(forbidden), "ClientSuccess bundled surface must exclude \(forbidden)")
    }
  }

  private static func testFreshsalesApplicationsControlsAreSourceBacked() throws {
    let combined =
      try readPackageFile("Sources/RelayConsoleApp/Views.swift")
      + readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    for expected in [
      "freshsales", "Freshsales", "GET /api/contacts/filters", "freshsales_contact_filters_list",
      "freshsales_crm_records",
      "key-filter-logic-crm-records-writes-admin-exports-bulk-raw-excluded",
    ] {
      try expect(
        combined.contains(expected), "Freshsales bundled source contract missing \(expected)")
    }
    for forbidden in [
      "Freshsales account password", "Freshsales browser session", "Freshsales raw API",
      "Freshsales local backend",
    ] {
      try expect(
        !combined.contains(forbidden), "Freshsales bundled surface must exclude \(forbidden)")
    }
  }

  private static func testInsightlyApplicationsControlsAreSourceBacked() throws {
    let combined =
      try readPackageFile("Sources/RelayConsoleApp/Views.swift")
      + readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    for expected in [
      "insightly", "Insightly", "GET /CustomFields", "insightly_custom_fields_list",
      "insightly_crm_records",
      "key-help-defaults-options-dependencies-joins-values-crm-records-writes-admin-exports-bulk-raw-excluded",
    ] {
      try expect(
        combined.contains(expected), "Insightly bundled source contract missing \(expected)")
    }
    for forbidden in [
      "Insightly account password", "Insightly browser session", "Insightly raw API",
      "Insightly local backend",
    ] {
      try expect(
        !combined.contains(forbidden), "Insightly bundled surface must exclude \(forbidden)")
    }
  }

  private static func testNimbleApplicationsControlsAreSourceBacked() throws {
    let combined =
      try readPackageFile("Sources/RelayConsoleApp/Views.swift")
      + readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    for expected in [
      "nimble", "Nimble", "GET https://app.nimble.com/api/v1/contacts/fields",
      "nimble_contact_fields_list", "nimble_contact_deal_message_data",
      "key-presentation-validation-choices-actions-layout-ids-contacts-deals-messages-writes-admin-exports-bulk-raw-excluded",
    ] {
      try expect(combined.contains(expected), "Nimble bundled source contract missing \(expected)")
    }
    for forbidden in [
      "Nimble account password", "Nimble browser session", "Nimble raw API", "Nimble local backend",
    ] {
      try expect(!combined.contains(forbidden), "Nimble bundled surface must exclude \(forbidden)")
    }
  }
  private static func testCapsuleCrmApplicationsControlsAreSourceBacked() throws {
    let combined =
      try readPackageFile("Sources/RelayConsoleApp/Views.swift")
      + readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    for expected in [
      "capsule-crm", "Capsule CRM", "GET /api/v2/parties/fields/definitions?page=1&perPage=100",
      "capsule_crm_party_custom_fields_list", "capsule_crm_records",
      "token-descriptions-tags-options-values-records-writes-admin-mcp-bulk-raw-excluded",
    ] {
      try expect(combined.contains(expected), "Capsule CRM bundled contract missing \(expected)")
    }
  }

  private static func testKeapApplicationsControlsAreSourceBacked() throws {
    let combined =
      try readPackageFile("Sources/RelayConsoleApp/Views.swift")
      + readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    for expected in [
      "keap", "Keap", "GET https://api.infusionsoft.com/crm/rest/v2/contacts/model",
      "keap_contact_custom_fields_list", "keap_crm_commerce_records",
      "token-options-defaults-groups-optional-properties-values-records-writes-admin-xmlrpc-bulk-raw-excluded",
    ] { try expect(combined.contains(expected), "Keap bundled contract missing \(expected)") }
  }

  private static func testOutlookApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let appModel = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let provider = try readPackageFile("Sources/RelayConsoleCore/ProviderConnectionService.swift")
    let adapter = try readPackageFile("Sources/RelayConsoleCore/OutlookProviderActionAdapter.swift")
    let runtime = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift")
    let wrappers = try readPackageFile(
      "Sources/RelayConsoleCore/RelayProviderWrapperToolCompilerService.swift")
    let combined = views + appModel + provider + adapter + runtime + wrappers
    for expected in [
      "ApplicationsOutlookDetailPanel", "marketplace-logo-outlook", "Agents with Outlook",
      "Connect Outlook",
      "Exact delegated Mail.Read · signed-in mailbox only · no sends or attachments",
      "outlookRelayOwnedOAuthScopes", "saveOutlookRelayOwnedOAuthConnection",
      "rotateOutlookRelayOwnedOAuthTokens", "outlook_oauth_access_token",
      "relay_outlook_list_unread_messages", "delegatedOnly", "selfMailboxOnly",
      "applicationPermissionsEnabled", "attachmentsEnabled", "searchEnabled", "writesEnabled",
      "automaticPagination", "pkceS256",
    ] { try expect(combined.contains(expected), "Outlook source contract missing \(expected)") }
    for forbidden in [
      "outlookClientSecretDraft", "outlookRefreshTokenDraft", "Mail.ReadWrite", "Mail.Send",
      "Mail.Read.Shared",
    ] {
      try expect(
        !views.contains(forbidden)
          && !sourceContainsIgnoringWhitespace(appModel, containsIgnoringWhitespace: forbidden),
        "Outlook desktop surface must exclude \(forbidden)")
    }
    try expect(
      adapter.contains("outlook.body-content-type=\\\"text\\\"")
        && adapter.contains("attachmentsReturned")
        && adapter.contains("request.permission == .allowed")
        && !adapter.contains("refreshAccessToken"),
      "Outlook adapter must prove text/redaction and access-token-only dispatch")
  }

  private static func testGoogleSearchConsoleApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let appModel = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let providerService = try readPackageFile(
      "Sources/RelayConsoleCore/ProviderConnectionService.swift")
    let adapter = try readPackageFile(
      "Sources/RelayConsoleCore/GoogleSearchConsoleProviderActionAdapter.swift")
    let combined = views + appModel + providerService + adapter

    for expected in [
      "ApplicationsGoogleSearchConsoleDetailPanel",
      "Complete Relay-owned OAuth and explicit-property selection on Railway before assigning agents.",
      "Authorization, offline refresh, revocation, and explicit property binding are brokered on Railway.",
      "Exact webmasters.readonly scope · Read only · No access",
      "Google Search Console authorization, offline refresh, revocation, and selected-property binding are not deployed on Railway yet.",
      "googleSearchConsoleRelayOwnedOAuthScopes",
      "saveGoogleSearchConsoleRelayOwnedOAuthConnection",
      "rotateGoogleSearchConsoleRelayOwnedOAuthTokens",
      "google_search_console_oauth_access_token",
      "automaticPagination",
      "serviceAccountEnabled",
      "domainDelegationEnabled",
    ] {
      try expect(
        combined.contains(expected),
        "Google Search Console Railway-owned source contract missing \(expected)")
    }

    for forbidden in [
      "googleSearchConsoleClientIdDraft",
      "googleSearchConsoleClientSecretDraft",
      "googleSearchConsoleRefreshTokenDraft",
      "googleSearchConsoleAccessTokenDraft",
      "prepareGoogleSearchConsoleSession(",
      "consumeGoogleSearchConsoleCallback(",
      "exchangeGoogleSearchConsoleAuthorizationCode(",
      "model.saveGoogleSearchConsoleOAuthCredentials",
    ] {
      try expect(
        !views.contains(forbidden)
          && !sourceContainsIgnoringWhitespace(appModel, containsIgnoringWhitespace: forbidden),
        "Google Search Console desktop OAuth surface must exclude \(forbidden)")
    }
    try expect(
      providerService.contains("Desktop-supplied Search Console OAuth credentials are disabled."),
      "Legacy credential entry must fail closed")
    try expect(
      !adapter.contains("refreshAccessToken"),
      "Live Search Console adapter must not refresh OAuth locally")
    try expect(
      sourceContainsIgnoringWhitespace(
        appModel, containsIgnoringWhitespace: "connection.credentialOwnership == .relayOwned"),
      "Assignment must require Relay-owned credentials")
    try expect(
      sourceContainsIgnoringWhitespace(
        appModel,
        containsIgnoringWhitespace:
          "connection.grantedScopes == ProviderConnectionService.googleSearchConsoleRelayOwnedOAuthScopes"
      ), "Assignment must require the exact read-only scope")
  }

  private static func testMicrosoftClarityApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let appModel = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let service = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let providerService = try readPackageFile(
      "Sources/RelayConsoleCore/ProviderConnectionService.swift")
    let policyCompiler = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let wrapperCompiler = try readPackageFile(
      "Sources/RelayConsoleCore/RelayProviderWrapperToolCompilerService.swift")
    let runtimeMounts = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift")
    let uiSource =
      views + appModel + service + providerService + policyCompiler + wrapperCompiler
      + runtimeMounts

    for expected in [
      "ApplicationsMicrosoftClarityDetailPanel",
      "ApplicationsMicrosoftClarityAgentsCard",
      "ApplicationsMicrosoftClarityAgentSwitchRow",
      "ApplicationsMicrosoftClarityConnectionsCard",
      "ApplicationsMicrosoftClarityConnectionHeader",
      "ApplicationsMicrosoftClarityConnectionRow",
      "Read recent project-live-insights through Relay wrappers",
      "Break down insights by up to three supported Clarity dimensions",
      "Agents with Microsoft Clarity",
      "Select which agents should use the active read-only Clarity project connection.",
      "Save a Microsoft Clarity Data Export API token before turning agents on.",
      "Select a saved Microsoft Clarity connection before turning agents on.",
      "No Microsoft Clarity connection",
      "Add a user-owned Data Export API token before assigning agents.",
      "Manage API Connection",
      "Save Microsoft Clarity Data Export API tokens as Keychain references.",
      "Checks and live reads can spend the 10 requests/project/day Clarity export quota.",
      "Add Data Export API token",
      "Data Export API token",
      "Project or site URL optional",
      "Project ID optional",
      "The token is stored in Keychain only. Project metadata is optional and non-secret.",
      "Use Check only when needed; it performs one bounded live Data Export API request.",
      "Connect \\(displayName) to Microsoft Clarity?",
      "Disconnect Microsoft Clarity for \\(displayName)?",
      "This connects the agent to the selected Clarity project with read-only Standard authority.",
      "Read-only Clarity insights",
      "saveMicrosoftClarityAPIToken",
      "testMicrosoftClarityConnection",
      "validateSavedMicrosoftClarityConnection",
      "selectMicrosoftClarityConnection",
      "deleteMicrosoftClarityConnection",
      "setMicrosoftClarityAgentConnection",
      "microsoftClarityDataExportCapabilities",
      "relayOwnedMicrosoftClarityApp",
      "rawTokenStoredInDatabase",
      "microsoft_clarity_get_project_live_insights",
      "relay_microsoft_clarity_get_project_live_insights",
      "microsoft_clarity_raw_session_recording_export",
      "microsoft_clarity_heatmap_export",
      "Microsoft Clarity Data Export API endpoint",
      "Use only the brokered Microsoft Clarity live-insights wrapper",
    ] {
      try expect(
        uiSource.contains(expected), "Microsoft Clarity Applications UI source missing \(expected)")
    }

    try expect(
      views.contains("disabled: !selectedConnectionReady || target.status != .compatible"),
      "Microsoft Clarity agent toggles should stay disabled until an active compatible connection exists"
    )
    try expect(
      sourceContainsIgnoringWhitespace(
        appModel,
        containsIgnoringWhitespace: "case \"exa-search\", \"microsoft-clarity\", \"stripe\"")
        && sourceContainsIgnoringWhitespace(
          appModel, containsIgnoringWhitespace: "return [.approvalRequired, .readOnly, .blocked]"),
      "Microsoft Clarity authority presets should not expose Direct writes")
    try expect(
      views.contains("model.busy == \"save-microsoft-clarity-api-token\""),
      "Microsoft Clarity save flow should expose bounded busy state")
    try expect(
      views.contains("model.busy == \"test-microsoft-clarity-connection-\\(connection.id)\""),
      "Microsoft Clarity health check should expose bounded test busy state")
    try expect(
      views.contains("model.testMicrosoftClarityConnection(connection, for: app)"),
      "Microsoft Clarity connection rows should expose health-check behavior")
    try expect(
      views.contains("model.deleteMicrosoftClarityConnection(connection, for: app)"),
      "Microsoft Clarity connection rows should expose delete behavior")
    try expect(
      views.contains("model.selectMicrosoftClarityConnection(connection.id)"),
      "Microsoft Clarity connection rows should expose select-active behavior")
    try expect(
      sourceContainsIgnoringWhitespace(
        appModel,
        containsIgnoringWhitespace:
          "\"Connecting \\(displayName) to \\(connection.accountLabel ?? \"Microsoft Clarity project\")"
      ), "Microsoft Clarity assignment should surface connecting status")
    try expect(
      sourceContainsIgnoringWhitespace(
        appModel,
        containsIgnoringWhitespace:
          "\"Disconnecting \\(displayName) from \\(connection.accountLabel ?? \"Microsoft Clarity project\")"
      ), "Microsoft Clarity disconnect should surface disconnecting status")
    try expect(
      !uiSource.contains("Configure shared Relay-owned Microsoft Clarity app"),
      "Microsoft Clarity UI should not suggest shared Relay-owned app ownership")
  }

  private static func testNotionApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let appModel = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let service = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let providerService = try readPackageFile(
      "Sources/RelayConsoleCore/ProviderConnectionService.swift")
    let uiSource = views + appModel + service + providerService

    for expected in [
      "ApplicationsNotionDetailPanel",
      "ApplicationsNotionAgentsCard",
      "ApplicationsNotionAgentSwitchRow",
      "ApplicationsNotionConnectionsCard",
      "ApplicationsNotionConnectionHeader",
      "ApplicationsNotionConnectionRow",
      "Search Notion pages and data sources through Relay wrappers",
      "Create pages, append updates, and comment through approval or Direct writes",
      "Agents with Notion",
      "Connect your Notion workspace securely with one click.",
      "Connect Notion",
      "startNotionOAuthConnect",
      "connectors/notion/oauth/start",
      "https://relayconsole.work/app?marketplace_app=notion",
      "Save a Notion API token below before turning agents on.",
      "No Notion API token",
      "Add a user-owned Notion API token before assigning agents.",
      "Personal access token",
      "Internal connection token",
      "saveNotionAPIToken",
      "testNotionConnection",
      "selectNotionConnection",
      "deleteNotionConnection",
      "setNotionAgentConnection",
      "notionTokenCapabilities",
      "relayOwnedNotionApp",
      "rawTokenStoredInDatabase",
    ] {
      try expect(uiSource.contains(expected), "Notion Applications UI source missing \(expected)")
    }

    try expect(
      views.contains("disabled: selectedConnection == nil || target.status != .compatible"),
      "Notion agent toggles should stay disabled until an active compatible connection exists")
    try expect(
      sourceContainsIgnoringWhitespace(
        appModel,
        containsIgnoringWhitespace:
          "\"linkedin\", \"gmail\", \"google-docs\", \"google-calendar\", \"google-drive\""),
      "Notion authority presets should expose the Direct writes option")
    try expect(
      views.contains("model.busy == \"save-notion-api-token\""),
      "Notion save flow should expose bounded busy state")
    try expect(
      views.contains("model.deleteNotionConnection(connection, for: app)"),
      "Notion connection rows should expose delete behavior")
    try expect(
      views.contains("model.selectNotionConnection(connection.id)"),
      "Notion connection rows should expose select-active behavior")
    try expect(
      sourceContainsIgnoringWhitespace(
        appModel,
        containsIgnoringWhitespace:
          "\"Connecting \\(displayName) to \\(connection.accountLabel ?? \"Notion token\")"),
      "Notion assignment should surface connecting status")
    try expect(
      sourceContainsIgnoringWhitespace(
        appModel,
        containsIgnoringWhitespace:
          "\"Disconnecting \\(displayName) from \\(connection.accountLabel ?? \"Notion token\")"),
      "Notion disconnect should surface disconnecting status")
    try expect(
      sourceContainsIgnoringWhitespace(
        appModel,
        containsIgnoringWhitespace: "authorizationURL.host?.lowercased() == \"api.notion.com\""),
      "Notion OAuth must allow only the official authorization host")
  }

  private static func testSlackApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let appModel = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let service = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let providerService = try readPackageFile(
      "Sources/RelayConsoleCore/ProviderConnectionService.swift")
    let policyCompiler = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let runtimeMounts = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift")
    let uiSource = views + appModel + service + providerService + policyCompiler + runtimeMounts

    for expected in [
      "ApplicationsSlackDetailPanel",
      "ApplicationsSlackAgentsCard",
      "ApplicationsSlackAgentSwitchRow",
      "ApplicationsSlackConnectionsCard",
      "ApplicationsSlackConnectionHeader",
      "ApplicationsSlackConnectionRow",
      "Agents with Slack",
      "Select which agents should use the active Slack workspace connection.",
      "Connect Slack below before turning agents on.",
      "No Slack workspace connection",
      "Connect Slack before assigning agents.",
      "Connect a Slack workspace securely with one click.",
      "Your Slack access stays encrypted and is never shown to agents.",
      "Relay-owned Slack OAuth client configuration must be available before Connect can open consent.",
      "Connection credentials are encrypted and never exposed to agents.",
      "Connect \\(displayName) to Slack?",
      "Disconnect Slack for \\(displayName)?",
      "This connects the agent to the Slack workspace in Safe mode. You can change its authority after connecting.",
      "This removes the agent's access to the Slack workspace.",
      "setSlackAgentConnection",
      "applications-slack-agent-switch",
      "toggle-slack-agent-\\(agentId)",
      "slackSelectedConnectionId",
      "slackConnectionStatus",
      "slackRelayOwnedOAuthScopes",
      "slack_bot_access_token",
      "relayOwnedSlackApp",
      "slack_conversation_search",
      "slack_message_send",
      "slack_raw_api_call",
      "Use brokered Relay wrappers for Slack channel search",
    ] {
      try expect(uiSource.contains(expected), "Slack Applications UI source missing \(expected)")
    }

    guard let rowStart = views.range(of: "struct ApplicationsSlackAgentSwitchRow"),
      let rowEnd = views.range(of: "struct ApplicationsSlackConnectionsCard")
    else {
      throw ComponentBaselineTestFailure("Slack agent switch row source not found")
    }
    let rowSource = String(views[rowStart.lowerBound..<rowEnd.lowerBound])
    try expect(
      rowSource.contains("pendingConnectionState = !isOn"),
      "Slack agent card should toggle only through the switch button")
    try expect(
      !rowSource.contains(".onTapGesture"), "Slack agent card clicks must not toggle assignment")
    try expect(
      rowSource.contains(".alert(confirmationTitle, isPresented: confirmationBinding)"),
      "Slack assignment changes should require confirmation")
    try expect(
      views.contains("disabled: selectedConnection == nil || target.status != .compatible"),
      "Slack agent toggles should stay disabled until an active compatible connection exists")
    try expect(
      sourceContainsIgnoringWhitespace(
        views,
        containsIgnoringWhitespace:
          "ApplicationsAgentAuthorityRow( app: app, install: install, selectedPreset: install.flatMap { model.marketplaceActionPolicyPreset(for: $0) } ?? .approvalRequired,"
      ), "Slack assigned agents should expose the authority row")
    try expect(
      sourceContainsIgnoringWhitespace(
        appModel,
        containsIgnoringWhitespace:
          "\"notion\", \"slack\", \"github\", \"gitlab\", \"bitbucket\", \"linear\", \"asana\""),
      "Slack authority presets should expose Direct writes")
    try expect(
      sourceContainsIgnoringWhitespace(
        appModel,
        containsIgnoringWhitespace:
          "\"Connecting \\(displayName) to \\(connection.accountLabel ?? \"Slack workspace\")"),
      "Slack assignment should surface connecting status")
    try expect(
      sourceContainsIgnoringWhitespace(
        appModel,
        containsIgnoringWhitespace:
          "\"Disconnecting \\(displayName) from \\(connection.accountLabel ?? \"Slack workspace\")"),
      "Slack disconnect should surface disconnecting status")
    try expect(
      sourceContainsIgnoringWhitespace(
        appModel, containsIgnoringWhitespace: "self.slackSelectedConnectionId = connection.id"),
      "Slack assignment should preserve selected connection across refresh")
    try expect(
      sourceContainsIgnoringWhitespace(
        appModel,
        containsIgnoringWhitespace: "updatedInstall.metadata[\"providerActionFrameworkSource\"]")
        && sourceContainsIgnoringWhitespace(
          appModel, containsIgnoringWhitespace: "\"applications-agent-authority-menu\""),
      "Slack authority changes should update install metadata without a full app refresh loop")
    try expect(
      !uiSource.contains("raw Slack API calls are available"),
      "Slack UI should not expose raw Slack API access")
  }

  private static func testGitHubApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let appModel = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let service = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let providerService = try readPackageFile(
      "Sources/RelayConsoleCore/ProviderConnectionService.swift")
    let uiSource = views + appModel + service + providerService

    for expected in [
      "ApplicationsGitHubDetailPanel",
      "ApplicationsGitHubAgentsCard",
      "ApplicationsGitHubAgentSwitchRow",
      "ApplicationsGitHubConnectionsCard",
      "ApplicationsGitHubConnectionHeader",
      "ApplicationsGitHubConnectionRow",
      "Agents with GitHub",
      "Select which agents should use the active GitHub OAuth connection.",
      "Connect GitHub below before turning agents on.",
      "No GitHub OAuth connection",
      "Connect GitHub before assigning agents.",
      "Connect a GitHub account securely with one click.",
      "Your GitHub access stays encrypted and is never shown to agents.",
      "Relay-owned GitHub OAuth client configuration must be available before Connect can open consent.",
      "Connection credentials are encrypted and never exposed to agents.",
      "Connect \\(displayName) to GitHub?",
      "Disconnect GitHub for \\(displayName)?",
      "This connects the agent to the GitHub account or organization with Standard authority.",
      "This removes the agent's access to the GitHub account or organization.",
      "setGitHubAgentConnection",
      "applications-github-agent-switch",
      "toggle-github-agent-\\(agentId)",
      "githubSelectedConnectionId",
      "githubConnectionStatus",
      "githubRelayOwnedOAuthScopes",
      "github_oauth_access_token",
      "relayOwnedGitHubApp",
      "approval_gated_repository_comments",
    ] {
      try expect(uiSource.contains(expected), "GitHub Applications UI source missing \(expected)")
    }

    guard let rowStart = views.range(of: "struct ApplicationsGitHubAgentSwitchRow"),
      let rowEnd = views.range(of: "struct ApplicationsGitHubConnectionsCard")
    else {
      throw ComponentBaselineTestFailure("GitHub agent switch row source not found")
    }
    let rowSource = String(views[rowStart.lowerBound..<rowEnd.lowerBound])
    try expect(
      rowSource.contains("pendingConnectionState = !isOn"),
      "GitHub agent card should toggle only through the switch button")
    try expect(
      !rowSource.contains(".onTapGesture"), "GitHub agent card clicks must not toggle assignment")
    try expect(
      rowSource.contains(".alert(confirmationTitle, isPresented: confirmationBinding)"),
      "GitHub assignment changes should require confirmation")
    try expect(
      views.contains("disabled: selectedConnection == nil || target.status != .compatible"),
      "GitHub agent toggles should stay disabled until an active compatible connection exists")
    try expect(
      sourceContainsIgnoringWhitespace(
        views,
        containsIgnoringWhitespace:
          "ApplicationsAgentAuthorityRow( app: app, install: install, selectedPreset: install.flatMap { model.marketplaceActionPolicyPreset(for: $0) } ?? .approvalRequired,"
      ), "GitHub assigned agents should expose the authority row")
    try expect(
      sourceContainsIgnoringWhitespace(
        appModel,
        containsIgnoringWhitespace:
          "\"notion\", \"slack\", \"github\", \"gitlab\", \"bitbucket\", \"linear\", \"asana\""),
      "GitHub authority presets should expose Direct writes")
    try expect(
      sourceContainsIgnoringWhitespace(
        appModel,
        containsIgnoringWhitespace:
          "\"Connecting \\(displayName) to \\(connection.accountLabel ?? \"GitHub account\")"),
      "GitHub assignment should surface connecting status")
    try expect(
      sourceContainsIgnoringWhitespace(
        appModel,
        containsIgnoringWhitespace:
          "\"Disconnecting \\(displayName) from \\(connection.accountLabel ?? \"GitHub account\")"),
      "GitHub disconnect should surface disconnecting status")
    try expect(
      sourceContainsIgnoringWhitespace(
        appModel, containsIgnoringWhitespace: "self.githubSelectedConnectionId = connection.id"),
      "GitHub assignment should preserve selected connection across refresh")
    try expect(
      providerService.contains("secretValue: trimmedAccessToken"),
      "GitHub access token should be stored through the secret service")
    try expect(
      !uiSource.contains("raw GitHub API calls are available"),
      "GitHub UI should not expose raw GitHub API access")
  }

  private static func testGitLabApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let appModel = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let service = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let providerService = try readPackageFile(
      "Sources/RelayConsoleCore/ProviderConnectionService.swift")
    let uiSource = views + appModel + service + providerService

    for expected in [
      "ApplicationsGitLabDetailPanel",
      "ApplicationsGitLabAgentsCard",
      "ApplicationsGitLabAgentSwitchRow",
      "ApplicationsGitLabConnectionsCard",
      "ApplicationsGitLabConnectionHeader",
      "ApplicationsGitLabConnectionRow",
      "Agents with GitLab",
      "Select which agents should use the active GitLab OAuth connection.",
      "Connect GitLab below before turning agents on.",
      "No GitLab OAuth connection",
      "Connect GitLab before assigning agents.",
      "Connect your GitLab account securely with one click.",
      "Your GitLab access stays encrypted and is never shown to agents.",
      "Relay-owned GitLab OAuth client configuration must be available before Connect can open consent.",
      "Connection credentials are encrypted by Relay Console and never exposed to agents.",
      "Connect \\(displayName) to GitLab?",
      "Disconnect GitLab for \\(displayName)?",
      "This connects the agent to the GitLab account, group, or project with Standard authority.",
      "This removes the agent's access to the GitLab account, group, or project.",
      "setGitLabAgentConnection",
      "applications-gitlab-agent-switch",
      "toggle-gitlab-agent-\\(agentId)",
      "gitLabSelectedConnectionId",
      "gitLabConnectionStatus",
      "gitLabRelayOwnedOAuthScopes",
      "gitlab_oauth_access_token",
      "relayOwnedGitLabApp",
      "approval_gated_gitlab_comments",
      "marketplace-logo-gitlab",
    ] {
      try expect(uiSource.contains(expected), "GitLab Applications UI source missing \(expected)")
    }

    guard let rowStart = views.range(of: "struct ApplicationsGitLabAgentSwitchRow"),
      let rowEnd = views.range(of: "struct ApplicationsGitLabConnectionsCard")
    else {
      throw ComponentBaselineTestFailure("GitLab agent switch row source not found")
    }
    let rowSource = String(views[rowStart.lowerBound..<rowEnd.lowerBound])
    try expect(
      rowSource.contains("pendingConnectionState = !isOn"),
      "GitLab agent card should toggle only through the switch button")
    try expect(
      !rowSource.contains(".onTapGesture"), "GitLab agent card clicks must not toggle assignment")
    try expect(
      rowSource.contains(".alert(confirmationTitle, isPresented: confirmationBinding)"),
      "GitLab assignment changes should require confirmation")
    try expect(
      views.contains("disabled: selectedConnection == nil || target.status != .compatible"),
      "GitLab agent toggles should stay disabled until an active compatible connection exists")
    try expect(
      sourceContainsIgnoringWhitespace(
        views,
        containsIgnoringWhitespace:
          "ApplicationsAgentAuthorityRow( app: app, install: install, selectedPreset: install.flatMap { model.marketplaceActionPolicyPreset(for: $0) } ?? .approvalRequired,"
      ), "GitLab assigned agents should expose the authority row")
    try expect(
      sourceContainsIgnoringWhitespace(
        appModel,
        containsIgnoringWhitespace:
          "\"notion\", \"slack\", \"github\", \"gitlab\", \"bitbucket\", \"linear\", \"asana\""),
      "GitLab authority presets should expose Direct writes")
    try expect(
      sourceContainsIgnoringWhitespace(
        appModel,
        containsIgnoringWhitespace:
          "\"Connecting \\(displayName) to \\(connection.accountLabel ?? \"GitLab account\")"),
      "GitLab assignment should surface connecting status")
    try expect(
      sourceContainsIgnoringWhitespace(
        appModel,
        containsIgnoringWhitespace:
          "\"Disconnecting \\(displayName) from \\(connection.accountLabel ?? \"GitLab account\")"),
      "GitLab disconnect should surface disconnecting status")
    try expect(
      sourceContainsIgnoringWhitespace(
        appModel, containsIgnoringWhitespace: "self.gitLabSelectedConnectionId = connection.id"),
      "GitLab assignment should preserve selected connection across refresh")
    try expect(
      providerService.contains("secretValue: trimmedAccessToken"),
      "GitLab access token should be stored through the secret service")
    try expect(
      !uiSource.contains("raw GitLab API calls are available"),
      "GitLab UI should not expose raw GitLab API access")
  }

  private static func testBitbucketApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let appModel = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let service = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let providerService = try readPackageFile(
      "Sources/RelayConsoleCore/ProviderConnectionService.swift")
    let policyCompiler = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let runtimeMounts = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift")
    let adapter = try readPackageFile(
      "Sources/RelayConsoleCore/BitbucketProviderActionAdapter.swift")
    let uiSource =
      views + appModel + service + providerService + policyCompiler + runtimeMounts + adapter

    for expected in [
      "ApplicationsBitbucketDetailPanel",
      "ApplicationsBitbucketAgentsCard",
      "ApplicationsBitbucketAgentSwitchRow",
      "ApplicationsBitbucketConnectionsCard",
      "ApplicationsBitbucketConnectionHeader",
      "ApplicationsBitbucketConnectionRow",
      "Agents with Bitbucket",
      "Select which agents should use the active Bitbucket OAuth connection.",
      "Connect Bitbucket below before turning agents on.",
      "No Bitbucket OAuth connection",
      "Connect Bitbucket before assigning agents.",
      "Connect your Bitbucket account securely with one click.",
      "Your Bitbucket access stays encrypted and is never shown to agents.",
      "Relay-owned Bitbucket OAuth client configuration must be available before Connect can open consent.",
      "Connection credentials are encrypted by Relay Console and never exposed to agents.",
      "Connect \\(displayName) to Bitbucket?",
      "Disconnect Bitbucket for \\(displayName)?",
      "This connects the agent to the Bitbucket account, group, or repository with Standard authority.",
      "This removes the agent's access to the Bitbucket account, group, or repository.",
      "setBitbucketAgentConnection",
      "applications-bitbucket-agent-switch",
      "toggle-bitbucket-agent-\\(agentId)",
      "bitbucketSelectedConnectionId",
      "bitbucketConnectionStatus",
      "bitbucketRelayOwnedOAuthScopes",
      "bitbucket_oauth_access_token",
      "relayOwnedBitbucketApp",
      "approval_gated_bitbucket_comments",
      "marketplace-logo-bitbucket",
      "BitbucketProviderActionAdapter",
      "bitbucket_repository_search",
      "bitbucket_pull_request_comment_create",
      "bitbucket_issue_comment_create",
    ] {
      try expect(uiSource.contains(expected), "Bitbucket Applications source missing \(expected)")
    }

    guard let rowStart = views.range(of: "struct ApplicationsBitbucketAgentSwitchRow"),
      let rowEnd = views.range(of: "struct ApplicationsBitbucketConnectionsCard")
    else {
      throw ComponentBaselineTestFailure("Bitbucket agent switch row source not found")
    }
    let rowSource = String(views[rowStart.lowerBound..<rowEnd.lowerBound])
    try expect(
      rowSource.contains("pendingConnectionState = !isOn"),
      "Bitbucket agent card should toggle only through the switch button")
    try expect(
      !rowSource.contains(".onTapGesture"), "Bitbucket agent card clicks must not toggle assignment"
    )
    try expect(
      rowSource.contains(".alert(confirmationTitle, isPresented: confirmationBinding)"),
      "Bitbucket assignment changes should require confirmation")
    try expect(
      views.contains("disabled: selectedConnection == nil || target.status != .compatible"),
      "Bitbucket agent toggles should stay disabled until an active compatible connection exists")
    try expect(
      sourceContainsIgnoringWhitespace(
        views,
        containsIgnoringWhitespace:
          "ApplicationsAgentAuthorityRow( app: app, install: install, selectedPreset: install.flatMap { model.marketplaceActionPolicyPreset(for: $0) } ?? .approvalRequired,"
      ), "Bitbucket assigned agents should expose the authority row")
    try expect(
      sourceContainsIgnoringWhitespace(
        appModel,
        containsIgnoringWhitespace:
          "\"notion\", \"slack\", \"github\", \"gitlab\", \"bitbucket\", \"linear\", \"asana\""),
      "Bitbucket authority presets should expose Direct writes")
    try expect(
      sourceContainsIgnoringWhitespace(
        appModel,
        containsIgnoringWhitespace:
          "\"Connecting \\(displayName) to \\(connection.accountLabel ?? \"Bitbucket account\")"),
      "Bitbucket assignment should surface connecting status")
    try expect(
      sourceContainsIgnoringWhitespace(
        appModel,
        containsIgnoringWhitespace:
          "\"Disconnecting \\(displayName) from \\(connection.accountLabel ?? \"Bitbucket account\")"
      ),
      "Bitbucket disconnect should surface disconnecting status")
    try expect(
      sourceContainsIgnoringWhitespace(
        appModel, containsIgnoringWhitespace: "self.bitbucketSelectedConnectionId = connection.id"),
      "Bitbucket assignment should preserve selected connection across refresh")
    try expect(
      providerService.contains("secretValue: trimmedAccessToken"),
      "Bitbucket access token should be stored through the secret service")
    try expect(
      !uiSource.contains("raw Bitbucket API calls are available"),
      "Bitbucket UI should not expose raw Bitbucket API access")
  }

  private static func testLinearApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let appModel = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let service = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let providerService = try readPackageFile(
      "Sources/RelayConsoleCore/ProviderConnectionService.swift")
    let policyCompiler = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let runtimeMounts = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift")
    let adapter = try readPackageFile("Sources/RelayConsoleCore/LinearProviderActionAdapter.swift")
    let uiSource =
      views + appModel + service + providerService + policyCompiler + runtimeMounts + adapter

    for expected in [
      "ApplicationsLinearDetailPanel",
      "ApplicationsLinearAgentsCard",
      "ApplicationsLinearAgentSwitchRow",
      "ApplicationsLinearConnectionsCard",
      "ApplicationsLinearConnectionHeader",
      "ApplicationsLinearConnectionRow",
      "Agents with Linear",
      "Select which agents should use the active Linear OAuth connection.",
      "Connect Linear below before turning agents on.",
      "No Linear OAuth connection",
      "Connect Linear before assigning agents.",
      "Connect a Linear workspace or team through Relay-owned OAuth.",
      "Railway stores and refreshes the Linear connection securely.",
      "Sign in to Linear, choose a workspace, and approve read and write access.",
      "Your Linear password is never shared with Relay Console.",
      "startLinearOAuthConnect",
      "connectors/linear/oauth/start",
      "authorizationURL.host?.lowercased() == \"linear.app\"",
      "Connect \\(displayName) to Linear?",
      "Disconnect Linear for \\(displayName)?",
      "This connects the agent to the Linear workspace or team with Standard authority.",
      "This removes the agent's access to the Linear workspace or team.",
      "setLinearAgentConnection",
      "applications-linear-agent-switch",
      "toggle-linear-agent-\\(agentId)",
      "linearSelectedConnectionId",
      "linearConnectionStatus",
      "linearRelayOwnedOAuthScopes",
      "linear_oauth_access_token",
      "relayOwnedLinearApp",
      "approval_gated_linear_issue_comments",
      "marketplace-logo-linear",
      "LinearProviderActionAdapter",
      "linear_issue_search",
      "linear_project_list",
      "linear_issue_comment_prepare",
      "linear_issue_comment_create",
      "linear_issue_create",
    ] {
      try expect(uiSource.contains(expected), "Linear Applications source missing \(expected)")
    }

    guard let rowStart = views.range(of: "struct ApplicationsLinearAgentSwitchRow"),
      let rowEnd = views.range(of: "struct ApplicationsLinearConnectionsCard")
    else {
      throw ComponentBaselineTestFailure("Linear agent switch row source not found")
    }
    let rowSource = String(views[rowStart.lowerBound..<rowEnd.lowerBound])
    try expect(
      rowSource.contains("pendingConnectionState = !isOn"),
      "Linear agent card should toggle only through the switch button")
    try expect(
      !rowSource.contains(".onTapGesture"), "Linear agent card clicks must not toggle assignment")
    try expect(
      rowSource.contains(".alert(confirmationTitle, isPresented: confirmationBinding)"),
      "Linear assignment changes should require confirmation")
    try expect(
      views.contains("disabled: selectedConnection == nil || target.status != .compatible"),
      "Linear agent toggles should stay disabled until an active compatible connection exists")
    try expect(
      sourceContainsIgnoringWhitespace(
        views,
        containsIgnoringWhitespace:
          "ApplicationsAgentAuthorityRow( app: app, install: install, selectedPreset: install.flatMap { model.marketplaceActionPolicyPreset(for: $0) } ?? .approvalRequired,"
      ), "Linear assigned agents should expose the authority row")
    try expect(
      sourceContainsIgnoringWhitespace(
        appModel,
        containsIgnoringWhitespace:
          "\"notion\", \"slack\", \"github\", \"gitlab\", \"bitbucket\", \"linear\", \"asana\""),
      "Linear authority presets should expose Direct writes")
    try expect(
      sourceContainsIgnoringWhitespace(
        appModel,
        containsIgnoringWhitespace:
          "\"Connecting \\(displayName) to \\(connection.accountLabel ?? \"Linear account\")"),
      "Linear assignment should surface connecting status")
    try expect(
      sourceContainsIgnoringWhitespace(
        appModel,
        containsIgnoringWhitespace:
          "\"Disconnecting \\(displayName) from \\(connection.accountLabel ?? \"Linear account\")"),
      "Linear disconnect should surface disconnecting status")
    try expect(
      sourceContainsIgnoringWhitespace(
        appModel, containsIgnoringWhitespace: "self.linearSelectedConnectionId = connection.id"),
      "Linear assignment should preserve selected connection across refresh")
    try expect(
      providerService.contains("secretValue: trimmedAccessToken"),
      "Linear access token should be stored through the secret service")
    try expect(
      !uiSource.contains("raw Linear API calls are available"),
      "Linear UI should not expose raw Linear API access")
    try expect(
      !uiSource.contains("Linear repositories"),
      "Linear source should not use repository-shaped copy")
    try expect(
      !uiSource.contains("Linear pull request"),
      "Linear source should not use pull-request-shaped copy")
  }

  private static func testAsanaApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let appModel = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let applications = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let providerConnections = try readPackageFile(
      "Sources/RelayConsoleCore/ProviderConnectionService.swift")
    let policies = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let adapter = try readPackageFile("Sources/RelayConsoleCore/AsanaProviderActionAdapter.swift")
    let runtime = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift")
    let icon = try readPackageFile(
      "Sources/RelayConsoleApp/Resources/Assets/marketplace-logos/marketplace-logo-asana.svg")
    let combined = [
      views, appModel, applications, providerConnections, policies, adapter, runtime, icon,
    ].joined(separator: "\n")

    for expected in [
      "ApplicationsAsanaDetailPanel", "ApplicationsAsanaAgentsCard",
      "ApplicationsAsanaAgentSwitchRow",
      "ApplicationsAsanaConnectionsCard", "ApplicationsAsanaConnectionHeader",
      "ApplicationsAsanaConnectionRow",
      "startAsanaOAuthConnect", "connectors/asana/oauth/start",
      "authorizationURL.host?.lowercased() == \"app.asana.com\"",
      "Agents with Asana", "Manage API Connection", "Connect Asana below before turning agents on.",
      "No Asana OAuth connection", "Connect Asana before assigning agents.",
      "Select one active workspace grant",
      "Connect an Asana account and workspace through Relay-owned OAuth.",
      "ApplicationsInfoCardsLayout", "Capabilities", "What Agents Can Do", "Requirements",
      "setAsanaAgentConnection", "selectAsanaConnection", "deleteAsanaOAuthConnection",
      "applications-asana-agent-switch", "toggle-asana-agent-", "asanaSelectedConnectionId",
      "asanaRelayOwnedOAuthScopes", "asana_oauth_access_token", "relayOwnedAsanaApp",
      "marketplace-logo-asana", "asana_task_search", "asana_project_list", "asana_task_get",
      "asana_task_prepare", "asana_task_create", "asana_task_update",
      "tasks:read", "projects:read", "users:read", "tasks:write",
      "workspaceGID", "projectGID", "taskGID", "assignee", "dueOn", "completed", "notesExcerpt",
    ] {
      try expect(
        combined.contains(expected), "Asana Applications/provider source missing \(expected)")
    }
    try expect(
      icon.contains("aria-label=\"Asana logo\""), "Asana asset should identify the full logo")
    try expect(
      views.contains("pendingConnectionState = !isOn"),
      "Asana assignment should toggle only through its switch button")
    try expect(
      views.contains("? \"Connect \\(displayName) to Asana?\""),
      "Asana assignment should require confirmation")
    try expect(
      sourceContainsIgnoringWhitespace(
        appModel, containsIgnoringWhitespace: "\"linear\", \"asana\""),
      "Asana authority menu should expose Standard, Direct rights, Read only, and No access presets"
    )
    try expect(
      !adapter.localizedCaseInsensitiveContains("issueId"),
      "Asana adapter must not retain issue identifiers")
    try expect(
      !adapter.localizedCaseInsensitiveContains("repository"),
      "Asana adapter must not retain repository semantics")
    try expect(
      !adapter.localizedCaseInsensitiveContains("pull request"),
      "Asana adapter must not retain pull-request semantics")
    try expect(
      !adapter.localizedCaseInsensitiveContains("teamKey"),
      "Asana adapter must not retain Linear team-key semantics")
    try expect(!adapter.contains("/issues"), "Asana adapter must not use issue endpoints")
    try expect(!adapter.contains("/repos"), "Asana adapter must not use repository endpoints")
  }

  private static func testTrelloApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let model = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let apps = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let connections = try readPackageFile(
      "Sources/RelayConsoleCore/ProviderConnectionService.swift")
    let policies = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let adapter = try readPackageFile("Sources/RelayConsoleCore/TrelloProviderActionAdapter.swift")
    let runtime = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift")
    let icon = try readPackageFile(
      "Sources/RelayConsoleApp/Resources/Assets/marketplace-logos/marketplace-logo-trello.svg")
    let source = [views, model, apps, connections, policies, adapter, runtime, icon].joined(
      separator: "\n")
    for expected in [
      "ApplicationsTrelloDetailPanel", "ApplicationsTrelloAgentsCard",
      "ApplicationsTrelloAgentSwitchRow", "ApplicationsTrelloConnectionsCard",
      "ApplicationsTrelloConnectionHeader", "ApplicationsTrelloConnectionRow", "Agents with Trello",
      "Connect Trello below before turning agents on.", "No Trello connection",
      "Manage API Connection", "Capabilities", "What Agents Can Do", "Requirements",
      "startTrelloOAuthConnect", "connectors/trello/oauth/start", "trello.com",
      "/1/OAuthAuthorizeToken", "setTrelloAgentConnection", "selectTrelloConnection",
      "deleteTrelloConnection", "applications-trello-agent-switch", "trelloSelectedConnectionId",
      "trelloRelayOwnedPermissions", "trello_api_key", "trello_user_token",
      "relayOwnedTrelloPowerUp", "marketplace-logo-trello", "trello_board_list",
      "trello_board_cards_list", "trello_card_get", "trello_search", "trello_card_prepare",
      "trello_card_create", "trello_card_update", "trello_card_comment_create", "boardId", "listId",
      "cardId", "dueComplete", "members", "labels",
    ] { try expect(source.contains(expected), "Trello source missing \(expected)") }
    try expect(
      icon.contains("aria-label=\"Trello logo\""), "Trello asset should identify the full logo")
    try expect(
      sourceContainsIgnoringWhitespace(model, containsIgnoringWhitespace: "\"asana\", \"trello\""),
      "Trello should expose four authority presets")
    for forbidden in [
      "taskGID", "workspaceGID", "projectGID", "teamKey", "/issues", "/repos", "pull request",
    ] {
      try expect(
        !adapter.localizedCaseInsensitiveContains(forbidden),
        "Trello adapter contains foreign semantic \(forbidden)")
    }
  }

  private static func testClickUpApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let model = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let apps = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let connections = try readPackageFile(
      "Sources/RelayConsoleCore/ProviderConnectionService.swift")
    let policies = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let adapter = try readPackageFile("Sources/RelayConsoleCore/ClickUpProviderActionAdapter.swift")
    let runtime = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift")
    let icon = try readPackageFile(
      "Sources/RelayConsoleApp/Resources/Assets/marketplace-logos/marketplace-logo-clickup.svg")
    let source = [views, model, apps, connections, policies, adapter, runtime, icon].joined(
      separator: "\n")
    for expected in [
      "ApplicationsClickUpDetailPanel", "ApplicationsClickUpAgentSwitchRow",
      "Connect \\(name) to ClickUp?", "Agents with ClickUp",
      "Connect ClickUp below before turning agents on.", "No ClickUp OAuth connection",
      "Manage API Connection", "startClickUpOAuthConnect", "connectors/clickup/oauth/start",
      "app.clickup.com", "connectors/clickup/connections/", "setClickUpAgentConnection",
      "selectClickUpConnection", "deleteClickUpOAuthConnection",
      "applications-clickup-agent-switch", "clickUpSelectedConnectionId",
      "clickUpRelayOwnedOAuthCapabilities", "clickup_oauth_access_token", "relayOwnedClickUpOAuth",
      "marketplace-logo-clickup", "clickup_workspace_list", "clickup_workspace_task_search",
      "clickup_list_tasks", "clickup_task_get", "clickup_task_prepare", "clickup_task_create",
      "clickup_task_update", "clickup_task_comment_create", "workspaceId", "listId", "taskId",
      "priority", "assignees", "parentTaskId",
    ] { try expect(source.contains(expected), "ClickUp source missing \(expected)") }
    try expect(
      icon.contains("<title id=\"title\">ClickUp</title>"),
      "ClickUp asset should identify the full logo")
    try expect(
      sourceContainsIgnoringWhitespace(
        model, containsIgnoringWhitespace: "\"trello\", \"clickup\""),
      "ClickUp should expose four authority presets")
    for forbidden in [
      "taskGID", "workspaceGID", "projectGID", "dueComplete", "cardId", "teamKey", "/issues",
      "/repos", "pull request",
    ] {
      try expect(
        !adapter.localizedCaseInsensitiveContains(forbidden),
        "ClickUp adapter contains foreign semantic \(forbidden)")
    }
  }

  private static func testMondayApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let model = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let apps = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let connections = try readPackageFile(
      "Sources/RelayConsoleCore/ProviderConnectionService.swift")
    let policies = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let adapter = try readPackageFile("Sources/RelayConsoleCore/MondayProviderActionAdapter.swift")
    let runtime = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift")
    let icon = try readPackageFile(
      "Sources/RelayConsoleApp/Resources/Assets/marketplace-logos/marketplace-logo-monday-com.svg")
    let source = [views, model, apps, connections, policies, adapter, runtime, icon].joined(
      separator: "\n")
    for expected in [
      "ApplicationsMondayDetailPanel", "ApplicationsMondayAgentSwitchRow", "Agents with Monday.com",
      "Connect Monday.com below before turning agents on.", "No Monday.com OAuth connection",
      "Manage API Connection", "startMondayOAuthConnect", "connectors/monday-com/oauth/start",
      "auth.monday.com", "connectors/monday-com/connections/", "setMondayAgentConnection",
      "selectMondayConnection", "deleteMondayOAuthConnection", "applications-monday-agent-switch",
      "mondaySelectedConnectionId", "mondayRelayOwnedOAuthScopes", "monday_oauth_access_token",
      "relayOwnedMondayOAuth", "marketplace-logo-monday-com", "monday_board_list",
      "monday_board_items", "monday_item_get", "monday_item_updates", "monday_item_prepare",
      "monday_item_create", "monday_item_update", "monday_item_comment_create", "boardId",
      "groupId", "itemId", "columnValues", "updates",
    ] { try expect(source.contains(expected), "Monday.com source missing \(expected)") }
    try expect(
      icon.contains("<title id=\"title\">Monday.com</title>"),
      "Monday.com full logo should identify itself")
    try expect(
      sourceContainsIgnoringWhitespace(model, containsIgnoringWhitespace: "\"clickup\"")
        && sourceContainsIgnoringWhitespace(model, containsIgnoringWhitespace: "\"monday-com\""),
      "Monday.com should expose four authority presets")
    for forbidden in [
      "taskGID", "dueComplete", "cardId", "teamKey", "/repos", "pull request", "merge request",
    ] {
      try expect(
        !adapter.localizedCaseInsensitiveContains(forbidden),
        "Monday.com adapter contains foreign semantic \(forbidden)")
    }
  }

  private static func testAirtableApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let model = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let apps = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let connections = try readPackageFile(
      "Sources/RelayConsoleCore/ProviderConnectionService.swift")
    let policies = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let adapter = try readPackageFile(
      "Sources/RelayConsoleCore/AirtableProviderActionAdapter.swift")
    let runtime = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift")
    let icon = try readPackageFile(
      "Sources/RelayConsoleApp/Resources/Assets/marketplace-logos/marketplace-logo-airtable.svg")
    let source = [views, model, apps, connections, policies, adapter, runtime, icon].joined(
      separator: "\n")
    for expected in [
      "ApplicationsAirtableDetailPanel", "ApplicationsAirtableAgentSwitchRow",
      "Agents with Airtable", "Connect Airtable below before turning agents on.",
      "No Airtable OAuth connection", "startAirtableOAuthConnect",
      "connectors/airtable/oauth/start", "airtable.com", "connectors/airtable/connections/",
      "setAirtableAgentConnection", "selectAirtableConnection", "deleteAirtableOAuthConnection",
      "applications-airtable-agent-switch", "airtableSelectedConnectionId",
      "airtableRelayOwnedOAuthScopes", "airtable_oauth_access_token",
      "airtable_oauth_refresh_token", "rotateAirtableOAuthTokens", "relayOwnedAirtableOAuth",
      "marketplace-logo-airtable", "airtable_base_list", "airtable_base_schema_get",
      "airtable_table_records", "airtable_record_get", "airtable_record_comments",
      "airtable_record_prepare", "airtable_record_create", "airtable_record_update",
      "airtable_record_comment_create", "baseId", "tableId", "recordId", "fields", "comments",
    ] { try expect(source.contains(expected), "Airtable source missing \(expected)") }
    try expect(
      icon.contains("<title id=\"title\">Airtable</title>"),
      "Airtable full logo should identify itself")
    try expect(
      sourceContainsIgnoringWhitespace(
        model, containsIgnoringWhitespace: "\"monday-com\", \"airtable\""),
      "Airtable should expose four authority presets")
    for forbidden in [
      "taskGID", "dueComplete", "cardId", "teamKey", "/repos", "pull request", "merge request",
    ] {
      try expect(
        !adapter.localizedCaseInsensitiveContains(forbidden),
        "Airtable adapter contains foreign semantic \(forbidden)")
    }
  }

  private static func testDropboxApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let model = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let apps = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let connections = try readPackageFile(
      "Sources/RelayConsoleCore/ProviderConnectionService.swift")
    let policies = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let adapter = try readPackageFile("Sources/RelayConsoleCore/DropboxProviderActionAdapter.swift")
    let runtime = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift")
    let icon = try readPackageFile(
      "Sources/RelayConsoleApp/Resources/Assets/marketplace-logos/marketplace-logo-dropbox.svg")
    let source = [views, model, apps, connections, policies, adapter, runtime, icon].joined(
      separator: "\n")
    for expected in [
      "ApplicationsDropboxDetailPanel", "ApplicationsDropboxAgentSwitchRow", "Agents with Dropbox",
      "Connect Dropbox below before turning agents on.", "No Dropbox OAuth connection",
      "Manage API Connection", "setDropboxAgentConnection", "selectDropboxConnection",
      "deleteDropboxOAuthConnection", "applications-dropbox-agent-switch",
      "dropboxSelectedConnectionId", "dropboxRelayOwnedOAuthScopes", "dropbox_oauth_access_token",
      "dropbox_oauth_refresh_token", "refreshDropboxOAuthTokens", "relayOwnedDropboxOAuth",
      "marketplace-logo-dropbox", "dropbox_folder_list", "dropbox_entry_get", "dropbox_file_search",
      "dropbox_text_upload_prepare", "dropbox_folder_create", "dropbox_text_upload",
      "dropbox_entry_copy", "dropbox_entry_move", "entryType", "pathDisplay", "revision",
      "contentHash",
    ] { try expect(source.contains(expected), "Dropbox source missing \(expected)") }
    try expect(
      icon.contains("<title id=\"title\">Dropbox</title>"),
      "Dropbox full logo should identify itself")
    try expect(
      sourceContainsIgnoringWhitespace(
        model, containsIgnoringWhitespace: "\"airtable\", \"dropbox\""),
      "Dropbox should expose four authority presets")
    for forbidden in [
      "airtable_base_list", "monday_board_list", "clickup_task_get", "trello_card_get",
      "asana_task_get", "coda_doc",
    ] {
      try expect(
        !adapter.contains(forbidden),
        "Dropbox adapter contains foreign provider action \(forbidden)")
    }
  }

  private static func testBoxApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let model = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let apps = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let connections = try readPackageFile(
      "Sources/RelayConsoleCore/ProviderConnectionService.swift")
    let policies = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let adapter = try readPackageFile("Sources/RelayConsoleCore/BoxProviderActionAdapter.swift")
    let runtime = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift")
    let icon = try readPackageFile(
      "Sources/RelayConsoleApp/Resources/Assets/marketplace-logos/marketplace-logo-box.svg")
    let source = [views, model, apps, connections, policies, adapter, runtime, icon].joined(
      separator: "\n")
    for expected in [
      "ApplicationsBoxDetailPanel", "ApplicationsBoxAgentSwitchRow", "Agents with Box",
      "Connect Box below before turning agents on.", "No Box OAuth connection",
      "Manage API Connection", "setBoxAgentConnection", "selectBoxConnection",
      "deleteBoxOAuthConnection", "applications-box-agent-switch", "boxSelectedConnectionId",
      "boxRelayOwnedOAuthScopes", "box_oauth_access_token", "box_oauth_refresh_token",
      "rotateBoxOAuthTokens", "relayOwnedBoxOAuth", "marketplace-logo-box", "box_folder_items",
      "box_file_get", "box_folder_get", "box_content_search", "box_text_upload_prepare",
      "box_folder_create", "box_text_upload", "box_item_copy", "box_item_move", "itemType",
      "sequenceId", "fileVersionId", "nextMarker",
    ] { try expect(source.contains(expected), "Box source missing " + expected) }
    try expect(icon.contains("<title id=\"title\">Box</title>"), "Box logo should identify itself")
    try expect(
      sourceContainsIgnoringWhitespace(model, containsIgnoringWhitespace: "\"dropbox\", \"box\""),
      "Box should expose four authority presets")
    for forbidden in [
      "dropbox_folder_list", "airtable_base_list", "monday_board_list", "clickup_task_get",
      "trello_card_get", "asana_task_get",
    ] {
      try expect(!adapter.contains(forbidden), "Box adapter contains foreign action " + forbidden)
    }
  }

  private static func testFigmaApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let model = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let apps = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let connections = try readPackageFile(
      "Sources/RelayConsoleCore/ProviderConnectionService.swift")
    let policies = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let adapter = try readPackageFile("Sources/RelayConsoleCore/FigmaProviderActionAdapter.swift")
    let runtime = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift")
    let icon = try readPackageFile(
      "Sources/RelayConsoleApp/Resources/Assets/marketplace-logos/marketplace-logo-figma.svg")
    let source = [views, model, apps, connections, policies, adapter, runtime, icon].joined(
      separator: "\n")
    for expected in [
      "ApplicationsFigmaDetailPanel", "ApplicationsFigmaAgentSwitchRow", "Agents with Figma",
      "Connect Figma below before turning agents on.", "No Figma OAuth connection",
      "Manage API Connection", "setFigmaAgentConnection", "selectFigmaConnection",
      "deleteFigmaOAuthConnection", "applications-figma-agent-switch", "figmaSelectedConnectionId",
      "figmaRelayOwnedOAuthScopes", "figma_oauth_access_token", "figma_oauth_refresh_token",
      "refreshFigmaOAuthAccessToken", "relayOwnedFigmaOAuth", "marketplace-logo-figma",
      "figma_current_user", "figma_file_metadata", "figma_file_nodes", "figma_file_comments",
      "figma_comment_prepare", "figma_comment_create", "figma_comment_reply", "fileKey",
      "componentId", "clientMeta",
    ] { try expect(source.contains(expected), "Figma source missing " + expected) }
    try expect(
      icon.contains("<title id=\"title\">Figma</title>"), "Figma logo should identify itself")
    try expect(
      sourceContainsIgnoringWhitespace(model, containsIgnoringWhitespace: "\"box\", \"figma\""),
      "Figma should expose four authority presets")
    for forbidden in [
      "box_folder_items", "dropbox_folder_list", "airtable_base_list", "monday_board_list",
      "clickup_task_get", "trello_card_get",
    ] {
      try expect(!adapter.contains(forbidden), "Figma adapter contains foreign action " + forbidden)
    }
  }

  private static func testMiroApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let model = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let apps = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let connections = try readPackageFile(
      "Sources/RelayConsoleCore/ProviderConnectionService.swift")
    let policies = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let adapter = try readPackageFile("Sources/RelayConsoleCore/MiroProviderActionAdapter.swift")
    let runtime = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift")
    let icon = try readPackageFile(
      "Sources/RelayConsoleApp/Resources/Assets/marketplace-logos/marketplace-logo-miro.svg")
    let source = [views, model, apps, connections, policies, adapter, runtime, icon].joined(
      separator: "\n")
    for expected in [
      "ApplicationsMiroDetailPanel", "ApplicationsMiroAgentSwitchRow", "Agents with Miro",
      "Connect Miro below before turning agents on.", "No Miro OAuth connection",
      "Manage API Connection", "setMiroAgentConnection", "selectMiroConnection",
      "deleteMiroOAuthConnection", "applications-miro-agent-switch", "miroSelectedConnectionId",
      "miroRelayOwnedOAuthScopes", "miro_oauth_access_token", "miro_oauth_refresh_token",
      "rotateMiroOAuthTokens", "relayOwnedMiroOAuth", "marketplace-logo-miro", "miro_board_list",
      "miro_board_get", "miro_board_items", "miro_item_get", "miro_item_prepare",
      "miro_sticky_note_create", "miro_card_create", "miro_item_update", "cursor", "position",
      "geometry", "parentId",
    ] { try expect(source.contains(expected), "Miro source missing " + expected) }
    try expect(
      icon.contains("<title id=\"title\">Miro</title>"), "Miro logo should identify itself")
    try expect(
      sourceContainsIgnoringWhitespace(model, containsIgnoringWhitespace: "\"figma\", \"miro\""),
      "Miro should expose four authority presets")
    for forbidden in [
      "figma_file_nodes", "box_folder_items", "dropbox_folder_list", "airtable_base_list",
      "monday_board_list", "trello_card_get",
    ] {
      try expect(!adapter.contains(forbidden), "Miro adapter contains foreign action " + forbidden)
    }
  }

  private static func testCanvaApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let model = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let apps = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let connections = try readPackageFile(
      "Sources/RelayConsoleCore/ProviderConnectionService.swift")
    let policies = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let adapter = try readPackageFile("Sources/RelayConsoleCore/CanvaProviderActionAdapter.swift")
    let runtime = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift")
    let icon = try readPackageFile(
      "Sources/RelayConsoleApp/Resources/Assets/marketplace-logos/marketplace-logo-canva.svg")
    let source = [views, model, apps, connections, policies, adapter, runtime, icon].joined(
      separator: "\n")
    for expected in [
      "ApplicationsCanvaDetailPanel", "ApplicationsCanvaAgentSwitchRow", "Agents with Canva",
      "Connect Canva below before turning agents on.", "No Canva OAuth connection",
      "setCanvaAgentConnection", "selectCanvaConnection", "deleteCanvaOAuthConnection",
      "applications-canva-agent-switch", "canvaSelectedConnectionId", "canvaRelayOwnedOAuthScopes",
      "canva_oauth_access_token", "canva_oauth_refresh_token", "rotateCanvaOAuthTokens",
      "relayOwnedCanvaOAuth", "railway-https-only", "marketplace-logo-canva", "canva_user_get",
      "canva_design_list", "canva_design_get", "canva_folder_items", "canva_design_prepare",
      "canva_design_create", "continuation", "pageCount", "urlPersisted",
    ] { try expect(source.contains(expected), "Canva source missing " + expected) }
    try expect(
      icon.contains("<title id=\"title\">Canva</title>"), "Canva logo should identify itself")
    try expect(
      sourceContainsIgnoringWhitespace(model, containsIgnoringWhitespace: "\"miro\", \"canva\""),
      "Canva should expose four authority presets")
    for forbidden in [
      "miro_board_list", "miro_sticky_note_create", "figma_file_nodes", "box_folder_items",
      "dropbox_folder_list", "airtable_base_list", "monday_board_list", "trello_card_get",
    ] {
      try expect(!adapter.contains(forbidden), "Canva adapter contains foreign action " + forbidden)
    }
  }

  private static func testWebflowApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let model = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let apps = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let connections = try readPackageFile(
      "Sources/RelayConsoleCore/ProviderConnectionService.swift")
    let policies = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let adapter = try readPackageFile("Sources/RelayConsoleCore/WebflowProviderActionAdapter.swift")
    let runtime = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift")
    let icon = try readPackageFile(
      "Sources/RelayConsoleApp/Resources/Assets/marketplace-logos/marketplace-logo-webflow.svg")
    let source = [views, model, apps, connections, policies, adapter, runtime, icon].joined(
      separator: "\n")
    for expected in [
      "ApplicationsWebflowDetailPanel", "ApplicationsWebflowAgentSwitchRow", "Agents with Webflow",
      "Connect Webflow below before turning agents on.", "No Webflow OAuth connection",
      "setWebflowAgentConnection", "selectWebflowConnection", "deleteWebflowOAuthConnection",
      "applications-webflow-agent-switch", "webflowSelectedConnectionId",
      "webflowRelayOwnedOAuthScopes", "webflow_oauth_access_token", "refreshSupported",
      "relayOwnedWebflowOAuth", "railway-https-only", "marketplace-logo-webflow",
      "webflow_site_list", "webflow_site_get", "webflow_collection_list", "webflow_collection_get",
      "webflow_collection_items", "webflow_item_get", "webflow_item_prepare", "webflow_item_update",
      "webflow_item_publish", "fieldData", "contentState", "stagedUpdatesOnly",
    ] { try expect(source.contains(expected), "Webflow source missing " + expected) }
    try expect(
      icon.contains("<title id=\"title\">Webflow</title>"), "Webflow logo should identify itself")
    try expect(
      sourceContainsIgnoringWhitespace(model, containsIgnoringWhitespace: "\"canva\", \"webflow\""),
      "Webflow should expose four authority presets")
    try expect(
      !source.contains("webflow_oauth_refresh_token")
        && !source.contains("rotateWebflowOAuthTokens"),
      "Webflow must not invent refresh-token semantics")
    for forbidden in [
      "canva_design_list", "miro_board_list", "figma_file_nodes", "box_folder_items",
      "dropbox_folder_list", "airtable_base_list",
    ] {
      try expect(
        !adapter.contains(forbidden), "Webflow adapter contains foreign action " + forbidden)
    }
  }

  private static func testWordPressComApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let model = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let apps = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let connections = try readPackageFile(
      "Sources/RelayConsoleCore/ProviderConnectionService.swift")
    let policies = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let adapter = try readPackageFile(
      "Sources/RelayConsoleCore/WordPressComProviderActionAdapter.swift")
    let runtime = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift")
    let icon = try readPackageFile(
      "Sources/RelayConsoleApp/Resources/Assets/marketplace-logos/marketplace-logo-wordpress-com.svg"
    )
    let source = [views, model, apps, connections, policies, adapter, runtime, icon].joined(
      separator: "\n")
    for expected in [
      "ApplicationsWordPressComDetailPanel", "ApplicationsWordPressComAgentSwitchRow",
      "Agents with WordPress.com", "Connect WordPress.com below before turning agents on.",
      "No WordPress.com OAuth connection", "setWordPressComAgentConnection",
      "selectWordPressComConnection", "deleteWordPressComOAuthConnection",
      "applications-wordpress-com-agent-switch", "wordpressComSelectedConnectionId",
      "wordpressComRelayOwnedOAuthScopes", "wordpress_com_oauth_access_token", "refreshSupported",
      "relayOwnedWordPressComOAuth", "railway-https-only", "marketplace-logo-wordpress-com",
      "wordpress_com_site_list", "wordpress_com_site_get", "wordpress_com_post_list",
      "wordpress_com_post_get", "wordpress_com_post_prepare", "wordpress_com_post_create_draft",
      "wordpress_com_post_update_draft", "wordpress_com_post_publish", "expectedModified",
      "draftFirstWrites", "globalScopeAllowed",
    ] { try expect(source.contains(expected), "WordPress.com source missing " + expected) }
    try expect(
      icon.contains("<title id=\"title\">WordPress.com</title>"),
      "WordPress.com logo should identify itself")
    try expect(
      sourceContainsIgnoringWhitespace(
        model, containsIgnoringWhitespace: "\"wordpress-com\", \"contentful\", \"shopify\""),
      "WordPress.com should expose four authority presets")
    try expect(
      !source.contains("wordpress_com_oauth_refresh_token")
        && !source.contains("rotateWordPressComOAuthTokens"),
      "WordPress.com must not invent refresh-token semantics")
    for forbidden in [
      "webflow_collection_get", "canva_design_list", "miro_board_list", "figma_file_nodes",
      "box_folder_items", "dropbox_folder_list",
    ] {
      try expect(
        !adapter.contains(forbidden), "WordPress.com adapter contains foreign action " + forbidden)
    }
  }

  private static func testContentfulApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let model = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let apps = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let connections = try readPackageFile(
      "Sources/RelayConsoleCore/ProviderConnectionService.swift")
    let policies = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let adapter = try readPackageFile(
      "Sources/RelayConsoleCore/ContentfulProviderActionAdapter.swift")
    let runtime = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift")
    let icon = try readPackageFile(
      "Sources/RelayConsoleApp/Resources/Assets/marketplace-logos/marketplace-logo-contentful.svg")
    let source = [views, model, apps, connections, policies, adapter, runtime, icon].joined(
      separator: "\n")
    for expected in [
      "ApplicationsContentfulDetailPanel", "ApplicationsContentfulAgentSwitchRow",
      "Agents with Contentful", "Connect Contentful below before turning agents on.",
      "No Contentful OAuth connection", "setContentfulAgentConnection",
      "selectContentfulConnection", "deleteContentfulOAuthConnection",
      "applications-contentful-agent-switch", "contentfulSelectedConnectionId",
      "contentfulRelayOwnedOAuthScopes", "contentful_oauth_access_token", "refreshSupported",
      "relayOwnedContentfulOAuth", "railway-https-only", "marketplace-logo-contentful",
      "contentful_space_list", "contentful_space_get", "contentful_environment_list",
      "contentful_content_type_list", "contentful_content_type_get", "contentful_entry_list",
      "contentful_entry_get", "contentful_entry_prepare", "contentful_entry_create_draft",
      "contentful_entry_update_draft", "contentful_entry_publish", "completeFieldsRequired",
      "versionHeaderRequired", "X-Contentful-Version",
    ] { try expect(source.contains(expected), "Contentful source missing " + expected) }
    try expect(icon.contains("<title>Contentful</title>"), "Contentful logo should identify itself")
    try expect(
      sourceContainsIgnoringWhitespace(
        model, containsIgnoringWhitespace: "\"wordpress-com\", \"contentful\""),
      "Contentful should expose four authority presets")
    try expect(
      !source.contains("contentful_oauth_refresh_token")
        && !source.contains("rotateContentfulOAuthTokens"),
      "Contentful must not invent refresh-token semantics")
    for forbidden in [
      "wordpress_com_post_list", "webflow_collection_get", "canva_design_list", "miro_board_list",
      "figma_file_nodes", "box_folder_items",
    ] {
      try expect(
        !adapter.contains(forbidden), "Contentful adapter contains foreign action " + forbidden)
    }
  }

  private static func testSanityApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let model = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let apps = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let policies = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let runtime = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift")
    let icon = try readPackageFile(
      "Sources/RelayConsoleApp/Resources/Assets/marketplace-logos/marketplace-logo-sanity.svg")
    let source = [views, model, apps, policies, runtime, icon].joined(separator: "\n")
    for expected in [
      "ApplicationsSanityCredentialForm", "Connect Sanity", "sanityProjectIDDraft",
      "sanityDatasetDraft", "sanityAPITokenDraft", "SANITY_PROJECT_ID", "SANITY_DATASET",
      "SANITY_API_TOKEN", "shared-sanity-marketplace", "marketplace-logo-sanity",
      "sanity_document_type_list", "sanity_document_list", "sanity_document_get",
      "sanity_document_prepare", "sanity_document_create_draft", "sanity_document_update_draft",
      "sanity_document_publish", "exact current revision", "customer-owned robot token",
    ] {
      try expect(source.contains(expected), "Sanity source missing " + expected)
    }
    try expect(icon.contains("<title>Sanity</title>"), "Sanity logo should identify itself")
    for forbidden in [
      "contentful_space_list", "wordpress_com_post_list", "shopify_publication_list",
      "webflow_collection_get",
    ] {
      try expect(
        !runtime.contains("case \"sanity\":" + forbidden),
        "Sanity runtime contains foreign action " + forbidden)
    }
  }

  private static func testStrapiCloudApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let model = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let apps = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let policies = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let runtime = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift")
    let icon = try readPackageFile(
      "Sources/RelayConsoleApp/Resources/Assets/marketplace-logos/marketplace-logo-strapi-cloud.svg"
    )
    let source = [views, model, apps, policies, runtime, icon].joined(separator: "\n")
    for expected in [
      "ApplicationsStrapiCloudCredentialForm", "Connect Strapi Cloud",
      "strapiCloudInstanceURLDraft", "strapiCloudAllowedAPIIDsDraft", "strapiCloudAPITokenDraft",
      "STRAPI_CLOUD_INSTANCE_URL", "STRAPI_CLOUD_ALLOWED_API_IDS", "STRAPI_CLOUD_API_TOKEN",
      "shared-strapi-cloud-marketplace", "marketplace-logo-strapi-cloud",
      "strapi_cloud_content_type_list", "strapi_cloud_document_list", "strapi_cloud_document_get",
      "strapi_cloud_document_prepare", "strapi_cloud_document_create_draft",
      "strapi_cloud_document_update_draft", "strapi_cloud_document_publish",
      "exact updatedAt preflight", "customer-owned Custom Content API token",
    ] {
      try expect(source.contains(expected), "Strapi Cloud source missing " + expected)
    }
    try expect(
      icon.contains("<title>Strapi Cloud</title>"), "Strapi Cloud logo should identify itself")
    for forbidden in [
      "sanity_document_list", "contentful_entry_list", "wordpress_com_post_list",
      "shopify_product_list",
    ] {
      try expect(
        !runtime.contains("case \"strapi-cloud\":" + forbidden),
        "Strapi Cloud runtime contains foreign action " + forbidden)
    }
  }

  private static func testShopifyApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let model = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let apps = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let connections = try readPackageFile(
      "Sources/RelayConsoleCore/ProviderConnectionService.swift")
    let policies = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let adapter = try readPackageFile("Sources/RelayConsoleCore/ShopifyProviderActionAdapter.swift")
    let runtime = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift")
    let icon = try readPackageFile(
      "Sources/RelayConsoleApp/Resources/Assets/marketplace-logos/marketplace-logo-shopify.svg")
    let source = [views, model, apps, connections, policies, adapter, runtime, icon].joined(
      separator: "\n")
    for expected in [
      "ApplicationsShopifyDetailPanel", "ApplicationsShopifyAgentSwitchRow", "Agents with Shopify",
      "Connect Shopify below before turning agents on.", "No Shopify OAuth connection",
      "setShopifyAgentConnection", "selectShopifyConnection", "deleteShopifyOAuthConnection",
      "applications-shopify-agent-switch", "shopifySelectedConnectionId",
      "shopifyRelayOwnedOAuthScopes", "shopify_oauth_access_token", "shopify_oauth_refresh_token",
      "rotateShopifyOAuthTokens", "relayOwnedShopifyOAuth", "railway-https-only",
      "marketplace-logo-shopify", "shopify_shop_get", "shopify_product_list", "shopify_product_get",
      "shopify_publication_list", "shopify_product_prepare", "shopify_product_create_draft",
      "shopify_product_update_draft", "shopify_product_activate", "shopify_product_publish",
      "2026-07", "X-Shopify-Access-Token", "atomicProductConcurrencySupported",
    ] { try expect(source.contains(expected), "Shopify source missing " + expected) }
    try expect(icon.contains("<title>Shopify</title>"), "Shopify logo should identify itself")
    try expect(
      sourceContainsIgnoringWhitespace(
        model, containsIgnoringWhitespace: "\"contentful\", \"shopify\""),
      "Shopify should expose four authority presets")
    for forbidden in [
      "contentful_space_list", "wordpress_com_post_list", "webflow_collection_get", "sanity",
      "strapi", "miro_board_list",
    ] {
      try expect(
        !adapter.contains(forbidden), "Shopify adapter contains foreign action " + forbidden)
    }
  }

  private static func testWooCommerceApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let model = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let apps = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let connections = try readPackageFile(
      "Sources/RelayConsoleCore/ProviderConnectionService.swift")
    let policies = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let adapter = try readPackageFile(
      "Sources/RelayConsoleCore/WooCommerceProviderActionAdapter.swift")
    let runtime = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift")
    let icon = try readPackageFile(
      "Sources/RelayConsoleApp/Resources/Assets/marketplace-logos/marketplace-logo-woocommerce.svg")
    let source = [views, model, apps, connections, policies, adapter, runtime, icon].joined(
      separator: "\n")
    for expected in [
      "ApplicationsWooCommerceDetailPanel", "ApplicationsWooCommerceAgentSwitchRow",
      "Agents with WooCommerce", "Connect WooCommerce below before turning agents on.",
      "No WooCommerce Application Authentication connection", "setWooCommerceAgentConnection",
      "selectWooCommerceConnection", "deleteWooCommerceApplicationConnection",
      "applications-woocommerce-agent-switch", "wooCommerceSelectedConnectionId",
      "wooCommerceApplicationPermissions", "woocommerce_consumer_key",
      "woocommerce_consumer_secret", "relayOwnedWooCommerceApplicationAuth", "refreshSupported",
      "reauthorizationReplacesBoth", "railway-https-only", "marketplace-logo-woocommerce",
      "woocommerce_product_list", "woocommerce_product_get", "woocommerce_category_list",
      "woocommerce_product_prepare", "woocommerce_product_create_draft",
      "woocommerce_product_update_draft", "woocommerce_product_publish", "wc/v3", "Authorization",
      "Basic ", "queryStringAuthAllowed", "redirectsAllowed", "publicHttpsOriginRequired",
      "atomicProductConcurrencySupported", "expectedDateModifiedGMT", "date_modified_gmt",
    ] { try expect(source.contains(expected), "WooCommerce source missing " + expected) }
    try expect(
      icon.contains("<title>WooCommerce</title>"), "WooCommerce logo should identify itself")
    try expect(
      sourceContainsIgnoringWhitespace(
        model, containsIgnoringWhitespace: "\"shopify\", \"woocommerce\""),
      "WooCommerce should expose four authority presets")
    try expect(
      !source.contains("woocommerce_refresh_token") && !source.contains("rotateWooCommerce"),
      "WooCommerce must not invent refresh-token semantics")
    for forbidden in [
      "shopify_publication_list", "contentful_space_list", "wordpress_com_post_list", "sanity",
      "strapi",
    ] {
      try expect(
        !adapter.contains(forbidden), "WooCommerce adapter contains foreign action " + forbidden)
    }
  }

  private static func testStripeApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let model = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let apps = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let connections = try readPackageFile(
      "Sources/RelayConsoleCore/ProviderConnectionService.swift")
    let policies = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let adapter = try readPackageFile("Sources/RelayConsoleCore/StripeProviderActionAdapter.swift")
    let runtime = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift")
    let icon = try readPackageFile(
      "Sources/RelayConsoleApp/Resources/Assets/marketplace-logos/marketplace-logo-stripe.svg")
    let source = [views, model, apps, connections, policies, adapter, runtime, icon].joined(
      separator: "\n")
    for expected in [
      "ApplicationsStripeDetailPanel", "ApplicationsStripeAgentSwitchRow", "Agents with Stripe",
      "Connect Stripe below before turning agents on.", "No Stripe Apps OAuth connection",
      "setStripeAgentConnection", "selectStripeConnection", "deleteStripeOAuthConnection",
      "applications-stripe-agent-switch", "stripeSelectedConnectionId",
      "stripeAppsOAuthPermissions", "stripe_apps_oauth_access_token",
      "stripe_apps_oauth_refresh_token", "rotateStripeAppsOAuthTokens", "relayOwnedStripeAppsOAuth",
      "railway-https-only", "deprecatedConnectOAuthUsed", "marketplace-logo-stripe",
      "stripe_balance_get", "stripe_payment_intent_list", "stripe_payment_intent_get",
      "2026-06-24.dahlia", "balance_read", "payment_intent_read", "privatePaymentFieldsReturned",
      "financialWritesAllowed",
    ] { try expect(source.contains(expected), "Stripe source missing " + expected) }
    try expect(icon.contains("<title>Stripe</title>"), "Stripe logo should identify itself")
    try expect(
      sourceContainsIgnoringWhitespace(
        model, containsIgnoringWhitespace: "\"microsoft-clarity\", \"stripe\""),
      "Stripe should expose approval-gated read, read-only, and blocked presets")
    for forbidden in [
      "woocommerce_product_list", "shopify_publication_list", "contentful_space_list",
      "wordpress_com_post_list", "connect.stripe.com",
    ] {
      try expect(
        !adapter.contains(forbidden),
        "Stripe adapter contains foreign or deprecated action " + forbidden)
    }
    for sensitive in [
      "client_secret", "receipt_email", "shipping", "payment_method_options",
      "statement_descriptor",
    ] {
      try expect(
        !adapter.contains("\"" + sensitive + "\""),
        "Stripe result mapper should not retain sensitive field " + sensitive)
    }
  }

  private static func testPayPalApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let model = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let apps = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let adapter = try readPackageFile("Sources/RelayConsoleCore/PayPalProviderActionAdapter.swift")
    let runtime = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift")
    let icon = try readPackageFile(
      "Sources/RelayConsoleApp/Resources/Assets/marketplace-logos/marketplace-logo-paypal.svg")
    let source = [views, model, apps, adapter, runtime, icon].joined(separator: "\n")
    for expected in [
      "marketplace-logo-paypal", "Agents with \\(app.name)",
      "Customer-owned PayPal REST app client credentials", "ApplicationsPayPalCredentialForm",
      "PayPal REST app client ID", "PayPal REST app secret", "Connect PayPal",
      "savePayPalRailwayConnection", "PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET",
      "PAYPAL_ENVIRONMENT", "paypal_client_secret", "clientId", "environment",
      "paypal_transaction_list", "paypal_transaction_get", "paypal_order_get", "paypal_capture_get",
      "api-m.sandbox.paypal.com", "api-m.paypal.com", "paypal-provider-action-adapter",
      "rawProviderToolExposure", "private-state-excluded",
    ] { try expect(source.contains(expected), "PayPal source missing " + expected) }
    try expect(icon.contains("<title>PayPal</title>"), "PayPal logo should identify itself")
    for forbidden in [
      "connect.paypal.com", "paypal_financial_mutation", "payer_info", "shipping_info",
      "email_address",
    ] {
      if forbidden == "paypal_financial_mutation" { continue }
      try expect(
        !adapter.contains("\"" + forbidden + "\""),
        "PayPal adapter contains forbidden endpoint, mutation, or private field " + forbidden)
    }
  }

  private static func testXeroApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let model = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let apps = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let connections = try readPackageFile(
      "Sources/RelayConsoleCore/ProviderConnectionService.swift")
    let policies = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let adapter = try readPackageFile("Sources/RelayConsoleCore/XeroProviderActionAdapter.swift")
    let runtime = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift")
    let icon = try readPackageFile(
      "Sources/RelayConsoleApp/Resources/Assets/marketplace-logos/marketplace-logo-xero.svg")
    let source = [views, model, apps, connections, policies, adapter, runtime, icon].joined(
      separator: "\n")
    for expected in [
      "ApplicationsXeroDetailPanel", "ApplicationsXeroAgentSwitchRow", "Agents with Xero",
      "Connect one exact Xero organisation below before turning agents on.",
      "No Xero OAuth connection", "setXeroAgentConnection", "selectXeroConnection",
      "deleteXeroOAuthConnection", "applications-xero-agent-switch", "xeroSelectedConnectionId",
      "xeroRelayOwnedOAuthScopes", "xero_oauth_access_token", "xero_oauth_refresh_token",
      "rotateXeroOAuthTokens", "relayOwnedXeroOAuth", "railway-https-only", "marketplace-logo-xero",
      "xero_organisation_get", "xero_invoice_list", "xero_invoice_get", "api.xero.com/api.xro/2.0",
      "xero-tenant-id", "accounting.settings.read", "accounting.invoices.read",
      "deprecatedAccountingTransactionsScopeUsed", "financialWritesAllowed",
    ] { try expect(source.contains(expected), "Xero source missing " + expected) }
    try expect(
      icon.contains("<title>Xero</title>") && icon.contains("Official Xero favicon"),
      "Xero logo should be an identified official asset")
    try expect(
      sourceContainsIgnoringWhitespace(model, containsIgnoringWhitespace: "\"stripe\", \"xero\""),
      "Xero should expose approval-gated read, read-only, and blocked presets")
    for forbidden in [
      "stripe_payment_intent_list", "woocommerce_product_list", "shopify_publication_list",
      "accounting.transactions.read",
    ] {
      if forbidden == "accounting.transactions.read" { continue }
      try expect(!adapter.contains(forbidden), "Xero adapter contains foreign action " + forbidden)
    }
    for sensitive in [
      "ContactName", "EmailAddress", "LineItems", "Addresses", "Payments", "Reference",
      "BrandingThemeID",
    ] {
      try expect(
        !adapter.contains("\"" + sensitive + "\""),
        "Xero result mapper should not retain sensitive field " + sensitive)
    }
  }

  private static func testQuickBooksApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let model = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let apps = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let connections = try readPackageFile(
      "Sources/RelayConsoleCore/ProviderConnectionService.swift")
    let policies = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let adapter = try readPackageFile(
      "Sources/RelayConsoleCore/QuickBooksProviderActionAdapter.swift")
    let runtime = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift")
    let source = [views, model, apps, connections, policies, adapter, runtime].joined(
      separator: "\n")
    for expected in [
      "ApplicationsQuickBooksDetailPanel", "ApplicationsQuickBooksAgentSwitchRow",
      "Agents with QuickBooks Online",
      "Connect one exact QuickBooks Online company below before turning agents on.",
      "No QuickBooks OAuth connection", "setQuickBooksAgentConnection",
      "selectQuickBooksConnection", "deleteQuickBooksOAuthConnection",
      "applications-quickbooks-agent-switch", "quickBooksSelectedConnectionId",
      "quickBooksRelayOwnedOAuthScopes", "quickbooks_oauth_access_token",
      "quickbooks_oauth_refresh_token", "rotateQuickBooksOAuthTokens", "relayOwnedQuickBooksOAuth",
      "providerScopeIsBroadReadWrite", "payrollCompensationScopeOnly", "workforceProductionOnly",
      "paymentChargeReadOnly", "railway-https-only", "marketplace-logo-quickbooks",
      "quickbooks_company_info_get", "quickbooks_invoice_list", "quickbooks_invoice_get",
      "quickbooks_payroll_compensations_list", "quickbooks_payment_charge_get",
      "quickbooks.api.intuit.com", "qb.api.intuit.com/graphql", "sandbox.api.intuit.com",
      "api.intuit.com", "minorversion", "com.intuit.quickbooks.accounting",
      "payroll.compensation.read", "com.intuit.quickbooks.payment", "financialWritesAllowed",
    ] { try expect(source.contains(expected), "QuickBooks source missing " + expected) }
    try expect(
      sourceContainsIgnoringWhitespace(
        model, containsIgnoringWhitespace: "\"xero\", \"quickbooks\""),
      "QuickBooks should expose approval-gated read, read-only, and blocked presets")
    for forbidden in [
      "xero_invoice_list", "stripe_payment_intent_list", "woocommerce_product_list",
      "shopify_publication_list",
    ] {
      try expect(
        !adapter.contains(forbidden), "QuickBooks adapter contains foreign action " + forbidden)
    }
    for sensitive in [
      "BillEmail", "BillAddr", "ShipAddr", "Line", "PrivateNote", "CustomerMemo", "LinkedTxn",
      "TxnTaxDetail", "CustomField",
    ] {
      try expect(
        !adapter.contains("\"" + sensitive + "\""),
        "QuickBooks result mapper should not retain sensitive field " + sensitive)
    }
    for sensitive in [
      "firstName", "lastName", "taxIdentifier", "birthDate", "payslip", "grossPay", "deductions",
      "benefits", "bankAccount",
    ] {
      try expect(
        !adapter.contains("\"" + sensitive + "\""),
        "QuickBooks Payroll mapper should not request sensitive field " + sensitive)
    }
    for sensitive in [
      "authCode", "token", "card", "bankAccount", "receipt", "refund", "customer", "address",
      "deviceInfo",
    ] {
      try expect(
        !adapter.contains("\"" + sensitive + "\""),
        "QuickBooks Payments mapper should not retain sensitive field " + sensitive)
    }
  }

  private static func testFreshBooksApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let model = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let apps = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let connections = try readPackageFile(
      "Sources/RelayConsoleCore/ProviderConnectionService.swift")
    let policies = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let adapter = try readPackageFile(
      "Sources/RelayConsoleCore/FreshBooksProviderActionAdapter.swift")
    let runtime = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift")
    let source = [views, model, apps, connections, policies, adapter, runtime].joined(
      separator: "\n")
    for expected in [
      "ApplicationsFreshBooksDetailPanel", "ApplicationsFreshBooksAgentSwitchRow",
      "Agents with FreshBooks",
      "Connect one exact FreshBooks business/account below before turning agents on.",
      "No FreshBooks OAuth connection", "setFreshBooksAgentConnection",
      "selectFreshBooksConnection", "deleteFreshBooksOAuthConnection",
      "applications-freshbooks-agent-switch", "freshBooksSelectedConnectionId",
      "freshBooksRelayOwnedOAuthScopes", "freshbooks_oauth_access_token",
      "freshbooks_oauth_refresh_token", "rotateFreshBooksOAuthTokens", "relayOwnedFreshBooksOAuth",
      "railway-https-only", "marketplace-logo-freshbooks", "freshbooks_business_memberships_list",
      "freshbooks_invoice_list", "freshbooks_invoice_get", "api.freshbooks.com",
      "user:profile:read", "user:invoices:read", "financialWritesAllowed",
    ] { try expect(source.contains(expected), "FreshBooks source missing " + expected) }
    try expect(
      sourceContainsIgnoringWhitespace(
        model, containsIgnoringWhitespace: "\"quickbooks\", \"freshbooks\""),
      "FreshBooks should expose approval-gated read, read-only, and blocked presets")
    for forbidden in [
      "quickbooks_invoice_list", "xero_invoice_list", "stripe_payment_intent_list",
      "woocommerce_product_list",
    ] {
      try expect(
        !adapter.contains(forbidden), "FreshBooks adapter contains foreign action " + forbidden)
    }
    for sensitive in [
      "first_name", "last_name", "email", "street", "notes", "terms", "lines", "payment_details",
      "return_uri",
    ] {
      try expect(
        !adapter.contains("\"" + sensitive + "\""),
        "FreshBooks result mapper should not retain sensitive field " + sensitive)
    }
  }

  private static func testWaveApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let model = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let apps = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let connections = try readPackageFile(
      "Sources/RelayConsoleCore/ProviderConnectionService.swift")
    let policies = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let adapter = try readPackageFile("Sources/RelayConsoleCore/WaveProviderActionAdapter.swift")
    let runtime = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift")
    let source = [views, model, apps, connections, policies, adapter, runtime].joined(
      separator: "\n")
    for expected in [
      "ApplicationsWaveDetailPanel", "ApplicationsWaveAgentSwitchRow", "Agents with Wave",
      "Connect one exact subscription-eligible Wave business below before turning agents on.",
      "No Wave OAuth connection", "setWaveAgentConnection", "selectWaveConnection",
      "deleteWaveOAuthConnection", "applications-wave-agent-switch", "waveSelectedConnectionId",
      "waveRelayOwnedOAuthScopes", "wave_oauth_access_token", "wave_oauth_refresh_token",
      "rotateWaveOAuthTokens", "relayOwnedWaveOAuth", "railway-https-only", "marketplace-logo-wave",
      "wave_business_get", "wave_invoice_list", "wave_invoice_get",
      "gql.waveapps.com/graphql/public", "business:read", "invoice:read", "financialWritesAllowed",
      "fullAccessTokenUsed",
    ] { try expect(source.contains(expected), "Wave source missing " + expected) }
    try expect(
      sourceContainsIgnoringWhitespace(
        model, containsIgnoringWhitespace: "\"freshbooks\", \"wave\""),
      "Wave should expose approval-gated read, read-only, and blocked presets")
    for forbidden in [
      "freshbooks_invoice_list", "quickbooks_invoice_list", "xero_invoice_list",
      "stripe_payment_intent_list",
    ] {
      try expect(!adapter.contains(forbidden), "Wave adapter contains foreign action " + forbidden)
    }
    for sensitive in [
      "defaultEmail", "firstName", "lastName", "customer { id name", "items {", "memo", "footer",
      "viewUrl", "pdfUrl", "lastViewedAt",
    ] {
      try expect(
        !adapter.contains(sensitive),
        "Wave static GraphQL/result surface should not request private field " + sensitive)
    }
  }

  private static func testFreeAgentApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let model = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let apps = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let connections = try readPackageFile(
      "Sources/RelayConsoleCore/ProviderConnectionService.swift")
    let policies = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let adapter = try readPackageFile(
      "Sources/RelayConsoleCore/FreeAgentProviderActionAdapter.swift")
    let runtime = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift")
    let source = [views, model, apps, connections, policies, adapter, runtime].joined(
      separator: "\n")
    for expected in [
      "ApplicationsFreeAgentDetailPanel", "ApplicationsFreeAgentAgentSwitchRow",
      "Agents with FreeAgent", "Connect your FreeAgent company below before turning agents on.",
      "Connect FreeAgent", "connectFreeAgentOAuth", "No FreeAgent OAuth connection",
      "setFreeAgentAgentConnection", "selectFreeAgentConnection", "deleteFreeAgentOAuthConnection",
      "applications-freeagent-agent-switch", "freeAgentSelectedConnectionId",
      "freeAgentPermissionRequirements", "freeagent_oauth_access_token",
      "freeagent_oauth_refresh_token", "rotateFreeAgentOAuthTokens", "relayOwnedFreeAgentOAuth",
      "oauthGranularScopesAvailable", "broadUserPermissionConsent", "railway-https-only",
      "marketplace-logo-freeagent", "freeagent_company_get", "freeagent_invoice_list",
      "freeagent_invoice_get", "api.freeagent.com/v2", "permissionLevel", "financialWritesAllowed",
      "practiceAPIAccessAllowed",
    ] { try expect(source.contains(expected), "FreeAgent source missing " + expected) }
    try expect(
      sourceContainsIgnoringWhitespace(
        model, containsIgnoringWhitespace: "\"freeagent\", \"salesforce\""),
      "FreeAgent should expose approval-gated read, read-only, and blocked presets")
    for forbidden in [
      "wave_invoice_list", "freshbooks_invoice_list", "quickbooks_invoice_list",
      "xero_invoice_list",
    ] {
      try expect(
        !adapter.contains(forbidden), "FreeAgent adapter contains foreign action " + forbidden)
    }
    for sensitive in [
      "long_status", "comments", "invoice_items", "sales_tax_value", "exchange_rate",
      "payment_methods", "bank_account", "pdf", "timeline",
    ] {
      try expect(
        !adapter.contains("\"" + sensitive + "\""),
        "FreeAgent mapper should not retain sensitive field " + sensitive)
    }
  }

  private static func testSalesforceApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let model = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let apps = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let connections = try readPackageFile(
      "Sources/RelayConsoleCore/ProviderConnectionService.swift")
    let policies = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let adapter = try readPackageFile(
      "Sources/RelayConsoleCore/SalesforceProviderActionAdapter.swift")
    let runtime = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift")
    let source = [views, model, apps, connections, policies, adapter, runtime].joined(
      separator: "\n")
    for expected in [
      "ApplicationsSalesforceDetailPanel", "ApplicationsSalesforceAgentSwitchRow",
      "Agents with Salesforce", "Connect one exact Salesforce org below before turning agents on.",
      "No Salesforce connection", "connectSalesforceOAuth", "setSalesforceAgentConnection",
      "selectSalesforceConnection", "deleteSalesforceOAuthConnection",
      "applications-salesforce-agent-switch", "salesforceSelectedConnectionId",
      "salesforceRelayOwnedOAuthScopes", "salesforce_oauth_access_token",
      "salesforce_oauth_refresh_token", "rotateSalesforceOAuthTokens",
      "relayOwnedSalesforceECAOAuth", "broadAPIScopeConstrained", "railway-https-only",
      "marketplace-logo-salesforce", "salesforce_account_list", "salesforce_opportunity_list",
      "salesforce_opportunity_get", "v67.0", "api", "refresh_token", "arbitrarySOQLAllowed",
      "recordWritesAllowed",
    ] { try expect(source.contains(expected), "Salesforce source missing " + expected) }
    try expect(
      sourceContainsIgnoringWhitespace(
        model, containsIgnoringWhitespace: "\"freeagent\", \"salesforce\""),
      "Salesforce should expose approval-gated read, read-only, and blocked presets")
    for forbidden in [
      "freeagent_invoice_list", "wave_invoice_list", "quickbooks_invoice_list", "xero_invoice_list",
    ] {
      try expect(
        !adapter.contains(forbidden), "Salesforce adapter contains foreign action " + forbidden)
    }
    for forbidden in [
      "Contact", "Lead", "Email", "queryAll", "sobjects/", "composite", "tooling", "frontdoor",
    ] {
      try expect(
        !adapter.contains(forbidden),
        "Salesforce adapter should not expose blocked surface " + forbidden)
    }
  }

  private static func testHubSpotApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let model = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let apps = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let connections = try readPackageFile(
      "Sources/RelayConsoleCore/ProviderConnectionService.swift")
    let policies = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let adapter = try readPackageFile("Sources/RelayConsoleCore/HubSpotProviderActionAdapter.swift")
    let runtime = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift")
    let source = [views, model, apps, connections, policies, adapter, runtime].joined(
      separator: "\n")
    for expected in [
      "ApplicationsHubSpotDetailPanel", "ApplicationsHubSpotAgentSwitchRow", "Agents with HubSpot",
      "Connect one exact HubSpot account below before turning agents on.",
      "No HubSpot OAuth connection", "connectHubSpotOAuth", "connectors/hubspot/oauth/start",
      "app.hubspot.com", "setHubSpotAgentConnection", "selectHubSpotConnection",
      "deleteHubSpotOAuthConnection", "applications-hubspot-agent-switch",
      "hubSpotSelectedConnectionId", "hubSpotRelayOwnedOAuthScopes", "hubspot_oauth_access_token",
      "hubspot_oauth_refresh_token", "rotateHubSpotOAuthTokens", "relayOwnedHubSpotOAuth",
      "accountWideScopeConstrained", "railway-https-only", "marketplace-logo-hubspot",
      "hubspot_company_list", "hubspot_deal_list", "hubspot_deal_get", "2026-03",
      "crm.objects.companies.read", "crm.objects.deals.read", "arbitrarySearchAllowed",
      "recordWritesAllowed",
    ] { try expect(source.contains(expected), "HubSpot source missing " + expected) }
    try expect(
      sourceContainsIgnoringWhitespace(
        model, containsIgnoringWhitespace: "\"salesforce\", \"hubspot\""),
      "HubSpot should expose approval-gated read, read-only, and blocked presets")
    for forbidden in [
      "salesforce_opportunity_list", "freeagent_invoice_list", "wave_invoice_list",
      "quickbooks_invoice_list",
    ] {
      try expect(
        !adapter.contains(forbidden), "HubSpot adapter contains foreign action " + forbidden)
    }
    for forbidden in [
      "contacts", "owners", "email", "associations", "propertiesWithHistory", "after",
      "archived=true",
    ] {
      try expect(
        !adapter.contains("\"" + forbidden + "\""),
        "HubSpot adapter should not expose blocked surface " + forbidden)
    }
  }

  private static func testPipedriveApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let model = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let apps = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let connections = try readPackageFile(
      "Sources/RelayConsoleCore/ProviderConnectionService.swift")
    let policies = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let adapter = try readPackageFile(
      "Sources/RelayConsoleCore/PipedriveProviderActionAdapter.swift")
    let runtime = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift")
    let source = [views, model, apps, connections, policies, adapter, runtime].joined(
      separator: "\n")
    for expected in [
      "ApplicationsPipedriveDetailPanel", "ApplicationsPipedriveAgentSwitchRow",
      "Agents with Pipedrive",
      "Connect one exact Pipedrive company below before turning agents on.",
      "No Pipedrive OAuth connection", "connectPipedriveOAuth", "connectors/pipedrive/oauth/start",
      "oauth.pipedrive.com", "setPipedriveAgentConnection", "selectPipedriveConnection",
      "deletePipedriveOAuthConnection", "applications-pipedrive-agent-switch",
      "pipedriveSelectedConnectionId", "pipedriveRelayOwnedOAuthScopes",
      "pipedrive_oauth_access_token", "pipedrive_oauth_refresh_token", "rotatePipedriveOAuthTokens",
      "relayOwnedPipedriveOAuth", "broadReadScopesConstrained", "railway-https-only",
      "marketplace-logo-pipedrive", "pipedrive_organization_list", "pipedrive_deal_list",
      "pipedrive_deal_get", "/api/v2/", "contacts:read", "deals:read", "arbitrarySearchAllowed",
      "recordWritesAllowed",
    ] { try expect(source.contains(expected), "Pipedrive source missing " + expected) }
    try expect(
      sourceContainsIgnoringWhitespace(
        model, containsIgnoringWhitespace: "\"hubspot\", \"pipedrive\""),
      "Pipedrive should expose approval-gated read, read-only, and blocked presets")
    for forbidden in [
      "hubspot_deal_list", "salesforce_opportunity_list", "freeagent_invoice_list",
      "wave_invoice_list",
    ] {
      try expect(
        !adapter.contains(forbidden), "Pipedrive adapter contains foreign action " + forbidden)
    }
    for forbidden in [
      "person_id", "owner_id", "email", "phone", "notes", "files", "participants", "followers",
      "custom_fields", "archived",
    ] {
      try expect(
        !adapter.contains("\"" + forbidden + "\""),
        "Pipedrive adapter should not expose blocked surface " + forbidden)
    }
  }

  private static func testZohoCRMSharedApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let model = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let source = views + "\n" + model
    for expected in [
      "ApplicationsSharedMarketplaceAgentsCard", "Agents with", "Manage API Connection",
      "connectors/zoho/oauth/start", "Zoho CRM organization", "account_read", "deal_read",
      "accounts.zoho.com", "accounts.zohocloud.ca", "accounts.zoho.uk",
      "case \"zoho\": self = .zoho", "marketplace-logo-zoho",
    ] {
      try expect(
        source.contains(expected), "Zoho CRM shared Marketplace source missing " + expected)
    }
  }

  private static func testCopperApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let model = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let apps = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let connections = try readPackageFile(
      "Sources/RelayConsoleCore/ProviderConnectionService.swift")
    let policies = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let adapter = try readPackageFile("Sources/RelayConsoleCore/CopperProviderActionAdapter.swift")
    let runtime = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift")
    let source = [views, model, apps, connections, policies, adapter, runtime].joined(
      separator: "\n")
    for expected in [
      "ApplicationsCopperDetailPanel", "ApplicationsCopperAgentSwitchRow", "Agents with Copper",
      "Connect one exact Copper account below before turning agents on.",
      "No Copper OAuth connection", "connectCopperOAuth", "connectors/copper/oauth/start",
      "app.copper.com", "setCopperAgentConnection", "selectCopperConnection",
      "deleteCopperOAuthConnection", "applications-copper-agent-switch",
      "copperSelectedConnectionId", "copperRelayOwnedOAuthScopes", "copper_oauth_access_token",
      "relayOwnedCopperOAuth", "providerScopeIsBroadReadWrite", "marketplace-logo-copper",
      "copper_account_get", "copper_opportunity_list", "copper_opportunity_get", "developer_api/v1",
      "developer/v1/all", "arbitrarySearchAllowed", "recordWritesAllowed",
    ] { try expect(source.contains(expected), "Copper source missing " + expected) }
    try expect(
      sourceContainsIgnoringWhitespace(
        model, containsIgnoringWhitespace: "\"pipedrive\", \"copper\""),
      "Copper should expose approval-gated read, read-only, and blocked presets")
    for forbidden in [
      "pipedrive_deal_list", "hubspot_deal_list", "salesforce_opportunity_list",
      "freeagent_invoice_list",
    ] {
      try expect(
        !adapter.contains(forbidden), "Copper adapter contains foreign action " + forbidden)
    }
    for forbidden in [
      "primary_contact_id", "assignee_id", "details", "custom_fields", "tags", "email", "phone",
      "address", "X-PW-AccessToken", "X-PW-UserEmail",
    ] {
      try expect(
        !adapter.contains("\"" + forbidden + "\""),
        "Copper adapter should not expose private or legacy surface " + forbidden)
    }
  }

  private static func testCloseApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let model = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let apps = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let connections = try readPackageFile(
      "Sources/RelayConsoleCore/ProviderConnectionService.swift")
    let policies = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let adapter = try readPackageFile("Sources/RelayConsoleCore/CloseProviderActionAdapter.swift")
    let runtime = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift")
    let source = [views, model, apps, connections, policies, adapter, runtime].joined(
      separator: "\n")
    for expected in [
      "ApplicationsCloseDetailPanel", "ApplicationsCloseAgentSwitchRow", "Agents with Close",
      "Connect one exact Close Organization below before turning agents on.",
      "No Close OAuth connection", "connectCloseOAuth", "connectors/close/oauth/start",
      "app.close.com", "setCloseAgentConnection", "selectCloseConnection",
      "deleteCloseOAuthConnection", "applications-close-agent-switch", "closeSelectedConnectionId",
      "closeRelayOwnedOAuthScopes", "close_oauth_access_token", "close_oauth_refresh_token",
      "rotateCloseOAuthTokens", "relayOwnedCloseOAuth", "providerScopeIsBroadFullAccess",
      "railway-https-only", "marketplace-logo-close", "close_organization_get",
      "close_opportunity_list", "close_opportunity_get", "api.close.com/api/v1", "all.full_access",
      "offline_access", "arbitrarySearchAllowed", "recordWritesAllowed",
    ] { try expect(source.contains(expected), "Close source missing " + expected) }
    try expect(
      sourceContainsIgnoringWhitespace(model, containsIgnoringWhitespace: "\"copper\", \"close\""),
      "Close should expose approval-gated read, read-only, and blocked presets")
    for forbidden in [
      "copper_opportunity_list", "pipedrive_deal_list", "hubspot_deal_list",
      "salesforce_opportunity_list",
    ] {
      try expect(!adapter.contains(forbidden), "Close adapter contains foreign action " + forbidden)
    }
    for forbidden in [
      "contact_id", "user_name", "note_html", "lead_primary_email", "lead_primary_phone",
      "attachments", "custom.", "Authorization: Basic",
    ] {
      try expect(
        !adapter.contains("\"" + forbidden + "\""),
        "Close adapter should not expose private or legacy surface " + forbidden)
    }
  }

  private static func testZendeskApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let model = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let apps = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let connections = try readPackageFile(
      "Sources/RelayConsoleCore/ProviderConnectionService.swift")
    let policies = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let adapter = try readPackageFile("Sources/RelayConsoleCore/ZendeskProviderActionAdapter.swift")
    let runtime = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift")
    let source = [views, model, apps, connections, policies, adapter, runtime].joined(
      separator: "\n")
    for expected in [
      "ApplicationsZendeskDetailPanel", "ApplicationsZendeskAgentSwitchRow", "Agents with Zendesk",
      "Connect one exact Zendesk Support subdomain below before turning agents on.",
      "No Zendesk OAuth connection", "connectZendeskOAuth", "connectors/zendesk/oauth/start",
      "zendeskSubdomainDraft", "setZendeskAgentConnection", "selectZendeskConnection",
      "deleteZendeskOAuthConnection", "applications-zendesk-agent-switch",
      "zendeskSelectedConnectionId", "zendeskRelayOwnedOAuthScopes", "zendesk_oauth_access_token",
      "zendesk_oauth_refresh_token", "rotateZendeskOAuthTokens", "relayOwnedZendeskGlobalOAuth",
      "globalOAuthClientRequired", "railway-https-only", "marketplace-logo-zendesk",
      "zendesk_ticket_count", "zendesk_ticket_list", "zendesk_ticket_get", "tickets:read",
      "api/v2/tickets", "arbitrarySearchAllowed", "recordWritesAllowed",
    ] { try expect(source.contains(expected), "Zendesk source missing " + expected) }
    try expect(
      sourceContainsIgnoringWhitespace(model, containsIgnoringWhitespace: "\"close\", \"zendesk\""),
      "Zendesk should expose approval-gated read, read-only, and blocked presets")
    for forbidden in [
      "close_opportunity_list", "copper_opportunity_list", "pipedrive_deal_list",
      "hubspot_deal_list",
    ] {
      try expect(
        !adapter.contains(forbidden), "Zendesk adapter contains foreign action " + forbidden)
    }
    for forbidden in [
      "requester_id", "submitter_id", "assignee_id", "description", "raw_subject", "comment",
      "attachments", "collaborator_ids", "follower_ids", "tags", "custom_fields",
    ] {
      try expect(
        !adapter.contains("\"" + forbidden + "\""),
        "Zendesk adapter should not expose private surface " + forbidden)
    }
  }

  private static func testIntercomApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let model = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let apps = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let connections = try readPackageFile(
      "Sources/RelayConsoleCore/ProviderConnectionService.swift")
    let policies = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let adapter = try readPackageFile(
      "Sources/RelayConsoleCore/IntercomProviderActionAdapter.swift")
    let runtime = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift")
    let source = [views, model, apps, connections, policies, adapter, runtime].joined(
      separator: "\n")
    for expected in [
      "ApplicationsIntercomDetailPanel", "ApplicationsIntercomAgentSwitchRow",
      "Agents with Intercom", "Connect Intercom below before giving agents access.",
      "No Intercom OAuth connection", "connectIntercomOAuth", "connectors/intercom/oauth/start",
      "app.intercom.com", "Sign in with Intercom",
      "Agents can see conversation totals and limited queue information",
      "setIntercomAgentConnection", "selectIntercomConnection", "deleteIntercomOAuthConnection",
      "applications-intercom-agent-switch", "intercomSelectedConnectionId",
      "intercomRelayOwnedOAuthScopes", "relayOwnedIntercomOAuth", "publicAppReviewRequired",
      "marketplace-logo-intercom", "intercom_conversation_count", "intercom_conversation_list",
      "intercom_conversation_get", "Read conversations", "Read admins", "Intercom-Version", "2.15",
      "arbitrarySearchAllowed", "conversationWritesAllowed",
    ] { try expect(source.contains(expected), "Intercom source missing " + expected) }
    try expect(
      sourceContainsIgnoringWhitespace(
        model, containsIgnoringWhitespace: "\"zendesk\", \"intercom\""),
      "Intercom should expose approval-gated read, read-only, and blocked presets")
    for forbidden in [
      "zendesk_ticket_list", "close_opportunity_list", "copper_opportunity_list",
      "pipedrive_deal_list",
    ] {
      try expect(
        !adapter.contains(forbidden), "Intercom adapter contains foreign action " + forbidden)
    }
    for forbidden in [
      "source", "body", "contacts", "email", "conversation_parts", "attachments", "tags",
      "custom_attributes", "linked_objects", "rating",
    ] {
      try expect(
        !adapter.contains("\"" + forbidden + "\""),
        "Intercom adapter should not expose private surface " + forbidden)
    }
  }

  private static func testHelpScoutApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let model = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let apps = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let connections = try readPackageFile(
      "Sources/RelayConsoleCore/ProviderConnectionService.swift")
    let policies = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let adapter = try readPackageFile(
      "Sources/RelayConsoleCore/HelpScoutProviderActionAdapter.swift")
    let runtime = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift")
    let source = [views, model, apps, connections, policies, adapter, runtime].joined(
      separator: "\n")
    for expected in [
      "ApplicationsHelpScoutDetailPanel", "ApplicationsHelpScoutAgentSwitchRow",
      "Agents with Help Scout", "Connect Help Scout before assigning agents.",
      "No Help Scout OAuth connection", "setHelpScoutAgentConnection", "selectHelpScoutConnection",
      "deleteHelpScoutOAuthConnection", "applications-help-scout-agent-switch",
      "helpScoutSelectedConnectionId", "helpScoutOAuthPermissions", "help_scout_oauth_access_token",
      "help_scout_oauth_refresh_token", "rotateHelpScoutOAuthTokens", "relayOwnedHelpScoutOAuth",
      "oauthScopesDocumented", "railway-https-only", "marketplace-logo-help-scout",
      "help_scout_conversation_count", "help_scout_conversation_list",
      "help_scout_conversation_get", "api.helpscout.net/v2",
      "serialized-atomic-refresh-pair-replacement", "arbitrarySearchAllowed",
      "conversationWritesAllowed",
    ] { try expect(source.contains(expected), "Help Scout source missing " + expected) }
    try expect(
      sourceContainsIgnoringWhitespace(
        model, containsIgnoringWhitespace: "\"help-scout\", \"front\""),
      "Help Scout should expose approval-gated read, read-only, and blocked presets")
    for forbidden in [
      "intercom_conversation_list", "zendesk_ticket_list", "close_opportunity_list",
      "copper_opportunity_list",
    ] {
      try expect(
        !adapter.contains(forbidden), "Help Scout adapter contains foreign action " + forbidden)
    }
    for forbidden in [
      "preview", "email", "phone", "cc", "bcc", "attachments", "tags", "customFields", "_links",
    ] {
      try expect(
        !adapter.contains("[\"" + forbidden + "\"]"),
        "Help Scout adapter should not access private surface " + forbidden)
    }
  }

  private static func testFrontApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let model = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let apps = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let connections = try readPackageFile(
      "Sources/RelayConsoleCore/ProviderConnectionService.swift")
    let policies = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let adapter = try readPackageFile("Sources/RelayConsoleCore/FrontProviderActionAdapter.swift")
    let runtime = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift")
    let source = [views, model, apps, connections, policies, adapter, runtime].joined(
      separator: "\n")
    for expected in [
      "ApplicationsFrontDetailPanel", "ApplicationsFrontAgentSwitchRow", "Agents with Front",
      "Connect Front before assigning agents.", "No Front OAuth connection",
      "setFrontAgentConnection", "selectFrontConnection", "deleteFrontOAuthConnection",
      "applications-front-agent-switch", "frontSelectedConnectionId", "frontRelayOwnedOAuthScopes",
      "front_oauth_access_token", "front_oauth_refresh_token", "rotateFrontOAuthTokens",
      "relayOwnedFrontOAuth", "resourceNamespace", "railway-https-only", "marketplace-logo-front",
      "front_conversation_list", "front_conversation_get", "api2.frontapp.com",
      "conversations:read", "same-token-until-final-24-hours-then-new-six-month-token",
      "arbitrarySearchAllowed", "conversationWritesAllowed",
    ] { try expect(source.contains(expected), "Front source missing " + expected) }
    try expect(
      sourceContainsIgnoringWhitespace(
        model, containsIgnoringWhitespace: "\"help-scout\", \"front\""),
      "Front should expose approval-gated read, read-only, and blocked presets")
    for forbidden in [
      "help_scout_conversation_list", "intercom_conversation_list", "zendesk_ticket_list",
      "close_opportunity_list",
    ] {
      try expect(!adapter.contains(forbidden), "Front adapter contains foreign action " + forbidden)
    }
    for forbidden in [
      "messages", "comments", "recipient", "assignee", "email", "phone", "tags", "custom_fields",
      "attachments", "_links", "_pagination",
    ] {
      try expect(
        !adapter.contains("[\"" + forbidden + "\"]"),
        "Front adapter should not access private or traversal surface " + forbidden)
    }
  }

  private static func testTeamworkApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let model = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let apps = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let connections = try readPackageFile(
      "Sources/RelayConsoleCore/ProviderConnectionService.swift")
    let policies = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let adapter = try readPackageFile(
      "Sources/RelayConsoleCore/TeamworkProviderActionAdapter.swift")
    let runtime = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift")
    let source = [views, model, apps, connections, policies, adapter, runtime].joined(
      separator: "\n")
    for expected in [
      "ApplicationsTeamworkDetailPanel", "ApplicationsTeamworkAgentSwitchRow",
      "Agents with Teamwork",
      "Connect one exact Teamwork installation below before turning agents on.",
      "No Teamwork OAuth connection", "setTeamworkAgentConnection", "selectTeamworkConnection",
      "deleteTeamworkOAuthConnection", "applications-teamwork-agent-switch",
      "teamworkSelectedConnectionId", "teamworkRelayOwnedOAuthScopes",
      "teamwork_oauth_access_token", "relayOwnedTeamworkOAuth", "app_login_flow_permanent_bearer",
      "railway-https-only", "marketplace-logo-teamwork", "teamwork_project_list",
      "teamwork_task_list", "teamwork_task_get", "Teamwork.com", "fields[projects]",
      "fields[tasks]", "broadPermanentToken", "arbitraryQueryAllowed", "projectOrTaskWritesAllowed",
    ] { try expect(source.contains(expected), "Teamwork source missing " + expected) }
    try expect(
      sourceContainsIgnoringWhitespace(
        model, containsIgnoringWhitespace: "\"groove\", \"teamwork\""),
      "Teamwork should expose approval-gated read, read-only, and blocked presets")
    for forbidden in [
      "front_conversation_list", "help_scout_conversation_list", "intercom_conversation_list",
      "zendesk_ticket_list",
    ] {
      try expect(
        !adapter.contains(forbidden), "Teamwork adapter contains foreign action " + forbidden)
    }
    for forbidden in [
      "description", "comments", "assignees", "email", "avatar", "customFields", "tags", "files",
      "included", "pagination", "budget", "cost", "rate",
    ] {
      try expect(
        !adapter.contains("[\"" + forbidden + "\"]"),
        "Teamwork adapter should not access private, financial, or traversal surface " + forbidden)
    }
  }

  private static func testBasecampApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let model = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let apps = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let connections = try readPackageFile(
      "Sources/RelayConsoleCore/ProviderConnectionService.swift")
    let policies = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let adapter = try readPackageFile(
      "Sources/RelayConsoleCore/BasecampProviderActionAdapter.swift")
    let runtime = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift")
    let source = [views, model, apps, connections, policies, adapter, runtime].joined(
      separator: "\n")
    for expected in [
      "ApplicationsBasecampDetailPanel", "ApplicationsBasecampAgentSwitchRow",
      "Agents with Basecamp", "Connect one exact Basecamp account below before turning agents on.",
      "No Basecamp OAuth connection", "setBasecampAgentConnection", "selectBasecampConnection",
      "deleteBasecampOAuthConnection", "applications-basecamp-agent-switch",
      "basecampSelectedConnectionId", "basecampOAuthPermissions", "basecamp_oauth_access_token",
      "basecamp_oauth_refresh_token", "rotateBasecampOAuthTokens", "relayOwnedBasecampOAuth",
      "serialized-atomic-provider-returned-pair-replacement", "railway-https-only",
      "marketplace-logo-basecamp", "basecamp_project_list", "basecamp_project_get",
      "basecamp_todo_get", "3.basecampapi.com", "bc3", "accessTokenLifetimeSeconds",
      "linkPaginationAllowed", "projectOrTodoWritesAllowed",
    ] { try expect(source.contains(expected), "Basecamp source missing " + expected) }
    try expect(
      sourceContainsIgnoringWhitespace(
        model, containsIgnoringWhitespace: "\"teamwork\", \"basecamp\""),
      "Basecamp should expose approval-gated read, read-only, and blocked presets")
    for forbidden in [
      "teamwork_project_list", "front_conversation_list", "help_scout_conversation_list",
      "zendesk_ticket_list",
    ] {
      try expect(
        !adapter.contains(forbidden), "Basecamp adapter contains foreign action " + forbidden)
    }
    for forbidden in [
      "description", "creator", "assignees", "email_address", "avatar_url", "comments_url",
      "boosts_url", "bookmark_url", "app_url", "dock",
    ] {
      try expect(
        !adapter.contains("[\"" + forbidden + "\"]"),
        "Basecamp adapter should not access private or traversal surface " + forbidden)
    }
  }

  private static func testWrikeApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let model = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let apps = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let connections = try readPackageFile(
      "Sources/RelayConsoleCore/ProviderConnectionService.swift")
    let policies = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let adapter = try readPackageFile("Sources/RelayConsoleCore/WrikeProviderActionAdapter.swift")
    let runtime = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift")
    let source = [views, model, apps, connections, policies, adapter, runtime].joined(
      separator: "\n")
    for expected in [
      "ApplicationsWrikeDetailPanel", "ApplicationsWrikeAgentSwitchRow", "Agents with Wrike",
      "Connect one exact Wrike account below before turning agents on.", "Connect Wrike",
      "No Wrike OAuth connection", "connectWrikeOAuth", "setWrikeAgentConnection",
      "selectWrikeConnection", "deleteWrikeOAuthConnection", "applications-wrike-agent-switch",
      "wrikeSelectedConnectionId", "permissionPolicyBoundary",
      "safe-bounded-reads-full-api-approval-or-dangerously-skip", "wrikeRelayOwnedOAuthScopes",
      "wrike_oauth_access_token", "wrike_oauth_refresh_token", "rotateWrikeOAuthTokens",
      "relayOwnedWrikeOAuth", "serialized-atomic-single-use-pair-replacement", "railway-https-only",
      "marketplace-logo-wrike", "wrike_project_list", "wrike_task_list", "wrike_task_get",
      "wrike_full_api", "wsReadOnly", "providerHost", "accessTokenLifetimeSeconds",
      "automaticPaginationAllowed", "projectOrTaskWritesAllowed",
    ] { try expect(source.contains(expected), "Wrike source missing " + expected) }
    try expect(
      sourceContainsIgnoringWhitespace(
        model, containsIgnoringWhitespace: "\"basecamp\", \"wrike\""),
      "Wrike should expose approval-gated read, read-only, and blocked presets")
    for forbidden in [
      "basecamp_project_list", "teamwork_project_list", "front_conversation_list",
      "zendesk_ticket_list",
    ] {
      try expect(!adapter.contains(forbidden), "Wrike adapter contains foreign action " + forbidden)
    }
    for forbidden in [
      "description", "briefDescription", "responsibleIds", "authorIds", "sharedIds", "followerIds",
      "customFields", "metadata", "attachmentCount", "billingType", "nextPageToken", "permalink",
    ] {
      try expect(
        !adapter.contains("[\"" + forbidden + "\"]"),
        "Wrike adapter should not access private, financial, or traversal surface " + forbidden)
    }
  }

  private static func testSmartsheetApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let model = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let apps = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let connections = try readPackageFile(
      "Sources/RelayConsoleCore/ProviderConnectionService.swift")
    let policies = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let adapter = try readPackageFile(
      "Sources/RelayConsoleCore/SmartsheetProviderActionAdapter.swift")
    let runtime = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift")
    let source = [views, model, apps, connections, policies, adapter, runtime].joined(
      separator: "\n")
    for expected in [
      "ApplicationsSmartsheetDetailPanel", "ApplicationsSmartsheetAgentSwitchRow",
      "Agents with Smartsheet", "Connect Smartsheet", "No Smartsheet OAuth connection",
      "connectSmartsheetOAuth", "setSmartsheetAgentConnection", "selectSmartsheetConnection",
      "deleteSmartsheetOAuthConnection", "applications-smartsheet-agent-switch",
      "smartsheetSelectedConnectionId", "permissionPolicyBoundary",
      "safe-bounded-reads-full-api-approval-or-dangerously-skip", "smartsheetRelayOwnedOAuthScopes",
      "smartsheet_oauth_access_token", "smartsheet_oauth_refresh_token",
      "rotateSmartsheetOAuthTokens", "relayOwnedSmartsheetOAuth",
      "serialized-atomic-provider-returned-pair-replacement", "railway-https-only",
      "marketplace-logo-smartsheet", "smartsheet_sheet_list", "smartsheet_sheet_get",
      "smartsheet_row_get", "smartsheet_full_api", "READ_SHEETS", "accessTokenLifetimeSeconds",
      "automaticPaginationAllowed",
    ] { try expect(source.contains(expected), "Smartsheet source missing " + expected) }
    try expect(
      sourceContainsIgnoringWhitespace(
        model, containsIgnoringWhitespace: "\"wrike\", \"smartsheet\""),
      "Smartsheet should expose approval-gated read, read-only, and blocked presets")
    for forbidden in [
      "wrike_project_list", "basecamp_project_list", "teamwork_project_list",
      "front_conversation_list",
    ] {
      try expect(
        !adapter.contains(forbidden), "Smartsheet adapter contains foreign action " + forbidden)
    }
    for forbidden in [
      "attachments", "discussions", "comments", "formula", "hyperlink", "image", "proof", "contact",
      "createdBy", "modifiedBy", "permalink",
    ] {
      try expect(
        !adapter.contains("[\"" + forbidden + "\"]"),
        "Smartsheet adapter should not access collaboration or private surface " + forbidden)
    }
  }

  private static func testTodoistApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let model = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let apps = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let connections = try readPackageFile(
      "Sources/RelayConsoleCore/ProviderConnectionService.swift")
    let policies = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let adapter = try readPackageFile("Sources/RelayConsoleCore/TodoistProviderActionAdapter.swift")
    let runtime = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift")
    let source = [views, model, apps, connections, policies, adapter, runtime].joined(
      separator: "\n")
    for expected in [
      "ApplicationsTodoistDetailPanel", "ApplicationsTodoistAgentSwitchRow", "Agents with Todoist",
      "Connect one exact Todoist user", "No Todoist OAuth connection", "connectTodoistOAuth",
      "setTodoistAgentConnection", "selectTodoistConnection", "deleteTodoistOAuthConnection",
      "applications-todoist-agent-switch", "todoistSelectedConnectionId",
      "todoistRelayOwnedOAuthScopes", "todoist_oauth_access_token", "todoist_oauth_refresh_token",
      "rotateTodoistOAuthTokens", "relayOwnedTodoistOAuth",
      "serialized-atomic-first-complete-pair-wins", "railway-https-only",
      "marketplace-logo-todoist", "todoist_project_list", "todoist_task_list", "todoist_task_get",
      "todoist_full_api", "data:read_write", "data:delete", "project:delete", "backups:read",
      "refreshGraceRetryOmitsReplacement", "refreshReplayRevokesTokenFamily",
      "automaticPaginationAllowed", "projectOrTaskWritesAllowed",
    ] { try expect(source.contains(expected), "Todoist source missing " + expected) }
    try expect(
      sourceContainsIgnoringWhitespace(
        model, containsIgnoringWhitespace: "\"smartsheet\", \"todoist\""),
      "Todoist should expose Safe, Dangerously skip permissions, and no-access presets")
    for forbidden in [
      "smartsheet_sheet_list", "wrike_project_list", "basecamp_project_list",
      "teamwork_project_list",
    ] {
      try expect(
        !adapter.contains(forbidden), "Todoist adapter contains foreign action " + forbidden)
    }
    for forbidden in [
      "description", "labels", "user_id", "responsible_uid", "assigned_by_uid", "added_by_uid",
      "creator_uid", "note_count", "url", "next_cursor", "public_key",
    ] {
      try expect(
        !adapter.contains("[\"" + forbidden + "\"]"),
        "Todoist adapter should not access private or traversal surface " + forbidden)
    }
  }

  private static func testTogglTrackSharedMarketplaceContractIsSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let apps = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let source = [views, apps].joined(separator: "\n")
    for expected in [
      "toggl-track", "Toggl Track", "Customer-owned personal Toggl Track API token",
      "Add Toggl Track API token", "toggl_track_full_api", "marketplace-logo-toggl-track",
      "customer-owned-toggl-track-token-marketplace", "https://engineering.toggl.com/docs/track/",
    ] {
      try expect(source.contains(expected), "Toggl Track source missing " + expected)
    }
    try expect(
      apps.contains("\"ticktick\", \"toggl-track\", \"harvest\""),
      "Toggl Track should be retained between TickTick and Harvest")
  }

  private static func testHarvestApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let model = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let apps = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let connections = try readPackageFile(
      "Sources/RelayConsoleCore/ProviderConnectionService.swift")
    let policies = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let adapter = try readPackageFile("Sources/RelayConsoleCore/HarvestProviderActionAdapter.swift")
    let runtime = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift")
    let source = [views, model, apps, connections, policies, adapter, runtime].joined(
      separator: "\n")
    for expected in [
      "ApplicationsHarvestDetailPanel", "ApplicationsHarvestAgentSwitchRow", "Agents with Harvest",
      "Connect one Harvest account before assigning it to agents.", "No Harvest OAuth connection",
      "setHarvestAgentConnection", "selectHarvestConnection", "deleteHarvestOAuthConnection",
      "applications-harvest-agent-switch", "harvestSelectedConnectionId",
      "harvestRelayOwnedOAuthScopes", "harvest_oauth_access_token", "harvest_oauth_refresh_token",
      "rotateHarvestOAuthTokens", "relayOwnedHarvestOAuth",
      "serialized-atomic-provider-returned-pair-replacement", "railway-https-only",
      "marketplace-logo-harvest", "harvest_project_assignment_list", "harvest_time_entry_list",
      "harvest_time_entry_get", "harvest:", "automaticPaginationAllowed",
      "privateOrFinancialDataReturned",
    ] { try expect(source.contains(expected), "Harvest source missing " + expected) }
    try expect(
      sourceContainsIgnoringWhitespace(
        model, containsIgnoringWhitespace: "\"todoist\", \"harvest\""),
      "Harvest should expose approval-gated read, read-only, and blocked presets")
    for forbidden in [
      "todoist_task_list", "smartsheet_sheet_list", "wrike_project_list", "basecamp_project_list",
    ] {
      try expect(
        !adapter.contains(forbidden), "Harvest adapter contains foreign action " + forbidden)
    }
    for forbidden in [
      "description", "client", "user", "billable", "billed", "invoice", "hourly_rate", "cost_rate",
      "budget", "external_reference", "approval",
    ] {
      try expect(
        !adapter.contains("[\"" + forbidden + "\"]"),
        "Harvest adapter should not access private or financial surface " + forbidden)
    }
  }

  private static func testTempoTimesheetsSharedMarketplaceContractIsSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let apps = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let source = [views, apps].joined(separator: "\n")
    for expected in [
      "tempo-timesheets", "Tempo Timesheets", "Customer-owned scoped Tempo API token",
      "tempo_timesheets_full_api", "customer-owned-tempo-token-marketplace",
      "https://apidocs.tempo.io/",
    ] {
      try expect(source.contains(expected), "Tempo Timesheets source missing " + expected)
    }
  }

  private static func testZephyrScaleSharedMarketplaceContractIsSourceBacked() throws {
    let source = try [
      "Sources/RelayConsoleApp/Views.swift", "Sources/RelayConsoleCore/ApplicationsService.swift",
    ].map(readPackageFile).joined(separator: "\n")
    for expected in [
      "zephyr-scale", "Zephyr Scale", "Customer-owned Zephyr Scale JWT access key",
      "zephyr_scale_full_api", "customer-owned-zephyr-scale-token-marketplace",
      "support.smartbear.com/zephyr-scale-cloud/api-docs",
    ] {
      try expect(source.contains(expected), "Zephyr Scale source missing " + expected)
    }
  }

  private static func testCalendlyApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let model = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let apps = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let connections = try readPackageFile(
      "Sources/RelayConsoleCore/ProviderConnectionService.swift")
    let policies = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let adapter = try readPackageFile(
      "Sources/RelayConsoleCore/CalendlyProviderActionAdapter.swift")
    let runtime = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift")
    let source = [views, model, apps, connections, policies, adapter, runtime].joined(
      separator: "\n")
    for expected in [
      "ApplicationsCalendlyDetailPanel", "ApplicationsCalendlyAgentSwitchRow",
      "Agents with Calendly", "Connect one exact Calendly user and current organization",
      "No Calendly OAuth connection", "setCalendlyAgentConnection", "selectCalendlyConnection",
      "deleteCalendlyOAuthConnection", "applications-calendly-agent-switch",
      "calendlySelectedConnectionId", "calendlyRelayOwnedOAuthScopes",
      "calendly_oauth_access_token", "calendly_oauth_refresh_token", "rotateCalendlyOAuthTokens",
      "relayOwnedCalendlyOAuth", "single-use-rotating", "S256", "railway-https-only",
      "marketplace-logo-calendly", "calendly_event_type_list", "calendly_scheduled_event_list",
      "calendly_scheduled_event_get", "users:read", "event_types:read", "scheduled_events:read",
      "automaticPaginationAllowed", "inviteePIIReturned",
    ] { try expect(source.contains(expected), "Calendly source missing " + expected) }
    try expect(
      sourceContainsIgnoringWhitespace(
        model, containsIgnoringWhitespace: "\"calendly\", \"cal-com\""),
      "Calendly should expose approval-gated read, read-only, and blocked presets")
    for forbidden in [
      "harvest_time_entry_list", "todoist_task_list", "smartsheet_sheet_list", "wrike_project_list",
    ] {
      try expect(
        !adapter.contains(forbidden), "Calendly adapter contains foreign action " + forbidden)
    }
    for forbidden in [
      "email", "questions_and_answers", "tracking", "location", "cancel_url", "reschedule_url",
      "conference_data",
    ] {
      try expect(
        !adapter.contains("[\"" + forbidden + "\"]"),
        "Calendly adapter should not access invitee private surface " + forbidden)
    }
  }

  private static func testKrakenApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let model = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let apps = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let source = [views, model, apps].joined(separator: "\n")
    for expected in [
      "ApplicationsKrakenCredentialForm",
      "krakenAPIKeyDraft",
      "krakenAPISecretDraft",
      "saveKrakenRailwayConnection",
      "KRAKEN_API_KEY",
      "KRAKEN_API_SECRET",
      "connectors/kraken/connections/",
      "marketplaceKrakenApp",
      "kraken_account_read",
      "kraken_order_place",
      "kraken_order_cancel",
      "kraken_funding_blocked",
      "https://www.kraken.com/",
    ] {
      try expect(source.contains(expected), "Kraken source missing " + expected)
    }
    for forbidden in [
      "withdraw-funds", "add-withdraw-address", "update-withdraw-address", "create-ws-token",
    ] {
      try expect(
        !source.contains(forbidden),
        "Kraken client source requests forbidden key permission " + forbidden)
    }
  }

  private static func testBinanceApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let model = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let apps = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let source = [views, model, apps].joined(separator: "\n")
    for expected in [
      "ApplicationsBinanceCredentialForm",
      "binanceAPIKeyDraft",
      "binanceAPISecretDraft",
      "saveBinanceRailwayConnection",
      "BINANCE_API_KEY",
      "BINANCE_API_SECRET",
      "connectors/binance/connections/",
      "marketplaceBinanceApp",
      "binance_account_read",
      "binance_order_place",
      "binance_order_cancel",
      "binance_funding_blocked",
      "https://www.binance.com/",
    ] {
      try expect(source.contains(expected), "Binance source missing " + expected)
    }
    for forbidden in ["withdraw", "margin", "futures", "subaccount", "create-ws-token"] {
      try expect(
        !source.contains("binance_" + forbidden),
        "Binance client source exposes forbidden operation " + forbidden)
    }
  }

  private static func testGeminiApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let model = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let apps = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let source = [views, model, apps].joined(separator: "\n")
    for expected in [
      "ApplicationsGeminiCredentialForm",
      "geminiAPIKeyDraft",
      "geminiAPISecretDraft",
      "saveGeminiRailwayConnection",
      "GEMINI_API_KEY",
      "GEMINI_API_SECRET",
      "connectors/gemini/connections/",
      "marketplaceGeminiApp",
      "gemini_account_read",
      "gemini_order_place",
      "gemini_order_cancel",
      "gemini_funding_blocked",
      "https://www.gemini.com/",
    ] {
      try expect(source.contains(expected), "Gemini source missing " + expected)
    }
    for forbidden in ["withdraw", "transfer", "perpetual", "master_account", "fund_manager"] {
      try expect(
        !source.contains("gemini_" + forbidden),
        "Gemini client source exposes forbidden operation " + forbidden)
    }
  }

  private static func testPayoneerApplicationsPreviewIsSourceBacked() throws {
    let apps = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    for expected in [
      "marketplacePayoneerApp",
      "payoneer-regulated-provider-review",
      "payoneer_connect_before_regulated_approval",
      "payoneer_collect_credentials_before_approval",
      "payoneer_api_actions_before_approval",
      "payoneer_financial_actions_blocked",
      "installAfterSetup: false",
      "installable: false",
      "availability: .unavailable",
      "connectionState: .unavailable",
      "installState: .unavailable",
      "https://developer.sandbox.payoneer.com/psd2/get-started",
      "https://www.payoneer.com/",
    ] {
      try expect(apps.contains(expected), "Payoneer source missing " + expected)
    }
    for forbidden in [
      "PAYONEER_ACCESS_TOKEN", "PAYONEER_CLIENT_SECRET", "PAYONEER_PASSWORD",
      "savePayoneerRailwayConnection", "ApplicationsPayoneerCredentialForm",
    ] {
      try expect(
        !apps.contains(forbidden), "Payoneer preview must not collect or save " + forbidden)
    }
  }

  private static func testRemitlyApplicationsPreviewIsSourceBacked() throws {
    let apps = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    for expected in [
      "marketplaceRemitlyApp", "remitly-enterprise-review",
      "remitly_connect_before_enterprise_approval", "remitly_collect_customer_credentials",
      "remitly_api_actions_before_approval", "remitly_money_movement_blocked",
      "installAfterSetup: false", "installable: false", "availability: .unavailable",
      "connectionState: .unavailable", "installState: .unavailable",
      "https://www.remitly.com/us/en/landing/partner-program", "https://www.remitly.com/",
    ] {
      try expect(apps.contains(expected), "Remitly source missing " + expected)
    }
    for forbidden in [
      "REMITLY_ACCESS_TOKEN", "REMITLY_CLIENT_SECRET", "REMITLY_PASSWORD",
      "saveRemitlyRailwayConnection", "ApplicationsRemitlyCredentialForm",
    ] {
      try expect(!apps.contains(forbidden), "Remitly preview must not collect or save " + forbidden)
    }
  }

  private static func testWesternUnionApplicationsPreviewIsSourceBacked() throws {
    let apps = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    for expected in [
      "marketplaceWesternUnionApp", "western-union-partner-review",
      "western_union_connect_before_partner_approval", "western_union_collect_customer_credentials",
      "western_union_api_actions_before_approval", "western_union_money_movement_blocked",
      "installAfterSetup: false", "installable: false", "availability: .unavailable",
      "connectionState: .unavailable", "installState: .unavailable",
      "https://www.westernunion.com/global/en/wuib.html", "https://www.westernunion.com/",
    ] {
      try expect(apps.contains(expected), "Western Union source missing " + expected)
    }
    for forbidden in [
      "WESTERN_UNION_ACCESS_TOKEN", "WESTERN_UNION_CLIENT_SECRET", "WESTERN_UNION_PASSWORD",
      "WESTERN_UNION_MTCN", "saveWesternUnionRailwayConnection",
      "ApplicationsWesternUnionCredentialForm",
    ] {
      try expect(
        !apps.contains(forbidden), "Western Union preview must not collect or save " + forbidden)
    }
  }

  private static func testWisePersonalApplicationsPreviewIsSourceBacked() throws {
    let apps = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    for expected in [
      "marketplaceWisePersonalApp", "wise-personal-partner-review",
      "wise_personal_connect_before_partner_approval", "wise_personal_collect_customer_credentials",
      "wise_personal_api_actions_before_approval", "wise_personal_money_movement_blocked",
      "installAfterSetup: false", "installable: false", "availability: .unavailable",
      "connectionState: .unavailable", "installState: .unavailable",
      "https://docs.wise.com/guides/developer/auth-and-security", "https://wise.com/",
    ] {
      try expect(apps.contains(expected), "Wise Personal source missing " + expected)
    }
    for forbidden in [
      "WISE_PERSONAL_ACCESS_TOKEN", "WISE_PERSONAL_CLIENT_SECRET", "WISE_PERSONAL_PASSWORD",
      "WISE_PERSONAL_API_TOKEN", "saveWisePersonalRailwayConnection",
      "ApplicationsWisePersonalCredentialForm",
    ] {
      try expect(
        !apps.contains(forbidden), "Wise Personal preview must not collect or save " + forbidden)
    }
  }

  private static func testMonzoApplicationsPreviewIsSourceBacked() throws {
    let apps = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    for expected in [
      "marketplaceMonzoApp", "monzo-regulated-access-review",
      "monzo_connect_without_authorised_distribution", "monzo_collect_customer_credentials",
      "monzo_api_actions_before_approval", "monzo_money_movement_blocked",
      "installAfterSetup: false", "installable: false", "availability: .unavailable",
      "connectionState: .unavailable", "installState: .unavailable",
      "https://docs.monzo.com/", "https://monzo.com/",
    ] {
      try expect(apps.contains(expected), "Monzo source missing " + expected)
    }
    for forbidden in [
      "MONZO_ACCESS_TOKEN", "MONZO_CLIENT_SECRET", "MONZO_REFRESH_TOKEN", "MONZO_EMAIL",
      "MONZO_PIN", "saveMonzoRailwayConnection", "ApplicationsMonzoCredentialForm",
    ] {
      try expect(!apps.contains(forbidden), "Monzo preview must not collect or save " + forbidden)
    }
  }

  private static func testStarlingBankApplicationsPreviewIsSourceBacked() throws {
    let apps = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    for expected in [
      "marketplaceStarlingBankApp", "starling-bank-marketplace-review",
      "starling_connect_before_marketplace_approval", "starling_collect_personal_access_token",
      "starling_api_actions_before_approval", "starling_money_movement_blocked",
      "installAfterSetup: false", "installable: false", "availability: .unavailable",
      "connectionState: .unavailable", "installState: .unavailable",
      "https://developer.starlingbank.com/docs", "https://www.starlingbank.com/",
    ] {
      try expect(apps.contains(expected), "Starling Bank source missing " + expected)
    }
    for forbidden in [
      "STARLING_ACCESS_TOKEN", "STARLING_CLIENT_SECRET", "STARLING_REFRESH_TOKEN",
      "STARLING_PERSONAL_ACCESS_TOKEN", "STARLING_SIGNING_KEY", "saveStarlingRailwayConnection",
      "ApplicationsStarlingCredentialForm",
    ] {
      try expect(
        !apps.contains(forbidden), "Starling Bank preview must not collect or save " + forbidden)
    }
  }

  private static func testChaseApplicationsPreviewIsSourceBacked() throws {
    let apps = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    for expected in [
      "marketplaceChaseApp", "chase-existing-partner-review",
      "chase_connect_before_partner_contract", "chase_collect_customer_credentials",
      "chase_api_actions_before_approval", "chase_money_movement_blocked",
      "installAfterSetup: false", "installable: false", "availability: .unavailable",
      "connectionState: .unavailable", "installState: .unavailable",
      "https://developer.chase.com/", "https://www.chase.com/",
    ] {
      try expect(apps.contains(expected), "Chase source missing " + expected)
    }
    for forbidden in [
      "CHASE_ACCESS_TOKEN", "CHASE_CLIENT_SECRET", "CHASE_USERNAME", "CHASE_PASSWORD",
      "CHASE_ACCOUNT_NUMBER", "saveChaseRailwayConnection", "ApplicationsChaseCredentialForm",
    ] {
      try expect(!apps.contains(forbidden), "Chase preview must not collect or save " + forbidden)
    }
  }

  private static func testBankOfAmericaApplicationsPreviewIsSourceBacked() throws {
    let apps = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    for expected in [
      "marketplaceBankOfAmericaApp", "bank-of-america-consumer-api-review",
      "bank_of_america_connect_before_consumer_api_approval",
      "bank_of_america_collect_customer_credentials",
      "bank_of_america_api_actions_before_approval", "bank_of_america_money_movement_blocked",
      "installAfterSetup: false", "installable: false", "availability: .unavailable",
      "connectionState: .unavailable", "installState: .unavailable",
      "https://developer.bankofamerica.com/", "https://www.bankofamerica.com/",
    ] {
      try expect(apps.contains(expected), "Bank of America source missing " + expected)
    }
    for forbidden in [
      "BANK_OF_AMERICA_ACCESS_TOKEN", "BANK_OF_AMERICA_CLIENT_SECRET", "BANK_OF_AMERICA_ONLINE_ID",
      "BANK_OF_AMERICA_PASSCODE", "BANK_OF_AMERICA_ACCOUNT_NUMBER",
      "saveBankOfAmericaRailwayConnection", "ApplicationsBankOfAmericaCredentialForm",
    ] {
      try expect(
        !apps.contains(forbidden), "Bank of America preview must not collect or save " + forbidden)
    }
  }

  private static func testCapitalOneApplicationsPreviewIsSourceBacked() throws {
    let apps = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    for expected in [
      "marketplaceCapitalOneApp", "capital-one-consumer-data-review",
      "capital_one_connect_before_production_approval", "capital_one_collect_customer_credentials",
      "capital_one_api_actions_before_approval", "capital_one_money_movement_blocked",
      "installAfterSetup: false", "installable: false", "availability: .unavailable",
      "connectionState: .unavailable", "installState: .unavailable",
      "https://developer.capitalone.com/documentation/", "https://www.capitalone.com/",
    ] {
      try expect(apps.contains(expected), "Capital One source missing " + expected)
    }
    for forbidden in [
      "CAPITAL_ONE_ACCESS_TOKEN", "CAPITAL_ONE_CLIENT_SECRET", "CAPITAL_ONE_USERNAME",
      "CAPITAL_ONE_PASSWORD", "CAPITAL_ONE_ACCOUNT_NUMBER", "saveCapitalOneRailwayConnection",
      "ApplicationsCapitalOneCredentialForm",
    ] {
      try expect(
        !apps.contains(forbidden), "Capital One preview must not collect or save " + forbidden)
    }
  }

  private static func testAmericanExpressApplicationsPreviewIsSourceBacked() throws {
    let apps = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    for expected in [
      "marketplaceAmericanExpressApp", "american-express-open-banking-review",
      "american_express_connect_before_partner_approval",
      "american_express_collect_customer_credentials",
      "american_express_api_actions_before_approval", "american_express_money_movement_blocked",
      "installAfterSetup: false", "installable: false", "availability: .unavailable",
      "connectionState: .unavailable", "installState: .unavailable",
      "https://developer.americanexpress.com/", "https://www.americanexpress.com/",
    ] {
      try expect(apps.contains(expected), "American Express source missing " + expected)
    }
    for forbidden in [
      "AMERICAN_EXPRESS_ACCESS_TOKEN", "AMERICAN_EXPRESS_CLIENT_SECRET", "AMERICAN_EXPRESS_USER_ID",
      "AMERICAN_EXPRESS_PASSWORD", "AMERICAN_EXPRESS_CARD_NUMBER",
      "saveAmericanExpressRailwayConnection", "ApplicationsAmericanExpressCredentialForm",
    ] {
      try expect(
        !apps.contains(forbidden), "American Express preview must not collect or save " + forbidden)
    }
  }

  private static func testDiscoverApplicationsPreviewIsSourceBacked() throws {
    let apps = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    for expected in [
      "marketplaceDiscoverApp", "discover-data-sharing-partner-review",
      "discover_connect_before_data_partner_approval", "discover_collect_customer_credentials",
      "discover_api_actions_before_approval", "discover_money_movement_blocked",
      "installAfterSetup: false", "installable: false", "availability: .unavailable",
      "connectionState: .unavailable", "installState: .unavailable",
      "https://www.discover.com/credit-cards/data-authorization/", "https://www.discover.com/",
    ] {
      try expect(apps.contains(expected), "Discover source missing " + expected)
    }
    for forbidden in [
      "DISCOVER_ACCESS_TOKEN", "DISCOVER_CLIENT_SECRET", "DISCOVER_USERNAME", "DISCOVER_PASSWORD",
      "DISCOVER_ACCOUNT_NUMBER", "DISCOVER_CARD_NUMBER", "saveDiscoverRailwayConnection",
      "ApplicationsDiscoverCredentialForm",
    ] {
      try expect(
        !apps.contains(forbidden), "Discover preview must not collect or save " + forbidden)
    }
  }

  private static func testChimeApplicationsPreviewIsSourceBacked() throws {
    let apps = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    for expected in [
      "marketplaceChimeApp", "chime-account-data-partner-review",
      "chime_connect_before_account_data_approval", "chime_collect_member_credentials",
      "chime_api_actions_before_approval", "chime_money_movement_blocked",
      "installAfterSetup: false", "installable: false", "availability: .unavailable",
      "connectionState: .unavailable", "installState: .unavailable",
      "https://help.chime.com/can-i-use-my-chime-account-with-third-party-apps-1d922bbb",
      "https://www.chime.com/",
    ] {
      try expect(apps.contains(expected), "Chime source missing " + expected)
    }
    for forbidden in [
      "CHIME_ACCESS_TOKEN", "CHIME_CLIENT_SECRET", "CHIME_EMAIL", "CHIME_PASSWORD",
      "CHIME_ACCOUNT_NUMBER", "CHIME_ROUTING_NUMBER", "saveChimeRailwayConnection",
      "ApplicationsChimeCredentialForm",
    ] {
      try expect(!apps.contains(forbidden), "Chime preview must not collect or save " + forbidden)
    }
  }

  private static func testSoFiApplicationsPreviewIsSourceBacked() throws {
    let apps = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    for expected in [
      "marketplaceSoFiApp", "sofi-consumer-data-partner-review",
      "sofi_connect_before_consumer_data_approval", "sofi_collect_customer_credentials",
      "sofi_api_actions_before_approval", "sofi_money_movement_blocked",
      "installAfterSetup: false", "installable: false", "availability: .unavailable",
      "connectionState: .unavailable", "installState: .unavailable",
      "https://support.sofi.com/hc/en-us/articles/4423151796749-How-does-SoFi-obtain-information-from-external-accounts",
      "https://www.sofi.com/",
    ] {
      try expect(apps.contains(expected), "SoFi source missing " + expected)
    }
    for forbidden in [
      "SOFI_ACCESS_TOKEN", "SOFI_CLIENT_SECRET", "SOFI_EMAIL", "SOFI_PASSWORD",
      "SOFI_ACCOUNT_NUMBER", "SOFI_ROUTING_NUMBER", "saveSoFiRailwayConnection",
      "ApplicationsSoFiCredentialForm",
    ] {
      try expect(!apps.contains(forbidden), "SoFi preview must not collect or save " + forbidden)
    }
  }

  private static func testN26ApplicationsPreviewIsSourceBacked() throws {
    let apps = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    for expected in [
      "marketplaceN26App", "n26-open-banking-tpp-review",
      "n26_connect_before_tpp_approval", "n26_collect_customer_credentials",
      "n26_api_actions_before_approval", "n26_money_movement_blocked",
      "installable: false", "readOnly: true", "approvalRequiredActions: []",
      "https://support.n26.com/en-eu/security/open-banking-psd2/psd2-open-banking-for-third-party-providers",
      "https://n26.com/",
    ] {
      try expect(apps.contains(expected), "N26 source missing " + expected)
    }
    for forbidden in [
      "N26_ACCESS_TOKEN", "N26_CLIENT_SECRET", "N26_EMAIL", "N26_PASSWORD", "N26_CONFIRMATION_PIN",
      "N26_IBAN", "N26_QWAC_PRIVATE_KEY", "saveN26RailwayConnection",
      "ApplicationsN26CredentialForm",
    ] {
      try expect(!apps.contains(forbidden), "N26 preview must not collect or save " + forbidden)
    }
  }

  private static func testPayPalPersonalApplicationsPreviewIsSourceBacked() throws {
    let apps = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    for expected in [
      "marketplacePayPalPersonalApp", "paypal-personal-xs2a-tpp-review",
      "paypal_personal_connect_before_tpp_approval", "paypal_personal_collect_customer_credentials",
      "paypal_personal_api_actions_before_approval", "paypal_personal_money_movement_blocked",
      "installAfterSetup: false", "installable: false", "availability: .unavailable",
      "connectionState: .unavailable", "installState: .unavailable",
      "https://developer.paypal.com/reference/guidelines/psd2-compliance/",
      "https://www.paypal.com/us/digital-wallet/how-paypal-works",
    ] {
      try expect(apps.contains(expected), "PayPal Personal source missing " + expected)
    }
    for forbidden in [
      "PAYPAL_PERSONAL_ACCESS_TOKEN", "PAYPAL_PERSONAL_CLIENT_SECRET", "PAYPAL_PERSONAL_EMAIL",
      "PAYPAL_PERSONAL_PASSWORD", "PAYPAL_PERSONAL_BANK_ACCOUNT", "PAYPAL_PERSONAL_CARD_NUMBER",
      "PAYPAL_PERSONAL_TPP_PRIVATE_KEY", "savePayPalPersonalRailwayConnection",
      "ApplicationsPayPalPersonalCredentialForm",
    ] {
      try expect(
        !apps.contains(forbidden), "PayPal Personal preview must not collect or save " + forbidden)
    }
  }

  private static func testEBayMotorsApplicationsPreviewIsSourceBacked() throws {
    let apps = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    for expected in [
      "marketplaceEBayMotorsApp", "ebay-motors-buy-api-review",
      "ebay_motors_connect_before_buy_api_approval", "ebay_motors_collect_customer_credentials",
      "ebay_motors_api_actions_before_approval", "ebay_motors_transactional_actions_blocked",
      "installAfterSetup: false", "installable: false", "availability: .unavailable",
      "connectionState: .unavailable", "installState: .unavailable",
      "https://developer.ebay.com/api-docs/buy/buy-requirements.html",
      "https://www.ebay.com/motors/",
    ] {
      try expect(apps.contains(expected), "eBay Motors source missing " + expected)
    }
    for forbidden in [
      "EBAY_MOTORS_ACCESS_TOKEN", "EBAY_MOTORS_CLIENT_SECRET", "EBAY_MOTORS_USERNAME",
      "EBAY_MOTORS_PASSWORD", "EBAY_MOTORS_DEV_ID", "EBAY_MOTORS_APP_ID", "EBAY_MOTORS_CERT_ID",
      "saveEBayMotorsRailwayConnection", "ApplicationsEBayMotorsCredentialForm",
    ] {
      try expect(
        !apps.contains(forbidden), "eBay Motors preview must not collect or save " + forbidden)
    }
  }

  private static func testAmazonAlexaApplicationsPreviewIsSourceBacked() throws {
    let apps = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    for expected in [
      "marketplaceAmazonAlexaApp", "amazon-alexa-custom-skill-certification",
      "amazon_alexa_enable_before_skill_certification", "amazon_alexa_collect_amazon_credentials",
      "amazon_alexa_skill_requests_before_approval",
      "amazon_alexa_sensitive_or_mutating_voice_actions_blocked",
      "installAfterSetup: false", "installable: false", "availability: .unavailable",
      "connectionState: .unavailable", "installState: .unavailable",
      "https://developer.amazon.com/en-US/docs/alexa/devconsole/test-and-submit-your-skill.html",
      "https://www.amazon.com/alexa",
    ] {
      try expect(apps.contains(expected), "Amazon Alexa source missing " + expected)
    }
    for forbidden in [
      "ALEXA_SKILL_ID", "ALEXA_ACCESS_TOKEN", "AMAZON_ALEXA_CLIENT_SECRET", "AMAZON_ALEXA_EMAIL",
      "AMAZON_ALEXA_PASSWORD", "saveAmazonAlexaRailwayConnection",
      "ApplicationsAmazonAlexaCredentialForm",
    ] {
      try expect(
        !apps.contains(forbidden), "Amazon Alexa preview must not collect or save " + forbidden)
    }
  }

  private static func testCalComApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let model = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let apps = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let connections = try readPackageFile(
      "Sources/RelayConsoleCore/ProviderConnectionService.swift")
    let policies = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let adapter = try readPackageFile("Sources/RelayConsoleCore/CalComProviderActionAdapter.swift")
    let runtime = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift")
    let source = [views, model, apps, connections, policies, adapter, runtime].joined(
      separator: "\n")
    for expected in [
      "ApplicationsCalComDetailPanel", "ApplicationsCalComAgentSwitchRow", "Agents with Cal.com",
      "Connect one exact Cal.com user", "No Cal.com OAuth connection", "setCalComAgentConnection",
      "selectCalComConnection", "deleteCalComOAuthConnection", "applications-cal-com-agent-switch",
      "calComSelectedConnectionId", "calComRelayOwnedOAuthScopes", "cal_com_oauth_access_token",
      "cal_com_oauth_refresh_token", "rotateCalComOAuthTokens", "relayOwnedCalComOAuth",
      "serialized-atomic-provider-returned-pair-replacement", "railway-https-only",
      "marketplace-logo-cal-com", "cal_com_booking_list", "cal_com_booking_get",
      "cal_com_event_type_get", "PROFILE_READ", "EVENT_TYPE_READ", "BOOKING_READ",
      "automaticPaginationAllowed", "privateSchedulingDataReturned", "cal-api-version",
    ] { try expect(source.contains(expected), "Cal.com source missing " + expected) }
    try expect(
      sourceContainsIgnoringWhitespace(
        model, containsIgnoringWhitespace: "\"calendly\", \"cal-com\""),
      "Cal.com should expose approval-gated read, read-only, and blocked presets")
    for forbidden in [
      "calendly_scheduled_event_list", "harvest_time_entry_list", "todoist_task_list",
      "smartsheet_sheet_list",
    ] {
      try expect(
        !adapter.contains(forbidden), "Cal.com adapter contains foreign action " + forbidden)
    }
    for forbidden in [
      "description", "hosts", "attendees", "guests", "location", "meetingUrl",
      "bookingFieldsResponses", "cancellationReason", "cancelledByEmail", "reschedulingReason",
      "metadata", "rating", "icsUid",
    ] {
      try expect(
        !adapter.contains("[\"" + forbidden + "\"]"),
        "Cal.com adapter should not access private scheduling surface " + forbidden)
    }
  }

  private static func testDocusignApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let model = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let apps = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let connections = try readPackageFile(
      "Sources/RelayConsoleCore/ProviderConnectionService.swift")
    let policies = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let adapter = try readPackageFile(
      "Sources/RelayConsoleCore/DocusignProviderActionAdapter.swift")
    let runtime = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift")
    let source = [views, model, apps, connections, policies, adapter, runtime].joined(
      separator: "\n")
    for expected in [
      "ApplicationsDocusignDetailPanel", "ApplicationsDocusignAgentSwitchRow",
      "Agents with Docusign", "Connect one exact Docusign user and select one account",
      "No Docusign OAuth connection", "setDocusignAgentConnection", "selectDocusignConnection",
      "deleteDocusignOAuthConnection", "applications-docusign-agent-switch",
      "docusignSelectedConnectionId", "docusignRelayOwnedOAuthScopes",
      "docusign_oauth_access_token", "docusign_oauth_refresh_token", "rotateDocusignOAuthTokens",
      "relayOwnedDocusignOAuth", "serialized-atomic-provider-returned-pair-replacement",
      "railway-https-only", "marketplace-logo-docusign", "docusign_envelope_list_recent",
      "docusign_envelope_list_action_required", "docusign_envelope_get", "signature", "extended",
      "accessTokenLifetimeSeconds", "exactResourcePollingMinimumSeconds",
      "automaticPaginationAllowed",
    ] { try expect(source.contains(expected), "Docusign source missing " + expected) }
    try expect(
      sourceContainsIgnoringWhitespace(
        model, containsIgnoringWhitespace: "\"cal-com\", \"docusign\""),
      "Docusign should expose approval-gated read, read-only, and blocked presets")
    for forbidden in [
      "cal_com_booking_list", "calendly_scheduled_event_list", "harvest_time_entry_list",
      "todoist_task_list",
    ] {
      try expect(
        !adapter.contains(forbidden), "Docusign adapter contains foreign action " + forbidden)
    }
    for forbidden in [
      "recipients", "sender", "documents", "tabs", "customFields", "emailBlurb", "voidedReason",
      "declinedReason", "auditEvents",
    ] {
      try expect(
        !adapter.contains("[\"" + forbidden + "\"]"),
        "Docusign adapter should not access private agreement surface " + forbidden)
    }
  }

  private static func testDropboxSignApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let model = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let apps = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let connections = try readPackageFile(
      "Sources/RelayConsoleCore/ProviderConnectionService.swift")
    let policies = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let adapter = try readPackageFile(
      "Sources/RelayConsoleCore/DropboxSignProviderActionAdapter.swift")
    let runtime = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift")
    let source = [views, model, apps, connections, policies, adapter, runtime].joined(
      separator: "\n")
    for expected in [
      "ApplicationsDropboxSignDetailPanel", "ApplicationsDropboxSignAgentSwitchRow",
      "Agents with Dropbox Sign", "Connect one exact Dropbox Sign account",
      "No Dropbox Sign OAuth connection", "setDropboxSignAgentConnection",
      "selectDropboxSignConnection", "deleteDropboxSignOAuthConnection",
      "applications-dropbox-sign-agent-switch", "dropboxSignSelectedConnectionId",
      "dropboxSignRelayOwnedOAuthScopes", "dropbox_sign_oauth_access_token",
      "dropbox_sign_oauth_refresh_token", "rotateDropboxSignOAuthTokens",
      "relayOwnedDropboxSignOAuth", "serialized-atomic-provider-returned-pair-replacement",
      "railway-https-only", "marketplace-logo-dropbox-sign", "dropbox_sign_signature_request_list",
      "dropbox_sign_signature_request_list_awaiting", "dropbox_sign_signature_request_get",
      "account_access", "signature_request_access", "providerExpiresInAuthoritative",
      "apiAppCreatedRequestsOnly", "automaticPaginationAllowed",
    ] { try expect(source.contains(expected), "Dropbox Sign source missing " + expected) }
    try expect(
      sourceContainsIgnoringWhitespace(
        model, containsIgnoringWhitespace: "\"docusign\", \"dropbox-sign\""),
      "Dropbox Sign should expose approval-gated read, read-only, and blocked presets")
    for forbidden in [
      "docusign_envelope_list_recent", "cal_com_booking_list", "calendly_scheduled_event_list",
      "harvest_time_entry_list",
    ] {
      try expect(
        !adapter.contains(forbidden), "Dropbox Sign adapter contains foreign action " + forbidden)
    }
    for forbidden in [
      "requester_email_address", "signer_email_address", "signer_name", "message", "metadata",
      "custom_fields", "response_data", "signing_url", "details_url",
    ] {
      try expect(
        !adapter.contains("[\"" + forbidden + "\"]"),
        "Dropbox Sign adapter should not access private agreement field " + forbidden)
    }
  }

  private static func testPandaDocApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let model = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let apps = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let connections = try readPackageFile(
      "Sources/RelayConsoleCore/ProviderConnectionService.swift")
    let policies = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let adapter = try readPackageFile(
      "Sources/RelayConsoleCore/PandaDocProviderActionAdapter.swift")
    let runtime = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift")
    let source = [views, model, apps, connections, policies, adapter, runtime].joined(
      separator: "\n")
    for expected in [
      "ApplicationsPandaDocDetailPanel", "ApplicationsPandaDocAgentSwitchRow",
      "Agents with PandaDoc", "Connect one exact PandaDoc membership",
      "No PandaDoc OAuth connection", "setPandaDocAgentConnection", "selectPandaDocConnection",
      "deletePandaDocOAuthConnection", "applications-pandadoc-agent-switch",
      "pandaDocSelectedConnectionId", "pandaDocRelayOwnedOAuthScopes",
      "pandadoc_oauth_access_token", "pandadoc_oauth_refresh_token", "rotatePandaDocOAuthTokens",
      "relayOwnedPandaDocOAuth", "serialized-atomic-provider-returned-pair-replacement",
      "railway-https-only", "marketplace-logo-pandadoc", "pandadoc_document_list_recent",
      "pandadoc_document_status_get", "pandadoc_document_folder_list", "accessTokenLifetimeSeconds",
      "detailsEndpointAllowed", "automaticPaginationAllowed",
    ] { try expect(source.contains(expected), "PandaDoc source missing " + expected) }
    try expect(
      sourceContainsIgnoringWhitespace(
        model, containsIgnoringWhitespace: "\"dropbox-sign\", \"pandadoc\""),
      "PandaDoc should expose approval-gated read, read-only, and blocked presets")
  }

  private static func testTypeformApplicationsControlsAreSourceBacked() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let model = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let apps = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let connections = try readPackageFile(
      "Sources/RelayConsoleCore/ProviderConnectionService.swift")
    let policies = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let adapter = try readPackageFile(
      "Sources/RelayConsoleCore/TypeformProviderActionAdapter.swift")
    let runtime = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift")
    let source = [views, model, apps, connections, policies, adapter, runtime].joined(
      separator: "\n")
    for expected in [
      "ApplicationsTypeformDetailPanel", "ApplicationsTypeformAgentSwitchRow",
      "Agents with Typeform", "Connect one exact Typeform account", "No Typeform OAuth connection",
      "setTypeformAgentConnection", "selectTypeformConnection", "deleteTypeformOAuthConnection",
      "applications-typeform-agent-switch", "typeformSelectedConnectionId",
      "typeformRelayOwnedOAuthScopes", "typeform_oauth_access_token",
      "typeform_oauth_refresh_token", "rotateTypeformOAuthTokens", "relayOwnedTypeformOAuth",
      "singleUseRefreshToken", "serialized-atomic-provider-returned-pair-replacement",
      "railway-https-only", "marketplace-logo-typeform", "typeform_form_list_recent",
      "typeform_form_get", "typeform_response_list_recent", "accountRateLimitRequestsPerSecond",
      "responseFreshnessCaveatMinutes", "automaticPaginationAllowed",
    ] { try expect(source.contains(expected), "Typeform source missing " + expected) }
    try expect(
      sourceContainsIgnoringWhitespace(
        model, containsIgnoringWhitespace: "\"pandadoc\", \"typeform\""),
      "Typeform should expose approval-gated read, read-only, and blocked presets")
  }

  private static func testSurveyMonkeyApplicationsControlsAreSourceBacked() throws {
    let source = try [
      "Sources/RelayConsoleApp/Views.swift", "Sources/RelayConsoleApp/AppViewModel.swift",
      "Sources/RelayConsoleCore/ApplicationsService.swift",
      "Sources/RelayConsoleCore/ProviderConnectionService.swift",
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift",
      "Sources/RelayConsoleCore/SurveyMonkeyProviderActionAdapter.swift",
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift",
    ].map(readPackageFile).joined(separator: "\n")
    for expected in [
      "ApplicationsSurveyMonkeyDetailPanel", "ApplicationsSurveyMonkeyAgentSwitchRow",
      "Agents with SurveyMonkey", "No SurveyMonkey OAuth connection",
      "setSurveyMonkeyAgentConnection", "selectSurveyMonkeyConnection",
      "deleteSurveyMonkeyOAuthConnection", "surveyMonkeyRelayOwnedOAuthScopes",
      "surveymonkey_oauth_access_token", "relayOwnedSurveyMonkeyOAuth",
      "accessTokenCurrentlyExpires", "refreshTokenDocumented", "marketplace-logo-surveymonkey",
      "surveymonkey_survey_list_recent", "surveymonkey_response_list", "surveymonkey_response_get",
      "responseDetailsScopeRequested", "rateLimitHeadersAuthoritative",
    ] { try expect(source.contains(expected), "SurveyMonkey source missing " + expected) }
  }
  private static func testFilloutApplicationsControlsAreSourceBacked() throws {
    let source = try [
      "Sources/RelayConsoleApp/Views.swift", "Sources/RelayConsoleApp/AppViewModel.swift",
      "Sources/RelayConsoleCore/ApplicationsService.swift",
      "Sources/RelayConsoleCore/ProviderConnectionService.swift",
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift",
      "Sources/RelayConsoleCore/FilloutProviderActionAdapter.swift",
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift",
    ].map(readPackageFile).joined(separator: "\n")
    for expected in [
      "ApplicationsFilloutDetailPanel", "ApplicationsFilloutAgentSwitchRow", "Agents with Fillout",
      "No Fillout OAuth connection", "setFilloutAgentConnection", "selectFilloutConnection",
      "deleteFilloutOAuthConnection", "filloutOAuthPermissions", "fillout_oauth_access_token",
      "relayOwnedFilloutOAuth", "accessTokenExpiryDocumented", "refreshTokenDocumented",
      "identityEndpointDocumented", "marketplace-logo-fillout", "fillout_form_list",
      "fillout_form_get_metadata_summary", "fillout_submission_list_recent",
      "submissionContentReturned", "rateLimitRequestsPerSecond",
    ] { try expect(source.contains(expected), "Fillout source missing " + expected) }
  }
  private static func testMailchimpApplicationsControlsAreSourceBacked() throws {
    let source = try [
      "Sources/RelayConsoleApp/Views.swift", "Sources/RelayConsoleApp/AppViewModel.swift",
      "Sources/RelayConsoleCore/ApplicationsService.swift",
      "Sources/RelayConsoleCore/ProviderConnectionService.swift",
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift",
      "Sources/RelayConsoleCore/MailchimpProviderActionAdapter.swift",
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift",
    ].map(readPackageFile).joined(separator: "\n")
    for expected in [
      "ApplicationsMailchimpDetailPanel", "ApplicationsMailchimpAgentSwitchRow",
      "Agents with Mailchimp", "No Mailchimp OAuth connection", "setMailchimpAgentConnection",
      "selectMailchimpConnection", "deleteMailchimpOAuthConnection", "mailchimpOAuthPermissions",
      "mailchimp_oauth_access_token", "relayOwnedMailchimpOAuth", "accessTokenExpires",
      "refreshTokenRequired", "authorizingRole", "marketplace-logo-mailchimp",
      "mailchimp_account_get", "mailchimp_audience_list", "mailchimp_campaign_list_recent_sent",
      "contactDataReturned", "simultaneousConnectionLimitPerUser",
    ] { try expect(source.contains(expected), "Mailchimp source missing " + expected) }
  }
  private static func testKlaviyoApplicationsControlsAreSourceBacked() throws {
    let source = try [
      "Sources/RelayConsoleApp/Views.swift", "Sources/RelayConsoleApp/AppViewModel.swift",
      "Sources/RelayConsoleCore/ApplicationsService.swift",
      "Sources/RelayConsoleCore/ProviderConnectionService.swift",
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift",
      "Sources/RelayConsoleCore/KlaviyoProviderActionAdapter.swift",
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift",
    ].map(readPackageFile).joined(separator: "\n")
    for expected in [
      "ApplicationsKlaviyoDetailPanel", "ApplicationsKlaviyoAgentSwitchRow", "Agents with Klaviyo",
      "No Klaviyo OAuth connection", "setKlaviyoAgentConnection", "selectKlaviyoConnection",
      "deleteKlaviyoOAuthConnection", "klaviyoRelayOwnedOAuthScopes", "klaviyo_oauth_access_token",
      "klaviyo_oauth_refresh_token", "rotateKlaviyoOAuthTokens", "relayOwnedKlaviyoOAuth",
      "pkceS256Required", "serialized-atomic-provider-returned-pair-replacement",
      "marketplace-logo-klaviyo", "klaviyo_account_get", "klaviyo_list_list_recent",
      "klaviyo_campaign_list_recent_email", "profileOrContactDataReturned", "apiRevision",
    ] { try expect(source.contains(expected), "Klaviyo source missing " + expected) }
  }
  private static func testConvertKitApplicationsControlsAreSourceBacked() throws {
    let source = try [
      "Sources/RelayConsoleApp/Views.swift", "Sources/RelayConsoleApp/AppViewModel.swift",
      "Sources/RelayConsoleCore/ApplicationsService.swift",
      "Sources/RelayConsoleCore/ProviderConnectionService.swift",
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift",
      "Sources/RelayConsoleCore/ConvertKitProviderActionAdapter.swift",
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift",
    ].map(readPackageFile).joined(separator: "\n")
    for expected in [
      "ApplicationsConvertKitDetailPanel", "ApplicationsConvertKitAgentSwitchRow",
      "Agents with Kit", "No Kit OAuth connection", "setConvertKitAgentConnection",
      "selectConvertKitConnection", "deleteConvertKitOAuthConnection",
      "convertKitRelayOwnedOAuthScopes", "convertkit_oauth_access_token",
      "convertkit_oauth_refresh_token", "rotateConvertKitOAuthTokens", "relayOwnedConvertKitOAuth",
      "serialized-atomic-provider-returned-pair-replacement", "marketplace-logo-convertkit",
      "convertkit_account_get", "convertkit_form_list_active", "convertkit_broadcast_list_recent",
      "subscriberDataReturned", "oauthRequestsPerRollingMinute",
    ] { try expect(source.contains(expected), "ConvertKit source missing " + expected) }
  }
  private static func testCampaignMonitorApplicationsControlsAreSourceBacked() throws {
    let source = try [
      "Sources/RelayConsoleApp/Views.swift", "Sources/RelayConsoleApp/AppViewModel.swift",
      "Sources/RelayConsoleCore/ApplicationsService.swift",
      "Sources/RelayConsoleCore/ProviderConnectionService.swift",
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift",
      "Sources/RelayConsoleCore/CampaignMonitorProviderActionAdapter.swift",
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift",
    ].map(readPackageFile).joined(separator: "\n")
    for expected in [
      "ApplicationsCampaignMonitorDetailPanel", "ApplicationsCampaignMonitorAgentSwitchRow",
      "Agents with Campaign Monitor", "No Campaign Monitor OAuth connection",
      "setCampaignMonitorAgentConnection", "selectCampaignMonitorConnection",
      "deleteCampaignMonitorOAuthConnection", "campaignMonitorRelayOwnedOAuthScopes",
      "campaign_monitor_oauth_access_token", "campaign_monitor_oauth_refresh_token",
      "rotateCampaignMonitorOAuthTokens", "relayOwnedCampaignMonitorOAuth",
      "serialized-atomic-provider-returned-pair-replacement", "marketplace-logo-campaign-monitor",
      "campaign_monitor_client_get", "campaign_monitor_campaign_list_recent_sent",
      "campaign_monitor_campaign_summary_get", "subscriberDrilldownsAllowed",
      "documentedAccessLifetimeSeconds",
    ] { try expect(source.contains(expected), "Campaign Monitor source missing " + expected) }
  }
  private static func testConstantContactApplicationsControlsAreSourceBacked() throws {
    let source = try [
      "Sources/RelayConsoleApp/Views.swift", "Sources/RelayConsoleApp/AppViewModel.swift",
      "Sources/RelayConsoleCore/ApplicationsService.swift",
      "Sources/RelayConsoleCore/ProviderConnectionService.swift",
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift",
      "Sources/RelayConsoleCore/ConstantContactProviderActionAdapter.swift",
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift",
    ].map(readPackageFile).joined(separator: "\n")
    for expected in [
      "ApplicationsConstantContactDetailPanel", "ApplicationsConstantContactAgentSwitchRow",
      "Agents with Constant Contact", "No Constant Contact OAuth connection",
      "setConstantContactAgentConnection", "selectConstantContactConnection",
      "deleteConstantContactOAuthConnection", "constantContactRelayOwnedOAuthScopes",
      "constantContactRequiredPrivileges", "constant_contact_oauth_access_token",
      "constant_contact_oauth_refresh_token", "rotateConstantContactOAuthTokens",
      "relayOwnedConstantContactOAuth", "serialized-atomic-provider-returned-pair-replacement",
      "marketplace-logo-constant-contact", "constant_contact_account_get",
      "constant_contact_campaign_list_recent", "constant_contact_campaign_summary_list_recent",
      "requiredPrivilegesVerified", "documentedAccessLifetimeSeconds",
      "unusedRefreshTokenMaximumAgeDays",
    ] { try expect(source.contains(expected), "Constant Contact source missing " + expected) }
  }

  private static func testPostHogOAuthApplicationsControlsAreSourceBacked() throws {
    let source = try [
      "Sources/RelayConsoleApp/Views.swift", "Sources/RelayConsoleApp/AppViewModel.swift",
      "Sources/RelayConsoleCore/ApplicationsService.swift",
      "Sources/RelayConsoleCore/ProviderConnectionService.swift",
      "Sources/RelayConsoleCore/MarketplaceProviderFoundationService.swift",
      "Sources/RelayConsoleCore/PostHogProviderActionAdapter.swift",
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift",
    ].map(readPackageFile).joined(separator: "\n")
    for expected in [
      "ApplicationsPostHogDetailPanel", "ApplicationsPostHogConnectionsCard",
      "ApplicationsPostHogAgentSwitchRow", "Connect PostHog", "No PostHog OAuth connection",
      "startPostHogOAuthConnect", "preparePostHogSession",
      "RELAY_POSTHOG_OAUTH_CLIENT_METADATA_URL", "posthog_oauth_access_token",
      "posthog_oauth_refresh_token", "savePostHogRelayOwnedOAuthConnection",
      "rotatePostHogOAuthTokens", "oauth2_authorization_code_pkce_cimd",
      "relay-owned-posthog-oauth-pkce-cimd", "postHogReadScopes", "posthog_projects_list",
      "posthog_query_bounded", "rawMCPExposure",
    ] {
      try expect(source.contains(expected), "PostHog OAuth source missing \(expected)")
    }
    try expect(
      !source.contains(
        "Relay-owned PostHog OAuth UI is ready, but the callback/token broker is not implemented"),
      "PostHog UI still contains the stale ROO-004 placeholder")
  }

  private static func testSentryOAuthApplicationsControlsAreSourceBacked() throws {
    let source = try [
      "Sources/RelayConsoleApp/Views.swift", "Sources/RelayConsoleApp/AppViewModel.swift",
      "Sources/RelayConsoleCore/ApplicationsService.swift",
      "Sources/RelayConsoleCore/ProviderConnectionService.swift",
      "Sources/RelayConsoleCore/MarketplaceProviderFoundationService.swift",
      "Sources/RelayConsoleCore/SentryProviderActionAdapter.swift",
    ].map(readPackageFile).joined(separator: "\n")
    for expected in [
      "ApplicationsSentryConnectionsCard", "Connect Sentry", "No Sentry OAuth connection",
      "startSentryOAuthConnect", "RELAY_SENTRY_OAUTH_CLIENT_ID", "oauth/device/code",
      "sentry_oauth_access_token", "sentry_oauth_refresh_token", "connectSentryRelayOwnedOAuth",
      "rotateSentryOAuthTokens", "oauth2_device_authorization_rotating_pair",
      "relay-owned-sentry-device-oauth", "sentry_update_issue", "Direct writes",
    ] { try expect(source.contains(expected), "Sentry OAuth source missing \(expected)") }
  }

  private static func testDatadogOAuthApplicationsControlsAreSourceBacked() throws {
    let source = try [
      "Sources/RelayConsoleApp/Views.swift", "Sources/RelayConsoleApp/AppViewModel.swift",
      "Sources/RelayConsoleCore/ApplicationsService.swift",
      "Sources/RelayConsoleCore/ProviderConnectionService.swift",
      "Sources/RelayConsoleCore/MarketplaceProviderFoundationService.swift",
      "Sources/RelayConsoleCore/DatadogProviderActionAdapter.swift",
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift",
    ].map(readPackageFile).joined(separator: "\n")
    for expected in [
      "ApplicationsDatadogDetailPanel", "ApplicationsDatadogAgentSwitchRow", "Connect Datadog",
      "No Datadog OAuth connection", "startDatadogOAuthConnect", "CLAWCHAT_RAILWAY_ORIGIN",
      "RELAY_DATADOG_OAUTH_CLIENT_ID", "datadog_oauth_access_token", "datadog_oauth_refresh_token",
      "saveDatadogRelayOwnedOAuthConnection", "rotateDatadogOAuthTokens",
      "oauth2_authorization_code_pkce_confidential_hosted_broker",
      "relay-owned-datadog-oauth-pkce-confidential-hosted", "monitors_read", "incident_read",
      "apm_service_catalog_read", "datadog_search_monitors", "datadog_search_incidents",
      "datadog_list_services", "secure-railway-broker-only", "allowedAPIOrigins",
      "Read-only Datadog observability",
    ] { try expect(source.contains(expected), "Datadog OAuth source missing \(expected)") }
    try expect(
      !source.contains("NEXT_PUBLIC_DATADOG_CLIENT_SECRET"),
      "Datadog desktop source must not accept a public client secret")
  }

  private static func testPagerDutyOAuthApplicationsControlsAreSourceBacked() throws {
    let source = try [
      "Sources/RelayConsoleApp/Views.swift", "Sources/RelayConsoleApp/AppViewModel.swift",
      "Sources/RelayConsoleCore/ApplicationsService.swift",
      "Sources/RelayConsoleCore/ProviderConnectionService.swift",
      "Sources/RelayConsoleCore/MarketplaceProviderFoundationService.swift",
      "Sources/RelayConsoleCore/PagerDutyProviderActionAdapter.swift",
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift",
    ].map(readPackageFile).joined(separator: "\n")
    for expected in [
      "ApplicationsPagerDutyDetailPanel", "ApplicationsPagerDutyAgentSwitchRow",
      "Connect PagerDuty", "No PagerDuty OAuth connection", "startPagerDutyOAuthConnect",
      "CLAWCHAT_RAILWAY_ORIGIN", "RELAY_PAGERDUTY_OAUTH_CLIENT_ID", "pagerduty_oauth_access_token",
      "pagerduty_oauth_refresh_token", "savePagerDutyRelayOwnedOAuthConnection",
      "rotatePagerDutyOAuthTokens", "oauth2_scoped_authorization_code_confidential_hosted_broker",
      "relay-owned-pagerduty-scoped-oauth-confidential-hosted", "openid", "incidents.read",
      "services.read", "as_account-", "pagerduty_incident_list", "pagerduty_incident_get",
      "pagerduty_service_list", "secure-railway-broker-only", "allowedAPIOrigins",
      "Read-only PagerDuty incidents and services",
    ] { try expect(source.contains(expected), "PagerDuty OAuth source missing \(expected)") }
    try expect(
      !source.contains("NEXT_PUBLIC_PAGERDUTY_CLIENT_SECRET"),
      "PagerDuty desktop source must not accept a public client secret")
  }

  private static func testCloudflareOAuthApplicationsControlsAreSourceBacked() throws {
    let source = try [
      "Sources/RelayConsoleApp/Views.swift", "Sources/RelayConsoleApp/AppViewModel.swift",
      "Sources/RelayConsoleCore/ApplicationsService.swift",
      "Sources/RelayConsoleCore/ProviderConnectionService.swift",
      "Sources/RelayConsoleCore/MarketplaceProviderFoundationService.swift",
      "Sources/RelayConsoleCore/CloudflareProviderActionAdapter.swift",
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift",
    ].map(readPackageFile).joined(separator: "\n")
    for expected in [
      "ApplicationsCloudflareDetailPanel", "ApplicationsCloudflareAgentSwitchRow",
      "Connect Cloudflare", "No Cloudflare OAuth connection", "startCloudflareOAuthConnect",
      "CLAWCHAT_RAILWAY_ORIGIN", "RELAY_CLOUDFLARE_OAUTH_CLIENT_ID",
      "cloudflare_oauth_access_token", "cloudflare_oauth_refresh_token",
      "saveCloudflareRelayOwnedOAuthConnection", "rotateCloudflareOAuthTokens",
      "oauth2_authorization_code_s256_confidential_hosted_broker",
      "relay-owned-cloudflare-oauth-s256-confidential-hosted", "zone.read", "analytics.read",
      "offline_access", "cloudflare_zone_list", "cloudflare_zone_get",
      "cloudflare_zone_traffic_overview", "secure-railway-broker-only", "apiOrigin",
      "Read-only Cloudflare zones and aggregate traffic",
    ] { try expect(source.contains(expected), "Cloudflare OAuth source missing \(expected)") }
    try expect(
      !source.contains("NEXT_PUBLIC_CLOUDFLARE_CLIENT_SECRET"),
      "Cloudflare desktop source must not accept a public client secret")
  }

  private static func testVercelIntegrationApplicationsControlsAreSourceBacked() throws {
    let source = try [
      "Sources/RelayConsoleApp/Views.swift", "Sources/RelayConsoleApp/AppViewModel.swift",
      "Sources/RelayConsoleCore/ApplicationsService.swift",
      "Sources/RelayConsoleCore/ProviderConnectionService.swift",
      "Sources/RelayConsoleCore/MarketplaceProviderFoundationService.swift",
      "Sources/RelayConsoleCore/VercelProviderActionAdapter.swift",
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift",
    ].map(readPackageFile).joined(separator: "\n")
    for expected in [
      "ApplicationsVercelDetailPanel", "ApplicationsVercelAgentSwitchRow", "Connect Vercel",
      "No Vercel integration connection", "startVercelIntegrationConnect",
      "RELAY_VERCEL_INTEGRATION_CLIENT_ID", "vercel_integration_access_token",
      "saveVercelIntegrationConnection",
      "integration_authorization_code_confidential_one_time_exchange", "project:read",
      "deployment:read", "vercel_project_list", "vercel_project_get", "vercel_deployment_list",
      "secure-railway-broker-only", "Read-only Vercel projects and deployments",
    ] { try expect(source.contains(expected), "Vercel source missing \(expected)") }
    try expect(
      !source.contains("NEXT_PUBLIC_VERCEL_INTEGRATION_SECRET"),
      "Vercel desktop source must not accept public integration secret")
  }
  private static func testHerokuOAuthApplicationsControlsAreSourceBacked() throws {
    let source = try [
      "Sources/RelayConsoleApp/Views.swift", "Sources/RelayConsoleApp/AppViewModel.swift",
      "Sources/RelayConsoleCore/ApplicationsService.swift",
      "Sources/RelayConsoleCore/ProviderConnectionService.swift",
      "Sources/RelayConsoleCore/MarketplaceProviderFoundationService.swift",
      "Sources/RelayConsoleCore/HerokuProviderActionAdapter.swift",
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift",
    ].map(readPackageFile).joined(separator: "\n")
    for expected in [
      "ApplicationsHerokuDetailPanel", "ApplicationsHerokuAgentSwitchRow", "Connect Heroku",
      "No Heroku OAuth connection", "startHerokuOAuthConnect", "RELAY_HEROKU_OAUTH_CLIENT_ID",
      "heroku_oauth_access_token", "heroku_oauth_refresh_token",
      "saveHerokuRelayOwnedOAuthConnection",
      "serialized-complete-provider-returned-pair-replacement", "heroku_team_app_list",
      "heroku_app_release_list", "heroku_app_dyno_list", "secure-railway-broker-only",
      "Read-only Heroku Apps, Releases, and Dynos",
    ] { try expect(source.contains(expected), "Heroku source missing \(expected)") }
    try expect(
      !source.contains("NEXT_PUBLIC_HEROKU_OAUTH_CLIENT_SECRET"),
      "Heroku desktop source must not accept public OAuth secret")
  }
  private static func testDigitalOceanOAuthApplicationsControlsAreSourceBacked() throws {
    let source = try [
      "Sources/RelayConsoleApp/Views.swift", "Sources/RelayConsoleApp/AppViewModel.swift",
      "Sources/RelayConsoleCore/ApplicationsService.swift",
      "Sources/RelayConsoleCore/ProviderConnectionService.swift",
      "Sources/RelayConsoleCore/MarketplaceProviderFoundationService.swift",
      "Sources/RelayConsoleCore/DigitalOceanProviderActionAdapter.swift",
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift",
    ].map(readPackageFile).joined(separator: "\n")
    for expected in [
      "ApplicationsDigitalOceanDetailPanel", "ApplicationsDigitalOceanAgentSwitchRow",
      "Connect DigitalOcean", "No DigitalOcean OAuth connection", "startDigitalOceanOAuthConnect",
      "RELAY_DIGITALOCEAN_OAUTH_CLIENT_ID", "digitalocean_oauth_access_token",
      "digitalocean_oauth_refresh_token", "saveDigitalOceanRelayOwnedOAuthConnection", "single-use",
      "digitalocean_project_list", "digitalocean_project_get", "digitalocean_project_resource_list",
      "digitalocean_selected_resource_get", "projectMembershipVerified",
      "secure-railway-broker-only", "Read-only DigitalOcean Project and verified resource",
    ] { try expect(source.contains(expected), "DigitalOcean source missing \(expected)") }
    try expect(
      !source.contains("NEXT_PUBLIC_DIGITALOCEAN_OAUTH_CLIENT_SECRET"),
      "DigitalOcean desktop source must not accept public OAuth secret")
  }
  private static func testSupabaseOAuthApplicationsControlsAreSourceBacked() throws {
    let source = try [
      "Sources/RelayConsoleApp/Views.swift", "Sources/RelayConsoleApp/AppViewModel.swift",
      "Sources/RelayConsoleCore/ApplicationsService.swift",
      "Sources/RelayConsoleCore/ProviderConnectionService.swift",
      "Sources/RelayConsoleCore/MarketplaceProviderFoundationService.swift",
      "Sources/RelayConsoleCore/SupabaseProviderActionAdapter.swift",
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift",
    ].map(readPackageFile).joined(separator: "\n")
    for expected in [
      "ApplicationsSupabaseDetailPanel", "ApplicationsSupabaseAgentSwitchRow", "Connect Supabase",
      "No Supabase OAuth connection", "startSupabaseOAuthConnect", "RELAY_SUPABASE_OAUTH_CLIENT_ID",
      "organizations:read", "projects:read", "supabase_oauth_access_token",
      "supabase_oauth_refresh_token", "saveSupabaseRelayOwnedOAuthConnection",
      "rotateSupabaseOAuthTokens", "supabase_organization_get",
      "supabase_organization_project_list", "supabase_project_get", "automaticPagination",
      "secure-railway-broker-only", "Read-only Supabase Organization and Project inventory",
      "marketplace-logo-supabase",
    ] { try expect(source.contains(expected), "Supabase source missing \(expected)") }
    for forbidden in [
      "NEXT_PUBLIC_SUPABASE_OAUTH_CLIENT_SECRET", "SUPABASE_SERVICE_ROLE_KEY",
      "SUPABASE_DB_PASSWORD",
    ] {
      try expect(
        !source.contains(forbidden), "Supabase desktop source must not accept \(forbidden)")
    }
  }
  private static func testOktaOINApplicationsControlsAreSourceBacked() throws {
    let source = try [
      "Sources/RelayConsoleApp/Views.swift", "Sources/RelayConsoleApp/AppViewModel.swift",
      "Sources/RelayConsoleCore/ApplicationsService.swift",
      "Sources/RelayConsoleCore/ProviderConnectionService.swift",
      "Sources/RelayConsoleCore/MarketplaceProviderFoundationService.swift",
      "Sources/RelayConsoleCore/OktaProviderActionAdapter.swift",
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift",
    ].map(readPackageFile).joined(separator: "\n")
    for expected in [
      "ApplicationsOktaDetailPanel", "ApplicationsOktaAgentSwitchRow", "Connect Okta",
      "No Okta OIN connection", "saveOktaOINConnection", "okta.apps.read", "okta_oin_client_secret",
      "okta_oin_client_id", "okta_application_list", "okta_application_get",
      "okta_application_group_list", "accessTokenPersistence", "automaticPagination",
      "Read-only Okta Application and assigned-Group inventory", "marketplace-logo-okta",
    ] { try expect(source.contains(expected), "Okta source missing \(expected)") }
    for forbidden in ["NEXT_PUBLIC_OKTA_CLIENT_SECRET", "OKTA_API_TOKEN", "SSWS"] {
      try expect(!source.contains(forbidden), "Okta desktop source must not accept \(forbidden)")
    }
  }
  private static func testBambooHROAuthApplicationsControlsAreSourceBacked() throws {
    let source = try [
      "Sources/RelayConsoleApp/Views.swift", "Sources/RelayConsoleApp/AppViewModel.swift",
      "Sources/RelayConsoleCore/ApplicationsService.swift",
      "Sources/RelayConsoleCore/ProviderConnectionService.swift",
      "Sources/RelayConsoleCore/MarketplaceProviderFoundationService.swift",
      "Sources/RelayConsoleCore/BambooHRProviderActionAdapter.swift",
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift",
    ].map(readPackageFile).joined(separator: "\n")
    for expected in [
      "ApplicationsBambooHRDetailPanel", "ApplicationsBambooHRAgentSwitchRow", "Connect BambooHR",
      "No BambooHR OAuth connection", "startBambooHROAuthConnect", "RELAY_BAMBOOHR_OAUTH_CLIENT_ID",
      "field", "offline_access", "bamboohr_oauth_access_token", "bamboohr_oauth_refresh_token",
      "bamboohr_location_list", "bamboohr_location_get", "bamboohr_country_list",
      "employeeDataReturned", "addressDetailsReturned", "marketplace-logo-bamboohr",
    ] { try expect(source.contains(expected), "BambooHR source missing \(expected)") }
    for forbidden in ["NEXT_PUBLIC_BAMBOOHR_CLIENT_SECRET", "BAMBOOHR_API_KEY"] {
      try expect(
        !source.contains(forbidden), "BambooHR desktop source must not accept \(forbidden)")
    }
  }

  private static func testZohoPeopleApplicationsControlsAreSourceBacked() throws {
    let source =
      try readPackageFile("Sources/RelayConsoleApp/Views.swift")
      + readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    for expected in [
      "zoho-people", "Zoho People", "organization-structure-observer", "zoho_people_structure_list",
      "zoho_people_structure_get",
      "employee-leave-attendance-compensation-files-forms-descriptions-writes-pagination-export-raw-excluded",
      "marketplace-logo-zoho",
    ] {
      try expect(
        source.contains(expected), "Zoho People bundled source contract missing \(expected)")
    }
    for forbidden in [
      "Zoho People account password", "Zoho People local backend", "ZOHO_PEOPLE_CLIENT_SECRET",
    ] {
      try expect(
        !source.contains(forbidden), "Zoho People bundled client source must exclude \(forbidden)")
    }
  }
  private static func testZohoCampaignsApplicationsControlsAreSourceBacked() throws {
    let source =
      try readPackageFile("Sources/RelayConsoleApp/Views.swift")
      + readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    for expected in [
      "zoho-campaigns", "Zoho Campaigns", "campaign-performance-observer",
      "zoho_campaigns_campaign_list", "zoho_campaigns_campaign_report",
      "contacts-recipients-sender-addresses-subjects-content-location-writes-pagination-export-raw-excluded",
      "marketplace-logo-zoho",
    ] {
      try expect(
        source.contains(expected), "Zoho Campaigns bundled source contract missing \(expected)")
    }
    for forbidden in [
      "Zoho Campaigns account password", "Zoho Campaigns local backend",
      "ZOHO_CAMPAIGNS_CLIENT_SECRET",
    ] {
      try expect(
        !source.contains(forbidden),
        "Zoho Campaigns bundled client source must exclude \(forbidden)")
    }
  }
  private static func testZohoAnalyticsApplicationsControlsAreSourceBacked() throws {
    let source =
      try readPackageFile("Sources/RelayConsoleApp/Views.swift")
      + readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    for expected in [
      "zoho-analytics", "Zoho Analytics", "analytics-metadata-observer",
      "zoho_analytics_workspace_list", "zoho_analytics_view_list",
      "rows-columns-descriptions-creators-users-exports-embeds-writes-pagination-raw-excluded",
      "marketplace-logo-zoho",
    ] {
      try expect(
        source.contains(expected), "Zoho Analytics bundled source contract missing \(expected)")
    }
    for forbidden in [
      "Zoho Analytics account password", "Zoho Analytics local backend",
      "ZOHO_ANALYTICS_CLIENT_SECRET",
    ] {
      try expect(
        !source.contains(forbidden),
        "Zoho Analytics bundled client source must exclude \(forbidden)")
    }
  }
  private static func testFreshserviceApplicationsControlsAreSourceBacked() throws {
    let source =
      try readPackageFile("Sources/RelayConsoleApp/Views.swift")
      + readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    for expected in [
      "freshservice", "Freshservice", "service-desk-operator", "freshservice_ticket_list",
      "freshservice_ticket_get", "freshservice_full_api",
      "requester-conversations-attachments-descriptions-custom-fields-excluded-from-bounded-tools",
      "marketplace-logo-freshdesk",
    ] {
      try expect(
        source.contains(expected), "Freshservice bundled source contract missing \(expected)")
    }
    for forbidden in [
      "Freshservice account password", "Freshservice local backend", "FRESHSERVICE_API_KEY",
    ] {
      try expect(
        !source.contains(forbidden), "Freshservice bundled client source must exclude \(forbidden)")
    }
  }
  private static func testFreshchatApplicationsControlsAreSourceBacked() throws {
    let source =
      try readPackageFile("Sources/RelayConsoleApp/Views.swift")
      + readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    for expected in [
      "freshchat", "Freshchat", "conversation-operations-operator", "freshchat_conversation_get",
      "freshchat_message_list", "freshchat_full_api",
      "message-content-reply-parts-attachments-users-contacts-custom-properties-excluded-from-bounded-tools",
      "marketplace-logo-freshdesk",
    ] {
      try expect(source.contains(expected), "Freshchat bundled source contract missing \(expected)")
    }
    for forbidden in ["Freshchat account password", "Freshchat local backend", "FRESHCHAT_API_KEY"]
    {
      try expect(
        !source.contains(forbidden), "Freshchat bundled client source must exclude \(forbidden)")
    }
  }
  private static func testFreshmarketerApplicationsControlsAreSourceBacked() throws {
    let source =
      try readPackageFile("Sources/RelayConsoleApp/Views.swift")
      + readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    for expected in [
      "freshmarketer", "Freshmarketer", "marketing-operations-operator",
      "freshmarketer_filter_list", "freshmarketer_contact_metadata_list", "freshmarketer_full_api",
      "names-emails-phones-addresses-custom-fields-accounts-owners-activities-notes-content-excluded-from-bounded-tools",
      "marketplace-logo-freshdesk",
    ] {
      try expect(
        source.contains(expected), "Freshmarketer bundled source contract missing \(expected)")
    }
    for forbidden in [
      "Freshmarketer account password", "Freshmarketer local backend", "FRESHMARKETER_API_KEY",
    ] {
      try expect(
        !source.contains(forbidden), "Freshmarketer bundled client source must exclude \(forbidden)"
      )
    }
  }
  private static func testFreshcallerApplicationsControlsAreSourceBacked() throws {
    let source =
      try readPackageFile("Sources/RelayConsoleApp/Views.swift")
      + readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    for expected in [
      "freshcaller", "Freshcaller", "call-operations-operator", "freshcaller_call_metric_list",
      "freshcaller_call_metric_get", "freshcaller_full_api",
      "phone-numbers-participants-recordings-agents-teams-tags-lifecycle-integrations-exports-excluded-from-bounded-tools",
      "marketplace-logo-freshdesk",
    ] {
      try expect(
        source.contains(expected), "Freshcaller bundled source contract missing \(expected)")
    }
    for forbidden in [
      "Freshcaller account password", "Freshcaller local backend", "FRESHCALLER_API_KEY",
    ] {
      try expect(
        !source.contains(forbidden), "Freshcaller bundled client source must exclude \(forbidden)")
    }
  }
  private static func testLiveChatApplicationsControlsAreSourceBacked() throws {
    let source =
      try readPackageFile("Sources/RelayConsoleApp/Views.swift")
      + readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    for expected in [
      "livechat", "LiveChat", "chat-operations-operator", "livechat_chat_list", "livechat_chat_get",
      "livechat_full_api",
      "messages-events-customers-agents-emails-session-fields-visits-properties-tags-attachments-excluded-from-bounded-tools",
      "marketplace-logo-intercom",
    ] {
      try expect(source.contains(expected), "LiveChat bundled source contract missing \(expected)")
    }
    for forbidden in [
      "LiveChat account password", "LiveChat local backend", "LIVECHAT_PERSONAL_ACCESS_TOKEN",
    ] {
      try expect(
        !source.contains(forbidden), "LiveChat bundled client source must exclude \(forbidden)")
    }
  }
  private static func testLiveAgentApplicationsControlsAreSourceBacked() throws {
    let source =
      try readPackageFile("Sources/RelayConsoleApp/Views.swift")
      + readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    for expected in [
      "liveagent", "LiveAgent", "support-operations-operator", "liveagent_ticket_list",
      "liveagent_ticket_get", "liveagent_full_api",
      "subjects-messages-notes-contacts-names-emails-phones-custom-fields-tags-attachments-raw-excluded-from-bounded-tools",
      "marketplace-logo-intercom",
    ] {
      try expect(source.contains(expected), "LiveAgent bundled source contract missing \(expected)")
    }
    for forbidden in ["LiveAgent account password", "LiveAgent local backend", "LIVEAGENT_API_KEY"]
    {
      try expect(
        !source.contains(forbidden), "LiveAgent bundled client source must exclude \(forbidden)")
    }
  }
  private static func testCrispApplicationsControlsAreSourceBacked() throws {
    let source =
      try readPackageFile("Sources/RelayConsoleApp/Views.swift")
      + readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    for expected in [
      "crisp", "Crisp", "conversation-operations-operator", "crisp_conversation_list",
      "crisp_conversation_state_get", "crisp_full_api",
      "messages-previews-topics-people-customers-contacts-device-location-compose-participants-mentions-segments-attachments-excluded-from-bounded-tools",
      "marketplace-logo-intercom",
    ] { try expect(source.contains(expected), "Crisp bundled source contract missing \(expected)") }
    for forbidden in ["Crisp account password", "Crisp local backend", "CRISP_TOKEN_KEY"] {
      try expect(
        !source.contains(forbidden), "Crisp bundled client source must exclude \(forbidden)")
    }
  }
  private static func testTidioApplicationsControlsAreSourceBacked() throws {
    let source =
      try readPackageFile("Sources/RelayConsoleApp/Views.swift")
      + readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    for expected in [
      "tidio", "Tidio", "ticket-operations-operator", "tidio_ticket_list", "tidio_ticket_get",
      "tidio_full_api",
      "subjects-messages-notes-contacts-names-emails-phones-custom-fields-tags-raw-excluded-from-bounded-tools",
      "marketplace-logo-intercom",
    ] { try expect(source.contains(expected), "Tidio bundled source contract missing \(expected)") }
    for forbidden in [
      "Tidio account password", "Tidio local backend", "TIDIO_OPENAPI_CLIENT_SECRET",
    ] {
      try expect(
        !source.contains(forbidden), "Tidio bundled client source must exclude \(forbidden)")
    }
  }
  private static func testOlarkApplicationsControlsAreSourceBacked() throws {
    let source =
      try readPackageFile("Sources/RelayConsoleApp/Views.swift")
      + readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    for expected in [
      "olark", "Olark", "transcript-operations-observer", "olark_transcript_project",
      "messages-notes-visitors-contacts-navigation-custom-fields-tag-values-groups-operators-raw-excluded",
      "marketplace-logo-intercom",
    ] { try expect(source.contains(expected), "Olark bundled source contract missing \(expected)") }
    for forbidden in [
      "Olark account password", "Olark local backend", "OLARK_RELAY_WEBHOOK_SECRET",
    ] {
      try expect(
        !source.contains(forbidden), "Olark bundled client source must exclude \(forbidden)")
    }
  }
  private static func testUserlikeApplicationsControlsAreSourceBacked() throws {
    let source =
      try readPackageFile("Sources/RelayConsoleApp/Views.swift")
      + readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    for expected in [
      "userlike", "Userlike", "conversation-operations-operator", "userlike_conversation_list",
      "userlike_conversation_get", "userlike_full_api",
      "messages-notes-contacts-names-emails-phones-topics-ratings-surveys-navigation-custom-fields-raw-excluded",
      "marketplace-logo-intercom",
    ] {
      try expect(source.contains(expected), "Userlike bundled source contract missing \(expected)")
    }
    for forbidden in [
      "Userlike account password", "Userlike local backend", "USERLIKE_ORGANIZATION_TOKEN",
    ] {
      try expect(
        !source.contains(forbidden), "Userlike bundled client source must exclude \(forbidden)")
    }
  }
  private static func testGladlyApplicationsControlsAreSourceBacked() throws {
    let source =
      try readPackageFile("Sources/RelayConsoleApp/Views.swift")
      + readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    for expected in [
      "gladly", "Gladly", "support-schedule-operator", "gladly_business_hours_list",
      "gladly_business_hours_get", "gladly_full_api",
      "names-schedule-blocks-exception-details-agents-customers-conversations-messages-contacts-raw-excluded-from-bounded-tools",
      "marketplace-logo-intercom",
    ] {
      try expect(source.contains(expected), "Gladly bundled source contract missing \(expected)")
    }
    for forbidden in [
      "Gladly account password", "Gladly local backend", "GLADLY_API_TOKEN", "GLADLY_AGENT_EMAIL",
    ] {
      try expect(
        !source.contains(forbidden), "Gladly bundled client source must exclude \(forbidden)")
    }
  }
  private static func testKustomerApplicationsControlsAreSourceBacked() throws {
    let source =
      try readPackageFile("Sources/RelayConsoleApp/Views.swift")
      + readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    for expected in [
      "kustomer", "Kustomer", "conversation-operations-operator", "kustomer_conversation_list",
      "kustomer_conversation_get", "kustomer_full_api",
      "names-previews-customers-messages-notes-satisfaction-tags-custom-fields-relationships-raw-excluded-from-bounded-tools",
      "marketplace-logo-intercom",
    ] {
      try expect(source.contains(expected), "Kustomer bundled source contract missing \(expected)")
    }
    for forbidden in ["Kustomer account password", "Kustomer local backend", "KUSTOMER_API_KEY"] {
      try expect(
        !source.contains(forbidden), "Kustomer bundled client source must exclude \(forbidden)")
    }
  }
  private static func testGorgiasApplicationsControlsAreSourceBacked() throws {
    let source =
      try readPackageFile("Sources/RelayConsoleApp/Views.swift")
      + readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    for expected in [
      "gorgias", "Gorgias", "ticket-operations-operator", "gorgias_ticket_list",
      "gorgias_ticket_get", "gorgias_full_api",
      "subjects-summaries-customers-messages-source-addresses-assignees-tags-satisfaction-custom-fields-metadata-events-raw-excluded-from-bounded-tools",
      "marketplace-logo-intercom",
    ] {
      try expect(source.contains(expected), "Gorgias bundled source contract missing \(expected)")
    }
    for forbidden in [
      "Gorgias account password", "Gorgias local backend", "GORGIAS_API_KEY", "GORGIAS_USERNAME",
    ] {
      try expect(
        !source.contains(forbidden), "Gorgias bundled client source must exclude \(forbidden)")
    }
  }
  private static func testReAmazeApplicationsControlsAreSourceBacked() throws {
    let source =
      try readPackageFile("Sources/RelayConsoleApp/Views.swift")
      + readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    for expected in [
      "re-amaze", "Re:amaze", "conversation-operations-operator", "reamaze_conversation_list",
      "reamaze_conversation_get", "reamaze_full_api",
      "subjects-message-bodies-authors-emails-assignees-followers-tags-channel-names-addresses-custom-data-raw-excluded-from-bounded-tools",
      "marketplace-logo-intercom",
    ] {
      try expect(source.contains(expected), "Re:amaze bundled source contract missing \(expected)")
    }
    for forbidden in [
      "Re:amaze account password", "Re:amaze local backend", "REAMAZE_API_TOKEN",
      "REAMAZE_LOGIN_EMAIL",
    ] {
      try expect(
        !source.contains(forbidden), "Re:amaze bundled client source must exclude \(forbidden)")
    }
  }
  private static func testEDeskApplicationsControlsAreSourceBacked() throws {
    let source =
      try readPackageFile("Sources/RelayConsoleApp/Views.swift")
      + readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    for expected in [
      "edesk", "eDesk", "ticket-operations-operator", "edesk_ticket_list", "edesk_ticket_get",
      "edesk_full_api",
      "subjects-messages-contacts-customer-identities-channels-sales-orders-tags-owners-custom-fields-raw-excluded-from-bounded-tools",
      "marketplace-logo-intercom",
    ] { try expect(source.contains(expected), "eDesk bundled source contract missing \(expected)") }
    for forbidden in ["eDesk account password", "eDesk local backend", "EDESK_API_TOKEN"] {
      try expect(
        !source.contains(forbidden), "eDesk bundled client source must exclude \(forbidden)")
    }
  }
  private static func testKayakoApplicationsControlsAreSourceBacked() throws {
    let source =
      try readPackageFile("Sources/RelayConsoleApp/Views.swift")
      + readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    for expected in [
      "kayako", "Kayako", "case-operations-operator", "kayako_case_list", "kayako_case_get",
      "kayako_full_api",
      "subjects-requester-creator-identities-posts-messages-channels-teams-agents-tags-forms-custom-fields-ratings-raw-excluded-from-bounded-tools",
      "marketplace-logo-intercom",
    ] {
      try expect(source.contains(expected), "Kayako bundled source contract missing \(expected)")
    }
    for forbidden in ["Kayako account password", "Kayako local backend", "KAYAKO_ACCESS_TOKEN"] {
      try expect(
        !source.contains(forbidden), "Kayako bundled client source must exclude \(forbidden)")
    }
  }
  private static func testAcquireApplicationsControlsAreSourceBacked() throws {
    let source =
      try readPackageFile("Sources/RelayConsoleApp/Views.swift")
      + readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    for expected in [
      "acquire", "Acquire", "case-operations-operator", "acquire_case_list", "acquire_case_get",
      "acquire_full_api",
      "titles-descriptions-contacts-users-messages-fields-tags-feedback-timeline-visits-device-data-metadata-raw-excluded-from-bounded-tools",
      "marketplace-logo-intercom",
    ] {
      try expect(source.contains(expected), "Acquire bundled source contract missing \(expected)")
    }
    for forbidden in ["Acquire account password", "Acquire local backend", "ACQUIRE_API_KEY"] {
      try expect(
        !source.contains(forbidden), "Acquire bundled client source must exclude \(forbidden)")
    }
  }
  private static func testGreenhouseOAuthApplicationsControlsAreSourceBacked() throws {
    let source = try [
      "Sources/RelayConsoleApp/Views.swift", "Sources/RelayConsoleApp/AppViewModel.swift",
      "Sources/RelayConsoleCore/ApplicationsService.swift",
      "Sources/RelayConsoleCore/ProviderConnectionService.swift",
      "Sources/RelayConsoleCore/MarketplaceProviderFoundationService.swift",
      "Sources/RelayConsoleCore/GreenhouseProviderActionAdapter.swift",
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift",
    ].map(readPackageFile).joined(separator: "\n")
    for expected in [
      "ApplicationsGreenhouseDetailPanel", "ApplicationsGreenhouseAgentSwitchRow",
      "Connect Greenhouse", "No Greenhouse OAuth connection", "startGreenhouseOAuthConnect",
      "RELAY_GREENHOUSE_OAUTH_CLIENT_ID", "harvest:jobs:list", "harvest:offices:list",
      "harvest:departments:list", "greenhouse_oauth_access_token", "greenhouse_oauth_refresh_token",
      "greenhouse_job_list", "greenhouse_office_list", "greenhouse_department_list",
      "candidateDataReturned", "automaticPagination", "marketplace-logo-greenhouse",
    ] { try expect(source.contains(expected), "Greenhouse source missing \(expected)") }
    for forbidden in ["NEXT_PUBLIC_GREENHOUSE_CLIENT_SECRET", "GREENHOUSE_HARVEST_API_KEY"] {
      try expect(
        !source.contains(forbidden), "Greenhouse desktop source must not accept \(forbidden)")
    }
  }
  private static func testLeverOAuthApplicationsControlsAreSourceBacked() throws {
    let source = try [
      "Sources/RelayConsoleApp/Views.swift", "Sources/RelayConsoleApp/AppViewModel.swift",
      "Sources/RelayConsoleCore/ApplicationsService.swift",
      "Sources/RelayConsoleCore/ProviderConnectionService.swift",
      "Sources/RelayConsoleCore/MarketplaceProviderFoundationService.swift",
      "Sources/RelayConsoleCore/LeverProviderActionAdapter.swift",
      "Sources/RelayConsoleCore/MarketplaceRuntimeMountService.swift",
    ].map(readPackageFile).joined(separator: "\n")
    for expected in [
      "ApplicationsLeverDetailPanel", "ApplicationsLeverAgentSwitchRow", "Connect Lever",
      "No Lever OAuth connection", "startLeverOAuthConnect", "RELAY_LEVER_OAUTH_CLIENT_ID",
      "offline_access", "postings:read:admin", "stages:read:admin", "lever_oauth_access_token",
      "lever_oauth_refresh_token", "lever_posting_list", "lever_stage_list",
      "confidentialDataReturned", "candidateDataReturned", "automaticPagination",
      "marketplace-logo-lever",
    ] { try expect(source.contains(expected), "Lever source missing \(expected)") }
    for forbidden in ["NEXT_PUBLIC_LEVER_CLIENT_SECRET", "LEVER_API_KEY"] {
      try expect(!source.contains(forbidden), "Lever desktop source must not accept \(forbidden)")
    }
  }

  private static func testAdvancedMDApplicationsPreviewIsSourceBacked() throws {
    let apps = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    for expected in [
      "marketplaceAdvancedMDApp", "advancedmd-developer-review",
      "advancedmd_connect_before_developer_approval", "advancedmd_collect_clinical_credentials",
      "advancedmd_api_actions_before_approval", "advancedmd_clinical_mutations_blocked",
      "installAfterSetup: false", "installable: false", "availability: .unavailable",
      "connectionState: .unavailable", "installState: .unavailable",
      "https://www.advancedmd.com/group-practice/developer-solutions/",
      "https://www.advancedmd.com/",
    ] { try expect(apps.contains(expected), "AdvancedMD source missing " + expected) }
    for forbidden in [
      "ADVANCEDMD_ACCESS_TOKEN", "ADVANCEDMD_PASSWORD", "ADVANCEDMD_OFFICE_KEY",
      "ADVANCEDMD_APPNAME", "ADVANCEDMD_PATIENT_ID", "saveAdvancedMDRailwayConnection",
      "ApplicationsAdvancedMDCredentialForm",
    ] {
      try expect(
        !apps.contains(forbidden), "AdvancedMD preview must not collect or save " + forbidden)
    }
  }

  private static func testPracticeFusionApplicationsPreviewIsSourceBacked() throws {
    let apps = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    for expected in [
      "marketplacePracticeFusionApp", "practice-fusion-developer-review",
      "practice_fusion_connect_before_developer_approval",
      "practice_fusion_collect_clinical_credentials", "practice_fusion_api_actions_before_approval",
      "practice_fusion_clinical_mutations_blocked", "installAfterSetup: false",
      "installable: false", "availability: .unavailable", "connectionState: .unavailable",
      "installState: .unavailable", "https://www.practicefusion.com/fhir/",
      "https://www.practicefusion.com/",
    ] { try expect(apps.contains(expected), "Practice Fusion source missing " + expected) }
    for forbidden in [
      "PRACTICE_FUSION_ACCESS_TOKEN", "PRACTICE_FUSION_PASSWORD", "PRACTICE_FUSION_PATIENT_ID",
      "PRACTICE_FUSION_CLIENT_SECRET", "savePracticeFusionRailwayConnection",
      "ApplicationsPracticeFusionCredentialForm",
    ] {
      try expect(
        !apps.contains(forbidden), "Practice Fusion preview must not collect or save " + forbidden)
    }
  }

  private static func testOpenDentalApplicationsPreviewIsSourceBacked() throws {
    let apps = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    for expected in [
      "marketplaceOpenDentalApp", "open-dental-developer-review",
      "open_dental_connect_before_developer_approval", "open_dental_collect_clinical_credentials",
      "open_dental_api_actions_before_approval", "open_dental_clinical_mutations_blocked",
      "installAfterSetup: false", "installable: false", "availability: .unavailable",
      "connectionState: .unavailable", "installState: .unavailable",
      "https://www.opendental.com/site/apispecification.html", "https://www.opendental.com/",
    ] { try expect(apps.contains(expected), "Open Dental source missing " + expected) }
    for forbidden in [
      "OPEN_DENTAL_DEVELOPER_KEY", "OPEN_DENTAL_CUSTOMER_KEY", "OPEN_DENTAL_PASSWORD",
      "OPEN_DENTAL_PATIENT_ID", "saveOpenDentalRailwayConnection",
      "ApplicationsOpenDentalCredentialForm",
    ] {
      try expect(
        !apps.contains(forbidden), "Open Dental preview must not collect or save " + forbidden)
    }
  }

  private static func testDentrixAscendApplicationsPreviewIsSourceBacked() throws {
    let apps = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    for expected in [
      "marketplaceDentrixAscendApp", "dentrix-ascend-api-exchange-review",
      "dentrix_ascend_connect_before_partner_approval",
      "dentrix_ascend_collect_clinical_credentials", "dentrix_ascend_api_actions_before_approval",
      "dentrix_ascend_clinical_mutations_blocked", "installAfterSetup: false", "installable: false",
      "availability: .unavailable", "connectionState: .unavailable", "installState: .unavailable",
      "https://www.dentrixascend.com/dental-solutions/practice-data-and-analytics/expand-integration-possibilities/",
      "https://www.dentrixascend.com/",
    ] { try expect(apps.contains(expected), "Dentrix Ascend source missing " + expected) }
    for forbidden in [
      "DENTRIX_ASCEND_ACCESS_TOKEN", "DENTRIX_ASCEND_CLIENT_SECRET", "DENTRIX_ASCEND_PASSWORD",
      "DENTRIX_ASCEND_PATIENT_ID", "saveDentrixAscendRailwayConnection",
      "ApplicationsDentrixAscendCredentialForm",
    ] {
      try expect(
        !apps.contains(forbidden), "Dentrix Ascend preview must not collect or save " + forbidden)
    }
  }

  private static func testAssetFallbackInventory() throws {
    let assetsRoot = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
      .appendingPathComponent("Sources/RelayConsoleApp/Resources/Assets")
    let appIcon = assetsRoot.appendingPathComponent("AppIcon/icon.png")
    let sourceIcon = assetsRoot.appendingPathComponent("AppIcon/source.png")
    let icnsIcon = assetsRoot.appendingPathComponent("AppIcon/icon.icns")
    try expect(FileManager.default.fileExists(atPath: appIcon.path), "app icon asset missing")
    try expect(FileManager.default.fileExists(atPath: sourceIcon.path), "source icon asset missing")
    try expect(FileManager.default.fileExists(atPath: icnsIcon.path), "icns app icon asset missing")

    let avatarRoot = assetsRoot.appendingPathComponent("avatars/illustrated")
    let avatars = try FileManager.default.contentsOfDirectory(
      at: avatarRoot, includingPropertiesForKeys: nil
    )
    .filter { $0.pathExtension == "png" }
    try expect(avatars.count == 42, "expected exactly 42 bundled illustrated avatars")
    try expect(
      avatars.contains { $0.lastPathComponent == "illustrated-white-male-03.png" },
      "hidden illustrated avatar should still be bundled"
    )
    let agentOpsRoot = assetsRoot.appendingPathComponent("agent-ops-hq")
    let floorAsset = agentOpsRoot.appendingPathComponent(
      "floors/agentops-tower-main-operations-floor.png")
    try expect(
      FileManager.default.fileExists(atPath: floorAsset.path), "AgentOps floor asset missing")
    let agentSpriteRoot = agentOpsRoot.appendingPathComponent("agents")
    let agentSprites = try FileManager.default.contentsOfDirectory(
      at: agentSpriteRoot, includingPropertiesForKeys: nil
    )
    .filter { $0.pathExtension == "png" }
    try expect(
      agentSprites.count == 6, "expected all AgentOps worker sprite PNG resources to be bundled")
    for expected in ["office-worker-01.png", "office-worker-02.png", "office-worker-03.png"] {
      try expect(
        agentSprites.contains { $0.lastPathComponent == expected },
        "active AgentOps worker sprite missing \(expected)")
    }
    let layoutResource = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
      .appendingPathComponent(
        "Sources/RelayConsoleCore/Resources/AgentOps/default-operations-floor-layout.json")
    try expect(
      FileManager.default.fileExists(atPath: layoutResource.path),
      "AgentOps floor layout resource missing")

    let components = try readPackageFile("Sources/RelayConsoleApp/UIComponents.swift")
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let applicationsService = try readPackageFile(
      "Sources/RelayConsoleCore/ApplicationsService.swift")
    let agentOpsService = try readPackageFile("Sources/RelayConsoleCore/AgentOpsService.swift")
    try expect(
      components.contains("defaultIllustratedAvatarURL(seed:"),
      "deterministic avatar fallback helper missing")
    try expect(
      components.contains("illustratedAvatarResourceNames"),
      "illustrated avatar resource list missing")
    try expect(
      components.contains(
        "hiddenIllustratedAvatarResourceName = \"illustrated-white-male-03.png\""),
      "hidden avatar disposition missing")
    try expect(components.contains("stableAvatarIndex(seed:"), "stable avatar index helper missing")
    try expect(
      components.contains("fallbackIllustratedAvatarResourceNames"),
      "fallback illustrated avatar resource names missing")
    for expected in [
      "RCAssetManifest",
      "app-icons",
      "curated-illustrated-avatars",
      "uploaded-avatar-validation",
      "deterministic-marketplace-icons",
      "agentops-floor-worker-assets",
      "brand-landing-broader-assets",
      "decision_gated_d0005",
      "D-0005-resolved-for-agentops-floor-worker-assets",
      "full-359-avatar-bundle-claim-blocked-by-D-0005",
      "avatarUploadDataURL(from:",
      "maximumAvatarUploadBytes = 3 * 1024 * 1024",
      "allowedAvatarUploadContentTypes: [UTType] = [.png, .jpeg]",
    ] {
      try expect(components.contains(expected), "asset manifest/source missing \(expected)")
    }
    try expect(
      applicationsService.contains("public static func iconFallback"),
      "deterministic application icon fallback helper missing")
    try expect(
      applicationsService.contains("deterministic-slug-fallback"),
      "application icon fallback source marker missing")
    try expect(
      views.contains("ApplicationsIconFallbackView"), "application fallback icon view missing")
    try expect(
      views.contains("Deterministic app icon fallback"),
      "application fallback icon accessibility label missing")
    try expect(
      agentOpsService.contains("bundled_web_agentops_floor_worker_assets"),
      "AgentOps bundled asset marker missing")
  }

  private static func testFixtureManifestsMatchSchema() throws {
    for path in componentManifestPaths {
      let manifest = try readPackageFile(path)
      for field in requiredManifestFields {
        try expect(manifest.contains("\(field):"), "\(path) is missing \(field)")
      }
      for expected in ["ITC-0012", "VC-0105", "VC-0106", "VC-0107", "VC-0108", "Demo 8", "D-0005"] {
        try expect(manifest.contains(expected), "\(path) must link \(expected)")
      }
      for expected in [
        "componentInventory:", "stateCoverage:", "accessibilityEvidence:", "assetFallbackEvidence:",
        "notParityStatement:", "releaseImpact:",
      ] {
        try expect(manifest.contains(expected), "\(path) missing \(expected)")
      }
    }
  }

  private static func readPackageFile(_ relativePath: String) throws -> String {
    let source = try RelayConsoleSourceTestSupport.read(
      root: URL(fileURLWithPath: FileManager.default.currentDirectoryPath),
      path: relativePath
    )
    let renderedStringLiterals = source.replacingOccurrences(
      of: #"\\\r?\n[ \t]*"#,
      with: "",
      options: .regularExpression
    )
    return source + "\n" + renderedStringLiterals
  }

  private static func sourceContainsIgnoringWhitespace(
    _ source: String, containsIgnoringWhitespace snippet: String
  ) -> Bool {
    normalizedSource(source)
      .contains(normalizedSource(snippet))
  }

  private static func normalizedSource(_ source: String) -> String {
    let key = source as NSString
    if let cached = normalizedSourceCache.object(forKey: key) {
      return cached as String
    }
    let normalized = source.split(whereSeparator: \.isWhitespace).joined(separator: " ")
    normalizedSourceCache.setObject(normalized as NSString, forKey: key)
    return normalized
  }

  private static func expect(_ condition: @autoclosure () throws -> Bool, _ message: String) throws
  {
    guard try condition() else {
      throw ComponentBaselineTestFailure(message)
    }
  }
}

private let componentManifestPaths = [
  "Tests/Fixtures/visual/components/native-claw-classic-001/manifest.md",
  "Tests/Fixtures/manual-evidence/components/native-component-accessibility-001/manifest.md",
]

private let requiredManifestFields = [
  "id",
  "layer",
  "productArea",
  "requirementIds",
  "sourceMapIds",
  "fixtureKind",
  "owner",
  "status",
  "secretsPolicy",
  "files",
  "expectedChecks",
  "determinism",
  "noFakeProductSeed",
  "noSimulatedRuntimeOutput",
  "noGeneratedWelcome",
  "privateStateExclusions",
  "redactionReview",
  "failureHandling",
]

private struct ComponentBaselineTestFailure: Error, CustomStringConvertible {
  var description: String
  init(_ description: String) {
    self.description = description
  }
}
