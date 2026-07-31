import Foundation
import Network

public struct GoogleOAuthLoopbackCallback: Equatable, Sendable {
    public var state: String
    public var code: String?
    public var error: String?
    public var errorDescription: String?
    public var redirectURI: String
    public var receivedAt: Date
}

public final class GoogleOAuthLoopbackCallbackService: @unchecked Sendable {
    public static let shared = GoogleOAuthLoopbackCallbackService()

    private let lock = NSLock()
    private let queue = DispatchQueue(label: "relay.google-oauth.loopback-callback")
    private var listener: NWListener?
    private var pendingByState: [String: PendingSession] = [:]
    private var callbacksByState: [String: GoogleOAuthLoopbackCallback] = [:]

    private init() {}

    public func prepareGoogleDocsSession(
        workspaceId: RelayId,
        clientId: String,
        redirectURI: String
    ) throws -> String {
        try prepareGoogleSession(
            workspaceId: workspaceId,
            clientId: clientId,
            redirectURI: redirectURI,
            statePrefix: "relay-google-docs",
            flowName: "Google Docs"
        )
    }

    public func prepareGoogleCalendarSession(
        workspaceId: RelayId,
        clientId: String,
        redirectURI: String
    ) throws -> String {
        try prepareGoogleSession(
            workspaceId: workspaceId,
            clientId: clientId,
            redirectURI: redirectURI,
            statePrefix: "relay-google-calendar",
            flowName: "Google Calendar"
        )
    }

    public func prepareGoogleDriveSession(
        workspaceId: RelayId,
        clientId: String,
        redirectURI: String
    ) throws -> String {
        try prepareGoogleSession(
            workspaceId: workspaceId,
            clientId: clientId,
            redirectURI: redirectURI,
            statePrefix: "relay-google-drive",
            flowName: "Google Drive"
        )
    }

    public func prepareGoogleSearchConsoleSession(
        workspaceId: RelayId,
        clientId: String,
        redirectURI: String
    ) throws -> String {
        try prepareGoogleSession(
            workspaceId: workspaceId,
            clientId: clientId,
            redirectURI: redirectURI,
            statePrefix: "relay-google-search-console",
            flowName: "Google Search Console"
        )
    }

    public func preparePostHogSession(
        workspaceId: RelayId,
        clientId: String,
        redirectURI: String
    ) throws -> String {
        try prepareGoogleSession(
            workspaceId: workspaceId,
            clientId: clientId,
            redirectURI: redirectURI,
            statePrefix: "relay-posthog",
            flowName: "PostHog"
        )
    }

    public func prepareGoogleAnalyticsSession(
        workspaceId: RelayId,
        clientId: String,
        redirectURI: String
    ) throws -> String {
        try prepareGoogleSession(
            workspaceId: workspaceId,
            clientId: clientId,
            redirectURI: redirectURI,
            statePrefix: "relay-google-analytics",
            flowName: "Google Analytics"
        )
    }

    private func prepareGoogleSession(
        workspaceId: RelayId,
        clientId: String,
        redirectURI: String,
        statePrefix: String,
        flowName: String
    ) throws -> String {
        try ensureListener(for: redirectURI)
        let state = "\(statePrefix)-\(UUID().uuidString)"
        lock.lock()
        pendingByState[state] = PendingSession(
            workspaceId: workspaceId,
            clientId: clientId,
            redirectURI: redirectURI,
            flowName: flowName,
            createdAt: Date()
        )
        lock.unlock()
        return state
    }

    public func consumeGoogleDocsCallback(
        workspaceId: RelayId,
        clientId: String,
        state: String? = nil,
        timeoutSeconds: TimeInterval = 90
    ) -> GoogleOAuthLoopbackCallback? {
        consumeGoogleCallback(
            workspaceId: workspaceId,
            clientId: clientId,
            state: state,
            timeoutSeconds: timeoutSeconds
        )
    }

    public func consumeGoogleCalendarCallback(
        workspaceId: RelayId,
        clientId: String,
        state: String? = nil,
        timeoutSeconds: TimeInterval = 90
    ) -> GoogleOAuthLoopbackCallback? {
        consumeGoogleCallback(
            workspaceId: workspaceId,
            clientId: clientId,
            state: state,
            timeoutSeconds: timeoutSeconds
        )
    }

    public func consumeGoogleDriveCallback(
        workspaceId: RelayId,
        clientId: String,
        state: String? = nil,
        timeoutSeconds: TimeInterval = 90
    ) -> GoogleOAuthLoopbackCallback? {
        consumeGoogleCallback(
            workspaceId: workspaceId,
            clientId: clientId,
            state: state,
            timeoutSeconds: timeoutSeconds
        )
    }

    public func consumeGoogleSearchConsoleCallback(
        workspaceId: RelayId,
        clientId: String,
        state: String? = nil,
        timeoutSeconds: TimeInterval = 90
    ) -> GoogleOAuthLoopbackCallback? {
        consumeGoogleCallback(
            workspaceId: workspaceId,
            clientId: clientId,
            state: state,
            timeoutSeconds: timeoutSeconds
        )
    }

    public func consumePostHogCallback(
        workspaceId: RelayId,
        clientId: String,
        state: String? = nil,
        timeoutSeconds: TimeInterval = 90
    ) -> GoogleOAuthLoopbackCallback? {
        consumeGoogleCallback(
            workspaceId: workspaceId,
            clientId: clientId,
            state: state,
            timeoutSeconds: timeoutSeconds
        )
    }

    public func consumeGoogleAnalyticsCallback(
        workspaceId: RelayId,
        clientId: String,
        state: String? = nil,
        timeoutSeconds: TimeInterval = 90
    ) -> GoogleOAuthLoopbackCallback? {
        consumeGoogleCallback(
            workspaceId: workspaceId,
            clientId: clientId,
            state: state,
            timeoutSeconds: timeoutSeconds
        )
    }

    private func consumeGoogleCallback(
        workspaceId: RelayId,
        clientId: String,
        state: String?,
        timeoutSeconds: TimeInterval
    ) -> GoogleOAuthLoopbackCallback? {
        let deadline = Date().addingTimeInterval(timeoutSeconds)
        repeat {
            if let callback = consumeReadyCallback(workspaceId: workspaceId, clientId: clientId, state: state) {
                return callback
            }
            Thread.sleep(forTimeInterval: 0.25)
        } while Date() < deadline
        return nil
    }

    private func consumeReadyCallback(
        workspaceId: RelayId,
        clientId: String,
        state requestedState: String?
    ) -> GoogleOAuthLoopbackCallback? {
        lock.lock()
        defer { lock.unlock() }
        purgeExpiredSessionsLocked()
        let match = callbacksByState.first { state, callback in
            guard requestedState == nil || requestedState == state,
                  let pending = pendingByState[state],
                  pending.workspaceId == workspaceId,
                  pending.clientId == clientId
            else {
                return false
            }
            return callback.code != nil || callback.error != nil
        }
        guard let (state, callback) = match else { return nil }
        callbacksByState.removeValue(forKey: state)
        pendingByState.removeValue(forKey: state)
        return callback
    }

    private func ensureListener(for redirectURI: String) throws {
        lock.lock()
        let alreadyListening = listener != nil
        lock.unlock()
        guard !alreadyListening else { return }

        guard let components = URLComponents(string: redirectURI),
              let host = components.host,
              let portValue = components.port,
              host == "127.0.0.1" || host == "localhost"
        else {
            throw RelayError(.invalidInput, "Relay can only auto-capture Google OAuth callbacks on localhost redirect URLs.")
        }

        let parameters = NWParameters.tcp
        parameters.allowLocalEndpointReuse = true
        let nextListener = try NWListener(using: parameters, on: NWEndpoint.Port(integerLiteral: NWEndpoint.Port.IntegerLiteralType(portValue)))
        nextListener.newConnectionHandler = { [weak self] connection in
            self?.handle(connection)
        }
        nextListener.stateUpdateHandler = { state in
            if case .failed = state {
                nextListener.cancel()
            }
        }
        nextListener.start(queue: queue)

        lock.lock()
        listener = nextListener
        lock.unlock()
    }

    private func handle(_ connection: NWConnection) {
        connection.start(queue: queue)
        connection.receive(minimumIncompleteLength: 1, maximumLength: 8192) { [weak self] data, _, _, _ in
            guard let self else {
                connection.cancel()
                return
            }
            let request = data.flatMap { String(data: $0, encoding: .utf8) } ?? ""
            let callback = self.callback(from: request)
            let body = self.record(callback)
            self.respond(body: body, connection: connection)
        }
    }

    private func callback(from request: String) -> GoogleOAuthLoopbackCallback? {
        guard let firstLine = request.components(separatedBy: "\r\n").first,
              let target = firstLine.split(separator: " ").dropFirst().first,
              let components = URLComponents(string: "http://127.0.0.1\(target)")
        else {
            return nil
        }
        let items = components.queryItems ?? []
        guard let state = nonEmpty(items.first(where: { $0.name == "state" })?.value) else {
            return nil
        }
        let redirectURI = "http://127.0.0.1\(components.path)"
        return GoogleOAuthLoopbackCallback(
            state: state,
            code: nonEmpty(items.first(where: { $0.name == "code" })?.value),
            error: nonEmpty(items.first(where: { $0.name == "error" })?.value),
            errorDescription: nonEmpty(items.first(where: { $0.name == "error_description" })?.value),
            redirectURI: redirectURI,
            receivedAt: Date()
        )
    }

    private func record(_ callback: GoogleOAuthLoopbackCallback?) -> String {
        guard let callback else {
            return htmlPage(
                title: "Relay Console did not receive a Google code",
                body: "The OAuth callback did not include the Relay state value. Return to Relay Console and restart the consent step."
            )
        }
        lock.lock()
        let pending = pendingByState[callback.state]
        if let pending {
            var storedCallback = callback
            storedCallback.redirectURI = pending.redirectURI
            callbacksByState[callback.state] = storedCallback
        }
        lock.unlock()

        if pending == nil {
            return htmlPage(
                title: "Relay Console did not recognize this Google callback",
                body: "Return to Relay Console and restart the Google consent step."
            )
        }
        let flowName = pending?.flowName ?? "Google"
        if let error = callback.error {
            return htmlPage(
                title: "\(flowName) consent was not completed",
                body: "Google returned \(escapeHTML(error))\(callback.errorDescription.map { ": \(escapeHTML($0))" } ?? ""). Return to Relay Console."
            )
        }
        return htmlPage(
            title: "\(flowName) authorization received",
            body: "Relay Console captured the Google authorization code. You can return to Relay Console now."
        )
    }

    private func respond(body: String, connection: NWConnection) {
        let response = """
        HTTP/1.1 200 OK\r
        Content-Type: text/html; charset=utf-8\r
        Content-Length: \(Data(body.utf8).count)\r
        Connection: close\r
        \r
        \(body)
        """
        connection.send(content: Data(response.utf8), completion: .contentProcessed { _ in
            connection.cancel()
        })
    }

    private func htmlPage(title: String, body: String) -> String {
        """
        <!doctype html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>\(escapeHTML(title))</title>
          <style>
            body { background: #0d1117; color: #e6edf3; font: 16px -apple-system, BlinkMacSystemFont, sans-serif; display: grid; min-height: 100vh; place-items: center; margin: 0; }
            main { max-width: 680px; padding: 40px; }
            h1 { font-size: 28px; margin: 0 0 12px; }
            p { color: #9da7b3; line-height: 1.5; margin: 0; }
          </style>
        </head>
        <body><main><h1>\(escapeHTML(title))</h1><p>\(body)</p></main></body>
        </html>
        """
    }

    private func escapeHTML(_ value: String) -> String {
        value
            .replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
            .replacingOccurrences(of: "\"", with: "&quot;")
    }

    private func nonEmpty(_ value: String?) -> String? {
        guard let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines),
              !trimmed.isEmpty
        else {
            return nil
        }
        return trimmed
    }

    private func purgeExpiredSessionsLocked() {
        let cutoff = Date().addingTimeInterval(-15 * 60)
        let expired = pendingByState.filter { $0.value.createdAt < cutoff }.map(\.key)
        for state in expired {
            pendingByState.removeValue(forKey: state)
            callbacksByState.removeValue(forKey: state)
        }
    }

    private struct PendingSession {
        var workspaceId: RelayId
        var clientId: String
        var redirectURI: String
        var flowName: String
        var createdAt: Date
    }
}
