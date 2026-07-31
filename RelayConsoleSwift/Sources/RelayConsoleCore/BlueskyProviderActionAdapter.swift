import Foundation

public struct BlueskyProviderHTTPRequest: Sendable, Equatable {
    public var method: String
    public var url: URL
    public var headers: [String: String]

    public init(method: String, url: URL, headers: [String: String] = [:]) {
        self.method = method
        self.url = url
        self.headers = headers
    }
}

public struct BlueskyProviderHTTPResponse: Sendable, Equatable {
    public var statusCode: Int
    public var body: Data

    public init(statusCode: Int, body: Data) {
        self.statusCode = statusCode
        self.body = body
    }
}

public protocol BlueskyProviderHTTPClient: Sendable {
    func send(_ request: BlueskyProviderHTTPRequest) throws -> BlueskyProviderHTTPResponse
}

public struct URLSessionBlueskyProviderHTTPClient: BlueskyProviderHTTPClient {
    private let timeoutSeconds: TimeInterval

    public init(timeoutSeconds: TimeInterval = 20) {
        self.timeoutSeconds = timeoutSeconds
    }

    public func send(_ request: BlueskyProviderHTTPRequest) throws -> BlueskyProviderHTTPResponse {
        guard request.url.scheme == "https", request.url.host == "public.api.bsky.app" else {
            throw BlueskyProviderActionSupport.failure(
                "bluesky_public_host_required", "Bluesky V1 public reads use only the fixed public AppView host.")
        }
        var value = URLRequest(url: request.url)
        value.httpMethod = request.method
        value.timeoutInterval = timeoutSeconds
        value.cachePolicy = .reloadIgnoringLocalAndRemoteCacheData
        value.httpShouldHandleCookies = false
        request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) }
        let configuration = URLSessionConfiguration.ephemeral
        configuration.timeoutIntervalForRequest = timeoutSeconds
        configuration.timeoutIntervalForResource = timeoutSeconds
        configuration.httpCookieStorage = nil
        configuration.urlCache = nil
        let session = URLSession(configuration: configuration)
        let semaphore = DispatchSemaphore(value: 0)
        var data: Data?, status: Int?, failure: Error?
        let task = session.dataTask(with: value) { body, response, error in
            data = body; status = (response as? HTTPURLResponse)?.statusCode; failure = error
            semaphore.signal()
        }
        task.resume()
        if semaphore.wait(timeout: .now() + timeoutSeconds) == .timedOut {
            task.cancel(); session.invalidateAndCancel()
            throw BlueskyProviderActionSupport.failure(
                "bluesky_http_timeout", "Bluesky AppView request timed out without retry.")
        }
        session.finishTasksAndInvalidate()
        if failure != nil {
            throw BlueskyProviderActionSupport.failure(
                "bluesky_network_error", "Bluesky AppView request failed before a response was received.")
        }
        return BlueskyProviderHTTPResponse(statusCode: status ?? 0, body: data ?? Data())
    }
}

public protocol BlueskyProviderActionClient: Sendable {
    func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord
}

public enum BlueskyProviderActionSupport {
    static let actions: Set<String> = [
        "bluesky_profile_get", "bluesky_own_posts_list",
        "bluesky_text_post_draft", "bluesky_text_post_publish",
    ]

    static func text(_ request: MarketplaceProviderActionAdapterRequest) throws -> String {
        guard let text = request.payload["text"]?.string?.blueskyNilIfEmpty else {
            throw failure("bluesky_missing_text", "Bluesky text actions require non-empty text.")
        }
        guard text.count <= 300 else {
            throw failure("bluesky_text_too_long", "Bluesky V1 text is limited to 300 graphemes.")
        }
        return text
    }

    static func limit(_ value: JSONValue?) -> Int {
        guard let number = value?.number, number.isFinite else { return 10 }
        return min(10, max(1, Int(number)))
    }

    static func failure(_ code: String, _ message: String) -> MarketplaceProviderActionAdapterFailure {
        MarketplaceProviderActionAdapterFailure(
            code: code, message: message,
            detail: ["automaticRetry": .bool(false), "automaticPagination": .bool(false)])
    }
}

public struct FakeBlueskyProviderActionClient: BlueskyProviderActionClient {
    public init() {}

    public func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        var result = base(request.definition.kind == .draft ? 0 : 1)
        let did = "did:plc:abcdefghijklmnopqrstuvwx"
        switch request.definition.actionKey {
        case "bluesky_profile_get":
            result["profile"] = .object([
                "did": .string(did), "handle": .string("relay-agent.bsky.social"),
                "displayName": .string("Relay Agent"), "description": .string("A useful Bluesky profile."),
                "avatarURL": .string("https://cdn.bsky.app/img/avatar/plain/example"),
                "followersCount": .number(12), "followsCount": .number(8), "postsCount": .number(21),
            ])
        case "bluesky_own_posts_list":
            let limit = BlueskyProviderActionSupport.limit(request.payload["maxResults"])
            let post: JSONRecord = [
                "uri": .string("at://\(did)/app.bsky.feed.post/3example"),
                "cid": .string("bafyreiexample"), "text": .string("A useful Bluesky update."),
                "createdAt": .string("2026-07-12T17:00:00Z"),
                "canonicalURL": .string("https://bsky.app/profile/\(did)/post/3example"),
            ]
            result["posts"] = .array(limit > 0 ? [.object(post)] : [])
            result["resultCount"] = .number(limit > 0 ? 1 : 0)
            result["nextPageFollowed"] = .bool(false)
        case "bluesky_text_post_draft":
            let text = try BlueskyProviderActionSupport.text(request)
            result["text"] = .string(text); result["graphemeCount"] = .number(Double(text.count))
            result["providerCallMade"] = .bool(false)
        case "bluesky_text_post_publish":
            let text = try BlueskyProviderActionSupport.text(request)
            result["uri"] = .string("at://\(did)/app.bsky.feed.post/3published")
            result["cid"] = .string("bafyreipublished")
            result["canonicalURL"] = .string("https://bsky.app/profile/\(did)/post/3published")
            result["did"] = .string(did); result["text"] = .string(text)
            result["createdAt"] = .string("2026-07-12T17:00:00Z")
            result["graphemeCount"] = .number(Double(text.count))
            result["providerAcknowledged"] = .bool(true); result["ambiguous"] = .bool(false)
            result["idempotencyKey"] = .string(request.idempotencyKey)
        default:
            throw BlueskyProviderActionSupport.failure(
                "bluesky_action_not_allowlisted", "Bluesky V1 permits exactly four actions.")
        }
        return result
    }

    private func base(_ requestCount: Int) -> JSONRecord {
        [
            "provider": .string("bluesky"), "fakeAdapter": .bool(true), "simulated": .bool(true),
            "liveCredentialsUsed": .bool(false), "boundDIDOnly": .bool(true),
            "ownOriginalPostsOnly": .bool(true), "providerRequestCount": .number(Double(requestCount)),
            "automaticRetry": .bool(false), "automaticPagination": .bool(false),
            "redactionStatus": .string("private-state-excluded"),
        ]
    }
}

public final class RailwayBlueskyProviderActionClient: BlueskyProviderActionClient, @unchecked Sendable {
    private let cloudSync: CloudRelaySyncService

    public init(cloudSync: CloudRelaySyncService) {
        self.cloudSync = cloudSync
    }

    public func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        guard let localConnectionId = request.auditIdentity.connectionId?.blueskyNilIfEmpty,
              let localAgentId = request.auditIdentity.agentId?.blueskyNilIfEmpty else {
            throw BlueskyProviderActionSupport.failure(
                "bluesky_railway_identity_missing",
                "Bluesky Railway execution requires a synchronized connection and agent install.")
        }
        let remoteConnectionId = try cloudSync.remoteMarketplaceConnectionId(
            localWorkspaceId: request.context.workspaceId,
            localConnectionId: localConnectionId)
        let remoteAgentId = try cloudSync.remoteMarketplaceAgentId(
            localWorkspaceId: request.context.workspaceId,
            localAgentId: localAgentId)
        let wrapper = try Self.wrapperName(request.definition.actionKey)
        var payload = Self.foundationObject(request.payload)
        if let maxResults = payload.removeValue(forKey: "maxResults") {
            payload["limit"] = maxResults
        }
        let response = try cloudSync.railwayMarketplaceRequestSync(
            localWorkspaceId: request.context.workspaceId,
            method: "POST",
            relativePath: "connectors/bluesky/connections/\(remoteConnectionId)/actions/\(wrapper)",
            body: ["agentId": remoteAgentId, "payload": payload])
        guard response["ok"] as? Bool == true else {
            let error = response["error"] as? [String: Any]
            throw BlueskyProviderActionSupport.failure(
                (error?["code"] as? String) ?? "bluesky_railway_action_failed",
                (error?["message"] as? String) ?? "Railway rejected the Bluesky action.")
        }
        let data = response["data"] as? [String: Any] ?? [:]
        var result = Self.jsonRecord(data)
        if request.definition.actionKey == "bluesky_profile_get" {
            result = ["profile": .object(result)]
        }
        result.merge(base(request.definition.kind == .draft ? 0 : 1)) { current, _ in current }
        if let summary = response["safeSummary"] as? String {
            result["safeSummary"] = .string(summary)
        }
        return result
    }

    private static func wrapperName(_ actionKey: String) throws -> String {
        switch actionKey {
        case "bluesky_profile_get": return "relay_bluesky_get_profile"
        case "bluesky_own_posts_list": return "relay_bluesky_list_own_posts"
        case "bluesky_text_post_draft": return "relay_bluesky_draft_text_post"
        case "bluesky_text_post_publish": return "relay_bluesky_publish_text_post"
        default:
            throw BlueskyProviderActionSupport.failure(
                "bluesky_action_not_allowlisted", "Bluesky V1 permits exactly four actions.")
        }
    }

    private func base(_ providerRequestCount: Int) -> JSONRecord {
        [
            "provider": .string("bluesky"), "fakeAdapter": .bool(false), "simulated": .bool(false),
            "liveCredentialsUsed": .bool(true), "boundDIDOnly": .bool(true),
            "ownOriginalPostsOnly": .bool(true), "providerRequestCount": .number(Double(providerRequestCount)),
            "automaticRetry": .bool(false), "automaticPagination": .bool(false),
            "railwayBrokered": .bool(true), "redactionStatus": .string("provider-content-not-stored"),
        ]
    }

    private static func foundationObject(_ record: JSONRecord) -> [String: Any] {
        record.mapValues(foundationValue)
    }

    private static func foundationValue(_ value: JSONValue) -> Any {
        switch value {
        case .string(let value): return value
        case .number(let value): return value
        case .bool(let value): return value
        case .array(let value): return value.map(foundationValue)
        case .object(let value): return foundationObject(value)
        case .null: return NSNull()
        }
    }

    private static func jsonRecord(_ object: [String: Any]) -> JSONRecord {
        object.mapValues(jsonValue)
    }

    private static func jsonValue(_ value: Any) -> JSONValue {
        if value is NSNull { return .null }
        if let value = value as? String { return .string(value) }
        if let value = value as? Bool { return .bool(value) }
        if let value = value as? NSNumber { return .number(value.doubleValue) }
        if let value = value as? [String: Any] { return .object(jsonRecord(value)) }
        if let value = value as? [Any] { return .array(value.map(jsonValue)) }
        return .null
    }
}

public final class LiveBlueskyProviderActionClient: BlueskyProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService
    private let http: any BlueskyProviderHTTPClient

    public init(
        data: LocalDataService,
        httpClient: any BlueskyProviderHTTPClient = URLSessionBlueskyProviderHTTPClient()
    ) {
        self.data = data
        self.http = httpClient
    }

    public func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        if request.definition.actionKey == "bluesky_text_post_draft" {
            let text = try BlueskyProviderActionSupport.text(request)
            var result = base(0)
            result["text"] = .string(text); result["graphemeCount"] = .number(Double(text.count))
            result["providerCallMade"] = .bool(false)
            return result
        }
        let connection = try readyConnection(request)
        let did = try boundDID(connection)
        var result = base(1)
        switch request.definition.actionKey {
        case "bluesky_profile_get":
            let value = try get("app.bsky.actor.getProfile", query: ["actor": did])
            guard value["did"]?.string == did else {
                throw BlueskyProviderActionSupport.failure(
                    "bluesky_profile_binding_mismatch", "Bluesky returned a profile for a different DID.")
            }
            result["profile"] = .object(Self.profile(value))
        case "bluesky_own_posts_list":
            let limit = BlueskyProviderActionSupport.limit(request.payload["maxResults"])
            let value = try get("app.bsky.feed.getAuthorFeed", query: [
                "actor": did, "filter": "posts_no_replies", "limit": String(limit),
            ])
            let posts = Self.feed(value["feed"], did: did).prefix(limit)
            result["posts"] = .array(posts.map(JSONValue.object))
            result["resultCount"] = .number(Double(posts.count)); result["nextPageFollowed"] = .bool(false)
        case "bluesky_text_post_publish":
            _ = try BlueskyProviderActionSupport.text(request)
            throw BlueskyProviderActionSupport.failure(
                "bluesky_publish_requires_railway_oauth_broker",
                "Bluesky DPoP publishing is unavailable until the authenticated Railway OAuth broker is deployed.")
        default:
            throw BlueskyProviderActionSupport.failure(
                "bluesky_live_action_not_allowlisted", "Live Bluesky execution does not support this action.")
        }
        return result
    }

    private func readyConnection(_ request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderConnection {
        guard let id = request.auditIdentity.connectionId?.blueskyNilIfEmpty,
              let connection = try data.getProviderConnection(
                workspaceId: request.context.workspaceId, connectionId: id),
              connection.appId == request.app.id, connection.appSlug == "bluesky",
              connection.status == .connected, connection.health.state == .ready,
              connection.grantedScopes == ProviderConnectionService.blueskyRelayOwnedOAuthScopes,
              connection.health.diagnostics["didVerified"]?.bool == true,
              connection.health.diagnostics["pdsVerified"]?.bool == true,
              connection.health.diagnostics["issuerVerified"]?.bool == true,
              connection.health.diagnostics["dpopBound"]?.bool == true,
              connection.health.diagnostics["ownOriginalPostsOnly"]?.bool == true,
              connection.health.diagnostics["textOnlyCreate"]?.bool == true,
              connection.health.diagnostics["automaticRetry"]?.bool == false,
              connection.health.diagnostics["automaticPagination"]?.bool == false,
              connection.health.diagnostics["rawToolsEnabled"]?.bool == false else {
            throw BlueskyProviderActionSupport.failure(
                "bluesky_connection_not_ready", "A ready exact-scope DID-bound Bluesky connection is required.")
        }
        return connection
    }

    private func boundDID(_ connection: MarketplaceProviderConnection) throws -> String {
        guard let did = connection.health.diagnostics["did"]?.string?.blueskyNilIfEmpty,
              did.hasPrefix("did:") else {
            throw BlueskyProviderActionSupport.failure(
                "bluesky_bound_did_missing", "The Bluesky connection has no verified bound DID.")
        }
        return did
    }

    private func get(_ method: String, query: [String: String]) throws -> JSONRecord {
        var components = URLComponents(string: "https://public.api.bsky.app/xrpc/\(method)")!
        components.queryItems = query.sorted { $0.key < $1.key }.map(URLQueryItem.init)
        let response = try http.send(BlueskyProviderHTTPRequest(method: "GET", url: components.url!))
        guard (200..<300).contains(response.statusCode),
              let object = try? JSONSerialization.jsonObject(with: response.body) as? [String: Any] else {
            throw BlueskyProviderActionSupport.failure(
                Self.errorCode(response.statusCode), "Bluesky AppView rejected the bounded read request.")
        }
        return Self.jsonRecord(object)
    }

    private func base(_ count: Int) -> JSONRecord {
        [
            "provider": .string("bluesky"), "fakeAdapter": .bool(false), "simulated": .bool(false),
            "liveCredentialsUsed": .bool(false), "boundDIDOnly": .bool(true),
            "ownOriginalPostsOnly": .bool(true), "providerRequestCount": .number(Double(count)),
            "automaticRetry": .bool(false), "automaticPagination": .bool(false),
            "redactionStatus": .string("provider-content-not-stored"),
        ]
    }

    private static func profile(_ value: JSONRecord) -> JSONRecord {
        [
            "did": scalar(value["did"], 2048), "handle": scalar(value["handle"], 253),
            "displayName": scalar(value["displayName"], 256),
            "description": scalar(value["description"], 1000),
            "avatarURL": scalar(value["avatar"], 2048),
            "followersCount": scalar(value["followersCount"]),
            "followsCount": scalar(value["followsCount"]), "postsCount": scalar(value["postsCount"]),
        ]
    }

    private static func feed(_ value: JSONValue?, did: String) -> [JSONRecord] {
        guard case .array(let items)? = value else { return [] }
        return items.compactMap { entry in
            guard case .object(let item) = entry, item["reason"] == nil,
                  case .object(let post)? = item["post"],
                  case .object(let author)? = post["author"], author["did"]?.string == did,
                  case .object(let record)? = post["record"], record["reply"] == nil,
                  record["embed"] == nil, let text = record["text"]?.string?.blueskyNilIfEmpty,
                  let uri = post["uri"]?.string?.blueskyNilIfEmpty,
                  let cid = post["cid"]?.string?.blueskyNilIfEmpty,
                  let rkey = uri.split(separator: "/").last else { return nil }
            return [
                "uri": .string(uri), "cid": .string(cid), "text": .string(String(text.prefix(300))),
                "createdAt": scalar(record["createdAt"], 64),
                "canonicalURL": .string("https://bsky.app/profile/\(did)/post/\(rkey)"),
            ]
        }
    }

    private static func scalar(_ value: JSONValue?, _ max: Int = 512) -> JSONValue {
        guard let value else { return .null }
        if case .string(let string) = value { return .string(String(string.prefix(max))) }
        switch value { case .number, .bool, .null: return value; default: return .null }
    }

    private static func errorCode(_ status: Int) -> String {
        switch status {
        case 400: return "bluesky_invalid_request"
        case 401: return "bluesky_invalid_token"
        case 403: return "bluesky_permission_denied"
        case 429: return "bluesky_rate_limited"
        default: return status >= 500 ? "bluesky_provider_unavailable" : "bluesky_http_error"
        }
    }

    private static func jsonRecord(_ object: [String: Any]) -> JSONRecord {
        object.mapValues(jsonValue)
    }

    private static func jsonValue(_ value: Any) -> JSONValue {
        if value is NSNull { return .null }
        if let value = value as? String { return .string(value) }
        if let value = value as? Bool { return .bool(value) }
        if let value = value as? NSNumber { return .number(value.doubleValue) }
        if let value = value as? [String: Any] { return .object(jsonRecord(value)) }
        if let value = value as? [Any] { return .array(value.map(jsonValue)) }
        return .null
    }
}

public struct BlueskyProviderActionAdapter: MarketplaceProviderActionAdapter {
    private let client: any BlueskyProviderActionClient

    public init(client: any BlueskyProviderActionClient = FakeBlueskyProviderActionClient()) {
        self.client = client
    }

    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "bluesky",
              BlueskyProviderActionSupport.actions.contains(request.definition.actionKey) else {
            throw BlueskyProviderActionSupport.failure(
                "bluesky_action_not_allowlisted", "Bluesky V1 permits exactly four actions.")
        }
        let allowedPayload: Set<String>
        switch request.definition.actionKey {
        case "bluesky_own_posts_list": allowedPayload = ["maxResults"]
        case "bluesky_text_post_draft", "bluesky_text_post_publish": allowedPayload = ["text"]
        default: allowedPayload = []
        }
        guard Set(request.payload.keys).isSubset(of: allowedPayload) else {
            throw BlueskyProviderActionSupport.failure(
                "bluesky_payload_not_supported",
                "Bluesky rejects actor overrides, cursors, replies, quotes, reposts, engagement, media, embeds, facets, languages, labels, scheduling, edit, delete, moderation, firehose, and raw parameters.")
        }
        return MarketplaceProviderActionAdapterResult(
            result: try client.execute(request), persistResult: request.definition.kind == .write)
    }
}

private extension String {
    var blueskyNilIfEmpty: String? {
        let value = trimmingCharacters(in: .whitespacesAndNewlines)
        return value.isEmpty ? nil : value
    }
}
