import Foundation

private let sensitivePatterns: [NSRegularExpression] = [
    try! NSRegularExpression(pattern: #"(?i)((?:api[_-]?key|token|secret|credential|password|authorization|auth)[=:]\s*)[^,\s]+"#),
    try! NSRegularExpression(pattern: #"(?i)bearer\s+[a-z0-9._\-]+"#),
    try! NSRegularExpression(pattern: #"(?i)(--(?:api[_-]?key|token|secret|credential|password|authorization|auth)(?:=|\s+))[^\s,;]+"#),
    try! NSRegularExpression(pattern: #"(?i)([A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|CREDENTIAL|AUTHORIZATION|PRIVATE_KEY)[A-Z0-9_]*=)[^\s,;]+"#)
]

private let localEvidencePatterns: [NSRegularExpression] = [
    try! NSRegularExpression(pattern: #"(?<![:\w])(?:~|/Users|/private|/var|/tmp|/Volumes)/[^\s,;)"']+"#)
]

public func redactString(_ value: String) -> String {
    var output = value
    for pattern in sensitivePatterns {
        let range = NSRange(output.startIndex..<output.endIndex, in: output)
        let replacement = pattern.numberOfCaptureGroups > 0 ? "$1[REDACTED]" : "[REDACTED]"
        output = pattern.stringByReplacingMatches(in: output, range: range, withTemplate: replacement)
    }
    return output
}

public func redactEvidenceString(_ value: String) -> String {
    var output = redactString(value)
    for pattern in localEvidencePatterns {
        let range = NSRange(output.startIndex..<output.endIndex, in: output)
        output = pattern.stringByReplacingMatches(in: output, range: range, withTemplate: "[REDACTED]")
    }
    return output
}

public func redactRecord(_ value: JSONRecord) -> JSONRecord {
    value.map { key, value in
        (key, redactValue(value, keyHint: key))
    }.reduce(into: JSONRecord()) { output, pair in
        output[pair.0] = pair.1
    }
}

public func redactValue(_ value: JSONValue) -> JSONValue {
    redactValue(value, keyHint: nil)
}

private func redactValue(_ value: JSONValue, keyHint: String?) -> JSONValue {
    switch value {
    case .string(let string):
        if shouldRedactWholeValue(for: keyHint) {
            return .string("[REDACTED]")
        }
        return .string(redactString(string))
    case .object(let object):
        if shouldRedactWholeValue(for: keyHint) {
            return .string("[REDACTED]")
        }
        return .object(redactRecord(object))
    case .array(let array):
        if shouldRedactWholeValue(for: keyHint) {
            return .string("[REDACTED]")
        }
        return .array(array.map { redactValue($0, keyHint: keyHint) })
    default:
        return value
    }
}

private func shouldRedactWholeValue(for keyHint: String?) -> Bool {
    guard let keyHint else { return false }
    let normalized = keyHint
        .trimmingCharacters(in: .whitespacesAndNewlines)
        .lowercased()
        .replacingOccurrences(of: "-", with: "_")
    if [
        "password",
        "secret",
        "token",
        "credential",
        "authorization",
        "auth_header",
        "private_key",
        "client_secret",
        "access_token",
        "refresh_token",
        "raw_bridge_payload",
        "raw_command",
        "command_line",
        "arguments",
        "argv",
        "runtime_payload"
    ].contains(normalized) {
        return true
    }
    if normalized.contains("password")
        || normalized.contains("credential")
        || normalized.contains("authorization")
        || normalized.contains("_token")
        || normalized.hasSuffix("token")
        || normalized.contains("access_token")
        || normalized.contains("refresh_token")
        || normalized.contains("client_secret")
        || normalized.contains("private_key") {
        return true
    }
    if normalized.contains("command") && !normalized.hasSuffix("id") {
        return true
    }
    return false
}
