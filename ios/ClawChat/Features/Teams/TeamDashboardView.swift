// TeamDashboardView.swift
// ClawChat – Comprehensive team dashboard

import SwiftUI

enum TeamDetailDestination: String, CaseIterable {
    case dashboard = "Dashboard"
    case inbox = "Inbox"
    case memory = "Memory"
    case handover = "Handover"
    case settings = "Settings"
}

// MARK: - ViewModel

@Observable
@MainActor
final class TeamDashboardViewState {
    var team: Team
    var department: Department?
    var company: Company?
    var leadAgent: Agent?
    var agents: [Agent] = []
    var runningTasks: [Task] = []
    var blockedTasks: [Task] = []
    var pendingApprovals: [Approval] = []
    var recentIncidents: [Incident] = []
    var recentHandovers: [HandoverNote] = []
    var performanceToday: TeamPerformanceSnapshot?
    var performanceLastWeek: TeamPerformanceSnapshot?
    var isLoading = false
    var error: String?
    var workspaceId = ""

    var onDutyCount: Int { agents.filter { $0.status == .onDuty }.count }
    var busyCount: Int { agents.filter { $0.status == .busy }.count }
    var activeCount: Int { agents.filter { $0.status == .onDuty || $0.status == .busy }.count }

    init(team: Team) {
        self.team = team
    }

    @MainActor
    func load() async {
        isLoading = true
        error = nil
        defer { isLoading = false }
        await withTaskGroup(of: Void.self) { group in
            group.addTask { await self.loadAgents() }
            group.addTask { await self.loadRunningTasks() }
            group.addTask { await self.loadHandovers() }
        }
    }

    @MainActor
    private func loadAgents() async {
        do {
            let response: PaginatedResponse<Agent> = try await APIClient.shared.requestPaginated(
                .teamAgents(teamId: team.id, page: 1)
            )
            agents = response.data.filter(\.isActiveSurfaceEligible)
            leadAgent = agents.first(where: { $0.id == team.leadAgentId }) ?? agents.first
        } catch {
            self.error = error.localizedDescription
        }
    }

    @MainActor
    private func loadRunningTasks() async {
        guard !workspaceId.isEmpty else { return }
        do {
            let response: PaginatedResponse<Task> = try await APIClient.shared.requestPaginated(
                .tasks(workspaceId: workspaceId, page: 1, status: "running", agentId: nil, teamId: team.id)
            )
            runningTasks = response.data.filter { $0.status == .running }
            blockedTasks = response.data.filter { $0.status == .blocked || $0.status == .awaitingApproval }
        } catch {
            // non-fatal
        }
    }

    @MainActor
    private func loadHandovers() async {
        do {
            let response: PaginatedResponse<HandoverNote> = try await APIClient.shared.requestPaginated(
                .teamHandovers(teamId: team.id, page: 1)
            )
            recentHandovers = response.data
        } catch {
            // non-fatal
        }
    }

    @MainActor
    private func loadMockData() async {
        let now = Date()

        agents = [
            Agent(id: "a1", name: "Alpha Bot", role: "Analyst", avatarUrl: nil, status: .onDuty,
                  teamId: team.id, departmentId: nil, companyId: nil, workspaceId: "ws1",
                  managerId: nil, description: nil, capabilities: [], workingHoursMode: .twentyFourSeven,
                  timezone: "UTC", createdAt: now, updatedAt: now, currentTaskId: nil,
                  tasksCompletedToday: 12, successRate: 0.94, avgCompletionMinutes: 8,
                  totalMinutesWorked: 480, budgetUsed: 1.20, budgetLimit: 10.0),
            Agent(id: "a2", name: "Beta Bot", role: "Processor", avatarUrl: nil, status: .busy,
                  teamId: team.id, departmentId: nil, companyId: nil, workspaceId: "ws1",
                  managerId: nil, description: nil, capabilities: [], workingHoursMode: .twentyFourSeven,
                  timezone: "UTC", createdAt: now, updatedAt: now, currentTaskId: "t1",
                  tasksCompletedToday: 8, successRate: 0.88, avgCompletionMinutes: 12,
                  totalMinutesWorked: 360, budgetUsed: 0.90, budgetLimit: 10.0),
            Agent(id: "a3", name: "Gamma Bot", role: "Reviewer", avatarUrl: nil, status: .idle,
                  teamId: team.id, departmentId: nil, companyId: nil, workspaceId: "ws1",
                  managerId: nil, description: nil, capabilities: [], workingHoursMode: .scheduled,
                  timezone: "UTC", createdAt: now, updatedAt: now, currentTaskId: nil,
                  tasksCompletedToday: 5, successRate: 0.96, avgCompletionMinutes: 6,
                  totalMinutesWorked: 240, budgetUsed: 0.50, budgetLimit: 10.0),
            Agent(id: "a4", name: "Delta Bot", role: "Monitor", avatarUrl: nil, status: .onDuty,
                  teamId: team.id, departmentId: nil, companyId: nil, workspaceId: "ws1",
                  managerId: nil, description: nil, capabilities: [], workingHoursMode: .twentyFourSeven,
                  timezone: "UTC", createdAt: now, updatedAt: now, currentTaskId: nil,
                  tasksCompletedToday: 15, successRate: 0.91, avgCompletionMinutes: 5,
                  totalMinutesWorked: 480, budgetUsed: 0.75, budgetLimit: 10.0),
            Agent(id: "a5", name: "Epsilon Bot", role: "Dispatcher", avatarUrl: nil, status: .error,
                  teamId: team.id, departmentId: nil, companyId: nil, workspaceId: "ws1",
                  managerId: nil, description: nil, capabilities: [], workingHoursMode: .manual,
                  timezone: "UTC", createdAt: now, updatedAt: now, currentTaskId: nil,
                  tasksCompletedToday: 2, successRate: 0.72, avgCompletionMinutes: 20,
                  totalMinutesWorked: 60, budgetUsed: 0.30, budgetLimit: 10.0),
        ]

        leadAgent = agents.first

        runningTasks = [
            Task(id: "t1", title: "Process invoice batch #4421", description: "Batch processing",
                 status: .running, priority: .high, assignedAgentId: "a2", teamId: team.id,
                 workspaceId: "ws1", createdByUserId: nil, createdByAgentId: nil,
                 dueAt: now.addingTimeInterval(3600), completedAt: nil, createdAt: now.addingTimeInterval(-2700),
                 updatedAt: now, tags: ["finance"], budgetUsed: 0.42, estimatedMinutes: 60,
                 actualMinutes: 45, runCount: 1, lastRunAt: now.addingTimeInterval(-2700),
                 requiresApproval: false, approvalId: nil),
            Task(id: "t2", title: "Generate weekly compliance report", description: "Compliance",
                 status: .running, priority: .normal, assignedAgentId: "a1", teamId: team.id,
                 workspaceId: "ws1", createdByUserId: nil, createdByAgentId: nil,
                 dueAt: now.addingTimeInterval(7200), completedAt: nil, createdAt: now.addingTimeInterval(-1800),
                 updatedAt: now, tags: ["compliance"], budgetUsed: 0.18, estimatedMinutes: 90,
                 actualMinutes: 30, runCount: 1, lastRunAt: now.addingTimeInterval(-1800),
                 requiresApproval: false, approvalId: nil),
        ]

        blockedTasks = [
            Task(id: "t3", title: "Deploy config update to prod", description: "Needs approval",
                 status: .awaitingApproval, priority: .urgent, assignedAgentId: "a3", teamId: team.id,
                 workspaceId: "ws1", createdByUserId: nil, createdByAgentId: nil,
                 dueAt: now.addingTimeInterval(1800), completedAt: nil, createdAt: now.addingTimeInterval(-3600),
                 updatedAt: now, tags: ["deploy"], budgetUsed: 0.05, estimatedMinutes: 15,
                 actualMinutes: nil, runCount: 0, lastRunAt: nil,
                 requiresApproval: true, approvalId: "ap1"),
            Task(id: "t4", title: "External API sync – rate limited", description: "Blocked on API",
                 status: .blocked, priority: .high, assignedAgentId: "a4", teamId: team.id,
                 workspaceId: "ws1", createdByUserId: nil, createdByAgentId: nil,
                 dueAt: nil, completedAt: nil, createdAt: now.addingTimeInterval(-900),
                 updatedAt: now, tags: ["api"], budgetUsed: 0.08, estimatedMinutes: 30,
                 actualMinutes: nil, runCount: 2, lastRunAt: now.addingTimeInterval(-900),
                 requiresApproval: false, approvalId: nil),
        ]

        pendingApprovals = [
            Approval(id: "ap1", title: "Deploy config update to prod", description: "High-risk deployment",
                     status: .pending, requestedByAgentId: "a3", taskId: "t3",
                     workspaceId: "ws1", risk: .high, steps: [], createdAt: now.addingTimeInterval(-3600),
                     resolvedAt: nil, expiresAt: now.addingTimeInterval(3600), notes: nil),
        ]

        recentIncidents = [
            Incident(id: "i1", title: "Epsilon Bot entering error state", description: "Repeated task failure",
                     status: .open, severity: .high, agentId: "a5", teamId: team.id,
                     workspaceId: "ws1", taskId: nil, runId: nil, createdAt: now.addingTimeInterval(-1200),
                     resolvedAt: nil, resolutionNotes: nil, tags: ["agent"], affectedSystems: []),
        ]

        recentHandovers = [
            HandoverNote(id: "h1", fromAgentId: "a1", toAgentId: "a2", toTeamId: nil,
                         content: "Invoice batch partially processed. Items 1-200 done, 201-400 pending review.",
                         taskIds: ["t1"], createdAt: now.addingTimeInterval(-7200), acknowledgedAt: nil),
            HandoverNote(id: "h2", fromAgentId: "a3", toAgentId: nil, toTeamId: team.id,
                         content: "Compliance review flagged three discrepancies. Attached report for team review.",
                         taskIds: ["t2"], createdAt: now.addingTimeInterval(-14400), acknowledgedAt: now.addingTimeInterval(-10800)),
        ]

        performanceToday = TeamPerformanceSnapshot(
            tasksCompleted: 42, successRate: 0.92, avgMinutes: 9.4
        )
        performanceLastWeek = TeamPerformanceSnapshot(
            tasksCompleted: 38, successRate: 0.87, avgMinutes: 11.2
        )
    }
}

struct TeamPerformanceSnapshot {
    var tasksCompleted: Int
    var successRate: Double
    var avgMinutes: Double
}

// MARK: - Main View

struct TeamDashboardView: View {
    @State var viewModel: TeamDashboardViewState
    @State private var expandedSections: Set<String> = ["status", "tasks", "blocked", "approvals", "incidents", "performance", "handovers"]
    @State private var selectedAgent: Agent?
    @State private var navigateToTasks = false
    @State private var navigateToMemory = false
    @State private var navigateToSettings = false
    @EnvironmentObject private var appStore: AppStore

    init(team: Team) {
        _viewModel = State(initialValue: TeamDashboardViewState(team: team))
    }

    var body: some View {
        Group {
        if viewModel.isLoading && viewModel.agents.isEmpty {
            RelayLoadingState(message: "Loading team dashboard")
        } else if let error = viewModel.error, viewModel.agents.isEmpty {
            VStack(spacing: RelaySpacing.md) {
                RelayErrorPanel(message: error)
                Button("Try Again") { _Concurrency.Task { await viewModel.load() } }
                    .buttonStyle(RelayButtonStyle(size: .sm, variant: .secondary))
            }
            .padding(RelaySpacing.lg)
        } else {
        ScrollView {
            VStack(spacing: 0) {
                headerSection
                    .padding(.horizontal, ClawSpacing.lg)
                    .padding(.top, ClawSpacing.lg)
                    .padding(.bottom, ClawSpacing.xl)

                Divider()
                    .background(ClawColors.separator)

                statsChipsRow
                    .padding(.horizontal, ClawSpacing.lg)
                    .padding(.vertical, ClawSpacing.lg)

                Divider()
                    .background(ClawColors.separator)

                VStack(spacing: ClawSpacing.sm) {
                    liveStatusSection
                    runningTasksSection
                    blockedTasksSection
                    pendingApprovalsSection
                    recentIncidentsSection
                    performanceSummarySection
                    recentHandoversSection
                    quickActionsSection
                }
                .padding(.top, ClawSpacing.sm)
                .padding(.bottom, ClawSpacing.xxxl)
            }
        }
        }
        }
        .background(ClawColors.backgroundPrimary)
        .navigationTitle(viewModel.team.name)
        .navigationBarTitleDisplayMode(.inline)
        .task {
            viewModel.workspaceId = appStore.selectedWorkspace?.id ?? ""
            await viewModel.load()
        }
        .sheet(item: $selectedAgent) { agent in
            AgentQuickView(agent: agent)
        }
    }

    // MARK: - Header

    private var headerSection: some View {
        VStack(alignment: .leading, spacing: ClawSpacing.md) {
            // Team name + breadcrumb
            VStack(alignment: .leading, spacing: ClawSpacing.xs) {
                Text(viewModel.team.name)
                    .font(RelayFonts.screenTitle)
                    .foregroundStyle(ClawColors.textPrimary)

                HStack(spacing: ClawSpacing.xs) {
                    if let dept = viewModel.department {
                        Text(dept.name)
                            .font(ClawFonts.caption)
                            .foregroundStyle(Color(hex: dept.color))
                    }
                    if viewModel.department != nil && viewModel.company != nil {
                        Text("›")
                            .font(ClawFonts.caption)
                            .foregroundStyle(ClawColors.textTertiary)
                    }
                    if let company = viewModel.company {
                        Text(company.name)
                            .font(ClawFonts.caption)
                            .foregroundStyle(ClawColors.textSecondary)
                    }
                }
            }

            // Lead agent row
            if let lead = viewModel.leadAgent {
                HStack(spacing: ClawSpacing.md) {
                    AvatarView(name: lead.name, imageUrl: lead.avatarUrl, size: .medium, status: lead.status)

                    VStack(alignment: .leading, spacing: 2) {
                        HStack(spacing: ClawSpacing.xs) {
                            Text(lead.name)
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(ClawColors.textPrimary)
                            Text("• Lead")
                                .font(ClawFonts.caption)
                                .foregroundStyle(ClawColors.textTertiary)
                        }
                        Text(lead.role)
                            .font(ClawFonts.caption)
                            .foregroundStyle(ClawColors.textSecondary)
                    }

                    Spacer()

                    Text("\(viewModel.team.agentCount) agents")
                        .font(ClawFonts.label)
                        .foregroundStyle(ClawColors.textSecondary)
                        .padding(.horizontal, ClawSpacing.sm)
                        .padding(.vertical, ClawSpacing.xs)
                        .background(ClawColors.backgroundTertiary)
                        .clipShape(Capsule())
                }
            }
        }
    }

    // MARK: - Stats chips

    private var statsChipsRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: ClawSpacing.sm) {
                statChip(value: "\(viewModel.onDutyCount)", label: "On Duty", color: ClawColors.accentGreen)
                statChip(value: "\(viewModel.busyCount)", label: "Busy", color: ClawColors.accentOrange)
                statChip(value: "\(viewModel.runningTasks.count)", label: "Tasks Running", color: ClawColors.accent)
                statChip(value: "\(viewModel.blockedTasks.count)", label: "Blocked", color: ClawColors.accentRed)
            }
        }
    }

    private func statChip(value: String, label: String, color: Color) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(color)
            Text(label)
                .font(.system(size: 10, weight: .medium))
                .foregroundStyle(ClawColors.textSecondary)
        }
        .padding(.horizontal, ClawSpacing.md)
        .padding(.vertical, ClawSpacing.sm)
        .background(color.opacity(0.1))
        .cornerRadius(ClawRadius.md)
        .overlay(
            RoundedRectangle(cornerRadius: ClawRadius.md)
                .stroke(color.opacity(0.25), lineWidth: 0.5)
        )
    }

    // MARK: - Live Status Section

    private var liveStatusSection: some View {
        DashboardSection(title: "Live Status", icon: "dot.radiowaves.left.and.right", isExpanded: binding("status")) {
            VStack(spacing: ClawSpacing.md) {
                // Capacity bar
                capacityBar

                // Agent grid
                agentStatusGrid
            }
            .padding(.horizontal, ClawSpacing.lg)
            .padding(.bottom, ClawSpacing.md)
        }
    }

    private var capacityBar: some View {
        VStack(alignment: .leading, spacing: ClawSpacing.sm) {
            HStack {
                Text("Capacity")
                    .font(ClawFonts.label)
                    .foregroundStyle(ClawColors.textSecondary)
                Spacer()
                Text("\(viewModel.activeCount)/\(viewModel.agents.count) agents active")
                    .font(ClawFonts.caption)
                    .foregroundStyle(ClawColors.textTertiary)
            }

            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 4)
                        .fill(ClawColors.backgroundTertiary)
                        .frame(height: 8)

                    let fraction = viewModel.agents.isEmpty ? 0.0 : Double(viewModel.activeCount) / Double(viewModel.agents.count)
                    RoundedRectangle(cornerRadius: 4)
                        .fill(
                            LinearGradient(
                                colors: [ClawColors.accentGreen, ClawColors.accent],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .frame(width: geo.size.width * fraction, height: 8)
                        .animation(.easeInOut(duration: 0.5), value: fraction)
                }
            }
            .frame(height: 8)
        }
    }

    private var agentStatusGrid: some View {
        let columns = [GridItem(.adaptive(minimum: 56), spacing: ClawSpacing.sm)]
        return LazyVGrid(columns: columns, spacing: ClawSpacing.sm) {
            ForEach(viewModel.agents) { agent in
                Button {
                    selectedAgent = agent
                } label: {
                    VStack(spacing: 4) {
                        AvatarView(name: agent.name, imageUrl: agent.avatarUrl, size: .small, status: agent.status)
                        Text(agent.name.components(separatedBy: " ").first ?? agent.name)
                            .font(.system(size: 9, weight: .medium))
                            .foregroundStyle(ClawColors.textSecondary)
                            .lineLimit(1)
                    }
                    .frame(width: 56)
                }
                .buttonStyle(.plain)
            }
        }
    }

    // MARK: - Running Tasks

    private var runningTasksSection: some View {
        DashboardSection(title: "Running Tasks", icon: "play.circle.fill", badge: viewModel.runningTasks.count, isExpanded: binding("tasks")) {
            if viewModel.runningTasks.isEmpty {
                emptyState(icon: "checkmark.circle", message: "No tasks currently running")
                    .padding(.horizontal, ClawSpacing.lg)
                    .padding(.bottom, ClawSpacing.md)
            } else {
                VStack(spacing: ClawSpacing.xs) {
                    ForEach(viewModel.runningTasks) { task in
                        RunningTaskRow(task: task, agent: viewModel.agents.first { $0.id == task.assignedAgentId })
                    }
                }
                .padding(.horizontal, ClawSpacing.lg)
                .padding(.bottom, ClawSpacing.md)
            }
        }
    }

    // MARK: - Blocked Tasks

    private var blockedTasksSection: some View {
        DashboardSection(title: "Blocked / Awaiting", icon: "exclamationmark.octagon.fill", badge: viewModel.blockedTasks.count, badgeColor: ClawColors.accentRed, isExpanded: binding("blocked")) {
            if viewModel.blockedTasks.isEmpty {
                emptyState(icon: "checkmark.shield", message: "No blocked tasks")
                    .padding(.horizontal, ClawSpacing.lg)
                    .padding(.bottom, ClawSpacing.md)
            } else {
                VStack(spacing: ClawSpacing.xs) {
                    ForEach(viewModel.blockedTasks) { task in
                        BlockedTaskRow(task: task, agent: viewModel.agents.first { $0.id == task.assignedAgentId })
                    }
                }
                .padding(.horizontal, ClawSpacing.lg)
                .padding(.bottom, ClawSpacing.md)
            }
        }
    }

    // MARK: - Pending Approvals

    private var pendingApprovalsSection: some View {
        DashboardSection(title: "Pending Approvals", icon: "checkmark.seal.fill", isExpanded: binding("approvals")) {
            unsupportedDashboardState("Team approvals are not available in this dashboard yet. Open Approvals from Console.")
        }
    }

    // MARK: - Incidents

    private var recentIncidentsSection: some View {
        DashboardSection(title: "Recent Incidents", icon: "exclamationmark.triangle.fill", isExpanded: binding("incidents")) {
            unsupportedDashboardState("Team incidents are not available in this dashboard yet.")
        }
    }

    // MARK: - Performance

    private var performanceSummarySection: some View {
        DashboardSection(title: "Performance Summary", icon: "chart.line.uptrend.xyaxis", isExpanded: binding("performance")) {
            unsupportedDashboardState("Team performance snapshots are not available in this dashboard yet.")
        }
    }

    private func unsupportedDashboardState(_ detail: String) -> some View {
        RelayStatusStrip(title: "Unavailable", detail: detail, tone: .neutral, icon: "lock.fill")
            .padding(.horizontal, RelaySpacing.lg)
            .padding(.bottom, RelaySpacing.md)
    }

    private func perfMetricCard(label: String, value: String, delta: Int?, invertDelta: Bool = false, color: Color) -> some View {
        VStack(spacing: ClawSpacing.xs) {
            Text(value)
                .font(.system(size: 20, weight: .bold))
                .foregroundStyle(color)
            Text(label)
                .font(.system(size: 10, weight: .medium))
                .foregroundStyle(ClawColors.textSecondary)
                .multilineTextAlignment(.center)
            if let delta = delta {
                let positive = invertDelta ? delta < 0 : delta > 0
                let sign = delta > 0 ? "+" : ""
                Text("\(sign)\(delta)")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(positive ? ClawColors.accentGreen : (delta == 0 ? ClawColors.textTertiary : ClawColors.accentRed))
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, ClawSpacing.md)
        .background(ClawColors.backgroundTertiary)
        .cornerRadius(ClawRadius.md)
    }

    // MARK: - Handovers

    private var recentHandoversSection: some View {
        DashboardSection(title: "Recent Handovers", icon: "arrow.triangle.2.circlepath", isExpanded: binding("handovers")) {
            if viewModel.recentHandovers.isEmpty {
                emptyState(icon: "tray", message: "No recent handover notes")
                    .padding(.horizontal, ClawSpacing.lg)
                    .padding(.bottom, ClawSpacing.md)
            } else {
                VStack(spacing: ClawSpacing.xs) {
                    ForEach(viewModel.recentHandovers) { note in
                        HandoverRow(note: note, agents: viewModel.agents)
                    }
                }
                .padding(.horizontal, ClawSpacing.lg)
                .padding(.bottom, ClawSpacing.md)
            }
        }
    }

    // MARK: - Quick Actions

    private var quickActionsSection: some View {
        VStack(alignment: .leading, spacing: ClawSpacing.md) {
            RelaySectionHeader(title: "Team tools", subtitle: "Dashboard, Inbox, Memory, Handover, Settings")
                .padding(.horizontal, RelaySpacing.lg)
            RelayPanel(padding: 0) {
                NavigationLink {
                    TeamMemoryView(teamId: viewModel.team.id)
                } label: {
                    teamToolRow(title: "Team Memory", detail: "Shared rules, SOPs, context, and notes", icon: "brain")
                }
                .buttonStyle(.plain)
                Divider().overlay(RelayColors.borderLow).padding(.horizontal, RelaySpacing.md)
                NavigationLink {
                    HandoverNotesView(teamId: viewModel.team.id)
                } label: {
                    teamToolRow(title: "Handover", detail: "Read shared handover notes", icon: "arrow.triangle.2.circlepath")
                }
                .buttonStyle(.plain)
                Divider().overlay(RelayColors.borderLow).padding(.horizontal, RelaySpacing.md)
                if !viewModel.workspaceId.isEmpty {
                    NavigationLink {
                        AgentTasksView(workspaceId: viewModel.workspaceId).environmentObject(appStore)
                    } label: {
                        teamToolRow(title: "Work Task Schedule", detail: "Workspace task state grouped by agent", icon: "checklist")
                    }
                    .buttonStyle(.plain)
                } else {
                    teamToolRow(title: "Work Task Schedule", detail: "Unavailable until a Relay workspace is selected", icon: "checklist", unavailable: true)
                }
                Divider().overlay(RelayColors.borderLow).padding(.horizontal, RelaySpacing.md)
                teamToolRow(title: "Team Inbox", detail: "Unavailable in this release", icon: "tray", unavailable: true)
                Divider().overlay(RelayColors.borderLow).padding(.horizontal, RelaySpacing.md)
                teamToolRow(title: "Team Settings", detail: "Unavailable in this release", icon: "gearshape", unavailable: true)
            }
            .padding(.horizontal, RelaySpacing.lg)
        }
    }

    private func teamToolRow(title: String, detail: String, icon: String, unavailable: Bool = false) -> some View {
        HStack(spacing: RelaySpacing.md) {
            Image(systemName: icon).foregroundStyle(RelayColors.textSecondary).frame(width: RelayMetrics.iconVisualSize)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(RelayFonts.cardTitle).foregroundStyle(RelayColors.textPrimary)
                Text(detail).font(RelayFonts.caption).foregroundStyle(RelayColors.textSecondary).fixedSize(horizontal: false, vertical: true)
            }
            Spacer()
            Image(systemName: unavailable ? "lock.fill" : "chevron.right").font(.caption.bold()).foregroundStyle(RelayColors.textTertiary)
        }
        .padding(.horizontal, RelaySpacing.md)
        .frame(minHeight: 58)
        .opacity(unavailable ? 0.64 : 1)
        .accessibilityElement(children: .combine)
        .accessibilityValue(unavailable ? "Unavailable. \(detail)" : "")
    }

    // MARK: - Helpers

    private func binding(_ key: String) -> Binding<Bool> {
        Binding(
            get: { expandedSections.contains(key) },
            set: { isExpanded in
                if isExpanded { expandedSections.insert(key) }
                else { expandedSections.remove(key) }
            }
        )
    }

    private func emptyState(icon: String, message: String) -> some View {
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

// MARK: - Dashboard Section Container

struct DashboardSection<Content: View>: View {
    let title: String
    let icon: String
    var badge: Int? = nil
    var badgeColor: Color = ClawColors.accent
    @Binding var isExpanded: Bool
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(spacing: 0) {
            Button {
                withAnimation(.easeInOut(duration: 0.22)) {
                    isExpanded.toggle()
                }
            } label: {
                HStack(spacing: ClawSpacing.sm) {
                    Image(systemName: icon)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(ClawColors.textSecondary)
                        .frame(width: 20)

                    Text(title.uppercased())
                        .font(ClawFonts.sectionHeader)
                        .foregroundStyle(ClawColors.textTertiary)

                    if let badge, badge > 0 {
                        Text("\(badge)")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(badgeColor)
                            .clipShape(Capsule())
                    }

                    Spacer()

                    Image(systemName: "chevron.down")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(ClawColors.textTertiary)
                        .rotationEffect(.degrees(isExpanded ? 0 : -90))
                }
                .padding(.horizontal, ClawSpacing.lg)
                .padding(.vertical, ClawSpacing.md)
            }
            .buttonStyle(.plain)

            if isExpanded {
                content()
            }

            Divider()
                .background(ClawColors.separator)
        }
    }
}

// MARK: - Row Sub-views

struct RunningTaskRow: View {
    let task: Task
    let agent: Agent?

    var body: some View {
        HStack(spacing: ClawSpacing.md) {
            if let agent {
                AvatarView(name: agent.name, imageUrl: agent.avatarUrl, size: .small, status: agent.status)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(task.title)
                    .font(ClawFonts.cardTitle)
                    .foregroundStyle(ClawColors.textPrimary)
                    .lineLimit(1)
                if let agent {
                    Text(agent.name)
                        .font(ClawFonts.caption)
                        .foregroundStyle(ClawColors.textSecondary)
                }
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 2) {
                PriorityBadge(priority: task.priority)
                if let lastRun = task.lastRunAt {
                    Text(lastRun.relativeTime)
                        .font(ClawFonts.caption)
                        .foregroundStyle(ClawColors.textTertiary)
                }
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

struct BlockedTaskRow: View {
    let task: Task
    let agent: Agent?

    private var blockColor: Color {
        task.status == .awaitingApproval ? ClawColors.accentOrange : ClawColors.accentRed
    }

    private var blockReason: String {
        switch task.status {
        case .awaitingApproval: return "Awaiting Approval"
        case .blocked: return "Blocked"
        default: return task.status.rawValue.capitalized
        }
    }

    var body: some View {
        HStack(spacing: ClawSpacing.md) {
            Rectangle()
                .fill(blockColor)
                .frame(width: 3)
                .cornerRadius(2)

            VStack(alignment: .leading, spacing: 2) {
                Text(task.title)
                    .font(ClawFonts.cardTitle)
                    .foregroundStyle(ClawColors.textPrimary)
                    .lineLimit(1)
                HStack(spacing: ClawSpacing.xs) {
                    Image(systemName: task.status == .awaitingApproval ? "checkmark.seal" : "lock.fill")
                        .font(.system(size: 10))
                        .foregroundStyle(blockColor)
                    Text(blockReason)
                        .font(ClawFonts.caption)
                        .foregroundStyle(blockColor)
                    if let agent {
                        Text("• \(agent.name)")
                            .font(ClawFonts.caption)
                            .foregroundStyle(ClawColors.textTertiary)
                    }
                }
            }

            Spacer()

            PriorityBadge(priority: task.priority)
        }
        .padding(ClawSpacing.md)
        .background(ClawColors.backgroundCard)
        .cornerRadius(ClawRadius.md)
        .overlay(
            RoundedRectangle(cornerRadius: ClawRadius.md)
                .stroke(blockColor.opacity(0.3), lineWidth: 0.5)
        )
    }
}

struct ApprovalRow: View {
    let approval: Approval

    var body: some View {
        HStack(spacing: ClawSpacing.md) {
            Image(systemName: "checkmark.seal.fill")
                .font(.system(size: 18))
                .foregroundStyle(ClawColors.accentOrange)
                .frame(width: 28)

            VStack(alignment: .leading, spacing: 2) {
                Text(approval.title)
                    .font(ClawFonts.cardTitle)
                    .foregroundStyle(ClawColors.textPrimary)
                    .lineLimit(1)
                Text(approval.createdAt.relativeTime)
                    .font(ClawFonts.caption)
                    .foregroundStyle(ClawColors.textTertiary)
            }

            Spacer()

            RiskBadge(risk: approval.risk)
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

struct IncidentRow: View {
    let incident: Incident

    var body: some View {
        HStack(spacing: ClawSpacing.md) {
            SeverityBadge(severity: incident.severity)

            VStack(alignment: .leading, spacing: 2) {
                Text(incident.title)
                    .font(ClawFonts.cardTitle)
                    .foregroundStyle(ClawColors.textPrimary)
                    .lineLimit(1)
                Text(incident.createdAt.relativeTime)
                    .font(ClawFonts.caption)
                    .foregroundStyle(ClawColors.textTertiary)
            }

            Spacer()

            Text(incident.status.rawValue.capitalized)
                .font(ClawFonts.caption)
                .foregroundStyle(ClawColors.textSecondary)
        }
        .padding(ClawSpacing.md)
        .background(ClawColors.backgroundCard)
        .cornerRadius(ClawRadius.md)
        .overlay(
            RoundedRectangle(cornerRadius: ClawRadius.md)
                .stroke(Color.severityColor(incident.severity).opacity(0.3), lineWidth: 0.5)
        )
    }
}

struct HandoverRow: View {
    let note: HandoverNote
    let agents: [Agent]

    private var fromAgent: Agent? { agents.first { $0.id == note.fromAgentId } }
    private var toAgent: Agent? { agents.first { $0.id == note.toAgentId } }

    var body: some View {
        HStack(spacing: ClawSpacing.md) {
            // From avatar
            if let from = fromAgent {
                AvatarView(name: from.name, imageUrl: from.avatarUrl, size: .small)
            }

            Image(systemName: "arrow.right")
                .font(.system(size: 11))
                .foregroundStyle(ClawColors.textTertiary)

            // To avatar
            if let to = toAgent {
                AvatarView(name: to.name, imageUrl: to.avatarUrl, size: .small)
            } else {
                Image(systemName: "person.3.fill")
                    .font(.system(size: 14))
                    .foregroundStyle(ClawColors.textSecondary)
                    .frame(width: 28, height: 28)
                    .background(ClawColors.backgroundTertiary)
                    .clipShape(Circle())
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(note.content)
                    .font(ClawFonts.cardTitle)
                    .foregroundStyle(ClawColors.textPrimary)
                    .lineLimit(2)
                HStack(spacing: ClawSpacing.xs) {
                    Text("\(note.taskIds.count) task\(note.taskIds.count == 1 ? "" : "s")")
                        .font(ClawFonts.caption)
                        .foregroundStyle(ClawColors.textTertiary)
                    Text("•")
                        .font(ClawFonts.caption)
                        .foregroundStyle(ClawColors.textTertiary)
                    Text(note.createdAt.relativeTime)
                        .font(ClawFonts.caption)
                        .foregroundStyle(ClawColors.textTertiary)
                }
            }

            Spacer()

            if note.acknowledgedAt == nil {
                Circle()
                    .fill(ClawColors.accentOrange)
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

// MARK: - Agent Quick View Sheet

struct AgentQuickView: View {
    let agent: Agent
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            VStack(spacing: ClawSpacing.xl) {
                AvatarView(name: agent.name, imageUrl: agent.avatarUrl, size: .large, status: agent.status)
                    .padding(.top, ClawSpacing.xl)

                VStack(spacing: ClawSpacing.xs) {
                    Text(agent.name)
                        .font(ClawFonts.agentName)
                        .foregroundStyle(ClawColors.textPrimary)
                    Text(agent.role)
                        .font(ClawFonts.agentRole)
                        .foregroundStyle(ClawColors.textSecondary)
                    StatusBadge(status: agent.status)
                }

                HStack(spacing: ClawSpacing.lg) {
                    VStack {
                        Text("\(agent.tasksCompletedToday)")
                            .font(.system(size: 20, weight: .bold))
                            .foregroundStyle(ClawColors.accentGreen)
                        Text("Today")
                            .font(ClawFonts.caption)
                            .foregroundStyle(ClawColors.textSecondary)
                    }
                    VStack {
                        Text(String(format: "%.0f%%", agent.successRate * 100))
                            .font(.system(size: 20, weight: .bold))
                            .foregroundStyle(ClawColors.accent)
                        Text("Success")
                            .font(ClawFonts.caption)
                            .foregroundStyle(ClawColors.textSecondary)
                    }
                    VStack {
                        Text("\(agent.avgCompletionMinutes)m")
                            .font(.system(size: 20, weight: .bold))
                            .foregroundStyle(ClawColors.accentPurple)
                        Text("Avg Time")
                            .font(ClawFonts.caption)
                            .foregroundStyle(ClawColors.textSecondary)
                    }
                }
                .padding()
                .background(ClawColors.backgroundCard)
                .cornerRadius(ClawRadius.lg)
                .overlay(
                    RoundedRectangle(cornerRadius: ClawRadius.lg)
                        .stroke(ClawColors.separator, lineWidth: 0.5)
                )
                .padding(.horizontal, ClawSpacing.lg)

                Spacer()
            }
            .background(ClawColors.backgroundPrimary)
            .navigationTitle("Agent")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}

// MARK: - Preview

#Preview {
    NavigationStack {
        TeamDashboardView(team: Team(
            id: "t1",
            name: "Operations Alpha",
            departmentId: "d1",
            leadAgentId: "a1",
            description: "Core ops team",
            color: "#0A84FF",
            agentCount: 5,
            createdAt: Date()
        ))
    }
    .preferredColorScheme(.dark)
}
