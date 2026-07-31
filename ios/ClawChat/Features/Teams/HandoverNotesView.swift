// HandoverNotesView.swift
// ClawChat – Team handover notes

import SwiftUI

// MARK: - ViewModel

@Observable
final class HandoverNotesViewModel {
    var teamId: String
    var notes: [HandoverNote] = []
    var agentMap: [String: Agent] = [:]
    var selectedTab: HandoverTab = .pending
    var isLoading = false
    var error: String?

    var pendingNotes: [HandoverNote] {
        notes.filter { $0.toTeamId == teamId && $0.acknowledgedAt == nil }
    }

    var acknowledgedNotes: [HandoverNote] {
        notes.filter { $0.acknowledgedAt != nil || $0.toTeamId != teamId }
    }

    init(teamId: String) {
        self.teamId = teamId
    }

    @MainActor
    func load() async {
        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            let targetTeamId = teamId
            async let handovers: PaginatedResponse<HandoverNote> = APIClient.shared.requestPaginated(
                .teamHandovers(teamId: targetTeamId, page: 1)
            )
            async let agents: PaginatedResponse<Agent> = APIClient.shared.requestPaginated(
                .teamAgents(teamId: targetTeamId, page: 1)
            )
            let (handoverResponse, agentResponse) = try await (handovers, agents)
            notes = handoverResponse.data
            agentMap = Dictionary(uniqueKeysWithValues: agentResponse.data.map { ($0.id, $0) })
        } catch {
            self.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
            notes = []
            agentMap = [:]
        }
    }

    @MainActor
    private func loadMockData() async {
        let now = Date()

        let agents: [Agent] = [
            Agent(id: "a1", name: "Alpha Bot", role: "Lead Analyst", avatarUrl: nil, status: .onDuty,
                  teamId: teamId, departmentId: nil, companyId: nil, workspaceId: "ws1",
                  managerId: nil, description: nil, capabilities: [], workingHoursMode: .twentyFourSeven,
                  timezone: "UTC", createdAt: now, updatedAt: now, currentTaskId: nil,
                  tasksCompletedToday: 12, successRate: 0.94, avgCompletionMinutes: 8,
                  totalMinutesWorked: 480, budgetUsed: 1.20, budgetLimit: 10.0),
            Agent(id: "a2", name: "Beta Bot", role: "Processor", avatarUrl: nil, status: .busy,
                  teamId: teamId, departmentId: nil, companyId: nil, workspaceId: "ws1",
                  managerId: nil, description: nil, capabilities: [], workingHoursMode: .twentyFourSeven,
                  timezone: "UTC", createdAt: now, updatedAt: now, currentTaskId: "t1",
                  tasksCompletedToday: 8, successRate: 0.88, avgCompletionMinutes: 12,
                  totalMinutesWorked: 360, budgetUsed: 0.90, budgetLimit: 10.0),
            Agent(id: "a3", name: "Gamma Bot", role: "Reviewer", avatarUrl: nil, status: .offDuty,
                  teamId: "other-team", departmentId: nil, companyId: nil, workspaceId: "ws1",
                  managerId: nil, description: nil, capabilities: [], workingHoursMode: .scheduled,
                  timezone: "UTC", createdAt: now, updatedAt: now, currentTaskId: nil,
                  tasksCompletedToday: 5, successRate: 0.96, avgCompletionMinutes: 6,
                  totalMinutesWorked: 240, budgetUsed: 0.50, budgetLimit: 10.0),
        ]
        agentMap = Dictionary(uniqueKeysWithValues: agents.map { ($0.id, $0) })

        notes = [
            HandoverNote(id: "h1", fromAgentId: "a3", toAgentId: nil, toTeamId: teamId,
                         content: "Invoice batch #4421 is partially complete. Items 1–200 processed successfully. Items 201–400 failed validation due to missing vendor IDs. Recommend running enrichment script before retrying.",
                         taskIds: ["t1", "t2"], createdAt: now.addingTimeInterval(-3600), acknowledgedAt: nil),
            HandoverNote(id: "h2", fromAgentId: "a1", toAgentId: "a2", toTeamId: nil,
                         content: "Compliance report flagged three discrepancies in vendor spend data. Cases documented in report-2024-12. Needs manual review before sign-off.",
                         taskIds: ["t3"], createdAt: now.addingTimeInterval(-7200),
                         acknowledgedAt: now.addingTimeInterval(-5400)),
            HandoverNote(id: "h3", fromAgentId: "a2", toAgentId: nil, toTeamId: teamId,
                         content: "Critical: External data feed disconnected at 02:14 UTC. Downstream tasks queued and waiting. ETL pipeline paused. Coordinate with infra team.",
                         taskIds: ["t4", "t5", "t6"], createdAt: now.addingTimeInterval(-900), acknowledgedAt: nil),
            HandoverNote(id: "h4", fromAgentId: "a1", toAgentId: nil, toTeamId: teamId,
                         content: "End of shift summary: all queued tasks completed, no blockers. Budget used: $1.40 today. Ready for overnight run.",
                         taskIds: [], createdAt: now.addingTimeInterval(-86400),
                         acknowledgedAt: now.addingTimeInterval(-82800)),
        ]
    }

    func acknowledge(noteId: String) {
        if let index = notes.firstIndex(where: { $0.id == noteId }) {
            notes[index].acknowledgedAt = Date()
        }
    }
}

enum HandoverTab: String, CaseIterable {
    case pending = "Pending"
    case acknowledged = "Acknowledged"
}

// MARK: - Main View

struct HandoverNotesView: View {
    @State var viewModel: HandoverNotesViewModel
    @State private var selectedNote: HandoverNote?

    init(teamId: String) {
        _viewModel = State(initialValue: HandoverNotesViewModel(teamId: teamId))
    }

    var body: some View {
        VStack(spacing: 0) {
            // Tab picker
            Picker("Tab", selection: $viewModel.selectedTab) {
                ForEach(HandoverTab.allCases, id: \.self) { tab in
                    Text(tab.rawValue).tag(tab)
                }
            }
            .pickerStyle(.segmented)
            .padding(.horizontal, ClawSpacing.lg)
            .padding(.vertical, ClawSpacing.md)

            Divider().background(ClawColors.separator)

            if viewModel.isLoading {
                loadingView
            } else if let error = viewModel.error {
                VStack(spacing: RelaySpacing.md) {
                    RelayErrorPanel(message: error)
                    Button("Try Again") { _Concurrency.Task { await viewModel.load() } }
                        .buttonStyle(RelayButtonStyle(size: .sm, variant: .secondary))
                }
                .padding(RelaySpacing.lg)
            } else {
                notesList
            }
        }
        .background(ClawColors.backgroundPrimary)
        .navigationTitle("Handover Notes")
        .navigationBarTitleDisplayMode(.inline)
        .task { await viewModel.load() }
        .sheet(item: $selectedNote) { note in
            HandoverNoteDetailView(
                note: note,
                agentMap: viewModel.agentMap
            )
        }
    }

    // MARK: - Notes List

    private var notesList: some View {
        let displayedNotes = viewModel.selectedTab == .pending
            ? viewModel.pendingNotes
            : viewModel.acknowledgedNotes

        return Group {
            if displayedNotes.isEmpty {
                emptyView
            } else {
                ScrollView {
                    LazyVStack(spacing: ClawSpacing.xs) {
                        ForEach(displayedNotes) { note in
                            HandoverNoteCard(
                                note: note,
                                agentMap: viewModel.agentMap
                            ) {
                                selectedNote = note
                            }
                        }
                    }
                    .padding(.horizontal, ClawSpacing.lg)
                    .padding(.vertical, ClawSpacing.md)
                }
            }
        }
    }

    private var emptyView: some View {
        VStack(spacing: ClawSpacing.lg) {
            Spacer()
            Image(systemName: viewModel.selectedTab == .pending ? "tray" : "checkmark.circle")
                .font(.system(size: 48))
                .foregroundStyle(ClawColors.textTertiary)
            Text(viewModel.selectedTab == .pending
                 ? "No pending handovers"
                 : "No acknowledged handovers")
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(ClawColors.textSecondary)
            Spacer()
        }
    }

    private var loadingView: some View {
        ScrollView {
            VStack(spacing: ClawSpacing.xs) {
                ForEach(0..<3, id: \.self) { _ in
                    RoundedRectangle(cornerRadius: ClawRadius.lg)
                        .fill(ClawColors.backgroundCard)
                        .frame(height: 120)
                        .shimmer()
                }
            }
            .padding(ClawSpacing.lg)
        }
    }
}

// MARK: - Handover Note Card

struct HandoverNoteCard: View {
    let note: HandoverNote
    let agentMap: [String: Agent]
    let onTap: () -> Void

    private var fromAgent: Agent? { agentMap[note.fromAgentId] }
    private var toAgent: Agent? { note.toAgentId.flatMap { agentMap[$0] } }
    private var isPending: Bool { note.acknowledgedAt == nil && note.toTeamId != nil }

    var body: some View {
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: ClawSpacing.md) {
                // Header: from → to
                HStack(spacing: ClawSpacing.md) {
                    if let from = fromAgent {
                        HStack(spacing: ClawSpacing.sm) {
                            AvatarView(name: from.name, imageUrl: from.avatarUrl, size: .small, status: from.status)
                            VStack(alignment: .leading, spacing: 1) {
                                Text(from.name)
                                    .font(.system(size: 13, weight: .semibold))
                                    .foregroundStyle(ClawColors.textPrimary)
                                Text("From")
                                    .font(.system(size: 10))
                                    .foregroundStyle(ClawColors.textTertiary)
                            }
                        }
                    }

                    Image(systemName: "arrow.right")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(ClawColors.textTertiary)

                    if let to = toAgent {
                        HStack(spacing: ClawSpacing.sm) {
                            AvatarView(name: to.name, imageUrl: to.avatarUrl, size: .small, status: to.status)
                            VStack(alignment: .leading, spacing: 1) {
                                Text(to.name)
                                    .font(.system(size: 13, weight: .semibold))
                                    .foregroundStyle(ClawColors.textPrimary)
                                Text("To")
                                    .font(.system(size: 10))
                                    .foregroundStyle(ClawColors.textTertiary)
                            }
                        }
                    } else if note.toTeamId != nil {
                        HStack(spacing: ClawSpacing.sm) {
                            Image(systemName: "person.3.fill")
                                .font(.system(size: 14))
                                .foregroundStyle(ClawColors.textSecondary)
                                .frame(width: 28, height: 28)
                                .background(ClawColors.backgroundTertiary)
                                .clipShape(Circle())
                            VStack(alignment: .leading, spacing: 1) {
                                Text("Team")
                                    .font(.system(size: 13, weight: .semibold))
                                    .foregroundStyle(ClawColors.textPrimary)
                                Text("To")
                                    .font(.system(size: 10))
                                    .foregroundStyle(ClawColors.textTertiary)
                            }
                        }
                    }

                    Spacer()

                    VStack(alignment: .trailing, spacing: 2) {
                        Text(note.createdAt.chatTimestamp)
                            .font(ClawFonts.caption)
                            .foregroundStyle(ClawColors.textTertiary)
                        if isPending {
                            Circle()
                                .fill(ClawColors.accentOrange)
                                .frame(width: 8, height: 8)
                        }
                    }
                }

                // Content preview
                Text(note.content)
                    .font(ClawFonts.cardBody)
                    .foregroundStyle(ClawColors.textSecondary)
                    .lineLimit(3)

                // Task IDs + acknowledge
                HStack(spacing: ClawSpacing.sm) {
                    if !note.taskIds.isEmpty {
                        HStack(spacing: ClawSpacing.xs) {
                            Image(systemName: "checkmark.circle")
                                .font(.system(size: 11))
                                .foregroundStyle(ClawColors.textTertiary)
                            Text("\(note.taskIds.count) task\(note.taskIds.count == 1 ? "" : "s")")
                                .font(ClawFonts.caption)
                                .foregroundStyle(ClawColors.textTertiary)
                        }
                    }

                    Spacer()

                    if isPending {
                        RelayBadge(text: "Read only", color: RelayColors.textSecondary, icon: "lock.fill")
                    } else if let ack = note.acknowledgedAt {
                        HStack(spacing: ClawSpacing.xs) {
                            Image(systemName: "checkmark.circle.fill")
                                .font(.system(size: 11))
                                .foregroundStyle(ClawColors.accentGreen)
                            Text("Ack'd \(ack.chatTimestamp)")
                                .font(ClawFonts.caption)
                                .foregroundStyle(ClawColors.textTertiary)
                        }
                    }
                }
            }
            .padding(ClawSpacing.md)
            .background(ClawColors.backgroundCard)
            .cornerRadius(ClawRadius.lg)
            .overlay(
                RoundedRectangle(cornerRadius: ClawRadius.lg)
                    .stroke(isPending ? ClawColors.accentOrange.opacity(0.3) : ClawColors.separator, lineWidth: 0.5)
            )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Handover Note Detail View

struct HandoverNoteDetailView: View {
    let note: HandoverNote
    let agentMap: [String: Agent]
    @Environment(\.dismiss) private var dismiss

    private var fromAgent: Agent? { agentMap[note.fromAgentId] }
    private var toAgent: Agent? { note.toAgentId.flatMap { agentMap[$0] } }
    private var isPending: Bool { note.acknowledgedAt == nil }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: ClawSpacing.xl) {
                    // Direction header
                    HStack(alignment: .top, spacing: ClawSpacing.xl) {
                        agentCard(agent: fromAgent, label: "FROM")
                        VStack {
                            Spacer()
                            Image(systemName: "arrow.right.circle.fill")
                                .font(.system(size: 24))
                                .foregroundStyle(ClawColors.accent)
                            Spacer()
                        }
                        agentCard(agent: toAgent, label: "TO", isTeam: note.toTeamId != nil && toAgent == nil)
                    }
                    .padding(.horizontal, ClawSpacing.lg)

                    // Timestamp
                    HStack {
                        Image(systemName: "clock")
                            .font(.system(size: 13))
                            .foregroundStyle(ClawColors.textTertiary)
                        Text(note.createdAt.fullTimestamp)
                            .font(ClawFonts.caption)
                            .foregroundStyle(ClawColors.textTertiary)
                    }
                    .padding(.horizontal, ClawSpacing.lg)

                    Divider().background(ClawColors.separator)

                    // Full content
                    VStack(alignment: .leading, spacing: ClawSpacing.sm) {
                        Text("NOTE CONTENT")
                            .font(ClawFonts.sectionHeader)
                            .foregroundStyle(ClawColors.textTertiary)
                            .padding(.horizontal, ClawSpacing.lg)

                        Text(note.content)
                            .font(.system(size: 15))
                            .foregroundStyle(ClawColors.textPrimary)
                            .lineSpacing(5)
                            .padding(.horizontal, ClawSpacing.lg)
                    }

                    // Linked tasks
                    if !note.taskIds.isEmpty {
                        VStack(alignment: .leading, spacing: ClawSpacing.sm) {
                            Text("LINKED TASKS")
                                .font(ClawFonts.sectionHeader)
                                .foregroundStyle(ClawColors.textTertiary)
                                .padding(.horizontal, ClawSpacing.lg)

                            VStack(spacing: ClawSpacing.xs) {
                                ForEach(note.taskIds, id: \.self) { taskId in
                                    linkedTaskRow(taskId: taskId)
                                }
                            }
                            .padding(.horizontal, ClawSpacing.lg)
                        }
                    }

                    // Acknowledgement status
                    if let ack = note.acknowledgedAt {
                        HStack(spacing: ClawSpacing.sm) {
                            Image(systemName: "checkmark.circle.fill")
                                .font(.system(size: 16))
                                .foregroundStyle(ClawColors.accentGreen)
                            Text("Acknowledged \(ack.fullTimestamp)")
                                .font(ClawFonts.label)
                                .foregroundStyle(ClawColors.accentGreen)
                        }
                        .padding(ClawSpacing.md)
                        .background(ClawColors.accentGreen.opacity(0.1))
                        .cornerRadius(ClawRadius.md)
                        .overlay(
                            RoundedRectangle(cornerRadius: ClawRadius.md)
                                .stroke(ClawColors.accentGreen.opacity(0.3), lineWidth: 0.5)
                        )
                        .padding(.horizontal, ClawSpacing.lg)
                    }

                    if isPending {
                        RelayStatusStrip(
                            title: "Acknowledgement unavailable",
                            detail: "The Relay service currently provides team handovers as read-only. No local acknowledgement is recorded.",
                            tone: .neutral,
                            icon: "lock.fill"
                        )
                        .padding(.horizontal, ClawSpacing.lg)
                    }

                    Spacer(minLength: ClawSpacing.xxxl)
                }
                .padding(.top, ClawSpacing.lg)
            }
            .background(ClawColors.backgroundPrimary)
            .navigationTitle("Handover Note")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }

    private func agentCard(agent: Agent?, label: String, isTeam: Bool = false) -> some View {
        VStack(spacing: ClawSpacing.sm) {
            Text(label)
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(ClawColors.textTertiary)

            if let agent {
                AvatarView(name: agent.name, imageUrl: agent.avatarUrl, size: .large, status: agent.status)
                Text(agent.name)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(ClawColors.textPrimary)
                    .multilineTextAlignment(.center)
                Text(agent.role)
                    .font(.system(size: 11))
                    .foregroundStyle(ClawColors.textSecondary)
            } else if isTeam {
                Image(systemName: "person.3.fill")
                    .font(.system(size: 28))
                    .foregroundStyle(ClawColors.textSecondary)
                    .frame(width: 72, height: 72)
                    .background(ClawColors.backgroundTertiary)
                    .clipShape(Circle())
                Text("Team")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(ClawColors.textPrimary)
            }
        }
        .frame(maxWidth: .infinity)
    }

    private func linkedTaskRow(taskId: String) -> some View {
        HStack(spacing: ClawSpacing.sm) {
            Image(systemName: "checkmark.circle")
                .font(.system(size: 14))
                .foregroundStyle(ClawColors.accent)
            Text("Task #\(String(taskId.suffix(6)))")
                .font(ClawFonts.label)
                .foregroundStyle(ClawColors.textPrimary)
            Spacer()
            Image(systemName: "chevron.right")
                .font(.system(size: 11))
                .foregroundStyle(ClawColors.textTertiary)
        }
        .padding(ClawSpacing.md)
        .background(ClawColors.backgroundCard)
        .cornerRadius(ClawRadius.md)
        .overlay(
            RoundedRectangle(cornerRadius: ClawRadius.md)
                .stroke(ClawColors.separator, lineWidth: 0.5)
        )
    }
}

// MARK: - Preview

#Preview {
    NavigationStack {
        HandoverNotesView(teamId: "team1")
    }
    .preferredColorScheme(.dark)
}
