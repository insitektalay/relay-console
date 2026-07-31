import XCTest
import UIKit
@testable import ClawChat

final class ParityContractTests: XCTestCase {
    func testPrimaryNavigationMatchesRelayMobileConcept() {
        XCTAssertEqual(
            MainTabView.TabItem.allCases.map(\.title),
            ["Chat", "Agents", "Artifacts", "Applications", "Approvals", "Settings"]
        )
        XCTAssertEqual(MainTabView.TabItem.allCases.count, 6)
    }

    func testIPadRailUsesTheSameSixPrimaryDestinationsAsIPhone() {
        XCTAssertEqual(IPadPrimaryNavigationContract.tabs, MainTabView.TabItem.allCases)
        XCTAssertEqual(
            IPadPrimaryNavigationContract.tabs.map(\.title),
            ["Chat", "Agents", "Artifacts", "Applications", "Approvals", "Settings"]
        )
    }

    func testIPadConversationPaneMatchesDesktopConversationChrome() {
        XCTAssertEqual(IPadConversationPaneContract.title, "Conversations")
        XCTAssertEqual(IPadConversationPaneContract.searchPrompt, "Search conversations")
        XCTAssertEqual(IPadConversationPaneContract.icon, "bubble.left.and.bubble.right")
        XCTAssertEqual(IPadConversationPaneContract.toggleIcon, "sidebar.left")
        XCTAssertEqual(IPadConversationPaneContract.collapsedWidth, 72)
        XCTAssertEqual(
            IPadThreadHeaderContract.actionLabels,
            [
                "Copy thread",
                "Wrap up and reset",
                "Current chat cycle",
                "Context usage",
                "Messages",
            ]
        )
    }

    func testIPadAgentsMenuUsesAReadableWideLayout() {
        XCTAssertEqual(IPadAgentsWorkspaceContract.menuMaxWidth, 760)
    }

    @MainActor
    func testOrganizationToolsUseRailwayHierarchyContracts() {
        XCTAssertEqual(APIEndpoint.createCompany(workspaceId: "w", name: "Org").path, "org/companies")
        XCTAssertEqual(APIEndpoint.createCompany(workspaceId: "w", name: "Org").method, .post)
        XCTAssertEqual(APIEndpoint.createDepartment(companyId: "c", name: "Dept", description: nil).path, "departments")
        XCTAssertEqual(APIEndpoint.createTeam(departmentId: "d", name: "Team", description: nil).path, "teams")
        XCTAssertEqual(APIEndpoint.updateAgent(id: "a", params: ["companyId": "c"]).method, .patch)
    }

    func testLoginCredentialsStartEmpty() {
        XCTAssertTrue(LoginFormDefaults.email.isEmpty)
        XCTAssertTrue(LoginFormDefaults.password.isEmpty)
    }

    func testMarketplaceIconAtlasPackagesEveryLaunchApp() throws {
        let data = try XCTUnwrap(NSDataAsset(name: "MarketplaceIconAtlasIndex")?.data)
        let document = try XCTUnwrap(
            JSONSerialization.jsonObject(with: data) as? [String: Any]
        )
        let apps = try XCTUnwrap(document["apps"] as? [String: Any])
        XCTAssertEqual(document["appCount"] as? Int, 406)
        XCTAssertEqual(apps.count, 406)
        XCTAssertNotNil(apps["exa-search"])
        XCTAssertNotNil(UIImage(named: "MarketplaceIconAtlas"))
    }

    func testMarketplaceCatalogDecodesProviderBreadthContract() throws {
        let json = #"{"categories":[{"id":"developer","label":"Developer"}],"apps":[{"slug":"github","name":"GitHub","source_type":"external_provider","category":"developer","description":"Code","agent_use_summary":"Work with repositories","connection_types":["oauth"],"credential_requirements":[],"webhook_requirements":[],"approval_profile":"safe","approval_profiles":[{"id":"safe","label":"Safe","description":"Review writes","default_selected":true,"approval_required_actions":[],"blocked_actions":[]}],"risk_level":"high","capabilities":[{"id":"issues_read","label":"Read issues","description":"Read issue data","default_enabled":true}],"allowed_actions":[],"approval_required_actions":[],"blocked_actions":[],"provider_docs_url":"https://docs.github.com","provider_website_url":"https://github.com","runtime_support":[{"format":"openclaw","install_support":"installable","label":"OpenClaw","description":"Install"}],"availability":"available"}]}"#
        let catalog = try APIClient.decoder.decode(MarketplaceCatalog.self, from: Data(json.utf8))
        XCTAssertEqual(catalog.apps.first?.slug, "github")
        XCTAssertEqual(catalog.apps.first?.capabilities.first?.id, "issues_read")
    }

    func testMarketplaceReleaseManifestDisablesConnectWhenProviderIsIneligible() throws {
        let json = #"{"release_manifest":{"schema_version":"relay.marketplace-release.v1","manifest_version":"2026-07-14-draft.1","release_channel":"public-beta","freeze_status":"open","frozen_at":null,"source_revision":null},"categories":[{"id":"developer","label":"Developer"}],"apps":[{"slug":"github","name":"GitHub","source_type":"external_provider","category":"developer","description":"Code","agent_use_summary":"Work with repositories","connection_types":["oauth"],"credential_requirements":[],"webhook_requirements":[],"approval_profile":"safe","approval_profiles":[{"id":"safe","label":"Safe","description":"Review writes","default_selected":true,"approval_required_actions":[],"blocked_actions":[]}],"risk_level":"high","capabilities":[],"allowed_actions":[],"approval_required_actions":[],"blocked_actions":[],"provider_docs_url":"https://docs.github.com","provider_website_url":"https://github.com","runtime_support":[],"availability":"preview","release":{"manifest_version":"2026-07-14-draft.1","release_channel":"public-beta","freeze_status":"open","state":"coming_later","label":"Coming later","connect_eligible":false,"live_verified":false,"reason":"Production acceptance is incomplete."}}]}"#
        let catalog = try APIClient.decoder.decode(
            MarketplaceCatalog.self, from: Data(json.utf8))
        let app = try XCTUnwrap(catalog.apps.first)
        XCTAssertEqual(catalog.releaseManifest?.manifestVersion, "2026-07-14-draft.1")
        XCTAssertEqual(app.availabilityLabel, "Coming later")
        XCTAssertFalse(app.connectEligible)
        XCTAssertEqual(app.unavailableReason, "Production acceptance is incomplete.")
    }

    func testMarketplaceLaunchAppCanConnectBeforeInternalLiveVerification() throws {
        let json = #"{"categories":[{"id":"developer","label":"Developer"}],"apps":[{"slug":"planhat","name":"Planhat","source_type":"external_provider","category":"developer","description":"CRM","agent_use_summary":"Use bounded CRM tools","connection_types":["api_key"],"credential_requirements":[],"webhook_requirements":[],"approval_profile":"safe","approval_profiles":[],"risk_level":"medium","capabilities":[],"allowed_actions":[],"approval_required_actions":[],"blocked_actions":[],"provider_docs_url":"https://example.com","provider_website_url":"https://example.com","runtime_support":[],"availability":"available","release":{"manifest_version":"2026-07-26-launch-cohort.4","release_channel":"public-beta","freeze_status":"frozen","state":"customer_credential_required","label":"Beta — customer credentials required","connect_eligible":true,"live_verified":false,"reason":"Customer credentials required."}}]}"#
        let catalog = try APIClient.decoder.decode(
            MarketplaceCatalog.self, from: Data(json.utf8))
        let app = try XCTUnwrap(catalog.apps.first)
        XCTAssertTrue(app.connectEligible)
        XCTAssertNil(app.unavailableReason)
    }

    func testMarketplaceConnectionDistinguishesMacAndRailwayExecution() throws {
        let deviceJSON = #"{"id":"connection-1","workspace_id":"workspace-1","app_slug":"gmail","display_name":"Gmail on Mac","environment":"production","auth_type":"oauth","execution_authority":"swift","credential_names":[],"selected_capabilities":[],"status":"needs_credentials","last_validated_at":null,"last_error_code":"DEVICE_RUNTIME_REQUIRED","last_error_message":"Mac required","metadata":{},"created_at":"2026-07-14T10:00:00.000Z","updated_at":"2026-07-14T10:00:00.000Z"}"#
        let device = try APIClient.decoder.decode(
            MarketplaceConnection.self, from: Data(deviceJSON.utf8))
        XCTAssertTrue(device.requiresDeviceRuntime)
        XCTAssertEqual(
            device.availabilityLabel,
            "Available when your Mac and bridge are online")

        let railwayJSON = deviceJSON.replacingOccurrences(
            of: #""execution_authority":"swift""#,
            with: #""execution_authority":"railway""#)
        let railway = try APIClient.decoder.decode(
            MarketplaceConnection.self, from: Data(railwayJSON.utf8))
        XCTAssertFalse(railway.requiresDeviceRuntime)
        XCTAssertEqual(railway.availabilityLabel, "Available through Relay")
    }

    func testRuntimeDispatchMapsRailwayStartedState() throws {
        let json = #"{"id":"dispatch-1","thread_id":"thread-1","agent_id":"agent-1","runtime_run_id":"run-1","status":"started","created_at":"2026-07-11T10:00:00.000Z"}"#
        let dispatch = try APIClient.decoder.decode(AgentDispatch.self, from: Data(json.utf8))
        XCTAssertEqual(dispatch.status, .running)
        XCTAssertEqual(dispatch.runId, "run-1")
    }

    func testRuntimeTodoProgressDecodesActualHermesTaskStates() throws {
        let json = #"{"dispatchId":"dispatch-1","threadId":"thread-1","agentId":"agent-1","runtimeType":"hermes","timestamp":"2026-07-24T15:00:00.000Z","toolName":"todo","phase":"updated","summary":"Updating plan","tasks":[{"id":"one","content":"Inspect the issue","status":"completed"},{"id":"two","content":"Implement the fix","status":"in_progress"},{"id":"three","content":"Run verification","status":"cancelled"}]}"#
        let payload = try APIClient.decoder.decode(
            RuntimeRunToolPayload.self,
            from: Data(json.utf8)
        )

        XCTAssertEqual(payload.toolName, "todo")
        XCTAssertEqual(payload.tasks?.map(\.status), [.completed, .inProgress, .cancelled])
        XCTAssertEqual(payload.tasks?.map(\.content), [
            "Inspect the issue",
            "Implement the fix",
            "Run verification",
        ])
    }

    func testMessageSearchResultDecodesRailwayContract() throws {
        let json = #"{"data":[{"id":"message-github","thread_id":"thread-jeff","thread_title":"Jeff Hermes","sender_name":"Jeff Hermes","content":"GitHub has been connected.","timestamp":"2026-07-16T09:41:00.000Z","thread_type":"direct"}],"total":1,"page":1,"page_size":20,"has_more":false}"#
        let response = try APIClient.decoder.decode(
            PaginatedResponse<MessageSearchResult>.self,
            from: Data(json.utf8)
        )

        let result = try XCTUnwrap(response.data.first)
        XCTAssertEqual(result.id, "message-github")
        XCTAssertEqual(result.threadId, "thread-jeff")
        XCTAssertEqual(result.threadTitle, "Jeff Hermes")
        XCTAssertEqual(result.senderName, "Jeff Hermes")
        XCTAssertEqual(result.content, "GitHub has been connected.")
        XCTAssertEqual(result.threadType, .direct)
    }

    func testApprovalPreservesExactPayloadMetadata() throws {
        let json = #"{"id":"approval-1","title":"Send message","description":"External action","status":"pending","requested_by_agent_id":"agent-1","workspace_id":"workspace-1","risk":"high","steps":[],"metadata":{"provider":"slack","exactPayload":{"channel":"ops","text":"hello"}},"created_at":"2026-07-11T10:00:00.000Z","updated_at":"2026-07-11T10:00:00.000Z"}"#
        let approval = try APIClient.decoder.decode(Approval.self, from: Data(json.utf8))
        guard case .object(let payload) = approval.metadata["exactPayload"] else {
            return XCTFail("Expected exact payload metadata")
        }
        XCTAssertEqual(payload["channel"], .string("ops"))
    }

    @MainActor
    func testParityEndpointsStayOnRailwayContracts() {
        XCTAssertEqual(APIEndpoint.marketplaceCatalog(workspaceId: "w").path, "workspaces/w/marketplace/catalog")
        XCTAssertEqual(
            APIEndpoint.agentModelOptions(workspaceId: "ws_test").path,
            "agents/model-options"
        )
        XCTAssertEqual(APIEndpoint.activeDispatches(threadId: "t").path, "dispatches/threads/t")
        XCTAssertEqual(APIEndpoint.approvals(workspaceId: "w", page: 1, status: "pending").path, "approvals")
        XCTAssertEqual(APIEndpoint.teamRelay(threadId: "t").path, "threads/t/team-relay")
        XCTAssertEqual(APIEndpoint.pauseTeamRelay(threadId: "t").method, .post)
        XCTAssertEqual(APIEndpoint.continueTeamRelay(threadId: "t").method, .post)
        XCTAssertEqual(APIEndpoint.updateTeamRelayLimit(threadId: "t", replyLimit: 12).method, .patch)
        let messageSearch = APIEndpoint.searchMessages(workspaceId: "w", query: "github", page: 1)
        XCTAssertEqual(messageSearch.path, "workspaces/w/messages/search")
        let messageSearchRequest = messageSearch.urlRequest(
            relativeTo: URL(string: "https://api.relayconsole.work/api/v1")!
        )
        let queryItems = URLComponents(
            url: messageSearchRequest.url!,
            resolvingAgainstBaseURL: false
        )?.queryItems
        XCTAssertEqual(queryItems?.first(where: { $0.name == "q" })?.value, "github")
        XCTAssertEqual(queryItems?.first(where: { $0.name == "page" })?.value, "1")
        let host = AppRuntimeConfig.apiBaseURL.host ?? ""
        XCTAssertFalse(host.contains("localhost"))
        XCTAssertFalse(host.hasPrefix("127."))
        if AppRuntimeConfig.savedConnection == nil {
            XCTAssertEqual(AppRuntimeConfig.apiBaseURL.absoluteString, "https://your-backend.up.railway.app/api/v1")
            XCTAssertEqual(AppRuntimeConfig.webSocketBaseURL.absoluteString, "wss://your-backend.up.railway.app")
            XCTAssertEqual(AppRuntimeConfig.webAssetBaseURL.absoluteString, "https://your-web-app.example.com")
        }
    }

    func testRelayTestedHarnessModelCatalogDecodes() throws {
        let json = #"{"source":"relay-tested-harness-release","harnesses":{"hermes":{"default_model":"gpt-5.5","models":["gpt-5.5","gpt-5.4"]},"openclaw":{"default_model":"gpt-5.5","models":["gpt-5.5"]}}}"#
        let catalog = try APIClient.decoder.decode(HarnessModelCatalog.self, from: Data(json.utf8))
        XCTAssertEqual(catalog.harnesses["hermes"]?.defaultModel, "gpt-5.5")
        XCTAssertEqual(catalog.harnesses["openclaw"]?.models, ["gpt-5.5"])
    }

    func testAgentDecodesConfiguredModelForDirectChatComposer() throws {
        let json = #"{"id":"agent-1","name":"Researcher","role":"Analyst","status":"on_duty","workspace_id":"workspace-1","capabilities":[],"working_hours_mode":"24_7","timezone":"Europe/London","created_at":"2026-07-12T10:00:00.000Z","updated_at":"2026-07-12T10:00:00.000Z","model_primary":"gpt-5.5","tasks_completed_today":0,"success_rate":0,"avg_completion_minutes":0,"total_minutes_worked":0,"budget_used":0}"#
        let agent = try APIClient.decoder.decode(Agent.self, from: Data(json.utf8))
        XCTAssertEqual(agent.modelPrimary, "gpt-5.5")
    }

    func testTeamRelayStateDecodesPersistedRailwayCycle() throws {
        let json = #"{"thread_id":"thread-1","thread_session_id":"session-1","run_state":"paused","pause_reason":"reply_limit","reply_limit":12,"reply_count":12}"#
        let state = try APIClient.decoder.decode(TeamRelayState.self, from: Data(json.utf8))
        XCTAssertEqual(state.runState, .paused)
        XCTAssertEqual(state.pauseReason, .replyLimit)
        XCTAssertEqual(state.replyLimit, 12)
        XCTAssertEqual(state.replyCount, 12)
    }
}
