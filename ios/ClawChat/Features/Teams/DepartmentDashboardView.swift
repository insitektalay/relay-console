// DepartmentDashboardView.swift
// ClawChat – Department-level dashboard

import SwiftUI

// MARK: - ViewModel

@Observable
final class DepartmentDashboardViewModel {
    var department: Department
    var company: Company?
    var headAgent: Agent?
    var teams: [Team] = []
    var agentsByTeam: [String: [Agent]] = [:]
    var runningTaskCount: Int = 0
    var blockedTaskCount: Int = 0
    var completedTodayCount: Int = 0
    var incidents: [Incident] = []
    var inboxItems: [DepartmentInboxItem] = []
    var topPerformingTeam: Team?
    var underperformingTeam: Team?
    var isLoading = false
    var error: String?

    var totalAgentCount: Int {
        agentsByTeam.values.reduce(0) { $0 + $1.count }
    }

    var activeAgentCount: Int {
        agentsByTeam.values.flatMap { $0 }.filter { $0.status == .onDuty || $0.status == .busy }.count
    }

    var workspaceId: String

    init(department: Department, workspaceId: String) {
        self.department = department
        self.workspaceId = workspaceId
    }

    @MainActor
    func load() async {
        guard !isLoading else { return }
        isLoading = true
        defer { isLoading = false }
        error = nil
        do {
            // Load teams for this department
            let fetchedTeams: [Team] = try await APIClient.shared.request(.teams(workspaceId: workspaceId))
            teams = fetchedTeams.filter { $0.departmentId == department.id }

            // Load agents for each team
            var byTeam: [String: [Agent]] = [:]
            for team in teams {
                let response: PaginatedResponse<Agent> = try await APIClient.shared.requestPaginated(
                    .agents(workspaceId: workspaceId, page: 1, pageSize: 100, teamId: team.id, status: nil)
                )
                byTeam[team.id] = response.data
            }
            agentsByTeam = byTeam
        } catch {
            self.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    @MainActor
    private func loadMockData() async {
        let now = Date()

        teams = [
            Team(id: "tm1", name: "Alpha Squad", departmentId: department.id,
                 leadAgentId: "a1", description: nil, color: "#0A84FF", agentCount: 5, createdAt: now),
            Team(id: "tm2", name: "Beta Unit", departmentId: department.id,
                 leadAgentId: "a4", description: nil, color: "#30D158", agentCount: 4, createdAt: now),
            Team(id: "tm3", name: "Gamma Force", departmentId: department.id,
                 leadAgentId: "a7", description: nil, color: "#BF5AF2", agentCount: 6, createdAt: now),
        ]

        agentsByTeam = [
            "tm1": [
                Agent(id: "a1", name: "Alpha Bot", role: "Lead", avatarUrl: nil, status: .onDuty,
                      teamId: "tm1", departmentId: department.id, companyId: nil, workspaceId: "ws1",
                      managerId: nil, description: nil, capabilities: [], workingHoursMode: .twentyFourSeven,
                      timezone: "UTC", createdAt: now, updatedAt: now, currentTaskId: nil,
                      tasksCompletedToday: 12, successRate: 0.94, avgCompletionMinutes: 8,
                      totalMinutesWorked: 480, budgetUsed: 1.20, budgetLimit: 10.0),
                Agent(id: "a2", name: "Beta Bot", role: "Analyst", avatarUrl: nil, status: .busy,
                      teamId: "tm1", departmentId: department.id, companyId: nil, workspaceId: "ws1",
                      managerId: nil, description: nil, capabilities: [], workingHoursMode: .twentyFourSeven,
                      timezone: "UTC", createdAt: now, updatedAt: now, currentTaskId: nil,
                      tasksCompletedToday: 8, successRate: 0.88, avgCompletionMinutes: 12,
                      totalMinutesWorked: 360, budgetUsed: 0.90, budgetLimit: 10.0),
            ],
            "tm2": [
                Agent(id: "a4", name: "Delta Bot", role: "Lead", avatarUrl: nil, status: .onDuty,
                      teamId: "tm2", departmentId: department.id, companyId: nil, workspaceId: "ws1",
                      managerId: nil, description: nil, capabilities: [], workingHoursMode: .twentyFourSeven,
                      timezone: "UTC", createdAt: now, updatedAt: now, currentTaskId: nil,
                      tasksCompletedToday: 15, successRate: 0.97, avgCompletionMinutes: 5,
                      totalMinutesWorked: 480, budgetUsed: 0.75, budgetLimit: 10.0),
            ],
            "tm3": [
                Agent(id: "a7", name: "Zeta Bot", role: "Lead", avatarUrl: nil, status: .idle,
                      teamId: "tm3", departmentId: department.id, companyId: nil, workspaceId: "ws1",
                      managerId: nil, description: nil, capabilities: [], workingHoursMode: .scheduled,
                      timezone: "UTC", createdAt: now, updatedAt: now, currentTaskId: nil,
                      tasksCompletedToday: 4, successRate: 0.72, avgCompletionMinutes: 18,
                      totalMinutesWorked: 180, budgetUsed: 0.40, budgetLimit: 10.0),
            ],
        ]

        headAgent = agentsByTeam["tm1"]?.first

        runningTaskCount = 7
        blockedTaskCount = 2
        completedTodayCount = 39

        incidents = [
            Incident(id: "i1", title: "API rate limit exceeded on data ingestion pipeline",
                     description: "External API throttling affecting multiple agents",
                     status: .investigating, severity: .high, agentId: "a2", teamId: "tm1",
                     workspaceId: "ws1", taskId: nil, runId: nil, createdAt: now.addingTimeInterval(-5400),
                     resolvedAt: nil, resolutionNotes: nil, tags: [], affectedSystems: ["data-pipeline"]),
        ]

        inboxItems = [
            DepartmentInboxItem(id: "di1", type: .report, title: "Weekly Performance Report",
                                source: "System", isRead: false, timestamp: now.addingTimeInterval(-1800)),
            DepartmentInboxItem(id: "di2", type: .alert, title: "Budget threshold at 80%",
                                source: "BudgetMonitor", isRead: true, timestamp: now.addingTimeInterval(-7200)),
            DepartmentInboxItem(id: "di3", type: .incident, title: "Gamma Force: task failure spike",
                                source: "AlertBot", isRead: false, timestamp: now.addingTimeInterval(-3600)),
        ]

        topPerformingTeam = teams[1]  // Beta Unit
        underperformingTeam = teams[2]  // Gamma Force
    }
}

struct DepartmentInboxItem: Identifiable {
    let id: String
    var type: DepartmentInboxItemType
    var title: String
    var source: String
    var isRead: Bool
    var timestamp: Date
}

enum DepartmentInboxItemType {
    case alert, report, approval, incident, system
}

// MARK: - Main View

struct DepartmentDashboardView: View {
    @State var viewModel: DepartmentDashboardViewModel
    @State private var selectedTeam: Team?
    @State private var expandedSections: Set<String> = ["teams", "stats", "incidents", "performance", "inbox"]
    @EnvironmentObject private var appStore: AppStore

    init(department: Department) {
        _viewModel = State(initialValue: DepartmentDashboardViewModel(department: department, workspaceId: ""))
    }

    private var accentColor: Color {
        Color(hex: viewModel.department.color)
    }

    var body: some View {
        Group {
        if viewModel.isLoading && viewModel.teams.isEmpty {
            RelayLoadingState(message: "Loading department dashboard")
        } else if let error = viewModel.error, viewModel.teams.isEmpty {
            VStack(spacing: RelaySpacing.md) {
                RelayErrorPanel(message: error)
                Button("Try Again") { _Concurrency.Task { await viewModel.load() } }
                    .buttonStyle(RelayButtonStyle(size: .sm, variant: .secondary))
            }
            .padding(RelaySpacing.lg)
        } else {
        ScrollView {
            VStack(spacing: 0) {
                departmentHeader
                    .padding(.horizontal, ClawSpacing.lg)
                    .padding(.top, ClawSpacing.lg)
                    .padding(.bottom, ClawSpacing.xl)

                Divider().background(ClawColors.separator)

                VStack(spacing: ClawSpacing.sm) {
                    teamsOverviewSection
                    departmentStatsSection
                    alertsIncidentsSection
                    performanceSection
                    departmentInboxSection
                }
                .padding(.bottom, ClawSpacing.xxxl)
            }
        }
        }
        }
        .background(ClawColors.backgroundPrimary)
        .navigationTitle(viewModel.department.name)
        .navigationBarTitleDisplayMode(.inline)
        .task {
            viewModel.workspaceId = appStore.selectedWorkspace?.id ?? ""
            await viewModel.load()
        }
        .navigationDestination(item: $selectedTeam) { team in
            TeamDashboardView(team: team)
        }
    }

    // MARK: - Header

    private var departmentHeader: some View {
        VStack(alignment: .leading, spacing: ClawSpacing.md) {
            // Color accent + name
            HStack(spacing: ClawSpacing.sm) {
                RoundedRectangle(cornerRadius: 4)
                    .fill(accentColor)
                    .frame(width: 4, height: 36)

                VStack(alignment: .leading, spacing: 2) {
                    Text(viewModel.department.name)
                        .font(RelayFonts.screenTitle)
                        .foregroundStyle(ClawColors.textPrimary)
                    if let company = viewModel.company {
                        Text(company.name)
                            .font(ClawFonts.caption)
                            .foregroundStyle(ClawColors.textSecondary)
                    }
                }
            }

            // Head agent
            if let head = viewModel.headAgent {
                HStack(spacing: ClawSpacing.md) {
                    AvatarView(name: head.name, imageUrl: head.avatarUrl, size: .medium, status: head.status)
                    VStack(alignment: .leading, spacing: 2) {
                        HStack(spacing: ClawSpacing.xs) {
                            Text(head.name)
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(ClawColors.textPrimary)
                            Text("• Head")
                                .font(ClawFonts.caption)
                                .foregroundStyle(ClawColors.textTertiary)
                        }
                        Text(head.role)
                            .font(ClawFonts.caption)
                            .foregroundStyle(ClawColors.textSecondary)
                    }
                    Spacer()
                    VStack(alignment: .trailing, spacing: 2) {
                        Text("\(viewModel.teams.count) teams")
                            .font(ClawFonts.label)
                            .foregroundStyle(ClawColors.textSecondary)
                        Text("\(viewModel.totalAgentCount) agents")
                            .font(ClawFonts.caption)
                            .foregroundStyle(ClawColors.textTertiary)
                    }
                }
            }
        }
    }

    // MARK: - Teams Overview

    private var teamsOverviewSection: some View {
        DashboardSection(title: "Teams", icon: "person.3.fill", badge: viewModel.teams.count, isExpanded: binding("teams")) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: ClawSpacing.md) {
                    ForEach(viewModel.teams) { team in
                        TeamSummaryCard(
                            team: team,
                            agents: viewModel.agentsByTeam[team.id] ?? []
                        ) {
                            selectedTeam = team
                        }
                    }
                }
                .padding(.horizontal, ClawSpacing.lg)
                .padding(.bottom, ClawSpacing.md)
            }
        }
    }

    // MARK: - Department Stats

    private var departmentStatsSection: some View {
        DashboardSection(title: "Department Stats", icon: "chart.bar.fill", isExpanded: binding("stats")) {
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: ClawSpacing.sm) {
                deptStatCell(icon: "person.fill.checkmark", value: "\(viewModel.activeAgentCount)", label: "Active Agents", color: ClawColors.accentPurple)
                deptStatCell(icon: "person.3.fill", value: "\(viewModel.totalAgentCount)", label: "Total Agents", color: ClawColors.textSecondary)
                deptStatCell(icon: "building.2.fill", value: "\(viewModel.teams.count)", label: "Teams", color: ClawColors.accentTeal)
            }
            .padding(.horizontal, ClawSpacing.lg)
            RelayStatusStrip(title: "Task metrics unavailable", detail: "Department teams and agents are available here, but running, blocked, and completed task totals are not yet included.", tone: .neutral, icon: "lock.fill")
                .padding(.horizontal, RelaySpacing.lg)
                .padding(.bottom, RelaySpacing.md)
        }
    }

    private func deptStatCell(icon: String, value: String, label: String, color: Color) -> some View {
        VStack(spacing: ClawSpacing.xs) {
            Image(systemName: icon)
                .font(.system(size: 20))
                .foregroundStyle(color)
            Text(value)
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(ClawColors.textPrimary)
            Text(label)
                .font(.system(size: 10, weight: .medium))
                .foregroundStyle(ClawColors.textSecondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, ClawSpacing.md)
        .background(ClawColors.backgroundCard)
        .cornerRadius(ClawRadius.md)
        .overlay(
            RoundedRectangle(cornerRadius: ClawRadius.md)
                .stroke(ClawColors.separator, lineWidth: 0.5)
        )
    }

    // MARK: - Alerts & Incidents

    private var alertsIncidentsSection: some View {
        DashboardSection(title: "Alerts & Incidents", icon: "exclamationmark.triangle.fill",
                         badge: viewModel.incidents.count, badgeColor: ClawColors.accentRed,
                         isExpanded: binding("incidents")) {
            unavailableDepartmentState("Department incidents are not available in this dashboard yet.")
        }
    }

    // MARK: - Performance

    private var performanceSection: some View {
        DashboardSection(title: "Performance", icon: "chart.line.uptrend.xyaxis", isExpanded: binding("performance")) {
            unavailableDepartmentState("Department performance ranking is not available in this dashboard yet.")
        }
    }

    private func teamPerformanceBadge(team: Team, label: String, icon: String, color: Color) -> some View {
        HStack(spacing: ClawSpacing.md) {
            Image(systemName: icon)
                .font(.system(size: 16))
                .foregroundStyle(color)
                .frame(width: 28)

            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(ClawFonts.caption)
                    .foregroundStyle(color)
                Text(team.name)
                    .font(ClawFonts.cardTitle)
                    .foregroundStyle(ClawColors.textPrimary)
            }

            Spacer()

            HStack(spacing: 4) {
                Circle()
                    .fill(Color(hex: team.color))
                    .frame(width: 8, height: 8)
                Text("\(team.agentCount) agents")
                    .font(ClawFonts.caption)
                    .foregroundStyle(ClawColors.textSecondary)
            }
        }
        .padding(ClawSpacing.md)
        .background(ClawColors.backgroundCard)
        .cornerRadius(ClawRadius.md)
        .overlay(
            RoundedRectangle(cornerRadius: ClawRadius.md)
                .stroke(color.opacity(0.25), lineWidth: 0.5)
        )
    }

    // MARK: - Department Inbox

    private var departmentInboxSection: some View {
        DashboardSection(title: "Department Inbox", icon: "tray.fill",
                         badge: viewModel.inboxItems.filter { !$0.isRead }.count,
                         isExpanded: binding("inbox")) {
            unavailableDepartmentState("A department inbox is not available in this release. No sample messages are shown as live data.")
        }
    }

    private func unavailableDepartmentState(_ detail: String) -> some View {
        RelayStatusStrip(title: "Unavailable", detail: detail, tone: .neutral, icon: "lock.fill")
            .padding(.horizontal, RelaySpacing.lg)
            .padding(.bottom, RelaySpacing.md)
    }

    // MARK: - Helpers

    private func binding(_ key: String) -> Binding<Bool> {
        Binding(
            get: { expandedSections.contains(key) },
            set: { v in if v { expandedSections.insert(key) } else { expandedSections.remove(key) } }
        )
    }

    private func emptyStateRow(icon: String, message: String) -> some View {
        HStack(spacing: ClawSpacing.sm) {
            Image(systemName: icon)
                .font(.system(size: 16))
                .foregroundStyle(ClawColors.textTertiary)
            Text(message)
                .font(ClawFonts.label)
                .foregroundStyle(ClawColors.textTertiary)
        }
        .frame(maxWidth: .infinity, alignment: .center)
        .padding(.vertical, ClawSpacing.lg)
        .background(ClawColors.backgroundCard)
        .cornerRadius(ClawRadius.md)
        .overlay(
            RoundedRectangle(cornerRadius: ClawRadius.md)
                .stroke(ClawColors.separator, lineWidth: 0.5)
        )
    }
}

// MARK: - Team Summary Card

struct TeamSummaryCard: View {
    let team: Team
    let agents: [Agent]
    let onTap: () -> Void

    private var activeCount: Int {
        agents.filter { $0.status == .onDuty || $0.status == .busy }.count
    }

    private var fraction: Double {
        agents.isEmpty ? 0 : Double(activeCount) / Double(agents.count)
    }

    var body: some View {
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: ClawSpacing.md) {
                // Header
                HStack(spacing: ClawSpacing.sm) {
                    Circle()
                        .fill(Color(hex: team.color))
                        .frame(width: 10, height: 10)
                    Text(team.name)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(ClawColors.textPrimary)
                        .lineLimit(1)
                }

                // Stats
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text("\(team.agentCount) agents")
                            .font(ClawFonts.caption)
                            .foregroundStyle(ClawColors.textSecondary)
                        Spacer()
                        Text("\(activeCount) active")
                            .font(ClawFonts.caption)
                            .foregroundStyle(ClawColors.accentGreen)
                    }

                    // Mini bar
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            RoundedRectangle(cornerRadius: 3)
                                .fill(ClawColors.backgroundTertiary)
                                .frame(height: 5)
                            RoundedRectangle(cornerRadius: 3)
                                .fill(Color(hex: team.color))
                                .frame(width: geo.size.width * fraction, height: 5)
                        }
                    }
                    .frame(height: 5)
                }

                // Agents mini row
                HStack(spacing: -6) {
                    ForEach(agents.prefix(4)) { agent in
                        AvatarView(name: agent.name, imageUrl: agent.avatarUrl, size: .small, status: agent.status)
                            .overlay(
                                Circle()
                                    .stroke(ClawColors.backgroundPrimary, lineWidth: 1.5)
                            )
                    }
                    if agents.count > 4 {
                        ZStack {
                            Circle()
                                .fill(ClawColors.backgroundTertiary)
                                .frame(width: 28, height: 28)
                            Text("+\(agents.count - 4)")
                                .font(.system(size: 9, weight: .semibold))
                                .foregroundStyle(ClawColors.textSecondary)
                        }
                    }
                }
            }
            .frame(width: 160)
            .padding(ClawSpacing.md)
            .background(ClawColors.backgroundCard)
            .cornerRadius(ClawRadius.lg)
            .overlay(
                RoundedRectangle(cornerRadius: ClawRadius.lg)
                    .stroke(Color(hex: team.color).opacity(0.3), lineWidth: 0.5)
            )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Inbox Row

struct DepartmentInboxRow: View {
    let item: DepartmentInboxItem

    private var icon: String {
        switch item.type {
        case .alert:    return "bell.badge.fill"
        case .report:   return "chart.bar.fill"
        case .approval: return "checkmark.seal.fill"
        case .incident: return "exclamationmark.triangle.fill"
        case .system:   return "gearshape.fill"
        }
    }

    private var iconColor: Color {
        switch item.type {
        case .alert:    return ClawColors.accentOrange
        case .report:   return ClawColors.accentPurple
        case .approval: return ClawColors.accentOrange
        case .incident: return ClawColors.accentRed
        case .system:   return ClawColors.textSecondary
        }
    }

    var body: some View {
        HStack(spacing: ClawSpacing.md) {
            Image(systemName: icon)
                .font(.system(size: 18))
                .foregroundStyle(iconColor)
                .frame(width: 28)

            VStack(alignment: .leading, spacing: 2) {
                Text(item.title)
                    .font(item.isRead ? ClawFonts.cardTitle : .system(size: 14, weight: .semibold))
                    .foregroundStyle(item.isRead ? ClawColors.textSecondary : ClawColors.textPrimary)
                    .lineLimit(2)
                HStack(spacing: ClawSpacing.xs) {
                    Text(item.source)
                        .font(ClawFonts.caption)
                        .foregroundStyle(ClawColors.textTertiary)
                    Text("•")
                        .font(ClawFonts.caption)
                        .foregroundStyle(ClawColors.textTertiary)
                    Text(item.timestamp.relativeTime)
                        .font(ClawFonts.caption)
                        .foregroundStyle(ClawColors.textTertiary)
                }
            }

            Spacer()

            if !item.isRead {
                Circle()
                    .fill(ClawColors.accent)
                    .frame(width: 8, height: 8)
            }
        }
        .padding(ClawSpacing.md)
        .background(ClawColors.backgroundCard)
        .cornerRadius(ClawRadius.md)
        .overlay(
            RoundedRectangle(cornerRadius: ClawRadius.md)
                .stroke(ClawColors.separator, lineWidth: 0.5)
        )
    }
}

// MARK: - Preview

#Preview {
    NavigationStack {
        DepartmentDashboardView(department: Department(
            id: "d1",
            name: "Engineering",
            companyId: "c1",
            headAgentId: "a1",
            description: "Core engineering department",
            color: "#0A84FF",
            agentCount: 15,
            createdAt: Date()
        ))
    }
    .environmentObject(AppStore.preview)
    .preferredColorScheme(.dark)
}
