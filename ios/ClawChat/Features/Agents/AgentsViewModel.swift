// AgentsViewModel.swift
// ClawChat – Agents list + detail ViewModels
// Swift 6, @Observable, @MainActor

import Foundation
import Observation

// MARK: - AgentsViewModel

@MainActor
@Observable
final class AgentsViewModel {

    // MARK: - Public State

    var agents: [Agent] = []
    var isLoading: Bool = false
    var searchQuery: String = "" {
        didSet { applyFilters() }
    }
    var statusFilter: AgentStatus? = nil {
        didSet { applyFilters() }
    }
    var teamFilter: String? = nil {
        didSet { applyFilters() }
    }
    var filteredAgents: [Agent] = []
    var page: Int = 1
    var hasMore: Bool = true
    var workspaceId: String
    var error: String?

    // MARK: - Private

    private let api: APIClient
    private let pageSize = 30

    // MARK: - Init

    init(workspaceId: String, api: APIClient = .shared) {
        self.workspaceId = workspaceId
        self.api = api
    }

    // MARK: - Load

    func loadAgents() async {
        guard !isLoading else { return }
        isLoading = true
        error = nil
        page = 1
        do {
            let response: PaginatedResponse<Agent> = try await api.requestPaginated(
                .agents(
                    workspaceId: workspaceId,
                    page: 1,
                    pageSize: pageSize,
                    teamId: teamFilter,
                    status: statusFilter?.rawValue
                )
            )
            agents = response.data.filter(\.isActiveSurfaceEligible)
            hasMore = response.hasMore
            applyFilters()
        } catch {
            self.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
        isLoading = false
    }

    func loadMore() async {
        guard hasMore, !isLoading else { return }
        isLoading = true
        let nextPage = page + 1
        do {
            let response: PaginatedResponse<Agent> = try await api.requestPaginated(
                .agents(
                    workspaceId: workspaceId,
                    page: nextPage,
                    pageSize: pageSize,
                    teamId: teamFilter,
                    status: statusFilter?.rawValue
                )
            )
            agents.append(contentsOf: response.data.filter(\.isActiveSurfaceEligible))
            page = nextPage
            hasMore = response.hasMore
            applyFilters()
        } catch {
            self.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
        isLoading = false
    }

    func refresh() async {
        await loadAgents()
    }

    // MARK: - Actions

    func setStatus(agent: Agent, status: AgentStatus, reason: String?) async {
        do {
            let updated: Agent = try await api.request(
                .setAgentStatus(agentId: agent.id, status: status.rawValue, reason: reason)
            )
            if let idx = agents.firstIndex(where: { $0.id == agent.id }) {
                agents[idx] = updated
            }
            applyFilters()
        } catch {
            self.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    // MARK: - Private

    private func applyFilters() {
        var result = agents
        let query = searchQuery.trimmingCharacters(in: .whitespaces)
        if !query.isEmpty {
            result = result.filter {
                $0.name.localizedCaseInsensitiveContains(query) ||
                $0.role.localizedCaseInsensitiveContains(query)
            }
        }
        filteredAgents = result
    }
}

// MARK: - AgentDetailViewModel

@MainActor
@Observable
final class AgentDetailViewModel {

    // MARK: - Public State

    var agent: Agent
    var performanceMetrics: PerformanceMetric?
    var recentWorkLogs: [WorkLog] = []
    var recentTasks: [Task] = []
    var recentReviews: [Review] = []
    var recentIncidents: [Incident] = []
    var schedule: Schedule?
    var isLoading: Bool = false
    var selectedPeriod: MetricPeriod = .weekly
    var error: String?

    // Pagination state for work logs
    private var workLogPage: Int = 1
    var hasMoreWorkLogs: Bool = true

    // MARK: - Private

    private let api: APIClient

    // MARK: - Init

    init(agent: Agent, api: APIClient = .shared) {
        self.agent = agent
        self.api   = api
    }

    // MARK: - Load

    func load() async {
        isLoading = true
        error = nil
        async let metricsResult: ()    = loadPerformance()
        async let workLogsResult: ()   = loadWorkLogs(reset: true)
        async let tasksResult: ()      = loadTasks()
        async let reviewsResult: ()    = loadReviews()
        async let scheduleResult: ()   = loadSchedule()
        await metricsResult
        await workLogsResult
        await tasksResult
        await reviewsResult
        await scheduleResult
        isLoading = false
    }

    func refresh() async {
        await load()
    }

    func setStatus(_ status: AgentStatus, reason: String?) async {
        do {
            let updated: Agent = try await api.request(
                .setAgentStatus(agentId: agent.id, status: status.rawValue, reason: reason)
            )
            agent = updated
        } catch {
            self.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    func loadMoreWorkLogs() async {
        guard hasMoreWorkLogs else { return }
        await loadWorkLogs(reset: false)
    }

    // MARK: - Private Loaders

    private func loadPerformance() async {
        do {
            let metric: PerformanceMetric = try await api.request(
                .agentPerformance(agentId: agent.id, period: selectedPeriod.rawValue)
            )
            performanceMetrics = metric
        } catch {
            self.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    private func loadWorkLogs(reset: Bool) async {
        if reset {
            workLogPage = 1
            recentWorkLogs = []
            hasMoreWorkLogs = true
        }
        do {
            let response: PaginatedResponse<WorkLog> = try await api.requestPaginated(
                .agentWorkLogs(agentId: agent.id, page: workLogPage)
            )
            if reset {
                recentWorkLogs = response.data
            } else {
                recentWorkLogs.append(contentsOf: response.data)
            }
            hasMoreWorkLogs = response.hasMore
            workLogPage += 1
        } catch {
            self.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    private func loadTasks() async {
        do {
            let response: PaginatedResponse<Task> = try await api.requestPaginated(
                .agentRunHistory(agentId: agent.id, page: 1)
            )
            recentTasks = Array(response.data.prefix(10))
        } catch {
            self.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    private func loadReviews() async {
        do {
            let response: PaginatedResponse<Review> = try await api.requestPaginated(
                .agentReviews(agentId: agent.id, page: 1)
            )
            recentReviews = response.data
        } catch {
            self.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    private func loadSchedule() async {
        do {
            let s: Schedule = try await api.request(.agentSchedule(agentId: agent.id))
            schedule = s
        } catch {
            // Non-fatal – agent may not have a schedule
        }
    }
}
