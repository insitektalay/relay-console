// ClawCard.swift
// ClawChat

import SwiftUI

// MARK: - Card style

enum RelayCardStyle {
    case `default`
    case compact
    case expanded
}

// MARK: - Metadata item

struct CardMetaItem: Identifiable {
    let id = UUID()
    let label: String
    let value: String
    var icon: String? = nil
    var valueColor: Color? = nil
}

// MARK: - ClawCard

struct RelayCard: View {
    var style: RelayCardStyle = .default
    var accentColor: Color = ClawColors.accent
    var title: String
    var subtitle: String? = nil
    var statusText: String? = nil
    var statusColor: Color = ClawColors.accent
    var metadata: [CardMetaItem] = []
    var onTap: (() -> Void)? = nil

    var body: some View {
        Button(action: { onTap?() }) {
            HStack(spacing: 0) {
                // Left accent stripe
                RoundedRectangle(cornerRadius: 2)
                    .fill(accentColor)
                    .frame(width: 3)
                    .padding(.vertical, style == .compact ? 0 : 4)

                VStack(alignment: .leading, spacing: cardSpacing) {
                    // Header row
                    HStack(alignment: .top) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(title)
                                .font(ClawFonts.cardTitle)
                                .foregroundStyle(ClawColors.textPrimary)
                                .lineLimit(style == .compact ? 1 : 2)

                            if let subtitle, style != .compact {
                                Text(subtitle)
                                    .font(ClawFonts.cardBody)
                                    .foregroundStyle(ClawColors.textSecondary)
                                    .lineLimit(style == .expanded ? 4 : 2)
                            }
                        }

                        Spacer()

                        if let statusText {
                            statusChip(text: statusText, color: statusColor)
                        }
                    }

                    // Metadata grid
                    if !metadata.isEmpty && style != .compact {
                        metadataGrid
                    }

                    // Compact subtitle (shown only in compact mode below title row)
                    if let subtitle, style == .compact {
                        Text(subtitle)
                            .font(ClawFonts.caption)
                            .foregroundStyle(ClawColors.textSecondary)
                            .lineLimit(1)
                    }
                }
                .padding(.leading, ClawSpacing.md)
                .padding(.trailing, ClawSpacing.md)
                .padding(.vertical, style == .compact ? ClawSpacing.sm : ClawSpacing.md)
            }
        }
        .buttonStyle(.plain)
        .frame(minHeight: RelayMetrics.minimumHitTarget)
        .background(ClawColors.backgroundCard)
        .cornerRadius(ClawRadius.card)
        .overlay(
            RoundedRectangle(cornerRadius: ClawRadius.card)
                .stroke(ClawColors.borderStandard, lineWidth: 1)
        )
        .contentShape(RoundedRectangle(cornerRadius: ClawRadius.card))
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isButton)
    }

    // MARK: - Helpers

    private var cardSpacing: CGFloat {
        switch style {
        case .compact:  return ClawSpacing.xs
        case .default:  return ClawSpacing.sm
        case .expanded: return ClawSpacing.md
        }
    }

    private func statusChip(text: String, color: Color) -> some View {
        Text(text)
            .font(ClawFonts.label)
            .foregroundStyle(color)
            .padding(.horizontal, ClawSpacing.sm)
            .padding(.vertical, 3)
            .background(color.opacity(0.15))
            .clipShape(Capsule())
    }

    @ViewBuilder
    private var metadataGrid: some View {
        let columns = style == .expanded ? 3 : 2
        let rows = metadata.chunked(into: columns)

        VStack(alignment: .leading, spacing: ClawSpacing.xs) {
            ForEach(rows.indices, id: \.self) { rowIndex in
                HStack(spacing: ClawSpacing.xl) {
                    ForEach(rows[rowIndex]) { item in
                        metaCell(item: item)
                    }
                    Spacer()
                }
            }
        }
        .padding(.top, ClawSpacing.xs)
    }

    private func metaCell(item: CardMetaItem) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            HStack(spacing: 3) {
                if let icon = item.icon {
                    Image(systemName: icon)
                        .font(.system(size: 9))
                        .foregroundStyle(ClawColors.textTertiary)
                }
                Text(item.label)
                    .font(.system(size: 10, weight: .medium))
                    .foregroundStyle(ClawColors.textTertiary)
            }
            Text(item.value)
                .font(ClawFonts.label)
                .foregroundStyle(item.valueColor ?? ClawColors.textPrimary)
        }
    }
}

typealias ClawCardStyle = RelayCardStyle
typealias ClawCard = RelayCard

// MARK: - Array chunking helper

private extension Array {
    func chunked(into size: Int) -> [[Element]] {
        stride(from: 0, to: count, by: size).map {
            Array(self[$0..<Swift.min($0 + size, count)])
        }
    }
}

// MARK: - Preview

#Preview {
    ScrollView {
        VStack(spacing: ClawSpacing.md) {
            ClawCard(
                style: .default,
                accentColor: ClawColors.accent,
                title: "Process invoice batch",
                subtitle: "Assigned to FinanceBot — due in 2h",
                statusText: "Running",
                statusColor: ClawColors.accentGreen,
                metadata: [
                    CardMetaItem(label: "Priority", value: "High", icon: "arrow.up", valueColor: ClawColors.accentOrange),
                    CardMetaItem(label: "Progress", value: "67%"),
                    CardMetaItem(label: "Agent", value: "FinanceBot"),
                    CardMetaItem(label: "Budget", value: "$0.42"),
                ],
                onTap: {}
            )

            ClawCard(
                style: .compact,
                accentColor: ClawColors.accentOrange,
                title: "Approve external API access",
                statusText: "Pending",
                statusColor: ClawColors.accentOrange,
                onTap: {}
            )

            ClawCard(
                style: .expanded,
                accentColor: ClawColors.accentRed,
                title: "Authentication service degraded",
                subtitle: "Multiple login failures detected across 3 agents. Auto-mitigation in progress.",
                statusText: "Investigating",
                statusColor: ClawColors.accentOrange,
                metadata: [
                    CardMetaItem(label: "Severity", value: "High", valueColor: ClawColors.accentRed),
                    CardMetaItem(label: "Opened", value: "14:22"),
                    CardMetaItem(label: "Affected", value: "3 agents"),
                    CardMetaItem(label: "SLA", value: "2h 38m left"),
                ],
                onTap: {}
            )
        }
        .padding()
    }
    .background(ClawColors.backgroundPrimary)
}
