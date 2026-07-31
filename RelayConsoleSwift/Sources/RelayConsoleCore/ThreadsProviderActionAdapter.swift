import Foundation

public struct ThreadsProviderHTTPRequest: Sendable, Equatable {
    public var method: String; public var url: URL; public var headers: [String: String]
    public init(method: String, url: URL, headers: [String: String]) { self.method = method; self.url = url; self.headers = headers }
}
public struct ThreadsProviderHTTPResponse: Sendable, Equatable {
    public var statusCode: Int; public var body: Data
    public init(statusCode: Int, body: Data) { self.statusCode = statusCode; self.body = body }
}
public protocol ThreadsProviderHTTPClient: Sendable {
    func send(_ request: ThreadsProviderHTTPRequest) throws -> ThreadsProviderHTTPResponse
}
public struct URLSessionThreadsProviderHTTPClient: ThreadsProviderHTTPClient {
    private let timeoutSeconds: TimeInterval
    public init(timeoutSeconds: TimeInterval = 20) { self.timeoutSeconds = timeoutSeconds }
    public func send(_ request: ThreadsProviderHTTPRequest) throws -> ThreadsProviderHTTPResponse {
        var value = URLRequest(url: request.url); value.httpMethod = request.method; value.timeoutInterval = timeoutSeconds
        request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) }
        let semaphore = DispatchSemaphore(value: 0); var data: Data?, status: Int?, failure: Error?
        let task = URLSession.shared.dataTask(with: value) { d, r, e in data = d; status = (r as? HTTPURLResponse)?.statusCode; failure = e; semaphore.signal() }
        task.resume()
        if semaphore.wait(timeout: .now() + timeoutSeconds) == .timedOut {
            task.cancel(); throw ThreadsProviderActionSupport.failure("threads_http_timeout", "Threads API request timed out without retry.")
        }
        if failure != nil { throw ThreadsProviderActionSupport.failure("threads_network_error", "Threads API request failed before a response was received.") }
        return ThreadsProviderHTTPResponse(statusCode: status ?? 0, body: data ?? Data())
    }
}

public protocol ThreadsProviderActionClient: Sendable {
    func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord
}

public enum ThreadsProviderActionSupport {
    static func text(_ request: MarketplaceProviderActionAdapterRequest) throws -> String {
        guard let text = request.payload["text"]?.string?.threadsNilIfEmpty else {
            throw failure("threads_missing_text", "Threads text actions require non-empty text.")
        }
        guard text.count <= 500 else { throw failure("threads_text_too_long", "Threads V1 text is limited to 500 characters.") }
        guard text.range(of: #"(?i)(https?://|www\.|\b[a-z0-9-]+\.(com|org|net|io|co|app|dev)\b)"#, options: .regularExpression) == nil else {
            throw failure("threads_url_not_supported", "Threads V1 permits plain text without URLs only.")
        }
        return text
    }
    static func identifier(_ value: JSONValue?) throws -> String {
        guard let id = value?.string?.threadsNilIfEmpty, id.count <= 128,
              id.allSatisfy({ $0.isLetter || $0.isNumber || "-_".contains($0) }) else {
            throw failure("threads_invalid_post_id", "A safe owned Threads post ID is required.")
        }; return id
    }
    static func failure(_ code: String, _ message: String) -> MarketplaceProviderActionAdapterFailure {
        MarketplaceProviderActionAdapterFailure(code: code, message: message, detail: ["automaticRetry": .bool(false)])
    }
}

public struct FakeThreadsProviderActionClient: ThreadsProviderActionClient {
    public init() {}
    public func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        var result = base(request.definition.kind == .draft ? 0 : (request.definition.kind == .write ? 2 : 1))
        let post: JSONRecord = [
            "id": .string("th_post_1"), "text": .string("A useful Threads update."),
            "textTruncated": .bool(false), "mediaType": .string("TEXT_POST"),
            "timestamp": .string("2026-07-12T12:00:00Z"),
            "permalink": .string("https://www.threads.net/@relay_threads/post/example"),
            "shortcode": .string("example"), "isQuotePost": .bool(false),
            "hasReplies": .bool(false), "ownerId": .string("th_123"),
        ]
        switch request.definition.actionKey {
        case "threads_profile_get":
            result["profile"] = .object(["id": .string("th_123"), "username": .string("relay_threads"), "name": .string("Relay Threads"), "isVerified": .bool(true), "biography": .string("Useful profile."), "profilePictureAvailable": .bool(true)])
        case "threads_own_posts_list":
            result["posts"] = .array([.object(post)]); result["resultCount"] = .number(1); result["nextPageFollowed"] = .bool(false)
        case "threads_own_post_get":
            _ = try ThreadsProviderActionSupport.identifier(request.payload["postId"]); result["post"] = .object(post); result["ownershipVerified"] = .bool(true)
        case "threads_text_post_draft":
            let text = try ThreadsProviderActionSupport.text(request); result["text"] = .string(text); result["characterCount"] = .number(Double(text.count)); result["providerCallMade"] = .bool(false)
        case "threads_text_post_publish":
            let text = try ThreadsProviderActionSupport.text(request); result["postId"] = .string("th_published_1"); result["profileId"] = .string("th_123"); result["username"] = .string("relay_threads"); result["text"] = .string(text); result["characterCount"] = .number(Double(text.count));
            result["providerAcknowledged"] = .bool(true); result["ambiguous"] = .bool(false)
        default: throw ThreadsProviderActionSupport.failure("threads_action_not_allowlisted", "Threads V1 permits exactly five actions.")
        }; return result
    }
    private func base(_ requests: Int) -> JSONRecord { [
        "provider": .string("threads"), "fakeAdapter": .bool(true), "simulated": .bool(true),
        "liveCredentialsUsed": .bool(false), "boundProfileOnly": .bool(true), "ownPostsOnly": .bool(true),
        "providerRequestCount": .number(Double(requests)), "automaticRetry": .bool(false),
        "automaticPagination": .bool(false), "redactionStatus": .string("private-state-excluded"),
    ] }
}

public final class LiveThreadsProviderActionClient: ThreadsProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService; private let secrets: SecretService; private let http: any ThreadsProviderHTTPClient
    public init(data: LocalDataService, secrets: SecretService, httpClient: any ThreadsProviderHTTPClient = URLSessionThreadsProviderHTTPClient()) { self.data = data; self.secrets = secrets; self.http = httpClient }
    public func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        if request.definition.actionKey == "threads_text_post_draft" {
            let text = try ThreadsProviderActionSupport.text(request); var result = base(0); result["text"] = .string(text); result["characterCount"] = .number(Double(text.count)); result["providerCallMade"] = .bool(false); return result
        }
        let connection = try readyConnection(request), profileId = try boundProfileId(connection), token = try accessToken(connection)
        var result = base(request.definition.kind == .write ? 2 : 1)
        switch request.definition.actionKey {
        case "threads_profile_get":
            let value = try send(method: "GET", path: "/me", query: ["fields": "id,username,name,is_verified,threads_profile_picture_url,threads_biography"], token: token)
            guard value["id"]?.string == profileId else { throw ThreadsProviderActionSupport.failure("threads_profile_binding_mismatch", "Threads returned a different profile.") }
            result["profile"] = .object(Self.profile(value))
        case "threads_own_posts_list":
            let limit = Self.limit(request.payload["maxResults"]), value = try send(method: "GET", path: "/me/threads", query: ["fields": Self.postFields, "limit": String(limit)], token: token)
            let posts = Self.array(value["data"]).prefix(limit).map(Self.post); result["posts"] = .array(posts.map(JSONValue.object)); result["resultCount"] = .number(Double(posts.count)); result["nextPageFollowed"] = .bool(false)
        case "threads_own_post_get":
            let id = try ThreadsProviderActionSupport.identifier(request.payload["postId"]), value = try send(method: "GET", path: "/\(id)", query: ["fields": Self.postFields], token: token)
            guard Self.object(value["owner"])["id"]?.string == profileId else { throw ThreadsProviderActionSupport.failure("threads_post_not_owned", "The requested post is not owned by the bound profile.") }
            result["post"] = .object(Self.post(.object(value))); result["ownershipVerified"] = .bool(true)
        case "threads_text_post_publish":
            let text = try ThreadsProviderActionSupport.text(request)
            let container = try send(method: "POST", path: "/me/threads", query: ["media_type": "TEXT", "text": text], token: token)
            guard let creationId = container["id"]?.string?.threadsNilIfEmpty else { throw ambiguous("container") }
            let published = try send(method: "POST", path: "/me/threads_publish", query: ["creation_id": creationId], token: token)
            guard let postId = published["id"]?.string?.threadsNilIfEmpty else { throw ambiguous("publish") }
            result["postId"] = .string(postId); result["profileId"] = .string(profileId); result["username"] = connection.health.diagnostics["username"] ?? .null; result["text"] = .string(text); result["characterCount"] = .number(Double(text.count)); result["providerAcknowledged"] = .bool(true);
            result["ambiguous"] = .bool(false)
        default: throw ThreadsProviderActionSupport.failure("threads_live_action_not_allowlisted", "Live Threads execution does not support this action.")
        }; return result
    }
    private func readyConnection(_ request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderConnection {
        guard let id = request.auditIdentity.connectionId?.threadsNilIfEmpty,
              let c = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id),
              c.appId == request.app.id, c.appSlug == "threads", c.status == .connected, c.health.state == .ready,
              c.grantedScopes == ProviderConnectionService.threadsRelayOwnedOAuthScopes,
              c.health.diagnostics["profileVerified"]?.bool == true, c.health.diagnostics["ownPostsOnly"]?.bool == true,
              c.health.diagnostics["plainTextPublishOnly"]?.bool == true, c.health.diagnostics["automaticRetry"]?.bool == false,
              c.health.diagnostics["automaticPagination"]?.bool == false, c.health.diagnostics["rawToolsEnabled"]?.bool == false else {
            throw ThreadsProviderActionSupport.failure("threads_connection_not_ready", "A ready exact-scope Threads profile connection is required.")
        }; return c
    }
    private func boundProfileId(_ c: MarketplaceProviderConnection) throws -> String {
        guard let id = c.health.diagnostics["connectedResourceId"]?.string?.threadsNilIfEmpty,
              id.allSatisfy({ $0.isLetter || $0.isNumber || "-_".contains($0) }) else { throw ThreadsProviderActionSupport.failure("threads_binding_invalid", "The Threads profile binding is invalid.") }; return id
    }
    private func accessToken(_ c: MarketplaceProviderConnection) throws -> String {
        guard let ref = c.credentialRequirements.first(where: { $0.fieldKey == "threads_user_access_token" })?.secretReferenceId,
              let token = try secrets.getSecretValue(ref).threadsNilIfEmpty else { throw ThreadsProviderActionSupport.failure("threads_token_unavailable", "The Threads token is unavailable; reconnect is required.") }; return token
    }
    private func send(method: String, path: String, query: [String: String], token: String) throws -> JSONRecord {
        var parts = URLComponents(string: "https://graph.threads.net" + path); parts?.queryItems = query.sorted { $0.key < $1.key }.map { URLQueryItem(name: $0.key, value: $0.value) }
        guard let url = parts?.url else { throw ThreadsProviderActionSupport.failure("threads_invalid_request", "Threads request construction failed.") }
        let response = try http.send(ThreadsProviderHTTPRequest(method: method, url: url, headers: ["Authorization": "Bearer \(token)", "Accept": "application/json"]))
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(code: Self.errorCode(response.statusCode), message: "Threads API rejected the request.", providerStatusCode: response.statusCode, detail: ["providerBodyPresent": .bool(!response.body.isEmpty), "automaticRetry": .bool(false)])
        }
        guard let object = try JSONSerialization.jsonObject(with: response.body) as? [String: Any] else { throw ThreadsProviderActionSupport.failure("threads_invalid_json", "Threads API returned malformed JSON.") }; return jsonRecord(from: object)
    }
    private func ambiguous(_ stage: String) -> MarketplaceProviderActionAdapterFailure {
        MarketplaceProviderActionAdapterFailure(code: "threads_ambiguous_publish_response", message: "Threads did not return a post id at the \(stage) stage; Relay will not retry.", detail: ["ambiguous": .bool(true), "automaticRetry": .bool(false)])
    }
    private func base(_ count: Int) -> JSONRecord {
        [
            "provider": .string("threads"), "fakeAdapter": .bool(false), "simulated": .bool(false), "liveCredentialsUsed": .bool(true), "boundProfileOnly": .bool(true), "ownPostsOnly": .bool(true), "providerRequestCount": .number(Double(count)), "automaticRetry": .bool(false),
            "automaticPagination": .bool(false), "redactionStatus": .string("private-state-excluded"),
        ]
    }
    private static let postFields = "id,text,media_type,timestamp,permalink,shortcode,is_quote_post,has_replies,owner"
    private static func profile(_ v: JSONRecord) -> JSONRecord {
        let bio = v["threads_biography"]?.string ?? "";
        return [
            "id": scalar(v["id"]), "username": scalar(v["username"], 64), "name": scalar(v["name"]), "isVerified": scalar(v["is_verified"]), "biography": .string(String(bio.prefix(500))), "biographyTruncated": .bool(bio.count > 500),
            "profilePictureAvailable": .bool(v["threads_profile_picture_url"]?.string?.threadsNilIfEmpty != nil),
        ]
    }
    private static func post(_ v: JSONValue) -> JSONRecord {
        let o = object(v), text = o["text"]?.string ?? "", owner = object(o["owner"]);
        return [
            "id": scalar(o["id"]), "text": .string(String(text.prefix(2000))), "textTruncated": .bool(text.count > 2000), "mediaType": scalar(o["media_type"], 32), "timestamp": scalar(o["timestamp"], 64), "permalink": scalar(o["permalink"], 2048), "shortcode": scalar(o["shortcode"], 128),
            "isQuotePost": scalar(o["is_quote_post"]), "hasReplies": scalar(o["has_replies"]), "ownerId": scalar(owner["id"]),
        ]
    }
    private static func limit(_ v: JSONValue?) -> Int { guard let n = v?.number, n.isFinite else { return 10 }; return min(10, max(1, Int(n))) }
    private static func array(_ v: JSONValue?) -> [JSONValue] { if case .array(let a)? = v { return a }; return [] }
    private static func object(_ v: JSONValue?) -> JSONRecord { if case .object(let o)? = v { return o }; return [:] }
    private static func scalar(_ v: JSONValue?, _ max: Int = 512) -> JSONValue { guard let v else { return .null }; if case .string(let s) = v { return .string(String(s.prefix(max))) }; switch v { case .number, .bool, .null: return v; default: return .null } }
    private static func errorCode(_ status: Int) -> String {
        switch status {
        case 400: return "threads_invalid_request";
        case 401: return "threads_invalid_token";
        case 403: return "threads_permission_denied";
        case 429: return "threads_rate_limited";
        default: return status >= 500 ? "threads_provider_unavailable" : "threads_http_error"
        }
    }
}

public struct ThreadsProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = ["threads_profile_get", "threads_own_posts_list", "threads_own_post_get", "threads_text_post_draft", "threads_text_post_publish"]
    private let client: any ThreadsProviderActionClient
    public init(client: any ThreadsProviderActionClient = FakeThreadsProviderActionClient()) { self.client = client }
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "threads", Self.allowed.contains(request.definition.actionKey) else { throw ThreadsProviderActionSupport.failure("threads_action_not_allowlisted", "Threads V1 permits exactly five actions.") }
        let allowedPayload: Set<String>;
        switch request.definition.actionKey {
        case "threads_own_posts_list": allowedPayload = ["maxResults"];
        case "threads_own_post_get": allowedPayload = ["postId"];
        case "threads_text_post_draft", "threads_text_post_publish": allowedPayload = ["text"];
        default: allowedPayload = []
        }
        guard Set(request.payload.keys).isSubset(of: allowedPayload) else {
            throw ThreadsProviderActionSupport.failure("threads_payload_not_supported", "Threads rejects profile overrides, cursors, fields, URLs, media, replies, quotes, polls, tags, locations, scheduling, delete, and raw parameters.")
        }
        return MarketplaceProviderActionAdapterResult(result: try client.execute(request))
    }
}
private extension String { var threadsNilIfEmpty: String? { let value = trimmingCharacters(in: .whitespacesAndNewlines); return value.isEmpty ? nil : value } }
