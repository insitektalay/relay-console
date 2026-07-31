// AgentStatusSheet.swift
// ClawChat – Bottom sheet for changing agent status

import SwiftUI

// MARK: - Status Option

private struct StatusOption: Identifiable {
    let id: AgentStatus
    let label: String
    let description: String
    let color: Color
    let icon: String
}

private let statusOptions: [StatusOption] = [
    StatusOption(id: .onDuty,  label: "On Duty",  description: "Agent is working normally",       color: ClawColors.statusOnDuty,  icon: "checkmark.circle.fill"),
    StatusOption(id: .idle,    label: "Idle",     description: "Agent is active but not assigned", color: ClawColors.statusIdle,    icon: "minus.circle.fill"),
    StatusOption(id: .busy,    label: "Busy",     description: "Agent is fully occupied",          color: ClawColors.statusBusy,    icon: "exclamationmark.circle.fill"),
    StatusOption(id: .paused,  label: "Paused",   description: "Temporarily suspend all tasks",    color: ClawColors.statusPaused,  icon: "pause.circle.fill"),
    StatusOption(id: .offDuty, label: "Off Duty", description: "Shift ended / not available",      color: ClawColors.statusOffDuty, icon: "moon.fill"),
]

// MARK: - AgentStatusSheet

struct AgentStatusSheet: View {
    let agent: Agent
    let onConfirm: (Agent) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var selectedStatus: AgentStatus
    @State private var reason = ""
    @State private var isApplying = false
    @State private var applyError: String?

    init(agent: Agent, initialSelection: AgentStatus? = nil, onConfirm: @escaping (Agent) -> Void) {
        self.agent = agent
        self.onConfirm = onConfirm
        self._selectedStatus = State(initialValue: initialSelection ?? agent.status)
    }

    private var requiresReason: Bool {
        selectedStatus == .paused || selectedStatus == .offDuty
    }

    private var showPauseDuration: Bool {
        selectedStatus == .paused
    }

    var body: some View {
        NavigationStack {
            ZStack {
                ClawColors.backgroundPrimary.ignoresSafeArea()

                ScrollView {
                    VStack(alignment: .leading, spacing: ClawSpacing.xl) {
                        agentHeader
                        statusOptionsList
                        if requiresReason { reasonField }
                        if showPauseDuration {
                            RelayStatusStrip(
                                title: "Pause duration unavailable",
                                detail: "The Relay service currently supports pausing with a reason, but not a timed resume. Resume the agent manually when ready.",
                                tone: .neutral,
                                icon: "clock.badge.exclamationmark"
                            )
                        }
                        if let applyError { RelayErrorPanel(message: applyError) }
                        confirmButton
                    }
                    .padding(ClawSpacing.lg)
                    .padding(.bottom, ClawSpacing.xxxl)
                }
            }
            .navigationTitle("Set Status")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(ClawColors.backgroundSecondary, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(ClawColors.textSecondary)
                }
            }
        }
        .preferredColorScheme(.dark)
        .presentationDetents([.medium, .large])
        .presentationBackground(ClawColors.backgroundPrimary)
        .presentationDragIndicator(.visible)
    }

    // MARK: - Agent Header

    private var agentHeader: some View {
        HStack(spacing: ClawSpacing.md) {
            AvatarView(name: agent.name, imageUrl: agent.avatarUrl, size: .medium, status: agent.status)

            VStack(alignment: .leading, spacing: 2) {
                Text(agent.name)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(ClawColors.textPrimary)
                HStack(spacing: ClawSpacing.xs) {
                    Text("Current:")
                        .font(.system(size: 13))
                        .foregroundStyle(ClawColors.textTertiary)
                    StatusBadge(status: agent.status)
                }
            }

            Spacer()

            if selectedStatus != agent.status {
                Image(systemName: "arrow.right")
                    .font(.system(size: 13))
                    .foregroundStyle(ClawColors.textTertiary)

                HStack(spacing: 5) {
                    Circle()
                        .fill(Color.agentStatusColor(selectedStatus))
                        .frame(width: 8, height: 8)
                    Text(statusLabel(selectedStatus))
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Color.agentStatusColor(selectedStatus))
                }
                .padding(.horizontal, ClawSpacing.sm)
                .padding(.vertical, 4)
                .background(Color.agentStatusColor(selectedStatus).opacity(0.15))
                .clipShape(Capsule())
                .transition(.scale.combined(with: .opacity))
                .animation(.spring(response: 0.25), value: selectedStatus)
            }
        }
        .padding(ClawSpacing.md)
        .background(ClawColors.backgroundSecondary)
        .cornerRadius(ClawRadius.md)
    }

    private func statusLabel(_ status: AgentStatus) -> String {
        switch status {
        case .onDuty:  return "On Duty"
        case .offDuty: return "Off Duty"
        case .busy:    return "Busy"
        case .paused:  return "Paused"
        case .idle:    return "Idle"
        case .error:   return "Error"
        }
    }

    // MARK: - Status Options List

    private var statusOptionsList: some View {
        VStack(spacing: ClawSpacing.sm) {
            ForEach(statusOptions) { option in
                statusOptionRow(option: option)
            }
        }
    }

    private func statusOptionRow(option: StatusOption) -> some View {
        let isSelected = selectedStatus == option.id

        return Button {
            withAnimation(.spring(response: 0.2)) {
                selectedStatus = option.id
            }
        } label: {
            HStack(spacing: ClawSpacing.md) {
                ZStack {
                    Circle()
                        .fill(option.color.opacity(isSelected ? 0.2 : 0.1))
                        .frame(width: 44, height: 44)
                    Image(systemName: option.icon)
                        .font(.system(size: 20))
                        .foregroundStyle(option.color)
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text(option.label)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(ClawColors.textPrimary)
                    Text(option.description)
                        .font(.system(size: 13))
                        .foregroundStyle(ClawColors.textSecondary)
                }

                Spacer()

                ZStack {
                    Circle()
                        .stroke(isSelected ? option.color : ClawColors.separator, lineWidth: 2)
                        .frame(width: 22, height: 22)
                    if isSelected {
                        Circle()
                            .fill(option.color)
                            .frame(width: 12, height: 12)
                            .transition(.scale)
                    }
                }
                .animation(.spring(response: 0.2), value: isSelected)
            }
            .padding(ClawSpacing.md)
            .background(isSelected ? option.color.opacity(0.08) : ClawColors.backgroundSecondary)
            .cornerRadius(ClawRadius.md)
            .overlay(
                RoundedRectangle(cornerRadius: ClawRadius.md)
                    .stroke(isSelected ? option.color.opacity(0.4) : Color.clear, lineWidth: 1.5)
            )
        }
        .buttonStyle(.plain)
    }

    // MARK: - Reason Field

    private var reasonField: some View {
        VStack(alignment: .leading, spacing: ClawSpacing.sm) {
            Text("REASON (OPTIONAL)")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(ClawColors.textTertiary)

            HStack(spacing: ClawSpacing.sm) {
                Image(systemName: "text.bubble")
                    .foregroundStyle(ClawColors.textTertiary)
                    .font(.system(size: 14))

                TextField("e.g. Maintenance window, end of shift...", text: $reason)
                    .font(.system(size: 15))
                    .foregroundStyle(ClawColors.textPrimary)
                    .tint(ClawColors.accent)
            }
            .padding(ClawSpacing.md)
            .background(ClawColors.backgroundSecondary)
            .cornerRadius(ClawRadius.md)
        }
        .transition(.opacity.combined(with: .move(edge: .top)))
        .animation(.spring(response: 0.25), value: requiresReason)
    }

    // MARK: - Confirm Button

    private var confirmButton: some View {
        Button {
            guard !isApplying else { return }
            if selectedStatus == agent.status {
                dismiss()
                return
            }
            isApplying = true
            applyError = nil
            _Concurrency.Task {
                do {
                    let trimmedReason = reason.trimmingCharacters(in: .whitespacesAndNewlines)
                    let updatedAgent: Agent = try await APIClient.shared.request(
                        .setAgentStatus(
                            agentId: agent.id,
                            status: selectedStatus.rawValue,
                            reason: trimmedReason.isEmpty ? nil : trimmedReason
                        )
                    )
                    onConfirm(updatedAgent)
                    isApplying = false
                    dismiss()
                } catch {
                    applyError = (error as? APIError)?.errorDescription ?? error.localizedDescription
                    isApplying = false
                }
            }
        } label: {
            Group {
                if isApplying {
                    ProgressView().tint(.white)
                } else {
                    HStack(spacing: ClawSpacing.sm) {
                        Image(systemName: "checkmark.circle.fill")
                        Text(selectedStatus == agent.status ? "Keep Current Status" : "Apply Status")
                    }
                    .font(.system(size: 16, weight: .semibold))
                }
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, ClawSpacing.md)
            .background(confirmButtonColor)
            .cornerRadius(ClawRadius.md)
        }
        .buttonStyle(.plain)
        .disabled(isApplying)
        .accessibilityIdentifier("agent-status-confirm")
    }

    private var confirmButtonColor: Color {
        isApplying ? ClawColors.backgroundTertiary : Color.agentStatusColor(selectedStatus)
    }
}

// MARK: - Preview

#Preview {
    let agent: Agent = {
        let now = Date()
        return Agent(id: "1", name: "Aria Finance", role: "Finance Analyst", avatarUrl: nil, status: .onDuty,
                     teamId: "t1", departmentId: "d1", companyId: "c1", workspaceId: "w1", managerId: nil,
                     description: nil, capabilities: [], workingHoursMode: .scheduled, timezone: "UTC",
                     createdAt: now, updatedAt: now, currentTaskId: nil, tasksCompletedToday: 12,
                     successRate: 0.982, avgCompletionMinutes: 4, totalMinutesWorked: 372, budgetUsed: 4.21, budgetLimit: 50)
    }()

    Color.black.sheet(isPresented: .constant(true)) {
        AgentStatusSheet(agent: agent) { _ in }
    }
}
