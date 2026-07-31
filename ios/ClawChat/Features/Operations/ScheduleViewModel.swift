// ScheduleViewModel.swift
// ClawChat – Schedule ViewModel
// Swift 6, @Observable, @MainActor

import Foundation
import Observation

@MainActor
@Observable
final class ScheduleViewModel {

    // MARK: - Public State

    var workspaceId: String
    var schedules: [Schedule] = []
    var selectedAgentId: String? = nil
    var isLoading: Bool = false
    var isSaving: Bool = false
    var error: String?

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

    func loadSchedules() async {
        guard !isLoading else { return }
        isLoading = true
        error = nil
        do {
            let response: PaginatedResponse<Schedule> = try await api.requestPaginated(
                .schedules(workspaceId: workspaceId)
            )
            schedules = response.data
        } catch {
            self.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
        isLoading = false
    }

    func refresh() async {
        await loadSchedules()
    }

    // MARK: - Save Schedule

    func saveSchedule(agentId: String, mode: WorkingHoursMode, shifts: [ShiftRule]) async throws {
        guard !isSaving else { return }
        isSaving = true
        defer { isSaving = false }

        let shiftsPayload: [[String: Any]] = shifts.map { shift in
            [
                "id": shift.id,
                "day_of_week": shift.dayOfWeek,
                "start_time": shift.startTime,
                "end_time": shift.endTime,
                "is_active": shift.isActive
            ]
        }

        let updated: Schedule = try await api.request(
            .updateSchedule(agentId: agentId, mode: mode.rawValue, shifts: shiftsPayload)
        )

        if let idx = schedules.firstIndex(where: { $0.agentId == agentId }) {
            schedules[idx] = updated
        } else {
            schedules.append(updated)
        }
    }
}
