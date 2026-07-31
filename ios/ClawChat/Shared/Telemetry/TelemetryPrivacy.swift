import CryptoKit
import Foundation

enum TelemetryPrivacy {
    static let redacted = "[redacted]"

    private static let allowedStringKeys: Set<String> = [
        "agentId", "agent_id", "byteLength", "count", "diagnosticHash",
        "environment", "errorKind", "format", "messageId", "mode", "operation",
        "release", "route", "runtimeType", "sessionId", "session_id", "source",
        "status", "statusCode", "threadId", "thread_id", "type", "userId",
        "user_id", "workspaceId", "workspace_id"
    ]

    private static let websocketDiagnosticTypes: Set<String> = [
        "agent.status_changed", "agent.update", "alert.new", "approval.new",
        "authenticated", "close.reason", "dispatch.cancelled",
        "dispatch.completed", "dispatch.failed", "dispatch.queued",
        "dispatch.started", "incident.new", "message.new", "message.update",
        "participant.health", "run.delta", "run.status", "run.tool",
        "runtime.dispatch.cancelled", "runtime.dispatch.completed",
        "runtime.dispatch.failed", "runtime.dispatch.started",
        "runtime.run.delta", "runtime.run.status", "runtime.run.thinking",
        "runtime.run.tool", "session.revoked", "task.update", "thread.update",
        "transport.error", "typing.start", "typing.stop", "unparseable",
        "unrecognized"
    ]

    private static let diagnosticKey = SymmetricKey(size: .bits256)

    private static let sensitiveKeyFragments = [
        "authorization", "body", "code", "content", "cookie", "credential",
        "email", "file", "folder", "header", "messagebody", "name", "password",
        "path", "prompt", "query", "secret", "state", "token", "url"
    ]

    static func sanitizedContext(_ attributes: [String: Any]) -> [String: String] {
        attributes.reduce(into: [String: String]()) { result, pair in
            result[pair.key] = sanitizedAttribute(key: pair.key, value: pair.value)
        }
    }

    static func sanitizedAttribute(key: String, value: Any) -> String {
        let normalizedKey = key.lowercased().replacingOccurrences(of: "_", with: "")
        if sensitiveKeyFragments.contains(where: normalizedKey.contains) {
            return redacted
        }

        switch value {
        case let value as Bool:
            return value ? "true" : "false"
        case let value as Int:
            return "\(value)"
        case let value as Double where value.isFinite:
            return "\(value)"
        case let value as Float where value.isFinite:
            return "\(value)"
        case let value as Date:
            return ISO8601DateFormatter().string(from: value)
        case let value as UUID:
            return allowedStringKeys.contains(key) ? value.uuidString : redacted
        case is URL:
            return redacted
        case let value as NSError:
            return errorKind(value)
        case let value as String:
            guard allowedStringKeys.contains(key), isSafeScalar(value) else { return redacted }
            return limited(value, maxLength: 120)
        case Optional<Any>.none:
            return "nil"
        default:
            let mirror = Mirror(reflecting: value)
            if mirror.displayStyle == .dictionary {
                return "dictionary(\(mirror.children.count))"
            }
            if mirror.displayStyle == .collection || mirror.displayStyle == .set {
                return "collection(\(mirror.children.count))"
            }
            return redacted
        }
    }

    static func sanitizedError(_ error: any Error) -> NSError {
        let source = error as NSError
        return NSError(
            domain: safeErrorDomain(source.domain),
            code: source.code,
            userInfo: [NSLocalizedDescriptionKey: "Operation failed (\(errorKind(source)))."]
        )
    }

    static func errorKind(_ error: any Error) -> String {
        let source = error as NSError
        return "\(safeErrorDomain(source.domain))(\(source.code))"
    }

    static func sanitizedLabel(_ value: String, fallback: String) -> String {
        guard isSafeScalar(value) else { return fallback }
        return limited(value, maxLength: 120)
    }

    static func websocketDiagnosticMetadata(
        _ data: Data,
        eventType: String?
    ) -> [String: Any] {
        let digest = HMAC<SHA256>.authenticationCode(for: data, using: diagnosticKey)
        let diagnosticHash = digest.prefix(16).map {
            String(format: "%02x", $0)
        }.joined()
        let safeType = eventType.flatMap {
            websocketDiagnosticTypes.contains($0) ? $0 : nil
        } ?? "unrecognized"

        return [
            "type": safeType,
            "byteLength": data.count,
            "diagnosticHash": diagnosticHash
        ]
    }

    private static func isSafeScalar(_ value: String) -> Bool {
        guard !value.isEmpty, !value.contains("\n"), !value.contains("\r") else { return false }
        let lowered = value.lowercased()
        if lowered.contains("bearer ") || lowered.contains("password=") ||
            lowered.contains("token=") || lowered.contains("secret=") ||
            lowered.contains("authorization=") || value.contains("://") ||
            value.contains("@") {
            return false
        }
        return value.unicodeScalars.allSatisfy { scalar in
            CharacterSet.alphanumerics.contains(scalar) || "._:/+-()[] ".unicodeScalars.contains(scalar)
        }
    }

    private static func safeErrorDomain(_ domain: String) -> String {
        let filtered = domain.unicodeScalars.filter { scalar in
            CharacterSet.alphanumerics.contains(scalar) || ".-_".unicodeScalars.contains(scalar)
        }
        let value = String(String.UnicodeScalarView(filtered))
        return value.isEmpty ? "RelayDiagnosticError" : limited(value, maxLength: 80)
    }

    private static func limited(_ value: String, maxLength: Int) -> String {
        guard value.count > maxLength else { return value }
        return String(value.prefix(maxLength))
    }
}
