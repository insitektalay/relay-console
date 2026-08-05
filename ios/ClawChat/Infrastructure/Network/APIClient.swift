// APIClient.swift
// ClawChat – Production-grade HTTP client
// Swift 6, async/await, automatic token refresh, retry with backoff

import Foundation
import Combine

extension Notification.Name {
    static let relayConsoleUnauthorized = Notification.Name("relayconsole.api.unauthorized")
}

// MARK: - API Error

enum APIError: LocalizedError, Sendable {
    case unauthorized
    case notFound
    case serverError(statusCode: Int, message: String?)
    case networkError(underlying: any Error)
    case decodingError(underlying: any Error)
    case rateLimited(retryAfter: Int?)
    case invalidURL
    case uploadFailed(message: String?)

    var errorDescription: String? {
        switch self {
        case .unauthorized:
            return "You are not authorized. Please log in again."
        case .notFound:
            return "The requested resource was not found."
        case .serverError(let code, let msg):
            if [502, 503, 504].contains(code) {
                if let msg, Self.isActionableServiceMessage(msg) { return msg }
                return "Relay service is temporarily unavailable. Please try again shortly."
            }
            return msg ?? "Server error (\(code))."
        case .networkError(let err):
            return "Network error: \(err.localizedDescription)"
        case .decodingError(let err):
            return "Failed to decode response: \(err.localizedDescription)"
        case .rateLimited(let retry):
            if let retry {
                return "Rate limited. Retry after \(retry) seconds."
            }
            return "Rate limited. Please slow down."
        case .invalidURL:
            return "Invalid URL."
        case .uploadFailed(let msg):
            return msg ?? "Upload failed."
        }
    }

    private static func isActionableServiceMessage(_ message: String) -> Bool {
        let normalized = message.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !normalized.isEmpty else { return false }
        return normalized != "service unavailable"
            && normalized != "bad gateway"
            && normalized != "gateway timeout"
            && !normalized.contains("application failed to respond")
            && !normalized.contains("upstream connect error")
    }
}

// MARK: - API Response Wrapper

private struct APIResponse<T: Decodable>: Decodable {
    let data: T
    let meta: PageMeta?
}

// MARK: - APIClient

@MainActor
final class APIClient: ObservableObject {

    static let shared = APIClient()

    private(set) var baseURL: URL
    private let session: URLSession
    private let persistsTokens: Bool
    private(set) var authTokens: AuthTokens?

    // Prevent concurrent token refresh races
    private var isRefreshing = false
    private var refreshWaiters: [CheckedContinuation<AuthTokens, any Error>] = []

    // MARK: - JSON Decoder (shared, configured once)

    nonisolated static let decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.keyDecodingStrategy = .convertFromSnakeCase
        // Backend returns dates with fractional seconds (e.g. "2026-03-21T18:35:53.681Z").
        // Swift's built-in .iso8601 strategy cannot parse the milliseconds — use custom strategy.
        d.dateDecodingStrategy = .custom { decoder in
            let c = try decoder.singleValueContainer()
            let s = try c.decode(String.self)
            let withMs = ISO8601DateFormatter()
            withMs.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let date = withMs.date(from: s) { return date }
            let withoutMs = ISO8601DateFormatter()
            withoutMs.formatOptions = [.withInternetDateTime]
            if let date = withoutMs.date(from: s) { return date }
            throw DecodingError.dataCorruptedError(in: c, debugDescription: "Unrecognised date: \(s)")
        }
        return d
    }()

    nonisolated static let encoder: JSONEncoder = {
        let e = JSONEncoder()
        e.keyEncodingStrategy = .convertToSnakeCase
        e.dateEncodingStrategy = .iso8601
        return e
    }()

    nonisolated static func isoString(_ date: Date) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.string(from: date)
    }

    // MARK: - Init

    private init() {
        self.baseURL = AppRuntimeConfig.apiBaseURL

        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest  = 30
        config.timeoutIntervalForResource = 120
        config.waitsForConnectivity       = true
        self.session = URLSession(configuration: config)
        self.persistsTokens = true

        // Restore tokens from keychain on init
        self.authTokens = AuthTokenStore.load()
    }

    /// Test-only dependency seam for exercising authentication and retry behavior
    /// without touching the process-wide client or the device Keychain.
    init(
        baseURL: URL,
        session: URLSession,
        initialTokens: AuthTokens? = nil,
        persistsTokens: Bool = false
    ) {
        self.baseURL = baseURL
        self.session = session
        self.persistsTokens = persistsTokens
        self.authTokens = initialTokens
    }

    // MARK: - Token Management

    func setTokens(_ tokens: AuthTokens) {
        authTokens = tokens
        if persistsTokens {
            AuthTokenStore.save(tokens)
        }
        Telemetry.shared.event("auth.tokens.saved")
    }

    func clearTokens() {
        authTokens = nil
        if persistsTokens {
            AuthTokenStore.delete()
        }
        Telemetry.shared.event("auth.tokens.cleared")
    }

    /// Starts best-effort Railway revocation for the current mobile session while
    /// clearing device credentials synchronously. The request is built before
    /// deletion so it carries only the session being ended, even if another user
    /// signs in while the network call is still completing.
    @discardableResult
    func endCurrentSession() -> _Concurrency.Task<Bool, Never>? {
        guard let request = prepareLogoutRequestAndClearTokens() else { return nil }
        let session = self.session
        return _Concurrency.Task {
            do {
                let (_, response) = try await session.data(for: request)
                guard let http = response as? HTTPURLResponse else {
                    throw APIError.networkError(underlying: URLError(.badServerResponse))
                }
                let accepted = (200...299).contains(http.statusCode) || http.statusCode == 401
                if accepted {
                    Telemetry.shared.event(
                        "auth.logout.railway_completed",
                        attributes: ["statusCode": http.statusCode]
                    )
                } else {
                    Telemetry.shared.capture(
                        message: "Railway logout returned an unexpected status",
                        level: .warning,
                        attributes: ["statusCode": http.statusCode]
                    )
                }
                return accepted
            } catch {
                Telemetry.shared.capture(
                    error: error,
                    attributes: ["operation": "auth.logout.railway"]
                )
                return false
            }
        }
    }

    /// Internal for the session-security contract tests: capture the authenticated
    /// request first, then remove both in-memory and Keychain credentials.
    func prepareLogoutRequestAndClearTokens() -> URLRequest? {
        defer { clearTokens() }
        guard authTokens != nil else { return nil }
        do {
            return try buildRequest(for: .logout)
        } catch {
            Telemetry.shared.capture(
                error: error,
                attributes: ["operation": "auth.logout.prepare"]
            )
            return nil
        }
    }

    func applySavedCloudConnection() {
        baseURL = AppRuntimeConfig.apiBaseURL
        clearTokens()
    }

    private func invalidateSession(endpoint: APIEndpoint, reason: String) {
        clearTokens()
        Telemetry.shared.capture(
            message: "API session invalidated",
            level: .warning,
            attributes: ["endpoint": endpoint.path, "reason": reason]
        )
        NotificationCenter.default.post(
            name: .relayConsoleUnauthorized,
            object: nil,
            userInfo: ["endpoint": endpoint.path, "reason": reason]
        )
    }

    /// Refresh tokens if the access token is absent or within 60 s of expiry.
    /// Multiple concurrent callers are coalesced into a single network request.
    func refreshTokensIfNeeded() async throws {
        guard let tokens = authTokens else { throw APIError.unauthorized }

        if isRefreshing {
            // Queue up and wait for the in-flight refresh to complete
            let newTokens: AuthTokens = try await withCheckedThrowingContinuation { cont in
                refreshWaiters.append(cont)
            }
            authTokens = newTokens
            return
        }

        isRefreshing = true
        defer {
            isRefreshing = false
        }

        do {
            let refreshed = try await refreshTokens(tokens.refreshToken)
            setTokens(refreshed)
            let waiters = refreshWaiters
            refreshWaiters.removeAll()
            for cont in waiters { cont.resume(returning: refreshed) }
        } catch {
            let waiters = refreshWaiters
            refreshWaiters.removeAll()
            for cont in waiters { cont.resume(throwing: error) }
            invalidateSession(endpoint: .refreshToken(token: tokens.refreshToken), reason: "refresh_failed")
            throw error
        }
    }

    private func refreshTokens(_ refreshToken: String) async throws -> AuthTokens {
        let data = try await fetchRawData(.refreshToken(token: refreshToken), retryCount: 0)

        struct NestedRefreshEnvelope: Decodable {
            struct TokensPayload: Decodable {
                let tokens: AuthTokens
            }
            let data: TokensPayload
        }

        if let wrapped = try? APIClient.decoder.decode(APIResponse<AuthTokens>.self, from: data) {
            return wrapped.data
        }
        if let nested = try? APIClient.decoder.decode(NestedRefreshEnvelope.self, from: data) {
            return nested.data.tokens
        }
        do {
            return try APIClient.decoder.decode(AuthTokens.self, from: data)
        } catch {
            Telemetry.shared.capture(error: error, attributes: ["operation": "auth.refresh.decode"])
            throw APIError.decodingError(underlying: error)
        }
    }

    // MARK: - Generic Request

    func request<T: Decodable>(_ endpoint: APIEndpoint) async throws -> T {
        try await performRequest(endpoint, retryCount: 0)
    }

    func requestNoContent(_ endpoint: APIEndpoint) async throws {
        _ = try await fetchRawData(endpoint, retryCount: 0)
    }

    func requestJSONDocument(_ endpoint: APIEndpoint) async throws -> Data {
        let responseData = try await fetchRawData(endpoint, retryCount: 0)
        do {
            let response = try JSONSerialization.jsonObject(with: responseData)
            let payload: Any
            if let envelope = response as? [String: Any], let data = envelope["data"] {
                payload = data
            } else {
                payload = response
            }
            guard JSONSerialization.isValidJSONObject(payload) else {
                throw CocoaError(.propertyListReadCorrupt)
            }
            return try JSONSerialization.data(
                withJSONObject: payload,
                options: [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
            )
        } catch {
            Telemetry.shared.capture(
                error: error,
                attributes: ["endpoint": endpoint.path, "operation": "json.document"]
            )
            throw APIError.decodingError(underlying: error)
        }
    }

    // MARK: - Paginated Request
    // Different endpoints use different envelope formats. Try both:
    //   1. {"data": {"data":[…],"total":N,…}}  (APIResponse wrapping a PaginatedResponse)
    //   2. {"data":[…],"total":N,…}             (flat PaginatedResponse, no outer wrapper)

    func requestPaginated<T: Decodable>(_ endpoint: APIEndpoint) async throws -> PaginatedResponse<T> {
        let data = try await fetchRawData(endpoint, retryCount: 0)
        // Try wrapped format first
        if let wrapped = try? APIClient.decoder.decode(APIResponse<PaginatedResponse<T>>.self, from: data) {
            return wrapped.data
        }
        // Fall back to flat format
        do {
            return try APIClient.decoder.decode(PaginatedResponse<T>.self, from: data)
        } catch {
            throw APIError.decodingError(underlying: error)
        }
    }

    // Shared HTTP fetch that handles status codes + retries, returns raw Data
    private func fetchRawData(_ endpoint: APIEndpoint, retryCount: Int) async throws -> Data {
        let urlRequest = try buildRequest(for: endpoint)
        Telemetry.shared.breadcrumb(
            "HTTP \(urlRequest.httpMethod ?? "?") \(endpoint.path)",
            category: "api.request",
            attributes: ["endpoint": endpoint.path, "retryCount": retryCount]
        )

        #if DEBUG
        logRequest(urlRequest)
        #endif

        let (data, response): (Data, URLResponse)
        do {
            (data, response) = try await session.data(for: urlRequest)
        } catch {
            if isExpectedCancellation(error) {
                Telemetry.shared.breadcrumb(
                    "API request cancelled",
                    category: "api.cancelled",
                    attributes: ["endpoint": endpoint.path]
                )
                throw APIError.networkError(underlying: error)
            }
            if shouldRetryTransportError(error, endpoint: endpoint, retryCount: retryCount) {
                Telemetry.shared.breadcrumb(
                    "Retrying API request after transport error",
                    category: "api.retry",
                    level: .warning,
                    attributes: [
                        "endpoint": endpoint.path,
                        "retryCount": retryCount,
                        "error": error.localizedDescription
                    ]
                )
                try await sleepBeforeRetry(retryCount)
                return try await fetchRawData(endpoint, retryCount: retryCount + 1)
            }
            Telemetry.shared.capture(
                error: error,
                attributes: ["endpoint": endpoint.path, "phase": "transport"]
            )
            throw APIError.networkError(underlying: error)
        }

        guard let http = response as? HTTPURLResponse else {
            Telemetry.shared.capture(
                message: "API response was not HTTPURLResponse",
                attributes: ["endpoint": endpoint.path]
            )
            throw APIError.networkError(underlying: URLError(.badServerResponse))
        }

        Telemetry.shared.breadcrumb(
            "HTTP \(http.statusCode) \(endpoint.path)",
            category: "api.response",
            level: http.statusCode >= 400 ? .warning : .info,
            attributes: ["endpoint": endpoint.path, "statusCode": http.statusCode]
        )

        #if DEBUG
        logResponse(http, data: data)
        #endif

        if http.statusCode == 401 {
            if retryCount == 0, case .refreshToken = endpoint {
                invalidateSession(endpoint: endpoint, reason: "refresh_token_rejected")
                throw APIError.unauthorized
            } else if retryCount == 0 {
                try await refreshTokensIfNeeded()
                return try await fetchRawData(endpoint, retryCount: retryCount + 1)
            } else {
                if endpoint.invalidatesSessionOnUnauthorized {
                    invalidateSession(endpoint: endpoint, reason: "identity_unauthorized")
                } else {
                    Telemetry.shared.breadcrumb(
                        "API endpoint unauthorized after refresh",
                        category: "api.auth",
                        level: .warning,
                        attributes: ["endpoint": endpoint.path]
                    )
                }
                throw APIError.unauthorized
            }
        }
        if http.statusCode == 429 {
            Telemetry.shared.capture(
                message: "API rate limited",
                level: .warning,
                attributes: ["endpoint": endpoint.path, "retryAfter": http.value(forHTTPHeaderField: "Retry-After") ?? ""]
            )
            throw APIError.rateLimited(retryAfter: http.value(forHTTPHeaderField: "Retry-After").flatMap(Int.init))
        }
        if http.statusCode == 404 { throw APIError.notFound }
        if (500...599).contains(http.statusCode) {
            if retryCount < 3 && endpoint.method == .get {
                let delay = pow(2.0, Double(retryCount))
                try await _Concurrency.Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
                return try await fetchRawData(endpoint, retryCount: retryCount + 1)
            }
            throw apiError(from: http, data: data)
        }
        guard (200...299).contains(http.statusCode) else {
            throw apiError(from: http, data: data)
        }
        return data
    }

    // MARK: - File Upload

    func upload(data fileData: Data, filename: String, mimeType: String, endpoint: APIEndpoint) async throws -> String {
        var urlRequest = try buildRequest(for: endpoint)
        let boundary = "Boundary-\(UUID().uuidString)"
        urlRequest.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        do {
            urlRequest.httpBody = try MultipartFormDataSecurity.encodeFile(
                data: fileData,
                filename: filename,
                mimeType: mimeType,
                boundary: boundary
            )
        } catch {
            throw APIError.uploadFailed(message: "The selected file name or type is invalid.")
        }

        let (responseData, response) = try await session.data(for: urlRequest)
        guard let http = response as? HTTPURLResponse else { throw APIError.networkError(underlying: URLError(.badServerResponse)) }

        #if DEBUG
        logResponse(http, data: responseData)
        #endif

        guard (200...299).contains(http.statusCode) else {
            throw apiError(from: http, data: responseData)
        }

        // Expect { data: "url_string" }
        let wrapper = try APIClient.decoder.decode(APIResponse<String>.self, from: responseData)
        return wrapper.data
    }

    // MARK: - Internal: perform with retry

    private func performRequest<T: Decodable>(_ endpoint: APIEndpoint, retryCount: Int) async throws -> T {
        let urlRequest = try buildRequest(for: endpoint)
        Telemetry.shared.breadcrumb(
            "HTTP \(urlRequest.httpMethod ?? "?") \(endpoint.path)",
            category: "api.request",
            attributes: ["endpoint": endpoint.path, "retryCount": retryCount, "responseType": String(describing: T.self)]
        )

        #if DEBUG
        logRequest(urlRequest)
        #endif

        let (data, response): (Data, URLResponse)
        do {
            (data, response) = try await session.data(for: urlRequest)
        } catch {
            if isExpectedCancellation(error) {
                Telemetry.shared.breadcrumb(
                    "API request cancelled",
                    category: "api.cancelled",
                    attributes: ["endpoint": endpoint.path, "responseType": String(describing: T.self)]
                )
                throw APIError.networkError(underlying: error)
            }
            if shouldRetryTransportError(error, endpoint: endpoint, retryCount: retryCount) {
                Telemetry.shared.breadcrumb(
                    "Retrying API request after transport error",
                    category: "api.retry",
                    level: .warning,
                    attributes: [
                        "endpoint": endpoint.path,
                        "retryCount": retryCount,
                        "error": error.localizedDescription
                    ]
                )
                try await sleepBeforeRetry(retryCount)
                return try await performRequest(endpoint, retryCount: retryCount + 1)
            }
            Telemetry.shared.capture(
                error: error,
                attributes: ["endpoint": endpoint.path, "phase": "transport"]
            )
            throw APIError.networkError(underlying: error)
        }

        guard let http = response as? HTTPURLResponse else {
            Telemetry.shared.capture(
                message: "API response was not HTTPURLResponse",
                attributes: ["endpoint": endpoint.path]
            )
            throw APIError.networkError(underlying: URLError(.badServerResponse))
        }

        Telemetry.shared.breadcrumb(
            "HTTP \(http.statusCode) \(endpoint.path)",
            category: "api.response",
            level: http.statusCode >= 400 ? .warning : .info,
            attributes: ["endpoint": endpoint.path, "statusCode": http.statusCode]
        )

        #if DEBUG
        logResponse(http, data: data)
        #endif

        // 401 – attempt one token refresh then retry.
        // Never attempt a refresh if the failing endpoint IS the refresh endpoint —
        // that would deadlock (isRefreshing=true causes the inner call to suspend
        // on a continuation that the outer call can never resume).
        if http.statusCode == 401 {
            if retryCount == 0, case .refreshToken = endpoint {
                // Refresh token itself was rejected — log out immediately.
                invalidateSession(endpoint: endpoint, reason: "refresh_token_rejected")
                throw APIError.unauthorized
            } else if retryCount == 0 {
                try await refreshTokensIfNeeded()
                return try await performRequest(endpoint, retryCount: retryCount + 1)
            } else {
                if endpoint.invalidatesSessionOnUnauthorized {
                    invalidateSession(endpoint: endpoint, reason: "identity_unauthorized")
                } else {
                    Telemetry.shared.breadcrumb(
                        "API endpoint unauthorized after refresh",
                        category: "api.auth",
                        level: .warning,
                        attributes: ["endpoint": endpoint.path]
                    )
                }
                throw APIError.unauthorized
            }
        }

        // 429 – rate limited
        if http.statusCode == 429 {
            let retryAfter = http.value(forHTTPHeaderField: "Retry-After").flatMap(Int.init)
            Telemetry.shared.capture(
                message: "API rate limited",
                level: .warning,
                attributes: ["endpoint": endpoint.path, "retryAfter": retryAfter ?? -1]
            )
            throw APIError.rateLimited(retryAfter: retryAfter)
        }

        // 404
        if http.statusCode == 404 {
            throw APIError.notFound
        }

        // 5xx – retry with exponential backoff, but only for safe (GET) requests
        if (500...599).contains(http.statusCode) {
            if retryCount < 3 && endpoint.method == .get {
                let delay = pow(2.0, Double(retryCount)) // 1s, 2s, 4s
                try await _Concurrency.Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
                return try await performRequest(endpoint, retryCount: retryCount + 1)
            }
            throw apiError(from: http, data: data)
        }

        // Other non-2xx
        guard (200...299).contains(http.statusCode) else {
            throw apiError(from: http, data: data)
        }

        // Decode — try wrapped {"data": T} first, then fall back to flat T
        if let wrapped = try? APIClient.decoder.decode(APIResponse<T>.self, from: data) {
            return wrapped.data
        }
        do {
            return try APIClient.decoder.decode(T.self, from: data)
        } catch {
            Telemetry.shared.capture(
                error: error,
                attributes: [
                    "endpoint": endpoint.path,
                    "responseType": String(describing: T.self),
                    "statusCode": http.statusCode
                ]
            )
            throw APIError.decodingError(underlying: error)
        }
    }

    // MARK: - Build URLRequest

    private func buildRequest(for endpoint: APIEndpoint) throws -> URLRequest {
        var request = endpoint.urlRequest(relativeTo: baseURL)
        if let tokens = authTokens {
            request.setValue("Bearer \(tokens.accessToken)", forHTTPHeaderField: "Authorization")
        }
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("RelayConsole-iOS/1.0", forHTTPHeaderField: "User-Agent")
        return request
    }

    private func shouldRetryTransportError(_ error: any Error, endpoint: APIEndpoint, retryCount: Int) -> Bool {
        guard endpoint.method == .get, retryCount < 2 else { return false }
        let nsError = error as NSError
        guard nsError.domain == NSURLErrorDomain else { return false }
        switch URLError.Code(rawValue: nsError.code) {
        case .timedOut, .networkConnectionLost, .cannotFindHost, .cannotConnectToHost, .dnsLookupFailed, .notConnectedToInternet:
            return true
        default:
            return false
        }
    }

    static func isExpectedCancellation(_ error: any Error) -> Bool {
        if error is CancellationError { return true }
        if case APIError.networkError(let underlying) = error {
            return isExpectedCancellation(underlying)
        }
        let nsError = error as NSError
        guard nsError.domain == NSURLErrorDomain else { return false }
        return nsError.code == NSURLErrorCancelled
    }

    private func isExpectedCancellation(_ error: any Error) -> Bool {
        Self.isExpectedCancellation(error)
    }

    private func sleepBeforeRetry(_ retryCount: Int) async throws {
        let delay = pow(2.0, Double(retryCount)) * 0.75
        try await _Concurrency.Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
    }

    // MARK: - Error Parsing

    private func apiError(from response: HTTPURLResponse, data: Data) -> APIError {
        struct ErrorBody: Decodable {
            let message: MessageValue?
            enum MessageValue: Decodable {
                case string(String)
                case array([String])
                init(from decoder: Decoder) throws {
                    let c = try decoder.singleValueContainer()
                    if let s = try? c.decode(String.self) { self = .string(s) }
                    else if let a = try? c.decode([String].self) { self = .array(a) }
                    else { self = .string("Unknown error") }
                }
                var stringValue: String {
                    switch self { case .string(let s): return s; case .array(let a): return a.joined(separator: ", ") }
                }
            }
        }
        let message = (try? APIClient.decoder.decode(ErrorBody.self, from: data))?.message?.stringValue
        return .serverError(statusCode: response.statusCode, message: message)
    }

    // MARK: - Debug Logging

    #if DEBUG
    private func logRequest(_ request: URLRequest) {
        Telemetry.shared.breadcrumb(
            "Debug HTTP request",
            category: "api.debug",
            attributes: ["method": request.httpMethod ?? "?", "url": request.url?.absoluteString ?? ""]
        )
    }

    private func logResponse(_ response: HTTPURLResponse, data: Data) {
        Telemetry.shared.breadcrumb(
            "Debug HTTP response",
            category: "api.debug",
            level: response.statusCode >= 400 ? .warning : .debug,
            attributes: ["statusCode": response.statusCode, "url": response.url?.absoluteString ?? ""]
        )
    }
    #endif
}
