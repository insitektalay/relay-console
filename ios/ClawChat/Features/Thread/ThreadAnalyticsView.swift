// ThreadAnalyticsView.swift
// ClawChat – Thread analytics and export

import SwiftUI

@MainActor
@Observable
final class ThreadAnalyticsViewModel {
    var analytics: ThreadAnalytics?
    var gapMinutes = 30
    var isLoading = false
    var error: String?
    var shareURL: URL?

    func load(threadId: String) async {
        isLoading = true
        defer { isLoading = false }
        do {
            analytics = try await APIClient.shared.request(.threadAnalytics(threadId: threadId, activityGapMinutes: gapMinutes, agentRepeatSessionId: nil))
            error = nil
            Telemetry.shared.breadcrumb("Loaded thread analytics", category: "thread.analytics", attributes: ["threadId": threadId])
        } catch {
            self.error = error.localizedDescription
            Telemetry.shared.capture(error: error, attributes: ["operation": "thread.analytics.load", "threadId": threadId])
        }
    }

    func exportJSON() {
        guard let analytics else { return }
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        guard let data = try? encoder.encode(analytics) else { return }
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("\(analytics.threadTitle)-analytics.json")
        try? data.write(to: url)
        shareURL = url
        Telemetry.shared.event("thread.analytics.exported", attributes: ["format": "json", "threadId": analytics.threadId])
    }

    func exportCSV() {
        guard let analytics else { return }
        var rows = ["section,key,value"]
        rows.append("summary,thread_id,\(csv(analytics.threadId))")
        rows.append("summary,thread_title,\(csv(analytics.threadTitle))")
        rows.append("summary,total_messages,\(analytics.totalMessages)")
        rows.append("summary,total_sessions,\(analytics.totalSessions)")
        rows.append("summary,active_duration_minutes,\(analytics.activeDurationMinutes)")
        for sender in analytics.messageCountsBySender {
            rows.append("sender,\(csv(sender.senderName)),\(sender.messageCount)")
        }
        for session in analytics.sessionBreakdown {
            rows.append("session,\(csv(session.threadSessionId)),messages:\(session.messageCount) repeated_agent:\(session.repeatedAgentMessageCount)")
        }
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("\(analytics.threadTitle)-analytics.csv")
        try? rows.joined(separator: "\n").data(using: .utf8)?.write(to: url)
        shareURL = url
        Telemetry.shared.event("thread.analytics.exported", attributes: ["format": "csv", "threadId": analytics.threadId])
    }

    private func csv(_ value: String) -> String {
        "\"\(value.replacingOccurrences(of: "\"", with: "\"\""))\""
    }
}

struct ThreadAnalyticsView: View {
    let thread: Thread
    @State private var vm = ThreadAnalyticsViewModel()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: ClawSpacing.lg) {
                if vm.isLoading && vm.analytics == nil {
                    MissionPanel {
                        HStack(spacing: ClawSpacing.sm) {
                            ProgressView().tint(ClawColors.accent)
                            Text("Loading analytics...")
                                .font(.system(size: 14, weight: .medium))
                                .foregroundStyle(ClawColors.textPrimary)
                        }
                    }
                }

                if let analytics = vm.analytics {
                    MissionPanel {
                        MissionSectionHeader(title: "Thread Analytics", subtitle: analytics.threadTitle)
                        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: ClawSpacing.sm) {
                            metric("Messages", "\(analytics.totalMessages)", ClawColors.accent)
                            metric("Sessions", "\(analytics.totalSessions)", ClawColors.accentGreen)
                            metric("Senders", "\(analytics.totalSenders)", ClawColors.accentTeal)
                            metric("Thread Length", formatDuration(analytics.elapsedMinutes), ClawColors.accentPurple)
                            metric("Your Messages", "\(analytics.requestingUserMessageCount)", ClawColors.accent)
                            metric("Agent Messages", "\(analytics.agentMessageCount)", ClawColors.accentGreen)
                            metric("User Messages", "\(analytics.userMessageCount)", ClawColors.accentTeal)
                            metric("Active Windows", "\(analytics.activePeriods.count)", ClawColors.accentOrange)
                        }
                        Stepper(
                            "Active gap: \(vm.gapMinutes) minutes",
                            value: Binding(
                                get: { vm.gapMinutes },
                                set: { value in
                                    vm.gapMinutes = value
                                    _Concurrency.Task { await vm.load(threadId: thread.id) }
                                }
                            ),
                            in: 1...1440
                        )
                            .font(.system(size: 14, weight: .medium))
                            .foregroundStyle(ClawColors.textPrimary)
                        if let first = analytics.firstMessageAt {
                            MissionMetaRow(label: "First message", value: first.formatted(date: .abbreviated, time: .shortened), icon: "arrow.down.circle")
                        }
                        if let last = analytics.lastMessageAt {
                            MissionMetaRow(label: "Last message", value: last.formatted(date: .abbreviated, time: .shortened), icon: "arrow.up.circle")
                        }
                    }

                    MissionPanel {
                        MissionSectionHeader(title: "Messages By Sender", subtitle: "Sorted by total messages sent in this thread.")
                        if analytics.messageCountsBySender.isEmpty {
                            Text("No sender breakdown is available.")
                                .font(.system(size: 13))
                                .foregroundStyle(ClawColors.textPrimary.opacity(0.76))
                        } else {
                            ForEach(analytics.messageCountsBySender, id: \.senderKey) { sender in
                                VStack(alignment: .leading, spacing: 4) {
                                    HStack {
                                        Text(sender.senderName)
                                            .font(.system(size: 14, weight: .semibold))
                                            .foregroundStyle(ClawColors.textPrimary)
                                        Spacer()
                                        Text("\(sender.messageCount)")
                                            .font(.system(size: 18, weight: .semibold))
                                            .foregroundStyle(ClawColors.textPrimary)
                                    }
                                    Text("\(sender.senderKind.capitalized) · \(sender.sessionCount) sessions · \(Int((sender.shareOfMessages * 100).rounded()))% of thread")
                                        .font(.caption)
                                        .foregroundStyle(ClawColors.textPrimary.opacity(0.76))
                                }
                                Divider().background(ClawColors.separator)
                            }
                        }
                    }

                    MissionPanel {
                        MissionSectionHeader(title: "Active Periods", subtitle: "A new active window starts when messages are more than \(analytics.activityGapMinutes) minutes apart.")
                        if analytics.activePeriods.isEmpty {
                            Text("No active periods found.")
                                .font(.system(size: 13))
                                .foregroundStyle(ClawColors.textPrimary.opacity(0.76))
                        } else {
                            ForEach(Array(analytics.activePeriods.enumerated()), id: \.offset) { index, period in
                                VStack(alignment: .leading, spacing: 3) {
                                    Text("Window \(index + 1)")
                                        .font(.system(size: 14, weight: .medium))
                                        .foregroundStyle(ClawColors.textPrimary)
                                    Text("\(period.messageCount) messages · \(period.uniqueSenderCount) senders · \(formatDuration(period.durationMinutes))")
                                        .font(.caption)
                                        .foregroundStyle(ClawColors.textPrimary.opacity(0.76))
                                    Text("\(period.startedAt.formatted(date: .abbreviated, time: .shortened)) to \(period.endedAt.formatted(date: .abbreviated, time: .shortened))")
                                        .font(.caption)
                                        .foregroundStyle(ClawColors.textPrimary.opacity(0.64))
                                }
                                Divider().background(ClawColors.separator)
                            }
                        }
                    }

                    MissionPanel {
                        MissionSectionHeader(title: "Session Breakdown", subtitle: "Wrapped-up chat cycles alongside the current session.")
                        if analytics.sessionBreakdown.isEmpty {
                            Text("No sessions are available for this thread.")
                                .font(.system(size: 13))
                                .foregroundStyle(ClawColors.textPrimary.opacity(0.76))
                        } else {
                            ForEach(analytics.sessionBreakdown, id: \.threadSessionId) { session in
                            VStack(alignment: .leading, spacing: 6) {
                                HStack {
                                    Text("Session \(session.sequenceNumber.map(String.init) ?? "-")")
                                            .foregroundStyle(ClawColors.textPrimary)
                                        .font(.system(size: 14, weight: .semibold))
                                    Spacer()
                                    MissionBadge(text: session.agentRepeatAnalysisStatus, color: session.agentRepeatAnalysisStatus == "failed" ? ClawColors.accentRed : ClawColors.accent)
                                }
                                    Text("\(session.messageCount) messages · \(session.agentMessageCount) agent · \(session.requestingUserMessageCount) yours")
                                        .font(.caption)
                                        .foregroundStyle(ClawColors.textPrimary.opacity(0.76))
                                Text("Repeated \(session.repeatedAgentMessageCount), cross-agent \(session.repeatedCrossAgentMessageCount)")
                                    .font(.caption)
                                        .foregroundStyle(ClawColors.textPrimary.opacity(0.76))
                                    if let error = session.agentRepeatAnalysisErrorMessage, !error.isEmpty {
                                        Text(error)
                                            .font(.caption)
                                            .foregroundStyle(ClawColors.accentRed)
                                    }
                                ForEach(Array(session.repeatedAgentMessageGroups.prefix(3).enumerated()), id: \.offset) { _, group in
                                    Text(group.representativeMessage)
                                        .font(.caption)
                                            .foregroundStyle(ClawColors.textPrimary.opacity(0.64))
                                        .lineLimit(2)
                                }
                            }
                            Divider().background(ClawColors.separator)
                        }
                        }
                    }
                }

                if let error = vm.error {
                    MissionErrorPanel(message: error)
                }
            }
            .padding(ClawSpacing.lg)
        }
        .missionScreenBackground()
        .navigationTitle("Analytics")
        .toolbar {
            ToolbarItemGroup(placement: .topBarTrailing) {
                Button("CSV") { vm.exportCSV() }
                Button("JSON") { vm.exportJSON() }
            }
        }
        .sheet(item: $vm.shareURL) { url in
            ShareLink(item: url).padding().presentationDetents([.medium])
        }
        .task { await vm.load(threadId: thread.id) }
    }

    private func metric(_ title: String, _ value: String, _ color: Color) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title.uppercased())
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(ClawColors.textPrimary.opacity(0.74))
            Text(value)
                .font(.system(size: 22, weight: .semibold))
                .foregroundStyle(color)
        }
        .padding(ClawSpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(ClawColors.backgroundSurface)
        .clipShape(RoundedRectangle(cornerRadius: ClawRadius.card))
        .overlay(RoundedRectangle(cornerRadius: ClawRadius.card).stroke(ClawColors.separator, lineWidth: 1))
    }

    private func formatDuration(_ minutes: Double) -> String {
        if minutes < 60 { return "\(Int(minutes.rounded()))m" }
        let hours = Int(minutes / 60)
        let remainder = Int(minutes.rounded()) % 60
        return remainder == 0 ? "\(hours)h" : "\(hours)h \(remainder)m"
    }
}
