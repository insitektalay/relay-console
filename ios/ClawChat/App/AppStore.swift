// AppStore.swift
// ClawChat – Central application state
// Swift 6, ObservableObject, @MainActor

import Foundation
import Combine
import UIKit
import SwiftData

@MainActor
final class AppStore: ObservableObject {
    private enum WorkspaceDefaults {
        static let lastSelectedWorkspaceId = "relayconsole.lastSelectedWorkspaceId"
        static let legacyLastSelectedWorkspaceId = "clawchat.lastSelectedWorkspaceId"

        static func load() -> String? {
            if let workspaceId = UserDefaults.standard.string(forKey: lastSelectedWorkspaceId) {
                return workspaceId
            }
            guard let legacyWorkspaceId = UserDefaults.standard.string(forKey: legacyLastSelectedWorkspaceId) else {
                return nil
            }
            UserDefaults.standard.set(legacyWorkspaceId, forKey: lastSelectedWorkspaceId)
            UserDefaults.standard.removeObject(forKey: legacyLastSelectedWorkspaceId)
            return legacyWorkspaceId
        }

        static func save(_ workspaceId: String) {
            UserDefaults.standard.set(workspaceId, forKey: lastSelectedWorkspaceId)
            UserDefaults.standard.removeObject(forKey: legacyLastSelectedWorkspaceId)
        }

        static func clear() {
            UserDefaults.standard.removeObject(forKey: lastSelectedWorkspaceId)
            UserDefaults.standard.removeObject(forKey: legacyLastSelectedWorkspaceId)
        }
    }

    // MARK: - Auth State

    @Published var currentUser: User?
    @Published var isAuthenticated: Bool = false
    @Published var authError: String?

    // MARK: - Workspace State

    @Published var workspaces: [Workspace] = []
    @Published var selectedWorkspace: Workspace?
    @Published var isLoadingWorkspaces: Bool = false
    @Published var workspaceError: String?

    // MARK: - Active Data

    @Published var threads: [Thread] = []
    @Published var agents: [Agent] = []
    @Published private(set) var threadMessageSenderIds: [String: [String]] = [:]
    @Published private(set) var threadMessagePreviews: [String: MessagePreview] = [:]
    @Published private(set) var threadMessageAgentPreviews: [String: MessageSenderPreview] = [:]
    @Published private(set) var messagePrefetchedThreads: Set<String> = []
    @Published var teams: [Team] = []
    @Published var departments: [Department] = []
    @Published var companies: [Company] = []
    @Published var tasks: [Task] = []
    @Published var pendingApprovals: [Approval] = []
    @Published var openIncidents: [Incident] = []
    @Published var unreadAlertCount: Int = 0
    @Published var isLoadingThreads: Bool = false
    @Published var hasLoadedThreads: Bool = false
    @Published var threadLoadError: String?
    @Published var isLoadingAgents: Bool = false
    @Published var hasLoadedAgents: Bool = false
    @Published var agentLoadError: String?

    // MARK: - Streaming

    @Published var streamingContent: [String: String] = [:]   // threadId → in-progress streamed text
    @Published var streamingTool: [String: String] = [:]   // threadId → active tool name
    @Published var runtimeTodoTasks: [String: [RuntimeTodoTask]] = [:]
    @Published var runtimeToolActivity: [String: [RuntimeToolActivity]] = [:]

    // MARK: - Services

    private let apiClient: APIClient
    private let wsClient: WebSocketClient
    private var cacheContext: ModelContext?
    private var wsUnsubscribe: (() -> Void)?
    private var workspaceSyncTask: _Concurrency.Task<Void, Never>?
    private var websocketConnectTask: _Concurrency.Task<Void, Never>?
    private var websocketTicketWorkspaceId: String?
    private var messagePrefetchInFlight: Set<String> = []
    private var cancellables = Set<AnyCancellable>()

    // MARK: - Init

    init(apiClient: APIClient, wsClient: WebSocketClient) {
        self.apiClient = apiClient
        self.wsClient  = wsClient
        NotificationCenter.default.publisher(for: .relayConsoleUnauthorized)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] notification in
                guard let self else { return }
                let endpoint = notification.userInfo?["endpoint"] as? String
                let reason = notification.userInfo?["reason"] as? String
                self.handleUnauthorizedSession(endpoint: endpoint, reason: reason)
            }
            .store(in: &cancellables)
        NotificationCenter.default.publisher(for: UIApplication.willEnterForegroundNotification)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in
                guard let self, self.isAuthenticated, let workspaceId = self.selectedWorkspace?.id else { return }
                _Concurrency.Task { [weak self] in
                    try? await self?.syncAgents(workspaceId: workspaceId)
                    try? await self?.syncThreads(workspaceId: workspaceId)
                }
            }
            .store(in: &cancellables)
    }

    convenience init() {
        self.init(apiClient: .shared, wsClient: .shared)
#if DEBUG
        if ProcessInfo.processInfo.arguments.contains("--relay-ui-testing-reset-auth") {
            apiClient.clearTokens()
            WorkspaceDefaults.clear()
            Telemetry.savePrivacyPreferences(
                productAnalytics: false,
                crashReports: false
            )
        }
#endif
    }

    func configureCache(_ context: ModelContext) {
        cacheContext = context
        if let workspaceId = selectedWorkspace?.id {
            hydrateCachedWorkspaceData(workspaceId: workspaceId)
        }
    }

    // MARK: - Auth

    func login(email: String, password: String) async throws {
        authError = nil
        do {
            let identity = mobileSessionIdentity()
            let tokens: AuthTokens = try await apiClient.request(
                .login(
                    email: email,
                    password: password,
                    deviceName: identity.deviceName,
                    platform: identity.platform
                )
            )
            apiClient.setTokens(tokens)
            let user: User = try await apiClient.request(.me)
            await bootstrapAuthenticatedSession(user: user)
            Telemetry.shared.event("auth.login.succeeded", attributes: ["userId": user.id])
        } catch {
            authError = (error as? APIError)?.errorDescription ?? error.localizedDescription
            Telemetry.shared.capture(error: error, attributes: ["operation": "auth.login"])
            throw error
        }
    }

    func register(name: String, email: String, password: String, inviteCode: String) async throws {
        authError = nil
        do {
            let identity = mobileSessionIdentity()
            let tokens: AuthTokens = try await apiClient.request(
                .register(
                    name: name,
                    email: email,
                    password: password,
                    inviteCode: inviteCode,
                    deviceName: identity.deviceName,
                    platform: identity.platform
                )
            )
            apiClient.setTokens(tokens)
            let user: User = try await apiClient.request(.me)
            await bootstrapAuthenticatedSession(user: user)
            Telemetry.shared.event("auth.register.succeeded", attributes: ["userId": user.id])
        } catch {
            authError = (error as? APIError)?.errorDescription ?? error.localizedDescription
            Telemetry.shared.capture(error: error, attributes: ["operation": "auth.register"])
            throw error
        }
    }

    private func mobileSessionIdentity() -> (deviceName: String, platform: String) {
        if UIDevice.current.userInterfaceIdiom == .pad {
            return ("iPad", "iPadOS")
        }
        return ("iPhone", "iOS")
    }

    func logout() {
        Telemetry.shared.event("auth.logout")
        apiClient.endCurrentSession()
        clearAuthenticatedState(clearTokens: false)
    }

    func applySavedCloudConnection() {
        clearAuthenticatedState(clearTokens: true)
        apiClient.applySavedCloudConnection()
        wsClient.disconnect()
        authError = "Relay service connected. Sign in to this deployment."
    }

    private func handleUnauthorizedSession(endpoint: String?, reason: String?) {
        guard isAuthenticated || currentUser != nil || selectedWorkspace != nil else { return }
        Telemetry.shared.capture(
            message: "Mobile session expired",
            level: .warning,
            attributes: [
                "endpoint": endpoint ?? "",
                "reason": reason ?? ""
            ]
        )
        authError = "Your session expired. Please log in again."
        clearAuthenticatedState(clearTokens: false)
    }

    private func clearAuthenticatedState(clearTokens shouldClearTokens: Bool) {
        workspaceSyncTask?.cancel()
        workspaceSyncTask = nil
        websocketConnectTask?.cancel()
        websocketConnectTask = nil
        wsUnsubscribe?()
        wsUnsubscribe = nil
        wsClient.disconnect()
        if shouldClearTokens {
            apiClient.clearTokens()
        }
        websocketTicketWorkspaceId = nil
        messagePrefetchInFlight.removeAll()
        messagePrefetchedThreads.removeAll()
        WorkspaceDefaults.clear()
        currentUser = nil
        Telemetry.shared.setUser(id: nil)
        Telemetry.shared.setWorkspace(nil)
        isAuthenticated = false
        workspaces = []
        selectedWorkspace = nil
        threads = []
        agents = []
        threadMessageSenderIds = [:]
        threadMessagePreviews = [:]
        threadMessageAgentPreviews = [:]
        teams = []
        departments = []
        companies = []
        tasks = []
        pendingApprovals = []
        openIncidents = []
        unreadAlertCount = 0
        isLoadingThreads = false
        hasLoadedThreads = false
        threadLoadError = nil
        isLoadingAgents = false
        hasLoadedAgents = false
        agentLoadError = nil
        streamingContent = [:]
        streamingTool = [:]
        runtimeTodoTasks = [:]
        runtimeToolActivity = [:]
    }

    @discardableResult
    func restoreSession() async throws -> Bool {
        guard apiClient.authTokens != nil else { return false }
        do {
            let user: User = try await apiClient.request(.me)
            await bootstrapAuthenticatedSession(user: user)
            Telemetry.shared.event("auth.session.restored", attributes: ["userId": user.id])
            return true
        } catch {
            Telemetry.shared.capture(error: error, attributes: ["operation": "auth.restore_session"])
            logout()
            throw error
        }
    }

    // MARK: - Workspace

    func loadWorkspaces() async {
        isLoadingWorkspaces = true
        workspaceError = nil
        defer { isLoadingWorkspaces = false }
        do {
            let response: PaginatedResponse<Workspace> = try await apiClient.requestPaginated(.workspaces)
            workspaces = response.data
            cacheWorkspaces(response.data)
            restorePreferredWorkspaceIfNeeded()
        } catch {
            workspaceError = (error as? APIError)?.errorDescription ?? error.localizedDescription
            Telemetry.shared.capture(error: error, attributes: ["operation": "workspaces.load"])
        }
    }

    @discardableResult
    func createWorkspace(name: String, type: WorkspaceType) async throws -> Workspace {
        workspaceError = nil
        let workspace: Workspace = try await apiClient.request(
            .createWorkspace(name: name, type: type.rawValue)
        )
        await loadWorkspaces()
        if let refreshed = workspaces.first(where: { $0.id == workspace.id }) {
            selectWorkspace(refreshed)
            return refreshed
        }
        workspaces.insert(workspace, at: 0)
        selectWorkspace(workspace)
        return workspace
    }

    func selectWorkspace(_ workspace: Workspace) {
        let previousWorkspaceId = selectedWorkspace?.id
        selectedWorkspace = workspace
        Telemetry.shared.setWorkspace(workspace.id)
        Telemetry.shared.event(
            "workspace.selected",
            attributes: ["workspaceId": workspace.id, "previousWorkspaceId": previousWorkspaceId ?? ""]
        )
        WorkspaceDefaults.save(workspace.id)
        workspaceError = nil
        resetWorkspaceLoadState()
        hydrateCachedWorkspaceData(workspaceId: workspace.id)
        teams = []
        departments = []
        companies = []
        tasks = []
        pendingApprovals = []
        openIncidents = []
        unreadAlertCount = 0
        streamingContent = [:]
        streamingTool = [:]
        runtimeTodoTasks = [:]
        runtimeToolActivity = [:]
        messagePrefetchInFlight.removeAll()
        messagePrefetchedThreads.removeAll()
        if isAuthenticated {
            connectWebSocket()
        }
        workspaceSyncTask?.cancel()
        let workspaceId = workspace.id
        workspaceSyncTask = _Concurrency.Task { [weak self] in
            await self?.syncSelectedWorkspace(workspaceId: workspaceId)
        }
    }

    func restorePreferredWorkspaceIfNeeded() {
        guard selectedWorkspace == nil, !workspaces.isEmpty else { return }

        let savedId = WorkspaceDefaults.load()
        if let savedId,
           let savedWorkspace = workspaces.first(where: { $0.id == savedId }) {
            selectWorkspace(savedWorkspace)
            return
        }

        selectWorkspace(workspaces[0])
    }

    func ensureWorkspaceReady() async {
        if workspaces.isEmpty && !isLoadingWorkspaces {
            await loadWorkspaces()
        } else {
            restorePreferredWorkspaceIfNeeded()
            if isAuthenticated, selectedWorkspace != nil {
                connectWebSocket()
            }
        }
    }

    private func syncSelectedWorkspace(workspaceId: String) async {
        Telemetry.shared.breadcrumb("Workspace sync started", category: "workspace.sync", attributes: ["workspaceId": workspaceId])
        async let t: () = syncThreadsIgnoringErrors(workspaceId: workspaceId)
        async let a: () = syncAgentsIgnoringErrors(workspaceId: workspaceId)
        async let tm: () = syncTeamsIgnoringErrors(workspaceId: workspaceId)
        async let d: () = syncDepartmentsIgnoringErrors(workspaceId: workspaceId)
        async let c: () = syncCompaniesIgnoringErrors(workspaceId: workspaceId)
        async let p: () = syncPendingApprovalsIgnoringErrors(workspaceId: workspaceId)
        async let al: () = syncAlertsIgnoringErrors(workspaceId: workspaceId)
        async let tk: () = syncTasksIgnoringErrors(workspaceId: workspaceId)
        async let inc: () = syncOpenIncidentsIgnoringErrors(workspaceId: workspaceId)
        _ = await (t, a, tm, d, c, p, al, tk, inc)
        guard !_Concurrency.Task.isCancelled, selectedWorkspace?.id == workspaceId else {
            Telemetry.shared.breadcrumb("Discarded stale workspace sync", category: "workspace.sync", level: .warning, attributes: ["workspaceId": workspaceId])
            return
        }
        Telemetry.shared.breadcrumb("Workspace sync finished", category: "workspace.sync", attributes: ["workspaceId": workspaceId])
    }

    private func syncThreadsIgnoringErrors(workspaceId: String) async { do { try await syncThreads(workspaceId: workspaceId) } catch { recordBackgroundSyncError(error, operation: "threads.sync", workspaceId: workspaceId) } }
    private func syncAgentsIgnoringErrors(workspaceId: String) async { do { try await syncAgents(workspaceId: workspaceId) } catch { recordBackgroundSyncError(error, operation: "agents.sync", workspaceId: workspaceId) } }
    private func syncTeamsIgnoringErrors(workspaceId: String) async { do { try await syncTeams(workspaceId: workspaceId) } catch { recordBackgroundSyncError(error, operation: "teams.sync", workspaceId: workspaceId) } }
    private func syncDepartmentsIgnoringErrors(workspaceId: String) async { do { try await syncDepartments(workspaceId: workspaceId) } catch { recordBackgroundSyncError(error, operation: "departments.sync", workspaceId: workspaceId) } }
    private func syncCompaniesIgnoringErrors(workspaceId: String) async { do { try await syncCompanies(workspaceId: workspaceId) } catch { recordBackgroundSyncError(error, operation: "companies.sync", workspaceId: workspaceId) } }
    private func syncPendingApprovalsIgnoringErrors(workspaceId: String) async { do { try await syncPendingApprovals(workspaceId: workspaceId) } catch { recordBackgroundSyncError(error, operation: "approvals.sync", workspaceId: workspaceId) } }
    private func syncAlertsIgnoringErrors(workspaceId: String) async { do { try await syncAlerts(workspaceId: workspaceId) } catch { recordBackgroundSyncError(error, operation: "alerts.sync", workspaceId: workspaceId) } }
    private func syncTasksIgnoringErrors(workspaceId: String) async { do { try await syncTasks(workspaceId: workspaceId) } catch { recordBackgroundSyncError(error, operation: "tasks.sync", workspaceId: workspaceId) } }
    private func syncOpenIncidentsIgnoringErrors(workspaceId: String) async { do { try await syncOpenIncidents(workspaceId: workspaceId) } catch { recordBackgroundSyncError(error, operation: "incidents.sync", workspaceId: workspaceId) } }

    private func recordBackgroundSyncError(_ error: any Error, operation: String, workspaceId: String) {
        if APIClient.isExpectedCancellation(error) {
            Telemetry.shared.breadcrumb("Background sync cancelled", category: "workspace.sync", attributes: ["operation": operation, "workspaceId": workspaceId])
            return
        }
        if case APIError.unauthorized = error {
            Telemetry.shared.breadcrumb("Background sync unauthorized", category: "workspace.sync", level: .warning, attributes: ["operation": operation, "workspaceId": workspaceId])
            return
        }
        if case APIError.notFound = error {
            Telemetry.shared.breadcrumb("Background sync endpoint unavailable", category: "workspace.sync", level: .warning, attributes: ["operation": operation, "workspaceId": workspaceId])
            return
        }
        Telemetry.shared.capture(error: error, attributes: ["operation": operation, "workspaceId": workspaceId])
    }

    func syncOpenIncidents(workspaceId: String? = nil) async throws {
        guard let wsId = workspaceId ?? selectedWorkspace?.id else { return }
        let response: PaginatedResponse<Incident> = try await apiClient.requestPaginated(
            .incidents(workspaceId: wsId, page: 1, status: IncidentStatus.open.rawValue, severity: nil)
        )
        guard selectedWorkspace?.id == wsId else { return }
        openIncidents = response.data
    }

    func syncTasks(workspaceId: String? = nil) async throws {
        guard let wsId = workspaceId ?? selectedWorkspace?.id else { return }
        let response: PaginatedResponse<Task> = try await apiClient.requestPaginated(
            .tasks(workspaceId: wsId, page: 1, status: nil, agentId: nil, teamId: nil)
        )
        guard selectedWorkspace?.id == wsId else { return }
        tasks = response.data
    }

    private func bootstrapAuthenticatedSession(user: User) async {
        currentUser = user
        Telemetry.shared.setUser(id: user.id, email: user.email, name: user.name)
        isAuthenticated = true
    }

    // MARK: - Search

    struct SearchResults {
        var threads: [Thread] = []
        var messages: [MessageSearchResult] = []
        var agents: [Agent] = []
    }

    func search(query: String, workspaceId: String) async throws -> SearchResults {
        // Placeholder: filter local data
        let matchedThreads = threads.filter { $0.title.localizedCaseInsensitiveContains(query) }
        let matchedAgents = agents.filter {
            $0.name.localizedCaseInsensitiveContains(query) ||
            $0.role.localizedCaseInsensitiveContains(query)
        }
        return SearchResults(threads: matchedThreads, messages: [], agents: matchedAgents)
    }

    // MARK: - Sync

    func syncThreads(workspaceId: String? = nil) async throws {
        guard let wsId = workspaceId ?? selectedWorkspace?.id else { return }
        isLoadingThreads = true
        threadLoadError = nil
        defer { isLoadingThreads = false }
        do {
            let response: PaginatedResponse<Thread> = try await apiClient.requestPaginated(
                .threads(workspaceId: wsId, page: 1, pageSize: 50)
            )
            guard selectedWorkspace?.id == wsId else { return }
            let visibleThreads = response.data.filter { $0.type != .agentToAgent }
            threads = visibleThreads
            hasLoadedThreads = true
            cacheThreads(visibleThreads, workspaceId: wsId)
            _Concurrency.Task { await prefetchLatestMessagesForRecentThreads(visibleThreads, workspaceId: wsId) }
        } catch {
            threadLoadError = (error as? APIError)?.errorDescription ?? error.localizedDescription
            throw error
        }
    }

    func prefetchLatestMessagesForRecentThreads(_ sourceThreads: [Thread]? = nil, workspaceId: String? = nil) async {
        guard let wsId = workspaceId ?? selectedWorkspace?.id else { return }
        let candidates = (sourceThreads ?? threads)
            .filter { $0.workspaceId == wsId }
            .sorted { ($0.lastMessage?.timestamp ?? $0.updatedAt) > ($1.lastMessage?.timestamp ?? $1.updatedAt) }
            .prefix(12)

        for thread in candidates {
            await prefetchLatestMessages(thread: thread, workspaceId: wsId)
        }
    }

    private func prefetchLatestMessages(thread: Thread, workspaceId: String) async {
        guard selectedWorkspace?.id == workspaceId else { return }
        guard !messagePrefetchInFlight.contains(thread.id), !messagePrefetchedThreads.contains(thread.id) else { return }
        hydrateMessageSendersFromCache(threadId: thread.id)
        if hasCachedMessages(threadId: thread.id, minimumCount: 10) {
            messagePrefetchedThreads.insert(thread.id)
            return
        }

        messagePrefetchInFlight.insert(thread.id)
        let startedAt = Date()
        Telemetry.shared.breadcrumb(
            "Thread message prefetch started",
            category: "thread.prefetch",
            attributes: ["threadId": thread.id, "workspaceId": workspaceId]
        )
        defer { messagePrefetchInFlight.remove(thread.id) }

        do {
            let messages = try await fetchLatestMessagesForPrefetch(threadId: thread.id, limit: 30)
            guard selectedWorkspace?.id == workspaceId else { return }
            cacheMessages(messages.filter { $0.threadId == thread.id })
            messagePrefetchedThreads.insert(thread.id)
            Telemetry.shared.breadcrumb(
                "Thread message prefetch finished",
                category: "thread.prefetch",
                attributes: [
                    "threadId": thread.id,
                    "count": messages.count,
                    "durationMs": Int(Date().timeIntervalSince(startedAt) * 1_000)
                ]
            )
        } catch {
            recordBackgroundSyncError(error, operation: "messages.prefetch", workspaceId: workspaceId)
        }
    }

    private func fetchLatestMessagesForPrefetch(threadId: String, limit: Int) async throws -> [Message] {
        do {
            return try await apiClient.request(
                .latestThreadMessages(threadId: threadId, limit: limit, before: nil)
            )
        } catch APIError.notFound {
            Telemetry.shared.breadcrumb(
                "Latest message endpoint unavailable for prefetch, falling back",
                category: "thread.prefetch",
                level: .warning,
                attributes: ["threadId": threadId]
            )
            let fallback: PaginatedResponse<Message> = try await apiClient.requestPaginated(
                .threadMessages(threadId: threadId, page: 1, pageSize: limit, before: nil)
            )
            return fallback.data
        }
    }

    func syncAgents(workspaceId: String? = nil) async throws {
        guard let wsId = workspaceId ?? selectedWorkspace?.id else { return }
        isLoadingAgents = true
        agentLoadError = nil
        defer { isLoadingAgents = false }
        do {
            var page = 1
            var loaded: [Agent] = []
            var hasMore = true
            while hasMore {
                let response: PaginatedResponse<Agent> = try await apiClient.requestPaginated(
                    .agents(workspaceId: wsId, page: page, pageSize: 100, teamId: nil, status: nil)
                )
                loaded.append(contentsOf: response.data.filter(\.isActiveSurfaceEligible))
                hasMore = response.hasMore
                page += 1
            }
            guard selectedWorkspace?.id == wsId else { return }
            agents = loaded
            hasLoadedAgents = true
            cacheAgents(loaded, workspaceId: wsId)
        } catch {
            agentLoadError = (error as? APIError)?.errorDescription ?? error.localizedDescription
            throw error
        }
    }

    func upsertAgent(_ agent: Agent) {
        if let idx = agents.firstIndex(where: { $0.id == agent.id }) {
            agents[idx] = agent
        } else {
            agents.insert(agent, at: 0)
        }
        if let wsId = selectedWorkspace?.id, wsId == agent.workspaceId {
            cacheAgents(agents, workspaceId: wsId)
        }
    }

    private func resetWorkspaceLoadState() {
        isLoadingThreads = false
        hasLoadedThreads = false
        threadLoadError = nil
        isLoadingAgents = false
        hasLoadedAgents = false
        agentLoadError = nil
        threads = []
        agents = []
        threadMessageSenderIds = [:]
        threadMessagePreviews = [:]
        threadMessageAgentPreviews = [:]
    }

    @discardableResult
    private func hydrateCachedWorkspaceData(workspaceId: String) -> Bool {
        let didLoadThreads = hydrateCachedThreads(workspaceId: workspaceId)
        let didLoadAgents = hydrateCachedAgents(workspaceId: workspaceId)
        return didLoadThreads || didLoadAgents
    }

    @discardableResult
    private func hydrateCachedThreads(workspaceId: String) -> Bool {
        guard let cacheContext else { return false }
        do {
            let descriptor = FetchDescriptor<CachedThread>(
                predicate: #Predicate { $0.workspaceId == workspaceId },
                sortBy: [SortDescriptor(\.lastMessageAt, order: .reverse)]
            )
            let cached = try cacheContext.fetch(descriptor)
            let decoded = cached.compactMap { $0.toThread() }.filter {
                $0.workspaceId == workspaceId && $0.type != .agentToAgent
            }
            guard !decoded.isEmpty else { return false }
            threads = decoded.sorted {
                ($0.lastMessage?.timestamp ?? $0.updatedAt) > ($1.lastMessage?.timestamp ?? $1.updatedAt)
            }
            hasLoadedThreads = true
            return true
        } catch {
            Telemetry.shared.capture(error: error, attributes: ["operation": "cache.threads.hydrate", "workspaceId": workspaceId])
            return false
        }
    }

    @discardableResult
    private func hydrateCachedAgents(workspaceId: String) -> Bool {
        guard let cacheContext else { return false }
        do {
            let descriptor = FetchDescriptor<CachedAgent>(
                predicate: #Predicate { $0.workspaceId == workspaceId },
                sortBy: [SortDescriptor(\.name)]
            )
            let cached = try cacheContext.fetch(descriptor)
            let decoded = cached.compactMap { $0.toAgent() }.filter {
                $0.workspaceId == workspaceId && $0.isActiveSurfaceEligible
            }
            guard !decoded.isEmpty else { return false }
            agents = decoded.sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
            hasLoadedAgents = true
            return true
        } catch {
            Telemetry.shared.capture(error: error, attributes: ["operation": "cache.agents.hydrate", "workspaceId": workspaceId])
            return false
        }
    }

    private func cacheWorkspaces(_ workspaces: [Workspace]) {
        guard let cacheContext else { return }
        do {
            for workspace in workspaces {
                if let existing = try cacheContext.fetch(FetchDescriptor<CachedWorkspace>(
                    predicate: #Predicate { $0.id == workspace.id }
                )).first {
                    existing.update(from: workspace)
                } else {
                    cacheContext.insert(CachedWorkspace(from: workspace))
                }
            }
            try cacheContext.save()
        } catch {
            Telemetry.shared.capture(error: error, attributes: ["operation": "cache.workspaces.save"])
        }
    }

    private func cacheThreads(_ threads: [Thread], workspaceId: String) {
        guard let cacheContext else { return }
        do {
            let existing = try cacheContext.fetch(FetchDescriptor<CachedThread>(
                predicate: #Predicate { $0.workspaceId == workspaceId }
            ))
            var byId = Dictionary(uniqueKeysWithValues: existing.map { ($0.id, $0) })

            for thread in threads where thread.workspaceId == workspaceId {
                if let cached = byId[thread.id] {
                    cached.update(from: thread)
                } else {
                    cacheContext.insert(CachedThread(from: thread))
                }
                byId.removeValue(forKey: thread.id)
            }

            try cacheContext.save()
        } catch {
            Telemetry.shared.capture(error: error, attributes: ["operation": "cache.threads.save", "workspaceId": workspaceId])
        }
    }

    private func hasCachedMessages(threadId: String, minimumCount: Int) -> Bool {
        guard let cacheContext else { return false }
        do {
            var descriptor = FetchDescriptor<CachedMessage>(
                predicate: #Predicate { $0.threadId == threadId },
                sortBy: [SortDescriptor(\.createdAt, order: .reverse)]
            )
            descriptor.fetchLimit = minimumCount
            return try cacheContext.fetch(descriptor).count >= minimumCount
        } catch {
            Telemetry.shared.breadcrumb("Cached message check failed", category: "thread.prefetch", level: .warning, attributes: ["threadId": threadId])
            return false
        }
    }

    private func cacheMessages(_ messages: [Message]) {
        recordThreadMessageParticipants(messages)
        guard let cacheContext, !messages.isEmpty else { return }
        do {
            for message in messages {
                if let existing = try cacheContext.fetch(FetchDescriptor<CachedMessage>(
                    predicate: #Predicate { $0.id == message.id }
                )).first {
                    existing.update(from: message)
                } else {
                    cacheContext.insert(CachedMessage(from: message))
                }
            }
            try cacheContext.save()
        } catch {
            Telemetry.shared.capture(error: error, attributes: ["operation": "cache.messages.save", "count": messages.count])
        }
    }

    func recordThreadMessageParticipants(_ messages: [Message]) {
        let grouped = Dictionary(grouping: messages, by: \.threadId)
        guard !grouped.isEmpty else { return }

        var updated = threadMessageSenderIds
        var updatedPreviews = threadMessagePreviews
        var updatedAgentPreviews = threadMessageAgentPreviews
        for (threadId, threadMessages) in grouped {
            let orderedMessages = threadMessages.sorted {
                if $0.createdAt == $1.createdAt { return $0.id > $1.id }
                return $0.createdAt > $1.createdAt
            }
            var seen = Set<String>()
            let candidateSenderIds = orderedMessages.map(\.senderId) + (updated[threadId] ?? [])

            updated[threadId] = candidateSenderIds.filter {
                !$0.isEmpty && seen.insert($0).inserted
            }

            if let latest = orderedMessages.first,
               (updatedPreviews[threadId]?.timestamp ?? .distantPast) <= latest.createdAt {
                updatedPreviews[threadId] = MessagePreview(
                    content: latest.content,
                    senderId: latest.senderId,
                    senderName: latest.senderName,
                    timestamp: latest.createdAt
                )
            }

            if let latestAgentMessage = orderedMessages.first(where: { !$0.isFromUser }) {
                let existing = updatedAgentPreviews[threadId]
                updatedAgentPreviews[threadId] = MessageSenderPreview(
                    id: latestAgentMessage.senderId,
                    name: latestAgentMessage.senderName,
                    avatarUrl: latestAgentMessage.senderAvatarUrl ?? existing?.avatarUrl
                )
            }
        }
        threadMessageSenderIds = updated
        threadMessagePreviews = updatedPreviews
        threadMessageAgentPreviews = updatedAgentPreviews
    }

    func shouldDisplayThread(_ thread: Thread) -> Bool {
        guard thread.type == .direct,
              messagePrefetchedThreads.contains(thread.id),
              thread.lastMessage == nil,
              threadMessagePreviews[thread.id] == nil else {
            return true
        }

        let knownAgent = ThreadAvatarResolver.directAgent(
            thread: thread,
            agents: agents,
            messageSenderIds: threadMessageSenderIds[thread.id] ?? []
        )
        return knownAgent != nil || threadMessageAgentPreviews[thread.id] != nil
    }

    private func hydrateMessageSendersFromCache(threadId: String) {
        guard let cacheContext else { return }
        do {
            var descriptor = FetchDescriptor<CachedMessage>(
                predicate: #Predicate { $0.threadId == threadId },
                sortBy: [SortDescriptor(\.createdAt, order: .reverse)]
            )
            descriptor.fetchLimit = 30
            let messages = try cacheContext.fetch(descriptor).compactMap { $0.toMessage() }
            recordThreadMessageParticipants(messages)
        } catch {
            Telemetry.shared.breadcrumb(
                "Cached message participant hydration failed",
                category: "thread.prefetch",
                level: .warning,
                attributes: ["threadId": threadId]
            )
        }
    }

    private func cacheAgents(_ agents: [Agent], workspaceId: String) {
        guard let cacheContext else { return }
        do {
            let existing = try cacheContext.fetch(FetchDescriptor<CachedAgent>(
                predicate: #Predicate { $0.workspaceId == workspaceId }
            ))
            var byId = Dictionary(uniqueKeysWithValues: existing.map { ($0.id, $0) })
            let currentIds = Set(agents.map(\.id))

            for agent in agents where agent.workspaceId == workspaceId {
                if let cached = byId[agent.id] {
                    cached.update(from: agent)
                } else {
                    cacheContext.insert(CachedAgent(from: agent))
                }
                byId.removeValue(forKey: agent.id)
            }

            for stale in existing where !currentIds.contains(stale.id) {
                cacheContext.delete(stale)
            }
            try cacheContext.save()
        } catch {
            Telemetry.shared.capture(error: error, attributes: ["operation": "cache.agents.save", "workspaceId": workspaceId])
        }
    }

    func syncTeams(workspaceId: String? = nil) async throws {
        guard let wsId = workspaceId ?? selectedWorkspace?.id else { return }
        let result: [Team] = try await apiClient.request(.teams(workspaceId: wsId))
        guard selectedWorkspace?.id == wsId else { return }
        teams = result
    }

    func syncDepartments(workspaceId: String? = nil) async throws {
        guard let wsId = workspaceId ?? selectedWorkspace?.id else { return }
        let result: [Department] = try await apiClient.request(.departments(workspaceId: wsId))
        guard selectedWorkspace?.id == wsId else { return }
        departments = result
    }

    func syncCompanies(workspaceId: String? = nil) async throws {
        guard let wsId = workspaceId ?? selectedWorkspace?.id else { return }
        let result: [Company] = try await apiClient.request(.companies(workspaceId: wsId))
        guard selectedWorkspace?.id == wsId else { return }
        companies = result
    }

    func syncPendingApprovals(workspaceId: String? = nil) async throws {
        guard let wsId = workspaceId ?? selectedWorkspace?.id else { return }
        let response: PaginatedResponse<Approval> = try await apiClient.requestPaginated(
            .approvals(workspaceId: wsId, page: 1, status: ApprovalStatus.pending.rawValue)
        )
        guard selectedWorkspace?.id == wsId else { return }
        pendingApprovals = response.data
    }

    func syncAlerts(workspaceId: String? = nil) async throws {
        guard let wsId = workspaceId ?? selectedWorkspace?.id else { return }
        let response: PaginatedResponse<Alert> = try await apiClient.requestPaginated(
            .alerts(workspaceId: wsId, page: 1, unreadOnly: true)
        )
        guard selectedWorkspace?.id == wsId else { return }
        unreadAlertCount = response.total
    }

    // MARK: - WebSocket

    func connectWebSocket() {
        guard apiClient.authTokens != nil, let wsId = selectedWorkspace?.id else { return }

        if websocketTicketWorkspaceId == wsId, websocketConnectTask != nil {
            Telemetry.shared.breadcrumb(
                "Skipped duplicate websocket ticket request",
                category: "ws.auth",
                attributes: ["workspaceId": wsId]
            )
            return
        }

        if wsClient.isConnected {
            Telemetry.shared.breadcrumb(
                "Skipped websocket ticket request because socket is connected",
                category: "ws.auth",
                attributes: ["workspaceId": wsId]
            )
            return
        }

        websocketConnectTask?.cancel()
        websocketTicketWorkspaceId = wsId
        websocketConnectTask = _Concurrency.Task { [weak self] in
            guard let self else { return }
            do {
                let ticket: WsTicket = try await apiClient.request(.wsTicket(workspaceId: wsId))
                guard !_Concurrency.Task.isCancelled, self.selectedWorkspace?.id == wsId else {
                    Telemetry.shared.breadcrumb("Discarded stale websocket ticket", category: "ws.auth", level: .warning, attributes: ["workspaceId": wsId])
                    if self.websocketTicketWorkspaceId == wsId {
                        self.websocketTicketWorkspaceId = nil
                        self.websocketConnectTask = nil
                    }
                    return
                }

                self.wsUnsubscribe?()
                self.wsUnsubscribe = self.wsClient.onEvent { [weak self] event in
                    _Concurrency.Task { @MainActor [weak self] in
                        self?.handleWebSocketEvent(event)
                    }
                }
                Telemetry.shared.breadcrumb("WebSocket ticket acquired", category: "ws.auth", attributes: ["workspaceId": wsId])
                self.wsClient.connect(ticket: ticket.ticket, workspaceId: wsId)
                if self.websocketTicketWorkspaceId == wsId {
                    self.websocketTicketWorkspaceId = nil
                    self.websocketConnectTask = nil
                }
            } catch {
                if APIClient.isExpectedCancellation(error) || _Concurrency.Task.isCancelled {
                    Telemetry.shared.breadcrumb(
                        "WebSocket ticket request cancelled",
                        category: "ws.auth",
                        attributes: ["workspaceId": wsId]
                    )
                } else {
                    Telemetry.shared.capture(error: error, attributes: ["operation": "ws.ticket", "workspaceId": wsId])
                }
                if self.websocketTicketWorkspaceId == wsId {
                    self.websocketTicketWorkspaceId = nil
                    self.websocketConnectTask = nil
                }
            }
        }
    }

    func handleWebSocketEvent(_ event: WebSocketClient.Event) {
        switch event {
        case .messageNew(let msg):
            cacheMessages([msg])
            // Update thread's last message preview & unread count
            if let idx = threads.firstIndex(where: { $0.id == msg.threadId }) {
                let t = threads[idx]
                // Mutate unread count if not from current user
                if !msg.isFromUser {
                    // Thread is a value type – rebuild unreadCount via copy
                    threads[idx] = Thread(
                        id: t.id,
                        title: t.title,
                        type: t.type,
                        workspaceId: t.workspaceId,
                        avatarUrl: t.avatarUrl,
                        lastMessage: MessagePreview(
                            content: msg.content,
                            senderId: msg.senderId,
                            senderName: msg.senderName,
                            timestamp: msg.createdAt
                        ),
                        unreadCount: t.unreadCount + 1,
                        isPinned: t.isPinned,
                        isMuted: t.isMuted,
                        participantIds: t.participantIds,
                        createdAt: t.createdAt,
                        updatedAt: msg.createdAt,
                        teamId: t.teamId,
                        departmentId: t.departmentId,
                        agentIds: t.agentIds,
                        status: t.status,
                        maxAgentTurns: t.maxAgentTurns
                    )
                }
            }

        case .threadUpdate(let updated):
            guard updated.type != .agentToAgent else {
                threads.removeAll { $0.id == updated.id }
                return
            }
            if let idx = threads.firstIndex(where: { $0.id == updated.id }) {
                threads[idx] = updated
            }

        case .agentUpdate(let agent):
            upsertAgent(agent)

        case .agentStatusChanged(let agentId, let status):
            if let idx = agents.firstIndex(where: { $0.id == agentId }) {
                var agent = agents[idx]
                agent.status = status
                agents[idx] = agent
            }

        case .taskUpdate(let task):
            // Refresh pending approvals if a task requiring approval changed
            if task.requiresApproval {
                _Concurrency.Task { try? await syncPendingApprovals() }
            }

        case .approvalNew(let approval):
            if approval.status == .pending {
                pendingApprovals.insert(approval, at: 0)
            }

        case .incidentNew(let incident):
            if incident.status == .open || incident.status == .investigating {
                openIncidents.insert(incident, at: 0)
            }

        case .alertNew:
            unreadAlertCount += 1

        case .disconnected:
            let disconnectedWorkspaceId = selectedWorkspace?.id
            _Concurrency.Task { [weak self] in
                try? await _Concurrency.Task.sleep(for: .seconds(1))
                guard self?.selectedWorkspace?.id == disconnectedWorkspaceId else { return }
                self?.connectWebSocket()
            }

        case .connected:
            // Re-sync on reconnect
            _Concurrency.Task {
                try? await syncThreads()
                try? await syncAgents()
            }

        case .dispatchQueued:
            // Refresh tasks if this dispatch is for the current workspace
            _Concurrency.Task { try? await syncTasks() }

        case .dispatchStarted(let dispatch):
            streamingContent[dispatch.threadId] = ""
            runtimeTodoTasks.removeValue(forKey: dispatch.threadId)
            runtimeToolActivity.removeValue(forKey: dispatch.threadId)
            _Concurrency.Task { try? await syncTasks() }

        case .dispatchCompleted(let dispatch):
            streamingContent.removeValue(forKey: dispatch.threadId)
            streamingTool.removeValue(forKey: dispatch.threadId)
            runtimeTodoTasks.removeValue(forKey: dispatch.threadId)
            runtimeToolActivity.removeValue(forKey: dispatch.threadId)
            _Concurrency.Task { try? await syncTasks() }

        case .dispatchFailed(let dispatch):
            streamingContent.removeValue(forKey: dispatch.threadId)
            streamingTool.removeValue(forKey: dispatch.threadId)
            runtimeTodoTasks.removeValue(forKey: dispatch.threadId)
            runtimeToolActivity.removeValue(forKey: dispatch.threadId)

        case .dispatchCancelled:
            break

        case .runDelta(let threadId, _, let content):
            streamingContent[threadId, default: ""] += content

        case .runStatus(let threadId, _, let status):
            if status == "completed" || status == "failed" || status == "cancelled" {
                streamingTool.removeValue(forKey: threadId)
            }

        case .runTool(let threadId, _, let toolName):
            streamingTool[threadId] = toolName

        case .runtimeDispatchStarted(let dispatch):
            streamingContent[dispatch.threadId] = dispatch.draftText ?? ""
            streamingTool.removeValue(forKey: dispatch.threadId)
            runtimeTodoTasks.removeValue(forKey: dispatch.threadId)
            runtimeToolActivity.removeValue(forKey: dispatch.threadId)

        case .runtimeDispatchCompleted(let dispatch):
            clearRuntimePresentation(for: dispatch.threadId)

        case .runtimeDispatchFailed(let dispatch):
            clearRuntimePresentation(for: dispatch.threadId)

        case .runtimeDispatchCancelled(let dispatch):
            clearRuntimePresentation(for: dispatch.threadId)

        case .runtimeRunDelta(let event):
            streamingContent[event.threadId, default: ""] += event.text

        case .runtimeRunThinking(let event):
            if streamingContent[event.threadId] == nil {
                streamingContent[event.threadId] = ""
            }

        case .runtimeRunStatus(let event):
            if streamingContent[event.threadId] == nil {
                streamingContent[event.threadId] = ""
            }

        case .runtimeRunTool(let event):
            if streamingContent[event.threadId] == nil {
                streamingContent[event.threadId] = ""
            }
            if event.toolName.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == "todo" {
                if let tasks = event.tasks {
                    runtimeTodoTasks[event.threadId] = tasks
                }
            } else {
                var activities = runtimeToolActivity[event.threadId] ?? []
                activities.removeAll { $0.toolName == event.toolName }
                activities.append(
                    RuntimeToolActivity(
                        toolName: event.toolName,
                        phase: event.phase,
                        summary: event.summary,
                        updatedAt: event.timestamp
                    )
                )
                runtimeToolActivity[event.threadId] = Array(activities.suffix(20))
            }

        case .participantHealth(let agentId, let status):
            if let idx = agents.firstIndex(where: { $0.id == agentId }) {
                var agent = agents[idx]
                agent.status = status
                agents[idx] = agent
            }

        case .sessionRevoked:
            authError = "This mobile session was revoked. Please log in again."
            clearAuthenticatedState(clearTokens: true)

        default:
            break
        }
    }

    private func clearRuntimePresentation(for threadId: String) {
        streamingContent.removeValue(forKey: threadId)
        streamingTool.removeValue(forKey: threadId)
        runtimeTodoTasks.removeValue(forKey: threadId)
        runtimeToolActivity.removeValue(forKey: threadId)
    }
}

// MARK: - Preview

extension AppStore {
    static var preview: AppStore { AppStore() }
}
