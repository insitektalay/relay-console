import Foundation

public struct HelpScoutProviderHTTPRequest: Sendable { public let url: URL; public let headers: [String: String]; public init(url: URL, headers: [String: String]) { self.url = url; self.headers = headers } }
public struct HelpScoutProviderHTTPResponse: Sendable {
    public let statusCode: Int; public let headers: [String: String]; public let body: Data; public init(statusCode: Int, headers: [String: String] = [:], body: Data = Data()) { self.statusCode = statusCode; self.headers = headers; self.body = body }
}
public protocol HelpScoutProviderHTTPClient: Sendable { func send(_ request: HelpScoutProviderHTTPRequest) throws -> HelpScoutProviderHTTPResponse }
private final class HelpScoutNoRedirectDelegate: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}
public struct URLSessionHelpScoutProviderHTTPClient: HelpScoutProviderHTTPClient {
    public init() {}
    public func send(_ request: HelpScoutProviderHTTPRequest) throws -> HelpScoutProviderHTTPResponse {
        var value = URLRequest(url: request.url); value.httpMethod = "GET"; value.timeoutInterval = 20; request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) }
        let session = URLSession(configuration: .ephemeral, delegate: HelpScoutNoRedirectDelegate(), delegateQueue: nil), semaphore = DispatchSemaphore(value: 0); var data: Data?, response: HTTPURLResponse?, failure: Error?
        let task = session.dataTask(with: value) { data = $0; response = $1 as? HTTPURLResponse; failure = $2; semaphore.signal() }; task.resume()
        if semaphore.wait(timeout: .now() + 20) == .timedOut { task.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "help_scout_http_timeout", message: "Help Scout API request timed out.") }
        session.invalidateAndCancel(); if let failure { throw failure }
        return HelpScoutProviderHTTPResponse(statusCode: response?.statusCode ?? 0, headers: response?.allHeaderFields.reduce(into: [:]) { $0[String(describing: $1.key)] = String(describing: $1.value) } ?? [:], body: data ?? Data())
    }
}

public struct HelpScoutProviderActionClientResult: Sendable { public let result: JSONRecord; public init(result: JSONRecord) { self.result = result } }
public protocol HelpScoutProviderActionClient: Sendable { func executeHelpScoutAction(request: MarketplaceProviderActionAdapterRequest) throws -> HelpScoutProviderActionClientResult }
public struct FakeHelpScoutProviderActionClient: HelpScoutProviderActionClient {
    public init() {}
    public func executeHelpScoutAction(request: MarketplaceProviderActionAdapterRequest) throws -> HelpScoutProviderActionClientResult {
        switch request.definition.actionKey {
        case "help_scout_conversation_count": return output(["semanticReadContract": .string("help-scout-conversation-count-v1"), "conversationCount": .number(12)])
        case "help_scout_conversation_list": return output(["semanticReadContract": .string("help-scout-conversation-list-v1"), "conversations": .array([.object(HelpScoutProviderActionSupport.fakeConversation())])])
        case "help_scout_conversation_get": return output(["semanticReadContract": .string("help-scout-conversation-get-v1"), "conversation": .object(HelpScoutProviderActionSupport.fakeConversation())])
        default: throw MarketplaceProviderActionAdapterFailure(code: "help_scout_fake_action_not_supported", message: "Unsupported Help Scout action.")
        }
    }
    private func output(_ fields: JSONRecord) -> HelpScoutProviderActionClientResult {
        HelpScoutProviderActionClientResult(
            result: ["provider": .string("help-scout"), "adapterBoundary": .string("help-scout-provider-action-adapter"), "clientMode": .string("fake-help-scout-inbox-api-v2"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-state-excluded")].merging(fields) { _, new in
                new
            })
    }
}

public final class LiveHelpScoutProviderActionClient: HelpScoutProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService; private let secrets: SecretService; private let http: any HelpScoutProviderHTTPClient
    public init(data: LocalDataService, secrets: SecretService, httpClient: any HelpScoutProviderHTTPClient = URLSessionHelpScoutProviderHTTPClient()) { self.data = data; self.secrets = secrets; self.http = httpClient }
    public func executeHelpScoutAction(request: MarketplaceProviderActionAdapterRequest) throws -> HelpScoutProviderActionClientResult {
        let token = try authorization(request)
        switch request.definition.actionKey {
        case "help_scout_conversation_count":
            let root = try get(token, path: "/conversations", query: HelpScoutProviderActionSupport.listQuery);
            return output(["semanticReadContract": .string("help-scout-conversation-count-v1"), "conversationCount": HelpScoutProviderActionSupport.scalar(root.helpScoutObject?["page"]?.helpScoutObject?["totalElements"])])
        case "help_scout_conversation_list":
            let root = try get(token, path: "/conversations", query: HelpScoutProviderActionSupport.listQuery), values = (root.helpScoutObject?["_embedded"]?.helpScoutObject?["conversations"]?.helpScoutArray ?? []).prefix(25).map { JSONValue.object(HelpScoutProviderActionSupport.conversation($0)) };
            return output(["semanticReadContract": .string("help-scout-conversation-list-v1"), "conversationCount": HelpScoutProviderActionSupport.scalar(root.helpScoutObject?["page"]?.helpScoutObject?["totalElements"]), "conversations": .array(Array(values))])
        case "help_scout_conversation_get":
            let id = try HelpScoutProviderActionSupport.conversationId(request.payload["conversationId"]), root = try get(token, path: "/conversations/\(id)", query: []);
            return output(["semanticReadContract": .string("help-scout-conversation-get-v1"), "conversation": .object(HelpScoutProviderActionSupport.conversation(root))])
        default: throw MarketplaceProviderActionAdapterFailure(code: "help_scout_live_action_not_supported", message: "Unsupported live Help Scout action.")
        }
    }
    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> String {
        guard let id = request.auditIdentity.connectionId, let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), connection.appSlug == "help-scout", connection.health.diagnostics["apiOrigin"] == .string("https://api.helpscout.net/v2"),
            let ref = connection.credentialRequirements.first(where: { $0.fieldKey == "help_scout_oauth_access_token" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "help_scout_connection_not_ready", message: "Help Scout company connection is not ready.") }; return try secrets.getSecretValue(ref)
    }
    private func get(_ token: String, path: String, query: [URLQueryItem]) throws -> JSONValue {
        let origin = URL(string: "https://api.helpscout.net/v2")!; var components = URLComponents(url: origin.appendingPathComponent(String(path.dropFirst())), resolvingAgainstBaseURL: false)!; components.queryItems = query.isEmpty ? nil : query
        let response = try http.send(HelpScoutProviderHTTPRequest(url: components.url!, headers: ["Authorization": "Bearer " + token, "Accept": "application/hal+json", "User-Agent": "RelayConsole-HelpScout/1.0"])),
            value = (try? JSONSerialization.jsonObject(with: response.body)).map(HelpScoutProviderActionSupport.json) ?? .null
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: response.statusCode == 301 ? "help_scout_conversation_moved" : response.statusCode == 401 ? "help_scout_token_invalid" : response.statusCode == 403 ? "help_scout_access_denied" : response.statusCode == 429 ? "help_scout_rate_limited" : "help_scout_api_error",
                message: "Help Scout API request failed.", providerStatusCode: response.statusCode, detail: ["retryAfter": response.headers.first { $0.key.lowercased().contains("ratelimit-retry-after") }.map { .string(String($0.value.prefix(32))) } ?? .null])
        }; return value
    }
    private func output(_ fields: JSONRecord) -> HelpScoutProviderActionClientResult {
        HelpScoutProviderActionClientResult(
            result: ["provider": .string("help-scout"), "adapterBoundary": .string("help-scout-provider-action-adapter"), "clientMode": .string("live-help-scout-inbox-api-v2"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-state-excluded")].merging(fields) { _, new in
                new
            })
    }
}

public struct HelpScoutProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = ["help_scout_conversation_count", "help_scout_conversation_list", "help_scout_conversation_get"]; private let client: any HelpScoutProviderActionClient;
    public init(client: any HelpScoutProviderActionClient = FakeHelpScoutProviderActionClient()) { self.client = client };
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "help-scout", Self.allowed.contains(request.definition.actionKey) else { throw MarketplaceProviderActionAdapterFailure(code: "help_scout_action_not_allowlisted", message: "Help Scout action is outside read-only Inbox V1.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executeHelpScoutAction(request: request).result, error: nil, redactionStatus: "private-state-excluded")
    }
}

enum HelpScoutProviderActionSupport {
    static let listQuery = [URLQueryItem(name: "status", value: "active"), URLQueryItem(name: "sortField", value: "createdAt"), URLQueryItem(name: "sortOrder", value: "desc"), URLQueryItem(name: "page", value: "1")]
    static func conversationId(_ value: JSONValue?) throws -> String {
        guard let id = value?.string, let number = Int64(id), number > 0, String(number) == id else { throw MarketplaceProviderActionAdapterFailure(code: "help_scout_conversation_id_invalid", message: "A positive numeric Help Scout conversation ID is required.") }; return id
    }
    static func scalar(_ value: JSONValue?) -> JSONValue { guard let value else { return .null }; switch value { case .string(let text): return .string(String(text.prefix(512))); case .number, .bool, .null: return value; default: return .null } }
    static func conversation(_ value: JSONValue) -> JSONRecord {
        let o = value.helpScoutObject ?? [:], assignee = o["assignee"]?.helpScoutObject ?? [:], waiting = o["customerWaitingSince"]?.helpScoutObject ?? [:], source = o["source"]?.helpScoutObject ?? [:], snooze = o["snooze"]?.helpScoutObject ?? [:];
        return [
            "ConversationId": scalar(o["id"]), "ConversationNumber": scalar(o["number"]), "PublishedThreadCount": scalar(o["threads"]), "Type": scalar(o["type"]), "FolderId": scalar(o["folderId"]), "Status": scalar(o["status"]), "State": scalar(o["state"]), "Subject": scalar(o["subject"]),
            "MailboxId": scalar(o["mailboxId"]), "AssigneeId": scalar(assignee["id"]), "AssigneeType": scalar(assignee["type"]), "CreatedAt": scalar(o["createdAt"]), "ClosedAt": scalar(o["closedAt"]), "UserUpdatedAt": scalar(o["userUpdatedAt"]), "CustomerWaitingSince": scalar(waiting["time"]),
            "SourceType": scalar(source["type"]), "SourceVia": scalar(source["via"]), "SnoozedUntil": scalar(snooze["snoozedUntil"]), "UnsnoozeOnCustomerReply": scalar(snooze["unsnoozeOnCustomerReply"]),
        ]
    }
    static func fakeConversation() -> JSONRecord {
        [
            "ConversationId": .number(123), "ConversationNumber": .number(12), "PublishedThreadCount": .number(2), "Type": .string("email"), "FolderId": .number(11), "Status": .string("active"), "State": .string("published"), "Subject": .string("Cannot access Relay workspace"),
            "MailboxId": .number(13), "AssigneeId": .number(99), "AssigneeType": .string("user"), "CreatedAt": .string("2026-07-11T09:00:00Z"), "ClosedAt": .null, "UserUpdatedAt": .string("2026-07-11T10:00:00Z"), "CustomerWaitingSince": .string("2026-07-11T09:30:00Z"),
            "SourceType": .string("email"), "SourceVia": .string("customer"), "SnoozedUntil": .null, "UnsnoozeOnCustomerReply": .null,
        ]
    }
    static func json(_ value: Any) -> JSONValue {
        if let v = value as? String { return .string(v) }; if let v = value as? Bool { return .bool(v) }; if let v = value as? Int { return .number(Double(v)) }; if let v = value as? Double { return .number(v) }; if let v = value as? [String: Any] { return .object(v.mapValues(json)) };
        if let v = value as? [Any] { return .array(v.map(json)) }; return .null
    }
}
private extension JSONValue { var helpScoutObject: JSONRecord? { if case .object(let value) = self { return value }; return nil }; var helpScoutArray: [JSONValue]? { if case .array(let value) = self { return value }; return nil } }
