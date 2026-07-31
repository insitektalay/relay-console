// ChatsViewModel.swift
// ClawChat – Chats / Thread list screen
// Swift 6, @Observable, @MainActor

import Foundation

@MainActor
@Observable
final class ChatsViewModel {

    // MARK: - Public State

    var threads: [Thread] = []
    var filteredThreads: [Thread] = []
    var searchQuery: String = "" {
        didSet { applyFilter() }
    }
    var isLoading: Bool = false
    var error: String?
    var selectedFilter: ThreadFilter = .all {
        didSet { applyFilter() }
    }
    var workspaceId: String
    var page: Int = 1
    var hasMore: Bool = true

    // MARK: - Filter Enum

    enum ThreadFilter: String, CaseIterable {
        case all          = "All"
        case direct       = "Direct"
        case teams        = "Teams"
        case departments  = "Departments"
        case approvals    = "Approvals"
    }

    // MARK: - Private

    private let api: APIClient

    // MARK: - Init

    init(workspaceId: String, api: APIClient = .shared) {
        self.workspaceId = workspaceId
        self.api = api
    }

    // MARK: - Load

    func loadThreads() async {
        guard !isLoading else { return }
        isLoading = true
        error = nil
        page = 1
        do {
            let response: PaginatedResponse<Thread> = try await api.requestPaginated(
                .threads(workspaceId: workspaceId, page: 1, pageSize: 30)
            )
            threads = response.data.filter { $0.type != .agentToAgent }
            hasMore = response.hasMore
            applyFilter()
        } catch {
            self.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
        isLoading = false
    }

    func loadMore() async {
        guard hasMore, !isLoading else { return }
        isLoading = true
        let nextPage = page + 1
        do {
            let response: PaginatedResponse<Thread> = try await api.requestPaginated(
                .threads(workspaceId: workspaceId, page: nextPage, pageSize: 30)
            )
            threads.append(contentsOf: response.data.filter { $0.type != .agentToAgent })
            page = nextPage
            hasMore = response.hasMore
            applyFilter()
        } catch {
            self.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
        isLoading = false
    }

    func refresh() async {
        await loadThreads()
    }

    func updateSearch(_ query: String) {
        searchQuery = query
        // applyFilter() is called via didSet
    }

    // MARK: - Actions

    func pin(_ thread: Thread) async {
        // PATCH thread with isPinned toggled
        let newPinned = !thread.isPinned
        do {
            let _: Thread = try await api.request(
                .updateThread(id: thread.id, params: ["isPinned": newPinned])
            )
            if let idx = threads.firstIndex(where: { $0.id == thread.id }) {
                var t = threads[idx]
                t.isPinned = newPinned
                threads[idx] = t
            }
            applyFilter()
        } catch {
            self.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    func mute(_ thread: Thread) async {
        let newMuted = !thread.isMuted
        do {
            let _: Thread = try await api.request(
                .updateThread(id: thread.id, params: ["isMuted": newMuted])
            )
            if let idx = threads.firstIndex(where: { $0.id == thread.id }) {
                var t = threads[idx]
                t.isMuted = newMuted
                threads[idx] = t
            }
            applyFilter()
        } catch {
            self.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    func markAllRead() async {
        do {
            let _: Bool = try await api.request(.markAllAlertsRead(workspaceId: workspaceId))
            // Reset unread counts locally
            threads = threads.map {
                var t = $0
                t.unreadCount = 0
                return t
            }
            applyFilter()
        } catch {
            self.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    // MARK: - Private: Filter

    private func applyFilter() {
        var result = threads.filter { $0.type != .agentToAgent }

        // Apply type filter
        switch selectedFilter {
        case .all:
            break
        case .direct:
            result = result.filter { $0.type == .direct }
        case .teams:
            result = result.filter { $0.type == .team }
        case .departments:
            result = result.filter { $0.type == .department }
        case .approvals:
            result = result.filter { $0.type == .approval }
        }

        // Apply search
        let query = searchQuery.trimmingCharacters(in: .whitespaces)
        if !query.isEmpty {
            result = result.filter {
                $0.title.localizedCaseInsensitiveContains(query) ||
                ($0.lastMessage?.content.localizedCaseInsensitiveContains(query) ?? false)
            }
        }

        // Pinned first, then sort by last activity
        filteredThreads = result.sorted {
            if $0.isPinned != $1.isPinned { return $0.isPinned }
            let lhs = $0.lastMessage?.timestamp ?? $0.updatedAt
            let rhs = $1.lastMessage?.timestamp ?? $1.updatedAt
            return lhs > rhs
        }
    }
}
