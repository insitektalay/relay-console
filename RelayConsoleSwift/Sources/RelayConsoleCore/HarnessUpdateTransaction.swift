import Foundation

public struct HarnessUpdateBackup: Equatable, Sendable {
    public var root: URL
    public var source: URL
    public var state: URL
    public var previousVersion: String?
    public var previousCommit: String?

    public init(root: URL, source: URL, state: URL, previousVersion: String?, previousCommit: String?) {
        self.root = root
        self.source = source
        self.state = state
        self.previousVersion = previousVersion
        self.previousCommit = previousCommit
    }
}

public enum HarnessUpdateTransaction {
    public static func begin(
        harnessKey: HarnessKey,
        installPath: URL,
        statePath: URL,
        backupRoot: URL,
        previousVersion: String?,
        previousCommit: String?,
        fileManager: FileManager = .default
    ) throws -> HarnessUpdateBackup {
        guard fileManager.fileExists(atPath: installPath.path) else {
            throw RelayError(.harnessMissing, "There is no managed \(harnessKey.rawValue) installation to update.")
        }
        let root = backupRoot.appendingPathComponent("\(harnessKey.rawValue)-\(UUID().uuidString)", isDirectory: true)
        let source = root.appendingPathComponent("source", isDirectory: true)
        let state = root.appendingPathComponent("state", isDirectory: true)
        try fileManager.createDirectory(at: root, withIntermediateDirectories: true)
        try fileManager.moveItem(at: installPath, to: source)
        do {
            if fileManager.fileExists(atPath: statePath.path) {
                try fileManager.copyItem(at: statePath, to: state)
            }
        } catch {
            try? fileManager.moveItem(at: source, to: installPath)
            try? fileManager.removeItem(at: root)
            throw error
        }
        return HarnessUpdateBackup(root: root, source: source, state: state, previousVersion: previousVersion, previousCommit: previousCommit)
    }

    public static func restore(
        _ backup: HarnessUpdateBackup,
        installPath: URL,
        statePath: URL,
        fileManager: FileManager = .default
    ) throws {
        guard fileManager.fileExists(atPath: backup.source.path) else {
            throw RelayError(.internalError, "The retained harness rollback source is missing.")
        }
        if fileManager.fileExists(atPath: installPath.path) {
            try fileManager.removeItem(at: installPath)
        }
        try fileManager.moveItem(at: backup.source, to: installPath)
        if fileManager.fileExists(atPath: backup.state.path) {
            if fileManager.fileExists(atPath: statePath.path) {
                try fileManager.removeItem(at: statePath)
            }
            try fileManager.copyItem(at: backup.state, to: statePath)
        }
    }
}
