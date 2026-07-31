// ReportsViewModel.swift
// ClawChat – Reports ViewModel
// Swift 6, @Observable, @MainActor

import Foundation
import Observation

@MainActor
@Observable
final class ReportsViewModel {

    // MARK: - Public State

    var workspaceId: String
    var reports: [ReportSnapshot] = []
    var wrapUpReports: [ThreadWrapUpReport] = []
    var selectedPeriod: MetricPeriod = .weekly
    var selectedType: ReportType = .performance
    var isLoading: Bool = false
    var isGenerating: Bool = false
    var page: Int = 1
    var hasMore: Bool = true
    var error: String?
    var performanceMetrics: [PerformanceMetric] = []

    // MARK: - Private

    private let api: APIClient

    // MARK: - Init

    init(workspaceId: String, api: APIClient) {
        self.workspaceId = workspaceId
        self.api         = api
    }

    convenience init(workspaceId: String) {
        self.init(workspaceId: workspaceId, api: .shared)
    }

    // MARK: - Load

    func loadReports() async {
        guard !isLoading else { return }
        isLoading = true
        error = nil
        page = 1
        do {
            async let snapshotsTask: PaginatedResponse<ReportSnapshot> = api.requestPaginated(
                .reports(workspaceId: workspaceId, page: 1)
            )
            async let wrapUpsTask: PaginatedResponse<ThreadWrapUpReport> = api.requestPaginated(
                .workspaceWrapUpReports(workspaceId: workspaceId, page: 1)
            )
            let (snapshots, wrapUps) = try await (snapshotsTask, wrapUpsTask)
            reports = snapshots.data
            wrapUpReports = wrapUps.data
            hasMore = snapshots.hasMore
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
            let response: PaginatedResponse<ReportSnapshot> = try await api.requestPaginated(
                .reports(workspaceId: workspaceId, page: nextPage)
            )
            reports.append(contentsOf: response.data)
            page = nextPage
            hasMore = response.hasMore
        } catch {
            self.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
        isLoading = false
    }

    func refresh() async {
        await loadReports()
    }

    func loadPerformanceMetrics(period: String) async {
        do {
            let metrics: [PerformanceMetric] = try await api.request(
                .performanceMetrics(workspaceId: workspaceId, period: period, agentId: nil, teamId: nil)
            )
            performanceMetrics = metrics
        } catch {
            self.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    // MARK: - Generate Report

    func generateReport() async throws {
        guard !isGenerating else { return }
        isGenerating = true
        defer { isGenerating = false }

        let calendar = Calendar.current
        let now = Date()
        let (start, end): (Date, Date)
        switch selectedPeriod {
        case .daily:
            start = calendar.startOfDay(for: now)
            end   = now
        case .weekly:
            start = calendar.date(byAdding: .day, value: -7, to: now) ?? now
            end   = now
        case .monthly:
            start = calendar.date(byAdding: .month, value: -1, to: now) ?? now
            end   = now
        case .custom:
            start = calendar.date(byAdding: .month, value: -1, to: now) ?? now
            end   = now
        }

        let formatter = ISO8601DateFormatter()
        let generated: ReportSnapshot = try await api.request(
            .generateReport(
                workspaceId: workspaceId,
                type: selectedType.rawValue,
                period: selectedPeriod.rawValue,
                start: formatter.string(from: start),
                end: formatter.string(from: end)
            )
        )
        reports.insert(generated, at: 0)
    }
}
