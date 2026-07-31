import Foundation
import RelayConsoleCore

@main
struct RelayConsoleEventReplayTests {
    static func main() throws {
        try run("active dispatch replay dedupes duplicate events", testActiveDispatchReplayDedupesDuplicateEvents)
        try run("runtime activity projection builds Hermes-style rows", testRuntimeActivityProjectionBuildsHermesStyleRows)
        try run("simple streamed replies remain todo free", testSimpleStreamedReplyRemainsTodoFree)
        try run("Hermes todo updates preserve live task statuses", testHermesTodoUpdatesPreserveLiveStatuses)
        try run("terminal replay reconciles posted message without duplicate output", testTerminalReplayReconcilesPostedMessage)
        try run("retryable failures require explicit retry-safety evidence", testRetryableFailuresRequireEvidence)
        try run("terminal reconciliation matches posted message id", testTerminalReconciliationMatchesPostedMessageId)
        try run("relaunch recovery restores selected dispatch and read state", testRelaunchRecoveryRestoresSelectedDispatchAndReadState)
        try run("delayed failure and cancel replay remain terminal", testDelayedFailureAndCancelReplayRemainTerminal)
        try run("event details are redacted during replay", testEventDetailsAreRedacted)
        try run("runtime event semantics cover current event types", testRuntimeEventSemanticsCoverCurrentEventTypes)
        try run("chat event replay dedupes local subscriber payloads", testChatEventReplayDedupesLocalSubscriberPayloads)
        try run("event replay fixture manifests match schema", testFixtureManifestsMatchSchema)
        print("RelayConsoleEventReplayTests passed")
    }

    private static func run(_ name: String, _ test: () throws -> Void) throws {
        do {
            try test()
            print("ok - \(name)")
        } catch {
            print("not ok - \(name): \(error)")
            throw error
        }
    }

    private static func testActiveDispatchReplayDedupesDuplicateEvents() throws {
        let dispatch = try decode(RuntimeDispatch.self, activeDispatchJSON)
        let queued = try decode(RuntimeEvent.self, activeQueuedEventJSON)
        let started = try decode(RuntimeEvent.self, activeStartedEventJSON)
        let delta = try decode(RuntimeEvent.self, activeDeltaEventJSON)

        var reducer = RuntimeReplayReducer(dispatches: [dispatch])
        _ = reducer.apply(queued)
        _ = reducer.apply(started)
        _ = reducer.apply(started)
        _ = reducer.apply(delta)

        let snapshot = reducer.snapshot(threadId: "thr-replay-active-001")
        let record = try unwrap(snapshot.record(dispatchId: "rtd-replay-active-001"), "missing active dispatch record")

        try expect(snapshot.dispatchCount == 1, "active dispatch should appear once")
        try expect(snapshot.duplicateEventIds == ["evt-replay-active-started-001"], "duplicate started event was not tracked")
        try expect(record.status == .streaming, "active replay should advance to streaming")
        try expect(record.eventIds == [
            "evt-replay-active-queued-001",
            "evt-replay-active-started-001",
            "evt-replay-active-delta-001"
        ], "active replay event sequence changed")
        try expect(record.draftText == "[REDACTED]", "active draft text was not preserved")
        try expect(record.terminalDisposition == .active, "active dispatch should not request terminal output")
        try expect(snapshot.terminalOutputCreationRequests == 0, "active replay requested terminal output")
    }

    private static func testRuntimeActivityProjectionBuildsHermesStyleRows() throws {
        var snapshot: JSONRecord = [:]
        for json in runtimeActivityProjectionEventJSONs {
            let event = try decode(RuntimeEvent.self, json)
            snapshot = RuntimeActivityProjector.snapshot(snapshot, applying: event)
        }

        let projection = RuntimeActivityProjector.projection(from: snapshot)
        try expect(snapshot["draftText"]?.string == "Hello world", "projection should preserve flattened draft text")
        try expect(snapshot["runtimeThinkingText"]?.string == "Inspecting files", "projection should preserve flattened thinking text")
        try expect(snapshot["runtimeToolSummary"]?.string == "Finished command", "projection should preserve flattened tool summary")
        try expect(snapshot["runtimeStatusMessage"]?.string == "Hermes Agent completed", "projection should preserve flattened status")
        try expect(projection.dispatchId == "rtd-replay-activity-001", "projection dispatch id should be set")
        try expect(projection.draftText == "Hello world", "projection draft text should accumulate deltas")
        try expect(projection.lastEventType == "message.complete", "projection should preserve gateway event type")

        let terminal = try unwrap(
            projection.items.first { $0.kind == .terminal },
            "projection missing terminal runtime row"
        )
        try expect(terminal.phase == .completed, "terminal row should complete on message.complete")

        let message = try unwrap(
            projection.items.first { $0.kind == .message },
            "projection missing streamed message row"
        )
        try expect(message.phase == .completed, "message row should be completed with terminal event")
        try expect(message.eventIds.contains("evt-replay-activity-delta-002"), "message row should retain later delta event id")

        let thinking = try unwrap(
            projection.items.first { $0.kind == .thinking },
            "projection missing thinking row"
        )
        try expect(thinking.summary == "Inspecting files", "thinking row should carry latest thinking text")

        let tool = try unwrap(
            projection.items.first { $0.kind == .tool && $0.toolName == "exec_command" },
            "projection missing exec command tool row"
        )
        try expect(tool.phase == .completed, "tool row should complete on tool.complete")
        try expect(tool.toolCallId == "call-tool-1", "tool row should keep stable tool call id")
        try expect(tool.eventIds == [
            "evt-replay-activity-tool-start-001",
            "evt-replay-activity-tool-progress-001",
            "evt-replay-activity-tool-complete-001"
        ], "tool row should upsert start/progress/complete events")
        try expect(tool.result?["exitCode"] == .number(0), "tool row should preserve result detail")

        let group = try unwrap(projection.toolGroups.first, "projection missing tool group")
        try expect(group.itemIds == [tool.id], "tool group should reference the visible tool row")
        try expect(group.phase == .completed, "tool group should complete when all tool rows complete")
        try expect(group.completedCount == 1 && group.runningCount == 0, "tool group counters should reflect completed tool")

        let taskList = try unwrap(
            projection.items.first { $0.kind == .taskList },
            "projection missing hoisted task-list row"
        )
        try expect(taskList.phase == .running, "task-list row should stay running with an in-progress task")
        try expect(taskList.eventIds == [
            "evt-replay-activity-todo-001",
            "evt-replay-activity-todo-sparse-001"
        ], "sparse todo updates should update row without clearing tasks")
        try expect(projection.tasks.count == 2, "todo payload should project two tasks")
        try expect(projection.tasks[0].status == .completed, "first todo should be completed")
        try expect(projection.tasks[1].status == .inProgress, "second todo should remain in progress after sparse update")
    }

    private static func testSimpleStreamedReplyRemainsTodoFree() throws {
        var projection = RuntimeActivityProjection()
        for event in [
            RuntimeActivityProjectionEvent(
                id: "evt-simple-thinking",
                dispatchId: "rtd-simple",
                type: .thinking,
                text: "(¬‿¬) musing...",
                status: "thinking.delta",
                detail: ["gatewayEventType": .string("thinking.delta")],
                timestamp: "2026-01-01T00:00:01Z"
            ),
            RuntimeActivityProjectionEvent(
                id: "evt-simple-delta-1",
                dispatchId: "rtd-simple",
                type: .delta,
                text: "Hello ",
                status: "streaming",
                detail: ["gatewayEventType": .string("message.delta")],
                timestamp: "2026-01-01T00:00:02Z"
            ),
            RuntimeActivityProjectionEvent(
                id: "evt-simple-delta-2",
                dispatchId: "rtd-simple",
                type: .delta,
                text: "there",
                status: "streaming",
                detail: ["gatewayEventType": .string("message.delta")],
                timestamp: "2026-01-01T00:00:03Z"
            )
        ] {
            projection = RuntimeActivityProjector.apply(event, to: projection)
        }

        try expect(projection.draftText == "Hello there", "simple reply should accumulate streamed text")
        try expect(projection.tasks.isEmpty, "thinking and answer deltas must not synthesize todos")
        try expect(
            !projection.items.contains { $0.kind == .taskList },
            "simple reply must not synthesize a task-list activity row"
        )
    }

    private static func testHermesTodoUpdatesPreserveLiveStatuses() throws {
        var projection = RuntimeActivityProjection()
        let initial = RuntimeActivityProjectionEvent(
            id: "evt-todo-initial",
            dispatchId: "rtd-todo-statuses",
            type: .tool,
            text: "Task list updated",
            status: "tool.complete",
            detail: [
                "gatewayEventType": .string("tool.complete"),
                "payload": .object([
                    "name": .string("todo"),
                    "todos": .array([
                        .object([
                            "id": .string("one"),
                            "content": .string("Inspect source"),
                            "status": .string("in_progress")
                        ]),
                        .object([
                            "id": .string("two"),
                            "content": .string("Implement change"),
                            "status": .string("pending")
                        ]),
                        .object([
                            "id": .string("three"),
                            "content": .string("Run verification"),
                            "status": .string("pending")
                        ])
                    ])
                ])
            ],
            timestamp: "2026-01-01T00:00:01Z"
        )
        projection = RuntimeActivityProjector.apply(initial, to: projection)

        let updated = RuntimeActivityProjectionEvent(
            id: "evt-todo-updated",
            dispatchId: "rtd-todo-statuses",
            type: .tool,
            text: "Task list updated",
            status: "tool.complete",
            detail: [
                "gatewayEventType": .string("tool.complete"),
                "payload": .object([
                    "name": .string("todo"),
                    "todos": .array([
                        .object([
                            "id": .string("one"),
                            "content": .string("Inspect source"),
                            "status": .string("completed")
                        ]),
                        .object([
                            "id": .string("two"),
                            "content": .string("Implement change"),
                            "status": .string("in_progress")
                        ]),
                        .object([
                            "id": .string("three"),
                            "content": .string("Run verification"),
                            "status": .string("cancelled")
                        ])
                    ])
                ])
            ],
            timestamp: "2026-01-01T00:00:02Z"
        )
        projection = RuntimeActivityProjector.apply(updated, to: projection)

        try expect(
            projection.tasks.map(\.status) == [.completed, .inProgress, .cancelled],
            "todo updates should replace pending state with the latest Hermes statuses"
        )
        let taskList = try unwrap(
            projection.items.first { $0.kind == .taskList },
            "updated projection missing task-list row"
        )
        try expect(taskList.phase == .running, "an in-progress todo should keep the card running")
        try expect(
            taskList.eventIds == ["evt-todo-initial", "evt-todo-updated"],
            "todo card should retain both update events"
        )
    }

    private static func testTerminalReplayReconcilesPostedMessage() throws {
        let dispatch = try decode(RuntimeDispatch.self, terminalDispatchJSON)
        let completed = try decode(RuntimeEvent.self, terminalCompletedEventJSON)
        let lateDelta = try decode(RuntimeEvent.self, terminalLateDeltaEventJSON)
        let message = try decode(Message.self, terminalMessageJSON)

        var reducer = RuntimeReplayReducer(dispatches: [dispatch])
        _ = reducer.apply(completed)
        let duplicate = reducer.apply(completed)
        let late = reducer.apply(lateDelta)
        reducer.reconcileMessages([message])

        let snapshot = reducer.snapshot(threadId: "thr-replay-terminal-001")
        let record = try unwrap(snapshot.record(dispatchId: "rtd-replay-terminal-001"), "missing terminal dispatch record")

        try expect(!duplicate.accepted && duplicate.duplicate, "duplicate terminal event should be ignored")
        try expect(late.ignoredBecauseTerminal, "late active event should not mutate terminal state")
        try expect(record.status == .completed, "terminal status should remain completed")
        try expect(record.terminalMessageId == "msg-replay-terminal-agent-001", "terminal message was not linked")
        try expect(record.terminalDisposition == .messageAlreadyPosted, "terminal replay should reuse posted message")
        try expect(!record.shouldCreateTerminalMessage, "terminal replay would duplicate agent output")
        try expect(snapshot.terminalOutputCreationRequests == 0, "terminal replay requested duplicate output")
    }

    private static func testRetryableFailuresRequireEvidence() throws {
        let dispatch = try decode(RuntimeDispatch.self, failedDispatchJSON)
        let missingEvidence = try decode(RuntimeEvent.self, failedRetryableWithoutEvidenceEventJSON)
        let withEvidence = try decode(RuntimeEvent.self, failedRetryableWithEvidenceEventJSON)

        var missingReducer = RuntimeReplayReducer(dispatches: [dispatch])
        _ = missingReducer.apply(missingEvidence)
        let missingRecord = try unwrap(
            missingReducer.snapshot().record(dispatchId: "rtd-replay-failed-001"),
            "missing failed record without evidence"
        )

        try expect(missingRecord.status == .failed, "failed retry fixture should be terminal")
        try expect(missingRecord.retrySafety.retryable, "retryable flag should be preserved")
        try expect(!missingRecord.retrySafety.canRetry, "retry should not be allowed without evidence id")
        try expect(missingRecord.terminalDisposition == .failureCard, "failed replay should produce failure-card disposition")

        var evidenceReducer = RuntimeReplayReducer(dispatches: [dispatch])
        _ = evidenceReducer.apply(withEvidence)
        let evidenceRecord = try unwrap(
            evidenceReducer.snapshot().record(dispatchId: "rtd-replay-failed-001"),
            "missing failed record with evidence"
        )

        try expect(evidenceRecord.retrySafety.canRetry, "retry should require and accept explicit evidence")
        try expect(evidenceRecord.retrySafety.evidenceId == "retry-safe-fixture-001", "retry evidence id was not preserved")
        try expect(evidenceRecord.retrySafety.attempt == 2, "retry attempt was not preserved")
    }

    private static func testTerminalReconciliationMatchesPostedMessageId() throws {
        let postedIdDispatch = try decode(RuntimeDispatch.self, postedIdCompletedDispatchJSON)
        let activeDispatch = try decode(RuntimeDispatch.self, activePostedMetadataDispatchJSON)
        let postedIdMessage = Message(
            id: "msg-replay-posted-id-agent-001",
            threadId: "thr-replay-posted-id-001",
            senderType: .agent,
            senderId: "agt-replay-001",
            senderName: "Replay Agent",
            content: "[REDACTED]",
            contentFormat: .plain,
            metadata: [:],
            createdAt: "2026-01-01T00:03:05Z"
        )
        let activeTerminalMessage = Message(
            id: "msg-replay-active-agent-001",
            threadId: "thr-replay-active-posted-001",
            senderType: .agent,
            senderId: "agt-replay-001",
            senderName: "Replay Agent",
            content: "[REDACTED]",
            contentFormat: .plain,
            metadata: ["dispatchId": .string("rtd-replay-active-posted-001")],
            createdAt: "2026-01-01T00:03:06Z"
        )

        var reducer = RuntimeReplayReducer(dispatches: [postedIdDispatch, activeDispatch])
        reducer.reconcileMessages([postedIdMessage, activeTerminalMessage])
        let postedSnapshot = reducer.snapshot(threadId: "thr-replay-posted-id-001")
        let activeSnapshot = reducer.snapshot(threadId: "thr-replay-active-posted-001")
        let postedRecord = try unwrap(
            postedSnapshot.record(dispatchId: "rtd-replay-posted-id-001"),
            "missing posted-id record"
        )
        let activeRecord = try unwrap(
            activeSnapshot.record(dispatchId: "rtd-replay-active-posted-001"),
            "missing active posted-message record"
        )

        try expect(postedRecord.terminalMessageId == postedIdMessage.id, "postedMessageId was not reconciled")
        try expect(postedRecord.terminalDisposition == .messageAlreadyPosted, "posted-id dispatch should not request output")
        try expect(postedSnapshot.terminalOutputCreationRequests == 0, "posted-id reconciliation would duplicate output")
        try expect(activeRecord.status == .completed, "active card should complete when posted agent message exists")
        try expect(activeRecord.terminalMessageId == activeTerminalMessage.id, "active posted message was not linked")
        try expect(activeRecord.terminalDisposition == .messageAlreadyPosted, "active posted message should close the card")
        try expect(activeSnapshot.terminalOutputCreationRequests == 0, "active reconciliation would duplicate output")
    }

    private static func testRelaunchRecoveryRestoresSelectedDispatchAndReadState() throws {
        let activeDispatch = try decode(RuntimeDispatch.self, activeDispatchJSON)
        let terminalDispatch = try decode(RuntimeDispatch.self, selectedTerminalDispatchJSON)
        let queued = try decode(RuntimeEvent.self, activeQueuedEventJSON)
        let started = try decode(RuntimeEvent.self, activeStartedEventJSON)
        let selectedThread = ThreadSummary(
            id: "thr-replay-active-001",
            workspaceId: "wks-replay-001",
            title: "Selected replay thread",
            selectedAgentId: "agt-replay-001",
            status: "active",
            readState: .read,
            unreadCount: 0,
            lastReadAt: "2026-01-01T00:04:00Z",
            createdAt: "2026-01-01T00:00:00Z",
            updatedAt: "2026-01-01T00:04:00Z"
        )
        let unreadThread = ThreadSummary(
            id: "thr-replay-unread-001",
            workspaceId: "wks-replay-001",
            title: "Unread replay thread",
            selectedAgentId: "agt-replay-001",
            status: "active",
            readState: .unread,
            unreadCount: 2,
            createdAt: "2026-01-01T00:00:00Z",
            updatedAt: "2026-01-01T00:04:00Z"
        )
        let postedMessage = Message(
            id: "msg-replay-selected-terminal-agent-001",
            threadId: "thr-replay-active-001",
            senderType: .agent,
            senderId: "agt-replay-001",
            senderName: "Replay Agent",
            content: "[REDACTED]",
            contentFormat: .plain,
            metadata: [:],
            createdAt: "2026-01-01T00:04:05Z"
        )

        let recovery = LocalEventReplayReconciler.recoverySnapshot(
            selectedThreadId: selectedThread.id,
            threads: [selectedThread, unreadThread],
            dispatches: [activeDispatch, terminalDispatch],
            events: [queued, started, started],
            messages: [postedMessage]
        )
        let selected = try unwrap(recovery.selectedThread, "missing selected thread recovery projection")
        let unread = try unwrap(
            recovery.threads.first { $0.threadId == unreadThread.id },
            "missing unread thread recovery projection"
        )

        try expect(selected.readState == .read, "selected relaunch read state should be restored")
        try expect(selected.unreadCount == 0, "selected relaunch unread count should stay cleared")
        try expect(selected.activeDispatchIds == ["rtd-replay-active-001"], "selected active dispatch was not restored")
        try expect(
            selected.recentTerminalDispatchIds == ["rtd-replay-selected-terminal-001"],
            "selected terminal dispatch was not reconciled"
        )
        try expect(selected.terminalOutputCreationRequests == 0, "relaunch recovery would duplicate terminal output")
        try expect(unread.readState == .unread && unread.unreadCount == 2, "unread thread state was not restored")
        try expect(
            recovery.duplicateRuntimeEventIds == ["evt-replay-active-started-001"],
            "relaunch recovery should retain duplicate replay evidence"
        )
    }

    private static func testDelayedFailureAndCancelReplayRemainTerminal() throws {
        let failedDispatch = try decode(RuntimeDispatch.self, failedDispatchJSON)
        let cancelledDispatch = try decode(RuntimeDispatch.self, cancelledDispatchJSON)
        let failed = try decode(RuntimeEvent.self, failedRetryableWithEvidenceEventJSON)
        let lateDelta = try decode(RuntimeEvent.self, failedLateDeltaEventJSON)
        let cancelled = try decode(RuntimeEvent.self, cancelledEventJSON)

        var reducer = RuntimeReplayReducer(dispatches: [failedDispatch, cancelledDispatch])
        _ = reducer.apply(failed)
        let late = reducer.apply(lateDelta)
        _ = reducer.apply(cancelled)
        let snapshot = reducer.snapshot()
        let failedRecord = try unwrap(snapshot.record(dispatchId: "rtd-replay-failed-001"), "missing failed replay record")
        let cancelledRecord = try unwrap(
            snapshot.record(dispatchId: "rtd-replay-cancelled-001"),
            "missing cancelled replay record"
        )

        try expect(late.ignoredBecauseTerminal, "late failed delta should be ignored after terminal failure")
        try expect(failedRecord.status == .failed, "failed replay should remain failed")
        try expect(failedRecord.terminalDisposition == .failureCard, "failed replay should stay a failure card")
        try expect(failedRecord.retrySafety.canRetry, "failed replay should preserve retry safety")
        try expect(cancelledRecord.status == .cancelled, "cancelled replay should remain cancelled")
        try expect(cancelledRecord.terminalDisposition == .cancelledCard, "cancelled replay should stay a cancelled card")
        try expect(snapshot.terminalOutputCreationRequests == 0, "failure/cancel replay should not request output")
    }

    private static func testEventDetailsAreRedacted() throws {
        let dispatch = try decode(RuntimeDispatch.self, failedDispatchJSON)
        let sensitiveValue = ["credential", "runtime-fixture-value"].joined(separator: "=")
        let event = try decode(RuntimeEvent.self, failedEventJSON(detailValue: sensitiveValue))

        var reducer = RuntimeReplayReducer(dispatches: [dispatch])
        _ = reducer.apply(event)

        let record = try unwrap(
            reducer.snapshot().record(dispatchId: "rtd-replay-failed-001"),
            "missing redaction record"
        )
        let detail = record.lastEventDetail["rawDetail"]?.string ?? ""

        try expect(detail.contains("[REDACTED]"), "runtime detail was not redacted")
        try expect(!detail.contains(sensitiveValue), "runtime detail leaked sensitive text")
    }

    private static func testRuntimeEventSemanticsCoverCurrentEventTypes() throws {
        let expected = [
            "queued",
            "started",
            "status",
            "delta",
            "thinking",
            "tool",
            "context",
            "completed",
            "failed",
            "cancelled",
            "health_changed"
        ]
        let actual = RuntimeReplaySemantics.all.map { $0.eventType.rawValue }

        try expect(actual == expected, "runtime replay semantic coverage changed")
        try expect(
            RuntimeReplaySemantics.semantic(for: .delta).preservesTextDelta,
            "delta events should preserve draft text"
        )
        try expect(
            RuntimeReplaySemantics.semantic(for: .completed).isTerminal,
            "completed events should be terminal"
        )
        try expect(
            RuntimeReplaySemantics.semantic(for: .healthChanged).isHealthSignal,
            "health events should be marked as health signals"
        )
    }

    private static func testChatEventReplayDedupesLocalSubscriberPayloads() throws {
        let message = try decode(ChatEventPayload.self, chatMessageEventJSON)
        let read = try decode(ChatEventPayload.self, chatReadEventJSON)
        let archive = try decode(ChatEventPayload.self, chatArchiveEventJSON)

        var reducer = ChatEventReplayReducer()
        let first = reducer.apply(message)
        let duplicate = reducer.apply(message)
        let readResult = reducer.apply(read)
        let archiveResult = reducer.apply(archive)
        let snapshot = reducer.snapshot()

        try expect(first.accepted && !first.duplicate, "first chat event should be accepted")
        try expect(!duplicate.accepted && duplicate.duplicate, "duplicate chat event should be ignored")
        try expect(readResult.accepted, "read-state event should be accepted")
        try expect(archiveResult.accepted, "archive event should be accepted")
        try expect(snapshot.eventCount == 3, "duplicate chat event should not increase event count")
        try expect(snapshot.threadIds == ["thr-chat-event-001"], "chat replay should project one thread")
        try expect(snapshot.messageIds == ["msg-chat-event-001"], "chat replay should project one message")
        try expect(snapshot.readStateIds == ["trs-chat-event-001"], "chat replay should project read state")
        try expect(snapshot.archivedThreadIds == ["thr-chat-event-001"], "chat replay should project archived thread")
    }

    private static func testFixtureManifestsMatchSchema() throws {
        for path in [
            "Tests/Fixtures/events/runtime/dispatch-active-started-replay-001/manifest.md",
            "Tests/Fixtures/events/runtime/dispatch-terminal-recent-replay-001/manifest.md",
            "Tests/Fixtures/events/runtime/dispatch-relaunch-recovery-001/manifest.md",
            "Tests/Fixtures/events/runtime/dispatch-delayed-terminal-reconciliation-001/manifest.md",
            "Tests/Fixtures/events/runtime/context-health-participant-001/manifest.md",
            "Tests/Fixtures/events/agentops/live-state-priority-001/manifest.md",
            "Tests/Fixtures/events/chat/thread-message-dedupe-001/manifest.md",
            "Tests/Fixtures/events/applications/slice-6-7-aggregation-relaunch-001/manifest.md",
            "Tests/Fixtures/events/work-safety/task-approval-foundation-relaunch-001/manifest.md",
            "Tests/Fixtures/events/work-safety/approval-task-transition-001/manifest.md"
        ] {
            let manifest = try readPackageFile(path)
            for field in requiredManifestFields {
                try expect(manifest.contains("\(field):"), "\(path) is missing \(field)")
            }
            try expect(manifest.contains("VC-0103"), "\(path) must link event replay command id")
            try expect(manifest.contains("layer: `event-replay`"), "\(path) must stay in event-replay layer")
            try expect(manifest.contains("noSimulatedRuntimeOutput:"), "\(path) must state runtime-output boundary")
            if path.contains("applications") {
                for expected in [
                    "ITC-0037",
                    "CODE-001-037",
                    "Demo 7",
                    "local app/source-host/generated-pack",
                    "Paperclip",
                    "status: `planned`"
                ] {
                    try expect(manifest.contains(expected), "\(path) missing runtime Applications aggregation field \(expected)")
                }
            }
            if path.contains("work-safety") {
                for expected in [
                    "ITC-0038",
                    "CODE-001-038",
                    "Demo 7",
                    "Demo 5",
                    "standalone Approvals",
                    "status: `planned`",
                    "task execution output"
                ] {
                    try expect(manifest.contains(expected), "\(path) missing work-safety aggregation field \(expected)")
                }
            }
            if path.contains("agentops") {
                for expected in [
                    "ITC-0052",
                    "CODE-001-051",
                    "Demo 3",
                    "Demo 8",
                    "runtime_dispatch",
                    "approval",
                    "message",
                    "agent_status",
                    "source:none",
                    "status: `verified`"
                ] {
                    try expect(manifest.contains(expected), "\(path) missing AgentOps event replay field \(expected)")
                }
            }
        }
    }

    private static func decode<T: Decodable>(_ type: T.Type, _ json: String) throws -> T {
        try decoder.decode(T.self, from: Data(json.utf8))
    }

    private static func readPackageFile(_ relativePath: String) throws -> String {
        let url = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
            .appendingPathComponent(relativePath)
        return try String(contentsOf: url, encoding: .utf8)
    }

    private static func expect(_ condition: @autoclosure () throws -> Bool, _ message: String) throws {
        guard try condition() else {
            throw EventReplayTestFailure(message)
        }
    }

    private static func unwrap<T>(_ value: T?, _ message: String) throws -> T {
        guard let value else {
            throw EventReplayTestFailure(message)
        }
        return value
    }
}

private let decoder = JSONDecoder()

private let requiredManifestFields = [
    "id",
    "layer",
    "productArea",
    "requirementIds",
    "sourceMapIds",
    "fixtureKind",
    "owner",
    "status",
    "secretsPolicy",
    "files",
    "expectedChecks",
    "determinism",
    "noFakeProductSeed",
    "noSimulatedRuntimeOutput",
    "noGeneratedWelcome",
    "privateStateExclusions",
    "redactionReview",
    "failureHandling"
]

private let activeDispatchJSON = """
{"id":"rtd-replay-active-001","threadId":"thr-replay-active-001","messageId":"msg-replay-active-user-001","agentId":"agt-replay-001","harnessId":"hrn-replay-001","sessionId":"rts-replay-active-001","status":"queued","correlationId":"corr-replay-active-001","inputSnapshot":{"content":"[REDACTED]","runtimeType":"hermes","attempt":1},"resultSnapshot":null,"errorSnapshot":null,"startedAt":null,"completedAt":null,"createdAt":"2026-01-01T00:00:00Z","updatedAt":"2026-01-01T00:00:00Z"}
"""

private let activeQueuedEventJSON = """
{"id":"evt-replay-active-queued-001","dispatchId":"rtd-replay-active-001","threadId":"thr-replay-active-001","agentId":"agt-replay-001","runtimeType":"hermes","type":"queued","text":null,"status":"queued","detail":{"correlationId":"corr-replay-active-001"},"timestamp":"2026-01-01T00:00:01Z"}
"""

private let activeStartedEventJSON = """
{"id":"evt-replay-active-started-001","dispatchId":"rtd-replay-active-001","threadId":"thr-replay-active-001","agentId":"agt-replay-001","runtimeType":"hermes","type":"started","text":null,"status":"started","detail":{"correlationId":"corr-replay-active-001"},"timestamp":"2026-01-01T00:00:02Z"}
"""

private let activeDeltaEventJSON = """
{"id":"evt-replay-active-delta-001","dispatchId":"rtd-replay-active-001","threadId":"thr-replay-active-001","agentId":"agt-replay-001","runtimeType":"hermes","type":"delta","text":"[REDACTED]","status":"streaming","detail":{"sequence":1,"correlationId":"corr-replay-active-001"},"timestamp":"2026-01-01T00:00:03Z"}
"""

private let runtimeActivityProjectionEventJSONs = [
    """
    {"id":"evt-replay-activity-started-001","dispatchId":"rtd-replay-activity-001","threadId":"thr-replay-activity-001","agentId":"agt-replay-001","runtimeType":"hermes","type":"started","text":null,"status":"Hermes Agent running","detail":{"gatewayEventType":"message.start","payload":{}},"timestamp":"2026-01-01T00:00:01Z"}
    """,
    """
    {"id":"evt-replay-activity-delta-001","dispatchId":"rtd-replay-activity-001","threadId":"thr-replay-activity-001","agentId":"agt-replay-001","runtimeType":"hermes","type":"delta","text":"Hello ","status":"streaming","detail":{"gatewayEventType":"message.delta","payload":{"text":"Hello "}},"timestamp":"2026-01-01T00:00:02Z"}
    """,
    """
    {"id":"evt-replay-activity-thinking-001","dispatchId":"rtd-replay-activity-001","threadId":"thr-replay-activity-001","agentId":"agt-replay-001","runtimeType":"hermes","type":"thinking","text":"Inspecting files","status":"thinking.delta","detail":{"gatewayEventType":"thinking.delta","payload":{"text":"Inspecting files"}},"timestamp":"2026-01-01T00:00:03Z"}
    """,
    """
    {"id":"evt-replay-activity-tool-start-001","dispatchId":"rtd-replay-activity-001","threadId":"thr-replay-activity-001","agentId":"agt-replay-001","runtimeType":"hermes","type":"tool","text":"Running command","status":"running","detail":{"gatewayEventType":"tool.start","payload":{"id":"call-tool-1","name":"exec_command","text":"Running command","status":"running","input":{"cmd":"[REDACTED]"}}},"timestamp":"2026-01-01T00:00:04Z"}
    """,
    """
    {"id":"evt-replay-activity-tool-progress-001","dispatchId":"rtd-replay-activity-001","threadId":"thr-replay-activity-001","agentId":"agt-replay-001","runtimeType":"hermes","type":"tool","text":"Read 2 files","status":"running","detail":{"gatewayEventType":"tool.progress","payload":{"id":"call-tool-1","name":"exec_command","text":"Read 2 files","status":"running"}},"timestamp":"2026-01-01T00:00:05Z"}
    """,
    """
    {"id":"evt-replay-activity-todo-001","dispatchId":"rtd-replay-activity-001","threadId":"thr-replay-activity-001","agentId":"agt-replay-001","runtimeType":"hermes","type":"tool","text":"Task list updated","status":"running","detail":{"gatewayEventType":"tool.progress","payload":{"name":"todo","todos":[{"id":"todo-1","content":"Read source","status":"completed"},{"id":"todo-2","content":"Update projection","status":"in_progress"}]}},"timestamp":"2026-01-01T00:00:06Z"}
    """,
    """
    {"id":"evt-replay-activity-todo-sparse-001","dispatchId":"rtd-replay-activity-001","threadId":"thr-replay-activity-001","agentId":"agt-replay-001","runtimeType":"hermes","type":"tool","text":"Task list refreshed","status":"running","detail":{"gatewayEventType":"tool.progress","payload":{"name":"todo","text":"Task list refreshed","status":"running"}},"timestamp":"2026-01-01T00:00:07Z"}
    """,
    """
    {"id":"evt-replay-activity-tool-complete-001","dispatchId":"rtd-replay-activity-001","threadId":"thr-replay-activity-001","agentId":"agt-replay-001","runtimeType":"hermes","type":"tool","text":"Finished command","status":"completed","detail":{"gatewayEventType":"tool.complete","payload":{"id":"call-tool-1","name":"exec_command","text":"Finished command","status":"completed","result":{"exitCode":0}}},"timestamp":"2026-01-01T00:00:08Z"}
    """,
    """
    {"id":"evt-replay-activity-delta-002","dispatchId":"rtd-replay-activity-001","threadId":"thr-replay-activity-001","agentId":"agt-replay-001","runtimeType":"hermes","type":"delta","text":"world","status":"streaming","detail":{"gatewayEventType":"message.delta","payload":{"text":"world"}},"timestamp":"2026-01-01T00:00:09Z"}
    """,
    """
    {"id":"evt-replay-activity-complete-001","dispatchId":"rtd-replay-activity-001","threadId":"thr-replay-activity-001","agentId":"agt-replay-001","runtimeType":"hermes","type":"completed","text":"Hello world","status":"Hermes Agent completed","detail":{"gatewayEventType":"message.complete","payload":{"status":"complete","text":"Hello world"}},"timestamp":"2026-01-01T00:00:10Z"}
    """
]

private let terminalDispatchJSON = """
{"id":"rtd-replay-terminal-001","threadId":"thr-replay-terminal-001","messageId":"msg-replay-terminal-user-001","agentId":"agt-replay-001","harnessId":"hrn-replay-001","sessionId":"rts-replay-terminal-001","status":"completed","correlationId":"corr-replay-terminal-001","inputSnapshot":{"content":"[REDACTED]","runtimeType":"hermes","attempt":1},"resultSnapshot":{"finalText":"[REDACTED]"},"errorSnapshot":null,"startedAt":"2026-01-01T00:01:00Z","completedAt":"2026-01-01T00:01:05Z","createdAt":"2026-01-01T00:01:00Z","updatedAt":"2026-01-01T00:01:05Z"}
"""

private let chatMessageEventJSON = """
{"id":"che-chat-event-message-001","eventName":"message.new","threadId":"thr-chat-event-001","workspaceId":"wks-chat-event-001","messageId":"msg-chat-event-001","sessionId":"chs-chat-event-001","readStateId":null,"wrapUpReportId":null,"dispatchId":null,"sourceRecordIds":{"threadId":"thr-chat-event-001","messageId":"msg-chat-event-001","sessionId":"chs-chat-event-001","readStateId":null,"wrapUpReportId":null},"detail":{"senderType":"user","contentFormat":"plain"},"timestamp":"2026-01-01T00:00:00Z"}
"""

private let chatReadEventJSON = """
{"id":"che-chat-event-read-001","eventName":"thread.read_state.update","threadId":"thr-chat-event-001","workspaceId":"wks-chat-event-001","messageId":null,"sessionId":"chs-chat-event-001","readStateId":"trs-chat-event-001","wrapUpReportId":null,"dispatchId":null,"sourceRecordIds":{"threadId":"thr-chat-event-001","messageId":null,"sessionId":"chs-chat-event-001","readStateId":"trs-chat-event-001","wrapUpReportId":null},"detail":{"action":"markRead"},"timestamp":"2026-01-01T00:00:01Z"}
"""

private let chatArchiveEventJSON = """
{"id":"che-chat-event-archive-001","eventName":"thread.archived","threadId":"thr-chat-event-001","workspaceId":"wks-chat-event-001","messageId":null,"sessionId":null,"readStateId":null,"wrapUpReportId":null,"dispatchId":null,"sourceRecordIds":{"threadId":"thr-chat-event-001","messageId":null,"sessionId":null,"readStateId":null,"wrapUpReportId":null},"detail":{"action":"archived"},"timestamp":"2026-01-01T00:00:02Z"}
"""

private let terminalCompletedEventJSON = """
{"id":"evt-replay-terminal-completed-001","dispatchId":"rtd-replay-terminal-001","threadId":"thr-replay-terminal-001","agentId":"agt-replay-001","runtimeType":"hermes","type":"completed","text":null,"status":"completed","detail":{"result":"[REDACTED]","correlationId":"corr-replay-terminal-001"},"timestamp":"2026-01-01T00:01:05Z"}
"""

private let terminalLateDeltaEventJSON = """
{"id":"evt-replay-terminal-delta-late-001","dispatchId":"rtd-replay-terminal-001","threadId":"thr-replay-terminal-001","agentId":"agt-replay-001","runtimeType":"hermes","type":"delta","text":"[REDACTED]","status":"streaming","detail":{"sequence":99,"correlationId":"corr-replay-terminal-001"},"timestamp":"2026-01-01T00:01:06Z"}
"""

private let terminalMessageJSON = """
{"id":"msg-replay-terminal-agent-001","threadId":"thr-replay-terminal-001","senderType":"agent","senderId":"agt-replay-001","senderName":"Replay Agent","content":"[REDACTED]","contentFormat":"plain","metadata":{"dispatchId":"rtd-replay-terminal-001"},"createdAt":"2026-01-01T00:01:05Z"}
"""

private let postedIdCompletedDispatchJSON = """
{"id":"rtd-replay-posted-id-001","threadId":"thr-replay-posted-id-001","messageId":"msg-replay-posted-id-user-001","agentId":"agt-replay-001","harnessId":"hrn-replay-001","sessionId":"rts-replay-posted-id-001","status":"completed","correlationId":"corr-replay-posted-id-001","inputSnapshot":{"content":"[REDACTED]","runtimeType":"hermes","attempt":1},"resultSnapshot":{"postedMessageId":"msg-replay-posted-id-agent-001","finalText":"[REDACTED]"},"errorSnapshot":null,"startedAt":"2026-01-01T00:03:00Z","completedAt":"2026-01-01T00:03:05Z","createdAt":"2026-01-01T00:03:00Z","updatedAt":"2026-01-01T00:03:05Z"}
"""

private let activePostedMetadataDispatchJSON = """
{"id":"rtd-replay-active-posted-001","threadId":"thr-replay-active-posted-001","messageId":"msg-replay-active-posted-user-001","agentId":"agt-replay-001","harnessId":"hrn-replay-001","sessionId":"rts-replay-active-posted-001","status":"streaming","correlationId":"corr-replay-active-posted-001","inputSnapshot":{"content":"[REDACTED]","runtimeType":"hermes","attempt":1},"resultSnapshot":{"draftText":"[REDACTED]"},"errorSnapshot":null,"startedAt":"2026-01-01T00:03:00Z","completedAt":null,"createdAt":"2026-01-01T00:03:00Z","updatedAt":"2026-01-01T00:03:04Z"}
"""

private let selectedTerminalDispatchJSON = """
{"id":"rtd-replay-selected-terminal-001","threadId":"thr-replay-active-001","messageId":"msg-replay-selected-terminal-user-001","agentId":"agt-replay-001","harnessId":"hrn-replay-001","sessionId":"rts-replay-selected-terminal-001","status":"completed","correlationId":"corr-replay-selected-terminal-001","inputSnapshot":{"content":"[REDACTED]","runtimeType":"hermes","attempt":1},"resultSnapshot":{"postedMessageId":"msg-replay-selected-terminal-agent-001","finalText":"[REDACTED]"},"errorSnapshot":null,"startedAt":"2026-01-01T00:04:00Z","completedAt":"2026-01-01T00:04:05Z","createdAt":"2026-01-01T00:04:00Z","updatedAt":"2026-01-01T00:04:05Z"}
"""

private let failedDispatchJSON = """
{"id":"rtd-replay-failed-001","threadId":"thr-replay-failed-001","messageId":"msg-replay-failed-user-001","agentId":"agt-replay-001","harnessId":"hrn-replay-001","sessionId":"rts-replay-failed-001","status":"started","correlationId":"corr-replay-failed-001","inputSnapshot":{"content":"[REDACTED]","runtimeType":"hermes","attempt":1},"resultSnapshot":null,"errorSnapshot":null,"startedAt":"2026-01-01T00:02:00Z","completedAt":null,"createdAt":"2026-01-01T00:02:00Z","updatedAt":"2026-01-01T00:02:01Z"}
"""

private let failedRetryableWithoutEvidenceEventJSON = """
{"id":"evt-replay-failed-no-evidence-001","dispatchId":"rtd-replay-failed-001","threadId":"thr-replay-failed-001","agentId":"agt-replay-001","runtimeType":"hermes","type":"failed","text":null,"status":"failed","detail":{"retryable":true,"attempt":1,"category":"network"},"timestamp":"2026-01-01T00:02:02Z"}
"""

private let failedRetryableWithEvidenceEventJSON = """
{"id":"evt-replay-failed-with-evidence-001","dispatchId":"rtd-replay-failed-001","threadId":"thr-replay-failed-001","agentId":"agt-replay-001","runtimeType":"hermes","type":"failed","text":null,"status":"failed","detail":{"retryable":true,"retrySafetyEvidenceId":"retry-safe-fixture-001","attempt":2,"category":"network"},"timestamp":"2026-01-01T00:02:03Z"}
"""

private let failedLateDeltaEventJSON = """
{"id":"evt-replay-failed-delta-late-001","dispatchId":"rtd-replay-failed-001","threadId":"thr-replay-failed-001","agentId":"agt-replay-001","runtimeType":"hermes","type":"delta","text":"[REDACTED]","status":"streaming","detail":{"sequence":22,"correlationId":"corr-replay-failed-001"},"timestamp":"2026-01-01T00:02:04Z"}
"""

private let cancelledDispatchJSON = """
{"id":"rtd-replay-cancelled-001","threadId":"thr-replay-cancelled-001","messageId":"msg-replay-cancelled-user-001","agentId":"agt-replay-001","harnessId":"hrn-replay-001","sessionId":"rts-replay-cancelled-001","status":"started","correlationId":"corr-replay-cancelled-001","inputSnapshot":{"content":"[REDACTED]","runtimeType":"hermes","attempt":1},"resultSnapshot":null,"errorSnapshot":null,"startedAt":"2026-01-01T00:05:00Z","completedAt":null,"createdAt":"2026-01-01T00:05:00Z","updatedAt":"2026-01-01T00:05:01Z"}
"""

private let cancelledEventJSON = """
{"id":"evt-replay-cancelled-001","dispatchId":"rtd-replay-cancelled-001","threadId":"thr-replay-cancelled-001","agentId":"agt-replay-001","runtimeType":"hermes","type":"cancelled","text":null,"status":"cancelled","detail":{"category":"cancelled","attempt":1},"timestamp":"2026-01-01T00:05:02Z"}
"""

private func failedEventJSON(detailValue: String) -> String {
    """
    {"id":"evt-replay-failed-redaction-001","dispatchId":"rtd-replay-failed-001","threadId":"thr-replay-failed-001","agentId":"agt-replay-001","runtimeType":"hermes","type":"failed","text":null,"status":"failed","detail":{"retryable":false,"rawDetail":"\(detailValue)"},"timestamp":"2026-01-01T00:02:04Z"}
    """
}

private struct EventReplayTestFailure: Error, CustomStringConvertible {
    var description: String
    init(_ description: String) {
        self.description = description
    }
}
