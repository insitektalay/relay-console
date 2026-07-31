import Foundation

public struct WrikeProviderHTTPRequest: Sendable { public let url: URL; public let headers: [String: String]; public init(url: URL, headers: [String: String]) { self.url = url; self.headers = headers } }
public struct WrikeProviderHTTPResponse: Sendable { public let statusCode: Int; public let headers: [String: String]; public let body: Data; public init(statusCode: Int, headers: [String: String] = [:], body: Data = Data()) { self.statusCode = statusCode; self.headers = headers; self.body = body } }
public protocol WrikeProviderHTTPClient: Sendable { func send(_ request: WrikeProviderHTTPRequest) throws -> WrikeProviderHTTPResponse }
private final class WrikeNoRedirectDelegate: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}
public struct URLSessionWrikeProviderHTTPClient: WrikeProviderHTTPClient {
    public init() {}
    public func send(_ request: WrikeProviderHTTPRequest) throws -> WrikeProviderHTTPResponse {
        var value = URLRequest(url: request.url); value.httpMethod = "GET"; value.timeoutInterval = 20; request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) };
        let session = URLSession(configuration: .ephemeral, delegate: WrikeNoRedirectDelegate(), delegateQueue: nil), semaphore = DispatchSemaphore(value: 0); var data: Data?, response: HTTPURLResponse?, failure: Error?;
        let task = session.dataTask(with: value) {
            data = $0; response = $1 as? HTTPURLResponse; failure = $2; semaphore.signal()
        }; task.resume(); if semaphore.wait(timeout: .now() + 20) == .timedOut { task.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "wrike_http_timeout", message: "Wrike API v4 request timed out.") }; session.invalidateAndCancel(); if let failure { throw failure };
        return WrikeProviderHTTPResponse(statusCode: response?.statusCode ?? 0, headers: response?.allHeaderFields.reduce(into: [:]) { $0[String(describing: $1.key)] = String(describing: $1.value) } ?? [:], body: data ?? Data())
    }
}

public struct WrikeProviderActionClientResult: Sendable { public let result: JSONRecord; public init(result: JSONRecord) { self.result = result } }
public protocol WrikeProviderActionClient: Sendable { func executeWrikeAction(request: MarketplaceProviderActionAdapterRequest) throws -> WrikeProviderActionClientResult }
public struct FakeWrikeProviderActionClient: WrikeProviderActionClient {
    public init() {}
    public func executeWrikeAction(request: MarketplaceProviderActionAdapterRequest) throws -> WrikeProviderActionClientResult {
        switch request.definition.actionKey {
        case "wrike_project_list": return output(["semanticReadContract": .string("wrike-project-list-v1"), "projects": .array([.object(WrikeProviderActionSupport.fakeProject())])]);
        case "wrike_task_list": return output(["semanticReadContract": .string("wrike-task-list-v1"), "tasks": .array([.object(WrikeProviderActionSupport.fakeTask())])]);
        case "wrike_task_get": return output(["semanticReadContract": .string("wrike-task-get-v1"), "task": .object(WrikeProviderActionSupport.fakeTask())]);
        default: throw MarketplaceProviderActionAdapterFailure(code: "wrike_fake_action_not_supported", message: "Unsupported Wrike action.")
        }
    }
    private func output(_ fields: JSONRecord) -> WrikeProviderActionClientResult {
        WrikeProviderActionClientResult(
            result: ["provider": .string("wrike"), "adapterBoundary": .string("wrike-provider-action-adapter"), "clientMode": .string("fake-wrike-api-v4"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-state-excluded")].merging(fields) { _, n in n })
    }
}

public final class LiveWrikeProviderActionClient: WrikeProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService; private let secrets: SecretService; private let http: any WrikeProviderHTTPClient
    public init(data: LocalDataService, secrets: SecretService, httpClient: any WrikeProviderHTTPClient = URLSessionWrikeProviderHTTPClient()) { self.data = data; self.secrets = secrets; self.http = httpClient }
    public func executeWrikeAction(request: MarketplaceProviderActionAdapterRequest) throws -> WrikeProviderActionClientResult {
        let auth = try authorization(request);
        switch request.definition.actionKey {
        case "wrike_project_list":
            let root = try get(auth, path: "/folders", query: WrikeProviderActionSupport.projectQuery), values = WrikeProviderActionSupport.data(root).prefix(25).map { JSONValue.object(WrikeProviderActionSupport.project($0)) };
            return output(["semanticReadContract": .string("wrike-project-list-v1"), "projects": .array(Array(values))]);
        case "wrike_task_list":
            let root = try get(auth, path: "/tasks", query: WrikeProviderActionSupport.taskQuery), values = WrikeProviderActionSupport.data(root).prefix(25).map { JSONValue.object(WrikeProviderActionSupport.task($0)) };
            return output(["semanticReadContract": .string("wrike-task-list-v1"), "tasks": .array(Array(values))]);
        case "wrike_task_get":
            let id = try WrikeProviderActionSupport.id(request.payload["taskId"]), root = try get(auth, path: "/tasks/\(id)", query: []), value = WrikeProviderActionSupport.data(root).first ?? .null;
            return output(["semanticReadContract": .string("wrike-task-get-v1"), "task": .object(WrikeProviderActionSupport.task(value))]);
        default: throw MarketplaceProviderActionAdapterFailure(code: "wrike_live_action_not_supported", message: "Unsupported live Wrike action.")
        }
    }
    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> (token: String, origin: URL) {
        guard let id = request.auditIdentity.connectionId, let c = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), c.appSlug == "wrike", c.grantedScopes == ["wsReadOnly"], let originText = c.health.diagnostics["apiOrigin"]?.string,
            let origin = WrikeProviderActionSupport.safeOrigin(originText), let ref = c.credentialRequirements.first(where: { $0.fieldKey == "wrike_oauth_access_token" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "wrike_connection_not_ready", message: "Wrike account connection is not ready.") }; return (try secrets.getSecretValue(ref), origin)
    }
    private func get(_ auth: (token: String, origin: URL), path: String, query: [URLQueryItem]) throws -> JSONValue {
        var components = URLComponents(url: auth.origin.appendingPathComponent(String(path.dropFirst())), resolvingAgainstBaseURL: false)!; components.queryItems = query.isEmpty ? nil : query;
        let response = try http.send(WrikeProviderHTTPRequest(url: components.url!, headers: ["Authorization": "Bearer " + auth.token, "Accept": "application/json", "User-Agent": "RelayConsole-Wrike/1.0"])),
            value = (try? JSONSerialization.jsonObject(with: response.body)).map(WrikeProviderActionSupport.json) ?? .null
        ;
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: response.statusCode == 301 || response.statusCode == 302
                    ? "wrike_redirect_blocked" : response.statusCode == 401 ? "wrike_token_or_host_invalid" : response.statusCode == 403 ? "wrike_access_forbidden" : response.statusCode == 404 ? "wrike_resource_not_found" : response.statusCode == 429 ? "wrike_rate_limited" : "wrike_api_error",
                message: "Wrike API v4 request failed.", providerStatusCode: response.statusCode, detail: ["retryAfter": response.headers.first { $0.key.lowercased() == "retry-after" }.map { .string(String($0.value.prefix(32))) } ?? .null])
        }; return value
    }
    private func output(_ fields: JSONRecord) -> WrikeProviderActionClientResult {
        WrikeProviderActionClientResult(
            result: ["provider": .string("wrike"), "adapterBoundary": .string("wrike-provider-action-adapter"), "clientMode": .string("live-wrike-api-v4"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-state-excluded")].merging(fields) { _, n in n })
    }
}

public struct WrikeProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = ["wrike_project_list", "wrike_task_list", "wrike_task_get"]; private let client: any WrikeProviderActionClient; public init(client: any WrikeProviderActionClient = FakeWrikeProviderActionClient()) { self.client = client };
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "wrike", Self.allowed.contains(request.definition.actionKey) else { throw MarketplaceProviderActionAdapterFailure(code: "wrike_action_not_allowlisted", message: "Wrike action is outside read-only Project and Task V1.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executeWrikeAction(request: request).result, error: nil, redactionStatus: "private-state-excluded")
    }
}

enum WrikeProviderActionSupport {
    static let projectQuery = [URLQueryItem(name: "descendants", value: "false"), URLQueryItem(name: "project", value: "true"), URLQueryItem(name: "pageSize", value: "25")],
        taskQuery = [URLQueryItem(name: "pageSize", value: "25"), URLQueryItem(name: "sortField", value: "UpdatedDate"), URLQueryItem(name: "sortOrder", value: "Desc")]
    static func safeOrigin(_ text: String) -> URL? {
        guard var c = URLComponents(string: text), c.scheme?.lowercased() == "https", let host = c.host?.lowercased(), host == "wrike.com" || host.hasSuffix(".wrike.com"), c.user == nil, c.password == nil, c.port == nil, c.query == nil, c.fragment == nil, c.path == "/api/v4" || c.path == "/api/v4/"
        else { return nil }; c.path = "/api/v4/"; return c.url
    }
    static func id(_ value: JSONValue?) throws -> String {
        guard let raw = value?.string, !raw.isEmpty, raw.count <= 128, raw.allSatisfy({ $0.isLetter || $0.isNumber || $0 == "_" || $0 == "-" }) else { throw MarketplaceProviderActionAdapterFailure(code: "wrike_task_id_invalid", message: "A bounded Wrike opaque Task ID is required.") }; return raw
    }
    static func data(_ root: JSONValue) -> [JSONValue] { root.wrikeObject?["data"]?.wrikeArray ?? [] }
    static func scalar(_ value: JSONValue?) -> JSONValue { guard let value else { return .null }; switch value { case .string(let s): return .string(String(s.prefix(512))); case .number, .bool, .null: return value; default: return .null } }
    static func project(_ value: JSONValue) -> JSONRecord {
        let o = value.wrikeObject ?? [:], p = o["project"]?.wrikeObject ?? [:];
        return [
            "ProjectId": scalar(o["id"]), "AccountId": scalar(o["accountId"]), "Title": scalar(o["title"]), "CreatedDate": scalar(o["createdDate"]), "UpdatedDate": scalar(o["updatedDate"]), "ProjectStatus": scalar(p["status"]), "StartDate": scalar(p["startDate"]), "EndDate": scalar(p["endDate"]),
        ]
    }
    static func task(_ value: JSONValue) -> JSONRecord {
        let o = value.wrikeObject ?? [:], dates = o["dates"]?.wrikeObject ?? [:];
        return [
            "TaskId": scalar(o["id"]), "AccountId": scalar(o["accountId"]), "Title": scalar(o["title"]), "Status": scalar(o["status"]), "Importance": scalar(o["importance"]), "Type": scalar(dates["type"] ?? o["type"]), "CreatedDate": scalar(o["createdDate"]), "UpdatedDate": scalar(o["updatedDate"]),
            "StartDate": scalar(dates["start"]), "DueDate": scalar(dates["due"]), "Duration": scalar(dates["duration"]),
        ]
    }
    static func fakeProject() -> JSONRecord {
        [
            "ProjectId": .string("IEAGPROJECT49"), "AccountId": .string("IEAGACCOUNT50"), "Title": .string("Relay launch"), "CreatedDate": .string("2026-07-01T09:00:00Z"), "UpdatedDate": .string("2026-07-11T09:00:00Z"), "ProjectStatus": .string("Green"), "StartDate": .string("2026-07-01"),
            "EndDate": .string("2026-07-31"),
        ]
    }
    static func fakeTask() -> JSONRecord {
        [
            "TaskId": .string("IEAGTASK5001"), "AccountId": .string("IEAGACCOUNT50"), "Title": .string("Verify Railway callback"), "Status": .string("Active"), "Importance": .string("High"), "Type": .string("Planned"), "CreatedDate": .string("2026-07-11T09:00:00Z"),
            "UpdatedDate": .string("2026-07-11T09:30:00Z"), "StartDate": .string("2026-07-11"), "DueDate": .string("2026-07-14"), "Duration": .number(3),
        ]
    }
    static func json(_ value: Any) -> JSONValue {
        if let v = value as? String { return .string(v) }; if let v = value as? Bool { return .bool(v) }; if let v = value as? Int { return .number(Double(v)) }; if let v = value as? Double { return .number(v) }; if let v = value as? [String: Any] { return .object(v.mapValues(json)) };
        if let v = value as? [Any] { return .array(v.map(json)) }; return .null
    }
}
private extension JSONValue { var wrikeObject: JSONRecord? { if case .object(let v) = self { return v }; return nil }; var wrikeArray: [JSONValue]? { if case .array(let v) = self { return v }; return nil } }
