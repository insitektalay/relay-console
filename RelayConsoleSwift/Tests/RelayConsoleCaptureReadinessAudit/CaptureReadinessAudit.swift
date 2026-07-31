import Foundation

@main
struct RelayConsoleCaptureReadinessAudit {
    static func main() throws {
        let arguments = Array(CommandLine.arguments.dropFirst())
        let outputPath = outputPath(from: arguments)
        let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)

        let package = try read(root, "Package.swift")
        let services = try read(root, "Sources/RelayConsoleCore/RelayConsoleServices.swift")
        let appPaths = try read(root, "Sources/RelayConsoleCore/AppPathsService.swift")
        let appViewModel = try read(root, "Sources/RelayConsoleApp/AppViewModel.swift")
        let appEntryPoint = try read(root, "Sources/RelayConsoleApp/AppEntryPoint.swift")
        let appLauncher = try read(root, "Sources/RelayConsoleAppLauncher/RelayConsoleApp.swift")
        let relayApp = appEntryPoint + appLauncher
        let smokeTests = try read(root, "Tests/RelayConsoleCoreSmokeTests/SmokeTests.swift")
        let visualHarness = try read(root, "Tests/RelayConsoleVisualCaptureHarness/VisualCaptureHarness.swift")
        let accessibilityHarness = try read(root, "Tests/RelayConsoleAccessibilityCaptureHarness/AccessibilityCaptureHarness.swift")
        let visualMetadata = try read(root, "evidence/visual-capture/run-003-code-003-001/visual-capture-metadata.json")
        let accessibilityMetadata = try read(root, "evidence/accessibility-capture/run-003-code-003-002/accessibility-metadata.json")
        let standardManifest = try read(root, "Tests/Fixtures/visual/all-surfaces/standard-minimum-window-matrix-001/manifest.md")
        let manualManifest = try read(root, "Tests/Fixtures/manual-evidence/visual/demo-08-all-surfaces-visual-a11y-001/manifest.md")
        let releaseManifest = try read(root, "Tests/Fixtures/manual-evidence/release/itc-0055-release-candidate-no-placeholder-001/manifest.md")

        let evidence = CaptureReadinessEvidence(
            artifactId: "run-004-code-004-001-app-capture-readiness",
            taskId: "CODE-004-001",
            generatedAt: "2026-06-23T00:00:00Z",
            readinessMode: "temporary-user-data-path-and-capture-preflight",
            temporaryUserDataEnvironmentKey: "RELAY_CONSOLE_USER_DATA_PATH",
            temporaryUserDataOverrideStatus: "implemented-and-smoke-tested",
            noPrivateLocalStateSupport: true,
            defaultApplicationSupportStateRead: false,
            appLaunchPathStatus: "temporary-user-data-path-supported",
            appExecutableTargetStatus: "RelayConsoleAppUI-importable-library-and-RelayConsoleApp-launcher",
            appWindowTargetStatus: "source-anchored-standard-1280x820-minimum-980x640",
            screenshotArtifactStatus: "not-captured",
            captureAttemptStatus: "not-attempted-by-this-audit",
            keyboardTraversalStatus: "not-captured",
            voiceOverHelpStatus: "not-captured",
            focusOrderStatus: "not-captured",
            contrastStatus: "not-measured",
            hostDesktopCaptureUsed: false,
            releaseProof: false,
            noProofStatement: "This audit proves only that a temporary no-private-state launch path exists for future app-targeted capture attempts; it does not emit screenshots, keyboard traversal, VoiceOver/help, focus, contrast, long-content, human-review, or release proof.",
            reviewedRubricRows: [
                "UVAM-004",
                "UVAM-005",
                "UVAM-006",
                "UVAM-010",
                "UVAM-011",
                "UVAM-012",
                "UVAM-014",
                "VAU-005",
                "VAU-014",
                "RNG-003",
                "RNG-008",
                "RHRV-012"
            ],
            sourceFilesReviewed: [
                "Package.swift",
                "Sources/RelayConsoleCore/RelayConsoleServices.swift",
                "Sources/RelayConsoleCore/AppPathsService.swift",
                "Sources/RelayConsoleApp/AppViewModel.swift",
                "Sources/RelayConsoleApp/AppEntryPoint.swift",
                "Sources/RelayConsoleAppLauncher/RelayConsoleApp.swift",
                "Tests/RelayConsoleCoreSmokeTests/SmokeTests.swift",
                "Tests/RelayConsoleVisualCaptureHarness/VisualCaptureHarness.swift",
                "Tests/RelayConsoleAccessibilityCaptureHarness/AccessibilityCaptureHarness.swift",
                "evidence/visual-capture/run-003-code-003-001/visual-capture-metadata.json",
                "evidence/accessibility-capture/run-003-code-003-002/accessibility-metadata.json",
                "Tests/Fixtures/visual/all-surfaces/standard-minimum-window-matrix-001/manifest.md",
                "Tests/Fixtures/manual-evidence/visual/demo-08-all-surfaces-visual-a11y-001/manifest.md",
                "Tests/Fixtures/manual-evidence/release/itc-0055-release-candidate-no-placeholder-001/manifest.md"
            ],
            sourceChecks: [
                SourceCheck(name: "package-target", passed: package.contains("RelayConsoleCaptureReadinessAudit")),
                SourceCheck(name: "importable-app-ui-target", passed: package.contains("RelayConsoleAppUI") && appEntryPoint.contains("RelayConsoleRootView")),
                SourceCheck(name: "temporary-user-data-key", passed: services.contains("RELAY_CONSOLE_USER_DATA_PATH")),
                SourceCheck(name: "environment-parameter", passed: services.contains("environment: [String: String] = ProcessInfo.processInfo.environment")),
                SourceCheck(name: "environment-resolver", passed: services.contains("userDataPathOverride(from: environment)")),
                SourceCheck(name: "blank-override-ignored", passed: services.contains("trimmingCharacters(in: .whitespacesAndNewlines)") && smokeTests.contains("blank environment override should be ignored")),
                SourceCheck(name: "default-application-support-unchanged", passed: appPaths.contains("Application Support") && appPaths.contains("Relay Console")),
                SourceCheck(name: "app-viewmodel-default-services", passed: appViewModel.contains("RelayConsoleServices(userDataPath: userDataPath)")),
                SourceCheck(name: "standard-window-size", passed: relayApp.contains(".defaultSize(width: 1280, height: 820)")),
                SourceCheck(name: "minimum-window-size", passed: relayApp.contains(".frame(minWidth: 980, minHeight: 640)")),
                SourceCheck(name: "run003-visual-non-proof", passed: visualHarness.contains("structured-metadata-not-screenshot") && visualMetadata.contains("\"screenshotArtifactStatus\" : \"not-captured\"")),
                SourceCheck(name: "run003-accessibility-non-proof", passed: accessibilityHarness.contains("structured-accessibility-metadata-not-assistive-session") && accessibilityMetadata.contains("\"keyboardTraversalStatus\" : \"not-captured\"")),
                SourceCheck(name: "run004-standard-manifest", passed: standardManifest.contains("run004CaptureReadinessTaskId: `CODE-004-001`")),
                SourceCheck(name: "run004-manual-manifest", passed: manualManifest.contains("run004CaptureReadinessTaskId: `CODE-004-001`")),
                SourceCheck(name: "run004-release-manifest", passed: releaseManifest.contains("run004CaptureReadinessTaskId: `CODE-004-001`"))
            ],
            blockedCapabilities: [
                "This audit does not launch the GUI app.",
                "This audit does not capture app-window PNG artifacts.",
                "This audit does not run keyboard traversal.",
                "This audit does not capture VoiceOver/help output.",
                "This audit does not capture focus order or focus visibility.",
                "This audit does not measure contrast ratios.",
                "This audit does not perform long-content rendered layout review.",
                "This audit does not verify release human review."
            ],
            nextRequiredEvidence: [
                "Launch Relay Console with RELAY_CONSOLE_USER_DATA_PATH pointing at a temporary redaction-safe root.",
                "Capture app-targeted standard and minimum-window artifacts without host desktop content.",
                "Record keyboard traversal, focus order, focus visibility, VoiceOver/help, contrast, and long-content reviewer notes.",
                "Attach reviewer identity, branch/commit/app-version, window size, surface, state, redaction, and disposition metadata.",
                "Rerun release aggregation only after reviewed artifacts exist."
            ]
        )

        try evidence.sourceChecks.forEach { check in
            guard check.passed else {
                throw AuditError("Source check failed: \(check.name)")
            }
        }

        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        let data = try encoder.encode(evidence)

        if let outputPath {
            let outputURL = outputURL(for: outputPath, root: root)
            try FileManager.default.createDirectory(
                at: outputURL.deletingLastPathComponent(),
                withIntermediateDirectories: true
            )
            try data.write(to: outputURL)
            print("wrote \(outputPath)")
        } else {
            FileHandle.standardOutput.write(data)
            print("")
        }
    }

    private static func outputPath(from arguments: [String]) -> String? {
        guard let index = arguments.firstIndex(of: "--output"),
              arguments.indices.contains(arguments.index(after: index)) else {
            return nil
        }
        return arguments[arguments.index(after: index)]
    }

    private static func outputURL(for path: String, root: URL) -> URL {
        if path.hasPrefix("/") {
            return URL(fileURLWithPath: path)
        }
        return root.appendingPathComponent(path)
    }

    private static func read(_ root: URL, _ path: String) throws -> String {
        try String(contentsOf: root.appendingPathComponent(path), encoding: .utf8)
    }
}

struct CaptureReadinessEvidence: Codable {
    var artifactId: String
    var taskId: String
    var generatedAt: String
    var readinessMode: String
    var temporaryUserDataEnvironmentKey: String
    var temporaryUserDataOverrideStatus: String
    var noPrivateLocalStateSupport: Bool
    var defaultApplicationSupportStateRead: Bool
    var appLaunchPathStatus: String
    var appExecutableTargetStatus: String
    var appWindowTargetStatus: String
    var screenshotArtifactStatus: String
    var captureAttemptStatus: String
    var keyboardTraversalStatus: String
    var voiceOverHelpStatus: String
    var focusOrderStatus: String
    var contrastStatus: String
    var hostDesktopCaptureUsed: Bool
    var releaseProof: Bool
    var noProofStatement: String
    var reviewedRubricRows: [String]
    var sourceFilesReviewed: [String]
    var sourceChecks: [SourceCheck]
    var blockedCapabilities: [String]
    var nextRequiredEvidence: [String]
}

struct SourceCheck: Codable {
    var name: String
    var passed: Bool
}

struct AuditError: Error, CustomStringConvertible {
    var description: String
    init(_ description: String) {
        self.description = description
    }
}
