import Foundation

public struct MarketplaceProviderActionAdapterFailure: Error, CustomStringConvertible, Sendable, Equatable {
    public var code: String
    public var message: String
    public var providerStatusCode: Int?
    public var detail: JSONRecord
    public var redactionStatus: String

    public init(
        code: String,
        message: String,
        providerStatusCode: Int? = nil,
        detail: JSONRecord = [:],
        redactionStatus: String = "private-state-excluded"
    ) {
        self.code = code
        self.message = message
        self.providerStatusCode = providerStatusCode
        self.detail = detail
        self.redactionStatus = redactionStatus
    }

    public var description: String {
        "\(code): \(message)"
    }

    public var providerErrorRecord: JSONRecord {
        var record: JSONRecord = [
            "providerErrorCode": .string(code),
            "message": .string(message),
            "redactionStatus": .string(redactionStatus)
        ]
        if let providerStatusCode {
            record["providerStatusCode"] = .number(Double(providerStatusCode))
        }
        if !detail.isEmpty {
            record["detail"] = .object(detail)
        }
        return record
    }
}

public struct XProviderActionClientResult: Codable, Equatable, Sendable {
    public var result: JSONRecord
    public var redactionStatus: String

    public init(result: JSONRecord, redactionStatus: String = "private-state-excluded") {
        self.result = result
        self.redactionStatus = redactionStatus
    }
}

public protocol XProviderActionClient: Sendable {
    func executeXAction(request: MarketplaceProviderActionAdapterRequest) throws -> XProviderActionClientResult
}

public struct XProviderHTTPRequest: Sendable, Equatable {
    public var method: String
    public var url: URL
    public var headers: [String: String]
    public var body: Data?

    public init(method: String, url: URL, headers: [String: String] = [:], body: Data? = nil) {
        self.method = method
        self.url = url
        self.headers = headers
        self.body = body
    }
}

public struct XProviderHTTPResponse: Sendable, Equatable {
    public var statusCode: Int
    public var body: Data

    public init(statusCode: Int, body: Data) {
        self.statusCode = statusCode
        self.body = body
    }
}

public protocol XProviderHTTPClient: Sendable {
    func send(_ request: XProviderHTTPRequest) throws -> XProviderHTTPResponse
}

public struct URLSessionXProviderHTTPClient: XProviderHTTPClient {
    private let timeoutSeconds: TimeInterval

    public init(timeoutSeconds: TimeInterval = 30) {
        self.timeoutSeconds = timeoutSeconds
    }

    public func send(_ request: XProviderHTTPRequest) throws -> XProviderHTTPResponse {
        var urlRequest = URLRequest(url: request.url)
        urlRequest.httpMethod = request.method
        urlRequest.timeoutInterval = timeoutSeconds
        urlRequest.httpBody = request.body
        for (key, value) in request.headers {
            urlRequest.setValue(value, forHTTPHeaderField: key)
        }
        let semaphore = DispatchSemaphore(value: 0)
        var responseData: Data?
        var responseStatusCode: Int?
        var responseError: Error?
        let task = URLSession.shared.dataTask(with: urlRequest) { data, response, error in
            responseData = data
            responseStatusCode = (response as? HTTPURLResponse)?.statusCode
            responseError = error
            semaphore.signal()
        }
        task.resume()
        if semaphore.wait(timeout: .now() + timeoutSeconds) == .timedOut {
            task.cancel()
            throw MarketplaceProviderActionAdapterFailure(
                code: "x_http_timeout",
                message: "X API request timed out.",
                detail: ["urlHost": .string(request.url.host ?? "api.x.com")]
            )
        }
        if let responseError {
            throw responseError
        }
        return XProviderHTTPResponse(statusCode: responseStatusCode ?? 0, body: responseData ?? Data())
    }
}

public struct FakeXProviderActionClient: XProviderActionClient {
    private let failureByActionKey: [String: MarketplaceProviderActionAdapterFailure]

    public init(failureByActionKey: [String: MarketplaceProviderActionAdapterFailure] = [:]) {
        self.failureByActionKey = failureByActionKey
    }

    public func executeXAction(request: MarketplaceProviderActionAdapterRequest) throws -> XProviderActionClientResult {
        if let failure = failureByActionKey[request.definition.actionKey] {
            throw failure
        }
        switch request.definition.actionKey {
        case "x_account_get":
            return XProviderActionClientResult(result: baseResult(request: request).merging([
                "account": .object([
                    "id": .string("x-user-test"),
                    "name": .string("Relay Test"),
                    "username": .string("relay_test")
                ])
            ]) { _, new in new })
        case "x_own_posts_list":
            return XProviderActionClientResult(result: baseResult(request: request).merging([
                "posts": .array([]),
                "count": .number(0),
                "onePageOnly": .bool(true)
            ]) { _, new in new })
        case "x_post_draft":
            let text = try Self.requiredText(request: request)
            return XProviderActionClientResult(result: baseResult(request: request).merging([
                "draftId": .string("x-draft-\(stableSuffix(text + request.idempotencyKey))"),
                "text": .string(text),
                "characterCount": .number(Double(text.count)),
                "providerCallMade": .bool(false)
            ]) { _, new in new })
        case "x_text_post_create":
            let text = try Self.requiredText(request: request)
            let postId = "x-post-\(stableSuffix(text + request.idempotencyKey))"
            return XProviderActionClientResult(result: baseResult(request: request).merging([
                "postId": .string(postId),
                "text": .string(text),
                "postURL": .string("https://x.com/i/status/\(postId)"),
                "madeWithAI": .bool(true),
                "published": .bool(true),
                "actionFamily": .string("public-social-text"),
                "characterCount": .number(Double(text.count))
            ]) { _, new in new })
        default:
            throw MarketplaceProviderActionAdapterFailure(
                code: "x_action_not_allowlisted",
                message: "The requested X action is not in the V1 adapter allowlist."
            )
        }
    }

    private func baseResult(request: MarketplaceProviderActionAdapterRequest) -> JSONRecord {
        [
            "fakeAdapter": .bool(true),
            "adapterBoundary": .string("x-provider-action-adapter"),
            "clientMode": .string("fake-x-client"),
            "provider": .string("x"),
            "permission": .string(request.permission.rawValue),
            "payloadHash": .string(MarketplaceProviderActionApprovalService.payloadHash(request.payload)),
            "approved": .bool(request.approvalReference?.status == .approved),
            "idempotencyKey": .string(request.idempotencyKey),
            "liveCredentialsUsed": .bool(false),
            "simulated": .bool(true),
            "redactionStatus": .string("private-state-excluded")
        ]
    }

    private static func requiredText(request: MarketplaceProviderActionAdapterRequest) throws -> String {
        guard let text = request.payload["text"]?.string?.trimmingCharacters(in: .whitespacesAndNewlines),
              !text.isEmpty else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "x_missing_text",
                message: "X text actions require non-empty text."
            )
        }
        guard text.count <= 280 else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "x_text_too_long",
                message: "X text actions are limited to 280 characters in the V1 adapter."
            )
        }
        guard !Self.containsURL(text) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "x_url_not_supported",
                message: "X V1 permits plain-text Posts without URLs only."
            )
        }
        return text
    }

    private static func containsURL(_ text: String) -> Bool {
        text.range(of: #"(?i)(https?://|www\.|\b[a-z0-9-]+\.(com|org|net|io|co|app|dev)\b)"#, options: .regularExpression) != nil
    }

    private func stableSuffix(_ value: String) -> String {
        Self.stableSuffix(value)
    }

    private static func stableSuffix(_ value: String) -> String {
        var hash: UInt64 = 1469598103934665603
        for byte in value.utf8 {
            hash ^= UInt64(byte)
            hash &*= 1099511628211
        }
        let hex = String(hash, radix: 16)
        return String(hex.suffix(10))
    }
}

public final class LiveXProviderActionClient: XProviderActionClient, @unchecked Sendable {
    private struct Credentials {
        var accessToken: String
    }

    private let data: LocalDataService
    private let secrets: SecretService
    private let httpClient: any XProviderHTTPClient

    public init(
        data: LocalDataService,
        secrets: SecretService,
        httpClient: any XProviderHTTPClient = URLSessionXProviderHTTPClient()
    ) {
        self.data = data
        self.secrets = secrets
        self.httpClient = httpClient
    }

    public func executeXAction(request: MarketplaceProviderActionAdapterRequest) throws -> XProviderActionClientResult {
        switch request.definition.actionKey {
        case "x_account_get":
            return try readAccount(request: request)
        case "x_own_posts_list":
            return try readOwnPosts(request: request)
        case "x_post_draft":
            let text = try Self.requiredText(request: request)
            return XProviderActionClientResult(result: baseResult(request: request).merging([
                "draftId": .string("x-draft-\(Self.stableSuffix(text + request.idempotencyKey))"),
                "text": .string(text),
                "characterCount": .number(Double(text.count)),
                "providerCallMade": .bool(false)
            ]) { _, new in new })
        case "x_text_post_create":
            return try createPost(request: request)
        default:
            throw MarketplaceProviderActionAdapterFailure(
                code: "x_live_action_not_implemented",
                message: "Live X provider execution does not support this action yet."
            )
        }
    }

    private func createPost(request: MarketplaceProviderActionAdapterRequest) throws -> XProviderActionClientResult {
        let text = try Self.requiredText(request: request)
        let connection = try connection(for: request)
        try requireReady(connection: connection, actionKey: request.definition.actionKey, requiredScopes: ["tweet.write"])
        let response = try postJSON(
            path: "/2/tweets",
            body: ["text": .string(text), "made_with_ai": .bool(true)],
            credentials: try credentials(for: connection)
        )
        let data = Self.object(response["data"]) ?? [:]
        guard let postId = data["id"]?.string?.nilIfEmpty else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "x_post_response_missing_id",
                message: "X accepted the post request but did not return a post id."
            )
        }
        return XProviderActionClientResult(result: baseResult(request: request).merging([
            "clientMode": .string("live-x-api"),
            "liveCredentialsUsed": .bool(true),
            "simulated": .bool(false),
            "actionFamily": .string("public-social-text"),
            "postId": .string(postId),
            "text": data["text"] ?? .string(text),
            "postURL": .string("https://x.com/i/status/\(postId)"),
            "madeWithAI": .bool(true),
            "published": .bool(true),
            "characterCount": .number(Double(text.count))
        ]) { _, new in new })
    }

    private func readAccount(request: MarketplaceProviderActionAdapterRequest) throws -> XProviderActionClientResult {
        let connection = try connection(for: request)
        try requireReady(connection: connection, actionKey: request.definition.actionKey, requiredScopes: ["users.read"])
        let credentials = try credentials(for: connection)
        let user = try getSignedInUser(credentials: credentials)
        return XProviderActionClientResult(result: baseResult(request: request).merging([
            "clientMode": .string("live-x-api"),
            "liveCredentialsUsed": .bool(true),
            "account": .object(["id": .string(user.id), "username": user.username.map(JSONValue.string) ?? .null, "name": user.name.map(JSONValue.string) ?? .null])
        ]) { _, new in new })
    }

    private func readOwnPosts(request: MarketplaceProviderActionAdapterRequest) throws -> XProviderActionClientResult {
        let connection = try connection(for: request)
        try requireReady(connection: connection, actionKey: request.definition.actionKey, requiredScopes: ["tweet.read", "users.read"])
        let credentials = try credentials(for: connection)
        let user = try getSignedInUser(credentials: credentials)
        let maxResults = Self.maxResults(from: request.payload)
        let query: [String: String] = [
            "max_results": String(max(5, maxResults)),
            "tweet.fields": "created_at",
            "exclude": "replies,retweets"
        ]
        let response = try getJSON(path: "/2/users/\(user.id)/tweets", query: query, credentials: credentials)
        let tweets = Self.tweetItems(from: response, limit: maxResults)
        return XProviderActionClientResult(result: baseResult(request: request).merging([
            "clientMode": .string("live-x-api"),
            "liveCredentialsUsed": .bool(true),
            "simulated": .bool(false),
            "account": .object([
                "id": .string(user.id),
                "username": user.username.map(JSONValue.string) ?? .null,
                "name": user.name.map(JSONValue.string) ?? .null
            ]),
            "posts": .array(tweets),
            "count": .number(Double(tweets.count)),
            "onePageOnly": .bool(true)
        ]) { _, new in new })
    }

    private func getSignedInUser(credentials: Credentials) throws -> (id: String, username: String?, name: String?) {
        let response = try getJSON(
            path: "/2/users/me",
            query: ["user.fields": "username,name"],
            credentials: credentials
        )
        guard let user = Self.object(response["data"]),
              let id = user["id"]?.string?.nilIfEmpty else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "x_identity_unavailable",
                message: "X did not return the signed-in user identity."
            )
        }
        return (id, user["username"]?.string?.nilIfEmpty, user["name"]?.string?.nilIfEmpty)
    }

    private func getJSON(path: String, query: [String: String], credentials: Credentials) throws -> JSONRecord {
        let url = try Self.xAPIURL(path: path, query: query)
        let headers = [
            "Authorization": "Bearer \(credentials.accessToken)",
            "Accept": "application/json"
        ]
        let response = try httpClient.send(XProviderHTTPRequest(method: "GET", url: url, headers: headers))
        return try Self.parseJSONResponse(response)
    }

    private func postJSON(path: String, body: JSONRecord, credentials: Credentials) throws -> JSONRecord {
        let url = try Self.xAPIURL(path: path, query: [:])
        let bodyData = try jsonEncoder.encode(JSONValue.object(body))
        let headers = [
            "Authorization": "Bearer \(credentials.accessToken)",
            "Accept": "application/json",
            "Content-Type": "application/json"
        ]
        let response = try httpClient.send(XProviderHTTPRequest(method: "POST", url: url, headers: headers, body: bodyData))
        return try Self.parseJSONResponse(response)
    }

    private static func parseJSONResponse(_ response: XProviderHTTPResponse) throws -> JSONRecord {
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "x_http_error",
                message: "X API returned HTTP \(response.statusCode).",
                providerStatusCode: response.statusCode,
                detail: ["body": .string(Self.bodySnippet(response.body))]
            )
        }
        guard let json = try JSONSerialization.jsonObject(with: response.body) as? [String: Any] else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "x_invalid_json",
                message: "X API returned a non-object JSON response."
            )
        }
        return jsonRecord(from: json)
    }

    private func connection(for request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderConnection {
        guard let connectionId = request.auditIdentity.connectionId?.nilIfEmpty,
              let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: connectionId),
              connection.appId == request.app.id,
              connection.appSlug == request.app.slug else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "x_connection_missing",
                message: "X read execution requires a Relay Marketplace provider connection."
            )
        }
        guard connection.status == ProviderConnectionStatus.connected || connection.status == ProviderConnectionStatus.healthError else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "x_connection_not_ready",
                message: "The X provider connection is not ready."
            )
        }
        return connection
    }

    private func requireReady(
        connection: MarketplaceProviderConnection,
        actionKey: String,
        requiredScopes: [String]
    ) throws {
        let exactScopes = ["tweet.read", "users.read", "tweet.write", "offline.access"]
        guard connection.status == .connected,
              connection.health.state == .ready,
              connection.credentialOwnership == .relayOwned,
              connection.requiredScopes == exactScopes,
              Set(connection.grantedScopes) == Set(exactScopes),
              connection.health.diagnostics["railwayCallbackOnly"]?.bool == true,
              connection.health.diagnostics["userBound"]?.bool == true,
              connection.health.diagnostics["billingReady"]?.bool == true,
              connection.health.diagnostics["replyAutomationEnabled"]?.bool == false,
              connection.health.diagnostics["rawToolsEnabled"]?.bool == false else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "x_connection_not_ready",
                message: "The X provider connection is not ready for Relay-owned OAuth execution.",
                detail: ["connectionStatus": .string(connection.status.rawValue)]
            )
        }
        let granted = Set(connection.grantedScopes)
        let missing = requiredScopes.filter { !granted.contains($0) }
        guard missing.isEmpty else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "x_missing_scope",
                message: "The X connection is missing required scope(s): \(missing.joined(separator: ", ")).",
                detail: ["actionKey": .string(actionKey), "missingScopes": .array(missing.map(JSONValue.string))]
            )
        }
    }

    private func credentials(for connection: MarketplaceProviderConnection) throws -> Credentials {
        Credentials(
            accessToken: try secret(fieldKey: "x_oauth_access_token", connection: connection)
        )
    }

    private func secret(fieldKey: String, connection: MarketplaceProviderConnection) throws -> String {
        guard let secretId = connection.credentialRequirements.first(where: { $0.fieldKey == fieldKey })?.secretReferenceId else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "x_credentials_missing",
                message: "The X provider connection is missing a required Keychain secret reference.",
                detail: ["fieldKey": .string(fieldKey)]
            )
        }
        do {
            return try secrets.getSecretValue(secretId)
        } catch {
            markCredentialUnavailable(fieldKey: fieldKey, connection: connection)
            throw MarketplaceProviderActionAdapterFailure(
                code: "x_credentials_unavailable",
                message: "Relay could not read the saved X credential from the OS secret store. Reconnect X in Marketplace to refresh the broker-held credential.",
                detail: ["fieldKey": .string(fieldKey)]
            )
        }
    }

    private func markCredentialUnavailable(fieldKey: String, connection: MarketplaceProviderConnection) {
        var updated = connection
        updated.status = .healthError
        updated.authorizationState = .error
        updated.reauthorizeRequired = true
        updated.lastCheckedAt = nowIso()
        updated.lastError = "Saved X credential is unavailable in the OS secret store. Reconnect X in Marketplace."
        updated.health = ProviderConnectorHealth(
            state: .error,
            message: "Saved X credential is unavailable in the OS secret store. Reconnect X in Marketplace.",
            lastCheckedAt: updated.lastCheckedAt,
            missingScopes: [],
            unavailableTools: ["x_account_get", "x_own_posts_list", "x_text_post_create"],
            diagnostics: [
                "fieldKey": .string(fieldKey),
                "reasonCode": .string("x_credentials_unavailable"),
                "redactionStatus": .string("private-state-excluded")
            ],
            redactionStatus: "private-state-excluded"
        )
        updated.credentialRequirements = updated.credentialRequirements.map { requirement in
            var copy = requirement
            if copy.fieldKey == fieldKey {
                copy.status = .unavailable
            }
            return copy
        }
        DispatchQueue.global(qos: .utility).async { [data] in
            _ = try? data.saveProviderConnection(updated)
        }
    }

    private func baseResult(request: MarketplaceProviderActionAdapterRequest) -> JSONRecord {
        [
            "adapterBoundary": .string("x-provider-action-adapter"),
            "clientMode": .string("live-x-api"),
            "provider": .string("x"),
            "permission": .string(request.permission.rawValue),
            "payloadHash": .string(MarketplaceProviderActionApprovalService.payloadHash(request.payload)),
            "approved": .bool(request.approvalReference?.status == .approved),
            "idempotencyKey": .string(request.idempotencyKey),
            "fakeAdapter": .bool(false),
            "liveCredentialsUsed": .bool(false),
            "simulated": .bool(false),
            "redactionStatus": .string("private-state-excluded")
        ]
    }

    private static func requiredText(request: MarketplaceProviderActionAdapterRequest) throws -> String {
        guard let text = request.payload["text"]?.string?.trimmingCharacters(in: .whitespacesAndNewlines),
              !text.isEmpty else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "x_missing_text",
                message: "X text actions require non-empty text."
            )
        }
        guard text.count <= 280 else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "x_text_too_long",
                message: "X text actions are limited to 280 characters in the V1 adapter."
            )
        }
        guard !Self.containsURL(text) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "x_url_not_supported",
                message: "X V1 permits plain-text Posts without URLs only."
            )
        }
        return text
    }

    private static func containsURL(_ text: String) -> Bool {
        text.range(of: #"(?i)(https?://|www\.|\b[a-z0-9-]+\.(com|org|net|io|co|app|dev)\b)"#, options: .regularExpression) != nil
    }

    private static func xAPIURL(path: String, query: [String: String]) throws -> URL {
        var components = URLComponents()
        components.scheme = "https"
        components.host = "api.x.com"
        components.path = path
        components.queryItems = query.sorted { $0.key < $1.key }.map { URLQueryItem(name: $0.key, value: $0.value) }
        guard let url = components.url else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "x_invalid_url",
                message: "Could not build the X API URL."
            )
        }
        return url
    }

    private static func maxResults(from payload: JSONRecord) -> Int {
        let raw: Int?
        switch payload["maxResults"] {
        case .number(let value):
            raw = Int(value)
        case .string(let value):
            raw = Int(value.trimmingCharacters(in: .whitespacesAndNewlines))
        default:
            raw = nil
        }
        return min(max(raw ?? 10, 1), 10)
    }

    private static func tweetItems(from response: JSONRecord, limit: Int) -> [JSONValue] {
        guard case .array(let values)? = response["data"] else {
            return []
        }
        return values.prefix(limit).compactMap { value in
            guard case .object(let object) = value else {
                return nil
            }
            let item: JSONRecord = [
                "id": object["id"] ?? .null,
                "text": object["text"] ?? .null,
                "createdAt": object["created_at"] ?? .null,
                "redactionStatus": .string("private-state-excluded")
            ]
            return .object(item)
        }
    }

    private static func jsonRecord(from object: [String: Any]) -> JSONRecord {
        object.reduce(into: JSONRecord()) { partial, element in
            partial[element.key] = jsonValue(from: element.value)
        }
    }

    private static func jsonValue(from value: Any) -> JSONValue {
        switch value {
        case let string as String:
            return .string(string)
        case let number as NSNumber:
            if CFGetTypeID(number) == CFBooleanGetTypeID() {
                return .bool(number.boolValue)
            }
            return .number(number.doubleValue)
        case let object as [String: Any]:
            return .object(jsonRecord(from: object))
        case let array as [Any]:
            return .array(array.map(jsonValue(from:)))
        default:
            return .null
        }
    }

    private static func object(_ value: JSONValue?) -> JSONRecord? {
        if case .object(let object)? = value {
            return object
        }
        return nil
    }

    private static func bodySnippet(_ data: Data) -> String {
        let text = String(data: data, encoding: .utf8) ?? ""
        return String(text.prefix(2_000))
    }

    private static func stableSuffix(_ value: String) -> String {
        var hash: UInt64 = 1469598103934665603
        for byte in value.utf8 {
            hash ^= UInt64(byte)
            hash &*= 1099511628211
        }
        let hex = String(hash, radix: 16)
        return String(hex.suffix(10))
    }
}

public struct XProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowlistedActionKeys: Set<String> = [
        "x_account_get",
        "x_own_posts_list",
        "x_post_draft",
        "x_text_post_create"
    ]

    private let client: any XProviderActionClient

    public init(client: any XProviderActionClient = FakeXProviderActionClient()) {
        self.client = client
    }

    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "x" else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "x_adapter_wrong_provider",
                message: "X adapter can only execute X provider actions."
            )
        }
        guard Self.allowlistedActionKeys.contains(request.definition.actionKey) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "x_action_not_allowlisted",
                message: "The requested X action is not in the V1 adapter allowlist."
            )
        }
        if Self.payloadContainsMedia(request.payload) {
            throw MarketplaceProviderActionAdapterFailure(
                code: "x_media_deferred",
                message: "X media payloads are deferred in the V1 provider action adapter."
            )
        }
        if Self.payloadContainsUnsupportedFields(request.payload) {
            throw MarketplaceProviderActionAdapterFailure(
                code: "x_payload_not_supported",
                message: "X V1 permits connected-account reads and original plain-text Posts only."
            )
        }
        let output = try client.executeXAction(request: request)
        return MarketplaceProviderActionAdapterResult(
            result: output.result,
            error: nil,
            redactionStatus: output.redactionStatus
        )
    }

    private static func payloadContainsMedia(_ payload: JSONRecord) -> Bool {
        let mediaKeys = [
            "media",
            "mediaIds",
            "media_ids",
            "attachments",
            "image",
            "images",
            "video",
            "videos"
        ]
        return mediaKeys.contains { payload[$0] != nil }
    }

    private static func payloadContainsUnsupportedFields(_ payload: JSONRecord) -> Bool {
        let keys = ["postId", "reply", "quoteTweetId", "quote_tweet_id", "poll", "geo", "communityId", "editOptions", "paidPartnership", "url", "cursor", "scope", "userId", "username"]
        return keys.contains { payload[$0] != nil }
    }
}

public struct RoutingMarketplaceProviderActionAdapter: MarketplaceProviderActionAdapter {
    private let xAdapter: XProviderActionAdapter
    private let facebookPagesAdapter: FacebookPagesProviderActionAdapter
    private let instagramBusinessAdapter: InstagramBusinessProviderActionAdapter
    private let threadsAdapter: ThreadsProviderActionAdapter
    private let mastodonAdapter: MastodonProviderActionAdapter
    private let blueskyAdapter: BlueskyProviderActionAdapter
    private let nextdoorAdapter: NextdoorProviderActionAdapter
    private let meetupAdapter: MeetupProviderActionAdapter
    private let eventbriteAdapter: EventbriteProviderActionAdapter
    private let lumaAdapter: LumaProviderActionAdapter
    private let hopinAdapter: HopinProviderActionAdapter
    private let twistAdapter: TwistProviderActionAdapter
    private let zohoMailAdapter: ZohoMailProviderActionAdapter
    private let webexAdapter: WebexProviderActionAdapter
    private let goToMeetingAdapter: GoToMeetingProviderActionAdapter
    private let ringCentralAdapter: RingCentralProviderActionAdapter
    private let dialpadAdapter: DialpadProviderActionAdapter
    private let aircallAdapter: AircallProviderActionAdapter
    private let openPhoneAdapter: OpenPhoneProviderActionAdapter
    private let twilioAdapter: TwilioProviderActionAdapter
    private let vonageAdapter: VonageProviderActionAdapter
    private let messageBirdAdapter: MessageBirdProviderActionAdapter
    private let fredAdapter: FREDProviderActionAdapter
    private let apolloGraphOSAdapter: ApolloGraphOSProviderActionAdapter
    private let hunterAdapter: HunterProviderActionAdapter
    private let snovAdapter: SnovProviderActionAdapter
    private let lushaAdapter: LushaProviderActionAdapter
    private let leadIQAdapter: LeadIQProviderActionAdapter
    private let seamlessAIAdapter: SeamlessAIProviderActionAdapter
    private let rocketReachAdapter: RocketReachProviderActionAdapter
    private let upLeadAdapter: UpLeadProviderActionAdapter
    private let wizaAdapter: WizaProviderActionAdapter
    private let lineAdapter: LINEProviderActionAdapter
    private let pinterestAdapter: PinterestProviderActionAdapter
    private let tumblrAdapter: TumblrProviderActionAdapter
    private let linkedInAdapter: LinkedInProviderActionAdapter
    private let gmailAdapter: GmailProviderActionAdapter
    private let googleDocsAdapter: GoogleDocsProviderActionAdapter
    private let googleSearchConsoleAdapter: GoogleSearchConsoleProviderActionAdapter
    private let slackAdapter: SlackProviderActionAdapter
    private let githubAdapter: GitHubProviderActionAdapter
    private let gitLabAdapter: GitLabProviderActionAdapter
    private let bitbucketAdapter: BitbucketProviderActionAdapter
    private let linearAdapter: LinearProviderActionAdapter
    private let asanaAdapter: AsanaProviderActionAdapter
    private let trelloAdapter: TrelloProviderActionAdapter
    private let clickUpAdapter: ClickUpProviderActionAdapter
    private let mondayAdapter: MondayProviderActionAdapter
    private let airtableAdapter: AirtableProviderActionAdapter
    private let dropboxAdapter: DropboxProviderActionAdapter
    private let boxAdapter: BoxProviderActionAdapter
    private let figmaAdapter: FigmaProviderActionAdapter
    private let miroAdapter: MiroProviderActionAdapter
    private let canvaAdapter: CanvaProviderActionAdapter
    private let webflowAdapter: WebflowProviderActionAdapter
    private let wordpressComAdapter: WordPressComProviderActionAdapter
    private let contentfulAdapter: ContentfulProviderActionAdapter
    private let shopifyAdapter: ShopifyProviderActionAdapter
    private let wooCommerceAdapter: WooCommerceProviderActionAdapter
    private let stripeAdapter: StripeProviderActionAdapter
    private let payPalAdapter: PayPalProviderActionAdapter
    private let xeroAdapter: XeroProviderActionAdapter
    private let quickBooksAdapter: QuickBooksProviderActionAdapter
    private let freshBooksAdapter: FreshBooksProviderActionAdapter
    private let waveAdapter: WaveProviderActionAdapter
    private let freeAgentAdapter: FreeAgentProviderActionAdapter
    private let salesforceAdapter: SalesforceProviderActionAdapter
    private let hubSpotAdapter: HubSpotProviderActionAdapter
    private let pipedriveAdapter: PipedriveProviderActionAdapter
    private let copperAdapter: CopperProviderActionAdapter
    private let closeAdapter: CloseProviderActionAdapter
    private let zendeskAdapter: ZendeskProviderActionAdapter
    private let intercomAdapter: IntercomProviderActionAdapter
    private let helpScoutAdapter: HelpScoutProviderActionAdapter
    private let frontAdapter: FrontProviderActionAdapter
    private let teamworkAdapter: TeamworkProviderActionAdapter
    private let basecampAdapter: BasecampProviderActionAdapter
    private let wrikeAdapter: WrikeProviderActionAdapter
    private let smartsheetAdapter: SmartsheetProviderActionAdapter
    private let todoistAdapter: TodoistProviderActionAdapter
    private let harvestAdapter: HarvestProviderActionAdapter
    private let calendlyAdapter: CalendlyProviderActionAdapter
    private let calComAdapter: CalComProviderActionAdapter
    private let docusignAdapter: DocusignProviderActionAdapter
    private let dropboxSignAdapter: DropboxSignProviderActionAdapter
    private let pandaDocAdapter: PandaDocProviderActionAdapter
    private let typeformAdapter: TypeformProviderActionAdapter
    private let sendFoxAdapter: SendFoxProviderActionAdapter
    private let beehiivAdapter: BeehiivProviderActionAdapter
    private let substackAdapter: SubstackProviderActionAdapter
    private let hootsuiteAdapter: HootsuiteProviderActionAdapter
    private let bufferAdapter: BufferProviderActionAdapter
    private let sproutSocialAdapter: SproutSocialProviderActionAdapter
    private let agorapulseAdapter: AgorapulseProviderActionAdapter
    private let metricoolAdapter: MetricoolProviderActionAdapter
    private let publerAdapter: PublerProviderActionAdapter
    private let brandwatchAdapter: BrandwatchProviderActionAdapter
    private let mentionAdapter: MentionProviderActionAdapter
    private let meltwaterAdapter: MeltwaterProviderActionAdapter
    private let sprinklrAdapter: SprinklrProviderActionAdapter
    private let khorosAdapter: KhorosProviderActionAdapter
    private let cleverTapAdapter: CleverTapProviderActionAdapter
    private let oneSignalAdapter: OneSignalProviderActionAdapter
    private let airshipAdapter: AirshipProviderActionAdapter
    private let pushwooshAdapter: PushwooshProviderActionAdapter
    private let pusherBeamsAdapter: PusherBeamsProviderActionAdapter
    private let firebaseCloudMessagingAdapter: FirebaseCloudMessagingProviderActionAdapter
    private let appsFlyerAdapter: AppsFlyerProviderActionAdapter
    private let adjustAdapter: AdjustProviderActionAdapter
    private let branchAdapter: BranchProviderActionAdapter
    private let singularAdapter: SingularProviderActionAdapter
    private let kochavaAdapter: KochavaProviderActionAdapter
    private let segmentAdapter: SegmentProviderActionAdapter
    private let mParticleAdapter: MParticleProviderActionAdapter
    private let tealiumAdapter: TealiumProviderActionAdapter
    private let lyticsAdapter: LyticsProviderActionAdapter
    private let blueConicAdapter: BlueConicProviderActionAdapter
    private let treasureDataAdapter: TreasureDataProviderActionAdapter
    private let hightouchAdapter: HightouchProviderActionAdapter
    private let censusAdapter: CensusProviderActionAdapter
    private let clioManageAdapter: ClioManageProviderActionAdapter
    private let clioGrowAdapter: ClioGrowProviderActionAdapter
    private let myCaseAdapter: MyCaseProviderActionAdapter
    private let practicePantherAdapter: PracticePantherProviderActionAdapter
    private let smokeballAdapter: SmokeballProviderActionAdapter
    private let lawPayAdapter: LawPayProviderActionAdapter
    private let filevineAdapter: FilevineProviderActionAdapter
    private let laterAdapter: LaterProviderActionAdapter
    private let surveyMonkeyAdapter: SurveyMonkeyProviderActionAdapter
    private let filloutAdapter: FilloutProviderActionAdapter
    private let mailchimpAdapter: MailchimpProviderActionAdapter
    private let klaviyoAdapter: KlaviyoProviderActionAdapter
    private let convertKitAdapter: ConvertKitProviderActionAdapter
    private let campaignMonitorAdapter: CampaignMonitorProviderActionAdapter
    private let constantContactAdapter: ConstantContactProviderActionAdapter
    private let notionAdapter: NotionProviderActionAdapter
    private let microsoftClarityAdapter: MicrosoftClarityProviderActionAdapter
    private let postHogAdapter: PostHogProviderActionAdapter
    private let telemetryDeckAdapter: TelemetryDeckProviderActionAdapter
    private let sentryAdapter: SentryProviderActionAdapter
    private let datadogAdapter: DatadogProviderActionAdapter
    private let pagerDutyAdapter: PagerDutyProviderActionAdapter
    private let cloudflareAdapter: CloudflareProviderActionAdapter
    private let vercelAdapter: VercelProviderActionAdapter
    private let herokuAdapter: HerokuProviderActionAdapter
    private let digitalOceanAdapter: DigitalOceanProviderActionAdapter
    private let firebaseAdapter: FirebaseProviderActionAdapter
    private let supabaseAdapter: SupabaseProviderActionAdapter
    private let oktaAdapter: OktaProviderActionAdapter
    private let bambooHRAdapter: BambooHRProviderActionAdapter
    private let greenhouseAdapter: GreenhouseProviderActionAdapter
    private let leverAdapter: LeverProviderActionAdapter
    private let googleCalendarAdapter: GoogleCalendarProviderActionAdapter
    private let googleDriveAdapter: GoogleDriveProviderActionAdapter
    private let googleSheetsAdapter: GoogleSheetsProviderActionAdapter
    private let googleSlidesAdapter: GoogleSlidesProviderActionAdapter
    private let googleFormsAdapter: GoogleFormsProviderActionAdapter
    private let googleTasksAdapter: GoogleTasksProviderActionAdapter
    private let googleContactsAdapter: GoogleContactsProviderActionAdapter
    private let googlePhotosAdapter: GooglePhotosProviderActionAdapter
    private let googleMeetAdapter: GoogleMeetProviderActionAdapter
    private let googleChatAdapter: GoogleChatProviderActionAdapter
    private let googleAdsAdapter: GoogleAdsProviderActionAdapter
    private let googleAnalyticsAdapter: GoogleAnalyticsProviderActionAdapter
    private let googleMerchantCenterAdapter: GoogleMerchantCenterProviderActionAdapter
    private let youTubeAdapter: YouTubeProviderActionAdapter
    private let googleClassroomAdapter: GoogleClassroomProviderActionAdapter
    private let outlookAdapter: OutlookProviderActionAdapter
    private let microsoftTeamsAdapter: MicrosoftTeamsProviderActionAdapter
    private let oneDriveAdapter: OneDriveProviderActionAdapter
    private let sharePointAdapter: SharePointProviderActionAdapter
    private let microsoftPlannerAdapter: MicrosoftPlannerProviderActionAdapter
    private let microsoftToDoAdapter: MicrosoftToDoProviderActionAdapter
    private let microsoftListsAdapter: MicrosoftListsProviderActionAdapter
    private let oneNoteAdapter: OneNoteProviderActionAdapter
    private let microsoftBookingsAdapter: MicrosoftBookingsProviderActionAdapter
    private let microsoftPowerBIAdapter: MicrosoftPowerBIProviderActionAdapter
    private let microsoftDynamics365Adapter: MicrosoftDynamics365ProviderActionAdapter
    private let microsoftVivaEngageAdapter: MicrosoftVivaEngageProviderActionAdapter
    private let zoomAdapter: ZoomProviderActionAdapter
    private let discordAdapter: DiscordProviderActionAdapter
    private let fallback: any MarketplaceProviderActionAdapter

    public init(
        xAdapter: XProviderActionAdapter = XProviderActionAdapter(),
        facebookPagesAdapter: FacebookPagesProviderActionAdapter = FacebookPagesProviderActionAdapter(),
        instagramBusinessAdapter: InstagramBusinessProviderActionAdapter = InstagramBusinessProviderActionAdapter(),
        threadsAdapter: ThreadsProviderActionAdapter = ThreadsProviderActionAdapter(),
        mastodonAdapter: MastodonProviderActionAdapter = MastodonProviderActionAdapter(),
        blueskyAdapter: BlueskyProviderActionAdapter = BlueskyProviderActionAdapter(),
        nextdoorAdapter: NextdoorProviderActionAdapter = NextdoorProviderActionAdapter(),
        meetupAdapter: MeetupProviderActionAdapter = MeetupProviderActionAdapter(),
        eventbriteAdapter: EventbriteProviderActionAdapter = EventbriteProviderActionAdapter(),
        lumaAdapter: LumaProviderActionAdapter = LumaProviderActionAdapter(),
        hopinAdapter: HopinProviderActionAdapter = HopinProviderActionAdapter(),
        twistAdapter: TwistProviderActionAdapter = TwistProviderActionAdapter(),
        zohoMailAdapter: ZohoMailProviderActionAdapter = ZohoMailProviderActionAdapter(),
        webexAdapter: WebexProviderActionAdapter = WebexProviderActionAdapter(),
        goToMeetingAdapter: GoToMeetingProviderActionAdapter = GoToMeetingProviderActionAdapter(),
        ringCentralAdapter: RingCentralProviderActionAdapter = RingCentralProviderActionAdapter(),
        dialpadAdapter: DialpadProviderActionAdapter = DialpadProviderActionAdapter(),
        aircallAdapter: AircallProviderActionAdapter = AircallProviderActionAdapter(),
        openPhoneAdapter: OpenPhoneProviderActionAdapter = OpenPhoneProviderActionAdapter(),
        twilioAdapter: TwilioProviderActionAdapter = TwilioProviderActionAdapter(),
        vonageAdapter: VonageProviderActionAdapter = VonageProviderActionAdapter(),
        messageBirdAdapter: MessageBirdProviderActionAdapter = MessageBirdProviderActionAdapter(),
        fredAdapter: FREDProviderActionAdapter = FREDProviderActionAdapter(),
        apolloGraphOSAdapter: ApolloGraphOSProviderActionAdapter = ApolloGraphOSProviderActionAdapter(),
        hunterAdapter: HunterProviderActionAdapter = HunterProviderActionAdapter(),
        snovAdapter: SnovProviderActionAdapter = SnovProviderActionAdapter(),
        lushaAdapter: LushaProviderActionAdapter = LushaProviderActionAdapter(),
        leadIQAdapter: LeadIQProviderActionAdapter = LeadIQProviderActionAdapter(),
        seamlessAIAdapter: SeamlessAIProviderActionAdapter = SeamlessAIProviderActionAdapter(),
        rocketReachAdapter: RocketReachProviderActionAdapter = RocketReachProviderActionAdapter(),
        upLeadAdapter: UpLeadProviderActionAdapter = UpLeadProviderActionAdapter(),
        wizaAdapter: WizaProviderActionAdapter = WizaProviderActionAdapter(),
        lineAdapter: LINEProviderActionAdapter = LINEProviderActionAdapter(),
        pinterestAdapter: PinterestProviderActionAdapter = PinterestProviderActionAdapter(),
        tumblrAdapter: TumblrProviderActionAdapter = TumblrProviderActionAdapter(),
        linkedInAdapter: LinkedInProviderActionAdapter = LinkedInProviderActionAdapter(),
        gmailAdapter: GmailProviderActionAdapter = GmailProviderActionAdapter(),
        googleDocsAdapter: GoogleDocsProviderActionAdapter = GoogleDocsProviderActionAdapter(),
        googleSearchConsoleAdapter: GoogleSearchConsoleProviderActionAdapter = GoogleSearchConsoleProviderActionAdapter(),
        slackAdapter: SlackProviderActionAdapter = SlackProviderActionAdapter(),
        githubAdapter: GitHubProviderActionAdapter = GitHubProviderActionAdapter(),
        gitLabAdapter: GitLabProviderActionAdapter = GitLabProviderActionAdapter(),
        bitbucketAdapter: BitbucketProviderActionAdapter = BitbucketProviderActionAdapter(),
        linearAdapter: LinearProviderActionAdapter = LinearProviderActionAdapter(),
        asanaAdapter: AsanaProviderActionAdapter = AsanaProviderActionAdapter(),
        trelloAdapter: TrelloProviderActionAdapter = TrelloProviderActionAdapter(),
        clickUpAdapter: ClickUpProviderActionAdapter = ClickUpProviderActionAdapter(),
        mondayAdapter: MondayProviderActionAdapter = MondayProviderActionAdapter(),
        airtableAdapter: AirtableProviderActionAdapter = AirtableProviderActionAdapter(),
        dropboxAdapter: DropboxProviderActionAdapter = DropboxProviderActionAdapter(),
        boxAdapter: BoxProviderActionAdapter = BoxProviderActionAdapter(),
        figmaAdapter: FigmaProviderActionAdapter = FigmaProviderActionAdapter(),
        miroAdapter: MiroProviderActionAdapter = MiroProviderActionAdapter(),
        canvaAdapter: CanvaProviderActionAdapter = CanvaProviderActionAdapter(),
        webflowAdapter: WebflowProviderActionAdapter = WebflowProviderActionAdapter(),
        wordpressComAdapter: WordPressComProviderActionAdapter = WordPressComProviderActionAdapter(),
        contentfulAdapter: ContentfulProviderActionAdapter = ContentfulProviderActionAdapter(),
        shopifyAdapter: ShopifyProviderActionAdapter = ShopifyProviderActionAdapter(),
        wooCommerceAdapter: WooCommerceProviderActionAdapter = WooCommerceProviderActionAdapter(),
        stripeAdapter: StripeProviderActionAdapter = StripeProviderActionAdapter(),
        payPalAdapter: PayPalProviderActionAdapter = PayPalProviderActionAdapter(),
        xeroAdapter: XeroProviderActionAdapter = XeroProviderActionAdapter(),
        quickBooksAdapter: QuickBooksProviderActionAdapter = QuickBooksProviderActionAdapter(),
        freshBooksAdapter: FreshBooksProviderActionAdapter = FreshBooksProviderActionAdapter(),
        waveAdapter: WaveProviderActionAdapter = WaveProviderActionAdapter(),
        freeAgentAdapter: FreeAgentProviderActionAdapter = FreeAgentProviderActionAdapter(),
        salesforceAdapter: SalesforceProviderActionAdapter = SalesforceProviderActionAdapter(),
        hubSpotAdapter: HubSpotProviderActionAdapter = HubSpotProviderActionAdapter(),
        pipedriveAdapter: PipedriveProviderActionAdapter = PipedriveProviderActionAdapter(),
        copperAdapter: CopperProviderActionAdapter = CopperProviderActionAdapter(),
        closeAdapter: CloseProviderActionAdapter = CloseProviderActionAdapter(),
        zendeskAdapter: ZendeskProviderActionAdapter = ZendeskProviderActionAdapter(),
        intercomAdapter: IntercomProviderActionAdapter = IntercomProviderActionAdapter(),
        helpScoutAdapter: HelpScoutProviderActionAdapter = HelpScoutProviderActionAdapter(),
        frontAdapter: FrontProviderActionAdapter = FrontProviderActionAdapter(),
        teamworkAdapter: TeamworkProviderActionAdapter = TeamworkProviderActionAdapter(),
        basecampAdapter: BasecampProviderActionAdapter = BasecampProviderActionAdapter(),
        wrikeAdapter: WrikeProviderActionAdapter = WrikeProviderActionAdapter(),
        smartsheetAdapter: SmartsheetProviderActionAdapter = SmartsheetProviderActionAdapter(),
        todoistAdapter: TodoistProviderActionAdapter = TodoistProviderActionAdapter(),
        harvestAdapter: HarvestProviderActionAdapter = HarvestProviderActionAdapter(),
        calendlyAdapter: CalendlyProviderActionAdapter = CalendlyProviderActionAdapter(),
        calComAdapter: CalComProviderActionAdapter = CalComProviderActionAdapter(),
        docusignAdapter: DocusignProviderActionAdapter = DocusignProviderActionAdapter(),
        dropboxSignAdapter: DropboxSignProviderActionAdapter = DropboxSignProviderActionAdapter(),
        pandaDocAdapter: PandaDocProviderActionAdapter = PandaDocProviderActionAdapter(),
        typeformAdapter: TypeformProviderActionAdapter = TypeformProviderActionAdapter(),
        sendFoxAdapter: SendFoxProviderActionAdapter = SendFoxProviderActionAdapter(),
        beehiivAdapter: BeehiivProviderActionAdapter = BeehiivProviderActionAdapter(),
        substackAdapter: SubstackProviderActionAdapter = SubstackProviderActionAdapter(),
        hootsuiteAdapter: HootsuiteProviderActionAdapter = HootsuiteProviderActionAdapter(),
        bufferAdapter: BufferProviderActionAdapter = BufferProviderActionAdapter(),
        sproutSocialAdapter: SproutSocialProviderActionAdapter = SproutSocialProviderActionAdapter(),
        agorapulseAdapter: AgorapulseProviderActionAdapter = AgorapulseProviderActionAdapter(),
        metricoolAdapter: MetricoolProviderActionAdapter = MetricoolProviderActionAdapter(),
        publerAdapter: PublerProviderActionAdapter = PublerProviderActionAdapter(),
        brandwatchAdapter: BrandwatchProviderActionAdapter = BrandwatchProviderActionAdapter(),
        mentionAdapter: MentionProviderActionAdapter = MentionProviderActionAdapter(),
        meltwaterAdapter: MeltwaterProviderActionAdapter = MeltwaterProviderActionAdapter(),
        sprinklrAdapter: SprinklrProviderActionAdapter = SprinklrProviderActionAdapter(),
        khorosAdapter: KhorosProviderActionAdapter = KhorosProviderActionAdapter(),
        cleverTapAdapter: CleverTapProviderActionAdapter = CleverTapProviderActionAdapter(),
        oneSignalAdapter: OneSignalProviderActionAdapter = OneSignalProviderActionAdapter(),
        airshipAdapter: AirshipProviderActionAdapter = AirshipProviderActionAdapter(),
        pushwooshAdapter: PushwooshProviderActionAdapter = PushwooshProviderActionAdapter(),
        pusherBeamsAdapter: PusherBeamsProviderActionAdapter = PusherBeamsProviderActionAdapter(),
        firebaseCloudMessagingAdapter: FirebaseCloudMessagingProviderActionAdapter = FirebaseCloudMessagingProviderActionAdapter(),
        appsFlyerAdapter: AppsFlyerProviderActionAdapter = AppsFlyerProviderActionAdapter(),
        adjustAdapter: AdjustProviderActionAdapter = AdjustProviderActionAdapter(),
        branchAdapter: BranchProviderActionAdapter = BranchProviderActionAdapter(),
        singularAdapter: SingularProviderActionAdapter = SingularProviderActionAdapter(),
        kochavaAdapter: KochavaProviderActionAdapter = KochavaProviderActionAdapter(),
        segmentAdapter: SegmentProviderActionAdapter = SegmentProviderActionAdapter(),
        mParticleAdapter: MParticleProviderActionAdapter = MParticleProviderActionAdapter(),
        tealiumAdapter: TealiumProviderActionAdapter = TealiumProviderActionAdapter(),
        lyticsAdapter: LyticsProviderActionAdapter = LyticsProviderActionAdapter(),
        blueConicAdapter: BlueConicProviderActionAdapter = BlueConicProviderActionAdapter(),
        treasureDataAdapter: TreasureDataProviderActionAdapter = TreasureDataProviderActionAdapter(),
        hightouchAdapter: HightouchProviderActionAdapter = HightouchProviderActionAdapter(),
        censusAdapter: CensusProviderActionAdapter = CensusProviderActionAdapter(),
        clioManageAdapter: ClioManageProviderActionAdapter = ClioManageProviderActionAdapter(),
        clioGrowAdapter: ClioGrowProviderActionAdapter = ClioGrowProviderActionAdapter(),
        myCaseAdapter: MyCaseProviderActionAdapter = MyCaseProviderActionAdapter(),
        practicePantherAdapter: PracticePantherProviderActionAdapter = PracticePantherProviderActionAdapter(),
        smokeballAdapter: SmokeballProviderActionAdapter = SmokeballProviderActionAdapter(),
        lawPayAdapter: LawPayProviderActionAdapter = LawPayProviderActionAdapter(),
        filevineAdapter: FilevineProviderActionAdapter = FilevineProviderActionAdapter(),
        laterAdapter: LaterProviderActionAdapter = LaterProviderActionAdapter(),
        surveyMonkeyAdapter: SurveyMonkeyProviderActionAdapter = SurveyMonkeyProviderActionAdapter(),
        filloutAdapter: FilloutProviderActionAdapter = FilloutProviderActionAdapter(),
        mailchimpAdapter: MailchimpProviderActionAdapter = MailchimpProviderActionAdapter(),
        klaviyoAdapter: KlaviyoProviderActionAdapter = KlaviyoProviderActionAdapter(),
        convertKitAdapter: ConvertKitProviderActionAdapter = ConvertKitProviderActionAdapter(),
        campaignMonitorAdapter: CampaignMonitorProviderActionAdapter = CampaignMonitorProviderActionAdapter(),
        constantContactAdapter: ConstantContactProviderActionAdapter = ConstantContactProviderActionAdapter(),
        notionAdapter: NotionProviderActionAdapter = NotionProviderActionAdapter(),
        microsoftClarityAdapter: MicrosoftClarityProviderActionAdapter = MicrosoftClarityProviderActionAdapter(),
        postHogAdapter: PostHogProviderActionAdapter = PostHogProviderActionAdapter(),
        telemetryDeckAdapter: TelemetryDeckProviderActionAdapter = TelemetryDeckProviderActionAdapter(),
        sentryAdapter: SentryProviderActionAdapter = SentryProviderActionAdapter(),
        datadogAdapter: DatadogProviderActionAdapter = DatadogProviderActionAdapter(),
        pagerDutyAdapter: PagerDutyProviderActionAdapter = PagerDutyProviderActionAdapter(),
        cloudflareAdapter: CloudflareProviderActionAdapter = CloudflareProviderActionAdapter(),
        vercelAdapter: VercelProviderActionAdapter = VercelProviderActionAdapter(),
        herokuAdapter: HerokuProviderActionAdapter = HerokuProviderActionAdapter(),
        digitalOceanAdapter: DigitalOceanProviderActionAdapter = DigitalOceanProviderActionAdapter(),
        firebaseAdapter: FirebaseProviderActionAdapter = FirebaseProviderActionAdapter(),
        supabaseAdapter: SupabaseProviderActionAdapter = SupabaseProviderActionAdapter(),
        oktaAdapter: OktaProviderActionAdapter = OktaProviderActionAdapter(),
        bambooHRAdapter: BambooHRProviderActionAdapter = BambooHRProviderActionAdapter(),
        greenhouseAdapter: GreenhouseProviderActionAdapter = GreenhouseProviderActionAdapter(),
        leverAdapter: LeverProviderActionAdapter = LeverProviderActionAdapter(),
        googleCalendarAdapter: GoogleCalendarProviderActionAdapter = GoogleCalendarProviderActionAdapter(),
        googleDriveAdapter: GoogleDriveProviderActionAdapter = GoogleDriveProviderActionAdapter(),
        googleSheetsAdapter: GoogleSheetsProviderActionAdapter = GoogleSheetsProviderActionAdapter(),
        googleSlidesAdapter: GoogleSlidesProviderActionAdapter = GoogleSlidesProviderActionAdapter(),
        googleFormsAdapter: GoogleFormsProviderActionAdapter = GoogleFormsProviderActionAdapter(),
        googleTasksAdapter: GoogleTasksProviderActionAdapter = GoogleTasksProviderActionAdapter(),
        googleContactsAdapter: GoogleContactsProviderActionAdapter = GoogleContactsProviderActionAdapter(),
        googlePhotosAdapter: GooglePhotosProviderActionAdapter = GooglePhotosProviderActionAdapter(),
        googleMeetAdapter: GoogleMeetProviderActionAdapter = GoogleMeetProviderActionAdapter(),
        googleChatAdapter: GoogleChatProviderActionAdapter = GoogleChatProviderActionAdapter(),
        googleAdsAdapter: GoogleAdsProviderActionAdapter = GoogleAdsProviderActionAdapter(),
        googleAnalyticsAdapter: GoogleAnalyticsProviderActionAdapter = GoogleAnalyticsProviderActionAdapter(),
        googleMerchantCenterAdapter: GoogleMerchantCenterProviderActionAdapter = GoogleMerchantCenterProviderActionAdapter(),
        youTubeAdapter: YouTubeProviderActionAdapter = YouTubeProviderActionAdapter(),
        googleClassroomAdapter: GoogleClassroomProviderActionAdapter = GoogleClassroomProviderActionAdapter(),
        outlookAdapter: OutlookProviderActionAdapter = OutlookProviderActionAdapter(),
        microsoftTeamsAdapter: MicrosoftTeamsProviderActionAdapter = MicrosoftTeamsProviderActionAdapter(),
        oneDriveAdapter: OneDriveProviderActionAdapter = OneDriveProviderActionAdapter(),
        sharePointAdapter: SharePointProviderActionAdapter = SharePointProviderActionAdapter(),
        microsoftPlannerAdapter: MicrosoftPlannerProviderActionAdapter = MicrosoftPlannerProviderActionAdapter(),
        microsoftToDoAdapter: MicrosoftToDoProviderActionAdapter = MicrosoftToDoProviderActionAdapter(),
        microsoftListsAdapter: MicrosoftListsProviderActionAdapter = MicrosoftListsProviderActionAdapter(),
        oneNoteAdapter: OneNoteProviderActionAdapter = OneNoteProviderActionAdapter(),
        microsoftBookingsAdapter: MicrosoftBookingsProviderActionAdapter = MicrosoftBookingsProviderActionAdapter(),
        microsoftPowerBIAdapter: MicrosoftPowerBIProviderActionAdapter = MicrosoftPowerBIProviderActionAdapter(),
        microsoftDynamics365Adapter: MicrosoftDynamics365ProviderActionAdapter = MicrosoftDynamics365ProviderActionAdapter(),
        microsoftVivaEngageAdapter: MicrosoftVivaEngageProviderActionAdapter = MicrosoftVivaEngageProviderActionAdapter(),
        zoomAdapter: ZoomProviderActionAdapter = ZoomProviderActionAdapter(),
        discordAdapter: DiscordProviderActionAdapter = DiscordProviderActionAdapter(),
        fallback: any MarketplaceProviderActionAdapter = RailwayRequiredMarketplaceProviderActionAdapter()
    ) {
        self.xAdapter = xAdapter
        self.facebookPagesAdapter = facebookPagesAdapter
        self.instagramBusinessAdapter = instagramBusinessAdapter
        self.threadsAdapter = threadsAdapter
        self.mastodonAdapter = mastodonAdapter
        self.blueskyAdapter = blueskyAdapter
        self.nextdoorAdapter = nextdoorAdapter
        self.meetupAdapter = meetupAdapter
        self.eventbriteAdapter = eventbriteAdapter
        self.lumaAdapter = lumaAdapter
        self.hopinAdapter = hopinAdapter
        self.twistAdapter = twistAdapter
        self.zohoMailAdapter = zohoMailAdapter
        self.webexAdapter = webexAdapter
        self.goToMeetingAdapter = goToMeetingAdapter
        self.ringCentralAdapter = ringCentralAdapter
        self.dialpadAdapter = dialpadAdapter
        self.aircallAdapter = aircallAdapter
        self.openPhoneAdapter = openPhoneAdapter
        self.twilioAdapter = twilioAdapter
        self.vonageAdapter = vonageAdapter
        self.messageBirdAdapter = messageBirdAdapter
        self.fredAdapter = fredAdapter
        self.apolloGraphOSAdapter = apolloGraphOSAdapter
        self.hunterAdapter = hunterAdapter
        self.snovAdapter = snovAdapter
        self.lushaAdapter = lushaAdapter
        self.leadIQAdapter = leadIQAdapter
        self.seamlessAIAdapter = seamlessAIAdapter
        self.rocketReachAdapter = rocketReachAdapter
        self.upLeadAdapter = upLeadAdapter
        self.wizaAdapter = wizaAdapter
        self.lineAdapter = lineAdapter
        self.pinterestAdapter = pinterestAdapter
        self.tumblrAdapter = tumblrAdapter
        self.linkedInAdapter = linkedInAdapter
        self.gmailAdapter = gmailAdapter
        self.googleDocsAdapter = googleDocsAdapter
        self.googleSearchConsoleAdapter = googleSearchConsoleAdapter
        self.slackAdapter = slackAdapter
        self.githubAdapter = githubAdapter
        self.gitLabAdapter = gitLabAdapter
        self.bitbucketAdapter = bitbucketAdapter
        self.linearAdapter = linearAdapter
        self.asanaAdapter = asanaAdapter
        self.trelloAdapter = trelloAdapter
        self.clickUpAdapter = clickUpAdapter
        self.mondayAdapter = mondayAdapter
        self.airtableAdapter = airtableAdapter
        self.dropboxAdapter = dropboxAdapter
        self.boxAdapter = boxAdapter
        self.figmaAdapter = figmaAdapter
        self.miroAdapter = miroAdapter
        self.canvaAdapter = canvaAdapter
        self.webflowAdapter = webflowAdapter
        self.wordpressComAdapter = wordpressComAdapter
        self.contentfulAdapter = contentfulAdapter
        self.shopifyAdapter = shopifyAdapter
        self.wooCommerceAdapter = wooCommerceAdapter
        self.stripeAdapter = stripeAdapter
        self.payPalAdapter = payPalAdapter
        self.xeroAdapter = xeroAdapter
        self.quickBooksAdapter = quickBooksAdapter
        self.freshBooksAdapter = freshBooksAdapter
        self.waveAdapter = waveAdapter
        self.freeAgentAdapter = freeAgentAdapter
        self.salesforceAdapter = salesforceAdapter
        self.hubSpotAdapter = hubSpotAdapter
        self.pipedriveAdapter = pipedriveAdapter
        self.copperAdapter = copperAdapter
        self.closeAdapter = closeAdapter
        self.zendeskAdapter = zendeskAdapter
        self.intercomAdapter = intercomAdapter
        self.helpScoutAdapter = helpScoutAdapter
        self.frontAdapter = frontAdapter
        self.teamworkAdapter = teamworkAdapter
        self.basecampAdapter = basecampAdapter
        self.wrikeAdapter = wrikeAdapter
        self.smartsheetAdapter = smartsheetAdapter
        self.todoistAdapter = todoistAdapter
        self.harvestAdapter = harvestAdapter
        self.calendlyAdapter = calendlyAdapter
        self.calComAdapter = calComAdapter
        self.docusignAdapter = docusignAdapter
        self.dropboxSignAdapter = dropboxSignAdapter
        self.pandaDocAdapter = pandaDocAdapter
        self.typeformAdapter = typeformAdapter
        self.sendFoxAdapter = sendFoxAdapter
        self.beehiivAdapter = beehiivAdapter
        self.substackAdapter = substackAdapter
        self.hootsuiteAdapter = hootsuiteAdapter
        self.bufferAdapter = bufferAdapter
        self.sproutSocialAdapter = sproutSocialAdapter
        self.agorapulseAdapter = agorapulseAdapter
        self.metricoolAdapter = metricoolAdapter
        self.publerAdapter = publerAdapter
        self.brandwatchAdapter = brandwatchAdapter
        self.mentionAdapter = mentionAdapter
        self.meltwaterAdapter = meltwaterAdapter
        self.sprinklrAdapter = sprinklrAdapter
        self.khorosAdapter = khorosAdapter
        self.cleverTapAdapter = cleverTapAdapter
        self.oneSignalAdapter = oneSignalAdapter
        self.airshipAdapter = airshipAdapter
        self.pushwooshAdapter = pushwooshAdapter
        self.pusherBeamsAdapter = pusherBeamsAdapter
        self.firebaseCloudMessagingAdapter = firebaseCloudMessagingAdapter
        self.appsFlyerAdapter = appsFlyerAdapter
        self.adjustAdapter = adjustAdapter
        self.branchAdapter = branchAdapter
        self.singularAdapter = singularAdapter
        self.kochavaAdapter = kochavaAdapter
        self.segmentAdapter = segmentAdapter
        self.mParticleAdapter = mParticleAdapter
        self.tealiumAdapter = tealiumAdapter
        self.lyticsAdapter = lyticsAdapter
        self.blueConicAdapter = blueConicAdapter
        self.treasureDataAdapter = treasureDataAdapter
        self.hightouchAdapter = hightouchAdapter
        self.censusAdapter = censusAdapter
        self.clioManageAdapter = clioManageAdapter
        self.clioGrowAdapter = clioGrowAdapter
        self.myCaseAdapter = myCaseAdapter
        self.practicePantherAdapter = practicePantherAdapter
        self.smokeballAdapter = smokeballAdapter
        self.lawPayAdapter = lawPayAdapter
        self.filevineAdapter = filevineAdapter
        self.laterAdapter = laterAdapter
        self.surveyMonkeyAdapter = surveyMonkeyAdapter
        self.filloutAdapter = filloutAdapter
        self.mailchimpAdapter = mailchimpAdapter
        self.klaviyoAdapter = klaviyoAdapter
        self.convertKitAdapter = convertKitAdapter
        self.campaignMonitorAdapter = campaignMonitorAdapter
        self.constantContactAdapter = constantContactAdapter
        self.notionAdapter = notionAdapter
        self.microsoftClarityAdapter = microsoftClarityAdapter
        self.postHogAdapter = postHogAdapter
        self.telemetryDeckAdapter = telemetryDeckAdapter
        self.sentryAdapter = sentryAdapter
        self.datadogAdapter = datadogAdapter
        self.pagerDutyAdapter = pagerDutyAdapter
        self.cloudflareAdapter = cloudflareAdapter
        self.vercelAdapter = vercelAdapter
        self.herokuAdapter = herokuAdapter
        self.digitalOceanAdapter = digitalOceanAdapter
        self.firebaseAdapter = firebaseAdapter
        self.supabaseAdapter = supabaseAdapter
        self.oktaAdapter = oktaAdapter
        self.bambooHRAdapter = bambooHRAdapter
        self.greenhouseAdapter = greenhouseAdapter
        self.leverAdapter = leverAdapter
        self.googleCalendarAdapter = googleCalendarAdapter
        self.googleDriveAdapter = googleDriveAdapter
        self.googleSheetsAdapter = googleSheetsAdapter
        self.googleSlidesAdapter = googleSlidesAdapter
        self.googleFormsAdapter = googleFormsAdapter
        self.googleTasksAdapter = googleTasksAdapter
        self.googleContactsAdapter = googleContactsAdapter
        self.googlePhotosAdapter = googlePhotosAdapter
        self.googleMeetAdapter = googleMeetAdapter
        self.googleChatAdapter = googleChatAdapter
        self.googleAdsAdapter = googleAdsAdapter
        self.googleAnalyticsAdapter = googleAnalyticsAdapter
        self.googleMerchantCenterAdapter = googleMerchantCenterAdapter
        self.youTubeAdapter = youTubeAdapter
        self.googleClassroomAdapter = googleClassroomAdapter
        self.outlookAdapter = outlookAdapter
        self.microsoftTeamsAdapter = microsoftTeamsAdapter
        self.oneDriveAdapter = oneDriveAdapter
        self.sharePointAdapter = sharePointAdapter
        self.microsoftPlannerAdapter = microsoftPlannerAdapter
        self.microsoftToDoAdapter = microsoftToDoAdapter
        self.microsoftListsAdapter = microsoftListsAdapter
        self.oneNoteAdapter = oneNoteAdapter
        self.microsoftBookingsAdapter = microsoftBookingsAdapter
        self.microsoftPowerBIAdapter = microsoftPowerBIAdapter
        self.microsoftDynamics365Adapter = microsoftDynamics365Adapter
        self.microsoftVivaEngageAdapter = microsoftVivaEngageAdapter
        self.zoomAdapter = zoomAdapter
        self.discordAdapter = discordAdapter
        self.fallback = fallback
    }

    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        if request.app.slug == "x" {
            return try xAdapter.execute(request: request)
        }
        if request.app.slug == "facebook-pages" {
            return try facebookPagesAdapter.execute(request: request)
        }
        if request.app.slug == "instagram-business" {
            return try instagramBusinessAdapter.execute(request: request)
        }
        if request.app.slug == "threads" { return try threadsAdapter.execute(request: request) }
        if request.app.slug == "mastodon" { return try mastodonAdapter.execute(request: request) }
        if request.app.slug == "bluesky" { return try blueskyAdapter.execute(request: request) }
        if request.app.slug == "nextdoor" { return try nextdoorAdapter.execute(request: request) }
        if request.app.slug == "meetup" { return try meetupAdapter.execute(request: request) }
        if request.app.slug == "eventbrite" { return try eventbriteAdapter.execute(request: request) }
        if request.app.slug == "luma" { return try lumaAdapter.execute(request: request) }
        if request.app.slug == "hopin" { return try hopinAdapter.execute(request: request) }
        if request.app.slug == "twist" { return try twistAdapter.execute(request: request) }
        if request.app.slug == "zoho-mail" { return try zohoMailAdapter.execute(request: request) }
        if request.app.slug == "webex" { return try webexAdapter.execute(request: request) }
        if request.app.slug == "goto-meeting" { return try goToMeetingAdapter.execute(request: request) }
        if request.app.slug == "ringcentral" { return try ringCentralAdapter.execute(request: request) }
        if request.app.slug == "dialpad" { return try dialpadAdapter.execute(request: request) }
        if request.app.slug == "aircall" { return try aircallAdapter.execute(request: request) }
        if request.app.slug == "openphone" { return try openPhoneAdapter.execute(request: request) }
        if request.app.slug == "twilio" { return try twilioAdapter.execute(request: request) }
        if request.app.slug == "vonage" { return try vonageAdapter.execute(request: request) }
        if request.app.slug == "messagebird" { return try messageBirdAdapter.execute(request: request) }
        if request.app.slug == "fred" { return try fredAdapter.execute(request: request) }
        if request.app.slug == "apollo-graphql-studio" { return try apolloGraphOSAdapter.execute(request: request) }
        if request.app.slug == "hunter-io" { return try hunterAdapter.execute(request: request) }
        if request.app.slug == "snov-io" { return try snovAdapter.execute(request: request) }
        if request.app.slug == "lusha" { return try lushaAdapter.execute(request: request) }
        if request.app.slug == "leadiq" { return try leadIQAdapter.execute(request: request) }
        if request.app.slug == "seamless-ai" { return try seamlessAIAdapter.execute(request: request) }
        if request.app.slug == "rocketreach" { return try rocketReachAdapter.execute(request: request) }
        if request.app.slug == "uplead" { return try upLeadAdapter.execute(request: request) }
        if request.app.slug == "wiza" { return try wizaAdapter.execute(request: request) }
        if request.app.slug == "line" { return try lineAdapter.execute(request: request) }
        if request.app.slug == "pinterest" { return try pinterestAdapter.execute(request: request) }
        if request.app.slug == "tumblr" { return try tumblrAdapter.execute(request: request) }
        if request.app.slug == "linkedin" {
            return try linkedInAdapter.execute(request: request)
        }
        if request.app.slug == "gmail" {
            return try gmailAdapter.execute(request: request)
        }
        if request.app.slug == "google-docs" {
            return try googleDocsAdapter.execute(request: request)
        }
        if request.app.slug == "google-search-console" {
            return try googleSearchConsoleAdapter.execute(request: request)
        }
        if request.app.slug == "slack" {
            return try slackAdapter.execute(request: request)
        }
        if request.app.slug == "github" {
            return try githubAdapter.execute(request: request)
        }
        if request.app.slug == "gitlab" {
            return try gitLabAdapter.execute(request: request)
        }
        if request.app.slug == "bitbucket" {
            return try bitbucketAdapter.execute(request: request)
        }
        if request.app.slug == "linear" {
            return try linearAdapter.execute(request: request)
        }
        if request.app.slug == "asana" {
            return try asanaAdapter.execute(request: request)
        }
        if request.app.slug == "trello" { return try trelloAdapter.execute(request: request) }
        if request.app.slug == "clickup" { return try clickUpAdapter.execute(request: request) }
        if request.app.slug == "monday-com" { return try mondayAdapter.execute(request: request) }
        if request.app.slug == "airtable" { return try airtableAdapter.execute(request: request) }
        if request.app.slug == "dropbox" { return try dropboxAdapter.execute(request: request) }
        if request.app.slug == "box" { return try boxAdapter.execute(request: request) }
        if request.app.slug == "figma" { return try figmaAdapter.execute(request: request) }
        if request.app.slug == "miro" { return try miroAdapter.execute(request: request) }
        if request.app.slug == "canva" { return try canvaAdapter.execute(request: request) }
        if request.app.slug == "webflow" { return try webflowAdapter.execute(request: request) }
        if request.app.slug == "wordpress-com" { return try wordpressComAdapter.execute(request: request) }
        if request.app.slug == "contentful" { return try contentfulAdapter.execute(request: request) }
        if request.app.slug == "shopify" { return try shopifyAdapter.execute(request: request) }
        if request.app.slug == "woocommerce" { return try wooCommerceAdapter.execute(request: request) }
        if request.app.slug == "stripe" { return try stripeAdapter.execute(request: request) }
        if request.app.slug == "paypal" { return try payPalAdapter.execute(request: request) }
        if request.app.slug == "xero" { return try xeroAdapter.execute(request: request) }
        if request.app.slug == "quickbooks" { return try quickBooksAdapter.execute(request: request) }
        if request.app.slug == "freshbooks" { return try freshBooksAdapter.execute(request: request) }
        if request.app.slug == "wave" { return try waveAdapter.execute(request: request) }
        if request.app.slug == "freeagent" { return try freeAgentAdapter.execute(request: request) }
        if request.app.slug == "salesforce" { return try salesforceAdapter.execute(request: request) }
        if request.app.slug == "hubspot" { return try hubSpotAdapter.execute(request: request) }
        if request.app.slug == "pipedrive" { return try pipedriveAdapter.execute(request: request) }
        if request.app.slug == "copper" { return try copperAdapter.execute(request: request) }
        if request.app.slug == "close" { return try closeAdapter.execute(request: request) }
        if request.app.slug == "zendesk" { return try zendeskAdapter.execute(request: request) }
        if request.app.slug == "intercom" { return try intercomAdapter.execute(request: request) }
        if request.app.slug == "help-scout" { return try helpScoutAdapter.execute(request: request) }
        if request.app.slug == "front" { return try frontAdapter.execute(request: request) }
        if request.app.slug == "teamwork" { return try teamworkAdapter.execute(request: request) }
        if request.app.slug == "basecamp" { return try basecampAdapter.execute(request: request) }
        if request.app.slug == "wrike" { return try wrikeAdapter.execute(request: request) }
        if request.app.slug == "smartsheet" { return try smartsheetAdapter.execute(request: request) }
        if request.app.slug == "todoist" { return try todoistAdapter.execute(request: request) }
        if request.app.slug == "harvest" { return try harvestAdapter.execute(request: request) }
        if request.app.slug == "calendly" { return try calendlyAdapter.execute(request: request) }
        if request.app.slug == "cal-com" { return try calComAdapter.execute(request: request) }
        if request.app.slug == "docusign" { return try docusignAdapter.execute(request: request) }
        if request.app.slug == "dropbox-sign" { return try dropboxSignAdapter.execute(request: request) }
        if request.app.slug == "pandadoc" { return try pandaDocAdapter.execute(request: request) }
        if request.app.slug == "typeform" { return try typeformAdapter.execute(request: request) }
        if request.app.slug == "sendfox" { return try sendFoxAdapter.execute(request: request) }
        if request.app.slug == "beehiiv" { return try beehiivAdapter.execute(request: request) }
        if request.app.slug == "substack" { return try substackAdapter.execute(request: request) }
        if request.app.slug == "hootsuite" { return try hootsuiteAdapter.execute(request: request) }
        if request.app.slug == "buffer" { return try bufferAdapter.execute(request: request) }
        if request.app.slug == "sprout-social" { return try sproutSocialAdapter.execute(request: request) }
        if request.app.slug == "agorapulse" { return try agorapulseAdapter.execute(request: request) }
        if request.app.slug == "metricool" { return try metricoolAdapter.execute(request: request) }
        if request.app.slug == "publer" { return try publerAdapter.execute(request: request) }
        if request.app.slug == "brandwatch" { return try brandwatchAdapter.execute(request: request) }
        if request.app.slug == "mention" { return try mentionAdapter.execute(request: request) }
        if request.app.slug == "meltwater" { return try meltwaterAdapter.execute(request: request) }
        if request.app.slug == "sprinklr" { return try sprinklrAdapter.execute(request: request) }
        if request.app.slug == "khoros" { return try khorosAdapter.execute(request: request) }
        if request.app.slug == "clevertap" { return try cleverTapAdapter.execute(request: request) }
        if request.app.slug == "onesignal" { return try oneSignalAdapter.execute(request: request) }
        if request.app.slug == "airship" { return try airshipAdapter.execute(request: request) }
        if request.app.slug == "pushwoosh" { return try pushwooshAdapter.execute(request: request) }
        if request.app.slug == "pusher-beams" { return try pusherBeamsAdapter.execute(request: request) }
        if request.app.slug == "firebase-cloud-messaging" { return try firebaseCloudMessagingAdapter.execute(request: request) }
        if request.app.slug == "appsflyer" { return try appsFlyerAdapter.execute(request: request) }
        if request.app.slug == "adjust" { return try adjustAdapter.execute(request: request) }
        if request.app.slug == "branch" { return try branchAdapter.execute(request: request) }
        if request.app.slug == "singular" { return try singularAdapter.execute(request: request) }
        if request.app.slug == "kochava" { return try kochavaAdapter.execute(request: request) }
        if request.app.slug == "segment-personas" { return try segmentAdapter.execute(request: request) }
        if request.app.slug == "mparticle" { return try mParticleAdapter.execute(request: request) }
        if request.app.slug == "tealium" { return try tealiumAdapter.execute(request: request) }
        if request.app.slug == "lytics" { return try lyticsAdapter.execute(request: request) }
        if request.app.slug == "blueconic" { return try blueConicAdapter.execute(request: request) }
        if request.app.slug == "treasure-data" { return try treasureDataAdapter.execute(request: request) }
        if request.app.slug == "hightouch" { return try hightouchAdapter.execute(request: request) }
        if request.app.slug == "census" { return try censusAdapter.execute(request: request) }
        if request.app.slug == "clio-manage" { return try clioManageAdapter.execute(request: request) }
        if request.app.slug == "clio-grow" { return try clioGrowAdapter.execute(request: request) }
        if request.app.slug == "mycase" { return try myCaseAdapter.execute(request: request) }
        if request.app.slug == "practicepanther" { return try practicePantherAdapter.execute(request: request) }
        if request.app.slug == "smokeball" { return try smokeballAdapter.execute(request: request) }
        if request.app.slug == "lawpay" { return try lawPayAdapter.execute(request: request) }
        if request.app.slug == "filevine" { return try filevineAdapter.execute(request: request) }
        if request.app.slug == "later" { return try laterAdapter.execute(request: request) }
        if request.app.slug == "surveymonkey" { return try surveyMonkeyAdapter.execute(request: request) }
        if request.app.slug == "fillout" { return try filloutAdapter.execute(request: request) }
        if request.app.slug == "mailchimp" { return try mailchimpAdapter.execute(request: request) }
        if request.app.slug == "klaviyo" { return try klaviyoAdapter.execute(request: request) }
        if request.app.slug == "convertkit" { return try convertKitAdapter.execute(request: request) }
        if request.app.slug == "campaign-monitor" { return try campaignMonitorAdapter.execute(request: request) }
        if request.app.slug == "constant-contact" { return try constantContactAdapter.execute(request: request) }
        if request.app.slug == "notion" {
            return try notionAdapter.execute(request: request)
        }
        if request.app.slug == "microsoft-clarity" {
            return try microsoftClarityAdapter.execute(request: request)
        }
        if request.app.slug == "posthog" {
            return try postHogAdapter.execute(request: request)
        }
        if request.app.slug == "telemetrydeck" {
            return try telemetryDeckAdapter.execute(request: request)
        }
        if request.app.slug == "sentry" {
            return try sentryAdapter.execute(request: request)
        }
        if request.app.slug == "datadog" {
            return try datadogAdapter.execute(request: request)
        }
        if request.app.slug == "pagerduty" {
            return try pagerDutyAdapter.execute(request: request)
        }
        if request.app.slug == "cloudflare" {
            return try cloudflareAdapter.execute(request: request)
        }
        if request.app.slug == "vercel" { return try vercelAdapter.execute(request: request) }
        if request.app.slug == "heroku" { return try herokuAdapter.execute(request: request) }
        if request.app.slug == "digitalocean" { return try digitalOceanAdapter.execute(request: request) }
        if request.app.slug == "firebase" { return try firebaseAdapter.execute(request: request) }
        if request.app.slug == "supabase" { return try supabaseAdapter.execute(request: request) }
        if request.app.slug == "okta" { return try oktaAdapter.execute(request: request) }
        if request.app.slug == "bamboohr" { return try bambooHRAdapter.execute(request: request) }
        if request.app.slug == "greenhouse" { return try greenhouseAdapter.execute(request: request) }
        if request.app.slug == "lever" { return try leverAdapter.execute(request: request) }
        if request.app.slug == "google-calendar" { return try googleCalendarAdapter.execute(request: request) }
        if request.app.slug == "google-drive" { return try googleDriveAdapter.execute(request: request) }
        if request.app.slug == "google-sheets" { return try googleSheetsAdapter.execute(request: request) }
        if request.app.slug == "google-slides" { return try googleSlidesAdapter.execute(request: request) }
        if request.app.slug == "google-forms" { return try googleFormsAdapter.execute(request: request) }
        if request.app.slug == "google-tasks" { return try googleTasksAdapter.execute(request: request) }
        if request.app.slug == "google-contacts" { return try googleContactsAdapter.execute(request: request) }
        if request.app.slug == "google-photos" { return try googlePhotosAdapter.execute(request: request) }
        if request.app.slug == "google-meet" { return try googleMeetAdapter.execute(request: request) }
        if request.app.slug == "google-chat" { return try googleChatAdapter.execute(request: request) }
        if request.app.slug == "google-ads" { return try googleAdsAdapter.execute(request: request) }
        if request.app.slug == "google-analytics" { return try googleAnalyticsAdapter.execute(request: request) }
        if request.app.slug == "google-merchant-center" { return try googleMerchantCenterAdapter.execute(request: request) }
        if request.app.slug == "youtube" { return try youTubeAdapter.execute(request: request) }
        if request.app.slug == "google-classroom" { return try googleClassroomAdapter.execute(request: request) }
        if request.app.slug == "outlook" { return try outlookAdapter.execute(request: request) }
        if request.app.slug == "microsoft-teams" { return try microsoftTeamsAdapter.execute(request: request) }
        if request.app.slug == "onedrive" { return try oneDriveAdapter.execute(request: request) }
        if request.app.slug == "sharepoint" { return try sharePointAdapter.execute(request: request) }
        if request.app.slug == "microsoft-planner" { return try microsoftPlannerAdapter.execute(request: request) }
        if request.app.slug == "microsoft-to-do" { return try microsoftToDoAdapter.execute(request: request) }
        if request.app.slug == "microsoft-lists" { return try microsoftListsAdapter.execute(request: request) }
        if request.app.slug == "onenote" { return try oneNoteAdapter.execute(request: request) }
        if request.app.slug == "microsoft-bookings" { return try microsoftBookingsAdapter.execute(request: request) }
        if request.app.slug == "microsoft-power-bi" { return try microsoftPowerBIAdapter.execute(request: request) }
        if request.app.slug == "microsoft-dynamics-365" { return try microsoftDynamics365Adapter.execute(request: request) }
        if request.app.slug == "microsoft-viva-engage" { return try microsoftVivaEngageAdapter.execute(request: request) }
        if request.app.slug == "zoom" { return try zoomAdapter.execute(request: request) }
        if request.app.slug == "discord" { return try discordAdapter.execute(request: request) }
        return try fallback.execute(request: request)
    }
}

private extension String {
    var nilIfEmpty: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}
