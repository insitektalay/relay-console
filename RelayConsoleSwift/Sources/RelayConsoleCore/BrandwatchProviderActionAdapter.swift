import Foundation

public struct BrandwatchProviderHTTPRequest: Sendable { public let url: URL; public let headers: [String: String] }
public struct BrandwatchProviderHTTPResponse: Sendable { public let statusCode: Int; public let body: Data }
public protocol BrandwatchProviderHTTPClient: Sendable { func send(_ request: BrandwatchProviderHTTPRequest) throws -> BrandwatchProviderHTTPResponse }
private final class BrandwatchNoRedirect: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}

public struct URLSessionBrandwatchProviderHTTPClient: BrandwatchProviderHTTPClient {
    public init() {}
    public func send(_ request: BrandwatchProviderHTTPRequest) throws -> BrandwatchProviderHTTPResponse {
        var value = URLRequest(url: request.url); value.httpMethod = "GET"; value.timeoutInterval = 20; request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) }
        let session = URLSession(configuration: .ephemeral, delegate: BrandwatchNoRedirect(), delegateQueue: nil), semaphore = DispatchSemaphore(value: 0); var data = Data(), status = 0, failure: Error?
        let task = session.dataTask(with: value) { data = $0 ?? Data(); status = ($1 as? HTTPURLResponse)?.statusCode ?? 0; failure = $2; semaphore.signal() }; task.resume()
        if semaphore.wait(timeout: .now() + 20) == .timedOut { task.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "brandwatch_http_timeout", message: "Brandwatch request timed out.") }
        session.invalidateAndCancel(); if let failure { throw failure }; return BrandwatchProviderHTTPResponse(statusCode: status, body: data)
    }
}

public protocol BrandwatchProviderActionClient: Sendable { func executeBrandwatchAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord }
public struct FakeBrandwatchProviderActionClient: BrandwatchProviderActionClient {
    public init() {}
    public func executeBrandwatchAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord { ["provider": .string("brandwatch"), "action": .string(request.definition.actionKey), "redactionStatus": .string("identity-and-content-excluded"), "liveCredentialsUsed": .bool(false)] }
}

public final class LiveBrandwatchProviderActionClient: BrandwatchProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService; private let secrets: SecretService; private let http: any BrandwatchProviderHTTPClient
    public init(data: LocalDataService, secrets: SecretService, httpClient: any BrandwatchProviderHTTPClient = URLSessionBrandwatchProviderHTTPClient()) { self.data = data; self.secrets = secrets; self.http = httpClient }

    public func executeBrandwatchAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        let credentials = try authorization(request), action = request.definition.actionKey, path: String
        if action == "brandwatch_project_reference_list" { path = "/projects/summary" }
        else if action == "brandwatch_query_structure_list" { path = "/projects/" + credentials.project + "/queries/summary" }
        else { throw MarketplaceProviderActionAdapterFailure(code: "brandwatch_action_not_allowlisted", message: "Brandwatch action is not allowlisted.") }
        let headers = ["Authorization": "Bearer " + credentials.token, "Accept": "application/json", "User-Agent": "RelayConsole-Brandwatch/1.0"]
        let response = try http.send(BrandwatchProviderHTTPRequest(url: URL(string: "https://api.brandwatch.com" + path)!, headers: headers))
        guard response.body.count <= 1_000_000 else { throw MarketplaceProviderActionAdapterFailure(code: "brandwatch_response_too_large", message: "Brandwatch response exceeded 1 MB.") }
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: response.statusCode == 401 ? "brandwatch_token_invalid" : response.statusCode == 403 || response.statusCode == 404 ? "brandwatch_permission_denied" : response.statusCode == 429 ? "brandwatch_rate_limited" : "brandwatch_api_error", message: "Brandwatch API request failed.",
                providerStatusCode: response.statusCode)
        }
        guard let any = try? JSONSerialization.jsonObject(with: response.body) else { throw MarketplaceProviderActionAdapterFailure(code: "brandwatch_response_invalid", message: "Brandwatch returned invalid JSON.") }
        let root = Self.json(any)
        return action == "brandwatch_project_reference_list" ? Self.projectResult(root, boundProject: credentials.project) : Self.queryResult(root, project: credentials.project)
    }

    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> (token: String, project: String) {
        guard let id = request.auditIdentity.connectionId, let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), connection.appSlug == "brandwatch", connection.health.diagnostics["apiOrigin"]?.string == "https://api.brandwatch.com",
            let tokenRef = connection.credentialRequirements.first(where: { $0.fieldKey == "brandwatch_access_token" })?.secretReferenceId, let projectRef = connection.credentialRequirements.first(where: { $0.fieldKey == "brandwatch_project_id" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "brandwatch_connection_not_ready", message: "Brandwatch connection is not ready.") }
        let token = try secrets.getSecretValue(tokenRef), project = try secrets.getSecretValue(projectRef)
        guard !token.isEmpty, Self.safeId(project) else { throw MarketplaceProviderActionAdapterFailure(code: "brandwatch_credentials_invalid", message: "Brandwatch credential binding is invalid.") }; return (token, project)
    }

    private static func projectResult(_ root: JSONValue, boundProject: String) -> JSONRecord {
        let object = root.brandwatchObject ?? [:], source = object["results"]?.brandwatchArray ?? []
        let projects = source.prefix(25).compactMap { value -> JSONValue? in
            let item = value.brandwatchObject ?? [:], id = item["id"]?.number.map { String(Int($0)) } ?? item["id"]?.string; guard let id, safeId(id) else { return nil }; let timezone = item["timezone"]?.string.flatMap { safeTimezone($0) ? $0 : nil };
            return .object(["projectId": .string(id), "timezone": timezone.map(JSONValue.string) ?? .null])
        }
        return ["boundProjectId": .string(boundProject), "projects": .array(projects), "redactionStatus": .string("project-and-client-identity-excluded")]
    }

    private static func queryResult(_ root: JSONValue, project: String) -> JSONRecord {
        let object = root.brandwatchObject ?? [:], source = object["results"]?.brandwatchArray ?? []
        let queries = source.prefix(25).compactMap { value -> JSONValue? in
            let item = value.brandwatchObject ?? [:], id = item["id"]?.number.map { String(Int($0)) } ?? item["id"]?.string; guard let id, safeId(id) else { return nil }; let type = item["type"]?.string.flatMap { safeEnum($0) ? $0 : nil };
            return .object(["queryId": .string(id), "type": type.map(JSONValue.string) ?? .null])
        }
        return ["projectId": .string(project), "queries": .array(queries), "redactionStatus": .string("query-identity-and-content-excluded")]
    }

    private static func safeId(_ value: String) -> Bool { value.range(of: #"^[1-9][0-9]{0,19}$"#, options: .regularExpression) != nil }
    private static func safeEnum(_ value: String) -> Bool { value.range(of: #"^[A-Za-z0-9_-]{1,64}$"#, options: .regularExpression) != nil }
    private static func safeTimezone(_ value: String) -> Bool { value.range(of: #"^[A-Za-z0-9_+./-]{1,64}$"#, options: .regularExpression) != nil }
    private static func json(_ any: Any) -> JSONValue {
        if any is NSNull { return .null }; if let value = any as? Bool { return .bool(value) }; if let value = any as? String { return .string(value) }; if let value = any as? NSNumber { return .number(value.doubleValue) }; if let value = any as? [Any] { return .array(value.map(json)) };
        if let value = any as? [String: Any] { return .object(value.mapValues(json)) }; return .null
    }
}

public struct BrandwatchProviderActionAdapter: MarketplaceProviderActionAdapter {
    private let client: any BrandwatchProviderActionClient
    public init(client: any BrandwatchProviderActionClient = FakeBrandwatchProviderActionClient()) { self.client = client }
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "brandwatch" else { throw MarketplaceProviderActionAdapterFailure(code: "brandwatch_action_not_allowlisted", message: "Brandwatch action is not allowlisted.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executeBrandwatchAction(request: request), error: nil, redactionStatus: "identity-and-content-excluded")
    }
}

extension JSONValue { fileprivate var brandwatchObject: JSONRecord? { if case .object(let value) = self { return value }; return nil }; fileprivate var brandwatchArray: [JSONValue]? { if case .array(let value) = self { return value }; return nil } }
