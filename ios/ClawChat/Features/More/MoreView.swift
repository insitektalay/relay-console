// MoreView.swift
// ClawChat – compact Relay Console navigation hub

import SwiftUI

enum ConsoleDestination: String, CaseIterable, Identifiable, Hashable {
    case artifacts = "Artifacts"
    case applications = "Applications"
    case approvals = "Approvals"
    case settings = "Settings"
    case tasks = "Tasks"
    case notifications = "Notifications"
    case workspaceLibrary = "Workspace Library"
    case quickActions = "Quick Actions"

    enum Group: String {
        case relay = "Relay sections"
        case remote = "Remote tools"
    }

    var id: String { rawValue }

    var group: Group {
        switch self {
        case .artifacts, .applications, .approvals, .settings: .relay
        case .tasks, .notifications, .workspaceLibrary, .quickActions: .remote
        }
    }

    var icon: String {
        switch self {
        case .artifacts: "shippingbox.fill"
        case .applications: "square.grid.2x2.fill"
        case .approvals: "checkmark.shield.fill"
        case .settings: "gearshape.fill"
        case .tasks: "checklist"
        case .notifications: "bell.fill"
        case .workspaceLibrary: "folder.fill"
        case .quickActions: "command"
        }
    }

    var subtitle: String {
        switch self {
        case .artifacts: "Curated outputs and maintained files"
        case .applications: "Providers, connections, and agent tools"
        case .approvals: "Review exact actions before they run"
        case .settings: "Account, connections, runtime, and workspace"
        case .tasks: "Scheduled, recurring, and recent work"
        case .notifications: "Unread alerts and delivery state"
        case .workspaceLibrary: "Browse the wider OpenClaw library"
        case .quickActions: "Search navigation and common actions"
        }
    }

    var requiresWorkspace: Bool { self != .settings }
}

struct ConsoleView: View {
    @EnvironmentObject private var appStore: AppStore
    @State private var path: [ConsoleDestination] = []

    var body: some View {
        NavigationStack(path: $path) {
            ScrollView {
                ConsoleIndexContent(
                    hasWorkspace: appStore.selectedWorkspace != nil,
                    workspaceName: appStore.selectedWorkspace?.name,
                    pendingApprovalCount: appStore.pendingApprovals.count,
                    unreadAlertCount: appStore.unreadAlertCount,
                    selection: nil,
                    onSelect: { path.append($0) }
                )
                .padding(.horizontal, RelaySpacing.lg)
                .padding(.bottom, RelaySpacing.xl)
            }
            .safeAreaInset(edge: .top, spacing: 0) {
                RelayCompactHeader(title: "Console", icon: "rectangle.3.group")
            }
            .navigationBarHidden(true)
            .navigationDestination(for: ConsoleDestination.self) { destination in
                ConsoleDestinationView(destination: destination)
                    .environmentObject(appStore)
            }
            .relayScreenBackground()
        }
        .preferredColorScheme(.dark)
    }
}

typealias MoreView = ConsoleView

struct ConsoleIndexContent: View {
    let hasWorkspace: Bool
    var workspaceName: String?
    var pendingApprovalCount = 0
    var unreadAlertCount = 0
    var selection: ConsoleDestination?
    var onSelect: (ConsoleDestination) -> Void = { _ in }

    var body: some View {
        VStack(alignment: .leading, spacing: RelaySpacing.lg) {
            RelayBrandLockup()
                .padding(.top, RelaySpacing.lg)

            if !hasWorkspace {
                RelayStatusStrip(
                    title: "Workspace required",
                    detail: "Select a workspace to open operational Console sections.",
                    tone: .warning,
                    icon: "building.2.crop.circle"
                )
            }

            destinationGroup(.relay)
            destinationGroup(.remote)

            RelayMetaRow(label: "Workspace", value: workspaceName ?? "Not selected")
        }
    }

    private func destinationGroup(_ group: ConsoleDestination.Group) -> some View {
        RelayPanel {
            RelaySectionHeader(
                title: group.rawValue,
                subtitle: group == .relay ? "Mac-aligned primary destinations" : "iPhone and Relay account operations"
            )
            ForEach(ConsoleDestination.allCases.filter { $0.group == group }) { destination in
                RelayNavRow(
                    title: destination.rawValue,
                    subtitle: destination.subtitle,
                    icon: destination.icon,
                    badge: badge(for: destination),
                    state: rowState(for: destination),
                    action: { onSelect(destination) }
                )
                .accessibilityHint(accessibilityHint(for: destination))
            }
        }
    }

    private func rowState(for destination: ConsoleDestination) -> RelayNavRowState {
        if destination.requiresWorkspace && !hasWorkspace { return .unavailable }
        if selection == destination { return .selected }
        return .normal
    }

    private func badge(for destination: ConsoleDestination) -> String? {
        switch destination {
        case .approvals where pendingApprovalCount > 0: "\(min(pendingApprovalCount, 99))"
        case .notifications where unreadAlertCount > 0: "\(min(unreadAlertCount, 99))"
        default: nil
        }
    }

    private func accessibilityHint(for destination: ConsoleDestination) -> String {
        if destination.requiresWorkspace && !hasWorkspace { return "Unavailable until a workspace is selected" }
        return "Opens \(destination.rawValue)"
    }
}

struct ConsoleDestinationView: View {
    let destination: ConsoleDestination
    @EnvironmentObject private var appStore: AppStore

    @ViewBuilder
    var body: some View {
        if destination.requiresWorkspace, let workspaceId = appStore.selectedWorkspace?.id {
            workspaceDestination(destination, workspaceId: workspaceId)
        } else if destination == .settings {
            SettingsView()
        } else {
            RelayEmptyState(
                icon: "building.2",
                title: "Select a workspace",
                subtitle: "\(destination.rawValue) is available after a workspace is selected."
            )
            .relayScreenBackground()
            .navigationTitle(destination.rawValue)
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    @ViewBuilder
    private func workspaceDestination(_ destination: ConsoleDestination, workspaceId: String) -> some View {
        switch destination {
        case .artifacts:
            ArtifactsView(workspaceId: workspaceId, agents: appStore.agents)
        case .applications:
            MarketplaceView(workspaceId: workspaceId, agents: appStore.agents)
        case .approvals:
            ApprovalCentreView()
        case .settings:
            SettingsView()
        case .tasks:
            TaskBoardView()
        case .notifications:
            NotificationsView()
        case .workspaceLibrary:
            WorkspaceLibraryHubView(workspaceId: workspaceId, agents: appStore.agents)
        case .quickActions:
            QuickActionsView(workspaceId: workspaceId, agents: appStore.agents)
        }
    }
}

#Preview {
    ConsoleView().environmentObject(AppStore())
}
