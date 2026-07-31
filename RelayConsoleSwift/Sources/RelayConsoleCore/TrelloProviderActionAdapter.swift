import Foundation

public struct TrelloProviderActionClientResult: Codable, Equatable, Sendable {
    public var result: JSONRecord
    public init(result: JSONRecord) { self.result = result }
}

public protocol TrelloProviderActionClient: Sendable {
    func executeTrelloAction(request: MarketplaceProviderActionAdapterRequest) throws -> TrelloProviderActionClientResult
}

public struct TrelloProviderHTTPRequest: Sendable, Equatable {
    public var method: String
    public var url: URL
    public var headers: [String: String]
    public var body: Data?
    public init(method: String, url: URL, headers: [String: String], body: Data? = nil) {
        self.method = method; self.url = url; self.headers = headers; self.body = body
    }
}

public struct TrelloProviderHTTPResponse: Sendable, Equatable {
    public var statusCode: Int
    public var body: Data
    public init(statusCode: Int, body: Data = Data()) { self.statusCode = statusCode; self.body = body }
}

public protocol TrelloProviderHTTPClient: Sendable { func send(_ request: TrelloProviderHTTPRequest) throws -> TrelloProviderHTTPResponse }

public struct URLSessionTrelloProviderHTTPClient: TrelloProviderHTTPClient {
    private let timeout: TimeInterval
    public init(timeoutSeconds: TimeInterval = 20) { timeout = timeoutSeconds }
    public func send(_ request: TrelloProviderHTTPRequest) throws -> TrelloProviderHTTPResponse {
        var urlRequest = URLRequest(url: request.url); urlRequest.httpMethod = request.method
        urlRequest.timeoutInterval = timeout; urlRequest.httpBody = request.body
        request.headers.forEach { urlRequest.setValue($0.value, forHTTPHeaderField: $0.key) }
        let semaphore = DispatchSemaphore(value: 0)
        var data: Data?; var status: Int?; var failure: Error?
        let task = URLSession.shared.dataTask(with: urlRequest) { result, response, error in
            data = result; status = (response as? HTTPURLResponse)?.statusCode; failure = error; semaphore.signal()
        }
        task.resume()
        if semaphore.wait(timeout: .now() + timeout) == .timedOut {
            task.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "trello_http_timeout", message: "Trello API request timed out.")
        }
        if let failure { throw failure }
        return TrelloProviderHTTPResponse(statusCode: status ?? 0, body: data ?? Data())
    }
}

public struct FakeTrelloProviderActionClient: TrelloProviderActionClient {
    public init() {}
    public func executeTrelloAction(request: MarketplaceProviderActionAdapterRequest) throws -> TrelloProviderActionClientResult {
        switch request.definition.actionKey {
        case "trello_board_list":
            let count = TrelloProviderActionSupport.bound(request.payload["maxResults"], defaultValue: 3, maximum: 25)
            return result(request, ["semanticReadContract": .string("trello-board-list-v1"), "boards": .array((0..<count).map(board))])
        case "trello_board_cards_list":
            let boardId = try TrelloProviderActionSupport.required(request.payload, "boardId", "board id")
            let count = TrelloProviderActionSupport.bound(request.payload["maxResults"], defaultValue: 5, maximum: 50)
            return result(request, ["semanticReadContract": .string("trello-board-cards-list-v1"), "boardId": .string(boardId), "cards": .array((0..<count).map(card))])
        case "trello_card_get":
            let id = try TrelloProviderActionSupport.required(request.payload, "cardId", "card id")
            var value = TrelloProviderActionSupport.card(index: 0); value["id"] = .string(id)
            return result(request, ["semanticReadContract": .string("trello-card-get-v1"), "card": .object(value)])
        case "trello_search":
            let query = try TrelloProviderActionSupport.required(request.payload, "query", "search query")
            let count = TrelloProviderActionSupport.bound(request.payload["maxResults"], defaultValue: 3, maximum: 25)
            return result(request, ["semanticReadContract": .string("trello-search-v1"), "query": .string(query), "boards": .array((0..<min(2, count)).map(board)), "cards": .array((0..<count).map(card))])
        case "trello_card_prepare":
            let normalized = try TrelloProviderActionSupport.normalize(request.payload, operation: request.payload["operation"]?.string ?? "create")
            return result(request, ["draftPreview": .object(["card": .object(normalized), "payloadHash": .string(MarketplaceProviderActionApprovalService.payloadHash(normalized)), "providerMutation": .bool(false)])])
        case "trello_card_create": return try write(request, operation: "create")
        case "trello_card_update": return try write(request, operation: "update")
        case "trello_card_comment_create": return try write(request, operation: "comment")
        default: throw MarketplaceProviderActionAdapterFailure(code: "trello_fake_action_not_supported", message: "The fake Trello client does not support this action.")
        }
    }
    private func write(_ request: MarketplaceProviderActionAdapterRequest, operation: String) throws -> TrelloProviderActionClientResult {
        let normalized = try TrelloProviderActionSupport.normalize(request.payload, operation: operation)
        let hash = MarketplaceProviderActionApprovalService.payloadHash(normalized)
        let id = normalized["cardId"]?.string ?? "card-\(TrelloProviderActionSupport.suffix(hash))"
        var values: JSONRecord = ["cardId": .string(id), "id": .string(id), "name": normalized["name"] ?? .string("Trello card"), "url": .string("https://trello.com/c/\(id)"), "payloadHash": .string(hash), "auditId": .string(request.auditIdentity.dispatchId ?? request.idempotencyKey)]
        if operation == "comment" { values["actionId"] = .string("action-\(TrelloProviderActionSupport.suffix(hash))") }
        if operation == "create" { values["listId"] = normalized["listId"] }
        if operation == "update" { values["due"] = normalized["due"]; values["dueComplete"] = normalized["dueComplete"] ?? .bool(false) }
        return result(request, values)
    }
    private func result(_ request: MarketplaceProviderActionAdapterRequest, _ values: JSONRecord) -> TrelloProviderActionClientResult {
        TrelloProviderActionClientResult(result: base(request).merging(values) { _, new in new })
    }
    private func base(_ request: MarketplaceProviderActionAdapterRequest) -> JSONRecord {
        [
            "provider": .string("trello"), "adapterBoundary": .string("trello-provider-action-adapter"), "clientMode": .string("fake-trello-client"), "fakeAdapter": .bool(true), "permission": .string(request.permission.rawValue), "idempotencyKey": .string(request.idempotencyKey),
            "liveCredentialsUsed": .bool(false), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-state-excluded"),
        ]
    }
    private func board(_ index: Int) -> JSONValue { .object(TrelloProviderActionSupport.board(index: index)) }
    private func card(_ index: Int) -> JSONValue { .object(TrelloProviderActionSupport.card(index: index)) }
}

public final class LiveTrelloProviderActionClient: TrelloProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService; private let secrets: SecretService; private let http: any TrelloProviderHTTPClient
    public init(data: LocalDataService, secrets: SecretService, httpClient: any TrelloProviderHTTPClient = URLSessionTrelloProviderHTTPClient()) { self.data = data; self.secrets = secrets; http = httpClient }
    public func executeTrelloAction(request: MarketplaceProviderActionAdapterRequest) throws -> TrelloProviderActionClientResult {
        if request.definition.actionKey == "trello_card_prepare" { return try FakeTrelloProviderActionClient().executeTrelloAction(request: request) }
        let auth = try credentials(request)
        switch request.definition.actionKey {
        case "trello_board_list": return try readCollection(request, auth, path: "/members/me/boards", key: "boards", contract: "trello-board-list-v1", fields: "id,name,desc,url,closed,idOrganization,dateLastActivity", mapper: TrelloProviderActionSupport.boardSummary)
        case "trello_board_cards_list":
            let board = try TrelloProviderActionSupport.required(request.payload, "boardId", "board id")
            return try readCollection(
                request, auth, path: "/boards/\(TrelloProviderActionSupport.path(board))/cards", key: "cards", contract: "trello-board-cards-list-v1", fields: "id,name,desc,due,dueComplete,idList,idBoard,labels,idMembers,url,dateLastActivity", mapper: TrelloProviderActionSupport.cardSummary)
        case "trello_card_get":
            let id = try TrelloProviderActionSupport.required(request.payload, "cardId", "card id")
            let json = try send(
                "GET", "/cards/\(TrelloProviderActionSupport.path(id))",
                [URLQueryItem(name: "fields", value: "id,name,desc,due,dueComplete,idList,idBoard,labels,idMembers,url,dateLastActivity"), URLQueryItem(name: "board", value: "true"), URLQueryItem(name: "list", value: "true"), URLQueryItem(name: "members", value: "true")], nil, auth)
            return output(request, ["semanticReadContract": .string("trello-card-get-v1"), "card": .object(TrelloProviderActionSupport.cardSummary(json))])
        case "trello_search":
            let query = try TrelloProviderActionSupport.required(request.payload, "query", "search query")
            let limit = TrelloProviderActionSupport.bound(request.payload["maxResults"], defaultValue: 10, maximum: 25)
            let json = try send("GET", "/search", [URLQueryItem(name: "query", value: query), URLQueryItem(name: "modelTypes", value: "boards,cards"), URLQueryItem(name: "boards_limit", value: "\(limit)"), URLQueryItem(name: "cards_limit", value: "\(limit)")], nil, auth)
            let object = json.trelloObject ?? [:]
            return output(
                request,
                [
                    "semanticReadContract": .string("trello-search-v1"), "boards": .array((object["boards"]?.trelloArray ?? []).map { .object(TrelloProviderActionSupport.boardSummary($0)) }),
                    "cards": .array((object["cards"]?.trelloArray ?? []).map { .object(TrelloProviderActionSupport.cardSummary($0)) }),
                ])
        case "trello_card_create": return try write(request, auth, "create")
        case "trello_card_update": return try write(request, auth, "update")
        case "trello_card_comment_create": return try write(request, auth, "comment")
        default: throw MarketplaceProviderActionAdapterFailure(code: "trello_live_action_not_supported", message: "Live Trello execution does not support this action.")
        }
    }
    private func readCollection(_ request: MarketplaceProviderActionAdapterRequest, _ auth: (String,String), path: String, key: String, contract: String, fields: String, mapper: (JSONValue) -> JSONRecord) throws -> TrelloProviderActionClientResult {
        let limit = TrelloProviderActionSupport.bound(request.payload["maxResults"], defaultValue: 10, maximum: key == "cards" ? 50 : 25)
        let json = try send("GET", path, [URLQueryItem(name: "fields", value: fields), URLQueryItem(name: "limit", value: "\(limit)")], nil, auth)
        return output(request, ["semanticReadContract": .string(contract), key: .array((json.trelloArray ?? []).prefix(limit).map { .object(mapper($0)) })])
    }
    private func write(_ request: MarketplaceProviderActionAdapterRequest, _ auth: (String,String), _ operation: String) throws -> TrelloProviderActionClientResult {
        let normalized = try TrelloProviderActionSupport.normalize(request.payload, operation: operation)
        let path: String; let method: String
        if operation == "create" { path = "/cards"; method = "POST" }
        else if operation == "comment" { path = "/cards/\(TrelloProviderActionSupport.path(normalized["cardId"]?.string ?? ""))/actions/comments"; method = "POST" }
        else { path = "/cards/\(TrelloProviderActionSupport.path(normalized["cardId"]?.string ?? ""))"; method = "PUT" }
        let body = try JSONSerialization.data(withJSONObject: TrelloProviderActionSupport.foundation(normalized, commentOnly: operation == "comment"))
        let json = try send(method, path, [], body, auth); let object = json.trelloObject ?? [:]
        let hash = MarketplaceProviderActionApprovalService.payloadHash(normalized)
        var result: JSONRecord = ["payloadHash": .string(hash), "auditId": .string(request.auditIdentity.dispatchId ?? request.idempotencyKey)]
        if operation == "comment" { result["actionId"] = object["id"] ?? .null; result["cardId"] = normalized["cardId"] }
        else {
            result["id"] = object["id"] ?? .null; result["cardId"] = object["id"] ?? .null; result["name"] = object["name"] ?? .null; result["url"] = object["url"] ?? .null; result["listId"] = object["idList"] ?? normalized["listId"]; result["due"] = object["due"];
            result["dueComplete"] = object["dueComplete"] ?? .bool(false)
        }
        return output(request, result)
    }
    private func credentials(_ request: MarketplaceProviderActionAdapterRequest) throws -> (String,String) {
        guard let id = request.auditIdentity.connectionId?.trelloNonEmpty,
              let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id),
              connection.appSlug == "trello", connection.status == .connected || connection.status == .healthError else { throw MarketplaceProviderActionAdapterFailure(code: "trello_connection_not_ready", message: "Trello requires a ready Marketplace connection.") }
        func value(_ field: String) throws -> String {
            guard let ref = connection.credentialRequirements.first(where: { $0.fieldKey == field })?.secretReferenceId else { throw MarketplaceProviderActionAdapterFailure(code: "trello_credentials_missing", message: "Trello authorization reference is missing.") }
            return try secrets.getSecretValue(ref)
        }
        return (try value("trello_api_key"), try value("trello_user_token"))
    }
    private func send(_ method: String, _ path: String, _ query: [URLQueryItem], _ body: Data?, _ auth: (String,String)) throws -> JSONValue {
        var components = URLComponents(string: "https://api.trello.com/1\(path)"); components?.queryItems = query
        guard let url = components?.url else { throw MarketplaceProviderActionAdapterFailure(code: "trello_invalid_url", message: "Could not build Trello API URL.") }
        let header = "OAuth oauth_consumer_key=\"\(auth.0)\", oauth_token=\"\(auth.1)\""
        let response = try http.send(TrelloProviderHTTPRequest(method: method, url: url, headers: ["Authorization": header, "Accept": "application/json", "Content-Type": "application/json; charset=utf-8", "User-Agent": "RelayConsole"], body: body))
        guard (200..<300).contains(response.statusCode) else { throw MarketplaceProviderActionAdapterFailure(code: response.statusCode == 429 ? "trello_rate_limited" : "trello_http_error", message: "Trello API returned an HTTP error.", providerStatusCode: response.statusCode) }
        return response.body.isEmpty ? .object([:]) : TrelloProviderActionSupport.json(try JSONSerialization.jsonObject(with: response.body))
    }
    private func output(_ request: MarketplaceProviderActionAdapterRequest, _ result: JSONRecord) -> TrelloProviderActionClientResult {
        TrelloProviderActionClientResult(
            result: ["provider": .string("trello"), "adapterBoundary": .string("trello-provider-action-adapter"), "clientMode": .string("live-trello-rest-api"), "liveCredentialsUsed": .bool(true), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-state-excluded")].merging(
                result
            ) { _, new in new })
    }
}

public struct TrelloProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed = Set(["trello_board_list", "trello_board_cards_list", "trello_card_get", "trello_search", "trello_card_prepare", "trello_card_create", "trello_card_update", "trello_card_comment_create"])
    private let client: any TrelloProviderActionClient
    public init(client: any TrelloProviderActionClient = FakeTrelloProviderActionClient()) { self.client = client }
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "trello" else { throw MarketplaceProviderActionAdapterFailure(code: "trello_adapter_wrong_provider", message: "Trello adapter can execute only Trello actions.") }
        guard Self.allowed.contains(request.definition.actionKey) else { throw MarketplaceProviderActionAdapterFailure(code: "trello_action_not_allowlisted", message: "The Trello action is not in the V1 allowlist.") }
        return MarketplaceProviderActionAdapterResult(result: try client.executeTrelloAction(request: request).result)
    }
}

public enum TrelloProviderActionSupport {
    static func required(_ payload: JSONRecord, _ key: String, _ label: String) throws -> String {
        guard let value = payload[key]?.string?.trelloNonEmpty else { throw MarketplaceProviderActionAdapterFailure(code: "trello_missing_required_field", message: "Trello \(label) is required.") }; return value
    }
    static func bound(_ value: JSONValue?, defaultValue: Int, maximum: Int) -> Int { max(1, min(maximum, value?.number.map(Int.init) ?? value?.string.flatMap(Int.init) ?? defaultValue)) }
    static func normalize(_ payload: JSONRecord, operation: String) throws -> JSONRecord {
        var result: JSONRecord = [:]
        if operation == "create" { result["listId"] = .string(try required(payload, "listId", "list id")); result["name"] = .string(try required(payload, "name", "card name")) }
        else { result["cardId"] = .string(try required(payload, "cardId", "card id")); if operation == "comment" { result["comment"] = .string(try required(payload, "comment", "comment")) } }
        for key in ["listId", "name", "description", "due"] { if let value = payload[key]?.string?.trelloNonEmpty { result[key] = .string(value) } }
        if let value = payload["dueComplete"]?.bool { result["dueComplete"] = .bool(value) }
        guard result["name"]?.string?.count ?? 0 <= 512, result["description"]?.string?.count ?? 0 <= 16000, result["comment"]?.string?.count ?? 0 <= 8000 else { throw MarketplaceProviderActionAdapterFailure(code: "trello_payload_too_long", message: "Trello card payload exceeds Relay V1 bounds.") }
        return result
    }
    static func board(index: Int) -> JSONRecord {
        [
            "id": .string("board-\(index + 1)"), "name": .string("Trello Board \(index + 1)"), "descriptionExcerpt": .string("Bounded board description."), "url": .string("https://trello.com/b/board-\(index + 1)"), "closed": .bool(false), "workspace": .string("Relay Workspace"),
            "redactionStatus": .string("private-state-excluded"),
        ]
    }
    static func card(index: Int) -> JSONRecord {
        [
            "id": .string("card-\(index + 1)"), "name": .string("Trello Card \(index + 1)"), "descriptionExcerpt": .string("Human-meaningful card description."), "due": .string("2026-07-20T12:00:00Z"), "dueComplete": .bool(false), "list": .string("In Progress"), "board": .string("Relay Board"),
            "members": .array([.string("Relay Owner")]), "labels": .array([.string("Priority")]), "url": .string("https://trello.com/c/card-\(index + 1)"), "updatedAt": .string("2026-07-11T00:00:00Z"), "redactionStatus": .string("private-state-excluded"),
        ]
    }
    static func boardSummary(_ value: JSONValue) -> JSONRecord {
        let o = value.trelloObject ?? [:]; let desc = o["desc"]?.string ?? "";
        return [
            "id": o["id"] ?? .null, "name": o["name"] ?? .null, "descriptionExcerpt": .string(String(desc.prefix(500))), "url": o["url"] ?? .null, "closed": o["closed"] ?? .bool(false), "workspace": o["organization"]?.trelloObject?["displayName"] ?? o["idOrganization"] ?? .null,
            "updatedAt": o["dateLastActivity"] ?? .null, "redactionStatus": .string("private-state-excluded"),
        ]
    }
    static func cardSummary(_ value: JSONValue) -> JSONRecord {
        let o = value.trelloObject ?? [:]; let desc = o["desc"]?.string ?? "";
        return [
            "id": o["id"] ?? .null, "name": o["name"] ?? .null, "descriptionExcerpt": .string(String(desc.prefix(1000))), "due": o["due"] ?? .null, "dueComplete": o["dueComplete"] ?? .bool(false), "list": o["list"]?.trelloObject?["name"] ?? o["idList"] ?? .null,
            "board": o["board"]?.trelloObject?["name"] ?? o["idBoard"] ?? .null, "members": .array((o["members"]?.trelloArray ?? []).compactMap { $0.trelloObject?["fullName"] }), "labels": .array((o["labels"]?.trelloArray ?? []).compactMap { $0.trelloObject?["name"] }), "url": o["url"] ?? .null,
            "updatedAt": o["dateLastActivity"] ?? .null, "redactionStatus": .string("private-state-excluded"),
        ]
    }
    static func path(_ value: String) -> String { value.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed)?.replacingOccurrences(of: "?", with: "%3F") ?? value }
    static func suffix(_ value: String) -> String { var hash: UInt64 = 1469598103934665603; for byte in value.utf8 { hash ^= UInt64(byte); hash &*= 1099511628211 }; return String(String(hash, radix: 16).suffix(10)) }
    static func foundation(_ record: JSONRecord, commentOnly: Bool) -> [String: Any] {
        if commentOnly { return ["text": record["comment"]?.string ?? ""] }; var o: [String: Any] = [:];
        for (key, value) in record {
            switch value {
            case .string(let v): o[["listId": "idList", "description": "desc"][key] ?? key] = v;
            case .bool(let v): o[key] = v;
            default: break
            }
        }; o.removeValue(forKey: "cardId"); return o
    }
    static func json(_ value: Any) -> JSONValue {
        if let v = value as? String { return .string(v) }; if let v = value as? Bool { return .bool(v) }; if let v = value as? Int { return .number(Double(v)) }; if let v = value as? Double { return .number(v) }; if let v = value as? [String: Any] { return .object(v.mapValues(json)) };
        if let v = value as? [Any] { return .array(v.map(json)) }; if value is NSNull { return .null }; return .string(String(describing: value))
    }
}

private extension JSONValue { var trelloObject: JSONRecord? { if case .object(let v) = self { return v }; return nil }; var trelloArray: [JSONValue]? { if case .array(let v) = self { return v }; return nil } }
private extension String { var trelloNonEmpty: String? { let v = trimmingCharacters(in: .whitespacesAndNewlines); return v.isEmpty ? nil : v } }
