import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

public struct MicrosoftToDoProviderActionClientResult: Sendable { public var result: JSONRecord; public init(result: JSONRecord) { self.result = result } }
public protocol MicrosoftToDoProviderActionClient: Sendable { func executeMicrosoftToDoAction(request: MarketplaceProviderActionAdapterRequest) throws -> MicrosoftToDoProviderActionClientResult }
public struct FakeMicrosoftToDoProviderActionClient: MicrosoftToDoProviderActionClient {
  public init() {}
    public func executeMicrosoftToDoAction(request: MarketplaceProviderActionAdapterRequest) throws -> MicrosoftToDoProviderActionClientResult {
        let fields: JSONRecord;
        switch request.definition.actionKey {
        case "microsoft_todo_task_lists_list": fields = ["taskLists": .array([.object(MicrosoftToDoProviderActionSupport.fakeList())]), "resultCount": .number(1)];
        case "microsoft_todo_task_list_get": _ = try MicrosoftToDoProviderActionSupport.identifier(request.payload["taskListId"], "taskListId"); fields = ["taskList": .object(MicrosoftToDoProviderActionSupport.fakeList())];
        case "microsoft_todo_tasks_list": _ = try MicrosoftToDoProviderActionSupport.identifier(request.payload["taskListId"], "taskListId"); fields = ["tasks": .array([.object(MicrosoftToDoProviderActionSupport.fakeTask())]), "resultCount": .number(1)];
        case "microsoft_todo_task_get":
            _ = try MicrosoftToDoProviderActionSupport.identifier(request.payload["taskListId"], "taskListId"); _ = try MicrosoftToDoProviderActionSupport.identifier(request.payload["taskId"], "taskId"); fields = ["task": .object(MicrosoftToDoProviderActionSupport.fakeTask())];
        default: throw MarketplaceProviderActionAdapterFailure(code: "microsoft_todo_action_not_supported", message: "Unsupported Microsoft To Do action.")
        }; return MicrosoftToDoProviderActionClientResult(result: MicrosoftToDoProviderActionSupport.base("fake-microsoft-graph").merging(fields) { _, new in new })
    }
}
public final class LiveMicrosoftToDoProviderActionClient: MicrosoftToDoProviderActionClient, @unchecked Sendable {
  private let data: LocalDataService; private let secrets: SecretService
  public init(data: LocalDataService, secrets: SecretService) { self.data = data; self.secrets = secrets }
    public func executeMicrosoftToDoAction(request: MarketplaceProviderActionAdapterRequest) throws -> MicrosoftToDoProviderActionClientResult {
        let token = try authorization(request), root: JSONValue, fields: JSONRecord;
        switch request.definition.actionKey {
        case "microsoft_todo_task_lists_list":
            root = try get(token: token, path: "/me/todo/lists"); let values = MicrosoftToDoProviderActionSupport.records(root).map(MicrosoftToDoProviderActionSupport.taskList);
            fields = ["taskLists": .array(values.map(JSONValue.object)), "resultCount": .number(Double(values.count)), "nextPageFollowed": .bool(false)];
        case "microsoft_todo_task_list_get": let id = try MicrosoftToDoProviderActionSupport.identifier(request.payload["taskListId"], "taskListId"); root = try get(token: token, path: "/me/todo/lists/\(id)"); fields = ["taskList": .object(MicrosoftToDoProviderActionSupport.taskList(root))];
        case "microsoft_todo_tasks_list":
            let id = try MicrosoftToDoProviderActionSupport.identifier(request.payload["taskListId"], "taskListId"); root = try get(token: token, path: "/me/todo/lists/\(id)/tasks"); let values = MicrosoftToDoProviderActionSupport.records(root).map(MicrosoftToDoProviderActionSupport.task);
            fields = ["tasks": .array(values.map(JSONValue.object)), "resultCount": .number(Double(values.count)), "nextPageFollowed": .bool(false)];
        case "microsoft_todo_task_get":
            let list = try MicrosoftToDoProviderActionSupport.identifier(request.payload["taskListId"], "taskListId"), task = try MicrosoftToDoProviderActionSupport.identifier(request.payload["taskId"], "taskId"); root = try get(token: token, path: "/me/todo/lists/\(list)/tasks/\(task)");
            fields = ["task": .object(MicrosoftToDoProviderActionSupport.task(root))];
        default: throw MarketplaceProviderActionAdapterFailure(code: "microsoft_todo_live_action_not_supported", message: "Unsupported live Microsoft To Do action.")
        }; return MicrosoftToDoProviderActionClientResult(result: MicrosoftToDoProviderActionSupport.base("live-microsoft-graph").merging(fields) { _, new in new })
    }
    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> String {
        guard let id = request.auditIdentity.connectionId, let c = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), c.appSlug == "microsoft-to-do", c.appId == request.app.id, c.status == .connected, c.health.state == .ready,
            c.grantedScopes == ProviderConnectionService.microsoftToDoRelayOwnedOAuthScopes, c.health.diagnostics["delegatedSelfOnly"]?.bool == true, c.health.diagnostics["sharedTasksEnabled"]?.bool == false, c.health.diagnostics["taskBodyEnabled"]?.bool == false,
            c.health.diagnostics["relatedContentEnabled"]?.bool == false, c.health.diagnostics["writesEnabled"]?.bool == false, c.health.diagnostics["automaticPagination"]?.bool == false, c.health.diagnostics["rawToolsEnabled"]?.bool == false,
            let ref = c.credentialRequirements.first(where: { $0.fieldKey == "microsoft_todo_oauth_access_token" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "microsoft_todo_connection_not_ready", message: "Microsoft To Do requires a ready exact-scope delegated self-account connection.") }; return try secrets.getSecretValue(ref)
    }
    private func get(token: String, path: String) throws -> JSONValue {
        guard let url = URL(string: "https://graph.microsoft.com/v1.0" + path), url.scheme == "https", url.host == "graph.microsoft.com", url.path.hasPrefix("/v1.0/me/todo/lists"), url.query == nil, !url.path.contains("/checklistItems"), !url.path.contains("/linkedResources"),
            !url.path.contains("/extensions"), !url.path.contains("/delta")
        else { throw MarketplaceProviderActionAdapterFailure(code: "microsoft_todo_unsafe_url", message: "Unsafe Microsoft To Do Graph request.") }; var r = URLRequest(url: url, timeoutInterval: 30); r.httpMethod = "GET"; r.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization");
        let semaphore = DispatchSemaphore(value: 0); var captured: Result<(Data, HTTPURLResponse), Error>?;
        URLSession.shared.dataTask(with: r) { bytes, response, error in
            defer { semaphore.signal() }; if let error { captured = .failure(error); return };
            guard let bytes, let response = response as? HTTPURLResponse else { captured = .failure(MarketplaceProviderActionAdapterFailure(code: "microsoft_todo_transport_error", message: "Graph returned no HTTP response.")); return }; captured = .success((bytes, response))
        }.resume(); guard semaphore.wait(timeout: .now() + 31) == .success, let captured else { throw MarketplaceProviderActionAdapterFailure(code: "microsoft_todo_timeout", message: "Graph request timed out.") }; let (bytes, response) = try captured.get();
        guard (200..<300).contains(response.statusCode) else { throw MarketplaceProviderActionAdapterFailure(code: response.statusCode == 429 ? "microsoft_todo_rate_limited" : "microsoft_todo_graph_error", message: "Microsoft To Do Graph request failed.", providerStatusCode: response.statusCode) };
        guard bytes.count <= 1_000_000 else { throw MarketplaceProviderActionAdapterFailure(code: "microsoft_todo_response_too_large", message: "Graph response exceeded 1 MB.") }; return try JSONDecoder().decode(JSONValue.self, from: bytes)
    }
}
public struct MicrosoftToDoProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = ["microsoft_todo_task_lists_list", "microsoft_todo_task_list_get", "microsoft_todo_tasks_list", "microsoft_todo_task_get"]; private let client: any MicrosoftToDoProviderActionClient;
    public init(client: any MicrosoftToDoProviderActionClient = FakeMicrosoftToDoProviderActionClient()) { self.client = client };
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "microsoft-to-do", Self.allowed.contains(request.definition.actionKey), request.permission == .allowed else {
            throw MarketplaceProviderActionAdapterFailure(code: "microsoft_todo_action_not_allowlisted", message: "Microsoft To Do V1 permits only four bounded reads.")
        }; return MarketplaceProviderActionAdapterResult(result: try client.executeMicrosoftToDoAction(request: request).result, error: nil, redactionStatus: "task-bodies-related-content-shared-writes-other-users-pagination-raw-excluded")
    }
}
public enum MicrosoftToDoProviderActionSupport {
    static func base(_ mode: String) -> JSONRecord {
        [
            "provider": .string("microsoft-to-do"), "adapterBoundary": .string("microsoft-todo-provider-action-adapter"), "clientMode": .string(mode), "delegatedSelfOnly": .bool(true), "maxResults": .number(25), "taskBodyEnabled": .bool(false), "relatedContentEnabled": .bool(false),
            "sharedTasksEnabled": .bool(false), "writesEnabled": .bool(false), "automaticPagination": .bool(false), "rawProviderToolExposure": .bool(false),
        ]
    }
    static func identifier(_ v: JSONValue?, _ field: String) throws -> String {
        guard let s = v?.string, !s.isEmpty, s.count <= 512, s.allSatisfy({ $0.isLetter || $0.isNumber || "-_.!~=".contains($0) }) else { throw MarketplaceProviderActionAdapterFailure(code: "microsoft_todo_invalid_identifier", message: "An explicit safe \(field) is required.") }; return s
    }
    static func object(_ v: JSONValue?) -> JSONRecord { guard case .object(let r)? = v else { return [:] }; return r }; static func array(_ v: JSONValue?) -> [JSONValue] { guard case .array(let a)? = v else { return [] }; return a };
    static func scalar(_ v: JSONValue?, _ max: Int = 512) -> JSONValue { guard let v else { return .null }; if case .string(let s) = v { return .string(String(s.prefix(max))) }; if case .number = v { return v }; if case .bool = v { return v }; return .null };
    static func records(_ root: JSONValue?) -> [JSONValue] { Array(array(object(root)["value"]).prefix(25)) }
    static func taskList(_ v: JSONValue?) -> JSONRecord {
        let r = object(v); return ["id": scalar(r["id"], 512), "displayName": scalar(r["displayName"]), "isOwner": scalar(r["isOwner"]), "isShared": scalar(r["isShared"]), "wellknownListName": scalar(r["wellknownListName"], 64), "extensionsExcluded": .bool(true)]
    }
  static func date(_ v: JSONValue?) -> JSONValue { let r = object(v); return scalar(r["dateTime"], 64) }
    static func task(_ v: JSONValue?) -> JSONRecord {
        let r = object(v);
        return [
            "id": scalar(r["id"], 512), "title": scalar(r["title"]), "status": scalar(r["status"], 64), "importance": scalar(r["importance"], 64), "createdDateTime": scalar(r["createdDateTime"], 64), "lastModifiedDateTime": scalar(r["lastModifiedDateTime"], 64),
            "completedDateTime": date(r["completedDateTime"]), "dueDateTime": date(r["dueDateTime"]), "startDateTime": date(r["startDateTime"]), "reminderDateTime": date(r["reminderDateTime"]), "isReminderOn": scalar(r["isReminderOn"]), "hasAttachments": scalar(r["hasAttachments"]),
            "bodyExcluded": .bool(true), "categoriesExcluded": .bool(true), "relatedContentExcluded": .bool(true),
        ]
    }
  static func fakeList() -> JSONRecord { ["id": .string("list-001"), "displayName": .string("Tasks"), "isOwner": .bool(true), "isShared": .bool(false), "wellknownListName": .string("defaultList"), "extensionsExcluded": .bool(true)] }
    static func fakeTask() -> JSONRecord {
        [
            "id": .string("task-001"), "title": .string("Review launch checklist"), "status": .string("notStarted"), "importance": .string("high"), "createdDateTime": .string("2026-07-01T10:00:00Z"), "lastModifiedDateTime": .string("2026-07-12T08:00:00Z"), "completedDateTime": .null,
            "dueDateTime": .string("2026-07-15T17:00:00Z"), "startDateTime": .null, "reminderDateTime": .null, "isReminderOn": .bool(false), "hasAttachments": .bool(false), "bodyExcluded": .bool(true), "categoriesExcluded": .bool(true), "relatedContentExcluded": .bool(true),
        ]
    }
}
