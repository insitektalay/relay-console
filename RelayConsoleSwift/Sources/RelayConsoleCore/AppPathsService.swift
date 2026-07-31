import Foundation

public struct RelayConsolePaths: Sendable {
    public var root: URL
    public var databaseDir: URL
    public var databasePath: URL
    public var cacheDir: URL
    public var secretsDir: URL
    public var secretsPath: URL
    public var harnessesDir: URL
    public var workspacesDir: URL
    public var artifactsDir: URL
    public var hermesHomeDir: URL
    public var hermesProfileBackupsDir: URL
    public var openClawHomeDir: URL
    public var codexHomeDir: URL
    public var toolsDir: URL
    public var uvBinDir: URL
    public var openClawToolchainDir: URL
}

public final class AppPathsService {
    private let basePath: URL
    private let permissionsMarkerName = ".managed-permissions-v1"

    public init(basePath: URL? = nil) {
        if let basePath {
            self.basePath = basePath
        } else {
            let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
                ?? URL(fileURLWithPath: NSHomeDirectory()).appendingPathComponent("Library/Application Support", isDirectory: true)
            self.basePath = support.appendingPathComponent("Relay Console", isDirectory: true)
        }
    }

    public func getPaths() -> RelayConsolePaths {
        let root = basePath
        let databaseDir = root.appendingPathComponent("data", isDirectory: true)
        let cacheDir = root.appendingPathComponent("cache", isDirectory: true)
        let secretsDir = root.appendingPathComponent("secrets", isDirectory: true)
        let harnessesDir = root.appendingPathComponent("harnesses", isDirectory: true)
        let workspacesDir = root.appendingPathComponent("workspaces", isDirectory: true)
        let artifactsDir = root.appendingPathComponent("artifacts", isDirectory: true)
        let hermesHomeDir = root.appendingPathComponent("hermes-home", isDirectory: true)
        let hermesProfileBackupsDir = root.appendingPathComponent("hermes-profile-backups", isDirectory: true)
        let openClawHomeDir = root.appendingPathComponent("openclaw-home", isDirectory: true)
        let codexHomeDir = root.appendingPathComponent("codex-home", isDirectory: true)
        let toolsDir = root.appendingPathComponent("tools", isDirectory: true)
        let uvBinDir = toolsDir.appendingPathComponent("uv", isDirectory: true)
        let openClawToolchainDir = toolsDir.appendingPathComponent("openclaw", isDirectory: true)
        return RelayConsolePaths(
            root: root,
            databaseDir: databaseDir,
            databasePath: databaseDir.appendingPathComponent("relay-console.sqlite"),
            cacheDir: cacheDir,
            secretsDir: secretsDir,
            secretsPath: secretsDir.appendingPathComponent("relay-console-secrets.json"),
            harnessesDir: harnessesDir,
            workspacesDir: workspacesDir,
            artifactsDir: artifactsDir,
            hermesHomeDir: hermesHomeDir,
            hermesProfileBackupsDir: hermesProfileBackupsDir,
            openClawHomeDir: openClawHomeDir,
            codexHomeDir: codexHomeDir,
            toolsDir: toolsDir,
            uvBinDir: uvBinDir,
            openClawToolchainDir: openClawToolchainDir
        )
    }

    public func ensure() throws -> RelayConsolePaths {
        let paths = getPaths()
        let managedDirectories = [
            paths.root,
            paths.databaseDir,
            paths.cacheDir,
            paths.secretsDir,
            paths.harnessesDir,
            paths.workspacesDir,
            paths.artifactsDir,
            paths.hermesHomeDir,
            paths.hermesProfileBackupsDir,
            paths.openClawHomeDir,
            paths.codexHomeDir,
            paths.toolsDir,
            paths.uvBinDir,
            paths.openClawToolchainDir
        ]
        for directory in managedDirectories {
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        }
        let marker = paths.root.appendingPathComponent(permissionsMarkerName)
        let needsRecursiveRepair = try managedDirectories.contains {
            try currentMode(at: $0, fileManager: .default) != 0o700
        }
        for directory in managedDirectories {
            try setMode(0o700, at: directory, fileManager: .default)
        }
        if needsRecursiveRepair {
            try repairManagedPermissions(paths: paths)
        } else if !FileManager.default.fileExists(atPath: marker.path) {
            try writePermissionsMarker(at: marker, fileManager: .default)
        }
        return paths
    }

    public func repairManagedPermissions(paths: RelayConsolePaths? = nil) throws {
        let paths = paths ?? getPaths()
        let fileManager = FileManager.default
        guard fileManager.fileExists(atPath: paths.root.path) else { return }
        try setMode(0o700, at: paths.root, fileManager: fileManager)
        guard let enumerator = fileManager.enumerator(
            at: paths.root,
            includingPropertiesForKeys: [.isDirectoryKey, .isRegularFileKey, .isSymbolicLinkKey],
            options: [.skipsPackageDescendants]
        ) else { return }
        for case let url as URL in enumerator {
            let values = try url.resourceValues(forKeys: [.isDirectoryKey, .isRegularFileKey, .isSymbolicLinkKey])
            if values.isSymbolicLink == true { continue }
            if values.isDirectory == true {
                try setMode(0o700, at: url, fileManager: fileManager)
            } else if values.isRegularFile == true {
                let attributes = try fileManager.attributesOfItem(atPath: url.path)
                let current = (attributes[.posixPermissions] as? NSNumber)?.intValue ?? 0o600
                let ownerExecutable = current & 0o100
                try setMode(0o600 | ownerExecutable, at: url, fileManager: fileManager)
            }
        }
        try writePermissionsMarker(
            at: paths.root.appendingPathComponent(permissionsMarkerName),
            fileManager: fileManager
        )
    }

    private func setMode(_ mode: Int, at url: URL, fileManager: FileManager) throws {
        try fileManager.setAttributes([.posixPermissions: mode], ofItemAtPath: url.path)
    }

    private func currentMode(at url: URL, fileManager: FileManager) throws -> Int {
        let attributes = try fileManager.attributesOfItem(atPath: url.path)
        return (attributes[.posixPermissions] as? NSNumber)?.intValue ?? 0
    }

    private func writePermissionsMarker(at url: URL, fileManager: FileManager) throws {
        try Data("managed permissions verified\n".utf8).write(to: url, options: .atomic)
        try setMode(0o600, at: url, fileManager: fileManager)
    }
}
