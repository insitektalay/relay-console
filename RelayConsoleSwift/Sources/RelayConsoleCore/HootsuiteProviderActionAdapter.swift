import Foundation
public struct HootsuiteProviderHTTPRequest:Sendable{public let url:URL;public let headers:[String:String]}
public struct HootsuiteProviderHTTPResponse:Sendable{public let statusCode:Int;public let body:Data}
public protocol HootsuiteProviderHTTPClient:Sendable{func send(_ request:HootsuiteProviderHTTPRequest)throws->HootsuiteProviderHTTPResponse}
private final class HootsuiteNoRedirect: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}
public struct URLSessionHootsuiteProviderHTTPClient: HootsuiteProviderHTTPClient {
    public init() {};
    public func send(_ request: HootsuiteProviderHTTPRequest) throws -> HootsuiteProviderHTTPResponse {
        var value = URLRequest(url: request.url); value.httpMethod = "GET"; value.timeoutInterval = 20; request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) };
        let session = URLSession(configuration: .ephemeral, delegate: HootsuiteNoRedirect(), delegateQueue: nil), semaphore = DispatchSemaphore(value: 0); var data = Data(), status = 0, failure: Error?;
        let task = session.dataTask(with: value) {
            data = $0 ?? Data(); status = ($1 as? HTTPURLResponse)?.statusCode ?? 0; failure = $2; semaphore.signal()
        }; task.resume(); if semaphore.wait(timeout: .now() + 20) == .timedOut { task.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "hootsuite_http_timeout", message: "Hootsuite request timed out.") }; session.invalidateAndCancel(); if let failure { throw failure };
        return HootsuiteProviderHTTPResponse(statusCode: status, body: data)
    }
}
public protocol HootsuiteProviderActionClient:Sendable{func executeHootsuiteAction(request:MarketplaceProviderActionAdapterRequest)throws->JSONRecord}
public struct FakeHootsuiteProviderActionClient: HootsuiteProviderActionClient {
    public init() {};
    public func executeHootsuiteAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord { ["provider": .string("hootsuite"), "action": .string(request.definition.actionKey), "redactionStatus": .string("identity-and-content-excluded"), "liveCredentialsUsed": .bool(false)] }
}
public final class LiveHootsuiteProviderActionClient: HootsuiteProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService; private let secrets: SecretService; private let http: any HootsuiteProviderHTTPClient;
    public init(data: LocalDataService, secrets: SecretService, httpClient: any HootsuiteProviderHTTPClient = URLSessionHootsuiteProviderHTTPClient()) { self.data = data; self.secrets = secrets; self.http = httpClient }
    public func executeHootsuiteAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        let token = try authorization(request), action = request.definition.actionKey; let path: String;
        if action == "hootsuite_account_get" {
            path = "/v1/me"
        } else if action == "hootsuite_social_profile_id_list" {
            path = "/v1/me/socialProfiles"
        } else if action == "hootsuite_social_profile_get" {
            guard let id = request.payload["socialProfileId"]?.string, id.range(of: #"^[1-9][0-9]{0,31}$"#, options: .regularExpression) != nil else { throw MarketplaceProviderActionAdapterFailure(code: "hootsuite_profile_id_invalid", message: "Hootsuite social profile ID is invalid.") };
            path = "/v1/socialProfiles/" + id
        } else {
            throw MarketplaceProviderActionAdapterFailure(code: "hootsuite_action_not_supported", message: "Unsupported Hootsuite action.")
        }; let response = try http.send(HootsuiteProviderHTTPRequest(url: URL(string: "https://platform.hootsuite.com" + path)!, headers: ["Authorization": "Bearer " + token, "Accept": "application/json"]));
        guard response.body.count <= 1_000_000 else { throw MarketplaceProviderActionAdapterFailure(code: "hootsuite_response_too_large", message: "Hootsuite response exceeded 1 MB.") };
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: response.statusCode == 401 ? "hootsuite_token_invalid" : response.statusCode == 403 ? "hootsuite_permission_denied" : response.statusCode == 429 ? "hootsuite_rate_limited" : "hootsuite_api_error", message: "Hootsuite API request failed.", providerStatusCode: response.statusCode
            )
        }; let root = (try? JSONSerialization.jsonObject(with: response.body)).map(Self.json)?.objectValue ?? [:]; return Self.redact(action: action, data: root["data"] ?? .null)
    }
    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> String {
        guard let id = request.auditIdentity.connectionId, let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), connection.appSlug == "hootsuite", connection.health.diagnostics["apiOrigin"]?.string == "https://platform.hootsuite.com",
            let ref = connection.credentialRequirements.first(where: { $0.fieldKey == "hootsuite_oauth_access_token" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "hootsuite_connection_not_ready", message: "Hootsuite OAuth connection is not ready.") }; return try secrets.getSecretValue(ref)
    }
    private static func redact(action: String, data: JSONValue) -> JSONRecord {
        let object = data.objectValue ?? [:];
        if action == "hootsuite_account_get" {
            return [
                "id": safe(object["id"]), "isActive": safe(object["isActive"]), "createdDate": safe(object["createdDate"]), "modifiedDate": safe(object["modifiedDate"]), "timezone": safe(object["timezone"]), "language": safe(object["language"]),
                "redactionStatus": .string("identity-and-content-excluded"),
            ]
        } else if action == "hootsuite_social_profile_id_list" {
            let values = (data.arrayValue ?? []).prefix(25).map { JSONValue.object(["id": safe($0.objectValue?["id"])]) }; return ["profiles": .array(Array(values)), "redactionStatus": .string("identity-and-content-excluded")]
        } else {
            return ["id": safe(object["id"]), "type": safe(object["type"]), "owner": safe(object["owner"]), "isReauthRequired": safe(object["isReauthRequired"]), "redactionStatus": .string("identity-and-content-excluded")]
        }
    }
 private static func safe(_ value:JSONValue?)->JSONValue{guard let value else{return .null};switch value{case .string,.number,.bool,.null:return value;default:return .null}}
    private static func json(_ any: Any) -> JSONValue {
        if any is NSNull { return .null }; if let v = any as? Bool { return .bool(v) }; if let v = any as? String { return .string(v) }; if let v = any as? NSNumber { return .number(v.doubleValue) }; if let v = any as? [Any] { return .array(v.map(json)) };
        if let v = any as? [String: Any] { return .object(v.mapValues(json)) }; return .null
    }
}
public struct HootsuiteProviderActionAdapter: MarketplaceProviderActionAdapter {
    private let client: any HootsuiteProviderActionClient; public init(client: any HootsuiteProviderActionClient = FakeHootsuiteProviderActionClient()) { self.client = client };
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "hootsuite" else { throw MarketplaceProviderActionAdapterFailure(code: "hootsuite_action_not_allowlisted", message: "Hootsuite action is not allowlisted.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executeHootsuiteAction(request: request), error: nil, redactionStatus: "identity-and-content-excluded")
    }
}
extension JSONValue{fileprivate var objectValue:JSONRecord?{if case .object(let v)=self{return v};return nil};fileprivate var arrayValue:[JSONValue]?{if case .array(let v)=self{return v};return nil}}
