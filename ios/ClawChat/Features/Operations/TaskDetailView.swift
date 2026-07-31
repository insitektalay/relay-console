// TaskDetailView.swift
// ClawChat – Operations: Comprehensive task detail

import SwiftUI
import Combine

// MARK: - ViewModel

@MainActor
final class TaskDetailViewState: ObservableObject {
    @Published var task: Task
    @Published var runs: [Run] = []
    @Published var workLogs: [WorkLog] = []
    @Published var selectedRun: Run? = nil
    @Published var showRunEvents: Bool = false
    @Published var isChangingStatus: Bool = false
    @Published var approveNotes: String = ""
    @Published var rejectNotes: String = ""
    @Published var showApproveSheet: Bool = false
    @Published var showRejectSheet: Bool = false
    @Published var isActioning: Bool = false
    @Published var liveTimerTick: Date = Date()

    private var timerTask: _Concurrency.Task<Void, Never>?

    init(task: Task) {
        self.task = task
        startTimer()
    }

    deinit { timerTask?.cancel() }

    func startTimer() {
        timerTask = _Concurrency.Task { [weak self] in
            while !_Concurrency.Task.isCancelled {
                try? await _Concurrency.Task.sleep(nanoseconds: 1_000_000_000)
                await MainActor.run { self?.liveTimerTick = Date() }
            }
        }
    }

    func loadRuns() async {
        do {
            let response: PaginatedResponse<Run> = try await APIClient.shared.requestPaginated(
                .taskRuns(taskId: task.id, page: 1)
            )
            await MainActor.run { self.runs = response.data }
        } catch {
            // non-fatal — leave runs empty
        }
    }

    func loadWorkLogs() async {
        do {
            let response: PaginatedResponse<WorkLog> = try await APIClient.shared.requestPaginated(
                .workLogs(workspaceId: task.workspaceId, agentId: task.assignedAgentId, teamId: task.teamId, page: 1)
            )
            await MainActor.run { self.workLogs = response.data.filter { $0.taskId == self.task.id } }
        } catch {
            // non-fatal
        }
    }

    var runCount: Int { runs.count }

    var totalMinutes: Int {
        runs.compactMap { run -> Int? in
            guard let end = run.completedAt else { return nil }
            return Int(end.timeIntervalSince(run.startedAt) / 60)
        }.reduce(0, +)
    }

    var totalCost: Double { runs.map(\.cost).reduce(0, +) }

    var lastRunRelative: String? {
        guard let last = task.lastRunAt else { return nil }
        return last.relativeTime
    }

    var runningDuration: String? {
        guard task.status == .running, let lastRun = task.lastRunAt else { return nil }
        let elapsed = Int(Date().timeIntervalSince(lastRun))
        let m = elapsed / 60
        let s = elapsed % 60
        return "\(m)m \(String(format: "%02d", s))s"
    }

    func runDuration(_ run: Run) -> String {
        guard let end = run.completedAt else { return "—" }
        let secs = Int(end.timeIntervalSince(run.startedAt))
        let m = secs / 60
        let s = secs % 60
        return "\(m)m \(s)s"
    }

}

// MARK: - View

struct TaskDetailView: View {
    let task: Task
    @StateObject private var vm: TaskDetailViewState
    @Environment(\.dismiss) private var dismiss

    init(task: Task) {
        self.task = task
        _vm = StateObject(wrappedValue: TaskDetailViewState(task: task))
    }

    var body: some View {
        NavigationStack {
            ZStack {
                ClawColors.backgroundPrimary.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: ClawSpacing.lg) {
                        headerSection
                        statusTimelineSection
                        descriptionSection
                        executionInfoSection
                        actionSection
                        runsHistorySection
                        workLogsSection
                    }
                    .padding(.horizontal, ClawSpacing.lg)
                    .padding(.top, ClawSpacing.md)
                    .padding(.bottom, ClawSpacing.xxxl)
                }
            }
            .navigationTitle("Task Detail")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(ClawColors.backgroundPrimary, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Close") { dismiss() }
                        .foregroundStyle(ClawColors.accent)
                }
            }
            .sheet(item: $vm.selectedRun) { run in
                RunEventsView(run: run)
            }
            .task {
                async let runs: () = vm.loadRuns()
                async let logs: () = vm.loadWorkLogs()
                _ = await (runs, logs)
            }
        }
        .presentationBackground(ClawColors.backgroundPrimary)
    }

    // MARK: - Header

    private var headerSection: some View {
        VStack(alignment: .leading, spacing: ClawSpacing.md) {
            Text(vm.task.title)
                .font(.system(size: 22, weight: .bold))
                .foregroundStyle(ClawColors.textPrimary)

            HStack(spacing: ClawSpacing.sm) {
                let (statusLabel, statusColor) = vm.task.status.displayInfo
                Text(statusLabel)
                    .font(ClawFonts.label)
                    .foregroundStyle(statusColor)
                    .padding(.horizontal, ClawSpacing.md)
                    .padding(.vertical, ClawSpacing.xs)
                    .background(statusColor.opacity(0.15))
                    .clipShape(Capsule())

                PriorityBadge(priority: vm.task.priority)

                Spacer()

                if let duration = vm.runningDuration {
                    HStack(spacing: 4) {
                        Circle().fill(ClawColors.accentRed).frame(width: 6, height: 6)
                        Text(duration)
                            .font(.system(size: 12, weight: .medium, design: .monospaced))
                            .foregroundStyle(ClawColors.accentRed)
                    }
                    .id(vm.liveTimerTick)
                }
            }

            // Agent row
            HStack(spacing: ClawSpacing.sm) {
                AvatarView(name: vm.task.assignedAgentId ?? "Unassigned", imageUrl: nil, size: .small)
                Text(vm.task.assignedAgentId ?? "Unassigned")
                    .font(ClawFonts.label)
                    .foregroundStyle(ClawColors.textSecondary)
                Image(systemName: "chevron.right")
                    .font(.system(size: 10))
                    .foregroundStyle(ClawColors.textTertiary)

                Spacer()

                if let due = vm.task.dueAt {
                    let isOverdue = due < Date() && vm.task.status != .completed
                    Label(due.chatTimestamp, systemImage: "calendar")
                        .font(ClawFonts.caption)
                        .foregroundStyle(isOverdue ? ClawColors.accentRed : ClawColors.textTertiary)
                }
            }

            if !vm.task.tags.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: ClawSpacing.xs) {
                        ForEach(vm.task.tags, id: \.self) { tag in
                            Text("#\(tag)")
                                .font(ClawFonts.caption)
                                .foregroundStyle(ClawColors.accent)
                                .padding(.horizontal, ClawSpacing.sm)
                                .padding(.vertical, 3)
                                .background(ClawColors.accent.opacity(0.12))
                                .clipShape(Capsule())
                        }
                    }
                }
            }
        }
        .padding(ClawSpacing.lg)
        .background(ClawColors.backgroundCard)
        .cornerRadius(ClawRadius.card)
        .overlay(RoundedRectangle(cornerRadius: ClawRadius.card).stroke(ClawColors.separator, lineWidth: 0.5))
    }

    // MARK: - Status Timeline

    private var statusTimelineSection: some View {
        VStack(alignment: .leading, spacing: ClawSpacing.md) {
            Text("Status Timeline")
                .font(ClawFonts.sectionHeader)
                .foregroundStyle(ClawColors.textSecondary)
                .textCase(.uppercase)

            let steps: [(String, Date?, Bool)] = [
                ("Created",   vm.task.createdAt,   true),
                ("Queued",    vm.task.createdAt,   vm.task.status != .queued),
                ("Running",   vm.task.lastRunAt,   [.running, .completed, .failed].contains(vm.task.status)),
                ("Completed", vm.task.completedAt, vm.task.status == .completed),
            ]

            HStack(alignment: .top, spacing: 0) {
                ForEach(Array(steps.enumerated()), id: \.offset) { index, step in
                    VStack(spacing: ClawSpacing.xs) {
                        ZStack {
                            Circle()
                                .fill(step.2 ? ClawColors.accent : ClawColors.backgroundTertiary)
                                .frame(width: 24, height: 24)
                            if step.2 {
                                Image(systemName: "checkmark")
                                    .font(.system(size: 10, weight: .bold))
                                    .foregroundStyle(.white)
                            }
                        }

                        Text(step.0)
                            .font(.system(size: 10, weight: .medium))
                            .foregroundStyle(step.2 ? ClawColors.textPrimary : ClawColors.textTertiary)
                            .multilineTextAlignment(.center)

                        if let date = step.1, step.2 {
                            Text(date.timeOnly)
                                .font(.system(size: 9))
                                .foregroundStyle(ClawColors.textTertiary)
                        }
                    }
                    .frame(maxWidth: .infinity)

                    if index < steps.count - 1 {
                        Rectangle()
                            .fill(steps[index + 1].2 ? ClawColors.accent : ClawColors.backgroundTertiary)
                            .frame(height: 2)
                            .offset(y: -20)
                    }
                }
            }
        }
        .padding(ClawSpacing.lg)
        .background(ClawColors.backgroundCard)
        .cornerRadius(ClawRadius.card)
        .overlay(RoundedRectangle(cornerRadius: ClawRadius.card).stroke(ClawColors.separator, lineWidth: 0.5))
    }

    // MARK: - Description

    private var descriptionSection: some View {
        VStack(alignment: .leading, spacing: ClawSpacing.sm) {
            Text("Description")
                .font(ClawFonts.sectionHeader)
                .foregroundStyle(ClawColors.textSecondary)
                .textCase(.uppercase)

            Text(vm.task.description.isEmpty ? "No description provided." : vm.task.description)
                .font(ClawFonts.cardBody)
                .foregroundStyle(vm.task.description.isEmpty ? ClawColors.textTertiary : ClawColors.textPrimary)
                .lineSpacing(4)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(ClawSpacing.lg)
        .background(ClawColors.backgroundCard)
        .cornerRadius(ClawRadius.card)
        .overlay(RoundedRectangle(cornerRadius: ClawRadius.card).stroke(ClawColors.separator, lineWidth: 0.5))
    }

    // MARK: - Execution Info

    private var executionInfoSection: some View {
        VStack(alignment: .leading, spacing: ClawSpacing.md) {
            Text("Execution")
                .font(ClawFonts.sectionHeader)
                .foregroundStyle(ClawColors.textSecondary)
                .textCase(.uppercase)

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: ClawSpacing.md) {
                executionStatCell(label: "Runs", value: "\(vm.runCount)", icon: "arrow.trianglehead.2.clockwise.rotate.90")
                executionStatCell(label: "Total Time", value: "\(vm.totalMinutes)m", icon: "clock")
                executionStatCell(label: "Budget Used", value: String(format: "$%.2f", vm.totalCost), icon: "dollarsign.circle")
                executionStatCell(label: "Last Run", value: vm.lastRunRelative ?? "Never", icon: "calendar.badge.clock")
            }
        }
        .padding(ClawSpacing.lg)
        .background(ClawColors.backgroundCard)
        .cornerRadius(ClawRadius.card)
        .overlay(RoundedRectangle(cornerRadius: ClawRadius.card).stroke(ClawColors.separator, lineWidth: 0.5))
    }

    private func executionStatCell(label: String, value: String, icon: String) -> some View {
        HStack(spacing: ClawSpacing.sm) {
            Image(systemName: icon)
                .font(.system(size: 14))
                .foregroundStyle(ClawColors.accent)
                .frame(width: 24)

            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(.system(size: 10, weight: .medium))
                    .foregroundStyle(ClawColors.textTertiary)
                Text(value)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(ClawColors.textPrimary)
            }
            Spacer()
        }
        .padding(ClawSpacing.md)
        .background(ClawColors.backgroundTertiary)
        .cornerRadius(ClawRadius.sm)
    }

    // MARK: - Actions

    @ViewBuilder
    private var actionSection: some View {
        if ![TaskStatus.completed, .cancelled].contains(vm.task.status) {
            RelayStatusStrip(
                title: "Task action unavailable",
                detail: vm.task.status == .awaitingApproval
                    ? "Review and decide the matching retained request in Approvals. This detail view does not resolve approvals."
                    : "The Relay service does not currently support run, cancel, retry, investigate, or force-continue actions from this detail view.",
                tone: .warning,
                icon: "lock.shield"
            )
        }
    }

    // MARK: - Runs History

    private var runsHistorySection: some View {
        VStack(alignment: .leading, spacing: ClawSpacing.md) {
            Text("Run History")
                .font(ClawFonts.sectionHeader)
                .foregroundStyle(ClawColors.textSecondary)
                .textCase(.uppercase)

            if vm.runs.isEmpty {
                Text("No runs yet.")
                    .font(ClawFonts.cardBody)
                    .foregroundStyle(ClawColors.textTertiary)
            } else {
                ForEach(vm.runs) { run in
                    runRow(run: run)
                    if run.id != vm.runs.last?.id {
                        Divider().background(ClawColors.separatorLight)
                    }
                }
            }
        }
        .padding(ClawSpacing.lg)
        .background(ClawColors.backgroundCard)
        .cornerRadius(ClawRadius.card)
        .overlay(RoundedRectangle(cornerRadius: ClawRadius.card).stroke(ClawColors.separator, lineWidth: 0.5))
    }

    private func runRow(run: Run) -> some View {
        Button {
            vm.selectedRun = run
        } label: {
            HStack(spacing: ClawSpacing.md) {
                runStatusIcon(run.status)

                VStack(alignment: .leading, spacing: 2) {
                    Text("Run #\(run.id.prefix(6))")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(ClawColors.textPrimary)
                    Text(run.startedAt.fullTimestamp)
                        .font(ClawFonts.caption)
                        .foregroundStyle(ClawColors.textSecondary)
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 2) {
                    Text(vm.runDuration(run))
                        .font(ClawFonts.caption)
                        .foregroundStyle(ClawColors.textSecondary)
                    Text(String(format: "$%.3f", run.cost))
                        .font(ClawFonts.caption)
                        .foregroundStyle(ClawColors.textTertiary)
                }

                Image(systemName: "chevron.right")
                    .font(.system(size: 11))
                    .foregroundStyle(ClawColors.textTertiary)
            }
            .padding(.vertical, ClawSpacing.xs)
        }
        .buttonStyle(.plain)
    }

    private func runStatusIcon(_ status: RunStatus) -> some View {
        let (icon, color): (String, Color) = {
            switch status {
            case .running:   return ("play.circle.fill",       ClawColors.accentGreen)
            case .completed: return ("checkmark.circle.fill",  ClawColors.accentGreen)
            case .failed:    return ("xmark.circle.fill",      ClawColors.accentRed)
            case .cancelled: return ("minus.circle.fill",      ClawColors.textTertiary)
            case .timedOut:  return ("clock.badge.xmark.fill", ClawColors.accentOrange)
            }
        }()
        return Image(systemName: icon)
            .font(.system(size: 20))
            .foregroundStyle(color)
            .frame(width: 28)
    }

    // MARK: - Work Logs

    private var workLogsSection: some View {
        VStack(alignment: .leading, spacing: ClawSpacing.md) {
            Text("Work Logs")
                .font(ClawFonts.sectionHeader)
                .foregroundStyle(ClawColors.textSecondary)
                .textCase(.uppercase)

            if vm.workLogs.isEmpty {
                Text("No work log entries.")
                    .font(ClawFonts.cardBody)
                    .foregroundStyle(ClawColors.textTertiary)
            } else {
                ForEach(vm.workLogs.prefix(5)) { log in
                    HStack(alignment: .top, spacing: ClawSpacing.sm) {
                        Text(log.timestamp.timeOnly)
                            .font(.system(size: 11, design: .monospaced))
                            .foregroundStyle(ClawColors.textTertiary)
                            .frame(width: 42, alignment: .leading)

                        AvatarView(name: log.agentId, imageUrl: nil, size: .small)

                        VStack(alignment: .leading, spacing: 2) {
                            Text(log.action)
                                .font(.system(size: 13, weight: .medium))
                                .foregroundStyle(ClawColors.textPrimary)
                            if !log.details.isEmpty {
                                Text(log.details)
                                    .font(ClawFonts.caption)
                                    .foregroundStyle(ClawColors.textSecondary)
                                    .lineLimit(2)
                            }
                        }
                    }

                    if log.id != vm.workLogs.prefix(5).last?.id {
                        Divider().background(ClawColors.separatorLight)
                    }
                }
            }
        }
        .padding(ClawSpacing.lg)
        .background(ClawColors.backgroundCard)
        .cornerRadius(ClawRadius.card)
        .overlay(RoundedRectangle(cornerRadius: ClawRadius.card).stroke(ClawColors.separator, lineWidth: 0.5))
    }
}

// MARK: - Mock Data

extension Run {
    static let mockRuns: [Run] = {
        let now = Date()
        return [
            Run(id: "run001", taskId: "1", agentId: "FinanceBot", status: .completed, startedAt: now.addingTimeInterval(-3600), completedAt: now.addingTimeInterval(-3000), errorMessage: nil, eventsCount: 24, tokensUsed: 1240, cost: 0.12),
            Run(id: "run002", taskId: "1", agentId: "FinanceBot", status: .failed, startedAt: now.addingTimeInterval(-7200), completedAt: now.addingTimeInterval(-7000), errorMessage: "Timeout on file read", eventsCount: 8, tokensUsed: 320, cost: 0.03),
        ]
    }()
}

extension WorkLog {
    static let mockLogs: [WorkLog] = {
        let now = Date()
        return [
            WorkLog(id: "wl1", agentId: "FinanceBot", taskId: "1", runId: "run001", action: "Started processing", details: "Loaded 142 invoice files from shared drive", timestamp: now.addingTimeInterval(-3600), durationMinutes: nil, metadata: [:]),
            WorkLog(id: "wl2", agentId: "FinanceBot", taskId: "1", runId: "run001", action: "Validated invoices", details: "138/142 invoices passed validation", timestamp: now.addingTimeInterval(-3400), durationMinutes: 3, metadata: [:]),
            WorkLog(id: "wl3", agentId: "FinanceBot", taskId: "1", runId: "run001", action: "Completed batch", details: "All results written to output.csv", timestamp: now.addingTimeInterval(-3000), durationMinutes: 10, metadata: [:]),
        ]
    }()
}

// MARK: - Preview

private extension Task {
    static let previewTask = Task(
        id: "preview-task-1",
        title: "Process invoice batch Q1",
        description: "Extract and validate all Q1 invoices from the shared drive.",
        status: .running,
        priority: .high,
        assignedAgentId: "FinanceBot",
        teamId: nil,
        workspaceId: "ws1",
        createdByUserId: "u1",
        createdByAgentId: nil,
        dueAt: Date().addingTimeInterval(-300),
        completedAt: nil,
        createdAt: Date().addingTimeInterval(-3600),
        updatedAt: Date(),
        tags: ["finance", "batch"],
        budgetUsed: 0.12,
        estimatedMinutes: 30,
        actualMinutes: nil,
        runCount: 1,
        lastRunAt: Date().addingTimeInterval(-272),
        requiresApproval: false,
        approvalId: nil
    )
}

#Preview {
    TaskDetailView(task: .previewTask)
        .preferredColorScheme(.dark)
}
