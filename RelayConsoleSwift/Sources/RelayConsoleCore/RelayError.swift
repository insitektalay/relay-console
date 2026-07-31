import Foundation

public enum RelayErrorCode: String, Codable, Sendable {
    case profileMissing = "profile_missing"
    case workspaceMissing = "workspace_missing"
    case harnessMissing = "harness_missing"
    case harnessUnhealthy = "harness_unhealthy"
    case workspaceFolderMissing = "workspace_folder_missing"
    case permissionDenied = "permission_denied"
    case dispatchFailed = "dispatch_failed"
    case dispatchTimeout = "dispatch_timeout"
    case dispatchCancelled = "dispatch_cancelled"
    case databaseUnavailable = "database_unavailable"
    case secretStoreUnavailable = "secret_store_unavailable"
    case invalidInput = "invalid_input"
    case notFound = "not_found"
    case unsupported
    case internalError = "internal_error"
}

public struct RelayError: Error, Codable, Equatable, Sendable {
    public var code: RelayErrorCode
    public var message: String
    public var recovery: String?
    public var correlationId: String?

    public init(_ code: RelayErrorCode, _ message: String, recovery: String? = nil, correlationId: String? = nil) {
        self.code = code
        self.message = message
        self.recovery = recovery
        self.correlationId = correlationId
    }
}

extension RelayError: LocalizedError {
    public var errorDescription: String? { message }
    public var recoverySuggestion: String? { recovery }
}

public func relayError(_ error: Error) -> RelayError {
    if let relay = error as? RelayError {
        return relay
    }
    return RelayError(.internalError, error.localizedDescription)
}

