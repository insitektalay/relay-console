// AlertsViewModel.swift
// ClawChat – Alerts ViewModel
// Swift 6, @Observable, @MainActor

import Foundation
import Observation

@MainActor
@Observable
final class AlertsViewModel {

    // MARK: - Public State

    var workspaceId: String
    var alerts: [Alert] = []
    var unreadCount: Int = 0
    var isLoading: Bool = false
    var page: Int = 1
    var hasMore: Bool = true
    var error: String?

    // MARK: - Private

    private let api: APIClient
    private let ws: WebSocketClient
    private var wsUnsubscribe: (() -> Void)?
    private let pageSize = 40

    // MARK: - Init

    init(workspaceId: String, api: APIClient, ws: WebSocketClient) {
        self.workspaceId = workspaceId
        self.api         = api
        self.ws          = ws
        // setupWebSocket() is deferred to avoid mutating @Observable state
        // during SwiftUI view body evaluation (causes infinite observation loop on iOS 26).
        // Call setupWebSocket() explicitly after the view appears.
    }

    convenience init(workspaceId: String) {
        self.init(workspaceId: workspaceId, api: .shared, ws: .shared)
    }

    // MARK: - Load

    func loadAlerts() async {
        guard !isLoading else { return }
        isLoading = true
        error = nil
        page = 1
        do {
            let response: PaginatedResponse<Alert> = try await api.requestPaginated(
                .alerts(workspaceId: workspaceId, page: 1, unreadOnly: false)
            )
            alerts = response.data
            hasMore = response.hasMore
            unreadCount = alerts.filter { !$0.isRead }.count
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
            let response: PaginatedResponse<Alert> = try await api.requestPaginated(
                .alerts(workspaceId: workspaceId, page: nextPage, unreadOnly: false)
            )
            alerts.append(contentsOf: response.data)
            page = nextPage
            hasMore = response.hasMore
        } catch {
            self.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
        isLoading = false
    }

    func refresh() async {
        await loadAlerts()
    }

    // MARK: - Actions

    func markRead(alert: Alert) async {
        guard !alert.isRead else { return }
        do {
            let _: Bool = try await api.request(.markAlertRead(id: alert.id))
            if let idx = alerts.firstIndex(where: { $0.id == alert.id }) {
                alerts[idx].isRead = true
            }
            if unreadCount > 0 { unreadCount -= 1 }
        } catch {
            self.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    func markAllRead() async {
        do {
            let _: Bool = try await api.request(.markAllAlertsRead(workspaceId: workspaceId))
            for idx in alerts.indices { alerts[idx].isRead = true }
            unreadCount = 0
        } catch {
            self.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    // MARK: - WebSocket

    func setupWebSocket() {
        wsUnsubscribe = ws.onEvent { [weak self] event in
            _Concurrency.Task { @MainActor [weak self] in
                guard let self else { return }
                if case .alertNew(let alert) = event, alert.workspaceId == self.workspaceId {
                    self.alerts.insert(alert, at: 0)
                    self.unreadCount += 1
                }
            }
        }
    }
}
