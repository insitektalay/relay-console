import Foundation

public struct AgorapulseProviderHTTPRequest: Sendable { public let url: URL; public let headers: [String: String] }
public struct AgorapulseProviderHTTPResponse: Sendable { public let statusCode: Int; public let body: Data }
public protocol AgorapulseProviderHTTPClient: Sendable { func send(_ request: AgorapulseProviderHTTPRequest) throws -> AgorapulseProviderHTTPResponse }
private final class AgorapulseNoRedirect: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}
public struct URLSessionAgorapulseProviderHTTPClient: AgorapulseProviderHTTPClient {
    public init() {}
    public func send(_ request: AgorapulseProviderHTTPRequest) throws -> AgorapulseProviderHTTPResponse {
        var value = URLRequest(url: request.url); value.httpMethod = "GET"; value.timeoutInterval = 20; request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) }
        let session = URLSession(configuration: .ephemeral, delegate: AgorapulseNoRedirect(), delegateQueue: nil), semaphore = DispatchSemaphore(value: 0); var data = Data(), status = 0, failure: Error?
        let task = session.dataTask(with: value) { data = $0 ?? Data(); status = ($1 as? HTTPURLResponse)?.statusCode ?? 0; failure = $2; semaphore.signal() }; task.resume()
        if semaphore.wait(timeout: .now() + 20) == .timedOut { task.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "agorapulse_http_timeout", message: "Agorapulse request timed out.") }
        session.invalidateAndCancel(); if let failure { throw failure }; return AgorapulseProviderHTTPResponse(statusCode: status, body: data)
    }
}

public protocol AgorapulseProviderActionClient: Sendable { func executeAgorapulseAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord }
public struct FakeAgorapulseProviderActionClient: AgorapulseProviderActionClient {
    public init() {}
    public func executeAgorapulseAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord { ["provider": .string("agorapulse"), "action": .string(request.definition.actionKey), "redactionStatus": .string("identity-and-content-excluded"), "liveCredentialsUsed": .bool(false)] }
}

public final class LiveAgorapulseProviderActionClient: AgorapulseProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService; private let secrets: SecretService; private let http: any AgorapulseProviderHTTPClient
    public init(data: LocalDataService, secrets: SecretService, httpClient: any AgorapulseProviderHTTPClient = URLSessionAgorapulseProviderHTTPClient()) { self.data = data; self.secrets = secrets; self.http = httpClient }

    public func executeAgorapulseAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        let credentials = try authorization(request), action = request.definition.actionKey, path: String, query: [URLQueryItem]
        if action == "agorapulse_profile_list" {
            path = "/v1.0/core/organizations/\(credentials.organization)/workspaces/\(credentials.workspace)/profiles"; query = []
        } else {
            guard ["agorapulse_audience_report_get", "agorapulse_community_report_get", "agorapulse_content_report_get"].contains(action), let profile = request.payload["profileUid"]?.string, Self.safeId(profile), let since = request.payload["since"]?.string,
                let until = request.payload["until"]?.string, let start = ISO8601DateFormatter().date(from: since), let end = ISO8601DateFormatter().date(from: until), end >= start, end.timeIntervalSince(start) <= 31 * 86_400
            else { throw MarketplaceProviderActionAdapterFailure(code: "agorapulse_input_invalid", message: "Agorapulse requires an exact profile UID and an RFC3339 window no longer than 31 days.") }
            let report = action == "agorapulse_audience_report_get" ? "audience" : action == "agorapulse_community_report_get" ? "communitymanagement" : "content"
            path = "/v1.0/report/organizations/\(credentials.organization)/workspaces/\(credentials.workspace)/profiles/\(profile)/insights/\(report)"; query = [URLQueryItem(name: "since", value: since), URLQueryItem(name: "until", value: until)]
        }
        var components = URLComponents(string: "https://api.agorapulse.com")!; components.path = path; components.queryItems = query.isEmpty ? nil : query
        let response = try http.send(AgorapulseProviderHTTPRequest(url: components.url!, headers: ["Authorization": "Bearer " + credentials.key, "Accept": "application/json", "User-Agent": "RelayConsole-Agorapulse/1.0"]))
        guard response.body.count <= 2_000_000 else { throw MarketplaceProviderActionAdapterFailure(code: "agorapulse_response_too_large", message: "Agorapulse response exceeded 2 MB.") }
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: response.statusCode == 401 ? "agorapulse_key_invalid" : response.statusCode == 403 || response.statusCode == 404 ? "agorapulse_permission_denied" : response.statusCode == 429 ? "agorapulse_rate_limited" : "agorapulse_api_error", message: "Agorapulse API request failed.",
                providerStatusCode: response.statusCode)
        }
        let root = (try? JSONSerialization.jsonObject(with: response.body)).map(Self.json) ?? .null
        if action == "agorapulse_profile_list" { return Self.profileResult(root, organization: credentials.organization, workspace: credentials.workspace) }
        return ["profileUid": request.payload["profileUid"] ?? .null, "since": request.payload["since"] ?? .null, "until": request.payload["until"] ?? .null, "metrics": Self.redact(root, depth: 0), "redactionStatus": .string("identity-and-content-excluded")]
    }

    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> (key: String, organization: String, workspace: String) {
        guard let id = request.auditIdentity.connectionId, let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), connection.appSlug == "agorapulse", connection.health.diagnostics["apiOrigin"]?.string == "https://api.agorapulse.com",
            let keyRef = connection.credentialRequirements.first(where: { $0.fieldKey == "agorapulse_api_key" })?.secretReferenceId, let organizationRef = connection.credentialRequirements.first(where: { $0.fieldKey == "agorapulse_organization_id" })?.secretReferenceId,
            let workspaceRef = connection.credentialRequirements.first(where: { $0.fieldKey == "agorapulse_workspace_id" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "agorapulse_connection_not_ready", message: "Agorapulse connection is not ready.") }
        let key = try secrets.getSecretValue(keyRef), organization = try secrets.getSecretValue(organizationRef), workspace = try secrets.getSecretValue(workspaceRef)
        guard !key.isEmpty, Self.safeId(organization), Self.safeId(workspace) else { throw MarketplaceProviderActionAdapterFailure(code: "agorapulse_credentials_invalid", message: "Agorapulse credential binding is invalid.") }; return (key, organization, workspace)
    }

    private static func profileResult(_ root: JSONValue, organization: String, workspace: String) -> JSONRecord {
        let object = root.objectValue ?? [:], source = root.arrayValue ?? object["data"]?.arrayValue ?? object["profiles"]?.arrayValue ?? []
        let profiles = source.prefix(25).compactMap { value -> JSONValue? in
            let item = value.objectValue ?? [:], uid = item["uid"]?.string ?? item["profileUid"]?.string ?? item["id"]?.string; guard let uid, safeId(uid) else { return nil }; let network = item["network"]?.string ?? item["type"]?.string ?? item["service"]?.string;
            return .object(["profileUid": .string(uid), "network": network.map(JSONValue.string) ?? .null, "active": item["active"] ?? .null])
        }
        return ["organizationId": .string(organization), "workspaceId": .string(workspace), "profiles": .array(profiles), "redactionStatus": .string("identity-and-content-excluded")]
    }
    private static let privateKey = try! NSRegularExpression(pattern: #"(?:^|_)(?:id|uid|name|username|handle|email|text|message|title|description|url|link|media|image|video|author|owner|profile|post|content|caption|bio)(?:$|_)"#, options: [.caseInsensitive])
    private static func redact(_ value: JSONValue, depth: Int) -> JSONValue {
        if depth > 5 { return .null };
        switch value {
        case .null, .bool, .number: return value;
        case .string: return .null;
        case .array(let values): return .array(Array(values.prefix(25)).map { redact($0, depth: depth + 1) });
        case .object(let object):
            var result: JSONRecord = [:];
            for (key, entry) in object.prefix(100) {
                let range = NSRange(key.startIndex..<key.endIndex, in: key); if privateKey.firstMatch(in: key, range: range) != nil { continue }; let redacted = redact(entry, depth: depth + 1); if case .null = redacted { continue }; result[String(key.prefix(100))] = redacted
            }; return .object(result)
        }
    }
    private static func safeId(_ value: String) -> Bool { value.range(of: #"^[A-Za-z0-9_-]{1,128}$"#, options: .regularExpression) != nil }
    private static func json(_ any: Any) -> JSONValue {
        if any is NSNull { return .null }; if let value = any as? Bool { return .bool(value) }; if let value = any as? String { return .string(value) }; if let value = any as? NSNumber { return .number(value.doubleValue) }; if let value = any as? [Any] { return .array(value.map(json)) };
        if let value = any as? [String: Any] { return .object(value.mapValues(json)) }; return .null
    }
}

public struct AgorapulseProviderActionAdapter: MarketplaceProviderActionAdapter {
    private let client: any AgorapulseProviderActionClient
    public init(client: any AgorapulseProviderActionClient = FakeAgorapulseProviderActionClient()) { self.client = client }
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "agorapulse" else { throw MarketplaceProviderActionAdapterFailure(code: "agorapulse_action_not_allowlisted", message: "Agorapulse action is not allowlisted.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executeAgorapulseAction(request: request), error: nil, redactionStatus: "identity-and-content-excluded")
    }
}

extension JSONValue { fileprivate var objectValue: JSONRecord? { if case .object(let value) = self { return value }; return nil }; fileprivate var arrayValue: [JSONValue]? { if case .array(let value) = self { return value }; return nil } }
