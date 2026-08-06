// NewThreadView.swift
// ClawChat – Create direct, team, or department threads

import SwiftUI

// MARK: - Thread Creation Mode

enum NewThreadMode: String, CaseIterable {
    case direct     = "Direct"
    case team       = "Team"
    case department = "Department"

    var icon: String {
        switch self {
        case .direct:       return "person"
        case .team:         return "person.2"
        case .department:   return "building.2"
        }
    }
}

// MARK: - NewThreadView

@MainActor
struct NewThreadView: View {
    @Binding var isPresented: Bool
    @EnvironmentObject private var appStore: AppStore
    @Environment(AppCoordinator.self) private var coordinator
    @Environment(\.dismiss) private var dismiss

    @State private var mode: NewThreadMode = .direct
    @State private var isCreating = false
    @State private var errorMessage: String?

    // Direct
    @State private var selectedAgent: Agent?

    // Team
    @State private var selectedTeam: Team?
    @State private var showCreateTeam = false

    // Department
    @State private var selectedDept: Department?
    @State private var showCreateDept = false

    private var canCreate: Bool {
        guard !isCreating else { return false }
        switch mode {
        case .direct:       return selectedAgent != nil
        case .team:         return selectedTeam != nil
        case .department:   return selectedDept != nil
        }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                ClawColors.backgroundPrimary.ignoresSafeArea()

                VStack(spacing: 0) {
                    modePicker
                        .padding(.horizontal, 16)
                        .padding(.top, 12)
                        .padding(.bottom, 8)

                    Rectangle()
                        .fill(ClawColors.separator.opacity(0.6))
                        .frame(height: 0.5)

                    contentForMode
                        .frame(maxWidth: .infinity, maxHeight: .infinity)

                    if let error = errorMessage {
                        RelayErrorPanel(message: error)
                            .padding(.horizontal, 24)
                            .padding(.top, 8)
                    }

                    actionButton
                        .padding(.horizontal, 24)
                        .padding(.vertical, 16)
                }
            }
            .navigationTitle(ChatsParityContract.newThreadTitle)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { isPresented = false }
                        .foregroundStyle(ClawColors.accent)
                }
            }
            .sheet(isPresented: $showCreateTeam) {
                CreateTeamChatSheet(
                    isPresented: $showCreateTeam,
                    departments: appStore.departments,
                    onCreated: { thread in
                        appStore.threads.insert(thread, at: 0)
                        isPresented = false
                        dismiss()
                        coordinator.navigateToThread(thread)
                    }
                )
                .environmentObject(appStore)
            }
            .sheet(isPresented: $showCreateDept) {
                CreateDepartmentSheet(
                    isPresented: $showCreateDept,
                    onCreated: { dept in
                        appStore.departments.insert(dept, at: 0)
                        selectedDept = dept
                    }
                )
                .environmentObject(appStore)
            }
        }
        .preferredColorScheme(.dark)
    }

    // MARK: - Mode Picker

    private var modePicker: some View {
        HStack(spacing: 0) {
            ForEach(NewThreadMode.allCases, id: \.self) { m in
                Button {
                    withAnimation(.easeInOut(duration: 0.15)) { mode = m }
                    errorMessage = nil
                } label: {
                    HStack(spacing: 5) {
                        Image(systemName: m.icon)
                            .font(.system(size: 11, weight: .semibold))
                        Text(m.rawValue)
                            .font(.system(size: 13, weight: mode == m ? .semibold : .regular))
                    }
                    .foregroundStyle(mode == m ? RelayColors.accent : RelayColors.textSecondary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                    .background(mode == m ? RelayColors.backgroundSelected : Color.clear)
                    .clipShape(RoundedRectangle(cornerRadius: RelayRadius.sm))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(4)
        .background(ClawColors.backgroundSecondary)
        .clipShape(RoundedRectangle(cornerRadius: RelayRadius.md))
        .overlay(
            RoundedRectangle(cornerRadius: RelayRadius.md)
                .stroke(ClawColors.separator, lineWidth: 1)
        )
    }

    // MARK: - Content

    @ViewBuilder
    private var contentForMode: some View {
        switch mode {
        case .direct:
            agentListView(
                agents: appStore.agents,
                selected: selectedAgent,
                onSelect: { selectedAgent = $0 }
            )
        case .team:
            teamListView
        case .department:
            deptListView
        }
    }

    // MARK: - Direct

    private func agentListView(agents: [Agent], selected: Agent?, onSelect: @escaping (Agent) -> Void) -> some View {
        Group {
            if agents.isEmpty {
                emptyHint(icon: "person.slash", message: "No agents in this workspace yet.")
            } else {
                ScrollView {
                    LazyVStack(spacing: 0) {
                        ForEach(agents) { agent in
                            agentRow(agent, isSelected: selected?.id == agent.id) {
                                onSelect(agent)
                            }
                        }
                    }
                }
            }
        }
    }

    // MARK: - Team

    private var teamListView: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                ForEach(appStore.teams) { team in
                    teamRow(team, isSelected: selectedTeam?.id == team.id) {
                        selectedTeam = team
                    }
                }

                createRowButton(label: "New Team Chat", icon: "plus.circle.fill") {
                    showCreateTeam = true
                }
            }
        }
    }

    // MARK: - Department

    private var deptListView: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                ForEach(appStore.departments) { dept in
                    deptRow(dept, isSelected: selectedDept?.id == dept.id) {
                        selectedDept = dept
                    }
                }

                createRowButton(label: "New Department", icon: "plus.circle.fill") {
                    showCreateDept = true
                }
            }
        }
    }

    // MARK: - Action Button

    private var actionButton: some View {
        Button(action: create) {
            HStack(spacing: 8) {
                if isCreating {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: .white))
                        .scaleEffect(0.85)
                }
                Text(isCreating ? "Starting..." : actionLabel)
                    .font(.system(size: 16, weight: .semibold))
            }
            .foregroundStyle(canCreate ? RelayColors.textPrimary : RelayColors.textTertiary)
            .frame(maxWidth: .infinity)
            .frame(minHeight: RelayMetrics.minimumHitTarget)
            .background(canCreate ? RelayColors.backgroundSelected : RelayColors.backgroundElevated)
            .clipShape(RoundedRectangle(cornerRadius: RelayRadius.md))
            .overlay(RoundedRectangle(cornerRadius: RelayRadius.md).stroke(canCreate ? RelayColors.borderFocus : RelayColors.borderStandard))
        }
        .disabled(!canCreate)
    }

    private var actionLabel: String {
        switch mode {
        case .direct:       return "Start Chat"
        case .team:         return "Start Team Chat"
        case .department:   return "Start Department Chat"
        }
    }

    // MARK: - Row Builders

    @ViewBuilder
    private func agentRow(_ agent: Agent, isSelected: Bool, onTap: @escaping () -> Void) -> some View {
        Button(action: onTap) {
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
                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 22))
                        .foregroundStyle(ClawColors.accent)
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 12)
            .background(isSelected ? ClawColors.accent.opacity(0.08) : Color.clear)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .overlay(Rectangle().fill(ClawColors.separator.opacity(0.5)).frame(height: 0.5), alignment: .bottom)
        .animation(.easeInOut(duration: 0.12), value: isSelected)
    }

    @ViewBuilder
    private func teamRow(_ team: Team, isSelected: Bool, onTap: @escaping () -> Void) -> some View {
        Button(action: onTap) {
            HStack(spacing: 14) {
                ZStack {
                    Circle()
                        .fill(Color(hex: team.color).opacity(0.2))
                        .frame(width: 44, height: 44)
                    Image(systemName: "person.2.fill")
                        .font(.system(size: 18))
                        .foregroundStyle(Color(hex: team.color))
                }
                VStack(alignment: .leading, spacing: 3) {
                    Text(team.name)
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(ClawColors.textPrimary)
                    Text("\(team.agentCount) agent\(team.agentCount == 1 ? "" : "s")")
                        .font(.system(size: 13))
                        .foregroundStyle(ClawColors.textSecondary)
                }
                Spacer()
                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 22))
                        .foregroundStyle(ClawColors.accent)
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 12)
            .background(isSelected ? ClawColors.accent.opacity(0.08) : Color.clear)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .overlay(Rectangle().fill(ClawColors.separator.opacity(0.5)).frame(height: 0.5), alignment: .bottom)
        .animation(.easeInOut(duration: 0.12), value: isSelected)
    }

    @ViewBuilder
    private func deptRow(_ dept: Department, isSelected: Bool, onTap: @escaping () -> Void) -> some View {
        Button(action: onTap) {
            HStack(spacing: 14) {
                ZStack {
                    Circle()
                        .fill(Color(hex: dept.color).opacity(0.2))
                        .frame(width: 44, height: 44)
                    Image(systemName: "building.2.fill")
                        .font(.system(size: 18))
                        .foregroundStyle(Color(hex: dept.color))
                }
                VStack(alignment: .leading, spacing: 3) {
                    Text(dept.name)
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(ClawColors.textPrimary)
                    Text("\(dept.agentCount) agent\(dept.agentCount == 1 ? "" : "s")")
                        .font(.system(size: 13))
                        .foregroundStyle(ClawColors.textSecondary)
                }
                Spacer()
                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 22))
                        .foregroundStyle(ClawColors.accent)
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 12)
            .background(isSelected ? ClawColors.accent.opacity(0.08) : Color.clear)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .overlay(Rectangle().fill(ClawColors.separator.opacity(0.5)).frame(height: 0.5), alignment: .bottom)
        .animation(.easeInOut(duration: 0.12), value: isSelected)
    }

    private func createRowButton(label: String, icon: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 10) {
                Image(systemName: icon)
                    .font(.system(size: 20))
                    .foregroundStyle(ClawColors.accent)
                Text(label)
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(ClawColors.accent)
                Spacer()
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 14)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .overlay(Rectangle().fill(ClawColors.separator.opacity(0.5)).frame(height: 0.5), alignment: .bottom)
    }

    private func emptyHint(icon: String, message: String) -> some View {
        RelayEmptyState(
            icon: icon,
            title: "No agents available",
            subtitle: message
        )
    }

    // MARK: - Create

    private func create() {
        guard canCreate else { return }

        // Before creating anything, check if a matching thread already exists
        if let existing = existingThread() {
            isPresented = false
            dismiss()
            coordinator.navigateToThread(existing)
            return
        }

        isCreating = true
        errorMessage = nil

        guard let wsId = appStore.selectedWorkspace?.id, let userId = appStore.currentUser?.id else {
            errorMessage = "Select a workspace and sign in again."
            isCreating = false
            Telemetry.shared.capture(
                message: "Thread creation attempted without workspace or user",
                level: .warning,
                attributes: ["mode": mode.rawValue]
            )
            return
        }

        Telemetry.shared.breadcrumb("Thread creation started", category: "thread.create", attributes: ["workspaceId": wsId, "mode": mode.rawValue])

        _Concurrency.Task {
            defer { isCreating = false }
            do {
                let thread: Thread
                switch mode {
                case .direct:
                    let agent = selectedAgent!
                    thread = try await APIClient.shared.request(
                        .createThread(workspaceId: wsId, title: agent.name, type: "direct",
                                      participantIds: [userId], agentIds: [agent.id])
                    )

                case .team:
                    let team = selectedTeam!
                    thread = try await APIClient.shared.request(
                        .createThread(workspaceId: wsId, title: team.name, type: "team",
                                      participantIds: [userId], agentIds: [], teamId: team.id)
                    )

                case .department:
                    let dept = selectedDept!
                    thread = try await APIClient.shared.request(
                        .createThread(workspaceId: wsId, title: dept.name, type: "department",
                                      participantIds: [userId], agentIds: [], departmentId: dept.id)
                    )

                }

                appStore.threads.insert(thread, at: 0)
                Telemetry.shared.breadcrumb(
                    "Thread creation succeeded",
                    category: "thread.create",
                    attributes: ["workspaceId": wsId, "threadId": thread.id, "mode": mode.rawValue]
                )
                isPresented = false
                dismiss()
                coordinator.navigateToThread(thread)
            } catch {
                errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
                Telemetry.shared.capture(error: error, attributes: ["operation": "thread.create", "workspaceId": wsId, "mode": mode.rawValue])
            }
        }
    }

    /// Returns an existing thread that matches the current selection, if one exists.
    private func existingThread() -> Thread? {
        switch mode {
        case .direct:
            guard let agent = selectedAgent else { return nil }
            return appStore.threads.first {
                $0.type == .direct && $0.agentIds.contains(agent.id)
            }
        case .team:
            guard let team = selectedTeam else { return nil }
            return appStore.threads.first {
                $0.type == .team && $0.teamId == team.id
            }
        case .department:
            guard let dept = selectedDept else { return nil }
            return appStore.threads.first {
                $0.type == .department && $0.departmentId == dept.id
            }
        }
    }
}

// MARK: - CreateTeamChatSheet

@MainActor
struct CreateTeamChatSheet: View {
    @Binding var isPresented: Bool
    let departments: [Department]
    let onCreated: (Thread) -> Void
    @EnvironmentObject private var appStore: AppStore

    @State private var name = ""
    @State private var selectedDept: Department?
    @State private var selectedAgentIds: Set<String> = []
    @State private var isCreating = false
    @State private var errorMessage: String?
    @FocusState private var nameFocused: Bool

    init(isPresented: Binding<Bool>, departments: [Department], onCreated: @escaping (Thread) -> Void) {
        self._isPresented = isPresented
        self.departments = departments
        self.onCreated = onCreated
    }

    private var canCreate: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty && !selectedAgentIds.isEmpty && !isCreating
    }

    var body: some View {
        NavigationStack {
            ZStack {
                ClawColors.backgroundPrimary.ignoresSafeArea()

                VStack(spacing: 0) {
                    // Name field
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Team Name")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(ClawColors.textSecondary)
                            .padding(.horizontal, 20)

                        TextField("e.g. Growth Squad", text: $name)
                            .focused($nameFocused)
                            .font(.system(size: 16))
                            .foregroundStyle(ClawColors.textPrimary)
                            .padding(14)
                            .background(ClawColors.backgroundSecondary)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                            .padding(.horizontal, 20)
                    }
                    .padding(.top, 24)
                    .padding(.bottom, 20)

                    Rectangle()
                        .fill(ClawColors.separator.opacity(0.6))
                        .frame(height: 0.5)

                    // Optional department context
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Department (Optional)")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(ClawColors.textSecondary)
                            .padding(.horizontal, 20)
                            .padding(.top, 16)
                    }

                    if departments.isEmpty {
                        Text("No department needed for a team chat.")
                            .font(.system(size: 14))
                            .foregroundStyle(ClawColors.textSecondary)
                            .padding(.horizontal, 20)
                            .padding(.vertical, 12)
                    } else {
                        ScrollView {
                            LazyVStack(spacing: 0) {
                                noDepartmentRow
                                ForEach(departments) { dept in
                                    deptPickRow(dept)
                                }
                            }
                        }
                    }

                    // Agent picker
                    if !appStore.agents.isEmpty {
                        Rectangle()
                            .fill(ClawColors.separator.opacity(0.6))
                            .frame(height: 0.5)

                        HStack {
                            Text("Add Members")
                                .font(.system(size: 13, weight: .medium))
                                .foregroundStyle(ClawColors.textSecondary)
                            Spacer()
                            if !selectedAgentIds.isEmpty {
                                Text("\(selectedAgentIds.count) selected")
                                    .font(.system(size: 12))
                                    .foregroundStyle(ClawColors.accent)
                            }
                        }
                        .padding(.horizontal, 20)
                        .padding(.top, 16)
                        .padding(.bottom, 4)

                        ScrollView {
                            LazyVStack(spacing: 0) {
                                ForEach(appStore.agents) { agent in
                                    agentToggleRow(agent)
                                }
                            }
                        }
                        .frame(maxHeight: 220)
                    }

                    if let error = errorMessage {
                        Text(error)
                            .font(.system(size: 13))
                            .foregroundStyle(ClawColors.accentRed)
                            .padding(.horizontal, 24)
                            .padding(.top, 8)
                    }

                    Button(action: createTeamChat) {
                        HStack(spacing: 8) {
                            if isCreating {
                                ProgressView()
                                    .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                    .scaleEffect(0.85)
                            }
                            Text(isCreating ? "Creating..." : "Create New Team Chat")
                                .font(.system(size: 16, weight: .semibold))
                        }
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 15)
                        .background(canCreate ? ClawColors.accent : ClawColors.accent.opacity(0.35))
                        .clipShape(RoundedRectangle(cornerRadius: 14))
                    }
                    .disabled(!canCreate)
                    .padding(.horizontal, 24)
                    .padding(.vertical, 16)
                }
            }
            .navigationTitle("New Team Chat")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { isPresented = false }
                        .foregroundStyle(ClawColors.accent)
                }
            }
        }
        .preferredColorScheme(.dark)
        .onAppear { nameFocused = true }
    }

    private var noDepartmentRow: some View {
        Button { selectedDept = nil } label: {
            HStack(spacing: 12) {
                Image(systemName: "person.3.fill")
                    .font(.system(size: 14))
                    .foregroundStyle(ClawColors.textSecondary)
                    .frame(width: 36, height: 36)
                Text("No department")
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(ClawColors.textPrimary)
                Spacer()
                if selectedDept == nil {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 20))
                        .foregroundStyle(ClawColors.accent)
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 12)
            .background(selectedDept == nil ? ClawColors.accent.opacity(0.08) : Color.clear)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private func deptPickRow(_ dept: Department) -> some View {
        let isSelected = selectedDept?.id == dept.id
        Button { selectedDept = dept } label: {
            HStack(spacing: 12) {
                ZStack {
                    Circle()
                        .fill(Color(hex: dept.color).opacity(0.2))
                        .frame(width: 36, height: 36)
                    Image(systemName: "building.2.fill")
                        .font(.system(size: 14))
                        .foregroundStyle(Color(hex: dept.color))
                }
                Text(dept.name)
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(ClawColors.textPrimary)
                Spacer()
                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 20))
                        .foregroundStyle(ClawColors.accent)
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 12)
            .background(isSelected ? ClawColors.accent.opacity(0.08) : Color.clear)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .overlay(Rectangle().fill(ClawColors.separator.opacity(0.5)).frame(height: 0.5), alignment: .bottom)
        .animation(.easeInOut(duration: 0.12), value: isSelected)
    }

    @ViewBuilder
    private func agentToggleRow(_ agent: Agent) -> some View {
        let isSelected = selectedAgentIds.contains(agent.id)
        Button {
            if isSelected { selectedAgentIds.remove(agent.id) }
            else { selectedAgentIds.insert(agent.id) }
        } label: {
            HStack(spacing: 12) {
                AvatarView(name: agent.name, imageUrl: agent.avatarUrl, size: .small, status: agent.status)
                VStack(alignment: .leading, spacing: 2) {
                    Text(agent.name)
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(ClawColors.textPrimary)
                    Text(agent.role)
                        .font(.system(size: 12))
                        .foregroundStyle(ClawColors.textSecondary)
                        .lineLimit(1)
                }
                Spacer()
                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 20))
                    .foregroundStyle(isSelected ? ClawColors.accent : ClawColors.textTertiary)
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 10)
            .background(isSelected ? ClawColors.accent.opacity(0.08) : Color.clear)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .overlay(Rectangle().fill(ClawColors.separator.opacity(0.4)).frame(height: 0.5), alignment: .bottom)
        .animation(.easeInOut(duration: 0.1), value: isSelected)
    }

    private func createTeamChat() {
        guard canCreate else { return }
        isCreating = true
        errorMessage = nil
        let chatName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        let agentIds = appStore.agents.filter { selectedAgentIds.contains($0.id) }.map(\.id)
        let departmentId = selectedDept?.id

        guard let workspaceId = appStore.selectedWorkspace?.id,
              let userId = appStore.currentUser?.id else {
            errorMessage = "Select a workspace and sign in again."
            isCreating = false
            return
        }

        _Concurrency.Task {
            defer { isCreating = false }
            do {
                let thread: Thread = try await APIClient.shared.request(
                    .createThread(
                        workspaceId: workspaceId,
                        title: chatName,
                        type: "team",
                        participantIds: [userId],
                        agentIds: agentIds,
                        departmentId: departmentId
                    )
                )
                onCreated(thread)
                isPresented = false
            } catch {
                errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
            }
        }
    }
}

// MARK: - CreateDepartmentSheet

@MainActor
struct CreateDepartmentSheet: View {
    @Binding var isPresented: Bool
    let onCreated: (Department) -> Void
    @EnvironmentObject private var appStore: AppStore

    @State private var name = ""
    @State private var isCreating = false
    @State private var errorMessage: String?
    @FocusState private var nameFocused: Bool

    private var canCreate: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty && !isCreating
    }

    var body: some View {
        NavigationStack {
            ZStack {
                ClawColors.backgroundPrimary.ignoresSafeArea()

                VStack(spacing: 20) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Department Name")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(ClawColors.textSecondary)

                        TextField("e.g. Engineering", text: $name)
                            .focused($nameFocused)
                            .font(.system(size: 16))
                            .foregroundStyle(ClawColors.textPrimary)
                            .padding(14)
                            .background(ClawColors.backgroundSecondary)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                            .submitLabel(.go)
                            .onSubmit { if canCreate { createDept() } }
                    }
                    .padding(.top, 24)
                    .padding(.horizontal, 20)

                    if let error = errorMessage {
                        Text(error)
                            .font(.system(size: 13))
                            .foregroundStyle(ClawColors.accentRed)
                            .padding(.horizontal, 20)
                    }

                    Spacer()

                    Button(action: createDept) {
                        HStack(spacing: 8) {
                            if isCreating {
                                ProgressView()
                                    .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                    .scaleEffect(0.85)
                            }
                            Text(isCreating ? "Creating..." : "Create Department")
                                .font(.system(size: 16, weight: .semibold))
                        }
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 15)
                        .background(canCreate ? ClawColors.accent : ClawColors.accent.opacity(0.35))
                        .clipShape(RoundedRectangle(cornerRadius: 14))
                    }
                    .disabled(!canCreate)
                    .padding(.horizontal, 24)
                    .padding(.bottom, 16)
                }
            }
            .navigationTitle("New Department")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { isPresented = false }
                        .foregroundStyle(ClawColors.accent)
                }
            }
        }
        .preferredColorScheme(.dark)
        .onAppear { nameFocused = true }
    }

    private func createDept() {
        guard canCreate else { return }
        isCreating = true
        errorMessage = nil
        let deptName = name.trimmingCharacters(in: .whitespaces)
        guard let wsId = appStore.selectedWorkspace?.id else {
            errorMessage = "Select a workspace first."
            isCreating = false
            Telemetry.shared.capture(message: "Department creation attempted without workspace", level: .warning)
            return
        }

        _Concurrency.Task {
            defer { isCreating = false }
            do {
                // Use existing company or create one for this workspace
                let companyId: String
                if let existing = appStore.companies.first {
                    companyId = existing.id
                } else {
                    // Auto-create a company named after the workspace
                    let wsName = appStore.selectedWorkspace?.name ?? "My Workspace"
                    let company: Company = try await APIClient.shared.request(
                        .createCompany(workspaceId: wsId, name: wsName)
                    )
                    appStore.companies.insert(company, at: 0)
                    companyId = company.id
                }

                let dept: Department = try await APIClient.shared.request(
                    .createDepartment(companyId: companyId, name: deptName, description: nil)
                )
                onCreated(dept)
                isPresented = false
            } catch {
                errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
            }
        }
    }
}
