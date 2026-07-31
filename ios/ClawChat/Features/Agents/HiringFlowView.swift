// HiringFlowView.swift
// ClawChat - web-aligned New Agent flow

import SwiftUI
import UniformTypeIdentifiers

private enum HiringStep: Int, CaseIterable {
    case setup = 1
    case details = 2
    case placement = 3
    case review = 4

    var title: String {
        switch self {
        case .setup: return "Setup"
        case .details: return "Details"
        case .placement: return "Placement"
        case .review: return "Review"
        }
    }
}

private enum AgentGroupDraftType: String, CaseIterable {
    case none
    case business
    case personal
    case family
}

private struct ProvisionFileDraft: Identifiable, Hashable {
    let id = UUID()
    var filename: String
    var content: String
    var isDefault: Bool

    var payload: [String: Any] {
        [
            "filename": filename,
            "content": content,
            "isDefault": isDefault,
            "source": "ios_import"
        ]
    }
}

private enum AgentCreationOutcome: Equatable {
    case none
    case created
    case provisioningPending
    case provisioned
    case failed
}

@MainActor
private final class HiringFlowState: ObservableObject {
    @Published var currentStep: HiringStep = .setup
    @Published var runtimeType: AgentRuntimeType = .openClaw

    @Published var avatarUrl: String?
    @Published var customAvatarUrl: String?
    @Published var isManagerDraft = false

    @Published var runtimeAgentName = "" {
        didSet {
            guard !runtimeExternalIdTouched else { return }
            runtimeExternalId = Self.slugifyOpenClawId(runtimeAgentName)
        }
    }
    @Published var runtimeExternalId = ""
    @Published var runtimeExternalIdTouched = false
    @Published var runtimeRole = ""
    @Published var runtimeRepoKey = ""
    @Published var runtimeWorkspaceRoot = ""
    @Published var runtimeModel = "sonnet"
    @Published var modelCatalog: HarnessModelCatalog?
    @Published var modelCatalogError: String?

    @Published var openClawAgentName = "" {
        didSet {
            guard !openClawSlugTouched else { return }
            openClawSlug = Self.slugifyOpenClawId(openClawAgentName)
        }
    }
    @Published var openClawSlug = ""
    @Published var openClawSlugTouched = false
    @Published var openClawRole = ""
    @Published var files: [ProvisionFileDraft] = []

    @Published var groupType: AgentGroupDraftType = .none {
        didSet {
            if groupType != .business {
                companyId = ""
                departmentId = ""
                teamId = ""
                isManagerDraft = false
            }
            if groupType != .family {
                groupLabel = ""
            }
        }
    }
    @Published var groupLabel = ""
    @Published var companyId = "" {
        didSet {
            if oldValue != companyId {
                departmentId = ""
                teamId = ""
            }
        }
    }
    @Published var departmentId = "" {
        didSet {
            if oldValue != departmentId {
                teamId = ""
            }
            if departmentId.isEmpty {
                isManagerDraft = false
            }
        }
    }
    @Published var teamId = ""

    @Published var isCreating = false
    @Published var progressMessage = ""
    @Published var completionOutcome: AgentCreationOutcome = .none
    @Published var createdAgentName = ""
    @Published var createdAgentId: String?
    @Published var provisioningJobId: String?

    var activeName: String {
        runtimeType == .openClaw ? openClawAgentName : runtimeAgentName
    }

    var activeRole: String {
        runtimeType == .openClaw ? openClawRole : runtimeRole
    }

    var activeIdentifier: String {
        runtimeType == .openClaw ? openClawSlug : runtimeExternalId
    }

    var canAdvance: Bool {
        switch currentStep {
        case .setup:
            return true
        case .details:
            return canSubmit
        case .placement:
            return true
        case .review:
            return !isCreating && canSubmit
        }
    }

    var canSubmit: Bool {
        if runtimeType == .openClaw {
            return !trim(openClawAgentName).isEmpty &&
                !trim(openClawSlug).isEmpty
        }

        guard !trim(runtimeAgentName).isEmpty,
              !trim(runtimeExternalId).isEmpty else {
            return false
        }
        if runtimeType == .claudeCode {
            return !trim(runtimeRepoKey).isEmpty
        }
        return true
    }

    var managerDepartmentId: String? {
        guard isManagerDraft, groupType == .business, !departmentId.isEmpty else { return nil }
        return departmentId
    }

    func advance() {
        let steps = HiringStep.allCases
        guard let idx = steps.firstIndex(of: currentStep), idx < steps.count - 1 else { return }
        withAnimation(.spring(response: 0.3)) {
            currentStep = steps[idx + 1]
        }
    }

    func goBack() {
        let steps = HiringStep.allCases
        guard let idx = steps.firstIndex(of: currentStep), idx > 0 else { return }
        withAnimation(.spring(response: 0.3)) {
            currentStep = steps[idx - 1]
        }
    }

    func setRuntimeType(_ value: AgentRuntimeType) {
        runtimeType = value
        runtimeModel = testedModelOptions(for: value)?.defaultModel
            ?? Self.defaultRuntimeAgentModel(value)
    }

    func loadModelCatalog(workspaceId: String) async {
        do {
            let catalog: HarnessModelCatalog = try await APIClient.shared.request(
                .agentModelOptions(workspaceId: workspaceId)
            )
            modelCatalog = catalog
            modelCatalogError = nil
            if let options = testedModelOptions(for: runtimeType),
               !options.models.contains(runtimeModel) {
                runtimeModel = options.defaultModel
            }
        } catch {
            modelCatalogError = error.localizedDescription
        }
    }

    func testedModelOptions(for runtimeType: AgentRuntimeType) -> HarnessModelOptions? {
        let key = runtimeType == .openClaw ? "openclaw" : runtimeType.rawValue
        return modelCatalog?.harnesses[key]
    }

    func setRuntimeExternalId(_ value: String) {
        runtimeExternalIdTouched = true
        runtimeExternalId = Self.slugifyOpenClawId(value)
    }

    func setOpenClawSlug(_ value: String) {
        openClawSlugTouched = true
        openClawSlug = Self.slugifyOpenClawId(value)
    }

    func reset() {
        runtimeType = .openClaw
        avatarUrl = nil
        customAvatarUrl = nil
        isManagerDraft = false
        runtimeAgentName = ""
        runtimeExternalId = ""
        runtimeExternalIdTouched = false
        runtimeRole = ""
        runtimeRepoKey = ""
        runtimeWorkspaceRoot = ""
        runtimeModel = testedModelOptions(for: .openClaw)?.defaultModel
            ?? Self.defaultRuntimeAgentModel(.openClaw)
        openClawAgentName = ""
        openClawSlug = ""
        openClawSlugTouched = false
        openClawRole = ""
        files = []
        groupType = .none
        groupLabel = ""
        companyId = ""
        departmentId = ""
        teamId = ""
        completionOutcome = .none
        createdAgentName = ""
        createdAgentId = nil
        provisioningJobId = nil
        progressMessage = ""
        currentStep = .setup
    }

    func createAgent(workspaceId: String, appStore: AppStore) async {
        guard !workspaceId.isEmpty else {
            progressMessage = "Select a workspace first"
            return
        }
        guard canSubmit else { return }

        isCreating = true
        progressMessage = runtimeType == .openClaw ? "Provisioning..." : "Creating..."
        defer { isCreating = false }

        do {
            if runtimeType == .openClaw {
                let job: AgentProvisioningJob = try await APIClient.shared.request(
                    .provisionAgent(params: openClawPayload(workspaceId: workspaceId))
                )
                provisioningJobId = job.id
                let provisionedAgentId = try await waitForProvisionedAgent(
                    jobId: job.id,
                    maxAttempts: managerDepartmentId == nil ? 4 : 20
                )
                if let provisionedAgentId {
                    createdAgentId = provisionedAgentId
                    if let departmentId = managerDepartmentId {
                        try await assignManager(agentId: provisionedAgentId, departmentId: departmentId)
                    }
                    completionOutcome = .provisioned
                    progressMessage = "Provisioning completed"
                } else {
                    completionOutcome = .provisioningPending
                    progressMessage = "Provisioning started"
                }
                createdAgentName = trim(openClawAgentName)
            } else {
                let agent: Agent = try await APIClient.shared.request(
                    .createAgentPayload(params: runtimePayload(workspaceId: workspaceId))
                )
                if let departmentId = managerDepartmentId {
                    try await assignManager(agentId: agent.id, departmentId: departmentId)
                }
                appStore.upsertAgent(agent)
                createdAgentName = agent.name
                createdAgentId = agent.id
                completionOutcome = .created
                progressMessage = "Agent created"
            }

            try? await appStore.syncAgents(workspaceId: workspaceId)
            try? await appStore.syncDepartments(workspaceId: workspaceId)
            try? await appStore.syncTeams(workspaceId: workspaceId)
            try? await appStore.syncThreads(workspaceId: workspaceId)
        } catch {
            progressMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
            completionOutcome = .failed
            Telemetry.shared.capture(error: error, attributes: ["operation": "agent.create", "runtimeType": runtimeType.rawValue])
        }
    }

    func refreshProvisioningStatus(workspaceId: String, appStore: AppStore) async {
        guard let provisioningJobId else { return }
        isCreating = true
        defer { isCreating = false }
        do {
            let job: AgentProvisioningJob = try await APIClient.shared.request(.agentProvisionJob(id: provisioningJobId))
            if let createdAgentId = job.createdAgentId, !createdAgentId.isEmpty {
                self.createdAgentId = createdAgentId
                completionOutcome = .provisioned
                progressMessage = "Provisioning completed"
                try? await appStore.syncAgents(workspaceId: workspaceId)
                try? await appStore.syncThreads(workspaceId: workspaceId)
            } else if job.status == "failed" {
                completionOutcome = .failed
                progressMessage = job.error ?? job.message ?? "OpenClaw provisioning failed."
            } else {
                completionOutcome = .provisioningPending
                progressMessage = "Provisioning is still pending"
            }
        } catch {
            progressMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    private func runtimePayload(workspaceId: String) -> [String: Any] {
        let runtimeSource = runtimeType == .claudeCode ? "claude_code" : "hermes"
        let modelPrimary = trim(runtimeModel)
        var payload: [String: Any] = [
            "name": trim(runtimeAgentName),
            "role": trim(runtimeRole),
            "workspaceId": workspaceId,
            "source": runtimeSource,
            "externalId": trim(runtimeExternalId),
            "capabilities": runtimeType == .claudeCode ? ["claude_code", "repo:\(trim(runtimeRepoKey))"] : ["hermes"],
            "timezone": "UTC",
            "runtimeBinding": runtimeBinding(runtimeSource: runtimeSource, modelPrimary: modelPrimary)
        ]
        if let avatarUrl { payload["avatarUrl"] = avatarUrl }
        if !modelPrimary.isEmpty { payload["modelPrimary"] = modelPrimary }
        payload.merge(groupPayload()) { _, new in new }
        return payload
    }

    private func runtimeBinding(runtimeSource: String, modelPrimary: String) -> [String: Any] {
        if runtimeType == .claudeCode {
            return [
                "runtimeType": runtimeSource,
                "adapterKind": "bridge_ws",
                "routingMode": "explicit_only",
                "repoKey": trim(runtimeRepoKey),
                "isEnabled": true,
                "configMetadata": ["model": modelPrimary.isEmpty ? NSNull() : modelPrimary as Any]
            ]
        }
        return [
            "runtimeType": runtimeSource,
            "adapterKind": "hermes_bridge",
            "routingMode": "default_target",
            "repoKey": trim(runtimeWorkspaceRoot).isEmpty ? NSNull() : trim(runtimeWorkspaceRoot),
            "isEnabled": true,
            "capabilities": ["bridgeBacked": true],
            "configMetadata": ["model": modelPrimary.isEmpty ? NSNull() : modelPrimary as Any]
        ]
    }

    private func openClawPayload(workspaceId: String) -> [String: Any] {
        var payload: [String: Any] = [
            "name": trim(openClawAgentName),
            "workspaceId": workspaceId,
            "role": trim(openClawRole),
            "slug": trim(openClawSlug),
            "files": files.map(\.payload),
            "modelPrimary": testedModelOptions(for: .openClaw)?.models.contains(trim(runtimeModel)) == true
                ? trim(runtimeModel)
                : (testedModelOptions(for: .openClaw)?.defaultModel ?? "gpt-5.5")
        ]
        if let avatarUrl { payload["avatarUrl"] = avatarUrl }
        payload.merge(groupPayload()) { _, new in new }
        return payload
    }

    private func groupPayload() -> [String: Any] {
        switch groupType {
        case .none:
            return [
                "groupType": NSNull(),
                "groupLabel": NSNull(),
                "companyId": NSNull(),
                "departmentId": NSNull(),
                "teamId": NSNull()
            ]
        case .family:
            return [
                "groupType": "family",
                "groupLabel": trim(groupLabel).isEmpty ? NSNull() : trim(groupLabel),
                "companyId": NSNull(),
                "departmentId": NSNull(),
                "teamId": NSNull()
            ]
        case .business:
            return [
                "groupType": "business",
                "groupLabel": NSNull(),
                "companyId": companyId.isEmpty ? NSNull() : companyId,
                "departmentId": departmentId.isEmpty ? NSNull() : departmentId,
                "teamId": teamId.isEmpty ? NSNull() : teamId
            ]
        case .personal:
            return [
                "groupType": "personal",
                "groupLabel": NSNull(),
                "companyId": NSNull(),
                "departmentId": NSNull(),
                "teamId": NSNull()
            ]
        }
    }

    private func waitForProvisionedAgent(jobId: String, maxAttempts: Int) async throws -> String? {
        for _ in 0..<maxAttempts {
            let job: AgentProvisioningJob = try await APIClient.shared.request(.agentProvisionJob(id: jobId))
            if let createdAgentId = job.createdAgentId, !createdAgentId.isEmpty {
                return createdAgentId
            }
            let status = job.status.lowercased()
            if status.contains("fail") || status.contains("error") || status.contains("cancel") {
                throw APIError.serverError(statusCode: 500, message: job.error ?? job.message ?? "Provisioning failed")
            }
            try await _Concurrency.Task.sleep(nanoseconds: 1_500_000_000)
        }
        return nil
    }

    private func assignManager(agentId: String, departmentId: String) async throws {
        let _: Department = try await APIClient.shared.request(
            .updateDepartment(id: departmentId, params: ["headAgentId": agentId])
        )
    }

    static func defaultRuntimeAgentModel(_ runtimeType: AgentRuntimeType) -> String {
        switch runtimeType {
        case .claudeCode: return "sonnet"
        case .hermes, .openClaw, .unknown: return "gpt-5.5"
        }
    }

    static func slugifyOpenClawId(_ value: String) -> String {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        var result = ""
        var previousWasUnderscore = false
        for scalar in trimmed.unicodeScalars {
            let isAllowed = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyz0123456789_-").contains(scalar)
            if isAllowed {
                result.unicodeScalars.append(scalar)
                previousWasUnderscore = false
            } else if !previousWasUnderscore {
                result.append("_")
                previousWasUnderscore = true
            }
            if result.count >= 80 { break }
        }
        return result.trimmingCharacters(in: CharacterSet(charactersIn: "_"))
    }

    private func trim(_ value: String) -> String {
        value.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

struct HiringFlowView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppCoordinator.self) private var coordinator
    @EnvironmentObject private var appStore: AppStore
    @StateObject private var state = HiringFlowState()
    @State private var showAvatarImporter = false
    @State private var showMarkdownImporter = false
    @State private var showReplaceManagerAlert = false

    private var availableDepartments: [Department] {
        state.companyId.isEmpty ? appStore.departments : appStore.departments.filter { $0.companyId == state.companyId }
    }

    private var availableTeams: [Team] {
        state.departmentId.isEmpty ? [] : appStore.teams.filter { $0.departmentId == state.departmentId }
    }

    private var existingManagerName: String? {
        guard let department = appStore.departments.first(where: { $0.id == state.departmentId }),
              let managerId = department.headAgentId,
              !managerId.isEmpty else { return nil }
        return appStore.agents.first(where: { $0.id == managerId })?.name ?? "the current manager"
    }

    private var managerDisabledReason: String? {
        if state.groupType != .business {
            return "Choose business placement and a department before setting a manager."
        }
        if state.departmentId.isEmpty {
            return "Choose a department before setting a manager."
        }
        return nil
    }

    var body: some View {
        NavigationStack {
            ZStack {
                ClawColors.backgroundPrimary.ignoresSafeArea()
                VStack(spacing: 0) {
                    headerBar
                    Divider().background(ClawColors.separator)

                    TabView(selection: $state.currentStep) {
                        setupStep.tag(HiringStep.setup)
                        detailsStep.tag(HiringStep.details)
                    }
                    .tabViewStyle(.page(indexDisplayMode: .never))
                    .animation(.spring(response: 0.3), value: state.currentStep)

                    navigationButtons
                }
            }
            .navigationBarHidden(true)
        }
        .preferredColorScheme(.dark)
        .fileImporter(isPresented: $showAvatarImporter, allowedContentTypes: [.image], allowsMultipleSelection: false) { result in
            handleAvatarImport(result)
        }
        .fileImporter(isPresented: $showMarkdownImporter, allowedContentTypes: [.plainText, .text], allowsMultipleSelection: true) { result in
            handleMarkdownImport(result)
        }
        .alert("Replace department manager?", isPresented: $showReplaceManagerAlert) {
            Button("Cancel", role: .cancel) {}
            Button("Replace") {
                _Concurrency.Task {
                    await state.createAgent(workspaceId: appStore.selectedWorkspace?.id ?? "", appStore: appStore)
                }
            }
        } message: {
            Text("\(selectedDepartmentName) already has \(existingManagerName ?? "the current manager") set as manager. Replace them with the new agent?")
        }
        .task {
            guard let workspaceId = appStore.selectedWorkspace?.id else { return }
            try? await appStore.syncCompanies(workspaceId: workspaceId)
            try? await appStore.syncDepartments(workspaceId: workspaceId)
            try? await appStore.syncTeams(workspaceId: workspaceId)
            await state.loadModelCatalog(workspaceId: workspaceId)
        }
    }

    private var headerBar: some View {
        HStack {
            Button { dismiss() } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: 16, weight: .medium))
                    .foregroundStyle(ClawColors.textPrimary)
                    .frame(width: 36, height: 36)
            }
            Spacer()
            Text("Create Agent")
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(ClawColors.textPrimary)
            Spacer()
            Text("Step \(state.currentStep == .setup ? 1 : 2) of 2")
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(ClawColors.textSecondary)
                .frame(width: 68, alignment: .trailing)
        }
        .padding(.horizontal, ClawSpacing.lg)
        .padding(.vertical, ClawSpacing.md)
    }

    private var stepProgressBar: some View {
        HStack(spacing: ClawSpacing.sm) {
            ForEach(HiringStep.allCases, id: \.self) { step in
                VStack(spacing: 4) {
                    ZStack {
                        Circle()
                            .fill(stepCircleColor(step))
                            .frame(width: 28, height: 28)
                        if step.rawValue < state.currentStep.rawValue {
                            Image(systemName: "checkmark")
                                .font(.system(size: 11, weight: .bold))
                                .foregroundStyle(.white)
                        } else {
                            Text("\(step.rawValue)")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundStyle(step == state.currentStep ? .white : ClawColors.textTertiary)
                        }
                    }
                    Text(step.title)
                        .font(.system(size: 9, weight: .medium))
                        .foregroundStyle(step == state.currentStep ? ClawColors.accent : ClawColors.textTertiary)
                        .lineLimit(1)
                }
                .frame(maxWidth: .infinity)

                if step != .review {
                    Rectangle()
                        .fill(step.rawValue < state.currentStep.rawValue ? ClawColors.accent : ClawColors.separator)
                        .frame(height: 2)
                        .frame(maxWidth: 20)
                }
            }
        }
        .padding(.horizontal, ClawSpacing.lg)
        .padding(.vertical, ClawSpacing.md)
    }

    private func stepCircleColor(_ step: HiringStep) -> Color {
        if step == state.currentStep { return ClawColors.accent }
        if step.rawValue < state.currentStep.rawValue { return ClawColors.accent.opacity(0.6) }
        return ClawColors.backgroundSecondary
    }

    private var navigationButtons: some View {
        VStack(spacing: ClawSpacing.sm) {
            if state.currentStep == .setup {
                Button { state.currentStep = .details } label: {
                    Text("Continue")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, ClawSpacing.md)
                        .background(ClawColors.accent)
                        .cornerRadius(ClawRadius.md)
                }
                .buttonStyle(.plain)
            } else if state.completionOutcome == .none {
                createButton
            } else {
                Button("Done") { dismiss() }
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, ClawSpacing.md)
                    .background(ClawColors.accent)
                    .cornerRadius(ClawRadius.md)
            }
        }
        .padding(.horizontal, ClawSpacing.lg)
        .padding(.vertical, ClawSpacing.md)
        .background(ClawColors.backgroundPrimary)
    }

    private var setupStep: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: ClawSpacing.lg) {
                VStack(spacing: 8) {
                    ZStack {
                        Circle()
                            .stroke(ClawColors.accent.opacity(0.7), style: StrokeStyle(lineWidth: 1, dash: [5]))
                            .frame(width: 84, height: 84)
                        AvatarView(name: "Agent", imageUrl: state.avatarUrl, size: .large)
                    }
                    Text("Choose an avatar")
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(ClawColors.textPrimary)
                    Text("Pick a style and avatar that represents your agent.")
                        .font(.system(size: 12))
                        .foregroundStyle(ClawColors.textSecondary)
                }
                .frame(maxWidth: .infinity)
                AgentCreateAvatarPicker(
                    name: state.activeName.isEmpty ? "Agent" : state.activeName,
                    selection: $state.avatarUrl,
                    customSelection: state.customAvatarUrl,
                    onUpload: { showAvatarImporter = true }
                )
            }
            .padding(ClawSpacing.lg)
        }
    }

    private var detailsStep: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: ClawSpacing.lg) {
                HStack {
                    Spacer()
                    AvatarView(name: state.activeName.isEmpty ? "Agent" : state.activeName, imageUrl: state.avatarUrl, size: .xlarge)
                    Spacer()
                }

                fieldLabel("Runtime")
                Picker("Runtime", selection: Binding(
                    get: { state.runtimeType },
                    set: { state.setRuntimeType($0) }
                )) {
                    Text("OpenClaw").tag(AgentRuntimeType.openClaw)
                    Text("Hermes").tag(AgentRuntimeType.hermes)
                }
                .pickerStyle(.segmented)

                if state.runtimeType == .openClaw {
                    inputField(label: "Agent name", placeholder: "Cool Dude", text: $state.openClawAgentName)
                    inputField(label: "Role (optional)", placeholder: "Marketing specialist and creative partner", text: $state.openClawRole)
                    testedModelPicker(for: .openClaw)
                } else {
                    inputField(label: "Agent name", placeholder: "Cool Dude", text: $state.runtimeAgentName)
                    inputField(label: "Role (optional)", placeholder: "Marketing specialist and creative partner", text: $state.runtimeRole)
                    testedModelPicker(for: .hermes)
                }

                card {
                    fieldLabel("Placement")
                    Menu {
                        Button("None") { state.groupType = .none }
                        Button("Business") { state.groupType = .business }
                        Button("Family") { state.groupType = .family }
                        Button("Personal") { state.groupType = .personal }
                    } label: {
                        menuLabel(state.groupType.rawValue.capitalized)
                    }
                }

                if state.groupType == .business {
                    pickerCard(label: "Organization", value: selectedCompanyName, emptyLabel: "Select organization") {
                        Button("No organization") { state.companyId = "" }
                        ForEach(appStore.companies) { company in
                            Button(company.name) { state.companyId = company.id }
                        }
                    }
                    if !state.companyId.isEmpty {
                        pickerCard(label: "Department (optional)", value: selectedDepartmentName, emptyLabel: "No department") {
                            Button("No department") { state.departmentId = "" }
                            ForEach(availableDepartments) { department in
                                Button(department.name) { state.departmentId = department.id }
                            }
                        }
                    }
                    if !state.departmentId.isEmpty {
                        pickerCard(label: "Team (optional)", value: selectedTeamName, emptyLabel: "No team") {
                            Button("No team") { state.teamId = "" }
                            ForEach(availableTeams) { team in
                                Button(team.name) { state.teamId = team.id }
                            }
                        }
                    }
                } else if state.groupType == .family {
                    inputField(label: "Family label (optional)", placeholder: "Family", text: $state.groupLabel)
                }

                if state.completionOutcome != .none {
                    creationCompletionView
                        .frame(minHeight: 260)
                }
            }
            .padding(ClawSpacing.lg)
        }
    }

    private var runtimeDetails: some View {
        VStack(alignment: .leading, spacing: ClawSpacing.lg) {
            inputField(label: "Agent name", placeholder: runtimeNamePlaceholder, text: $state.runtimeAgentName)
            inputField(label: "External id", placeholder: runtimeExternalIdPlaceholder, text: Binding(
                get: { state.runtimeExternalId },
                set: { state.setRuntimeExternalId($0) }
            ))
            inputField(label: "Role", placeholder: runtimeRolePlaceholder, text: $state.runtimeRole)
            if state.runtimeType == .claudeCode {
                inputField(label: "Repo key", placeholder: "relay-console-web", text: $state.runtimeRepoKey)
                inputField(label: "Claude model", placeholder: "sonnet", text: $state.runtimeModel)
            } else {
                inputField(label: "Repository key", placeholder: "relay-console", text: $state.runtimeWorkspaceRoot)
                testedModelPicker(for: .hermes)
            }
        }
    }

    @ViewBuilder
    private func testedModelPicker(for runtimeType: AgentRuntimeType) -> some View {
        card {
            fieldLabel("Model")
            if let options = state.testedModelOptions(for: runtimeType) {
                Picker("Relay-tested model", selection: $state.runtimeModel) {
                    ForEach(options.models, id: \.self) { model in
                        Text(model == options.defaultModel ? "\(model) — tested default" : model)
                            .tag(model)
                    }
                }
                .pickerStyle(.menu)
                .accessibilityHint("Only models tested for the selected harness release are listed")

                Text("OpenAI controls authentication, plan, rollout, and model eligibility. If a saved model is retired or unsupported, Relay applies this runtime's tested default.")
                    .font(.system(size: 12))
                    .foregroundStyle(ClawColors.textSecondary)
            } else if let error = state.modelCatalogError {
                Text("Model catalog unavailable: \(error)")
                    .font(.system(size: 12))
                    .foregroundStyle(ClawColors.accentRed)
                Text("The tested default will be applied; authentication status is confirmed during provisioning.")
                    .font(.system(size: 12))
                    .foregroundStyle(ClawColors.textSecondary)
            } else {
                HStack(spacing: 8) {
                    ProgressView().controlSize(.small)
                    Text("Loading Relay-tested models…")
                        .font(.system(size: 13))
                        .foregroundStyle(ClawColors.textSecondary)
                }
            }
        }
    }

    private var openClawDetails: some View {
        VStack(alignment: .leading, spacing: ClawSpacing.lg) {
            inputField(label: "Agent name", placeholder: "", text: $state.openClawAgentName)
            inputField(label: "OpenClaw id", placeholder: "", text: Binding(
                get: { state.openClawSlug },
                set: { state.setOpenClawSlug($0) }
            ))
            inputField(label: "Role", placeholder: "", text: $state.openClawRole)
            testedModelPicker(for: .openClaw)

            card {
                fieldLabel("Runtime bridge")
                Text("Relay sends this request through the authenticated outbound bridge paired with this workspace. Start the user-installed OpenClaw runtime and bridge before creating the agent.")
                    .font(.system(size: 13))
                    .foregroundStyle(ClawColors.textSecondary)
            }

            markdownImportCard
        }
    }

    private var placementStep: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: ClawSpacing.xl) {
                stepTitle("Placement", subtitle: "Choose where this agent belongs.")

                card {
                    fieldLabel("Placement")
                    Menu {
                        ForEach(AgentGroupDraftType.allCases, id: \.self) { type in
                            Button(type.rawValue) { state.groupType = type }
                        }
                    } label: {
                        menuLabel(state.groupType.rawValue)
                    }
                }

                if state.groupType == .family {
                    inputField(label: "Family label", placeholder: "Family", text: $state.groupLabel)
                }

                if state.groupType == .business {
                    businessPlacementFields
                    managerCard
                }
            }
            .padding(ClawSpacing.lg)
        }
    }

    private var businessPlacementFields: some View {
        VStack(alignment: .leading, spacing: ClawSpacing.lg) {
            pickerCard(label: "Company", value: selectedCompanyName, emptyLabel: "No company") {
                Button("No company") { state.companyId = "" }
                ForEach(appStore.companies) { company in
                    Button(company.name) { state.companyId = company.id }
                }
            }
            pickerCard(label: "Department", value: selectedDepartmentName, emptyLabel: "No department") {
                Button("No department") { state.departmentId = "" }
                ForEach(availableDepartments) { department in
                    Button(department.name) { state.departmentId = department.id }
                }
            }
            pickerCard(label: "Team", value: selectedTeamName, emptyLabel: "No team") {
                Button("No team") { state.teamId = "" }
                ForEach(availableTeams) { team in
                    Button(team.name) { state.teamId = team.id }
                }
            }
        }
    }

    private var managerCard: some View {
        card {
            Toggle(isOn: Binding(
                get: { state.isManagerDraft },
                set: { if managerDisabledReason == nil { state.isManagerDraft = $0 } }
            )) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Manager")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(ClawColors.textPrimary)
                    Text(managerDisabledReason ?? managerHelperText)
                        .font(.system(size: 12))
                        .foregroundStyle(ClawColors.textSecondary)
                }
            }
            .toggleStyle(SwitchToggleStyle(tint: ClawColors.accent))
            .disabled(managerDisabledReason != nil)
        }
    }

    private var markdownImportCard: some View {
        card {
            HStack(alignment: .top, spacing: ClawSpacing.md) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Markdown import")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(ClawColors.textPrimary)
                    Text("Import one or more .md files in bulk. Uploaded files replace matching defaults and add any extra markdown files by name.")
                        .font(.system(size: 12))
                        .foregroundStyle(ClawColors.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer()
                Button("Import") { showMarkdownImporter = true }
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(ClawColors.accent)
            }

            if state.files.isEmpty {
                Text("No markdown files imported. The backend will use default workspace markdown files.")
                    .font(.system(size: 13))
                    .foregroundStyle(ClawColors.textSecondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(ClawSpacing.md)
                    .overlay(
                        RoundedRectangle(cornerRadius: ClawRadius.md)
                            .stroke(ClawColors.separator, style: StrokeStyle(lineWidth: 1, dash: [5]))
                    )
            } else {
                VStack(spacing: ClawSpacing.sm) {
                    ForEach(state.files) { file in
                        HStack {
                            VStack(alignment: .leading, spacing: 3) {
                                Text(file.filename)
                                    .font(.system(size: 14, weight: .medium))
                                    .foregroundStyle(ClawColors.textPrimary)
                                Text(file.isDefault ? "Will replace default workspace file" : "Additional markdown file")
                                    .font(.system(size: 12))
                                    .foregroundStyle(ClawColors.textSecondary)
                            }
                            Spacer()
                            Text("\(Double(file.content.utf8.count) / 1024, specifier: "%.1f") KB")
                                .font(.system(size: 12))
                                .foregroundStyle(ClawColors.textTertiary)
                            Button {
                                state.files.removeAll { $0.id == file.id }
                            } label: {
                                Image(systemName: "xmark.circle.fill")
                                    .foregroundStyle(ClawColors.textTertiary)
                            }
                        }
                        .padding(ClawSpacing.md)
                        .background(ClawColors.backgroundTertiary)
                        .cornerRadius(ClawRadius.sm)
                    }
                }
            }
        }
    }

    private var reviewStep: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: ClawSpacing.xl) {
                if state.completionOutcome != .none {
                    creationCompletionView
                } else {
                    stepTitle("Review & Create", subtitle: "Confirm your agent configuration")
                    reviewSummary
                    createButton
                }
            }
            .padding(ClawSpacing.lg)
        }
    }

    private var reviewSummary: some View {
        VStack(spacing: ClawSpacing.md) {
            reviewSummarySection(title: "Agent") {
                HStack(spacing: ClawSpacing.md) {
                    AvatarView(name: state.activeName.isEmpty ? "Agent" : state.activeName, imageUrl: state.avatarUrl, size: .medium)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(state.activeName.isEmpty ? "—" : state.activeName)
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(ClawColors.textPrimary)
                        Text(runtimeLabel(state.runtimeType))
                            .font(.system(size: 13))
                            .foregroundStyle(ClawColors.textSecondary)
                    }
                    Spacer()
                }
                .padding(.horizontal, ClawSpacing.md)
                .padding(.vertical, ClawSpacing.sm)
                reviewRow(label: state.runtimeType == .openClaw ? "OpenClaw id" : "External id", value: state.activeIdentifier.isEmpty ? "—" : state.activeIdentifier)
                reviewRow(label: "Role", value: state.activeRole.isEmpty ? "—" : state.activeRole)
                if state.runtimeType == .claudeCode {
                    reviewRow(label: "Repo key", value: state.runtimeRepoKey.isEmpty ? "repo_key" : state.runtimeRepoKey)
                    reviewRow(label: "Claude model", value: state.runtimeModel.isEmpty ? "sonnet" : state.runtimeModel)
                }
                if state.runtimeType == .hermes {
                    reviewRow(label: "Repository key", value: state.runtimeWorkspaceRoot.isEmpty ? "not set" : state.runtimeWorkspaceRoot)
                    if !state.runtimeModel.isEmpty { reviewRow(label: "Hermes model", value: state.runtimeModel) }
                }
                if state.runtimeType == .openClaw {
                    reviewRow(label: "OpenClaw model", value: state.runtimeModel)
                    reviewRow(label: "Runtime bridge", value: "Paired workspace bridge required")
                    reviewRow(label: "Markdown files", value: state.files.isEmpty ? "Default workspace markdown files" : "\(state.files.count)")
                }
            }
            reviewSummarySection(title: "Placement") {
                reviewRow(label: "Placement", value: state.groupType.rawValue)
                if state.groupType == .family {
                    reviewRow(label: "Family label", value: state.groupLabel.isEmpty ? "Family" : state.groupLabel)
                }
                if state.groupType == .business {
                    reviewRow(label: "Company", value: selectedCompanyName)
                    reviewRow(label: "Department", value: selectedDepartmentName)
                    reviewRow(label: "Team", value: selectedTeamName)
                    reviewRow(label: "Manager", value: state.isManagerDraft ? "Yes" : "No")
                }
            }
            footerSummary
        }
    }

    private var footerSummary: some View {
        let text: String = {
            if state.runtimeType == .openClaw {
                return "The agent will be provisioned as \(state.openClawSlug.isEmpty ? "agent_id" : state.openClawSlug) and its markdown files will be written into its OpenClaw workspace."
            }
            if state.runtimeType == .claudeCode {
                return "This creates a persistent Relay Console agent with source=claude_code and repo binding \(state.runtimeRepoKey.isEmpty ? "repo_key" : state.runtimeRepoKey)."
            }
            return "This creates a persistent Relay Console agent with source=hermes and repository key \(state.runtimeWorkspaceRoot.isEmpty ? "not set" : state.runtimeWorkspaceRoot)."
        }()
        return Text(text)
            .font(.system(size: 12))
            .foregroundStyle(ClawColors.textSecondary)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(ClawSpacing.md)
            .background(ClawColors.backgroundSecondary)
            .cornerRadius(ClawRadius.md)
    }

    private var createButton: some View {
        VStack(spacing: ClawSpacing.md) {
            if !state.progressMessage.isEmpty {
                Text(state.progressMessage)
                    .font(.system(size: 14))
                    .foregroundStyle(state.isCreating ? ClawColors.textSecondary : ClawColors.accent)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(ClawSpacing.md)
                    .background(ClawColors.backgroundSecondary)
                    .cornerRadius(ClawRadius.md)
            }
            Button {
                if state.isManagerDraft && existingManagerName != nil {
                    showReplaceManagerAlert = true
                } else {
                    _Concurrency.Task {
                        await state.createAgent(workspaceId: appStore.selectedWorkspace?.id ?? "", appStore: appStore)
                    }
                }
            } label: {
                HStack(spacing: ClawSpacing.sm) {
                    if state.isCreating {
                        ProgressView().tint(.white).scaleEffect(0.8)
                        Text(state.runtimeType == .openClaw ? "Provisioning..." : "Creating...")
                    } else {
                        Image(systemName: "sparkles")
                        Text(createButtonTitle)
                    }
                }
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, ClawSpacing.md)
                .background(state.canSubmit && !state.isCreating ? ClawColors.accent : ClawColors.backgroundTertiary)
                .cornerRadius(ClawRadius.md)
            }
            .buttonStyle(.plain)
            .disabled(state.isCreating || !state.canSubmit)
        }
    }

    private var creationCompletionView: some View {
        VStack(spacing: ClawSpacing.xxl) {
            Spacer()
            ZStack {
                Circle()
                    .fill(completionAccentColor.opacity(0.15))
                    .frame(width: 100, height: 100)
                Image(systemName: completionIcon)
                    .font(.system(size: 60))
                    .foregroundStyle(completionAccentColor)
            }
            VStack(spacing: ClawSpacing.sm) {
                Text(completionTitle)
                    .font(.system(size: 24, weight: .bold))
                    .foregroundStyle(ClawColors.textPrimary)
                    .multilineTextAlignment(.center)
                Text(completionSubtitle)
                    .font(.system(size: 15))
                    .foregroundStyle(ClawColors.textSecondary)
                    .multilineTextAlignment(.center)
            }

            VStack(spacing: ClawSpacing.sm) {
                if state.completionOutcome == .provisioningPending {
                    Button {
                        _Concurrency.Task {
                            await state.refreshProvisioningStatus(workspaceId: appStore.selectedWorkspace?.id ?? "", appStore: appStore)
                        }
                    } label: {
                        if state.isCreating {
                            HStack {
                                ProgressView().tint(.white).scaleEffect(0.8)
                                completionButtonLabel("Checking Status...", filled: true)
                            }
                        } else {
                            completionButtonLabel("Refresh Status", filled: true)
                        }
                    }
                    .buttonStyle(.plain)
                }

                if let agentId = state.createdAgentId, state.completionOutcome != .failed {
                    Button {
                        dismiss()
                        coordinator.navigate(to: .agentDetail(agentId))
                    } label: {
                        completionButtonLabel("View Created Agent", filled: true)
                    }
                    .buttonStyle(.plain)
                }

                if state.completionOutcome != .failed {
                    Button {
                        dismiss()
                    } label: {
                        completionButtonLabel("View Agents", filled: state.createdAgentId == nil)
                    }
                    .buttonStyle(.plain)
                }

                Button {
                    if state.completionOutcome == .failed {
                        state.completionOutcome = .none
                    } else {
                        dismiss()
                    }
                } label: {
                    completionButtonLabel(state.completionOutcome == .failed ? "Back to Review" : "Done", filled: false)
                }
                .buttonStyle(.plain)
            }
            Spacer()
        }
        .frame(maxWidth: .infinity)
    }

    private var completionIcon: String {
        switch state.completionOutcome {
        case .created, .provisioned: return "checkmark.circle.fill"
        case .provisioningPending: return "clock.badge.checkmark.fill"
        case .failed: return "exclamationmark.triangle.fill"
        case .none: return "circle"
        }
    }

    private var completionAccentColor: Color {
        switch state.completionOutcome {
        case .created, .provisioned: return ClawColors.accentGreen
        case .provisioningPending: return ClawColors.accentOrange
        case .failed: return ClawColors.accentRed
        case .none: return ClawColors.accent
        }
    }

    private var completionTitle: String {
        let name = state.createdAgentName.isEmpty ? state.activeName : state.createdAgentName
        switch state.completionOutcome {
        case .created: return "\(name) was created"
        case .provisioned: return "\(name) is ready"
        case .provisioningPending: return "\(name) is provisioning"
        case .failed: return "Agent creation failed"
        case .none: return ""
        }
    }

    private var completionSubtitle: String {
        switch state.completionOutcome {
        case .created:
            return "The agent has been created and the agent list has been refreshed."
        case .provisioned:
            return "OpenClaw provisioning completed and the agent list has been refreshed."
        case .provisioningPending:
            return "OpenClaw accepted the provisioning request. The agent may take a little longer to appear while the bridge finishes setup."
        case .failed:
            return state.progressMessage.isEmpty ? "Check the details and try again." : state.progressMessage
        case .none:
            return ""
        }
    }

    private func completionButtonLabel(_ title: String, filled: Bool) -> some View {
        Text(title)
            .font(.system(size: 16, weight: .semibold))
            .foregroundStyle(filled ? .white : ClawColors.accent)
            .frame(maxWidth: .infinity)
            .padding(.vertical, ClawSpacing.md)
            .background(filled ? ClawColors.accent : ClawColors.backgroundSecondary)
            .cornerRadius(ClawRadius.md)
    }

    private var runtimeNamePlaceholder: String {
        state.runtimeType == .claudeCode ? "Claude / relay-console-web" : "Hermes / repo reviewer"
    }

    private var runtimeExternalIdPlaceholder: String {
        state.runtimeType == .claudeCode ? "claude_web" : "hermes_reviewer"
    }

    private var runtimeRolePlaceholder: String {
        state.runtimeType == .claudeCode ? "Repository coding agent for the web app" : "Repository review and execution agent"
    }

    private var createButtonTitle: String {
        switch state.runtimeType {
        case .openClaw: return "Create OpenClaw Agent"
        case .claudeCode: return "Create Claude Code agent"
        case .hermes: return "Create Hermes agent"
        case .unknown: return "Create Agent"
        }
    }

    private var managerHelperText: String {
        if let existingManagerName {
            return "This will replace \(existingManagerName) as the department manager after confirmation."
        }
        return "Set this new agent as the selected department manager."
    }

    private var selectedCompanyName: String {
        appStore.companies.first(where: { $0.id == state.companyId })?.name ?? "No company"
    }

    private var selectedDepartmentName: String {
        appStore.departments.first(where: { $0.id == state.departmentId })?.name ?? "No department"
    }

    private var selectedTeamName: String {
        appStore.teams.first(where: { $0.id == state.teamId })?.name ?? "No team"
    }

    private func runtimeLabel(_ rt: AgentRuntimeType) -> String {
        switch rt {
        case .claudeCode: return "Claude Code"
        case .hermes: return "Hermes"
        case .openClaw: return "OpenClaw"
        case .unknown: return "Unassigned"
        }
    }

    private func stepTitle(_ title: String, subtitle: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.system(size: 24, weight: .bold))
                .foregroundStyle(ClawColors.textPrimary)
            Text(subtitle)
                .font(.system(size: 15))
                .foregroundStyle(ClawColors.textSecondary)
        }
    }

    private func inputField(label: String, placeholder: String, text: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: ClawSpacing.sm) {
            fieldLabel(label)
            TextField(placeholder, text: text)
                .font(.system(size: 16))
                .foregroundStyle(ClawColors.textPrimary)
                .tint(ClawColors.accent)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .padding(ClawSpacing.md)
                .background(ClawColors.backgroundSecondary)
                .cornerRadius(ClawRadius.md)
        }
    }

    private func fieldLabel(_ label: String) -> some View {
        Text(label)
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(ClawColors.textSecondary)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func card<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: ClawSpacing.md, content: content)
            .padding(ClawSpacing.md)
            .background(ClawColors.backgroundSecondary)
            .cornerRadius(ClawRadius.md)
    }

    private func menuLabel(_ value: String) -> some View {
        HStack {
            Text(value)
                .font(.system(size: 15))
                .foregroundStyle(ClawColors.textPrimary)
                .lineLimit(1)
            Spacer()
            Image(systemName: "chevron.up.chevron.down")
                .font(.system(size: 11))
                .foregroundStyle(ClawColors.textTertiary)
        }
        .padding(ClawSpacing.md)
        .background(ClawColors.backgroundTertiary)
        .cornerRadius(ClawRadius.sm)
    }

    private func pickerCard<MenuContent: View>(
        label: String,
        value: String,
        emptyLabel: String,
        @ViewBuilder menuContent: () -> MenuContent
    ) -> some View {
        card {
            fieldLabel(label)
            Menu(content: menuContent) {
                menuLabel(value.isEmpty ? emptyLabel : value)
            }
        }
    }

    private func reviewSummarySection<Content: View>(title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(title)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(ClawColors.textTertiary)
                .padding(.horizontal, ClawSpacing.md)
                .padding(.vertical, ClawSpacing.sm)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(ClawColors.backgroundTertiary)
            content()
        }
        .background(ClawColors.backgroundSecondary)
        .cornerRadius(ClawRadius.md)
        .clipped()
    }

    private func reviewRow(label: String, value: String) -> some View {
        HStack {
            Text(label)
                .font(.system(size: 14))
                .foregroundStyle(ClawColors.textSecondary)
            Spacer()
            Text(value)
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(ClawColors.textPrimary)
                .lineLimit(1)
        }
        .padding(.horizontal, ClawSpacing.md)
        .padding(.vertical, ClawSpacing.sm)
    }

    private func handleAvatarImport(_ result: Result<[URL], any Error>) {
        guard case .success(let urls) = result, let url = urls.first else { return }
        let shouldStop = url.startAccessingSecurityScopedResource()
        defer {
            if shouldStop { url.stopAccessingSecurityScopedResource() }
        }
        guard let data = try? Data(contentsOf: url) else { return }
        let ext = url.pathExtension.lowercased()
        let mime: String
        switch ext {
        case "jpg", "jpeg": mime = "image/jpeg"
        case "webp": mime = "image/webp"
        case "gif": mime = "image/gif"
        default: mime = "image/png"
        }
        let dataURL = "data:\(mime);base64,\(data.base64EncodedString())"
        state.customAvatarUrl = dataURL
        state.avatarUrl = dataURL
    }

    private func handleMarkdownImport(_ result: Result<[URL], any Error>) {
        guard case .success(let urls) = result else { return }
        for url in urls {
            let shouldStop = url.startAccessingSecurityScopedResource()
            defer {
                if shouldStop { url.stopAccessingSecurityScopedResource() }
            }
            let filename = url.lastPathComponent
            guard filename.lowercased().hasSuffix(".md"),
                  let content = try? String(contentsOf: url, encoding: .utf8) else { continue }
            let defaultNames = ["README.md", "AGENTS.md", "CLAUDE.md", "TOOLS.md", "MEMORY.md", "HEARTBEAT.md"].map { $0.uppercased() }
            let draft = ProvisionFileDraft(
                filename: filename,
                content: content,
                isDefault: defaultNames.contains(filename.uppercased())
            )
            state.files.removeAll { $0.filename == filename }
            state.files.append(draft)
        }
    }
}

private struct AgentCreateAvatarPicker: View {
    let name: String
    @Binding var selection: String?
    let customSelection: String?
    let onUpload: () -> Void
    @State private var category: AgentAvatarCategory = .illustrated

    private var avatars: [String] {
        BuiltInAgentAvatarLibrary.avatars(for: category)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: ClawSpacing.md) {
            HStack(spacing: ClawSpacing.md) {
                AvatarView(name: name, imageUrl: selection, size: .large)
                VStack(alignment: .leading, spacing: 4) {
                    Text("Avatar")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(ClawColors.textPrimary)
                    Text(customSelection != nil && selection == customSelection ? "Custom avatar selected." : "Choose a built-in avatar, upload one, or leave it empty.")
                        .font(.system(size: 12))
                        .foregroundStyle(ClawColors.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer()
            }

            HStack(spacing: ClawSpacing.sm) {
                Button {
                    onUpload()
                } label: {
                    Label("Upload", systemImage: "square.and.arrow.up")
                }
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(ClawColors.accent)

                Button {
                    selection = nil
                } label: {
                    Label("No avatar", systemImage: "xmark")
                }
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(ClawColors.accent)
                .disabled(selection == nil)
            }

            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 6), count: 3), spacing: 6) {
                ForEach(AgentAvatarCategory.allCases, id: \.self) { item in
                    Button { category = item } label: {
                        Text(item.rawValue)
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(category == item ? .white : ClawColors.textPrimary)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 7)
                            .background(category == item ? ClawColors.accent.opacity(0.55) : ClawColors.backgroundTertiary)
                            .clipShape(RoundedRectangle(cornerRadius: 6))
                            .overlay(RoundedRectangle(cornerRadius: 6).stroke(category == item ? ClawColors.accent : ClawColors.separator))
                    }
                    .buttonStyle(.plain)
                }
            }

            if avatars.isEmpty {
                Text("No built-in avatars in this category yet.")
                    .font(.system(size: 13))
                    .foregroundStyle(ClawColors.textSecondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(ClawSpacing.md)
                    .overlay(
                        RoundedRectangle(cornerRadius: ClawRadius.md)
                            .stroke(ClawColors.separator, style: StrokeStyle(lineWidth: 1, dash: [5]))
                    )
            } else {
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
        }
        .padding(ClawSpacing.md)
        .background(ClawColors.backgroundSecondary)
        .cornerRadius(ClawRadius.md)
    }
}

#Preview {
    HiringFlowView()
        .environmentObject(AppStore())
}
