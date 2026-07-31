import Foundation
import CryptoKit

public enum RuntimeWorkspaceRootKind: String, Codable, CaseIterable, Sendable {
    case library
    case hermesProfile = "hermes_profile"
    case agentWorkspace = "agent_workspace"
    case hermesShared = "hermes_shared"
    case sessions
    case hermesGlobalSessions = "hermes_global_sessions"
    case project
}

public enum RuntimeWorkspaceNodeKind: String, Codable, CaseIterable, Sendable {
    case folder
    case file
}

public enum RuntimeWorkspaceFileImportKind: String, Codable, CaseIterable, Sendable {
    case markdown
    case png
}

public struct RuntimeWorkspaceRoot: Identifiable, Codable, Equatable, Sendable {
    public var id: String { rootId }
    public var rootId: String
    public var kind: RuntimeWorkspaceRootKind
    public var label: String
    public var isReadOnly: Bool
    public var exists: Bool
    public var displayPath: String

    public init(
        rootId: String,
        kind: RuntimeWorkspaceRootKind,
        label: String,
        isReadOnly: Bool,
        exists: Bool,
        displayPath: String
    ) {
        self.rootId = rootId
        self.kind = kind
        self.label = label
        self.isReadOnly = isReadOnly
        self.exists = exists
        self.displayPath = displayPath
    }
}

public struct RuntimeWorkspaceNode: Identifiable, Codable, Equatable, Sendable {
    public var id: String { nodeId }
    public var nodeId: String
    public var rootId: String
    public var name: String
    public var relativePath: String
    public var kind: RuntimeWorkspaceNodeKind
    public var isReadOnly: Bool
    public var isPNG: Bool
    public var isEditableText: Bool
    public var byteCount: Int?
    public var updatedAt: IsoTimestamp?

    public init(
        nodeId: String,
        rootId: String,
        name: String,
        relativePath: String,
        kind: RuntimeWorkspaceNodeKind,
        isReadOnly: Bool,
        isPNG: Bool = false,
        isEditableText: Bool = false,
        byteCount: Int? = nil,
        updatedAt: IsoTimestamp? = nil
    ) {
        self.nodeId = nodeId
        self.rootId = rootId
        self.name = name
        self.relativePath = relativePath
        self.kind = kind
        self.isReadOnly = isReadOnly
        self.isPNG = isPNG
        self.isEditableText = isEditableText
        self.byteCount = byteCount
        self.updatedAt = updatedAt
    }
}

public struct RuntimeWorkspaceSnapshot: Codable, Equatable, Sendable {
    public var agentId: RelayId
    public var runtimeType: RuntimeType
    public var workspaceIdentity: String
    public var roots: [RuntimeWorkspaceRoot]
}

public struct RuntimeWorkspaceFileDocument: Codable, Equatable, Sendable {
    public var rootId: String
    public var relativePath: String
    public var filename: String
    public var markdown: String
    public var updatedAt: IsoTimestamp?
    public var byteCount: Int
}

public struct RuntimeWorkspaceFileExport: Codable, Equatable, Sendable {
    public var filename: String
    public var data: Data
}

public struct RuntimeWorkspaceBaseline: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var agentId: RelayId
    public var name: String
    public var markdown: String
    public var createdAt: IsoTimestamp
    public var updatedAt: IsoTimestamp
}

public struct RuntimeWorkspaceLinkedLocalSummary: Codable, Equatable, Sendable {
    public var permissionId: RelayId?
    public var linkedTo: String
    public var lastSyncedAt: IsoTimestamp?
    public var lastResult: String
    public var status: NativeFilePermissionStatus
    public var statusTitle: String

    public static var notLinked: RuntimeWorkspaceLinkedLocalSummary {
        RuntimeWorkspaceLinkedLocalSummary(
            permissionId: nil,
            linkedTo: "Not linked",
            lastSyncedAt: nil,
            lastResult: "Not linked",
            status: .notLinked,
            statusTitle: "Not linked"
        )
    }
}

public enum RuntimeWorkspaceUserSection: String, Codable, CaseIterable, Sendable {
    case instructions
    case memory
    case skills

    public var title: String {
        switch self {
        case .instructions:
            return "Agent Instructions"
        case .memory:
            return "Agent Memory"
        case .skills:
            return "Agent Skills"
        }
    }

    public var detail: String {
        switch self {
        case .instructions:
            return "These files define how the agent behaves, who it is, what project it is working in, and what instructions it follows."
        case .memory:
            return "These files store what the agent remembers between sessions."
        case .skills:
            return "Skills are reusable procedures and capabilities the agent can use for specific tasks."
        }
    }
}

public struct RuntimeWorkspaceUserFileGroup: Identifiable, Codable, Equatable, Sendable {
    public var id: String
    public var title: String
    public var detail: String
    public var items: [RuntimeWorkspaceUserFileItem]

    public init(id: String, title: String, detail: String, items: [RuntimeWorkspaceUserFileItem] = []) {
        self.id = id
        self.title = title
        self.detail = detail
        self.items = items
    }
}

public struct RuntimeWorkspaceUserFileItem: Identifiable, Codable, Equatable, Sendable {
    public var id: String
    public var title: String
    public var subtitle: String
    public var rootId: String
    public var rootLabel: String
    public var relativePath: String
    public var kind: RuntimeWorkspaceNodeKind
    public var isReadOnly: Bool
    public var isPNG: Bool
    public var isEditableText: Bool
    public var byteCount: Int?
    public var updatedAt: IsoTimestamp?
    public var runtimeSource: String
    public var mainFileRelativePath: String?
    public var supportingFileCount: Int?
    public var status: String?

    public init(
        id: String,
        title: String,
        subtitle: String,
        rootId: String,
        rootLabel: String,
        relativePath: String,
        kind: RuntimeWorkspaceNodeKind,
        isReadOnly: Bool,
        isPNG: Bool = false,
        isEditableText: Bool = false,
        byteCount: Int? = nil,
        updatedAt: IsoTimestamp? = nil,
        runtimeSource: String,
        mainFileRelativePath: String? = nil,
        supportingFileCount: Int? = nil,
        status: String? = nil
    ) {
        self.id = id
        self.title = title
        self.subtitle = subtitle
        self.rootId = rootId
        self.rootLabel = rootLabel
        self.relativePath = relativePath
        self.kind = kind
        self.isReadOnly = isReadOnly
        self.isPNG = isPNG
        self.isEditableText = isEditableText
        self.byteCount = byteCount
        self.updatedAt = updatedAt
        self.runtimeSource = runtimeSource
        self.mainFileRelativePath = mainFileRelativePath
        self.supportingFileCount = supportingFileCount
        self.status = status
    }
}

public final class RuntimeWorkspaceService {
    private struct CloudDocument {
        var id: String
        var folder: String
        var filename: String
        var documentKind: String
        var content: String
        var updatedAt: String

        var relativePath: String {
            folder.isEmpty ? filename : "\(folder)/\(filename)"
        }
    }

    private struct RootLocation {
        var root: RuntimeWorkspaceRoot
        var url: URL
    }

    private struct PurposeCandidate {
        var root: RuntimeWorkspaceRoot
        var rootURL: URL
        var url: URL
        var node: RuntimeWorkspaceNode
    }

    private let paths: RelayConsolePaths
    private let nativeFilePermissions: NativeFilePermissionService
    private let database: DatabaseService?
    private let fileManager: FileManager
    private let baselineStoreURL: URL
    private let hermesProfileBackups: HermesProfileBackupService?

    public init(
        paths: RelayConsolePaths,
        nativeFilePermissions: NativeFilePermissionService,
        database: DatabaseService? = nil,
        hermesProfileBackups: HermesProfileBackupService? = nil,
        fileManager: FileManager = .default
    ) {
        self.paths = paths
        self.nativeFilePermissions = nativeFilePermissions
        self.database = database
        self.hermesProfileBackups = hermesProfileBackups
        self.fileManager = fileManager
        self.baselineStoreURL = paths.root.appendingPathComponent("runtime-workspace-baselines.json")
    }

    public func snapshot(for agent: AgentWithBinding, agentLabel: String? = nil) -> RuntimeWorkspaceSnapshot {
        if isCloudAgent(agent) {
            let label = agentLabel?.trimmingCharacters(in: .whitespacesAndNewlines)
            let displayName = label?.isEmpty == false ? label! : agent.name
            return RuntimeWorkspaceSnapshot(
                agentId: agent.id,
                runtimeType: agent.binding.runtimeType,
                workspaceIdentity: workspaceIdentity(for: agent),
                roots: [cloudRoot(agent: agent, label: "\(displayName) cloud workspace")]
            )
        }
        let roots = rootLocations(for: agent, agentLabel: agentLabel).map(\.root)
        return RuntimeWorkspaceSnapshot(
            agentId: agent.id,
            runtimeType: agent.binding.runtimeType,
            workspaceIdentity: workspaceIdentity(for: agent),
            roots: roots
        )
    }

    public func listChildren(agent: AgentWithBinding, rootId: String, relativePath: String = "") throws -> [RuntimeWorkspaceNode] {
        if isCloudAgent(agent) {
            return try cloudListChildren(agent: agent, rootId: rootId, relativePath: relativePath)
        }
        let location = try rootLocation(agent: agent, rootId: rootId)
        let folderURL = try containedURL(root: location.url, relativePath: relativePath)
        if !fileManager.fileExists(atPath: folderURL.path) {
            if location.root.isReadOnly {
                return []
            }
            try fileManager.createDirectory(at: folderURL, withIntermediateDirectories: true)
        }
        var isDirectory: ObjCBool = false
        guard fileManager.fileExists(atPath: folderURL.path, isDirectory: &isDirectory), isDirectory.boolValue else {
            throw RelayError(.invalidInput, "Selected tree item is not a folder.")
        }

        let urls = try fileManager.contentsOfDirectory(
            at: folderURL,
            includingPropertiesForKeys: [.isDirectoryKey, .fileSizeKey, .contentModificationDateKey],
            options: [.skipsPackageDescendants]
        )
        return urls.compactMap { url in
            node(for: url, root: location.root, rootURL: location.url)
        }
        .sorted { lhs, rhs in
            if lhs.kind != rhs.kind {
                return lhs.kind == .folder
            }
            return lhs.name.localizedStandardCompare(rhs.name) == .orderedAscending
        }
    }

    public func readFile(agent: AgentWithBinding, rootId: String, relativePath: String) throws -> RuntimeWorkspaceFileDocument {
        if isCloudAgent(agent) {
            let document = try requireCloudDocument(agent: agent, relativePath: relativePath)
            return RuntimeWorkspaceFileDocument(
                rootId: rootId,
                relativePath: document.relativePath,
                filename: document.filename,
                markdown: document.content,
                updatedAt: document.updatedAt,
                byteCount: document.content.utf8.count
            )
        }
        let location = try rootLocation(agent: agent, rootId: rootId)
        let fileURL = try containedURL(root: location.url, relativePath: relativePath)
        guard isReadableText(url: fileURL) else {
            throw RelayError(.unsupported, "Only text files can be viewed in Relay Console.")
        }
        let markdown = try String(contentsOf: fileURL, encoding: .utf8)
        let values = try fileURL.resourceValues(forKeys: [.fileSizeKey, .contentModificationDateKey])
        return RuntimeWorkspaceFileDocument(
            rootId: rootId,
            relativePath: normalizedRelativePath(relativePath),
            filename: fileURL.lastPathComponent,
            markdown: markdown,
            updatedAt: values.contentModificationDate.map { ISO8601DateFormatter.relayConsole.string(from: $0) },
            byteCount: values.fileSize ?? markdown.utf8.count
        )
    }

    public func exportFile(agent: AgentWithBinding, rootId: String, relativePath: String) throws -> RuntimeWorkspaceFileExport {
        if isCloudAgent(agent) {
            let document = try requireCloudDocument(agent: agent, relativePath: relativePath)
            return RuntimeWorkspaceFileExport(filename: document.filename, data: Data(document.content.utf8))
        }
        let location = try rootLocation(agent: agent, rootId: rootId)
        let fileURL = try containedURL(root: location.url, relativePath: relativePath)
        var isDirectory: ObjCBool = false
        guard fileManager.fileExists(atPath: fileURL.path, isDirectory: &isDirectory), !isDirectory.boolValue else {
            throw RelayError(.invalidInput, "Select a file before downloading.")
        }
        guard isVisibleFile(url: fileURL) else {
            throw RelayError(.unsupported, "Only visible workspace files can be downloaded.")
        }
        return RuntimeWorkspaceFileExport(filename: fileURL.lastPathComponent, data: try Data(contentsOf: fileURL))
    }

    @discardableResult
    public func saveMarkdown(
        agent: AgentWithBinding,
        rootId: String,
        folderRelativePath: String,
        filename: String,
        markdown: String
    ) throws -> RuntimeWorkspaceFileDocument {
        if isCloudAgent(agent) {
            return try saveCloudMarkdown(
                agent: agent,
                rootId: rootId,
                folderRelativePath: folderRelativePath,
                filename: filename,
                markdown: markdown
            )
        }
        let location = try writableRootLocation(agent: agent, rootId: rootId)
        let safeFilename = try normalizedMarkdownFilename(filename)
        let folderURL = try containedURL(root: location.url, relativePath: folderRelativePath)
        guard !isReadOnlyURL(url: folderURL, root: location.root, rootURL: location.url, isDirectory: true) else {
            throw RelayError(.unsupported, "\(location.root.label) path is read-only.")
        }
        try fileManager.createDirectory(at: folderURL, withIntermediateDirectories: true)
        let fileURL = folderURL.appendingPathComponent(safeFilename, isDirectory: false)
        try assertContained(url: fileURL, root: location.url)
        guard !isReadOnlyURL(url: fileURL, root: location.root, rootURL: location.url, isDirectory: false) else {
            throw RelayError(.unsupported, "\(fileURL.lastPathComponent) is read-only.")
        }
        try markdown.write(to: fileURL, atomically: true, encoding: .utf8)
        let document = try readFile(
            agent: agent,
            rootId: rootId,
            relativePath: relativePath(for: fileURL, rootURL: location.url)
        )
        scheduleHermesProfileBackup(agent: agent, rootId: rootId, reason: "workspace-file-saved")
        return document
    }

    @discardableResult
    public func createSubfolder(
        agent: AgentWithBinding,
        rootId: String,
        parentRelativePath: String,
        name: String
    ) throws -> RuntimeWorkspaceNode {
        if isCloudAgent(agent) {
            let safeName = try normalizedPathComponent(name, field: "Folder name")
            let parent = normalizedRelativePath(parentRelativePath)
            let relative = parent.isEmpty ? safeName : "\(parent)/\(safeName)"
            return cloudFolderNode(rootId: rootId, relativePath: relative, updatedAt: nil)
        }
        let location = try writableRootLocation(agent: agent, rootId: rootId)
        let safeName = try normalizedPathComponent(name, field: "Folder name")
        let parentURL = try containedURL(root: location.url, relativePath: parentRelativePath)
        guard !isReadOnlyURL(url: parentURL, root: location.root, rootURL: location.url, isDirectory: true) else {
            throw RelayError(.unsupported, "\(location.root.label) path is read-only.")
        }
        let folderURL = parentURL.appendingPathComponent(safeName, isDirectory: true)
        try assertContained(url: folderURL, root: location.url)
        guard !isReadOnlyURL(url: folderURL, root: location.root, rootURL: location.url, isDirectory: true) else {
            throw RelayError(.unsupported, "\(safeName) is read-only.")
        }
        try fileManager.createDirectory(at: folderURL, withIntermediateDirectories: true)
        guard let node = node(for: folderURL, root: location.root, rootURL: location.url) else {
            throw RelayError(.internalError, "Created folder could not be loaded.")
        }
        scheduleHermesProfileBackup(agent: agent, rootId: rootId, reason: "workspace-folder-created")
        return node
    }

    @discardableResult
    public func importFile(
        agent: AgentWithBinding,
        rootId: String,
        folderRelativePath: String,
        sourceURL: URL,
        kind: RuntimeWorkspaceFileImportKind
    ) throws -> RuntimeWorkspaceNode {
        if isCloudAgent(agent) {
            guard kind == .markdown else {
                throw RelayError(.unsupported, "Relay agent workspaces currently synchronize text and Markdown files.")
            }
            try validateImport(sourceURL: sourceURL, kind: kind)
            let markdown = try String(contentsOf: sourceURL, encoding: .utf8)
            let document = try saveCloudMarkdown(
                agent: agent,
                rootId: rootId,
                folderRelativePath: folderRelativePath,
                filename: sourceURL.lastPathComponent,
                markdown: markdown
            )
            return cloudFileNode(
                rootId: rootId,
                relativePath: document.relativePath,
                content: document.markdown,
                updatedAt: document.updatedAt
            )
        }
        let location = try writableRootLocation(agent: agent, rootId: rootId)
        try validateImport(sourceURL: sourceURL, kind: kind)
        let folderURL = try containedURL(root: location.url, relativePath: folderRelativePath)
        guard !isReadOnlyURL(url: folderURL, root: location.root, rootURL: location.url, isDirectory: true) else {
            throw RelayError(.unsupported, "\(location.root.label) path is read-only.")
        }
        try fileManager.createDirectory(at: folderURL, withIntermediateDirectories: true)
        let destination = folderURL.appendingPathComponent(sourceURL.lastPathComponent, isDirectory: false)
        try assertContained(url: destination, root: location.url)
        guard !isReadOnlyURL(url: destination, root: location.root, rootURL: location.url, isDirectory: false) else {
            throw RelayError(.unsupported, "\(destination.lastPathComponent) is read-only.")
        }
        if fileManager.fileExists(atPath: destination.path) {
            try fileManager.removeItem(at: destination)
        }
        try fileManager.copyItem(at: sourceURL, to: destination)
        guard let node = node(for: destination, root: location.root, rootURL: location.url) else {
            throw RelayError(.internalError, "Imported file could not be loaded.")
        }
        scheduleHermesProfileBackup(agent: agent, rootId: rootId, reason: "workspace-file-imported")
        return node
    }

    @discardableResult
    public func deleteNode(agent: AgentWithBinding, rootId: String, relativePath: String) throws -> RuntimeWorkspaceNodeKind {
        if isCloudAgent(agent) {
            return try deleteCloudNode(agent: agent, relativePath: relativePath)
        }
        let location = try writableRootLocation(agent: agent, rootId: rootId)
        let cleanPath = normalizedRelativePath(relativePath)
        guard !cleanPath.isEmpty else {
            throw RelayError(.invalidInput, "Root folders cannot be deleted.")
        }
        let url = try containedURL(root: location.url, relativePath: cleanPath)
        var isDirectory: ObjCBool = false
        guard fileManager.fileExists(atPath: url.path, isDirectory: &isDirectory) else {
            throw RelayError(.notFound, "Selected file or folder does not exist.")
        }
        let kind: RuntimeWorkspaceNodeKind = isDirectory.boolValue ? .folder : .file
        guard !isReadOnlyURL(url: url, root: location.root, rootURL: location.url, isDirectory: isDirectory.boolValue) else {
            throw RelayError(.unsupported, "\(url.lastPathComponent) is read-only.")
        }
        try fileManager.removeItem(at: url)
        scheduleHermesProfileBackup(agent: agent, rootId: rootId, reason: "workspace-entry-deleted")
        return kind
    }

    public func listBaselines(agentId: RelayId) throws -> [RuntimeWorkspaceBaseline] {
        try readBaselines()
            .filter { $0.agentId == agentId }
            .sorted { $0.updatedAt > $1.updatedAt }
    }

    @discardableResult
    public func saveBaseline(
        agentId: RelayId,
        baselineId: RelayId? = nil,
        name: String,
        markdown: String,
        now: Date = Date()
    ) throws -> RuntimeWorkspaceBaseline {
        let cleanName = try requireNonEmptyString(name, field: "Baseline name", maxLength: 180)
        let cleanMarkdown = try requireNonEmptyString(markdown, field: "Baseline markdown", maxLength: 500_000)
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
        var baselines = try readBaselines()
        if let baselineId, let index = baselines.firstIndex(where: { $0.id == baselineId && $0.agentId == agentId }) {
            baselines[index].name = cleanName
            baselines[index].markdown = cleanMarkdown
            baselines[index].updatedAt = timestamp
            try writeBaselines(baselines)
            return baselines[index]
        }
        let baseline = RuntimeWorkspaceBaseline(
            id: baselineId ?? createRelayId("rwb"),
            agentId: agentId,
            name: cleanName,
            markdown: cleanMarkdown,
            createdAt: timestamp,
            updatedAt: timestamp
        )
        baselines.append(baseline)
        try writeBaselines(baselines)
        return baseline
    }

    public func deleteBaseline(agentId: RelayId, baselineId: RelayId) throws {
        let baselines = try readBaselines()
        try writeBaselines(baselines.filter { !($0.agentId == agentId && $0.id == baselineId) })
    }

    public func linkedLocalSummary(
        context: ServiceRequestContext,
        agent: AgentWithBinding,
        rootId: String,
        relativePath: String,
        targetKind: NativeFilePermissionTargetKind
    ) throws -> RuntimeWorkspaceLinkedLocalSummary {
        guard let permission = try linkedPermission(
            context: context,
            agent: agent,
            rootId: rootId,
            relativePath: relativePath,
            targetKind: targetKind
        ) else {
            return .notLinked
        }
        let result: String
        if let failure = permission.failureReason, !failure.isEmpty {
            result = failure
        } else if permission.lastSyncedAt != nil {
            result = NativeFilePermissionService.statusTitle(for: permission)
        } else {
            result = "Native permission linked; sync execution is guarded until security-scoped bookmark resolution is enabled."
        }
        return RuntimeWorkspaceLinkedLocalSummary(
            permissionId: permission.id,
            linkedTo: permission.displayPath,
            lastSyncedAt: permission.lastSyncedAt,
            lastResult: result,
            status: permission.status,
            statusTitle: NativeFilePermissionService.statusTitle(for: permission)
        )
    }

    @discardableResult
    public func linkLocalTarget(
        context: ServiceRequestContext,
        agent: AgentWithBinding,
        rootId: String,
        relativePath: String,
        targetKind: NativeFilePermissionTargetKind,
        displayName: String,
        rawPath: String,
        bookmarkRef: String,
        now: Date = Date()
    ) throws -> NativeFilePermissionRecord {
        try nativeFilePermissions.linkPermission(
            context: context,
            request: NativeFilePermissionRequest(
                targetKind: targetKind,
                displayName: displayName,
                rawPath: rawPath,
                bookmarkRef: bookmarkRef,
                accessLevel: .readWrite,
                status: .readWriteGranted,
                metadata: linkMetadata(agent: agent, rootId: rootId, relativePath: relativePath, targetKind: targetKind)
            ),
            now: now
        )
    }

    @discardableResult
    public func syncFromLocal(
        context: ServiceRequestContext,
        agent: AgentWithBinding,
        rootId: String,
        relativePath: String,
        targetKind: NativeFilePermissionTargetKind,
        now: Date = Date()
    ) throws -> NativeFilePermissionRecord {
        try markSyncUnavailable(
            context: context,
            agent: agent,
            rootId: rootId,
            relativePath: relativePath,
            targetKind: targetKind,
            direction: "Sync from local",
            now: now
        )
    }

    @discardableResult
    public func syncToLocal(
        context: ServiceRequestContext,
        agent: AgentWithBinding,
        rootId: String,
        relativePath: String,
        targetKind: NativeFilePermissionTargetKind,
        now: Date = Date()
    ) throws -> NativeFilePermissionRecord {
        try markSyncUnavailable(
            context: context,
            agent: agent,
            rootId: rootId,
            relativePath: relativePath,
            targetKind: targetKind,
            direction: "Sync to local",
            now: now
        )
    }

    public func rootKind(rootId: String) -> RuntimeWorkspaceRootKind? {
        RuntimeWorkspaceRootKind(rawValue: rootId)
    }

    public func workspaceIdentity(for agent: AgentWithBinding) -> String {
        let candidate = agent.binding.externalAgentId ?? agent.externalId ?? agent.id
        let cleaned = candidate.trimmingCharacters(in: .whitespacesAndNewlines)
        return cleaned.isEmpty ? agent.id : cleaned
    }

    public func userFileGroups(for agent: AgentWithBinding, section: RuntimeWorkspaceUserSection) -> [RuntimeWorkspaceUserFileGroup] {
        if isCloudAgent(agent) {
            return (try? cloudUserFileGroups(for: agent, section: section)) ?? defaultUserGroups(for: section)
        }
        var groups = defaultUserGroups(for: section)
        let locations = rootLocations(for: agent, agentLabel: nil)
        let candidates = locations.flatMap { collectPurposeCandidates(location: $0, section: section, maxDepth: section == .skills ? 4 : 5) }
        for candidate in candidates {
            switch section {
            case .instructions:
                guard candidate.node.kind == .file,
                      let groupId = instructionGroupId(for: candidate.node.name) else {
                    continue
                }
                appendUserItem(
                    node: candidate.node,
                    root: candidate.root,
                    agent: agent,
                    groupId: groupId,
                    groups: &groups
                )
            case .memory:
                guard let groupId = memoryGroupId(for: candidate.node) else {
                    continue
                }
                appendUserItem(
                    node: candidate.node,
                    root: candidate.root,
                    agent: agent,
                    groupId: groupId,
                    groups: &groups
                )
            case .skills:
                guard candidate.node.kind == .folder,
                      isSkillPackage(candidate.node, at: candidate.url) else {
                    continue
                }
                let mainFile = skillMainFileRelativePath(candidate.node)
                let supportingCount = skillSupportingFileCount(skillURL: candidate.url, root: candidate.root, rootURL: candidate.rootURL)
                appendUserItem(
                    node: candidate.node,
                    root: candidate.root,
                    agent: agent,
                    groupId: "installed-skills",
                    groups: &groups,
                    mainFileRelativePath: mainFile,
                    supportingFileCount: supportingCount,
                    status: "Installed"
                )
            }
        }
        return groups.map { group in
            var sorted = group
            sorted.items = group.items.sorted { lhs, rhs in
                lhs.title.localizedStandardCompare(rhs.title) == .orderedAscending
            }
            return sorted
        }
    }

    public func defaultTarget(for agent: AgentWithBinding, section: RuntimeWorkspaceUserSection) -> (rootId: String, relativePath: String)? {
        if isCloudAgent(agent) {
            switch section {
            case .instructions:
                return (RuntimeWorkspaceRootKind.agentWorkspace.rawValue, "")
            case .memory:
                return (RuntimeWorkspaceRootKind.agentWorkspace.rawValue, "memory")
            case .skills:
                return (RuntimeWorkspaceRootKind.agentWorkspace.rawValue, "skills")
            }
        }
        switch (agent.binding.runtimeType, section) {
        case (.hermes, .instructions):
            return (RuntimeWorkspaceRootKind.hermesProfile.rawValue, "")
        case (.hermes, .memory):
            return (RuntimeWorkspaceRootKind.hermesProfile.rawValue, "memories")
        case (.hermes, .skills):
            return (RuntimeWorkspaceRootKind.hermesProfile.rawValue, "skills")
        case (.openclaw, .instructions):
            return (RuntimeWorkspaceRootKind.agentWorkspace.rawValue, "")
        case (.openclaw, .memory):
            return (RuntimeWorkspaceRootKind.agentWorkspace.rawValue, "memory")
        case (.openclaw, .skills):
            return (RuntimeWorkspaceRootKind.agentWorkspace.rawValue, "skills")
        default:
            return nil
        }
    }

    private func isCloudAgent(_ agent: AgentWithBinding) -> Bool {
        agent.binding.adapterKind == "railway_cloud" && database != nil
    }

    private func scheduleHermesProfileBackup(
        agent: AgentWithBinding,
        rootId: String,
        reason: String
    ) {
        guard agent.binding.runtimeType == .hermes,
              rootId == RuntimeWorkspaceRootKind.hermesProfile.rawValue
                || rootId == RuntimeWorkspaceRootKind.agentWorkspace.rawValue,
              let service = hermesProfileBackups,
              let profileSlug = agent.binding.hermesProfileSlug,
              let profileHomePath = agent.binding.hermesHomePath
        else { return }
        service.scheduleCheckpoint(
            profileHome: URL(fileURLWithPath: profileHomePath, isDirectory: true),
            profileSlug: profileSlug,
            agentId: agent.id,
            reason: reason,
            runtimeVersion: stringValue(agent.harness.config["installedVersion"]),
            workspaceHome: agent.binding.workspaceFolderPath.map {
                URL(fileURLWithPath: $0, isDirectory: true)
            }
        )
    }

    private func cloudRoot(agent: AgentWithBinding, label: String) -> RuntimeWorkspaceRoot {
        RuntimeWorkspaceRoot(
            rootId: RuntimeWorkspaceRootKind.agentWorkspace.rawValue,
            kind: .agentWorkspace,
            label: label,
            isReadOnly: false,
            exists: true,
            displayPath: "\(label) ([RELAY CLOUD])"
        )
    }

    private func cloudDocuments(agent: AgentWithBinding) throws -> [CloudDocument] {
        guard let database else {
            throw RelayError(.databaseUnavailable, "Relay document storage is unavailable.")
        }
        return try database.all(
            "SELECT id,folder,filename,document_kind,content,updated_at FROM agent_documents WHERE agent_id=? AND root='agent' ORDER BY folder,filename",
            [.text(agent.id)]
        ).compactMap { row in
            guard let id = row["id"]?.string,
                  let filename = row["filename"]?.string,
                  let content = row["content"]?.string else { return nil }
            return CloudDocument(
                id: id,
                folder: row["folder"]?.string ?? "",
                filename: filename,
                documentKind: row["document_kind"]?.string ?? "instruction",
                content: content,
                updatedAt: row["updated_at"]?.string ?? nowIso()
            )
        }
    }

    private func requireCloudDocument(agent: AgentWithBinding, relativePath: String) throws -> CloudDocument {
        let cleanPath = normalizedRelativePath(relativePath)
        let components = cleanPath.split(separator: "/").map(String.init)
        guard let filename = components.last, !filename.isEmpty else {
            throw RelayError(.invalidInput, "Select a Relay file first.")
        }
        let folder = components.dropLast().joined(separator: "/")
        guard let document = try cloudDocuments(agent: agent).first(where: {
            $0.folder == folder && $0.filename == filename
        }) else {
            throw RelayError(.notFound, "Relay agent file was not found.")
        }
        return document
    }

    private func cloudListChildren(
        agent: AgentWithBinding,
        rootId: String,
        relativePath: String
    ) throws -> [RuntimeWorkspaceNode] {
        let folder = normalizedRelativePath(relativePath)
        let prefix = folder.isEmpty ? "" : "\(folder)/"
        var folders: [String: String] = [:]
        var files: [RuntimeWorkspaceNode] = []

        for document in try cloudDocuments(agent: agent) {
            guard document.relativePath.hasPrefix(prefix) else { continue }
            let remainder = String(document.relativePath.dropFirst(prefix.count))
            let parts = remainder.split(separator: "/").map(String.init)
            guard let first = parts.first else { continue }
            if parts.count > 1 {
                let childPath = folder.isEmpty ? first : "\(folder)/\(first)"
                if let current = folders[childPath] {
                    folders[childPath] = max(current, document.updatedAt)
                } else {
                    folders[childPath] = document.updatedAt
                }
            } else {
                files.append(cloudFileNode(
                    rootId: rootId,
                    relativePath: document.relativePath,
                    content: document.content,
                    updatedAt: document.updatedAt
                ))
            }
        }

        let folderNodes = folders.map { path, updatedAt in
            cloudFolderNode(rootId: rootId, relativePath: path, updatedAt: updatedAt)
        }
        return (folderNodes + files).sorted { lhs, rhs in
            if lhs.kind != rhs.kind { return lhs.kind == .folder }
            return lhs.name.localizedStandardCompare(rhs.name) == .orderedAscending
        }
    }

    private func cloudFileNode(
        rootId: String,
        relativePath: String,
        content: String,
        updatedAt: String?
    ) -> RuntimeWorkspaceNode {
        RuntimeWorkspaceNode(
            nodeId: nodeId(rootId: rootId, relativePath: relativePath),
            rootId: rootId,
            name: URL(fileURLWithPath: relativePath).lastPathComponent,
            relativePath: relativePath,
            kind: .file,
            isReadOnly: false,
            isPNG: false,
            isEditableText: true,
            byteCount: content.utf8.count,
            updatedAt: updatedAt
        )
    }

    private func cloudFolderNode(
        rootId: String,
        relativePath: String,
        updatedAt: String?
    ) -> RuntimeWorkspaceNode {
        RuntimeWorkspaceNode(
            nodeId: nodeId(rootId: rootId, relativePath: relativePath),
            rootId: rootId,
            name: URL(fileURLWithPath: relativePath).lastPathComponent,
            relativePath: relativePath,
            kind: .folder,
            isReadOnly: false,
            isPNG: false,
            isEditableText: false,
            byteCount: nil,
            updatedAt: updatedAt
        )
    }

    private func saveCloudMarkdown(
        agent: AgentWithBinding,
        rootId: String,
        folderRelativePath: String,
        filename: String,
        markdown: String
    ) throws -> RuntimeWorkspaceFileDocument {
        guard let database else {
            throw RelayError(.databaseUnavailable, "Relay document storage is unavailable.")
        }
        let safeFilename = try normalizedMarkdownFilename(filename)
        let folder = try safeCloudFolder(folderRelativePath)
        guard markdown.utf8.count <= 500_000 else {
            throw RelayError(.invalidInput, "Relay agent files cannot exceed 500 KB.")
        }
        let existing = try database.get(
            "SELECT id,created_at FROM agent_documents WHERE agent_id=? AND root='agent' AND folder=? AND filename=?",
            [.text(agent.id), .text(folder), .text(safeFilename)]
        )
        let id = existing?["id"]?.string ?? createRelayId("agd")
        let timestamp = nowIso()
        let digest = SHA256.hash(data: Data(markdown.utf8)).map { String(format: "%02x", $0) }.joined()
        let kind = cloudDocumentKind(folder: folder, filename: safeFilename)
        try database.run(
            """
                INSERT INTO agent_documents(id,workspace_id,agent_id,runtime_type,root,folder,filename,document_kind,content,content_hash,created_at,updated_at) VALUES(?,?,?,?,? ,?,?,?,?,?,?,?) ON CONFLICT(agent_id,root,folder,filename) \
                DO UPDATE SET runtime_type=excluded.runtime_type,document_kind=excluded.document_kind,content=excluded.content,content_hash=excluded.content_hash,updated_at=excluded.updated_at
                """,
            [
                .text(id), .text(agent.workspaceId), .text(agent.id), .text(agent.binding.runtimeType.rawValue),
                .text("agent"), .text(folder), .text(safeFilename), .text(kind), .text(markdown), .text(digest),
                .text(existing?["created_at"]?.string ?? timestamp), .text(timestamp)
            ]
        )
        let relativePath = folder.isEmpty ? safeFilename : "\(folder)/\(safeFilename)"
        return RuntimeWorkspaceFileDocument(
            rootId: rootId,
            relativePath: relativePath,
            filename: safeFilename,
            markdown: markdown,
            updatedAt: timestamp,
            byteCount: markdown.utf8.count
        )
    }

    private func safeCloudFolder(_ rawValue: String) throws -> String {
        let clean = normalizedRelativePath(rawValue)
        let components = clean.split(separator: "/").map(String.init)
        guard components.count <= 6 else {
            throw RelayError(.invalidInput, "Relay agent folders can be at most six levels deep.")
        }
        for component in components {
            _ = try normalizedPathComponent(component, field: "Folder name")
        }
        return components.joined(separator: "/")
    }

    private func cloudDocumentKind(folder: String, filename: String) -> String {
        let components = folder.lowercased().split(separator: "/").map(String.init)
        if components.contains("skills") { return "skill" }
        if components.contains("memory") || components.contains("memories") { return "memory" }
        if folder.lowercased() == "cron" && filename.lowercased() == "jobs.json" { return "cron" }
        return "instruction"
    }

    private func deleteCloudNode(agent: AgentWithBinding, relativePath: String) throws -> RuntimeWorkspaceNodeKind {
        guard let database else {
            throw RelayError(.databaseUnavailable, "Relay document storage is unavailable.")
        }
        let cleanPath = normalizedRelativePath(relativePath)
        guard !cleanPath.isEmpty else {
            throw RelayError(.invalidInput, "Root folders cannot be deleted.")
        }
        let documents = try cloudDocuments(agent: agent)
        if let file = documents.first(where: { $0.relativePath == cleanPath }) {
            try database.run("DELETE FROM agent_documents WHERE id=?", [.text(file.id)])
            return .file
        }
        let prefix = "\(cleanPath)/"
        let children = documents.filter { $0.relativePath.hasPrefix(prefix) }
        guard !children.isEmpty else {
            throw RelayError(.notFound, "Relay agent file or folder was not found.")
        }
        for document in children {
            try database.run("DELETE FROM agent_documents WHERE id=?", [.text(document.id)])
        }
        return .folder
    }

    private func cloudUserFileGroups(
        for agent: AgentWithBinding,
        section: RuntimeWorkspaceUserSection
    ) throws -> [RuntimeWorkspaceUserFileGroup] {
        var groups = defaultUserGroups(for: section)
        let documents = try cloudDocuments(agent: agent)
        let root = cloudRoot(agent: agent, label: "\(agent.name) cloud workspace")

        switch section {
        case .instructions:
            for document in documents where document.documentKind == "instruction" {
                let node = cloudFileNode(
                    rootId: root.rootId,
                    relativePath: document.relativePath,
                    content: document.content,
                    updatedAt: document.updatedAt
                )
                let groupId = instructionGroupId(for: document.filename) ?? "workspace-instructions"
                appendUserItem(node: node, root: root, agent: agent, groupId: groupId, groups: &groups)
            }
        case .memory:
            for document in documents where document.documentKind == "memory" {
                let node = cloudFileNode(
                    rootId: root.rootId,
                    relativePath: document.relativePath,
                    content: document.content,
                    updatedAt: document.updatedAt
                )
                let groupId = memoryGroupId(for: node) ?? "pinned-memory"
                appendUserItem(node: node, root: root, agent: agent, groupId: groupId, groups: &groups)
            }
        case .skills:
            let skillDocuments = documents.filter { $0.documentKind == "skill" }
            let packageFolders = Set(skillDocuments.compactMap { document -> String? in
                let parts = document.relativePath.split(separator: "/").map(String.init)
                guard let skillsIndex = parts.firstIndex(where: { $0.lowercased() == "skills" }),
                      skillsIndex + 1 < parts.count else { return nil }
                return parts[0...skillsIndex + 1].joined(separator: "/")
            })
            for folder in packageFolders.sorted() {
                let packageDocuments = skillDocuments.filter {
                    $0.relativePath == folder || $0.relativePath.hasPrefix("\(folder)/")
                }
                guard packageDocuments.contains(where: { $0.filename.lowercased() == "skill.md" }) else { continue }
                let updatedAt = packageDocuments.map(\.updatedAt).max()
                let node = cloudFolderNode(rootId: root.rootId, relativePath: folder, updatedAt: updatedAt)
                appendUserItem(
                    node: node,
                    root: root,
                    agent: agent,
                    groupId: "installed-skills",
                    groups: &groups,
                    mainFileRelativePath: "\(folder)/SKILL.md",
                    supportingFileCount: max(0, packageDocuments.count - 1),
                    status: "Installed"
                )
            }
        }

        return groups.map { group in
            var sorted = group
            sorted.items = group.items.sorted { $0.title.localizedStandardCompare($1.title) == .orderedAscending }
            return sorted
        }
    }

    private func markSyncUnavailable(
        context: ServiceRequestContext,
        agent: AgentWithBinding,
        rootId: String,
        relativePath: String,
        targetKind: NativeFilePermissionTargetKind,
        direction: String,
        now: Date
    ) throws -> NativeFilePermissionRecord {
        guard let permission = try linkedPermission(
            context: context,
            agent: agent,
            rootId: rootId,
            relativePath: relativePath,
            targetKind: targetKind
        ) else {
            throw RelayError(.invalidInput, "Link a local \(targetKind.rawValue) before syncing.")
        }
        return try nativeFilePermissions.updateStatus(
            context: context,
            permissionId: permission.id,
            status: .syncFailed,
            failureReason: "\(direction) is unavailable until persisted security-scoped bookmark resolution is enabled for linked local sync.",
            now: now
        )
    }

    private func linkedPermission(
        context: ServiceRequestContext,
        agent: AgentWithBinding,
        rootId: String,
        relativePath: String,
        targetKind: NativeFilePermissionTargetKind
    ) throws -> NativeFilePermissionRecord? {
        let cleanPath = normalizedRelativePath(relativePath)
        return try nativeFilePermissions.listPermissions(context: context, limit: 500)
            .filter { permission in
                permission.targetKind == targetKind
                    && permission.metadata["rwAgent"] == .string(agent.id)
                    && permission.metadata["rwSlot"] == .string(rootId)
                    && permission.metadata["rwNode"] == .string(cleanPath)
            }
            .sorted { $0.updatedAt > $1.updatedAt }
            .first
    }

    private func linkMetadata(
        agent: AgentWithBinding,
        rootId: String,
        relativePath: String,
        targetKind: NativeFilePermissionTargetKind
    ) -> JSONRecord {
        [
            "runtimeWorkspaceLinkedLocalSync": .bool(true),
            "rwAgent": .string(agent.id),
            "rwSlot": .string(rootId),
            "rwNode": .string(normalizedRelativePath(relativePath)),
            "rwTarget": .string(targetKind.rawValue),
            "runtimeType": .string(agent.binding.runtimeType.rawValue),
            "rawPathPersisted": .bool(false),
            "securityScopedBookmarkRequired": .bool(true),
            "syncExecutionUnavailable": .bool(true)
        ]
    }

    private func defaultUserGroups(for section: RuntimeWorkspaceUserSection) -> [RuntimeWorkspaceUserFileGroup] {
        switch section {
        case .instructions:
            return [
                RuntimeWorkspaceUserFileGroup(id: "identity", title: "Identity", detail: "Who this agent is and how it presents itself."),
                RuntimeWorkspaceUserFileGroup(id: "user-profile", title: "User Profile", detail: "Useful context about the person or account the agent serves."),
                RuntimeWorkspaceUserFileGroup(id: "workspace-instructions", title: "Workspace Instructions", detail: "Project and workspace rules the agent should follow."),
                RuntimeWorkspaceUserFileGroup(id: "tool-guidance", title: "Tool Guidance", detail: "How this agent should use available tools."),
                RuntimeWorkspaceUserFileGroup(id: "background-routine", title: "Background Routine", detail: "Recurring heartbeat or background behavior.")
            ]
        case .memory:
            return [
                RuntimeWorkspaceUserFileGroup(id: "pinned-memory", title: "Pinned Memory", detail: "Stable facts and continuity notes."),
                RuntimeWorkspaceUserFileGroup(id: "daily-memory", title: "Daily Memory", detail: "Dated notes that help the agent keep continuity over time."),
                RuntimeWorkspaceUserFileGroup(id: "session-summaries", title: "Session Summaries", detail: "Readable summaries of past work, not raw runtime logs.")
            ]
        case .skills:
            return [
                RuntimeWorkspaceUserFileGroup(id: "installed-skills", title: "Installed Skills", detail: "Reusable procedures available to this agent.")
            ]
        }
    }

    private func appendUserItem(
        node: RuntimeWorkspaceNode,
        root: RuntimeWorkspaceRoot,
        agent: AgentWithBinding,
        groupId: String,
        groups: inout [RuntimeWorkspaceUserFileGroup],
        mainFileRelativePath: String? = nil,
        supportingFileCount: Int? = nil,
        status: String? = nil
    ) {
        guard let groupIndex = groups.firstIndex(where: { $0.id == groupId }) else { return }
        let itemId = "\(groupId):\(node.rootId):\(node.relativePath)"
        guard !groups[groupIndex].items.contains(where: { $0.id == itemId }) else { return }
        let item = RuntimeWorkspaceUserFileItem(
            id: itemId,
            title: node.name,
            subtitle: userItemSubtitle(node: node, root: root),
            rootId: node.rootId,
            rootLabel: root.label,
            relativePath: node.relativePath,
            kind: node.kind,
            isReadOnly: node.isReadOnly,
            isPNG: node.isPNG,
            isEditableText: node.isEditableText,
            byteCount: node.byteCount,
            updatedAt: node.updatedAt,
            runtimeSource: runtimeLabel(for: agent.binding.runtimeType),
            mainFileRelativePath: mainFileRelativePath,
            supportingFileCount: supportingFileCount,
            status: status
        )
        groups[groupIndex].items.append(item)
    }

    private func userItemSubtitle(node: RuntimeWorkspaceNode, root: RuntimeWorkspaceRoot) -> String {
        let cleanPath = normalizedRelativePath(node.relativePath)
        if cleanPath.isEmpty {
            return root.label
        }
        return "\(root.label)/\(cleanPath)"
    }

    private func runtimeLabel(for runtimeType: RuntimeType) -> String {
        switch runtimeType {
        case .hermes:
            return "Hermes"
        case .openclaw:
            return "OpenClaw"
        case .relayEcho:
            return "Relay Echo"
        case .claudeCode:
            return "Claude Code"
        case .codexCli:
            return "Codex CLI"
        }
    }

    private func instructionGroupId(for filename: String) -> String? {
        switch filename.lowercased() {
        case "soul.md", "identity.md":
            return "identity"
        case "user.md":
            return "user-profile"
        case "agents.md", ".hermes.md", "hermes.md", "claude.md", ".cursorrules":
            return "workspace-instructions"
        case "tools.md":
            return "tool-guidance"
        case "heartbeat.md":
            return "background-routine"
        default:
            return nil
        }
    }

    private func memoryGroupId(for node: RuntimeWorkspaceNode) -> String? {
        guard !isInternalRuntimeNode(node) else { return nil }
        let name = node.name.lowercased()
        let components = normalizedRelativePath(node.relativePath).split(separator: "/").map { String($0).lowercased() }
        let isInMemoryLocation = components.dropLast().contains { $0 == "memory" || $0 == "memories" }
        if node.kind == .folder, ["memory", "memories"].contains(name) {
            return "pinned-memory"
        }
        guard node.kind == .file else { return nil }
        if name == "memory.md" || (name == "user.md" && isInMemoryLocation) {
            return "pinned-memory"
        }
        if isDailyMemoryFile(node) {
            return "daily-memory"
        }
        if isSessionSummaryFile(node) {
            return "session-summaries"
        }
        return nil
    }

    private func isDailyMemoryFile(_ node: RuntimeWorkspaceNode) -> Bool {
        let path = node.relativePath.lowercased()
        guard node.isEditableText || node.name.lowercased().hasSuffix(".json") else { return false }
        if path.range(of: #"\d{4}[-_]\d{2}[-_]\d{2}"#, options: .regularExpression) != nil {
            return true
        }
        return path.contains("daily") && (path.contains("memory") || path.contains("memories"))
    }

    private func isSessionSummaryFile(_ node: RuntimeWorkspaceNode) -> Bool {
        let path = node.relativePath.lowercased()
        guard node.isEditableText || node.name.lowercased().hasSuffix(".json") else { return false }
        let looksLikeSummary = path.contains("summary") || path.contains("summaries") || path.contains("wrap-up") || path.contains("wrapup")
        guard looksLikeSummary else { return false }
        return path.contains("session") || path.contains("conversation") || path.contains("handover")
    }

    private func isSkillPackage(_ node: RuntimeWorkspaceNode, at url: URL) -> Bool {
        let parts = normalizedRelativePath(node.relativePath).split(separator: "/").map { String($0).lowercased() }
        guard parts.count >= 2 else { return false }
        guard parts.dropLast().contains("skills") else { return false }
        return fileManager.fileExists(atPath: url.appendingPathComponent("SKILL.md").path)
    }

    private func skillMainFileRelativePath(_ node: RuntimeWorkspaceNode) -> String {
        let base = normalizedRelativePath(node.relativePath)
        return base.isEmpty ? "SKILL.md" : "\(base)/SKILL.md"
    }

    private func skillSupportingFileCount(skillURL: URL, root: RuntimeWorkspaceRoot, rootURL: URL) -> Int {
        guard fileManager.fileExists(atPath: skillURL.path) else { return 0 }
        let urls = (try? fileManager.subpathsOfDirectory(atPath: skillURL.path)) ?? []
        return urls.reduce(0) { total, path in
            let url = skillURL.appendingPathComponent(path)
            var isDirectory: ObjCBool = false
            guard fileManager.fileExists(atPath: url.path, isDirectory: &isDirectory), !isDirectory.boolValue else {
                return total
            }
            guard let node = node(for: url, root: root, rootURL: rootURL), !isInternalRuntimeNode(node) else {
                return total
            }
            return total + (node.name.lowercased() == "skill.md" ? 0 : 1)
        }
    }

    private func collectPurposeCandidates(location: RootLocation, section: RuntimeWorkspaceUserSection, maxDepth: Int) -> [PurposeCandidate] {
        guard fileManager.fileExists(atPath: location.url.path) else { return [] }
        var output: [PurposeCandidate] = []
        collectPurposeCandidates(
            location: location,
            folderURL: location.url,
            section: section,
            maxDepth: maxDepth,
            depth: 0,
            output: &output
        )
        return output
    }

    private func collectPurposeCandidates(
        location: RootLocation,
        folderURL: URL,
        section: RuntimeWorkspaceUserSection,
        maxDepth: Int,
        depth: Int,
        output: inout [PurposeCandidate]
    ) {
        guard depth <= maxDepth,
              let urls = try? fileManager.contentsOfDirectory(
                at: folderURL,
                includingPropertiesForKeys: [.isDirectoryKey, .fileSizeKey, .contentModificationDateKey],
                options: [.skipsPackageDescendants]
              ) else {
            return
        }
        for url in urls {
            guard let node = node(for: url, root: location.root, rootURL: location.url) else { continue }
            let candidate = PurposeCandidate(root: location.root, rootURL: location.url, url: url, node: node)
            if shouldIncludePurposeCandidate(candidate, section: section) {
                output.append(candidate)
            }
            guard node.kind == .folder, depth < maxDepth else { continue }
            if shouldDescendInto(node, section: section) {
                collectPurposeCandidates(
                    location: location,
                    folderURL: url,
                    section: section,
                    maxDepth: maxDepth,
                    depth: depth + 1,
                    output: &output
                )
            }
        }
    }

    private func shouldIncludePurposeCandidate(_ candidate: PurposeCandidate, section: RuntimeWorkspaceUserSection) -> Bool {
        switch section {
        case .instructions:
            return candidate.node.kind == .file && instructionGroupId(for: candidate.node.name) != nil
        case .memory:
            return memoryGroupId(for: candidate.node) != nil
        case .skills:
            return candidate.node.kind == .folder && isSkillPackage(candidate.node, at: candidate.url)
        }
    }

    private func shouldDescendInto(_ node: RuntimeWorkspaceNode, section: RuntimeWorkspaceUserSection) -> Bool {
        if isInternalRuntimeNode(node) {
            return false
        }
        let name = node.name.lowercased()
        switch section {
        case .instructions:
            return !["memory", "memories", "skills"].contains(name)
        case .memory:
            return name != "skills"
        case .skills:
            let path = normalizedRelativePath(node.relativePath).lowercased()
            return name == "skills" || path.hasPrefix("skills/") || path.contains("/skills/")
        }
    }

    private func isInternalRuntimeNode(_ node: RuntimeWorkspaceNode) -> Bool {
        let name = node.name.lowercased()
        if runtimeInternalNodeNames.contains(name) {
            return true
        }
        if name.hasSuffix(".db") || name.hasSuffix(".sqlite") || name.hasSuffix(".sqlite3") || name.hasSuffix("-wal") || name.hasSuffix("-shm") {
            return true
        }
        return false
    }

    private var runtimeInternalNodeNames: Set<String> {
        [
            "audio_cache",
            "image_cache",
            "cache",
            "caches",
            "bin",
            "hooks",
            "logs",
            "pairing",
            "sessions",
            "skins",
            "state.db",
            "profile.yaml",
            "config.yaml",
            "openclaw-agent.sqlite",
            "openclaw-agent.sqlite-wal",
            "openclaw-agent.sqlite-shm",
            "auth-profiles.json"
        ]
    }

    private func rootLocation(agent: AgentWithBinding, rootId: String) throws -> RootLocation {
        guard let location = rootLocations(for: agent, agentLabel: nil).first(where: { $0.root.rootId == rootId }) else {
            throw RelayError(.invalidInput, "Unknown runtime workspace root.")
        }
        return location
    }

    private func writableRootLocation(agent: AgentWithBinding, rootId: String) throws -> RootLocation {
        let location = try rootLocation(agent: agent, rootId: rootId)
        guard !location.root.isReadOnly else {
            throw RelayError(.unsupported, "\(location.root.label) is read-only.")
        }
        return location
    }

    private func rootLocations(for agent: AgentWithBinding, agentLabel: String?) -> [RootLocation] {
        let label = agentLabel?.trimmingCharacters(in: .whitespacesAndNewlines)
        let agentLabel = (label?.isEmpty == false ? label : nil) ?? agent.name
        if isCloudAgent(agent) {
            return [
                RootLocation(
                    root: cloudRoot(agent: agent, label: "\(agentLabel) cloud workspace"),
                    url: paths.cacheDir
                        .appendingPathComponent("cloud-agent-workspaces", isDirectory: true)
                        .appendingPathComponent(agent.id, isDirectory: true)
                )
            ]
        }
        switch agent.binding.runtimeType {
        case .hermes:
            let profile = agent.binding.hermesProfileSlug ?? hermesProfileSlug(for: agent)
            let profileHome = agent.binding.hermesHomePath.map { URL(fileURLWithPath: $0, isDirectory: true) }
                ?? paths.hermesHomeDir
                    .appendingPathComponent("profiles", isDirectory: true)
                    .appendingPathComponent(profile, isDirectory: true)
            let workspace = agent.binding.workspaceFolderPath.map { URL(fileURLWithPath: $0, isDirectory: true) }
                ?? paths.workspacesDir.appendingPathComponent(profile, isDirectory: true)
            return [
                makeRoot(.hermesProfile, label: "\(agentLabel) profile", url: profileHome, readOnly: false),
                makeRoot(.agentWorkspace, label: "\(agentLabel) workspace", url: workspace, readOnly: false),
                makeRoot(.sessions, label: "Sessions", url: profileHome.appendingPathComponent("sessions", isDirectory: true), readOnly: true),
            ]
        case .openclaw:
            let slug = agent.binding.externalAgentId ?? openClawSlug(for: agent)
            let workspace = agent.binding.workspaceFolderPath.map { URL(fileURLWithPath: $0, isDirectory: true) }
                ?? paths.openClawHomeDir.appendingPathComponent("workspace-\(slug)", isDirectory: true)
            return [
                makeRoot(.library, label: "library", url: paths.openClawHomeDir.appendingPathComponent("library", isDirectory: true), readOnly: false),
                makeRoot(.agentWorkspace, label: "\(agentLabel) workspace", url: workspace, readOnly: false)
            ]
        default:
            return []
        }
    }

    private func makeRoot(_ kind: RuntimeWorkspaceRootKind, label: String, url: URL, readOnly: Bool) -> RootLocation {
        RootLocation(
            root: RuntimeWorkspaceRoot(
                rootId: kind.rawValue,
                kind: kind,
                label: label,
                isReadOnly: readOnly,
                exists: fileManager.fileExists(atPath: url.path),
                displayPath: "\(label) ([REDACTED])"
            ),
            url: url
        )
    }

    private func node(for url: URL, root: RuntimeWorkspaceRoot, rootURL: URL) -> RuntimeWorkspaceNode? {
        let name = url.lastPathComponent
        guard !name.isEmpty, !shouldHide(name: name) else { return nil }
        guard let values = try? url.resourceValues(forKeys: [.isDirectoryKey, .fileSizeKey, .contentModificationDateKey]) else {
            return nil
        }
        let isDirectory = values.isDirectory == true
        if !isDirectory && !isVisibleFile(url: url) {
            return nil
        }
        let relative = relativePath(for: url, rootURL: rootURL)
        let readOnly = isReadOnlyURL(url: url, root: root, rootURL: rootURL, isDirectory: isDirectory)
        return RuntimeWorkspaceNode(
            nodeId: nodeId(rootId: root.rootId, relativePath: relative),
            rootId: root.rootId,
            name: name,
            relativePath: relative,
            kind: isDirectory ? .folder : .file,
            isReadOnly: readOnly,
            isPNG: url.pathExtension.lowercased() == "png",
            isEditableText: !isDirectory && isReadableText(url: url),
            byteCount: isDirectory ? nil : values.fileSize,
            updatedAt: values.contentModificationDate.map { ISO8601DateFormatter.relayConsole.string(from: $0) }
        )
    }

    private func shouldHide(name: String) -> Bool {
        name.hasPrefix(".") && name != ".openclaw" && instructionGroupId(for: name) == nil
    }

    private func isVisibleFile(url: URL) -> Bool {
        if instructionGroupId(for: url.lastPathComponent) != nil {
            return true
        }
        return visibleFileExtensions.contains(url.pathExtension.lowercased())
    }

    private func isReadableText(url: URL) -> Bool {
        if instructionGroupId(for: url.lastPathComponent) != nil {
            return true
        }
        return readableTextExtensions.contains(url.pathExtension.lowercased())
    }

    private func isEditableText(url: URL) -> Bool {
        if instructionGroupId(for: url.lastPathComponent) != nil {
            return true
        }
        return editableTextExtensions.contains(url.pathExtension.lowercased())
    }

    private var visibleFileExtensions: Set<String> {
        readableTextExtensions.union(["png", "db", "sqlite", "sqlite3"])
    }

    private var readableTextExtensions: Set<String> {
        editableTextExtensions.union(["json", "log"])
    }

    private var editableTextExtensions: Set<String> {
        ["md", "markdown", "txt", "env", "yaml", "yml", "cursorrules"]
    }

    private func isReadOnlyURL(url: URL, root: RuntimeWorkspaceRoot, rootURL: URL, isDirectory: Bool) -> Bool {
        if root.isReadOnly {
            return true
        }
        guard root.kind == .hermesProfile else {
            return false
        }
        let relative = normalizedRelativePath(relativePath(for: url, rootURL: rootURL))
        guard !relative.isEmpty else {
            return false
        }
        let components = relative.split(separator: "/").map(String.init)
        if let first = components.first?.lowercased(), ["logs", "sessions"].contains(first) {
            return true
        }
        guard !isDirectory else {
            return false
        }
        let ext = url.pathExtension.lowercased()
        let name = url.lastPathComponent.lowercased()
        return ["db", "sqlite", "sqlite3"].contains(ext) || name == "state.db"
    }

    private func validateImport(sourceURL: URL, kind: RuntimeWorkspaceFileImportKind) throws {
        let ext = sourceURL.pathExtension.lowercased()
        switch kind {
        case .markdown:
            guard editableTextExtensions.contains(ext) else {
                throw RelayError(.invalidInput, "Upload markdown accepts .md, .markdown, .txt, .env, .yaml, or .yml files.")
            }
        case .png:
            guard ext == "png" else {
                throw RelayError(.invalidInput, "Upload PNG accepts .png files.")
            }
        }
    }

    private func normalizedMarkdownFilename(_ value: String) throws -> String {
        let trimmed = try requireNonEmptyString(value, field: "Filename", maxLength: 180)
        let component = try normalizedPathComponent(trimmed, field: "Filename")
        let ext = URL(fileURLWithPath: component).pathExtension.lowercased()
        if ext.isEmpty {
            return "\(component).md"
        }
        guard isEditableText(url: URL(fileURLWithPath: component)) else {
            throw RelayError(.invalidInput, "Save file requires a Markdown, YAML, env, or plain-text filename.")
        }
        return component
    }

    private func normalizedPathComponent(_ value: String, field: String) throws -> String {
        let trimmed = try requireNonEmptyString(value, field: field, maxLength: 180)
        guard !trimmed.contains("/"), !trimmed.contains("\\"), trimmed != ".", trimmed != ".." else {
            throw RelayError(.invalidInput, "\(field) must be a single file or folder name.")
        }
        return trimmed
    }

    private func normalizedRelativePath(_ value: String) -> String {
        value.split(separator: "/")
            .filter { !$0.isEmpty && $0 != "." }
            .map(String.init)
            .joined(separator: "/")
    }

    private func containedURL(root: URL, relativePath: String) throws -> URL {
        let clean = normalizedRelativePath(relativePath)
        guard !clean.split(separator: "/").contains("..") else {
            throw RelayError(.invalidInput, "Workspace paths cannot escape the selected root.")
        }
        let url = clean.isEmpty ? root : root.appendingPathComponent(clean)
        try assertContained(url: url, root: root)
        return url
    }

    private func assertContained(url: URL, root: URL) throws {
        let rootPath = root.standardizedFileURL.path
        let path = url.standardizedFileURL.path
        guard path == rootPath || path.hasPrefix(rootPath + "/") else {
            throw RelayError(.invalidInput, "Workspace paths cannot escape the selected root.")
        }
    }

    private func relativePath(for url: URL, rootURL: URL) -> String {
        let rootPath = rootURL.standardizedFileURL.path
        let path = url.standardizedFileURL.path
        guard path != rootPath, path.hasPrefix(rootPath + "/") else {
            return ""
        }
        return String(path.dropFirst(rootPath.count + 1))
    }

    private func nodeId(rootId: String, relativePath: String) -> String {
        let cleanPath = normalizedRelativePath(relativePath)
        return cleanPath.isEmpty ? rootId : "\(rootId):\(cleanPath)"
    }

    private func readBaselines() throws -> [RuntimeWorkspaceBaseline] {
        guard fileManager.fileExists(atPath: baselineStoreURL.path) else {
            return []
        }
        let data = try Data(contentsOf: baselineStoreURL)
        return try JSONDecoder().decode([RuntimeWorkspaceBaseline].self, from: data)
    }

    private func writeBaselines(_ baselines: [RuntimeWorkspaceBaseline]) throws {
        try fileManager.createDirectory(at: baselineStoreURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        let data = try JSONEncoder().encode(baselines)
        try data.write(to: baselineStoreURL, options: .atomic)
    }
}
