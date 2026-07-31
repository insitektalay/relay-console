// WorkspaceSelectorView.swift
// ClawChat – Workspace selector screen
// Swift 6, iOS 18, SwiftUI, dark-first design

import SwiftUI

enum WorkspaceParityContract {
    static let cardAvatarSize = RelayMetrics.minimumHitTarget
    static let cardMinimumHeight: CGFloat = 68
    static let productName = RelayBrand.productName
}

@MainActor
struct WorkspaceSelectorView: View {
    @EnvironmentObject private var appStore: AppStore

    @State private var workspaces: [Workspace] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var isSelectingId: String? = nil
    @State private var showingCreateWorkspace = false

    // MARK: - Body

    var body: some View {
        ZStack {
            RelayColors.backgroundPrimary.ignoresSafeArea()

            VStack(spacing: 0) {
                // Header
                headerView

                if isLoading && workspaces.isEmpty {
                    skeletonList
                } else if let error = errorMessage, workspaces.isEmpty {
                    errorState(error)
                } else if workspaces.isEmpty {
                    emptyState
                } else {
                    workspaceList
                }

                // Add workspace button
                addWorkspaceButton
                    .padding(.horizontal, RelaySpacing.xl)
                    .padding(.bottom, RelaySpacing.xl)
                    .padding(.top, RelaySpacing.md)
            }
        }
        .preferredColorScheme(.dark)
        .navigationBarHidden(true)
        .sheet(isPresented: $showingCreateWorkspace) {
            NavigationStack {
                CreateWorkspaceView()
            }
            .preferredColorScheme(.dark)
        }
        .task {
            await bootstrapWorkspaces()
        }
    }

    // MARK: - Header

    private var headerView: some View {
        VStack(spacing: RelaySpacing.sm) {
            Spacer().frame(height: RelaySpacing.xxxl)
            RelayBrandLockup(compact: true)

            Text("Choose Workspace")
                .font(RelayFonts.screenTitle)
                .foregroundStyle(RelayColors.textPrimary)

            Text("Select a workspace to continue")
                .font(RelayFonts.cardBody)
                .foregroundStyle(RelayColors.textSecondary)

            Spacer().frame(height: RelaySpacing.lg)
        }
    }

    // MARK: - Workspace List

    private var workspaceList: some View {
        ScrollView {
            LazyVStack(spacing: 12) {
                ForEach(workspaces) { workspace in
                    WorkspaceCard(
                        workspace: workspace,
                        isSelecting: isSelectingId == workspace.id
                    ) {
                        selectWorkspace(workspace)
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 8)
        }
    }

    // MARK: - Skeleton Loading

    private var skeletonList: some View {
        ScrollView {
            LazyVStack(spacing: 12) {
                ForEach(0..<4, id: \.self) { _ in
                    WorkspaceCardSkeleton()
                }
            }
            .padding(.horizontal, 16)
        }
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: 16) {
            Spacer()

            Image(systemName: "folder.badge.questionmark")
                .font(.system(size: 52))
                .foregroundStyle(ClawColors.textTertiary)

            Text("No Workspaces")
                .font(.system(size: 20, weight: .semibold))
                .foregroundStyle(ClawColors.textPrimary)

            Text("Create a workspace to get started with \(WorkspaceParityContract.productName).")
                .font(.system(size: 14))
                .foregroundStyle(ClawColors.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 48)

            Spacer()
        }
    }

    private func errorState(_ error: String) -> some View {
        VStack(spacing: 16) {
            Spacer()

            Image(systemName: "wifi.exclamationmark")
                .font(.system(size: 52))
                .foregroundStyle(ClawColors.accentOrange)

            Text("Couldn’t Load Workspaces")
                .font(.system(size: 20, weight: .semibold))
                .foregroundStyle(ClawColors.textPrimary)

            Text(error)
                .font(.system(size: 14))
                .foregroundStyle(ClawColors.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)

            Button("Try Again") {
                _Concurrency.Task {
                    await loadWorkspaces()
                }
            }
            .font(.system(size: 15, weight: .semibold))
            .foregroundStyle(ClawColors.accent)

            Spacer()
        }
    }

    // MARK: - Add Workspace Button

    private var addWorkspaceButton: some View {
        Button(action: { showingCreateWorkspace = true }) {
            HStack(spacing: 10) {
                Image(systemName: "plus.circle.fill")
                    .font(.system(size: 18))
                    .foregroundStyle(ClawColors.accent)

                Text("Add Workspace")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(ClawColors.accent)
            }
            .frame(maxWidth: .infinity)
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(RelayButtonStyle(size: .md, variant: .secondary))
    }

    // MARK: - Actions

    private func selectWorkspace(_ workspace: Workspace) {
        guard isSelectingId == nil else { return }
        isSelectingId = workspace.id

        Telemetry.shared.breadcrumb(
            "Workspace selected from selector",
            category: "workspace",
            attributes: ["workspaceId": workspace.id]
        )
        appStore.workspaces = workspaces
        appStore.selectWorkspace(workspace)
    }

    private func bootstrapWorkspaces() async {
        isLoading = true
        if !appStore.workspaces.isEmpty {
            Telemetry.shared.breadcrumb("Using cached workspaces", category: "workspace.load", attributes: ["count": appStore.workspaces.count])
            workspaces = appStore.workspaces
            errorMessage = appStore.workspaceError
            isLoading = false
            return
        }

        Telemetry.shared.breadcrumb("Loading workspaces from API", category: "workspace.load")
        await loadWorkspaces()
    }

    private func loadWorkspaces() async {
        guard workspaces.isEmpty else {
            Telemetry.shared.breadcrumb("Skipped workspace load, local list already set", category: "workspace.load", attributes: ["count": workspaces.count])
            isLoading = false
            return
        }

        isLoading = true
        errorMessage = nil
        defer {
            isLoading = false
            Telemetry.shared.breadcrumb(
                "Workspace load finished",
                category: "workspace.load",
                attributes: ["localCount": workspaces.count, "storeCount": appStore.workspaces.count, "hasError": errorMessage != nil]
            )
        }

        do {
            let response: PaginatedResponse<Workspace> = try await APIClient.shared.requestPaginated(.workspaces)
            Telemetry.shared.breadcrumb("Workspace API returned", category: "workspace.load", attributes: ["count": response.data.count])
            workspaces = response.data
            appStore.workspaces = response.data
            appStore.workspaceError = nil
            appStore.restorePreferredWorkspaceIfNeeded()
        } catch {
            let message = (error as? APIError)?.errorDescription ?? error.localizedDescription
            Telemetry.shared.capture(error: error, attributes: ["operation": "workspace.selector.load"])
            errorMessage = message
            appStore.workspaceError = message
        }
    }
}

// MARK: - WorkspaceCard

private struct WorkspaceCard: View {
    let workspace: Workspace
    let isSelecting: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: RelaySpacing.md) {
                WorkspaceAvatar(workspace: workspace, size: WorkspaceParityContract.cardAvatarSize)

                VStack(alignment: .leading, spacing: 5) {
                    HStack(spacing: 8) {
                        Text(workspace.name)
                            .font(.system(size: 17, weight: .bold))
                            .foregroundStyle(ClawColors.textPrimary)
                            .lineLimit(1)

                        WorkspaceTypeBadge(type: workspace.type)
                    }

                    HStack(spacing: 14) {
                        Label("\(workspace.agentCount) agents", systemImage: "person.fill")
                            .font(.system(size: 12))
                            .foregroundStyle(ClawColors.textSecondary)

                        if (workspace.teamCount ?? 0) > 0 {
                            Label("\(workspace.teamCount ?? 0) teams", systemImage: "person.2.fill")
                                .font(.system(size: 12))
                                .foregroundStyle(ClawColors.textSecondary)
                        }
                    }
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 6) {
                    if workspace.unreadCount > 0 {
                        Text("\(workspace.unreadCount)")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, workspace.unreadCount > 9 ? 8 : 6)
                            .padding(.vertical, 3)
                            .background(ClawColors.accent)
                            .clipShape(Capsule())
                    }

                    if isSelecting {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: ClawColors.accent))
                            .scaleEffect(0.75)
                    } else {
                        Image(systemName: "chevron.right")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(ClawColors.textTertiary)
                    }
                }
            }
            .padding(RelaySpacing.md)
            .frame(minHeight: WorkspaceParityContract.cardMinimumHeight)
            .background(RelayColors.backgroundCard)
            .clipShape(RoundedRectangle(cornerRadius: RelayRadius.card))
            .overlay(
                RoundedRectangle(cornerRadius: RelayRadius.card)
                    .stroke(RelayColors.borderStandard, lineWidth: 1)
            )
            .contentShape(RoundedRectangle(cornerRadius: RelayRadius.card))
        }
        .buttonStyle(.plain)
        .disabled(isSelecting)
    }
}

// MARK: - WorkspaceAvatar

struct WorkspaceAvatar: View {
    let workspace: Workspace
    let size: CGFloat

    private var initials: String {
        workspace.name
            .components(separatedBy: " ")
            .prefix(2)
            .compactMap { $0.first.map(String.init) }
            .joined()
            .uppercased()
    }

    private var avatarColor: Color {
        let colors: [Color] = [
            Color(hex: "#0A84FF"), Color(hex: "#30D158"), Color(hex: "#BF5AF2"),
            Color(hex: "#FF9F0A"), Color(hex: "#40C8E0"), Color(hex: "#FF453A")
        ]
        let index = abs(workspace.id.hashValue) % colors.count
        return colors[index]
    }

    var body: some View {
        ZStack {
            if let urlString = workspace.avatarUrl, let url = URL(string: urlString) {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                            .frame(width: size, height: size)
                            .clipShape(RoundedRectangle(cornerRadius: RelayRadius.md))
                    default:
                        initialsView
                    }
                }
            } else {
                initialsView
            }
        }
    }

    private var initialsView: some View {
        ZStack {
            RoundedRectangle(cornerRadius: RelayRadius.md)
                .fill(avatarColor.opacity(0.24))
                .frame(width: size, height: size)

            Text(initials)
                .font(.system(size: size * 0.34, weight: .bold, design: .rounded))
                .foregroundStyle(RelayColors.textPrimary)
        }
    }
}

// MARK: - WorkspaceTypeBadge

private struct WorkspaceTypeBadge: View {
    let type: WorkspaceType

    var body: some View {
        Text(type == .personal ? "Personal" : "Business")
            .font(.system(size: 10, weight: .semibold))
            .foregroundStyle(badgeColor)
            .padding(.horizontal, 7)
            .padding(.vertical, 3)
            .background(badgeColor.opacity(0.15))
            .clipShape(Capsule())
            .overlay(Capsule().stroke(badgeColor.opacity(0.3), lineWidth: 0.5))
    }

    private var badgeColor: Color {
        type == .personal ? ClawColors.accentTeal : ClawColors.accentPurple
    }
}

// MARK: - WorkspaceCardSkeleton

private struct WorkspaceCardSkeleton: View {
    var body: some View {
        HStack(spacing: 14) {
            RoundedRectangle(cornerRadius: RelayRadius.md)
                .fill(ClawColors.backgroundSecondary)
                .frame(width: WorkspaceParityContract.cardAvatarSize, height: WorkspaceParityContract.cardAvatarSize)
                .modifier(ShimmerModifier())

            VStack(alignment: .leading, spacing: 8) {
                RoundedRectangle(cornerRadius: 4)
                    .fill(ClawColors.backgroundTertiary)
                    .frame(height: 16)
                    .frame(maxWidth: .infinity)
                    .modifier(ShimmerModifier())

                RoundedRectangle(cornerRadius: 4)
                    .fill(ClawColors.backgroundTertiary)
                    .frame(height: 12)
                    .frame(width: 100)
                    .modifier(ShimmerModifier())
            }

            Spacer()
        }
        .padding(16)
        .background(ClawColors.backgroundSecondary)
        .clipShape(RoundedRectangle(cornerRadius: ClawRadius.lg))
        .overlay(
            RoundedRectangle(cornerRadius: ClawRadius.lg)
                .stroke(ClawColors.separator, lineWidth: 0.5)
        )
    }
}

#Preview {
    WorkspaceSelectorView()
        .environmentObject(AppStore.preview)
        .environment(AppCoordinator.preview)
}

@MainActor
struct CreateWorkspaceView: View {
    @EnvironmentObject private var appStore: AppStore
    @Environment(\.dismiss) private var dismiss

    @State private var name: String = ""
    @State private var type: WorkspaceType = .business
    @State private var isCreating = false
    @State private var errorMessage: String?
    @FocusState private var isNameFocused: Bool

    private var canCreate: Bool {
        !isCreating && !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var body: some View {
        ZStack {
            RelayColors.backgroundPrimary.ignoresSafeArea()

            VStack(alignment: .leading, spacing: RelaySpacing.xl) {
                VStack(alignment: .leading, spacing: RelaySpacing.sm) {
                    RelayBrandLockup(compact: true)
                    Text("Create Workspace")
                        .font(RelayFonts.screenTitle)
                        .foregroundStyle(RelayColors.textPrimary)

                    Text("Set up a new space for your chats, meetings, and agents.")
                        .font(RelayFonts.cardBody)
                        .foregroundStyle(RelayColors.textSecondary)
                }

                RelayPanel {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Workspace Name")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(ClawColors.textSecondary)

                        TextField("Nexus Labs", text: $name)
                            .textInputAutocapitalization(.words)
                            .autocorrectionDisabled()
                            .focused($isNameFocused)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 14)
                            .background(ClawColors.backgroundSecondary)
                            .clipShape(RoundedRectangle(cornerRadius: ClawRadius.md))
                            .overlay(
                                RoundedRectangle(cornerRadius: ClawRadius.md)
                                    .stroke(isNameFocused ? ClawColors.accent : ClawColors.separator, lineWidth: isNameFocused ? 1.5 : 0.5)
                            )
                    }

                    VStack(alignment: .leading, spacing: 10) {
                        Text("Workspace Type")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(ClawColors.textSecondary)

                        HStack(spacing: 12) {
                            workspaceTypeButton(.business, title: "Business", subtitle: "For teams and organisations")
                            workspaceTypeButton(.personal, title: "Personal", subtitle: "For your own assistant space")
                        }
                    }
                }

                if let errorMessage {
                    HStack(spacing: 8) {
                        Image(systemName: "exclamationmark.circle.fill")
                            .foregroundStyle(ClawColors.accentRed)
                        Text(errorMessage)
                            .font(.system(size: 13))
                            .foregroundStyle(ClawColors.accentRed)
                    }
                }

                Spacer()

                Button(action: submit) {
                    HStack(spacing: RelaySpacing.sm) {
                        if isCreating { ProgressView().controlSize(.small) }
                        Text(isCreating ? "Creating Workspace" : "Create Workspace")
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(RelayButtonStyle(size: .md, variant: .primary))
                .disabled(!canCreate)
                .opacity(canCreate ? 1 : 0.55)
            }
            .padding(.horizontal, RelaySpacing.xl)
            .padding(.top, RelaySpacing.xl)
            .padding(.bottom, RelaySpacing.xl)
        }
        .preferredColorScheme(.dark)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarLeading) {
                Button("Back") {
                    dismiss()
                }
                .foregroundStyle(ClawColors.accent)
            }
        }
    }

    @ViewBuilder
    private func workspaceTypeButton(_ option: WorkspaceType, title: String, subtitle: String) -> some View {
        let isSelected = type == option
        Button(action: { type = option }) {
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text(title)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(ClawColors.textPrimary)
                    Spacer()
                    if isSelected {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundStyle(ClawColors.accent)
                    }
                }

                Text(subtitle)
                    .font(.system(size: 12))
                    .foregroundStyle(ClawColors.textSecondary)
                    .multilineTextAlignment(.leading)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(14)
            .background(isSelected ? RelayColors.backgroundSelected : RelayColors.backgroundCard)
            .clipShape(RoundedRectangle(cornerRadius: RelayRadius.md))
            .overlay(
                RoundedRectangle(cornerRadius: RelayRadius.md)
                    .stroke(isSelected ? RelayColors.borderFocus : RelayColors.borderStandard, lineWidth: isSelected ? 1.5 : 1)
            )
        }
        .buttonStyle(.plain)
    }

    private func submit() {
        guard canCreate else { return }
        errorMessage = nil
        isCreating = true

        _Concurrency.Task {
            do {
                _ = try await appStore.createWorkspace(
                    name: name.trimmingCharacters(in: .whitespacesAndNewlines),
                    type: type
                )
                dismiss()
            } catch {
                errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
            }
            isCreating = false
        }
    }
}
