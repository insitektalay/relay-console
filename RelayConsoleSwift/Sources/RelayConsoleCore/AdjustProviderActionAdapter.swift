import Foundation
public struct AdjustProviderHTTPRequest: Sendable { public let url: URL; public let headers: [String: String] }; public struct AdjustProviderHTTPResponse: Sendable { public let statusCode: Int; public let body: Data };
public protocol AdjustProviderHTTPClient: Sendable { func send(_ request: AdjustProviderHTTPRequest) throws -> AdjustProviderHTTPResponse };
public struct URLSessionAdjustProviderHTTPClient: AdjustProviderHTTPClient {
    public init() {};
    public func send(_ request: AdjustProviderHTTPRequest) throws -> AdjustProviderHTTPResponse {
        var r = URLRequest(url: request.url); r.httpMethod = "GET"; r.timeoutInterval = 30; request.headers.forEach { r.setValue($0.value, forHTTPHeaderField: $0.key) }; let s = URLSession(configuration: .ephemeral), q = DispatchSemaphore(value: 0); var d = Data(), status = 0, e: Error?;
        let t = s.dataTask(with: r) {
            d = $0 ?? Data(); status = ($1 as? HTTPURLResponse)?.statusCode ?? 0; e = $2; q.signal()
        }; t.resume(); if q.wait(timeout: .now() + 30) == .timedOut { t.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "adjust_timeout", message: "Adjust timed out.") }; s.invalidateAndCancel(); if let e { throw e }; return AdjustProviderHTTPResponse(statusCode: status, body: d)
    }
}; public protocol AdjustProviderActionClient: Sendable { func executeAdjustAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord };
public struct FakeAdjustProviderActionClient: AdjustProviderActionClient {
    public init() {}; public func executeAdjustAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord { ["provider": .string("adjust"), "action": .string(request.definition.actionKey), "liveCredentialsUsed": .bool(false)] }
};
public final class LiveAdjustProviderActionClient: AdjustProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService; private let secrets: SecretService; private let http: any AdjustProviderHTTPClient;
    public init(data: LocalDataService, secrets: SecretService, httpClient: any AdjustProviderHTTPClient = URLSessionAdjustProviderHTTPClient()) { self.data = data; self.secrets = secrets; self.http = httpClient };
    public func executeAdjustAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        guard request.definition.actionKey == "adjust_app_reference_list", let id = request.auditIdentity.connectionId, let c = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), c.appSlug == "adjust",
            let ref = c.credentialRequirements.first?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "adjust_not_ready", message: "Adjust connection is not ready.") }; let token = try secrets.getSecretValue(ref);
        guard !token.isEmpty, !token.contains("\n"), !token.contains("\r") else { throw MarketplaceProviderActionAdapterFailure(code: "adjust_token_invalid", message: "Adjust token is invalid.") };
        let r = try http.send(AdjustProviderHTTPRequest(url: URL(string: "https://automate.adjust.com/reports-service/filters_data?required_filters=apps")!, headers: ["Authorization": "Bearer " + token, "Accept": "application/json", "User-Agent": "RelayConsole-Adjust/1.0"]));
        guard r.body.count <= 1_000_000, (200..<300).contains(r.statusCode), let root = (try? JSONSerialization.jsonObject(with: r.body)) as? [String: Any] else {
            throw MarketplaceProviderActionAdapterFailure(code: r.statusCode == 429 ? "adjust_rate_limited" : "adjust_api_error", message: "Adjust request failed.", providerStatusCode: r.statusCode)
        };
        let all = root["apps"] as? [Any] ?? [],
            values = all.prefix(25).map { v -> JSONValue in
                let raw = (v as? String) ?? (v as? [String: Any])?["id"] as? String ?? ""; return raw.range(of: #"^[A-Za-z0-9._:-]{1,300}$"#, options: .regularExpression) != nil ? .string(raw) : .null
            }
        ; return ["apps": .array(Array(values)), "totalItems": .number(Double(all.count)), "truncated": .bool(all.count > 25), "redactionStatus": .string("names-account-identity-attribution-content-and-report-data-excluded")]
    }
};
public struct AdjustProviderActionAdapter: MarketplaceProviderActionAdapter {
    private let client: any AdjustProviderActionClient; public init(client: any AdjustProviderActionClient = FakeAdjustProviderActionClient()) { self.client = client };
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "adjust" else { throw MarketplaceProviderActionAdapterFailure(code: "adjust_not_allowlisted", message: "Adjust action is not allowlisted.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executeAdjustAction(request: request), error: nil, redactionStatus: "names-account-identity-attribution-content-and-report-data-excluded")
    }
}
