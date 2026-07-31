import Foundation
public struct SproutSocialProviderHTTPRequest:Sendable{public let method:String;public let url:URL;public let headers:[String:String];public let body:Data?}
public struct SproutSocialProviderHTTPResponse:Sendable{public let statusCode:Int;public let body:Data}
public protocol SproutSocialProviderHTTPClient:Sendable{func send(_ request:SproutSocialProviderHTTPRequest)throws->SproutSocialProviderHTTPResponse}
private final class SproutSocialNoRedirect: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}
public struct URLSessionSproutSocialProviderHTTPClient: SproutSocialProviderHTTPClient {
    public init() {};
    public func send(_ request: SproutSocialProviderHTTPRequest) throws -> SproutSocialProviderHTTPResponse {
        var value = URLRequest(url: request.url); value.httpMethod = request.method; value.httpBody = request.body; value.timeoutInterval = 20; request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) };
        let session = URLSession(configuration: .ephemeral, delegate: SproutSocialNoRedirect(), delegateQueue: nil), semaphore = DispatchSemaphore(value: 0); var data = Data(), status = 0, failure: Error?;
        let task = session.dataTask(with: value) {
            data = $0 ?? Data(); status = ($1 as? HTTPURLResponse)?.statusCode ?? 0; failure = $2; semaphore.signal()
        }; task.resume(); if semaphore.wait(timeout: .now() + 20) == .timedOut { task.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "sprout_social_http_timeout", message: "Sprout Social request timed out.") }; session.invalidateAndCancel(); if let failure { throw failure };
        return SproutSocialProviderHTTPResponse(statusCode: status, body: data)
    }
}
public protocol SproutSocialProviderActionClient:Sendable{func executeSproutSocialAction(request:MarketplaceProviderActionAdapterRequest)throws->JSONRecord}
public struct FakeSproutSocialProviderActionClient: SproutSocialProviderActionClient {
    public init() {};
    public func executeSproutSocialAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        ["provider": .string("sprout-social"), "action": .string(request.definition.actionKey), "redactionStatus": .string("identity-and-content-excluded"), "liveCredentialsUsed": .bool(false)]
    }
}
public final class LiveSproutSocialProviderActionClient: SproutSocialProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService; private let secrets: SecretService; private let http: any SproutSocialProviderHTTPClient;
    public init(data: LocalDataService, secrets: SecretService, httpClient: any SproutSocialProviderHTTPClient = URLSessionSproutSocialProviderHTTPClient()) { self.data = data; self.secrets = secrets; self.http = httpClient }
    public func executeSproutSocialAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        let auth = try credentials(request), token = try accessToken(auth), action = request.definition.actionKey, path: String;
        if action == "sprout_social_customer_id_list" {
            path = "/v1/metadata/client"
        } else {
            guard let id = request.payload["customerId"]?.string, id.range(of: #"^[1-9][0-9]{0,18}$"#, options: .regularExpression) != nil else { throw MarketplaceProviderActionAdapterFailure(code: "sprout_social_customer_id_invalid", message: "Sprout Social customer ID is invalid.") };
            if action == "sprout_social_profile_structure_list" {
                path = "/v1/" + id + "/metadata/customer"
            } else if action == "sprout_social_group_id_list" {
                path = "/v1/" + id + "/metadata/customer/groups"
            } else {
                throw MarketplaceProviderActionAdapterFailure(code: "sprout_social_action_not_supported", message: "Unsupported Sprout Social action.")
            }
        };
        let response = try http.send(SproutSocialProviderHTTPRequest(method: "GET", url: URL(string: "https://api.sproutsocial.com" + path)!, headers: ["Authorization": "Bearer " + token, "Accept": "application/json", "Content-Type": "application/json"], body: nil)), root = try decode(response),
            values = (root["data"]?.arrayValue ?? []).prefix(25)
        ;
        if action == "sprout_social_customer_id_list" {
            return ["customerIds": .array(values.map { safePositive($0.objectValue?["customer_id"]) }), "redactionStatus": .string("identity-and-content-excluded")]
        } else if action == "sprout_social_profile_structure_list" {
            let profiles = values.map { value -> JSONValue in
                let o = value.objectValue ?? [:]; return .object(["customerProfileId": safePositive(o["customer_profile_id"]), "networkType": safeText(o["network_type"], 40), "groupCount": .number(Double(o["groups"]?.arrayValue?.count ?? 0))])
            }; return ["customerId": request.payload["customerId"] ?? .null, "profiles": .array(profiles), "redactionStatus": .string("identity-and-content-excluded")]
        } else {
            return ["customerId": request.payload["customerId"] ?? .null, "groupIds": .array(values.map { safePositive($0.objectValue?["group_id"]) }), "redactionStatus": .string("identity-and-content-excluded")]
        }
    }
    private func credentials(_ request: MarketplaceProviderActionAdapterRequest) throws -> (String, String) {
        guard let id = request.auditIdentity.connectionId, let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), connection.appSlug == "sprout-social", connection.health.diagnostics["apiOrigin"]?.string == "https://api.sproutsocial.com",
            let clientRef = connection.credentialRequirements.first(where: { $0.fieldKey == "sprout_social_client_id" })?.secretReferenceId, let secretRef = connection.credentialRequirements.first(where: { $0.fieldKey == "sprout_social_client_secret" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "sprout_social_connection_not_ready", message: "Sprout Social client credentials are not ready.") }; return (try secrets.getSecretValue(clientRef), try secrets.getSecretValue(secretRef))
    }
    private func accessToken(_ credentials: (String, String)) throws -> String {
        var form = URLComponents(); form.queryItems = [URLQueryItem(name: "client_id", value: credentials.0), URLQueryItem(name: "client_secret", value: credentials.1), URLQueryItem(name: "grant_type", value: "client_credentials"), URLQueryItem(name: "scope", value: "organization_id")];
        let body = Data((form.percentEncodedQuery ?? "").utf8),
            response = try http.send(
                SproutSocialProviderHTTPRequest(method: "POST", url: URL(string: "https://identity.sproutsocial.com/oauth2/84e39c75-d770-45d9-90a9-7b79e3037d2c/v1/token")!, headers: ["Accept": "application/json", "Content-Type": "application/x-www-form-urlencoded"], body: body)),
            root = try decode(response)
        ; guard let token = root["access_token"]?.string, !token.isEmpty, token.count <= 30000 else { throw MarketplaceProviderActionAdapterFailure(code: "sprout_social_token_failed", message: "Sprout Social did not return a usable access token.") }; return token
    }
    private func decode(_ response: SproutSocialProviderHTTPResponse) throws -> JSONRecord {
        guard response.body.count <= 1_000_000 else { throw MarketplaceProviderActionAdapterFailure(code: "sprout_social_response_too_large", message: "Sprout Social response exceeded 1 MB.") };
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: response.statusCode == 401 ? "sprout_social_token_invalid" : response.statusCode == 403 ? "sprout_social_permission_denied" : response.statusCode == 429 ? "sprout_social_rate_limited" : "sprout_social_api_error", message: "Sprout Social API request failed.",
                providerStatusCode: response.statusCode)
        }; return (try? JSONSerialization.jsonObject(with: response.body)).map(Self.json)?.objectValue ?? [:]
    }
 private func safePositive(_ value:JSONValue?)->JSONValue{if let s=value?.string,s.range(of:#"^[1-9][0-9]{0,18}$"#,options:.regularExpression) != nil{return .string(s)};if let n=value?.number,n.rounded()==n,n>0{return .string(String(format:"%.0f",n))};return .null}
 private func safeText(_ value:JSONValue?,_ max:Int)->JSONValue{guard let s=value?.string?.trimmingCharacters(in:.whitespacesAndNewlines),!s.isEmpty else{return .null};return .string(String(s.prefix(max)))}
    private static func json(_ any: Any) -> JSONValue {
        if any is NSNull { return .null }; if let v = any as? Bool { return .bool(v) }; if let v = any as? String { return .string(v) }; if let v = any as? NSNumber { return .number(v.doubleValue) }; if let v = any as? [Any] { return .array(v.map(json)) };
        if let v = any as? [String: Any] { return .object(v.mapValues(json)) }; return .null
    }
}
public struct SproutSocialProviderActionAdapter: MarketplaceProviderActionAdapter {
    private let client: any SproutSocialProviderActionClient; public init(client: any SproutSocialProviderActionClient = FakeSproutSocialProviderActionClient()) { self.client = client };
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "sprout-social" else { throw MarketplaceProviderActionAdapterFailure(code: "sprout_social_action_not_allowlisted", message: "Sprout Social action is not allowlisted.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executeSproutSocialAction(request: request), error: nil, redactionStatus: "identity-and-content-excluded")
    }
}
extension JSONValue{fileprivate var objectValue:JSONRecord?{if case .object(let v)=self{return v};return nil};fileprivate var arrayValue:[JSONValue]?{if case .array(let v)=self{return v};return nil}}
