import Foundation

public struct TodoistProviderHTTPRequest: Sendable { public let url: URL; public let headers: [String: String]; public init(url: URL, headers: [String: String]) { self.url = url; self.headers = headers } }
public struct TodoistProviderHTTPResponse: Sendable {
    public let statusCode: Int; public let headers: [String: String]; public let body: Data; public init(statusCode: Int, headers: [String: String] = [:], body: Data = Data()) { self.statusCode = statusCode; self.headers = headers; self.body = body }
}
public protocol TodoistProviderHTTPClient: Sendable { func send(_ request: TodoistProviderHTTPRequest) throws -> TodoistProviderHTTPResponse }
private final class TodoistNoRedirectDelegate: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}
public struct URLSessionTodoistProviderHTTPClient: TodoistProviderHTTPClient {
    public init() {};
    public func send(_ request: TodoistProviderHTTPRequest) throws -> TodoistProviderHTTPResponse {
        var value = URLRequest(url: request.url); value.httpMethod = "GET"; value.timeoutInterval = 20; request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) };
        let session = URLSession(configuration: .ephemeral, delegate: TodoistNoRedirectDelegate(), delegateQueue: nil), semaphore = DispatchSemaphore(value: 0); var data: Data?, response: HTTPURLResponse?, failure: Error?;
        let task = session.dataTask(with: value) {
            data = $0; response = $1 as? HTTPURLResponse; failure = $2; semaphore.signal()
        }; task.resume(); if semaphore.wait(timeout: .now() + 20) == .timedOut { task.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "todoist_http_timeout", message: "Todoist API v1 request timed out.") }; session.invalidateAndCancel(); if let failure { throw failure };
        return TodoistProviderHTTPResponse(statusCode: response?.statusCode ?? 0, headers: response?.allHeaderFields.reduce(into: [:]) { $0[String(describing: $1.key)] = String(describing: $1.value) } ?? [:], body: data ?? Data())
    }
}

public struct TodoistProviderActionClientResult: Sendable { public let result: JSONRecord; public init(result: JSONRecord) { self.result = result } }
public protocol TodoistProviderActionClient: Sendable { func executeTodoistAction(request: MarketplaceProviderActionAdapterRequest) throws -> TodoistProviderActionClientResult }
public struct FakeTodoistProviderActionClient: TodoistProviderActionClient {
    public init() {};
    public func executeTodoistAction(request: MarketplaceProviderActionAdapterRequest) throws -> TodoistProviderActionClientResult {
        switch request.definition.actionKey {
        case "todoist_project_list": return output(["semanticReadContract": .string("todoist-project-list-v1"), "projects": .array([.object(TodoistProviderActionSupport.fakeProject())])]);
        case "todoist_task_list": return output(["semanticReadContract": .string("todoist-task-list-v1"), "tasks": .array([.object(TodoistProviderActionSupport.fakeTask())])]);
        case "todoist_task_get": return output(["semanticReadContract": .string("todoist-task-get-v1"), "task": .object(TodoistProviderActionSupport.fakeTask())]);
        default: throw MarketplaceProviderActionAdapterFailure(code: "todoist_fake_action_not_supported", message: "Unsupported Todoist action.")
        }
    };
    private func output(_ fields: JSONRecord) -> TodoistProviderActionClientResult {
        TodoistProviderActionClientResult(
            result: ["provider": .string("todoist"), "adapterBoundary": .string("todoist-provider-action-adapter"), "clientMode": .string("fake-todoist-api-v1"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-state-excluded")].merging(fields) { _, n in n })
    }
}

public final class LiveTodoistProviderActionClient: TodoistProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService; private let secrets: SecretService; private let http: any TodoistProviderHTTPClient
    public init(data: LocalDataService, secrets: SecretService, httpClient: any TodoistProviderHTTPClient = URLSessionTodoistProviderHTTPClient()) { self.data = data; self.secrets = secrets; self.http = httpClient }
    public func executeTodoistAction(request: MarketplaceProviderActionAdapterRequest) throws -> TodoistProviderActionClientResult {
        let token = try authorization(request);
        switch request.definition.actionKey {
        case "todoist_project_list":
            let root = try get(token, path: "/projects", query: TodoistProviderActionSupport.listQuery), values = TodoistProviderActionSupport.results(root).prefix(25).map { JSONValue.object(TodoistProviderActionSupport.project($0)) };
            return output(["semanticReadContract": .string("todoist-project-list-v1"), "projects": .array(Array(values))]);
        case "todoist_task_list":
            let root = try get(token, path: "/tasks", query: TodoistProviderActionSupport.listQuery), values = TodoistProviderActionSupport.results(root).prefix(25).map { JSONValue.object(TodoistProviderActionSupport.task($0)) };
            return output(["semanticReadContract": .string("todoist-task-list-v1"), "tasks": .array(Array(values))]);
        case "todoist_task_get": let id = try TodoistProviderActionSupport.id(request.payload["taskId"]), root = try get(token, path: "/tasks/\(id)", query: []); return output(["semanticReadContract": .string("todoist-task-get-v1"), "task": .object(TodoistProviderActionSupport.task(root))]);
        default: throw MarketplaceProviderActionAdapterFailure(code: "todoist_live_action_not_supported", message: "Unsupported live Todoist action.")
        }
    }
    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> String {
        guard let id = request.auditIdentity.connectionId, let c = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), c.appSlug == "todoist", c.grantedScopes == ["data:read"], c.health.diagnostics["apiOrigin"] == .string("https://api.todoist.com/api/v1"),
            let ref = c.credentialRequirements.first(where: { $0.fieldKey == "todoist_oauth_access_token" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "todoist_connection_not_ready", message: "Todoist user connection is not ready.") }; return try secrets.getSecretValue(ref)
    }
    private func get(_ token: String, path: String, query: [URLQueryItem]) throws -> JSONValue {
        var components = URLComponents(string: "https://api.todoist.com/api/v1" + path)!; components.queryItems = query.isEmpty ? nil : query;
        let response = try http.send(TodoistProviderHTTPRequest(url: components.url!, headers: ["Authorization": "Bearer " + token, "Accept": "application/json", "User-Agent": "RelayConsole-Todoist/1.0"])),
            value = (try? JSONSerialization.jsonObject(with: response.body)).map(TodoistProviderActionSupport.json) ?? .null
        ;
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: response.statusCode == 301 || response.statusCode == 302
                    ? "todoist_redirect_blocked"
                    : response.statusCode == 401 ? "todoist_token_invalid_or_expired" : response.statusCode == 403 ? "todoist_access_forbidden" : response.statusCode == 404 ? "todoist_resource_not_found" : response.statusCode == 429 ? "todoist_rate_limited" : "todoist_api_error",
                message: "Todoist API v1 request failed.", providerStatusCode: response.statusCode, detail: ["retryAfter": response.headers.first { $0.key.lowercased() == "retry-after" }.map { .string(String($0.value.prefix(32))) } ?? .null])
        }; return value
    }
    private func output(_ fields: JSONRecord) -> TodoistProviderActionClientResult {
        TodoistProviderActionClientResult(
            result: ["provider": .string("todoist"), "adapterBoundary": .string("todoist-provider-action-adapter"), "clientMode": .string("live-todoist-api-v1"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-state-excluded")].merging(fields) { _, n in n })
    }
}

public struct TodoistProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = ["todoist_project_list", "todoist_task_list", "todoist_task_get"]; private let client: any TodoistProviderActionClient; public init(client: any TodoistProviderActionClient = FakeTodoistProviderActionClient()) { self.client = client };
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "todoist", Self.allowed.contains(request.definition.actionKey) else { throw MarketplaceProviderActionAdapterFailure(code: "todoist_action_not_allowlisted", message: "Todoist action is outside bounded read-only Project and Task V1.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executeTodoistAction(request: request).result, error: nil, redactionStatus: "private-state-excluded")
    }
}

enum TodoistProviderActionSupport {
    static let listQuery = [URLQueryItem(name: "limit", value: "25")]
    static func id(_ value: JSONValue?) throws -> String {
        guard let raw = value?.string, !raw.isEmpty, raw.count <= 64, raw.allSatisfy({ $0.isLetter || $0.isNumber || $0 == "_" || $0 == "-" }) else { throw MarketplaceProviderActionAdapterFailure(code: "todoist_task_id_invalid", message: "An exact bounded Todoist Task ID is required.") }; return raw
    }
    static func results(_ root: JSONValue) -> [JSONValue] { root.todoistObject?["results"]?.todoistArray ?? [] }
    static func scalar(_ value: JSONValue?) -> JSONValue { guard let value else { return .null }; switch value { case .string(let s): return .string(String(s.prefix(2000))); case .number, .bool, .null: return value; default: return .null } }
    static func project(_ value: JSONValue) -> JSONRecord {
        let o = value.todoistObject ?? [:];
        return [
            "ProjectId": scalar(o["id"]), "Name": scalar(o["name"]), "Status": scalar(o["status"]), "ViewStyle": scalar(o["view_style"]), "Role": scalar(o["role"]), "InboxProject": scalar(o["inbox_project"]), "Favorite": scalar(o["is_favorite"]), "Archived": scalar(o["is_archived"]),
            "CreatedAt": scalar(o["created_at"]), "UpdatedAt": scalar(o["updated_at"]),
        ]
    }
    static func task(_ value: JSONValue) -> JSONRecord {
        let o = value.todoistObject ?? [:], due = o["due"]?.todoistObject ?? [:], deadline = o["deadline"]?.todoistObject ?? [:], duration = o["duration"]?.todoistObject ?? [:];
        return [
            "TaskId": scalar(o["id"]), "Content": scalar(o["content"]), "ProjectId": scalar(o["project_id"]), "SectionId": scalar(o["section_id"]), "ParentId": scalar(o["parent_id"]), "Priority": scalar(o["priority"]), "DueDate": scalar(due["date"]), "DueString": scalar(due["string"]),
            "DueTimezone": scalar(due["timezone"]), "DeadlineDate": scalar(deadline["date"]), "DurationAmount": scalar(duration["amount"]), "DurationUnit": scalar(duration["unit"]), "CreatedAt": scalar(o["added_at"] ?? o["created_at"]), "UpdatedAt": scalar(o["updated_at"]),
        ]
    }
    static func fakeProject() -> JSONRecord {
        [
            "ProjectId": .string("6XGgm6PHrGgMpCFX"), "Name": .string("Relay launch"), "Status": .string("IN_PROGRESS"), "ViewStyle": .string("list"), "Role": .string("CREATOR"), "InboxProject": .bool(false), "Favorite": .bool(true), "Archived": .bool(false),
            "CreatedAt": .string("2026-07-01T09:00:00Z"), "UpdatedAt": .string("2026-07-11T09:00:00Z"),
        ]
    }
    static func fakeTask() -> JSONRecord {
        [
            "TaskId": .string("6XGgmFVcrG5RRjVr"), "Content": .string("Verify Railway callback"), "ProjectId": .string("6XGgm6PHrGgMpCFX"), "SectionId": .null, "ParentId": .null, "Priority": .number(4), "DueDate": .string("2026-07-14"), "DueString": .string("14 Jul"),
            "DueTimezone": .string("Europe/London"), "DeadlineDate": .null, "DurationAmount": .number(30), "DurationUnit": .string("minute"), "CreatedAt": .string("2026-07-11T09:00:00Z"), "UpdatedAt": .string("2026-07-11T09:30:00Z"),
        ]
    }
    static func json(_ value: Any) -> JSONValue {
        if let v = value as? String { return .string(v) }; if let v = value as? Bool { return .bool(v) }; if let v = value as? Int { return .number(Double(v)) }; if let v = value as? Double { return .number(v) }; if let v = value as? [String: Any] { return .object(v.mapValues(json)) };
        if let v = value as? [Any] { return .array(v.map(json)) }; return .null
    }
}
private extension JSONValue { var todoistObject: JSONRecord? { if case .object(let v) = self { return v }; return nil }; var todoistArray: [JSONValue]? { if case .array(let v) = self { return v }; return nil } }
