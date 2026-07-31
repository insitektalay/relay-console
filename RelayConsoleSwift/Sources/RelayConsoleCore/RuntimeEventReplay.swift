import Foundation

public enum RuntimeReplayTerminalDisposition: String, Codable, Equatable, Sendable {
    case active
    case needsTerminalMessage
    case messageAlreadyPosted
    case failureCard
    case cancelledCard
}

public struct RuntimeReplayRetrySafety: Codable, Equatable, Sendable {
    public var retryable: Bool
    public var evidenceId: String?
    public var attempt: Int

    public var canRetry: Bool {
        retryable && !(evidenceId ?? "").isEmpty
    }

    public init(retryable: Bool = false, evidenceId: String? = nil, attempt: Int = 1) {
        self.retryable = retryable
        self.evidenceId = evidenceId
        self.attempt = attempt
    }
}

public struct RuntimeReplayEventSemantic: Codable, Equatable, Sendable {
    public var eventType: RuntimeEventType
    public var dispatchStatus: DispatchStatus?
    public var isTerminal: Bool
    public var preservesTextDelta: Bool
    public var isHealthSignal: Bool

    public init(
        eventType: RuntimeEventType,
        dispatchStatus: DispatchStatus?,
        isTerminal: Bool,
        preservesTextDelta: Bool,
        isHealthSignal: Bool
    ) {
        self.eventType = eventType
        self.dispatchStatus = dispatchStatus
        self.isTerminal = isTerminal
        self.preservesTextDelta = preservesTextDelta
        self.isHealthSignal = isHealthSignal
    }
}

public enum RuntimeReplaySemantics {
    public static let eventTypes: [RuntimeEventType] = [
        .queued,
        .started,
        .status,
        .delta,
        .thinking,
        .tool,
        .context,
        .completed,
        .failed,
        .cancelled,
        .healthChanged
    ]

    public static let all: [RuntimeReplayEventSemantic] = eventTypes.map(semantic)

    public static func semantic(for type: RuntimeEventType) -> RuntimeReplayEventSemantic {
        switch type {
        case .queued:
            return RuntimeReplayEventSemantic(
                eventType: type,
                dispatchStatus: .queued,
                isTerminal: false,
                preservesTextDelta: false,
                isHealthSignal: false
            )
        case .started:
            return RuntimeReplayEventSemantic(
                eventType: type,
                dispatchStatus: .started,
                isTerminal: false,
                preservesTextDelta: false,
                isHealthSignal: false
            )
        case .status, .thinking, .tool, .context:
            return RuntimeReplayEventSemantic(
                eventType: type,
                dispatchStatus: .streaming,
                isTerminal: false,
                preservesTextDelta: false,
                isHealthSignal: false
            )
        case .delta:
            return RuntimeReplayEventSemantic(
                eventType: type,
                dispatchStatus: .streaming,
                isTerminal: false,
                preservesTextDelta: true,
                isHealthSignal: false
            )
        case .completed:
            return RuntimeReplayEventSemantic(
                eventType: type,
                dispatchStatus: .completed,
                isTerminal: true,
                preservesTextDelta: false,
                isHealthSignal: false
            )
        case .failed:
            return RuntimeReplayEventSemantic(
                eventType: type,
                dispatchStatus: .failed,
                isTerminal: true,
                preservesTextDelta: false,
                isHealthSignal: false
            )
        case .cancelled:
            return RuntimeReplayEventSemantic(
                eventType: type,
                dispatchStatus: .cancelled,
                isTerminal: true,
                preservesTextDelta: false,
                isHealthSignal: false
            )
        case .healthChanged:
            return RuntimeReplayEventSemantic(
                eventType: type,
                dispatchStatus: nil,
                isTerminal: false,
                preservesTextDelta: false,
                isHealthSignal: true
            )
        }
    }
}

public struct RuntimeReplayRecord: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId { dispatchId }
    public var dispatchId: RelayId
    public var threadId: RelayId
    public var messageId: RelayId?
    public var agentId: RelayId
    public var harnessId: RelayId?
    public var sessionId: RelayId?
    public var runtimeType: RuntimeType?
    public var status: DispatchStatus
    public var correlationId: String?
    public var inputSnapshot: JSONRecord
    public var resultSnapshot: JSONRecord?
    public var errorSnapshot: JSONRecord?
    public var eventIds: [RelayId]
    public var eventTypes: [RuntimeEventType]
    public var draftText: String?
    public var terminalMessageId: RelayId?
    public var terminalDisposition: RuntimeReplayTerminalDisposition
    public var retrySafety: RuntimeReplayRetrySafety
    public var lastEventDetail: JSONRecord
    public var lastEventAt: IsoTimestamp?
    public var createdAt: IsoTimestamp?
    public var updatedAt: IsoTimestamp?

    public var shouldCreateTerminalMessage: Bool {
        terminalDisposition == .needsTerminalMessage
    }

    public init(
        dispatchId: RelayId,
        threadId: RelayId,
        messageId: RelayId?,
        agentId: RelayId,
        harnessId: RelayId?,
        sessionId: RelayId?,
        runtimeType: RuntimeType?,
        status: DispatchStatus,
        correlationId: String?,
        inputSnapshot: JSONRecord = [:],
        resultSnapshot: JSONRecord? = nil,
        errorSnapshot: JSONRecord? = nil,
        eventIds: [RelayId] = [],
        eventTypes: [RuntimeEventType] = [],
        draftText: String? = nil,
        terminalMessageId: RelayId? = nil,
        terminalDisposition: RuntimeReplayTerminalDisposition? = nil,
        retrySafety: RuntimeReplayRetrySafety = RuntimeReplayRetrySafety(),
        lastEventDetail: JSONRecord = [:],
        lastEventAt: IsoTimestamp? = nil,
        createdAt: IsoTimestamp? = nil,
        updatedAt: IsoTimestamp? = nil
    ) {
        self.dispatchId = dispatchId
        self.threadId = threadId
        self.messageId = messageId
        self.agentId = agentId
        self.harnessId = harnessId
        self.sessionId = sessionId
        self.runtimeType = runtimeType
        self.status = status
        self.correlationId = correlationId
        self.inputSnapshot = redactRecord(inputSnapshot)
        self.resultSnapshot = resultSnapshot.map(redactRecord)
        self.errorSnapshot = errorSnapshot.map(redactRecord)
        self.eventIds = eventIds
        self.eventTypes = eventTypes
        self.draftText = draftText
        self.terminalMessageId = terminalMessageId
        self.terminalDisposition = terminalDisposition ?? runtimeTerminalDisposition(for: status, hasTerminalMessage: terminalMessageId != nil)
        self.retrySafety = retrySafety
        self.lastEventDetail = redactRecord(lastEventDetail)
        self.lastEventAt = lastEventAt
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

public struct RuntimeReplayEventApplyResult: Codable, Equatable, Sendable {
    public var accepted: Bool
    public var duplicate: Bool
    public var ignoredBecauseTerminal: Bool
    public var dispatchId: RelayId
    public var record: RuntimeReplayRecord?

    public init(
        accepted: Bool,
        duplicate: Bool,
        ignoredBecauseTerminal: Bool,
        dispatchId: RelayId,
        record: RuntimeReplayRecord?
    ) {
        self.accepted = accepted
        self.duplicate = duplicate
        self.ignoredBecauseTerminal = ignoredBecauseTerminal
        self.dispatchId = dispatchId
        self.record = record
    }
}

public struct RuntimeReplaySnapshot: Codable, Equatable, Sendable {
    public var records: [RuntimeReplayRecord]
    public var duplicateEventIds: [RelayId]

    public var dispatchCount: Int {
        records.count
    }

    public var terminalOutputCreationRequests: Int {
        records.filter(\.shouldCreateTerminalMessage).count
    }

    public init(records: [RuntimeReplayRecord], duplicateEventIds: [RelayId]) {
        self.records = records
        self.duplicateEventIds = duplicateEventIds
    }

    public func record(dispatchId: RelayId) -> RuntimeReplayRecord? {
        records.first { $0.dispatchId == dispatchId }
    }
}

public struct LocalEventReplayThreadProjection: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId { threadId }
    public var threadId: RelayId
    public var readState: ThreadReadStateValue
    public var unreadCount: Int
    public var lastReadAt: IsoTimestamp?
    public var activeDispatchIds: [RelayId]
    public var recentTerminalDispatchIds: [RelayId]
    public var terminalOutputCreationRequests: Int

    public var hasActiveRuntimeDispatch: Bool {
        !activeDispatchIds.isEmpty
    }

    public init(
        threadId: RelayId,
        readState: ThreadReadStateValue,
        unreadCount: Int,
        lastReadAt: IsoTimestamp?,
        activeDispatchIds: [RelayId],
        recentTerminalDispatchIds: [RelayId],
        terminalOutputCreationRequests: Int
    ) {
        self.threadId = threadId
        self.readState = readState
        self.unreadCount = unreadCount
        self.lastReadAt = lastReadAt
        self.activeDispatchIds = activeDispatchIds
        self.recentTerminalDispatchIds = recentTerminalDispatchIds
        self.terminalOutputCreationRequests = terminalOutputCreationRequests
    }
}

public struct LocalEventReplayRecoverySnapshot: Codable, Equatable, Sendable {
    public var selectedThreadId: RelayId?
    public var threads: [LocalEventReplayThreadProjection]
    public var duplicateRuntimeEventIds: [RelayId]

    public var selectedThread: LocalEventReplayThreadProjection? {
        guard let selectedThreadId else { return nil }
        return threads.first { $0.threadId == selectedThreadId }
    }

    public init(
        selectedThreadId: RelayId?,
        threads: [LocalEventReplayThreadProjection],
        duplicateRuntimeEventIds: [RelayId]
    ) {
        self.selectedThreadId = selectedThreadId
        self.threads = threads
        self.duplicateRuntimeEventIds = duplicateRuntimeEventIds
    }
}

public enum LocalEventReplayReconciler {
    public static func recoverySnapshot(
        selectedThreadId: RelayId?,
        threads: [ThreadSummary],
        dispatches: [RuntimeDispatch],
        events: [RuntimeEvent],
        messages: [Message]
    ) -> LocalEventReplayRecoverySnapshot {
        var reducer = RuntimeReplayReducer(dispatches: dispatches, events: events, messages: messages)
        reducer.reconcileMessages(messages)
        let replaySnapshot = reducer.snapshot()
        let threadIds = Set(threads.map(\.id))
            .union(dispatches.map(\.threadId))
            .union(events.map(\.threadId))
            .union(messages.map(\.threadId))
            .union(selectedThreadId.map { [$0] } ?? [])
            .sorted()
        let summariesByThread = Dictionary(uniqueKeysWithValues: threads.map { ($0.id, $0) })
        let projections = threadIds.map { threadId in
            let records = replaySnapshot.records.filter { $0.threadId == threadId }
            let activeDispatchIds = records
                .filter { $0.terminalDisposition == .active }
                .map(\.dispatchId)
            let recentTerminalDispatchIds = records
                .filter { $0.terminalDisposition != .active }
                .map(\.dispatchId)
            let summary = summariesByThread[threadId]
            return LocalEventReplayThreadProjection(
                threadId: threadId,
                readState: summary?.readState ?? .read,
                unreadCount: summary?.unreadCount ?? 0,
                lastReadAt: summary?.lastReadAt,
                activeDispatchIds: activeDispatchIds,
                recentTerminalDispatchIds: recentTerminalDispatchIds,
                terminalOutputCreationRequests: records.filter(\.shouldCreateTerminalMessage).count
            )
        }
        return LocalEventReplayRecoverySnapshot(
            selectedThreadId: selectedThreadId,
            threads: projections,
            duplicateRuntimeEventIds: replaySnapshot.duplicateEventIds
        )
    }
}

public struct RuntimeReplayReducer: Sendable {
    private var recordsByDispatchId: [RelayId: RuntimeReplayRecord]
    private var seenEventIds: Set<RelayId>
    private var duplicateEventIds: [RelayId]

    public init() {
        self.recordsByDispatchId = [:]
        self.seenEventIds = []
        self.duplicateEventIds = []
    }

    public init(dispatches: [RuntimeDispatch], events: [RuntimeEvent] = [], messages: [Message] = []) {
        self.init()
        loadDispatches(dispatches)
        for event in events {
            _ = apply(event)
        }
        reconcileMessages(messages)
    }

    public mutating func loadDispatches(_ dispatches: [RuntimeDispatch]) {
        for dispatch in dispatches {
            let record = RuntimeReplayRecord(
                dispatchId: dispatch.id,
                threadId: dispatch.threadId,
                messageId: dispatch.messageId,
                agentId: dispatch.agentId,
                harnessId: dispatch.harnessId,
                sessionId: dispatch.sessionId,
                runtimeType: dispatch.runtimeType ?? runtimeType(from: dispatch.inputSnapshot),
                status: dispatch.status,
                correlationId: dispatch.correlationId,
                inputSnapshot: dispatch.inputSnapshot,
                resultSnapshot: dispatch.resultSnapshot,
                errorSnapshot: dispatch.errorSnapshot,
                terminalMessageId: dispatch.postedMessageId,
                retrySafety: retrySafety(from: dispatch.errorSnapshot ?? dispatch.resultSnapshot ?? dispatch.inputSnapshot),
                createdAt: dispatch.createdAt,
                updatedAt: dispatch.updatedAt
            )
            recordsByDispatchId[dispatch.id] = merge(existing: recordsByDispatchId[dispatch.id], incoming: record)
        }
    }

    @discardableResult
    public mutating func apply(_ event: RuntimeEvent) -> RuntimeReplayEventApplyResult {
        guard !seenEventIds.contains(event.id) else {
            duplicateEventIds.append(event.id)
            let record = recordsByDispatchId[event.dispatchId]
            return RuntimeReplayEventApplyResult(
                accepted: false,
                duplicate: true,
                ignoredBecauseTerminal: false,
                dispatchId: event.dispatchId,
                record: record
            )
        }

        seenEventIds.insert(event.id)
        let semantic = RuntimeReplaySemantics.semantic(for: event.type)
        var record = recordsByDispatchId[event.dispatchId] ?? RuntimeReplayRecord(
            dispatchId: event.dispatchId,
            threadId: event.threadId,
            messageId: nil,
            agentId: event.agentId,
            harnessId: nil,
            sessionId: nil,
            runtimeType: event.runtimeType,
            status: semantic.dispatchStatus ?? .queued,
            correlationId: event.detail["correlationId"]?.string,
            lastEventAt: event.timestamp
        )

        let wasTerminal = isTerminal(record.status)
        let proposedStatus = semantic.dispatchStatus
        let ignoredBecauseTerminal = wasTerminal && proposedStatus.map { !isTerminal($0) } == true

        record.runtimeType = record.runtimeType ?? event.runtimeType
        record.eventIds.append(event.id)
        record.eventTypes.append(event.type)
        record.lastEventDetail = redactRecord(event.detail)
        record.lastEventAt = event.timestamp
        record.correlationId = record.correlationId ?? event.detail["correlationId"]?.string

        if !ignoredBecauseTerminal, let proposedStatus {
            record.status = runtimeReplayStatus(current: record.status, proposed: proposedStatus)
        }
        if !ignoredBecauseTerminal, semantic.preservesTextDelta, let text = event.text {
            record.draftText = [record.draftText, text]
                .compactMap { $0 }
                .joined()
        }
        if event.type == .failed {
            record.retrySafety = retrySafety(from: event.detail)
            record.errorSnapshot = mergeJSON(record.errorSnapshot, redactRecord(event.detail))
        }
        if event.type == .completed {
            record.resultSnapshot = mergeJSON(record.resultSnapshot, redactRecord(event.detail))
            record.terminalMessageId = record.terminalMessageId ?? postedMessageId(from: record.resultSnapshot)
        }
        if event.type == .cancelled {
            record.errorSnapshot = mergeJSON(record.errorSnapshot, redactRecord(event.detail))
        }

        record.terminalDisposition = runtimeTerminalDisposition(for: record.status, hasTerminalMessage: record.terminalMessageId != nil)
        recordsByDispatchId[event.dispatchId] = record

        return RuntimeReplayEventApplyResult(
            accepted: true,
            duplicate: false,
            ignoredBecauseTerminal: ignoredBecauseTerminal,
            dispatchId: event.dispatchId,
            record: record
        )
    }

    public mutating func reconcileMessages(_ messages: [Message]) {
        let agentMessages = messages.filter { $0.senderType == .agent }
        let terminalMessagesByDispatch = Dictionary(
            grouping: agentMessages,
            by: { $0.metadata["dispatchId"]?.string ?? "" }
        )
        let terminalMessagesById = Dictionary(
            uniqueKeysWithValues: agentMessages
                .sorted(by: { $0.createdAt < $1.createdAt })
                .map { ($0.id, $0) }
        )

        for dispatchId in Array(recordsByDispatchId.keys) {
            guard var record = recordsByDispatchId[dispatchId],
                  record.status == .completed || !isTerminal(record.status),
                  let message = terminalMessage(
                    for: record,
                    messagesByDispatch: terminalMessagesByDispatch,
                    messagesById: terminalMessagesById
                  )
            else {
                continue
            }
            if !isTerminal(record.status) {
                record.status = .completed
            }
            record.terminalMessageId = message.id
            record.terminalDisposition = runtimeTerminalDisposition(for: record.status, hasTerminalMessage: true)
            recordsByDispatchId[dispatchId] = record
        }
    }

    public func snapshot(threadId: RelayId? = nil) -> RuntimeReplaySnapshot {
        let records = recordsByDispatchId.values
            .filter { threadId == nil || $0.threadId == threadId }
            .sorted {
                let left = [$0.createdAt ?? "", $0.lastEventAt ?? "", $0.dispatchId]
                let right = [$1.createdAt ?? "", $1.lastEventAt ?? "", $1.dispatchId]
                return left.lexicographicallyPrecedes(right)
            }
        return RuntimeReplaySnapshot(records: records, duplicateEventIds: duplicateEventIds)
    }
}

private func runtimeReplayStatus(current: DispatchStatus, proposed: DispatchStatus) -> DispatchStatus {
    if isTerminal(current) {
        return current
    }
    if isTerminal(proposed) {
        return proposed
    }
    return runtimeStatusRank(proposed) >= runtimeStatusRank(current) ? proposed : current
}

private func runtimeStatusRank(_ status: DispatchStatus) -> Int {
    switch status {
    case .queued:
        return 0
    case .started:
        return 1
    case .streaming:
        return 2
    case .completed, .failed, .cancelled:
        return 3
    }
}

private func isTerminal(_ status: DispatchStatus) -> Bool {
    switch status {
    case .completed, .failed, .cancelled:
        return true
    case .queued, .started, .streaming:
        return false
    }
}

private func runtimeTerminalDisposition(for status: DispatchStatus, hasTerminalMessage: Bool) -> RuntimeReplayTerminalDisposition {
    switch status {
    case .completed:
        return hasTerminalMessage ? .messageAlreadyPosted : .needsTerminalMessage
    case .failed:
        return .failureCard
    case .cancelled:
        return .cancelledCard
    case .queued, .started, .streaming:
        return .active
    }
}

private func runtimeType(from record: JSONRecord) -> RuntimeType? {
    guard let rawValue = record["runtimeType"]?.string else {
        return nil
    }
    return RuntimeType(rawValue: rawValue)
}

private func terminalMessage(
    for record: RuntimeReplayRecord,
    messagesByDispatch: [RelayId: [Message]],
    messagesById: [RelayId: Message]
) -> Message? {
    if let message = messagesByDispatch[record.dispatchId]?
        .sorted(by: { $0.createdAt < $1.createdAt })
        .first {
        return message
    }
    let messageId = record.terminalMessageId
        ?? postedMessageId(from: record.resultSnapshot)
        ?? postedMessageId(from: record.errorSnapshot)
    guard let messageId else {
        return nil
    }
    return messagesById[messageId]
}

private func postedMessageId(from record: JSONRecord?) -> RelayId? {
    guard let string = record?["postedMessageId"]?.string?.trimmingCharacters(in: .whitespacesAndNewlines),
          !string.isEmpty
    else {
        return nil
    }
    return string
}

private func retrySafety(from record: JSONRecord) -> RuntimeReplayRetrySafety {
    let retryable = record["retryable"]?.bool ?? record["retryEligible"]?.bool ?? false
    let evidenceId = record["retrySafetyEvidenceId"]?.string ?? record["retryEvidenceId"]?.string
    return RuntimeReplayRetrySafety(
        retryable: retryable,
        evidenceId: evidenceId,
        attempt: intValue(record["attempt"]) ?? 1
    )
}

private func merge(existing: RuntimeReplayRecord?, incoming: RuntimeReplayRecord) -> RuntimeReplayRecord {
    guard var existing else {
        return incoming
    }
    existing.messageId = existing.messageId ?? incoming.messageId
    existing.harnessId = existing.harnessId ?? incoming.harnessId
    existing.sessionId = existing.sessionId ?? incoming.sessionId
    existing.runtimeType = existing.runtimeType ?? incoming.runtimeType
    existing.status = runtimeReplayStatus(current: existing.status, proposed: incoming.status)
    existing.correlationId = existing.correlationId ?? incoming.correlationId
    if existing.inputSnapshot.isEmpty {
        existing.inputSnapshot = incoming.inputSnapshot
    }
    existing.resultSnapshot = mergeJSON(existing.resultSnapshot, incoming.resultSnapshot)
    existing.errorSnapshot = mergeJSON(existing.errorSnapshot, incoming.errorSnapshot)
    existing.terminalDisposition = runtimeTerminalDisposition(for: existing.status, hasTerminalMessage: existing.terminalMessageId != nil)
    existing.createdAt = existing.createdAt ?? incoming.createdAt
    existing.updatedAt = incoming.updatedAt ?? existing.updatedAt
    return existing
}

private func mergeJSON(_ existing: JSONRecord?, _ incoming: JSONRecord?) -> JSONRecord? {
    guard let incoming else {
        return existing
    }
    var merged = existing ?? [:]
    for (key, value) in incoming {
        merged[key] = redactValue(value)
    }
    return merged
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
