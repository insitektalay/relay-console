import SwiftUI

private struct QuickAction: Identifiable {
    let id: String
    let title: String
    let subtitle: String
    let icon: String
    let keywords: String
    let destination: AnyView?
    let unavailableReason: String?
}

struct QuickActionsView: View {
    let workspaceId: String
    let agents: [Agent]
    @State private var query = ""

    private var actions: [QuickAction] {
        [
            QuickAction(id: "applications", title: "Applications", subtitle: "Marketplace, connections, and tools", icon: "square.grid.2x2.fill", keywords: "marketplace provider oauth install needed tools", destination: AnyView(MarketplaceView(workspaceId: workspaceId, agents: agents)), unavailableReason: nil),
            QuickAction(id: "approvals", title: "Approvals", subtitle: "Review pending actions", icon: "checkmark.shield.fill", keywords: "approve reject provider safety", destination: AnyView(ApprovalCentreView()), unavailableReason: nil),
            QuickAction(id: "artifacts", title: "Generated Artifacts", subtitle: "Browse durable agent outputs", icon: "shippingbox.fill", keywords: "artifact output generated files", destination: AnyView(WorkspaceLibraryView(workspaceId: workspaceId, root: .workspace, initialFolder: ".clawchat/artifacts", title: "Artifacts")), unavailableReason: nil),
            QuickAction(id: "tasks", title: "Tasks", subtitle: "Scheduled and recurring work", icon: "checklist", keywords: "task schedule runs cron", destination: AnyView(TaskBoardView()), unavailableReason: nil),
            QuickAction(id: "notifications", title: "Notifications", subtitle: "Alerts and read state", icon: "bell.fill", keywords: "alerts unread push delivery", destination: AnyView(NotificationsView()), unavailableReason: nil),
            QuickAction(id: "settings", title: "Settings", subtitle: "Account, runtime, and workspace", icon: "gearshape.fill", keywords: "profile privacy runtime confirmation", destination: AnyView(SettingsView()), unavailableReason: nil),
            QuickAction(id: "reports", title: "Reports", subtitle: "Unavailable", icon: "chart.bar.fill", keywords: "reports insights analytics", destination: nil, unavailableReason: "Reports and Insights are hidden pending product validation."),
            QuickAction(id: "paperclip", title: "Paperclip", subtitle: "Unavailable", icon: "paperclip", keywords: "paperclip integration", destination: nil, unavailableReason: "Paperclip is not part of the supported iPhone product surface."),
        ]
    }

    private var filtered: [QuickAction] {
        let term = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !term.isEmpty else { return actions }
        return actions.filter { "\($0.title) \($0.subtitle) \($0.keywords)".localizedCaseInsensitiveContains(term) }
    }

    var body: some View {
        Group {
            if filtered.isEmpty {
                RelayInlineEmptyState(icon: "magnifyingglass", title: "No matching actions", subtitle: "Try a different navigation or operation name.")
                    .padding(RelaySpacing.lg)
            } else {
                List(filtered) { action in
                    if let destination = action.destination {
                        NavigationLink(destination: destination) { row(action) }
                    } else {
                        VStack(alignment: .leading, spacing: 6) {
                            row(action)
                            Text(action.unavailableReason ?? "Unavailable")
                                .font(.caption)
                                .foregroundStyle(ClawColors.textSecondary)
                        }
                        .accessibilityElement(children: .combine)
                    }
                }
                .scrollContentBackground(.hidden)
            }
        }
        .navigationTitle("Quick Actions")
        .navigationBarTitleDisplayMode(.inline)
        .searchable(text: $query, prompt: "Search actions")
        .relayScreenBackground()
    }

    private func row(_ action: QuickAction) -> some View {
        HStack(spacing: 12) {
            Image(systemName: action.icon).frame(width: 28).foregroundStyle(action.destination == nil ? .secondary : ClawColors.accent)
            VStack(alignment: .leading) {
                Text(action.title).font(.headline)
                Text(action.subtitle).font(.caption).foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 3)
    }
}
