import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

public struct GoogleTasksProviderActionClientResult: Sendable { public var result: JSONRecord; public init(result: JSONRecord) { self.result = result } }
public protocol GoogleTasksProviderActionClient: Sendable { func executeGoogleTasksAction(request: MarketplaceProviderActionAdapterRequest) throws -> GoogleTasksProviderActionClientResult }

public struct FakeGoogleTasksProviderActionClient: GoogleTasksProviderActionClient {
  public init() {}
  public func executeGoogleTasksAction(request: MarketplaceProviderActionAdapterRequest) throws -> GoogleTasksProviderActionClientResult {
    let fields: JSONRecord
    switch request.definition.actionKey {
    case "google_tasks_tasklists_list": fields = ["semanticReadContract": .string("google-tasks-tasklists-v1"), "taskLists": .array([.object(GoogleTasksProviderActionSupport.fakeTaskList())])]
    case "google_tasks_tasks_list": fields = ["semanticReadContract": .string("google-tasks-tasks-v1"), "tasks": .array([.object(GoogleTasksProviderActionSupport.fakeTask())])]
    case "google_tasks_update_prepare": fields = ["semanticDraftContract": .string("google-tasks-update-prepare-v1"), "draftPreview": .object(GoogleTasksProviderActionSupport.preview(request.payload))]
        case "google_tasks_task_create", "google_tasks_task_patch":
            fields = ["semanticWriteContract": .string(request.definition.actionKey == "google_tasks_task_create" ? "google-tasks-create-v1" : "google-tasks-safe-patch-v1"), "providerMutation": .bool(true), "task": .object(GoogleTasksProviderActionSupport.fakeTask())]
    default: throw MarketplaceProviderActionAdapterFailure(code: "google_tasks_action_not_supported", message: "Unsupported Google Tasks action.")
    }
    return GoogleTasksProviderActionClientResult(result: GoogleTasksProviderActionSupport.base("fake-tasks-api-v1").merging(fields) { _, new in new })
  }
}

public final class LiveGoogleTasksProviderActionClient: GoogleTasksProviderActionClient, @unchecked Sendable {
  private let data: LocalDataService; private let secrets: SecretService
  public init(data: LocalDataService, secrets: SecretService) { self.data = data; self.secrets = secrets }
  public func executeGoogleTasksAction(request: MarketplaceProviderActionAdapterRequest) throws -> GoogleTasksProviderActionClientResult {
        if request.definition.actionKey == "google_tasks_update_prepare" {
            return GoogleTasksProviderActionClientResult(
                result: GoogleTasksProviderActionSupport.base("local-no-provider-request").merging(["semanticDraftContract": .string("google-tasks-update-prepare-v1"), "draftPreview": .object(try GoogleTasksProviderActionSupport.validatedPreview(request.payload)), "providerMutation": .bool(false)])
                { _, new in new })
        }
    let token = try authorization(request); let root: JSONValue; let fields: JSONRecord
    switch request.definition.actionKey {
    case "google_tasks_tasklists_list":
      root = try send(token: token, method: "GET", path: "/users/@me/lists", query: [URLQueryItem(name: "maxResults", value: "20")], body: nil, etag: nil)
      fields = ["semanticReadContract": .string("google-tasks-tasklists-v1"), "taskLists": .array(GoogleTasksProviderActionSupport.array(GoogleTasksProviderActionSupport.object(root)["items"]).prefix(20).map { .object(GoogleTasksProviderActionSupport.taskList($0)) })]
    case "google_tasks_tasks_list":
      let list = try GoogleTasksProviderActionSupport.safeId(request.payload["taskListId"], name: "taskListId")
            root = try send(
                token: token, method: "GET", path: "/lists/\(GoogleTasksProviderActionSupport.path(list))/tasks",
                query: [URLQueryItem(name: "maxResults", value: "100"), URLQueryItem(name: "showCompleted", value: "true"), URLQueryItem(name: "showDeleted", value: "false"), URLQueryItem(name: "showHidden", value: "false")], body: nil, etag: nil)
      fields = ["semanticReadContract": .string("google-tasks-tasks-v1"), "tasks": .array(GoogleTasksProviderActionSupport.array(GoogleTasksProviderActionSupport.object(root)["items"]).prefix(100).map { .object(GoogleTasksProviderActionSupport.task($0)) })]
    case "google_tasks_task_create":
      let list = try GoogleTasksProviderActionSupport.safeId(request.payload["taskListId"], name: "taskListId"), body = try GoogleTasksProviderActionSupport.writeBody(request.payload, patch: false)
      root = try send(token: token, method: "POST", path: "/lists/\(GoogleTasksProviderActionSupport.path(list))/tasks", query: [], body: body, etag: nil)
      fields = ["semanticWriteContract": .string("google-tasks-create-v1"), "providerMutation": .bool(true), "task": .object(GoogleTasksProviderActionSupport.task(root))]
    case "google_tasks_task_patch":
      let list = try GoogleTasksProviderActionSupport.safeId(request.payload["taskListId"], name: "taskListId"), taskId = try GoogleTasksProviderActionSupport.safeId(request.payload["taskId"], name: "taskId")
      let existing = try send(token: token, method: "GET", path: "/lists/\(GoogleTasksProviderActionSupport.path(list))/tasks/\(GoogleTasksProviderActionSupport.path(taskId))", query: [], body: nil, etag: nil)
      guard GoogleTasksProviderActionSupport.object(existing)["assignmentInfo"] == nil else { throw MarketplaceProviderActionAdapterFailure(code: "google_tasks_assigned_task_mutation_blocked", message: "Tasks assigned from Docs or Chat cannot be mutated by Relay V1.") }
      let etag = try GoogleTasksProviderActionSupport.safeEtag(request.payload["etag"])
      root = try send(token: token, method: "PATCH", path: "/lists/\(GoogleTasksProviderActionSupport.path(list))/tasks/\(GoogleTasksProviderActionSupport.path(taskId))", query: [], body: try GoogleTasksProviderActionSupport.writeBody(request.payload, patch: true), etag: etag)
      fields = ["semanticWriteContract": .string("google-tasks-safe-patch-v1"), "providerMutation": .bool(true), "assignedTaskPreflight": .bool(true), "task": .object(GoogleTasksProviderActionSupport.task(root))]
    default: throw MarketplaceProviderActionAdapterFailure(code: "google_tasks_live_action_not_supported", message: "Unsupported live Google Tasks action.")
    }
    return GoogleTasksProviderActionClientResult(result: GoogleTasksProviderActionSupport.base("live-tasks-api-v1").merging(fields) { _, new in new })
  }
    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> String {
        guard let id = request.auditIdentity.connectionId, let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), connection.appSlug == "google-tasks", connection.appId == request.app.id, connection.status == .connected,
            connection.health.state == .ready, connection.grantedScopes == ProviderConnectionService.googleTasksRelayOwnedOAuthScopes, connection.health.diagnostics["assignedTaskMutationEnabled"]?.bool == false, connection.health.diagnostics["destructiveActionsEnabled"]?.bool == false,
            let ref = connection.credentialRequirements.first(where: { $0.fieldKey == "google_tasks_oauth_access_token" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "google_tasks_connection_not_ready", message: "Google Tasks requires a ready exact-scope non-destructive Relay-owned connection.") }; return try secrets.getSecretValue(ref)
    }
  private func send(token: String, method: String, path: String, query: [URLQueryItem], body: JSONRecord?, etag: String?) throws -> JSONValue {
    var components = URLComponents(string: GoogleTasksProviderActionSupport.apiOrigin + path)!; components.queryItems = query
    guard let url = components.url, url.scheme == "https", url.host == "tasks.googleapis.com" else { throw MarketplaceProviderActionAdapterFailure(code: "google_tasks_unsafe_url", message: "Unsafe Google Tasks API URL.") }
        var request = URLRequest(url: url, timeoutInterval: 30); request.httpMethod = method; request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization"); if let etag { request.setValue(etag, forHTTPHeaderField: "If-Match") };
        if let body { request.httpBody = try JSONEncoder().encode(JSONValue.object(body)); request.setValue("application/json", forHTTPHeaderField: "Content-Type") }
    let semaphore = DispatchSemaphore(value: 0); var captured: Result<(Data, HTTPURLResponse), Error>?
        URLSession.shared.dataTask(with: request) { bytes, response, error in
            defer { semaphore.signal() }; if let error { captured = .failure(error); return };
            guard let bytes, let response = response as? HTTPURLResponse else { captured = .failure(MarketplaceProviderActionAdapterFailure(code: "google_tasks_transport_error", message: "Google Tasks returned no HTTP response.")); return }; captured = .success((bytes, response))
        }.resume()
        guard semaphore.wait(timeout: .now() + 31) == .success, let captured else { throw MarketplaceProviderActionAdapterFailure(code: "google_tasks_timeout", message: "Google Tasks API request timed out.") }; let (bytes, response) = try captured.get();
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(code: response.statusCode == 429 ? "google_tasks_rate_limited" : response.statusCode == 412 ? "google_tasks_stale_etag" : "google_tasks_api_error", message: "Google Tasks API request failed.", providerStatusCode: response.statusCode)
        }; guard bytes.count <= 1_000_000 else { throw MarketplaceProviderActionAdapterFailure(code: "google_tasks_response_too_large", message: "Google Tasks response exceeded the 1 MB V1 bound.") }; return try JSONDecoder().decode(JSONValue.self, from: bytes)
  }
}

public struct GoogleTasksProviderActionAdapter: MarketplaceProviderActionAdapter {
  private static let allowed: Set<String> = ["google_tasks_tasklists_list", "google_tasks_tasks_list", "google_tasks_update_prepare", "google_tasks_task_create", "google_tasks_task_patch"]
  private let client: any GoogleTasksProviderActionClient
  public init(client: any GoogleTasksProviderActionClient = FakeGoogleTasksProviderActionClient()) { self.client = client }
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "google-tasks", Self.allowed.contains(request.definition.actionKey) else { throw MarketplaceProviderActionAdapterFailure(code: "google_tasks_action_not_allowlisted", message: "Google Tasks action is not allowlisted.") };
        let write = ["google_tasks_task_create", "google_tasks_task_patch"].contains(request.definition.actionKey);
        guard write ? request.permission != .blocked : request.permission == .allowed else { throw MarketplaceProviderActionAdapterFailure(code: "google_tasks_permission_denied", message: "Google Tasks action is not permitted by policy.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executeGoogleTasksAction(request: request).result, error: nil, redactionStatus: "assignment-context-links-resource-keys-destructive-actions-excluded")
    }
}

public enum GoogleTasksProviderActionSupport {
  public static let apiOrigin = "https://tasks.googleapis.com/tasks/v1"
    static func base(_ mode: String) -> JSONRecord {
        [
            "provider": .string("google-tasks"), "adapterBoundary": .string("google-tasks-provider-action-adapter"), "clientMode": .string(mode), "assignedTaskMutationEnabled": .bool(false), "destructiveActionsEnabled": .bool(false), "assignmentContextReturned": .bool(false),
            "automaticPagination": .bool(false), "rawProviderToolExposure": .bool(false),
        ]
    }
    static func object(_ value: JSONValue?) -> JSONRecord { guard case .object(let value)? = value else { return [:] }; return value }; static func array(_ value: JSONValue?) -> [JSONValue] { guard case .array(let value)? = value else { return [] }; return value };
    static func scalar(_ value: JSONValue?) -> JSONValue {
        guard let value else { return .null };
        switch value {
        case .string(let s): return .string(String(s.prefix(8192)));
        case .number, .bool, .null: return value;
        default: return .null
        }
    }
    static func safeId(_ value: JSONValue?, name: String) throws -> String {
        guard let text = value?.string, !text.isEmpty, text.count <= 1024, text.allSatisfy({ $0.isLetter || $0.isNumber || $0 == "-" || $0 == "_" || $0 == ":" }) else {
            throw MarketplaceProviderActionAdapterFailure(code: "google_tasks_invalid_\(name)", message: "Google Tasks requires a bounded \(name).")
        }; return text
    }; static func path(_ value: String) -> String { value.addingPercentEncoding(withAllowedCharacters: .alphanumerics.union(CharacterSet(charactersIn: "-_~.:"))) ?? value }
    static func text(_ value: JSONValue?, name: String, maximum: Int, required: Bool = true) throws -> String? {
        guard let raw = value?.string else { if required { throw MarketplaceProviderActionAdapterFailure(code: "google_tasks_missing_\(name)", message: "Google Tasks requires \(name).") }; return nil }; let text = raw.trimmingCharacters(in: .whitespacesAndNewlines);
        guard !text.isEmpty, text.count <= maximum else { throw MarketplaceProviderActionAdapterFailure(code: "google_tasks_invalid_\(name)", message: "Google Tasks requires a bounded \(name).") }; return text
    }
    static func safeEtag(_ value: JSONValue?) throws -> String {
        guard let text = value?.string, !text.isEmpty, text.count <= 512, !text.contains("\n"), !text.contains("\r") else { throw MarketplaceProviderActionAdapterFailure(code: "google_tasks_invalid_etag", message: "A bounded Task ETag is required.") }; return text
    }
    static func due(_ value: JSONValue?) throws -> JSONValue? {
        guard let text = value?.string else { return nil }; let parts = text.prefix(10).split(separator: "-");
        guard parts.count == 3, parts.allSatisfy({ $0.allSatisfy(\.isNumber) }) else { throw MarketplaceProviderActionAdapterFailure(code: "google_tasks_invalid_due", message: "Due must be an ISO date; Tasks stores date only.") }; return .string(String(text.prefix(10)) + "T00:00:00.000Z")
    }
    static func writeBody(_ payload: JSONRecord, patch: Bool) throws -> JSONRecord {
        var body: JSONRecord = [:]; if let title = try text(payload["title"], name: "title", maximum: 1024, required: !patch) { body["title"] = .string(title) }; if let notes = try text(payload["notes"], name: "notes", maximum: 8192, required: false) { body["notes"] = .string(notes) };
        if let due = try due(payload["dueDate"]) { body["due"] = due };
        if patch, let status = payload["status"]?.string { guard ["needsAction", "completed"].contains(status) else { throw MarketplaceProviderActionAdapterFailure(code: "google_tasks_invalid_status", message: "Status must be needsAction or completed.") }; body["status"] = .string(status) };
        guard !body.isEmpty else { throw MarketplaceProviderActionAdapterFailure(code: "google_tasks_empty_write", message: "Task write requires at least one allowlisted field.") }; return body
    }
  static func taskList(_ value: JSONValue?) -> JSONRecord { let r = object(value); return ["id": scalar(r["id"]), "etag": scalar(r["etag"]), "title": scalar(r["title"]), "updated": scalar(r["updated"]), "selfLinkReturned": .bool(false)] }
    static func task(_ value: JSONValue?) -> JSONRecord {
        let r = object(value);
        return [
            "id": scalar(r["id"]), "etag": scalar(r["etag"]), "title": scalar(r["title"]), "notes": scalar(r["notes"]), "status": scalar(r["status"]), "dueDate": r["due"]?.string.map { .string(String($0.prefix(10))) } ?? .null, "completed": scalar(r["completed"]),
            "hasParent": .bool(r["parent"] != nil), "assigned": .bool(r["assignmentInfo"] != nil), "linksReturned": .bool(false), "assignmentContextReturned": .bool(false), "driveResourceInfoReturned": .bool(false), "spaceInfoReturned": .bool(false),
        ]
    }
  static func preview(_ payload: JSONRecord) -> JSONRecord { ["taskListId": payload["taskListId"] ?? .null, "taskId": payload["taskId"] ?? .null, "operation": payload["operation"] ?? .null, "title": payload["title"] ?? .null, "providerMutation": .bool(false)] }
    static func validatedPreview(_ payload: JSONRecord) throws -> JSONRecord {
        _ = try safeId(payload["taskListId"], name: "taskListId"); let operation = try text(payload["operation"], name: "operation", maximum: 16)!;
        guard ["create", "patch"].contains(operation) else { throw MarketplaceProviderActionAdapterFailure(code: "google_tasks_operation_not_allowlisted", message: "Only create and patch may be prepared.") }; if operation == "patch" { _ = try safeId(payload["taskId"], name: "taskId") };
        _ = try writeBody(payload, patch: operation == "patch"); return preview(payload)
    }
  public static func fakeTaskList() -> JSONRecord { ["id": .string("list-1"), "etag": .string("etag-list-1"), "title": .string("My Tasks"), "updated": .string("2026-07-12T01:00:00Z"), "selfLinkReturned": .bool(false)] }
    public static func fakeTask() -> JSONRecord {
        [
            "id": .string("task-1"), "etag": .string("etag-task-1"), "title": .string("Review Relay plan"), "notes": .string("Bounded task notes"), "status": .string("needsAction"), "dueDate": .string("2026-07-15"), "completed": .null, "hasParent": .bool(false), "assigned": .bool(false),
            "linksReturned": .bool(false), "assignmentContextReturned": .bool(false), "driveResourceInfoReturned": .bool(false), "spaceInfoReturned": .bool(false),
        ]
    }
}
