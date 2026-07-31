import Foundation

public struct IntercomProviderHTTPRequest: Sendable {
    public let url: URL
    public let headers: [String: String]
    public init(url: URL, headers: [String: String]) { self.url = url; self.headers = headers }
}

public struct IntercomProviderHTTPResponse: Sendable {
    public let statusCode: Int
    public let headers: [String: String]
    public let body: Data
    public init(statusCode: Int, headers: [String: String] = [:], body: Data = Data()) { self.statusCode = statusCode; self.headers = headers; self.body = body }
}

public protocol IntercomProviderHTTPClient: Sendable { func send(_ request: IntercomProviderHTTPRequest) throws -> IntercomProviderHTTPResponse }

private final class IntercomNoRedirectDelegate: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}

public struct URLSessionIntercomProviderHTTPClient: IntercomProviderHTTPClient {
    public init() {}
    public func send(_ request: IntercomProviderHTTPRequest) throws -> IntercomProviderHTTPResponse {
        var value = URLRequest(url: request.url)
        value.httpMethod = "GET"
        value.timeoutInterval = 20
        request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) }
        let session = URLSession(configuration: .ephemeral, delegate: IntercomNoRedirectDelegate(), delegateQueue: nil)
        let semaphore = DispatchSemaphore(value: 0)
        var data: Data?
        var response: HTTPURLResponse?
        var failure: Error?
        let task = session.dataTask(with: value) { data = $0; response = $1 as? HTTPURLResponse; failure = $2; semaphore.signal() }
        task.resume()
        if semaphore.wait(timeout: .now() + 20) == .timedOut {
            task.cancel()
            throw MarketplaceProviderActionAdapterFailure(code: "intercom_http_timeout", message: "Intercom API request timed out.")
        }
        session.invalidateAndCancel()
        if let failure { throw failure }
        return IntercomProviderHTTPResponse(statusCode: response?.statusCode ?? 0, headers: response?.allHeaderFields.reduce(into: [:]) { $0[String(describing: $1.key)] = String(describing: $1.value) } ?? [:], body: data ?? Data())
    }
}

public struct IntercomProviderActionClientResult: Sendable { public let result: JSONRecord; public init(result: JSONRecord) { self.result = result } }
public protocol IntercomProviderActionClient: Sendable { func executeIntercomAction(request: MarketplaceProviderActionAdapterRequest) throws -> IntercomProviderActionClientResult }

public struct FakeIntercomProviderActionClient: IntercomProviderActionClient {
    public init() {}
    public func executeIntercomAction(request: MarketplaceProviderActionAdapterRequest) throws -> IntercomProviderActionClientResult {
        switch request.definition.actionKey {
        case "intercom_conversation_count": return output(["semanticReadContract": .string("intercom-conversation-count-v1"), "conversationCount": .number(18)])
        case "intercom_conversation_list": return output(["semanticReadContract": .string("intercom-conversation-list-v1"), "conversations": .array([.object(IntercomProviderActionSupport.fakeConversation())])])
        case "intercom_conversation_get": return output(["semanticReadContract": .string("intercom-conversation-get-v1"), "conversation": .object(IntercomProviderActionSupport.fakeConversation())])
        default: throw MarketplaceProviderActionAdapterFailure(code: "intercom_fake_action_not_supported", message: "Unsupported Intercom action.")
        }
    }
    private func output(_ fields: JSONRecord) -> IntercomProviderActionClientResult {
        IntercomProviderActionClientResult(
            result: ["provider": .string("intercom"), "adapterBoundary": .string("intercom-provider-action-adapter"), "clientMode": .string("fake-intercom-rest-api-2.15"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-state-excluded")].merging(fields) { _, new in new }
        )
    }
}

public final class LiveIntercomProviderActionClient: IntercomProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService
    private let secrets: SecretService
    private let http: any IntercomProviderHTTPClient
    public init(data: LocalDataService, secrets: SecretService, httpClient: any IntercomProviderHTTPClient = URLSessionIntercomProviderHTTPClient()) { self.data = data; self.secrets = secrets; self.http = httpClient }

    public func executeIntercomAction(request: MarketplaceProviderActionAdapterRequest) throws -> IntercomProviderActionClientResult {
        let auth = try authorization(request)
        switch request.definition.actionKey {
        case "intercom_conversation_count":
            let root = try get(auth, path: "/conversations", query: [URLQueryItem(name: "per_page", value: "1")])
            return output(["semanticReadContract": .string("intercom-conversation-count-v1"), "conversationCount": IntercomProviderActionSupport.scalar(root.intercomObject?["total_count"])])
        case "intercom_conversation_list":
            let root = try get(auth, path: "/conversations", query: [URLQueryItem(name: "per_page", value: "25")])
            let conversations = (root.intercomObject?["conversations"]?.intercomArray ?? []).prefix(25).map { JSONValue.object(IntercomProviderActionSupport.conversation($0)) }
            return output(["semanticReadContract": .string("intercom-conversation-list-v1"), "conversationCount": IntercomProviderActionSupport.scalar(root.intercomObject?["total_count"]), "conversations": .array(Array(conversations))])
        case "intercom_conversation_get":
            let id = try IntercomProviderActionSupport.conversationId(request.payload["conversationId"])
            let root = try get(auth, path: "/conversations/\(id)", query: [])
            return output(["semanticReadContract": .string("intercom-conversation-get-v1"), "conversation": .object(IntercomProviderActionSupport.conversation(root))])
        default:
            throw MarketplaceProviderActionAdapterFailure(code: "intercom_live_action_not_supported", message: "Unsupported live Intercom action.")
        }
    }

    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> (token: String, origin: URL) {
        guard let connectionId = request.auditIdentity.connectionId,
              let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: connectionId),
              connection.appSlug == "intercom",
              let reference = connection.credentialRequirements.first(where: { $0.fieldKey == "intercom_oauth_access_token" })?.secretReferenceId,
              let rawOrigin = connection.health.diagnostics["apiOrigin"]?.string,
              let origin = IntercomProviderActionSupport.apiOrigin(rawOrigin)
        else { throw MarketplaceProviderActionAdapterFailure(code: "intercom_connection_not_ready", message: "Intercom workspace connection is not ready.") }
        return (try secrets.getSecretValue(reference), origin)
    }

    private func get(_ auth: (token: String, origin: URL), path: String, query: [URLQueryItem]) throws -> JSONValue {
        var components = URLComponents(url: auth.origin.appendingPathComponent(String(path.dropFirst())), resolvingAgainstBaseURL: false)!
        components.queryItems = query.isEmpty ? nil : query
        let response = try http.send(IntercomProviderHTTPRequest(url: components.url!, headers: ["Authorization": "Bearer " + auth.token, "Accept": "application/json", "Intercom-Version": "2.15", "User-Agent": "RelayConsole-Intercom/1.0"]))
        let value = (try? JSONSerialization.jsonObject(with: response.body)).map(IntercomProviderActionSupport.json) ?? .null
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: response.statusCode == 401 ? "intercom_token_invalid" : response.statusCode == 403 ? "intercom_permission_or_plan_denied" : response.statusCode == 429 ? "intercom_rate_limited" : "intercom_api_error", message: "Intercom API request failed.",
                providerStatusCode: response.statusCode,
                detail: [
                    "requestId": response.headers.first { $0.key.lowercased() == "x-request-id" }.map { .string(String($0.value.prefix(128))) } ?? .null, "rateLimitReset": response.headers.first { $0.key.lowercased() == "x-ratelimit-reset" }.map { .string(String($0.value.prefix(32))) } ?? .null,
                ])
        }
        return value
    }

    private func output(_ fields: JSONRecord) -> IntercomProviderActionClientResult {
        IntercomProviderActionClientResult(
            result: ["provider": .string("intercom"), "adapterBoundary": .string("intercom-provider-action-adapter"), "clientMode": .string("live-intercom-rest-api-2.15"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-state-excluded")].merging(fields) { _, new in new }
        )
    }
}

public struct IntercomProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = ["intercom_conversation_count", "intercom_conversation_list", "intercom_conversation_get"]
    private let client: any IntercomProviderActionClient
    public init(client: any IntercomProviderActionClient = FakeIntercomProviderActionClient()) { self.client = client }
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "intercom", Self.allowed.contains(request.definition.actionKey) else { throw MarketplaceProviderActionAdapterFailure(code: "intercom_action_not_allowlisted", message: "Intercom action is outside read-only conversation V1.") }
        return MarketplaceProviderActionAdapterResult(result: try client.executeIntercomAction(request: request).result, error: nil, redactionStatus: "private-state-excluded")
    }
}

enum IntercomProviderActionSupport {
    private static let origins: Set<String> = ["https://api.intercom.io", "https://api.eu.intercom.io", "https://api.au.intercom.io"]
    static func apiOrigin(_ raw: String) -> URL? { guard origins.contains(raw), let value = URL(string: raw) else { return nil }; return value }
    static func apiOrigin(region: String) -> URL? { switch region.uppercased() { case "US": return URL(string: "https://api.intercom.io"); case "EU": return URL(string: "https://api.eu.intercom.io"); case "AU": return URL(string: "https://api.au.intercom.io"); default: return nil } }
    static func conversationId(_ value: JSONValue?) throws -> String {
        guard let id = value?.string, let number = Int64(id), number > 0, String(number) == id else { throw MarketplaceProviderActionAdapterFailure(code: "intercom_conversation_id_invalid", message: "A positive numeric Intercom conversation ID is required.") }; return id
    }
    static func scalar(_ value: JSONValue?) -> JSONValue { guard let value else { return .null }; switch value { case .string(let text): return .string(String(text.prefix(512))); case .number, .bool, .null: return value; default: return .null } }
    static func conversation(_ value: JSONValue) -> JSONRecord {
        let object = value.intercomObject ?? [:]
        let statistics = object["statistics"]?.intercomObject ?? [:]
        return [
            "ConversationId": scalar(object["id"]), "Title": scalar(object["title"]), "State": scalar(object["state"]), "Priority": scalar(object["priority"]), "Open": scalar(object["open"]), "Read": scalar(object["read"]), "AdminAssigneeId": scalar(object["admin_assignee_id"]),
            "TeamAssigneeId": scalar(object["team_assignee_id"]), "CreatedAt": scalar(object["created_at"]), "UpdatedAt": scalar(object["updated_at"]), "WaitingSince": scalar(object["waiting_since"]), "SnoozedUntil": scalar(object["snoozed_until"]),
            "FirstContactReplyAt": scalar(statistics["first_contact_reply_at"]), "LastContactReplyAt": scalar(statistics["last_contact_reply_at"]), "LastAdminReplyAt": scalar(statistics["last_admin_reply_at"]), "ReopenCount": scalar(statistics["count_reopens"]),
            "AssignmentCount": scalar(statistics["count_assignments"]), "ConversationPartCount": scalar(statistics["count_conversation_parts"]),
        ]
    }
    static func fakeConversation() -> JSONRecord {
        [
            "ConversationId": .string("1295"), "Title": .string("Cannot access Relay workspace"), "State": .string("open"), "Priority": .string("priority"), "Open": .bool(true), "Read": .bool(false), "AdminAssigneeId": .number(44), "TeamAssigneeId": .number(7), "CreatedAt": .number(1_753_000_000),
            "UpdatedAt": .number(1_753_003_600), "WaitingSince": .number(1_753_003_000), "SnoozedUntil": .null, "FirstContactReplyAt": .number(1_753_000_100), "LastContactReplyAt": .number(1_753_003_000), "LastAdminReplyAt": .number(1_753_002_000), "ReopenCount": .number(1),
            "AssignmentCount": .number(2), "ConversationPartCount": .number(6),
        ]
    }
    static func json(_ value: Any) -> JSONValue {
        if let value = value as? String { return .string(value) }; if let value = value as? Bool { return .bool(value) }; if let value = value as? Int { return .number(Double(value)) }; if let value = value as? Double { return .number(value) };
        if let value = value as? [String: Any] { return .object(value.mapValues(json)) }; if let value = value as? [Any] { return .array(value.map(json)) }; return .null
    }
}

private extension JSONValue {
    var intercomObject: JSONRecord? { if case .object(let value) = self { return value }; return nil }
    var intercomArray: [JSONValue]? { if case .array(let value) = self { return value }; return nil }
}
