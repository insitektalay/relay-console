import Foundation

public final class AgentWorkDashboardService {
    private let data: LocalDataService

    public init(data: LocalDataService) {
        self.data = data
    }

    public func structureDashboard(context: ServiceRequestContext) throws -> AgentStructureDashboardSnapshot {
        try requireReadAccess(context: context)
        let departments = try data.listAgentOrgDepartments(workspaceId: context.workspaceId)
        let teams = try data.listAgentOrgTeams(workspaceId: context.workspaceId)
        let agents = try data.listAgents(workspaceId: context.workspaceId)
        let tasks = try data.listAgentTasks(workspaceId: context.workspaceId)
        let memory = try data.listAgentTeamMemoryEntries(workspaceId: context.workspaceId)
        let handovers = try data.listAgentTeamHandovers(workspaceId: context.workspaceId)

        let activeAgents = agents.filter { $0.status == "active" }
        let departmentSnapshots = departments.map { department in
            let departmentTeams = teams.filter { $0.departmentId == department.id }
            let departmentTasks = tasks.filter { task in
                activeAgents.contains { agent in
                    agent.departmentId == department.id
                        && (task.assignedAgentId == agent.id || task.targetAgentId == agent.id)
                } || departmentTeams.contains { $0.id == task.targetTeamId }
            }
            return AgentDepartmentDashboardSnapshot(
                departmentId: department.id,
                name: department.name,
                teamCount: departmentTeams.count,
                agentCount: activeAgents.filter { $0.departmentId == department.id }.count,
                runningTaskCount: runningCount(departmentTasks),
                blockedTaskCount: blockedCount(departmentTasks),
                pendingApprovalCount: pendingApprovalCount(departmentTasks),
                openIncidentCount: openIncidentCount(departmentTasks)
            )
        }

        let teamSnapshots = teams.map { team in
            let teamTasks = tasks.filter { task in
                task.targetTeamId == team.id
                    || activeAgents.contains { agent in
                        agent.teamId == team.id
                            && (task.assignedAgentId == agent.id || task.targetAgentId == agent.id)
                    }
            }
            return AgentTeamDashboardSnapshot(
                teamId: team.id,
                name: team.name,
                agentCount: activeAgents.filter { $0.teamId == team.id }.count,
                runningTaskCount: runningCount(teamTasks),
                blockedTaskCount: blockedCount(teamTasks),
                pendingApprovalCount: pendingApprovalCount(teamTasks),
                openIncidentCount: openIncidentCount(teamTasks),
                memoryCount: memory.filter { $0.teamId == team.id }.count,
                handoverCount: handovers.filter { $0.teamId == team.id }.count
            )
        }

        return AgentStructureDashboardSnapshot(
            workspaceId: context.workspaceId,
            departments: departmentSnapshots,
            teams: teamSnapshots,
            totalRunningTasks: runningCount(tasks),
            totalBlockedTasks: blockedCount(tasks),
            totalPendingApprovals: pendingApprovalCount(tasks),
            totalOpenIncidents: openIncidentCount(tasks),
            totalMemoryItems: memory.count,
            totalHandovers: handovers.count
        )
    }

    public func tasksForAgent(context: ServiceRequestContext, agentId: String) throws -> [AgentTask] {
        try requireReadAccess(context: context)
        let agent = try data.getAgent(agentId)
        guard agent.workspaceId == context.workspaceId else {
            throw ServiceGuard.invalidInput(context: context, message: "Selected agent does not belong to this workspace.")
        }
        return try data.listAgentTasks(workspaceId: context.workspaceId, agentId: agentId)
    }

    public func tasksForWorkspace(context: ServiceRequestContext) throws -> [AgentTask] {
        try requireReadAccess(context: context)
        return try data.listAgentTasks(workspaceId: context.workspaceId)
    }

    public func taskRuns(context: ServiceRequestContext, taskId: String) throws -> [AgentTaskRun] {
        try requireReadAccess(context: context)
        let task = try data.getAgentTask(taskId)
        guard task.workspaceId == context.workspaceId else {
            throw ServiceGuard.invalidInput(context: context, message: "Selected task does not belong to this workspace.")
        }
        return try data.listAgentTaskRuns(taskId: taskId)
    }

    public func createTask(
        context: ServiceRequestContext,
        title: String,
        message: String,
        priority: AgentTaskPriority,
        targetType: AgentTaskTargetType,
        targetAgentId: String?,
        targetTeamId: String?,
        preferredThreadId: String? = nil,
        scheduledAt: String?,
        timeZone: String?,
        recurrence: String?,
        requiresApproval: Bool
    ) throws -> AgentTask {
        try requireMutationAccess(context: context)
        let target = try resolveTaskTarget(
            context: context,
            title: title,
            targetType: targetType,
            targetAgentId: targetAgentId,
            targetTeamId: targetTeamId,
            preferredThreadId: preferredThreadId
        )
        return try data.createAgentTask(
            workspaceId: context.workspaceId,
            title: title,
            message: message,
            assignedAgentId: target.assignedAgentId,
            targetAgentId: target.targetAgentId,
            targetTeamId: target.targetTeamId,
            priority: priority,
            targetType: targetType,
            status: requiresApproval ? .blocked : .queued,
            requiresApproval: requiresApproval,
            scheduledAt: scheduledAt,
            timeZone: timeZone,
            recurrence: recurrence,
            threadId: target.threadId,
            metadata: target.metadata
        )
    }

    public func teamMemory(context: ServiceRequestContext, teamId: String) throws -> [AgentTeamMemoryEntry] {
        try requireReadAccess(context: context)
        let team = try data.getAgentOrgTeam(teamId)
        guard team.workspaceId == context.workspaceId else {
            throw ServiceGuard.invalidInput(context: context, message: "Selected team does not belong to this workspace.")
        }
        return try data.listAgentTeamMemoryEntries(workspaceId: context.workspaceId, teamId: teamId)
    }

    public func allTeamMemory(context: ServiceRequestContext) throws -> [AgentTeamMemoryEntry] {
        try requireReadAccess(context: context)
        return try data.listAgentTeamMemoryEntries(workspaceId: context.workspaceId)
    }

    public func teamHandovers(context: ServiceRequestContext, teamId: String) throws -> [AgentTeamHandover] {
        try requireReadAccess(context: context)
        let team = try data.getAgentOrgTeam(teamId)
        guard team.workspaceId == context.workspaceId else {
            throw ServiceGuard.invalidInput(context: context, message: "Selected team does not belong to this workspace.")
        }
        return try data.listAgentTeamHandovers(workspaceId: context.workspaceId, teamId: teamId)
    }

    public func allTeamHandovers(context: ServiceRequestContext) throws -> [AgentTeamHandover] {
        try requireReadAccess(context: context)
        return try data.listAgentTeamHandovers(workspaceId: context.workspaceId)
    }

    public func workCalendar(
        context: ServiceRequestContext,
        groupType: AgentGroupType?,
        dayCount: Int = 30,
        now: Date = Date(),
        timeZone: TimeZone = .current,
        activeGapMinutes: Int = 20
    ) throws -> AgentWorkCalendarSnapshot {
        try requireReadAccess(context: context)
        let safeDayCount = min(max(dayCount, 1), 60)
        let safeActiveGapMinutes = min(max(activeGapMinutes, 1), 240)
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        let endDate = calendar.startOfDay(for: now)
        let startDate = calendar.date(byAdding: .day, value: -(safeDayCount - 1), to: endDate) ?? endDate
        let days = (0..<safeDayCount).compactMap { offset in
            calendar.date(byAdding: .day, value: offset, to: startDate)
        }
        let dayKeys = days.map { Self.dayKey($0, timeZone: timeZone) }
        let agents = try data.listAgents(workspaceId: context.workspaceId)
            .filter { agent in
                agent.status == "active" && groupType.map { effectiveGroup(agent) == $0 } ?? true
            }
            .sorted { $0.name < $1.name }
        let agentIds = Set(agents.map(\.id))
        var activeEvents: [String: [Date]] = [:]
        var activity: [String: [String: Int]] = [:]
        var scheduled: [String: [String: Int]] = [:]
        var completedRuns: [String: [String: Int]] = [:]

        let threads = try data.listThreads(workspaceId: context.workspaceId)
        for thread in threads {
            guard thread.threadType == .direct || thread.threadType == .team else { continue }
            let participantAgentIds = try calendarParticipantAgentIds(thread: thread, allowedAgentIds: agentIds)
            guard !participantAgentIds.isEmpty else { continue }

            for message in try data.listMessages(threadId: thread.id, limit: 500) {
                guard let date = Self.parseIso(message.createdAt) else { continue }
                let eventAgentIds: Set<String>
                switch message.senderType {
                case .agent:
                    if let senderId = message.senderId, agentIds.contains(senderId) {
                        eventAgentIds = [senderId]
                    } else {
                        eventAgentIds = []
                    }
                case .user:
                    eventAgentIds = participantAgentIds
                case .system:
                    eventAgentIds = []
                }
                guard !eventAgentIds.isEmpty else { continue }
                let key = Self.dayKey(date, timeZone: timeZone)
                for agentId in eventAgentIds {
                    activeEvents[agentId, default: []].append(date)
                    activity[agentId, default: [:]][key, default: 0] += 1
                }
            }
        }

        let activeMinutes = activeEvents.mapValues { events in
            Self.activeMinutesByDay(events: events, activeGapMinutes: safeActiveGapMinutes, timeZone: timeZone)
        }

        let tasks = try data.listAgentTasks(workspaceId: context.workspaceId)
        for task in tasks {
            let candidateAgentIds = Set([task.assignedAgentId, task.targetAgentId].compactMap { $0 }.filter { agentIds.contains($0) })
            guard !candidateAgentIds.isEmpty else { continue }
            let date = task.scheduledAt.flatMap(Self.parseIso) ?? Self.parseIso(task.createdAt)
            guard let date else { continue }
            let key = Self.dayKey(date, timeZone: timeZone)
            for agentId in candidateAgentIds {
                scheduled[agentId, default: [:]][key, default: 0] += 1
            }
        }

        let runs = try data.listAgentTaskRuns(workspaceId: context.workspaceId)
        for run in runs {
            guard let agentId = run.agentId,
                  agentIds.contains(agentId),
                  run.status == .completed,
                  let date = (run.completedAt ?? run.startedAt ?? run.createdAt).nilIfBlank.flatMap(Self.parseIso)
            else { continue }
            let key = Self.dayKey(date, timeZone: timeZone)
            completedRuns[agentId, default: [:]][key, default: 0] += 1
        }

        let rows = agents.map { agent in
            let dayRows = dayKeys.map { key in
                AgentWorkCalendarDay(
                    agentId: agent.id,
                    date: key,
                    activityCount: activity[agent.id]?[key] ?? 0,
                    scheduledTaskCount: scheduled[agent.id]?[key] ?? 0,
                    completedRunCount: completedRuns[agent.id]?[key] ?? 0,
                    activeMinutes: activeMinutes[agent.id]?[key] ?? 0
                )
            }
            return AgentWorkCalendarAgentRow(
                agentId: agent.id,
                agentName: agent.name,
                groupType: effectiveGroup(agent),
                days: dayRows,
                totalActivityCount: dayRows.reduce(0) { $0 + $1.activityCount },
                totalScheduledTaskCount: dayRows.reduce(0) { $0 + $1.scheduledTaskCount },
                totalCompletedRunCount: dayRows.reduce(0) { $0 + $1.completedRunCount },
                totalActiveMinutes: dayRows.reduce(0) { $0 + ($1.activeMinutes ?? 0) }
            )
        }

        return AgentWorkCalendarSnapshot(
            workspaceId: context.workspaceId,
            groupType: groupType,
            rangeStart: dayKeys.first ?? Self.dayKey(startDate, timeZone: timeZone),
            rangeEnd: dayKeys.last ?? Self.dayKey(endDate, timeZone: timeZone),
            timeZone: timeZone.identifier,
            derivedFrom: "chat-derived active hours from direct and team threads",
            rows: rows,
            activeGapMinutes: safeActiveGapMinutes
        )
    }

    private func calendarParticipantAgentIds(thread: ThreadSummary, allowedAgentIds: Set<String>) throws -> Set<String> {
        var ids = Set<String>()
        if let selectedAgentId = thread.selectedAgentId, allowedAgentIds.contains(selectedAgentId) {
            ids.insert(selectedAgentId)
        }
        for participant in try data.listThreadParticipants(threadId: thread.id) {
            guard participant.participantType == .agent,
                  let participantId = participant.participantId,
                  allowedAgentIds.contains(participantId),
                  participant.leftAt == nil
            else { continue }
            ids.insert(participantId)
        }
        return ids
    }

    private func requireReadAccess(context: ServiceRequestContext) throws {
        if let denied = ServiceGuard.requireAnyRole(
            [.owner, .admin, .member],
            context: context,
            message: "Reading agent work dashboards requires workspace access."
        ) {
            throw denied
        }
    }

    private func requireMutationAccess(context: ServiceRequestContext) throws {
        if let denied = ServiceGuard.requireAnyRole(
            [.owner, .admin],
            context: context,
            message: "Creating scheduled agent tasks requires owner or admin access."
        ) {
            throw denied
        }
    }

    private struct TaskTargetResolution {
        var assignedAgentId: RelayId?
        var targetAgentId: RelayId?
        var targetTeamId: RelayId?
        var threadId: RelayId?
        var metadata: JSONRecord
    }

    private func resolveTaskTarget(
        context: ServiceRequestContext,
        title: String,
        targetType: AgentTaskTargetType,
        targetAgentId: String?,
        targetTeamId: String?,
        preferredThreadId: String?
    ) throws -> TaskTargetResolution {
        switch targetType {
        case .direct:
            guard let targetAgentId, !targetAgentId.isEmpty else {
                throw ServiceGuard.invalidInput(context: context, message: "Direct task target requires an agent.")
            }
            let agent = try data.getAgent(targetAgentId)
            guard agent.workspaceId == context.workspaceId else {
                throw ServiceGuard.invalidInput(context: context, message: "Target agent does not belong to this workspace.")
            }
            let candidates = try data.listThreads(workspaceId: context.workspaceId).filter {
                $0.threadType == .direct && $0.selectedAgentId == agent.id && !$0.isArchived
            }
            let preferred = preferredThreadId.flatMap { id in
                candidates.first {
                    $0.id == id && ($0.lastMessageAt != nil || !$0.title.hasPrefix("Task: "))
                }
            }
            guard let thread = preferred
                ?? candidates.first(where: { $0.lastMessageAt != nil })
                ?? candidates.first(where: { !$0.title.hasPrefix("Task: ") })
                ?? candidates.first
            else {
                throw ServiceGuard.invalidInput(
                    context: context,
                    message: "Open the direct chat you want to schedule into before creating this task."
                )
            }
            return TaskTargetResolution(
                assignedAgentId: agent.id,
                targetAgentId: agent.id,
                targetTeamId: nil,
                threadId: thread.id,
                metadata: ["targetResolution": .string("direct")]
            )

        case .team:
            guard let targetTeamId, !targetTeamId.isEmpty else {
                throw ServiceGuard.invalidInput(context: context, message: "Team task target requires a team.")
            }
            let team = try data.getAgentOrgTeam(targetTeamId)
            guard team.workspaceId == context.workspaceId else {
                throw ServiceGuard.invalidInput(context: context, message: "Target team does not belong to this workspace.")
            }
            let teamThreads = try data.listThreads(workspaceId: context.workspaceId).filter {
                $0.threadType == .team && !$0.isArchived
            }
            let preferred = preferredThreadId.flatMap { id in
                teamThreads.first {
                    $0.id == id && ($0.lastMessageAt != nil || !$0.title.hasPrefix("Team task: "))
                }
            }
            let leadAgent = team.leadAgentId.flatMap { leadId in
                try? data.getAgent(leadId)
            }
            let preferredAgent = preferred?.selectedAgentId.flatMap { try? data.getAgent($0) }
            let assignedAgent = try preferredAgent
                ?? leadAgent
                ?? data.listAgents(workspaceId: context.workspaceId).first { agent in
                    agent.teamId == team.id && agent.status == "active"
                }
            guard let assignedAgent else {
                throw ServiceGuard.unavailable(
                    context: context,
                    reasonCode: .dependencyMissing,
                    message: "Team task target has no active workspace agent."
                )
            }
            let matchingThreads = try teamThreads.filter { thread in
                let participants = try data.listThreadParticipants(threadId: thread.id)
                if participants.contains(where: {
                    $0.participantType == .team && $0.participantId == team.id && $0.leftAt == nil
                }) {
                    return true
                }
                return participants.contains { participant in
                    guard participant.participantType == .agent,
                          participant.leftAt == nil,
                          let agentId = participant.participantId,
                          let participantAgent = try? data.getAgent(agentId)
                    else { return false }
                    return participantAgent.teamId == team.id
                }
            }
            guard let thread = preferred
                ?? matchingThreads.first(where: { $0.lastMessageAt != nil })
                ?? matchingThreads.first
            else {
                throw ServiceGuard.invalidInput(
                    context: context,
                    message: "Open the team chat you want to schedule into before creating this task."
                )
            }
            return TaskTargetResolution(
                assignedAgentId: assignedAgent.id,
                targetAgentId: nil,
                targetTeamId: team.id,
                threadId: thread.id,
                metadata: ["targetResolution": .string("team")]
            )
        }
    }

    public func resolveExecutionThread(
        context: ServiceRequestContext,
        task: AgentTask
    ) throws -> ThreadDetail {
        guard task.workspaceId == context.workspaceId else {
            throw ServiceGuard.invalidInput(context: context, message: "Task does not belong to this workspace.")
        }
        let target = try resolveTaskTarget(
            context: context,
            title: task.title,
            targetType: task.targetType,
            targetAgentId: task.targetAgentId,
            targetTeamId: task.targetTeamId,
            preferredThreadId: task.threadId
        )
        guard let threadId = target.threadId else {
            throw ServiceGuard.invalidInput(context: context, message: "Task has no target chat.")
        }
        return try data.getThread(threadId)
    }

    private func runningCount(_ tasks: [AgentTask]) -> Int {
        tasks.filter { [.dispatched, .running].contains($0.status) }.count
    }

    private func blockedCount(_ tasks: [AgentTask]) -> Int {
        tasks.filter { $0.status == .blocked }.count
    }

    private func pendingApprovalCount(_ tasks: [AgentTask]) -> Int {
        tasks.filter { $0.status == .blocked && $0.requiresApproval }.count
    }

    private func openIncidentCount(_ tasks: [AgentTask]) -> Int {
        tasks.filter { $0.status == .failed }.count
    }

    private func effectiveGroup(_ agent: AgentWithBinding) -> AgentGroupType {
        switch agent.groupType {
        case .business:
            return .business
        case .family:
            return .family
        case .personal:
            return .personal
        case .unassigned, nil:
            return .personal
        }
    }

    private static func parseIso(_ value: String) -> Date? {
        ISO8601DateFormatter.relayConsole.date(from: value) ?? ISO8601DateFormatter().date(from: value)
    }

    private static func dayKey(_ date: Date, timeZone: TimeZone) -> String {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        let components = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", components.year ?? 1970, components.month ?? 1, components.day ?? 1)
    }

    private static func activeMinutesByDay(events: [Date], activeGapMinutes: Int, timeZone: TimeZone) -> [String: Int] {
        let sortedEvents = events.sorted()
        guard var windowStart = sortedEvents.first else { return [:] }
        var lastEvent = windowStart
        let activeGapSeconds = TimeInterval(activeGapMinutes * 60)
        var minutesByDay: [String: Int] = [:]

        for event in sortedEvents.dropFirst() {
            if event.timeIntervalSince(lastEvent) <= activeGapSeconds {
                lastEvent = event
            } else {
                addActiveInterval(start: windowStart, end: lastEvent.addingTimeInterval(activeGapSeconds), timeZone: timeZone, into: &minutesByDay)
                windowStart = event
                lastEvent = event
            }
        }
        addActiveInterval(start: windowStart, end: lastEvent.addingTimeInterval(activeGapSeconds), timeZone: timeZone, into: &minutesByDay)
        return minutesByDay
    }

    private static func addActiveInterval(start: Date, end: Date, timeZone: TimeZone, into minutesByDay: inout [String: Int]) {
        guard end > start else { return }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        var cursor = start
        while cursor < end {
            let dayStart = calendar.startOfDay(for: cursor)
            let nextDay = calendar.date(byAdding: .day, value: 1, to: dayStart) ?? end
            let segmentEnd = min(end, nextDay)
            let minutes = max(0, Int((segmentEnd.timeIntervalSince(cursor) / 60).rounded()))
            if minutes > 0 {
                minutesByDay[dayKey(cursor, timeZone: timeZone), default: 0] += minutes
            }
            cursor = segmentEnd
        }
    }
}

public enum AgentTaskRecurrenceSchedule {
    public static func nextRun(
        after scheduledAt: Date,
        recurrence: String?,
        timeZoneIdentifier: String?,
        now: Date = Date()
    ) -> Date? {
        guard let recurrence = recurrence?.trimmingCharacters(in: .whitespacesAndNewlines),
              !recurrence.isEmpty,
              recurrence.caseInsensitiveCompare("One-off") != .orderedSame
        else { return nil }

        var calendar = Calendar(identifier: .gregorian)
        if let identifier = timeZoneIdentifier, let timeZone = TimeZone(identifier: identifier) {
            calendar.timeZone = timeZone
        }
        var next = scheduledAt
        for _ in 0..<10_000 {
            switch recurrence.lowercased() {
            case "every 15 minutes", "every_15_minutes":
                next = next.addingTimeInterval(15 * 60)
            case "every 30 minutes", "every_30_minutes":
                next = next.addingTimeInterval(30 * 60)
            case "every 45 minutes", "every_45_minutes":
                next = next.addingTimeInterval(45 * 60)
            case "every hour", "hourly":
                next = next.addingTimeInterval(60 * 60)
            case "every day", "daily":
                guard let value = calendar.date(byAdding: .day, value: 1, to: next) else { return nil }
                next = value
            case "weekdays":
                repeat {
                    guard let value = calendar.date(byAdding: .day, value: 1, to: next) else { return nil }
                    next = value
                } while calendar.isDateInWeekend(next)
            case "every week", "weekly":
                guard let value = calendar.date(byAdding: .weekOfYear, value: 1, to: next) else { return nil }
                next = value
            case "every month", "monthly":
                guard let value = calendar.date(byAdding: .month, value: 1, to: next) else { return nil }
                next = value
            default:
                return nil
            }
            if next > now { return next }
        }
        return nil
    }
}

private extension String {
    var nilIfBlank: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}
