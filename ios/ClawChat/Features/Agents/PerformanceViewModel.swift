// PerformanceViewModel.swift
// ClawChat – Agent performance + coaching ViewModel
// Swift 6, @Observable, @MainActor

import Foundation
import Observation

@MainActor
@Observable
final class AgentPerformanceViewModel {

    // MARK: - Public State

    var agentId: String
    var metrics: [PerformanceMetric] = []
    var reviews: [Review] = []
    var coachingNotes: [CoachingNote] = []
    var incidents: [Incident] = []
    var selectedPeriod: MetricPeriod = .weekly {
        didSet { scheduleLoad() }
    }
    var comparisonAgentId: String? = nil {
        didSet { scheduleLoadComparison() }
    }
    var comparisonMetrics: PerformanceMetric? = nil
    var isLoading: Bool = false
    var error: String?

    // MARK: - Private

    private let api: APIClient

    // MARK: - Init

    init(agentId: String, api: APIClient = .shared) {
        self.agentId = agentId
        self.api     = api
    }

    // MARK: - Load

    func load() async {
        isLoading = true
        error = nil

        async let metricsResult: ()       = loadMetrics()
        async let reviewsResult: ()       = loadReviews()
        async let incidentsResult: ()     = loadIncidents()

        await metricsResult
        await reviewsResult
        await incidentsResult

        if comparisonAgentId != nil {
            await loadComparisonMetrics()
        }

        isLoading = false
    }

    // MARK: - Coaching

    func addCoachingNote(content: String, type: CoachingType) async throws {
        // POST to coaching notes endpoint – using a generic approach via updateAgent body
        let note = try await postCoachingNote(agentId: agentId, content: content, type: type)
        coachingNotes.insert(note, at: 0)
    }

    func changePeriod(_ period: MetricPeriod) {
        selectedPeriod = period
        // Load is triggered by didSet
    }

    // MARK: - Private Loaders

    private func loadMetrics() async {
        do {
            // Fetch the single metric for the selected period
            let metric: PerformanceMetric = try await api.request(
                .agentPerformance(agentId: agentId, period: selectedPeriod.rawValue)
            )
            // Replace or append the metric for the current period
            if let idx = metrics.firstIndex(where: { $0.period == metric.period }) {
                metrics[idx] = metric
            } else {
                metrics.append(metric)
            }
        } catch {
            self.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    private func loadReviews() async {
        do {
            let response: PaginatedResponse<Review> = try await api.requestPaginated(
                .agentReviews(agentId: agentId, page: 1)
            )
            reviews = response.data
        } catch {
            self.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    private func loadIncidents() async {
        // Incidents are not directly filterable by agent via the spec endpoint,
        // so we load workspace incidents and filter; for now, leave empty until
        // workspace context is available.
        incidents = []
    }

    private func loadComparisonMetrics() async {
        guard let compId = comparisonAgentId else {
            comparisonMetrics = nil
            return
        }
        do {
            let metric: PerformanceMetric = try await api.request(
                .agentPerformance(agentId: compId, period: selectedPeriod.rawValue)
            )
            comparisonMetrics = metric
        } catch {
            self.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    private func scheduleLoad() {
        _Concurrency.Task { [weak self] in await self?.load() }
    }

    private func scheduleLoadComparison() {
        _Concurrency.Task { [weak self] in await self?.loadComparisonMetrics() }
    }

    // MARK: - Coaching Note POST

    private func postCoachingNote(agentId: String, content: String, type: CoachingType) async throws -> CoachingNote {
        // Uses updateAgent patch with a coaching_notes key; backend should return the note
        let params: [String: Any] = [
            "coaching_note": [
                "content": content,
                "type": type.rawValue
            ]
        ]
        // We repurpose updateAgent as the closest available endpoint.
        // In a real codebase this would be a dedicated endpoint case.
        let note: CoachingNote = try await api.request(.updateAgent(id: agentId, params: params))
        return note
    }
}
