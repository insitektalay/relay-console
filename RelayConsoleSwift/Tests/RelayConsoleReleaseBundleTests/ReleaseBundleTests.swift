import Foundation
import RelayConsoleSourceTestSupport
import RelayConsoleCore

private struct ReleaseBundleTestFailure: Error, CustomStringConvertible {
    let description: String
}

@main
struct RelayConsoleReleaseBundleTests {
    private static let packageRoot = URL(fileURLWithPath: #filePath)
        .deletingLastPathComponent()
        .deletingLastPathComponent()
        .deletingLastPathComponent()

    static func main() throws {
        try testCentralReleaseMetadata()
        try testPackagingScriptsDoNotCreateARebuildLauncher()
        try testDistributionPipelineContract()
        try testConnectedLegacyHarnessCanChangeLocation()
        try testBridgeDeviceInventoryContract()
        if let appPath = ProcessInfo.processInfo.environment["RELAY_CONSOLE_RELEASE_APP_PATH"] {
            try testStandaloneBundle(at: URL(fileURLWithPath: appPath, isDirectory: true))
        }
        print("RelayConsoleReleaseBundleTests passed")
    }

    private static func testCentralReleaseMetadata() throws {
        let metadata = RelayConsoleReleaseMetadata.current
        try expect(metadata.productName == "Relay Console", "product name mismatch")
        try expect(metadata.bundleIdentifier == "com.relayconsole.app", "production bundle identifier mismatch")
        try expect(metadata.version == "0.1.1" && metadata.build == "6", "version/build mismatch")
        try expect(metadata.releaseChannel == "public-beta", "release channel mismatch")
        try expect(metadata.minimumMacOSVersion == "14.0", "minimum macOS mismatch")
    }

    private static func testPackagingScriptsDoNotCreateARebuildLauncher() throws {
        let buildScript = try readPackageFile("Scripts/build-release-app.sh")
        let validator = try readPackageFile("Scripts/validate-release-app.sh")
        let privacyManifest = try readPackageFile("Release/PrivacyInfo.xcprivacy")
        try expect(buildScript.contains("CFBundleExecutable</key>\n  <string>$PRODUCT_NAME</string>"), "bundle must launch the embedded product directly")
        try expect(!buildScript.contains("Relay Console Launcher"), "release builder must not create a rebuild launcher")
        try expect(buildScript.contains("Contents/Resources") || buildScript.contains("RESOURCES_PATH"), "release builder must embed resources")
        try expect(validator.contains("Development rebuild launcher must not ship"), "validator must reject the development launcher")
        try expect(buildScript.contains("PrivacyInfo.xcprivacy"), "release builder must embed the root privacy manifest")
        try expect(validator.contains("Privacy manifest missing from Contents/Resources"), "validator must require the root privacy manifest")
        try expect(privacyManifest.contains("NSPrivacyAccessedAPICategoryUserDefaults") && privacyManifest.contains("CA92.1"), "privacy manifest must declare app-only defaults")
        try expect(privacyManifest.contains("NSPrivacyAccessedAPICategoryFileTimestamp") && privacyManifest.contains("C617.1") && privacyManifest.contains("3B52.1"), "privacy manifest must declare container and user-selected file metadata")
    }

    private static func testDistributionPipelineContract() throws {
        let distribution = try readPackageFile("Scripts/build-distribution.sh")
        let appBuilder = try readPackageFile("Scripts/build-release-app.sh")
        let validator = try readPackageFile("Scripts/validate-release-app.sh")
        let entitlements = try readPackageFile("Release/RelayConsole.entitlements")
        for expected in [
            "--options runtime",
            "RELAY_CONSOLE_DEVELOPER_ID_APPLICATION",
            "Developer ID Application:",
            "RELAY_CONSOLE_NOTARY_KEYCHAIN_PROFILE",
            "notarytool submit",
            "--output-format json",
            "stapler staple",
            "stapler validate",
            "hdiutil create",
            "com.apple.quarantine",
            "spctl --assess",
            "quarantineMountVerification",
            "appSubmissionSHA256",
            "dmgSubmissionSHA256",
            "apple-distribution-evidence.mjs",
            "universal2",
            "lipo -archs"
        ] {
            try expect(distribution.contains(expected), "distribution pipeline missing \(expected)")
        }
        try expect(
            appBuilder.contains("--skip-signature-verification")
                && validator.contains("SKIP_SIGNATURE_VERIFICATION"),
            "unsigned intermediate validation must not block the later distribution signing step")
        try expect(
            appBuilder.contains("--scratch-path")
                && appBuilder.contains("RELEASE_TEST_ARCHITECTURE"),
            "release bundle tests must reuse the optimized architecture build cache")
        try expect(
            appBuilder.contains(".build/release-$architecture/$relative_path")
                && appBuilder.contains(".build/$relative_path"),
            "release builder must resolve Sparkle from its custom scratch directory before the default SwiftPM build directory")
        try expect(entitlements.contains("<dict/>"), "hardened-runtime entitlement set should remain minimal")
    }

    private static func testConnectedLegacyHarnessCanChangeLocation() throws {
        let views = try readPackageFile("Sources/RelayConsoleApp/Views.swift")
        guard let connectedBranch = views.range(
            of: "if record.lifecycleState == .connected && record.modelAuthStatus == .connected"
        ), let missingBranch = views.range(
            of: "} else if record.source == .missing",
            range: connectedBranch.upperBound..<views.endIndex
        ) else {
            throw ReleaseBundleTestFailure(description: "HarnessCard connection branches are missing")
        }
        let source = views[connectedBranch.lowerBound..<missingBranch.lowerBound]
        try expect(
            source.contains("Button(\"Change location…\")"),
            "a connected legacy harness must retain the change-location migration control"
        )
    }

    private static func testBridgeDeviceInventoryContract() throws {
        let settings = try readPackageFile("Sources/RelayConsoleApp/CloudRelaySettingsView.swift")
        let cloudTransport = try readPackageFile("Sources/RelayConsoleCore/CloudRelaySync.swift")
        let accountExport = try readPackageFile("Sources/RelayConsoleCore/RelayCloudAccountExportService.swift")
        let sessionSecurity = try readPackageFile("Sources/RelayConsoleCore/RelayCloudSessionSecurityService.swift")
        for required in [
            "Runtime bridges",
            "hostType",
            "runtimeType",
            "pluginVersion",
            "openCoreVersion",
            "lastSeenAt",
            "credentialVersion",
            "credentialRotatedAt",
            "compatibility",
            "bridge/devices/\\(device.id)/revoke"
        ] {
            try expect(settings.contains(required), "bridge device inventory is missing \(required)")
        }
        try expect(cloudTransport.contains("public func sendArray"), "cloud transport must decode Railway list responses")
        try expect(!settings.contains("Make selected agents available"), "macOS cloud settings must not silently act as the runtime bridge")
        try expect(!settings.contains("enrollAndPublish"), "macOS cloud settings must direct users to the standalone runtime bridge")
        for required in [
            "Export Relay account data",
            "separate from Export local data",
            "validAccessToken",
            "RelayCloudAccountExportService",
            "Delete Relay account",
            "accountDeletionPassword",
            "accountDeletionConfirmation != \"DELETE\"",
            "RelayCloudAccountDeletionService",
            "cloudSync.unlink",
            "Your local Mac data remains available",
            "Signed-in devices and browsers",
            "auth/sessions",
            "auth/web/sessions",
            "revokeAccountSession",
            "deviceName\": \"Mac",
            "platform\": \"macOS",
            "Task { await signOutCurrentAccount() }",
            "RelayCloudSessionSecurityService",
            "clearCloudAccountViewState",
            "Signed out on this Mac, but Relay could not confirm remote session revocation",
            "Relay account session revoked, but local credentials could not be removed"
        ] {
            try expect(settings.contains(required), "macOS Relay Cloud export UI is missing \(required)")
        }
        for required in [
            "auth/account/export",
            "auth/account",
            "confirmation == \"DELETE\"",
            ".prettyPrinted",
            ".sortedKeys",
            ".withoutEscapingSlashes",
            ".posixPermissions: 0o600"
        ] {
            try expect(accountExport.contains(required), "macOS Relay Cloud export service is missing \(required)")
        }
        for required in [
            "auth/change-password",
            "auth/logout",
            "auth/sessions/\\(id)",
            "auth/web/sessions/\\(id)/revoke",
            "id.count <= 128",
            "CharacterSet.alphanumerics"
        ] {
            try expect(sessionSecurity.contains(required), "macOS Relay Cloud session security is missing \(required)")
        }
    }

    private static func testStandaloneBundle(at app: URL) throws {
        let contents = app.appendingPathComponent("Contents", isDirectory: true)
        let infoURL = contents.appendingPathComponent("Info.plist")
        let infoData = try Data(contentsOf: infoURL)
        let info = try PropertyListSerialization.propertyList(from: infoData, format: nil) as? [String: Any]
        try expect(info?["CFBundleExecutable"] as? String == "Relay Console", "packaged executable mismatch")
        try expect(info?["CFBundleIdentifier"] as? String == RelayConsoleReleaseMetadata.current.bundleIdentifier, "packaged identifier mismatch")
        try expect(info?["CFBundleShortVersionString"] as? String == RelayConsoleReleaseMetadata.current.version, "packaged version mismatch")
        try expect(info?["CFBundleVersion"] as? String == RelayConsoleReleaseMetadata.current.build, "packaged build mismatch")
        let architecturePolicy = info?["RelayConsoleArchitecturePolicy"] as? String
        try expect(architecturePolicy.map { ["arm64", "x86_64", "universal2"].contains($0) } == true, "packaged architecture policy missing")

        let main = contents.appendingPathComponent("MacOS/Relay Console")
        let bridge = contents.appendingPathComponent("MacOS/RelayMarketplaceToolBridge")
        try expect(FileManager.default.isExecutableFile(atPath: main.path), "packaged main executable missing")
        try expect(FileManager.default.isExecutableFile(atPath: bridge.path), "packaged bridge missing")
        try expect(!FileManager.default.fileExists(atPath: contents.appendingPathComponent("MacOS/Relay Console Launcher").path), "development launcher leaked into release app")

        let resources = try FileManager.default.contentsOfDirectory(atPath: contents.appendingPathComponent("Resources").path)
        let bundles = resources.filter { $0.hasPrefix("RelayConsoleSwift_") && $0.hasSuffix(".bundle") }
        try expect(bundles.count == 2, "release app must contain exactly two SwiftPM resource bundles")
        try expect(resources.contains("PrivacyInfo.xcprivacy"), "release app must contain a root privacy manifest")
        let privacyManifestURL = contents.appendingPathComponent("Resources/PrivacyInfo.xcprivacy")
        let privacyData = try Data(contentsOf: privacyManifestURL)
        let privacy = try PropertyListSerialization.propertyList(from: privacyData, format: nil) as? [String: Any]
        try expect(privacy?["NSPrivacyTracking"] as? Bool == false, "release app privacy manifest must disable tracking")
        let rootEntries = try FileManager.default.contentsOfDirectory(atPath: app.path)
        try expect(!rootEntries.contains { $0.hasSuffix(".bundle") }, "resource bundle duplicated at app root")
    }

    private static func readPackageFile(_ relativePath: String) throws -> String {
        try RelayConsoleSourceTestSupport.read(root: packageRoot, path: relativePath)
    }

    private static func expect(_ condition: @autoclosure () throws -> Bool, _ message: String) throws {
        guard try condition() else { throw ReleaseBundleTestFailure(description: message) }
    }
}
