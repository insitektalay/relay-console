import Foundation
public struct AppsFlyerProviderHTTPRequest: Sendable { public let url: URL; public let headers: [String: String] }; public struct AppsFlyerProviderHTTPResponse: Sendable { public let statusCode: Int; public let body: Data };
public protocol AppsFlyerProviderHTTPClient: Sendable { func send(_ request: AppsFlyerProviderHTTPRequest) throws -> AppsFlyerProviderHTTPResponse };
public struct URLSessionAppsFlyerProviderHTTPClient: AppsFlyerProviderHTTPClient {
    public init() {};
    public func send(_ request: AppsFlyerProviderHTTPRequest) throws -> AppsFlyerProviderHTTPResponse {
        var r = URLRequest(url: request.url); r.httpMethod = "GET"; r.timeoutInterval = 30; request.headers.forEach { r.setValue($0.value, forHTTPHeaderField: $0.key) }; let s = URLSession(configuration: .ephemeral), q = DispatchSemaphore(value: 0); var d = Data(), status = 0, e: Error?;
        let t = s.dataTask(with: r) {
            d = $0 ?? Data(); status = ($1 as? HTTPURLResponse)?.statusCode ?? 0; e = $2; q.signal()
        }; t.resume(); if q.wait(timeout: .now() + 30) == .timedOut { t.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "appsflyer_timeout", message: "AppsFlyer timed out.") }; s.invalidateAndCancel(); if let e { throw e };
        return AppsFlyerProviderHTTPResponse(statusCode: status, body: d)
    }
}; public protocol AppsFlyerProviderActionClient: Sendable { func executeAppsFlyerAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord };
public struct FakeAppsFlyerProviderActionClient: AppsFlyerProviderActionClient {
    public init() {}; public func executeAppsFlyerAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord { ["provider": .string("appsflyer"), "action": .string(request.definition.actionKey), "liveCredentialsUsed": .bool(false)] }
};
public final class LiveAppsFlyerProviderActionClient: AppsFlyerProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService; private let secrets: SecretService; private let http: any AppsFlyerProviderHTTPClient;
    public init(data: LocalDataService, secrets: SecretService, httpClient: any AppsFlyerProviderHTTPClient = URLSessionAppsFlyerProviderHTTPClient()) { self.data = data; self.secrets = secrets; self.http = httpClient };
    public func executeAppsFlyerAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        let audienceAction = request.definition.actionKey == "appsflyer_audience_connection_summary_get";
        guard audienceAction || request.definition.actionKey == "appsflyer_app_reference_list", let id = request.auditIdentity.connectionId, let c = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), c.appSlug == "appsflyer",
            let ref = c.credentialRequirements.first?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "appsflyer_not_ready", message: "AppsFlyer connection is not ready.") }; let token = try secrets.getSecretValue(ref);
        guard !token.isEmpty, !token.contains("\n"), !token.contains("\r") else { throw MarketplaceProviderActionAdapterFailure(code: "appsflyer_token_invalid", message: "AppsFlyer token is invalid.") };
        let url = audienceAction ? "https://hq1.appsflyer.com/api/audiences-external-api/connections" : "https://hq1.appsflyer.com/api/mng/apps?limit=25&offset=0",
            r = try http.send(AppsFlyerProviderHTTPRequest(url: URL(string: url)!, headers: ["Authorization": "Bearer " + token, "Accept": "application/json", "User-Agent": "RelayConsole-AppsFlyer/1.0"]))
        ;
        guard r.body.count <= 1_000_000, (200..<300).contains(r.statusCode), let any = try? JSONSerialization.jsonObject(with: r.body) else {
            throw MarketplaceProviderActionAdapterFailure(code: r.statusCode == 429 ? "appsflyer_rate_limited" : "appsflyer_api_error", message: "AppsFlyer request failed.", providerStatusCode: r.statusCode)
        }; let root = any as? [String: Any] ?? [:];
        if audienceAction {
            guard let all = (any as? [Any]) ?? (root["connections"] as? [Any]) ?? (root["data"] as? [Any]) ?? (root["results"] as? [Any]) else { throw MarketplaceProviderActionAdapterFailure(code: "appsflyer_response_invalid", message: "AppsFlyer Audiences returned an unexpected response.") };
            let count = min(all.count, 115); return ["configured": .bool(count > 0), "connectionCount": .number(Double(count)), "truncated": .bool(all.count > 115), "redactionStatus": .string("audience-partner-names-ids-credentials-members-splits-and-upload-data-excluded")]
        } else {
            let
                values = (root["data"] as? [Any] ?? []).prefix(25).map { v -> JSONValue in
                    let raw = (v as? String) ?? (v as? [String: Any])?["app_id"] as? String ?? (v as? [String: Any])?["appId"] as? String ?? ""; return raw.range(of: #"^[A-Za-z0-9._:-]{1,300}$"#, options: .regularExpression) != nil ? .string(raw) : .null
                }, meta = root["meta"] as? [String: Any], links = root["links"] as? [String: Any]
            ;
            return [
                "apps": .array(Array(values)), "totalItems": (meta?["total_items"] as? NSNumber).map { .number($0.doubleValue) } ?? .null, "nextPageAvailable": .bool((links?["next"] as? String)?.isEmpty == false),
                "redactionStatus": .string("names-account-identity-attribution-content-and-pagination-urls-excluded"),
            ]
        }
    }
};
public struct AppsFlyerProviderActionAdapter: MarketplaceProviderActionAdapter {
    private let client: any AppsFlyerProviderActionClient; public init(client: any AppsFlyerProviderActionClient = FakeAppsFlyerProviderActionClient()) { self.client = client };
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "appsflyer" else { throw MarketplaceProviderActionAdapterFailure(code: "appsflyer_not_allowlisted", message: "AppsFlyer action is not allowlisted.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executeAppsFlyerAction(request: request), error: nil, redactionStatus: "names-account-identity-audience-partner-member-attribution-content-and-pagination-urls-excluded")
    }
}
