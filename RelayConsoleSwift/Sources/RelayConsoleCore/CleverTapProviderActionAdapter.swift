import Foundation

public struct CleverTapProviderHTTPRequest:Sendable{public let url:URL;public let headers:[String:String]}
public struct CleverTapProviderHTTPResponse:Sendable{public let statusCode:Int;public let body:Data}
public protocol CleverTapProviderHTTPClient:Sendable{func send(_ request:CleverTapProviderHTTPRequest)throws->CleverTapProviderHTTPResponse}
private final class CleverTapNoRedirect: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}
public struct URLSessionCleverTapProviderHTTPClient: CleverTapProviderHTTPClient {
    public init() {};
    public func send(_ request: CleverTapProviderHTTPRequest) throws -> CleverTapProviderHTTPResponse {
        var value = URLRequest(url: request.url); value.httpMethod = "GET"; value.timeoutInterval = 60; request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) };
        let session = URLSession(configuration: .ephemeral, delegate: CleverTapNoRedirect(), delegateQueue: nil), semaphore = DispatchSemaphore(value: 0); var data = Data(), status = 0, failure: Error?;
        let task = session.dataTask(with: value) {
            data = $0 ?? Data(); status = ($1 as? HTTPURLResponse)?.statusCode ?? 0; failure = $2; semaphore.signal()
        }; task.resume(); if semaphore.wait(timeout: .now() + 60) == .timedOut { task.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "clevertap_http_timeout", message: "CleverTap request timed out.") }; session.invalidateAndCancel(); if let failure { throw failure };
        return CleverTapProviderHTTPResponse(statusCode: status, body: data)
    }
}

public protocol CleverTapProviderActionClient:Sendable{func executeCleverTapAction(request:MarketplaceProviderActionAdapterRequest)throws->JSONRecord}
public struct FakeCleverTapProviderActionClient: CleverTapProviderActionClient {
    public init() {};
    public func executeCleverTapAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        ["provider": .string("clevertap"), "action": .string(request.definition.actionKey), "profileReference": .string("connection-bound-identity"), "redactionStatus": .string("lookup-identity-custom-values-device-tokens-and-object-ids-excluded"), "liveCredentialsUsed": .bool(false)]
    }
}

public final class LiveCleverTapProviderActionClient:CleverTapProviderActionClient,@unchecked Sendable{
  private let data:LocalDataService;private let secrets:SecretService;private let http:any CleverTapProviderHTTPClient
  public init(data:LocalDataService,secrets:SecretService,httpClient:any CleverTapProviderHTTPClient=URLSessionCleverTapProviderHTTPClient()){self.data=data;self.secrets=secrets;self.http=httpClient}
    public func executeCleverTapAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        guard request.definition.actionKey == "clevertap_bound_user_profile_get" else { throw MarketplaceProviderActionAdapterFailure(code: "clevertap_action_not_allowlisted", message: "CleverTap action is not allowlisted.") }; let auth = try authorization(request);
        guard var components = URLComponents(string: auth.origin + "/1/profile.json") else { throw MarketplaceProviderActionAdapterFailure(code: "clevertap_region_invalid", message: "CleverTap region is invalid.") }; components.queryItems = [URLQueryItem(name: "identity", value: auth.identity)];
        guard let url = components.url else { throw MarketplaceProviderActionAdapterFailure(code: "clevertap_identity_invalid", message: "CleverTap profile identity is invalid.") };
        let response = try http.send(CleverTapProviderHTTPRequest(url: url, headers: ["X-CleverTap-Account-Id": auth.account, "X-CleverTap-Passcode": auth.passcode, "Accept": "application/json", "User-Agent": "RelayConsole-CleverTap/1.0"]));
        guard response.body.count <= 1_000_000 else { throw MarketplaceProviderActionAdapterFailure(code: "clevertap_response_too_large", message: "CleverTap response exceeded 1 MB.") };
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: response.statusCode == 401 ? "clevertap_credentials_invalid" : response.statusCode == 403 ? "clevertap_permission_denied" : response.statusCode == 429 ? "clevertap_rate_limited" : "clevertap_api_error", message: "CleverTap API request failed.",
                providerStatusCode: response.statusCode)
        }; guard let any = try? JSONSerialization.jsonObject(with: response.body) else { throw MarketplaceProviderActionAdapterFailure(code: "clevertap_response_invalid", message: "CleverTap returned invalid JSON.") }; let root = Self.json(any).cleverTapObject ?? [:];
        guard root["status"]?.string == "success", let record = root["record"]?.cleverTapObject else { throw MarketplaceProviderActionAdapterFailure(code: "clevertap_profile_unavailable", message: "The bound CleverTap profile was not found.") }; return Self.safeProfile(record)
    }
    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> (account: String, passcode: String, identity: String, origin: String) {
        guard let id = request.auditIdentity.connectionId, let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), connection.appSlug == "clevertap",
            let accountRef = connection.credentialRequirements.first(where: { $0.fieldKey == "clevertap_account_id" })?.secretReferenceId, let passcodeRef = connection.credentialRequirements.first(where: { $0.fieldKey == "clevertap_passcode" })?.secretReferenceId,
            let regionRef = connection.credentialRequirements.first(where: { $0.fieldKey == "clevertap_region" })?.secretReferenceId, let identityRef = connection.credentialRequirements.first(where: { $0.fieldKey == "clevertap_profile_identity" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "clevertap_connection_not_ready", message: "CleverTap connection is not ready.") };
        let account = try secrets.getSecretValue(accountRef), passcode = try secrets.getSecretValue(passcodeRef), region = try secrets.getSecretValue(regionRef), identity = try secrets.getSecretValue(identityRef);
        guard account.range(of: #"^[A-Za-z0-9_-]{3,128}$"#, options: .regularExpression) != nil, !passcode.isEmpty, !passcode.contains("\n"), !passcode.contains("\r"), !identity.isEmpty, identity.count <= 256, identity.rangeOfCharacter(from: .controlCharacters) == nil,
            let origin = Self.origins[region], connection.health.diagnostics["apiOrigin"]?.string == origin
        else { throw MarketplaceProviderActionAdapterFailure(code: "clevertap_credentials_invalid", message: "CleverTap credential binding is invalid.") }; return (account, passcode, identity, origin)
    }
  private static let origins=["eu1":"https://api.clevertap.com","in1":"https://in1.api.clevertap.com","sg1":"https://sg1.api.clevertap.com","us1":"https://us1.api.clevertap.com","aps3":"https://aps3.api.clevertap.com","mec1":"https://mec1.api.clevertap.com"]
    private static func safeProfile(_ record: JSONRecord) -> JSONRecord {
        let events = (record["events"]?.cleverTapObject ?? [:]).keys.sorted().prefix(25).map { key -> JSONValue in
            let value = record["events"]?.cleverTapObject?[key]?.cleverTapObject ?? [:]; return .object(["name": .string(String(key.prefix(128))), "count": safeInteger(value["count"]), "firstSeen": safeInteger(value["first_seen"]), "lastSeen": safeInteger(value["last_seen"])])
        }; var seen = Set<String>(); let platforms = (record["platformInfo"]?.cleverTapArray ?? []).prefix(50).compactMap { $0.cleverTapObject?["platform"]?.string }.filter { $0.count <= 64 && seen.insert($0).inserted }.prefix(10).map { JSONValue.string($0) };
        let keys = (record["profileData"]?.cleverTapObject ?? [:]).keys.sorted().prefix(50).map { JSONValue.string(String($0.prefix(128))) };
        return [
            "profileReference": .string("connection-bound-identity"), "name": safeString(record["name"], max: 256), "email": safeString(record["email"], max: 320), "events": .array(Array(events)), "platforms": .array(Array(platforms)), "customPropertyKeys": .array(keys),
            "redactionStatus": .string("lookup-identity-custom-values-device-tokens-and-object-ids-excluded"),
        ]
    }
    private static func safeString(_ value: JSONValue?, max: Int) -> JSONValue { guard let text = value?.string, text.count <= max else { return .null }; return .string(text) };
    private static func safeInteger(_ value: JSONValue?) -> JSONValue { guard let number = value?.number, number >= 0, number.rounded() == number else { return .null }; return .number(number) };
    private static func json(_ any: Any) -> JSONValue {
        if any is NSNull { return .null }; if let value = any as? Bool { return .bool(value) }; if let value = any as? String { return .string(value) }; if let value = any as? NSNumber { return .number(value.doubleValue) }; if let value = any as? [Any] { return .array(value.map(json)) };
        if let value = any as? [String: Any] { return .object(value.mapValues(json)) }; return .null
    }
}
public struct CleverTapProviderActionAdapter: MarketplaceProviderActionAdapter {
    private let client: any CleverTapProviderActionClient; public init(client: any CleverTapProviderActionClient = FakeCleverTapProviderActionClient()) { self.client = client };
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "clevertap" else { throw MarketplaceProviderActionAdapterFailure(code: "clevertap_action_not_allowlisted", message: "CleverTap action is not allowlisted.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executeCleverTapAction(request: request), error: nil, redactionStatus: "lookup-identity-custom-values-device-tokens-and-object-ids-excluded")
    }
}
extension JSONValue{fileprivate var cleverTapObject:JSONRecord?{if case.object(let value)=self{return value};return nil};fileprivate var cleverTapArray:[JSONValue]?{if case.array(let value)=self{return value};return nil}}
