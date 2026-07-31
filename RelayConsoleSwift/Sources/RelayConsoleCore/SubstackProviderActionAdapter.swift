import Foundation

public struct SubstackProviderHTTPRequest: Sendable { public let url:URL;public let headers:[String:String];public init(url:URL,headers:[String:String]){self.url=url;self.headers=headers} }
public struct SubstackProviderHTTPResponse: Sendable { public let statusCode:Int;public let body:Data;public init(statusCode:Int,body:Data=Data()){self.statusCode=statusCode;self.body=body} }
public protocol SubstackProviderHTTPClient: Sendable { func send(_ request:SubstackProviderHTTPRequest)throws->SubstackProviderHTTPResponse }
private final class SubstackNoRedirectDelegate: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}
public struct URLSessionSubstackProviderHTTPClient: SubstackProviderHTTPClient {
    public init() {};
    public func send(_ request: SubstackProviderHTTPRequest) throws -> SubstackProviderHTTPResponse {
        var value = URLRequest(url: request.url); value.httpMethod = "GET"; value.timeoutInterval = 20; request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) };
        let session = URLSession(configuration: .ephemeral, delegate: SubstackNoRedirectDelegate(), delegateQueue: nil), semaphore = DispatchSemaphore(value: 0); var data: Data?, response: HTTPURLResponse?, failure: Error?;
        let task = session.dataTask(with: value) {
            data = $0; response = $1 as? HTTPURLResponse; failure = $2; semaphore.signal()
        }; task.resume(); if semaphore.wait(timeout: .now() + 20) == .timedOut { task.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "substack_http_timeout", message: "Substack API request timed out.") }; session.invalidateAndCancel(); if let failure { throw failure };
        return SubstackProviderHTTPResponse(statusCode: response?.statusCode ?? 0, body: data ?? Data())
    }
}

public struct SubstackProviderActionClientResult:Sendable{public let result:JSONRecord;public init(result:JSONRecord){self.result=result}}
public protocol SubstackProviderActionClient:Sendable{func executeSubstackAction(request:MarketplaceProviderActionAdapterRequest)throws->SubstackProviderActionClientResult}
public struct FakeSubstackProviderActionClient: SubstackProviderActionClient {
    public init() {};
    public func executeSubstackAction(request: MarketplaceProviderActionAdapterRequest) throws -> SubstackProviderActionClientResult {
        guard request.definition.actionKey == "substack_profile_search_linkedin" else { throw MarketplaceProviderActionAdapterFailure(code: "substack_fake_action_not_supported", message: "Unsupported Substack action.") };
        return SubstackProviderActionClientResult(result: SubstackSupport.output(handle: "johndoe", results: [.object(SubstackSupport.fakeProfile())], live: false))
    }
}

public final class LiveSubstackProviderActionClient:SubstackProviderActionClient,@unchecked Sendable{
  private let data:LocalDataService;private let secrets:SecretService;private let http:any SubstackProviderHTTPClient
  public init(data:LocalDataService,secrets:SecretService,httpClient:any SubstackProviderHTTPClient=URLSessionSubstackProviderHTTPClient()){self.data=data;self.secrets=secrets;self.http=httpClient}
  public func executeSubstackAction(request:MarketplaceProviderActionAdapterRequest)throws->SubstackProviderActionClientResult{
    guard request.definition.actionKey=="substack_profile_search_linkedin" else{throw MarketplaceProviderActionAdapterFailure(code:"substack_live_action_not_supported",message:"Unsupported Substack action.")}
    let auth=try authorization(request),handle=try SubstackSupport.handle(request.payload["linkedinHandle"])
    let url=URL(string:"https://substack.com/profile/search/linkedin/"+handle.addingPercentEncoding(withAllowedCharacters:.urlPathAllowed)!)!
    let response=try http.send(SubstackProviderHTTPRequest(url:url,headers:["Authorization":"Bearer "+auth,"Accept":"application/json"]))
    guard response.body.count<=1_000_000 else{throw MarketplaceProviderActionAdapterFailure(code:"substack_response_too_large",message:"Substack response exceeded 1 MB.")}
    let value=(try? JSONSerialization.jsonObject(with:response.body)).map(SubstackSupport.json) ?? .null
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: response.statusCode == 401 ? "substack_token_invalid" : response.statusCode == 403 ? "substack_access_not_approved" : response.statusCode == 429 ? "substack_rate_limited" : "substack_api_error", message: "Substack Developer API request failed.",
                providerStatusCode: response.statusCode)
        }
    let results=(value.substackObject?["results"]?.substackArray ?? []).prefix(10).map{JSONValue.object(SubstackSupport.profile($0))}
    return SubstackProviderActionClientResult(result:SubstackSupport.output(handle:handle,results:Array(results),live:true))
  }
    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> String {
        guard let id = request.auditIdentity.connectionId, let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), connection.appSlug == "substack", connection.health.diagnostics["apiOrigin"]?.string == "https://substack.com",
            let reference = connection.credentialRequirements.first(where: { $0.fieldKey == "substack_api_token" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "substack_connection_not_ready", message: "Substack Developer API token connection is not ready.") }; return try secrets.getSecretValue(reference)
    }
}

public struct SubstackProviderActionAdapter: MarketplaceProviderActionAdapter {
    private let client: any SubstackProviderActionClient; public init(client: any SubstackProviderActionClient = FakeSubstackProviderActionClient()) { self.client = client };
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "substack", request.definition.actionKey == "substack_profile_search_linkedin" else {
            throw MarketplaceProviderActionAdapterFailure(code: "substack_action_not_allowlisted", message: "Substack action is outside the single documented public Developer API endpoint.")
        }; return MarketplaceProviderActionAdapterResult(result: try client.executeSubstackAction(request: request).result, error: nil, redactionStatus: "public-profile-only")
    }
}

enum SubstackSupport{
    static func handle(_ value: JSONValue?) throws -> String {
        guard let text = value?.string, text.range(of: #"^[A-Za-z0-9](?:[A-Za-z0-9-]{0,98}[A-Za-z0-9])?$"#, options: .regularExpression) != nil else { throw MarketplaceProviderActionAdapterFailure(code: "substack_linkedin_handle_invalid", message: "LinkedIn handle is invalid.") }; return text
    }
    static func profile(_ value: JSONValue) -> JSONRecord {
        let object = value.substackObject ?? [:], leaderboard = object["leaderboardStatus"]?.substackObject ?? [:];
        return [
            "IdentityHandle": safe(object["identityHandle"]), "ProfileURL": safeURL(object["profileUrl"]), "LeaderboardRank": safe(leaderboard["rank"]), "PublicationName": safe(leaderboard["publicationName"]), "LeaderboardLabel": safe(leaderboard["label"]),
            "LeaderboardRanking": safe(leaderboard["ranking"]), "BestsellerTier": safe(object["bestsellerTier"]), "RoughFreeSubscribers": safe(object["roughNumFreeSubscribers"]), "FollowerCount": safe(object["followerCount"]),
        ]
    }
    static func output(handle: String, results: [JSONValue], live: Bool) -> JSONRecord {
        [
            "provider": .string("substack"), "adapterBoundary": .string("substack-provider-action-adapter"), "linkedinHandle": .string(handle), "freshness": .string("at-least-daily"), "results": .array(results), "liveCredentialsUsed": .bool(live), "rawProviderToolExposure": .bool(false),
            "redactionStatus": .string("public-profile-only"),
        ]
    }
  static func safe(_ value:JSONValue?)->JSONValue{guard let value else{return.null};switch value{case.string,.number,.bool,.null:return value;default:return.null}}
  static func safeURL(_ value:JSONValue?)->JSONValue{guard let text=value?.string,let url=URL(string:text),url.scheme=="https",url.host=="substack.com" || url.host?.hasSuffix(".substack.com")==true else{return.null};return.string(String(text.prefix(500)))}
    static func json(_ any: Any) -> JSONValue {
        if any is NSNull { return .null }; if let value = any as? Bool { return .bool(value) }; if let value = any as? String { return .string(value) }; if let value = any as? NSNumber { return .number(value.doubleValue) }; if let value = any as? [Any] { return .array(value.map(json)) };
        if let value = any as? [String: Any] { return .object(value.mapValues(json)) }; return .null
    }
    static func fakeProfile() -> JSONRecord {
        [
            "IdentityHandle": .string("writer"), "ProfileURL": .string("https://substack.com/@writer"), "LeaderboardRank": .number(15), "PublicationName": .string("Tech Weekly"), "LeaderboardRanking": .string("paid"), "BestsellerTier": .string("bestseller"), "RoughFreeSubscribers": .number(5000),
            "FollowerCount": .number(1250),
        ]
    }
}
extension JSONValue{fileprivate var substackObject:JSONRecord?{if case.object(let value)=self{return value};return nil};fileprivate var substackArray:[JSONValue]?{if case.array(let value)=self{return value};return nil}}
