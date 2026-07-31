import Foundation
public struct LyticsProviderHTTPRequest: Sendable { public let url: URL; public let headers: [String: String] }; public struct LyticsProviderHTTPResponse: Sendable { public let statusCode: Int; public let body: Data };
public protocol LyticsProviderHTTPClient: Sendable { func send(_ request: LyticsProviderHTTPRequest) throws -> LyticsProviderHTTPResponse };
private final class LyticsNoRedirect: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
};
public struct URLSessionLyticsProviderHTTPClient: LyticsProviderHTTPClient {
    public init() {};
    public func send(_ request: LyticsProviderHTTPRequest) throws -> LyticsProviderHTTPResponse {
        var r = URLRequest(url: request.url); r.httpMethod = "GET"; r.timeoutInterval = 30; request.headers.forEach { r.setValue($0.value, forHTTPHeaderField: $0.key) }; let s = URLSession(configuration: .ephemeral, delegate: LyticsNoRedirect(), delegateQueue: nil), q = DispatchSemaphore(value: 0);
        var d = Data(), status = 0, e: Error?;
        let t = s.dataTask(with: r) {
            d = $0 ?? Data(); status = ($1 as? HTTPURLResponse)?.statusCode ?? 0; e = $2; q.signal()
        }; t.resume(); if q.wait(timeout: .now() + 30) == .timedOut { t.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "lytics_timeout", message: "Lytics timed out.") }; s.invalidateAndCancel(); if let e { throw e }; return LyticsProviderHTTPResponse(statusCode: status, body: d)
    }
}; public protocol LyticsProviderActionClient: Sendable { func executeLyticsAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord };
public struct FakeLyticsProviderActionClient: LyticsProviderActionClient {
    public init() {}; public func executeLyticsAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord { ["provider": .string("lytics"), "action": .string(request.definition.actionKey), "liveCredentialsUsed": .bool(false)] }
};
public final class LiveLyticsProviderActionClient: LyticsProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService; private let secrets: SecretService; private let http: any LyticsProviderHTTPClient;
    public init(data: LocalDataService, secrets: SecretService, httpClient: any LyticsProviderHTTPClient = URLSessionLyticsProviderHTTPClient()) { self.data = data; self.secrets = secrets; self.http = httpClient };
    public func executeLyticsAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        guard request.definition.actionKey == "lytics_segment_readiness_summary_get", let id = request.auditIdentity.connectionId, let c = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), c.appSlug == "lytics",
            let tokenRef = c.credentialRequirements.first(where: { $0.fieldKey == "lytics_api_token" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "lytics_not_ready", message: "Lytics connection is not ready.") }; let token = try secrets.getSecretValue(tokenRef);
        guard !token.isEmpty, token.count <= 30_000, !token.contains("\n"), !token.contains("\r") else { throw MarketplaceProviderActionAdapterFailure(code: "lytics_token_invalid", message: "Lytics token is invalid.") };
        let r = try http.send(LyticsProviderHTTPRequest(url: URL(string: "https://api.lytics.io/v2/segment")!, headers: ["Accept": "application/json", "Authorization": token, "User-Agent": "RelayConsole-Lytics/1.0"]));
        guard r.body.count <= 1_000_000, (200..<300).contains(r.statusCode), let any = try? JSONSerialization.jsonObject(with: r.body) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: r.statusCode == 429 ? "lytics_rate_limited" : r.statusCode == 401 ? "lytics_token_invalid" : r.statusCode == 403 || r.statusCode == 404 ? "lytics_permission_denied" : "lytics_api_error", message: "Lytics request failed.", providerStatusCode: r.statusCode)
        }; let values: [Any];
        if let a = any as? [Any] {
            values = a
        } else if let o = any as? [String: Any], let a = (o["data"] as? [Any]) ?? (o["segments"] as? [Any]) {
            values = a
        } else {
            throw MarketplaceProviderActionAdapterFailure(code: "lytics_response_invalid", message: "Lytics returned an unexpected segment-list shape.")
        }; var users = 0, content = 0, pub = 0;
        for case let row as [String: Any] in values {
            switch (row["table"] as? String ?? "").lowercased() {
            case "user": users += 1;
            case "content": content += 1;
            default: break
            }; if row["is_public"] as? Bool == true { pub += 1 }
        };
        return [
            "returnedCount": .number(Double(values.count)), "userSegmentCount": .number(Double(users)), "contentSegmentCount": .number(Double(content)), "publicSegmentCount": .number(Double(pub)),
            "redactionStatus": .string("segment-identity-definitions-membership-size-lineage-jobs-and-profile-data-excluded"),
        ]
    }
};
public struct LyticsProviderActionAdapter: MarketplaceProviderActionAdapter {
    private let client: any LyticsProviderActionClient; public init(client: any LyticsProviderActionClient = FakeLyticsProviderActionClient()) { self.client = client };
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "lytics" else { throw MarketplaceProviderActionAdapterFailure(code: "lytics_not_allowlisted", message: "Lytics action is not allowlisted.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executeLyticsAction(request: request), error: nil, redactionStatus: "segment-identity-definitions-membership-size-lineage-jobs-and-profile-data-excluded")
    }
}
