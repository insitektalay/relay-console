import Foundation

public enum RuntimeDispatchActionReason: String, Codable, Equatable, Sendable {
    case available
    case activeRequired = "active_required"
    case failedRequired = "failed_required"
    case terminal
    case retryEvidenceMissing = "retry_evidence_missing"
    case retrySourceMissing = "retry_source_missing"
    case retryContentMissing = "retry_content_missing"
    case activeDispatchExists = "active_dispatch_exists"
    case capabilityMissing = "capability_missing"
    case authRequired = "auth_required"
}

public enum RuntimeRunConfirmationState: String, Codable, CaseIterable, Sendable {
    case notRequired = "not_required"
    case pending
    case accepted
    case rejected
    case unknown

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let rawValue = try container.decode(String.self)
        self = RuntimeRunConfirmationState(rawValue: rawValue) ?? .unknown
    }
}

public enum RuntimeRunConfirmationSnapshot {
    public static let requiredKey = "runtimeRunConfirmationRequired"
    public static let stateKey = "runtimeRunConfirmationState"
    public static let titleKey = "runtimeRunConfirmationTitle"
    public static let summaryKey = "runtimeRunConfirmationSummary"
    public static let requestedAtKey = "runtimeRunConfirmationRequestedAt"
    public static let decidedAtKey = "runtimeRunConfirmationDecidedAt"
    public static let decidedByKey = "runtimeRunConfirmationDecidedBy"
}

public struct RuntimeDispatchActionState: Codable, Equatable, Sendable {
    public var canCancel: Bool
    public var cancelReason: RuntimeDispatchActionReason
    public var canRetry: Bool
    public var retryReason: RuntimeDispatchActionReason
    public var retrySourceMessageId: RelayId?
    public var retryOfDispatchId: RelayId?
    public var attempt: Int
    public var retrySafetyEvidenceId: String?

    public init(
        canCancel: Bool,
        cancelReason: RuntimeDispatchActionReason,
        canRetry: Bool,
        retryReason: RuntimeDispatchActionReason,
        retrySourceMessageId: RelayId?,
        retryOfDispatchId: RelayId?,
        attempt: Int,
        retrySafetyEvidenceId: String?
    ) {
        self.canCancel = canCancel
        self.cancelReason = cancelReason
        self.canRetry = canRetry
        self.retryReason = retryReason
        self.retrySourceMessageId = retrySourceMessageId
        self.retryOfDispatchId = retryOfDispatchId
        self.attempt = attempt
        self.retrySafetyEvidenceId = retrySafetyEvidenceId
    }
}

public extension RuntimeDispatch {
    var isActive: Bool {
        switch status {
        case .queued, .started, .streaming:
            return true
        case .completed, .failed, .cancelled:
            return false
        }
    }

    var isTerminal: Bool {
        !isActive
    }

    var runtimeType: RuntimeType? {
        stringValue(inputSnapshot["runtimeType"]).flatMap(RuntimeType.init(rawValue:))
            ?? stringValue(resultSnapshot?["runtimeType"]).flatMap(RuntimeType.init(rawValue:))
            ?? stringValue(errorSnapshot?["runtimeType"]).flatMap(RuntimeType.init(rawValue:))
    }

    var attempt: Int {
        intValue(inputSnapshot["attempt"])
            ?? intValue(resultSnapshot?["attempt"])
            ?? intValue(errorSnapshot?["attempt"])
            ?? 1
    }

    var retrySourceMessageId: RelayId? {
        nonEmptyString(errorSnapshot?["retrySourceMessageId"])
            ?? nonEmptyString(inputSnapshot["retrySourceMessageId"])
            ?? messageId
    }

    var retryOfDispatchId: RelayId? {
        nonEmptyString(inputSnapshot["retryOfDispatchId"])
            ?? nonEmptyString(errorSnapshot?["retryOfDispatchId"])
    }

    var retrySafetyEvidenceId: String? {
        nonEmptyString(errorSnapshot?["retrySafetyEvidenceId"])
            ?? nonEmptyString(errorSnapshot?["retryEvidenceId"])
            ?? nonEmptyString(inputSnapshot["retrySafetyEvidenceId"])
    }

    var retryable: Bool {
        boolValue(errorSnapshot?["retryable"])
            ?? boolValue(errorSnapshot?["retryEligible"])
            ?? boolValue(inputSnapshot["retryable"])
            ?? false
    }

    var postedMessageId: RelayId? {
        nonEmptyString(resultSnapshot?["postedMessageId"])
            ?? nonEmptyString(errorSnapshot?["postedMessageId"])
    }

    var errorCode: String? {
        nonEmptyString(errorSnapshot?["category"])
            ?? nonEmptyString(errorSnapshot?["code"])
    }

    var errorMessage: String? {
        nonEmptyString(errorSnapshot?["message"])
    }

    var runtimeStatusMessage: String? {
        nonEmptyString(resultSnapshot?["runtimeStatusMessage"])
            ?? nonEmptyString(resultSnapshot?["statusMessage"])
            ?? nonEmptyString(errorSnapshot?["statusMessage"])
    }

    var runtimeToolSummary: String? {
        nonEmptyString(resultSnapshot?["runtimeToolSummary"])
            ?? nonEmptyString(resultSnapshot?["toolSummary"])
    }

    var runtimeThinkingText: String? {
        nonEmptyString(resultSnapshot?["runtimeThinkingText"])
            ?? nonEmptyString(resultSnapshot?["thinkingText"])
    }

    var draftText: String? {
        nonEmptyString(resultSnapshot?["draftText"])
    }

    var runtimeApprovalMode: RuntimeApprovalMode {
        nonEmptyString(inputSnapshot["runtimeApprovalMode"]).flatMap(RuntimeApprovalMode.init(rawValue:))
            ?? nonEmptyString(resultSnapshot?["runtimeApprovalMode"]).flatMap(RuntimeApprovalMode.init(rawValue:))
            ?? .askForApproval
    }

    var isRuntimeApprovalPending: Bool {
        status == .streaming
            && nonEmptyString(resultSnapshot?["runtimeApprovalState"]) == "pending"
    }

    var runtimeApprovalCommand: String? {
        nonEmptyString(resultSnapshot?["runtimeApprovalCommand"])
    }

    var runtimeApprovalDescription: String? {
        nonEmptyString(resultSnapshot?["runtimeApprovalDescription"])
    }

    var hasRuntimeActivityProjection: Bool {
        resultSnapshot?[RuntimeActivityProjection.snapshotKey] != nil
            || errorSnapshot?[RuntimeActivityProjection.snapshotKey] != nil
    }

    var runtimeActivityProjection: RuntimeActivityProjection {
        let resultProjection = RuntimeActivityProjector.projection(from: resultSnapshot)
        if !resultProjection.isEmpty {
            return resultProjection
        }

        let errorProjection = RuntimeActivityProjector.projection(from: errorSnapshot)
        if !errorProjection.isEmpty {
            return errorProjection
        }

        return RuntimeActivityProjection(dispatchId: id)
    }

    var runConfirmationRequired: Bool {
        boolValue(errorSnapshot?[RuntimeRunConfirmationSnapshot.requiredKey])
            ?? boolValue(resultSnapshot?[RuntimeRunConfirmationSnapshot.requiredKey])
            ?? boolValue(inputSnapshot[RuntimeRunConfirmationSnapshot.requiredKey])
            ?? false
    }

    var runConfirmationState: RuntimeRunConfirmationState {
        let rawValue = nonEmptyString(errorSnapshot?[RuntimeRunConfirmationSnapshot.stateKey])
            ?? nonEmptyString(resultSnapshot?[RuntimeRunConfirmationSnapshot.stateKey])
            ?? nonEmptyString(inputSnapshot[RuntimeRunConfirmationSnapshot.stateKey])
            ?? (runConfirmationRequired ? RuntimeRunConfirmationState.pending.rawValue : RuntimeRunConfirmationState.notRequired.rawValue)
        return RuntimeRunConfirmationState(rawValue: rawValue) ?? .unknown
    }

    var isRunConfirmationPending: Bool {
        status == .queued && runConfirmationState == .pending
    }

    var runConfirmationTitle: String? {
        nonEmptyString(errorSnapshot?[RuntimeRunConfirmationSnapshot.titleKey])
            ?? nonEmptyString(resultSnapshot?[RuntimeRunConfirmationSnapshot.titleKey])
            ?? nonEmptyString(inputSnapshot[RuntimeRunConfirmationSnapshot.titleKey])
    }

    var runConfirmationSummary: String? {
        nonEmptyString(errorSnapshot?[RuntimeRunConfirmationSnapshot.summaryKey])
            ?? nonEmptyString(resultSnapshot?[RuntimeRunConfirmationSnapshot.summaryKey])
            ?? nonEmptyString(inputSnapshot[RuntimeRunConfirmationSnapshot.summaryKey])
    }

    func actionState(
        capabilities: RuntimeCapabilities?,
        hasActiveDispatchForThread: Bool,
        sourceMessageExists: Bool,
        sourceHasRetryableContent: Bool
    ) -> RuntimeDispatchActionState {
        let cancelReason: RuntimeDispatchActionReason
        let canCancel: Bool
        if !isActive {
            cancelReason = .terminal
            canCancel = false
        } else if capabilities?.supportsCancellation != true {
            cancelReason = .capabilityMissing
            canCancel = false
        } else {
            cancelReason = .available
            canCancel = true
        }

        let retryReason: RuntimeDispatchActionReason
        let canRetry: Bool
        if status != .failed {
            retryReason = .failedRequired
            canRetry = false
        } else if !retryable || retrySafetyEvidenceId == nil {
            retryReason = .retryEvidenceMissing
            canRetry = false
        } else if retrySourceMessageId == nil || !sourceMessageExists {
            retryReason = .retrySourceMissing
            canRetry = false
        } else if !sourceHasRetryableContent {
            retryReason = .retryContentMissing
            canRetry = false
        } else if hasActiveDispatchForThread {
            retryReason = .activeDispatchExists
            canRetry = false
        } else {
            retryReason = .available
            canRetry = true
        }

        return RuntimeDispatchActionState(
            canCancel: canCancel,
            cancelReason: cancelReason,
            canRetry: canRetry,
            retryReason: retryReason,
            retrySourceMessageId: retrySourceMessageId,
            retryOfDispatchId: retryOfDispatchId,
            attempt: attempt,
            retrySafetyEvidenceId: retrySafetyEvidenceId
        )
    }
}

public func runtimeLabel(_ type: RuntimeType?) -> String {
    switch type {
    case .hermes:
        return "Hermes"
    case .openclaw:
        return "OpenClaw"
    case .claudeCode:
        return "Claude Code"
    case .codexCli:
        return "Codex CLI"
    case .relayEcho:
        return "Runtime"
    case nil:
        return "Runtime"
    }
}

private func nonEmptyString(_ value: JSONValue?) -> String? {
    let string = stringValue(value)?.trimmingCharacters(in: .whitespacesAndNewlines)
    return string?.isEmpty == false ? string : nil
}

private func intValue(_ value: JSONValue?) -> Int? {
    switch value {
    case .number(let number):
        return Int(number)
    case .string(let string):
        return Int(string)
    default:
        return nil
    }
}
