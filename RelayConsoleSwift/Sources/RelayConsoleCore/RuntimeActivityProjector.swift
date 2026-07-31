import Foundation

public struct RuntimeActivityProjectionEvent: Equatable, Sendable {
    public var id: RelayId
    public var dispatchId: RelayId
    public var type: RuntimeEventType
    public var text: String?
    public var status: String?
    public var detail: JSONRecord
    public var timestamp: IsoTimestamp

    public init(
        id: RelayId,
        dispatchId: RelayId,
        type: RuntimeEventType,
        text: String?,
        status: String?,
        detail: JSONRecord,
        timestamp: IsoTimestamp
    ) {
        self.id = id
        self.dispatchId = dispatchId
        self.type = type
        self.text = text
        self.status = status
        self.detail = detail
        self.timestamp = timestamp
    }

    public init(_ event: RuntimeBridgeEvent) {
        self.init(
            id: event.id,
            dispatchId: event.dispatchId,
            type: event.type,
            text: event.text,
            status: event.status,
            detail: event.detail,
            timestamp: event.timestamp
        )
    }

    public init(_ event: RuntimeEvent) {
        self.init(
            id: event.id,
            dispatchId: event.dispatchId,
            type: event.type,
            text: event.text,
            status: event.status,
            detail: event.detail,
            timestamp: event.timestamp
        )
    }
}

public enum RuntimeActivityProjector {
    public static func projection(from snapshot: JSONRecord?) -> RuntimeActivityProjection {
        guard let value = snapshot?[RuntimeActivityProjection.snapshotKey] else {
            return RuntimeActivityProjection()
        }
        return projection(from: value) ?? RuntimeActivityProjection()
    }

    public static func snapshot(_ snapshot: JSONRecord? = nil, applying event: RuntimeBridgeEvent) -> JSONRecord {
        self.snapshot(snapshot, applying: RuntimeActivityProjectionEvent(event))
    }

    public static func snapshot(_ snapshot: JSONRecord? = nil, applying event: RuntimeEvent) -> JSONRecord {
        self.snapshot(snapshot, applying: RuntimeActivityProjectionEvent(event))
    }

    public static func snapshot(_ snapshot: JSONRecord? = nil, applying event: RuntimeActivityProjectionEvent) -> JSONRecord {
        var output = snapshot ?? [:]
        let nextProjection = apply(event, to: projection(from: output))
        output[RuntimeActivityProjection.snapshotKey] = .object(jsonRecord(nextProjection))
        applyCompatibilityFields(for: event, to: &output)
        return output
    }

    public static func apply(
        _ event: RuntimeActivityProjectionEvent,
        to projection: RuntimeActivityProjection
    ) -> RuntimeActivityProjection {
        var projection = projection
        projection.schemaVersion = RuntimeActivityProjection.currentSchemaVersion
        projection.dispatchId = projection.dispatchId ?? event.dispatchId
        projection.lastEventId = event.id
        projection.lastEventType = gatewayEventType(for: event)
        projection.updatedAt = event.timestamp

        switch activityKind(for: event) {
        case .message:
            applyMessage(event, to: &projection)
        case .thinking:
            upsertThinking(event, in: &projection)
        case .status:
            appendStatus(event, to: &projection)
        case .tool:
            upsertTool(event, in: &projection)
        case .taskList:
            upsertTaskList(event, in: &projection)
        case .context:
            upsertContext(event, in: &projection)
        case .terminal:
            upsertTerminal(event, in: &projection)
        case .toolGroup, .unknown:
            appendStatus(event, to: &projection)
        }

        rebuildToolGroups(in: &projection)
        return projection
    }

    private static func applyCompatibilityFields(for event: RuntimeActivityProjectionEvent, to snapshot: inout JSONRecord) {
        snapshot["lastEventType"] = .string(event.type.rawValue)
        if let status = nonEmpty(event.status) {
            snapshot["runtimeStatusMessage"] = .string(status)
        }

        switch event.type {
        case .delta:
            if let text = event.text, !text.isEmpty {
                snapshot["draftText"] = .string((runtimeActivityStringValue(snapshot["draftText"]) ?? "") + text)
            }
        case .thinking:
            if let text = nonEmpty(event.text) ?? nonEmpty(event.status) {
                snapshot["runtimeThinkingText"] = .string(text)
            }
        case .tool:
            if let text = nonEmpty(event.text) ?? nonEmpty(event.status) {
                snapshot["runtimeToolSummary"] = .string(text)
            }
        case .context:
            snapshot["runtimeContext"] = .object(redactRecord(event.detail))
        case .completed:
            if let text = event.text, !text.isEmpty {
                snapshot["finalText"] = .string(text)
            }
        default:
            break
        }
    }

    private static func applyMessage(_ event: RuntimeActivityProjectionEvent, to projection: inout RuntimeActivityProjection) {
        if event.type == .delta, let text = event.text, !text.isEmpty {
            projection.draftText = (projection.draftText ?? "") + text
        }

        let phase: RuntimeActivityPhase = event.type == .completed ? .completed : .running
        upsertItem(
            RuntimeActivityItem(
                id: activityId(event.dispatchId, "message", "response"),
                dispatchId: event.dispatchId,
                kind: .message,
                phase: phase,
                title: "Response",
                summary: event.type == .delta ? "Streaming response" : nonEmpty(event.status),
                eventIds: [event.id],
                startedAt: phase == .running ? event.timestamp : nil,
                updatedAt: event.timestamp,
                completedAt: phase == .completed ? event.timestamp : nil,
                detail: redactRecord(event.detail)
            ),
            in: &projection
        )
    }

    private static func upsertThinking(_ event: RuntimeActivityProjectionEvent, in projection: inout RuntimeActivityProjection) {
        let text = nonEmpty(event.text) ?? nonEmpty(event.status) ?? "Thinking"
        upsertItem(
            RuntimeActivityItem(
                id: activityId(event.dispatchId, "thinking", "latest"),
                dispatchId: event.dispatchId,
                kind: .thinking,
                phase: .running,
                title: "Thinking",
                summary: text,
                eventIds: [event.id],
                startedAt: event.timestamp,
                updatedAt: event.timestamp,
                detail: redactRecord(event.detail)
            ),
            in: &projection
        )
    }

    private static func appendStatus(_ event: RuntimeActivityProjectionEvent, to projection: inout RuntimeActivityProjection) {
        let summary = nonEmpty(event.text) ?? nonEmpty(event.status) ?? gatewayEventType(for: event)
        upsertItem(
            RuntimeActivityItem(
                id: activityId(event.dispatchId, "status", event.id),
                dispatchId: event.dispatchId,
                kind: .status,
                phase: phase(for: event, defaultPhase: .running),
                title: "Status",
                summary: summary,
                eventIds: [event.id],
                startedAt: event.timestamp,
                updatedAt: event.timestamp,
                completedAt: isTerminalPhase(phase(for: event, defaultPhase: .running)) ? event.timestamp : nil,
                detail: redactRecord(event.detail)
            ),
            in: &projection
        )
    }

    private static func upsertTool(_ event: RuntimeActivityProjectionEvent, in projection: inout RuntimeActivityProjection) {
        let payload = payload(for: event)
        if isTodoPayload(payload) {
            upsertTaskList(event, in: &projection)
            return
        }

        let name = toolName(from: payload) ?? nonEmpty(event.text) ?? "tool"
        let callId = toolCallId(from: payload)
        let existing = existingToolItem(name: name, callId: callId, in: projection)
        let itemId = callId.map { activityId(event.dispatchId, "tool", $0) }
            ?? existing?.id
            ?? activityId(event.dispatchId, "tool", event.id)
        let phase = phase(for: event, defaultPhase: .running)
        let summary = nonEmpty(event.text)
            ?? nonEmpty(runtimeActivityStringValue(payload["text"]))
            ?? nonEmpty(event.status)
            ?? gatewayEventType(for: event)

        upsertItem(
            RuntimeActivityItem(
                id: itemId,
                dispatchId: event.dispatchId,
                kind: .tool,
                phase: phase,
                title: name,
                summary: summary,
                toolName: name,
                toolCallId: callId ?? existing?.toolCallId,
                eventIds: [event.id],
                startedAt: event.timestamp,
                updatedAt: event.timestamp,
                completedAt: isTerminalPhase(phase) ? event.timestamp : nil,
                detail: redactRecord(event.detail),
                result: objectValue(payload["result"]).map(redactRecord),
                error: toolError(from: payload, event: event),
                compatibilityMetadata: ["gatewayEventType": .string(gatewayEventType(for: event))]
            ),
            in: &projection
        )
    }

    private static func upsertTaskList(_ event: RuntimeActivityProjectionEvent, in projection: inout RuntimeActivityProjection) {
        let payload = payload(for: event)
        if let todos = arrayValue(payload["todos"]) {
            projection.tasks = todos.enumerated().compactMap { index, value in
                guard let object = objectValue(value) else { return nil }
                return task(from: object, index: index, timestamp: event.timestamp)
            }
        }

        let phase = taskListPhase(projection.tasks)
        let title = taskListTitle(projection.tasks) ?? nonEmpty(event.text) ?? "Task list"
        let summary = taskListSummary(projection.tasks)
        upsertItem(
            RuntimeActivityItem(
                id: activityId(event.dispatchId, "task_list", "todo-live"),
                dispatchId: event.dispatchId,
                kind: .taskList,
                phase: phase,
                title: title,
                summary: summary,
                toolName: "todo",
                toolCallId: "todo-live",
                eventIds: [event.id],
                startedAt: event.timestamp,
                updatedAt: event.timestamp,
                completedAt: isTerminalPhase(phase) ? event.timestamp : nil,
                detail: redactRecord(event.detail),
                compatibilityMetadata: ["gatewayEventType": .string(gatewayEventType(for: event))]
            ),
            in: &projection
        )
    }

    private static func upsertContext(_ event: RuntimeActivityProjectionEvent, in projection: inout RuntimeActivityProjection) {
        upsertItem(
            RuntimeActivityItem(
                id: activityId(event.dispatchId, "context", "latest"),
                dispatchId: event.dispatchId,
                kind: .context,
                phase: .completed,
                title: "Context",
                summary: nonEmpty(event.status) ?? nonEmpty(event.text),
                eventIds: [event.id],
                startedAt: event.timestamp,
                updatedAt: event.timestamp,
                completedAt: event.timestamp,
                detail: redactRecord(event.detail)
            ),
            in: &projection
        )
    }

    private static func upsertTerminal(_ event: RuntimeActivityProjectionEvent, in projection: inout RuntimeActivityProjection) {
        let phase = phase(for: event, defaultPhase: event.type == .started ? .running : .completed)
        upsertItem(
            RuntimeActivityItem(
                id: activityId(event.dispatchId, "terminal", "runtime"),
                dispatchId: event.dispatchId,
                kind: .terminal,
                phase: phase,
                title: "Runtime",
                summary: nonEmpty(event.status) ?? nonEmpty(event.text),
                eventIds: [event.id],
                startedAt: event.type == .started ? event.timestamp : nil,
                updatedAt: event.timestamp,
                completedAt: isTerminalPhase(phase) ? event.timestamp : nil,
                detail: redactRecord(event.detail)
            ),
            in: &projection
        )

        if event.type == .completed {
            markItem(activityId(event.dispatchId, "message", "response"), phase: .completed, event: event, in: &projection)
        }
    }

    private static func upsertItem(_ item: RuntimeActivityItem, in projection: inout RuntimeActivityProjection) {
        guard let index = projection.items.firstIndex(where: { $0.id == item.id }) else {
            projection.items.append(item)
            return
        }

        let existing = projection.items[index]
        projection.items[index] = RuntimeActivityItem(
            id: item.id,
            dispatchId: item.dispatchId ?? existing.dispatchId,
            kind: item.kind,
            kindRawValue: item.kindRawValue,
            phase: item.phase,
            phaseRawValue: item.phaseRawValue,
            title: item.title,
            summary: item.summary ?? existing.summary,
            toolName: item.toolName ?? existing.toolName,
            toolCallId: item.toolCallId ?? existing.toolCallId,
            groupId: item.groupId ?? existing.groupId,
            eventIds: appendUnique(existing.eventIds, item.eventIds),
            startedAt: existing.startedAt ?? item.startedAt,
            updatedAt: item.updatedAt ?? existing.updatedAt,
            completedAt: item.completedAt ?? existing.completedAt,
            durationMs: item.durationMs ?? existing.durationMs,
            detail: mergeJSON(existing.detail, item.detail),
            result: item.result ?? existing.result,
            error: item.error ?? existing.error,
            compatibilityMetadata: mergeJSON(existing.compatibilityMetadata, item.compatibilityMetadata)
        )
    }

    private static func markItem(
        _ id: RelayId,
        phase: RuntimeActivityPhase,
        event: RuntimeActivityProjectionEvent,
        in projection: inout RuntimeActivityProjection
    ) {
        guard let index = projection.items.firstIndex(where: { $0.id == id }) else { return }
        projection.items[index].phase = phase
        projection.items[index].phaseRawValue = phase.rawValue
        projection.items[index].updatedAt = event.timestamp
        projection.items[index].completedAt = event.timestamp
        projection.items[index].eventIds = appendUnique(projection.items[index].eventIds, [event.id])
    }

    private static func rebuildToolGroups(in projection: inout RuntimeActivityProjection) {
        var items = projection.items
        var groups: [RuntimeActivityToolGroup] = []
        var run: [Int] = []

        func flushRun() {
            guard !run.isEmpty else { return }
            let runItems = run.map { items[$0] }
            let groupId = activityId(runItems[0].dispatchId ?? "runtime", "tool_group", runItems[0].id)
            for index in run {
                items[index].groupId = groupId
            }
            groups.append(toolGroup(id: groupId, items: runItems))
            run.removeAll()
        }

        for index in items.indices {
            if items[index].kind == .tool {
                run.append(index)
            } else {
                flushRun()
            }
        }
        flushRun()

        projection.items = items
        projection.toolGroups = groups
    }

    private static func toolGroup(id: RelayId, items: [RuntimeActivityItem]) -> RuntimeActivityToolGroup {
        let runningCount = items.filter { $0.phase == .running || $0.phase == .pending }.count
        let completedCount = items.filter { $0.phase == .completed }.count
        let failedCount = items.filter { $0.phase == .failed }.count
        let cancelledCount = items.filter { $0.phase == .cancelled }.count
        let phase: RuntimeActivityPhase
        if failedCount > 0 {
            phase = .failed
        } else if runningCount > 0 {
            phase = .running
        } else if cancelledCount == items.count {
            phase = .cancelled
        } else {
            phase = .completed
        }

        return RuntimeActivityToolGroup(
            id: id,
            title: "Tool actions",
            phase: phase,
            itemIds: items.map(\.id),
            summary: "\(items.count) \(items.count == 1 ? "step" : "steps")",
            runningCount: runningCount,
            completedCount: completedCount,
            failedCount: failedCount,
            startedAt: items.compactMap(\.startedAt).min(),
            updatedAt: items.compactMap(\.updatedAt).max(),
            completedAt: runningCount == 0 ? items.compactMap(\.completedAt).max() : nil,
            durationMs: items.compactMap(\.durationMs).max(),
            detail: ["grouping": .string("consecutive_non_task_tools")]
        )
    }

    private static func existingToolItem(
        name: String,
        callId: String?,
        in projection: RuntimeActivityProjection
    ) -> RuntimeActivityItem? {
        if let callId,
           let match = projection.items.last(where: { $0.kind == .tool && $0.toolCallId == callId }) {
            return match
        }
        return projection.items.last {
            $0.kind == .tool
                && $0.toolName == name
                && ($0.phase == .running || $0.phase == .pending)
        }
    }

    private static func activityKind(for event: RuntimeActivityProjectionEvent) -> RuntimeActivityKind {
        let gatewayEvent = gatewayEventType(for: event)
        let payload = payload(for: event)
        if gatewayEvent.hasPrefix("tool.") || event.type == .tool {
            return isTodoPayload(payload) ? .taskList : .tool
        }
        if gatewayEvent.hasPrefix("thinking.") || gatewayEvent.hasPrefix("reasoning.") || event.type == .thinking {
            return .thinking
        }
        switch event.type {
        case .queued, .started, .completed, .failed, .cancelled:
            return .terminal
        case .delta:
            return .message
        case .status:
            return .status
        case .context:
            return .context
        case .healthChanged:
            return .status
        case .tool, .thinking:
            return .status
        }
    }

    private static func phase(
        for event: RuntimeActivityProjectionEvent,
        defaultPhase: RuntimeActivityPhase
    ) -> RuntimeActivityPhase {
        let gatewayEvent = gatewayEventType(for: event)
        let status = [event.status, event.text, runtimeActivityStringValue(payload(for: event)["status"])]
            .compactMap { $0?.lowercased() }
            .joined(separator: " ")

        if event.type == .failed || status.contains("failed") || status.contains("error") {
            return .failed
        }
        if event.type == .cancelled || status.contains("cancel") {
            return .cancelled
        }
        if event.type == .completed || gatewayEvent == "tool.complete" || status.contains("completed") || status.contains("success") {
            return .completed
        }
        if event.type == .queued {
            return .pending
        }
        if event.type == .started {
            return .running
        }
        return defaultPhase
    }

    private static func task(from object: JSONRecord, index: Int, timestamp: IsoTimestamp) -> RuntimeActivityTask {
        let rawStatus = runtimeActivityStringValue(object["status"]) ?? RuntimeActivityTaskStatus.pending.rawValue
        let status = RuntimeActivityTaskStatus(rawValue: rawStatus) ?? .unknown
        return RuntimeActivityTask(
            id: runtimeActivityStringValue(object["id"]) ?? "todo-\(index + 1)",
            content: runtimeActivityStringValue(object["content"])
                ?? runtimeActivityStringValue(object["title"])
                ?? runtimeActivityStringValue(object["task"])
                ?? runtimeActivityStringValue(object["name"])
                ?? "Task \(index + 1)",
            status: status,
            statusRawValue: rawStatus,
            priority: intValue(object["priority"]),
            sourceToolCallId: "todo-live",
            startedAt: status == .inProgress ? timestamp : nil,
            updatedAt: timestamp,
            completedAt: status == .completed || status == .cancelled ? timestamp : nil,
            detail: redactRecord(object),
            compatibilityMetadata: ["source": .string("runtime_activity_task")]
        )
    }

    private static func taskListPhase(_ tasks: [RuntimeActivityTask]) -> RuntimeActivityPhase {
        guard !tasks.isEmpty else { return .running }
        if tasks.contains(where: { $0.status == .inProgress }) { return .running }
        if tasks.contains(where: { $0.status == .pending }) { return .pending }
        if tasks.allSatisfy({ $0.status == .completed }) { return .completed }
        if tasks.allSatisfy({ $0.status == .cancelled }) { return .cancelled }
        return .running
    }

    private static func taskListTitle(_ tasks: [RuntimeActivityTask]) -> String? {
        tasks.first(where: { $0.status == .inProgress })?.content
            ?? tasks.first(where: { $0.status == .pending })?.content
            ?? tasks.last?.content
    }

    private static func taskListSummary(_ tasks: [RuntimeActivityTask]) -> String? {
        guard !tasks.isEmpty else { return nil }
        let completed = tasks.filter { $0.status == .completed }.count
        return "\(completed)/\(tasks.count) completed"
    }

    private static func isTodoPayload(_ payload: JSONRecord) -> Bool {
        runtimeActivityStringValue(payload["name"]) == "todo" || arrayValue(payload["todos"]) != nil
    }

    private static func toolName(from payload: JSONRecord) -> String? {
        nonEmpty(runtimeActivityStringValue(payload["name"]))
            ?? nonEmpty(runtimeActivityStringValue(payload["tool"]))
            ?? nonEmpty(runtimeActivityStringValue(payload["toolName"]))
    }

    private static func toolCallId(from payload: JSONRecord) -> String? {
        nonEmpty(runtimeActivityStringValue(payload["tool_id"]))
            ?? nonEmpty(runtimeActivityStringValue(payload["toolCallId"]))
            ?? nonEmpty(runtimeActivityStringValue(payload["tool_call_id"]))
            ?? nonEmpty(runtimeActivityStringValue(payload["call_id"]))
            ?? nonEmpty(runtimeActivityStringValue(payload["id"]))
    }

    private static func toolError(from payload: JSONRecord, event: RuntimeActivityProjectionEvent) -> JSONRecord? {
        if let error = objectValue(payload["error"]) {
            return redactRecord(error)
        }
        let phase = phase(for: event, defaultPhase: .running)
        guard phase == .failed else { return nil }
        return ["message": .string(nonEmpty(event.status) ?? nonEmpty(event.text) ?? "Tool failed.")]
    }

    private static func gatewayEventType(for event: RuntimeActivityProjectionEvent) -> String {
        runtimeActivityStringValue(event.detail["gatewayEventType"]) ?? event.type.rawValue
    }

    private static func payload(for event: RuntimeActivityProjectionEvent) -> JSONRecord {
        objectValue(event.detail["payload"]) ?? event.detail
    }

    private static func activityId(_ dispatchId: RelayId, _ kind: String, _ key: String) -> RelayId {
        "\(dispatchId).\(kind).\(key)"
    }

    private static func projection(from value: JSONValue) -> RuntimeActivityProjection? {
        guard let data = try? JSONEncoder().encode(value) else { return nil }
        return try? JSONDecoder().decode(RuntimeActivityProjection.self, from: data)
    }

    private static func jsonRecord<T: Encodable>(_ value: T) -> JSONRecord {
        guard let data = try? JSONEncoder().encode(value),
              let jsonValue = try? JSONDecoder().decode(JSONValue.self, from: data),
              let record = objectValue(jsonValue)
        else {
            return [:]
        }
        return record
    }

    private static func appendUnique(_ existing: [RelayId], _ incoming: [RelayId]) -> [RelayId] {
        incoming.reduce(existing) { output, id in
            output.contains(id) ? output : output + [id]
        }
    }

    private static func mergeJSON(_ existing: JSONRecord, _ incoming: JSONRecord) -> JSONRecord {
        var output = existing
        for (key, value) in incoming {
            output[key] = value
        }
        return output
    }

    private static func isTerminalPhase(_ phase: RuntimeActivityPhase) -> Bool {
        phase == .completed || phase == .failed || phase == .cancelled
    }

    private static func nonEmpty(_ value: String?) -> String? {
        let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed?.isEmpty == false ? trimmed : nil
    }
}

private func runtimeActivityStringValue(_ value: JSONValue?) -> String? {
    guard let value else { return nil }
    switch value {
    case .string(let string):
        return string
    case .number(let number):
        return number.rounded(.towardZero) == number ? String(Int(number)) : String(number)
    case .bool(let bool):
        return bool ? "true" : "false"
    case .object, .array, .null:
        return nil
    }
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

private func objectValue(_ value: JSONValue?) -> JSONRecord? {
    guard case .object(let object)? = value else { return nil }
    return object
}

private func arrayValue(_ value: JSONValue?) -> [JSONValue]? {
    guard case .array(let array)? = value else { return nil }
    return array
}
