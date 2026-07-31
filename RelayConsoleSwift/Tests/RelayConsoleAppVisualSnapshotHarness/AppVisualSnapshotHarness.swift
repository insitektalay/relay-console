import AppKit
import Foundation
import RelayConsoleCore
import RelayConsoleAppUI
import SwiftUI

@main
struct RelayConsoleAppVisualSnapshotHarness {
    @MainActor
    static func main() async throws {
        let arguments = Array(CommandLine.arguments.dropFirst())
        let outputDirectory = outputDirectory(from: arguments)
        let captureRetainedSurfaces = arguments.contains("--all-surfaces")
        let captureDeepSurfaces = arguments.contains("--deep-surfaces")
        let publicBetaLaunch = arguments.contains("--public-beta-launch")
        let captureRuntimeActivityScenario = arguments.contains("--runtime-activity-scenario")
        let captureTelemetryOnboarding = arguments.contains("--telemetry-onboarding")
        try FileManager.default.createDirectory(
            at: outputDirectory,
            withIntermediateDirectories: true
        )

        let temporaryStateRoot = FileManager.default.temporaryDirectory
            .appendingPathComponent("relay-console-app-snapshot-\(UUID().uuidString)")
        try FileManager.default.createDirectory(
            at: temporaryStateRoot,
            withIntermediateDirectories: true
        )

        if captureDeepSurfaces || captureRuntimeActivityScenario {
            try seedRuntimeActivityScenario(at: temporaryStateRoot)
        }

        NSApplication.shared.setActivationPolicy(.prohibited)
        let controller = RelayConsoleAppController(userDataPath: temporaryStateRoot)
        await controller.waitForInitialLoad(timeoutSeconds: 6)
        controller.prepareForVisualCapture()
        if !captureTelemetryOnboarding {
            await controller.captureCompleteTelemetryChoice()
        }

        let snapshots: [SnapshotArtifact]
        if captureDeepSurfaces {
            snapshots = try await renderDeepSurfaceSnapshots(controller: controller, outputDirectory: outputDirectory)
        } else if captureRuntimeActivityScenario {
            snapshots = try await renderRuntimeActivityScenarioSnapshots(controller: controller, outputDirectory: outputDirectory)
        } else if captureRetainedSurfaces {
            snapshots = try await renderRetainedSurfaceSnapshots(controller: controller, outputDirectory: outputDirectory)
        } else {
            snapshots = try await renderDefaultSnapshots(controller: controller, outputDirectory: outputDirectory)
        }

        let capturedCount = snapshots.filter { $0.status == "captured-app-window-png" }.count
        let standardSnapshots = snapshots.filter { $0.sizeKind == "standard" }
        let minimumSnapshots = snapshots.filter { $0.sizeKind == "minimum" }
        let standardStatus = aggregateStatus(for: standardSnapshots)
        let minimumStatus = aggregateStatus(for: minimumSnapshots)
        let evidence = AppWindowVisualSnapshotEvidence(
            artifactId: captureDeepSurfaces
                ? "visual-audit-exhaustive-swift-pages"
                : publicBetaLaunch
                ? "beta-001-018-current-retained-surface-visual-snapshots"
                : captureRuntimeActivityScenario
                ? "hre-002-004-runtime-activity-panel-visual-snapshots"
                : captureRetainedSurfaces
                ? "run-006-code-006-001-retained-surface-visual-snapshots"
                : "run-005-code-005-001-app-window-visual-snapshots",
            taskId: captureDeepSurfaces ? "VISUAL-AUDIT" : (publicBetaLaunch ? "BETA-001-018" : (captureRuntimeActivityScenario ? "HRE-002-004" : (captureRetainedSurfaces ? "CODE-006-001" : "CODE-005-001"))),
            generatedAt: captureDeepSurfaces ? ISO8601DateFormatter().string(from: Date()) : (publicBetaLaunch ? "2026-07-11T00:00:00Z" : (captureRuntimeActivityScenario ? "2026-06-26T00:00:00Z" : "2026-06-23T00:00:00Z")),
            captureMode: captureDeepSurfaces ? "offscreen-exhaustive-page-render" : (captureRuntimeActivityScenario ? "offscreen-app-window-render-runtime-activity-scenario" : "offscreen-app-window-render"),
            privacyMode: "temporary-no-private-local-state",
            temporaryUserDataEnvironmentKey: "RELAY_CONSOLE_USER_DATA_PATH",
            defaultApplicationSupportStateRead: false,
            hostDesktopCaptureUsed: false,
            sourceTargetStatus: "RelayConsoleAppUI-importable-root-view",
            controllerLoadingStatus: controller.isLoading ? "still-loading-after-timeout" : "loaded-or-error",
            controllerErrorStatus: controller.errorDescription == nil ? "none" : "present-redacted",
            screenshotArtifactStatus: capturedCount == snapshots.count ? (captureDeepSurfaces ? "captured-exhaustive-page-catalog" : "captured-standard-and-minimum") : "blocked-or-partial",
            runtimeActivityScenarioStatus: captureRuntimeActivityScenario
                ? "seeded-temporary-redaction-safe-runtime-ui-state"
                : "not-requested",
            retainedSurfaceCaptureStatus: captureDeepSurfaces
                ? (capturedCount == snapshots.count ? "captured-exhaustive-page-catalog" : "blocked-or-partial-exhaustive-page-catalog")
                : captureRetainedSurfaces
                ? retainedSurfaceCaptureStatus(for: snapshots)
                : "default-shell-only",
            retainedSurfaceCount: captureDeepSurfaces ? controller.capturePageCatalog.count : (captureRetainedSurfaces ? retainedSurfaces().count : 1),
            capturedSnapshotCount: capturedCount,
            standardWindowStatus: standardStatus,
            minimumWindowStatus: minimumStatus,
            keyboardTraversalStatus: "not-captured",
            voiceOverHelpStatus: "not-captured",
            focusOrderStatus: "not-captured",
            contrastStatus: "not-measured",
            longContentReviewStatus: "not-reviewed",
            humanReviewerStatus: "not-reviewed",
            releaseProof: false,
            noProofStatement: captureDeepSurfaces
                ? "These are redaction-safe exhaustive page-catalog captures from temporary state. Dynamic data permutations, platform-owned menus, keyboard traversal, VoiceOver/help, focus, contrast, and human review remain separate evidence."
                : captureRuntimeActivityScenario
                ? "These are branch-local app-window PNG artifacts from a temporary seeded runtime UI state. They are not real runtime transcript proof and do not include keyboard traversal, VoiceOver/help, focus, contrast, long-content, human-review, or final release proof."
                : "These are branch-local app-window PNG artifacts only. They do not include keyboard traversal, VoiceOver/help, focus, contrast, long-content, human-review, or final release proof.",
            snapshots: snapshots
        )

        let metadataName = captureDeepSurfaces
            ? "deep-surface-visual-snapshots.json"
            : captureRetainedSurfaces
            ? "retained-surface-visual-snapshots.json"
            : captureRuntimeActivityScenario
            ? "runtime-activity-visual-snapshots.json"
            : "app-window-visual-snapshots.json"
        let jsonURL = outputDirectory.appendingPathComponent(metadataName)
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        try encoder.encode(evidence).write(to: jsonURL)
        print("wrote \(displayPath(for: jsonURL))")
    }

    private static func outputDirectory(from arguments: [String]) -> URL {
        if let index = arguments.firstIndex(of: "--output-dir"),
           arguments.indices.contains(index + 1) {
            return URL(fileURLWithPath: arguments[index + 1])
        }
        if arguments.contains("--runtime-activity-scenario") {
            return URL(fileURLWithPath: "agent-loop-hermes-runtime-experience/loop-runs/002-runtime-confirmation-visual-hardening/evidence/HRE-002-004-runtime-activity-snapshot")
        }
        return URL(fileURLWithPath: "evidence/visual-app-window/run-005-code-005-001")
    }

    @MainActor
    private static func renderDefaultSnapshots(
        controller: RelayConsoleAppController,
        outputDirectory: URL
    ) async throws -> [SnapshotArtifact] {
        [
            try renderSnapshot(
                id: "standard-window",
                size: SnapshotSize(width: 1280, height: 820),
                surface: RetainedSurfaceSnapshotRequest(id: "chat", label: "Chats", key: .chats),
                sizeKind: "standard",
                navigationStatus: "default-selected",
                controller: controller,
                outputDirectory: outputDirectory
            ),
            try renderSnapshot(
                id: "minimum-window",
                size: SnapshotSize(width: 980, height: 640),
                surface: RetainedSurfaceSnapshotRequest(id: "chat", label: "Chats", key: .chats),
                sizeKind: "minimum",
                navigationStatus: "default-selected",
                controller: controller,
                outputDirectory: outputDirectory
            )
        ]
    }

    @MainActor
    private static func renderRuntimeActivityScenarioSnapshots(
        controller: RelayConsoleAppController,
        outputDirectory: URL
    ) async throws -> [SnapshotArtifact] {
        let resolution = controller.selectShellSection(.chats)
        try? await Task.sleep(nanoseconds: 150_000_000)
        return [
            try renderSnapshot(
                id: "runtime-activity-standard-window",
                size: SnapshotSize(width: 1280, height: 820),
                surface: RetainedSurfaceSnapshotRequest(id: "chat-runtime-activity", label: "Chats runtime activity", key: .chats),
                sizeKind: "standard",
                navigationStatus: resolution.outcome.rawValue,
                controller: controller,
                outputDirectory: outputDirectory
            ),
            try renderSnapshot(
                id: "runtime-activity-minimum-window",
                size: SnapshotSize(width: 980, height: 640),
                surface: RetainedSurfaceSnapshotRequest(id: "chat-runtime-activity", label: "Chats runtime activity", key: .chats),
                sizeKind: "minimum",
                navigationStatus: resolution.outcome.rawValue,
                controller: controller,
                outputDirectory: outputDirectory
            )
        ]
    }

    @MainActor
    private static func renderRetainedSurfaceSnapshots(
        controller: RelayConsoleAppController,
        outputDirectory: URL
    ) async throws -> [SnapshotArtifact] {
        var snapshots: [SnapshotArtifact] = []
        for surface in retainedSurfaces() {
            let resolution = controller.selectShellSection(surface.key)
            if surface.id == "settings-security" {
                controller.selectSecuritySettings()
            }
            try? await Task.sleep(nanoseconds: 75_000_000)
            for request in [
                (kind: "standard", size: SnapshotSize(width: 1280, height: 820)),
                (kind: "minimum", size: SnapshotSize(width: 980, height: 640))
            ] {
                snapshots.append(
                    try renderSnapshot(
                        id: "\(surface.id)-\(request.kind)-window",
                        size: request.size,
                        surface: surface,
                        sizeKind: request.kind,
                        navigationStatus: resolution.outcome.rawValue,
                        controller: controller,
                        outputDirectory: outputDirectory
                    )
                )
            }
        }
        return snapshots
    }

    @MainActor
    private static func renderDeepSurfaceSnapshots(
        controller: RelayConsoleAppController,
        outputDirectory: URL
    ) async throws -> [SnapshotArtifact] {
        var snapshots: [SnapshotArtifact] = []

        for page in controller.capturePageCatalog {
            let prepared = await controller.prepareCapturePage(page.id)
            let status = prepared ? "prepared" : "fixture-unavailable"
            snapshots.append(
                try renderSnapshot(
                    id: page.id,
                    size: SnapshotSize(width: 1280, height: 820),
                    surface: RetainedSurfaceSnapshotRequest(id: page.id, label: page.label, key: page.section),
                    sizeKind: "standard",
                    navigationStatus: status,
                    controller: controller,
                    outputDirectory: outputDirectory
                )
            )
        }

        return snapshots
    }

    @MainActor
    private static func renderSnapshot(
        id: String,
        size: SnapshotSize,
        surface: RetainedSurfaceSnapshotRequest,
        sizeKind: String,
        navigationStatus: String,
        controller: RelayConsoleAppController,
        outputDirectory: URL
    ) throws -> SnapshotArtifact {
        controller.prepareForVisualCapture()
        let view = NSHostingView(
            rootView: RelayConsoleRootView(controller: controller)
                .frame(width: CGFloat(size.width), height: CGFloat(size.height))
        )
        view.frame = NSRect(x: 0, y: 0, width: size.width, height: size.height)
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

        guard let bitmap = view.bitmapImageRepForCachingDisplay(in: view.bounds) else {
            return SnapshotArtifact(
                id: id,
                file: "",
                width: size.width,
                height: size.height,
                surfaceId: surface.id,
                surfaceLabel: surface.label,
                shellSectionKey: surface.key.rawValue,
                sizeKind: sizeKind,
                navigationStatus: navigationStatus,
                pngByteCount: 0,
                sampledDistinctColorCount: 0,
                status: "blocked-no-bitmap-representation"
            )
        }
        view.cacheDisplay(in: view.bounds, to: bitmap)

        guard let data = bitmap.representation(using: NSBitmapImageRep.FileType.png, properties: [:]) else {
            return SnapshotArtifact(
                id: id,
                file: "",
                width: size.width,
                height: size.height,
                surfaceId: surface.id,
                surfaceLabel: surface.label,
                shellSectionKey: surface.key.rawValue,
                sizeKind: sizeKind,
                navigationStatus: navigationStatus,
                pngByteCount: 0,
                sampledDistinctColorCount: 0,
                status: "blocked-no-png-representation"
            )
        }

        let fileURL = outputDirectory.appendingPathComponent("\(id).png")
        try data.write(to: fileURL)
        let distinctColorCount = sampledDistinctColorCount(in: bitmap)
        let status = data.count > 2_048 && distinctColorCount > 1
            ? "captured-app-window-png"
            : "blocked-blank-or-low-information-render"
        return SnapshotArtifact(
            id: id,
            file: displayPath(for: fileURL),
            width: size.width,
            height: size.height,
            surfaceId: surface.id,
            surfaceLabel: surface.label,
            shellSectionKey: surface.key.rawValue,
            sizeKind: sizeKind,
            navigationStatus: navigationStatus,
            pngByteCount: data.count,
            sampledDistinctColorCount: distinctColorCount,
            status: status
        )
    }

    private static func aggregateStatus(for snapshots: [SnapshotArtifact]) -> String {
        guard !snapshots.isEmpty else { return "not-requested" }
        return snapshots.allSatisfy { $0.status == "captured-app-window-png" }
            ? "captured-app-window-png"
            : "blocked-or-partial"
    }

    private static func retainedSurfaceCaptureStatus(for snapshots: [SnapshotArtifact]) -> String {
        let expectedCount = retainedSurfaces().count * 2
        guard snapshots.count == expectedCount else { return "blocked-or-partial-retained-surface-count" }
        return snapshots.allSatisfy { $0.status == "captured-app-window-png" }
            ? "captured-retained-top-level-surfaces-standard-and-minimum"
            : "blocked-or-partial-retained-surface-capture"
    }

    private static func retainedSurfaces() -> [RetainedSurfaceSnapshotRequest] {
        [
            RetainedSurfaceSnapshotRequest(id: "chat", label: "Chats", key: .chats),
            RetainedSurfaceSnapshotRequest(id: "agents", label: "Agents", key: .agents),
            RetainedSurfaceSnapshotRequest(id: "artifacts", label: "Artifacts", key: .artifacts),
            RetainedSurfaceSnapshotRequest(id: "applications", label: "Applications", key: .applications),
            RetainedSurfaceSnapshotRequest(id: "approvals", label: "Approvals", key: .approvals),
            RetainedSurfaceSnapshotRequest(id: "settings", label: "Settings", key: .settings),
            RetainedSurfaceSnapshotRequest(id: "settings-security", label: "Settings Security", key: .settings)
        ]
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

    private static func sampledDistinctColorCount(in bitmap: NSBitmapImageRep) -> Int {
        var colors = Set<String>()
        let xStride = max(1, bitmap.pixelsWide / 12)
        let yStride = max(1, bitmap.pixelsHigh / 12)
        var y = 0
        while y < bitmap.pixelsHigh {
            var x = 0
            while x < bitmap.pixelsWide {
                if let color = bitmap.colorAt(x: x, y: y)?.usingColorSpace(.deviceRGB) {
                    let key = [
                        Int((color.redComponent * 255).rounded()),
                        Int((color.greenComponent * 255).rounded()),
                        Int((color.blueComponent * 255).rounded()),
                        Int((color.alphaComponent * 255).rounded())
                    ]
                    .map(String.init)
                    .joined(separator: "-")
                    colors.insert(key)
                }
                x += xStride
            }
            y += yStride
        }
        return colors.count
    }

    private static func seedRuntimeActivityScenario(at userDataPath: URL) throws {
        let services = try RelayConsoleServices(
            userDataPath: userDataPath,
            secretStore: MemorySecretStore(),
            refreshInstalledHarnessesOnLaunch: false,
            startRuntimeBrokerServer: false
        )
        defer { services.database.close() }

        let appState = try services.data.getAppState()
        guard let workspace = appState.activeWorkspace else {
            throw HarnessSeedError("Missing default workspace for runtime activity snapshot seed.")
        }
        try services.data.setAppSetting(
            RuntimeExperienceSettings.detailedActivityEnabledKey,
            value: true
        )
        try services.data.setAppSetting(
            RuntimeExperienceSettings.runConfirmationEnabledKey,
            value: true
        )
        let installPath = services.paths.harnessesDir.appendingPathComponent("hermes-agent", isDirectory: true)
        try FileManager.default.createDirectory(at: installPath, withIntermediateDirectories: true)
        try "visual evidence harness placeholder".write(
            to: installPath.appendingPathComponent("run_agent.py"),
            atomically: true,
            encoding: .utf8
        )
        let harness = try services.data.upsertHarness(
            runtimeType: .hermes,
            displayName: "Hermes Agent",
            mode: .appManaged,
            config: [
                "kind": .string("external_harness_install"),
                "harnessKey": .string(HarnessKey.hermes.rawValue),
                "source": .string(HarnessInstallSource.managed.rawValue),
                "lifecycleState": .string(HarnessLifecycleState.connected.rawValue),
                "dependencyStatus": .string("installed"),
                "modelAuthStatus": .string(HarnessModelAuthStatus.connected.rawValue),
                "modelAuthProvider": .string("openai_chatgpt"),
                "installPath": .string(installPath.path),
                "lastCheckedAt": .string("2026-06-26T12:00:00Z")
            ]
        )
        let agent = try services.data.createAgent(
            workspaceId: workspace.id,
            name: "Hermes Runtime Preview",
            description: "Temporary visual evidence agent",
            harnessId: harness.id,
            externalAgentId: "visual-evidence-hermes",
            hermesProfileSlug: "visual-evidence-hermes"
        )
        let thread = try services.data.createThread(
            workspaceId: workspace.id,
            title: "Runtime Activity Preview",
            selectedAgentId: agent.id,
            threadType: .direct
        )
        let message = try services.data.createMessage(
            threadId: thread.id,
            senderType: .user,
            senderName: "You",
            content: "Redesign Email Command Center into a dashboard."
        )
        let teamThread = try services.data.createThread(
            workspaceId: workspace.id,
            title: "Weekly Operations Team",
            selectedAgentId: agent.id,
            threadType: .team
        )
        _ = try services.data.createMessage(
            threadId: teamThread.id,
            senderType: .agent,
            senderId: agent.id,
            senderName: agent.name,
            content: "The redaction-safe team status is ready for review."
        )
        let captureTask = try services.data.createAgentTask(
            workspaceId: workspace.id,
            title: "Prepare weekly operating review",
            message: "Summarise completed work, blockers, and next actions for the weekly operating review.",
            assignedAgentId: agent.id,
            targetAgentId: agent.id,
            priority: .high,
            targetType: .direct,
            status: .queued,
            requiresApproval: false,
            scheduledAt: "2026-07-14T09:00:00Z",
            timeZone: "Europe/London",
            recurrence: "Weekly",
            threadId: thread.id,
            metadata: ["source": .string("redaction-safe-visual-capture")]
        )
        _ = try services.data.createAgentTaskRun(
            workspaceId: workspace.id,
            taskId: captureTask.id,
            agentId: agent.id,
            status: .completed,
            tokensUsed: 1240,
            startedAt: "2026-07-07T09:00:00Z",
            completedAt: "2026-07-07T09:05:00Z",
            metadata: ["source": .string("redaction-safe-visual-capture")]
        )
        let session = try services.data.createRuntimeSession(
            threadId: thread.id,
            agentId: agent.id,
            runtimeBindingId: agent.binding.id
        )
        let inputSnapshot = runtimeConfirmationSnapshot(
            inputContent: message.content,
            title: "Generate redesigned dashboard-style markdown preserving useful information",
            summary: "Waiting for Run confirmation before the runtime starts."
        )
        let dispatch = try services.data.createDispatch(
            threadId: thread.id,
            messageId: message.id,
            agentId: agent.id,
            harnessId: harness.id,
            sessionId: session.id,
            correlationId: "corr-runtime-activity-visual-evidence",
            inputSnapshot: inputSnapshot
        )
        var resultSnapshot = inputSnapshot
        resultSnapshot["runtimeStatusMessage"] = .string("Waiting for Run confirmation")
        for event in runtimeActivityScenarioEvents(dispatchId: dispatch.id) {
            resultSnapshot = RuntimeActivityProjector.snapshot(resultSnapshot, applying: event)
        }
        _ = try services.data.updateDispatch(
            dispatchId: dispatch.id,
            status: .queued,
            resultSnapshot: resultSnapshot
        )
    }

    private static func runtimeConfirmationSnapshot(
        inputContent: String,
        title: String,
        summary: String
    ) -> JSONRecord {
        [
            "runtimeType": .string(RuntimeType.hermes.rawValue),
            "inputContent": .string(inputContent),
            RuntimeRunConfirmationSnapshot.requiredKey: .bool(true),
            RuntimeRunConfirmationSnapshot.stateKey: .string(RuntimeRunConfirmationState.pending.rawValue),
            RuntimeRunConfirmationSnapshot.titleKey: .string(title),
            RuntimeRunConfirmationSnapshot.summaryKey: .string(summary),
            RuntimeRunConfirmationSnapshot.requestedAtKey: .string("2026-06-26T12:00:00Z")
        ]
    }

    private static func runtimeActivityScenarioEvents(dispatchId: RelayId) -> [RuntimeActivityProjectionEvent] {
        let timestamp = "2026-06-26T12:00:00Z"
        return [
            RuntimeActivityProjectionEvent(
                id: "evt-runtime-activity-queued",
                dispatchId: dispatchId,
                type: .queued,
                text: nil,
                status: "Waiting for Run confirmation",
                detail: ["gatewayEventType": .string("run.confirmation.pending")],
                timestamp: timestamp
            ),
            RuntimeActivityProjectionEvent(
                id: "evt-runtime-activity-status",
                dispatchId: dispatchId,
                type: .status,
                text: "Run confirmation needed",
                status: "Waiting for Run confirmation",
                detail: ["gatewayEventType": .string("status.update")],
                timestamp: timestamp
            ),
            RuntimeActivityProjectionEvent(
                id: "evt-runtime-activity-thinking",
                dispatchId: dispatchId,
                type: .thinking,
                text: "Plan dashboard sections and preserve useful information.",
                status: "Thinking",
                detail: ["gatewayEventType": .string("thinking.delta")],
                timestamp: timestamp
            ),
            RuntimeActivityProjectionEvent(
                id: "evt-runtime-activity-todo",
                dispatchId: dispatchId,
                type: .tool,
                text: "Track dashboard redesign steps",
                status: "tool.complete",
                detail: [
                    "gatewayEventType": .string("tool.complete"),
                    "payload": .object([
                        "name": .string("todo"),
                        "tool_call_id": .string("todo-live"),
                        "todos": .array([
                            .object(["id": .string("read"), "content": .string("Read current page and subpage content"), "status": .string("completed")]),
                            .object(["id": .string("design"), "content": .string("Generate redesigned dashboard-style markdown"), "status": .string("in_progress")]),
                            .object(["id": .string("update"), "content": .string("Update main page and subpages"), "status": .string("pending")]),
                            .object(["id": .string("verify"), "content": .string("Verify pages were updated and accessible"), "status": .string("pending")])
                        ])
                    ])
                ],
                timestamp: timestamp
            ),
            RuntimeActivityProjectionEvent(
                id: "evt-runtime-activity-tool-start",
                dispatchId: dispatchId,
                type: .tool,
                text: "Read source outline",
                status: "running",
                detail: [
                    "gatewayEventType": .string("tool.start"),
                    "payload": .object([
                        "name": .string("filesystem.read"),
                        "tool_call_id": .string("tool-read-outline"),
                        "text": .string("Read current page outline")
                    ])
                ],
                timestamp: timestamp
            ),
            RuntimeActivityProjectionEvent(
                id: "evt-runtime-activity-tool-complete",
                dispatchId: dispatchId,
                type: .tool,
                text: "Read source outline",
                status: "completed",
                detail: [
                    "gatewayEventType": .string("tool.complete"),
                    "payload": .object([
                        "name": .string("filesystem.read"),
                        "tool_call_id": .string("tool-read-outline"),
                        "text": .string("Read current page outline")
                    ])
                ],
                timestamp: timestamp
            )
        ]
    }
}

private struct AppWindowVisualSnapshotEvidence: Codable {
    let artifactId: String
    let taskId: String
    let generatedAt: String
    let captureMode: String
    let privacyMode: String
    let temporaryUserDataEnvironmentKey: String
    let defaultApplicationSupportStateRead: Bool
    let hostDesktopCaptureUsed: Bool
    let sourceTargetStatus: String
    let controllerLoadingStatus: String
    let controllerErrorStatus: String
    let screenshotArtifactStatus: String
    let runtimeActivityScenarioStatus: String
    let retainedSurfaceCaptureStatus: String
    let retainedSurfaceCount: Int
    let capturedSnapshotCount: Int
    let standardWindowStatus: String
    let minimumWindowStatus: String
    let keyboardTraversalStatus: String
    let voiceOverHelpStatus: String
    let focusOrderStatus: String
    let contrastStatus: String
    let longContentReviewStatus: String
    let humanReviewerStatus: String
    let releaseProof: Bool
    let noProofStatement: String
    let snapshots: [SnapshotArtifact]
}

private struct SnapshotSize {
    let width: Int
    let height: Int
}

private struct RetainedSurfaceSnapshotRequest {
    let id: String
    let label: String
    let key: ShellSectionKey
}

private struct SnapshotArtifact: Codable {
    let id: String
    let file: String
    let width: Int
    let height: Int
    let surfaceId: String
    let surfaceLabel: String
    let shellSectionKey: String
    let sizeKind: String
    let navigationStatus: String
    let pngByteCount: Int
    let sampledDistinctColorCount: Int
    let status: String
}

private struct HarnessSeedError: Error, CustomStringConvertible {
    let description: String

    init(_ description: String) {
        self.description = description
    }
}
