// AppCoordinator.swift
// ClawChat

import SwiftUI
import SwiftData

// MARK: - Route enum

enum Route: Hashable {
    case login
    case register
    case workspaceSelector
    case createWorkspace
    case main
    case thread(_ threadId: String)
    case agentDetail(_ agentId: String)
    case teamDashboard(teamId: String)
    case taskDetail(taskId: String)
    case approvalDetail(approvalId: String)
    case orgChart
    case settings
    case agentRoster
    case teamMemory(teamId: String)
    case hiringFlow
    case search
    case newThread
}

// Make Route conform to Identifiable for sheet(item:) presentation
extension Route: Identifiable {
    var id: String {
        switch self {
        case .login:                   return "login"
        case .register:                return "register"
        case .workspaceSelector:       return "workspaceSelector"
        case .createWorkspace:         return "createWorkspace"
        case .main:                    return "main"
        case .thread(let id):          return "thread-\(id)"
        case .agentDetail(let id):     return "agent-\(id)"
        case .teamDashboard(let id):   return "team-\(id)"
        case .taskDetail(let id):      return "task-\(id)"
        case .approvalDetail(let id):  return "approval-\(id)"
        case .orgChart:                return "orgChart"
        case .settings:                return "settings"
        case .agentRoster:             return "agentRoster"
        case .teamMemory(let id):      return "teamMemory-\(id)"
        case .hiringFlow:              return "hiringFlow"
        case .search:                  return "search"
        case .newThread:               return "newThread"
        }
    }
}

// MARK: - AppCoordinator

@Observable
@MainActor
final class AppCoordinator {
    var path            = NavigationPath()
    var sheetRoute:      Route? = nil
    var fullScreenRoute: Route? = nil

    /// Threads cached at navigation time so routeDestination never reads appStore.threads.
    /// Reading appStore.threads in routeDestination causes RootView to re-render on every
    /// WS message, which races with back-navigation and permanently freezes the UI.
    @ObservationIgnored private(set) var threadCache: [String: Thread] = [:]

    // MARK: Navigation

    func navigate(to route: Route) {
        Telemetry.shared.setRoute(route.id)
        Telemetry.shared.breadcrumb("Navigate", category: "navigation", attributes: ["route": route.id])
        push(route)
    }

    func navigateToThread(_ thread: Thread) {
        guard thread.type != .agentToAgent else {
            Telemetry.shared.breadcrumb(
                "Ignored removed agent-to-agent thread route",
                category: "navigation",
                attributes: ["threadId": thread.id]
            )
            return
        }
        threadCache[thread.id] = thread
        Telemetry.shared.setThread(thread.id)
        Telemetry.shared.setRoute(Route.thread(thread.id).id)
        Telemetry.shared.breadcrumb(
            "Navigate to thread",
            category: "navigation",
            attributes: ["threadId": thread.id, "threadType": thread.type.rawValue]
        )
        path.append(Route.thread(thread.id))
    }

    func cacheThread(_ thread: Thread) {
        guard thread.type != .agentToAgent else { return }
        threadCache[thread.id] = thread
        Telemetry.shared.breadcrumb("Cached thread route model", category: "navigation", attributes: ["threadId": thread.id])
    }

    func push(_ route: Route) {
        Telemetry.shared.setRoute(route.id)
        path.append(route)
    }

    func pop() {
        guard !path.isEmpty else { return }
        path.removeLast()
    }

    func popToRoot() {
        path.removeLast(path.count)
    }

    func replace(with route: Route) {
        popToRoot()
        push(route)
    }

    func present(sheet route: Route) {
        sheetRoute = route
    }

    func present(fullScreen route: Route) {
        fullScreenRoute = route
    }

    func dismissSheet() {
        sheetRoute = nil
    }

    func dismissFullScreen() {
        fullScreenRoute = nil
    }

    // MARK: Deep link handling

    func handle(url: URL) {
        guard url.scheme == "clawchat",
              let host = url.host else { return }

        let components = url.pathComponents.filter { $0 != "/" }

        switch host {
        case "thread":
            if let id = components.first {
                Telemetry.shared.breadcrumb("Deep link thread", category: "navigation.deeplink", attributes: ["threadId": id])
                push(.thread(id))
            }
        case "agent":
            if let id = components.first { push(.agentDetail(id)) }
        case "task":
            if let id = components.first { push(.taskDetail(taskId: id)) }
        case "approval":
            if let id = components.first { push(.approvalDetail(approvalId: id)) }
        case "team":
            if let id = components.first { push(.teamDashboard(teamId: id)) }
        case "search":
            push(.search)
        case "settings":
            push(.settings)
        default:
            break
        }
    }
}

// MARK: - RootView
// !! NO MOCK DATA — ever. The simulator connects to the real backend like a device.
// !! Do not add #if targetEnvironment(simulator) blocks that bypass auth or inject fake data.

struct RootView: View {
    @EnvironmentObject private var appStore: AppStore
    @Environment(AppCoordinator.self) private var coordinator
    @Environment(\.modelContext) private var modelContext
    @AppStorage(Telemetry.privacyChoiceCompletedKey)
    private var privacyChoiceCompleted = false

    /// True while we attempt to restore a stored session on first launch.
    /// Prevents the login screen flashing before we know if tokens exist.
    @State private var isRestoringSession = true

    var body: some View {
        Group {
            if !privacyChoiceCompleted {
                TelemetryConsentView()
            } else if isRestoringSession {
                // Brief splash while stored tokens are validated
                Color(hex: "#0E0E10").ignoresSafeArea()
            } else if !appStore.isAuthenticated {
                authFlow
            } else if appStore.selectedWorkspace == nil {
                workspaceSelectorFlow
            } else {
                mainAppFlow
            }
        }
        .onChange(of: appStore.isAuthenticated) { _, isAuth in
            if isAuth {
                coordinator.popToRoot()
            }
        }
        .task {
            appStore.configureCache(modelContext)
            // Restore session from stored tokens (Railway backend).
            // If tokens are missing or expired this is a no-op and we show login.
            if (try? await appStore.restoreSession()) == true {
                await appStore.loadWorkspaces()
            }
            isRestoringSession = false
        }
    }

    // MARK: Auth flow

    @ViewBuilder
    private var authFlow: some View {
        @Bindable var coord = coordinator
        NavigationStack(path: $coord.path) {
            LoginView()
                .navigationDestination(for: Route.self) { route in
                    routeDestination(route)
                }
        }
    }

    // MARK: Workspace selector flow

    @ViewBuilder
    private var workspaceSelectorFlow: some View {
        NavigationStack {
            WorkspaceSelectorView()
        }
    }

    // MARK: Main app flow

    @ViewBuilder
    private var mainAppFlow: some View {
        @Bindable var coord = coordinator
        NavigationStack(path: $coord.path) {
            AdaptiveMainView()
                .navigationBarHidden(true)
                .navigationDestination(for: Route.self) { route in
                    routeDestination(route)
                }
        }
        .sheet(item: $coord.sheetRoute) { route in
            NavigationStack { routeDestination(route) }
        }
        .fullScreenCover(item: $coord.fullScreenRoute) { route in
            NavigationStack { routeDestination(route) }
        }
    }

    // MARK: Route -> View

    @ViewBuilder
    private func routeDestination(_ route: Route) -> some View {
        switch route {
        case .login:
            LoginView()
        case .register:
            RegisterView()
        case .workspaceSelector:
            WorkspaceSelectorView()
        case .createWorkspace:
            CreateWorkspaceView()
        case .main:
            MainTabView()
        case .thread(let id):
            if let thread = coordinator.threadCache[id] {
                if thread.type == .agentToAgent {
                    PlaceholderScreenView(title: "Conversation unavailable", icon: "bubble.left.and.bubble.right")
                } else {
                    switch thread.type {
                    case .team, .groupAgent, .department:
                        TeamChatView(thread: thread)
                    default:
                        ThreadView(thread: thread)
                    }
                }
            } else {
                PlaceholderScreenView(title: "Thread", icon: "bubble.left.and.bubble.right.fill")
                    .id(id)
                    .task {
                        Telemetry.shared.capture(
                            message: "Missing cached thread route model",
                            level: .warning,
                            attributes: ["threadId": id]
                        )
                    }
            }
        case .agentDetail(let id):
            if let agent = appStore.agents.first(where: { $0.id == id }) {
                AgentDetailView(agent: agent)
                    .environmentObject(appStore)
            } else {
                PlaceholderScreenView(title: "Agent", icon: "cpu.fill")
            }
        case .teamDashboard(let teamId):
            PlaceholderScreenView(title: "Team", icon: "person.3.fill")
                .id(teamId)
        case .taskDetail(let taskId):
            if let task = appStore.tasks.first(where: { $0.id == taskId }) {
                TaskDetailView(task: task)
            } else {
                PlaceholderScreenView(title: "Task", icon: "checkmark.circle.fill")
                    .id(taskId)
            }
        case .approvalDetail(let id):
            ApprovalCentreView()
                .id(id)
        case .orgChart:
            AgentRosterView(workspaceId: appStore.selectedWorkspace?.id ?? "", initialTab: .structure)
                .environmentObject(appStore)
        case .settings:
            SettingsView()
        case .agentRoster:
            if let workspaceId = appStore.selectedWorkspace?.id {
                AgentRosterView(workspaceId: workspaceId)
                    .environmentObject(appStore)
            } else {
                PlaceholderScreenView(title: "Select a workspace", icon: "building.2.fill")
            }
        case .teamMemory(let teamId):
            PlaceholderScreenView(title: "Team Memory", icon: "brain")
                .id(teamId)
        case .hiringFlow:
            HiringFlowView()
        case .search:
            SearchView(isPresented: .constant(true))
        case .newThread:
            NewThreadView(isPresented: .constant(true))
                .environmentObject(appStore)
        }
    }
}

// MARK: - Preview Support

extension AppCoordinator {
    static var preview: AppCoordinator { AppCoordinator() }
}

struct PlaceholderScreenView: View {
    let title: String
    let icon: String

    var body: some View {
        VStack(spacing: ClawSpacing.lg) {
            Image(systemName: icon)
                .font(.system(size: 44))
                .foregroundStyle(ClawColors.accent)
            Text(title)
                .font(ClawFonts.screenTitle)
                .foregroundStyle(ClawColors.textPrimary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .clawBackground()
        .navigationBarTitleDisplayMode(.inline)
    }
}
