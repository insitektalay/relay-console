// TeamMemoryViewModel.swift
// ClawChat – Team Memory ViewModel
// Swift 6, @Observable, @MainActor

import Foundation
import Observation

@MainActor
@Observable
final class TeamMemoryViewModel {

    // MARK: - Public State

    var teamId: String
    var items: [TeamMemoryItem] = []
    var filteredItems: [TeamMemoryItem] = []
    var searchQuery: String = "" {
        didSet { applyFilters() }
    }
    var typeFilter: MemoryItemType? = nil {
        didSet { applyFilters() }
    }
    var isLoading: Bool = false
    var isAdding: Bool = false
    var page: Int = 1
    var hasMore: Bool = true
    var error: String?

    // MARK: - Private

    private let api: APIClient
    private let pageSize = 40

    // MARK: - Init

    init(teamId: String, api: APIClient = .shared) {
        self.teamId = teamId
        self.api    = api
    }

    // MARK: - Load

    func loadItems() async {
        guard !isLoading else { return }
        isLoading = true
        error = nil
        page = 1
        do {
            let response: PaginatedResponse<TeamMemoryItem> = try await api.requestPaginated(
                .teamMemory(teamId: teamId, page: 1)
            )
            items = response.data
            hasMore = response.hasMore
            applyFilters()
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
            let response: PaginatedResponse<TeamMemoryItem> = try await api.requestPaginated(
                .teamMemory(teamId: teamId, page: nextPage)
            )
            items.append(contentsOf: response.data)
            page = nextPage
            hasMore = response.hasMore
            applyFilters()
        } catch {
            self.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
        isLoading = false
    }

    func refresh() async {
        await loadItems()
    }

    // MARK: - Add Item

    func addItem(title: String, content: String, type: MemoryItemType) async throws {
        guard !isAdding else { return }
        isAdding = true
        defer { isAdding = false }
        error = nil
        let created: TeamMemoryItem = try await api.request(
            .addTeamMemory(teamId: teamId, title: title, content: content, type: type.rawValue)
        )
        items.insert(created, at: 0)
        applyFilters()
    }

    // MARK: - Delete Item

    func deleteItem(_ item: TeamMemoryItem) async throws {
        // Optimistic remove
        items.removeAll { $0.id == item.id }
        applyFilters()
        // Backend deletion would use a dedicated DELETE endpoint
        // not in the spec, so we rely on the optimistic update for now.
    }

    // MARK: - Private

    private func applyFilters() {
        var result = items

        // Filter by type
        if let typeFilter {
            result = result.filter { $0.type == typeFilter }
        }

        // Filter by search query
        let query = searchQuery.trimmingCharacters(in: .whitespaces)
        if !query.isEmpty {
            result = result.filter {
                $0.title.localizedCaseInsensitiveContains(query) ||
                $0.content.localizedCaseInsensitiveContains(query) ||
                $0.tags.contains(where: { $0.localizedCaseInsensitiveContains(query) })
            }
        }

        filteredItems = result.sorted { $0.updatedAt > $1.updatedAt }
    }
}
