import Foundation

public struct DatadogProviderActionClientResult: Sendable { public var result: JSONRecord; public init(result: JSONRecord) { self.result = result } }
public protocol DatadogProviderActionClient: Sendable { func executeDatadogAction(request: MarketplaceProviderActionAdapterRequest) throws -> DatadogProviderActionClientResult }

public struct FakeDatadogProviderActionClient: DatadogProviderActionClient {
    public init() {}
    public func executeDatadogAction(request: MarketplaceProviderActionAdapterRequest) throws -> DatadogProviderActionClientResult {
        let fields: JSONRecord
        switch request.definition.actionKey {
        case "datadog_search_monitors": fields = ["semanticReadContract": .string("datadog-monitor-search-v1"), "monitors": .array([.object(DatadogProviderActionSupport.fakeMonitor())]), "returnedCount": .number(1), "truncated": .bool(false)]
        case "datadog_search_incidents": fields = ["semanticReadContract": .string("datadog-incident-search-v1"), "incidents": .array([.object(DatadogProviderActionSupport.fakeIncident())]), "returnedCount": .number(1), "truncated": .bool(false)]
        case "datadog_list_services": fields = ["semanticReadContract": .string("datadog-service-catalog-v1"), "services": .array([.object(DatadogProviderActionSupport.fakeService())]), "returnedCount": .number(1), "truncated": .bool(false)]
        default: throw MarketplaceProviderActionAdapterFailure(code: "datadog_action_not_supported", message: "Unsupported Datadog action.")
        }
        return DatadogProviderActionClientResult(
            result: ["provider": .string("datadog"), "adapterBoundary": .string("datadog-provider-action-adapter"), "clientMode": .string("fake-datadog-rest-client"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("observability-payload-bounded")].merging(fields) { _, n in n })
    }
}

public final class LiveDatadogProviderActionClient: DatadogProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService; private let secrets: SecretService
    public init(data: LocalDataService, secrets: SecretService) { self.data = data; self.secrets = secrets }
    public func executeDatadogAction(request: MarketplaceProviderActionAdapterRequest) throws -> DatadogProviderActionClientResult {
        let auth = try authorization(request), limit = DatadogProviderActionSupport.bound(request.payload["limit"])
        let value: JSONValue
        switch request.definition.actionKey {
        case "datadog_search_monitors":
            value = try get(auth, path: "/api/v1/monitor/search", query: [URLQueryItem(name: "query", value: request.payload["query"]?.string), URLQueryItem(name: "page", value: "0"), URLQueryItem(name: "per_page", value: String(limit))]);
            return output("datadog-monitor-search-v1", key: "monitors", values: (value.ddObject?["monitors"]?.ddArray ?? []).map(DatadogProviderActionSupport.monitor), limit: limit)
        case "datadog_search_incidents":
            value = try get(auth, path: "/api/v2/incidents/search", query: [URLQueryItem(name: "query", value: request.payload["query"]?.string), URLQueryItem(name: "page[size]", value: String(limit))]);
            return output("datadog-incident-search-v1", key: "incidents", values: (value.ddObject?["data"]?.ddArray ?? []).map(DatadogProviderActionSupport.incident), limit: limit)
        case "datadog_list_services":
            value = try get(auth, path: "/api/v2/services/definitions", query: [URLQueryItem(name: "page[size]", value: String(limit))]);
            return output("datadog-service-catalog-v1", key: "services", values: (value.ddObject?["data"]?.ddArray ?? value.ddArray ?? []).map(DatadogProviderActionSupport.service), limit: limit)
        default: throw MarketplaceProviderActionAdapterFailure(code: "datadog_live_action_not_supported", message: "Unsupported live Datadog action.")
        }
    }
    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> (origin: String, token: String) {
        guard let id = request.auditIdentity.connectionId, let c = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), c.appSlug == "datadog", c.appId == request.app.id, let origin = c.health.diagnostics["apiOrigin"]?.string,
            DatadogProviderActionSupport.allowedAPIOrigins.contains(origin), let ref = c.credentialRequirements.first(where: { $0.fieldKey == "datadog_oauth_access_token" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "datadog_connection_not_ready", message: "Datadog requires a ready allowlisted OAuth connection.") }
        return (origin, try secrets.getSecretValue(ref))
    }
    private func get(_ auth: (origin: String, token: String), path: String, query: [URLQueryItem]) throws -> JSONValue {
        var c = URLComponents(string: auth.origin + path); c?.queryItems = query.filter { $0.value?.isEmpty == false }; guard let url = c?.url else { throw MarketplaceProviderActionAdapterFailure(code: "datadog_invalid_url", message: "Could not build an allowlisted Datadog API URL.") }
        var request = URLRequest(url: url); request.timeoutInterval = 20; request.setValue("Bearer " + auth.token, forHTTPHeaderField: "Authorization"); request.setValue("application/json", forHTTPHeaderField: "Accept")
        let semaphore = DispatchSemaphore(value: 0); var result: Result<(Data, Int), Error>!; URLSession.shared.dataTask(with: request) { d, r, e in result = e.map(Result.failure) ?? .success((d ?? Data(), (r as? HTTPURLResponse)?.statusCode ?? 0)); semaphore.signal() }.resume()
        guard semaphore.wait(timeout: .now() + 20) == .success else { throw MarketplaceProviderActionAdapterFailure(code: "datadog_timeout", message: "Datadog API request timed out.") }
        let (body, status) = try result.get();
        guard (200..<300).contains(status) else {
            throw MarketplaceProviderActionAdapterFailure(code: status == 429 ? "datadog_rate_limited" : status == 401 ? "datadog_access_token_expired" : status == 403 ? "datadog_scope_denied" : "datadog_api_error", message: "Datadog API request failed.", providerStatusCode: status)
        }
        return body.isEmpty ? .object([:]) : DatadogProviderActionSupport.json(try JSONSerialization.jsonObject(with: body))
    }
    private func output(_ contract: String, key: String, values: [JSONRecord], limit: Int) -> DatadogProviderActionClientResult {
        let bounded = Array(values.prefix(limit));
        return DatadogProviderActionClientResult(result: [
            "provider": .string("datadog"), "adapterBoundary": .string("datadog-provider-action-adapter"), "clientMode": .string("live-datadog-rest-api"), "semanticReadContract": .string(contract), key: .array(bounded.map(JSONValue.object)), "returnedCount": .number(Double(bounded.count)),
            "truncated": .bool(values.count > limit), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("observability-payload-bounded"),
        ])
    }
}

public struct DatadogProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = ["datadog_search_monitors", "datadog_search_incidents", "datadog_list_services"]
    private let client: any DatadogProviderActionClient
    public init(client: any DatadogProviderActionClient = FakeDatadogProviderActionClient()) { self.client = client }
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "datadog", Self.allowed.contains(request.definition.actionKey), request.permission == .allowed else { throw MarketplaceProviderActionAdapterFailure(code: "datadog_action_not_allowlisted", message: "Datadog V1 permits only its three bounded read actions.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executeDatadogAction(request: request).result, error: nil, redactionStatus: "observability-payload-bounded")
    }
}

public enum DatadogProviderActionSupport {
    public static let allowedAPIOrigins: Set<String> = [
        "https://api.datadoghq.com", "https://api.us3.datadoghq.com", "https://api.us5.datadoghq.com", "https://api.datadoghq.eu", "https://api.ap1.datadoghq.com", "https://api.ap2.datadoghq.com", "https://api.uk1.datadoghq.com", "https://api.ddog-gov.com", "https://api.us2.ddog-gov.com",
    ]
    static func bound(_ v: JSONValue?) -> Int { max(1, min(25, v?.number.map(Int.init) ?? v?.string.flatMap(Int.init) ?? 10)) }
    static func scalar(_ v: JSONValue?) -> JSONValue { guard let v else { return .null }; switch v { case .string(let s): return .string(String(s.prefix(1000))); case .number, .bool, .null: return v; default: return .null } }
    static func monitor(_ v: JSONValue) -> JSONRecord {
        let o = v.ddObject ?? [:];
        return ["id": scalar(o["id"]), "name": scalar(o["name"]), "status": scalar(o["status"] ?? o["overall_state"]), "type": scalar(o["type"]), "tags": safeArray(o["tags"]), "scopes": safeArray(o["scopes"]), "lastTriggeredAt": scalar(o["last_triggered_ts"]), "priority": scalar(o["priority"])]
    }
    static func incident(_ v: JSONValue) -> JSONRecord {
        let o = v.ddObject ?? [:], a = o["attributes"]?.ddObject ?? o;
        return [
            "id": scalar(o["id"]), "title": scalar(a["title"]), "status": scalar(a["state"] ?? a["status"]), "severity": scalar(a["severity"]), "createdAt": scalar(a["created"] ?? a["created_at"]), "modifiedAt": scalar(a["modified"] ?? a["modified_at"]),
            "commander": scalar(a["commander"]?.ddObject?["name"]), "services": safeArray(a["services"]),
        ]
    }
    static func service(_ v: JSONValue) -> JSONRecord {
        let o = v.ddObject ?? [:], a = o["attributes"]?.ddObject ?? o, schema = a["schema"]?.ddObject ?? a;
        return [
            "id": scalar(o["id"]), "name": scalar(schema["dd-service"] ?? schema["name"]), "schemaVersion": scalar(a["schema-version"] ?? a["schema_version"]), "description": scalar(schema["description"]), "lifecycle": scalar(schema["lifecycle"]), "owner": scalar(schema["team"] ?? schema["owner"]),
            "contacts": safeArray(schema["contacts"]), "links": safeArray(schema["links"]), "tags": safeArray(schema["tags"]),
        ]
    }
    static func safeArray(_ v: JSONValue?) -> JSONValue {
        guard let a = v?.ddArray else { return .array([]) };
        return .array(
            a.prefix(25).map {
                if let s = $0.string { return .string(String(s.prefix(500))) }; if let o = $0.ddObject { return .object(o.prefix(8).reduce(into: JSONRecord()) { $0[$1.key] = scalar($1.value) }) }; return .null
            })
    }
    public static func fakeMonitor() -> JSONRecord { ["id": .number(101), "name": .string("API latency high"), "status": .string("Alert"), "type": .string("metric alert"), "tags": .array([.string("service:api")]), "lastTriggeredAt": .number(1783760400), "priority": .number(1)] }
    public static func fakeIncident() -> JSONRecord {
        [
            "id": .string("incident-101"), "title": .string("Checkout latency regression"), "status": .string("active"), "severity": .string("SEV-2"), "createdAt": .string("2026-07-11T09:00:00Z"), "modifiedAt": .string("2026-07-11T09:05:00Z"), "commander": .string("Operations"),
            "services": .array([.string("checkout")]),
        ]
    }
    public static func fakeService() -> JSONRecord {
        [
            "id": .string("service-checkout"), "name": .string("checkout"), "schemaVersion": .string("v2.2"), "description": .string("Checkout API"), "lifecycle": .string("production"), "owner": .string("Commerce Platform"), "contacts": .array([.string("on-call")]),
            "links": .array([.string("runbook")]), "tags": .array([.string("tier:1")]),
        ]
    }
    static func json(_ v: Any) -> JSONValue {
        if let x = v as? String { return .string(x) }; if let x = v as? Bool { return .bool(x) }; if let x = v as? NSNumber { return .number(x.doubleValue) }; if let x = v as? [String: Any] { return .object(x.mapValues(json)) }; if let x = v as? [Any] { return .array(x.map(json)) }; return .null
    }
}
private extension JSONValue { var ddObject: JSONRecord? { if case .object(let v) = self { return v }; return nil }; var ddArray: [JSONValue]? { if case .array(let v) = self { return v }; return nil } }
