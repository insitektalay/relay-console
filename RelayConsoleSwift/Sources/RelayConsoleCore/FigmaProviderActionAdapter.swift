import Foundation

public struct FigmaProviderActionClientResult: Codable, Equatable, Sendable { public var result: JSONRecord; public var redactionStatus: String; public init(result: JSONRecord, redactionStatus: String = "private-state-excluded") { self.result = result; self.redactionStatus = redactionStatus } }
public protocol FigmaProviderActionClient: Sendable { func executeFigmaAction(request: MarketplaceProviderActionAdapterRequest) throws -> FigmaProviderActionClientResult }
public struct FigmaProviderHTTPRequest: Sendable, Equatable {
    public var method: String; public var url: URL; public var headers: [String: String]; public var body: Data?; public init(method: String, url: URL, headers: [String: String] = [:], body: Data? = nil) { self.method = method; self.url = url; self.headers = headers; self.body = body }
}
public struct FigmaProviderHTTPResponse: Sendable, Equatable {
    public var statusCode: Int; public var headers: [String: String]; public var body: Data; public init(statusCode: Int, headers: [String: String] = [:], body: Data = Data()) { self.statusCode = statusCode; self.headers = headers; self.body = body }
}
public protocol FigmaProviderHTTPClient: Sendable { func send(_ request: FigmaProviderHTTPRequest) throws -> FigmaProviderHTTPResponse }
public struct URLSessionFigmaProviderHTTPClient: FigmaProviderHTTPClient {
    private let timeout: TimeInterval; public init(timeoutSeconds: TimeInterval = 20) { timeout = timeoutSeconds };
    public func send(_ request: FigmaProviderHTTPRequest) throws -> FigmaProviderHTTPResponse {
        var value = URLRequest(url: request.url); value.httpMethod = request.method; value.timeoutInterval = timeout; value.httpBody = request.body; request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) }; let semaphore = DispatchSemaphore(value: 0); var data: Data?;
        var response: HTTPURLResponse?; var failure: Error?;
        let task = URLSession.shared.dataTask(with: value) {
            data = $0; response = $1 as? HTTPURLResponse; failure = $2; semaphore.signal()
        }; task.resume(); if semaphore.wait(timeout: .now() + timeout) == .timedOut { task.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "figma_http_timeout", message: "Figma API request timed out.") }; if let failure { throw failure };
        let headers = response?.allHeaderFields.reduce(into: [String: String]()) { $0[String(describing: $1.key)] = String(describing: $1.value) } ?? [:]; return FigmaProviderHTTPResponse(statusCode: response?.statusCode ?? 0, headers: headers, body: data ?? Data())
    }
}

public struct FakeFigmaProviderActionClient: FigmaProviderActionClient {
    public init() {}
    public func executeFigmaAction(request: MarketplaceProviderActionAdapterRequest) throws -> FigmaProviderActionClientResult { switch request.definition.actionKey {
        case "figma_current_user": return out(request, ["semanticReadContract": .string("figma-current-user-v1"), "user": .object(["id": .string("figma-user-1"), "handle": .string("Relay Designer"), "email": .string("relay@example.com")])])
        case "figma_file_metadata": let key = try FigmaProviderActionSupport.need(request.payload, "fileKey"); return out(request, ["semanticReadContract": .string("figma-file-metadata-v1"), "file": .object(FigmaProviderActionSupport.fakeFile(key))])
        case "figma_file_nodes":
            let key = try FigmaProviderActionSupport.need(request.payload, "fileKey");
            return out(request, ["semanticReadContract": .string("figma-file-nodes-v1"), "fileKey": .string(key), "fileName": .string("Relay Design System"), "version": .string("42"), "nodes": .array([.object(FigmaProviderActionSupport.fakeNode())])])
        case "figma_file_comments":
            let key = try FigmaProviderActionSupport.need(request.payload, "fileKey"), n = FigmaProviderActionSupport.bound(request.payload["maxResults"], 5, 25);
            return out(request, ["semanticReadContract": .string("figma-file-comments-v1"), "fileKey": .string(key), "comments": .array((0..<n).map { .object(FigmaProviderActionSupport.fakeComment($0)) })])
        case "figma_comment_prepare":
            let p = try FigmaProviderActionSupport.normalized(request.payload, "prepare"), h = MarketplaceProviderActionApprovalService.payloadHash(p); return out(request, ["draftPreview": .object(["payload": .object(p), "payloadHash": .string(h), "providerMutation": .bool(false)])])
        case "figma_comment_create", "figma_comment_reply":
            let op = request.definition.actionKey == "figma_comment_reply" ? "reply" : "create", p = try FigmaProviderActionSupport.normalized(request.payload, op), h = MarketplaceProviderActionApprovalService.payloadHash(p); var c = FigmaProviderActionSupport.fakeComment(0);
            c["message"] = p["message"]; c["parentId"] = p["parentCommentId"] ?? .null; return out(request, ["comment": .object(c), "payloadHash": .string(h), "auditId": .string(request.auditIdentity.dispatchId ?? request.idempotencyKey)])
        default: throw MarketplaceProviderActionAdapterFailure(code: "figma_fake_action_not_supported", message: "The fake Figma client does not support this action.") }
    }
    private func out(_ r: MarketplaceProviderActionAdapterRequest, _ f: JSONRecord) -> FigmaProviderActionClientResult {
        let base: JSONRecord = [
            "fakeAdapter": .bool(true), "adapterBoundary": .string("figma-provider-action-adapter"), "clientMode": .string("fake-figma-rest-client"), "provider": .string("figma"), "permission": .string(r.permission.rawValue),
            "payloadHash": .string(MarketplaceProviderActionApprovalService.payloadHash(r.payload)), "approved": .bool(r.approvalReference?.status == .approved), "idempotencyKey": .string(r.idempotencyKey), "liveCredentialsUsed": .bool(false), "rawProviderToolExposure": .bool(false),
            "redactionStatus": .string("private-state-excluded"),
        ]
            ;
        return FigmaProviderActionClientResult(result: base.merging(f) { _, n in n })
    }
}

public final class LiveFigmaProviderActionClient: FigmaProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService; private let secrets: SecretService; private let http: any FigmaProviderHTTPClient
    public init(data: LocalDataService, secrets: SecretService, httpClient: any FigmaProviderHTTPClient = URLSessionFigmaProviderHTTPClient()) { self.data = data; self.secrets = secrets; self.http = httpClient }
    public func executeFigmaAction(request: MarketplaceProviderActionAdapterRequest) throws -> FigmaProviderActionClientResult {
        if request.definition.actionKey == "figma_comment_prepare" { return try FakeFigmaProviderActionClient().executeFigmaAction(request: request) }; let token = try accessToken(request);
        switch request.definition.actionKey {
        case "figma_current_user": return try me(request, token);
        case "figma_file_metadata": return try metadata(request, token);
        case "figma_file_nodes": return try nodes(request, token);
        case "figma_file_comments": return try comments(request, token);
        case "figma_comment_create": return try commentWrite(request, token, false);
        case "figma_comment_reply": return try commentWrite(request, token, true);
        default: throw MarketplaceProviderActionAdapterFailure(code: "figma_live_action_not_supported", message: "Live Figma execution does not support this action.")
        }
    }
    private func me(_ r: MarketplaceProviderActionAdapterRequest, _ token: String) throws -> FigmaProviderActionClientResult {
        let o = try send("GET", "/v1/me", [], nil, token).figmaObject ?? [:]; return out(r, ["semanticReadContract": .string("figma-current-user-v1"), "user": .object(["id": o["id"] ?? .null, "handle": o["handle"] ?? .null, "email": o["email"] ?? .null])])
    }
    private func metadata(_ r: MarketplaceProviderActionAdapterRequest, _ token: String) throws -> FigmaProviderActionClientResult {
        let key = try FigmaProviderActionSupport.need(r.payload, "fileKey"), v = try send("GET", "/v1/files/" + FigmaProviderActionSupport.segment(key) + "/meta", [], nil, token), o = v.figmaObject?["file"] ?? v;
        return out(r, ["semanticReadContract": .string("figma-file-metadata-v1"), "file": .object(FigmaProviderActionSupport.file(o, key))])
    }
    private func nodes(_ r: MarketplaceProviderActionAdapterRequest, _ token: String) throws -> FigmaProviderActionClientResult {
        let key = try FigmaProviderActionSupport.need(r.payload, "fileKey"), depth = FigmaProviderActionSupport.bound(r.payload["depth"], 2, 4), maxNodes = FigmaProviderActionSupport.bound(r.payload["maxNodes"], 50, 200),
            maxText = FigmaProviderActionSupport.bound(r.payload["maxTextChars"], 1000, 4000)
        ; var q = [URLQueryItem(name: "depth", value: String(depth))]; if let ids = r.payload["nodeIds"]?.string?.figmaNonEmpty { q.append(URLQueryItem(name: "ids", value: ids)) };
        let o = try send("GET", "/v1/files/" + FigmaProviderActionSupport.segment(key), q, nil, token).figmaObject ?? [:], root = o["document"] ?? .object([:]); var remaining = maxNodes; let mapped = FigmaProviderActionSupport.node(root, remaining: &remaining, maxText: maxText);
        return out(
            r,
            [
                "semanticReadContract": .string("figma-file-nodes-v1"), "fileKey": .string(key), "fileName": o["name"] ?? .null, "version": o["version"] ?? .null, "lastModified": o["lastModified"] ?? .null, "editorType": o["editorType"] ?? .null, "nodes": .array([.object(mapped)]),
                "nodeLimit": .number(Double(maxNodes)), "truncated": .bool(remaining == 0),
            ])
    }
    private func comments(_ r: MarketplaceProviderActionAdapterRequest, _ token: String) throws -> FigmaProviderActionClientResult {
        let key = try FigmaProviderActionSupport.need(r.payload, "fileKey"), n = FigmaProviderActionSupport.bound(r.payload["maxResults"], 10, 25), text = FigmaProviderActionSupport.bound(r.payload["maxTextChars"], 1000, 4000),
            o = try send("GET", "/v1/files/" + FigmaProviderActionSupport.segment(key) + "/comments", [URLQueryItem(name: "as_md", value: "true")], nil, token).figmaObject ?? [:]
        ; return out(r, ["semanticReadContract": .string("figma-file-comments-v1"), "fileKey": .string(key), "comments": .array((o["comments"]?.figmaArray ?? []).prefix(n).map { .object(FigmaProviderActionSupport.comment($0, maxText: text)) })])
    }
    private func commentWrite(_ r: MarketplaceProviderActionAdapterRequest, _ token: String, _ reply: Bool) throws -> FigmaProviderActionClientResult {
        let p = try FigmaProviderActionSupport.normalized(r.payload, reply ? "reply" : "create"), key = p["fileKey"]?.string ?? ""; var body: [String: Any] = ["message": p["message"]?.string ?? ""]; if reply { body["comment_id"] = p["parentCommentId"]?.string ?? "" };
        let v = try send("POST", "/v1/files/" + FigmaProviderActionSupport.segment(key) + "/comments", [], try JSONSerialization.data(withJSONObject: body), token), h = MarketplaceProviderActionApprovalService.payloadHash(p);
        return out(r, ["comment": .object(FigmaProviderActionSupport.comment(v, maxText: 4000)), "payloadHash": .string(h), "auditId": .string(r.auditIdentity.dispatchId ?? r.idempotencyKey)])
    }
    private func send(_ method: String, _ path: String, _ query: [URLQueryItem], _ body: Data?, _ token: String) throws -> JSONValue {
        var c = URLComponents(string: "https://api.figma.com" + path); c?.queryItems = query.isEmpty ? nil : query; guard let url = c?.url else { throw MarketplaceProviderActionAdapterFailure(code: "figma_invalid_url", message: "Could not build Figma API URL.") };
        let response = try http.send(FigmaProviderHTTPRequest(method: method, url: url, headers: ["Authorization": "Bearer " + token, "Accept": "application/json", "Content-Type": "application/json"], body: body));
        guard (200..<300).contains(response.statusCode) else {
            let code = response.statusCode == 429 ? "figma_rate_limited" : response.statusCode == 401 ? "figma_access_token_expired" : response.statusCode == 403 ? "figma_scope_or_permission_denied" : response.statusCode == 404 ? "figma_file_or_node_not_found" : "figma_http_error",
                retry = response.headers.first { $0.key.lowercased() == "retry-after" }.flatMap { Double($0.value) } ?? 0
            ;
            throw MarketplaceProviderActionAdapterFailure(
                code: code, message: response.statusCode == 401 ? "Figma access token expired; refresh the current access token or reconnect." : "Figma API returned an HTTP error.", providerStatusCode: response.statusCode, detail: ["retryAfterSeconds": .number(retry)])
        }; return response.body.isEmpty ? .object([:]) : FigmaProviderActionSupport.json(try JSONSerialization.jsonObject(with: response.body))
    }
    private func accessToken(_ r: MarketplaceProviderActionAdapterRequest) throws -> String {
        guard let id = r.auditIdentity.connectionId?.figmaNonEmpty, let c = try data.getProviderConnection(workspaceId: r.context.workspaceId, connectionId: id), c.appSlug == "figma", c.appId == r.app.id, c.status == .connected || c.status == .healthError else {
            throw MarketplaceProviderActionAdapterFailure(code: "figma_connection_not_ready", message: "Figma execution requires a ready Relay connection.")
        }; guard let ref = c.credentialRequirements.first(where: { $0.fieldKey == "figma_oauth_access_token" })?.secretReferenceId?.figmaNonEmpty else { throw MarketplaceProviderActionAdapterFailure(code: "figma_credentials_missing", message: "Figma access-token reference is missing.") };
        do { return try secrets.getSecretValue(ref) } catch { throw MarketplaceProviderActionAdapterFailure(code: "figma_credentials_unavailable", message: "Relay could not read the Figma access token. Refresh or reconnect.") }
    }
    private func out(_ r: MarketplaceProviderActionAdapterRequest, _ f: JSONRecord) -> FigmaProviderActionClientResult {
        let base: JSONRecord = [
            "adapterBoundary": .string("figma-provider-action-adapter"), "clientMode": .string("live-figma-rest-v1"), "provider": .string("figma"), "permission": .string(r.permission.rawValue), "payloadHash": .string(MarketplaceProviderActionApprovalService.payloadHash(r.payload)),
            "approved": .bool(r.approvalReference?.status == .approved), "idempotencyKey": .string(r.idempotencyKey), "liveCredentialsUsed": .bool(true), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-state-excluded"),
        ]
            ;
        return FigmaProviderActionClientResult(result: base.merging(f) { _, n in n })
    }
}

public struct FigmaProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = ["figma_current_user", "figma_file_metadata", "figma_file_nodes", "figma_file_comments", "figma_comment_prepare", "figma_comment_create", "figma_comment_reply"]; private let client: any FigmaProviderActionClient;
    public init(client: any FigmaProviderActionClient = FakeFigmaProviderActionClient()) { self.client = client };
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "figma" else { throw MarketplaceProviderActionAdapterFailure(code: "figma_adapter_wrong_provider", message: "Figma adapter can execute only Figma actions.") };
        guard Self.allowed.contains(request.definition.actionKey) else { throw MarketplaceProviderActionAdapterFailure(code: "figma_action_not_allowlisted", message: "The requested Figma action is not in the V1 allowlist.") }; let r = try client.executeFigmaAction(request: request);
        return MarketplaceProviderActionAdapterResult(result: r.result, error: nil, redactionStatus: r.redactionStatus)
    }
}

public enum FigmaProviderActionSupport {
    public static func need(_ p: JSONRecord, _ k: String) throws -> String { guard let v = p[k]?.string?.figmaNonEmpty else { throw MarketplaceProviderActionAdapterFailure(code: "figma_missing_required_field", message: "Figma " + k + " is required.", detail: ["field": .string(k)]) }; return v }
    public static func bound(_ v: JSONValue?, _ d: Int, _ m: Int) -> Int { max(1, min(m, v?.number.map(Int.init) ?? v?.string.flatMap(Int.init) ?? d)) }
    public static func normalized(_ p: JSONRecord, _ op: String) throws -> JSONRecord {
        let key = try need(p, "fileKey"), message = try need(p, "message"); guard message.count <= 5000 else { throw MarketplaceProviderActionAdapterFailure(code: "figma_comment_too_large", message: "Figma comment exceeds Relay V1 bounds.") };
        var o: JSONRecord = ["fileKey": .string(key), "message": .string(message)]; if op == "reply" { o["parentCommentId"] = .string(try need(p, "parentCommentId")) } else if let parent = p["parentCommentId"]?.string?.figmaNonEmpty { o["parentCommentId"] = .string(parent) }; return o
    }
    public static func file(_ v: JSONValue, _ key: String) -> JSONRecord {
        let o = v.figmaObject ?? [:], creator = o["creator"]?.figmaObject ?? [:], toucher = o["last_touched_by"]?.figmaObject ?? [:];
        return [
            "fileKey": .string(key), "name": o["name"] ?? .null, "folderName": o["folder_name"] ?? .null, "lastTouchedAt": o["last_touched_at"] ?? .null, "creator": .object(["id": creator["id"] ?? .null, "handle": creator["handle"] ?? .null]),
            "lastTouchedBy": .object(["id": toucher["id"] ?? .null, "handle": toucher["handle"] ?? .null]), "editorType": o["editorType"] ?? .null, "version": o["version"] ?? .null, "role": o["role"] ?? .null, "linkAccess": o["link_access"] ?? .null, "url": o["url"] ?? .null,
            "redactionStatus": .string("private-state-excluded"),
        ]
    }
    public static func node(_ v: JSONValue, remaining: inout Int, maxText: Int) -> JSONRecord {
        guard remaining > 0 else { return ["truncated": .bool(true)] }; remaining -= 1; let o = v.figmaObject ?? [:], box = o["absoluteBoundingBox"]?.figmaObject ?? [:];
        var r: JSONRecord = [
            "id": o["id"] ?? .null, "name": o["name"] ?? .null, "type": o["type"] ?? .null, "visible": o["visible"] ?? .bool(true), "characters": o["characters"]?.string.map { .string(String($0.prefix(maxText))) } ?? .null, "componentId": o["componentId"] ?? .null,
            "boundingBox": .object(["x": box["x"] ?? .null, "y": box["y"] ?? .null, "width": box["width"] ?? .null, "height": box["height"] ?? .null]),
        ]
            ;
        var children: [JSONValue] = []; for child in o["children"]?.figmaArray ?? [] { guard remaining > 0 else { break }; children.append(.object(node(child, remaining: &remaining, maxText: maxText))) }; r["children"] = .array(children); return r
    }
    public static func comment(_ v: JSONValue, maxText: Int) -> JSONRecord {
        let o = v.figmaObject ?? [:], user = o["user"]?.figmaObject ?? [:], message = o["message"]?.string ?? "";
        return [
            "id": o["id"] ?? .null, "message": .string(String(message.prefix(maxText))), "user": .object(["id": user["id"] ?? .null, "handle": user["handle"] ?? .null]), "createdAt": o["created_at"] ?? .null, "resolvedAt": o["resolved_at"] ?? .null, "orderId": o["order_id"] ?? .null,
            "parentId": o["parent_id"] ?? .null, "clientMeta": safe(o["client_meta"] ?? .null), "truncated": .bool(message.count > maxText), "redactionStatus": .string("private-state-excluded"),
        ]
    }
    public static func safe(_ v: JSONValue) -> JSONValue {
        switch v {
        case .object(let o): return .object(o.filter { ["node_id", "node_offset", "x", "y"].contains($0.key) }.mapValues(safe));
        case .array(let a): return .array(a.prefix(10).map(safe));
        case .string(let s): return .string(String(s.prefix(500)));
        default: return v
        }
    }
    public static func fakeFile(_ key: String) -> JSONRecord {
        [
            "fileKey": .string(key), "name": .string("Relay Design System"), "folderName": .string("Product"), "lastTouchedAt": .string("2026-07-11T00:00:00Z"), "creator": .object(["id": .string("u1"), "handle": .string("Relay Designer")]),
            "lastTouchedBy": .object(["id": .string("u2"), "handle": .string("Relay Reviewer")]), "editorType": .string("figma"), "version": .string("42"), "role": .string("editor"), "linkAccess": .string("view"), "url": .string("https://www.figma.com/design/" + key),
            "redactionStatus": .string("private-state-excluded"),
        ]
    }
    public static func fakeNode() -> JSONRecord {
        [
            "id": .string("1:2"), "name": .string("Launch Frame"), "type": .string("FRAME"), "visible": .bool(true), "characters": .null, "componentId": .null, "boundingBox": .object(["x": .number(0), "y": .number(0), "width": .number(800), "height": .number(600)]),
            "children": .array([.object(["id": .string("1:3"), "name": .string("Headline"), "type": .string("TEXT"), "visible": .bool(true), "characters": .string("Ship the new Relay experience"), "children": .array([])])]),
        ]
    }
    public static func fakeComment(_ i: Int) -> JSONRecord {
        [
            "id": .string("comment-" + String(i + 1)), "message": .string("Review the launch frame " + String(i + 1)), "user": .object(["id": .string("u1"), "handle": .string("Relay Reviewer")]), "createdAt": .string("2026-07-11T00:00:00Z"), "resolvedAt": .null, "orderId": .string(String(i + 1)),
            "parentId": .null, "clientMeta": .object(["node_id": .string("1:2")]), "truncated": .bool(false), "redactionStatus": .string("private-state-excluded"),
        ]
    }
    public static func segment(_ s: String) -> String { s.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed)?.replacingOccurrences(of: "/", with: "%2F") ?? s }
    public static func json(_ v: Any) -> JSONValue {
        if let x = v as? String { return .string(x) }; if let x = v as? Bool { return .bool(x) }; if let x = v as? Int { return .number(Double(x)) }; if let x = v as? Double { return .number(x) }; if let x = v as? [String: Any] { return .object(x.mapValues(json)) };
        if let x = v as? [Any] { return .array(x.map(json)) }; if v is NSNull { return .null }; return .string(String(describing: v))
    }
}
private extension JSONValue { var figmaObject: JSONRecord? { if case .object(let v) = self { return v }; return nil }; var figmaArray: [JSONValue]? { if case .array(let v) = self { return v }; return nil } }
private extension String { var figmaNonEmpty: String? { let v = trimmingCharacters(in: .whitespacesAndNewlines); return v.isEmpty ? nil : v } }
