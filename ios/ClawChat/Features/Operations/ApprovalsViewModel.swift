// ApprovalsViewModel.swift
// ClawChat – Approvals list ViewModel
// Swift 6, @Observable, @MainActor

import Foundation
import Observation

@MainActor
@Observable
final class ApprovalsViewModel {

    // MARK: - Public State

    var workspaceId: String
    var approvals: [Approval] = []
    var pendingCount: Int = 0
    var isLoading: Bool = false
    var statusFilter: ApprovalStatus? = .pending {
        didSet { scheduleLoad() }
    }
    var page: Int = 1
    var hasMore: Bool = true
    var error: String?

    // MARK: - Private

    private let api: APIClient
    private let pageSize = 30

    // MARK: - Init

    init(workspaceId: String, api: APIClient = .shared) {
        self.workspaceId = workspaceId
        self.api         = api
    }

    // MARK: - Load

    func loadApprovals() async {
        guard !isLoading else { return }
        isLoading = true
        error = nil
        page = 1
        do {
            let response: PaginatedResponse<Approval> = try await api.requestPaginated(
                .approvals(workspaceId: workspaceId, page: 1, status: statusFilter?.rawValue)
            )
            approvals = response.data
            hasMore = response.hasMore

            // Always sync the pending count from a fresh pending query
            if statusFilter != .pending {
                let pendingResponse: PaginatedResponse<Approval> = try await api.requestPaginated(
                    .approvals(workspaceId: workspaceId, page: 1, status: ApprovalStatus.pending.rawValue)
                )
                pendingCount = pendingResponse.total
            } else {
                pendingCount = response.total
            }
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
            let response: PaginatedResponse<Approval> = try await api.requestPaginated(
                .approvals(workspaceId: workspaceId, page: nextPage, status: statusFilter?.rawValue)
            )
            approvals.append(contentsOf: response.data)
            page = nextPage
            hasMore = response.hasMore
        } catch {
            self.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
        isLoading = false
    }

    func refresh() async {
        await loadApprovals()
    }

    // MARK: - Actions

    func approve(approval: Approval, notes: String?) async throws {
        let updated: Approval = try await api.request(
            .resolveApproval(id: approval.id, decision: "approved", notes: notes)
        )
        applyUpdate(updated)
        if pendingCount > 0 { pendingCount -= 1 }
    }

    func reject(approval: Approval, notes: String) async throws {
        let updated: Approval = try await api.request(
            .resolveApproval(id: approval.id, decision: "rejected", notes: notes)
        )
        applyUpdate(updated)
        if pendingCount > 0 { pendingCount -= 1 }
    }

    // MARK: - Private

    private func scheduleLoad() {
        _Concurrency.Task { [weak self] in await self?.loadApprovals() }
    }

    private func applyUpdate(_ updated: Approval) {
        if let idx = approvals.firstIndex(where: { $0.id == updated.id }) {
            // If the current filter is pending, remove resolved items from the list
            if statusFilter == .pending && updated.status != .pending {
                approvals.remove(at: idx)
            } else {
                approvals[idx] = updated
            }
        }
    }
}
