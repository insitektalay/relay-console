import Foundation
public struct AirshipProviderHTTPRequest:Sendable{public let url:URL;public let headers:[String:String]}
public struct AirshipProviderHTTPResponse:Sendable{public let statusCode:Int;public let body:Data}
public protocol AirshipProviderHTTPClient:Sendable{func send(_ request:AirshipProviderHTTPRequest)throws->AirshipProviderHTTPResponse}
private final class AirshipNoRedirect: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}
public struct URLSessionAirshipProviderHTTPClient: AirshipProviderHTTPClient {
    public init() {};
    public func send(_ request: AirshipProviderHTTPRequest) throws -> AirshipProviderHTTPResponse {
        var value = URLRequest(url: request.url); value.httpMethod = "GET"; value.timeoutInterval = 30; request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) };
        let session = URLSession(configuration: .ephemeral, delegate: AirshipNoRedirect(), delegateQueue: nil), semaphore = DispatchSemaphore(value: 0); var data = Data(), status = 0, failure: Error?;
        let task = session.dataTask(with: value) {
            data = $0 ?? Data(); status = ($1 as? HTTPURLResponse)?.statusCode ?? 0; failure = $2; semaphore.signal()
        }; task.resume(); if semaphore.wait(timeout: .now() + 30) == .timedOut { task.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "airship_http_timeout", message: "Airship request timed out.") }; session.invalidateAndCancel(); if let failure { throw failure };
        return AirshipProviderHTTPResponse(statusCode: status, body: data)
    }
}
public protocol AirshipProviderActionClient:Sendable{func executeAirshipAction(request:MarketplaceProviderActionAdapterRequest)throws->JSONRecord}
public struct FakeAirshipProviderActionClient: AirshipProviderActionClient {
    public init() {};
    public func executeAirshipAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        ["provider": .string("airship"), "action": .string(request.definition.actionKey), "redactionStatus": .string("segment-names-criteria-audiences-and-pagination-urls-excluded"), "liveCredentialsUsed": .bool(false)]
    }
}
public final class LiveAirshipProviderActionClient: AirshipProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService; private let secrets: SecretService; private let http: any AirshipProviderHTTPClient;
    public init(data: LocalDataService, secrets: SecretService, httpClient: any AirshipProviderHTTPClient = URLSessionAirshipProviderHTTPClient()) { self.data = data; self.secrets = secrets; self.http = httpClient };
    public func executeAirshipAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        guard request.definition.actionKey == "airship_segment_reference_list" else { throw MarketplaceProviderActionAdapterFailure(code: "airship_action_not_allowlisted", message: "Airship action is not allowlisted.") }; let auth = try authorization(request);
        let response = try http.send(AirshipProviderHTTPRequest(url: URL(string: auth.origin + "/api/segments?limit=25")!, headers: ["Authorization": "Bearer " + auth.token, "Accept": "application/vnd.urbanairship+json; version=3", "User-Agent": "RelayConsole-Airship/1.0"]));
        guard response.body.count <= 1_000_000 else { throw MarketplaceProviderActionAdapterFailure(code: "airship_response_too_large", message: "Airship response exceeded 1 MB.") };
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: response.statusCode == 401 ? "airship_token_invalid" : response.statusCode == 403 || response.statusCode == 404 ? "airship_permission_denied" : response.statusCode == 429 ? "airship_rate_limited" : "airship_api_error", message: "Airship API request failed.",
                providerStatusCode: response.statusCode)
        }; guard let any = try? JSONSerialization.jsonObject(with: response.body) else { throw MarketplaceProviderActionAdapterFailure(code: "airship_response_invalid", message: "Airship returned invalid JSON.") };
        let root = Self.json(any).airshipObject ?? [:],
            segments = (root["segments"]?.airshipArray ?? []).prefix(25).map { item -> JSONValue in
                let value = item.airshipObject ?? [:]; return .object(["id": Self.uuidValue(value["id"]), "creationDate": Self.safeInteger(value["creation_date"]), "modificationDate": Self.safeInteger(value["modification_date"])])
            }
        ; return ["cloudSite": .string(auth.site), "segments": .array(Array(segments)), "nextPageAvailable": .bool((root["next_page"]?.string?.isEmpty == false)), "redactionStatus": .string("segment-names-criteria-audiences-and-pagination-urls-excluded")]
    };
    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> (token: String, site: String, origin: String) {
        guard let id = request.auditIdentity.connectionId, let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), connection.appSlug == "airship",
            let tokenRef = connection.credentialRequirements.first(where: { $0.fieldKey == "airship_bearer_token" })?.secretReferenceId, let siteRef = connection.credentialRequirements.first(where: { $0.fieldKey == "airship_cloud_site" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "airship_connection_not_ready", message: "Airship connection is not ready.") }; let token = try secrets.getSecretValue(tokenRef), site = try secrets.getSecretValue(siteRef);
        guard !token.isEmpty, token.count <= 30000, !token.contains("\n"), !token.contains("\r"), let origin = Self.origins[site], connection.health.diagnostics["apiOrigin"]?.string == origin else {
            throw MarketplaceProviderActionAdapterFailure(code: "airship_credentials_invalid", message: "Airship credential binding is invalid.")
        }; return (token, site, origin)
    }; private static let origins = ["na": "https://go.urbanairship.com", "eu": "https://go.airship.eu"];
    private static func uuidValue(_ value: JSONValue?) -> JSONValue { guard let text = value?.string?.lowercased(), text.range(of: #"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"#, options: .regularExpression) != nil else { return .null }; return .string(text) };
    private static func safeInteger(_ value: JSONValue?) -> JSONValue { guard let number = value?.number, number >= 0, number.rounded() == number else { return .null }; return .number(number) };
    private static func json(_ any: Any) -> JSONValue {
        if any is NSNull { return .null }; if let value = any as? Bool { return .bool(value) }; if let value = any as? String { return .string(value) }; if let value = any as? NSNumber { return .number(value.doubleValue) }; if let value = any as? [Any] { return .array(value.map(json)) };
        if let value = any as? [String: Any] { return .object(value.mapValues(json)) }; return .null
    }
}
public struct AirshipProviderActionAdapter: MarketplaceProviderActionAdapter {
    private let client: any AirshipProviderActionClient; public init(client: any AirshipProviderActionClient = FakeAirshipProviderActionClient()) { self.client = client };
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "airship" else { throw MarketplaceProviderActionAdapterFailure(code: "airship_action_not_allowlisted", message: "Airship action is not allowlisted.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executeAirshipAction(request: request), error: nil, redactionStatus: "segment-names-criteria-audiences-and-pagination-urls-excluded")
    }
}
extension JSONValue{fileprivate var airshipObject:JSONRecord?{if case.object(let value)=self{return value};return nil};fileprivate var airshipArray:[JSONValue]?{if case.array(let value)=self{return value};return nil}}
