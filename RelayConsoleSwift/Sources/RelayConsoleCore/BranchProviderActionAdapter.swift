import Foundation
public struct BranchProviderHTTPRequest: Sendable { public let url: URL; public let headers: [String: String] }; public struct BranchProviderHTTPResponse: Sendable { public let statusCode: Int; public let body: Data };
public protocol BranchProviderHTTPClient: Sendable { func send(_ request: BranchProviderHTTPRequest) throws -> BranchProviderHTTPResponse };
public struct URLSessionBranchProviderHTTPClient: BranchProviderHTTPClient {
    public init() {};
    public func send(_ request: BranchProviderHTTPRequest) throws -> BranchProviderHTTPResponse {
        var r = URLRequest(url: request.url); r.httpMethod = "GET"; r.timeoutInterval = 30; request.headers.forEach { r.setValue($0.value, forHTTPHeaderField: $0.key) }; let s = URLSession(configuration: .ephemeral), q = DispatchSemaphore(value: 0); var d = Data(), status = 0, e: Error?;
        let t = s.dataTask(with: r) {
            d = $0 ?? Data(); status = ($1 as? HTTPURLResponse)?.statusCode ?? 0; e = $2; q.signal()
        }; t.resume(); if q.wait(timeout: .now() + 30) == .timedOut { t.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "branch_timeout", message: "Branch timed out.") }; s.invalidateAndCancel(); if let e { throw e }; return BranchProviderHTTPResponse(statusCode: status, body: d)
    }
}; public protocol BranchProviderActionClient: Sendable { func executeBranchAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord };
public struct FakeBranchProviderActionClient: BranchProviderActionClient {
    public init() {}; public func executeBranchAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord { ["provider": .string("branch"), "action": .string(request.definition.actionKey), "liveCredentialsUsed": .bool(false)] }
};
public final class LiveBranchProviderActionClient: BranchProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService; private let secrets: SecretService; private let http: any BranchProviderHTTPClient;
    public init(data: LocalDataService, secrets: SecretService, httpClient: any BranchProviderHTTPClient = URLSessionBranchProviderHTTPClient()) { self.data = data; self.secrets = secrets; self.http = httpClient };
    public func executeBranchAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        guard request.definition.actionKey == "branch_bound_link_structure_inspect", let id = request.auditIdentity.connectionId, let c = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), c.appSlug == "branch",
            let keyRef = c.credentialRequirements.first(where: { $0.fieldKey == "branch_key" })?.secretReferenceId, let urlRef = c.credentialRequirements.first(where: { $0.fieldKey == "branch_link_url" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "branch_not_ready", message: "Branch connection is not ready.") }; let key = try secrets.getSecretValue(keyRef), boundURL = try secrets.getSecretValue(urlRef);
        guard key.range(of: #"^key_(live|test)_[A-Za-z0-9]{4,280}$"#, options: .regularExpression) != nil, var components = URLComponents(string: "https://api2.branch.io/v1/url") else {
            throw MarketplaceProviderActionAdapterFailure(code: "branch_credentials_invalid", message: "Branch credentials are invalid.")
        }; components.queryItems = [URLQueryItem(name: "branch_key", value: key), URLQueryItem(name: "url", value: boundURL)]; let r = try http.send(BranchProviderHTTPRequest(url: components.url!, headers: ["Accept": "application/json", "User-Agent": "RelayConsole-Branch/1.0"]));
        guard r.body.count <= 1_000_000, (200..<300).contains(r.statusCode), let root = (try? JSONSerialization.jsonObject(with: r.body)) as? [String: Any] else {
            throw MarketplaceProviderActionAdapterFailure(code: r.statusCode == 429 ? "branch_rate_limited" : "branch_api_error", message: "Branch request failed.", providerStatusCode: r.statusCode)
        }; let values = root["data"] as? [String: Any] ?? [:], tags = root["tags"] as? [Any] ?? []; func present(_ key: String) -> Bool { (root[key] as? String)?.isEmpty == false };
        func bounded(_ value: Any?, _ maximum: Int) -> JSONValue { guard let n = value as? NSNumber, n.intValue >= 0, n.intValue <= maximum else { return .null }; return .number(n.doubleValue) }; let oneTime: JSONValue;
        if let b = values["$one_time_use"] as? Bool { oneTime = .bool(b) } else if let n = root["type"] as? NSNumber { oneTime = .bool(n.intValue == 1) } else { oneTime = .null };
        return [
            "linkVerified": .bool(true), "oneTimeUse": oneTime, "creationSource": bounded(values["~creation_source"], 1_000_000), "matchDurationSeconds": bounded(values["$match_duration"], 31_536_000), "tagCount": .number(Double(min(tags.count, 100))), "tagsTruncated": .bool(tags.count > 100),
            "hasChannel": .bool(present("channel")), "hasFeature": .bool(present("feature")), "hasCampaign": .bool(present("campaign")), "hasStage": .bool(present("stage")), "redactionStatus": .string("link-url-destinations-tags-campaign-values-identity-attribution-and-device-data-excluded"),
        ]
    }
};
public struct BranchProviderActionAdapter: MarketplaceProviderActionAdapter {
    private let client: any BranchProviderActionClient; public init(client: any BranchProviderActionClient = FakeBranchProviderActionClient()) { self.client = client };
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "branch" else { throw MarketplaceProviderActionAdapterFailure(code: "branch_not_allowlisted", message: "Branch action is not allowlisted.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executeBranchAction(request: request), error: nil, redactionStatus: "link-url-destinations-tags-campaign-values-identity-attribution-and-device-data-excluded")
    }
}
