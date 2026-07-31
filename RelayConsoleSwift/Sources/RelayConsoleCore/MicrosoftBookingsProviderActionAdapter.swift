import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

public struct MicrosoftBookingsProviderActionClientResult: Sendable { public var result: JSONRecord; public init(result: JSONRecord) { self.result = result } }
public protocol MicrosoftBookingsProviderActionClient: Sendable { func executeMicrosoftBookingsAction(request: MarketplaceProviderActionAdapterRequest) throws -> MicrosoftBookingsProviderActionClientResult }
public struct FakeMicrosoftBookingsProviderActionClient: MicrosoftBookingsProviderActionClient {
  public init() {}
    public func executeMicrosoftBookingsAction(request: MarketplaceProviderActionAdapterRequest) throws -> MicrosoftBookingsProviderActionClientResult {
        let fields: JSONRecord;
        switch request.definition.actionKey {
        case "microsoft_bookings_business_get": fields = ["business": .object(MicrosoftBookingsProviderActionSupport.fakeBusiness())];
        case "microsoft_bookings_services_list": fields = ["services": .array([.object(MicrosoftBookingsProviderActionSupport.fakeService())]), "resultCount": .number(1)];
        case "microsoft_bookings_service_get": _ = try MicrosoftBookingsProviderActionSupport.identifier(request.payload["serviceId"], "serviceId"); fields = ["service": .object(MicrosoftBookingsProviderActionSupport.fakeService())];
        case "microsoft_bookings_calendar_view": _ = try MicrosoftBookingsProviderActionSupport.range(request.payload); fields = ["appointments": .array([.object(MicrosoftBookingsProviderActionSupport.fakeAppointment())]), "resultCount": .number(1)];
        default: throw MarketplaceProviderActionAdapterFailure(code: "microsoft_bookings_action_not_supported", message: "Unsupported Microsoft Bookings action.")
        }; return MicrosoftBookingsProviderActionClientResult(result: MicrosoftBookingsProviderActionSupport.base("fake-microsoft-graph").merging(fields) { _, n in n })
    }
}
public final class LiveMicrosoftBookingsProviderActionClient: MicrosoftBookingsProviderActionClient, @unchecked Sendable {
  private let data: LocalDataService; private let secrets: SecretService
  public init(data: LocalDataService, secrets: SecretService) { self.data = data; self.secrets = secrets }
    public func executeMicrosoftBookingsAction(request: MarketplaceProviderActionAdapterRequest) throws -> MicrosoftBookingsProviderActionClientResult {
        let auth = try authorization(request), business = auth.business.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? auth.business, root: JSONValue, fields: JSONRecord;
        switch request.definition.actionKey {
        case "microsoft_bookings_business_get": root = try get(token: auth.token, path: "/solutions/bookingBusinesses/\(business)"); fields = ["business": .object(MicrosoftBookingsProviderActionSupport.business(root))];
        case "microsoft_bookings_services_list":
            root = try get(token: auth.token, path: "/solutions/bookingBusinesses/\(business)/services"); let values = MicrosoftBookingsProviderActionSupport.records(root).map(MicrosoftBookingsProviderActionSupport.service);
            fields = ["services": .array(values.map(JSONValue.object)), "resultCount": .number(Double(values.count)), "nextPageFollowed": .bool(false)];
        case "microsoft_bookings_service_get":
            let id = try MicrosoftBookingsProviderActionSupport.identifier(request.payload["serviceId"], "serviceId"); root = try get(token: auth.token, path: "/solutions/bookingBusinesses/\(business)/services/\(id)");
            fields = ["service": .object(MicrosoftBookingsProviderActionSupport.service(root))];
        case "microsoft_bookings_calendar_view":
            let r = try MicrosoftBookingsProviderActionSupport.range(request.payload); let start = r.0.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? r.0, end = r.1.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? r.1;
            root = try get(token: auth.token, path: "/solutions/bookingBusinesses/\(business)/calendarView?start=\(start)&end=\(end)"); let values = MicrosoftBookingsProviderActionSupport.records(root).map(MicrosoftBookingsProviderActionSupport.appointment);
            fields = ["appointments": .array(values.map(JSONValue.object)), "resultCount": .number(Double(values.count)), "nextPageFollowed": .bool(false)];
        default: throw MarketplaceProviderActionAdapterFailure(code: "microsoft_bookings_live_action_not_supported", message: "Unsupported live Microsoft Bookings action.")
        }; return MicrosoftBookingsProviderActionClientResult(result: MicrosoftBookingsProviderActionSupport.base("live-microsoft-graph").merging(fields) { _, n in n })
    }
    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> (token: String, business: String) {
        guard let id = request.auditIdentity.connectionId, let c = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), c.appSlug == "microsoft-bookings", c.appId == request.app.id, c.status == .connected, c.health.state == .ready,
            c.grantedScopes == ProviderConnectionService.microsoftBookingsRelayOwnedOAuthScopes, c.health.diagnostics["selectedBusinessVerified"]?.bool == true, c.health.diagnostics["customerPIIEnabled"]?.bool == false, c.health.diagnostics["staffIdentityEnabled"]?.bool == false,
            c.health.diagnostics["writesEnabled"]?.bool == false, c.health.diagnostics["automaticPagination"]?.bool == false, c.health.diagnostics["rawToolsEnabled"]?.bool == false, let business = c.health.diagnostics["selectedBusinessId"]?.string,
            let ref = c.credentialRequirements.first(where: { $0.fieldKey == "microsoft_bookings_oauth_access_token" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "microsoft_bookings_connection_not_ready", message: "Microsoft Bookings requires a ready selected-business exact-scope connection.") };
        return (try secrets.getSecretValue(ref), try MicrosoftBookingsProviderActionSupport.identifier(.string(business), "selectedBusinessId"))
    }
    private func get(token: String, path: String) throws -> JSONValue {
        guard let url = URL(string: "https://graph.microsoft.com/v1.0" + path), url.scheme == "https", url.host == "graph.microsoft.com", url.path.hasPrefix("/v1.0/solutions/bookingBusinesses/"), !url.path.contains("/customers"), !url.path.contains("/staffMembers"),
            !url.path.contains("/customQuestions")
        else { throw MarketplaceProviderActionAdapterFailure(code: "microsoft_bookings_unsafe_url", message: "Unsafe Microsoft Bookings Graph request.") }; var req = URLRequest(url: url, timeoutInterval: 30); req.httpMethod = "GET";
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization"); let sem = DispatchSemaphore(value: 0); var captured: Result<(Data, HTTPURLResponse), Error>?;
        URLSession.shared.dataTask(with: req) { bytes, response, error in
            defer { sem.signal() }; if let error { captured = .failure(error); return };
            guard let bytes, let response = response as? HTTPURLResponse else { captured = .failure(MarketplaceProviderActionAdapterFailure(code: "microsoft_bookings_transport_error", message: "Graph returned no HTTP response.")); return }; captured = .success((bytes, response))
        }.resume(); guard sem.wait(timeout: .now() + 31) == .success, let captured else { throw MarketplaceProviderActionAdapterFailure(code: "microsoft_bookings_timeout", message: "Graph request timed out.") }; let (bytes, response) = try captured.get();
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(code: response.statusCode == 429 ? "microsoft_bookings_rate_limited" : "microsoft_bookings_graph_error", message: "Microsoft Bookings Graph request failed.", providerStatusCode: response.statusCode)
        }; guard bytes.count <= 1_000_000 else { throw MarketplaceProviderActionAdapterFailure(code: "microsoft_bookings_response_too_large", message: "Graph response exceeded 1 MB.") }; return try JSONDecoder().decode(JSONValue.self, from: bytes)
    }
}
public struct MicrosoftBookingsProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = ["microsoft_bookings_business_get", "microsoft_bookings_services_list", "microsoft_bookings_service_get", "microsoft_bookings_calendar_view"]; private let client: any MicrosoftBookingsProviderActionClient;
    public init(client: any MicrosoftBookingsProviderActionClient = FakeMicrosoftBookingsProviderActionClient()) { self.client = client };
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "microsoft-bookings", Self.allowed.contains(request.definition.actionKey), request.permission == .allowed else {
            throw MarketplaceProviderActionAdapterFailure(code: "microsoft_bookings_action_not_allowlisted", message: "Microsoft Bookings V1 permits only four selected-business privacy-scrubbed reads.")
        }; return MarketplaceProviderActionAdapterResult(result: try client.executeMicrosoftBookingsAction(request: request).result, error: nil, redactionStatus: "customer-staff-contact-notes-join-writes-pagination-raw-excluded")
    }
}
public enum MicrosoftBookingsProviderActionSupport {
    static func base(_ mode: String) -> JSONRecord {
        [
            "provider": .string("microsoft-bookings"), "adapterBoundary": .string("microsoft-bookings-provider-action-adapter"), "clientMode": .string(mode), "selectedBusinessOnly": .bool(true), "privacyScrubbed": .bool(true), "maxResults": .number(25), "writesEnabled": .bool(false),
            "automaticPagination": .bool(false), "rawProviderToolExposure": .bool(false),
        ]
    }
    static func object(_ v: JSONValue?) -> JSONRecord { guard case .object(let r)? = v else { return [:] }; return r }; static func array(_ v: JSONValue?) -> [JSONValue] { guard case .array(let a)? = v else { return [] }; return a };
    static func scalar(_ v: JSONValue?, _ max: Int = 512) -> JSONValue { guard let v else { return .null }; if case .string(let s) = v { return .string(String(s.prefix(max))) }; if case .number = v { return v }; if case .bool = v { return v }; return .null };
    static func records(_ root: JSONValue?) -> [JSONValue] { Array(array(object(root)["value"]).prefix(25)) }
    static func identifier(_ v: JSONValue?, _ field: String) throws -> String {
        guard let s = v?.string, !s.isEmpty, s.count <= 512, s.allSatisfy({ $0.isLetter || $0.isNumber || "-_.@!~=".contains($0) }) else { throw MarketplaceProviderActionAdapterFailure(code: "microsoft_bookings_invalid_identifier", message: "An explicit safe \(field) is required.") }; return s
    }
    static func range(_ payload: JSONRecord) throws -> (String, String) {
        guard let start = payload["start"]?.string, let end = payload["end"]?.string, let s = ISO8601DateFormatter().date(from: start), let e = ISO8601DateFormatter().date(from: end), e > s, e.timeIntervalSince(s) <= 7 * 86_400 else {
            throw MarketplaceProviderActionAdapterFailure(code: "microsoft_bookings_invalid_range", message: "Calendar view requires an explicit positive ISO-8601 range of at most seven days.")
        }; return (start, end)
    }
    static func business(_ v: JSONValue?) -> JSONRecord {
        let r = object(v);
        return [
            "id": scalar(r["id"]), "displayName": scalar(r["displayName"]), "businessType": scalar(r["businessType"]), "defaultCurrencyIso": scalar(r["defaultCurrencyIso"], 16), "timeZone": scalar(r["timeZone"], 128), "emailExcluded": .bool(true), "phoneExcluded": .bool(true),
            "addressExcluded": .bool(true), "websiteExcluded": .bool(true),
        ]
    }
    static func service(_ v: JSONValue?) -> JSONRecord {
        let r = object(v);
        return [
            "id": scalar(r["id"]), "displayName": scalar(r["displayName"]), "duration": scalar(r["defaultDuration"], 64), "price": scalar(r["defaultPrice"]), "priceType": scalar(r["defaultPriceType"], 64), "maximumAttendeesCount": scalar(r["maximumAttendeesCount"]),
            "descriptionExcluded": .bool(true), "notesExcluded": .bool(true), "staffMembersExcluded": .bool(true), "customQuestionsExcluded": .bool(true),
        ]
    }
  static func dateTime(_ v: JSONValue?) -> JSONValue { let r = object(v); return .object(["dateTime": scalar(r["dateTime"], 64), "timeZone": scalar(r["timeZone"], 128)]) }
    static func appointment(_ v: JSONValue?) -> JSONRecord {
        let r = object(v);
        return [
            "id": scalar(r["id"]), "serviceId": scalar(r["serviceId"]), "serviceName": scalar(r["serviceName"]), "start": dateTime(r["start"]), "end": dateTime(r["end"]), "duration": scalar(r["duration"], 64), "appointmentLabel": scalar(r["appointmentLabel"]), "customersExcluded": .bool(true),
            "customerContactExcluded": .bool(true), "customerNotesExcluded": .bool(true), "staffMembersExcluded": .bool(true), "joinURLExcluded": .bool(true), "additionalInformationExcluded": .bool(true),
        ]
    }
    static func fakeBusiness() -> JSONRecord {
        [
            "id": .string("contoso@contoso.com"), "displayName": .string("Contoso Consultations"), "businessType": .string("Consulting"), "defaultCurrencyIso": .string("GBP"), "timeZone": .string("Europe/London"), "emailExcluded": .bool(true), "phoneExcluded": .bool(true),
            "addressExcluded": .bool(true), "websiteExcluded": .bool(true),
        ]
    };
    static func fakeService() -> JSONRecord {
        [
            "id": .string("service-001"), "displayName": .string("Strategy consultation"), "duration": .string("PT30M"), "price": .number(75), "priceType": .string("fixedPrice"), "maximumAttendeesCount": .number(1), "descriptionExcluded": .bool(true), "notesExcluded": .bool(true),
            "staffMembersExcluded": .bool(true), "customQuestionsExcluded": .bool(true),
        ]
    };
    static func fakeAppointment() -> JSONRecord {
        [
            "id": .string("appointment-001"), "serviceId": .string("service-001"), "serviceName": .string("Strategy consultation"), "start": .object(["dateTime": .string("2026-07-13T09:00:00"), "timeZone": .string("Europe/London")]),
            "end": .object(["dateTime": .string("2026-07-13T09:30:00"), "timeZone": .string("Europe/London")]), "duration": .string("PT30M"), "appointmentLabel": .string("Confirmed"), "customersExcluded": .bool(true), "customerContactExcluded": .bool(true), "customerNotesExcluded": .bool(true),
            "staffMembersExcluded": .bool(true), "joinURLExcluded": .bool(true), "additionalInformationExcluded": .bool(true),
        ]
    }
}
