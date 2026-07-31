import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

public struct GoogleMerchantCenterProviderActionClientResult: Sendable { public var result: JSONRecord; public init(result: JSONRecord) { self.result = result } }
public protocol GoogleMerchantCenterProviderActionClient: Sendable { func executeGoogleMerchantCenterAction(request: MarketplaceProviderActionAdapterRequest) throws -> GoogleMerchantCenterProviderActionClientResult }

public struct FakeGoogleMerchantCenterProviderActionClient: GoogleMerchantCenterProviderActionClient {
  public init() {}
  public func executeGoogleMerchantCenterAction(request: MarketplaceProviderActionAdapterRequest) throws -> GoogleMerchantCenterProviderActionClientResult {
    let account = try GoogleMerchantCenterProviderActionSupport.accountName(request.payload["accountName"], required: request.definition.actionKey != "google_merchant_center_accounts_list")
    let fields: JSONRecord
    switch request.definition.actionKey {
    case "google_merchant_center_accounts_list": fields = ["accounts": .array([.object(GoogleMerchantCenterProviderActionSupport.fakeAccount())]), "resultCount": .number(1)]
    case "google_merchant_center_products_list": fields = ["accountName": .string(account!), "products": .array([.object(GoogleMerchantCenterProviderActionSupport.fakeProduct(account: account!))]), "resultCount": .number(1)]
    case "google_merchant_center_product_get": _ = try GoogleMerchantCenterProviderActionSupport.productName(request.payload["productName"], account: account!); fields = ["accountName": .string(account!), "product": .object(GoogleMerchantCenterProviderActionSupport.fakeProduct(account: account!))]
    case "google_merchant_center_product_issues_summary": fields = ["accountName": .string(account!), "rows": .array([.object(GoogleMerchantCenterProviderActionSupport.fakeIssueRow())]), "resultCount": .number(1), "queryMode": .string("fixed_product_issues_v1")]
    default: throw MarketplaceProviderActionAdapterFailure(code: "google_merchant_center_action_not_supported", message: "Unsupported Merchant Center action.")
    }
    return GoogleMerchantCenterProviderActionClientResult(result: GoogleMerchantCenterProviderActionSupport.base("fake-merchant-api").merging(fields) { _, new in new })
  }
}

public final class LiveGoogleMerchantCenterProviderActionClient: GoogleMerchantCenterProviderActionClient, @unchecked Sendable {
  private struct Authorization { var token: String; var account: String }
  private let data: LocalDataService; private let secrets: SecretService
  public init(data: LocalDataService, secrets: SecretService) { self.data = data; self.secrets = secrets }
  public func executeGoogleMerchantCenterAction(request: MarketplaceProviderActionAdapterRequest) throws -> GoogleMerchantCenterProviderActionClientResult {
    let required = request.definition.actionKey != "google_merchant_center_accounts_list", payloadAccount = try GoogleMerchantCenterProviderActionSupport.accountName(request.payload["accountName"], required: required), authorization = try authorization(request, payloadAccount: payloadAccount)
    let root: JSONValue, fields: JSONRecord
    switch request.definition.actionKey {
        case "google_merchant_center_accounts_list":
            root = try send(authorization, method: "GET", path: "/accounts/v1/accounts?pageSize=50", body: nil); let values = GoogleMerchantCenterProviderActionSupport.records(root, key: "accounts").map(GoogleMerchantCenterProviderActionSupport.account);
            fields = ["accounts": .array(values.map(JSONValue.object)), "resultCount": .number(Double(values.count)), "nextPageFollowed": .bool(false)]
        case "google_merchant_center_products_list":
            root = try send(authorization, method: "GET", path: "/products/v1/\(authorization.account)/products?pageSize=50", body: nil); let values = GoogleMerchantCenterProviderActionSupport.records(root, key: "products").map(GoogleMerchantCenterProviderActionSupport.product);
            fields = ["accountName": .string(authorization.account), "products": .array(values.map(JSONValue.object)), "resultCount": .number(Double(values.count)), "nextPageFollowed": .bool(false)]
        case "google_merchant_center_product_get":
            let product = try GoogleMerchantCenterProviderActionSupport.productName(request.payload["productName"], account: authorization.account); root = try send(authorization, method: "GET", path: "/products/v1/\(product)", body: nil);
            fields = ["accountName": .string(authorization.account), "product": .object(GoogleMerchantCenterProviderActionSupport.product(root))]
        case "google_merchant_center_product_issues_summary":
            root = try send(authorization, method: "POST", path: "/reports/v1/\(authorization.account)/reports:search", body: GoogleMerchantCenterProviderActionSupport.fixedReportBody);
            let values = GoogleMerchantCenterProviderActionSupport.records(root, key: "results").map(GoogleMerchantCenterProviderActionSupport.issueRow);
            fields = ["accountName": .string(authorization.account), "rows": .array(values.map(JSONValue.object)), "resultCount": .number(Double(values.count)), "queryMode": .string("fixed_product_issues_v1"), "nextPageFollowed": .bool(false)]
    default: throw MarketplaceProviderActionAdapterFailure(code: "google_merchant_center_live_action_not_supported", message: "Unsupported live Merchant Center action.")
    }
    return GoogleMerchantCenterProviderActionClientResult(result: GoogleMerchantCenterProviderActionSupport.base("live-merchant-api").merging(fields) { _, new in new })
  }
  private func authorization(_ request: MarketplaceProviderActionAdapterRequest, payloadAccount: String?) throws -> Authorization {
        guard let id = request.auditIdentity.connectionId, let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), connection.appSlug == "google-merchant-center", connection.appId == request.app.id, connection.status == .connected,
            connection.health.state == .ready, connection.grantedScopes == ProviderConnectionService.googleMerchantCenterRelayOwnedOAuthScopes, let account = connection.health.diagnostics["selectedAccountName"]?.string, payloadAccount == nil || payloadAccount == account,
            connection.health.diagnostics["apiVersion"]?.string == "v1", connection.health.diagnostics["readOnlyV1"]?.bool == true, connection.health.diagnostics["writesEnabled"]?.bool == false, connection.health.diagnostics["fixedReportsOnly"]?.bool == true,
            connection.health.diagnostics["automaticPagination"]?.bool == false, connection.health.diagnostics["serviceAccountEnabled"]?.bool == false, connection.health.diagnostics["v1BetaEnabled"]?.bool == false, connection.health.diagnostics["contentAPIEnabled"]?.bool == false,
            connection.health.diagnostics["rawToolsEnabled"]?.bool == false, let ref = connection.credentialRequirements.first(where: { $0.fieldKey == "google_merchant_center_oauth_access_token" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "google_merchant_center_connection_not_ready", message: "Merchant Center requires a ready exact-scope connection bound to the explicit account.") }
    return Authorization(token: try secrets.getSecretValue(ref), account: account)
  }
  private func send(_ authorization: Authorization, method: String, path: String, body: JSONRecord?) throws -> JSONValue {
        guard let url = URL(string: GoogleMerchantCenterProviderActionSupport.origin + path), url.scheme == "https", url.host == "merchantapi.googleapis.com", !url.path.contains("v1beta"), !url.path.contains("content/"), ["GET", "POST"].contains(method),
            url.absoluteString.contains(authorization.account) || url.path == "/accounts/v1/accounts"
        else { throw MarketplaceProviderActionAdapterFailure(code: "google_merchant_center_unsafe_url", message: "Unsafe Merchant API request.") }
    if method == "POST", body != GoogleMerchantCenterProviderActionSupport.fixedReportBody { throw MarketplaceProviderActionAdapterFailure(code: "google_merchant_center_query_not_allowlisted", message: "Only Relay's fixed product-issues report is allowed.") }
        var request = URLRequest(url: url, timeoutInterval: 30); request.httpMethod = method; request.setValue("Bearer \(authorization.token)", forHTTPHeaderField: "Authorization");
        if let body { request.httpBody = try JSONEncoder().encode(JSONValue.object(body)); request.setValue("application/json", forHTTPHeaderField: "Content-Type") }
    let semaphore = DispatchSemaphore(value: 0); var captured: Result<(Data, HTTPURLResponse), Error>?
        URLSession.shared.dataTask(with: request) { bytes, response, error in
            defer { semaphore.signal() }; if let error { captured = .failure(error); return };
            guard let bytes, let response = response as? HTTPURLResponse else { captured = .failure(MarketplaceProviderActionAdapterFailure(code: "google_merchant_center_transport_error", message: "Merchant API returned no HTTP response.")); return }; captured = .success((bytes, response))
        }.resume()
        guard semaphore.wait(timeout: .now() + 31) == .success, let captured else { throw MarketplaceProviderActionAdapterFailure(code: "google_merchant_center_timeout", message: "Merchant API request timed out.") }; let (bytes, response) = try captured.get();
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(code: response.statusCode == 429 ? "google_merchant_center_rate_limited" : "google_merchant_center_api_error", message: "Merchant API request failed.", providerStatusCode: response.statusCode)
        }; guard bytes.count <= 1_000_000 else { throw MarketplaceProviderActionAdapterFailure(code: "google_merchant_center_response_too_large", message: "Merchant API response exceeded 1 MB.") }; return try JSONDecoder().decode(JSONValue.self, from: bytes)
  }
}

public struct GoogleMerchantCenterProviderActionAdapter: MarketplaceProviderActionAdapter {
  private static let allowed: Set<String> = ["google_merchant_center_accounts_list", "google_merchant_center_products_list", "google_merchant_center_product_get", "google_merchant_center_product_issues_summary"]
  private let client: any GoogleMerchantCenterProviderActionClient
  public init(client: any GoogleMerchantCenterProviderActionClient = FakeGoogleMerchantCenterProviderActionClient()) { self.client = client }
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "google-merchant-center", Self.allowed.contains(request.definition.actionKey), request.permission == .allowed else {
            throw MarketplaceProviderActionAdapterFailure(code: "google_merchant_center_action_not_allowlisted", message: "Merchant Center V1 permits only four bounded reads.")
        }; return MarketplaceProviderActionAdapterResult(result: try client.executeGoogleMerchantCenterAction(request: request).result, error: nil, redactionStatus: "mutations-admin-arbitrary-query-pagination-raw-service-account-legacy-excluded")
    }
}

public enum GoogleMerchantCenterProviderActionSupport {
  public static let origin = "https://merchantapi.googleapis.com"
  public static let fixedReportBody: JSONRecord = ["query": .string("SELECT product_view.id, product_view.title, product_view.aggregated_reporting_context_status, product_view.item_issues FROM product_view LIMIT 50"), "pageSize": .number(50)]
    static func base(_ mode: String) -> JSONRecord {
        [
            "provider": .string("google-merchant-center"), "adapterBoundary": .string("google-merchant-center-provider-action-adapter"), "clientMode": .string(mode), "stableV1Only": .bool(true), "readOnlyV1": .bool(true), "explicitAccountOnly": .bool(true), "fixedReportsOnly": .bool(true),
            "maxRows": .number(50), "writesEnabled": .bool(false), "automaticPagination": .bool(false), "rawProviderToolExposure": .bool(false),
        ]
    }
    public static func accountName(_ value: JSONValue?, required: Bool) throws -> String? {
        guard let text = value?.string else { if required { throw MarketplaceProviderActionAdapterFailure(code: "google_merchant_center_account_required", message: "An explicit accounts/{id} resource is required.") }; return nil };
        guard text.hasPrefix("accounts/"), !text.dropFirst(9).isEmpty, text.dropFirst(9).allSatisfy(\.isNumber) else { throw MarketplaceProviderActionAdapterFailure(code: "google_merchant_center_invalid_account", message: "Merchant account must use accounts/{numeric id}.") }; return text
    }
    public static func productName(_ value: JSONValue?, account: String) throws -> String {
        guard let text = value?.string, text.hasPrefix(account + "/products/"), text.count <= 512, !text.contains(".."), !text.contains("?") else {
            throw MarketplaceProviderActionAdapterFailure(code: "google_merchant_center_invalid_product", message: "An explicit product resource in the selected account is required.")
        }; return text
    }
  static func object(_ value: JSONValue?) -> JSONRecord { guard case .object(let record)? = value else { return [:] }; return record }
  static func array(_ value: JSONValue?) -> [JSONValue] { guard case .array(let values)? = value else { return [] }; return values }
  static func scalar(_ value: JSONValue?, maximum: Int = 512) -> JSONValue { guard let value else { return .null }; if case .string(let text) = value { return .string(String(text.prefix(maximum))) }; if case .number = value { return value }; if case .bool = value { return value }; return .null }
  static func records(_ root: JSONValue?, key: String) -> [JSONValue] { Array(array(object(root)[key]).prefix(50)) }
  static func account(_ value: JSONValue) -> JSONRecord { let r = object(value); return ["name": scalar(r["name"], maximum: 64), "accountName": scalar(r["accountName"], maximum: 256), "timeZone": scalar(r["timeZone"], maximum: 64), "languageCode": scalar(r["languageCode"], maximum: 16)] }
    static func product(_ value: JSONValue?) -> JSONRecord {
        let r = object(value), a = object(r["productAttributes"]), s = object(r["productStatus"]);
        return [
            "name": scalar(r["name"]), "offerId": scalar(r["offerId"], maximum: 128), "contentLanguage": scalar(r["contentLanguage"], maximum: 8), "feedLabel": scalar(r["feedLabel"], maximum: 20), "dataSource": scalar(r["dataSource"]), "title": scalar(a["title"]),
            "link": scalar(a["link"], maximum: 2048), "imageLink": scalar(a["imageLink"], maximum: 2048), "availability": scalar(a["availability"], maximum: 64), "price": scalar(a["price"], maximum: 128), "brand": scalar(a["brand"], maximum: 128), "gtin": scalar(a["gtin"], maximum: 128),
            "mpn": scalar(a["mpn"], maximum: 128), "destinationStatuses": .array(Array(array(s["destinationStatuses"]).prefix(20))), "itemLevelIssues": .array(Array(array(s["itemLevelIssues"]).prefix(20))), "customAttributesReturned": .bool(false),
        ]
    }
    static func issueRow(_ value: JSONValue) -> JSONRecord {
        let r = object(value), p = object(r["productView"]); return ["offerId": scalar(p["id"], maximum: 128), "title": scalar(p["title"]), "aggregatedStatus": scalar(p["aggregatedReportingContextStatus"], maximum: 64), "itemIssues": .array(Array(array(p["itemIssues"]).prefix(20)))]
    }
  public static func fakeAccount() -> JSONRecord { ["name": .string("accounts/123456789"), "accountName": .string("Example Merchant"), "timeZone": .string("Europe/London"), "languageCode": .string("en-GB")] }
    public static func fakeProduct(account: String) -> JSONRecord {
        [
            "name": .string(account + "/products/en~GB~sku-123"), "offerId": .string("sku-123"), "contentLanguage": .string("en"), "feedLabel": .string("GB"), "dataSource": .string(account + "/dataSources/42"), "title": .string("Example blue jacket"),
            "link": .string("https://example.com/products/blue-jacket"), "imageLink": .string("https://example.com/images/blue-jacket.jpg"), "availability": .string("in stock"), "price": .string("79.00 GBP"), "brand": .string("Example"), "gtin": .string("05012345678901"),
            "mpn": .string("JACKET-BLUE"), "destinationStatuses": .array([]), "itemLevelIssues": .array([]), "customAttributesReturned": .bool(false),
        ]
    }
    public static func fakeIssueRow() -> JSONRecord {
        [
            "offerId": .string("sku-123"), "title": .string("Example blue jacket"), "aggregatedStatus": .string("NOT_ELIGIBLE_OR_DISAPPROVED"),
            "itemIssues": .array([.object(["code": .string("missing_shipping"), "severity": .string("ERROR"), "resolution": .string("MERCHANT_ACTION"), "description": .string("Add shipping information"), "documentation": .string("https://support.google.com/merchants/")])]),
        ]
    }
}
