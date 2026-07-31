// AgentPickerView.swift
// ClawChat – Reusable agent picker sheet

import SwiftUI

// MARK: - Picker Mode

enum AgentPickerMode {
    case single
    case multi(maxCount: Int?)
}

// MARK: - AgentPickerView

struct AgentPickerView: View {
    let mode: AgentPickerMode
    var filterByTeam: String? = nil
    var filterByDepartment: String? = nil
    var title: String = "Select Agent"
    let onSelect: ([Agent]) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var searchText = ""
    @State private var selectedIds: Set<String> = []
    @State private var selectedTeamFilter: String? = nil
    @State private var selectedDeptFilter: String? = nil

    private var agents: [Agent] = {
        let now = Date()
        return [
            Agent(id: "1", name: "Aria Finance", role: "Finance Analyst", avatarUrl: nil, status: .onDuty,
                  teamId: "Finance Team", departmentId: "Finance", companyId: "c1", workspaceId: "w1", managerId: nil,
                  description: nil, capabilities: [], workingHoursMode: .scheduled, timezone: "UTC",
                  createdAt: now, updatedAt: now, currentTaskId: "t1", tasksCompletedToday: 12,
                  successRate: 0.982, avgCompletionMinutes: 4, totalMinutesWorked: 372, budgetUsed: 4.21, budgetLimit: 50),
            Agent(id: "2", name: "Bravo Ops", role: "Operations Manager", avatarUrl: nil, status: .busy,
                  teamId: "Ops Team", departmentId: "Operations", companyId: "c1", workspaceId: "w1", managerId: nil,
                  description: nil, capabilities: [], workingHoursMode: .twentyFourSeven, timezone: "UTC",
                  createdAt: now, updatedAt: now, currentTaskId: "t2", tasksCompletedToday: 8,
                  successRate: 0.91, avgCompletionMinutes: 7, totalMinutesWorked: 480, budgetUsed: 9.10, budgetLimit: 100),
            Agent(id: "3", name: "Charlie Support", role: "Customer Support", avatarUrl: nil, status: .idle,
                  teamId: "Support Team", departmentId: "Operations", companyId: "c1", workspaceId: "w1", managerId: nil,
                  description: nil, capabilities: [], workingHoursMode: .scheduled, timezone: "UTC",
                  createdAt: now, updatedAt: now, currentTaskId: nil, tasksCompletedToday: 3,
                  successRate: 0.95, avgCompletionMinutes: 9, totalMinutesWorked: 120, budgetUsed: 1.50, budgetLimit: 30),
            Agent(id: "4", name: "Delta Data", role: "Data Engineer", avatarUrl: nil, status: .offDuty,
                  teamId: "Engineering", departmentId: "Tech", companyId: "c1", workspaceId: "w1", managerId: nil,
                  description: nil, capabilities: [], workingHoursMode: .scheduled, timezone: "UTC",
                  createdAt: now, updatedAt: now, currentTaskId: nil, tasksCompletedToday: 0,
                  successRate: 0.88, avgCompletionMinutes: 15, totalMinutesWorked: 0, budgetUsed: 0, budgetLimit: 50),
            Agent(id: "5", name: "Echo Infra", role: "Infrastructure Agent", avatarUrl: nil, status: .paused,
                  teamId: "Engineering", departmentId: "Tech", companyId: "c1", workspaceId: "w1", managerId: nil,
                  description: nil, capabilities: [], workingHoursMode: .manual, timezone: "UTC",
                  createdAt: now, updatedAt: now, currentTaskId: nil, tasksCompletedToday: 2,
                  successRate: 0.77, avgCompletionMinutes: 22, totalMinutesWorked: 90, budgetUsed: 0.80, budgetLimit: 20),
            Agent(id: "6", name: "Foxtrot Legal", role: "Legal Reviewer", avatarUrl: nil, status: .onDuty,
                  teamId: "Legal Team", departmentId: "Legal", companyId: "c1", workspaceId: "w1", managerId: nil,
                  description: nil, capabilities: [], workingHoursMode: .scheduled, timezone: "GMT",
                  createdAt: now, updatedAt: now, currentTaskId: "t6", tasksCompletedToday: 5,
                  successRate: 0.99, avgCompletionMinutes: 6, totalMinutesWorked: 310, budgetUsed: 3.30, budgetLimit: 50),
            Agent(id: "7", name: "Golf Marketing", role: "Content Creator", avatarUrl: nil, status: .onDuty,
                  teamId: "Marketing", departmentId: "Marketing", companyId: "c1", workspaceId: "w1", managerId: nil,
                  description: nil, capabilities: [], workingHoursMode: .scheduled, timezone: "PST",
                  createdAt: now, updatedAt: now, currentTaskId: nil, tasksCompletedToday: 7,
                  successRate: 0.93, avgCompletionMinutes: 5, totalMinutesWorked: 240, budgetUsed: 2.10, budgetLimit: 40),
            Agent(id: "8", name: "Hotel HR", role: "HR Assistant", avatarUrl: nil, status: .idle,
                  teamId: "HR Team", departmentId: "HR", companyId: "c1", workspaceId: "w1", managerId: nil,
                  description: nil, capabilities: [], workingHoursMode: .scheduled, timezone: "EST",
                  createdAt: now, updatedAt: now, currentTaskId: nil, tasksCompletedToday: 1,
                  successRate: 0.96, avgCompletionMinutes: 12, totalMinutesWorked: 60, budgetUsed: 0.50, budgetLimit: 25),
        ]
    }()

    private var availableTeams: [String] {
        Array(Set(agents.compactMap { $0.teamId })).sorted()
    }

    private var availableDepts: [String] {
        Array(Set(agents.compactMap { $0.departmentId })).sorted()
    }

    private var filteredAgents: [Agent] {
        agents.filter { agent in
            let matchesSearch = searchText.isEmpty ||
                agent.name.localizedCaseInsensitiveContains(searchText) ||
                agent.role.localizedCaseInsensitiveContains(searchText)
            let matchesTeam = (filterByTeam == nil && selectedTeamFilter == nil) ||
                agent.teamId == filterByTeam ||
                agent.teamId == selectedTeamFilter
            let matchesDept = (filterByDepartment == nil && selectedDeptFilter == nil) ||
                agent.departmentId == filterByDepartment ||
                agent.departmentId == selectedDeptFilter
            return matchesSearch && matchesTeam && matchesDept
        }
    }

    private var isMultiSelect: Bool {
        if case .multi = mode { return true }
        return false
    }

    private var selectionCount: Int { selectedIds.count }

    private var maxCount: Int? {
        if case .multi(let max) = mode { return max }
        return nil
    }

    private var canSelectMore: Bool {
        guard let max = maxCount else { return true }
        return selectionCount < max
    }

    var body: some View {
        NavigationStack {
            ZStack {
                ClawColors.backgroundPrimary.ignoresSafeArea()

                VStack(spacing: 0) {
                    searchBar
                    if filterByTeam == nil && filterByDepartment == nil {
                        filterRow
                    }
                    Divider().background(ClawColors.separator)
                    agentList
                }
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(ClawColors.backgroundSecondary, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(ClawColors.textSecondary)
                }
                if isMultiSelect {
                    ToolbarItem(placement: .confirmationAction) {
                        Button {
                            let selected = agents.filter { selectedIds.contains($0.id) }
                            onSelect(selected)
                            dismiss()
                        } label: {
                            Text(selectionCount > 0 ? "Done (\(selectionCount))" : "Done")
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(selectionCount > 0 ? ClawColors.accent : ClawColors.textTertiary)
                        }
                        .disabled(selectionCount == 0)
                    }
                }
            }
        }
        .preferredColorScheme(.dark)
        .presentationBackground(ClawColors.backgroundPrimary)
        .presentationDragIndicator(.visible)
    }

    // MARK: - Search Bar

    private var searchBar: some View {
        HStack(spacing: ClawSpacing.sm) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(ClawColors.textTertiary)
                .font(.system(size: 15))
            TextField("Search agents...", text: $searchText)
                .font(.system(size: 15))
                .foregroundStyle(ClawColors.textPrimary)
                .tint(ClawColors.accent)
            if !searchText.isEmpty {
                Button { searchText = "" } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(ClawColors.textTertiary)
                        .font(.system(size: 14))
                }
            }
        }
        .padding(.horizontal, ClawSpacing.md)
        .padding(.vertical, ClawSpacing.sm)
        .background(ClawColors.backgroundSecondary)
        .cornerRadius(ClawRadius.md)
        .padding(.horizontal, ClawSpacing.lg)
        .padding(.vertical, ClawSpacing.sm)
    }

    // MARK: - Filter Row

    private var filterRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: ClawSpacing.sm) {
                filterChip(label: "All Teams", isSelected: selectedTeamFilter == nil) {
                    selectedTeamFilter = nil
                }
                ForEach(availableTeams, id: \.self) { team in
                    filterChip(label: team, isSelected: selectedTeamFilter == team) {
                        selectedTeamFilter = selectedTeamFilter == team ? nil : team
                        selectedDeptFilter = nil
                    }
                }
            }
            .padding(.horizontal, ClawSpacing.lg)
            .padding(.bottom, ClawSpacing.sm)
        }
    }

    private func filterChip(label: String, isSelected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(.system(size: 12, weight: isSelected ? .semibold : .regular))
                .foregroundStyle(isSelected ? .white : ClawColors.textSecondary)
                .padding(.horizontal, ClawSpacing.md)
                .padding(.vertical, 6)
                .background(isSelected ? ClawColors.accent : ClawColors.backgroundSecondary)
                .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }

    // MARK: - Agent List

    private var agentList: some View {
        List {
            if filteredAgents.isEmpty {
                emptyState
                    .listRowBackground(ClawColors.backgroundPrimary)
                    .listRowSeparator(.hidden)
            } else {
                ForEach(filteredAgents) { agent in
                    agentPickerRow(agent: agent)
                        .listRowBackground(ClawColors.backgroundPrimary)
                        .listRowSeparatorTint(ClawColors.separator)
                        .listRowInsets(EdgeInsets(top: 0, leading: ClawSpacing.lg, bottom: 0, trailing: ClawSpacing.lg))
                }
            }
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
    }

    // MARK: - Agent Row

    private func agentPickerRow(agent: Agent) -> some View {
        let isSelected = selectedIds.contains(agent.id)
        let isDisabled = !isSelected && !canSelectMore

        return Button {
            handleSelection(agent: agent)
        } label: {
            HStack(spacing: ClawSpacing.md) {
                AvatarView(name: agent.name, imageUrl: agent.avatarUrl, size: .medium, status: agent.status)

                VStack(alignment: .leading, spacing: 3) {
                    Text(agent.name)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(isDisabled ? ClawColors.textTertiary : ClawColors.textPrimary)

                    HStack(spacing: ClawSpacing.sm) {
                        Text(agent.role)
                            .font(.system(size: 13))
                            .foregroundStyle(ClawColors.textSecondary)
                            .lineLimit(1)

                        if let teamId = agent.teamId {
                            Text("·")
                                .foregroundStyle(ClawColors.textTertiary)
                            Text(teamId)
                                .font(.system(size: 12))
                                .foregroundStyle(ClawColors.textTertiary)
                                .lineLimit(1)
                        }
                    }
                }

                Spacer()

                StatusBadge(status: agent.status, compact: true)

                selectionIndicator(isSelected: isSelected, isDisabled: isDisabled)
            }
            .padding(.vertical, ClawSpacing.md)
            .contentShape(Rectangle())
            .opacity(isDisabled ? 0.4 : 1.0)
        }
        .buttonStyle(.plain)
        .disabled(isDisabled)
    }

    @ViewBuilder
    private func selectionIndicator(isSelected: Bool, isDisabled: Bool) -> some View {
        if isMultiSelect {
            ZStack {
                RoundedRectangle(cornerRadius: 6)
                    .stroke(isSelected ? ClawColors.accent : ClawColors.separator, lineWidth: 2)
                    .frame(width: 24, height: 24)
                if isSelected {
                    RoundedRectangle(cornerRadius: 4)
                        .fill(ClawColors.accent)
                        .frame(width: 16, height: 16)
                    Image(systemName: "checkmark")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(.white)
                }
            }
            .animation(.spring(response: 0.2), value: isSelected)
        } else {
            ZStack {
                Circle()
                    .stroke(isSelected ? ClawColors.accent : ClawColors.separator, lineWidth: 2)
                    .frame(width: 24, height: 24)
                if isSelected {
                    Circle()
                        .fill(ClawColors.accent)
                        .frame(width: 14, height: 14)
                        .transition(.scale)
                }
            }
            .animation(.spring(response: 0.2), value: isSelected)
        }
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: ClawSpacing.md) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 36))
                .foregroundStyle(ClawColors.textTertiary)
            Text("No agents found")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(ClawColors.textSecondary)
            Text("Try adjusting your search or filters")
                .font(.system(size: 14))
                .foregroundStyle(ClawColors.textTertiary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, ClawSpacing.xxxl)
    }

    // MARK: - Selection Handling

    private func handleSelection(agent: Agent) {
        switch mode {
        case .single:
            onSelect([agent])
            dismiss()
        case .multi:
            if selectedIds.contains(agent.id) {
                selectedIds.remove(agent.id)
            } else if canSelectMore {
                selectedIds.insert(agent.id)
            }
        }
    }
}

// MARK: - Convenience Initializers

extension AgentPickerView {
    /// Single-select variant with a simple completion handler
    static func single(
        title: String = "Select Agent",
        filterByTeam: String? = nil,
        filterByDepartment: String? = nil,
        onSelect: @escaping (Agent) -> Void
    ) -> AgentPickerView {
        AgentPickerView(
            mode: .single,
            filterByTeam: filterByTeam,
            filterByDepartment: filterByDepartment,
            title: title
        ) { agents in
            if let first = agents.first { onSelect(first) }
        }
    }

    /// Multi-select variant
    static func multi(
        title: String = "Select Agents",
        maxCount: Int? = nil,
        filterByTeam: String? = nil,
        filterByDepartment: String? = nil,
        onSelect: @escaping ([Agent]) -> Void
    ) -> AgentPickerView {
        AgentPickerView(
            mode: .multi(maxCount: maxCount),
            filterByTeam: filterByTeam,
            filterByDepartment: filterByDepartment,
            title: title,
            onSelect: onSelect
        )
    }
}

// MARK: - Preview

#Preview("Single Select") {
    Color.black.sheet(isPresented: .constant(true)) {
        AgentPickerView.single(title: "Assign Manager") { agent in
            Telemetry.shared.setAgent(agent.id)
        }
    }
}

#Preview("Multi Select") {
    Color.black.sheet(isPresented: .constant(true)) {
        AgentPickerView.multi(title: "Add Team Members", maxCount: 3) { agents in
            Telemetry.shared.event("agent_picker.preview_multi", attributes: ["count": agents.count])
        }
    }
}
