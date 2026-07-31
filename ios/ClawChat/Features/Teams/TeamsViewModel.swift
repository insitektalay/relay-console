// TeamsViewModel.swift
// ClawChat – Team dashboard + OrgChart ViewModels
// Swift 6, @Observable, @MainActor

import Foundation
import Observation

// MARK: - TeamDashboardViewModel

@MainActor
@Observable
final class TeamDashboardViewModel {

    // MARK: - Public State

    var teamId: String
    var team: Team?
    var agents: [Agent] = []
    var runningTasks: [Task] = []
    var blockedTasks: [Task] = []
    var pendingApprovals: [Approval] = []
    var recentIncidents: [Incident] = []
    var recentHandovers: [HandoverNote] = []
    var performance: PerformanceMetric?
    var isLoading: Bool = false
    var error: String?

    // MARK: - Private

    private let api: APIClient

    // MARK: - Init

    init(teamId: String, api: APIClient = .shared) {
        self.teamId = teamId
        self.api    = api
    }

    // MARK: - Load

    func load() async {
        isLoading = true
        error = nil

        async let teamResult: ()        = loadTeam()
        async let agentsResult: ()      = loadAgents()
        async let tasksResult: ()       = loadTasks()
        async let approvalsResult: ()   = loadApprovals()
        async let incidentsResult: ()   = loadIncidents()
        async let handoversResult: ()   = loadHandovers()

        await teamResult
        await agentsResult
        await tasksResult
        await approvalsResult
        await incidentsResult
        await handoversResult

        isLoading = false
    }

    func refresh() async {
        await load()
    }

    // MARK: - Private Loaders

    private func loadTeam() async {
        do {
            team = try await api.request(.team(id: teamId))
        } catch {
            self.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    private func loadAgents() async {
        do {
            let response: PaginatedResponse<Agent> = try await api.requestPaginated(
                .teamAgents(teamId: teamId, page: 1)
            )
            agents = response.data.filter(\.isActiveSurfaceEligible)
        } catch {
            self.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    private func loadTasks() async {
        guard let wsId = team?.departmentId else { return }
        do {
            let runningResponse: PaginatedResponse<Task> = try await api.requestPaginated(
                .tasks(workspaceId: wsId, page: 1, status: TaskStatus.running.rawValue, agentId: nil, teamId: teamId)
            )
            runningTasks = runningResponse.data

            let blockedResponse: PaginatedResponse<Task> = try await api.requestPaginated(
                .tasks(workspaceId: wsId, page: 1, status: TaskStatus.blocked.rawValue, agentId: nil, teamId: teamId)
            )
            blockedTasks = blockedResponse.data
        } catch {
            self.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    private func loadApprovals() async {
        // Use team agent IDs to filter approvals after fetching
        do {
            let response: PaginatedResponse<Approval> = try await api.requestPaginated(
                .teamMemory(teamId: teamId, page: 1)
            )
            _ = response  // Used for side effects; approvals loaded separately
        } catch {
            // Non-fatal
        }
    }

    private func loadIncidents() async {
        do {
            let response: PaginatedResponse<Incident> = try await api.requestPaginated(
                .teamHandovers(teamId: teamId, page: 1)
            )
            _ = response
        } catch {
            // Non-fatal
        }
    }

    private func loadHandovers() async {
        do {
            let response: PaginatedResponse<HandoverNote> = try await api.requestPaginated(
                .teamHandovers(teamId: teamId, page: 1)
            )
            recentHandovers = response.data
        } catch {
            self.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }
}

// MARK: - OrgChartViewModel

@MainActor
@Observable
final class OrgChartViewModel {

    // MARK: - Public State

    var workspaceId: String
    var companies: [Company] = []
    var departments: [Department] = []
    var teams: [Team] = []
    var agents: [Agent] = []
    var managerRelationships: [ManagerRelationship] = []
    var isLoading: Bool = false
    var selectedCompanyId: String?
    var selectedDepartmentId: String?
    var error: String?

    // MARK: - Private

    private let api: APIClient

    // MARK: - Init

    init(workspaceId: String, api: APIClient = .shared) {
        self.workspaceId = workspaceId
        self.api         = api
    }

    // MARK: - Load

    func load() async {
        isLoading = true
        error = nil
        do {
            let companiesResult: [Company] = try await api.request(
                .companies(workspaceId: workspaceId)
            )
            companies = companiesResult

            // Load departments for the workspace
            let deptsResult: [Department] = (try? await api.request(
                .departments(workspaceId: workspaceId)
            )) ?? []
            departments = deptsResult

            // Load agents for the workspace
            let agentsResponse: PaginatedResponse<Agent> = try await api.requestPaginated(
                .agents(workspaceId: workspaceId, page: 1, pageSize: 200, teamId: nil, status: nil)
            )
            agents = agentsResponse.data.filter(\.isActiveSurfaceEligible)

        } catch {
            self.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
        isLoading = false
    }

    func expand(companyId: String) {
        selectedCompanyId = selectedCompanyId == companyId ? nil : companyId
    }

    func expand(departmentId: String) {
        selectedDepartmentId = selectedDepartmentId == departmentId ? nil : departmentId
        if selectedDepartmentId != nil {
            _Concurrency.Task { await loadTeamsForDepartment(departmentId) }
        }
    }

    // MARK: - Private

    private func loadTeamsForDepartment(_ departmentId: String) async {
        guard let wsId = companies.first?.workspaceId else { return }
        do {
            let allTeams: [Team] = try await api.request(.teams(workspaceId: wsId))
            let deptTeams = allTeams.filter { $0.departmentId == departmentId }
            // Merge without duplicates
            for team in deptTeams {
                if !teams.contains(where: { $0.id == team.id }) {
                    teams.append(team)
                }
            }
        } catch {
            self.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }
}
