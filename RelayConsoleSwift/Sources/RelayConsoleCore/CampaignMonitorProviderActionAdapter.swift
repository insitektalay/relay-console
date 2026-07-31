import Foundation

public struct CampaignMonitorProviderHTTPRequest:Sendable{public let url:URL;public let headers:[String:String];public init(url:URL,headers:[String:String]){self.url=url;self.headers=headers}}
public struct CampaignMonitorProviderHTTPResponse:Sendable{public let statusCode:Int;public let body:Data;public init(statusCode:Int,body:Data=Data()){self.statusCode=statusCode;self.body=body}}
public protocol CampaignMonitorProviderHTTPClient:Sendable{func send(_ request:CampaignMonitorProviderHTTPRequest)throws->CampaignMonitorProviderHTTPResponse}
private final class CampaignMonitorNoRedirect: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}
public struct URLSessionCampaignMonitorProviderHTTPClient: CampaignMonitorProviderHTTPClient {
    public init() {};
    public func send(_ request: CampaignMonitorProviderHTTPRequest) throws -> CampaignMonitorProviderHTTPResponse {
        var value = URLRequest(url: request.url); value.httpMethod = "GET"; value.timeoutInterval = 20; request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) };
        let session = URLSession(configuration: .ephemeral, delegate: CampaignMonitorNoRedirect(), delegateQueue: nil), semaphore = DispatchSemaphore(value: 0); var data: Data?, response: HTTPURLResponse?, failure: Error?;
        let task = session.dataTask(with: value) {
            data = $0; response = $1 as? HTTPURLResponse; failure = $2; semaphore.signal()
        }; task.resume(); if semaphore.wait(timeout: .now() + 20) == .timedOut { task.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "campaign_monitor_http_timeout", message: "Campaign Monitor API request timed out.") }; session.invalidateAndCancel(); if let failure { throw failure };
        return CampaignMonitorProviderHTTPResponse(statusCode: response?.statusCode ?? 0, body: data ?? Data())
    }
}
public struct CampaignMonitorProviderActionClientResult:Sendable{public let result:JSONRecord;public init(result:JSONRecord){self.result=result}}
public protocol CampaignMonitorProviderActionClient:Sendable{func executeCampaignMonitorAction(request:MarketplaceProviderActionAdapterRequest)throws->CampaignMonitorProviderActionClientResult}
public struct FakeCampaignMonitorProviderActionClient: CampaignMonitorProviderActionClient {
    public init() {};
    public func executeCampaignMonitorAction(request: MarketplaceProviderActionAdapterRequest) throws -> CampaignMonitorProviderActionClientResult {
        switch request.definition.actionKey {
        case "campaign_monitor_client_get": return output(["semanticReadContract": .string("campaign-monitor-client-get-v1"), "client": .object(CampaignMonitorSupport.fakeClient())]);
        case "campaign_monitor_campaign_list_recent_sent": return output(["semanticReadContract": .string("campaign-monitor-campaign-list-recent-sent-v1"), "campaigns": .array([.object(CampaignMonitorSupport.fakeCampaign())])]);
        case "campaign_monitor_campaign_summary_get": return output(["semanticReadContract": .string("campaign-monitor-campaign-summary-get-v1"), "summary": .object(CampaignMonitorSupport.fakeSummary())]);
        default: throw MarketplaceProviderActionAdapterFailure(code: "campaign_monitor_fake_action_not_supported", message: "Unsupported Campaign Monitor action.")
        }
    };
    private func output(_ fields: JSONRecord) -> CampaignMonitorProviderActionClientResult {
        CampaignMonitorProviderActionClientResult(
            result: ["provider": .string("campaign-monitor"), "adapterBoundary": .string("campaign-monitor-provider-action-adapter"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("subscriber-and-content-excluded")].merging(fields) { _, new in new })
    }
}

public final class LiveCampaignMonitorProviderActionClient:CampaignMonitorProviderActionClient,@unchecked Sendable{
    private let data:LocalDataService;private let secrets:SecretService;private let http:any CampaignMonitorProviderHTTPClient
    public init(data:LocalDataService,secrets:SecretService,httpClient:any CampaignMonitorProviderHTTPClient=URLSessionCampaignMonitorProviderHTTPClient()){self.data=data;self.secrets=secrets;self.http=httpClient}
    public func executeCampaignMonitorAction(request: MarketplaceProviderActionAdapterRequest) throws -> CampaignMonitorProviderActionClientResult {
        let auth = try authorization(request);
        switch request.definition.actionKey {
        case "campaign_monitor_client_get":
            let clients = try get(auth.token, path: "/clients.json", query: []).cmArray ?? [], match = clients.first { $0.cmObject?["ClientID"]?.string == auth.clientId }?.cmObject ?? [:];
            guard !match.isEmpty else { throw MarketplaceProviderActionAdapterFailure(code: "campaign_monitor_client_not_visible", message: "Selected Campaign Monitor Client is no longer visible.") };
            return output(["semanticReadContract": .string("campaign-monitor-client-get-v1"), "client": .object(CampaignMonitorSupport.client(match))]);
        case "campaign_monitor_campaign_list_recent_sent":
            let root = try get(auth.token, path: "/clients/" + auth.clientId + "/campaigns.json", query: [.init(name: "page", value: "1"), .init(name: "pagesize", value: "20"), .init(name: "orderdirection", value: "desc")]), source = root.cmObject?["Results"]?.cmArray ?? root.cmArray ?? [];
            let values = source.prefix(20).map { JSONValue.object(CampaignMonitorSupport.campaign($0.cmObject ?? [:])) }; return output(["semanticReadContract": .string("campaign-monitor-campaign-list-recent-sent-v1"), "campaigns": .array(Array(values))]);
        case "campaign_monitor_campaign_summary_get":
            guard let campaignId = request.payload["campaignId"]?.string, CampaignMonitorSupport.safeId(campaignId) else { throw MarketplaceProviderActionAdapterFailure(code: "campaign_monitor_campaign_id_invalid", message: "A safe 32-hex Campaign ID is required.") };
            let root = try get(auth.token, path: "/campaigns/" + campaignId + "/summary.json", query: []);
            return output(["semanticReadContract": .string("campaign-monitor-campaign-summary-get-v1"), "CampaignId": .string(campaignId.lowercased()), "summary": .object(CampaignMonitorSupport.summary(root.cmObject ?? [:]))]);
        default: throw MarketplaceProviderActionAdapterFailure(code: "campaign_monitor_live_action_not_supported", message: "Unsupported live Campaign Monitor action.")
        }
    }
    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> (token: String, clientId: String) {
        guard let id = request.auditIdentity.connectionId, let c = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), c.appSlug == "campaign-monitor", c.grantedScopes == ProviderConnectionService.campaignMonitorRelayOwnedOAuthScopes,
            c.health.diagnostics["apiOrigin"] == .string("https://api.createsend.com/api/v3.3"), let client = c.health.diagnostics["clientId"]?.string, CampaignMonitorSupport.safeId(client),
            let ref = c.credentialRequirements.first(where: { $0.fieldKey == "campaign_monitor_oauth_access_token" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "campaign_monitor_connection_not_ready", message: "Campaign Monitor selected Client and ViewReports permission are not ready.") }; return (try secrets.getSecretValue(ref), client.lowercased())
    }
    private func get(_ token: String, path: String, query: [URLQueryItem]) throws -> JSONValue {
        var components = URLComponents(string: "https://api.createsend.com/api/v3.3" + path)!; components.queryItems = query.isEmpty ? nil : query;
        let response = try http.send(CampaignMonitorProviderHTTPRequest(url: components.url!, headers: ["Authorization": "Bearer " + token, "Accept": "application/json"])), value = (try? JSONSerialization.jsonObject(with: response.body)).map(CampaignMonitorSupport.json) ?? .null;
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: response.statusCode == 429 ? "campaign_monitor_rate_limited" : response.statusCode == 401 ? "campaign_monitor_token_invalid" : "campaign_monitor_api_error", message: "Campaign Monitor API request failed.", providerStatusCode: response.statusCode)
        }; return value
    }
    private func output(_ fields: JSONRecord) -> CampaignMonitorProviderActionClientResult {
        CampaignMonitorProviderActionClientResult(
            result: ["provider": .string("campaign-monitor"), "adapterBoundary": .string("campaign-monitor-provider-action-adapter"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("subscriber-and-content-excluded")].merging(fields) { _, new in new })
    }
}
public struct CampaignMonitorProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = ["campaign_monitor_client_get", "campaign_monitor_campaign_list_recent_sent", "campaign_monitor_campaign_summary_get"]; private let client: any CampaignMonitorProviderActionClient;
    public init(client: any CampaignMonitorProviderActionClient = FakeCampaignMonitorProviderActionClient()) { self.client = client };
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "campaign-monitor", Self.allowed.contains(request.definition.actionKey) else { throw MarketplaceProviderActionAdapterFailure(code: "campaign_monitor_action_not_allowlisted", message: "Campaign Monitor action is outside bounded reporting V1.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executeCampaignMonitorAction(request: request).result, error: nil, redactionStatus: "subscriber-and-content-excluded")
    }
}
enum CampaignMonitorSupport {
    static func safeId(_ v: String) -> Bool { v.count == 32 && v.allSatisfy(\.isHexDigit) }; static func client(_ o: JSONRecord) -> JSONRecord { ["ClientId": scalar(o["ClientID"]), "Name": scalar(o["Name"])] };
    static func campaign(_ o: JSONRecord) -> JSONRecord { ["CampaignId": scalar(o["CampaignID"]), "SentDate": scalar(o["SentDate"])] };
    static func summary(_ o: JSONRecord) -> JSONRecord {
        [
            "Recipients": scalar(o["Recipients"]), "TotalOpened": scalar(o["TotalOpened"]), "UniqueOpened": scalar(o["UniqueOpened"]), "Clicks": scalar(o["Clicks"]), "Unsubscribed": scalar(o["Unsubscribed"]), "Bounced": scalar(o["Bounced"]), "SpamComplaints": scalar(o["SpamComplaints"]),
            "Forwards": scalar(o["Forwards"]), "Likes": scalar(o["Likes"]), "Mentions": scalar(o["Mentions"]),
        ]
    };
    static func scalar(_ v: JSONValue?) -> JSONValue {
        guard let v else { return .null };
        switch v {
        case .string, .number, .bool, .null: return v;
        default: return .null
        }
    };
    static func json(_ any: Any) -> JSONValue {
        if any is NSNull { return .null }; if let v = any as? Bool { return .bool(v) }; if let v = any as? String { return .string(v) }; if let v = any as? NSNumber { return .number(v.doubleValue) }; if let v = any as? [Any] { return .array(v.map(json)) };
        if let v = any as? [String: Any] { return .object(v.mapValues(json)) }; return .null
    }; static func fakeClient() -> JSONRecord { ["ClientId": .string("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"), "Name": .string("Relay Client")] }; static func fakeCampaign() -> JSONRecord { ["CampaignId": .string("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"), "SentDate": .string("2026-07-11 09:00:00")] };
    static func fakeSummary() -> JSONRecord {
        ["Recipients": .number(1000), "TotalOpened": .number(345), "UniqueOpened": .number(298), "Clicks": .number(132), "Unsubscribed": .number(43), "Bounced": .number(15), "SpamComplaints": .number(23), "Forwards": .number(18), "Likes": .number(25), "Mentions": .number(11)]
    }
}
private extension JSONValue{var cmObject:JSONRecord?{if case .object(let v)=self{return v};return nil};var cmArray:[JSONValue]?{if case .array(let v)=self{return v};return nil}}
