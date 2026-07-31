import Foundation
import RelayConsoleCore

private struct AppUpdateTestFailure: Error, CustomStringConvertible { let description: String }

@main
struct RelayConsoleAppUpdateTests {
    static func main() throws {
        let service = RelayConsoleAppUpdateService()
        let current = RelayConsoleReleaseMetadata(productName: "Relay Console", bundleIdentifier: "com.relayconsole.app", version: "0.1.0", build: "1", releaseChannel: "public-beta", minimumMacOSVersion: "14.0", applicationCategory: "public.app-category.productivity")
        let latest = artifact(version: "0.2.0", build: "2")
        let previous = artifact(version: "0.1.0", build: "1", sha: String(repeating: "b", count: 64))
        let manifest = RelayConsoleUpdateManifest(channel: "public-beta", publishedAt: "2026-07-11T10:00:00Z", latest: latest, previous: previous, releaseNotesURL: "https://relayconsole.work/release-notes", supportURL: "https://relayconsole.work/support")

        let available = service.assess(manifest, current: current, currentArchitecture: "arm64", currentMacOSVersion: "14.5")
        try expect(available.state == .updateAvailable && available.downloadAllowed && !available.automaticInstallAllowed, "new compatible release should allow manual download only")
        try expect(available.rollback == previous && available.message.contains("verify its SHA-256"), "manual update should retain exact rollback metadata and checksum guidance")

        var same = manifest
        same.latest = artifact(version: "0.1.0", build: "1")
        try expect(service.assess(same, current: current, currentArchitecture: "arm64", currentMacOSVersion: "14.5").state == .current, "same version/build should be current")

        var wrongChannel = manifest
        wrongChannel.channel = "stable"
        try expect(service.assess(wrongChannel, current: current, currentArchitecture: "arm64", currentMacOSVersion: "14.5").state == .channelMismatch, "cross-channel update should fail closed")

        var wrongArchitecture = manifest
        wrongArchitecture.latest.architectures = ["x86_64"]
        try expect(service.assess(wrongArchitecture, current: current, currentArchitecture: "arm64", currentMacOSVersion: "14.5").state == .incompatibleArchitecture, "missing current architecture should fail closed")

        var older = manifest
        older.latest = artifact(version: "0.0.9", build: "9")
        let olderResult = service.assess(older, current: current, currentArchitecture: "arm64", currentMacOSVersion: "14.5")
        try expect(olderResult.state == .invalidManifest && !olderResult.downloadAllowed && olderResult.reasonCode == "update_rollback_forbidden", "older update metadata should fail closed")

        var unsigned = manifest
        unsigned.latest.signatureMode = "unsigned"
        try expect(service.assess(unsigned, current: current, currentArchitecture: "arm64", currentMacOSVersion: "14.5").state == .invalidManifest, "unsigned artifacts should fail closed")

        var unnotarized = manifest
        unnotarized.latest.notarizationStatus = "not-submitted"
        try expect(service.assess(unnotarized, current: current, currentArchitecture: "arm64", currentMacOSVersion: "14.5").state == .invalidManifest, "unnotarized artifacts should fail closed")

        var mismatchedEvidence = manifest
        mismatchedEvidence.latest.distributionEvidenceSHA256 = "different"
        try expect(service.assess(mismatchedEvidence, current: current, currentArchitecture: "arm64", currentMacOSVersion: "14.5").state == .invalidManifest, "invalid distribution evidence binding should fail closed")

        var wrongSystem = manifest
        wrongSystem.latest.minimumMacOSVersion = "15.0"
        try expect(service.assess(wrongSystem, current: current, currentArchitecture: "arm64", currentMacOSVersion: "14.5").state == .incompatibleSystem, "unsupported macOS should fail closed")

        for invalidURL in ["http://relayconsole.work/download.dmg", "https://localhost/download.dmg", "https://127.0.0.1/download.dmg", "https://10.0.0.1/download.dmg", "https://relayconsole.test/download.dmg"] {
            var invalid = manifest
            invalid.latest.dmgURL = invalidURL
            let result = service.assess(invalid, current: current, currentArchitecture: "arm64", currentMacOSVersion: "14.5")
            try expect(result.state == .invalidManifest && !result.downloadAllowed, "unsafe update URL should fail closed")
        }

        var invalidHash = manifest
        invalidHash.latest.dmgSHA256 = "not-a-checksum"
        try expect(service.assess(invalidHash, current: current, currentArchitecture: "arm64", currentMacOSVersion: "14.5").state == .invalidManifest, "invalid checksum should fail closed")

        var invalidVersion = manifest
        invalidVersion.latest.version = "-1.2"
        try expect(service.assess(invalidVersion, current: current, currentArchitecture: "arm64", currentMacOSVersion: "14.5").state == .invalidManifest, "non-semantic version should fail closed")

        var duplicateArchitecture = manifest
        duplicateArchitecture.latest.architectures = ["arm64", "arm64"]
        try expect(service.assess(duplicateArchitecture, current: current, currentArchitecture: "arm64", currentMacOSVersion: "14.5").state == .invalidManifest, "duplicate architecture entries should fail closed")

        let malformed = service.decodeAndAssess(Data("{}".utf8), current: current, currentArchitecture: "arm64", currentMacOSVersion: "14.5")
        try expect(malformed.state == .invalidManifest && malformed.reasonCode == "update_manifest_decode_failed", "malformed manifest should expose safe failure messaging")
        print("RelayConsoleAppUpdateTests passed")
    }

    private static func artifact(version: String, build: String, sha: String = String(repeating: "a", count: 64)) -> RelayConsoleUpdateArtifact {
        RelayConsoleUpdateArtifact(version: version, build: build, dmgURL: "https://relayconsole.work/downloads/RelayConsole-\(version).dmg", dmgSHA256: sha, architectures: ["arm64"], minimumMacOSVersion: "14.0", signatureMode: "developer-id-hardened-runtime", notarizationStatus: "accepted-stapled", distributionEvidenceSHA256: String(repeating: "c", count: 64))
    }

    private static func expect(_ condition: @autoclosure () throws -> Bool, _ message: String) throws {
        guard try condition() else { throw AppUpdateTestFailure(description: message) }
    }
}
