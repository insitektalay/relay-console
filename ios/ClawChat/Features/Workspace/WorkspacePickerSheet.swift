// WorkspacePickerSheet.swift
// ClawChat – Bottom sheet for switching workspaces
// Swift 6, iOS 18, SwiftUI, dark-first design

import SwiftUI

@MainActor
struct WorkspacePickerSheet: View {
    @EnvironmentObject private var appStore: AppStore
    @Environment(AppCoordinator.self) private var coordinator
    @Binding var isPresented: Bool

    @State private var isSwitching: String? = nil

    var body: some View {
        VStack(spacing: 0) {
            // Drag indicator
            dragIndicator

            // Header
            sheetHeader

            // Workspace list
            workspaceList

            // Add workspace row
            addWorkspaceRow

            // Safe area bottom padding
            Color.clear.frame(height: 8)
        }
        .background(RelayColors.backgroundSecondary)
        .clipShape(RoundedRectangle(cornerRadius: RelayRadius.md))
        .overlay(RoundedRectangle(cornerRadius: RelayRadius.md).stroke(RelayColors.borderStrong))
        .preferredColorScheme(.dark)
    }

    // MARK: - Drag Indicator

    private var dragIndicator: some View {
        RoundedRectangle(cornerRadius: 2.5)
            .fill(ClawColors.textTertiary.opacity(0.5))
            .frame(width: 36, height: 5)
            .padding(.top, 10)
            .padding(.bottom, 6)
    }

    // MARK: - Header

    @ViewBuilder private var sheetHeader: some View {
        HStack {
            Text("Workspaces")
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(ClawColors.textPrimary)

            Spacer()

            Button(action: { isPresented = false }) {
                Image(systemName: "xmark.circle.fill")
                    .font(.system(size: 22))
                    .foregroundStyle(ClawColors.textTertiary)
                    .symbolRenderingMode(.hierarchical)
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 14)

        Divider()
            .background(ClawColors.separator)
    }

    // MARK: - Workspace List

    private var workspaceList: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                ForEach(appStore.workspaces) { workspace in
                    workspaceRow(workspace)

                    if workspace.id != appStore.workspaces.last?.id {
                        Divider()
                            .background(ClawColors.separator)
                            .padding(.leading, 72)
                    }
                }
            }
        }
        .frame(maxHeight: 320)
    }

    // MARK: - Workspace Row

    @ViewBuilder
    private func workspaceRow(_ workspace: Workspace) -> some View {
        let isSelected = workspace.id == appStore.selectedWorkspace?.id
        let isBusy = isSwitching == workspace.id

        Button(action: { switchTo(workspace) }) {
            HStack(spacing: 14) {
                // Avatar (compact 48pt)
                WorkspaceAvatar(workspace: workspace, size: RelayMetrics.minimumHitTarget)

                // Info
                VStack(alignment: .leading, spacing: 3) {
                    Text(workspace.name)
                        .font(.system(size: 15, weight: isSelected ? .semibold : .regular))
                        .foregroundStyle(ClawColors.textPrimary)
                        .lineLimit(1)

                    HStack(spacing: 8) {
                        WorkspaceTypeTag(type: workspace.type)

                        if workspace.unreadCount > 0 {
                            Text("\(workspace.unreadCount) unread")
                                .font(.system(size: 11))
                                .foregroundStyle(ClawColors.accent)
                        }
                    }
                }

                Spacer()

                // Right indicator
                if isBusy {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: ClawColors.accent))
                        .scaleEffect(0.75)
                        .frame(width: 22, height: 22)
                } else if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 20))
                        .foregroundStyle(ClawColors.accent)
                } else if workspace.unreadCount > 0 {
                    Text("\(min(workspace.unreadCount, 99))")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, workspace.unreadCount > 9 ? 6 : 5)
                        .padding(.vertical, 3)
                        .background(ClawColors.unreadBadge)
                        .clipShape(Capsule())
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(isSelected ? RelayColors.backgroundSelected : Color.clear)
            .overlay(alignment: .leading) {
                if isSelected { Rectangle().fill(RelayColors.accent).frame(width: 2) }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(isSwitching != nil)
    }

    // MARK: - Add Workspace Row

    private var addWorkspaceRow: some View {
        VStack(spacing: 0) {
            Divider()
                .background(ClawColors.separator)

            Button(action: {
                isPresented = false
                coordinator.navigate(to: .createWorkspace)
            }) {
                HStack(spacing: 14) {
                    ZStack {
                        Circle()
                            .fill(ClawColors.accent.opacity(0.12))
                            .frame(width: 48, height: 48)

                        Image(systemName: "plus")
                            .font(.system(size: 18, weight: .semibold))
                            .foregroundStyle(ClawColors.accent)
                    }

                    Text("Add Workspace")
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(ClawColors.accent)

                    Spacer()
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
        }
    }

    // MARK: - Action

    private func switchTo(_ workspace: Workspace) {
        guard workspace.id != appStore.selectedWorkspace?.id else {
            isPresented = false
            return
        }
        isSwitching = workspace.id

        appStore.selectWorkspace(workspace)
        coordinator.popToRoot()
        coordinator.dismissSheet()
        coordinator.dismissFullScreen()
        isSwitching = nil
        isPresented = false
    }
}

// MARK: - WorkspaceTypeTag (compact, for row)

private struct WorkspaceTypeTag: View {
    let type: WorkspaceType

    var body: some View {
        Text(type == .personal ? "Personal" : "Business")
            .font(.system(size: 10, weight: .medium))
            .foregroundStyle(tagColor)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(tagColor.opacity(0.12))
            .clipShape(Capsule())
    }

    private var tagColor: Color {
        type == .personal ? ClawColors.accentTeal : ClawColors.accentPurple
    }
}

// MARK: - Preview

#Preview {
    Color.black.ignoresSafeArea()
        .sheet(isPresented: .constant(true)) {
            WorkspacePickerSheet(isPresented: .constant(true))
                .environmentObject(AppStore.preview)
                .environment(AppCoordinator.preview)
                .presentationDetents([.medium, .fraction(0.5)])
                .presentationDragIndicator(.hidden)
                .presentationBackground(Color.clear)
        }
}
