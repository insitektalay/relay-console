// AgentDetailView.swift
// ClawChat – Agent detail screen (web-canonical)

import SwiftUI
import UniformTypeIdentifiers

enum AgentDetailParityDestination: String, CaseIterable {
    case instructions = "Agent Instructions"
    case memory = "Agent Memory"
    case skills = "Agent Skills"
    case files = "Workspace Files"
    case calendar = "Work Calendar"
    case tasks = "Work Task Schedule"
    case cron = "Cron Jobs"
}

// MARK: - AgentDetailView

struct AgentDetailView: View {
    let agent: Agent

    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var appStore: AppStore
    @State private var currentAgent: Agent
    @State private var showEditSheet = false
    @State private var showStatusSheet = false
    @State private var showDeleteConfirmation = false
    @State private var isDeleting = false
    @State private var deleteError: String?

    init(agent: Agent) {
        self.agent = agent
        self._currentAgent = State(initialValue: agent)
    }

    var body: some View {
        ZStack {
            ClawColors.backgroundPrimary.ignoresSafeArea()

            ScrollView {
                VStack(spacing: 0) {
                    headerSection
                    breadcrumb
                    summarySection
                    agentToolsSection
                    workSection
                    teamContextSection
                    destructiveActionsSection
                        .padding(.bottom, 48)
                }
            }
        }
        .navigationBarBackButtonHidden(false)
        .navigationTitle("")
        .toolbarBackground(ClawColors.backgroundPrimary, for: .navigationBar)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showEditSheet = true
                } label: {
                    Image(systemName: "pencil")
                        .foregroundStyle(ClawColors.accent)
                }
                .accessibilityLabel("Edit agent")
                .accessibilityIdentifier("agent-detail-edit")
            }
        }
        .sheet(isPresented: $showEditSheet) {
            AgentEditSheet(agent: currentAgent) { updated in
                currentAgent = updated
            }
            .environmentObject(appStore)
        }
        .sheet(isPresented: $showStatusSheet) {
            AgentStatusSheet(agent: currentAgent) { updated in
                currentAgent = updated
                if let index = appStore.agents.firstIndex(where: { $0.id == updated.id }) {
                    appStore.agents[index] = updated
                }
            }
        }
        .confirmationDialog(
            "Delete \(currentAgent.name)?",
            isPresented: $showDeleteConfirmation,
            titleVisibility: .visible
        ) {
            Button("Delete agent", role: .destructive) {
                _Concurrency.Task { await deleteAgent() }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This permanently removes the agent, its runtime bindings, schedules, reviews, and active assignments. This cannot be undone.")
        }
        .alert("Unable to delete agent", isPresented: Binding(
            get: { deleteError != nil },
            set: { if !$0 { deleteError = nil } }
        )) {
            Button("OK", role: .cancel) { deleteError = nil }
        } message: {
            Text(deleteError ?? "")
        }
        .onReceive(appStore.$agents) { agents in
            if let refreshed = agents.first(where: { $0.id == currentAgent.id }) {
                currentAgent = refreshed
            }
        }
        .preferredColorScheme(.dark)
    }

    // MARK: - Header

    private var headerSection: some View {
        HStack(alignment: .top, spacing: RelaySpacing.md) {
            RelayAvatar(name: currentAgent.name, imageUrl: currentAgent.avatarUrl, size: .large, status: currentAgent.status)
            VStack(alignment: .leading, spacing: 4) {
                Text(currentAgent.name)
                    .font(RelayFonts.screenTitle)
                    .foregroundStyle(RelayColors.textPrimary)

                Text(currentAgent.role)
                    .font(RelayFonts.cardBody)
                    .foregroundStyle(RelayColors.textSecondary)

                HStack(spacing: RelaySpacing.xs) {
                    StatusBadge(status: currentAgent.status)
                    RelayBadge(text: runtimeLabel, color: RelayColors.accentPurple, icon: "cpu")
                }
            }
            Spacer()
            RelayIconButton(icon: "bolt.circle", label: "Set agent status") { showStatusSheet = true }
                .accessibilityIdentifier("agent-detail-status")
        }
        .padding(.top, RelaySpacing.lg)
        .padding(.horizontal, RelaySpacing.lg)
    }

    private var summarySection: some View {
        VStack(alignment: .leading, spacing: RelaySpacing.md) {
            RelaySectionHeader(title: "Agent summary", subtitle: "Identity, runtime, and availability")
            RelayPanel {
                if let description = currentAgent.description?.trimmingCharacters(in: .whitespacesAndNewlines), !description.isEmpty {
                    Text(description).font(RelayFonts.cardBody).foregroundStyle(RelayColors.textPrimary)
                    Divider().overlay(RelayColors.borderLow)
                }
                RelayMetaRow(label: "Harness / Runtime", value: runtimeLabel, icon: "cpu")
                RelayMetaRow(label: "Working hours", value: workingHoursLabel, icon: "clock")
                RelayMetaRow(label: "Timezone", value: currentAgent.timezone, icon: "globe")
                RelayMetaRow(label: "Manager", value: managerName, icon: "person.badge.key")
                RelayMetaRow(label: "Capabilities", value: currentAgent.capabilities.isEmpty ? "None declared" : "\(currentAgent.capabilities.count)", icon: "checkmark.seal")
            }
        }
        .padding(.horizontal, RelaySpacing.lg)
        .padding(.top, RelaySpacing.lg)
    }

    private var agentToolsSection: some View {
        VStack(alignment: .leading, spacing: RelaySpacing.md) {
            RelaySectionHeader(title: "Knowledge & workspace", subtitle: "Agent files stored in the managed Relay document service")
            RelayPanel(padding: 0) {
                if let workspaceId = appStore.selectedWorkspace?.id {
                    destinationLink(.instructions, subtitle: "Runtime instructions and agent configuration", icon: "text.book.closed") {
                        AgentInstructionsView(
                            workspaceId: workspaceId,
                            initialAgent: currentAgent,
                            onAgentSelected: { currentAgent = $0 }
                        )
                    }
                    rowDivider
                    destinationLink(.memory, subtitle: "Persistent memory and knowledge files", icon: "brain.head.profile") {
                        AgentWorkspaceKnowledgeView(
                            workspaceId: workspaceId,
                            initialAgent: currentAgent,
                            section: .memory,
                            onAgentSelected: { currentAgent = $0 }
                        )
                    }
                    rowDivider
                    destinationLink(.skills, subtitle: "Installed skill definitions in the agent workspace", icon: "sparkles") {
                        AgentWorkspaceKnowledgeView(
                            workspaceId: workspaceId,
                            initialAgent: currentAgent,
                            section: .skills,
                            onAgentSelected: { currentAgent = $0 }
                        )
                    }
                    rowDivider
                    destinationLink(.files, subtitle: "Browse the complete remote workspace", icon: "folder") {
                        WorkspaceLibraryView(workspaceId: workspaceId, root: agentLibraryRoot)
                    }
                } else {
                    RelayStatusStrip(
                        title: "Agent workspace unavailable",
                        detail: "Select a Relay workspace to open instructions, memory, skills, and files.",
                        tone: .neutral,
                        icon: "lock.fill"
                    )
                    .padding(RelaySpacing.md)
                }
            }
        }
        .padding(.horizontal, RelaySpacing.lg)
        .padding(.top, RelaySpacing.lg)
    }

    private var workSection: some View {
        VStack(alignment: .leading, spacing: RelaySpacing.md) {
            RelaySectionHeader(title: "Work", subtitle: "Calendar, task schedule, and runtime jobs")
            RelayPanel(padding: 0) {
                destinationLink(.calendar, subtitle: "Workspace calendar; choose Agent scope", icon: "calendar") {
                    ScheduleView().environmentObject(appStore)
                }
                rowDivider
                if let workspaceId = appStore.selectedWorkspace?.id {
                    destinationLink(.tasks, subtitle: "Relay task state grouped by agent", icon: "checklist") {
                        AgentTasksView(workspaceId: workspaceId).environmentObject(appStore)
                    }
                } else {
                    unavailableRow(.tasks, reason: "Select a Relay workspace to load task schedules.", icon: "checklist")
                }
                rowDivider
                if currentAgent.runtimeType == .hermes, let workspaceId = appStore.selectedWorkspace?.id {
                    destinationLink(.cron, subtitle: "Hermes jobs.json schedules and prompts", icon: "calendar.badge.clock") {
                        HermesCronJobsView(workspaceId: workspaceId, agentId: currentAgent.openClawIdentifier, agentName: currentAgent.name)
                    }
                } else {
                unavailableRow(.cron, reason: currentAgent.runtimeType == .hermes ? "Select a Relay workspace to load cron jobs." : "Cron editing is available only for Hermes agents.", icon: "calendar.badge.clock")
                }
                rowDivider
                unavailableRow(title: "Work Review", reason: "A per-agent review feed is not available; sample review data is never shown as live work.", icon: "chart.bar.doc.horizontal")
            }
        }
        .padding(.horizontal, RelaySpacing.lg)
        .padding(.top, RelaySpacing.lg)
    }

    // MARK: - Breadcrumb

    private var breadcrumb: some View {
        HStack(spacing: 4) {
            if let companyId = currentAgent.companyId {
                let companyName = appStore.companies.first(where: { $0.id == companyId })?.name ?? companyId
                Text(companyName)
                    .font(.system(size: 12))
                    .foregroundStyle(ClawColors.textTertiary)
                Image(systemName: "chevron.right")
                    .font(.system(size: 9))
                    .foregroundStyle(ClawColors.textTertiary)
            }
            if let deptId = currentAgent.departmentId {
                let deptName = appStore.departments.first(where: { $0.id == deptId })?.name ?? deptId
                Text(deptName)
                    .font(.system(size: 12))
                    .foregroundStyle(ClawColors.textTertiary)
                Image(systemName: "chevron.right")
                    .font(.system(size: 9))
                    .foregroundStyle(ClawColors.textTertiary)
            }
            if let teamId = currentAgent.teamId {
                let teamName = appStore.teams.first(where: { $0.id == teamId })?.name ?? teamId
                Text(teamName)
                    .font(.system(size: 12))
                    .foregroundStyle(ClawColors.accent)
            }
        }
        .padding(.horizontal, ClawSpacing.lg)
        .padding(.top, ClawSpacing.md)
    }

    // MARK: - Team Context

    private var teamContextSection: some View {
        VStack(alignment: .leading, spacing: ClawSpacing.md) {
            sectionHeader(title: "Organisation", icon: "person.3.fill")

            VStack(spacing: 0) {
                if let teamId = currentAgent.teamId {
                    let teamName = appStore.teams.first(where: { $0.id == teamId })?.name ?? teamId
                    contextRow(icon: "person.3.fill", label: "Team", value: teamName, color: ClawColors.accentGreen)
                    Divider().background(ClawColors.separator).padding(.horizontal, ClawSpacing.md)
                }
                if let deptId = currentAgent.departmentId {
                    let deptName = appStore.departments.first(where: { $0.id == deptId })?.name ?? deptId
                    contextRow(icon: "building.2.fill", label: "Department", value: deptName, color: ClawColors.accentPurple)
                    Divider().background(ClawColors.separator).padding(.horizontal, ClawSpacing.md)
                }
                if let companyId = currentAgent.companyId {
                    let companyName = appStore.companies.first(where: { $0.id == companyId })?.name ?? companyId
                    contextRow(icon: "building.columns.fill", label: "Company", value: companyName, color: ClawColors.accent)
                    Divider().background(ClawColors.separator).padding(.horizontal, ClawSpacing.md)
                }
                contextRow(
                    icon: "person.badge.key.fill",
                    label: "Manager",
                    value: currentAgent.managerId ?? "None assigned",
                    color: currentAgent.managerId != nil ? ClawColors.accent : ClawColors.textTertiary
                )

            }
            .background(ClawColors.backgroundSecondary)
            .cornerRadius(ClawRadius.md)
            .padding(.horizontal, ClawSpacing.lg)
        }
        .padding(.vertical, ClawSpacing.lg)
    }

    private var destructiveActionsSection: some View {
        VStack(alignment: .leading, spacing: ClawSpacing.md) {
            sectionHeader(title: "Danger Zone", icon: "exclamationmark.triangle.fill")
            Button(role: .destructive) {
                showDeleteConfirmation = true
            } label: {
                HStack {
                    if isDeleting { ProgressView().tint(ClawColors.accentRed) }
                    Image(systemName: "trash.fill")
                    Text(isDeleting ? "Deleting agent…" : "Delete agent")
                    Spacer()
                }
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(ClawColors.accentRed)
                .padding(ClawSpacing.md)
                .background(ClawColors.accentRed.opacity(0.1))
                .clipShape(RoundedRectangle(cornerRadius: ClawRadius.md))
            }
            .disabled(isDeleting)
            .padding(.horizontal, ClawSpacing.lg)
        }
        .padding(.top, ClawSpacing.md)
    }

    private func deleteAgent() async {
        guard !isDeleting else { return }
        isDeleting = true
        defer { isDeleting = false }
        do {
            let result: AgentDeleteResult = try await APIClient.shared.request(.deleteAgent(id: currentAgent.id))
            guard result.success else { throw APIError.serverError(statusCode: 500, message: "The agent was not deleted.") }
            appStore.agents.removeAll { $0.id == currentAgent.id }
            if let workspaceId = appStore.selectedWorkspace?.id {
                try? await appStore.syncAgents(workspaceId: workspaceId)
                try? await appStore.syncThreads(workspaceId: workspaceId)
            }
            dismiss()
        } catch {
            deleteError = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    private func contextRow(icon: String, label: String, value: String, color: Color) -> some View {
        HStack(spacing: ClawSpacing.md) {
            Image(systemName: icon)
                .font(.system(size: 13))
                .foregroundStyle(color)
                .frame(width: 20)
            Text(label)
                .font(.system(size: 13))
                .foregroundStyle(ClawColors.textSecondary)
            Spacer()
            Text(value)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(ClawColors.textPrimary)
        }
        .padding(.horizontal, ClawSpacing.md)
        .padding(.vertical, ClawSpacing.sm)
    }

    private var runtimeLabel: String {
        switch currentAgent.runtimeType {
        case .claudeCode: return "Claude Code"
        case .hermes: return "Hermes"
        case .openClaw: return "OpenClaw"
        case .unknown, nil: return "Not reported"
        }
    }

    private var workingHoursLabel: String {
        switch currentAgent.workingHoursMode {
        case .twentyFourSeven: return "24/7"
        case .scheduled: return "Scheduled"
        case .manual: return "Manual"
        }
    }

    private var managerName: String {
        guard let managerId = currentAgent.managerId else { return "None assigned" }
        return appStore.agents.first(where: { $0.id == managerId })?.name ?? managerId
    }

    private var agentLibraryRoot: LibraryRoot {
        .agent(agentId: currentAgent.openClawIdentifier, agentName: currentAgent.name)
    }

    private var rowDivider: some View {
        Divider().overlay(RelayColors.borderLow).padding(.horizontal, RelaySpacing.md)
    }

    private func destinationLink<Destination: View>(
        _ destination: AgentDetailParityDestination,
        subtitle: String,
        icon: String,
        @ViewBuilder content: () -> Destination
    ) -> some View {
        NavigationLink(destination: content()) {
            destinationRow(title: destination.rawValue, subtitle: subtitle, icon: icon, unavailable: false)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("agent-detail-\(destination.rawValue.lowercased().replacingOccurrences(of: " ", with: "-"))")
    }

    private func unavailableRow(_ destination: AgentDetailParityDestination, reason: String, icon: String) -> some View {
        unavailableRow(title: destination.rawValue, reason: reason, icon: icon)
    }

    private func unavailableRow(title: String, reason: String, icon: String) -> some View {
        destinationRow(title: title, subtitle: reason, icon: icon, unavailable: true)
            .accessibilityElement(children: .combine)
            .accessibilityValue("Unavailable. \(reason)")
    }

    private func destinationRow(title: String, subtitle: String, icon: String, unavailable: Bool) -> some View {
        HStack(spacing: RelaySpacing.md) {
            Image(systemName: icon)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(unavailable ? RelayColors.textTertiary : RelayColors.textSecondary)
                .frame(width: RelayMetrics.iconVisualSize, height: RelayMetrics.iconVisualSize)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(RelayFonts.cardTitle).foregroundStyle(RelayColors.textPrimary)
                Text(subtitle).font(RelayFonts.caption).foregroundStyle(RelayColors.textSecondary).fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: RelaySpacing.sm)
            Image(systemName: unavailable ? "lock.fill" : "chevron.right")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(RelayColors.textTertiary)
        }
        .padding(.horizontal, RelaySpacing.md)
        .frame(minHeight: 58)
        .opacity(unavailable ? 0.66 : 1)
        .contentShape(Rectangle())
    }

    // MARK: - Section Header

    private func sectionHeader(title: String, icon: String) -> some View {
        HStack(spacing: ClawSpacing.sm) {
            Image(systemName: icon)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(ClawColors.accent)
            Text(title.uppercased())
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(ClawColors.textSecondary)
        }
        .padding(.horizontal, ClawSpacing.lg)
    }
}

// MARK: - AgentEditSheet

struct AgentEditSheet: View {
    let agent: Agent
    var onSave: (Agent) -> Void

    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var appStore: AppStore
    @State private var name: String
    @State private var role: String
    @State private var avatarUrl: String?
    @State private var description: String
    @State private var workingHoursMode: WorkingHoursMode
    @State private var isSaving = false
    @State private var saveError: String?
    @State private var showAvatarImporter = false

    init(agent: Agent, onSave: @escaping (Agent) -> Void) {
        self.agent = agent
        self.onSave = onSave
        self._name = State(initialValue: agent.name)
        self._role = State(
            initialValue: agent.role.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                ? (agent.description ?? "")
                : agent.role
        )
        self._avatarUrl = State(initialValue: agent.avatarUrl)
        self._description = State(initialValue: agent.description ?? "")
        self._workingHoursMode = State(initialValue: agent.workingHoursMode)
    }

    var body: some View {
        NavigationStack {
            ZStack {
                ClawColors.backgroundPrimary.ignoresSafeArea()

                ScrollView {
                    VStack(alignment: .leading, spacing: RelaySpacing.lg) {
                        RelayPanel {
                            AgentBuiltInAvatarPicker(name: name, selection: $avatarUrl, onUpload: { showAvatarImporter = true })
                        }

                        RelaySectionHeader(title: "Display name")
                        RelayPanel {
                            relayField(label: "Display name", prompt: "Agent name", text: $name)
                            if !name.isEmpty && trimmedName.isEmpty { validationText("Name cannot contain only spaces.") }
                        }

                        RelaySectionHeader(title: "Role")
                        RelayPanel {
                            relayField(label: "Role", prompt: "What does this agent do?", text: $role)
                        }

                        RelaySectionHeader(title: "Upload")
                        Button { showAvatarImporter = true } label: {
                            VStack(spacing: RelaySpacing.sm) {
                                Image(systemName: "icloud.and.arrow.up").font(.system(size: 24)).foregroundStyle(RelayColors.accent)
                                Text("Tap to upload new avatar").font(.system(size: 13, weight: .semibold)).foregroundStyle(RelayColors.textPrimary)
                                Text("PNG or JPG, up to 5MB").font(RelayFonts.caption).foregroundStyle(RelayColors.textSecondary)
                            }
                            .frame(maxWidth: .infinity).padding(.vertical, RelaySpacing.lg)
                            .background(RelayColors.fieldBackground)
                            .clipShape(RoundedRectangle(cornerRadius: RelayRadius.md))
                            .overlay(RoundedRectangle(cornerRadius: RelayRadius.md).stroke(RelayColors.borderStandard, style: StrokeStyle(lineWidth: 1, dash: [5])))
                        }
                        .buttonStyle(.plain)

                        if let saveError {
                            RelayErrorPanel(message: saveError)
                        }
                    }
                    .padding(.horizontal, RelaySpacing.lg)
                    .padding(.vertical, RelaySpacing.lg)
                }
            }
            .navigationTitle("Edit Agent")
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
                        Button("Save") {
                            _Concurrency.Task { await save() }
                        }
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(canSave ? ClawColors.accent : ClawColors.textTertiary)
                        .disabled(!canSave)
                        .accessibilityIdentifier("agent-edit-save")
                    }
                }
            }
            .preferredColorScheme(.dark)
            .fileImporter(isPresented: $showAvatarImporter, allowedContentTypes: [.image], allowsMultipleSelection: false) { result in
                handleAvatarImport(result)
            }
        }
    }

    private var trimmedName: String { name.trimmingCharacters(in: .whitespacesAndNewlines) }
    private var trimmedRole: String { role.trimmingCharacters(in: .whitespacesAndNewlines) }
    private var canSave: Bool { !isSaving && !trimmedName.isEmpty }

    private func relayField(label: String, prompt: String, text: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: RelaySpacing.xs) {
            Text(label.uppercased()).font(RelayFonts.sectionHeader).foregroundStyle(RelayColors.textSecondary)
            TextField(prompt, text: text)
                .textFieldStyle(.plain)
                .font(RelayFonts.cardBody)
                .foregroundStyle(RelayColors.textPrimary)
                .padding(.horizontal, RelaySpacing.md)
                .frame(height: RelayMetrics.searchFieldHeight)
                .background(RelayColors.fieldBackground)
                .clipShape(RoundedRectangle(cornerRadius: RelayRadius.md))
                .overlay(RoundedRectangle(cornerRadius: RelayRadius.md).stroke(RelayColors.borderStandard))
        }
    }

    private func validationText(_ message: String) -> some View {
        Label(message, systemImage: "exclamationmark.circle.fill")
            .font(RelayFonts.caption)
            .foregroundStyle(RelayColors.accentRed)
    }

    private func handleAvatarImport(_ result: Result<[URL], any Error>) {
        guard case .success(let urls) = result, let url = urls.first else { return }
        let shouldStop = url.startAccessingSecurityScopedResource()
        defer { if shouldStop { url.stopAccessingSecurityScopedResource() } }
        guard let data = try? Data(contentsOf: url), data.count <= 5_000_000 else {
            saveError = "Avatar images must be 5MB or smaller."
            return
        }
        let mime = ["jpg", "jpeg"].contains(url.pathExtension.lowercased()) ? "image/jpeg" : "image/png"
        avatarUrl = "data:\(mime);base64,\(data.base64EncodedString())"
    }

    private func save() async {
        isSaving = true
        saveError = nil
        var params: [String: Any] = [
            "name": trimmedName,
            "role": trimmedRole,
            "workingHoursMode": workingHoursMode.rawValue,
            "working_hours_mode": workingHoursMode.rawValue
        ]
        if let avatarUrl, !avatarUrl.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            params["avatarUrl"] = avatarUrl
        } else {
            params["avatarUrl"] = NSNull()
        }
        let trimmedDesc = description.trimmingCharacters(in: .whitespaces)
        if !trimmedDesc.isEmpty { params["description"] = trimmedDesc }
        do {
            var updated: Agent = try await APIClient.shared.request(.updateAgent(id: agent.id, params: params))
            updated.workspaceId = agent.workspaceId
            onSave(updated)
            if let workspaceId = appStore.selectedWorkspace?.id {
                try? await appStore.syncAgents(workspaceId: workspaceId)
                try? await appStore.syncThreads(workspaceId: workspaceId)
            }
            dismiss()
        } catch {
            saveError = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
        isSaving = false
    }
}

enum AgentAvatarCategory: String, CaseIterable {
    case illustrated = "Illustrated"
    case corporate = "Corporate"
    case creator = "Creator"
    case urban = "Urban"
    case portrait = "Portrait"
    case comic = "Comic"
    case retro = "Retro"
    case hero = "Hero"
    case vector = "Vector"
}

enum BuiltInAgentAvatarLibrary {
    static let illustrated: [String] = [
        "/avatars/illustrated/illustrated-black-female-01.png",
        "/avatars/illustrated/illustrated-black-female-02.png",
        "/avatars/illustrated/illustrated-black-female-03.png",
        "/avatars/illustrated/illustrated-black-male-01.png",
        "/avatars/illustrated/illustrated-black-male-02.png",
        "/avatars/illustrated/illustrated-black-male-03.png",
        "/avatars/illustrated/illustrated-east-asian-female-01.png",
        "/avatars/illustrated/illustrated-east-asian-female-02.png",
        "/avatars/illustrated/illustrated-east-asian-female-03.png",
        "/avatars/illustrated/illustrated-east-asian-male-01.png",
        "/avatars/illustrated/illustrated-east-asian-male-02.png",
        "/avatars/illustrated/illustrated-east-asian-male-03.png",
        "/avatars/illustrated/illustrated-south-asian-female-01.png",
        "/avatars/illustrated/illustrated-south-asian-female-02.png",
        "/avatars/illustrated/illustrated-south-asian-female-03.png",
        "/avatars/illustrated/illustrated-south-asian-male-01.png",
        "/avatars/illustrated/illustrated-south-asian-male-02.png",
        "/avatars/illustrated/illustrated-south-asian-male-03.png",
        "/avatars/illustrated/illustrated-southeast-asian-female-01.png",
        "/avatars/illustrated/illustrated-southeast-asian-female-02.png",
        "/avatars/illustrated/illustrated-southeast-asian-female-03.png",
        "/avatars/illustrated/illustrated-southeast-asian-male-01.png",
        "/avatars/illustrated/illustrated-southeast-asian-male-02.png",
        "/avatars/illustrated/illustrated-southeast-asian-male-03.png",
        "/avatars/illustrated/illustrated-middle-eastern-female-01.png",
        "/avatars/illustrated/illustrated-middle-eastern-female-02.png",
        "/avatars/illustrated/illustrated-middle-eastern-female-03.png",
        "/avatars/illustrated/illustrated-middle-eastern-male-01.png",
        "/avatars/illustrated/illustrated-middle-eastern-male-02.png",
        "/avatars/illustrated/illustrated-middle-eastern-male-03.png",
        "/avatars/illustrated/illustrated-latino-female-01.png",
        "/avatars/illustrated/illustrated-latino-female-02.png",
        "/avatars/illustrated/illustrated-latino-female-03.png",
        "/avatars/illustrated/illustrated-latino-male-01.png",
        "/avatars/illustrated/illustrated-latino-male-02.png",
        "/avatars/illustrated/illustrated-latino-male-03.png",
        "/avatars/illustrated/illustrated-white-female-01.png",
        "/avatars/illustrated/illustrated-white-female-02.png",
        "/avatars/illustrated/illustrated-white-female-03.png",
        "/avatars/illustrated/illustrated-white-male-01.png",
        "/avatars/illustrated/illustrated-white-male-02.png",
        "/avatars/illustrated/illustrated-white-male-03.png",
    ]

    static let uploaded: [String] = [
        "/avatars/alex-kerss.png",
        "/api/mission-control/agent-image/gapminer",
        "/api/mission-control/agent-image/gapminer-auditor",
        "/api/mission-control/agent-image/gapminer-orchestrator",
        "/api/mission-control/agent-image/claude-code",
        "/api/mission-control/agent-image/codex",
        "/api/mission-control/agent-image/execution-optimizer",
        "/api/mission-control/agent-image/targeting-maintenance",
        "/api/mission-control/agent-image/elliot-page",
        "/api/mission-control/agent-image/nathan-guide",
        "/api/mission-control/agent-image/rs-onpage-optimizer",
    ]

    static func avatars(for category: AgentAvatarCategory) -> [String] {
        switch category {
        case .illustrated:
            return illustrated
        case .corporate:
            return sheetAvatars(sheet: 5, range: 1...100)
                + sheetAvatars(sheet: 6, range: 1...24)
        case .creator:
            return sheetAvatars(sheet: 7, range: 1...24)
        case .urban:
            return sheetAvatars(sheet: 1, range: 1...24)
        case .portrait:
            return sheetAvatars(sheet: 3, range: 1...24)
                + sheetAvatars(sheet: 10, range: 1...24)
        case .comic:
            return sheetAvatars(sheet: 8, range: 1...24)
                + sheetAvatars(sheet: 9, range: 1...9)
        case .retro:
            return sheetAvatars(sheet: 9, range: 10...24)
        case .hero:
            return sheetAvatars(sheet: 4, range: 1...24)
        case .vector:
            return sheetAvatars(sheet: 2, range: 1...24)
        }
    }

    private static func sheetAvatars(sheet: Int, range: ClosedRange<Int>) -> [String] {
        range.map { avatarNumber in
            let paddedSheet = String(format: "%02d", sheet)
            let paddedAvatar = String(format: "%03d", avatarNumber)
            return "/avatars/illustrated/sheet-\(paddedSheet)_avatar-\(paddedAvatar).png"
        }
    }
}

private struct AgentBuiltInAvatarPicker: View {
    let name: String
    @Binding var selection: String?
    let onUpload: () -> Void
    @State private var category: AgentAvatarCategory = .illustrated

    private var avatars: [String] {
        BuiltInAgentAvatarLibrary.avatars(for: category)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: ClawSpacing.md) {
            HStack {
                Spacer()
                ZStack(alignment: .bottomTrailing) {
                    AvatarView(name: name, imageUrl: selection, size: .xlarge)
                    Button(action: onUpload) {
                        Image(systemName: "camera.fill").font(.system(size: 13)).foregroundStyle(.white)
                            .frame(width: 30, height: 30).background(RelayColors.backgroundElevated).clipShape(Circle())
                            .overlay(Circle().stroke(RelayColors.borderStandard))
                    }
                }
                Spacer()
            }

            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 6), count: 3), spacing: 6) {
                ForEach(AgentAvatarCategory.allCases, id: \.self) { item in
                    Button { category = item } label: {
                        Text(item.rawValue).font(.system(size: 11, weight: .medium))
                            .foregroundStyle(category == item ? .white : RelayColors.textPrimary)
                            .frame(maxWidth: .infinity).padding(.vertical, 7)
                            .background(category == item ? RelayColors.accent.opacity(0.55) : RelayColors.fieldBackground)
                            .clipShape(RoundedRectangle(cornerRadius: 6))
                            .overlay(RoundedRectangle(cornerRadius: 6).stroke(category == item ? RelayColors.accent : RelayColors.borderStandard))
                    }
                    .buttonStyle(.plain)
                }
            }

            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: 4), spacing: 10) {
                ForEach(avatars, id: \.self) { avatar in
                    Button {
                        selection = avatar
                    } label: {
                        AvatarView(name: name, imageUrl: avatar, size: .medium)
                            .padding(4)
                            .background(selection == avatar ? ClawColors.accent.opacity(0.18) : Color.white.opacity(0.02))
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(selection == avatar ? ClawColors.accent : ClawColors.separator, lineWidth: selection == avatar ? 2 : 1)
                            )
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Preview

#Preview {
    NavigationStack {
        AgentDetailView(agent: Agent(
            id: "preview", name: "Nova", role: "Operations Lead",
            avatarUrl: nil, status: .onDuty,
            teamId: "t1", departmentId: "d1", companyId: "c1",
            workspaceId: "ws1", managerId: nil, description: nil,
            capabilities: [], workingHoursMode: .twentyFourSeven,
            timezone: "UTC", createdAt: Date(), updatedAt: Date(),
            runtimeType: nil, currentTaskId: nil,
            tasksCompletedToday: 3, successRate: 0.92,
            avgCompletionMinutes: 12, totalMinutesWorked: 480,
            budgetUsed: 1.24, budgetLimit: nil
        ))
        .environmentObject(AppStore())
    }
}
