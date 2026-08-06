import AppKit
import SwiftUI
import UniformTypeIdentifiers
import RelayConsoleCore

struct AgentKnowledgePanel: View {
    @EnvironmentObject var model: AppViewModel
    let agent: AgentWithBinding
    let section: RuntimeWorkspaceUserSection
    let navigationPanelsVisible: Bool

    @State private var groups: [RuntimeWorkspaceUserFileGroup] = []
    @State private var selectedItem: RuntimeWorkspaceUserFileItem?
    @State private var activeFolderItem: RuntimeWorkspaceUserFileItem?
    @State private var folderChildren: [RuntimeWorkspaceNode] = []
    @State private var fileDocument: RuntimeWorkspaceFileDocument?
    @State private var filename = "notes.md"
    @State private var markdown = ""
    @State private var baselines: [RuntimeWorkspaceBaseline] = []
    @State private var selectedBaselineId = ""
    @State private var baselineName = ""
    @State private var baselineMarkdown = ""
    @State private var editingBaselineId: RelayId?
    @State private var showBaselines = false
    @State private var linkedSummary = RuntimeWorkspaceLinkedLocalSummary.notLinked
    @State private var status: AgentKnowledgeNotice?
    @State private var busyAction: String?
    @State private var pendingDelete: RuntimeWorkspaceUserFileItem?
    @State private var knowledgeSelectorCollapsed = true
    @State private var markdownEditing = false

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            AgentKnowledgeHeader(
                agent: agent, navigationPanelsVisible: navigationPanelsVisible)

            if let status {
                AgentKnowledgeNoticeView(notice: status) {
                    reload()
                }
            }

            knowledgeSingleColumnLayout
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .onAppear {
            reload()
        }
        .onChange(of: agent.id) { _, _ in
            reset()
        }
        .alert("Delete item?", isPresented: Binding(get: { pendingDelete != nil }, set: { if !$0 { pendingDelete = nil } })) {
            Button("Delete", role: .destructive) {
                deletePending()
            }
            Button("Cancel", role: .cancel) {
                pendingDelete = nil
            }
        } message: {
            Text(deleteMessage)
        }
    }

    private var knowledgeSingleColumnLayout: some View {
        VStack(alignment: .leading, spacing: 14) {
            knowledgeSelector
            editorPane
                .frame(maxHeight: .infinity, alignment: .topLeading)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private var knowledgeSelector: some View {
        NativeGroupedSection {
            VStack(alignment: .leading, spacing: 10) {
                let items = knowledgeItems
                let dropdownItems = dropdownKnowledgeItems
                if items.isEmpty {
                    EmptyMiniLight(title: emptyKnowledgeTitle, body: emptyKnowledgeBody)
                } else {
                    if let activeKnowledgeItem {
                        AgentKnowledgeSelectorCard(
                            item: activeKnowledgeItem,
                            section: section,
                            groupTitle: groupTitle(for: activeKnowledgeItem),
                            selected: true,
                            disclosureSymbolName: dropdownItems.isEmpty ? nil : (knowledgeSelectorCollapsed ? "chevron.down" : "chevron.up"),
                            openAction: {
                                guard !dropdownItems.isEmpty else { return }
                                toggleKnowledgeSelector()
                            }
                        )
                    }

                    if !knowledgeSelectorCollapsed && !dropdownItems.isEmpty {
                        ScrollView {
                            LazyVStack(alignment: .leading, spacing: 8) {
                                ForEach(dropdownItems) { item in
                                    AgentKnowledgeSelectorCard(
                                        item: item,
                                        section: section,
                                        groupTitle: groupTitle(for: item),
                                        selected: isKnowledgeItemActive(item),
                                        openAction: { selectKnowledgeItemFromSelector(item) }
                                    )
                                }
                            }
                            .padding(.vertical, 1)
                        }
                        .frame(height: knowledgeListHeight(for: dropdownItems.count))
                    }
                }
            }
        }
    }

    private var editorPane: some View {
        NativeGroupedSection {
            VStack(alignment: .leading, spacing: 14) {
                actionToolbar
                if linkedSummary.permissionId != nil {
                    linkedLocalSyncCard
                }

                if showBaselines {
                    baselineManager
                }

                if selectedIsPNG {
                    Text("PNG files can be downloaded, but they are not editable as text.")
                        .font(.callout)
                        .foregroundStyle(RCTheme.muted)
                        .padding(12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(RCTheme.surfaceInset)
                        .clipShape(RoundedRectangle(cornerRadius: 4))
                } else {
                    markdownEditor
                        .frame(maxHeight: .infinity, alignment: .topLeading)
                }
            }
            .frame(maxHeight: .infinity, alignment: .topLeading)
        }
        .frame(maxHeight: .infinity, alignment: .topLeading)
    }

    private var actionToolbar: some View {
        AgentFileToolbar(
            leadingActions: leadingToolbarActions,
            trailingActions: trailingToolbarActions,
            iconOnly: true,
            colorized: true
        )
    }

    private var linkedLocalSyncCard: some View {
        NativeGroupedSection(title: "Linked local sync") {
            AgentKnowledgeMetadataRow(label: "Linked to:", value: linkedSummary.linkedTo)
            AgentKnowledgeMetadataRow(label: "Last synced:", value: linkedSummary.lastSyncedAt ?? "Never")
            AgentKnowledgeMetadataRow(label: "Last result:", value: linkedSummary.lastResult)
        }
    }

    private var markdownEditor: some View {
        VStack(alignment: .leading, spacing: 10) {
            if !markdownEditing {
                AgentKnowledgeMarkdownPreview(markdown: markdown)
                    .frame(maxHeight: .infinity, alignment: .topLeading)
            } else {
                rawMarkdownEditor
                    .frame(maxHeight: .infinity, alignment: .topLeading)
            }
        }
        .frame(maxHeight: .infinity, alignment: .topLeading)
    }

    private var rawMarkdownEditor: some View {
        VStack(alignment: .leading, spacing: 10) {
            if section != .skills {
                VStack(alignment: .leading, spacing: 5) {
                    Text("Filename")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(RCTheme.muted)
                    TextField(defaultFilename, text: $filename)
                        .textFieldStyle(.plain)
                        .rcTextFieldChrome(height: 38)
                        .frame(maxWidth: 360)
                        .disabled(selectedReadOnly)
                        .help("Filename")
                        .accessibilityLabel("Filename")
                }
            }
            VStack(alignment: .leading, spacing: 5) {
                if section != .skills {
                    Text("Contents")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(RCTheme.muted)
                }
                TextEditor(text: $markdown)
                    .font(.system(.body, design: .monospaced))
                    .frame(minHeight: 260, maxHeight: .infinity)
                    .disabled(selectedReadOnly)
                    .scrollContentBackground(.hidden)
                    .rcTextEditorChrome()
                    .help("Contents")
                    .accessibilityLabel("Contents")
            }
        }
        .frame(maxHeight: .infinity, alignment: .topLeading)
    }

    private var baselineManager: some View {
        NativeGroupedSection(title: "Baselines") {
            if baselines.isEmpty {
                Text("No baselines saved yet.")
                    .font(.callout)
                    .foregroundStyle(RCTheme.muted)
            } else {
                ForEach(baselines) { baseline in
                    HStack(spacing: 8) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(baseline.name)
                                .font(.callout.weight(.semibold))
                            Text(baseline.updatedAt)
                                .font(.caption2)
                                .foregroundStyle(RCTheme.muted)
                        }
                        Spacer()
                        Button("Apply") {
                            markdown = baseline.markdown
                            selectedBaselineId = baseline.id
                        }
                        .buttonStyle(PrimaryLightButtonStyle())
                        .disabled(selectedReadOnly)
                        Button("Edit") {
                            editingBaselineId = baseline.id
                            baselineName = baseline.name
                            baselineMarkdown = baseline.markdown
                        }
                        .buttonStyle(SecondaryLightButtonStyle())
                        Button("Delete") {
                            deleteBaseline(baseline)
                        }
                        .buttonStyle(SecondaryLightButtonStyle())
                    }
                }
            }

            Text(editingBaselineId == nil ? "New baseline" : "Edit baseline")
                .font(.subheadline.weight(.semibold))
                .padding(.top, 4)
            TextField("Baseline name", text: $baselineName)
                .textFieldStyle(.plain)
                .rcTextFieldChrome(height: 38)
            TextEditor(text: $baselineMarkdown)
                .font(.system(.body, design: .monospaced))
                .frame(minHeight: 120)
                .scrollContentBackground(.hidden)
                .rcTextEditorChrome()
            HStack {
                Button(editingBaselineId == nil ? "Save baseline" : "Update baseline") {
                    saveBaseline()
                }
                .buttonStyle(PrimaryLightButtonStyle())
                .disabled(baselineName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || baselineMarkdown.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                if editingBaselineId != nil {
                    Button("Cancel") {
                        editingBaselineId = nil
                        baselineName = ""
                        baselineMarkdown = ""
                    }
                    .buttonStyle(SecondaryLightButtonStyle())
                }
                Spacer()
            }
        }
    }

    private var selectedRootId: String {
        selectedItem?.rootId ?? defaultTarget?.rootId ?? ""
    }

    private var selectedRelativePath: String {
        selectedItem?.relativePath ?? defaultTarget?.relativePath ?? ""
    }

    private var selectedKind: RuntimeWorkspaceNodeKind {
        selectedItem?.kind ?? .folder
    }

    private var selectedReadOnly: Bool {
        selectedItem?.isReadOnly ?? false
    }

    private var selectedIsPNG: Bool {
        selectedItem?.isPNG ?? false
    }

    private var activeFolderRelativePath: String {
        selectedKind == .folder ? selectedRelativePath : parentPath(selectedRelativePath)
    }

    private var activeTargetKind: NativeFilePermissionTargetKind {
        selectedKind == .folder ? .folder : .file
    }

    private var canDeleteSelection: Bool {
        !selectedReadOnly && selectedItem != nil && !selectedRelativePath.isEmpty
    }

    private var canShowFileTargetActions: Bool {
        !selectedRootId.isEmpty && !selectedReadOnly
    }

    private var leadingToolbarActions: [AgentFileToolbarAction] {
        var actions: [AgentFileToolbarAction] = []
        if canShowFileTargetActions {
            actions.append(
                AgentFileToolbarAction(kind: .new, isDisabled: busyAction != nil) {
                    beginNewMarkdown()
                }
            )
            actions.append(
                AgentFileToolbarAction(kind: .upload, isDisabled: busyAction != nil) {
                    uploadForSection()
                }
            )
        }
        if selectedKind == .file, !selectedRootId.isEmpty {
            actions.append(
                AgentFileToolbarAction(kind: .download) {
                    downloadSelectedFile()
                }
            )
        }
        if !selectedRootId.isEmpty {
            actions.append(
                AgentFileToolbarAction(kind: .link, isDisabled: busyAction != nil) {
                    changeLinkedTarget()
                }
            )
        }
        if selectedKind == .file, !selectedIsPNG {
            actions.append(
                AgentFileToolbarAction(kind: .edit, isDisabled: selectedReadOnly || busyAction != nil, isActive: markdownEditing) {
                    markdownEditing = true
                }
            )
        }
        if linkedSummary.permissionId != nil {
            actions.append(
                AgentFileToolbarAction(kind: .pull, isDisabled: busyAction != nil) {
                    syncLocal(direction: .fromLocal)
                }
            )
            actions.append(
                AgentFileToolbarAction(kind: .push, isDisabled: busyAction != nil) {
                    syncLocal(direction: .toLocal)
                }
            )
        }
        return actions
    }

    private var trailingToolbarActions: [AgentFileToolbarAction] {
        var actions: [AgentFileToolbarAction] = []
        if markdownEditing {
            actions.append(
                AgentFileToolbarAction(kind: .save, isDisabled: !canSaveMarkdown) {
                    saveMarkdown()
                }
            )
        }
        actions.append(
            AgentFileToolbarAction(kind: .baselines, isActive: showBaselines) {
                showBaselines.toggle()
            }
        )
        if canDeleteSelection {
            actions.append(
                AgentFileToolbarAction(kind: .delete, isDisabled: busyAction == "delete") {
                    if let selectedItem {
                        pendingDelete = selectedItem
                    }
                }
            )
        }
        return actions
    }

    private var canSaveMarkdown: Bool {
        !selectedReadOnly
            && !selectedRootId.isEmpty
            && !saveFilename.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && !markdown.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && busyAction == nil
            && !selectedIsPNG
    }

    private var defaultFilename: String {
        switch section {
        case .instructions:
            return "AGENTS.md"
        case .memory:
            return "MEMORY.md"
        case .skills:
            return "SKILL.md"
        }
    }

    private var saveFilename: String {
        if section == .skills {
            return fileDocument?.filename ?? defaultFilename
        }
        return filename
    }

    private var defaultMarkdown: String {
        switch section {
        case .instructions:
            return "# Agent Instructions\n"
        case .memory:
            return "# Memory\n"
        case .skills:
            return "# Skill\n\nDescribe when and how this skill should be used.\n"
        }
    }

    private var defaultTarget: (rootId: String, relativePath: String)? {
        model.services?.runtimeWorkspace.defaultTarget(for: agent, section: section)
    }

    private var knowledgeItems: [RuntimeWorkspaceUserFileItem] {
        groups.flatMap(\.items)
    }

    private var activeKnowledgeItem: RuntimeWorkspaceUserFileItem? {
        if section == .skills {
            return knowledgeItems.first(where: isSkillActive) ?? knowledgeItems.first
        }
        return selectedItem ?? knowledgeItems.first
    }

    private var dropdownKnowledgeItems: [RuntimeWorkspaceUserFileItem] {
        guard let activeKnowledgeItem else {
            return knowledgeItems
        }
        return knowledgeItems.filter { !sameLocation($0, activeKnowledgeItem) }
    }

    private var emptyKnowledgeTitle: String {
        switch section {
        case .instructions:
            return "No agent instructions"
        case .memory:
            return "No agent memory"
        case .skills:
            return "No installed skills"
        }
    }

    private var emptyKnowledgeBody: String {
        if agent.binding.adapterKind == "railway_cloud" {
            return "Relay has not synced this agent's files to this Mac. Open Settings > Relay, sign in if requested, then run Sync now."
        }
        switch section {
        case .instructions:
            return "Create or upload an instruction file to give this agent project guidance."
        case .memory:
            return "Create or upload a memory file to keep useful context available between sessions."
        case .skills:
            return "Install or upload a skill to make it available to this agent."
        }
    }

    private var deleteMessage: String {
        guard let pendingDelete else { return "" }
        if pendingDelete.kind == .folder {
            return "Delete \(pendingDelete.title)? All files inside will be permanently removed."
        }
        return "Delete \(pendingDelete.title)? This cannot be undone."
    }

    private func reset() {
        groups = []
        selectedItem = nil
        activeFolderItem = nil
        folderChildren = []
        fileDocument = nil
        filename = defaultFilename
        markdown = ""
        baselines = []
        selectedBaselineId = ""
        linkedSummary = .notLinked
        status = nil
        knowledgeSelectorCollapsed = true
        markdownEditing = false
        reload()
    }

    private func reload() {
        guard let service = model.services?.runtimeWorkspace else {
            status = AgentKnowledgeNotice(kind: .error, text: "Runtime workspace service is unavailable.")
            return
        }
        let priorSelectedItem = selectedItem
        let priorActiveFolderItem = activeFolderItem
        groups = service.userFileGroups(for: agent, section: section)
        loadBaselines()

        if section == .skills {
            reloadSkillsSelection(priorSelectedItem: priorSelectedItem, priorActiveFolderItem: priorActiveFolderItem)
            return
        }

        if let selectedItem,
           groups.flatMap(\.items).contains(where: { sameLocation($0, selectedItem) }) {
            select(selectedItem)
        } else if let first = groups.flatMap(\.items).first {
            select(first)
        } else {
            selectedItem = nil
            activeFolderItem = nil
            folderChildren = []
            fileDocument = nil
            filename = defaultFilename
            markdown = ""
            loadLinkedSummary()
        }
    }

    private func reloadSkillsSelection(
        priorSelectedItem: RuntimeWorkspaceUserFileItem?,
        priorActiveFolderItem: RuntimeWorkspaceUserFileItem?
    ) {
        let skills = groups.flatMap(\.items)
        guard !skills.isEmpty else {
            selectedItem = nil
            activeFolderItem = nil
            folderChildren = []
            fileDocument = nil
            filename = defaultFilename
            markdown = ""
            loadLinkedSummary()
            return
        }

        let activeSkill = priorActiveFolderItem.flatMap { prior in
            skills.first { sameLocation($0, prior) }
        } ?? priorSelectedItem.flatMap { prior in
            skills.first { prior.relativePath.hasPrefix($0.relativePath + "/") }
        } ?? skills.first

        guard let activeSkill else { return }
        activeFolderItem = activeSkill
        loadFolderChildren(activeSkill)

        if let priorSelectedItem,
           priorSelectedItem.kind == .file,
           priorSelectedItem.relativePath.hasPrefix(activeSkill.relativePath + "/") {
            select(priorSelectedItem, preserveActiveFolder: true)
        } else {
            openSkill(activeSkill)
        }
    }

    private func select(_ item: RuntimeWorkspaceUserFileItem, preserveActiveFolder: Bool = false) {
        selectedItem = item
        markdownEditing = false
        selectedBaselineId = ""
        status = nil
        loadLinkedSummary()
        if item.kind == .folder {
            fileDocument = nil
            filename = defaultFilename
            markdown = ""
            if !preserveActiveFolder {
                activeFolderItem = item
                loadFolderChildren(item)
            }
            if section != .skills, let firstChild = defaultFolderChildItem(parent: item) {
                select(firstChild, preserveActiveFolder: true)
            }
            return
        }
        if !preserveActiveFolder {
            if let activeFolderItem,
               item.relativePath.hasPrefix(activeFolderItem.relativePath + "/") {
                loadFolderChildren(activeFolderItem)
            } else {
                activeFolderItem = nil
                folderChildren = []
            }
        }
        filename = item.title
        if item.isPNG {
            fileDocument = nil
            markdown = ""
            return
        }
        guard item.isEditableText, let service = model.services?.runtimeWorkspace else {
            fileDocument = nil
            markdown = ""
            status = AgentKnowledgeNotice(kind: .info, text: "\(item.title) is visible here but is not editable as text.")
            return
        }
        do {
            let document = try service.readFile(agent: agent, rootId: item.rootId, relativePath: item.relativePath)
            fileDocument = document
            filename = document.filename
            markdown = document.markdown
        } catch {
            status = AgentKnowledgeNotice(kind: .error, text: error.localizedDescription)
        }
    }

    private func sameLocation(_ lhs: RuntimeWorkspaceUserFileItem, _ rhs: RuntimeWorkspaceUserFileItem) -> Bool {
        lhs.rootId == rhs.rootId && lhs.relativePath == rhs.relativePath
    }

    private func isSkillActive(_ item: RuntimeWorkspaceUserFileItem) -> Bool {
        if let activeFolderItem, sameLocation(activeFolderItem, item) {
            return true
        }
        guard let selectedItem else { return false }
        return selectedItem.rootId == item.rootId && selectedItem.relativePath.hasPrefix(item.relativePath + "/")
    }

    private func isKnowledgeItemActive(_ item: RuntimeWorkspaceUserFileItem) -> Bool {
        if section == .skills {
            return isSkillActive(item)
        }
        guard let selectedItem else { return false }
        return sameLocation(selectedItem, item)
    }

    private func groupTitle(for item: RuntimeWorkspaceUserFileItem) -> String? {
        if let group = groups.first(where: { group in
            group.items.contains { sameLocation($0, item) }
        }) {
            return group.title
        }
        guard let activeFolderItem else { return nil }
        return groups.first { group in
            group.items.contains { sameLocation($0, activeFolderItem) }
        }?.title
    }

    private func toggleKnowledgeSelector() {
        withAnimation(.easeInOut(duration: 0.16)) {
            knowledgeSelectorCollapsed.toggle()
        }
    }

    private func selectKnowledgeItemFromSelector(_ item: RuntimeWorkspaceUserFileItem) {
        if section == .skills {
            openSkill(item)
        } else {
            select(item)
        }
        withAnimation(.easeInOut(duration: 0.16)) {
            knowledgeSelectorCollapsed = true
        }
    }

    private func knowledgeListHeight(for count: Int) -> CGFloat {
        CGFloat(min(max(count, 1), 5)) * 74
    }

    private func loadFolderChildren(_ item: RuntimeWorkspaceUserFileItem) {
        guard let service = model.services?.runtimeWorkspace else { return }
        do {
            folderChildren = try service.listChildren(agent: agent, rootId: item.rootId, relativePath: item.relativePath)
                .filter(childIsUserFacing)
        } catch {
            folderChildren = []
            status = AgentKnowledgeNotice(kind: .error, text: error.localizedDescription)
        }
    }

    private func defaultFolderChildItem(parent: RuntimeWorkspaceUserFileItem) -> RuntimeWorkspaceUserFileItem? {
        let child = folderChildren.first { $0.kind == .file && $0.isEditableText }
            ?? folderChildren.first { $0.kind == .file && $0.isPNG }
            ?? folderChildren.first { $0.kind == .file }
        guard let child else { return nil }
        return childItem(child, parent: parent)
    }

    private func childItem(_ node: RuntimeWorkspaceNode, parent: RuntimeWorkspaceUserFileItem? = nil) -> RuntimeWorkspaceUserFileItem {
        let container = parent ?? activeFolderItem ?? selectedItem
        return RuntimeWorkspaceUserFileItem(
            id: "child:\(node.rootId):\(node.relativePath)",
            title: node.name,
            subtitle: container.map { "\($0.rootLabel)/\(node.relativePath)" } ?? node.relativePath,
            rootId: node.rootId,
            rootLabel: container?.rootLabel ?? "workspace",
            relativePath: node.relativePath,
            kind: node.kind,
            isReadOnly: node.isReadOnly,
            isPNG: node.isPNG,
            isEditableText: node.isEditableText,
            byteCount: node.byteCount,
            updatedAt: node.updatedAt,
            runtimeSource: runtimeLabel(agent.binding.runtimeType)
        )
    }

    private func childIsUserFacing(_ node: RuntimeWorkspaceNode) -> Bool {
        let name = node.name.lowercased()
        guard !internalRuntimeNames.contains(name),
              !name.hasSuffix(".db"),
              !name.hasSuffix(".sqlite"),
              !name.hasSuffix(".sqlite3"),
              !name.hasSuffix("-wal"),
              !name.hasSuffix("-shm") else {
            return false
        }
        switch section {
        case .instructions:
            return instructionNames.contains(name)
        case .memory:
            return node.kind == .folder || node.isEditableText || node.isPNG || name.hasSuffix(".json")
        case .skills:
            return node.kind == .folder || node.isEditableText || name.hasSuffix(".json")
        }
    }

    private func beginNewMarkdown() {
        guard !selectedReadOnly else { return }
        fileDocument = nil
        filename = defaultFilename
        markdown = defaultMarkdown
        markdownEditing = true
        status = nil
    }

    private func saveMarkdown() {
        guard let service = model.services?.runtimeWorkspace else { return }
        busyAction = "save-markdown"
        do {
            let document = try service.saveMarkdown(
                agent: agent,
                rootId: selectedRootId,
                folderRelativePath: activeFolderRelativePath,
                filename: saveFilename,
                markdown: markdown
            )
            busyAction = nil
            status = AgentKnowledgeNotice(kind: .success, text: "Saved \(document.filename).")
            markdownEditing = false
            reload()
            select(
                RuntimeWorkspaceUserFileItem(
                    id: "saved:\(document.rootId):\(document.relativePath)",
                    title: document.filename,
                    subtitle: document.relativePath,
                    rootId: document.rootId,
                    rootLabel: selectedItem?.rootLabel ?? selectedRootId,
                    relativePath: document.relativePath,
                    kind: .file,
                    isReadOnly: false,
                    isEditableText: true,
                    byteCount: document.byteCount,
                    updatedAt: document.updatedAt,
                    runtimeSource: runtimeLabel(agent.binding.runtimeType)
                )
            )
        } catch {
            busyAction = nil
            status = AgentKnowledgeNotice(kind: .error, text: error.localizedDescription)
        }
    }

    private func uploadForSection() {
        uploadFile(allowedKinds: section == .memory ? [.markdown, .png] : [.markdown])
    }

    private func uploadFile(allowedKinds: [RuntimeWorkspaceFileImportKind]) {
        guard let service = model.services?.runtimeWorkspace else { return }
        let panel = NSOpenPanel()
        panel.canChooseDirectories = false
        panel.canChooseFiles = true
        panel.allowsMultipleSelection = false
        panel.allowedContentTypes = allowedKinds.flatMap { $0 == .png ? [.png] : markdownContentTypes }
        let response = panel.runModal()
        guard response == .OK, let url = panel.url else { return }
        let kind = importKind(for: url, allowedKinds: allowedKinds)
        let accessed = url.startAccessingSecurityScopedResource()
        defer {
            if accessed { url.stopAccessingSecurityScopedResource() }
        }
        busyAction = kind == .png ? "upload-png" : "upload-markdown"
        do {
            let node = try service.importFile(
                agent: agent,
                rootId: selectedRootId,
                folderRelativePath: activeFolderRelativePath,
                sourceURL: url,
                kind: kind
            )
            busyAction = nil
            status = AgentKnowledgeNotice(kind: .success, text: "Uploaded \(node.name).")
            reload()
            select(childItem(node))
        } catch {
            busyAction = nil
            status = AgentKnowledgeNotice(kind: .error, text: error.localizedDescription)
        }
    }

    private func importKind(for url: URL, allowedKinds: [RuntimeWorkspaceFileImportKind]) -> RuntimeWorkspaceFileImportKind {
        if url.pathExtension.lowercased() == "png", allowedKinds.contains(.png) {
            return .png
        }
        return .markdown
    }

    private func downloadSelectedFile() {
        guard selectedKind == .file, let service = model.services?.runtimeWorkspace else { return }
        do {
            let export = try service.exportFile(agent: agent, rootId: selectedRootId, relativePath: selectedRelativePath)
            let panel = NSSavePanel()
            panel.nameFieldStringValue = export.filename
            panel.canCreateDirectories = true
            let response = panel.runModal()
            guard response == .OK, let destination = panel.url else { return }
            try export.data.write(to: destination, options: .atomic)
            status = AgentKnowledgeNotice(kind: .success, text: "Downloaded \(export.filename).")
        } catch {
            status = AgentKnowledgeNotice(kind: .error, text: error.localizedDescription)
        }
    }

    private func deletePending() {
        guard let pendingDelete, let service = model.services?.runtimeWorkspace else { return }
        busyAction = "delete"
        do {
            _ = try service.deleteNode(agent: agent, rootId: pendingDelete.rootId, relativePath: pendingDelete.relativePath)
            self.pendingDelete = nil
            busyAction = nil
            status = AgentKnowledgeNotice(kind: .success, text: "Deleted \(pendingDelete.title).")
            selectedItem = nil
            reload()
        } catch {
            self.pendingDelete = nil
            busyAction = nil
            status = AgentKnowledgeNotice(kind: .error, text: error.localizedDescription)
        }
    }

    private func changeLinkedTarget() {
        guard let service = model.services?.runtimeWorkspace,
              let workspace = model.workspace else {
            status = AgentKnowledgeNotice(kind: .error, text: "Workspace unavailable.")
            return
        }
        let panel = NSOpenPanel()
        panel.canChooseDirectories = activeTargetKind == .folder
        panel.canChooseFiles = activeTargetKind == .file
        panel.allowsMultipleSelection = false
        panel.prompt = activeTargetKind == .folder ? "Choose folder" : "Choose file"
        let response = panel.runModal()
        guard response == .OK, let url = panel.url else { return }
        let accessed = url.startAccessingSecurityScopedResource()
        defer {
            if accessed { url.stopAccessingSecurityScopedResource() }
        }
        busyAction = "link"
        do {
            let bookmarkData = try url.bookmarkData(options: [.withSecurityScope], includingResourceValuesForKeys: nil, relativeTo: nil)
            _ = try service.linkLocalTarget(
                context: model.chatContext(workspaceId: workspace.id),
                agent: agent,
                rootId: selectedRootId,
                relativePath: selectedRelativePath,
                targetKind: activeTargetKind,
                displayName: url.lastPathComponent,
                rawPath: url.path,
                bookmarkRef: bookmarkData.base64EncodedString()
            )
            busyAction = nil
            loadLinkedSummary()
            status = AgentKnowledgeNotice(kind: .success, text: activeTargetKind == .folder ? "Linked local folder." : "Linked local file.")
        } catch {
            busyAction = nil
            status = AgentKnowledgeNotice(kind: .error, text: error.localizedDescription)
        }
    }

    private func syncLocal(direction: RuntimeWorkspaceSyncDirection) {
        guard let service = model.services?.runtimeWorkspace,
              let workspace = model.workspace else { return }
        busyAction = direction == .fromLocal ? "sync-from" : "sync-to"
        do {
            switch direction {
            case .fromLocal:
                _ = try service.syncFromLocal(
                    context: model.chatContext(workspaceId: workspace.id),
                    agent: agent,
                    rootId: selectedRootId,
                    relativePath: selectedRelativePath,
                    targetKind: activeTargetKind
                )
            case .toLocal:
                _ = try service.syncToLocal(
                    context: model.chatContext(workspaceId: workspace.id),
                    agent: agent,
                    rootId: selectedRootId,
                    relativePath: selectedRelativePath,
                    targetKind: activeTargetKind
                )
            }
            busyAction = nil
            loadLinkedSummary()
            status = AgentKnowledgeNotice(kind: .warning, text: "Linked local sync is guarded until persisted security-scoped bookmark resolution is enabled.")
        } catch {
            busyAction = nil
            loadLinkedSummary()
            status = AgentKnowledgeNotice(kind: .error, text: error.localizedDescription)
        }
    }

    private func loadLinkedSummary() {
        guard let service = model.services?.runtimeWorkspace,
              let workspace = model.workspace,
              !selectedRootId.isEmpty else {
            linkedSummary = .notLinked
            return
        }
        do {
            linkedSummary = try service.linkedLocalSummary(
                context: model.chatContext(workspaceId: workspace.id),
                agent: agent,
                rootId: selectedRootId,
                relativePath: selectedRelativePath,
                targetKind: activeTargetKind
            )
        } catch {
            linkedSummary = .notLinked
        }
    }

    private func loadBaselines() {
        do {
            baselines = try model.services?.runtimeWorkspace.listBaselines(agentId: agent.id) ?? []
            if !baselines.contains(where: { $0.id == selectedBaselineId }) {
                selectedBaselineId = ""
            }
        } catch {
            status = AgentKnowledgeNotice(kind: .error, text: error.localizedDescription)
        }
    }

    private func saveBaseline() {
        do {
            _ = try model.services?.runtimeWorkspace.saveBaseline(
                agentId: agent.id,
                baselineId: editingBaselineId,
                name: baselineName,
                markdown: baselineMarkdown
            )
            editingBaselineId = nil
            baselineName = ""
            baselineMarkdown = ""
            loadBaselines()
            status = AgentKnowledgeNotice(kind: .success, text: "Saved baseline.")
        } catch {
            status = AgentKnowledgeNotice(kind: .error, text: error.localizedDescription)
        }
    }

    private func deleteBaseline(_ baseline: RuntimeWorkspaceBaseline) {
        do {
            try model.services?.runtimeWorkspace.deleteBaseline(agentId: agent.id, baselineId: baseline.id)
            if selectedBaselineId == baseline.id {
                selectedBaselineId = ""
            }
            loadBaselines()
        } catch {
            status = AgentKnowledgeNotice(kind: .error, text: error.localizedDescription)
        }
    }

    private func openSkill(_ item: RuntimeWorkspaceUserFileItem) {
        activeFolderItem = item
        loadFolderChildren(item)
        guard let skillFile = skillMainFileItem(item) else {
            select(item)
            return
        }
        select(skillFile, preserveActiveFolder: true)
    }

    private func skillMainFileItem(_ item: RuntimeWorkspaceUserFileItem) -> RuntimeWorkspaceUserFileItem? {
        guard let mainFile = item.mainFileRelativePath else {
            return nil
        }
        return RuntimeWorkspaceUserFileItem(
            id: "skill-main:\(item.rootId):\(mainFile)",
            title: "SKILL.md",
            subtitle: "\(item.rootLabel)/\(mainFile)",
            rootId: item.rootId,
            rootLabel: item.rootLabel,
            relativePath: mainFile,
            kind: .file,
            isReadOnly: item.isReadOnly,
            isEditableText: true,
            runtimeSource: item.runtimeSource
        )
    }

    private func exportSkillMainFile(_ item: RuntimeWorkspaceUserFileItem) {
        guard let mainFile = item.mainFileRelativePath,
              let service = model.services?.runtimeWorkspace else {
            select(item)
            return
        }
        do {
            let export = try service.exportFile(agent: agent, rootId: item.rootId, relativePath: mainFile)
            let panel = NSSavePanel()
            panel.nameFieldStringValue = export.filename
            panel.canCreateDirectories = true
            let response = panel.runModal()
            guard response == .OK, let destination = panel.url else { return }
            try export.data.write(to: destination, options: .atomic)
            status = AgentKnowledgeNotice(kind: .success, text: "Downloaded \(export.filename).")
        } catch {
            status = AgentKnowledgeNotice(kind: .error, text: error.localizedDescription)
        }
    }

    private func parentPath(_ relativePath: String) -> String {
        let parts = relativePath.split(separator: "/").map(String.init)
        guard parts.count > 1 else { return "" }
        return parts.dropLast().joined(separator: "/")
    }

    private var markdownContentTypes: [UTType] {
        [
            UTType(filenameExtension: "md"),
            UTType(filenameExtension: "markdown"),
            UTType(filenameExtension: "yaml"),
            UTType(filenameExtension: "yml"),
            UTType(filenameExtension: "env"),
            UTType(filenameExtension: "cursorrules"),
            .plainText
        ].compactMap { $0 }
    }

    private var instructionNames: Set<String> {
        ["soul.md", "identity.md", "user.md", "agents.md", "tools.md", "heartbeat.md", ".hermes.md", "hermes.md", "claude.md", ".cursorrules"]
    }

    private var internalRuntimeNames: Set<String> {
        ["audio_cache", "image_cache", "cache", "caches", "bin", "hooks", "logs", "pairing", "sessions", "skins", "state.db", "profile.yaml", "config.yaml", "openclaw-agent.sqlite", "openclaw-agent.sqlite-wal", "openclaw-agent.sqlite-shm", "auth-profiles.json"]
    }
}

private enum RuntimeWorkspaceSyncDirection {
    case fromLocal
    case toLocal
}

private struct AgentKnowledgeNotice: Identifiable {
    enum Kind {
        case info
        case success
        case warning
        case error
    }

    let id = UUID()
    var kind: Kind
    var text: String
}

private struct AgentKnowledgeHeader: View {
    @EnvironmentObject var model: AppViewModel
    let agent: AgentWithBinding
    let navigationPanelsVisible: Bool

    var body: some View {
        HStack(alignment: .center, spacing: 10) {
            AgentAvatarView(name: model.resolveAgentDisplayName(agent), avatarURL: model.agentAvatar(agent.id), size: 22)
            HStack(spacing: 8) {
                Text(model.resolveAgentDisplayName(agent))
                    .font(.system(size: 13, weight: .semibold))
                    .lineLimit(1)
                    .truncationMode(.tail)
                    .layoutPriority(1)
                StatusBadge(title: runtimeLabel(agent.binding.runtimeType), tone: .blue, accessibilityLabelText: "Runtime \(runtimeLabel(agent.binding.runtimeType))")
                StatusBadge(title: effectiveAgentGroup(agent).rawValue, tone: .green, accessibilityLabelText: "Agent group \(effectiveAgentGroup(agent).rawValue)")
            }
            Spacer()
            HStack(spacing: 6) {
                Button {
                    model.startDirectChat(agent)
                } label: {
                    HeaderIconControl(symbolName: "bubble.left.and.bubble.right")
                }
                .buttonStyle(.plain)
                .help("Open Direct Chat")
                .accessibilityLabel("Open Direct Chat")
            }
        }
        .padding(.bottom, RCChromeMetrics.topHeaderContentBottomPadding)
        .frame(height: RCChromeMetrics.topReservedHeight, alignment: .bottom)
        .padding(.leading, navigationPanelsVisible ? 0 : 44)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RCTheme.page)
    }
}

private struct AgentKnowledgeSelectorCard: View {
    let item: RuntimeWorkspaceUserFileItem
    let section: RuntimeWorkspaceUserSection
    let groupTitle: String?
    let selected: Bool
    var disclosureSymbolName: String? = nil
    let openAction: () -> Void

    var body: some View {
        Button(action: openAction) {
            HStack(alignment: .top, spacing: 10) {
                Image(systemName: iconName)
                    .frame(width: 28, height: 28)
                    .foregroundStyle(accentColor)
                    .background(accentColor.opacity(0.12))
                    .clipShape(RoundedRectangle(cornerRadius: 4))
                VStack(alignment: .leading, spacing: 3) {
                    Text(item.title)
                        .font(.callout.weight(.semibold))
                        .lineLimit(1)
                    Text(item.subtitle)
                        .font(.caption2)
                        .foregroundStyle(RCTheme.muted)
                        .lineLimit(1)
                        .truncationMode(.middle)
                }
                .layoutPriority(1)
                Spacer()
                StatusBadge(title: statusTitle, tone: statusTone, accessibilityLabelText: "\(section.title) item status \(statusTitle)")
                if let disclosureSymbolName {
                    Image(systemName: disclosureSymbolName)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(RCTheme.text)
                        .frame(width: 24, height: 24)
                        .background(RCTheme.surfaceLevel1.opacity(0.72))
                        .clipShape(RoundedRectangle(cornerRadius: 4))
                        .overlay(RoundedRectangle(cornerRadius: 4).stroke(RCTheme.borderLow))
                        .accessibilityHidden(true)
                }
            }
            .padding(10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(selected ? RCTheme.sidebarSelected : RCTheme.surfaceInset)
            .clipShape(RoundedRectangle(cornerRadius: 4))
            .overlay(RoundedRectangle(cornerRadius: 4).stroke(selected ? RCTheme.borderStrong : RCTheme.borderSoft))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Open \(item.title)")
    }

    private var iconName: String {
        if item.kind == .folder, section != .skills {
            return "folder"
        }
        switch section {
        case .instructions:
            return "doc.text"
        case .memory:
            return "tray.full"
        case .skills:
            return "puzzlepiece.extension"
        }
    }

    private var accentColor: Color {
        switch section {
        case .instructions:
            return RCTheme.accentBlue
        case .memory:
            return RCTheme.accentGreen
        case .skills:
            return RCTheme.accentPurple
        }
    }

    private var statusTitle: String {
        if item.isReadOnly {
            return "Read-only"
        }
        if section == .skills {
            return item.status ?? "Installed"
        }
        return groupTitle ?? (item.kind == .folder ? "Folder" : "File")
    }

    private var statusTone: ComponentTone {
        if item.isReadOnly {
            return .amber
        }
        switch section {
        case .instructions:
            return .blue
        case .memory:
            return .green
        case .skills:
            return .green
        }
    }
}

struct AgentKnowledgeMarkdownPreview: View {
    let markdown: String

    private var document: AgentKnowledgeMarkdownDocument {
        AgentKnowledgeMarkdownDocument(markdown: markdown)
    }

    var body: some View {
        RelayMarkdownDocumentSurface(markdown: document.body, metadata: document.metadata)
        .frame(minHeight: 420, maxHeight: .infinity)
        .accessibilityLabel("Rendered markdown")
    }

    private var metadataCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            ForEach(document.metadata, id: \.key) { item in
                VStack(alignment: .leading, spacing: 4) {
                    Text(item.key)
                        .font(.caption.weight(.bold))
                        .foregroundStyle(RCTheme.accentPurple)
                        .textCase(.uppercase)
                    inlineText(item.value)
                        .font(item.key.lowercased() == "name" ? .title3.weight(.semibold) : .callout)
                        .foregroundStyle(RCTheme.text)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RCTheme.accentPurple.opacity(0.10))
        .clipShape(RoundedRectangle(cornerRadius: 6))
        .overlay(RoundedRectangle(cornerRadius: 6).stroke(RCTheme.accentPurple.opacity(0.28)))
    }

    private func inlineText(_ source: String) -> Text {
        let options = AttributedString.MarkdownParsingOptions(interpretedSyntax: .inlineOnlyPreservingWhitespace)
        guard let attributed = try? AttributedString(markdown: source, options: options) else {
            return Text(source)
        }
        return Text(attributed)
    }
}

private struct AgentKnowledgeMarkdownDocument {
    var metadata: [(key: String, value: String)]
    var body: String

    init(markdown: String) {
        let parsed = Self.parseFrontMatter(markdown)
        metadata = parsed.metadata
        body = Self.normalizedSectionSignSeparators(parsed.body)
    }

    private static func parseFrontMatter(_ markdown: String) -> (metadata: [(key: String, value: String)], body: String) {
        let normalized = markdown.replacingOccurrences(of: "\r\n", with: "\n")
            .replacingOccurrences(of: "\r", with: "\n")
        let lines = normalized.split(separator: "\n", omittingEmptySubsequences: false).map(String.init)
        guard lines.first?.trimmingCharacters(in: .whitespaces) == "---" else {
            return ([], normalized)
        }
        var metadata: [(key: String, value: String)] = []
        var endIndex: Int?
        for index in lines.indices.dropFirst() {
            let line = lines[index]
            if line.trimmingCharacters(in: .whitespaces) == "---" {
                endIndex = index
                break
            }
            guard let separator = line.firstIndex(of: ":") else { continue }
            let key = String(line[..<separator]).trimmingCharacters(in: .whitespacesAndNewlines)
            let value = String(line[line.index(after: separator)...]).trimmingCharacters(in: .whitespacesAndNewlines)
            if !key.isEmpty, !value.isEmpty {
                metadata.append((key, value))
            }
        }
        guard let endIndex else {
            return (metadata, normalized)
        }
        let bodyStart = min(endIndex + 1, lines.count)
        return (metadata, lines.dropFirst(bodyStart).joined(separator: "\n"))
    }

    private static func normalizedSectionSignSeparators(_ markdown: String) -> String {
        guard markdown.contains("§") else { return markdown }
        return markdown
            .split(separator: "§", omittingEmptySubsequences: false)
            .map { String($0).trimmingCharacters(in: .whitespacesAndNewlines) }
            .joined(separator: "\n\n")
    }
}

private struct AgentKnowledgeSectionCard<Content: View>: View {
    let title: String
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 9) {
            Text(title)
                .font(.subheadline.weight(.semibold))
            content
        }
        .padding(12)
        .background(RCTheme.surfaceInset)
        .clipShape(RoundedRectangle(cornerRadius: 4))
        .overlay(RoundedRectangle(cornerRadius: 4).stroke(RCTheme.borderSoft))
    }
}

private struct AgentKnowledgeMetadataRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text(label)
                .font(.caption.weight(.semibold))
                .foregroundStyle(RCTheme.muted)
                .frame(width: 88, alignment: .leading)
            Text(value)
                .font(.caption)
                .lineLimit(2)
                .truncationMode(.middle)
            Spacer(minLength: 0)
        }
    }
}

private struct AgentKnowledgeNoticeView: View {
    let notice: AgentKnowledgeNotice
    let retry: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: icon)
                .foregroundStyle(color)
            Text(notice.text)
                .font(.callout)
                .foregroundStyle(RCTheme.text)
                .fixedSize(horizontal: false, vertical: true)
            Spacer()
            if notice.kind == .error {
                Button("Retry", action: retry)
                    .buttonStyle(SecondaryLightButtonStyle())
            }
        }
        .padding(12)
        .background(color.opacity(0.10))
        .clipShape(RoundedRectangle(cornerRadius: 4))
        .overlay(RoundedRectangle(cornerRadius: 4).stroke(color.opacity(0.28)))
    }

    private var icon: String {
        switch notice.kind {
        case .info:
            return "info.circle"
        case .success:
            return "checkmark.circle"
        case .warning:
            return "exclamationmark.triangle"
        case .error:
            return "xmark.octagon"
        }
    }

    private var color: Color {
        switch notice.kind {
        case .info:
            return RCTheme.accentBlue
        case .success:
            return RCTheme.accentGreen
        case .warning:
            return RCTheme.accentAmber
        case .error:
            return RCTheme.accentRed
        }
    }
}
