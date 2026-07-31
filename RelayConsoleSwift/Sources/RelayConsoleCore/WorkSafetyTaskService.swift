import Foundation

public struct WorkSafetyTaskServiceRequest: Codable, Equatable, Sendable {
    public var title: String
    public var message: String?
    public var targetType: WorkSafetyTaskTargetType
    public var targetId: RelayId?
    public var assignedAgentId: RelayId?
    public var approvalRequired: Bool
    public var approvalId: RelayId?
    public var scheduledAt: IsoTimestamp?
    public var recurrenceRule: String?
    public var priority: Int
    public var riskLevel: WorkSafetyRiskLevel
    public var metadata: JSONRecord

    public init(
        title: String,
        message: String? = nil,
        targetType: WorkSafetyTaskTargetType,
        targetId: RelayId? = nil,
        assignedAgentId: RelayId? = nil,
        approvalRequired: Bool = false,
        approvalId: RelayId? = nil,
        scheduledAt: IsoTimestamp? = nil,
        recurrenceRule: String? = nil,
        priority: Int = 0,
        riskLevel: WorkSafetyRiskLevel = .medium,
        metadata: JSONRecord = [:]
    ) {
        self.title = title
        self.message = message
        self.targetType = targetType
        self.targetId = targetId
        self.assignedAgentId = assignedAgentId
        self.approvalRequired = approvalRequired
        self.approvalId = approvalId
        self.scheduledAt = scheduledAt
        self.recurrenceRule = recurrenceRule
        self.priority = priority
        self.riskLevel = riskLevel
        self.metadata = metadata
    }
}

public struct WorkSafetyTaskDispatchResult: Codable, Equatable, Sendable {
    public var task: WorkSafetyTaskRecord
    public var run: WorkSafetyTaskRunRecord
    public var event: WorkSafetyTaskEventRecord?

    public init(task: WorkSafetyTaskRecord, run: WorkSafetyTaskRunRecord, event: WorkSafetyTaskEventRecord?) {
        self.task = task
        self.run = run
        self.event = event
    }
}

public struct WorkSafetyApprovalDecisionResult: Codable, Equatable, Sendable {
    public var approval: WorkSafetyApprovalRecord
    public var task: WorkSafetyTaskRecord?
    public var note: WorkSafetyApprovalNoteRecord?
    public var event: WorkSafetyTaskEventRecord?

    public init(
        approval: WorkSafetyApprovalRecord,
        task: WorkSafetyTaskRecord?,
        note: WorkSafetyApprovalNoteRecord?,
        event: WorkSafetyTaskEventRecord?
    ) {
        self.approval = approval
        self.task = task
        self.note = note
        self.event = event
    }
}

public final class WorkSafetyTaskService {
    private let data: LocalDataService
    private let permissions: PermissionPolicyService?

    public init(data: LocalDataService, permissions: PermissionPolicyService? = nil) {
        self.data = data
        self.permissions = permissions
    }

    @discardableResult
    public func createTask(
        context: ServiceRequestContext,
        request: WorkSafetyTaskServiceRequest,
        now: Date = Date()
    ) throws -> WorkSafetyTaskRecord {
        try requireMutationAccess(context: context, resourceType: "work_safety_task", action: "create")
        let title = try requireText(request.title, field: "Task title", context: context, maxLength: 200)
        let message = try optionalText(request.message, field: "Task message", context: context, maxLength: 32000)
        let recurrence = try optionalText(request.recurrenceRule, field: "Recurrence", context: context, maxLength: 160)
        let timestamp = iso(now)
        let resolution = try resolveTarget(
            context: context,
            title: title,
            targetType: request.targetType,
            targetId: request.targetId,
            assignedAgentId: request.assignedAgentId
        )
        let approvalId = request.approvalRequired ? (request.approvalId ?? createRelayId("wsa")) : request.approvalId
        let status: WorkSafetyTaskStatus = request.approvalRequired ? .blockedByApproval : .queued
        let taskId = createRelayId("wst")
        var metadata = request.metadata.merging(resolution.metadata) { _, new in new }
        metadata["source"] = .string("work-safety-task-service")
        metadata["executionAttempted"] = .bool(false)
        metadata["runtimeOutputCreated"] = .bool(false)
        if request.approvalRequired {
            metadata["approvalGate"] = .string("pending")
        }

        let task = try data.saveWorkSafetyTask(
            WorkSafetyTaskRecord(
                id: taskId,
                workspaceId: context.workspaceId,
                title: title,
                message: message,
                status: status,
                targetType: request.targetType,
                targetId: resolution.targetId,
                assignedAgentId: resolution.assignedAgentId,
                threadId: resolution.threadId,
                runtimeBindingId: resolution.runtimeBindingId,
                linkedReferences: WorkSafetyLinkedReferences(
                    actionRunId: nil,
                    dispatchId: nil,
                    structuredJobId: nil,
                    sourceHostRecordId: nil,
                    scheduledMessageId: scheduledMessageId(for: request.scheduledAt)
                ),
                approvalRequired: request.approvalRequired,
                approvalId: approvalId,
                scheduledAt: request.scheduledAt,
                recurrenceRule: recurrence,
                priority: request.priority,
                riskLevel: request.riskLevel,
                metadata: metadata,
                createdAt: timestamp,
                updatedAt: timestamp,
                completedAt: nil,
                redactionStatus: "private-state-excluded"
            )
        )

        if request.approvalRequired, let approvalId {
            var approvalMetadata = request.metadata
            approvalMetadata["source"] = .string("work-safety-task-service")
            approvalMetadata["requestedByActorId"] = .string(context.actorId)
            approvalMetadata["noExecutableWork"] = .bool(true)
            let step = WorkSafetyApprovalStepRecord(
                id: createRelayId("was"),
                workspaceId: context.workspaceId,
                approvalId: approvalId,
                label: "Review task before dispatch",
                value: title,
                status: .pending,
                sortIndex: 0,
                redactionStatus: "private-state-excluded"
            )
            _ = try data.saveWorkSafetyApproval(
                WorkSafetyApprovalRecord(
                    id: approvalId,
                    workspaceId: context.workspaceId,
                    taskId: task.id,
                    title: "Approval required: \(title)",
                    description: message,
                    status: .pending,
                    riskLevel: request.riskLevel,
                    requestedByAgentId: nil,
                    resolverAgentId: nil,
                    expiresAt: nil,
                    resolvedAt: nil,
                    steps: [step],
                    notes: [],
                    metadata: approvalMetadata,
                    createdAt: timestamp,
                    updatedAt: timestamp,
                    redactionStatus: "private-state-excluded"
                )
            )
        }

        _ = try recordEvent(
            task: task,
            runId: nil,
            approvalId: approvalId,
            eventType: request.approvalRequired ? .approvalRequested : .created,
            status: task.status.rawValue,
            detail: [
                "targetType": .string(request.targetType.rawValue),
                "approvalRequired": .bool(request.approvalRequired),
                "runtimeOutputCreated": .bool(false)
            ],
            occurredAt: timestamp
        )
        return task
    }

    @discardableResult
    public func updateSchedule(
        context: ServiceRequestContext,
        taskId: RelayId,
        scheduledAt: IsoTimestamp?,
        recurrenceRule: String?,
        now: Date = Date()
    ) throws -> WorkSafetyTaskRecord {
        try requireMutationAccess(context: context, resourceType: "work_safety_task", resourceId: taskId, action: "update")
        var task = try requireTask(taskId, context: context)
        guard !isTerminal(task.status) else {
            throw ServiceGuard.invalidInput(context: context, message: "Terminal tasks cannot be rescheduled.")
        }
        let timestamp = iso(now)
        task.scheduledAt = scheduledAt
        task.recurrenceRule = try optionalText(recurrenceRule, field: "Recurrence", context: context, maxLength: 160)
        task.status = task.approvalRequired ? .blockedByApproval : .queued
        task.linkedReferences.scheduledMessageId = scheduledMessageId(for: scheduledAt)
        task.metadata["scheduleUpdatedBy"] = .string(context.actorId)
        task.metadata["runtimeOutputCreated"] = .bool(false)
        task.updatedAt = timestamp
        let saved = try data.saveWorkSafetyTask(task)
        _ = try recordEvent(
            task: saved,
            runId: nil,
            approvalId: saved.approvalId,
            eventType: .updated,
            status: saved.status.rawValue,
            detail: [
                "scheduledAt": scheduledAt.map(JSONValue.string) ?? .null,
                "recurrenceRule": recurrenceRule.map(JSONValue.string) ?? .null,
                "requeued": .bool(true)
            ],
            occurredAt: timestamp
        )
        return saved
    }

    @discardableResult
    public func changeStatus(
        context: ServiceRequestContext,
        taskId: RelayId,
        status: WorkSafetyTaskStatus,
        now: Date = Date()
    ) throws -> WorkSafetyTaskRecord {
        try requireMutationAccess(context: context, resourceType: "work_safety_task", resourceId: taskId, action: "update")
        var task = try requireTask(taskId, context: context)
        let timestamp = iso(now)
        task.status = status
        task.updatedAt = timestamp
        if isTerminal(status) {
            task.completedAt = timestamp
        }
        let saved = try data.saveWorkSafetyTask(task)
        _ = try recordEvent(
            task: saved,
            runId: nil,
            approvalId: saved.approvalId,
            eventType: .statusChanged,
            status: saved.status.rawValue,
            detail: ["changedBy": .string(context.actorId)],
            occurredAt: timestamp
        )
        return saved
    }

    @discardableResult
    public func dispatchTask(
        context: ServiceRequestContext,
        taskId: RelayId,
        denialDetail: JSONRecord = [:],
        now: Date = Date()
    ) throws -> WorkSafetyTaskDispatchResult {
        try requireMutationAccess(
            context: context,
            resourceType: "work_safety_task",
            resourceId: taskId,
            action: "dispatch",
            detail: denialDetail
        )
        var task = try requireTask(taskId, context: context)
        guard !isTerminal(task.status) else {
            throw ServiceGuard.invalidInput(context: context, message: "Terminal tasks cannot be dispatched.")
        }
        let timestamp = iso(now)
        if task.approvalRequired, !approvalAllowsDispatch(task: task, now: now) {
            task.status = .blockedByApproval
            task.updatedAt = timestamp
            task.metadata["approvalGate"] = .string("blocked")
            task.metadata["runtimeOutputCreated"] = .bool(false)
            let saved = try data.saveWorkSafetyTask(task)
            let run = try reusableRun(
                task: saved,
                status: .blockedByApproval,
                failureMessage: "Approval is required before task dispatch.",
                metadata: denialDetail.merging([
                    "approvalGate": .string("blocked"),
                    "executionAttempted": .bool(false),
                    "runtimeOutputCreated": .bool(false)
                ]) { _, new in new },
                timestamp: timestamp
            )
            _ = try recordEvent(
                task: saved,
                runId: run.id,
                approvalId: saved.approvalId,
                eventType: .approvalRequested,
                status: saved.status.rawValue,
                detail: denialDetail.merging([
                    "reasonCode": .string(GuardReasonCode.approvalRequired.rawValue),
                    "approvalStatus": .string(currentApprovalStatus(task: saved, now: now)),
                    "runtimeOutputCreated": .bool(false)
                ]) { _, new in new },
                occurredAt: timestamp
            )
            throw ServiceGuardResult(
                stateKind: .approvalRequired,
                reasonCode: .approvalRequired,
                message: "Approval is required before task dispatch.",
                recovery: "Resolve the task-scoped approval before dispatching this task.",
                correlationId: context.correlationId,
                decisionId: saved.approvalId,
                auditRequired: true,
                retryable: true
            )
        }

        let run = try reusableRun(
            task: task,
            status: .dispatched,
            failureMessage: nil,
            metadata: [
                "executionAttempted": .bool(false),
                "runtimeOutputCreated": .bool(false),
                "dispatchMode": .string("retained-task-service-only")
            ],
            timestamp: timestamp
        )
        task.status = .dispatched
        task.updatedAt = timestamp
        task.metadata["dispatchRecordedBy"] = .string(context.actorId)
        task.metadata["runtimeOutputCreated"] = .bool(false)
        let saved = try data.saveWorkSafetyTask(task)
        let event = try recordEvent(
            task: saved,
            runId: run.id,
            approvalId: saved.approvalId,
            eventType: .dispatched,
            status: saved.status.rawValue,
            detail: [
                "executionAttempted": .bool(false),
                "runtimeOutputCreated": .bool(false),
                "noDuplicateOutput": .bool(true)
            ],
            occurredAt: timestamp
        )
        return WorkSafetyTaskDispatchResult(task: saved, run: run, event: event)
    }

    @discardableResult
    public func cancelTask(
        context: ServiceRequestContext,
        taskId: RelayId,
        now: Date = Date()
    ) throws -> WorkSafetyTaskDispatchResult {
        try requireMutationAccess(context: context, resourceType: "work_safety_task", resourceId: taskId, action: "cancel")
        var task = try requireTask(taskId, context: context)
        guard task.status != .completed else {
            throw ServiceGuard.invalidInput(context: context, message: "Completed tasks cannot be cancelled.")
        }
        let timestamp = iso(now)
        task.status = .cancelled
        task.completedAt = timestamp
        task.updatedAt = timestamp
        task.metadata["cancelledBy"] = .string(context.actorId)
        task.metadata["runtimeOutputCreated"] = .bool(false)
        let saved = try data.saveWorkSafetyTask(task)
        let run = try reusableRun(
            task: saved,
            status: .cancelled,
            failureMessage: nil,
            metadata: [
                "cancelledBy": .string(context.actorId),
                "runtimeOutputCreated": .bool(false)
            ],
            timestamp: timestamp
        )
        let event = try recordEvent(
            task: saved,
            runId: run.id,
            approvalId: saved.approvalId,
            eventType: .cancelled,
            status: saved.status.rawValue,
            detail: [
                "scheduledMessageCancelled": .bool(saved.linkedReferences.scheduledMessageId != nil),
                "runtimeOutputCreated": .bool(false)
            ],
            occurredAt: timestamp
        )
        return WorkSafetyTaskDispatchResult(task: saved, run: run, event: event)
    }

    @discardableResult
    public func retryTask(
        context: ServiceRequestContext,
        taskId: RelayId,
        now: Date = Date()
    ) throws -> WorkSafetyTaskRecord {
        try requireMutationAccess(context: context, resourceType: "work_safety_task", resourceId: taskId, action: "retry")
        var task = try requireTask(taskId, context: context)
        guard [.failed, .cancelled, .blockedByApproval].contains(task.status) else {
            throw ServiceGuard.invalidInput(context: context, message: "Only failed, cancelled, or approval-blocked tasks can be retried.")
        }
        if task.approvalRequired, !approvalAllowsDispatch(task: task, now: now) {
            let timestamp = iso(now)
            task.status = .blockedByApproval
            task.updatedAt = timestamp
            let saved = try data.saveWorkSafetyTask(task)
            _ = try recordEvent(
                task: saved,
                runId: nil,
                approvalId: saved.approvalId,
                eventType: .approvalRequested,
                status: saved.status.rawValue,
                detail: [
                    "retryBlocked": .bool(true),
                    "runtimeOutputCreated": .bool(false)
                ],
                occurredAt: timestamp
            )
            throw ServiceGuardResult(
                stateKind: .approvalRequired,
                reasonCode: .approvalRequired,
                message: "Approval is required before retrying this task.",
                recovery: "Resolve the task-scoped approval before retrying.",
                correlationId: context.correlationId,
                decisionId: saved.approvalId,
                auditRequired: true,
                retryable: true
            )
        }
        let timestamp = iso(now)
        task.status = .queued
        task.completedAt = nil
        task.updatedAt = timestamp
        task.metadata["retryRequestedBy"] = .string(context.actorId)
        task.metadata["runtimeOutputCreated"] = .bool(false)
        let saved = try data.saveWorkSafetyTask(task)
        _ = try recordEvent(
            task: saved,
            runId: nil,
            approvalId: saved.approvalId,
            eventType: .updated,
            status: saved.status.rawValue,
            detail: [
                "retryQueued": .bool(true),
                "runtimeOutputCreated": .bool(false)
            ],
            occurredAt: timestamp
        )
        return saved
    }

    public func listApprovals(
        context: ServiceRequestContext,
        status: WorkSafetyApprovalStatus? = nil,
        taskId: RelayId? = nil,
        limit: Int = 100
    ) throws -> [WorkSafetyApprovalRecord] {
        try requireReadAccess(context: context)
        if let taskId {
            _ = try requireTask(taskId, context: context)
        }
        let approvals = try data.listWorkSafetyApprovals(
            workspaceId: context.workspaceId,
            taskId: taskId,
            limit: limit
        )
        guard let status else { return approvals }
        return approvals.filter { $0.status == status }
    }

    public func getApproval(
        context: ServiceRequestContext,
        approvalId: RelayId
    ) throws -> WorkSafetyApprovalRecord {
        try requireReadAccess(context: context)
        return try requireApproval(approvalId, context: context)
    }

    public func pendingApprovalCount(context: ServiceRequestContext, now: Date = Date()) throws -> Int {
        try requireReadAccess(context: context)
        return try data.listWorkSafetyApprovals(workspaceId: context.workspaceId, limit: 500)
            .filter { $0.status == .pending && !isExpired($0, now: now) }
            .count
    }

    @discardableResult
    public func approveApproval(
        context: ServiceRequestContext,
        approvalId: RelayId,
        note: String? = nil,
        now: Date = Date()
    ) throws -> WorkSafetyApprovalDecisionResult {
        try resolveApproval(
            context: context,
            approvalId: approvalId,
            decision: .approved,
            note: note,
            now: now
        )
    }

    @discardableResult
    public func rejectApproval(
        context: ServiceRequestContext,
        approvalId: RelayId,
        note: String? = nil,
        now: Date = Date()
    ) throws -> WorkSafetyApprovalDecisionResult {
        try resolveApproval(
            context: context,
            approvalId: approvalId,
            decision: .rejected,
            note: note,
            now: now
        )
    }

    @discardableResult
    public func expireApproval(
        context: ServiceRequestContext,
        approvalId: RelayId,
        now: Date = Date()
    ) throws -> WorkSafetyApprovalDecisionResult {
        try requireMutationAccess(context: context, resourceType: "work_safety_approval", resourceId: approvalId, action: "expire")
        let approval = try requireApproval(approvalId, context: context)
        guard approval.status == .pending else {
            throw ServiceGuard.invalidInput(context: context, message: "Only pending approvals can expire.")
        }
        return try expirePendingApproval(approval, context: context, now: now)
    }

    public func listTasks(context: ServiceRequestContext, limit: Int = 100) throws -> [WorkSafetyTaskRecord] {
        try requireReadAccess(context: context)
        return try data.listWorkSafetyTasks(workspaceId: context.workspaceId, limit: limit)
    }

    public func listRuns(context: ServiceRequestContext, taskId: RelayId, limit: Int = 100) throws -> [WorkSafetyTaskRunRecord] {
        try requireReadAccess(context: context)
        _ = try requireTask(taskId, context: context)
        return try data.listWorkSafetyTaskRuns(workspaceId: context.workspaceId, taskId: taskId, limit: limit)
    }

    public func listEvents(context: ServiceRequestContext, taskId: RelayId, limit: Int = 100) throws -> [WorkSafetyTaskEventRecord] {
        try requireReadAccess(context: context)
        _ = try requireTask(taskId, context: context)
        return try data.listWorkSafetyTaskEvents(workspaceId: context.workspaceId, taskId: taskId, limit: limit)
    }

    private struct TargetResolution {
        var targetId: RelayId?
        var assignedAgentId: RelayId?
        var threadId: RelayId?
        var runtimeBindingId: RelayId?
        var metadata: JSONRecord
    }

    private func resolveTarget(
        context: ServiceRequestContext,
        title: String,
        targetType: WorkSafetyTaskTargetType,
        targetId: RelayId?,
        assignedAgentId: RelayId?
    ) throws -> TargetResolution {
        switch targetType {
        case .agent:
            let agent = try requireAgent(targetId, context: context, field: "Task target agent")
            if let assignedAgentId, assignedAgentId != agent.id {
                throw ServiceGuard.invalidInput(context: context, message: "Direct agent tasks must assign the target agent.")
            }
            let thread = try data.createThread(
                workspaceId: context.workspaceId,
                title: "Task: \(title)",
                selectedAgentId: agent.id,
                threadType: .direct
            )
            return TargetResolution(
                targetId: agent.id,
                assignedAgentId: agent.id,
                threadId: thread.id,
                runtimeBindingId: agent.binding.id,
                metadata: ["targetResolution": .string("agent")]
            )

        case .team:
            let team = try requireTeam(targetId, context: context)
            let agent = try assignedAgentId.map { try requireAgent($0, context: context, field: "Assigned agent") }
                ?? team.leadAgentId.flatMap { try? requireAgent($0, context: context, field: "Team lead") }
                ?? data.listAgents(workspaceId: context.workspaceId).first { $0.teamId == team.id && $0.status == "active" }
            guard let agent, agent.teamId == team.id else {
                throw ServiceGuard.unavailable(
                    context: context,
                    reasonCode: .dependencyMissing,
                    message: "Team task target has no active workspace agent."
                )
            }
            let thread = try data.createThread(
                workspaceId: context.workspaceId,
                title: "Team task: \(team.name)",
                selectedAgentId: agent.id,
                threadType: .team
            )
            return TargetResolution(
                targetId: team.id,
                assignedAgentId: agent.id,
                threadId: thread.id,
                runtimeBindingId: agent.binding.id,
                metadata: ["targetResolution": .string("team"), "teamId": .string(team.id)]
            )

        case .department:
            let department = try requireDepartment(targetId, context: context)
            let agent = try assignedAgentId.map { try requireAgent($0, context: context, field: "Assigned agent") }
                ?? department.headAgentId.flatMap { try? requireAgent($0, context: context, field: "Department head") }
                ?? data.listAgents(workspaceId: context.workspaceId).first { $0.departmentId == department.id && $0.status == "active" }
            guard let agent, agent.departmentId == department.id else {
                throw ServiceGuard.unavailable(
                    context: context,
                    reasonCode: .dependencyMissing,
                    message: "Department task target has no active workspace agent."
                )
            }
            let thread = try data.createThread(
                workspaceId: context.workspaceId,
                title: "Department task: \(department.name)",
                selectedAgentId: agent.id,
                threadType: .direct
            )
            return TargetResolution(
                targetId: department.id,
                assignedAgentId: agent.id,
                threadId: thread.id,
                runtimeBindingId: agent.binding.id,
                metadata: ["targetResolution": .string("department"), "departmentId": .string(department.id)]
            )

        case .thread:
            guard let targetId else {
                throw ServiceGuard.invalidInput(context: context, message: "Existing-thread task target requires a thread id.")
            }
            let thread = try data.getThread(targetId)
            guard thread.workspaceId == context.workspaceId else {
                throw ServiceGuard.invalidInput(context: context, message: "Task thread does not belong to this workspace.")
            }
            let agent = try assignedAgentId.map { try requireAgent($0, context: context, field: "Assigned agent") }
            return TargetResolution(
                targetId: thread.id,
                assignedAgentId: agent?.id ?? thread.selectedAgentId,
                threadId: thread.id,
                runtimeBindingId: agent?.binding.id,
                metadata: ["targetResolution": .string("thread"), "threadId": .string(thread.id)]
            )

        case .agentToAgent:
            let target = try requireAgent(targetId, context: context, field: "Target agent")
            let assigned = try requireAgent(assignedAgentId, context: context, field: "Assigned agent")
            guard target.id != assigned.id else {
                throw ServiceGuard.invalidInput(context: context, message: "Agent-to-agent tasks require two different agents.")
            }
            let thread = try data.createThread(
                workspaceId: context.workspaceId,
                title: "Agent task: \(assigned.name) -> \(target.name)",
                selectedAgentId: assigned.id,
                threadType: .direct
            )
            return TargetResolution(
                targetId: target.id,
                assignedAgentId: assigned.id,
                threadId: thread.id,
                runtimeBindingId: assigned.binding.id,
                metadata: [
                    "targetResolution": .string("agent_to_agent"),
                    "targetAgentId": .string(target.id),
                    "assignedAgentId": .string(assigned.id)
                ]
            )

        case .runtimeBinding, .actionRun:
            throw ServiceGuard.unavailable(
                context: context,
                reasonCode: .featureUnavailable,
                message: "Runtime binding and action-run task targets remain unavailable until controlled-write evidence exists."
            )
        }
    }

    private func reusableRun(
        task: WorkSafetyTaskRecord,
        status: WorkSafetyTaskRunStatus,
        failureMessage: String?,
        metadata: JSONRecord,
        timestamp: IsoTimestamp
    ) throws -> WorkSafetyTaskRunRecord {
        if let reusable = try data.listWorkSafetyTaskRuns(workspaceId: task.workspaceId, taskId: task.id, limit: 10)
            .first(where: { $0.status == status && [.queued, .dispatched, .running, .blockedByApproval, .cancelled].contains($0.status) }) {
            return reusable
        }
        let latestAttempt = try data.listWorkSafetyTaskRuns(workspaceId: task.workspaceId, taskId: task.id, limit: 50)
            .map(\.attempt)
            .max() ?? 0
        return try data.saveWorkSafetyTaskRun(
            WorkSafetyTaskRunRecord(
                id: createRelayId("wtr"),
                workspaceId: task.workspaceId,
                taskId: task.id,
                status: status,
                linkedReferences: task.linkedReferences,
                attempt: latestAttempt + 1,
                startedAt: status == .dispatched || status == .running ? timestamp : nil,
                completedAt: [.completed, .failed, .cancelled].contains(status) ? timestamp : nil,
                failureMessage: failureMessage,
                metadata: metadata,
                createdAt: timestamp,
                updatedAt: timestamp,
                redactionStatus: "private-state-excluded"
            )
        )
    }

    @discardableResult
    private func recordEvent(
        task: WorkSafetyTaskRecord,
        runId: RelayId?,
        approvalId: RelayId?,
        eventType: WorkSafetyTaskEventType,
        status: String,
        detail: JSONRecord,
        occurredAt: IsoTimestamp
    ) throws -> WorkSafetyTaskEventRecord {
        try data.saveWorkSafetyTaskEvent(
            WorkSafetyTaskEventRecord(
                id: createRelayId("wte"),
                workspaceId: task.workspaceId,
                taskId: task.id,
                runId: runId,
                approvalId: approvalId,
                eventType: eventType,
                status: status,
                detail: detail,
                occurredAt: occurredAt,
                redactionStatus: "private-state-excluded"
            )
        )
    }

    private func approvalAllowsDispatch(task: WorkSafetyTaskRecord, now: Date) -> Bool {
        guard let approval = try? currentApproval(task: task) else { return false }
        guard approval.status == .approved else { return false }
        if let expiresAt = approval.expiresAt,
           let expiry = parseIsoDate(expiresAt),
           expiry <= now {
            return false
        }
        return true
    }

    private func currentApprovalStatus(task: WorkSafetyTaskRecord, now: Date) -> String {
        guard let approval = try? currentApproval(task: task) else { return "missing" }
        if let expiresAt = approval.expiresAt,
           let expiry = parseIsoDate(expiresAt),
           expiry <= now,
           approval.status == .pending {
            return WorkSafetyApprovalStatus.expired.rawValue
        }
        return approval.status.rawValue
    }

    private func currentApproval(task: WorkSafetyTaskRecord) throws -> WorkSafetyApprovalRecord {
        if let approvalId = task.approvalId {
            return try data.getWorkSafetyApproval(approvalId)
        }
        if let approval = try data.listWorkSafetyApprovals(workspaceId: task.workspaceId, taskId: task.id, limit: 1).first {
            return approval
        }
        throw RelayError(.notFound, "Approval was not found.")
    }

    private func resolveApproval(
        context: ServiceRequestContext,
        approvalId: RelayId,
        decision: WorkSafetyApprovalStatus,
        note: String?,
        now: Date
    ) throws -> WorkSafetyApprovalDecisionResult {
        try requireReadAccess(context: context)
        guard [.approved, .rejected].contains(decision) else {
            throw ServiceGuard.invalidInput(context: context, message: "Unsupported approval decision.")
        }
        var approval = try requireApproval(approvalId, context: context)
        try requireApprovalDecisionAuthority(context: context, approval: approval)
        try requirePermission(
            context: context,
            resourceType: "work_safety_approval",
            resourceId: approval.id,
            action: "resolve",
            detail: [
                "approvalId": .string(approval.id),
                "taskId": approval.taskId.map(JSONValue.string) ?? .null
            ]
        )
        guard approval.status == .pending else {
            throw ServiceGuardResult(
                stateKind: .disabled,
                reasonCode: .inputInvalid,
                message: "Only pending approvals can be resolved.",
                recovery: "Refresh the task-scoped approval before trying again.",
                correlationId: context.correlationId,
                decisionId: approval.id,
                auditRequired: true,
                retryable: false
            )
        }
        if isExpired(approval, now: now) {
            _ = try expirePendingApproval(approval, context: context, now: now)
            throw ServiceGuardResult(
                stateKind: .disabled,
                reasonCode: .inputInvalid,
                message: "Expired approvals cannot be resolved.",
                recovery: "Create a fresh task-scoped approval before dispatch.",
                correlationId: context.correlationId,
                decisionId: approval.id,
                auditRequired: true,
                retryable: false
            )
        }

        let timestamp = iso(now)
        let noteText = try optionalText(note, field: "Decision note", context: context, maxLength: 4000)
        let noteRecord = noteText.map {
            WorkSafetyApprovalNoteRecord(
                id: createRelayId("wan"),
                workspaceId: approval.workspaceId,
                approvalId: approval.id,
                authorAgentId: nil,
                note: $0,
                createdAt: timestamp,
                redactionStatus: "private-state-excluded"
            )
        }
        if let noteRecord {
            approval.notes.append(noteRecord)
        }
        approval.status = decision
        approval.resolvedAt = timestamp
        approval.updatedAt = timestamp
        approval.metadata["resolvedByActorId"] = .string(context.actorId)
        approval.metadata["decision"] = .string(decision.rawValue)
        approval.metadata["noteRecorded"] = .bool(noteRecord != nil)
        approval.metadata["runtimeOutputCreated"] = .bool(false)
        let savedApproval = try data.saveWorkSafetyApproval(approval)
        let savedNote = noteRecord.flatMap { note in
            savedApproval.notes.first { $0.id == note.id } ?? note
        }
        let savedTask = try updateLinkedTaskForDecision(
            approval: savedApproval,
            decision: decision,
            context: context,
            timestamp: timestamp
        )
        let event = try savedTask.map {
            try recordEvent(
                task: $0,
                runId: nil,
                approvalId: savedApproval.id,
                eventType: .approvalResolved,
                status: $0.status.rawValue,
                detail: [
                    "decision": .string(decision.rawValue),
                    "resolvedByActorId": .string(context.actorId),
                    "noteRecorded": .bool(noteRecord != nil),
                    "runtimeOutputCreated": .bool(false)
                ],
                occurredAt: timestamp
            )
        }
        _ = try data.log(
            severity: "info",
            category: "work-safety.approval",
            message: "Task-scoped approval decision recorded.",
            correlationId: context.correlationId,
            threadId: savedTask?.threadId,
            detail: [
                "approvalId": .string(savedApproval.id),
                "taskId": savedApproval.taskId.map(JSONValue.string) ?? .null,
                "workspaceId": .string(context.workspaceId),
                "actorId": .string(context.actorId),
                "decision": .string(decision.rawValue),
                "resolvedByActorId": .string(context.actorId),
                "noteRecorded": .bool(noteRecord != nil),
                "runtimeOutputCreated": .bool(false)
            ]
        )
        return WorkSafetyApprovalDecisionResult(
            approval: savedApproval,
            task: savedTask,
            note: savedNote,
            event: event
        )
    }

    private func expirePendingApproval(
        _ approval: WorkSafetyApprovalRecord,
        context: ServiceRequestContext,
        now: Date
    ) throws -> WorkSafetyApprovalDecisionResult {
        let timestamp = iso(now)
        var expiredApproval = approval
        expiredApproval.status = .expired
        expiredApproval.updatedAt = timestamp
        expiredApproval.metadata["expiredByActorId"] = .string(context.actorId)
        expiredApproval.metadata["decision"] = .string(WorkSafetyApprovalStatus.expired.rawValue)
        expiredApproval.metadata["runtimeOutputCreated"] = .bool(false)
        let savedApproval = try data.saveWorkSafetyApproval(expiredApproval)
        let savedTask = try updateLinkedTaskForDecision(
            approval: savedApproval,
            decision: .expired,
            context: context,
            timestamp: timestamp
        )
        let event = try savedTask.map {
            try recordEvent(
                task: $0,
                runId: nil,
                approvalId: savedApproval.id,
                eventType: .approvalResolved,
                status: $0.status.rawValue,
                detail: [
                    "decision": .string(WorkSafetyApprovalStatus.expired.rawValue),
                    "expiredByActorId": .string(context.actorId),
                    "runtimeOutputCreated": .bool(false)
                ],
                occurredAt: timestamp
            )
        }
        _ = try data.log(
            severity: "warning",
            category: "work-safety.approval",
            message: "Task-scoped approval expired.",
            correlationId: context.correlationId,
            threadId: savedTask?.threadId,
            detail: [
                "approvalId": .string(savedApproval.id),
                "taskId": savedApproval.taskId.map(JSONValue.string) ?? .null,
                "workspaceId": .string(context.workspaceId),
                "actorId": .string(context.actorId),
                "decision": .string(WorkSafetyApprovalStatus.expired.rawValue),
                "runtimeOutputCreated": .bool(false)
            ]
        )
        return WorkSafetyApprovalDecisionResult(
            approval: savedApproval,
            task: savedTask,
            note: nil,
            event: event
        )
    }

    private func updateLinkedTaskForDecision(
        approval: WorkSafetyApprovalRecord,
        decision: WorkSafetyApprovalStatus,
        context: ServiceRequestContext,
        timestamp: IsoTimestamp
    ) throws -> WorkSafetyTaskRecord? {
        guard let taskId = approval.taskId else { return nil }
        var task = try data.getWorkSafetyTask(taskId)
        guard task.workspaceId == context.workspaceId else {
            throw ServiceGuard.invalidInput(context: context, message: "Approval task does not belong to this workspace.")
        }
        switch decision {
        case .approved:
            task.status = .queued
            task.completedAt = nil
            task.metadata["approvalGate"] = .string("approved")
        case .rejected:
            task.status = .failed
            task.completedAt = timestamp
            task.metadata["approvalGate"] = .string("rejected")
        case .expired:
            task.status = .blockedByApproval
            task.metadata["approvalGate"] = .string("expired")
        default:
            return task
        }
        task.metadata["approvalDecisionId"] = .string(approval.id)
        task.metadata["runtimeOutputCreated"] = .bool(false)
        task.updatedAt = timestamp
        return try data.saveWorkSafetyTask(task)
    }

    private func requireApproval(_ approvalId: RelayId, context: ServiceRequestContext) throws -> WorkSafetyApprovalRecord {
        let approval = try data.getWorkSafetyApproval(approvalId)
        guard approval.workspaceId == context.workspaceId else {
            throw ServiceGuard.invalidInput(context: context, message: "Approval does not belong to this workspace.")
        }
        return approval
    }

    private func requireApprovalDecisionAuthority(
        context: ServiceRequestContext,
        approval: WorkSafetyApprovalRecord
    ) throws {
        let workspaceAccessRoles: Set<ServiceRole> = [.owner, .admin, .member, .approver]
        let explicitApprovers = explicitApproverActorIds(in: approval.metadata)
        let adminFallbackAllowed = approval.metadata["adminFallbackAllowed"]?.bool ?? explicitApprovers.isEmpty
        let allowed: Bool
        if explicitApprovers.contains(context.actorId) {
            allowed = context.hasAnyRole(workspaceAccessRoles)
        } else if context.hasAnyRole([.owner, .admin]), adminFallbackAllowed {
            allowed = true
        } else if explicitApprovers.isEmpty, context.hasAnyRole([.approver]) {
            allowed = true
        } else {
            allowed = false
        }
        guard allowed else {
            _ = try data.log(
                severity: "warning",
                category: "work-safety.approval",
                message: "Task-scoped approval decision denied.",
                correlationId: context.correlationId,
                detail: [
                    "approvalId": .string(approval.id),
                    "taskId": approval.taskId.map(JSONValue.string) ?? .null,
                    "workspaceId": .string(context.workspaceId),
                    "actorId": .string(context.actorId),
                    "reasonCode": .string(GuardReasonCode.authorityRoleRequired.rawValue),
                    "runtimeOutputCreated": .bool(false)
                ]
            )
            throw ServiceGuardResult(
                stateKind: .readOnly,
                reasonCode: .authorityRoleRequired,
                message: "Resolving this task-scoped approval requires an explicit approver or workspace admin fallback.",
                recovery: "Ask an authorized approver to resolve the pending approval.",
                correlationId: context.correlationId,
                decisionId: approval.id,
                auditRequired: true,
                retryable: false
            )
        }
    }

    private func explicitApproverActorIds(in metadata: JSONRecord) -> Set<RelayId> {
        var ids = Set<RelayId>()
        for key in ["approverActorId", "approverId", "resolverActorId", "resolverId"] {
            if let value = nonBlank(metadata[key]?.string) {
                ids.insert(value)
            }
        }
        for key in ["approverActorIds", "approverIds", "allowedApproverActorIds", "resolverActorIds", "resolverIds"] {
            if case .array(let values)? = metadata[key] {
                for value in values {
                    if let id = nonBlank(value.string) {
                        ids.insert(id)
                    }
                }
            }
        }
        if case .object(let approver)? = metadata["approver"],
           let id = nonBlank(approver["actorId"]?.string ?? approver["id"]?.string) {
            ids.insert(id)
        }
        return ids
    }

    private func nonBlank(_ value: String?) -> String? {
        guard let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines), !trimmed.isEmpty else {
            return nil
        }
        return trimmed
    }

    private func isExpired(_ approval: WorkSafetyApprovalRecord, now: Date) -> Bool {
        guard approval.status == .pending,
              let expiresAt = approval.expiresAt,
              let expiry = parseIsoDate(expiresAt)
        else {
            return false
        }
        return expiry <= now
    }

    private func parseIsoDate(_ value: IsoTimestamp) -> Date? {
        ISO8601DateFormatter.relayConsole.date(from: value) ?? ISO8601DateFormatter().date(from: value)
    }

    private func requireTask(_ taskId: RelayId, context: ServiceRequestContext) throws -> WorkSafetyTaskRecord {
        let task = try data.getWorkSafetyTask(taskId)
        guard task.workspaceId == context.workspaceId else {
            throw ServiceGuard.invalidInput(context: context, message: "Task does not belong to this workspace.")
        }
        return task
    }

    private func requireAgent(_ id: RelayId?, context: ServiceRequestContext, field: String) throws -> AgentWithBinding {
        guard let id else {
            throw ServiceGuard.invalidInput(context: context, message: "\(field) is required.")
        }
        let agent = try data.getAgent(id)
        guard agent.workspaceId == context.workspaceId else {
            throw ServiceGuard.invalidInput(context: context, message: "\(field) does not belong to this workspace.")
        }
        return agent
    }

    private func requireTeam(_ id: RelayId?, context: ServiceRequestContext) throws -> AgentOrgTeam {
        guard let id else {
            throw ServiceGuard.invalidInput(context: context, message: "Team task target requires a team id.")
        }
        let team = try data.getAgentOrgTeam(id)
        guard team.workspaceId == context.workspaceId else {
            throw ServiceGuard.invalidInput(context: context, message: "Task team does not belong to this workspace.")
        }
        return team
    }

    private func requireDepartment(_ id: RelayId?, context: ServiceRequestContext) throws -> AgentOrgDepartment {
        guard let id else {
            throw ServiceGuard.invalidInput(context: context, message: "Department task target requires a department id.")
        }
        let department = try data.getAgentOrgDepartment(id)
        guard department.workspaceId == context.workspaceId else {
            throw ServiceGuard.invalidInput(context: context, message: "Task department does not belong to this workspace.")
        }
        return department
    }

    private func requireReadAccess(context: ServiceRequestContext) throws {
        if let denied = ServiceGuard.requireAnyRole(
            [.owner, .admin, .member, .viewer, .approver, .operator],
            context: context,
            message: "Reading work-safety tasks requires workspace access."
        ) {
            throw denied
        }
        try requirePermission(context: context, resourceType: "work_safety_task", action: "read")
    }

    private func requireMutationAccess(
        context: ServiceRequestContext,
        resourceType: String,
        resourceId: RelayId? = nil,
        action: String,
        detail: JSONRecord = [:]
    ) throws {
        if let denied = ServiceGuard.requireAnyRole(
            [.owner, .admin],
            context: context,
            message: "Task service mutations require owner or admin authority."
        ) {
            throw denied
        }
        try requirePermission(
            context: context,
            resourceType: resourceType,
            resourceId: resourceId,
            action: action,
            detail: detail
        )
    }

    private func requirePermission(
        context: ServiceRequestContext,
        resourceType: String,
        resourceId: RelayId? = nil,
        action: String,
        detail: JSONRecord = [:]
    ) throws {
        try permissions?.requireAllowed(
            context: context,
            resourceType: resourceType,
            resourceId: resourceId,
            action: action,
            detail: detail
        )
    }

    private func requireText(_ value: String, field: String, context: ServiceRequestContext, maxLength: Int) throws -> String {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            throw ServiceGuard.invalidInput(context: context, message: "\(field) is required.")
        }
        guard trimmed.count <= maxLength else {
            throw ServiceGuard.invalidInput(context: context, message: "\(field) is too long.")
        }
        return trimmed
    }

    private func optionalText(_ value: String?, field: String, context: ServiceRequestContext, maxLength: Int) throws -> String? {
        guard let value else { return nil }
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        guard trimmed.count <= maxLength else {
            throw ServiceGuard.invalidInput(context: context, message: "\(field) is too long.")
        }
        return trimmed
    }

    private func scheduledMessageId(for scheduledAt: IsoTimestamp?) -> RelayId? {
        scheduledAt == nil ? nil : createRelayId("wsm")
    }

    private func isTerminal(_ status: WorkSafetyTaskStatus) -> Bool {
        [.completed, .failed, .cancelled].contains(status)
    }

    private func iso(_ date: Date) -> IsoTimestamp {
        ISO8601DateFormatter.relayConsole.string(from: date)
    }
}
