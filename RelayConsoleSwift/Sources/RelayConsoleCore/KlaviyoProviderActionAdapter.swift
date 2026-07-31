import Foundation

public struct KlaviyoProviderHTTPRequest:Sendable{public let url:URL;public let headers:[String:String];public init(url:URL,headers:[String:String]){self.url=url;self.headers=headers}}
public struct KlaviyoProviderHTTPResponse:Sendable{public let statusCode:Int;public let body:Data;public init(statusCode:Int,body:Data=Data()){self.statusCode=statusCode;self.body=body}}
public protocol KlaviyoProviderHTTPClient:Sendable{func send(_ request:KlaviyoProviderHTTPRequest)throws->KlaviyoProviderHTTPResponse}
private final class KlaviyoNoRedirect: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}
public struct URLSessionKlaviyoProviderHTTPClient: KlaviyoProviderHTTPClient {
    public init() {};
    public func send(_ request: KlaviyoProviderHTTPRequest) throws -> KlaviyoProviderHTTPResponse {
        var value = URLRequest(url: request.url); value.httpMethod = "GET"; value.timeoutInterval = 20; request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) };
        let session = URLSession(configuration: .ephemeral, delegate: KlaviyoNoRedirect(), delegateQueue: nil), semaphore = DispatchSemaphore(value: 0); var data: Data?, response: HTTPURLResponse?, failure: Error?;
        let task = session.dataTask(with: value) {
            data = $0; response = $1 as? HTTPURLResponse; failure = $2; semaphore.signal()
        }; task.resume(); if semaphore.wait(timeout: .now() + 20) == .timedOut { task.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "klaviyo_http_timeout", message: "Klaviyo API request timed out.") }; session.invalidateAndCancel(); if let failure { throw failure };
        return KlaviyoProviderHTTPResponse(statusCode: response?.statusCode ?? 0, body: data ?? Data())
    }
}
public struct KlaviyoProviderActionClientResult:Sendable{public let result:JSONRecord;public init(result:JSONRecord){self.result=result}}
public protocol KlaviyoProviderActionClient:Sendable{func executeKlaviyoAction(request:MarketplaceProviderActionAdapterRequest)throws->KlaviyoProviderActionClientResult}
public struct FakeKlaviyoProviderActionClient: KlaviyoProviderActionClient {
    public init() {};
    public func executeKlaviyoAction(request: MarketplaceProviderActionAdapterRequest) throws -> KlaviyoProviderActionClientResult {
        switch request.definition.actionKey {
        case "klaviyo_account_get": return output(["semanticReadContract": .string("klaviyo-account-get-v1"), "account": .object(KlaviyoSupport.fakeAccount())]);
        case "klaviyo_list_list_recent": return output(["semanticReadContract": .string("klaviyo-list-list-recent-v1"), "lists": .array([.object(KlaviyoSupport.fakeList())])]);
        case "klaviyo_campaign_list_recent_email": return output(["semanticReadContract": .string("klaviyo-campaign-list-recent-email-v1"), "campaigns": .array([.object(KlaviyoSupport.fakeCampaign())])]);
        default: throw MarketplaceProviderActionAdapterFailure(code: "klaviyo_fake_action_not_supported", message: "Unsupported Klaviyo action.")
        }
    };
    private func output(_ fields: JSONRecord) -> KlaviyoProviderActionClientResult {
        KlaviyoProviderActionClientResult(result: ["provider": .string("klaviyo"), "adapterBoundary": .string("klaviyo-provider-action-adapter"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("profile-and-content-excluded")].merging(fields) { _, new in new })
    }
}
public final class LiveKlaviyoProviderActionClient:KlaviyoProviderActionClient,@unchecked Sendable{
 private let data:LocalDataService;private let secrets:SecretService;private let http:any KlaviyoProviderHTTPClient
 public init(data:LocalDataService,secrets:SecretService,httpClient:any KlaviyoProviderHTTPClient=URLSessionKlaviyoProviderHTTPClient()){self.data=data;self.secrets=secrets;self.http=httpClient}
    public func executeKlaviyoAction(request: MarketplaceProviderActionAdapterRequest) throws -> KlaviyoProviderActionClientResult {
        let token = try authorization(request);
        switch request.definition.actionKey {
        case "klaviyo_account_get":
            let root = try get(token, path: "/api/accounts", query: [URLQueryItem(name: "fields[account]", value: "name,timezone,currency")]), first = root.klObject?["data"]?.klArray?.first ?? .null;
            return output(["semanticReadContract": .string("klaviyo-account-get-v1"), "account": .object(KlaviyoSupport.account(first))]);
        case "klaviyo_list_list_recent":
            let root = try get(token, path: "/api/lists", query: [URLQueryItem(name: "page[size]", value: "10"), URLQueryItem(name: "sort", value: "-updated"), URLQueryItem(name: "fields[list]", value: "name,created,updated,opt_in_process")]),
                values = (root.klObject?["data"]?.klArray ?? []).prefix(10).map { JSONValue.object(KlaviyoSupport.list($0)) }
            ; return output(["semanticReadContract": .string("klaviyo-list-list-recent-v1"), "lists": .array(Array(values))]);
        case "klaviyo_campaign_list_recent_email":
            let
                root = try get(
                    token, path: "/api/campaigns",
                    query: [URLQueryItem(name: "page[size]", value: "25"), URLQueryItem(name: "filter", value: "equals(messages.channel,'email')"), URLQueryItem(name: "sort", value: "-updated_at"), URLQueryItem(name: "fields[campaign]", value: "status,archived,created_at,scheduled_at,updated_at")]),
                values = (root.klObject?["data"]?.klArray ?? []).prefix(25).map { JSONValue.object(KlaviyoSupport.campaign($0)) }
            ; return output(["semanticReadContract": .string("klaviyo-campaign-list-recent-email-v1"), "campaigns": .array(Array(values))]);
        default: throw MarketplaceProviderActionAdapterFailure(code: "klaviyo_live_action_not_supported", message: "Unsupported live Klaviyo action.")
        }
    }
    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> String {
        guard let id = request.auditIdentity.connectionId, let c = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), c.appSlug == "klaviyo", c.grantedScopes == ProviderConnectionService.klaviyoRelayOwnedOAuthScopes,
            c.health.diagnostics["apiOrigin"] == .string("https://a.klaviyo.com"), c.health.diagnostics["apiRevision"] == .string("2026-04-15"), let ref = c.credentialRequirements.first(where: { $0.fieldKey == "klaviyo_oauth_access_token" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "klaviyo_connection_not_ready", message: "Klaviyo exact account, scopes and API revision are not ready.") }; return try secrets.getSecretValue(ref)
    }
    private func get(_ token: String, path: String, query: [URLQueryItem]) throws -> JSONValue {
        var components = URLComponents(string: "https://a.klaviyo.com" + path)!; components.queryItems = query;
        let response = try http.send(KlaviyoProviderHTTPRequest(url: components.url!, headers: ["Authorization": "Bearer " + token, "Accept": "application/vnd.api+json", "revision": "2026-04-15"])), value = (try? JSONSerialization.jsonObject(with: response.body)).map(KlaviyoSupport.json) ?? .null;
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: response.statusCode == 429 ? "klaviyo_rate_limited" : response.statusCode == 401 ? "klaviyo_token_expired_or_invalid" : response.statusCode == 403 ? "klaviyo_scope_forbidden" : "klaviyo_api_error", message: "Klaviyo API request failed.", providerStatusCode: response.statusCode)
        }; return value
    }
    private func output(_ fields: JSONRecord) -> KlaviyoProviderActionClientResult {
        KlaviyoProviderActionClientResult(result: ["provider": .string("klaviyo"), "adapterBoundary": .string("klaviyo-provider-action-adapter"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("profile-and-content-excluded")].merging(fields) { _, new in new })
    }
}
public struct KlaviyoProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = ["klaviyo_account_get", "klaviyo_list_list_recent", "klaviyo_campaign_list_recent_email"]; private let client: any KlaviyoProviderActionClient;
    public init(client: any KlaviyoProviderActionClient = FakeKlaviyoProviderActionClient()) { self.client = client };
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "klaviyo", Self.allowed.contains(request.definition.actionKey) else { throw MarketplaceProviderActionAdapterFailure(code: "klaviyo_action_not_allowlisted", message: "Klaviyo action is outside bounded metadata-only V1.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executeKlaviyoAction(request: request).result, error: nil, redactionStatus: "profile-and-content-excluded")
    }
}
enum KlaviyoSupport {
    static func resource(_ v: JSONValue) -> (String, JSONRecord) { let o = v.klObject ?? [:], a = o["attributes"]?.klObject ?? [:]; return (o["id"]?.string ?? "", a) };
    static func account(_ v: JSONValue) -> JSONRecord { let (id, a) = resource(v); return ["AccountId": .string(id), "Name": scalar(a["name"]), "Timezone": scalar(a["timezone"]), "Currency": scalar(a["currency"])] };
    static func list(_ v: JSONValue) -> JSONRecord { let (id, a) = resource(v); return ["ListId": .string(id), "Name": scalar(a["name"]), "Created": scalar(a["created"]), "Updated": scalar(a["updated"]), "OptInProcess": scalar(a["opt_in_process"])] };
    static func campaign(_ v: JSONValue) -> JSONRecord {
        let (id, a) = resource(v); return ["CampaignId": .string(id), "Status": scalar(a["status"]), "Archived": scalar(a["archived"]), "CreatedAt": scalar(a["created_at"]), "ScheduledAt": scalar(a["scheduled_at"]), "UpdatedAt": scalar(a["updated_at"])]
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
    }; static func fakeAccount() -> JSONRecord { ["AccountId": .string("AbC123"), "Name": .string("Relay Commerce"), "Timezone": .string("Europe/London"), "Currency": .string("GBP")] };
    static func fakeList() -> JSONRecord { ["ListId": .string("XyZ123"), "Name": .string("Product updates"), "Created": .string("2025-01-01T00:00:00Z"), "Updated": .string("2026-07-11T09:00:00Z"), "OptInProcess": .string("double_opt_in")] };
    static func fakeCampaign() -> JSONRecord { ["CampaignId": .string("01H5QQV9F57XJHJDMD86RX4QM5"), "Status": .string("Sent"), "Archived": .bool(false), "CreatedAt": .string("2026-07-10T08:00:00Z"), "ScheduledAt": .string("2026-07-11T08:30:00Z"), "UpdatedAt": .string("2026-07-11T09:00:00Z")] }
}
private extension JSONValue{var klObject:JSONRecord?{if case .object(let v)=self{return v};return nil};var klArray:[JSONValue]?{if case .array(let v)=self{return v};return nil}}
