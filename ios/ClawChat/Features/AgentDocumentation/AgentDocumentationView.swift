// AgentDocumentationView.swift
// ClawChat – Agent documentation parity surface

import SwiftUI

@MainActor
@Observable
final class AgentDocumentationViewModel {
    var linkedApps: [LinkedApplication] = []
    var blueprints: [DocumentationBlueprint] = []
    var packs: [ApplicationDocumentationPack] = []
    var proposals: [DocumentationGenerationProposal] = []
    var installs: [AgentDocumentationInstall] = []
    var drift: [String: JSONValue] = [:]
    var selectedProposal: DocumentationGenerationProposal?
    var selectedBlueprint: DocumentationBlueprint?
    var isLoading = false
    var error: String?

    func load(workspaceId: String) async {
        isLoading = true
        defer { isLoading = false }
        do {
            async let apps: [LinkedApplication] = APIClient.shared.request(.agentDocumentationLinkedApps(workspaceId: workspaceId))
            async let bps: [DocumentationBlueprint] = APIClient.shared.request(.agentDocumentationBlueprints(workspaceId: workspaceId))
            async let docs: [ApplicationDocumentationPack] = APIClient.shared.request(.agentDocumentationPacks(workspaceId: workspaceId))
            async let props: [DocumentationGenerationProposal] = APIClient.shared.request(.agentDocumentationProposals(workspaceId: workspaceId))
            async let agentInstalls: [AgentDocumentationInstall] = APIClient.shared.request(.agentDocumentationInstalls(workspaceId: workspaceId))
            async let driftPayload: [String: JSONValue] = APIClient.shared.request(.agentDocumentationDrift(workspaceId: workspaceId))
            linkedApps = try await apps
            blueprints = try await bps
            packs = try await docs
            proposals = try await props
            installs = try await agentInstalls
            drift = try await driftPayload
            Telemetry.shared.breadcrumb("Loaded agent documentation", category: "agent_docs.load", attributes: ["workspaceId": workspaceId])
        } catch {
            self.error = error.localizedDescription
            Telemetry.shared.capture(error: error, attributes: ["operation": "agent_docs.load", "workspaceId": workspaceId])
        }
    }

    func createLinkedApp(workspaceId: String, name: String, repoPath: String) async {
        do {
            let app: LinkedApplication = try await APIClient.shared.request(.createAgentDocumentationLinkedApp(workspaceId: workspaceId, name: name, repoPath: repoPath, repoKey: nil, slug: nil))
            linkedApps.insert(app, at: 0)
            Telemetry.shared.event("agent_docs.linked_app.created", attributes: ["workspaceId": workspaceId, "linkedApplicationId": app.id])
        } catch {
            self.error = error.localizedDescription
            Telemetry.shared.capture(error: error, attributes: ["operation": "agent_docs.linked_app.create", "workspaceId": workspaceId])
        }
    }

    func scan(workspaceId: String, app: LinkedApplication) async {
        do {
            let updated: LinkedApplication = try await APIClient.shared.request(.scanAgentDocumentationLinkedApp(workspaceId: workspaceId, id: app.id))
            replace(updated, in: &linkedApps)
        } catch {
            self.error = error.localizedDescription
        }
    }

    func generateProposal(workspaceId: String, app: LinkedApplication, mode: String, blueprintIds: [String], packId: String?) async {
        do {
            let proposal: DocumentationGenerationProposal = try await APIClient.shared.request(.generateAgentDocumentationProposal(workspaceId: workspaceId, linkedApplicationId: app.id, mode: mode, blueprintIds: blueprintIds, packId: packId))
            proposals.insert(proposal, at: 0)
            selectedProposal = proposal
            Telemetry.shared.event("agent_docs.proposal.generated", attributes: ["workspaceId": workspaceId, "proposalId": proposal.id, "mode": mode])
        } catch {
            self.error = error.localizedDescription
            Telemetry.shared.capture(error: error, attributes: ["operation": "agent_docs.proposal.generate", "workspaceId": workspaceId, "mode": mode])
        }
    }

    func forkBlueprint(workspaceId: String, blueprint: DocumentationBlueprint) async {
        do {
            let forked: DocumentationBlueprint = try await APIClient.shared.request(
                .forkAgentDocumentationBlueprint(workspaceId: workspaceId, id: blueprint.id, name: nil)
            )
            blueprints.insert(forked, at: 0)
            selectedBlueprint = forked
            Telemetry.shared.event("agent_docs.blueprint.forked", attributes: ["workspaceId": workspaceId, "blueprintId": blueprint.id])
        } catch {
            self.error = error.localizedDescription
            Telemetry.shared.capture(error: error, attributes: ["operation": "agent_docs.blueprint.fork", "workspaceId": workspaceId, "blueprintId": blueprint.id])
        }
    }

    func loadProposal(workspaceId: String, id: String) async {
        do {
            selectedProposal = try await APIClient.shared.request(.agentDocumentationProposal(workspaceId: workspaceId, id: id))
        } catch {
            self.error = error.localizedDescription
        }
    }

    func applyProposal(workspaceId: String, proposal: DocumentationGenerationProposal) async {
        let ids = proposal.files?.map(\.id) ?? []
        do {
            let _: AgentDocumentationApplyResult = try await APIClient.shared.request(.applyAgentDocumentationProposal(workspaceId: workspaceId, id: proposal.id, fileIds: ids))
            await load(workspaceId: workspaceId)
        } catch {
            self.error = error.localizedDescription
        }
    }

    func syncPack(workspaceId: String, pack: ApplicationDocumentationPack, targetFolder: String?) async {
        do {
            let _: AgentDocumentationSyncResult = try await APIClient.shared.request(.syncAgentDocumentationPackToLibrary(workspaceId: workspaceId, id: pack.id, targetFolder: targetFolder))
            await load(workspaceId: workspaceId)
        } catch {
            self.error = error.localizedDescription
        }
    }

    func install(workspaceId: String, packId: String, agentId: String, role: String) async {
        do {
            let _: AgentDocumentationInstallResult = try await APIClient.shared.request(.installAgentDocumentation(workspaceId: workspaceId, packId: packId, agentId: agentId, role: role))
            await load(workspaceId: workspaceId)
        } catch {
            self.error = error.localizedDescription
        }
    }

    func exportState(workspaceId: String, packId: String?, agentId: String?) async {
        do {
            let _: [String: JSONValue] = try await APIClient.shared.request(.exportAgentDocumentationState(workspaceId: workspaceId, packId: packId, agentId: agentId, snapshotKind: "ios_manual", exportToLibrary: true))
            await load(workspaceId: workspaceId)
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func replace<T: Identifiable>(_ item: T, in array: inout [T]) where T.ID == String {
        if let index = array.firstIndex(where: { $0.id == item.id }) { array[index] = item }
    }
}

struct AgentDocumentationView: View {
    let workspaceId: String
    let agents: [Agent]

    @State private var vm = AgentDocumentationViewModel()
    @State private var appName = ""
    @State private var repoPath = ""
    @State private var selectedPackId = ""
    @State private var selectedAgentId = ""
    @State private var targetFolder = ""

    var body: some View {
        List {
            if let error = vm.error {
                Section { MissionErrorPanel(message: error) }
                    .listRowBackground(Color.clear)
            }
            overviewSection
            linkedAppsSection
            blueprintsSection
            packsSection
            proposalsSection
            installsSection
            driftSection
        }
        .scrollContentBackground(.hidden)
        .missionScreenBackground()
        .navigationTitle("Agent Documentation")
        .sheet(item: $vm.selectedBlueprint) { blueprint in
            BlueprintDetailSheet(
                blueprint: blueprint,
                onFork: {
                    _Concurrency.Task {
                        await vm.forkBlueprint(workspaceId: workspaceId, blueprint: blueprint)
                    }
                }
            )
        }
        .sheet(item: $vm.selectedProposal) { proposal in
            ProposalDetailSheet(
                proposal: proposal,
                errorText: proposalErrorText(proposal),
                onRetry: retryAction(for: proposal),
                onApply: {
                    _Concurrency.Task {
                        await vm.applyProposal(workspaceId: workspaceId, proposal: proposal)
                    }
                }
            )
        }
        .task { await vm.load(workspaceId: workspaceId) }
    }

    private var overviewSection: some View {
        Section {
            Text("Create and maintain agent documentation from linked application repositories. Generate proposals first, review the proposed files, then apply and install documentation packs for specific agents.")
                .font(.system(size: 13))
                .foregroundStyle(ClawColors.textPrimary.opacity(0.86))
        }
        .listRowBackground(ClawColors.backgroundCard)
    }

    private var linkedAppsSection: some View {
        Section("Linked Apps") {
            Text("Connect repositories that the OpenClaw bridge can scan for documentation sources.")
                .font(.system(size: 13))
                .foregroundStyle(ClawColors.textPrimary.opacity(0.86))

            if vm.linkedApps.isEmpty {
                emptyRow("No linked apps yet. Add a repository path to start generating documentation proposals.")
            }

            ForEach(vm.linkedApps) { app in
                VStack(alignment: .leading, spacing: 4) {
                    Text(app.name).font(.system(size: 15, weight: .semibold)).foregroundStyle(ClawColors.textPrimary)
                    Text(app.repoPath).font(.caption).foregroundStyle(ClawColors.textPrimary.opacity(0.76))
                    HStack {
                        MissionBadge(text: app.documentationPackStatus, color: app.dirtyState ? ClawColors.accentOrange : ClawColors.accentGreen)
                        MissionBadge(text: app.agentOperableStatus, color: ClawColors.accent)
                    }
                    if let latest = latestProposal(for: app) {
                        HStack {
                            Text("Latest proposal")
                                .font(.caption)
                                .foregroundStyle(ClawColors.textTertiary)
                            MissionBadge(text: latest.status, color: proposalStatusColor(latest.status))
                        }
                    }
                    HStack {
                        Button("Scan") { _Concurrency.Task { await vm.scan(workspaceId: workspaceId, app: app) } }
                            .buttonStyle(MissionButtonStyle(size: .xs, variant: .secondary))
                        Button(latestProposal(for: app)?.status == "failed" ? "Regenerate" : "Generate proposal") {
                            _Concurrency.Task {
                                await vm.generateProposal(workspaceId: workspaceId, app: app, mode: "generate_initial_pack", blueprintIds: vm.blueprints.map(\.id), packId: nil)
                            }
                        }
                            .buttonStyle(MissionButtonStyle(size: .xs, variant: .primary))
                    }
                }
            }
            TextField("Application name", text: $appName)
            TextField("Repo path on bridge machine", text: $repoPath)
                .textInputAutocapitalization(.never)
            Button("Link App") {
                let name = appName
                let path = repoPath
                appName = ""
                repoPath = ""
                _Concurrency.Task { await vm.createLinkedApp(workspaceId: workspaceId, name: name, repoPath: path) }
            }
            .disabled(appName.isEmpty || repoPath.isEmpty)
        }
        .listRowBackground(ClawColors.backgroundCard)
    }

    private var blueprintsSection: some View {
        Section {
            DisclosureGroup("Advanced: Blueprints") {
                Text("Blueprints are templates used by generation jobs. They are shown here for visibility, but normal review work happens in Proposals.")
                    .font(.system(size: 13))
                    .foregroundStyle(ClawColors.textPrimary.opacity(0.86))

                if vm.blueprints.isEmpty {
                    emptyRow("No blueprints are available for this workspace.")
                }

                ForEach(vm.blueprints) { blueprint in
                    Button {
                        vm.selectedBlueprint = blueprint
                    } label: {
                        VStack(alignment: .leading, spacing: 6) {
                            HStack {
                                Text(blueprint.name)
                                    .foregroundStyle(ClawColors.textPrimary)
                                Spacer()
                                Image(systemName: "chevron.right")
                                    .font(.system(size: 12, weight: .semibold))
                                    .foregroundStyle(ClawColors.textSecondary)
                            }
                            Text(blueprint.systemKey)
                                .font(.caption)
                                .foregroundStyle(ClawColors.textPrimary.opacity(0.72))
                            HStack {
                                MissionBadge(text: blueprint.isSystem ? "system" : blueprint.status, color: blueprint.isSystem ? ClawColors.textSecondary : ClawColors.accentPurple)
                                MissionBadge(text: blueprint.version, color: ClawColors.accentTeal)
                            }
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .listRowBackground(ClawColors.backgroundCard)
    }

    private var packsSection: some View {
        Section("Generated Packs") {
            Text("Applied proposals create documentation packs. Sync a pack when it should be available to OpenClaw library consumers.")
                .font(.system(size: 13))
                .foregroundStyle(ClawColors.textPrimary.opacity(0.86))

            if vm.packs.isEmpty {
                emptyRow("No documentation packs yet. Generate and apply a proposal first.")
            }

            ForEach(vm.packs) { pack in
                VStack(alignment: .leading, spacing: 4) {
                    Text(pack.packPath).foregroundStyle(ClawColors.textPrimary)
                    HStack {
                        MissionBadge(text: pack.reviewStatus, color: ClawColors.accent)
                        MissionBadge(text: pack.syncStatus, color: pack.syncStatus == "synced" ? ClawColors.accentGreen : ClawColors.accentOrange)
                    }
                    HStack {
                        Button("Sync to Library") { _Concurrency.Task { await vm.syncPack(workspaceId: workspaceId, pack: pack, targetFolder: targetFolder.isEmpty ? nil : targetFolder) } }
                            .buttonStyle(MissionButtonStyle(size: .xs, variant: .primary))
                        Button("Export State") { _Concurrency.Task { await vm.exportState(workspaceId: workspaceId, packId: pack.id, agentId: nil) } }
                            .buttonStyle(MissionButtonStyle(size: .xs, variant: .secondary))
                    }
                }
            }
            DisclosureGroup("Advanced sync options") {
                Text("Override the library folder only if your bridge setup requires a specific destination.")
                    .font(.system(size: 13))
                    .foregroundStyle(ClawColors.textPrimary.opacity(0.82))
                TextField("Optional library target folder", text: $targetFolder)
                    .textInputAutocapitalization(.never)
            }
        }
        .listRowBackground(ClawColors.backgroundCard)
    }

    private var proposalsSection: some View {
        Section("Proposals") {
            Text("Review generated file changes before applying them to a documentation pack.")
                .font(.system(size: 13))
                .foregroundStyle(ClawColors.textPrimary.opacity(0.86))

            if vm.proposals.isEmpty {
                emptyRow("No proposals yet. Generate one from a linked app.")
            }

            ForEach(vm.proposals) { proposal in
                VStack(alignment: .leading, spacing: 6) {
                    Button {
                        _Concurrency.Task { await vm.loadProposal(workspaceId: workspaceId, id: proposal.id) }
                    } label: {
                        VStack(alignment: .leading, spacing: 3) {
                            Text(proposal.mode.replacingOccurrences(of: "_", with: " ").capitalized).foregroundStyle(ClawColors.textPrimary)
                            HStack {
                                MissionBadge(text: proposal.status, color: proposalStatusColor(proposal.status))
                                MissionBadge(text: "\(proposal.files?.count ?? 0) files", color: ClawColors.textSecondary)
                            }
                        }
                    }
                    .buttonStyle(.plain)

                    if proposal.status == "failed",
                       let app = vm.linkedApps.first(where: { $0.id == proposal.linkedApplicationId }) {
                        HStack {
                            Text("Generation failed.")
                                .font(.caption)
                                .foregroundStyle(ClawColors.accentRed)
                            Button("Retry") {
                                _Concurrency.Task {
                                    await vm.generateProposal(workspaceId: workspaceId, app: app, mode: proposal.mode, blueprintIds: vm.blueprints.map(\.id), packId: proposal.packId)
                                }
                            }
                            .buttonStyle(MissionButtonStyle(size: .xs, variant: .secondary))
                        }
                    }
                    if let errorText = proposalErrorText(proposal) {
                        Text(errorText)
                            .font(.caption)
                            .foregroundStyle(ClawColors.accentRed)
                            .lineLimit(3)
                    }
                }
            }
            if let proposal = vm.selectedProposal {
                Text("Selected: \(proposal.files?.count ?? 0) proposed file changes")
                    .font(.caption)
                    .foregroundStyle(ClawColors.textPrimary.opacity(0.78))
                Button("Apply Selected Proposal Files") { _Concurrency.Task { await vm.applyProposal(workspaceId: workspaceId, proposal: proposal) } }
                    .buttonStyle(MissionButtonStyle(size: .sm, variant: .primary))
            }
        }
        .listRowBackground(ClawColors.backgroundCard)
    }

    private var installsSection: some View {
        Section("Agent Installs") {
            Text("Install a documentation pack as manager or worker guidance for a selected agent.")
                .font(.system(size: 13))
                .foregroundStyle(ClawColors.textPrimary.opacity(0.86))

            if vm.installs.isEmpty {
                emptyRow("No documentation packs are installed on agents yet.")
            }

            ForEach(vm.installs) { install in
                HStack {
                    Text(install.role.capitalized)
                    Spacer()
                    MissionBadge(text: install.installStatus, color: ClawColors.accent)
                    MissionBadge(text: install.driftStatus, color: install.driftStatus == "clean" ? ClawColors.accentGreen : ClawColors.accentOrange)
                }
            }
            Picker("Pack", selection: $selectedPackId) {
                Text("Select pack").tag("")
                ForEach(vm.packs) { pack in Text(pack.packPath).tag(pack.id) }
            }
            Picker("Agent", selection: $selectedAgentId) {
                Text("Select agent").tag("")
                ForEach(agents) { agent in Text(agent.name).tag(agent.id) }
            }
            Button("Install Manager Docs") { _Concurrency.Task { await vm.install(workspaceId: workspaceId, packId: selectedPackId, agentId: selectedAgentId, role: "manager") } }
                .disabled(selectedPackId.isEmpty || selectedAgentId.isEmpty)
            Button("Install Worker Docs") { _Concurrency.Task { await vm.install(workspaceId: workspaceId, packId: selectedPackId, agentId: selectedAgentId, role: "worker") } }
                .disabled(selectedPackId.isEmpty || selectedAgentId.isEmpty)
        }
        .listRowBackground(ClawColors.backgroundCard)
    }

    private var driftSection: some View {
        Section {
            DisclosureGroup("Advanced: Drift / State") {
                Text("Drift summarizes backend state used to decide whether installed documentation needs attention.")
                    .font(.system(size: 13))
                    .foregroundStyle(ClawColors.textPrimary.opacity(0.82))

                if vm.drift.isEmpty {
                    emptyRow("No drift state returned for this workspace.")
                }

                ForEach(Array(vm.drift.keys.sorted()), id: \.self) { key in
                    HStack {
                        Text(key)
                        Spacer()
                        Text(vm.drift[key]?.displayString ?? "")
                            .foregroundStyle(ClawColors.textPrimary.opacity(0.78))
                    }
                }
            }
        }
        .listRowBackground(ClawColors.backgroundCard)
    }

    private func emptyRow(_ message: String) -> some View {
        Text(message)
            .font(.system(size: 13))
            .foregroundStyle(ClawColors.textPrimary.opacity(0.72))
            .padding(.vertical, 4)
    }

    private func latestProposal(for app: LinkedApplication) -> DocumentationGenerationProposal? {
        vm.proposals
            .filter { $0.linkedApplicationId == app.id }
            .sorted { $0.updatedAt > $1.updatedAt }
            .first
    }

    private func proposalStatusColor(_ status: String) -> Color {
        switch status {
        case "ready", "pending_review", "applied":
            return ClawColors.accentGreen
        case "failed", "error":
            return ClawColors.accentRed
        case "generating", "queued", "running":
            return ClawColors.accentOrange
        default:
            return ClawColors.textSecondary
        }
    }

    private func proposalErrorText(_ proposal: DocumentationGenerationProposal) -> String? {
        proposal.compilerOutputMetadata?["error"]?.displayString
    }

    private func retryAction(for proposal: DocumentationGenerationProposal) -> (() -> Void)? {
        guard proposal.status == "failed",
              let app = vm.linkedApps.first(where: { $0.id == proposal.linkedApplicationId }) else {
            return nil
        }
        return {
            _Concurrency.Task {
                await vm.generateProposal(workspaceId: workspaceId, app: app, mode: proposal.mode, blueprintIds: vm.blueprints.map(\.id), packId: proposal.packId)
            }
        }
    }
}

private struct BlueprintDetailSheet: View {
    let blueprint: DocumentationBlueprint
    let onFork: () -> Void

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: ClawSpacing.lg) {
                    MissionPanel {
                        MissionSectionHeader(
                            title: blueprint.name,
                            subtitle: "\(blueprint.systemKey) · \(blueprint.version)"
                        )
                        HStack {
                            MissionBadge(text: blueprint.isSystem ? "system" : blueprint.status, color: blueprint.isSystem ? ClawColors.textSecondary : ClawColors.accentPurple)
                            if blueprint.protected {
                                MissionBadge(text: "protected", color: ClawColors.accentOrange)
                            }
                        }
                        if !blueprint.changelog.isEmpty {
                            Text(blueprint.changelog)
                                .font(.system(size: 13))
                                .foregroundStyle(ClawColors.textPrimary.opacity(0.84))
                        }
                    }

                    MissionPanel {
                        MissionSectionHeader(title: "Blueprint Content", subtitle: "Read-only generation instructions used by documentation jobs.")
                        ReadableMarkdownView(markdown: blueprint.content)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(ClawSpacing.md)
                            .background(ClawColors.backgroundSurface)
                            .clipShape(RoundedRectangle(cornerRadius: ClawRadius.md))
                    }
                }
                .padding(ClawSpacing.lg)
            }
            .missionScreenBackground()
            .navigationTitle("Blueprint")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Fork") { onFork() }
                        .disabled(!blueprint.isSystem && blueprint.protected)
                }
            }
        }
        .presentationBackground(ClawColors.backgroundPrimary)
    }
}

private struct ProposalDetailSheet: View {
    let proposal: DocumentationGenerationProposal
    let errorText: String?
    let onRetry: (() -> Void)?
    let onApply: () -> Void

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: ClawSpacing.lg) {
                    MissionPanel {
                        MissionSectionHeader(
                            title: proposal.mode.replacingOccurrences(of: "_", with: " ").capitalized,
                            subtitle: "\(proposal.files?.count ?? 0) proposed file changes"
                        )
                        HStack {
                            MissionBadge(text: proposal.status, color: statusColor)
                            MissionBadge(text: proposal.updatedAt.relativeTime, color: ClawColors.textSecondary)
                        }
                        if let errorText {
                            Text(errorText)
                                .font(.system(size: 13))
                                .foregroundStyle(ClawColors.accentRed)
                                .padding(ClawSpacing.sm)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(ClawColors.accentRed.opacity(0.08))
                                .clipShape(RoundedRectangle(cornerRadius: ClawRadius.sm))
                        }
                        if proposal.status == "generating" {
                            Text("Generation is running in the background. You can leave this screen and return to Review later.")
                                .font(.system(size: 13))
                                .foregroundStyle(ClawColors.textPrimary.opacity(0.84))
                        }
                    }

                    if let files = proposal.files, !files.isEmpty {
                        ForEach(files) { file in
                            ProposalFileCard(file: file)
                        }
                    } else {
                        MissionPanel {
                            Text("No file changes are attached to this proposal yet.")
                                .font(.system(size: 13))
                                .foregroundStyle(ClawColors.textPrimary.opacity(0.76))
                        }
                    }
                }
                .padding(ClawSpacing.lg)
            }
            .missionScreenBackground()
            .navigationTitle("Proposal")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
                ToolbarItemGroup(placement: .confirmationAction) {
                    if let onRetry {
                        Button("Retry") { onRetry() }
                    }
                    Button("Apply") { onApply() }
                        .disabled(proposal.files?.isEmpty ?? true)
                }
            }
        }
        .presentationBackground(ClawColors.backgroundPrimary)
    }

    private var statusColor: Color {
        switch proposal.status {
        case "ready", "pending_review", "applied": return ClawColors.accentGreen
        case "failed", "error": return ClawColors.accentRed
        case "generating", "queued", "running": return ClawColors.accentOrange
        default: return ClawColors.textSecondary
        }
    }
}

private struct ProposalFileCard: View {
    let file: DocumentationProposalFile

    var body: some View {
        MissionPanel {
            VStack(alignment: .leading, spacing: ClawSpacing.md) {
                Text(file.relativePath)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(ClawColors.textPrimary)
                    .textSelection(.enabled)
                HStack {
                    MissionBadge(text: file.classification, color: ClawColors.accent)
                    MissionBadge(text: file.refreshPolicy, color: ClawColors.accentTeal)
                    if file.requiresManualReview {
                        MissionBadge(text: "manual review", color: ClawColors.accentOrange)
                    }
                }
                if let previous = file.previousContent, !previous.isEmpty {
                    contentBlock(title: "Previous", content: previous, color: ClawColors.textPrimary.opacity(0.78))
                }
                contentBlock(title: "Updated", content: file.updatedContent, color: ClawColors.textPrimary)
            }
        }
    }

    private func contentBlock(title: String, content: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: ClawSpacing.xs) {
            Text(title)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(ClawColors.textPrimary.opacity(0.78))
            ReadableMarkdownView(markdown: content)
                .opacity(color == ClawColors.textPrimary ? 1 : 0.82)
                .lineLimit(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(ClawSpacing.sm)
                .background(ClawColors.backgroundSurface)
                .clipShape(RoundedRectangle(cornerRadius: ClawRadius.sm))
        }
    }
}
