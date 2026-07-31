// NotificationsView.swift
// ClawChat – Operations: Alert center

import SwiftUI
import Combine

// MARK: - ViewModel

@MainActor
final class AlertsViewState: ObservableObject {
    @Published var selectedTab: AlertTab = .all
    @Published var selectedAlert: Alert? = nil
    @Published var groupBy: GroupMode = .date

    enum AlertTab: String, CaseIterable {
        case all      = "All"
        case unread   = "Unread"
        case critical = "Critical"
    }

    enum GroupMode: String, CaseIterable {
        case date     = "Date"
        case severity = "Severity"
        case type     = "Type"
    }

}

// MARK: - Alert type helpers

private extension AlertType {
    var icon: String {
        switch self {
        case .missedTask:       return "clock.badge.exclamationmark"
        case .stuckJob:         return "pause.circle.fill"
        case .repeatedFailure:  return "repeat.circle.fill"
        case .policyViolation:  return "shield.slash.fill"
        case .budgetWarning:    return "dollarsign.circle.fill"
        case .agentDown:        return "person.badge.minus"
        case .approvalExpired:  return "clock.badge.xmark"
        case .incidentOpened:   return "exclamationmark.triangle.fill"
        }
    }

    var displayLabel: String {
        switch self {
        case .missedTask:       return "Missed Task"
        case .stuckJob:         return "Stuck Job"
        case .repeatedFailure:  return "Repeated Failure"
        case .policyViolation:  return "Policy Violation"
        case .budgetWarning:    return "Budget Warning"
        case .agentDown:        return "Agent Down"
        case .approvalExpired:  return "Approval Expired"
        case .incidentOpened:   return "Incident Opened"
        }
    }

    var color: Color {
        switch self {
        case .missedTask:       return ClawColors.accentOrange
        case .stuckJob:         return ClawColors.accentOrange
        case .repeatedFailure:  return ClawColors.accentRed
        case .policyViolation:  return ClawColors.accentPurple
        case .budgetWarning:    return ClawColors.accentOrange
        case .agentDown:        return ClawColors.accentRed
        case .approvalExpired:  return ClawColors.accentOrange
        case .incidentOpened:   return ClawColors.accentRed
        }
    }
}

// MARK: - View

struct NotificationsView: View {
    @EnvironmentObject private var appStore: AppStore
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @StateObject private var vm = AlertsViewState()
    @State private var dataVM = AlertsViewModel(workspaceId: "")

    var body: some View {
        Group {
            ZStack {
                ClawColors.backgroundPrimary.ignoresSafeArea()

                VStack(spacing: 0) {
                    tabBar
                    Divider().background(ClawColors.separator)

                    if dataVM.isLoading && dataVM.alerts.isEmpty {
                        Spacer()
                        ProgressView().tint(ClawColors.accent)
                        Spacer()
                    } else if let error = dataVM.error, dataVM.alerts.isEmpty {
                        emptyState(
                            title: "Unable to load alerts",
                            message: error,
                            icon: "exclamationmark.triangle"
                        )
                    } else if filteredAlerts.isEmpty {
                        emptyState
                    } else {
                        ScrollView {
                            LazyVStack(spacing: 0) {
                                ForEach(filteredAlerts) { alert in
                                    alertRow(alert: alert)
                                    Divider()
                                        .background(ClawColors.separatorLight)
                                        .padding(.leading, 56)
                                }
                            }
                            .padding(.bottom, ClawSpacing.xxxl)
                        }
                    }
                }
            }
            .navigationTitle("Notifications")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(ClawColors.backgroundPrimary, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    if dataVM.unreadCount > 0 {
                        Button("Mark all read") {
                            _Concurrency.Task {
                                await dataVM.markAllRead()
                            }
                        }
                        .font(.system(size: 14))
                        .foregroundStyle(ClawColors.accent)
                    }
                }
            }
            .sheet(item: $vm.selectedAlert) { alert in
                AlertDetailSheet(alert: alert)
                    .onAppear {
                        _Concurrency.Task {
                            await dataVM.markRead(alert: alert)
                        }
                    }
            }
            .task {
                dataVM.setupWebSocket()
                await reloadAlerts()
            }
            .refreshable {
                await reloadAlerts()
            }
            .onChange(of: appStore.selectedWorkspace) { _, _ in
                _Concurrency.Task {
                    await reloadAlerts()
                }
            }
        }
    }

    // MARK: - Tab Bar

    private var tabBar: some View {
        HStack(spacing: 0) {
            ForEach(AlertsViewState.AlertTab.allCases, id: \.self) { tab in
                Button {
                    withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.15)) {
                        vm.selectedTab = tab
                    }
                } label: {
                    VStack(spacing: 4) {
                        HStack(spacing: ClawSpacing.xs) {
                            Text(tab.rawValue)
                                .font(.system(size: 14, weight: vm.selectedTab == tab ? .semibold : .regular))
                                .foregroundStyle(vm.selectedTab == tab ? ClawColors.accent : ClawColors.textSecondary)

                            if tab == .unread && dataVM.unreadCount > 0 {
                                Text("\(dataVM.unreadCount)")
                                    .font(.system(size: 10, weight: .bold))
                                    .foregroundStyle(.white)
                                    .padding(.horizontal, 5)
                                    .padding(.vertical, 2)
                                    .background(ClawColors.accentRed)
                                    .clipShape(Capsule())
                            }
                        }
                        .padding(.vertical, ClawSpacing.md)

                        Rectangle()
                            .fill(vm.selectedTab == tab ? ClawColors.accent : Color.clear)
                            .frame(height: 2)
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(.plain)
            }
        }
        .background(ClawColors.backgroundPrimary)
        .sensoryFeedback(.selection, trigger: vm.selectedTab)
    }

    // MARK: - Alert Row

    @ViewBuilder
    private func alertRow(alert: Alert) -> some View {
        Button {
            vm.selectedAlert = alert
        } label: {
            HStack(alignment: .top, spacing: ClawSpacing.md) {
                // Unread indicator
                Circle()
                    .fill(alert.isRead ? Color.clear : ClawColors.accent)
                    .frame(width: 8, height: 8)
                    .padding(.top, 6)

                // Type icon
                ZStack {
                    Circle()
                        .fill(alert.type.color.opacity(0.15))
                        .frame(width: 38, height: 38)
                    Image(systemName: alert.type.icon)
                        .font(.system(size: 16))
                        .foregroundStyle(alert.type.color)
                }

                VStack(alignment: .leading, spacing: ClawSpacing.xs) {
                    HStack {
                        Text(alert.title)
                            .font(.system(size: 13, weight: alert.isRead ? .regular : .semibold))
                            .foregroundStyle(alert.isRead ? ClawColors.textSecondary : ClawColors.textPrimary)
                            .lineLimit(1)

                        Spacer()

                        Text(alert.createdAt.chatTimestamp)
                            .font(.system(size: 11))
                            .foregroundStyle(ClawColors.textTertiary)
                    }

                    Text(alert.message)
                        .font(ClawFonts.caption)
                        .foregroundStyle(ClawColors.textSecondary)
                        .lineLimit(2)

                    HStack(spacing: ClawSpacing.xs) {
                        Text(alert.type.displayLabel)
                            .font(.system(size: 10, weight: .medium))
                            .foregroundStyle(alert.type.color)
                            .padding(.horizontal, ClawSpacing.sm)
                            .padding(.vertical, 2)
                            .background(alert.type.color.opacity(0.12))
                            .clipShape(Capsule())

                        SeverityBadge(severity: alert.severity)

                        if let agentId = alert.agentId {
                            Label(agentId, systemImage: "person.fill")
                                .font(.system(size: 10))
                                .foregroundStyle(ClawColors.textTertiary)
                        }
                    }
                }
            }
            .padding(.horizontal, ClawSpacing.lg)
            .padding(.vertical, ClawSpacing.md)
            .background(alert.isRead ? Color.clear : ClawColors.accent.opacity(0.04))
        }
        .buttonStyle(.plain)
    }

    // MARK: - Empty State

    private var emptyState: some View {
        emptyState(
            title: "No alerts",
            message: dataVM.alerts.isEmpty
                ? "You're all caught up."
                : "No alerts match the current filter.",
            icon: "bell.slash.fill"
        )
    }

    @ViewBuilder
    private func emptyState(title: String, message: String, icon: String) -> some View {
        VStack(spacing: ClawSpacing.md) {
            Spacer()
            Image(systemName: icon)
                .font(.system(size: 48))
                .foregroundStyle(ClawColors.textTertiary)
            Text(title)
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(ClawColors.textPrimary)
            Text(message)
                .font(ClawFonts.cardBody)
                .foregroundStyle(ClawColors.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, ClawSpacing.xl)
            Spacer()
        }
        .frame(maxWidth: .infinity)
    }

    private var filteredAlerts: [Alert] {
        dataVM.alerts
            .filter { alert in
                switch vm.selectedTab {
                case .all:
                    return true
                case .unread:
                    return !alert.isRead
                case .critical:
                    return alert.severity == .critical || alert.severity == .high
                }
            }
            .sorted { $0.createdAt > $1.createdAt }
    }

    private func reloadAlerts() async {
        guard let workspaceId = appStore.selectedWorkspace?.id, !workspaceId.isEmpty else {
            dataVM.workspaceId = ""
            dataVM.alerts = []
            dataVM.unreadCount = 0
            dataVM.error = nil
            dataVM.hasMore = false
            return
        }

        dataVM.workspaceId = workspaceId
        await dataVM.loadAlerts()
    }
}

// MARK: - Alert Detail Sheet

struct AlertDetailSheet: View {
    let alert: Alert
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ZStack {
                ClawColors.backgroundPrimary.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: ClawSpacing.lg) {
                        // Icon + type header
                        VStack(spacing: ClawSpacing.md) {
                            ZStack {
                                Circle()
                                    .fill(alert.type.color.opacity(0.15))
                                    .frame(width: 64, height: 64)
                                Image(systemName: alert.type.icon)
                                    .font(.system(size: 28))
                                    .foregroundStyle(alert.type.color)
                            }

                            Text(alert.type.displayLabel)
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(alert.type.color)
                                .textCase(.uppercase)
                                .tracking(1)
                        }
                        .frame(maxWidth: .infinity)

                        // Content card
                        VStack(alignment: .leading, spacing: ClawSpacing.md) {
                            Text(alert.title)
                                .font(.system(size: 18, weight: .bold))
                                .foregroundStyle(ClawColors.textPrimary)

                            Text(alert.message)
                                .font(ClawFonts.cardBody)
                                .foregroundStyle(ClawColors.textSecondary)
                                .lineSpacing(4)

                            Divider().background(ClawColors.separatorLight)

                            SeverityBadge(severity: alert.severity)

                            HStack(spacing: ClawSpacing.sm) {
                                Image(systemName: "clock")
                                    .font(.system(size: 12))
                                    .foregroundStyle(ClawColors.textTertiary)
                                Text(alert.createdAt.fullTimestamp)
                                    .font(ClawFonts.caption)
                                    .foregroundStyle(ClawColors.textSecondary)
                            }

                            if let agentId = alert.agentId {
                                HStack(spacing: ClawSpacing.sm) {
                                    AvatarView(name: agentId, imageUrl: nil, size: .small)
                                    Text(agentId)
                                        .font(.system(size: 13, weight: .medium))
                                        .foregroundStyle(ClawColors.textPrimary)
                                }
                            }

                            if let taskId = alert.taskId {
                                Label("Task: \(taskId)", systemImage: "checklist")
                                    .font(ClawFonts.caption)
                                    .foregroundStyle(ClawColors.accent)
                            }

                            if let expires = alert.expiresAt {
                                Label("Expires: \(expires.relativeTime)", systemImage: "clock.badge.exclamationmark")
                                    .font(ClawFonts.caption)
                                    .foregroundStyle(ClawColors.accentOrange)
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(ClawSpacing.lg)
                        .background(ClawColors.backgroundCard)
                        .cornerRadius(ClawRadius.card)
                        .overlay(RoundedRectangle(cornerRadius: ClawRadius.card).stroke(ClawColors.separator, lineWidth: 0.5))

                        // Action buttons based on type
                        actionButtons
                    }
                    .padding(ClawSpacing.lg)
                }
            }
            .navigationTitle("Alert Detail")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(ClawColors.backgroundPrimary, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Close") { dismiss() }
                        .foregroundStyle(ClawColors.accent)
                }
            }
        }
        .presentationBackground(ClawColors.backgroundPrimary)
    }

    @ViewBuilder
    private var actionButtons: some View {
        switch alert.type {
        case .missedTask, .stuckJob, .repeatedFailure:
            actionBtn("View Task", icon: "checklist", color: ClawColors.accent) { dismiss() }

        case .approvalExpired:
            actionBtn("View Approvals", icon: "checkmark.seal.fill", color: ClawColors.accentOrange) { dismiss() }

        case .incidentOpened:
            actionBtn("View Incident", icon: "exclamationmark.triangle.fill", color: ClawColors.accentRed) { dismiss() }

        case .budgetWarning:
            actionBtn("View Budget", icon: "dollarsign.circle.fill", color: ClawColors.accentOrange) { dismiss() }

        case .agentDown:
            actionBtn("View Agent", icon: "person.badge.minus", color: ClawColors.accentRed) { dismiss() }

        case .policyViolation:
            actionBtn("View Policy", icon: "shield.slash.fill", color: ClawColors.accentPurple) { dismiss() }
        }
    }

    private func actionBtn(_ label: String, icon: String, color: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Label(label, systemImage: icon)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, ClawSpacing.md)
                .background(color)
                .cornerRadius(ClawRadius.md)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Preview

#Preview {
    NotificationsView()
        .environmentObject(AppStore())
        .preferredColorScheme(.dark)
}
