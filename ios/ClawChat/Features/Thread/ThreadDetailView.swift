// ThreadDetailView.swift
// ClawChat – Thread detail / info sheet
// Swift 6, iOS 18, SwiftUI

import SwiftUI

// MARK: - ThreadDetailView

struct ThreadDetailView: View {
    let thread: Thread

    @EnvironmentObject private var appStore: AppStore
    @Environment(\.dismiss) private var dismiss

    @State private var showManageMembers = false
    @State private var wrapUpVM = WrapUpViewModel()
    @State private var selectedWrapUp: ThreadWrapUp? = nil

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 0) {
                    // Header: large avatar + title + type
                    threadHeader

                    // Context info
                    contextSection

                    // Participants
                    participantsSection

                    // Details (dates, counts)
                    detailsSection

                    // Agent turn limit (team chats)
                    if thread.type == .team || thread.type == .groupAgent {
                        AgentTurnLimitSection(thread: thread)
                    }

                    // Actions
                    actionsSection

                    // Wrap-Up Reports (team/department threads only)
                    if thread.type == .team || thread.type == .department || thread.type == .groupAgent {
                        wrapUpSection
                    }

                    Spacer(minLength: 40)
                }
            }
            .background(ClawColors.backgroundPrimary)
            .navigationTitle("Thread Info")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") { dismiss() }
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(ClawColors.accent)
                }
            }
            .sheet(isPresented: $showManageMembers) {
                ManageTeamMembersSheet(thread: thread, isPresented: $showManageMembers)
                    .environmentObject(appStore)
            }
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
    }

    // MARK: - Header

    private var threadHeader: some View {
        VStack(spacing: 12) {
            AvatarView(
                name: thread.title,
                imageUrl: thread.avatarUrl,
                size: .xlarge
            )

            Text(thread.title)
                .font(.system(size: 22, weight: .bold))
                .foregroundStyle(ClawColors.textPrimary)
                .multilineTextAlignment(.center)

            HStack(spacing: 8) {
                ThreadTypeBadge(type: thread.type)

                // Thread status badge
                statusBadge(thread.status)
            }

            if thread.isMuted {
                HStack(spacing: 4) {
                    Image(systemName: "bell.slash.fill")
                        .font(.system(size: 12))
                        .foregroundStyle(ClawColors.textTertiary)
                    Text("Muted")
                        .font(.system(size: 12))
                        .foregroundStyle(ClawColors.textTertiary)
                }
            }
        }
        .padding(.top, 24)
        .padding(.bottom, 20)
        .frame(maxWidth: .infinity)
    }

    // MARK: - Context Section

    @ViewBuilder
    private var contextSection: some View {
        let workspace = appStore.selectedWorkspace
        let hasContext = workspace != nil || thread.teamId != nil || thread.departmentId != nil

        if hasContext {
            InfoSection(title: "Context") {
                if let ws = workspace {
                    InfoRow(icon: "building.2.fill", label: "Workspace", value: ws.name)
                }
                if thread.teamId != nil {
                    let teamName = appStore.threads.first(where: { $0.teamId == thread.teamId })?.title ?? thread.teamId ?? ""
                    InfoRow(icon: "person.3.fill", label: "Team", value: teamName)
                }
            }
        }
    }

    // MARK: - Participants Section

    private var threadAgents: [Agent] {
        appStore.agents.filter { thread.agentIds.contains($0.id) }
    }

    private var participantsSection: some View {
        let isTeamThread = thread.type == .team || thread.type == .department
        let agents: [Agent] = isTeamThread
            ? threadAgents
            : threadAgents
        let sectionTitle = isTeamThread
            ? "Chat Members (\(agents.count))"
            : "Participants (\(thread.participantIds.count))"

        return InfoSection(title: sectionTitle) {
            if agents.isEmpty {
                Text(isTeamThread ? "No agents added to this chat yet" : "No agents in this thread")
                    .font(.system(size: 14))
                    .foregroundStyle(ClawColors.textSecondary)
                    .padding(.vertical, 8)
            } else {
                ForEach(agents) { agent in
                    HStack(spacing: 12) {
                        AvatarView(
                            name: agent.name,
                            imageUrl: agent.avatarUrl,
                            size: .small,
                            status: agent.status
                        )
                        VStack(alignment: .leading, spacing: 2) {
                            Text(agent.name)
                                .font(.system(size: 14, weight: .medium))
                                .foregroundStyle(ClawColors.textPrimary)
                            Text(agent.role)
                                .font(.system(size: 12))
                                .foregroundStyle(ClawColors.textSecondary)
                        }
                        Spacer()
                        StatusBadge(status: agent.status, compact: true)
                    }
                    .padding(.vertical, 4)
                }
            }
        }
    }

    // MARK: - Details Section

    private var detailsSection: some View {
        InfoSection(title: "Details") {
            InfoRow(
                icon: "calendar",
                label: "Created",
                value: thread.createdAt.fullTimestamp
            )
            InfoRow(
                icon: "clock",
                label: "Last activity",
                value: thread.updatedAt.relativeTime
            )
            InfoRow(
                icon: "number",
                label: "Thread ID",
                value: String(thread.id.prefix(8)) + "…"
            )
            if thread.isPinned {
                InfoRow(icon: "pin.fill", label: "Pinned", value: "Yes")
            }
        }
    }

    // MARK: - Actions Section

    private var actionsSection: some View {
        InfoSection(title: "Actions") {
            if thread.type == .team || thread.type == .department {
                ThreadActionRow(
                    icon: "person.badge.plus.fill",
                    label: "Manage Members",
                    color: ClawColors.accentGreen
                ) { showManageMembers = true }
            }

            NavigationLink {
                ThreadAnalyticsView(thread: thread)
            } label: {
                HStack(spacing: 12) {
                    Image(systemName: "chart.bar.doc.horizontal")
                        .foregroundStyle(ClawColors.accent)
                    Text("Analytics & Export")
                        .foregroundStyle(ClawColors.textPrimary)
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.system(size: 12))
                        .foregroundStyle(ClawColors.textTertiary)
                }
                .padding(.vertical, 8)
            }

            ThreadActionRow(
                icon: "archivebox.fill",
                label: "Archive Thread",
                color: ClawColors.textSecondary
            ) { /* archive */ }
        }
    }

    // MARK: - Wrap-Up Section

    private var wrapUpSection: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Image(systemName: "sparkles.rectangle.stack")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Color(hex: "#40C8E0"))
                Text("WRAP-UP REPORTS")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(ClawColors.textTertiary)
                Spacer()
                Button {
                    _Concurrency.Task { await wrapUpVM.generate(threadId: thread.id) }
                } label: {
                    HStack(spacing: 4) {
                        if wrapUpVM.isGenerating {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: ClawColors.accent))
                                .scaleEffect(0.7)
                        } else {
                            Image(systemName: "sparkles")
                                .font(.system(size: 12))
                        }
                        Text(wrapUpVM.isGenerating ? "Generating…" : "Generate")
                            .font(.system(size: 13, weight: .medium))
                    }
                    .foregroundStyle(ClawColors.accent)
                }
                .disabled(wrapUpVM.isGenerating)
            }
            .padding(.horizontal, 20)
            .padding(.top, 20)
            .padding(.bottom, 10)

            if wrapUpVM.wrapUps.isEmpty && !wrapUpVM.isGenerating {
                Text("No wrap-up reports yet. Generate one to summarise this thread.")
                    .font(.system(size: 13))
                    .foregroundStyle(ClawColors.textTertiary)
                    .padding(.horizontal, 20)
                    .padding(.bottom, 16)
            } else {
                ForEach(wrapUpVM.wrapUps) { wrapUp in
                    Button { selectedWrapUp = wrapUp } label: {
                        HStack(spacing: 12) {
                            VStack(alignment: .leading, spacing: 3) {
                                Text(wrapUp.createdAt.formatted(.dateTime.month().day().hour().minute()))
                                    .font(.system(size: 14, weight: .medium))
                                    .foregroundStyle(ClawColors.textPrimary)
                                Text(statusLabel(wrapUp.status))
                                    .font(.system(size: 12))
                                    .foregroundStyle(statusColor(wrapUp.status))
                            }
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(.system(size: 12))
                                .foregroundStyle(ClawColors.textTertiary)
                        }
                        .padding(.horizontal, 20)
                        .padding(.vertical, 12)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .overlay(Rectangle().fill(ClawColors.separator.opacity(0.5)).frame(height: 0.5), alignment: .bottom)
                }
            }
        }
        .task {
            await wrapUpVM.load(threadId: thread.id)
        }
        .sheet(item: $selectedWrapUp) { wrapUp in
            WrapUpView(wrapUp: wrapUp)
        }
    }

    private func statusLabel(_ status: WrapUpStatus) -> String {
        switch status {
        case .pending:    return "Pending"
        case .generating: return "Generating…"
        case .ready:      return "Ready"
        case .failed:     return "Failed"
        }
    }

    private func statusColor(_ status: WrapUpStatus) -> Color {
        switch status {
        case .pending, .generating: return ClawColors.accentOrange
        case .ready:                return ClawColors.accentGreen
        case .failed:               return ClawColors.accentRed
        }
    }

    // MARK: - Helpers

    private func statusBadge(_ status: ThreadStatus) -> some View {
        let (label, color): (String, Color) = {
            switch status {
            case .active:   return ("Active", ClawColors.accentGreen)
            case .archived: return ("Archived", ClawColors.textSecondary)
            case .resolved: return ("Resolved", ClawColors.accentPurple)
            case .unknown:  return ("Unknown", ClawColors.textTertiary)
            }
        }()

        return Text(label)
            .font(.system(size: 11, weight: .semibold))
            .foregroundStyle(color)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(color.opacity(0.15))
            .clipShape(Capsule())
    }
}

// MARK: - InfoSection

private struct InfoSection<Content: View>: View {
    let title: String
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Section header
            Text(title.uppercased())
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(ClawColors.textTertiary)
                .padding(.horizontal, 20)
                .padding(.top, 20)
                .padding(.bottom, 8)

            VStack(alignment: .leading, spacing: 0) {
                content()
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
            .background(ClawColors.backgroundSecondary)
            .clipShape(RoundedRectangle(cornerRadius: ClawRadius.card))
            .overlay(
                RoundedRectangle(cornerRadius: ClawRadius.card)
                    .stroke(ClawColors.separator, lineWidth: 0.5)
            )
            .padding(.horizontal, 16)
        }
    }
}

// MARK: - InfoRow

private struct InfoRow: View {
    let icon: String
    let label: String
    let value: String

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 14))
                .foregroundStyle(ClawColors.textSecondary)
                .frame(width: 20)

            Text(label)
                .font(.system(size: 14))
                .foregroundStyle(ClawColors.textSecondary)

            Spacer()

            Text(value)
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(ClawColors.textPrimary)
                .lineLimit(1)
        }
        .padding(.vertical, 8)
        .overlay(
            Rectangle()
                .fill(ClawColors.separator)
                .frame(height: 0.5),
            alignment: .bottom
        )
    }
}

// MARK: - ThreadActionRow

private struct ThreadActionRow: View {
    let icon: String
    let label: String
    let color: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 7)
                        .fill(color.opacity(0.15))
                        .frame(width: 32, height: 32)
                    Image(systemName: icon)
                        .font(.system(size: 15))
                        .foregroundStyle(color)
                }

                Text(label)
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(ClawColors.textPrimary)

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.system(size: 12))
                    .foregroundStyle(ClawColors.textTertiary)
            }
            .padding(.vertical, 8)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .overlay(
            Rectangle()
                .fill(ClawColors.separator)
                .frame(height: 0.5),
            alignment: .bottom
        )
    }
}

// MARK: - ManageTeamMembersSheet

@MainActor
struct ManageTeamMembersSheet: View {
    let thread: Thread
    @Binding var isPresented: Bool

    @EnvironmentObject private var appStore: AppStore
    @Environment(\.dismiss) private var dismiss

    @State private var isSaving = false
    @State private var errorMessage: String?

    @State private var memberIds: Set<String> = []

    private var originalMemberIds: Set<String> {
        Set(thread.agentIds)
    }

    var body: some View {
        NavigationStack {
            ZStack {
                ClawColors.backgroundPrimary.ignoresSafeArea()

                VStack(spacing: 0) {
                    if appStore.agents.isEmpty {
                        Spacer()
                        Image(systemName: "person.slash")
                            .font(.system(size: 40))
                            .foregroundStyle(ClawColors.textTertiary)
                        Text("No agents in this workspace")
                            .font(.system(size: 14))
                            .foregroundStyle(ClawColors.textSecondary)
                            .padding(.top, 8)
                        Spacer()
                    } else {
                        ScrollView {
                            LazyVStack(spacing: 0) {
                                ForEach(appStore.agents) { agent in
                                    memberToggleRow(agent)
                                }
                            }
                        }
                    }

                    if let error = errorMessage {
                        Text(error)
                            .font(.system(size: 13))
                            .foregroundStyle(ClawColors.accentRed)
                            .padding(.horizontal, 24)
                            .padding(.top, 8)
                    }

                    Button(action: saveChanges) {
                        HStack(spacing: 8) {
                            if isSaving {
                                ProgressView()
                                    .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                    .scaleEffect(0.85)
                            }
                            Text(isSaving ? "Saving..." : "Save Changes")
                                .font(.system(size: 16, weight: .semibold))
                        }
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 15)
                        .background(hasChanges && !isSaving ? ClawColors.accent : ClawColors.accent.opacity(0.35))
                        .clipShape(RoundedRectangle(cornerRadius: 14))
                    }
                    .disabled(!hasChanges || isSaving)
                    .padding(.horizontal, 24)
                    .padding(.vertical, 16)
                }
            }
            .navigationTitle("Manage Members")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { isPresented = false }
                        .foregroundStyle(ClawColors.accent)
                }
            }
        }
        .preferredColorScheme(.dark)
        .onAppear {
            memberIds = originalMemberIds
        }
    }

    private var hasChanges: Bool {
        memberIds != originalMemberIds
    }

    @ViewBuilder
    private func memberToggleRow(_ agent: Agent) -> some View {
        let isMember = memberIds.contains(agent.id)
        Button {
            if isMember { memberIds.remove(agent.id) }
            else { memberIds.insert(agent.id) }
        } label: {
            HStack(spacing: 14) {
                AvatarView(name: agent.name, imageUrl: agent.avatarUrl, size: .medium, status: agent.status)
                VStack(alignment: .leading, spacing: 3) {
                    Text(agent.name)
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(ClawColors.textPrimary)
                    Text(agent.role)
                        .font(.system(size: 13))
                        .foregroundStyle(ClawColors.textSecondary)
                        .lineLimit(1)
                }
                Spacer()
                Image(systemName: isMember ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 22))
                    .foregroundStyle(isMember ? ClawColors.accent : ClawColors.textTertiary)
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 12)
            .background(isMember ? ClawColors.accent.opacity(0.08) : Color.clear)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .overlay(Rectangle().fill(ClawColors.separator.opacity(0.5)).frame(height: 0.5), alignment: .bottom)
        .animation(.easeInOut(duration: 0.12), value: isMember)
    }

    private func saveChanges() {
        isSaving = true
        errorMessage = nil

        _Concurrency.Task {
            defer { isSaving = false }
            let nextAgentIds = appStore.agents.map(\.id).filter { memberIds.contains($0) }

            if let updated: Thread = try? await APIClient.shared.request(
                .updateThread(id: thread.id, params: ["agentIds": nextAgentIds])
            ) {
                if let idx = appStore.threads.firstIndex(where: { $0.id == updated.id }) {
                    appStore.threads[idx] = updated
                }
                isPresented = false
            } else {
                errorMessage = "Some changes could not be saved. Please try again."
            }
        }
    }
}

// MARK: - AgentTurnLimitSection

private struct AgentTurnLimitSection: View {
    let thread: Thread

    @EnvironmentObject private var appStore: AppStore
    @State private var turnsInput: String = ""
    @State private var saved = false

    var body: some View {
        InfoSection(title: "Agent Auto-Reply Limit") {
            VStack(alignment: .leading, spacing: 12) {
                Text("Maximum replies each agent can send before you need to respond. Prevents runaway conversations.")
                    .font(.system(size: 13))
                    .foregroundStyle(ClawColors.textSecondary)
                    .padding(.horizontal, 20)

                HStack(spacing: 12) {
                    TextField(
                        thread.maxAgentTurns.map { String($0) } ?? "Unlimited",
                        text: $turnsInput
                    )
                    .keyboardType(.numberPad)
                    .font(.system(size: 15))
                    .foregroundStyle(ClawColors.textPrimary)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(ClawColors.backgroundSecondary)
                    .clipShape(RoundedRectangle(cornerRadius: 10))

                    Button {
                        saveTurnLimit()
                    } label: {
                        Text(saved ? "Saved ✓" : "Save")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(Color.white)
                            .padding(.horizontal, 16)
                            .padding(.vertical, 10)
                            .background(saved ? ClawColors.accentGreen : ClawColors.accent)
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                    }

                    if thread.maxAgentTurns != nil {
                        Button {
                            turnsInput = ""
                            saveTurnLimit()
                        } label: {
                            Text("Clear")
                                .font(.system(size: 14))
                                .foregroundStyle(ClawColors.textSecondary)
                        }
                    }
                }
                .padding(.horizontal, 20)

                if let current = thread.maxAgentTurns {
                    Text("Currently set to \(current) turn\(current == 1 ? "" : "s") per agent.")
                        .font(.system(size: 12))
                        .foregroundStyle(ClawColors.textTertiary)
                        .padding(.horizontal, 20)
                } else {
                    Text("No limit set — agents reply freely.")
                        .font(.system(size: 12))
                        .foregroundStyle(ClawColors.textTertiary)
                        .padding(.horizontal, 20)
                }
            }
            .padding(.bottom, 16)
        }
    }

    private func saveTurnLimit() {
        let value = turnsInput.isEmpty ? nil : Int(turnsInput)
        _Concurrency.Task {
            do {
                var body: [String: Any] = [:]
                if let v = value { body["maxAgentTurns"] = v }
                else { body["maxAgentTurns"] = NSNull() }
                let apiClient = APIClient.shared
                let url = apiClient.baseURL.appendingPathComponent("threads/\(thread.id)")
                var req = URLRequest(url: url)
                req.httpMethod = "PATCH"
                req.setValue("application/json", forHTTPHeaderField: "Content-Type")
                if let token = apiClient.authTokens?.accessToken {
                    req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
                }
                req.httpBody = try JSONSerialization.data(withJSONObject: body)
                _ = try await URLSession.shared.data(for: req)
                withAnimation { saved = true }
                DispatchQueue.main.asyncAfter(deadline: .now() + 2) { saved = false }
            } catch {}
        }
    }
}

// MARK: - Preview

#Preview {
    ThreadDetailView(thread: .preview)
        .environmentObject(AppStore.preview)
}
