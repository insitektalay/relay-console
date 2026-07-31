import Foundation

public struct MeltwaterProviderHTTPRequest:Sendable{public let url:URL;public let headers:[String:String]}
public struct MeltwaterProviderHTTPResponse:Sendable{public let statusCode:Int;public let body:Data}
public protocol MeltwaterProviderHTTPClient:Sendable{func send(_ request:MeltwaterProviderHTTPRequest)throws->MeltwaterProviderHTTPResponse}
private final class MeltwaterNoRedirect: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}
public struct URLSessionMeltwaterProviderHTTPClient: MeltwaterProviderHTTPClient {
    public init() {};
    public func send(_ request: MeltwaterProviderHTTPRequest) throws -> MeltwaterProviderHTTPResponse {
        var value = URLRequest(url: request.url); value.httpMethod = "GET"; value.timeoutInterval = 20; request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) };
        let session = URLSession(configuration: .ephemeral, delegate: MeltwaterNoRedirect(), delegateQueue: nil), semaphore = DispatchSemaphore(value: 0); var data = Data(), status = 0, failure: Error?;
        let task = session.dataTask(with: value) {
            data = $0 ?? Data(); status = ($1 as? HTTPURLResponse)?.statusCode ?? 0; failure = $2; semaphore.signal()
        }; task.resume(); if semaphore.wait(timeout: .now() + 20) == .timedOut { task.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "meltwater_http_timeout", message: "Meltwater request timed out.") }; session.invalidateAndCancel(); if let failure { throw failure };
        return MeltwaterProviderHTTPResponse(statusCode: status, body: data)
    }
}

public protocol MeltwaterProviderActionClient:Sendable{func executeMeltwaterAction(request:MarketplaceProviderActionAdapterRequest)throws->JSONRecord}
public struct FakeMeltwaterProviderActionClient: MeltwaterProviderActionClient {
    public init() {};
    public func executeMeltwaterAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord { ["provider": .string("meltwater"), "action": .string(request.definition.actionKey), "redactionStatus": .string("identity-and-content-excluded"), "liveCredentialsUsed": .bool(false)] }
}

public final class LiveMeltwaterProviderActionClient:MeltwaterProviderActionClient,@unchecked Sendable{
  private let data:LocalDataService;private let secrets:SecretService;private let http:any MeltwaterProviderHTTPClient
  public init(data:LocalDataService,secrets:SecretService,httpClient:any MeltwaterProviderHTTPClient=URLSessionMeltwaterProviderHTTPClient()){self.data=data;self.secrets=secrets;self.http=httpClient}
    public func executeMeltwaterAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        let token = try authorization(request), action = request.definition.actionKey, path: String;
        if action == "meltwater_api_usage_get" {
            path = "/v3/usage/me/requests?period=24hours"
        } else if action == "meltwater_search_reference_list" {
            path = "/v3/searches"
        } else {
            throw MarketplaceProviderActionAdapterFailure(code: "meltwater_action_not_allowlisted", message: "Meltwater action is not allowlisted.")
        }; let response = try http.send(MeltwaterProviderHTTPRequest(url: URL(string: "https://api.meltwater.com" + path)!, headers: ["apikey": token, "Accept": "application/json", "User-Agent": "RelayConsole-Meltwater/1.0"]));
        guard response.body.count <= 1_000_000 else { throw MarketplaceProviderActionAdapterFailure(code: "meltwater_response_too_large", message: "Meltwater response exceeded 1 MB.") };
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: response.statusCode == 401 ? "meltwater_token_invalid" : response.statusCode == 403 || response.statusCode == 404 ? "meltwater_permission_denied" : response.statusCode == 429 ? "meltwater_rate_limited" : "meltwater_api_error", message: "Meltwater API request failed.",
                providerStatusCode: response.statusCode)
        }; guard let any = try? JSONSerialization.jsonObject(with: response.body) else { throw MarketplaceProviderActionAdapterFailure(code: "meltwater_response_invalid", message: "Meltwater returned invalid JSON.") }; let root = Self.json(any);
        return action == "meltwater_api_usage_get" ? Self.usageResult(root) : Self.searchResult(root)
    }
    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> String {
        guard let id = request.auditIdentity.connectionId, let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), connection.appSlug == "meltwater", connection.health.diagnostics["apiOrigin"]?.string == "https://api.meltwater.com",
            let tokenRef = connection.credentialRequirements.first(where: { $0.fieldKey == "meltwater_api_token" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "meltwater_connection_not_ready", message: "Meltwater connection is not ready.") }; let token = try secrets.getSecretValue(tokenRef);
        guard !token.isEmpty, !token.contains("\n"), !token.contains("\r") else { throw MarketplaceProviderActionAdapterFailure(code: "meltwater_credentials_invalid", message: "Meltwater credential binding is invalid.") }; return token
    }
    private static func usageResult(_ root: JSONValue) -> JSONRecord {
        let item = root.meltwaterObject ?? [:], points = item["time_series"]?.meltwaterArray?.count ?? 0;
        return ["period": .string("24hours"), "count": safeNumberValue(item["count"]), "units": safeEnumValue(item["units"]), "timeSeriesPointCount": .number(Double(min(points, 10_000))), "redactionStatus": .string("token-and-endpoint-details-excluded")]
    }
    private static func searchResult(_ root: JSONValue) -> JSONRecord {
        let source = (root.meltwaterObject ?? [:])["searches"]?.meltwaterArray ?? [];
        let searches = source.prefix(25).compactMap { value -> JSONValue? in
            let item = value.meltwaterObject ?? [:], id = item["id"]?.string ?? item["id"]?.number.map { String(Int($0)) } ?? item["search_id"]?.string ?? item["search_id"]?.number.map { String(Int($0)) }; guard let id, safeId(id) else { return nil };
            return .object(["searchId": .string(id), "updatedAt": safeTimestampValue(item["updated"])])
        }; return ["searches": .array(searches), "redactionStatus": .string("search-identity-query-and-content-excluded")]
    }
    private static func safeId(_ value: String) -> Bool { value.range(of: #"^[A-Za-z0-9_-]{1,128}$"#, options: .regularExpression) != nil };
    private static func safeEnumValue(_ value: JSONValue?) -> JSONValue { guard let text = value?.string, text.range(of: #"^[A-Za-z0-9_-]{1,32}$"#, options: .regularExpression) != nil else { return .null }; return .string(text) };
    private static func safeTimestampValue(_ value: JSONValue?) -> JSONValue { guard let text = value?.string, text.range(of: #"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$"#, options: .regularExpression) != nil else { return .null }; return .string(text) };
    private static func safeNumberValue(_ value: JSONValue?) -> JSONValue { guard let number = value?.number, number >= 0, number.rounded() == number else { return .null }; return .number(number) };
    private static func json(_ any: Any) -> JSONValue {
        if any is NSNull { return .null }; if let value = any as? Bool { return .bool(value) }; if let value = any as? String { return .string(value) }; if let value = any as? NSNumber { return .number(value.doubleValue) }; if let value = any as? [Any] { return .array(value.map(json)) };
        if let value = any as? [String: Any] { return .object(value.mapValues(json)) }; return .null
    }
}
public struct MeltwaterProviderActionAdapter: MarketplaceProviderActionAdapter {
    private let client: any MeltwaterProviderActionClient; public init(client: any MeltwaterProviderActionClient = FakeMeltwaterProviderActionClient()) { self.client = client };
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "meltwater" else { throw MarketplaceProviderActionAdapterFailure(code: "meltwater_action_not_allowlisted", message: "Meltwater action is not allowlisted.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executeMeltwaterAction(request: request), error: nil, redactionStatus: "identity-and-content-excluded")
    }
}
extension JSONValue{fileprivate var meltwaterObject:JSONRecord?{if case.object(let value)=self{return value};return nil};fileprivate var meltwaterArray:[JSONValue]?{if case.array(let value)=self{return value};return nil}}
