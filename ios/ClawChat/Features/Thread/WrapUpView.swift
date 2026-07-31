// WrapUpView.swift
// ClawChat – Full wrap-up report view

import SwiftUI

struct WrapUpView: View {
    let wrapUp: ThreadWrapUp
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ZStack {
                ClawColors.backgroundPrimary.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: ClawSpacing.lg) {
                        // Status badge
                        if wrapUp.status != .ready {
                            statusBanner
                        }

                        // Summary
                        sectionCard(title: "Summary", icon: "text.quote") {
                            Text(wrapUp.summary.isEmpty ? "Generating summary…" : wrapUp.summary)
                                .font(.system(size: 15))
                                .foregroundStyle(ClawColors.textPrimary)
                                .fixedSize(horizontal: false, vertical: true)
                        }

                        // Key Decisions
                        if !wrapUp.keyDecisions.isEmpty {
                            sectionCard(title: "Key Decisions", icon: "checkmark.seal.fill") {
                                VStack(alignment: .leading, spacing: 8) {
                                    ForEach(Array(wrapUp.keyDecisions.enumerated()), id: \.offset) { _, decision in
                                        HStack(alignment: .top, spacing: 8) {
                                            Circle()
                                                .fill(ClawColors.accent)
                                                .frame(width: 6, height: 6)
                                                .padding(.top, 6)
                                            Text(decision)
                                                .font(.system(size: 14))
                                                .foregroundStyle(ClawColors.textPrimary)
                                                .fixedSize(horizontal: false, vertical: true)
                                        }
                                    }
                                }
                            }
                        }

                        // Action Items
                        if !wrapUp.actionItems.isEmpty {
                            sectionCard(title: "Action Items", icon: "arrow.right.circle.fill") {
                                VStack(alignment: .leading, spacing: 8) {
                                    ForEach(Array(wrapUp.actionItems.enumerated()), id: \.offset) { _, item in
                                        HStack(alignment: .top, spacing: 8) {
                                            Image(systemName: "square")
                                                .font(.system(size: 13))
                                                .foregroundStyle(ClawColors.accentOrange)
                                                .padding(.top, 2)
                                            Text(item)
                                                .font(.system(size: 14))
                                                .foregroundStyle(ClawColors.textPrimary)
                                                .fixedSize(horizontal: false, vertical: true)
                                        }
                                    }
                                }
                            }
                        }

                        // Participants
                        if !wrapUp.participantSummaries.isEmpty {
                            sectionCard(title: "Participants", icon: "person.2.fill") {
                                VStack(alignment: .leading, spacing: 12) {
                                    ForEach(wrapUp.participantSummaries, id: \.participantId) { p in
                                        VStack(alignment: .leading, spacing: 4) {
                                            HStack {
                                                Text(p.name)
                                                    .font(.system(size: 14, weight: .semibold))
                                                    .foregroundStyle(ClawColors.textPrimary)
                                                Spacer()
                                                Text("\(p.messageCount) msg")
                                                    .font(.system(size: 12))
                                                    .foregroundStyle(ClawColors.textTertiary)
                                            }
                                            Text(p.contributionSummary)
                                                .font(.system(size: 13))
                                                .foregroundStyle(ClawColors.textSecondary)
                                                .fixedSize(horizontal: false, vertical: true)
                                        }
                                    }
                                }
                            }
                        }

                        // Period
                        sectionCard(title: "Period", icon: "calendar") {
                            HStack {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text("From")
                                        .font(.system(size: 11))
                                        .foregroundStyle(ClawColors.textTertiary)
                                    Text(wrapUp.periodStart.formatted(.dateTime.month().day().hour().minute()))
                                        .font(.system(size: 14))
                                        .foregroundStyle(ClawColors.textPrimary)
                                }
                                Spacer()
                                VStack(alignment: .trailing, spacing: 4) {
                                    Text("To")
                                        .font(.system(size: 11))
                                        .foregroundStyle(ClawColors.textTertiary)
                                    Text(wrapUp.periodEnd.formatted(.dateTime.month().day().hour().minute()))
                                        .font(.system(size: 14))
                                        .foregroundStyle(ClawColors.textPrimary)
                                }
                            }
                        }
                    }
                    .padding(.horizontal, ClawSpacing.lg)
                    .padding(.top, ClawSpacing.md)
                    .padding(.bottom, ClawSpacing.xxxl)
                }
            }
            .navigationTitle("Wrap-Up Report")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(ClawColors.backgroundPrimary, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                        .foregroundStyle(ClawColors.accent)
                }
            }
        }
        .preferredColorScheme(.dark)
        .presentationBackground(ClawColors.backgroundPrimary)
    }

    private var statusBanner: some View {
        HStack(spacing: 8) {
            if wrapUp.status == .generating || wrapUp.status == .pending {
                ProgressView()
                    .progressViewStyle(CircularProgressViewStyle(tint: ClawColors.accent))
                    .scaleEffect(0.8)
                Text("Generating wrap-up…")
                    .font(.system(size: 13))
                    .foregroundStyle(ClawColors.textSecondary)
            } else if wrapUp.status == .failed {
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundStyle(ClawColors.accentRed)
                Text("Generation failed")
                    .font(.system(size: 13))
                    .foregroundStyle(ClawColors.accentRed)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(ClawColors.backgroundCard)
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(ClawColors.separator, lineWidth: 1))
    }

    @ViewBuilder
    private func sectionCard<Content: View>(title: String, icon: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(ClawColors.accent)
                Text(title)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(ClawColors.textSecondary)
                    .textCase(.uppercase)
            }
            content()
        }
        .padding(ClawSpacing.md)
        .background(ClawColors.backgroundCard)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(ClawColors.separator, lineWidth: 1))
    }
}
