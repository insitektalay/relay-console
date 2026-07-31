// UnreadBadge.swift
// ClawChat

import SwiftUI

// MARK: - UnreadBadge

struct UnreadBadge: View {
    let count: Int
    var isMuted: Bool = false

    private var displayText: String? {
        guard count > 0 else { return nil }
        return count > 99 ? "99+" : "\(count)"
    }

    private var badgeColor: Color {
        isMuted ? ClawColors.textTertiary : ClawColors.unreadBadge
    }

    var body: some View {
        Group {
            if let text = displayText {
                // Pill or circle with number
                Text(text)
                    .font(ClawFonts.badge)
                    .foregroundStyle(.white)
                    .padding(.horizontal, count > 9 ? 6 : 5)
                    .padding(.vertical, 3)
                    .background(badgeColor)
                    .clipShape(Capsule())
                    .animation(.easeInOut(duration: 0.2), value: count)
                    .accessibilityLabel("\(count) unread message\(count == 1 ? "" : "s")")
            } else {
                // Collapsed dot when count == 0
                Circle()
                    .fill(badgeColor)
                    .frame(width: 8, height: 8)
                    .opacity(0)
            }
        }
    }
}

// MARK: - MentionBadge (@ mention marker)

struct MentionBadge: View {
    var body: some View {
        Text("@")
            .font(.system(size: 11, weight: .bold))
            .foregroundStyle(.white)
            .frame(width: 18, height: 18)
            .background(ClawColors.accentOrange)
            .clipShape(Circle())
            .accessibilityLabel("You were mentioned")
    }
}

// MARK: - Preview

#Preview {
    VStack(spacing: ClawSpacing.lg) {
        HStack(spacing: ClawSpacing.lg) {
            UnreadBadge(count: 0)
            UnreadBadge(count: 1)
            UnreadBadge(count: 5)
            UnreadBadge(count: 12)
            UnreadBadge(count: 99)
            UnreadBadge(count: 100)
        }

        HStack(spacing: ClawSpacing.lg) {
            Text("Muted:").foregroundStyle(ClawColors.textSecondary)
            UnreadBadge(count: 3, isMuted: true)
            UnreadBadge(count: 15, isMuted: true)
        }

        MentionBadge()
    }
    .padding()
    .background(ClawColors.backgroundPrimary)
}
