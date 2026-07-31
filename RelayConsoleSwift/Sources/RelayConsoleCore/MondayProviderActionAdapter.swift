import Foundation

public struct MondayProviderActionClientResult: Codable, Equatable, Sendable {
    public var result: JSONRecord; public var redactionStatus: String
    public init(result: JSONRecord, redactionStatus: String = "private-state-excluded") { self.result = result; self.redactionStatus = redactionStatus }
}

public protocol MondayProviderActionClient: Sendable { func executeMondayAction(request: MarketplaceProviderActionAdapterRequest) throws -> MondayProviderActionClientResult }

public struct MondayProviderHTTPRequest: Sendable, Equatable {
    public var method: String; public var url: URL; public var headers: [String: String]; public var body: Data?
    public init(method: String, url: URL, headers: [String: String] = [:], body: Data? = nil) { self.method = method; self.url = url; self.headers = headers; self.body = body }
}
public struct MondayProviderHTTPResponse: Sendable, Equatable {
    public var statusCode: Int; public var headers: [String: String]; public var body: Data
    public init(statusCode: Int, headers: [String: String] = [:], body: Data = Data()) { self.statusCode = statusCode; self.headers = headers; self.body = body }
}
public protocol MondayProviderHTTPClient: Sendable { func send(_ request: MondayProviderHTTPRequest) throws -> MondayProviderHTTPResponse }

public struct URLSessionMondayProviderHTTPClient: MondayProviderHTTPClient {
    private let timeoutSeconds: TimeInterval
    public init(timeoutSeconds: TimeInterval = 20) { self.timeoutSeconds = timeoutSeconds }
    public func send(_ request: MondayProviderHTTPRequest) throws -> MondayProviderHTTPResponse {
        var value = URLRequest(url: request.url); value.httpMethod = request.method; value.timeoutInterval = timeoutSeconds; value.httpBody = request.body
        request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) }
        let semaphore = DispatchSemaphore(value: 0); var data: Data?; var response: HTTPURLResponse?; var failure: Error?
        let task = URLSession.shared.dataTask(with: value) { data = $0; response = $1 as? HTTPURLResponse; failure = $2; semaphore.signal() }
        task.resume()
        if semaphore.wait(timeout: .now() + timeoutSeconds) == .timedOut { task.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "monday_http_timeout", message: "Monday.com API request timed out.") }
        if let failure { throw failure }
        let headers = response?.allHeaderFields.reduce(into: [String: String]()) { out, pair in out[String(describing: pair.key)] = String(describing: pair.value) } ?? [:]
        return MondayProviderHTTPResponse(statusCode: response?.statusCode ?? 0, headers: headers, body: data ?? Data())
    }
}

public struct FakeMondayProviderActionClient: MondayProviderActionClient {
    public init() {}
    public func executeMondayAction(request: MarketplaceProviderActionAdapterRequest) throws -> MondayProviderActionClientResult {
        switch request.definition.actionKey {
        case "monday_board_list":
            let limit = MondayProviderActionSupport.bounded(request.payload["maxResults"], 5, 25)
            return output(request, ["semanticReadContract": .string("monday-board-list-v1"), "boards": .array((0..<limit).map { .object(MondayProviderActionSupport.fakeBoard($0)) })])
        case "monday_board_items":
            let board = try MondayProviderActionSupport.required(request.payload, "boardId"), limit = MondayProviderActionSupport.bounded(request.payload["maxResults"], 5, 50)
            return output(request, ["semanticReadContract": .string("monday-board-items-v1"), "boardId": .string(board), "items": .array((0..<limit).map { .object(MondayProviderActionSupport.fakeItem($0, board)) })])
        case "monday_item_get":
            let id = try MondayProviderActionSupport.required(request.payload, "itemId"); var item = MondayProviderActionSupport.fakeItem(0, "board-1"); item["id"] = .string(id)
            return output(request, ["semanticReadContract": .string("monday-item-get-v1"), "item": .object(item)])
        case "monday_item_updates":
            let id = try MondayProviderActionSupport.required(request.payload, "itemId"), limit = MondayProviderActionSupport.bounded(request.payload["maxResults"], 5, 25)
            return output(
                request,
                [
                    "semanticReadContract": .string("monday-item-updates-v1"), "itemId": .string(id),
                    "updates": .array(
                        (0..<limit).map {
                            .object([
                                "id": .string("update-\($0 + 1)"), "bodyExcerpt": .string("Monday.com progress update \($0 + 1)"), "creator": .string("Relay Owner"), "createdAt": .string("2026-07-11T00:00:00Z"), "updatedAt": .string("2026-07-11T00:00:00Z"), "replyCount": .number(0),
                                "truncated": .bool(false),
                            ])
                        }),
                ])
        case "monday_item_prepare":
            let normalized = try MondayProviderActionSupport.normalized(request.payload, operation: request.payload["operation"]?.string ?? "create")
            return output(request, ["draftPreview": .object(["variables": .object(normalized), "payloadHash": .string(MarketplaceProviderActionApprovalService.payloadHash(normalized)), "providerMutation": .bool(false)])])
        case "monday_item_create", "monday_item_update", "monday_item_comment_create":
            let operation = request.definition.actionKey == "monday_item_create" ? "create" : request.definition.actionKey == "monday_item_update" ? "update" : "comment"
            let normalized = try MondayProviderActionSupport.normalized(request.payload, operation: operation), hash = MarketplaceProviderActionApprovalService.payloadHash(normalized)
            return output(
                request,
                [
                    "id": .string(normalized["itemId"]?.string ?? "item-\(MondayProviderActionSupport.suffix(hash))"), "updateId": operation == "comment" ? .string("update-\(MondayProviderActionSupport.suffix(hash))") : .null, "name": normalized["name"] ?? .null,
                    "url": .string("https://example.monday.com/boards/1/pulses/1"), "payloadHash": .string(hash), "auditId": .string(request.auditIdentity.dispatchId ?? request.idempotencyKey),
                ])
        default: throw MarketplaceProviderActionAdapterFailure(code: "monday_fake_action_not_supported", message: "The fake Monday.com client does not support this action.")
        }
    }
    private func output(_ request: MarketplaceProviderActionAdapterRequest, _ fields: JSONRecord) -> MondayProviderActionClientResult { MondayProviderActionClientResult(result: base(request).merging(fields) { _, new in new }) }
    private func base(_ request: MarketplaceProviderActionAdapterRequest) -> JSONRecord {
        [
            "fakeAdapter": .bool(true), "adapterBoundary": .string("monday-provider-action-adapter"), "clientMode": .string("fake-monday-graphql-client"), "provider": .string("monday-com"), "permission": .string(request.permission.rawValue),
            "payloadHash": .string(MarketplaceProviderActionApprovalService.payloadHash(request.payload)), "approved": .bool(request.approvalReference?.status == .approved), "idempotencyKey": .string(request.idempotencyKey), "liveCredentialsUsed": .bool(false),
            "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-state-excluded"),
        ]
    }
}

public final class LiveMondayProviderActionClient: MondayProviderActionClient, @unchecked Sendable {
    public static let apiVersion = "2026-04"
    private let data: LocalDataService; private let secrets: SecretService; private let http: any MondayProviderHTTPClient
    public init(data: LocalDataService, secrets: SecretService, httpClient: any MondayProviderHTTPClient = URLSessionMondayProviderHTTPClient()) { self.data = data; self.secrets = secrets; self.http = httpClient }
    public func executeMondayAction(request: MarketplaceProviderActionAdapterRequest) throws -> MondayProviderActionClientResult {
        if request.definition.actionKey == "monday_item_prepare" { return try FakeMondayProviderActionClient().executeMondayAction(request: request) }
        let token = try accessToken(request)
        switch request.definition.actionKey {
        case "monday_board_list": return try boards(request, token)
        case "monday_board_items": return try boardItems(request, token)
        case "monday_item_get": return try item(request, token)
        case "monday_item_updates": return try updates(request, token)
        case "monday_item_create": return try write(request, token, "create")
        case "monday_item_update": return try write(request, token, "update")
        case "monday_item_comment_create": return try write(request, token, "comment")
        default: throw MarketplaceProviderActionAdapterFailure(code: "monday_live_action_not_supported", message: "Live Monday.com execution does not support this action.")
        }
    }
    private func boards(_ request: MarketplaceProviderActionAdapterRequest, _ token: String) throws -> MondayProviderActionClientResult {
        let limit = MondayProviderActionSupport.bounded(request.payload["maxResults"], 5, 25)
        let query = "query RelayBoards($limit: Int!, $workspaceIds: [ID!]) { boards(limit: $limit, workspace_ids: $workspaceIds) { id name description state board_kind url updated_at workspace { id name } groups { id title } columns { id title type } } }"
        var variables: [String: Any] = ["limit": limit]; if let workspace = request.payload["workspaceId"]?.string?.mondayNonEmpty { variables["workspaceIds"] = [workspace] }
        let data = try graphQL(query, variables, token), values = data.mondayObject?["boards"]?.mondayArray ?? []
        return output(request, ["semanticReadContract": .string("monday-board-list-v1"), "boards": .array(values.prefix(limit).map { .object(MondayProviderActionSupport.board($0)) })])
    }
    private func boardItems(_ request: MarketplaceProviderActionAdapterRequest, _ token: String) throws -> MondayProviderActionClientResult {
        let boardId = try MondayProviderActionSupport.required(request.payload, "boardId"), limit = MondayProviderActionSupport.bounded(request.payload["maxResults"], 10, 50)
        let query =
            """
                query RelayBoardItems($boardIds: [ID!]!, $limit: Int!) { boards(ids: $boardIds) { id items_page(limit: $limit) { cursor items { id name url created_at updated_at group { id title } creator { id name } parent_item { id \
                name } subitems { id name } column_values { id type text value column { title } } } } } }
                """
        let data = try graphQL(query, ["boardIds": [boardId], "limit": limit], token), board = data.mondayObject?["boards"]?.mondayArray?.first?.mondayObject
        var values = board?["items_page"]?.mondayObject?["items"]?.mondayArray ?? []
        if let needle = request.payload["query"]?.string?.mondayNonEmpty?.lowercased() { values = values.filter { $0.mondayObject?["name"]?.string?.lowercased().contains(needle) == true } }
        return output(request, ["semanticReadContract": .string("monday-board-items-v1"), "boardId": .string(boardId), "items": .array(values.prefix(limit).map { .object(MondayProviderActionSupport.item($0, boardId: boardId, excerptLimit: 1000)) })])
    }
    private func item(_ request: MarketplaceProviderActionAdapterRequest, _ token: String) throws -> MondayProviderActionClientResult {
        let id = try MondayProviderActionSupport.required(request.payload, "itemId"), limit = MondayProviderActionSupport.bounded(request.payload["maxDescriptionChars"], 4000, 4000)
        let query =
            """
                query RelayItem($ids: [ID!]!) { items(ids: $ids) { id name url created_at updated_at board { id name url } group { id title } creator { id name } parent_item { id name } subitems { id name } column_values { id type text \
                value column { title } } updates(limit: 5) { id body text_body created_at updated_at creator { id name } replies { id } } } }
                """
        let data = try graphQL(query, ["ids": [id]], token), value = data.mondayObject?["items"]?.mondayArray?.first ?? .object([:])
        return output(request, ["semanticReadContract": .string("monday-item-get-v1"), "item": .object(MondayProviderActionSupport.item(value, boardId: value.mondayObject?["board"]?.mondayObject?["id"]?.string ?? "", excerptLimit: limit))])
    }
    private func updates(_ request: MarketplaceProviderActionAdapterRequest, _ token: String) throws -> MondayProviderActionClientResult {
        let id = try MondayProviderActionSupport.required(request.payload, "itemId"), limit = MondayProviderActionSupport.bounded(request.payload["maxResults"], 5, 25), bodyLimit = MondayProviderActionSupport.bounded(request.payload["maxBodyChars"], 1000, 4000)
        let query = "query RelayItemUpdates($ids: [ID!]!, $limit: Int!) { items(ids: $ids) { updates(limit: $limit) { id body text_body created_at updated_at creator { id name } replies { id } } } }"
        let data = try graphQL(query, ["ids": [id], "limit": limit], token), values = data.mondayObject?["items"]?.mondayArray?.first?.mondayObject?["updates"]?.mondayArray ?? []
        return output(request, ["semanticReadContract": .string("monday-item-updates-v1"), "itemId": .string(id), "updates": .array(values.prefix(limit).map { .object(MondayProviderActionSupport.update($0, bodyLimit)) })])
    }
    private func write(_ request: MarketplaceProviderActionAdapterRequest, _ token: String, _ operation: String) throws -> MondayProviderActionClientResult {
        let normalized = try MondayProviderActionSupport.normalized(request.payload, operation: operation), query: String, variables: [String: Any], key: String
        if operation == "create" {
            query = "mutation RelayCreateItem($boardId: ID!, $groupId: String, $name: String!, $columnValues: JSON) { create_item(board_id: $boardId, group_id: $groupId, item_name: $name, column_values: $columnValues) { id name url board { id } } }";
            variables = MondayProviderActionSupport.foundation(normalized); key = "create_item"
        }
        else if operation == "update" {
            query = "mutation RelayUpdateItem($boardId: ID!, $itemId: ID!, $columnValues: JSON!) { change_multiple_column_values(board_id: $boardId, item_id: $itemId, column_values: $columnValues) { id name url } }"; variables = MondayProviderActionSupport.foundation(normalized);
            key = "change_multiple_column_values"
        }
        else { query = "mutation RelayCreateUpdate($itemId: ID!, $body: String!) { create_update(item_id: $itemId, body: $body) { id body created_at creator { id name } } }"; variables = MondayProviderActionSupport.foundation(normalized); key = "create_update" }
        let data = try graphQL(query, variables, token), object = data.mondayObject?[key]?.mondayObject ?? [:], hash = MarketplaceProviderActionApprovalService.payloadHash(normalized)
        return output(
            request,
            [
                "id": object["id"] ?? normalized["itemId"] ?? .null, "updateId": operation == "comment" ? object["id"] ?? .null : .null, "name": object["name"] ?? normalized["name"] ?? .null, "url": object["url"] ?? .null, "bodyExcerpt": object["body"] ?? .null, "payloadHash": .string(hash),
                "auditId": .string(request.auditIdentity.dispatchId ?? request.idempotencyKey),
            ])
    }
    private func graphQL(_ query: String, _ variables: [String: Any], _ token: String) throws -> JSONValue {
        let body = try JSONSerialization.data(withJSONObject: ["query": query, "variables": variables])
        let response = try http.send(MondayProviderHTTPRequest(method: "POST", url: URL(string: "https://api.monday.com/v2")!, headers: ["Authorization": token, "API-Version": Self.apiVersion, "Content-Type": "application/json", "Accept": "application/json"], body: body))
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: response.statusCode == 429 ? "monday_rate_limited" : "monday_http_error", message: "Monday.com API returned an HTTP error.", providerStatusCode: response.statusCode,
                detail: ["retryAfter": response.headers.first { $0.key.lowercased() == "retry-after" }.map { .string($0.value) } ?? .null])
        }
        let json = MondayProviderActionSupport.json(try JSONSerialization.jsonObject(with: response.body)), root = json.mondayObject ?? [:]
        if let errors = root["errors"]?.mondayArray, !errors.isEmpty {
            let message = errors.first?.mondayObject?["message"]?.string ?? "Monday.com GraphQL request failed."; throw MarketplaceProviderActionAdapterFailure(code: "monday_graphql_error", message: message, detail: ["errorCount": .number(Double(errors.count))])
        }
        return root["data"] ?? .object([:])
    }
    private func accessToken(_ request: MarketplaceProviderActionAdapterRequest) throws -> String {
        guard let id = request.auditIdentity.connectionId?.mondayNonEmpty, let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), connection.appSlug == "monday-com", connection.appId == request.app.id,
            connection.status == .connected || connection.status == .healthError
        else { throw MarketplaceProviderActionAdapterFailure(code: "monday_connection_not_ready", message: "Monday.com execution requires a ready Relay Marketplace connection.") }
        guard let ref = connection.credentialRequirements.first(where: { $0.fieldKey == "monday_oauth_access_token" })?.secretReferenceId?.mondayNonEmpty else {
            throw MarketplaceProviderActionAdapterFailure(code: "monday_credentials_missing", message: "The Monday.com connection is missing its Keychain token reference.")
        }
        do { return try secrets.getSecretValue(ref) } catch { throw MarketplaceProviderActionAdapterFailure(code: "monday_credentials_unavailable", message: "Relay could not read the saved Monday.com token. Reconnect Monday.com.") }
    }
    private func output(_ request: MarketplaceProviderActionAdapterRequest, _ fields: JSONRecord) -> MondayProviderActionClientResult {
        let base: JSONRecord = [
            "adapterBoundary": .string("monday-provider-action-adapter"), "clientMode": .string("live-monday-versioned-graphql"), "provider": .string("monday-com"), "apiVersion": .string(Self.apiVersion), "permission": .string(request.permission.rawValue),
            "payloadHash": .string(MarketplaceProviderActionApprovalService.payloadHash(request.payload)), "approved": .bool(request.approvalReference?.status == .approved), "idempotencyKey": .string(request.idempotencyKey), "liveCredentialsUsed": .bool(true),
            "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-state-excluded"),
        ]
            ;
        return MondayProviderActionClientResult(result: base.merging(fields) { _, new in new })
    }
}

public struct MondayProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = ["monday_board_list", "monday_board_items", "monday_item_get", "monday_item_updates", "monday_item_prepare", "monday_item_create", "monday_item_update", "monday_item_comment_create"]
    private let client: any MondayProviderActionClient
    public init(client: any MondayProviderActionClient = FakeMondayProviderActionClient()) { self.client = client }
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "monday-com" else { throw MarketplaceProviderActionAdapterFailure(code: "monday_adapter_wrong_provider", message: "Monday.com adapter can execute only Monday.com actions.") };
        guard Self.allowed.contains(request.definition.actionKey) else { throw MarketplaceProviderActionAdapterFailure(code: "monday_action_not_allowlisted", message: "The requested Monday.com action is not in the V1 allowlist.") }; let value = try client.executeMondayAction(request: request);
        return MarketplaceProviderActionAdapterResult(result: value.result, error: nil, redactionStatus: value.redactionStatus)
    }
}

public enum MondayProviderActionSupport {
    public static func required(_ payload: JSONRecord, _ key: String) throws -> String {
        guard let value = payload[key]?.string?.mondayNonEmpty else { throw MarketplaceProviderActionAdapterFailure(code: "monday_missing_required_field", message: "Monday.com \(key) is required.", detail: ["field": .string(key)]) }; return value
    }
    public static func bounded(_ value: JSONValue?, _ fallback: Int, _ maximum: Int) -> Int { max(1, min(maximum, value?.number.map(Int.init) ?? value?.string.flatMap(Int.init) ?? fallback)) }
    public static func normalized(_ payload: JSONRecord, operation: String) throws -> JSONRecord {
        var out: JSONRecord = [:]; if operation == "create" { out["boardId"] = .string(try required(payload, "boardId")); out["name"] = .string(try required(payload, "name")) };
        if operation == "update" {
            out["boardId"] = .string(try required(payload, "boardId")); out["itemId"] = .string(try required(payload, "itemId"));
            guard payload["columnValues"] != nil else { throw MarketplaceProviderActionAdapterFailure(code: "monday_column_values_required", message: "Monday.com item update requires bounded columnValues.") }
        }; if operation == "comment" { out["itemId"] = .string(try required(payload, "itemId")); out["body"] = .string(try required(payload, "body")) }; for key in ["groupId", "name"] { if let value = payload[key]?.string?.mondayNonEmpty { out[key] = .string(value) } };
        if let values = payload["columnValues"] { out["columnValues"] = values };
        guard out["name"]?.string?.count ?? 0 <= 512, out["body"]?.string?.count ?? 0 <= 8000 else { throw MarketplaceProviderActionAdapterFailure(code: "monday_payload_too_large", message: "Monday.com payload exceeds Relay V1 bounds.") }; return out
    }
    public static func board(_ value: JSONValue) -> JSONRecord {
        let o = value.mondayObject ?? [:], workspace = o["workspace"]?.mondayObject;
        return [
            "id": o["id"] ?? .null, "name": o["name"] ?? .null, "descriptionExcerpt": .string(String((o["description"]?.string ?? "").prefix(1000))), "state": o["state"] ?? .null, "type": o["board_kind"] ?? .null, "workspace": workspace?["name"] ?? .null, "workspaceId": workspace?["id"] ?? .null,
            "groups": .array((o["groups"]?.mondayArray ?? []).compactMap { $0.mondayObject?["title"] }),
            "columns": .array((o["columns"]?.mondayArray ?? []).map { .object(["id": $0.mondayObject?["id"] ?? .null, "title": $0.mondayObject?["title"] ?? .null, "type": $0.mondayObject?["type"] ?? .null]) }), "url": o["url"] ?? .null, "updatedAt": o["updated_at"] ?? .null,
            "redactionStatus": .string("private-state-excluded"),
        ]
    }
    public static func item(_ value: JSONValue, boardId: String, excerptLimit: Int) -> JSONRecord {
        let o = value.mondayObject ?? [:], group = o["group"]?.mondayObject, creator = o["creator"]?.mondayObject, parent = o["parent_item"]?.mondayObject;
        return [
            "id": o["id"] ?? .null, "name": o["name"] ?? .null, "url": o["url"] ?? .null, "boardId": .string(boardId), "group": group?["title"] ?? .null, "groupId": group?["id"] ?? .null, "creator": creator?["name"] ?? .null, "createdAt": o["created_at"] ?? .null,
            "updatedAt": o["updated_at"] ?? .null, "parentItemId": parent?["id"] ?? .null, "subitems": .array((o["subitems"]?.mondayArray ?? []).map { .object(["id": $0.mondayObject?["id"] ?? .null, "name": $0.mondayObject?["name"] ?? .null]) }),
            "columnValues": .array(
                (o["column_values"]?.mondayArray ?? []).map {
                    let c = $0.mondayObject ?? [:]; return .object(["id": c["id"] ?? .null, "title": c["column"]?.mondayObject?["title"] ?? .null, "type": c["type"] ?? .null, "text": c["text"] ?? .null, "value": c["value"] ?? .null])
                }), "updates": .array((o["updates"]?.mondayArray ?? []).prefix(5).map { .object(update($0, excerptLimit)) }), "redactionStatus": .string("private-state-excluded"),
        ]
    }
    public static func update(_ value: JSONValue, _ limit: Int) -> JSONRecord {
        let o = value.mondayObject ?? [:], body = o["text_body"]?.string ?? o["body"]?.string ?? "";
        return [
            "id": o["id"] ?? .null, "bodyExcerpt": .string(String(body.prefix(limit))), "creator": o["creator"]?.mondayObject?["name"] ?? .null, "createdAt": o["created_at"] ?? .null, "updatedAt": o["updated_at"] ?? .null, "replyCount": .number(Double(o["replies"]?.mondayArray?.count ?? 0)),
            "truncated": .bool(body.count > limit), "redactionStatus": .string("private-state-excluded"),
        ]
    }
    public static func fakeBoard(_ index: Int) -> JSONRecord {
        [
            "id": .string("board-\(index + 1)"), "name": .string("Monday.com Board \(index + 1)"), "descriptionExcerpt": .string("Bounded board context."), "state": .string("active"), "type": .string("board"), "workspace": .string("Relay Workspace"), "groups": .array([.string("In progress")]),
            "columns": .array([.object(["id": .string("status"), "title": .string("Status"), "type": .string("color")])]), "url": .string("https://example.monday.com/boards/\(index + 1)"), "updatedAt": .string("2026-07-11T00:00:00Z"),
        ]
    }
    public static func fakeItem(_ index: Int, _ board: String) -> JSONRecord {
        [
            "id": .string("item-\(index + 1)"), "name": .string("Monday.com item \(index + 1)"), "url": .string("https://example.monday.com/boards/\(board)/pulses/\(index + 1)"), "boardId": .string(board), "group": .string("In progress"), "creator": .string("Relay Owner"),
            "createdAt": .string("2026-07-10T00:00:00Z"), "updatedAt": .string("2026-07-11T00:00:00Z"), "parentItemId": .null, "subitems": .array([]),
            "columnValues": .array([.object(["id": .string("status"), "title": .string("Status"), "type": .string("color"), "text": .string("Working on it"), "value": .string("{\"index\":1}")])]), "updates": .array([]), "redactionStatus": .string("private-state-excluded"),
        ]
    }
    public static func foundation(_ record: JSONRecord) -> [String: Any] {
        var out: [String: Any] = [:];
        for (key, value) in record {
            switch value {
            case .string(let v): out[key] = v;
            case .number(let v): out[key] = v;
            case .bool(let v): out[key] = v;
            case .object, .array: out[key] = foundationValue(value);
            case .null: break
            }
        }; if let columns = record["columnValues"] { let raw = foundationValue(columns); if JSONSerialization.isValidJSONObject(raw), let data = try? JSONSerialization.data(withJSONObject: raw), let text = String(data: data, encoding: .utf8) { out["columnValues"] = text } }; return out
    }
    private static func foundationValue(_ value: JSONValue) -> Any {
        switch value {
        case .string(let v): return v;
        case .number(let v): return v;
        case .bool(let v): return v;
        case .array(let v): return v.map(foundationValue);
        case .object(let v): return v.mapValues(foundationValue);
        case .null: return NSNull()
        }
    }
    public static func suffix(_ value: String) -> String { var hash: UInt64 = 1469598103934665603; for byte in value.utf8 { hash ^= UInt64(byte); hash &*= 1099511628211 }; return String(String(hash, radix: 16).suffix(10)) }
    public static func json(_ value: Any) -> JSONValue {
        if let v = value as? String { return .string(v) }; if let v = value as? Bool { return .bool(v) }; if let v = value as? Int { return .number(Double(v)) }; if let v = value as? Double { return .number(v) }; if let v = value as? [String: Any] { return .object(v.mapValues(json)) };
        if let v = value as? [Any] { return .array(v.map(json)) }; if value is NSNull { return .null }; return .string(String(describing: value))
    }
}

private extension JSONValue { var mondayObject: JSONRecord? { if case .object(let value) = self { return value }; return nil }; var mondayArray: [JSONValue]? { if case .array(let value) = self { return value }; return nil } }
private extension String { var mondayNonEmpty: String? { let value = trimmingCharacters(in: .whitespacesAndNewlines); return value.isEmpty ? nil : value } }
