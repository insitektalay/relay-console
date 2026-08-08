import Foundation
import RelayConsoleSourceTestSupport

@main
struct RelayConsoleSourceHygieneTests {
  static func main() throws {
    try run(
      "product source excludes private defaults and paths",
      testProductSourceExcludesPrivateDefaultsAndPaths)
    try run(
      "profile settings use durable source-backed defaults", testProfileSettingsUseDurableDefaults)
    try run(
      "create agent form avoids development-specific defaults",
      testCreateAgentFormAvoidsDevelopmentDefaults)
    try run(
      "chat selection resets the message timeline scroll container",
      testChatSelectionResetsMessageTimelineScrollContainer)
    try run(
      "chat selection uses an isolated feature refresh",
      testChatSelectionUsesIsolatedFeatureRefresh)
    try run(
      "TelemetryDeck assignment UI keeps access changes intentional",
      testTelemetryDeckAssignmentUIKeepsAccessChangesIntentional)
    try run(
      "X assignment UI enforces exact OAuth readiness and four intentional authority choices",
      testXAssignmentUIEnforcesExactOAuthReadinessAndAuthority)
    try run(
      "Facebook Pages source regions retain Page semantics and intentional authority",
      testFacebookPagesSourceRegionsRetainExactSemantics)
    try run(
      "Bluesky Applications UI follows the shared contract", testBlueskyApplicationsUIContract)
    try run(
      "Nextdoor Applications UI follows its Publish API contract",
      testNextdoorApplicationsUIContract)
    try run(
      "Meetup Applications UI follows its fixed GraphQL read contract",
      testMeetupApplicationsUIContract)
    try run(
      "Eventbrite Applications UI follows its fixed organizer Event read contract",
      testEventbriteApplicationsUIContract)
    try run(
      "Luma Applications infrastructure follows its bound Calendar API contract",
      testLumaApplicationsInfrastructureContract)
    try run(
      "Hopin alias infrastructure follows the current RingCentral Events API contract",
      testHopinApplicationsInfrastructureContract)
    try run(
      "Twist Applications UI follows its bounded thread and comment contract",
      testTwistApplicationsUIContract)
    try run(
      "Zoho Mail Applications UI follows its regional read-only contract",
      testZohoMailApplicationsUIContract)
    try run(
      "Webex Applications UI follows its fixed Person and Meeting read contract",
      testWebexApplicationsUIContract)
    try run(
      "GoTo Meeting Applications UI follows its bound-organizer Meeting contract",
      testGoToMeetingApplicationsUIContract)
    try run(
      "RingCentral Applications UI follows its privacy-masked self-extension contract",
      testRingCentralApplicationsUIContract)
    try run(
      "Dialpad Applications UI follows its privacy-masked own-user contract",
      testDialpadApplicationsUIContract)
    try run(
      "Aircall Applications UI follows its company-bound masked-number contract",
      testAircallApplicationsUIContract)
    try run(
      "Quo Applications UI follows its full-key bounded masked-number contract",
      testOpenPhoneApplicationsUIContract)
    try run(
      "Twilio Applications UI follows its Restricted-key masked-status contract",
      testTwilioApplicationsUIContract)
    try run(
      "Vonage Applications UI follows its dedicated-secret balance contract",
      testVonageApplicationsUIContract)
    try run(
      "Bird Applications UI follows its role-bound workspace-status contract",
      testMessageBirdApplicationsUIContract)
    try run(
      "FRED Applications UI follows its bounded public economic-data contract",
      testFREDApplicationsUIContract)
    try run(
      "Hunter Applications infrastructure follows its bounded reduced verification contract",
      testHunterApplicationsInfrastructureContract)
    try run(
      "Snov.io Applications infrastructure follows its one-email verification contract",
      testSnovApplicationsInfrastructureContract)
    try run(
      "Lusha Applications infrastructure follows its account-governance-only contract",
      testLushaApplicationsInfrastructureContract)
    try run(
      "LeadIQ Applications infrastructure follows its no-credit account-governance-only contract",
      testLeadIQApplicationsInfrastructureContract)
    try run(
      "Seamless.AI Applications infrastructure follows its bounded company-only search contract",
      testSeamlessAIApplicationsInfrastructureContract)
    try run(
      "RocketReach Applications infrastructure follows its account-governance-only contract",
      testRocketReachApplicationsInfrastructureContract)
    try run(
      "UpLead Applications infrastructure follows its credit-governance-only contract",
      testUpLeadApplicationsInfrastructureContract)
    try run(
      "Wiza Applications infrastructure follows its fixed credit-governance-only contract",
      testWizaApplicationsInfrastructureContract)
    try run(
      "Apollo GraphOS Applications infrastructure follows its fixed metadata-read contract",
      testApolloGraphOSApplicationsInfrastructureContract)
    try run(
      "LINE Applications UI follows its OIDC-bound profile-only contract",
      testLINEApplicationsUIContract)
    try run(
      "Railway Applications state excludes connections from other workspace links",
      testRailwayApplicationsStateExcludesConnectionsFromOtherWorkspaceLinks)
    try run(
      "OpenClaw Marketplace tools are selected from each dispatch session",
      testOpenClawMarketplaceToolsAreSelectedPerSession)
    try run(
      "AgentOps HQ uses bundled assets without mock or backend drift",
      testAgentOpsHqUsesBundledAssetsWithoutMockOrBackendDrift)
    try run("source hygiene manual manifests match schema", testManualManifestsMatchSchema)
    print("RelayConsoleSourceHygieneTests passed")
  }

  private static func run(_ name: String, _ test: () throws -> Void) throws {
    do {
      try test()
      print("ok - \(name)")
    } catch {
      print("not ok - \(name): \(error)")
      throw error
    }
  }

  private static func testProductSourceExcludesPrivateDefaultsAndPaths() throws {
    let source = try productSource()
    for forbidden in forbiddenProductSourceFragments {
      try expect(
        !source.contains(forbidden), "product source contains forbidden fragment: \(forbidden)")
    }
    let loopbackBackendLines =
      source
      .split(separator: "\n")
      .map { $0.lowercased() }
      .filter { line in
        (line.contains("localhost") || line.contains("127.0.0.1") || line.contains("::1"))
          && (line.contains("/api/v1")
            || line.contains("websocket")
            || line.contains("clawchat_railway_origin")
            || line.contains("next_public_railway_ws_base_url"))
      }
    try expect(
      loopbackBackendLines.isEmpty,
      "product source should not contain loopback API or websocket backend references")
  }

  private static func testProfileSettingsUseDurableDefaults() throws {
    let appViewModel = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let localData = try readPackageFile("Sources/RelayConsoleCore/LocalDataService.swift")

    try expect(
      compactSource(appViewModel).contains("var displayName: String = \"\""),
      "profile display name should default to an empty user-owned field")
    try expect(
      compactSource(appViewModel).contains("var email: String = \"\""),
      "profile email should default to an empty user-owned field")
    try expect(
      compactSource(appViewModel).contains("migrateLegacyUserProfilePreference"),
      "legacy profile migration should remain wired")
    try expect(localData.contains("updateProfile("), "profile updates should be service backed")
    try expect(
      localData.contains("setSelectedSettingsPanel"),
      "settings panel selection should be service backed")
    try expect(
      !views.contains("Toggle(\"Anonymous usage analytics\", isOn: .constant(true))"),
      "analytics toggle should not be a fixed constant")
    try expect(
      !views.contains("Toggle(\"Anonymous crash/error reporting\", isOn: .constant(true))"),
      "crash toggle should not be a fixed constant")
  }

  private static func testOpenClawMarketplaceToolsAreSelectedPerSession() throws {
    let installer = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceRuntimeHarnessBridgeInstaller.swift")
    try expect(
      installer.contains("snapshotDirectory") && installer.contains("catalogVersion"),
      "OpenClaw Marketplace registration must use a stable tool catalog instead of one agent snapshot")
    try expect(
      installer.contains("api.registerTool((toolContext) => {")
        && installer.contains("toolForSession(name, toolContext)")
        && installer.contains("if (!tool) return null"),
      "OpenClaw Marketplace tool factories must hide tools that are not in the current session snapshot")
  }

  private static func testCreateAgentFormAvoidsDevelopmentDefaults() throws {
    let appViewModel = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")

    try expect(
      compactSource(appViewModel).contains("var selectedModel: String = \"gpt-5.5\""),
      "create-agent draft should expose the tested Harness model default")
    try expect(
      !compactSource(appViewModel).contains("var workspaceFolderPath: String = \"\""),
      "create-agent draft should not expose a workspace folder field")
    try expect(
      !compactSource(appViewModel).contains("nous-hermes"),
      "create-agent model should not ship a fixed development model")
    try expect(
      !views.contains("nous-hermes"),
      "create-agent view should not reapply a fixed development model")
    try expect(
      !views.contains("LabeledTextField(\"Model\""),
      "create-agent view should not expose model selection")
    try expect(
      !views.contains("Workspace folder"),
      "create-agent view should not expose manual workspace folder selection")
    try expect(
      !views.contains("Select a workspace folder"),
      "create-agent view should not expose manual workspace folder selection")
    try expect(
      !views.contains("Choose workspace folder"),
      "create-agent view should not expose manual workspace folder selection")
    try expect(
      !views.contains("Documents/Projects/Active/ClawChat"),
      "workspace root placeholder should not include a private project path")
  }

  private static func testChatSelectionUsesIsolatedFeatureRefresh() throws {
    let chats = try readPackageFile(
      "Sources/RelayConsoleApp/Features/Chats/AppViewModel+Chats.swift")
    let scopedRefresh = try readPackageFile(
      "Sources/RelayConsoleApp/Features/Shell/AppViewModel+FeatureRefresh.swift")
    let coordination = try readPackageFile(
      "Sources/RelayConsoleApp/Features/Shell/AppViewModel+Coordination.swift")
    let selectStart = try unwrapRange(
      chats.range(of: "func selectThread(_ threadId: String)"),
      "missing thread selection action"
    )
    let selectEnd = try unwrapRange(
      chats.range(
        of: "func viewCurrentChatCycle",
        range: selectStart.upperBound..<chats.endIndex
      ),
      "missing thread selection boundary"
    )
    let selectSource = String(chats[selectStart.lowerBound..<selectEnd.lowerBound])
    try expect(
      compactSource(selectSource).contains(
        "Task{awaitrefreshChatState(preferredThreadId:threadId)}"),
      "thread selection must request the chat-only refresh directly"
    )
    try expect(
      !selectSource.contains("runAction("),
      "thread selection must not enter global action or busy state"
    )

    let chatRefreshStart = try unwrapRange(
      scopedRefresh.range(of: "func refreshChatState"),
      "missing scoped chat refresh"
    )
    let chatRefreshEnd = try unwrapRange(
      scopedRefresh.range(
        of: "func refreshAgentsState",
        range: chatRefreshStart.upperBound..<scopedRefresh.endIndex
      ),
      "missing scoped chat refresh boundary"
    )
    let chatRefreshSource = String(
      scopedRefresh[chatRefreshStart.lowerBound..<chatRefreshEnd.lowerBound])
    for forbidden in [
      "cloudSync.",
      "artifacts.",
      "applications.",
      "providerConnections.",
      "providerActionApprovalInbox.",
      "insights.",
      "settingsStatus.",
      "settingsSecurity.",
      "agentOps.",
      "work.workCalendar",
    ] {
      try expect(
        !chatRefreshSource.contains(forbidden),
        "chat selection must not refresh unrelated feature service: \(forbidden)"
      )
    }
    try expect(
      chatRefreshSource.contains("refreshMessageWindow("),
      "chat refresh must load the selected message window"
    )
    try expect(
      coordination.contains("scheduleRefresh(.chat)"),
      "chat events must route to the chat refresh scope"
    )
    try expect(
      coordination.contains("func refreshOperationalOutputs() async"),
      "artifact and cron refresh must remain an independent operational scope"
    )
    try expect(
      coordination.contains("services.cloudSync.synchronizeArtifacts("),
      "operational refresh must retain Railway artifact synchronization"
    )
  }

  private static func testChatSelectionResetsMessageTimelineScrollContainer() throws {
    let chatScreen = try readPackageFile(
      "Sources/RelayConsoleApp/Features/Chats/ChatScreen.swift")
    try expect(
      compactSource(chatScreen).contains(".id(messageTimelineIdentity)"),
      "the message list must receive a fresh scroll identity when the selected conversation changes"
    )
    let identityStart = try unwrapRange(
      chatScreen.range(of: "var messageTimelineIdentity: String"),
      "missing message timeline identity"
    )
    let identityEnd = try unwrapRange(
      chatScreen.range(
        of: "var shouldShowJumpToLatestButton",
        range: identityStart.upperBound..<chatScreen.endIndex
      ),
      "missing message timeline identity boundary"
    )
    let identitySource = String(
      chatScreen[identityStart.lowerBound..<identityEnd.lowerBound])
    try expect(
      identitySource.contains("model.selectedThreadId"),
      "the message timeline identity must follow the selected conversation"
    )
    try expect(
      identitySource.contains("model.selectedWrapUpReportId"),
      "the message timeline identity must distinguish live chat from transcript history"
    )
  }

  private static func testTelemetryDeckAssignmentUIKeepsAccessChangesIntentional() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let appViewModel = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let workManagementModel = try readPackageFile(
      "Sources/RelayConsoleApp/Features/Applications/AppViewModel+ApplicationWorkManagementA.swift")

    let rowStart = try unwrapRange(
      views.range(of: "struct ApplicationsTelemetryDeckAgentSwitchRow: View"),
      "missing TelemetryDeck agent switch row")
    let rowEnd = try unwrapRange(
      views.range(of: "struct ApplicationsTelemetryDeckConnectionsCard: View"),
      "missing TelemetryDeck connections card")
    let rowSource = String(views[rowStart.lowerBound..<rowEnd.lowerBound])
    let compactRowSource = rowSource.split(whereSeparator: \.isWhitespace).joined(separator: " ")
    try expect(
      !rowSource.contains(".onTapGesture"),
      "TelemetryDeck agent cards should not toggle access from card clicks")
    try expect(
      compactRowSource.contains("Button { pendingConnectionState = !isOn"),
      "TelemetryDeck access changes should be tied to the explicit switch button")
    try expect(
      rowSource.contains(".alert(confirmationTitle"),
      "TelemetryDeck access changes should require an explicit confirmation")
    try expect(
      rowSource.contains("ApplicationsAgentAuthorityRow"),
      "TelemetryDeck assigned agents should show the authority row")
    try expect(
      rowSource.contains("Read-only TelemetryDeck analytics"),
      "TelemetryDeck assigned agents should show read-only authority copy")

    let presetsStart = try unwrapRange(
      appViewModel.range(of: "func marketplaceActionPolicyPresets(for app: MarketplaceCatalogApp)"),
      "missing Marketplace policy preset function")
    let presetsEnd = try unwrapRange(
      appViewModel.range(
        of: "func chatContext", range: presetsStart.upperBound..<appViewModel.endIndex),
      "missing function after policy preset function")
    let presetsSource = compactSource(
      String(appViewModel[presetsStart.lowerBound..<presetsEnd.lowerBound]))
    try expect(
      presetsSource.contains(
        "return [.approvalRequired, .allowDirectWrites, .readOnly, .blocked]"),
      "Every assignable provider should expose Standard, Direct writes, Read only, and No access authority")
    let compactWorkManagementModel = compactSource(workManagementModel)
    for required in [
      "preset == .allowDirectWrites",
      "install.metadata[\"providerActionFrameworkHydrated\"]?.bool != true",
      "services.marketplaceInstalls.updateInstall(",
      "approvalProfileId: \"dangerously_skip_permissions\"",
      "acknowledgeDangerouslySkipPermissions: acknowledgeDangerousPolicy",
    ] {
      try expect(
        compactWorkManagementModel.contains(required),
        "Railway-backed provider authority changes must persist Direct writes through the universal Marketplace policy profile: missing \(required)")
    }

    let helpStart = try unwrapRange(
      views.range(of: "func applicationsPolicyHelp"), "missing applications policy help")
    let helpEnd = try unwrapRange(
      views.range(of: "func exaRuntimeLabel", range: helpStart.upperBound..<views.endIndex),
      "missing policy help end")
    let helpSource = String(views[helpStart.lowerBound..<helpEnd.lowerBound])
    try expect(
      helpSource.contains("app?.slug == \"telemetrydeck\""),
      "TelemetryDeck should have app-specific authority help")
    try expect(
      helpSource.contains("TelemetryDeck V1 does not expose write-capable authority."),
      "TelemetryDeck authority help should explain unavailable write authority")
  }

  private static func testXAssignmentUIEnforcesExactOAuthReadinessAndAuthority() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let appViewModel = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")

    let rowStart = try unwrapRange(
      views.range(of: "struct ApplicationsXAgentSwitchRow: View"), "missing X agent switch row")
    let rowEnd = try unwrapRange(
      views.range(of: "struct ApplicationsXConnectionsCard: View"), "missing X connections card")
    let rowSource = String(views[rowStart.lowerBound..<rowEnd.lowerBound])
    try expect(
      !rowSource.contains(".onTapGesture"),
      "X agent cards must not toggle assignment from card clicks")
    try expect(
      rowSource.contains("pendingConnectionState = !isOn"),
      "X assignment must use the explicit switch button")
    try expect(
      rowSource.contains(".alert(confirmationTitle"),
      "X assignment changes must require confirmation")
    try expect(
      rowSource.contains("ApplicationsAgentAuthorityRow"),
      "X assigned agents must show the authority row")

    let connectionsStart = try unwrapRange(
      views.range(of: "struct ApplicationsXConnectionsCard: View"), "missing X connections card")
    let connectionsEnd = try unwrapRange(
      views.range(of: "struct ApplicationsXConnectionHeader: View"), "missing X connection header")
    let connectionsSource = String(views[connectionsStart.lowerBound..<connectionsEnd.lowerBound])
    try expect(
      connectionsSource.contains("model.startXOAuthConnect(for: app)"),
      "active X connection UI must route through Railway OAuth")
    for forbidden in [
      "xAPIKeyDraft", "xAPIKeySecretDraft", "xAccessTokenDraft", "xAccessTokenSecretDraft",
      "xBearerTokenDraft", "saveXPersonalAppTokens",
    ] {
      try expect(
        !connectionsSource.contains(forbidden),
        "active X connection UI exposes legacy manual field: \(forbidden)")
    }

    let assignmentStart = try unwrapRange(
      appViewModel.range(of: "func setXAgentConnection"), "missing X assignment function")
    let assignmentEnd = try unwrapRange(
      appViewModel.range(
        of: "func startLinkedInOAuthConnect",
        range: assignmentStart.upperBound..<appViewModel.endIndex),
      "missing function after X assignment")
    let assignmentSource = String(
      appViewModel[assignmentStart.lowerBound..<assignmentEnd.lowerBound])
    for required in [
      "credentialOwnership == .relayOwned", "xRelayOwnedOAuthScopes", "railwayCallbackOnly",
      "userBound", "billingReady", "replyAutomationEnabled", "rawToolsEnabled",
    ] {
      try expect(
        assignmentSource.contains(required), "X assignment readiness is missing \(required)")
    }

    let presetsStart = try unwrapRange(
      appViewModel.range(of: "func marketplaceActionPolicyPresets(for app: MarketplaceCatalogApp)"),
      "missing Marketplace policy preset function")
    let presetsEnd = try unwrapRange(
      appViewModel.range(
        of: "func chatContext", range: presetsStart.upperBound..<appViewModel.endIndex),
      "missing function after policy preset function")
    let presetsSource = String(appViewModel[presetsStart.lowerBound..<presetsEnd.lowerBound])
    try expect(
      presetsSource.contains("return [.approvalRequired, .allowDirectWrites, .readOnly, .blocked]"),
      "Every assignable provider, including X, must expose Standard, Direct writes, Read only, and No access")
  }

  private static func testFacebookPagesSourceRegionsRetainExactSemantics() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let appViewModel = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let adapter = try readPackageFile(
      "Sources/RelayConsoleCore/FacebookPagesProviderActionAdapter.swift")
    let wrapperCompiler = try readPackageFile(
      "Sources/RelayConsoleCore/RelayProviderWrapperToolCompilerService.swift")

    let panelStart = try unwrapRange(
      views.range(of: "struct ApplicationsFacebookPagesDetailPanel: View"),
      "missing Facebook Pages detail panel")
    let panelEnd = try unwrapRange(
      views.range(
        of: "struct ApplicationsXDetailPanel: View", range: panelStart.upperBound..<views.endIndex),
      "missing section after Facebook Pages panel")
    let panel = String(views[panelStart.lowerBound..<panelEnd.lowerBound])
    for required in [
      "facebookPagesAgentControls", "No Facebook Page selected", "Search agents...",
      "agents connected to Facebook Pages.", "ApplicationsAgentGridScroll",
      "ApplicationsAgentAuthorityRow", ".alert(",
    ] {
      try expect(panel.contains(required), "Facebook Pages UI contract is missing \(required)")
    }
    try expect(
      !panel.contains(".onTapGesture"),
      "Facebook Pages cards must not toggle assignment from card clicks")

    let assignmentStart = try unwrapRange(
      appViewModel.range(of: "func setFacebookPagesAgentConnection"),
      "missing Facebook Pages assignment function")
    let assignmentEnd = try unwrapRange(
      appViewModel.range(
        of: "func selectXTokenConnection", range: assignmentStart.upperBound..<appViewModel.endIndex
      ), "missing function after Facebook Pages assignment")
    let assignment = String(appViewModel[assignmentStart.lowerBound..<assignmentEnd.lowerBound])
    for required in [
      "credentialOwnership == .relayOwned", "facebookPagesRelayOwnedOAuthScopes",
      "railwayCallbackOnly", "selectedPageVerified", "pageAuthoredPostsOnly", "automaticPagination",
      "rawToolsEnabled",
    ] {
      try expect(
        assignment.contains(required), "Facebook Pages assignment readiness is missing \(required)")
    }

    for forbidden in [
      "twitter", "tweet", "api.x.com", "linkedin", "ugcPost", "restli", "discord", "guild",
      "subreddit", "slack",
    ] {
      try expect(
        !adapter.localizedCaseInsensitiveContains(forbidden),
        "Facebook Pages adapter contains foreign-provider semantic: \(forbidden)")
    }
    for required in [
      "facebook_pages_page_get", "facebook_pages_own_posts_list", "facebook_pages_post_draft",
      "facebook_pages_text_post_create", "pageAuthoredPostsOnly", "nextPageFollowed",
      "automaticRetry",
    ] {
      try expect(
        adapter.contains(required),
        "Facebook Pages adapter is missing semantic contract field \(required)")
    }
    for wrapper in [
      "relay_facebook_pages_get_page", "relay_facebook_pages_list_own_posts",
      "relay_facebook_pages_draft_post", "relay_facebook_pages_publish_text_post",
    ] {
      try expect(
        wrapperCompiler.contains(wrapper), "Facebook Pages wrapper compiler is missing \(wrapper)")
    }
  }

  private static func testBlueskyApplicationsUIContract() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let appViewModel = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let applications = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")

    let panelStart = try unwrapRange(
      views.range(of: "struct ApplicationsBlueskyDetailPanel: View"), "missing Bluesky detail panel"
    )
    let panelEnd = try unwrapRange(
      views.range(
        of: "struct ApplicationsLinkedInDetailPanel: View",
        range: panelStart.upperBound..<views.endIndex), "missing section after Bluesky panel")
    let panel = String(views[panelStart.lowerBound..<panelEnd.lowerBound])
    let requiredOrder = [
      "ApplicationsExaHeroCard(app: app)", "agentsPanel", "connectionPanel",
      "ApplicationsInfoCardsLayout", "title: \"Capabilities\"",
      "title: \"What Agents Can Do\"", "title: \"Requirements\"",
    ]
    var cursor = panel.startIndex
    for required in requiredOrder {
      guard let range = panel.range(of: required, range: cursor..<panel.endIndex) else {
        throw SourceHygieneTestFailure("Bluesky UI contract order is missing \(required)")
      }
      cursor = range.upperBound
    }
    for required in [
      "ApplicationsAgentGridScroll", "ApplicationsBlueskyAgentRow",
      "ApplicationsAgentAuthorityRow", "ApplicationsConnectionFormGrid",
      "No Bluesky connections", "Connect Bluesky", ".alert(",
      "model.startBlueskyOAuthConnect(for: app)",
    ] {
      try expect(panel.contains(required), "Bluesky UI contract is missing \(required)")
    }
    try expect(
      !panel.contains(".onTapGesture"), "Bluesky agent cards must not toggle from card clicks")
    try expect(
      compactSource(views).contains(
        "case .bluesky: return (\"marketplace-logo-bluesky\", \"png\")"),
      "Bluesky official asset must drive shared sidebar and hero rendering")
    try expect(
      applications.contains("slug: \"bluesky\", name: \"Bluesky\""),
      "Bluesky catalog identity is missing")

    let presetsStart = try unwrapRange(
      appViewModel.range(of: "func marketplaceActionPolicyPresets(for app: MarketplaceCatalogApp)"),
      "missing policy presets")
    let presetsEnd = try unwrapRange(
      appViewModel.range(
        of: "func chatContext", range: presetsStart.upperBound..<appViewModel.endIndex),
      "missing function after policy presets")
    let presets = compactSource(
      String(appViewModel[presetsStart.lowerBound..<presetsEnd.lowerBound]))
    try expect(
      presets.contains("return [.approvalRequired, .allowDirectWrites, .readOnly, .blocked]"),
      "Every assignable provider, including Bluesky, must expose Standard, Direct writes, Read only, and No access")

    let assignmentStart = try unwrapRange(
      appViewModel.range(of: "func setBlueskyAgentConnection"),
      "missing Bluesky assignment function")
    let assignmentEnd = try unwrapRange(
      appViewModel.range(
        of: "func deleteBlueskyConnection",
        range: assignmentStart.upperBound..<appViewModel.endIndex),
      "missing function after Bluesky assignment")
    let assignment = String(appViewModel[assignmentStart.lowerBound..<assignmentEnd.lowerBound])
    for required in [
      "blueskyRelayOwnedOAuthScopes", "railwayCallbackOnly", "didVerified", "pdsVerified",
      "issuerVerified", "dpopBound", "ownOriginalPostsOnly", "textOnlyCreate", "automaticRetry",
      "automaticPagination", "rawToolsEnabled",
    ] {
      try expect(
        assignment.contains(required),
        "Bluesky direct-call assignment readiness is missing \(required)")
    }
    let services = try readPackageFile("Sources/RelayConsoleCore/RelayConsoleServices.swift")
    let cloudSync = try readPackageFile("Sources/RelayConsoleCore/CloudRelaySync.swift")
    let startStart = try unwrapRange(
      appViewModel.range(of: "func startBlueskyOAuthConnect"), "missing Bluesky OAuth start")
    let startEnd = try unwrapRange(
      appViewModel.range(
        of: "func selectBlueskyConnection", range: startStart.upperBound..<appViewModel.endIndex),
      "missing function after Bluesky OAuth start")
    let start = String(appViewModel[startStart.lowerBound..<startEnd.lowerBound])
    for required in [
      "railwayMarketplaceRequest", "connectors/bluesky/oauth/start", "authorizationUrl",
      "NSWorkspace.shared.open",
    ] {
      try expect(
        start.contains(required),
        "Bluesky OAuth start must use deployed Railway contract: \(required)")
    }
    try expect(
      !start.contains("are not deployed on Railway yet"),
      "Bluesky OAuth start must not retain the pre-broker fail-closed placeholder")
    try expect(
      compactSource(appViewModel).contains(
        "connectors/bluesky/connections/\\(remoteConnectionId)/health"),
      "Bluesky health must use Railway")
    try expect(
      compactSource(appViewModel).contains(
        "connectors/bluesky/connections/\\(remoteConnectionId)/disconnect"),
      "Bluesky disconnect must use Railway")
    for required in [
      "RelayCloudLaunchContract.apiOrigin", "validAccessToken", "remote_workspace_id",
      "remoteMarketplaceConnectionId", "remoteMarketplaceAgentId", "railwayMarketplaceRequestSync",
    ] {
      try expect(
        cloudSync.contains(required), "Railway Marketplace transport is missing \(required)")
    }
    try expect(
      services.contains("blueskyAdapter: BlueskyProviderActionAdapter")
        && services.contains("RailwayBlueskyProviderActionClient(cloudSync: cloudSync)"),
      "production composition must route Bluesky through Railway and never use the fake client")
    let blueskyAdapter = try readPackageFile(
      "Sources/RelayConsoleCore/BlueskyProviderActionAdapter.swift")
    for required in [
      "connectors/bluesky/connections/", "relay_bluesky_get_profile",
      "relay_bluesky_list_own_posts", "relay_bluesky_draft_text_post",
      "relay_bluesky_publish_text_post", "railwayBrokered",
    ] {
      try expect(
        blueskyAdapter.contains(required), "Railway Bluesky runtime adapter is missing \(required)")
    }
  }

  private static func testNextdoorApplicationsUIContract() throws {
    let applications = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let appViewModel = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")

    let panelStart = try unwrapRange(
      views.range(of: "struct ApplicationsNextdoorDetailPanel: View"),
      "missing Nextdoor detail panel")
    let panelEnd = try unwrapRange(
      views.range(
        of: "struct ApplicationsLinkedInDetailPanel: View",
        range: panelStart.upperBound..<views.endIndex), "missing panel after Nextdoor")
    let panel = String(views[panelStart.lowerBound..<panelEnd.lowerBound])
    for required in [
      "ApplicationsExaHeroCard", "Agents with Nextdoor", "ApplicationsAgentGridScroll",
      "ApplicationsAgentAuthorityRow", "Manage API Connection", "ApplicationsConnectionFormGrid",
      "No Nextdoor connections", "Capabilities", "What Agents Can Do", "Requirements",
      "openid · profile:read · post:read · post:write", "Display Content", "Ads", "Share Plugin",
    ] {
      try expect(panel.contains(required), "Nextdoor UI contract is missing \(required)")
    }
    for required in [
      "mapp-nextdoor", "nextdoor_text_post_publish",
      "nextdoor_display_content_search_trending_agencies",
      "Relay-owned Nextdoor partner OAuth via Railway", "provider-content-not-stored",
    ] {
      try expect(
        applications.contains(required), "Nextdoor catalog contract is missing \(required)")
    }
    for required in [
      "startNextdoorOAuthConnect", "setNextdoorAgentConnection", "testNextdoorConnection",
      "deleteNextdoorConnection", "connectors/nextdoor/oauth/start",
      "remoteMarketplaceConnectionId",
      "profileVerified", "selectedProfileIdBound", "ownPostsOnly", "textOnlyCreate",
      "automaticRetry", "automaticPagination", "rawToolsEnabled",
    ] {
      try expect(
        compactSource(appViewModel).contains(required),
        "Nextdoor desktop contract is missing \(required)")
    }
    try expect(
      compactSource(appViewModel).contains(
        "return [.approvalRequired, .allowDirectWrites, .readOnly, .blocked]"
      ), "Nextdoor must expose Standard, Direct writes, Read only and No access")
  }

  private static func testMeetupApplicationsUIContract() throws {
    let applications = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let model = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let start = try unwrapRange(
      views.range(of: "struct ApplicationsMeetupDetailPanel: View"), "missing Meetup detail panel")
    let end = try unwrapRange(
      views.range(
        of: "struct ApplicationsLinkedInDetailPanel: View", range: start.upperBound..<views.endIndex
      ), "missing panel after Meetup")
    let panel = String(views[start.lowerBound..<end.lowerBound])
    for required in [
      "ApplicationsExaHeroCard", "Agents with Meetup", "ApplicationsAgentGridScroll",
      "ApplicationsAgentAuthorityRow", "Manage API Connection", "ApplicationsConnectionFormGrid",
      "No Meetup connections", "Capabilities", "What Agents Can Do", "Requirements",
      "No user-selectable OAuth scopes", "two fixed Relay wrappers", "raw GraphQL",
    ] { try expect(panel.contains(required), "Meetup UI contract is missing \(required)") }
    for required in [
      "mapp-meetup", "Relay-owned Meetup OAuth via Railway", "meetup_introspection_raw_graphql",
      "Verify the connected Meetup member", "Review one explicitly identified Meetup event",
    ] {
      try expect(applications.contains(required), "Meetup catalog contract is missing \(required)")
    }
    for required in [
      "startMeetupOAuthConnect", "setMeetupAgentConnection", "testMeetupConnection",
      "deleteMeetupConnection", "connectors/meetup/oauth/start", "remoteMarketplaceConnectionId",
      "memberVerified", "fixedQueriesOnly", "automaticRetry", "automaticPagination",
      "rawToolsEnabled",
    ] {
      try expect(
        compactSource(model).contains(required), "Meetup desktop contract is missing \(required)")
    }
    try expect(
      compactSource(model).contains(
        "return [.approvalRequired, .allowDirectWrites, .readOnly, .blocked]"
      ),
      "Meetup must expose Standard, Direct writes, Read only and No access so Safe and dangerously skipped install policies remain selectable"
    )
  }

  private static func testEventbriteApplicationsUIContract() throws {
    let applications = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let model = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let start = try unwrapRange(
      views.range(of: "struct ApplicationsEventbriteDetailPanel: View"),
      "missing Eventbrite detail panel")
    let end = try unwrapRange(
      views.range(
        of: "struct ApplicationsLinkedInDetailPanel: View", range: start.upperBound..<views.endIndex
      ), "missing panel after Eventbrite")
    let panel = String(views[start.lowerBound..<end.lowerBound])
    for required in [
      "ApplicationsExaHeroCard", "Agents with Eventbrite", "ApplicationsAgentGridScroll",
      "ApplicationsAgentAuthorityRow", "Manage API Connection", "ApplicationsConnectionFormGrid",
      "No Eventbrite connections", "Capabilities", "What Agents Can Do", "Requirements",
      "four fixed REST reads", "Organization-membership", "attendee, order, ticket, payment",
    ] {
      try expect(
        panel.localizedCaseInsensitiveContains(required),
        "Eventbrite UI contract is missing \(required)")
    }
    for required in [
      "mapp-eventbrite", "Relay-owned Eventbrite OAuth via Railway",
      "eventbrite_orders_attendees_checkin_contacts", "eventbrite_manage_iframe_esr",
      "List up to ten member Organizations", "Inspect one explicit Event with bounded Venue fields",
    ] {
      try expect(
        applications.contains(required), "Eventbrite catalog contract is missing \(required)")
    }
    for required in [
      "startEventbriteOAuthConnect", "setEventbriteAgentConnection", "testEventbriteConnection",
      "deleteEventbriteConnection", "connectors/eventbrite/oauth/start",
      "remoteMarketplaceConnectionId",
      "userVerified", "fixedEndpointsOnly", "organizationMembershipRequired",
      "automaticRetry", "automaticPagination", "rawToolsEnabled",
    ] {
      try expect(
        compactSource(model).contains(required),
        "Eventbrite desktop contract is missing \(required)")
    }
    try expect(
      compactSource(model).contains(
        "return [.approvalRequired, .allowDirectWrites, .readOnly, .blocked]"
      ),
      "Eventbrite must expose Standard, Direct writes, Read only and No access so Safe and dangerously skipped install policies remain selectable"
    )
  }

  private static func testLumaApplicationsInfrastructureContract() throws {
    let applications = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let model = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let adapter = try readPackageFile("Sources/RelayConsoleCore/LumaProviderActionAdapter.swift")
    let policies = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let foundation = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderFoundationService.swift")
    let wrappers = try readPackageFile(
      "Sources/RelayConsoleCore/RelayProviderWrapperToolCompilerService.swift")
    for required in [
      "mapp-luma", "Customer-owned Luma Calendar API key via Railway", "riskLevel: .high",
      "luma_guest_registration_email_meeting_link_exact_private_address_reads",
      "List up to ten approved managed Events in an explicit date window",
    ] {
      try expect(applications.contains(required), "Luma catalog contract is missing \(required)")
    }
    for required in [
      "luma_user_get", "luma_calendar_get", "luma_calendar_events_list", "luma_event_get",
      "connectors/luma/connections/", "automaticPagination", "rawToolsEnabled",
    ] { try expect(adapter.contains(required), "Luma adapter contract is missing \(required)") }
    try expect(
      policies.contains("private static let lumaTemplates"),
      "Luma must compile provider action policy templates")
    try expect(
      foundation.contains("registerLumaFoundation"), "Luma must register a provider foundation")
    try expect(
      wrappers.contains("relay_luma_list_calendar_events"),
      "Luma must compile fixed agent wrapper tools")
    try expect(
      compactSource(model).contains(
        "return [.approvalRequired, .allowDirectWrites, .readOnly, .blocked]"
      ),
      "Luma must expose Standard, Direct writes, Read only and No access so Safe and dangerously skipped install policies remain selectable"
    )
    let productSource = try productSource()
    try expect(
      !productSource.contains("marketplace-logo-luma.svg"),
      "Luma must use a generated fallback until an official logo asset is separately reviewed")
  }

  private static func testHopinApplicationsInfrastructureContract() throws {
    let applications = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let model = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let adapter = try readPackageFile("Sources/RelayConsoleCore/HopinProviderActionAdapter.swift")
    let policies = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let foundation = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderFoundationService.swift")
    let wrappers = try readPackageFile(
      "Sources/RelayConsoleCore/RelayProviderWrapperToolCompilerService.swift")
    for required in [
      "mapp-hopin", "name: \"RingCentral Events\"", "formerly Hopin Events",
      "Customer-owned RingCentral Events bearer token via Railway", "riskLevel: .high",
      "hopin_other_organizations_pagination_filter_bulk_download_raw_api",
    ] {
      try expect(
        applications.contains(required),
        "RingCentral Events catalog contract is missing \(required)")
    }
    for required in [
      "hopin_organization_get", "hopin_organization_events_list", "hopin_event_get",
      "hopin_event_schedule_items_list", "connectors/hopin/connections/", "automaticPagination",
      "rawToolsEnabled",
    ] {
      try expect(
        adapter.contains(required), "RingCentral Events adapter contract is missing \(required)")
    }
    try expect(
      policies.contains("private static let hopinTemplates"),
      "RingCentral Events must compile provider action policy templates")
    try expect(
      foundation.contains("registerHopinFoundation"),
      "RingCentral Events must register a provider foundation")
    try expect(
      wrappers.contains("relay_hopin_list_event_schedule_items"),
      "RingCentral Events must compile fixed agent wrapper tools")
    try expect(
      compactSource(model).contains(
        "return [.approvalRequired, .allowDirectWrites, .readOnly, .blocked]"
      ), "RingCentral Events must expose all four intentional authority choices")
    let productSource = try productSource()
    try expect(
      !productSource.contains("marketplace-logo-hopin.svg")
        && !productSource.contains("marketplace-logo-ringcentral-events.svg"),
      "RingCentral Events must use a generated fallback until an official logo is reviewed")
  }

  private static func testTwistApplicationsUIContract() throws {
    let applications = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let model = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let logo = try readPackageFile(
      "Sources/RelayConsoleApp/Resources/Assets/marketplace-logos/marketplace-logo-twist.svg")
    let start = try unwrapRange(
      views.range(of: "struct ApplicationsTwistDetailPanel: View"),
      "missing Twist detail panel")
    let end = try unwrapRange(
      views.range(
        of: "struct ApplicationsLinkedInDetailPanel: View", range: start.upperBound..<views.endIndex
      ),
      "missing panel after Twist")
    let panel = String(views[start.lowerBound..<end.lowerBound])
    for required in [
      "ApplicationsExaHeroCard", "Agents with Twist", "ApplicationsAgentGridScroll",
      "ApplicationsAgentAuthorityRow", "Manage API Connection", "ApplicationsConnectionFormGrid",
      "No Twist connections", "Capabilities", "What Agents Can Do", "Requirements",
      "Remove the integration in Twist", "No direct messages, search, attachments, writes",
      "ViewThatFits(in: .horizontal)", "Active connection:", "agents connected to Twist",
      "Connect agent to Twist?", "Disconnect Twist for this agent?",
      "Disconnect and delete Twist connection?", ".frame(minHeight: 86",
    ] {
      try expect(
        panel.localizedCaseInsensitiveContains(required), "Twist UI contract is missing \(required)"
      )
    }
    for required in [
      "mapp-twist", "Relay-owned Twist OAuth via Railway", "twist_direct_messages",
      "twist_global_search", "twist_thread_comment_channel_mutations",
      "List bounded workspaces and channels", "Read one thread with up to thirty recent comments",
    ] {
      try expect(applications.contains(required), "Twist catalog contract is missing \(required)")
    }
    for required in [
      "startTwistOAuthConnect", "setTwistAgentConnection", "testTwistConnection",
      "deleteTwistConnection", "connectors/twist/oauth/start", "remoteMarketplaceConnectionId",
      "userVerified", "fixedEndpointsOnly", "readOnlyScopes", "automaticRetry",
      "automaticPagination", "rawToolsEnabled",
    ] {
      try expect(
        compactSource(model).contains(required), "Twist desktop contract is missing \(required)")
    }
    try expect(
      compactSource(model).contains(
        "return [.approvalRequired, .allowDirectWrites, .readOnly, .blocked]"),
      "Twist must expose all four authority choices")
    for scope in ["user:read", "workspaces:read", "channels:read", "threads:read", "comments:read"]
    {
      try expect(
        views.contains(scope) && compactSource(model).contains(scope),
        "Twist exact scope is missing: \(scope)")
    }
    try expect(
      views.contains("case \"twist\": self = .twist")
        && views.contains("case .twist: return (\"marketplace-logo-twist\", \"svg\")"),
      "Twist official icon must be available to the shared sidebar and hero icon view")
    try expect(
      logo.contains("https://twist.com/assets/favicons/icon.svg")
        && logo.contains("fill=\"#008AA6\""),
      "Twist official icon source and mark are missing")
  }

  private static func testWebexApplicationsUIContract() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let model = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let applications = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let start = try unwrapRange(
      views.range(of: "struct ApplicationsWebexDetailPanel: View"), "missing Webex detail panel")
    let end = try unwrapRange(
      views.range(
        of: "struct ApplicationsLinkedInDetailPanel: View", range: start.upperBound..<views.endIndex
      ), "missing panel after Webex")
    let panel = String(views[start.lowerBound..<end.lowerBound])
    for required in [
      "ApplicationsExaHeroCard", "Agents with Webex", "ApplicationsAgentGridScroll",
      "ApplicationsAgentAuthorityRow", "Manage API Connection", "ApplicationsConnectionFormGrid",
      "No Webex connections", "Capabilities", "What Agents Can Do", "Requirements",
      "three fixed read-only", "spark:people_read", "meeting:schedules_read",
      "No identities, join links, meeting writes, messaging, attendees, transcripts, recordings, admin, pagination or raw API",
    ] {
      try expect(
        panel.localizedCaseInsensitiveContains(required), "Webex UI contract is missing \(required)"
      )
    }
    for required in [
      "mapp-webex", "Relay-owned Webex OAuth via Railway",
      "webex_invitees_registrants_attendees", "webex_transcripts_recordings_summaries",
      "List up to ten accessible Webex meetings",
      "Inspect one first-page meeting's bounded schedule fields",
    ] {
      try expect(applications.contains(required), "Webex catalog contract is missing \(required)")
    }
    for required in [
      "startWebexOAuthConnect", "setWebexAgentConnection", "testWebexConnection",
      "deleteWebexConnection", "connectors/webex/oauth/start", "remoteMarketplaceConnectionId",
      "personVerified", "fixedEndpointsOnly", "automaticRetry", "automaticPagination",
      "rawToolsEnabled",
    ] {
      try expect(
        compactSource(model).contains(required), "Webex desktop contract is missing \(required)")
    }
    try expect(
      compactSource(model).contains(
        "return [.approvalRequired, .allowDirectWrites, .readOnly, .blocked]"),
      "Webex must expose Safe and dangerous authority choices")
  }

  private static func testZohoMailApplicationsUIContract() throws {
    let applications = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let model = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let start = try unwrapRange(
      views.range(of: "struct ApplicationsZohoMailDetailPanel: View"),
      "missing Zoho Mail detail panel")
    let end = try unwrapRange(
      views.range(
        of: "struct ApplicationsLinkedInDetailPanel: View", range: start.upperBound..<views.endIndex
      ),
      "missing panel after Zoho Mail")
    let panel = String(views[start.lowerBound..<end.lowerBound])
    for required in [
      "ApplicationsExaHeroCard", "Agents with Zoho Mail", "ApplicationsAgentGridScroll",
      "ApplicationsAgentAuthorityRow", "Manage API Connection", "ApplicationsConnectionFormGrid",
      "No Zoho Mail connections", "Capabilities", "What Agents Can Do", "Requirements",
      "Read only and No access", "regional Accounts and Mail hosts", "four fixed read-only",
      "No sending, drafts, mutations, attachment downloads, administration, export, pagination, or raw API",
      "Connect agent to Zoho Mail?", "Revoke and delete Zoho Mail connection?",
    ] {
      try expect(
        panel.localizedCaseInsensitiveContains(required),
        "Zoho Mail UI contract is missing \(required)")
    }
    let requiredOrder = [
      "ApplicationsExaHeroCard", "ApplicationsAgentGridScroll", "Manage API Connection",
      "ApplicationsInfoCardsLayout", "Capabilities", "What Agents Can Do", "Requirements",
    ]
    var cursor = panel.startIndex
    for required in requiredOrder {
      guard let range = panel.range(of: required, range: cursor..<panel.endIndex) else {
        throw SourceHygieneTestFailure("Zoho Mail UI contract order is missing \(required)")
      }
      cursor = range.upperBound
    }
    try expect(
      !panel.contains(".onTapGesture"),
      "Zoho Mail agent cards must not toggle assignment from card clicks")
    try expect(
      panel.contains("target.unavailableReason ?? \"Unavailable\""),
      "Zoho Mail incompatible agent rows must show the unavailable reason")
    try expect(
      compactSource(panel).contains("if busy { ProgressView()"),
      "Zoho Mail busy agent rows must replace the switch with progress")
    try expect(
      panel.contains("pending = !isOn"),
      "Zoho Mail assignment must use the explicit switch button")
    for required in [
      "mapp-zoho-mail", "Relay-owned Zoho Mail OAuth via Railway",
      "zoho_mail_send_reply_forward_draft", "zoho_mail_organization_admin_user_group_policy",
      "List authenticated Zoho Mail accounts",
      "Read one explicit message with sanitized bounded text",
      "iconFallback(slug: \"zoho-mail\", name: \"Zoho Mail\")",
    ] {
      try expect(
        applications.contains(required), "Zoho Mail catalog contract is missing \(required)")
    }
    for required in [
      "startZohoMailOAuthConnect", "selectZohoMailConnection", "setZohoMailAgentConnection",
      "testZohoMailConnection", "deleteZohoMailConnection", "connectors/zoho-mail/oauth/start",
      "remoteMarketplaceConnectionId", "railwayCallbackOnly", "stateVerified", "accountVerified",
      "regionalAuthorityBound", "fixedEndpointsOnly", "readOnlyScopes", "writesEnabled",
      "attachmentDownloadsEnabled", "automaticPagination", "rawToolsEnabled",
    ] {
      try expect(
        compactSource(model).contains(required), "Zoho Mail desktop contract is missing \(required)"
      )
    }
    for scope in ["ZohoMail.accounts.READ", "ZohoMail.folders.READ", "ZohoMail.messages.READ"] {
      try expect(
        applications.contains(scope) && views.contains(scope)
          && compactSource(model).contains(scope),
        "Zoho Mail exact scope is missing: \(scope)")
    }
    for forbidden in [".ALL", ".CREATE", ".UPDATE", ".DELETE"] {
      let catalogStart = try unwrapRange(
        applications.range(of: "private static func marketplaceZohoMailApp"),
        "missing Zoho Mail catalog function")
      let catalogEnd = try unwrapRange(
        applications.range(
          of: "private static func marketplaceWebexApp",
          range: catalogStart.upperBound..<applications.endIndex),
        "missing catalog function after Zoho Mail")
      let catalog = String(applications[catalogStart.lowerBound..<catalogEnd.lowerBound])
      try expect(
        !catalog.contains(forbidden), "Zoho Mail catalog must not request \(forbidden) authority")
    }
  }

  private static func testGoToMeetingApplicationsUIContract() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let model = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let applications = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let start = try unwrapRange(
      views.range(of: "struct ApplicationsGoToMeetingDetailPanel: View"),
      "missing GoTo detail panel")
    let end = try unwrapRange(
      views.range(
        of: "struct ApplicationsLinkedInDetailPanel: View", range: start.upperBound..<views.endIndex
      ), "missing panel after GoTo Meeting")
    let panel = String(views[start.lowerBound..<end.lowerBound])
    for required in [
      "ApplicationsExaHeroCard", "Agents with GoTo Meeting", "ApplicationsAgentGridScroll",
      "ApplicationsAgentAuthorityRow", "Manage API Connection", "ApplicationsConnectionFormGrid",
      "No GoTo Meeting connections", "Capabilities", "What Agents Can Do", "Requirements",
      "GoTo Meeting-only client", "three fixed", "conditionally rotating 30-day refresh token",
      "No identities, join links, credentials, writes, attendees, history, recordings, transcripts, AI summaries, admin, pagination or raw API",
    ] {
      try expect(
        panel.localizedCaseInsensitiveContains(required),
        "GoTo Meeting UI contract is missing \(required)")
    }
    for required in [
      "mapp-goto-meeting", "Relay-owned GoTo Meeting OAuth via Railway",
      "sourceType: .externalProvider, riskLevel: .high",
      "goto_meeting_attendees_attendance", "goto_meeting_recordings_transcripts_ai_summaries",
      "List up to ten upcoming GoTo Meeting schedules",
      "Inspect one first-ten Meeting's bounded schedule fields",
    ] {
      try expect(
        applications.contains(required), "GoTo Meeting catalog contract is missing \(required)")
    }
    for required in [
      "startGoToMeetingOAuthConnect", "setGoToMeetingAgentConnection", "testGoToMeetingConnection",
      "deleteGoToMeetingConnection", "connectors/goto-meeting/oauth/start",
      "remoteMarketplaceConnectionId",
      "identityVerified", "organizerBound", "gotoMeetingClientOnly", "fixedEndpointsOnly",
      "automaticRetry", "automaticPagination", "rawToolsEnabled",
    ] {
      try expect(
        compactSource(model).contains(required),
        "GoTo Meeting desktop contract is missing \(required)")
    }
    try expect(
      compactSource(model).contains(
        "return [.approvalRequired, .allowDirectWrites, .readOnly, .blocked]"
      ),
      "GoTo Meeting must expose Safe and dangerous authority choices")
  }

  private static func testRingCentralApplicationsUIContract() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let model = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let applications = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let start = try unwrapRange(
      views.range(of: "struct ApplicationsRingCentralDetailPanel: View"),
      "missing RingCentral detail panel")
    let end = try unwrapRange(
      views.range(
        of: "struct ApplicationsLinkedInDetailPanel: View", range: start.upperBound..<views.endIndex
      ), "missing panel after RingCentral")
    let panel = String(views[start.lowerBound..<end.lowerBound])
    for required in [
      "ApplicationsExaHeroCard", "Agents with RingCentral", "ApplicationsAgentGridScroll",
      "ApplicationsAgentAuthorityRow", "Manage API Connection", "ApplicationsConnectionFormGrid",
      "No RingCentral connections", "Capabilities", "What Agents Can Do", "Requirements",
      "ReadAccounts", "ReadCallLog", "single-use refresh", "first-ten detail preflight",
      "No identities, raw numbers, other extensions, detailed legs, recordings, messages, calling, admin, other products, later pages, writes, or raw API",
    ] {
      try expect(
        panel.localizedCaseInsensitiveContains(required),
        "RingCentral UI contract is missing \(required)")
    }
    for required in [
      "mapp-ringcentral", "Relay-owned RingCentral OAuth via Railway",
      "sourceType: .externalProvider, riskLevel: .high", "ringcentral_names_numbers_email_ids",
      "ringcentral_recordings_content_detailed_legs_telephony_sessions",
      "Verify the exact connected RingCentral extension",
      "List up to ten privacy-masked first-page call records",
    ] {
      try expect(
        applications.contains(required), "RingCentral catalog contract is missing \(required)")
    }
    for required in [
      "startRingCentralOAuthConnect", "setRingCentralAgentConnection", "testRingCentralConnection",
      "deleteRingCentralConnection", "connectors/ringcentral/oauth/start",
      "remoteMarketplaceConnectionId", "extensionVerified", "selfExtensionOnly",
      "canonicalPlatformOnly", "privacyMasked", "fixedEndpointsOnly", "automaticRetry",
      "automaticPagination", "rawToolsEnabled",
    ] {
      try expect(
        compactSource(model).contains(required),
        "RingCentral desktop contract is missing \(required)")
    }
    try expect(
      !panel.contains(".onTapGesture"),
      "RingCentral agent cards must not toggle assignment from card clicks")
    try expect(
      compactSource(panel).contains("Button { pending = !isOn }"),
      "RingCentral assignment must use the explicit switch button")
    try expect(
      panel.contains(".alert("), "RingCentral assignment changes must require confirmation")
    try expect(
      compactSource(model).contains(
        "return [.approvalRequired, .allowDirectWrites, .readOnly, .blocked]"
      ), "RingCentral must expose Safe and dangerous authority choices")
    try expect(
      !productSource().contains("marketplace-logo-ringcentral."),
      "RingCentral must use a generated fallback until an official logo is reviewed")
  }

  private static func testDialpadApplicationsUIContract() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let model = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let applications = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let policies = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let foundation = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderFoundationService.swift")
    let adapter = try readPackageFile("Sources/RelayConsoleCore/DialpadProviderActionAdapter.swift")
    let start = try unwrapRange(
      views.range(of: "struct ApplicationsDialpadDetailPanel: View"), "missing Dialpad detail panel"
    )
    let end = try unwrapRange(
      views.range(
        of: "struct ApplicationsLinkedInDetailPanel: View", range: start.upperBound..<views.endIndex
      ), "missing panel after Dialpad")
    let panel = String(views[start.lowerBound..<end.lowerBound])
    for required in [
      "ApplicationsExaHeroCard", "Agents with Dialpad", "ApplicationsAgentGridScroll",
      "ApplicationsAgentAuthorityRow", "Manage API Connection", "ApplicationsConnectionFormGrid",
      "No Dialpad connections", "Capabilities", "What Agents Can Do", "Requirements",
      "offline_access", "default/basic app authority", "S256 PKCE", "current schema",
      "forwarding numbers excluded", "strict JSON and 512 KiB responses",
      "No provider IDs, email, extension, organization data, forwarding numbers, calls, recordings, transcripts, messages, special scopes, admin, pagination, writes or raw API",
    ] {
      try expect(
        panel.localizedCaseInsensitiveContains(required),
        "Dialpad UI contract is missing \(required)")
    }
    for required in [
      "mapp-dialpad", "Relay-owned Dialpad OAuth via Railway",
      "dialpad_identity_email_extension_company_office_groups_admin",
      "dialpad_recordings_export_message_content_export_forwarding_numbers",
      "Verify the exact connected Dialpad user", "Inspect bounded privacy-masked Caller ID choices",
    ] {
      try expect(applications.contains(required), "Dialpad catalog contract is missing \(required)")
    }
    for required in [
      "startDialpadOAuthConnect", "setDialpadAgentConnection", "testDialpadConnection",
      "deleteDialpadConnection", "connectors/dialpad/oauth/start", "remoteMarketplaceConnectionId",
      "userVerified", "selfUserOnly", "canonicalDialpadOnly", "privacyMasked", "forwardingNumbers",
      "maxResponseBytes", "fixedEndpointsOnly", "automaticRetry", "automaticPagination",
      "rawToolsEnabled",
    ] {
      try expect(
        compactSource(model).contains(required), "Dialpad desktop contract is missing \(required)")
    }
    try expect(
      !panel.contains(".onTapGesture"),
      "Dialpad agent cards must not toggle assignment from card clicks")
    try expect(
      compactSource(panel).contains("Button { pending = !isOn }"),
      "Dialpad assignment must use the explicit switch button")
    try expect(panel.contains(".alert("), "Dialpad assignment changes must require confirmation")
    try expect(
      compactSource(model).contains(
        "return [.approvalRequired, .allowDirectWrites, .readOnly, .blocked]"
      ), "Dialpad must expose Safe and dangerous authority choices")
    for required in ["riskLevel: .high", "provider IDs", "forwarding numbers"] {
      try expect(
        policies.localizedCaseInsensitiveContains(required),
        "Dialpad policy contract is missing \(required)")
    }
    for required in [
      "maxResponseBytes", "providerIdentityEmailExtensionOrganization", "forwardingNumbers",
    ] {
      try expect(
        foundation.contains(required), "Dialpad foundation contract is missing \(required)")
    }
    for required in [
      "userBindingVerified", "activeCallerIdBlocked", "truncated", "forwardingNumbers",
      "maxResponseBytes",
    ] { try expect(adapter.contains(required), "Dialpad adapter contract is missing \(required)") }
    for forbidden in [
      "\"userId\": .string", "\"primaryEmail\": .string", "\"extension\": .string",
      "\"companyId\": .string", "\"officeId\": .string",
    ] {
      try expect(
        !adapter.contains(forbidden),
        "Dialpad adapter must not expose sensitive fake identity field \(forbidden)")
    }
    try expect(
      !productSource().contains("marketplace-logo-dialpad."),
      "Dialpad must use a generated fallback until an official logo is reviewed")
  }

  private static func testAircallApplicationsUIContract() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let model = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let applications = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let policies = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let foundation = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderFoundationService.swift")
    let adapter = try readPackageFile("Sources/RelayConsoleCore/AircallProviderActionAdapter.swift")
    let wrappers = try readPackageFile(
      "Sources/RelayConsoleCore/RelayProviderWrapperToolCompilerService.swift")
    let start = try unwrapRange(
      views.range(of: "struct ApplicationsAircallDetailPanel: View"), "missing Aircall detail panel"
    )
    let end = try unwrapRange(
      views.range(
        of: "struct ApplicationsOpenPhoneDetailPanel: View",
        range: start.upperBound..<views.endIndex), "missing panel after Aircall")
    let panel = String(views[start.lowerBound..<end.lowerBound])
    for required in [
      "ApplicationsExaHeroCard", "Agents with Aircall", "ApplicationsAgentGridScroll",
      "ApplicationsAgentAuthorityRow", "No Aircall connections", "public_api", "privacy-masked",
      "strict JSON and 512 KiB responses",
      "No installer identity, users, raw digits, calls, messages, recordings, transcripts, routing, writes, pagination, exports or raw API",
    ] {
      try expect(
        panel.localizedCaseInsensitiveContains(required),
        "Aircall UI contract is missing \(required)")
    }
    for required in [
      "mapp-aircall", "Relay-owned Aircall OAuth via Railway",
      "aircall_installer_identity_users_teams_roles_admin",
      "Read bounded connected-company aggregates", "Inspect bounded privacy-masked phone numbers",
    ] {
      try expect(applications.contains(required), "Aircall catalog contract is missing \(required)")
    }
    for required in [
      "startAircallOAuthConnect", "setAircallAgentConnection", "testAircallConnection",
      "deleteAircallConnection", "connectors/aircall/oauth/start", "companyBindingVerified",
      "integrationActive", "canonicalAircallOnly", "privacyMasked", "maxResponseBytes",
      "fixedEndpointsOnly", "automaticRetry", "automaticPagination", "rawToolsEnabled",
    ] {
      try expect(
        compactSource(model).contains(required), "Aircall desktop contract is missing \(required)")
    }
    try expect(
      !panel.contains(".onTapGesture"),
      "Aircall agent cards must not toggle assignment from card clicks")
    try expect(
      compactSource(panel).contains("Button { pending = !isOn }"),
      "Aircall assignment must use the explicit switch button")
    try expect(panel.contains(".alert("), "Aircall assignment changes must require confirmation")
    try expect(
      compactSource(model).contains(
        "return [.approvalRequired, .allowDirectWrites, .readOnly, .blocked]"
      ), "Aircall must expose Safe and dangerous authority choices")
    for required in ["riskLevel: .high", "public_api", "company_read", "phone_number_read"] {
      try expect(
        policies.localizedCaseInsensitiveContains(required),
        "Aircall policy contract is missing \(required)")
    }
    for required in [
      "maxProviderRequestsPerAction", "connectedCompanyOnly", "privacyMaskedNumbers",
      "firstPageOnly",
    ] {
      try expect(
        foundation.contains(required), "Aircall foundation contract is missing \(required)")
    }
    for required in [
      "companyBindingVerified", "truncated", "privacyMasked", "communications", "maxResponseBytes",
    ] { try expect(adapter.contains(required), "Aircall adapter contract is missing \(required)") }
    for required in [
      "aircall_company_get", "relay_aircall_get_company", "aircall_numbers_list",
      "relay_aircall_list_numbers",
    ] { try expect(wrappers.contains(required), "Aircall wrapper compiler is missing \(required)") }
    for forbidden in [
      "\"integrationId\": .string", "\"companyId\": .string", "\"installerEmail\": .string",
      "\"rawDigits\": .string",
    ] {
      try expect(
        !adapter.contains(forbidden),
        "Aircall adapter must not expose sensitive fake field \(forbidden)")
    }
    try expect(
      !productSource().contains("marketplace-logo-aircall."),
      "Aircall must use a generated fallback until an official logo is reviewed")
  }

  private static func testOpenPhoneApplicationsUIContract() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let model = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let applications = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let policies = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let foundation = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderFoundationService.swift")
    let adapter = try readPackageFile(
      "Sources/RelayConsoleCore/OpenPhoneProviderActionAdapter.swift")
    let wrappers = try readPackageFile(
      "Sources/RelayConsoleCore/RelayProviderWrapperToolCompilerService.swift")
    let start = try unwrapRange(
      views.range(of: "struct ApplicationsOpenPhoneDetailPanel: View"), "missing Quo detail panel")
    let end = try unwrapRange(
      views.range(
        of: "struct ApplicationsTwilioDetailPanel: View", range: start.upperBound..<views.endIndex),
      "missing panel after Quo")
    let panel = String(views[start.lowerBound..<end.lowerBound])
    for required in [
      "ApplicationsExaHeroCard", "Agents with Quo", "ApplicationsAgentGridScroll",
      "ApplicationsAgentAuthorityRow", "Workspace API key", "SecureField", "No Quo connections",
      "raw Authorization", "first ten labels", "strict JSON", "512 KiB",
      "Delete the key manually in Quo Workspace Settings", "developer registration",
      "written monetization approval",
      "No users, contacts, provider IDs, forwarding, calls, messages, recordings, transcripts",
    ] {
      try expect(
        panel.localizedCaseInsensitiveContains(required), "Quo UI contract is missing \(required)")
    }
    for required in [
      "mapp-openphone", "Quo (formerly OpenPhone)", "Encrypted Quo API key via Railway",
      "openphone_users_owner_admin_identity_email_roles_groups",
      "Inspect bounded privacy-masked workspace phone numbers",
    ] { try expect(applications.contains(required), "Quo catalog contract is missing \(required)") }
    for required in [
      "saveOpenPhoneRailwayConnection", "setOpenPhoneAgentConnection", "testOpenPhoneConnection",
      "deleteOpenPhoneConnection", "OPENPHONE_API_KEY", "connectors/openphone/connections",
      "credentialOwnership == .userOwned", "keyValidated", "fullAccessWorkspaceKeyReadSurfaceOnly",
      "rawAuthorizationHeader", "privacyMasked", "maxPhoneNumbers", "maxResponseBytes",
      "automaticRetry", "automaticPagination", "rawToolsEnabled",
    ] {
      try expect(
        compactSource(model).contains(required), "Quo desktop contract is missing \(required)")
    }
    try expect(
      !panel.contains(".onTapGesture"),
      "Quo agent cards must not toggle assignment from card clicks")
    try expect(
      compactSource(panel).contains("Button { pending = !isOn }"),
      "Quo assignment must use the explicit switch button")
    try expect(panel.contains(".alert("), "Quo assignment changes must require confirmation")
    try expect(
      compactSource(model).contains(
        "return [.approvalRequired, .allowDirectWrites, .readOnly, .blocked]"
      ), "Quo must expose Safe and dangerous authority choices")
    for required in [
      "riskLevel: .high", "openphone_phone_numbers_list", "phone_number_read", "requiredScopes: []",
    ] { try expect(policies.contains(required), "Quo policy contract is missing \(required)") }
    for required in [
      "maxWrapperTools", "maxProviderRequestsPerAction", "fullAccessWorkspaceKey",
      "privacyMaskedNumbers", "writesBillingLaterPagesRaw",
    ] {
      try expect(foundation.contains(required), "Quo foundation contract is missing \(required)")
    }
    for required in [
      "openphone_phone_numbers_list", "privacyMasked", "fullAccessWorkspaceKey", "communications",
      "automaticRetry", "automaticPagination", "maxResponseBytes",
    ] { try expect(adapter.contains(required), "Quo adapter contract is missing \(required)") }
    for required in ["openphone_phone_numbers_list", "relay_openphone_list_phone_numbers"] {
      try expect(wrappers.contains(required), "Quo wrapper compiler is missing \(required)")
    }
    for forbidden in [
      "\"providerId\": .string", "\"email\": .string", "\"rawNumber\": .string",
      "\"forward\": .string",
    ] {
      try expect(
        !adapter.contains(forbidden),
        "Quo adapter must not expose sensitive fake field \(forbidden)")
    }
    try expect(
      !productSource().contains("marketplace-logo-openphone."),
      "Quo must use a generated fallback until an official logo is reviewed")
  }

  private static func testTwilioApplicationsUIContract() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let model = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let applications = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let policies = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let foundation = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderFoundationService.swift")
    let adapter = try readPackageFile("Sources/RelayConsoleCore/TwilioProviderActionAdapter.swift")
    let wrappers = try readPackageFile(
      "Sources/RelayConsoleCore/RelayProviderWrapperToolCompilerService.swift")
    let start = try unwrapRange(
      views.range(of: "struct ApplicationsTwilioDetailPanel: View"), "missing Twilio detail panel")
    let end = try unwrapRange(
      views.range(
        of: "struct ApplicationsVonageDetailPanel: View", range: start.upperBound..<views.endIndex),
      "missing panel after Twilio")
    let panel = String(views[start.lowerBound..<end.lowerBound])
    for required in [
      "ApplicationsExaHeroCard", "Agents with Twilio", "ApplicationsAgentGridScroll",
      "ApplicationsAgentAuthorityRow", "Restricted API key", "TextField", "SecureField",
      "No Twilio connections", "HTTP Basic", "PageSize=10", "masked last-four", "strict JSON",
      "512 KiB", "Delete the Restricted API key in Twilio Console", "Messages GET permission",
      "No bodies, media, SIDs, full addresses, prices, error details, sends, calls",
    ] {
      try expect(
        panel.localizedCaseInsensitiveContains(required),
        "Twilio UI contract is missing \(required)")
    }
    for required in [
      "mapp-twilio", "Customer-owned Twilio Restricted API key",
      "Encrypted Twilio Restricted API key via Railway",
      "twilio_message_bodies_media_sids_account_identity",
      "Inspect bounded privacy-masked message delivery statuses",
    ] {
      try expect(applications.contains(required), "Twilio catalog contract is missing \(required)")
    }
    for required in [
      "saveTwilioRailwayConnection", "setTwilioAgentConnection", "testTwilioConnection",
      "deleteTwilioConnection", "TWILIO_ACCOUNT_SID", "TWILIO_API_KEY_SID", "TWILIO_API_KEY_SECRET",
      "connectors/twilio/connections", "credentialOwnership == .userOwned", "keyValidated",
      "restrictedMessageReadOnly", "basicAPIKeyAuthentication", "canonicalTwilioOnly",
      "privacyMasked", "maxMessageStatuses", "maxResponseBytes", "automaticRetry",
      "automaticPagination", "rawToolsEnabled",
    ] {
      try expect(
        compactSource(model).contains(required), "Twilio desktop contract is missing \(required)")
    }
    try expect(
      !panel.contains(".onTapGesture"),
      "Twilio agent cards must not toggle assignment from card clicks")
    try expect(
      compactSource(panel).contains("Button { pending = !isOn }"),
      "Twilio assignment must use the explicit switch button")
    try expect(panel.contains(".alert("), "Twilio assignment changes must require confirmation")
    try expect(
      compactSource(model).contains(
        "return [.approvalRequired, .allowDirectWrites, .readOnly, .blocked]"
      ), "Twilio must expose Safe and dangerous authority choices")
    for required in [
      "riskLevel: .high", "twilio_messages_list", "message_status_read", "requiredScopes: []",
    ] { try expect(policies.contains(required), "Twilio policy contract is missing \(required)") }
    for required in [
      "maxWrapperTools", "maxProviderRequestsPerAction", "restrictedMessageReadOnly",
      "privacyMaskedAddresses", "administrationWritesPaginationRaw",
    ] {
      try expect(foundation.contains(required), "Twilio foundation contract is missing \(required)")
    }
    for required in [
      "twilio_messages_list", "privacyMasked", "restrictedMessageReadOnly", "communications",
      "automaticRetry", "automaticPagination", "maxResponseBytes",
    ] { try expect(adapter.contains(required), "Twilio adapter contract is missing \(required)") }
    for required in ["twilio_messages_list", "relay_twilio_list_message_statuses"] {
      try expect(wrappers.contains(required), "Twilio wrapper compiler is missing \(required)")
    }
    for forbidden in [
      "\"body\": .string", "\"sid\": .string", "\"accountSid\": .string", "\"price\": .string",
      "\"errorMessage\": .string",
    ] {
      try expect(
        !adapter.contains(forbidden),
        "Twilio adapter must not expose sensitive fake field \(forbidden)")
    }
  }

  private static func testVonageApplicationsUIContract() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let model = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let applications = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let policies = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let foundation = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderFoundationService.swift")
    let adapter = try readPackageFile("Sources/RelayConsoleCore/VonageProviderActionAdapter.swift")
    let wrappers = try readPackageFile(
      "Sources/RelayConsoleCore/RelayProviderWrapperToolCompilerService.swift")
    let start = try unwrapRange(
      views.range(of: "struct ApplicationsVonageDetailPanel: View"), "missing Vonage detail panel")
    let end = try unwrapRange(
      views.range(
        of: "struct ApplicationsMessageBirdDetailPanel: View",
        range: start.upperBound..<views.endIndex), "missing panel after Vonage")
    let panel = String(views[start.lowerBound..<end.lowerBound])
    for required in [
      "ApplicationsExaHeroCard", "Agents with Vonage", "ApplicationsAgentGridScroll",
      "ApplicationsAgentAuthorityRow", "Manage API Connection", "TextField", "SecureField",
      "No Vonage connections", "dedicated secondary", "HTTP Basic",
      "rest.nexmo.com/account/get-balance", "balanceEUR", "autoReloadEnabled", "strict JSON",
      "64 KiB", "Revoke the dedicated secondary secret in Vonage Dashboard API Settings",
      "No SMS, WhatsApp, RCS, voice, video, Verify",
    ] {
      try expect(
        panel.localizedCaseInsensitiveContains(required),
        "Vonage UI contract is missing \(required)")
    }
    for required in [
      "mapp-vonage", "Customer-owned Vonage API key and secondary secret",
      "Encrypted Vonage secondary API secret via Railway",
      "vonage_sms_mms_whatsapp_rcs_voice_video_verify",
      "Read the current EUR account balance and auto-reload state",
    ] {
      try expect(applications.contains(required), "Vonage catalog contract is missing \(required)")
    }
    for required in [
      "saveVonageRailwayConnection", "setVonageAgentConnection", "testVonageConnection",
      "deleteVonageConnection", "VONAGE_API_KEY", "VONAGE_API_SECRET",
      "connectors/vonage/connections", "credentialOwnership == .userOwned", "keyValidated",
      "dedicatedSecondarySecretRequired", "fullAccountSecretReadSurfaceOnly", "basicAuthentication",
      "canonicalNexmoOnly", "financialReadOnly", "balanceCurrency", "maxResponseBytes",
      "automaticRetry", "automaticPagination", "rawToolsEnabled",
    ] {
      try expect(
        compactSource(model).contains(required), "Vonage desktop contract is missing \(required)")
    }
    try expect(
      !panel.contains(".onTapGesture"),
      "Vonage agent cards must not toggle assignment from card clicks")
    try expect(
      compactSource(panel).contains("Button { pending = !isOn }"),
      "Vonage assignment must use the explicit switch button")
    try expect(panel.contains(".alert("), "Vonage assignment changes must require confirmation")
    try expect(
      compactSource(model).contains(
        "return [.approvalRequired, .allowDirectWrites, .readOnly, .blocked]"),
      "Vonage must expose Safe and dangerous authority choices")
    for required in [
      "riskLevel: .high", "vonage_account_balance_get", "account_balance_read",
      "requiredScopes: []",
    ] { try expect(policies.contains(required), "Vonage policy contract is missing \(required)") }
    for required in [
      "maxWrapperTools", "maxProviderRequestsPerAction", "fullAccountSecret",
      "dedicatedSecondarySecretRequired", "financialReadOnly", "topupsSettingsSecretAdminWritesRaw",
    ] {
      try expect(foundation.contains(required), "Vonage foundation contract is missing \(required)")
    }
    for required in [
      "vonage_account_balance_get", "financialReadOnly", "fullAccountSecret", "communications",
      "automaticRetry", "automaticPagination", "maxResponseBytes",
    ] { try expect(adapter.contains(required), "Vonage adapter contract is missing \(required)") }
    for required in ["vonage_account_balance_get", "relay_vonage_get_account_balance"] {
      try expect(wrappers.contains(required), "Vonage wrapper compiler is missing \(required)")
    }
    for forbidden in [
      "\"apiKey\": .string", "\"secret\": .string", "\"accountId\": .string",
      "\"requestId\": .string", "\"topUpReference\": .string",
    ] {
      try expect(
        !adapter.contains(forbidden),
        "Vonage adapter must not expose sensitive fake field \(forbidden)")
    }
    try expect(
      !productSource().contains("marketplace-logo-vonage."),
      "Vonage must use a generated fallback until an official logo is reviewed")
  }

  private static func testMessageBirdApplicationsUIContract() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let model = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let applications = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let policies = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let foundation = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderFoundationService.swift")
    let adapter = try readPackageFile(
      "Sources/RelayConsoleCore/MessageBirdProviderActionAdapter.swift")
    let wrappers = try readPackageFile(
      "Sources/RelayConsoleCore/RelayProviderWrapperToolCompilerService.swift")
    let start = try unwrapRange(
      views.range(of: "struct ApplicationsMessageBirdDetailPanel: View"),
      "missing Bird detail panel")
    let end = try unwrapRange(
      views.range(
        of: "struct ApplicationsLINEDetailPanel: View", range: start.upperBound..<views.endIndex),
      "missing panel after Bird")
    let panel = String(views[start.lowerBound..<end.lowerBound])
    for required in [
      "ApplicationsExaHeroCard", "Agents with Bird", "ApplicationsAgentGridScroll",
      "ApplicationsAgentAuthorityRow", "Manage API Connection", "TextField", "SecureField",
      "No Bird connections", "role-bound", "Authorization: AccessKey",
      "api.bird.com/organizations/{organizationId}/workspaces/{workspaceId}", "workspaceStatus",
      "strict JSON", "64 KiB", "Delete the dedicated AccessKey in Bird Security settings",
      "No messages, SMS, WhatsApp, email, voice, Verify",
    ] {
      try expect(
        panel.localizedCaseInsensitiveContains(required), "Bird UI contract is missing \(required)")
    }
    for required in [
      "mapp-messagebird", "Customer-owned role-bound Bird AccessKey",
      "Encrypted Bird AccessKey via Railway", "messagebird_sms_mms_whatsapp_email_voice_verify",
      "Read the selected workspace lifecycle status",
    ] {
      try expect(applications.contains(required), "Bird catalog contract is missing \(required)")
    }
    for required in [
      "saveMessageBirdRailwayConnection", "setMessageBirdAgentConnection",
      "testMessageBirdConnection", "deleteMessageBirdConnection", "MESSAGEBIRD_ORGANIZATION_ID",
      "MESSAGEBIRD_WORKSPACE_ID", "MESSAGEBIRD_ACCESS_KEY", "connectors/messagebird/connections",
      "credentialOwnership == .userOwned", "accessKeyValidated", "dedicatedRoleBoundKeyRequired",
      "selectedWorkspaceMetadataOnly", "accessKeyAuthentication", "canonicalBirdOnly",
      "customerContentBlocked", "maxResponseBytes", "automaticRetry", "automaticPagination",
      "rawToolsEnabled",
    ] {
      try expect(
        compactSource(model).contains(required), "Bird desktop contract is missing \(required)")
    }
    try expect(
      !panel.contains(".onTapGesture"),
      "Bird agent cards must not toggle assignment from card clicks")
    try expect(
      compactSource(panel).contains("Button { pending = !isOn }"),
      "Bird assignment must use the explicit switch button")
    try expect(panel.contains(".alert("), "Bird assignment changes must require confirmation")
    try expect(
      compactSource(model).contains(
        "return [.approvalRequired, .allowDirectWrites, .readOnly, .blocked]"),
      "Bird must expose Safe and dangerous authority choices")
    for required in [
      "riskLevel: .high", "messagebird_workspace_status_get", "workspace_status_read",
      "requiredScopes: []",
    ] { try expect(policies.contains(required), "Bird policy contract is missing \(required)") }
    for required in [
      "maxWrapperTools", "maxProviderRequestsPerAction", "fullAccessKey",
      "dedicatedRoleBoundKeyRequired", "workspaceMetadataOnly",
      "billingAdministrationKeyAdminWritesRaw",
    ] {
      try expect(foundation.contains(required), "Bird foundation contract is missing \(required)")
    }
    for required in [
      "messagebird_workspace_status_get", "workspaceMetadataOnly", "fullAccessKey",
      "customerContent", "automaticRetry", "automaticPagination", "maxResponseBytes",
    ] { try expect(adapter.contains(required), "Bird adapter contract is missing \(required)") }
    for required in ["messagebird_workspace_status_get", "relay_messagebird_get_workspace_status"] {
      try expect(wrappers.contains(required), "Bird wrapper compiler is missing \(required)")
    }
    for forbidden in [
      "\"workspaceId\": .string", "\"organizationId\": .string", "\"accessKey\": .string",
      "\"message\": .string", "\"contact\": .string",
    ] {
      try expect(
        !adapter.contains(forbidden),
        "Bird adapter must not expose sensitive fake field \(forbidden)")
    }
    try expect(
      !productSource().contains("marketplace-logo-messagebird."),
      "Bird must use a generated fallback until an official logo is reviewed")
  }

  private static func testFREDApplicationsUIContract() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let model = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let applications = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let policies = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let foundation = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderFoundationService.swift")
    let adapter = try readPackageFile("Sources/RelayConsoleCore/FREDProviderActionAdapter.swift")
    let wrappers = try readPackageFile(
      "Sources/RelayConsoleCore/RelayProviderWrapperToolCompilerService.swift")
    let start = try unwrapRange(
      views.range(of: "struct ApplicationsFREDDetailPanel: View"), "missing FRED detail panel")
    let end = try unwrapRange(
      views.range(
        of: "struct ApplicationsLINEDetailPanel: View", range: start.upperBound..<views.endIndex),
      "missing panel after FRED")
    let panel = String(views[start.lowerBound..<end.lowerBound])
    for required in [
      "ApplicationsExaHeroCard", "Agents with FRED", "ApplicationsAgentGridScroll",
      "ApplicationsAgentAuthorityRow", "Manage API Connection", "SecureField",
      "No FRED connections", "32-character lowercase", "api.stlouisfed.org", "series/search",
      "series/observations", "256 KiB", "no retry or pagination", "not endorsed or certified",
      "third-party series",
    ] {
      try expect(
        panel.localizedCaseInsensitiveContains(required), "FRED UI contract is missing \(required)")
    }
    for required in [
      "mapp-fred", "Customer-owned FRED API key", "Encrypted FRED API key via Railway",
      "fred_bulk_downloads_pagination_offsets", "Search at most ten economic series",
      "25 newest observations",
    ] {
      try expect(applications.contains(required), "FRED catalog contract is missing \(required)")
    }
    for required in [
      "saveFREDRailwayConnection", "setFREDAgentConnection", "testFREDConnection",
      "deleteFREDConnection", "FRED_API_KEY", "connectors/fred/connections",
      "credentialOwnership == .userOwned", "apiKeyValidated", "publicEconomicDataReadOnly",
      "fixedSeriesRoutesOnly", "queryParameterAuthentication", "maxSeriesResults",
      "maxObservationResults", "maxResponseBytes", "automaticRetry", "automaticPagination",
      "rawToolsEnabled",
    ] {
      try expect(
        compactSource(model).contains(required), "FRED desktop contract is missing \(required)")
    }
    try expect(
      !panel.contains(".onTapGesture"),
      "FRED agent cards must not toggle assignment from card clicks")
    try expect(
      compactSource(panel).contains("Button { pending = !isOn }"),
      "FRED assignment must use the explicit switch button")
    try expect(panel.contains(".alert("), "FRED assignment changes must require confirmation")
    try expect(
      compactSource(model).contains(
        "return [.approvalRequired, .allowDirectWrites, .readOnly, .blocked]"),
      "FRED must expose Safe and dangerous authority choices")
    for required in [
      "riskLevel: .high", "fred_series_search", "fred_series_observations_get", "series_search",
      "series_observations_read", "requiredScopes: []",
    ] { try expect(policies.contains(required), "FRED policy contract is missing \(required)") }
    for required in [
      "maxWrapperTools", "maxProviderRequestsPerAction", "maxSeriesResults",
      "maxObservationResults", "fullAPIKey", "publicEconomicDataReadOnly",
      "thirdPartySeriesRightsReviewRequired", "bulkVintageTransformsBroaderMetadata",
    ] {
      try expect(foundation.contains(required), "FRED foundation contract is missing \(required)")
    }
    for required in [
      "fred_series_search", "fred_series_observations_get", "publicEconomicDataReadOnly", "apiKey",
      "bulkVintageTransforms", "automaticRetry", "automaticPagination", "maxResponseBytes",
    ] { try expect(adapter.contains(required), "FRED adapter contract is missing \(required)") }
    for required in [
      "fred_series_search", "relay_fred_search_series", "fred_series_observations_get",
      "relay_fred_get_series_observations",
    ] { try expect(wrappers.contains(required), "FRED wrapper compiler is missing \(required)") }
    try expect(
      !productSource().contains("marketplace-logo-fred."),
      "FRED must use a generated fallback until an official logo is reviewed")
  }

  private static func testApolloGraphOSApplicationsInfrastructureContract() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let applications = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let policies = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let foundation = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderFoundationService.swift")
    let adapter = try readPackageFile(
      "Sources/RelayConsoleCore/ApolloGraphOSProviderActionAdapter.swift")
    let wrappers = try readPackageFile(
      "Sources/RelayConsoleCore/RelayProviderWrapperToolCompilerService.swift")
    for required in [
      "mapp-apollo-graphql-studio", "Customer-owned graph-scoped API key",
      "Encrypted Apollo graph key and exact graph binding via Railway",
      "shared-apollo-graphos-marketplace", "Read current OCI graph-artifact metadata",
      "Read one exact launch status",
    ] {
      try expect(
        applications.contains(required), "Apollo GraphOS catalog contract is missing \(required)")
    }
    for required in [
      "marketplaceUsesSharedProviderPage", "ApplicationsProviderConnectionPanel",
      "ApplicationsSharedMarketplaceAgentsCard", "startProviderSetup",
    ] {
      try expect(
        views.contains(required), "Apollo GraphOS shared UI infrastructure is missing \(required)")
    }
    for required in [
      "riskLevel: .high", "apollo_graphos_graph_artifact_get", "apollo_graphos_launch_status_get",
      "graph_artifact_metadata_read", "launch_status_read", "requiredScopes: []",
    ] {
      try expect(
        policies.contains(required), "Apollo GraphOS policy contract is missing \(required)")
    }
    for required in [
      "maxWrapperTools", "maxProviderRequestsPerAction", "dedicatedGraphScopedKeyRequired",
      "exactGraphVariantBinding", "schemasOperationsTelemetry", "mutationsAdministrationRawGraphQL",
    ] {
      try expect(
        foundation.contains(required), "Apollo GraphOS foundation contract is missing \(required)")
    }
    for required in [
      "apollo_graphos_graph_artifact_get", "apollo_graphos_launch_status_get",
      "exactGraphVariantBinding", "graphApiKey", "schemasOperationsTelemetryMutations",
      "automaticRetry", "automaticPagination", "maxResponseBytes",
    ] {
      try expect(
        adapter.contains(required), "Apollo GraphOS adapter contract is missing \(required)")
    }
    for required in [
      "apollo_graphos_graph_artifact_get", "relay_apollo_graphos_get_graph_artifact",
      "apollo_graphos_launch_status_get", "relay_apollo_graphos_get_launch_status",
    ] {
      try expect(
        wrappers.contains(required), "Apollo GraphOS wrapper compiler is missing \(required)")
    }
    try expect(
      !productSource().contains("marketplace-logo-apollo-graphql-studio."),
      "Apollo GraphOS must use a generated fallback until an official logo is reviewed")
  }

  private static func testHunterApplicationsInfrastructureContract() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let applications = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let policies = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let foundation = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderFoundationService.swift")
    let adapter = try readPackageFile("Sources/RelayConsoleCore/HunterProviderActionAdapter.swift")
    let wrappers = try readPackageFile(
      "Sources/RelayConsoleCore/RelayProviderWrapperToolCompilerService.swift")
    for required in [
      "mapp-hunter-io", "Customer-owned Hunter API key", "Encrypted Hunter API key via Railway",
      "shared-hunter-bounded-verifier-marketplace", "Read current account usage",
      "Read aggregate email counts for one domain", "Verify one email with credit-aware policy",
    ] {
      try expect(applications.contains(required), "Hunter catalog contract is missing \(required)")
    }
    for required in [
      "marketplaceUsesSharedProviderPage", "ApplicationsSharedMarketplaceAgentsCard",
      "ApplicationsProviderConnectionPanel", "startProviderSetup",
      "marketplaceCredentialRequirements",
    ] {
      try expect(views.contains(required), "Hunter shared UI infrastructure is missing \(required)")
    }
    for required in [
      "riskLevel: .high", "hunter_account_usage_get", "hunter_domain_email_count_get",
      "hunter_email_verify", "account_usage_read", "domain_email_count_read", "email_verification",
      "defaultPermission: .approvalRequired", "requiredScopes: []",
    ] { try expect(policies.contains(required), "Hunter policy contract is missing \(required)") }
    for required in [
      "maxWrapperTools", "maxProviderRequestsPerAction", "maxEmailsPerVerification",
      "verificationCreditCost", "singleExplicitEmailOnly", "emailExcludedFromResultsAndAudit",
      "claimedEmail451DoNotProcess", "contactDiscoveryEnrichmentOutreach",
      "resourceManagementAdminBulkRaw",
    ] {
      try expect(foundation.contains(required), "Hunter foundation contract is missing \(required)")
    }
    for required in [
      "hunter_account_usage_get", "hunter_domain_email_count_get", "hunter_email_verify",
      "singleEmailVerification", "apiKey", "contactDiscoveryEnrichmentOutreach", "automaticRetry",
      "automaticPagination", "maxResponseBytes",
    ] { try expect(adapter.contains(required), "Hunter adapter contract is missing \(required)") }
    for required in [
      "hunter_account_usage_get", "relay_hunter_get_account_usage", "hunter_domain_email_count_get",
      "relay_hunter_get_domain_email_count", "hunter_email_verify", "relay_hunter_verify_email",
    ] { try expect(wrappers.contains(required), "Hunter wrapper compiler is missing \(required)") }
    try expect(
      !productSource().contains("marketplace-logo-hunter-io."),
      "Hunter must use a generated fallback until an official logo is reviewed")
  }

  private static func testSnovApplicationsInfrastructureContract() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let applications = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let policies = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let foundation = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderFoundationService.swift")
    let adapter = try readPackageFile("Sources/RelayConsoleCore/SnovProviderActionAdapter.swift")
    let wrappers = try readPackageFile(
      "Sources/RelayConsoleCore/RelayProviderWrapperToolCompilerService.swift")
    for required in [
      "mapp-snov-io", "Customer-owned Snov.io API client credentials",
      "Encrypted Snov.io API User ID and Secret via Railway",
      "shared-snov-bounded-verifier-marketplace", "Start verification for one explicit email",
      "Read one reduced verification task result",
    ] {
      try expect(applications.contains(required), "Snov.io catalog contract is missing \(required)")
    }
    for required in [
      "marketplaceUsesSharedProviderPage", "ApplicationsSharedMarketplaceAgentsCard",
      "ApplicationsProviderConnectionPanel", "startProviderSetup",
      "marketplaceCredentialRequirements",
    ] {
      try expect(
        views.contains(required), "Snov.io shared UI infrastructure is missing \(required)")
    }
    for required in [
      "riskLevel: .high", "snov_email_verification_start", "snov_email_verification_result_get",
      "email_verification_start", "email_verification_result_read",
      "defaultPermission: .approvalRequired", "requiredScopes: []",
    ] { try expect(policies.contains(required), "Snov.io policy contract is missing \(required)") }
    for required in [
      "maxWrapperTools", "maxProviderRequestsPerAction", "maxEmailsPerStart",
      "verificationCreditCost", "providerRequestsPerMinute", "ephemeralOneHourBearer",
      "emailExcludedFromResultsAndAudit", "hiddenByOwnerDoNotProcess",
      "discoveryEnrichmentProspectsOutreach", "mailboxesWarmupCrmAdminBulkRaw", "webhooks",
    ] {
      try expect(
        foundation.contains(required), "Snov.io foundation contract is missing \(required)")
    }
    for required in [
      "snov_email_verification_start", "snov_email_verification_result_get", "oneEmailPerStart",
      "clientCredentials", "discoveryEnrichmentOutreach", "automaticRetry", "automaticPagination",
      "maxResponseBytes",
    ] { try expect(adapter.contains(required), "Snov.io adapter contract is missing \(required)") }
    for required in [
      "snov_email_verification_start", "relay_snov_start_email_verification",
      "snov_email_verification_result_get", "relay_snov_get_email_verification_result",
    ] { try expect(wrappers.contains(required), "Snov.io wrapper compiler is missing \(required)") }
    try expect(
      !productSource().contains("marketplace-logo-snov-io."),
      "Snov.io must use a generated fallback until an official logo is reviewed")
  }

  private static func testLushaApplicationsInfrastructureContract() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let applications = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let policies = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let foundation = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderFoundationService.swift")
    let adapter = try readPackageFile("Sources/RelayConsoleCore/LushaProviderActionAdapter.swift")
    let wrappers = try readPackageFile(
      "Sources/RelayConsoleCore/RelayProviderWrapperToolCompilerService.swift")
    for required in [
      "mapp-lusha", "Customer-owned Lusha API key", "Encrypted Lusha API key via Railway",
      "shared-lusha-account-governance-marketplace",
      "Read reduced Lusha account usage and plan governance",
    ] {
      try expect(applications.contains(required), "Lusha catalog contract is missing \(required)")
    }
    for required in [
      "marketplaceUsesSharedProviderPage", "ApplicationsSharedMarketplaceAgentsCard",
      "ApplicationsProviderConnectionPanel", "startProviderSetup",
      "marketplaceCredentialRequirements",
    ] {
      try expect(views.contains(required), "Lusha shared UI infrastructure is missing \(required)")
    }
    for required in [
      "riskLevel: .high", "lusha_account_usage_get", "account_usage_read",
      "defaultPermission: .allowed", "requiredScopes: []",
    ] { try expect(policies.contains(required), "Lusha policy contract is missing \(required)") }
    for required in [
      "maxWrapperTools", "maxProviderRequestsPerAction", "providerRequestsPerMinute",
      "parameterlessAccountUsageOnly", "businessProfileData", "prospectingSignalsAutomation",
      "webhooksAdminMcpRaw", "rawCredentials",
    ] {
      try expect(foundation.contains(required), "Lusha foundation contract is missing \(required)")
    }
    for required in [
      "lusha_account_usage_get", "parameterless", "businessProfileData",
      "prospectingSignalsAutomation", "webhooksAdminMcpRaw", "automaticRetry",
      "automaticPagination", "maxResponseBytes",
    ] { try expect(adapter.contains(required), "Lusha adapter contract is missing \(required)") }
    for required in ["lusha_account_usage_get", "relay_lusha_get_account_usage"] {
      try expect(wrappers.contains(required), "Lusha wrapper compiler is missing \(required)")
    }
    try expect(
      !productSource().contains("marketplace-logo-lusha."),
      "Lusha must use a generated fallback until an official logo is reviewed")
  }

  private static func testLeadIQApplicationsInfrastructureContract() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let applications = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let policies = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let foundation = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderFoundationService.swift")
    let adapter = try readPackageFile("Sources/RelayConsoleCore/LeadIQProviderActionAdapter.swift")
    let wrappers = try readPackageFile(
      "Sources/RelayConsoleCore/RelayProviderWrapperToolCompilerService.swift")
    for required in [
      "mapp-leadiq", "Customer-owned LeadIQ API key", "Encrypted LeadIQ API key via Railway",
      "shared-leadiq-account-governance-marketplace",
      "Read reduced LeadIQ plan and Universal Credit governance",
    ] {
      try expect(applications.contains(required), "LeadIQ catalog contract is missing \(required)")
    }
    for required in [
      "marketplaceUsesSharedProviderPage", "ApplicationsSharedMarketplaceAgentsCard",
      "ApplicationsProviderConnectionPanel", "startProviderSetup",
      "marketplaceCredentialRequirements",
    ] {
      try expect(views.contains(required), "LeadIQ shared UI infrastructure is missing \(required)")
    }
    for required in [
      "riskLevel: .high", "leadiq_account_usage_get", "account_usage_read",
      "defaultPermission: .allowed", "requiredScopes: []",
    ] { try expect(policies.contains(required), "LeadIQ policy contract is missing \(required)") }
    for required in [
      "maxWrapperTools", "maxProviderRequestsPerAction", "parameterlessAccountUsageOnly",
      "noCreditOperationOnly", "peopleCompanyData", "prospectingListsExportsFeedback",
      "mcpAdminRaw", "rawCredentials",
    ] {
      try expect(foundation.contains(required), "LeadIQ foundation contract is missing \(required)")
    }
    for required in [
      "leadiq_account_usage_get", "parameterless", "noCreditOperationOnly", "peopleCompanyData",
      "prospectingListsExportsFeedback", "mcpAdminRaw", "automaticRetry", "automaticPagination",
      "maxResponseBytes",
    ] { try expect(adapter.contains(required), "LeadIQ adapter contract is missing \(required)") }
    for required in ["leadiq_account_usage_get", "relay_leadiq_get_account_usage"] {
      try expect(wrappers.contains(required), "LeadIQ wrapper compiler is missing \(required)")
    }
    try expect(
      !productSource().contains("marketplace-logo-leadiq."),
      "LeadIQ must use a generated fallback until an official logo is reviewed")
  }

  private static func testSeamlessAIApplicationsInfrastructureContract() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let applications = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let policies = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let foundation = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderFoundationService.swift")
    let adapter = try readPackageFile(
      "Sources/RelayConsoleCore/SeamlessAIProviderActionAdapter.swift")
    let wrappers = try readPackageFile(
      "Sources/RelayConsoleCore/RelayProviderWrapperToolCompilerService.swift")
    for required in [
      "mapp-seamless-ai", "Customer-owned Seamless.AI API key",
      "Encrypted Seamless.AI API key via Railway",
      "shared-seamless-bounded-company-search-marketplace", "Search reduced company-only data",
    ] {
      try expect(
        applications.contains(required), "Seamless.AI catalog contract is missing \(required)")
    }
    for required in [
      "marketplaceUsesSharedProviderPage", "ApplicationsSharedMarketplaceAgentsCard",
      "ApplicationsProviderConnectionPanel", "startProviderSetup",
      "marketplaceCredentialRequirements",
    ] {
      try expect(
        views.contains(required), "Seamless.AI shared UI infrastructure is missing \(required)")
    }
    for required in [
      "riskLevel: .high", "seamless_company_search", "company_search",
      "defaultPermission: .allowed", "public_api_v1",
    ] {
      try expect(policies.contains(required), "Seamless.AI policy contract is missing \(required)")
    }
    for required in [
      "maxWrapperTools", "maxProviderRequestsPerAction", "maxResults", "publicApiV1Only",
      "peopleContactData", "researchOutreachCampaigns", "mcpAdminBulkRaw", "rawCredentials",
    ] {
      try expect(
        foundation.contains(required), "Seamless.AI foundation contract is missing \(required)")
    }
    for required in [
      "seamless_company_search", "maxResults", "peopleContactData", "researchOutreachCampaigns",
      "mcpAdminBulkRaw", "automaticRetry", "automaticPagination", "maxResponseBytes",
    ] {
      try expect(adapter.contains(required), "Seamless.AI adapter contract is missing \(required)")
    }
    for required in ["seamless_company_search", "relay_seamless_search_companies"] {
      try expect(wrappers.contains(required), "Seamless.AI wrapper compiler is missing \(required)")
    }
    try expect(
      !productSource().contains("marketplace-logo-seamless-ai."),
      "Seamless.AI must use a generated fallback until an official logo is reviewed")
  }

  private static func testRocketReachApplicationsInfrastructureContract() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let applications = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let policies = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let foundation = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderFoundationService.swift")
    let adapter = try readPackageFile(
      "Sources/RelayConsoleCore/RocketReachProviderActionAdapter.swift")
    let wrappers = try readPackageFile(
      "Sources/RelayConsoleCore/RelayProviderWrapperToolCompilerService.swift")
    for required in [
      "mapp-rocketreach", "Customer-owned RocketReach API key",
      "Encrypted RocketReach API key via Railway",
      "shared-rocketreach-account-governance-marketplace",
      "Read reduced RocketReach plan, credit and rate-limit governance",
    ] {
      try expect(
        applications.contains(required), "RocketReach catalog contract is missing \(required)")
    }
    for required in [
      "marketplaceUsesSharedProviderPage", "ApplicationsSharedMarketplaceAgentsCard",
      "ApplicationsProviderConnectionPanel", "startProviderSetup",
      "marketplaceCredentialRequirements",
    ] {
      try expect(
        views.contains(required), "RocketReach shared UI infrastructure is missing \(required)")
    }
    for required in [
      "riskLevel: .high", "rocketreach_account_usage_get", "account_usage_read",
      "defaultPermission: .allowed", "requiredScopes: []",
    ] {
      try expect(policies.contains(required), "RocketReach policy contract is missing \(required)")
    }
    for required in [
      "maxWrapperTools", "maxProviderRequestsPerAction", "parameterlessAccountUsageOnly",
      "fixedUniversalAccountReadOnly", "accountIdentityStripped", "peopleCompanyData",
      "bulkExportsWebhooksCommunity", "mcpAdminRaw", "rawCredentials",
    ] {
      try expect(
        foundation.contains(required), "RocketReach foundation contract is missing \(required)")
    }
    for required in [
      "rocketreach_account_usage_get", "parameterless", "fixedUniversalAccountReadOnly",
      "accountIdentityStripped", "peopleCompanyData", "bulkExportsWebhooksCommunity", "mcpAdminRaw",
      "automaticRetry", "automaticPagination", "maxResponseBytes",
    ] {
      try expect(adapter.contains(required), "RocketReach adapter contract is missing \(required)")
    }
    for required in ["rocketreach_account_usage_get", "relay_rocketreach_get_account_usage"] {
      try expect(wrappers.contains(required), "RocketReach wrapper compiler is missing \(required)")
    }
    try expect(
      !productSource().contains("marketplace-logo-rocketreach."),
      "RocketReach must use a generated fallback until an official logo is reviewed")
  }

  private static func testUpLeadApplicationsInfrastructureContract() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let applications = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let policies = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let foundation = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderFoundationService.swift")
    let adapter = try readPackageFile("Sources/RelayConsoleCore/UpLeadProviderActionAdapter.swift")
    let wrappers = try readPackageFile(
      "Sources/RelayConsoleCore/RelayProviderWrapperToolCompilerService.swift")
    for required in [
      "mapp-uplead", "Customer-owned UpLead API key", "Encrypted UpLead API key via Railway",
      "shared-uplead-credit-governance-marketplace",
      "Read reduced UpLead remaining-credit governance",
    ] {
      try expect(applications.contains(required), "UpLead catalog contract is missing \(required)")
    }
    for required in [
      "marketplaceUsesSharedProviderPage", "ApplicationsSharedMarketplaceAgentsCard",
      "ApplicationsProviderConnectionPanel", "startProviderSetup",
      "marketplaceCredentialRequirements",
    ] {
      try expect(views.contains(required), "UpLead shared UI infrastructure is missing \(required)")
    }
    for required in [
      "riskLevel: .high", "uplead_credit_balance_get", "account_usage_read",
      "defaultPermission: .allowed", "requiredScopes: []",
    ] { try expect(policies.contains(required), "UpLead policy contract is missing \(required)") }
    for required in [
      "maxWrapperTools", "maxProviderRequestsPerAction", "parameterlessCreditBalanceOnly",
      "fixedCreditsReadOnly", "accountEmailStripped", "peopleCompanyIntentData",
      "prospectingPreviewListsExports", "adminRaw", "rawCredentials",
    ] {
      try expect(foundation.contains(required), "UpLead foundation contract is missing \(required)")
    }
    for required in [
      "uplead_credit_balance_get", "parameterless", "fixedCreditsReadOnly", "accountEmailStripped",
      "peopleCompanyIntentData", "prospectingPreviewListsExports", "adminRaw", "automaticRetry",
      "automaticPagination", "maxResponseBytes",
    ] { try expect(adapter.contains(required), "UpLead adapter contract is missing \(required)") }
    for required in ["uplead_credit_balance_get", "relay_uplead_get_credit_balance"] {
      try expect(wrappers.contains(required), "UpLead wrapper compiler is missing \(required)")
    }
    try expect(
      !productSource().contains("marketplace-logo-uplead."),
      "UpLead must use a generated fallback until an official logo is reviewed")
  }

  private static func testWizaApplicationsInfrastructureContract() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let applications = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let policies = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderActionPolicyCompilerService.swift")
    let foundation = try readPackageFile(
      "Sources/RelayConsoleCore/MarketplaceProviderFoundationService.swift")
    let adapter = try readPackageFile("Sources/RelayConsoleCore/WizaProviderActionAdapter.swift")
    let wrappers = try readPackageFile(
      "Sources/RelayConsoleCore/RelayProviderWrapperToolCompilerService.swift")
    for required in [
      "mapp-wiza", "Customer-owned Wiza API key", "Encrypted Wiza API key via Railway",
      "shared-wiza-credit-governance-marketplace", "Read reduced Wiza credit-balance governance",
    ] {
      try expect(applications.contains(required), "Wiza catalog contract is missing \(required)")
    }
    for required in [
      "marketplaceUsesSharedProviderPage", "ApplicationsSharedMarketplaceAgentsCard",
      "ApplicationsProviderConnectionPanel", "startProviderSetup",
      "marketplaceCredentialRequirements",
    ] {
      try expect(views.contains(required), "Wiza shared UI infrastructure is missing \(required)")
    }
    for required in [
      "riskLevel: .high", "wiza_credit_balances_get", "account_usage_read",
      "defaultPermission: .allowed", "requiredScopes: []",
    ] { try expect(policies.contains(required), "Wiza policy contract is missing \(required)") }
    for required in [
      "maxWrapperTools", "maxProviderRequestsPerAction", "parameterlessCreditBalancesOnly",
      "fixedCreditBalancesReadOnly", "accountIdentityStripped", "peopleCompanyContactData",
      "bulkListsWebhooksExports", "adminFinancialRaw", "rawCredentials",
    ] {
      try expect(foundation.contains(required), "Wiza foundation contract is missing \(required)")
    }
    for required in [
      "wiza_credit_balances_get", "parameterless", "fixedCreditBalancesReadOnly",
      "peopleCompanyContactData", "bulkListsWebhooksExports", "adminFinancialRaw", "automaticRetry",
      "automaticPagination", "maxResponseBytes",
    ] { try expect(adapter.contains(required), "Wiza adapter contract is missing \(required)") }
    for required in ["wiza_credit_balances_get", "relay_wiza_get_credit_balances"] {
      try expect(wrappers.contains(required), "Wiza wrapper compiler is missing \(required)")
    }
    try expect(
      !productSource().contains("marketplace-logo-wiza."),
      "Wiza must use a generated fallback until an official logo is reviewed")
  }

  private static func testLINEApplicationsUIContract() throws {
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let model = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let applications = try readPackageFile("Sources/RelayConsoleCore/ApplicationsService.swift")
    let start = try unwrapRange(
      views.range(of: "struct ApplicationsLINEDetailPanel: View"), "missing LINE detail panel")
    let end = try unwrapRange(
      views.range(
        of: "struct ApplicationsLinkedInDetailPanel: View", range: start.upperBound..<views.endIndex
      ), "missing panel after LINE")
    let panel = String(views[start.lowerBound..<end.lowerBound])
    for required in [
      "ApplicationsExaHeroCard", "Agents with LINE", "ApplicationsAgentGridScroll",
      "ApplicationsAgentAuthorityRow", "Manage API Connection", "ApplicationsConnectionFormGrid",
      "No LINE connections", "Capabilities", "What Agents Can Do", "Requirements",
      "profile openid", "state, nonce and mandatory S256 PKCE",
      "One fixed /v2/profile read for the OIDC-bound subject",
      "No email, social graph, Messaging API token, bot, message, reply, push, broadcast, webhook, write or raw API",
    ] {
      try expect(
        panel.localizedCaseInsensitiveContains(required), "LINE UI contract is missing \(required)")
    }
    try expect(
      !panel.contains(".onTapGesture"),
      "LINE agent cards must not toggle assignment from card clicks")
    try expect(
      compactSource(panel).contains("Button { pending = !isOn }"),
      "LINE assignment must use the explicit switch button")
    try expect(panel.contains(".alert("), "LINE assignment changes must require confirmation")
    for required in [
      "mapp-line", "Relay-owned LINE Login OAuth via Railway",
      "line_messaging_api_channel_tokens", "line_reply_push_multicast_narrowcast_broadcast",
      "Read the connected LINE Login profile", "profile and openid",
    ] {
      try expect(applications.contains(required), "LINE catalog contract is missing \(required)")
    }
    for required in [
      "startLINEOAuthConnect", "selectLINEConnection", "setLINEAgentConnection",
      "testLINEConnection", "deleteLINEConnection", "connectors/line/oauth/start",
      "remoteMarketplaceConnectionId", "railwayCallbackOnly", "stateVerified", "nonceVerified",
      "pkceS256", "idTokenVerified", "subjectBound", "lineLoginOnly",
      "messagingAuthority", "fixedEndpointsOnly", "rawToolsEnabled",
    ] {
      try expect(
        compactSource(model).contains(required), "LINE desktop contract is missing \(required)")
    }
    try expect(
      compactSource(model).contains(
        "return [.approvalRequired, .allowDirectWrites, .readOnly, .blocked]"),
      "LINE must expose all four authority choices")
    try expect(
      views.contains("case .line: return (\"marketplace-logo-line\", \"png\")"),
      "LINE official asset must drive shared sidebar and hero rendering")
  }

  private static func testAgentOpsHqUsesBundledAssetsWithoutMockOrBackendDrift() throws {
    let package = try readPackageFile("Package.swift")
    let appViewModel = try readPackageFile("Sources/RelayConsoleApp/AppViewModel.swift")
    let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
    let service = try readPackageFile("Sources/RelayConsoleCore/AgentOpsService.swift")

    try expect(
      package.contains(".process(\"Resources\")"),
      "core resources should be processed for AgentOps layout loading")
    try expect(
      service.contains("Bundle.module.url("),
      "AgentOps service should load the bundled layout resource")
    try expect(
      service.contains("bundled_web_agentops_floor_worker_assets"),
      "AgentOps scene should expose bundled floor/worker asset strategy")
    try expect(
      views.contains("agentOpsFloorImage") && views.contains("agentOpsSpriteImage"),
      "AgentOps scene should load bundled floor and sprite resources")
    try expect(
      !views.contains("Living estate map for agents, apps, properties, outputs, and workflows."),
      "AgentOps right-panel header should not include the removed strapline")
    try expect(
      compactSource(appViewModel).contains("@Published var agentOpsStatusVisible = false"),
      "AgentOps right-panel overlays should not dominate the scene by default")
    try expect(
      !service.lowercased().contains("mockagentops"),
      "AgentOps service should not depend on mock event state")
  }

  private static func testManualManifestsMatchSchema() throws {
    for path in [
      "Tests/Fixtures/manual-evidence/source-hygiene/default-state-cleanup-001/manifest.md",
      "Tests/Fixtures/manual-evidence/baseline/demo-00-baseline-001/manifest.md",
    ] {
      let manifest = try readPackageFile(path)
      for field in requiredManifestFields {
        try expect(manifest.contains("\(field):"), "\(path) is missing \(field)")
      }
      try expect(manifest.contains("ITC-0010"), "\(path) must link ITC-0010")
      try expect(manifest.contains("redactionReview:"), "\(path) must record redaction review")
    }
  }

  private static func testRailwayApplicationsStateExcludesConnectionsFromOtherWorkspaceLinks() throws {
    let refreshSource = try readPackageFile(
      "Sources/RelayConsoleApp/Features/Applications/AppViewModel+ApplicationRefresh.swift")
    let cloudSource = try readPackageFile("Sources/RelayConsoleCore/CloudRelaySync.swift")
    try expect(
      cloudSource.contains("func railwayMarketplaceConnectionIds("),
      "cloud sync must expose Marketplace connection identities for the active workspace link")
    try expect(
      refreshSource.contains("retainingRailwayConnectionIds: linkedRailwayConnectionIds")
        && refreshSource.contains("let retainingRailwayConnectionIds = try services.cloudSync.railwayMarketplaceConnectionIds("),
      "Applications refresh must exclude Railway connections mirrored by another workspace link")
    try expect(
      refreshSource.contains("retainingRailwayConnectionIds.contains($0.id)"),
      "connection filtering must match the local connection identity to the active Railway link")
  }

  private static func productSource() throws -> String {
    try [
      "Sources/RelayConsoleApp/AppViewModel.swift",
      "Sources/RelayConsoleApp/Views.swift",
      "Sources/RelayConsoleApp/UIComponents.swift",
      "Sources/RelayConsoleCore/AgentOpsService.swift",
      "Sources/RelayConsoleCore/LocalDataService.swift",
      "Sources/RelayConsoleCore/Migrations.swift",
      "Sources/RelayConsoleCore/ToolRequestService.swift",
      "Sources/RelayConsoleCore/HarnessInstallManager.swift",
      "Sources/RelayConsoleCore/HarnessInstallUtilities.swift",
      "Package.swift",
    ]
    .map(readPackageFile)
    .joined(separator: "\n")
  }

  private static func readPackageFile(_ relativePath: String) throws -> String {
    try RelayConsoleSourceTestSupport.read(
      root: URL(fileURLWithPath: FileManager.default.currentDirectoryPath),
      path: relativePath
    )
  }

  private static func compactSource(_ source: String) -> String {
    source.split(whereSeparator: \.isWhitespace).joined(separator: " ")
  }

  private static func expect(_ condition: @autoclosure () throws -> Bool, _ message: String) throws
  {
    guard try condition() else {
      throw SourceHygieneTestFailure(message)
    }
  }

  private static func unwrapRange(_ range: Range<String.Index>?, _ message: String) throws -> Range<
    String.Index
  > {
    guard let range else {
      throw SourceHygieneTestFailure(message)
    }
    return range
  }
}

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

private let forbiddenProductSourceFragments = [
  "Alex Kerss",
  "kerss79",
  "gmail.com",
  "/Users/example",
  "Documents/Projects/Active/ClawChat",
]

private struct SourceHygieneTestFailure: Error, CustomStringConvertible {
  var description: String
  init(_ description: String) {
    self.description = description
  }
}
