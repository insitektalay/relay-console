import Foundation

public struct HarnessReleasePin: Codable, Equatable, Sendable {
    public var displayName: String
    public var repositoryURL: String
    public var version: String
    public var gitRef: String
    public var commit: String
    public var requiredEntryPoint: String
}

public struct HarnessDownloadArtifactPin: Codable, Equatable, Sendable {
    public var url: String
    public var sha256: String
}

public struct HarnessToolchainPins: Codable, Equatable, Sendable {
    public var openClawNodeVersion: String
    public var openClawPnpmVersion: String
    public var uvVersion: String
    public var nodeArtifacts: [String: HarnessDownloadArtifactPin]
    public var uvArtifacts: [String: HarnessDownloadArtifactPin]
}

public struct HarnessCompatibilityManifest: Codable, Equatable, Sendable {
    public var schemaVersion: Int
    public var relayAppVersion: String
    public var testedAt: String
    public var harnesses: [String: HarnessReleasePin]
    public var toolchains: HarnessToolchainPins

    public func pin(for key: HarnessKey) throws -> HarnessReleasePin {
        guard schemaVersion == 1,
              relayAppVersion == RelayConsoleReleaseMetadata.current.version,
              let pin = harnesses[key.rawValue],
              Self.valid(pin)
        else {
            throw RelayError(.internalError, "Relay Console's harness compatibility manifest is missing, invalid, or belongs to another app release.")
        }
        return pin
    }

    public static func loadCurrent() throws -> HarnessCompatibilityManifest {
        guard let url = Bundle.module.url(forResource: "harness-compatibility", withExtension: "json") else {
            throw RelayError(.internalError, "Relay Console's harness compatibility manifest is missing.")
        }
        let manifest = try JSONDecoder().decode(HarnessCompatibilityManifest.self, from: Data(contentsOf: url))
        guard manifest.schemaVersion == 1,
              manifest.relayAppVersion == RelayConsoleReleaseMetadata.current.version,
              manifest.harnesses.count == 2,
              Set(manifest.harnesses.keys) == Set(HarnessKey.allCases.map(\.rawValue)),
              manifest.harnesses.values.allSatisfy(Self.valid),
              manifest.toolchains.openClawNodeVersion.range(of: "^[0-9]+\\.[0-9]+\\.[0-9]+$", options: .regularExpression) != nil,
              manifest.toolchains.openClawPnpmVersion.range(of: "^[0-9]+\\.[0-9]+\\.[0-9]+$", options: .regularExpression) != nil,
              manifest.toolchains.uvVersion.range(of: "^[0-9]+\\.[0-9]+\\.[0-9]+$", options: .regularExpression) != nil,
              Set(manifest.toolchains.nodeArtifacts.keys) == ["darwin-arm64", "darwin-x64"],
              Set(manifest.toolchains.uvArtifacts.keys) == ["aarch64-apple-darwin", "x86_64-apple-darwin"],
              manifest.toolchains.nodeArtifacts.allSatisfy({ validArtifact($0.value, host: "nodejs.org") }),
              manifest.toolchains.uvArtifacts.allSatisfy({ validArtifact($0.value, host: "github.com") })
        else {
            throw RelayError(.internalError, "Relay Console's harness compatibility manifest failed validation.")
        }
        return manifest
    }

    private static func valid(_ pin: HarnessReleasePin) -> Bool {
        guard pin.repositoryURL.hasPrefix("https://github.com/"), pin.repositoryURL.hasSuffix(".git"),
              pin.gitRef.hasPrefix("refs/tags/"),
              pin.version == String(pin.gitRef.dropFirst("refs/tags/".count)),
              pin.commit.range(of: "^[a-f0-9]{40}$", options: .regularExpression) != nil,
              !pin.requiredEntryPoint.isEmpty,
              !pin.requiredEntryPoint.contains(".."),
              !pin.requiredEntryPoint.hasPrefix("/")
        else { return false }
        return true
    }

    private static func validArtifact(_ artifact: HarnessDownloadArtifactPin, host: String) -> Bool {
        guard let url = URL(string: artifact.url), url.scheme == "https", url.host == host,
              url.user == nil, url.password == nil, url.query == nil, url.fragment == nil,
              artifact.sha256.range(of: "^[a-f0-9]{64}$", options: .regularExpression) != nil
        else { return false }
        return true
    }
}
