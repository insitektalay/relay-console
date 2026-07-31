import Foundation

public struct ControlledActionRequest: Codable, Equatable, Sendable {
    public var kind: RuntimeActionKind
    public var idempotencyKey: String
    public var operationName: String
    public var scopeType: RuntimeActionScopeType
    public var runtimeType: RuntimeType?
    public var harnessId: RelayId?
    public var dispatchId: RelayId?
    public var agentId: RelayId?
    public var approvalId: RelayId?
    public var nativeFilePermissionId: RelayId?
    public var payload: JSONRecord

    public init(
        kind: RuntimeActionKind,
        idempotencyKey: String,
        operationName: String,
        scopeType: RuntimeActionScopeType,
        runtimeType: RuntimeType? = nil,
        harnessId: RelayId? = nil,
        dispatchId: RelayId? = nil,
        agentId: RelayId? = nil,
        approvalId: RelayId? = nil,
        nativeFilePermissionId: RelayId? = nil,
        payload: JSONRecord = [:]
    ) {
        self.kind = kind
        self.idempotencyKey = idempotencyKey
        self.operationName = operationName
        self.scopeType = scopeType
        self.runtimeType = runtimeType
        self.harnessId = harnessId
        self.dispatchId = dispatchId
        self.agentId = agentId
        self.approvalId = approvalId
        self.nativeFilePermissionId = nativeFilePermissionId
        self.payload = payload
    }
}

public final class ControlledActionService {
    public static let activationDecisionId = "SAFETY-001"

    private let data: LocalDataService
    private let permissions: PermissionPolicyService?
    private let auditSecurity: AuditSecurityService?
    private let nativeFilePermissions: NativeFilePermissionService?

    public init(
        data: LocalDataService,
        permissions: PermissionPolicyService? = nil,
        auditSecurity: AuditSecurityService? = nil,
        nativeFilePermissions: NativeFilePermissionService? = nil
    ) {
        self.data = data
        self.permissions = permissions
        self.auditSecurity = auditSecurity
        self.nativeFilePermissions = nativeFilePermissions
    }

    @discardableResult
    public func attemptControlledWrite(
        context: ServiceRequestContext,
        request: ControlledActionRequest,
        now: Date = Date()
    ) throws -> RuntimeActionRun {
        try requireOperatorAccess(context: context)
        guard let permissions else {
            let run = try createRun(
                context: context,
                request: request,
                status: .rejected,
                stateKind: .dependencyMissing,
                reasonCode: .featureMissingService,
                dryRun: false,
                result: nil,
                failure: failure("Controlled write requires permission policy service wiring.", reasonCode: .featureMissingService),
                now: now
            )
            recordAudit(context: context, eventType: "controlled_action.blocked", run: run, request: request, now: now)
            return run
        }
        guard auditSecurity != nil else {
            let run = try createRun(
                context: context,
                request: request,
                status: .rejected,
                stateKind: .dependencyMissing,
                reasonCode: .featureMissingService,
                dryRun: false,
                result: nil,
                failure: failure("Controlled write requires audit service wiring.", reasonCode: .featureMissingService),
                now: now
            )
            return run
        }
        guard [.controlledFileWrite, .controlledProviderWrite].contains(request.kind) else {
            let run = try createRun(
                context: context,
                request: request,
                status: .unsupported,
                stateKind: .unavailable,
                reasonCode: .actionUnsupported,
                dryRun: false,
                result: nil,
                failure: failure("Controlled action kind is not retained.", reasonCode: .actionUnsupported),
                now: now
            )
            recordAudit(context: context, eventType: "controlled_action.unsupported", run: run, request: request, now: now)
            return run
        }

        do {
            try permissions.requireAllowed(
                context: context,
                resourceType: "controlled_action",
                resourceId: request.approvalId ?? request.nativeFilePermissionId,
                action: "execute",
                detail: policyDetail(request: request),
                now: now
            )
        } catch let denied as ServiceGuardResult {
            let run = try createRun(
                context: context,
                request: request,
                status: .rejected,
                stateKind: denied.stateKind,
                reasonCode: denied.reasonCode,
                dryRun: false,
                result: nil,
                failure: failure(denied.message, reasonCode: denied.reasonCode),
                now: now
            )
            recordAudit(context: context, eventType: "controlled_action.blocked", run: run, request: request, now: now)
            return run
        }

        guard let approvalId = request.approvalId else {
            let run = try createRun(
                context: context,
                request: request,
                status: .rejected,
                stateKind: .approvalRequired,
                reasonCode: .approvalRequired,
                dryRun: false,
                result: nil,
                failure: failure("Controlled write requires an approved task-scoped approval.", reasonCode: .approvalRequired),
                now: now
            )
            recordAudit(context: context, eventType: "controlled_action.blocked", run: run, request: request, now: now)
            return run
        }

        let approval: WorkSafetyApprovalRecord
        do {
            approval = try data.getWorkSafetyApproval(approvalId)
        } catch {
            let run = try createRun(
                context: context,
                request: request,
                status: .rejected,
                stateKind: .approvalRequired,
                reasonCode: .approvalRequired,
                dryRun: false,
                result: nil,
                failure: failure("Controlled write approval record was not found.", reasonCode: .approvalRequired),
                now: now
            )
            recordAudit(context: context, eventType: "controlled_action.blocked", run: run, request: request, now: now)
            return run
        }
        guard approval.workspaceId == context.workspaceId, approval.status == .approved else {
            let run = try createRun(
                context: context,
                request: request,
                status: .rejected,
                stateKind: .approvalRequired,
                reasonCode: .approvalRequired,
                dryRun: false,
                result: nil,
                failure: failure("Controlled write approval is not approved.", reasonCode: .approvalRequired),
                now: now
            )
            recordAudit(context: context, eventType: "controlled_action.blocked", run: run, request: request, now: now)
            return run
        }

        if request.kind == .controlledFileWrite {
            guard let permissionId = request.nativeFilePermissionId else {
                let run = try createRun(
                    context: context,
                    request: request,
                    status: .rejected,
                    stateKind: .permissionNeeded,
                    reasonCode: .permissionNeeded,
                    dryRun: false,
                    result: nil,
                    failure: failure("Controlled file write requires native file permission.", reasonCode: .permissionNeeded),
                    now: now
                )
                recordAudit(context: context, eventType: "controlled_action.blocked", run: run, request: request, now: now)
                return run
            }
            guard let nativeFilePermissions else {
                let run = try createRun(
                    context: context,
                    request: request,
                    status: .rejected,
                    stateKind: .dependencyMissing,
                    reasonCode: .featureMissingService,
                    dryRun: false,
                    result: nil,
                    failure: failure("Controlled file write requires native file permission service wiring.", reasonCode: .featureMissingService),
                    now: now
                )
                recordAudit(context: context, eventType: "controlled_action.blocked", run: run, request: request, now: now)
                return run
            }
            do {
                _ = try nativeFilePermissions.requireAccess(
                    context: context,
                    permissionId: permissionId,
                    requiredAccess: .readWrite,
                    action: "write",
                    now: now
                )
            } catch let denied as ServiceGuardResult {
                let run = try createRun(
                    context: context,
                    request: request,
                    status: denied.retryable ? .stale : .rejected,
                    stateKind: denied.stateKind,
                    reasonCode: denied.reasonCode,
                    dryRun: false,
                    result: nil,
                    failure: failure(denied.message, reasonCode: denied.reasonCode),
                    now: now
                )
                recordAudit(context: context, eventType: "controlled_action.blocked", run: run, request: request, now: now)
                return run
            }
        }

        let run = try createRun(
            context: context,
            request: request,
            status: .dryRun,
            stateKind: .decisionGated,
            reasonCode: .decisionRequired,
            dryRun: true,
            result: [
                "summary": .string("Controlled write gates passed; execution remains dry-run until first-release write scope is approved."),
                "activationDecisionId": .string(Self.activationDecisionId),
                "approvalId": .string(approval.id),
                "writeSideEffect": .bool(false),
                "executionAttempted": .bool(false)
            ],
            failure: nil,
            now: now
        )
        recordAudit(context: context, eventType: "controlled_action.dry_run_succeeded", run: run, request: request, now: now)
        return run
    }

    private func requireOperatorAccess(context: ServiceRequestContext) throws {
        if let denied = ServiceGuard.requireAnyRole(
            [.owner, .admin, .operator],
            context: context,
            message: "Controlled write actions require owner, admin, or explicitly policy-authorized operator access."
        ) {
            throw denied
        }
    }

    private func createRun(
        context: ServiceRequestContext,
        request: ControlledActionRequest,
        status: RuntimeActionRunStatus,
        stateKind: GuardedStateKind,
        reasonCode: GuardReasonCode,
        dryRun: Bool,
        result: JSONRecord?,
        failure: JSONRecord?,
        now: Date
    ) throws -> RuntimeActionRun {
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
        let idempotencyKey = request.idempotencyKey.trimmingCharacters(in: .whitespacesAndNewlines)
        let stableKey = idempotencyKey.isEmpty ? "\(request.kind.rawValue)-\(timestamp)" : idempotencyKey
        let run = RuntimeActionRun(
            id: createRelayId("rar"),
            workspaceId: context.workspaceId,
            capabilityId: nil,
            kind: request.kind,
            status: status,
            stateKind: stateKind,
            reasonCode: reasonCode,
            idempotencyKey: stableKey,
            actorId: context.actorId,
            scopeType: request.scopeType,
            runtimeType: request.runtimeType,
            harnessId: request.harnessId,
            dispatchId: request.dispatchId,
            agentId: request.agentId,
            destructive: request.kind == .controlledFileWrite,
            dryRun: dryRun,
            executionAttempted: false,
            request: sanitizedRequestRecord(request),
            result: result,
            failure: failure,
            retentionExpiresAt: ISO8601DateFormatter.relayConsole.string(from: now.addingTimeInterval(60 * 60 * 24 * 30)),
            createdAt: timestamp,
            updatedAt: timestamp,
            completedAt: timestamp,
            redactionStatus: "private-state-excluded"
        )
        return try data.createRuntimeActionRun(run)
    }

    private func sanitizedRequestRecord(_ request: ControlledActionRequest) -> JSONRecord {
        [
            "operationName": .string(request.operationName),
            "approvalId": request.approvalId.map(JSONValue.string) ?? .null,
            "nativeFilePermissionId": request.nativeFilePermissionId.map(JSONValue.string) ?? .null,
            "payload": .object(request.payload),
            "rawFileContentsPersisted": .bool(false),
            "writeSideEffect": .bool(false),
            "localAppAutonomyExcluded": .bool(true),
            "paperclipExcluded": .bool(true),
            "sourceSyncExcluded": .bool(true),
            "activationDecisionId": .string(Self.activationDecisionId),
            "source": .string("controlled-action-service")
        ]
    }

    private func policyDetail(request: ControlledActionRequest) -> JSONRecord {
        [
            "action": .string("execute"),
            "kind": .string(request.kind.rawValue),
            "operationName": .string(request.operationName),
            "approvalId": request.approvalId.map(JSONValue.string) ?? .null,
            "nativeFilePermissionId": request.nativeFilePermissionId.map(JSONValue.string) ?? .null,
            "writeSideEffect": .bool(false),
            "rawFileContentsPersisted": .bool(false)
        ]
    }

    private func failure(_ message: String, reasonCode: GuardReasonCode) -> JSONRecord {
        [
            "message": .string(message),
            "reasonCode": .string(reasonCode.rawValue),
            "writeSideEffect": .bool(false),
            "executionAttempted": .bool(false),
            "redactionStatus": .string("private-state-excluded")
        ]
    }

    private func recordAudit(
        context: ServiceRequestContext,
        eventType: String,
        run: RuntimeActionRun,
        request: ControlledActionRequest,
        now: Date
    ) {
        _ = auditSecurity?.record(
            context: context,
            request: AuditLogRecordRequest(
                eventType: eventType,
                resourceType: "controlled_action",
                resourceId: run.id,
                severity: run.status == .dryRun ? "info" : "warning",
                message: run.status == .dryRun ? "Controlled write dry run recorded." : "Controlled write blocked before side effects.",
                approvalId: request.approvalId,
                actionRunId: run.id,
                dispatchId: request.dispatchId,
                source: "controlled-action-service",
                context: [
                    "kind": .string(request.kind.rawValue),
                    "status": .string(run.status.rawValue),
                    "stateKind": .string(run.stateKind.rawValue),
                    "reasonCode": .string(run.reasonCode.rawValue),
                    "operationName": .string(request.operationName),
                    "nativeFilePermissionId": request.nativeFilePermissionId.map(JSONValue.string) ?? .null,
                    "writeSideEffect": .bool(false),
                    "executionAttempted": .bool(false),
                    "rawFileContentsPersisted": .bool(false),
                    "activationDecisionId": .string(Self.activationDecisionId)
                ]
            ),
            now: now
        )
    }
}
