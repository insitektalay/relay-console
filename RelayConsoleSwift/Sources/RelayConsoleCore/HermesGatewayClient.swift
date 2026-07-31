import Foundation

struct HermesGatewaySession: Sendable, Equatable {
    var liveSessionId: String
    var storedSessionId: String
}

struct HermesGatewayTurnResult: Sendable, Equatable {
    var status: String
    var text: String
    var metadata: JSONRecord
}

enum HermesGatewayError: Error, LocalizedError, Equatable {
    case processLaunchFailed(String)
    case processExited(Int32)
    case protocolError(String)
    case requestTimedOut(String)
    case rpcError(code: Int, message: String)
    case turnFailed(String)

    var errorDescription: String? {
        switch self {
        case .processLaunchFailed(let message):
            return message
        case .processExited(let status):
            return "Hermes gateway exited with status \(status)."
        case .protocolError(let message):
            return message
        case .requestTimedOut(let method):
            return "Hermes gateway request timed out: \(method)."
        case .rpcError(_, let message):
            return message
        case .turnFailed(let message):
            return message
        }
    }
}

final class HermesGatewayClient: @unchecked Sendable {
    private static let maximumProtocolLineBytes = 256 * 1_024
    private static let maximumDiagnosticBytes = 64 * 1_024
    private static let maximumTurnTextBytes = 2 * 1_024 * 1_024

    private struct PendingRequest {
        var continuation: CheckedContinuation<JSONRecord, Error>
        var timeout: DispatchWorkItem
        var method: String
    }

    private struct ActiveTurn {
        var request: RuntimeDispatchRequest
        var sink: RuntimeEventSink
        var continuation: CheckedContinuation<HermesGatewayTurnResult, Error>
        var timeout: DispatchWorkItem
        var accumulatedText: String
        var eventTail: Task<Void, Never>?
    }

    private let pythonPath: String
    private let harnessPath: URL
    private let hermesHome: URL
    private let launchCwd: URL
    private let env: [String: String]
    private let lock = NSLock()

    private var process: Process?
    private var stdinHandle: FileHandle?
    private var stdoutRemainder = ""
    private var stderrRemainder = ""
    private var stderrTail = ""
    private var pending: [String: PendingRequest] = [:]
    private var activeTurns: [String: ActiveTurn] = [:]

    init(pythonPath: String, harnessPath: URL, hermesHome: URL, launchCwd: URL, env: [String: String]) {
        self.pythonPath = pythonPath
        self.harnessPath = harnessPath
        self.hermesHome = hermesHome
        self.launchCwd = launchCwd
        self.env = env
    }

    func createSession(title: String, cwd: URL, timeoutMs: Int = 120_000) async throws -> HermesGatewaySession {
        let result = try await request(
            method: "session.create",
            params: [
                "cols": .number(100),
                "cwd": .string(cwd.path),
                "title": .string(title)
            ],
            timeoutMs: timeoutMs
        )
        guard let liveSessionId = stringValue(result["session_id"]),
              let storedSessionId = stringValue(result["stored_session_id"])
        else {
            throw HermesGatewayError.protocolError("Hermes gateway did not return a session id.")
        }
        return HermesGatewaySession(liveSessionId: liveSessionId, storedSessionId: storedSessionId)
    }

    func resumeSession(storedSessionId: String, timeoutMs: Int = 120_000) async throws -> HermesGatewaySession {
        let result = try await request(
            method: "session.resume",
            params: [
                "cols": .number(100),
                "session_id": .string(storedSessionId)
            ],
            timeoutMs: timeoutMs
        )
        guard let liveSessionId = stringValue(result["session_id"]) else {
            throw HermesGatewayError.protocolError("Hermes gateway did not return a resumed session id.")
        }
        let sessionKey = stringValue(result["session_key"]) ?? stringValue(result["resumed"]) ?? storedSessionId
        return HermesGatewaySession(liveSessionId: liveSessionId, storedSessionId: sessionKey)
    }

    func sessionUsage(sessionId: String, timeoutMs: Int = 10_000) async throws -> JSONRecord {
        try await request(
            method: "session.usage",
            params: ["session_id": .string(sessionId)],
            timeoutMs: timeoutMs
        )
    }

    func setSessionYolo(sessionId: String, enabled: Bool, timeoutMs: Int = 10_000) async throws {
        _ = try await request(
            method: "config.set",
            params: [
                "key": .string("yolo"),
                "session_id": .string(sessionId),
                "value": .string(enabled ? "on" : "off")
            ],
            timeoutMs: timeoutMs
        )
    }

    func respondToApproval(
        sessionId: String,
        decision: RuntimeApprovalDecision,
        timeoutMs: Int = 10_000
    ) async throws {
        _ = try await request(
            method: "approval.respond",
            params: [
                "session_id": .string(sessionId),
                "choice": .string(decision.rawValue)
            ],
            timeoutMs: timeoutMs
        )
    }

    func submitPrompt(sessionId: String, text: String, imagePaths: [String] = [], request: RuntimeDispatchRequest, sink: RuntimeEventSink, timeoutMs: Int) async throws -> HermesGatewayTurnResult {
        try await withCheckedThrowingContinuation { continuation in
            let timeout = DispatchWorkItem { [weak self] in
                self?.failActiveTurn(sessionId: sessionId, error: HermesGatewayError.requestTimedOut("prompt.submit"))
            }
            let turn = ActiveTurn(
                request: request,
                sink: sink,
                continuation: continuation,
                timeout: timeout,
                accumulatedText: "",
                eventTail: nil
            )
            lock.lock()
            activeTurns[sessionId] = turn
            lock.unlock()
            DispatchQueue.global().asyncAfter(deadline: .now() + .milliseconds(max(timeoutMs, 1_000)), execute: timeout)

            Task {
                do {
                    for imagePath in imagePaths {
                        _ = try await self.request(
                            method: "image.attach",
                            params: [
                                "session_id": .string(sessionId),
                                "path": .string(imagePath)
                            ],
                            timeoutMs: 30_000
                        )
                    }
                    _ = try await self.request(
                        method: "prompt.submit",
                        params: [
                            "session_id": .string(sessionId),
                            "text": .string(text)
                        ],
                        timeoutMs: min(max(timeoutMs, 30_000), 120_000)
                    )
                } catch {
                    self.failActiveTurn(sessionId: sessionId, error: error)
                }
            }
        }
    }

    func interrupt(sessionId: String) async -> Bool {
        do {
            _ = try await request(
                method: "session.interrupt",
                params: ["session_id": .string(sessionId)],
                timeoutMs: 10_000
            )
            return true
        } catch {
            return false
        }
    }

    func stop() {
        let processToStop: Process?
        let requests: [PendingRequest]
        let turns: [ActiveTurn]
        lock.lock()
        processToStop = process
        process = nil
        stdinHandle = nil
        requests = Array(pending.values)
        turns = Array(activeTurns.values)
        pending.removeAll()
        activeTurns.removeAll()
        lock.unlock()

        for request in requests {
            request.timeout.cancel()
            request.continuation.resume(throwing: HermesGatewayError.processExited(processToStop?.terminationStatus ?? -1))
        }
        for turn in turns {
            turn.timeout.cancel()
            turn.continuation.resume(throwing: HermesGatewayError.processExited(processToStop?.terminationStatus ?? -1))
        }
        if processToStop?.isRunning == true {
            processToStop?.terminate()
        }
    }

    private func request(method: String, params: JSONRecord, timeoutMs: Int) async throws -> JSONRecord {
        try await withCheckedThrowingContinuation { continuation in
            do {
                let id = "relay-\(UUID().uuidString)"
                let envelope: JSONRecord = [
                    "jsonrpc": .string("2.0"),
                    "id": .string(id),
                    "method": .string(method),
                    "params": .object(params)
                ]
                let data = try jsonLine(envelope)
                let timeout = DispatchWorkItem { [weak self] in
                    self?.failPendingRequest(id: id, error: HermesGatewayError.requestTimedOut(method))
                }
                try startIfNeeded()
                lock.lock()
                pending[id] = PendingRequest(continuation: continuation, timeout: timeout, method: method)
                let handle = stdinHandle
                lock.unlock()
                DispatchQueue.global().asyncAfter(deadline: .now() + .milliseconds(max(timeoutMs, 1_000)), execute: timeout)
                handle?.write(data)
            } catch {
                continuation.resume(throwing: error)
            }
        }
    }

    private func startIfNeeded() throws {
        lock.lock()
        if process?.isRunning == true, stdinHandle != nil {
            lock.unlock()
            return
        }
        process = nil
        stdinHandle = nil
        stdoutRemainder = ""
        stderrRemainder = ""
        stderrTail = ""
        let executable: URL
        do {
            executable = try ProcessExecutionPolicy.validateExecutable(
                pythonPath,
                authorization: .pythonVirtualEnvironment(harnessRoot: harnessPath)
            )
        } catch {
            lock.unlock()
            throw HermesGatewayError.processLaunchFailed(
                "The Hermes Agent Python environment failed executable validation."
            )
        }
        let newProcess = Process()
        let stdinPipe = Pipe()
        let stdoutPipe = Pipe()
        let stderrPipe = Pipe()
        newProcess.executableURL = executable
        newProcess.arguments = ["-m", "tui_gateway.entry"]
        newProcess.currentDirectoryURL = launchCwd
        var processEnv = env
        processEnv["HERMES_HOME"] = hermesHome.path
        processEnv["HERMES_PYTHON_SRC_ROOT"] = harnessPath.path
        processEnv["HERMES_SESSION_SOURCE"] = "relay_console"
        newProcess.environment = CommandExecutionEnvironment.sanitized(processEnv)
        newProcess.standardInput = stdinPipe
        newProcess.standardOutput = stdoutPipe
        newProcess.standardError = stderrPipe
        stdoutPipe.fileHandleForReading.readabilityHandler = { [weak self] handle in
            self?.appendStdout(handle.availableData)
        }
        stderrPipe.fileHandleForReading.readabilityHandler = { [weak self] handle in
            self?.appendStderr(handle.availableData)
        }
        newProcess.terminationHandler = { [weak self] finished in
            stdoutPipe.fileHandleForReading.readabilityHandler = nil
            stderrPipe.fileHandleForReading.readabilityHandler = nil
            self?.handleProcessExit(status: finished.terminationStatus)
        }
        process = newProcess
        stdinHandle = stdinPipe.fileHandleForWriting
        lock.unlock()

        do {
            try newProcess.run()
        } catch {
            lock.lock()
            if process === newProcess {
                process = nil
                stdinHandle = nil
            }
            lock.unlock()
            throw HermesGatewayError.processLaunchFailed(
                "The Hermes gateway executable could not be launched."
            )
        }
    }

    private func appendStdout(_ data: Data) {
        guard !data.isEmpty, let text = String(data: data, encoding: .utf8) else { return }
        let lines: [String]
        let exceededLimit: Bool
        lock.lock()
        let parts = (stdoutRemainder + text).components(separatedBy: "\n")
        stdoutRemainder = parts.last ?? ""
        lines = Array(parts.dropLast())
        exceededLimit = Data(stdoutRemainder.utf8).count > Self.maximumProtocolLineBytes
            || lines.contains { Data($0.utf8).count > Self.maximumProtocolLineBytes }
        if exceededLimit {
            stdoutRemainder = ""
        }
        lock.unlock()
        if exceededLimit {
            stopForOutputViolation()
            return
        }
        for line in lines {
            handleStdoutLine(line)
        }
    }

    private func appendStderr(_ data: Data) {
        guard !data.isEmpty, let text = String(data: data, encoding: .utf8) else { return }
        let exceededLimit: Bool
        lock.lock()
        stderrTail = CommandOutputRedactor.redact(
            String((stderrTail + text).suffix(Self.maximumDiagnosticBytes))
        )
        let parts = (stderrRemainder + text).components(separatedBy: "\n")
        stderrRemainder = parts.last ?? ""
        exceededLimit = Data(stderrRemainder.utf8).count > Self.maximumProtocolLineBytes
        if exceededLimit {
            stderrRemainder = ""
        }
        lock.unlock()
        if exceededLimit {
            stopForOutputViolation()
        }
    }

    private func handleStdoutLine(_ line: String) {
        guard let data = line.data(using: .utf8),
              let frame = try? jsonDecoder.decode(JSONRecord.self, from: data)
        else { return }

        if stringValue(frame["method"]) == "event", let params = objectValue(frame["params"]) {
            handleEvent(params)
            return
        }

        guard let id = stringValue(frame["id"]) else { return }
        let pendingRequest: PendingRequest?
        lock.lock()
        pendingRequest = pending.removeValue(forKey: id)
        lock.unlock()
        guard let pendingRequest else { return }
        pendingRequest.timeout.cancel()

        if let result = objectValue(frame["result"]) {
            pendingRequest.continuation.resume(returning: result)
        } else if let error = objectValue(frame["error"]) {
            let code = intValue(error["code"]) ?? -1
            let message = trimForStorage(
                CommandOutputRedactor.redact(
                    stringValue(error["message"]) ?? "Hermes gateway request failed."
                )
            )
            pendingRequest.continuation.resume(
                throwing: HermesGatewayError.rpcError(code: code, message: message)
            )
        } else {
            pendingRequest.continuation.resume(throwing: HermesGatewayError.protocolError("Hermes gateway returned a malformed response for \(pendingRequest.method)."))
        }
    }

    private func handleEvent(_ params: JSONRecord) {
        guard let type = stringValue(params["type"]) else { return }
        let sessionId = stringValue(params["session_id"]) ?? ""
        let payload = objectValue(params["payload"]) ?? [:]

        switch type {
        case "gateway.ready":
            return
        case "message.delta":
            let text = stringValue(payload["text"]) ?? ""
            guard appendTurnText(text, sessionId: sessionId) else {
                failActiveTurn(
                    sessionId: sessionId,
                    error: HermesGatewayError.turnFailed(
                        "Hermes gateway output exceeded the permitted size."
                    )
                )
                return
            }
            emitActiveTurnEvent(sessionId: sessionId, type: .delta, text: text, status: nil, detail: gatewayEventDetail(type: type, payload: payload))
        case "message.complete":
            completeActiveTurn(sessionId: sessionId, payload: payload)
        case "error":
            let message = trimForStorage(
                CommandOutputRedactor.redact(
                    stringValue(payload["message"]) ?? "Hermes Agent run failed."
                )
            )
            failActiveTurn(sessionId: sessionId, error: HermesGatewayError.turnFailed(message))
        case "status.update":
            emitActiveTurnEvent(sessionId: sessionId, type: .status, text: stringValue(payload["text"]), status: stringValue(payload["kind"]) ?? stringValue(payload["text"]), detail: gatewayEventDetail(type: type, payload: payload))
        case "approval.request":
            handleApprovalRequest(sessionId: sessionId, payload: payload)
        case "thinking.delta", "reasoning.delta", "reasoning.available":
            emitActiveTurnEvent(sessionId: sessionId, type: .thinking, text: stringValue(payload["text"]), status: stringValue(payload["kind"]) ?? type, detail: gatewayEventDetail(type: type, payload: payload))
        case "tool.start", "tool.delta", "tool.progress", "tool.generating", "tool.complete":
            emitActiveTurnEvent(sessionId: sessionId, type: .tool, text: stringValue(payload["text"]) ?? stringValue(payload["name"]), status: stringValue(payload["status"]) ?? type, detail: gatewayEventDetail(type: type, payload: payload))
        case "message.start":
            emitActiveTurnEvent(sessionId: sessionId, type: .started, status: "Hermes Agent running", detail: gatewayEventDetail(type: type, payload: payload))
        default:
            emitActiveTurnEvent(sessionId: sessionId, type: .status, text: stringValue(payload["text"]), status: type, detail: gatewayEventDetail(type: type, payload: payload))
        }
    }

    private func updateActiveTurn(sessionId: String, update: (inout ActiveTurn) -> Void) {
        lock.lock()
        if var turn = activeTurns[sessionId] {
            update(&turn)
            activeTurns[sessionId] = turn
        }
        lock.unlock()
    }

    private func appendTurnText(_ text: String, sessionId: String) -> Bool {
        lock.lock()
        defer { lock.unlock() }
        guard var turn = activeTurns[sessionId] else {
            return false
        }
        let currentBytes = Data(turn.accumulatedText.utf8).count
        let additionalBytes = Data(text.utf8).count
        guard additionalBytes <= Self.maximumTurnTextBytes,
              currentBytes <= Self.maximumTurnTextBytes - additionalBytes
        else { return false }
        turn.accumulatedText += text
        activeTurns[sessionId] = turn
        return true
    }

    private func stopForOutputViolation() {
        lock.lock()
        let process = process
        lock.unlock()
        if let process {
            ProcessExecutionPolicy.terminate(process)
        }
    }

    private func emitActiveTurnEvent(sessionId: String, type: RuntimeEventType, text: String? = nil, status: String? = nil, detail: JSONRecord) {
        lock.lock()
        guard var turn = activeTurns[sessionId] else {
            lock.unlock()
            return
        }
        let previous = turn.eventTail
        let event = bridgeEvent(turn.request, type, text: text, status: status, detail: detail)
        let sink = turn.sink
        let task = Task {
            await previous?.value
            await sink.emit(event)
        }
        turn.eventTail = task
        activeTurns[sessionId] = turn
        lock.unlock()
    }

    private func handleApprovalRequest(sessionId: String, payload: JSONRecord) {
        let turn: ActiveTurn?
        lock.lock()
        turn = activeTurns[sessionId]
        lock.unlock()
        guard let turn else { return }

        var detail = gatewayEventDetail(type: "approval.request", payload: payload)
        detail["approvalState"] = .string("pending")
        detail["approvalMode"] = .string(turn.request.approvalMode.rawValue)
        let description = stringValue(payload["description"]) ?? "Hermes requested approval for a potentially unsafe action."
        emitActiveTurnEvent(
            sessionId: sessionId,
            type: .status,
            text: description,
            status: "Approval required",
            detail: detail
        )

        // Full access normally suppresses this event through the per-session
        // yolo setting. Resolve defensively if an approval was already queued
        // while the mode changed; safer modes remain user-decided in the UI.
        guard turn.request.approvalMode == .fullAccess else { return }
        Task {
            do {
                try await self.respondToApproval(
                    sessionId: sessionId,
                    decision: .allowOnce
                )
                var resolvedDetail = detail
                resolvedDetail["gatewayEventType"] = .string("approval.responded")
                resolvedDetail["approvalState"] = .string("approved")
                resolvedDetail["approvalDecision"] = .string(RuntimeApprovalDecision.allowOnce.rawValue)
                self.emitActiveTurnEvent(
                    sessionId: sessionId,
                    type: .status,
                    text: "Hermes approval handled automatically.",
                    status: "Approval granted",
                    detail: resolvedDetail
                )
            } catch {
                self.failActiveTurn(sessionId: sessionId, error: error)
            }
        }
    }

    private func completeActiveTurn(sessionId: String, payload: JSONRecord) {
        let turn: ActiveTurn?
        lock.lock()
        turn = activeTurns.removeValue(forKey: sessionId)
        lock.unlock()
        guard let turn else { return }
        turn.timeout.cancel()

        let gatewayStatus = stringValue(payload["status"]) ?? "complete"
        let text = stringValue(payload["text"]) ?? turn.accumulatedText
        var detail = gatewayEventDetail(type: "message.complete", payload: payload)
        detail["gatewayStatus"] = .string(gatewayStatus)

        if gatewayStatus == "complete" {
            Task {
                await turn.eventTail?.value
                if let usage = objectValue(payload["usage"]),
                   let context = RuntimeContextUsageMapper.hermesContextUsage(
                    from: usage,
                    dispatchId: turn.request.dispatchId,
                    source: "hermes_gateway_message_complete"
                   ) {
                    await turn.sink.emit(bridgeEvent(turn.request, .context, status: "Hermes context usage updated", detail: context))
                }
                await turn.sink.emit(bridgeEvent(turn.request, .completed, text: text, status: "Hermes Agent completed", detail: detail))
                turn.continuation.resume(returning: HermesGatewayTurnResult(status: "completed", text: text, metadata: detail))
            }
        } else {
            let message = text.isEmpty ? "Hermes Agent run failed." : text
            Task {
                await turn.eventTail?.value
                await turn.sink.emit(bridgeEvent(turn.request, .failed, text: text.isEmpty ? nil : text, status: message, detail: detail))
                turn.continuation.resume(returning: HermesGatewayTurnResult(status: "failed", text: message, metadata: detail))
            }
        }
    }

    private func failPendingRequest(id: String, error: Error) {
        let request: PendingRequest?
        lock.lock()
        request = pending.removeValue(forKey: id)
        lock.unlock()
        guard let request else { return }
        request.timeout.cancel()
        request.continuation.resume(throwing: error)
    }

    private func failActiveTurn(sessionId: String, error: Error) {
        let turn: ActiveTurn?
        lock.lock()
        turn = activeTurns.removeValue(forKey: sessionId)
        lock.unlock()
        guard let turn else { return }
        turn.timeout.cancel()
        turn.continuation.resume(throwing: error)
    }

    private func handleProcessExit(status: Int32) {
        let requests: [PendingRequest]
        let turns: [ActiveTurn]
        lock.lock()
        requests = Array(pending.values)
        turns = Array(activeTurns.values)
        pending.removeAll()
        activeTurns.removeAll()
        process = nil
        stdinHandle = nil
        lock.unlock()

        let error = HermesGatewayError.processExited(status)
        for request in requests {
            request.timeout.cancel()
            request.continuation.resume(throwing: error)
        }
        for turn in turns {
            turn.timeout.cancel()
            turn.continuation.resume(throwing: error)
        }
    }

    private func jsonLine(_ record: JSONRecord) throws -> Data {
        var data = try jsonEncoder.encode(record)
        data.append(0x0A)
        return data
    }

    private func gatewayEventDetail(type: String, payload: JSONRecord) -> JSONRecord {
        [
            "harness": .string("hermes"),
            "gatewayEventType": .string(type),
            "payload": .object(payload)
        ]
    }
}

private func objectValue(_ value: JSONValue?) -> JSONRecord? {
    guard case .object(let object)? = value else { return nil }
    return object
}

private func intValue(_ value: JSONValue?) -> Int? {
    guard let value else { return nil }
    switch value {
    case .number(let number):
        return Int(number)
    case .string(let string):
        return Int(string)
    default:
        return nil
    }
}
