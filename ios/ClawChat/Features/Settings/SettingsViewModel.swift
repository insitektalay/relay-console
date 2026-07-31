// SettingsViewModel.swift
// ClawChat – Settings ViewModel
// Swift 6, @Observable, @MainActor

import Foundation
import Observation

@MainActor
@Observable
final class SettingsViewModel {

    // MARK: - Public State

    var user: User?
    var isLoading: Bool = false
    var isSaving: Bool = false
    var error: String?
    var successMessage: String?

    // MARK: - Private

    private let api: APIClient

    // MARK: - Init

    init(api: APIClient, workspaceId: String? = nil) {
        self.api = api
    }

    convenience init(workspaceId: String? = nil) {
        self.init(api: .shared, workspaceId: workspaceId)
    }

    // MARK: - Load

    func load() async {
        isLoading = true
        error = nil
        await loadUser()
        isLoading = false
    }

    // MARK: - Profile Update

    func updateProfile(name: String, avatarUrl: String?) async throws {
        guard !isSaving else { return }
        isSaving = true
        defer { isSaving = false }
        error = nil
        let updated: User = try await api.request(.updateProfile(name: name, avatarUrl: avatarUrl))
        user = updated
        successMessage = "Profile updated successfully."
    }

    // MARK: - Private

    private func loadUser() async {
        do {
            user = try await api.request(.me)
        } catch {
            self.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }
}
