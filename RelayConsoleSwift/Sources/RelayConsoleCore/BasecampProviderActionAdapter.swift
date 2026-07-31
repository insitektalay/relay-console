import Foundation

public struct BasecampProviderHTTPRequest: Sendable { public let url: URL; public let headers: [String: String]; public init(url: URL, headers: [String: String]) { self.url = url; self.headers = headers } }
public struct BasecampProviderHTTPResponse: Sendable {
    public let statusCode: Int; public let headers: [String: String]; public let body: Data; public init(statusCode: Int, headers: [String: String] = [:], body: Data = Data()) { self.statusCode = statusCode; self.headers = headers; self.body = body }
}
public protocol BasecampProviderHTTPClient: Sendable { func send(_ request: BasecampProviderHTTPRequest) throws -> BasecampProviderHTTPResponse }
private final class BasecampNoRedirectDelegate: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}
public struct URLSessionBasecampProviderHTTPClient: BasecampProviderHTTPClient {
    public init() {}
    public func send(_ request: BasecampProviderHTTPRequest) throws -> BasecampProviderHTTPResponse {
        var value = URLRequest(url: request.url); value.httpMethod = "GET"; value.timeoutInterval = 20; request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) };
        let session = URLSession(configuration: .ephemeral, delegate: BasecampNoRedirectDelegate(), delegateQueue: nil), semaphore = DispatchSemaphore(value: 0); var data: Data?, response: HTTPURLResponse?, failure: Error?;
        let task = session.dataTask(with: value) {
            data = $0; response = $1 as? HTTPURLResponse; failure = $2; semaphore.signal()
        }; task.resume(); if semaphore.wait(timeout: .now() + 20) == .timedOut { task.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "basecamp_http_timeout", message: "Basecamp API request timed out.") }; session.invalidateAndCancel(); if let failure { throw failure };
        return BasecampProviderHTTPResponse(statusCode: response?.statusCode ?? 0, headers: response?.allHeaderFields.reduce(into: [:]) { $0[String(describing: $1.key)] = String(describing: $1.value) } ?? [:], body: data ?? Data())
    }
}

public struct BasecampProviderActionClientResult: Sendable { public let result: JSONRecord; public init(result: JSONRecord) { self.result = result } }
public protocol BasecampProviderActionClient: Sendable { func executeBasecampAction(request: MarketplaceProviderActionAdapterRequest) throws -> BasecampProviderActionClientResult }
public struct FakeBasecampProviderActionClient: BasecampProviderActionClient {
    public init() {}
    public func executeBasecampAction(request: MarketplaceProviderActionAdapterRequest) throws -> BasecampProviderActionClientResult {
        switch request.definition.actionKey {
        case "basecamp_project_list": return output(["semanticReadContract": .string("basecamp-project-list-v1"), "projects": .array([.object(BasecampProviderActionSupport.fakeProject())])]);
        case "basecamp_project_get": return output(["semanticReadContract": .string("basecamp-project-get-v1"), "project": .object(BasecampProviderActionSupport.fakeProject())]);
        case "basecamp_todo_get": return output(["semanticReadContract": .string("basecamp-todo-get-v1"), "todo": .object(BasecampProviderActionSupport.fakeTodo())]);
        default: throw MarketplaceProviderActionAdapterFailure(code: "basecamp_fake_action_not_supported", message: "Unsupported Basecamp action.")
        }
    }
    private func output(_ fields: JSONRecord) -> BasecampProviderActionClientResult {
        BasecampProviderActionClientResult(
            result: ["provider": .string("basecamp"), "adapterBoundary": .string("basecamp-provider-action-adapter"), "clientMode": .string("fake-basecamp-api"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-state-excluded")].merging(fields) { _, n in n })
    }
}

public final class LiveBasecampProviderActionClient: BasecampProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService; private let secrets: SecretService; private let http: any BasecampProviderHTTPClient
    public init(data: LocalDataService, secrets: SecretService, httpClient: any BasecampProviderHTTPClient = URLSessionBasecampProviderHTTPClient()) { self.data = data; self.secrets = secrets; self.http = httpClient }
    public func executeBasecampAction(request: MarketplaceProviderActionAdapterRequest) throws -> BasecampProviderActionClientResult {
        let auth = try authorization(request);
        switch request.definition.actionKey {
        case "basecamp_project_list":
            let root = try get(auth, path: "/projects.json"), projects = (root.basecampArray ?? []).prefix(25).map { JSONValue.object(BasecampProviderActionSupport.project($0)) }; return output(["semanticReadContract": .string("basecamp-project-list-v1"), "projects": .array(Array(projects))]);
        case "basecamp_project_get":
            let id = try BasecampProviderActionSupport.positiveId(request.payload["projectId"], kind: "Project"), root = try get(auth, path: "/projects/\(id).json");
            return output(["semanticReadContract": .string("basecamp-project-get-v1"), "project": .object(BasecampProviderActionSupport.project(root))]);
        case "basecamp_todo_get":
            let id = try BasecampProviderActionSupport.positiveId(request.payload["todoId"], kind: "To-do"), root = try get(auth, path: "/todos/\(id).json"); return output(["semanticReadContract": .string("basecamp-todo-get-v1"), "todo": .object(BasecampProviderActionSupport.todo(root))]);
        default: throw MarketplaceProviderActionAdapterFailure(code: "basecamp_live_action_not_supported", message: "Unsupported live Basecamp action.")
        }
    }
    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> (token: String, accountId: String) {
        guard let id = request.auditIdentity.connectionId, let c = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), c.appSlug == "basecamp", c.grantedScopes.isEmpty, c.health.diagnostics["product"] == .string("bc3"),
            let accountId = c.health.diagnostics["accountId"]?.string, BasecampProviderActionSupport.validId(accountId), c.health.diagnostics["apiOrigin"] == .string("https://3.basecampapi.com/" + accountId),
            let ref = c.credentialRequirements.first(where: { $0.fieldKey == "basecamp_oauth_access_token" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "basecamp_connection_not_ready", message: "Basecamp account connection is not ready.") }; return (try secrets.getSecretValue(ref), accountId)
    }
    private func get(_ auth: (token: String, accountId: String), path: String) throws -> JSONValue {
        let url = URL(string: "https://3.basecampapi.com/\(auth.accountId)\(path)")!;
        let response = try http.send(BasecampProviderHTTPRequest(url: url, headers: ["Authorization": "Bearer " + auth.token, "Accept": "application/json", "User-Agent": "Relay Console (https://relay.example/contact)"])),
            value = (try? JSONSerialization.jsonObject(with: response.body)).map(BasecampProviderActionSupport.json) ?? .null
        ;
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: response.statusCode == 301 || response.statusCode == 302
                    ? "basecamp_redirect_blocked"
                    : response.statusCode == 401 ? "basecamp_token_invalid" : response.statusCode == 403 ? "basecamp_access_denied" : response.statusCode == 404 ? "basecamp_resource_unavailable" : response.statusCode == 429 ? "basecamp_rate_limited" : "basecamp_api_error",
                message: "Basecamp API request failed.", providerStatusCode: response.statusCode,
                detail: ["retryAfter": response.headers.first { $0.key.lowercased() == "retry-after" }.map { .string(String($0.value.prefix(32))) } ?? .null, "reason": response.headers.first { $0.key.lowercased() == "reason" }.map { .string(String($0.value.prefix(64))) } ?? .null])
        }; return value
    }
    private func output(_ fields: JSONRecord) -> BasecampProviderActionClientResult {
        BasecampProviderActionClientResult(
            result: ["provider": .string("basecamp"), "adapterBoundary": .string("basecamp-provider-action-adapter"), "clientMode": .string("live-basecamp-api"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-state-excluded")].merging(fields) { _, n in n })
    }
}

public struct BasecampProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = ["basecamp_project_list", "basecamp_project_get", "basecamp_todo_get"]; private let client: any BasecampProviderActionClient; public init(client: any BasecampProviderActionClient = FakeBasecampProviderActionClient()) { self.client = client };
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "basecamp", Self.allowed.contains(request.definition.actionKey) else { throw MarketplaceProviderActionAdapterFailure(code: "basecamp_action_not_allowlisted", message: "Basecamp action is outside read-only Project and To-do V1.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executeBasecampAction(request: request).result, error: nil, redactionStatus: "private-state-excluded")
    }
}

enum BasecampProviderActionSupport {
    static func validId(_ raw: String) -> Bool { !raw.isEmpty && raw.count <= 20 && raw.first != "0" && raw.allSatisfy(\.isNumber) && Int64(raw) != nil }
    static func positiveId(_ value: JSONValue?, kind: String) throws -> String {
        guard let raw = value?.string, validId(raw) else { throw MarketplaceProviderActionAdapterFailure(code: "basecamp_\(kind.lowercased())_id_invalid", message: "A positive decimal Basecamp \(kind) ID is required.") }; return raw
    }
    static func scalar(_ value: JSONValue?) -> JSONValue { guard let value else { return .null }; switch value { case .string(let s): return .string(String(s.prefix(512))); case .number, .bool, .null: return value; default: return .null } }
    static func project(_ value: JSONValue) -> JSONRecord {
        let o = value.basecampObject ?? [:];
        return [
            "ProjectId": scalar(o["id"]), "Name": scalar(o["name"]), "Status": scalar(o["status"]), "Purpose": scalar(o["purpose"]), "CreatedAt": scalar(o["created_at"]), "UpdatedAt": scalar(o["updated_at"]), "ClientsEnabled": scalar(o["clients_enabled"]),
            "TimesheetEnabled": scalar(o["timesheet_enabled"]), "Bookmarked": scalar(o["bookmarked"]),
        ]
    }
    static func todo(_ value: JSONValue) -> JSONRecord {
        let o = value.basecampObject ?? [:], parent = o["parent"]?.basecampObject ?? [:], bucket = o["bucket"]?.basecampObject ?? [:];
        return [
            "TodoId": scalar(o["id"]), "Content": scalar(o["content"] ?? o["title"]), "Status": scalar(o["status"]), "Completed": scalar(o["completed"]), "VisibleToClients": scalar(o["visible_to_clients"]), "StartsOn": scalar(o["starts_on"]), "DueOn": scalar(o["due_on"]),
            "CreatedAt": scalar(o["created_at"]), "UpdatedAt": scalar(o["updated_at"]), "Position": scalar(o["position"]), "ParentId": scalar(parent["id"]), "ParentTitle": scalar(parent["title"]), "ProjectId": scalar(bucket["id"]), "ProjectName": scalar(bucket["name"]),
        ]
    }
    static func fakeProject() -> JSONRecord {
        [
            "ProjectId": .number(49), "Name": .string("Relay launch"), "Status": .string("active"), "Purpose": .string("topic"), "CreatedAt": .string("2026-07-01T09:00:00Z"), "UpdatedAt": .string("2026-07-11T09:00:00Z"), "ClientsEnabled": .bool(false), "TimesheetEnabled": .bool(false),
            "Bookmarked": .bool(true),
        ]
    }
    static func fakeTodo() -> JSONRecord {
        [
            "TodoId": .number(4901), "Content": .string("Verify Railway callback"), "Status": .string("active"), "Completed": .bool(false), "VisibleToClients": .bool(false), "StartsOn": .string("2026-07-11"), "DueOn": .string("2026-07-14"), "CreatedAt": .string("2026-07-11T09:00:00Z"),
            "UpdatedAt": .string("2026-07-11T09:30:00Z"), "Position": .number(1), "ParentId": .number(490), "ParentTitle": .string("Launch tasks"), "ProjectId": .number(49), "ProjectName": .string("Relay launch"),
        ]
    }
    static func json(_ value: Any) -> JSONValue {
        if let v = value as? String { return .string(v) }; if let v = value as? Bool { return .bool(v) }; if let v = value as? Int { return .number(Double(v)) }; if let v = value as? Double { return .number(v) }; if let v = value as? [String: Any] { return .object(v.mapValues(json)) };
        if let v = value as? [Any] { return .array(v.map(json)) }; return .null
    }
}
private extension JSONValue { var basecampObject: JSONRecord? { if case .object(let v) = self { return v }; return nil }; var basecampArray: [JSONValue]? { if case .array(let v) = self { return v }; return nil } }
