import Foundation

public struct CloudflareProviderActionClientResult: Sendable { public var result: JSONRecord; public init(result: JSONRecord) { self.result = result } }
public protocol CloudflareProviderActionClient: Sendable { func executeCloudflareAction(request: MarketplaceProviderActionAdapterRequest) throws -> CloudflareProviderActionClientResult }

public struct FakeCloudflareProviderActionClient: CloudflareProviderActionClient {
    public init() {}
    public func executeCloudflareAction(request: MarketplaceProviderActionAdapterRequest) throws -> CloudflareProviderActionClientResult {
        let fields: JSONRecord
        switch request.definition.actionKey {
        case "cloudflare_zone_list": fields = ["semanticReadContract": .string("cloudflare-zone-list-v1"), "zones": .array([.object(CloudflareProviderActionSupport.fakeZone())]), "returnedCount": .number(1), "more": .bool(false)]
        case "cloudflare_zone_get": fields = ["semanticReadContract": .string("cloudflare-zone-get-v1"), "zone": .object(CloudflareProviderActionSupport.fakeZone())]
        case "cloudflare_zone_traffic_overview": fields = ["semanticReadContract": .string("cloudflare-zone-traffic-overview-v1"), "traffic": .object(CloudflareProviderActionSupport.fakeTraffic())]
        default: throw MarketplaceProviderActionAdapterFailure(code: "cloudflare_action_not_supported", message: "Unsupported Cloudflare action.")
        }
        return CloudflareProviderActionClientResult(
            result: ["provider": .string("cloudflare"), "adapterBoundary": .string("cloudflare-provider-action-adapter"), "clientMode": .string("fake-cloudflare-api-client"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("logs-request-dimensions-excluded")].merging(fields) {
                _, n in n
            })
    }
}

public final class LiveCloudflareProviderActionClient: CloudflareProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService; private let secrets: SecretService
    public init(data: LocalDataService, secrets: SecretService) { self.data = data; self.secrets = secrets }

    public func executeCloudflareAction(request: MarketplaceProviderActionAdapterRequest) throws -> CloudflareProviderActionClientResult {
        let auth = try authorization(request)
        switch request.definition.actionKey {
        case "cloudflare_zone_list":
            let limit = CloudflareProviderActionSupport.bound(request.payload["limit"], maximum: 25, fallback: 10)
            let root = try call(
                auth, method: "GET", path: "/zones",
                query: [URLQueryItem(name: "account.id", value: auth.accountId), URLQueryItem(name: "page", value: "1"), URLQueryItem(name: "per_page", value: String(limit)), URLQueryItem(name: "order", value: "name"), URLQueryItem(name: "direction", value: "asc")], body: nil)
            let values = (root.cfObject?["result"]?.cfArray ?? []).prefix(limit).map(CloudflareProviderActionSupport.zone)
            let info = root.cfObject?["result_info"]?.cfObject ?? [:], totalPages = info["total_pages"]?.number ?? 1
            return CloudflareProviderActionClientResult(
                result: base("cloudflare-zone-list-v1").merging(["zones": .array(values.map(JSONValue.object)), "returnedCount": .number(Double(values.count)), "more": .bool(totalPages > 1), "automaticPagination": .bool(false), "rateLimit": root.cfObject?["_relayRate"] ?? .object([:])]) { _, n in n
                })
        case "cloudflare_zone_get":
            let root = try call(auth, method: "GET", path: "/zones/" + auth.zoneId, query: [], body: nil), value = root.cfObject?["result"] ?? .object([:])
            return CloudflareProviderActionClientResult(result: base("cloudflare-zone-get-v1").merging(["zone": .object(CloudflareProviderActionSupport.zone(value))]) { _, n in n })
        case "cloudflare_zone_traffic_overview":
            let hours = CloudflareProviderActionSupport.bound(request.payload["hours"], maximum: 24, fallback: 24), end = Date(), start = end.addingTimeInterval(TimeInterval(-hours * 3600)), formatter = ISO8601DateFormatter()
            let query =
                """
                    query RelayZoneTraffic($zoneTag: string!, $start: Time!, $end: Time!) { viewer { zones(filter: { zoneTag: $zoneTag }) { httpRequestsAdaptiveGroups(limit: 1000, filter: { datetime_geq: $start, datetime_lt: $end, \
                    requestSource: eyeball }) { count sum { edgeResponseBytes visits } } } } }
                    """
            let payload: JSONRecord = ["query": .string(query), "variables": .object(["zoneTag": .string(auth.zoneId), "start": .string(formatter.string(from: start)), "end": .string(formatter.string(from: end))])]
            let root = try call(auth, method: "POST", path: "/graphql", query: [], body: payload), groups = root.cfObject?["data"]?.cfObject?["viewer"]?.cfObject?["zones"]?.cfArray?.first?.cfObject?["httpRequestsAdaptiveGroups"]?.cfArray ?? []
            var requests = 0.0, bytes = 0.0, visits = 0.0
            for group in groups { let o = group.cfObject ?? [:], sum = o["sum"]?.cfObject ?? [:]; requests += o["count"]?.number ?? 0; bytes += sum["edgeResponseBytes"]?.number ?? 0; visits += sum["visits"]?.number ?? 0 }
            let traffic: JSONRecord = [
                "zoneId": .string(auth.zoneId), "zoneName": .string(auth.zoneName), "windowStart": .string(formatter.string(from: start)), "windowEnd": .string(formatter.string(from: end)), "windowHours": .number(Double(hours)), "requests": .number(requests), "edgeResponseBytes": .number(bytes),
                "visits": .number(visits), "groupCount": .number(Double(groups.count)), "requestLevelDimensionsReturned": .bool(false), "rawLogsReturned": .bool(false),
            ]
            return CloudflareProviderActionClientResult(result: base("cloudflare-zone-traffic-overview-v1").merging(["traffic": .object(traffic), "rateLimit": root.cfObject?["_relayRate"] ?? .object([:])]) { _, n in n })
        default: throw MarketplaceProviderActionAdapterFailure(code: "cloudflare_live_action_not_supported", message: "Unsupported live Cloudflare action.")
        }
    }

    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> (token: String, accountId: String, zoneId: String, zoneName: String) {
        guard let id = request.auditIdentity.connectionId, let c = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), c.appSlug == "cloudflare", c.appId == request.app.id, c.status == .connected, c.health.state == .ready,
            c.health.diagnostics["apiOrigin"]?.string == CloudflareProviderActionSupport.apiOrigin, let accountId = c.health.diagnostics["accountId"]?.string, CloudflareProviderActionSupport.safeId(accountId), let zoneId = c.health.diagnostics["zoneId"]?.string,
            CloudflareProviderActionSupport.safeId(zoneId), let zoneName = c.health.diagnostics["zoneName"]?.string, let ref = c.credentialRequirements.first(where: { $0.fieldKey == "cloudflare_oauth_access_token" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "cloudflare_connection_not_ready", message: "Cloudflare requires a ready exact-account and selected-zone OAuth connection.") }
        return (try secrets.getSecretValue(ref), accountId, zoneId, zoneName)
    }

    private func call(_ auth: (token: String, accountId: String, zoneId: String, zoneName: String), method: String, path: String, query: [URLQueryItem], body: JSONRecord?) throws -> JSONValue {
        var components = URLComponents(string: CloudflareProviderActionSupport.apiOrigin + path); components?.queryItems = query
        guard let url = components?.url else { throw MarketplaceProviderActionAdapterFailure(code: "cloudflare_invalid_url", message: "Could not build an allowlisted Cloudflare API URL.") }
        var request = URLRequest(url: url); request.httpMethod = method; request.timeoutInterval = 20; request.setValue("Bearer " + auth.token, forHTTPHeaderField: "Authorization"); request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let body { request.setValue("application/json", forHTTPHeaderField: "Content-Type"); request.httpBody = try JSONSerialization.data(withJSONObject: CloudflareProviderActionSupport.foundation(body)) }
        let semaphore = DispatchSemaphore(value: 0); var result: Result<(Data, Int, [AnyHashable: Any]), Error>!;
        URLSession.shared.dataTask(with: request) { d, r, e in
            result = e.map(Result.failure) ?? .success((d ?? Data(), (r as? HTTPURLResponse)?.statusCode ?? 0, (r as? HTTPURLResponse)?.allHeaderFields ?? [:])); semaphore.signal()
        }.resume()
        guard semaphore.wait(timeout: .now() + 20) == .success else { throw MarketplaceProviderActionAdapterFailure(code: "cloudflare_timeout", message: "Cloudflare API request timed out.") }
        let (bytes, status, headers) = try result.get()
        let retry = headers.first { String(describing: $0.key).lowercased() == "retry-after" }.flatMap { Double(String(describing: $0.value)) } ?? 0
        guard (200..<300).contains(status) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: status == 429 ? "cloudflare_rate_limited" : status == 401 ? "cloudflare_access_token_expired" : status == 403 ? "cloudflare_scope_denied" : status == 404 ? "cloudflare_not_found" : "cloudflare_api_error", message: "Cloudflare API request failed.", providerStatusCode: status,
                detail: ["retryAfterSeconds": .number(retry)])
        }
        var value = bytes.isEmpty ? JSONValue.object([:]) : CloudflareProviderActionSupport.json(try JSONSerialization.jsonObject(with: bytes)); if case .object(var o) = value { o["_relayRate"] = .object(["retryAfterSeconds": .number(retry)]); value = .object(o) }; return value
    }
    private func base(_ contract: String) -> JSONRecord {
        [
            "provider": .string("cloudflare"), "adapterBoundary": .string("cloudflare-provider-action-adapter"), "clientMode": .string("live-cloudflare-api"), "semanticReadContract": .string(contract), "rawProviderToolExposure": .bool(false),
            "redactionStatus": .string("logs-request-dimensions-excluded"),
        ]
    }
}

public struct CloudflareProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = ["cloudflare_zone_list", "cloudflare_zone_get", "cloudflare_zone_traffic_overview"]
    private let client: any CloudflareProviderActionClient
    public init(client: any CloudflareProviderActionClient = FakeCloudflareProviderActionClient()) { self.client = client }
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "cloudflare", Self.allowed.contains(request.definition.actionKey), request.permission == .allowed else { throw MarketplaceProviderActionAdapterFailure(code: "cloudflare_action_not_allowlisted", message: "Cloudflare V1 permits only three bounded read actions.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executeCloudflareAction(request: request).result, error: nil, redactionStatus: "logs-request-dimensions-excluded")
    }
}

public enum CloudflareProviderActionSupport {
    public static let apiOrigin = "https://api.cloudflare.com/client/v4"
    public static func safeId(_ value: String) -> Bool { value.count == 32 && value.allSatisfy { $0.isHexDigit } }
    static func bound(_ value: JSONValue?, maximum: Int, fallback: Int) -> Int { max(1, min(maximum, value?.number.map(Int.init) ?? value?.string.flatMap(Int.init) ?? fallback)) }
    static func scalar(_ value: JSONValue?) -> JSONValue { guard let value else { return .null }; switch value { case .string(let s): return .string(String(s.prefix(1200))); case .number, .bool, .null: return value; default: return .null } }
    static func zone(_ value: JSONValue) -> JSONRecord {
        let o = value.cfObject ?? [:], account = o["account"]?.cfObject ?? [:], meta = o["meta"]?.cfObject ?? [:];
        return [
            "id": scalar(o["id"]), "name": scalar(o["name"]), "status": scalar(o["status"]), "type": scalar(o["type"]), "account": .object(["id": scalar(account["id"]), "name": scalar(account["name"])]), "createdAt": scalar(o["created_on"]), "modifiedAt": scalar(o["modified_on"]),
            "activatedAt": scalar(o["activated_on"]), "developmentModeSeconds": scalar(o["development_mode"]), "nameServers": .array((o["name_servers"]?.cfArray ?? []).prefix(8).map(scalar)),
            "metadata": .object(["cdnOnly": scalar(meta["cdn_only"]), "dnsOnly": scalar(meta["dns_only"]), "foundationDNS": scalar(meta["foundation_dns"]), "phishingDetected": scalar(meta["phishing_detected"])]), "dnsRecordsReturned": .bool(false), "rawLogsReturned": .bool(false),
        ]
    }
    public static func fakeZone() -> JSONRecord {
        [
            "id": .string("023e105f4ecef8ad9ca31a8372d0c353"), "name": .string("example.com"), "status": .string("active"), "type": .string("full"), "account": .object(["id": .string("a23e105f4ecef8ad9ca31a8372d0c333"), "name": .string("Relay Test Workspace")]),
            "createdAt": .string("2026-01-01T00:00:00Z"), "modifiedAt": .string("2026-07-11T08:00:00Z"), "activatedAt": .string("2026-01-01T00:04:00Z"), "developmentModeSeconds": .number(0), "nameServers": .array([.string("ada.ns.cloudflare.com"), .string("bob.ns.cloudflare.com")]),
            "metadata": .object(["cdnOnly": .bool(false), "dnsOnly": .bool(false), "foundationDNS": .bool(false), "phishingDetected": .bool(false)]), "dnsRecordsReturned": .bool(false), "rawLogsReturned": .bool(false),
        ]
    }
    public static func fakeTraffic() -> JSONRecord {
        [
            "zoneId": .string("023e105f4ecef8ad9ca31a8372d0c353"), "zoneName": .string("example.com"), "windowStart": .string("2026-07-10T12:00:00Z"), "windowEnd": .string("2026-07-11T12:00:00Z"), "windowHours": .number(24), "requests": .number(42000), "edgeResponseBytes": .number(9000000),
            "visits": .number(8100), "groupCount": .number(12), "requestLevelDimensionsReturned": .bool(false), "rawLogsReturned": .bool(false),
        ]
    }
    static func foundation(_ record: JSONRecord) -> [String: Any] { record.mapValues(foundation) }
    static func foundation(_ value: JSONValue) -> Any { switch value { case .string(let v): return v; case .number(let v): return v; case .bool(let v): return v; case .array(let v): return v.map(foundation); case .object(let v): return foundation(v); case .null: return NSNull() } }
    static func json(_ value: Any) -> JSONValue {
        if let v = value as? String { return .string(v) }; if let v = value as? Bool { return .bool(v) }; if let v = value as? NSNumber { return .number(v.doubleValue) }; if let v = value as? [String: Any] { return .object(v.mapValues(json)) };
        if let v = value as? [Any] { return .array(v.map(json)) }; return .null
    }
}
private extension JSONValue { var cfObject: JSONRecord? { if case .object(let value) = self { return value }; return nil }; var cfArray: [JSONValue]? { if case .array(let value) = self { return value }; return nil } }
