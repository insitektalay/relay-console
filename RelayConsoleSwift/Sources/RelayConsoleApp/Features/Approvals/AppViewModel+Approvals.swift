import AppKit
import CryptoKit
import Foundation
import RelayConsoleCore
import SwiftUI
import UniformTypeIdentifiers

extension AppViewModel {
  func selectProviderApproval(_ card: ProviderActionApprovalCardState) {
    selectedProviderApprovalId = card.approvalId
    Task { await refreshApprovalsState() }
  }

  func setApprovalSearch(_ query: String) {
    approvalSearch = query
  }

  func setApprovalStatusFilter(_ filter: ProviderApprovalFilter) {
    approvalStatusFilter = filter
    if let first = filteredProviderApprovalCards.first {
      selectedProviderApprovalId = first.approvalId
    }
  }

  func approveAndExecuteProviderApproval(_ card: ProviderActionApprovalCardState) {
    let approvalId = card.approvalId
    runAction("approve-provider-action-\(approvalId)", refresh: .approvals) {
      guard let services = self.services, let workspace = self.workspace else {
        throw RelayError(.workspaceMissing, "Workspace unavailable.")
      }
      if self.isRailwayProviderApproval(card) {
        _ = try await services.cloudSync.resolveRailwayApproval(
          localWorkspaceId: workspace.id,
          approvalId: approvalId,
          decision: "approve"
        )
        return nil
      }
      let context = self.chatContext(
        workspaceId: workspace.id, profileId: self.appState?.activeProfile?.id)
      let approval = try services.providerActionApprovals.getApproval(
        context: context,
        approvalId: approvalId
      )
      guard approval.status == .pending else {
        throw RelayError(.invalidInput, "Only pending provider-action approvals can be approved.")
      }
      let retainedPayloadHash = MarketplaceProviderActionApprovalService.payloadHash(
        approval.proposedPayload)
      guard retainedPayloadHash == approval.proposedPayloadHash else {
        throw RelayError(
          .invalidInput,
          "This approval cannot be completed from the Approvals page because the exact provider payload is no longer retained."
        )
      }
      let approved = try services.providerActionApprovals.approve(
        context: context,
        approvalId: approval.id,
        approvedPayload: approval.proposedPayload
      )
      let result = try services.providerActionBroker.execute(
        context: context,
        request: MarketplaceProviderActionBrokerRequest(
          appIdOrSlug: approved.appId,
          actionKey: approved.actionKey,
          payload: approved.proposedPayload,
          connectionId: approved.connectionId,
          installId: approved.installId,
          agentId: approved.agentId,
          approvalId: approved.id,
          source: "approvals-page"
        )
      )
      try self.requireProviderActionExecutionSucceeded(result.execution)
      return nil
    }
  }

  func executeApprovedProviderApproval(_ card: ProviderActionApprovalCardState) {
    let approvalId = card.approvalId
    runAction("execute-provider-action-\(approvalId)", refresh: .approvals) {
      guard let services = self.services, let workspace = self.workspace else {
        throw RelayError(.workspaceMissing, "Workspace unavailable.")
      }
      guard !self.isRailwayProviderApproval(card) else {
        throw RelayError(
          .invalidInput,
          "Railway approvals are consumed by the requesting agent. Return to the conversation and ask the agent to continue."
        )
      }
      let context = self.chatContext(
        workspaceId: workspace.id, profileId: self.appState?.activeProfile?.id)
      let approval = try services.providerActionApprovals.getApproval(
        context: context,
        approvalId: approvalId
      )
      guard approval.status == .approved else {
        throw RelayError(.invalidInput, "Only approved provider-action approvals can be executed.")
      }
      let retainedPayloadHash = MarketplaceProviderActionApprovalService.payloadHash(
        approval.proposedPayload)
      guard retainedPayloadHash == approval.proposedPayloadHash else {
        throw RelayError(
          .invalidInput,
          "This approval cannot be executed because the exact provider payload is no longer retained."
        )
      }
      let result = try services.providerActionBroker.execute(
        context: context,
        request: MarketplaceProviderActionBrokerRequest(
          appIdOrSlug: approval.appId,
          actionKey: approval.actionKey,
          payload: approval.proposedPayload,
          connectionId: approval.connectionId,
          installId: approval.installId,
          agentId: approval.agentId,
          approvalId: approval.id,
          source: "approvals-page-approved-execute"
        )
      )
      try self.requireProviderActionExecutionSucceeded(result.execution)
      return nil
    }
  }

  func rejectProviderApproval(_ card: ProviderActionApprovalCardState) {
    let approvalId = card.approvalId
    runAction("reject-provider-action-\(approvalId)", refresh: .approvals) {
      guard let services = self.services, let workspace = self.workspace else {
        throw RelayError(.workspaceMissing, "Workspace unavailable.")
      }
      if self.isRailwayProviderApproval(card) {
        _ = try await services.cloudSync.resolveRailwayApproval(
          localWorkspaceId: workspace.id,
          approvalId: approvalId,
          decision: "reject",
          notes: "Rejected from Relay Console for macOS."
        )
        return nil
      }
      let context = self.chatContext(
        workspaceId: workspace.id, profileId: self.appState?.activeProfile?.id)
      _ = try services.providerActionApprovals.reject(
        context: context,
        approvalId: approvalId,
        reason: "Rejected from Approvals."
      )
      return nil
    }
  }

  func requireProviderActionExecutionSucceeded(
    _ execution: MarketplaceProviderActionExecutionRecord
  ) throws {
    guard execution.status == .succeeded else {
      throw RelayError(.dispatchFailed, providerActionExecutionFailureMessage(execution))
    }
  }

  func providerActionExecutionFailureMessage(
    _ execution: MarketplaceProviderActionExecutionRecord
  ) -> String {
    guard let error = execution.providerError else {
      return
        "Provider action did not execute. Relay returned execution status \(execution.status.rawValue)."
    }
    for key in ["message", "error", "reason", "errorDescription"] {
      if let value = error[key]?.string?.trimmingCharacters(in: .whitespacesAndNewlines),
        !value.isEmpty
      {
        return value
      }
    }
    return
      "Provider action did not execute. Relay returned execution status \(execution.status.rawValue)."
  }

  func isRailwayProviderApproval(_ card: ProviderActionApprovalCardState) -> Bool {
    card.appId.hasPrefix("railway:")
  }

  func mergeProviderApprovalInbox(
    local: ProviderActionApprovalInboxSnapshot?,
    railwayRecords: [RailwayApprovalRecord],
    context: ServiceRequestContext,
    selectedApprovalId: RelayId?
  ) -> ProviderActionApprovalInboxSnapshot {
    let generatedAt = ISO8601DateFormatter().string(from: Date())
    let railwayCards = railwayRecords.compactMap {
      railwayProviderApprovalCard(
        $0,
        localWorkspaceId: context.workspaceId,
        canResolve: context.hasAnyRole([.owner, .admin, .approver])
      )
    }
    let railwayIds = Set(railwayCards.map(\.approvalId))
    let localCards = (local?.cards ?? []).filter { !railwayIds.contains($0.approvalId) }
    let cards = (railwayCards + localCards).sorted { lhs, rhs in
      let lhsIndex = providerApprovalStatusSortIndex(lhs.status)
      let rhsIndex = providerApprovalStatusSortIndex(rhs.status)
      return lhsIndex == rhsIndex ? lhs.updatedAt > rhs.updatedAt : lhsIndex < rhsIndex
    }
    let selected =
      selectedApprovalId.flatMap { id in cards.first { $0.approvalId == id } }
      ?? cards.first
    return ProviderActionApprovalInboxSnapshot(
      workspaceId: context.workspaceId,
      generatedAt: generatedAt,
      cards: cards,
      selectedApprovalId: selected?.approvalId,
      selectedCard: selected,
      summary: ProviderActionApprovalInboxSummary(
        totalCount: cards.count,
        pendingCount: cards.filter { $0.status == .pending }.count,
        approvedCount: cards.filter { $0.status == .approved }.count,
        rejectedCount: cards.filter { $0.status == .rejected }.count,
        executedCount: cards.filter { $0.status == .executed }.count,
        failedCount: cards.filter { $0.status == .failed }.count,
        expiredCount: cards.filter { $0.status == .expired }.count,
        cancelledCount: cards.filter { $0.status == .cancelled }.count,
        generatedAt: generatedAt,
        redactionStatus: "sensitive-fields-redacted"
      ),
      readOnly: !context.hasAnyRole([.owner, .admin, .approver]),
      redactionStatus: "sensitive-fields-redacted"
    )
  }

  private func railwayProviderApprovalCard(
    _ record: RailwayApprovalRecord,
    localWorkspaceId: RelayId,
    canResolve: Bool
  ) -> ProviderActionApprovalCardState? {
    guard case .object(let connectorContext) = record.metadata["connectorExecution"],
      connectorContext["purpose"]?.string == "marketplace_connector_execution"
    else {
      return nil
    }
    let provider = connectorContext["provider"]?.string ?? "Marketplace"
    let action = connectorContext["action"]?.string ?? "provider action"
    let toolName = connectorContext["toolName"]?.string ?? action
    let status = railwayProviderApprovalStatus(record)
    let canDecide = canResolve && status == .pending
    let reason: String?
    if status == .pending && !canResolve {
      reason = "Owner, admin, or approver authority is required to resolve this Railway approval."
    } else if status == .approved {
      reason =
        "Approved on Railway. Return to the conversation and ask the agent to continue the exact action."
    } else {
      reason = nil
    }
    return ProviderActionApprovalCardState(
      id: record.id,
      approvalId: record.id,
      workspaceId: localWorkspaceId,
      appId: "railway:\(provider)",
      appSlug: provider,
      appName: provider.replacingOccurrences(of: "-", with: " ").capitalized,
      providerActionId: "railway:\(toolName)",
      title: record.title,
      subtitle: record.description,
      actionLabel: action,
      status: status,
      statusLabel: railwayProviderApprovalStatusLabel(status),
      requestedByActorId: record.requestedByAgentId,
      requestedByAgentId: record.requestedByAgentId,
      resolvedByActorId: record.resolvedByUserId,
      requestedAt: record.createdAt,
      updatedAt: record.updatedAt,
      resolvedAt: record.resolvedAt,
      expiresAt: record.expiresAt,
      payloadHash: connectorContext["payloadSha256"]?.string ?? "",
      payloadSummary: railwayProviderApprovalPayloadSummary(record),
      executionId: nil,
      executionStatus: nil,
      decisionAvailableInTopLevelUI: canDecide,
      decisionUnavailableReason: reason,
      redactionStatus: "sensitive-fields-redacted"
    )
  }

  private func railwayProviderApprovalStatus(
    _ record: RailwayApprovalRecord
  ) -> ProviderActionApprovalCardStatus {
    if record.status == "pending",
      let expiresAt = record.expiresAt,
      let expiry = ISO8601DateFormatter().date(from: expiresAt),
      expiry <= Date()
    {
      return .expired
    }
    switch record.status {
    case "pending":
      return .pending
    case "approved", "executing":
      return .approved
    case "rejected":
      return .rejected
    case "executed":
      return .executed
    case "execution_uncertain", "failed":
      return .failed
    case "expired":
      return .expired
    case "cancelled":
      return .cancelled
    default:
      return .failed
    }
  }

  private func railwayProviderApprovalPayloadSummary(_ record: RailwayApprovalRecord) -> String {
    guard let payload = record.steps.first?["payload"], case .object(let object) = payload,
      !object.isEmpty
    else {
      return record.description
    }
    let fields = object.keys.sorted().prefix(4).map { key in
      "\(key): \(railwayProviderApprovalValueSummary(object[key] ?? .null))"
    }
    let suffix = object.count > 4 ? " +\(object.count - 4) more" : ""
    return "Payload: \(fields.joined(separator: "; "))\(suffix)"
  }

  private func railwayProviderApprovalValueSummary(_ value: JSONValue) -> String {
    switch value {
    case .string(let string):
      return String(string.replacingOccurrences(of: "\n", with: " ").prefix(96))
    case .number(let number):
      return String(number)
    case .bool(let bool):
      return bool ? "true" : "false"
    case .object(let object):
      return "\(object.count) field\(object.count == 1 ? "" : "s")"
    case .array(let array):
      return "\(array.count) item\(array.count == 1 ? "" : "s")"
    case .null:
      return "null"
    }
  }

  private func railwayProviderApprovalStatusLabel(
    _ status: ProviderActionApprovalCardStatus
  ) -> String {
    status.rawValue.capitalized
  }

  private func providerApprovalStatusSortIndex(
    _ status: ProviderActionApprovalCardStatus
  ) -> Int {
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
}
