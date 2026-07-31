// TeamSettingsView.swift
// ClawChat – Team and department settings

import SwiftUI

// MARK: - Team Settings ViewModel

@Observable
final class TeamSettingsViewModel {
    var team: Team
    var allAgents: [Agent] = []
    var teamAgents: [Agent] = []
    var availableAgents: [Agent] = []
    var availableDepartments: [Department] = []
    var isSaving = false
    var showDeleteConfirm = false
    var error: String?
    var didSave = false

    // Editable fields
    var name: String
    var description: String
    var colorHex: String
    var leadAgentId: String?
    var departmentId: String

    var hasChanges: Bool {
        name != team.name ||
        description != (team.description ?? "") ||
        colorHex != team.color ||
        leadAgentId != team.leadAgentId ||
        departmentId != team.departmentId
    }

    init(team: Team) {
        self.team = team
        self.name = team.name
        self.description = team.description ?? ""
        self.colorHex = team.color
        self.leadAgentId = team.leadAgentId
        self.departmentId = team.departmentId
    }

    @MainActor
    func load() async {
        let now = Date()
        allAgents = [
            Agent(id: "a1", name: "Alpha Bot", role: "Lead Analyst", avatarUrl: nil, status: .onDuty,
                  teamId: team.id, departmentId: nil, companyId: nil, workspaceId: "ws1",
                  managerId: nil, description: nil, capabilities: [], workingHoursMode: .twentyFourSeven,
                  timezone: "UTC", createdAt: now, updatedAt: now, currentTaskId: nil,
                  tasksCompletedToday: 12, successRate: 0.94, avgCompletionMinutes: 8,
                  totalMinutesWorked: 480, budgetUsed: 1.20, budgetLimit: 10.0),
            Agent(id: "a2", name: "Beta Bot", role: "Processor", avatarUrl: nil, status: .busy,
                  teamId: team.id, departmentId: nil, companyId: nil, workspaceId: "ws1",
                  managerId: nil, description: nil, capabilities: [], workingHoursMode: .twentyFourSeven,
                  timezone: "UTC", createdAt: now, updatedAt: now, currentTaskId: nil,
                  tasksCompletedToday: 8, successRate: 0.88, avgCompletionMinutes: 12,
                  totalMinutesWorked: 360, budgetUsed: 0.90, budgetLimit: 10.0),
            Agent(id: "a3", name: "Gamma Bot", role: "Reviewer", avatarUrl: nil, status: .idle,
                  teamId: nil, departmentId: nil, companyId: nil, workspaceId: "ws1",
                  managerId: nil, description: nil, capabilities: [], workingHoursMode: .scheduled,
                  timezone: "UTC", createdAt: now, updatedAt: now, currentTaskId: nil,
                  tasksCompletedToday: 5, successRate: 0.96, avgCompletionMinutes: 6,
                  totalMinutesWorked: 240, budgetUsed: 0.50, budgetLimit: 10.0),
        ]
        teamAgents = allAgents.filter { $0.teamId == team.id }
        availableAgents = allAgents.filter { $0.teamId != team.id }

        availableDepartments = [
            Department(id: "d1", name: "Engineering", companyId: "c1",
                       headAgentId: nil, description: nil, color: "#0A84FF", agentCount: 10, createdAt: now),
            Department(id: "d2", name: "Operations", companyId: "c1",
                       headAgentId: nil, description: nil, color: "#30D158", agentCount: 8, createdAt: now),
        ]
    }

    @MainActor
    func save() async {
        isSaving = true
        defer { isSaving = false }
        // Simulate network call
        try? await _Concurrency.Task.sleep(nanoseconds: 500_000_000)
        team.name = name
        team.description = description.isEmpty ? nil : description
        team.color = colorHex
        team.leadAgentId = leadAgentId
        team.departmentId = departmentId
        didSave = true
    }

    func addAgent(_ agent: Agent) {
        availableAgents.removeAll { $0.id == agent.id }
        teamAgents.append(agent)
    }

    func removeAgent(_ agent: Agent) {
        teamAgents.removeAll { $0.id == agent.id }
        availableAgents.append(agent)
        if leadAgentId == agent.id {
            leadAgentId = teamAgents.first?.id
        }
    }
}

// MARK: - Team Settings View

struct TeamSettingsView: View {
    @State var viewModel: TeamSettingsViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var showAddAgentSheet = false
    @State private var agentToRemove: Agent?
    @State private var showRemoveConfirm = false

    private let colorOptions = [
        "#0A84FF", "#30D158", "#FF9F0A", "#BF5AF2",
        "#40C8E0", "#FF453A", "#FFD60A", "#32ADE6",
    ]

    init(team: Team) {
        _viewModel = State(initialValue: TeamSettingsViewModel(team: team))
    }

    var body: some View {
        NavigationStack {
            Form {
                // Identity
                Section("Team Identity") {
                    LabeledContent("Name") {
                        TextField("Team name", text: $viewModel.name)
                            .multilineTextAlignment(.trailing)
                            .foregroundStyle(ClawColors.textPrimary)
                    }
                    .listRowBackground(ClawColors.backgroundCard)

                    LabeledContent("Description") {
                        TextField("Optional description", text: $viewModel.description, axis: .vertical)
                            .multilineTextAlignment(.trailing)
                            .foregroundStyle(ClawColors.textPrimary)
                            .lineLimit(3)
                    }
                    .listRowBackground(ClawColors.backgroundCard)
                }
                .listRowSeparatorTint(ClawColors.separator)
                .foregroundStyle(ClawColors.textSecondary)

                // Color
                Section("Team Color") {
                    colorPicker
                        .listRowBackground(ClawColors.backgroundCard)
                }
                .listRowSeparatorTint(ClawColors.separator)

                // Department
                Section("Department") {
                    Picker("Department", selection: $viewModel.departmentId) {
                        ForEach(viewModel.availableDepartments) { dept in
                            HStack {
                                Circle()
                                    .fill(Color(hex: dept.color))
                                    .frame(width: 10, height: 10)
                                Text(dept.name)
                            }
                            .tag(dept.id)
                        }
                    }
                    .listRowBackground(ClawColors.backgroundCard)
                    .foregroundStyle(ClawColors.textPrimary)
                    .tint(ClawColors.accent)
                }
                .listRowSeparatorTint(ClawColors.separator)

                // Lead Agent
                Section("Lead Agent") {
                    Picker("Lead Agent", selection: $viewModel.leadAgentId) {
                        Text("None").tag(String?.none)
                        ForEach(viewModel.teamAgents) { agent in
                            HStack {
                                AvatarView(name: agent.name, imageUrl: agent.avatarUrl, size: .small, status: agent.status)
                                Text(agent.name)
                            }
                            .tag(Optional(agent.id))
                        }
                    }
                    .listRowBackground(ClawColors.backgroundCard)
                    .foregroundStyle(ClawColors.textPrimary)
                    .tint(ClawColors.accent)
                }
                .listRowSeparatorTint(ClawColors.separator)

                // Members
                Section {
                    ForEach(viewModel.teamAgents) { agent in
                        agentRow(agent: agent)
                    }
                    Button {
                        showAddAgentSheet = true
                    } label: {
                        Label("Add Agent", systemImage: "plus")
                            .foregroundStyle(ClawColors.accent)
                    }
                    .listRowBackground(ClawColors.backgroundCard)
                } header: {
                    Text("Team Members (\(viewModel.teamAgents.count))")
                }
                .listRowSeparatorTint(ClawColors.separator)

                // Danger zone
                Section("Danger Zone") {
                    Button(role: .destructive) {
                        viewModel.showDeleteConfirm = true
                    } label: {
                        Label("Delete Team", systemImage: "trash.fill")
                            .foregroundStyle(ClawColors.accentRed)
                    }
                    .listRowBackground(ClawColors.backgroundCard)
                }
                .listRowSeparatorTint(ClawColors.separator)
            }
            .scrollContentBackground(.hidden)
            .background(ClawColors.backgroundPrimary)
            .navigationTitle("Team Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        _Concurrency.Task { await viewModel.save() }
                    }
                    .fontWeight(.semibold)
                    .disabled(!viewModel.hasChanges || viewModel.isSaving)
                }
            }
            .task { await viewModel.load() }
            .onChange(of: viewModel.didSave) { _, saved in
                if saved { dismiss() }
            }
            .sheet(isPresented: $showAddAgentSheet) {
                AddAgentToTeamSheet(availableAgents: viewModel.availableAgents) { agent in
                    viewModel.addAgent(agent)
                }
            }
            .confirmationDialog("Remove Agent", isPresented: $showRemoveConfirm, titleVisibility: .visible) {
                Button("Remove from Team", role: .destructive) {
                    if let agent = agentToRemove {
                        viewModel.removeAgent(agent)
                    }
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("This agent will be unassigned from the team.")
            }
            .confirmationDialog("Delete Team", isPresented: $viewModel.showDeleteConfirm, titleVisibility: .visible) {
                Button("Delete Team", role: .destructive) { dismiss() }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("All agents will be unassigned. This cannot be undone.")
            }
        }
        .preferredColorScheme(.dark)
    }

    // MARK: - Color Picker

    private var colorPicker: some View {
        HStack(spacing: ClawSpacing.md) {
            ForEach(colorOptions, id: \.self) { hex in
                Button {
                    viewModel.colorHex = hex
                } label: {
                    Circle()
                        .fill(Color(hex: hex))
                        .frame(width: 28, height: 28)
                        .overlay(
                            Circle()
                                .stroke(Color.white, lineWidth: viewModel.colorHex == hex ? 2.5 : 0)
                        )
                        .overlay(
                            Circle()
                                .stroke(Color.black.opacity(0.3), lineWidth: viewModel.colorHex == hex ? 4 : 0)
                                .padding(-1)
                        )
                        .scaleEffect(viewModel.colorHex == hex ? 1.15 : 1.0)
                        .animation(.spring(response: 0.2), value: viewModel.colorHex)
                }
                .buttonStyle(.plain)
            }
            Spacer()
        }
        .padding(.vertical, ClawSpacing.xs)
    }

    // MARK: - Agent Row

    private func agentRow(agent: Agent) -> some View {
        HStack(spacing: ClawSpacing.md) {
            AvatarView(name: agent.name, imageUrl: agent.avatarUrl, size: .small, status: agent.status)
            VStack(alignment: .leading, spacing: 1) {
                HStack(spacing: ClawSpacing.xs) {
                    Text(agent.name)
                        .font(ClawFonts.cardTitle)
                        .foregroundStyle(ClawColors.textPrimary)
                    if agent.id == viewModel.leadAgentId {
                        Text("Lead")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(ClawColors.accentOrange)
                            .padding(.horizontal, 4)
                            .padding(.vertical, 1)
                            .background(ClawColors.accentOrange.opacity(0.15))
                            .clipShape(Capsule())
                    }
                }
                Text(agent.role)
                    .font(ClawFonts.caption)
                    .foregroundStyle(ClawColors.textSecondary)
            }
            Spacer()
            Button {
                agentToRemove = agent
                showRemoveConfirm = true
            } label: {
                Image(systemName: "minus.circle.fill")
                    .font(.system(size: 18))
                    .foregroundStyle(ClawColors.accentRed)
            }
            .buttonStyle(.plain)
        }
        .listRowBackground(ClawColors.backgroundCard)
    }
}

// MARK: - Add Agent Sheet

struct AddAgentToTeamSheet: View {
    let availableAgents: [Agent]
    let onAdd: (Agent) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var searchText = ""

    private var filtered: [Agent] {
        if searchText.isEmpty { return availableAgents }
        return availableAgents.filter {
            $0.name.localizedCaseInsensitiveContains(searchText) ||
            $0.role.localizedCaseInsensitiveContains(searchText)
        }
    }

    var body: some View {
        NavigationStack {
            Group {
                if filtered.isEmpty {
                    VStack(spacing: ClawSpacing.md) {
                        Spacer()
                        Image(systemName: "person.slash")
                            .font(.system(size: 40))
                            .foregroundStyle(ClawColors.textTertiary)
                        Text("No available agents")
                            .font(.system(size: 17, weight: .semibold))
                            .foregroundStyle(ClawColors.textSecondary)
                        Spacer()
                    }
                } else {
                    List {
                        ForEach(filtered) { agent in
                            Button {
                                onAdd(agent)
                                dismiss()
                            } label: {
                                HStack(spacing: ClawSpacing.md) {
                                    AvatarView(name: agent.name, imageUrl: agent.avatarUrl, size: .small, status: agent.status)
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(agent.name)
                                            .font(ClawFonts.cardTitle)
                                            .foregroundStyle(ClawColors.textPrimary)
                                        Text(agent.role)
                                            .font(ClawFonts.caption)
                                            .foregroundStyle(ClawColors.textSecondary)
                                    }
                                    Spacer()
                                    Image(systemName: "plus.circle")
                                        .foregroundStyle(ClawColors.accent)
                                }
                            }
                            .buttonStyle(.plain)
                            .listRowBackground(ClawColors.backgroundCard)
                            .listRowSeparatorTint(ClawColors.separator)
                        }
                    }
                    .listStyle(.insetGrouped)
                    .scrollContentBackground(.hidden)
                }
            }
            .background(ClawColors.backgroundPrimary)
            .navigationTitle("Add Agent")
            .navigationBarTitleDisplayMode(.inline)
            .searchable(text: $searchText, placement: .navigationBarDrawer(displayMode: .always))
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
        .preferredColorScheme(.dark)
    }
}

// MARK: - Department Settings ViewModel

@Observable
final class DepartmentSettingsViewModel {
    var department: Department
    var allTeams: [Team] = []
    var departmentTeams: [Team] = []
    var availableTeams: [Team] = []
    var headCandidates: [Agent] = []
    var isSaving = false
    var showDeleteConfirm = false
    var error: String?
    var didSave = false

    var name: String
    var description: String
    var colorHex: String
    var headAgentId: String?

    var hasChanges: Bool {
        name != department.name ||
        description != (department.description ?? "") ||
        colorHex != department.color ||
        headAgentId != department.headAgentId
    }

    init(department: Department) {
        self.department = department
        self.name = department.name
        self.description = department.description ?? ""
        self.colorHex = department.color
        self.headAgentId = department.headAgentId
    }

    @MainActor
    func load() async {
        let now = Date()
        allTeams = [
            Team(id: "tm1", name: "Alpha Squad", departmentId: department.id,
                 leadAgentId: "a1", description: nil, color: "#0A84FF", agentCount: 4, createdAt: now),
            Team(id: "tm2", name: "Beta Unit", departmentId: department.id,
                 leadAgentId: "a4", description: nil, color: "#40C8E0", agentCount: 3, createdAt: now),
            Team(id: "tm3", name: "Gamma Force", departmentId: "other",
                 leadAgentId: nil, description: nil, color: "#BF5AF2", agentCount: 2, createdAt: now),
        ]
        departmentTeams = allTeams.filter { $0.departmentId == department.id }
        availableTeams = allTeams.filter { $0.departmentId != department.id }

        headCandidates = [
            Agent(id: "a1", name: "Alpha Bot", role: "Lead", avatarUrl: nil, status: .onDuty,
                  teamId: "tm1", departmentId: department.id, companyId: nil, workspaceId: "ws1",
                  managerId: nil, description: nil, capabilities: [], workingHoursMode: .twentyFourSeven,
                  timezone: "UTC", createdAt: now, updatedAt: now, currentTaskId: nil,
                  tasksCompletedToday: 12, successRate: 0.94, avgCompletionMinutes: 8,
                  totalMinutesWorked: 480, budgetUsed: 1.20, budgetLimit: 10.0),
        ]
    }

    @MainActor
    func save() async {
        isSaving = true
        defer { isSaving = false }
        try? await _Concurrency.Task.sleep(nanoseconds: 500_000_000)
        department.name = name
        department.description = description.isEmpty ? nil : description
        department.color = colorHex
        department.headAgentId = headAgentId
        didSave = true
    }

    func addTeam(_ team: Team) {
        availableTeams.removeAll { $0.id == team.id }
        departmentTeams.append(team)
    }

    func removeTeam(_ team: Team) {
        departmentTeams.removeAll { $0.id == team.id }
        availableTeams.append(team)
    }
}

// MARK: - Department Settings View

struct DepartmentSettingsView: View {
    @State var viewModel: DepartmentSettingsViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var showAddTeamSheet = false
    @State private var teamToRemove: Team?
    @State private var showRemoveTeamConfirm = false

    private let colorOptions = [
        "#0A84FF", "#30D158", "#FF9F0A", "#BF5AF2",
        "#40C8E0", "#FF453A", "#FFD60A", "#32ADE6",
    ]

    init(department: Department) {
        _viewModel = State(initialValue: DepartmentSettingsViewModel(department: department))
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Department Identity") {
                    LabeledContent("Name") {
                        TextField("Department name", text: $viewModel.name)
                            .multilineTextAlignment(.trailing)
                            .foregroundStyle(ClawColors.textPrimary)
                    }
                    .listRowBackground(ClawColors.backgroundCard)

                    LabeledContent("Description") {
                        TextField("Optional", text: $viewModel.description, axis: .vertical)
                            .multilineTextAlignment(.trailing)
                            .foregroundStyle(ClawColors.textPrimary)
                            .lineLimit(3)
                    }
                    .listRowBackground(ClawColors.backgroundCard)
                }
                .listRowSeparatorTint(ClawColors.separator)
                .foregroundStyle(ClawColors.textSecondary)

                Section("Department Color") {
                    colorPicker
                        .listRowBackground(ClawColors.backgroundCard)
                }
                .listRowSeparatorTint(ClawColors.separator)

                Section("Head Agent") {
                    Picker("Head Agent", selection: $viewModel.headAgentId) {
                        Text("None").tag(String?.none)
                        ForEach(viewModel.headCandidates) { agent in
                            HStack {
                                AvatarView(name: agent.name, imageUrl: agent.avatarUrl, size: .small, status: agent.status)
                                Text(agent.name)
                            }
                            .tag(Optional(agent.id))
                        }
                    }
                    .listRowBackground(ClawColors.backgroundCard)
                    .foregroundStyle(ClawColors.textPrimary)
                    .tint(ClawColors.accent)
                }
                .listRowSeparatorTint(ClawColors.separator)

                Section {
                    ForEach(viewModel.departmentTeams) { team in
                        teamRow(team: team)
                    }
                    Button {
                        showAddTeamSheet = true
                    } label: {
                        Label("Add Team", systemImage: "plus")
                            .foregroundStyle(ClawColors.accent)
                    }
                    .listRowBackground(ClawColors.backgroundCard)
                } header: {
                    Text("Teams (\(viewModel.departmentTeams.count))")
                }
                .listRowSeparatorTint(ClawColors.separator)

                Section("Danger Zone") {
                    Button(role: .destructive) {
                        viewModel.showDeleteConfirm = true
                    } label: {
                        Label("Delete Department", systemImage: "trash.fill")
                            .foregroundStyle(ClawColors.accentRed)
                    }
                    .listRowBackground(ClawColors.backgroundCard)
                }
                .listRowSeparatorTint(ClawColors.separator)
            }
            .scrollContentBackground(.hidden)
            .background(ClawColors.backgroundPrimary)
            .navigationTitle("Department Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        _Concurrency.Task { await viewModel.save() }
                    }
                    .fontWeight(.semibold)
                    .disabled(!viewModel.hasChanges || viewModel.isSaving)
                }
            }
            .task { await viewModel.load() }
            .onChange(of: viewModel.didSave) { _, saved in
                if saved { dismiss() }
            }
            .sheet(isPresented: $showAddTeamSheet) {
                AddTeamToDeptSheet(availableTeams: viewModel.availableTeams) { team in
                    viewModel.addTeam(team)
                }
            }
            .confirmationDialog("Remove Team", isPresented: $showRemoveTeamConfirm, titleVisibility: .visible) {
                Button("Remove from Department", role: .destructive) {
                    if let team = teamToRemove { viewModel.removeTeam(team) }
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("The team will be unassigned from this department.")
            }
            .confirmationDialog("Delete Department", isPresented: $viewModel.showDeleteConfirm, titleVisibility: .visible) {
                Button("Delete Department", role: .destructive) { dismiss() }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("All teams will be unassigned. This cannot be undone.")
            }
        }
        .preferredColorScheme(.dark)
    }

    private var colorPicker: some View {
        HStack(spacing: ClawSpacing.md) {
            ForEach(colorOptions, id: \.self) { hex in
                Button {
                    viewModel.colorHex = hex
                } label: {
                    Circle()
                        .fill(Color(hex: hex))
                        .frame(width: 28, height: 28)
                        .overlay(
                            Circle()
                                .stroke(Color.white, lineWidth: viewModel.colorHex == hex ? 2.5 : 0)
                        )
                        .scaleEffect(viewModel.colorHex == hex ? 1.15 : 1.0)
                        .animation(.spring(response: 0.2), value: viewModel.colorHex)
                }
                .buttonStyle(.plain)
            }
            Spacer()
        }
        .padding(.vertical, ClawSpacing.xs)
    }

    private func teamRow(team: Team) -> some View {
        HStack(spacing: ClawSpacing.md) {
            ZStack {
                RoundedRectangle(cornerRadius: 6)
                    .fill(Color(hex: team.color).opacity(0.2))
                    .frame(width: 28, height: 28)
                Image(systemName: "person.3.fill")
                    .font(.system(size: 12))
                    .foregroundStyle(Color(hex: team.color))
            }
            VStack(alignment: .leading, spacing: 1) {
                Text(team.name)
                    .font(ClawFonts.cardTitle)
                    .foregroundStyle(ClawColors.textPrimary)
                Text("\(team.agentCount) agents")
                    .font(ClawFonts.caption)
                    .foregroundStyle(ClawColors.textSecondary)
            }
            Spacer()
            Button {
                teamToRemove = team
                showRemoveTeamConfirm = true
            } label: {
                Image(systemName: "minus.circle.fill")
                    .font(.system(size: 18))
                    .foregroundStyle(ClawColors.accentRed)
            }
            .buttonStyle(.plain)
        }
        .listRowBackground(ClawColors.backgroundCard)
    }
}

// MARK: - Add Team to Dept Sheet

struct AddTeamToDeptSheet: View {
    let availableTeams: [Team]
    let onAdd: (Team) -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Group {
                if availableTeams.isEmpty {
                    VStack(spacing: ClawSpacing.md) {
                        Spacer()
                        Image(systemName: "person.3")
                            .font(.system(size: 40))
                            .foregroundStyle(ClawColors.textTertiary)
                        Text("No available teams")
                            .font(.system(size: 17, weight: .semibold))
                            .foregroundStyle(ClawColors.textSecondary)
                        Spacer()
                    }
                    .background(ClawColors.backgroundPrimary)
                } else {
                    List {
                        ForEach(availableTeams) { team in
                            Button {
                                onAdd(team)
                                dismiss()
                            } label: {
                                HStack(spacing: ClawSpacing.md) {
                                    ZStack {
                                        RoundedRectangle(cornerRadius: 6)
                                            .fill(Color(hex: team.color).opacity(0.2))
                                            .frame(width: 32, height: 32)
                                        Image(systemName: "person.3.fill")
                                            .font(.system(size: 13))
                                            .foregroundStyle(Color(hex: team.color))
                                    }
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(team.name)
                                            .font(ClawFonts.cardTitle)
                                            .foregroundStyle(ClawColors.textPrimary)
                                        Text("\(team.agentCount) agents")
                                            .font(ClawFonts.caption)
                                            .foregroundStyle(ClawColors.textSecondary)
                                    }
                                    Spacer()
                                    Image(systemName: "plus.circle")
                                        .foregroundStyle(ClawColors.accent)
                                }
                            }
                            .buttonStyle(.plain)
                            .listRowBackground(ClawColors.backgroundCard)
                            .listRowSeparatorTint(ClawColors.separator)
                        }
                    }
                    .listStyle(.insetGrouped)
                    .scrollContentBackground(.hidden)
                    .background(ClawColors.backgroundPrimary)
                }
            }
            .background(ClawColors.backgroundPrimary)
            .navigationTitle("Add Team")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
        .preferredColorScheme(.dark)
    }
}

// MARK: - Preview

#Preview("Team Settings") {
    TeamSettingsView(team: Team(
        id: "t1", name: "Alpha Squad", departmentId: "d1",
        leadAgentId: "a1", description: "Core ops", color: "#0A84FF",
        agentCount: 5, createdAt: Date()
    ))
}

#Preview("Department Settings") {
    DepartmentSettingsView(department: Department(
        id: "d1", name: "Engineering", companyId: "c1",
        headAgentId: "a1", description: "Core engineering", color: "#0A84FF",
        agentCount: 10, createdAt: Date()
    ))
}
