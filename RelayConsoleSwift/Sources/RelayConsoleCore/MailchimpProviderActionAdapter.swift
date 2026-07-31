import Foundation

public struct MailchimpProviderHTTPRequest:Sendable{public let url:URL;public let headers:[String:String];public init(url:URL,headers:[String:String]){self.url=url;self.headers=headers}}
public struct MailchimpProviderHTTPResponse:Sendable{public let statusCode:Int;public let body:Data;public init(statusCode:Int,body:Data=Data()){self.statusCode=statusCode;self.body=body}}
public protocol MailchimpProviderHTTPClient:Sendable{func send(_ request:MailchimpProviderHTTPRequest)throws->MailchimpProviderHTTPResponse}
private final class MailchimpNoRedirect: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}
public struct URLSessionMailchimpProviderHTTPClient: MailchimpProviderHTTPClient {
    public init() {};
    public func send(_ request: MailchimpProviderHTTPRequest) throws -> MailchimpProviderHTTPResponse {
        var value = URLRequest(url: request.url); value.httpMethod = "GET"; value.timeoutInterval = 20; request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) };
        let session = URLSession(configuration: .ephemeral, delegate: MailchimpNoRedirect(), delegateQueue: nil), semaphore = DispatchSemaphore(value: 0); var data: Data?, response: HTTPURLResponse?, failure: Error?;
        let task = session.dataTask(with: value) {
            data = $0; response = $1 as? HTTPURLResponse; failure = $2; semaphore.signal()
        }; task.resume(); if semaphore.wait(timeout: .now() + 20) == .timedOut { task.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "mailchimp_http_timeout", message: "Mailchimp Marketing API request timed out.") }; session.invalidateAndCancel(); if let failure { throw failure };
        return MailchimpProviderHTTPResponse(statusCode: response?.statusCode ?? 0, body: data ?? Data())
    }
}
public struct MailchimpProviderActionClientResult:Sendable{public let result:JSONRecord;public init(result:JSONRecord){self.result=result}}
public protocol MailchimpProviderActionClient:Sendable{func executeMailchimpAction(request:MarketplaceProviderActionAdapterRequest)throws->MailchimpProviderActionClientResult}
public struct FakeMailchimpProviderActionClient: MailchimpProviderActionClient {
    public init() {};
    public func executeMailchimpAction(request: MarketplaceProviderActionAdapterRequest) throws -> MailchimpProviderActionClientResult {
        switch request.definition.actionKey {
        case "mailchimp_account_get": return output(["semanticReadContract": .string("mailchimp-account-get-v1"), "account": .object(MailchimpSupport.fakeAccount())]);
        case "mailchimp_audience_list": return output(["semanticReadContract": .string("mailchimp-audience-list-v1"), "audiences": .array([.object(MailchimpSupport.fakeAudience())])]);
        case "mailchimp_campaign_list_recent_sent": return output(["semanticReadContract": .string("mailchimp-campaign-list-recent-sent-v1"), "campaigns": .array([.object(MailchimpSupport.fakeCampaign())])]);
        default: throw MarketplaceProviderActionAdapterFailure(code: "mailchimp_fake_action_not_supported", message: "Unsupported Mailchimp action.")
        }
    };
    private func output(_ fields: JSONRecord) -> MailchimpProviderActionClientResult {
        MailchimpProviderActionClientResult(result: ["provider": .string("mailchimp"), "adapterBoundary": .string("mailchimp-provider-action-adapter"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("contact-and-content-excluded")].merging(fields) { _, new in new })
    }
}
public final class LiveMailchimpProviderActionClient:MailchimpProviderActionClient,@unchecked Sendable{
 private let data:LocalDataService;private let secrets:SecretService;private let http:any MailchimpProviderHTTPClient
 public init(data:LocalDataService,secrets:SecretService,httpClient:any MailchimpProviderHTTPClient=URLSessionMailchimpProviderHTTPClient()){self.data=data;self.secrets=secrets;self.http=httpClient}
    public func executeMailchimpAction(request: MarketplaceProviderActionAdapterRequest) throws -> MailchimpProviderActionClientResult {
        let auth = try authorization(request);
        switch request.definition.actionKey {
        case "mailchimp_account_get":
            let root = try get(auth, path: "/3.0/", query: [URLQueryItem(name: "fields", value: "account_id,account_name,role,member_since")]); return output(["semanticReadContract": .string("mailchimp-account-get-v1"), "account": .object(MailchimpSupport.account(root))]);
        case "mailchimp_audience_list":
            let
                root = try get(
                    auth, path: "/3.0/lists",
                    query: [
                        URLQueryItem(name: "count", value: "25"), URLQueryItem(name: "offset", value: "0"), URLQueryItem(name: "sort_field", value: "date_created"), URLQueryItem(name: "sort_dir", value: "DESC"),
                        URLQueryItem(name: "fields", value: "lists.id,lists.name,lists.date_created,lists.stats.member_count,lists.stats.unsubscribe_count,total_items"),
                    ]), values = (root.mcObject?["lists"]?.mcArray ?? []).prefix(25).map { JSONValue.object(MailchimpSupport.audience($0)) }
            ; return output(["semanticReadContract": .string("mailchimp-audience-list-v1"), "audiences": .array(Array(values))]);
        case "mailchimp_campaign_list_recent_sent":
            let
                root = try get(
                    auth, path: "/3.0/campaigns",
                    query: [
                        URLQueryItem(name: "count", value: "25"), URLQueryItem(name: "offset", value: "0"), URLQueryItem(name: "status", value: "sent"), URLQueryItem(name: "sort_field", value: "send_time"), URLQueryItem(name: "sort_dir", value: "DESC"),
                        URLQueryItem(name: "fields", value: "campaigns.id,campaigns.type,campaigns.status,campaigns.create_time,campaigns.send_time,total_items"),
                    ]), values = (root.mcObject?["campaigns"]?.mcArray ?? []).prefix(25).map { JSONValue.object(MailchimpSupport.campaign($0)) }
            ; return output(["semanticReadContract": .string("mailchimp-campaign-list-recent-sent-v1"), "campaigns": .array(Array(values))]);
        default: throw MarketplaceProviderActionAdapterFailure(code: "mailchimp_live_action_not_supported", message: "Unsupported live Mailchimp action.")
        }
    }
    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> (String, String) {
        guard let id = request.auditIdentity.connectionId, let c = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), c.appSlug == "mailchimp", c.grantedScopes.isEmpty, let origin = c.health.diagnostics["apiOrigin"]?.string,
            MailchimpSupport.safeOrigin(origin), let ref = c.credentialRequirements.first(where: { $0.fieldKey == "mailchimp_oauth_access_token" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "mailchimp_connection_not_ready", message: "Mailchimp exact account and OAuth metadata data-center are not ready.") }; return (try secrets.getSecretValue(ref), origin)
    }
    private func get(_ auth: (String, String), path: String, query: [URLQueryItem]) throws -> JSONValue {
        var components = URLComponents(string: auth.1 + path)!; components.queryItems = query;
        let response = try http.send(MailchimpProviderHTTPRequest(url: components.url!, headers: ["Authorization": "Bearer " + auth.0, "Accept": "application/json"])), value = (try? JSONSerialization.jsonObject(with: response.body)).map(MailchimpSupport.json) ?? .null;
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: response.statusCode == 429 ? "mailchimp_rate_limited" : response.statusCode == 401 ? "mailchimp_token_invalid_or_revoked" : response.statusCode == 403 ? "mailchimp_role_or_plan_forbidden" : "mailchimp_api_error", message: "Mailchimp Marketing API request failed.",
                providerStatusCode: response.statusCode)
        }; return value
    }
    private func output(_ fields: JSONRecord) -> MailchimpProviderActionClientResult {
        MailchimpProviderActionClientResult(result: ["provider": .string("mailchimp"), "adapterBoundary": .string("mailchimp-provider-action-adapter"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("contact-and-content-excluded")].merging(fields) { _, new in new })
    }
}
public struct MailchimpProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = ["mailchimp_account_get", "mailchimp_audience_list", "mailchimp_campaign_list_recent_sent"]; private let client: any MailchimpProviderActionClient;
    public init(client: any MailchimpProviderActionClient = FakeMailchimpProviderActionClient()) { self.client = client };
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "mailchimp", Self.allowed.contains(request.definition.actionKey) else { throw MarketplaceProviderActionAdapterFailure(code: "mailchimp_action_not_allowlisted", message: "Mailchimp action is outside bounded metadata-only V1.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executeMailchimpAction(request: request).result, error: nil, redactionStatus: "contact-and-content-excluded")
    }
}
enum MailchimpSupport {
    static func safeOrigin(_ raw: String) -> Bool {
        guard let u = URL(string: raw), u.scheme == "https", u.user == nil, u.password == nil, u.port == nil, (u.path.isEmpty || u.path == "/"), u.query == nil, u.fragment == nil, let host = u.host else { return false }; let suffix = ".api.mailchimp.com";
        guard host.hasSuffix(suffix) else { return false }; let dc = String(host.dropLast(suffix.count)); return !dc.isEmpty && dc.count <= 20 && dc.allSatisfy { $0.isLetter || $0.isNumber || $0 == "-" }
    }; static func account(_ v: JSONValue) -> JSONRecord { let o = v.mcObject ?? [:]; return ["AccountId": scalar(o["account_id"]), "AccountName": scalar(o["account_name"]), "Role": scalar(o["role"]), "MemberSince": scalar(o["member_since"])] };
    static func audience(_ v: JSONValue) -> JSONRecord {
        let o = v.mcObject ?? [:], s = o["stats"]?.mcObject ?? [:]; return ["AudienceId": scalar(o["id"]), "Name": scalar(o["name"]), "DateCreated": scalar(o["date_created"]), "MemberCount": scalar(s["member_count"]), "UnsubscribeCount": scalar(s["unsubscribe_count"])]
    }; static func campaign(_ v: JSONValue) -> JSONRecord { let o = v.mcObject ?? [:]; return ["CampaignId": scalar(o["id"]), "Type": scalar(o["type"]), "Status": scalar(o["status"]), "CreateTime": scalar(o["create_time"]), "SendTime": scalar(o["send_time"])] };
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
    }; static func fakeAccount() -> JSONRecord { ["AccountId": .string("acct_123"), "AccountName": .string("Relay Marketing"), "Role": .string("admin"), "MemberSince": .string("2024-01-01T00:00:00Z")] };
    static func fakeAudience() -> JSONRecord { ["AudienceId": .string("list_123"), "Name": .string("Product updates"), "DateCreated": .string("2025-01-01T00:00:00Z"), "MemberCount": .number(250), "UnsubscribeCount": .number(4)] };
    static func fakeCampaign() -> JSONRecord { ["CampaignId": .string("cmp_123"), "Type": .string("regular"), "Status": .string("sent"), "CreateTime": .string("2026-07-10T08:00:00Z"), "SendTime": .string("2026-07-11T09:00:00Z")] }
}
private extension JSONValue{var mcObject:JSONRecord?{if case .object(let v)=self{return v};return nil};var mcArray:[JSONValue]?{if case .array(let v)=self{return v};return nil}}
