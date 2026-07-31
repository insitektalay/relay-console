import Foundation

public struct SurveyMonkeyProviderHTTPRequest:Sendable{public let url:URL;public let headers:[String:String];public init(url:URL,headers:[String:String]){self.url=url;self.headers=headers}}
public struct SurveyMonkeyProviderHTTPResponse:Sendable{public let statusCode:Int;public let body:Data;public init(statusCode:Int,body:Data=Data()){self.statusCode=statusCode;self.body=body}}
public protocol SurveyMonkeyProviderHTTPClient:Sendable{func send(_ request:SurveyMonkeyProviderHTTPRequest)throws->SurveyMonkeyProviderHTTPResponse}
private final class SurveyMonkeyNoRedirect: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}
public struct URLSessionSurveyMonkeyProviderHTTPClient: SurveyMonkeyProviderHTTPClient {
    public init() {};
    public func send(_ request: SurveyMonkeyProviderHTTPRequest) throws -> SurveyMonkeyProviderHTTPResponse {
        var value = URLRequest(url: request.url); value.httpMethod = "GET"; value.timeoutInterval = 20; request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) };
        let session = URLSession(configuration: .ephemeral, delegate: SurveyMonkeyNoRedirect(), delegateQueue: nil), semaphore = DispatchSemaphore(value: 0); var data: Data?, response: HTTPURLResponse?, failure: Error?;
        let task = session.dataTask(with: value) {
            data = $0; response = $1 as? HTTPURLResponse; failure = $2; semaphore.signal()
        }; task.resume(); if semaphore.wait(timeout: .now() + 20) == .timedOut { task.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "surveymonkey_http_timeout", message: "SurveyMonkey API v3 request timed out.") }; session.invalidateAndCancel(); if let failure { throw failure };
        return SurveyMonkeyProviderHTTPResponse(statusCode: response?.statusCode ?? 0, body: data ?? Data())
    }
}
public struct SurveyMonkeyProviderActionClientResult:Sendable{public let result:JSONRecord;public init(result:JSONRecord){self.result=result}}
public protocol SurveyMonkeyProviderActionClient:Sendable{func executeSurveyMonkeyAction(request:MarketplaceProviderActionAdapterRequest)throws->SurveyMonkeyProviderActionClientResult}
public struct FakeSurveyMonkeyProviderActionClient: SurveyMonkeyProviderActionClient {
    public init() {};
    public func executeSurveyMonkeyAction(request: MarketplaceProviderActionAdapterRequest) throws -> SurveyMonkeyProviderActionClientResult {
        switch request.definition.actionKey {
        case "surveymonkey_survey_list_recent": return output(["semanticReadContract": .string("surveymonkey-survey-list-recent-v1"), "surveys": .array([.object(SurveyMonkeySupport.fakeSurvey())])]);
        case "surveymonkey_response_list": return output(["semanticReadContract": .string("surveymonkey-response-list-v1"), "responses": .array([.object(["ResponseId": .string("987654321")])])]);
        case "surveymonkey_response_get": return output(["semanticReadContract": .string("surveymonkey-response-get-v1"), "response": .object(SurveyMonkeySupport.fakeResponse())]);
        default: throw MarketplaceProviderActionAdapterFailure(code: "surveymonkey_fake_action_not_supported", message: "Unsupported SurveyMonkey action.")
        }
    };
    private func output(_ fields: JSONRecord) -> SurveyMonkeyProviderActionClientResult {
        SurveyMonkeyProviderActionClientResult(result: ["provider": .string("surveymonkey"), "adapterBoundary": .string("surveymonkey-provider-action-adapter"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("response-content-excluded")].merging(fields) { _, new in new })
    }
}
public final class LiveSurveyMonkeyProviderActionClient:SurveyMonkeyProviderActionClient,@unchecked Sendable{
 private let data:LocalDataService;private let secrets:SecretService;private let http:any SurveyMonkeyProviderHTTPClient
 public init(data:LocalDataService,secrets:SecretService,httpClient:any SurveyMonkeyProviderHTTPClient=URLSessionSurveyMonkeyProviderHTTPClient()){self.data=data;self.secrets=secrets;self.http=httpClient}
    public func executeSurveyMonkeyAction(request: MarketplaceProviderActionAdapterRequest) throws -> SurveyMonkeyProviderActionClientResult {
        let auth = try authorization(request);
        switch request.definition.actionKey {
        case "surveymonkey_survey_list_recent":
            let
                root = try get(
                    auth, path: "/v3/surveys",
                    query: [
                        URLQueryItem(name: "page", value: "1"), URLQueryItem(name: "per_page", value: "25"), URLQueryItem(name: "sort_by", value: "date_modified"), URLQueryItem(name: "sort_order", value: "DESC"),
                        URLQueryItem(name: "include", value: "response_count,date_created,date_modified,language"),
                    ]), values = (root.smObject?["data"]?.smArray ?? []).prefix(25).map { JSONValue.object(SurveyMonkeySupport.survey($0)) }
            ; return output(["semanticReadContract": .string("surveymonkey-survey-list-recent-v1"), "surveys": .array(Array(values))]);
        case "surveymonkey_response_list":
            let survey = try SurveyMonkeySupport.id(request.payload["surveyId"], field: "Survey ID"), root = try get(auth, path: "/v3/surveys/" + survey + "/responses", query: [URLQueryItem(name: "page", value: "1"), URLQueryItem(name: "per_page", value: "25")]),
                values = (root.smObject?["data"]?.smArray ?? []).prefix(25).map { JSONValue.object(["ResponseId": SurveyMonkeySupport.scalar($0.smObject?["id"])]) }
            ; return output(["semanticReadContract": .string("surveymonkey-response-list-v1"), "responses": .array(Array(values))]);
        case "surveymonkey_response_get":
            let survey = try SurveyMonkeySupport.id(request.payload["surveyId"], field: "Survey ID"), response = try SurveyMonkeySupport.id(request.payload["responseId"], field: "Response ID"), root = try get(auth, path: "/v3/surveys/" + survey + "/responses/" + response, query: []);
            return output(["semanticReadContract": .string("surveymonkey-response-get-v1"), "response": .object(SurveyMonkeySupport.response(root))]);
        default: throw MarketplaceProviderActionAdapterFailure(code: "surveymonkey_live_action_not_supported", message: "Unsupported live SurveyMonkey action.")
        }
    }
    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> (String, String) {
        guard let id = request.auditIdentity.connectionId, let c = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), c.appSlug == "surveymonkey", c.grantedScopes == ProviderConnectionService.surveyMonkeyRelayOwnedOAuthScopes,
            let user = c.health.diagnostics["userId"]?.string, SurveyMonkeySupport.safe(user), let origin = c.health.diagnostics["accessURL"]?.string, SurveyMonkeySupport.origins.contains(origin),
            let ref = c.credentialRequirements.first(where: { $0.fieldKey == "surveymonkey_oauth_access_token" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "surveymonkey_connection_not_ready", message: "SurveyMonkey exact user and provider-returned regional origin are not ready.") }; return (try secrets.getSecretValue(ref), origin)
    }
    private func get(_ auth: (String, String), path: String, query: [URLQueryItem]) throws -> JSONValue {
        var components = URLComponents(string: auth.1 + path)!; components.queryItems = query.isEmpty ? nil : query;
        let response = try http.send(SurveyMonkeyProviderHTTPRequest(url: components.url!, headers: ["Authorization": "Bearer " + auth.0, "Accept": "application/json"])), value = (try? JSONSerialization.jsonObject(with: response.body)).map(SurveyMonkeySupport.json) ?? .null;
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: response.statusCode == 429 ? "surveymonkey_rate_limited" : response.statusCode == 401 ? "surveymonkey_token_revoked_or_invalid" : "surveymonkey_api_error", message: "SurveyMonkey API v3 request failed.", providerStatusCode: response.statusCode)
        }; return value
    }
    private func output(_ fields: JSONRecord) -> SurveyMonkeyProviderActionClientResult {
        SurveyMonkeyProviderActionClientResult(result: ["provider": .string("surveymonkey"), "adapterBoundary": .string("surveymonkey-provider-action-adapter"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("response-content-excluded")].merging(fields) { _, new in new })
    }
}
public struct SurveyMonkeyProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = ["surveymonkey_survey_list_recent", "surveymonkey_response_list", "surveymonkey_response_get"]; private let client: any SurveyMonkeyProviderActionClient;
    public init(client: any SurveyMonkeyProviderActionClient = FakeSurveyMonkeyProviderActionClient()) { self.client = client };
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "surveymonkey", Self.allowed.contains(request.definition.actionKey) else { throw MarketplaceProviderActionAdapterFailure(code: "surveymonkey_action_not_allowlisted", message: "SurveyMonkey action is outside bounded metadata-only V1.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executeSurveyMonkeyAction(request: request).result, error: nil, redactionStatus: "response-content-excluded")
    }
}
enum SurveyMonkeySupport {
    static let origins: Set<String> = ["https://api.surveymonkey.com", "https://api.eu.surveymonkey.com", "https://api.surveymonkey.ca"];
    static func id(_ value: JSONValue?, field: String) throws -> String { guard let raw = value?.string, safe(raw) else { throw MarketplaceProviderActionAdapterFailure(code: "surveymonkey_identifier_invalid", message: "An exact positive decimal SurveyMonkey \(field) is required.") }; return raw };
    static func safe(_ raw: String) -> Bool { !raw.isEmpty && raw.count <= 32 && raw.allSatisfy(\.isNumber) && raw.contains(where: { $0 != "0" }) };
    static func survey(_ value: JSONValue) -> JSONRecord {
        let o = value.smObject ?? [:];
        return ["SurveyId": scalar(o["id"]), "Title": scalar(o["title"]), "Nickname": scalar(o["nickname"]), "Language": scalar(o["language"]), "ResponseCount": scalar(o["response_count"]), "DateCreated": scalar(o["date_created"]), "DateModified": scalar(o["date_modified"])]
    }; static func response(_ value: JSONValue) -> JSONRecord { let o = value.smObject ?? [:]; return ["ResponseId": scalar(o["id"]), "Status": scalar(o["response_status"]), "DateCreated": scalar(o["date_created"]), "DateModified": scalar(o["date_modified"])] };
    static func scalar(_ value: JSONValue?) -> JSONValue {
        guard let value else { return .null };
        switch value {
        case .string, .number, .bool, .null: return value;
        default: return .null
        }
    };
    static func json(_ any: Any) -> JSONValue {
        if any is NSNull { return .null }; if let v = any as? Bool { return .bool(v) }; if let v = any as? String { return .string(v) }; if let v = any as? NSNumber { return .number(v.doubleValue) }; if let v = any as? [Any] { return .array(v.map(json)) };
        if let v = any as? [String: Any] { return .object(v.mapValues(json)) }; return .null
    };
    static func fakeSurvey() -> JSONRecord {
        ["SurveyId": .string("123456789"), "Title": .string("Customer feedback"), "Nickname": .string("Q3 feedback"), "Language": .string("en"), "ResponseCount": .number(42), "DateCreated": .string("2026-07-01T09:00:00Z"), "DateModified": .string("2026-07-11T09:00:00Z")]
    }; static func fakeResponse() -> JSONRecord { ["ResponseId": .string("987654321"), "Status": .string("completed"), "DateCreated": .string("2026-07-11T08:59:00Z"), "DateModified": .string("2026-07-11T09:00:00Z")] }
}
private extension JSONValue{var smObject:JSONRecord?{if case .object(let v)=self{return v};return nil};var smArray:[JSONValue]?{if case .array(let v)=self{return v};return nil}}
