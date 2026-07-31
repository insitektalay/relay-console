import Foundation

public struct PinterestProviderHTTPRequest: Sendable, Equatable {
    public var method: String; public var url: URL; public var headers: [String: String]
    public init(method: String, url: URL, headers: [String: String]) { self.method = method; self.url = url; self.headers = headers }
}
public struct PinterestProviderHTTPResponse: Sendable, Equatable {
    public var statusCode: Int; public var body: Data
    public init(statusCode: Int, body: Data) { self.statusCode = statusCode; self.body = body }
}
public protocol PinterestProviderHTTPClient: Sendable {
    func send(_ request: PinterestProviderHTTPRequest) throws -> PinterestProviderHTTPResponse
}
public struct URLSessionPinterestProviderHTTPClient: PinterestProviderHTTPClient {
    private let timeoutSeconds: TimeInterval
    public init(timeoutSeconds: TimeInterval = 20) { self.timeoutSeconds = timeoutSeconds }
    public func send(_ request: PinterestProviderHTTPRequest) throws -> PinterestProviderHTTPResponse {
        var value = URLRequest(url: request.url); value.httpMethod = request.method; value.timeoutInterval = timeoutSeconds
        request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) }
        let semaphore = DispatchSemaphore(value: 0); var data: Data?, status: Int?, failure: Error?
        let task = URLSession.shared.dataTask(with: value) { d, r, e in data = d; status = (r as? HTTPURLResponse)?.statusCode; failure = e; semaphore.signal() }
        task.resume()
        if semaphore.wait(timeout: .now() + timeoutSeconds) == .timedOut {
            task.cancel(); throw PinterestProviderActionSupport.failure("pinterest_http_timeout", "Pinterest API request timed out without retry.")
        }
        if failure != nil { throw PinterestProviderActionSupport.failure("pinterest_network_error", "Pinterest API request failed before a response was received.") }
        return PinterestProviderHTTPResponse(statusCode: status ?? 0, body: data ?? Data())
    }
}

public protocol PinterestProviderActionClient: Sendable {
    func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord
}
public enum PinterestProviderActionSupport {
    static func identifier(_ value: JSONValue?) throws -> String {
        guard let id = value?.string?.pinterestNilIfEmpty, id.count <= 128,
              id.allSatisfy({ $0.isLetter || $0.isNumber || "-_".contains($0) }) else {
            throw failure("pinterest_invalid_pin_id", "A safe bound Pinterest Pin ID is required.")
        }; return id
    }
    static func failure(_ code: String, _ message: String) -> MarketplaceProviderActionAdapterFailure {
        MarketplaceProviderActionAdapterFailure(code: code, message: message, detail: ["automaticRetry": .bool(false), "providerDataPersisted": .bool(false)])
    }
}

public struct FakePinterestProviderActionClient: PinterestProviderActionClient {
    public init() {}
    public func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        var result = base()
        let pin: JSONRecord = [
            "id": .string("pin_1"), "title": .string("Quiet reading corner"),
            "description": .string("A warm reading corner with natural wood shelves."),
            "altText": .string("Wooden shelves beside a reading chair"),
            "link": .string("https://example.invalid/reading-corner"),
            "createdAt": .string("2026-07-12T12:00:00Z"), "mediaType": .string("image"),
            "imageURL": .string("https://images.example.invalid/pin.jpg"),
            "boardId": .string("board_1"), "boardOwnerUsername": .string("relay_pinner"),
        ]
        switch request.definition.actionKey {
        case "pinterest_user_account_get":
            result["userAccount"] = .object(["id": .string("pin_user_123"), "username": .string("relay_pinner"), "accountType": .string("BUSINESS"), "profileImageURL": .string("https://images.example.invalid/profile.jpg"), "websiteURL": .string("https://example.invalid")])
        case "pinterest_public_boards_list":
            result["boards"] = .array([.object(["id": .string("board_1"), "name": .string("Calm interiors"), "description": .string("Warm and practical room ideas."), "privacy": .string("PUBLIC"), "ownerUsername": .string("relay_pinner"), "pinCount": .number(8)])]);
            result["resultCount"] = .number(1); result["nextPageFollowed"] = .bool(false)
        case "pinterest_public_pins_list":
            result["pins"] = .array([.object(pin)]); result["resultCount"] = .number(1); result["nextPageFollowed"] = .bool(false)
        case "pinterest_public_pin_get":
            _ = try PinterestProviderActionSupport.identifier(request.payload["pinId"]); result["pin"] = .object(pin); result["ownershipVerified"] = .bool(true)
        default: throw PinterestProviderActionSupport.failure("pinterest_action_not_allowlisted", "Pinterest V1 permits exactly four reads.")
        }; return result
    }
    private func base() -> JSONRecord { [
        "provider": .string("pinterest"), "fakeAdapter": .bool(true), "simulated": .bool(true),
        "liveCredentialsUsed": .bool(false), "boundUserAccountOnly": .bool(true),
        "publicContentOnly": .bool(true), "providerDataPersisted": .bool(false),
        "providerRequestCount": .number(1), "automaticRetry": .bool(false),
        "automaticPagination": .bool(false), "redactionStatus": .string("provider-content-not-stored"),
    ] }
}

public final class LivePinterestProviderActionClient: PinterestProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService; private let secrets: SecretService; private let http: any PinterestProviderHTTPClient
    public init(data: LocalDataService, secrets: SecretService, httpClient: any PinterestProviderHTTPClient = URLSessionPinterestProviderHTTPClient()) { self.data = data; self.secrets = secrets; self.http = httpClient }
    public func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        let connection = try readyConnection(request), userId = try boundUserId(connection), username = try boundUsername(connection), token = try accessToken(connection)
        var result = base()
        switch request.definition.actionKey {
        case "pinterest_user_account_get":
            let value = try send(path: "/user_account", query: [:], token: token)
            guard value["id"]?.string == userId else { throw PinterestProviderActionSupport.failure("pinterest_user_binding_mismatch", "Pinterest returned a different user account.") }
            result["userAccount"] = .object(Self.user(value))
        case "pinterest_public_boards_list":
            let limit = Self.limit(request.payload["maxResults"]), value = try send(path: "/boards", query: ["page_size": String(limit)], token: token)
            let boards = Self.array(value["items"]).prefix(limit).map(Self.board)
            guard boards.allSatisfy({ $0["ownerUsername"]?.string == nil || $0["ownerUsername"]?.string == username }) else { throw PinterestProviderActionSupport.failure("pinterest_board_owner_mismatch", "Pinterest returned a board outside the bound account.") }
            result["boards"] = .array(boards.map(JSONValue.object)); result["resultCount"] = .number(Double(boards.count)); result["nextPageFollowed"] = .bool(false)
        case "pinterest_public_pins_list":
            let limit = Self.limit(request.payload["maxResults"]), value = try send(path: "/pins", query: ["page_size": String(limit)], token: token)
            let pins = Self.array(value["items"]).prefix(limit).map(Self.pin)
            guard pins.allSatisfy({ $0["boardOwnerUsername"]?.string == nil || $0["boardOwnerUsername"]?.string == username }) else { throw PinterestProviderActionSupport.failure("pinterest_pin_owner_mismatch", "Pinterest returned a Pin outside the bound account.") }
            result["pins"] = .array(pins.map(JSONValue.object)); result["resultCount"] = .number(Double(pins.count)); result["nextPageFollowed"] = .bool(false)
        case "pinterest_public_pin_get":
            let id = try PinterestProviderActionSupport.identifier(request.payload["pinId"]), value = try send(path: "/pins/\(id)", query: [:], token: token), pin = Self.pin(.object(value))
            guard pin["boardOwnerUsername"]?.string == username else { throw PinterestProviderActionSupport.failure("pinterest_pin_not_bound", "The requested Pin is outside the bound account.") }
            result["pin"] = .object(pin); result["ownershipVerified"] = .bool(true)
        default: throw PinterestProviderActionSupport.failure("pinterest_live_action_not_allowlisted", "Live Pinterest execution supports exactly four reads.")
        }; return result
    }
    private func readyConnection(_ request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderConnection {
        guard let id = request.auditIdentity.connectionId?.pinterestNilIfEmpty,
              let c = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id),
              c.appId == request.app.id, c.appSlug == "pinterest", c.status == .connected, c.health.state == .ready,
              c.grantedScopes == ProviderConnectionService.pinterestRelayOwnedOAuthScopes,
              c.health.diagnostics["userAccountVerified"]?.bool == true,
              c.health.diagnostics["publicContentOnly"]?.bool == true,
              c.health.diagnostics["providerDataPersisted"]?.bool == false,
              c.health.diagnostics["writesEnabled"]?.bool == false,
              c.health.diagnostics["automaticRetry"]?.bool == false,
              c.health.diagnostics["automaticPagination"]?.bool == false,
              c.health.diagnostics["rawToolsEnabled"]?.bool == false else {
            throw PinterestProviderActionSupport.failure("pinterest_connection_not_ready", "A ready exact-scope no-store Pinterest connection is required.")
        }; return c
    }
    private func boundUserId(_ c: MarketplaceProviderConnection) throws -> String {
        guard let id = c.health.diagnostics["connectedResourceId"]?.string?.pinterestNilIfEmpty else { throw PinterestProviderActionSupport.failure("pinterest_binding_invalid", "Pinterest user binding is invalid.") }; return id
    }
    private func boundUsername(_ c: MarketplaceProviderConnection) throws -> String {
        guard let value = c.health.diagnostics["username"]?.string?.pinterestNilIfEmpty else { throw PinterestProviderActionSupport.failure("pinterest_binding_invalid", "Pinterest username binding is invalid.") }; return value
    }
    private func accessToken(_ c: MarketplaceProviderConnection) throws -> String {
        guard let ref = c.credentialRequirements.first(where: { $0.fieldKey == "pinterest_oauth_access_token" })?.secretReferenceId,
              let token = try secrets.getSecretValue(ref).pinterestNilIfEmpty else { throw PinterestProviderActionSupport.failure("pinterest_token_unavailable", "Pinterest access token is unavailable; reconnect is required.") }; return token
    }
    private func send(path: String, query: [String: String], token: String) throws -> JSONRecord {
        var parts = URLComponents(string: "https://api.pinterest.com/v5" + path); parts?.queryItems = query.sorted { $0.key < $1.key }.map { URLQueryItem(name: $0.key, value: $0.value) }
        guard let url = parts?.url else { throw PinterestProviderActionSupport.failure("pinterest_invalid_request", "Pinterest request construction failed.") }
        let response = try http.send(PinterestProviderHTTPRequest(method: "GET", url: url, headers: ["Authorization": "Bearer \(token)", "Accept": "application/json"]))
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: Self.errorCode(response.statusCode), message: "Pinterest API rejected the request.", providerStatusCode: response.statusCode, detail: ["providerBodyPresent": .bool(!response.body.isEmpty), "automaticRetry": .bool(false), "providerDataPersisted": .bool(false)])
        }
        guard let object = try JSONSerialization.jsonObject(with: response.body) as? [String: Any] else { throw PinterestProviderActionSupport.failure("pinterest_invalid_json", "Pinterest API returned malformed JSON.") }; return jsonRecord(from: object)
    }
    private func base() -> JSONRecord {
        [
            "provider": .string("pinterest"), "fakeAdapter": .bool(false), "simulated": .bool(false), "liveCredentialsUsed": .bool(true), "boundUserAccountOnly": .bool(true), "publicContentOnly": .bool(true), "providerDataPersisted": .bool(false), "providerRequestCount": .number(1),
            "automaticRetry": .bool(false), "automaticPagination": .bool(false), "redactionStatus": .string("provider-content-not-stored"),
        ]
    }
    private static func user(_ v: JSONRecord) -> JSONRecord { ["id": scalar(v["id"]), "username": scalar(v["username"], 128), "accountType": scalar(v["account_type"], 64), "profileImageURL": scalar(v["profile_image"], 2048), "websiteURL": scalar(v["website_url"], 2048)] }
    private static func board(_ v: JSONValue) -> JSONRecord {
        let o = object(v), owner = object(o["owner"]), description = o["description"]?.string ?? "";
        return [
            "id": scalar(o["id"]), "name": scalar(o["name"]), "description": .string(String(description.prefix(1000))), "descriptionTruncated": .bool(description.count > 1000), "privacy": scalar(o["privacy"], 32), "ownerUsername": scalar(owner["username"], 128), "pinCount": scalar(o["pin_count"]),
        ]
    }
    private static func pin(_ v: JSONValue) -> JSONRecord {
        let o = object(v), owner = object(o["board_owner"]), media = object(o["media"]), images = object(media["images"]), image = object(images["600x"]), description = o["description"]?.string ?? "";
        return [
            "id": scalar(o["id"]), "title": scalar(o["title"]), "description": .string(String(description.prefix(1500))), "descriptionTruncated": .bool(description.count > 1500), "altText": scalar(o["alt_text"], 500), "link": scalar(o["link"], 2048), "createdAt": scalar(o["created_at"], 64),
            "mediaType": scalar(media["media_type"], 32), "imageURL": scalar(image["url"], 2048), "boardId": scalar(o["board_id"]), "boardOwnerUsername": scalar(owner["username"], 128),
        ]
    }
    private static func limit(_ v: JSONValue?) -> Int { guard let n = v?.number, n.isFinite else { return 10 }; return min(10, max(1, Int(n))) }
    private static func array(_ v: JSONValue?) -> [JSONValue] { if case .array(let a)? = v { return a }; return [] }
    private static func object(_ v: JSONValue?) -> JSONRecord { if case .object(let o)? = v { return o }; return [:] }
    private static func scalar(_ v: JSONValue?, _ max: Int = 512) -> JSONValue { guard let v else { return .null }; if case .string(let s) = v { return .string(String(s.prefix(max))) }; switch v { case .number, .bool, .null: return v; default: return .null } }
    private static func errorCode(_ status: Int) -> String {
        switch status {
        case 400: return "pinterest_invalid_request";
        case 401: return "pinterest_invalid_token";
        case 403: return "pinterest_permission_denied";
        case 429: return "pinterest_rate_limited";
        default: return status >= 500 ? "pinterest_provider_unavailable" : "pinterest_http_error"
        }
    }
}

public struct PinterestProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = ["pinterest_user_account_get", "pinterest_public_boards_list", "pinterest_public_pins_list", "pinterest_public_pin_get"]
    private let client: any PinterestProviderActionClient
    public init(client: any PinterestProviderActionClient = FakePinterestProviderActionClient()) { self.client = client }
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "pinterest", request.permission == .allowed, Self.allowed.contains(request.definition.actionKey) else { throw PinterestProviderActionSupport.failure("pinterest_action_not_allowlisted", "Pinterest V1 permits exactly four read actions.") }
        let allowedPayload: Set<String>; switch request.definition.actionKey { case "pinterest_public_boards_list", "pinterest_public_pins_list": allowedPayload = ["maxResults"]; case "pinterest_public_pin_get": allowedPayload = ["pinId"]; default: allowedPayload = [] }
        guard Set(request.payload.keys).isSubset(of: allowedPayload) else { throw PinterestProviderActionSupport.failure("pinterest_payload_not_supported", "Pinterest rejects user, board, scope, fields, bookmark, URL, media, analytics, write, and raw parameters.") }
        return MarketplaceProviderActionAdapterResult(result: try client.execute(request), redactionStatus: "provider-content-not-stored", persistResult: false)
    }
}
private extension String { var pinterestNilIfEmpty: String? { let value = trimmingCharacters(in: .whitespacesAndNewlines); return value.isEmpty ? nil : value } }
