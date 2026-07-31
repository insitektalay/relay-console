import Foundation

public struct ContentfulProviderActionClientResult: Codable, Equatable, Sendable { public var result: JSONRecord; public init(result: JSONRecord) { self.result = result } }
public protocol ContentfulProviderActionClient: Sendable { func executeContentfulAction(request: MarketplaceProviderActionAdapterRequest) throws -> ContentfulProviderActionClientResult }
public struct ContentfulProviderHTTPRequest: Sendable, Equatable {
    public var method: String; public var url: URL; public var headers: [String: String]; public var body: Data?; public init(method: String, url: URL, headers: [String: String] = [:], body: Data? = nil) { self.method = method; self.url = url; self.headers = headers; self.body = body }
}
public struct ContentfulProviderHTTPResponse: Sendable, Equatable { public var statusCode:Int; public var headers:[String:String]; public var body:Data; public init(statusCode:Int,headers:[String:String]=[:],body:Data=Data()){self.statusCode=statusCode;self.headers=headers;self.body=body} }
public protocol ContentfulProviderHTTPClient: Sendable { func send(_ request:ContentfulProviderHTTPRequest)throws->ContentfulProviderHTTPResponse }
public struct URLSessionContentfulProviderHTTPClient: ContentfulProviderHTTPClient {
    public init() {};
    public func send(_ r: ContentfulProviderHTTPRequest) throws -> ContentfulProviderHTTPResponse {
        var q = URLRequest(url: r.url); q.httpMethod = r.method; q.timeoutInterval = 20; q.httpBody = r.body; r.headers.forEach { q.setValue($0.value, forHTTPHeaderField: $0.key) }; let s = DispatchSemaphore(value: 0); var d: Data?, h: HTTPURLResponse?, e: Error?;
        let t = URLSession.shared.dataTask(with: q) {
            d = $0; h = $1 as? HTTPURLResponse; e = $2; s.signal()
        }; t.resume(); if s.wait(timeout: .now() + 20) == .timedOut { t.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "contentful_http_timeout", message: "Contentful CMA request timed out.") }; if let e { throw e };
        return ContentfulProviderHTTPResponse(statusCode: h?.statusCode ?? 0, headers: h?.allHeaderFields.reduce(into: [:]) { $0[String(describing: $1.key)] = String(describing: $1.value) } ?? [:], body: d ?? Data())
    }
}

public struct FakeContentfulProviderActionClient: ContentfulProviderActionClient {
    public init() {};
    public func executeContentfulAction(request r: MarketplaceProviderActionAdapterRequest) throws -> ContentfulProviderActionClientResult {
        switch r.definition.actionKey {
        case "contentful_space_list": return out(["semanticReadContract": .string("contentful-space-list-v1"), "spaces": .array([.object(ContentfulProviderActionSupport.fakeSpace())])]);
        case "contentful_space_get": return out(["semanticReadContract": .string("contentful-space-get-v1"), "space": .object(ContentfulProviderActionSupport.fakeSpace())]);
        case "contentful_environment_list": return out(["semanticReadContract": .string("contentful-environment-list-v1"), "environments": .array([.object(["id": .string("master"), "name": .string("Master"), "state": .string("ready")])])]);
        case "contentful_content_type_list": return out(["semanticReadContract": .string("contentful-content-type-list-v1"), "contentTypes": .array([.object(ContentfulProviderActionSupport.fakeContentType())])]);
        case "contentful_content_type_get": return out(["semanticReadContract": .string("contentful-content-type-get-v1"), "contentType": .object(ContentfulProviderActionSupport.fakeContentType())]);
        case "contentful_entry_list": return out(["semanticReadContract": .string("contentful-entry-list-v1"), "entries": .array([.object(ContentfulProviderActionSupport.fakeEntry())]), "pagination": .object(["total": .number(1), "skip": .number(0), "limit": .number(10)])]);
        case "contentful_entry_get": return out(["semanticReadContract": .string("contentful-entry-get-v1"), "entry": .object(ContentfulProviderActionSupport.fakeEntry())]);
        case "contentful_entry_prepare": let n = try ContentfulProviderActionSupport.normalized(r.payload), h = MarketplaceProviderActionApprovalService.payloadHash(n); return out(["draftPreview": .object(["payload": .object(n), "payloadHash": .string(h), "providerMutation": .bool(false)])]);
        case "contentful_entry_create_draft":
            let n = try ContentfulProviderActionSupport.normalizedCreate(r.payload), h = MarketplaceProviderActionApprovalService.payloadHash(n); return out(["entry": .object(ContentfulProviderActionSupport.fakeEntry()), "contentState": .string("draft"), "payloadHash": .string(h)]);
        case "contentful_entry_update_draft":
            let n = try ContentfulProviderActionSupport.normalizedUpdate(r.payload), h = MarketplaceProviderActionApprovalService.payloadHash(n); return out(["entry": .object(ContentfulProviderActionSupport.fakeEntry()), "contentState": .string("draft"), "payloadHash": .string(h)]);
        case "contentful_entry_publish":
            let n = try ContentfulProviderActionSupport.normalizedPublish(r.payload), h = MarketplaceProviderActionApprovalService.payloadHash(n); var v = ContentfulProviderActionSupport.fakeEntry(); v["publishedVersion"] = n["expectedVersion"];
            return out(["entry": .object(v), "contentState": .string("published"), "payloadHash": .string(h)]);
        default: throw MarketplaceProviderActionAdapterFailure(code: "contentful_fake_action_not_supported", message: "Unsupported Contentful action.")
        }
    };
    private func out(_ f: JSONRecord) -> ContentfulProviderActionClientResult {
        ContentfulProviderActionClientResult(
            result: ["provider": .string("contentful"), "adapterBoundary": .string("contentful-provider-action-adapter"), "clientMode": .string("fake-contentful-cma"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-state-excluded")].merging(f) { _, n in n })
    }
}

public final class LiveContentfulProviderActionClient: ContentfulProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService; private let secrets: SecretService; private let http: any ContentfulProviderHTTPClient;
    public init(data: LocalDataService, secrets: SecretService, httpClient: any ContentfulProviderHTTPClient = URLSessionContentfulProviderHTTPClient()) { self.data = data; self.secrets = secrets; self.http = httpClient };
    public func executeContentfulAction(request r: MarketplaceProviderActionAdapterRequest) throws -> ContentfulProviderActionClientResult {
        if r.definition.actionKey == "contentful_entry_prepare" { return try FakeContentfulProviderActionClient().executeContentfulAction(request: r) }; let auth = try authorization(r), p = r.payload; try allowed(p, auth.1);
        switch r.definition.actionKey {
        case "contentful_space_list":
            let o = try send("GET", "/spaces", page(p), nil, auth.0, [:], auth.2).cfObj ?? [:];
            return out(["semanticReadContract": .string("contentful-space-list-v1"), "spaces": .array((o["items"]?.cfArr ?? []).prefix(25).map { .object(ContentfulProviderActionSupport.space($0)) }), "pagination": ContentfulProviderActionSupport.pagination(o)]);
        case "contentful_space_get":
            let s = try ContentfulProviderActionSupport.need(p, "spaceId"), v = try send("GET", "/spaces/" + seg(s), [], nil, auth.0, [:], auth.2); return out(["semanticReadContract": .string("contentful-space-get-v1"), "space": .object(ContentfulProviderActionSupport.space(v))]);
        case "contentful_environment_list":
            let s = try ContentfulProviderActionSupport.need(p, "spaceId"), o = try send("GET", "/spaces/" + seg(s) + "/environments", page(p), nil, auth.0, [:], auth.2).cfObj ?? [:];
            return out(["semanticReadContract": .string("contentful-environment-list-v1"), "environments": .array((o["items"]?.cfArr ?? []).prefix(25).map { .object(ContentfulProviderActionSupport.environment($0)) }), "pagination": ContentfulProviderActionSupport.pagination(o)]);
        case "contentful_content_type_list": return try listResource(r, auth, "content_types", "contentTypes", ContentfulProviderActionSupport.contentType);
        case "contentful_content_type_get":
            let path = try envPath(p) + "/content_types/" + seg(try ContentfulProviderActionSupport.need(p, "contentTypeId")), v = try send("GET", path, [], nil, auth.0, [:], auth.2);
            return out(["semanticReadContract": .string("contentful-content-type-get-v1"), "contentType": .object(ContentfulProviderActionSupport.contentType(v))]);
        case "contentful_entry_list": return try listResource(r, auth, "entries", "entries", ContentfulProviderActionSupport.entry);
        case "contentful_entry_get":
            let path = try envPath(p) + "/entries/" + seg(try ContentfulProviderActionSupport.need(p, "entryId")), v = try send("GET", path, [], nil, auth.0, [:], auth.2);
            return out(["semanticReadContract": .string("contentful-entry-get-v1"), "entry": .object(ContentfulProviderActionSupport.entry(v))]);
        case "contentful_entry_create_draft":
            let n = try ContentfulProviderActionSupport.normalizedCreate(p), path = try envPath(n) + "/entries", body = try JSONSerialization.data(withJSONObject: ContentfulProviderActionSupport.body(n)),
                v = try send("POST", path, [], body, auth.0, ["X-Contentful-Content-Type": n["contentTypeId"]!.string!], auth.2), h = MarketplaceProviderActionApprovalService.payloadHash(n)
            ; return out(["entry": .object(ContentfulProviderActionSupport.entry(v)), "contentState": .string("draft"), "payloadHash": .string(h)]);
        case "contentful_entry_update_draft":
            let n = try ContentfulProviderActionSupport.normalizedUpdate(p), path = try envPath(n) + "/entries/" + seg(n["entryId"]!.string!), body = try JSONSerialization.data(withJSONObject: ContentfulProviderActionSupport.body(n)),
                v = try send("PUT", path, [], body, auth.0, ["X-Contentful-Version": String(Int(n["expectedVersion"]!.number!))], auth.2), h = MarketplaceProviderActionApprovalService.payloadHash(n)
            ; return out(["entry": .object(ContentfulProviderActionSupport.entry(v)), "contentState": .string("draft"), "payloadHash": .string(h)]);
        case "contentful_entry_publish":
            let n = try ContentfulProviderActionSupport.normalizedPublish(p), path = try envPath(n) + "/entries/" + seg(n["entryId"]!.string!) + "/published", v = try send("PUT", path, [], Data("{}".utf8), auth.0, ["X-Contentful-Version": String(Int(n["expectedVersion"]!.number!))], auth.2),
                h = MarketplaceProviderActionApprovalService.payloadHash(n)
            ; return out(["entry": .object(ContentfulProviderActionSupport.entry(v)), "contentState": .string("published"), "payloadHash": .string(h)]);
        default: throw MarketplaceProviderActionAdapterFailure(code: "contentful_live_action_not_supported", message: "Unsupported live Contentful action.")
        }
    };
    private func listResource(_ r: MarketplaceProviderActionAdapterRequest, _ a: (String, MarketplaceProviderConnection, String), _ resource: String, _ key: String, _ map: (JSONValue) -> JSONRecord) throws -> ContentfulProviderActionClientResult {
        let o = try send("GET", try envPath(r.payload) + "/" + resource, page(r.payload), nil, a.0, [:], a.2).cfObj ?? [:];
        return out(["semanticReadContract": .string("contentful-" + resource.replacingOccurrences(of: "_", with: "-") + "-list-v1"), key: .array((o["items"]?.cfArr ?? []).prefix(25).map { .object(map($0)) }), "pagination": ContentfulProviderActionSupport.pagination(o)])
    }; private func envPath(_ p: JSONRecord) throws -> String { "/spaces/" + seg(try ContentfulProviderActionSupport.need(p, "spaceId")) + "/environments/" + seg(try ContentfulProviderActionSupport.need(p, "environmentId")) };
    private func page(_ p: JSONRecord) -> [URLQueryItem] { [URLQueryItem(name: "limit", value: String(ContentfulProviderActionSupport.bound(p["maxResults"], 10, 25))), URLQueryItem(name: "skip", value: String(max(0, Int(p["skip"]?.number ?? 0))))] };
    private func authorization(_ r: MarketplaceProviderActionAdapterRequest) throws -> (String, MarketplaceProviderConnection, String) {
        guard let id = r.auditIdentity.connectionId, let c = try data.getProviderConnection(workspaceId: r.context.workspaceId, connectionId: id), c.appSlug == "contentful", let ref = c.credentialRequirements.first(where: { $0.fieldKey == "contentful_oauth_access_token" })?.secretReferenceId else {
            throw MarketplaceProviderActionAdapterFailure(code: "contentful_connection_not_ready", message: "Contentful connection is not ready.")
        }; return (try secrets.getSecretValue(ref), c, c.health.diagnostics["cmaHost"]?.string ?? "https://api.contentful.com")
    };
    private func allowed(_ p: JSONRecord, _ c: MarketplaceProviderConnection) throws {
        if let s = p["spaceId"]?.string {
            guard ContentfulProviderActionSupport.strings(c.health.diagnostics["authorizedSpaceIds"]).contains(s) else { throw MarketplaceProviderActionAdapterFailure(code: "contentful_space_not_authorized", message: "Contentful space is not authorized for this connection.") }
        };
        if let e = p["environmentId"]?.string {
            guard ContentfulProviderActionSupport.strings(c.health.diagnostics["authorizedEnvironmentIds"]).contains(e) else { throw MarketplaceProviderActionAdapterFailure(code: "contentful_environment_not_authorized", message: "Contentful environment is not authorized for this connection.") }
        }
    };
    private func send(_ m: String, _ p: String, _ q: [URLQueryItem], _ b: Data?, _ t: String, _ extra: [String: String], _ host: String) throws -> JSONValue {
        var c = URLComponents(string: host + p); c?.queryItems = q.isEmpty ? nil : q; var h = ["Authorization": "Bearer " + t, "Accept": "application/vnd.contentful.management.v1+json", "Content-Type": "application/vnd.contentful.management.v1+json"]; extra.forEach { h[$0.key] = $0.value };
        let r = try http.send(ContentfulProviderHTTPRequest(method: m, url: c!.url!, headers: h, body: b));
        guard (200..<300).contains(r.statusCode) else {
            let code =
                r.statusCode == 401
                ? "contentful_token_invalid" : r.statusCode == 403 ? "contentful_permission_denied" : r.statusCode == 404 ? "contentful_resource_not_found" : r.statusCode == 409 ? "contentful_version_conflict" : r.statusCode == 429 ? "contentful_rate_limited" : "contentful_http_error";
            throw MarketplaceProviderActionAdapterFailure(
                code: code, message: "Contentful CMA request failed.", providerStatusCode: r.statusCode,
                detail: ["retryAfter": r.headers.first { $0.key.lowercased() == "x-contentful-ratelimit-reset" || $0.key.lowercased() == "retry-after" }.flatMap { Double($0.value) }.map(JSONValue.number) ?? .null])
        }; return r.body.isEmpty ? .object([:]) : ContentfulProviderActionSupport.json(try JSONSerialization.jsonObject(with: r.body))
    }; private func seg(_ s: String) -> String { s.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? s };
    private func out(_ f: JSONRecord) -> ContentfulProviderActionClientResult {
        ContentfulProviderActionClientResult(
            result: ["provider": .string("contentful"), "adapterBoundary": .string("contentful-provider-action-adapter"), "clientMode": .string("live-contentful-cma"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-state-excluded")].merging(f) { _, n in n })
    }
}

public struct ContentfulProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = [
        "contentful_space_list", "contentful_space_get", "contentful_environment_list", "contentful_content_type_list", "contentful_content_type_get", "contentful_entry_list", "contentful_entry_get", "contentful_entry_prepare", "contentful_entry_create_draft", "contentful_entry_update_draft",
        "contentful_entry_publish",
    ]
        ;
    private let client: any ContentfulProviderActionClient; public init(client: any ContentfulProviderActionClient = FakeContentfulProviderActionClient()) { self.client = client };
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "contentful" else { throw MarketplaceProviderActionAdapterFailure(code: "contentful_wrong_provider", message: "Contentful adapter requires Contentful.") };
        guard Self.allowed.contains(request.definition.actionKey) else { throw MarketplaceProviderActionAdapterFailure(code: "contentful_action_not_allowlisted", message: "Contentful action is outside V1.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executeContentfulAction(request: request).result, error: nil, redactionStatus: "private-state-excluded")
    }
}

public enum ContentfulProviderActionSupport {
    public static func need(_ p: JSONRecord, _ k: String) throws -> String { guard let v = p[k]?.string?.cfNonEmpty else { throw MarketplaceProviderActionAdapterFailure(code: "contentful_missing_field", message: "Contentful \(k) is required.") }; return v };
    public static func bound(_ v: JSONValue?, _ d: Int, _ m: Int) -> Int { max(1, min(m, v?.number.map(Int.init) ?? d)) }; public static func strings(_ v: JSONValue?) -> [String] { guard case .array(let a)? = v else { return [] }; return a.compactMap(\.string) };
    public static func normalized(_ p: JSONRecord) throws -> JSONRecord {
        switch p["operation"]?.string ?? "create" {
        case "create": return try normalizedCreate(p);
        case "update": return try normalizedUpdate(p);
        case "publish": return try normalizedPublish(p);
        default: throw MarketplaceProviderActionAdapterFailure(code: "contentful_invalid_operation", message: "Use create, update, or publish.")
        }
    }; public static func normalizedCreate(_ p: JSONRecord) throws -> JSONRecord { var o = try base(p); o["operation"] = .string("create"); o["contentTypeId"] = .string(try need(p, "contentTypeId")); o["fields"] = try fields(p); return o };
    public static func normalizedUpdate(_ p: JSONRecord) throws -> JSONRecord { var o = try base(p); o["operation"] = .string("update"); o["entryId"] = .string(try need(p, "entryId")); o["expectedVersion"] = try version(p); o["fields"] = try fields(p); return o };
    public static func normalizedPublish(_ p: JSONRecord) throws -> JSONRecord { var o = try base(p); o["operation"] = .string("publish"); o["entryId"] = .string(try need(p, "entryId")); o["expectedVersion"] = try version(p); return o };
    private static func base(_ p: JSONRecord) throws -> JSONRecord { ["spaceId": .string(try need(p, "spaceId")), "environmentId": .string(try need(p, "environmentId"))] };
    private static func version(_ p: JSONRecord) throws -> JSONValue {
        let n = Int(p["expectedVersion"]?.number ?? 0); guard n > 0 else { throw MarketplaceProviderActionAdapterFailure(code: "contentful_version_required", message: "Positive expectedVersion is required.") }; return .number(Double(n))
    };
    private static func fields(_ p: JSONRecord) throws -> JSONValue {
        guard case .object(let f)? = p["fields"], !f.isEmpty, f.count <= 40 else { throw MarketplaceProviderActionAdapterFailure(code: "contentful_fields_invalid", message: "Contentful complete fields must contain 1 to 40 fields.") }; return safe(.object(f))
    }; public static func body(_ p: JSONRecord) -> [String: Any] { ["fields": any(p["fields"] ?? .object([:]))] };
    public static func space(_ v: JSONValue) -> JSONRecord { let o = v.cfObj ?? [:], s = o["sys"]?.cfObj ?? [:]; return ["id": s["id"] ?? .null, "name": o["name"] ?? .null, "createdAt": s["createdAt"] ?? .null, "updatedAt": s["updatedAt"] ?? .null, "version": s["version"] ?? .null] };
    public static func environment(_ v: JSONValue) -> JSONRecord { let o = v.cfObj ?? [:], s = o["sys"]?.cfObj ?? [:]; return ["id": s["id"] ?? .null, "name": o["name"] ?? .null, "state": s["state"] ?? .null, "version": s["version"] ?? .null] };
    public static func contentType(_ v: JSONValue) -> JSONRecord {
        let o = v.cfObj ?? [:], s = o["sys"]?.cfObj ?? [:],
            fs = (o["fields"]?.cfArr ?? []).prefix(40).map { q -> JSONValue in
                let f = q.cfObj ?? [:], items = f["items"]?.cfObj ?? [:];
                return .object([
                    "id": f["id"] ?? .null, "name": f["name"] ?? .null, "type": f["type"] ?? .null, "linkType": f["linkType"] ?? .null, "itemsType": items["type"] ?? .null, "itemsLinkType": items["linkType"] ?? .null, "required": f["required"] ?? .null, "localized": f["localized"] ?? .null,
                    "disabled": f["disabled"] ?? .null, "omitted": f["omitted"] ?? .null,
                ])
            }
        ; return ["id": s["id"] ?? .null, "name": o["name"] ?? .null, "displayField": o["displayField"] ?? .null, "description": safe(o["description"] ?? .null), "version": s["version"] ?? .null, "fields": .array(fs)]
    };
    public static func entry(_ v: JSONValue) -> JSONRecord {
        let o = v.cfObj ?? [:], s = o["sys"]?.cfObj ?? [:];
        return [
            "id": s["id"] ?? .null, "spaceId": linkId(s["space"]), "environmentId": linkId(s["environment"]), "contentTypeId": linkId(s["contentType"]), "createdAt": s["createdAt"] ?? .null, "updatedAt": s["updatedAt"] ?? .null, "publishedAt": s["publishedAt"] ?? .null,
            "archivedAt": s["archivedAt"] ?? .null, "version": s["version"] ?? .null, "publishedVersion": s["publishedVersion"] ?? .null, "archivedVersion": s["archivedVersion"] ?? .null, "fields": safe(o["fields"] ?? .object([:])),
        ]
    }; private static func linkId(_ v: JSONValue?) -> JSONValue { (v?.cfObj)?["sys"]?.cfObj?["id"] ?? .null };
    public static func pagination(_ o: JSONRecord) -> JSONValue { .object(["total": o["total"] ?? .null, "skip": o["skip"] ?? .null, "limit": o["limit"] ?? .null, "pages": safe(o["pages"] ?? .object([:]))]) };
    public static func safe(_ v: JSONValue, _ d: Int = 0) -> JSONValue {
        guard d < 5 else { return .null };
        switch v {
        case .string(let s): return .string(String(s.prefix(10000)));
        case .array(let a): return .array(a.prefix(30).map { safe($0, d + 1) });
        case .object(let o): return .object(Dictionary(uniqueKeysWithValues: o.prefix(50).map { ($0.key, safe($0.value, d + 1)) }));
        default: return v
        }
    };
    public static func any(_ v: JSONValue) -> Any {
        switch v {
        case .null: return NSNull();
        case .string(let x): return x;
        case .number(let x): return x;
        case .bool(let x): return x;
        case .array(let x): return x.map(any);
        case .object(let x): return x.mapValues(any)
        }
    }; public static func fakeSpace() -> JSONRecord { ["id": .string("space1"), "name": .string("Relay Editorial"), "version": .number(4)] };
    public static func fakeContentType() -> JSONRecord {
        ["id": .string("article"), "name": .string("Article"), "displayField": .string("title"), "version": .number(3), "fields": .array([.object(["id": .string("title"), "name": .string("Title"), "type": .string("Symbol"), "required": .bool(true), "localized": .bool(true)])])]
    };
    public static func fakeEntry() -> JSONRecord {
        [
            "id": .string("entry1"), "spaceId": .string("space1"), "environmentId": .string("master"), "contentTypeId": .string("article"), "createdAt": .string("2026-07-11T00:00:00Z"), "updatedAt": .string("2026-07-11T00:00:01Z"), "publishedAt": .null, "archivedAt": .null, "version": .number(7),
            "publishedVersion": .null, "archivedVersion": .null, "fields": .object(["title": .object(["en-US": .string("Relay Launch")]), "body": .object(["en-US": .string("Bounded localized content")])]),
        ]
    };
    public static func json(_ v: Any) -> JSONValue {
        if let x = v as? String { return .string(x) }; if let x = v as? Bool { return .bool(x) }; if let x = v as? Int { return .number(Double(x)) }; if let x = v as? Double { return .number(x) }; if let x = v as? [String: Any] { return .object(x.mapValues(json)) };
        if let x = v as? [Any] { return .array(x.map(json)) }; return .null
    }
}
private extension JSONValue{var cfObj:JSONRecord?{if case .object(let v)=self{return v};return nil};var cfArr:[JSONValue]?{if case .array(let v)=self{return v};return nil}}
private extension String{var cfNonEmpty:String?{let v=trimmingCharacters(in:.whitespacesAndNewlines);return v.isEmpty ? nil:v}}
