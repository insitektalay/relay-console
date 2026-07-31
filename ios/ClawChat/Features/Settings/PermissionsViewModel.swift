// PermissionsViewModel.swift
// ClawChat – Permissions ViewModel
// Swift 6, @Observable, @MainActor

import Foundation
import Observation

@MainActor
@Observable
final class PermissionsViewModel {

    // MARK: - Public State

    var workspaceId: String
    var policies: [PermissionPolicy] = []
    var isLoading: Bool = false
    var isSaving: Bool = false
    var error: String?
    var successMessage: String?

    // MARK: - Private

    private let api: APIClient

    // MARK: - Init

    init(workspaceId: String, api: APIClient = .shared) {
        self.workspaceId = workspaceId
        self.api         = api
    }

    // MARK: - Load

    func loadPolicies() async {
        guard !isLoading else { return }
        isLoading = true
        error = nil
        do {
            let response: PaginatedResponse<PermissionPolicy> = try await api.requestPaginated(
                .permissions(workspaceId: workspaceId)
            )
            policies = response.data
        } catch {
            self.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
        isLoading = false
    }

    func refresh() async {
        await loadPolicies()
    }

    // MARK: - Update Policy

    func updatePolicy(_ policy: PermissionPolicy, permissions: [String]) async throws {
        guard !isSaving else { return }
        isSaving = true
        defer { isSaving = false }
        error = nil
        let updated: PermissionPolicy = try await api.request(
            .updatePermission(id: policy.id, permissions: permissions)
        )
        if let idx = policies.firstIndex(where: { $0.id == updated.id }) {
            policies[idx] = updated
        }
        successMessage = "Permissions updated for \(policy.name)."
    }
}
