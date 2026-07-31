// WrapUpViewModel.swift
// ClawChat – Thread wrap-up report generation and viewing

import Foundation
import Observation

@MainActor
@Observable
final class WrapUpViewModel {
    var wrapUps: [ThreadWrapUp] = []
    var isGenerating = false
    var isLoading = false
    var error: String?

    func load(threadId: String) async {
        isLoading = true
        defer { isLoading = false }
        do {
            let response: PaginatedResponse<ThreadWrapUp> = try await APIClient.shared.requestPaginated(
                .threadWrapUps(threadId: threadId, page: 1)
            )
            wrapUps = response.data
        } catch {
            self.error = error.localizedDescription
        }
    }

    func generate(threadId: String) async {
        guard !isGenerating else { return }
        isGenerating = true
        defer { isGenerating = false }
        error = nil
        do {
            let wrapUp: ThreadWrapUp = try await APIClient.shared.request(
                .generateWrapUp(threadId: threadId)
            )
            wrapUps.insert(wrapUp, at: 0)
            // Poll until ready (max 30s)
            await poll(id: wrapUp.id, threadId: threadId)
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func poll(id: String, threadId: String, attempts: Int = 0) async {
        guard attempts < 15 else { return }
        try? await _Concurrency.Task.sleep(nanoseconds: 2_000_000_000)
        do {
            let updated: ThreadWrapUp = try await APIClient.shared.request(.wrapUp(id: id))
            if let idx = wrapUps.firstIndex(where: { $0.id == id }) {
                wrapUps[idx] = updated
            }
            if updated.status == .generating || updated.status == .pending {
                await poll(id: id, threadId: threadId, attempts: attempts + 1)
            }
        } catch {}
    }
}
