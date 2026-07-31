// EmptyStateView.swift
// ClawChat

import SwiftUI

struct RelayEmptyState: View {
    var icon: String
    var iconColor: Color = ClawColors.textTertiary
    var title: String
    var subtitle: String? = nil
    var actionTitle: String? = nil
    var action: (() -> Void)? = nil

    var body: some View {
        VStack(spacing: ClawSpacing.lg) {
            Spacer()

            // Icon
            ZStack {
                RoundedRectangle(cornerRadius: RelayRadius.md)
                    .fill(iconColor.opacity(0.12))
                    .frame(width: 58, height: 58)

                Image(systemName: icon)
                    .font(.system(size: 26, weight: .medium))
                    .foregroundStyle(iconColor)
            }

            // Text
            VStack(spacing: ClawSpacing.sm) {
                Text(title)
                    .font(RelayFonts.navigationTitle)
                    .foregroundStyle(ClawColors.textPrimary)
                    .multilineTextAlignment(.center)

                if let subtitle {
                    Text(subtitle)
                        .font(RelayFonts.cardBody)
                        .foregroundStyle(ClawColors.textSecondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, ClawSpacing.xxxl)
                }
            }

            // Action button
            if let actionTitle, let action {
                Button(action: action) {
                    Text(actionTitle)
                        .font(RelayFonts.cardTitle)
                        .foregroundStyle(RelayColors.textPrimary)
                        .padding(.horizontal, ClawSpacing.xl)
                        .frame(minHeight: RelayMetrics.minimumHitTarget)
                        .background(ClawColors.backgroundSelected)
                        .clipShape(RoundedRectangle(cornerRadius: RelayRadius.sm))
                        .overlay(RoundedRectangle(cornerRadius: RelayRadius.sm).stroke(RelayColors.borderFocus))
                }
                .padding(.top, ClawSpacing.sm)
                .accessibilityLabel(actionTitle)
            }

            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Common preset empty states

extension RelayEmptyState {
    static func noThreads(onStart: @escaping () -> Void) -> RelayEmptyState {
        RelayEmptyState(
            icon: "bubble.left.and.bubble.right",
            iconColor: ClawColors.accent,
            title: "No conversations yet",
            subtitle: "Start a thread with an agent or team to get going.",
            actionTitle: "Start a thread",
            action: onStart
        )
    }

    static func noAgents(onAdd: @escaping () -> Void) -> RelayEmptyState {
        RelayEmptyState(
            icon: "cpu.fill",
            iconColor: ClawColors.accentPurple,
            title: "No agents yet",
            subtitle: "Connect your OpenClaw instance or add agents manually.",
            actionTitle: "Add agent",
            action: onAdd
        )
    }

    static func noTasks() -> RelayEmptyState {
        RelayEmptyState(
            icon: "checkmark.circle",
            iconColor: ClawColors.accentGreen,
            title: "All clear",
            subtitle: "No tasks to display right now."
        )
    }

    static func noApprovals() -> RelayEmptyState {
        RelayEmptyState(
            icon: "checkmark.seal",
            iconColor: ClawColors.accentOrange,
            title: "No pending approvals",
            subtitle: "Agents will request your approval when needed."
        )
    }

    static func noIncidents() -> RelayEmptyState {
        RelayEmptyState(
            icon: "shield.fill",
            iconColor: ClawColors.accentGreen,
            title: "No incidents",
            subtitle: "Everything looks healthy."
        )
    }

    static func error(onRetry: @escaping () -> Void) -> RelayEmptyState {
        RelayEmptyState(
            icon: "exclamationmark.triangle",
            iconColor: ClawColors.accentRed,
            title: "Something went wrong",
            subtitle: "We couldn't load this content. Please try again.",
            actionTitle: "Retry",
            action: onRetry
        )
    }

    static func searchNoResults(query: String) -> RelayEmptyState {
        RelayEmptyState(
            icon: "magnifyingglass",
            iconColor: ClawColors.textTertiary,
            title: "No results",
            subtitle: "Nothing found for \"\(query)\". Try a different search term."
        )
    }
}

typealias EmptyStateView = RelayEmptyState

// MARK: - Preview

#Preview {
    TabView {
        EmptyStateView.noThreads(onStart: {})
            .clawBackground()

        EmptyStateView.noAgents(onAdd: {})
            .clawBackground()

        EmptyStateView.error(onRetry: {})
            .clawBackground()
    }
    .tabViewStyle(.page)
}
