import Foundation
public struct BufferProviderHTTPRequest:Sendable{public let url:URL;public let headers:[String:String];public let body:Data}
public struct BufferProviderHTTPResponse:Sendable{public let statusCode:Int;public let body:Data}
public protocol BufferProviderHTTPClient:Sendable{func send(_ request:BufferProviderHTTPRequest)throws->BufferProviderHTTPResponse}
private final class BufferNoRedirect:NSObject,URLSessionTaskDelegate,@unchecked Sendable{func urlSession(_ session:URLSession,task:URLSessionTask,willPerformHTTPRedirection response:HTTPURLResponse,newRequest request:URLRequest,completionHandler:@escaping(URLRequest?)->Void){completionHandler(nil)}}
public struct URLSessionBufferProviderHTTPClient: BufferProviderHTTPClient {
    public init() {};
    public func send(_ request: BufferProviderHTTPRequest) throws -> BufferProviderHTTPResponse {
        var value = URLRequest(url: request.url); value.httpMethod = "POST"; value.httpBody = request.body; value.timeoutInterval = 20; request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) };
        let session = URLSession(configuration: .ephemeral, delegate: BufferNoRedirect(), delegateQueue: nil), semaphore = DispatchSemaphore(value: 0); var data = Data(), status = 0, failure: Error?;
        let task = session.dataTask(with: value) {
            data = $0 ?? Data(); status = ($1 as? HTTPURLResponse)?.statusCode ?? 0; failure = $2; semaphore.signal()
        }; task.resume(); if semaphore.wait(timeout: .now() + 20) == .timedOut { task.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "buffer_http_timeout", message: "Buffer request timed out.") }; session.invalidateAndCancel(); if let failure { throw failure };
        return BufferProviderHTTPResponse(statusCode: status, body: data)
    }
}
public protocol BufferProviderActionClient:Sendable{func executeBufferAction(request:MarketplaceProviderActionAdapterRequest)throws->JSONRecord}
public struct FakeBufferProviderActionClient: BufferProviderActionClient {
    public init() {};
    public func executeBufferAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord { ["provider": .string("buffer"), "action": .string(request.definition.actionKey), "redactionStatus": .string("identity-and-content-excluded"), "liveCredentialsUsed": .bool(false)] }
}
public final class LiveBufferProviderActionClient: BufferProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService; private let secrets: SecretService; private let http: any BufferProviderHTTPClient;
    public init(data: LocalDataService, secrets: SecretService, httpClient: any BufferProviderHTTPClient = URLSessionBufferProviderHTTPClient()) { self.data = data; self.secrets = secrets; self.http = httpClient }
    public func executeBufferAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        let token = try authorization(request), action = request.definition.actionKey, query: String, variables: JSONRecord;
        if action == "buffer_account_get" {
            query = "query RelayAccount { account { id createdAt timezone organizations { id channelCount } } }"; variables = [:]
        } else if action == "buffer_organization_list" {
            query = "query RelayOrganizations { account { organizations { id channelCount } } }"; variables = [:]
        } else if action == "buffer_channel_list" {
            guard let id = request.payload["organizationId"]?.string, id.range(of: #"^[A-Za-z0-9_-]{1,100}$"#, options: .regularExpression) != nil else { throw MarketplaceProviderActionAdapterFailure(code: "buffer_organization_id_invalid", message: "Buffer organization ID is invalid.") };
            query = "query RelayChannels($input: ChannelsInput!) { channels(input: $input) { id service type timezone updatedAt } }"; variables = ["input": .object(["organizationId": .string(id)])]
        } else {
            throw MarketplaceProviderActionAdapterFailure(code: "buffer_action_not_supported", message: "Unsupported Buffer action.")
        }; let encoded = try JSONSerialization.data(withJSONObject: ["query": query, "variables": Self.any(.object(variables))]);
        let response = try http.send(BufferProviderHTTPRequest(url: URL(string: "https://api.buffer.com")!, headers: ["Authorization": "Bearer " + token, "Accept": "application/json", "Content-Type": "application/json"], body: encoded));
        guard response.body.count <= 1_000_000 else { throw MarketplaceProviderActionAdapterFailure(code: "buffer_response_too_large", message: "Buffer response exceeded 1 MB.") };
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: response.statusCode == 401 ? "buffer_token_invalid" : response.statusCode == 403 ? "buffer_permission_denied" : response.statusCode == 429 ? "buffer_rate_limited" : "buffer_api_error", message: "Buffer API request failed.", providerStatusCode: response.statusCode)
        }; let root = (try? JSONSerialization.jsonObject(with: response.body)).map(Self.json)?.objectValue ?? [:]; guard root["errors"]?.arrayValue?.isEmpty != false else { throw MarketplaceProviderActionAdapterFailure(code: "buffer_graphql_error", message: "Buffer GraphQL query failed.") };
        return Self.redact(action: action, data: root["data"]?.objectValue ?? [:], organizationId: request.payload["organizationId"]?.string)
    }
    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> String {
        guard let id = request.auditIdentity.connectionId, let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), connection.appSlug == "buffer", connection.health.diagnostics["apiOrigin"]?.string == "https://api.buffer.com",
            let ref = connection.credentialRequirements.first(where: { $0.fieldKey == "buffer_oauth_access_token" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "buffer_connection_not_ready", message: "Buffer OAuth connection is not ready.") }; return try secrets.getSecretValue(ref)
    }
    private static func redact(action: String, data: JSONRecord, organizationId: String?) -> JSONRecord {
        if action == "buffer_account_get" {
            let account = data["account"]?.objectValue ?? [:], organizations = account["organizations"]?.arrayValue ?? [];
            return ["id": safe(account["id"]), "createdAt": safe(account["createdAt"]), "timezone": safe(account["timezone"]), "organizationCount": .number(Double(min(25, organizations.count))), "redactionStatus": .string("identity-and-content-excluded")]
        } else if action == "buffer_organization_list" {
            let account = data["account"]?.objectValue ?? [:], values = (account["organizations"]?.arrayValue ?? []).prefix(25).map { JSONValue.object(["id": safe($0.objectValue?["id"]), "channelCount": safe($0.objectValue?["channelCount"])]) };
            return ["organizations": .array(Array(values)), "redactionStatus": .string("identity-and-content-excluded")]
        } else {
            let values = (data["channels"]?.arrayValue ?? []).prefix(25).map {
                JSONValue.object(["id": safe($0.objectValue?["id"]), "service": safe($0.objectValue?["service"]), "type": safe($0.objectValue?["type"]), "timezone": safe($0.objectValue?["timezone"]), "updatedAt": safe($0.objectValue?["updatedAt"])])
            }; return ["organizationId": organizationId.map(JSONValue.string) ?? .null, "channels": .array(Array(values)), "redactionStatus": .string("identity-and-content-excluded")]
        }
    }
 private static func safe(_ value:JSONValue?)->JSONValue{guard let value else{return .null};switch value{case .string,.number,.bool,.null:return value;default:return .null}}
    private static func json(_ any: Any) -> JSONValue {
        if any is NSNull { return .null }; if let v = any as? Bool { return .bool(v) }; if let v = any as? String { return .string(v) }; if let v = any as? NSNumber { return .number(v.doubleValue) }; if let v = any as? [Any] { return .array(v.map(json)) };
        if let v = any as? [String: Any] { return .object(v.mapValues(json)) }; return .null
    }
 private static func any(_ value:JSONValue)->Any{switch value{case .null:return NSNull();case .bool(let v):return v;case .number(let v):return v;case .string(let v):return v;case .array(let v):return v.map(any);case .object(let v):return v.mapValues(any)}}}
public struct BufferProviderActionAdapter: MarketplaceProviderActionAdapter {
    private let client: any BufferProviderActionClient; public init(client: any BufferProviderActionClient = FakeBufferProviderActionClient()) { self.client = client };
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "buffer" else { throw MarketplaceProviderActionAdapterFailure(code: "buffer_action_not_allowlisted", message: "Buffer action is not allowlisted.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executeBufferAction(request: request), error: nil, redactionStatus: "identity-and-content-excluded")
    }
}
extension JSONValue{fileprivate var objectValue:JSONRecord?{if case .object(let v)=self{return v};return nil};fileprivate var arrayValue:[JSONValue]?{if case .array(let v)=self{return v};return nil}}
