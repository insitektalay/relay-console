import Foundation

public struct CalendlyProviderHTTPRequest: Sendable { public let url: URL; public let headers: [String: String]; public init(url: URL, headers: [String: String]) { self.url = url; self.headers = headers } }
public struct CalendlyProviderHTTPResponse: Sendable {
    public let statusCode: Int; public let headers: [String: String]; public let body: Data; public init(statusCode: Int, headers: [String: String] = [:], body: Data = Data()) { self.statusCode = statusCode; self.headers = headers; self.body = body }
}
public protocol CalendlyProviderHTTPClient: Sendable { func send(_ request: CalendlyProviderHTTPRequest) throws -> CalendlyProviderHTTPResponse }
private final class CalendlyNoRedirectDelegate: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}
public struct URLSessionCalendlyProviderHTTPClient: CalendlyProviderHTTPClient {
    public init() {};
    public func send(_ request: CalendlyProviderHTTPRequest) throws -> CalendlyProviderHTTPResponse {
        var value = URLRequest(url: request.url); value.httpMethod = "GET"; value.timeoutInterval = 20; request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) };
        let session = URLSession(configuration: .ephemeral, delegate: CalendlyNoRedirectDelegate(), delegateQueue: nil), semaphore = DispatchSemaphore(value: 0); var data: Data?, response: HTTPURLResponse?, failure: Error?;
        let task = session.dataTask(with: value) {
            data = $0; response = $1 as? HTTPURLResponse; failure = $2; semaphore.signal()
        }; task.resume(); if semaphore.wait(timeout: .now() + 20) == .timedOut { task.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "calendly_http_timeout", message: "Calendly API v2 request timed out.") }; session.invalidateAndCancel(); if let failure { throw failure };
        return CalendlyProviderHTTPResponse(statusCode: response?.statusCode ?? 0, headers: response?.allHeaderFields.reduce(into: [:]) { $0[String(describing: $1.key)] = String(describing: $1.value) } ?? [:], body: data ?? Data())
    }
}

public struct CalendlyProviderActionClientResult: Sendable { public let result: JSONRecord; public init(result: JSONRecord) { self.result = result } }
public protocol CalendlyProviderActionClient: Sendable { func executeCalendlyAction(request: MarketplaceProviderActionAdapterRequest) throws -> CalendlyProviderActionClientResult }
public struct FakeCalendlyProviderActionClient: CalendlyProviderActionClient {
    public init() {};
    public func executeCalendlyAction(request: MarketplaceProviderActionAdapterRequest) throws -> CalendlyProviderActionClientResult {
        switch request.definition.actionKey {
        case "calendly_event_type_list": return output(["semanticReadContract": .string("calendly-event-type-list-v1"), "eventTypes": .array([.object(CalendlyProviderActionSupport.fakeEventType())])]);
        case "calendly_scheduled_event_list": return output(["semanticReadContract": .string("calendly-scheduled-event-list-v1"), "scheduledEvents": .array([.object(CalendlyProviderActionSupport.fakeScheduledEvent())])]);
        case "calendly_scheduled_event_get": return output(["semanticReadContract": .string("calendly-scheduled-event-get-v1"), "scheduledEvent": .object(CalendlyProviderActionSupport.fakeScheduledEvent())]);
        default: throw MarketplaceProviderActionAdapterFailure(code: "calendly_fake_action_not_supported", message: "Unsupported Calendly action.")
        }
    };
    private func output(_ fields: JSONRecord) -> CalendlyProviderActionClientResult {
        CalendlyProviderActionClientResult(
            result: ["provider": .string("calendly"), "adapterBoundary": .string("calendly-provider-action-adapter"), "clientMode": .string("fake-calendly-api-v2"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-state-excluded")].merging(fields) { _, n in n })
    }
}

public final class LiveCalendlyProviderActionClient: CalendlyProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService; private let secrets: SecretService; private let http: any CalendlyProviderHTTPClient; private let now: @Sendable () -> Date
    public init(data: LocalDataService, secrets: SecretService, httpClient: any CalendlyProviderHTTPClient = URLSessionCalendlyProviderHTTPClient(), now: @escaping @Sendable () -> Date = { Date() }) { self.data = data; self.secrets = secrets; self.http = httpClient; self.now = now }
    public func executeCalendlyAction(request: MarketplaceProviderActionAdapterRequest) throws -> CalendlyProviderActionClientResult {
        let auth = try authorization(request);
        switch request.definition.actionKey {
        case "calendly_event_type_list":
            let root = try get(auth, path: "/event_types", query: CalendlyProviderActionSupport.eventTypeQuery(userUri: auth.userUri)), values = (root.calendlyObject?["collection"]?.calendlyArray ?? []).prefix(25).map { JSONValue.object(CalendlyProviderActionSupport.eventType($0)) };
            return output(["semanticReadContract": .string("calendly-event-type-list-v1"), "eventTypes": .array(Array(values))]);
        case "calendly_scheduled_event_list":
            let root = try get(auth, path: "/scheduled_events", query: CalendlyProviderActionSupport.scheduledEventQuery(userUri: auth.userUri, now: now())),
                values = (root.calendlyObject?["collection"]?.calendlyArray ?? []).prefix(25).map { JSONValue.object(CalendlyProviderActionSupport.scheduledEvent($0)) }
            ; return output(["semanticReadContract": .string("calendly-scheduled-event-list-v1"), "scheduledEvents": .array(Array(values))]);
        case "calendly_scheduled_event_get":
            let id = try CalendlyProviderActionSupport.id(request.payload["scheduledEventId"]), root = try get(auth, path: "/scheduled_events/\(id)", query: []), resource = root.calendlyObject?["resource"] ?? root;
            return output(["semanticReadContract": .string("calendly-scheduled-event-get-v1"), "scheduledEvent": .object(CalendlyProviderActionSupport.scheduledEvent(resource))]);
        default: throw MarketplaceProviderActionAdapterFailure(code: "calendly_live_action_not_supported", message: "Unsupported live Calendly action.")
        }
    }
    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> (token: String, userUri: String, organizationUri: String) {
        guard let id = request.auditIdentity.connectionId, let c = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), c.appSlug == "calendly", c.grantedScopes == ProviderConnectionService.calendlyRelayOwnedOAuthScopes,
            c.health.diagnostics["apiOrigin"] == .string("https://api.calendly.com"), let userId = c.health.diagnostics["userId"]?.string, let organizationId = c.health.diagnostics["organizationId"]?.string, CalendlyProviderActionSupport.safeOpaque(userId),
            CalendlyProviderActionSupport.safeOpaque(organizationId), let ref = c.credentialRequirements.first(where: { $0.fieldKey == "calendly_oauth_access_token" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "calendly_connection_not_ready", message: "Calendly user connection is not ready.") }; return (try secrets.getSecretValue(ref), "https://api.calendly.com/users/" + userId, "https://api.calendly.com/organizations/" + organizationId)
    }
    private func get(_ auth: (token: String, userUri: String, organizationUri: String), path: String, query: [URLQueryItem]) throws -> JSONValue {
        var components = URLComponents(string: "https://api.calendly.com" + path)!; components.queryItems = query.isEmpty ? nil : query;
        let response = try http.send(CalendlyProviderHTTPRequest(url: components.url!, headers: ["Authorization": "Bearer " + auth.token, "Accept": "application/json"])), value = (try? JSONSerialization.jsonObject(with: response.body)).map(CalendlyProviderActionSupport.json) ?? .null;
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: response.statusCode == 301 || response.statusCode == 302
                    ? "calendly_redirect_blocked"
                    : response.statusCode == 401 ? "calendly_token_invalid_or_expired" : response.statusCode == 403 ? "calendly_scope_or_role_forbidden" : response.statusCode == 404 ? "calendly_resource_not_found" : response.statusCode == 429 ? "calendly_rate_limited" : "calendly_api_error",
                message: "Calendly API v2 request failed.", providerStatusCode: response.statusCode, detail: ["retryAfter": response.headers.first { $0.key.lowercased() == "retry-after" }.map { .string(String($0.value.prefix(32))) } ?? .null])
        }; return value
    }
    private func output(_ fields: JSONRecord) -> CalendlyProviderActionClientResult {
        CalendlyProviderActionClientResult(
            result: ["provider": .string("calendly"), "adapterBoundary": .string("calendly-provider-action-adapter"), "clientMode": .string("live-calendly-api-v2"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-state-excluded")].merging(fields) { _, n in n })
    }
}

public struct CalendlyProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = ["calendly_event_type_list", "calendly_scheduled_event_list", "calendly_scheduled_event_get"]; private let client: any CalendlyProviderActionClient;
    public init(client: any CalendlyProviderActionClient = FakeCalendlyProviderActionClient()) { self.client = client };
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "calendly", Self.allowed.contains(request.definition.actionKey) else { throw MarketplaceProviderActionAdapterFailure(code: "calendly_action_not_allowlisted", message: "Calendly action is outside bounded read-only Event Type and Scheduled Event V1.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executeCalendlyAction(request: request).result, error: nil, redactionStatus: "private-state-excluded")
    }
}

enum CalendlyProviderActionSupport {
    static let canonicalScopes = ["event_types:read", "scheduled_events:read", "users:read"]
    static func safeUri(_ raw: String, resource: String) -> Bool {
        guard let url = URL(string: raw), url.scheme == "https", url.host == "api.calendly.com", url.query == nil, url.fragment == nil else { return false }; let parts = url.path.split(separator: "/"); return parts.count == 2 && parts[0] == Substring(resource) && safeOpaque(String(parts[1]))
    }
    static func id(_ value: JSONValue?) throws -> String { guard let raw = value?.string, safeOpaque(raw) else { throw MarketplaceProviderActionAdapterFailure(code: "calendly_scheduled_event_id_invalid", message: "An exact Calendly Scheduled Event UUID is required.") }; return raw }
    static func safeOpaque(_ raw: String) -> Bool { !raw.isEmpty && raw.count <= 64 && raw.allSatisfy { $0.isLetter || $0.isNumber || $0 == "-" || $0 == "_" } }
    static func eventTypeQuery(userUri: String) -> [URLQueryItem] { [URLQueryItem(name: "user", value: userUri), URLQueryItem(name: "active", value: "true"), URLQueryItem(name: "count", value: "25")] }
    static func scheduledEventQuery(userUri: String, now: Date) -> [URLQueryItem] {
        let end = Calendar(identifier: .gregorian).date(byAdding: .day, value: 14, to: now) ?? now;
        return [URLQueryItem(name: "user", value: userUri), URLQueryItem(name: "min_start_time", value: iso(now)), URLQueryItem(name: "max_start_time", value: iso(end)), URLQueryItem(name: "status", value: "active"), URLQueryItem(name: "count", value: "25")]
    }
    static func iso(_ date: Date) -> String { let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime]; return f.string(from: date) }
    static func eventType(_ value: JSONValue) -> JSONRecord {
        let o = value.calendlyObject ?? [:];
        return [
            "EventTypeId": uriId(o["uri"]), "Name": scalar(o["name"]), "Active": scalar(o["active"]), "DurationMinutes": scalar(o["duration"]), "Kind": scalar(o["kind"]), "PoolingType": scalar(o["pooling_type"]), "Slug": scalar(o["slug"]), "SchedulingURL": publicCalendlyURL(o["scheduling_url"]),
            "CreatedAt": scalar(o["created_at"]), "UpdatedAt": scalar(o["updated_at"]),
        ]
    }
    static func scheduledEvent(_ value: JSONValue) -> JSONRecord {
        let o = value.calendlyObject ?? [:], counter = o["invitees_counter"]?.calendlyObject ?? [:], memberships = o["event_memberships"]?.calendlyArray ?? [];
        return [
            "ScheduledEventId": uriId(o["uri"]), "Name": scalar(o["name"]), "Status": scalar(o["status"]), "StartTime": scalar(o["start_time"]), "EndTime": scalar(o["end_time"]), "EventTypeId": uriId(o["event_type"]), "InviteeTotal": scalar(counter["total"]),
            "InviteeActive": scalar(counter["active"]), "EventMembershipCount": .number(Double(min(memberships.count, 10_000))), "CreatedAt": scalar(o["created_at"]), "UpdatedAt": scalar(o["updated_at"]),
        ]
    }
    static func uriId(_ value: JSONValue?) -> JSONValue { guard let raw = value?.string, let last = URL(string: raw)?.path.split(separator: "/").last, safeOpaque(String(last)) else { return .null }; return .string(String(last)) }
    static func publicCalendlyURL(_ value: JSONValue?) -> JSONValue {
        guard let raw = value?.string, let url = URL(string: raw), url.scheme == "https", url.host == "calendly.com" || url.host?.hasSuffix(".calendly.com") == true, url.query == nil, url.fragment == nil else { return .null }; return .string(raw)
    }
    static func scalar(_ value: JSONValue?) -> JSONValue { guard let value else { return .null }; switch value { case .string, .number, .bool, .null: return value; default: return .null } }
    static func json(_ any: Any) -> JSONValue {
        if any is NSNull { return .null }; if let v = any as? Bool { return .bool(v) }; if let v = any as? String { return .string(v) }; if let v = any as? NSNumber { return .number(v.doubleValue) }; if let v = any as? [Any] { return .array(v.map(json)) };
        if let v = any as? [String: Any] { return .object(v.mapValues(json)) }; return .null
    }
    static func fakeEventType() -> JSONRecord {
        [
            "EventTypeId": .string("evt-type-1"), "Name": .string("Relay planning"), "Active": .bool(true), "DurationMinutes": .number(30), "Kind": .string("Solo"), "Slug": .string("relay-planning"), "SchedulingURL": .string("https://calendly.com/relay/planning"),
            "CreatedAt": .string("2026-07-01T09:00:00Z"), "UpdatedAt": .string("2026-07-11T09:00:00Z"),
        ]
    }
    static func fakeScheduledEvent() -> JSONRecord {
        [
            "ScheduledEventId": .string("event-1"), "Name": .string("Relay planning"), "Status": .string("active"), "StartTime": .string("2026-07-12T09:00:00Z"), "EndTime": .string("2026-07-12T09:30:00Z"), "EventTypeId": .string("evt-type-1"), "InviteeTotal": .number(1), "InviteeActive": .number(1),
            "EventMembershipCount": .number(1), "CreatedAt": .string("2026-07-01T09:00:00Z"), "UpdatedAt": .string("2026-07-11T09:00:00Z"),
        ]
    }
}

private extension JSONValue { var calendlyObject: JSONRecord? { if case .object(let v) = self { return v }; return nil }; var calendlyArray: [JSONValue]? { if case .array(let v) = self { return v }; return nil } }
