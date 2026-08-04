import Foundation

public enum RuntimeDiscoveryCompatibility: String, Codable, Equatable, Sendable {
    case ready
}

public enum RuntimeDiscoveryConnectionStatus: String, Codable, Equatable, Sendable {
    case available
    case connecting
    case connected
    case needsAttention = "needs_attention"
}

public struct RuntimeDiscoveryCandidate: Identifiable, Codable, Equatable, Sendable {
    public var id: String { "\(harnessKey.rawValue):\(location.path)" }
    public var harnessKey: HarnessKey
    public var runtimeName: String
    public var location: URL
    public var displayLocation: String
    public var version: String?
    public var compatibility: RuntimeDiscoveryCompatibility
    public var healthMessage: String

    public init(
        harnessKey: HarnessKey,
        runtimeName: String,
        location: URL,
        displayLocation: String,
        version: String?,
        compatibility: RuntimeDiscoveryCompatibility = .ready,
        healthMessage: String = "Installation looks ready"
    ) {
        self.harnessKey = harnessKey
        self.runtimeName = runtimeName
        self.location = location
        self.displayLocation = displayLocation
        self.version = version
        self.compatibility = compatibility
        self.healthMessage = healthMessage
    }
}

public struct RuntimeDiscoverySearchConfiguration: Sendable {
    public var homeDirectory: URL
    public var hermesLocations: [URL]
    public var openClawCommandLocations: [URL]
    public var openClawPackageLocations: [URL]
    public var nodeLocations: [URL]

    public init(
        homeDirectory: URL,
        hermesLocations: [URL],
        openClawCommandLocations: [URL],
        openClawPackageLocations: [URL],
        nodeLocations: [URL]
    ) {
        self.homeDirectory = homeDirectory
        self.hermesLocations = hermesLocations
        self.openClawCommandLocations = openClawCommandLocations
        self.openClawPackageLocations = openClawPackageLocations
        self.nodeLocations = nodeLocations
    }

    public static func standard(homeDirectory: URL = FileManager.default.homeDirectoryForCurrentUser) -> Self {
        let home = homeDirectory.standardizedFileURL
        return Self(
            homeDirectory: home,
            hermesLocations: [
                home.appendingPathComponent(".hermes/hermes-agent", isDirectory: true),
                home.appendingPathComponent("hermes-agent", isDirectory: true),
                home.appendingPathComponent("Developer/hermes-agent", isDirectory: true),
                home.appendingPathComponent("Projects/hermes-agent", isDirectory: true)
            ],
            openClawCommandLocations: [
                URL(fileURLWithPath: "/opt/homebrew/bin/openclaw"),
                URL(fileURLWithPath: "/usr/local/bin/openclaw"),
                home.appendingPathComponent(".npm-global/bin/openclaw"),
                home.appendingPathComponent(".local/bin/openclaw"),
                home.appendingPathComponent("Library/pnpm/openclaw")
            ],
            openClawPackageLocations: [
                URL(fileURLWithPath: "/opt/homebrew/lib/node_modules/openclaw", isDirectory: true),
                URL(fileURLWithPath: "/usr/local/lib/node_modules/openclaw", isDirectory: true),
                home.appendingPathComponent(".npm-global/lib/node_modules/openclaw", isDirectory: true),
                home.appendingPathComponent(".local/share/pnpm/global/5/node_modules/openclaw", isDirectory: true),
                home.appendingPathComponent("Library/pnpm/global/5/node_modules/openclaw", isDirectory: true)
            ],
            nodeLocations: [
                URL(fileURLWithPath: "/opt/homebrew/bin/node"),
                URL(fileURLWithPath: "/opt/homebrew/opt/node/bin/node"),
                URL(fileURLWithPath: "/usr/local/bin/node"),
                URL(fileURLWithPath: "/usr/local/opt/node/bin/node"),
                URL(fileURLWithPath: "/usr/bin/node")
            ]
        )
    }
}

public enum RuntimeInstallationDiscovery {
    public static func connectionStatus(
        for candidate: RuntimeDiscoveryCandidate,
        records: [HarnessInstallRecord],
        connecting: Bool
    ) -> RuntimeDiscoveryConnectionStatus {
        if connecting { return .connecting }
        guard let record = matchingRecord(for: candidate, records: records) else {
            return .available
        }
        return record.lifecycleState == .connected ? .connected : .needsAttention
    }

    public static func matchingRecord(
        for candidate: RuntimeDiscoveryCandidate,
        records: [HarnessInstallRecord]
    ) -> HarnessInstallRecord? {
        let candidatePath = candidate.location.resolvingSymlinksInPath().standardizedFileURL.path
        return records.first { record in
            guard record.harnessKey == candidate.harnessKey else { return false }
            let storedPaths = [record.installPath, record.selectedLocalPath]
                .compactMap { $0 }
                .map {
                    URL(fileURLWithPath: $0).resolvingSymlinksInPath().standardizedFileURL.path
                }
            return storedPaths.contains(candidatePath)
        }
    }

    public static func discover(
        configuration: RuntimeDiscoverySearchConfiguration = .standard()
    ) async -> [RuntimeDiscoveryCandidate] {
        await Task.detached(priority: .utility) {
            discoverSynchronously(configuration: configuration)
        }.value
    }

    static func discoverSynchronously(
        configuration: RuntimeDiscoverySearchConfiguration
    ) -> [RuntimeDiscoveryCandidate] {
        var candidates: [RuntimeDiscoveryCandidate] = []
        var seen: Set<String> = []

        for location in configuration.hermesLocations {
            guard let candidate = hermesCandidate(at: location, home: configuration.homeDirectory),
                  seen.insert(candidate.id).inserted
            else { continue }
            candidates.append(candidate)
        }

        guard configuration.nodeLocations.contains(where: {
            FileManager.default.isExecutableFile(atPath: $0.path)
        }) else {
            return candidates
        }

        for location in configuration.openClawPackageLocations + configuration.openClawCommandLocations {
            guard let root = resolveOpenClawRoot(from: location),
                  let candidate = openClawCandidate(at: root, home: configuration.homeDirectory),
                  seen.insert(candidate.id).inserted
            else { continue }
            candidates.append(candidate)
        }
        return candidates
    }

    private static func hermesCandidate(at location: URL, home: URL) -> RuntimeDiscoveryCandidate? {
        let root = location.standardizedFileURL
        guard FileManager.default.fileExists(atPath: root.appendingPathComponent("run_agent.py").path),
              [".venv/bin/python", "venv/bin/python"].contains(where: {
                  FileManager.default.isExecutableFile(atPath: root.appendingPathComponent($0).path)
              })
        else { return nil }
        return RuntimeDiscoveryCandidate(
            harnessKey: .hermes,
            runtimeName: "Hermes Agent",
            location: root,
            displayLocation: friendlyPath(root, home: home),
            version: hermesVersion(at: root)
        )
    }

    private static func openClawCandidate(at location: URL, home: URL) -> RuntimeDiscoveryCandidate? {
        let root = location.resolvingSymlinksInPath().standardizedFileURL
        let entryPoint = root.appendingPathComponent("openclaw.mjs")
        let packageURL = root.appendingPathComponent("package.json")
        guard FileManager.default.fileExists(atPath: entryPoint.path),
              let package = jsonObject(at: packageURL),
              (package["name"] as? String)?.lowercased() == "openclaw"
        else { return nil }
        return RuntimeDiscoveryCandidate(
            harnessKey: .openclaw,
            runtimeName: "OpenClaw",
            location: root,
            displayLocation: friendlyPath(root, home: home),
            version: package["version"] as? String
        )
    }

    private static func resolveOpenClawRoot(from location: URL) -> URL? {
        var isDirectory: ObjCBool = false
        guard FileManager.default.fileExists(atPath: location.path, isDirectory: &isDirectory) else {
            return nil
        }
        let resolved = location.resolvingSymlinksInPath().standardizedFileURL
        var candidate = isDirectory.boolValue ? resolved : resolved.deletingLastPathComponent()
        for _ in 0..<8 {
            if FileManager.default.fileExists(atPath: candidate.appendingPathComponent("openclaw.mjs").path) {
                return candidate
            }
            let parent = candidate.deletingLastPathComponent()
            if parent.path == candidate.path { break }
            candidate = parent
        }
        return nil
    }

    private static func hermesVersion(at root: URL) -> String? {
        let pyproject = root.appendingPathComponent("pyproject.toml")
        guard let text = try? String(contentsOf: pyproject, encoding: .utf8) else { return nil }
        let pattern = #"(?m)^\s*version\s*=\s*[\"']([^\"']+)[\"']\s*$"#
        guard let regex = try? NSRegularExpression(pattern: pattern),
              let match = regex.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)),
              let range = Range(match.range(at: 1), in: text)
        else { return nil }
        return String(text[range])
    }

    private static func jsonObject(at url: URL) -> [String: Any]? {
        guard let data = try? Data(contentsOf: url, options: [.mappedIfSafe]),
              data.count <= 1_048_576,
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { return nil }
        return object
    }

    private static func friendlyPath(_ url: URL, home: URL) -> String {
        let path = url.standardizedFileURL.path
        let homePath = home.standardizedFileURL.path
        if path == homePath { return "~" }
        if path.hasPrefix(homePath + "/") {
            return "~" + String(path.dropFirst(homePath.count))
        }
        return path
    }
}
