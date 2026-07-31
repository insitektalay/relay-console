import Foundation
public struct KochavaProviderHTTPRequest: Sendable { public let url: URL; public let headers: [String: String] }; public struct KochavaProviderHTTPResponse: Sendable { public let statusCode: Int; public let body: Data };
public protocol KochavaProviderHTTPClient: Sendable { func send(_ request: KochavaProviderHTTPRequest) throws -> KochavaProviderHTTPResponse };
public struct URLSessionKochavaProviderHTTPClient: KochavaProviderHTTPClient {
    public init() {};
    public func send(_ request: KochavaProviderHTTPRequest) throws -> KochavaProviderHTTPResponse {
        var r = URLRequest(url: request.url); r.httpMethod = "GET"; r.timeoutInterval = 30; request.headers.forEach { r.setValue($0.value, forHTTPHeaderField: $0.key) }; let s = URLSession(configuration: .ephemeral), q = DispatchSemaphore(value: 0); var d = Data(), status = 0, e: Error?;
        let t = s.dataTask(with: r) {
            d = $0 ?? Data(); status = ($1 as? HTTPURLResponse)?.statusCode ?? 0; e = $2; q.signal()
        }; t.resume(); if q.wait(timeout: .now() + 30) == .timedOut { t.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "kochava_timeout", message: "Kochava timed out.") }; s.invalidateAndCancel(); if let e { throw e }; return KochavaProviderHTTPResponse(statusCode: status, body: d)
    }
}; public protocol KochavaProviderActionClient: Sendable { func executeKochavaAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord };
public struct FakeKochavaProviderActionClient: KochavaProviderActionClient {
    public init() {}; public func executeKochavaAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord { ["provider": .string("kochava"), "action": .string(request.definition.actionKey), "liveCredentialsUsed": .bool(false)] }
};
public final class LiveKochavaProviderActionClient: KochavaProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService; private let secrets: SecretService; private let http: any KochavaProviderHTTPClient;
    public init(data: LocalDataService, secrets: SecretService, httpClient: any KochavaProviderHTTPClient = URLSessionKochavaProviderHTTPClient()) { self.data = data; self.secrets = secrets; self.http = httpClient };
    public func executeKochavaAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        guard request.definition.actionKey == "kochava_app_reference_list", let id = request.auditIdentity.connectionId, let c = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), c.appSlug == "kochava",
            let ref = c.credentialRequirements.first(where: { $0.fieldKey == "kochava_api_key" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "kochava_not_ready", message: "Kochava connection is not ready.") }; let key = try secrets.getSecretValue(ref);
        guard !key.isEmpty, !key.contains("\n"), !key.contains("\r") else { throw MarketplaceProviderActionAdapterFailure(code: "kochava_key_invalid", message: "Kochava API key is invalid.") };
        let r = try http.send(KochavaProviderHTTPRequest(url: URL(string: "https://apps.api.kochava.com/apps?app_selector=true&pageToken=1")!, headers: ["Authentication-Key": key, "Accept": "application/json", "User-Agent": "RelayConsole-Kochava/1.0"]));
        guard r.body.count <= 1_000_000, (200..<300).contains(r.statusCode), let any = try? JSONSerialization.jsonObject(with: r.body) else {
            throw MarketplaceProviderActionAdapterFailure(code: r.statusCode == 429 ? "kochava_rate_limited" : "kochava_api_error", message: "Kochava request failed.", providerStatusCode: r.statusCode)
        }; let root = any as? [String: Any] ?? [:], all = (any as? [Any]) ?? (root["data"] as? [Any]) ?? (root["apps"] as? [Any]) ?? [];
        func parseId(_ value: Any?) -> String? { if let n = value as? NSNumber, n.intValue >= 0 { return String(n.intValue) }; if let s = value as? String, s.range(of: #"^[0-9]{1,30}$"#, options: .regularExpression) != nil { return s }; return nil };
        let values = all.prefix(25).compactMap { v -> JSONValue? in
            guard let row = v as? [String: Any], let app = parseId(row["id"]), let platform = (row["platform"] as? String)?.lowercased(), platform.range(of: #"^[a-z0-9_-]{1,50}$"#, options: .regularExpression) != nil, let deleted = row["deleted"] as? Bool else { return nil };
            return .object(["appId": .string(app), "platform": .string(platform), "deleted": .bool(deleted)])
        };
        return [
            "apps": .array(Array(values)), "returnedCount": .number(Double(values.count)), "nextPageAvailable": .bool((root["nextToken"] as? String)?.isEmpty == false),
            "redactionStatus": .string("names-guids-store-sdk-consent-configuration-credentials-links-attribution-device-and-report-data-excluded"),
        ]
    }
};
public struct KochavaProviderActionAdapter: MarketplaceProviderActionAdapter {
    private let client: any KochavaProviderActionClient; public init(client: any KochavaProviderActionClient = FakeKochavaProviderActionClient()) { self.client = client };
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "kochava" else { throw MarketplaceProviderActionAdapterFailure(code: "kochava_not_allowlisted", message: "Kochava action is not allowlisted.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executeKochavaAction(request: request), error: nil, redactionStatus: "names-guids-store-sdk-consent-configuration-credentials-links-attribution-device-and-report-data-excluded")
    }
}
