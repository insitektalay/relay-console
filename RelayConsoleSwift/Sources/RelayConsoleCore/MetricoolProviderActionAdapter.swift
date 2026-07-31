import Foundation

public struct MetricoolProviderHTTPRequest: Sendable { public let url: URL; public let headers: [String: String] }
public struct MetricoolProviderHTTPResponse: Sendable { public let statusCode: Int; public let body: Data }
public protocol MetricoolProviderHTTPClient: Sendable { func send(_ request: MetricoolProviderHTTPRequest) throws -> MetricoolProviderHTTPResponse }
private final class MetricoolNoRedirect: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}

public struct URLSessionMetricoolProviderHTTPClient: MetricoolProviderHTTPClient {
    public init() {}
    public func send(_ request: MetricoolProviderHTTPRequest) throws -> MetricoolProviderHTTPResponse {
        var value = URLRequest(url: request.url); value.httpMethod = "GET"; value.timeoutInterval = 20; request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) }
        let session = URLSession(configuration: .ephemeral, delegate: MetricoolNoRedirect(), delegateQueue: nil), semaphore = DispatchSemaphore(value: 0); var data = Data(), status = 0, failure: Error?
        let task = session.dataTask(with: value) { data = $0 ?? Data(); status = ($1 as? HTTPURLResponse)?.statusCode ?? 0; failure = $2; semaphore.signal() }; task.resume()
        if semaphore.wait(timeout: .now() + 20) == .timedOut { task.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "metricool_http_timeout", message: "Metricool request timed out.") }
        session.invalidateAndCancel(); if let failure { throw failure }; return MetricoolProviderHTTPResponse(statusCode: status, body: data)
    }
}

public protocol MetricoolProviderActionClient: Sendable { func executeMetricoolAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord }
public struct FakeMetricoolProviderActionClient: MetricoolProviderActionClient {
    public init() {}
    public func executeMetricoolAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord { ["provider": .string("metricool"), "action": .string(request.definition.actionKey), "redactionStatus": .string("identity-and-content-excluded"), "liveCredentialsUsed": .bool(false)] }
}

public final class LiveMetricoolProviderActionClient: MetricoolProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService; private let secrets: SecretService; private let http: any MetricoolProviderHTTPClient
    public init(data: LocalDataService, secrets: SecretService, httpClient: any MetricoolProviderHTTPClient = URLSessionMetricoolProviderHTTPClient()) { self.data = data; self.secrets = secrets; self.http = httpClient }

    public func executeMetricoolAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        let credentials = try authorization(request), action = request.definition.actionKey, path: String
        if action == "metricool_brand_list" { path = "/api/admin/simpleProfiles" }
        else if action == "metricool_connected_network_list" { path = "/api/admin/blog/profiles" }
        else { throw MarketplaceProviderActionAdapterFailure(code: "metricool_action_not_allowlisted", message: "Metricool action is not allowlisted.") }
        var components = URLComponents(string: "https://app.metricool.com")!; components.path = path; components.queryItems = [URLQueryItem(name: "userId", value: credentials.user), URLQueryItem(name: "blogId", value: credentials.blog)]
        let response = try http.send(MetricoolProviderHTTPRequest(url: components.url!, headers: ["X-Mc-Auth": credentials.token, "Accept": "application/json", "Content-Type": "application/json", "User-Agent": "RelayConsole-Metricool/1.0"]))
        guard response.body.count <= 1_000_000 else { throw MarketplaceProviderActionAdapterFailure(code: "metricool_response_too_large", message: "Metricool response exceeded 1 MB.") }
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: response.statusCode == 401 ? "metricool_token_invalid" : response.statusCode == 403 || response.statusCode == 404 ? "metricool_permission_denied" : response.statusCode == 429 ? "metricool_rate_limited" : "metricool_api_error", message: "Metricool API request failed.",
                providerStatusCode: response.statusCode)
        }
        guard let any = try? JSONSerialization.jsonObject(with: response.body) else { throw MarketplaceProviderActionAdapterFailure(code: "metricool_response_invalid", message: "Metricool returned invalid JSON.") }
        let root = Self.json(any)
        return action == "metricool_brand_list" ? Self.brandResult(root, boundBlog: credentials.blog) : Self.networkResult(root, blog: credentials.blog)
    }

    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> (token: String, user: String, blog: String) {
        guard let id = request.auditIdentity.connectionId, let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), connection.appSlug == "metricool", connection.health.diagnostics["apiOrigin"]?.string == "https://app.metricool.com/api",
            let tokenRef = connection.credentialRequirements.first(where: { $0.fieldKey == "metricool_user_token" })?.secretReferenceId, let userRef = connection.credentialRequirements.first(where: { $0.fieldKey == "metricool_user_id" })?.secretReferenceId,
            let blogRef = connection.credentialRequirements.first(where: { $0.fieldKey == "metricool_blog_id" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "metricool_connection_not_ready", message: "Metricool connection is not ready.") }
        let token = try secrets.getSecretValue(tokenRef), user = try secrets.getSecretValue(userRef), blog = try secrets.getSecretValue(blogRef)
        guard !token.isEmpty, Self.safeId(user), Self.safeId(blog) else { throw MarketplaceProviderActionAdapterFailure(code: "metricool_credentials_invalid", message: "Metricool credential binding is invalid.") }; return (token, user, blog)
    }

    private static func brandResult(_ root: JSONValue, boundBlog: String) -> JSONRecord {
        let object = root.metricoolObject ?? [:], source = root.metricoolArray ?? object["data"]?.metricoolArray ?? object["blogs"]?.metricoolArray ?? object["profiles"]?.metricoolArray ?? []
        let brands = source.prefix(25).compactMap { value -> JSONValue? in
            let item = value.metricoolObject ?? [:], raw = item["blogId"] ?? item["id"] ?? item["blog_id"], id = raw?.string ?? raw?.number.map { String(format: "%.0f", $0) }; guard let id, safeId(id) else { return nil }; return .object(["blogId": .string(id)])
        }
        return ["boundBlogId": .string(boundBlog), "brands": .array(brands), "redactionStatus": .string("brand-identity-excluded")]
    }

    private static func networkResult(_ root: JSONValue, blog: String) -> JSONRecord {
        let object = root.metricoolObject ?? [:],
            networks = object.sorted { $0.key < $1.key }.prefix(100).compactMap { key, value -> JSONValue? in
                guard safeNetwork(key) else { return nil }; let item = value.metricoolObject ?? [:], connected = value.bool ?? item["connected"]?.bool ?? item["active"]?.bool; return .object(["network": .string(key), "connected": connected.map(JSONValue.bool) ?? .null])
            }.prefix(25)
        return ["blogId": .string(blog), "networks": .array(Array(networks)), "redactionStatus": .string("network-identity-excluded")]
    }

    private static func safeId(_ value: String) -> Bool { value.range(of: #"^[0-9]{1,20}$"#, options: .regularExpression) != nil }
    private static func safeNetwork(_ value: String) -> Bool { value.range(of: #"^[A-Za-z][A-Za-z0-9_-]{0,63}$"#, options: .regularExpression) != nil }
    private static func json(_ any: Any) -> JSONValue {
        if any is NSNull { return .null }; if let value = any as? Bool { return .bool(value) }; if let value = any as? String { return .string(value) }; if let value = any as? NSNumber { return .number(value.doubleValue) }; if let value = any as? [Any] { return .array(value.map(json)) };
        if let value = any as? [String: Any] { return .object(value.mapValues(json)) }; return .null
    }
}

public struct MetricoolProviderActionAdapter: MarketplaceProviderActionAdapter {
    private let client: any MetricoolProviderActionClient
    public init(client: any MetricoolProviderActionClient = FakeMetricoolProviderActionClient()) { self.client = client }
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "metricool" else { throw MarketplaceProviderActionAdapterFailure(code: "metricool_action_not_allowlisted", message: "Metricool action is not allowlisted.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executeMetricoolAction(request: request), error: nil, redactionStatus: "identity-and-content-excluded")
    }
}

extension JSONValue { fileprivate var metricoolObject: JSONRecord? { if case .object(let value) = self { return value }; return nil }; fileprivate var metricoolArray: [JSONValue]? { if case .array(let value) = self { return value }; return nil } }
