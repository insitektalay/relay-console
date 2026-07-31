// TaskBoardView.swift
// ClawChat – Task board (web-canonical)

import SwiftUI
import Combine

// MARK: - Group Filter

enum TaskGroupFilter: String, CaseIterable {
    case all      = "All"
    case business = "Business"
    case personal = "Personal"
}

// MARK: - ViewModel

@MainActor
final class TaskBoardViewState: ObservableObject {
    @Published var selectedGroupFilter: TaskGroupFilter = .all
    @Published var showNewTaskSheet: Bool = false
    @Published var searchText: String = ""
    @Published var liveTimerTick: Date = Date()

    private var timerTask: _Concurrency.Task<Void, Never>?

    init() {
        startLiveTimer()
    }

    deinit {
        timerTask?.cancel()
    }

    func startLiveTimer() {
        timerTask = _Concurrency.Task { [weak self] in
            while !_Concurrency.Task.isCancelled {
                try? await _Concurrency.Task.sleep(nanoseconds: 1_000_000_000)
                await MainActor.run {
                    self?.liveTimerTick = Date()
                }
            }
        }
    }

    func runningDuration(for task: Task) -> String? {
        guard task.status == .running, let lastRun = task.lastRunAt else { return nil }
        let elapsed = Int(Date().timeIntervalSince(lastRun))
        let m = elapsed / 60
        let s = elapsed % 60
        return "Running \(m)m \(String(format: "%02d", s))s"
    }
}

// MARK: - Agent Tasks ViewModel

@MainActor
private final class AgentTasksViewState: ObservableObject {
    @Published var groups: [AgentTaskGroup] = []
    @Published var searchText = ""
    @Published var isLoading = false
    @Published var error: String?

    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    var filteredGroups: [AgentTaskGroup] {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty else { return groups }
        return groups.filter { group in
            group.agent.name.localizedCaseInsensitiveContains(query) ||
            group.agent.role.localizedCaseInsensitiveContains(query) ||
            group.tasks.contains {
                $0.title.localizedCaseInsensitiveContains(query) ||
                ($0.messageBody ?? $0.description).localizedCaseInsensitiveContains(query)
            }
        }
    }

    func load(workspaceId: String, agents: [Agent]) async {
        guard !isLoading, !workspaceId.isEmpty else { return }
        isLoading = true
        error = nil
        defer { isLoading = false }

        var loaded: [AgentTaskGroup] = []
        for agent in agents {
            do {
                let response: PaginatedResponse<Task> = try await api.requestPaginated(
                    .agentTasks(agentId: agent.id, status: nil, page: 1, pageSize: 50)
                )
                let tasks = response.data.sorted(by: Self.sortTasks)
                if !tasks.isEmpty {
                    loaded.append(AgentTaskGroup(agent: agent, tasks: tasks))
                }
            } catch {
                Telemetry.shared.capture(error: error, attributes: ["operation": "agent.tasks.load", "agentId": agent.id])
            }
        }

        groups = loaded.sorted {
            if $0.activeCount != $1.activeCount { return $0.activeCount > $1.activeCount }
            if $0.futureCount != $1.futureCount { return $0.futureCount > $1.futureCount }
            return $0.agent.name.localizedCaseInsensitiveCompare($1.agent.name) == .orderedAscending
        }
    }

    private static func sortTasks(_ left: Task, _ right: Task) -> Bool {
        let leftDate = left.nextRunAt ?? left.scheduledFor ?? left.dueAt ?? left.updatedAt
        let rightDate = right.nextRunAt ?? right.scheduledFor ?? right.dueAt ?? right.updatedAt
        return leftDate > rightDate
    }
}

private struct AgentTaskGroup: Identifiable, Hashable {
    let agent: Agent
    let tasks: [Task]

    var id: String { agent.id }
    var activeCount: Int { tasks.filter(\.isActiveTask).count }
    var futureCount: Int { tasks.filter(\.isFutureTask).count }
    var recurringCount: Int { tasks.filter(\.isRecurringTask).count }
    var historyCount: Int { tasks.filter(\.isHistoricalTask).count }
}

// MARK: - Main View

struct TaskBoardView: View {
    @EnvironmentObject private var appStore: AppStore
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private let embedded: Bool

    @StateObject private var vm = TaskBoardViewState()
    @State private var dataVM = TaskBoardViewModel(workspaceId: "")
    @State private var selectedTask: Task? = nil
    @State private var showApprovals = false

    init(embedded: Bool = false) {
        self.embedded = embedded
    }

    var body: some View {
        Group {
            if embedded {
                taskBoardContent
            } else {
                taskBoardContent
                    .navigationTitle("Tasks")
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbarBackground(ClawColors.backgroundPrimary, for: .navigationBar)
                    .toolbarColorScheme(.dark, for: .navigationBar)
                    .toolbar {
                        ToolbarItem(placement: .topBarTrailing) {
                            approvalsButton
                        }
                    }
            }
        }
    }

    private var taskBoardContent: some View {
        ZStack(alignment: .bottomTrailing) {
            ClawColors.backgroundPrimary.ignoresSafeArea()

            VStack(spacing: 0) {
                filterBar
                Divider().background(ClawColors.separator)

                if dataVM.isLoading && dataVM.tasks.isEmpty {
                    Spacer()
                    ProgressView().tint(ClawColors.accent)
                    Spacer()
                } else if let error = dataVM.error, dataVM.tasks.isEmpty {
                    emptyState(
                        title: "Unable to load tasks",
                        message: error,
                        icon: "exclamationmark.triangle"
                    )
                } else if filteredTasks.isEmpty {
                    emptyState(
                        title: "No tasks",
                        message: dataVM.tasks.isEmpty
                            ? "This workspace does not have any live tasks yet."
                            : "No tasks match the current filter.",
                        icon: "checklist"
                    )
                } else {
                    taskList
                }
            }

            Button {
                vm.showNewTaskSheet = true
            } label: {
                HStack(spacing: ClawSpacing.sm) {
                    Image(systemName: "plus")
                        .font(.system(size: 16, weight: .bold))
                    Text("New Task")
                        .font(.system(size: 15, weight: .semibold))
                }
                .foregroundStyle(.white)
                .padding(.horizontal, ClawSpacing.lg)
                .padding(.vertical, ClawSpacing.md)
                .background(ClawColors.accent)
                .clipShape(Capsule())
                .shadow(color: ClawColors.accent.opacity(0.4), radius: 12, x: 0, y: 4)
            }
            .padding(.trailing, ClawSpacing.lg)
            .padding(.bottom, embedded ? ClawSpacing.lg : ClawSpacing.xl)
        }
        .searchable(text: $vm.searchText, prompt: "Search tasks...")
        .sheet(isPresented: $showApprovals) {
            NavigationStack { ApprovalCentreView() }
        }
        .sheet(isPresented: $vm.showNewTaskSheet) {
            NewTaskView(isPresented: $vm.showNewTaskSheet)
                .environmentObject(appStore)
        }
        .sheet(item: $selectedTask) { task in
            TaskDetailView(task: task)
        }
        .task {
            await reloadTasks()
        }
        .refreshable {
            await reloadTasks()
        }
        .onChange(of: appStore.selectedWorkspace) { _, _ in
            _Concurrency.Task {
                await reloadTasks()
            }
        }
    }

    // MARK: - Approvals Button

    private var approvalsButton: some View {
        let count = appStore.pendingApprovals.count
        return Button { showApprovals = true } label: {
            Image(systemName: "checkmark.seal")
                .foregroundStyle(ClawColors.accent)
        }
        .badge(count)
    }

    // MARK: - Filter Bar

    private var filterBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: ClawSpacing.sm) {
                ForEach(TaskGroupFilter.allCases, id: \.self) { filter in
                    groupFilterChip(filter)
                }
            }
            .padding(.horizontal, ClawSpacing.lg)
            .padding(.vertical, ClawSpacing.md)
        }
        .background(ClawColors.backgroundPrimary)
    }

    @ViewBuilder
    private func groupFilterChip(_ filter: TaskGroupFilter) -> some View {
        let isSelected = vm.selectedGroupFilter == filter
        Button {
            withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.15)) {
                vm.selectedGroupFilter = filter
            }
        } label: {
            Text(filter.rawValue)
                .font(ClawFonts.label)
                .foregroundStyle(isSelected ? .white : ClawColors.textSecondary)
                .padding(.horizontal, ClawSpacing.md)
                .padding(.vertical, ClawSpacing.xs)
                .background(isSelected ? ClawColors.accent : ClawColors.backgroundTertiary)
                .clipShape(Capsule())
        }
        .buttonStyle(.plain)
        .sensoryFeedback(.selection, trigger: vm.selectedGroupFilter)
    }

    // MARK: - Task List

    private var taskList: some View {
        List {
            ForEach(filteredTasks) { task in
                taskRow(task: task)
                    .listRowBackground(ClawColors.backgroundPrimary)
                    .listRowSeparatorTint(ClawColors.separatorLight)
                    .listRowInsets(EdgeInsets(top: 0, leading: 0, bottom: 0, trailing: 0))
            }
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        .padding(.bottom, 80)
    }

    // MARK: - Task Row

    @ViewBuilder
    private func taskRow(task: Task) -> some View {
        Button {
            selectedTask = task
        } label: {
            HStack(spacing: 0) {
                // Priority stripe
                RoundedRectangle(cornerRadius: 2)
                    .fill(Color.priorityColor(task.priority))
                    .frame(width: 3)
                    .padding(.vertical, ClawSpacing.sm)

                VStack(alignment: .leading, spacing: ClawSpacing.xs) {
                    HStack(alignment: .top) {
                        Text(task.title)
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(ClawColors.textPrimary)
                            .lineLimit(2)
                            .multilineTextAlignment(.leading)

                        Spacer()

                        taskStatusBadge(task.status)
                    }

                    HStack(spacing: ClawSpacing.sm) {
                        AvatarView(
                            name: task.assignedAgentId ?? "Unassigned",
                            imageUrl: nil,
                            size: .small
                        )

                        Text(task.assignedAgentId ?? "Unassigned")
                            .font(ClawFonts.caption)
                            .foregroundStyle(ClawColors.textSecondary)

                        Spacer()

                        if let due = task.dueAt {
                            let isOverdue = due < Date() && task.status != .completed
                            Text(due.chatTimestamp)
                                .font(ClawFonts.caption)
                                .foregroundStyle(isOverdue ? ClawColors.accentRed : ClawColors.textTertiary)
                        }
                    }

                    if let duration = vm.runningDuration(for: task) {
                        HStack(spacing: ClawSpacing.xs) {
                            Circle()
                                .fill(ClawColors.accentRed)
                                .frame(width: 6, height: 6)
                                .opacity(0.9)
                            Text(duration)
                                .font(.system(size: 11, weight: .medium, design: .monospaced))
                                .foregroundStyle(ClawColors.accentRed)
                        }
                        .id(vm.liveTimerTick)
                    }
                }
                .padding(.leading, ClawSpacing.md)
                .padding(.trailing, ClawSpacing.lg)
                .padding(.vertical, ClawSpacing.md)
            }
            .background(ClawColors.backgroundPrimary)
        }
        .buttonStyle(.plain)
    }

    // MARK: - Task Status Badge

    @ViewBuilder
    private func taskStatusBadge(_ status: TaskStatus) -> some View {
        let (label, color) = status.displayInfo
        Text(label)
            .font(ClawFonts.badge)
            .foregroundStyle(color)
            .padding(.horizontal, ClawSpacing.sm)
            .padding(.vertical, 3)
            .background(color.opacity(0.15))
            .clipShape(Capsule())
    }

    // MARK: - Empty State

    @ViewBuilder
    private func emptyState(title: String, message: String, icon: String) -> some View {
        VStack(spacing: ClawSpacing.md) {
            Spacer()
            Image(systemName: icon)
                .font(.system(size: 48))
                .foregroundStyle(ClawColors.textTertiary)
            Text(title)
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(ClawColors.textPrimary)
            Text(message)
                .font(ClawFonts.cardBody)
                .foregroundStyle(ClawColors.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, ClawSpacing.xl)
            Spacer()
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Filtered Tasks

    private var filteredTasks: [Task] {
        var tasks = dataVM.tasks

        // Search filter
        if !vm.searchText.isEmpty {
            tasks = tasks.filter {
                $0.title.localizedCaseInsensitiveContains(vm.searchText)
            }
        }

        // Group filter
        switch vm.selectedGroupFilter {
        case .all:
            break
        case .business:
            tasks = tasks.filter { task in
                guard let agentId = task.assignedAgentId else { return task.teamId != nil }
                let agent = appStore.agents.first(where: { $0.id == agentId })
                return task.teamId != nil || agent?.companyId != nil
            }
        case .personal:
            tasks = tasks.filter { task in
                guard let agentId = task.assignedAgentId else { return task.teamId == nil }
                let agent = appStore.agents.first(where: { $0.id == agentId })
                return task.teamId == nil && agent?.companyId == nil
            }
        }

        return tasks
    }

    private func reloadTasks() async {
        guard let workspaceId = appStore.selectedWorkspace?.id, !workspaceId.isEmpty else {
            dataVM.workspaceId = ""
            dataVM.tasks = []
            dataVM.groupedTasks = [:]
            dataVM.error = nil
            dataVM.hasMore = false
            return
        }

        dataVM.workspaceId = workspaceId
        await dataVM.loadTasks()
    }
}

// MARK: - Agent-Centric Tasks

struct AgentTasksView: View {
    let workspaceId: String

    @EnvironmentObject private var appStore: AppStore
    @StateObject private var state = AgentTasksViewState()

    var body: some View {
        VStack(spacing: 0) {
            searchBar
            Divider().background(ClawColors.separator)

            if state.isLoading && state.groups.isEmpty {
                ProgressView()
                    .tint(ClawColors.accent)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let error = state.error {
                emptyState(title: "Unable to load agent tasks", message: error, icon: "exclamationmark.triangle")
            } else if state.filteredGroups.isEmpty {
                emptyState(
                    title: "No agent tasks",
                    message: state.searchText.isEmpty
                        ? "No agents in this workspace have scheduled, recurring, active, or historical tasks."
                        : "No task agents match this search.",
                    icon: "checklist"
                )
            } else {
                List {
                    Section {
                        ForEach(state.filteredGroups) { group in
                            NavigationLink {
                                AgentTaskDetailView(group: group)
                            } label: {
                                AgentTaskGroupRow(group: group)
                            }
                            .listRowBackground(ClawColors.backgroundPrimary)
                            .listRowSeparatorTint(ClawColors.separator)
                        }
                    } header: {
                        Text("Agents with tasks")
                            .font(ClawFonts.sectionHeader)
                            .foregroundStyle(ClawColors.textSecondary)
                    }
                }
                .listStyle(.plain)
                .scrollContentBackground(.hidden)
                .refreshable { await reload() }
            }
        }
        .background(ClawColors.backgroundPrimary)
        .task { await bootstrap() }
        .onChange(of: workspaceId) { _, _ in
            _Concurrency.Task { await bootstrap(force: true) }
        }
    }

    private var searchBar: some View {
        HStack(spacing: ClawSpacing.sm) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(ClawColors.textTertiary)
            TextField("Search task agents...", text: $state.searchText)
                .foregroundStyle(ClawColors.textPrimary)
                .tint(ClawColors.accent)
            if !state.searchText.isEmpty {
                Button { state.searchText = "" } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(ClawColors.textTertiary)
                }
            }
        }
        .padding(.horizontal, ClawSpacing.md)
        .padding(.vertical, ClawSpacing.sm)
        .background(ClawColors.backgroundSecondary)
        .cornerRadius(ClawRadius.md)
        .padding(ClawSpacing.lg)
    }

    private func bootstrap(force: Bool = false) async {
        guard !workspaceId.isEmpty else { return }
        if force || appStore.agents.isEmpty {
            try? await appStore.syncAgents(workspaceId: workspaceId)
        }
        await reload()
    }

    private func reload() async {
        await state.load(workspaceId: workspaceId, agents: appStore.agents)
    }

    private func emptyState(title: String, message: String, icon: String) -> some View {
        VStack(spacing: ClawSpacing.md) {
            Spacer()
            Image(systemName: icon)
                .font(.system(size: 42, weight: .semibold))
                .foregroundStyle(ClawColors.textTertiary)
            Text(title)
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(ClawColors.textPrimary)
            Text(message)
                .font(.system(size: 13))
                .foregroundStyle(ClawColors.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, ClawSpacing.xl)
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

private struct AgentTaskGroupRow: View {
    let group: AgentTaskGroup

    var body: some View {
        HStack(spacing: ClawSpacing.md) {
            AvatarView(name: group.agent.name, imageUrl: group.agent.avatarUrl, size: .medium, status: group.agent.status)
            VStack(alignment: .leading, spacing: 5) {
                HStack {
                    Text(group.agent.name)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(ClawColors.textPrimary)
                    Spacer()
                    Text("\(group.tasks.count)")
                        .font(ClawFonts.badge)
                        .foregroundStyle(ClawColors.accent)
                        .padding(.horizontal, ClawSpacing.sm)
                        .padding(.vertical, 3)
                        .background(ClawColors.accent.opacity(0.14))
                        .clipShape(Capsule())
                }
                Text(group.agent.role)
                    .font(.system(size: 12))
                    .foregroundStyle(ClawColors.textSecondary)
                    .lineLimit(1)
                HStack(spacing: ClawSpacing.xs) {
                    if group.activeCount > 0 { countPill("\(group.activeCount) active", color: ClawColors.accentGreen) }
                    if group.futureCount > 0 { countPill("\(group.futureCount) upcoming", color: ClawColors.accent) }
                    if group.recurringCount > 0 { countPill("\(group.recurringCount) recurring", color: ClawColors.accentPurple) }
                    if group.historyCount > 0 { countPill("\(group.historyCount) history", color: ClawColors.textTertiary) }
                }
            }
        }
        .padding(.vertical, ClawSpacing.sm)
    }

    private func countPill(_ text: String, color: Color) -> some View {
        Text(text)
            .font(.system(size: 10, weight: .semibold))
            .foregroundStyle(color)
            .padding(.horizontal, 7)
            .padding(.vertical, 3)
            .background(color.opacity(0.12))
            .clipShape(Capsule())
    }
}

private struct AgentTaskDetailView: View {
    let group: AgentTaskGroup
    @State private var selectedTask: Task?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: ClawSpacing.lg) {
                agentHeader
                taskSection("Active", tasks: group.tasks.filter(\.isActiveTask))
                taskSection("Upcoming", tasks: group.tasks.filter(\.isFutureTask))
                taskSection("Recurring", tasks: group.tasks.filter(\.isRecurringTask))
                taskSection("Done / History", tasks: group.tasks.filter(\.isHistoricalTask))
            }
            .padding(ClawSpacing.lg)
        }
        .navigationTitle("\(group.agent.name) tasks")
        .navigationBarTitleDisplayMode(.inline)
        .missionScreenBackground()
        .sheet(item: $selectedTask) { task in
            TaskDetailView(task: task)
        }
    }

    private var agentHeader: some View {
        MissionPanel {
            HStack(spacing: ClawSpacing.md) {
                AvatarView(name: group.agent.name, imageUrl: group.agent.avatarUrl, size: .large, status: group.agent.status)
                VStack(alignment: .leading, spacing: 4) {
                    Text(group.agent.name)
                        .font(.system(size: 20, weight: .bold))
                        .foregroundStyle(ClawColors.textPrimary)
                    Text(group.agent.role)
                        .font(.system(size: 13))
                        .foregroundStyle(ClawColors.textSecondary)
                    Text("\(group.tasks.count) task\(group.tasks.count == 1 ? "" : "s")")
                        .font(ClawFonts.caption)
                        .foregroundStyle(ClawColors.textTertiary)
                }
                Spacer()
            }
        }
    }

    @ViewBuilder
    private func taskSection(_ title: String, tasks: [Task]) -> some View {
        if !tasks.isEmpty {
            VStack(alignment: .leading, spacing: ClawSpacing.sm) {
                Text(title.uppercased())
                    .font(ClawFonts.sectionHeader)
                    .foregroundStyle(ClawColors.textSecondary)
                ForEach(tasks) { task in
                    Button { selectedTask = task } label: {
                        AgentTaskRow(task: task)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }
}

private struct AgentTaskRow: View {
    let task: Task

    var body: some View {
        MissionPanel {
            HStack(alignment: .top, spacing: ClawSpacing.md) {
                RoundedRectangle(cornerRadius: 2)
                    .fill(task.status.displayInfo.1)
                    .frame(width: 3)
                VStack(alignment: .leading, spacing: ClawSpacing.sm) {
                    HStack(alignment: .top) {
                        Text(task.title)
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(ClawColors.textPrimary)
                            .multilineTextAlignment(.leading)
                        Spacer()
                        MissionBadge(text: task.status.displayInfo.0, color: task.status.displayInfo.1)
                    }
                    Text(task.messageBody?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false ? task.messageBody! : task.description)
                        .font(.system(size: 12))
                        .foregroundStyle(ClawColors.textSecondary)
                        .lineLimit(2)
                    HStack(spacing: ClawSpacing.sm) {
                        Label(task.scheduleLabel, systemImage: "calendar")
                        Label(task.recurrenceLabel, systemImage: "repeat")
                        Spacer()
                    }
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(ClawColors.textTertiary)
                }
            }
        }
    }
}

private extension Task {
    var effectiveScheduleDate: Date? { nextRunAt ?? scheduledFor ?? dueAt }
    var isActiveTask: Bool { [.queued, .dispatched, .running, .blocked, .awaitingApproval].contains(status) }
    var isFutureTask: Bool {
        guard let date = effectiveScheduleDate else { return false }
        return date > Date() && status != .cancelled && status != .completed
    }
    var isRecurringTask: Bool {
        guard let recurrenceRule, !recurrenceRule.isEmpty else { return false }
        return recurrenceRule.lowercased() != "none"
    }
    var isHistoricalTask: Bool {
        status == .completed || status == .failed || status == .cancelled || completedAt != nil || lastDispatchedAt != nil || lastRunAt != nil
    }
    var scheduleLabel: String {
        if let date = effectiveScheduleDate { return date.chatTimestamp }
        if let date = lastDispatchedAt { return "Last sent \(date.chatTimestamp)" }
        return "No schedule"
    }
    var recurrenceLabel: String {
        guard let recurrenceRule, !recurrenceRule.isEmpty, recurrenceRule.lowercased() != "none" else {
            return "One-off"
        }
        return recurrenceRule.replacingOccurrences(of: "_", with: " ").capitalized
    }
}

// MARK: - Extensions

extension TaskStatus {
    var displayInfo: (String, Color) {
        switch self {
        case .queued:           return ("Queued",    ClawColors.textSecondary)
        case .dispatched:       return ("Dispatched", ClawColors.accent)
        case .running:          return ("Running",   ClawColors.accentGreen)
        case .blocked:          return ("Blocked",   ClawColors.accentOrange)
        case .awaitingApproval: return ("Approval",  ClawColors.accentOrange)
        case .failed:           return ("Failed",    ClawColors.accentRed)
        case .completed:        return ("Done",      ClawColors.accentGreen)
        case .cancelled:        return ("Cancelled", ClawColors.textTertiary)
        }
    }
}

extension TaskPriority {
    var displayLabel: String {
        switch self {
        case .low:    return "Low"
        case .normal: return "Normal"
        case .high:   return "High"
        case .urgent: return "Urgent"
        case .critical: return "Critical"
        }
    }
}

// MARK: - Preview

#Preview {
    TaskBoardView()
        .environmentObject(AppStore())
        .preferredColorScheme(.dark)
}
