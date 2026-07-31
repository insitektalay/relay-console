import Foundation

public func requireNonEmptyString(_ value: String?, field: String, maxLength: Int) throws -> String {
    let trimmed = (value ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else {
        throw RelayError(.invalidInput, "\(field) is required.")
    }
    guard trimmed.count <= maxLength else {
        throw RelayError(.invalidInput, "\(field) must be \(maxLength) characters or fewer.")
    }
    return trimmed
}

public func optionalTrimmedString(_ value: String?, field: String, maxLength: Int) throws -> String? {
    let trimmed = (value ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    if trimmed.isEmpty {
        return nil
    }
    guard trimmed.count <= maxLength else {
        throw RelayError(.invalidInput, "\(field) must be \(maxLength) characters or fewer.")
    }
    return trimmed
}

public func assertMessageContent(_ value: String, maxLength: Int) throws -> String {
    let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else {
        throw RelayError(.invalidInput, "Message is required.")
    }
    guard trimmed.count <= maxLength else {
        throw RelayError(.invalidInput, "Message must be \(maxLength) characters or fewer.")
    }
    return trimmed
}

public func slugifyAgentId(_ value: String) -> String {
    let lower = value.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    let replaced = lower.replacingOccurrences(of: #"[^a-z0-9]+"#, with: "_", options: .regularExpression)
    return String(replaced.trimmingCharacters(in: CharacterSet(charactersIn: "_")).prefix(80))
}

