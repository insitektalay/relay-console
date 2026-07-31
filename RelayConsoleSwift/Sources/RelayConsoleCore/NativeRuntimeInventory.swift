import CryptoKit
import Foundation

struct NativeRuntimeInventoryDocument: Sendable {
    let folder: String
    let filename: String
    let content: String
    let contentHash: String

    var requestBody: [String: Any] {
        [
            "folder": folder,
            "filename": filename,
            "content": content,
            "contentHash": contentHash,
        ]
    }
}

struct NativeRuntimeInventoryAgent: Sendable {
    let runtimeType: RuntimeType
    let externalId: String
    let name: String
    let description: String?
    let modelPrimary: String?
    let nativeKind: String
    let localRoot: URL?
    let nativeProfileName: String?

    func replacingExternalId(_ externalId: String) -> NativeRuntimeInventoryAgent {
        NativeRuntimeInventoryAgent(
            runtimeType: runtimeType,
            externalId: externalId,
            name: name,
            description: description,
            modelPrimary: modelPrimary,
            nativeKind: nativeKind,
            localRoot: localRoot,
            nativeProfileName: nativeProfileName
        )
    }

    func requestBody(includeDocuments: Bool) -> [String: Any] {
        var body: [String: Any] = [
            "externalId": externalId,
            "name": name,
            "role": "assistant",
            "status": "active",
            "nativeKind": nativeKind,
            "capabilities": ["dispatch", "sessions", "tools"],
            "documents": includeDocuments
                ? NativeRuntimeInventory.scanDocuments(root: localRoot).documents.map(\.requestBody)
                : [],
        ]
        if let description { body["description"] = description }
        if let modelPrimary { body["modelPrimary"] = modelPrimary }
        return body
    }
}

enum NativeRuntimeInventory {
    static let maximumAgents = 250
    static let maximumDocuments = 2_000
    static let maximumDocumentBytes = 500_000
    private static let rootDocuments = Set([
        "AGENTS.md", "HEARTBEAT.md", "IDENTITY.md", "MEMORY.md",
        "SOUL.md", "TOOLS.md", "USER.md",
    ])
    private static let allowedTrees = Set(["memory", "skills"])
    private static let sensitiveName = try! NSRegularExpression(
        pattern: #"(^|[._-])(auth|credential|password|secret|token|keychain)([._-]|$)"#,
        options: [.caseInsensitive]
    )

    static func scanDocuments(root: URL?) -> (documents: [NativeRuntimeInventoryDocument], complete: Bool) {
        guard let suppliedRoot = root, !isSymbolicLink(suppliedRoot) else { return ([], false) }
        let root = suppliedRoot.standardizedFileURL.resolvingSymlinksInPath()
        var isDirectory: ObjCBool = false
        guard FileManager.default.fileExists(atPath: root.path, isDirectory: &isDirectory),
              isDirectory.boolValue,
              !isSymbolicLink(root)
        else { return ([], false) }

        let keys: [URLResourceKey] = [
            .isDirectoryKey,
            .isRegularFileKey,
            .isSymbolicLinkKey,
            .fileSizeKey,
        ]
        var scanFailed = false
        guard let enumerator = FileManager.default.enumerator(
            at: root,
            includingPropertiesForKeys: keys,
            options: [.skipsHiddenFiles, .skipsPackageDescendants],
            errorHandler: { _, _ in
                scanFailed = true
                return true
            }
        ) else { return ([], false) }

        var result: [NativeRuntimeInventoryDocument] = []
        var complete = true
        for case let candidate as URL in enumerator {
            guard let relative = relativePath(candidate, beneath: root) else { continue }
            let parts = relative.split(separator: "/").map(String.init)
            if parts.count == 1,
               !rootDocuments.contains(parts[0]),
               !allowedTrees.contains(parts[0].lowercased()) {
                enumerator.skipDescendants()
                continue
            }
            guard isAllowed(relative), !isSymbolicLink(candidate) else { continue }
            guard let values = try? candidate.resourceValues(forKeys: Set(keys)),
                  values.isRegularFile == true,
                  (values.fileSize ?? maximumDocumentBytes + 1) <= maximumDocumentBytes
            else {
                scanFailed = true
                continue
            }
            if result.count >= maximumDocuments {
                complete = false
                break
            }
            guard let data = try? Data(contentsOf: candidate, options: [.mappedIfSafe]),
                  data.count <= maximumDocumentBytes,
                  let content = String(data: data, encoding: .utf8),
                  !content.contains("\0")
            else {
                scanFailed = true
                continue
            }
            let filename = parts.last ?? ""
            let folder = parts.dropLast().joined(separator: "/")
            result.append(
                NativeRuntimeInventoryDocument(
                    folder: folder,
                    filename: filename,
                    content: content,
                    contentHash: SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
                )
            )
        }
        return (result, complete && !scanFailed)
    }

    static func safeDocumentURL(root: URL, folder: String, filename: String) throws -> URL {
        let relative = ([folder, filename].filter { !$0.isEmpty }).joined(separator: "/")
        guard isAllowed(relative) else {
            throw RelayError(.permissionDenied, "The native document path is not allowlisted.")
        }
        guard !isSymbolicLink(root) else {
            throw RelayError(.permissionDenied, "The native agent workspace is a symbolic link.")
        }
        let standardizedRoot = root.standardizedFileURL.resolvingSymlinksInPath()
        let target = standardizedRoot.appendingPathComponent(relative).standardizedFileURL
        guard target.path == standardizedRoot.path || target.path.hasPrefix(standardizedRoot.path + "/") else {
            throw RelayError(.permissionDenied, "The native document path escaped its agent workspace.")
        }
        var current = standardizedRoot
        for component in relative.split(separator: "/").dropLast() {
            current.appendPathComponent(String(component))
            if FileManager.default.fileExists(atPath: current.path), isSymbolicLink(current) {
                throw RelayError(.permissionDenied, "The native document path traversed a symbolic link.")
            }
        }
        if FileManager.default.fileExists(atPath: target.path), isSymbolicLink(target) {
            throw RelayError(.permissionDenied, "The native document is a symbolic link.")
        }
        return target
    }

    static func writeDocumentAtomically(root: URL, folder: String, filename: String, content: String) throws {
        let data = Data(content.utf8)
        guard data.count <= maximumDocumentBytes else {
            throw RelayError(.invalidInput, "The native document exceeds the size limit.")
        }
        let target = try safeDocumentURL(root: root, folder: folder, filename: filename)
        try FileManager.default.createDirectory(
            at: target.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        let temporary = target.deletingLastPathComponent()
            .appendingPathComponent(".\(target.lastPathComponent).relay-\(UUID().uuidString).tmp")
        defer { try? FileManager.default.removeItem(at: temporary) }
        try data.write(to: temporary, options: [.atomic])
        try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: temporary.path)
        let recheckedTarget = try safeDocumentURL(root: root, folder: folder, filename: filename)
        guard recheckedTarget.standardizedFileURL == target.standardizedFileURL else {
            throw RelayError(.permissionDenied, "The native document target changed before write.")
        }
        if FileManager.default.fileExists(atPath: target.path) {
            _ = try FileManager.default.replaceItemAt(target, withItemAt: temporary)
        } else {
            try FileManager.default.moveItem(at: temporary, to: target)
        }
    }

    static func deleteDocument(root: URL, folder: String, filename: String) throws {
        let target = try safeDocumentURL(root: root, folder: folder, filename: filename)
        guard FileManager.default.fileExists(atPath: target.path) else { return }
        guard !isSymbolicLink(target) else {
            throw RelayError(.permissionDenied, "The native document is a symbolic link.")
        }
        let recheckedTarget = try safeDocumentURL(root: root, folder: folder, filename: filename)
        guard recheckedTarget.standardizedFileURL == target.standardizedFileURL else {
            throw RelayError(.permissionDenied, "The native document target changed before delete.")
        }
        try FileManager.default.removeItem(at: recheckedTarget)
    }

    private static func relativePath(_ candidate: URL, beneath root: URL) -> String? {
        let resolved = candidate.standardizedFileURL.resolvingSymlinksInPath()
        guard resolved.path.hasPrefix(root.path + "/") else { return nil }
        return String(resolved.path.dropFirst(root.path.count + 1))
    }

    private static func isAllowed(_ relative: String) -> Bool {
        let parts = relative.split(separator: "/", omittingEmptySubsequences: false).map(String.init)
        guard !parts.isEmpty, parts.count <= 7,
              !parts.contains(where: { $0.isEmpty || $0 == "." || $0 == ".." || $0.hasPrefix(".") }),
              !parts.contains(where: {
                  sensitiveName.firstMatch(
                    in: $0,
                    range: NSRange($0.startIndex..., in: $0)
                  ) != nil
              })
        else { return false }
        if parts.count == 1 { return rootDocuments.contains(parts[0]) }
        let suffix = URL(fileURLWithPath: parts.last ?? "").pathExtension.lowercased()
        let isAllowedMarkdown =
            allowedTrees.contains(parts[0].lowercased())
            && ["md", "markdown"].contains(suffix)
        let isGeneratedRoleManifest =
            parts.count == 4
            && parts[0].lowercased() == "skills"
            && parts[2].lowercased() == "references"
            && parts[3] == "roles_manifest.json"
        return isAllowedMarkdown || isGeneratedRoleManifest
    }

    private static func isSymbolicLink(_ url: URL) -> Bool {
        (try? url.resourceValues(forKeys: [.isSymbolicLinkKey]).isSymbolicLink) == true
    }
}

extension HarnessInstallManager {
    /// Returns `nil` when the runtime is not configured or its inventory command
    /// failed. An empty array is a successful, authoritative empty inventory.
    func nativeRuntimeInventorySnapshot(_ runtimeType: RuntimeType) async -> [NativeRuntimeInventoryAgent]? {
        guard let harness = try? data.getHarnessByRuntimeType(runtimeType),
              let installPath = stringValue(harness.config["installPath"]),
              !installPath.isEmpty
        else { return nil }
        let harnessURL = URL(fileURLWithPath: installPath, isDirectory: true)
        switch runtimeType {
        case .hermes:
            return await enumerateNativeHermesProfiles(harness: harness, harnessURL: harnessURL)
        case .openclaw:
            return await enumerateNativeOpenClawAgents(harness: harness, harnessURL: harnessURL)
        default:
            return nil
        }
    }

    private func enumerateNativeHermesProfiles(
        harness: Harness,
        harnessURL: URL
    ) async -> [NativeRuntimeInventoryAgent]? {
        guard let python = resolveHermesPython(harnessURL) else { return nil }
        let home = stringValue(harness.config["hermesHome"])
            .map { URL(fileURLWithPath: $0, isDirectory: true) }
            ?? paths.hermesHomeDir
        let script = """
        import json
        from hermes_cli.profiles import get_profile_dir, list_profiles
        rows = []
        for p in list_profiles():
            name = str(p.name).strip().lower()
            rows.append({
                "externalId": "default" if name == "default" else "profile:" + name,
                "nativeName": name,
                "name": "Default Hermes profile" if name == "default" else name,
                "description": str(getattr(p, "description", "") or ""),
                "model": str(getattr(p, "model", "") or ""),
                "home": str(get_profile_dir(name)),
            })
        print(json.dumps(rows))
        """
        let result = await runner.run(
            python.path,
            ["-c", script],
            options: CommandOptions(
                cwd: harnessURL,
                env: hermesEnv(harnessPath: harnessURL, hermesHome: home),
                timeoutMs: 30_000,
                executableAuthorization: .pythonVirtualEnvironment(
                    harnessRoot: harnessURL
                )
            )
        )
        guard result.code == 0,
              let data = result.stdout.data(using: .utf8),
              let rows = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]]
        else { return nil }
        return rows.prefix(NativeRuntimeInventory.maximumAgents).compactMap { row -> NativeRuntimeInventoryAgent? in
            guard let externalId = row["externalId"] as? String,
                  let nativeName = row["nativeName"] as? String,
                  let profileHome = row["home"] as? String
            else { return nil }
            return NativeRuntimeInventoryAgent(
                runtimeType: .hermes,
                externalId: externalId,
                name: row["name"] as? String ?? externalId,
                description: nonBlank(row["description"] as? String),
                modelPrimary: nonBlank(row["model"] as? String),
                nativeKind: "hermes_profile",
                localRoot: URL(fileURLWithPath: profileHome, isDirectory: true),
                nativeProfileName: nativeName
            )
        }
    }

    private func enumerateNativeOpenClawAgents(
        harness: Harness,
        harnessURL: URL
    ) async -> [NativeRuntimeInventoryAgent]? {
        let node = stringValue(harness.config["openClawNodePath"])
            .map { URL(fileURLWithPath: $0) } ?? resolveOpenClawNodePath()
        let result = await runner.run(
            node.path,
            ["openclaw.mjs", "agents", "list", "--json"],
            options: CommandOptions(
                cwd: harnessURL,
                env: openClawEnv(nodePath: node),
                timeoutMs: 30_000,
                executableAuthorization: .exact(node)
            )
        )
        guard result.code == 0,
              let data = result.stdout.data(using: .utf8),
              let value = try? JSONSerialization.jsonObject(with: data)
        else { return nil }
        let rows = openClawAgentRows(value)
        let stateRoot = stringValue(harness.config["openClawStateDir"])
            .map { URL(fileURLWithPath: $0, isDirectory: true) }
            ?? FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(".openclaw", isDirectory: true)
        return rows.prefix(NativeRuntimeInventory.maximumAgents).compactMap { row -> NativeRuntimeInventoryAgent? in
            guard let externalId = nonBlank(row["id"] as? String)
                    ?? nonBlank(row["agentId"] as? String)
                    ?? nonBlank(row["slug"] as? String)
            else { return nil }
            let explicitWorkspace = nonBlank(row["workspace"] as? String)
            let workspace = explicitWorkspace.map {
                URL(fileURLWithPath: ($0 as NSString).expandingTildeInPath, isDirectory: true)
            } ?? stateRoot.appendingPathComponent(
                externalId == "main" || externalId == "default"
                    ? "workspace"
                    : "workspace-\(externalId)",
                isDirectory: true
            )
            let model = row["model"] as? String
                ?? (row["model"] as? [String: Any])?["primary"] as? String
            return NativeRuntimeInventoryAgent(
                runtimeType: .openclaw,
                externalId: externalId,
                name: nonBlank(row["name"] as? String) ?? externalId,
                description: nil,
                modelPrimary: nonBlank(model),
                nativeKind: "openclaw_agent",
                localRoot: workspace,
                nativeProfileName: nil
            )
        }
    }

    private func openClawAgentRows(_ value: Any) -> [[String: Any]] {
        if let rows = value as? [[String: Any]] { return rows }
        guard let object = value as? [String: Any] else { return [] }
        for key in ["agents", "list", "items", "data"] {
            if let nested = object[key] {
                let rows = openClawAgentRows(nested)
                if !rows.isEmpty { return rows }
            }
        }
        return object["id"] is String ? [object] : []
    }

    private func nonBlank(_ value: String?) -> String? {
        let normalized = value?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return normalized.isEmpty ? nil : normalized
    }
}
