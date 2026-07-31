import Foundation

public struct InstagramBusinessProviderHTTPResponse: Sendable, Equatable {
    public var statusCode: Int
    public var body: Data
    public init(statusCode: Int, body: Data) { self.statusCode = statusCode; self.body = body }
}

public protocol InstagramBusinessProviderHTTPClient: Sendable {
    func get(url: URL, headers: [String: String]) throws -> InstagramBusinessProviderHTTPResponse
}

public protocol InstagramBusinessProviderActionClient: Sendable {
    func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord
}

public struct FakeInstagramBusinessProviderActionClient: InstagramBusinessProviderActionClient {
    public init() {}
    public func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        var base: JSONRecord = [
            "provider": .string("instagram-business"), "fakeAdapter": .bool(true),
            "simulated": .bool(true), "liveCredentialsUsed": .bool(false),
            "boundProfessionalAccountOnly": .bool(true), "ownedMediaOnly": .bool(true),
            "providerRequestCount": .number(1), "automaticRetry": .bool(false),
            "automaticPagination": .bool(false),
            "redactionStatus": .string("private-state-excluded"),
        ]
        let media: JSONRecord = [
            "id": .string("ig_media_1"), "caption": .string("A useful owned-media caption."),
            "captionTruncated": .bool(false), "mediaType": .string("IMAGE"),
            "mediaProductType": .string("FEED"), "timestamp": .string("2026-07-12T12:00:00Z"),
            "permalink": .string("https://www.instagram.com/p/example/"),
            "thumbnailAvailable": .bool(false),
        ]
        switch request.definition.actionKey {
        case "instagram_business_account_get":
            base["account"] = .object([
                "id": .string("ig_123"), "username": .string("relay_business"),
                "name": .string("Relay Business"), "accountType": .string("BUSINESS"),
                "mediaCount": .number(1), "profilePictureAvailable": .bool(true),
            ])
        case "instagram_business_own_media_list":
            base["media"] = .array([.object(media)])
            base["resultCount"] = .number(1)
            base["nextPageFollowed"] = .bool(false)
        case "instagram_business_own_media_get":
            _ = try LiveInstagramBusinessProviderActionClient.requiredIdentifierForAdapter(
                request.payload["mediaId"])
            base["media"] = .object(media)
            base["ownershipVerified"] = .bool(true)
        default:
            throw MarketplaceProviderActionAdapterFailure(
                code: "instagram_business_action_not_allowlisted",
                message: "Instagram Business V1 permits exactly three reads.")
        }
        return base
    }
}

public struct URLSessionInstagramBusinessProviderHTTPClient: InstagramBusinessProviderHTTPClient {
    private let timeoutSeconds: TimeInterval
    public init(timeoutSeconds: TimeInterval = 20) { self.timeoutSeconds = timeoutSeconds }

    public func get(
        url: URL, headers: [String: String]
    ) throws -> InstagramBusinessProviderHTTPResponse {
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.timeoutInterval = timeoutSeconds
        headers.forEach { request.setValue($0.value, forHTTPHeaderField: $0.key) }
        let semaphore = DispatchSemaphore(value: 0)
        var data: Data?, status: Int?, failure: Error?
        let task = URLSession.shared.dataTask(with: request) { responseData, response, error in
            data = responseData
            status = (response as? HTTPURLResponse)?.statusCode
            failure = error
            semaphore.signal()
        }
        task.resume()
        if semaphore.wait(timeout: .now() + timeoutSeconds) == .timedOut {
            task.cancel()
            throw MarketplaceProviderActionAdapterFailure(
                code: "instagram_business_http_timeout",
                message: "Instagram API request timed out without retry.",
                detail: ["automaticRetry": .bool(false)])
        }
        if failure != nil {
            throw MarketplaceProviderActionAdapterFailure(
                code: "instagram_business_network_error",
                message: "Instagram API request failed before a response was received.",
                detail: ["automaticRetry": .bool(false)])
        }
        return InstagramBusinessProviderHTTPResponse(
            statusCode: status ?? 0, body: data ?? Data())
    }
}

public final class LiveInstagramBusinessProviderActionClient:
    InstagramBusinessProviderActionClient, @unchecked Sendable
{
    private let data: LocalDataService
    private let secrets: SecretService
    private let http: any InstagramBusinessProviderHTTPClient

    public init(
        data: LocalDataService, secrets: SecretService,
        httpClient: any InstagramBusinessProviderHTTPClient = URLSessionInstagramBusinessProviderHTTPClient()
    ) {
        self.data = data
        self.secrets = secrets
        self.http = httpClient
    }

    public func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        let connection = try readyConnection(request)
        let accountId = try boundAccountId(connection)
        let token = try accessToken(connection)
        var result = base()
        switch request.definition.actionKey {
        case "instagram_business_account_get":
            let response = try send(
                path: "/me",
                query: ["fields": "id,username,name,account_type,media_count,profile_picture_url"],
                token: token)
            guard response["id"]?.string == accountId else {
                throw failure("instagram_business_account_binding_mismatch", "Instagram returned a different professional account.")
            }
            result["account"] = .object(Self.account(response))
        case "instagram_business_own_media_list":
            let limit = Self.limit(request.payload["maxResults"])
            let response = try send(
                path: "/me/media",
                query: [
                    "fields": "id,caption,media_type,media_product_type,timestamp,permalink,thumbnail_url",
                    "limit": String(limit),
                ], token: token)
            let media = Self.array(response["data"]).prefix(limit).map(Self.media)
            result["media"] = .array(media.map(JSONValue.object))
            result["resultCount"] = .number(Double(media.count))
            result["nextPageFollowed"] = .bool(false)
        case "instagram_business_own_media_get":
            let mediaId = try Self.requiredIdentifier(request.payload["mediaId"])
            let response = try send(
                path: "/\(mediaId)",
                query: ["fields": "id,caption,media_type,media_product_type,timestamp,permalink,thumbnail_url,owner"],
                token: token)
            guard Self.object(response["owner"])["id"]?.string == accountId else {
                throw failure("instagram_business_media_not_owned", "The requested media item is not owned by the bound professional account.")
            }
            result["media"] = .object(Self.media(.object(response)))
            result["ownershipVerified"] = .bool(true)
        default:
            throw failure("instagram_business_action_not_allowlisted", "Instagram Business V1 permits exactly three reads.")
        }
        return result
    }

    private func readyConnection(
        _ request: MarketplaceProviderActionAdapterRequest
    ) throws -> MarketplaceProviderConnection {
        guard let id = request.auditIdentity.connectionId?.instagramNilIfEmpty,
              let connection = try data.getProviderConnection(
                workspaceId: request.context.workspaceId, connectionId: id),
              connection.appId == request.app.id, connection.appSlug == "instagram-business",
              connection.status == .connected, connection.health.state == .ready,
              connection.grantedScopes == ProviderConnectionService.instagramBusinessRelayOwnedOAuthScopes,
              connection.health.diagnostics["professionalAccountVerified"]?.bool == true,
              connection.health.diagnostics["ownedMediaOnly"]?.bool == true,
              connection.health.diagnostics["publishingEnabled"]?.bool == false,
              connection.health.diagnostics["automaticRetry"]?.bool == false,
              connection.health.diagnostics["automaticPagination"]?.bool == false,
              connection.health.diagnostics["rawToolsEnabled"]?.bool == false else {
            throw failure(
                "instagram_business_connection_not_ready",
                "A ready exact-scope Instagram professional-account connection is required.")
        }
        return connection
    }

    private func boundAccountId(_ connection: MarketplaceProviderConnection) throws -> String {
        guard let id = connection.health.diagnostics["professionalAccountId"]?.string?.instagramNilIfEmpty,
              id.allSatisfy({ $0.isLetter || $0.isNumber || "-_".contains($0) }) else {
            throw failure("instagram_business_binding_invalid", "The professional-account binding is invalid.")
        }
        return id
    }

    private func accessToken(_ connection: MarketplaceProviderConnection) throws -> String {
        guard let ref = connection.credentialRequirements.first(where: {
            $0.fieldKey == "instagram_business_user_access_token"
        })?.secretReferenceId,
              let token = try secrets.getSecretValue(ref).instagramNilIfEmpty else {
            throw failure("instagram_business_token_unavailable", "The Instagram token is unavailable; reconnect is required.")
        }
        return token
    }

    private func send(path: String, query: [String: String], token: String) throws -> JSONRecord {
        var components = URLComponents(string: "https://graph.instagram.com" + path)
        components?.queryItems = query.sorted { $0.key < $1.key }.map {
            URLQueryItem(name: $0.key, value: $0.value)
        }
        guard let url = components?.url else {
            throw failure("instagram_business_invalid_request", "Instagram request construction failed.")
        }
        let response = try http.get(
            url: url, headers: ["Authorization": "Bearer \(token)", "Accept": "application/json"])
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: Self.errorCode(response.statusCode),
                message: "Instagram API rejected the request.",
                providerStatusCode: response.statusCode,
                detail: ["providerBodyPresent": .bool(!response.body.isEmpty), "automaticRetry": .bool(false)])
        }
        guard let object = try JSONSerialization.jsonObject(with: response.body) as? [String: Any] else {
            throw failure("instagram_business_invalid_json", "Instagram API returned malformed JSON.")
        }
        return jsonRecord(from: object)
    }

    private func base() -> JSONRecord {
        [
            "provider": .string("instagram-business"), "fakeAdapter": .bool(false),
            "simulated": .bool(false), "liveCredentialsUsed": .bool(true),
            "boundProfessionalAccountOnly": .bool(true), "ownedMediaOnly": .bool(true),
            "providerRequestCount": .number(1), "automaticRetry": .bool(false),
            "automaticPagination": .bool(false),
            "redactionStatus": .string("private-state-excluded"),
        ]
    }

    private func failure(_ code: String, _ message: String) -> MarketplaceProviderActionAdapterFailure {
        MarketplaceProviderActionAdapterFailure(code: code, message: message)
    }

    private static func account(_ value: JSONRecord) -> JSONRecord {
        [
            "id": scalar(value["id"]), "username": scalar(value["username"], maximum: 64),
            "name": scalar(value["name"]), "accountType": scalar(value["account_type"], maximum: 32),
            "mediaCount": scalar(value["media_count"]),
            "profilePictureAvailable": .bool(value["profile_picture_url"]?.string?.instagramNilIfEmpty != nil),
        ]
    }

    private static func media(_ value: JSONValue) -> JSONRecord {
        let item = object(value), caption = item["caption"]?.string ?? ""
        return [
            "id": scalar(item["id"]), "caption": .string(String(caption.prefix(2000))),
            "captionTruncated": .bool(caption.count > 2000),
            "mediaType": scalar(item["media_type"], maximum: 32),
            "mediaProductType": scalar(item["media_product_type"], maximum: 32),
            "timestamp": scalar(item["timestamp"], maximum: 64),
            "permalink": scalar(item["permalink"], maximum: 2048),
            "thumbnailAvailable": .bool(item["thumbnail_url"]?.string?.instagramNilIfEmpty != nil),
        ]
    }

    private static func requiredIdentifier(_ value: JSONValue?) throws -> String {
        guard let id = value?.string?.instagramNilIfEmpty, id.count <= 128,
              id.allSatisfy({ $0.isLetter || $0.isNumber || "-_".contains($0) }) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "instagram_business_invalid_media_id",
                message: "A safe owned Instagram media ID is required.")
        }
        return id
    }
    fileprivate static func requiredIdentifierForAdapter(_ value: JSONValue?) throws -> String {
        try requiredIdentifier(value)
    }
    private static func limit(_ value: JSONValue?) -> Int {
        guard let number = value?.number, number.isFinite else { return 10 }
        return min(10, max(1, Int(number)))
    }
    private static func array(_ value: JSONValue?) -> [JSONValue] {
        if case .array(let values)? = value { return values }; return []
    }
    private static func object(_ value: JSONValue?) -> JSONRecord {
        if case .object(let record)? = value { return record }; return [:]
    }
    private static func scalar(_ value: JSONValue?, maximum: Int = 512) -> JSONValue {
        guard let value else { return .null }
        if case .string(let text) = value { return .string(String(text.prefix(maximum))) }
        switch value { case .number, .bool, .null: return value; default: return .null }
    }
    private static func errorCode(_ status: Int) -> String {
        switch status {
        case 400: return "instagram_business_invalid_request"
        case 401: return "instagram_business_invalid_token"
        case 403: return "instagram_business_permission_denied"
        case 429: return "instagram_business_rate_limited"
        default: return status >= 500 ? "instagram_business_provider_unavailable" : "instagram_business_http_error"
        }
    }
}

public struct InstagramBusinessProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = [
        "instagram_business_account_get", "instagram_business_own_media_list",
        "instagram_business_own_media_get",
    ]
    private let client: any InstagramBusinessProviderActionClient

    public init(
        client: any InstagramBusinessProviderActionClient = FakeInstagramBusinessProviderActionClient()
    ) { self.client = client }

    public func execute(
        request: MarketplaceProviderActionAdapterRequest
    ) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "instagram-business",
              Self.allowed.contains(request.definition.actionKey) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "instagram_business_action_not_allowlisted",
                message: "Instagram Business V1 permits exactly three reads.")
        }
        let allowedPayload: Set<String>
        switch request.definition.actionKey {
        case "instagram_business_own_media_list": allowedPayload = ["maxResults"]
        case "instagram_business_own_media_get": allowedPayload = ["mediaId"]
        default: allowedPayload = []
        }
        guard Set(request.payload.keys).isSubset(of: allowedPayload) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "instagram_business_payload_not_supported",
                message: "Instagram Business rejects account overrides, cursors, fields, URLs, publishing, people data, and raw parameters.")
        }
        return MarketplaceProviderActionAdapterResult(result: try client.execute(request))
    }
}

private extension String {
    var instagramNilIfEmpty: String? {
        let value = trimmingCharacters(in: .whitespacesAndNewlines)
        return value.isEmpty ? nil : value
    }
}
