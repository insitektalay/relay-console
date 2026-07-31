// ClawChatApp.swift
// ClawChat

import SwiftUI
import SwiftData

// MARK: - SwiftData ModelContainer

@MainActor
private func makeModelContainer() -> ModelContainer? {
    // Use compile-time flag rather than runtime env-var detection.
    // xcrun simctl launch does not set SIMULATOR_UDID, causing the runtime
    // check to fail and attempt a persistent on-disk store which hangs on iOS 26.
    #if targetEnvironment(simulator)
    let inMemory = true
    #else
    let inMemory = false
    #endif
    let schema = Schema([
        CachedWorkspace.self,
        CachedThread.self,
        CachedMessage.self,
        CachedAgent.self,
        CachedTask.self,
        CachedAlert.self,
    ])

    let config = ModelConfiguration(
        schema: schema,
        isStoredInMemoryOnly: inMemory,
        allowsSave: true
    )

    do {
        return try ModelContainer(for: schema, configurations: config)
    } catch {
        Telemetry.shared.capture(
            error: error,
            attributes: ["operation": "swiftdata.model_container.primary"]
        )
        // Fall back to in-memory store on migration failure
        let fallback = ModelConfiguration(schema: schema, isStoredInMemoryOnly: true)
        do {
            return try ModelContainer(for: schema, configurations: fallback)
        } catch {
            Telemetry.shared.capture(
                error: error,
                attributes: ["operation": "swiftdata.model_container.fallback"]
            )
            return nil
        }
    }
}

// MARK: - RelayConsoleApp

@main
struct RelayConsoleApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

    @StateObject private var appStore = AppStore()
    @State private var coordinator = AppCoordinator()

    @Environment(\.scenePhase) private var scenePhase

    private let modelContainer = makeModelContainer()

    var body: some Scene {
        WindowGroup {
            rootContent
        }
        .onChange(of: scenePhase) { _, newPhase in
            switch newPhase {
            case .active:
                if appStore.isAuthenticated {
                    appStore.connectWebSocket()
                }
            case .background, .inactive:
                break
            @unknown default:
                break
            }
        }
    }

    @ViewBuilder
    private var rootContent: some View {
        let content = RootView()
            .environmentObject(appStore)
            .environment(coordinator)
            .preferredColorScheme(.dark)
            .clawKeyboardDismissable()
            .onOpenURL { url in
                if url.host == "connect" {
                    _Concurrency.Task { @MainActor in
                        do {
                            _ = try await CloudConnectionOnboardingService.shared.accept(url: url)
                            appStore.applySavedCloudConnection()
                            coordinator.replace(with: .login)
                        } catch {
                            appStore.authError = error.localizedDescription
                        }
                    }
                } else {
                    coordinator.handle(url: url)
                }
            }

        if let modelContainer {
            content.modelContainer(modelContainer)
        } else {
            content.overlay(alignment: .top) {
                Text("Offline cache unavailable")
                    .font(.system(size: 12, weight: .medium))
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(ClawColors.backgroundElevated)
                    .foregroundStyle(ClawColors.textSecondary)
                    .clipShape(Capsule())
                    .padding(.top, 8)
            }
        }
    }
}

// MARK: - AppDelegate

@MainActor
final class AppDelegate: NSObject, UIApplicationDelegate {

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        Telemetry.applyPrivacyPreferences()
        ClawAppearance.configure()
        Telemetry.shared.event("app.launch")
        return true
    }
}

// MARK: - SceneDelegate (required by Info.plist)

final class SceneDelegate: NSObject, UIWindowSceneDelegate, @unchecked Sendable {
    var window: UIWindow?

    func scene(
        _ scene: UIScene,
        willConnectTo session: UISceneSession,
        options connectionOptions: UIScene.ConnectionOptions
    ) {
        // SwiftUI manages the window lifecycle; no manual setup needed here.
    }
}

// MARK: - MainTabView

struct MainTabView: View {
    @EnvironmentObject private var appStore: AppStore
    @Environment(AppCoordinator.self) private var coordinator

    @State private var selectedTab: TabItem = .chat

    enum TabItem: Int, Hashable, CaseIterable {
        case chat
        case agents
        case artifacts
        case applications
        case approvals
        case settings

        var title: String {
            switch self {
            case .chat: "Chat"
            case .agents: "Agents"
            case .artifacts: "Artifacts"
            case .applications: "Applications"
            case .approvals: "Approvals"
            case .settings: "Settings"
            }
        }

        var icon: String {
            switch self {
            case .chat: "bubble.left.and.bubble.right"
            case .agents: "square.stack.3d.up"
            case .artifacts: "doc.text"
            case .applications: "rectangle.grid.2x2"
            case .approvals: "checkmark.square"
            case .settings: "gearshape"
            }
        }
    }

    var body: some View {
        selectedContent
        .safeAreaInset(edge: .bottom, spacing: 0) { primaryTabBar }
        .tint(Color(hex: "#A855F7"))
        .task {
            if !appStore.isAuthenticated {
                _ = try? await appStore.restoreSession()
            }
        }
    }

    @ViewBuilder
    private var selectedContent: some View {
        switch selectedTab {
        case .chat:
            MainChatsView()
        case .agents:
            AgentsMenuView(workspaceId: appStore.selectedWorkspace?.id ?? "")
        case .artifacts:
            ArtifactsView(workspaceId: appStore.selectedWorkspace?.id ?? "", agents: appStore.agents)
        case .applications:
            MarketplaceView(workspaceId: appStore.selectedWorkspace?.id ?? "", agents: appStore.agents)
        case .approvals:
            ApprovalCentreView()
        case .settings:
            SettingsView()
        }
    }

    private var primaryTabBar: some View {
        HStack(spacing: 0) {
            ForEach(TabItem.allCases, id: \.self) { tab in
                Button {
                    selectedTab = tab
                } label: {
                    VStack(spacing: 3) {
                        ZStack(alignment: .topTrailing) {
                            Image(systemName: tab.icon)
                                .font(.system(size: 20, weight: selectedTab == tab ? .semibold : .regular))
                                .frame(height: 22)

                            if let badge = badgeCount(for: tab), badge > 0 {
                                Text(badge > 99 ? "99+" : "\(badge)")
                                    .font(.system(size: 8, weight: .bold))
                                    .foregroundStyle(.white)
                                    .padding(.horizontal, 4)
                                    .frame(minWidth: 14, minHeight: 14)
                                    .background(RelayColors.accentRed)
                                    .clipShape(Capsule())
                                    .offset(x: 11, y: -6)
                            }
                        }

                        Text(tab.title)
                            .font(.system(size: 9, weight: selectedTab == tab ? .semibold : .regular))
                            .lineLimit(1)
                            .minimumScaleFactor(0.7)
                    }
                    .foregroundStyle(selectedTab == tab ? Color(hex: "#A855F7") : Color.white.opacity(0.78))
                    .frame(maxWidth: .infinity, minHeight: 54)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(tab.title)
                .accessibilityValue(selectedTab == tab ? "Selected" : "")
                .accessibilityIdentifier("primary-tab-\(tab.title.lowercased())")
            }
        }
        .padding(.top, 5)
        .padding(.horizontal, 2)
        .background(Color(hex: "#06101C"))
        .overlay(alignment: .top) { Rectangle().fill(Color.white.opacity(0.1)).frame(height: 1) }
    }

    private func badgeCount(for tab: TabItem) -> Int? {
        switch tab {
        case .chat: return appStore.threads.reduce(0) { $0 + $1.unreadCount }
        case .approvals: return appStore.pendingApprovals.count
        default: return nil
        }
    }
}

// MARK: - Adaptive Main View

struct AdaptiveMainView: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    var body: some View {
        if horizontalSizeClass == .regular {
            IPadMainView()
        } else {
            MainTabView()
        }
    }
}

// MARK: - iPad Shell

enum IPadPrimaryNavigationContract {
    static let tabs = MainTabView.TabItem.allCases
    static let railWidth: CGFloat = 82
}

enum IPadConversationPaneContract {
    static let title = "Conversations"
    static let searchPrompt = "Search conversations"
    static let icon = "bubble.left.and.bubble.right"
    static let toggleIcon = "sidebar.left"
    static let collapsedWidth: CGFloat = 72
}

struct IPadMainView: View {
    @EnvironmentObject private var appStore: AppStore
    @Environment(AppCoordinator.self) private var coordinator

    @State private var selectedTab: MainTabView.TabItem = .chat
    @State private var selectedThread: Thread?

    var body: some View {
        HStack(spacing: 0) {
            IPadPrimaryNavigationRail(
                selectedTab: $selectedTab,
                unreadChatCount: appStore.threads.reduce(0) { $0 + $1.unreadCount },
                pendingApprovalCount: appStore.pendingApprovals.count
            )
            .frame(width: IPadPrimaryNavigationContract.railWidth)

            Rectangle()
                .fill(ClawColors.separator.opacity(0.7))
                .frame(width: 1)

            selectedContent
        }
        .background(ClawColors.backgroundPrimary)
        .tint(RelayColors.accent)
        .preferredColorScheme(.dark)
        .task {
            if !appStore.isAuthenticated {
                _ = try? await appStore.restoreSession()
            }
        }
    }

    @ViewBuilder
    private var selectedContent: some View {
        switch selectedTab {
        case .chat:
            IPadChatsWorkspaceView(selectedThread: $selectedThread)
                .environmentObject(appStore)
                .environment(coordinator)
        case .agents:
            IPadAgentsWorkspaceView()
                .environmentObject(appStore)
        case .artifacts:
            ArtifactsView(workspaceId: appStore.selectedWorkspace?.id ?? "", agents: appStore.agents)
        case .applications:
            MarketplaceView(workspaceId: appStore.selectedWorkspace?.id ?? "", agents: appStore.agents)
        case .approvals:
            ApprovalCentreView()
        case .settings:
            SettingsView()
        }
    }
}

private struct IPadPrimaryNavigationRail: View {
    @Binding var selectedTab: MainTabView.TabItem
    let unreadChatCount: Int
    let pendingApprovalCount: Int

    var body: some View {
        VStack(spacing: 12) {
            RelayConsoleNavigationMark()
                .frame(width: 42, height: 42)
                .padding(.bottom, 10)

            ForEach(IPadPrimaryNavigationContract.tabs, id: \.self) { tab in
                railButton(for: tab)
            }

            Spacer()
        }
        .padding(.top, 20)
        .padding(.bottom, 16)
        .frame(maxHeight: .infinity)
        .background(RelayColors.backgroundPrimary)
    }

    private func railButton(for tab: MainTabView.TabItem) -> some View {
        Button {
            selectedTab = tab
        } label: {
            ZStack(alignment: .topTrailing) {
                Image(systemName: tab.icon)
                    .font(.system(size: 22, weight: selectedTab == tab ? .semibold : .regular))
                    .foregroundStyle(selectedTab == tab ? RelayColors.accent : Color.white.opacity(0.72))
                    .frame(width: 52, height: 52)
                    .background(selectedTab == tab ? RelayColors.backgroundSelected : Color.clear)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                    .overlay(alignment: .leading) {
                        if selectedTab == tab {
                            RoundedRectangle(cornerRadius: 2)
                                .fill(RelayColors.accent)
                                .frame(width: 3, height: 30)
                        }
                    }

                if let badge = badgeCount(for: tab), badge > 0 {
                    Text(badge > 99 ? "99+" : "\(badge)")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 4)
                        .frame(minWidth: 16, minHeight: 16)
                        .background(RelayColors.accentRed)
                        .clipShape(Capsule())
                        .offset(x: 4, y: -3)
                }
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(tab.title)
        .accessibilityValue(selectedTab == tab ? "Selected" : "")
        .accessibilityIdentifier("ipad-primary-tab-\(tab.title.lowercased())")
    }

    private func badgeCount(for tab: MainTabView.TabItem) -> Int? {
        switch tab {
        case .chat: unreadChatCount
        case .approvals: pendingApprovalCount
        default: nil
        }
    }
}

private struct RelayConsoleNavigationMark: View {
    private let segmentColors = [
        Color(hex: "#0A84FF"),
        Color(hex: "#8B2CF5"),
        Color(hex: "#3155F5"),
        Color(hex: "#10C6C1"),
    ]

    var body: some View {
        ZStack {
            ForEach(segmentColors.indices, id: \.self) { index in
                Circle()
                    .trim(
                        from: CGFloat(index) * 0.25 + 0.018,
                        to: CGFloat(index + 1) * 0.25 - 0.018
                    )
                    .stroke(
                        segmentColors[index],
                        style: StrokeStyle(lineWidth: 11, lineCap: .butt)
                    )
            }
        }
        .rotationEffect(.degrees(-90))
        .padding(5)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(RelayBrand.productName)
    }
}

// MARK: - iPad Chats

private struct IPadChatsWorkspaceView: View {
    @Binding var selectedThread: Thread?

    @EnvironmentObject private var appStore: AppStore
    @Environment(AppCoordinator.self) private var coordinator

    @State private var selectedFilter: ThreadFilter = .all
    @State private var searchText = ""
    @State private var showNewThread = false
    @State private var isConversationPaneExpanded = true

    private var agentsById: [String: Agent] {
        Dictionary(uniqueKeysWithValues: appStore.agents.map { ($0.id, $0) })
    }

    private var filteredThreads: [Thread] {
        let agentsById = agentsById
        var threads: [Thread]
        switch selectedFilter {
        case .all:
            threads = appStore.threads.filter { $0.type != .agentToAgent }
        case .business:
            threads = appStore.threads.filter { thread in
                thread.type != .agentToAgent &&
                thread.agentIds.contains { agentId in
                    guard let agent = agentsById[agentId] else { return false }
                    return hasValue(agent.companyId) || hasValue(agent.departmentId) || hasValue(agent.teamId)
                }
            }
        case .family:
            threads = appStore.threads.filter { thread in
                thread.type != .agentToAgent &&
                thread.agentIds.contains { agentId in
                    guard let agent = agentsById[agentId] else { return false }
                    return !hasValue(agent.companyId) && !hasValue(agent.teamId) && hasValue(agent.groupLabel)
                }
            }
        case .personal:
            threads = appStore.threads.filter { thread in
                thread.type == .direct && thread.agentIds.contains { agentId in
                    guard let agent = agentsById[agentId] else { return false }
                    return !hasValue(agent.companyId) && !hasValue(agent.departmentId) && !hasValue(agent.teamId)
                }
            }
        }

        threads = threads.filter(appStore.shouldDisplayThread)

        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        if !query.isEmpty {
            threads = threads.filter {
                $0.title.localizedCaseInsensitiveContains(query) ||
                ($0.lastMessage?.content.localizedCaseInsensitiveContains(query) ?? false)
            }
        }

        return threads.sorted {
            ($0.lastMessage?.timestamp ?? $0.updatedAt) > ($1.lastMessage?.timestamp ?? $1.updatedAt)
        }
    }

    var body: some View {
        HStack(spacing: 0) {
            if isConversationPaneExpanded {
                threadListPane
                    .frame(minWidth: 340, idealWidth: 390, maxWidth: 430)
            } else {
                collapsedConversationPane
                    .frame(width: IPadConversationPaneContract.collapsedWidth)
            }

            Rectangle()
                .fill(ClawColors.separator.opacity(0.7))
                .frame(width: 1)

            threadDetailPane
        }
        .animation(.easeInOut(duration: 0.2), value: isConversationPaneExpanded)
        .background(ClawColors.backgroundPrimary)
        .task {
            await appStore.ensureWorkspaceReady()
            guard appStore.selectedWorkspace != nil else { return }
            try? await appStore.syncThreads()
            try? await appStore.syncAlerts()
            await appStore.prefetchLatestMessagesForRecentThreads(filteredThreads)
            if selectedThread == nil {
                selectedThread = filteredThreads.first
            }
        }
        .onChange(of: filteredThreads.map(\.id)) { _, ids in
            if let selectedThread, ids.contains(selectedThread.id) {
                return
            }
            selectedThread = filteredThreads.first
        }
        .sheet(isPresented: $showNewThread) {
            NewThreadView(isPresented: $showNewThread)
                .environmentObject(appStore)
                .environment(coordinator)
        }
    }

    private var threadListPane: some View {
        VStack(spacing: 0) {
            IPadPaneHeader(
                title: IPadConversationPaneContract.title,
                subtitle: nil,
                leadingSystemImage: IPadConversationPaneContract.icon,
                secondaryTrailingSystemImage: IPadConversationPaneContract.toggleIcon,
                secondaryTrailingAccessibilityLabel: "Collapse conversations pane",
                secondaryTrailingAction: { isConversationPaneExpanded = false },
                trailingSystemImage: "square.and.pencil",
                trailingAction: { showNewThread = true }
            )

            IPadSearchField(text: $searchText, placeholder: IPadConversationPaneContract.searchPrompt)
                .padding(.horizontal, ClawSpacing.lg)
                .padding(.bottom, ClawSpacing.sm)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: ClawSpacing.sm) {
                    ForEach(ThreadFilter.allCases) { filter in
                        FilterChip(title: filter.rawValue, icon: filter.icon, isSelected: selectedFilter == filter) {
                            selectedFilter = filter
                        }
                    }
                }
                .padding(.horizontal, ClawSpacing.lg)
                .padding(.bottom, ClawSpacing.md)
            }

            if shouldShowSkeleton {
                SkeletonThreadList(count: 10)
            } else if filteredThreads.isEmpty {
                IPadEmptyDetail(
                    icon: selectedFilter.icon,
                    title: "No \(selectedFilter.rawValue == "All" ? "conversations" : selectedFilter.rawValue.lowercased())",
                    subtitle: "Conversations in this workspace will appear here."
                )
            } else {
                List(filteredThreads, selection: $selectedThread) { thread in
                    ThreadRowView(thread: thread, showsStatusIndicator: false)
                        .tag(thread as Thread?)
                        .listRowInsets(EdgeInsets())
                        .listRowBackground(selectedThread?.id == thread.id ? Color.white.opacity(0.07) : ClawColors.backgroundPrimary)
                        .listRowSeparator(.hidden)
                        .onTapGesture {
                            selectThread(thread)
                        }
                }
                .listStyle(.plain)
                .scrollContentBackground(.hidden)
                .refreshable {
                    try? await appStore.syncThreads()
                    await appStore.prefetchLatestMessagesForRecentThreads(filteredThreads)
                }
            }
        }
        .background(ClawColors.backgroundPrimary)
    }

    private var collapsedConversationPane: some View {
        VStack(spacing: 0) {
            Button {
                isConversationPaneExpanded = true
            } label: {
                Image(systemName: IPadConversationPaneContract.toggleIcon)
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(RelayColors.textPrimary)
                    .frame(width: 40, height: 40)
                    .background(RelayColors.backgroundElevated)
                    .clipShape(RoundedRectangle(cornerRadius: RelayRadius.sm))
                    .overlay(RoundedRectangle(cornerRadius: RelayRadius.sm).stroke(RelayColors.borderStandard))
            }
            .buttonStyle(.plain)
            .padding(.top, RelaySpacing.lg)
            .padding(.bottom, RelaySpacing.md)
            .accessibilityLabel("Expand conversations pane")
            .accessibilityIdentifier("ipad-expand-conversations-pane")

            Rectangle()
                .fill(RelayColors.borderLow)
                .frame(height: 1)

            ScrollView {
                LazyVStack(spacing: 8) {
                    ForEach(filteredThreads) { thread in
                        Button {
                            selectThread(thread)
                        } label: {
                            IPadCollapsedConversationAvatar(thread: thread)
                                .frame(width: 54, height: 54)
                                .background(
                                    selectedThread?.id == thread.id
                                        ? RelayColors.backgroundSelected
                                        : Color.clear
                                )
                                .clipShape(RoundedRectangle(cornerRadius: 12))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 12)
                                        .stroke(
                                            selectedThread?.id == thread.id
                                                ? RelayColors.borderFocus
                                                : Color.clear,
                                            lineWidth: 1
                                        )
                                )
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Open conversation \(thread.title)")
                        .accessibilityValue(selectedThread?.id == thread.id ? "Selected" : "")
                    }
                }
                .padding(.vertical, 10)
            }
        }
        .background(RelayColors.backgroundPrimary)
    }

    @ViewBuilder
    private var threadDetailPane: some View {
        if let selectedThread {
            ThreadDetailRouter(thread: selectedThread)
                .id(selectedThread.id)
        } else {
            IPadEmptyDetail(
                icon: "bubble.left.and.bubble.right",
                title: "Select a chat",
                subtitle: "Choose a conversation from the list to start reading."
            )
        }
    }

    private var shouldShowSkeleton: Bool {
        appStore.threads.isEmpty && (appStore.isLoadingThreads || !appStore.hasLoadedThreads)
    }

    private func selectThread(_ thread: Thread) {
        Telemetry.shared.breadcrumb(
            "iPad thread selected",
            category: "thread.open",
            attributes: [
                "threadId": thread.id,
                "workspaceId": thread.workspaceId,
                "threadType": thread.type.rawValue,
            ]
        )
        selectedThread = thread
    }
}

private struct ThreadDetailRouter: View {
    let thread: Thread

    var body: some View {
        switch thread.type {
        case .team, .groupAgent, .department:
            TeamChatView(thread: thread, usesIPadThreadHeader: true)
        default:
            ThreadView(thread: thread, usesIPadThreadHeader: true)
        }
    }
}

private struct IPadCollapsedConversationAvatar: View {
    let thread: Thread

    @EnvironmentObject private var appStore: AppStore

    private var avatarURL: String? {
        ThreadAvatarResolver.resolve(
            thread: thread,
            agents: appStore.agents,
            messageSenderIds: appStore.threadMessageSenderIds[thread.id] ?? []
        ) ?? appStore.threadMessageAgentPreviews[thread.id]?.avatarUrl
    }

    private var clusterMembers: [Agent] {
        ThreadAvatarResolver.clusterMembers(
            thread: thread,
            agents: appStore.agents,
            teams: appStore.teams,
            departments: appStore.departments,
            messageSenderIds: appStore.threadMessageSenderIds[thread.id] ?? []
        )
    }

    var body: some View {
        if clusterMembers.isEmpty {
            AvatarView(name: thread.title, imageUrl: avatarURL, size: .medium, status: nil)
        } else {
            TeamAvatarCluster(teamName: thread.title, members: clusterMembers)
        }
    }
}

// MARK: - iPad Agents

enum IPadAgentsWorkspaceContract {
    static let menuMaxWidth: CGFloat = 760
}

private struct IPadAgentsWorkspaceView: View {
    @EnvironmentObject private var appStore: AppStore

    var body: some View {
        AgentsMenuView(
            workspaceId: appStore.selectedWorkspace?.id ?? "",
            contentMaxWidth: IPadAgentsWorkspaceContract.menuMaxWidth
        )
    }
}

// MARK: - iPad Console

private struct IPadConsoleWorkspaceView: View {
    @EnvironmentObject private var appStore: AppStore
    @Environment(AppCoordinator.self) private var coordinator
    @State private var selectedDestination: ConsoleDestination? = .artifacts

    var body: some View {
        HStack(spacing: 0) {
            consoleList
                .frame(minWidth: 340, idealWidth: 390, maxWidth: 430)
            Rectangle()
                .fill(ClawColors.separator.opacity(0.7))
                .frame(width: 1)
            consoleDetail
        }
        .background(ClawColors.backgroundPrimary)
    }

    private var consoleList: some View {
        VStack(spacing: 0) {
            IPadPaneHeader(title: "Console", subtitle: "Relay sections and remote tools")
            ScrollView {
                ConsoleIndexContent(
                    hasWorkspace: appStore.selectedWorkspace != nil,
                    workspaceName: appStore.selectedWorkspace?.name,
                    pendingApprovalCount: appStore.pendingApprovals.count,
                    unreadAlertCount: appStore.unreadAlertCount,
                    selection: selectedDestination,
                    onSelect: { selectedDestination = $0 }
                )
                .padding(.horizontal, RelaySpacing.lg)
                .padding(.bottom, RelaySpacing.xl)
            }
        }
        .background(RelayColors.backgroundPrimary)
    }

    @ViewBuilder
    private var consoleDetail: some View {
        NavigationStack {
            ConsoleDestinationView(destination: selectedDestination ?? .artifacts)
                .environmentObject(appStore)
        }
    }
}

// MARK: - iPad Shared Components

private struct IPadPaneHeader: View {
    let title: String
    let subtitle: String?
    var leadingSystemImage: String? = nil
    var secondaryTrailingSystemImage: String? = nil
    var secondaryTrailingAccessibilityLabel: String? = nil
    var secondaryTrailingAction: (() -> Void)? = nil
    var trailingSystemImage: String?
    var trailingAction: (() -> Void)?

    var body: some View {
        HStack(spacing: ClawSpacing.md) {
            if let leadingSystemImage {
                Image(systemName: leadingSystemImage)
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(RelayColors.textSecondary)
                    .frame(width: 34, height: 34)
                    .background(RelayColors.backgroundElevated)
                    .clipShape(RoundedRectangle(cornerRadius: RelayRadius.sm))
                    .overlay(RoundedRectangle(cornerRadius: RelayRadius.sm).stroke(RelayColors.borderStandard))
            }
            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(RelayFonts.screenTitle)
                    .foregroundStyle(RelayColors.textPrimary)
                if let subtitle {
                    Text(subtitle)
                        .font(RelayFonts.caption)
                        .foregroundStyle(RelayColors.textSecondary)
                        .lineLimit(1)
                }
            }
            Spacer()
            if let secondaryTrailingSystemImage, let secondaryTrailingAction {
                Button(action: secondaryTrailingAction) {
                    Image(systemName: secondaryTrailingSystemImage)
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(RelayColors.textPrimary)
                        .frame(width: 38, height: 38)
                        .background(RelayColors.backgroundElevated)
                        .clipShape(RoundedRectangle(cornerRadius: RelayRadius.sm))
                        .overlay(RoundedRectangle(cornerRadius: RelayRadius.sm).stroke(RelayColors.borderStandard))
                }
                .buttonStyle(.plain)
                .accessibilityLabel(secondaryTrailingAccessibilityLabel ?? "Pane action")
            }
            if let trailingSystemImage, let trailingAction {
                Button(action: trailingAction) {
                    Image(systemName: trailingSystemImage)
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(.white)
                        .frame(width: 38, height: 38)
                        .background(RelayColors.backgroundSelected)
                        .clipShape(RoundedRectangle(cornerRadius: RelayRadius.sm))
                        .overlay(RoundedRectangle(cornerRadius: RelayRadius.sm).stroke(RelayColors.borderFocus))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, RelaySpacing.lg)
        .padding(.top, RelaySpacing.lg)
        .padding(.bottom, RelaySpacing.md)
        .background(RelayColors.backgroundPrimary)
    }
}

private struct IPadSearchField: View {
    @Binding var text: String
    let placeholder: String

    var body: some View {
        HStack(spacing: ClawSpacing.sm) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 15, weight: .medium))
                .foregroundStyle(ClawColors.textTertiary)
            TextField(placeholder, text: $text)
                .font(.system(size: 15))
                .foregroundStyle(ClawColors.textPrimary)
                .textInputAutocapitalization(.never)
                .disableAutocorrection(true)
                .tint(ClawColors.accent)
            if !text.isEmpty {
                Button {
                    text = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 14))
                        .foregroundStyle(ClawColors.textTertiary)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, ClawSpacing.md)
        .padding(.vertical, 10)
        .background(ClawColors.backgroundSecondary)
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(ClawColors.separator.opacity(0.7), lineWidth: 1)
        )
    }
}

private struct IPadEmptyDetail: View {
    let icon: String
    let title: String
    let subtitle: String

    var body: some View {
        VStack(spacing: ClawSpacing.md) {
            Image(systemName: icon)
                .font(.system(size: 44, weight: .semibold))
                .foregroundStyle(ClawColors.accent)
                .frame(width: 78, height: 78)
                .background(ClawColors.accent.opacity(0.12))
                .clipShape(RoundedRectangle(cornerRadius: 18))
            Text(title)
                .font(.system(size: 22, weight: .bold))
                .foregroundStyle(ClawColors.textPrimary)
            Text(subtitle)
                .font(.system(size: 15))
                .foregroundStyle(ClawColors.textSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 420)
        }
        .padding(ClawSpacing.xl)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(ClawColors.backgroundPrimary)
    }
}

private func hasValue(_ value: String?) -> Bool {
    guard let value else { return false }
    return !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
}
