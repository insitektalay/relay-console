// WebSocketClient.swift
// ClawChat – Production WebSocket client
// Swift 6, @Observable, async/await, auto-reconnect

import Foundation

// MARK: - WebSocketClient

@Observable
@MainActor
final class WebSocketClient: NSObject, URLSessionWebSocketDelegate {

    // MARK: - Shared

    static let shared = WebSocketClient()

    // MARK: - Public State

    var isConnected: Bool = false
    var connectionState: ConnectionState = .idle

    enum ConnectionState: Sendable {
        case idle
        case connecting
        case connected
        case reconnecting
        case failed
    }

    // MARK: - Event Type

    enum Event: Sendable {
        case messageNew(Message)
        case messageUpdate(Message)
        case threadUpdate(Thread)
        case agentUpdate(Agent)
        case agentStatusChanged(agentId: String, status: AgentStatus)
        case taskUpdate(Task)
        case approvalNew(Approval)
        case incidentNew(Incident)
        case alertNew(Alert)
        case typingStart(threadId: String, senderId: String)
        case typingStop(threadId: String, senderId: String)
        case connected
        case disconnected
        case error(any Error)
        case dispatchQueued(AgentDispatch)
        case dispatchStarted(AgentDispatch)
        case dispatchCompleted(AgentDispatch)
        case dispatchFailed(AgentDispatch)
        case dispatchCancelled(dispatchId: String)
        case runDelta(threadId: String, runId: String, content: String)
        case runStatus(threadId: String, runId: String, status: String)
        case runTool(threadId: String, runId: String, toolName: String)
        case runtimeDispatchStarted(RuntimeDispatchEventPayload)
        case runtimeDispatchCompleted(RuntimeDispatchEventPayload)
        case runtimeDispatchFailed(RuntimeDispatchFailedPayload)
        case runtimeDispatchCancelled(RuntimeDispatchEventPayload)
        case runtimeRunDelta(RuntimeRunDeltaPayload)
        case runtimeRunThinking(RuntimeRunThinkingPayload)
        case runtimeRunStatus(RuntimeRunStatusPayload)
        case runtimeRunTool(RuntimeRunToolPayload)
        case participantHealth(agentId: String, status: AgentStatus)
        case sessionRevoked
    }

    // MARK: - Private Properties

    private var webSocketTask: URLSessionWebSocketTask?
    private var urlSession: URLSession?
    private var pingTimer: Timer?
    @ObservationIgnored private var receiveTask: _Concurrency.Task<Void, Never>?

    private var currentTicket: String?
    private var currentWorkspaceId: String?
    private var subscribedThreadIds: Set<String> = []

    // Handlers: stored as (id, handler) so we can remove by id
    private var eventHandlers: [(id: UUID, handler: @Sendable (Event) -> Void)] = []

    private var wsBaseURL: URL { AppRuntimeConfig.webSocketBaseURL }

    // MARK: - Init

    private override init() {
        super.init()
    }

    // MARK: - Public API

    func connect(ticket: String, workspaceId: String) {
        // No-op if already connected with the same credentials
        if isConnected && currentTicket == ticket && currentWorkspaceId == workspaceId {
            return
        }
        currentTicket = ticket
        currentWorkspaceId = workspaceId
        Telemetry.shared.breadcrumb(
            "WebSocket connect requested",
            category: "ws.connect",
            attributes: ["workspaceId": workspaceId]
        )
        performConnect()
    }

    func disconnect() {
        receiveTask?.cancel()
        receiveTask = nil
        stopPing()
        webSocketTask?.cancel(with: .normalClosure, reason: nil)
        webSocketTask = nil
        urlSession?.invalidateAndCancel()
        urlSession = nil
        isConnected = false
        connectionState = .idle
        currentTicket = nil
        subscribedThreadIds.removeAll()
        Telemetry.shared.breadcrumb("WebSocket disconnected by client", category: "ws.disconnect")
        emit(.disconnected)
    }

    func subscribe(to threadId: String) {
        subscribedThreadIds.insert(threadId)
        guard isConnected else { return }
        sendControl(type: "subscribe_thread", payload: ["threadId": threadId])
    }

    func unsubscribe(from threadId: String) {
        subscribedThreadIds.remove(threadId)
        guard isConnected else { return }
        sendControl(type: "unsubscribe_thread", payload: ["threadId": threadId])
    }

    func sendTypingIndicator(threadId: String, isTyping: Bool) async {
        guard isConnected else { return }
        sendControl(type: isTyping ? "typing_start" : "typing_stop", payload: ["threadId": threadId])
    }

    /// Returns an unsubscribe closure.
    func onEvent(_ handler: @escaping @Sendable (Event) -> Void) -> () -> Void {
        let id = UUID()
        eventHandlers.append((id: id, handler: handler))
        return { [weak self] in
            self?.eventHandlers.removeAll { $0.id == id }
        }
    }

    // MARK: - URLSessionWebSocketDelegate

    nonisolated func urlSession(
        _ session: URLSession,
        webSocketTask: URLSessionWebSocketTask,
        didOpenWithProtocol protocol: String?
    ) {
        _Concurrency.Task { @MainActor in
            self.sendAuthentication()
            self.scheduleReceive()
        }
    }

    nonisolated func urlSession(
        _ session: URLSession,
        webSocketTask: URLSessionWebSocketTask,
        didCloseWith closeCode: URLSessionWebSocketTask.CloseCode,
        reason: Data?
    ) {
        _Concurrency.Task { @MainActor in
            self.handleDisconnect(
                diagnosticData: reason ?? Data(),
                diagnosticType: "close.reason",
                closeCode: closeCode
            )
        }
    }

    nonisolated func urlSession(
        _ session: URLSession,
        task: URLSessionTask,
        didCompleteWithError error: (any Error)?
    ) {
        guard let error else { return }
        _Concurrency.Task { @MainActor in
            self.emit(.error(error))
            self.handleDisconnect(error: error, closeCode: .abnormalClosure)
        }
    }

    // MARK: - Private: Connect

    private func performConnect() {
        guard currentTicket != nil else { return }

        // Cancel any existing connection before opening a new one
        receiveTask?.cancel()
        receiveTask = nil
        stopPing()
        webSocketTask?.cancel(with: .goingAway, reason: nil)
        webSocketTask = nil
        urlSession?.invalidateAndCancel()
        urlSession = nil

        connectionState = .connecting

        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        let session = URLSession(configuration: config, delegate: self, delegateQueue: nil)
        urlSession = session

        let task = session.webSocketTask(with: wsBaseURL)
        webSocketTask = task
        task.resume()
    }

    // MARK: - Private: Receive Loop

    private func scheduleReceive() {
        receiveTask?.cancel()
        receiveTask = _Concurrency.Task { [weak self] in
            await self?.receiveLoop()
        }
    }

    private func receiveLoop() async {
        while !_Concurrency.Task.isCancelled, let task = webSocketTask {
            do {
                let message = try await task.receive()
                await handleRawMessage(message)
            } catch {
                if !_Concurrency.Task.isCancelled {
                    emit(.error(error))
                    handleDisconnect(error: error, closeCode: .abnormalClosure)
                }
                break
            }
        }
    }

    // MARK: - Private: Disconnect & Reconnect

    private func handleDisconnect(
        diagnosticData: Data,
        diagnosticType: String,
        closeCode: URLSessionWebSocketTask.CloseCode
    ) {
        stopPing()
        isConnected = false
        webSocketTask = nil

        connectionState = .failed
        var attributes = TelemetryPrivacy.websocketDiagnosticMetadata(
            diagnosticData,
            eventType: diagnosticType
        )
        attributes["status"] = "\(closeCode.rawValue)"
        Telemetry.shared.capture(
            message: "WebSocket disconnected",
            level: .warning,
            attributes: attributes
        )
        emit(.disconnected)
    }

    private func handleDisconnect(
        error: any Error,
        closeCode: URLSessionWebSocketTask.CloseCode
    ) {
        let errorKind = TelemetryPrivacy.errorKind(error)
        handleDisconnect(
            diagnosticData: Data(errorKind.utf8),
            diagnosticType: "transport.error",
            closeCode: closeCode
        )
    }

    // MARK: - Private: Ping

    private func startPing() {
        stopPing()
        pingTimer = Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { [weak self] _ in
            _Concurrency.Task { @MainActor [weak self] in
                self?.sendPing()
            }
        }
    }

    private func stopPing() {
        pingTimer?.invalidate()
        pingTimer = nil
    }

    private func sendPing() {
        webSocketTask?.sendPing { [weak self] error in
            if let error {
                _Concurrency.Task { @MainActor [weak self] in
                    self?.emit(.error(error))
                }
            }
        }
    }

    // MARK: - Private: Send Control Messages

    private func sendControl(type: String, payload: [String: String]) {
        var dict: [String: Any] = ["type": type]
        dict.merge(payload) { _, new in new }
        guard let data = try? JSONSerialization.data(withJSONObject: dict),
              let str = String(data: data, encoding: .utf8) else { return }
        webSocketTask?.send(.string(str)) { _ in }
    }

    private func sendAuthentication() {
        guard let ticket = currentTicket else { return }
        sendControl(type: "authenticate", payload: ["token": ticket])
    }

    private func resubscribeAll() {
        // Subscribe to workspace
        if let workspaceId = currentWorkspaceId {
            sendControl(type: "subscribe_workspace", payload: ["workspaceId": workspaceId])
        }
        // Re-subscribe to any open threads
        for threadId in subscribedThreadIds {
            sendControl(type: "subscribe_thread", payload: ["threadId": threadId])
        }
    }

    // MARK: - Private: Message Parsing

    private func handleRawMessage(_ message: URLSessionWebSocketTask.Message) async {
        let data: Data
        switch message {
        case .string(let str):
            guard let d = str.data(using: .utf8) else { return }
            data = d
        case .data(let d):
            data = d
        @unknown default:
            return
        }

        guard let envelope = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let type = envelope["type"] as? String else {
            Telemetry.shared.capture(
                message: "Could not parse websocket envelope",
                attributes: TelemetryPrivacy.websocketDiagnosticMetadata(
                    data,
                    eventType: "unparseable"
                )
            )
            return
        }

        let normalizedType = normalizedEventType(type)
        Telemetry.shared.breadcrumb(
            "WebSocket event received",
            category: "ws.event",
            attributes: TelemetryPrivacy.websocketDiagnosticMetadata(
                data,
                eventType: normalizedType
            )
        )

        let decoder = APIClient.decoder
        // Support both {"data": {...}} and the envelope itself as the payload
        let dataValue = envelope["data"] ?? envelope
        let payload = (try? JSONSerialization.data(withJSONObject: dataValue)) ?? Data()

        switch normalizedType {
        case "authenticated":
            isConnected = true
            connectionState = .connected
            currentTicket = nil
            startPing()
            resubscribeAll()
            Telemetry.shared.breadcrumb(
                "WebSocket authenticated",
                category: "ws.open",
                attributes: ["workspaceId": currentWorkspaceId ?? ""]
            )
            emit(.connected)
        case "message.new":
            if let msg = try? decoder.decode(Message.self, from: payload) {
                emit(.messageNew(msg))
            } else {
                Telemetry.shared.capture(
                    message: "WebSocket message.new decode failed",
                    attributes: TelemetryPrivacy.websocketDiagnosticMetadata(
                        payload,
                        eventType: "message.new"
                    )
                )
            }
        case "message.update":
            if let msg = try? decoder.decode(Message.self, from: payload) {
                emit(.messageUpdate(msg))
            } else {
                Telemetry.shared.capture(message: "WebSocket message.update decode failed")
            }
        case "thread.update":
            if let thread = try? decoder.decode(Thread.self, from: payload) {
                emit(.threadUpdate(thread))
            }
        case "agent.update":
            if let agent = try? decoder.decode(Agent.self, from: payload) {
                emit(.agentUpdate(agent))
            } else {
                Telemetry.shared.capture(message: "WebSocket agent.update decode failed")
            }
        case "agent.status_changed":
            if let agentId = (envelope["data"] as? [String: Any])?["agent_id"] as? String,
               let statusRaw = (envelope["data"] as? [String: Any])?["status"] as? String,
               let status = AgentStatus(rawValue: statusRaw) {
                emit(.agentStatusChanged(agentId: agentId, status: status))
            }
        case "task.update":
            if let task = try? decoder.decode(Task.self, from: payload) {
                emit(.taskUpdate(task))
            }
        case "approval.new":
            if let approval = try? decoder.decode(Approval.self, from: payload) {
                emit(.approvalNew(approval))
            }
        case "incident.new":
            if let incident = try? decoder.decode(Incident.self, from: payload) {
                emit(.incidentNew(incident))
            }
        case "alert.new":
            if let alert = try? decoder.decode(Alert.self, from: payload) {
                emit(.alertNew(alert))
            }
        case "typing.start", "typing:start":
            // Support both "typing.start" and "typing:start" formats
            let d = envelope["data"] as? [String: Any] ?? envelope
            if let threadId = (d["thread_id"] ?? d["threadId"]) as? String,
               let senderId = (d["sender_id"] ?? d["userId"] ?? d["senderId"]) as? String {
                emit(.typingStart(threadId: threadId, senderId: senderId))
            }
        case "typing.stop", "typing:stop":
            let d = envelope["data"] as? [String: Any] ?? envelope
            if let threadId = (d["thread_id"] ?? d["threadId"]) as? String,
               let senderId = (d["sender_id"] ?? d["userId"] ?? d["senderId"]) as? String {
                emit(.typingStop(threadId: threadId, senderId: senderId))
            }
        case "dispatch.queued":
            if let dispatch = try? decoder.decode(AgentDispatch.self, from: payload) {
                emit(.dispatchQueued(dispatch))
            }
        case "dispatch.started":
            if let dispatch = try? decoder.decode(AgentDispatch.self, from: payload) {
                emit(.dispatchStarted(dispatch))
            }
        case "dispatch.completed":
            if let dispatch = try? decoder.decode(AgentDispatch.self, from: payload) {
                emit(.dispatchCompleted(dispatch))
            }
        case "dispatch.failed":
            if let dispatch = try? decoder.decode(AgentDispatch.self, from: payload) {
                emit(.dispatchFailed(dispatch))
            }
        case "dispatch.cancelled":
            let d = envelope["data"] as? [String: Any] ?? envelope
            if let dispatchId = (d["dispatch_id"] ?? d["id"]) as? String {
                emit(.dispatchCancelled(dispatchId: dispatchId))
            }
        case "run.delta":
            let d = envelope["data"] as? [String: Any] ?? envelope
            if let threadId = (d["thread_id"] ?? d["threadId"]) as? String,
               let runId = (d["run_id"] ?? d["runId"]) as? String,
               let content = d["content"] as? String {
                emit(.runDelta(threadId: threadId, runId: runId, content: content))
            }
        case "run.status":
            let d = envelope["data"] as? [String: Any] ?? envelope
            if let threadId = (d["thread_id"] ?? d["threadId"]) as? String,
               let runId = (d["run_id"] ?? d["runId"]) as? String,
               let status = d["status"] as? String {
                emit(.runStatus(threadId: threadId, runId: runId, status: status))
            }
        case "run.tool":
            let d = envelope["data"] as? [String: Any] ?? envelope
            if let threadId = (d["thread_id"] ?? d["threadId"]) as? String,
               let runId = (d["run_id"] ?? d["runId"]) as? String,
               let toolName = (d["tool_name"] ?? d["tool"]) as? String {
                emit(.runTool(threadId: threadId, runId: runId, toolName: toolName))
            }
        case "runtime.dispatch.started":
            if let event = try? decoder.decode(RuntimeDispatchEventPayload.self, from: payload) {
                emit(.runtimeDispatchStarted(event))
            }
        case "runtime.dispatch.completed":
            if let event = try? decoder.decode(RuntimeDispatchEventPayload.self, from: payload) {
                emit(.runtimeDispatchCompleted(event))
            }
        case "runtime.dispatch.failed":
            if let event = try? decoder.decode(RuntimeDispatchFailedPayload.self, from: payload) {
                emit(.runtimeDispatchFailed(event))
            }
        case "runtime.dispatch.cancelled":
            if let event = try? decoder.decode(RuntimeDispatchEventPayload.self, from: payload) {
                emit(.runtimeDispatchCancelled(event))
            }
        case "runtime.run.delta":
            if let event = try? decoder.decode(RuntimeRunDeltaPayload.self, from: payload) {
                emit(.runtimeRunDelta(event))
            }
        case "runtime.run.thinking":
            if let event = try? decoder.decode(RuntimeRunThinkingPayload.self, from: payload) {
                emit(.runtimeRunThinking(event))
            }
        case "runtime.run.status":
            if let event = try? decoder.decode(RuntimeRunStatusPayload.self, from: payload) {
                emit(.runtimeRunStatus(event))
            }
        case "runtime.run.tool":
            if let event = try? decoder.decode(RuntimeRunToolPayload.self, from: payload) {
                emit(.runtimeRunTool(event))
            }
        case "participant.health":
            let d = envelope["data"] as? [String: Any] ?? envelope
            if let agentId = (d["agent_id"] ?? d["agentId"]) as? String,
               let statusRaw = d["status"] as? String,
               let status = AgentStatus(rawValue: statusRaw) {
                emit(.participantHealth(agentId: agentId, status: status))
            }
        case "session.revoked":
            emit(.sessionRevoked)
        default:
            break
        }
    }

    private func normalizedEventType(_ type: String) -> String {
        switch type {
        case "message:created", "message.created":
            return "message.new"
        case "message:updated":
            return "message.update"
        case "thread:updated":
            return "thread.update"
        case "agent:updated", "agent.updated":
            return "agent.update"
        case "typing:start":
            return "typing.start"
        case "typing:stop":
            return "typing.stop"
        case "dispatch:queued":
            return "dispatch.queued"
        case "dispatch:started":
            return "dispatch.started"
        case "dispatch:completed":
            return "dispatch.completed"
        case "dispatch:failed":
            return "dispatch.failed"
        case "dispatch:cancelled":
            return "dispatch.cancelled"
        default:
            return type
        }
    }

    // MARK: - Private: Emit

    private func emit(_ event: Event) {
        for item in eventHandlers {
            item.handler(event)
        }
    }
}
