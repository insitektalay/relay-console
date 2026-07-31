import Foundation

public enum GuardedStateKind: String, Codable, Equatable, Sendable {
    case unavailable
    case disabled
    case pending
    case decisionGated = "decision_gated"
    case permissionNeeded = "permission_needed"
    case readOnly = "read_only"
    case approvalRequired = "approval_required"
    case blockedAction = "blocked_action"
    case authRequired = "auth_required"
    case dependencyMissing = "dependency_missing"
    case retryableError = "retryable_error"
    case terminalError = "terminal_error"
}

public enum GuardReasonCode: String, Codable, Equatable, Sendable {
    case available
    case featureUnavailable = "feature.unavailable"
    case featureMissingMigration = "feature.missing_migration"
    case featureMissingService = "feature.missing_service"
    case featureMissingFixture = "feature.missing_fixture"
    case decisionRequired = "decision.required"
    case inputInvalid = "input.invalid"
    case selectionRequired = "selection.required"
    case operationPending = "operation.pending"
    case permissionNeeded = "permission.needed"
    case authorityRoleRequired = "authority.role_required"
    case authorityReadOnly = "authority.read_only"
    case approvalRequired = "approval.required"
    case policyBlocked = "policy.blocked"
    case capabilityMissing = "capability.missing"
    case renderingUnavailable = "rendering.unavailable"
    case actionUnsupported = "action.unsupported"
    case authRequired = "auth.required"
    case dependencyMissing = "dependency.missing"
    case runtimeUnavailable = "runtime.unavailable"
    case errorRetryable = "error.retryable"
    case errorTerminal = "error.terminal"
}

public enum ServiceRole: String, Codable, CaseIterable, Hashable, Sendable {
    case owner
    case admin
    case member
    case viewer
    case approver
    case `operator`
}

public struct ServiceRequestContext: Codable, Equatable, Sendable {
    public var actorId: RelayId
    public var workspaceId: RelayId
    public var roles: Set<ServiceRole>
    public var correlationId: String

    public init(actorId: RelayId, workspaceId: RelayId, roles: Set<ServiceRole>, correlationId: String) {
        self.actorId = actorId
        self.workspaceId = workspaceId
        self.roles = roles
        self.correlationId = correlationId
    }

    public func hasAnyRole(_ requiredRoles: Set<ServiceRole>) -> Bool {
        !roles.isDisjoint(with: requiredRoles)
    }
}

public struct ServiceGuardResult: Error, LocalizedError, Codable, Equatable, Sendable {
    public var stateKind: GuardedStateKind
    public var reasonCode: GuardReasonCode
    public var message: String
    public var recovery: String?
    public var correlationId: String
    public var decisionId: String?
    public var auditRequired: Bool
    public var retryable: Bool

    public init(
        stateKind: GuardedStateKind,
        reasonCode: GuardReasonCode,
        message: String,
        recovery: String? = nil,
        correlationId: String,
        decisionId: String? = nil,
        auditRequired: Bool = false,
        retryable: Bool = false
    ) {
        self.stateKind = stateKind
        self.reasonCode = reasonCode
        self.message = message
        self.recovery = recovery
        self.correlationId = correlationId
        self.decisionId = decisionId
        self.auditRequired = auditRequired
        self.retryable = retryable
    }

    public var errorDescription: String? {
        message
    }
}

public enum ServiceGuard {
    public static func requireAnyRole(
        _ requiredRoles: Set<ServiceRole>,
        context: ServiceRequestContext,
        message: String = "Your current role cannot perform this action.",
        recovery: String? = nil,
        auditRequired: Bool = true
    ) -> ServiceGuardResult? {
        guard !context.hasAnyRole(requiredRoles) else {
            return nil
        }
        return ServiceGuardResult(
            stateKind: .readOnly,
            reasonCode: .authorityRoleRequired,
            message: message,
            recovery: recovery,
            correlationId: context.correlationId,
            auditRequired: auditRequired,
            retryable: false
        )
    }

    public static func invalidInput(
        context: ServiceRequestContext,
        message: String,
        recovery: String? = nil
    ) -> ServiceGuardResult {
        ServiceGuardResult(
            stateKind: .disabled,
            reasonCode: .inputInvalid,
            message: message,
            recovery: recovery,
            correlationId: context.correlationId
        )
    }

    public static func decisionRequired(
        context: ServiceRequestContext,
        decisionId: String,
        message: String
    ) -> ServiceGuardResult {
        ServiceGuardResult(
            stateKind: .decisionGated,
            reasonCode: .decisionRequired,
            message: message,
            correlationId: context.correlationId,
            decisionId: decisionId,
            auditRequired: true
        )
    }

    public static func unavailable(
        context: ServiceRequestContext,
        reasonCode: GuardReasonCode,
        message: String,
        recovery: String? = nil
    ) -> ServiceGuardResult {
        ServiceGuardResult(
            stateKind: .unavailable,
            reasonCode: reasonCode,
            message: message,
            recovery: recovery,
            correlationId: context.correlationId
        )
    }

    public static func blocked(
        context: ServiceRequestContext,
        reasonCode: GuardReasonCode,
        message: String,
        auditRequired: Bool = true
    ) -> ServiceGuardResult {
        ServiceGuardResult(
            stateKind: .blockedAction,
            reasonCode: reasonCode,
            message: message,
            correlationId: context.correlationId,
            auditRequired: auditRequired
        )
    }
}
