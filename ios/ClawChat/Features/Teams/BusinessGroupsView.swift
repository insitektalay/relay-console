// BusinessGroupsView.swift
// ClawChat - mobile Groups surface aligned to the web Groups workflow.

import SwiftUI
import UIKit

enum BusinessGroupsTab: String, CaseIterable {
    case structure = "Business Structure"
    case classify = "Classify Agents"
    case calendar = "Agent Work Calendar"
}

enum GroupFilter: String, CaseIterable {
    case all = "All"
    case personal = "Personal"
    case family = "Family"
    case business = "Business"

    var apiValue: String? {
        self == .all ? nil : rawValue.lowercased()
    }
}

struct BusinessGroupsView: View {
    @EnvironmentObject private var appStore: AppStore

    @State private var selectedTab: BusinessGroupsTab = .structure
    @State private var classificationFilter: GroupFilter = .all
    @State private var companyName = ""
    @State private var departmentName = ""
    @State private var teamName = ""
    @State private var selectedCompanyId = ""
    @State private var selectedDepartmentId = ""
    @State private var searchText = ""
    @State private var error: String?
    @State private var isSaving = false
    @State private var isLoadingCalendar = false
    @State private var workCalendar: AgentWorkCalendarResponse?

    private let showsTabPicker: Bool
    private let showsNavigationTitle: Bool

    init(
        initialTab: BusinessGroupsTab = .structure,
        initialClassificationFilter: GroupFilter = .all,
        showsTabPicker: Bool = true,
        showsNavigationTitle: Bool = true
    ) {
        _selectedTab = State(initialValue: initialTab)
        _classificationFilter = State(initialValue: initialClassificationFilter)
        self.showsTabPicker = showsTabPicker
        self.showsNavigationTitle = showsNavigationTitle
    }

    private var filteredDepartments: [Department] {
        guard !selectedCompanyId.isEmpty else { return appStore.departments }
        return appStore.departments.filter { $0.companyId == selectedCompanyId }
    }

    private var filteredTeams: [Team] {
        guard !selectedDepartmentId.isEmpty else { return appStore.teams }
        return appStore.teams.filter { $0.departmentId == selectedDepartmentId }
    }

    private var filteredAgents: [Agent] {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        return appStore.agents.filter { agent in
            let matchesQuery = query.isEmpty ||
                agent.name.localizedCaseInsensitiveContains(query) ||
                agent.role.localizedCaseInsensitiveContains(query)
            let matchesGroup = classificationFilter.apiValue == nil ||
                normalizedGroupType(for: agent) == classificationFilter.apiValue
            return matchesQuery && matchesGroup
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: ClawSpacing.lg) {
                if showsTabPicker {
                    Picker("Groups", selection: $selectedTab) {
                        ForEach(BusinessGroupsTab.allCases, id: \.self) { tab in
                            Text(tab.rawValue).tag(tab)
                        }
                    }
                    .pickerStyle(.segmented)
                }

                if let error {
                    MissionErrorPanel(message: error)
                }

                switch selectedTab {
                case .structure:
                    structureTab
                case .classify:
                    classifyTab
                case .calendar:
                    calendarTab
                }
            }
            .padding(ClawSpacing.lg)
        }
        .navigationTitle(showsNavigationTitle ? "Groups" : "")
        .navigationBarTitleDisplayMode(.inline)
        .missionScreenBackground()
        .refreshable { await refresh() }
        .task { await refresh() }
        .onChange(of: selectedTab) { _, tab in
            if tab == .calendar {
                _Concurrency.Task { await loadWorkCalendar() }
            }
        }
        .onChange(of: classificationFilter) { _, _ in
            if selectedTab == .calendar {
                _Concurrency.Task { await loadWorkCalendar() }
            }
        }
    }

    private var structureTab: some View {
        VStack(alignment: .leading, spacing: ClawSpacing.lg) {
            MissionPanel {
                MissionSectionHeader(title: "Create Organization", subtitle: "Top-level business container")
                TextField("Name", text: $companyName)
                    .missionTextField()
                Button {
                    _Concurrency.Task { await createCompany() }
                } label: {
                    Label("Create Organization", systemImage: "building.2.fill")
                }
                .buttonStyle(MissionButtonStyle(size: .sm, variant: .primary))
                .disabled(companyName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isSaving)
            }

            MissionPanel {
                MissionSectionHeader(title: "Create Department", subtitle: "Department-level reporting and inbox structure")
                LabeledValueRow(
                    label: "Organization",
                    value: appStore.companies.first(where: { $0.id == selectedCompanyId })?.name ?? "Select organization",
                    systemImage: "building.2.fill"
                )
                .disabled(appStore.companies.isEmpty)
                .onTapGesture {
                    selectedCompanyId = selectedCompanyId
                }

                Picker("Organization", selection: $selectedCompanyId) {
                    Text("Select organization").tag("")
                    ForEach(appStore.companies) { company in
                        Text(company.name).tag(company.id)
                    }
                }
                .labelsHidden()

                TextField("Name", text: $departmentName)
                    .missionTextField()
                Button {
                    _Concurrency.Task { await createDepartment() }
                } label: {
                    Label("Create Department", systemImage: "rectangle.3.group.fill")
                }
                .buttonStyle(MissionButtonStyle(size: .sm, variant: .primary))
                .disabled(selectedCompanyId.isEmpty || departmentName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isSaving)
            }

            MissionPanel {
                MissionSectionHeader(title: "Create Team", subtitle: "Team dashboards, memory, and handovers")
                Picker("Department", selection: $selectedDepartmentId) {
                    Text("Select department").tag("")
                    ForEach(filteredDepartments) { department in
                        Text(department.name).tag(department.id)
                    }
                }
                TextField("Name", text: $teamName)
                    .missionTextField()
                Button {
                    _Concurrency.Task { await createTeam() }
                } label: {
                    Label("Create Team", systemImage: "person.3.fill")
                }
                .buttonStyle(MissionButtonStyle(size: .sm, variant: .primary))
                .disabled(selectedDepartmentId.isEmpty || teamName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isSaving)
            }

            structureSummary
        }
    }

    private var structureSummary: some View {
        MissionPanel {
            MissionSectionHeader(title: "Current Business Structure")
            MissionMetaRow(label: "Organizations", value: "\(appStore.companies.count)", icon: "building.2.fill")
            MissionMetaRow(label: "Departments", value: "\(appStore.departments.count)", icon: "rectangle.3.group.fill")
            MissionMetaRow(label: "Teams", value: "\(appStore.teams.count)", icon: "person.3.fill")
            MissionMetaRow(label: "Agents", value: "\(appStore.agents.count)", icon: "cpu.fill")

            ForEach(appStore.companies) { company in
                VStack(alignment: .leading, spacing: ClawSpacing.sm) {
                    Text(company.name)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(ClawColors.textPrimary)
                    ForEach(appStore.departments.filter { $0.companyId == company.id }) { department in
                        Text("  \(department.name)")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(ClawColors.textSecondary)
                        ForEach(appStore.teams.filter { $0.departmentId == department.id }) { team in
                            Text("    \(team.name)")
                                .font(.system(size: 12))
                                .foregroundStyle(ClawColors.textTertiary)
                        }
                    }
                }
                .padding(.top, ClawSpacing.sm)
            }
        }
    }

    private var classifyTab: some View {
        VStack(alignment: .leading, spacing: ClawSpacing.md) {
            TextField("Search agents", text: $searchText)
                .missionTextField()

            Picker("Classification", selection: $classificationFilter) {
                ForEach(GroupFilter.allCases, id: \.self) { filter in
                    Text(filter.rawValue).tag(filter)
                }
            }
            .pickerStyle(.segmented)

            ForEach(filteredAgents) { agent in
                AgentClassificationCard(
                    agent: agent,
                    companies: appStore.companies,
                    departments: appStore.departments,
                    teams: appStore.teams,
                    isSaving: isSaving
                ) { params in
                    _Concurrency.Task { @MainActor in
                        await updateAgent(agent, params: params)
                    }
                }
            }
        }
    }

    private var calendarTab: some View {
        VStack(alignment: .leading, spacing: ClawSpacing.md) {
            Picker("Calendar Group", selection: $classificationFilter) {
                ForEach(GroupFilter.allCases, id: \.self) { filter in
                    Text(filter.rawValue).tag(filter)
                }
            }
            .pickerStyle(.segmented)

            MissionPanel {
                MissionSectionHeader(title: "Agent Work Calendar", subtitle: "Work activity by day from thread analytics")
                if isLoadingCalendar {
                    ProgressView()
                        .frame(maxWidth: .infinity, minHeight: 160)
                } else if let workCalendar {
                    WorkCalendarGrid(calendar: workCalendar, agents: appStore.agents)
                } else {
                    VStack(spacing: ClawSpacing.sm) {
                        Image(systemName: "calendar")
                            .font(.system(size: 26, weight: .semibold))
                            .foregroundStyle(ClawColors.textTertiary)
                        Text("No calendar data")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(ClawColors.textPrimary)
                        Text("No agent work periods were returned for this date range.")
                            .font(.system(size: 12))
                            .foregroundStyle(ClawColors.textSecondary)
                            .multilineTextAlignment(.center)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, ClawSpacing.xl)
                }
            }
        }
    }

    private func createCompany() async {
        guard let workspaceId = appStore.selectedWorkspace?.id else { return }
        await save {
            let _: Company = try await APIClient.shared.request(.createCompany(workspaceId: workspaceId, name: companyName.trimmingCharacters(in: .whitespacesAndNewlines)))
            companyName = ""
            try await appStore.syncCompanies(workspaceId: workspaceId)
        }
    }

    private func createDepartment() async {
        guard let workspaceId = appStore.selectedWorkspace?.id else { return }
        await save {
            let _: Department = try await APIClient.shared.request(.createDepartment(companyId: selectedCompanyId, name: departmentName.trimmingCharacters(in: .whitespacesAndNewlines), description: nil))
            departmentName = ""
            try await appStore.syncDepartments(workspaceId: workspaceId)
        }
    }

    private func createTeam() async {
        guard let workspaceId = appStore.selectedWorkspace?.id else { return }
        await save {
            let _: Team = try await APIClient.shared.request(.createTeam(departmentId: selectedDepartmentId, name: teamName.trimmingCharacters(in: .whitespacesAndNewlines), description: nil))
            teamName = ""
            try await appStore.syncTeams(workspaceId: workspaceId)
        }
    }

    private func updateAgent(_ agent: Agent, params: [String: Any]) async {
        guard let workspaceId = appStore.selectedWorkspace?.id else { return }
        await save {
            let _: Agent = try await APIClient.shared.request(.updateAgent(id: agent.id, params: params))
            try await appStore.syncAgents(workspaceId: workspaceId)
            if selectedTab == .calendar {
                await loadWorkCalendar()
            }
        }
    }

    private func save(_ operation: () async throws -> Void) async {
        isSaving = true
        error = nil
        defer { isSaving = false }
        do {
            try await operation()
        } catch {
            self.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
            Telemetry.shared.capture(error: error, attributes: ["operation": "groups.save"])
        }
    }

    private func refresh() async {
        guard let workspaceId = appStore.selectedWorkspace?.id else { return }
        try? await appStore.syncCompanies(workspaceId: workspaceId)
        try? await appStore.syncDepartments(workspaceId: workspaceId)
        try? await appStore.syncTeams(workspaceId: workspaceId)
        try? await appStore.syncAgents(workspaceId: workspaceId)
        if selectedTab == .calendar {
            await loadWorkCalendar()
        }
    }

    private func loadWorkCalendar() async {
        guard let workspaceId = appStore.selectedWorkspace?.id else { return }
        isLoadingCalendar = true
        error = nil
        defer { isLoadingCalendar = false }
        do {
            let today = Date()
            let start = Calendar.current.date(byAdding: .day, value: -6, to: today) ?? today
            workCalendar = try await APIClient.shared.request(
                .agentWorkCalendar(
                    workspaceId: workspaceId,
                    startDate: Self.dayFormatter.string(from: start),
                    endDate: Self.dayFormatter.string(from: today),
                    groupType: classificationFilter.apiValue,
                    activityGapMinutes: 30,
                    timeZone: TimeZone.current.identifier
                )
            )
        } catch {
            self.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
            Telemetry.shared.capture(error: error, attributes: ["operation": "groups.agent_work_calendar"])
        }
    }

    private func normalizedGroupType(for agent: Agent) -> String {
        if let groupType = agent.groupType, !groupType.isEmpty {
            return groupType.lowercased()
        }
        return (agent.companyId != nil || agent.departmentId != nil || agent.teamId != nil) ? "business" : "personal"
    }

    private static let dayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()
}

// MARK: - Focused organization tools used by the Agents menu

private enum OrganizationCreationKind: String, CaseIterable, Identifiable {
    case organization = "Organization"
    case department = "Department"
    case team = "Team"

    var id: String { rawValue }

    var icon: String {
        switch self {
        case .organization: return "building.2"
        case .department: return "rectangle.3.group"
        case .team: return "person.3"
        }
    }

    var color: Color {
        switch self {
        case .organization: return RelayColors.accentGreen
        case .department: return RelayColors.accent
        case .team: return RelayColors.accentOrange
        }
    }
}

struct CreateOrganizationToolView: View {
    let workspaceId: String

    @EnvironmentObject private var appStore: AppStore
    @State private var kind: OrganizationCreationKind = .organization
    @State private var organizationName = ""
    @State private var departmentName = ""
    @State private var teamName = ""
    @State private var companyId = ""
    @State private var departmentId = ""
    @State private var isSaving = false
    @State private var error: String?
    @State private var notice: String?

    private var departments: [Department] {
        companyId.isEmpty ? appStore.departments : appStore.departments.filter { $0.companyId == companyId }
    }

    var body: some View {
        ScrollView {
            VStack(spacing: RelaySpacing.lg) {
                toolTitle("Create Org")
                creationSegments
                if let error { RelayStatusStrip(title: "Could not create \(kind.rawValue.lowercased())", detail: error, tone: .failure, icon: "exclamationmark.triangle.fill") }
                if let notice { RelayStatusStrip(title: notice, detail: "Relay organisation data has been refreshed.", tone: .success, icon: "checkmark.circle.fill") }
                creationPanel
                guidancePanel
            }
            .padding(RelaySpacing.lg)
        }
        .relayScreenBackground()
        .navigationBarTitleDisplayMode(.inline)
        .task { await refreshHierarchy() }
    }

    private var creationSegments: some View {
        HStack(spacing: 0) {
            ForEach(OrganizationCreationKind.allCases) { item in
                Button {
                    kind = item
                    error = nil
                    notice = nil
                } label: {
                    Label(item.rawValue, systemImage: item.icon)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(kind == item ? item.color : RelayColors.textSecondary)
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .background(kind == item ? item.color.opacity(0.12) : Color.clear)
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(kind == item ? item.color.opacity(0.62) : Color.clear))
                }
                .buttonStyle(.plain)
                .accessibilityValue(kind == item ? "Selected" : "")
            }
        }
        .padding(3)
        .background(Color(hex: "#081321"))
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.white.opacity(0.1)))
    }

    @ViewBuilder
    private var creationPanel: some View {
        switch kind {
        case .organization:
            formPanel(
                title: "Create organization",
                subtitle: "Create the top-level container before adding departments or teams.",
                icon: kind.icon,
                color: kind.color
            ) {
                toolField("Organization name", placeholder: "Organization name", text: $organizationName)
                createButton("Create organization", color: kind.color, disabled: organizationName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty) {
                    await createOrganization()
                }
            }
        case .department:
            formPanel(
                title: "Create department",
                subtitle: "Add a department inside an existing organization.",
                icon: kind.icon,
                color: kind.color
            ) {
                toolPicker(title: "Organization", value: selectedCompanyName, color: kind.color) {
                    Button("Select organization") { companyId = "" }
                    ForEach(appStore.companies) { company in
                        Button(company.name) { companyId = company.id }
                    }
                }
                toolField("Department name", placeholder: "Department name", text: $departmentName)
                createButton("Create department", color: kind.color, disabled: companyId.isEmpty || departmentName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty) {
                    await createDepartment()
                }
            }
        case .team:
            formPanel(
                title: "Create team",
                subtitle: "Add an optional working team inside a department.",
                icon: kind.icon,
                color: kind.color
            ) {
                toolPicker(title: "Organization", value: selectedCompanyName, color: kind.color) {
                    Button("All organizations") { companyId = ""; departmentId = "" }
                    ForEach(appStore.companies) { company in
                        Button(company.name) { companyId = company.id; departmentId = "" }
                    }
                }
                toolPicker(title: "Department", value: selectedDepartmentName, color: kind.color) {
                    Button("Select department") { departmentId = "" }
                    ForEach(departments) { department in
                        Button(department.name) { departmentId = department.id; companyId = department.companyId }
                    }
                }
                toolField("Team name", placeholder: "Team name", text: $teamName)
                createButton("Create team", color: kind.color, disabled: departmentId.isEmpty || teamName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty) {
                    await createTeam()
                }
            }
        }
    }

    private var guidancePanel: some View {
        HStack(alignment: .top, spacing: RelaySpacing.sm) {
            Image(systemName: "info.circle")
                .foregroundStyle(RelayColors.textSecondary)
            Text(guidanceText)
                .font(.system(size: 12))
                .foregroundStyle(RelayColors.textSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(RelaySpacing.md)
        .background(Color(hex: "#081321"))
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.white.opacity(0.1)))
    }

    private var guidanceText: String {
        switch kind {
        case .organization: return "After creating an organization, you can add departments and teams."
        case .department: return "Departments belong to one organization and can contain agents and teams."
        case .team: return "Teams are optional and always belong to a department."
        }
    }

    private var selectedCompanyName: String {
        appStore.companies.first(where: { $0.id == companyId })?.name ?? "Select organization"
    }

    private var selectedDepartmentName: String {
        departments.first(where: { $0.id == departmentId })?.name ?? "Select department"
    }

    private func createOrganization() async {
        await save {
            let name = organizationName.trimmingCharacters(in: .whitespacesAndNewlines)
            let company: Company = try await APIClient.shared.request(.createCompany(workspaceId: workspaceId, name: name))
            organizationName = ""
            notice = "\(company.name) created"
            try await appStore.syncCompanies(workspaceId: workspaceId)
        }
    }

    private func createDepartment() async {
        await save {
            let name = departmentName.trimmingCharacters(in: .whitespacesAndNewlines)
            let department: Department = try await APIClient.shared.request(.createDepartment(companyId: companyId, name: name, description: nil))
            departmentName = ""
            notice = "\(department.name) created"
            try await appStore.syncDepartments(workspaceId: workspaceId)
        }
    }

    private func createTeam() async {
        await save {
            let name = teamName.trimmingCharacters(in: .whitespacesAndNewlines)
            let team: Team = try await APIClient.shared.request(.createTeam(departmentId: departmentId, name: name, description: nil))
            teamName = ""
            notice = "\(team.name) created"
            try await appStore.syncTeams(workspaceId: workspaceId)
        }
    }

    private func save(_ operation: () async throws -> Void) async {
        guard !isSaving else { return }
        isSaving = true
        error = nil
        notice = nil
        defer { isSaving = false }
        do { try await operation() }
        catch { self.error = (error as? APIError)?.errorDescription ?? error.localizedDescription }
    }

    private func refreshHierarchy() async {
        guard !workspaceId.isEmpty else { return }
        try? await appStore.syncCompanies(workspaceId: workspaceId)
        try? await appStore.syncDepartments(workspaceId: workspaceId)
        try? await appStore.syncTeams(workspaceId: workspaceId)
    }

    private func formPanel<Content: View>(
        title: String,
        subtitle: String,
        icon: String,
        color: Color,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: RelaySpacing.lg) {
            Image(systemName: icon)
                .font(.system(size: 22, weight: .semibold))
                .foregroundStyle(color)
                .frame(width: 44, height: 44)
                .background(color.opacity(0.12))
                .clipShape(RoundedRectangle(cornerRadius: 10))
            VStack(alignment: .leading, spacing: 5) {
                Text(title).font(.system(size: 20, weight: .bold)).foregroundStyle(.white)
                Text(subtitle).font(.system(size: 14)).foregroundStyle(RelayColors.textSecondary)
            }
            content()
        }
        .padding(RelaySpacing.lg)
        .background(Color(hex: "#081321"))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(color.opacity(0.34)))
    }

    private func toolField(_ title: String, placeholder: String, text: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: RelaySpacing.sm) {
            Text(title).font(.system(size: 12, weight: .semibold)).foregroundStyle(.white)
            TextField(placeholder, text: text)
                .textInputAutocapitalization(.words)
                .padding(.horizontal, RelaySpacing.md)
                .frame(minHeight: 48)
                .background(Color(hex: "#0A111B"))
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.white.opacity(0.14)))
        }
    }

    private func toolPicker<Content: View>(title: String, value: String, color: Color, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: RelaySpacing.sm) {
            Text(title).font(.system(size: 12, weight: .semibold)).foregroundStyle(.white)
            Menu(content: content) {
                HStack {
                    Text(value).lineLimit(1)
                    Spacer()
                    Image(systemName: "chevron.down")
                }
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(value.hasPrefix("Select") ? RelayColors.textSecondary : .white)
                .padding(.horizontal, RelaySpacing.md)
                .frame(maxWidth: .infinity, minHeight: 48)
                .background(Color(hex: "#0A111B"))
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(color.opacity(0.4)))
            }
        }
    }

    private func createButton(_ title: String, color: Color, disabled: Bool, action: @escaping () async -> Void) -> some View {
        Button { _Concurrency.Task { await action() } } label: {
            HStack {
                if isSaving { ProgressView().tint(.white) }
                Text(isSaving ? "Creating…" : title)
            }
            .font(.system(size: 15, weight: .semibold))
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity, minHeight: 48)
            .background(color.opacity(disabled || isSaving ? 0.2 : 0.42))
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(color.opacity(disabled || isSaving ? 0.2 : 0.7)))
        }
        .buttonStyle(.plain)
        .disabled(disabled || isSaving)
    }
}

struct OrganizationStructureToolView: View {
    let workspaceId: String

    @EnvironmentObject private var appStore: AppStore
    @State private var placement: AgentPlacementFilter = .business
    @State private var companyId = ""
    @State private var departmentId = ""
    @State private var teamId = ""
    @State private var expandedDepartmentIds = Set<String>()

    private var departments: [Department] {
        appStore.departments.filter { department in
            (companyId.isEmpty || department.companyId == companyId) &&
            (departmentId.isEmpty || department.id == departmentId) &&
            (teamId.isEmpty || appStore.teams.contains { $0.id == teamId && $0.departmentId == department.id })
        }
    }

    private var departmentOptions: [Department] {
        companyId.isEmpty ? appStore.departments : appStore.departments.filter { $0.companyId == companyId }
    }

    private var teamOptions: [Team] {
        if !departmentId.isEmpty { return appStore.teams.filter { $0.departmentId == departmentId } }
        let ids = Set(departmentOptions.map(\.id))
        return appStore.teams.filter { ids.contains($0.departmentId) }
    }

    private var nonBusinessAgents: [Agent] {
        appStore.agents.filter { AgentPlacementFilter.placement(for: $0) == placement }
    }

    var body: some View {
        ScrollView {
            VStack(spacing: RelaySpacing.md) {
                HStack {
                    toolTitle("Org Structure")
                    Spacer()
                    Image(systemName: "slider.horizontal.3")
                        .foregroundStyle(RelayColors.textSecondary)
                }
                placementFilters
                hierarchyFilters

                if placement == .business {
                    if departments.isEmpty {
                        RelayEmptyState(icon: "rectangle.3.group", title: "No departments", subtitle: "No departments match the selected organization filters.")
                    } else {
                        ForEach(departments) { department in departmentCard(department) }
                    }
                } else {
                    placementAgentCard
                }
            }
            .padding(RelaySpacing.lg)
        }
        .relayScreenBackground()
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await refreshHierarchy() }
        .task { await refreshHierarchy() }
    }

    private var placementFilters: some View {
        HStack(spacing: RelaySpacing.sm) {
            ForEach(AgentPlacementFilter.allCases) { item in
                let color = placementColor(item)
                Button { placement = item } label: {
                    Label(item.rawValue, systemImage: placementIcon(item))
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(placement == item ? color : RelayColors.textSecondary)
                        .frame(maxWidth: .infinity, minHeight: 40)
                        .background(placement == item ? color.opacity(0.12) : Color(hex: "#081321"))
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(placement == item ? color.opacity(0.65) : Color.white.opacity(0.1)))
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var hierarchyFilters: some View {
        HStack(spacing: RelaySpacing.sm) {
            structureMenu(label: selectedCompanyName, color: RelayColors.accentGreen) {
                Button("All organizations") { companyId = ""; departmentId = ""; teamId = "" }
                ForEach(appStore.companies) { company in Button(company.name) { companyId = company.id; departmentId = ""; teamId = "" } }
            }
            structureMenu(label: selectedDepartmentName, color: RelayColors.accent) {
                Button("All departments") { departmentId = ""; teamId = "" }
                ForEach(departmentOptions) { department in Button(department.name) { companyId = department.companyId; departmentId = department.id; teamId = "" } }
            }
            structureMenu(label: selectedTeamName, color: RelayColors.accentOrange) {
                Button("All teams") { teamId = "" }
                ForEach(teamOptions) { team in
                    Button(team.name) {
                        teamId = team.id
                        departmentId = team.departmentId
                        companyId = appStore.departments.first(where: { $0.id == team.departmentId })?.companyId ?? companyId
                    }
                }
            }
        }
        .disabled(placement != .business)
        .opacity(placement == .business ? 1 : 0.55)
    }

    private func departmentCard(_ department: Department) -> some View {
        let company = appStore.companies.first(where: { $0.id == department.companyId })
        let teams = appStore.teams.filter { $0.departmentId == department.id && (teamId.isEmpty || $0.id == teamId) }
        let agents = appStore.agents.filter { agent in
            agent.departmentId == department.id && (teamId.isEmpty || agent.teamId == teamId)
        }
        let expanded = expandedDepartmentIds.contains(department.id)

        return VStack(spacing: 0) {
            Button {
                if expanded { expandedDepartmentIds.remove(department.id) }
                else { expandedDepartmentIds.insert(department.id) }
            } label: {
                HStack(spacing: RelaySpacing.md) {
                    Image(systemName: "rectangle.3.group")
                        .font(.system(size: 20))
                        .foregroundStyle(RelayColors.accent)
                        .frame(width: 38, height: 38)
                        .background(RelayColors.accent.opacity(0.12))
                        .clipShape(RoundedRectangle(cornerRadius: 9))
                    VStack(alignment: .leading, spacing: 3) {
                        Text(department.name).font(.system(size: 15, weight: .semibold)).foregroundStyle(.white)
                        Text(company?.name ?? "No organization").font(.system(size: 11)).foregroundStyle(RelayColors.textSecondary)
                    }
                    Spacer()
                    Text("\(agents.count)")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 9).padding(.vertical, 5)
                        .background(Color.white.opacity(0.08)).clipShape(RoundedRectangle(cornerRadius: 5))
                    Image(systemName: expanded ? "chevron.up" : "chevron.down")
                        .font(.caption.weight(.bold)).foregroundStyle(RelayColors.textSecondary)
                }
                .padding(RelaySpacing.md)
            }
            .buttonStyle(.plain)

            HStack(spacing: RelaySpacing.sm) {
                Label("\(teams.count) teams", systemImage: "person.3")
                Label("\(agents.count) agents", systemImage: "person.2")
                Spacer()
            }
            .font(.system(size: 10, weight: .medium))
            .foregroundStyle(RelayColors.textSecondary)
            .padding(.horizontal, RelaySpacing.md)
            .padding(.bottom, RelaySpacing.sm)

            if expanded {
                Divider().overlay(Color.white.opacity(0.08))
                VStack(alignment: .leading, spacing: RelaySpacing.sm) {
                    if teams.isEmpty { Text("No teams").font(.caption).foregroundStyle(RelayColors.textTertiary) }
                    ForEach(teams) { team in
                        HStack {
                            Image(systemName: "person.3.fill").foregroundStyle(RelayColors.accentOrange)
                            Text(team.name).font(.system(size: 12, weight: .semibold)).foregroundStyle(.white)
                            Spacer()
                            Text("\(agents.filter { $0.teamId == team.id }.count) agents").font(.caption).foregroundStyle(RelayColors.textSecondary)
                        }
                    }
                    if !agents.isEmpty {
                        HStack(spacing: -7) {
                            ForEach(Array(agents.prefix(8))) { agent in
                                RelayAvatar(name: agent.name, imageUrl: agent.avatarUrl, size: .small, status: agent.status)
                                    .overlay(Circle().stroke(Color(hex: "#081321"), lineWidth: 2))
                            }
                            Spacer()
                        }
                    }
                }
                .padding(RelaySpacing.md)
            }
        }
        .background(Color(hex: "#081321"))
        .clipShape(RoundedRectangle(cornerRadius: 11))
        .overlay(RoundedRectangle(cornerRadius: 11).stroke(expanded ? RelayColors.accent.opacity(0.6) : Color.white.opacity(0.12)))
    }

    private var placementAgentCard: some View {
        VStack(spacing: 0) {
            if nonBusinessAgents.isEmpty {
                RelayEmptyState(icon: placementIcon(placement), title: "No \(placement.rawValue) agents", subtitle: "Agents assigned to this placement will appear here.")
            } else {
                ForEach(nonBusinessAgents) { agent in
                    HStack(spacing: RelaySpacing.sm) {
                        RelayAvatar(name: agent.name, imageUrl: agent.avatarUrl, size: .medium, status: agent.status)
                        VStack(alignment: .leading) {
                            Text(agent.name).font(.system(size: 14, weight: .semibold)).foregroundStyle(.white)
                            Text(agent.groupLabel ?? "Unassigned").font(.caption).foregroundStyle(RelayColors.textSecondary)
                        }
                        Spacer()
                        placementPill(for: agent)
                    }
                    .padding(RelaySpacing.md)
                    Divider().overlay(Color.white.opacity(0.07)).padding(.leading, 65)
                }
            }
        }
        .background(Color(hex: "#081321"))
        .clipShape(RoundedRectangle(cornerRadius: 11))
        .overlay(RoundedRectangle(cornerRadius: 11).stroke(Color.white.opacity(0.1)))
    }

    private var selectedCompanyName: String { appStore.companies.first(where: { $0.id == companyId })?.name ?? "All organizations" }
    private var selectedDepartmentName: String { appStore.departments.first(where: { $0.id == departmentId })?.name ?? "All departments" }
    private var selectedTeamName: String { appStore.teams.first(where: { $0.id == teamId })?.name ?? "All teams" }

    private func structureMenu<Content: View>(label: String, color: Color, @ViewBuilder content: () -> Content) -> some View {
        Menu(content: content) {
            HStack(spacing: 5) {
                Text(label).lineLimit(1).minimumScaleFactor(0.7)
                Image(systemName: "chevron.down").font(.system(size: 9, weight: .bold))
            }
            .font(.system(size: 11, weight: .semibold))
            .foregroundStyle(color)
            .frame(maxWidth: .infinity, minHeight: 37)
            .background(color.opacity(0.08))
            .clipShape(RoundedRectangle(cornerRadius: 7))
            .overlay(RoundedRectangle(cornerRadius: 7).stroke(color.opacity(0.45)))
        }
    }

    private func refreshHierarchy() async {
        guard !workspaceId.isEmpty else { return }
        try? await appStore.syncCompanies(workspaceId: workspaceId)
        try? await appStore.syncDepartments(workspaceId: workspaceId)
        try? await appStore.syncTeams(workspaceId: workspaceId)
        try? await appStore.syncAgents(workspaceId: workspaceId)
    }
}

struct AgentClassificationToolView: View {
    let workspaceId: String

    @EnvironmentObject private var appStore: AppStore
    @State private var selectedAgentId: String?
    @State private var companyId = ""
    @State private var departmentId = ""
    @State private var teamId = ""
    @State private var searchText = ""
    @State private var showSearch = false
    @State private var isSaving = false
    @State private var error: String?

    private var selectedAgent: Agent? { appStore.agents.first(where: { $0.id == selectedAgentId }) }
    private var departments: [Department] { companyId.isEmpty ? appStore.departments : appStore.departments.filter { $0.companyId == companyId } }
    private var teams: [Team] { departmentId.isEmpty ? appStore.teams : appStore.teams.filter { $0.departmentId == departmentId } }
    private var filteredAgents: [Agent] {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty else { return appStore.agents }
        return appStore.agents.filter { $0.name.localizedCaseInsensitiveContains(query) || assignmentPath(for: $0).localizedCaseInsensitiveContains(query) }
    }

    var body: some View {
        ScrollView {
            VStack(spacing: RelaySpacing.md) {
                HStack {
                    toolTitle("Agent Classification")
                    Spacer()
                    Button { showSearch.toggle() } label: {
                        Image(systemName: showSearch ? "xmark" : "magnifyingglass")
                            .font(.system(size: 19, weight: .medium)).foregroundStyle(.white).frame(width: 44, height: 44)
                    }
                    .accessibilityLabel(showSearch ? "Close search" : "Search agents")
                }
                if showSearch { RelaySearchField(text: $searchText, prompt: "Search agents") }
                assignmentMenus
                if let error { RelayStatusStrip(title: "Assignment could not be saved", detail: error, tone: .failure, icon: "exclamationmark.triangle.fill") }
                if filteredAgents.isEmpty {
                    RelayEmptyState(icon: "magnifyingglass", title: "No agents found", subtitle: "Try another search term.")
                } else {
                    LazyVStack(spacing: RelaySpacing.sm) {
                        ForEach(filteredAgents) { agent in agentRow(agent) }
                    }
                }
            }
            .padding(RelaySpacing.lg)
        }
        .relayScreenBackground()
        .navigationBarTitleDisplayMode(.inline)
        .task { await refreshHierarchy() }
    }

    private var assignmentMenus: some View {
        HStack(spacing: RelaySpacing.sm) {
            assignmentMenu(label: selectedCompanyName, color: RelayColors.accentGreen, enabled: selectedAgent != nil && !isSaving) {
                Button("No organization") { assignCompany("") }
                ForEach(appStore.companies) { company in Button(company.name) { assignCompany(company.id) } }
            }
            assignmentMenu(label: selectedDepartmentName, color: RelayColors.accent, enabled: selectedAgent != nil && !isSaving) {
                Button("No department") { assignDepartment("") }
                ForEach(departments) { department in Button(department.name) { assignDepartment(department.id) } }
            }
            assignmentMenu(label: selectedTeamName, color: RelayColors.accentOrange, enabled: selectedAgent != nil && !isSaving) {
                Button("No team") { assignTeam("") }
                ForEach(teams) { team in Button(team.name) { assignTeam(team.id) } }
            }
        }
    }

    private func agentRow(_ agent: Agent) -> some View {
        let selected = selectedAgentId == agent.id
        return Button { select(agent) } label: {
            HStack(spacing: RelaySpacing.sm) {
                RelayAvatar(name: agent.name, imageUrl: agent.avatarUrl, size: .medium, status: agent.status)
                VStack(alignment: .leading, spacing: 3) {
                    Text(agent.name).font(.system(size: 14, weight: .semibold)).foregroundStyle(.white)
                    Text(assignmentPath(for: agent)).font(.system(size: 11)).foregroundStyle(RelayColors.textSecondary).lineLimit(1)
                }
                Spacer()
                if isSaving && selected { ProgressView().controlSize(.small) }
                placementPill(for: agent)
            }
            .padding(.horizontal, RelaySpacing.md)
            .frame(minHeight: 60)
            .background(selected ? RelayColors.accent.opacity(0.14) : Color(hex: "#081321"))
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(selected ? RelayColors.accent : Color.white.opacity(0.1), lineWidth: selected ? 1.5 : 1))
        }
        .buttonStyle(.plain)
        .accessibilityValue(selected ? "Selected" : "")
    }

    private func select(_ agent: Agent) {
        selectedAgentId = agent.id
        companyId = agent.companyId ?? ""
        departmentId = agent.departmentId ?? ""
        teamId = agent.teamId ?? ""
        error = nil
    }

    private func assignCompany(_ id: String) {
        companyId = id
        departmentId = ""
        teamId = ""
        saveAssignment()
    }

    private func assignDepartment(_ id: String) {
        departmentId = id
        teamId = ""
        if let department = appStore.departments.first(where: { $0.id == id }) { companyId = department.companyId }
        saveAssignment()
    }

    private func assignTeam(_ id: String) {
        teamId = id
        if let team = appStore.teams.first(where: { $0.id == id }),
           let department = appStore.departments.first(where: { $0.id == team.departmentId }) {
            departmentId = department.id
            companyId = department.companyId
        }
        saveAssignment()
    }

    private func saveAssignment() {
        guard let agent = selectedAgent, !isSaving else { return }
        isSaving = true
        error = nil
        let groupType = companyId.isEmpty ? (agent.groupType ?? "personal") : "business"
        let params: [String: Any] = [
            "groupType": groupType,
            "groupLabel": groupType == "family" ? (agent.groupLabel ?? "") : NSNull(),
            "companyId": companyId.isEmpty ? NSNull() : companyId,
            "departmentId": departmentId.isEmpty ? NSNull() : departmentId,
            "teamId": teamId.isEmpty ? NSNull() : teamId
        ]
        _Concurrency.Task {
            defer { isSaving = false }
            do {
                let updated: Agent = try await APIClient.shared.request(.updateAgent(id: agent.id, params: params))
                try await appStore.syncAgents(workspaceId: workspaceId)
                selectedAgentId = updated.id
            } catch {
                self.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
            }
        }
    }

    private var selectedCompanyName: String { appStore.companies.first(where: { $0.id == companyId })?.name ?? "Organization" }
    private var selectedDepartmentName: String { appStore.departments.first(where: { $0.id == departmentId })?.name ?? "Department" }
    private var selectedTeamName: String { appStore.teams.first(where: { $0.id == teamId })?.name ?? "Team" }

    private func assignmentMenu<Content: View>(label: String, color: Color, enabled: Bool, @ViewBuilder content: () -> Content) -> some View {
        Menu(content: content) {
            HStack(spacing: 5) {
                Text(label).lineLimit(1).minimumScaleFactor(0.7)
                Image(systemName: "chevron.down").font(.system(size: 9, weight: .bold))
            }
            .font(.system(size: 11, weight: .semibold))
            .foregroundStyle(enabled ? color : RelayColors.textTertiary)
            .frame(maxWidth: .infinity, minHeight: 42)
            .background(enabled ? color.opacity(0.08) : Color.white.opacity(0.03))
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(enabled ? color.opacity(0.55) : Color.white.opacity(0.08)))
        }
        .disabled(!enabled)
    }

    private func assignmentPath(for agent: Agent) -> String {
        let company = appStore.companies.first(where: { $0.id == agent.companyId })?.name
        let department = appStore.departments.first(where: { $0.id == agent.departmentId })?.name
        let team = appStore.teams.first(where: { $0.id == agent.teamId })?.name
        let values = [company, department, team].compactMap { $0 }
        if !values.isEmpty { return values.joined(separator: " / ") }
        if let label = agent.groupLabel, !label.isEmpty { return label }
        return "Unassigned"
    }

    private func refreshHierarchy() async {
        guard !workspaceId.isEmpty else { return }
        try? await appStore.syncCompanies(workspaceId: workspaceId)
        try? await appStore.syncDepartments(workspaceId: workspaceId)
        try? await appStore.syncTeams(workspaceId: workspaceId)
        try? await appStore.syncAgents(workspaceId: workspaceId)
    }
}

private func toolTitle(_ title: String) -> some View {
    Text(title)
        .font(.system(size: 18, weight: .bold))
        .foregroundStyle(.white)
        .frame(maxWidth: .infinity, alignment: .center)
}

private func placementColor(_ placement: AgentPlacementFilter) -> Color {
    switch placement {
    case .business: return RelayColors.accentGreen
    case .family: return RelayColors.accentPurple
    case .personal: return RelayColors.accentOrange
    }
}

private func placementIcon(_ placement: AgentPlacementFilter) -> String {
    switch placement {
    case .business: return "building.2"
    case .family: return "house"
    case .personal: return "person.circle"
    }
}

private func placementPill(for agent: Agent) -> some View {
    let placement = AgentPlacementFilter.placement(for: agent)
    let color = placementColor(placement)
    return Text(placement.rawValue)
        .font(.system(size: 10, weight: .semibold))
        .foregroundStyle(color)
        .padding(.horizontal, 9)
        .padding(.vertical, 5)
        .background(color.opacity(0.13))
        .clipShape(RoundedRectangle(cornerRadius: 6))
        .overlay(RoundedRectangle(cornerRadius: 6).stroke(color.opacity(0.42)))
}

private struct AgentClassificationCard: View {
    let agent: Agent
    let companies: [Company]
    let departments: [Department]
    let teams: [Team]
    let isSaving: Bool
    let onSave: ([String: Any]) -> Void

    @State private var groupType: String
    @State private var groupLabel: String
    @State private var companyId: String
    @State private var departmentId: String
    @State private var teamId: String
    @State private var activePicker: ClassificationPicker?
    @State private var isDirty = false

    init(
        agent: Agent,
        companies: [Company],
        departments: [Department],
        teams: [Team],
        isSaving: Bool,
        onSave: @escaping ([String: Any]) -> Void
    ) {
        self.agent = agent
        self.companies = companies
        self.departments = departments
        self.teams = teams
        self.isSaving = isSaving
        self.onSave = onSave
        _groupType = State(initialValue: agent.groupType ?? (agent.companyId != nil || agent.departmentId != nil || agent.teamId != nil ? "business" : "personal"))
        _groupLabel = State(initialValue: agent.groupLabel ?? "")
        _companyId = State(initialValue: agent.companyId ?? "")
        _departmentId = State(initialValue: agent.departmentId ?? "")
        _teamId = State(initialValue: agent.teamId ?? "")
    }

    private var availableDepartments: [Department] {
        companyId.isEmpty ? departments : departments.filter { $0.companyId == companyId }
    }

    private var availableTeams: [Team] {
        departmentId.isEmpty ? teams : teams.filter { $0.departmentId == departmentId }
    }

    var body: some View {
        MissionPanel {
            HStack(spacing: ClawSpacing.md) {
                AvatarView(name: agent.name, imageUrl: agent.avatarUrl, size: .medium, status: agent.status)
                VStack(alignment: .leading, spacing: 2) {
                    Text(agent.name)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(ClawColors.textPrimary)
                    Text(agent.role)
                        .font(.system(size: 12))
                        .foregroundStyle(ClawColors.textSecondary)
                }
                Spacer()
                if isSaving && isDirty {
                    ProgressView()
                        .controlSize(.small)
                }
            }

            Picker("Group", selection: $groupType) {
                Text("Personal").tag("personal")
                Text("Family").tag("family")
                Text("Business").tag("business")
            }
            .pickerStyle(.segmented)
            .onChange(of: groupType) { _, newValue in
                if newValue != "business" {
                    companyId = ""
                    departmentId = ""
                    teamId = ""
                }
                autosave()
            }

            if groupType == "family" {
                TextField("Family label", text: $groupLabel)
                    .missionTextField()
                    .onSubmit { autosave() }
            }

            if groupType == "business" {
                SelectionRow(
                    label: "Organization",
                    value: companies.first(where: { $0.id == companyId })?.name ?? "No organization",
                    systemImage: "building.2.fill"
                ) {
                    activePicker = .organization
                }
                SelectionRow(
                    label: "Department",
                    value: availableDepartments.first(where: { $0.id == departmentId })?.name ?? "No department",
                    systemImage: "rectangle.3.group.fill"
                ) {
                    activePicker = .department
                }
                SelectionRow(
                    label: "Team",
                    value: availableTeams.first(where: { $0.id == teamId })?.name ?? "No team",
                    systemImage: "person.3.fill"
                ) {
                    activePicker = .team
                }
            }
        }
        .sheet(item: $activePicker) { picker in
            ClassificationWheelSheet(
                title: picker.title,
                options: options(for: picker),
                selection: binding(for: picker)
            ) { changedPicker in
                if changedPicker == .organization {
                    departmentId = ""
                    teamId = ""
                }
                if changedPicker == .department {
                    teamId = ""
                }
                autosave()
            }
            .presentationDetents([.height(330)])
        }
    }

    private func options(for picker: ClassificationPicker) -> [SelectionOption] {
        switch picker {
        case .organization:
            return [SelectionOption(id: "", title: "No organization")] + companies.map { SelectionOption(id: $0.id, title: $0.name) }
        case .department:
            return [SelectionOption(id: "", title: "No department")] + availableDepartments.map { SelectionOption(id: $0.id, title: $0.name) }
        case .team:
            return [SelectionOption(id: "", title: "No team")] + availableTeams.map { SelectionOption(id: $0.id, title: $0.name) }
        }
    }

    private func binding(for picker: ClassificationPicker) -> Binding<String> {
        switch picker {
        case .organization:
            return $companyId
        case .department:
            return $departmentId
        case .team:
            return $teamId
        }
    }

    private func autosave() {
        guard !isSaving else { return }
        isDirty = true
        onSave(payload)
    }

    private var payload: [String: Any] {
        switch groupType {
        case "family":
            return [
                "groupType": "family",
                "groupLabel": groupLabel,
                "companyId": NSNull(),
                "departmentId": NSNull(),
                "teamId": NSNull()
            ]
        case "business":
            return [
                "groupType": "business",
                "groupLabel": NSNull(),
                "companyId": companyId.isEmpty ? NSNull() : companyId,
                "departmentId": departmentId.isEmpty ? NSNull() : departmentId,
                "teamId": teamId.isEmpty ? NSNull() : teamId
            ]
        default:
            return [
                "groupType": "personal",
                "groupLabel": NSNull(),
                "companyId": NSNull(),
                "departmentId": NSNull(),
                "teamId": NSNull()
            ]
        }
    }
}

private enum ClassificationPicker: String, Identifiable {
    case organization
    case department
    case team

    var id: String { rawValue }

    var title: String {
        switch self {
        case .organization:
            return "Organization"
        case .department:
            return "Department"
        case .team:
            return "Team"
        }
    }
}

private struct SelectionOption: Identifiable, Hashable {
    let id: String
    let title: String
}

private struct SelectionRow: View {
    let label: String
    let value: String
    let systemImage: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: ClawSpacing.sm) {
                Image(systemName: systemImage)
                    .foregroundStyle(ClawColors.accent)
                    .frame(width: 20)
                Text(label)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(ClawColors.textSecondary)
                Spacer()
                Text(value)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(ClawColors.textPrimary)
                    .lineLimit(1)
                Image(systemName: "chevron.up.chevron.down")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(ClawColors.textTertiary)
            }
            .padding(.vertical, ClawSpacing.sm)
        }
        .buttonStyle(.plain)
    }
}

private struct LabeledValueRow: View {
    let label: String
    let value: String
    let systemImage: String

    var body: some View {
        HStack {
            Label(label, systemImage: systemImage)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(ClawColors.textSecondary)
            Spacer()
            Text(value)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(ClawColors.textPrimary)
        }
    }
}

private struct ClassificationWheelSheet: View {
    let title: String
    let options: [SelectionOption]
    @Binding var selection: String
    let onChange: (ClassificationPicker) -> Void

    @Environment(\.dismiss) private var dismiss

    private var pickerType: ClassificationPicker {
        switch title {
        case "Organization":
            return .organization
        case "Department":
            return .department
        default:
            return .team
        }
    }

    var body: some View {
        NavigationStack {
            Picker(title, selection: $selection) {
                ForEach(options) { option in
                    Text(option.title).tag(option.id)
                }
            }
            .pickerStyle(.wheel)
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") {
                        onChange(pickerType)
                        dismiss()
                    }
                }
            }
        }
        .missionScreenBackground()
    }
}

struct AgentWorkCalendarToolView: View {
    let workspaceId: String
    @EnvironmentObject private var appStore: AppStore
    @State private var workCalendar: AgentWorkCalendarResponse?
    @State private var filter: GroupFilter = .all
    @State private var selectedDate = ""
    @State private var isLoading = false
    @State private var error: String?

    private var sortedAgents: [AgentWorkCalendarAgent] {
        (workCalendar?.agents ?? []).sorted {
            let lhs = $0.days.first(where: { $0.date == selectedDate })?.minutesWorked ?? 0
            let rhs = $1.days.first(where: { $0.date == selectedDate })?.minutesWorked ?? 0
            return lhs == rhs ? $0.totalMinutesWorked > $1.totalMinutesWorked : lhs > rhs
        }
    }

    private var visibleDays: [String] {
        guard let days = workCalendar?.days else { return [] }
        return Array(days.suffix(8))
    }

    var body: some View {
        ZStack {
            RelayColors.backgroundPrimary.ignoresSafeArea()
            ScrollView {
                VStack(spacing: RelaySpacing.md) {
                    controls
                    dayStrip
                    if let error { RelayErrorPanel(message: error) }
                    HStack {
                        Text("Agent").frame(maxWidth: .infinity, alignment: .leading)
                        Text("Today").frame(width: 48, alignment: .trailing)
                        Text("Total").frame(width: 48, alignment: .trailing)
                    }
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(RelayColors.textSecondary)
                    .padding(.top, RelaySpacing.sm)

                    if isLoading && workCalendar == nil {
                        RelayLoadingState(message: "Loading work calendar").padding(.top, 50)
                    } else if sortedAgents.isEmpty {
                        RelayInlineEmptyState(icon: "calendar", title: "No work recorded", subtitle: "No agent work periods were returned for this date range.")
                            .padding(.top, 40)
                    } else {
                        LazyVStack(spacing: 0) {
                            ForEach(0..<sortedAgents.count, id: \.self) { index in
                                agentRow(sortedAgents[index])
                                Divider().overlay(RelayColors.borderStandard)
                            }
                        }
                    }
                }
                .padding(.horizontal, RelaySpacing.lg)
                .padding(.bottom, RelaySpacing.xxl)
            }
        }
        .navigationTitle("Work Calendar")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(RelayColors.backgroundPrimary, for: .navigationBar)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .refreshable { await load() }
        .task { await load() }
        .onChange(of: filter) { _, _ in _Concurrency.Task { await load() } }
    }

    private var controls: some View {
        VStack(spacing: RelaySpacing.sm) {
            HStack {
                Text("Most hours recently")
                Spacer()
                Image(systemName: "chevron.down")
                Image(systemName: "slider.horizontal.3")
                    .padding(.leading, RelaySpacing.sm)
            }
            .font(RelayFonts.cardBody)
            .foregroundStyle(RelayColors.textPrimary)
            .padding(.horizontal, RelaySpacing.md)
            .frame(height: 42)
            .background(RelayColors.fieldBackground)
            .clipShape(RoundedRectangle(cornerRadius: RelayRadius.md))
            .overlay(RoundedRectangle(cornerRadius: RelayRadius.md).stroke(RelayColors.borderStandard))

            HStack(spacing: 6) {
                ForEach(GroupFilter.allCases, id: \.self) { item in
                    Button { filter = item } label: {
                        Text(item.rawValue)
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(filter == item ? .white : tint(item))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 7)
                            .background(tint(item).opacity(filter == item ? 0.55 : 0.10))
                            .clipShape(RoundedRectangle(cornerRadius: 6))
                            .overlay(RoundedRectangle(cornerRadius: 6).stroke(tint(item).opacity(0.55)))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(.top, RelaySpacing.md)
    }

    private var dayStrip: some View {
        HStack(spacing: 4) {
            ForEach(visibleDays, id: \.self) { day in
                dayButton(day)
            }
        }
    }

    private func dayButton(_ day: String) -> some View {
        let selected = selectedDate == day
        let foreground: Color = selected ? .white : RelayColors.textSecondary
        let background: Color = selected ? RelayColors.accent.opacity(0.55) : RelayColors.backgroundCard
        let border: Color = selected ? RelayColors.accent : RelayColors.borderStandard
        return Button { selectedDate = day } label: {
            VStack(spacing: 2) {
                Text(dayLabel(day, format: "EEE").uppercased()).font(.system(size: 8, weight: .bold))
                Text(dayLabel(day, format: "MM/dd")).font(.system(size: 8))
            }
            .foregroundStyle(foreground)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 7)
            .background(background)
            .clipShape(RoundedRectangle(cornerRadius: 5))
            .overlay(RoundedRectangle(cornerRadius: 5).stroke(border))
        }
        .buttonStyle(.plain)
    }

    private func agentRow(_ item: AgentWorkCalendarAgent) -> some View {
        let agent = appStore.agents.first(where: { $0.id == item.agentId })
        let today = item.days.first(where: { $0.date == selectedDate })?.minutesWorked ?? 0
        return HStack(spacing: RelaySpacing.sm) {
            AvatarView(name: item.agentName, imageUrl: agent?.avatarUrl, size: .small)
            VStack(alignment: .leading, spacing: 2) {
                Text(item.agentName).font(.system(size: 13, weight: .semibold)).foregroundStyle(RelayColors.textPrimary)
                Text(item.departmentName ?? item.groupLabel ?? item.groupType.capitalized)
                    .font(.system(size: 10)).foregroundStyle(RelayColors.textSecondary).lineLimit(1)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            Text(hours(today)).frame(width: 48, alignment: .trailing)
            Text(hours(item.totalMinutesWorked)).frame(width: 48, alignment: .trailing)
        }
        .font(.system(size: 12, weight: .medium))
        .foregroundStyle(RelayColors.textPrimary)
        .padding(.vertical, 9)
    }

    private func load() async {
        guard !workspaceId.isEmpty else { return }
        isLoading = true; error = nil
        defer { isLoading = false }
        let end = Date()
        let start = Calendar.current.date(byAdding: .day, value: -7, to: end) ?? end
        do {
            workCalendar = try await APIClient.shared.request(.agentWorkCalendar(
                workspaceId: workspaceId,
                startDate: Self.dateFormatter.string(from: start),
                endDate: Self.dateFormatter.string(from: end),
                groupType: filter.apiValue,
                activityGapMinutes: 30,
                timeZone: TimeZone.current.identifier
            ))
            selectedDate = workCalendar?.days.last ?? selectedDate
        } catch {
            self.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    private func hours(_ minutes: Int) -> String { minutes == 0 ? "0h" : String(format: "%.1fh", Double(minutes) / 60) }
    private func tint(_ item: GroupFilter) -> Color {
        switch item { case .all: return RelayColors.accent; case .business: return RelayColors.accentGreen; case .family: return RelayColors.accentPurple; case .personal: return RelayColors.accentOrange }
    }
    private func dayLabel(_ value: String, format: String) -> String {
        guard let date = Self.dateFormatter.date(from: value) else { return value }
        let formatter = DateFormatter(); formatter.dateFormat = format; return formatter.string(from: date)
    }
    private static let dateFormatter: DateFormatter = {
        let formatter = DateFormatter(); formatter.calendar = Calendar(identifier: .gregorian); formatter.locale = Locale(identifier: "en_US_POSIX"); formatter.dateFormat = "yyyy-MM-dd"; return formatter
    }()
}

private struct WorkCalendarGrid: UIViewRepresentable {
    let calendar: AgentWorkCalendarResponse
    let agents: [Agent]

    func makeUIView(context: Context) -> StickyWorkCalendarUIView {
        StickyWorkCalendarUIView()
    }

    func updateUIView(_ uiView: StickyWorkCalendarUIView, context: Context) {
        uiView.configure(calendar: calendar, agents: agents)
    }
}

private final class StickyWorkCalendarUIView: UIView, UIScrollViewDelegate {
    private let scrollView = UIScrollView()
    private let dataLayer = UIView()
    private let headerLayer = UIView()
    private let leftLayer = UIView()
    private let cornerLayer = UIView()

    private let agentWidth: CGFloat = 62
    private let dayWidth: CGFloat = 76
    private let headerHeight: CGFloat = 42
    private let departmentHeight: CGFloat = 30
    private let rowHeight: CGFloat = 58
    private let gap: CGFloat = 8

    override init(frame: CGRect) {
        super.init(frame: frame)
        setup()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setup()
    }

    private func setup() {
        backgroundColor = .clear
        scrollView.delegate = self
        scrollView.showsHorizontalScrollIndicator = true
        scrollView.showsVerticalScrollIndicator = true
        scrollView.alwaysBounceHorizontal = true
        scrollView.alwaysBounceVertical = true
        scrollView.backgroundColor = .clear
        addSubview(scrollView)
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        scrollView.frame = bounds
        updateStickyFrames()
    }

    func configure(calendar: AgentWorkCalendarResponse, agents: [Agent]) {
        scrollView.subviews.forEach { $0.removeFromSuperview() }
        dataLayer.subviews.forEach { $0.removeFromSuperview() }
        headerLayer.subviews.forEach { $0.removeFromSuperview() }
        leftLayer.subviews.forEach { $0.removeFromSuperview() }
        cornerLayer.subviews.forEach { $0.removeFromSuperview() }

        let agentsById = Dictionary(uniqueKeysWithValues: agents.map { ($0.id, $0) })
        let groups = groupedAgents(calendar.agents)
        let dayAreaWidth = CGFloat(calendar.days.count) * dayWidth
        let contentWidth = agentWidth + gap + dayAreaWidth
        var contentHeight = headerHeight

        for group in groups {
            contentHeight += departmentHeight
            contentHeight += CGFloat(group.agents.count) * rowHeight
        }

        scrollView.contentSize = CGSize(width: contentWidth, height: max(contentHeight, bounds.height + 1))
        dataLayer.frame = CGRect(origin: .zero, size: scrollView.contentSize)
        headerLayer.frame = CGRect(x: 0, y: 0, width: contentWidth, height: headerHeight)
        leftLayer.frame = CGRect(x: 0, y: headerHeight, width: agentWidth, height: contentHeight - headerHeight)
        cornerLayer.frame = CGRect(x: 0, y: 0, width: agentWidth, height: headerHeight)

        scrollView.addSubview(dataLayer)
        scrollView.addSubview(headerLayer)
        scrollView.addSubview(leftLayer)
        scrollView.addSubview(cornerLayer)

        buildHeader(days: calendar.days)

        var y = headerHeight
        for group in groups {
            addDepartment(group.name, y: y, contentWidth: contentWidth)
            y += departmentHeight

            for agent in group.agents {
                let avatarUrl = agentsById[agent.agentId]?.avatarUrl
                addAgentAvatar(name: agent.agentName, imageUrl: avatarUrl, y: y)

                for (index, day) in agent.days.enumerated() {
                    addDayCell(day, x: agentWidth + gap + CGFloat(index) * dayWidth, y: y)
                }
                y += rowHeight
            }
        }

        bringStickyLayersForward()
        updateStickyFrames()
    }

    func scrollViewDidScroll(_ scrollView: UIScrollView) {
        updateStickyFrames()
    }

    private func updateStickyFrames() {
        let offset = scrollView.contentOffset
        headerLayer.frame.origin.y = offset.y
        leftLayer.frame.origin.x = offset.x
        cornerLayer.frame.origin = offset
        bringStickyLayersForward()
    }

    private func bringStickyLayersForward() {
        scrollView.bringSubviewToFront(headerLayer)
        scrollView.bringSubviewToFront(leftLayer)
        scrollView.bringSubviewToFront(cornerLayer)
    }

    private func buildHeader(days: [String]) {
        cornerLayer.backgroundColor = UIColor(ClawColors.backgroundCard)
        let corner = label("Agent", font: .systemFont(ofSize: 11, weight: .bold), color: UIColor(ClawColors.textSecondary))
        corner.textAlignment = .center
        cornerLayer.addSubview(corner)
        corner.frame = cornerLayer.bounds

        headerLayer.backgroundColor = UIColor(ClawColors.backgroundCard)
        for (index, day) in days.enumerated() {
            let label = label(shortDay(day).uppercased(), font: .systemFont(ofSize: 12, weight: .bold), color: UIColor(ClawColors.textSecondary))
            label.textAlignment = .center
            label.frame = CGRect(x: agentWidth + gap + CGFloat(index) * dayWidth, y: 0, width: dayWidth, height: headerHeight)
            headerLayer.addSubview(label)
        }
    }

    private func addDepartment(_ name: String, y: CGFloat, contentWidth: CGFloat) {
        let text = label(name.uppercased(), font: .systemFont(ofSize: 11, weight: .bold), color: UIColor(ClawColors.accent))
        text.textAlignment = .center
        text.frame = CGRect(x: 0, y: y - headerHeight, width: agentWidth, height: departmentHeight)
        leftLayer.addSubview(text)

        let line = UIView(frame: CGRect(x: agentWidth + gap, y: y + departmentHeight / 2, width: contentWidth - agentWidth - gap - 8, height: 1))
        line.backgroundColor = UIColor(ClawColors.separator)
        dataLayer.addSubview(line)
    }

    private func addAgentAvatar(name: String, imageUrl: String?, y: CGFloat) {
        let container = UIView(frame: CGRect(x: 0, y: y - headerHeight, width: agentWidth, height: rowHeight))
        container.backgroundColor = UIColor(ClawColors.backgroundCard)

        let imageView = UIImageView(frame: CGRect(x: 13, y: 10, width: 36, height: 36))
        imageView.contentMode = .scaleAspectFill
        imageView.clipsToBounds = true
        imageView.layer.cornerRadius = 18
        imageView.backgroundColor = avatarColor(for: name)
        container.addSubview(imageView)

        let initialsLabel = label(initials(name), font: .systemFont(ofSize: 12, weight: .bold), color: .white)
        initialsLabel.textAlignment = .center
        initialsLabel.frame = imageView.bounds
        imageView.addSubview(initialsLabel)

        if let imageUrl {
            loadAvatar(imageUrl) { image in
                guard let image else { return }
                imageView.image = image
                initialsLabel.removeFromSuperview()
            }
        }

        leftLayer.addSubview(container)
    }

    private func addDayCell(_ day: AgentWorkCalendarDay, x: CGFloat, y: CGFloat) {
        let hasWork = day.minutesWorked > 0
        let cell = UIView(frame: CGRect(x: x + 2, y: y + 3, width: dayWidth - 8, height: rowHeight - 8))
        cell.backgroundColor = UIColor(hasWork ? ClawColors.accent.opacity(0.18) : ClawColors.backgroundElevated)
        cell.layer.cornerRadius = 8
        cell.clipsToBounds = true

        let minutes = label("\(day.minutesWorked)m", font: .systemFont(ofSize: 14, weight: .semibold), color: UIColor(hasWork ? ClawColors.textPrimary : ClawColors.textTertiary))
        minutes.textAlignment = .center
        minutes.frame = CGRect(x: 0, y: 12, width: cell.bounds.width, height: 18)
        cell.addSubview(minutes)

        let sessions = label("\(day.sessionCount) sessions", font: .systemFont(ofSize: 10, weight: .regular), color: UIColor(ClawColors.textTertiary))
        sessions.textAlignment = .center
        sessions.frame = CGRect(x: 0, y: 31, width: cell.bounds.width, height: 14)
        cell.addSubview(sessions)

        dataLayer.addSubview(cell)
    }

    private func label(_ text: String, font: UIFont, color: UIColor) -> UILabel {
        let label = UILabel()
        label.text = text
        label.font = font
        label.textColor = color
        label.adjustsFontSizeToFitWidth = true
        label.minimumScaleFactor = 0.75
        return label
    }

    private func groupedAgents(_ agents: [AgentWorkCalendarAgent]) -> [WorkCalendarDepartmentGroup] {
        var groups: [String: WorkCalendarDepartmentGroup] = [:]
        var order: [String] = []

        for agent in agents {
            let rawName = agent.departmentName?.trimmingCharacters(in: .whitespacesAndNewlines)
            let fallback = agent.groupType == "business" ? "Business" : agent.groupType.capitalized
            let departmentName = rawName?.isEmpty == false ? rawName! : fallback
            if groups[departmentName] == nil {
                groups[departmentName] = WorkCalendarDepartmentGroup(id: departmentName, name: departmentName, agents: [])
                order.append(departmentName)
            }
            groups[departmentName]?.agents.append(agent)
        }

        return order.compactMap { groups[$0] }
    }

    private func shortDay(_ day: String) -> String {
        guard let date = Self.inputFormatter.date(from: day) else { return day }
        return Self.outputFormatter.string(from: date)
    }

    private func initials(_ name: String) -> String {
        let parts = name.split(separator: " ")
        let first = parts.first?.first.map(String.init) ?? "?"
        let second = parts.dropFirst().first?.first.map(String.init) ?? ""
        return "\(first)\(second)".uppercased()
    }

    private func avatarColor(for name: String) -> UIColor {
        let colors = [
            UIColor(ClawColors.accent),
            UIColor(ClawColors.accentGreen),
            UIColor(ClawColors.accentTeal),
            UIColor(ClawColors.accentPurple),
            UIColor(ClawColors.accentOrange)
        ]
        return colors[abs(name.hashValue) % colors.count]
    }

    private func loadAvatar(
        _ value: String,
        completion: @escaping @MainActor @Sendable (UIImage?) -> Void
    ) {
        if value.hasPrefix("data:"), let image = decodeDataURL(value) {
            completion(image)
            return
        }

        let url: URL?
        if let absolute = URL(string: value), absolute.scheme != nil {
            url = absolute
        } else if value.hasPrefix("/") {
            url = URL(string: value, relativeTo: AppRuntimeConfig.webAssetBaseURL)?.absoluteURL
        } else {
            url = nil
        }

        guard let url else {
            completion(nil)
            return
        }

        URLSession.shared.dataTask(with: url) { data, _, _ in
            let image = data.flatMap(UIImage.init(data:))
            DispatchQueue.main.async {
                completion(image)
            }
        }.resume()
    }

    private func decodeDataURL(_ value: String) -> UIImage? {
        guard let commaIndex = value.firstIndex(of: ",") else { return nil }
        let base64String = String(value[value.index(after: commaIndex)...])
        guard let data = Data(base64Encoded: base64String, options: .ignoreUnknownCharacters) else { return nil }
        return UIImage(data: data)
    }

    private static let inputFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    private static let outputFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "E d"
        return formatter
    }()
}

private struct WorkCalendarDepartmentGroup: Identifiable {
    let id: String
    var name: String
    var agents: [AgentWorkCalendarAgent]
}

private struct AgentWorkCalendarResponse: Decodable {
    let workspaceId: String
    let startDate: String
    let endDate: String
    let timeZone: String
    let groupType: String?
    let activityGapMinutes: Int
    let days: [String]
    let agents: [AgentWorkCalendarAgent]
}

private struct AgentWorkCalendarAgent: Decodable, Identifiable {
    let agentId: String
    let agentName: String
    let groupType: String
    let groupLabel: String?
    let departmentId: String?
    let departmentName: String?
    let days: [AgentWorkCalendarDay]
    let totalMinutesWorked: Int

    var id: String { agentId }
}

private struct AgentWorkCalendarDay: Decodable, Identifiable {
    let date: String
    let minutesWorked: Int
    let sessionCount: Int
    let messageCount: Int

    var id: String { date }
}
