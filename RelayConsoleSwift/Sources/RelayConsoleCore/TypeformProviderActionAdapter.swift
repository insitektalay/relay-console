import Foundation

public struct TypeformProviderHTTPRequest: Sendable { public let url: URL; public let headers: [String:String]; public init(url:URL,headers:[String:String]){self.url=url;self.headers=headers} }
public struct TypeformProviderHTTPResponse: Sendable { public let statusCode:Int; public let body:Data; public init(statusCode:Int,body:Data=Data()){self.statusCode=statusCode;self.body=body} }
public protocol TypeformProviderHTTPClient: Sendable { func send(_ request:TypeformProviderHTTPRequest)throws->TypeformProviderHTTPResponse }
private final class TypeformNoRedirectDelegate: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}
public struct URLSessionTypeformProviderHTTPClient: TypeformProviderHTTPClient {
    public init() {};
    public func send(_ request: TypeformProviderHTTPRequest) throws -> TypeformProviderHTTPResponse {
        var value = URLRequest(url: request.url); value.httpMethod = "GET"; value.timeoutInterval = 20; request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) };
        let session = URLSession(configuration: .ephemeral, delegate: TypeformNoRedirectDelegate(), delegateQueue: nil), semaphore = DispatchSemaphore(value: 0); var data: Data?, response: HTTPURLResponse?, failure: Error?;
        let task = session.dataTask(with: value) {
            data = $0; response = $1 as? HTTPURLResponse; failure = $2; semaphore.signal()
        }; task.resume(); if semaphore.wait(timeout: .now() + 20) == .timedOut { task.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "typeform_http_timeout", message: "Typeform API request timed out.") }; session.invalidateAndCancel(); if let failure { throw failure };
        return TypeformProviderHTTPResponse(statusCode: response?.statusCode ?? 0, body: data ?? Data())
    }
}

public struct TypeformProviderActionClientResult:Sendable { public let result:JSONRecord;public init(result:JSONRecord){self.result=result} }
public protocol TypeformProviderActionClient:Sendable { func executeTypeformAction(request:MarketplaceProviderActionAdapterRequest)throws->TypeformProviderActionClientResult }
public struct FakeTypeformProviderActionClient: TypeformProviderActionClient {
    public init() {};
    public func executeTypeformAction(request: MarketplaceProviderActionAdapterRequest) throws -> TypeformProviderActionClientResult {
        switch request.definition.actionKey {
        case "typeform_form_list_recent": return output(["semanticReadContract": .string("typeform-form-list-recent-v1"), "forms": .array([.object(TypeformProviderActionSupport.fakeForm())])]);
        case "typeform_form_get": return output(["semanticReadContract": .string("typeform-form-get-v1"), "form": .object(TypeformProviderActionSupport.fakeForm())]);
        case "typeform_response_list_recent": return output(["semanticReadContract": .string("typeform-response-list-recent-v1"), "responses": .array([.object(TypeformProviderActionSupport.fakeResponse())]), "providerFreshnessCaveatMinutes": .number(30)]);
        default: throw MarketplaceProviderActionAdapterFailure(code: "typeform_fake_action_not_supported", message: "Unsupported Typeform action.")
        }
    };
    private func output(_ fields: JSONRecord) -> TypeformProviderActionClientResult {
        TypeformProviderActionClientResult(
            result: ["provider": .string("typeform"), "adapterBoundary": .string("typeform-provider-action-adapter"), "clientMode": .string("fake-typeform-api"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("respondent-content-excluded")].merging(fields) { _, new in new })
    }
}

public final class LiveTypeformProviderActionClient:TypeformProviderActionClient,@unchecked Sendable {
    private let data:LocalDataService;private let secrets:SecretService;private let http:any TypeformProviderHTTPClient;private let now:@Sendable()->Date
    public init(data:LocalDataService,secrets:SecretService,httpClient:any TypeformProviderHTTPClient=URLSessionTypeformProviderHTTPClient(),now:@escaping @Sendable()->Date={Date()}){self.data=data;self.secrets=secrets;self.http=httpClient;self.now=now}
    public func executeTypeformAction(request: MarketplaceProviderActionAdapterRequest) throws -> TypeformProviderActionClientResult {
        let auth = try authorization(request);
        switch request.definition.actionKey {
        case "typeform_form_list_recent":
            let
                root = try get(
                    auth, path: "/forms",
                    query: [URLQueryItem(name: "workspace_id", value: auth.workspaceId), URLQueryItem(name: "page", value: "1"), URLQueryItem(name: "page_size", value: "25"), URLQueryItem(name: "sort_by", value: "last_updated_at"), URLQueryItem(name: "order_by", value: "desc")]),
                values = (root.typeformObject?["items"]?.typeformArray ?? []).prefix(25).map { JSONValue.object(TypeformProviderActionSupport.form($0, workspaceId: auth.workspaceId)) }
            ; return output(["semanticReadContract": .string("typeform-form-list-recent-v1"), "forms": .array(Array(values))]);
        case "typeform_form_get":
            let id = try TypeformProviderActionSupport.identifier(request.payload["formId"], field: "Form ID"), root = try get(auth, path: "/forms/" + id, query: []);
            return output(["semanticReadContract": .string("typeform-form-get-v1"), "form": .object(TypeformProviderActionSupport.form(root, workspaceId: auth.workspaceId))]);
        case "typeform_response_list_recent":
            let id = try TypeformProviderActionSupport.identifier(request.payload["formId"], field: "Form ID"), root = try get(auth, path: "/forms/" + id + "/responses", query: TypeformProviderActionSupport.responseQuery(now: now())),
                values = (root.typeformObject?["items"]?.typeformArray ?? []).prefix(25).map { JSONValue.object(TypeformProviderActionSupport.response($0)) }
            ; return output(["semanticReadContract": .string("typeform-response-list-recent-v1"), "responses": .array(Array(values)), "providerFreshnessCaveatMinutes": .number(30)]);
        default: throw MarketplaceProviderActionAdapterFailure(code: "typeform_live_action_not_supported", message: "Unsupported live Typeform action.")
        }
    }
    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> (token: String, origin: String, workspaceId: String) {
        guard let id = request.auditIdentity.connectionId, let c = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), c.appSlug == "typeform", c.grantedScopes == ProviderConnectionService.typeformRelayOwnedOAuthScopes,
            let account = c.health.diagnostics["accountId"]?.string, TypeformProviderActionSupport.safe(account), let workspace = c.health.diagnostics["workspaceId"]?.string, TypeformProviderActionSupport.safe(workspace), let origin = c.health.diagnostics["apiOrigin"]?.string,
            TypeformProviderActionSupport.allowedOrigins.contains(origin), let ref = c.credentialRequirements.first(where: { $0.fieldKey == "typeform_oauth_access_token" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "typeform_connection_not_ready", message: "Typeform exact account/workspace/region connection is not ready.") }; return (try secrets.getSecretValue(ref), origin, workspace)
    }
    private func get(_ auth: (token: String, origin: String, workspaceId: String), path: String, query: [URLQueryItem]) throws -> JSONValue {
        var components = URLComponents(string: auth.origin + path)!; components.queryItems = query.isEmpty ? nil : query;
        let response = try http.send(TypeformProviderHTTPRequest(url: components.url!, headers: ["Authorization": "Bearer " + auth.token, "Accept": "application/json"])), value = (try? JSONSerialization.jsonObject(with: response.body)).map(TypeformProviderActionSupport.json) ?? .null;
        guard (200..<300).contains(response.statusCode) else {
            let code =
                response.statusCode == 301 || response.statusCode == 302
                ? "typeform_redirect_blocked"
                : response.statusCode == 401 ? "typeform_token_invalid_or_expired" : response.statusCode == 403 ? "typeform_scope_or_workspace_forbidden" : response.statusCode == 404 ? "typeform_resource_not_found" : response.statusCode == 429 ? "typeform_rate_limited" : "typeform_api_error";
            throw MarketplaceProviderActionAdapterFailure(code: code, message: "Typeform API request failed.", providerStatusCode: response.statusCode)
        }; return value
    }
    private func output(_ fields: JSONRecord) -> TypeformProviderActionClientResult {
        TypeformProviderActionClientResult(
            result: ["provider": .string("typeform"), "adapterBoundary": .string("typeform-provider-action-adapter"), "clientMode": .string("live-typeform-api"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("respondent-content-excluded")].merging(fields) { _, new in new })
    }
}

public struct TypeformProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = ["typeform_form_list_recent", "typeform_form_get", "typeform_response_list_recent"]; private let client: any TypeformProviderActionClient;
    public init(client: any TypeformProviderActionClient = FakeTypeformProviderActionClient()) { self.client = client };
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "typeform", Self.allowed.contains(request.definition.actionKey) else { throw MarketplaceProviderActionAdapterFailure(code: "typeform_action_not_allowlisted", message: "Typeform action is outside bounded read-only V1.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executeTypeformAction(request: request).result, error: nil, redactionStatus: "respondent-content-excluded")
    }
}

enum TypeformProviderActionSupport {
    static let allowedOrigins:Set<String>=["https://api.typeform.com","https://api.eu.typeform.com","https://api.typeform.eu"]
    static func responseQuery(now: Date) -> [URLQueryItem] {
        let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime];
        return [
            URLQueryItem(name: "since", value: f.string(from: now.addingTimeInterval(-14 * 86_400))), URLQueryItem(name: "until", value: f.string(from: now)), URLQueryItem(name: "page_size", value: "25"), URLQueryItem(name: "response_type", value: "completed"),
            URLQueryItem(name: "sort", value: "submitted_at,desc"),
        ]
    }
    static func identifier(_ value:JSONValue?,field:String)throws->String{guard let raw=value?.string,safe(raw)else{throw MarketplaceProviderActionAdapterFailure(code:"typeform_identifier_invalid",message:"An exact safe Typeform \(field) is required.")};return raw}
    static func safe(_ raw:String)->Bool{!raw.isEmpty&&raw.count<=64&&raw.allSatisfy{$0.isLetter||$0.isNumber||$0=="-"||$0=="_"}}
    static func form(_ value: JSONValue, workspaceId: String) -> JSONRecord {
        let o = value.typeformObject ?? [:], settings = o["settings"]?.typeformObject ?? [:];
        return ["FormId": scalar(o["id"]), "Title": scalar(o["title"]), "Language": scalar(o["language"]), "IsPublic": scalar(settings["is_public"]), "CreatedAt": scalar(o["created_at"]), "LastUpdatedAt": scalar(o["last_updated_at"]), "WorkspaceId": .string(workspaceId)]
    }
    static func response(_ value:JSONValue)->JSONRecord{let o=value.typeformObject ?? [:];return["ResponseId":scalar(o["response_id"]),"ResponseType":scalar(o["response_type"]),"LandedAt":scalar(o["landed_at"]),"SubmittedAt":scalar(o["submitted_at"])]}
    static func scalar(_ value:JSONValue?)->JSONValue{guard let value else{return .null};switch value{case .string,.number,.bool,.null:return value;default:return .null}}
    static func json(_ any: Any) -> JSONValue {
        if any is NSNull { return .null }; if let v = any as? Bool { return .bool(v) }; if let v = any as? String { return .string(v) }; if let v = any as? NSNumber { return .number(v.doubleValue) }; if let v = any as? [Any] { return .array(v.map(json)) };
        if let v = any as? [String: Any] { return .object(v.mapValues(json)) }; return .null
    }
    static func fakeForm()->JSONRecord{["FormId":.string("abcDEF123"),"Title":.string("Customer feedback"),"Language":.string("en"),"IsPublic":.bool(true),"CreatedAt":.string("2026-07-01T09:00:00Z"),"LastUpdatedAt":.string("2026-07-11T09:00:00Z"),"WorkspaceId":.string("workspace_456")]}
    static func fakeResponse()->JSONRecord{["ResponseId":.string("response_789"),"ResponseType":.string("completed"),"LandedAt":.string("2026-07-11T08:59:00Z"),"SubmittedAt":.string("2026-07-11T09:00:00Z")]}
}
private extension JSONValue { var typeformObject:JSONRecord?{if case .object(let v)=self{return v};return nil};var typeformArray:[JSONValue]?{if case .array(let v)=self{return v};return nil} }
