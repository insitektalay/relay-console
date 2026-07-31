// TasksViewModel.swift
// ClawChat – Task board + detail ViewModels
// Swift 6, @Observable, @MainActor

import Foundation
import Observation

// MARK: - TaskBoardViewModel

@MainActor
@Observable
final class TaskBoardViewModel {

    // MARK: - Public State

    var workspaceId: String
    var tasks: [Task] = []
    var groupedTasks: [TaskStatus: [Task]] = [:]
    var selectedStatus: TaskStatus? = nil {
        didSet { groupTasks() }
    }
    var agentFilter: String? = nil
    var teamFilter: String? = nil
    var isLoading: Bool = false
    var page: Int = 1
    var hasMore: Bool = true
    var error: String?

    // MARK: - Private

    private let api: APIClient
    private let pageSize = 50

    // MARK: - Init

    init(workspaceId: String, api: APIClient = .shared) {
        self.workspaceId = workspaceId
        self.api         = api
    }

    // MARK: - Load

    func loadTasks() async {
        guard !isLoading else { return }
        isLoading = true
        error = nil
        page = 1
        do {
            let response: PaginatedResponse<Task> = try await api.requestPaginated(
                .tasks(
                    workspaceId: workspaceId,
                    page: 1,
                    status: selectedStatus?.rawValue,
                    agentId: agentFilter,
                    teamId: teamFilter
                )
            )
            tasks = response.data
            hasMore = response.hasMore
            groupTasks()
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
            let response: PaginatedResponse<Task> = try await api.requestPaginated(
                .tasks(
                    workspaceId: workspaceId,
                    page: nextPage,
                    status: selectedStatus?.rawValue,
                    agentId: agentFilter,
                    teamId: teamFilter
                )
            )
            tasks.append(contentsOf: response.data)
            page = nextPage
            hasMore = response.hasMore
            groupTasks()
        } catch {
            self.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
        isLoading = false
    }

    func refresh() async {
        await loadTasks()
    }

    // MARK: - Actions

    func updateStatus(task: Task, status: TaskStatus) async {
        do {
            let updated: Task = try await api.request(
                .updateTaskStatus(id: task.id, status: status.rawValue)
            )
            if let idx = tasks.firstIndex(where: { $0.id == task.id }) {
                tasks[idx] = updated
            }
            groupTasks()
        } catch {
            self.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    // MARK: - Private

    private func groupTasks() {
        var result: [TaskStatus: [Task]] = [:]
        for status in TaskStatus.allCases {
            result[status] = []
        }
        for task in tasks {
            result[task.status, default: []].append(task)
        }
        groupedTasks = result
    }
}

// MARK: - TaskStatus CaseIterable

extension TaskStatus: CaseIterable {
    public static var allCases: [TaskStatus] {
        [.queued, .dispatched, .running, .blocked, .awaitingApproval, .failed, .completed, .cancelled]
    }
}

// MARK: - TaskDetailViewModel

@MainActor
@Observable
final class TaskDetailViewModel {

    // MARK: - Public State

    var task: Task
    var runs: [Run] = []
    var workLogs: [WorkLog] = []
    var assignedAgent: Agent?
    var approval: Approval?
    var isLoading: Bool = false
    var error: String?

    // MARK: - Private

    private let api: APIClient

    // MARK: - Init

    init(task: Task, api: APIClient = .shared) {
        self.task = task
        self.api  = api
    }

    // MARK: - Load

    func load() async {
        isLoading = true
        error = nil

        async let runsResult: ()    = loadRuns()
        async let agentResult: ()   = loadAgent()
        async let approvalResult: () = loadApproval()

        await runsResult
        await agentResult
        await approvalResult

        isLoading = false
    }

    func loadRunEvents(runId: String) async -> [RunEvent] {
        do {
            let response: PaginatedResponse<RunEvent> = try await api.requestPaginated(
                .runEvents(runId: runId, page: 1)
            )
            return response.data
        } catch {
            self.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
            return []
        }
    }

    // MARK: - Private Loaders

    private func loadRuns() async {
        do {
            let response: PaginatedResponse<Run> = try await api.requestPaginated(
                .taskRuns(taskId: task.id, page: 1)
            )
            runs = response.data
        } catch {
            self.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    private func loadAgent() async {
        guard let agentId = task.assignedAgentId else { return }
        do {
            assignedAgent = try await api.request(.agent(id: agentId))
        } catch {
            // Non-fatal
        }
    }

    private func loadApproval() async {
        guard let approvalId = task.approvalId else { return }
        do {
            approval = try await api.request(.approval(id: approvalId))
        } catch {
            // Non-fatal
        }
    }
}
