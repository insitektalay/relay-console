// SectionHeader.swift
// ClawChat

import SwiftUI

struct SectionHeader: View {
    let title: String
    var actionTitle: String? = nil
    var action: (() -> Void)? = nil

    var body: some View {
        HStack {
            Text(title.uppercased())
                .font(ClawFonts.sectionHeader)
                .foregroundStyle(ClawColors.textSecondary)
                .tracking(0.5)

            Spacer()

            if let actionTitle, let action {
                Button(action: action) {
                    Text(actionTitle)
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(ClawColors.accent)
                }
                .accessibilityLabel(actionTitle)
            }
        }
        .padding(.horizontal, ClawSpacing.lg)
        .padding(.top, ClawSpacing.xl)
        .padding(.bottom, ClawSpacing.xs)
    }
}

// MARK: - InlineSectionDivider

struct InlineSectionDivider: View {
    let title: String

    var body: some View {
        HStack(spacing: ClawSpacing.sm) {
            Rectangle()
                .fill(ClawColors.separator)
                .frame(height: 0.5)

            Text(title.uppercased())
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(ClawColors.textTertiary)
                .tracking(0.8)
                .fixedSize()

            Rectangle()
                .fill(ClawColors.separator)
                .frame(height: 0.5)
        }
        .padding(.horizontal, ClawSpacing.lg)
        .padding(.vertical, ClawSpacing.sm)
    }
}

// MARK: - Preview

#Preview {
    VStack(spacing: 0) {
        SectionHeader(title: "Active Agents", actionTitle: "See all", action: {})
        Divider().background(ClawColors.separator)

        SectionHeader(title: "Recent Tasks")
        Divider().background(ClawColors.separator)

        Spacer().frame(height: ClawSpacing.xl)

        InlineSectionDivider(title: "Earlier")
    }
    .background(ClawColors.backgroundPrimary)
}
