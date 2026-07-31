import Foundation
public struct SingularProviderHTTPRequest: Sendable { public let url: URL; public let headers: [String: String] }; public struct SingularProviderHTTPResponse: Sendable { public let statusCode: Int; public let body: Data };
public protocol SingularProviderHTTPClient: Sendable { func send(_ request: SingularProviderHTTPRequest) throws -> SingularProviderHTTPResponse };
public struct URLSessionSingularProviderHTTPClient: SingularProviderHTTPClient {
    public init() {};
    public func send(_ request: SingularProviderHTTPRequest) throws -> SingularProviderHTTPResponse {
        var r = URLRequest(url: request.url); r.httpMethod = "GET"; r.timeoutInterval = 30; request.headers.forEach { r.setValue($0.value, forHTTPHeaderField: $0.key) }; let s = URLSession(configuration: .ephemeral), q = DispatchSemaphore(value: 0); var d = Data(), status = 0, e: Error?;
        let t = s.dataTask(with: r) {
            d = $0 ?? Data(); status = ($1 as? HTTPURLResponse)?.statusCode ?? 0; e = $2; q.signal()
        }; t.resume(); if q.wait(timeout: .now() + 30) == .timedOut { t.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "singular_timeout", message: "Singular timed out.") }; s.invalidateAndCancel(); if let e { throw e }; return SingularProviderHTTPResponse(statusCode: status, body: d)
    }
}; public protocol SingularProviderActionClient: Sendable { func executeSingularAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord };
public struct FakeSingularProviderActionClient: SingularProviderActionClient {
    public init() {}; public func executeSingularAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord { ["provider": .string("singular"), "action": .string(request.definition.actionKey), "liveCredentialsUsed": .bool(false)] }
};
public final class LiveSingularProviderActionClient: SingularProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService; private let secrets: SecretService; private let http: any SingularProviderHTTPClient;
    public init(data: LocalDataService, secrets: SecretService, httpClient: any SingularProviderHTTPClient = URLSessionSingularProviderHTTPClient()) { self.data = data; self.secrets = secrets; self.http = httpClient };
    public func executeSingularAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        guard request.definition.actionKey == "singular_app_site_reference_list", let id = request.auditIdentity.connectionId, let c = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), c.appSlug == "singular",
            let ref = c.credentialRequirements.first(where: { $0.fieldKey == "singular_api_key" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "singular_not_ready", message: "Singular connection is not ready.") }; let key = try secrets.getSecretValue(ref);
        guard !key.isEmpty, !key.contains("\n"), !key.contains("\r") else { throw MarketplaceProviderActionAdapterFailure(code: "singular_key_invalid", message: "Singular API key is invalid.") };
        let r = try http.send(SingularProviderHTTPRequest(url: URL(string: "https://api.singular.net/api/v1/singular_links/apps")!, headers: ["Authorization": key, "Accept": "application/json", "User-Agent": "RelayConsole-Singular/1.0"]));
        guard r.body.count <= 1_000_000, (200..<300).contains(r.statusCode), let root = (try? JSONSerialization.jsonObject(with: r.body)) as? [String: Any] else {
            throw MarketplaceProviderActionAdapterFailure(code: r.statusCode == 429 ? "singular_rate_limited" : "singular_api_error", message: "Singular request failed.", providerStatusCode: r.statusCode)
        }; let all = root["available_apps"] as? [Any] ?? [];
        func parseId(_ value: Any?) -> String? { if let n = value as? NSNumber, n.intValue >= 0 { return String(n.intValue) }; if let s = value as? String, s.range(of: #"^[A-Za-z0-9._:-]{1,100}$"#, options: .regularExpression) != nil { return s }; return nil };
        let values = all.prefix(25).compactMap { v -> JSONValue? in
            guard let row = v as? [String: Any], let app = parseId(row["app_id"]), let site = parseId(row["app_site_id"]), let platform = (row["app_platform"] as? String)?.lowercased(), platform.range(of: #"^[a-z0-9_-]{1,50}$"#, options: .regularExpression) != nil else { return nil };
            return .object(["appId": .string(app), "appSiteId": .string(site), "platform": .string(platform)])
        }; return ["appSites": .array(Array(values)), "totalItems": .number(Double(all.count)), "truncated": .bool(all.count > 25), "redactionStatus": .string("names-store-urls-public-bundle-ids-links-partners-attribution-and-report-data-excluded")]
    }
};
public struct SingularProviderActionAdapter: MarketplaceProviderActionAdapter {
    private let client: any SingularProviderActionClient; public init(client: any SingularProviderActionClient = FakeSingularProviderActionClient()) { self.client = client };
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "singular" else { throw MarketplaceProviderActionAdapterFailure(code: "singular_not_allowlisted", message: "Singular action is not allowlisted.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executeSingularAction(request: request), error: nil, redactionStatus: "names-store-urls-public-bundle-ids-links-partners-attribution-and-report-data-excluded")
    }
}
