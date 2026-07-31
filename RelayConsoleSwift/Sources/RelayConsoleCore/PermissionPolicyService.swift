import Foundation

public struct PermissionPolicyRequest: Codable, Equatable, Sendable {
    public var name: String
    public var effect: PermissionPolicyEffect
    public var status: PermissionPolicyStatus
    public var roleTargets: [String]
    public var resourceType: String
    public var resourceId: RelayId?
    public var action: String
    public var priority: Int
    public var reasonCode: GuardReasonCode
    public var message: String
    public var metadata: JSONRecord

    public init(
        name: String,
        effect: PermissionPolicyEffect,
        status: PermissionPolicyStatus = .active,
        roleTargets: [String],
        resourceType: String,
        resourceId: RelayId? = nil,
        action: String,
        priority: Int = 0,
        reasonCode: GuardReasonCode = .policyBlocked,
        message: String,
        metadata: JSONRecord = [:]
    ) {
        self.name = name
        self.effect = effect
        self.status = status
        self.roleTargets = roleTargets
        self.resourceType = resourceType
        self.resourceId = resourceId
        self.action = action
        self.priority = priority
        self.reasonCode = reasonCode
        self.message = message
        self.metadata = metadata
    }
}

public final class PermissionPolicyService {
    private let data: LocalDataService

    public init(data: LocalDataService) {
        self.data = data
    }

    public func ensureDefaultPolicies(workspaceId: RelayId, actorId: RelayId = "system", now: Date = Date()) throws {
        let existing = try Set(data.listPermissionPolicies(workspaceId: workspaceId, includeDisabled: true).map(\.id))
        let timestamp = iso(now)
        let defaults = [
            PermissionPolicyRecord(
                id: defaultPolicyId(workspaceId: workspaceId, suffix: "owner-admin-wildcard"),
                workspaceId: workspaceId,
                name: "Default owner/admin wildcard allow",
                effect: .allow,
                status: .active,
                roleTargets: [ServiceRole.owner.rawValue, ServiceRole.admin.rawValue],
                resourceType: "*",
                resourceId: nil,
                action: "*",
                priority: 0,
                reasonCode: .policyBlocked,
                message: "Owner and admin roles can perform retained local actions unless a narrower deny policy wins.",
                metadata: ["source": .string("permission-policy-default")],
                createdByActorId: actorId,
                updatedByActorId: actorId,
                createdAt: timestamp,
                updatedAt: timestamp,
                redactionStatus: "private-state-excluded"
            ),
            PermissionPolicyRecord(
                id: defaultPolicyId(workspaceId: workspaceId, suffix: "viewer-member-read"),
                workspaceId: workspaceId,
                name: "Default viewer/member read allow",
                effect: .allow,
                status: .active,
                roleTargets: [
                    ServiceRole.viewer.rawValue,
                    ServiceRole.member.rawValue,
                    ServiceRole.approver.rawValue,
                    ServiceRole.operator.rawValue
                ],
                resourceType: "*",
                resourceId: nil,
                action: "read",
                priority: 0,
                reasonCode: .policyBlocked,
                message: "Viewer and member roles can inspect retained local records but cannot mutate them.",
                metadata: ["source": .string("permission-policy-default")],
                createdByActorId: actorId,
                updatedByActorId: actorId,
                createdAt: timestamp,
                updatedAt: timestamp,
                redactionStatus: "private-state-excluded"
            ),
            PermissionPolicyRecord(
                id: defaultPolicyId(workspaceId: workspaceId, suffix: "approver-approval-resolve"),
                workspaceId: workspaceId,
                name: "Default task-scoped approver resolve allow",
                effect: .allow,
                status: .active,
                roleTargets: [ServiceRole.approver.rawValue],
                resourceType: "work_safety_approval",
                resourceId: nil,
                action: "resolve",
                priority: 0,
                reasonCode: .policyBlocked,
                message: "Approver roles can resolve retained task-scoped approvals when explicit approval authority also matches.",
                metadata: ["source": .string("permission-policy-default")],
                createdByActorId: actorId,
                updatedByActorId: actorId,
                createdAt: timestamp,
                updatedAt: timestamp,
                redactionStatus: "private-state-excluded"
            ),
            PermissionPolicyRecord(
                id: defaultPolicyId(workspaceId: workspaceId, suffix: "operator-tool-request-report"),
                workspaceId: workspaceId,
                name: "Default operator tool request report allow",
                effect: .allow,
                status: .active,
                roleTargets: [ServiceRole.operator.rawValue],
                resourceType: "tool_request",
                resourceId: nil,
                action: "report",
                priority: 0,
                reasonCode: .policyBlocked,
                message: "Operator roles can record retained missing-tool requests without installing apps, granting capabilities, or accessing files.",
                metadata: ["source": .string("permission-policy-default")],
                createdByActorId: actorId,
                updatedByActorId: actorId,
                createdAt: timestamp,
                updatedAt: timestamp,
                redactionStatus: "private-state-excluded"
            )
        ]
        for policy in defaults where !existing.contains(policy.id) {
            _ = try data.savePermissionPolicy(policy)
        }
    }

    @discardableResult
    public func createPolicy(
        context: ServiceRequestContext,
        request: PermissionPolicyRequest,
        now: Date = Date()
    ) throws -> PermissionPolicyRecord {
        try requirePolicyMutationAccess(context: context)
        let timestamp = iso(now)
        let policy = try buildPolicy(
            id: createRelayId("ppol"),
            context: context,
            request: request,
            createdAt: timestamp,
            createdByActorId: context.actorId,
            updatedAt: timestamp
        )
        let saved = try data.savePermissionPolicy(policy)
        try recordPolicyEvent(context: context, action: "permission_policy.created", policy: saved)
        return saved
    }

    @discardableResult
    public func updatePolicy(
        context: ServiceRequestContext,
        policyId: RelayId,
        request: PermissionPolicyRequest,
        now: Date = Date()
    ) throws -> PermissionPolicyRecord {
        try requirePolicyMutationAccess(context: context)
        let current = try requirePolicy(policyId, context: context)
        let saved = try data.savePermissionPolicy(
            try buildPolicy(
                id: current.id,
                context: context,
                request: request,
                createdAt: current.createdAt,
                createdByActorId: current.createdByActorId,
                updatedAt: iso(now)
            )
        )
        try recordPolicyEvent(context: context, action: "permission_policy.updated", policy: saved)
        return saved
    }

    @discardableResult
    public func deletePolicy(context: ServiceRequestContext, policyId: RelayId) throws -> PermissionPolicyRecord {
        try requirePolicyMutationAccess(context: context)
        _ = try requirePolicy(policyId, context: context)
        let deleted = try data.deletePermissionPolicy(policyId: policyId, workspaceId: context.workspaceId)
        try recordPolicyEvent(context: context, action: "permission_policy.deleted", policy: deleted)
        return deleted
    }

    public func listPolicies(
        context: ServiceRequestContext,
        includeDisabled: Bool = false,
        limit: Int = 500
    ) throws -> [PermissionPolicyRecord] {
        try requirePolicyReadAccess(context: context)
        return try data.listPermissionPolicies(workspaceId: context.workspaceId, includeDisabled: includeDisabled, limit: limit)
    }

    public func evaluate(
        context: ServiceRequestContext,
        resourceType: String,
        resourceId: RelayId? = nil,
        action: String,
        now: Date = Date()
    ) throws -> PermissionPolicyEvaluation {
        let normalizedResource = try normalize(resourceType, field: "Resource type", context: context)
        let normalizedAction = try normalize(action, field: "Permission action", context: context)
        if try data.listPermissionPolicies(workspaceId: context.workspaceId, includeDisabled: true, limit: 1).isEmpty {
            try ensureDefaultPolicies(workspaceId: context.workspaceId, actorId: "system", now: now)
        }
        let policies = try data.listPermissionPolicies(workspaceId: context.workspaceId, includeDisabled: false)
            .filter { policyMatches($0, context: context, resourceType: normalizedResource, resourceId: resourceId, action: normalizedAction) }
            .sorted { lhs, rhs in
                if lhs.priority != rhs.priority { return lhs.priority > rhs.priority }
                if lhs.effect != rhs.effect { return lhs.effect == .deny }
                return specificity(lhs, resourceType: normalizedResource, resourceId: resourceId, action: normalizedAction) >
                    specificity(rhs, resourceType: normalizedResource, resourceId: resourceId, action: normalizedAction)
            }
        guard let matched = policies.first else {
            return PermissionPolicyEvaluation(
                workspaceId: context.workspaceId,
                actorId: context.actorId,
                resourceType: normalizedResource,
                resourceId: resourceId,
                action: normalizedAction,
                decision: .noMatch,
                allowed: false,
                matchedPolicyId: nil,
                reasonCode: .policyBlocked,
                message: "No permission policy allows this retained local action.",
                evaluatedAt: iso(now)
            )
        }
        return PermissionPolicyEvaluation(
            workspaceId: context.workspaceId,
            actorId: context.actorId,
            resourceType: normalizedResource,
            resourceId: resourceId,
            action: normalizedAction,
            decision: matched.effect == .allow ? .allowed : .denied,
            allowed: matched.effect == .allow,
            matchedPolicyId: matched.id,
            reasonCode: matched.effect == .allow ? .policyBlocked : matched.reasonCode,
            message: matched.message,
            evaluatedAt: iso(now)
        )
    }

    @discardableResult
    public func requireAllowed(
        context: ServiceRequestContext,
        resourceType: String,
        resourceId: RelayId? = nil,
        action: String,
        detail: JSONRecord = [:],
        now: Date = Date()
    ) throws -> PermissionPolicyEvaluation {
        let evaluation = try evaluate(
            context: context,
            resourceType: resourceType,
            resourceId: resourceId,
            action: action,
            now: now
        )
        guard evaluation.allowed else {
            _ = try? data.log(
                severity: "warning",
                category: "permission.denied",
                message: "Permission policy denied retained local action.",
                correlationId: context.correlationId,
                detail: detail.merging([
                    "actorId": .string(context.actorId),
                    "workspaceId": .string(context.workspaceId),
                    "resourceType": .string(evaluation.resourceType),
                    "resourceId": evaluation.resourceId.map(JSONValue.string) ?? .null,
                    "action": .string(evaluation.action),
                    "decision": .string(evaluation.decision.rawValue),
                    "reasonCode": .string(evaluation.reasonCode.rawValue),
                    "policyId": evaluation.matchedPolicyId.map(JSONValue.string) ?? .null
                ]) { _, new in new }
            )
            throw ServiceGuardResult(
                stateKind: .blockedAction,
                reasonCode: evaluation.reasonCode,
                message: evaluation.message,
                recovery: "Ask a workspace owner or admin to adjust the permission policy.",
                correlationId: context.correlationId,
                decisionId: evaluation.matchedPolicyId,
                auditRequired: true,
                retryable: false
            )
        }
        return evaluation
    }

    private func buildPolicy(
        id: RelayId,
        context: ServiceRequestContext,
        request: PermissionPolicyRequest,
        createdAt: IsoTimestamp,
        createdByActorId: RelayId,
        updatedAt: IsoTimestamp
    ) throws -> PermissionPolicyRecord {
        let name = try requireText(request.name, field: "Policy name", context: context, maxLength: 160)
        let roles = try normalizeRoleTargets(request.roleTargets, context: context)
        let resourceType = try normalize(request.resourceType, field: "Resource type", context: context)
        let action = try normalize(request.action, field: "Permission action", context: context)
        let message = try requireText(request.message, field: "Policy message", context: context, maxLength: 500)
        return PermissionPolicyRecord(
            id: id,
            workspaceId: context.workspaceId,
            name: name,
            effect: request.effect,
            status: request.status,
            roleTargets: roles,
            resourceType: resourceType,
            resourceId: request.resourceId,
            action: action,
            priority: request.priority,
            reasonCode: request.reasonCode,
            message: message,
            metadata: request.metadata.merging(["source": .string("permission-policy-service")]) { _, new in new },
            createdByActorId: createdByActorId,
            updatedByActorId: context.actorId,
            createdAt: createdAt,
            updatedAt: updatedAt,
            redactionStatus: "private-state-excluded"
        )
    }

    private func requirePolicy(_ policyId: RelayId, context: ServiceRequestContext) throws -> PermissionPolicyRecord {
        let policy = try data.getPermissionPolicy(policyId)
        guard policy.workspaceId == context.workspaceId else {
            throw ServiceGuard.invalidInput(context: context, message: "Permission policy does not belong to this workspace.")
        }
        return policy
    }

    private func requirePolicyMutationAccess(context: ServiceRequestContext) throws {
        if let denied = ServiceGuard.requireAnyRole(
            [.owner, .admin],
            context: context,
            message: "Permission policy changes require owner or admin authority."
        ) {
            throw denied
        }
    }

    private func requirePolicyReadAccess(context: ServiceRequestContext) throws {
        if let denied = ServiceGuard.requireAnyRole(
            [.owner, .admin, .member, .viewer, .approver, .operator],
            context: context,
            message: "Reading permission policies requires workspace access."
        ) {
            throw denied
        }
    }

    private func normalizeRoleTargets(_ values: [String], context: ServiceRequestContext) throws -> [String] {
        let normalized = values
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() }
            .filter { !$0.isEmpty }
        let unique = Array(Set(normalized)).sorted()
        guard !unique.isEmpty else {
            throw ServiceGuard.invalidInput(context: context, message: "Permission policy requires at least one role target.")
        }
        let allowed = Set(ServiceRole.allCases.map(\.rawValue)).union(["*"])
        guard unique.allSatisfy({ allowed.contains($0) }) else {
            throw ServiceGuard.invalidInput(context: context, message: "Permission policy contains an unsupported role target.")
        }
        return unique
    }

    private func normalize(_ value: String, field: String, context: ServiceRequestContext) throws -> String {
        let normalized = value.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !normalized.isEmpty else {
            throw ServiceGuard.invalidInput(context: context, message: "\(field) is required.")
        }
        return normalized
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

    private func policyMatches(
        _ policy: PermissionPolicyRecord,
        context: ServiceRequestContext,
        resourceType: String,
        resourceId: RelayId?,
        action: String
    ) -> Bool {
        guard policy.status == .active else { return false }
        guard policy.workspaceId == context.workspaceId else { return false }
        guard roleMatches(policy.roleTargets, roles: context.roles) else { return false }
        guard patternMatches(policy.resourceType, value: resourceType) else { return false }
        guard patternMatches(policy.action, value: action) else { return false }
        guard let policyResourceId = policy.resourceId else { return true }
        return policyResourceId == "*" || policyResourceId == resourceId
    }

    private func roleMatches(_ targets: [String], roles: Set<ServiceRole>) -> Bool {
        let targetRoles = Set(targets.compactMap { ServiceRole(rawValue: $0) })
        return targets.contains("*") || !targetRoles.isDisjoint(with: roles)
    }

    private func patternMatches(_ pattern: String, value: String) -> Bool {
        if pattern == "*" { return true }
        if !pattern.contains("*") { return pattern == value }
        var remainder = value[...]
        let parts = pattern.split(separator: "*", omittingEmptySubsequences: false).map(String.init)
        if let first = parts.first, !first.isEmpty {
            guard remainder.hasPrefix(first) else { return false }
            remainder = remainder.dropFirst(first.count)
        }
        for part in parts.dropFirst().dropLast() where !part.isEmpty {
            guard let range = remainder.range(of: part) else { return false }
            remainder = remainder[range.upperBound...]
        }
        if let last = parts.last, !last.isEmpty {
            return remainder.hasSuffix(last)
        }
        return true
    }

    private func specificity(
        _ policy: PermissionPolicyRecord,
        resourceType: String,
        resourceId: RelayId?,
        action: String
    ) -> Int {
        var score = 0
        if policy.resourceType == resourceType { score += 4 }
        if policy.action == action { score += 4 }
        if let policyResourceId = policy.resourceId, policyResourceId == resourceId { score += 4 }
        if !policy.roleTargets.contains("*") { score += 1 }
        return score
    }

    private func recordPolicyEvent(
        context: ServiceRequestContext,
        action: String,
        policy: PermissionPolicyRecord
    ) throws {
        try data.log(
            severity: "info",
            category: "permission.policy",
            message: "Permission policy changed.",
            correlationId: context.correlationId,
            detail: [
                "action": .string(action),
                "policyId": .string(policy.id),
                "actorId": .string(context.actorId),
                "workspaceId": .string(context.workspaceId),
                "effect": .string(policy.effect.rawValue),
                "resourceType": .string(policy.resourceType),
                "resourceId": policy.resourceId.map(JSONValue.string) ?? .null,
                "permissionAction": .string(policy.action),
                "redactionStatus": .string(policy.redactionStatus)
            ]
        )
    }

    private func defaultPolicyId(workspaceId: RelayId, suffix: String) -> RelayId {
        "ppol-\(workspaceId)-\(suffix)"
    }

    private func iso(_ date: Date) -> IsoTimestamp {
        ISO8601DateFormatter.relayConsole.string(from: date)
    }
}
