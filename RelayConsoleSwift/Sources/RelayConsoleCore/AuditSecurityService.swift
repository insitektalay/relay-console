import Foundation

public struct AuditLogQuery: Codable, Equatable, Sendable {
    public var limit: Int
    public var offset: Int
    public var eventType: String?
    public var resourceType: String?
    public var resourceId: RelayId?
    public var severity: String?
    public var from: IsoTimestamp?
    public var to: IsoTimestamp?

    public init(
        limit: Int = 100,
        offset: Int = 0,
        eventType: String? = nil,
        resourceType: String? = nil,
        resourceId: RelayId? = nil,
        severity: String? = nil,
        from: IsoTimestamp? = nil,
        to: IsoTimestamp? = nil
    ) {
        self.limit = limit
        self.offset = offset
        self.eventType = eventType
        self.resourceType = resourceType
        self.resourceId = resourceId
        self.severity = severity
        self.from = from
        self.to = to
    }
}

public struct AuditLogRecordRequest: Codable, Equatable, Sendable {
    public var eventType: String
    public var resourceType: String
    public var resourceId: RelayId?
    public var severity: String
    public var message: String
    public var taskId: RelayId?
    public var approvalId: RelayId?
    public var actionRunId: RelayId?
    public var dispatchId: RelayId?
    public var threadId: RelayId?
    public var harnessId: RelayId?
    public var source: String
    public var context: JSONRecord

    public init(
        eventType: String,
        resourceType: String,
        resourceId: RelayId? = nil,
        severity: String = "info",
        message: String,
        taskId: RelayId? = nil,
        approvalId: RelayId? = nil,
        actionRunId: RelayId? = nil,
        dispatchId: RelayId? = nil,
        threadId: RelayId? = nil,
        harnessId: RelayId? = nil,
        source: String,
        context: JSONRecord = [:]
    ) {
        self.eventType = eventType
        self.resourceType = resourceType
        self.resourceId = resourceId
        self.severity = severity
        self.message = message
        self.taskId = taskId
        self.approvalId = approvalId
        self.actionRunId = actionRunId
        self.dispatchId = dispatchId
        self.threadId = threadId
        self.harnessId = harnessId
        self.source = source
        self.context = context
    }
}

public final class AuditSecurityService {
    private let data: LocalDataService

    public init(data: LocalDataService) {
        self.data = data
    }

    @discardableResult
    public func record(
        context: ServiceRequestContext,
        request: AuditLogRecordRequest,
        now: Date = Date()
    ) -> AuditLogRecord? {
        var detail = request.context
        detail["actorId"] = .string(context.actorId)
        detail["workspaceId"] = .string(context.workspaceId)
        detail["source"] = .string(request.source)
        detail["redactionStatus"] = .string("private-state-excluded")
        let audit = AuditLogRecord(
            id: createRelayId("aud"),
            workspaceId: context.workspaceId,
            actorId: context.actorId,
            actorType: context.roles.contains(.owner) || context.roles.contains(.admin) ? "admin_user" : "user",
            eventType: request.eventType,
            resourceType: request.resourceType,
            resourceId: request.resourceId,
            severity: request.severity,
            message: request.message,
            correlationId: context.correlationId,
            taskId: request.taskId,
            approvalId: request.approvalId,
            actionRunId: request.actionRunId,
            dispatchId: request.dispatchId,
            threadId: request.threadId,
            harnessId: request.harnessId,
            source: request.source,
            context: detail,
            writeStatus: "recorded",
            createdAt: ISO8601DateFormatter.relayConsole.string(from: now),
            redactionStatus: "private-state-excluded"
        )
        do {
            return try data.saveAuditLogRecord(audit)
        } catch {
            _ = try? data.log(
                severity: "warning",
                category: "audit.writer",
                message: "Audit record write failed.",
                correlationId: context.correlationId,
                detail: [
                    "actorId": .string(context.actorId),
                    "workspaceId": .string(context.workspaceId),
                    "eventType": .string(request.eventType),
                    "resourceType": .string(request.resourceType),
                    "reasonCode": .string(GuardReasonCode.errorRetryable.rawValue),
                    "writeStatus": .string("failed"),
                    "redactionStatus": .string("private-state-excluded")
                ]
            )
            return nil
        }
    }

    public func list(context: ServiceRequestContext, query: AuditLogQuery = AuditLogQuery()) throws -> AuditLogPage {
        try requireAuditAdmin(context: context, action: "list")
        let limit = min(max(query.limit, 1), 500)
        let offset = max(query.offset, 0)
        let records = try data.listAuditLogRecords(
            workspaceId: context.workspaceId,
            limit: limit,
            offset: offset,
            eventType: query.eventType,
            resourceType: query.resourceType,
            resourceId: query.resourceId,
            severity: query.severity,
            from: query.from,
            to: query.to
        )
        let total = try data.countAuditLogRecords(
            workspaceId: context.workspaceId,
            eventType: query.eventType,
            resourceType: query.resourceType,
            resourceId: query.resourceId,
            severity: query.severity,
            from: query.from,
            to: query.to
        )
        let nextOffset = offset + records.count < total ? offset + records.count : nil
        return AuditLogPage(
            records: records,
            limit: limit,
            offset: offset,
            nextOffset: nextOffset,
            totalCount: total,
            redactionStatus: "private-state-excluded"
        )
    }

    public func securitySummary(
        context: ServiceRequestContext,
        query: AuditLogQuery = AuditLogQuery(limit: 500),
        now: Date = Date()
    ) throws -> SecurityMetricSnapshot {
        try requireAuditAdmin(context: context, action: "summary")
        let records = try data.listAuditLogRecords(
            workspaceId: context.workspaceId,
            limit: min(max(query.limit, 1), 5_000),
            offset: max(query.offset, 0),
            eventType: query.eventType,
            resourceType: query.resourceType,
            resourceId: query.resourceId,
            severity: query.severity,
            from: query.from,
            to: query.to
        )
        var categoryCounts: [String: Int] = [:]
        for record in records {
            categoryCounts[record.eventType, default: 0] += 1
        }
        let snapshot = SecurityMetricSnapshot(
            id: createRelayId("secmet"),
            workspaceId: context.workspaceId,
            windowStartedAt: query.from,
            windowEndedAt: query.to,
            generatedAt: ISO8601DateFormatter.relayConsole.string(from: now),
            auditEventCount: records.count,
            deniedActionCount: records.filter(isDeniedAction).count,
            permissionDeniedCount: records.filter { $0.eventType == "permission.denied" }.count,
            approvalDecisionCount: records.filter { $0.eventType.hasPrefix("approval.") }.count,
            policyMutationCount: records.filter { $0.eventType.hasPrefix("permission_policy.") }.count,
            taskTransitionCount: records.filter { $0.eventType.hasPrefix("task.") }.count,
            toolRequestTransitionCount: records.filter { $0.eventType.hasPrefix("tool_request.") }.count,
            commandRejectionCount: records.filter { $0.eventType.hasPrefix("command.rejected") }.count,
            highRiskExecutionCount: records.filter(isHighRiskExecution).count,
            filePermissionChangeCount: records.filter { $0.eventType.hasPrefix("file_permission.") }.count,
            exportResetAttemptCount: records.filter { $0.eventType.hasPrefix("export_reset.") || $0.eventType.hasPrefix("reset.") }.count,
            recoveryEventCount: records.filter { $0.eventType.hasPrefix("recovery.") }.count,
            auditWriteFailureCount: records.filter { $0.eventType == "audit.writer_failure" || $0.context["writeStatus"] == .string("failed") }.count,
            redactionAppliedCount: records.filter(recordContainsRedaction).count,
            categoryCounts: categoryCounts.reduce(into: JSONRecord()) { output, pair in
                output[pair.key] = .number(Double(pair.value))
            },
            redactionStatus: "private-state-excluded"
        )
        _ = try? data.saveSecurityMetricSnapshot(snapshot)
        return snapshot
    }

    public func latestPersistedSummary(context: ServiceRequestContext) throws -> SecurityMetricSnapshot? {
        try requireAuditAdmin(context: context, action: "summary")
        return try data.latestSecurityMetricSnapshot(workspaceId: context.workspaceId)
    }

    public func redactEvidenceSnippet(_ snippet: String) -> String {
        redactEvidenceString(snippet)
    }

    private func requireAuditAdmin(context: ServiceRequestContext, action: String) throws {
        guard let denied = ServiceGuard.requireAnyRole(
            [.owner, .admin],
            context: context,
            message: "Audit and security records require owner or admin authority.",
            recovery: "Ask a workspace owner or admin to review local audit records."
        ) else {
            return
        }
        _ = record(
            context: context,
            request: AuditLogRecordRequest(
                eventType: "audit.read.denied",
                resourceType: "audit_log",
                severity: "warning",
                message: "Audit read denied.",
                source: "audit-security-service",
                context: [
                    "action": .string(action),
                    "stateKind": .string(denied.stateKind.rawValue),
                    "reasonCode": .string(denied.reasonCode.rawValue),
                    "auditRequired": .bool(denied.auditRequired)
                ]
            )
        )
        throw denied
    }

    private func isDeniedAction(_ record: AuditLogRecord) -> Bool {
        record.eventType.contains(".denied")
            || record.eventType == "authority.denied_action"
            || record.context["reasonCode"] != nil
    }

    private func isHighRiskExecution(_ record: AuditLogRecord) -> Bool {
        if record.eventType.hasPrefix("high_risk.") {
            return true
        }
        if case .string(let risk)? = record.context["riskLevel"] {
            return risk == "high" || risk == "destructive"
        }
        return false
    }

    private func recordContainsRedaction(_ record: AuditLogRecord) -> Bool {
        guard let encoded = encodeJSONString(record) else {
            return record.message.contains("[REDACTED]")
        }
        return encoded.contains("[REDACTED]")
    }
}
