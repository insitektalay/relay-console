import Foundation

public struct DocusignProviderHTTPRequest: Sendable {
    public let url: URL
    public let headers: [String: String]
    public init(url: URL, headers: [String: String]) { self.url = url; self.headers = headers }
}

public struct DocusignProviderHTTPResponse: Sendable {
    public let statusCode: Int
    public let headers: [String: String]
    public let body: Data
    public init(statusCode: Int, headers: [String: String] = [:], body: Data = Data()) { self.statusCode = statusCode; self.headers = headers; self.body = body }
}

public protocol DocusignProviderHTTPClient: Sendable {
    func send(_ request: DocusignProviderHTTPRequest) throws -> DocusignProviderHTTPResponse
}

private final class DocusignNoRedirectDelegate: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}

public struct URLSessionDocusignProviderHTTPClient: DocusignProviderHTTPClient {
    public init() {}
    public func send(_ request: DocusignProviderHTTPRequest) throws -> DocusignProviderHTTPResponse {
        var value = URLRequest(url: request.url)
        value.httpMethod = "GET"
        value.timeoutInterval = 20
        request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) }
        let session = URLSession(configuration: .ephemeral, delegate: DocusignNoRedirectDelegate(), delegateQueue: nil)
        let semaphore = DispatchSemaphore(value: 0)
        var data: Data?, response: HTTPURLResponse?, failure: Error?
        let task = session.dataTask(with: value) { data = $0; response = $1 as? HTTPURLResponse; failure = $2; semaphore.signal() }
        task.resume()
        if semaphore.wait(timeout: .now() + 20) == .timedOut {
            task.cancel()
            throw MarketplaceProviderActionAdapterFailure(code: "docusign_http_timeout", message: "Docusign eSignature API request timed out.")
        }
        session.invalidateAndCancel()
        if let failure { throw failure }
        return DocusignProviderHTTPResponse(statusCode: response?.statusCode ?? 0, headers: response?.allHeaderFields.reduce(into: [:]) { $0[String(describing: $1.key)] = String(describing: $1.value) } ?? [:], body: data ?? Data())
    }
}

public struct DocusignProviderActionClientResult: Sendable {
    public let result: JSONRecord
    public init(result: JSONRecord) { self.result = result }
}

public protocol DocusignProviderActionClient: Sendable {
    func executeDocusignAction(request: MarketplaceProviderActionAdapterRequest) throws -> DocusignProviderActionClientResult
}

public struct FakeDocusignProviderActionClient: DocusignProviderActionClient {
    public init() {}
    public func executeDocusignAction(request: MarketplaceProviderActionAdapterRequest) throws -> DocusignProviderActionClientResult {
        switch request.definition.actionKey {
        case "docusign_envelope_list_recent": return output(["semanticReadContract": .string("docusign-envelope-list-recent-v1"), "envelopes": .array([.object(DocusignProviderActionSupport.fakeEnvelope())])])
        case "docusign_envelope_list_action_required": return output(["semanticReadContract": .string("docusign-envelope-list-action-required-v1"), "envelopes": .array([.object(DocusignProviderActionSupport.fakeEnvelope())])])
        case "docusign_envelope_get": return output(["semanticReadContract": .string("docusign-envelope-get-v1"), "envelope": .object(DocusignProviderActionSupport.fakeEnvelope())])
        default: throw MarketplaceProviderActionAdapterFailure(code: "docusign_fake_action_not_supported", message: "Unsupported Docusign action.")
        }
    }
    private func output(_ fields: JSONRecord) -> DocusignProviderActionClientResult {
        DocusignProviderActionClientResult(
            result: ["provider": .string("docusign"), "adapterBoundary": .string("docusign-provider-action-adapter"), "clientMode": .string("fake-docusign-esign-v2.1"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-envelope-state-excluded")].merging(fields) { _, new in
                new
            })
    }
}

public final class LiveDocusignProviderActionClient: DocusignProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService
    private let secrets: SecretService
    private let http: any DocusignProviderHTTPClient
    private let now: @Sendable () -> Date
    private let pollingLock = NSLock()
    private var exactEnvelopeReads: [String: Date] = [:]

    public init(data: LocalDataService, secrets: SecretService, httpClient: any DocusignProviderHTTPClient = URLSessionDocusignProviderHTTPClient(), now: @escaping @Sendable () -> Date = { Date() }) {
        self.data = data; self.secrets = secrets; self.http = httpClient; self.now = now
    }

    public func executeDocusignAction(request: MarketplaceProviderActionAdapterRequest) throws -> DocusignProviderActionClientResult {
        let auth = try authorization(request)
        switch request.definition.actionKey {
        case "docusign_envelope_list_recent", "docusign_envelope_list_action_required":
            let actionRequired = request.definition.actionKey == "docusign_envelope_list_action_required"
            let root = try get(auth, path: "/v2.1/accounts/\(auth.accountId)/envelopes", query: DocusignProviderActionSupport.envelopeListQuery(now: now(), actionRequired: actionRequired))
            let values = (root.docusignObject?["envelopes"]?.docusignArray ?? []).prefix(25).map { JSONValue.object(DocusignProviderActionSupport.envelope($0)) }
            return output(["semanticReadContract": .string(actionRequired ? "docusign-envelope-list-action-required-v1" : "docusign-envelope-list-recent-v1"), "envelopes": .array(Array(values))])
        case "docusign_envelope_get":
            let envelopeId = try DocusignProviderActionSupport.uuid(request.payload["envelopeId"])
            try enforcePollingGuard(accountId: auth.accountId, envelopeId: envelopeId)
            let root = try get(auth, path: "/v2.1/accounts/\(auth.accountId)/envelopes/\(envelopeId)", query: [])
            return output(["semanticReadContract": .string("docusign-envelope-get-v1"), "envelope": .object(DocusignProviderActionSupport.envelope(root))])
        default: throw MarketplaceProviderActionAdapterFailure(code: "docusign_live_action_not_supported", message: "Unsupported live Docusign action.")
        }
    }

    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> (token: String, accountId: String, baseURI: String) {
        guard let connectionId = request.auditIdentity.connectionId,
              let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: connectionId),
              connection.appSlug == "docusign",
              connection.grantedScopes == ProviderConnectionService.docusignRelayOwnedOAuthScopes,
              let accountId = connection.health.diagnostics["accountId"]?.string,
              DocusignProviderActionSupport.safeAccountId(accountId),
              let baseURI = connection.health.diagnostics["baseURI"]?.string,
              DocusignProviderActionSupport.validBaseURI(baseURI),
              let reference = connection.credentialRequirements.first(where: { $0.fieldKey == "docusign_oauth_access_token" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "docusign_connection_not_ready", message: "Docusign user and selected-account connection is not ready.") }
        return (try secrets.getSecretValue(reference), accountId, baseURI)
    }

    private func get(_ auth: (token: String, accountId: String, baseURI: String), path: String, query: [URLQueryItem]) throws -> JSONValue {
        var components = URLComponents(string: auth.baseURI + "/restapi" + path)!
        components.queryItems = query.isEmpty ? nil : query
        let response = try http.send(DocusignProviderHTTPRequest(url: components.url!, headers: ["Authorization": "Bearer " + auth.token, "Accept": "application/json"]))
        let value = (try? JSONSerialization.jsonObject(with: response.body)).map(DocusignProviderActionSupport.json) ?? .null
        guard (200..<300).contains(response.statusCode) else {
            let code =
                response.statusCode == 301 || response.statusCode == 302
                ? "docusign_redirect_blocked"
                : response.statusCode == 401 ? "docusign_token_invalid_or_expired" : response.statusCode == 403 ? "docusign_account_permission_forbidden" : response.statusCode == 404 ? "docusign_envelope_not_found" : response.statusCode == 429 ? "docusign_rate_limited" : "docusign_api_error"
            throw MarketplaceProviderActionAdapterFailure(
                code: code, message: "Docusign eSignature API request failed.", providerStatusCode: response.statusCode, detail: ["rateLimitRemaining": response.headers.first { $0.key.lowercased() == "x-ratelimit-remaining" }.map { .string(String($0.value.prefix(32))) } ?? .null])
        }
        return value
    }

    private func enforcePollingGuard(accountId: String, envelopeId: String) throws {
        let key = accountId + ":" + envelopeId, current = now()
        pollingLock.lock(); defer { pollingLock.unlock() }
        exactEnvelopeReads = exactEnvelopeReads.filter { current.timeIntervalSince($0.value) < 900 }
        if let previous = exactEnvelopeReads[key], current.timeIntervalSince(previous) < 900 {
            throw MarketplaceProviderActionAdapterFailure(code: "docusign_polling_guard", message: "Docusign forbids repeating an exact Envelope resource request within fifteen minutes.")
        }
        exactEnvelopeReads[key] = current
    }

    private func output(_ fields: JSONRecord) -> DocusignProviderActionClientResult {
        DocusignProviderActionClientResult(
            result: ["provider": .string("docusign"), "adapterBoundary": .string("docusign-provider-action-adapter"), "clientMode": .string("live-docusign-esign-v2.1"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-envelope-state-excluded")].merging(fields) { _, new in
                new
            })
    }
}

public struct DocusignProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = ["docusign_envelope_list_recent", "docusign_envelope_list_action_required", "docusign_envelope_get"]
    private let client: any DocusignProviderActionClient
    public init(client: any DocusignProviderActionClient = FakeDocusignProviderActionClient()) { self.client = client }
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "docusign", Self.allowed.contains(request.definition.actionKey) else { throw MarketplaceProviderActionAdapterFailure(code: "docusign_action_not_allowlisted", message: "Docusign action is outside bounded read-only Envelope V1.") }
        return MarketplaceProviderActionAdapterResult(result: try client.executeDocusignAction(request: request).result, error: nil, redactionStatus: "private-envelope-state-excluded")
    }
}

enum DocusignProviderActionSupport {
    static func envelopeListQuery(now: Date, actionRequired: Bool) -> [URLQueryItem] {
        let formatter = ISO8601DateFormatter(); formatter.formatOptions = [.withInternetDateTime]
        var result = [URLQueryItem(name: "from_date", value: formatter.string(from: now.addingTimeInterval(-14 * 86_400))), URLQueryItem(name: "count", value: "25"), URLQueryItem(name: "order_by", value: "last_modified"), URLQueryItem(name: "order", value: "desc")]
        if actionRequired { result.append(URLQueryItem(name: "folder_ids", value: "awaiting_my_signature")) }
        return result
    }
    static func uuid(_ value: JSONValue?) throws -> String {
        guard let raw = value?.string, UUID(uuidString: raw) != nil, raw.count == 36, raw.allSatisfy({ $0.isHexDigit || $0 == "-" }) else { throw MarketplaceProviderActionAdapterFailure(code: "docusign_envelope_id_invalid", message: "An exact Docusign Envelope UUID is required.") }
        return raw.lowercased()
    }
    static func safeAccountId(_ raw: String) -> Bool { !raw.isEmpty && raw.count <= 64 && raw.allSatisfy { $0.isHexDigit || $0 == "-" } }
    static func validBaseURI(_ raw: String) -> Bool {
        guard let c = URLComponents(string: raw), c.scheme == "https", c.user == nil, c.password == nil, c.port == nil, (c.path.isEmpty || c.path == "/"), c.query == nil, c.fragment == nil, let host = c.host?.lowercased() else { return false }
        let labels = host.split(separator: ".")
        return labels.count == 3 && labels[1] == "docusign" && labels[2] == "net" && labels[0].allSatisfy { $0.isLetter || $0.isNumber || $0 == "-" }
    }
    static func envelope(_ value: JSONValue) -> JSONRecord {
        let object = value.docusignObject ?? [:]
        return [
            "EnvelopeId": scalar(object["envelopeId"]), "EmailSubject": scalar(object["emailSubject"]), "Status": scalar(object["status"]), "CreatedDateTime": scalar(object["createdDateTime"]), "SentDateTime": scalar(object["sentDateTime"]), "CompletedDateTime": scalar(object["completedDateTime"]),
            "StatusChangedDateTime": scalar(object["statusChangedDateTime"]), "LastModifiedDateTime": scalar(object["lastModifiedDateTime"]),
        ]
    }
    static func scalar(_ value: JSONValue?) -> JSONValue { guard let value else { return .null }; switch value { case .string, .number, .bool, .null: return value; default: return .null } }
    static func json(_ any: Any) -> JSONValue {
        if any is NSNull { return .null }; if let value = any as? Bool { return .bool(value) }; if let value = any as? String { return .string(value) }; if let value = any as? NSNumber { return .number(value.doubleValue) }; if let value = any as? [Any] { return .array(value.map(json)) };
        if let value = any as? [String: Any] { return .object(value.mapValues(json)) }; return .null
    }
    static func fakeEnvelope() -> JSONRecord {
        [
            "EnvelopeId": .string("11111111-2222-3333-4444-555555555555"), "EmailSubject": .string("Relay agreement"), "Status": .string("sent"), "CreatedDateTime": .string("2026-07-01T09:00:00Z"), "SentDateTime": .string("2026-07-01T09:05:00Z"), "CompletedDateTime": .null,
            "StatusChangedDateTime": .string("2026-07-01T09:05:00Z"), "LastModifiedDateTime": .string("2026-07-01T09:05:00Z"),
        ]
    }
}

private extension JSONValue {
    var docusignObject: JSONRecord? { if case .object(let value) = self { return value }; return nil }
    var docusignArray: [JSONValue]? { if case .array(let value) = self { return value }; return nil }
}
