import Foundation
import Darwin

public enum MastodonPublicNetworkBoundary {
    public static func requirePublicDNSHost(_ host: String) throws {
        guard !host.isEmpty, !isIPAddressLiteral(host) else {
            throw MastodonProviderActionSupport.failure(
                "mastodon_instance_ip_literal_rejected",
                "Mastodon instance requests require a public DNS hostname, not an IP literal.")
        }
        var hints = addrinfo()
        hints.ai_family = AF_UNSPEC
        hints.ai_socktype = SOCK_STREAM
        hints.ai_protocol = IPPROTO_TCP
        var result: UnsafeMutablePointer<addrinfo>?
        let status = getaddrinfo(host, nil, &hints, &result)
        guard status == 0, let first = result else {
            throw MastodonProviderActionSupport.failure(
                "mastodon_instance_dns_failed",
                "Mastodon instance DNS resolution failed closed before the request.")
        }
        defer { freeaddrinfo(first) }
        var cursor: UnsafeMutablePointer<addrinfo>? = first
        var found = false
        while let current = cursor {
            guard let address = current.pointee.ai_addr else {
                cursor = current.pointee.ai_next; continue
            }
            let allowed: Bool
            switch Int32(address.pointee.sa_family) {
            case AF_INET:
                let value = address.withMemoryRebound(to: sockaddr_in.self, capacity: 1) {
                    UInt32(bigEndian: $0.pointee.sin_addr.s_addr)
                }
                allowed = isPublicIPv4(value)
            case AF_INET6:
                var value = address.withMemoryRebound(to: sockaddr_in6.self, capacity: 1) {
                    $0.pointee.sin6_addr
                }
                let bytes = withUnsafeBytes(of: &value) { Array($0) }
                allowed = isPublicIPv6(bytes)
            default:
                allowed = false
            }
            guard allowed else {
                throw MastodonProviderActionSupport.failure(
                    "mastodon_instance_private_address_rejected",
                    "Mastodon instance DNS resolved to a non-public address; the request was blocked.")
            }
            found = true
            cursor = current.pointee.ai_next
        }
        guard found else {
            throw MastodonProviderActionSupport.failure(
                "mastodon_instance_dns_empty",
                "Mastodon instance DNS returned no usable public address.")
        }
    }

    public static func isPublicIPv4(_ value: UInt32) -> Bool {
        let a = UInt8((value >> 24) & 0xff), b = UInt8((value >> 16) & 0xff)
        if a == 0 || a == 10 || a == 127 || a >= 224 { return false }
        if a == 100 && (64...127).contains(b) { return false }
        if a == 169 && b == 254 { return false }
        if a == 172 && (16...31).contains(b) { return false }
        if a == 192 && [0, 168].contains(b) { return false }
        if a == 192 && b == 0 { return false }
        if a == 192 && b == 0 { return false }
        if a == 192 && b == 2 { return false }
        if a == 198 && (b == 18 || b == 19 || b == 51) { return false }
        if a == 203 && b == 0 { return false }
        return true
    }

    public static func isPublicIPv6(_ bytes: [UInt8]) -> Bool {
        guard bytes.count == 16 else { return false }
        if bytes.allSatisfy({ $0 == 0 }) || bytes.dropLast().allSatisfy({ $0 == 0 }) && bytes[15] == 1 { return false }
        if bytes[0] == 0xff || (bytes[0] & 0xfe) == 0xfc { return false }
        if bytes[0] == 0xfe && (bytes[1] & 0xc0) == 0x80 { return false }
        if bytes[0] == 0x20 && bytes[1] == 0x01 && bytes[2] == 0x0d && bytes[3] == 0xb8 { return false }
        if bytes.prefix(10).allSatisfy({ $0 == 0 }) && bytes[10] == 0xff && bytes[11] == 0xff {
            let value = UInt32(bytes[12]) << 24 | UInt32(bytes[13]) << 16
                | UInt32(bytes[14]) << 8 | UInt32(bytes[15])
            return isPublicIPv4(value)
        }
        return true
    }

    private static func isIPAddressLiteral(_ host: String) -> Bool {
        var ipv4 = in_addr(), ipv6 = in6_addr()
        return host.withCString { inet_pton(AF_INET, $0, &ipv4) == 1 }
            || host.withCString { inet_pton(AF_INET6, $0, &ipv6) == 1 }
    }
}

public struct MastodonProviderHTTPRequest: Sendable, Equatable {
    public var method: String; public var url: URL; public var headers: [String: String]; public var body: Data?
    public init(method: String, url: URL, headers: [String: String], body: Data? = nil) {
        self.method = method; self.url = url; self.headers = headers; self.body = body
    }
}
public struct MastodonProviderHTTPResponse: Sendable, Equatable {
    public var statusCode: Int; public var body: Data
    public init(statusCode: Int, body: Data) { self.statusCode = statusCode; self.body = body }
}
public protocol MastodonProviderHTTPClient: Sendable {
    func send(_ request: MastodonProviderHTTPRequest) throws -> MastodonProviderHTTPResponse
}
public struct URLSessionMastodonProviderHTTPClient: MastodonProviderHTTPClient {
    private let timeoutSeconds: TimeInterval
    public init(timeoutSeconds: TimeInterval = 20) { self.timeoutSeconds = timeoutSeconds }
    public func send(_ request: MastodonProviderHTTPRequest) throws -> MastodonProviderHTTPResponse {
        guard let host = request.url.host else {
            throw MastodonProviderActionSupport.failure(
                "mastodon_instance_host_missing", "Mastodon request host is missing.")
        }
        try MastodonPublicNetworkBoundary.requirePublicDNSHost(host)
        var value = URLRequest(url: request.url); value.httpMethod = request.method
        value.httpBody = request.body; value.timeoutInterval = timeoutSeconds
        request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) }
        let semaphore = DispatchSemaphore(value: 0); var data: Data?, status: Int?, failure: Error?
        let configuration = URLSessionConfiguration.ephemeral
        configuration.httpShouldSetCookies = false; configuration.urlCache = nil; configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
        let session = URLSession(configuration: configuration, delegate: NoRedirectDelegate(), delegateQueue: nil)
        let task = session.dataTask(with: value) { d, r, e in data = d; status = (r as? HTTPURLResponse)?.statusCode; failure = e; semaphore.signal() }
        task.resume()
        if semaphore.wait(timeout: .now() + timeoutSeconds) == .timedOut {
            task.cancel(); session.invalidateAndCancel()
            throw MastodonProviderActionSupport.failure("mastodon_http_timeout", "Mastodon API request timed out without retry.")
        }
        session.finishTasksAndInvalidate()
        if failure != nil { throw MastodonProviderActionSupport.failure("mastodon_network_error", "Mastodon API request failed before a response was received.") }
        return MastodonProviderHTTPResponse(statusCode: status ?? 0, body: data ?? Data())
    }
    private final class NoRedirectDelegate: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
        func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
    }
}

public protocol MastodonProviderActionClient: Sendable {
    func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord
}

public enum MastodonProviderActionSupport {
    static func normalizedStatus(_ payload: JSONRecord, maxCharacters: Int = 500) throws -> (String, String, String?) {
        guard let text = payload["text"]?.string?.mastodonNilIfEmpty else { throw failure("mastodon_missing_text", "Mastodon text actions require non-empty text.") }
        guard text.count <= min(500, maxCharacters) else { throw failure("mastodon_text_too_long", "The status exceeds the connected instance character limit.") }
        let visibility = payload["visibility"]?.string?.lowercased().mastodonNilIfEmpty ?? "public"
        guard ["public", "unlisted"].contains(visibility) else { throw failure("mastodon_visibility_not_supported", "Mastodon V1 permits only public or unlisted statuses.") }
        let language = payload["language"]?.string?.lowercased().mastodonNilIfEmpty
        if let language, language.count > 35 || language.range(of: #"^[a-z]{2,3}(-[a-z0-9]{2,8})*$"#, options: .regularExpression) == nil {
            throw failure("mastodon_language_invalid", "Mastodon language must be a bounded BCP 47-style tag.")
        }
        return (text, visibility, language)
    }
    static func failure(_ code: String, _ message: String, status: Int? = nil) -> MarketplaceProviderActionAdapterFailure {
        MarketplaceProviderActionAdapterFailure(code: code, message: message, providerStatusCode: status, detail: ["automaticRetry": .bool(false)])
    }
}

public struct FakeMastodonProviderActionClient: MastodonProviderActionClient {
    public init() {}
    public func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        var result = base(request.definition.kind == .draft ? 0 : 1)
        switch request.definition.actionKey {
        case "mastodon_account_get":
            result["account"] = .object([
                "id": .string("109000000000000001"), "username": .string("relay"), "acct": .string("relay"), "displayName": .string("Relay"), "profileURL": .string("https://social.example/@relay"), "avatarAvailable": .bool(true), "instanceOrigin": .string("https://social.example"),
            ])
        case "mastodon_own_statuses_list":
            result["statuses"] = .array([
                .object([
                    "id": .string("110000000000000001"), "text": .string("A useful Mastodon update."), "createdAt": .string("2026-07-12T12:00:00Z"), "url": .string("https://social.example/@relay/110000000000000001"), "visibility": .string("public"), "language": .string("en"),
                    "contentWarningPresent": .bool(false),
                ])
            ]); result["resultCount"] = .number(1); result["nextPageFollowed"] = .bool(false)
        case "mastodon_text_status_draft", "mastodon_text_status_publish":
            let value = try MastodonProviderActionSupport.normalizedStatus(request.payload)
            result["text"] = .string(value.0); result["visibility"] = .string(value.1); result["language"] = value.2.map(JSONValue.string) ?? .null; result["characterCount"] = .number(Double(value.0.count))
            if request.definition.kind == .draft { result["providerCallMade"] = .bool(false) }
            else {
                result["statusId"] = .string("110000000000000002"); result["accountId"] = .string("109000000000000001"); result["instanceOrigin"] = .string("https://social.example"); result["url"] = .string("https://social.example/@relay/110000000000000002");
                result["providerAcknowledged"] = .bool(true); result["ambiguous"] = .bool(false)
            }
        default: throw MastodonProviderActionSupport.failure("mastodon_action_not_allowlisted", "Mastodon V1 permits exactly four actions.")
        }
        return result
    }
    private func base(_ count: Int) -> JSONRecord {
        [
            "provider": .string("mastodon"), "fakeAdapter": .bool(true), "simulated": .bool(true), "liveCredentialsUsed": .bool(false), "boundInstanceAccountOnly": .bool(true), "providerRequestCount": .number(Double(count)), "automaticRetry": .bool(false), "automaticPagination": .bool(false),
            "providerDataPersisted": .bool(false), "redactionStatus": .string("provider-content-not-stored"),
        ]
    }
}

public final class LiveMastodonProviderActionClient: MastodonProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService; private let secrets: SecretService; private let http: any MastodonProviderHTTPClient
    public init(data: LocalDataService, secrets: SecretService, httpClient: any MastodonProviderHTTPClient = URLSessionMastodonProviderHTTPClient()) { self.data = data; self.secrets = secrets; self.http = httpClient }
    public func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        if request.definition.actionKey == "mastodon_text_status_draft" {
            let value = try MastodonProviderActionSupport.normalizedStatus(request.payload)
            var result = base(0); result["text"] = .string(value.0); result["visibility"] = .string(value.1); result["language"] = value.2.map(JSONValue.string) ?? .null; result["characterCount"] = .number(Double(value.0.count)); result["providerCallMade"] = .bool(false); return result
        }
        let connection = try readyConnection(request), origin = try verifiedOrigin(connection), accountId = try boundAccountId(connection), token = try accessToken(connection)
        var result = base(1)
        switch request.definition.actionKey {
        case "mastodon_account_get":
            let value = try send("GET", "/api/v1/accounts/verify_credentials", [], nil, token, origin, nil)
            guard value["id"]?.string == accountId else { throw MastodonProviderActionSupport.failure("mastodon_account_binding_mismatch", "Mastodon returned a different local account.") }
            result["account"] = .object(Self.account(value, origin: origin.absoluteString))
        case "mastodon_own_statuses_list":
            let limit = Self.limit(request.payload["maxResults"]),
                value = try send("GET", "/api/v1/accounts/\(Self.segment(accountId))/statuses", [URLQueryItem(name: "exclude_replies", value: "true"), URLQueryItem(name: "exclude_reblogs", value: "true"), URLQueryItem(name: "limit", value: String(limit))], nil, token, origin, nil)
            let statuses = Self.array(.object(value)).prefix(limit).compactMap { status -> JSONRecord? in
                let object = Self.object(status); guard object["in_reply_to_id"] == nil || object["in_reply_to_id"] == .null, object["reblog"] == nil || object["reblog"] == .null else { return nil }; return Self.status(object)
            }
            result["statuses"] = .array(statuses.map(JSONValue.object)); result["resultCount"] = .number(Double(statuses.count)); result["nextPageFollowed"] = .bool(false)
        case "mastodon_text_status_publish":
            let max = Int(connection.health.diagnostics["maxStatusCharacters"]?.number ?? 500), value = try MastodonProviderActionSupport.normalizedStatus(request.payload, maxCharacters: max)
            var body: [String: Any] = ["status": value.0, "visibility": value.1]; if let language = value.2 { body["language"] = language }
            let published = try send("POST", "/api/v1/statuses", [], try JSONSerialization.data(withJSONObject: body), token, origin, request.idempotencyKey)
            guard let statusId = published["id"]?.string?.mastodonNilIfEmpty, Self.object(published["account"])["id"]?.string == accountId else {
                throw MastodonProviderActionSupport.failure("mastodon_ambiguous_publish_response", "Mastodon did not confirm the bound account and status id; Relay will not retry.")
            }
            result["statusId"] = .string(statusId); result["accountId"] = .string(accountId); result["instanceOrigin"] = .string(origin.absoluteString); result["url"] = Self.scalar(published["url"], 2048); result["text"] = .string(value.0); result["visibility"] = .string(value.1);
            result["language"] = value.2.map(JSONValue.string) ?? .null; result["characterCount"] = .number(Double(value.0.count)); result["providerAcknowledged"] = .bool(true); result["ambiguous"] = .bool(false)
        default: throw MastodonProviderActionSupport.failure("mastodon_live_action_not_allowlisted", "Live Mastodon execution does not support this action.")
        }
        return result
    }
    private func readyConnection(_ request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderConnection {
        guard let id = request.auditIdentity.connectionId?.mastodonNilIfEmpty, let c = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), c.appId == request.app.id, c.appSlug == "mastodon", c.status == .connected, c.health.state == .ready,
            c.grantedScopes == ProviderConnectionService.mastodonRelayOwnedOAuthScopes, c.health.diagnostics["instanceVerified"]?.bool == true, c.health.diagnostics["issuerVerified"]?.bool == true, c.health.diagnostics["serverOriginRestricted"]?.bool == true,
            c.health.diagnostics["dnsRevalidationRequired"]?.bool == true, c.health.diagnostics["redirectsAllowed"]?.bool == false, c.health.diagnostics["ipLiteralOriginsAllowed"]?.bool == false, c.health.diagnostics["accountVerified"]?.bool == true,
            c.health.diagnostics["ownStatusesOnly"]?.bool == true, c.health.diagnostics["providerDataPersisted"]?.bool == false, c.health.diagnostics["publicUnlistedOnly"]?.bool == true, c.health.diagnostics["automaticRetry"]?.bool == false,
            c.health.diagnostics["automaticPagination"]?.bool == false, c.health.diagnostics["rawToolsEnabled"]?.bool == false
        else { throw MastodonProviderActionSupport.failure("mastodon_connection_not_ready", "A ready exact-scope verified-instance Mastodon account connection is required.") }; return c
    }
    private func verifiedOrigin(_ c: MarketplaceProviderConnection) throws -> URL {
        guard let text = c.health.diagnostics["apiOrigin"]?.string, let url = URL(string: text), url.scheme == "https", url.host?.lowercased() == c.health.diagnostics["instanceDomain"]?.string?.lowercased(), url.port == nil || url.port == 443, url.user == nil, url.password == nil,
            (url.path.isEmpty || url.path == "/"), url.query == nil, url.fragment == nil
        else { throw MastodonProviderActionSupport.failure("mastodon_instance_binding_invalid", "The saved Mastodon instance origin is invalid.") }; return url
    }
    private func boundAccountId(_ c: MarketplaceProviderConnection) throws -> String {
        guard let id = c.health.diagnostics["accountId"]?.string?.mastodonNilIfEmpty, id.count <= 256, id.allSatisfy({ $0.isLetter || $0.isNumber || "-_".contains($0) }) else {
            throw MastodonProviderActionSupport.failure("mastodon_account_binding_invalid", "The saved Mastodon account binding is invalid.")
        }; return id
    }
    private func accessToken(_ c: MarketplaceProviderConnection) throws -> String {
        guard let ref = c.credentialRequirements.first(where: { $0.fieldKey == "mastodon_oauth_access_token" })?.secretReferenceId, let token = try secrets.getSecretValue(ref).mastodonNilIfEmpty else {
            throw MastodonProviderActionSupport.failure("mastodon_token_unavailable", "The Mastodon access token is unavailable; reconnect is required.")
        }; return token
    }
    private func send(_ method: String, _ path: String, _ query: [URLQueryItem], _ body: Data?, _ token: String, _ origin: URL, _ idempotencyKey: String?) throws -> JSONRecord {
        var components = URLComponents(url: origin, resolvingAgainstBaseURL: false); components?.path = path; components?.queryItems = query.isEmpty ? nil : query
        guard let url = components?.url, url.scheme == "https", url.host == origin.host else { throw MastodonProviderActionSupport.failure("mastodon_invalid_request", "Mastodon request construction failed.") }
        var headers = ["Authorization": "Bearer \(token)", "Accept": "application/json"]; if body != nil { headers["Content-Type"] = "application/json" }; if let idempotencyKey { headers["Idempotency-Key"] = idempotencyKey }
        let response = try http.send(MastodonProviderHTTPRequest(method: method, url: url, headers: headers, body: body))
        guard (200..<300).contains(response.statusCode) else { throw MastodonProviderActionSupport.failure(Self.errorCode(response.statusCode), "Mastodon API rejected the request.", status: response.statusCode) }
        let object = try JSONSerialization.jsonObject(with: response.body)
        if let record = object as? [String: Any] { return jsonRecord(from: record) }
        if let array = object as? [Any] { return ["items": .array(array.map { Self.jsonValue($0) })] }
        throw MastodonProviderActionSupport.failure("mastodon_invalid_json", "Mastodon API returned malformed JSON.")
    }
    private func base(_ count: Int) -> JSONRecord {
        [
            "provider": .string("mastodon"), "fakeAdapter": .bool(false), "simulated": .bool(false), "liveCredentialsUsed": .bool(true), "boundInstanceAccountOnly": .bool(true), "providerRequestCount": .number(Double(count)), "automaticRetry": .bool(false), "automaticPagination": .bool(false),
            "providerDataPersisted": .bool(false), "redactionStatus": .string("provider-content-not-stored"),
        ]
    }
    private static func account(_ value: JSONRecord, origin: String) -> JSONRecord {
        [
            "id": scalar(value["id"]), "username": scalar(value["username"], 128), "acct": scalar(value["acct"], 320), "displayName": scalar(value["display_name"]), "profileURL": scalar(value["url"], 2048), "avatarAvailable": .bool(value["avatar"]?.string?.mastodonNilIfEmpty != nil),
            "instanceOrigin": .string(origin),
        ]
    }
    private static func status(_ value: JSONRecord) -> JSONRecord {
        let warning = value["spoiler_text"]?.string ?? "";
        return [
            "id": scalar(value["id"]), "text": .string(plainText(value["content"]?.string ?? "")), "createdAt": scalar(value["created_at"], 64), "url": scalar(value["url"], 2048), "visibility": scalar(value["visibility"], 32), "language": scalar(value["language"], 35),
            "contentWarningPresent": .bool(!warning.isEmpty),
        ]
    }
    private static func plainText(_ html: String) -> String {
        var value = html.replacingOccurrences(of: #"<br\s*/?>"#, with: "\n", options: [.regularExpression, .caseInsensitive]); value = value.replacingOccurrences(of: #"</p\s*>"#, with: "\n", options: [.regularExpression, .caseInsensitive]);
        value = value.replacingOccurrences(of: #"<[^>]+>"#, with: "", options: .regularExpression); for pair in [("&amp;", "&"), ("&lt;", "<"), ("&gt;", ">"), ("&quot;", "\""), ("&#39;", "'")] { value = value.replacingOccurrences(of: pair.0, with: pair.1) };
        return String(value.trimmingCharacters(in: .whitespacesAndNewlines).prefix(5000))
    }
    private static func limit(_ value: JSONValue?) -> Int { guard let number = value?.number, number.isFinite else { return 10 }; return min(10, max(1, Int(number))) }
    private static func segment(_ value: String) -> String { value.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? value }
    private static func array(_ value: JSONValue?) -> [JSONValue] { if case .object(let object)? = value, case .array(let values)? = object["items"] { return values }; return [] }
    private static func object(_ value: JSONValue?) -> JSONRecord { if case .object(let object)? = value { return object }; return [:] }
    private static func scalar(_ value: JSONValue?, _ max: Int = 512) -> JSONValue { guard let value else { return .null }; if case .string(let text) = value { return .string(String(text.prefix(max))) }; switch value { case .number, .bool, .null: return value; default: return .null } }
    private static func jsonValue(_ value: Any) -> JSONValue {
        if let object = value as? [String: Any] { return .object(jsonRecord(from: object)) }; if let array = value as? [Any] { return .array(array.map(jsonValue)) }; if let text = value as? String { return .string(text) };
        if let number = value as? NSNumber { return CFGetTypeID(number) == CFBooleanGetTypeID() ? .bool(number.boolValue) : .number(number.doubleValue) }; return .null
    }
    private static func errorCode(_ status: Int) -> String {
        switch status {
        case 400: return "mastodon_invalid_request";
        case 401: return "mastodon_invalid_token";
        case 403: return "mastodon_permission_denied";
        case 404: return "mastodon_resource_not_found";
        case 422: return "mastodon_validation_failed";
        case 429: return "mastodon_rate_limited";
        default: return status >= 500 ? "mastodon_instance_unavailable" : "mastodon_http_error"
        }
    }
}

public struct MastodonProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = ["mastodon_account_get", "mastodon_own_statuses_list", "mastodon_text_status_draft", "mastodon_text_status_publish"]
    private let client: any MastodonProviderActionClient
    public init(client: any MastodonProviderActionClient = FakeMastodonProviderActionClient()) { self.client = client }
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "mastodon", Self.allowed.contains(request.definition.actionKey) else { throw MastodonProviderActionSupport.failure("mastodon_action_not_allowlisted", "Mastodon V1 permits exactly four actions.") }
        let allowedPayload: Set<String>; switch request.definition.actionKey { case "mastodon_own_statuses_list": allowedPayload = ["maxResults"]; case "mastodon_text_status_draft", "mastodon_text_status_publish": allowedPayload = ["text", "visibility", "language"]; default: allowedPayload = [] }
        guard Set(request.payload.keys).isSubset(of: allowedPayload) else {
            throw MastodonProviderActionSupport.failure("mastodon_payload_not_supported", "Mastodon rejects instance/account overrides, cursors, federation, replies, quotes, private/direct visibility, engagement, media, polls, content warnings, scheduling, destructive, admin, and raw parameters.")
        }
        return MarketplaceProviderActionAdapterResult(result: try client.execute(request))
    }
}
private extension String { var mastodonNilIfEmpty: String? { let value = trimmingCharacters(in: .whitespacesAndNewlines); return value.isEmpty ? nil : value } }
