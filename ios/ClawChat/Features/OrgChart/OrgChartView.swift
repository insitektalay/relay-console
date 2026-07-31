// OrgChartView.swift
// ClawChat – Interactive org chart hierarchy browser

import SwiftUI

// MARK: - ViewModel

@Observable
final class OrgChartViewState {
    var companies: [Company] = []
    var departments: [Department] = []
    var teams: [Team] = []
    var agents: [Agent] = []
    var expandedNodes: Set<String> = []
    var selectedCompanyId: String? = nil
    var showOnlyOnDuty: Bool = false
    var viewMode: OrgChartViewMode = .tree
    var isLoading = false
    var error: String?

    // Card view selection
    var selectedDepartmentId: String? = nil
    var selectedTeamId: String? = nil

    var filteredCompanies: [Company] {
        guard let id = selectedCompanyId else { return companies }
        return companies.filter { $0.id == id }
    }

    func departments(forCompany id: String) -> [Department] {
        departments.filter { $0.companyId == id }
    }

    func teams(forDepartment id: String) -> [Team] {
        teams.filter { $0.departmentId == id }
    }

    func agents(forTeam id: String) -> [Agent] {
        let all = agents.filter { $0.teamId == id }
        return showOnlyOnDuty ? all.filter { $0.status == .onDuty || $0.status == .busy } : all
    }

    func isExpanded(_ nodeId: String) -> Bool {
        expandedNodes.contains(nodeId)
    }

    func toggleExpand(_ nodeId: String) {
        if expandedNodes.contains(nodeId) {
            expandedNodes.remove(nodeId)
        } else {
            expandedNodes.insert(nodeId)
        }
    }

    func expandAll() {
        for c in companies { expandedNodes.insert("company-\(c.id)") }
        for d in departments { expandedNodes.insert("department-\(d.id)") }
        for t in teams { expandedNodes.insert("team-\(t.id)") }
    }

    func collapseAll() {
        expandedNodes.removeAll()
    }

    func populate(companies: [Company], departments: [Department], teams: [Team], agents: [Agent]) {
        self.companies = companies
        self.departments = departments
        self.teams = teams
        self.agents = agents
        if selectedCompanyId == nil {
            selectedCompanyId = companies.first?.id
        }
        if selectedDepartmentId == nil {
            selectedDepartmentId = departments.first?.id
        }
        for c in companies { expandedNodes.insert("company-\(c.id)") }
    }

    @MainActor
    func load() async {
        // Data is populated from AppStore via populate(). No-op.
    }

    @MainActor
    private func loadMockData() async {
        let now = Date()

        companies = [
            Company(id: "c1", name: "Acme Corp", workspaceId: "ws1", avatarUrl: nil,
                    description: "Primary operations company", industry: "Technology", createdAt: now),
        ]

        departments = [
            Department(id: "d1", name: "Engineering", companyId: "c1", headAgentId: "a1",
                       description: "Core engineering teams", color: "#0A84FF", agentCount: 10, createdAt: now),
            Department(id: "d2", name: "Operations", companyId: "c1", headAgentId: "a6",
                       description: "Operations and logistics", color: "#30D158", agentCount: 8, createdAt: now),
            Department(id: "d3", name: "Finance", companyId: "c1", headAgentId: "a9",
                       description: "Finance automation", color: "#BF5AF2", agentCount: 5, createdAt: now),
        ]

        teams = [
            Team(id: "tm1", name: "Alpha Squad", departmentId: "d1", leadAgentId: "a1",
                 description: "Platform engineering", color: "#0A84FF", agentCount: 4, createdAt: now),
            Team(id: "tm2", name: "Beta Unit", departmentId: "d1", leadAgentId: "a4",
                 description: "Product integrations", color: "#40C8E0", agentCount: 3, createdAt: now),
            Team(id: "tm3", name: "Ops Core", departmentId: "d2", leadAgentId: "a6",
                 description: "Core operations", color: "#30D158", agentCount: 4, createdAt: now),
            Team(id: "tm4", name: "Logistics", departmentId: "d2", leadAgentId: "a8",
                 description: "Logistics automation", color: "#FFD60A", agentCount: 3, createdAt: now),
            Team(id: "tm5", name: "Finance Bots", departmentId: "d3", leadAgentId: "a9",
                 description: "Finance processing", color: "#BF5AF2", agentCount: 5, createdAt: now),
        ]

        agents = [
            // Alpha Squad
            Agent(id: "a1", name: "Alpha Bot", role: "Lead Analyst", avatarUrl: nil, status: .onDuty,
                  teamId: "tm1", departmentId: "d1", companyId: "c1", workspaceId: "ws1",
                  managerId: nil, description: nil, capabilities: [], workingHoursMode: .twentyFourSeven,
                  timezone: "UTC", createdAt: now, updatedAt: now, currentTaskId: nil,
                  tasksCompletedToday: 12, successRate: 0.94, avgCompletionMinutes: 8,
                  totalMinutesWorked: 480, budgetUsed: 1.20, budgetLimit: 10.0),
            Agent(id: "a2", name: "Beta Bot", role: "Processor", avatarUrl: nil, status: .busy,
                  teamId: "tm1", departmentId: "d1", companyId: "c1", workspaceId: "ws1",
                  managerId: nil, description: nil, capabilities: [], workingHoursMode: .twentyFourSeven,
                  timezone: "UTC", createdAt: now, updatedAt: now, currentTaskId: "t1",
                  tasksCompletedToday: 8, successRate: 0.88, avgCompletionMinutes: 12,
                  totalMinutesWorked: 360, budgetUsed: 0.90, budgetLimit: 10.0),
            Agent(id: "a3", name: "Gamma Bot", role: "Reviewer", avatarUrl: nil, status: .idle,
                  teamId: "tm1", departmentId: "d1", companyId: "c1", workspaceId: "ws1",
                  managerId: nil, description: nil, capabilities: [], workingHoursMode: .scheduled,
                  timezone: "UTC", createdAt: now, updatedAt: now, currentTaskId: nil,
                  tasksCompletedToday: 5, successRate: 0.96, avgCompletionMinutes: 6,
                  totalMinutesWorked: 240, budgetUsed: 0.50, budgetLimit: 10.0),
            // Beta Unit
            Agent(id: "a4", name: "Delta Bot", role: "Lead Integration", avatarUrl: nil, status: .onDuty,
                  teamId: "tm2", departmentId: "d1", companyId: "c1", workspaceId: "ws1",
                  managerId: nil, description: nil, capabilities: [], workingHoursMode: .twentyFourSeven,
                  timezone: "UTC", createdAt: now, updatedAt: now, currentTaskId: nil,
                  tasksCompletedToday: 15, successRate: 0.97, avgCompletionMinutes: 5,
                  totalMinutesWorked: 480, budgetUsed: 0.75, budgetLimit: 10.0),
            Agent(id: "a5", name: "Epsilon Bot", role: "Connector", avatarUrl: nil, status: .error,
                  teamId: "tm2", departmentId: "d1", companyId: "c1", workspaceId: "ws1",
                  managerId: nil, description: nil, capabilities: [], workingHoursMode: .manual,
                  timezone: "UTC", createdAt: now, updatedAt: now, currentTaskId: nil,
                  tasksCompletedToday: 2, successRate: 0.72, avgCompletionMinutes: 20,
                  totalMinutesWorked: 60, budgetUsed: 0.30, budgetLimit: 10.0),
            // Ops Core
            Agent(id: "a6", name: "Zeta Bot", role: "Lead Ops", avatarUrl: nil, status: .onDuty,
                  teamId: "tm3", departmentId: "d2", companyId: "c1", workspaceId: "ws1",
                  managerId: nil, description: nil, capabilities: [], workingHoursMode: .twentyFourSeven,
                  timezone: "UTC", createdAt: now, updatedAt: now, currentTaskId: nil,
                  tasksCompletedToday: 20, successRate: 0.95, avgCompletionMinutes: 4,
                  totalMinutesWorked: 480, budgetUsed: 0.60, budgetLimit: 10.0),
            Agent(id: "a7", name: "Eta Bot", role: "Monitor", avatarUrl: nil, status: .paused,
                  teamId: "tm3", departmentId: "d2", companyId: "c1", workspaceId: "ws1",
                  managerId: nil, description: nil, capabilities: [], workingHoursMode: .scheduled,
                  timezone: "UTC", createdAt: now, updatedAt: now, currentTaskId: nil,
                  tasksCompletedToday: 3, successRate: 0.80, avgCompletionMinutes: 15,
                  totalMinutesWorked: 120, budgetUsed: 0.25, budgetLimit: 10.0),
            // Logistics
            Agent(id: "a8", name: "Theta Bot", role: "Lead Logistics", avatarUrl: nil, status: .busy,
                  teamId: "tm4", departmentId: "d2", companyId: "c1", workspaceId: "ws1",
                  managerId: nil, description: nil, capabilities: [], workingHoursMode: .twentyFourSeven,
                  timezone: "UTC", createdAt: now, updatedAt: now, currentTaskId: "t2",
                  tasksCompletedToday: 9, successRate: 0.91, avgCompletionMinutes: 10,
                  totalMinutesWorked: 300, budgetUsed: 0.80, budgetLimit: 10.0),
            // Finance Bots
            Agent(id: "a9", name: "Iota Bot", role: "Lead Finance", avatarUrl: nil, status: .onDuty,
                  teamId: "tm5", departmentId: "d3", companyId: "c1", workspaceId: "ws1",
                  managerId: nil, description: nil, capabilities: [], workingHoursMode: .twentyFourSeven,
                  timezone: "UTC", createdAt: now, updatedAt: now, currentTaskId: nil,
                  tasksCompletedToday: 18, successRate: 0.98, avgCompletionMinutes: 3,
                  totalMinutesWorked: 480, budgetUsed: 0.45, budgetLimit: 10.0),
        ]

        // Start with companies expanded
        for c in companies { expandedNodes.insert("company-\(c.id)") }
        selectedCompanyId = companies.first?.id
        selectedDepartmentId = departments.first?.id
    }
}

enum OrgChartViewMode: String, CaseIterable {
    case tree = "Tree"
    case card = "Card"
}

// MARK: - Main View

struct OrgChartView: View {
    @State var viewModel: OrgChartViewState
    @State private var navigationPath = NavigationPath()
    @State private var selectedNode: OrgNodeKind?
    @State private var showNodeDetail = false
    @State private var showCreateSheet = false
    @EnvironmentObject private var appStore: AppStore

    init() {
        _viewModel = State(initialValue: OrgChartViewState())
    }

    var body: some View {
        NavigationStack(path: $navigationPath) {
            VStack(spacing: 0) {
                controlBar
                    .padding(.horizontal, ClawSpacing.lg)
                    .padding(.vertical, ClawSpacing.md)

                Divider().background(ClawColors.separator)

                if appStore.selectedWorkspace == nil {
                    RelayInlineEmptyState(
                        icon: "lock.fill",
                        title: "Org Structure unavailable",
                        subtitle: "Select a Relay workspace to load companies, departments, teams, and agents."
                    )
                    .padding(RelaySpacing.lg)
                } else if viewModel.isLoading {
                    loadingView
                } else if viewModel.companies.isEmpty && viewModel.departments.isEmpty && viewModel.teams.isEmpty {
                    RelayInlineEmptyState(
                        icon: "building.2",
                        title: "No organisation yet",
                        subtitle: "Create a company to begin a Relay organisation structure."
                    )
                    .padding(RelaySpacing.lg)
                } else {
                    switch viewModel.viewMode {
                    case .tree:
                        treeView
                    case .card:
                        cardView
                    }
                }
            }
            .background(ClawColors.backgroundPrimary)
            .navigationTitle("Org Structure")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItemGroup(placement: .primaryAction) {
                    if viewModel.viewMode == .tree {
                        Menu {
                            Button("Expand All") { viewModel.expandAll() }
                            Button("Collapse All") { viewModel.collapseAll() }
                        } label: {
                            Image(systemName: "arrow.up.and.down.text.horizontal")
                                .foregroundStyle(ClawColors.accent)
                        }
                    }
                    Button {
                        showCreateSheet = true
                    } label: {
                        Image(systemName: "plus")
                            .foregroundStyle(ClawColors.accent)
                    }
                    .disabled(appStore.selectedWorkspace == nil)
                    .accessibilityLabel("Create organisation item")
                    .accessibilityValue(appStore.selectedWorkspace == nil ? "Unavailable until a Relay workspace is selected" : "")
                }
            }
            .task {
                viewModel.populate(
                    companies: appStore.companies,
                    departments: appStore.departments,
                    teams: appStore.teams,
                    agents: appStore.agents
                )
            }
            .sheet(isPresented: $showNodeDetail) {
                if let node = selectedNode {
                    OrgNodeDetailView(kind: node)
                }
            }
            .sheet(isPresented: $showCreateSheet) {
                OrgCreateSheet(
                    workspaceId: appStore.selectedWorkspace?.id ?? "",
                    companies: viewModel.companies,
                    departments: viewModel.departments
                ) {
                    viewModel.populate(
                        companies: appStore.companies,
                        departments: appStore.departments,
                        teams: appStore.teams,
                        agents: appStore.agents
                    )
                    _Concurrency.Task {
                        if appStore.selectedWorkspace != nil {
                            try? await appStore.syncCompanies()
                            try? await appStore.syncDepartments()
                            try? await appStore.syncTeams()
                            viewModel.populate(
                                companies: appStore.companies,
                                departments: appStore.departments,
                                teams: appStore.teams,
                                agents: appStore.agents
                            )
                        }
                    }
                }
            }
            .navigationDestination(for: Team.self) { team in
                TeamDashboardView(team: team)
            }
            .navigationDestination(for: Department.self) { dept in
                DepartmentDashboardView(department: dept)
            }
        }
    }

    // MARK: - Control Bar

    private var controlBar: some View {
        HStack(spacing: ClawSpacing.md) {
            // View mode toggle
            Picker("View", selection: $viewModel.viewMode) {
                ForEach(OrgChartViewMode.allCases, id: \.self) { mode in
                    Label(mode.rawValue, systemImage: mode == .tree ? "list.bullet.indent" : "square.grid.3x3")
                        .tag(mode)
                }
            }
            .pickerStyle(.segmented)
            .frame(width: 160)

            Spacer()

            // Company filter (only if multiple)
            if viewModel.companies.count > 1 {
                Menu {
                    Button("All Companies") { viewModel.selectedCompanyId = nil }
                    ForEach(viewModel.companies) { company in
                        Button(company.name) { viewModel.selectedCompanyId = company.id }
                    }
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "building.2")
                            .font(.system(size: 13))
                        Text(viewModel.selectedCompanyId.flatMap { id in viewModel.companies.first { $0.id == id }?.name } ?? "All")
                            .font(ClawFonts.label)
                    }
                    .foregroundStyle(ClawColors.accent)
                    .padding(.horizontal, ClawSpacing.sm)
                    .padding(.vertical, ClawSpacing.xs)
                    .background(ClawColors.accent.opacity(0.1))
                    .clipShape(Capsule())
                }
            }

            // On duty toggle
            Toggle(isOn: $viewModel.showOnlyOnDuty) {
                Image(systemName: "person.fill.checkmark")
                    .font(.system(size: 13))
            }
            .toggleStyle(.button)
            .tint(ClawColors.accentGreen)
            .font(.system(size: 13))
        }
    }

    // MARK: - Tree View

    private var treeView: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                ForEach(viewModel.filteredCompanies) { company in
                    companyTreeNode(company: company)
                }
            }
            .padding(.vertical, ClawSpacing.sm)
        }
    }

    @ViewBuilder
    private func companyTreeNode(company: Company) -> some View {
        let nodeId = "company-\(company.id)"
        let isExpanded = viewModel.isExpanded(nodeId)

        Group {
            OrgNodeView(
                kind: .company(company),
                isExpanded: isExpanded,
                hasChildren: !viewModel.departments(forCompany: company.id).isEmpty,
                depth: 0
            ) {
                selectedNode = .company(company)
                showNodeDetail = true
            } onExpandToggle: {
                viewModel.toggleExpand(nodeId)
            }

            if isExpanded {
                ForEach(viewModel.departments(forCompany: company.id)) { dept in
                    departmentTreeNode(dept: dept)
                }
            }
        }
    }

    @ViewBuilder
    private func departmentTreeNode(dept: Department) -> some View {
        let nodeId = "department-\(dept.id)"
        let isExpanded = viewModel.isExpanded(nodeId)

        Group {
            OrgNodeView(
                kind: .department(dept),
                isExpanded: isExpanded,
                hasChildren: !viewModel.teams(forDepartment: dept.id).isEmpty,
                depth: 1
            ) {
                navigationPath.append(dept)
            } onExpandToggle: {
                viewModel.toggleExpand(nodeId)
            }

            if isExpanded {
                ForEach(viewModel.teams(forDepartment: dept.id)) { team in
                    teamTreeNode(team: team)
                }
            }
        }
    }

    @ViewBuilder
    private func teamTreeNode(team: Team) -> some View {
        let nodeId = "team-\(team.id)"
        let isExpanded = viewModel.isExpanded(nodeId)
        let teamAgents = viewModel.agents(forTeam: team.id)

        Group {
            OrgNodeView(
                kind: .team(team),
                isExpanded: isExpanded,
                hasChildren: !teamAgents.isEmpty,
                depth: 2
            ) {
                navigationPath.append(team)
            } onExpandToggle: {
                viewModel.toggleExpand(nodeId)
            }

            if isExpanded {
                ForEach(teamAgents) { agent in
                    OrgNodeView(
                        kind: .agent(agent),
                        hasChildren: false,
                        depth: 3,
                        isLead: agent.id == team.leadAgentId
                    ) {
                        selectedNode = .agent(agent)
                        showNodeDetail = true
                    }
                }
            }
        }
    }

    // MARK: - Card View

    private var cardView: some View {
        HStack(spacing: 0) {
            // Companies column
            cardColumn(title: "Companies") {
                ForEach(viewModel.filteredCompanies) { company in
                    OrgCardNode(
                        kind: .company(company),
                        isSelected: viewModel.selectedCompanyId == company.id
                    ) {
                        viewModel.selectedCompanyId = company.id
                        viewModel.selectedDepartmentId = viewModel.departments(forCompany: company.id).first?.id
                        viewModel.selectedTeamId = nil
                    }
                }
            }

            columnDivider

            // Departments column
            if let companyId = viewModel.selectedCompanyId {
                cardColumn(title: "Departments") {
                    ForEach(viewModel.departments(forCompany: companyId)) { dept in
                        OrgCardNode(
                            kind: .department(dept),
                            isSelected: viewModel.selectedDepartmentId == dept.id
                        ) {
                            viewModel.selectedDepartmentId = dept.id
                            viewModel.selectedTeamId = viewModel.teams(forDepartment: dept.id).first?.id
                        }
                    }
                }
            }

            columnDivider

            // Teams column
            if let deptId = viewModel.selectedDepartmentId {
                cardColumn(title: "Teams") {
                    ForEach(viewModel.teams(forDepartment: deptId)) { team in
                        OrgCardNode(
                            kind: .team(team),
                            isSelected: viewModel.selectedTeamId == team.id
                        ) {
                            viewModel.selectedTeamId = team.id
                        }
                    }
                }
            }

            columnDivider

            // Agents column
            if let teamId = viewModel.selectedTeamId {
                let selectedTeam = viewModel.teams.first { $0.id == teamId }
                cardColumn(title: "Agents") {
                    ForEach(viewModel.agents(forTeam: teamId)) { agent in
                        OrgCardNode(
                            kind: .agent(agent),
                            isSelected: false
                        ) {
                            selectedNode = .agent(agent)
                            showNodeDetail = true
                        }
                        .overlay(alignment: .topTrailing) {
                            if agent.id == selectedTeam?.leadAgentId {
                                Text("LEAD")
                                    .font(.system(size: 8, weight: .bold))
                                    .foregroundStyle(.white)
                                    .padding(.horizontal, 4)
                                    .padding(.vertical, 2)
                                    .background(ClawColors.accentOrange)
                                    .clipShape(Capsule())
                                    .padding(6)
                            }
                        }
                    }
                }
            } else {
                Spacer()
            }
        }
        .background(ClawColors.backgroundPrimary)
    }

    @ViewBuilder
    private func cardColumn<Content: View>(title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(title.uppercased())
                .font(ClawFonts.sectionHeader)
                .foregroundStyle(ClawColors.textTertiary)
                .padding(.horizontal, ClawSpacing.md)
                .padding(.top, ClawSpacing.md)
                .padding(.bottom, ClawSpacing.sm)

            ScrollView {
                LazyVStack(spacing: ClawSpacing.sm) {
                    content()
                }
                .padding(.horizontal, ClawSpacing.sm)
                .padding(.bottom, ClawSpacing.lg)
            }
        }
        .frame(maxWidth: .infinity)
    }

    private var columnDivider: some View {
        Rectangle()
            .fill(ClawColors.separator)
            .frame(width: 0.5)
    }

    // MARK: - Loading

    private var loadingView: some View {
        ScrollView {
            VStack(spacing: ClawSpacing.xs) {
                ForEach(0..<8, id: \.self) { i in
                    HStack {
                        Spacer().frame(width: CGFloat(i % 3) * 20)
                        RoundedRectangle(cornerRadius: ClawRadius.sm)
                            .fill(ClawColors.backgroundCard)
                            .frame(height: 44)
                            .shimmer()
                    }
                }
            }
            .padding(ClawSpacing.lg)
        }
    }
}

// MARK: - Node Detail View

struct OrgNodeDetailView: View {
    let kind: OrgNodeKind
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: ClawSpacing.xl) {
                    // Icon + Name
                    VStack(spacing: ClawSpacing.md) {
                        ZStack {
                            Circle()
                                .fill(kind.accentColor.opacity(0.15))
                                .frame(width: 80, height: 80)
                            if case .agent(let a) = kind {
                                AvatarView(name: a.name, imageUrl: a.avatarUrl, size: .large, status: a.status)
                            } else {
                                Image(systemName: kind.systemIcon)
                                    .font(.system(size: 32, weight: .semibold))
                                    .foregroundStyle(kind.accentColor)
                            }
                        }
                        .padding(.top, ClawSpacing.xl)

                        Text(kind.displayName)
                            .font(.system(size: 24, weight: .bold))
                            .foregroundStyle(ClawColors.textPrimary)

                        if let sub = kind.subtitle {
                            Text(sub)
                                .font(.system(size: 15))
                                .foregroundStyle(ClawColors.textSecondary)
                        }
                    }

                    // Stats for agent
                    if case .agent(let a) = kind {
                        agentStats(agent: a)
                    }

                    // Count for non-agent
                    if let count = kind.childCount {
                        HStack(spacing: ClawSpacing.lg) {
                            VStack {
                                Text("\(count)")
                                    .font(.system(size: 28, weight: .bold))
                                    .foregroundStyle(kind.accentColor)
                                Text("Agents")
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
                    }

                    Spacer(minLength: ClawSpacing.xxxl)
                }
            }
            .background(ClawColors.backgroundPrimary)
            .navigationTitle("Details")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }

    private func agentStats(agent: Agent) -> some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: ClawSpacing.sm) {
            statCell(value: "\(agent.tasksCompletedToday)", label: "Today", color: ClawColors.accentGreen)
            statCell(value: String(format: "%.0f%%", agent.successRate * 100), label: "Success", color: ClawColors.accent)
            statCell(value: "\(agent.avgCompletionMinutes)m", label: "Avg Time", color: ClawColors.accentPurple)
        }
        .padding(.horizontal, ClawSpacing.lg)
    }

    private func statCell(value: String, label: String, color: Color) -> some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.system(size: 20, weight: .bold))
                .foregroundStyle(color)
            Text(label)
                .font(.system(size: 11))
                .foregroundStyle(ClawColors.textSecondary)
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
}

// MARK: - OrgCreateSheet

private enum OrgCreateKind: String, CaseIterable {
    case company    = "Company"
    case department = "Department"
    case team       = "Team"
}

struct OrgCreateSheet: View {
    let workspaceId: String
    let companies: [Company]
    let departments: [Department]
    var onCreated: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var kind: OrgCreateKind = .company
    @State private var name: String = ""
    @State private var description: String = ""
    @State private var selectedCompanyId: String = ""
    @State private var selectedDepartmentId: String = ""
    @State private var isSaving = false
    @State private var saveError: String?

    var body: some View {
        NavigationStack {
            ZStack {
                ClawColors.backgroundPrimary.ignoresSafeArea()

                Form {
                    Section("Type") {
                        Picker("Create", selection: $kind) {
                            ForEach(OrgCreateKind.allCases, id: \.self) { k in
                                Text(k.rawValue).tag(k)
                            }
                        }
                        .pickerStyle(.segmented)
                    }
                    .listRowBackground(ClawColors.backgroundCard)

                    Section("Details") {
                        TextField("Name", text: $name)
                            .foregroundStyle(ClawColors.textPrimary)

                        if kind != .company {
                            TextField("Description (optional)", text: $description)
                                .foregroundStyle(ClawColors.textPrimary)
                        }
                    }
                    .listRowBackground(ClawColors.backgroundCard)

                    if kind == .department && !companies.isEmpty {
                        Section("Company") {
                            Picker("Company", selection: $selectedCompanyId) {
                                ForEach(companies) { company in
                                    Text(company.name).tag(company.id)
                                }
                            }
                            .pickerStyle(.menu)
                            .foregroundStyle(ClawColors.textPrimary)
                            .onAppear {
                                if selectedCompanyId.isEmpty {
                                    selectedCompanyId = companies.first?.id ?? ""
                                }
                            }
                        }
                        .listRowBackground(ClawColors.backgroundCard)
                    }

                    if kind == .team && !departments.isEmpty {
                        Section("Department") {
                            Picker("Department", selection: $selectedDepartmentId) {
                                ForEach(departments) { dept in
                                    Text(dept.name).tag(dept.id)
                                }
                            }
                            .pickerStyle(.menu)
                            .foregroundStyle(ClawColors.textPrimary)
                            .onAppear {
                                if selectedDepartmentId.isEmpty {
                                    selectedDepartmentId = departments.first?.id ?? ""
                                }
                            }
                        }
                        .listRowBackground(ClawColors.backgroundCard)
                    }

                    if let err = saveError {
                        Section {
                            Text(err)
                                .foregroundStyle(ClawColors.accentRed)
                                .font(.system(size: 13))
                        }
                        .listRowBackground(ClawColors.backgroundCard)
                    }
                }
                .scrollContentBackground(.hidden)
            }
            .navigationTitle("Create \(kind.rawValue)")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(ClawColors.backgroundPrimary, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(ClawColors.accent)
                }
                ToolbarItem(placement: .confirmationAction) {
                    if isSaving {
                        ProgressView().tint(ClawColors.accent)
                    } else {
                        Button("Create") {
                            _Concurrency.Task { await create() }
                        }
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(name.trimmingCharacters(in: .whitespaces).isEmpty ? ClawColors.textTertiary : ClawColors.accent)
                        .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty)
                    }
                }
            }
            .preferredColorScheme(.dark)
        }
    }

    private func create() async {
        let trimmedName = name.trimmingCharacters(in: .whitespaces)
        guard !trimmedName.isEmpty else { return }
        isSaving = true
        saveError = nil
        let trimmedDesc = description.trimmingCharacters(in: .whitespaces)
        do {
            switch kind {
            case .company:
                let _: Company = try await APIClient.shared.request(
                    .createCompany(workspaceId: workspaceId, name: trimmedName)
                )
            case .department:
                guard !selectedCompanyId.isEmpty else {
                    saveError = "Please select a company."
                    isSaving = false
                    return
                }
                let _: Department = try await APIClient.shared.request(
                    .createDepartment(companyId: selectedCompanyId, name: trimmedName,
                                      description: trimmedDesc.isEmpty ? nil : trimmedDesc)
                )
            case .team:
                guard !selectedDepartmentId.isEmpty else {
                    saveError = "Please select a department."
                    isSaving = false
                    return
                }
                let _: Team = try await APIClient.shared.request(
                    .createTeam(departmentId: selectedDepartmentId, name: trimmedName,
                                description: trimmedDesc.isEmpty ? nil : trimmedDesc)
                )
            }
            onCreated()
            dismiss()
        } catch {
            saveError = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
        isSaving = false
    }
}

// MARK: - Preview

#Preview {
    OrgChartView()
        .environmentObject(AppStore.preview)
        .preferredColorScheme(.dark)
}
