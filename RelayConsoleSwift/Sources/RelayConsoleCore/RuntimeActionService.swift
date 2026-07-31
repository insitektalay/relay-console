import Foundation

public final class RuntimeActionService {
    public static let hostControlExclusionReason = "Mission Control host-control, local app process control, and local app command execution are excluded from Swift scope."

    private let data: LocalDataService

    public init(data: LocalDataService) {
        self.data = data
    }

    public func refreshCapabilities(
        context: ServiceRequestContext,
        dispatchId: RelayId? = nil,
        now: Date = Date()
    ) throws -> [RuntimeActionCapability] {
        try requireReadAccess(context: context)
        let evaluatedAt = ISO8601DateFormatter.relayConsole.string(from: now)
        var capabilities = [
            dashboardDryRunCapability(context: context, evaluatedAt: evaluatedAt),
            controlledFileWriteCapability(context: context, evaluatedAt: evaluatedAt),
            controlledProviderWriteCapability(context: context, evaluatedAt: evaluatedAt),
            excludedHostControlCapability(context: context, evaluatedAt: evaluatedAt),
            destructiveLocalCommandCapability(context: context, evaluatedAt: evaluatedAt)
        ]
        if let dispatchId {
            capabilities.append(contentsOf: try dispatchCapabilities(context: context, dispatchId: dispatchId, evaluatedAt: evaluatedAt))
        }
        return try data.saveRuntimeActionCapabilities(capabilities)
    }

    public func listCapabilities(context: ServiceRequestContext, limit: Int = 100) throws -> [RuntimeActionCapability] {
        try requireReadAccess(context: context)
        return try data.listRuntimeActionCapabilities(workspaceId: context.workspaceId, limit: limit)
    }

    @discardableResult
    public func recordDryRun(
        context: ServiceRequestContext,
        kind: RuntimeActionKind,
        idempotencyKey: String,
        scopeType: RuntimeActionScopeType,
        runtimeType: RuntimeType? = nil,
        harnessId: RelayId? = nil,
        dispatchId: RelayId? = nil,
        agentId: RelayId? = nil,
        request: JSONRecord = [:],
        now: Date = Date()
    ) throws -> RuntimeActionRun {
        try requireOperatorAccess(context: context)
        return try createRun(
            context: context,
            kind: kind,
            status: .dryRun,
            stateKind: .readOnly,
            reasonCode: .authorityReadOnly,
            idempotencyKey: idempotencyKey,
            scopeType: scopeType,
            runtimeType: runtimeType,
            harnessId: harnessId,
            dispatchId: dispatchId,
            agentId: agentId,
            destructive: false,
            dryRun: true,
            executionAttempted: false,
            request: request,
            result: ["summary": .string("Dry run recorded without executing a runtime action.")],
            failure: nil,
            now: now
        )
    }

    @discardableResult
    public func rejectUnsupported(
        context: ServiceRequestContext,
        kind: RuntimeActionKind,
        idempotencyKey: String,
        scopeType: RuntimeActionScopeType,
        runtimeType: RuntimeType? = nil,
        harnessId: RelayId? = nil,
        dispatchId: RelayId? = nil,
        agentId: RelayId? = nil,
        message: String = RuntimeActionService.hostControlExclusionReason,
        now: Date = Date()
    ) throws -> RuntimeActionRun {
        try requireOperatorAccess(context: context)
        return try createRun(
            context: context,
            kind: kind,
            status: .unsupported,
            stateKind: .unavailable,
            reasonCode: .actionUnsupported,
            idempotencyKey: idempotencyKey,
            scopeType: scopeType,
            runtimeType: runtimeType,
            harnessId: harnessId,
            dispatchId: dispatchId,
            agentId: agentId,
            destructive: false,
            dryRun: false,
            executionAttempted: false,
            request: ["message": .string(message)],
            result: nil,
            failure: ["message": .string(message), "redactionStatus": .string("redacted")],
            now: now
        )
    }

    @discardableResult
    public func blockDestructive(
        context: ServiceRequestContext,
        kind: RuntimeActionKind,
        idempotencyKey: String,
        scopeType: RuntimeActionScopeType,
        runtimeType: RuntimeType? = nil,
        harnessId: RelayId? = nil,
        dispatchId: RelayId? = nil,
        agentId: RelayId? = nil,
        message: String = "Destructive runtime actions are blocked until permission, approval, and audit gates are implemented.",
        now: Date = Date()
    ) throws -> RuntimeActionRun {
        try requireOperatorAccess(context: context)
        return try createRun(
            context: context,
            kind: kind,
            status: .rejected,
            stateKind: .blockedAction,
            reasonCode: .policyBlocked,
            idempotencyKey: idempotencyKey,
            scopeType: scopeType,
            runtimeType: runtimeType,
            harnessId: harnessId,
            dispatchId: dispatchId,
            agentId: agentId,
            destructive: true,
            dryRun: false,
            executionAttempted: false,
            request: ["message": .string(message)],
            result: nil,
            failure: ["message": .string(message), "redactionStatus": .string("redacted")],
            now: now
        )
    }

    @discardableResult
    public func recordFailure(
        context: ServiceRequestContext,
        kind: RuntimeActionKind,
        idempotencyKey: String,
        scopeType: RuntimeActionScopeType,
        runtimeType: RuntimeType? = nil,
        harnessId: RelayId? = nil,
        dispatchId: RelayId? = nil,
        agentId: RelayId? = nil,
        message: String,
        now: Date = Date()
    ) throws -> RuntimeActionRun {
        try requireOperatorAccess(context: context)
        return try createRun(
            context: context,
            kind: kind,
            status: .failed,
            stateKind: .terminalError,
            reasonCode: .errorTerminal,
            idempotencyKey: idempotencyKey,
            scopeType: scopeType,
            runtimeType: runtimeType,
            harnessId: harnessId,
            dispatchId: dispatchId,
            agentId: agentId,
            destructive: false,
            dryRun: false,
            executionAttempted: false,
            request: [:],
            result: nil,
            failure: ["message": .string(redactString(message)), "redactionStatus": .string("redacted")],
            now: now
        )
    }

    public func listRuns(context: ServiceRequestContext, limit: Int = 50) throws -> [RuntimeActionRun] {
        try requireReadAccess(context: context)
        return try data.listRuntimeActionRuns(workspaceId: context.workspaceId, limit: limit)
    }

    @discardableResult
    public func trimHistory(context: ServiceRequestContext, keepLatest: Int) throws -> Int {
        try requireOperatorAccess(context: context)
        return try data.trimRuntimeActionRuns(workspaceId: context.workspaceId, keepLatest: keepLatest)
    }

    private func dispatchCapabilities(
        context: ServiceRequestContext,
        dispatchId: RelayId,
        evaluatedAt: IsoTimestamp
    ) throws -> [RuntimeActionCapability] {
        let dispatch = try data.getDispatch(dispatchId)
        let thread = try data.getThread(dispatch.threadId)
        guard thread.workspaceId == context.workspaceId else {
            throw ServiceGuard.invalidInput(context: context, message: "Runtime dispatch does not belong to this workspace.")
        }
        let activeDispatchExists = try data.listDispatchesForThread(dispatch.threadId)
            .contains { $0.id != dispatch.id && $0.isActive }
        let sourceMessage = try dispatch.retrySourceMessageId.map(data.getMessage)
        let sourceHasRetryableContent: Bool
        if let sourceMessage {
            sourceHasRetryableContent = sourceMessage.senderType == .user
                && sourceMessage.threadId == dispatch.threadId
                && !sourceMessage.content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        } else {
            sourceHasRetryableContent = false
        }
        let actionState = dispatch.actionState(
            capabilities: nil,
            hasActiveDispatchForThread: activeDispatchExists,
            sourceMessageExists: sourceMessage != nil,
            sourceHasRetryableContent: sourceHasRetryableContent
        )
        return [
            capability(
                context: context,
                kind: .cancelDispatch,
                displayName: "Cancel dispatch",
                availability: availability(for: actionState.cancelReason, available: actionState.canCancel),
                stateKind: stateKind(for: actionState.cancelReason, available: actionState.canCancel),
                reasonCode: reasonCode(for: actionState.cancelReason, available: actionState.canCancel),
                message: message(for: actionState.cancelReason, action: "cancel"),
                recovery: recovery(for: actionState.cancelReason),
                scopeType: .dispatch,
                runtimeType: dispatch.runtimeType,
                harnessId: dispatch.harnessId,
                dispatchId: dispatch.id,
                agentId: dispatch.agentId,
                destructive: false,
                dryRunSupported: true,
                executionSupported: false,
                readOnly: true,
                evaluatedAt: evaluatedAt,
                source: "runtime_dispatch.action_state"
            ),
            capability(
                context: context,
                kind: .retryDispatch,
                displayName: "Retry dispatch",
                availability: availability(for: actionState.retryReason, available: actionState.canRetry),
                stateKind: stateKind(for: actionState.retryReason, available: actionState.canRetry),
                reasonCode: reasonCode(for: actionState.retryReason, available: actionState.canRetry),
                message: message(for: actionState.retryReason, action: "retry"),
                recovery: recovery(for: actionState.retryReason),
                scopeType: .dispatch,
                runtimeType: dispatch.runtimeType,
                harnessId: dispatch.harnessId,
                dispatchId: dispatch.id,
                agentId: dispatch.agentId,
                destructive: false,
                dryRunSupported: true,
                executionSupported: false,
                readOnly: true,
                evaluatedAt: evaluatedAt,
                source: "runtime_dispatch.action_state"
            )
        ]
    }

    private func dashboardDryRunCapability(context: ServiceRequestContext, evaluatedAt: IsoTimestamp) -> RuntimeActionCapability {
        capability(
            context: context,
            kind: .refreshRuntimeDashboard,
            displayName: "Refresh runtime dashboard",
            availability: .dryRunOnly,
            stateKind: .readOnly,
            reasonCode: .authorityReadOnly,
            message: "Runtime dashboard actions are inspectable as read-only dry runs until safety gates land.",
            recovery: "Use refresh to update read models; command execution remains disabled.",
            scopeType: .dashboard,
            runtimeType: nil,
            harnessId: nil,
            dispatchId: nil,
            agentId: nil,
            destructive: false,
            dryRunSupported: true,
            executionSupported: false,
            readOnly: true,
            evaluatedAt: evaluatedAt,
            source: "runtime_dashboard.read_only"
        )
    }

    private func controlledFileWriteCapability(context: ServiceRequestContext, evaluatedAt: IsoTimestamp) -> RuntimeActionCapability {
        capability(
            context: context,
            kind: .controlledFileWrite,
            displayName: "Controlled file write",
            availability: .dryRunOnly,
            stateKind: .decisionGated,
            reasonCode: .decisionRequired,
            message: "Controlled file writes are retained as approval, policy, audit, and native-permission dry runs until SAFETY-001 defines first-release write scope.",
            recovery: "Review the task-scoped approval, permission policy, and linked native file permission evidence before enabling execution.",
            scopeType: .workspace,
            runtimeType: nil,
            harnessId: nil,
            dispatchId: nil,
            agentId: nil,
            destructive: true,
            dryRunSupported: true,
            executionSupported: false,
            readOnly: true,
            evaluatedAt: evaluatedAt,
            source: "controlled_action.safety_gate"
        )
    }

    private func controlledProviderWriteCapability(context: ServiceRequestContext, evaluatedAt: IsoTimestamp) -> RuntimeActionCapability {
        capability(
            context: context,
            kind: .controlledProviderWrite,
            displayName: "Controlled provider write",
            availability: .dryRunOnly,
            stateKind: .decisionGated,
            reasonCode: .decisionRequired,
            message: "Controlled provider writes are retained as approval, policy, and audit dry runs until SAFETY-001 defines first-release write scope.",
            recovery: "Keep provider write actions in dry-run evidence until the first-release scope decision is closed.",
            scopeType: .workspace,
            runtimeType: nil,
            harnessId: nil,
            dispatchId: nil,
            agentId: nil,
            destructive: true,
            dryRunSupported: true,
            executionSupported: false,
            readOnly: true,
            evaluatedAt: evaluatedAt,
            source: "controlled_action.safety_gate"
        )
    }

    private func excludedHostControlCapability(context: ServiceRequestContext, evaluatedAt: IsoTimestamp) -> RuntimeActionCapability {
        capability(
            context: context,
            kind: .hostControl,
            displayName: "Host control",
            availability: .unsupported,
            stateKind: .unavailable,
            reasonCode: .actionUnsupported,
            message: Self.hostControlExclusionReason,
            recovery: "Do not expose Mission Control host-control unless Swift scope is explicitly reinstated.",
            scopeType: .workspace,
            runtimeType: nil,
            harnessId: nil,
            dispatchId: nil,
            agentId: nil,
            destructive: true,
            dryRunSupported: false,
            executionSupported: false,
            readOnly: true,
            evaluatedAt: evaluatedAt,
            source: "exclusion_register"
        )
    }

    private func destructiveLocalCommandCapability(context: ServiceRequestContext, evaluatedAt: IsoTimestamp) -> RuntimeActionCapability {
        capability(
            context: context,
            kind: .localAppCommand,
            displayName: "Local app command",
            availability: .destructiveBlocked,
            stateKind: .blockedAction,
            reasonCode: .policyBlocked,
            message: "Local app command execution is blocked until permission, approval, and audit gates are implemented.",
            recovery: "Use read-only runtime/dashboard records for now.",
            scopeType: .workspace,
            runtimeType: nil,
            harnessId: nil,
            dispatchId: nil,
            agentId: nil,
            destructive: true,
            dryRunSupported: false,
            executionSupported: false,
            readOnly: true,
            evaluatedAt: evaluatedAt,
            source: "exclusion_register"
        )
    }

    private func capability(
        context: ServiceRequestContext,
        kind: RuntimeActionKind,
        displayName: String,
        availability: RuntimeActionAvailabilityState,
        stateKind: GuardedStateKind,
        reasonCode: GuardReasonCode,
        message: String,
        recovery: String?,
        scopeType: RuntimeActionScopeType,
        runtimeType: RuntimeType?,
        harnessId: RelayId?,
        dispatchId: RelayId?,
        agentId: RelayId?,
        destructive: Bool,
        dryRunSupported: Bool,
        executionSupported: Bool,
        readOnly: Bool,
        evaluatedAt: IsoTimestamp,
        source: String
    ) -> RuntimeActionCapability {
        RuntimeActionCapability(
            id: stableCapabilityId(workspaceId: context.workspaceId, kind: kind, dispatchId: dispatchId, harnessId: harnessId),
            workspaceId: context.workspaceId,
            kind: kind,
            displayName: displayName,
            availability: availability,
            stateKind: stateKind,
            reasonCode: reasonCode,
            message: redactString(message),
            recovery: recovery.map(redactString),
            scopeType: scopeType,
            runtimeType: runtimeType,
            harnessId: harnessId,
            dispatchId: dispatchId,
            agentId: agentId,
            destructive: destructive,
            dryRunSupported: dryRunSupported,
            executionSupported: executionSupported,
            readOnly: readOnly,
            staleAfterSeconds: 300,
            evaluatedAt: evaluatedAt,
            source: source,
            redactionStatus: "private-state-excluded"
        )
    }

    private func createRun(
        context: ServiceRequestContext,
        kind: RuntimeActionKind,
        status: RuntimeActionRunStatus,
        stateKind: GuardedStateKind,
        reasonCode: GuardReasonCode,
        idempotencyKey: String,
        scopeType: RuntimeActionScopeType,
        runtimeType: RuntimeType?,
        harnessId: RelayId?,
        dispatchId: RelayId?,
        agentId: RelayId?,
        destructive: Bool,
        dryRun: Bool,
        executionAttempted: Bool,
        request: JSONRecord,
        result: JSONRecord?,
        failure: JSONRecord?,
        now: Date
    ) throws -> RuntimeActionRun {
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
        let trimmedKey = idempotencyKey.trimmingCharacters(in: .whitespacesAndNewlines)
        let stableKey = trimmedKey.isEmpty ? "\(kind.rawValue)-\(timestamp)" : trimmedKey
        let run = RuntimeActionRun(
            id: createRelayId("rar"),
            workspaceId: context.workspaceId,
            capabilityId: nil,
            kind: kind,
            status: status,
            stateKind: stateKind,
            reasonCode: reasonCode,
            idempotencyKey: stableKey,
            actorId: context.actorId,
            scopeType: scopeType,
            runtimeType: runtimeType,
            harnessId: harnessId,
            dispatchId: dispatchId,
            agentId: agentId,
            destructive: destructive,
            dryRun: dryRun,
            executionAttempted: executionAttempted,
            request: request,
            result: result,
            failure: failure,
            retentionExpiresAt: ISO8601DateFormatter.relayConsole.string(from: now.addingTimeInterval(60 * 60 * 24 * 30)),
            createdAt: timestamp,
            updatedAt: timestamp,
            completedAt: [.running].contains(status) ? nil : timestamp,
            redactionStatus: "private-state-excluded"
        )
        return try data.createRuntimeActionRun(run)
    }

    private func availability(for reason: RuntimeDispatchActionReason, available: Bool) -> RuntimeActionAvailabilityState {
        if available { return .available }
        switch reason {
        case .capabilityMissing:
            return .missingCapability
        case .activeDispatchExists:
            return .running
        case .terminal:
            return .cancelled
        case .authRequired:
            return .failed
        case .available:
            return .available
        default:
            return .rejected
        }
    }

    private func stateKind(for reason: RuntimeDispatchActionReason, available: Bool) -> GuardedStateKind {
        if available { return .readOnly }
        switch reason {
        case .capabilityMissing:
            return .dependencyMissing
        case .activeDispatchExists:
            return .pending
        case .authRequired:
            return .authRequired
        case .terminal, .retryEvidenceMissing:
            return .terminalError
        default:
            return .disabled
        }
    }

    private func reasonCode(for reason: RuntimeDispatchActionReason, available: Bool) -> GuardReasonCode {
        if available { return .authorityReadOnly }
        switch reason {
        case .capabilityMissing:
            return .capabilityMissing
        case .activeDispatchExists:
            return .operationPending
        case .authRequired:
            return .authRequired
        case .retrySourceMissing, .retryContentMissing:
            return .dependencyMissing
        case .retryEvidenceMissing, .terminal:
            return .errorTerminal
        case .failedRequired, .activeRequired:
            return .inputInvalid
        case .available:
            return .authorityReadOnly
        }
    }

    private func message(for reason: RuntimeDispatchActionReason, action: String) -> String {
        switch reason {
        case .available:
            return "\(action.capitalized) is inspectable as a read-only capability; execution stays with guarded runtime services."
        case .activeRequired:
            return "An active runtime dispatch is required before \(action)."
        case .failedRequired:
            return "A failed runtime dispatch is required before \(action)."
        case .terminal:
            return "This runtime dispatch is already terminal."
        case .retryEvidenceMissing:
            return "This runtime failure is not marked retryable."
        case .retrySourceMissing:
            return "The source message for retry is missing."
        case .retryContentMissing:
            return "The source message has no retryable content."
        case .activeDispatchExists:
            return "Another dispatch is already active for this thread."
        case .capabilityMissing:
            return "The selected runtime does not expose this capability in the retained read model."
        case .authRequired:
            return "Runtime authentication is required."
        }
    }

    private func recovery(for reason: RuntimeDispatchActionReason) -> String? {
        switch reason {
        case .available:
            return "Use the guarded runtime service when execution is explicitly allowed."
        case .activeDispatchExists:
            return "Wait for the current dispatch to finish."
        case .authRequired:
            return "Reconnect the runtime from Harnesses."
        case .capabilityMissing:
            return "Keep this as read-only history unless the runtime reports support."
        default:
            return nil
        }
    }

    private func stableCapabilityId(workspaceId: RelayId, kind: RuntimeActionKind, dispatchId: RelayId?, harnessId: RelayId?) -> RelayId {
        [workspaceId, kind.rawValue, dispatchId, harnessId]
            .compactMap { $0 }
            .joined(separator: "-")
            .replacingOccurrences(of: "_", with: "-")
            .replacingOccurrences(of: ".", with: "-")
    }

    private func requireReadAccess(context: ServiceRequestContext) throws {
        if let denied = ServiceGuard.requireAnyRole(
            [.owner, .admin, .member],
            context: context,
            message: "Reading runtime action capabilities requires workspace access."
        ) {
            throw denied
        }
    }

    private func requireOperatorAccess(context: ServiceRequestContext) throws {
        if let denied = ServiceGuard.requireAnyRole(
            [.owner, .admin, .operator],
            context: context,
            message: "Recording runtime action runs requires operator access."
        ) {
            throw denied
        }
    }
}
