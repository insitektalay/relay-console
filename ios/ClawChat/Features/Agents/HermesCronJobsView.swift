import SwiftUI

private struct HermesCronJob: Identifiable, Hashable {
    var id: String
    var name: String
    var enabled: Bool
    var state: String
    var schedule: String
    var prompt: String
    var nextRunAt: String?
    var lastRunAt: String?
    var lastStatus: String?
    var lastError: String?
    var outputDirectory: String?
}

@MainActor
private final class HermesCronJobsViewModel: ObservableObject {
    @Published var jobs: [HermesCronJob] = []
    @Published var selectedId: String?
    @Published var isLoading = false
    @Published var isSaving = false
    @Published var error: String?
    @Published var notice: String?

    let workspaceId: String
    let agentId: String
    private var root: JSONValue?

    init(workspaceId: String, agentId: String) {
        self.workspaceId = workspaceId
        self.agentId = agentId
    }

    func load() async {
        guard !isLoading else { return }
        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            let file: LibraryReadResult = try await APIClient.shared.request(
                .hermesWorkspaceReadFile(workspaceId: workspaceId, agentId: agentId, folder: "agent", path: "/cron", filename: "jobs.json")
            )
            guard let data = file.content.data(using: .utf8) else { throw APIError.decodingError(underlying: CronError.invalidDocument) }
            root = try JSONDecoder().decode(JSONValue.self, from: data)
            jobs = parse(root)
            selectedId = selectedId.flatMap { id in jobs.contains(where: { $0.id == id }) ? id : nil } ?? jobs.first?.id
        } catch {
            self.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    func save(_ job: HermesCronJob) async {
        guard !isSaving, let root else { return }
        isSaving = true
        error = nil
        defer { isSaving = false }
        do {
            let updated = update(root: root, job: job)
            let encoder = JSONEncoder()
            encoder.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
            let data = try encoder.encode(updated)
            guard let content = String(data: data, encoding: .utf8) else { throw CronError.invalidDocument }
            let _: LibraryWriteResult = try await APIClient.shared.request(
                .hermesWorkspaceWriteFiles(
                    workspaceId: workspaceId,
                    agentId: agentId,
                    folder: "agent",
                    path: "/cron",
                    files: [["filename": "jobs.json", "content": content + "\n", "encoding": "utf8"]]
                )
            )
            self.root = updated
            jobs = parse(updated)
            notice = "Cron job saved to Hermes jobs.json."
        } catch {
            self.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    private func parse(_ value: JSONValue?) -> [HermesCronJob] {
        let values: [JSONValue]
        switch value {
        case .array(let array): values = array
        case .object(let object):
            if case .array(let array) = object["jobs"] { values = array } else { values = [] }
        default: values = []
        }
        return values.enumerated().compactMap { index, value in
            guard case .object(let item) = value else { return nil }
            let id = item["id"]?.text ?? "job-\(index + 1)"
            let prompt = item["prompt"]?.text ?? ""
            let enabled = item["enabled"]?.boolean ?? true
            return HermesCronJob(
                id: id,
                name: item["name"]?.text.nilIfBlank ?? prompt.prefix(50).description.nilIfBlank ?? "Cron job \(index + 1)",
                enabled: enabled,
                state: item["state"]?.text.nilIfBlank ?? (enabled ? "scheduled" : "paused"),
                schedule: item["schedule_display"]?.text.nilIfBlank ?? scheduleLabel(item["schedule"]),
                prompt: prompt,
                nextRunAt: item["next_run_at"]?.text.nilIfBlank,
                lastRunAt: item["last_run_at"]?.text.nilIfBlank,
                lastStatus: item["last_status"]?.text.nilIfBlank,
                lastError: item["last_error"]?.text.nilIfBlank ?? item["last_delivery_error"]?.text.nilIfBlank,
                outputDirectory: item["output_directory"]?.text.nilIfBlank ?? item["artifact_output_directory"]?.text.nilIfBlank
            )
        }
    }

    private func scheduleLabel(_ value: JSONValue?) -> String {
        if let text = value?.text.nilIfBlank { return text }
        guard case .object(let object) = value else { return "Schedule unavailable" }
        return object["expression"]?.text.nilIfBlank ?? object["cron"]?.text.nilIfBlank ?? object["schedule"]?.text.nilIfBlank ?? "Schedule unavailable"
    }

    private func update(root: JSONValue, job: HermesCronJob) -> JSONValue {
        func updatedJobs(_ values: [JSONValue]) -> [JSONValue] {
            var found = false
            var result = values.map { value in
                guard case .object(var item) = value, item["id"]?.text == job.id else { return value }
                found = true
                let output = job.outputDirectory.nilIfBlank ?? ".clawchat/artifacts/cron/\(job.id)"
                item["prompt"] = .string(artifactPrompt(job.prompt, output: output))
                item["enabled"] = .bool(job.enabled)
                item["state"] = .string(job.enabled ? "scheduled" : "paused")
                item["output_directory"] = .string(output)
                item["paused_at"] = job.enabled ? .null : .string(APIClient.isoString(Date()))
                item["paused_reason"] = job.enabled ? .null : .string("Paused from Relay Console iOS")
                return .object(item)
            }
            if !found {
                let output = job.outputDirectory.nilIfBlank ?? ".clawchat/artifacts/cron/\(job.id)"
                result.append(.object([
                    "id": .string(job.id),
                    "name": .string(job.name.nilIfBlank ?? "New cron job"),
                    "prompt": .string(artifactPrompt(job.prompt, output: output)),
                    "enabled": .bool(job.enabled),
                    "state": .string(job.enabled ? "scheduled" : "paused"),
                    "schedule": .string(job.schedule.nilIfBlank ?? "0 * * * *"),
                    "output_directory": .string(output)
                ]))
            }
            return result
        }
        switch root {
        case .array(let values): return .array(updatedJobs(values))
        case .object(var object):
            if case .array(let values) = object["jobs"] { object["jobs"] = .array(updatedJobs(values)) }
            object["updated_at"] = .string(APIClient.isoString(Date()))
            return .object(object)
        default: return root
        }
    }

    private func artifactPrompt(_ prompt: String, output: String) -> String {
        let marker = "[Relay Console cron artifact contract]"
        let outputMarker = "[Relay Console cron artifact output]"
        let outputEndMarker = "[End Relay Console cron artifact output]"
        let withoutExisting = prompt.replacingOccurrences(
            of: #"\n?\[Relay Console cron artifact contract\][\s\S]*?\[End Relay Console cron artifact contract\]\n?"#,
            with: "",
            options: .regularExpression
        ).trimmingCharacters(in: .whitespacesAndNewlines)
        let block = """
        \(marker)
        \(outputMarker)
        Directory: \(output)
        \(outputEndMarker)

        Put maintained documents, images, video, audio, data exports, and external pointer manifests there. Keep scheduler/debug run records out of that directory.
        [End Relay Console cron artifact contract]
        """
        return [withoutExisting, block]
            .filter { !$0.isEmpty }
            .joined(separator: "\n\n")
    }

    private enum CronError: LocalizedError {
        case invalidDocument
        var errorDescription: String? { "Hermes jobs.json is not a valid cron document." }
    }
}

struct HermesCronJobsView: View {
    @StateObject private var viewModel: HermesCronJobsViewModel
    let agentName: String

    @State private var search = ""
    @State private var editingJob: HermesCronJob?

    init(workspaceId: String, agentId: String, agentName: String) {
        _viewModel = StateObject(wrappedValue: HermesCronJobsViewModel(workspaceId: workspaceId, agentId: agentId))
        self.agentName = agentName
    }

    private var filteredJobs: [HermesCronJob] {
        guard !search.isEmpty else { return viewModel.jobs }
        return viewModel.jobs.filter { "\($0.name) \($0.schedule) \($0.prompt)".localizedCaseInsensitiveContains(search) }
    }

    var body: some View {
        ZStack {
            RelayColors.backgroundPrimary.ignoresSafeArea()
            ScrollView {
                VStack(spacing: RelaySpacing.md) {
                    HStack(spacing: RelaySpacing.sm) {
                        HStack {
                            Image(systemName: "magnifyingglass")
                            TextField("Search cron jobs", text: $search)
                                .textInputAutocapitalization(.never)
                        }
                        .foregroundStyle(RelayColors.textSecondary)
                        .padding(.horizontal, RelaySpacing.md)
                        .frame(height: 42)
                        .background(RelayColors.fieldBackground)
                        .clipShape(RoundedRectangle(cornerRadius: RelayRadius.md))
                        .overlay(RoundedRectangle(cornerRadius: RelayRadius.md).stroke(RelayColors.borderStandard))
                        Button { _Concurrency.Task { await viewModel.load() } } label: {
                            Image(systemName: "arrow.clockwise")
                                .foregroundStyle(RelayColors.textPrimary)
                                .frame(width: 42, height: 42)
                                .background(RelayColors.fieldBackground)
                                .clipShape(RoundedRectangle(cornerRadius: RelayRadius.md))
                        }
                    }
                    if let error = viewModel.error { RelayErrorPanel(message: error) }
                    if let notice = viewModel.notice { RelayStatusStrip(title: "Cron job updated", detail: notice, tone: .success, icon: "checkmark.circle.fill") }
                    if viewModel.isLoading && viewModel.jobs.isEmpty {
                        RelayLoadingState(message: "Loading cron jobs").padding(.top, 50)
                    } else if filteredJobs.isEmpty {
                        RelayInlineEmptyState(icon: "calendar.badge.clock", title: search.isEmpty ? "No cron jobs" : "No matching cron jobs", subtitle: search.isEmpty ? "Hermes has no writable jobs in agent/cron/jobs.json." : "Try a different name or schedule.")
                            .padding(.top, 40)
                    } else {
                        LazyVStack(spacing: RelaySpacing.md) {
                            ForEach(filteredJobs) { job in cronCard(job) }
                        }
                    }
                }
                .padding(.horizontal, RelaySpacing.lg)
                .padding(.vertical, RelaySpacing.md)
            }
        }
        .navigationTitle("Cron Jobs")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(RelayColors.backgroundPrimary, for: .navigationBar)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    editingJob = HermesCronJob(id: UUID().uuidString.lowercased(), name: "New cron job", enabled: true, state: "scheduled", schedule: "0 * * * *", prompt: "", nextRunAt: nil, lastRunAt: nil, lastStatus: nil, lastError: nil, outputDirectory: nil)
                } label: { Image(systemName: "plus") }
            }
        }
        .refreshable { await viewModel.load() }
        .task { await viewModel.load() }
        .sheet(item: $editingJob) { job in
            HermesCronJobEditor(job: job, isSaving: viewModel.isSaving) { updated in
                await viewModel.save(updated)
                if viewModel.error == nil { editingJob = nil }
            }
        }
    }

    private func cronCard(_ job: HermesCronJob) -> some View {
        VStack(alignment: .leading, spacing: RelaySpacing.md) {
            HStack(alignment: .top) {
                Image(systemName: "calendar.badge.clock")
                    .foregroundStyle(RelayColors.accent)
                    .frame(width: 28, height: 28)
                    .background(RelayColors.accent.opacity(0.12))
                    .clipShape(RoundedRectangle(cornerRadius: 6))
                VStack(alignment: .leading, spacing: 4) {
                    Text(job.name).font(.system(size: 15, weight: .semibold)).foregroundStyle(RelayColors.textPrimary)
                    Text(agentName).font(RelayFonts.caption).foregroundStyle(RelayColors.textSecondary)
                }
                Spacer()
                Button { editingJob = job } label: { Image(systemName: "ellipsis") }.foregroundStyle(RelayColors.textSecondary)
            }
            HStack(spacing: 6) {
                badge(job.enabled ? "SCHEDULER RUNNING" : "PAUSED", color: job.enabled ? RelayColors.accentGreen : RelayColors.accentOrange)
                badge("HERMES", color: RelayColors.accentGreen)
                badge(job.schedule.uppercased(), color: RelayColors.accentPurple)
            }
            .lineLimit(1)
            if let output = job.outputDirectory { badge("OUTPUT \(output)", color: RelayColors.accentGreen) }
            Button { editingJob = job } label: {
                Text("Edit instructions")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(RelayColors.textPrimary)
                    .frame(maxWidth: .infinity).padding(.vertical, 10)
                    .background(RelayColors.fieldBackground)
                    .clipShape(RoundedRectangle(cornerRadius: RelayRadius.md))
                    .overlay(RoundedRectangle(cornerRadius: RelayRadius.md).stroke(RelayColors.borderStandard))
            }
            .buttonStyle(.plain)
            if let error = job.lastError {
                HStack(alignment: .top, spacing: RelaySpacing.sm) {
                    Image(systemName: "exclamationmark.triangle").foregroundStyle(RelayColors.accentOrange)
                    Text(error).font(RelayFonts.caption).foregroundStyle(RelayColors.accentOrange)
                    Spacer()
                    Image(systemName: "xmark").foregroundStyle(RelayColors.textSecondary)
                }
                .padding(RelaySpacing.md)
                .background(RelayColors.accentOrange.opacity(0.08))
                .clipShape(RoundedRectangle(cornerRadius: RelayRadius.md))
                .overlay(RoundedRectangle(cornerRadius: RelayRadius.md).stroke(RelayColors.accentOrange.opacity(0.35)))
            }
        }
        .padding(RelaySpacing.md)
        .background(RelayColors.backgroundCard)
        .clipShape(RoundedRectangle(cornerRadius: RelayRadius.lg))
        .overlay(RoundedRectangle(cornerRadius: RelayRadius.lg).stroke(RelayColors.borderStandard))
    }

    private func badge(_ title: String, color: Color) -> some View {
        Text(title).font(.system(size: 9, weight: .bold)).foregroundStyle(color)
            .padding(.horizontal, 7).padding(.vertical, 5)
            .background(color.opacity(0.10)).clipShape(RoundedRectangle(cornerRadius: 5))
            .overlay(RoundedRectangle(cornerRadius: 5).stroke(color.opacity(0.35)))
    }
}

private struct HermesCronJobEditor: View {
    @Environment(\.dismiss) private var dismiss
    @State var job: HermesCronJob
    private let originalEnabled: Bool
    @State private var showPauseConfirmation = false
    let isSaving: Bool
    let onSave: (HermesCronJob) async -> Void

    init(job: HermesCronJob, isSaving: Bool, onSave: @escaping (HermesCronJob) async -> Void) {
        self._job = State(initialValue: job)
        self.originalEnabled = job.enabled
        self.isSaving = isSaving
        self.onSave = onSave
    }

    private var canSave: Bool {
        !isSaving && !job.prompt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Status") {
                    Toggle("Enabled", isOn: $job.enabled)
                    LabeledContent("Schedule", value: job.schedule)
                    Text("The schedule expression is managed in Hermes jobs.json and is read-only in this editor.")
                        .font(RelayFonts.caption)
                        .foregroundStyle(RelayColors.textSecondary)
                }
                .listRowBackground(RelayColors.backgroundCard)
                Section("Prompt") {
                    TextEditor(text: $job.prompt).frame(minHeight: 180)
                    if job.prompt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        Label("Prompt is required.", systemImage: "exclamationmark.circle.fill")
                            .font(RelayFonts.caption)
                            .foregroundStyle(RelayColors.accentRed)
                    }
                }
                .listRowBackground(RelayColors.backgroundCard)
                Section("Artifacts") {
                    LabeledContent("Output directory", value: job.outputDirectory ?? ".clawchat/artifacts/cron/\(job.id)")
                    Text("Relay Console preserves the durable artifact contract when this job is saved.")
                        .font(RelayFonts.caption)
                        .foregroundStyle(RelayColors.textSecondary)
                }
                .listRowBackground(RelayColors.backgroundCard)
            }
            .scrollContentBackground(.hidden)
            .relayScreenBackground()
            .navigationTitle(job.name)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        if originalEnabled && !job.enabled {
                            showPauseConfirmation = true
                        } else {
                            _Concurrency.Task { await onSave(job) }
                        }
                    }
                    .disabled(!canSave)
                    .accessibilityIdentifier("cron-editor-save")
                }
            }
            .confirmationDialog("Pause \(job.name)?", isPresented: $showPauseConfirmation, titleVisibility: .visible) {
                Button("Pause cron job", role: .destructive) { _Concurrency.Task { await onSave(job) } }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("Scheduled runs stop until this job is enabled again. Existing artifacts are retained.")
            }
        }
    }
}

private extension JSONValue {
    var text: String {
        if case .string(let value) = self { return value }
        return ""
    }
    var boolean: Bool? {
        if case .bool(let value) = self { return value }
        return nil
    }
}

private extension Optional where Wrapped == String {
    var nilIfBlank: String? {
        guard let self, !self.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return nil }
        return self
    }
}

private extension String {
    var nilIfBlank: String? { Optional(self).nilIfBlank }
}
