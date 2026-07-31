import Foundation

public struct KhorosProviderHTTPRequest:Sendable{public let url:URL;public let headers:[String:String]}
public struct KhorosProviderHTTPResponse:Sendable{public let statusCode:Int;public let body:Data}
public protocol KhorosProviderHTTPClient:Sendable{func send(_ request:KhorosProviderHTTPRequest)throws->KhorosProviderHTTPResponse}
private final class KhorosNoRedirect:NSObject,URLSessionTaskDelegate,@unchecked Sendable{func urlSession(_ session:URLSession,task:URLSessionTask,willPerformHTTPRedirection response:HTTPURLResponse,newRequest request:URLRequest,completionHandler:@escaping(URLRequest?)->Void){completionHandler(nil)}}
public struct URLSessionKhorosProviderHTTPClient: KhorosProviderHTTPClient {
    public init() {};
    public func send(_ request: KhorosProviderHTTPRequest) throws -> KhorosProviderHTTPResponse {
        var value = URLRequest(url: request.url); value.httpMethod = "GET"; value.timeoutInterval = 20; request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) };
        let session = URLSession(configuration: .ephemeral, delegate: KhorosNoRedirect(), delegateQueue: nil), semaphore = DispatchSemaphore(value: 0); var data = Data(), status = 0, failure: Error?;
        let task = session.dataTask(with: value) {
            data = $0 ?? Data(); status = ($1 as? HTTPURLResponse)?.statusCode ?? 0; failure = $2; semaphore.signal()
        }; task.resume(); if semaphore.wait(timeout: .now() + 20) == .timedOut { task.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "khoros_http_timeout", message: "Khoros request timed out.") }; session.invalidateAndCancel(); if let failure { throw failure };
        return KhorosProviderHTTPResponse(statusCode: status, body: data)
    }
}

public protocol KhorosProviderActionClient:Sendable{func executeKhorosAction(request:MarketplaceProviderActionAdapterRequest)throws->JSONRecord}
public struct FakeKhorosProviderActionClient: KhorosProviderActionClient {
    public init() {};
    public func executeKhorosAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord { ["provider": .string("khoros"), "action": .string(request.definition.actionKey), "redactionStatus": .string("user-and-company-identity-excluded"), "liveCredentialsUsed": .bool(false)] }
}

public final class LiveKhorosProviderActionClient:KhorosProviderActionClient,@unchecked Sendable{
  private let data:LocalDataService;private let secrets:SecretService;private let http:any KhorosProviderHTTPClient
  public init(data:LocalDataService,secrets:SecretService,httpClient:any KhorosProviderHTTPClient=URLSessionKhorosProviderHTTPClient()){self.data=data;self.secrets=secrets;self.http=httpClient}
    public func executeKhorosAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        guard request.definition.actionKey == "khoros_marketing_company_authority_get" else { throw MarketplaceProviderActionAdapterFailure(code: "khoros_action_not_allowlisted", message: "Khoros action is not allowlisted.") };
        let auth = try authorization(request), response = try http.send(KhorosProviderHTTPRequest(url: URL(string: "https://api.spredfast.com/v2/me")!, headers: ["Authorization": "Bearer " + auth.token, "Accept": "application/json", "User-Agent": "RelayConsole-Khoros/1.0"]));
        guard response.body.count <= 1_000_000 else { throw MarketplaceProviderActionAdapterFailure(code: "khoros_response_too_large", message: "Khoros response exceeded 1 MB.") };
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: response.statusCode == 401 ? "khoros_token_invalid" : response.statusCode == 403 || response.statusCode == 404 ? "khoros_permission_denied" : response.statusCode == 429 ? "khoros_rate_limited" : "khoros_api_error", message: "Khoros API request failed.",
                providerStatusCode: response.statusCode)
        }; guard let any = try? JSONSerialization.jsonObject(with: response.body) else { throw MarketplaceProviderActionAdapterFailure(code: "khoros_response_invalid", message: "Khoros returned invalid JSON.") };
        let root = Self.json(any).khorosObject ?? [:], item = root["data"]?.khorosObject ?? [:], companies = item["companies"]?.khorosArray ?? [],
            company = companies.prefix(100).compactMap { $0.khorosObject }.first { value in
                let id = value["id"]?.string ?? value["id"]?.number.map { String(Int($0)) }; return id == auth.company
            }
        ; guard let company else { throw MarketplaceProviderActionAdapterFailure(code: "khoros_company_mismatch", message: "Khoros token cannot access the bound company.") };
        return ["companyId": .string(auth.company), "environment": Self.safeEnvironmentValue(company["environment"]), "redactionStatus": .string("user-and-company-identity-excluded")]
    }
    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> (token: String, company: String) {
        guard let id = request.auditIdentity.connectionId, let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), connection.appSlug == "khoros", connection.health.diagnostics["apiOrigin"]?.string == "https://api.spredfast.com",
            let tokenRef = connection.credentialRequirements.first(where: { $0.fieldKey == "khoros_marketing_access_token" })?.secretReferenceId, let companyRef = connection.credentialRequirements.first(where: { $0.fieldKey == "khoros_marketing_company_id" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "khoros_connection_not_ready", message: "Khoros connection is not ready.") }; let token = try secrets.getSecretValue(tokenRef), company = try secrets.getSecretValue(companyRef);
        guard !token.isEmpty, Self.safeId(company) else { throw MarketplaceProviderActionAdapterFailure(code: "khoros_credentials_invalid", message: "Khoros credential binding is invalid.") }; return (token, company)
    }
    private static func safeId(_ value: String) -> Bool { value.range(of: #"^[1-9][0-9]{0,18}$"#, options: .regularExpression) != nil };
    private static func safeEnvironmentValue(_ value: JSONValue?) -> JSONValue { guard let text = value?.string, text.range(of: #"^[A-Za-z][A-Za-z0-9_-]{0,31}$"#, options: .regularExpression) != nil else { return .null }; return .string(text) };
    private static func json(_ any: Any) -> JSONValue {
        if any is NSNull { return .null }; if let value = any as? Bool { return .bool(value) }; if let value = any as? String { return .string(value) }; if let value = any as? NSNumber { return .number(value.doubleValue) }; if let value = any as? [Any] { return .array(value.map(json)) };
        if let value = any as? [String: Any] { return .object(value.mapValues(json)) }; return .null
    }
}
public struct KhorosProviderActionAdapter: MarketplaceProviderActionAdapter {
    private let client: any KhorosProviderActionClient; public init(client: any KhorosProviderActionClient = FakeKhorosProviderActionClient()) { self.client = client };
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "khoros" else { throw MarketplaceProviderActionAdapterFailure(code: "khoros_action_not_allowlisted", message: "Khoros action is not allowlisted.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executeKhorosAction(request: request), error: nil, redactionStatus: "user-and-company-identity-excluded")
    }
}
extension JSONValue{fileprivate var khorosObject:JSONRecord?{if case.object(let value)=self{return value};return nil};fileprivate var khorosArray:[JSONValue]?{if case.array(let value)=self{return value};return nil}}
