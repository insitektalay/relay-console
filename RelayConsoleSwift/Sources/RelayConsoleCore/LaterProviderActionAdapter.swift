import Foundation
public struct LaterProviderHTTPRequest:Sendable{public let method:String;public let url:URL;public let headers:[String:String];public let body:Data?}
public struct LaterProviderHTTPResponse:Sendable{public let statusCode:Int;public let body:Data}
public protocol LaterProviderHTTPClient:Sendable{func send(_ request:LaterProviderHTTPRequest)throws->LaterProviderHTTPResponse}
private final class LaterNoRedirect:NSObject,URLSessionTaskDelegate,@unchecked Sendable{func urlSession(_ session:URLSession,task:URLSessionTask,willPerformHTTPRedirection response:HTTPURLResponse,newRequest request:URLRequest,completionHandler:@escaping(URLRequest?)->Void){completionHandler(nil)}}
public struct URLSessionLaterProviderHTTPClient: LaterProviderHTTPClient {
    public init() {};
    public func send(_ request: LaterProviderHTTPRequest) throws -> LaterProviderHTTPResponse {
        var value = URLRequest(url: request.url); value.httpMethod = request.method; value.httpBody = request.body; value.timeoutInterval = 20; request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) };
        let session = URLSession(configuration: .ephemeral, delegate: LaterNoRedirect(), delegateQueue: nil), semaphore = DispatchSemaphore(value: 0); var data = Data(), status = 0, failure: Error?;
        let task = session.dataTask(with: value) {
            data = $0 ?? Data(); status = ($1 as? HTTPURLResponse)?.statusCode ?? 0; failure = $2; semaphore.signal()
        }; task.resume(); if semaphore.wait(timeout: .now() + 20) == .timedOut { task.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "later_http_timeout", message: "Later request timed out.") }; session.invalidateAndCancel(); if let failure { throw failure };
        return LaterProviderHTTPResponse(statusCode: status, body: data)
    }
}
public protocol LaterProviderActionClient:Sendable{func executeLaterAction(request:MarketplaceProviderActionAdapterRequest)throws->JSONRecord}
public struct FakeLaterProviderActionClient: LaterProviderActionClient {
    public init() {};
    public func executeLaterAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        ["provider": .string("later"), "action": .string(request.definition.actionKey), "redactionStatus": .string("identity-content-and-financial-data-excluded"), "liveCredentialsUsed": .bool(false)]
    }
}
public final class LiveLaterProviderActionClient: LaterProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService; private let secrets: SecretService; private let http: any LaterProviderHTTPClient;
    public init(data: LocalDataService, secrets: SecretService, httpClient: any LaterProviderHTTPClient = URLSessionLaterProviderHTTPClient()) { self.data = data; self.secrets = secrets; self.http = httpClient }
    public func executeLaterAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        let token = try accessToken(try credentials(request)), action = request.definition.actionKey; var components = URLComponents(string: "https://reporting.api.later.com")!;
        if action == "later_instance_id_list" {
            components.path = "/v2/instances"; components.queryItems = [URLQueryItem(name: "limit", value: "25")]
        } else {
            guard let start = request.payload["startDate"]?.string, let end = request.payload["endDate"]?.string, validDates(start, end) else {
                throw MarketplaceProviderActionAdapterFailure(code: "later_date_window_invalid", message: "Later date window must be valid, ordered, and at most 31 inclusive days.")
            }; components.path = action == "later_instance_performance_get" ? "/v2/instances/performance" : "/v2/campaigns/performance";
            components.queryItems = [
                URLQueryItem(name: "startDate", value: start), URLQueryItem(name: "endDate", value: end), URLQueryItem(name: "dateBasis", value: "performance_date"), URLQueryItem(name: "metrics", value: "engagements"), URLQueryItem(name: "metrics", value: "impressions"),
                URLQueryItem(name: "metrics", value: "reach"),
            ];
            if action == "later_campaign_performance_list" {
                guard let id = request.payload["instanceId"]?.string, id.range(of: #"^[A-Za-z0-9_-]{1,200}$"#, options: .regularExpression) != nil else { throw MarketplaceProviderActionAdapterFailure(code: "later_instance_id_invalid", message: "Later instance ID is invalid.") };
                components.queryItems! += [URLQueryItem(name: "instanceIds", value: id), URLQueryItem(name: "limit", value: "25")]
            } else if action != "later_instance_performance_get" {
                throw MarketplaceProviderActionAdapterFailure(code: "later_action_not_supported", message: "Unsupported Later action.")
            }
        }; let response = try http.send(LaterProviderHTTPRequest(method: "GET", url: components.url!, headers: ["Authorization": "Bearer " + token, "Accept": "application/json"], body: nil)), root = try decode(response), payload = root["data"]?.objectValue ?? [:];
        if action == "later_instance_id_list" {
            let ids = (payload["instanceIds"]?.arrayValue ?? []).prefix(25).compactMap { $0.string }.filter { $0.range(of: #"^[A-Za-z0-9_-]{1,200}$"#, options: .regularExpression) != nil }.map(JSONValue.string);
            return ["instanceIds": .array(ids), "nextCursorExcluded": .bool(true), "redactionStatus": .string("identity-content-and-financial-data-excluded")]
        }; let start = request.payload["startDate"] ?? .null, end = request.payload["endDate"] ?? .null;
        if action == "later_instance_performance_get" { return ["startDate": start, "endDate": end, "metrics": .object(metrics(payload)), "freshness": .string("normally current through the previous day"), "redactionStatus": .string("identity-content-and-financial-data-excluded")] };
        let campaigns = (root["data"]?.arrayValue ?? []).prefix(25).compactMap { value -> JSONValue? in
            let o = value.objectValue ?? [:], id = o["campaignId"]?.string ?? o["id"]?.string; guard let id, id.range(of: #"^[A-Za-z0-9_-]{1,200}$"#, options: .regularExpression) != nil else { return nil }; return .object(["campaignId": .string(id), "metrics": .object(metrics(o))])
        };
        return [
            "instanceId": request.payload["instanceId"] ?? .null, "startDate": start, "endDate": end, "campaigns": .array(campaigns), "nextCursorExcluded": .bool(true), "freshness": .string("normally current through the previous day"),
            "redactionStatus": .string("identity-content-and-financial-data-excluded"),
        ]
    }
    private func credentials(_ request: MarketplaceProviderActionAdapterRequest) throws -> (String, String) {
        guard let id = request.auditIdentity.connectionId, let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), connection.appSlug == "later", connection.health.diagnostics["apiOrigin"]?.string == "https://reporting.api.later.com",
            let clientRef = connection.credentialRequirements.first(where: { $0.fieldKey == "later_client_id" })?.secretReferenceId, let secretRef = connection.credentialRequirements.first(where: { $0.fieldKey == "later_client_secret" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "later_connection_not_ready", message: "Later Reporting API client credentials are not ready.") }; return (try secrets.getSecretValue(clientRef), try secrets.getSecretValue(secretRef))
    }
    private func accessToken(_ credentials: (String, String)) throws -> String {
        let body = try JSONSerialization.data(withJSONObject: ["clientId": credentials.0, "clientSecret": credentials.1]),
            response = try http.send(LaterProviderHTTPRequest(method: "POST", url: URL(string: "https://reporting.api.later.com/oauth/token")!, headers: ["Accept": "application/json", "Content-Type": "application/json"], body: body)), root = try decode(response)
        ; guard let token = root["jwt"]?.string, !token.isEmpty, token.count <= 30000 else { throw MarketplaceProviderActionAdapterFailure(code: "later_token_failed", message: "Later did not return a usable access token.") }; return token
    }
    private func validDates(_ start: String, _ end: String) -> Bool {
        let formatter = DateFormatter(); formatter.calendar = Calendar(identifier: .gregorian); formatter.locale = Locale(identifier: "en_US_POSIX"); formatter.timeZone = TimeZone(secondsFromGMT: 0); formatter.dateFormat = "yyyy-MM-dd"; formatter.isLenient = false;
        guard start.range(of: #"^[0-9]{4}-[0-9]{2}-[0-9]{2}$"#, options: .regularExpression) != nil, end.range(of: #"^[0-9]{4}-[0-9]{2}-[0-9]{2}$"#, options: .regularExpression) != nil, let a = formatter.date(from: start), let b = formatter.date(from: end), b >= a else { return false };
        return b.timeIntervalSince(a) <= 30 * 86400
    }
 private func metrics(_ value:JSONRecord)->JSONRecord{var out:JSONRecord=[:];for key in ["engagements","impressions","reach"]{out[key]=value[key]?.number.map(JSONValue.number) ?? .null};return out}
    private func decode(_ response: LaterProviderHTTPResponse) throws -> JSONRecord {
        guard response.body.count <= 1_000_000 else { throw MarketplaceProviderActionAdapterFailure(code: "later_response_too_large", message: "Later response exceeded 1 MB.") };
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: response.statusCode == 401 ? "later_token_invalid" : response.statusCode == 403 ? "later_instance_scope_denied" : response.statusCode == 429 ? "later_rate_limited" : "later_api_error", message: "Later Reporting API request failed.", providerStatusCode: response.statusCode)
        }; return (try? JSONSerialization.jsonObject(with: response.body)).map(Self.json)?.objectValue ?? [:]
    }
    private static func json(_ any: Any) -> JSONValue {
        if any is NSNull { return .null }; if let v = any as? Bool { return .bool(v) }; if let v = any as? String { return .string(v) }; if let v = any as? NSNumber { return .number(v.doubleValue) }; if let v = any as? [Any] { return .array(v.map(json)) };
        if let v = any as? [String: Any] { return .object(v.mapValues(json)) }; return .null
    }
}
public struct LaterProviderActionAdapter: MarketplaceProviderActionAdapter {
    private let client: any LaterProviderActionClient; public init(client: any LaterProviderActionClient = FakeLaterProviderActionClient()) { self.client = client };
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "later" else { throw MarketplaceProviderActionAdapterFailure(code: "later_action_not_allowlisted", message: "Later action is not allowlisted.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executeLaterAction(request: request), error: nil, redactionStatus: "identity-content-and-financial-data-excluded")
    }
}
extension JSONValue{fileprivate var objectValue:JSONRecord?{if case .object(let v)=self{return v};return nil};fileprivate var arrayValue:[JSONValue]?{if case .array(let v)=self{return v};return nil}}
