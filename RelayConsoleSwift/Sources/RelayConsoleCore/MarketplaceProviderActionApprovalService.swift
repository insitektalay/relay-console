import CryptoKit
import Foundation

public final class MarketplaceProviderActionApprovalService {
    private let data: LocalDataService

    public init(data: LocalDataService) {
        self.data = data
    }

    @discardableResult
    public func requestApproval(
        context: ServiceRequestContext,
        appIdOrSlug: RelayId,
        actionKey: String,
        proposedPayload: JSONRecord,
        connectionId: RelayId? = nil,
        installId: RelayId? = nil,
        agentId: RelayId? = nil,
        expiresAt: IsoTimestamp? = nil,
        idempotencyKey: String? = nil,
        executionId: RelayId? = nil,
        metadata: JSONRecord = [:],
        now: Date = Date()
    ) throws -> MarketplaceProviderActionApprovalRecord {
        try requireRequestAccess(context: context)
        let app = try requireApp(context: context, appIdOrSlug: appIdOrSlug)
        let definition = try requireActionDefinition(context: context, app: app, actionKey: actionKey)
        try validateConnection(connectionId, app: app, context: context)
        let install = try validateInstall(installId, app: app, context: context)
        let effectiveAgentId = try validateAgent(agentId, install: install, context: context)
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
        let hash = Self.payloadHash(proposedPayload)
        var approvalMetadata = metadata
        approvalMetadata["source"] = .string("provider-action-approval-service")
        approvalMetadata["payloadHash"] = .string(hash)
        approvalMetadata["actionKind"] = .string(definition.kind.rawValue)
        approvalMetadata["riskLevel"] = .string(definition.riskLevel.rawValue)
        approvalMetadata["executionAttempted"] = .bool(false)
        approvalMetadata["rawPayloadPersisted"] = .bool(false)
        let approval = MarketplaceProviderActionApprovalRecord(
            id: createRelayId("mpapr"),
            workspaceId: context.workspaceId,
            appId: app.id,
            appSlug: app.slug,
            connectionId: connectionId,
            installId: install?.id,
            agentId: effectiveAgentId,
            providerActionId: definition.id,
            actionKey: definition.actionKey,
            proposedPayload: proposedPayload,
            proposedPayloadHash: hash,
            status: .pending,
            requestedByActorId: context.actorId,
            requestedByAgentId: effectiveAgentId,
            resolvedByActorId: nil,
            expiresAt: expiresAt,
            resolvedAt: nil,
            idempotencyKey: idempotencyKey ?? "approval-\(definition.id)-\(hash)",
            executionId: executionId,
            metadata: approvalMetadata,
            createdAt: timestamp,
            updatedAt: timestamp,
            redactionStatus: "private-state-excluded"
        )
        return try data.saveMarketplaceProviderActionApproval(approval)
    }

    @discardableResult
    public func approve(
        context: ServiceRequestContext,
        approvalId: RelayId,
        approvedPayload: JSONRecord,
        now: Date = Date()
    ) throws -> MarketplaceProviderActionApprovalRecord {
        try resolve(
            context: context,
            approvalId: approvalId,
            decision: .approved,
            payload: approvedPayload,
            reason: nil,
            now: now
        )
    }

    @discardableResult
    public func reject(
        context: ServiceRequestContext,
        approvalId: RelayId,
        reason: String? = nil,
        now: Date = Date()
    ) throws -> MarketplaceProviderActionApprovalRecord {
        try resolve(
            context: context,
            approvalId: approvalId,
            decision: .rejected,
            payload: nil,
            reason: reason,
            now: now
        )
    }

    @discardableResult
    public func cancel(
        context: ServiceRequestContext,
        approvalId: RelayId,
        reason: String? = nil,
        now: Date = Date()
    ) throws -> MarketplaceProviderActionApprovalRecord {
        try resolve(
            context: context,
            approvalId: approvalId,
            decision: .cancelled,
            payload: nil,
            reason: reason,
            now: now
        )
    }

    @discardableResult
    public func expire(
        context: ServiceRequestContext,
        approvalId: RelayId,
        now: Date = Date()
    ) throws -> MarketplaceProviderActionApprovalRecord {
        try requireMutationAccess(context: context, resourceId: approvalId, action: "expire")
        var approval = try requireApproval(context: context, approvalId: approvalId)
        guard approval.status == .pending else {
            return approval
        }
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
        approval.status = .expired
        approval.resolvedByActorId = context.actorId
        approval.resolvedAt = timestamp
        approval.updatedAt = timestamp
        approval.metadata["decision"] = .string(WorkSafetyApprovalStatus.expired.rawValue)
        approval.metadata["expiredByActorId"] = .string(context.actorId)
        approval.metadata["executionAttempted"] = .bool(false)
        return try data.saveMarketplaceProviderActionApproval(approval)
    }

    public func stalePendingApprovals(
        context: ServiceRequestContext,
        now: Date = Date(),
        limit: Int = 100
    ) throws -> [MarketplaceProviderActionApprovalRecord] {
        try requireReadAccess(context: context)
        return try data.listMarketplaceProviderActionApprovals(
            workspaceId: context.workspaceId,
            status: .pending,
            limit: limit
        ).filter { isExpired($0, now: now) }
    }

    @discardableResult
    public func expireStaleApprovals(
        context: ServiceRequestContext,
        now: Date = Date(),
        limit: Int = 100
    ) throws -> [MarketplaceProviderActionApprovalRecord] {
        try requireMutationAccess(context: context, resourceId: nil, action: "expire_stale")
        let stale = try stalePendingApprovals(context: context, now: now, limit: limit)
        return try stale.map { try expire(context: context, approvalId: $0.id, now: now) }
    }

    public func listApprovals(
        context: ServiceRequestContext,
        status: WorkSafetyApprovalStatus? = nil,
        limit: Int = 100
    ) throws -> [MarketplaceProviderActionApprovalRecord] {
        try requireReadAccess(context: context)
        return try data.listMarketplaceProviderActionApprovals(
            workspaceId: context.workspaceId,
            status: status,
            limit: limit
        )
    }

    public func getApproval(
        context: ServiceRequestContext,
        approvalId: RelayId
    ) throws -> MarketplaceProviderActionApprovalRecord {
        try requireReadAccess(context: context)
        return try requireApproval(context: context, approvalId: approvalId)
    }

    public static func payloadHash(_ payload: JSONRecord) -> String {
        let canonical = canonicalJSON(.object(payload))
        let digest = SHA256.hash(data: Data(canonical.utf8))
        return "sha256:" + digest.map { String(format: "%02x", $0) }.joined()
    }

    private func resolve(
        context: ServiceRequestContext,
        approvalId: RelayId,
        decision: WorkSafetyApprovalStatus,
        payload: JSONRecord?,
        reason: String?,
        now: Date
    ) throws -> MarketplaceProviderActionApprovalRecord {
        try requireMutationAccess(context: context, resourceId: approvalId, action: decision.rawValue)
        var approval = try requireApproval(context: context, approvalId: approvalId)
        guard approval.status == .pending else {
            throw ServiceGuard.invalidInput(context: context, message: "Only pending provider-action approvals can be resolved.")
        }
        if isExpired(approval, now: now) {
            _ = try expire(context: context, approvalId: approval.id, now: now)
            throw ServiceGuard.invalidInput(context: context, message: "Provider-action approval has expired.")
        }
        if decision == .approved {
            guard let payload else {
                throw ServiceGuard.invalidInput(context: context, message: "Approving a provider action requires the exact payload.")
            }
            let approvedHash = Self.payloadHash(payload)
            guard approvedHash == approval.proposedPayloadHash else {
                throw ServiceGuard.invalidInput(context: context, message: "Approved provider-action payload does not match the proposed payload hash.")
            }
            approval.metadata["approvedPayloadHash"] = .string(approvedHash)
        }
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
        approval.status = decision
        approval.resolvedByActorId = context.actorId
        approval.resolvedAt = timestamp
        approval.updatedAt = timestamp
        approval.metadata["decision"] = .string(decision.rawValue)
        approval.metadata["resolvedByActorId"] = .string(context.actorId)
        approval.metadata["executionAttempted"] = .bool(false)
        let trimmedReason = reason?.trimmingCharacters(in: .whitespacesAndNewlines)
        if let trimmedReason, !trimmedReason.isEmpty {
            approval.metadata["reason"] = .string(trimmedReason)
        }
        return try data.saveMarketplaceProviderActionApproval(approval)
    }

    private func requireApp(
        context: ServiceRequestContext,
        appIdOrSlug: RelayId
    ) throws -> MarketplaceCatalogApp {
        guard let app = try data.getMarketplaceCatalogApp(workspaceId: context.workspaceId, appIdOrSlug: appIdOrSlug) else {
            throw ServiceGuard.invalidInput(context: context, message: "Marketplace app was not found for provider-action approval.")
        }
        return app
    }

    private func requireActionDefinition(
        context: ServiceRequestContext,
        app: MarketplaceCatalogApp,
        actionKey: String
    ) throws -> MarketplaceProviderActionDefinition {
        guard let definition = try data.listMarketplaceProviderActionDefinitions(
            workspaceId: context.workspaceId,
            appId: app.id,
            limit: 500
        ).first(where: { $0.actionKey == actionKey }) else {
            throw ServiceGuard.invalidInput(context: context, message: "Provider action definition was not found for approval.")
        }
        guard definition.enabled, definition.defaultPermission != .blocked else {
            throw ServiceGuard.invalidInput(context: context, message: "Blocked provider actions cannot request approvals.")
        }
        return definition
    }

    private func validateConnection(
        _ connectionId: RelayId?,
        app: MarketplaceCatalogApp,
        context: ServiceRequestContext
    ) throws {
        guard let connectionId else { return }
        guard let connection = try data.getProviderConnection(workspaceId: context.workspaceId, connectionId: connectionId),
              connection.appId == app.id,
              connection.appSlug == app.slug else {
            throw ServiceGuard.invalidInput(context: context, message: "Provider-action approval connection does not match the Marketplace app.")
        }
    }

    private func validateInstall(
        _ installId: RelayId?,
        app: MarketplaceCatalogApp,
        context: ServiceRequestContext
    ) throws -> MarketplaceInstallRecord? {
        guard let installId else { return nil }
        guard let install = try data.getMarketplaceInstall(workspaceId: context.workspaceId, installId: installId),
              install.appId == app.id,
              install.appSlug == app.slug else {
            throw ServiceGuard.invalidInput(context: context, message: "Provider-action approval install does not match the Marketplace app.")
        }
        return install
    }

    private func validateAgent(
        _ agentId: RelayId?,
        install: MarketplaceInstallRecord?,
        context: ServiceRequestContext
    ) throws -> RelayId? {
        if let install, let agentId, install.agentId != agentId {
            throw ServiceGuard.invalidInput(context: context, message: "Provider-action approval agent does not match the Marketplace install.")
        }
        return agentId ?? install?.agentId
    }

    private func requireApproval(
        context: ServiceRequestContext,
        approvalId: RelayId
    ) throws -> MarketplaceProviderActionApprovalRecord {
        guard let approval = try data.getMarketplaceProviderActionApproval(workspaceId: context.workspaceId, approvalId: approvalId) else {
            throw ServiceGuard.invalidInput(context: context, message: "Provider-action approval was not found.")
        }
        return approval
    }

    private func requireReadAccess(context: ServiceRequestContext) throws {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin, .member, .approver], context: context) {
            throw denied
        }
    }

    private func requireMutationAccess(
        context: ServiceRequestContext,
        resourceId: RelayId?,
        action: String
    ) throws {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin, .approver], context: context) {
            throw denied
        }
    }

    private func requireRequestAccess(context: ServiceRequestContext) throws {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin, .member, .operator, .approver], context: context) {
            throw denied
        }
    }

    private func isExpired(_ approval: MarketplaceProviderActionApprovalRecord, now: Date) -> Bool {
        guard approval.status == .pending,
              let expiresAt = approval.expiresAt
        else {
            return false
        }
        let expiry = ISO8601DateFormatter.relayConsole.date(from: expiresAt) ?? ISO8601DateFormatter().date(from: expiresAt)
        guard let expiry else { return false }
        return expiry <= now
    }

    private static func canonicalJSON(_ value: JSONValue) -> String {
        switch value {
        case .string(let string):
            return quoted(string)
        case .number(let number):
            return String(number)
        case .bool(let bool):
            return bool ? "true" : "false"
        case .null:
            return "null"
        case .array(let array):
            return "[" + array.map(canonicalJSON).joined(separator: ",") + "]"
        case .object(let object):
            return "{" + object.keys.sorted().map { key in
                "\(quoted(key)):\(canonicalJSON(object[key] ?? .null))"
            }.joined(separator: ",") + "}"
        }
    }

    private static func quoted(_ string: String) -> String {
        guard let data = try? JSONEncoder().encode(string),
              let encoded = String(data: data, encoding: .utf8)
        else {
            return "\"\""
        }
        return encoded
    }
}
