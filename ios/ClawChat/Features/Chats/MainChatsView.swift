// MainChatsView.swift
// ClawChat – Main chats screen (Telegram-inspired)
// Swift 6, iOS 18, SwiftUI, dark-first design

import SwiftUI

// MARK: - Thread Filter

enum ThreadFilter: String, CaseIterable, Identifiable {
    case all      = "All"
    case business = "Business"
    case family   = "Family"
    case personal = "Personal"

    var id: String { rawValue }

    var icon: String {
        switch self {
        case .all:      return "bubble.left.and.bubble.right"
        case .business: return "building.2"
        case .family:   return "house"
        case .personal: return "person"
        }
    }
}

enum ChatsParityContract {
    static let title = "Chats"
    static let searchPrompt = "Search Relay Console"
    static let newThreadTitle = "New Chat"
}

// MARK: - MainChatsView

@MainActor
struct MainChatsView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @EnvironmentObject private var appStore: AppStore
    @Environment(AppCoordinator.self) private var coordinator

    @State private var selectedFilter: ThreadFilter = .all
    @State private var selectedDepartmentId: String? = nil
    @State private var searchText: String = ""
    @State private var showWorkspacePicker: Bool = false
    @State private var showSearchScreen: Bool = false
    @State private var showNewThread: Bool = false
    @State private var scrollToTop: Bool = false

    // MARK: - Body

    var body: some View {
        ZStack {
            ClawColors.backgroundPrimary.ignoresSafeArea()

            VStack(spacing: 0) {
                // Custom navigation header
                navHeader

                // Filter chips
                filterChipsRow

                // Subtle separator
                Rectangle()
                    .fill(ClawColors.separator.opacity(0.6))
                    .frame(height: 0.5)

                // Thread list
                threadListView
            }
        }
        .navigationBarHidden(true)
        .preferredColorScheme(.dark)
        .sheet(isPresented: $showWorkspacePicker) {
            WorkspacePickerSheet(isPresented: $showWorkspacePicker)
                .environmentObject(appStore)
                .environment(coordinator)
                .presentationDetents([.medium, .fraction(0.5)])
                .presentationDragIndicator(.hidden)
                .presentationBackground(ClawColors.backgroundSecondary)
        }
        .sheet(isPresented: $showSearchScreen) {
            SearchView(isPresented: $showSearchScreen, initialQuery: searchText)
                .environmentObject(appStore)
                .environment(coordinator)
        }
        .sheet(isPresented: $showNewThread) {
            NewThreadView(isPresented: $showNewThread)
                .environmentObject(appStore)
                .environment(coordinator)
        }
        .task {
            await appStore.ensureWorkspaceReady()
            guard appStore.selectedWorkspace != nil else { return }
            try? await appStore.syncThreads()
            try? await appStore.syncAlerts()
            await appStore.prefetchLatestMessagesForRecentThreads(filteredThreads)
        }
        .onChange(of: appStore.isAuthenticated) { _, isAuthenticated in
            guard isAuthenticated else { return }
            _Concurrency.Task {
                await appStore.ensureWorkspaceReady()
                guard appStore.selectedWorkspace != nil else { return }
                try? await appStore.syncThreads()
                try? await appStore.syncAlerts()
                await appStore.prefetchLatestMessagesForRecentThreads(filteredThreads)
            }
        }
        .onChange(of: appStore.selectedWorkspace) { _, workspace in
            guard workspace != nil else { return }
            _Concurrency.Task {
                try? await appStore.syncThreads()
                try? await appStore.syncAlerts()
                await appStore.prefetchLatestMessagesForRecentThreads(filteredThreads)
            }
        }
    }

    // MARK: - Navigation Header

    private var navHeader: some View {
        HStack(alignment: .center, spacing: RelaySpacing.md) {
            // Title + workspace picker
            VStack(alignment: .leading, spacing: 1) {
                Text(ChatsParityContract.title)
                    .font(RelayFonts.navigationTitle)
                    .foregroundStyle(RelayColors.textPrimary)

                if let ws = appStore.selectedWorkspace {
                    Button(action: { showWorkspacePicker = true }) {
                        HStack(spacing: 4) {
                            Text(ws.name)
                                .font(.system(size: 12, weight: .medium))
                                .foregroundStyle(ClawColors.accent)
                            Image(systemName: "chevron.down")
                                .font(.system(size: 10, weight: .semibold))
                                .foregroundStyle(ClawColors.accent)
                        }
                    }
                    .buttonStyle(.plain)
                }
            }

            Spacer()

            // Search button
            RelayIconButton(icon: "magnifyingglass", label: "Search chats", action: { showSearchScreen = true })

            // Compose / New chat
            RelayIconButton(icon: "square.and.pencil", label: "New chat", action: { showNewThread = true })
        }
        .padding(.horizontal, RelaySpacing.lg)
        .padding(.vertical, RelaySpacing.sm)
        .background(RelayColors.backgroundSecondary)
        .overlay(alignment: .bottom) { Rectangle().fill(RelayColors.borderLow).frame(height: 1) }
    }

    // MARK: - Filter Chips

    private var filterChipsRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                Spacer().frame(width: 8)

                ForEach(ThreadFilter.allCases) { filter in
                    FilterChip(
                        title: filter.rawValue,
                        icon: filter.icon,
                        isSelected: selectedFilter == filter
                    ) {
                        withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.15)) {
                            selectedFilter = filter
                            selectedDepartmentId = nil
                        }
                    }
                }

                Spacer().frame(width: 8)
            }
            .padding(.vertical, 10)
        }
        .background(ClawColors.backgroundPrimary)
    }

    // MARK: - Thread List

    private var threadListView: some View {
        Group {
            if shouldShowThreadSkeleton {
                threadSkeletonList
            } else if let error = appStore.threadLoadError, appStore.threads.isEmpty {
                retryStateView(message: error)
            } else if filteredThreads.isEmpty {
                emptyStateView
            } else {
                List {
                    ForEach(filteredThreads) { thread in
                        Button {
                            Telemetry.shared.breadcrumb(
                                "Thread tapped",
                                category: "thread.open",
                                attributes: ["threadId": thread.id, "workspaceId": thread.workspaceId, "threadType": thread.type.rawValue]
                            )
                            coordinator.navigateToThread(thread)
                        } label: {
                            ThreadRowView(thread: thread)
                        }
                        .buttonStyle(.plain)
                        .listRowBackground(ClawColors.backgroundPrimary)
                        .listRowInsets(EdgeInsets())
                        .listRowSeparator(.hidden)
                        .listRowSeparatorTint(ClawColors.separator.opacity(0.4))
                        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                            Button(role: .destructive) {
                                _Concurrency.Task {
                                    _ = try? await APIClient.shared.request(
                                        .updateThread(id: thread.id, params: ["isArchived": true])
                                    ) as Thread
                                    try? await appStore.syncThreads()
                                }
                            } label: {
                                Label("Archive", systemImage: "archivebox")
                            }
                        }
                    }
                }
                .listStyle(.plain)
                .background(ClawColors.backgroundPrimary)
                .scrollContentBackground(.hidden)
                .refreshable {
                    try? await appStore.syncThreads()
                }
                .environment(\.defaultMinListRowHeight, 0)
            }
        }
    }

    private var shouldShowThreadSkeleton: Bool {
        guard appStore.threads.isEmpty else { return false }
        if appStore.selectedWorkspace == nil { return true }
        return appStore.isLoadingThreads || !appStore.hasLoadedThreads
    }

    // MARK: - Thread Skeleton

    private var threadSkeletonList: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                ForEach(0..<12, id: \.self) { _ in
                    ThreadRowSkeleton()
                    Rectangle()
                        .fill(ClawColors.separator.opacity(0.3))
                        .frame(height: 0.4)
                        .padding(.leading, 80)
                }
            }
        }
        .background(ClawColors.backgroundPrimary)
    }

    // MARK: - Empty State

    private var emptyStateView: some View {
        RelayEmptyState(icon: selectedFilter.icon, title: emptyTitle, subtitle: emptySubtitle)
            .relayScreenBackground()
    }

    private func retryStateView(message: String) -> some View {
        VStack(spacing: RelaySpacing.lg) {
            Spacer()
            RelayErrorPanel(message: "Chats couldn't load. \(message)")
                .padding(.horizontal, RelaySpacing.xl)
            Button {
                _Concurrency.Task { try? await appStore.syncThreads() }
            } label: {
                Text("Retry")
            }
            .buttonStyle(RelayButtonStyle(size: .md, variant: .secondary))
            Spacer()
        }
        .background(ClawColors.backgroundPrimary)
    }

    // MARK: - Computed

    private var filteredThreads: [Thread] {
        var threads: [Thread]
        switch selectedFilter {
        case .all:
            threads = appStore.threads.filter { $0.type != .agentToAgent }
        case .business:
            threads = appStore.threads.filter { thread in
                thread.type != .agentToAgent && thread.agentIds.contains { agentId in
                    guard let agent = appStore.agents.first(where: { $0.id == agentId }) else { return false }
                    return agent.companyId != nil
                }
            }
            if let deptId = selectedDepartmentId {
                threads = threads.filter { thread in
                    thread.agentIds.contains { agentId in
                        appStore.agents.first(where: { $0.id == agentId })?.departmentId == deptId
                    }
                }
            }
        case .family:
            // Family threads: agents not attached to a company and in a personal/family context
            threads = appStore.threads.filter { thread in
                thread.type != .agentToAgent && thread.agentIds.contains { agentId in
                    guard let agent = appStore.agents.first(where: { $0.id == agentId }) else { return false }
                    return agent.companyId == nil && agent.teamId == nil
                }
            }
        case .personal:
            // Personal threads: single-agent direct threads with no company affiliation
            threads = appStore.threads.filter { thread in
                thread.type == .direct && thread.agentIds.contains { agentId in
                    appStore.agents.first(where: { $0.id == agentId })?.companyId == nil
                }
            }
        }

        threads = threads.filter(appStore.shouldDisplayThread)

        let query = searchText.trimmingCharacters(in: .whitespaces).lowercased()
        if !query.isEmpty {
            threads = threads.filter {
                $0.title.lowercased().contains(query) ||
                ($0.lastMessage?.content.lowercased().contains(query) ?? false)
            }
        }

        return threads.sorted { a, b in
            let aDate = a.lastMessage?.timestamp ?? a.updatedAt
            let bDate = b.lastMessage?.timestamp ?? b.updatedAt
            return aDate > bDate
        }
    }

    private var emptyTitle: String {
        if selectedFilter == .all {
            return "No Chats Yet"
        }
        return "No \(selectedFilter.rawValue)"
    }

    private var emptySubtitle: String {
        if selectedFilter == .all {
            return "Start a conversation with an agent or team to get going."
        }
        return "There are no \(selectedFilter.rawValue.lowercased()) threads in this workspace."
    }

}

// MARK: - FilterChip

struct FilterChip: View {
    let title: String
    let icon: String
    let isSelected: Bool
    let unreadCount: Int
    let action: () -> Void

    init(title: String, icon: String = "", isSelected: Bool, unreadCount: Int = 0, action: @escaping () -> Void) {
        self.title = title
        self.icon = icon
        self.isSelected = isSelected
        self.unreadCount = unreadCount
        self.action = action
    }

    var body: some View {
        Button(action: action) {
            HStack(spacing: 5) {
                if !icon.isEmpty && isSelected {
                    Image(systemName: icon)
                        .font(.system(size: 11, weight: .semibold))
                }

                Text(title)
                    .font(.system(size: 13, weight: isSelected ? .semibold : .regular))

                if unreadCount > 0 && !isSelected {
                    Text("\(min(unreadCount, 99))")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 5)
                        .padding(.vertical, 1)
                        .background(ClawColors.accent)
                        .clipShape(Capsule())
                }
            }
            .foregroundStyle(isSelected ? RelayColors.accent : RelayColors.textSecondary)
            .padding(.horizontal, 13)
            .frame(minHeight: RelayMetrics.minimumHitTarget)
            .background(
                isSelected
                    ? RelayColors.backgroundSelected
                    : RelayColors.backgroundSecondary
            )
            .clipShape(RoundedRectangle(cornerRadius: RelayRadius.sm))
            .overlay(
                RoundedRectangle(cornerRadius: RelayRadius.sm)
                    .stroke(
                        isSelected ? RelayColors.borderFocus : RelayColors.borderStandard,
                        lineWidth: 1
                    )
            )
        }
        .buttonStyle(.plain)
        .animation(.easeInOut(duration: 0.15), value: isSelected)
    }
}

// MARK: - SearchBar

struct SearchBar: View {
    @Binding var text: String
    let placeholder: String
    var onTap: (() -> Void)? = nil

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 15))
                .foregroundStyle(ClawColors.textTertiary)

            TextField(placeholder, text: $text)
                .font(.system(size: 15))
                .foregroundStyle(ClawColors.textPrimary)

            if !text.isEmpty {
                Button(action: { text = "" }) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 15))
                        .foregroundStyle(ClawColors.textTertiary)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 9)
        .background(ClawColors.backgroundSecondary)
        .clipShape(RoundedRectangle(cornerRadius: RelayRadius.md))
        .overlay(RoundedRectangle(cornerRadius: RelayRadius.md).stroke(RelayColors.borderStandard))
        .onTapGesture {
            onTap?()
        }
    }
}

// MARK: - ThreadRowSkeleton

private struct ThreadRowSkeleton: View {
    var body: some View {
        HStack(spacing: 12) {
            Circle()
                .fill(ClawColors.backgroundSecondary)
                .frame(width: 52, height: 52)
                .modifier(ShimmerModifier())

            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    RoundedRectangle(cornerRadius: 4)
                        .fill(ClawColors.backgroundSecondary)
                        .frame(width: 140, height: 14)
                        .modifier(ShimmerModifier())

                    Spacer()

                    RoundedRectangle(cornerRadius: 4)
                        .fill(ClawColors.backgroundSecondary)
                        .frame(width: 40, height: 11)
                        .modifier(ShimmerModifier())
                }

                RoundedRectangle(cornerRadius: 4)
                    .fill(ClawColors.backgroundSecondary)
                    .frame(maxWidth: .infinity)
                    .frame(height: 12)
                    .modifier(ShimmerModifier())

                RoundedRectangle(cornerRadius: 4)
                    .fill(ClawColors.backgroundSecondary)
                    .frame(width: 180, height: 12)
                    .modifier(ShimmerModifier())
            }
        }
        .padding(.vertical, 9)
        .padding(.horizontal, 16)
    }
}

#Preview {
    MainChatsView()
        .environmentObject(AppStore.preview)
        .environment(AppCoordinator.preview)
}
