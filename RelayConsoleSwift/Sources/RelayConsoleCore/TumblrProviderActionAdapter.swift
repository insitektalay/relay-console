import Foundation

public struct TumblrProviderHTTPRequest: Sendable, Equatable {
    public var method: String
    public var url: URL
    public var headers: [String: String]
    public init(method: String, url: URL, headers: [String: String]) {
        self.method = method; self.url = url; self.headers = headers
    }
}

public struct TumblrProviderHTTPResponse: Sendable, Equatable {
    public var statusCode: Int
    public var body: Data
    public init(statusCode: Int, body: Data) { self.statusCode = statusCode; self.body = body }
}

public protocol TumblrProviderHTTPClient: Sendable {
    func send(_ request: TumblrProviderHTTPRequest) throws -> TumblrProviderHTTPResponse
}

public struct URLSessionTumblrProviderHTTPClient: TumblrProviderHTTPClient {
    private let timeoutSeconds: TimeInterval
    public init(timeoutSeconds: TimeInterval = 20) { self.timeoutSeconds = timeoutSeconds }
    public func send(_ request: TumblrProviderHTTPRequest) throws -> TumblrProviderHTTPResponse {
        var value = URLRequest(url: request.url)
        value.httpMethod = request.method
        value.timeoutInterval = timeoutSeconds
        request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) }
        let semaphore = DispatchSemaphore(value: 0)
        var data: Data?, status: Int?, failure: Error?
        let task = URLSession.shared.dataTask(with: value) { body, response, error in
            data = body; status = (response as? HTTPURLResponse)?.statusCode
            failure = error; semaphore.signal()
        }
        task.resume()
        if semaphore.wait(timeout: .now() + timeoutSeconds) == .timedOut {
            task.cancel()
            throw TumblrProviderActionSupport.failure(
                "tumblr_http_timeout", "Tumblr API request timed out without retry.")
        }
        if failure != nil {
            throw TumblrProviderActionSupport.failure(
                "tumblr_network_error", "Tumblr API request failed before a response was received.")
        }
        return TumblrProviderHTTPResponse(statusCode: status ?? 0, body: data ?? Data())
    }
}

public protocol TumblrProviderActionClient: Sendable {
    func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord
}

public enum TumblrProviderActionSupport {
    static func failure(_ code: String, _ message: String) -> MarketplaceProviderActionAdapterFailure {
        MarketplaceProviderActionAdapterFailure(
            code: code, message: message,
            detail: ["automaticRetry": .bool(false), "providerDataPersisted": .bool(false)])
    }
}

public struct FakeTumblrProviderActionClient: TumblrProviderActionClient {
    public init() {}
    public func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        var result = base()
        let blog: JSONRecord = [
            "uuid": .string("t:RelayOwnedBlog_123"), "name": .string("relay-blog"),
            "title": .string("Relay Blog"), "url": .string("https://relay-blog.tumblr.com/"),
            "descriptionText": .string("Notes about reliable agent systems."),
            "updatedTimestamp": .number(1_752_326_400), "postCount": .number(12),
        ]
        switch request.definition.actionKey {
        case "tumblr_account_get":
            result["account"] = .object([
                "name": .string("relay_account"), "selectedBlogUUID": .string("t:RelayOwnedBlog_123"),
                "selectedBlogName": .string("relay-blog"),
            ])
            result["ownedBlogs"] = .array([.object(blog.merging([
                "primary": .bool(true), "type": .string("public"),
            ]) { _, new in new })])
        case "tumblr_owned_blog_get":
            result["blog"] = .object(blog); result["ownershipVerified"] = .bool(true)
        case "tumblr_owned_blog_recent_posts_list":
            result["posts"] = .array([.object([
                "idString": .string("1234567890123456789"),
                "postURL": .string("https://relay-blog.tumblr.com/post/1234567890123456789"),
                "date": .string("2026-07-12 12:00:00 GMT"),
                "timestamp": .number(1_752_326_400), "state": .string("published"),
                "tags": .array([.string("agents"), .string("reliability")]),
                "text": .string("A practical note about reliable agent loops."),
                "contentFormat": .string("npf"), "textTruncated": .bool(false),
            ])])
            result["resultCount"] = .number(1); result["nextPageFollowed"] = .bool(false)
            result["ownershipVerified"] = .bool(true)
        default:
            throw TumblrProviderActionSupport.failure(
                "tumblr_action_not_allowlisted", "Tumblr V1 permits exactly three reads.")
        }
        return result
    }
    private func base() -> JSONRecord {
        [
            "provider": .string("tumblr"), "fakeAdapter": .bool(true), "simulated": .bool(true),
            "liveCredentialsUsed": .bool(false), "boundAccountOnly": .bool(true),
            "selectedOwnedBlogOnly": .bool(true), "publishedPostsOnly": .bool(true),
            "providerDataPersisted": .bool(false), "providerRequestCount": .number(1),
            "automaticRetry": .bool(false), "automaticPagination": .bool(false),
            "redactionStatus": .string("provider-content-not-stored"),
        ]
    }
}

public final class LiveTumblrProviderActionClient: TumblrProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService
    private let secrets: SecretService
    private let http: any TumblrProviderHTTPClient
    public init(
        data: LocalDataService, secrets: SecretService,
        httpClient: any TumblrProviderHTTPClient = URLSessionTumblrProviderHTTPClient()
    ) {
        self.data = data; self.secrets = secrets; self.http = httpClient
    }

    public func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        let connection = try readyConnection(request)
        let accountName = try binding(connection, key: "accountName")
        let blogUUID = try binding(connection, key: "selectedBlogUUID")
        let blogName = try binding(connection, key: "selectedBlogName")
        let token = try accessToken(connection)
        var result = base()
        switch request.definition.actionKey {
        case "tumblr_account_get":
            let root = try send(path: "/v2/user/info", query: [:], token: token)
            let user = Self.object(Self.object(root["response"])["user"])
            guard user["name"]?.string == accountName else {
                throw TumblrProviderActionSupport.failure(
                    "tumblr_account_binding_mismatch", "Tumblr returned a different connected account.")
            }
            let blogs = Self.array(user["blogs"]).map(Self.ownedBlog)
            guard blogs.contains(where: {
                $0["uuid"]?.string == blogUUID && $0["name"]?.string == blogName
            }) else {
                throw TumblrProviderActionSupport.failure(
                    "tumblr_blog_binding_mismatch", "The selected owned blog is no longer returned for this account.")
            }
            result["account"] = .object([
                "name": .string(accountName), "selectedBlogUUID": .string(blogUUID),
                "selectedBlogName": .string(blogName),
            ])
            result["ownedBlogs"] = .array(blogs.map(JSONValue.object))
        case "tumblr_owned_blog_get":
            let root = try send(path: "/v2/blog/\(blogUUID)/info", query: [:], token: token)
            let blog = Self.blog(Self.object(Self.object(root["response"])["blog"]))
            guard blog["uuid"]?.string == blogUUID || blog["name"]?.string == blogName else {
                throw TumblrProviderActionSupport.failure(
                    "tumblr_blog_binding_mismatch", "Tumblr returned a different blog.")
            }
            result["blog"] = .object(blog); result["ownershipVerified"] = .bool(true)
        case "tumblr_owned_blog_recent_posts_list":
            let limit = Self.limit(request.payload["limit"])
            var query = ["npf": "true", "limit": String(limit)]
            if let tag = request.payload["tag"]?.string?.tumblrNilIfEmpty { query["tag"] = tag }
            let root = try send(path: "/v2/blog/\(blogUUID)/posts", query: query, token: token)
            let response = Self.object(root["response"])
            let returnedBlog = Self.object(response["blog"])
            guard returnedBlog["uuid"]?.string == blogUUID || returnedBlog["name"]?.string == blogName else {
                throw TumblrProviderActionSupport.failure(
                    "tumblr_blog_binding_mismatch", "Tumblr posts were returned for a different blog.")
            }
            let posts = Self.array(response["posts"]).prefix(limit).map(Self.post)
            guard posts.allSatisfy({ $0["blogName"]?.string == nil || $0["blogName"]?.string == blogName }) else {
                throw TumblrProviderActionSupport.failure(
                    "tumblr_post_owner_mismatch", "Tumblr returned a post outside the selected owned blog.")
            }
            result["posts"] = .array(posts.map(JSONValue.object))
            result["resultCount"] = .number(Double(posts.count))
            result["nextPageFollowed"] = .bool(false); result["ownershipVerified"] = .bool(true)
        default:
            throw TumblrProviderActionSupport.failure(
                "tumblr_live_action_not_allowlisted", "Live Tumblr execution supports exactly three reads.")
        }
        return result
    }

    private func readyConnection(
        _ request: MarketplaceProviderActionAdapterRequest
    ) throws -> MarketplaceProviderConnection {
        guard let id = request.auditIdentity.connectionId?.tumblrNilIfEmpty,
              let connection = try data.getProviderConnection(
                workspaceId: request.context.workspaceId, connectionId: id),
              connection.appId == request.app.id, connection.appSlug == "tumblr",
              connection.status == .connected, connection.health.state == .ready,
              connection.grantedScopes == ProviderConnectionService.tumblrRelayOwnedOAuthScopes,
              connection.health.diagnostics["accountVerified"]?.bool == true,
              connection.health.diagnostics["ownedBlogVerified"]?.bool == true,
              connection.health.diagnostics["publishedPostsOnly"]?.bool == true,
              connection.health.diagnostics["providerDataPersisted"]?.bool == false,
              connection.health.diagnostics["writesEnabled"]?.bool == false,
              connection.health.diagnostics["automaticRetry"]?.bool == false,
              connection.health.diagnostics["automaticPagination"]?.bool == false,
              connection.health.diagnostics["rawToolsEnabled"]?.bool == false else {
            throw TumblrProviderActionSupport.failure(
                "tumblr_connection_not_ready",
                "A ready exact-scope no-store Tumblr account and owned-blog connection is required.")
        }
        return connection
    }
    private func binding(_ connection: MarketplaceProviderConnection, key: String) throws -> String {
        guard let value = connection.health.diagnostics[key]?.string?.tumblrNilIfEmpty else {
            throw TumblrProviderActionSupport.failure(
                "tumblr_binding_invalid", "Tumblr account or selected-blog binding is invalid.")
        }
        return value
    }
    private func accessToken(_ connection: MarketplaceProviderConnection) throws -> String {
        guard let reference = connection.credentialRequirements.first(where: {
            $0.fieldKey == "tumblr_oauth_access_token"
        })?.secretReferenceId,
              let token = try secrets.getSecretValue(reference).tumblrNilIfEmpty else {
            throw TumblrProviderActionSupport.failure(
                "tumblr_token_unavailable", "Tumblr access token is unavailable; reconnect is required.")
        }
        return token
    }
    private func send(path: String, query: [String: String], token: String) throws -> JSONRecord {
        var components = URLComponents(string: "https://api.tumblr.com")
        components?.path = path
        components?.queryItems = query.sorted { $0.key < $1.key }.map {
            URLQueryItem(name: $0.key, value: $0.value)
        }
        guard let url = components?.url else {
            throw TumblrProviderActionSupport.failure(
                "tumblr_invalid_request", "Tumblr request construction failed.")
        }
        let response = try http.send(TumblrProviderHTTPRequest(
            method: "GET", url: url,
            headers: [
                "Authorization": "Bearer \(token)", "Accept": "application/json",
                "User-Agent": "RelayConsole/1.0 TumblrMarketplace",
            ]))
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: Self.errorCode(response.statusCode),
                message: "Tumblr API rejected the request.",
                providerStatusCode: response.statusCode,
                detail: [
                    "providerBodyPresent": .bool(!response.body.isEmpty),
                    "automaticRetry": .bool(false), "providerDataPersisted": .bool(false),
                ])
        }
        guard let object = try JSONSerialization.jsonObject(with: response.body) as? [String: Any] else {
            throw TumblrProviderActionSupport.failure(
                "tumblr_invalid_json", "Tumblr API returned malformed JSON.")
        }
        return jsonRecord(from: object)
    }
    private func base() -> JSONRecord {
        [
            "provider": .string("tumblr"), "fakeAdapter": .bool(false), "simulated": .bool(false),
            "liveCredentialsUsed": .bool(true), "boundAccountOnly": .bool(true),
            "selectedOwnedBlogOnly": .bool(true), "publishedPostsOnly": .bool(true),
            "providerDataPersisted": .bool(false), "providerRequestCount": .number(1),
            "automaticRetry": .bool(false), "automaticPagination": .bool(false),
            "redactionStatus": .string("provider-content-not-stored"),
        ]
    }

    private static func ownedBlog(_ value: JSONValue) -> JSONRecord {
        let object = object(value)
        return [
            "uuid": scalar(object["uuid"], 160), "name": scalar(object["name"], 128),
            "title": scalar(object["title"], 512), "url": scalar(object["url"], 2048),
            "primary": scalar(object["primary"]), "type": scalar(object["type"], 32),
        ]
    }
    private static func blog(_ object: JSONRecord) -> JSONRecord {
        let description = plainText(object["description"]?.string ?? "", limit: 3000)
        return [
            "uuid": scalar(object["uuid"], 160), "name": scalar(object["name"], 128),
            "title": scalar(object["title"], 512), "url": scalar(object["url"], 2048),
            "descriptionText": .string(description.text),
            "descriptionTruncated": .bool(description.truncated),
            "updatedTimestamp": scalar(object["updated"]), "postCount": scalar(object["posts"]),
        ]
    }
    private static func post(_ value: JSONValue) -> JSONRecord {
        let object = object(value)
        let npfText = npfText(object["content"]) + npfTrailText(object["trail"])
        let legacy = [
            object["title"]?.string, object["body"]?.string, object["caption"]?.string,
            object["description"]?.string, object["text"]?.string,
        ].compactMap { $0 }.joined(separator: "\n")
        let source = npfText.tumblrNilIfEmpty ?? legacy
        let normalized = plainText(source, limit: 8000)
        return [
            "blogName": scalar(object["blog_name"], 128),
            "idString": scalar(object["id_string"], 64),
            "postURL": scalar(object["post_url"], 2048),
            "date": scalar(object["date"], 64), "timestamp": scalar(object["timestamp"]),
            "state": scalar(object["state"], 32), "tags": stringArray(object["tags"], 100, 30),
            "text": .string(normalized.text), "textTruncated": .bool(normalized.truncated),
            "contentFormat": .string(npfText.tumblrNilIfEmpty == nil ? "legacy" : "npf"),
        ]
    }
    private static func npfText(_ value: JSONValue?) -> String {
        array(value).compactMap { block -> String? in
            let object = object(block)
            guard object["type"]?.string == "text" else { return nil }
            return object["text"]?.string
        }.joined(separator: "\n")
    }
    private static func npfTrailText(_ value: JSONValue?) -> String {
        array(value).flatMap { trail -> [String] in
            let trailObject = object(trail)
            return array(trailObject["content"]).compactMap {
                let block = object($0)
                return block["type"]?.string == "text" ? block["text"]?.string : nil
            }
        }.joined(separator: "\n")
    }
    private static func plainText(_ source: String, limit: Int) -> (text: String, truncated: Bool) {
        let range = NSRange(source.startIndex..<source.endIndex, in: source)
        let withoutTags = (try? NSRegularExpression(pattern: "<[^>]+>"))?
            .stringByReplacingMatches(in: source, range: range, withTemplate: " ") ?? source
        let decoded = withoutTags
            .replacingOccurrences(of: "&amp;", with: "&")
            .replacingOccurrences(of: "&lt;", with: "<")
            .replacingOccurrences(of: "&gt;", with: ">")
            .replacingOccurrences(of: "&quot;", with: "\"")
            .replacingOccurrences(of: "&#39;", with: "'")
        let compact = decoded.split(whereSeparator: { $0.isWhitespace }).joined(separator: " ")
        return (String(compact.prefix(limit)), compact.count > limit)
    }
    private static func limit(_ value: JSONValue?) -> Int {
        guard let number = value?.number, number.isFinite else { return 10 }
        return min(10, max(1, Int(number)))
    }
    private static func array(_ value: JSONValue?) -> [JSONValue] {
        if case .array(let values)? = value { return values }
        return []
    }
    private static func object(_ value: JSONValue?) -> JSONRecord {
        if case .object(let object)? = value { return object }
        return [:]
    }
    private static func scalar(_ value: JSONValue?, _ max: Int = 512) -> JSONValue {
        guard let value else { return .null }
        if case .string(let string) = value { return .string(String(string.prefix(max))) }
        switch value { case .number, .bool, .null: return value; default: return .null }
    }
    private static func stringArray(
        _ value: JSONValue?, _ maxCharacters: Int, _ maxItems: Int
    ) -> JSONValue {
        .array(array(value).prefix(maxItems).compactMap {
            guard let string = $0.string else { return nil }
            return .string(String(string.prefix(maxCharacters)))
        })
    }
    private static func errorCode(_ status: Int) -> String {
        switch status {
        case 400: return "tumblr_invalid_request"
        case 401: return "tumblr_invalid_token"
        case 403: return "tumblr_permission_denied"
        case 404: return "tumblr_blog_not_found"
        case 429: return "tumblr_rate_limited"
        default: return status >= 500 ? "tumblr_provider_unavailable" : "tumblr_http_error"
        }
    }
}

public struct TumblrProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = [
        "tumblr_account_get", "tumblr_owned_blog_get",
        "tumblr_owned_blog_recent_posts_list",
    ]
    private let client: any TumblrProviderActionClient
    public init(client: any TumblrProviderActionClient = FakeTumblrProviderActionClient()) {
        self.client = client
    }
    public func execute(
        request: MarketplaceProviderActionAdapterRequest
    ) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "tumblr", request.permission == .allowed,
              Self.allowed.contains(request.definition.actionKey) else {
            throw TumblrProviderActionSupport.failure(
                "tumblr_action_not_allowlisted", "Tumblr V1 permits exactly three read actions.")
        }
        let allowedPayload: Set<String> =
            request.definition.actionKey == "tumblr_owned_blog_recent_posts_list"
            ? ["limit", "tag"] : []
        guard Set(request.payload.keys).isSubset(of: allowedPayload),
              request.payload["limit"].map(Self.validLimit) ?? true,
              request.payload["tag"].map(Self.validTag) ?? true else {
            throw TumblrProviderActionSupport.failure(
                "tumblr_payload_not_supported",
                "Tumblr rejects account/blog overrides, fields, cursors, URLs, media, private content, writes, and raw parameters.")
        }
        return MarketplaceProviderActionAdapterResult(
            result: try client.execute(request),
            redactionStatus: "provider-content-not-stored", persistResult: false)
    }
    private static func validLimit(_ value: JSONValue) -> Bool {
        guard let number = value.number, number.isFinite, number.rounded() == number else { return false }
        return (1...10).contains(Int(number))
    }
    private static func validTag(_ value: JSONValue) -> Bool {
        guard let tag = value.string?.tumblrNilIfEmpty, tag.count <= 100 else { return false }
        return !tag.unicodeScalars.contains(where: CharacterSet.controlCharacters.contains)
    }
}

private extension String {
    var tumblrNilIfEmpty: String? {
        let value = trimmingCharacters(in: .whitespacesAndNewlines)
        return value.isEmpty ? nil : value
    }
}
