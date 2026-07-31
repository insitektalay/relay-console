import Foundation

struct ReleaseAcceptancePreparationFailure: Error, CustomStringConvertible {
    let description: String
}

@main
enum RelayConsoleReleaseAcceptancePreparationTests {
    static func main() throws {
        let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
        let matrix = try read(root, "Release/PUBLIC_BETA_ACCEPTANCE_MATRIX.md")
        let launchJourneyTemplate = try read(root, "Release/launch-journey-results.template.json")
        let builder = try read(root, "Scripts/build-release-app.sh")
        let validator = try read(root, "Scripts/validate-release-app.sh")
        let notices = try read(root, "Release/THIRD_PARTY_NOTICES.md")
        let cmarkNotices = try read(root, "Release/swift-cmark-COPYING")

        for scenario in [
            "HTTPS download and SHA-256 match",
            "Developer ID, hardened runtime, notarization, stapling, Gatekeeper",
            "Connect independently installed Hermes, health, model selection, agent dispatch",
            "Connect independently installed OpenClaw, health, model selection, agent dispatch",
            "Relay bridge update failure and rollback",
            "Enabled provider OAuth start, callback, status, reconnect, revoke",
            "Manual app update and rollback",
            "Prepare for app removal and reinstall",
            "Keyboard, focus, VoiceOver, long content, minimum window",
            "Upgrade from the previous supported beta"
        ] {
            try expect(matrix.contains(scenario), "acceptance matrix omits \(scenario)")
        }
        try expect(matrix.contains("Candidate status: no signed release candidate"), "matrix implies a release candidate exists")
        try expect(!matrix.contains("| Pass |"), "matrix contains fabricated pass evidence")
        try expect(!matrix.contains("Hermes fresh install") && !matrix.contains("OpenClaw fresh install"), "acceptance matrix still assigns third-party runtime installation to Relay Console")
        try expect(!matrix.contains("Harness update failure and rollback"), "acceptance matrix still assigns third-party runtime updates to Relay Console")
        for required in [
            "\"notarizedInstall\"",
            "\"purchaseAndEntitlement\"",
            "\"entitlementRequiredOnMac\"",
            "\"sameMacHermes\"",
            "\"sameMacOpenClaw\"",
            "\"remoteBridgeEnrollment\"",
            "\"crossClientConvergence\"",
            "\"dispatchFromEveryClient\"",
            "\"cancellationExportDeletion\""
        ] {
            try expect(launchJourneyTemplate.contains(required), "launch journey template omits \(required)")
        }
        try expect(launchJourneyTemplate.contains("\"status\": \"pending\""), "launch journey template must fail closed")
        try expect(!launchJourneyTemplate.contains("\"status\": \"passed\""), "launch journey template contains fabricated pass evidence")
        try expect(builder.contains("Release/THIRD_PARTY_NOTICES.md"), "release builder does not embed notices")
        try expect(validator.contains("Third-party notices missing"), "release validator does not require notices")
        for package in [
            "Swift Markdown UI 2.4.1",
            "NetworkImage 6.0.1",
            "swift-cmark 0.8.0",
            "PostHog Apple SDK 3.67.1",
            "Sentry Cocoa 9.23.0",
        ] {
            try expect(notices.contains(package), "notice inventory omits \(package)")
        }
        try expect(cmarkNotices.contains("Copyright (c) 2014, John MacFarlane"), "swift-cmark core notice is incomplete")
        try expect(cmarkNotices.contains("derive from https://github.com/vmg/houdini"), "swift-cmark component notices are incomplete")
        print("RelayConsoleReleaseAcceptancePreparationTests passed")
    }

    private static func read(_ root: URL, _ path: String) throws -> String {
        try String(contentsOf: root.appendingPathComponent(path), encoding: .utf8)
    }

    private static func expect(_ condition: @autoclosure () -> Bool, _ message: String) throws {
        guard condition() else { throw ReleaseAcceptancePreparationFailure(description: message) }
    }
}
