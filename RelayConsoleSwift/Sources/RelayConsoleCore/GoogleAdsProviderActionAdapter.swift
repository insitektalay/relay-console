import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

public struct GoogleAdsProviderActionClientResult: Sendable { public var result: JSONRecord; public init(result: JSONRecord) { self.result = result } }
public protocol GoogleAdsProviderActionClient: Sendable { func executeGoogleAdsAction(request: MarketplaceProviderActionAdapterRequest) throws -> GoogleAdsProviderActionClientResult }

public struct FakeGoogleAdsProviderActionClient: GoogleAdsProviderActionClient {
  public init() {}
  public func executeGoogleAdsAction(request: MarketplaceProviderActionAdapterRequest) throws -> GoogleAdsProviderActionClientResult {
    _ = try GoogleAdsProviderActionSupport.customerID(request.payload["customerId"])
    let fields: JSONRecord
    switch request.definition.actionKey {
    case "google_ads_customer_summary_get": fields = ["semanticReadContract": .string("google-ads-explicit-customer-summary-v1"), "customer": .object(GoogleAdsProviderActionSupport.fakeCustomer())]
    case "google_ads_campaign_performance_report": fields = ["semanticReadContract": .string("google-ads-bounded-campaign-performance-v1"), "campaigns": .array([.object(GoogleAdsProviderActionSupport.fakeCampaign())]), "resultCount": .number(1)]
    default: throw MarketplaceProviderActionAdapterFailure(code: "google_ads_action_not_supported", message: "Unsupported Google Ads action.")
    }
    return GoogleAdsProviderActionClientResult(result: GoogleAdsProviderActionSupport.base("fake-google-ads-api-v24").merging(fields) { _, new in new })
  }
}

public final class LiveGoogleAdsProviderActionClient: GoogleAdsProviderActionClient, @unchecked Sendable {
  private struct Authorization { var accessToken: String; var developerToken: String; var customerID: String; var loginCustomerID: String? }
  private let data: LocalDataService; private let secrets: SecretService
  public init(data: LocalDataService, secrets: SecretService) { self.data = data; self.secrets = secrets }
  public func executeGoogleAdsAction(request: MarketplaceProviderActionAdapterRequest) throws -> GoogleAdsProviderActionClientResult {
    let requestedCustomer = try GoogleAdsProviderActionSupport.customerID(request.payload["customerId"]), authorization = try authorization(request, requestedCustomer: requestedCustomer)
    let query: String; let contract: String
    switch request.definition.actionKey {
    case "google_ads_customer_summary_get": query = GoogleAdsProviderActionSupport.customerSummaryQuery; contract = "google-ads-explicit-customer-summary-v1"
    case "google_ads_campaign_performance_report": query = GoogleAdsProviderActionSupport.campaignPerformanceQuery; contract = "google-ads-bounded-campaign-performance-v1"
    default: throw MarketplaceProviderActionAdapterFailure(code: "google_ads_live_action_not_supported", message: "Unsupported live Google Ads action.")
    }
    let root = try send(authorization: authorization, query: query), fields: JSONRecord
    if request.definition.actionKey == "google_ads_customer_summary_get" { fields = ["semanticReadContract": .string(contract), "customer": .object(GoogleAdsProviderActionSupport.customer(root))] }
        else {
            let campaigns = GoogleAdsProviderActionSupport.campaigns(root);
            fields = ["semanticReadContract": .string(contract), "campaigns": .array(campaigns.map(JSONValue.object)), "resultCount": .number(Double(campaigns.count)), "dateRange": .string("LAST_30_DAYS"), "nextPageTokenFollowed": .bool(false)]
        }
    return GoogleAdsProviderActionClientResult(result: GoogleAdsProviderActionSupport.base("live-google-ads-api-v24").merging(fields) { _, new in new })
  }
  private func authorization(_ request: MarketplaceProviderActionAdapterRequest, requestedCustomer: String) throws -> Authorization {
        guard let id = request.auditIdentity.connectionId, let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), connection.appSlug == "google-ads", connection.appId == request.app.id, connection.status == .connected,
            connection.health.state == .ready, connection.grantedScopes == ProviderConnectionService.googleAdsRelayOwnedOAuthScopes, connection.health.diagnostics["customerId"]?.string == requestedCustomer, connection.health.diagnostics["permissibleUse"]?.string == "reporting",
            connection.health.diagnostics["explicitCustomerOnly"]?.bool == true, connection.health.diagnostics["arbitraryGAQLEnabled"]?.bool == false, connection.health.diagnostics["searchStreamEnabled"]?.bool == false, connection.health.diagnostics["accountDiscoveryEnabled"]?.bool == false,
            connection.health.diagnostics["mutationsEnabled"]?.bool == false, connection.health.diagnostics["planningRecommendationsEnabled"]?.bool == false, connection.health.diagnostics["audiencesCustomerMatchEnabled"]?.bool == false,
            connection.health.diagnostics["searchTermsClickDataEnabled"]?.bool == false, connection.health.diagnostics["offlineConversionsEnabled"]?.bool == false, connection.health.diagnostics["billingAccessEnabled"]?.bool == false,
            connection.health.diagnostics["automaticPagination"]?.bool == false, connection.health.diagnostics["serviceAccountEnabled"]?.bool == false, connection.health.diagnostics["domainDelegationEnabled"]?.bool == false,
            let accessRef = connection.credentialRequirements.first(where: { $0.fieldKey == "google_ads_oauth_access_token" })?.secretReferenceId, let developerRef = connection.credentialRequirements.first(where: { $0.fieldKey == "google_ads_developer_token" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "google_ads_connection_not_ready", message: "Google Ads requires a ready reporting-only connection for the explicit customer.") }
    return Authorization(accessToken: try secrets.getSecretValue(accessRef), developerToken: try secrets.getSecretValue(developerRef), customerID: requestedCustomer, loginCustomerID: connection.health.diagnostics["loginCustomerId"]?.string)
  }
  private func send(authorization: Authorization, query: String) throws -> JSONValue {
    guard query == GoogleAdsProviderActionSupport.customerSummaryQuery || query == GoogleAdsProviderActionSupport.campaignPerformanceQuery else { throw MarketplaceProviderActionAdapterFailure(code: "google_ads_query_not_allowlisted", message: "Only fixed reporting queries are allowed.") }
    let url = URL(string: "\(GoogleAdsProviderActionSupport.apiOrigin)/customers/\(authorization.customerID)/googleAds:search")!
    guard url.scheme == "https", url.host == "googleads.googleapis.com", url.path.hasPrefix("/v24/customers/"), url.path.hasSuffix("/googleAds:search") else { throw MarketplaceProviderActionAdapterFailure(code: "google_ads_unsafe_url", message: "Unsafe Google Ads API URL.") }
        var request = URLRequest(url: url, timeoutInterval: 30); request.httpMethod = "POST"; request.setValue("Bearer \(authorization.accessToken)", forHTTPHeaderField: "Authorization"); request.setValue(authorization.developerToken, forHTTPHeaderField: "developer-token");
        if let login = authorization.loginCustomerID { request.setValue(login, forHTTPHeaderField: "login-customer-id") }; request.setValue("application/json", forHTTPHeaderField: "Content-Type"); request.httpBody = try JSONEncoder().encode(JSONValue.object(["query": .string(query)]))
    let semaphore = DispatchSemaphore(value: 0); var captured: Result<(Data, HTTPURLResponse), Error>?
        URLSession.shared.dataTask(with: request) { bytes, response, error in
            defer { semaphore.signal() }; if let error { captured = .failure(error); return };
            guard let bytes, let response = response as? HTTPURLResponse else { captured = .failure(MarketplaceProviderActionAdapterFailure(code: "google_ads_transport_error", message: "Google Ads returned no HTTP response.")); return }; captured = .success((bytes, response))
        }.resume()
        guard semaphore.wait(timeout: .now() + 31) == .success, let captured else { throw MarketplaceProviderActionAdapterFailure(code: "google_ads_timeout", message: "Google Ads API request timed out.") }; let (bytes, response) = try captured.get();
        guard (200..<300).contains(response.statusCode) else { throw MarketplaceProviderActionAdapterFailure(code: response.statusCode == 429 ? "google_ads_rate_limited" : "google_ads_api_error", message: "Google Ads API request failed.", providerStatusCode: response.statusCode) };
        guard bytes.count <= 1_000_000 else { throw MarketplaceProviderActionAdapterFailure(code: "google_ads_response_too_large", message: "Google Ads response exceeded the 1 MB V1 bound.") }; return try JSONDecoder().decode(JSONValue.self, from: bytes)
  }
}

public struct GoogleAdsProviderActionAdapter: MarketplaceProviderActionAdapter {
  private static let allowed: Set<String> = ["google_ads_customer_summary_get", "google_ads_campaign_performance_report"]
  private let client: any GoogleAdsProviderActionClient
  public init(client: any GoogleAdsProviderActionClient = FakeGoogleAdsProviderActionClient()) { self.client = client }
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "google-ads", Self.allowed.contains(request.definition.actionKey) else { throw MarketplaceProviderActionAdapterFailure(code: "google_ads_action_not_allowlisted", message: "Google Ads action is not allowlisted.") };
        guard request.permission == .allowed else { throw MarketplaceProviderActionAdapterFailure(code: "google_ads_permission_denied", message: "Google Ads reporting action is not permitted by policy.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executeGoogleAdsAction(request: request).result, error: nil, redactionStatus: "users-audiences-search-terms-click-identifiers-offline-conversions-billing-mutations-raw-query-excluded")
    }
}

public enum GoogleAdsProviderActionSupport {
  public static let apiOrigin = "https://googleads.googleapis.com/v24"
  public static let customerSummaryQuery = "SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.time_zone, customer.test_account, customer.manager, customer.auto_tagging_enabled FROM customer LIMIT 1"
    public static let campaignPerformanceQuery =
        """
            SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value FROM campaign WHERE \
            segments.date DURING LAST_30_DAYS AND campaign.status != 'REMOVED' ORDER BY metrics.cost_micros DESC LIMIT 50
            """
    static func base(_ mode: String) -> JSONRecord {
        [
            "provider": .string("google-ads"), "adapterBoundary": .string("google-ads-provider-action-adapter"), "clientMode": .string(mode), "reportingOnly": .bool(true), "explicitCustomerOnly": .bool(true), "arbitraryGAQLEnabled": .bool(false), "searchStreamEnabled": .bool(false),
            "accountDiscoveryEnabled": .bool(false), "mutationsEnabled": .bool(false), "audiencesReturned": .bool(false), "searchTermsReturned": .bool(false), "clickIdentifiersReturned": .bool(false), "billingReturned": .bool(false), "automaticPagination": .bool(false),
            "rawProviderToolExposure": .bool(false),
        ]
    }
  static func object(_ value: JSONValue?) -> JSONRecord { guard case .object(let value)? = value else { return [:] }; return value }
  static func scalar(_ value: JSONValue?, maximum: Int = 1024) -> JSONValue { guard let value else { return .null }; switch value { case .string(let text): return .string(String(text.prefix(maximum))); case .number, .bool, .null: return value; default: return .null } }
    public static func customerID(_ value: JSONValue?) throws -> String {
        guard let value = value?.string, value.count == 10, value.allSatisfy(\.isNumber) else { throw MarketplaceProviderActionAdapterFailure(code: "google_ads_invalid_customer_id", message: "An explicit ten-digit Google Ads customer ID without hyphens is required.") }; return value
    }
  static func firstResult(_ root: JSONValue?) -> JSONRecord { let record = object(root); guard case .array(let results)? = record["results"], let first = results.first else { return [:] }; return object(first) }
    static func customer(_ root: JSONValue?) -> JSONRecord {
        let customer = object(firstResult(root)["customer"]);
        return [
            "id": scalar(customer["id"], maximum: 10), "descriptiveName": scalar(customer["descriptiveName"], maximum: 256), "currencyCode": scalar(customer["currencyCode"], maximum: 3), "timeZone": scalar(customer["timeZone"], maximum: 64),
            "testAccount": scalar(customer["testAccount"], maximum: 8), "manager": scalar(customer["manager"], maximum: 8), "autoTaggingEnabled": scalar(customer["autoTaggingEnabled"], maximum: 8), "accountUsersReturned": .bool(false), "hierarchyReturned": .bool(false),
        ]
    }
    static func campaign(_ value: JSONValue?) -> JSONRecord {
        let row = object(value), campaign = object(row["campaign"]), metrics = object(row["metrics"]);
        return [
            "id": scalar(campaign["id"], maximum: 32), "name": scalar(campaign["name"], maximum: 256), "status": scalar(campaign["status"], maximum: 32), "advertisingChannelType": scalar(campaign["advertisingChannelType"], maximum: 64), "impressions": scalar(metrics["impressions"], maximum: 32),
            "clicks": scalar(metrics["clicks"], maximum: 32), "costMicros": scalar(metrics["costMicros"], maximum: 32), "conversions": scalar(metrics["conversions"], maximum: 32), "conversionValue": scalar(metrics["conversionsValue"], maximum: 32), "searchTermsReturned": .bool(false),
            "clickIdentifiersReturned": .bool(false), "audiencesReturned": .bool(false),
        ]
    }
  static func campaigns(_ root: JSONValue?) -> [JSONRecord] { let record = object(root); guard case .array(let results)? = record["results"] else { return [] }; return results.prefix(50).map { campaign($0) } }
    public static func fakeCustomer() -> JSONRecord {
        [
            "id": .string("1234567890"), "descriptiveName": .string("Example advertiser"), "currencyCode": .string("GBP"), "timeZone": .string("Europe/London"), "testAccount": .bool(false), "manager": .bool(false), "autoTaggingEnabled": .bool(true), "accountUsersReturned": .bool(false),
            "hierarchyReturned": .bool(false),
        ]
    }
    public static func fakeCampaign() -> JSONRecord {
        [
            "id": .string("987654321"), "name": .string("Brand search"), "status": .string("ENABLED"), "advertisingChannelType": .string("SEARCH"), "impressions": .string("12500"), "clicks": .string("640"), "costMicros": .string("182500000"), "conversions": .string("48.5"),
            "conversionValue": .string("8120.00"), "searchTermsReturned": .bool(false), "clickIdentifiersReturned": .bool(false), "audiencesReturned": .bool(false),
        ]
    }
}
