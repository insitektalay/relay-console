import Foundation

public struct TeamworkProviderHTTPRequest: Sendable { public let url: URL; public let headers: [String: String]; public init(url: URL, headers: [String: String]) { self.url = url; self.headers = headers } }
public struct TeamworkProviderHTTPResponse: Sendable {
    public let statusCode: Int; public let headers: [String: String]; public let body: Data; public init(statusCode: Int, headers: [String: String] = [:], body: Data = Data()) { self.statusCode = statusCode; self.headers = headers; self.body = body }
}
public protocol TeamworkProviderHTTPClient: Sendable { func send(_ request: TeamworkProviderHTTPRequest) throws -> TeamworkProviderHTTPResponse }
private final class TeamworkNoRedirectDelegate: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}

public struct URLSessionTeamworkProviderHTTPClient: TeamworkProviderHTTPClient {
    public init() {}
    public func send(_ request: TeamworkProviderHTTPRequest) throws -> TeamworkProviderHTTPResponse {
        var value = URLRequest(url: request.url); value.httpMethod = "GET"; value.timeoutInterval = 20; request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) }
        let session = URLSession(configuration: .ephemeral, delegate: TeamworkNoRedirectDelegate(), delegateQueue: nil), semaphore = DispatchSemaphore(value: 0); var data: Data?, response: HTTPURLResponse?, failure: Error?
        let task = session.dataTask(with: value) { data = $0; response = $1 as? HTTPURLResponse; failure = $2; semaphore.signal() }; task.resume()
        if semaphore.wait(timeout: .now() + 20) == .timedOut { task.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "teamwork_http_timeout", message: "Teamwork V3 API request timed out.") }
        session.invalidateAndCancel(); if let failure { throw failure }
        return TeamworkProviderHTTPResponse(statusCode: response?.statusCode ?? 0, headers: response?.allHeaderFields.reduce(into: [:]) { $0[String(describing: $1.key)] = String(describing: $1.value) } ?? [:], body: data ?? Data())
    }
}

public struct TeamworkProviderActionClientResult: Sendable { public let result: JSONRecord; public init(result: JSONRecord) { self.result = result } }
public protocol TeamworkProviderActionClient: Sendable { func executeTeamworkAction(request: MarketplaceProviderActionAdapterRequest) throws -> TeamworkProviderActionClientResult }

public struct FakeTeamworkProviderActionClient: TeamworkProviderActionClient {
    public init() {}
    public func executeTeamworkAction(request: MarketplaceProviderActionAdapterRequest) throws -> TeamworkProviderActionClientResult {
        switch request.definition.actionKey {
        case "teamwork_project_list": return output(["semanticReadContract": .string("teamwork-project-list-v1"), "projects": .array([.object(TeamworkProviderActionSupport.fakeProject())])])
        case "teamwork_task_list": return output(["semanticReadContract": .string("teamwork-task-list-v1"), "tasks": .array([.object(TeamworkProviderActionSupport.fakeTask())])])
        case "teamwork_task_get": return output(["semanticReadContract": .string("teamwork-task-get-v1"), "task": .object(TeamworkProviderActionSupport.fakeTask())])
        default: throw MarketplaceProviderActionAdapterFailure(code: "teamwork_fake_action_not_supported", message: "Unsupported Teamwork action.")
        }
    }
    private func output(_ fields: JSONRecord) -> TeamworkProviderActionClientResult {
        TeamworkProviderActionClientResult(
            result: ["provider": .string("teamwork"), "adapterBoundary": .string("teamwork-provider-action-adapter"), "clientMode": .string("fake-teamwork-v3-api"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-state-excluded")].merging(fields) { _, new in new })
    }
}

public final class LiveTeamworkProviderActionClient: TeamworkProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService; private let secrets: SecretService; private let http: any TeamworkProviderHTTPClient
    public init(data: LocalDataService, secrets: SecretService, httpClient: any TeamworkProviderHTTPClient = URLSessionTeamworkProviderHTTPClient()) { self.data = data; self.secrets = secrets; self.http = httpClient }
    public func executeTeamworkAction(request: MarketplaceProviderActionAdapterRequest) throws -> TeamworkProviderActionClientResult {
        let authorization = try authorization(request)
        switch request.definition.actionKey {
        case "teamwork_project_list":
            let root = try get(authorization.token, origin: authorization.origin, path: "/projects/api/v3/projects.json", query: TeamworkProviderActionSupport.projectListQuery)
            let values = TeamworkProviderActionSupport.collection(root, key: "projects").prefix(25).map { JSONValue.object(TeamworkProviderActionSupport.project($0)) }
            return output(["semanticReadContract": .string("teamwork-project-list-v1"), "projects": .array(Array(values))])
        case "teamwork_task_list":
            let root = try get(authorization.token, origin: authorization.origin, path: "/projects/api/v3/tasks.json", query: TeamworkProviderActionSupport.taskListQuery)
            let values = TeamworkProviderActionSupport.collection(root, key: "tasks").prefix(25).map { JSONValue.object(TeamworkProviderActionSupport.task($0)) }
            return output(["semanticReadContract": .string("teamwork-task-list-v1"), "tasks": .array(Array(values))])
        case "teamwork_task_get":
            let id = try TeamworkProviderActionSupport.positiveId(request.payload["taskId"]), root = try get(authorization.token, origin: authorization.origin, path: "/projects/api/v3/tasks/\(id).json", query: TeamworkProviderActionSupport.taskGetQuery)
            let value = TeamworkProviderActionSupport.single(root, key: "task")
            return output(["semanticReadContract": .string("teamwork-task-get-v1"), "task": .object(TeamworkProviderActionSupport.task(value))])
        default: throw MarketplaceProviderActionAdapterFailure(code: "teamwork_live_action_not_supported", message: "Unsupported live Teamwork action.")
        }
    }
    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> (token: String, origin: URL) {
        guard let id = request.auditIdentity.connectionId, let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), connection.appSlug == "teamwork", connection.grantedScopes == ["Teamwork.com"],
            let originText = connection.health.diagnostics["apiOrigin"]?.string, let origin = TeamworkProviderActionSupport.safeOrigin(originText), let ref = connection.credentialRequirements.first(where: { $0.fieldKey == "teamwork_oauth_access_token" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "teamwork_connection_not_ready", message: "Teamwork installation connection is not ready.") }
        return (try secrets.getSecretValue(ref), origin)
    }
    private func get(_ token: String, origin: URL, path: String, query: [URLQueryItem]) throws -> JSONValue {
        var components = URLComponents(url: origin.appendingPathComponent(String(path.dropFirst())), resolvingAgainstBaseURL: false)!; components.queryItems = query
        let response = try http.send(TeamworkProviderHTTPRequest(url: components.url!, headers: ["Authorization": "Bearer " + token, "Accept": "application/json", "User-Agent": "RelayConsole-Teamwork/1.0"])),
            value = (try? JSONSerialization.jsonObject(with: response.body)).map(TeamworkProviderActionSupport.json) ?? .null
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: response.statusCode == 301 || response.statusCode == 302
                    ? "teamwork_redirect_blocked"
                    : response.statusCode == 401 ? "teamwork_token_invalid" : response.statusCode == 403 ? "teamwork_access_denied" : response.statusCode == 404 ? "teamwork_resource_not_found" : response.statusCode == 429 ? "teamwork_rate_limited" : "teamwork_api_error",
                message: "Teamwork V3 API request failed.", providerStatusCode: response.statusCode, detail: ["retryAfter": response.headers.first { $0.key.lowercased() == "retry-after" }.map { .string(String($0.value.prefix(32))) } ?? .null])
        }; return value
    }
    private func output(_ fields: JSONRecord) -> TeamworkProviderActionClientResult {
        TeamworkProviderActionClientResult(
            result: ["provider": .string("teamwork"), "adapterBoundary": .string("teamwork-provider-action-adapter"), "clientMode": .string("live-teamwork-v3-api"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-state-excluded")].merging(fields) { _, new in new })
    }
}

public struct TeamworkProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = ["teamwork_project_list", "teamwork_task_list", "teamwork_task_get"]
    private let client: any TeamworkProviderActionClient
    public init(client: any TeamworkProviderActionClient = FakeTeamworkProviderActionClient()) { self.client = client }
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "teamwork", Self.allowed.contains(request.definition.actionKey) else { throw MarketplaceProviderActionAdapterFailure(code: "teamwork_action_not_allowlisted", message: "Teamwork action is outside read-only Project and Task V1.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executeTeamworkAction(request: request).result, error: nil, redactionStatus: "private-state-excluded")
    }
}

enum TeamworkProviderActionSupport {
    static let projectFields = "id,name,type,status,updatedAt,isStarred", taskFields = "id,name,dateUpdated,parentTaskId,isPrivate,status,tasklistId,startDate,dueDate"
    static let projectListQuery = [URLQueryItem(name: "page", value: "1"), URLQueryItem(name: "pageSize", value: "25"), URLQueryItem(name: "fields[projects]", value: projectFields)]
    static let taskListQuery = [URLQueryItem(name: "page", value: "1"), URLQueryItem(name: "pageSize", value: "25"), URLQueryItem(name: "fields[tasks]", value: taskFields)]
    static let taskGetQuery = [URLQueryItem(name: "fields[tasks]", value: taskFields)]
    static func safeOrigin(_ text: String) -> URL? {
        guard var c = URLComponents(string: text), c.scheme?.lowercased() == "https", let host = c.host?.lowercased(), host == "teamwork.com" || host.hasSuffix(".teamwork.com"), c.user == nil, c.password == nil, c.port == nil, c.query == nil, c.fragment == nil else { return nil }; c.path = "/";
        return c.url
    }
    static func positiveId(_ value: JSONValue?) throws -> String {
        guard let raw = value?.string, raw.count <= 20, raw.first != "0", raw.allSatisfy({ $0.isNumber }), Int64(raw) != nil else { throw MarketplaceProviderActionAdapterFailure(code: "teamwork_task_id_invalid", message: "A positive decimal Teamwork Task ID is required.") }; return raw
    }
    static func scalar(_ value: JSONValue?) -> JSONValue { guard let value else { return .null }; switch value { case .string(let text): return .string(String(text.prefix(512))); case .number, .bool, .null: return value; default: return .null } }
    static func collection(_ root: JSONValue, key: String) -> [JSONValue] { let o = root.teamworkObject ?? [:]; return o[key]?.teamworkArray ?? o["data"]?.teamworkObject?[key]?.teamworkArray ?? [] }
    static func single(_ root: JSONValue, key: String) -> JSONValue { let o = root.teamworkObject ?? [:]; if let v = o[key] { return v }; if let v = o["data"]?.teamworkObject?[key] { return v }; return root }
    static func project(_ value: JSONValue) -> JSONRecord {
        let o = value.teamworkObject ?? [:]; return ["ProjectId": scalar(o["id"]), "Name": scalar(o["name"]), "Type": scalar(o["type"]), "Status": scalar(o["status"]), "UpdatedAt": scalar(o["updatedAt"] ?? o["updated-at"]), "IsStarred": scalar(o["isStarred"] ?? o["starred"])]
    }
    static func task(_ value: JSONValue) -> JSONRecord {
        let o = value.teamworkObject ?? [:];
        return [
            "TaskId": scalar(o["id"]), "Name": scalar(o["name"]), "Status": scalar(o["status"]), "TasklistId": scalar(o["tasklistId"]), "ParentTaskId": scalar(o["parentTaskId"]), "IsPrivate": scalar(o["isPrivate"]), "StartDate": scalar(o["startDate"]), "DueDate": scalar(o["dueDate"]),
            "DateUpdated": scalar(o["dateUpdated"]),
        ]
    }
    static func fakeProject() -> JSONRecord { ["ProjectId": .number(48), "Name": .string("Relay launch"), "Type": .string("normal"), "Status": .string("active"), "UpdatedAt": .string("2026-07-11T09:00:00Z"), "IsStarred": .bool(true)] }
    static func fakeTask() -> JSONRecord {
        [
            "TaskId": .number(4801), "Name": .string("Verify Railway callback"), "Status": .string("active"), "TasklistId": .number(121), "ParentTaskId": .number(0), "IsPrivate": .bool(false), "StartDate": .string("2026-07-11"), "DueDate": .string("2026-07-14"),
            "DateUpdated": .string("2026-07-11T09:30:00Z"),
        ]
    }
    static func json(_ value: Any) -> JSONValue {
        if let v = value as? String { return .string(v) }; if let v = value as? Bool { return .bool(v) }; if let v = value as? Int { return .number(Double(v)) }; if let v = value as? Double { return .number(v) }; if let v = value as? [String: Any] { return .object(v.mapValues(json)) };
        if let v = value as? [Any] { return .array(v.map(json)) }; return .null
    }
}
private extension JSONValue { var teamworkObject: JSONRecord? { if case .object(let value) = self { return value }; return nil }; var teamworkArray: [JSONValue]? { if case .array(let value) = self { return value }; return nil } }
