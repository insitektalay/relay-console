import XCTest
import SwiftUI
import Security
@testable import ClawChat

private final class SessionURLProtocol: URLProtocol, @unchecked Sendable {
    nonisolated(unsafe) static var handler: ((URLRequest) throws -> (HTTPURLResponse, Data))?

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        guard let handler = Self.handler else {
            client?.urlProtocol(self, didFailWithError: URLError(.badServerResponse))
            return
        }
        do {
            let (response, data) = try handler(request)
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: data)
            client?.urlProtocolDidFinishLoading(self)
        } catch {
            client?.urlProtocol(self, didFailWithError: error)
        }
    }

    override func stopLoading() {}
}

final class ClawChatTests: XCTestCase {

    func testRelayShellAndConsoleNavigationContract() {
        XCTAssertEqual(
            MainTabView.TabItem.allCases.map(\.title),
            ["Chat", "Agents", "Artifacts", "Applications", "Approvals", "Settings"]
        )
        XCTAssertEqual(
            ConsoleDestination.allCases,
            [.artifacts, .applications, .approvals, .settings, .tasks, .notifications, .workspaceLibrary, .quickActions]
        )
        XCTAssertEqual(ConsoleDestination.allCases.filter { $0.group == .relay }.map(\.rawValue), ["Artifacts", "Applications", "Approvals", "Settings"])
        XCTAssertFalse(ConsoleDestination.settings.requiresWorkspace)
        XCTAssertTrue(ConsoleDestination.artifacts.requiresWorkspace)
        XCTAssertFalse(ConsoleDestination.allCases.map(\.rawValue).contains("Insights"))
        XCTAssertFalse(ConsoleDestination.allCases.map(\.rawValue).contains("AgentOps HQ"))
    }

    func testRelayAuthAndWorkspaceContract() {
        XCTAssertEqual(LoginFormDefaults.email, "")
        XCTAssertEqual(LoginFormDefaults.password, "")
        XCTAssertEqual(WorkspaceParityContract.productName, "Relay Console")
        XCTAssertEqual(WorkspaceParityContract.cardAvatarSize, 44)
        XCTAssertEqual(WorkspaceParityContract.cardMinimumHeight, 68)
    }

    func testInfrastructureFailureUsesActionableRelayMessage() {
        let error = APIError.serverError(
            statusCode: 502,
            message: "Application failed to respond"
        )

        XCTAssertEqual(
            error.errorDescription,
            "Relay service is temporarily unavailable. Please try again shortly."
        )
    }

    func testInfrastructureFailurePreservesActionableServerExplanation() {
        let message = "Luca Signoff's OpenClaw runtime is not connected to this Railway workspace."
        let error = APIError.serverError(statusCode: 503, message: message)

        XCTAssertEqual(error.errorDescription, message)
    }

    func testAgentRuntimeTypeAcceptsRailwayAndLegacySpellingsWithoutDroppingRoster() throws {
        let decoder = JSONDecoder()

        XCTAssertEqual(
            try decoder.decode(AgentRuntimeType.self, from: Data(#""openclaw""#.utf8)),
            .openClaw
        )
        XCTAssertEqual(
            try decoder.decode(AgentRuntimeType.self, from: Data(#""open_claw""#.utf8)),
            .openClaw
        )
        XCTAssertEqual(
            try decoder.decode(AgentRuntimeType.self, from: Data(#""hermes""#.utf8)),
            .hermes
        )
        XCTAssertEqual(
            try decoder.decode(AgentRuntimeType.self, from: Data(#""future_runtime""#.utf8)),
            .unknown
        )
    }

    func testAgentExecutionUsesOnlyTheCanonicalBackendDecision() {
        var agent = Agent(
            id: "agent-1", externalId: "agent-1", name: "Agent", role: "Assistant",
            avatarUrl: nil, status: .onDuty, teamId: nil, departmentId: nil, companyId: nil,
            groupType: nil, groupLabel: nil, workspaceId: "workspace-1", managerId: nil,
            description: nil, capabilities: [], workingHoursMode: .manual, timezone: "UTC",
            createdAt: .distantPast, updatedAt: .distantPast, runtimeType: .hermes,
            runtimeAvailability: .online, currentTaskId: nil, tasksCompletedToday: 0,
            successRate: 0, avgCompletionMinutes: 0, totalMinutesWorked: 0,
            budgetUsed: 0, budgetLimit: nil
        )

        XCTAssertFalse(agent.isExecutionAvailable, "online status must not imply execution authority")
        agent.executionAvailable = true
        XCTAssertTrue(agent.isExecutionAvailable)
        agent.lifecycleStatus = .retired
        XCTAssertFalse(agent.isExecutionAvailable, "retired agents remain fail-closed")
    }

    @MainActor
    func testAvatarResolverAcceptsSwiftAndWebBuiltInPaths() {
        let expectedAssetName = "Avatar_illustrated_black_female_01"

        XCTAssertEqual(
            RelayAvatar.builtInAvatarAssetName(
                for: "avatars/illustrated/illustrated-black-female-01.png"
            ),
            expectedAssetName
        )
        XCTAssertEqual(
            RelayAvatar.builtInAvatarAssetName(
                for: "/avatars/illustrated/illustrated-black-female-01.png"
            ),
            expectedAssetName
        )
        XCTAssertEqual(
            RelayAvatar.builtInAvatarAssetName(
                for: "https://relayconsole.work/avatars/illustrated/illustrated-black-female-01.png"
            ),
            expectedAssetName
        )
        XCTAssertEqual(
            RelayAvatar.builtInAvatarAssetName(
                for: "api/mission-control/agent-image/codex"
            ),
            "Avatar_codex"
        )
        XCTAssertNotNil(UIImage(named: expectedAssetName))
    }

    func testRemoteAvatarRequestBypassesPersistedFailedResponses() throws {
        let url = try XCTUnwrap(
            URL(string: "https://relayconsole.work/avatars/illustrated/sheet-08_avatar-017.png")
        )
        let request = AvatarImageLoader.request(for: url)

        XCTAssertEqual(request.url, url)
        XCTAssertEqual(request.cachePolicy, .reloadIgnoringLocalCacheData)
        XCTAssertEqual(request.timeoutInterval, 20)
    }

    func testThreadAvatarResolverRecoversLegacyDirectThreadByAgentName() {
        let avatarUrl = "/avatars/illustrated/sheet-08_avatar-017.png"
        let agent = Agent(
            id: "agent-claw-man", externalId: nil, name: "Claw Man", role: "Assistant",
            avatarUrl: avatarUrl, status: .onDuty, teamId: nil, departmentId: nil, companyId: nil,
            groupType: nil, groupLabel: nil, workspaceId: "workspace-1", managerId: nil,
            description: nil, capabilities: [], workingHoursMode: .manual, timezone: "UTC",
            createdAt: .distantPast, updatedAt: .distantPast, runtimeType: nil,
            currentTaskId: nil, tasksCompletedToday: 0, successRate: 0, avgCompletionMinutes: 0,
            totalMinutesWorked: 0, budgetUsed: 0, budgetLimit: nil
        )
        let thread = Thread(
            id: "thread-claw-man", title: " Claw Man ", type: .direct,
            workspaceId: "workspace-1", avatarUrl: nil, lastMessage: nil,
            unreadCount: 0, isPinned: false, isMuted: false, participantIds: [],
            createdAt: .distantPast, updatedAt: .distantPast, teamId: nil,
            departmentId: nil, agentIds: [], status: .active
        )

        XCTAssertEqual(
            ThreadAvatarResolver.resolve(thread: thread, agents: [agent]),
            avatarUrl
        )
    }

    func testThreadAvatarResolverDoesNotGuessWhenAgentNamesAreAmbiguous() {
        let agents = ["agent-1", "agent-2"].map { id in
            Agent(
                id: id, externalId: nil, name: "Claw Man", role: "Assistant",
                avatarUrl: "/avatars/\(id).png", status: .onDuty, teamId: nil,
                departmentId: nil, companyId: nil, groupType: nil, groupLabel: nil,
                workspaceId: "workspace-1", managerId: nil, description: nil,
                capabilities: [], workingHoursMode: .manual, timezone: "UTC",
                createdAt: .distantPast, updatedAt: .distantPast, runtimeType: nil,
                currentTaskId: nil, tasksCompletedToday: 0, successRate: 0,
                avgCompletionMinutes: 0, totalMinutesWorked: 0, budgetUsed: 0,
                budgetLimit: nil
            )
        }
        let thread = Thread(
            id: "thread-claw-man", title: "Claw Man", type: .direct,
            workspaceId: "workspace-1", avatarUrl: nil, lastMessage: nil,
            unreadCount: 0, isPinned: false, isMuted: false, participantIds: [],
            createdAt: .distantPast, updatedAt: .distantPast, teamId: nil,
            departmentId: nil, agentIds: [], status: .active
        )

        XCTAssertNil(ThreadAvatarResolver.resolve(thread: thread, agents: agents))
    }

    func testThreadAvatarResolverUsesAgentShownInsideLegacyDirectConversation() {
        let agent = Agent(
            id: "agent-max-radical", externalId: nil, name: "Max Radical", role: "Assistant",
            avatarUrl: "data:image/png;base64,bWF4", status: .onDuty, teamId: nil,
            departmentId: nil, companyId: nil, groupType: nil, groupLabel: nil,
            workspaceId: "workspace-1", managerId: nil, description: nil, capabilities: [],
            workingHoursMode: .manual, timezone: "UTC", createdAt: .distantPast,
            updatedAt: .distantPast, runtimeType: nil, currentTaskId: nil,
            tasksCompletedToday: 0, successRate: 0, avgCompletionMinutes: 0,
            totalMinutesWorked: 0, budgetUsed: 0, budgetLimit: nil
        )
        let thread = Thread(
            id: "legacy-new-chat", title: "New chat", type: .direct,
            workspaceId: "workspace-1", avatarUrl: nil, lastMessage: nil,
            unreadCount: 0, isPinned: false, isMuted: false, participantIds: [],
            createdAt: .distantPast, updatedAt: .distantPast, teamId: nil,
            departmentId: nil, agentIds: [], status: .active
        )

        XCTAssertEqual(
            ThreadAvatarResolver.resolve(
                thread: thread,
                agents: [agent],
                messageSenderIds: ["user-owner", agent.id]
            ),
            agent.avatarUrl
        )
        XCTAssertEqual(
            ThreadAvatarResolver.directAgent(
                thread: thread,
                agents: [agent],
                messageSenderIds: ["user-owner", agent.id]
            )?.id,
            agent.id
        )
    }

    func testCurrentUserAvatarMatchesTheExistingWebFallback() {
        let user = User(
            id: "user-alex",
            email: "alex@example.com",
            name: "Alex Kerss",
            avatarUrl: nil,
            createdAt: .distantPast,
            updatedAt: .distantPast
        )

        XCTAssertEqual(user.effectiveAvatarUrl, "/avatars/alex-kerss.png")
        XCTAssertNotNil(UIImage(named: "Avatar_alex_kerss"))
    }

    func testReadableMarkdownParserPreservesDocumentStructure() {
        let markdown = """
        # GapMiner

        You are **GapMiner** — a planning agent.

        ## Operating Scope

        - **Research mode** — validate opportunities
          - [x] Check commercial intent
        - [ ] Prepare the plan

        > Keep reports focused and useful.

        ```json
        {"status":"ready"}
        ```
        """

        let blocks = ReadableMarkdownParser.parse(markdown)

        XCTAssertEqual(blocks.count, 6)
        XCTAssertEqual(blocks[0], .heading(level: 1, text: "GapMiner"))
        XCTAssertEqual(blocks[1], .paragraph("You are **GapMiner** — a planning agent."))
        XCTAssertEqual(blocks[2], .heading(level: 2, text: "Operating Scope"))

        guard case .list(let items) = blocks[3] else {
            return XCTFail("Expected a structured Markdown list")
        }
        XCTAssertEqual(items.count, 3)
        XCTAssertEqual(items[0].text, "**Research mode** — validate opportunities")
        XCTAssertEqual(items[1].depth, 1)
        XCTAssertEqual(items[1].isChecked, true)
        XCTAssertEqual(items[2].isChecked, false)

        XCTAssertEqual(blocks[4], .quote("Keep reports focused and useful."))
        XCTAssertEqual(blocks[5], .code(language: "json", content: "{\"status\":\"ready\"}"))
    }

    func testTeamAvatarResolverRecoversMembersFromExactTeamName() {
        let team = Team(
            id: "team-today", name: "Todays Team", departmentId: "department-1",
            createdAt: .distantPast
        )
        let agents = (1...4).map { index in
            Agent(
                id: "agent-\(index)", externalId: nil, name: "Agent \(index)", role: "Assistant",
                avatarUrl: "/avatars/agent-\(index).png", status: .onDuty,
                teamId: team.id, departmentId: team.departmentId, companyId: nil,
                groupType: "business", groupLabel: nil, workspaceId: "workspace-1",
                managerId: nil, description: nil, capabilities: [], workingHoursMode: .manual,
                timezone: "UTC", createdAt: .distantPast, updatedAt: .distantPast,
                runtimeType: nil, currentTaskId: nil, tasksCompletedToday: 0, successRate: 0,
                avgCompletionMinutes: 0, totalMinutesWorked: 0, budgetUsed: 0, budgetLimit: nil
            )
        }
        let thread = Thread(
            id: "thread-today", title: " Todays Team ", type: .team,
            workspaceId: "workspace-1", avatarUrl: nil, lastMessage: nil,
            unreadCount: 0, isPinned: false, isMuted: false, participantIds: [],
            createdAt: .distantPast, updatedAt: .distantPast, teamId: nil,
            departmentId: nil, agentIds: [], status: .active
        )

        XCTAssertEqual(
            ThreadAvatarResolver.clusterMembers(thread: thread, agents: agents, teams: [team]).map(\.id),
            ["agent-1", "agent-2", "agent-3", "agent-4"]
        )
    }

    func testTeamAvatarResolverUsesTheSameSendersShownInsideTheConversation() {
        let agents = (1...4).map { index in
            Agent(
                id: "workspace-agent-\(index)", externalId: nil, name: "Workspace Agent \(index)",
                role: "Assistant", avatarUrl: "/avatars/workspace-agent-\(index).png",
                status: .onDuty, teamId: nil, departmentId: nil, companyId: nil,
                groupType: "personal", groupLabel: nil, workspaceId: "workspace-1",
                managerId: nil, description: nil, capabilities: [], workingHoursMode: .manual,
                timezone: "UTC", createdAt: .distantPast, updatedAt: .distantPast,
                runtimeType: nil, currentTaskId: nil, tasksCompletedToday: 0, successRate: 0,
                avgCompletionMinutes: 0, totalMinutesWorked: 0, budgetUsed: 0, budgetLimit: nil
            )
        }
        let thread = Thread(
            id: "orphaned-team", title: "Hermes First Team", type: .team,
            workspaceId: "workspace-1", avatarUrl: nil, lastMessage: nil,
            unreadCount: 0, isPinned: false, isMuted: false, participantIds: [],
            createdAt: .distantPast, updatedAt: .distantPast, teamId: nil,
            departmentId: nil, agentIds: [], status: .active
        )

        XCTAssertEqual(
            ThreadAvatarResolver.clusterMembers(
                thread: thread,
                agents: agents,
                messageSenderIds: ["workspace-agent-3", "workspace-agent-1", "workspace-agent-4"]
            ).map(\.id),
            ["workspace-agent-3", "workspace-agent-1", "workspace-agent-4"]
        )
    }

    func testAgentAvatarCategoriesUseTheirOwnProductionArtwork() {
        let expectedCounts: [AgentAvatarCategory: Int] = [
            .illustrated: 42,
            .corporate: 124,
            .creator: 24,
            .urban: 24,
            .portrait: 48,
            .comic: 33,
            .retro: 15,
            .hero: 24,
            .vector: 24,
        ]

        for category in AgentAvatarCategory.allCases {
            XCTAssertEqual(
                BuiltInAgentAvatarLibrary.avatars(for: category).count,
                expectedCounts[category],
                category.rawValue
            )
        }

        XCTAssertEqual(
            BuiltInAgentAvatarLibrary.avatars(for: .comic).first,
            "/avatars/illustrated/sheet-08_avatar-001.png"
        )
        XCTAssertEqual(
            BuiltInAgentAvatarLibrary.avatars(for: .comic).last,
            "/avatars/illustrated/sheet-09_avatar-009.png"
        )
        XCTAssertEqual(
            BuiltInAgentAvatarLibrary.avatars(for: .retro).first,
            "/avatars/illustrated/sheet-09_avatar-010.png"
        )
        XCTAssertEqual(
            BuiltInAgentAvatarLibrary.avatars(for: .hero).first,
            "/avatars/illustrated/sheet-04_avatar-001.png"
        )
    }

    func testRelayChatsListSearchAndNewThreadContract() {
        XCTAssertEqual(ChatsParityContract.title, "Chats")
        XCTAssertEqual(ChatsParityContract.searchPrompt, "Search Relay Console")
        XCTAssertEqual(ChatsParityContract.newThreadTitle, "New Chat")
        XCTAssertEqual(ThreadFilter.allCases.map(\.rawValue), ["All", "Business", "Family", "Personal"])
        XCTAssertEqual(NewThreadMode.allCases.map(\.rawValue), ["Direct", "Team", "Department"])
    }

    func testRelayThreadMessageMarkdownAndComposerContract() {
        XCTAssertEqual(WebMessageCardTone.user.background, RelayColors.userCardBackground)
        XCTAssertEqual(WebMessageCardTone.user.border, RelayColors.userCardBorder)
        XCTAssertEqual(WebMessageCardTone.agent(seed: "one").background, RelayColors.agentCardBackground)
        XCTAssertEqual(WebMessageCardTone.agent(seed: "two").border, RelayColors.agentCardBorder)
        XCTAssertEqual(
            RelayRuntimeApprovalMode.allCases.map(\.rawValue),
            ["ask_for_approval", "approve_for_me", "full_access"]
        )
        XCTAssertEqual(
            RelayRuntimeApprovalMode.allCases.map(\.title),
            ["Ask for Approval", "Approve for Me", "Full Access"]
        )
        XCTAssertTrue(
            RelayRuntimeApprovalMode.askForApproval.explanation.contains(
                "Conversations start immediately"
            )
        )
        XCTAssertEqual(RelayThreadState.loading, .loading)
        XCTAssertEqual(RelayThreadState.empty, .empty)
    }

    func testRelayAgentsRootContract() {
        XCTAssertEqual(AgentsManagementTab.allCases, [.agents, .structure, .classify, .calendar, .tasks])
        XCTAssertEqual(AgentsManagementTab.allCases.map(\.rawValue), ["Agents", "Structure", "Classification", "Work Calendar", "Tasks"])
        XCTAssertEqual(AgentPlacementFilter.allCases.map(\.rawValue), ["Business", "Family", "Personal"])
    }

    func testRelayAgentDetailEditAndRemoteActionContract() {
        XCTAssertEqual(
            AgentDetailParityDestination.allCases.map(\.rawValue),
            ["Agent Instructions", "Agent Memory", "Agent Skills", "Workspace Files", "Work Calendar", "Work Task Schedule", "Cron Jobs"]
        )
        XCTAssertEqual(APIEndpoint.setAgentStatus(agentId: "agent-1", status: "paused", reason: "Maintenance").path, "agents/agent-1/status")
        XCTAssertEqual(APIEndpoint.setAgentStatus(agentId: "agent-1", status: "paused", reason: nil).method, .patch)
        XCTAssertEqual(APIEndpoint.deleteAgent(id: "agent-1").method, .delete)
    }

    func testRelayOrganisationTeamAndTruthfulGatingContract() {
        XCTAssertEqual(TeamDetailDestination.allCases.map(\.rawValue), ["Dashboard", "Inbox", "Memory", "Handover", "Settings"])
        XCTAssertEqual(APIEndpoint.teamMemory(teamId: "team-1", page: 1).method, .get)
        XCTAssertEqual(APIEndpoint.addTeamMemory(teamId: "team-1", title: "Rule", content: "Content", type: "rule").method, .post)
        XCTAssertEqual(APIEndpoint.teamHandovers(teamId: "team-1", page: 1).method, .get)
        XCTAssertEqual(APIEndpoint.updateDepartment(id: "department-1", params: ["name": "Example"]).method, .patch)
    }

    @MainActor
    func testRelayCuratedArtifactsContract() {
        XCTAssertEqual(ArtifactsViewModel.rootFolder, ".clawchat/artifacts")
        XCTAssertEqual(ArtifactKind.classify(filename: "report.md"), .document)
        XCTAssertEqual(ArtifactKind.classify(filename: "preview.png"), .image)
        XCTAssertEqual(ArtifactKind.classify(filename: "recording.m4a"), .audio)
        XCTAssertEqual(ArtifactKind.classify(filename: "metrics.csv"), .data)
        XCTAssertEqual(APIEndpoint.workspaceLibraryList(workspaceId: "ws-1", folder: ArtifactsViewModel.rootFolder).method, .get)
        XCTAssertEqual(APIEndpoint.workspaceLibraryReadFile(workspaceId: "ws-1", folder: "cron/job", filename: "report.md").method, .get)
    }

    func testRelayApplicationsCatalogAndLifecycleContract() {
        XCTAssertEqual(MarketplaceAvailabilityFilter.allCases.map(\.rawValue), ["All availability", "Available", "Unavailable"])
        XCTAssertEqual(APIEndpoint.marketplaceCatalog(workspaceId: "ws-1").method, .get)
        XCTAssertEqual(APIEndpoint.marketplaceConnections(workspaceId: "ws-1", appSlug: nil).method, .get)
        let updateConnection = APIEndpoint.updateMarketplaceConnection(
            workspaceId: "ws-1",
            id: "connection-1",
            params: ["displayName": "Updated"]
        )
        XCTAssertEqual(updateConnection.path, "workspaces/ws-1/marketplace/connections/connection-1")
        XCTAssertEqual(updateConnection.method, .patch)
        let disconnectConnection = APIEndpoint.disconnectMarketplaceOAuth(
            workspaceId: "ws-1",
            slug: "jotform",
            connectionId: "connection-1"
        )
        XCTAssertEqual(
            disconnectConnection.path,
            "workspaces/ws-1/marketplace/connectors/jotform/connections/connection-1/disconnect"
        )
        XCTAssertEqual(disconnectConnection.method, .post)
        XCTAssertEqual(APIEndpoint.marketplaceInstalls(workspaceId: "ws-1").method, .get)
        XCTAssertEqual(APIEndpoint.marketplaceToolRequests(workspaceId: "ws-1", status: "requested").method, .get)
    }

    func testMarketplaceOAuthReturnContractContainsNoProviderSecrets() throws {
        let returnURL = try XCTUnwrap(
            MarketplaceOAuthCallback.returnURL(
                workspaceId: "workspace-1",
                appSlug: "google-calendar"
            )
        )
        XCTAssertEqual(
            returnURL.absoluteString,
            "relayconsole://marketplace/oauth?workspace_id=workspace-1&marketplace_app=google-calendar"
        )

        let callbackURL = try XCTUnwrap(URL(string:
            "relayconsole://marketplace/oauth?workspace_id=workspace-1&marketplace_app=google-calendar&connector_oauth=google-calendar&status=connected&connectionId=connection-1&marketplace_connection_id=connection-1"
        ))
        let callback = try MarketplaceOAuthCallback.parse(
            callbackURL,
            expectedWorkspaceId: "workspace-1",
            expectedAppSlug: "google-calendar"
        )
        XCTAssertEqual(callback.status, .connected)
        XCTAssertEqual(callback.connectionId, "connection-1")
        XCTAssertFalse(callbackURL.absoluteString.contains("code="))
        XCTAssertFalse(callbackURL.absoluteString.contains("state="))
        XCTAssertFalse(callbackURL.absoluteString.contains("token="))
    }

    func testMarketplaceOAuthReturnRejectsContextMismatchAndSensitiveData() throws {
        let wrongWorkspace = try XCTUnwrap(URL(string:
            "relayconsole://marketplace/oauth?workspace_id=workspace-2&marketplace_app=slack&connector_oauth=slack&status=connected&connectionId=connection-1&marketplace_connection_id=connection-1"
        ))
        XCTAssertThrowsError(
            try MarketplaceOAuthCallback.parse(
                wrongWorkspace,
                expectedWorkspaceId: "workspace-1",
                expectedAppSlug: "slack"
            )
        )

        for sensitiveName in ["code", "state", "access_token", "refresh_token", "message"] {
            let raw = "relayconsole://marketplace/oauth?workspace_id=workspace-1&marketplace_app=slack&connector_oauth=slack&status=error&error=oauth_failed&\(sensitiveName)=secret"
            let url = try XCTUnwrap(URL(string: raw))
            XCTAssertThrowsError(
                try MarketplaceOAuthCallback.parse(
                    url,
                    expectedWorkspaceId: "workspace-1",
                    expectedAppSlug: "slack"
                ),
                "Expected \(sensitiveName) to be rejected"
            )
        }
    }

    func testMarketplaceDangerousPolicyStaysOutsideOrdinaryChoices() {
        let profiles = [
            MarketplaceApprovalProfile(
                id: "safe",
                label: "Safe",
                description: "Safe profile",
                defaultSelected: true,
                allowedActions: [],
                approvalRequiredActions: [],
                blockedActions: []
            ),
            MarketplaceApprovalProfile(
                id: MarketplaceDangerousPolicy.id,
                label: "Dangerously skip permissions",
                description: "Dangerous profile",
                defaultSelected: false,
                allowedActions: [],
                approvalRequiredActions: [],
                blockedActions: []
            ),
        ]

        XCTAssertEqual(
            MarketplaceDangerousPolicy.ordinaryProfiles(profiles).map(\.id),
            ["safe"]
        )
        XCTAssertTrue(MarketplaceDangerousPolicy.warning.localizedCaseInsensitiveContains("connection ownership"))
        XCTAssertTrue(MarketplaceDangerousPolicy.warning.localizedCaseInsensitiveContains("selected capabilities"))
        XCTAssertTrue(MarketplaceDangerousPolicy.warning.localizedCaseInsensitiveContains("blocked actions"))
        XCTAssertTrue(MarketplaceDangerousPolicy.warning.localizedCaseInsensitiveContains("rate limits"))
        XCTAssertTrue(MarketplaceDangerousPolicy.warning.localizedCaseInsensitiveContains("secret non-exposure"))
    }

    func testMarketplaceRoleManifestDecodesProviderRoles() throws {
        let data = """
        {
          "roles": [{
            "role": "operator",
            "label": "Operator",
            "purpose": "Read bounded provider context and perform approved writes.",
            "docsSourcePath": null,
            "runtimeOutputPath": null,
            "canWrite": true,
            "readOnly": false,
            "approvalRequiredFor": ["comment.create"],
            "blockedActions": ["workspace.admin"],
            "required": true,
            "installAfterSetup": true,
            "recommendedAgentName": null,
            "recommendedAgentType": "openclaw",
            "installable": true,
            "notInstallableReason": null,
            "source": "curated_source"
          }],
          "roleCount": 1
        }
        """.data(using: .utf8)!

        let manifest = try APIClient.decoder.decode(MarketplaceRoleManifest.self, from: data)
        XCTAssertEqual(manifest.roleCount, 1)
        XCTAssertEqual(manifest.roles.first?.role, "operator")
        XCTAssertEqual(manifest.roles.first?.installAfterSetup, true)
        XCTAssertEqual(manifest.roles.first?.blockedActions, ["workspace.admin"])
    }

    func testRelayApprovalPayloadFilterAndActionContract() throws {
        let now = Date()
        let approval = Approval(
            id: "approval-1", title: "Send provider message", description: "Review exact action",
            status: .pending, requestedByAgentId: "relay-operator", taskId: "task-1", workspaceId: "ws-1",
            risk: .high, steps: [], createdAt: now, resolvedAt: nil, expiresAt: now.addingTimeInterval(-60), notes: nil,
            metadata: [
                "provider": .string("Slack"),
                "provenance": .string("provider_action_broker"),
                "exactPayload": .object([
                    "channel": .string("operations"),
                    "authorization": .string("Bearer private-value"),
                    "nested": .object(["api_key": .string("private-key")])
                ])
            ]
        )

        XCTAssertEqual(approval.effectiveStatus, .expired)
        XCTAssertEqual(ApprovalPayloadPresentation.stringMetadata(approval, keys: ["provider"]), "Slack")
        let payload = try XCTUnwrap(ApprovalPayloadPresentation.payloadText(for: approval))
        XCTAssertTrue(payload.contains("operations"))
        XCTAssertTrue(payload.contains("[redacted]"))
        XCTAssertFalse(payload.contains("private-value"))
        XCTAssertFalse(payload.contains("private-key"))
        XCTAssertEqual(APIEndpoint.approvals(workspaceId: "ws-1", page: 1, status: nil).method, .get)
        XCTAssertEqual(APIEndpoint.resolveApproval(id: "approval-1", decision: "approved", notes: nil).method, .post)
    }

    func testRelaySettingsAccountWorkspaceAndOutboundBridgeContract() {
        XCTAssertEqual(APIEndpoint.updateProfile(name: "Relay User", avatarUrl: nil).method, .patch)
        XCTAssertEqual(APIEndpoint.updateWorkspace(id: "ws-1", params: ["name": "Operations"]).method, .patch)
        XCTAssertEqual(APIEndpoint.bridgeDevices(workspaceId: "ws-1").method, .get)
        XCTAssertEqual(APIEndpoint.bridgeDevices(workspaceId: "ws-1").path, "bridge/workspaces/ws-1/devices")
        XCTAssertEqual(APIEndpoint.revokeBridgeDevice(id: "device-1").method, .post)
        XCTAssertEqual(APIEndpoint.revokeBridgeDevice(id: "device-1").path, "bridge/devices/device-1/revoke")
    }

    func testRelaySecuritySessionConnectionAndPlatformBoundaryContract() {
        XCTAssertEqual(SecuritySurfaceContract.sharedAuthority, "Relay account security")
        XCTAssertEqual(SecuritySurfaceContract.sharedAuthority, "Relay account security")
        XCTAssertTrue(SecuritySurfaceContract.summary.contains("devices and browsers"))
        XCTAssertTrue(SecuritySurfaceContract.destructiveEvidenceRule.contains("requires confirmation"))
        XCTAssertEqual(APIEndpoint.mobileSessions.method, .get)
        XCTAssertEqual(APIEndpoint.webSessions.method, .get)
        XCTAssertEqual(APIEndpoint.revokeMobileSession(sessionId: "mobile-1").method, .delete)
        XCTAssertEqual(APIEndpoint.revokeWebSession(sessionId: "web-1").method, .post)
        XCTAssertEqual(APIEndpoint.revokeBridgeDevice(id: "bridge-1").method, .post)
    }

    func testRelayCloudAccountDeletionContract() throws {
        let export = APIEndpoint.exportAccount
        XCTAssertEqual(export.path, "auth/account/export")
        XCTAssertEqual(export.method, .get)

        let endpoint = APIEndpoint.deleteAccount(
            currentPassword: "correct horse battery staple",
            confirmation: "DELETE"
        )
        XCTAssertEqual(endpoint.path, "auth/account")
        XCTAssertEqual(endpoint.method, .delete)

        let body = try XCTUnwrap(endpoint.bodyData)
        let payload = try XCTUnwrap(
            JSONSerialization.jsonObject(with: body) as? [String: String]
        )
        XCTAssertEqual(payload["currentPassword"], "correct horse battery staple")
        XCTAssertEqual(payload["confirmation"], "DELETE")
    }

    func testNativeAuthRequestsCarryBoundedDeviceIdentity() throws {
        let login = APIEndpoint.login(
            email: "person@example.test",
            password: "password",
            deviceName: "iPhone",
            platform: "iOS"
        )
        let registration = APIEndpoint.register(
            name: "Person",
            email: "person@example.test",
            password: "correct horse battery staple",
            inviteCode: "RELAY-beta-code",
            deviceName: "iPad",
            platform: "iPadOS"
        )

        let loginBody = try XCTUnwrap(login.bodyData)
        let loginPayload = try XCTUnwrap(
            JSONSerialization.jsonObject(with: loginBody) as? [String: String]
        )
        XCTAssertEqual(loginPayload["deviceName"], "iPhone")
        XCTAssertEqual(loginPayload["platform"], "iOS")

        let registrationBody = try XCTUnwrap(registration.bodyData)
        let registrationPayload = try XCTUnwrap(
            JSONSerialization.jsonObject(with: registrationBody) as? [String: String]
        )
        XCTAssertEqual(registrationPayload["deviceName"], "iPad")
        XCTAssertEqual(registrationPayload["platform"], "iPadOS")
        XCTAssertEqual(registrationPayload["inviteCode"], "RELAY-beta-code")
    }

    @MainActor
    func testMultipartUploadNormalizesFilenameAndMIMEBeforeSerializingHeaders() async throws {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [SessionURLProtocol.self]
        let client = APIClient(
            baseURL: URL(string: "https://api.relayconsole.work/api/v1")!,
            session: URLSession(configuration: configuration),
            initialTokens: AuthTokens(
                accessToken: "access-token",
                refreshToken: "refresh-token",
                expiresIn: 900
            )
        )
        SessionURLProtocol.handler = { request in
            let body = String(decoding: request.httpBody ?? Data(), as: UTF8.self)
            XCTAssertEqual(
                body.components(separatedBy: "Content-Disposition:").count - 1,
                1
            )
            XCTAssertEqual(body.components(separatedBy: "Content-Type:").count - 1, 1)
            XCTAssertTrue(body.contains(#"filename="Resume_notes.md""#))
            XCTAssertTrue(body.contains("Content-Type: text/markdown\r\n"))
            XCTAssertFalse(body.contains("private"))
            XCTAssertFalse(body.contains("\\"))
            return (
                HTTPURLResponse(
                    url: request.url!,
                    statusCode: 200,
                    httpVersion: nil,
                    headerFields: ["Content-Type": "application/json"]
                )!,
                Data(#"{"data":"uploaded"}"#.utf8)
            )
        }
        defer { SessionURLProtocol.handler = nil }

        let result = try await client.upload(
            data: Data("hello".utf8),
            filename: #"C:\private\Résumé notes.md"#,
            mimeType: "TEXT/MARKDOWN",
            endpoint: .uploadAgentLibraryFile(agentId: "agent-1")
        )

        XCTAssertEqual(result, "uploaded")
    }

    @MainActor
    func testMultipartUploadRejectsHeaderSyntaxBeforeNetworkAccess() async {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [SessionURLProtocol.self]
        let client = APIClient(
            baseURL: URL(string: "https://api.relayconsole.work/api/v1")!,
            session: URLSession(configuration: configuration),
            initialTokens: AuthTokens(
                accessToken: "access-token",
                refreshToken: "refresh-token",
                expiresIn: 900
            )
        )
        var requestCount = 0
        SessionURLProtocol.handler = { request in
            requestCount += 1
            return (
                HTTPURLResponse(url: request.url!, statusCode: 500, httpVersion: nil, headerFields: nil)!,
                Data()
            )
        }
        defer { SessionURLProtocol.handler = nil }

        do {
            _ = try await client.upload(
                data: Data("hello".utf8),
                filename: "report.md\r\nX-Evil: yes",
                mimeType: "text/markdown",
                endpoint: .uploadAgentLibraryFile(agentId: "agent-1")
            )
            XCTFail("Header syntax must fail before URLSession receives a request")
        } catch let error as APIError {
            guard case .uploadFailed = error else {
                return XCTFail("Unexpected API error: \(error)")
            }
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
        XCTAssertEqual(requestCount, 0)
    }

    @MainActor
    func testRelayCloudAccountExportProducesAnUnwrappedJSONDocument() async throws {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [SessionURLProtocol.self]
        let client = APIClient(
            baseURL: URL(string: "https://api.relayconsole.work/api/v1")!,
            session: URLSession(configuration: configuration),
            initialTokens: AuthTokens(
                accessToken: "access-token",
                refreshToken: "refresh-token",
                expiresIn: 900
            )
        )
        SessionURLProtocol.handler = { request in
            XCTAssertTrue(request.url?.path.hasSuffix("/auth/account/export") == true)
            XCTAssertEqual(
                request.value(forHTTPHeaderField: "Authorization"),
                "Bearer access-token"
            )
            return (
                HTTPURLResponse(
                    url: request.url!,
                    statusCode: 200,
                    httpVersion: nil,
                    headerFields: ["Content-Type": "application/json"]
                )!,
                Data(#"{"data":{"schemaVersion":"relay.account-export.v1","account":{"email":"person@example.test"}}}"#.utf8)
            )
        }
        defer { SessionURLProtocol.handler = nil }

        let document = try await client.requestJSONDocument(.exportAccount)
        let payload = try XCTUnwrap(
            JSONSerialization.jsonObject(with: document) as? [String: Any]
        )

        XCTAssertEqual(payload["schemaVersion"] as? String, "relay.account-export.v1")
        XCTAssertNil(payload["data"])
        XCTAssertTrue(String(data: document, encoding: .utf8)?.contains("\n") == true)
        XCTAssertEqual(
            SettingsViewState.accountExportFilename(
                now: Date(timeIntervalSince1970: 1_784_118_896)
            ),
            "relay-console-account-export-2026-07-15-123456"
        )
    }

    func testRelayCloudAppStoreBillingEndpointContract() throws {
        let status = APIEndpoint.billingStatus(workspaceId: "workspace-1")
        XCTAssertEqual(status.path, "workspaces/workspace-1/billing/status")
        XCTAssertEqual(status.method, .get)

        let transaction = APIEndpoint.submitAppleTransaction(
            workspaceId: "workspace-1",
            signedTransaction: "apple-signed-jws"
        )
        XCTAssertEqual(transaction.path, "workspaces/workspace-1/billing/apple/transactions")
        XCTAssertEqual(transaction.method, .post)
        let body = try XCTUnwrap(transaction.bodyData)
        let payload = try XCTUnwrap(
            JSONSerialization.jsonObject(with: body) as? [String: String]
        )
        XCTAssertEqual(payload, ["signedTransaction": "apple-signed-jws"])
    }

    @MainActor
    func testLegacyCloudConnectionPreferenceMigratesToRelayConsoleNamespace() throws {
        let currentKey = "relayconsole.savedCloudConnection"
        let legacyKey = "clawchat.savedCloudConnection"
        UserDefaults.standard.removeObject(forKey: currentKey)
        UserDefaults.standard.removeObject(forKey: legacyKey)
        defer {
            UserDefaults.standard.removeObject(forKey: currentKey)
            UserDefaults.standard.removeObject(forKey: legacyKey)
        }

        let connection = MobileCloudConnection(
            deploymentId: "deployment-1",
            displayName: "Relay",
            apiOrigin: URL(string: "https://api.relayconsole.work/api/v1")!,
            websocketOrigin: URL(string: "wss://api.relayconsole.work")!,
            webOrigin: URL(string: "https://relayconsole.work")!,
            manifestURL: URL(string: "https://api.relayconsole.work/api/v1/deployment/manifest")!,
            keyId: "key-1"
        )
        UserDefaults.standard.set(try JSONEncoder().encode(connection), forKey: legacyKey)

        XCTAssertEqual(AppRuntimeConfig.savedConnection, connection)
        XCTAssertNotNil(UserDefaults.standard.data(forKey: currentKey))
        XCTAssertNil(UserDefaults.standard.data(forKey: legacyKey))
    }

    @MainActor
    func testRelayCloudLaunchAcceptsSecureSelfHostedDeployment() throws {
        let currentKey = "relayconsole.savedCloudConnection"
        UserDefaults.standard.removeObject(forKey: currentKey)
        defer { UserDefaults.standard.removeObject(forKey: currentKey) }
        let connection = MobileCloudConnection(
            deploymentId: "customer-deployment",
            displayName: "Customer Railway",
            apiOrigin: URL(string: "https://customer.example/api/v1")!,
            websocketOrigin: URL(string: "wss://customer.example")!,
            webOrigin: URL(string: "https://customer.example")!,
            manifestURL: URL(string: "https://customer.example/api/v1/deployment/manifest")!,
            keyId: "customer-key"
        )

        XCTAssertNoThrow(try AppRuntimeConfig.save(connection: connection))
        XCTAssertEqual(AppRuntimeConfig.savedConnection, connection)
    }

    func testLegacyKeychainTokensMigrateToRelayConsoleService() throws {
        let currentService = "com.relayconsole.app.auth"
        let legacyService = "com.clawchat.app.auth"
        let account = "mobile_tokens"
        AuthTokenStore.delete()
        defer { AuthTokenStore.delete() }

        let tokens = AuthTokens(
            accessToken: "legacy-access-token",
            refreshToken: "legacy-refresh-token",
            expiresIn: 900
        )
        let legacyItem: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: legacyService,
            kSecAttrAccount as String: account,
            kSecValueData as String: try JSONEncoder().encode(tokens),
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
        ]
        XCTAssertEqual(SecItemAdd(legacyItem as CFDictionary, nil), errSecSuccess)

        XCTAssertEqual(AuthTokenStore.load()?.accessToken, tokens.accessToken)

        let currentQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: currentService,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var currentResult: CFTypeRef?
        XCTAssertEqual(SecItemCopyMatching(currentQuery as CFDictionary, &currentResult), errSecSuccess)

        let legacyQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: legacyService,
            kSecAttrAccount as String: account,
        ]
        XCTAssertEqual(SecItemCopyMatching(legacyQuery as CFDictionary, nil), errSecItemNotFound)
    }

    @MainActor
    func testMobileSessionCredentialsAndLogoutRequestContract() throws {
        APIClient.shared.clearTokens()
        defer { APIClient.shared.clearTokens() }

        let tokens = AuthTokens(
            accessToken: "access-token-for-session-a",
            refreshToken: "refresh-token-for-session-a",
            expiresIn: 900
        )
        APIClient.shared.setTokens(tokens)

        let persisted = try XCTUnwrap(AuthTokenStore.load())
        XCTAssertEqual(persisted.accessToken, tokens.accessToken)
        XCTAssertEqual(persisted.refreshToken, tokens.refreshToken)

        let attributeQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "com.relayconsole.app.auth",
            kSecAttrAccount as String: "mobile_tokens",
            kSecReturnAttributes as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var keychainResult: CFTypeRef?
        XCTAssertEqual(
            SecItemCopyMatching(attributeQuery as CFDictionary, &keychainResult),
            errSecSuccess
        )
        let attributes = try XCTUnwrap(keychainResult as? [String: Any])
        XCTAssertEqual(
            attributes[kSecAttrAccessible as String] as? String,
            kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly as String
        )

        let logoutRequest = try XCTUnwrap(APIClient.shared.prepareLogoutRequestAndClearTokens())
        XCTAssertEqual(logoutRequest.httpMethod, "POST")
        XCTAssertEqual(logoutRequest.url?.absoluteString, "https://api.relayconsole.work/api/v1/auth/logout")
        XCTAssertEqual(
            logoutRequest.value(forHTTPHeaderField: "Authorization"),
            "Bearer access-token-for-session-a"
        )
        XCTAssertNil(APIClient.shared.authTokens)
        XCTAssertNil(AuthTokenStore.load())

        let refresh = APIEndpoint.refreshToken(token: "refresh-token-for-session-a")
        XCTAssertEqual(refresh.path, "auth/refresh")
        XCTAssertEqual(refresh.method, .post)
        let refreshBody = try XCTUnwrap(refresh.bodyData)
        XCTAssertEqual(
            (try JSONSerialization.jsonObject(with: refreshBody) as? [String: String])?["refreshToken"],
            "refresh-token-for-session-a"
        )
    }

    @MainActor
    func testLogoutClearsUserScopedStateBeforeAccountSwitching() {
        APIClient.shared.clearTokens()
        let store = AppStore()
        let now = Date()
        store.currentUser = User(
            id: "user-a",
            email: "a@example.test",
            name: "Account A",
            avatarUrl: nil,
            createdAt: now,
            updatedAt: now
        )
        store.isAuthenticated = true
        store.selectedWorkspace = Workspace(
            id: "workspace-a",
            name: "Account A Workspace",
            type: .personal,
            createdAt: now,
            updatedAt: now
        )
        UserDefaults.standard.set("workspace-a", forKey: "clawchat.lastSelectedWorkspaceId")

        store.logout()

        XCTAssertNil(store.currentUser)
        XCTAssertFalse(store.isAuthenticated)
        XCTAssertNil(store.selectedWorkspace)
        XCTAssertTrue(store.workspaces.isEmpty)
        XCTAssertTrue(store.threads.isEmpty)
        XCTAssertNil(UserDefaults.standard.string(forKey: "clawchat.lastSelectedWorkspaceId"))
        XCTAssertNil(UserDefaults.standard.string(forKey: "relayconsole.lastSelectedWorkspaceId"))
    }

    @MainActor
    func testExpiredAccessTokenRefreshesOnceAndRetriesWithRotatedCredentials() async throws {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [SessionURLProtocol.self]
        let client = APIClient(
            baseURL: URL(string: "https://api.relayconsole.work/api/v1")!,
            session: URLSession(configuration: configuration),
            initialTokens: AuthTokens(
                accessToken: "expired-access",
                refreshToken: "valid-refresh",
                expiresIn: 0
            )
        )
        var requests: [URLRequest] = []
        var meCount = 0
        SessionURLProtocol.handler = { request in
            requests.append(request)
            let path = request.url?.path ?? ""
            if path.hasSuffix("/auth/me") {
                meCount += 1
                if meCount == 1 {
                    return (
                        HTTPURLResponse(url: request.url!, statusCode: 401, httpVersion: nil, headerFields: nil)!,
                        Data("{\"message\":\"expired\"}".utf8)
                    )
                }
                return (
                    HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!,
                    Data("""
                    {"data":{"id":"user-1","email":"person@example.test","name":"Person","avatarUrl":null,"createdAt":"2026-07-14T12:00:00.000Z","updatedAt":"2026-07-14T12:00:00.000Z"}}
                    """.utf8)
                )
            }
            if path.hasSuffix("/auth/refresh") {
                return (
                    HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!,
                    Data("""
                    {"data":{"accessToken":"rotated-access","refreshToken":"rotated-refresh","expiresIn":900}}
                    """.utf8)
                )
            }
            throw URLError(.unsupportedURL)
        }
        defer { SessionURLProtocol.handler = nil }

        let user: User = try await client.request(.me)

        XCTAssertEqual(user.id, "user-1")
        XCTAssertEqual(requests.count, 3)
        XCTAssertEqual(requests[0].value(forHTTPHeaderField: "Authorization"), "Bearer expired-access")
        XCTAssertTrue(requests[1].url?.path.hasSuffix("/auth/refresh") == true)
        XCTAssertEqual(requests[2].value(forHTTPHeaderField: "Authorization"), "Bearer rotated-access")
        XCTAssertEqual(client.authTokens?.accessToken, "rotated-access")
        XCTAssertEqual(client.authTokens?.refreshToken, "rotated-refresh")
    }

    @MainActor
    func testRejectedRefreshTokenFailsClosedAndClearsSession() async {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [SessionURLProtocol.self]
        let client = APIClient(
            baseURL: URL(string: "https://api.relayconsole.work/api/v1")!,
            session: URLSession(configuration: configuration),
            initialTokens: AuthTokens(
                accessToken: "expired-access",
                refreshToken: "revoked-refresh",
                expiresIn: 0
            )
        )
        SessionURLProtocol.handler = { request in
            (
                HTTPURLResponse(url: request.url!, statusCode: 401, httpVersion: nil, headerFields: nil)!,
                Data("{\"message\":\"unauthorized\"}".utf8)
            )
        }
        defer { SessionURLProtocol.handler = nil }

        do {
            let _: User = try await client.request(.me)
            XCTFail("A rejected refresh token must not restore the session")
        } catch {
            XCTAssertTrue(error is APIError)
        }
        XCTAssertNil(client.authTokens)
    }

    @MainActor
    func testRelayOperationalRouteAndRailwayTruthContract() {
        XCTAssertEqual(ConsoleDestination.allCases.filter { $0.group == .remote }.map(\.rawValue), ["Tasks", "Notifications", "Workspace Library", "Quick Actions"])
        XCTAssertEqual(APIEndpoint.runEvents(runId: "run-1", page: 1).method, .get)
        XCTAssertEqual(APIEndpoint.tasks(workspaceId: "ws-1", page: 1, status: nil, agentId: nil, teamId: nil).method, .get)
        XCTAssertEqual(APIEndpoint.alerts(workspaceId: "ws-1", page: 1, unreadOnly: false).method, .get)
        XCTAssertTrue(RunEventsViewModel(run: Run.mockRuns[0]).events.isEmpty)
    }

    func testCrossAppSecondaryStateAndFeedbackContract() {
        XCTAssertGreaterThanOrEqual(RelayMetrics.minimumHitTarget, 44)
        XCTAssertEqual(ThreadFilter.allCases.map(\.rawValue), ["All", "Business", "Family", "Personal"])
        XCTAssertEqual(AlertsViewState.AlertTab.allCases.map(\.rawValue), ["All", "Unread", "Critical"])
        XCTAssertEqual(TaskGroupFilter.allCases.map(\.rawValue), ["All", "Business", "Personal"])
        XCTAssertNotEqual(RelayColors.backgroundSelected, RelayColors.backgroundCard)
        XCTAssertNotEqual(RelayColors.borderFocus, RelayColors.borderStandard)
    }

    @MainActor
    func testCrossAppSecondaryStateMatrixRenders() throws {
        for page in RelayComponentShowcase.Page.allCases {
            let size = CGSize(width: 430, height: 1800)
            let image = render(
                RelayComponentShowcase(page: page)
                    .frame(width: size.width, height: size.height)
                    .background(RelayColors.backgroundPrimary)
                    .preferredColorScheme(.dark),
                size: size
            )
            XCTAssertEqual(image.size, size)
            let attachment = XCTAttachment(image: image)
            attachment.name = "IOSUIUX-001-022-cross-app-\(page.rawValue)"
            attachment.lifetime = .keepAlways
            add(attachment)
        }
    }

    @MainActor
    func testRequiredDeviceMatrixRenders() throws {
        let cases: [(String, CGSize, AnyView)] = [
            ("compact-portrait", CGSize(width: 390, height: 844), AnyView(RelayShellShowcase(mode: .compact))),
            ("large-portrait", CGSize(width: 430, height: 932), AnyView(RelayShellShowcase(mode: .compact))),
            ("landscape", CGSize(width: 844, height: 390), AnyView(HStack(spacing: 0) {
                RelayCompactHeader(title: "Console", icon: "rectangle.3.group").frame(width: 260)
                ScrollView { ConsoleIndexContent(hasWorkspace: true, workspaceName: "Example Workspace", pendingApprovalCount: 3, unreadAlertCount: 4).padding(RelaySpacing.md) }
            })),
            ("wide", CGSize(width: 1180, height: 900), AnyView(RelayShellShowcase(mode: .wide))),
            ("accessibility3", CGSize(width: 430, height: 1800), AnyView(RelayComponentShowcase(page: .foundation).environment(\.dynamicTypeSize, .accessibility3)))
        ]
        for (name, size, content) in cases {
            let image = render(content.frame(width: size.width, height: size.height).background(RelayColors.backgroundPrimary).preferredColorScheme(.dark), size: size)
            XCTAssertEqual(image.size, size)
            let attachment = XCTAttachment(image: image)
            attachment.name = "IOSUIUX-001-024-device-\(name)"
            attachment.lifetime = .keepAlways
            add(attachment)
        }
    }

    @MainActor
    func testRelayOperationalStateMatrixRenders() throws {
        for page in RelayOperationalShowcase.Page.allCases {
            let size = CGSize(width: 430, height: 1600)
            let image = render(
                RelayOperationalShowcase(page: page)
                    .frame(width: size.width, height: size.height)
                    .background(RelayColors.backgroundPrimary)
                    .preferredColorScheme(.dark),
                size: size
            )
            XCTAssertEqual(image.size, size)
            let attachment = XCTAttachment(image: image)
            attachment.name = "IOSUIUX-001-021-operational-\(page.rawValue)"
            attachment.lifetime = .keepAlways
            add(attachment)
        }
    }

    @MainActor
    func testRelaySecurityAndConnectionsStateMatrixRenders() throws {
        for page in RelaySecurityShowcase.Page.allCases {
            let size = CGSize(width: 430, height: 1600)
            let image = render(
                RelaySecurityShowcase(page: page)
                    .frame(width: size.width, height: size.height)
                    .background(RelayColors.backgroundPrimary)
                    .preferredColorScheme(.dark),
                size: size
            )
            XCTAssertEqual(image.size, size)
            let attachment = XCTAttachment(image: image)
            attachment.name = "IOSUIUX-001-020-security-\(page.rawValue)"
            attachment.lifetime = .keepAlways
            add(attachment)
        }
    }

    @MainActor
    func testRelaySettingsStateMatrixRenders() throws {
        for page in RelaySettingsShowcase.Page.allCases {
            let size = CGSize(width: 430, height: 1600)
            let image = render(
                RelaySettingsShowcase(page: page)
                    .frame(width: size.width, height: size.height)
                    .background(RelayColors.backgroundPrimary)
                    .preferredColorScheme(.dark),
                size: size
            )
            XCTAssertEqual(image.size, size)
            let attachment = XCTAttachment(image: image)
            attachment.name = "IOSUIUX-001-019-settings-\(page.rawValue)"
            attachment.lifetime = .keepAlways
            add(attachment)
        }
    }

    @MainActor
    func testRelayApprovalsStateMatrixRenders() throws {
        for page in RelayApprovalsShowcase.Page.allCases {
            let size = CGSize(width: 430, height: 1600)
            let image = render(
                RelayApprovalsShowcase(page: page)
                    .frame(width: size.width, height: size.height)
                    .background(RelayColors.backgroundPrimary)
                    .preferredColorScheme(.dark),
                size: size
            )
            XCTAssertEqual(image.size, size)
            let attachment = XCTAttachment(image: image)
            attachment.name = "IOSUIUX-001-018-approvals-\(page.rawValue)"
            attachment.lifetime = .keepAlways
            add(attachment)
        }
    }

    @MainActor
    func testRelayApplicationsStateMatrixRenders() throws {
        for page in RelayApplicationsShowcase.Page.allCases {
            let size = CGSize(width: 430, height: 1600)
            let image = render(
                RelayApplicationsShowcase(page: page)
                    .frame(width: size.width, height: size.height)
                    .background(RelayColors.backgroundPrimary)
                    .preferredColorScheme(.dark),
                size: size
            )
            XCTAssertEqual(image.size, size)
            let attachment = XCTAttachment(image: image)
            attachment.name = "IOSUIUX-001-013-applications-\(page.rawValue)"
            attachment.lifetime = .keepAlways
            add(attachment)
        }
    }

    @MainActor
    func testRelayCuratedArtifactsStateMatrixRenders() throws {
        for page in RelayArtifactsShowcase.Page.allCases {
            let size = CGSize(width: 430, height: 1500)
            let content = RelayArtifactsShowcase(page: page)
                .frame(width: size.width, height: size.height)
                .background(RelayColors.backgroundPrimary)
                .preferredColorScheme(.dark)
            let image = render(content, size: size)
            XCTAssertEqual(image.size, size)
            let attachment = XCTAttachment(image: image)
            attachment.name = "IOSUIUX-001-012-artifacts-\(page.rawValue)"
            attachment.lifetime = .keepAlways
            add(attachment)
        }
    }

    @MainActor
    func testRelayOrganisationTeamStateMatrixRenders() throws {
        for page in RelayOrganisationTeamShowcase.Page.allCases {
            let size = CGSize(width: 430, height: 1500)
            let content = RelayOrganisationTeamShowcase(page: page)
                .frame(width: size.width, height: size.height)
                .background(RelayColors.backgroundPrimary)
                .preferredColorScheme(.dark)
            let image = render(content, size: size)
            XCTAssertEqual(image.size, size)
            let attachment = XCTAttachment(image: image)
            attachment.name = "IOSUIUX-001-011-organisation-team-\(page.rawValue)"
            attachment.lifetime = .keepAlways
            add(attachment)
        }
    }

    @MainActor
    func testRelayAgentDetailEditAndStatusMatrixRenders() throws {
        for page in RelayAgentDetailShowcase.Page.allCases {
            let size = CGSize(width: 430, height: page.height)
            let content = RelayAgentDetailShowcase(page: page)
                .frame(width: size.width, height: size.height)
                .background(RelayColors.backgroundPrimary)
                .preferredColorScheme(.dark)
            let image = render(content, size: size)
            XCTAssertEqual(image.size, size)
            let attachment = XCTAttachment(image: image)
            attachment.name = "IOSUIUX-001-010-agent-detail-\(page.rawValue)"
            attachment.lifetime = .keepAlways
            add(attachment)
        }
    }

    @MainActor
    func testRelayAgentsFiveModeStateMatrixRenders() throws {
        for page in RelayAgentsRootShowcase.Page.allCases {
            let size = CGSize(width: 430, height: 1500)
            let content = RelayAgentsRootShowcase(page: page)
                .frame(width: size.width, height: size.height)
                .background(RelayColors.backgroundPrimary)
                .preferredColorScheme(.dark)
            let image = render(content, size: size)
            XCTAssertEqual(image.size, size)
            let attachment = XCTAttachment(image: image)
            attachment.name = "IOSUIUX-001-009-agents-\(page.rawValue)"
            attachment.lifetime = .keepAlways
            add(attachment)
        }
    }

    @MainActor
    func testRelayThreadMessageMarkdownAndComposerMatrixRenders() throws {
        for page in RelayThreadShowcase.Page.allCases {
            let size = CGSize(width: 430, height: page.height)
            let content = RelayThreadShowcase(page: page)
                .environmentObject(AppStore())
                .frame(width: size.width, height: size.height)
                .background(RelayColors.chatCanvas)
                .preferredColorScheme(.dark)
            let image = render(content, size: size)
            XCTAssertEqual(image.size.width, size.width)
            XCTAssertEqual(image.size.height, size.height)
            let attachment = XCTAttachment(image: image)
            attachment.name = "IOSUIUX-001-008-thread-\(page.rawValue)"
            attachment.lifetime = .keepAlways
            add(attachment)
        }
    }

    @MainActor
    func testRelayChatsStateMatrixRenders() throws {
        for page in RelayChatsShowcase.Page.allCases {
            let size = CGSize(width: 430, height: page.height)
            let content = RelayChatsShowcase(page: page)
                .environmentObject(AppStore())
                .frame(width: size.width, height: size.height)
                .background(RelayColors.backgroundPrimary)
                .preferredColorScheme(.dark)
            let image = render(content, size: size)
            XCTAssertEqual(image.size.width, size.width)
            XCTAssertEqual(image.size.height, size.height)
            let attachment = XCTAttachment(image: image)
            attachment.name = "IOSUIUX-001-007-chats-\(page.rawValue)"
            attachment.lifetime = .keepAlways
            add(attachment)
        }
    }

    @MainActor
    func testRelayAuthWorkspaceStateMatrixRenders() throws {
        for page in RelayAuthWorkspaceShowcase.Page.allCases {
            let size = CGSize(width: 430, height: page.height)
            let content = RelayAuthWorkspaceShowcase(page: page)
                .frame(width: size.width, height: size.height)
                .background(RelayColors.backgroundPrimary)
                .preferredColorScheme(.dark)
            let image = render(content, size: size)
            XCTAssertEqual(image.size.width, size.width)
            XCTAssertEqual(image.size.height, size.height)
            let attachment = XCTAttachment(image: image)
            attachment.name = "IOSUIUX-001-006-auth-workspace-\(page.rawValue)"
            attachment.lifetime = .keepAlways
            add(attachment)
        }
    }

    @MainActor
    func testRelayShellRendersCompactGuardedAndWideStates() throws {
        for mode in RelayShellShowcase.Mode.allCases {
            let size = mode.size
            let content = RelayShellShowcase(mode: mode)
                .frame(width: size.width, height: size.height)
                .background(RelayColors.backgroundPrimary)
                .preferredColorScheme(.dark)
            let image = render(content, size: size)
            XCTAssertEqual(image.size.width, size.width)
            XCTAssertEqual(image.size.height, size.height)
            let attachment = XCTAttachment(image: image)
            attachment.name = "IOSUIUX-001-005-shell-\(mode.rawValue)"
            attachment.lifetime = .keepAlways
            add(attachment)
        }
    }

    @MainActor
    func testRelayComponentShowcaseRendersDefaultAndAccessibilitySizes() throws {
        for size in [DynamicTypeSize.large, .accessibility3] {
            for page in RelayComponentShowcase.Page.allCases {
                let content = RelayComponentShowcase(page: page)
                    .environment(\.dynamicTypeSize, size)
                    .frame(width: 390, height: page.height)
                    .background(RelayColors.backgroundPrimary)
                let controller = UIHostingController(rootView: content)
                let bounds = CGRect(x: 0, y: 0, width: 390, height: page.height)
                let window = UIWindow(frame: bounds)
                window.rootViewController = controller
                window.makeKeyAndVisible()
                controller.view.frame = bounds
                controller.view.setNeedsLayout()
                controller.view.layoutIfNeeded()
                let renderer = UIGraphicsImageRenderer(bounds: bounds)
                let image = renderer.image { _ in
                    controller.view.drawHierarchy(in: bounds, afterScreenUpdates: true)
                }
                window.isHidden = true
                XCTAssertEqual(image.size.width, 390)
                XCTAssertEqual(image.size.height, page.height)
                let attachment = XCTAttachment(image: image)
                attachment.name = "IOSUIUX-001-004-\(page.rawValue)-\(size == .large ? "default" : "accessibility3")"
                attachment.lifetime = .keepAlways
                add(attachment)
            }
        }
    }

    // MARK: - Domain Model Tests

    func testAgentStatusColor() {
        XCTAssertEqual(Color.agentStatusColor(.onDuty), Color(hex: "#64D78D"))
        XCTAssertEqual(Color.agentStatusColor(.offDuty), Color(hex: "#96999E"))
        XCTAssertEqual(Color.agentStatusColor(.busy), Color(hex: "#D6B967"))
        XCTAssertEqual(Color.agentStatusColor(.paused), Color(hex: "#9B8AD7"))
        XCTAssertEqual(Color.agentStatusColor(.idle), Color(hex: "#B5A16F"))
        XCTAssertEqual(Color.agentStatusColor(.error), Color(hex: "#E16F64"))
    }

    func testRelayThemeMatchesCanonicalSurfaceAndSemanticTokens() {
        XCTAssertEqual(RelayColors.backgroundPrimary, Color(hex: "#060809"))
        XCTAssertEqual(RelayColors.backgroundSecondary, Color(hex: "#0A0D10"))
        XCTAssertEqual(RelayColors.backgroundCard, Color(hex: "#111519"))
        XCTAssertEqual(RelayColors.backgroundElevated, Color(hex: "#1F2730"))
        XCTAssertEqual(RelayColors.backgroundSelected, Color(hex: "#1C2F45"))
        XCTAssertEqual(RelayColors.textPrimary, Color(hex: "#DCD8CA"))
        XCTAssertEqual(RelayColors.textSecondary, Color(hex: "#96999E"))
        XCTAssertEqual(RelayColors.accent, Color(hex: "#508DD7"))
        XCTAssertEqual(RelayColors.accentOrange, Color(hex: "#D6B967"))
        XCTAssertEqual(RelayColors.accentRed, Color(hex: "#E16F64"))
        XCTAssertEqual(RelayColors.chatCanvas, Color(hex: "#050607"))
        XCTAssertEqual(RelayColors.agentCardBackground, RelayColors.chatCanvas)
        XCTAssertEqual(RelayColors.userCardBackground, Color(hex: "#20262D"))
    }

    func testRelayOperationalGeometryContract() {
        XCTAssertEqual(RelayRadius.sm, 4)
        XCTAssertEqual(RelayRadius.md, 6)
        XCTAssertEqual(RelayRadius.card, 4)
        XCTAssertEqual(RelayRadius.bubble, 6)
        XCTAssertEqual(RelayMetrics.minimumHitTarget, 44)
        XCTAssertEqual(RelayMetrics.iconVisualSize, 30)
        XCTAssertEqual(RelayMetrics.searchFieldHeight, 48)
        XCTAssertEqual(RelayBrand.productName, "Relay Console")
    }

    func testThreadTypeSortOrder() {
        // Pinned threads should always come first in sorted chat list
        let pinned = Thread.mockDirect(isPinned: true)
        let normal = Thread.mockDirect(isPinned: false)
        let sorted = [normal, pinned].sorted { a, b in
            if a.isPinned != b.isPinned { return a.isPinned }
            return (a.lastMessage?.timestamp ?? a.createdAt) > (b.lastMessage?.timestamp ?? b.createdAt)
        }
        XCTAssertEqual(sorted.first?.isPinned, true)
    }

    func testDateChatTimestamp() {
        let now = Date()
        XCTAssertEqual(now.chatTimestamp, "Just now")

        let twoMinutesAgo = Date(timeIntervalSinceNow: -120)
        XCTAssertEqual(twoMinutesAgo.chatTimestamp, "2m")

        let yesterday = Calendar.current.date(byAdding: .day, value: -1, to: now)!
        XCTAssertTrue(yesterday.isYesterday)
    }

    func testPaginatedResponseHasMore() {
        let response = PaginatedResponse<Agent>(
            data: [],
            total: 100,
            page: 1,
            pageSize: 20,
            hasMore: true
        )
        XCTAssertTrue(response.hasMore)
        XCTAssertEqual(response.total, 100)
    }

    func testTaskStatusAllCases() {
        let allStatuses: [TaskStatus] = [.queued, .dispatched, .running, .blocked, .awaitingApproval, .failed, .completed, .cancelled]
        XCTAssertEqual(allStatuses.count, 8)
    }

    func testEmbeddedCardDecoding() throws {
        let json = """
        {
            "type": "task",
            "title": "Process Invoices",
            "subtitle": "Completed in 4 minutes",
            "status": "completed",
            "metadata": {"duration": "4m 12s", "tokens": "1,204"},
            "referenceId": "task-123"
        }
        """.data(using: .utf8)!

        let card = try JSONDecoder().decode(EmbeddedCard.self, from: json)
        XCTAssertEqual(card.type, .task)
        XCTAssertEqual(card.title, "Process Invoices")
        XCTAssertEqual(card.metadata["duration"], "4m 12s")
    }

    func testMessageProvenanceDecoding() throws {
        let json = """
        {
            "id": "m1",
            "threadId": "t1",
            "senderId": "u1",
            "senderName": "Alex",
            "content": "Brief",
            "type": "text",
            "provenance": "meeting_brief",
            "attachments": [],
            "isFromUser": true,
            "createdAt": "2026-03-24T10:00:00.000Z",
            "updatedAt": "2026-03-24T10:00:00.000Z"
        }
        """.data(using: .utf8)!

        let message = try APIClient.decoder.decode(Message.self, from: json)
        XCTAssertEqual(message.provenance, .meetingBrief)
    }

    @MainActor
    private func render<Content: View>(_ content: Content, size: CGSize) -> UIImage {
        let controller = UIHostingController(rootView: content)
        let bounds = CGRect(origin: .zero, size: size)
        let window = UIWindow(frame: bounds)
        window.rootViewController = controller
        window.makeKeyAndVisible()
        controller.view.frame = bounds
        controller.view.setNeedsLayout()
        controller.view.layoutIfNeeded()
        RunLoop.main.run(until: Date(timeIntervalSinceNow: 0.08))
        controller.view.layoutIfNeeded()
        let renderer = UIGraphicsImageRenderer(bounds: bounds)
        let image = renderer.image { _ in
            controller.view.drawHierarchy(in: bounds, afterScreenUpdates: true)
        }
        window.isHidden = true
        return image
    }

}

@MainActor
private struct RelaySettingsShowcase: View {
    enum Page: String, CaseIterable { case root, account, workspace }
    let page: Page

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: RelaySpacing.lg) {
                RelayCompactHeader(title: page == .root ? "Settings" : (page == .account ? "Edit Profile" : "Workspace"), icon: "gearshape.fill")
                switch page {
                case .root: root
                case .account: account
                case .workspace: workspace
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, RelaySpacing.lg)
        }
    }

    private var root: some View {
        VStack(alignment: .leading, spacing: RelaySpacing.md) {
            RelaySectionHeader(title: "Settings", subtitle: "Account, workspace, privacy, runtime, and remote controls")
            RelaySectionHeader(title: "Account")
            RelayNavRow(title: "Relay User", subtitle: "user@example.test", icon: "person.crop.circle")
            RelaySectionHeader(title: "Workspace")
            RelayPanel { RelayMetaRow(label: "Name", value: "Operations", icon: "building.2"); RelayMetaRow(label: "Type", value: "Business", icon: "briefcase"); RelayMetaRow(label: "Agents", value: "8", icon: "cpu") }
            RelaySectionHeader(title: "Privacy")
            RelayPanel { Toggle("Product analytics", isOn: .constant(false)); Text("Allowlisted PostHog feature events only; off by default.").font(RelayFonts.caption).foregroundStyle(RelayColors.textSecondary); Toggle("Crash reports", isOn: .constant(false)) }
            RelaySectionHeader(title: "Runtime")
            RelayPanel { Toggle("Technical activity", isOn: .constant(true)); Toggle("Run confirmation", isOn: .constant(true)) }
            RelayNavRow(title: "Password & signed-in devices", subtitle: "Relay account security", icon: "lock.shield.fill")
        }
    }

    private var account: some View {
        VStack(alignment: .leading, spacing: RelaySpacing.md) {
            RelayPanel { RelayMetaRow(label: "Name", value: "Relay User", icon: "person.fill"); RelayMetaRow(label: "Email", value: "user@example.test", icon: "envelope.fill"); Text("Email changes are managed by account security and are not editable here.").font(RelayFonts.caption).foregroundStyle(RelayColors.textSecondary) }
            RelayStatusStrip(title: "Profile updated", detail: "Relay is up to date.", tone: .success, icon: "checkmark.circle.fill")
            RelayStatusStrip(title: "Settings action failed", detail: "The profile could not be saved. Your previous values remain active.", tone: .failure, icon: "exclamationmark.triangle.fill")
            Button(action: {}) { Text("Save").frame(maxWidth: .infinity, minHeight: 44) }.buttonStyle(RelayButtonStyle(variant: .primary))
            Button(action: {}) { Text("Log out").frame(maxWidth: .infinity, minHeight: 44) }.buttonStyle(RelayButtonStyle(variant: .destructive))
            RelayStatusStrip(title: "Logout confirmation", detail: "Ends this mobile session without deleting Relay workspace data.", tone: .warning, icon: "rectangle.portrait.and.arrow.right")
        }
    }

    private var workspace: some View {
        VStack(alignment: .leading, spacing: RelaySpacing.md) {
            RelayPanel { RelayMetaRow(label: "Active", value: "Operations", icon: "checkmark.circle.fill"); RelayMetaRow(label: "Alternative", value: "Research · Switch", icon: "arrow.left.arrow.right") }
            RelaySectionHeader(title: "Edit workspace", subtitle: "Trimmed non-empty names only")
            RelayPanel { RelayMetaRow(label: "Name", value: "Operations", icon: "pencil"); RelayMetaRow(label: "Type", value: "Business", icon: "briefcase") }
            RelayStatusStrip(title: "Workspace updated", detail: "Relay is up to date.", tone: .success, icon: "checkmark.circle.fill")
            RelayStatusStrip(title: "Workspace name required", detail: "An empty or whitespace-only name cannot be saved.", tone: .failure, icon: "exclamationmark.triangle.fill")
            RelaySectionHeader(title: "Bridge URL validation")
            RelayPanel { Text("https://bridge.example.test").font(.system(.caption, design: .monospaced)).foregroundStyle(RelayColors.textPrimary); Text("HTTPS, non-loopback, existing Railway-configured bridge only.").font(RelayFonts.caption).foregroundStyle(RelayColors.textSecondary) }
            RelayInlineEmptyState(icon: "link", title: "No bridge connections", subtitle: "Add metadata only for an already installed and configured bridge.")
        }
    }
}

@MainActor
private struct RelaySecurityShowcase: View {
    enum Page: String, CaseIterable { case security, sessions, connections }
    let page: Page

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: RelaySpacing.lg) {
                RelayCompactHeader(title: page == .connections ? "Connections" : "Security", icon: page == .connections ? "link" : "lock.shield.fill")
                switch page {
                case .security: security
                case .sessions: sessions
                case .connections: connections
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, RelaySpacing.lg)
        }
    }

    private var security: some View {
        VStack(alignment: .leading, spacing: RelaySpacing.md) {
            RelaySectionHeader(title: SecuritySurfaceContract.sharedAuthority, subtitle: SecuritySurfaceContract.summary)
            RelaySectionHeader(title: "Password")
            RelayPanel {
                RelayNavRow(title: "Change password", subtitle: "Signs out every Relay device and browser", icon: "key.fill")
            }
            RelaySectionHeader(title: "Signed-in devices")
            RelayPanel {
                RelayNavRow(title: "This iPhone", subtitle: "iOS · Current · Active", icon: "iphone", badge: "CURRENT", state: .selected)
                RelayNavRow(title: "Safari", subtitle: "Web browser · Active", icon: "globe", badge: "REVOKE")
            }
            RelayNavRow(title: "Sign out on this iPhone", subtitle: "Ends only this mobile session", icon: "rectangle.portrait.and.arrow.right")
        }
    }

    private var sessions: some View {
        VStack(alignment: .leading, spacing: RelaySpacing.md) {
            RelaySectionHeader(title: "Mobile sessions", subtitle: "Current and revocable Relay sessions")
            RelayPanel {
                RelayNavRow(title: "This iPhone", subtitle: "iOS · Current · Active", icon: "iphone", badge: "CURRENT", state: .selected)
                RelayNavRow(title: "Review device", subtitle: "iOS · Active", icon: "iphone", badge: "REVOKE")
            }
            RelaySectionHeader(title: "Browser sessions")
            RelayPanel { RelayNavRow(title: "Safari", subtitle: "Network address recorded · Active", icon: "globe", badge: "REVOKE") }
            RelayStatusStrip(title: "Revoke confirmation", detail: "Ends only the selected Relay session. Account and workspace data remain intact.", tone: .warning, icon: "rectangle.portrait.and.arrow.right")
            RelayInlineEmptyState(icon: "doc.text.magnifyingglass", title: "No audit events", subtitle: "No security audit records were returned for this workspace.")
        }
    }

    private var connections: some View {
        VStack(alignment: .leading, spacing: RelaySpacing.md) {
            RelaySectionHeader(title: "Runtime bridges", subtitle: "Outbound Relay connections, not a runtime installer")
            RelayStatusStrip(title: "Desktop-host responsibility", detail: "Install and update harnesses, plugins, credentials, and host processes on the machine that runs them.", tone: .info, icon: "desktopcomputer")
            RelayPanel {
                RelayNavRow(title: "Studio Mac", subtitle: "OpenClaw · Online · Last 5m ago", icon: "checkmark.circle.fill", badge: "CONNECTED")
                RelayNavRow(title: "Office PC", subtitle: "Hermes Agent · Offline", icon: "exclamationmark.triangle.fill", badge: "OFFLINE")
            }
            RelayInlineEmptyState(icon: "link", title: "No paired runtime bridges", subtitle: "Install and pair the bridge on the computer that runs your agent.")
            RelayStatusStrip(title: "Bridge offline", detail: "Start the user-installed runtime and Relay bridge on its computer, then wait for its outbound connection.", tone: .failure, icon: "wifi.exclamationmark")
            RelayPanel { Text("Relay Console never asks the iPhone app for a public runtime URL or API key.").font(RelayFonts.caption).foregroundStyle(RelayColors.textSecondary) }
        }
    }
}

@MainActor
private struct RelayOperationalShowcase: View {
    enum Page: String, CaseIterable { case routes, tasks, notificationsEvents }
    let page: Page

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: RelaySpacing.lg) {
                RelayCompactHeader(title: page == .routes ? "Quick Actions" : (page == .tasks ? "Tasks" : "Notifications & Runs"), icon: page == .tasks ? "checklist" : "command")
                switch page {
                case .routes: routes
                case .tasks: tasks
                case .notificationsEvents: notificationsEvents
                }
            }
            .padding(.horizontal, RelaySpacing.lg)
        }
    }

    private var routes: some View {
        VStack(alignment: .leading, spacing: RelaySpacing.md) {
            RelaySearchField(text: .constant("report"), prompt: "Search actions")
            RelayPanel {
                RelayNavRow(title: "Applications", subtitle: "Marketplace, connections, and tools", icon: "square.grid.2x2.fill")
                RelayNavRow(title: "Tasks", subtitle: "Scheduled and recurring work", icon: "checklist")
                RelayNavRow(title: "Notifications", subtitle: "Alerts and read state", icon: "bell.fill", badge: "3")
                RelayNavRow(title: "Reports", subtitle: "Hidden pending product validation", icon: "chart.bar.fill", state: .unavailable)
                RelayNavRow(title: "Paperclip", subtitle: "Not supported on iPhone", icon: "paperclip", state: .unavailable)
            }
            RelayInlineEmptyState(icon: "magnifyingglass", title: "No matching actions", subtitle: "Try a different navigation or operation name.")
        }
    }

    private var tasks: some View {
        VStack(alignment: .leading, spacing: RelaySpacing.md) {
            RelaySearchField(text: .constant("deployment"), prompt: "Search tasks")
            HStack { FilterChip(title: "All", isSelected: true, action: {}); FilterChip(title: "Business", isSelected: false, action: {}); FilterChip(title: "Personal", isSelected: false, action: {}) }
            RelayPanel {
                RelayNavRow(title: "Review deployment", subtitle: "Relay Analyst · Running", icon: "arrow.triangle.2.circlepath", badge: "RUNNING")
                RelayNavRow(title: "Prepare handoff", subtitle: "Unassigned · Awaiting approval", icon: "checkmark.shield", badge: "APPROVAL")
            }
            RelayStatusStrip(title: "Task action unavailable", detail: "Run, cancel, retry, investigate and force-continue remain gated without a verified Railway contract.", tone: .warning, icon: "lock.shield")
            RelayLoadingState(message: "Loading tasks").frame(height: 100)
            RelayErrorPanel(message: "Tasks could not be loaded from Railway. Try again.")
            RelayInlineEmptyState(icon: "checklist", title: "No tasks", subtitle: "No tasks match the current filter.")
        }
    }

    private var notificationsEvents: some View {
        VStack(alignment: .leading, spacing: RelaySpacing.md) {
            RelaySectionHeader(title: "Notifications", subtitle: "All · Unread 3 · Critical")
            RelayPanel {
                RelayNavRow(title: "Approval expired", subtitle: "High · Unread · 5m ago", icon: "clock.badge.xmark", badge: "HIGH")
                RelayNavRow(title: "Agent recovered", subtitle: "Info · Read · 12m ago", icon: "checkmark.circle.fill")
            }
            RelayInlineEmptyState(icon: "bell.slash.fill", title: "No alerts", subtitle: "No alerts match the current filter.")
            RelaySectionHeader(title: "Run events", subtitle: "Relay execution log")
            RelayPanel {
                RelayMetaRow(label: "09:41:02", value: "Info · Task started", icon: "info.circle.fill")
                RelayMetaRow(label: "09:41:08", value: "Tool Call · Search workspace", icon: "hammer.fill")
                RelayMetaRow(label: "09:41:12", value: "Error · Permission denied", icon: "xmark.circle.fill")
            }
            RelayErrorPanel(message: "Run events could not be loaded. No invented event history is displayed.")
        }
    }
}

@MainActor
private struct RelayApprovalsShowcase: View {
    enum Page: String, CaseIterable { case queue, detail, states }
    let page: Page

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: RelaySpacing.lg) {
                RelayCompactHeader(title: "Approvals", icon: "checkmark.seal.fill")
                switch page {
                case .queue: queue
                case .detail: detail
                case .states: states
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, RelaySpacing.lg)
        }
    }

    private var queue: some View {
        VStack(alignment: .leading, spacing: RelaySpacing.md) {
            RelaySectionHeader(title: "Approvals", subtitle: "Review retained Railway actions before execution")
            RelaySearchField(text: .constant("provider"), prompt: "Search approvals")
            Label("All statuses", systemImage: "line.3.horizontal.decrease.circle")
                .frame(maxWidth: .infinity, minHeight: 44).background(RelayColors.backgroundSecondary)
            HStack(spacing: RelaySpacing.sm) { stat("Pending", "2", RelayColors.accentOrange); stat("Approved", "4", RelayColors.accentGreen); stat("Rejected", "1", RelayColors.accentRed); stat("Total", "8", RelayColors.accent) }
            RelaySectionHeader(title: "Action queue", subtitle: "3 matching approvals")
            card("Post provider update", "Slack · Pending", "HIGH", RelayColors.accentOrange)
            card("Create repository comment", "GitHub · Approved", "MEDIUM", RelayColors.accentGreen)
            card("Delete campaign", "Marketing · Expired", "CRITICAL", RelayColors.accentRed)
        }
    }

    private var detail: some View {
        VStack(alignment: .leading, spacing: RelaySpacing.md) {
            RelayPanel {
                HStack { Text("Post provider update").font(RelayFonts.cardTitle).foregroundStyle(RelayColors.textPrimary); Spacer(); RelayBadge(text: "PENDING", color: RelayColors.accentOrange) }
                Text("Send a reviewed operational update to the selected provider channel.").font(RelayFonts.cardBody).foregroundStyle(RelayColors.textSecondary)
                RelayMetaRow(label: "Provider", value: "Slack", icon: "shippingbox.fill")
                RelayMetaRow(label: "Provenance", value: "provider_action_broker", icon: "point.3.connected.trianglepath.dotted")
                RelayMetaRow(label: "Requested by", value: "Relay Operator", icon: "person.fill")
                RelayMetaRow(label: "Risk", value: "High · external write", icon: "exclamationmark.shield.fill")
            }
            RelaySectionHeader(title: "Exact action payload", subtitle: "Secrets stay redacted; review every retained field")
            RelayPanel { Text("{\n  \"channel\" : \"operations\",\n  \"text\" : \"Release review ready\",\n  \"authorization\" : \"[redacted]\"\n}").font(.system(.caption, design: .monospaced)).foregroundStyle(RelayColors.textSecondary) }
            RelayStatusStrip(title: "Two-step approval", detail: "Step 1 approved · Step 2 pending", tone: .warning, icon: "checkmark.shield.fill")
            HStack(spacing: RelaySpacing.sm) {
                Button(action: {}) { Text("Approve").frame(maxWidth: .infinity, minHeight: 44) }.buttonStyle(RelayButtonStyle(variant: .primary))
                Button(action: {}) { Text("Reject").frame(maxWidth: .infinity, minHeight: 44) }.buttonStyle(RelayButtonStyle(variant: .destructive))
            }
        }
    }

    private var states: some View {
        VStack(alignment: .leading, spacing: RelaySpacing.md) {
            RelayStatusStrip(title: "Expired approval", detail: "This action can no longer be approved or rejected.", tone: .failure, icon: "clock.badge.exclamationmark")
            RelayStatusStrip(title: "Payload redacted", detail: "Sensitive credential values are replaced before display.", tone: .warning, icon: "eye.slash.fill")
            RelayStatusStrip(title: "Approval action failed", detail: "Railway rejected the decision; the retained record is unchanged.", tone: .failure, icon: "exclamationmark.triangle.fill")
            RelayInlineEmptyState(icon: "checkmark.seal.fill", title: "All clear", subtitle: "No retained approvals match all statuses.")
            RelayInlineEmptyState(icon: "magnifyingglass", title: "No approvals found", subtitle: "Try another search or status filter.")
            RelayLoadingState(message: "Loading approvals").frame(height: 90)
        }
    }

    private func stat(_ title: String, _ value: String, _ color: Color) -> some View { RelayPanel { VStack(spacing: 2) { Text(value).font(.caption.bold()).foregroundStyle(color); Text(title).font(.caption2).foregroundStyle(RelayColors.textSecondary) } } }
    private func card(_ title: String, _ subtitle: String, _ risk: String, _ color: Color) -> some View { RelayPanel { HStack { VStack(alignment: .leading, spacing: 5) { Text(title).font(RelayFonts.cardTitle).foregroundStyle(RelayColors.textPrimary); Text(subtitle).font(RelayFonts.caption).foregroundStyle(RelayColors.textSecondary); Text("Exact retained action · requested 4m ago").font(RelayFonts.caption).foregroundStyle(RelayColors.textTertiary) }; Spacer(); RelayBadge(text: risk, color: color) } } }
}

@MainActor
private struct RelayApplicationsShowcase: View {
    enum Page: String, CaseIterable { case catalog, detail, lifecycle, needed }
    let page: Page

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: RelaySpacing.lg) {
                RelayCompactHeader(title: page == .catalog || page == .needed ? "Applications" : "Example Provider", icon: "square.grid.2x2.fill")
                switch page {
                case .catalog: catalog
                case .detail: detail
                case .lifecycle: lifecycle
                case .needed: needed
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, RelaySpacing.lg)
        }
    }

    private var catalog: some View {
        VStack(alignment: .leading, spacing: RelaySpacing.md) {
            RelaySectionHeader(title: "Applications", subtitle: "Providers, connections, and agent tools")
            RelaySearchField(text: .constant("calendar"), prompt: "Search providers")
            HStack { filter("Productivity", "square.grid.2x2"); filter("Available", "checkmark.circle") }
            HStack(spacing: RelaySpacing.sm) { stat("Providers", "68", RelayColors.accent); stat("Connected", "5", RelayColors.accentGreen); stat("Installed", "9", RelayColors.accentPurple) }
            RelaySectionHeader(title: "Provider catalog", subtitle: "3 matching applications")
            provider("Google Calendar", initials: "GC", category: "productivity", state: "available", connections: "2 connected", color: RelayColors.accent)
            provider("Outlook Calendar", initials: "OC", category: "productivity", state: "available", connections: "1 installed", color: RelayColors.accentPurple)
            provider("CalDAV", initials: "CA", category: "productivity", state: "unavailable", connections: "0 connected", color: RelayColors.textSecondary)
        }
    }

    private var detail: some View {
        VStack(alignment: .leading, spacing: RelaySpacing.md) {
            RelayPanel {
                HStack { mark("GC", RelayColors.accent); VStack(alignment: .leading) { Text("Google Calendar").font(.title3.bold()).foregroundStyle(RelayColors.textPrimary); HStack { RelayBadge(text: "productivity", color: RelayColors.accent); RelayBadge(text: "available", color: RelayColors.accentGreen); RelayBadge(text: "medium", color: RelayColors.textSecondary) } } }
                Text("Read and manage calendars for scheduling-aware agents.").font(RelayFonts.cardBody).foregroundStyle(RelayColors.textSecondary)
            }
            RelaySectionHeader(title: "Capabilities", subtitle: "Selected tools and scope")
            RelayPanel { policy("Read calendars", "List calendars and events", .success); policy("Create events", "Requires approval", .warning); policy("Delete events", "Blocked by default", .failure) }
            RelaySectionHeader(title: "Authority", subtitle: "Approval profile")
            RelayStatusStrip(title: "Balanced authority", detail: "Writes require approval; destructive actions remain blocked.", tone: .warning, icon: "checkmark.shield.fill")
            RelaySectionHeader(title: "Provider links")
            RelayNavRow(title: "Provider documentation", subtitle: "Open the canonical provider guide", icon: "book.closed")
        }
    }

    private var lifecycle: some View {
        VStack(alignment: .leading, spacing: RelaySpacing.md) {
            RelaySectionHeader(title: "Connections", subtitle: "Health and authentication")
            RelayStatusStrip(title: "Production Calendar", detail: "Connected · OAuth · checked 2 minutes ago", tone: .success, icon: "link.circle.fill")
            RelayStatusStrip(title: "Finance Calendar", detail: "Expired token · reconnect required", tone: .failure, icon: "exclamationmark.triangle.fill")
            RelayInlineEmptyState(icon: "link", title: "No connection configured", subtitle: "Add credentials or connect with OAuth before installing this provider.")
            RelaySectionHeader(title: "Agent installation", subtitle: "Runtime, role, and selected connection")
            RelayPanel { RelayMetaRow(label: "Agent", value: "Relay Coordinator", icon: "cpu"); RelayMetaRow(label: "Runtime", value: "OpenClaw", icon: "terminal"); RelayMetaRow(label: "Role", value: "Worker", icon: "person.badge.key") }
            RelayStatusStrip(title: "Install unavailable", detail: "Select a healthy connection before installing for an agent.", tone: .neutral, icon: "lock.fill")
            RelayStatusStrip(title: "Marketplace action failed", detail: "Railway rejected the connection health check.", tone: .failure, icon: "exclamationmark.triangle.fill")
        }
    }

    private var needed: some View {
        VStack(alignment: .leading, spacing: RelaySpacing.md) {
            RelaySectionHeader(title: "Provider catalog", subtitle: "Catalog remains the primary hierarchy")
            provider("Slack", initials: "SL", category: "communication", state: "available", connections: "1 installed", color: RelayColors.accentPurple)
            RelaySectionHeader(title: "Needed Tools", subtitle: "Requested capabilities from Railway agents")
            RelayPanel { Text("Spreadsheet automation").font(RelayFonts.cardTitle).foregroundStyle(RelayColors.textPrimary); Text("Prepare and update workbook reports for the finance handoff.").font(RelayFonts.cardBody).foregroundStyle(RelayColors.textSecondary); Text("Requested by Relay Analyst").font(RelayFonts.caption).foregroundStyle(RelayColors.textSecondary); HStack { Button("Find app") {}; Spacer(); Button("Dismiss", role: .destructive) {} } }
            RelayInlineEmptyState(icon: "wrench.and.screwdriver", title: "No tools requested", subtitle: "Agent requests for additional provider capabilities will appear here.")
            RelayLoadingState(message: "Loading applications").frame(height: 80)
            RelayStatusStrip(title: "Applications could not be loaded", detail: "Railway catalog unavailable.", tone: .failure, icon: "exclamationmark.triangle.fill")
        }
    }

    private func filter(_ title: String, _ icon: String) -> some View { Label(title, systemImage: icon).font(RelayFonts.cardBody).foregroundStyle(RelayColors.textPrimary).frame(maxWidth: .infinity, minHeight: 44).background(RelayColors.backgroundSecondary).clipShape(RoundedRectangle(cornerRadius: RelayRadius.card)) }
    private func stat(_ title: String, _ value: String, _ color: Color) -> some View { RelayPanel { HStack(spacing: 4) { Text(title).font(.caption2).foregroundStyle(RelayColors.textSecondary); Text(value).font(.caption.bold()).foregroundStyle(color) } } }
    private func mark(_ value: String, _ color: Color) -> some View { Text(value).font(.caption.bold()).foregroundStyle(RelayColors.textPrimary).frame(width: 44, height: 44).background(color.opacity(0.18)).clipShape(RoundedRectangle(cornerRadius: RelayRadius.card)) }
    private func provider(_ name: String, initials: String, category: String, state: String, connections: String, color: Color) -> some View { RelayPanel { HStack(alignment: .top) { mark(initials, color); VStack(alignment: .leading, spacing: 5) { HStack { Text(name).font(RelayFonts.cardTitle).foregroundStyle(RelayColors.textPrimary); Spacer(); RelayBadge(text: state, color: state == "available" ? RelayColors.accentGreen : RelayColors.textSecondary) }; Text("Provider capabilities and agent tools from the Railway catalog.").font(RelayFonts.cardBody).foregroundStyle(RelayColors.textSecondary); HStack { RelayBadge(text: category, color: color); RelayBadge(text: connections, color: RelayColors.textSecondary) } }; Image(systemName: "chevron.right").foregroundStyle(RelayColors.textTertiary) } } }
    private func policy(_ title: String, _ detail: String, _ tone: RelayStatusTone) -> some View { RelayStatusStrip(title: title, detail: detail, tone: tone, icon: tone == .success ? "checkmark.circle.fill" : "exclamationmark.circle.fill") }
}

@MainActor
private struct RelayArtifactsShowcase: View {
    enum Page: String, CaseIterable { case populated, detail, states }
    let page: Page

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: RelaySpacing.lg) {
                if page == .populated {
                    HStack(spacing: RelaySpacing.sm) {
                        Image(systemName: "shippingbox.fill").foregroundStyle(RelayColors.accent)
                        Text("Artifacts").font(.title3.weight(.semibold)).foregroundStyle(RelayColors.textPrimary)
                    }
                    .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                } else {
                    RelayCompactHeader(title: page == .detail ? "Artifact" : "Artifacts", icon: "shippingbox.fill")
                }
                switch page {
                case .populated: populated
                case .detail: detail
                case .states: states
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, RelaySpacing.lg)
        }
    }

    private var populated: some View {
        VStack(alignment: .leading, spacing: RelaySpacing.md) {
            RelaySectionHeader(title: "Artifacts", subtitle: "Durable agent outputs from Railway")
            RelaySearchField(text: .constant(""), prompt: "Search artifacts")
            HStack(spacing: RelaySpacing.sm) {
                stat("All", "7", RelayColors.textPrimary)
                stat("Docs", "3", RelayColors.accentGreen)
                stat("Media", "3", RelayColors.accent)
            }
            RelaySectionHeader(title: "Generated outputs", subtitle: "3 artifacts")
            artifact("Launch brief.md", kind: "Documents", source: "Workspace", icon: "doc.text.fill", color: RelayColors.accentGreen)
            artifact("Product still.png", kind: "Images", source: "Workspace", icon: "photo.fill", color: RelayColors.accent)
            RelayPanel {
                HStack {
                    Image(systemName: "chevron.down").foregroundStyle(RelayColors.textSecondary)
                    Image(systemName: "calendar.badge.clock").foregroundStyle(RelayColors.accentGreen)
                    VStack(alignment: .leading) {
                        Text("weekly-review").font(RelayFonts.cardTitle).foregroundStyle(RelayColors.textPrimary)
                        Text("4 cron output files").font(RelayFonts.caption).foregroundStyle(RelayColors.textSecondary)
                    }
                }
            }
            artifact("summary.md", kind: "Documents", source: "Cron output", icon: "doc.text.fill", color: RelayColors.accentGreen)
            artifact("metrics.csv", kind: "Data", source: "Cron output", icon: "tablecells.fill", color: RelayColors.accentPurple)
            RelayNavRow(title: "Browse raw artifact files", subtitle: "Folders, readable files, import, and creation", icon: "folder.fill")
        }
    }

    private var detail: some View {
        VStack(alignment: .leading, spacing: RelaySpacing.md) {
            RelayPanel {
                HStack(alignment: .top) {
                    Image(systemName: "doc.text.fill").foregroundStyle(RelayColors.accentGreen).font(.title2)
                    VStack(alignment: .leading) {
                        Text("Quarterly planning brief.md").font(.title3.weight(.semibold)).foregroundStyle(RelayColors.textPrimary)
                        Text(".clawchat/artifacts/cron/weekly-review/Quarterly planning brief.md").font(.caption.monospaced()).foregroundStyle(RelayColors.textSecondary)
                    }
                }
                HStack { RelayBadge(text: "Documents", color: RelayColors.accentGreen); RelayBadge(text: "Cron output", color: RelayColors.accentGreen); RelayBadge(text: "18 KB", color: RelayColors.textSecondary) }
                RelayMetaRow(label: "Updated", value: "11 Jul 2026 at 19:40", icon: "clock")
                RelayMetaRow(label: "Agent", value: "Relay Planner", icon: "cpu")
            }
            RelaySectionHeader(title: "Preview", subtitle: "Railway file content")
            RelayPanel {
                Text("Quarterly planning brief").font(.title2.bold()).foregroundStyle(RelayColors.textPrimary)
                Text("A long invented document preview demonstrates the selected artifact hierarchy without exposing live workspace content.\n\nObjectives\n• Confirm the launch sequence\n• Capture approval dependencies\n• Retain a durable handoff record")
                    .font(RelayFonts.cardBody).foregroundStyle(RelayColors.textSecondary)
            }
        }
    }

    private var states: some View {
        VStack(alignment: .leading, spacing: RelaySpacing.md) {
            RelayLoadingState(message: "Indexing the Railway artifact folder").frame(height: 90)
            RelayStatusStrip(title: "Artifacts could not be loaded", detail: "Railway returned an unavailable library folder.", tone: .failure, icon: "exclamationmark.triangle.fill")
            RelayInlineEmptyState(icon: "shippingbox", title: "No artifacts yet", subtitle: "Documents, images, video, audio, and data produced by agents will appear here.")
            RelayInlineEmptyState(icon: "magnifyingglass", title: "No artifacts found", subtitle: "Try a different search or artifact kind.")
            RelayStatusStrip(title: "Media preview unavailable", detail: "Railway returned metadata without directly renderable video content.", tone: .neutral, icon: "film.fill")
            RelayStatusStrip(title: "Rename unavailable", detail: "Relay supports reading, writing, creating, and deleting library files, but not renaming them.", tone: .neutral, icon: "lock.fill")
        }
    }

    private func stat(_ title: String, _ value: String, _ color: Color) -> some View {
        RelayPanel { HStack { Text(title).font(.caption).foregroundStyle(RelayColors.textSecondary); Text(value).font(.caption.bold()).foregroundStyle(color) } }
    }

    private func artifact(_ title: String, kind: String, source: String, icon: String, color: Color) -> some View {
        RelayPanel {
            HStack(alignment: .top) {
                Image(systemName: icon).foregroundStyle(color).frame(width: 38, height: 38).background(color.opacity(0.12)).clipShape(RoundedRectangle(cornerRadius: 6))
                VStack(alignment: .leading) {
                    Text(title).font(RelayFonts.cardTitle).foregroundStyle(RelayColors.textPrimary)
                    HStack { RelayBadge(text: kind, color: color); RelayBadge(text: source, color: RelayColors.textSecondary) }
                }
                Spacer(); Image(systemName: "chevron.right").foregroundStyle(RelayColors.textTertiary)
            }
        }
    }
}

@MainActor
private struct RelayOrganisationTeamShowcase: View {
    enum Page: String, CaseIterable { case organisation, team, department, collaboration }
    let page: Page

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: RelaySpacing.lg) {
                RelayCompactHeader(title: title, icon: icon)
                switch page {
                case .organisation: organisation
                case .team: team
                case .department: department
                case .collaboration: collaboration
                }
            }
            .padding(.bottom, RelaySpacing.xl)
        }
    }

    private var title: String {
        switch page {
        case .organisation: "Org Structure"
        case .team: "Example Operations"
        case .department: "Example Department"
        case .collaboration: "Team collaboration"
        }
    }

    private var icon: String {
        switch page {
        case .organisation: "building.2"
        case .team: "person.3"
        case .department: "building"
        case .collaboration: "arrow.triangle.2.circlepath"
        }
    }

    private var organisation: some View {
        VStack(alignment: .leading, spacing: RelaySpacing.md) {
            RelaySectionHeader(title: "Structure", subtitle: "Tree selected · on-duty filter off")
            RelayPanel {
                hierarchyRow("Example Company", detail: "2 departments · 7 agents", icon: "building.2", level: 0)
                hierarchyRow("Operations", detail: "2 teams", icon: "building", level: 1)
                hierarchyRow("Relay Team", detail: "4 agents · 3 active", icon: "person.3", level: 2)
                hierarchyRow("Research Team", detail: "3 agents · 1 active", icon: "person.3", level: 2)
                hierarchyRow("Finance", detail: "No teams", icon: "building", level: 1)
            }
            RelayInlineEmptyState(icon: "building.2", title: "No organisation yet", subtitle: "Create a company to begin a Relay organisation structure.")
            RelayStatusStrip(title: "Create unavailable", detail: "Select a Relay workspace before creating an organisation item.", tone: .neutral, icon: "lock.fill")
        }
        .padding(.horizontal, RelaySpacing.lg)
    }

    private var team: some View {
        VStack(alignment: .leading, spacing: RelaySpacing.md) {
            RelayPanel {
                HStack {
                    RelayAvatar(name: "Relay Lead", imageUrl: nil, size: .medium, status: .onDuty)
                    VStack(alignment: .leading) {
                        Text("Relay Lead").font(RelayFonts.cardTitle).foregroundStyle(RelayColors.textPrimary)
                        Text("Lead · Operations Coordinator").font(RelayFonts.caption).foregroundStyle(RelayColors.textSecondary)
                    }
                    Spacer()
                    RelayBadge(text: "4 agents", color: RelayColors.accent)
                }
            }
            HStack(spacing: RelaySpacing.sm) {
                RelayMetricTile(data: .init(label: "On Duty", value: "3", subValue: "agents", accentColor: RelayColors.accentGreen, icon: "person.fill.checkmark"))
                RelayMetricTile(data: .init(label: "Running", value: "2", subValue: "tasks", accentColor: RelayColors.accent, icon: "play.circle"))
            }
            RelaySectionHeader(title: "Team tools", subtitle: "Dashboard, Inbox, Memory, Handover, Settings")
            RelayPanel(padding: 0) {
                RelayNavRow(title: "Team Memory", subtitle: "Shared rules, SOPs, context, and notes", icon: "brain")
                Divider().overlay(RelayColors.borderLow).padding(.horizontal, RelaySpacing.md)
                RelayNavRow(title: "Handover", subtitle: "Read Railway handover notes", icon: "arrow.triangle.2.circlepath")
                Divider().overlay(RelayColors.borderLow).padding(.horizontal, RelaySpacing.md)
                RelayNavRow(title: "Team Inbox", subtitle: "Railway has no team inbox endpoint", icon: "tray", state: .unavailable)
                Divider().overlay(RelayColors.borderLow).padding(.horizontal, RelaySpacing.md)
                RelayNavRow(title: "Team Settings", subtitle: "No team update or membership endpoint", icon: "gearshape", state: .unavailable)
            }
            RelayStatusStrip(title: "Performance unavailable", detail: "No sample metrics are shown as Railway data.", tone: .neutral, icon: "lock.fill")
        }
        .padding(.horizontal, RelaySpacing.lg)
    }

    private var department: some View {
        VStack(alignment: .leading, spacing: RelaySpacing.md) {
            RelaySectionHeader(title: "Teams", subtitle: "2 teams · 7 agents")
            RelayPanel {
                hierarchyRow("Relay Team", detail: "4 agents · 3 active", icon: "person.3", level: 0)
                hierarchyRow("Research Team", detail: "3 agents · 1 active", icon: "person.3", level: 0)
            }
            HStack(spacing: RelaySpacing.sm) {
                RelayMetricTile(data: .init(label: "Active", value: "4", subValue: "agents", accentColor: RelayColors.accentPurple, icon: "person.fill.checkmark"))
                RelayMetricTile(data: .init(label: "Teams", value: "2", subValue: "Railway", accentColor: RelayColors.accentTeal, icon: "building.2"))
            }
            RelayStatusStrip(title: "Task metrics unavailable", detail: "Running, blocked, and completed totals are not returned by the department contract.", tone: .neutral, icon: "lock.fill")
            RelayStatusStrip(title: "Department Inbox unavailable", detail: "Railway has no department inbox endpoint. No sample messages are shown.", tone: .neutral, icon: "tray")
            RelayStatusStrip(title: "Performance unavailable", detail: "No department ranking is returned by Railway.", tone: .neutral, icon: "chart.line.uptrend.xyaxis")
        }
        .padding(.horizontal, RelaySpacing.lg)
    }

    private var collaboration: some View {
        VStack(alignment: .leading, spacing: RelaySpacing.md) {
            RelaySectionHeader(title: "Team Memory", subtitle: "Search and type filters")
            RelaySearchField(text: .constant("handoff"), prompt: "Search memory")
            RelayInlineEmptyState(icon: "brain", title: "No results found", subtitle: "No Railway memory items match this search and filter.")
            RelayErrorPanel(message: "Team memory could not be loaded from Railway.")
            RelaySectionHeader(title: "Handover", subtitle: "Pending and acknowledged")
            RelayPanel {
                Text("Quarterly review handoff").font(RelayFonts.cardTitle).foregroundStyle(RelayColors.textPrimary)
                Text("Invented fixture content demonstrates long handover hierarchy without exposing live collaboration data.").font(RelayFonts.cardBody).foregroundStyle(RelayColors.textSecondary)
                HStack { RelayBadge(text: "2 tasks", color: RelayColors.textSecondary); Spacer(); RelayBadge(text: "Read only", color: RelayColors.textSecondary, icon: "lock.fill") }
            }
            RelayStatusStrip(title: "Acknowledgement unavailable", detail: "Railway exposes team handovers as read-only; no local acknowledgement is recorded.", tone: .neutral, icon: "lock.fill")
            RelayStatusStrip(title: "Memory editing unavailable", detail: "List and create are supported; update and delete are not exposed by Railway.", tone: .neutral, icon: "lock.fill")
        }
        .padding(.horizontal, RelaySpacing.lg)
    }

    private func hierarchyRow(_ title: String, detail: String, icon: String, level: Int) -> some View {
        HStack(spacing: RelaySpacing.sm) {
            Image(systemName: icon).foregroundStyle(level == 0 ? RelayColors.accent : RelayColors.textSecondary).frame(width: 24)
            VStack(alignment: .leading) {
                Text(title).font(RelayFonts.cardTitle).foregroundStyle(RelayColors.textPrimary)
                Text(detail).font(RelayFonts.caption).foregroundStyle(RelayColors.textSecondary)
            }
            Spacer()
            Image(systemName: "chevron.right").font(.caption.bold()).foregroundStyle(RelayColors.textTertiary)
        }
        .padding(.leading, CGFloat(level) * 18)
        .frame(minHeight: 52)
    }
}

@MainActor
private struct RelayAgentDetailShowcase: View {
    enum Page: String, CaseIterable {
        case detail, edit, status
        var height: CGFloat {
            switch self {
            case .detail: return 1800
            case .edit: return 2300
            case .status: return 1500
            }
        }
    }

    let page: Page
    private let agent = Agent(
        id: "synthetic-agent", externalId: "relay-operator", name: "Relay Operator", role: "Operations Coordinator",
        avatarUrl: nil, status: .onDuty, teamId: "team-example", departmentId: "department-example", companyId: "company-example",
        groupType: "business", groupLabel: nil, workspaceId: "workspace-example", managerId: nil,
        description: "Coordinates operational handoffs and prepares review-ready work without taking unapproved external actions.",
        capabilities: ["summarize", "coordinate", "draft"], workingHoursMode: .scheduled, timezone: "Europe/London",
        createdAt: Date(timeIntervalSince1970: 0), updatedAt: Date(timeIntervalSince1970: 0), runtimeType: .hermes,
        currentTaskId: nil, tasksCompletedToday: 4, successRate: 0.96, avgCompletionMinutes: 11,
        totalMinutesWorked: 320, budgetUsed: 1.2, budgetLimit: 10
    )

    var body: some View {
        switch page {
        case .detail:
            NavigationStack { AgentDetailView(agent: agent).environmentObject(AppStore()) }
        case .edit:
            AgentEditSheet(agent: agent, onSave: { _ in }).environmentObject(AppStore())
        case .status:
            AgentStatusSheet(agent: agent, initialSelection: .paused, onConfirm: { _ in })
        }
    }
}

@MainActor
private struct RelayChatsShowcase: View {
    enum Page: String, CaseIterable {
        case list, states, searchAndNew
        var height: CGFloat { self == .searchAndNew ? 1500 : 1200 }
    }

    let page: Page

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: RelaySpacing.lg) {
                switch page {
                case .list: listPage
                case .states: statesPage
                case .searchAndNew: searchAndNewPage
                }
            }
        }
    }

    private var listPage: some View {
        Group {
            HStack {
                VStack(alignment: .leading) {
                    Text(ChatsParityContract.title).font(RelayFonts.navigationTitle).foregroundStyle(RelayColors.textPrimary)
                    Text("Example Workspace").font(RelayFonts.caption).foregroundStyle(RelayColors.accent)
                }
                Spacer()
                RelayIconButton(icon: "magnifyingglass", label: "Search chats", action: {})
                RelayIconButton(icon: "square.and.pencil", label: "New chat", action: {})
            }
            .padding(RelaySpacing.lg)
            .background(RelayColors.backgroundSecondary)
            HStack {
                ForEach(ThreadFilter.allCases) { filter in
                    FilterChip(title: filter.rawValue, icon: filter.icon, isSelected: filter == .all, action: {})
                }
            }
            .padding(.horizontal, RelaySpacing.sm)
            VStack(spacing: 0) {
                ForEach(sampleThreads) { thread in
                    ThreadRowView(thread: thread)
                    Rectangle().fill(RelayColors.borderLow).frame(height: 1).padding(.leading, 72)
                }
            }
        }
    }

    private var statesPage: some View {
        VStack(alignment: .leading, spacing: RelaySpacing.lg) {
            RelayBrandLockup(compact: true)
            RelaySectionHeader(title: "Chat list states", subtitle: "Loading, empty, filter zero, and error")
            RelayPanel { RelayLoadingState(message: "Loading chats").frame(height: 120) }
            RelayInlineEmptyState(icon: "bubble.left.and.bubble.right", title: "No chats yet", subtitle: "Start a conversation with an agent or team.")
            RelayInlineEmptyState(icon: "building.2", title: "No business chats", subtitle: "No chats match the Business filter.")
            RelayErrorPanel(message: "Chats couldn't load. Check the connection and try again.")
            Button("Retry") {}.buttonStyle(RelayButtonStyle(size: .md, variant: .secondary))
        }
        .padding(RelaySpacing.xl)
    }

    private var searchAndNewPage: some View {
        VStack(alignment: .leading, spacing: RelaySpacing.lg) {
            RelayBrandLockup(compact: true)
            RelaySectionHeader(title: "Search", subtitle: "Query, scopes, zero results, and retry")
            RelaySearchField(text: .constant("deployment"), prompt: ChatsParityContract.searchPrompt, isLoading: true)
            HStack {
                FilterChip(title: "Chats", isSelected: true, unreadCount: 2, action: {})
                FilterChip(title: "Messages", isSelected: false, action: {})
                FilterChip(title: "Agents", isSelected: false, action: {})
            }
            RelayInlineEmptyState(icon: "magnifyingglass", title: "No results", subtitle: "Try another term or search scope.")
            RelayErrorPanel(message: "Search couldn't be completed. Try again.")
            RelaySectionHeader(title: ChatsParityContract.newThreadTitle, subtitle: "Direct, team, and department")
            RelayPanel {
                HStack {
                    ForEach(NewThreadMode.allCases, id: \.self) { mode in
                        VStack(spacing: RelaySpacing.xs) {
                            Image(systemName: mode.icon)
                            Text(mode.rawValue).font(RelayFonts.caption)
                        }
                        .foregroundStyle(mode == .direct ? RelayColors.accent : RelayColors.textSecondary)
                        .frame(maxWidth: .infinity, minHeight: RelayMetrics.minimumHitTarget)
                        .background(mode == .direct ? RelayColors.backgroundSelected : RelayColors.backgroundCard)
                        .overlay(RoundedRectangle(cornerRadius: RelayRadius.sm).stroke(mode == .direct ? RelayColors.borderFocus : RelayColors.borderStandard))
                    }
                }
                RelayNavRow(title: "Relay Analyst", subtitle: "Direct agent · existing chat reused", icon: "person.fill", state: .selected)
                RelayNavRow(title: "Operations Team", subtitle: "Team", icon: "person.2.fill")
                RelayNavRow(title: "Research", subtitle: "Department", icon: "building.2.fill")
                Button(action: {}) { HStack { ProgressView().controlSize(.small); Text("Starting Chat") }.frame(maxWidth: .infinity) }
                    .buttonStyle(RelayButtonStyle(size: .md, variant: .primary))
            }
        }
        .padding(RelaySpacing.xl)
    }

    private var sampleThreads: [ClawChat.Thread] {
        [
            thread(id: "direct", title: "Relay Analyst", type: .direct, content: "The review is ready.", sender: "Relay Analyst", unread: 2, status: .active),
            thread(id: "team", title: "Operations Team", type: .team, content: "Deployment window confirmed.", sender: "Coordinator", unread: 0, status: .active),
            thread(id: "archived", title: "Quarterly Planning", type: .department, content: "Read-only planning archive.", sender: "Planner", unread: 0, status: .archived)
        ]
    }

    private func thread(id: String, title: String, type: ThreadType, content: String, sender: String, unread: Int, status: ThreadStatus) -> ClawChat.Thread {
        ClawChat.Thread(
            id: id, title: title, type: type, workspaceId: "synthetic-workspace", avatarUrl: nil,
            lastMessage: MessagePreview(content: content, senderId: "synthetic-agent", senderName: sender, timestamp: Date(timeIntervalSince1970: 0)),
            unreadCount: unread, isPinned: id == "direct", isMuted: false, participantIds: [],
            createdAt: Date(timeIntervalSince1970: 0), updatedAt: Date(timeIntervalSince1970: 0),
            teamId: type == .team ? "synthetic-team" : nil,
            departmentId: type == .department ? "synthetic-department" : nil,
            agentIds: type == .direct ? ["synthetic-agent"] : [], status: status
        )
    }
}

@MainActor
private struct RelayThreadShowcase: View {
    enum Page: String, CaseIterable {
        case messages, markdown, composer
        var height: CGFloat { self == .markdown ? 1900 : 1650 }
    }

    let page: Page

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: RelaySpacing.lg) {
                RelayBrandLockup(compact: true)
                switch page {
                case .messages: messagesPage
                case .markdown: markdownPage
                case .composer: composerPage
                }
            }
            .padding(.vertical, RelaySpacing.xl)
        }
    }

    private var messagesPage: some View {
        Group {
            RelaySectionHeader(title: "Chat message states", subtitle: "Agent, user, system, attachment, runtime, and failure")
            MessageView(message: agentMessage, previousMessage: nil, agentOverride: fixtureAgent, skipStoreAgentLookup: true, onCardTap: { _ in })
            MessageView(message: userMessage, previousMessage: agentMessage, skipStoreAgentLookup: true, onCardTap: { _ in })
            MessageView(message: systemMessage, previousMessage: userMessage, skipStoreAgentLookup: true, onCardTap: { _ in })
            MessageView(message: attachmentMessage, previousMessage: systemMessage, agentOverride: fixtureAgent, skipStoreAgentLookup: true, onCardTap: { _ in })
            RelayStatusStrip(title: "Relay Agent is running", detail: "Using workspace tools · 18s", tone: .success, icon: "bolt.fill")
            RelayErrorPanel(message: "The agent run failed. Review the error and retry from Chat Info.")
        }
    }

    private var markdownPage: some View {
        Group {
            RelaySectionHeader(title: "Long markdown", subtitle: "Heading, emphasis, links, lists, quote, inline code, and code block")
            MessageView(message: markdownMessage, previousMessage: nil, agentOverride: fixtureAgent, skipStoreAgentLookup: true, onCardTap: { _ in })
            RelayInlineEmptyState(icon: "doc.text.magnifyingglass", title: "References accounted", subtitle: "Document disclosures remain inside the message card when metadata is present.")
        }
    }

    private var composerPage: some View {
        Group {
            RelaySectionHeader(title: "Composer states", subtitle: "Empty, typed, mention, approval modes, busy, and read-only")
            RelayComposer(text: .constant(""), onSend: {}, onAttach: {}, onMicrophone: {}, supportsAttachments: false)
            RelayComposer(text: .constant("Review the deployment plan."), onSend: {}, onAttach: {}, mentionableAgents: [fixtureAgent], supportsAttachments: false, approvalMode: .approveForMe)
            RelayComposer(text: .constant("@Relay"), onSend: {}, onAttach: {}, mentionableAgents: [fixtureAgent], supportsAttachments: false, approvalMode: .fullAccess)
            RelayMentionSuggestions(agents: [fixtureAgent], onSelect: { _ in })
            RelayComposer(text: .constant("Sending this once"), onSend: {}, onAttach: {}, isBusy: true, supportsAttachments: false)
            RelayComposer(text: .constant(""), onSend: {}, onAttach: {}, disabledReason: "This chat is archived and read-only.", supportsAttachments: false)
            RelayStatusStrip(title: "Attachments unavailable", detail: "The current Railway message contract sends text only.", tone: .warning, icon: "paperclip")
            RelayStatusStrip(title: "Approval mode", detail: "Ask for Approval, Approve for Me, and Full Access are sent with the Railway message.", tone: .success, icon: "checkmark.seal")
            RelayThreadStateOverlay(state: .loading).frame(height: 130)
            RelayThreadStateOverlay(state: .empty).frame(height: 220)
            RelayThreadStateOverlay(state: .error("Messages couldn't load from Railway."), retry: {}).frame(height: 180)
        }
    }

    private var fixtureAgent: Agent {
        Agent(
            id: "synthetic-agent", externalId: "relay-analyst", name: "Relay Analyst", role: "Operations Analyst",
            avatarUrl: nil, status: .onDuty, teamId: nil, departmentId: nil, companyId: nil,
            groupType: nil, groupLabel: nil, workspaceId: "synthetic-workspace", managerId: nil,
            description: "Invented evidence fixture", capabilities: ["analysis"], workingHoursMode: .manual,
            timezone: "UTC", createdAt: fixtureDate, updatedAt: fixtureDate, runtimeType: .openClaw,
            currentTaskId: nil, tasksCompletedToday: 2, successRate: 0.95, avgCompletionMinutes: 4,
            totalMinutesWorked: 18, budgetUsed: 0, budgetLimit: nil
        )
    }

    private var agentMessage: Message {
        message(id: "agent", sender: "Relay Analyst", content: "The deployment review is ready. One external action still requires confirmation.", provenance: .agent, fromUser: false)
    }

    private var userMessage: Message {
        message(id: "user", sender: "You", content: "Summarise the remaining risks and link the runbook.", provenance: .user, fromUser: true)
    }

    private var systemMessage: Message {
        message(id: "system", sender: "System", content: "Chat history mode is read-only.", type: .system, provenance: .meetingSystem, fromUser: false)
    }

    private var attachmentMessage: Message {
        Message(
            id: "attachment", threadId: "synthetic-thread", senderId: "synthetic-agent", senderName: "Relay Analyst",
            senderAvatarUrl: nil, content: "deployment-plan.pdf", type: .attachment, provenance: .agent,
            embeddedCard: nil,
            attachments: [MessageAttachment(id: "synthetic-file", filename: "deployment-plan.pdf", url: "https://example.invalid/deployment-plan.pdf", mimeType: "application/pdf", size: 184_320)],
            isFromUser: false, createdAt: fixtureDate, updatedAt: fixtureDate, isEdited: false, replyToId: nil
        )
    }

    private var markdownMessage: Message {
        message(
            id: "markdown", sender: "Relay Analyst",
            content: """
            # Deployment review

            The **production plan** is ready. Read the [runbook](https://example.invalid/runbook) before continuing and verify `CLAWCHAT_RAILWAY_ORIGIN`.

            ## Remaining checks

            - Confirm the Railway health check
            - Review the protected route
            - Record the deployment identifier

            1. Build the iOS client
            2. Run the contract tests
            3. Capture redaction-safe evidence

            > Do not switch API or websocket traffic to a loopback backend.

            ```swift
            let route = "/api/v1"
            let backend = ProcessInfo.processInfo.environment["CLAWCHAT_RAILWAY_ORIGIN"]
            ```

            Long content wraps inside the card while code remains horizontally scrollable.
            """,
            provenance: .agent, fromUser: false
        )
    }

    private func message(id: String, sender: String, content: String, type: MessageType = .text, provenance: MessageProvenance, fromUser: Bool) -> Message {
        Message(
            id: id, threadId: "synthetic-thread", senderId: fromUser ? "synthetic-user" : "synthetic-agent",
            senderName: sender, senderAvatarUrl: nil, content: content, type: type, provenance: provenance,
            embeddedCard: nil, attachments: [], isFromUser: fromUser, createdAt: fixtureDate,
            updatedAt: fixtureDate, isEdited: false, replyToId: nil
        )
    }

    private var fixtureDate: Date { Date(timeIntervalSince1970: 1_767_225_600) }
}

@MainActor
private struct RelayAgentsRootShowcase: View {
    enum Page: String, CaseIterable { case agents, structure, classification, calendar, tasks }
    let page: Page

    private var selected: AgentsManagementTab {
        switch page {
        case .agents: .agents
        case .structure: .structure
        case .classification: .classify
        case .calendar: .calendar
        case .tasks: .tasks
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: RelaySpacing.lg) {
            HStack {
                Text("Agents").font(RelayFonts.navigationTitle).foregroundStyle(RelayColors.textPrimary)
                Spacer()
                Button("Add Agent", systemImage: "plus") {}.buttonStyle(RelayButtonStyle(size: .sm, variant: .secondary))
            }
            RelayStatusStrip(title: selected.rawValue, detail: "Selected Agents mode", tone: .info, icon: selected.icon)
            HStack(spacing: RelaySpacing.sm) { modeCell(.agents); modeCell(.structure) }
            HStack(spacing: RelaySpacing.sm) { modeCell(.classify); modeCell(.calendar) }
            HStack(spacing: RelaySpacing.sm) { modeCell(.tasks); Color.clear.frame(maxWidth: .infinity, minHeight: RelayMetrics.minimumHitTarget, maxHeight: RelayMetrics.minimumHitTarget) }
            modeContent
        }
        .padding(RelaySpacing.xl)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private func modeCell(_ tab: AgentsManagementTab) -> some View {
        HStack {
            Image(systemName: tab.icon)
            Text(tab.rawValue).lineLimit(1).minimumScaleFactor(0.65)
            Spacer(minLength: 0)
        }
        .font(RelayFonts.cardTitle)
        .foregroundStyle(tab == selected ? RelayColors.accent : RelayColors.textSecondary)
        .padding(.horizontal, RelaySpacing.sm)
        .frame(maxWidth: .infinity, minHeight: RelayMetrics.minimumHitTarget)
        .background(tab == selected ? RelayColors.backgroundSelected : RelayColors.backgroundCard)
        .overlay(RoundedRectangle(cornerRadius: RelayRadius.sm).stroke(tab == selected ? RelayColors.borderFocus : RelayColors.borderStandard))
    }

    @ViewBuilder private var modeContent: some View {
        switch page {
        case .agents:
            RelaySectionHeader(title: "Agent roster", subtitle: "Placement, search, selected row, and state family")
            HStack { ForEach(AgentPlacementFilter.allCases) { p in FilterChip(title: p.rawValue, isSelected: p == .business, action: {}) } }
            RelaySearchField(text: .constant("relay"), prompt: "Search agents")
            RelayPanel {
                RelayNavRow(title: "Relay Analyst", subtitle: "Operations Analyst · OpenClaw", icon: "person.crop.circle", badge: "On duty", state: .selected)
                RelayNavRow(title: "Research Agent", subtitle: "Research · Hermes", icon: "person.crop.circle", badge: "Idle")
            }
            RelayLoadingState(message: "Loading agents").frame(height: 100)
            RelayInlineEmptyState(icon: "person.2", title: "No personal agents", subtitle: "Add an agent to this placement.")
            RelayErrorPanel(message: "Agents couldn't load from Railway. Try again.")
        case .structure:
            RelaySectionHeader(title: "Organisation structure", subtitle: "Selected hierarchy and guarded creation")
            RelayPanel {
                RelayNavRow(title: "Example Company", subtitle: "Organisation · 2 departments", icon: "building.2", state: .selected)
                RelayNavRow(title: "Operations", subtitle: "Department · 1 team", icon: "square.3.layers.3d")
                RelayNavRow(title: "Delivery Team", subtitle: "3 agents", icon: "person.3")
                RelayNavRow(title: "Create Organisation", subtitle: "Opens the creation sheet", icon: "plus")
            }
            RelayInlineEmptyState(icon: "point.3.connected.trianglepath.dotted", title: "No organisation yet", subtitle: "Create an organisation to group business agents.")
        case .classification:
            RelaySectionHeader(title: "Agent classification", subtitle: "Secondary tool with compact placement cards")
            ForEach(["Business", "Family", "Personal"], id: \.self) { title in
                RelayPanel { RelaySectionHeader(title: title, subtitle: title == "Business" ? "2 assigned · selected" : "No agents assigned") }
            }
            RelayErrorPanel(message: "Classification changes are unavailable until agents finish loading.")
        case .calendar:
            RelaySectionHeader(title: "Work Calendar", subtitle: "Schedule, availability, and empty states")
            RelayStatusStrip(title: "Today", detail: "2 agents scheduled · UTC", tone: .success, icon: "calendar")
            RelayPanel {
                RelayNavRow(title: "09:00–12:00", subtitle: "Relay Analyst · Operations", icon: "clock")
                RelayNavRow(title: "13:00–17:00", subtitle: "Research Agent · Research", icon: "clock")
            }
            RelayInlineEmptyState(icon: "calendar.badge.exclamationmark", title: "No work scheduled", subtitle: "No agent availability matches this day.")
        case .tasks:
            RelaySectionHeader(title: "Work Task Schedule", subtitle: "Status filters, task rows, and zero state")
            HStack { FilterChip(title: "All", isSelected: true, action: {}); FilterChip(title: "Running", isSelected: false, action: {}); FilterChip(title: "Blocked", isSelected: false, action: {}) }
            RelayPanel {
                RelayNavRow(title: "Review deployment", subtitle: "Relay Analyst · Running", icon: "arrow.triangle.2.circlepath", badge: "RUNNING")
                RelayNavRow(title: "Prepare handoff", subtitle: "Research Agent · Queued", icon: "clock", badge: "QUEUED")
            }
            RelayInlineEmptyState(icon: "checkmark.circle", title: "No blocked tasks", subtitle: "All scheduled work can continue.")
        }
    }
}

@MainActor
private struct RelayAuthWorkspaceShowcase: View {
    enum Page: String, CaseIterable {
        case auth, workspaceStates, workspaceRows, create

        var height: CGFloat {
            switch self {
            case .auth: 1050
            case .workspaceStates: 1150
            case .workspaceRows: 1050
            case .create: 1050
            }
        }
    }

    let page: Page

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: RelaySpacing.lg) {
                RelayBrandLockup(compact: true)
                switch page {
                case .auth: authStates
                case .workspaceStates: workspaceStates
                case .workspaceRows: workspaceRows
                case .create: createStates
                }
            }
            .padding(RelaySpacing.xl)
        }
    }

    private var authStates: some View {
        Group {
            RelaySectionHeader(title: "Secure sign in", subtitle: "Empty, loading, and error")
            RelayPanel {
                fixtureField(label: "Email", value: "", icon: "envelope", secure: false)
                fixtureField(label: "Password", value: "", icon: "lock", secure: true)
                Button("Sign In") {}.buttonStyle(RelayButtonStyle(size: .md, variant: .primary)).disabled(true).opacity(0.55)
            }
            RelayPanel {
                fixtureField(label: "Email", value: "person@example.invalid", icon: "envelope", secure: false)
                fixtureField(label: "Password", value: "••••••••", icon: "lock", secure: true)
                Button(action: {}) {
                    HStack { ProgressView().controlSize(.small); Text("Signing In") }
                        .frame(maxWidth: .infinity)
                }
                    .buttonStyle(RelayButtonStyle(size: .md, variant: .primary))
            }
            RelayErrorPanel(message: "Sign in could not be completed. Check your details and try again.")
        }
    }

    private var workspaceStates: some View {
        Group {
            RelaySectionHeader(title: "Workspace states", subtitle: "Loading, empty, and error")
            RelayPanel {
                RelayLoadingState(message: "Loading workspaces").frame(height: 120)
            }
            RelayInlineEmptyState(icon: "building.2", title: "No workspaces", subtitle: "Create a workspace to continue to Relay Console.")
            RelayErrorPanel(message: "Workspaces could not be loaded from Railway. Try again.")
            Button("Try Again") {}.buttonStyle(RelayButtonStyle(size: .md, variant: .secondary))
        }
    }

    private var workspaceRows: some View {
        Group {
            RelaySectionHeader(title: "Choose workspace", subtitle: "Current, available, and switching")
            RelayPanel {
                workspaceRow(title: "Example Operations", subtitle: "Business · 8 agents", selected: true, busy: false, badge: "3")
                workspaceRow(title: "Personal Lab", subtitle: "Personal · 2 agents", selected: false, busy: false, badge: nil)
                workspaceRow(title: "Research Group", subtitle: "Business · switching", selected: false, busy: true, badge: nil)
            }
            RelayStatusStrip(title: "Current workspace", detail: "Example Operations", tone: .info, icon: "checkmark.circle.fill")
            Button("Add Workspace", systemImage: "plus") {}.buttonStyle(RelayButtonStyle(size: .md, variant: .secondary))
        }
    }

    private var createStates: some View {
        Group {
            RelaySectionHeader(title: "Create workspace", subtitle: "Validation and type selection")
            RelayPanel {
                fixtureField(label: "Workspace Name", value: "Example Studio", icon: "building.2", secure: false)
                HStack {
                    typeCard("Business", detail: "Teams and organisations", selected: true)
                    typeCard("Personal", detail: "Your assistant space", selected: false)
                }
                RelayErrorPanel(message: "Workspace name is required.")
                Button("Create Workspace") {}.buttonStyle(RelayButtonStyle(size: .md, variant: .primary)).disabled(true).opacity(0.55)
            }
        }
    }

    private func fixtureField(label: String, value: String, icon: String, secure: Bool) -> some View {
        VStack(alignment: .leading, spacing: RelaySpacing.xs) {
            Text(label).font(RelayFonts.caption).foregroundStyle(RelayColors.textSecondary)
            HStack {
                Image(systemName: icon).foregroundStyle(RelayColors.textSecondary).frame(width: 22)
                Text(value.isEmpty ? (secure ? "••••••••" : "you@company.com") : value)
                    .font(RelayFonts.cardBody)
                    .foregroundStyle(value.isEmpty ? RelayColors.textTertiary : RelayColors.textPrimary)
                Spacer()
            }
            .padding(.horizontal, RelaySpacing.md)
            .frame(height: RelayMetrics.searchFieldHeight)
            .background(RelayColors.fieldBackground)
            .clipShape(RoundedRectangle(cornerRadius: RelayRadius.md))
            .overlay(RoundedRectangle(cornerRadius: RelayRadius.md).stroke(RelayColors.borderStandard))
        }
    }

    private func workspaceRow(title: String, subtitle: String, selected: Bool, busy: Bool, badge: String?) -> some View {
        HStack(spacing: RelaySpacing.md) {
            RelayAvatar(name: title, imageUrl: nil, size: .medium, status: nil)
            VStack(alignment: .leading) {
                Text(title).font(RelayFonts.cardTitle).foregroundStyle(RelayColors.textPrimary)
                Text(subtitle).font(RelayFonts.caption).foregroundStyle(RelayColors.textSecondary)
            }
            Spacer()
            if let badge { RelayBadge(text: badge) }
            if busy { ProgressView().controlSize(.small) }
            else { Image(systemName: selected ? "checkmark.circle.fill" : "chevron.right").foregroundStyle(selected ? RelayColors.accent : RelayColors.textTertiary) }
        }
        .padding(RelaySpacing.md)
        .frame(minHeight: WorkspaceParityContract.cardMinimumHeight)
        .background(selected ? RelayColors.backgroundSelected : RelayColors.backgroundCard)
        .overlay(alignment: .leading) { if selected { Rectangle().fill(RelayColors.accent).frame(width: 2) } }
        .accessibilityElement(children: .combine)
    }

    private func typeCard(_ title: String, detail: String, selected: Bool) -> some View {
        VStack(alignment: .leading, spacing: RelaySpacing.xs) {
            HStack { Text(title).font(RelayFonts.cardTitle); Spacer(); if selected { Image(systemName: "checkmark.circle.fill") } }
            Text(detail).font(RelayFonts.caption).foregroundStyle(RelayColors.textSecondary)
        }
        .foregroundStyle(selected ? RelayColors.accent : RelayColors.textPrimary)
        .padding(RelaySpacing.md)
        .frame(maxWidth: .infinity, minHeight: 100, alignment: .topLeading)
        .background(selected ? RelayColors.backgroundSelected : RelayColors.backgroundCard)
        .clipShape(RoundedRectangle(cornerRadius: RelayRadius.md))
        .overlay(RoundedRectangle(cornerRadius: RelayRadius.md).stroke(selected ? RelayColors.borderFocus : RelayColors.borderStandard))
    }
}

@MainActor
private struct RelayShellShowcase: View {
    enum Mode: String, CaseIterable {
        case compact, guarded, wide

        var size: CGSize {
            switch self {
            case .compact, .guarded: CGSize(width: 430, height: 1600)
            case .wide: CGSize(width: 1180, height: 900)
            }
        }
    }

    let mode: Mode

    var body: some View {
        if mode == .wide {
            wideShell
        } else {
            VStack(spacing: 0) {
                RelayCompactHeader(title: "Console", icon: "rectangle.3.group")
                ConsoleIndexContent(
                    hasWorkspace: mode == .compact,
                    workspaceName: mode == .compact ? "Example Workspace" : nil,
                    pendingApprovalCount: 3,
                    unreadAlertCount: 4
                )
                .padding(.horizontal, RelaySpacing.lg)
                Spacer(minLength: RelaySpacing.lg)
                compactTabBar
            }
        }
    }

    private var compactTabBar: some View {
        HStack {
            ForEach(MainTabView.TabItem.allCases, id: \.self) { tab in
                VStack(spacing: 3) {
                    Image(systemName: tab.icon)
                    Text(tab.title).font(RelayFonts.caption)
                }
                .foregroundStyle(tab == .agents ? RelayColors.accent : RelayColors.textSecondary)
                .frame(maxWidth: .infinity, minHeight: 60)
                .accessibilityElement(children: .combine)
            }
        }
        .background(RelayColors.backgroundSecondary)
        .overlay(alignment: .top) { Rectangle().fill(RelayColors.borderLow).frame(height: 1) }
        .padding(.bottom, RelaySpacing.sm)
    }

    private var wideShell: some View {
        HStack(spacing: 0) {
            VStack(alignment: .leading, spacing: RelaySpacing.md) {
                RelayBrandLockup(compact: true)
                    .padding(.bottom, RelaySpacing.md)
                RelaySectionHeader(title: "Workspace", subtitle: "Example Workspace")
                ForEach(MainTabView.TabItem.allCases, id: \.self) { tab in
                    RelayNavRow(
                        title: tab.title,
                        subtitle: tab == .agents ? "People, instructions, and structure" : nil,
                        icon: tab.icon,
                        badge: tab == .chat ? "5" : nil,
                        state: tab == .agents ? .selected : .normal
                    )
                }
                Spacer()
            }
            .padding(RelaySpacing.lg)
            .frame(width: 260)
            .background(RelayColors.backgroundSecondary)

            ScrollView {
                ConsoleIndexContent(
                    hasWorkspace: true,
                    workspaceName: "Example Workspace",
                    pendingApprovalCount: 3,
                    unreadAlertCount: 4,
                    selection: .applications
                )
                .padding(RelaySpacing.lg)
            }
            .frame(width: 420)
            .background(RelayColors.backgroundPrimary)

            RelayEmptyState(
                icon: "square.grid.2x2",
                iconColor: RelayColors.accent,
                title: "Applications",
                subtitle: "The selected Console destination opens in the detail stage."
            )
            .frame(maxWidth: .infinity)
            .background(RelayColors.chatCanvas)
        }
    }
}

@MainActor
private struct RelayComponentShowcase: View {
    enum Page: String, CaseIterable {
        case foundation, conversation

        var height: CGFloat { self == .foundation ? 1400 : 1800 }
    }

    let page: Page
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    private let userMessage = Message(
        id: "synthetic-user", threadId: "synthetic-thread", senderId: "synthetic-user",
        senderName: "You", senderAvatarUrl: nil,
        content: "Review the deployment plan and call out any remaining risks.",
        type: .text, provenance: .user, embeddedCard: nil, attachments: [],
        isFromUser: true, createdAt: Date(timeIntervalSince1970: 0),
        updatedAt: Date(timeIntervalSince1970: 0), isEdited: false, replyToId: nil
    )

    private let agentMessage = Message(
        id: "synthetic-agent", threadId: "synthetic-thread", senderId: "synthetic-agent",
        senderName: "Relay Agent", senderAvatarUrl: nil,
        content: "The plan is ready. One approval is required before the external action runs.",
        type: .text, provenance: .agent, embeddedCard: nil, attachments: [],
        isFromUser: false, createdAt: Date(timeIntervalSince1970: 0),
        updatedAt: Date(timeIntervalSince1970: 0), isEdited: false, replyToId: nil
    )

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: RelaySpacing.md) {
                if page == .foundation { foundationContent } else { conversationContent }
            }
            .padding(RelaySpacing.lg)
        }
        .preferredColorScheme(.dark)
    }

    @ViewBuilder
    private var foundationContent: some View {
        RelayBrandLockup(compact: true)
        RelayCompactHeader(title: "Component matrix", icon: "square.grid.2x2", actionTitle: "Add", actionIcon: "plus", action: {})
        RelaySearchField(text: .constant("provider"), prompt: "Search providers")
        RelayPanel {
            RelaySectionHeader(title: "Navigation", subtitle: "Default, selected, unavailable")
            RelayNavRow(title: "Applications", subtitle: "68 providers", icon: "square.grid.2x2", badge: "68")
            RelayNavRow(title: "Approvals", subtitle: "Needs review", icon: "checkmark.seal", badge: "3", state: .selected)
            RelayNavRow(title: "Insights", subtitle: "Not enabled", icon: "chart.bar", state: .unavailable)
        }
        compactIdentityRow
        RelayStatusStrip(title: "Runtime connected", detail: "Dispatch is ready", tone: .success, icon: "bolt.fill")
        RelayStatusStrip(title: "Approval required", detail: "Review exact payload before continuing", tone: .warning, icon: "exclamationmark.triangle.fill")
        RelayMetricTile(data: MetricTileData(label: "Pending", value: "3", subValue: "Approvals", accentColor: RelayColors.accentOrange, icon: "checkmark.seal"))
    }

    @ViewBuilder
    private var conversationContent: some View {
        RelaySectionHeader(title: "Conversation and states", subtitle: "Messages, composer, loading, error, empty")
        RelayMessageCard(message: userMessage)
        RelayMessageCard(message: agentMessage)
        RelayComposer(text: .constant("Ready to send"), onSend: {}, onAttach: {}, isBusy: false)
        RelayComposer(text: .constant(""), onSend: {}, onAttach: {}, disabledReason: "Archived threads are read-only")
        RelayErrorPanel(message: "The connection could not be refreshed. Try again.")
        RelayLoadingState(message: "Loading workspace").frame(height: 70)
        RelayInlineEmptyState(icon: "tray", title: "No approvals", subtitle: "New requests will appear here.")
    }

    @ViewBuilder
    private var compactIdentityRow: some View {
        if dynamicTypeSize.isAccessibilitySize {
            VStack(alignment: .leading, spacing: RelaySpacing.sm) {
                HStack {
                    RelayIconButton(icon: "plus", label: "Add", action: {})
                    RelayIconButton(icon: "line.3.horizontal.decrease", label: "Filter", isSelected: true, action: {})
                    RelayAvatar(name: "Relay Agent", imageUrl: nil, size: .medium, status: .onDuty)
                }
                RelayBadge(text: "Connected", color: RelayColors.accentGreen, icon: "checkmark.circle.fill")
            }
        } else {
            HStack {
                RelayIconButton(icon: "plus", label: "Add", action: {})
                RelayIconButton(icon: "line.3.horizontal.decrease", label: "Filter", isSelected: true, action: {})
                RelayBadge(text: "Connected", color: RelayColors.accentGreen, icon: "checkmark.circle.fill")
                RelayAvatar(name: "Relay Agent", imageUrl: nil, size: .medium, status: .onDuty)
            }
        }
    }
}

// MARK: - Thread Mock Helpers

private extension ClawChat.Thread {
    static func mockDirect(isPinned: Bool) -> ClawChat.Thread {
        ClawChat.Thread(
            id: UUID().uuidString,
            title: "Test Thread",
            type: .direct,
            workspaceId: "ws-1",
            avatarUrl: nil,
            lastMessage: nil,
            unreadCount: 0,
            isPinned: isPinned,
            isMuted: false,
            participantIds: [],
            createdAt: Date(),
            updatedAt: Date(),
            teamId: nil,
            departmentId: nil,
            agentIds: [],
            status: .active
        )
    }
}
