import CryptoKit
import Foundation
import SQLite3

public struct HermesProfileBackupFile: Codable, Equatable, Sendable {
    public var relativePath: String
    public var sha256: String
    public var byteSize: Int64
    public var modifiedAt: TimeInterval
}

public struct HermesProfileBackupManifest: Codable, Equatable, Sendable {
    public static let schemaVersion = 1

    public var schemaVersion: Int
    public var profileSlug: String
    public var agentId: String
    public var reason: String
    public var runtimeVersion: String?
    public var createdAt: String
    public var files: [HermesProfileBackupFile]
}

public struct HermesProfileBackupResult: Equatable, Sendable {
    public var checkpoint: URL
    public var manifest: HermesProfileBackupManifest
    public var copiedFileCount: Int
    public var linkedFileCount: Int
}

public struct HermesProfileRestoreResult: Equatable, Sendable {
    public var checkpoint: URL
    public var profileHome: URL
    public var restoredFileCount: Int
}

private struct ActiveHermesProfileBackup: Sendable {
    var profileHome: URL
    var workspaceHome: URL?
    var profileSlug: String
    var agentId: String
    var runtimeVersion: String?
}

/// Maintains local, versioned checkpoints for Relay-owned Hermes profiles.
///
/// Checkpoints never include the shared Hermes authentication store, dotenv
/// credentials, process state, logs, or caches. Unchanged files are hard-linked
/// from the previous checkpoint, and live SQLite files use SQLite's online
/// backup API so a checkpoint never captures a torn WAL state.
public final class HermesProfileBackupService: @unchecked Sendable {
    private let backupsRoot: URL
    private let queue = DispatchQueue(
        label: "work.relayconsole.hermes-profile-backups",
        qos: .utility
    )
    private var activeProfiles: [String: ActiveHermesProfileBackup] = [:]
    private var pendingCheckpoints: [String: DispatchWorkItem] = [:]
    private var periodicTimer: DispatchSourceTimer?
    private let periodicInterval: TimeInterval
    private let fileManager: FileManager
    private let checkpointLock = NSLock()

    private static let includedTopLevelNames: Set<String> = [
        "SOUL.md",
        "AGENTS.md",
        "TOOLS.md",
        "USER.md",
        "profile.yaml",
        "config.yaml",
        "state.db",
        "kanban.db",
        "hermes_state.db",
        "response_store.db",
        "channel_directory.json",
        "memories",
        "sessions",
        "skills",
        "workspace",
        "cron",
        "plans",
    ]

    private static let excludedNames: Set<String> = [
        ".env",
        "auth.json",
        "auth.lock",
        "gateway.lock",
        "gateway.pid",
        "gateway_state.json",
        "processes.json",
        "logs",
        "cache",
        "caches",
        "audio_cache",
        "image_cache",
        "document_cache",
        "pairing",
        "sandboxes",
        "skins",
        "tmp",
        "temp",
    ]

    public init(
        backupsRoot: URL,
        periodicInterval: TimeInterval = 600,
        fileManager: FileManager = .default
    ) {
        self.backupsRoot = backupsRoot
        self.periodicInterval = periodicInterval
        self.fileManager = fileManager
    }

    deinit {
        periodicTimer?.cancel()
    }

    public func scheduleCheckpoint(
        profileHome: URL,
        profileSlug: String,
        agentId: String,
        reason: String,
        runtimeVersion: String?,
        workspaceHome: URL? = nil
    ) {
        queue.async { [weak self] in
            guard let self else { return }
            self.pendingCheckpoints[agentId]?.cancel()
            let item = DispatchWorkItem { [weak self] in
                guard let self else { return }
                self.pendingCheckpoints[agentId] = nil
                _ = try? self.checkpointNow(
                    profileHome: profileHome,
                    profileSlug: profileSlug,
                    agentId: agentId,
                    reason: reason,
                    runtimeVersion: runtimeVersion,
                    workspaceHome: workspaceHome
                )
            }
            self.pendingCheckpoints[agentId] = item
            self.queue.asyncAfter(deadline: .now() + 2, execute: item)
        }
    }

    public func beginActiveProfile(
        profileHome: URL,
        profileSlug: String,
        agentId: String,
        runtimeVersion: String?,
        workspaceHome: URL? = nil
    ) {
        queue.async { [weak self] in
            guard let self else { return }
            self.activeProfiles[agentId] = ActiveHermesProfileBackup(
                profileHome: profileHome,
                workspaceHome: workspaceHome,
                profileSlug: profileSlug,
                agentId: agentId,
                runtimeVersion: runtimeVersion
            )
            self.ensurePeriodicTimer()
        }
    }

    public func endActiveProfile(
        profileHome: URL,
        profileSlug: String,
        agentId: String,
        runtimeVersion: String?,
        completed: Bool,
        workspaceHome: URL? = nil
    ) {
        queue.async { [weak self] in
            guard let self else { return }
            self.activeProfiles[agentId] = nil
            if completed {
                self.pendingCheckpoints[agentId]?.cancel()
                self.pendingCheckpoints[agentId] = nil
                _ = try? self.checkpointNow(
                    profileHome: profileHome,
                    profileSlug: profileSlug,
                    agentId: agentId,
                    reason: "completed-run",
                    runtimeVersion: runtimeVersion,
                    workspaceHome: workspaceHome
                )
            }
            if self.activeProfiles.isEmpty {
                self.periodicTimer?.cancel()
                self.periodicTimer = nil
            }
        }
    }

    @discardableResult
    public func checkpointNow(
        profileHome: URL,
        profileSlug: String,
        agentId: String,
        reason: String,
        runtimeVersion: String?,
        workspaceHome: URL? = nil,
        now: Date = Date()
    ) throws -> HermesProfileBackupResult {
        checkpointLock.lock()
        defer { checkpointLock.unlock() }
        let source = profileHome.standardizedFileURL
        guard fileManager.fileExists(atPath: source.path) else {
            throw RelayError(.notFound, "The Hermes profile is unavailable for backup.")
        }
        let safeSlug = try safeProfileSlug(profileSlug)
        let profileBackupRoot = backupsRoot.appendingPathComponent(safeSlug, isDirectory: true)
        try fileManager.createDirectory(at: profileBackupRoot, withIntermediateDirectories: true)
        try fileManager.setAttributes([.posixPermissions: 0o700], ofItemAtPath: profileBackupRoot.path)

        let previous = try latestCheckpoint(in: profileBackupRoot)
        let previousManifest = try previous.flatMap(readManifest)
        let previousFiles = Dictionary(
            uniqueKeysWithValues: (previousManifest?.files ?? []).map { ($0.relativePath, $0) }
        )
        let stamp = Self.checkpointStamp(now)
        let staging = profileBackupRoot.appendingPathComponent(
            ".partial-\(stamp)-\(UUID().uuidString)",
            isDirectory: true
        )
        let final = profileBackupRoot.appendingPathComponent(
            "\(stamp)-\(UUID().uuidString.prefix(8))",
            isDirectory: true
        )
        let filesRoot = staging.appendingPathComponent("files", isDirectory: true)
        try fileManager.createDirectory(at: filesRoot, withIntermediateDirectories: true)
        var files: [HermesProfileBackupFile] = []
        var copied = 0
        var linked = 0

        do {
            var backupFiles = try durableFiles(in: source).map {
                ($0, source, "profile/\(try relativePath(of: $0, beneath: source))")
            }
            if let workspaceHome {
                let workspace = workspaceHome.standardizedFileURL
                if fileManager.fileExists(atPath: workspace.path) {
                    backupFiles += try allDurableFiles(in: workspace).map {
                        ($0, workspace, "workspace/\(try relativePath(of: $0, beneath: workspace))")
                    }
                }
            }
            for (sourceFile, _, relative) in backupFiles {
                let destination = filesRoot.appendingPathComponent(relative)
                try fileManager.createDirectory(
                    at: destination.deletingLastPathComponent(),
                    withIntermediateDirectories: true
                )
                let candidate = staging.appendingPathComponent(
                    ".candidate-\(UUID().uuidString)",
                    isDirectory: false
                )
                if Self.requiresSQLiteSnapshot(sourceFile) {
                    try backupSQLite(source: sourceFile, destination: candidate)
                } else {
                    try fileManager.copyItem(at: sourceFile, to: candidate)
                }
                let attributes = try fileManager.attributesOfItem(atPath: candidate.path)
                let byteSize = (attributes[.size] as? NSNumber)?.int64Value ?? 0
                let modifiedAt = (try? sourceFile.resourceValues(
                    forKeys: [.contentModificationDateKey]
                ).contentModificationDate?.timeIntervalSince1970) ?? 0
                let digest = try RelayArtifactIntegrity.sha256(of: candidate)
                let entry = HermesProfileBackupFile(
                    relativePath: relative,
                    sha256: digest,
                    byteSize: byteSize,
                    modifiedAt: modifiedAt
                )
                if let previous,
                   previousFiles[relative]?.sha256 == digest {
                    let priorFile = previous
                        .appendingPathComponent("files", isDirectory: true)
                        .appendingPathComponent(relative)
                    if fileManager.fileExists(atPath: priorFile.path),
                       (try? fileManager.linkItem(at: priorFile, to: destination)) != nil {
                        try? fileManager.removeItem(at: candidate)
                        linked += 1
                    } else {
                        try fileManager.moveItem(at: candidate, to: destination)
                        copied += 1
                    }
                } else {
                    try fileManager.moveItem(at: candidate, to: destination)
                    copied += 1
                }
                files.append(entry)
            }
            files.sort { $0.relativePath < $1.relativePath }
            let manifest = HermesProfileBackupManifest(
                schemaVersion: HermesProfileBackupManifest.schemaVersion,
                profileSlug: safeSlug,
                agentId: agentId,
                reason: reason,
                runtimeVersion: runtimeVersion,
                createdAt: Self.isoString(now),
                files: files
            )
            let manifestData = try JSONEncoder.relayBackup.encode(manifest)
            let manifestURL = staging.appendingPathComponent("manifest.json")
            try manifestData.write(to: manifestURL, options: .atomic)
            try fileManager.setAttributes([.posixPermissions: 0o600], ofItemAtPath: manifestURL.path)
            try fileManager.moveItem(at: staging, to: final)
            try applyRetention(in: profileBackupRoot, now: now)
            return HermesProfileBackupResult(
                checkpoint: final,
                manifest: manifest,
                copiedFileCount: copied,
                linkedFileCount: linked
            )
        } catch {
            try? fileManager.removeItem(at: staging)
            throw error
        }
    }

    public func latestManifest(profileSlug: String) throws -> HermesProfileBackupManifest? {
        checkpointLock.lock()
        defer { checkpointLock.unlock() }
        let safeSlug = try safeProfileSlug(profileSlug)
        let root = backupsRoot.appendingPathComponent(safeSlug, isDirectory: true)
        return try latestCheckpoint(in: root).flatMap(readManifest)
    }

    /// Restores the profile portion of a verified checkpoint with an atomic
    /// directory replacement. Every manifest entry is validated before the
    /// existing Relay-owned profile is moved, so corruption cannot partially
    /// replace live state. Workspace files remain available in the checkpoint
    /// for explicit user recovery and are never written to an arbitrary path.
    @discardableResult
    public func restoreProfile(
        from checkpoint: URL,
        to profileHome: URL,
        profileSlug: String,
        agentId: String,
        ownershipNonce: String
    ) throws -> HermesProfileRestoreResult {
        checkpointLock.lock()
        defer { checkpointLock.unlock() }

        let safeSlug = try safeProfileSlug(profileSlug)
        let safeCheckpoint = try validatedCheckpoint(
            checkpoint,
            profileSlug: safeSlug,
            agentId: agentId
        )
        let destination = profileHome.standardizedFileURL
        let parent = destination.deletingLastPathComponent()
        guard destination.lastPathComponent == safeSlug,
              let parentValues = try? parent.resourceValues(
                  forKeys: [.isDirectoryKey, .isSymbolicLinkKey]
              ),
              parentValues.isDirectory == true,
              parentValues.isSymbolicLink != true
        else {
            throw RelayError(
                .permissionDenied,
                "Relay refused to restore a Hermes profile to an unsafe path."
            )
        }
        if fileManager.fileExists(atPath: destination.path),
           !HermesRelayProfileService.owns(
               profileHome: destination,
               agentId: agentId,
               profileSlug: safeSlug,
               ownershipNonce: ownershipNonce
           ) {
            throw RelayError(
                .permissionDenied,
                "Relay refused to replace a Hermes profile it does not own."
            )
        }

        let staging = parent.appendingPathComponent(
            ".relay-restore-\(safeSlug)-\(UUID().uuidString)",
            isDirectory: true
        )
        let rollback = parent.appendingPathComponent(
            ".relay-rollback-\(safeSlug)-\(UUID().uuidString)",
            isDirectory: true
        )
        var movedLiveProfile = false
        do {
            try fileManager.createDirectory(at: staging, withIntermediateDirectories: true)
            var restoredFileCount = 0
            for entry in safeCheckpoint.manifest.files
            where entry.relativePath.hasPrefix("profile/") {
                let relative = String(entry.relativePath.dropFirst("profile/".count))
                let source = safeCheckpoint.filesRoot.appendingPathComponent(
                    entry.relativePath
                )
                let target = staging.appendingPathComponent(relative)
                try fileManager.createDirectory(
                    at: target.deletingLastPathComponent(),
                    withIntermediateDirectories: true
                )
                try fileManager.copyItem(at: source, to: target)
                restoredFileCount += 1
            }
            try HermesRelayProfileService.writeMarker(
                profileHome: staging,
                agentId: agentId,
                profileSlug: safeSlug,
                ownershipNonce: ownershipNonce
            )
            if fileManager.fileExists(atPath: destination.path) {
                try fileManager.moveItem(at: destination, to: rollback)
                movedLiveProfile = true
            }
            do {
                try fileManager.moveItem(at: staging, to: destination)
            } catch {
                if movedLiveProfile,
                   !fileManager.fileExists(atPath: destination.path) {
                    try? fileManager.moveItem(at: rollback, to: destination)
                }
                throw error
            }
            if movedLiveProfile {
                try fileManager.removeItem(at: rollback)
            }
            return HermesProfileRestoreResult(
                checkpoint: safeCheckpoint.url,
                profileHome: destination,
                restoredFileCount: restoredFileCount
            )
        } catch {
            try? fileManager.removeItem(at: staging)
            if movedLiveProfile,
               !fileManager.fileExists(atPath: destination.path),
               fileManager.fileExists(atPath: rollback.path) {
                try? fileManager.moveItem(at: rollback, to: destination)
            }
            throw error
        }
    }

    private func ensurePeriodicTimer() {
        guard periodicTimer == nil, !activeProfiles.isEmpty else { return }
        let timer = DispatchSource.makeTimerSource(queue: queue)
        timer.schedule(
            deadline: .now() + periodicInterval,
            repeating: periodicInterval,
            leeway: .seconds(30)
        )
        timer.setEventHandler { [weak self] in
            guard let self else { return }
            for profile in self.activeProfiles.values {
                _ = try? self.checkpointNow(
                    profileHome: profile.profileHome,
                    profileSlug: profile.profileSlug,
                    agentId: profile.agentId,
                    reason: "active-periodic",
                    runtimeVersion: profile.runtimeVersion,
                    workspaceHome: profile.workspaceHome
                )
            }
        }
        timer.resume()
        periodicTimer = timer
    }

    private func durableFiles(in profileHome: URL) throws -> [URL] {
        var files: [URL] = []
        for name in Self.includedTopLevelNames.sorted() {
            let entry = profileHome.appendingPathComponent(name)
            var isDirectory: ObjCBool = false
            guard fileManager.fileExists(atPath: entry.path, isDirectory: &isDirectory) else {
                continue
            }
            if (try? entry.resourceValues(forKeys: [.isSymbolicLinkKey]).isSymbolicLink) == true {
                continue
            }
            if isDirectory.boolValue {
                guard let enumerator = fileManager.enumerator(
                    at: entry,
                    includingPropertiesForKeys: [
                        .isRegularFileKey,
                        .isDirectoryKey,
                        .isSymbolicLinkKey,
                    ],
                    options: [.skipsPackageDescendants, .skipsHiddenFiles]
                ) else { continue }
                for case let child as URL in enumerator {
                    let values = try child.resourceValues(
                        forKeys: [.isRegularFileKey, .isDirectoryKey, .isSymbolicLinkKey]
                    )
                    if Self.excludedNames.contains(child.lastPathComponent) {
                        if values.isDirectory == true { enumerator.skipDescendants() }
                        continue
                    }
                    if values.isSymbolicLink == true {
                        if values.isDirectory == true { enumerator.skipDescendants() }
                        continue
                    }
                    if values.isRegularFile == true,
                       !Self.isTransientDatabaseSidecar(child) {
                        files.append(child)
                    }
                }
            } else if !Self.excludedNames.contains(entry.lastPathComponent),
                      !Self.isTransientDatabaseSidecar(entry) {
                files.append(entry)
            }
        }
        return files.sorted { $0.path < $1.path }
    }

    private func allDurableFiles(in root: URL) throws -> [URL] {
        if (try? root.resourceValues(forKeys: [.isSymbolicLinkKey]).isSymbolicLink) == true {
            return []
        }
        guard let enumerator = fileManager.enumerator(
            at: root,
            includingPropertiesForKeys: [
                .isRegularFileKey,
                .isDirectoryKey,
                .isSymbolicLinkKey,
            ],
            options: [.skipsPackageDescendants, .skipsHiddenFiles]
        ) else { return [] }
        var files: [URL] = []
        for case let child as URL in enumerator {
            let values = try child.resourceValues(
                forKeys: [.isRegularFileKey, .isDirectoryKey, .isSymbolicLinkKey]
            )
            if Self.excludedNames.contains(child.lastPathComponent) {
                if values.isDirectory == true { enumerator.skipDescendants() }
                continue
            }
            if values.isSymbolicLink == true {
                if values.isDirectory == true { enumerator.skipDescendants() }
                continue
            }
            if values.isRegularFile == true,
               !Self.isTransientDatabaseSidecar(child) {
                files.append(child)
            }
        }
        return files.sorted { $0.path < $1.path }
    }

    private func latestCheckpoint(in profileBackupRoot: URL) throws -> URL? {
        guard fileManager.fileExists(atPath: profileBackupRoot.path) else { return nil }
        return try fileManager.contentsOfDirectory(
            at: profileBackupRoot,
            includingPropertiesForKeys: [.isDirectoryKey],
            options: [.skipsHiddenFiles]
        )
        .filter {
            (try? $0.resourceValues(forKeys: [.isDirectoryKey]).isDirectory) == true
                && fileManager.fileExists(
                    atPath: $0.appendingPathComponent("manifest.json").path
                )
        }
        .sorted { $0.lastPathComponent > $1.lastPathComponent }
        .first
    }

    private func readManifest(_ checkpoint: URL) throws -> HermesProfileBackupManifest {
        let data = try Data(contentsOf: checkpoint.appendingPathComponent("manifest.json"))
        return try JSONDecoder().decode(HermesProfileBackupManifest.self, from: data)
    }

    private struct ValidatedCheckpoint {
        var url: URL
        var filesRoot: URL
        var manifest: HermesProfileBackupManifest
    }

    private func validatedCheckpoint(
        _ checkpoint: URL,
        profileSlug: String,
        agentId: String
    ) throws -> ValidatedCheckpoint {
        let expectedRoot = backupsRoot.standardizedFileURL
            .appendingPathComponent(profileSlug, isDirectory: true)
        let candidate = checkpoint.standardizedFileURL
        guard candidate.deletingLastPathComponent() == expectedRoot,
              !candidate.lastPathComponent.hasPrefix("."),
              !pathContainsSymbolicLink(candidate, beneath: backupsRoot.standardizedFileURL),
              let checkpointValues = try? candidate.resourceValues(
                  forKeys: [.isDirectoryKey, .isSymbolicLinkKey]
              ),
              checkpointValues.isDirectory == true,
              checkpointValues.isSymbolicLink != true
        else {
            throw RelayError(
                .permissionDenied,
                "Relay refused to restore a checkpoint outside its backup directory."
            )
        }

        let manifestURL = candidate.appendingPathComponent("manifest.json")
        guard let manifestValues = try? manifestURL.resourceValues(
            forKeys: [.isRegularFileKey, .isSymbolicLinkKey]
        ),
        manifestValues.isRegularFile == true,
        manifestValues.isSymbolicLink != true
        else {
            throw RelayError(.invalidInput, "The Hermes checkpoint manifest is unavailable.")
        }
        let manifest = try readManifest(candidate)
        guard manifest.schemaVersion == HermesProfileBackupManifest.schemaVersion,
              manifest.profileSlug == profileSlug,
              manifest.agentId == agentId
        else {
            throw RelayError(
                .permissionDenied,
                "The Hermes checkpoint does not belong to this Relay agent."
            )
        }

        let filesRoot = candidate.appendingPathComponent("files", isDirectory: true)
        var seenPaths = Set<String>()
        for entry in manifest.files {
            guard seenPaths.insert(entry.relativePath).inserted,
                  isSafeManifestPath(entry.relativePath)
            else {
                throw RelayError(
                    .invalidInput,
                    "The Hermes checkpoint contains an unsafe or duplicate path."
                )
            }
            let source = filesRoot.appendingPathComponent(entry.relativePath)
            guard source.standardizedFileURL.path.hasPrefix(
                filesRoot.standardizedFileURL.path + "/"
            ),
            !pathContainsSymbolicLink(source, beneath: filesRoot),
            let values = try? source.resourceValues(
                forKeys: [.fileSizeKey, .isRegularFileKey, .isSymbolicLinkKey]
            ),
            values.isRegularFile == true,
            values.isSymbolicLink != true,
            Int64(values.fileSize ?? -1) == entry.byteSize,
            try RelayArtifactIntegrity.sha256(of: source) == entry.sha256
            else {
                throw RelayError(
                    .invalidInput,
                    "The Hermes checkpoint failed its integrity check."
                )
            }
        }
        return ValidatedCheckpoint(
            url: candidate,
            filesRoot: filesRoot,
            manifest: manifest
        )
    }

    private func isSafeManifestPath(_ value: String) -> Bool {
        let components = value.split(separator: "/", omittingEmptySubsequences: false)
        guard components.count >= 2,
              components.first == "profile" || components.first == "workspace"
        else {
            return false
        }
        return components.dropFirst().allSatisfy {
            !$0.isEmpty && $0 != "." && $0 != ".."
        }
    }

    private func pathContainsSymbolicLink(_ target: URL, beneath root: URL) -> Bool {
        let normalizedRoot = root.standardizedFileURL
        let normalizedTarget = target.standardizedFileURL
        guard normalizedTarget.path == normalizedRoot.path
            || normalizedTarget.path.hasPrefix(normalizedRoot.path + "/")
        else {
            return true
        }
        let relative = String(normalizedTarget.path.dropFirst(normalizedRoot.path.count))
        var current = normalizedRoot
        for component in relative.split(separator: "/") {
            current.appendPathComponent(String(component))
            if (try? current.resourceValues(
                forKeys: [.isSymbolicLinkKey]
            ).isSymbolicLink) == true {
                return true
            }
        }
        return false
    }

    private func applyRetention(in profileBackupRoot: URL, now: Date) throws {
        let checkpoints = try fileManager.contentsOfDirectory(
            at: profileBackupRoot,
            includingPropertiesForKeys: [.isDirectoryKey],
            options: [.skipsHiddenFiles]
        )
        .compactMap { url -> (URL, HermesProfileBackupManifest, Date)? in
            guard let manifest = try? readManifest(url),
                  let date = ISO8601DateFormatter.relayConsole.date(from: manifest.createdAt)
                    ?? ISO8601DateFormatter().date(from: manifest.createdAt)
            else { return nil }
            return (url, manifest, date)
        }
        .sorted { $0.2 > $1.2 }
        guard checkpoints.count > 10 else { return }

        var retained = Set(checkpoints.prefix(10).map { $0.0.path })
        var retainedHours = Set<String>()
        var retainedDays = Set<String>()
        let calendar = Calendar(identifier: .gregorian)
        for checkpoint in checkpoints {
            let age = now.timeIntervalSince(checkpoint.2)
            if age <= 86_400 {
                let components = calendar.dateComponents(
                    [.year, .month, .day, .hour],
                    from: checkpoint.2
                )
                let key = "\(components.year ?? 0)-\(components.month ?? 0)-\(components.day ?? 0)-\(components.hour ?? 0)"
                if retainedHours.insert(key).inserted {
                    retained.insert(checkpoint.0.path)
                }
            } else if age <= 2_592_000 {
                let components = calendar.dateComponents(
                    [.year, .month, .day],
                    from: checkpoint.2
                )
                let key = "\(components.year ?? 0)-\(components.month ?? 0)-\(components.day ?? 0)"
                if retainedDays.insert(key).inserted {
                    retained.insert(checkpoint.0.path)
                }
            }
        }
        for checkpoint in checkpoints where !retained.contains(checkpoint.0.path) {
            try fileManager.removeItem(at: checkpoint.0)
        }
    }

    private func backupSQLite(source: URL, destination: URL) throws {
        var sourceDb: OpaquePointer?
        var destinationDb: OpaquePointer?
        guard sqlite3_open_v2(
            source.path,
            &sourceDb,
            SQLITE_OPEN_READONLY | SQLITE_OPEN_FULLMUTEX,
            nil
        ) == SQLITE_OK else {
            if let sourceDb { sqlite3_close(sourceDb) }
            throw RelayError(.databaseUnavailable, "The Hermes profile database could not be opened for backup.")
        }
        defer { sqlite3_close(sourceDb) }
        guard sqlite3_open(destination.path, &destinationDb) == SQLITE_OK else {
            if let destinationDb { sqlite3_close(destinationDb) }
            throw RelayError(.databaseUnavailable, "The Hermes backup database could not be created.")
        }
        defer { sqlite3_close(destinationDb) }
        sqlite3_busy_timeout(sourceDb, 5_000)
        sqlite3_busy_timeout(destinationDb, 5_000)
        guard let backup = sqlite3_backup_init(destinationDb, "main", sourceDb, "main") else {
            throw RelayError(.databaseUnavailable, "The Hermes profile database backup could not start.")
        }
        var result = SQLITE_OK
        var busyAttempts = 0
        repeat {
            result = sqlite3_backup_step(backup, 256)
            if result == SQLITE_BUSY || result == SQLITE_LOCKED {
                busyAttempts += 1
                if busyAttempts <= 100 {
                    Thread.sleep(forTimeInterval: 0.05)
                }
            }
        } while result == SQLITE_OK
            || ((result == SQLITE_BUSY || result == SQLITE_LOCKED) && busyAttempts <= 100)
        let finish = sqlite3_backup_finish(backup)
        guard result == SQLITE_DONE, finish == SQLITE_OK else {
            throw RelayError(.databaseUnavailable, "The Hermes profile database backup did not complete.")
        }
        guard sqlite3_exec(
            destinationDb,
            "PRAGMA journal_mode=DELETE;",
            nil,
            nil,
            nil
        ) == SQLITE_OK else {
            throw RelayError(
                .databaseUnavailable,
                "The Hermes profile database backup could not be made portable."
            )
        }
    }

    private func safeProfileSlug(_ value: String) throws -> String {
        guard value.range(of: #"^[a-z0-9][a-z0-9_-]{0,62}$"#, options: .regularExpression) != nil else {
            throw RelayError(.invalidInput, "The Hermes profile identifier is not safe for backup.")
        }
        return value
    }

    private func relativePath(of file: URL, beneath root: URL) throws -> String {
        let rootPath = root.standardizedFileURL.path
        let filePath = file.standardizedFileURL.path
        guard filePath.hasPrefix(rootPath + "/") else {
            throw RelayError(.permissionDenied, "Relay refused to back up a file outside the Hermes profile.")
        }
        return String(filePath.dropFirst(rootPath.count + 1))
    }

    private static func requiresSQLiteSnapshot(_ url: URL) -> Bool {
        ["state.db", "kanban.db", "hermes_state.db", "response_store.db"]
            .contains(url.lastPathComponent)
    }

    private static func isTransientDatabaseSidecar(_ url: URL) -> Bool {
        url.lastPathComponent.hasSuffix("-wal")
            || url.lastPathComponent.hasSuffix("-shm")
            || url.lastPathComponent.hasSuffix("-journal")
    }

    private static func checkpointStamp(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "yyyyMMdd'T'HHmmssSSS'Z'"
        return formatter.string(from: date)
    }

    private static func isoString(_ date: Date) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.string(from: date)
    }
}

private extension JSONEncoder {
    static var relayBackup: JSONEncoder {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        return encoder
    }
}
