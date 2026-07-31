import Foundation

public struct RelayConsoleUpdateArtifact: Codable, Equatable, Sendable {
    public var version: String
    public var build: String
    public var dmgURL: String
    public var dmgSHA256: String
    public var architectures: [String]
    public var minimumMacOSVersion: String
    public var signatureMode: String
    public var notarizationStatus: String
    public var distributionEvidenceSHA256: String

    public init(version: String, build: String, dmgURL: String, dmgSHA256: String, architectures: [String], minimumMacOSVersion: String, signatureMode: String, notarizationStatus: String, distributionEvidenceSHA256: String) {
        self.version = version
        self.build = build
        self.dmgURL = dmgURL
        self.dmgSHA256 = dmgSHA256
        self.architectures = architectures
        self.minimumMacOSVersion = minimumMacOSVersion
        self.signatureMode = signatureMode
        self.notarizationStatus = notarizationStatus
        self.distributionEvidenceSHA256 = distributionEvidenceSHA256
    }
}

public struct RelayConsoleUpdateManifest: Codable, Equatable, Sendable {
    public var schemaVersion: Int
    public var channel: String
    public var publishedAt: String
    public var latest: RelayConsoleUpdateArtifact
    public var previous: RelayConsoleUpdateArtifact?
    public var releaseNotesURL: String
    public var supportURL: String

    public init(schemaVersion: Int = 1, channel: String, publishedAt: String, latest: RelayConsoleUpdateArtifact, previous: RelayConsoleUpdateArtifact? = nil, releaseNotesURL: String, supportURL: String) {
        self.schemaVersion = schemaVersion
        self.channel = channel
        self.publishedAt = publishedAt
        self.latest = latest
        self.previous = previous
        self.releaseNotesURL = releaseNotesURL
        self.supportURL = supportURL
    }
}

public enum RelayConsoleUpdateState: String, Codable, Equatable, Sendable {
    case current
    case updateAvailable = "update_available"
    case incompatibleArchitecture = "incompatible_architecture"
    case incompatibleSystem = "incompatible_system"
    case invalidManifest = "invalid_manifest"
    case channelMismatch = "channel_mismatch"
}

public struct RelayConsoleUpdateAssessment: Codable, Equatable, Sendable {
    public var state: RelayConsoleUpdateState
    public var message: String
    public var latest: RelayConsoleUpdateArtifact?
    public var rollback: RelayConsoleUpdateArtifact?
    public var downloadAllowed: Bool
    public var automaticInstallAllowed: Bool
    public var reasonCode: String

    public init(state: RelayConsoleUpdateState, message: String, latest: RelayConsoleUpdateArtifact?, rollback: RelayConsoleUpdateArtifact?, downloadAllowed: Bool, automaticInstallAllowed: Bool = false, reasonCode: String) {
        self.state = state
        self.message = message
        self.latest = latest
        self.rollback = rollback
        self.downloadAllowed = downloadAllowed
        self.automaticInstallAllowed = automaticInstallAllowed
        self.reasonCode = reasonCode
    }
}

public struct RelayConsoleAppUpdateService: Sendable {
    public init() {}

    public func decodeAndAssess(
        _ data: Data,
        current: RelayConsoleReleaseMetadata = .current,
        currentArchitecture: String,
        currentMacOSVersion: String? = nil
    ) -> RelayConsoleUpdateAssessment {
        do {
            let manifest = try JSONDecoder().decode(RelayConsoleUpdateManifest.self, from: data)
            return assess(manifest, current: current, currentArchitecture: currentArchitecture, currentMacOSVersion: currentMacOSVersion ?? Self.runningMacOSVersion)
        } catch {
            return invalid("update_manifest_decode_failed", "Relay Console could not read the update manifest. Keep this version installed and use the support link from the website.")
        }
    }

    public func assess(
        _ manifest: RelayConsoleUpdateManifest,
        current: RelayConsoleReleaseMetadata = .current,
        currentArchitecture: String,
        currentMacOSVersion: String
    ) -> RelayConsoleUpdateAssessment {
        guard manifest.schemaVersion == 1 else {
            return invalid("update_manifest_schema_unsupported", "This update manifest uses an unsupported schema. No download was opened.")
        }
        guard manifest.channel == current.releaseChannel else {
            return RelayConsoleUpdateAssessment(state: .channelMismatch, message: "The update belongs to a different release channel. No download was opened.", latest: nil, rollback: nil, downloadAllowed: false, reasonCode: "update_channel_mismatch")
        }
        guard Self.validTimestamp(manifest.publishedAt),
              Self.validHTTPSURL(manifest.releaseNotesURL),
              Self.validHTTPSURL(manifest.supportURL),
              Self.validArtifact(manifest.latest),
              manifest.previous.map(Self.validArtifact) ?? true
        else {
            return invalid("update_manifest_integrity_invalid", "The update manifest failed URL, checksum, version, or timestamp validation. No download was opened.")
        }
        guard manifest.latest.architectures.contains(currentArchitecture) else {
            return RelayConsoleUpdateAssessment(
                state: .incompatibleArchitecture, message: "The latest beta does not contain the required \(currentArchitecture) executable. Keep this version installed.", latest: manifest.latest, rollback: manifest.previous, downloadAllowed: false, reasonCode: "update_architecture_incompatible")
        }
        guard Self.version(currentMacOSVersion, isAtLeast: manifest.latest.minimumMacOSVersion) else {
            return RelayConsoleUpdateAssessment(
                state: .incompatibleSystem, message: "The latest beta requires macOS \(manifest.latest.minimumMacOSVersion) or later. Keep this version installed.", latest: manifest.latest, rollback: manifest.previous, downloadAllowed: false, reasonCode: "update_macos_incompatible")
        }
        guard !Self.isOlder(manifest.latest, thanVersion: current.version, build: current.build) else {
            return invalid("update_rollback_forbidden", "The update manifest offers an older Relay Console build. No download was opened.")
        }
        guard Self.isNewer(manifest.latest, thanVersion: current.version, build: current.build) else {
            return RelayConsoleUpdateAssessment(state: .current, message: "Relay Console \(current.version) (\(current.build)) is current for the \(current.releaseChannel) channel.", latest: manifest.latest, rollback: manifest.previous, downloadAllowed: false, reasonCode: "update_current")
        }
        let rollback = manifest.previous.flatMap { Self.isOlder($0, than: manifest.latest) ? $0 : nil }
        return RelayConsoleUpdateAssessment(
            state: .updateAvailable,
            message: "Relay Console \(manifest.latest.version) (\(manifest.latest.build)) is available. Download the notarized DMG, verify its SHA-256, quit Relay Console, and keep the previous notarized DMG until the new version passes first launch.",
            latest: manifest.latest,
            rollback: rollback,
            downloadAllowed: true,
            automaticInstallAllowed: false,
            reasonCode: "manual_update_available"
        )
    }

    private func invalid(_ code: String, _ message: String) -> RelayConsoleUpdateAssessment {
        RelayConsoleUpdateAssessment(state: .invalidManifest, message: message, latest: nil, rollback: nil, downloadAllowed: false, reasonCode: code)
    }

    private static func validArtifact(_ artifact: RelayConsoleUpdateArtifact) -> Bool {
        guard validVersion(artifact.version),
              Int(artifact.build).map({ $0 > 0 }) == true,
              artifact.build.range(of: "^[1-9][0-9]*$", options: .regularExpression) != nil,
              validHTTPSURL(artifact.dmgURL),
              URL(string: artifact.dmgURL)?.path.lowercased().hasSuffix(".dmg") == true,
              artifact.dmgSHA256.range(of: "^[a-f0-9]{64}$", options: .regularExpression) != nil,
              !artifact.architectures.isEmpty,
              Set(artifact.architectures).count == artifact.architectures.count,
              Set(artifact.architectures).isSubset(of: ["arm64", "x86_64"]),
              validVersion(artifact.minimumMacOSVersion),
              artifact.signatureMode == "developer-id-hardened-runtime",
              artifact.notarizationStatus == "accepted-stapled",
              artifact.distributionEvidenceSHA256.range(of: "^[a-f0-9]{64}$", options: .regularExpression) != nil
        else { return false }
        return true
    }

    private static func validHTTPSURL(_ value: String) -> Bool {
        guard let url = URL(string: value), url.scheme == "https", url.user == nil, url.password == nil,
              url.query == nil, url.fragment == nil, let host = url.host?.lowercased(), !host.isEmpty
        else { return false }
        let reservedSuffixes = [".local", ".internal", ".localhost", ".invalid", ".test", ".example"]
        if !host.contains(".") || host.contains(":") || host.range(of: "^[0-9.]+$", options: .regularExpression) != nil || reservedSuffixes.contains(where: host.hasSuffix) { return false }
        return true
    }

    private static func validTimestamp(_ value: String) -> Bool {
        ISO8601DateFormatter().date(from: value) != nil
    }

    private static var runningMacOSVersion: String {
        let version = ProcessInfo.processInfo.operatingSystemVersion
        return "\(version.majorVersion).\(version.minorVersion).\(version.patchVersion)"
    }

    private static func validVersion(_ value: String) -> Bool {
        value.range(of: "^[0-9]+\\.[0-9]+(?:\\.[0-9]+){0,2}$", options: .regularExpression) != nil
    }

    private static func version(_ current: String, isAtLeast required: String) -> Bool {
        compareVersions(current, required) != .orderedAscending
    }

    private static func isNewer(_ artifact: RelayConsoleUpdateArtifact, thanVersion currentVersion: String, build currentBuild: String) -> Bool {
        let comparison = compareVersions(artifact.version, currentVersion)
        if comparison != .orderedSame { return comparison == .orderedDescending }
        return (Int(artifact.build) ?? 0) > (Int(currentBuild) ?? 0)
    }

    private static func isOlder(_ candidate: RelayConsoleUpdateArtifact, than latest: RelayConsoleUpdateArtifact) -> Bool {
        let comparison = compareVersions(candidate.version, latest.version)
        if comparison != .orderedSame { return comparison == .orderedAscending }
        return (Int(candidate.build) ?? 0) < (Int(latest.build) ?? 0)
    }

    private static func isOlder(_ artifact: RelayConsoleUpdateArtifact, thanVersion currentVersion: String, build currentBuild: String) -> Bool {
        let comparison = compareVersions(artifact.version, currentVersion)
        if comparison != .orderedSame { return comparison == .orderedAscending }
        return (Int(artifact.build) ?? 0) < (Int(currentBuild) ?? 0)
    }

    private static func compareVersions(_ lhs: String, _ rhs: String) -> ComparisonResult {
        let left = lhs.split(separator: ".").map { Int($0) ?? 0 }
        let right = rhs.split(separator: ".").map { Int($0) ?? 0 }
        for index in 0..<max(left.count, right.count) {
            let l = index < left.count ? left[index] : 0
            let r = index < right.count ? right[index] : 0
            if l < r { return .orderedAscending }
            if l > r { return .orderedDescending }
        }
        return .orderedSame
    }
}
