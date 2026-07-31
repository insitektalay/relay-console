// EmbeddedCardViews.swift
// ClawChat – Embedded work card views for all card types
// Swift 6, iOS 18, SwiftUI

import SwiftUI

// MARK: - EmbeddedCardView

struct EmbeddedCardView: View {
    let card: EmbeddedCard
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 0) {
                // Left accent stripe
                Rectangle()
                    .fill(cardColor)
                    .frame(width: 4)
                    .clipShape(
                        RoundedCorner(radius: 12, corners: [.topLeft, .bottomLeft])
                    )

                VStack(alignment: .leading, spacing: 8) {
                    // Type badge + status
                    HStack(spacing: 6) {
                        Image(systemName: cardIcon)
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(cardColor)
                        Text(cardTypeName)
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(cardColor)
                        Spacer()
                        if let status = card.status {
                            StatusPill(text: status)
                        }
                    }

                    // Title
                    Text(card.title)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(ClawColors.textPrimary)
                        .lineLimit(2)
                        .fixedSize(horizontal: false, vertical: true)

                    // Subtitle
                    if let subtitle = card.subtitle {
                        Text(subtitle)
                            .font(.system(size: 13))
                            .foregroundStyle(ClawColors.textSecondary)
                            .lineLimit(2)
                            .fixedSize(horizontal: false, vertical: true)
                    }

                    // Metadata grid
                    if !card.metadata.isEmpty {
                        MetadataGridView(data: card.metadata)
                    }

                    // Tap hint
                    HStack(spacing: 3) {
                        Spacer()
                        Text("View details")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(cardColor)
                        Image(systemName: "chevron.right")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(cardColor)
                    }
                    .padding(.top, 2)
                }
                .padding(12)
            }
        }
        .buttonStyle(.plain)
        .background(ClawColors.backgroundCard)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(ClawColors.separator, lineWidth: 1)
        )
        .frame(maxWidth: 300)
    }

    // MARK: - Card Properties

    var cardColor: Color {
        switch card.type {
        case .task:        return Color(hex: "#0A84FF")
        case .approval:    return Color(hex: "#FF9F0A")
        case .incident:    return Color(hex: "#FF453A")
        case .report:      return Color(hex: "#BF5AF2")
        case .audit:       return Color(hex: "#40C8E0")
        case .handoff:     return Color(hex: "#30D158")
        case .workLog:     return Color(hex: "#8E8E93")
        case .performance: return Color(hex: "#BF5AF2")
        case .alert:       return Color(hex: "#FF453A")
        case .runResult:   return Color(hex: "#0A84FF")
        case .paperclip:   return Color(hex: "#40C8E0")
        }
    }

    var cardIcon: String {
        switch card.type {
        case .task:        return "checkmark.circle.fill"
        case .approval:    return "checkmark.shield.fill"
        case .incident:    return "exclamationmark.triangle.fill"
        case .report:      return "chart.bar.fill"
        case .audit:       return "magnifyingglass.circle.fill"
        case .handoff:     return "arrow.right.circle.fill"
        case .workLog:     return "list.bullet.rectangle.fill"
        case .performance: return "chart.line.uptrend.xyaxis"
        case .alert:       return "bell.badge.fill"
        case .runResult:   return "play.circle.fill"
        case .paperclip:   return "paperclip.circle.fill"
        }
    }

    var cardTypeName: String {
        switch card.type {
        case .task:        return "Task"
        case .approval:    return "Approval"
        case .incident:    return "Incident"
        case .report:      return "Report"
        case .audit:       return "Audit"
        case .handoff:     return "Handoff"
        case .workLog:     return "Work Log"
        case .performance: return "Performance"
        case .alert:       return "Alert"
        case .runResult:   return "Run Result"
        case .paperclip:   return "Paperclip Issue"
        }
    }
}

// MARK: - MetadataGridView

struct MetadataGridView: View {
    let data: [String: String]

    // Sort keys for deterministic display
    private var sortedPairs: [(key: String, value: String)] {
        data.sorted { $0.key < $1.key }.map { (key: $0.key, value: $0.value) }
    }

    // Split into rows of two columns
    private var rows: [[(key: String, value: String)]] {
        stride(from: 0, to: sortedPairs.count, by: 2).map { i in
            let end = min(i + 2, sortedPairs.count)
            return Array(sortedPairs[i..<end])
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Rectangle()
                .fill(ClawColors.separator)
                .frame(height: 0.5)
                .padding(.vertical, 2)

            ForEach(rows.indices, id: \.self) { rowIndex in
                HStack(spacing: 8) {
                    ForEach(rows[rowIndex], id: \.key) { pair in
                        MetadataCell(key: pair.key, value: pair.value)
                        if rows[rowIndex].count == 1 {
                            Spacer()
                        }
                    }
                }
            }
        }
    }
}

// MARK: - MetadataCell

private struct MetadataCell: View {
    let key: String
    let value: String

    private var formattedKey: String {
        key
            .replacingOccurrences(of: "_", with: " ")
            .split(separator: " ")
            .map { $0.prefix(1).uppercased() + $0.dropFirst() }
            .joined(separator: " ")
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(formattedKey)
                .font(.system(size: 10, weight: .medium))
                .foregroundStyle(ClawColors.textTertiary)
                .lineLimit(1)
            Text(value)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(ClawColors.textPrimary)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Preview

#Preview {
    ScrollView {
        VStack(spacing: 16) {
            EmbeddedCardView(
                card: EmbeddedCard(
                    type: .task,
                    title: "Compile weekly pipeline report for Q1",
                    subtitle: "Assigned to Aria · Sales Team",
                    status: "running",
                    metadata: ["Duration": "4m 32s", "Success": "98%", "Runs": "12"],
                    actionUrl: nil, referenceId: "task-1", color: nil
                ),
                onTap: {}
            )

            EmbeddedCardView(
                card: EmbeddedCard(
                    type: .approval,
                    title: "Approve outbound email campaign to 2,400 contacts",
                    subtitle: "Requested by Orion · Marketing Team",
                    status: "pending",
                    metadata: ["Risk": "High", "Expires": "2h"],
                    actionUrl: nil, referenceId: "app-1", color: nil
                ),
                onTap: {}
            )

            EmbeddedCardView(
                card: EmbeddedCard(
                    type: .incident,
                    title: "API rate limit exceeded on Salesforce connector",
                    subtitle: "Triggered during lead sync task",
                    status: "investigating",
                    metadata: ["Severity": "High", "Opened": "14:23"],
                    actionUrl: nil, referenceId: "inc-1", color: nil
                ),
                onTap: {}
            )

            EmbeddedCardView(
                card: EmbeddedCard(
                    type: .handoff,
                    title: "Handover from Aria to Orion",
                    subtitle: "3 active tasks transferred",
                    status: "completed",
                    metadata: ["Tasks": "3", "Time": "09:00"],
                    actionUrl: nil, referenceId: "ho-1", color: nil
                ),
                onTap: {}
            )

            EmbeddedCardView(
                card: EmbeddedCard(
                    type: .runResult,
                    title: "Run #47 – Weekly Outreach Automation",
                    subtitle: nil,
                    status: "completed",
                    metadata: ["Duration": "2m 14s", "Tokens": "4,832", "Cost": "$0.04"],
                    actionUrl: nil, referenceId: "run-47", color: nil
                ),
                onTap: {}
            )
        }
        .padding(16)
    }
    .background(ClawColors.backgroundPrimary)
}
