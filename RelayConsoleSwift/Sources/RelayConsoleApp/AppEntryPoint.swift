import AppKit
import RelayConsoleCore
import SwiftUI

public struct RelayConsoleCapturePage: Identifiable, Codable, Equatable, Sendable {
    public var id: String
    public var label: String
    public var section: ShellSectionKey

    public init(id: String, label: String, section: ShellSectionKey) {
        self.id = id
        self.label = label
        self.section = section
    }
}

@MainActor
public final class RelayConsoleAppController: ObservableObject {
    private let model: AppViewModel
    public let updateController: RelayConsoleUpdateController
    private var captureTasks: [AgentTask] = []

    public init(userDataPath: URL? = nil) {
        self.model = AppViewModel(userDataPath: userDataPath)
        self.updateController = RelayConsoleUpdateController()
    }

    public var isLoading: Bool {
        model.loading || model.relayLaunchAccessCheckInProgress
    }

    public var errorDescription: String? {
        model.error
    }

    public func startNewChat() {
        model.selectNav(.chat)
        model.beginNewChat()
    }

    public static func flushTelemetry() {
        RelayTelemetry.shared.flush()
    }

    public func presentCommandPalette() {
        model.presentCommandPalette()
    }

    @discardableResult
    public func selectShellSection(_ key: ShellSectionKey) -> ShellRouteResolution {
        model.selectShellSection(key)
    }

    public func selectSecuritySettings() {
        model.selectSettingsPanel(.security)
    }

    public func prepareForVisualCapture() {
        model.relayLaunchAccessCheckInProgress = false
        model.relayEntitlementAccess = RelayEntitlementAccess(
            state: .activeOffline,
            status: "active",
            message: "Visual capture fixture access."
        )
    }

    public func captureSelectSettingsPanel(_ rawValue: String) {
        guard let panel = SettingsPanelKey(rawValue: rawValue) else { return }
        model.settingsPanel = panel
    }

    public func captureSelectMarketplaceApp(_ slug: String) {
        model.selectNav(.applications)
        let apps = model.applicationsCatalogSnapshot?.apps ?? model.applicationsCatalogApps
        guard let app = apps.first(where: { $0.slug == slug }) else { return }
        model.selectMarketplaceApp(app)
    }

    public var captureMarketplaceSlugs: [String] {
        (model.applicationsCatalogSnapshot?.apps ?? model.applicationsCatalogApps).map(\.slug)
    }

    public func captureBeginCreateAgent() {
        model.selectNav(.agents)
        model.beginCreateAgent()
    }

    public var capturePageCatalog: [RelayConsoleCapturePage] {
        var pages: [RelayConsoleCapturePage] = [
            .init(id: "chat-empty", label: "Chats — no conversation selected", section: .chats),
            .init(id: "chat-new-direct", label: "Chats — new direct chat", section: .chats),
            .init(id: "chat-new-team", label: "Chats — new team chat", section: .chats),
            .init(id: "chat-direct", label: "Chats — direct conversation", section: .chats),
            .init(id: "chat-team", label: "Chats — team conversation", section: .chats),
            .init(id: "artifacts-empty", label: "Artifacts — no selection", section: .artifacts),
            .init(id: "artifact-document", label: "Artifacts — document detail", section: .artifacts),
            .init(id: "artifact-image", label: "Artifacts — image detail", section: .artifacts),
            .init(id: "artifact-video", label: "Artifacts — video detail", section: .artifacts),
            .init(id: "artifact-audio", label: "Artifacts — audio detail", section: .artifacts),
            .init(id: "artifact-data", label: "Artifacts — data detail", section: .artifacts),
            .init(id: "artifact-folder", label: "Artifacts — folder detail", section: .artifacts),
            .init(id: "artifact-external", label: "Artifacts — external detail", section: .artifacts),
            .init(id: "artifact-unknown", label: "Artifacts — unknown detail", section: .artifacts),
            .init(id: "agents-create", label: "Agents — create agent", section: .agents),
            .init(id: "agents-edit", label: "Agents — edit agent", section: .agents),
            .init(id: "agents-instructions", label: "Agents — instructions", section: .agents),
            .init(id: "agents-memory", label: "Agents — memory", section: .agents),
            .init(id: "agents-skills", label: "Agents — skills", section: .agents),
            .init(id: "agents-create-org", label: "Agents — create organization", section: .agents),
            .init(id: "agents-structure", label: "Agents — organization structure", section: .agents),
            .init(id: "agents-category", label: "Agents — classification", section: .agents),
            .init(id: "agents-work-calendar", label: "Agents — work calendar", section: .agents),
            .init(id: "agents-tasks-empty", label: "Agents — task schedule", section: .agents),
            .init(id: "agents-tasks-new", label: "Agents — new scheduled task", section: .agents),
            .init(id: "agents-tasks-detail", label: "Agents — scheduled task detail", section: .agents),
            .init(id: "agents-cron-empty", label: "Agents — cron jobs", section: .agents),
            .init(id: "agents-cron-detail", label: "Agents — cron job detail", section: .agents),
            .init(id: "applications-catalog", label: "Applications — catalog", section: .applications),
            .init(id: "approvals-empty", label: "Approvals — no selection", section: .approvals),
            .init(id: "approvals-detail", label: "Approvals — pending action detail", section: .approvals),
            .init(id: "settings-account", label: "Settings — Account", section: .settings),
            .init(id: "settings-security", label: "Settings — Security", section: .settings),
            .init(id: "settings-harnesses", label: "Settings — Harnesses", section: .settings),
            .init(id: "settings-runtime", label: "Settings — Runtime", section: .settings),
            .init(id: "command-palette", label: "Command palette overlay", section: .chats)
        ]
        pages.append(contentsOf: captureMarketplaceSlugs.map {
            RelayConsoleCapturePage(id: "application-\($0)", label: "Applications — \($0)", section: .applications)
        })
        return pages
    }

    @discardableResult
    public func prepareCapturePage(_ pageId: String) async -> Bool {
        model.dismissCommandPalette()
        model.appToast = nil
        model.isStartingChat = false
        model.agentPanelMode = .detail
        model.taskSchedulerOpen = false
        model.artifactKindFilter = nil
        model.approvalSearch = ""
        model.approvalStatusFilter = .pending

        switch pageId {
        case "chat-empty":
            _ = model.selectShellSection(.chats)
            model.selectedThreadId = nil
            model.selectedThreadDetail = nil
            model.messages = []
        case "chat-new-direct":
            model.beginNewChat()
            model.selectNewChatKind(.direct)
        case "chat-new-team":
            model.beginNewChat()
            model.selectNewChatKind(.team)
        case "chat-direct":
            _ = model.selectShellSection(.chats)
            guard let thread = model.threads.first(where: { $0.threadType == .direct }) else { return false }
            model.selectThread(thread.id)
        case "chat-team":
            _ = model.selectShellSection(.chats)
            guard let thread = model.threads.first(where: { $0.threadType == .team }) else { return false }
            model.selectThread(thread.id)
        case "artifacts-empty":
            _ = model.selectShellSection(.artifacts)
            installCaptureArtifacts(selectedKind: nil)
        case let id where id.hasPrefix("artifact-"):
            _ = model.selectShellSection(.artifacts)
            let rawKind = String(id.dropFirst("artifact-".count))
            installCaptureArtifacts(selectedKind: rawKind)
        case "agents-create":
            model.beginCreateAgent()
        case "agents-edit":
            _ = model.selectShellSection(.agents)
            guard model.selectedAgent != nil else { return false }
            model.agentPanelMode = .edit
        case let id where id.hasPrefix("agents-"):
            _ = model.selectShellSection(.agents)
            guard model.selectedAgent != nil else { return false }
            if id == "agents-tasks-new" {
                installCaptureTask(selected: false)
                model.selectAgentSubview(.tasks)
                model.taskSchedulerOpen = true
            } else if id == "agents-tasks-detail" {
                installCaptureTask(selected: true)
                model.selectAgentSubview(.tasks)
            } else if id == "agents-tasks-empty" {
                if captureTasks.isEmpty { captureTasks = model.agentTasks }
                model.agentTasks = []
                model.selectedAgentTaskId = ""
                model.selectAgentSubview(.tasks)
            } else if id == "agents-cron-detail" {
                installCaptureCron(selected: true)
                model.selectAgentSubview(.cronJobs)
            } else if id == "agents-cron-empty" {
                model.cronJobs = []
                model.selectedCronJobId = ""
                model.selectAgentSubview(.cronJobs)
            } else if let subview = captureAgentSubview(for: id) {
                model.selectAgentSubview(subview)
            } else {
                return false
            }
        case "applications-catalog":
            _ = model.selectShellSection(.applications)
            model.applicationsSelectedAppId = ""
            if var snapshot = model.applicationsCatalogSnapshot {
                snapshot.selectedApp = nil
                model.applicationsCatalogSnapshot = snapshot
            }
        case let id where id.hasPrefix("application-"):
            _ = model.selectShellSection(.applications)
            let slug = String(id.dropFirst("application-".count))
            let apps = model.applicationsCatalogSnapshot?.apps ?? model.applicationsCatalogApps
            guard let app = apps.first(where: { $0.slug == slug }) else { return false }
            model.applicationsSelectedAppId = app.id
            if var snapshot = model.applicationsCatalogSnapshot {
                snapshot.selectedApp = app
                model.applicationsCatalogSnapshot = snapshot
            }
        case "approvals-empty":
            _ = model.selectShellSection(.approvals)
            installCaptureApproval(selected: false)
        case "approvals-detail":
            _ = model.selectShellSection(.approvals)
            installCaptureApproval(selected: true)
        case "settings-account", "settings-security", "settings-harnesses", "settings-runtime":
            _ = model.selectShellSection(.settings)
            let raw = String(pageId.dropFirst("settings-".count))
            guard let panel = SettingsPanelKey(rawValue: raw), panel.isVisibleInFirstLaunch else { return false }
            model.settingsPanel = panel
        case "command-palette":
            _ = model.selectShellSection(.chats)
            model.presentCommandPalette()
        default:
            return false
        }

        try? await Task.sleep(nanoseconds: 180_000_000)
        return true
    }

    private func captureAgentSubview(for pageId: String) -> AgentSubviewKey? {
        switch pageId {
        case "agents-instructions": return .instructions
        case "agents-memory": return .memory
        case "agents-skills": return .skills
        case "agents-create-org": return .createOrg
        case "agents-structure": return .structure
        case "agents-category": return .category
        case "agents-work-calendar": return .workCalendar
        default: return nil
        }
    }

    private func installCaptureArtifacts(selectedKind: String?) {
        let timestamp = "2026-07-11T12:00:00Z"
        let logoPath = Bundle.module.url(forResource: "logo_relay_console", withExtension: "png")?.path ?? "/tmp/relay-console-capture.png"
        let values: [(String, String, AgentArtifactKind, String, String?, String?, Bool)] = [
            ("document", "Quarterly operating brief", .document, "/tmp/relay-brief.md", "md", "# Quarterly operating brief\n\nA redaction-safe visual capture document with priorities, owners, and next actions.", true),
            ("image", "Campaign concept", .image, logoPath, "png", nil, false),
            ("video", "Product walkthrough", .video, "/tmp/product-walkthrough.mp4", "mp4", nil, false),
            ("audio", "Research interview", .audio, "/tmp/research-interview.m4a", "m4a", nil, false),
            ("data", "Weekly metrics", .data, "/tmp/weekly-metrics.json", "json", "{\n  \"activeAgents\": 4,\n  \"completedRuns\": 18\n}", true),
            ("folder", "Campaign assets", .folder, "/tmp/campaign-assets", nil, nil, false),
            ("unknown", "Binary output", .unknown, "/tmp/output.bin", "bin", nil, false)
        ]
        var artifacts = values.map { value in
            AgentArtifactRecord(
                id: "capture-artifact-\(value.0)",
                title: value.1,
                kind: value.2,
                sourceKind: .relayManaged,
                path: value.3,
                relativePath: URL(fileURLWithPath: value.3).lastPathComponent,
                directoryPath: URL(fileURLWithPath: value.3).deletingLastPathComponent().path,
                fileExtension: value.4,
                byteCount: 24_576,
                updatedAt: timestamp,
                agentId: model.selectedAgent?.id,
                agentName: model.selectedAgent.map(model.resolveAgentDisplayName),
                content: value.5,
                preview: value.5,
                isReadableText: value.6
            )
        }
        artifacts.append(AgentArtifactRecord(
            id: "capture-artifact-external",
            title: "Published campaign board",
            kind: .document,
            sourceKind: .external,
            path: "/tmp/published-board.relay-artifact.json",
            relativePath: "published-board.relay-artifact.json",
            directoryPath: "/tmp",
            fileExtension: "json",
            externalURL: "https://example.invalid/redacted-board",
            externalProvider: "External provider",
            byteCount: 512,
            updatedAt: timestamp,
            agentId: model.selectedAgent?.id,
            agentName: model.selectedAgent.map(model.resolveAgentDisplayName),
            preview: "Redaction-safe external artifact pointer",
            isReadableText: false
        ))
        model.artifacts = artifacts
        model.artifactsSnapshot = AgentArtifactsSnapshot(artifacts: artifacts, selectedArtifactId: nil, refreshedAt: timestamp)
        guard let selectedKind else {
            model.selectedArtifactId = ""
            return
        }
        model.selectedArtifactId = selectedKind == "external"
            ? "capture-artifact-external"
            : "capture-artifact-\(selectedKind)"
    }

    private func installCaptureTask(selected: Bool) {
        if captureTasks.isEmpty { captureTasks = model.agentTasks }
        model.agentTasks = captureTasks
        model.agentTaskRuns = []
        model.selectedAgentTaskId = selected ? (captureTasks.first?.id ?? "") : ""
    }

    private func installCaptureCron(selected: Bool) {
        let job = AgentCronJobRecord(
            id: "capture-cron",
            jobId: "weekly-operating-review",
            name: "Weekly operating review",
            sourceKind: .hermesJobsFile,
            sourcePath: "/tmp/hermes/cron/jobs.json",
            sourceLabel: "Hermes jobs.json",
            agentId: model.selectedAgent?.id,
            agentName: model.selectedAgent.map(model.resolveAgentDisplayName) ?? "Capture agent",
            profileSlug: "capture-agent",
            hermesHomePath: "/tmp/hermes",
            enabled: true,
            state: "scheduled",
            scheduleDisplay: "Every Monday at 09:00",
            scheduleKind: "cron",
            scheduleMinutes: nil,
            scheduleExpression: "0 9 * * 1",
            nextRunAt: "2026-07-13T09:00:00Z",
            lastRunAt: "2026-07-06T09:00:00Z",
            lastStatus: "completed",
            lastError: nil,
            lastDeliveryError: nil,
            prompt: "Prepare a concise weekly operating review.",
            script: nil,
            skills: ["reporting"],
            enabledToolsets: ["workspace"],
            contextFrom: ["recent threads"],
            deliver: "artifact",
            workdir: "/tmp/hermes/workspace",
            model: "harness-default",
            provider: "OpenAI",
            baseURL: nil,
            outputDirectoryPath: "/tmp/hermes/cron/output/weekly-operating-review",
            artifactIds: [],
            maintainedArtifactId: nil,
            schedulerStatus: nil,
            rawJSON: "{\"id\":\"weekly-operating-review\"}",
            transparencyNotes: ["Redaction-safe visual capture fixture."]
        )
        model.cronJobs = [job]
        model.cronJobsSnapshot = AgentCronJobsSnapshot(jobs: [job], selectedJobId: selected ? job.id : nil, refreshedAt: "2026-07-11T12:00:00Z")
        model.selectedCronJobId = selected ? job.id : ""
    }

    private func installCaptureApproval(selected: Bool) {
        let timestamp = "2026-07-11T12:00:00Z"
        let card = ProviderActionApprovalCardState(
            id: "capture-approval-card",
            approvalId: "capture-approval",
            workspaceId: model.workspace?.id ?? "capture-workspace",
            appId: "mapp-x",
            appSlug: "x",
            appName: "X",
            providerActionId: "x.post.publish",
            title: "Publish reviewed update",
            subtitle: "X · approval required",
            actionLabel: "Publish post",
            status: .pending,
            statusLabel: "Pending",
            requestedByActorId: "capture-user",
            requestedByAgentId: model.selectedAgent?.id,
            resolvedByActorId: nil,
            requestedAt: timestamp,
            updatedAt: timestamp,
            resolvedAt: nil,
            expiresAt: "2026-07-12T12:00:00Z",
            payloadHash: "sha256:redacted-capture-payload",
            payloadSummary: "Publish a redaction-safe product update to the selected X account.",
            executionId: nil,
            executionStatus: nil,
            decisionAvailableInTopLevelUI: true,
            decisionUnavailableReason: nil,
            redactionStatus: "private-state-excluded"
        )
        let summary = ProviderActionApprovalInboxSummary(
            totalCount: 1,
            pendingCount: 1,
            approvedCount: 0,
            rejectedCount: 0,
            executedCount: 0,
            failedCount: 0,
            expiredCount: 0,
            cancelledCount: 0,
            generatedAt: timestamp,
            redactionStatus: "private-state-excluded"
        )
        model.providerApprovalInbox = ProviderActionApprovalInboxSnapshot(
            workspaceId: model.workspace?.id ?? "capture-workspace",
            generatedAt: timestamp,
            cards: [card],
            selectedApprovalId: selected ? card.approvalId : nil,
            selectedCard: selected ? card : nil,
            summary: summary,
            readOnly: false,
            redactionStatus: "private-state-excluded"
        )
        model.selectedProviderApprovalId = selected ? card.approvalId : ""
    }

    public var activeShellSection: ShellSectionKey {
        model.activeShellSection
    }

    public func waitForInitialLoad(timeoutSeconds: TimeInterval = 5) async {
        let deadline = Date().addingTimeInterval(timeoutSeconds)
        while model.loading && Date() < deadline {
            try? await Task.sleep(nanoseconds: 50_000_000)
        }
    }

    public func captureCompleteTelemetryChoice(timeoutSeconds: TimeInterval = 2) async {
        guard model.telemetryChoiceRequired else { return }
        model.completeTelemetryChoice(productAnalytics: false, crashReporting: false)
        let deadline = Date().addingTimeInterval(timeoutSeconds)
        while (model.telemetryChoiceRequired || model.telemetryChoiceSaving)
            && Date() < deadline
        {
            try? await Task.sleep(nanoseconds: 25_000_000)
        }
    }

    fileprivate var appModel: AppViewModel {
        model
    }
}

public struct RelayConsoleRootView: View {
    @ObservedObject private var controller: RelayConsoleAppController

    public init(controller: RelayConsoleAppController) {
        self.controller = controller
    }

    public var body: some View {
        ContentView()
            .environmentObject(controller.appModel)
            .environmentObject(controller.updateController)
            .frame(minWidth: 980, minHeight: 640, alignment: .topLeading)
            .background {
                WindowChromeConfigurator { window in
                    controller.appModel.configureWindowChrome(window)
                }
                .frame(width: 0, height: 0)
            }
            .onAppear {
                controller.appModel.configureWindow()
                controller.updateController.startAfterApplicationShellIsReady()
            }
    }
}

private struct WindowChromeConfigurator: NSViewRepresentable {
    var configure: (NSWindow?) -> Void

    func makeNSView(context: Context) -> NSView {
        let view = NSView()
        DispatchQueue.main.async {
            configure(view.window)
        }
        return view
    }

    func updateNSView(_ view: NSView, context: Context) {
        DispatchQueue.main.async {
            configure(view.window)
        }
    }
}

public enum RelayConsoleAppAssets {
    public static func applicationIcon() -> NSImage? {
        guard let iconURL = Bundle.module.url(forResource: "icon", withExtension: "png") else {
            return nil
        }
        return NSImage(contentsOf: iconURL)
    }
}

enum RelayConsoleWindowPresenter {
    static func present(_ window: NSWindow?) {
        guard let window else { return }
        if window.isMiniaturized {
            window.deminiaturize(nil)
        }
        window.makeKeyAndOrderFront(nil)
        NSApplication.shared.activate(ignoringOtherApps: true)
    }
}
