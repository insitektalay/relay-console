import Foundation

public struct AsanaProviderActionClientResult: Codable, Equatable, Sendable {
    public var result: JSONRecord
    public var redactionStatus: String
    public init(result: JSONRecord, redactionStatus: String = "private-state-excluded") {
        self.result = result
        self.redactionStatus = redactionStatus
    }
}

public protocol AsanaProviderActionClient: Sendable {
    func executeAsanaAction(request: MarketplaceProviderActionAdapterRequest) throws -> AsanaProviderActionClientResult
}

public struct AsanaProviderHTTPRequest: Sendable, Equatable {
    public var method: String
    public var url: URL
    public var headers: [String: String]
    public var body: Data?
    public init(method: String, url: URL, headers: [String: String] = [:], body: Data? = nil) {
        self.method = method; self.url = url; self.headers = headers; self.body = body
    }
}

public struct AsanaProviderHTTPResponse: Sendable, Equatable {
    public var statusCode: Int
    public var body: Data
    public init(statusCode: Int, body: Data = Data()) { self.statusCode = statusCode; self.body = body }
}

public protocol AsanaProviderHTTPClient: Sendable {
    func send(_ request: AsanaProviderHTTPRequest) throws -> AsanaProviderHTTPResponse
}

public struct URLSessionAsanaProviderHTTPClient: AsanaProviderHTTPClient {
    private let timeoutSeconds: TimeInterval
    public init(timeoutSeconds: TimeInterval = 20) { self.timeoutSeconds = timeoutSeconds }
    public func send(_ request: AsanaProviderHTTPRequest) throws -> AsanaProviderHTTPResponse {
        var urlRequest = URLRequest(url: request.url)
        urlRequest.httpMethod = request.method
        urlRequest.timeoutInterval = timeoutSeconds
        urlRequest.httpBody = request.body
        request.headers.forEach { urlRequest.setValue($0.value, forHTTPHeaderField: $0.key) }
        let semaphore = DispatchSemaphore(value: 0)
        var resultData: Data?
        var resultStatus: Int?
        var resultError: Error?
        let task = URLSession.shared.dataTask(with: urlRequest) { data, response, error in
            resultData = data
            resultStatus = (response as? HTTPURLResponse)?.statusCode
            resultError = error
            semaphore.signal()
        }
        task.resume()
        if semaphore.wait(timeout: .now() + timeoutSeconds) == .timedOut {
            task.cancel()
            throw MarketplaceProviderActionAdapterFailure(code: "asana_http_timeout", message: "Asana API request timed out.")
        }
        if let resultError { throw resultError }
        return AsanaProviderHTTPResponse(statusCode: resultStatus ?? 0, body: resultData ?? Data())
    }
}

public struct FakeAsanaProviderActionClient: AsanaProviderActionClient {
    public init() {}
    public func executeAsanaAction(request: MarketplaceProviderActionAdapterRequest) throws -> AsanaProviderActionClientResult {
        switch request.definition.actionKey {
        case "asana_task_search": return try taskSearch(request)
        case "asana_project_list": return try projectList(request)
        case "asana_task_get": return try taskGet(request)
        case "asana_task_prepare": return try taskPrepare(request)
        case "asana_task_create": return try taskWrite(request, create: true)
        case "asana_task_update": return try taskWrite(request, create: false)
        default:
            throw MarketplaceProviderActionAdapterFailure(
                code: "asana_fake_action_not_supported", message: "The fake Asana client does not support this action.",
                detail: ["actionKey": .string(request.definition.actionKey)]
            )
        }
    }

    private func taskSearch(_ request: MarketplaceProviderActionAdapterRequest) throws -> AsanaProviderActionClientResult {
        let workspaceGID = try AsanaProviderActionAdapterSupport.required(request.payload, key: "workspaceGID", label: "workspace GID")
        let query = request.payload["query"]?.string?.asanaNonEmpty ?? "assigned work"
        let limit = AsanaProviderActionAdapterSupport.boundedInt(request.payload["maxResults"], defaultValue: 5, minValue: 1, maxValue: 25)
        return AsanaProviderActionClientResult(result: base(request).merging([
            "semanticReadContract": .string("asana-task-search-v1"),
            "workspaceGID": .string(workspaceGID),
            "tasks": .array((0..<limit).map { index in .object(fakeTask(index: index, name: "\(query) task \(index + 1)")) })
        ]) { _, new in new })
    }

    private func projectList(_ request: MarketplaceProviderActionAdapterRequest) throws -> AsanaProviderActionClientResult {
        let workspaceGID = try AsanaProviderActionAdapterSupport.required(request.payload, key: "workspaceGID", label: "workspace GID")
        let limit = AsanaProviderActionAdapterSupport.boundedInt(request.payload["maxResults"], defaultValue: 5, minValue: 1, maxValue: 25)
        return AsanaProviderActionClientResult(result: base(request).merging([
            "semanticReadContract": .string("asana-project-list-v1"),
            "workspaceGID": .string(workspaceGID),
            "projects": .array((0..<limit).map { index in .object([
                "gid": .string("project-\(index + 1)"), "name": .string("Asana Project \(index + 1)"),
                "archived": .bool(false), "owner": .string("Project Owner \(index + 1)"),
                "team": .string("Relay Team"), "permalinkUrl": .string("https://app.asana.com/0/project-\(index + 1)/list"),
                "modifiedAt": .string("2026-07-11T00:00:00Z"), "redactionStatus": .string("private-state-excluded")
            ]) })
        ]) { _, new in new })
    }

    private func taskGet(_ request: MarketplaceProviderActionAdapterRequest) throws -> AsanaProviderActionClientResult {
        let taskGID = try AsanaProviderActionAdapterSupport.required(request.payload, key: "taskGID", label: "task GID")
        var task = fakeTask(index: 0, name: "Asana task \(taskGID)")
        task["gid"] = .string(taskGID)
        task["createdAt"] = .string("2026-07-01T00:00:00Z")
        task["startOn"] = .string("2026-07-10")
        task["resourceSubtype"] = .string("default_task")
        return AsanaProviderActionClientResult(result: base(request).merging([
            "semanticReadContract": .string("asana-task-get-v1"), "task": .object(task)
        ]) { _, new in new })
    }

    private func taskPrepare(_ request: MarketplaceProviderActionAdapterRequest) throws -> AsanaProviderActionClientResult {
        let normalized = try AsanaProviderActionAdapterSupport.normalizedTaskPayload(request.payload, requireTaskGID: false)
        return AsanaProviderActionClientResult(result: base(request).merging([
            "draftPreview": .object([
                "operation": request.payload["operation"] ?? .string("create"),
                "task": .object(normalized),
                "payloadHash": .string(MarketplaceProviderActionApprovalService.payloadHash(normalized)),
                "providerMutation": .bool(false), "redactionStatus": .string("private-state-excluded")
            ])
        ]) { _, new in new })
    }

    private func taskWrite(_ request: MarketplaceProviderActionAdapterRequest, create: Bool) throws -> AsanaProviderActionClientResult {
        let normalized = try AsanaProviderActionAdapterSupport.normalizedTaskPayload(request.payload, requireTaskGID: !create)
        let suffix = AsanaProviderActionAdapterSupport.stableSuffix(MarketplaceProviderActionApprovalService.payloadHash(normalized))
        let gid = normalized["taskGID"]?.string ?? "task-\(suffix)"
        return AsanaProviderActionClientResult(result: base(request).merging([
            "gid": .string(gid), "name": normalized["name"] ?? .string("Updated Asana task"),
            "completed": normalized["completed"] ?? .bool(false),
            "permalinkUrl": .string("https://app.asana.com/0/0/\(gid)"),
            "payloadHash": .string(MarketplaceProviderActionApprovalService.payloadHash(normalized)),
            "auditId": .string(request.auditIdentity.dispatchId ?? request.idempotencyKey),
            "redactionStatus": .string("private-state-excluded")
        ]) { _, new in new })
    }

    private func fakeTask(index: Int, name: String) -> JSONRecord {
        [
            "gid": .string("task-\(index + 1)"), "name": .string(name), "completed": .bool(false),
            "assignee": .string("Relay Owner \(index + 1)"), "dueOn": .string("2026-07-\(String(format: "%02d", 12 + index))"),
            "projects": .array([.string("Relay Launch")]), "permalinkUrl": .string("https://app.asana.com/0/0/task-\(index + 1)"),
            "modifiedAt": .string("2026-07-11T00:00:00Z"), "notesExcerpt": .string("Human-meaningful task notes for bounded Asana triage."),
            "truncated": .bool(false), "redactionStatus": .string("private-state-excluded")
        ]
    }

    private func base(_ request: MarketplaceProviderActionAdapterRequest) -> JSONRecord {
        [
            "fakeAdapter": .bool(true), "adapterBoundary": .string("asana-provider-action-adapter"),
            "clientMode": .string("fake-asana-client"), "provider": .string("asana"),
            "permission": .string(request.permission.rawValue),
            "payloadHash": .string(MarketplaceProviderActionApprovalService.payloadHash(request.payload)),
            "approved": .bool(request.approvalReference?.status == .approved),
            "idempotencyKey": .string(request.idempotencyKey), "liveCredentialsUsed": .bool(false),
            "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-state-excluded")
        ]
    }
}

public final class LiveAsanaProviderActionClient: AsanaProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService
    private let secrets: SecretService
    private let http: any AsanaProviderHTTPClient
    public init(data: LocalDataService, secrets: SecretService, httpClient: any AsanaProviderHTTPClient = URLSessionAsanaProviderHTTPClient()) {
        self.data = data; self.secrets = secrets; self.http = httpClient
    }

    public func executeAsanaAction(request: MarketplaceProviderActionAdapterRequest) throws -> AsanaProviderActionClientResult {
        if request.definition.actionKey == "asana_task_prepare" { return try FakeAsanaProviderActionClient().executeAsanaAction(request: request) }
        let token = try accessToken(request)
        switch request.definition.actionKey {
        case "asana_task_search": return try search(request, token: token)
        case "asana_project_list": return try projects(request, token: token)
        case "asana_task_get": return try task(request, token: token)
        case "asana_task_create": return try write(request, token: token, create: true)
        case "asana_task_update": return try write(request, token: token, create: false)
        default: throw MarketplaceProviderActionAdapterFailure(code: "asana_live_action_not_supported", message: "Live Asana execution does not support this action.")
        }
    }

    private func search(_ request: MarketplaceProviderActionAdapterRequest, token: String) throws -> AsanaProviderActionClientResult {
        let workspace = try AsanaProviderActionAdapterSupport.required(request.payload, key: "workspaceGID", label: "workspace GID")
        let limit = AsanaProviderActionAdapterSupport.boundedInt(request.payload["maxResults"], defaultValue: 5, minValue: 1, maxValue: 25)
        let project = request.payload["projectGID"]?.string?.asanaNonEmpty
        var query = [URLQueryItem(name: "limit", value: "\(limit)"), URLQueryItem(name: "opt_fields", value: AsanaProviderActionAdapterSupport.taskOptFields)]
        if let text = request.payload["query"]?.string?.asanaNonEmpty { query.append(URLQueryItem(name: "text", value: text)) }
        if let completed = request.payload["completed"]?.bool { query.append(URLQueryItem(name: "completed", value: completed ? "true" : "false")) }
        let path = project.map { "/projects/\(AsanaProviderActionAdapterSupport.path($0))/tasks" }
            ?? "/workspaces/\(AsanaProviderActionAdapterSupport.path(workspace))/tasks/search"
        let response = try send(method: "GET", path: path, query: query, body: nil, token: token)
        let values = response.asanaObject?["data"]?.asanaArray ?? []
        return AsanaProviderActionClientResult(result: base(request).merging([
            "semanticReadContract": .string("asana-task-search-v1"), "workspaceGID": .string(workspace),
            "tasks": .array(values.prefix(limit).map { .object(AsanaProviderActionAdapterSupport.taskSummary($0, notesLimit: 1000)) })
        ]) { _, new in new })
    }

    private func projects(_ request: MarketplaceProviderActionAdapterRequest, token: String) throws -> AsanaProviderActionClientResult {
        let workspace = try AsanaProviderActionAdapterSupport.required(request.payload, key: "workspaceGID", label: "workspace GID")
        let limit = AsanaProviderActionAdapterSupport.boundedInt(request.payload["maxResults"], defaultValue: 5, minValue: 1, maxValue: 25)
        let response = try send(method: "GET", path: "/workspaces/\(AsanaProviderActionAdapterSupport.path(workspace))/projects", query: [
            URLQueryItem(name: "limit", value: "\(limit)"), URLQueryItem(name: "opt_fields", value: "gid,name,archived,owner.name,team.name,permalink_url,modified_at")
        ], body: nil, token: token)
        let values = response.asanaObject?["data"]?.asanaArray ?? []
        return AsanaProviderActionClientResult(result: base(request).merging([
            "semanticReadContract": .string("asana-project-list-v1"), "workspaceGID": .string(workspace),
            "projects": .array(values.prefix(limit).map { .object(AsanaProviderActionAdapterSupport.projectSummary($0)) })
        ]) { _, new in new })
    }

    private func task(_ request: MarketplaceProviderActionAdapterRequest, token: String) throws -> AsanaProviderActionClientResult {
        let gid = try AsanaProviderActionAdapterSupport.required(request.payload, key: "taskGID", label: "task GID")
        let notesLimit = AsanaProviderActionAdapterSupport.boundedInt(request.payload["maxNotesChars"], defaultValue: 4000, minValue: 1, maxValue: 4000)
        let response = try send(method: "GET", path: "/tasks/\(AsanaProviderActionAdapterSupport.path(gid))", query: [
            URLQueryItem(name: "opt_fields", value: AsanaProviderActionAdapterSupport.taskOptFields + ",created_at,start_on,resource_subtype")
        ], body: nil, token: token)
        let value = response.asanaObject?["data"] ?? .object([:])
        return AsanaProviderActionClientResult(result: base(request).merging([
            "semanticReadContract": .string("asana-task-get-v1"), "task": .object(AsanaProviderActionAdapterSupport.taskSummary(value, notesLimit: notesLimit))
        ]) { _, new in new })
    }

    private func write(_ request: MarketplaceProviderActionAdapterRequest, token: String, create: Bool) throws -> AsanaProviderActionClientResult {
        let normalized = try AsanaProviderActionAdapterSupport.normalizedTaskPayload(request.payload, requireTaskGID: !create)
        var dataObject = AsanaProviderActionAdapterSupport.foundationObject(normalized)
        let gid = dataObject.removeValue(forKey: "taskGID") as? String
        let body = try JSONSerialization.data(withJSONObject: ["data": dataObject])
        let response = try send(method: create ? "POST" : "PUT", path: create ? "/tasks" : "/tasks/\(AsanaProviderActionAdapterSupport.path(gid ?? ""))", query: [
            URLQueryItem(name: "opt_fields", value: "gid,name,completed,permalink_url")
        ], body: body, token: token)
        let object = response.asanaObject?["data"]?.asanaObject ?? [:]
        return AsanaProviderActionClientResult(result: base(request).merging([
            "gid": object["gid"] ?? .null, "name": object["name"] ?? .null,
            "completed": object["completed"] ?? .bool(false), "permalinkUrl": object["permalink_url"] ?? .null,
            "payloadHash": .string(MarketplaceProviderActionApprovalService.payloadHash(normalized)),
            "auditId": .string(request.auditIdentity.dispatchId ?? request.idempotencyKey)
        ]) { _, new in new })
    }

    private func accessToken(_ request: MarketplaceProviderActionAdapterRequest) throws -> String {
        guard let id = request.auditIdentity.connectionId?.asanaNonEmpty,
              let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id),
              connection.appSlug == "asana", connection.appId == request.app.id,
              connection.status == .connected || connection.status == .healthError else {
            throw MarketplaceProviderActionAdapterFailure(code: "asana_connection_not_ready", message: "Asana execution requires a ready Relay Marketplace connection.")
        }
        guard let secretId = connection.credentialRequirements.first(where: { $0.fieldKey == "asana_oauth_access_token" })?.secretReferenceId?.asanaNonEmpty else {
            throw MarketplaceProviderActionAdapterFailure(code: "asana_credentials_missing", message: "The Asana connection is missing its Keychain token reference.")
        }
        do { return try secrets.getSecretValue(secretId) }
        catch { throw MarketplaceProviderActionAdapterFailure(code: "asana_credentials_unavailable", message: "Relay could not read the saved Asana token. Reconnect Asana.") }
    }

    private func send(method: String, path: String, query: [URLQueryItem], body: Data?, token: String) throws -> JSONValue {
        var components = URLComponents(string: "https://app.asana.com/api/1.0\(path)")
        components?.queryItems = query.isEmpty ? nil : query
        guard let url = components?.url else { throw MarketplaceProviderActionAdapterFailure(code: "asana_invalid_url", message: "Could not build the Asana API URL.") }
        let response = try http.send(AsanaProviderHTTPRequest(method: method, url: url, headers: [
            "Authorization": "Bearer \(token)", "Accept": "application/json", "Content-Type": "application/json; charset=utf-8", "User-Agent": "RelayConsole"
        ], body: body))
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(code: response.statusCode == 429 ? "asana_rate_limited" : "asana_http_error", message: "Asana API returned an HTTP error.", providerStatusCode: response.statusCode)
        }
        guard !response.body.isEmpty else { return .object([:]) }
        return AsanaProviderActionAdapterSupport.json(try JSONSerialization.jsonObject(with: response.body))
    }

    private func base(_ request: MarketplaceProviderActionAdapterRequest) -> JSONRecord {
        ["adapterBoundary": .string("asana-provider-action-adapter"), "clientMode": .string("live-asana-rest-api"),
         "provider": .string("asana"), "permission": .string(request.permission.rawValue),
         "payloadHash": .string(MarketplaceProviderActionApprovalService.payloadHash(request.payload)),
         "approved": .bool(request.approvalReference?.status == .approved), "idempotencyKey": .string(request.idempotencyKey),
         "liveCredentialsUsed": .bool(true), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-state-excluded")]
    }
}

public struct AsanaProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = ["asana_task_search", "asana_project_list", "asana_task_get", "asana_task_prepare", "asana_task_create", "asana_task_update"]
    private let client: any AsanaProviderActionClient
    public init(client: any AsanaProviderActionClient = FakeAsanaProviderActionClient()) { self.client = client }
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "asana" else { throw MarketplaceProviderActionAdapterFailure(code: "asana_adapter_wrong_provider", message: "Asana adapter can execute only Asana actions.") }
        guard Self.allowed.contains(request.definition.actionKey) else { throw MarketplaceProviderActionAdapterFailure(code: "asana_action_not_allowlisted", message: "The requested Asana action is not in the V1 allowlist.") }
        let output = try client.executeAsanaAction(request: request)
        return MarketplaceProviderActionAdapterResult(result: output.result, error: nil, redactionStatus: output.redactionStatus)
    }
}

public enum AsanaProviderActionAdapterSupport {
    public static let taskOptFields = "gid,name,completed,assignee.name,due_on,memberships.project.name,permalink_url,modified_at,notes"
    public static func required(_ payload: JSONRecord, key: String, label: String) throws -> String {
        guard let value = payload[key]?.string?.asanaNonEmpty else { throw MarketplaceProviderActionAdapterFailure(code: "asana_missing_required_field", message: "Asana \(label) is required.", detail: ["field": .string(key)]) }
        return value
    }
    public static func boundedInt(_ value: JSONValue?, defaultValue: Int, minValue: Int, maxValue: Int) -> Int {
        max(minValue, min(maxValue, value?.number.map(Int.init) ?? value?.string.flatMap(Int.init) ?? defaultValue))
    }
    public static func normalizedTaskPayload(_ payload: JSONRecord, requireTaskGID: Bool) throws -> JSONRecord {
        var output: JSONRecord = [:]
        if requireTaskGID { output["taskGID"] = .string(try required(payload, key: "taskGID", label: "task GID")) }
        else if let value = payload["taskGID"]?.string?.asanaNonEmpty { output["taskGID"] = .string(value) }
        if !requireTaskGID { output["name"] = .string(try required(payload, key: "name", label: "task name")) }
        else if let value = payload["name"]?.string?.asanaNonEmpty { output["name"] = .string(value) }
        for key in ["workspaceGID", "projectGID", "notes", "assigneeGID", "dueOn"] {
            if let value = payload[key]?.string?.asanaNonEmpty { output[key] = .string(value) }
        }
        if let completed = payload["completed"]?.bool { output["completed"] = .bool(completed) }
        guard output["name"]?.string?.count ?? 0 <= 512 else { throw MarketplaceProviderActionAdapterFailure(code: "asana_task_name_too_long", message: "Asana task names are limited to 512 characters in Relay V1.") }
        guard output["notes"]?.string?.count ?? 0 <= 16000 else { throw MarketplaceProviderActionAdapterFailure(code: "asana_task_notes_too_long", message: "Asana task notes are limited to 16000 characters in Relay V1.") }
        if !requireTaskGID && output["workspaceGID"] == nil && output["projectGID"] == nil { throw MarketplaceProviderActionAdapterFailure(code: "asana_destination_required", message: "Asana task creation requires a workspace or project GID.") }
        return output
    }
    public static func taskSummary(_ value: JSONValue, notesLimit: Int) -> JSONRecord {
        let object = value.asanaObject ?? [:]
        let assignee = object["assignee"]?.asanaObject
        let memberships = object["memberships"]?.asanaArray ?? []
        let notes = object["notes"]?.string ?? ""
        var result: JSONRecord = [
            "gid": object["gid"] ?? .null, "name": object["name"] ?? .null, "completed": object["completed"] ?? .bool(false),
            "assignee": assignee?["name"] ?? .null, "dueOn": object["due_on"] ?? .null,
            "projects": .array(memberships.compactMap { $0.asanaObject?["project"]?.asanaObject?["name"] }),
            "permalinkUrl": object["permalink_url"] ?? .null, "modifiedAt": object["modified_at"] ?? .null,
            "notesExcerpt": .string(String(notes.prefix(notesLimit))), "truncated": .bool(notes.count > notesLimit),
            "redactionStatus": .string("private-state-excluded")
        ]
        result["createdAt"] = object["created_at"]
        result["startOn"] = object["start_on"]
        result["resourceSubtype"] = object["resource_subtype"]
        return result
    }
    public static func projectSummary(_ value: JSONValue) -> JSONRecord {
        let object = value.asanaObject ?? [:]
        return ["gid": object["gid"] ?? .null, "name": object["name"] ?? .null, "archived": object["archived"] ?? .bool(false),
                "owner": object["owner"]?.asanaObject?["name"] ?? .null, "team": object["team"]?.asanaObject?["name"] ?? .null,
                "permalinkUrl": object["permalink_url"] ?? .null, "modifiedAt": object["modified_at"] ?? .null,
                "redactionStatus": .string("private-state-excluded")]
    }
    public static func path(_ value: String) -> String { value.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed)?.replacingOccurrences(of: "?", with: "%3F") ?? value }
    public static func json(_ value: Any) -> JSONValue {
        if let value = value as? String { return .string(value) }; if let value = value as? Bool { return .bool(value) }
        if let value = value as? Int { return .number(Double(value)) }; if let value = value as? Double { return .number(value) }
        if let value = value as? [String: Any] { return .object(value.mapValues(json)) }; if let value = value as? [Any] { return .array(value.map(json)) }
        if value is NSNull { return .null }; return .string(String(describing: value))
    }
    public static func foundationObject(_ record: JSONRecord) -> [String: Any] {
        var result: [String: Any] = [:]
        for (key, value) in record {
            switch value { case .string(let v): result[apiKey(key)] = v; case .bool(let v): result[apiKey(key)] = v; case .number(let v): result[apiKey(key)] = v; default: break }
        }
        if let project = record["projectGID"]?.string { result.removeValue(forKey: "project"); result["projects"] = [project] }
        return result
    }
    private static func apiKey(_ key: String) -> String {
        ["workspaceGID": "workspace", "projectGID": "project", "assigneeGID": "assignee", "dueOn": "due_on", "taskGID": "taskGID"][key] ?? key
    }
    public static func stableSuffix(_ value: String) -> String {
        var hash: UInt64 = 1469598103934665603; for byte in value.utf8 { hash ^= UInt64(byte); hash &*= 1099511628211 }; return String(String(hash, radix: 16).suffix(10))
    }
}

private extension JSONValue {
    var asanaObject: JSONRecord? { if case .object(let value) = self { return value }; return nil }
    var asanaArray: [JSONValue]? { if case .array(let value) = self { return value }; return nil }
}

private extension String {
    var asanaNonEmpty: String? { let value = trimmingCharacters(in: .whitespacesAndNewlines); return value.isEmpty ? nil : value }
}
