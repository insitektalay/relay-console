import AppKit
import Foundation
import SwiftUI
import UniformTypeIdentifiers
import RelayConsoleCore

struct AgentRuntimeWorkspacePanel: View {
    @EnvironmentObject var model: AppViewModel
    let agent: AgentWithBinding

    @State private var snapshot: RuntimeWorkspaceSnapshot?
    @State private var expandedKeys: Set<String> = []
    @State private var loadingKeys: Set<String> = []
    @State private var childrenByKey: [String: [RuntimeWorkspaceNode]] = [:]
    @State private var selectedRootId = ""
    @State private var selectedRelativePath = ""
    @State private var selectedKind: RuntimeWorkspaceNodeKind = .folder
    @State private var selectedReadOnly = false
    @State private var selectedIsPNG = false
    @State private var fileDocument: RuntimeWorkspaceFileDocument?
    @State private var filename = "notes.md"
    @State private var markdown = ""
    @State private var subfolderDraft = ""
    @State private var selectedBaselineId = ""
    @State private var baselines: [RuntimeWorkspaceBaseline] = []
    @State private var showBaselines = false
    @State private var baselineName = ""
    @State private var baselineMarkdown = ""
    @State private var editingBaselineId: RelayId?
    @State private var linkedSummary = RuntimeWorkspaceLinkedLocalSummary.notLinked
    @State private var status: RuntimeWorkspaceNotice?
    @State private var busyAction: String?
    @State private var fileLoading = false
    @State private var pendingDelete: RuntimeWorkspaceDeleteTarget?

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 3) {
                    Text("Runtime workspace")
                        .font(.headline)
                    Text("OpenClaw and Hermes runtime files for this agent.")
                        .font(.caption)
                        .foregroundStyle(RCTheme.muted)
                }
                Spacer()
                if let snapshot {
                    StatusBadge(
                        title: snapshot.workspaceIdentity,
                        tone: .neutral,
                        accessibilityLabelText: "Runtime workspace identity \(snapshot.workspaceIdentity)"
                    )
                    .lineLimit(1)
                }
            }

            if let status {
                RuntimeWorkspaceNoticeView(notice: status) {
                    reloadWorkspace()
                }
            }

            ViewThatFits(in: .horizontal) {
                HStack(alignment: .top, spacing: 14) {
                    treePanel
                        .frame(width: 340)
                    editorPanel
                        .frame(minWidth: 520)
                }

                VStack(alignment: .leading, spacing: 14) {
                    treePanel
                    editorPanel
                }
            }
        }
        .onAppear {
            reloadWorkspace()
        }
        .onChange(of: agent.id) { _, _ in
            resetWorkspace()
        }
        .alert(
            "You sure you want to delete it?",
            isPresented: Binding(
                get: { pendingDelete != nil },
                set: { if !$0 { pendingDelete = nil } }
            )
        ) {
            Button("Delete", role: .destructive) {
                deletePendingTarget()
            }
            .disabled(busyAction == "delete")
            Button("Cancel", role: .cancel) {
                pendingDelete = nil
            }
        } message: {
            Text(deleteConfirmationCopy)
        }
    }

    private var treePanel: some View {
        RuntimeWorkspacePane {
            HStack {
                Text("Tree")
                    .font(.headline)
                Spacer()
                if snapshot == nil {
                    StatusBadge(title: "loading", tone: .amber, accessibilityLabelText: "Tree loading")
                }
            }

            if snapshot == nil {
                Text("Loading...")
                    .font(.callout)
                    .foregroundStyle(RCTheme.muted)
                    .frame(maxWidth: .infinity, minHeight: 180, alignment: .center)
            } else if visibleRows.isEmpty {
                EmptyMiniLight(title: "Empty", body: "No runtime workspace roots are available for this agent.")
            } else {
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 4) {
                        ForEach(visibleRows) { row in
                            RuntimeWorkspaceTreeRow(
                                row: row,
                                selected: row.rootId == selectedRootId && row.relativePath == selectedRelativePath,
                                expanded: expandedKeys.contains(treeKey(rootId: row.rootId, relativePath: row.relativePath)),
                                loading: loadingKeys.contains(treeKey(rootId: row.rootId, relativePath: row.relativePath))
                            ) {
                                select(row)
                            }

                            if row.kind == .folder,
                               expandedKeys.contains(treeKey(rootId: row.rootId, relativePath: row.relativePath)),
                               loadingKeys.contains(treeKey(rootId: row.rootId, relativePath: row.relativePath)) {
                                RuntimeWorkspaceTreeInlineState(depth: row.depth + 1, text: "Loading...")
                            } else if row.kind == .folder,
                                      expandedKeys.contains(treeKey(rootId: row.rootId, relativePath: row.relativePath)),
                                      childrenByKey[treeKey(rootId: row.rootId, relativePath: row.relativePath)]?.isEmpty == true {
                                RuntimeWorkspaceTreeInlineState(depth: row.depth + 1, text: "Empty")
                            }
                        }
                    }
                    .padding(.vertical, 2)
                }
                .frame(minHeight: 260, maxHeight: 520)
            }
        }
    }

    private var editorPanel: some View {
        RuntimeWorkspacePane {
            editorHeader
            linkedLocalSyncCard

            if showBaselines {
                baselineManager
            }

            if selectedKind == .folder {
                createSubfolderCard
            }

            if fileLoading {
                Text("Loading file contents...")
                    .font(.callout)
                    .foregroundStyle(RCTheme.muted)
                    .frame(maxWidth: .infinity, minHeight: 120, alignment: .center)
            } else if selectedIsPNG {
                RuntimeWorkspaceNoticeView(notice: RuntimeWorkspaceNotice(kind: .info, text: "PNG files are stored in the workspace and can be downloaded, but they are not editable as text."), retry: nil)
            } else {
                markdownEditor
            }
        }
    }

    private var editorHeader: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(fileDocument.map { "Editing \($0.filename)" } ?? "Workspace editor")
                        .font(.headline)
                        .lineLimit(1)
                    Text(selectedLocationLabel)
                        .font(.caption)
                        .foregroundStyle(RCTheme.muted)
                        .lineLimit(1)
                        .truncationMode(.middle)
                }
                Spacer()
                if selectedReadOnly {
                    StatusBadge(title: "Read-only", tone: .amber, accessibilityLabelText: "Selected runtime workspace root is read-only")
                }
            }

            toolbar
        }
    }

    private var toolbar: some View {
        RuntimeWorkspaceFlowLayout(
            itemSpacing: RuntimeWorkspaceLayoutMetrics.toolbarSpacing,
            rowSpacing: RuntimeWorkspaceLayoutMetrics.toolbarSpacing
        ) {
            workspaceActionButton(
                "New markdown",
                width: RuntimeWorkspaceLayoutMetrics.toolbarButtonWidth,
                disabled: selectedReadOnly,
                help: selectedReadOnly ? "Read-only roots cannot create files." : "New markdown",
                accessibilityLabel: "New markdown"
            ) {
                beginNewMarkdown()
            }

            workspaceActionButton(
                "Upload markdown",
                width: RuntimeWorkspaceLayoutMetrics.toolbarButtonWidth,
                disabled: selectedReadOnly,
                help: selectedReadOnly ? "Read-only roots cannot upload files." : "Upload markdown",
                accessibilityLabel: "Upload markdown"
            ) {
                uploadFile(kind: .markdown)
            }

            workspaceActionButton(
                "Upload PNG",
                width: RuntimeWorkspaceLayoutMetrics.toolbarButtonWidth,
                disabled: selectedReadOnly,
                help: selectedReadOnly ? "Read-only roots cannot upload files." : "Upload PNG",
                accessibilityLabel: "Upload PNG"
            ) {
                uploadFile(kind: .png)
            }

            workspaceActionButton(
                busyAction == "sync-from" ? "Syncing..." : (busyAction == "link" ? "Linking..." : "Sync from local"),
                width: RuntimeWorkspaceLayoutMetrics.toolbarButtonWidth,
                disabled: linkedSummary.permissionId == nil || busyAction != nil,
                help: linkedSummary.permissionId == nil ? "Link a local target before syncing." : "Sync from local",
                accessibilityLabel: "Sync from local"
            ) {
                syncLocal(direction: .fromLocal)
            }

            workspaceActionButton(
                busyAction == "sync-to" ? "Syncing..." : "Sync to local",
                width: RuntimeWorkspaceLayoutMetrics.toolbarButtonWidth,
                disabled: linkedSummary.permissionId == nil || busyAction != nil,
                help: linkedSummary.permissionId == nil ? "Link a local target before syncing." : "Sync to local",
                accessibilityLabel: "Sync to local"
            ) {
                syncLocal(direction: .toLocal)
            }

            workspaceActionButton(
                linkActionTitle,
                width: RuntimeWorkspaceLayoutMetrics.toolbarButtonWidth,
                disabled: busyAction != nil,
                help: linkActionTitle,
                accessibilityLabel: linkActionTitle
            ) {
                changeLinkedTarget()
            }

            workspaceActionButton(
                showBaselines ? "Hide baselines" : "Baselines",
                width: RuntimeWorkspaceLayoutMetrics.toolbarButtonWidth,
                help: showBaselines ? "Hide baselines" : "Baselines",
                accessibilityLabel: showBaselines ? "Hide baselines" : "Baselines"
            ) {
                showBaselines.toggle()
            }

            workspaceActionButton(
                "Download",
                width: RuntimeWorkspaceLayoutMetrics.toolbarButtonWidth,
                disabled: selectedKind != .file,
                help: selectedKind == .file ? "Download" : "Select a file before downloading.",
                accessibilityLabel: "Download"
            ) {
                downloadSelectedFile()
            }

            workspaceActionButton(
                deleteActionTitle,
                width: RuntimeWorkspaceLayoutMetrics.toolbarButtonWidth,
                disabled: !canDeleteSelection || busyAction == "delete",
                help: canDeleteSelection ? deleteActionTitle : "Select a file or non-root folder before deleting.",
                accessibilityLabel: deleteActionTitle
            ) {
                requestDelete()
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var linkedLocalSyncCard: some View {
        RuntimeWorkspaceSection {
            Text("Linked local sync")
                .font(.subheadline.weight(.semibold))
            RuntimeWorkspaceMetadataRow(label: "Linked to:", value: linkedSummary.linkedTo)
            RuntimeWorkspaceMetadataRow(label: "Last synced:", value: linkedSummary.lastSyncedAt ?? "Never")
            RuntimeWorkspaceMetadataRow(label: "Last result:", value: linkedSummary.lastResult)
        }
    }

    private var createSubfolderCard: some View {
        RuntimeWorkspaceSection {
            Text("Create subfolder")
                .font(.subheadline.weight(.semibold))
            ViewThatFits(in: .horizontal) {
                HStack(spacing: RuntimeWorkspaceLayoutMetrics.inlineControlSpacing) {
                    subfolderNameField
                    createFolderButton
                    Spacer(minLength: 0)
                }

                VStack(alignment: .leading, spacing: RuntimeWorkspaceLayoutMetrics.inlineControlSpacing) {
                    subfolderNameField
                    createFolderButton
                }
            }
        }
    }

    private var subfolderNameField: some View {
        TextField("new-subfolder", text: $subfolderDraft)
            .textFieldStyle(.plain)
            .rcTextFieldChrome(height: RuntimeWorkspaceLayoutMetrics.controlHeight)
            .frame(width: RuntimeWorkspaceLayoutMetrics.textFieldWidth)
            .help("Create subfolder")
            .accessibilityLabel("Create subfolder")
    }

    private var createFolderButton: some View {
        workspaceActionButton(
            busyAction == "create-folder" ? "Creating..." : "Create folder",
            width: RuntimeWorkspaceLayoutMetrics.inlineButtonWidth,
            disabled: selectedReadOnly || subfolderDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || busyAction != nil,
            help: selectedReadOnly ? "Read-only roots cannot create folders." : "Create folder",
            accessibilityLabel: "Create folder"
        ) {
            createFolder()
        }
    }

    private var markdownEditor: some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 6) {
                Text("Filename")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(RCTheme.muted)
                TextField("notes.md", text: $filename)
                    .textFieldStyle(.plain)
                    .rcTextFieldChrome(height: RuntimeWorkspaceLayoutMetrics.controlHeight)
                    .frame(width: RuntimeWorkspaceLayoutMetrics.textFieldWidth)
                    .disabled(selectedReadOnly)
                    .help("Filename")
                    .accessibilityLabel("Filename")
            }

            VStack(alignment: .leading, spacing: 6) {
                Text("Apply canonical baseline")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(RCTheme.muted)
                ViewThatFits(in: .horizontal) {
                    HStack(alignment: .center, spacing: RuntimeWorkspaceLayoutMetrics.inlineControlSpacing) {
                        baselinePicker
                        applyBaselineButton
                        Spacer(minLength: 0)
                    }

                    VStack(alignment: .leading, spacing: RuntimeWorkspaceLayoutMetrics.inlineControlSpacing) {
                        baselinePicker
                        applyBaselineButton
                    }
                }
            }

            VStack(alignment: .leading, spacing: 6) {
                Text(editorContentLabel)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(RCTheme.muted)
                ZStack(alignment: .topLeading) {
                    TextEditor(text: $markdown)
                        .font(.system(.body, design: .monospaced))
                        .frame(minHeight: 260)
                        .disabled(selectedReadOnly)
                        .scrollContentBackground(.hidden)
                        .background(Color.black.opacity(0.08))
                        .clipShape(RoundedRectangle(cornerRadius: 4))
                        .overlay(RoundedRectangle(cornerRadius: 4).stroke(RCTheme.borderSoft))
                        .help("Markdown")
                        .accessibilityLabel("Markdown")
                    if markdown.isEmpty, !editorPlaceholder.isEmpty {
                        Text(editorPlaceholder)
                            .font(.system(.body, design: .monospaced))
                            .foregroundStyle(RCTheme.muted.opacity(0.7))
                            .padding(.horizontal, 6)
                            .padding(.vertical, 8)
                            .allowsHitTesting(false)
                    }
                }
            }

            HStack {
                Text(editorFooterText)
                    .font(.caption)
                    .foregroundStyle(RCTheme.muted)
                    .lineLimit(2)
                Spacer()
                Button {
                    saveMarkdown()
                } label: {
                    RuntimeWorkspaceButtonLabel(title: busyAction == "save-markdown" ? "Saving..." : "Save file")
                        .frame(
                            width: RuntimeWorkspaceLayoutMetrics.inlineButtonWidth - RuntimeWorkspaceLayoutMetrics.buttonHorizontalPadding,
                            height: RuntimeWorkspaceLayoutMetrics.buttonLabelHeight
                        )
                }
                .buttonStyle(PrimaryLightButtonStyle())
                .frame(width: RuntimeWorkspaceLayoutMetrics.inlineButtonWidth, height: RuntimeWorkspaceLayoutMetrics.controlHeight)
                .disabled(!canSaveMarkdown)
                .help(canSaveMarkdown ? "Save file" : "Filename and file contents are required.")
                .accessibilityLabel("Save file")
            }
        }
    }

    private var baselinePicker: some View {
        Picker("Apply canonical baseline", selection: $selectedBaselineId) {
            Text("Select a baseline...").tag("")
            ForEach(baselines) { baseline in
                Text(baseline.name).tag(baseline.id)
            }
        }
        .labelsHidden()
        .frame(width: RuntimeWorkspaceLayoutMetrics.pickerWidth, height: RuntimeWorkspaceLayoutMetrics.controlHeight)
        .help("Apply canonical baseline")
        .accessibilityLabel("Apply canonical baseline")
    }

    private var applyBaselineButton: some View {
        workspaceActionButton(
            "Apply",
            width: RuntimeWorkspaceLayoutMetrics.applyButtonWidth,
            disabled: selectedBaselineId.isEmpty || selectedReadOnly,
            help: selectedBaselineId.isEmpty ? "Select a baseline before applying." : "Apply",
            accessibilityLabel: "Apply"
        ) {
            applySelectedBaseline()
        }
    }

    private func workspaceActionButton(
        _ title: String,
        width: CGFloat,
        disabled: Bool = false,
        help: String,
        accessibilityLabel: String,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            RuntimeWorkspaceButtonLabel(title: title)
                .frame(
                    width: max(width - RuntimeWorkspaceLayoutMetrics.buttonHorizontalPadding, 20),
                    height: RuntimeWorkspaceLayoutMetrics.buttonLabelHeight
                )
        }
        .buttonStyle(PrimaryLightButtonStyle())
        .frame(width: width, height: RuntimeWorkspaceLayoutMetrics.controlHeight)
        .disabled(disabled)
        .help(help)
        .accessibilityLabel(accessibilityLabel)
    }

    private var baselineManager: some View {
        RuntimeWorkspaceSection {
            Text("Baselines")
                .font(.subheadline.weight(.semibold))

            if baselines.isEmpty {
                Text("No baselines saved yet. Create one below.")
                    .font(.callout)
                    .foregroundStyle(RCTheme.muted)
            } else {
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(baselines) { baseline in
                        HStack(spacing: 8) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(baseline.name)
                                    .font(.callout.weight(.semibold))
                                    .lineLimit(1)
                                Text(baseline.updatedAt)
                                    .font(.caption2)
                                    .foregroundStyle(RCTheme.muted)
                                    .lineLimit(1)
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
                            .buttonStyle(PrimaryLightButtonStyle())
                            Button("Delete") {
                                deleteBaseline(baseline)
                            }
                            .buttonStyle(PrimaryLightButtonStyle())
                        }
                    }
                }
            }

            Text(editingBaselineId == nil ? "New baseline" : "Edit baseline")
                .font(.subheadline.weight(.semibold))
                .padding(.top, 4)
            TextField("Baseline name (e.g. AGENTS.md)", text: $baselineName)
                .textFieldStyle(.plain)
                .rcTextFieldChrome(height: RuntimeWorkspaceLayoutMetrics.controlHeight)
                .help("Baseline name (e.g. AGENTS.md)")
                .accessibilityLabel("Baseline name")
            ZStack(alignment: .topLeading) {
                TextEditor(text: $baselineMarkdown)
                    .font(.system(.body, design: .monospaced))
                    .frame(minHeight: 130)
                    .scrollContentBackground(.hidden)
                    .rcTextEditorChrome()
                    .overlay(RoundedRectangle(cornerRadius: 4).stroke(RCTheme.borderSoft))
                    .help("Baseline markdown")
                    .accessibilityLabel("Baseline markdown")
                if baselineMarkdown.isEmpty {
                    Text("# Paste your canonical markdown content here")
                        .font(.system(.body, design: .monospaced))
                        .foregroundStyle(RCTheme.muted.opacity(0.7))
                        .padding(.horizontal, 6)
                        .padding(.vertical, 8)
                        .allowsHitTesting(false)
                }
            }
            HStack {
                Button(editingBaselineId == nil ? "Save baseline" : "Update baseline") {
                    saveBaseline()
                }
                .buttonStyle(PrimaryLightButtonStyle())
                .disabled(baselineName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || baselineMarkdown.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                Spacer()
                if editingBaselineId != nil {
                    Button("Cancel") {
                        editingBaselineId = nil
                        baselineName = ""
                        baselineMarkdown = ""
                    }
                    .buttonStyle(PrimaryLightButtonStyle())
                }
            }
        }
    }

    private var visibleRows: [RuntimeWorkspaceTreeDisplayRow] {
        guard let snapshot else { return [] }
        var rows: [RuntimeWorkspaceTreeDisplayRow] = []
        for root in snapshot.roots {
            let rootRow = RuntimeWorkspaceTreeDisplayRow(
                id: root.rootId,
                rootId: root.rootId,
                name: root.label,
                relativePath: "",
                kind: .folder,
                depth: 0,
                isReadOnly: root.isReadOnly,
                isPNG: false,
                isEditableText: false,
                isRoot: true
            )
            rows.append(rootRow)
            appendRows(rootId: root.rootId, relativePath: "", depth: 1, into: &rows)
        }
        return rows
    }

    private var selectedRoot: RuntimeWorkspaceRoot? {
        snapshot?.roots.first { $0.rootId == selectedRootId }
    }

    private var selectedRootKind: RuntimeWorkspaceRootKind? {
        selectedRoot?.kind
    }

    private var selectedLocationLabel: String {
        let root = selectedRoot?.label ?? "workspace"
        let path = activeFolderRelativePath
        return path.isEmpty ? root : "\(root)/\(path)"
    }

    private var activeFolderRelativePath: String {
        if selectedKind == .folder {
            return selectedRelativePath
        }
        return parentPath(selectedRelativePath)
    }

    private var targetKind: NativeFilePermissionTargetKind {
        selectedKind == .folder ? .folder : .file
    }

    private var linkActionTitle: String {
        selectedKind == .folder ? "Change linked folder" : "Change linked file"
    }

    private var deleteActionTitle: String {
        if busyAction == "delete" {
            return "Deleting..."
        }
        return selectedKind == .folder ? "Delete folder" : "Delete file"
    }

    private var canDeleteSelection: Bool {
        !selectedReadOnly && !selectedRelativePath.isEmpty
    }

    private var canSaveMarkdown: Bool {
        !selectedReadOnly
            && !filename.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && !markdown.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && busyAction == nil
            && !selectedIsPNG
    }

    private var editorContentLabel: String {
        fileDocument == nil ? "Markdown" : "File contents"
    }

    private var editorPlaceholder: String {
        guard fileDocument == nil else { return "" }
        return "# Notes"
    }

    private var editorFooterText: String {
        if fileDocument == nil {
            return "Create a markdown file in \(selectedLocationLabel)"
        }
        if selectedReadOnly {
            return "Read-only file"
        }
        return "Save file changes"
    }

    private var deleteConfirmationCopy: String {
        guard let pendingDelete else { return "" }
        let suffix = pendingDelete.kind == .folder ? " All files inside will be permanently removed." : ""
        return "Delete \(pendingDelete.label)? This cannot be undone.\(suffix)"
    }

    private func appendRows(rootId: String, relativePath: String, depth: Int, into rows: inout [RuntimeWorkspaceTreeDisplayRow]) {
        let key = treeKey(rootId: rootId, relativePath: relativePath)
        guard expandedKeys.contains(key), let children = childrenByKey[key] else { return }
        for child in children {
            rows.append(RuntimeWorkspaceTreeDisplayRow(
                id: child.id,
                rootId: child.rootId,
                name: child.name,
                relativePath: child.relativePath,
                kind: child.kind,
                depth: depth,
                isReadOnly: child.isReadOnly,
                isPNG: child.isPNG,
                isEditableText: child.isEditableText,
                isRoot: false
            ))
            if child.kind == .folder {
                appendRows(rootId: child.rootId, relativePath: child.relativePath, depth: depth + 1, into: &rows)
            }
        }
    }

    private func resetWorkspace() {
        snapshot = nil
        expandedKeys = []
        loadingKeys = []
        childrenByKey = [:]
        selectedRootId = ""
        selectedRelativePath = ""
        selectedKind = .folder
        selectedReadOnly = false
        selectedIsPNG = false
        fileDocument = nil
        filename = "notes.md"
        markdown = ""
        subfolderDraft = ""
        selectedBaselineId = ""
        baselines = []
        showBaselines = false
        linkedSummary = .notLinked
        status = nil
        reloadWorkspace()
    }

    private func reloadWorkspace() {
        guard let service = model.services?.runtimeWorkspace else {
            status = RuntimeWorkspaceNotice(kind: .error, text: "Runtime workspace service is unavailable.")
            return
        }
        let next = service.snapshot(for: agent, agentLabel: model.resolveAgentDisplayName(agent))
        snapshot = next
        if selectedRootId.isEmpty || !next.roots.contains(where: { $0.rootId == selectedRootId }) {
            selectedRootId = next.roots.first?.rootId ?? ""
            selectedRelativePath = ""
            selectedKind = .folder
        }
        selectedReadOnly = selectedRoot?.isReadOnly ?? false
        selectedIsPNG = false
        loadBaselines()
        if !selectedRootId.isEmpty {
            loadChildren(rootId: selectedRootId, relativePath: "")
            expandedKeys.insert(treeKey(rootId: selectedRootId, relativePath: ""))
            loadLinkedSummary()
        }
    }

    private func loadChildren(rootId: String, relativePath: String) {
        guard let service = model.services?.runtimeWorkspace else { return }
        let key = treeKey(rootId: rootId, relativePath: relativePath)
        loadingKeys.insert(key)
        do {
            childrenByKey[key] = try service.listChildren(agent: agent, rootId: rootId, relativePath: relativePath)
            loadingKeys.remove(key)
        } catch {
            loadingKeys.remove(key)
            childrenByKey[key] = []
            status = RuntimeWorkspaceNotice(kind: .error, text: error.localizedDescription)
        }
    }

    private func select(_ row: RuntimeWorkspaceTreeDisplayRow) {
        selectedRootId = row.rootId
        selectedRelativePath = row.relativePath
        selectedKind = row.kind
        selectedReadOnly = row.isReadOnly
        selectedIsPNG = row.isPNG
        selectedBaselineId = ""
        status = nil
        loadLinkedSummary()

        if row.kind == .folder {
            fileDocument = nil
            filename = "notes.md"
            markdown = ""
            let key = treeKey(rootId: row.rootId, relativePath: row.relativePath)
            if expandedKeys.contains(key) {
                expandedKeys.remove(key)
            } else {
                expandedKeys.insert(key)
                loadChildren(rootId: row.rootId, relativePath: row.relativePath)
            }
            return
        }

        if row.isPNG {
            fileDocument = nil
            filename = row.name
            markdown = ""
            return
        }

        guard row.isEditableText, let service = model.services?.runtimeWorkspace else {
            fileDocument = nil
            filename = row.name
            markdown = ""
            status = nonEditableNotice(for: row)
            return
        }

        fileLoading = true
        do {
            let document = try service.readFile(agent: agent, rootId: row.rootId, relativePath: row.relativePath)
            fileDocument = document
            filename = document.filename
            markdown = document.markdown
            fileLoading = false
            status = selectionNotice(for: row)
        } catch {
            fileLoading = false
            status = RuntimeWorkspaceNotice(kind: .error, text: error.localizedDescription)
        }
    }

    private func beginNewMarkdown() {
        guard !selectedReadOnly else { return }
        selectedKind = .folder
        selectedRelativePath = activeFolderRelativePath
        selectedIsPNG = false
        fileDocument = nil
        filename = "notes.md"
        markdown = "# Notes\n"
        status = nil
        loadLinkedSummary()
    }

    private func saveMarkdown() {
        guard let service = model.services?.runtimeWorkspace else { return }
        busyAction = "save-markdown"
        do {
            let document = try service.saveMarkdown(
                agent: agent,
                rootId: selectedRootId,
                folderRelativePath: activeFolderRelativePath,
                filename: filename,
                markdown: markdown
            )
            fileDocument = document
            selectedKind = .file
            selectedRelativePath = document.relativePath
            selectedIsPNG = false
            filename = document.filename
            markdown = document.markdown
            busyAction = nil
            status = RuntimeWorkspaceNotice(kind: .success, text: "Save file")
            reloadParentAndSelection()
        } catch {
            busyAction = nil
            status = RuntimeWorkspaceNotice(kind: .error, text: error.localizedDescription)
        }
    }

    private func createFolder() {
        guard let service = model.services?.runtimeWorkspace else { return }
        busyAction = "create-folder"
        do {
            let node = try service.createSubfolder(
                agent: agent,
                rootId: selectedRootId,
                parentRelativePath: activeFolderRelativePath,
                name: subfolderDraft
            )
            subfolderDraft = ""
            busyAction = nil
            status = RuntimeWorkspaceNotice(kind: .success, text: "Create folder")
            loadChildren(rootId: node.rootId, relativePath: parentPath(node.relativePath))
        } catch {
            busyAction = nil
            status = RuntimeWorkspaceNotice(kind: .error, text: error.localizedDescription)
        }
    }

    private func uploadFile(kind: RuntimeWorkspaceFileImportKind) {
        guard let service = model.services?.runtimeWorkspace else { return }
        let panel = NSOpenPanel()
        panel.canChooseDirectories = false
        panel.canChooseFiles = true
        panel.allowsMultipleSelection = false
        panel.allowedContentTypes = kind == .png ? [.png] : markdownContentTypes
        let response = panel.runModal()
        guard response == .OK, let url = panel.url else { return }
        let accessed = url.startAccessingSecurityScopedResource()
        defer {
            if accessed { url.stopAccessingSecurityScopedResource() }
        }
        busyAction = kind == .png ? "upload-png" : "upload-markdown"
        do {
            _ = try service.importFile(
                agent: agent,
                rootId: selectedRootId,
                folderRelativePath: activeFolderRelativePath,
                sourceURL: url,
                kind: kind
            )
            busyAction = nil
            status = RuntimeWorkspaceNotice(kind: .success, text: kind == .png ? "Upload PNG" : "Upload markdown")
            loadChildren(rootId: selectedRootId, relativePath: activeFolderRelativePath)
        } catch {
            busyAction = nil
            status = RuntimeWorkspaceNotice(kind: .error, text: error.localizedDescription)
        }
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
            status = RuntimeWorkspaceNotice(kind: .success, text: "Download")
        } catch {
            status = RuntimeWorkspaceNotice(kind: .error, text: error.localizedDescription)
        }
    }

    private func requestDelete() {
        guard canDeleteSelection else { return }
        pendingDelete = RuntimeWorkspaceDeleteTarget(
            rootId: selectedRootId,
            relativePath: selectedRelativePath,
            label: selectedRelativePath.isEmpty ? (selectedRoot?.label ?? "root") : URL(fileURLWithPath: selectedRelativePath).lastPathComponent,
            kind: selectedKind
        )
    }

    private func deletePendingTarget() {
        guard let pendingDelete, let service = model.services?.runtimeWorkspace else { return }
        busyAction = "delete"
        do {
            _ = try service.deleteNode(agent: agent, rootId: pendingDelete.rootId, relativePath: pendingDelete.relativePath)
            let parent = parentPath(pendingDelete.relativePath)
            selectedRootId = pendingDelete.rootId
            selectedRelativePath = parent
            selectedKind = .folder
            selectedIsPNG = false
            fileDocument = nil
            filename = "notes.md"
            markdown = ""
            self.pendingDelete = nil
            busyAction = nil
            status = RuntimeWorkspaceNotice(kind: .success, text: pendingDelete.kind == .folder ? "Delete folder" : "Delete file")
            loadChildren(rootId: pendingDelete.rootId, relativePath: parent)
            loadLinkedSummary()
        } catch {
            self.pendingDelete = nil
            busyAction = nil
            status = RuntimeWorkspaceNotice(kind: .error, text: error.localizedDescription)
        }
    }

    private func changeLinkedTarget() {
        guard let service = model.services?.runtimeWorkspace,
              let workspace = model.workspace else {
            status = RuntimeWorkspaceNotice(kind: .error, text: "Workspace unavailable.")
            return
        }
        let panel = NSOpenPanel()
        panel.canChooseDirectories = targetKind == .folder
        panel.canChooseFiles = targetKind == .file
        panel.allowsMultipleSelection = false
        panel.prompt = targetKind == .folder ? "Choose folder" : "Choose file"
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
                targetKind: targetKind,
                displayName: url.lastPathComponent,
                rawPath: url.path,
                bookmarkRef: bookmarkData.base64EncodedString()
            )
            busyAction = nil
            loadLinkedSummary()
            status = RuntimeWorkspaceNotice(kind: .success, text: targetKind == .folder ? "Link local folder" : "Link local file")
        } catch {
            busyAction = nil
            status = RuntimeWorkspaceNotice(kind: .error, text: error.localizedDescription)
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
                    targetKind: targetKind
                )
            case .toLocal:
                _ = try service.syncToLocal(
                    context: model.chatContext(workspaceId: workspace.id),
                    agent: agent,
                    rootId: selectedRootId,
                    relativePath: selectedRelativePath,
                    targetKind: targetKind
                )
            }
            busyAction = nil
            loadLinkedSummary()
            status = RuntimeWorkspaceNotice(kind: .warning, text: "Linked local sync is guarded until persisted security-scoped bookmark resolution is enabled.")
        } catch {
            busyAction = nil
            loadLinkedSummary()
            status = RuntimeWorkspaceNotice(kind: .error, text: error.localizedDescription)
        }
    }

    private func loadBaselines() {
        do {
            baselines = try model.services?.runtimeWorkspace.listBaselines(agentId: agent.id) ?? []
            if !baselines.contains(where: { $0.id == selectedBaselineId }) {
                selectedBaselineId = ""
            }
        } catch {
            status = RuntimeWorkspaceNotice(kind: .error, text: error.localizedDescription)
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
            status = RuntimeWorkspaceNotice(kind: .success, text: "Save baseline")
        } catch {
            status = RuntimeWorkspaceNotice(kind: .error, text: error.localizedDescription)
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
            status = RuntimeWorkspaceNotice(kind: .error, text: error.localizedDescription)
        }
    }

    private func applySelectedBaseline() {
        guard let baseline = baselines.first(where: { $0.id == selectedBaselineId }) else { return }
        markdown = baseline.markdown
    }

    private func loadLinkedSummary() {
        guard let service = model.services?.runtimeWorkspace,
              let workspace = model.workspace else {
            linkedSummary = .notLinked
            return
        }
        do {
            linkedSummary = try service.linkedLocalSummary(
                context: model.chatContext(workspaceId: workspace.id),
                agent: agent,
                rootId: selectedRootId,
                relativePath: selectedRelativePath,
                targetKind: targetKind
            )
        } catch {
            linkedSummary = .notLinked
        }
    }

    private func reloadParentAndSelection() {
        let parent = activeFolderRelativePath
        loadChildren(rootId: selectedRootId, relativePath: parent)
        if !parent.isEmpty {
            expandedKeys.insert(treeKey(rootId: selectedRootId, relativePath: parent))
        }
        loadLinkedSummary()
    }

    private func parentPath(_ relativePath: String) -> String {
        let parts = relativePath.split(separator: "/").map(String.init)
        guard parts.count > 1 else { return "" }
        return parts.dropLast().joined(separator: "/")
    }

    private func treeKey(rootId: String, relativePath: String) -> String {
        relativePath.isEmpty ? rootId : "\(rootId):\(relativePath)"
    }

    private func nonEditableNotice(for row: RuntimeWorkspaceTreeDisplayRow) -> RuntimeWorkspaceNotice {
        if row.name.lowercased() == "state.db" || row.name.lowercased().hasSuffix(".db") {
            return RuntimeWorkspaceNotice(kind: .info, text: "state.db is Hermes' internal SQLite state database. It is visible for inspection, but Relay Console will not edit it as text.")
        }
        return RuntimeWorkspaceNotice(kind: .warning, text: "This file is visible but not editable as text. Use Download if you need to inspect it elsewhere.")
    }

    private func selectionNotice(for row: RuntimeWorkspaceTreeDisplayRow) -> RuntimeWorkspaceNotice? {
        let name = row.name.lowercased()
        let topFolder = row.relativePath.split(separator: "/").first.map(String.init)?.lowercased()
        if selectedRootKind == .hermesProfile, name == "soul.md" {
            return RuntimeWorkspaceNotice(kind: .info, text: "SOUL.md is this Hermes agent's editable identity file.")
        }
        if selectedRootKind == .hermesProfile, ["profile.yaml", "config.yaml"].contains(name) {
            return RuntimeWorkspaceNotice(kind: .warning, text: "\(row.name) affects this Hermes profile. Edit carefully and keep valid YAML.")
        }
        if topFolder == "logs" || name.hasSuffix(".log") {
            return RuntimeWorkspaceNotice(kind: .info, text: "Logs are read-only runtime records.")
        }
        if selectedRootKind == .sessions || selectedRootKind == .hermesGlobalSessions || topFolder == "sessions" {
            return RuntimeWorkspaceNotice(kind: .info, text: "Sessions are read-only runtime records.")
        }
        return nil
    }

    private var markdownContentTypes: [UTType] {
        [
            UTType(filenameExtension: "md"),
            UTType(filenameExtension: "markdown"),
            UTType(filenameExtension: "yaml"),
            UTType(filenameExtension: "yml"),
            .plainText
        ].compactMap { $0 }
    }
}

private enum RuntimeWorkspaceSyncDirection {
    case fromLocal
    case toLocal
}

private struct RuntimeWorkspaceDeleteTarget {
    var rootId: String
    var relativePath: String
    var label: String
    var kind: RuntimeWorkspaceNodeKind
}

private struct RuntimeWorkspaceTreeDisplayRow: Identifiable {
    var id: String
    var rootId: String
    var name: String
    var relativePath: String
    var kind: RuntimeWorkspaceNodeKind
    var depth: Int
    var isReadOnly: Bool
    var isPNG: Bool
    var isEditableText: Bool
    var isRoot: Bool
}

private struct RuntimeWorkspaceNotice: Identifiable {
    enum Kind {
        case info
        case success
        case warning
        case error
    }

    var id = UUID()
    var kind: Kind
    var text: String
}

private enum RuntimeWorkspaceLayoutMetrics {
    static let controlHeight: CGFloat = 34
    static let buttonHorizontalPadding: CGFloat = 28
    static let buttonLabelHeight: CGFloat = 16
    static let toolbarButtonWidth: CGFloat = 160
    static let toolbarSpacing: CGFloat = 10
    static let inlineControlSpacing: CGFloat = 10
    static let textFieldWidth: CGFloat = 420
    static let pickerWidth: CGFloat = 260
    static let inlineButtonWidth: CGFloat = 132
    static let applyButtonWidth: CGFloat = 86
}

private struct RuntimeWorkspaceButtonLabel: View {
    var title: String

    var body: some View {
        Text(title)
            .lineLimit(1)
            .minimumScaleFactor(0.82)
            .truncationMode(.tail)
            .frame(maxWidth: .infinity)
    }
}

private struct RuntimeWorkspaceFlowLayout: Layout {
    var itemSpacing: CGFloat
    var rowSpacing: CGFloat

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let sizes = subviews.map { $0.sizeThatFits(.unspecified) }
        return measuredSize(for: sizes, proposedWidth: proposal.width)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let maxWidth = max(bounds.width, 1)
        var x: CGFloat = 0
        var y: CGFloat = 0
        var rowHeight: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x > 0, x + itemSpacing + size.width > maxWidth {
                x = 0
                y += rowHeight + rowSpacing
                rowHeight = 0
            }

            if x > 0 {
                x += itemSpacing
            }

            subview.place(
                at: CGPoint(x: bounds.minX + x, y: bounds.minY + y),
                proposal: ProposedViewSize(width: size.width, height: size.height)
            )
            x += size.width
            rowHeight = max(rowHeight, size.height)
        }
    }

    private func measuredSize(for sizes: [CGSize], proposedWidth: CGFloat?) -> CGSize {
        guard !sizes.isEmpty else { return .zero }
        let naturalWidth = sizes.map(\.width).reduce(0, +) + CGFloat(max(sizes.count - 1, 0)) * itemSpacing
        let maxWidth = max(proposedWidth ?? naturalWidth, 1)
        var x: CGFloat = 0
        var y: CGFloat = 0
        var rowHeight: CGFloat = 0
        var widestRow: CGFloat = 0

        for size in sizes {
            if x > 0, x + itemSpacing + size.width > maxWidth {
                widestRow = max(widestRow, x)
                x = 0
                y += rowHeight + rowSpacing
                rowHeight = 0
            }

            if x > 0 {
                x += itemSpacing
            }

            x += size.width
            rowHeight = max(rowHeight, size.height)
        }

        widestRow = max(widestRow, x)
        return CGSize(width: min(widestRow, maxWidth), height: y + rowHeight)
    }
}

private struct RuntimeWorkspacePane<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            content
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .topLeading)
        .background(RCTheme.sidebarSurfaceAlt)
        .clipShape(RoundedRectangle(cornerRadius: RCComponentBaseline.cornerRadius))
        .overlay(RoundedRectangle(cornerRadius: RCComponentBaseline.cornerRadius).stroke(RCTheme.borderSoft))
    }
}

private struct RuntimeWorkspaceSection<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            content
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.white.opacity(0.035))
        .clipShape(RoundedRectangle(cornerRadius: 4))
        .overlay(RoundedRectangle(cornerRadius: 4).stroke(RCTheme.borderSoft))
    }
}

private struct RuntimeWorkspaceTreeRow: View {
    var row: RuntimeWorkspaceTreeDisplayRow
    var selected: Bool
    var expanded: Bool
    var loading: Bool
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Spacer()
                    .frame(width: CGFloat(row.depth) * 14)
                Image(systemName: iconName)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(row.kind == .folder ? RCTheme.accentBlue : RCTheme.muted)
                    .frame(width: 16)
                Text(row.name)
                    .font(.callout)
                    .lineLimit(1)
                    .truncationMode(.middle)
                if row.isPNG {
                    StatusBadge(title: "PNG", tone: .purple, accessibilityLabelText: "PNG file")
                }
                if row.isReadOnly {
                    Image(systemName: "lock")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(RCTheme.muted)
                        .help("Read-only")
                        .accessibilityLabel("Read-only")
                }
                if loading {
                    StatusBadge(title: "loading", tone: .amber, accessibilityLabelText: "Tree loading")
                }
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 8)
            .frame(height: 30)
            .background(selected ? RCTheme.accentBlue.opacity(0.16) : Color.clear)
            .clipShape(RoundedRectangle(cornerRadius: 4))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .help(row.name)
        .accessibilityLabel(row.name)
    }

    private var iconName: String {
        if row.kind == .folder {
            return expanded ? "folder.fill" : "folder"
        }
        return row.isPNG ? "photo" : "doc.text"
    }
}

private struct RuntimeWorkspaceTreeInlineState: View {
    var depth: Int
    var text: String

    var body: some View {
        HStack {
            Spacer()
                .frame(width: CGFloat(depth) * 14 + 24)
            Text(text)
                .font(.caption)
                .foregroundStyle(RCTheme.muted)
            Spacer()
        }
        .frame(height: 24)
    }
}

private struct RuntimeWorkspaceNoticeView: View {
    var notice: RuntimeWorkspaceNotice
    var retry: (() -> Void)?

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: iconName)
                .foregroundStyle(toneColor)
            Text(notice.text)
                .font(.callout)
                .foregroundStyle(RCTheme.text)
                .lineLimit(3)
            Spacer()
            if let retry {
                Button("Retry") {
                    retry()
                }
                .buttonStyle(PrimaryLightButtonStyle())
                .accessibilityLabel("Retry")
            }
        }
        .padding(10)
        .background(toneColor.opacity(0.12))
        .clipShape(RoundedRectangle(cornerRadius: 4))
        .overlay(RoundedRectangle(cornerRadius: 4).stroke(toneColor.opacity(0.35)))
    }

    private var iconName: String {
        switch notice.kind {
        case .info: return "info.circle"
        case .success: return "checkmark.circle"
        case .warning: return "exclamationmark.triangle"
        case .error: return "xmark.octagon"
        }
    }

    private var toneColor: Color {
        switch notice.kind {
        case .info: return RCTheme.accentBlue
        case .success: return RCTheme.accentGreen
        case .warning: return RCTheme.accentAmber
        case .error: return RCTheme.accentRed
        }
    }
}

private struct RuntimeWorkspaceMetadataRow: View {
    var label: String
    var value: String

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text(label)
                .font(.caption.weight(.semibold))
                .foregroundStyle(RCTheme.muted)
                .frame(width: 84, alignment: .leading)
            Text(value)
                .font(.caption)
                .foregroundStyle(RCTheme.text)
                .lineLimit(2)
                .truncationMode(.middle)
                .textSelection(.enabled)
            Spacer(minLength: 0)
        }
    }
}
