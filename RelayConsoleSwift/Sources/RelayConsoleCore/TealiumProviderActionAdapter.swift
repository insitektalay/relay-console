import Foundation
public struct TealiumProviderHTTPRequest: Sendable { public let url: URL; public let headers: [String: String] }; public struct TealiumProviderHTTPResponse: Sendable { public let statusCode: Int; public let body: Data };
public protocol TealiumProviderHTTPClient: Sendable { func send(_ request: TealiumProviderHTTPRequest) throws -> TealiumProviderHTTPResponse };
private final class TealiumNoRedirect: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
};
public struct URLSessionTealiumProviderHTTPClient: TealiumProviderHTTPClient {
    public init() {};
    public func send(_ request: TealiumProviderHTTPRequest) throws -> TealiumProviderHTTPResponse {
        var r = URLRequest(url: request.url); r.httpMethod = "GET"; r.timeoutInterval = 30; request.headers.forEach { r.setValue($0.value, forHTTPHeaderField: $0.key) }; let s = URLSession(configuration: .ephemeral, delegate: TealiumNoRedirect(), delegateQueue: nil), q = DispatchSemaphore(value: 0);
        var d = Data(), status = 0, e: Error?;
        let t = s.dataTask(with: r) {
            d = $0 ?? Data(); status = ($1 as? HTTPURLResponse)?.statusCode ?? 0; e = $2; q.signal()
        }; t.resume(); if q.wait(timeout: .now() + 30) == .timedOut { t.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "tealium_timeout", message: "Tealium timed out.") }; s.invalidateAndCancel(); if let e { throw e }; return TealiumProviderHTTPResponse(statusCode: status, body: d)
    }
}; public protocol TealiumProviderActionClient: Sendable { func executeTealiumAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord };
public struct FakeTealiumProviderActionClient: TealiumProviderActionClient {
    public init() {}; public func executeTealiumAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord { ["provider": .string("tealium"), "action": .string(request.definition.actionKey), "liveCredentialsUsed": .bool(false)] }
};
public final class LiveTealiumProviderActionClient: TealiumProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService; private let secrets: SecretService; private let http: any TealiumProviderHTTPClient;
    public init(data: LocalDataService, secrets: SecretService, httpClient: any TealiumProviderHTTPClient = URLSessionTealiumProviderHTTPClient()) { self.data = data; self.secrets = secrets; self.http = httpClient };
    public func executeTealiumAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        guard request.definition.actionKey == "tealium_definition_readiness_summary_get", let id = request.auditIdentity.connectionId, let c = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), c.appSlug == "tealium",
            let accountRef = c.credentialRequirements.first(where: { $0.fieldKey == "tealium_account" })?.secretReferenceId, let profileRef = c.credentialRequirements.first(where: { $0.fieldKey == "tealium_profile" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "tealium_not_ready", message: "Tealium connection is not ready.") }; let account = try secrets.getSecretValue(accountRef), profile = try secrets.getSecretValue(profileRef);
        guard account.range(of: #"^[A-Za-z0-9_-]{1,100}$"#, options: .regularExpression) != nil, profile.range(of: #"^[A-Za-z0-9_-]{1,100}$"#, options: .regularExpression) != nil else {
            throw MarketplaceProviderActionAdapterFailure(code: "tealium_binding_invalid", message: "Tealium account/profile binding is invalid.")
        }; let url = URL(string: "https://visitor-service.tealiumiq.com/datacloudprofiledefinitions/\(account)/\(profile)/")!, r = try http.send(TealiumProviderHTTPRequest(url: url, headers: ["Accept": "application/json", "User-Agent": "RelayConsole-Tealium/1.0"]));
        guard r.body.count <= 1_000_000, (200..<300).contains(r.statusCode), let root = (try? JSONSerialization.jsonObject(with: r.body)) as? [String: Any], let audiences = root["audiences"] as? [Any], let badges = root["badges"] as? [Any] else {
            throw MarketplaceProviderActionAdapterFailure(code: r.statusCode == 429 ? "tealium_rate_limited" : r.statusCode == 403 || r.statusCode == 404 ? "tealium_profile_unavailable" : "tealium_api_error", message: "Tealium request failed.", providerStatusCode: r.statusCode)
        }; return ["audienceDefinitionCount": .number(Double(audiences.count)), "badgeDefinitionCount": .number(Double(badges.count)), "redactionStatus": .string("account-profile-audience-badge-identity-names-and-visitor-data-excluded")]
    }
};
public struct TealiumProviderActionAdapter: MarketplaceProviderActionAdapter {
    private let client: any TealiumProviderActionClient; public init(client: any TealiumProviderActionClient = FakeTealiumProviderActionClient()) { self.client = client };
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "tealium" else { throw MarketplaceProviderActionAdapterFailure(code: "tealium_not_allowlisted", message: "Tealium action is not allowlisted.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executeTealiumAction(request: request), error: nil, redactionStatus: "account-profile-audience-badge-identity-names-and-visitor-data-excluded")
    }
}
