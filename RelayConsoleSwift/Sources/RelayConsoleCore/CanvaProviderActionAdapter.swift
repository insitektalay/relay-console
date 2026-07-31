import Foundation

public struct CanvaProviderActionClientResult: Codable, Equatable, Sendable { public var result: JSONRecord; public init(result: JSONRecord) { self.result = result } }
public protocol CanvaProviderActionClient: Sendable { func executeCanvaAction(request: MarketplaceProviderActionAdapterRequest) throws -> CanvaProviderActionClientResult }
public struct CanvaProviderHTTPRequest: Sendable, Equatable {
    public var method: String; public var url: URL; public var headers: [String: String]; public var body: Data?; public init(method: String, url: URL, headers: [String: String] = [:], body: Data? = nil) { self.method = method; self.url = url; self.headers = headers; self.body = body }
}
public struct CanvaProviderHTTPResponse: Sendable, Equatable {
    public var statusCode: Int; public var headers: [String: String]; public var body: Data; public init(statusCode: Int, headers: [String: String] = [:], body: Data = Data()) { self.statusCode = statusCode; self.headers = headers; self.body = body }
}
public protocol CanvaProviderHTTPClient: Sendable { func send(_ request: CanvaProviderHTTPRequest) throws -> CanvaProviderHTTPResponse }
public struct URLSessionCanvaProviderHTTPClient: CanvaProviderHTTPClient {
    public init() {};
    public func send(_ r: CanvaProviderHTTPRequest) throws -> CanvaProviderHTTPResponse {
        var q = URLRequest(url: r.url); q.httpMethod = r.method; q.timeoutInterval = 20; q.httpBody = r.body; r.headers.forEach { q.setValue($0.value, forHTTPHeaderField: $0.key) }; let s = DispatchSemaphore(value: 0); var d: Data?, h: HTTPURLResponse?, e: Error?;
        let t = URLSession.shared.dataTask(with: q) {
            d = $0; h = $1 as? HTTPURLResponse; e = $2; s.signal()
        }; t.resume(); if s.wait(timeout: .now() + 20) == .timedOut { t.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "canva_http_timeout", message: "Canva API request timed out.") }; if let e { throw e };
        return CanvaProviderHTTPResponse(statusCode: h?.statusCode ?? 0, headers: h?.allHeaderFields.reduce(into: [:]) { $0[String(describing: $1.key)] = String(describing: $1.value) } ?? [:], body: d ?? Data())
    }
}

public struct FakeCanvaProviderActionClient: CanvaProviderActionClient {
    public init() {};
    public func executeCanvaAction(request r: MarketplaceProviderActionAdapterRequest) throws -> CanvaProviderActionClientResult {
        switch r.definition.actionKey {
        case "canva_user_get": return out(r, ["user": .object(["userId": .string("user1"), "teamId": .string("team1")])]);
        case "canva_design_list": return out(r, ["semanticReadContract": .string("canva-design-list-v1"), "designs": .array([.object(CanvaProviderActionSupport.fakeDesign())]), "continuation": .string("next")]);
        case "canva_design_get": var d = CanvaProviderActionSupport.fakeDesign(); d["id"] = r.payload["designId"] ?? .string("design1"); return out(r, ["semanticReadContract": .string("canva-design-get-v1"), "design": .object(d)]);
        case "canva_folder_items":
            return out(
                r,
                [
                    "semanticReadContract": .string("canva-folder-items-v1"), "folderId": r.payload["folderId"] ?? .string("root"),
                    "items": .array([.object(["type": .string("folder"), "folder": .object(["id": .string("folder1"), "name": .string("Campaigns")])]), .object(["type": .string("design"), "design": .object(CanvaProviderActionSupport.fakeDesign())])]), "continuation": .null,
                ]);
        case "canva_design_prepare": let p = try CanvaProviderActionSupport.normalized(r.payload), h = MarketplaceProviderActionApprovalService.payloadHash(p); return out(r, ["draftPreview": .object(["payload": .object(p), "payloadHash": .string(h), "providerMutation": .bool(false)])]);
        case "canva_design_create":
            let p = try CanvaProviderActionSupport.normalized(r.payload), h = MarketplaceProviderActionApprovalService.payloadHash(p);
            return out(r, ["design": .object(CanvaProviderActionSupport.fakeDesign()), "payloadHash": .string(h), "auditId": .string(r.auditIdentity.dispatchId ?? r.idempotencyKey), "blankDesignWarning": .string("Canva may permanently delete an unedited blank design after seven days.")]);
        default: throw MarketplaceProviderActionAdapterFailure(code: "canva_action_not_supported", message: "Unsupported Canva action.")
        }
    };
    private func out(_ r: MarketplaceProviderActionAdapterRequest, _ x: JSONRecord) -> CanvaProviderActionClientResult {
        CanvaProviderActionClientResult(result: ["provider": .string("canva"), "adapterBoundary": .string("canva-provider-action-adapter"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-state-excluded")].merging(x) { _, n in n })
    }
}

public final class LiveCanvaProviderActionClient: CanvaProviderActionClient, @unchecked Sendable {
    let data: LocalDataService, secrets: SecretService, http: any CanvaProviderHTTPClient; public init(data: LocalDataService, secrets: SecretService, httpClient: any CanvaProviderHTTPClient = URLSessionCanvaProviderHTTPClient()) { self.data = data; self.secrets = secrets; http = httpClient };
    public func executeCanvaAction(request r: MarketplaceProviderActionAdapterRequest) throws -> CanvaProviderActionClientResult {
        if r.definition.actionKey == "canva_design_prepare" { return try FakeCanvaProviderActionClient().executeCanvaAction(request: r) }; let t = try token(r);
        switch r.definition.actionKey {
        case "canva_user_get": let o = try send("GET", "/rest/v1/users/me", [], nil, t).obj ?? [:], u = o["team_user"]?.obj ?? [:]; return out(["user": .object(["userId": u["user_id"] ?? .null, "teamId": u["team_id"] ?? .null])]);
        case "canva_design_list":
            var q = [URLQueryItem(name: "limit", value: String(CanvaProviderActionSupport.bound(r.payload["maxResults"], 10, 25)))]; for k in ["query", "ownership", "sort_by", "continuation"] { if let v = r.payload[k]?.string, !v.isEmpty { q.append(URLQueryItem(name: k, value: v)) } };
            let o = try send("GET", "/rest/v1/designs", q, nil, t).obj ?? [:]; return out(["semanticReadContract": .string("canva-design-list-v1"), "designs": .array((o["items"]?.arr ?? []).map { .object(CanvaProviderActionSupport.design($0)) }), "continuation": o["continuation"] ?? .null]);
        case "canva_design_get":
            let id = try CanvaProviderActionSupport.need(r.payload, "designId"), o = try send("GET", "/rest/v1/designs/" + CanvaProviderActionSupport.segment(id), [], nil, t).obj ?? [:];
            return out(["semanticReadContract": .string("canva-design-get-v1"), "design": .object(CanvaProviderActionSupport.design(o["design"] ?? .object([:])))]);
        case "canva_folder_items":
            let id = r.payload["folderId"]?.string ?? "root",
                o =
                    try send(
                        "GET", "/rest/v1/folders/" + CanvaProviderActionSupport.segment(id) + "/items", [URLQueryItem(name: "limit", value: String(CanvaProviderActionSupport.bound(r.payload["maxResults"], 10, 25))), URLQueryItem(name: "continuation", value: r.payload["continuation"]?.string)], nil,
                        t
                    ).obj ?? [:]
            ; return out(["semanticReadContract": .string("canva-folder-items-v1"), "folderId": .string(id), "items": .array((o["items"]?.arr ?? []).map { .object(CanvaProviderActionSupport.folderItem($0)) }), "continuation": o["continuation"] ?? .null]);
        case "canva_design_create":
            let p = try CanvaProviderActionSupport.normalized(r.payload), v = try send("POST", "/rest/v1/designs", [], try JSONSerialization.data(withJSONObject: CanvaProviderActionSupport.body(p)), t), h = MarketplaceProviderActionApprovalService.payloadHash(p);
            return out(["design": .object(CanvaProviderActionSupport.design((v.obj ?? [:])["design"] ?? v)), "payloadHash": .string(h), "blankDesignWarning": .string("Canva may permanently delete an unedited blank design after seven days.")]);
        default: throw MarketplaceProviderActionAdapterFailure(code: "canva_action_not_supported", message: "Unsupported Canva action.")
        }
    };
    private func token(_ r: MarketplaceProviderActionAdapterRequest) throws -> String {
        guard let id = r.auditIdentity.connectionId, let c = try data.getProviderConnection(workspaceId: r.context.workspaceId, connectionId: id), c.appSlug == "canva", let ref = c.credentialRequirements.first(where: { $0.fieldKey == "canva_oauth_access_token" })?.secretReferenceId else {
            throw MarketplaceProviderActionAdapterFailure(code: "canva_connection_not_ready", message: "Canva connection is not ready.")
        }; return try secrets.getSecretValue(ref)
    };
    private func send(_ m: String, _ p: String, _ q: [URLQueryItem], _ b: Data?, _ t: String) throws -> JSONValue {
        var c = URLComponents(string: "https://api.canva.com" + p); c?.queryItems = q.filter { $0.value != nil };
        let r = try http.send(CanvaProviderHTTPRequest(method: m, url: c!.url!, headers: ["Authorization": "Bearer " + t, "Accept": "application/json", "Content-Type": "application/json"], body: b));
        guard (200..<300).contains(r.statusCode) else { throw MarketplaceProviderActionAdapterFailure(code: r.statusCode == 429 ? "canva_rate_limited" : "canva_http_error", message: "Canva API request failed.", providerStatusCode: r.statusCode) };
        return CanvaProviderActionSupport.json(try JSONSerialization.jsonObject(with: r.body))
    };
    private func out(_ x: JSONRecord) -> CanvaProviderActionClientResult {
        CanvaProviderActionClientResult(result: ["provider": .string("canva"), "adapterBoundary": .string("canva-provider-action-adapter"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-state-excluded")].merging(x) { _, n in n })
    }
}

public struct CanvaProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = ["canva_user_get", "canva_design_list", "canva_design_get", "canva_folder_items", "canva_design_prepare", "canva_design_create"]; let client: any CanvaProviderActionClient;
    public init(client: any CanvaProviderActionClient = FakeCanvaProviderActionClient()) { self.client = client };
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "canva" else { throw MarketplaceProviderActionAdapterFailure(code: "canva_wrong_provider", message: "Canva adapter requires Canva.") };
        guard Self.allowed.contains(request.definition.actionKey) else { throw MarketplaceProviderActionAdapterFailure(code: "canva_action_not_allowlisted", message: "Canva action is outside the stable V1 allowlist.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executeCanvaAction(request: request).result, error: nil, redactionStatus: "private-state-excluded")
    }
}
public enum CanvaProviderActionSupport {
    public static func need(_ p: JSONRecord, _ k: String) throws -> String { guard let v = p[k]?.string, !v.isEmpty else { throw MarketplaceProviderActionAdapterFailure(code: "canva_missing_field", message: "Canva \(k) is required.") }; return v };
    public static func bound(_ v: JSONValue?, _ d: Int, _ m: Int) -> Int { max(1, min(m, v?.number.map(Int.init) ?? d)) };
    public static func normalized(_ p: JSONRecord) throws -> JSONRecord {
        let type = p["type"]?.string ?? "preset"; guard ["preset", "custom"].contains(type) else { throw MarketplaceProviderActionAdapterFailure(code: "canva_invalid_design_type", message: "Use preset or custom Canva design type.") }; var o: JSONRecord = ["type": .string(type)];
        if type == "preset" {
            let n = try need(p, "presetName"); guard ["doc", "email", "presentation", "whiteboard"].contains(n) else { throw MarketplaceProviderActionAdapterFailure(code: "canva_invalid_preset", message: "Unsupported Canva preset.") }; o["presetName"] = .string(n)
        } else {
            let w = Int(p["width"]?.number ?? 0), h = Int(p["height"]?.number ?? 0);
            guard (40...8000).contains(w), (40...8000).contains(h), w * h <= 25_000_000 else { throw MarketplaceProviderActionAdapterFailure(code: "canva_invalid_dimensions", message: "Canva custom dimensions are outside bounds.") }; o["width"] = .number(Double(w)); o["height"] = .number(Double(h))
        }; if let t = p["title"]?.string, !t.isEmpty { o["title"] = .string(String(t.prefix(255))) }; return o
    };
    public static func body(_ p: JSONRecord) -> [String: Any] {
        var d: [String: Any]; if p["type"]?.string == "custom" { d = ["type": "custom", "width": Int(p["width"]?.number ?? 0), "height": Int(p["height"]?.number ?? 0)] } else { d = ["type": "preset", "name": p["presetName"]?.string ?? "presentation"] }; var b: [String: Any] = ["design_type": d];
        if let t = p["title"]?.string { b["title"] = t }; return b
    };
    public static func design(_ v: JSONValue) -> JSONRecord {
        let o = v.obj ?? [:], owner = o["owner"]?.obj ?? [:], thumb = o["thumbnail"]?.obj ?? [:];
        return [
            "id": o["id"] ?? .null, "title": o["title"] ?? .null, "owner": .object(["userId": owner["user_id"] ?? .null, "teamId": owner["team_id"] ?? .null]), "createdAt": o["created_at"] ?? .null, "updatedAt": o["updated_at"] ?? .null, "pageCount": o["page_count"] ?? .null,
            "thumbnail": .object(["width": thumb["width"] ?? .null, "height": thumb["height"] ?? .null, "urlExpiresMinutes": .number(15)]), "navigation": .object(["available": .bool(o["urls"] != nil), "temporaryDays": .number(30), "userBound": .bool(true), "urlPersisted": .bool(false)]),
        ]
    };
    public static func folderItem(_ v: JSONValue) -> JSONRecord {
        let o = v.obj ?? [:], type = o["type"]?.string ?? "unknown"; if type == "design" { return ["type": .string(type), "design": .object(design(o["design"] ?? .object([:])))] }; let source = o[type]?.obj ?? [:], thumb = source["thumbnail"]?.obj ?? [:];
        return [
            "type": .string(type),
            type: .object([
                "id": source["id"] ?? .null, "name": source["name"] ?? source["title"] ?? .null, "createdAt": source["created_at"] ?? .null, "updatedAt": source["updated_at"] ?? .null,
                "thumbnail": .object(["width": thumb["width"] ?? .null, "height": thumb["height"] ?? .null, "urlExpiresMinutes": .number(15)]),
            ]),
        ]
    };
    public static func fakeDesign() -> JSONRecord {
        [
            "id": .string("design1"), "title": .string("Relay Launch Presentation"), "owner": .object(["userId": .string("user1"), "teamId": .string("team1")]), "createdAt": .number(1), "updatedAt": .number(2), "pageCount": .number(5),
            "thumbnail": .object(["width": .number(595), "height": .number(335), "urlExpiresMinutes": .number(15)]), "navigation": .object(["available": .bool(true), "temporaryDays": .number(30), "userBound": .bool(true), "urlPersisted": .bool(false)]),
        ]
    }; public static func segment(_ s: String) -> String { s.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? s };
    public static func json(_ v: Any) -> JSONValue {
        if let x = v as? String { return .string(x) }; if let x = v as? Bool { return .bool(x) }; if let x = v as? Int { return .number(Double(x)) }; if let x = v as? Double { return .number(x) }; if let x = v as? [String: Any] { return .object(x.mapValues(json)) };
        if let x = v as? [Any] { return .array(x.map(json)) }; return .null
    }
}
private extension JSONValue{var obj:JSONRecord?{if case .object(let x) = self{return x};return nil}; var arr:[JSONValue]?{if case .array(let x) = self{return x};return nil}}
