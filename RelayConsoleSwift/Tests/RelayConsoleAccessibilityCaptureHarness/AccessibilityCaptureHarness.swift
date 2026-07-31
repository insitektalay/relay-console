import Foundation
import RelayConsoleSourceTestSupport

@main
struct RelayConsoleAccessibilityCaptureHarness {
    static func main() throws {
        let arguments = Array(CommandLine.arguments.dropFirst())
        let outputPath = outputPath(from: arguments)
        let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)

        let uiComponents = try read(root, "Sources/RelayConsoleApp/UIComponents.swift")
        let views = try read(root, "Sources/RelayConsoleApp/Views.swift")
        let app = try read(root, "Sources/RelayConsoleAppLauncher/RelayConsoleApp.swift")
        let appEntryPoint = try read(root, "Sources/RelayConsoleApp/AppEntryPoint.swift")
        let package = try read(root, "Package.swift")
        let disabledManifest = try read(root, "Tests/Fixtures/accessibility/core/disabled-focus-copy-feedback-001/manifest.md")
        let iconManifest = try read(root, "Tests/Fixtures/accessibility/core/icon-keyboard-voiceover-001/manifest.md")
        let visualHarnessManifest = try read(root, "Tests/Fixtures/visual/all-surfaces/redaction-safe-capture-harness-001/manifest.md")
        let visualMetadata = try read(root, "evidence/visual-capture/run-003-code-003-001/visual-capture-metadata.json")
        let uiRubric = try read(root, "agent-loop-clawchat-web-to-relayconsole-swift-prd/ui-visual-a11y-manual-evidence-review-rubric.md")
        let releaseRubric = try read(root, "agent-loop-clawchat-web-to-relayconsole-swift-prd/release-human-review-evidence-acceptance-rubric.md")
        let negativeDrills = try read(root, "agent-loop-clawchat-web-to-relayconsole-swift-prd/visual-a11y-unavailable-negative-drill-matrix.md")

        let sourceCorpus = uiComponents + views + app + appEntryPoint
        let evidence = AccessibilityCaptureEvidence(
            artifactId: "run-003-code-003-002-redaction-safe-accessibility-metadata",
            taskId: "CODE-003-002",
            generatedAt: "2026-06-23T00:00:00Z",
            captureMode: "structured-accessibility-metadata-not-assistive-session",
            sourceOnlyAnchorStatus: "source-anchored-review-scaffold",
            keyboardTraversalStatus: "not-captured",
            voiceOverHelpStatus: "not-captured",
            focusOrderStatus: "not-captured",
            focusVisibilityStatus: "not-captured",
            contrastStatus: "not-measured",
            releaseProof: false,
            noProofStatement: "This harness emits source-backed accessibility metadata only; it does not upgrade source labels, planned rows, or blocked/manual reviews to keyboard, VoiceOver, focus, contrast, or release proof.",
            privacyMode: "temporary-no-private-local-state",
            hostDesktopCaptureUsed: false,
            sourceFilesReviewed: [
                "Sources/RelayConsoleApp/UIComponents.swift",
                "Sources/RelayConsoleApp/Views.swift",
                "Sources/RelayConsoleAppLauncher/RelayConsoleApp.swift",
                "Sources/RelayConsoleApp/AppEntryPoint.swift",
                "Package.swift",
                "Tests/Fixtures/accessibility/core/disabled-focus-copy-feedback-001/manifest.md",
                "Tests/Fixtures/accessibility/core/icon-keyboard-voiceover-001/manifest.md",
                "Tests/Fixtures/visual/all-surfaces/redaction-safe-capture-harness-001/manifest.md",
                "evidence/visual-capture/run-003-code-003-001/visual-capture-metadata.json",
                "agent-loop-clawchat-web-to-relayconsole-swift-prd/ui-visual-a11y-manual-evidence-review-rubric.md",
                "agent-loop-clawchat-web-to-relayconsole-swift-prd/release-human-review-evidence-acceptance-rubric.md",
                "agent-loop-clawchat-web-to-relayconsole-swift-prd/visual-a11y-unavailable-negative-drill-matrix.md"
            ],
            reviewedRubricRows: [
                "UVAM-010",
                "UVAM-011",
                "UVAM-012",
                "VAU-007",
                "VAU-008",
                "VAU-009",
                "VAU-013",
                "RHRV-004",
                "RHRV-012"
            ],
            sourceAnchorCounts: SourceAnchorCounts(
                helpModifiers: count(".help(", in: sourceCorpus),
                accessibilityLabels: count(".accessibilityLabel(", in: sourceCorpus),
                accessibilityHints: count(".accessibilityHint(", in: sourceCorpus),
                keyboardShortcuts: count(".keyboardShortcut(", in: sourceCorpus),
                disabledModifiers: count(".disabled(", in: sourceCorpus),
                statusBadges: count("StatusBadge(", in: sourceCorpus)
            ),
            surfaces: accessibilitySurfaces(),
            sourceChecks: [
                SourceCheck(name: "package-target", passed: package.contains("RelayConsoleAccessibilityCaptureHarness")),
                SourceCheck(name: "visual-harness-dependency", passed: visualHarnessManifest.contains("CODE-003-001") && visualMetadata.contains("structured-metadata-not-screenshot")),
                SourceCheck(name: "disabled-manifest-blocked-manual", passed: disabledManifest.contains("run002FeasibilityStatus: `blocked/manual`")),
                SourceCheck(name: "icon-keyboard-manifest-non-proof", passed: iconManifest.contains("not a completed VoiceOver or keyboard review")),
                SourceCheck(name: "component-accessibility-matrix", passed: uiComponents.contains("RCAccessibilityEvidenceMatrix")),
                SourceCheck(name: "keyboard-shortcut-source", passed: app.contains(".keyboardShortcut(\"n\", modifiers: [.command])")),
                SourceCheck(name: "critical-label-source", passed: containsAll([
                    "Copy message",
                    "Cancel runtime dispatch",
                    "Retry runtime dispatch",
                    "Run runtime dispatch",
                    "Reject runtime dispatch",
                    "Runtime task list",
                    "Jump to bottom of message"
                ], in: views)),
                SourceCheck(name: "uvam-rubric-rows", passed: containsAll(["UVAM-010", "UVAM-011", "UVAM-012"], in: uiRubric)),
                SourceCheck(name: "vau-drill-rows", passed: containsAll(["VAU-007", "VAU-008", "VAU-009", "VAU-013"], in: negativeDrills)),
                SourceCheck(name: "rhrv-release-rows", passed: containsAll(["RHRV-004", "RHRV-012"], in: releaseRubric))
            ],
            blockedCapabilities: [
                "Keyboard traversal order is not captured by CODE-003-002.",
                "VoiceOver spoken output and role traversal are not captured by CODE-003-002.",
                "Focus order is not captured by CODE-003-002.",
                "Focus visibility is not captured by CODE-003-002.",
                "Contrast ratios are not measured by CODE-003-002.",
                "Copy feedback announcements are not assistive-session verified by CODE-003-002.",
                "Long-content assistive review is not captured by CODE-003-002."
            ],
            reviewerPrerequisites: [
                "Launch current-branch Relay Console with temporary no-private local state.",
                "Run keyboard-only traversal across retained surfaces and guarded states.",
                "Run VoiceOver/help-label review with reviewer setup and raw notes redacted.",
                "Record focus order, focus visibility, disabled reasons, copy feedback, and contrast findings.",
                "Link reviewed artifacts from Demo 8 and release-human-review manifests before any proof upgrade."
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

    private static func containsAll(_ needles: [String], in haystack: String) -> Bool {
        needles.allSatisfy { haystack.contains($0) }
    }

    private static func count(_ needle: String, in haystack: String) -> Int {
        guard !needle.isEmpty else { return 0 }
        var count = 0
        var searchRange = haystack.startIndex..<haystack.endIndex
        while let range = haystack.range(of: needle, options: [], range: searchRange) {
            count += 1
            searchRange = range.upperBound..<haystack.endIndex
        }
        return count
    }

    private static func accessibilitySurfaces() -> [AccessibilitySurfaceEvidence] {
        [
            AccessibilitySurfaceEvidence(
                key: "shell-navigation",
                surfaceFamily: "Shell/sidebar/navigation",
                sourceAnchors: ["ShellIconRail", "GuardedShellNotice", "RelayConsoleApp.commands"],
                sourceOnlyEvidence: ["Command-N shortcut", "section help text", "section accessibility labels", "guarded notice labels"],
                manualResiduals: ["keyboard traversal", "focus order", "focus visibility", "VoiceOver selected-state review", "contrast review"]
            ),
            AccessibilitySurfaceEvidence(
                key: "chats-thread-detail-composer",
                surfaceFamily: "Chats/thread list/detail/messages/composer",
                sourceAnchors: ["MessageComposer", "MessageBubble", "DispatchStatusView", "RuntimeActivityPanel", "RuntimeRunConfirmationControls", "MessageContentView"],
                sourceOnlyEvidence: ["send help and hint", "copy message labels", "runtime retry/cancel labels", "runtime Run/Reject labels", "runtime task-list labels", "long-message jump labels"],
                manualResiduals: ["composer focus return", "copy feedback announcement", "dispatch row traversal", "Run/Reject focus order", "long content assistive review", "contrast review"]
            ),
            AccessibilitySurfaceEvidence(
                key: "agents-org-work",
                surfaceFamily: "Agents/org/work dashboard",
                sourceAnchors: ["AgentsScreen", "AgentAvatarView", "AgentStructurePanel", "AgentTasksPanel"],
                sourceOnlyEvidence: ["avatar labels", "create/edit labels", "subview disabled reasons", "status badge labels"],
                manualResiduals: ["avatar picker traversal", "manager picker focus order", "task-state traversal", "long names", "contrast review"]
            ),
            AccessibilitySurfaceEvidence(
                key: "applications-runtime",
                surfaceFamily: "Applications marketplace",
                sourceAnchors: ["ApplicationsScreen", "ApplicationsCatalogPanel", "ApplicationsProviderConnectionPanel"],
                sourceOnlyEvidence: ["catalog search labels", "category labels", "app status labels", "provider action labels"],
                manualResiduals: ["catalog traversal", "read-only/member state review", "provider panel focus order", "secret-safe assistive review", "contrast review"]
            ),
            AccessibilitySurfaceEvidence(
                key: "settings-account-harnesses",
                surfaceFamily: "Settings account/harnesses",
                sourceAnchors: ["SettingsScreen", "AccountSettingsPanel", "HarnessesPanel"],
                sourceOnlyEvidence: ["save button labels", "avatar controls", "harness lifecycle labels", "auth labels"],
                manualResiduals: ["settings panel traversal", "avatar picker traversal", "harness auth flow review", "long names", "contrast review"]
            ),
            AccessibilitySurfaceEvidence(
                key: "agentops-native-scene",
                surfaceFamily: "AgentOps native visual scene",
                sourceAnchors: ["AgentOpsHQScreen", "AgentOpsVisualScene", "AgentOpsToggleButton", "AgentOpsRoomCard"],
                sourceOnlyEvidence: ["scene labels", "room labels", "entity labels", "refresh/toggle labels", "editable layout editor labels"],
                manualResiduals: ["visual scene traversal", "selected entity focus", "layout editor disabled controls", "VoiceOver grouping", "contrast review"]
            ),
            AccessibilitySurfaceEvidence(
                key: "work-safety-local-files-high-risk",
                surfaceFamily: "Retained local file and high-risk action states",
                sourceAnchors: ["NativeFilePermissionService", "ControlledActionService", "AgentTasksPanel"],
                sourceOnlyEvidence: ["permission labels", "blocked reason text", "approval-required labels", "audit-safe copy labels"],
                manualResiduals: ["approval-required traversal", "permission-needed focus order", "blocked-state VoiceOver review", "copy feedback", "contrast review"]
            )
        ]
    }
}

struct AccessibilityCaptureEvidence: Codable {
    var artifactId: String
    var taskId: String
    var generatedAt: String
    var captureMode: String
    var sourceOnlyAnchorStatus: String
    var keyboardTraversalStatus: String
    var voiceOverHelpStatus: String
    var focusOrderStatus: String
    var focusVisibilityStatus: String
    var contrastStatus: String
    var releaseProof: Bool
    var noProofStatement: String
    var privacyMode: String
    var hostDesktopCaptureUsed: Bool
    var sourceFilesReviewed: [String]
    var reviewedRubricRows: [String]
    var sourceAnchorCounts: SourceAnchorCounts
    var surfaces: [AccessibilitySurfaceEvidence]
    var sourceChecks: [SourceCheck]
    var blockedCapabilities: [String]
    var reviewerPrerequisites: [String]
}

struct SourceAnchorCounts: Codable {
    var helpModifiers: Int
    var accessibilityLabels: Int
    var accessibilityHints: Int
    var keyboardShortcuts: Int
    var disabledModifiers: Int
    var statusBadges: Int
}

struct AccessibilitySurfaceEvidence: Codable {
    var key: String
    var surfaceFamily: String
    var sourceAnchors: [String]
    var sourceOnlyEvidence: [String]
    var manualResiduals: [String]
    var keyboardStatus: String = "source-visible-not-traversed"
    var voiceOverStatus: String = "source-visible-not-captured"
    var focusStatus: String = "not-captured"
    var contrastStatus: String = "not-measured"
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
