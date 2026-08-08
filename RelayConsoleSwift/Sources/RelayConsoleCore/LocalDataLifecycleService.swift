import Foundation

public enum LocalDataCleanupKind: String, Codable, CaseIterable, Identifiable, Sendable {
    case resetLocalData = "reset_local_data"
    case removeLocalProfile = "remove_local_profile"
    case prepareForAppRemoval = "prepare_for_app_removal"

    public var id: String { rawValue }

    public var confirmationPhrase: String {
        switch self {
        case .resetLocalData: return "RESET LOCAL DATA"
        case .removeLocalProfile: return "REMOVE LOCAL PROFILE"
        case .prepareForAppRemoval: return "PREPARE FOR APP REMOVAL"
        }
    }
}

public struct LocalDataCleanupResult: Codable, Equatable, Sendable {
    public var kind: LocalDataCleanupKind
    public var removedSecretCount: Int
    public var removedManagedRoot: String
    public var requiresApplicationExit: Bool
}

public final class LocalDataLifecycleService {
    private let paths: RelayConsolePaths
    private let database: DatabaseService
    private let secrets: SecretService
    private let harnessInstall: HarnessInstallManager
    private let hermesCronScheduler: HermesCronSchedulerService
    private let fileManager: FileManager
    private let userDefaults: UserDefaults
    private let userDefaultsDomain: String

    public init(
        paths: RelayConsolePaths,
        database: DatabaseService,
        secrets: SecretService,
        harnessInstall: HarnessInstallManager,
        hermesCronScheduler: HermesCronSchedulerService,
        fileManager: FileManager = .default,
        userDefaults: UserDefaults = .standard,
        userDefaultsDomain: String = RelayConsoleReleaseMetadata.current.bundleIdentifier
    ) {
        self.paths = paths
        self.database = database
        self.secrets = secrets
        self.harnessInstall = harnessInstall
        self.hermesCronScheduler = hermesCronScheduler
        self.fileManager = fileManager
        self.userDefaults = userDefaults
        self.userDefaultsDomain = userDefaultsDomain
    }

    @discardableResult
    public func writeRedactedExport(
        context: ServiceRequestContext,
        profileId: RelayId,
        destination: URL,
        now: Date = Date()
    ) throws -> SettingsLocalAccountExportRecord {
        guard context.actorId == profileId || context.hasAnyRole([.owner, .admin]) else {
            throw ServiceGuardResult(
                stateKind: .readOnly,
                reasonCode: .authorityReadOnly,
                message: "Only the matching local profile can export this account.",
                recovery: "Switch to the matching profile and try again.",
                correlationId: context.correlationId,
                auditRequired: true
            )
        }
        guard destination.pathExtension.lowercased() == "json" else {
            throw RelayError(.invalidInput, "Choose a .json destination for the local export.")
        }
        let parent = destination.deletingLastPathComponent()
        var isDirectory: ObjCBool = false
        guard fileManager.fileExists(atPath: parent.path, isDirectory: &isDirectory), isDirectory.boolValue else {
            throw RelayError(.invalidInput, "The export destination folder does not exist.")
        }

        let profileRows = try database.all("SELECT * FROM local_profiles WHERE id = ?", [.text(profileId)])
        let workspaceRows = try database.all("SELECT * FROM workspaces WHERE id = ? AND profile_id = ?", [.text(context.workspaceId), .text(profileId)])
        let harnessRows = try database.all("SELECT id, runtime_type, display_name, mode, status, built_in, created_at, updated_at FROM harnesses ORDER BY id")
        let agentRows = try database.all("SELECT * FROM agents WHERE workspace_id = ? ORDER BY created_at, id", [.text(context.workspaceId)])
        let bindingRows = try relatedRows(table: "runtime_bindings", foreignKey: "agent_id", ids: ids(agentRows))
        let threadRows = try database.all("SELECT * FROM threads WHERE workspace_id = ? ORDER BY created_at, id", [.text(context.workspaceId)])
        let messageRows = try relatedRows(table: "messages", foreignKey: "thread_id", ids: ids(threadRows))
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
        let groups: [(String, [[String: SQLiteValue]])] = [
            ("profiles", profileRows),
            ("workspaces", workspaceRows),
            ("harnesses", harnessRows),
            ("agents", agentRows),
            ("runtimeBindings", bindingRows),
            ("threads", threadRows),
            ("messages", messageRows)
        ]
        let recordCount = groups.reduce(0) { $0 + $1.1.count }
        var records: [String: Any] = [:]
        for (name, rows) in groups {
            records[name] = rows.map(sanitizedRow)
        }
        let document: [String: Any] = [
            "schemaVersion": 1,
            "product": "Relay Console",
            "generatedAt": timestamp,
            "workspaceId": context.workspaceId,
            "profileId": profileId,
            "includesSecrets": false,
            "redactionStatus": "secret-values-excluded",
            "records": records
        ]
        let encoded = try JSONSerialization.data(withJSONObject: document, options: [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes])
        try encoded.write(to: destination, options: .atomic)
        try fileManager.setAttributes([.posixPermissions: 0o600], ofItemAtPath: destination.path)

        return SettingsLocalAccountExportRecord(
            id: createRelayId("slx"),
            workspaceId: context.workspaceId,
            profileId: profileId,
            status: "written",
            fileName: destination.lastPathComponent,
            recordCount: recordCount,
            includesSecrets: false,
            exportMetadata: [
                "schemaVersion": .number(1),
                "recordTypes": .array(groups.map { .string($0.0) }),
                "profileValuesIncluded": .bool(true),
                "workspaceValuesIncluded": .bool(true),
                "rawSecretsIncluded": .bool(false),
                "destinationPathPersisted": .bool(false),
                "filePermissions": .string("0600")
            ],
            createdAt: timestamp,
            updatedAt: timestamp,
            redactionStatus: "secret-values-excluded"
        )
    }

    public func executeCleanup(
        kind: LocalDataCleanupKind,
        confirmation: String
    ) async throws -> LocalDataCleanupResult {
        guard confirmation == kind.confirmationPhrase else {
            throw RelayError(.invalidInput, "Type \(kind.confirmationPhrase) to confirm this cleanup.")
        }
        let root = paths.root.standardizedFileURL
        let home = URL(fileURLWithPath: NSHomeDirectory(), isDirectory: true).standardizedFileURL
        guard root.path != "/", root != home, root.pathComponents.count >= 3 else {
            throw RelayError(.invalidInput, "Relay Console refused to remove an unsafe managed data root.")
        }

        let removedSecrets = try secrets.deleteAll()
        userDefaults.removePersistentDomain(forName: userDefaultsDomain)
        database.close()
        if kind == .prepareForAppRemoval {
            harnessInstall.stopAll()
            await RelayHostServiceManager(paths: paths).uninstall()
            await hermesCronScheduler.uninstall(hermesHome: paths.hermesHomeDir)
            if fileManager.fileExists(atPath: root.path) {
                try fileManager.removeItem(at: root)
            }
        } else {
            // Resetting Relay data is not permission to stop, uninstall, alter,
            // or delete Hermes Agent, OpenClaw, their homes, runtime tools, or
            // customer workspace files. Remove Relay-owned account/state data
            // only; a clean database is created on the next launch.
            for directory in [
                paths.databaseDir,
                paths.cacheDir,
                paths.secretsDir,
                paths.artifactsDir,
            ] where fileManager.fileExists(atPath: directory.path) {
                try fileManager.removeItem(at: directory)
            }
        }
        return LocalDataCleanupResult(
            kind: kind,
            removedSecretCount: removedSecrets,
            removedManagedRoot: root.path,
            requiresApplicationExit: true
        )
    }

    private func ids(_ rows: [[String: SQLiteValue]]) -> [String] {
        rows.compactMap { row in
            guard case .text(let value) = row["id"] else { return nil }
            return value
        }
    }

    private func relatedRows(table: String, foreignKey: String, ids: [String]) throws -> [[String: SQLiteValue]] {
        guard !ids.isEmpty else { return [] }
        let placeholders = Array(repeating: "?", count: ids.count).joined(separator: ",")
        return try database.all(
            "SELECT * FROM \(table) WHERE \(foreignKey) IN (\(placeholders)) ORDER BY created_at, id",
            ids.map(SQLiteValue.text)
        )
    }

    private func sanitizedRow(_ row: [String: SQLiteValue]) -> [String: Any] {
        Dictionary(uniqueKeysWithValues: row.sorted { $0.key < $1.key }.map { key, value in
            let lowered = key.lowercased()
            if isSecretKey(lowered) {
                return (key, "[REDACTED]")
            }
            let primitive: Any
            switch value {
            case .text(let text):
                primitive = sanitizeJSONText(text, column: lowered)
            case .integer(let number): primitive = number
            case .real(let number): primitive = number
            case .null: primitive = NSNull()
            }
            return (key, primitive)
        })
    }

    private func sanitizeJSONText(_ text: String, column: String) -> Any {
        guard column.hasSuffix("_json") || column == "metadata" || column == "config" else { return text }
        guard let data = text.data(using: .utf8),
              let object = try? JSONSerialization.jsonObject(with: data)
        else { return text }
        return sanitizeJSONObject(object)
    }

    private func sanitizeJSONObject(_ value: Any) -> Any {
        if let object = value as? [String: Any] {
            return Dictionary(uniqueKeysWithValues: object.map { key, nested in
                (key, isSecretKey(key.lowercased()) ? "[REDACTED]" : sanitizeJSONObject(nested))
            })
        }
        if let array = value as? [Any] {
            return array.map(sanitizeJSONObject)
        }
        return value
    }

    private func isSecretKey(_ key: String) -> Bool {
        ["secret", "token", "password", "credential", "keychain", "cookie", "bookmark"].contains { key.contains($0) }
    }
}
