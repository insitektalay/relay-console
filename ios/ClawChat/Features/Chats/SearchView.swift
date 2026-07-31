// SearchView.swift
// ClawChat – Full search screen
// Swift 6, iOS 18, SwiftUI, dark-first design

import SwiftUI
import Combine

// MARK: - Search Tab

private enum SearchTab: String, CaseIterable, Identifiable {
    case threads  = "Chats"
    case messages = "Messages"
    case agents   = "Agents"

    var id: String { rawValue }

    var icon: String {
        switch self {
        case .threads:  return "bubble.left.and.bubble.right"
        case .messages: return "text.bubble"
        case .agents:   return "person.fill"
        }
    }
}

// MARK: - SearchView

@MainActor
struct SearchView: View {
    @EnvironmentObject private var appStore: AppStore
    @Environment(AppCoordinator.self) private var coordinator
    @Binding var isPresented: Bool

    @State private var query: String
    @State private var selectedTab: SearchTab = .threads
    @State private var isSearching: Bool = false
    @State private var recentSearches: [String] = []
    @State private var threadResults: [Thread] = []
    @State private var messageResults: [MessageSearchResult] = []
    @State private var agentResults: [Agent] = []
    @FocusState private var isSearchFocused: Bool
    @State private var searchTask: _Concurrency.Task<Void, Never>? = nil

    init(isPresented: Binding<Bool>, initialQuery: String = "") {
        self._isPresented = isPresented
        self._query = State(initialValue: initialQuery)
    }

    // MARK: - Body

    var body: some View {
        ZStack {
            ClawColors.backgroundPrimary.ignoresSafeArea()

            VStack(spacing: 0) {
                // Search header
                searchHeader

                Rectangle()
                    .fill(ClawColors.separator.opacity(0.6))
                    .frame(height: 0.5)

                if query.trimmingCharacters(in: .whitespaces).isEmpty {
                    recentSearchesView
                } else {
                    searchResultsView
                }
            }
        }
        .preferredColorScheme(.dark)
        .onAppear {
            isSearchFocused = true
            loadRecentSearches()
        }
        .onChange(of: query) { _, newValue in
            debounceSearch(newValue)
        }
    }

    // MARK: - Search Header

    private var searchHeader: some View {
        HStack(spacing: 10) {
            // Search field
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 15))
                    .foregroundStyle(ClawColors.textTertiary)

                TextField(ChatsParityContract.searchPrompt, text: $query)
                    .font(.system(size: 16))
                    .foregroundStyle(ClawColors.textPrimary)
                    .focused($isSearchFocused)
                    .autocorrectionDisabled()
                    .autocapitalization(.none)
                    .submitLabel(.search)
                    .onSubmit {
                        if !query.isEmpty { saveRecentSearch(query) }
                    }

                if isSearching {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: ClawColors.textTertiary))
                        .scaleEffect(0.7)
                        .frame(width: 18, height: 18)
                } else if !query.isEmpty {
                    Button(action: { query = "" }) {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 16))
                            .foregroundStyle(ClawColors.textTertiary)
                            .symbolRenderingMode(.hierarchical)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(ClawColors.backgroundSecondary)
            .clipShape(RoundedRectangle(cornerRadius: RelayRadius.md))
            .overlay(RoundedRectangle(cornerRadius: RelayRadius.md).stroke(RelayColors.borderStandard))

            // Cancel button
            Button("Cancel") {
                isPresented = false
            }
            .font(.system(size: 16))
            .foregroundStyle(ClawColors.accent)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(ClawColors.backgroundPrimary)
    }

    // MARK: - Recent Searches

    private var recentSearchesView: some View {
        VStack(alignment: .leading, spacing: 0) {
            if recentSearches.isEmpty {
                emptyInitialState
            } else {
                // Section header
                HStack {
                    Text("Recent Searches")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(ClawColors.textSecondary)
                        .padding(.horizontal, 16)
                        .padding(.top, 20)
                        .padding(.bottom, 8)

                    Spacer()

                    Button("Clear") {
                        withAnimation {
                            recentSearches = []
                            saveRecentSearches([])
                        }
                    }
                    .font(.system(size: 12))
                    .foregroundStyle(ClawColors.accent)
                    .padding(.horizontal, 16)
                    .padding(.top, 20)
                    .padding(.bottom, 8)
                }

                ForEach(recentSearches, id: \.self) { search in
                    Button(action: { query = search }) {
                        HStack(spacing: 12) {
                            Image(systemName: "clock")
                                .font(.system(size: 15))
                                .foregroundStyle(ClawColors.textTertiary)
                                .frame(width: 20)

                            Text(search)
                                .font(.system(size: 15))
                                .foregroundStyle(ClawColors.textPrimary)

                            Spacer()

                            Button(action: {
                                withAnimation {
                                    recentSearches.removeAll { $0 == search }
                                    saveRecentSearches(recentSearches)
                                }
                            }) {
                                Image(systemName: "xmark")
                                    .font(.system(size: 12, weight: .medium))
                                    .foregroundStyle(ClawColors.textTertiary)
                            }
                            .buttonStyle(.plain)
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 13)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)

                    if search != recentSearches.last {
                        Divider()
                            .background(ClawColors.separator)
                            .padding(.leading, 48)
                    }
                }

                Spacer()
            }
        }
    }

    // MARK: - Empty Initial State

    private var emptyInitialState: some View {
        RelayEmptyState(
            icon: "magnifyingglass",
            title: ChatsParityContract.searchPrompt,
            subtitle: "Find chats, messages, and agents across your workspace."
        )
    }

    // MARK: - Search Results

    private var searchResultsView: some View {
        VStack(spacing: 0) {
            // Tabs
            searchTabBar

            Rectangle()
                .fill(ClawColors.separator.opacity(0.6))
                .frame(height: 0.5)

            // Results
            TabView(selection: $selectedTab) {
                threadResultsTab
                    .tag(SearchTab.threads)

                messageResultsTab
                    .tag(SearchTab.messages)

                agentResultsTab
                    .tag(SearchTab.agents)
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
        }
    }

    // MARK: - Tab Bar

    private var searchTabBar: some View {
        HStack(spacing: 0) {
            ForEach(SearchTab.allCases) { tab in
                Button(action: {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        selectedTab = tab
                    }
                }) {
                    VStack(spacing: 4) {
                        HStack(spacing: 5) {
                            Image(systemName: tab.icon)
                                .font(.system(size: 13))

                            Text(tab.rawValue)
                                .font(.system(size: 14, weight: selectedTab == tab ? .semibold : .regular))
                        }
                        .foregroundStyle(selectedTab == tab ? ClawColors.accent : ClawColors.textSecondary)
                        .padding(.vertical, 10)

                        Rectangle()
                            .fill(selectedTab == tab ? ClawColors.accent : Color.clear)
                            .frame(height: 2)
                            .clipShape(Capsule())
                    }
                }
                .buttonStyle(.plain)
                .frame(maxWidth: .infinity)
            }
        }
        .background(ClawColors.backgroundPrimary)
    }

    // MARK: - Thread Results Tab

    private var threadResultsTab: some View {
        Group {
            if threadResults.isEmpty && !isSearching {
                noResultsView(for: "threads")
            } else {
                List {
                    ForEach(threadResults) { thread in
                        Button(action: {
                            saveRecentSearch(query)
                            isPresented = false
                            coordinator.navigate(to: .thread(thread.id))
                        }) {
                            ThreadRowView(thread: thread)
                        }
                        .buttonStyle(.plain)
                        .listRowBackground(ClawColors.backgroundPrimary)
                        .listRowInsets(EdgeInsets())
                        .listRowSeparator(.hidden)
                    }
                }
                .listStyle(.plain)
                .background(ClawColors.backgroundPrimary)
                .scrollContentBackground(.hidden)
            }
        }
    }

    // MARK: - Message Results Tab

    private var messageResultsTab: some View {
        Group {
            if messageResults.isEmpty && !isSearching {
                noResultsView(for: "messages")
            } else {
                List {
                    ForEach(messageResults) { result in
                        Button(action: {
                            saveRecentSearch(query)
                            isPresented = false
                            coordinator.navigate(to: .thread(result.threadId))
                        }) {
                            MessageSearchResultRow(result: result, query: query)
                        }
                        .buttonStyle(.plain)
                        .listRowBackground(ClawColors.backgroundPrimary)
                        .listRowInsets(EdgeInsets())
                        .listRowSeparator(.hidden)
                    }
                }
                .listStyle(.plain)
                .background(ClawColors.backgroundPrimary)
                .scrollContentBackground(.hidden)
            }
        }
    }

    // MARK: - Agent Results Tab

    private var agentResultsTab: some View {
        Group {
            if agentResults.isEmpty && !isSearching {
                noResultsView(for: "agents")
            } else {
                List {
                    ForEach(agentResults) { agent in
                        Button(action: {
                            saveRecentSearch(query)
                            isPresented = false
                            coordinator.navigate(to: .agentDetail(agent.id))
                        }) {
                            AgentSearchResultRow(agent: agent)
                        }
                        .buttonStyle(.plain)
                        .listRowBackground(ClawColors.backgroundPrimary)
                        .listRowInsets(EdgeInsets())
                        .listRowSeparator(.hidden)
                    }
                }
                .listStyle(.plain)
                .background(ClawColors.backgroundPrimary)
                .scrollContentBackground(.hidden)
            }
        }
    }

    // MARK: - No Results

    private func noResultsView(for type: String) -> some View {
        RelayEmptyState.searchNoResults(query: query)
        .background(ClawColors.backgroundPrimary)
    }

    // MARK: - Search Logic

    private func debounceSearch(_ newQuery: String) {
        searchTask?.cancel()

        let trimmed = newQuery.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else {
            threadResults = []
            messageResults = []
            agentResults = []
            isSearching = false
            return
        }

        searchTask = _Concurrency.Task {
            // Debounce: 300ms
            try? await _Concurrency.Task.sleep(for: .milliseconds(300))
            guard !_Concurrency.Task.isCancelled else { return }

            await performSearch(trimmed)
        }
    }

    private func performSearch(_ q: String) async {
        guard !q.trimmingCharacters(in: .whitespaces).isEmpty else {
            threadResults = []
            messageResults = []
            agentResults = []
            return
        }
        isSearching = true
        defer {
            if query.trimmingCharacters(in: .whitespaces) == q {
                isSearching = false
            }
        }

        guard let wsId = appStore.selectedWorkspace?.id else { return }

        async let threadSearch: PaginatedResponse<Thread> = {
            try await APIClient.shared.requestPaginated(
                .searchThreads(workspaceId: wsId, query: q, page: 1)
            )
        }()

        async let messageSearch: PaginatedResponse<MessageSearchResult> = {
            try await APIClient.shared.requestPaginated(
                .searchMessages(workspaceId: wsId, query: q, page: 1)
            )
        }()

        // Agent results are local (fast)
        let localAgents = appStore.agents.filter {
            $0.name.localizedCaseInsensitiveContains(q) ||
            $0.role.localizedCaseInsensitiveContains(q)
        }

        do {
            let threads = try await threadSearch
            guard isCurrentSearch(q) else { return }
            threadResults = threads.data.filter { $0.type != .agentToAgent }
        } catch {
            guard isCurrentSearch(q) else { return }
            threadResults = appStore.threads.filter {
                $0.type != .agentToAgent && $0.title.localizedCaseInsensitiveContains(q)
            }
        }

        do {
            let messages = try await messageSearch
            guard isCurrentSearch(q) else { return }
            messageResults = messages.data.filter { $0.threadType != .agentToAgent }
        } catch {
            guard isCurrentSearch(q) else { return }
            messageResults = localMessagePreviewResults(matching: q)
        }

        guard isCurrentSearch(q) else { return }
        agentResults = localAgents
    }

    private func isCurrentSearch(_ searchedQuery: String) -> Bool {
        query.trimmingCharacters(in: .whitespaces) == searchedQuery &&
        !_Concurrency.Task.isCancelled
    }

    private func localMessagePreviewResults(matching query: String) -> [MessageSearchResult] {
        appStore.threads.compactMap { thread in
            guard thread.type != .agentToAgent,
                  let preview = thread.lastMessage,
                  preview.content.localizedCaseInsensitiveContains(query) else {
                return nil
            }

            return MessageSearchResult(
                id: "preview:\(thread.id):\(preview.timestamp.timeIntervalSince1970)",
                threadId: thread.id,
                threadTitle: thread.title,
                senderName: preview.senderName ?? "Unknown sender",
                content: preview.content,
                timestamp: preview.timestamp,
                threadType: thread.type
            )
        }
        .sorted { $0.timestamp > $1.timestamp }
    }

    // MARK: - Recent Searches Persistence

    private func loadRecentSearches() {
        recentSearches = UserDefaults.standard
            .stringArray(forKey: "clawchat.recentSearches") ?? []
    }

    private func saveRecentSearch(_ term: String) {
        var searches = recentSearches
        searches.removeAll { $0.lowercased() == term.lowercased() }
        searches.insert(term, at: 0)
        if searches.count > 10 { searches = Array(searches.prefix(10)) }
        recentSearches = searches
        saveRecentSearches(searches)
    }

    private func saveRecentSearches(_ searches: [String]) {
        UserDefaults.standard.set(searches, forKey: "clawchat.recentSearches")
    }
}

// MARK: - MessageSearchResult

struct MessageSearchResult: Identifiable, Codable, Sendable {
    let id: String
    let threadId: String
    let threadTitle: String
    let senderName: String
    let content: String
    let timestamp: Date
    let threadType: ThreadType
}

// MARK: - MessageSearchResultRow

private struct MessageSearchResultRow: View {
    let result: MessageSearchResult
    let query: String

    var body: some View {
        HStack(spacing: 12) {
            // Thread type avatar hint
            ZStack {
                Circle()
                    .fill(Color.threadTypeColor(result.threadType).opacity(0.15))
                    .frame(width: 44, height: 44)

                Image(systemName: "text.bubble.fill")
                    .font(.system(size: 18))
                    .foregroundStyle(Color.threadTypeColor(result.threadType))
            }

            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(result.threadTitle)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(ClawColors.textPrimary)
                        .lineLimit(1)

                    Spacer()

                    Text(result.timestamp.chatTimestamp)
                        .font(.system(size: 11))
                        .foregroundStyle(ClawColors.textSecondary)
                }

                Text(result.senderName)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(ClawColors.accent)

                Text(result.content)
                    .font(.system(size: 13))
                    .foregroundStyle(ClawColors.textSecondary)
                    .lineLimit(2)
            }
        }
        .padding(.vertical, 10)
        .padding(.horizontal, 16)
        .contentShape(Rectangle())
    }
}

// MARK: - AgentSearchResultRow

private struct AgentSearchResultRow: View {
    let agent: Agent

    var body: some View {
        HStack(spacing: 12) {
            ZStack(alignment: .bottomTrailing) {
                AvatarView(
                    name: agent.name,
                    imageUrl: agent.avatarUrl,
                    size: .medium,
                    status: agent.status
                )

                Circle()
                    .fill(Color.agentStatusColor(agent.status))
                    .frame(width: 12, height: 12)
                    .overlay(Circle().stroke(ClawColors.backgroundPrimary, lineWidth: 2))
            }

            VStack(alignment: .leading, spacing: 4) {
                Text(agent.name)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(ClawColors.textPrimary)

                Text(agent.role)
                    .font(.system(size: 13))
                    .foregroundStyle(ClawColors.textSecondary)
                    .lineLimit(1)
            }

            Spacer()

            agentStatusBadge
        }
        .padding(.vertical, 10)
        .padding(.horizontal, 16)
        .contentShape(Rectangle())
    }

    private var agentStatusBadge: some View {
        let statusText: String
        switch agent.status {
        case .onDuty:   statusText = "On Duty"
        case .offDuty:  statusText = "Off Duty"
        case .busy:     statusText = "Busy"
        case .paused:   statusText = "Paused"
        case .idle:     statusText = "Idle"
        case .error:    statusText = "Error"
        }

        return Text(statusText)
            .font(.system(size: 11, weight: .medium))
            .foregroundStyle(Color.agentStatusColor(agent.status))
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(Color.agentStatusColor(agent.status).opacity(0.12))
            .clipShape(Capsule())
    }
}

// MARK: - Preview

#Preview {
    SearchView(isPresented: .constant(true), initialQuery: "marketing")
        .environmentObject(AppStore.preview)
        .environment(AppCoordinator.preview)
}
