import Foundation

public struct WordPressComProviderActionClientResult: Codable, Equatable, Sendable { public var result: JSONRecord; public init(result: JSONRecord) { self.result = result } }
public protocol WordPressComProviderActionClient: Sendable { func executeWordPressComAction(request: MarketplaceProviderActionAdapterRequest) throws -> WordPressComProviderActionClientResult }
public struct WordPressComProviderHTTPRequest: Sendable, Equatable {
    public var method: String; public var url: URL; public var headers: [String: String]; public var body: Data?; public init(method: String, url: URL, headers: [String: String] = [:], body: Data? = nil) { self.method = method; self.url = url; self.headers = headers; self.body = body }
}
public struct WordPressComProviderHTTPResponse: Sendable, Equatable {
    public var statusCode: Int; public var headers: [String: String]; public var body: Data; public init(statusCode: Int, headers: [String: String] = [:], body: Data = Data()) { self.statusCode = statusCode; self.headers = headers; self.body = body }
}
public protocol WordPressComProviderHTTPClient: Sendable { func send(_ request: WordPressComProviderHTTPRequest) throws -> WordPressComProviderHTTPResponse }

public struct URLSessionWordPressComProviderHTTPClient: WordPressComProviderHTTPClient {
    public init() {}
    public func send(_ request: WordPressComProviderHTTPRequest) throws -> WordPressComProviderHTTPResponse {
        var value = URLRequest(url: request.url); value.httpMethod = request.method; value.timeoutInterval = 20; value.httpBody = request.body; request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) }
        let semaphore = DispatchSemaphore(value: 0); var data: Data?; var response: HTTPURLResponse?; var failure: Error?
        let task = URLSession.shared.dataTask(with: value) { data = $0; response = $1 as? HTTPURLResponse; failure = $2; semaphore.signal() }; task.resume()
        if semaphore.wait(timeout: .now() + 20) == .timedOut { task.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "wordpress_com_http_timeout", message: "WordPress.com API request timed out.") }
        if let failure { throw failure }
        return WordPressComProviderHTTPResponse(statusCode: response?.statusCode ?? 0, headers: response?.allHeaderFields.reduce(into: [:]) { $0[String(describing: $1.key)] = String(describing: $1.value) } ?? [:], body: data ?? Data())
    }
}

public struct FakeWordPressComProviderActionClient: WordPressComProviderActionClient {
    public init() {}
    public func executeWordPressComAction(request r: MarketplaceProviderActionAdapterRequest) throws -> WordPressComProviderActionClientResult {
        switch r.definition.actionKey {
        case "wordpress_com_site_list": return out(["semanticReadContract": .string("wordpress-com-site-list-v1"), "sites": .array([.object(WordPressComProviderActionSupport.fakeSite())])])
        case "wordpress_com_site_get": var v = WordPressComProviderActionSupport.fakeSite(); v["id"] = .string(try WordPressComProviderActionSupport.need(r.payload, "siteId")); return out(["semanticReadContract": .string("wordpress-com-site-get-v1"), "site": .object(v)])
        case "wordpress_com_post_list": return out(["semanticReadContract": .string("wordpress-com-post-list-v1"), "posts": .array([.object(WordPressComProviderActionSupport.fakePost())]), "found": .number(1)])
        case "wordpress_com_post_get": var v = WordPressComProviderActionSupport.fakePost(); v["id"] = .string(try WordPressComProviderActionSupport.need(r.payload, "postId")); return out(["semanticReadContract": .string("wordpress-com-post-get-v1"), "post": .object(v)])
        case "wordpress_com_post_prepare":
            let p = try WordPressComProviderActionSupport.normalized(r.payload), hash = MarketplaceProviderActionApprovalService.payloadHash(p); return out(["draftPreview": .object(["payload": .object(p), "payloadHash": .string(hash), "providerMutation": .bool(false)])])
        case "wordpress_com_post_create_draft":
            let p = try WordPressComProviderActionSupport.normalizedCreate(r.payload), hash = MarketplaceProviderActionApprovalService.payloadHash(p); var v = WordPressComProviderActionSupport.fakePost(); v["status"] = .string("draft");
            return out(["post": .object(v), "contentState": .string("draft"), "payloadHash": .string(hash)])
        case "wordpress_com_post_update_draft":
            let p = try WordPressComProviderActionSupport.normalizedUpdate(r.payload, publish: false), hash = MarketplaceProviderActionApprovalService.payloadHash(p); var v = WordPressComProviderActionSupport.fakePost(); v["status"] = .string("draft");
            return out(["post": .object(v), "contentState": .string("draft"), "payloadHash": .string(hash)])
        case "wordpress_com_post_publish":
            let p = try WordPressComProviderActionSupport.normalizedUpdate(r.payload, publish: true), hash = MarketplaceProviderActionApprovalService.payloadHash(p); var v = WordPressComProviderActionSupport.fakePost(); v["status"] = .string("publish");
            return out(["post": .object(v), "contentState": .string("published"), "payloadHash": .string(hash)])
        default: throw MarketplaceProviderActionAdapterFailure(code: "wordpress_com_fake_action_not_supported", message: "Unsupported WordPress.com action.")
        }
    }
    private func out(_ fields: JSONRecord) -> WordPressComProviderActionClientResult {
        WordPressComProviderActionClientResult(
            result: ["provider": .string("wordpress-com"), "adapterBoundary": .string("wordpress-com-provider-action-adapter"), "clientMode": .string("fake-wordpress-com-rest-v1.1"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-state-excluded")].merging(fields) {
                _, n in n
            })
    }
}

public final class LiveWordPressComProviderActionClient: WordPressComProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService; private let secrets: SecretService; private let http: any WordPressComProviderHTTPClient
    public init(data: LocalDataService, secrets: SecretService, httpClient: any WordPressComProviderHTTPClient = URLSessionWordPressComProviderHTTPClient()) { self.data = data; self.secrets = secrets; self.http = httpClient }
    public func executeWordPressComAction(request r: MarketplaceProviderActionAdapterRequest) throws -> WordPressComProviderActionClientResult {
        if r.definition.actionKey == "wordpress_com_post_prepare" { return try FakeWordPressComProviderActionClient().executeWordPressComAction(request: r) }
        let token = try accessToken(r), p = r.payload
        switch r.definition.actionKey {
        case "wordpress_com_site_list":
            let o = try send("GET", "/rest/v1.1/me/sites", [], nil, token).wpcObject ?? [:]; return out(["semanticReadContract": .string("wordpress-com-site-list-v1"), "sites": .array((o["sites"]?.wpcArray ?? []).prefix(25).map { .object(WordPressComProviderActionSupport.site($0)) })])
        case "wordpress_com_site_get":
            let id = try WordPressComProviderActionSupport.need(p, "siteId"), v = try send("GET", "/rest/v1.1/sites/" + WordPressComProviderActionSupport.segment(id), [], nil, token);
            return out(["semanticReadContract": .string("wordpress-com-site-get-v1"), "site": .object(WordPressComProviderActionSupport.site(v))])
        case "wordpress_com_post_list": return try listPosts(r, token)
        case "wordpress_com_post_get": let v = try getPost(p, token); return out(["semanticReadContract": .string("wordpress-com-post-get-v1"), "post": .object(WordPressComProviderActionSupport.post(v))])
        case "wordpress_com_post_create_draft":
            let n = try WordPressComProviderActionSupport.normalizedCreate(p), site = n["siteId"]!.string!, v = try send("POST", "/rest/v1.1/sites/" + WordPressComProviderActionSupport.segment(site) + "/posts/new", [], WordPressComProviderActionSupport.form(n), token),
                hash = MarketplaceProviderActionApprovalService.payloadHash(n)
            ; return out(["post": .object(WordPressComProviderActionSupport.post(v)), "contentState": .string("draft"), "payloadHash": .string(hash)])
        case "wordpress_com_post_update_draft", "wordpress_com_post_publish":
            let publish = r.definition.actionKey.hasSuffix("publish"), n = try WordPressComProviderActionSupport.normalizedUpdate(p, publish: publish), current = try getPost(n, token), currentPost = WordPressComProviderActionSupport.post(current), expected = n["expectedModified"]?.string;
            guard currentPost["modified"]?.string == expected else { throw MarketplaceProviderActionAdapterFailure(code: "wordpress_com_stale_post", message: "WordPress.com post changed since it was read; review the latest version before writing.") };
            guard currentPost["status"]?.string == "draft" else { throw MarketplaceProviderActionAdapterFailure(code: "wordpress_com_draft_required", message: "Only an existing draft can be updated or published through V1.") };
            let site = n["siteId"]!.string!, post = n["postId"]!.string!, v = try send("POST", "/rest/v1.1/sites/" + WordPressComProviderActionSupport.segment(site) + "/posts/" + WordPressComProviderActionSupport.segment(post), [], WordPressComProviderActionSupport.form(n), token),
                hash = MarketplaceProviderActionApprovalService.payloadHash(n)
            ; return out(["post": .object(WordPressComProviderActionSupport.post(v)), "contentState": .string(publish ? "published" : "draft"), "payloadHash": .string(hash)])
        default: throw MarketplaceProviderActionAdapterFailure(code: "wordpress_com_live_action_not_supported", message: "Unsupported live WordPress.com action.")
        }
    }
    private func listPosts(_ r: MarketplaceProviderActionAdapterRequest, _ token: String) throws -> WordPressComProviderActionClientResult {
        let p = r.payload, site = try WordPressComProviderActionSupport.need(p, "siteId"), number = WordPressComProviderActionSupport.bound(p["maxResults"], 10, 25), offset = max(0, Int(p["offset"]?.number ?? 0));
        var q = [URLQueryItem(name: "number", value: String(number)), URLQueryItem(name: "offset", value: String(offset)), URLQueryItem(name: "context", value: "edit")];
        for key in ["status", "type", "search", "order_by", "order"] { if let v = p[key]?.string?.wpcNonEmpty { q.append(URLQueryItem(name: key, value: v)) } }; let o = try send("GET", "/rest/v1.1/sites/" + WordPressComProviderActionSupport.segment(site) + "/posts", q, nil, token).wpcObject ?? [:];
        return out([
            "semanticReadContract": .string("wordpress-com-post-list-v1"), "siteId": .string(site), "posts": .array((o["posts"]?.wpcArray ?? []).prefix(number).map { .object(WordPressComProviderActionSupport.post($0)) }), "found": o["found"] ?? .number(0),
            "pagination": .object(["number": .number(Double(number)), "offset": .number(Double(offset))]),
        ])
    }
    private func getPost(_ p: JSONRecord, _ token: String) throws -> JSONValue {
        let site = try WordPressComProviderActionSupport.need(p, "siteId"), post = try WordPressComProviderActionSupport.need(p, "postId");
        return try send("GET", "/rest/v1.1/sites/" + WordPressComProviderActionSupport.segment(site) + "/posts/" + WordPressComProviderActionSupport.segment(post), [URLQueryItem(name: "context", value: "edit")], nil, token)
    }
    private func accessToken(_ r: MarketplaceProviderActionAdapterRequest) throws -> String {
        guard let id = r.auditIdentity.connectionId, let c = try data.getProviderConnection(workspaceId: r.context.workspaceId, connectionId: id), c.appSlug == "wordpress-com", let ref = c.credentialRequirements.first(where: { $0.fieldKey == "wordpress_com_oauth_access_token" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "wordpress_com_connection_not_ready", message: "WordPress.com connection is not ready.") }; return try secrets.getSecretValue(ref)
    }
    private func send(_ method: String, _ path: String, _ query: [URLQueryItem], _ body: Data?, _ token: String) throws -> JSONValue {
        var c = URLComponents(string: "https://public-api.wordpress.com" + path); c?.queryItems = query.isEmpty ? nil : query; guard let url = c?.url else { throw MarketplaceProviderActionAdapterFailure(code: "wordpress_com_invalid_url", message: "Could not build WordPress.com API URL.") };
        var headers = ["Authorization": "Bearer " + token, "Accept": "application/json"]; if body != nil { headers["Content-Type"] = "application/x-www-form-urlencoded; charset=utf-8" };
        let response = try http.send(WordPressComProviderHTTPRequest(method: method, url: url, headers: headers, body: body));
        guard (200..<300).contains(response.statusCode) else {
            let code =
                response.statusCode == 401
                ? "wordpress_com_token_invalid"
                : response.statusCode == 403 ? "wordpress_com_permission_denied" : response.statusCode == 404 ? "wordpress_com_resource_not_found" : response.statusCode == 409 ? "wordpress_com_conflict" : response.statusCode == 429 ? "wordpress_com_rate_limited" : "wordpress_com_http_error";
            throw MarketplaceProviderActionAdapterFailure(
                code: code, message: "WordPress.com API request failed.", providerStatusCode: response.statusCode, detail: ["retryAfter": response.headers.first { $0.key.lowercased() == "retry-after" }.flatMap { Double($0.value) }.map(JSONValue.number) ?? .null])
        }; return response.body.isEmpty ? .object([:]) : WordPressComProviderActionSupport.json(try JSONSerialization.jsonObject(with: response.body))
    }
    private func out(_ fields: JSONRecord) -> WordPressComProviderActionClientResult {
        WordPressComProviderActionClientResult(
            result: ["provider": .string("wordpress-com"), "adapterBoundary": .string("wordpress-com-provider-action-adapter"), "clientMode": .string("live-wordpress-com-rest-v1.1"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-state-excluded")].merging(fields) {
                _, n in n
            })
    }
}

public struct WordPressComProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = ["wordpress_com_site_list", "wordpress_com_site_get", "wordpress_com_post_list", "wordpress_com_post_get", "wordpress_com_post_prepare", "wordpress_com_post_create_draft", "wordpress_com_post_update_draft", "wordpress_com_post_publish"]
    private let client: any WordPressComProviderActionClient
    public init(client: any WordPressComProviderActionClient = FakeWordPressComProviderActionClient()) { self.client = client }
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "wordpress-com" else { throw MarketplaceProviderActionAdapterFailure(code: "wordpress_com_wrong_provider", message: "WordPress.com adapter requires WordPress.com.") };
        guard Self.allowed.contains(request.definition.actionKey) else { throw MarketplaceProviderActionAdapterFailure(code: "wordpress_com_action_not_allowlisted", message: "WordPress.com action is outside the V1 allowlist.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executeWordPressComAction(request: request).result, error: nil, redactionStatus: "private-state-excluded")
    }
}

public enum WordPressComProviderActionSupport {
    public static func need(_ p: JSONRecord, _ key: String) throws -> String { guard let v = p[key]?.string?.wpcNonEmpty else { throw MarketplaceProviderActionAdapterFailure(code: "wordpress_com_missing_field", message: "WordPress.com \(key) is required.") }; return v }
    public static func bound(_ v: JSONValue?, _ d: Int, _ m: Int) -> Int { max(1, min(m, v?.number.map(Int.init) ?? d)) }
    public static func normalized(_ p: JSONRecord) throws -> JSONRecord {
        switch p["operation"]?.string ?? "create" {
        case "create": return try normalizedCreate(p);
        case "update": return try normalizedUpdate(p, publish: false);
        case "publish": return try normalizedUpdate(p, publish: true);
        default: throw MarketplaceProviderActionAdapterFailure(code: "wordpress_com_invalid_operation", message: "Use create, update, or publish.")
        }
    }
    public static func normalizedCreate(_ p: JSONRecord) throws -> JSONRecord {
        let site = try need(p, "siteId"), title = try text(p, "title", 1, 300), content = try text(p, "content", 1, 50_000); var o: JSONRecord = ["operation": .string("create"), "siteId": .string(site), "title": .string(title), "content": .string(content), "status": .string("draft")];
        optional(p, &o); return o
    }
    public static func normalizedUpdate(_ p: JSONRecord, publish: Bool) throws -> JSONRecord {
        let site = try need(p, "siteId"), post = try need(p, "postId"), modified = try need(p, "expectedModified");
        var o: JSONRecord = ["operation": .string(publish ? "publish" : "update"), "siteId": .string(site), "postId": .string(post), "expectedModified": .string(modified), "status": .string(publish ? "publish" : "draft")];
        if !publish {
            guard p["title"] != nil || p["content"] != nil || p["excerpt"] != nil else { throw MarketplaceProviderActionAdapterFailure(code: "wordpress_com_update_empty", message: "A draft update requires title, content, or excerpt.") };
            if p["title"] != nil { o["title"] = .string(try text(p, "title", 1, 300)) }; if p["content"] != nil { o["content"] = .string(try text(p, "content", 1, 50_000)) }; if p["excerpt"] != nil { o["excerpt"] = .string(try text(p, "excerpt", 0, 2_000)) }
        }; return o
    }
    private static func optional(_ p: JSONRecord, _ o: inout JSONRecord) {
        if let e = p["excerpt"]?.string { o["excerpt"] = .string(String(e.prefix(2_000))) }; for key in ["slug", "date"] { if let v = p[key]?.string?.wpcNonEmpty { o[key] = .string(String(v.prefix(300))) } };
        for key in ["tags", "categories"] { if case .array(let a)? = p[key] { o[key] = .array(a.prefix(20).compactMap(\.string).compactMap(\.wpcNonEmpty).map { .string(String($0.prefix(100))) }) } }
    }
    private static func text(_ p: JSONRecord, _ key: String, _ min: Int, _ max: Int) throws -> String {
        let v = p[key]?.string ?? ""; guard v.count >= min, v.count <= max else { throw MarketplaceProviderActionAdapterFailure(code: "wordpress_com_invalid_" + key, message: "WordPress.com \(key) is outside its allowed bounds.") }; return v
    }
    public static func form(_ p: JSONRecord) -> Data {
        var items: [URLQueryItem] = []; for key in ["title", "content", "excerpt", "slug", "date", "status"] { if let v = p[key]?.string { items.append(URLQueryItem(name: key, value: v)) } };
        for key in ["tags", "categories"] { if case .array(let values)? = p[key] { items.append(URLQueryItem(name: key, value: values.compactMap(\.string).joined(separator: ","))) } }; var c = URLComponents(); c.queryItems = items; return Data((c.percentEncodedQuery ?? "").utf8)
    }
    public static func site(_ v: JSONValue) -> JSONRecord {
        let o = v.wpcObject ?? [:], caps = o["capabilities"]?.wpcObject ?? [:];
        return [
            "id": o["ID"] ?? o["id"] ?? .null, "name": safe(o["name"] ?? .null), "url": o["URL"] ?? o["url"] ?? .null, "description": safe(o["description"] ?? .null), "isPrivate": o["is_private"] ?? .null, "jetpack": o["jetpack"] ?? .null,
            "capabilities": .object(["editPosts": caps["edit_posts"] ?? .null, "publishPosts": caps["publish_posts"] ?? .null, "deletePosts": caps["delete_posts"] ?? .null]),
        ]
    }
    public static func post(_ v: JSONValue) -> JSONRecord {
        let o = v.wpcObject ?? [:], author = o["author"]?.wpcObject ?? [:], discussion = o["discussion"]?.wpcObject ?? [:];
        return [
            "id": o["ID"] ?? o["id"] ?? .null, "siteId": o["site_ID"] ?? .null, "author": .object(["id": author["ID"] ?? .null, "name": safe(author["name"] ?? .null), "login": author["login"] ?? .null]), "title": safe(o["title"] ?? .null), "content": safe(o["content"] ?? .null),
            "excerpt": safe(o["excerpt"] ?? .null), "url": o["URL"] ?? .null, "shortURL": o["short_URL"] ?? .null, "status": o["status"] ?? .null, "type": o["type"] ?? .null, "slug": o["slug"] ?? .null, "date": o["date"] ?? .null, "modified": o["modified"] ?? .null,
            "categories": safe(o["categories"] ?? .object([:])), "tags": safe(o["tags"] ?? .object([:])), "discussion": .object(["commentsOpen": discussion["comments_open"] ?? .null, "commentCount": discussion["comment_count"] ?? .null]), "likeCount": o["like_count"] ?? .null,
        ]
    }
    public static func safe(_ v: JSONValue, depth: Int = 0) -> JSONValue {
        guard depth < 3 else { return .null };
        switch v {
        case .string(let s): return .string(String(s.prefix(50_000)));
        case .array(let a): return .array(a.prefix(25).map { safe($0, depth: depth + 1) });
        case .object(let o): return .object(Dictionary(uniqueKeysWithValues: o.prefix(40).map { ($0.key, safe($0.value, depth: depth + 1)) }));
        default: return v
        }
    }
    public static func fakeSite() -> JSONRecord {
        ["id": .number(241031857), "name": .string("Relay Editorial"), "url": .string("https://relay.example"), "description": .string("Relay launch publication"), "isPrivate": .bool(true), "jetpack": .bool(false), "capabilities": .object(["editPosts": .bool(true), "publishPosts": .bool(true)])]
    }
    public static func fakePost() -> JSONRecord {
        [
            "id": .number(42), "siteId": .number(241031857), "author": .object(["id": .number(1), "name": .string("Relay Editor"), "login": .string("relay-editor")]), "title": .string("Relay Launch"), "content": .string("A bounded WordPress.com draft."), "excerpt": .string("Launch summary"),
            "url": .string("https://relay.example/relay-launch"), "shortURL": .string("https://wp.me/example"), "status": .string("draft"), "type": .string("post"), "slug": .string("relay-launch"), "date": .string("2026-07-11T00:00:00Z"), "modified": .string("2026-07-11T00:00:01Z"),
            "categories": .object([:]), "tags": .object([:]), "discussion": .object(["commentsOpen": .bool(false), "commentCount": .number(0)]), "likeCount": .number(0),
        ]
    }
    public static func segment(_ s: String) -> String { s.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? s }
    public static func json(_ v: Any) -> JSONValue {
        if let x = v as? String { return .string(x) }; if let x = v as? Bool { return .bool(x) }; if let x = v as? Int { return .number(Double(x)) }; if let x = v as? Double { return .number(x) }; if let x = v as? [String: Any] { return .object(x.mapValues(json)) };
        if let x = v as? [Any] { return .array(x.map(json)) }; return .null
    }
}

private extension JSONValue { var wpcObject: JSONRecord? { if case .object(let v) = self { return v }; return nil }; var wpcArray: [JSONValue]? { if case .array(let v) = self { return v }; return nil } }
private extension String { var wpcNonEmpty: String? { let v = trimmingCharacters(in: .whitespacesAndNewlines); return v.isEmpty ? nil : v } }
