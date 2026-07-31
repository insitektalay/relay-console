import Foundation

public struct FrontProviderHTTPRequest: Sendable { public let url: URL; public let headers: [String: String]; public init(url: URL, headers: [String: String]) { self.url = url; self.headers = headers } }
public struct FrontProviderHTTPResponse: Sendable { public let statusCode: Int; public let headers: [String: String]; public let body: Data; public init(statusCode: Int, headers: [String: String] = [:], body: Data = Data()) { self.statusCode = statusCode; self.headers = headers; self.body = body } }
public protocol FrontProviderHTTPClient: Sendable { func send(_ request: FrontProviderHTTPRequest) throws -> FrontProviderHTTPResponse }
private final class FrontNoRedirectDelegate: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}
public struct URLSessionFrontProviderHTTPClient: FrontProviderHTTPClient {
    public init() {}
    public func send(_ request: FrontProviderHTTPRequest) throws -> FrontProviderHTTPResponse {
        var value = URLRequest(url: request.url); value.httpMethod = "GET"; value.timeoutInterval = 20; request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) }
        let session = URLSession(configuration: .ephemeral, delegate: FrontNoRedirectDelegate(), delegateQueue: nil), semaphore = DispatchSemaphore(value: 0); var data: Data?, response: HTTPURLResponse?, failure: Error?
        let task = session.dataTask(with: value) { data = $0; response = $1 as? HTTPURLResponse; failure = $2; semaphore.signal() }; task.resume()
        if semaphore.wait(timeout: .now() + 20) == .timedOut { task.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "front_http_timeout", message: "Front Core API request timed out.") }
        session.invalidateAndCancel(); if let failure { throw failure }
        return FrontProviderHTTPResponse(statusCode: response?.statusCode ?? 0, headers: response?.allHeaderFields.reduce(into: [:]) { $0[String(describing: $1.key)] = String(describing: $1.value) } ?? [:], body: data ?? Data())
    }
}

public struct FrontProviderActionClientResult: Sendable { public let result: JSONRecord; public init(result: JSONRecord) { self.result = result } }
public protocol FrontProviderActionClient: Sendable { func executeFrontAction(request: MarketplaceProviderActionAdapterRequest) throws -> FrontProviderActionClientResult }
public struct FakeFrontProviderActionClient: FrontProviderActionClient {
    public init() {}
    public func executeFrontAction(request: MarketplaceProviderActionAdapterRequest) throws -> FrontProviderActionClientResult {
        switch request.definition.actionKey {
        case "front_conversation_list": return output(["semanticReadContract": .string("front-conversation-list-v1"), "conversations": .array([.object(FrontProviderActionSupport.fakeConversation())])])
        case "front_conversation_get": return output(["semanticReadContract": .string("front-conversation-get-v1"), "conversation": .object(FrontProviderActionSupport.fakeConversation())])
        default: throw MarketplaceProviderActionAdapterFailure(code: "front_fake_action_not_supported", message: "Unsupported Front action.")
        }
    }
    private func output(_ fields: JSONRecord) -> FrontProviderActionClientResult {
        FrontProviderActionClientResult(
            result: ["provider": .string("front"), "adapterBoundary": .string("front-provider-action-adapter"), "clientMode": .string("fake-front-core-api"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-state-excluded")].merging(fields) { _, new in new })
    }
}

public final class LiveFrontProviderActionClient: FrontProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService; private let secrets: SecretService; private let http: any FrontProviderHTTPClient
    public init(data: LocalDataService, secrets: SecretService, httpClient: any FrontProviderHTTPClient = URLSessionFrontProviderHTTPClient()) { self.data = data; self.secrets = secrets; self.http = httpClient }
    public func executeFrontAction(request: MarketplaceProviderActionAdapterRequest) throws -> FrontProviderActionClientResult {
        let token = try authorization(request)
        switch request.definition.actionKey {
        case "front_conversation_list":
            let root = try get(token, path: "/conversations", query: FrontProviderActionSupport.listQuery), values = (root.frontObject?["_results"]?.frontArray ?? []).prefix(25).map { JSONValue.object(FrontProviderActionSupport.conversation($0)) }
            return output(["semanticReadContract": .string("front-conversation-list-v1"), "conversations": .array(Array(values))])
        case "front_conversation_get":
            let id = try FrontProviderActionSupport.conversationId(request.payload["conversationId"]), root = try get(token, path: "/conversations/\(id)", query: [])
            return output(["semanticReadContract": .string("front-conversation-get-v1"), "conversation": .object(FrontProviderActionSupport.conversation(root))])
        default: throw MarketplaceProviderActionAdapterFailure(code: "front_live_action_not_supported", message: "Unsupported live Front action.")
        }
    }
    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> String {
        guard let id = request.auditIdentity.connectionId, let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), connection.appSlug == "front", connection.health.diagnostics["apiOrigin"] == .string("https://api2.frontapp.com"),
            connection.grantedScopes == ["conversations:read"], let ref = connection.credentialRequirements.first(where: { $0.fieldKey == "front_oauth_access_token" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "front_connection_not_ready", message: "Front company connection is not ready.") }; return try secrets.getSecretValue(ref)
    }
    private func get(_ token: String, path: String, query: [URLQueryItem]) throws -> JSONValue {
        let origin = URL(string: "https://api2.frontapp.com")!; var components = URLComponents(url: origin.appendingPathComponent(String(path.dropFirst())), resolvingAgainstBaseURL: false)!; components.queryItems = query.isEmpty ? nil : query
        let response = try http.send(FrontProviderHTTPRequest(url: components.url!, headers: ["Authorization": "Bearer " + token, "Accept": "application/json", "User-Agent": "RelayConsole-Front/1.0"])),
            value = (try? JSONSerialization.jsonObject(with: response.body)).map(FrontProviderActionSupport.json) ?? .null
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: response.statusCode == 301 ? "front_conversation_moved" : response.statusCode == 401 ? "front_token_invalid" : response.statusCode == 403 ? "front_access_denied" : response.statusCode == 429 ? "front_rate_limited" : "front_api_error", message: "Front Core API request failed.",
                providerStatusCode: response.statusCode, detail: ["retryAfter": response.headers.first { $0.key.lowercased() == "retry-after" }.map { .string(String($0.value.prefix(32))) } ?? .null])
        }; return value
    }
    private func output(_ fields: JSONRecord) -> FrontProviderActionClientResult {
        FrontProviderActionClientResult(
            result: ["provider": .string("front"), "adapterBoundary": .string("front-provider-action-adapter"), "clientMode": .string("live-front-core-api"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-state-excluded")].merging(fields) { _, new in new })
    }
}

public struct FrontProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = ["front_conversation_list", "front_conversation_get"]; private let client: any FrontProviderActionClient; public init(client: any FrontProviderActionClient = FakeFrontProviderActionClient()) { self.client = client };
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "front", Self.allowed.contains(request.definition.actionKey) else { throw MarketplaceProviderActionAdapterFailure(code: "front_action_not_allowlisted", message: "Front action is outside read-only Conversation V1.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executeFrontAction(request: request).result, error: nil, redactionStatus: "private-state-excluded")
    }
}

enum FrontProviderActionSupport {
    static let listQuery = [URLQueryItem(name: "limit", value: "25"), URLQueryItem(name: "sort_by", value: "date"), URLQueryItem(name: "sort_order", value: "desc")]
    static func conversationId(_ value: JSONValue?) throws -> String {
        guard let id = value?.string, id.hasPrefix("cnv_"), id.count > 4, id.count <= 128, id.dropFirst(4).allSatisfy({ $0.isLetter || $0.isNumber }) else {
            throw MarketplaceProviderActionAdapterFailure(code: "front_conversation_id_invalid", message: "A Front Conversation ID in cnv_ form is required.")
        }; return id
    }
    static func scalar(_ value: JSONValue?) -> JSONValue { guard let value else { return .null }; switch value { case .string(let text): return .string(String(text.prefix(512))); case .number, .bool, .null: return value; default: return .null } }
    static func conversation(_ value: JSONValue) -> JSONRecord {
        let o = value.frontObject ?? [:];
        return [
            "ConversationId": scalar(o["id"]), "Subject": scalar(o["subject"]), "Status": scalar(o["status"]), "StatusId": scalar(o["status_id"]), "StatusCategory": scalar(o["status_category"]), "Type": scalar(o["type"]), "TicketType": scalar(o["ticket_type"]), "CreatedAt": scalar(o["created_at"]),
            "WaitingSince": scalar(o["waiting_since"]), "IsPrivate": scalar(o["is_private"]),
        ]
    }
    static func fakeConversation() -> JSONRecord {
        [
            "ConversationId": .string("cnv_relay123"), "Subject": .string("Cannot access Relay workspace"), "Status": .string("assigned"), "StatusId": .string("sts_open"), "StatusCategory": .string("open"), "Type": .string("email"), "TicketType": .null, "CreatedAt": .number(1_783_760_400),
            "WaitingSince": .number(1_783_762_200), "IsPrivate": .bool(false),
        ]
    }
    static func json(_ value: Any) -> JSONValue {
        if let v = value as? String { return .string(v) }; if let v = value as? Bool { return .bool(v) }; if let v = value as? Int { return .number(Double(v)) }; if let v = value as? Double { return .number(v) }; if let v = value as? [String: Any] { return .object(v.mapValues(json)) };
        if let v = value as? [Any] { return .array(v.map(json)) }; return .null
    }
}
private extension JSONValue { var frontObject: JSONRecord? { if case .object(let value) = self { return value }; return nil }; var frontArray: [JSONValue]? { if case .array(let value) = self { return value }; return nil } }
