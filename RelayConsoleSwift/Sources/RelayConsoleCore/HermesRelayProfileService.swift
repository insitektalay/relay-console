import Foundation

struct HermesRelayProfileMarker: Codable, Equatable, Sendable {
    static let schemaVersion = 2

    var schemaVersion: Int
    var agentId: String
    var profileSlug: String
    var managedBy: String
    var ownershipNonce: String
}

enum HermesRelayProfileService {
    static let markerFilename = ".relay-console-profile.json"

    private static let durableTopLevelNames: Set<String> = [
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

    static func markerURL(profileHome: URL) -> URL {
        profileHome.appendingPathComponent(markerFilename, isDirectory: false)
    }

    static func marker(profileHome: URL) -> HermesRelayProfileMarker? {
        let url = markerURL(profileHome: profileHome)
        guard let values = try? url.resourceValues(
            forKeys: [.isRegularFileKey, .isSymbolicLinkKey]
        ),
        values.isRegularFile == true,
        values.isSymbolicLink != true,
        let data = try? Data(contentsOf: url)
        else {
            return nil
        }
        return try? JSONDecoder().decode(HermesRelayProfileMarker.self, from: data)
    }

    static func owns(
        profileHome: URL,
        agentId: String,
        profileSlug: String,
        ownershipNonce: String?
    ) -> Bool {
        let home = profileHome.standardizedFileURL
        guard let ownershipNonce,
              ownershipNonce.range(
                  of: #"^[A-Za-z0-9-]{20,128}$"#,
                  options: .regularExpression
              ) != nil
        else {
            return false
        }
        guard profileSlug.range(
            of: #"^[a-z0-9][a-z0-9_-]{0,62}$"#,
            options: .regularExpression
        ) != nil,
        home.lastPathComponent == profileSlug,
        let values = try? home.resourceValues(
            forKeys: [.isDirectoryKey, .isSymbolicLinkKey]
        ),
        values.isDirectory == true,
        values.isSymbolicLink != true
        else {
            return false
        }
        return marker(profileHome: profileHome) == HermesRelayProfileMarker(
            schemaVersion: HermesRelayProfileMarker.schemaVersion,
            agentId: agentId,
            profileSlug: profileSlug,
            managedBy: "Relay Console",
            ownershipNonce: ownershipNonce
        )
    }

    static func writeMarker(
        profileHome: URL,
        agentId: String,
        profileSlug: String,
        ownershipNonce: String
    ) throws {
        let marker = HermesRelayProfileMarker(
            schemaVersion: HermesRelayProfileMarker.schemaVersion,
            agentId: agentId,
            profileSlug: profileSlug,
            managedBy: "Relay Console",
            ownershipNonce: ownershipNonce
        )
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        var data = try encoder.encode(marker)
        data.append(0x0A)
        let url = markerURL(profileHome: profileHome)
        try data.write(to: url, options: .atomic)
        try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: url.path)
    }

    static func isDirectProfile(_ profileHome: URL, beneath hermesRoot: URL) -> Bool {
        let home = profileHome.standardizedFileURL
        let profiles = hermesRoot.standardizedFileURL
            .appendingPathComponent("profiles", isDirectory: true)
        if (try? home.resourceValues(forKeys: [.isSymbolicLinkKey]).isSymbolicLink) == true {
            return false
        }
        let resolvedHome = home.resolvingSymlinksInPath()
        let resolvedProfiles = profiles.resolvingSymlinksInPath()
        return home.deletingLastPathComponent().standardizedFileURL == profiles.standardizedFileURL
            && resolvedHome.deletingLastPathComponent().standardizedFileURL
                == resolvedProfiles.standardizedFileURL
            && !home.lastPathComponent.isEmpty
    }

    static func copyDurableState(from source: URL, to destination: URL) throws {
        let fileManager = FileManager.default
        for name in durableTopLevelNames.sorted() {
            let from = source.appendingPathComponent(name)
            guard fileManager.fileExists(atPath: from.path) else { continue }
            let to = destination.appendingPathComponent(name)
            try copyDurableItem(from: from, to: to, fileManager: fileManager)
        }
    }

    private static func copyDurableItem(
        from source: URL,
        to destination: URL,
        fileManager: FileManager
    ) throws {
        let values = try source.resourceValues(
            forKeys: [.isDirectoryKey, .isRegularFileKey, .isSymbolicLinkKey]
        )
        guard values.isSymbolicLink != true,
              !excludedNames.contains(source.lastPathComponent),
              !isDatabaseSidecar(source)
        else { return }

        if values.isDirectory == true {
            try fileManager.createDirectory(at: destination, withIntermediateDirectories: true)
            for child in try fileManager.contentsOfDirectory(
                at: source,
                includingPropertiesForKeys: [
                    .isDirectoryKey,
                    .isRegularFileKey,
                    .isSymbolicLinkKey,
                ],
                options: [.skipsPackageDescendants, .skipsHiddenFiles]
            ) {
                try copyDurableItem(
                    from: child,
                    to: destination.appendingPathComponent(child.lastPathComponent),
                    fileManager: fileManager
                )
            }
            return
        }

        guard values.isRegularFile == true else { return }
        if fileManager.fileExists(atPath: destination.path) {
            try fileManager.removeItem(at: destination)
        }
        try fileManager.createDirectory(
            at: destination.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        try fileManager.copyItem(at: source, to: destination)
    }

    private static func isDatabaseSidecar(_ url: URL) -> Bool {
        url.lastPathComponent.hasSuffix("-wal")
            || url.lastPathComponent.hasSuffix("-shm")
            || url.lastPathComponent.hasSuffix("-journal")
    }
}
