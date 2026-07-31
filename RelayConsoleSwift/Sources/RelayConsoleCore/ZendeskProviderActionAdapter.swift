import Foundation

public struct ZendeskProviderHTTPRequest: Sendable { public let url: URL; public let headers: [String: String]; public init(url: URL, headers: [String: String]) { self.url = url; self.headers = headers } }
public struct ZendeskProviderHTTPResponse: Sendable {
    public let statusCode: Int; public let headers: [String: String]; public let body: Data; public init(statusCode: Int, headers: [String: String] = [:], body: Data = Data()) { self.statusCode = statusCode; self.headers = headers; self.body = body }
}
public protocol ZendeskProviderHTTPClient: Sendable { func send(_ request: ZendeskProviderHTTPRequest) throws -> ZendeskProviderHTTPResponse }
private final class ZendeskNoRedirectDelegate: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}
public struct URLSessionZendeskProviderHTTPClient: ZendeskProviderHTTPClient {
    public init() {};
    public func send(_ request: ZendeskProviderHTTPRequest) throws -> ZendeskProviderHTTPResponse {
        var value = URLRequest(url: request.url); value.httpMethod = "GET"; value.timeoutInterval = 20; request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) };
        let session = URLSession(configuration: .ephemeral, delegate: ZendeskNoRedirectDelegate(), delegateQueue: nil), semaphore = DispatchSemaphore(value: 0); var data: Data?, response: HTTPURLResponse?, failure: Error?;
        let task = session.dataTask(with: value) {
            data = $0; response = $1 as? HTTPURLResponse; failure = $2; semaphore.signal()
        }; task.resume(); if semaphore.wait(timeout: .now() + 20) == .timedOut { task.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "zendesk_http_timeout", message: "Zendesk API request timed out.") }; session.invalidateAndCancel(); if let failure { throw failure };
        return ZendeskProviderHTTPResponse(statusCode: response?.statusCode ?? 0, headers: response?.allHeaderFields.reduce(into: [:]) { $0[String(describing: $1.key)] = String(describing: $1.value) } ?? [:], body: data ?? Data())
    }
}

public struct ZendeskProviderActionClientResult: Sendable { public let result: JSONRecord; public init(result: JSONRecord) { self.result = result } }
public protocol ZendeskProviderActionClient: Sendable { func executeZendeskAction(request: MarketplaceProviderActionAdapterRequest) throws -> ZendeskProviderActionClientResult }
public struct FakeZendeskProviderActionClient: ZendeskProviderActionClient {
    public init() {};
    public func executeZendeskAction(request: MarketplaceProviderActionAdapterRequest) throws -> ZendeskProviderActionClientResult {
        switch request.definition.actionKey {
        case "zendesk_ticket_count": return out(["semanticReadContract": .string("zendesk-ticket-count-v1"), "ticketCount": .number(42), "refreshedAt": .string("2026-07-11T10:00:00Z")]);
        case "zendesk_ticket_list": return out(["semanticReadContract": .string("zendesk-ticket-list-v1"), "tickets": .array([.object(ZendeskProviderActionSupport.fakeTicket())])]);
        case "zendesk_ticket_get": return out(["semanticReadContract": .string("zendesk-ticket-get-v1"), "ticket": .object(ZendeskProviderActionSupport.fakeTicket())]);
        default: throw MarketplaceProviderActionAdapterFailure(code: "zendesk_fake_action_not_supported", message: "Unsupported Zendesk action.")
        }
    };
    private func out(_ fields: JSONRecord) -> ZendeskProviderActionClientResult {
        ZendeskProviderActionClientResult(
            result: ["provider": .string("zendesk"), "adapterBoundary": .string("zendesk-provider-action-adapter"), "clientMode": .string("fake-zendesk-support-api-v2"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-state-excluded")].merging(fields) { _, new in new })
    }
}

public final class LiveZendeskProviderActionClient: ZendeskProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService; private let secrets: SecretService; private let http: any ZendeskProviderHTTPClient
    public init(data: LocalDataService, secrets: SecretService, httpClient: any ZendeskProviderHTTPClient = URLSessionZendeskProviderHTTPClient()) { self.data = data; self.secrets = secrets; self.http = httpClient }
    public func executeZendeskAction(request: MarketplaceProviderActionAdapterRequest) throws -> ZendeskProviderActionClientResult {
        let auth = try authorization(request);
        switch request.definition.actionKey {
        case "zendesk_ticket_count":
            let root = try get(auth, path: "/api/v2/tickets/count.json", query: []), count = root.zendeskObject?["count"] ?? .null, refreshed = root.zendeskObject?["refreshed_at"] ?? .null;
            return out(["semanticReadContract": .string("zendesk-ticket-count-v1"), "ticketCount": ZendeskProviderActionSupport.scalar(count), "refreshedAt": ZendeskProviderActionSupport.scalar(refreshed)]);
        case "zendesk_ticket_list":
            let root = try get(auth, path: "/api/v2/tickets.json", query: ZendeskProviderActionSupport.listQuery), values = (root.zendeskObject?["tickets"]?.zendeskArray ?? []).prefix(25).map { JSONValue.object(ZendeskProviderActionSupport.ticket($0)) };
            return out(["semanticReadContract": .string("zendesk-ticket-list-v1"), "tickets": .array(Array(values))]);
        case "zendesk_ticket_get":
            let id = try ZendeskProviderActionSupport.ticketId(request.payload["ticketId"]), root = try get(auth, path: "/api/v2/tickets/\(id).json", query: []);
            return out(["semanticReadContract": .string("zendesk-ticket-get-v1"), "ticket": .object(ZendeskProviderActionSupport.ticket(root.zendeskObject?["ticket"] ?? .null))]);
        default: throw MarketplaceProviderActionAdapterFailure(code: "zendesk_live_action_not_supported", message: "Unsupported live Zendesk action.")
        }
    }
    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> (token: String, origin: URL) {
        guard let id = request.auditIdentity.connectionId, let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), connection.appSlug == "zendesk",
            let ref = connection.credentialRequirements.first(where: { $0.fieldKey == "zendesk_oauth_access_token" })?.secretReferenceId, let raw = connection.health.diagnostics["instanceOrigin"]?.string, let origin = ZendeskProviderActionSupport.instanceOrigin(raw)
        else { throw MarketplaceProviderActionAdapterFailure(code: "zendesk_connection_not_ready", message: "Zendesk Support instance connection is not ready.") }; return (try secrets.getSecretValue(ref), origin)
    }
    private func get(_ auth: (token: String, origin: URL), path: String, query: [URLQueryItem]) throws -> JSONValue {
        var c = URLComponents(url: auth.origin.appendingPathComponent(String(path.dropFirst())), resolvingAgainstBaseURL: false)!; c.queryItems = query.isEmpty ? nil : query;
        let response = try http.send(ZendeskProviderHTTPRequest(url: c.url!, headers: ["Authorization": "Bearer " + auth.token, "Accept": "application/json", "User-Agent": "RelayConsole-Zendesk/1.0"])),
            value = (try? JSONSerialization.jsonObject(with: response.body)).map(ZendeskProviderActionSupport.json) ?? .null
        ;
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: response.statusCode == 401 ? "zendesk_token_invalid" : response.statusCode == 403 ? "zendesk_scope_denied" : response.statusCode == 429 ? "zendesk_rate_limited" : "zendesk_api_error", message: "Zendesk API request failed.", providerStatusCode: response.statusCode,
                detail: ["error": value.zendeskObject?["error"] ?? .null, "retryAfter": response.headers.first { $0.key.lowercased() == "retry-after" }.map { .string(String($0.value.prefix(32))) } ?? .null])
        }; return value
    }
    private func out(_ fields: JSONRecord) -> ZendeskProviderActionClientResult {
        ZendeskProviderActionClientResult(
            result: ["provider": .string("zendesk"), "adapterBoundary": .string("zendesk-provider-action-adapter"), "clientMode": .string("live-zendesk-support-api-v2"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-state-excluded")].merging(fields) { _, new in new })
    }
}

public struct ZendeskProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = ["zendesk_ticket_count", "zendesk_ticket_list", "zendesk_ticket_get"]; private let client: any ZendeskProviderActionClient; public init(client: any ZendeskProviderActionClient = FakeZendeskProviderActionClient()) { self.client = client };
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "zendesk", Self.allowed.contains(request.definition.actionKey) else { throw MarketplaceProviderActionAdapterFailure(code: "zendesk_action_not_allowlisted", message: "Zendesk action is outside read-only Support V1.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executeZendeskAction(request: request).result, error: nil, redactionStatus: "private-state-excluded")
    }
}

enum ZendeskProviderActionSupport {
    static let listQuery = [URLQueryItem(name: "per_page", value: "25"), URLQueryItem(name: "sort_by", value: "updated_at"), URLQueryItem(name: "sort_order", value: "desc")]
    static func instanceOrigin(_ raw: String) -> URL? {
        guard let c = URLComponents(string: raw), c.scheme == "https", let host = c.host?.lowercased(), host.hasSuffix(".zendesk.com"), !host.dropLast(".zendesk.com".count).isEmpty, !host.dropLast(".zendesk.com".count).contains("."), c.user == nil, c.password == nil, c.port == nil, c.query == nil,
            c.fragment == nil, c.path.isEmpty || c.path == "/"
        else { return nil }; let label = String(host.dropLast(".zendesk.com".count)); guard label.count <= 63, label.first != "-", label.last != "-", label.allSatisfy({ $0.isLetter || $0.isNumber || $0 == "-" }) else { return nil }; return URL(string: "https://" + host)
    }
    static func ticketId(_ value: JSONValue?) throws -> String {
        guard let id = value?.string, let number = Int64(id), number > 0, String(number) == id else { throw MarketplaceProviderActionAdapterFailure(code: "zendesk_ticket_id_invalid", message: "A positive numeric Zendesk ticket ID is required.") }; return id
    }
    static func scalar(_ value: JSONValue?) -> JSONValue { guard let value else { return .null }; switch value { case .string(let text): return .string(String(text.prefix(512))); case .number, .bool, .null: return value; default: return .null } }
    static func ticket(_ value: JSONValue) -> JSONRecord {
        let o = value.zendeskObject ?? [:], satisfaction = o["satisfaction_rating"]?.zendeskObject;
        return [
            "TicketId": scalar(o["id"]), "Subject": scalar(o["subject"]), "Status": scalar(o["status"]), "Priority": scalar(o["priority"]), "Type": scalar(o["type"]), "OrganizationId": scalar(o["organization_id"]), "GroupId": scalar(o["group_id"]), "BrandId": scalar(o["brand_id"]),
            "TicketFormId": scalar(o["ticket_form_id"]), "DueAt": scalar(o["due_at"]), "CreatedAt": scalar(o["created_at"]), "UpdatedAt": scalar(o["updated_at"]), "SatisfactionScore": scalar(satisfaction?["score"]),
        ]
    }
    static func fakeTicket() -> JSONRecord {
        [
            "TicketId": .number(2001), "Subject": .string("Cannot access Relay workspace"), "Status": .string("open"), "Priority": .string("high"), "Type": .string("problem"), "OrganizationId": .number(1001), "GroupId": .number(3), "BrandId": .number(4), "TicketFormId": .number(5),
            "DueAt": .string("2026-07-12T10:00:00Z"), "CreatedAt": .string("2026-07-11T09:00:00Z"), "UpdatedAt": .string("2026-07-11T10:00:00Z"), "SatisfactionScore": .null,
        ]
    }
    static func json(_ value: Any) -> JSONValue {
        if let v = value as? String { return .string(v) }; if let v = value as? Bool { return .bool(v) }; if let v = value as? Int { return .number(Double(v)) }; if let v = value as? Double { return .number(v) }; if let v = value as? [String: Any] { return .object(v.mapValues(json)) };
        if let v = value as? [Any] { return .array(v.map(json)) }; return .null
    }
}
private extension JSONValue { var zendeskObject: JSONRecord? { if case .object(let value) = self { return value }; return nil }; var zendeskArray: [JSONValue]? { if case .array(let value) = self { return value }; return nil } }
