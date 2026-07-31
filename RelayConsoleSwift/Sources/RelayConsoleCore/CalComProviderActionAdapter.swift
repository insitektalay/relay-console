import Foundation

public struct CalComProviderHTTPRequest: Sendable { public let url: URL; public let headers: [String: String]; public init(url: URL, headers: [String: String]) { self.url = url; self.headers = headers } }
public struct CalComProviderHTTPResponse: Sendable {
    public let statusCode: Int; public let headers: [String: String]; public let body: Data; public init(statusCode: Int, headers: [String: String] = [:], body: Data = Data()) { self.statusCode = statusCode; self.headers = headers; self.body = body }
}
public protocol CalComProviderHTTPClient: Sendable { func send(_ request: CalComProviderHTTPRequest) throws -> CalComProviderHTTPResponse }
private final class CalComNoRedirectDelegate: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}
public struct URLSessionCalComProviderHTTPClient: CalComProviderHTTPClient {
    public init() {};
    public func send(_ request: CalComProviderHTTPRequest) throws -> CalComProviderHTTPResponse {
        var value = URLRequest(url: request.url); value.httpMethod = "GET"; value.timeoutInterval = 20; request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) };
        let session = URLSession(configuration: .ephemeral, delegate: CalComNoRedirectDelegate(), delegateQueue: nil), semaphore = DispatchSemaphore(value: 0); var data: Data?, response: HTTPURLResponse?, failure: Error?;
        let task = session.dataTask(with: value) {
            data = $0; response = $1 as? HTTPURLResponse; failure = $2; semaphore.signal()
        }; task.resume(); if semaphore.wait(timeout: .now() + 20) == .timedOut { task.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "cal_com_http_timeout", message: "Cal.com API v2 request timed out.") }; session.invalidateAndCancel(); if let failure { throw failure };
        return CalComProviderHTTPResponse(statusCode: response?.statusCode ?? 0, headers: response?.allHeaderFields.reduce(into: [:]) { $0[String(describing: $1.key)] = String(describing: $1.value) } ?? [:], body: data ?? Data())
    }
}

public struct CalComProviderActionClientResult: Sendable { public let result: JSONRecord; public init(result: JSONRecord) { self.result = result } }
public protocol CalComProviderActionClient: Sendable { func executeCalComAction(request: MarketplaceProviderActionAdapterRequest) throws -> CalComProviderActionClientResult }
public struct FakeCalComProviderActionClient: CalComProviderActionClient {
    public init() {};
    public func executeCalComAction(request: MarketplaceProviderActionAdapterRequest) throws -> CalComProviderActionClientResult {
        switch request.definition.actionKey {
        case "cal_com_booking_list": return output(["semanticReadContract": .string("cal-com-booking-list-v1"), "bookings": .array([.object(CalComProviderActionSupport.fakeBooking())])]);
        case "cal_com_booking_get": return output(["semanticReadContract": .string("cal-com-booking-get-v1"), "booking": .object(CalComProviderActionSupport.fakeBooking())]);
        case "cal_com_event_type_get": return output(["semanticReadContract": .string("cal-com-event-type-get-v1"), "eventType": .object(CalComProviderActionSupport.fakeEventType())]);
        default: throw MarketplaceProviderActionAdapterFailure(code: "cal_com_fake_action_not_supported", message: "Unsupported Cal.com action.")
        }
    };
    private func output(_ fields: JSONRecord) -> CalComProviderActionClientResult {
        CalComProviderActionClientResult(
            result: ["provider": .string("cal-com"), "adapterBoundary": .string("cal-com-provider-action-adapter"), "clientMode": .string("fake-cal-com-api-v2"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-state-excluded")].merging(fields) { _, n in n })
    }
}

public final class LiveCalComProviderActionClient: CalComProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService; private let secrets: SecretService; private let http: any CalComProviderHTTPClient
    public init(data: LocalDataService, secrets: SecretService, httpClient: any CalComProviderHTTPClient = URLSessionCalComProviderHTTPClient()) { self.data = data; self.secrets = secrets; self.http = httpClient }
    public func executeCalComAction(request: MarketplaceProviderActionAdapterRequest) throws -> CalComProviderActionClientResult {
        let token = try authorization(request);
        switch request.definition.actionKey {
        case "cal_com_booking_list":
            let root = try get(token, path: "/bookings", query: CalComProviderActionSupport.bookingQuery, apiVersion: "2026-05-01"), values = (root.calComObject?["data"]?.calComArray ?? []).prefix(25).map { JSONValue.object(CalComProviderActionSupport.booking($0)) };
            return output(["semanticReadContract": .string("cal-com-booking-list-v1"), "bookings": .array(Array(values))]);
        case "cal_com_booking_get":
            let id = try CalComProviderActionSupport.opaqueId(request.payload["bookingUid"], field: "Booking UID"), root = try get(token, path: "/bookings/\(id)", query: [], apiVersion: "2026-02-25"), value = root.calComObject?["data"] ?? root;
            return output(["semanticReadContract": .string("cal-com-booking-get-v1"), "booking": .object(CalComProviderActionSupport.booking(value))]);
        case "cal_com_event_type_get":
            let id = try CalComProviderActionSupport.numericId(request.payload["eventTypeId"]), root = try get(token, path: "/event-types/\(id)", query: [], apiVersion: "2024-06-14"), value = root.calComObject?["data"] ?? root;
            return output(["semanticReadContract": .string("cal-com-event-type-get-v1"), "eventType": .object(CalComProviderActionSupport.eventType(value))]);
        default: throw MarketplaceProviderActionAdapterFailure(code: "cal_com_live_action_not_supported", message: "Unsupported live Cal.com action.")
        }
    }
    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> String {
        guard let id = request.auditIdentity.connectionId, let c = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), c.appSlug == "cal-com", c.grantedScopes == ProviderConnectionService.calComRelayOwnedOAuthScopes,
            c.health.diagnostics["apiOrigin"] == .string("https://api.cal.com/v2"), let userId = c.health.diagnostics["userId"]?.string, CalComProviderActionSupport.safeOpaque(userId), let ref = c.credentialRequirements.first(where: { $0.fieldKey == "cal_com_oauth_access_token" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "cal_com_connection_not_ready", message: "Cal.com user connection is not ready.") }; return try secrets.getSecretValue(ref)
    }
    private func get(_ token: String, path: String, query: [URLQueryItem], apiVersion: String) throws -> JSONValue {
        var components = URLComponents(string: "https://api.cal.com/v2" + path)!; components.queryItems = query.isEmpty ? nil : query;
        let response = try http.send(CalComProviderHTTPRequest(url: components.url!, headers: ["Authorization": "Bearer " + token, "Accept": "application/json", "cal-api-version": apiVersion])),
            value = (try? JSONSerialization.jsonObject(with: response.body)).map(CalComProviderActionSupport.json) ?? .null
        ;
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: response.statusCode == 301 || response.statusCode == 302
                    ? "cal_com_redirect_blocked"
                    : response.statusCode == 401 ? "cal_com_token_invalid_or_expired" : response.statusCode == 403 ? "cal_com_scope_or_role_forbidden" : response.statusCode == 404 ? "cal_com_resource_not_found" : response.statusCode == 429 ? "cal_com_rate_limited" : "cal_com_api_error",
                message: "Cal.com API v2 request failed.", providerStatusCode: response.statusCode, detail: ["retryAfter": response.headers.first { $0.key.lowercased() == "retry-after" }.map { .string(String($0.value.prefix(32))) } ?? .null])
        }; return value
    }
    private func output(_ fields: JSONRecord) -> CalComProviderActionClientResult {
        CalComProviderActionClientResult(
            result: ["provider": .string("cal-com"), "adapterBoundary": .string("cal-com-provider-action-adapter"), "clientMode": .string("live-cal-com-api-v2"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-state-excluded")].merging(fields) { _, n in n })
    }
}

public struct CalComProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = ["cal_com_booking_list", "cal_com_booking_get", "cal_com_event_type_get"]; private let client: any CalComProviderActionClient; public init(client: any CalComProviderActionClient = FakeCalComProviderActionClient()) { self.client = client };
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "cal-com", Self.allowed.contains(request.definition.actionKey) else { throw MarketplaceProviderActionAdapterFailure(code: "cal_com_action_not_allowlisted", message: "Cal.com action is outside bounded read-only Booking and Event Type V1.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executeCalComAction(request: request).result, error: nil, redactionStatus: "private-state-excluded")
    }
}

enum CalComProviderActionSupport {
    static let bookingQuery = [URLQueryItem(name: "status", value: "upcoming"), URLQueryItem(name: "limit", value: "25")]
    static func opaqueId(_ value: JSONValue?, field: String) throws -> String { guard let raw = value?.string, safeOpaque(raw) else { throw MarketplaceProviderActionAdapterFailure(code: "cal_com_booking_uid_invalid", message: "An exact safe Cal.com \(field) is required.") }; return raw }
    static func numericId(_ value: JSONValue?) throws -> String {
        guard let raw = value?.string, !raw.isEmpty, raw.first != "0", raw.count <= 20, raw.allSatisfy(\.isNumber) else { throw MarketplaceProviderActionAdapterFailure(code: "cal_com_event_type_id_invalid", message: "An exact positive Cal.com Event Type ID is required.") }; return raw
    }
    static func safeOpaque(_ raw: String) -> Bool { !raw.isEmpty && raw.count <= 128 && raw.allSatisfy { $0.isLetter || $0.isNumber || $0 == "-" || $0 == "_" } }
    static func booking(_ value: JSONValue) -> JSONRecord {
        let o = value.calComObject ?? [:], event = o["eventType"]?.calComObject ?? [:];
        return [
            "BookingId": scalar(o["id"]), "BookingUID": scalar(o["uid"]), "Title": scalar(o["title"]), "Status": scalar(o["status"]), "Start": scalar(o["start"]), "End": scalar(o["end"]), "DurationMinutes": scalar(o["duration"]), "EventTypeId": firstScalar(o["eventTypeId"], event["id"]),
            "EventTypeSlug": scalar(event["slug"]), "AbsentHost": scalar(o["absentHost"]), "CreatedAt": scalar(o["createdAt"]), "UpdatedAt": scalar(o["updatedAt"]),
        ]
    }
    static func eventType(_ value: JSONValue) -> JSONRecord {
        let o = value.calComObject ?? [:];
        return [
            "EventTypeId": scalar(o["id"]), "Title": scalar(o["title"]), "Slug": scalar(o["slug"]), "LengthInMinutes": scalar(o["lengthInMinutes"]), "Hidden": scalar(o["hidden"]), "IsInstantEvent": scalar(o["isInstantEvent"]),
            "BookingRequiresAuthentication": scalar(o["bookingRequiresAuthentication"]), "SlotIntervalMinutes": scalar(o["slotInterval"]), "MinimumBookingNoticeMinutes": scalar(o["minimumBookingNotice"]), "BeforeEventBufferMinutes": scalar(o["beforeEventBuffer"]),
            "AfterEventBufferMinutes": scalar(o["afterEventBuffer"]), "DisableGuests": scalar(o["disableGuests"]),
        ]
    }
    static func firstScalar(_ values: JSONValue?...) -> JSONValue { for value in values { let v = scalar(value); if v != .null { return v } }; return .null }
    static func scalar(_ value: JSONValue?) -> JSONValue { guard let value else { return .null }; switch value { case .string, .number, .bool, .null: return value; default: return .null } }
    static func json(_ any: Any) -> JSONValue {
        if any is NSNull { return .null }; if let v = any as? Bool { return .bool(v) }; if let v = any as? String { return .string(v) }; if let v = any as? NSNumber { return .number(v.doubleValue) }; if let v = any as? [Any] { return .array(v.map(json)) };
        if let v = any as? [String: Any] { return .object(v.mapValues(json)) }; return .null
    }
    static func fakeBooking() -> JSONRecord {
        [
            "BookingId": .number(123), "BookingUID": .string("booking_uid_123"), "Title": .string("Relay planning"), "Status": .string("accepted"), "Start": .string("2026-07-12T09:00:00Z"), "End": .string("2026-07-12T09:30:00Z"), "DurationMinutes": .number(30), "EventTypeId": .number(50),
            "EventTypeSlug": .string("relay-planning"), "AbsentHost": .bool(false), "CreatedAt": .string("2026-07-01T09:00:00Z"), "UpdatedAt": .string("2026-07-11T09:00:00Z"),
        ]
    }
    static func fakeEventType() -> JSONRecord { ["EventTypeId": .number(50), "Title": .string("Relay planning"), "Slug": .string("relay-planning"), "LengthInMinutes": .number(30), "Hidden": .bool(false), "IsInstantEvent": .bool(false), "BookingRequiresAuthentication": .bool(false)] }
}

private extension JSONValue { var calComObject: JSONRecord? { if case .object(let v) = self { return v }; return nil }; var calComArray: [JSONValue]? { if case .array(let v) = self { return v }; return nil } }
