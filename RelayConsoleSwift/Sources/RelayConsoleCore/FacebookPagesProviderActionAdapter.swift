import Foundation

public struct FacebookPagesProviderActionClientResult: Codable, Equatable, Sendable {
    public var result: JSONRecord
    public init(result: JSONRecord) { self.result = result }
}

public protocol FacebookPagesProviderActionClient: Sendable {
    func executeFacebookPagesAction(
        request: MarketplaceProviderActionAdapterRequest
    ) throws -> FacebookPagesProviderActionClientResult
}

public struct FacebookPagesProviderHTTPRequest: Sendable, Equatable {
    public var method: String
    public var url: URL
    public var headers: [String: String]
    public var body: Data?
    public init(method: String, url: URL, headers: [String: String], body: Data? = nil) {
        self.method = method; self.url = url; self.headers = headers; self.body = body
    }
}

public struct FacebookPagesProviderHTTPResponse: Sendable, Equatable {
    public var statusCode: Int
    public var body: Data
    public init(statusCode: Int, body: Data) { self.statusCode = statusCode; self.body = body }
}

public protocol FacebookPagesProviderHTTPClient: Sendable {
    func send(_ request: FacebookPagesProviderHTTPRequest) throws -> FacebookPagesProviderHTTPResponse
}

public struct URLSessionFacebookPagesProviderHTTPClient: FacebookPagesProviderHTTPClient {
    private let timeoutSeconds: TimeInterval
    public init(timeoutSeconds: TimeInterval = 20) { self.timeoutSeconds = timeoutSeconds }

    public func send(
        _ request: FacebookPagesProviderHTTPRequest
    ) throws -> FacebookPagesProviderHTTPResponse {
        var value = URLRequest(url: request.url)
        value.httpMethod = request.method
        value.timeoutInterval = timeoutSeconds
        value.httpBody = request.body
        request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) }
        let semaphore = DispatchSemaphore(value: 0)
        var data: Data?, status: Int?, failure: Error?
        let task = URLSession.shared.dataTask(with: value) { responseData, response, error in
            data = responseData
            status = (response as? HTTPURLResponse)?.statusCode
            failure = error
            semaphore.signal()
        }
        task.resume()
        if semaphore.wait(timeout: .now() + timeoutSeconds) == .timedOut {
            task.cancel()
            throw MarketplaceProviderActionAdapterFailure(
                code: "facebook_pages_http_timeout",
                message: "Facebook Pages API request timed out without retry.",
                detail: ["automaticRetry": .bool(false)])
        }
        if failure != nil {
            throw MarketplaceProviderActionAdapterFailure(
                code: "facebook_pages_network_error",
                message: "Facebook Pages API request failed before a response was received.",
                detail: ["automaticRetry": .bool(false)])
        }
        return FacebookPagesProviderHTTPResponse(statusCode: status ?? 0, body: data ?? Data())
    }
}

public struct FakeFacebookPagesProviderActionClient: FacebookPagesProviderActionClient {
    private let failureByActionKey: [String: MarketplaceProviderActionAdapterFailure]
    public init(
        failureByActionKey: [String: MarketplaceProviderActionAdapterFailure] = [:]
    ) { self.failureByActionKey = failureByActionKey }

    public func executeFacebookPagesAction(
        request: MarketplaceProviderActionAdapterRequest
    ) throws -> FacebookPagesProviderActionClientResult {
        if let failure = failureByActionKey[request.definition.actionKey] { throw failure }
        var result = Self.base(request)
        switch request.definition.actionKey {
        case "facebook_pages_page_get":
            result["page"] = .object([
                "id": .string("page_456"), "name": .string("Relay Test Page"),
                "link": .string("https://www.facebook.com/relaytest"),
                "category": .string("Software"), "pictureAvailable": .bool(true),
            ])
        case "facebook_pages_own_posts_list":
            result["posts"] = .array([.object([
                "id": .string("page_456_post_1"),
                "message": .string("A useful Page-authored launch update."),
                "createdTime": .string("2026-07-12T10:00:00Z"),
                "permalinkURL": .string("https://www.facebook.com/relaytest/posts/1"),
                "isPublished": .bool(true), "messageTruncated": .bool(false),
            ])])
            result["resultCount"] = .number(1)
            result["nextPageFollowed"] = .bool(false)
        case "facebook_pages_post_draft":
            let message = try Self.message(request)
            result["message"] = .string(message)
            result["characterCount"] = .number(Double(message.count))
            result["providerCallMade"] = .bool(false)
        case "facebook_pages_text_post_create":
            let message = try Self.message(request)
            result["postId"] = .string("page_456_\(Self.suffix(message + request.idempotencyKey))")
            result["pageId"] = .string("page_456")
            result["pageName"] = .string("Relay Test Page")
            result["providerAcknowledged"] = .bool(true)
            result["ambiguous"] = .bool(false)
        default:
            throw MarketplaceProviderActionAdapterFailure(
                code: "facebook_pages_action_not_allowlisted",
                message: "The requested Facebook Pages action is not in the V1 allowlist.")
        }
        return FacebookPagesProviderActionClientResult(result: result)
    }

    static func message(_ request: MarketplaceProviderActionAdapterRequest) throws -> String {
        guard let message = request.payload["message"]?.string?
            .trimmingCharacters(in: .whitespacesAndNewlines), !message.isEmpty else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "facebook_pages_missing_message",
                message: "Facebook Pages text actions require a non-empty message.")
        }
        guard message.count <= 5000 else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "facebook_pages_message_too_long",
                message: "Facebook Pages V1 messages are limited to 5,000 characters.")
        }
        guard message.range(
            of: #"(?i)(https?://|www\.|\b[a-z0-9-]+\.(com|org|net|io|co|app|dev)\b)"#,
            options: .regularExpression) == nil else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "facebook_pages_url_not_supported",
                message: "Facebook Pages V1 permits plain-text posts without URLs only.")
        }
        return message
    }

    static func base(_ request: MarketplaceProviderActionAdapterRequest) -> JSONRecord {
        [
            "provider": .string("facebook-pages"), "fakeAdapter": .bool(true),
            "simulated": .bool(true), "liveCredentialsUsed": .bool(false),
            "selectedPageOnly": .bool(true), "pageAuthoredPostsOnly": .bool(true),
            "providerRequestCount": .number(request.definition.kind == .draft ? 0 : 1),
            "automaticRetry": .bool(false), "automaticPagination": .bool(false),
            "payloadHash": .string(MarketplaceProviderActionApprovalService.payloadHash(request.payload)),
            "redactionStatus": .string("private-state-excluded"),
        ]
    }

    static func suffix(_ value: String) -> String {
        var hash: UInt64 = 1469598103934665603
        value.utf8.forEach { hash ^= UInt64($0); hash &*= 1099511628211 }
        return String(String(hash, radix: 16).suffix(10))
    }
}

public final class LiveFacebookPagesProviderActionClient:
    FacebookPagesProviderActionClient, @unchecked Sendable
{
    private let data: LocalDataService
    private let secrets: SecretService
    private let http: any FacebookPagesProviderHTTPClient
    public init(
        data: LocalDataService, secrets: SecretService,
        httpClient: any FacebookPagesProviderHTTPClient = URLSessionFacebookPagesProviderHTTPClient()
    ) { self.data = data; self.secrets = secrets; self.http = httpClient }

    public func executeFacebookPagesAction(
        request: MarketplaceProviderActionAdapterRequest
    ) throws -> FacebookPagesProviderActionClientResult {
        if request.definition.actionKey == "facebook_pages_post_draft" {
            let message = try FakeFacebookPagesProviderActionClient.message(request)
            var result = base(request, providerRequests: 0)
            result["message"] = .string(message)
            result["characterCount"] = .number(Double(message.count))
            result["providerCallMade"] = .bool(false)
            return FacebookPagesProviderActionClientResult(result: result)
        }
        let connection = try readyConnection(request)
        let pageId = try boundPageId(connection)
        let token = try pageToken(connection)
        switch request.definition.actionKey {
        case "facebook_pages_page_get":
            let response = try send(
                method: "GET", path: "/\(pageId)",
                query: ["fields": "id,name,link,category,picture"], body: nil, token: token)
            var result = base(request, providerRequests: 1)
            result["page"] = .object(Self.page(response))
            return FacebookPagesProviderActionClientResult(result: result)
        case "facebook_pages_own_posts_list":
            let limit = Self.limit(request.payload["maxResults"])
            let response = try send(
                method: "GET", path: "/\(pageId)/posts",
                query: [
                    "fields": "id,message,created_time,permalink_url,is_published",
                    "limit": String(limit),
                ], body: nil, token: token)
            let posts = Self.array(response["data"]).prefix(limit).map(Self.post)
            var result = base(request, providerRequests: 1)
            result["posts"] = .array(posts.map(JSONValue.object))
            result["resultCount"] = .number(Double(posts.count))
            result["nextPageFollowed"] = .bool(false)
            return FacebookPagesProviderActionClientResult(result: result)
        case "facebook_pages_text_post_create":
            let message = try FakeFacebookPagesProviderActionClient.message(request)
            let body = "message=" + Self.formEncode(message)
            let response = try send(
                method: "POST", path: "/\(pageId)/feed", query: [:],
                body: Data(body.utf8), token: token)
            guard let postId = response["id"]?.string?.facebookPagesNilIfEmpty else {
                throw MarketplaceProviderActionAdapterFailure(
                    code: "facebook_pages_ambiguous_create_response",
                    message: "Meta did not return a post id; Relay will not retry this ambiguous write.",
                    detail: ["automaticRetry": .bool(false), "ambiguous": .bool(true)])
            }
            var result = base(request, providerRequests: 1)
            result["postId"] = .string(postId)
            result["pageId"] = .string(pageId)
            result["pageName"] = connection.health.diagnostics["selectedPageName"] ?? .null
            result["providerAcknowledged"] = .bool(true)
            result["ambiguous"] = .bool(false)
            return FacebookPagesProviderActionClientResult(result: result)
        default:
            throw MarketplaceProviderActionAdapterFailure(
                code: "facebook_pages_live_action_not_allowlisted",
                message: "Live Facebook Pages execution does not support this action.")
        }
    }

    private func readyConnection(
        _ request: MarketplaceProviderActionAdapterRequest
    ) throws -> MarketplaceProviderConnection {
        guard let id = request.auditIdentity.connectionId?.facebookPagesNilIfEmpty,
              let connection = try data.getProviderConnection(
                workspaceId: request.context.workspaceId, connectionId: id),
              connection.appId == request.app.id, connection.appSlug == "facebook-pages",
              connection.status == .connected, connection.health.state == .ready,
              connection.grantedScopes == ProviderConnectionService.facebookPagesRelayOwnedOAuthScopes,
              connection.health.diagnostics["selectedPageVerified"]?.bool == true,
              connection.health.diagnostics["pageAuthoredPostsOnly"]?.bool == true,
              connection.health.diagnostics["automaticRetry"]?.bool == false,
              connection.health.diagnostics["automaticPagination"]?.bool == false,
              connection.health.diagnostics["rawToolsEnabled"]?.bool == false else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "facebook_pages_connection_not_ready",
                message: "A ready exact-permission selected-Page connection is required.")
        }
        return connection
    }

    private func boundPageId(_ connection: MarketplaceProviderConnection) throws -> String {
        guard let value = connection.health.diagnostics["selectedPageId"]?.string?.facebookPagesNilIfEmpty,
              value.allSatisfy({ $0.isLetter || $0.isNumber || "-_".contains($0) }) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "facebook_pages_binding_invalid",
                message: "The selected Facebook Page binding is invalid.")
        }
        return value
    }

    private func pageToken(_ connection: MarketplaceProviderConnection) throws -> String {
        guard let ref = connection.credentialRequirements.first(where: {
            $0.fieldKey == "facebook_pages_page_access_token"
        })?.secretReferenceId,
              let token = try secrets.getSecretValue(ref).facebookPagesNilIfEmpty else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "facebook_pages_page_token_unavailable",
                message: "The selected Facebook Page token is unavailable; reconnect is required.")
        }
        return token
    }

    private func send(
        method: String, path: String, query: [String: String], body: Data?, token: String
    ) throws -> JSONRecord {
        var components = URLComponents(string: "https://graph.facebook.com/v25.0" + path)
        components?.queryItems = query.sorted { $0.key < $1.key }.map {
            URLQueryItem(name: $0.key, value: $0.value)
        }
        guard let url = components?.url else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "facebook_pages_invalid_request", message: "Facebook Pages request was invalid.")
        }
        var headers = ["Authorization": "Bearer \(token)", "Accept": "application/json"]
        if body != nil { headers["Content-Type"] = "application/x-www-form-urlencoded; charset=utf-8" }
        let response = try http.send(FacebookPagesProviderHTTPRequest(
            method: method, url: url, headers: headers, body: body))
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: Self.errorCode(response.statusCode),
                message: "Facebook Pages API rejected the request.",
                providerStatusCode: response.statusCode,
                detail: [
                    "providerBodyPresent": .bool(!response.body.isEmpty),
                    "automaticRetry": .bool(false),
                ])
        }
        guard let object = try JSONSerialization.jsonObject(with: response.body) as? [String: Any] else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "facebook_pages_invalid_json",
                message: "Facebook Pages API returned a malformed response.")
        }
        return jsonRecord(from: object)
    }

    private func base(
        _ request: MarketplaceProviderActionAdapterRequest, providerRequests: Int
    ) -> JSONRecord {
        [
            "provider": .string("facebook-pages"), "fakeAdapter": .bool(false),
            "simulated": .bool(false), "liveCredentialsUsed": .bool(true),
            "selectedPageOnly": .bool(true), "pageAuthoredPostsOnly": .bool(true),
            "providerRequestCount": .number(Double(providerRequests)),
            "automaticRetry": .bool(false), "automaticPagination": .bool(false),
            "redactionStatus": .string("private-state-excluded"),
        ]
    }

    private static func page(_ value: JSONRecord) -> JSONRecord {
        let picture = object(value["picture"]), data = object(picture["data"])
        return [
            "id": scalar(value["id"]), "name": scalar(value["name"], maximum: 512),
            "link": scalar(value["link"], maximum: 2048),
            "category": scalar(value["category"], maximum: 256),
            "pictureAvailable": .bool(data["url"]?.string?.facebookPagesNilIfEmpty != nil),
        ]
    }

    private static func post(_ value: JSONValue) -> JSONRecord {
        let object = object(value), raw = object["message"]?.string ?? ""
        return [
            "id": scalar(object["id"]), "message": .string(String(raw.prefix(2000))),
            "createdTime": scalar(object["created_time"]),
            "permalinkURL": scalar(object["permalink_url"], maximum: 2048),
            "isPublished": scalar(object["is_published"]),
            "messageTruncated": .bool(raw.count > 2000),
        ]
    }

    private static func limit(_ value: JSONValue?) -> Int {
        guard let number = value?.number, number.isFinite else { return 10 }
        return min(10, max(1, Int(number)))
    }
    private static func array(_ value: JSONValue?) -> [JSONValue] {
        if case .array(let items)? = value { return items }; return []
    }
    private static func object(_ value: JSONValue?) -> JSONRecord {
        if case .object(let record)? = value { return record }; return [:]
    }
    private static func scalar(_ value: JSONValue?, maximum: Int = 512) -> JSONValue {
        guard let value else { return .null }
        if case .string(let text) = value { return .string(String(text.prefix(maximum))) }
        switch value { case .number, .bool, .null: return value; default: return .null }
    }
    private static func formEncode(_ value: String) -> String {
        value.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? ""
    }
    private static func errorCode(_ status: Int) -> String {
        switch status {
        case 400: return "facebook_pages_invalid_request"
        case 401: return "facebook_pages_invalid_token"
        case 403: return "facebook_pages_permission_denied"
        case 429: return "facebook_pages_rate_limited"
        default: return status >= 500 ? "facebook_pages_provider_unavailable" : "facebook_pages_http_error"
        }
    }
}

public struct FacebookPagesProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = [
        "facebook_pages_page_get", "facebook_pages_own_posts_list",
        "facebook_pages_post_draft", "facebook_pages_text_post_create",
    ]
    private let client: any FacebookPagesProviderActionClient
    public init(
        client: any FacebookPagesProviderActionClient = FakeFacebookPagesProviderActionClient()
    ) { self.client = client }

    public func execute(
        request: MarketplaceProviderActionAdapterRequest
    ) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "facebook-pages", Self.allowed.contains(request.definition.actionKey) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "facebook_pages_action_not_allowlisted",
                message: "Facebook Pages V1 permits exactly four selected-Page actions.")
        }
        let allowedPayload: Set<String>
        switch request.definition.actionKey {
        case "facebook_pages_own_posts_list": allowedPayload = ["maxResults"]
        case "facebook_pages_post_draft", "facebook_pages_text_post_create": allowedPayload = ["message"]
        default: allowedPayload = []
        }
        guard Set(request.payload.keys).isSubset(of: allowedPayload) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "facebook_pages_payload_not_supported",
                message: "Facebook Pages V1 rejects arbitrary Page IDs, URLs, media, targeting, scheduling, cursors, and raw fields.")
        }
        let output = try client.executeFacebookPagesAction(request: request)
        return MarketplaceProviderActionAdapterResult(result: output.result)
    }
}

private extension String {
    var facebookPagesNilIfEmpty: String? {
        let value = trimmingCharacters(in: .whitespacesAndNewlines)
        return value.isEmpty ? nil : value
    }
}
