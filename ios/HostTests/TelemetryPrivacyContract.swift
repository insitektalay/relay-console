import Foundation

@main
struct TelemetryPrivacyContract {
    static func main() {
        let secret = "secret-token-value"
        let output = TelemetryPrivacy.sanitizedContext([
            "operation": "message.send",
            "workspaceId": "workspace-123",
            "count": 4,
            "path": "/Users/person/Private.txt",
            "filename": "Private.txt",
            "content": "private message body",
            "authorization": "Bearer \(secret)",
            "unknown": secret,
            "url": URL(string: "https://example.test/callback?token=\(secret)")!
        ])

        precondition(output["operation"] == "message.send")
        precondition(output["workspaceId"] == "workspace-123")
        precondition(output["count"] == "4")
        for key in ["path", "filename", "content", "authorization", "unknown", "url"] {
            precondition(output[key] == TelemetryPrivacy.redacted)
        }
        precondition(!String(describing: output).contains(secret))
        precondition(!String(describing: output).contains("Private.txt"))

        let original = NSError(
            domain: "Relay.Test",
            code: 42,
            userInfo: [NSLocalizedDescriptionKey: "account@example.test token=\(secret)"]
        )
        let sanitized = TelemetryPrivacy.sanitizedError(original)
        precondition(sanitized.domain == "Relay.Test")
        precondition(sanitized.code == 42)
        precondition(sanitized.localizedDescription == "Operation failed (Relay.Test(42)).")
        precondition(!sanitized.localizedDescription.contains(secret))
        precondition(!sanitized.localizedDescription.contains("account@example.test"))

        precondition(
            TelemetryPrivacy.sanitizedLabel("https://example.test?token=secret", fallback: "redacted.event") ==
                "redacted.event"
        )

        let privatePayload = Data(#"{"token":"secret-token-value","message":"private body"}"#.utf8)
        let diagnostic = TelemetryPrivacy.websocketDiagnosticMetadata(
            privatePayload,
            eventType: "message.new"
        )
        let sanitizedDiagnostic = TelemetryPrivacy.sanitizedContext(diagnostic)
        precondition(sanitizedDiagnostic["type"] == "message.new")
        precondition(sanitizedDiagnostic["byteLength"] == "\(privatePayload.count)")
        precondition(sanitizedDiagnostic["diagnosticHash"]?.count == 32)
        precondition(!String(describing: sanitizedDiagnostic).contains(secret))
        precondition(!String(describing: sanitizedDiagnostic).contains("private body"))

        let repeated = TelemetryPrivacy.websocketDiagnosticMetadata(
            privatePayload,
            eventType: "message.new"
        )
        precondition(
            diagnostic["diagnosticHash"] as? String == repeated["diagnosticHash"] as? String
        )

        let attackerType = TelemetryPrivacy.websocketDiagnosticMetadata(
            privatePayload,
            eventType: "Bearer secret-token-value"
        )
        precondition(attackerType["type"] as? String == "unrecognized")
    }
}
