import Foundation

public struct ClickUpProviderActionClientResult: Codable, Equatable, Sendable {
    public var result: JSONRecord
    public var redactionStatus: String
    public init(result: JSONRecord, redactionStatus: String = "private-state-excluded") { self.result = result; self.redactionStatus = redactionStatus }
}

public protocol ClickUpProviderActionClient: Sendable {
    func executeClickUpAction(request: MarketplaceProviderActionAdapterRequest) throws -> ClickUpProviderActionClientResult
}

public struct ClickUpProviderHTTPRequest: Sendable, Equatable {
    public var method: String; public var url: URL; public var headers: [String: String]; public var body: Data?
    public init(method: String, url: URL, headers: [String: String] = [:], body: Data? = nil) { self.method = method; self.url = url; self.headers = headers; self.body = body }
}

public struct ClickUpProviderHTTPResponse: Sendable, Equatable {
    public var statusCode: Int; public var body: Data
    public init(statusCode: Int, body: Data = Data()) { self.statusCode = statusCode; self.body = body }
}

public protocol ClickUpProviderHTTPClient: Sendable { func send(_ request: ClickUpProviderHTTPRequest) throws -> ClickUpProviderHTTPResponse }

public struct URLSessionClickUpProviderHTTPClient: ClickUpProviderHTTPClient {
    private let timeoutSeconds: TimeInterval
    public init(timeoutSeconds: TimeInterval = 20) { self.timeoutSeconds = timeoutSeconds }
    public func send(_ request: ClickUpProviderHTTPRequest) throws -> ClickUpProviderHTTPResponse {
        var value = URLRequest(url: request.url); value.httpMethod = request.method; value.timeoutInterval = timeoutSeconds; value.httpBody = request.body
        request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) }
        let semaphore = DispatchSemaphore(value: 0); var data: Data?; var status: Int?; var failure: Error?
        let task = URLSession.shared.dataTask(with: value) { data = $0; status = ($1 as? HTTPURLResponse)?.statusCode; failure = $2; semaphore.signal() }
        task.resume()
        if semaphore.wait(timeout: .now() + timeoutSeconds) == .timedOut { task.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "clickup_http_timeout", message: "ClickUp API request timed out.") }
        if let failure { throw failure }
        return ClickUpProviderHTTPResponse(statusCode: status ?? 0, body: data ?? Data())
    }
}

public struct FakeClickUpProviderActionClient: ClickUpProviderActionClient {
    public init() {}
    public func executeClickUpAction(request: MarketplaceProviderActionAdapterRequest) throws -> ClickUpProviderActionClientResult {
        switch request.definition.actionKey {
        case "clickup_workspace_list":
            let limit = ClickUpProviderActionAdapterSupport.bounded(request.payload["maxResults"], defaultValue: 5, maximum: 25)
            return output(request, ["semanticReadContract": .string("clickup-workspace-list-v1"), "workspaces": .array((0..<limit).map { .object(["id": .string("workspace-\($0 + 1)"), "name": .string("ClickUp Workspace \($0 + 1)"), "color": .string("#7B68EE"), "memberCount": .number(4)]) })])
        case "clickup_workspace_task_search", "clickup_list_tasks":
            let destination = request.definition.actionKey == "clickup_list_tasks" ? try ClickUpProviderActionAdapterSupport.required(request.payload, "listId") : try ClickUpProviderActionAdapterSupport.required(request.payload, "workspaceId")
            let limit = ClickUpProviderActionAdapterSupport.bounded(request.payload["maxResults"], defaultValue: 5, maximum: 50)
            let contract = request.definition.actionKey == "clickup_list_tasks" ? "clickup-list-tasks-v1" : "clickup-workspace-task-search-v1"
            return output(request, ["semanticReadContract": .string(contract), "destinationId": .string(destination), "tasks": .array((0..<limit).map { .object(ClickUpProviderActionAdapterSupport.fakeTask(index: $0)) })])
        case "clickup_task_get":
            let id = try ClickUpProviderActionAdapterSupport.required(request.payload, "taskId")
            var task = ClickUpProviderActionAdapterSupport.fakeTask(index: 0); task["id"] = .string(id)
            return output(request, ["semanticReadContract": .string("clickup-task-get-v1"), "task": .object(task)])
        case "clickup_task_prepare":
            let normalized = try ClickUpProviderActionAdapterSupport.normalized(request.payload, operation: request.payload["operation"]?.string ?? "create")
            return output(request, ["draftPreview": .object(["task": .object(normalized), "payloadHash": .string(MarketplaceProviderActionApprovalService.payloadHash(normalized)), "providerMutation": .bool(false)])])
        case "clickup_task_create", "clickup_task_update", "clickup_task_comment_create":
            let operation = request.definition.actionKey == "clickup_task_create" ? "create" : request.definition.actionKey == "clickup_task_update" ? "update" : "comment"
            let normalized = try ClickUpProviderActionAdapterSupport.normalized(request.payload, operation: operation)
            let hash = MarketplaceProviderActionApprovalService.payloadHash(normalized)
            return output(
                request,
                [
                    "id": .string(normalized["taskId"]?.string ?? "task-\(ClickUpProviderActionAdapterSupport.suffix(hash))"), "commentId": operation == "comment" ? .string("comment-\(ClickUpProviderActionAdapterSupport.suffix(hash))") : .null, "name": normalized["name"] ?? .null,
                    "url": .string("https://app.clickup.com/t/task"), "payloadHash": .string(hash), "auditId": .string(request.auditIdentity.dispatchId ?? request.idempotencyKey),
                ])
        default: throw MarketplaceProviderActionAdapterFailure(code: "clickup_fake_action_not_supported", message: "The fake ClickUp client does not support this action.")
        }
    }
    private func output(_ request: MarketplaceProviderActionAdapterRequest, _ fields: JSONRecord) -> ClickUpProviderActionClientResult {
        ClickUpProviderActionClientResult(result: base(request).merging(fields) { _, new in new })
    }
    private func base(_ request: MarketplaceProviderActionAdapterRequest) -> JSONRecord {
        [
            "fakeAdapter": .bool(true), "adapterBoundary": .string("clickup-provider-action-adapter"), "clientMode": .string("fake-clickup-client"), "provider": .string("clickup"), "permission": .string(request.permission.rawValue),
            "payloadHash": .string(MarketplaceProviderActionApprovalService.payloadHash(request.payload)), "approved": .bool(request.approvalReference?.status == .approved), "idempotencyKey": .string(request.idempotencyKey), "liveCredentialsUsed": .bool(false),
            "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-state-excluded"),
        ]
    }
}

public final class LiveClickUpProviderActionClient: ClickUpProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService; private let secrets: SecretService; private let http: any ClickUpProviderHTTPClient
    public init(data: LocalDataService, secrets: SecretService, httpClient: any ClickUpProviderHTTPClient = URLSessionClickUpProviderHTTPClient()) { self.data = data; self.secrets = secrets; self.http = httpClient }
    public func executeClickUpAction(request: MarketplaceProviderActionAdapterRequest) throws -> ClickUpProviderActionClientResult {
        if request.definition.actionKey == "clickup_task_prepare" { return try FakeClickUpProviderActionClient().executeClickUpAction(request: request) }
        let token = try accessToken(request)
        switch request.definition.actionKey {
        case "clickup_workspace_list": return try workspaces(request, token)
        case "clickup_workspace_task_search": return try tasks(request, token, inList: false)
        case "clickup_list_tasks": return try tasks(request, token, inList: true)
        case "clickup_task_get": return try task(request, token)
        case "clickup_task_create": return try write(request, token, operation: "create")
        case "clickup_task_update": return try write(request, token, operation: "update")
        case "clickup_task_comment_create": return try write(request, token, operation: "comment")
        default: throw MarketplaceProviderActionAdapterFailure(code: "clickup_live_action_not_supported", message: "Live ClickUp execution does not support this action.")
        }
    }
    private func workspaces(_ request: MarketplaceProviderActionAdapterRequest, _ token: String) throws -> ClickUpProviderActionClientResult {
        let json = try send("GET", "/team", [], nil, token); let limit = ClickUpProviderActionAdapterSupport.bounded(request.payload["maxResults"], defaultValue: 5, maximum: 25)
        let values = json.clickupObject?["teams"]?.clickupArray ?? []
        return result(request, ["semanticReadContract": .string("clickup-workspace-list-v1"), "workspaces": .array(values.prefix(limit).map { .object(ClickUpProviderActionAdapterSupport.workspace($0)) })])
    }
    private func tasks(_ request: MarketplaceProviderActionAdapterRequest, _ token: String, inList: Bool) throws -> ClickUpProviderActionClientResult {
        let id = try ClickUpProviderActionAdapterSupport.required(request.payload, inList ? "listId" : "workspaceId")
        let limit = ClickUpProviderActionAdapterSupport.bounded(request.payload["maxResults"], defaultValue: 10, maximum: 50)
        var query = [URLQueryItem(name: "page", value: "0"), URLQueryItem(name: "include_closed", value: "true")]
        if let text = request.payload["query"]?.string?.clickupNonEmpty { query.append(URLQueryItem(name: "search", value: text)) }
        let json = try send("GET", inList ? "/list/\(ClickUpProviderActionAdapterSupport.path(id))/task" : "/team/\(ClickUpProviderActionAdapterSupport.path(id))/task", query, nil, token)
        let values = json.clickupObject?["tasks"]?.clickupArray ?? []
        return result(request, ["semanticReadContract": .string(inList ? "clickup-list-tasks-v1" : "clickup-workspace-task-search-v1"), "tasks": .array(values.prefix(limit).map { .object(ClickUpProviderActionAdapterSupport.task($0, excerptLimit: 1000)) })])
    }
    private func task(_ request: MarketplaceProviderActionAdapterRequest, _ token: String) throws -> ClickUpProviderActionClientResult {
        let id = try ClickUpProviderActionAdapterSupport.required(request.payload, "taskId"); let limit = ClickUpProviderActionAdapterSupport.bounded(request.payload["maxDescriptionChars"], defaultValue: 4000, maximum: 4000)
        let json = try send("GET", "/task/\(ClickUpProviderActionAdapterSupport.path(id))", [], nil, token)
        return result(request, ["semanticReadContract": .string("clickup-task-get-v1"), "task": .object(ClickUpProviderActionAdapterSupport.task(json, excerptLimit: limit))])
    }
    private func write(_ request: MarketplaceProviderActionAdapterRequest, _ token: String, operation: String) throws -> ClickUpProviderActionClientResult {
        let normalized = try ClickUpProviderActionAdapterSupport.normalized(request.payload, operation: operation)
        let id = normalized["taskId"]?.string; let path: String
        if operation == "create" { path = "/list/\(ClickUpProviderActionAdapterSupport.path(normalized["listId"]?.string ?? ""))/task" }
        else if operation == "comment" { path = "/task/\(ClickUpProviderActionAdapterSupport.path(id ?? ""))/comment" }
        else { path = "/task/\(ClickUpProviderActionAdapterSupport.path(id ?? ""))" }
        let method = operation == "update" ? "PUT" : "POST"
        let json = try send(method, path, [], try JSONSerialization.data(withJSONObject: ClickUpProviderActionAdapterSupport.foundation(normalized, operation: operation)), token)
        let object = json.clickupObject ?? [:]; let hash = MarketplaceProviderActionApprovalService.payloadHash(normalized)
        return result(
            request,
            [
                "id": object["id"] ?? id.map(JSONValue.string) ?? .null, "commentId": object["id"] ?? .null, "name": object["name"] ?? normalized["name"] ?? .null, "url": object["url"] ?? .null, "payloadHash": .string(hash),
                "auditId": .string(request.auditIdentity.dispatchId ?? request.idempotencyKey),
            ])
    }
    private func accessToken(_ request: MarketplaceProviderActionAdapterRequest) throws -> String {
        guard let id = request.auditIdentity.connectionId?.clickupNonEmpty, let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), connection.appSlug == "clickup", connection.appId == request.app.id,
            connection.status == .connected || connection.status == .healthError
        else { throw MarketplaceProviderActionAdapterFailure(code: "clickup_connection_not_ready", message: "ClickUp execution requires a ready Relay Marketplace connection.") }
        guard let ref = connection.credentialRequirements.first(where: { $0.fieldKey == "clickup_oauth_access_token" })?.secretReferenceId?.clickupNonEmpty else {
            throw MarketplaceProviderActionAdapterFailure(code: "clickup_credentials_missing", message: "The ClickUp connection is missing its Keychain token reference.")
        }
        do { return try secrets.getSecretValue(ref) } catch { throw MarketplaceProviderActionAdapterFailure(code: "clickup_credentials_unavailable", message: "Relay could not read the saved ClickUp token. Reconnect ClickUp.") }
    }
    private func send(_ method: String, _ path: String, _ query: [URLQueryItem], _ body: Data?, _ token: String) throws -> JSONValue {
        var components = URLComponents(string: "https://api.clickup.com/api/v2\(path)"); components?.queryItems = query.isEmpty ? nil : query
        guard let url = components?.url else { throw MarketplaceProviderActionAdapterFailure(code: "clickup_invalid_url", message: "Could not build the ClickUp API URL.") }
        let response = try http.send(ClickUpProviderHTTPRequest(method: method, url: url, headers: ["Authorization": token, "Accept": "application/json", "Content-Type": "application/json; charset=utf-8"], body: body))
        guard (200..<300).contains(response.statusCode) else { throw MarketplaceProviderActionAdapterFailure(code: response.statusCode == 429 ? "clickup_rate_limited" : "clickup_http_error", message: "ClickUp API returned an HTTP error.", providerStatusCode: response.statusCode) }
        return response.body.isEmpty ? .object([:]) : ClickUpProviderActionAdapterSupport.json(try JSONSerialization.jsonObject(with: response.body))
    }
    private func result(_ request: MarketplaceProviderActionAdapterRequest, _ fields: JSONRecord) -> ClickUpProviderActionClientResult {
        let base: JSONRecord = [
            "adapterBoundary": .string("clickup-provider-action-adapter"), "clientMode": .string("live-clickup-v2-api"), "provider": .string("clickup"), "permission": .string(request.permission.rawValue), "payloadHash": .string(MarketplaceProviderActionApprovalService.payloadHash(request.payload)),
            "approved": .bool(request.approvalReference?.status == .approved), "idempotencyKey": .string(request.idempotencyKey), "liveCredentialsUsed": .bool(true), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-state-excluded"),
        ]
        return ClickUpProviderActionClientResult(result: base.merging(fields) { _, new in new })
    }
}

public struct ClickUpProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = ["clickup_workspace_list", "clickup_workspace_task_search", "clickup_list_tasks", "clickup_task_get", "clickup_task_prepare", "clickup_task_create", "clickup_task_update", "clickup_task_comment_create"]
    private let client: any ClickUpProviderActionClient
    public init(client: any ClickUpProviderActionClient = FakeClickUpProviderActionClient()) { self.client = client }
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "clickup" else { throw MarketplaceProviderActionAdapterFailure(code: "clickup_adapter_wrong_provider", message: "ClickUp adapter can execute only ClickUp actions.") }
        guard Self.allowed.contains(request.definition.actionKey) else { throw MarketplaceProviderActionAdapterFailure(code: "clickup_action_not_allowlisted", message: "The requested ClickUp action is not in the V1 allowlist.") }
        let value = try client.executeClickUpAction(request: request); return MarketplaceProviderActionAdapterResult(result: value.result, error: nil, redactionStatus: value.redactionStatus)
    }
}

public enum ClickUpProviderActionAdapterSupport {
    public static func required(_ payload: JSONRecord, _ key: String) throws -> String {
        guard let value = payload[key]?.string?.clickupNonEmpty else { throw MarketplaceProviderActionAdapterFailure(code: "clickup_missing_required_field", message: "ClickUp \(key) is required.", detail: ["field": .string(key)]) }; return value
    }
    public static func bounded(_ value: JSONValue?, defaultValue: Int, maximum: Int) -> Int { max(1, min(maximum, value?.number.map(Int.init) ?? value?.string.flatMap(Int.init) ?? defaultValue)) }
    public static func normalized(_ payload: JSONRecord, operation: String) throws -> JSONRecord {
        var out: JSONRecord = [:]
        if operation == "create" { out["listId"] = .string(try required(payload, "listId")); out["name"] = .string(try required(payload, "name")) }
        if operation == "update" { out["taskId"] = .string(try required(payload, "taskId")) }
        if operation == "comment" { out["taskId"] = .string(try required(payload, "taskId")); out["comment"] = .string(try required(payload, "comment")) }
        for key in ["name", "description", "status", "priority", "dueDate", "startDate"] { if let value = payload[key]?.string?.clickupNonEmpty { out[key] = .string(value) } }
        if let assignees = payload["assigneeIds"] { out["assigneeIds"] = assignees }
        guard out["name"]?.string?.count ?? 0 <= 512, out["description"]?.string?.count ?? 0 <= 16000, out["comment"]?.string?.count ?? 0 <= 8000 else { throw MarketplaceProviderActionAdapterFailure(code: "clickup_payload_too_large", message: "ClickUp task payload exceeds Relay V1 bounds.") }
        return out
    }
    public static func workspace(_ value: JSONValue) -> JSONRecord {
        let o = value.clickupObject ?? [:]; return ["id": o["id"] ?? .null, "name": o["name"] ?? .null, "color": o["color"] ?? .null, "memberCount": .number(Double(o["members"]?.clickupArray?.count ?? 0)), "redactionStatus": .string("private-state-excluded")]
    }
    public static func task(_ value: JSONValue, excerptLimit: Int) -> JSONRecord {
        let o = value.clickupObject ?? [:], text = o["text_content"]?.string ?? o["description"]?.string ?? ""; let status = o["status"]?.clickupObject, priority = o["priority"]?.clickupObject, list = o["list"]?.clickupObject, folder = o["folder"]?.clickupObject, space = o["space"]?.clickupObject
        return [
            "id": o["id"] ?? .null, "customId": o["custom_id"] ?? .null, "name": o["name"] ?? .null, "descriptionExcerpt": .string(String(text.prefix(excerptLimit))), "truncated": .bool(text.count > excerptLimit), "status": status?["status"] ?? .null, "priority": priority?["priority"] ?? .null,
            "assignees": .array((o["assignees"]?.clickupArray ?? []).compactMap { $0.clickupObject?["username"] }), "dueDate": o["due_date"] ?? .null, "startDate": o["start_date"] ?? .null, "list": list?["name"] ?? .null, "folder": folder?["name"] ?? .null, "space": space?["name"] ?? .null,
            "url": o["url"] ?? .null, "updatedAt": o["date_updated"] ?? .null, "parentTaskId": o["parent"] ?? .null, "tags": o["tags"] ?? .array([]), "redactionStatus": .string("private-state-excluded"),
        ]
    }
    public static func fakeTask(index: Int) -> JSONRecord {
        [
            "id": .string("task-\(index + 1)"), "customId": .string("REL-\(index + 1)"), "name": .string("ClickUp task \(index + 1)"), "descriptionExcerpt": .string("Bounded task context for Relay triage."), "status": .string("in progress"), "priority": .string("normal"),
            "assignees": .array([.string("Relay Owner")]), "dueDate": .string("1783900800000"), "startDate": .null, "list": .string("Launch"), "folder": .string("Product"), "space": .string("Relay"), "url": .string("https://app.clickup.com/t/task-\(index + 1)"),
            "updatedAt": .string("1783814400000"), "parentTaskId": .null, "tags": .array([]), "redactionStatus": .string("private-state-excluded"),
        ]
    }
    public static func foundation(_ record: JSONRecord, operation: String) -> [String: Any] {
        if operation == "comment" { return ["comment_text": record["comment"]?.string ?? "", "notify_all": false] }
        var out: [String: Any] = [:];
        for (key, value) in record {
            let api = ["dueDate": "due_date", "startDate": "start_date", "assigneeIds": "assignees"][key] ?? key;
            switch value {
            case .string(let v): if key != "taskId" && key != "listId" { out[api] = v };
            case .array(let values): out[api] = values.compactMap(\.string);
            default: break
            }
        }; return out
    }
    public static func path(_ value: String) -> String { value.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed)?.replacingOccurrences(of: "?", with: "%3F") ?? value }
    public static func suffix(_ value: String) -> String { var hash: UInt64 = 1469598103934665603; for byte in value.utf8 { hash ^= UInt64(byte); hash &*= 1099511628211 }; return String(String(hash, radix: 16).suffix(10)) }
    public static func json(_ value: Any) -> JSONValue {
        if let v = value as? String { return .string(v) }; if let v = value as? Bool { return .bool(v) }; if let v = value as? Int { return .number(Double(v)) }; if let v = value as? Double { return .number(v) }; if let v = value as? [String: Any] { return .object(v.mapValues(json)) };
        if let v = value as? [Any] { return .array(v.map(json)) }; if value is NSNull { return .null }; return .string(String(describing: value))
    }
}

private extension JSONValue { var clickupObject: JSONRecord? { if case .object(let value) = self { return value }; return nil }; var clickupArray: [JSONValue]? { if case .array(let value) = self { return value }; return nil } }
private extension String { var clickupNonEmpty: String? { let value = trimmingCharacters(in: .whitespacesAndNewlines); return value.isEmpty ? nil : value } }
