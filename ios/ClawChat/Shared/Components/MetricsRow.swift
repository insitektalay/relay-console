// MetricsRow.swift
// ClawChat

import SwiftUI

// MARK: - Trend direction

enum TrendDirection {
    case up, down, neutral

    var icon: String {
        switch self {
        case .up:      return "arrow.up.right"
        case .down:    return "arrow.down.right"
        case .neutral: return "minus"
        }
    }

    func color(higherIsBetter: Bool) -> Color {
        switch self {
        case .up:      return higherIsBetter ? ClawColors.accentGreen : ClawColors.accentRed
        case .down:    return higherIsBetter ? ClawColors.accentRed   : ClawColors.accentGreen
        case .neutral: return ClawColors.textTertiary
        }
    }
}

// MARK: - MetricTile model

struct MetricTileData: Identifiable {
    let id = UUID()
    var label: String
    var value: String
    var subValue: String? = nil
    var trend: TrendDirection? = nil
    var trendLabel: String? = nil
    var higherIsBetter: Bool = true
    var accentColor: Color = ClawColors.accent
    var icon: String? = nil
}

// MARK: - MetricTile

struct RelayMetricTile: View {
    let data: MetricTileData
    var onTap: (() -> Void)? = nil

    var body: some View {
        Button(action: { onTap?() }) {
            VStack(alignment: .leading, spacing: ClawSpacing.sm) {
                // Icon + label row
                HStack(spacing: ClawSpacing.xs) {
                    if let icon = data.icon {
                        Image(systemName: icon)
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(data.accentColor)
                    }
                    Text(data.label)
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(ClawColors.textSecondary)
                        .lineLimit(1)
                }

                // Primary value
                Text(data.value)
                    .font(.system(.title3, design: .default, weight: .semibold))
                    .foregroundStyle(ClawColors.textPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)

                // Sub-value + trend
                HStack(spacing: ClawSpacing.xs) {
                    if let subValue = data.subValue {
                        Text(subValue)
                            .font(ClawFonts.caption)
                            .foregroundStyle(ClawColors.textTertiary)
                    }

                    Spacer()

                    if let trend = data.trend {
                        HStack(spacing: 2) {
                            Image(systemName: trend.icon)
                                .font(.system(size: 10, weight: .bold))
                            if let trendLabel = data.trendLabel {
                                Text(trendLabel)
                                    .font(.system(size: 11, weight: .medium))
                            }
                        }
                        .foregroundStyle(trend.color(higherIsBetter: data.higherIsBetter))
                    }
                }
            }
            .padding(ClawSpacing.md)
            .frame(minWidth: 100, alignment: .leading)
            .background(ClawColors.backgroundCard)
            .cornerRadius(ClawRadius.card)
            .overlay(
                RoundedRectangle(cornerRadius: ClawRadius.card)
                    .stroke(ClawColors.borderStandard, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .frame(minHeight: RelayMetrics.minimumHitTarget)
        .accessibilityLabel("\(data.label): \(data.value)")
    }
}

typealias MetricTile = RelayMetricTile

// MARK: - MetricsRow

struct MetricsRow: View {
    let tiles: [MetricTileData]
    var onTileTap: ((MetricTileData) -> Void)? = nil

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: ClawSpacing.sm) {
                ForEach(tiles) { tile in
                    MetricTile(data: tile, onTap: onTileTap.map { cb in { cb(tile) } })
                }
            }
            .padding(.horizontal, ClawSpacing.lg)
            .padding(.vertical, ClawSpacing.xs)
        }
    }
}

// MARK: - MetricsGrid (2-column fixed grid variant)

struct MetricsGrid: View {
    let tiles: [MetricTileData]

    private let columns = [
        GridItem(.flexible(), spacing: ClawSpacing.sm),
        GridItem(.flexible(), spacing: ClawSpacing.sm),
    ]

    var body: some View {
        LazyVGrid(columns: columns, spacing: ClawSpacing.sm) {
            ForEach(tiles) { tile in
                MetricTile(data: tile)
            }
        }
    }
}

// MARK: - Preview

#Preview {
    let sampleTiles: [MetricTileData] = [
        MetricTileData(
            label: "Tasks Completed",
            value: "142",
            subValue: "Today",
            trend: .up,
            trendLabel: "+12%",
            higherIsBetter: true,
            accentColor: ClawColors.accentGreen,
            icon: "checkmark.circle.fill"
        ),
        MetricTileData(
            label: "Success Rate",
            value: "94.2%",
            subValue: "7-day avg",
            trend: .up,
            trendLabel: "+2.1%",
            higherIsBetter: true,
            accentColor: ClawColors.accent,
            icon: "chart.line.uptrend.xyaxis"
        ),
        MetricTileData(
            label: "Incidents",
            value: "3",
            subValue: "Open",
            trend: .down,
            trendLabel: "-1",
            higherIsBetter: false,
            accentColor: ClawColors.accentRed,
            icon: "exclamationmark.triangle.fill"
        ),
        MetricTileData(
            label: "Avg Completion",
            value: "4.2m",
            trend: .neutral,
            higherIsBetter: false,
            accentColor: ClawColors.accentOrange,
            icon: "clock.fill"
        ),
        MetricTileData(
            label: "Budget Used",
            value: "$12.40",
            subValue: "of $50.00",
            trend: .up,
            trendLabel: "+$0.80",
            higherIsBetter: false,
            accentColor: ClawColors.accentPurple,
            icon: "dollarsign.circle.fill"
        ),
    ]

    ScrollView {
        VStack(alignment: .leading, spacing: ClawSpacing.xl) {
            Text("METRICS ROW")
                .font(ClawFonts.sectionHeader)
                .foregroundStyle(ClawColors.textSecondary)
                .padding(.horizontal, ClawSpacing.lg)

            MetricsRow(tiles: sampleTiles)

            Text("METRICS GRID")
                .font(ClawFonts.sectionHeader)
                .foregroundStyle(ClawColors.textSecondary)
                .padding(.horizontal, ClawSpacing.lg)

            MetricsGrid(tiles: sampleTiles)
                .padding(.horizontal, ClawSpacing.lg)
        }
        .padding(.vertical, ClawSpacing.lg)
    }
    .background(ClawColors.backgroundPrimary)
}
