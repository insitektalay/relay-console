import Foundation

public struct FilloutProviderHTTPRequest:Sendable{public let url:URL;public let headers:[String:String];public init(url:URL,headers:[String:String]){self.url=url;self.headers=headers}}
public struct FilloutProviderHTTPResponse:Sendable{public let statusCode:Int;public let body:Data;public init(statusCode:Int,body:Data=Data()){self.statusCode=statusCode;self.body=body}}
public protocol FilloutProviderHTTPClient:Sendable{func send(_ request:FilloutProviderHTTPRequest)throws->FilloutProviderHTTPResponse}
private final class FilloutNoRedirect: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}
public struct URLSessionFilloutProviderHTTPClient: FilloutProviderHTTPClient {
    public init() {};
    public func send(_ request: FilloutProviderHTTPRequest) throws -> FilloutProviderHTTPResponse {
        var value = URLRequest(url: request.url); value.httpMethod = "GET"; value.timeoutInterval = 20; request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) };
        let session = URLSession(configuration: .ephemeral, delegate: FilloutNoRedirect(), delegateQueue: nil), semaphore = DispatchSemaphore(value: 0); var data: Data?, response: HTTPURLResponse?, failure: Error?;
        let task = session.dataTask(with: value) {
            data = $0; response = $1 as? HTTPURLResponse; failure = $2; semaphore.signal()
        }; task.resume(); if semaphore.wait(timeout: .now() + 20) == .timedOut { task.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "fillout_http_timeout", message: "Fillout REST API request timed out.") }; session.invalidateAndCancel(); if let failure { throw failure };
        return FilloutProviderHTTPResponse(statusCode: response?.statusCode ?? 0, body: data ?? Data())
    }
}
public struct FilloutProviderActionClientResult:Sendable{public let result:JSONRecord;public init(result:JSONRecord){self.result=result}}
public protocol FilloutProviderActionClient:Sendable{func executeFilloutAction(request:MarketplaceProviderActionAdapterRequest)throws->FilloutProviderActionClientResult}
public struct FakeFilloutProviderActionClient: FilloutProviderActionClient {
    public init() {};
    public func executeFilloutAction(request: MarketplaceProviderActionAdapterRequest) throws -> FilloutProviderActionClientResult {
        switch request.definition.actionKey {
        case "fillout_form_list": return output(["semanticReadContract": .string("fillout-form-list-v1"), "forms": .array([.object(["FormId": .string("form_abc123"), "Name": .string("Customer intake")])])]);
        case "fillout_form_get_metadata_summary": return output(["semanticReadContract": .string("fillout-form-metadata-summary-v1"), "form": .object(FilloutSupport.fakeForm())]);
        case "fillout_submission_list_recent": return output(["semanticReadContract": .string("fillout-submission-list-recent-v1"), "submissions": .array([.object(FilloutSupport.fakeSubmission())])]);
        default: throw MarketplaceProviderActionAdapterFailure(code: "fillout_fake_action_not_supported", message: "Unsupported Fillout action.")
        }
    };
    private func output(_ fields: JSONRecord) -> FilloutProviderActionClientResult {
        FilloutProviderActionClientResult(result: ["provider": .string("fillout"), "adapterBoundary": .string("fillout-provider-action-adapter"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("submission-content-excluded")].merging(fields) { _, new in new })
    }
}
public final class LiveFilloutProviderActionClient:FilloutProviderActionClient,@unchecked Sendable{
 private let data:LocalDataService;private let secrets:SecretService;private let http:any FilloutProviderHTTPClient
 public init(data:LocalDataService,secrets:SecretService,httpClient:any FilloutProviderHTTPClient=URLSessionFilloutProviderHTTPClient()){self.data=data;self.secrets=secrets;self.http=httpClient}
    public func executeFilloutAction(request: MarketplaceProviderActionAdapterRequest) throws -> FilloutProviderActionClientResult {
        let auth = try authorization(request);
        switch request.definition.actionKey {
        case "fillout_form_list": let root = try get(auth, path: "/v1/api/forms", query: []), values = (root.foArray ?? []).prefix(25).map { JSONValue.object(FilloutSupport.formList($0)) }; return output(["semanticReadContract": .string("fillout-form-list-v1"), "forms": .array(Array(values))]);
        case "fillout_form_get_metadata_summary":
            let id = try FilloutSupport.id(request.payload["formId"]), root = try get(auth, path: "/v1/api/forms/" + id, query: []); return output(["semanticReadContract": .string("fillout-form-metadata-summary-v1"), "form": .object(FilloutSupport.formMetadata(root))]);
        case "fillout_submission_list_recent":
            let id = try FilloutSupport.id(request.payload["formId"]),
                root = try get(
                    auth, path: "/v1/api/forms/" + id + "/submissions",
                    query: [
                        URLQueryItem(name: "limit", value: "25"), URLQueryItem(name: "offset", value: "0"), URLQueryItem(name: "status", value: "finished"), URLQueryItem(name: "includeEditLink", value: "false"), URLQueryItem(name: "includePreview", value: "false"),
                        URLQueryItem(name: "sort", value: "desc"),
                    ]), values = (root.foObject?["responses"]?.foArray ?? []).prefix(25).map { JSONValue.object(FilloutSupport.submission($0)) }
            ; return output(["semanticReadContract": .string("fillout-submission-list-recent-v1"), "submissions": .array(Array(values))]);
        default: throw MarketplaceProviderActionAdapterFailure(code: "fillout_live_action_not_supported", message: "Unsupported live Fillout action.")
        }
    }
    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> (String, String) {
        guard let id = request.auditIdentity.connectionId, let c = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), c.appSlug == "fillout", c.grantedScopes.isEmpty, let origin = c.health.diagnostics["baseURL"]?.string,
            FilloutSupport.origins.contains(origin), let ref = c.credentialRequirements.first(where: { $0.fieldKey == "fillout_oauth_access_token" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "fillout_connection_not_ready", message: "Fillout OAuth grant and provider-returned official API base URL are not ready.") }; return (try secrets.getSecretValue(ref), origin)
    }
    private func get(_ auth: (String, String), path: String, query: [URLQueryItem]) throws -> JSONValue {
        var components = URLComponents(string: auth.1 + path)!; components.queryItems = query.isEmpty ? nil : query;
        let response = try http.send(FilloutProviderHTTPRequest(url: components.url!, headers: ["Authorization": "Bearer " + auth.0, "Accept": "application/json"])), value = (try? JSONSerialization.jsonObject(with: response.body)).map(FilloutSupport.json) ?? .null;
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(code: response.statusCode == 429 ? "fillout_rate_limited" : response.statusCode == 401 ? "fillout_token_invalid_or_revoked" : "fillout_api_error", message: "Fillout REST API request failed.", providerStatusCode: response.statusCode)
        }; return value
    }
    private func output(_ fields: JSONRecord) -> FilloutProviderActionClientResult {
        FilloutProviderActionClientResult(result: ["provider": .string("fillout"), "adapterBoundary": .string("fillout-provider-action-adapter"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("submission-content-excluded")].merging(fields) { _, new in new })
    }
}
public struct FilloutProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = ["fillout_form_list", "fillout_form_get_metadata_summary", "fillout_submission_list_recent"]; private let client: any FilloutProviderActionClient;
    public init(client: any FilloutProviderActionClient = FakeFilloutProviderActionClient()) { self.client = client };
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "fillout", Self.allowed.contains(request.definition.actionKey) else { throw MarketplaceProviderActionAdapterFailure(code: "fillout_action_not_allowlisted", message: "Fillout action is outside bounded metadata-only V1.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executeFilloutAction(request: request).result, error: nil, redactionStatus: "submission-content-excluded")
    }
}
enum FilloutSupport {
    static let origins: Set<String> = ["https://api.fillout.com", "https://eu-api.fillout.com"];
    static func id(_ value: JSONValue?) throws -> String {
        guard let raw = value?.string, !raw.isEmpty, raw.count <= 128, raw.allSatisfy({ $0.isLetter || $0.isNumber || $0 == "_" || $0 == "-" }) else {
            throw MarketplaceProviderActionAdapterFailure(code: "fillout_form_identifier_invalid", message: "An exact bounded URL-safe Fillout Form ID is required.")
        }; return raw
    }; static func formList(_ value: JSONValue) -> JSONRecord { let o = value.foObject ?? [:]; return ["FormId": scalar(o["formId"]), "Name": scalar(o["name"])] };
    static func formMetadata(_ value: JSONValue) -> JSONRecord {
        let o = value.foObject ?? [:];
        return [
            "FormId": scalar(o["id"]), "Name": scalar(o["name"]), "QuestionCount": count(o["questions"]), "CalculationCount": count(o["calculations"]), "URLParameterCount": count(o["urlParameters"]), "SchedulingFieldCount": count(o["scheduling"]), "PaymentFieldCount": count(o["payments"]),
            "QuizEnabled": o["quiz"]?.foObject?["enabled"] ?? .bool(false),
        ]
    }; static func submission(_ value: JSONValue) -> JSONRecord { let o = value.foObject ?? [:]; return ["SubmissionId": scalar(o["submissionId"]), "SubmissionTime": scalar(o["submissionTime"]), "LastUpdatedAt": scalar(o["lastUpdatedAt"])] };
    static func count(_ value: JSONValue?) -> JSONValue { .number(Double(value?.foArray?.count ?? 0)) };
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
    static func fakeForm() -> JSONRecord {
        ["FormId": .string("form_abc123"), "Name": .string("Customer intake"), "QuestionCount": .number(8), "CalculationCount": .number(1), "URLParameterCount": .number(2), "SchedulingFieldCount": .number(0), "PaymentFieldCount": .number(0), "QuizEnabled": .bool(false)]
    }; static func fakeSubmission() -> JSONRecord { ["SubmissionId": .string("sub_987654"), "SubmissionTime": .string("2026-07-11T09:00:00Z"), "LastUpdatedAt": .string("2026-07-11T09:01:00Z")] }
}
private extension JSONValue{var foObject:JSONRecord?{if case .object(let v)=self{return v};return nil};var foArray:[JSONValue]?{if case .array(let v)=self{return v};return nil}}
