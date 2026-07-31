import Foundation

public enum ProviderActionApprovalCardStatus: String, Codable, CaseIterable, Sendable {
    case pending
    case approved
    case rejected
    case executed
    case failed
    case expired
    case cancelled
}

public struct ProviderActionApprovalCardState: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var approvalId: RelayId
    public var workspaceId: RelayId
    public var appId: RelayId
    public var appSlug: String
    public var appName: String
    public var providerActionId: RelayId
    public var title: String
    public var subtitle: String
    public var actionLabel: String
    public var status: ProviderActionApprovalCardStatus
    public var statusLabel: String
    public var requestedByActorId: RelayId
    public var requestedByAgentId: RelayId?
    public var resolvedByActorId: RelayId?
    public var requestedAt: IsoTimestamp
    public var updatedAt: IsoTimestamp
    public var resolvedAt: IsoTimestamp?
    public var expiresAt: IsoTimestamp?
    public var payloadHash: String
    public var payloadSummary: String
    public var executionId: RelayId?
    public var executionStatus: ProviderActionExecutionStatus?
    public var decisionAvailableInTopLevelUI: Bool
    public var decisionUnavailableReason: String?
    public var redactionStatus: String

    public init(
        id: RelayId,
        approvalId: RelayId,
        workspaceId: RelayId,
        appId: RelayId,
        appSlug: String,
        appName: String,
        providerActionId: RelayId,
        title: String,
        subtitle: String,
        actionLabel: String,
        status: ProviderActionApprovalCardStatus,
        statusLabel: String,
        requestedByActorId: RelayId,
        requestedByAgentId: RelayId?,
        resolvedByActorId: RelayId?,
        requestedAt: IsoTimestamp,
        updatedAt: IsoTimestamp,
        resolvedAt: IsoTimestamp?,
        expiresAt: IsoTimestamp?,
        payloadHash: String,
        payloadSummary: String,
        executionId: RelayId?,
        executionStatus: ProviderActionExecutionStatus?,
        decisionAvailableInTopLevelUI: Bool,
        decisionUnavailableReason: String?,
        redactionStatus: String
    ) {
        self.id = id
        self.approvalId = approvalId
        self.workspaceId = workspaceId
        self.appId = appId
        self.appSlug = appSlug
        self.appName = appName
        self.providerActionId = providerActionId
        self.title = title
        self.subtitle = subtitle
        self.actionLabel = actionLabel
        self.status = status
        self.statusLabel = statusLabel
        self.requestedByActorId = requestedByActorId
        self.requestedByAgentId = requestedByAgentId
        self.resolvedByActorId = resolvedByActorId
        self.requestedAt = requestedAt
        self.updatedAt = updatedAt
        self.resolvedAt = resolvedAt
        self.expiresAt = expiresAt
        self.payloadHash = payloadHash
        self.payloadSummary = payloadSummary
        self.executionId = executionId
        self.executionStatus = executionStatus
        self.decisionAvailableInTopLevelUI = decisionAvailableInTopLevelUI
        self.decisionUnavailableReason = decisionUnavailableReason
        self.redactionStatus = redactionStatus
    }
}

public struct ProviderActionApprovalInboxSummary: Codable, Equatable, Sendable {
    public var totalCount: Int
    public var pendingCount: Int
    public var approvedCount: Int
    public var rejectedCount: Int
    public var executedCount: Int
    public var failedCount: Int
    public var expiredCount: Int
    public var cancelledCount: Int
    public var generatedAt: IsoTimestamp
    public var redactionStatus: String

    public init(
        totalCount: Int,
        pendingCount: Int,
        approvedCount: Int,
        rejectedCount: Int,
        executedCount: Int,
        failedCount: Int,
        expiredCount: Int,
        cancelledCount: Int,
        generatedAt: IsoTimestamp,
        redactionStatus: String
    ) {
        self.totalCount = totalCount
        self.pendingCount = pendingCount
        self.approvedCount = approvedCount
        self.rejectedCount = rejectedCount
        self.executedCount = executedCount
        self.failedCount = failedCount
        self.expiredCount = expiredCount
        self.cancelledCount = cancelledCount
        self.generatedAt = generatedAt
        self.redactionStatus = redactionStatus
    }
}

public struct ProviderActionApprovalInboxSnapshot: Codable, Equatable, Sendable {
    public var workspaceId: RelayId
    public var generatedAt: IsoTimestamp
    public var cards: [ProviderActionApprovalCardState]
    public var selectedApprovalId: RelayId?
    public var selectedCard: ProviderActionApprovalCardState?
    public var summary: ProviderActionApprovalInboxSummary
    public var readOnly: Bool
    public var redactionStatus: String

    public init(
        workspaceId: RelayId,
        generatedAt: IsoTimestamp,
        cards: [ProviderActionApprovalCardState],
        selectedApprovalId: RelayId?,
        selectedCard: ProviderActionApprovalCardState?,
        summary: ProviderActionApprovalInboxSummary,
        readOnly: Bool,
        redactionStatus: String
    ) {
        self.workspaceId = workspaceId
        self.generatedAt = generatedAt
        self.cards = cards
        self.selectedApprovalId = selectedApprovalId
        self.selectedCard = selectedCard
        self.summary = summary
        self.readOnly = readOnly
        self.redactionStatus = redactionStatus
    }
}

public final class MarketplaceProviderActionApprovalInboxService {
    private let data: LocalDataService

    public init(data: LocalDataService) {
        self.data = data
    }

    public func snapshot(
        context: ServiceRequestContext,
        selectedApprovalId: RelayId? = nil,
        now: Date = Date()
    ) throws -> ProviderActionApprovalInboxSnapshot {
        try requireReadAccess(context: context)
        let generatedAt = ISO8601DateFormatter.relayConsole.string(from: now)
        let approvals = try data.listMarketplaceProviderActionApprovals(
            workspaceId: context.workspaceId,
            limit: 500
        )
        let definitions = try data.listMarketplaceProviderActionDefinitions(
            workspaceId: context.workspaceId,
            limit: 500
        )
        let definitionById = Dictionary(uniqueKeysWithValues: definitions.map { ($0.id, $0) })
        let executions = try data.listMarketplaceProviderActionExecutions(
            workspaceId: context.workspaceId,
            limit: 500
        )
        let executionsByApproval = Dictionary(grouping: executions) { execution in
            execution.approvalReference?.approvalId ?? ""
        }
        let cards = try approvals.map { approval in
            let latestExecution = executionsByApproval[approval.id]?.sorted { $0.updatedAt > $1.updatedAt }.first
            return try cardState(
                context: context,
                approval: approval,
                definition: definitionById[approval.providerActionId],
                execution: latestExecution,
                now: now
            )
        }.sorted { lhs, rhs in
            if lhs.status == rhs.status {
                return lhs.updatedAt > rhs.updatedAt
            }
            return Self.statusSortIndex(lhs.status) < Self.statusSortIndex(rhs.status)
        }
        let selected = selectedApprovalId.flatMap { id in cards.first { $0.approvalId == id } } ?? cards.first
        let summary = summary(cards: cards, generatedAt: generatedAt)
        return ProviderActionApprovalInboxSnapshot(
            workspaceId: context.workspaceId,
            generatedAt: generatedAt,
            cards: cards,
            selectedApprovalId: selected?.approvalId,
            selectedCard: selected,
            summary: summary,
            readOnly: !context.hasAnyRole([.owner, .admin, .approver]),
            redactionStatus: "private-state-excluded"
        )
    }

    private func cardState(
        context: ServiceRequestContext,
        approval: MarketplaceProviderActionApprovalRecord,
        definition: MarketplaceProviderActionDefinition?,
        execution: MarketplaceProviderActionExecutionRecord?,
        now: Date
    ) throws -> ProviderActionApprovalCardState {
        let app = try data.getMarketplaceCatalogApp(workspaceId: context.workspaceId, appIdOrSlug: approval.appId)
        let status = cardStatus(approval: approval, execution: execution, now: now)
        let actionLabel = definition?.displayName ?? approval.actionKey
        let appName = app?.name ?? approval.appSlug
        let title = "\(appName) - \(actionLabel)"
        let label = statusLabel(status, approval: approval, definition: definition, execution: execution)
        let subtitle = "\(label) provider action approval"
        let canResolve = context.hasAnyRole([.owner, .admin, .approver])
        let retainedPayloadHash = MarketplaceProviderActionApprovalService.payloadHash(approval.proposedPayload)
        let exactPayloadRetained = retainedPayloadHash == approval.proposedPayloadHash
        let decisionAvailable = status == .pending && canResolve && exactPayloadRetained
        let decisionUnavailableReason: String?
        if status == .pending && !canResolve {
            decisionUnavailableReason = "Owner, admin, or approver authority is required to resolve this provider-action approval."
        } else if status == .pending && !exactPayloadRetained {
            decisionUnavailableReason = "Top-level approval review has redacted or missing payload fields, so this action cannot be approved without the exact broker payload."
        } else {
            decisionUnavailableReason = nil
        }
        return ProviderActionApprovalCardState(
            id: approval.id,
            approvalId: approval.id,
            workspaceId: approval.workspaceId,
            appId: approval.appId,
            appSlug: approval.appSlug,
            appName: appName,
            providerActionId: approval.providerActionId,
            title: title,
            subtitle: subtitle,
            actionLabel: actionLabel,
            status: status,
            statusLabel: label,
            requestedByActorId: approval.requestedByActorId,
            requestedByAgentId: approval.requestedByAgentId,
            resolvedByActorId: approval.resolvedByActorId,
            requestedAt: approval.createdAt,
            updatedAt: max(approval.updatedAt, execution?.updatedAt ?? approval.updatedAt),
            resolvedAt: approval.resolvedAt,
            expiresAt: approval.expiresAt,
            payloadHash: approval.proposedPayloadHash,
            payloadSummary: payloadSummary(approval.proposedPayload),
            executionId: execution?.id ?? approval.executionId,
            executionStatus: execution?.status,
            decisionAvailableInTopLevelUI: decisionAvailable,
            decisionUnavailableReason: decisionUnavailableReason,
            redactionStatus: "private-state-excluded"
        )
    }

    private func cardStatus(
        approval: MarketplaceProviderActionApprovalRecord,
        execution: MarketplaceProviderActionExecutionRecord?,
        now: Date
    ) -> ProviderActionApprovalCardStatus {
        if let execution {
            if isFakeLinkedInPublishSuccess(approval: approval, execution: execution) {
                return .failed
            }
            switch execution.status {
            case .succeeded:
                return .executed
            case .failed:
                return .failed
            case .queued, .pendingApproval, .approved, .autoExecuted, .blocked, .running, .cancelled, .expired:
                break
            }
        }
        if approval.status == .pending, isExpired(approval, now: now) {
            return .expired
        }
        switch approval.status {
        case .pending:
            return .pending
        case .approved:
            return .approved
        case .rejected:
            return .rejected
        case .expired:
            return .expired
        case .cancelled:
            return .cancelled
        }
    }

    private func isFakeLinkedInPublishSuccess(
        approval: MarketplaceProviderActionApprovalRecord,
        execution: MarketplaceProviderActionExecutionRecord
    ) -> Bool {
        guard approval.appSlug == "linkedin",
              isLinkedInPublishingAction(approval.actionKey),
              execution.status == .succeeded else {
            return false
        }
        let result = execution.providerResult ?? [:]
        return result["fakeAdapter"]?.bool == true || result["simulated"]?.bool == true
    }

    private func isLinkedInPublishingAction(_ actionKey: String) -> Bool {
        actionKey == "linkedin_text_post_create"
    }

    private func payloadSummary(_ payload: JSONRecord) -> String {
        let keys = payload.keys.sorted()
        if keys.isEmpty {
            return "No payload fields retained."
        }
        let fields = keys.prefix(4).map { key in
            "\(key): \(payloadValueSummary(payload[key] ?? .null))"
        }
        let suffix = keys.count > 4 ? " +\(keys.count - 4) more" : ""
        return "Payload: \(fields.joined(separator: "; "))\(suffix)"
    }

    private func payloadValueSummary(_ value: JSONValue) -> String {
        let summary: String
        switch value {
        case .string(let string):
            summary = string
        case .number(let number):
            summary = String(number)
        case .bool(let bool):
            summary = bool ? "true" : "false"
        case .null:
            summary = "null"
        case .array(let array):
            summary = "\(array.count) item\(array.count == 1 ? "" : "s")"
        case .object(let object):
            summary = "\(object.count) field\(object.count == 1 ? "" : "s")"
        }
        let collapsed = summary
            .replacingOccurrences(of: "\n", with: " ")
            .replacingOccurrences(of: "\r", with: " ")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard collapsed.count > 96 else {
            return collapsed.isEmpty ? "\"\"" : collapsed
        }
        return "\(collapsed.prefix(93))..."
    }

    private func summary(
        cards: [ProviderActionApprovalCardState],
        generatedAt: IsoTimestamp
    ) -> ProviderActionApprovalInboxSummary {
        ProviderActionApprovalInboxSummary(
            totalCount: cards.count,
            pendingCount: cards.filter { $0.status == .pending }.count,
            approvedCount: cards.filter { $0.status == .approved }.count,
            rejectedCount: cards.filter { $0.status == .rejected }.count,
            executedCount: cards.filter { $0.status == .executed }.count,
            failedCount: cards.filter { $0.status == .failed }.count,
            expiredCount: cards.filter { $0.status == .expired }.count,
            cancelledCount: cards.filter { $0.status == .cancelled }.count,
            generatedAt: generatedAt,
            redactionStatus: "private-state-excluded"
        )
    }

    private func isExpired(_ approval: MarketplaceProviderActionApprovalRecord, now: Date) -> Bool {
        guard let expiresAt = approval.expiresAt else {
            return false
        }
        let expiry = ISO8601DateFormatter.relayConsole.date(from: expiresAt) ?? ISO8601DateFormatter().date(from: expiresAt)
        guard let expiry else {
            return false
        }
        return expiry <= now
    }

    private static func statusSortIndex(_ status: ProviderActionApprovalCardStatus) -> Int {
        switch status {
        case .pending:
            return 0
        case .approved:
            return 1
        case .failed:
            return 2
        case .executed:
            return 3
        case .rejected:
            return 4
        case .expired:
            return 5
        case .cancelled:
            return 6
        }
    }

    private func statusLabel(_ status: ProviderActionApprovalCardStatus) -> String {
        switch status {
        case .pending:
            return "Pending"
        case .approved:
            return "Approved"
        case .rejected:
            return "Rejected"
        case .executed:
            return "Executed"
        case .failed:
            return "Failed"
        case .expired:
            return "Expired"
        case .cancelled:
            return "Cancelled"
        }
    }

    private func statusLabel(
        _ status: ProviderActionApprovalCardStatus,
        approval: MarketplaceProviderActionApprovalRecord,
        definition: MarketplaceProviderActionDefinition?,
        execution: MarketplaceProviderActionExecutionRecord?
    ) -> String {
        if status == .failed,
           approval.appSlug == "linkedin",
           isLinkedInPublishingAction(definition?.actionKey ?? approval.actionKey) {
            if execution?.providerError?["providerErrorCode"]?.string == "linkedin_live_adapter_missing"
                || execution.map({ isFakeLinkedInPublishSuccess(approval: approval, execution: $0) }) == true {
                return "Not posted to LinkedIn"
            }
        }
        return statusLabel(status)
    }

    private func requireReadAccess(context: ServiceRequestContext) throws {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin, .member, .operator, .approver], context: context) {
            throw denied
        }
    }
}
