import Foundation

public struct MentionProviderHTTPRequest:Sendable{public let url:URL;public let headers:[String:String]}
public struct MentionProviderHTTPResponse:Sendable{public let statusCode:Int;public let body:Data}
public protocol MentionProviderHTTPClient:Sendable{func send(_ request:MentionProviderHTTPRequest)throws->MentionProviderHTTPResponse}
private final class MentionNoRedirect: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}
public struct URLSessionMentionProviderHTTPClient: MentionProviderHTTPClient {
    public init() {};
    public func send(_ request: MentionProviderHTTPRequest) throws -> MentionProviderHTTPResponse {
        var value = URLRequest(url: request.url); value.httpMethod = "GET"; value.timeoutInterval = 20; request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) };
        let session = URLSession(configuration: .ephemeral, delegate: MentionNoRedirect(), delegateQueue: nil), semaphore = DispatchSemaphore(value: 0); var data = Data(), status = 0, failure: Error?;
        let task = session.dataTask(with: value) {
            data = $0 ?? Data(); status = ($1 as? HTTPURLResponse)?.statusCode ?? 0; failure = $2; semaphore.signal()
        }; task.resume(); if semaphore.wait(timeout: .now() + 20) == .timedOut { task.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "mention_http_timeout", message: "Mention request timed out.") }; session.invalidateAndCancel(); if let failure { throw failure };
        return MentionProviderHTTPResponse(statusCode: status, body: data)
    }
}

public protocol MentionProviderActionClient:Sendable{func executeMentionAction(request:MarketplaceProviderActionAdapterRequest)throws->JSONRecord}
public struct FakeMentionProviderActionClient: MentionProviderActionClient {
    public init() {};
    public func executeMentionAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord { ["provider": .string("mention"), "action": .string(request.definition.actionKey), "redactionStatus": .string("identity-and-content-excluded"), "liveCredentialsUsed": .bool(false)] }
}

public final class LiveMentionProviderActionClient:MentionProviderActionClient,@unchecked Sendable{
  private let data:LocalDataService;private let secrets:SecretService;private let http:any MentionProviderHTTPClient
  public init(data:LocalDataService,secrets:SecretService,httpClient:any MentionProviderHTTPClient=URLSessionMentionProviderHTTPClient()){self.data=data;self.secrets=secrets;self.http=httpClient}
    public func executeMentionAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        let auth = try authorization(request), action = request.definition.actionKey, path: String;
        if action == "mention_account_status_get" {
            path = "/api/accounts/" + auth.account
        } else if action == "mention_alert_structure_list" {
            path = "/api/accounts/" + auth.account + "/alerts?limit=25"
        } else {
            throw MarketplaceProviderActionAdapterFailure(code: "mention_action_not_allowlisted", message: "Mention action is not allowlisted.")
        }; let response = try http.send(MentionProviderHTTPRequest(url: URL(string: "https://api.mention.net" + path)!, headers: ["Authorization": "Bearer " + auth.token, "Accept": "application/json", "Accept-Version": "1.19", "User-Agent": "RelayConsole-Mention/1.0"]));
        guard response.body.count <= 1_000_000 else { throw MarketplaceProviderActionAdapterFailure(code: "mention_response_too_large", message: "Mention response exceeded 1 MB.") };
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: response.statusCode == 401 ? "mention_token_invalid" : response.statusCode == 403 || response.statusCode == 404 ? "mention_permission_denied" : response.statusCode == 429 ? "mention_rate_limited" : "mention_api_error", message: "Mention API request failed.",
                providerStatusCode: response.statusCode)
        }; guard let any = try? JSONSerialization.jsonObject(with: response.body) else { throw MarketplaceProviderActionAdapterFailure(code: "mention_response_invalid", message: "Mention returned invalid JSON.") }; let root = Self.json(any);
        return action == "mention_account_status_get" ? Self.accountResult(root, account: auth.account) : Self.alertResult(root, account: auth.account)
    }
    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> (token: String, account: String) {
        guard let id = request.auditIdentity.connectionId, let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), connection.appSlug == "mention", connection.health.diagnostics["apiOrigin"]?.string == "https://api.mention.net",
            let tokenRef = connection.credentialRequirements.first(where: { $0.fieldKey == "mention_access_token" })?.secretReferenceId, let accountRef = connection.credentialRequirements.first(where: { $0.fieldKey == "mention_account_id" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "mention_connection_not_ready", message: "Mention connection is not ready.") }; let token = try secrets.getSecretValue(tokenRef), account = try secrets.getSecretValue(accountRef);
        guard !token.isEmpty, Self.safeId(account) else { throw MarketplaceProviderActionAdapterFailure(code: "mention_credentials_invalid", message: "Mention credential binding is invalid.") }; return (token, account)
    }
    private static func accountResult(_ root: JSONValue, account: String) -> JSONRecord {
        let top = root.mentionObject ?? [:], item = top["account"]?.mentionObject ?? top; return ["accountId": .string(account), "languageCode": safeEnumValue(item["language_code"]), "timezone": safeTimezoneValue(item["timezone"]), "redactionStatus": .string("account-identity-excluded")]
    }
    private static func alertResult(_ root: JSONValue, account: String) -> JSONRecord {
        let source = (root.mentionObject ?? [:])["alerts"]?.mentionArray ?? [];
        let alerts = source.prefix(25).compactMap { value -> JSONValue? in
            let item = value.mentionObject ?? [:], id = item["id"]?.string ?? item["id"]?.number.map { String(Int($0)) }; guard let id, safeId(id) else { return nil }; let query = item["query"]?.mentionObject ?? [:];
            return .object(["alertId": .string(id), "queryType": safeEnumValue(query["type"]), "indexVersion": item["index_version"]?.number.map(JSONValue.number) ?? .null])
        }; return ["accountId": .string(account), "alerts": .array(alerts), "redactionStatus": .string("alert-identity-and-content-excluded")]
    }
    private static func safeId(_ value: String) -> Bool { value.range(of: #"^[A-Za-z0-9_-]{1,128}$"#, options: .regularExpression) != nil };
    private static func safeEnumValue(_ value: JSONValue?) -> JSONValue { guard let text = value?.string, text.range(of: #"^[A-Za-z0-9_-]{1,64}$"#, options: .regularExpression) != nil else { return .null }; return .string(text) };
    private static func safeTimezoneValue(_ value: JSONValue?) -> JSONValue { guard let text = value?.string, text.range(of: #"^[A-Za-z0-9_+./-]{1,64}$"#, options: .regularExpression) != nil else { return .null }; return .string(text) };
    private static func json(_ any: Any) -> JSONValue {
        if any is NSNull { return .null }; if let value = any as? Bool { return .bool(value) }; if let value = any as? String { return .string(value) }; if let value = any as? NSNumber { return .number(value.doubleValue) }; if let value = any as? [Any] { return .array(value.map(json)) };
        if let value = any as? [String: Any] { return .object(value.mapValues(json)) }; return .null
    }
}
public struct MentionProviderActionAdapter: MarketplaceProviderActionAdapter {
    private let client: any MentionProviderActionClient; public init(client: any MentionProviderActionClient = FakeMentionProviderActionClient()) { self.client = client };
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "mention" else { throw MarketplaceProviderActionAdapterFailure(code: "mention_action_not_allowlisted", message: "Mention action is not allowlisted.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executeMentionAction(request: request), error: nil, redactionStatus: "identity-and-content-excluded")
    }
}
extension JSONValue{fileprivate var mentionObject:JSONRecord?{if case.object(let value)=self{return value};return nil};fileprivate var mentionArray:[JSONValue]?{if case.array(let value)=self{return value};return nil}}
