// AgentWorkReviewView.swift
// ClawChat – Comprehensive performance review screen

import SwiftUI
import Charts

// MARK: - Review Period

private enum ReviewPeriod: String, CaseIterable {
    case today  = "Today"
    case week   = "This Week"
    case month  = "This Month"
    case custom = "Custom"
}

// MARK: - Review Tab

private enum ReviewTab: String, CaseIterable {
    case overview   = "Overview"
    case tasks      = "Tasks"
    case incidents  = "Incidents"
    case coaching   = "Coaching"
    case comparison = "Comparison"
    case evidence   = "Evidence"
}

// MARK: - Task Filter

private enum TaskFilter: String, CaseIterable {
    case all       = "All"
    case completed = "Completed"
    case failed    = "Failed"
    case retried   = "Retried"
}

// MARK: - Chart Data

private struct SuccessDataPoint: Identifiable {
    let id = UUID()
    let day: String
    let rate: Double
}

// MARK: - AgentWorkReviewView

struct AgentWorkReviewView: View {
    let agent: Agent

    @Environment(\.dismiss) private var dismiss
    @State private var selectedPeriod: ReviewPeriod = .week
    @State private var selectedTab: ReviewTab = .overview
    @State private var taskFilter: TaskFilter = .all
    @State private var searchText = ""
    @State private var showCoachingSheet = false
    @State private var comparisonAgentName = "Team Average"

    // MARK: - Mock Data

    private var chartData: [SuccessDataPoint] {
        [
            SuccessDataPoint(day: "Mon", rate: 94),
            SuccessDataPoint(day: "Tue", rate: 97),
            SuccessDataPoint(day: "Wed", rate: 91),
            SuccessDataPoint(day: "Thu", rate: 99),
            SuccessDataPoint(day: "Fri", rate: 98),
            SuccessDataPoint(day: "Sat", rate: 100),
            SuccessDataPoint(day: "Sun", rate: 96),
        ]
    }

    private var mockTasks: [Task] {
        let now = Date()
        return [
            Task(id: "t1", title: "Process invoices for Acme Corp", description: "", status: .completed,
                 priority: .high, assignedAgentId: agent.id, teamId: nil, workspaceId: agent.workspaceId,
                 createdByUserId: nil, createdByAgentId: nil, dueAt: nil,
                 completedAt: now.addingTimeInterval(-3600), createdAt: now.addingTimeInterval(-7200),
                 updatedAt: now.addingTimeInterval(-3600), tags: [], budgetUsed: 0.42,
                 estimatedMinutes: 20, actualMinutes: 18, runCount: 1, lastRunAt: nil,
                 requiresApproval: false, approvalId: nil),
            Task(id: "t2", title: "Validate vendor payment data", description: "", status: .failed,
                 priority: .high, assignedAgentId: agent.id, teamId: nil, workspaceId: agent.workspaceId,
                 createdByUserId: nil, createdByAgentId: nil, dueAt: nil, completedAt: nil,
                 createdAt: now.addingTimeInterval(-14400), updatedAt: now.addingTimeInterval(-12000), tags: [],
                 budgetUsed: 0.20, estimatedMinutes: 15, actualMinutes: nil, runCount: 3, lastRunAt: nil,
                 requiresApproval: false, approvalId: nil),
            Task(id: "t3", title: "Reconcile Q1 expense reports", description: "", status: .completed,
                 priority: .normal, assignedAgentId: agent.id, teamId: nil, workspaceId: agent.workspaceId,
                 createdByUserId: nil, createdByAgentId: nil, dueAt: nil,
                 completedAt: now.addingTimeInterval(-7200), createdAt: now.addingTimeInterval(-10800),
                 updatedAt: now.addingTimeInterval(-7200), tags: [], budgetUsed: 1.10,
                 estimatedMinutes: 30, actualMinutes: 28, runCount: 1, lastRunAt: nil,
                 requiresApproval: false, approvalId: nil),
            Task(id: "t4", title: "Send weekly financial summary", description: "", status: .completed,
                 priority: .normal, assignedAgentId: agent.id, teamId: nil, workspaceId: agent.workspaceId,
                 createdByUserId: nil, createdByAgentId: nil, dueAt: nil,
                 completedAt: now.addingTimeInterval(-18000), createdAt: now.addingTimeInterval(-21600),
                 updatedAt: now.addingTimeInterval(-18000), tags: [], budgetUsed: 0.60,
                 estimatedMinutes: 10, actualMinutes: 8, runCount: 1, lastRunAt: nil,
                 requiresApproval: false, approvalId: nil),
            Task(id: "t5", title: "Budget forecast model update", description: "", status: .completed,
                 priority: .low, assignedAgentId: agent.id, teamId: nil, workspaceId: agent.workspaceId,
                 createdByUserId: nil, createdByAgentId: nil, dueAt: nil,
                 completedAt: now.addingTimeInterval(-25200), createdAt: now.addingTimeInterval(-28800),
                 updatedAt: now.addingTimeInterval(-25200), tags: [], budgetUsed: 0.80,
                 estimatedMinutes: 25, actualMinutes: 22, runCount: 1, lastRunAt: nil,
                 requiresApproval: false, approvalId: nil),
            Task(id: "t6", title: "Cross-check supplier invoices", description: "", status: .failed,
                 priority: .high, assignedAgentId: agent.id, teamId: nil, workspaceId: agent.workspaceId,
                 createdByUserId: nil, createdByAgentId: nil, dueAt: nil, completedAt: nil,
                 createdAt: now.addingTimeInterval(-32400), updatedAt: now.addingTimeInterval(-30000), tags: [],
                 budgetUsed: 0.15, estimatedMinutes: 20, actualMinutes: nil, runCount: 2, lastRunAt: nil,
                 requiresApproval: false, approvalId: nil),
        ]
    }

    private var filteredTasks: [Task] {
        let base: [Task]
        switch taskFilter {
        case .all:       base = mockTasks
        case .completed: base = mockTasks.filter { $0.status == .completed }
        case .failed:    base = mockTasks.filter { $0.status == .failed }
        case .retried:   base = mockTasks.filter { $0.runCount > 1 }
        }
        if searchText.isEmpty { return base }
        return base.filter { $0.title.localizedCaseInsensitiveContains(searchText) }
    }

    private var mockIncidents: [Incident] {
        let now = Date()
        return [
            Incident(id: "i1", title: "Vendor API timeout", description: "Payment validation failed after 3 retries due to upstream 503",
                     status: .open, severity: .medium, agentId: agent.id, teamId: nil,
                     workspaceId: agent.workspaceId, taskId: "t2", runId: nil,
                     createdAt: now.addingTimeInterval(-12000), resolvedAt: nil, resolutionNotes: nil,
                     tags: ["api", "timeout"], affectedSystems: ["Vendor API"]),
            Incident(id: "i2", title: "Repeated parse error", description: "Invoice PDF parser failed on malformed input 2 times",
                     status: .resolved, severity: .low, agentId: agent.id, teamId: nil,
                     workspaceId: agent.workspaceId, taskId: "t6", runId: nil,
                     createdAt: now.addingTimeInterval(-86400), resolvedAt: now.addingTimeInterval(-80000), resolutionNotes: "Fixed by updating parser config",
                     tags: ["parse", "pdf"], affectedSystems: ["Invoice Parser"]),
        ]
    }

    private var mockReviews: [Review] {
        let now = Date()
        let weekAgo = now.addingTimeInterval(-604800)
        return [
            Review(id: "r1", agentId: agent.id, reviewerId: "manager1", period: .weekly,
                   periodStart: weekAgo, periodEnd: now, overallRating: 5,
                   summary: "Excellent week. Aria maintained near-perfect accuracy across all financial tasks.",
                   strengths: ["High accuracy", "Fast turnaround", "Proactive error handling"],
                   improvements: ["Could improve vendor API fallback logic"],
                   createdAt: now.addingTimeInterval(-86400)),
            Review(id: "r2", agentId: agent.id, reviewerId: "manager1", period: .monthly,
                   periodStart: now.addingTimeInterval(-2592000), periodEnd: weekAgo, overallRating: 4,
                   summary: "Strong month overall. Minor issues with retry behaviour on external APIs.",
                   strengths: ["Consistent performance", "Budget adherence"],
                   improvements: ["Retry strategy", "Escalation timing"],
                   createdAt: now.addingTimeInterval(-604800)),
        ]
    }

    private var mockCoachingNotes: [CoachingNote] {
        let now = Date()
        return [
            CoachingNote(id: "c1", agentId: agent.id, authorId: "manager1",
                         content: "Great initiative on catching the duplicate invoice entry before it was processed. Keep it up.",
                         type: .praise, relatedTaskId: "t1", createdAt: now.addingTimeInterval(-172800)),
            CoachingNote(id: "c2", agentId: agent.id, authorId: "manager1",
                         content: "When vendor APIs return 503, implement exponential back-off rather than immediate retry. This reduces wasted tokens.",
                         type: .instruction, relatedTaskId: "t2", createdAt: now.addingTimeInterval(-86400)),
            CoachingNote(id: "c3", agentId: agent.id, authorId: "manager2",
                         content: "Two failures on the supplier invoice check this week. Please review the PDF parsing configuration.",
                         type: .correction, relatedTaskId: "t6", createdAt: now.addingTimeInterval(-43200)),
        ]
    }

    private var mockWorkLogs: [WorkLog] {
        let now = Date()
        return (0..<12).map { i in
            WorkLog(id: "l\(i)", agentId: agent.id, taskId: "t\(i % 6 + 1)", runId: nil,
                    action: ["Task started", "API call", "Task completed", "Retry triggered", "Status updated"][i % 5],
                    details: "Log entry \(i + 1) for agent operations during selected period",
                    timestamp: now.addingTimeInterval(Double(-i * 3600)), durationMinutes: i % 3 == 0 ? (i + 1) * 2 : nil,
                    metadata: [:])
        }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                ClawColors.backgroundPrimary.ignoresSafeArea()

                VStack(spacing: 0) {
                    headerBar
                    tabBar
                    Divider().background(ClawColors.separator)

                    ScrollView {
                        switch selectedTab {
                        case .overview:   overviewTab
                        case .tasks:      tasksTab
                        case .incidents:  incidentsTab
                        case .coaching:   coachingTab
                        case .comparison: comparisonTab
                        case .evidence:   evidenceTab
                        }
                    }
                }
            }
            .navigationBarHidden(true)
            .sheet(isPresented: $showCoachingSheet) {
                AddCoachingNoteSheet(agentName: agent.name)
            }
        }
        .preferredColorScheme(.dark)
    }

    // MARK: - Header Bar

    private var headerBar: some View {
        HStack(spacing: ClawSpacing.md) {
            Button { dismiss() } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 16, weight: .medium))
                    .foregroundStyle(ClawColors.textSecondary)
                    .frame(width: 32, height: 32)
                    .background(ClawColors.backgroundSecondary)
                    .clipShape(Circle())
            }

            VStack(alignment: .leading, spacing: 1) {
                Text("Performance Review")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(ClawColors.textPrimary)
                Text(agent.name)
                    .font(.system(size: 13))
                    .foregroundStyle(ClawColors.textSecondary)
            }

            Spacer()

            periodSelector
        }
        .padding(.horizontal, ClawSpacing.lg)
        .padding(.vertical, ClawSpacing.md)
    }

    private var periodSelector: some View {
        Menu {
            ForEach(ReviewPeriod.allCases, id: \.self) { period in
                Button(period.rawValue) { selectedPeriod = period }
            }
        } label: {
            HStack(spacing: 4) {
                Text(selectedPeriod.rawValue)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(ClawColors.accent)
                Image(systemName: "chevron.down")
                    .font(.system(size: 10))
                    .foregroundStyle(ClawColors.accent)
            }
            .padding(.horizontal, ClawSpacing.md)
            .padding(.vertical, 7)
            .background(ClawColors.accent.opacity(0.12))
            .clipShape(Capsule())
        }
    }

    // MARK: - Tab Bar

    private var tabBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 0) {
                ForEach(ReviewTab.allCases, id: \.self) { tab in
                    Button {
                        withAnimation(.spring(response: 0.2)) {
                            selectedTab = tab
                        }
                    } label: {
                        VStack(spacing: 4) {
                            Text(tab.rawValue)
                                .font(.system(size: 13, weight: selectedTab == tab ? .semibold : .regular))
                                .foregroundStyle(selectedTab == tab ? ClawColors.accent : ClawColors.textSecondary)
                                .padding(.horizontal, ClawSpacing.md)
                                .padding(.top, ClawSpacing.sm)

                            Rectangle()
                                .fill(selectedTab == tab ? ClawColors.accent : Color.clear)
                                .frame(height: 2)
                                .cornerRadius(1)
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, ClawSpacing.sm)
        }
    }

    // MARK: - Overview Tab

    private var overviewTab: some View {
        VStack(spacing: ClawSpacing.lg) {
            headlineStatsGrid
            performanceChart
        }
        .padding(.vertical, ClawSpacing.lg)
    }

    private var headlineStatsGrid: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: ClawSpacing.sm) {
            statCard(value: "\(agent.tasksCompletedToday * 5)", label: "Tasks Completed", icon: "checkmark.circle.fill", color: ClawColors.accentGreen)
            statCard(value: String(format: "%.1f%%", agent.successRate * 100), label: "Success Rate", icon: "chart.line.uptrend.xyaxis", color: ClawColors.accent)
            statCard(value: "\(agent.avgCompletionMinutes)m", label: "Avg Completion", icon: "timer", color: ClawColors.accentTeal)
            statCard(value: "\(mockIncidents.filter { $0.status == .open }.count)", label: "Open Incidents", icon: "exclamationmark.triangle.fill", color: ClawColors.accentRed)
        }
        .padding(.horizontal, ClawSpacing.lg)
    }

    private func statCard(value: String, label: String, icon: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: ClawSpacing.xs) {
            HStack {
                Image(systemName: icon)
                    .font(.system(size: 13))
                    .foregroundStyle(color)
                Spacer()
            }
            Text(value)
                .font(.system(size: 28, weight: .bold))
                .foregroundStyle(ClawColors.textPrimary)
            Text(label)
                .font(.system(size: 12))
                .foregroundStyle(ClawColors.textSecondary)
        }
        .padding(ClawSpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(ClawColors.backgroundSecondary)
        .cornerRadius(ClawRadius.md)
        .overlay(
            RoundedRectangle(cornerRadius: ClawRadius.md)
                .stroke(color.opacity(0.25), lineWidth: 1)
        )
    }

    private var performanceChart: some View {
        VStack(alignment: .leading, spacing: ClawSpacing.md) {
            Text("SUCCESS RATE")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(ClawColors.textTertiary)
                .padding(.horizontal, ClawSpacing.lg)

            Chart(chartData) { point in
                LineMark(
                    x: .value("Day", point.day),
                    y: .value("Rate", point.rate)
                )
                .foregroundStyle(ClawColors.accent)
                .lineStyle(StrokeStyle(lineWidth: 2.5, lineCap: .round))
                .interpolationMethod(.catmullRom)

                AreaMark(
                    x: .value("Day", point.day),
                    y: .value("Rate", point.rate)
                )
                .foregroundStyle(
                    LinearGradient(
                        colors: [ClawColors.accent.opacity(0.25), ClawColors.accent.opacity(0.0)],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .interpolationMethod(.catmullRom)

                PointMark(
                    x: .value("Day", point.day),
                    y: .value("Rate", point.rate)
                )
                .foregroundStyle(ClawColors.accent)
                .symbolSize(30)
            }
            .frame(height: 160)
            .chartYScale(domain: 80...100)
            .chartYAxis {
                AxisMarks(values: [85, 90, 95, 100]) { value in
                    AxisGridLine(stroke: StrokeStyle(lineWidth: 0.5, dash: [4]))
                        .foregroundStyle(ClawColors.separator)
                    AxisValueLabel {
                        if let v = value.as(Double.self) {
                            Text("\(Int(v))%")
                                .font(.system(size: 10))
                                .foregroundStyle(ClawColors.textTertiary)
                        }
                    }
                }
            }
            .chartXAxis {
                AxisMarks { value in
                    AxisValueLabel {
                        if let v = value.as(String.self) {
                            Text(v)
                                .font(.system(size: 10))
                                .foregroundStyle(ClawColors.textTertiary)
                        }
                    }
                }
            }
            .padding(.horizontal, ClawSpacing.lg)
        }
        .padding(.vertical, ClawSpacing.md)
        .background(ClawColors.backgroundSecondary)
        .cornerRadius(ClawRadius.md)
        .padding(.horizontal, ClawSpacing.lg)
    }

    // MARK: - Tasks Tab

    private var tasksTab: some View {
        VStack(spacing: ClawSpacing.md) {
            taskSearchAndFilter
            taskList
        }
        .padding(.vertical, ClawSpacing.lg)
    }

    private var taskSearchAndFilter: some View {
        VStack(spacing: ClawSpacing.sm) {
            HStack(spacing: ClawSpacing.sm) {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(ClawColors.textTertiary)
                    .font(.system(size: 14))
                TextField("Search tasks...", text: $searchText)
                    .font(.system(size: 14))
                    .foregroundStyle(ClawColors.textPrimary)
                    .tint(ClawColors.accent)
            }
            .padding(.horizontal, ClawSpacing.md)
            .padding(.vertical, ClawSpacing.sm)
            .background(ClawColors.backgroundSecondary)
            .cornerRadius(ClawRadius.md)
            .padding(.horizontal, ClawSpacing.lg)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: ClawSpacing.sm) {
                    ForEach(TaskFilter.allCases, id: \.self) { filter in
                        Button {
                            taskFilter = filter
                        } label: {
                            Text(filter.rawValue)
                                .font(.system(size: 13, weight: taskFilter == filter ? .semibold : .regular))
                                .foregroundStyle(taskFilter == filter ? .white : ClawColors.textSecondary)
                                .padding(.horizontal, ClawSpacing.md)
                                .padding(.vertical, 7)
                                .background(taskFilter == filter ? ClawColors.accent : ClawColors.backgroundSecondary)
                                .clipShape(Capsule())
                        }
                    }
                }
                .padding(.horizontal, ClawSpacing.lg)
            }
        }
    }

    private var taskList: some View {
        VStack(spacing: 0) {
            ForEach(Array(filteredTasks.enumerated()), id: \.element.id) { idx, task in
                reviewTaskRow(task: task)
                if idx < filteredTasks.count - 1 {
                    Divider().background(ClawColors.separator).padding(.horizontal, ClawSpacing.lg)
                }
            }
        }
        .background(ClawColors.backgroundSecondary)
        .cornerRadius(ClawRadius.md)
        .padding(.horizontal, ClawSpacing.lg)
    }

    private func reviewTaskRow(task: Task) -> some View {
        HStack(spacing: ClawSpacing.md) {
            Image(systemName: taskStatusIcon(task.status))
                .font(.system(size: 18))
                .foregroundStyle(taskStatusColor(task.status))
                .frame(width: 24)

            VStack(alignment: .leading, spacing: 3) {
                Text(task.title)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(ClawColors.textPrimary)
                    .lineLimit(2)
                HStack(spacing: ClawSpacing.sm) {
                    if let mins = task.actualMinutes {
                        Label("\(mins)m", systemImage: "timer")
                            .font(.system(size: 11))
                            .foregroundStyle(ClawColors.textTertiary)
                    }
                    if task.runCount > 1 {
                        Label("\(task.runCount) runs", systemImage: "arrow.clockwise")
                            .font(.system(size: 11))
                            .foregroundStyle(ClawColors.accentOrange)
                    }
                    Text(task.createdAt.formatted(date: .abbreviated, time: .shortened))
                        .font(.system(size: 11))
                        .foregroundStyle(ClawColors.textTertiary)
                }
            }

            Spacer()

            PriorityBadge(priority: task.priority)
        }
        .padding(.horizontal, ClawSpacing.lg)
        .padding(.vertical, ClawSpacing.md)
    }

    private func taskStatusIcon(_ status: TaskStatus) -> String {
        switch status {
        case .completed:        return "checkmark.circle.fill"
        case .failed:           return "xmark.circle.fill"
        case .dispatched:       return "paperplane.circle.fill"
        case .running:          return "play.circle.fill"
        case .queued:           return "clock.circle"
        case .blocked:          return "pause.circle"
        case .awaitingApproval: return "hourglass.circle"
        case .cancelled:        return "minus.circle"
        }
    }

    private func taskStatusColor(_ status: TaskStatus) -> Color {
        switch status {
        case .completed:        return ClawColors.accentGreen
        case .failed:           return ClawColors.accentRed
        case .dispatched:       return ClawColors.accent
        case .running:          return ClawColors.accent
        case .queued:           return ClawColors.textTertiary
        case .blocked:          return ClawColors.accentOrange
        case .awaitingApproval: return ClawColors.accentOrange
        case .cancelled:        return ClawColors.textTertiary
        }
    }

    // MARK: - Incidents Tab

    private var incidentsTab: some View {
        VStack(spacing: ClawSpacing.lg) {
            incidentBreakdown
            incidentsList
        }
        .padding(.vertical, ClawSpacing.lg)
    }

    private var incidentBreakdown: some View {
        VStack(alignment: .leading, spacing: ClawSpacing.md) {
            Text("FAILURE BREAKDOWN")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(ClawColors.textTertiary)
                .padding(.horizontal, ClawSpacing.lg)

            HStack(spacing: ClawSpacing.sm) {
                breakdownCell(count: 2, label: "Timeouts", color: ClawColors.accentOrange)
                breakdownCell(count: 1, label: "Parse Errors", color: ClawColors.accentRed)
                breakdownCell(count: 3, label: "Retries", color: ClawColors.accentPurple)
            }
            .padding(.horizontal, ClawSpacing.lg)

            if mockTasks.filter({ $0.runCount > 1 }).count >= 2 {
                HStack(spacing: ClawSpacing.sm) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundStyle(ClawColors.accentOrange)
                        .font(.system(size: 12))
                    Text("Repeated failures detected on external API tasks")
                        .font(.system(size: 13))
                        .foregroundStyle(ClawColors.accentOrange)
                }
                .padding(.horizontal, ClawSpacing.md)
                .padding(.vertical, ClawSpacing.sm)
                .background(ClawColors.accentOrange.opacity(0.1))
                .cornerRadius(ClawRadius.sm)
                .overlay(
                    RoundedRectangle(cornerRadius: ClawRadius.sm)
                        .stroke(ClawColors.accentOrange.opacity(0.3), lineWidth: 1)
                )
                .padding(.horizontal, ClawSpacing.lg)
            }
        }
    }

    private func breakdownCell(count: Int, label: String, color: Color) -> some View {
        VStack(spacing: 4) {
            Text("\(count)")
                .font(.system(size: 24, weight: .bold))
                .foregroundStyle(color)
            Text(label)
                .font(.system(size: 11))
                .foregroundStyle(ClawColors.textSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, ClawSpacing.md)
        .background(ClawColors.backgroundSecondary)
        .cornerRadius(ClawRadius.md)
    }

    private var incidentsList: some View {
        VStack(spacing: ClawSpacing.sm) {
            ForEach(mockIncidents) { incident in
                incidentRow(incident: incident)
            }
        }
        .padding(.horizontal, ClawSpacing.lg)
    }

    private func incidentRow(incident: Incident) -> some View {
        VStack(alignment: .leading, spacing: ClawSpacing.sm) {
            HStack {
                Text(incident.title)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(ClawColors.textPrimary)
                Spacer()
                SeverityBadge(severity: incident.severity)
            }
            Text(incident.description)
                .font(.system(size: 13))
                .foregroundStyle(ClawColors.textSecondary)

            HStack(spacing: ClawSpacing.md) {
                Label(incident.createdAt.formatted(date: .abbreviated, time: .shortened), systemImage: "clock")
                    .font(.system(size: 11))
                    .foregroundStyle(ClawColors.textTertiary)
                if let resolved = incident.resolvedAt {
                    Label("Resolved \(resolved.formatted(.relative(presentation: .named)))", systemImage: "checkmark.circle")
                        .font(.system(size: 11))
                        .foregroundStyle(ClawColors.accentGreen)
                } else {
                    Label("Open", systemImage: "exclamationmark.circle")
                        .font(.system(size: 11))
                        .foregroundStyle(ClawColors.accentRed)
                }
            }
        }
        .padding(ClawSpacing.md)
        .background(ClawColors.backgroundSecondary)
        .cornerRadius(ClawRadius.md)
        .overlay(
            RoundedRectangle(cornerRadius: ClawRadius.md)
                .stroke(Color.severityColor(incident.severity).opacity(0.3), lineWidth: 1)
        )
    }

    // MARK: - Coaching Tab

    private var coachingTab: some View {
        VStack(spacing: ClawSpacing.lg) {
            reviewsList
            coachingNotesList
            Button {
                showCoachingSheet = true
            } label: {
                HStack {
                    Image(systemName: "plus.circle.fill")
                    Text("Add Coaching Note")
                }
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, ClawSpacing.md)
                .background(ClawColors.accent)
                .cornerRadius(ClawRadius.md)
            }
            .buttonStyle(.plain)
            .padding(.horizontal, ClawSpacing.lg)
            .padding(.bottom, ClawSpacing.lg)
        }
        .padding(.top, ClawSpacing.lg)
    }

    private var reviewsList: some View {
        VStack(alignment: .leading, spacing: ClawSpacing.md) {
            Text("FORMAL REVIEWS")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(ClawColors.textTertiary)
                .padding(.horizontal, ClawSpacing.lg)

            ForEach(mockReviews) { review in
                reviewCard(review: review)
            }
        }
    }

    private func reviewCard(review: Review) -> some View {
        VStack(alignment: .leading, spacing: ClawSpacing.md) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(review.period.rawValue.capitalized + " Review")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(ClawColors.textPrimary)
                    Text(review.createdAt.formatted(date: .abbreviated, time: .omitted))
                        .font(.system(size: 12))
                        .foregroundStyle(ClawColors.textTertiary)
                }
                Spacer()
                starRating(review.overallRating)
            }

            Text(review.summary)
                .font(.system(size: 13))
                .foregroundStyle(ClawColors.textSecondary)

            HStack(alignment: .top, spacing: ClawSpacing.xl) {
                if !review.strengths.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Strengths")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(ClawColors.accentGreen)
                        ForEach(review.strengths, id: \.self) { s in
                            HStack(spacing: 4) {
                                Circle().fill(ClawColors.accentGreen).frame(width: 4, height: 4)
                                Text(s).font(.system(size: 12)).foregroundStyle(ClawColors.textSecondary)
                            }
                        }
                    }
                }
                if !review.improvements.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Improve")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(ClawColors.accentOrange)
                        ForEach(review.improvements, id: \.self) { i in
                            HStack(spacing: 4) {
                                Circle().fill(ClawColors.accentOrange).frame(width: 4, height: 4)
                                Text(i).font(.system(size: 12)).foregroundStyle(ClawColors.textSecondary)
                            }
                        }
                    }
                }
            }
        }
        .padding(ClawSpacing.md)
        .background(ClawColors.backgroundSecondary)
        .cornerRadius(ClawRadius.md)
        .padding(.horizontal, ClawSpacing.lg)
    }

    private func starRating(_ rating: Int) -> some View {
        HStack(spacing: 2) {
            ForEach(1...5, id: \.self) { i in
                Image(systemName: i <= rating ? "star.fill" : "star")
                    .font(.system(size: 12))
                    .foregroundStyle(i <= rating ? ClawColors.accentOrange : ClawColors.textTertiary)
            }
        }
    }

    private var coachingNotesList: some View {
        VStack(alignment: .leading, spacing: ClawSpacing.md) {
            Text("COACHING NOTES")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(ClawColors.textTertiary)
                .padding(.horizontal, ClawSpacing.lg)

            ForEach(mockCoachingNotes) { note in
                coachingNoteCard(note: note)
            }
        }
    }

    private func coachingNoteCard(note: CoachingNote) -> some View {
        VStack(alignment: .leading, spacing: ClawSpacing.sm) {
            HStack {
                coachingTypeBadge(note.type)
                Spacer()
                Text(note.createdAt.formatted(.relative(presentation: .named)))
                    .font(.system(size: 11))
                    .foregroundStyle(ClawColors.textTertiary)
            }
            Text(note.content)
                .font(.system(size: 13))
                .foregroundStyle(ClawColors.textSecondary)
        }
        .padding(ClawSpacing.md)
        .background(ClawColors.backgroundSecondary)
        .cornerRadius(ClawRadius.md)
        .overlay(
            RoundedRectangle(cornerRadius: ClawRadius.md)
                .stroke(coachingTypeColor(note.type).opacity(0.3), lineWidth: 1)
        )
        .padding(.horizontal, ClawSpacing.lg)
    }

    private func coachingTypeBadge(_ type: CoachingType) -> some View {
        HStack(spacing: 4) {
            Image(systemName: coachingTypeIcon(type))
                .font(.system(size: 10))
            Text(coachingTypeLabel(type))
                .font(.system(size: 12, weight: .semibold))
        }
        .foregroundStyle(coachingTypeColor(type))
        .padding(.horizontal, ClawSpacing.sm)
        .padding(.vertical, 3)
        .background(coachingTypeColor(type).opacity(0.15))
        .clipShape(Capsule())
    }

    private func coachingTypeIcon(_ type: CoachingType) -> String {
        switch type {
        case .correction:   return "arrow.uturn.left"
        case .improvement:  return "arrow.up.circle"
        case .praise:       return "star.fill"
        case .instruction:  return "text.badge.plus"
        case .warning:      return "exclamationmark.triangle.fill"
        }
    }

    private func coachingTypeLabel(_ type: CoachingType) -> String {
        switch type {
        case .correction:   return "Correction"
        case .improvement:  return "Improvement"
        case .praise:       return "Praise"
        case .instruction:  return "Instruction"
        case .warning:      return "Warning"
        }
    }

    private func coachingTypeColor(_ type: CoachingType) -> Color {
        switch type {
        case .correction:   return ClawColors.accentOrange
        case .improvement:  return ClawColors.accent
        case .praise:       return ClawColors.accentGreen
        case .instruction:  return ClawColors.accentTeal
        case .warning:      return ClawColors.accentRed
        }
    }

    // MARK: - Comparison Tab

    private var comparisonTab: some View {
        VStack(spacing: ClawSpacing.lg) {
            VStack(alignment: .leading, spacing: ClawSpacing.sm) {
                Text("COMPARING WITH")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(ClawColors.textTertiary)
                    .padding(.horizontal, ClawSpacing.lg)

                HStack(spacing: ClawSpacing.md) {
                    Text(comparisonAgentName)
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(ClawColors.textPrimary)
                    Spacer()
                    Button {
                        comparisonAgentName = "Team Average"
                    } label: {
                        Text("Change")
                            .font(.system(size: 13))
                            .foregroundStyle(ClawColors.accent)
                    }
                }
                .padding(.horizontal, ClawSpacing.lg)
            }
            .padding(.top, ClawSpacing.md)

            comparisonGrid
        }
    }

    private var comparisonGrid: some View {
        VStack(spacing: 0) {
            comparisonHeader
            Divider().background(ClawColors.separator)
            comparisonRow(label: "Tasks Completed", agentValue: "\(agent.tasksCompletedToday * 5)", teamValue: "38", agentBetter: agent.tasksCompletedToday * 5 >= 38)
            Divider().background(ClawColors.separator)
            comparisonRow(label: "Success Rate", agentValue: String(format: "%.1f%%", agent.successRate * 100), teamValue: "93.4%", agentBetter: agent.successRate > 0.934)
            Divider().background(ClawColors.separator)
            comparisonRow(label: "Avg Completion", agentValue: "\(agent.avgCompletionMinutes)m", teamValue: "8m", agentBetter: agent.avgCompletionMinutes <= 8)
            Divider().background(ClawColors.separator)
            comparisonRow(label: "Incidents", agentValue: "\(mockIncidents.count)", teamValue: "2", agentBetter: mockIncidents.count <= 2)
            Divider().background(ClawColors.separator)
            comparisonRow(label: "Budget Used", agentValue: String(format: "$%.2f", agent.budgetUsed), teamValue: "$6.50", agentBetter: agent.budgetUsed <= 6.50)
        }
        .background(ClawColors.backgroundSecondary)
        .cornerRadius(ClawRadius.md)
        .padding(.horizontal, ClawSpacing.lg)
    }

    private var comparisonHeader: some View {
        HStack {
            Text("Metric").font(.system(size: 12, weight: .semibold)).foregroundStyle(ClawColors.textTertiary)
            Spacer()
            Text(agent.name.components(separatedBy: " ").first ?? "Agent")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(ClawColors.accent)
            Spacer().frame(width: 20)
            Text(comparisonAgentName.components(separatedBy: " ").first ?? "Team")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(ClawColors.textTertiary)
        }
        .padding(.horizontal, ClawSpacing.md)
        .padding(.vertical, ClawSpacing.sm)
    }

    private func comparisonRow(label: String, agentValue: String, teamValue: String, agentBetter: Bool) -> some View {
        HStack {
            Text(label)
                .font(.system(size: 13))
                .foregroundStyle(ClawColors.textSecondary)
            Spacer()
            Text(agentValue)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(agentBetter ? ClawColors.accentGreen : ClawColors.accentRed)
            Image(systemName: agentBetter ? "arrow.up" : "arrow.down")
                .font(.system(size: 9))
                .foregroundStyle(agentBetter ? ClawColors.accentGreen : ClawColors.accentRed)
                .frame(width: 12)
            Text(teamValue)
                .font(.system(size: 13))
                .foregroundStyle(ClawColors.textTertiary)
        }
        .padding(.horizontal, ClawSpacing.md)
        .padding(.vertical, ClawSpacing.sm)
    }

    // MARK: - Evidence Tab

    private var evidenceTab: some View {
        VStack(spacing: ClawSpacing.md) {
            HStack(spacing: ClawSpacing.sm) {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(ClawColors.textTertiary)
                    .font(.system(size: 14))
                TextField("Search logs...", text: $searchText)
                    .font(.system(size: 14))
                    .foregroundStyle(ClawColors.textPrimary)
                    .tint(ClawColors.accent)
            }
            .padding(.horizontal, ClawSpacing.md)
            .padding(.vertical, ClawSpacing.sm)
            .background(ClawColors.backgroundSecondary)
            .cornerRadius(ClawRadius.md)
            .padding(.horizontal, ClawSpacing.lg)
            .padding(.top, ClawSpacing.md)

            let logs = mockWorkLogs.filter {
                searchText.isEmpty ||
                $0.action.localizedCaseInsensitiveContains(searchText) ||
                $0.details.localizedCaseInsensitiveContains(searchText)
            }

            VStack(spacing: 0) {
                ForEach(Array(logs.enumerated()), id: \.element.id) { idx, log in
                    evidenceRow(log: log)
                    if idx < logs.count - 1 {
                        Divider().background(ClawColors.separator).padding(.horizontal, ClawSpacing.lg)
                    }
                }
            }
            .background(ClawColors.backgroundSecondary)
            .cornerRadius(ClawRadius.md)
            .padding(.horizontal, ClawSpacing.lg)
            .padding(.bottom, ClawSpacing.lg)
        }
    }

    private func evidenceRow(log: WorkLog) -> some View {
        HStack(alignment: .top, spacing: ClawSpacing.md) {
            Text(log.timestamp.formatted(date: .omitted, time: .shortened))
                .font(.system(size: 11, design: .monospaced))
                .foregroundStyle(ClawColors.textTertiary)
                .frame(width: 55, alignment: .leading)

            VStack(alignment: .leading, spacing: 2) {
                Text(log.action)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(ClawColors.textPrimary)
                Text(log.details)
                    .font(.system(size: 12))
                    .foregroundStyle(ClawColors.textSecondary)
                    .lineLimit(2)
            }
        }
        .padding(.horizontal, ClawSpacing.lg)
        .padding(.vertical, ClawSpacing.sm)
    }
}

// MARK: - Add Coaching Note Sheet

struct AddCoachingNoteSheet: View {
    let agentName: String

    @Environment(\.dismiss) private var dismiss
    @State private var selectedType: CoachingType = .instruction
    @State private var noteText = ""
    @State private var isSaving = false

    var body: some View {
        NavigationStack {
            ZStack {
                ClawColors.backgroundPrimary.ignoresSafeArea()

                VStack(alignment: .leading, spacing: ClawSpacing.xl) {
                    noteTypeSelector
                    noteEditor
                    Spacer()
                    saveButton
                }
                .padding(ClawSpacing.lg)
            }
            .navigationTitle("Add Coaching Note")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(ClawColors.backgroundSecondary, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(ClawColors.textSecondary)
                }
            }
        }
        .preferredColorScheme(.dark)
    }

    private var noteTypeSelector: some View {
        VStack(alignment: .leading, spacing: ClawSpacing.sm) {
            Text("NOTE TYPE")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(ClawColors.textTertiary)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: ClawSpacing.sm) {
                    ForEach(CoachingType.allCases, id: \.self) { type in
                        Button {
                            selectedType = type
                        } label: {
                            HStack(spacing: 5) {
                                Image(systemName: coachingTypeIcon(type))
                                    .font(.system(size: 12))
                                Text(coachingTypeLabel(type))
                                    .font(.system(size: 13, weight: selectedType == type ? .semibold : .regular))
                            }
                            .foregroundStyle(selectedType == type ? .white : coachingTypeColor(type))
                            .padding(.horizontal, ClawSpacing.md)
                            .padding(.vertical, 8)
                            .background(selectedType == type ? coachingTypeColor(type) : coachingTypeColor(type).opacity(0.15))
                            .clipShape(Capsule())
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    private var noteEditor: some View {
        VStack(alignment: .leading, spacing: ClawSpacing.sm) {
            Text("NOTE")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(ClawColors.textTertiary)

            TextEditor(text: $noteText)
                .font(.system(size: 15))
                .foregroundStyle(ClawColors.textPrimary)
                .tint(ClawColors.accent)
                .scrollContentBackground(.hidden)
                .background(Color.clear)
                .frame(minHeight: 160)
                .padding(ClawSpacing.md)
                .background(ClawColors.backgroundSecondary)
                .cornerRadius(ClawRadius.md)
                .overlay(
                    Group {
                        if noteText.isEmpty {
                            Text("Write your coaching note for \(agentName)...")
                                .font(.system(size: 15))
                                .foregroundStyle(ClawColors.textTertiary)
                                .padding(.horizontal, ClawSpacing.md + 4)
                                .padding(.top, ClawSpacing.md + 4)
                                .allowsHitTesting(false)
                                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                        }
                    }
                )
        }
    }

    private var saveButton: some View {
        Button {
            guard !noteText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
            isSaving = true
            _Concurrency.Task {
                try? await _Concurrency.Task.sleep(nanoseconds: 600_000_000)
                await MainActor.run {
                    isSaving = false
                    dismiss()
                }
            }
        } label: {
            Group {
                if isSaving {
                    ProgressView()
                        .tint(.white)
                } else {
                    Text("Save Note")
                        .font(.system(size: 16, weight: .semibold))
                }
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, ClawSpacing.md)
            .background(noteText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? ClawColors.backgroundTertiary : ClawColors.accent)
            .cornerRadius(ClawRadius.md)
        }
        .buttonStyle(.plain)
        .disabled(noteText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isSaving)
    }

    private func coachingTypeIcon(_ type: CoachingType) -> String {
        switch type {
        case .correction:   return "arrow.uturn.left"
        case .improvement:  return "arrow.up.circle"
        case .praise:       return "star.fill"
        case .instruction:  return "text.badge.plus"
        case .warning:      return "exclamationmark.triangle.fill"
        }
    }

    private func coachingTypeLabel(_ type: CoachingType) -> String {
        switch type {
        case .correction:   return "Correction"
        case .improvement:  return "Improvement"
        case .praise:       return "Praise"
        case .instruction:  return "Instruction"
        case .warning:      return "Warning"
        }
    }

    private func coachingTypeColor(_ type: CoachingType) -> Color {
        switch type {
        case .correction:   return ClawColors.accentOrange
        case .improvement:  return ClawColors.accent
        case .praise:       return ClawColors.accentGreen
        case .instruction:  return ClawColors.accentTeal
        case .warning:      return ClawColors.accentRed
        }
    }
}

extension CoachingType: CaseIterable {
    public static let allCases: [CoachingType] = [.praise, .instruction, .improvement, .correction, .warning]
}

// MARK: - Preview

#Preview {
    AgentWorkReviewView(agent: {
        let now = Date()
        return Agent(id: "1", name: "Aria Finance", role: "Finance Analyst", avatarUrl: nil, status: .onDuty,
                     teamId: "t1", departmentId: "d1", companyId: "c1", workspaceId: "w1", managerId: nil,
                     description: nil, capabilities: [], workingHoursMode: .scheduled, timezone: "UTC",
                     createdAt: now, updatedAt: now, currentTaskId: nil, tasksCompletedToday: 12,
                     successRate: 0.982, avgCompletionMinutes: 4, totalMinutesWorked: 372, budgetUsed: 4.21, budgetLimit: 50)
    }())
}
