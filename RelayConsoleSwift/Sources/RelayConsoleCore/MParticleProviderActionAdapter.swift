import Foundation
public struct MParticleProviderHTTPRequest: Sendable {
    public let url: URL; public let method: String; public let headers: [String: String]; public let body: Data?; public init(url: URL, method: String, headers: [String: String], body: Data? = nil) { self.url = url; self.method = method; self.headers = headers; self.body = body }
}; public struct MParticleProviderHTTPResponse: Sendable { public let statusCode: Int; public let body: Data }; public protocol MParticleProviderHTTPClient: Sendable { func send(_ request: MParticleProviderHTTPRequest) throws -> MParticleProviderHTTPResponse };
private final class MParticleNoRedirect: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
};
public struct URLSessionMParticleProviderHTTPClient: MParticleProviderHTTPClient {
    public init() {};
    public func send(_ request: MParticleProviderHTTPRequest) throws -> MParticleProviderHTTPResponse {
        var r = URLRequest(url: request.url); r.httpMethod = request.method; r.httpBody = request.body; r.timeoutInterval = 30; request.headers.forEach { r.setValue($0.value, forHTTPHeaderField: $0.key) };
        let s = URLSession(configuration: .ephemeral, delegate: MParticleNoRedirect(), delegateQueue: nil), q = DispatchSemaphore(value: 0); var d = Data(), status = 0, e: Error?;
        let t = s.dataTask(with: r) {
            d = $0 ?? Data(); status = ($1 as? HTTPURLResponse)?.statusCode ?? 0; e = $2; q.signal()
        }; t.resume(); if q.wait(timeout: .now() + 30) == .timedOut { t.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "mparticle_timeout", message: "mParticle timed out.") }; s.invalidateAndCancel(); if let e { throw e };
        return MParticleProviderHTTPResponse(statusCode: status, body: d)
    }
}; public protocol MParticleProviderActionClient: Sendable { func executeMParticleAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord };
public struct FakeMParticleProviderActionClient: MParticleProviderActionClient {
    public init() {}; public func executeMParticleAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord { ["provider": .string("mparticle"), "action": .string(request.definition.actionKey), "liveCredentialsUsed": .bool(false)] }
};
public final class LiveMParticleProviderActionClient: MParticleProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService; private let secrets: SecretService; private let http: any MParticleProviderHTTPClient;
    public init(data: LocalDataService, secrets: SecretService, httpClient: any MParticleProviderHTTPClient = URLSessionMParticleProviderHTTPClient()) { self.data = data; self.secrets = secrets; self.http = httpClient };
    public func executeMParticleAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        guard request.definition.actionKey == "mparticle_audience_readiness_summary_get", let id = request.auditIdentity.connectionId, let c = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), c.appSlug == "mparticle",
            let clientRef = c.credentialRequirements.first(where: { $0.fieldKey == "mparticle_client_id" })?.secretReferenceId, let secretRef = c.credentialRequirements.first(where: { $0.fieldKey == "mparticle_client_secret" })?.secretReferenceId,
            let accountRef = c.credentialRequirements.first(where: { $0.fieldKey == "mparticle_account_id" })?.secretReferenceId, let workspaceRef = c.credentialRequirements.first(where: { $0.fieldKey == "mparticle_workspace_id" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "mparticle_not_ready", message: "mParticle connection is not ready.") };
        let client = try secrets.getSecretValue(clientRef), secret = try secrets.getSecretValue(secretRef), account = try secrets.getSecretValue(accountRef), workspace = try secrets.getSecretValue(workspaceRef);
        guard !client.isEmpty, !client.contains("\n"), !client.contains("\r"), !secret.isEmpty, !secret.contains("\n"), !secret.contains("\r"), account.range(of: #"^[1-9][0-9]{0,18}$"#, options: .regularExpression) != nil,
            workspace.range(of: #"^[1-9][0-9]{0,18}$"#, options: .regularExpression) != nil
        else { throw MarketplaceProviderActionAdapterFailure(code: "mparticle_credentials_invalid", message: "mParticle credential binding is invalid.") };
        let tokenBody = try JSONSerialization.data(withJSONObject: ["client_id": client, "client_secret": secret, "audience": "https://api.mparticle.com", "grant_type": "client_credentials"]),
            tokenResponse = try http.send(MParticleProviderHTTPRequest(url: URL(string: "https://sso.auth.mparticle.com/oauth/token")!, method: "POST", headers: ["Accept": "application/json", "Content-Type": "application/json", "User-Agent": "RelayConsole-mParticle/1.0"], body: tokenBody))
        ;
        guard tokenResponse.body.count <= 1_000_000, (200..<300).contains(tokenResponse.statusCode), let tokenObject = (try? JSONSerialization.jsonObject(with: tokenResponse.body)) as? [String: Any], let token = tokenObject["access_token"] as? String, !token.isEmpty, token.count <= 30_000,
            !token.contains("\n"), !token.contains("\r")
        else { throw MarketplaceProviderActionAdapterFailure(code: tokenResponse.statusCode == 429 ? "mparticle_rate_limited" : "mparticle_token_error", message: "mParticle token exchange failed.", providerStatusCode: tokenResponse.statusCode) };
        var parts = URLComponents(string: "https://api.mparticle.com/v1/workspace/\(workspace)/audiences")!; parts.queryItems = [URLQueryItem(name: "accountId", value: account)];
        let r = try http.send(MParticleProviderHTTPRequest(url: parts.url!, method: "GET", headers: ["Accept": "application/json", "Authorization": "Bearer " + token, "User-Agent": "RelayConsole-mParticle/1.0"]));
        guard r.body.count <= 1_000_000, (200..<300).contains(r.statusCode), let values = (try? JSONSerialization.jsonObject(with: r.body)) as? [Any] else {
            throw MarketplaceProviderActionAdapterFailure(
                code: r.statusCode == 429 ? "mparticle_rate_limited" : r.statusCode == 401 ? "mparticle_token_invalid" : r.statusCode == 403 || r.statusCode == 404 ? "mparticle_permission_denied" : "mparticle_api_error", message: "mParticle request failed.", providerStatusCode: r.statusCode)
        }; var active = 0, calculated = 0, connected = 0;
        for case let row as [String: Any] in values { if (row["status"] as? String)?.lowercased() == "active" { active += 1 }; if row["is_calculated"] as? Bool == true { calculated += 1 }; if let outputs = row["connected_outputs"] as? [Any], !outputs.isEmpty { connected += 1 } };
        return [
            "returnedCount": .number(Double(values.count)), "activeCount": .number(Double(active)), "calculatedCount": .number(Double(calculated)), "connectedCount": .number(Double(connected)),
            "redactionStatus": .string("audience-identity-size-membership-change-creators-workspace-and-output-details-excluded"),
        ]
    }
};
public struct MParticleProviderActionAdapter: MarketplaceProviderActionAdapter {
    private let client: any MParticleProviderActionClient; public init(client: any MParticleProviderActionClient = FakeMParticleProviderActionClient()) { self.client = client };
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "mparticle" else { throw MarketplaceProviderActionAdapterFailure(code: "mparticle_not_allowlisted", message: "mParticle action is not allowlisted.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executeMParticleAction(request: request), error: nil, redactionStatus: "audience-identity-size-membership-change-creators-workspace-and-output-details-excluded")
    }
}
