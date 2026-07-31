import Foundation

public struct PagerDutyProviderActionClientResult: Sendable { public var result: JSONRecord; public init(result: JSONRecord) { self.result = result } }
public protocol PagerDutyProviderActionClient: Sendable { func executePagerDutyAction(request: MarketplaceProviderActionAdapterRequest) throws -> PagerDutyProviderActionClientResult }

public struct FakePagerDutyProviderActionClient: PagerDutyProviderActionClient {
    public init() {}
    public func executePagerDutyAction(request: MarketplaceProviderActionAdapterRequest) throws -> PagerDutyProviderActionClientResult {
        let fields: JSONRecord
        switch request.definition.actionKey {
        case "pagerduty_incident_list": fields = ["semanticReadContract": .string("pagerduty-incident-list-v1"), "incidents": .array([.object(PagerDutyProviderActionSupport.fakeIncident())]), "returnedCount": .number(1), "more": .bool(false)]
        case "pagerduty_incident_get": fields = ["semanticReadContract": .string("pagerduty-incident-get-v1"), "incident": .object(PagerDutyProviderActionSupport.fakeIncident())]
        case "pagerduty_service_list": fields = ["semanticReadContract": .string("pagerduty-service-list-v1"), "services": .array([.object(PagerDutyProviderActionSupport.fakeService())]), "returnedCount": .number(1), "more": .bool(false)]
        default: throw MarketplaceProviderActionAdapterFailure(code: "pagerduty_action_not_supported", message: "Unsupported PagerDuty action.")
        }
        return PagerDutyProviderActionClientResult(
            result: ["provider": .string("pagerduty"), "adapterBoundary": .string("pagerduty-provider-action-adapter"), "clientMode": .string("fake-pagerduty-rest-v2-client"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("contact-alert-content-excluded")].merging(fields) {
                _, n in n
            })
    }
}

public final class LivePagerDutyProviderActionClient: PagerDutyProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService; private let secrets: SecretService
    public init(data: LocalDataService, secrets: SecretService) { self.data = data; self.secrets = secrets }
    public func executePagerDutyAction(request: MarketplaceProviderActionAdapterRequest) throws -> PagerDutyProviderActionClientResult {
        let auth = try authorization(request), limit = PagerDutyProviderActionSupport.bound(request.payload["limit"])
        switch request.definition.actionKey {
        case "pagerduty_incident_list":
            let statuses = try PagerDutyProviderActionSupport.statuses(request.payload["statuses"]), query = [URLQueryItem(name: "limit", value: String(limit)), URLQueryItem(name: "offset", value: "0")] + statuses.map { URLQueryItem(name: "statuses[]", value: $0) },
                root = try get(auth, path: "/incidents", query: query), values = (root.pdObject?["incidents"]?.pdArray ?? []).map(PagerDutyProviderActionSupport.incident)
            return output("pagerduty-incident-list-v1", key: "incidents", values: values, more: root.pdObject?["more"]?.bool ?? false, limit: limit, rate: root.pdObject?["_relayRate"]?.pdObject)
        case "pagerduty_incident_get":
            let id = try PagerDutyProviderActionSupport.incidentId(request.payload["incidentId"]), root = try get(auth, path: "/incidents/" + id, query: []), value = root.pdObject?["incident"] ?? root
            return PagerDutyProviderActionClientResult(result: base(contract: "pagerduty-incident-get-v1").merging(["incident": .object(PagerDutyProviderActionSupport.incident(value))]) { _, n in n })
        case "pagerduty_service_list":
            let root = try get(auth, path: "/services", query: [URLQueryItem(name: "limit", value: String(limit)), URLQueryItem(name: "offset", value: "0")]), values = (root.pdObject?["services"]?.pdArray ?? []).map(PagerDutyProviderActionSupport.service)
            return output("pagerduty-service-list-v1", key: "services", values: values, more: root.pdObject?["more"]?.bool ?? false, limit: limit, rate: root.pdObject?["_relayRate"]?.pdObject)
        default: throw MarketplaceProviderActionAdapterFailure(code: "pagerduty_live_action_not_supported", message: "Unsupported live PagerDuty action.")
        }
    }
    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> (origin: String, token: String) {
        guard let id = request.auditIdentity.connectionId, let c = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), c.appSlug == "pagerduty", c.appId == request.app.id, c.status == .connected, c.health.state == .ready,
            let origin = c.health.diagnostics["apiOrigin"]?.string, PagerDutyProviderActionSupport.allowedAPIOrigins.contains(origin), let ref = c.credentialRequirements.first(where: { $0.fieldKey == "pagerduty_oauth_access_token" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "pagerduty_connection_not_ready", message: "PagerDuty requires a ready allowlisted Scoped OAuth connection.") }
        return (origin, try secrets.getSecretValue(ref))
    }
    private func get(_ auth: (origin: String, token: String), path: String, query: [URLQueryItem]) throws -> JSONValue {
        var c = URLComponents(string: auth.origin + path); c?.queryItems = query; guard let url = c?.url else { throw MarketplaceProviderActionAdapterFailure(code: "pagerduty_invalid_url", message: "Could not build an allowlisted PagerDuty API URL.") }
        var request = URLRequest(url: url); request.timeoutInterval = 20; request.setValue("Bearer " + auth.token, forHTTPHeaderField: "Authorization"); request.setValue("application/vnd.pagerduty+json;version=2", forHTTPHeaderField: "Accept");
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let semaphore = DispatchSemaphore(value: 0); var result: Result<(Data, Int, [AnyHashable: Any]), Error>!;
        URLSession.shared.dataTask(with: request) { d, r, e in
            result = e.map(Result.failure) ?? .success((d ?? Data(), (r as? HTTPURLResponse)?.statusCode ?? 0, (r as? HTTPURLResponse)?.allHeaderFields ?? [:])); semaphore.signal()
        }.resume()
        guard semaphore.wait(timeout: .now() + 20) == .success else { throw MarketplaceProviderActionAdapterFailure(code: "pagerduty_timeout", message: "PagerDuty API request timed out.") }
        let (body, status, headers) = try result.get()
        let retry = headers.first { String(describing: $0.key).lowercased() == "ratelimit-reset" }.flatMap { Double(String(describing: $0.value)) } ?? 0
        guard (200..<300).contains(status) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: status == 429 ? "pagerduty_rate_limited" : status == 401 ? "pagerduty_access_token_expired" : status == 403 ? "pagerduty_scope_denied" : status == 404 ? "pagerduty_not_found" : "pagerduty_api_error", message: "PagerDuty API request failed.", providerStatusCode: status,
                detail: ["retryAfterSeconds": .number(retry)])
        }
        var value = body.isEmpty ? JSONValue.object([:]) : PagerDutyProviderActionSupport.json(try JSONSerialization.jsonObject(with: body)); if case .object(var o) = value { o["_relayRate"] = .object(["resetSeconds": .number(retry)]); value = .object(o) }; return value
    }
    private func output(_ contract: String, key: String, values: [JSONRecord], more: Bool, limit: Int, rate: JSONRecord?) -> PagerDutyProviderActionClientResult {
        let bounded = Array(values.prefix(limit));
        return PagerDutyProviderActionClientResult(result: base(contract: contract).merging([key: .array(bounded.map(JSONValue.object)), "returnedCount": .number(Double(bounded.count)), "more": .bool(more), "automaticPagination": .bool(false), "rateLimit": .object(rate ?? [:])]) { _, n in n })
    }
    private func base(contract: String) -> JSONRecord {
        [
            "provider": .string("pagerduty"), "adapterBoundary": .string("pagerduty-provider-action-adapter"), "clientMode": .string("live-pagerduty-rest-v2"), "semanticReadContract": .string(contract), "rawProviderToolExposure": .bool(false),
            "redactionStatus": .string("contact-alert-content-excluded"),
        ]
    }
}

public struct PagerDutyProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = ["pagerduty_incident_list", "pagerduty_incident_get", "pagerduty_service_list"]
    private let client: any PagerDutyProviderActionClient
    public init(client: any PagerDutyProviderActionClient = FakePagerDutyProviderActionClient()) { self.client = client }
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "pagerduty", Self.allowed.contains(request.definition.actionKey), request.permission == .allowed else { throw MarketplaceProviderActionAdapterFailure(code: "pagerduty_action_not_allowlisted", message: "PagerDuty V1 permits only three bounded read actions.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executePagerDutyAction(request: request).result, error: nil, redactionStatus: "contact-alert-content-excluded")
    }
}

public enum PagerDutyProviderActionSupport {
    public static let allowedAPIOrigins: Set<String> = ["https://api.pagerduty.com", "https://api.eu.pagerduty.com"]
    static func bound(_ v: JSONValue?) -> Int { max(1, min(25, v?.number.map(Int.init) ?? v?.string.flatMap(Int.init) ?? 10)) }
    static func statuses(_ v: JSONValue?) throws -> [String] {
        guard let v else { return ["triggered", "acknowledged"] }; let values: [String];
        if case .array(let a) = v {
            values = a.compactMap(\.string)
        } else if let s = v.string {
            values = s.split(separator: ",").map { String($0).trimmingCharacters(in: .whitespaces) }
        } else {
            throw MarketplaceProviderActionAdapterFailure(code: "pagerduty_statuses_invalid", message: "PagerDuty statuses must be a string or array.")
        };
        guard !values.isEmpty, values.count <= 3, values.allSatisfy({ ["triggered", "acknowledged", "resolved"].contains($0) }) else {
            throw MarketplaceProviderActionAdapterFailure(code: "pagerduty_statuses_invalid", message: "PagerDuty statuses must be a subset of triggered, acknowledged, resolved.")
        }; return values
    }
    static func incidentId(_ v: JSONValue?) throws -> String {
        guard let id = v?.string, (1...64).contains(id.count), id.allSatisfy({ $0.isLetter || $0.isNumber || $0 == "_" || $0 == "-" }) else { throw MarketplaceProviderActionAdapterFailure(code: "pagerduty_incident_id_invalid", message: "A safe PagerDuty incident ID is required.") }; return id
    }
    static func scalar(_ v: JSONValue?) -> JSONValue { guard let v else { return .null }; switch v { case .string(let s): return .string(String(s.prefix(1200))); case .number, .bool, .null: return v; default: return .null } }
    static func reference(_ v: JSONValue?) -> JSONValue { let o = v?.pdObject ?? [:]; return .object(["id": scalar(o["id"]), "name": scalar(o["summary"] ?? o["name"]), "type": scalar(o["type"])]) }
    static func incident(_ v: JSONValue) -> JSONRecord {
        let o = v.pdObject ?? [:];
        return [
            "id": scalar(o["id"]), "incidentNumber": scalar(o["incident_number"]), "title": scalar(o["title"] ?? o["summary"]), "status": scalar(o["status"]), "urgency": scalar(o["urgency"]), "createdAt": scalar(o["created_at"]), "updatedAt": scalar(o["updated_at"] ?? o["last_status_change_at"]),
            "service": reference(o["service"]), "escalationPolicy": reference(o["escalation_policy"]), "assignments": .array((o["assignments"]?.pdArray ?? []).prefix(10).map { reference($0) }), "alertCount": scalar(o["alert_counts"]?.pdObject?["all"] ?? o["alerts_count"]),
            "contactDataReturned": .bool(false), "alertContentReturned": .bool(false),
        ]
    }
    static func service(_ v: JSONValue) -> JSONRecord {
        let o = v.pdObject ?? [:];
        return [
            "id": scalar(o["id"]), "name": scalar(o["name"] ?? o["summary"]), "description": scalar(o["description"]), "status": scalar(o["status"]), "createdAt": scalar(o["created_at"]), "escalationPolicy": reference(o["escalation_policy"]),
            "teams": .array((o["teams"]?.pdArray ?? []).prefix(10).map { reference($0) }), "integrationCount": .number(Double(o["integrations"]?.pdArray?.count ?? 0)), "contactDataReturned": .bool(false),
        ]
    }
    public static func fakeIncident() -> JSONRecord {
        [
            "id": .string("PINCIDENT1"), "incidentNumber": .number(42), "title": .string("Checkout API latency"), "status": .string("triggered"), "urgency": .string("high"), "createdAt": .string("2026-07-11T09:00:00Z"), "updatedAt": .string("2026-07-11T09:04:00Z"),
            "service": .object(["id": .string("PSERVICE1"), "name": .string("Checkout API"), "type": .string("service_reference")]), "escalationPolicy": .object(["id": .string("PEP1"), "name": .string("Commerce escalation"), "type": .string("escalation_policy_reference")]),
            "assignments": .array([]), "alertCount": .number(2), "contactDataReturned": .bool(false), "alertContentReturned": .bool(false),
        ]
    }
    public static func fakeService() -> JSONRecord {
        [
            "id": .string("PSERVICE1"), "name": .string("Checkout API"), "description": .string("Production checkout service"), "status": .string("active"), "createdAt": .string("2026-01-01T00:00:00Z"),
            "escalationPolicy": .object(["id": .string("PEP1"), "name": .string("Commerce escalation"), "type": .string("escalation_policy_reference")]), "teams": .array([.object(["id": .string("PTEAM1"), "name": .string("Commerce Platform"), "type": .string("team_reference")])]),
            "integrationCount": .number(1), "contactDataReturned": .bool(false),
        ]
    }
    static func json(_ v: Any) -> JSONValue {
        if let x = v as? String { return .string(x) }; if let x = v as? Bool { return .bool(x) }; if let x = v as? NSNumber { return .number(x.doubleValue) }; if let x = v as? [String: Any] { return .object(x.mapValues(json)) }; if let x = v as? [Any] { return .array(x.map(json)) }; return .null
    }
}
private extension JSONValue { var pdObject: JSONRecord? { if case .object(let v) = self { return v }; return nil }; var pdArray: [JSONValue]? { if case .array(let v) = self { return v }; return nil } }
