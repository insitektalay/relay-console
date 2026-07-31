import Foundation

public struct MiroProviderActionClientResult: Codable, Equatable, Sendable { public var result: JSONRecord; public var redactionStatus: String; public init(result: JSONRecord, redactionStatus: String = "private-state-excluded") { self.result = result; self.redactionStatus = redactionStatus } }
public protocol MiroProviderActionClient: Sendable { func executeMiroAction(request: MarketplaceProviderActionAdapterRequest) throws -> MiroProviderActionClientResult }
public struct MiroProviderHTTPRequest: Sendable, Equatable {
    public var method: String; public var url: URL; public var headers: [String: String]; public var body: Data?; public init(method: String, url: URL, headers: [String: String] = [:], body: Data? = nil) { self.method = method; self.url = url; self.headers = headers; self.body = body }
}
public struct MiroProviderHTTPResponse: Sendable, Equatable {
    public var statusCode: Int; public var headers: [String: String]; public var body: Data; public init(statusCode: Int, headers: [String: String] = [:], body: Data = Data()) { self.statusCode = statusCode; self.headers = headers; self.body = body }
}
public protocol MiroProviderHTTPClient: Sendable { func send(_ request: MiroProviderHTTPRequest) throws -> MiroProviderHTTPResponse }
public struct URLSessionMiroProviderHTTPClient: MiroProviderHTTPClient {
    private let timeout: TimeInterval; public init(timeoutSeconds: TimeInterval = 20) { timeout = timeoutSeconds };
    public func send(_ request: MiroProviderHTTPRequest) throws -> MiroProviderHTTPResponse {
        var value = URLRequest(url: request.url); value.httpMethod = request.method; value.timeoutInterval = timeout; value.httpBody = request.body; request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) }; let semaphore = DispatchSemaphore(value: 0); var data: Data?;
        var response: HTTPURLResponse?; var failure: Error?;
        let task = URLSession.shared.dataTask(with: value) {
            data = $0; response = $1 as? HTTPURLResponse; failure = $2; semaphore.signal()
        }; task.resume(); if semaphore.wait(timeout: .now() + timeout) == .timedOut { task.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "miro_http_timeout", message: "Miro API request timed out.") }; if let failure { throw failure };
        let headers = response?.allHeaderFields.reduce(into: [String: String]()) { $0[String(describing: $1.key)] = String(describing: $1.value) } ?? [:]; return MiroProviderHTTPResponse(statusCode: response?.statusCode ?? 0, headers: headers, body: data ?? Data())
    }
}

public struct FakeMiroProviderActionClient: MiroProviderActionClient {
    public init() {}
    public func executeMiroAction(request: MarketplaceProviderActionAdapterRequest) throws -> MiroProviderActionClientResult { switch request.definition.actionKey {
        case "miro_board_list": let n = MiroProviderActionSupport.bound(request.payload["maxResults"], 5, 25); return out(request, ["semanticReadContract": .string("miro-board-list-v1"), "boards": .array((0..<n).map { .object(MiroProviderActionSupport.fakeBoard($0)) }), "cursor": .null])
        case "miro_board_get": let id = try MiroProviderActionSupport.need(request.payload, "boardId"); var b = MiroProviderActionSupport.fakeBoard(0); b["id"] = .string(id); return out(request, ["semanticReadContract": .string("miro-board-get-v1"), "board": .object(b)])
        case "miro_board_items":
            let id = try MiroProviderActionSupport.need(request.payload, "boardId"), n = MiroProviderActionSupport.bound(request.payload["maxResults"], 10, 50);
            return out(request, ["semanticReadContract": .string("miro-board-items-v1"), "boardId": .string(id), "items": .array((0..<n).map { .object(MiroProviderActionSupport.fakeItem($0, boardId: id)) }), "cursor": .null])
        case "miro_item_get":
            let board = try MiroProviderActionSupport.need(request.payload, "boardId"), item = try MiroProviderActionSupport.need(request.payload, "itemId"); var value = MiroProviderActionSupport.fakeItem(0, boardId: board); value["id"] = .string(item);
            return out(request, ["semanticReadContract": .string("miro-item-get-v1"), "item": .object(value)])
        case "miro_item_prepare":
            let p = try MiroProviderActionSupport.normalized(request.payload, request.payload["operation"]?.string ?? "sticky_note"), h = MarketplaceProviderActionApprovalService.payloadHash(p);
            return out(request, ["draftPreview": .object(["payload": .object(p), "payloadHash": .string(h), "providerMutation": .bool(false)])])
        case "miro_sticky_note_create", "miro_card_create", "miro_item_update":
            let op = MiroProviderActionSupport.operation(request.definition.actionKey), p = try MiroProviderActionSupport.normalized(request.payload, op), h = MarketplaceProviderActionApprovalService.payloadHash(p);
            var item = MiroProviderActionSupport.fakeItem(0, boardId: p["boardId"]?.string ?? "board1", type: op == "card" ? "card" : p["itemType"]?.string ?? "sticky_note"); item["id"] = p["itemId"] ?? .string("miro-created"); item["content"] = p["content"];
            return out(request, ["item": .object(item), "operation": .string(op), "payloadHash": .string(h), "auditId": .string(request.auditIdentity.dispatchId ?? request.idempotencyKey)])
        default: throw MarketplaceProviderActionAdapterFailure(code: "miro_fake_action_not_supported", message: "The fake Miro client does not support this action.") }
    }
    private func out(_ r: MarketplaceProviderActionAdapterRequest, _ f: JSONRecord) -> MiroProviderActionClientResult {
        let base: JSONRecord = [
            "fakeAdapter": .bool(true), "adapterBoundary": .string("miro-provider-action-adapter"), "clientMode": .string("fake-miro-rest-v2-client"), "provider": .string("miro"), "permission": .string(r.permission.rawValue),
            "payloadHash": .string(MarketplaceProviderActionApprovalService.payloadHash(r.payload)), "approved": .bool(r.approvalReference?.status == .approved), "idempotencyKey": .string(r.idempotencyKey), "liveCredentialsUsed": .bool(false), "rawProviderToolExposure": .bool(false),
            "redactionStatus": .string("private-state-excluded"),
        ]
            ;
        return MiroProviderActionClientResult(result: base.merging(f) { _, n in n })
    }
}

public final class LiveMiroProviderActionClient: MiroProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService; private let secrets: SecretService; private let http: any MiroProviderHTTPClient
    public init(data: LocalDataService, secrets: SecretService, httpClient: any MiroProviderHTTPClient = URLSessionMiroProviderHTTPClient()) { self.data = data; self.secrets = secrets; self.http = httpClient }
    public func executeMiroAction(request: MarketplaceProviderActionAdapterRequest) throws -> MiroProviderActionClientResult {
        if request.definition.actionKey == "miro_item_prepare" { return try FakeMiroProviderActionClient().executeMiroAction(request: request) }; let token = try accessToken(request);
        switch request.definition.actionKey {
        case "miro_board_list": return try boardList(request, token);
        case "miro_board_get": return try boardGet(request, token);
        case "miro_board_items": return try items(request, token);
        case "miro_item_get": return try itemGet(request, token);
        case "miro_sticky_note_create": return try write(request, token, "sticky_note");
        case "miro_card_create": return try write(request, token, "card");
        case "miro_item_update": return try write(request, token, "update");
        default: throw MarketplaceProviderActionAdapterFailure(code: "miro_live_action_not_supported", message: "Live Miro execution does not support this action.")
        }
    }
    private func boardList(_ r: MarketplaceProviderActionAdapterRequest, _ token: String) throws -> MiroProviderActionClientResult {
        let n = MiroProviderActionSupport.bound(r.payload["maxResults"], 10, 25); var q = [URLQueryItem(name: "limit", value: String(n))]; if let cursor = r.payload["cursor"]?.string?.miroNonEmpty { q.append(URLQueryItem(name: "cursor", value: cursor)) };
        let o = try send("GET", "/v2/boards", q, nil, token).miroObject ?? [:]; return out(r, ["semanticReadContract": .string("miro-board-list-v1"), "boards": .array((o["data"]?.miroArray ?? []).prefix(n).map { .object(MiroProviderActionSupport.board($0)) }), "cursor": o["cursor"] ?? .null])
    }
    private func boardGet(_ r: MarketplaceProviderActionAdapterRequest, _ token: String) throws -> MiroProviderActionClientResult {
        let id = try MiroProviderActionSupport.need(r.payload, "boardId"), v = try send("GET", "/v2/boards/" + MiroProviderActionSupport.segment(id), [], nil, token); return out(r, ["semanticReadContract": .string("miro-board-get-v1"), "board": .object(MiroProviderActionSupport.board(v))])
    }
    private func items(_ r: MarketplaceProviderActionAdapterRequest, _ token: String) throws -> MiroProviderActionClientResult {
        let id = try MiroProviderActionSupport.need(r.payload, "boardId"), n = MiroProviderActionSupport.bound(r.payload["maxResults"], 10, 50); var q = [URLQueryItem(name: "limit", value: String(n))];
        if let cursor = r.payload["cursor"]?.string?.miroNonEmpty { q.append(URLQueryItem(name: "cursor", value: cursor)) }; if let type = r.payload["itemType"]?.string?.miroNonEmpty { q.append(URLQueryItem(name: "type", value: type)) };
        let o = try send("GET", "/v2/boards/" + MiroProviderActionSupport.segment(id) + "/items", q, nil, token).miroObject ?? [:];
        return out(r, ["semanticReadContract": .string("miro-board-items-v1"), "boardId": .string(id), "items": .array((o["data"]?.miroArray ?? []).prefix(n).map { .object(MiroProviderActionSupport.item($0, boardId: id)) }), "cursor": o["cursor"] ?? .null])
    }
    private func itemGet(_ r: MarketplaceProviderActionAdapterRequest, _ token: String) throws -> MiroProviderActionClientResult {
        let board = try MiroProviderActionSupport.need(r.payload, "boardId"), item = try MiroProviderActionSupport.need(r.payload, "itemId"), v = try send("GET", "/v2/boards/" + MiroProviderActionSupport.segment(board) + "/items/" + MiroProviderActionSupport.segment(item), [], nil, token);
        return out(r, ["semanticReadContract": .string("miro-item-get-v1"), "item": .object(MiroProviderActionSupport.item(v, boardId: board))])
    }
    private func write(_ r: MarketplaceProviderActionAdapterRequest, _ token: String, _ op: String) throws -> MiroProviderActionClientResult {
        let p = try MiroProviderActionSupport.normalized(r.payload, op), board = p["boardId"]?.string ?? "", routeType = op == "update" ? MiroProviderActionSupport.routeType(p["itemType"]?.string ?? "") : op == "card" ? "cards" : "sticky_notes",
            path = "/v2/boards/" + MiroProviderActionSupport.segment(board) + "/" + routeType + (op == "update" ? "/" + MiroProviderActionSupport.segment(p["itemId"]?.string ?? "") : ""), body = MiroProviderActionSupport.body(p, operation: op),
            v = try send(op == "update" ? "PATCH" : "POST", path, [], try JSONSerialization.data(withJSONObject: body), token), h = MarketplaceProviderActionApprovalService.payloadHash(p)
        ; return out(r, ["item": .object(MiroProviderActionSupport.item(v, boardId: board)), "operation": .string(op), "payloadHash": .string(h), "auditId": .string(r.auditIdentity.dispatchId ?? r.idempotencyKey)])
    }
    private func send(_ method: String, _ path: String, _ query: [URLQueryItem], _ body: Data?, _ token: String) throws -> JSONValue {
        var c = URLComponents(string: "https://api.miro.com" + path); c?.queryItems = query.isEmpty ? nil : query; guard let url = c?.url else { throw MarketplaceProviderActionAdapterFailure(code: "miro_invalid_url", message: "Could not build Miro API URL.") };
        let response = try http.send(MiroProviderHTTPRequest(method: method, url: url, headers: ["Authorization": "Bearer " + token, "Accept": "application/json", "Content-Type": "application/json"], body: body));
        guard (200..<300).contains(response.statusCode) else {
            let code = response.statusCode == 429 ? "miro_rate_limited" : response.statusCode == 401 ? "miro_access_token_expired" : response.statusCode == 403 ? "miro_scope_or_permission_denied" : response.statusCode == 404 ? "miro_board_or_item_not_found" : "miro_http_error";
            throw MarketplaceProviderActionAdapterFailure(
                code: code, message: response.statusCode == 401 ? "Miro access token expired; serialize rotating refresh or reconnect." : "Miro API returned an HTTP error.", providerStatusCode: response.statusCode,
                detail: ["rateLimitRemaining": response.headers.first { $0.key.lowercased() == "x-ratelimit-remaining" }.flatMap { Double($0.value) }.map(JSONValue.number) ?? .null])
        }; return response.body.isEmpty ? .object([:]) : MiroProviderActionSupport.json(try JSONSerialization.jsonObject(with: response.body))
    }
    private func accessToken(_ r: MarketplaceProviderActionAdapterRequest) throws -> String {
        guard let id = r.auditIdentity.connectionId?.miroNonEmpty, let c = try data.getProviderConnection(workspaceId: r.context.workspaceId, connectionId: id), c.appSlug == "miro", c.appId == r.app.id, c.status == .connected || c.status == .healthError else {
            throw MarketplaceProviderActionAdapterFailure(code: "miro_connection_not_ready", message: "Miro execution requires a ready Relay connection.")
        }; guard let ref = c.credentialRequirements.first(where: { $0.fieldKey == "miro_oauth_access_token" })?.secretReferenceId?.miroNonEmpty else { throw MarketplaceProviderActionAdapterFailure(code: "miro_credentials_missing", message: "Miro access-token reference is missing.") };
        do { return try secrets.getSecretValue(ref) } catch { throw MarketplaceProviderActionAdapterFailure(code: "miro_credentials_unavailable", message: "Relay could not read the Miro access token. Refresh or reconnect.") }
    }
    private func out(_ r: MarketplaceProviderActionAdapterRequest, _ f: JSONRecord) -> MiroProviderActionClientResult {
        let base: JSONRecord = [
            "adapterBoundary": .string("miro-provider-action-adapter"), "clientMode": .string("live-miro-rest-v2"), "provider": .string("miro"), "permission": .string(r.permission.rawValue), "payloadHash": .string(MarketplaceProviderActionApprovalService.payloadHash(r.payload)),
            "approved": .bool(r.approvalReference?.status == .approved), "idempotencyKey": .string(r.idempotencyKey), "liveCredentialsUsed": .bool(true), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-state-excluded"),
        ]
            ;
        return MiroProviderActionClientResult(result: base.merging(f) { _, n in n })
    }
}

public struct MiroProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = ["miro_board_list", "miro_board_get", "miro_board_items", "miro_item_get", "miro_item_prepare", "miro_sticky_note_create", "miro_card_create", "miro_item_update"]; private let client: any MiroProviderActionClient;
    public init(client: any MiroProviderActionClient = FakeMiroProviderActionClient()) { self.client = client };
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "miro" else { throw MarketplaceProviderActionAdapterFailure(code: "miro_adapter_wrong_provider", message: "Miro adapter can execute only Miro actions.") };
        guard Self.allowed.contains(request.definition.actionKey) else { throw MarketplaceProviderActionAdapterFailure(code: "miro_action_not_allowlisted", message: "The requested Miro action is not in the V1 allowlist.") }; let r = try client.executeMiroAction(request: request);
        return MarketplaceProviderActionAdapterResult(result: r.result, error: nil, redactionStatus: r.redactionStatus)
    }
}

public enum MiroProviderActionSupport {
    public static func need(_ p: JSONRecord, _ k: String) throws -> String { guard let v = p[k]?.string?.miroNonEmpty else { throw MarketplaceProviderActionAdapterFailure(code: "miro_missing_required_field", message: "Miro " + k + " is required.") }; return v }
    public static func bound(_ v: JSONValue?, _ d: Int, _ m: Int) -> Int { max(1, min(m, v?.number.map(Int.init) ?? v?.string.flatMap(Int.init) ?? d)) }
    public static func operation(_ k: String) -> String { k == "miro_card_create" ? "card" : k == "miro_sticky_note_create" ? "sticky_note" : "update" }
    public static func normalized(_ p: JSONRecord, _ op: String) throws -> JSONRecord {
        var o: JSONRecord = ["boardId": .string(try need(p, "boardId"))], type = op;
        if op == "update" {
            type = try need(p, "itemType").lowercased(); guard ["sticky_note", "card", "text", "shape"].contains(type) else { throw MarketplaceProviderActionAdapterFailure(code: "miro_item_type_not_writable", message: "Miro V1 updates only sticky_note, card, text, or shape.") };
            o["itemId"] = .string(try need(p, "itemId")); o["itemType"] = .string(type)
        }; let content = try need(p, "content"); guard content.count <= 5000 else { throw MarketplaceProviderActionAdapterFailure(code: "miro_content_too_large", message: "Miro content exceeds Relay V1 bounds.") }; o["content"] = .string(content);
        if let title = p["title"]?.string?.miroNonEmpty { o["title"] = .string(String(title.prefix(255))) }; for k in ["x", "y", "width", "height"] { if let n = p[k]?.number { o[k] = .number(n) } }; if let parent = p["parentId"]?.string?.miroNonEmpty { o["parentId"] = .string(parent) }; return o
    }
    public static func routeType(_ t: String) -> String { t == "sticky_note" ? "sticky_notes" : t == "card" ? "cards" : t == "text" ? "texts" : "shapes" }
    public static func body(_ p: JSONRecord, operation: String) -> [String: Any] {
        var data: [String: Any] = ["content": p["content"]?.string ?? ""]; if operation == "card", let title = p["title"]?.string { data["title"] = title }; var body: [String: Any] = ["data": data]; var position: [String: Any] = [:]; if let x = p["x"]?.number { position["x"] = x };
        if let y = p["y"]?.number { position["y"] = y }; if !position.isEmpty { body["position"] = position }; var geometry: [String: Any] = [:]; if let w = p["width"]?.number { geometry["width"] = w }; if let h = p["height"]?.number { geometry["height"] = h };
        if !geometry.isEmpty { body["geometry"] = geometry }; if let parent = p["parentId"]?.string { body["parent"] = ["id": parent] }; return body
    }
    public static func board(_ v: JSONValue) -> JSONRecord {
        let o = v.miroObject ?? [:], owner = o["owner"]?.miroObject ?? [:], team = o["team"]?.miroObject ?? [:];
        return [
            "id": o["id"] ?? .null, "name": o["name"] ?? .null, "description": o["description"] ?? .null, "viewLink": o["viewLink"] ?? .null, "owner": .object(["id": owner["id"] ?? .null, "name": owner["name"] ?? .null]), "team": .object(["id": team["id"] ?? .null, "name": team["name"] ?? .null]),
            "createdAt": o["createdAt"] ?? .null, "modifiedAt": o["modifiedAt"] ?? .null, "redactionStatus": .string("private-state-excluded"),
        ]
    }
    public static func item(_ v: JSONValue, boardId: String) -> JSONRecord {
        let o = v.miroObject ?? [:], data = o["data"]?.miroObject ?? [:], pos = o["position"]?.miroObject ?? [:], geo = o["geometry"]?.miroObject ?? [:], parent = o["parent"]?.miroObject ?? [:], created = o["createdBy"]?.miroObject ?? [:], modified = o["modifiedBy"]?.miroObject ?? [:];
        return [
            "id": o["id"] ?? .null, "boardId": .string(boardId), "itemType": o["type"] ?? .null, "content": data["content"] ?? data["description"] ?? .null, "title": data["title"] ?? .null, "style": safe(o["style"] ?? .object([:])),
            "position": .object(["x": pos["x"] ?? .null, "y": pos["y"] ?? .null, "origin": pos["origin"] ?? .null]), "geometry": .object(["width": geo["width"] ?? .null, "height": geo["height"] ?? .null, "rotation": geo["rotation"] ?? .null]), "parent": .object(["id": parent["id"] ?? .null]),
            "createdBy": .object(["id": created["id"] ?? .null, "name": created["name"] ?? .null]), "modifiedBy": .object(["id": modified["id"] ?? .null, "name": modified["name"] ?? .null]), "createdAt": o["createdAt"] ?? .null, "modifiedAt": o["modifiedAt"] ?? .null,
            "redactionStatus": .string("private-state-excluded"),
        ]
    }
    public static func safe(_ v: JSONValue) -> JSONValue {
        switch v {
        case .object(let o): return .object(Dictionary(uniqueKeysWithValues: o.prefix(30).map { ($0.key, safe($0.value)) }));
        case .array(let a): return .array(a.prefix(20).map(safe));
        case .string(let s): return .string(String(s.prefix(1000)));
        default: return v
        }
    }
    public static func fakeBoard(_ i: Int) -> JSONRecord {
        [
            "id": .string("board" + String(i + 1)), "name": .string("Miro Planning Board " + String(i + 1)), "description": .string("Relay launch planning"), "viewLink": .string("https://miro.com/app/board/board" + String(i + 1)),
            "owner": .object(["id": .string("u1"), "name": .string("Relay Owner")]), "team": .object(["id": .string("team1"), "name": .string("Relay Team")]), "createdAt": .string("2026-07-11T00:00:00Z"), "modifiedAt": .string("2026-07-11T00:00:01Z"),
            "redactionStatus": .string("private-state-excluded"),
        ]
    }
    public static func fakeItem(_ i: Int, boardId: String, type: String? = nil) -> JSONRecord {
        let t = type ?? (i % 2 == 0 ? "sticky_note" : "card");
        return [
            "id": .string("item" + String(i + 1)), "boardId": .string(boardId), "itemType": .string(t), "content": .string("Miro planning content " + String(i + 1)), "title": t == "card" ? .string("Launch task") : .null, "style": .object(["fillColor": .string("yellow")]),
            "position": .object(["x": .number(Double(i * 100)), "y": .number(0), "origin": .string("center")]), "geometry": .object(["width": .number(200), "height": .number(120), "rotation": .number(0)]), "parent": .object(["id": .string("frame1")]),
            "createdBy": .object(["id": .string("u1"), "name": .string("Relay Owner")]), "modifiedBy": .object(["id": .string("u2"), "name": .string("Relay Reviewer")]), "createdAt": .string("2026-07-11T00:00:00Z"), "modifiedAt": .string("2026-07-11T00:00:01Z"),
            "redactionStatus": .string("private-state-excluded"),
        ]
    }
    public static func segment(_ s: String) -> String { s.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed)?.replacingOccurrences(of: "/", with: "%2F") ?? s }
    public static func json(_ v: Any) -> JSONValue {
        if let x = v as? String { return .string(x) }; if let x = v as? Bool { return .bool(x) }; if let x = v as? Int { return .number(Double(x)) }; if let x = v as? Double { return .number(x) }; if let x = v as? [String: Any] { return .object(x.mapValues(json)) };
        if let x = v as? [Any] { return .array(x.map(json)) }; if v is NSNull { return .null }; return .string(String(describing: v))
    }
}
private extension JSONValue { var miroObject: JSONRecord? { if case .object(let v) = self { return v }; return nil }; var miroArray: [JSONValue]? { if case .array(let v) = self { return v }; return nil } }
private extension String { var miroNonEmpty: String? { let v = trimmingCharacters(in: .whitespacesAndNewlines); return v.isEmpty ? nil : v } }
