// NewTaskView.swift
// ClawChat – Create a new task (web-canonical)

import SwiftUI

private enum SendToTarget: String, CaseIterable {
    case direct     = "direct"
    case team       = "team"
    case department = "department"

    var label: String {
        switch self {
        case .direct:     return "Direct chat"
        case .team:       return "Team chat"
        case .department: return "Department chat"
        }
    }
    var icon: String {
        switch self {
        case .direct:     return "person.fill"
        case .team:       return "person.3.fill"
        case .department: return "building.2.fill"
        }
    }
}

@MainActor
struct NewTaskView: View {
    @Binding var isPresented: Bool
    @EnvironmentObject private var appStore: AppStore

    @State private var title: String = ""
    @State private var message: String = ""
    @State private var sendToTarget: SendToTarget = .direct
    @State private var selectedAgentId: String? = nil
    @State private var selectedTeamId: String? = nil
    @State private var selectedDeptId: String? = nil
    @State private var priority: String = "normal"
    @State private var hasSendAt: Bool = false
    @State private var sendAt: Date = Date().addingTimeInterval(3600)
    @State private var timezone: String = TimeZone.current.identifier
    @State private var recurrenceRule: String = "none"
    @State private var requiresApproval: Bool = false
    @State private var isCreating: Bool = false
    @State private var errorMessage: String? = nil

    private let priorities = ["low", "normal", "high", "urgent"]
    private let recurrenceOptions = ["none", "hourly", "daily", "weekdays", "weekly", "monthly"]

    private func recurrenceLabel(_ rule: String) -> String {
        switch rule {
        case "none":     return "One-off"
        case "hourly":   return "Every hour"
        case "daily":    return "Every day"
        case "weekdays": return "Weekdays"
        case "weekly":   return "Every week"
        case "monthly":  return "Every month"
        default:         return rule.capitalized
        }
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Task") {
                    TextField("Title", text: $title)
                        .foregroundStyle(ClawColors.textPrimary)
                }
                .listRowBackground(ClawColors.backgroundCard)

                Section("Send To") {
                    Picker("Target", selection: $sendToTarget) {
                        ForEach(SendToTarget.allCases, id: \.self) { t in
                            Label(t.label, systemImage: t.icon).tag(t)
                        }
                    }
                    .foregroundStyle(ClawColors.textPrimary)

                    switch sendToTarget {
                    case .direct:
                        Picker("Agent", selection: $selectedAgentId) {
                            Text("Select agent").tag(Optional<String>.none)
                            ForEach(appStore.agents) { agent in
                                Text(agent.name).tag(Optional(agent.id))
                            }
                        }
                        .foregroundStyle(ClawColors.textPrimary)

                    case .team:
                        Picker("Team", selection: $selectedTeamId) {
                            Text("Select team").tag(Optional<String>.none)
                            ForEach(appStore.teams) { team in
                                Text(team.name).tag(Optional(team.id))
                            }
                        }
                        .foregroundStyle(ClawColors.textPrimary)

                    case .department:
                        Picker("Department", selection: $selectedDeptId) {
                            Text("Select department").tag(Optional<String>.none)
                            ForEach(appStore.departments) { dept in
                                Text(dept.name).tag(Optional(dept.id))
                            }
                        }
                        .foregroundStyle(ClawColors.textPrimary)
                    }
                }
                .listRowBackground(ClawColors.backgroundCard)

                Section("Message") {
                    ZStack(alignment: .topLeading) {
                        if message.isEmpty {
                            Text("Message to send…")
                                .foregroundStyle(ClawColors.textTertiary)
                                .padding(.top, 8)
                                .padding(.leading, 4)
                        }
                        TextEditor(text: $message)
                            .frame(minHeight: 80)
                            .foregroundStyle(ClawColors.textPrimary)
                    }
                }
                .listRowBackground(ClawColors.backgroundCard)

                Section("Schedule") {
                    Picker("Priority", selection: $priority) {
                        ForEach(priorities, id: \.self) { p in
                            Text(p.capitalized).tag(p)
                        }
                    }
                    .foregroundStyle(ClawColors.textPrimary)

                    Picker("Repeat", selection: $recurrenceRule) {
                        ForEach(recurrenceOptions, id: \.self) { r in
                            Text(recurrenceLabel(r)).tag(r)
                        }
                    }
                    .foregroundStyle(ClawColors.textPrimary)

                    Toggle("Set Send At", isOn: $hasSendAt)
                        .foregroundStyle(ClawColors.textPrimary)
                        .tint(ClawColors.accent)

                    if hasSendAt {
                        DatePicker("Send at", selection: $sendAt, in: Date()..., displayedComponents: [.date, .hourAndMinute])
                            .foregroundStyle(ClawColors.textPrimary)
                            .tint(ClawColors.accent)

                        HStack {
                            Text("Time Zone")
                                .foregroundStyle(ClawColors.textSecondary)
                            Spacer()
                            TextField("UTC", text: $timezone)
                                .multilineTextAlignment(.trailing)
                                .foregroundStyle(ClawColors.textPrimary)
                                .frame(maxWidth: 160)
                        }
                    }

                    Toggle("Requires Approval", isOn: $requiresApproval)
                        .foregroundStyle(ClawColors.textPrimary)
                        .tint(ClawColors.accentOrange)
                }
                .listRowBackground(ClawColors.backgroundCard)

                if let error = errorMessage {
                    Section {
                        Text(error)
                            .font(.system(size: 13))
                            .foregroundStyle(ClawColors.accentRed)
                    }
                    .listRowBackground(Color.clear)
                }
            }
            .scrollContentBackground(.hidden)
            .background(ClawColors.backgroundPrimary)
            .navigationTitle("New Task")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(ClawColors.backgroundSecondary, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { isPresented = false }
                        .foregroundStyle(ClawColors.accent)
                }
                ToolbarItem(placement: .confirmationAction) {
                    if isCreating {
                        ProgressView().scaleEffect(0.8).tint(ClawColors.accent)
                    } else {
                        Button("Create") {
                            _Concurrency.Task { await createTask() }
                        }
                        .disabled(title.trimmingCharacters(in: .whitespaces).isEmpty)
                        .foregroundStyle(title.trimmingCharacters(in: .whitespaces).isEmpty ? ClawColors.textTertiary : ClawColors.accent)
                    }
                }
            }
        }
        .presentationDetents([.large])
        .presentationBackground(ClawColors.backgroundPrimary)
    }

    private func createTask() async {
        guard let wsId = appStore.selectedWorkspace?.id else { return }
        let trimmedTitle = title.trimmingCharacters(in: .whitespaces)
        guard !trimmedTitle.isEmpty else { return }

        // Determine agentId from send-to target
        let agentId: String?
        switch sendToTarget {
        case .direct:     agentId = selectedAgentId
        case .team:       agentId = nil
        case .department: agentId = nil
        }

        let isoFormatter = ISO8601DateFormatter()
        let sendAtStr: String? = hasSendAt ? isoFormatter.string(from: sendAt) : nil

        isCreating = true
        errorMessage = nil
        do {
            let _: Task = try await APIClient.shared.request(
                .createTask(
                    workspaceId: wsId,
                    title: trimmedTitle,
                    description: message.trimmingCharacters(in: .whitespaces),
                    agentId: agentId,
                    priority: priority == "normal" ? nil : priority,
                    dueAt: sendAtStr,
                    recurrenceRule: recurrenceRule == "none" ? nil : recurrenceRule,
                    requiresApproval: requiresApproval ? true : nil
                )
            )
            try? await appStore.syncTasks()
            isPresented = false
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
        isCreating = false
    }
}
