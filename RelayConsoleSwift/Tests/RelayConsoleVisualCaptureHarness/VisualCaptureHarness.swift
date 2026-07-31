import Foundation
import RelayConsoleSourceTestSupport

@main
struct RelayConsoleVisualCaptureHarness {
    static func main() throws {
        let arguments = Array(CommandLine.arguments.dropFirst())
        let outputPath = outputPath(from: arguments)
        let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)

        let uiComponents = try read(root, "Sources/RelayConsoleApp/UIComponents.swift")
        let views = try read(root, "Sources/RelayConsoleApp/Views.swift")
        let package = try read(root, "Package.swift")
        let standardManifest = try read(root, "Tests/Fixtures/visual/all-surfaces/standard-minimum-window-matrix-001/manifest.md")
        let manualManifest = try read(root, "Tests/Fixtures/manual-evidence/visual/demo-08-all-surfaces-visual-a11y-001/manifest.md")

        let evidence = VisualCaptureEvidence(
            artifactId: "run-003-code-003-001-redaction-safe-visual-metadata",
            taskId: "CODE-003-001",
            generatedAt: "2026-06-23T00:00:00Z",
            captureMode: "structured-metadata-not-screenshot",
            screenshotArtifactStatus: "not-captured",
            releaseProof: false,
            noProofStatement: "This harness emits app-targeted structured metadata only; it does not upgrade planned, blocked/manual, or unreviewed evidence to release proof.",
            privacyMode: "temporary-no-private-local-state",
            hostDesktopCaptureUsed: false,
            sourceFilesReviewed: [
                "Sources/RelayConsoleApp/UIComponents.swift",
                "Sources/RelayConsoleApp/Views.swift",
                "Package.swift",
                "Tests/Fixtures/visual/all-surfaces/standard-minimum-window-matrix-001/manifest.md",
                "Tests/Fixtures/manual-evidence/visual/demo-08-all-surfaces-visual-a11y-001/manifest.md"
            ],
            windows: [
                VisualCaptureWindow(id: "standardWindow", width: 1280, height: 820, sourceAnchor: "RCComponentBaseline.standardWindowSize"),
                VisualCaptureWindow(id: "minimumWindow", width: 980, height: 640, sourceAnchor: "RCComponentBaseline.minimumWindowSize")
            ],
            surfaces: retainedSurfaces(),
            sourceChecks: [
                SourceCheck(name: "package-target", passed: package.contains("RelayConsoleVisualCaptureHarness")),
                SourceCheck(name: "standard-window-constant", passed: uiComponents.contains("standardWindowSize = CGSize(width: 1280, height: 820)")),
                SourceCheck(name: "minimum-window-constant", passed: uiComponents.contains("minimumWindowSize = CGSize(width: 980, height: 640)")),
                SourceCheck(name: "content-root", passed: views.contains("struct ContentView")),
                SourceCheck(
                    name: "standard-manifest-run003",
                    passed: standardManifest.contains("run003VisualHarnessStatus: `structured-metadata-not-screenshot`")
                        && standardManifest.contains("run005AppWindowSnapshotStatus: `captured-standard-and-minimum`")
                ),
                SourceCheck(name: "manual-manifest-run003", passed: manualManifest.contains("run002FeasibilityStatus: `blocked/manual`"))
            ],
            blockedCapabilities: [
                "PNG screenshots are not emitted by CODE-003-001.",
                "Keyboard traversal is not emitted by CODE-003-001.",
                "VoiceOver/help output is not emitted by CODE-003-001.",
                "Focus order and focus visibility are not emitted by CODE-003-001.",
                "Contrast measurements are not emitted by CODE-003-001.",
                "Long-content rendered layout review is not emitted by CODE-003-001."
            ],
            nextRequiredEvidence: [
                "App-targeted screenshot renderer or reviewed structured visual notes for each retained surface.",
                "Keyboard traversal and focus-order capture or manual reviewer notes.",
                "VoiceOver/help-label review with reviewer setup.",
                "Contrast and long-content review.",
                "Release-human-review manifest before any final release proof claim."
            ]
        )

        try evidence.sourceChecks.forEach { check in
            guard check.passed else {
                throw HarnessError("Source check failed: \(check.name)")
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
        try RelayConsoleSourceTestSupport.read(root: root, path: path)
    }

    private static func retainedSurfaces() -> [VisualCaptureSurface] {
        [
            VisualCaptureSurface(id: "shell", title: "Shell/sidebar/navigation", navKey: "chat", sourceAnchors: ["ContentView", "ShellIconRail", "Sidebar"]),
            VisualCaptureSurface(id: "chat", title: "Chats/thread list/detail/messages/composer", navKey: "chat", sourceAnchors: ["ConversationPanel", "ChatScreen", "MessageComposer"]),
            VisualCaptureSurface(id: "agents", title: "Agents/org/work dashboard", navKey: "agents", sourceAnchors: ["AgentsScreen", "AgentStructurePanel", "AgentCategoryPanel"]),
            VisualCaptureSurface(id: "applications", title: "Applications marketplace", navKey: "applications", sourceAnchors: ["ApplicationsScreen", "ApplicationsCatalogPanel", "ApplicationsProviderConnectionPanel"]),
            VisualCaptureSurface(id: "settings", title: "Settings account/harnesses", navKey: "settings", sourceAnchors: ["SettingsScreen", "AccountSettingsPanel", "HarnessesPanel"]),
            VisualCaptureSurface(id: "work-safety", title: "Retained local file and high-risk action states", navKey: "agents", sourceAnchors: ["AgentTasksPanel", "NativeFilePermissionService", "ControlledActionService"])
        ]
    }
}

struct VisualCaptureEvidence: Codable {
    var artifactId: String
    var taskId: String
    var generatedAt: String
    var captureMode: String
    var screenshotArtifactStatus: String
    var releaseProof: Bool
    var noProofStatement: String
    var privacyMode: String
    var hostDesktopCaptureUsed: Bool
    var sourceFilesReviewed: [String]
    var windows: [VisualCaptureWindow]
    var surfaces: [VisualCaptureSurface]
    var sourceChecks: [SourceCheck]
    var blockedCapabilities: [String]
    var nextRequiredEvidence: [String]
}

struct VisualCaptureWindow: Codable {
    var id: String
    var width: Int
    var height: Int
    var sourceAnchor: String
}

struct VisualCaptureSurface: Codable {
    var id: String
    var title: String
    var navKey: String
    var sourceAnchors: [String]
    var artifactStatus: String = "structured-metadata-only"
    var screenshotStatus: String = "not-captured"
    var redactionStatus: String = "no-private-local-state-read"
}

struct SourceCheck: Codable {
    var name: String
    var passed: Bool
}

struct HarnessError: Error, CustomStringConvertible {
    var description: String
    init(_ description: String) {
        self.description = description
    }
}
