import AppKit
import Foundation
import RelayConsoleAppUI
import RelayConsoleCore
import RelayConsoleSourceTestSupport
import SwiftUI

@main
struct RelayConsoleAppAccessibilityInventoryHarness {
    @MainActor
    static func main() async throws {
        let arguments = Array(CommandLine.arguments.dropFirst())
        let captureRetainedSurfaces = arguments.contains("--all-surfaces")
        let publicBetaLaunch = arguments.contains("--public-beta-launch")
        let outputPath = outputPath(from: arguments, captureRetainedSurfaces: captureRetainedSurfaces)
        let outputURL = URL(fileURLWithPath: outputPath)
        try FileManager.default.createDirectory(
            at: outputURL.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )

        let temporaryStateRoot = FileManager.default.temporaryDirectory
            .appendingPathComponent("relay-console-accessibility-inventory-\(UUID().uuidString)")
        try FileManager.default.createDirectory(
            at: temporaryStateRoot,
            withIntermediateDirectories: true
        )

        NSApplication.shared.setActivationPolicy(.prohibited)
        let controller = RelayConsoleAppController(userDataPath: temporaryStateRoot)
        await controller.waitForInitialLoad(timeoutSeconds: 6)
        await controller.captureCompleteTelemetryChoice()

        let surfaceInventories = captureRetainedSurfaces
            ? await retainedSurfaceInventories(controller: controller)
            : [
                await surfaceInventory(
                    surface: RetainedSurfaceAccessibilityRequest(id: "chat", label: "Chats", key: .chats),
                    navigationStatus: "default-selected",
                    controller: controller
                )
            ]
        let treeNodes = surfaceInventories.flatMap(\.sampledNodes)
        let sourceInventory = try sourceInventory()
        let totalNodeCount = surfaceInventories.reduce(0) { $0 + $1.nodeCount }
        let namedNodeCount = surfaceInventories.reduce(0) { $0 + $1.namedNodeCount }
        let inventoryStatus = treeNodes.isEmpty
            ? "source-anchored-view-hierarchy-empty"
            : captureRetainedSurfaces
                ? "retained-surface-source-and-view-hierarchy-inventory-captured"
                : "source-and-view-hierarchy-inventory-captured"

        let evidence = AppAccessibilityInventoryEvidence(
            artifactId: publicBetaLaunch
                ? "beta-001-018-current-retained-surface-accessibility-inventory"
                : captureRetainedSurfaces
                ? "run-006-code-006-003-retained-surface-accessibility-inventory"
                : "run-005-code-005-003-app-accessibility-inventory",
            taskId: publicBetaLaunch ? "BETA-001-018" : (captureRetainedSurfaces ? "CODE-006-003" : "CODE-005-003"),
            generatedAt: publicBetaLaunch ? "2026-07-11T00:00:00Z" : "2026-06-23T00:00:00Z",
            inventoryMode: "source-anchor-and-rendered-view-hierarchy-inventory-not-voiceover-session",
            privacyMode: "temporary-no-private-local-state",
            temporaryUserDataEnvironmentKey: "RELAY_CONSOLE_USER_DATA_PATH",
            defaultApplicationSupportStateRead: false,
            hostDesktopCaptureUsed: false,
            accessibilityInventoryStatus: inventoryStatus,
            retainedSurfaceInventoryStatus: captureRetainedSurfaces
                ? retainedSurfaceInventoryStatus(for: surfaceInventories)
                : "default-shell-only",
            retainedSurfaceCount: captureRetainedSurfaces ? retainedSurfaces().count : 1,
            appTreeNodeCount: totalNodeCount,
            namedAppTreeNodeCount: namedNodeCount,
            sourceHelpModifierCount: sourceInventory.helpModifierCount,
            sourceAccessibilityLabelCount: sourceInventory.accessibilityLabelCount,
            sourceKeyboardShortcutCount: sourceInventory.keyboardShortcutCount,
            keyboardTraversalStatus: "not-captured",
            voiceOverHelpStatus: "not-captured",
            focusOrderStatus: "not-captured",
            focusVisibilityStatus: "not-captured",
            contrastStatus: "not-measured",
            copyFeedbackStatus: "not-captured",
            longContentAssistiveStatus: "not-captured",
            humanReviewerStatus: "not-reviewed",
            releaseProof: false,
            noProofStatement: "This artifact is an app accessibility tree/source inventory only. It is not VoiceOver output, keyboard traversal, focus-order proof, contrast measurement, copy-feedback proof, long-content review, human review, or final release proof.",
            sampledNodes: Array(treeNodes.prefix(40)),
            surfaceInventories: captureRetainedSurfaces ? surfaceInventories : [],
            sourceFilesReviewed: sourceInventory.files
        )

        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        try encoder.encode(evidence).write(to: outputURL)
        print("wrote \(displayPath(for: outputURL))")
    }

    private static func outputPath(from arguments: [String], captureRetainedSurfaces: Bool) -> String {
        if let index = arguments.firstIndex(of: "--output"),
           arguments.indices.contains(index + 1) {
            return arguments[index + 1]
        }
        if captureRetainedSurfaces {
            return "evidence/accessibility-app-inventory/run-006-code-006-003/retained-surface-accessibility-inventory.json"
        }
        return "evidence/accessibility-app-inventory/run-005-code-005-003/accessibility-inventory.json"
    }

    @MainActor
    private static func retainedSurfaceInventories(
        controller: RelayConsoleAppController
    ) async -> [SurfaceAccessibilityInventory] {
        var inventories: [SurfaceAccessibilityInventory] = []
        for surface in retainedSurfaces() {
            let resolution = controller.selectShellSection(surface.key)
            if surface.id == "settings-security" {
                controller.selectSecuritySettings()
            }
            try? await Task.sleep(nanoseconds: 75_000_000)
            inventories.append(
                await surfaceInventory(
                    surface: surface,
                    navigationStatus: resolution.outcome.rawValue,
                    controller: controller
                )
            )
        }
        return inventories
    }

    @MainActor
    private static func surfaceInventory(
        surface: RetainedSurfaceAccessibilityRequest,
        navigationStatus: String,
        controller: RelayConsoleAppController
    ) async -> SurfaceAccessibilityInventory {
        let view = NSHostingView(
            rootView: RelayConsoleRootView(controller: controller)
                .frame(width: 1280, height: 820)
        )
        view.frame = NSRect(x: 0, y: 0, width: 1280, height: 820)
        view.wantsLayer = true
        let window = NSWindow(
            contentRect: view.frame,
            styleMask: [.borderless],
            backing: .buffered,
            defer: false
        )
        window.contentView = view
        window.layoutIfNeeded()
        view.layoutSubtreeIfNeeded()
        view.displayIfNeeded()

        let treeNodes = collectViewHierarchyNodes(from: view, depth: 0, limit: 240)
        return SurfaceAccessibilityInventory(
            surfaceId: surface.id,
            surfaceLabel: surface.label,
            shellSectionKey: surface.key.rawValue,
            navigationStatus: navigationStatus,
            status: treeNodes.isEmpty
                ? "source-anchored-view-hierarchy-empty"
                : "source-and-view-hierarchy-inventory-captured",
            nodeCount: treeNodes.count,
            namedNodeCount: treeNodes.filter { !$0.name.isEmpty }.count,
            sampledNodes: Array(treeNodes.prefix(12))
        )
    }

    private static func retainedSurfaceInventoryStatus(
        for inventories: [SurfaceAccessibilityInventory]
    ) -> String {
        guard inventories.count == retainedSurfaces().count else {
            return "blocked-or-partial-retained-surface-count"
        }
        return inventories.allSatisfy { $0.status == "source-and-view-hierarchy-inventory-captured" }
            ? "retained-surface-source-and-view-hierarchy-inventory-captured"
            : "blocked-or-partial-retained-surface-accessibility-inventory"
    }

    private static func retainedSurfaces() -> [RetainedSurfaceAccessibilityRequest] {
        [
            RetainedSurfaceAccessibilityRequest(id: "chat", label: "Chats", key: .chats),
            RetainedSurfaceAccessibilityRequest(id: "agents", label: "Agents", key: .agents),
            RetainedSurfaceAccessibilityRequest(id: "agentops", label: "AgentOps", key: .agentOpsHQ),
            RetainedSurfaceAccessibilityRequest(id: "applications", label: "Applications", key: .applications),
            RetainedSurfaceAccessibilityRequest(id: "insights", label: "Insights", key: .insights),
            RetainedSurfaceAccessibilityRequest(id: "settings", label: "Settings", key: .settings),
            RetainedSurfaceAccessibilityRequest(id: "settings-security", label: "Settings Security", key: .settings)
        ]
    }

    private static func collectViewHierarchyNodes(
        from view: NSView,
        depth: Int,
        limit: Int
    ) -> [AccessibilityNode] {
        guard limit > 0 else { return [] }
        let role = String(describing: type(of: view))
        let name = view.identifier?.rawValue ?? ""
        let help = ""
        var nodes: [AccessibilityNode] = []
        nodes.append(AccessibilityNode(role: role, name: name, help: help, depth: depth))

        var remaining = limit - nodes.count
        for child in view.subviews where remaining > 0 {
            let childNodes = collectViewHierarchyNodes(from: child, depth: depth + 1, limit: remaining)
            nodes.append(contentsOf: childNodes)
            remaining = limit - nodes.count
        }
        return nodes
    }

    private static func sourceInventory() throws -> SourceInventory {
        let filePaths = [
            "Sources/RelayConsoleApp/AppEntryPoint.swift",
            "Sources/RelayConsoleAppLauncher/RelayConsoleApp.swift",
            "Sources/RelayConsoleApp/RuntimeWorkspaceViews.swift",
            "Sources/RelayConsoleApp/UIComponents.swift"
        ]
        let contents = try filePaths.map { path in
            try String(contentsOf: URL(fileURLWithPath: path), encoding: .utf8)
        } + [RelayConsoleSourceTestSupport.viewSource(
            root: URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
        )]
        let inventoryPaths = filePaths + (try RelayConsoleSourceTestSupport.viewSourcePaths(
            root: URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
        ))
        let joined = contents.joined(separator: "\n")
        return SourceInventory(
            files: inventoryPaths,
            helpModifierCount: occurrenceCount(of: ".help(", in: joined),
            accessibilityLabelCount: occurrenceCount(of: ".accessibilityLabel(", in: joined),
            keyboardShortcutCount: occurrenceCount(of: ".keyboardShortcut(", in: joined)
        )
    }

    private static func occurrenceCount(of needle: String, in haystack: String) -> Int {
        haystack.components(separatedBy: needle).count - 1
    }

    private static func displayPath(for fileURL: URL) -> String {
        let currentDirectory = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
            .standardizedFileURL
        let standardizedFileURL = fileURL.standardizedFileURL
        let currentPath = currentDirectory.path.hasSuffix("/")
            ? currentDirectory.path
            : currentDirectory.path + "/"
        if standardizedFileURL.path.hasPrefix(currentPath) {
            return String(standardizedFileURL.path.dropFirst(currentPath.count))
        }
        return standardizedFileURL.lastPathComponent
    }
}

private struct AppAccessibilityInventoryEvidence: Codable {
    let artifactId: String
    let taskId: String
    let generatedAt: String
    let inventoryMode: String
    let privacyMode: String
    let temporaryUserDataEnvironmentKey: String
    let defaultApplicationSupportStateRead: Bool
    let hostDesktopCaptureUsed: Bool
    let accessibilityInventoryStatus: String
    let retainedSurfaceInventoryStatus: String
    let retainedSurfaceCount: Int
    let appTreeNodeCount: Int
    let namedAppTreeNodeCount: Int
    let sourceHelpModifierCount: Int
    let sourceAccessibilityLabelCount: Int
    let sourceKeyboardShortcutCount: Int
    let keyboardTraversalStatus: String
    let voiceOverHelpStatus: String
    let focusOrderStatus: String
    let focusVisibilityStatus: String
    let contrastStatus: String
    let copyFeedbackStatus: String
    let longContentAssistiveStatus: String
    let humanReviewerStatus: String
    let releaseProof: Bool
    let noProofStatement: String
    let sampledNodes: [AccessibilityNode]
    let surfaceInventories: [SurfaceAccessibilityInventory]
    let sourceFilesReviewed: [String]
}

private struct AccessibilityNode: Codable {
    let role: String
    let name: String
    let help: String
    let depth: Int
}

private struct SourceInventory {
    let files: [String]
    let helpModifierCount: Int
    let accessibilityLabelCount: Int
    let keyboardShortcutCount: Int
}

private struct RetainedSurfaceAccessibilityRequest {
    let id: String
    let label: String
    let key: ShellSectionKey
}

private struct SurfaceAccessibilityInventory: Codable {
    let surfaceId: String
    let surfaceLabel: String
    let shellSectionKey: String
    let navigationStatus: String
    let status: String
    let nodeCount: Int
    let namedNodeCount: Int
    let sampledNodes: [AccessibilityNode]
}
