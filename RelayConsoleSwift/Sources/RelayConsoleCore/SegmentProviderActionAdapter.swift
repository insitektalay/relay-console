import Foundation
public struct SegmentProviderHTTPRequest: Sendable { public let url: URL; public let headers: [String: String] }; public struct SegmentProviderHTTPResponse: Sendable { public let statusCode: Int; public let body: Data };
public protocol SegmentProviderHTTPClient: Sendable { func send(_ request: SegmentProviderHTTPRequest) throws -> SegmentProviderHTTPResponse };
public struct URLSessionSegmentProviderHTTPClient: SegmentProviderHTTPClient {
    public init() {};
    public func send(_ request: SegmentProviderHTTPRequest) throws -> SegmentProviderHTTPResponse {
        var r = URLRequest(url: request.url); r.httpMethod = "GET"; r.timeoutInterval = 30; request.headers.forEach { r.setValue($0.value, forHTTPHeaderField: $0.key) }; let s = URLSession(configuration: .ephemeral), q = DispatchSemaphore(value: 0); var d = Data(), status = 0, e: Error?;
        let t = s.dataTask(with: r) {
            d = $0 ?? Data(); status = ($1 as? HTTPURLResponse)?.statusCode ?? 0; e = $2; q.signal()
        }; t.resume(); if q.wait(timeout: .now() + 30) == .timedOut { t.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "segment_personas_timeout", message: "Segment timed out.") }; s.invalidateAndCancel(); if let e { throw e };
        return SegmentProviderHTTPResponse(statusCode: status, body: d)
    }
}; public protocol SegmentProviderActionClient: Sendable { func executeSegmentAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord };
public struct FakeSegmentProviderActionClient: SegmentProviderActionClient {
    public init() {}; public func executeSegmentAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord { ["provider": .string("segment-personas"), "action": .string(request.definition.actionKey), "liveCredentialsUsed": .bool(false)] }
};
public final class LiveSegmentProviderActionClient: SegmentProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService; private let secrets: SecretService; private let http: any SegmentProviderHTTPClient;
    public init(data: LocalDataService, secrets: SecretService, httpClient: any SegmentProviderHTTPClient = URLSessionSegmentProviderHTTPClient()) { self.data = data; self.secrets = secrets; self.http = httpClient };
    public func executeSegmentAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        guard request.definition.actionKey == "segment_personas_audience_readiness_summary_get", let id = request.auditIdentity.connectionId, let c = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), c.appSlug == "segment-personas",
            let tokenRef = c.credentialRequirements.first(where: { $0.fieldKey == "segment_public_api_token" })?.secretReferenceId, let spaceRef = c.credentialRequirements.first(where: { $0.fieldKey == "segment_space_id" })?.secretReferenceId,
            let regionRef = c.credentialRequirements.first(where: { $0.fieldKey == "segment_api_region" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "segment_personas_not_ready", message: "Segment connection is not ready.") }; let token = try secrets.getSecretValue(tokenRef), space = try secrets.getSecretValue(spaceRef), region = try secrets.getSecretValue(regionRef);
        guard !token.isEmpty, !token.contains("\n"), !token.contains("\r"), space.range(of: #"^[A-Za-z0-9_-]{1,255}$"#, options: .regularExpression) != nil, (region == "us" || region == "eu1") else {
            throw MarketplaceProviderActionAdapterFailure(code: "segment_personas_credentials_invalid", message: "Segment credentials are invalid.")
        };
        let host = region == "eu1" ? "eu1.api.segmentapis.com" : "api.segmentapis.com", url = "https://\(host)/spaces/\(space)/audiences?pagination.count=25",
            r = try http.send(SegmentProviderHTTPRequest(url: URL(string: url)!, headers: ["Authorization": "Bearer " + token, "Accept": "application/vnd.segment.v1+json", "User-Agent": "RelayConsole-Segment/1.0"]))
        ;
        guard r.body.count <= 1_000_000, (200..<300).contains(r.statusCode), let root = (try? JSONSerialization.jsonObject(with: r.body)) as? [String: Any], let data = root["data"] as? [String: Any], let all = data["audiences"] as? [Any] else {
            throw MarketplaceProviderActionAdapterFailure(code: r.statusCode == 429 ? "segment_personas_rate_limited" : "segment_personas_api_error", message: "Segment request failed.", providerStatusCode: r.statusCode)
        }; let values = all.prefix(25); func text(_ row: [String: Any], _ key: String) -> String { return (row[key] as? String ?? "").uppercased() }; var enabled = 0, live = 0, users = 0, accounts = 0, linked = 0, realtime = 0, batch = 0;
        for case let row as [String: Any] in values {
            if row["enabled"] as? Bool == true { enabled += 1 }; if text(row, "status") == "LIVE" { live += 1 };
            switch text(row, "audienceType") {
            case "USERS": users += 1;
            case "ACCOUNTS": accounts += 1;
            case "LINKED": linked += 1;
            default: break
            };
            switch text(row["computeCadence"] as? [String: Any] ?? [:], "type") {
            case "REALTIME": realtime += 1;
            case "BATCH": batch += 1;
            default: break
            }
        }; let pagination = data["pagination"] as? [String: Any];
        return [
            "returnedCount": .number(Double(values.count)), "totalEntries": (pagination?["totalEntries"] as? NSNumber).map { .number($0.doubleValue) } ?? .null, "nextPageAvailable": .bool((pagination?["next"] as? String)?.isEmpty == false), "enabledCount": .number(Double(enabled)),
            "liveCount": .number(Double(live)), "userAudienceCount": .number(Double(users)), "accountAudienceCount": .number(Double(accounts)), "linkedAudienceCount": .number(Double(linked)), "realtimeCount": .number(Double(realtime)), "batchCount": .number(Double(batch)),
            "redactionStatus": .string("audience-ids-names-keys-definitions-sizes-members-identifiers-schedules-destinations-and-creators-excluded"),
        ]
    }
};
public struct SegmentProviderActionAdapter: MarketplaceProviderActionAdapter {
    private let client: any SegmentProviderActionClient; public init(client: any SegmentProviderActionClient = FakeSegmentProviderActionClient()) { self.client = client };
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "segment-personas" else { throw MarketplaceProviderActionAdapterFailure(code: "segment_personas_not_allowlisted", message: "Segment action is not allowlisted.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executeSegmentAction(request: request), error: nil, redactionStatus: "audience-ids-names-keys-definitions-sizes-members-identifiers-schedules-destinations-and-creators-excluded")
    }
}
