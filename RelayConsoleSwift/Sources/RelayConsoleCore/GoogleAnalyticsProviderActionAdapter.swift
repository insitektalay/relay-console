import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

public struct GoogleAnalyticsProviderActionClientResult: Sendable { public var result: JSONRecord; public init(result: JSONRecord) { self.result = result } }
public protocol GoogleAnalyticsProviderActionClient: Sendable { func executeGoogleAnalyticsAction(request: MarketplaceProviderActionAdapterRequest) throws -> GoogleAnalyticsProviderActionClientResult }

public struct FakeGoogleAnalyticsProviderActionClient: GoogleAnalyticsProviderActionClient {
  public init() {}
  public func executeGoogleAnalyticsAction(request: MarketplaceProviderActionAdapterRequest) throws -> GoogleAnalyticsProviderActionClientResult {
    _ = try GoogleAnalyticsProviderActionSupport.propertyID(request.payload["propertyId"])
    let fields: JSONRecord
    switch request.definition.actionKey {
    case "google_analytics_property_get": fields = ["semanticReadContract": .string("google-analytics-explicit-property-v1"), "property": .object(GoogleAnalyticsProviderActionSupport.fakeProperty())]
    case "google_analytics_overview_report": fields = ["semanticReadContract": .string("google-analytics-fixed-overview-report-v1"), "rows": .array([.object(GoogleAnalyticsProviderActionSupport.fakeRow())]), "resultCount": .number(1), "dateRange": .string("30daysAgo_to_yesterday")]
    default: throw MarketplaceProviderActionAdapterFailure(code: "google_analytics_action_not_supported", message: "Unsupported Google Analytics action.")
    }
    return GoogleAnalyticsProviderActionClientResult(result: GoogleAnalyticsProviderActionSupport.base("fake-analytics-api").merging(fields) { _, new in new })
  }
}

public final class LiveGoogleAnalyticsProviderActionClient: GoogleAnalyticsProviderActionClient, @unchecked Sendable {
  private struct Authorization { var token: String; var propertyID: String }
  private let data: LocalDataService; private let secrets: SecretService
  public init(data: LocalDataService, secrets: SecretService) { self.data = data; self.secrets = secrets }
  public func executeGoogleAnalyticsAction(request: MarketplaceProviderActionAdapterRequest) throws -> GoogleAnalyticsProviderActionClientResult {
    let property = try GoogleAnalyticsProviderActionSupport.propertyID(request.payload["propertyId"]), authorization = try authorization(request, property: property), root: JSONValue, fields: JSONRecord
    switch request.definition.actionKey {
    case "google_analytics_property_get":
      root = try send(authorization: authorization, origin: GoogleAnalyticsProviderActionSupport.adminOrigin, method: "GET", path: "/properties/\(property)", body: nil)
      fields = ["semanticReadContract": .string("google-analytics-explicit-property-v1"), "property": .object(GoogleAnalyticsProviderActionSupport.property(root))]
    case "google_analytics_overview_report":
      root = try send(authorization: authorization, origin: GoogleAnalyticsProviderActionSupport.dataOrigin, method: "POST", path: "/properties/\(property):runReport", body: GoogleAnalyticsProviderActionSupport.overviewBody)
            let rows = GoogleAnalyticsProviderActionSupport.rows(root);
            fields = ["semanticReadContract": .string("google-analytics-fixed-overview-report-v1"), "rows": .array(rows.map(JSONValue.object)), "resultCount": .number(Double(rows.count)), "dateRange": .string("30daysAgo_to_yesterday"), "nextOffsetFollowed": .bool(false)]
    default: throw MarketplaceProviderActionAdapterFailure(code: "google_analytics_live_action_not_supported", message: "Unsupported live Google Analytics action.")
    }
    return GoogleAnalyticsProviderActionClientResult(result: GoogleAnalyticsProviderActionSupport.base("live-analytics-api").merging(fields) { _, new in new })
  }
  private func authorization(_ request: MarketplaceProviderActionAdapterRequest, property: String) throws -> Authorization {
        guard let id = request.auditIdentity.connectionId, let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), connection.appSlug == "google-analytics", connection.appId == request.app.id, connection.status == .connected,
            connection.health.state == .ready, connection.grantedScopes == ProviderConnectionService.googleAnalyticsRelayOwnedOAuthScopes, connection.health.diagnostics["selectedPropertyId"]?.string == property, connection.health.diagnostics["explicitPropertyOnly"]?.bool == true,
            connection.health.diagnostics["propertyDiscoveryEnabled"]?.bool == false, connection.health.diagnostics["arbitraryReportsEnabled"]?.bool == false, connection.health.diagnostics["realtimeBatchPivotFunnelAccessEnabled"]?.bool == false,
            connection.health.diagnostics["audienceExportsEnabled"]?.bool == false, connection.health.diagnostics["userDemographicPageSearchGeoCustomDetailEnabled"]?.bool == false, connection.health.diagnostics["mutationsEnabled"]?.bool == false,
            connection.health.diagnostics["measurementProtocolEnabled"]?.bool == false, connection.health.diagnostics["automaticPagination"]?.bool == false, connection.health.diagnostics["serviceAccountEnabled"]?.bool == false, connection.health.diagnostics["domainDelegationEnabled"]?.bool == false,
            let ref = connection.credentialRequirements.first(where: { $0.fieldKey == "google_analytics_oauth_access_token" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "google_analytics_connection_not_ready", message: "Google Analytics requires a ready exact-scope connection bound to the explicit property.") }
    return Authorization(token: try secrets.getSecretValue(ref), propertyID: property)
  }
  private func send(authorization: Authorization, origin: String, method: String, path: String, body: JSONRecord?) throws -> JSONValue {
    guard path.contains("/properties/\(authorization.propertyID)") else { throw MarketplaceProviderActionAdapterFailure(code: "google_analytics_property_mismatch", message: "Analytics request must target the bound property.") }
        let url = URL(string: origin + path)!; let allowedAdmin = url.host == "analyticsadmin.googleapis.com" && url.path.hasPrefix("/v1beta/properties/") && method == "GET";
        let allowedData = url.host == "analyticsdata.googleapis.com" && url.path.hasPrefix("/v1beta/properties/") && url.path.hasSuffix(":runReport") && method == "POST"
    guard url.scheme == "https", allowedAdmin || allowedData else { throw MarketplaceProviderActionAdapterFailure(code: "google_analytics_unsafe_url", message: "Unsafe Google Analytics API URL.") }
    if allowedData, body != GoogleAnalyticsProviderActionSupport.overviewBody { throw MarketplaceProviderActionAdapterFailure(code: "google_analytics_report_not_allowlisted", message: "Only the fixed overview report is allowed.") }
        var request = URLRequest(url: url, timeoutInterval: 30); request.httpMethod = method; request.setValue("Bearer \(authorization.token)", forHTTPHeaderField: "Authorization");
        if let body { request.httpBody = try JSONEncoder().encode(JSONValue.object(body)); request.setValue("application/json", forHTTPHeaderField: "Content-Type") }
    let semaphore = DispatchSemaphore(value: 0); var captured: Result<(Data, HTTPURLResponse), Error>?
        URLSession.shared.dataTask(with: request) { bytes, response, error in
            defer { semaphore.signal() }; if let error { captured = .failure(error); return };
            guard let bytes, let response = response as? HTTPURLResponse else { captured = .failure(MarketplaceProviderActionAdapterFailure(code: "google_analytics_transport_error", message: "Google Analytics returned no HTTP response.")); return }; captured = .success((bytes, response))
        }.resume()
        guard semaphore.wait(timeout: .now() + 31) == .success, let captured else { throw MarketplaceProviderActionAdapterFailure(code: "google_analytics_timeout", message: "Google Analytics API request timed out.") }; let (bytes, response) = try captured.get();
        guard (200..<300).contains(response.statusCode) else { throw MarketplaceProviderActionAdapterFailure(code: response.statusCode == 429 ? "google_analytics_rate_limited" : "google_analytics_api_error", message: "Google Analytics API request failed.", providerStatusCode: response.statusCode) };
        guard bytes.count <= 1_000_000 else { throw MarketplaceProviderActionAdapterFailure(code: "google_analytics_response_too_large", message: "Google Analytics response exceeded the 1 MB V1 bound.") }; return try JSONDecoder().decode(JSONValue.self, from: bytes)
  }
}

public struct GoogleAnalyticsProviderActionAdapter: MarketplaceProviderActionAdapter {
  private static let allowed: Set<String> = ["google_analytics_property_get", "google_analytics_overview_report"]
  private let client: any GoogleAnalyticsProviderActionClient
  public init(client: any GoogleAnalyticsProviderActionClient = FakeGoogleAnalyticsProviderActionClient()) { self.client = client }
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "google-analytics", Self.allowed.contains(request.definition.actionKey) else { throw MarketplaceProviderActionAdapterFailure(code: "google_analytics_action_not_allowlisted", message: "Google Analytics action is not allowlisted.") };
        guard request.permission == .allowed else { throw MarketplaceProviderActionAdapterFailure(code: "google_analytics_permission_denied", message: "Google Analytics read is not permitted by policy.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executeGoogleAnalyticsAction(request: request).result, error: nil, redactionStatus: "users-demographics-interests-pages-search-geo-custom-audiences-realtime-mutations-raw-report-excluded")
    }
}

public enum GoogleAnalyticsProviderActionSupport {
  public static let adminOrigin = "https://analyticsadmin.googleapis.com/v1beta", dataOrigin = "https://analyticsdata.googleapis.com/v1beta"
    public static let overviewBody: JSONRecord = [
        "dateRanges": .array([.object(["startDate": .string("30daysAgo"), "endDate": .string("yesterday")])]), "dimensions": .array([.object(["name": .string("sessionDefaultChannelGroup")])]),
        "metrics": .array(["activeUsers", "sessions", "engagedSessions", "engagementRate", "eventCount", "keyEvents", "totalRevenue"].map { .object(["name": .string($0)]) }), "orderBys": .array([.object(["metric": .object(["metricName": .string("sessions")]), "desc": .bool(true)])]),
        "limit": .string("25"), "keepEmptyRows": .bool(false), "returnPropertyQuota": .bool(true),
    ]
    static func base(_ mode: String) -> JSONRecord {
        [
            "provider": .string("google-analytics"), "adapterBoundary": .string("google-analytics-provider-action-adapter"), "clientMode": .string(mode), "readOnlyV1": .bool(true), "explicitPropertyOnly": .bool(true), "propertyDiscoveryEnabled": .bool(false), "arbitraryReportsEnabled": .bool(false),
            "realtimeReportsEnabled": .bool(false), "audienceExportsEnabled": .bool(false), "userLevelDetailReturned": .bool(false), "mutationsEnabled": .bool(false), "automaticPagination": .bool(false), "rawProviderToolExposure": .bool(false),
        ]
    }
  static func object(_ value: JSONValue?) -> JSONRecord { guard case .object(let value)? = value else { return [:] }; return value }
  static func array(_ value: JSONValue?) -> [JSONValue] { guard case .array(let value)? = value else { return [] }; return value }
  static func scalar(_ value: JSONValue?, maximum: Int = 1024) -> JSONValue { guard let value else { return .null }; switch value { case .string(let text): return .string(String(text.prefix(maximum))); case .number, .bool, .null: return value; default: return .null } }
    public static func propertyID(_ value: JSONValue?) throws -> String {
        guard let value = value?.string, (1...32).contains(value.count), value.allSatisfy(\.isNumber) else { throw MarketplaceProviderActionAdapterFailure(code: "google_analytics_invalid_property_id", message: "An explicit numeric GA4 property ID is required.") }; return value
    }
    static func property(_ value: JSONValue?) -> JSONRecord {
        let record = object(value);
        return [
            "name": scalar(record["name"], maximum: 64), "displayName": scalar(record["displayName"], maximum: 256), "timeZone": scalar(record["timeZone"], maximum: 64), "currencyCode": scalar(record["currencyCode"], maximum: 3), "industryCategory": scalar(record["industryCategory"], maximum: 64),
            "propertyType": scalar(record["propertyType"], maximum: 64), "serviceLevel": scalar(record["serviceLevel"], maximum: 64), "accountResourceReturned": .bool(false), "dataStreamsReturned": .bool(false),
        ]
    }
    static func row(_ value: JSONValue?) -> JSONRecord {
        let record = object(value), dimensions = array(record["dimensionValues"]), metrics = array(record["metricValues"]);
        func item(_ values: [JSONValue], _ index: Int) -> JSONValue { guard values.indices.contains(index) else { return .null }; return scalar(object(values[index])["value"], maximum: 128) };
        return [
            "sessionDefaultChannelGroup": item(dimensions, 0), "activeUsers": item(metrics, 0), "sessions": item(metrics, 1), "engagedSessions": item(metrics, 2), "engagementRate": item(metrics, 3), "eventCount": item(metrics, 4), "keyEvents": item(metrics, 5), "totalRevenue": item(metrics, 6),
            "userIdentifiersReturned": .bool(false), "demographicsInterestsReturned": .bool(false), "pageSearchGeoCustomDetailReturned": .bool(false),
        ]
    }
  static func rows(_ root: JSONValue?) -> [JSONRecord] { array(object(root)["rows"]).prefix(25).map { row($0) } }
    public static func fakeProperty() -> JSONRecord {
        [
            "name": .string("properties/123456789"), "displayName": .string("Example GA4 property"), "timeZone": .string("Europe/London"), "currencyCode": .string("GBP"), "industryCategory": .string("TECHNOLOGY"), "propertyType": .string("PROPERTY_TYPE_ORDINARY"),
            "serviceLevel": .string("GOOGLE_ANALYTICS_STANDARD"), "accountResourceReturned": .bool(false), "dataStreamsReturned": .bool(false),
        ]
    }
    public static func fakeRow() -> JSONRecord {
        [
            "sessionDefaultChannelGroup": .string("Organic Search"), "activeUsers": .string("4200"), "sessions": .string("5300"), "engagedSessions": .string("4100"), "engagementRate": .string("0.7736"), "eventCount": .string("28000"), "keyEvents": .string("210"), "totalRevenue": .string("8140.25"),
            "userIdentifiersReturned": .bool(false), "demographicsInterestsReturned": .bool(false), "pageSearchGeoCustomDetailReturned": .bool(false),
        ]
    }
}
