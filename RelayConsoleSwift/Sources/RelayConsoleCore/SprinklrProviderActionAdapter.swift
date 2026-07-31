import Foundation

public struct SprinklrProviderHTTPRequest:Sendable{public let url:URL;public let headers:[String:String]}
public struct SprinklrProviderHTTPResponse:Sendable{public let statusCode:Int;public let body:Data}
public protocol SprinklrProviderHTTPClient:Sendable{func send(_ request:SprinklrProviderHTTPRequest)throws->SprinklrProviderHTTPResponse}
private final class SprinklrNoRedirect: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}
public struct URLSessionSprinklrProviderHTTPClient: SprinklrProviderHTTPClient {
    public init() {};
    public func send(_ request: SprinklrProviderHTTPRequest) throws -> SprinklrProviderHTTPResponse {
        var value = URLRequest(url: request.url); value.httpMethod = "GET"; value.timeoutInterval = 20; request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) };
        let session = URLSession(configuration: .ephemeral, delegate: SprinklrNoRedirect(), delegateQueue: nil), semaphore = DispatchSemaphore(value: 0); var data = Data(), status = 0, failure: Error?;
        let task = session.dataTask(with: value) {
            data = $0 ?? Data(); status = ($1 as? HTTPURLResponse)?.statusCode ?? 0; failure = $2; semaphore.signal()
        }; task.resume(); if semaphore.wait(timeout: .now() + 20) == .timedOut { task.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "sprinklr_http_timeout", message: "Sprinklr request timed out.") }; session.invalidateAndCancel(); if let failure { throw failure };
        return SprinklrProviderHTTPResponse(statusCode: status, body: data)
    }
}

public protocol SprinklrProviderActionClient:Sendable{func executeSprinklrAction(request:MarketplaceProviderActionAdapterRequest)throws->JSONRecord}
public struct FakeSprinklrProviderActionClient: SprinklrProviderActionClient {
    public init() {};
    public func executeSprinklrAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord { ["provider": .string("sprinklr"), "action": .string(request.definition.actionKey), "redactionStatus": .string("identity-and-platform-data-excluded"), "liveCredentialsUsed": .bool(false)] }
}

public final class LiveSprinklrProviderActionClient:SprinklrProviderActionClient,@unchecked Sendable{
  private let data:LocalDataService;private let secrets:SecretService;private let http:any SprinklrProviderHTTPClient
  public init(data:LocalDataService,secrets:SecretService,httpClient:any SprinklrProviderHTTPClient=URLSessionSprinklrProviderHTTPClient()){self.data=data;self.secrets=secrets;self.http=httpClient}
    public func executeSprinklrAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        guard request.definition.actionKey == "sprinklr_governance_status_get" else { throw MarketplaceProviderActionAdapterFailure(code: "sprinklr_action_not_allowlisted", message: "Sprinklr action is not allowlisted.") };
        let auth = try authorization(request), prefix = auth.environment == "production" ? "" : "/" + auth.environment, url = URL(string: "https://api3.sprinklr.com" + prefix + "/api/v2/me")!,
            response = try http.send(SprinklrProviderHTTPRequest(url: url, headers: ["Authorization": "Bearer " + auth.token, "Key": auth.key, "Accept": "application/json", "User-Agent": "RelayConsole-Sprinklr/1.0"]))
        ; guard response.body.count <= 1_000_000 else { throw MarketplaceProviderActionAdapterFailure(code: "sprinklr_response_too_large", message: "Sprinklr response exceeded 1 MB.") };
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: response.statusCode == 401 ? "sprinklr_token_invalid" : response.statusCode == 403 || response.statusCode == 404 ? "sprinklr_permission_denied" : response.statusCode == 429 ? "sprinklr_rate_limited" : "sprinklr_api_error", message: "Sprinklr API request failed.",
                providerStatusCode: response.statusCode)
        }; guard let any = try? JSONSerialization.jsonObject(with: response.body) else { throw MarketplaceProviderActionAdapterFailure(code: "sprinklr_response_invalid", message: "Sprinklr returned invalid JSON.") };
        let root = Self.json(any).sprinklrObject ?? [:], item = root["data"]?.sprinklrObject ?? [:], workspace = item["workspaceId"]?.string ?? item["workspaceId"]?.number.map { String(Int($0)) };
        guard workspace == auth.workspace else { throw MarketplaceProviderActionAdapterFailure(code: "sprinklr_workspace_mismatch", message: "Sprinklr token did not resolve to the bound primary workspace.") };
        let customer = item["customerId"]?.string ?? item["customerId"]?.number.map { String(Int($0)) };
        return ["userType": Self.safeEnumValue(item["type"]), "primaryWorkspaceConfirmed": .bool(true), "customerBound": .bool(customer.map(Self.safeId) ?? false), "redactionStatus": .string("identity-and-platform-data-excluded")]
    }
    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> (key: String, token: String, environment: String, workspace: String) {
        guard let id = request.auditIdentity.connectionId, let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), connection.appSlug == "sprinklr", connection.health.diagnostics["apiOrigin"]?.string == "https://api3.sprinklr.com",
            let keyRef = connection.credentialRequirements.first(where: { $0.fieldKey == "sprinklr_api_key" })?.secretReferenceId, let tokenRef = connection.credentialRequirements.first(where: { $0.fieldKey == "sprinklr_access_token" })?.secretReferenceId,
            let envRef = connection.credentialRequirements.first(where: { $0.fieldKey == "sprinklr_environment" })?.secretReferenceId, let workspaceRef = connection.credentialRequirements.first(where: { $0.fieldKey == "sprinklr_workspace_id" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "sprinklr_connection_not_ready", message: "Sprinklr connection is not ready.") };
        let key = try secrets.getSecretValue(keyRef), token = try secrets.getSecretValue(tokenRef), environment = try secrets.getSecretValue(envRef).lowercased(), workspace = try secrets.getSecretValue(workspaceRef);
        guard !key.isEmpty, !token.isEmpty, Self.safeEnvironment(environment), Self.safeId(workspace) else { throw MarketplaceProviderActionAdapterFailure(code: "sprinklr_credentials_invalid", message: "Sprinklr credential binding is invalid.") }; return (key, token, environment, workspace)
    }
    private static func safeId(_ value: String) -> Bool { value.range(of: #"^[1-9][0-9]{0,18}$"#, options: .regularExpression) != nil };
    private static func safeEnvironment(_ value: String) -> Bool { value == "production" || value.range(of: #"^prod[0-9]{1,2}$"#, options: .regularExpression) != nil };
    private static func safeEnumValue(_ value: JSONValue?) -> JSONValue { guard let text = value?.string, text.range(of: #"^[A-Z][A-Z0-9_]{0,63}$"#, options: .regularExpression) != nil else { return .null }; return .string(text) };
    private static func json(_ any: Any) -> JSONValue {
        if any is NSNull { return .null }; if let value = any as? Bool { return .bool(value) }; if let value = any as? String { return .string(value) }; if let value = any as? NSNumber { return .number(value.doubleValue) }; if let value = any as? [Any] { return .array(value.map(json)) };
        if let value = any as? [String: Any] { return .object(value.mapValues(json)) }; return .null
    }
}
public struct SprinklrProviderActionAdapter: MarketplaceProviderActionAdapter {
    private let client: any SprinklrProviderActionClient; public init(client: any SprinklrProviderActionClient = FakeSprinklrProviderActionClient()) { self.client = client };
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "sprinklr" else { throw MarketplaceProviderActionAdapterFailure(code: "sprinklr_action_not_allowlisted", message: "Sprinklr action is not allowlisted.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executeSprinklrAction(request: request), error: nil, redactionStatus: "identity-and-platform-data-excluded")
    }
}
extension JSONValue{fileprivate var sprinklrObject:JSONRecord?{if case.object(let value)=self{return value};return nil}}
