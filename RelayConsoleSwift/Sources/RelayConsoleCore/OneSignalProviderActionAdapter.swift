import Foundation

public struct OneSignalProviderHTTPRequest:Sendable{public let url:URL;public let headers:[String:String]}
public struct OneSignalProviderHTTPResponse:Sendable{public let statusCode:Int;public let body:Data}
public protocol OneSignalProviderHTTPClient:Sendable{func send(_ request:OneSignalProviderHTTPRequest)throws->OneSignalProviderHTTPResponse}
private final class OneSignalNoRedirect: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}
public struct URLSessionOneSignalProviderHTTPClient: OneSignalProviderHTTPClient {
    public init() {};
    public func send(_ request: OneSignalProviderHTTPRequest) throws -> OneSignalProviderHTTPResponse {
        var value = URLRequest(url: request.url); value.httpMethod = "GET"; value.timeoutInterval = 30; request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) };
        let session = URLSession(configuration: .ephemeral, delegate: OneSignalNoRedirect(), delegateQueue: nil), semaphore = DispatchSemaphore(value: 0); var data = Data(), status = 0, failure: Error?;
        let task = session.dataTask(with: value) {
            data = $0 ?? Data(); status = ($1 as? HTTPURLResponse)?.statusCode ?? 0; failure = $2; semaphore.signal()
        }; task.resume(); if semaphore.wait(timeout: .now() + 30) == .timedOut { task.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "onesignal_http_timeout", message: "OneSignal request timed out.") }; session.invalidateAndCancel(); if let failure { throw failure };
        return OneSignalProviderHTTPResponse(statusCode: status, body: data)
    }
}

public protocol OneSignalProviderActionClient:Sendable{func executeOneSignalAction(request:MarketplaceProviderActionAdapterRequest)throws->JSONRecord}
public struct FakeOneSignalProviderActionClient: OneSignalProviderActionClient {
    public init() {};
    public func executeOneSignalAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        ["provider": .string("onesignal"), "action": .string(request.definition.actionKey), "redactionStatus": .string("content-targeting-recipient-and-outcome-detail-excluded"), "liveCredentialsUsed": .bool(false)]
    }
}

public final class LiveOneSignalProviderActionClient:OneSignalProviderActionClient,@unchecked Sendable{
  private let data:LocalDataService;private let secrets:SecretService;private let http:any OneSignalProviderHTTPClient
  public init(data:LocalDataService,secrets:SecretService,httpClient:any OneSignalProviderHTTPClient=URLSessionOneSignalProviderHTTPClient()){self.data=data;self.secrets=secrets;self.http=httpClient}
    public func executeOneSignalAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        guard request.definition.actionKey == "onesignal_notification_delivery_summary_list" else { throw MarketplaceProviderActionAdapterFailure(code: "onesignal_action_not_allowlisted", message: "OneSignal action is not allowlisted.") }; let auth = try authorization(request);
        guard var components = URLComponents(string: "https://api.onesignal.com/notifications") else { throw MarketplaceProviderActionAdapterFailure(code: "onesignal_url_invalid", message: "OneSignal endpoint is invalid.") };
        components.queryItems = [URLQueryItem(name: "app_id", value: auth.appId), URLQueryItem(name: "limit", value: "25"), URLQueryItem(name: "offset", value: "0")];
        guard let url = components.url else { throw MarketplaceProviderActionAdapterFailure(code: "onesignal_app_invalid", message: "OneSignal App ID is invalid.") };
        let response = try http.send(OneSignalProviderHTTPRequest(url: url, headers: ["Authorization": "Key " + auth.key, "Accept": "application/json", "User-Agent": "RelayConsole-OneSignal/1.0"]));
        guard response.body.count <= 1_000_000 else { throw MarketplaceProviderActionAdapterFailure(code: "onesignal_response_too_large", message: "OneSignal response exceeded 1 MB.") };
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: response.statusCode == 401 ? "onesignal_key_invalid" : response.statusCode == 403 || response.statusCode == 404 ? "onesignal_permission_denied" : response.statusCode == 429 ? "onesignal_rate_limited" : "onesignal_api_error", message: "OneSignal API request failed.",
                providerStatusCode: response.statusCode)
        }; guard let any = try? JSONSerialization.jsonObject(with: response.body) else { throw MarketplaceProviderActionAdapterFailure(code: "onesignal_response_invalid", message: "OneSignal returned invalid JSON.") };
        let root = Self.json(any).oneSignalObject ?? [:], items = (root["notifications"]?.oneSignalArray ?? []).prefix(25).map { Self.safeNotification($0.oneSignalObject ?? [:]) };
        return ["appId": .string(auth.appId), "totalCount": Self.safeInteger(root["total_count"]), "offset": .number(0), "limit": .number(25), "notifications": .array(Array(items)), "redactionStatus": .string("content-targeting-recipient-and-outcome-detail-excluded")]
    }
    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> (appId: String, key: String) {
        guard let id = request.auditIdentity.connectionId, let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), connection.appSlug == "onesignal", connection.health.diagnostics["apiOrigin"]?.string == "https://api.onesignal.com",
            let appRef = connection.credentialRequirements.first(where: { $0.fieldKey == "onesignal_app_id" })?.secretReferenceId, let keyRef = connection.credentialRequirements.first(where: { $0.fieldKey == "onesignal_app_api_key" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "onesignal_connection_not_ready", message: "OneSignal connection is not ready.") }; let app = try secrets.getSecretValue(appRef).lowercased(), key = try secrets.getSecretValue(keyRef);
        guard Self.uuid(app), !key.isEmpty, key.count <= 4096, !key.contains("\n"), !key.contains("\r") else { throw MarketplaceProviderActionAdapterFailure(code: "onesignal_credentials_invalid", message: "OneSignal credential binding is invalid.") }; return (app, key)
    }
    private static func safeNotification(_ item: JSONRecord) -> JSONValue {
        .object([
            "id": uuidValue(item["id"]), "canceled": item["canceled"]?.bool.map(JSONValue.bool) ?? .null, "queuedAt": safeInteger(item["queued_at"]), "completedAt": safeInteger(item["completed_at"]), "successful": safeInteger(item["successful"]), "received": safeInteger(item["received"]),
            "failed": safeInteger(item["failed"]), "errored": safeInteger(item["errored"]), "converted": safeInteger(item["converted"]), "remaining": safeInteger(item["remaining"]),
        ])
    }
    private static func uuid(_ value: String) -> Bool { value.range(of: #"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"#, options: .regularExpression) != nil };
    private static func uuidValue(_ value: JSONValue?) -> JSONValue { guard let text = value?.string?.lowercased(), uuid(text) else { return .null }; return .string(text) };
    private static func safeInteger(_ value: JSONValue?) -> JSONValue { guard let number = value?.number, number >= 0, number.rounded() == number else { return .null }; return .number(number) };
    private static func json(_ any: Any) -> JSONValue {
        if any is NSNull { return .null }; if let value = any as? Bool { return .bool(value) }; if let value = any as? String { return .string(value) }; if let value = any as? NSNumber { return .number(value.doubleValue) }; if let value = any as? [Any] { return .array(value.map(json)) };
        if let value = any as? [String: Any] { return .object(value.mapValues(json)) }; return .null
    }
}
public struct OneSignalProviderActionAdapter: MarketplaceProviderActionAdapter {
    private let client: any OneSignalProviderActionClient; public init(client: any OneSignalProviderActionClient = FakeOneSignalProviderActionClient()) { self.client = client };
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "onesignal" else { throw MarketplaceProviderActionAdapterFailure(code: "onesignal_action_not_allowlisted", message: "OneSignal action is not allowlisted.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executeOneSignalAction(request: request), error: nil, redactionStatus: "content-targeting-recipient-and-outcome-detail-excluded")
    }
}
extension JSONValue{fileprivate var oneSignalObject:JSONRecord?{if case.object(let value)=self{return value};return nil};fileprivate var oneSignalArray:[JSONValue]?{if case.array(let value)=self{return value};return nil}}
