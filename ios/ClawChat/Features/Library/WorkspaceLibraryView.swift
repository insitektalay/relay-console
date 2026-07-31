// WorkspaceLibraryView.swift
// ClawChat – OpenClaw workspace and agent file browser

import SwiftUI
import UniformTypeIdentifiers

enum LibraryRoot: Hashable {
    case workspace
    case agent(agentId: String, agentName: String)

    var title: String {
        switch self {
        case .workspace: return "Workspace Library"
        case .agent(_, let name): return "\(name) Workspace"
        }
    }
}

enum WorkspaceLibraryScope: Hashable {
    case all
    case instructions
    case memory
    case skills

    fileprivate var acceptedRootFolders: Set<String> {
        switch self {
        case .all, .instructions: return []
        case .memory: return ["memory", "memories"]
        case .skills: return ["skills"]
        }
    }

    fileprivate func includesRootFile(_ filename: String) -> Bool {
        switch self {
        case .all:
            return true
        case .instructions:
            let ext = (filename as NSString).pathExtension.lowercased()
            return ext == "md" || ext == "markdown"
        case .memory:
            let name = filename.lowercased()
            return name == "memory.md" || name == "user.md"
        case .skills:
            return false
        }
    }

    fileprivate var emptyMessage: String? {
        switch self {
        case .all: return nil
        case .instructions: return "No instruction Markdown files were found for this agent. Create or upload SOUL.md to add identity and operating guidance."
        case .memory: return "No memory files were found for this agent. Create or upload MEMORY.md to add durable context."
        case .skills: return "No skills folder was found for this agent. Create or upload a skill to add capabilities."
        }
    }
}

@MainActor
@Observable
final class WorkspaceLibraryViewModel {
    var listing = LibraryListResult(folder: "", folders: [], files: [])
    var selectedFile: LibraryReadResult?
    var editedContent = ""
    var folder = ""
    var isLoading = false
    var error: String?

    func load(workspaceId: String, root: LibraryRoot, folder: String? = nil) async {
        let targetFolder = folder ?? self.folder
        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            listing = try await APIClient.shared.request(listEndpoint(workspaceId: workspaceId, root: root, folder: targetFolder))
            self.folder = listing.folder
            Telemetry.shared.breadcrumb("Loaded library folder", category: "library.list", attributes: ["workspaceId": workspaceId, "folder": self.folder, "root": root.title])
        } catch {
            self.error = error.localizedDescription
            Telemetry.shared.capture(error: error, attributes: ["operation": "library.list", "workspaceId": workspaceId, "folder": targetFolder])
        }
    }

    func fetchListing(workspaceId: String, root: LibraryRoot, folder: String) async throws -> LibraryListResult {
        try await APIClient.shared.request(listEndpoint(workspaceId: workspaceId, root: root, folder: folder))
    }

    func open(file: LibraryFileEntry, workspaceId: String, root: LibraryRoot, folder: String? = nil) async {
        let targetFolder = folder ?? listing.folder
        error = nil
        do {
            selectedFile = try await APIClient.shared.request(readEndpoint(workspaceId: workspaceId, root: root, folder: targetFolder, filename: file.filename))
            editedContent = selectedFile?.content ?? ""
            Telemetry.shared.breadcrumb("Read library file", category: "library.file.read", attributes: ["workspaceId": workspaceId, "path": file.path])
        } catch {
            self.error = error.localizedDescription
            Telemetry.shared.capture(error: error, attributes: ["operation": "library.file.read", "workspaceId": workspaceId, "filename": file.filename])
        }
    }

    func write(filename: String, content: String, workspaceId: String, root: LibraryRoot, folder: String? = nil) async {
        let targetFolder = folder ?? listing.folder
        let file: [String: Any] = ["filename": filename, "content": content, "contentEncoding": "utf8", "contentType": "text/markdown"]
        do {
            let _: LibraryWriteResult = try await APIClient.shared.request(writeEndpoint(workspaceId: workspaceId, root: root, folder: targetFolder, files: [file]))
            Telemetry.shared.event("library.file.written", attributes: ["workspaceId": workspaceId, "filename": filename, "folder": targetFolder])
            await load(workspaceId: workspaceId, root: root, folder: targetFolder)
        } catch {
            self.error = error.localizedDescription
            Telemetry.shared.capture(error: error, attributes: ["operation": "library.file.write", "workspaceId": workspaceId, "filename": filename])
        }
    }

    func createFolder(name: String, workspaceId: String, root: LibraryRoot) async {
        let path = [listing.folder, name].filter { !$0.isEmpty }.joined(separator: "/")
        do {
            let _: LibraryWriteResult = try await APIClient.shared.request(createFolderEndpoint(workspaceId: workspaceId, root: root, folder: path))
            await load(workspaceId: workspaceId, root: root)
        } catch {
            self.error = error.localizedDescription
            Telemetry.shared.capture(error: error, attributes: ["operation": "library.folder.create", "workspaceId": workspaceId, "folder": path])
        }
    }

    func delete(file: LibraryFileEntry, workspaceId: String, root: LibraryRoot, folder: String? = nil) async {
        let targetFolder = folder ?? listing.folder
        do {
            let _: LibraryDeleteResult = try await APIClient.shared.request(deleteFileEndpoint(workspaceId: workspaceId, root: root, folder: targetFolder, filename: file.filename))
            await load(workspaceId: workspaceId, root: root, folder: targetFolder)
        } catch {
            self.error = error.localizedDescription
            Telemetry.shared.capture(error: error, attributes: ["operation": "library.file.delete", "workspaceId": workspaceId, "filename": file.filename])
        }
    }

    func deleteCurrentFolder(workspaceId: String, root: LibraryRoot) async {
        guard !listing.folder.isEmpty else { return }
        let parent = parentFolder(listing.folder)
        do {
            let _: LibraryDeleteResult = try await APIClient.shared.request(deleteFolderEndpoint(workspaceId: workspaceId, root: root, folder: listing.folder))
            await load(workspaceId: workspaceId, root: root, folder: parent)
        } catch {
            self.error = error.localizedDescription
            Telemetry.shared.capture(error: error, attributes: ["operation": "library.folder.delete", "workspaceId": workspaceId, "folder": listing.folder])
        }
    }

    func exportURL() -> URL? {
        guard let file = selectedFile else { return nil }
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(file.filename)
        try? file.content.data(using: .utf8)?.write(to: url)
        return url
    }

    private func listEndpoint(workspaceId: String, root: LibraryRoot, folder: String) -> APIEndpoint {
        switch root {
        case .workspace: return .workspaceLibraryList(workspaceId: workspaceId, folder: folder)
        case .agent(let agentId, _): return .agentWorkspaceList(workspaceId: workspaceId, agentId: agentId, folder: folder)
        }
    }

    private func readEndpoint(workspaceId: String, root: LibraryRoot, folder: String, filename: String) -> APIEndpoint {
        switch root {
        case .workspace: return .workspaceLibraryReadFile(workspaceId: workspaceId, folder: folder, filename: filename)
        case .agent(let agentId, _): return .agentWorkspaceReadFile(workspaceId: workspaceId, agentId: agentId, folder: folder, filename: filename)
        }
    }

    private func writeEndpoint(workspaceId: String, root: LibraryRoot, folder: String, files: [[String: Any]]) -> APIEndpoint {
        switch root {
        case .workspace: return .workspaceLibraryWriteFiles(workspaceId: workspaceId, folder: folder, files: files)
        case .agent(let agentId, _): return .agentWorkspaceWriteFiles(workspaceId: workspaceId, agentId: agentId, folder: folder, files: files)
        }
    }

    private func createFolderEndpoint(workspaceId: String, root: LibraryRoot, folder: String) -> APIEndpoint {
        switch root {
        case .workspace: return .workspaceLibraryCreateFolder(workspaceId: workspaceId, folder: folder)
        case .agent(let agentId, _): return .agentWorkspaceCreateFolder(workspaceId: workspaceId, agentId: agentId, folder: folder)
        }
    }

    private func deleteFileEndpoint(workspaceId: String, root: LibraryRoot, folder: String, filename: String) -> APIEndpoint {
        switch root {
        case .workspace: return .workspaceLibraryDeleteFile(workspaceId: workspaceId, folder: folder, filename: filename)
        case .agent(let agentId, _): return .agentWorkspaceDeleteFile(workspaceId: workspaceId, agentId: agentId, folder: folder, filename: filename)
        }
    }

    private func deleteFolderEndpoint(workspaceId: String, root: LibraryRoot, folder: String) -> APIEndpoint {
        switch root {
        case .workspace: return .workspaceLibraryDeleteFolder(workspaceId: workspaceId, folder: folder)
        case .agent(let agentId, _): return .agentWorkspaceDeleteFolder(workspaceId: workspaceId, agentId: agentId, folder: folder)
        }
    }

    private func parentFolder(_ folder: String) -> String {
        let parts = folder.split(separator: "/").dropLast()
        return parts.joined(separator: "/")
    }
}

struct WorkspaceLibraryView: View {
    let workspaceId: String
    let root: LibraryRoot
    let initialFolder: String
    let title: String
    let scope: WorkspaceLibraryScope

    @State private var vm = WorkspaceLibraryViewModel()
    @State private var newFilename = ""
    @State private var newFolder = ""
    @State private var showImporter = false
    @State private var shareURL: URL?
    @State private var pendingFileDelete: LibraryFileEntry?
    @State private var showFolderDeleteConfirmation = false

    init(
        workspaceId: String,
        root: LibraryRoot,
        initialFolder: String = "",
        title: String? = nil,
        scope: WorkspaceLibraryScope = .all
    ) {
        self.workspaceId = workspaceId
        self.root = root
        self.initialFolder = initialFolder
        self.title = title ?? root.title
        self.scope = scope
    }

    var body: some View {
        List {
            if let error = vm.error {
                Section {
                    MissionErrorPanel(message: error)
                }
                .listRowBackground(ClawColors.backgroundPrimary)
            }

            Section {
                if !vm.listing.folder.isEmpty {
                    Button {
                        _Concurrency.Task { await vm.load(workspaceId: workspaceId, root: root, folder: String(vm.listing.folder.split(separator: "/").dropLast().joined(separator: "/"))) }
                    } label: {
                        Label("Up", systemImage: "arrow.up")
                    }
                }

                ForEach(visibleFolders) { folder in
                    Button {
                        _Concurrency.Task { await vm.load(workspaceId: workspaceId, root: root, folder: folder.path) }
                    } label: {
                        Label(folder.name, systemImage: "folder.fill")
                            .foregroundStyle(ClawColors.textPrimary)
                    }
                }

                ForEach(visibleFiles) { file in
                    Button {
                        _Concurrency.Task { await vm.open(file: file, workspaceId: workspaceId, root: root) }
                    } label: {
                        HStack {
                            Label(file.filename, systemImage: "doc.text")
                                .foregroundStyle(ClawColors.textPrimary)
                            Spacer()
                            if let state = file.syncState {
                                MissionBadge(
                                    text: documentSyncLabel(state),
                                    color: documentSyncColor(state)
                                )
                            }
                            MissionBadge(text: formatBytes(file.size), color: ClawColors.textSecondary)
                        }
                    }
                    .swipeActions {
                        Button(role: .destructive) {
                            pendingFileDelete = file
                        } label: {
                            Label("Delete", systemImage: "trash")
                        }
                    }
                }

                if visibleFolders.isEmpty,
                   visibleFiles.isEmpty,
                   let emptyMessage = scope.emptyMessage,
                   !vm.isLoading,
                   vm.error == nil {
                    Text(emptyMessage)
                        .font(.system(size: 14))
                        .foregroundStyle(ClawColors.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.vertical, ClawSpacing.sm)
                }

            } header: {
                Text(vm.listing.folder.isEmpty ? "Root" : vm.listing.folder)
            }
            .listRowBackground(ClawColors.backgroundCard)

            Section("Create") {
                if scope == .skills, vm.listing.folder.isEmpty {
                    Button {
                        _Concurrency.Task { await createPreferredFolder() }
                    } label: {
                        Label("Create Skills Folder", systemImage: "folder.badge.plus")
                    }
                }
                HStack {
                    TextField("folder", text: $newFolder)
                        .textInputAutocapitalization(.never)
                    Button("Folder") {
                        let value = newFolder
                        newFolder = ""
                        _Concurrency.Task { await vm.createFolder(name: value, workspaceId: workspaceId, root: root) }
                    }
                    .disabled(newFolder.isEmpty)
                }
                if canWriteFilesHere {
                    HStack {
                        TextField("file.md", text: $newFilename)
                            .textInputAutocapitalization(.never)
                        Button("File") {
                            let value = newFilename
                            newFilename = ""
                            _Concurrency.Task { await vm.write(filename: value, content: "", workspaceId: workspaceId, root: root) }
                        }
                        .disabled(newFilename.isEmpty)
                    }
                }
            }
            .listRowBackground(ClawColors.backgroundCard)
        }
        .scrollContentBackground(.hidden)
        .missionScreenBackground()
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItemGroup(placement: .topBarTrailing) {
                Button { showImporter = true } label: { Image(systemName: "square.and.arrow.down") }
                    .disabled(!canWriteFilesHere)
                    .accessibilityHint(canWriteFilesHere ? "Imports files into the current folder" : "Create the skills folder before importing files")
                if !vm.listing.folder.isEmpty {
                    Button(role: .destructive) {
                        showFolderDeleteConfirmation = true
                    } label: { Image(systemName: "trash") }
                    .accessibilityLabel("Delete current folder")
                }
            }
        }
        .confirmationDialog(
            "Delete \(pendingFileDelete?.filename ?? "file")?",
            isPresented: Binding(
                get: { pendingFileDelete != nil },
                set: { if !$0 { pendingFileDelete = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button("Delete file", role: .destructive) {
                guard let file = pendingFileDelete else { return }
                pendingFileDelete = nil
                _Concurrency.Task { await vm.delete(file: file, workspaceId: workspaceId, root: root) }
            }
            Button("Cancel", role: .cancel) { pendingFileDelete = nil }
        } message: {
            Text("This permanently deletes the remote agent workspace file. This cannot be undone.")
        }
        .confirmationDialog(
            "Delete this folder?",
            isPresented: $showFolderDeleteConfirmation,
            titleVisibility: .visible
        ) {
            Button("Delete folder", role: .destructive) {
                _Concurrency.Task { await vm.deleteCurrentFolder(workspaceId: workspaceId, root: root) }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This permanently deletes the current remote folder and its contents. This cannot be undone.")
        }
        .sheet(item: Binding(
            get: { vm.selectedFile.map(EditableLibraryFile.init(file:)) },
            set: { if $0 == nil { vm.selectedFile = nil } }
        )) { editable in
            LibraryFileEditorView(file: editable.file, content: $vm.editedContent) { content in
                _Concurrency.Task { await vm.write(filename: editable.file.filename, content: content, workspaceId: workspaceId, root: root) }
            } onExport: {
                shareURL = vm.exportURL()
            }
        }
        .sheet(item: $shareURL) { url in
            ShareSheetURLView(url: url)
        }
        .fileImporter(isPresented: $showImporter, allowedContentTypes: [.text, .plainText, .json, .sourceCode], allowsMultipleSelection: true) { result in
            if case .success(let urls) = result {
                for url in urls {
                    let accessing = url.startAccessingSecurityScopedResource()
                    defer { if accessing { url.stopAccessingSecurityScopedResource() } }
                    if let content = try? String(contentsOf: url, encoding: .utf8) {
                        _Concurrency.Task { await vm.write(filename: url.lastPathComponent, content: content, workspaceId: workspaceId, root: root) }
                    }
                }
            }
        }
        .task { await loadInitialFolder() }
    }

    private var visibleFolders: [LibraryFolderEntry] {
        guard vm.listing.folder.isEmpty, scope != .all else { return vm.listing.folders }
        return vm.listing.folders.filter {
            scope.acceptedRootFolders.contains($0.name.lowercased())
        }
    }

    private var visibleFiles: [LibraryFileEntry] {
        guard vm.listing.folder.isEmpty, scope != .all else { return vm.listing.files }
        return vm.listing.files.filter { scope.includesRootFile($0.filename) }
    }

    private var canWriteFilesHere: Bool {
        scope != .skills || !vm.listing.folder.isEmpty
    }

    private func loadInitialFolder() async {
        guard scope != .all else {
            await vm.load(workspaceId: workspaceId, root: root, folder: initialFolder)
            return
        }

        // Resolve the scoped folder from a valid agent-workspace root first.
        // This avoids turning a missing `memory`/`skills` folder into a 404.
        await vm.load(workspaceId: workspaceId, root: root, folder: "")
        guard vm.error == nil else { return }

        let preferred = initialFolder.lowercased()
        let folder = vm.listing.folders.first {
            let name = $0.name.lowercased()
            return name == preferred || scope.acceptedRootFolders.contains(name)
        }
        if let folder {
            await vm.load(workspaceId: workspaceId, root: root, folder: folder.path)
        }
    }

    private func createPreferredFolder() async {
        guard scope == .skills, vm.listing.folder.isEmpty else { return }
        let folder = initialFolder.isEmpty ? "skills" : initialFolder
        await vm.createFolder(name: folder, workspaceId: workspaceId, root: root)
        guard vm.error == nil else { return }
        await vm.load(workspaceId: workspaceId, root: root, folder: folder)
    }

    private func formatBytes(_ bytes: Int) -> String {
        let kb = Double(bytes) / 1024
        if kb < 1 { return "\(bytes) B" }
        if kb < 1024 { return String(format: "%.1f KB", kb) }
        return String(format: "%.1f MB", kb / 1024)
    }

    private func documentSyncLabel(_ state: String) -> String {
        switch state {
        case "applied": return "Applied"
        case "pending": return "Pending"
        case "drifted": return "Drift"
        case "blocked": return "Blocked"
        case "tombstoned": return "Removed"
        default: return state.replacingOccurrences(of: "_", with: " ").capitalized
        }
    }

    private func documentSyncColor(_ state: String) -> Color {
        switch state {
        case "applied": return .green
        case "pending": return .blue
        case "drifted": return .orange
        case "blocked": return .red
        default: return ClawColors.textSecondary
        }
    }
}

private struct EditableLibraryFile: Identifiable {
    let file: LibraryReadResult
    var id: String { "\(file.folder)/\(file.filename)" }
}

private struct LibraryFileEditorView: View {
    let file: LibraryReadResult
    @Binding var content: String
    let onSave: (String) -> Void
    let onExport: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var isEditing = false

    var body: some View {
        NavigationStack {
            Group {
                if isEditing {
                    TextEditor(text: $content)
                        .font(.system(.body, design: .monospaced))
                        .padding()
                        .scrollContentBackground(.hidden)
                } else {
                    ScrollView {
                        if isMarkdown {
                            ReadableMarkdownView(markdown: content)
                        } else {
                            Text(content)
                                .font(.system(.body, design: .monospaced))
                                .textSelection(.enabled)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                    .padding()
                }
            }
            .background(ClawColors.backgroundPrimary)
            .foregroundStyle(ClawColors.textPrimary)
            .navigationTitle(file.filename)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Done") { dismiss() } }
                ToolbarItemGroup(placement: .topBarTrailing) {
                    Button { onExport() } label: { Image(systemName: "square.and.arrow.up") }
                    Button(isEditing ? "Save" : "Edit") {
                        if isEditing { onSave(content) }
                        isEditing.toggle()
                    }
                }
            }
        }
    }

    private var isMarkdown: Bool {
        let ext = (file.filename as NSString).pathExtension.lowercased()
        return ext == "md" || ext == "markdown"
    }
}

private struct ShareSheetURLView: View {
    let url: URL
    var body: some View {
        ShareLink(item: url)
            .padding()
            .presentationDetents([.medium])
    }
}

extension URL: @retroactive Identifiable {
    public var id: String { absoluteString }
}
