// PermissionsView.swift
// ClawChat – Operations: Permission policy management

import SwiftUI
import Combine

// MARK: - ViewModel

@MainActor
final class PermissionsViewState: ObservableObject {
    @Published var policies: [PermissionPolicy] = []
    @Published var selectedScope: PermissionScope = .workspace
    @Published var editingPolicy: PermissionPolicy? = nil
    @Published var showEditor: Bool = false
    @Published var showNewPolicySheet: Bool = false

    var filteredPolicies: [PermissionPolicy] {
        policies.filter { $0.scope == selectedScope }
    }

    func savePolicy(_ policy: PermissionPolicy) {
        if let idx = policies.firstIndex(where: { $0.id == policy.id }) {
            policies[idx] = policy
        } else {
            policies.append(policy)
        }
        showEditor = false
        showNewPolicySheet = false
    }

    func deletePolicy(_ policy: PermissionPolicy) {
        policies.removeAll { $0.id == policy.id }
    }
}

// MARK: - Permission definitions

struct PermissionGroup: Identifiable {
    let id = UUID()
    let category: String
    let icon: String
    let permissions: [PermissionDef]
}

struct PermissionDef: Identifiable {
    let id: String
    let label: String
    let description: String
}

private let permissionGroups: [PermissionGroup] = [
    PermissionGroup(category: "Visibility", icon: "eye.fill", permissions: [
        PermissionDef(id: "view_reviews",      label: "View reviews",              description: "Can see agent performance reviews"),
    ]),
    PermissionGroup(category: "Management", icon: "gearshape.fill", permissions: [
        PermissionDef(id: "manage_schedules",  label: "Manage schedules",          description: "Can create and edit agent schedules"),
        PermissionDef(id: "approve_actions",   label: "Approve actions",           description: "Can approve or reject agent approval requests"),
        PermissionDef(id: "manage_agents",     label: "Manage agents",             description: "Can add, edit, or remove agents"),
    ]),
    PermissionGroup(category: "Communication", icon: "message.fill", permissions: [
        PermissionDef(id: "message_agents",    label: "Message agents",            description: "Can send direct messages to agents"),
        PermissionDef(id: "broadcast_teams",   label: "Broadcast to teams",        description: "Can send broadcast messages to entire teams"),
    ]),
    PermissionGroup(category: "Operational", icon: "bolt.fill", permissions: [
        PermissionDef(id: "create_tasks",      label: "Create tasks",              description: "Can create new tasks and assign to agents"),
        PermissionDef(id: "cancel_tasks",      label: "Cancel tasks",              description: "Can cancel running or queued tasks"),
        PermissionDef(id: "force_run",         label: "Force run",                 description: "Can force run blocked or failed tasks"),
    ]),
]

// MARK: - View

struct PermissionsView: View {
    @StateObject private var vm = PermissionsViewState()
    @EnvironmentObject private var appStore: AppStore
    @State private var permissionsVM: PermissionsViewModel?

    var body: some View {
        NavigationStack {
            ZStack {
                ClawColors.backgroundPrimary.ignoresSafeArea()

                VStack(spacing: 0) {
                    scopeTabBar
                    Divider().background(ClawColors.separator)

                    ScrollView {
                        LazyVStack(spacing: ClawSpacing.md) {
                            if vm.filteredPolicies.isEmpty {
                                emptyState
                            } else {
                                ForEach(vm.filteredPolicies) { policy in
                                    policyRow(policy: policy)
                                }
                            }
                        }
                        .padding(ClawSpacing.lg)
                        .padding(.bottom, ClawSpacing.xxxl)
                    }
                }
            }
            .navigationTitle("Permissions")
            .navigationBarTitleDisplayMode(.large)
            .toolbarBackground(ClawColors.backgroundPrimary, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        let wsId = appStore.selectedWorkspace?.id ?? "ws1"
                        vm.editingPolicy = PermissionPolicy(
                            id: UUID().uuidString,
                            name: "",
                            workspaceId: wsId,
                            scope: vm.selectedScope,
                            scopeId: wsId,
                            permissions: [],
                            createdAt: Date()
                        )
                        vm.showEditor = true
                    } label: {
                        Image(systemName: "plus")
                            .foregroundStyle(ClawColors.accent)
                    }
                }
            }
            .sheet(isPresented: $vm.showEditor) {
                if let policy = vm.editingPolicy {
                    PermissionEditorSheet(policy: policy) { updated in
                        vm.savePolicy(updated)
                        _Concurrency.Task {
                            try? await permissionsVM?.updatePolicy(updated, permissions: updated.permissions)
                        }
                    }
                }
            }
            .task {
                guard let wsId = appStore.selectedWorkspace?.id else { return }
                let pvm = PermissionsViewModel(workspaceId: wsId)
                permissionsVM = pvm
                await pvm.loadPolicies()
                vm.policies = pvm.policies
            }
        }
    }

    // MARK: - Scope Tab Bar

    private var scopeTabBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 0) {
                ForEach([PermissionScope.workspace, .company, .department, .team, .agent], id: \.self) { scope in
                    Button {
                        withAnimation(.easeInOut(duration: 0.15)) {
                            vm.selectedScope = scope
                        }
                    } label: {
                        VStack(spacing: 4) {
                            Text(scope.displayLabel)
                                .font(.system(size: 14, weight: vm.selectedScope == scope ? .semibold : .regular))
                                .foregroundStyle(vm.selectedScope == scope ? ClawColors.accent : ClawColors.textSecondary)
                                .padding(.horizontal, ClawSpacing.lg)
                                .padding(.vertical, ClawSpacing.md)
                            Rectangle()
                                .fill(vm.selectedScope == scope ? ClawColors.accent : Color.clear)
                                .frame(height: 2)
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .background(ClawColors.backgroundPrimary)
    }

    // MARK: - Policy Row

    private func policyRow(policy: PermissionPolicy) -> some View {
        VStack(alignment: .leading, spacing: ClawSpacing.md) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(policy.name)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(ClawColors.textPrimary)

                    HStack(spacing: ClawSpacing.xs) {
                        Text(policy.scope.displayLabel)
                            .font(ClawFonts.caption)
                            .foregroundStyle(ClawColors.accent)
                        Text("·")
                            .foregroundStyle(ClawColors.textTertiary)
                        Text("\(policy.permissions.count) permissions")
                            .font(ClawFonts.caption)
                            .foregroundStyle(ClawColors.textSecondary)
                    }
                }

                Spacer()

                Button {
                    vm.editingPolicy = policy
                    vm.showEditor = true
                } label: {
                    Text("Edit")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(ClawColors.accent)
                        .padding(.horizontal, ClawSpacing.md)
                        .padding(.vertical, ClawSpacing.xs)
                        .background(ClawColors.accent.opacity(0.12))
                        .cornerRadius(ClawRadius.sm)
                }
                .buttonStyle(.plain)
            }

            if !policy.permissions.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: ClawSpacing.xs) {
                        ForEach(policy.permissions.prefix(5), id: \.self) { perm in
                            Text(perm.replacingOccurrences(of: "_", with: " ").capitalized)
                                .font(.system(size: 10, weight: .medium))
                                .foregroundStyle(ClawColors.accentGreen)
                                .padding(.horizontal, ClawSpacing.sm)
                                .padding(.vertical, 3)
                                .background(ClawColors.accentGreen.opacity(0.12))
                                .clipShape(Capsule())
                        }
                        if policy.permissions.count > 5 {
                            Text("+\(policy.permissions.count - 5) more")
                                .font(.system(size: 10))
                                .foregroundStyle(ClawColors.textTertiary)
                        }
                    }
                }
            }
        }
        .padding(ClawSpacing.lg)
        .background(ClawColors.backgroundCard)
        .cornerRadius(ClawRadius.card)
        .overlay(RoundedRectangle(cornerRadius: ClawRadius.card).stroke(ClawColors.separator, lineWidth: 0.5))
        .contextMenu {
            Button(role: .destructive) {
                vm.deletePolicy(policy)
            } label: {
                Label("Delete Policy", systemImage: "trash")
            }
        }
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: ClawSpacing.md) {
            Image(systemName: "lock.shield.fill")
                .font(.system(size: 48))
                .foregroundStyle(ClawColors.textTertiary)
                .padding(.top, ClawSpacing.xxxl)
            Text("No policies")
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(ClawColors.textPrimary)
            Text("No permission policies for this scope. Tap + to create one.")
                .font(ClawFonts.cardBody)
                .foregroundStyle(ClawColors.textSecondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, ClawSpacing.xxxl)
    }
}

// MARK: - Permission Editor Sheet

struct PermissionEditorSheet: View {
    @State var policy: PermissionPolicy
    let onSave: (PermissionPolicy) -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                Section("Policy Name") {
                    TextField("Policy name", text: $policy.name)
                        .foregroundStyle(ClawColors.textPrimary)
                }
                .listRowBackground(ClawColors.backgroundCard)

                Section("Scope") {
                    Picker("Scope", selection: $policy.scope) {
                        ForEach([PermissionScope.workspace, .company, .department, .team, .agent], id: \.self) { scope in
                            Text(scope.displayLabel).tag(scope)
                        }
                    }
                    .pickerStyle(.menu)
                    .foregroundStyle(ClawColors.textPrimary)
                }
                .listRowBackground(ClawColors.backgroundCard)

                ForEach(permissionGroups) { group in
                    Section {
                        ForEach(group.permissions) { perm in
                            permToggleRow(perm: perm)
                        }
                    } header: {
                        HStack(spacing: ClawSpacing.xs) {
                            Image(systemName: group.icon)
                                .font(.system(size: 11))
                            Text(group.category)
                        }
                        .foregroundStyle(ClawColors.textSecondary)
                    }
                    .listRowBackground(ClawColors.backgroundCard)
                }
            }
            .scrollContentBackground(.hidden)
            .background(ClawColors.backgroundPrimary)
            .navigationTitle(policy.name.isEmpty ? "New Policy" : policy.name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(ClawColors.backgroundSecondary, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(ClawColors.accent)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { onSave(policy) }
                        .disabled(policy.name.trimmingCharacters(in: .whitespaces).isEmpty)
                        .foregroundStyle(policy.name.isEmpty ? ClawColors.textTertiary : ClawColors.accent)
                }
            }
        }
        .presentationBackground(ClawColors.backgroundPrimary)
    }

    private func permToggleRow(perm: PermissionDef) -> some View {
        let isOn = Binding<Bool>(
            get: { policy.permissions.contains(perm.id) },
            set: { enabled in
                if enabled {
                    if !policy.permissions.contains(perm.id) {
                        policy.permissions.append(perm.id)
                    }
                } else {
                    policy.permissions.removeAll { $0 == perm.id }
                }
            }
        )

        return Toggle(isOn: isOn) {
            VStack(alignment: .leading, spacing: 2) {
                Text(perm.label)
                    .font(.system(size: 14))
                    .foregroundStyle(ClawColors.textPrimary)
                Text(perm.description)
                    .font(.system(size: 12))
                    .foregroundStyle(ClawColors.textTertiary)
            }
        }
        .tint(ClawColors.accentGreen)
    }
}

// MARK: - Extensions

extension PermissionScope {
    var displayLabel: String {
        switch self {
        case .workspace:  return "Workspace"
        case .company:    return "Company"
        case .department: return "Department"
        case .team:       return "Team"
        case .agent:      return "Agent"
        }
    }
}

// MARK: - Mock Data

extension PermissionPolicy {
    static let mockPolicies: [PermissionPolicy] = [
        PermissionPolicy(id: "pp1", name: "Workspace Admin", workspaceId: "ws1", scope: .workspace, scopeId: "ws1", permissions: ["view_reviews", "manage_schedules", "approve_actions", "manage_agents", "message_agents", "broadcast_teams", "create_tasks", "cancel_tasks", "force_run"], createdAt: Date()),
        PermissionPolicy(id: "pp2", name: "Team Lead", workspaceId: "ws1", scope: .team, scopeId: "team-eng", permissions: ["approve_actions", "message_agents", "create_tasks", "cancel_tasks"], createdAt: Date()),
        PermissionPolicy(id: "pp3", name: "Observer", workspaceId: "ws1", scope: .workspace, scopeId: "ws1", permissions: ["view_reviews"], createdAt: Date()),
        PermissionPolicy(id: "pp4", name: "Dept Manager", workspaceId: "ws1", scope: .department, scopeId: "dept-finance", permissions: ["manage_schedules", "approve_actions", "create_tasks"], createdAt: Date()),
    ]
}

// MARK: - Preview

#Preview {
    PermissionsView()
        .environmentObject(AppStore.preview)
        .preferredColorScheme(.dark)
}
