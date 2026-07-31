// AgentRosterView.swift
// ClawChat – Agent roster (web-canonical)

import SwiftUI
import Combine

// MARK: - RosterState

@MainActor
private final class RosterState: ObservableObject {
    @Published var agents: [Agent] = []
    @Published var isLoading = false
    @Published var hasLoaded = false
    @Published var error: String?
    @Published var searchText = ""
    @Published var placementFilter: AgentPlacementFilter = .business
    @Published var showHiringFlow = false

    var workspaceId: String
    private let api: APIClient

    init(workspaceId: String, api: APIClient = .shared) {
        self.workspaceId = workspaceId
        self.api = api
    }

    var filteredAgents: [Agent] {
        let placementFiltered = agents.filter {
            AgentPlacementFilter.placement(for: $0) == placementFilter
        }

        guard !searchText.isEmpty else { return placementFiltered }
        return placementFiltered.filter {
            $0.name.localizedCaseInsensitiveContains(searchText) ||
            $0.role.localizedCaseInsensitiveContains(searchText)
        }
    }

    func load() async {
        guard !isLoading else { return }
        isLoading = true
        error = nil
        do {
            let response: PaginatedResponse<Agent> = try await api.requestPaginated(
                .agents(workspaceId: workspaceId, page: 1, pageSize: 100, teamId: nil, status: nil)
            )
            agents = response.data.filter(\.isActiveSurfaceEligible)
            hasLoaded = true
        } catch {
            self.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
        isLoading = false
    }

    func refresh() async {
        await load()
    }
}

enum AgentPlacementFilter: String, CaseIterable, Identifiable {
    case business = "Business"
    case family = "Family"
    case personal = "Personal"

    var id: String { rawValue }

    static func placement(for agent: Agent) -> AgentPlacementFilter {
        switch agent.groupType?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() {
        case "business":
            return .business
        case "family":
            return .family
        case "personal":
            return .personal
        default:
            if hasValue(agent.companyId) || hasValue(agent.departmentId) || hasValue(agent.teamId) {
                return .business
            }
            if hasValue(agent.groupLabel) {
                return .family
            }
            return .personal
        }
    }

    private static func hasValue(_ value: String?) -> Bool {
        guard let value else { return false }
        return !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }
}

// MARK: - AgentRosterView

enum AgentsManagementTab: String, CaseIterable {
    case agents = "Agents"
    case structure = "Structure"
    case classify = "Classification"
    case calendar = "Work Calendar"
    case tasks = "Tasks"

    var icon: String {
        switch self {
        case .agents: return "person.2"
        case .structure: return "point.3.connected.trianglepath.dotted"
        case .classify: return "square.grid.2x2"
        case .calendar: return "calendar"
        case .tasks: return "checklist"
        }
    }
}

// MARK: - Relay-style Agents menu

struct AgentsMenuView: View {
    let workspaceId: String
    let contentMaxWidth: CGFloat?

    @EnvironmentObject private var appStore: AppStore
    @State private var selectedAgentId: String?

    init(workspaceId: String, contentMaxWidth: CGFloat? = nil) {
        self.workspaceId = workspaceId
        self.contentMaxWidth = contentMaxWidth
    }

    private var selectedAgent: Agent? {
        appStore.agents.first(where: { $0.id == selectedAgentId }) ?? appStore.agents.first
    }

    var body: some View {
        NavigationStack {
            ZStack {
                RelayColors.backgroundPrimary.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: RelaySpacing.lg) {
                        createAgentButton
                        agentActions
                        organizationActions
                    }
                    .frame(maxWidth: contentMaxWidth ?? .infinity)
                    .frame(maxWidth: .infinity)
                    .padding(.horizontal, RelaySpacing.lg)
                    .padding(.top, RelaySpacing.sm)
                    .padding(.bottom, RelaySpacing.xxl)
                }
            }
            .toolbar(.hidden, for: .navigationBar)
            .task {
                guard !workspaceId.isEmpty else { return }
                try? await appStore.syncAgents(workspaceId: workspaceId)
                if selectedAgentId == nil { selectedAgentId = appStore.agents.first?.id }
            }
            .onChange(of: appStore.agents) { _, agents in
                if selectedAgentId == nil || !agents.contains(where: { $0.id == selectedAgentId }) {
                    selectedAgentId = agents.first?.id
                }
            }
        }
        .preferredColorScheme(.dark)
    }

    private var createAgentButton: some View {
        NavigationLink { HiringFlowView() } label: {
            Label("Create New Agent", systemImage: "plus")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity, minHeight: 52)
                .background(
                    LinearGradient(
                        colors: [Color(hex: "#5C43FF"), Color(hex: "#7200DB")],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
                .clipShape(RoundedRectangle(cornerRadius: 14))
        }
        .buttonStyle(.plain)
        .accessibilityHint("Opens the agent creation flow")
    }

    private var agentActions: some View {
        menuCard {
            if let agent = selectedAgent {
                menuLink(title: "Edit Agent", subtitle: "Update name, description, and settings", icon: "pencil") {
                    AgentEditSheet(agent: agent) { appStore.upsertAgent($0) }
                }
                menuDivider
                menuLink(title: "Agent Instructions", subtitle: "Manage instructions and identity files", icon: "list.clipboard") {
                    AgentInstructionsView(
                        workspaceId: workspaceId,
                        initialAgent: agent,
                        onAgentSelected: { selectedAgentId = $0.id }
                    )
                }
                menuDivider
                menuLink(title: "Agent Memory", subtitle: "View and manage memory files", icon: "brain.head.profile") {
                    AgentWorkspaceKnowledgeView(
                        workspaceId: workspaceId,
                        initialAgent: agent,
                        section: .memory,
                        onAgentSelected: { selectedAgentId = $0.id }
                    )
                }
                menuDivider
                menuLink(title: "Agent Skills", subtitle: "Define skills and capabilities", icon: "slider.horizontal.3") {
                    AgentWorkspaceKnowledgeView(
                        workspaceId: workspaceId,
                        initialAgent: agent,
                        section: .skills,
                        onAgentSelected: { selectedAgentId = $0.id }
                    )
                }
            } else {
                unavailableAgentsRow
            }
        }
    }

    private var organizationActions: some View {
        menuCard {
            menuLink(title: "Create Org", subtitle: "Create a new organization", icon: "building.2") {
                CreateOrganizationToolView(workspaceId: workspaceId)
            }
            menuDivider
            menuLink(title: "Org Structure", subtitle: "View and manage org structure", icon: "rectangle.3.group") {
                OrganizationStructureToolView(workspaceId: workspaceId)
            }
            menuDivider
            menuLink(title: "Agent Classification", subtitle: "Classify and group agents", icon: "rectangle.3.group.bubble") {
                AgentClassificationToolView(workspaceId: workspaceId)
            }
            menuDivider
            menuLink(title: "Work Calendar", subtitle: "View schedules and availability", icon: "calendar") {
                AgentWorkCalendarToolView(workspaceId: workspaceId)
            }
            menuDivider
            menuLink(title: "Work Task Schedule", subtitle: "Define recurring task schedules", icon: "slider.horizontal.3") {
                AgentTasksView(workspaceId: workspaceId)
            }
            menuDivider
            if let agent = selectedAgent, agent.runtimeType == .hermes {
                menuLink(title: "Cron Jobs", subtitle: "Automate with scheduled jobs", icon: "calendar.badge.clock") {
                    HermesCronJobsView(
                        workspaceId: workspaceId,
                        agentId: agent.openClawIdentifier,
                        agentName: agent.name
                    )
                }
            } else {
                menuRow(title: "Cron Jobs", subtitle: "Select a Hermes agent to manage scheduled jobs", icon: "calendar.badge.clock", isUnavailable: true)
            }
        }
    }

    private func menuCard<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        VStack(spacing: 0) { content() }
            .background(Color(hex: "#0D1A29"))
            .clipShape(RoundedRectangle(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.white.opacity(0.07)))
    }

    private func menuLink<Destination: View>(
        title: String,
        subtitle: String,
        icon: String,
        @ViewBuilder destination: () -> Destination
    ) -> some View {
        NavigationLink(destination: destination()) {
            menuRow(title: title, subtitle: subtitle, icon: icon)
        }
        .buttonStyle(.plain)
    }

    private func menuRow(title: String, subtitle: String, icon: String, isUnavailable: Bool = false) -> some View {
        HStack(spacing: RelaySpacing.md) {
            Image(systemName: icon)
                .font(.system(size: 21, weight: .regular))
                .foregroundStyle(isUnavailable ? RelayColors.textTertiary : Color(hex: "#39C5FF"))
                .frame(width: 28)
            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(isUnavailable ? RelayColors.textTertiary : .white)
                Text(subtitle)
                    .font(.system(size: 12))
                    .foregroundStyle(RelayColors.textSecondary)
                    .lineLimit(2)
            }
            Spacer(minLength: RelaySpacing.sm)
            Image(systemName: isUnavailable ? "lock.fill" : "chevron.right")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(RelayColors.textSecondary)
        }
        .padding(.horizontal, RelaySpacing.md)
        .frame(minHeight: 67)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }

    private var menuDivider: some View {
        Rectangle()
            .fill(Color.white.opacity(0.07))
            .frame(height: 1)
            .padding(.leading, 55)
    }

    private var unavailableAgentsRow: some View {
        menuRow(
            title: "No agents available",
            subtitle: "Create an agent to unlock instructions, memory, and skills",
            icon: "person.crop.circle.badge.exclamationmark",
            isUnavailable: true
        )
    }
}

enum AgentWorkspaceKnowledgeSection: Hashable {
    case memory
    case skills

    var title: String {
        switch self {
        case .memory: return "Agent Memory"
        case .skills: return "Agent Skills"
        }
    }

    var scope: WorkspaceLibraryScope {
        switch self {
        case .memory: return .memory
        case .skills: return .skills
        }
    }

    func preferredFolder(for agent: Agent) -> String {
        switch self {
        case .memory:
            return agent.runtimeType == .hermes ? "memories" : "memory"
        case .skills:
            return "skills"
        }
    }
}

private enum AgentWorkspaceDocumentSection: Hashable {
    case instructions
    case memory
    case skills

    var title: String {
        switch self {
        case .instructions: return "Agent Instructions"
        case .memory: return "Agent Memory"
        case .skills: return "Agent Skills"
        }
    }

    var scope: WorkspaceLibraryScope {
        switch self {
        case .instructions: return .instructions
        case .memory: return .memory
        case .skills: return .skills
        }
    }

    func preferredFolder(for agent: Agent) -> String {
        switch self {
        case .instructions: return ""
        case .memory: return agent.runtimeType == .hermes ? "memories" : "memory"
        case .skills: return "skills"
        }
    }

    var loadingMessage: String {
        switch self {
        case .instructions: return "Loading agent instructions"
        case .memory: return "Loading agent memory"
        case .skills: return "Loading agent skills"
        }
    }

    var emptyTitle: String {
        switch self {
        case .instructions: return "No instruction file"
        case .memory: return "No memory file"
        case .skills: return "No skill file"
        }
    }

    var emptySubtitle: String {
        switch self {
        case .instructions: return "Create SOUL.md in this agent's managed Relay workspace to add its identity and operating instructions."
        case .memory: return "Create a Markdown file in this agent's memory folder to add durable context."
        case .skills: return "Create a SKILL.md file in this agent's skills folder to add capabilities."
        }
    }

    var emptySelectionTitle: String {
        switch self {
        case .instructions: return "No instruction file selected"
        case .memory: return "No memory file selected"
        case .skills: return "No skill file selected"
        }
    }

    var emptySelectionSubtitle: String {
        switch self {
        case .instructions: return "Select an instruction Markdown file"
        case .memory: return "Select a memory Markdown file"
        case .skills: return "Select an installed skill"
        }
    }

    var noFilesMessage: String {
        switch self {
        case .instructions: return "No instruction Markdown files are available for this agent."
        case .memory: return "No memory Markdown files are available for this agent."
        case .skills: return "No installed SKILL.md files are available for this agent."
        }
    }

    func badge(for filename: String) -> String {
        switch self {
        case .instructions:
            switch filename.uppercased() {
            case "SOUL.MD", "IDENTITY.MD": return "IDENTITY"
            case "USER.MD": return "USER"
            case "AGENTS.MD": return "OPERATIONS"
            case "HEARTBEAT.MD": return "HEARTBEAT"
            default: return "INSTRUCTION"
            }
        case .memory: return "MEMORY"
        case .skills: return "SKILL"
        }
    }
}

private extension AgentWorkspaceKnowledgeSection {
    var documentSection: AgentWorkspaceDocumentSection {
        switch self {
        case .memory: return .memory
        case .skills: return .skills
        }
    }
}

/// Agent-aware entry point for memory and skill files. Both surfaces use the
/// same selected-agent state and managed Relay workspace identity as instructions.
struct AgentWorkspaceKnowledgeView: View {
    let workspaceId: String
    let section: AgentWorkspaceKnowledgeSection
    let onAgentSelected: (Agent) -> Void

    @State private var selectedAgent: Agent

    init(
        workspaceId: String,
        initialAgent: Agent,
        section: AgentWorkspaceKnowledgeSection,
        onAgentSelected: @escaping (Agent) -> Void = { _ in }
    ) {
        self.workspaceId = workspaceId
        self.section = section
        self.onAgentSelected = onAgentSelected
        _selectedAgent = State(initialValue: initialAgent)
    }

    var body: some View {
        AgentWorkspaceDocumentsView(
            workspaceId: workspaceId,
            initialAgent: selectedAgent,
            section: section.documentSection,
            onAgentSelected: selectAgent
        )
        .id("\(section.title)-\(selectedAgent.id)")
    }

    private func selectAgent(_ agent: Agent) {
        selectedAgent = agent
        onAgentSelected(agent)
    }
}

private struct AgentWorkspaceSelectorBar: View {
    let agent: Agent
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: RelaySpacing.sm) {
                RelayAvatar(
                    name: agent.name,
                    imageUrl: agent.avatarUrl,
                    size: .medium,
                    status: agent.status
                )
                Text(agent.name)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                runtimeBadge(for: agent)
                placementBadge(for: agent)
                Spacer(minLength: RelaySpacing.xs)
                Image(systemName: "chevron.down")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(RelayColors.textSecondary)
            }
            .padding(.horizontal, RelaySpacing.md)
            .frame(minHeight: 64)
            .background(Color(hex: "#0D1A29"))
            .overlay(alignment: .bottom) {
                Rectangle().fill(Color.white.opacity(0.07)).frame(height: 1)
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Selected agent, \(agent.name)")
        .accessibilityHint("Opens the agent picker")
    }
}

// MARK: - Dedicated agent instructions

struct AgentInstructionsView: View {
    let workspaceId: String
    let initialAgent: Agent
    let onAgentSelected: (Agent) -> Void

    var body: some View {
        AgentWorkspaceDocumentsView(
            workspaceId: workspaceId,
            initialAgent: initialAgent,
            section: .instructions,
            onAgentSelected: onAgentSelected
        )
    }
}

private struct AgentWorkspaceDocument: Identifiable, Hashable {
    let file: LibraryFileEntry
    let folder: String

    var id: String { file.path }
    var displayPath: String { file.path }
}

private struct AgentWorkspaceDocumentsView: View {
    let workspaceId: String
    let section: AgentWorkspaceDocumentSection
    let onAgentSelected: (Agent) -> Void

    @EnvironmentObject private var appStore: AppStore
    @State private var selectedAgent: Agent
    @State private var library = WorkspaceLibraryViewModel()
    @State private var isEditing = false
    @State private var showPicker = false
    @State private var showFilePicker = false
    @State private var showBrowser = false
    @State private var showAgentDetail = false
    @State private var pendingDelete: AgentWorkspaceDocument?
    @State private var documents: [AgentWorkspaceDocument] = []
    @State private var selectedDocument: AgentWorkspaceDocument?
    @State private var isLoadingDocuments = false
    @State private var documentError: String?

    init(
        workspaceId: String,
        initialAgent: Agent,
        section: AgentWorkspaceDocumentSection,
        onAgentSelected: @escaping (Agent) -> Void
    ) {
        self.workspaceId = workspaceId
        self.section = section
        self.onAgentSelected = onAgentSelected
        _selectedAgent = State(initialValue: initialAgent)
    }

    var body: some View {
        ZStack {
            RelayColors.backgroundPrimary.ignoresSafeArea()
            instructionsContent
        }
        .navigationTitle(section.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(ClawColors.backgroundPrimary, for: .navigationBar)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { showBrowser = true } label: {
                    Image(systemName: "square.and.arrow.down")
                }
                .accessibilityLabel("Browse and import \(section.title.lowercased()) files")
            }
        }
        .safeAreaInset(edge: .top, spacing: 0) {
            AgentWorkspaceSelectorBar(agent: selectedAgent) {
                showPicker = true
            }
        }
        .fullScreenCover(isPresented: $showPicker) {
            AgentPickerOverlay(
                agents: appStore.agents,
                selectedAgent: selectedAgent,
                onSelect: selectAgent,
                onDismiss: { showPicker = false }
            )
            .preferredColorScheme(.dark)
        }
        .preferredColorScheme(.dark)
        .navigationDestination(isPresented: $showBrowser) {
            WorkspaceLibraryView(
                workspaceId: workspaceId,
                root: libraryRoot,
                initialFolder: section.preferredFolder(for: selectedAgent),
                title: section.title,
                scope: section.scope
            )
        }
        .navigationDestination(isPresented: $showAgentDetail) {
            AgentDetailView(agent: selectedAgent)
        }
        .onChange(of: showBrowser) { wasShowing, isShowing in
            guard wasShowing, !isShowing else { return }
            _Concurrency.Task { await loadDocuments() }
        }
        .confirmationDialog(
            "Delete \(pendingDelete?.file.filename ?? "file")?",
            isPresented: Binding(
                get: { pendingDelete != nil },
                set: { if !$0 { pendingDelete = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button("Delete file", role: .destructive) {
                guard let document = pendingDelete else { return }
                pendingDelete = nil
                _Concurrency.Task {
                    await library.delete(
                        file: document.file,
                        workspaceId: workspaceId,
                        root: libraryRoot,
                        folder: document.folder
                    )
                    await loadDocuments()
                }
            }
            Button("Cancel", role: .cancel) { pendingDelete = nil }
        } message: {
            Text("This permanently deletes the managed Relay agent workspace file.")
        }
        .task(id: selectedAgent.id) { await loadDocuments() }
    }

    private var instructionsContent: some View {
        ScrollView {
            VStack(spacing: RelaySpacing.md) {
                fileSelector
                actionBar
                instructionDocument
            }
            .padding(RelaySpacing.md)
            .padding(.bottom, RelaySpacing.xxl)
        }
    }

    @ViewBuilder
    private var fileSelector: some View {
        VStack(spacing: 0) {
            if let selectedFile = library.selectedFile, let selectedDocument {
                fileSelectorButton(
                    icon: "doc.text",
                    title: selectedFile.filename,
                    subtitle: "Managed Relay agent workspace/\(selectedDocument.displayPath)",
                    badge: section.badge(for: selectedFile.filename)
                )
            } else {
                fileSelectorButton(
                    icon: "doc.badge.plus",
                    title: section.emptySelectionTitle,
                    subtitle: section.emptySelectionSubtitle,
                    badge: nil
                )
            }

            if showFilePicker {
                Rectangle()
                    .fill(Color.white.opacity(0.08))
                    .frame(height: 1)
                    .padding(.leading, 52)

                ForEach(documents) { document in
                    Button {
                        _Concurrency.Task { await openDocument(document) }
                    } label: {
                        HStack(spacing: RelaySpacing.md) {
                            Image(systemName: "doc.text")
                                .foregroundStyle(Color(hex: "#39C5FF"))
                                .frame(width: 24)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(document.file.filename)
                                    .font(.system(size: 14, weight: .semibold))
                                    .foregroundStyle(.white)
                                Text("Managed Relay agent workspace/\(document.displayPath)")
                                    .font(.system(size: 10))
                                    .foregroundStyle(RelayColors.textSecondary)
                                    .lineLimit(1)
                            }
                            Spacer()
                            Text(section.badge(for: document.file.filename))
                                .font(.system(size: 9, weight: .bold))
                                .foregroundStyle(Color(hex: "#60A5FA"))
                                .padding(.horizontal, 7)
                                .padding(.vertical, 4)
                                .background(Color(hex: "#103264"))
                                .clipShape(Capsule())
                            if let syncState = document.file.syncState {
                                Text(syncState.replacingOccurrences(of: "_", with: " ").capitalized)
                                    .font(.system(size: 9, weight: .bold))
                                    .foregroundStyle(syncState == "applied" ? Color.green : Color.orange)
                                    .padding(.horizontal, 7)
                                    .padding(.vertical, 4)
                                    .background(Color.white.opacity(0.06))
                                    .clipShape(Capsule())
                                    .accessibilityLabel("Document sync state: \(syncState)")
                            }
                            if document.id == selectedDocument?.id {
                                Image(systemName: "checkmark")
                                    .font(.caption.weight(.bold))
                                    .foregroundStyle(Color(hex: "#39C5FF"))
                            }
                        }
                        .padding(.horizontal, RelaySpacing.md)
                        .frame(minHeight: 58)
                    }
                    .buttonStyle(.plain)
                }

                if documents.isEmpty, !isLoadingDocuments {
                    Text(section.noFilesMessage)
                        .font(.system(size: 12))
                        .foregroundStyle(RelayColors.textSecondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(RelaySpacing.md)
                }
            }
        }
        .background(Color(hex: "#0D1A29"))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.white.opacity(0.06)))
    }

    private func fileSelectorButton(
        icon: String,
        title: String,
        subtitle: String,
        badge: String?
    ) -> some View {
        Button { withAnimation(.easeInOut(duration: 0.16)) { showFilePicker.toggle() } } label: {
            HStack(spacing: RelaySpacing.md) {
                Image(systemName: icon)
                    .font(.system(size: 22))
                    .foregroundStyle(Color(hex: "#39C5FF"))
                VStack(alignment: .leading, spacing: 3) {
                    Text(title)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(.white)
                    Text(subtitle)
                        .font(.system(size: 11))
                        .foregroundStyle(RelayColors.textSecondary)
                }
                Spacer()
                if let badge {
                    Text(badge)
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(Color(hex: "#60A5FA"))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 5)
                        .background(Color(hex: "#103264"))
                        .clipShape(Capsule())
                }
                Image(systemName: showFilePicker ? "chevron.up" : "chevron.down")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(RelayColors.textSecondary)
            }
            .padding(RelaySpacing.md)
        }
        .buttonStyle(.plain)
    }

    private var actionBar: some View {
        HStack(spacing: RelaySpacing.md) {
            instructionAction(icon: "plus", color: Color(hex: "#39C5FF")) { showBrowser = true }
            instructionAction(icon: isEditing ? "checkmark" : "pencil", color: Color(hex: "#39C5FF")) {
                if isEditing { saveDocument() }
                isEditing.toggle()
            }
            instructionAction(icon: "slider.horizontal.3", color: Color(hex: "#D45CFF")) { showAgentDetail = true }
            instructionAction(icon: "trash", color: RelayColors.accentRed) {
                pendingDelete = selectedDocument
            }
            .disabled(selectedDocument == nil)
            .opacity(selectedDocument == nil ? 0.45 : 1)
        }
    }

    private func instructionAction(icon: String, color: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: 20, weight: .medium))
                .foregroundStyle(color)
                .frame(maxWidth: .infinity, minHeight: 48)
                .background(color.opacity(0.08))
                .clipShape(RoundedRectangle(cornerRadius: 10))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(color.opacity(0.28)))
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private var instructionDocument: some View {
        if isLoadingDocuments {
            RelayLoadingState(message: section.loadingMessage)
                .frame(minHeight: 280)
        } else if let error = documentError ?? library.error, library.selectedFile == nil {
            VStack(spacing: RelaySpacing.md) {
                RelayStatusStrip(title: "\(section.title) could not be loaded", detail: error, tone: .failure, icon: "exclamationmark.triangle.fill")
                Button("Retry") { _Concurrency.Task { await loadDocuments() } }
                    .buttonStyle(RelayButtonStyle(variant: .secondary))
            }
        } else if library.selectedFile == nil {
            VStack(spacing: RelaySpacing.md) {
                RelayEmptyState(icon: "doc.badge.plus", title: section.emptyTitle, subtitle: section.emptySubtitle)
                if section == .instructions {
                    Button("Create SOUL.md") {
                        _Concurrency.Task { await createSoulFile() }
                    }
                    .buttonStyle(RelayButtonStyle(variant: .primary))
                } else {
                    Button("Browse files") {
                        showBrowser = true
                    }
                    .buttonStyle(RelayButtonStyle(variant: .primary))
                }
            }
        } else if isEditing {
            TextEditor(text: $library.editedContent)
                .font(.system(size: 14, design: .monospaced))
                .foregroundStyle(.white)
                .scrollContentBackground(.hidden)
                .padding(RelaySpacing.sm)
                .frame(minHeight: 430)
                .background(Color(hex: "#08111D"))
                .clipShape(RoundedRectangle(cornerRadius: 14))
                .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color(hex: "#39C5FF").opacity(0.35)))
        } else {
            ReadableMarkdownView(markdown: library.editedContent)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(RelaySpacing.md)
            .background(Color(hex: "#08111D"))
            .clipShape(RoundedRectangle(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.white.opacity(0.12)))
        }
    }

    private var libraryRoot: LibraryRoot {
        .agent(agentId: selectedAgent.openClawIdentifier, agentName: selectedAgent.name)
    }

    private func loadDocuments(selecting preferredDocumentID: String? = nil) async {
        let previousDocumentID = preferredDocumentID ?? selectedDocument?.id
        isEditing = false
        showFilePicker = false
        isLoadingDocuments = true
        documentError = nil
        library.error = nil
        library.selectedFile = nil
        library.editedContent = ""
        selectedDocument = nil

        do {
            documents = try await discoverDocuments()
            let document = previousDocumentID.flatMap { id in
                documents.first(where: { $0.id == id })
            } ?? documents.first
            if let document {
                await openDocument(document, collapsesPicker: false)
            }
        } catch {
            documents = []
            documentError = error.localizedDescription
            Telemetry.shared.capture(
                error: error,
                attributes: [
                    "operation": "agent.workspace.documents",
                    "workspaceId": workspaceId,
                    "section": section.title,
                    "agentId": selectedAgent.id,
                ]
            )
        }
        isLoadingDocuments = false
    }

    private func openDocument(_ document: AgentWorkspaceDocument, collapsesPicker: Bool = true) async {
        isEditing = false
        if collapsesPicker { showFilePicker = false }
        selectedDocument = document
        library.selectedFile = nil
        library.editedContent = ""
        await library.open(
            file: document.file,
            workspaceId: workspaceId,
            root: libraryRoot,
            folder: document.folder
        )
    }

    private func saveDocument() {
        guard let selectedDocument, let filename = library.selectedFile?.filename else { return }
        let content = library.editedContent
        _Concurrency.Task {
            await library.write(
                filename: filename,
                content: content,
                workspaceId: workspaceId,
                root: libraryRoot,
                folder: selectedDocument.folder
            )
            await loadDocuments(selecting: selectedDocument.id)
        }
    }

    private func createSoulFile() async {
        await library.write(
            filename: "SOUL.md",
            content: "# \(selectedAgent.name)\n\nAdd this agent's purpose and instructions here.\n",
            workspaceId: workspaceId,
            root: libraryRoot,
            folder: ""
        )
        await loadDocuments()
    }

    private func discoverDocuments() async throws -> [AgentWorkspaceDocument] {
        let rootListing = try await library.fetchListing(workspaceId: workspaceId, root: libraryRoot, folder: "")
        var result: [AgentWorkspaceDocument] = []

        switch section {
        case .instructions:
            result = markdownDocuments(in: rootListing)
        case .memory:
            result = markdownDocuments(in: rootListing).filter {
                let name = $0.file.filename.lowercased()
                return name == "memory.md" || name == "user.md"
            }
            let memoryFolders = rootListing.folders.filter {
                ["memory", "memories"].contains($0.name.lowercased())
            }
            for folder in memoryFolders {
                result.append(contentsOf: try await recursivelyDiscoverMarkdown(startingAt: folder.path))
            }
        case .skills:
            let skillsFolders = rootListing.folders.filter { $0.name.caseInsensitiveCompare("skills") == .orderedSame }
            for folder in skillsFolders {
                result.append(contentsOf: try await discoverSkillManifests(startingAt: folder.path))
            }
        }

        let unique = Dictionary(grouping: result, by: \.id).compactMap { $0.value.first }
        return unique.sorted(by: documentSort)
    }

    private func recursivelyDiscoverMarkdown(startingAt folder: String) async throws -> [AgentWorkspaceDocument] {
        var queue = [folder]
        var result: [AgentWorkspaceDocument] = []

        while let currentFolder = queue.first {
            queue.removeFirst()
            let listing = try await library.fetchListing(workspaceId: workspaceId, root: libraryRoot, folder: currentFolder)
            result.append(contentsOf: markdownDocuments(in: listing))
            queue.append(contentsOf: listing.folders.map(\.path))
        }
        return result
    }

    private func discoverSkillManifests(startingAt folder: String) async throws -> [AgentWorkspaceDocument] {
        var queue = [folder]
        var result: [AgentWorkspaceDocument] = []

        while let currentFolder = queue.first {
            queue.removeFirst()
            let listing = try await library.fetchListing(workspaceId: workspaceId, root: libraryRoot, folder: currentFolder)
            let manifests = markdownDocuments(in: listing).filter {
                $0.file.filename.caseInsensitiveCompare("SKILL.md") == .orderedSame
            }
            let isSkillsRoot = currentFolder
                .split(separator: "/")
                .last
                .map(String.init)?
                .caseInsensitiveCompare("skills") == .orderedSame
            if manifests.isEmpty || isSkillsRoot {
                queue.append(contentsOf: listing.folders.map(\.path))
            }
            result.append(contentsOf: manifests)
        }
        return result
    }

    private func markdownDocuments(in listing: LibraryListResult) -> [AgentWorkspaceDocument] {
        listing.files.compactMap { file in
            let ext = (file.filename as NSString).pathExtension.lowercased()
            guard ext == "md" || ext == "markdown" else { return nil }
            return AgentWorkspaceDocument(file: file, folder: listing.folder)
        }
    }

    private func documentSort(_ lhs: AgentWorkspaceDocument, _ rhs: AgentWorkspaceDocument) -> Bool {
        if section == .instructions {
            if lhs.file.filename.caseInsensitiveCompare("SOUL.md") == .orderedSame { return true }
            if rhs.file.filename.caseInsensitiveCompare("SOUL.md") == .orderedSame { return false }
        }
        if section == .memory {
            if lhs.file.filename.caseInsensitiveCompare("MEMORY.md") == .orderedSame { return true }
            if rhs.file.filename.caseInsensitiveCompare("MEMORY.md") == .orderedSame { return false }
        }
        return lhs.displayPath.localizedStandardCompare(rhs.displayPath) == .orderedAscending
    }

    private func selectAgent(_ agent: Agent) {
        selectedAgent = agent
        onAgentSelected(agent)
        showPicker = false
    }

}

private struct AgentPickerOverlay: View {
    let agents: [Agent]
    let selectedAgent: Agent
    let onSelect: (Agent) -> Void
    let onDismiss: () -> Void

    @State private var searchText = ""

    private var filteredAgents: [Agent] {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty else { return agents }
        return agents.filter {
            $0.name.localizedCaseInsensitiveContains(query) ||
            $0.role.localizedCaseInsensitiveContains(query) ||
            agentRuntimeLabel($0).localizedCaseInsensitiveContains(query)
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            Capsule()
                .fill(RelayColors.textTertiary)
                .frame(width: 36, height: 4)
                .padding(.top, 10)
                .padding(.bottom, 12)

            HStack {
                Text("Agent picker")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(.white)
                Spacer()
                Button(action: onDismiss) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 22))
                        .foregroundStyle(RelayColors.textSecondary)
                        .frame(width: 44, height: 44)
                }
                .accessibilityLabel("Close agent picker")
            }
            .padding(.horizontal, RelaySpacing.md)

            RelaySearchField(text: $searchText, prompt: "Search agents")
                .padding(.horizontal, RelaySpacing.md)
                .padding(.bottom, RelaySpacing.sm)

            if filteredAgents.isEmpty {
                RelayEmptyState(icon: "magnifyingglass", title: "No agents found", subtitle: "Try another name, role, or runtime.")
                    .frame(maxHeight: .infinity)
            } else {
                ScrollView {
                    LazyVStack(spacing: 0) {
                        ForEach(filteredAgents) { agent in
                            Button { onSelect(agent) } label: {
                                HStack(spacing: RelaySpacing.sm) {
                                    RelayAvatar(name: agent.name, imageUrl: agent.avatarUrl, size: .medium, status: agent.status)
                                    Text(agent.name)
                                        .font(.system(size: 14, weight: .semibold))
                                        .foregroundStyle(.white)
                                        .lineLimit(1)
                                    Spacer(minLength: RelaySpacing.xs)
                                    runtimeBadge(for: agent)
                                    placementBadge(for: agent)
                                    if agent.id == selectedAgent.id {
                                        Image(systemName: "checkmark")
                                            .font(.system(size: 15, weight: .bold))
                                            .foregroundStyle(Color(hex: "#A855F7"))
                                    }
                                }
                                .padding(.horizontal, RelaySpacing.md)
                                .frame(minHeight: 58)
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                            Divider().overlay(Color.white.opacity(0.07)).padding(.leading, 66)
                        }
                    }
                }
            }
        }
        .background(Color(hex: "#071321").ignoresSafeArea())
        .overlay(alignment: .top) { Rectangle().fill(Color.white.opacity(0.08)).frame(height: 1) }
        .accessibilityAddTraits(.isModal)
    }
}

private func agentRuntimeLabel(_ agent: Agent) -> String {
    switch agent.runtimeType {
    case .openClaw: return "OPENCLAW"
    case .hermes: return "HERMES"
    case .claudeCode: return "CLAUDE"
    case .unknown, nil: return "UNASSIGNED"
    }
}

private func runtimeBadge(for agent: Agent) -> some View {
    Text(agentRuntimeLabel(agent))
        .font(.system(size: 9, weight: .bold))
        .foregroundStyle(Color(hex: "#60A5FA"))
        .padding(.horizontal, 7)
        .padding(.vertical, 4)
        .background(Color(hex: "#103264"))
        .clipShape(RoundedRectangle(cornerRadius: 4))
}

private func placementBadge(for agent: Agent) -> some View {
    let placement = AgentPlacementFilter.placement(for: agent)
    let color: Color = placement == .business ? RelayColors.accentGreen : (placement == .family ? RelayColors.accentPurple : RelayColors.accent)
    return Text(placement.rawValue.uppercased())
        .font(.system(size: 9, weight: .bold))
        .foregroundStyle(color)
        .padding(.horizontal, 7)
        .padding(.vertical, 4)
        .background(color.opacity(0.14))
        .clipShape(RoundedRectangle(cornerRadius: 4))
}

struct AgentRosterView: View {
    let workspaceId: String
    private let initialTab: AgentsManagementTab

    @StateObject private var state: RosterState
    @State private var selectedTab: AgentsManagementTab
    @State private var navigatingToAgent: Agent? = nil
    @EnvironmentObject private var appStore: AppStore

    init(workspaceId: String, initialTab: AgentsManagementTab = .agents) {
        self.workspaceId = workspaceId
        self.initialTab = initialTab
        _state = StateObject(wrappedValue: RosterState(workspaceId: workspaceId))
        _selectedTab = State(initialValue: initialTab)
    }

    var body: some View {
        NavigationStack {
            ZStack {
                ClawColors.backgroundPrimary.ignoresSafeArea()

                VStack(spacing: 0) {
                    customNavBar
                    managementTabs

                    if selectedTab == .agents {
                        VStack(spacing: ClawSpacing.sm) {
                            placementFilter
                            searchBar
                        }
                    }

                    Divider().background(ClawColors.separator)

                    tabContent
                }
            }
            .navigationBarHidden(true)
            .task {
                selectedTab = initialTab
                await state.load()
            }
            .onReceive(appStore.$agents) { agents in
                guard appStore.selectedWorkspace?.id == workspaceId else { return }
                state.agents = agents
                if appStore.hasLoadedAgents {
                    state.hasLoaded = true
                }
            }
            .onChange(of: workspaceId) { _, newWorkspaceId in
                state.workspaceId = newWorkspaceId
                _Concurrency.Task { await state.refresh() }
            }
            .sheet(isPresented: $state.showHiringFlow) {
                HiringFlowView()
            }
            .navigationDestination(item: $navigatingToAgent) { agent in
                AgentDetailView(agent: agent)
            }
        }
        .preferredColorScheme(.dark)
    }

    @ViewBuilder
    private var tabContent: some View {
        switch selectedTab {
        case .classify:
            BusinessGroupsView(
                initialTab: .classify,
                initialClassificationFilter: .business,
                showsTabPicker: false,
                showsNavigationTitle: false
            )
        case .agents:
            agentRosterContent
        case .structure:
            BusinessGroupsView(initialTab: .structure, showsTabPicker: false, showsNavigationTitle: false)
        case .tasks:
            AgentTasksView(workspaceId: workspaceId)
        case .calendar:
            BusinessGroupsView(initialTab: .calendar, showsTabPicker: false, showsNavigationTitle: false)
        }
    }

    // MARK: - Custom Nav Bar

    private var customNavBar: some View {
        HStack(spacing: ClawSpacing.md) {
            Text("Agents")
                .font(RelayFonts.navigationTitle)
                .foregroundStyle(ClawColors.textPrimary)

            Spacer()

            Button {
                state.showHiringFlow = true
            } label: {
                Label("Add Agent", systemImage: "plus")
            }
            .buttonStyle(RelayButtonStyle(size: .sm, variant: .secondary))
            .accessibilityHint("Opens the agent creation flow")
        }
        .padding(.horizontal, ClawSpacing.lg)
        .padding(.top, ClawSpacing.md)
        .padding(.bottom, ClawSpacing.sm)
    }

    private var managementTabs: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: ClawSpacing.sm) {
                ForEach(AgentsManagementTab.allCases, id: \.self) { tab in
                    Button {
                        withAnimation(.easeInOut(duration: 0.16)) {
                            selectedTab = tab
                        }
                    } label: {
                        Label(tab.rawValue, systemImage: tab.icon)
                            .font(RelayFonts.cardTitle)
                            .foregroundStyle(selectedTab == tab ? RelayColors.accent : RelayColors.textSecondary)
                            .padding(.horizontal, ClawSpacing.md)
                            .frame(minHeight: RelayMetrics.minimumHitTarget)
                            .background(selectedTab == tab ? RelayColors.backgroundSelected : RelayColors.backgroundCard)
                            .clipShape(RoundedRectangle(cornerRadius: RelayRadius.sm))
                            .overlay(RoundedRectangle(cornerRadius: RelayRadius.sm).stroke(selectedTab == tab ? RelayColors.borderFocus : RelayColors.borderStandard))
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("agents-mode-\(tab.rawValue.lowercased().replacingOccurrences(of: " ", with: "-"))")
                    .accessibilityValue(selectedTab == tab ? "Selected" : "")
                }
            }
            .padding(.horizontal, ClawSpacing.lg)
            .padding(.bottom, ClawSpacing.sm)
        }
        .accessibilityIdentifier("agents-mode-tabs")
    }

    // MARK: - Search Bar

    private var placementFilter: some View {
        HStack(spacing: RelaySpacing.sm) {
            ForEach(AgentPlacementFilter.allCases) { placement in
                FilterChip(
                    title: placement.rawValue,
                    isSelected: state.placementFilter == placement,
                    action: { state.placementFilter = placement }
                )
            }
        }
        .padding(.horizontal, ClawSpacing.lg)
        .padding(.top, ClawSpacing.sm)
    }

    private var searchBar: some View {
        RelaySearchField(text: $state.searchText, prompt: "Search agents")
        .padding(.horizontal, ClawSpacing.lg)
        .padding(.vertical, ClawSpacing.sm)
    }

    // MARK: - Agent List

    @ViewBuilder
    private var agentRosterContent: some View {
        if let error = visibleAgentError, state.agents.isEmpty {
            VStack(spacing: RelaySpacing.lg) {
                RelayErrorPanel(message: "Agents couldn't load. \(error)")
                    .padding(.horizontal, RelaySpacing.xl)
                Button {
                    _Concurrency.Task {
                        try? await appStore.syncAgents(workspaceId: workspaceId)
                        await state.refresh()
                    }
                } label: { Text("Retry") }
                .buttonStyle(RelayButtonStyle(size: .md, variant: .secondary))
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if shouldShowAgentSkeleton {
            ScrollView {
                VStack(spacing: ClawSpacing.sm) {
                    ForEach(0..<8, id: \.self) { _ in
                        SkeletonAgentCard()
                    }
                }
                .padding(ClawSpacing.lg)
            }
            .background(ClawColors.backgroundPrimary)
        } else if state.filteredAgents.isEmpty {
            EmptyStateView(
                icon: state.searchText.isEmpty ? "cpu" : "magnifyingglass",
                iconColor: ClawColors.accentPurple,
                title: state.searchText.isEmpty ? "No \(state.placementFilter.rawValue) agents" : "No matching agents",
                subtitle: state.searchText.isEmpty ? "Agents will appear here after this placement has loaded and contains agents." : "Try a different search term within \(state.placementFilter.rawValue).",
                actionTitle: state.searchText.isEmpty ? "Add agent" : nil,
                action: state.searchText.isEmpty ? { state.showHiringFlow = true } : nil
            )
        } else {
            agentList
        }
    }

    private var shouldShowAgentSkeleton: Bool {
        guard state.agents.isEmpty else { return false }
        return state.isLoading || appStore.isLoadingAgents || (!state.hasLoaded && !appStore.hasLoadedAgents)
    }

    private var visibleAgentError: String? {
        state.error ?? appStore.agentLoadError
    }

    private var agentList: some View {
        List {
            ForEach(state.filteredAgents) { agent in
                AgentRosterRow(agent: agent) {
                    navigatingToAgent = agent
                }
                .listRowBackground(ClawColors.backgroundPrimary)
                .listRowSeparatorTint(ClawColors.separator)
                .listRowInsets(EdgeInsets(top: 0, leading: ClawSpacing.lg, bottom: 0, trailing: ClawSpacing.lg))
            }
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        .refreshable {
            await state.refresh()
        }
    }
}

// MARK: - AgentRosterRow

private struct AgentRosterRow: View {
    let agent: Agent
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: ClawSpacing.md) {
                AvatarView(name: agent.name, imageUrl: agent.avatarUrl, size: .medium, status: agent.status)

                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: ClawSpacing.sm) {
                        Text(agent.name)
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(ClawColors.textPrimary)
                        Spacer()
                        StatusBadge(status: agent.status, compact: false)
                    }

                    Text(agent.role)
                        .font(.system(size: 13))
                        .foregroundStyle(ClawColors.textSecondary)
                        .lineLimit(1)
                }
            }
            .padding(.vertical, ClawSpacing.md)
            .padding(.horizontal, RelaySpacing.sm)
            .background(RelayColors.backgroundCard)
            .overlay(alignment: .bottom) { Rectangle().fill(RelayColors.borderLow).frame(height: 1) }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityHint("Opens agent details")
    }
}

// MARK: - Preview

#Preview {
    AgentRosterView(workspaceId: "preview")
}
