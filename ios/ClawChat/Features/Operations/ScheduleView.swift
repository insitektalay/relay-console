// ScheduleView.swift
// ClawChat – Operations: Schedule management

import SwiftUI
import Combine

// MARK: - ViewModel

@MainActor
final class ScheduleViewState: ObservableObject {
    @Published var scope: ScheduleScope = .workspace
    @Published var selectedAgentId: String? = nil
    @Published var selectedTeamId: String? = nil
    @Published var schedules: [Schedule] = []
    @Published var agentScheduleSummaries: [AgentScheduleSummary] = []
    @Published var editingSchedule: Schedule? = nil
    @Published var showEditSheet: Bool = false

    enum ScheduleScope: String, CaseIterable {
        case workspace = "Workspace"
        case team      = "Team"
        case agent     = "Agent"
    }

    func schedule(for agentId: String) -> Schedule? {
        schedules.first { $0.agentId == agentId }
    }

    func saveSchedule(_ schedule: Schedule) {
        if let idx = schedules.firstIndex(where: { $0.id == schedule.id }) {
            schedules[idx] = schedule
        } else {
            schedules.append(schedule)
        }
        showEditSheet = false
    }
}

// MARK: - Supporting Types

struct AgentScheduleSummary: Identifiable {
    let id: String
    let name: String
    let role: String
    let mode: WorkingHoursMode
    let isOnShift: Bool
    let nextShift: String?

    static let mock: [AgentScheduleSummary] = [
        .init(id: "a1", name: "FinanceBot",   role: "Finance Agent",    mode: .twentyFourSeven,  isOnShift: true,  nextShift: nil),
        .init(id: "a2", name: "DevBot",       role: "Engineering Agent", mode: .scheduled,        isOnShift: true,  nextShift: nil),
        .init(id: "a3", name: "OpsBot",       role: "Ops Agent",         mode: .scheduled,        isOnShift: false, nextShift: "Mon 09:00"),
        .init(id: "a4", name: "MarketingBot", role: "Marketing Agent",   mode: .manual,           isOnShift: false, nextShift: "Manual"),
        .init(id: "a5", name: "ReportBot",    role: "Reporting Agent",   mode: .scheduled,        isOnShift: true,  nextShift: nil),
    ]
}

// MARK: - View

struct ScheduleView: View {
    @StateObject private var vm = ScheduleViewState()
    @EnvironmentObject private var appStore: AppStore
    @State private var scheduleVM: ScheduleViewModel?

    private let dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

    var body: some View {
        NavigationStack {
            ZStack {
                ClawColors.backgroundPrimary.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: ClawSpacing.lg) {
                        scopeSelector
                        workspaceModeSection
                        weekViewSection
                        agentListSection
                    }
                    .padding(.horizontal, ClawSpacing.lg)
                    .padding(.top, ClawSpacing.md)
                    .padding(.bottom, ClawSpacing.xxxl)
                }
            }
            .navigationTitle("Schedule")
            .navigationBarTitleDisplayMode(.large)
            .toolbarBackground(ClawColors.backgroundPrimary, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .sheet(isPresented: $vm.showEditSheet) {
                if let schedule = vm.editingSchedule {
                    ScheduleEditSheet(schedule: schedule) { updated in
                        vm.saveSchedule(updated)
                        if let agentId = updated.agentId {
                            _Concurrency.Task {
                                try? await scheduleVM?.saveSchedule(
                                    agentId: agentId,
                                    mode: updated.mode,
                                    shifts: updated.shifts
                                )
                            }
                        }
                    }
                }
            }
            .task {
                guard let wsId = appStore.selectedWorkspace?.id else { return }
                let svm = ScheduleViewModel(workspaceId: wsId)
                scheduleVM = svm
                await svm.loadSchedules()
                vm.schedules = svm.schedules
                vm.agentScheduleSummaries = appStore.agents.map { agent in
                    let resolvedMode = svm.schedules.first { $0.agentId == agent.id }?.mode ?? agent.workingHoursMode
                    return AgentScheduleSummary(
                        id: agent.id,
                        name: agent.name,
                        role: agent.role,
                        mode: resolvedMode,
                        isOnShift: agent.status == .onDuty || agent.status == .busy,
                        nextShift: nil
                    )
                }
            }
        }
    }

    // MARK: - Scope Selector

    private var scopeSelector: some View {
        HStack(spacing: ClawSpacing.xs) {
            ForEach(ScheduleViewState.ScheduleScope.allCases, id: \.self) { scope in
                scopeButton(scope)
            }
        }
    }

    private func scopeButton(_ scope: ScheduleViewState.ScheduleScope) -> some View {
        let isSelected = vm.scope == scope
        return Button {
            withAnimation(.easeInOut(duration: 0.15)) { vm.scope = scope }
        } label: {
            Text(scope.rawValue)
                .font(.system(size: 13, weight: isSelected ? .semibold : .regular))
                .foregroundStyle(isSelected ? Color.white : ClawColors.textSecondary)
                .frame(maxWidth: .infinity)
                .padding(.vertical, ClawSpacing.sm)
                .background(isSelected ? ClawColors.accent : ClawColors.backgroundTertiary)
                .cornerRadius(ClawRadius.sm)
        }
        .buttonStyle(.plain)
    }

    // MARK: - Workspace Mode

    private var workspaceModeSection: some View {
        VStack(alignment: .leading, spacing: ClawSpacing.md) {
            Text("Working Mode")
                .font(ClawFonts.sectionHeader)
                .foregroundStyle(ClawColors.textSecondary)
                .textCase(.uppercase)

            HStack(spacing: ClawSpacing.md) {
                ForEach([WorkingHoursMode.twentyFourSeven, .scheduled, .manual], id: \.self) { mode in
                    modeBadge(mode: mode)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(ClawSpacing.lg)
        .background(ClawColors.backgroundCard)
        .cornerRadius(ClawRadius.card)
        .overlay(RoundedRectangle(cornerRadius: ClawRadius.card).stroke(ClawColors.separator, lineWidth: 0.5))
    }

    private func modeBadge(mode: WorkingHoursMode) -> some View {
        let (label, icon, color): (String, String, Color) = {
            switch mode {
            case .twentyFourSeven: return ("24/7",      "infinity.circle.fill",   ClawColors.accentGreen)
            case .scheduled:       return ("Scheduled", "calendar.badge.clock",   ClawColors.accent)
            case .manual:          return ("Manual",    "hand.tap.fill",           ClawColors.accentOrange)
            }
        }()

        return VStack(spacing: ClawSpacing.xs) {
            Image(systemName: icon)
                .font(.system(size: 20))
                .foregroundStyle(color)
            Text(label)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(color)
        }
        .frame(maxWidth: .infinity)
        .padding(ClawSpacing.md)
        .background(color.opacity(0.12))
        .cornerRadius(ClawRadius.md)
    }

    // MARK: - Week View

    private var weekViewSection: some View {
        VStack(alignment: .leading, spacing: ClawSpacing.md) {
            Text("Week Overview")
                .font(ClawFonts.sectionHeader)
                .foregroundStyle(ClawColors.textSecondary)
                .textCase(.uppercase)

            HStack(spacing: ClawSpacing.xs) {
                ForEach(Array(dayLabels.enumerated()), id: \.offset) { index, day in
                    dayColumn(dayLabel: day, dayIndex: index + 1)
                }
            }
        }
        .padding(ClawSpacing.lg)
        .background(ClawColors.backgroundCard)
        .cornerRadius(ClawRadius.card)
        .overlay(RoundedRectangle(cornerRadius: ClawRadius.card).stroke(ClawColors.separator, lineWidth: 0.5))
    }

    private func dayColumn(dayLabel: String, dayIndex: Int) -> some View {
        // dayIndex: 1=Mon...7=Sun
        let calendar = Calendar.current
        let today = calendar.component(.weekday, from: Date())
        // Convert to Mon-based: 1=Mon, 2=Tue... 7=Sun
        let todayMon = ((today + 5) % 7) + 1
        let isToday = dayIndex == todayMon
        let isWeekend = dayIndex >= 6

        // Compute shift block heights based on sample data
        let hasShift = !isWeekend
        let shiftStart: CGFloat = hasShift ? 0.38 : 0 // 09:00 / 24h
        let shiftEnd:   CGFloat = hasShift ? 0.71 : 0 // 17:00 / 24h

        return VStack(spacing: 4) {
            Text(dayLabel)
                .font(.system(size: 10, weight: isToday ? .bold : .regular))
                .foregroundStyle(isToday ? ClawColors.accent : ClawColors.textSecondary)

            GeometryReader { geo in
                ZStack(alignment: .top) {
                    RoundedRectangle(cornerRadius: 4)
                        .fill(ClawColors.backgroundTertiary)

                    if hasShift {
                        RoundedRectangle(cornerRadius: 4)
                            .fill(ClawColors.accent.opacity(0.7))
                            .frame(height: geo.size.height * (shiftEnd - shiftStart))
                            .offset(y: geo.size.height * shiftStart)
                    }
                }
            }
            .frame(height: 80)

            if isToday {
                Circle()
                    .fill(ClawColors.accent)
                    .frame(width: 5, height: 5)
            } else {
                Circle()
                    .fill(Color.clear)
                    .frame(width: 5, height: 5)
            }
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Agent List

    private var agentListSection: some View {
        VStack(alignment: .leading, spacing: ClawSpacing.md) {
            Text("Agents")
                .font(ClawFonts.sectionHeader)
                .foregroundStyle(ClawColors.textSecondary)
                .textCase(.uppercase)

            ForEach(vm.agentScheduleSummaries) { agent in
                agentScheduleRow(agent: agent)
                if agent.id != vm.agentScheduleSummaries.last?.id {
                    Divider().background(ClawColors.separatorLight)
                }
            }
        }
        .padding(ClawSpacing.lg)
        .background(ClawColors.backgroundCard)
        .cornerRadius(ClawRadius.card)
        .overlay(RoundedRectangle(cornerRadius: ClawRadius.card).stroke(ClawColors.separator, lineWidth: 0.5))
    }

    private func agentScheduleRow(agent: AgentScheduleSummary) -> some View {
        HStack(spacing: ClawSpacing.md) {
            AvatarView(
                name: agent.name,
                imageUrl: nil,
                size: .small,
                status: agent.isOnShift ? .onDuty : .offDuty
            )

            VStack(alignment: .leading, spacing: 2) {
                Text(agent.name)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(ClawColors.textPrimary)
                Text(agent.role)
                    .font(ClawFonts.caption)
                    .foregroundStyle(ClawColors.textSecondary)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 2) {
                modePill(agent.mode)
                if agent.isOnShift {
                    Text("On shift")
                        .font(.system(size: 10, weight: .medium))
                        .foregroundStyle(ClawColors.accentGreen)
                } else if let next = agent.nextShift {
                    Text("Next: \(next)")
                        .font(.system(size: 10))
                        .foregroundStyle(ClawColors.textTertiary)
                }
            }

            Button {
                let schedule = vm.schedule(for: agent.id) ?? Schedule(
                    id: UUID().uuidString,
                    agentId: agent.id,
                    teamId: nil,
                    departmentId: nil,
                    mode: agent.mode,
                    timezone: "UTC",
                    shifts: [],
                    isActive: true,
                    createdAt: Date(),
                    updatedAt: Date()
                )
                vm.editingSchedule = schedule
                vm.showEditSheet = true
            } label: {
                Image(systemName: "pencil.circle")
                    .font(.system(size: 20))
                    .foregroundStyle(ClawColors.accent)
            }
            .buttonStyle(.plain)
        }
        .padding(.vertical, ClawSpacing.xs)
    }

    private func modePill(_ mode: WorkingHoursMode) -> some View {
        let (label, color): (String, Color) = {
            switch mode {
            case .twentyFourSeven: return ("24/7",      ClawColors.accentGreen)
            case .scheduled:       return ("Scheduled", ClawColors.accent)
            case .manual:          return ("Manual",    ClawColors.accentOrange)
            }
        }()
        return Text(label)
            .font(.system(size: 10, weight: .semibold))
            .foregroundStyle(color)
            .padding(.horizontal, ClawSpacing.sm)
            .padding(.vertical, 2)
            .background(color.opacity(0.15))
            .clipShape(Capsule())
    }
}

// MARK: - Schedule Edit Sheet

struct ScheduleEditSheet: View {
    @State var schedule: Schedule
    let onSave: (Schedule) -> Void
    @Environment(\.dismiss) private var dismiss

    private let dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

    var body: some View {
        NavigationStack {
            Form {
                Section("Working Mode") {
                    Picker("Mode", selection: $schedule.mode) {
                        Label("24/7",       systemImage: "infinity.circle.fill").tag(WorkingHoursMode.twentyFourSeven)
                        Label("Scheduled",  systemImage: "calendar.badge.clock").tag(WorkingHoursMode.scheduled)
                        Label("Manual",     systemImage: "hand.tap.fill").tag(WorkingHoursMode.manual)
                    }
                    .pickerStyle(.inline)
                }
                .listRowBackground(ClawColors.backgroundCard)

                if schedule.mode == .scheduled {
                    Section("Shift Hours") {
                        ForEach(0..<7) { day in
                            shiftRow(day: day)
                        }
                    }
                    .listRowBackground(ClawColors.backgroundCard)
                }

                Section("Timezone") {
                    Picker("Timezone", selection: $schedule.timezone) {
                        Text("UTC").tag("UTC")
                        Text("America/New_York").tag("America/New_York")
                        Text("America/Los_Angeles").tag("America/Los_Angeles")
                        Text("Europe/London").tag("Europe/London")
                        Text("Asia/Tokyo").tag("Asia/Tokyo")
                    }
                    .pickerStyle(.menu)
                    .foregroundStyle(ClawColors.textPrimary)
                }
                .listRowBackground(ClawColors.backgroundCard)

                Section {
                    Toggle("Active", isOn: $schedule.isActive)
                        .tint(ClawColors.accent)
                }
                .listRowBackground(ClawColors.backgroundCard)
            }
            .scrollContentBackground(.hidden)
            .background(ClawColors.backgroundPrimary)
            .navigationTitle("Edit Schedule")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(ClawColors.backgroundSecondary, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(ClawColors.accent)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { onSave(schedule) }
                        .foregroundStyle(ClawColors.accent)
                }
            }
        }
        .presentationBackground(ClawColors.backgroundPrimary)
        .presentationDetents([.large])
    }

    @ViewBuilder
    private func shiftRow(day: Int) -> some View {
        let existingIdx = schedule.shifts.firstIndex(where: { $0.dayOfWeek == day })
        let isActive = existingIdx != nil && (schedule.shifts[existingIdx!].isActive)

        HStack {
            Text(dayNames[day])
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(ClawColors.textPrimary)
                .frame(width: 36)

            Toggle("", isOn: Binding<Bool>(
                get: { isActive },
                set: { active in
                    if active && existingIdx == nil {
                        let newShift = ShiftRule(id: UUID().uuidString, scheduleId: schedule.id, dayOfWeek: day, startTime: "09:00", endTime: "17:00", isActive: true)
                        schedule.shifts.append(newShift)
                    } else if let idx = existingIdx {
                        schedule.shifts[idx].isActive = active
                    }
                }
            ))
            .tint(ClawColors.accent)
            .labelsHidden()

            if isActive, let idx = existingIdx {
                Spacer()

                Text(schedule.shifts[idx].startTime)
                    .font(.system(size: 13, design: .monospaced))
                    .foregroundStyle(ClawColors.textSecondary)

                Text("–")
                    .foregroundStyle(ClawColors.textTertiary)

                Text(schedule.shifts[idx].endTime)
                    .font(.system(size: 13, design: .monospaced))
                    .foregroundStyle(ClawColors.textSecondary)
            } else {
                Spacer()
                Text("Off")
                    .font(ClawFonts.caption)
                    .foregroundStyle(ClawColors.textTertiary)
            }
        }
    }
}

// MARK: - Mock Data

extension Schedule {
    static let mockSchedules: [Schedule] = {
        [
            Schedule(id: "sch1", agentId: "a1", teamId: nil, departmentId: nil, mode: .twentyFourSeven, timezone: "UTC", shifts: [], isActive: true, createdAt: Date(), updatedAt: Date()),
            Schedule(id: "sch2", agentId: "a2", teamId: nil, departmentId: nil, mode: .scheduled, timezone: "America/New_York", shifts: [
                ShiftRule(id: "sr1", scheduleId: "sch2", dayOfWeek: 1, startTime: "09:00", endTime: "17:00", isActive: true),
                ShiftRule(id: "sr2", scheduleId: "sch2", dayOfWeek: 2, startTime: "09:00", endTime: "17:00", isActive: true),
                ShiftRule(id: "sr3", scheduleId: "sch2", dayOfWeek: 3, startTime: "09:00", endTime: "17:00", isActive: true),
                ShiftRule(id: "sr4", scheduleId: "sch2", dayOfWeek: 4, startTime: "09:00", endTime: "17:00", isActive: true),
                ShiftRule(id: "sr5", scheduleId: "sch2", dayOfWeek: 5, startTime: "09:00", endTime: "17:00", isActive: true),
            ], isActive: true, createdAt: Date(), updatedAt: Date()),
        ]
    }()
}

// MARK: - Preview

#Preview {
    ScheduleView()
        .environmentObject(AppStore.preview)
        .preferredColorScheme(.dark)
}
