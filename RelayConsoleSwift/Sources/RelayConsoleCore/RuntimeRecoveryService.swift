import Foundation

public final class RuntimeRecoveryService {
    public static let sourceHostExclusionReason = "Local app source-host records are excluded from Swift scope unless explicitly reinstated."

    private let data: LocalDataService

    public init(data: LocalDataService) {
        self.data = data
    }

    @discardableResult
    public func recordStructuredJob(
        context: ServiceRequestContext,
        jobType: String,
        status: RuntimeStructuredJobStatus,
        title: String,
        dispatchId: RelayId? = nil,
        actionRunId: RelayId? = nil,
        retryable: Bool = false,
        contextUsage: RuntimeContextUsageRecord? = nil,
        participantHealth: [RuntimeParticipantHealthRecord] = [],
        followUpFailure: JSONRecord? = nil,
        recovery: JSONRecord = [:],
        metadata: JSONRecord = [:],
        now: Date = Date()
    ) throws -> RuntimeStructuredJob {
        try requireWriteAccess(context: context)
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
        if let dispatchId {
            _ = try data.getDispatch(dispatchId)
        }
        let job = RuntimeStructuredJob(
            id: createRelayId("rsj"),
            workspaceId: context.workspaceId,
            dispatchId: dispatchId,
            actionRunId: actionRunId,
            jobType: jobType,
            status: status,
            title: title,
            retryable: retryable,
            contextUsage: contextUsage,
            participantHealth: participantHealth,
            followUpFailure: followUpFailure,
            recovery: recovery.merging(["sourceHostExcluded": .bool(true)]) { current, _ in current },
            sourceHostExcluded: true,
            metadata: metadata,
            createdAt: timestamp,
            updatedAt: timestamp,
            completedAt: [.completed, .failed, .cancelled].contains(status) ? timestamp : nil,
            redactionStatus: "private-state-excluded"
        )
        return try data.saveRuntimeStructuredJob(job)
    }

    @discardableResult
    public func recordMissingTool(
        context: ServiceRequestContext,
        toolName: String,
        status: RuntimeMissingToolStatus,
        dispatchId: RelayId? = nil,
        agentId: RelayId? = nil,
        request: JSONRecord = [:],
        source: String = "runtime_missing_tool",
        now: Date = Date()
    ) throws -> RuntimeMissingToolEvent {
        try requireWriteAccess(context: context)
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
        let event = RuntimeMissingToolEvent(
            id: createRelayId("rmt"),
            workspaceId: context.workspaceId,
            dispatchId: dispatchId,
            agentId: agentId,
            toolName: toolName,
            status: status,
            request: request.merging([
                "autoInstallAttempted": .bool(false),
                "fakeGrantCreated": .bool(false)
            ]) { current, _ in current },
            autoInstallAttempted: false,
            fakeGrantCreated: false,
            source: source,
            createdAt: timestamp,
            updatedAt: timestamp,
            redactionStatus: "private-state-excluded"
        )
        return try data.saveRuntimeMissingToolEvent(event)
    }

    @discardableResult
    public func recordRecovery(
        context: ServiceRequestContext,
        state: RuntimeRecoveryState,
        retryable: Bool,
        reasonCode: GuardReasonCode,
        message: String,
        dispatchId: RelayId? = nil,
        jobId: RelayId? = nil,
        followUpAction: String? = nil,
        recovery: JSONRecord = [:],
        now: Date = Date()
    ) throws -> RuntimeRecoveryRecord {
        try requireWriteAccess(context: context)
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
        let record = RuntimeRecoveryRecord(
            id: createRelayId("rrr"),
            workspaceId: context.workspaceId,
            dispatchId: dispatchId,
            jobId: jobId,
            state: state,
            retryable: retryable,
            reasonCode: reasonCode,
            message: message,
            followUpAction: followUpAction,
            sourceHostExcluded: true,
            recovery: recovery.merging(["sourceHostExcluded": .bool(true)]) { current, _ in current },
            createdAt: timestamp,
            updatedAt: timestamp,
            resolvedAt: nil,
            redactionStatus: "private-state-excluded"
        )
        return try data.saveRuntimeRecoveryRecord(record)
    }

    public func structuredJobs(context: ServiceRequestContext, limit: Int = 100) throws -> [RuntimeStructuredJob] {
        try requireReadAccess(context: context)
        return try data.listRuntimeStructuredJobs(workspaceId: context.workspaceId, limit: limit)
    }

    public func missingTools(context: ServiceRequestContext, limit: Int = 100) throws -> [RuntimeMissingToolEvent] {
        try requireReadAccess(context: context)
        return try data.listRuntimeMissingToolEvents(workspaceId: context.workspaceId, limit: limit)
    }

    public func recoveryRecords(context: ServiceRequestContext, limit: Int = 100) throws -> [RuntimeRecoveryRecord] {
        try requireReadAccess(context: context)
        return try data.listRuntimeRecoveryRecords(workspaceId: context.workspaceId, limit: limit)
    }

    public static func contextUsage(
        dispatchId: RelayId?,
        percentUsed: Double?,
        tokenCount: Int?,
        maxTokens: Int?,
        level: String,
        isEstimate: Bool,
        referencesCount: Int
    ) -> RuntimeContextUsageRecord {
        RuntimeContextUsageRecord(
            dispatchId: dispatchId,
            percentUsed: percentUsed,
            tokenCount: tokenCount,
            maxTokens: maxTokens,
            level: level,
            isEstimate: isEstimate,
            referencesCount: max(referencesCount, 0),
            redactionStatus: "reference-details-excluded"
        )
    }

    public static func participantHealth(
        agentId: RelayId,
        runtimeType: RuntimeType,
        status: HarnessHealthStatus,
        message: String,
        updatedAt: IsoTimestamp
    ) -> RuntimeParticipantHealthRecord {
        RuntimeParticipantHealthRecord(
            agentId: agentId,
            runtimeType: runtimeType,
            status: status,
            message: redactString(message),
            updatedAt: updatedAt,
            redactionStatus: "health-message-redacted"
        )
    }

    private func requireReadAccess(context: ServiceRequestContext) throws {
        if let denied = ServiceGuard.requireAnyRole(
            [.owner, .admin, .member],
            context: context,
            message: "Reading runtime recovery records requires workspace access."
        ) {
            throw denied
        }
    }

    private func requireWriteAccess(context: ServiceRequestContext) throws {
        if let denied = ServiceGuard.requireAnyRole(
            [.owner, .admin, .operator],
            context: context,
            message: "Recording runtime recovery state requires operator access."
        ) {
            throw denied
        }
    }
}
