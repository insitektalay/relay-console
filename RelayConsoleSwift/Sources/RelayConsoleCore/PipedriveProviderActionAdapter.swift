import Foundation

public struct PipedriveProviderHTTPRequest: Sendable { public let url: URL; public let headers: [String: String]; public init(url: URL, headers: [String: String]) { self.url = url; self.headers = headers } }
public struct PipedriveProviderHTTPResponse: Sendable {
    public let statusCode: Int; public let headers: [String: String]; public let body: Data; public init(statusCode: Int, headers: [String: String] = [:], body: Data = Data()) { self.statusCode = statusCode; self.headers = headers; self.body = body }
}
public protocol PipedriveProviderHTTPClient: Sendable { func send(_ request: PipedriveProviderHTTPRequest) throws -> PipedriveProviderHTTPResponse }
private final class PipedriveNoRedirectDelegate: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}
public struct URLSessionPipedriveProviderHTTPClient: PipedriveProviderHTTPClient {
    public init() {};
    public func send(_ request: PipedriveProviderHTTPRequest) throws -> PipedriveProviderHTTPResponse {
        var value = URLRequest(url: request.url); value.httpMethod = "GET"; value.timeoutInterval = 20; request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) };
        let session = URLSession(configuration: .ephemeral, delegate: PipedriveNoRedirectDelegate(), delegateQueue: nil), semaphore = DispatchSemaphore(value: 0); var data: Data?, response: HTTPURLResponse?, failure: Error?;
        let task = session.dataTask(with: value) {
            data = $0; response = $1 as? HTTPURLResponse; failure = $2; semaphore.signal()
        }; task.resume(); if semaphore.wait(timeout: .now() + 20) == .timedOut { task.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "pipedrive_http_timeout", message: "Pipedrive API request timed out.") }; session.invalidateAndCancel(); if let failure { throw failure };
        return PipedriveProviderHTTPResponse(statusCode: response?.statusCode ?? 0, headers: response?.allHeaderFields.reduce(into: [:]) { $0[String(describing: $1.key)] = String(describing: $1.value) } ?? [:], body: data ?? Data())
    }
}

public struct PipedriveProviderActionClientResult: Sendable { public let result: JSONRecord; public init(result: JSONRecord) { self.result = result } }
public protocol PipedriveProviderActionClient: Sendable { func executePipedriveAction(request: MarketplaceProviderActionAdapterRequest) throws -> PipedriveProviderActionClientResult }
public struct FakePipedriveProviderActionClient: PipedriveProviderActionClient {
    public init() {};
    public func executePipedriveAction(request: MarketplaceProviderActionAdapterRequest) throws -> PipedriveProviderActionClientResult {
        switch request.definition.actionKey {
        case "pipedrive_organization_list": return out(["semanticReadContract": .string("pipedrive-organization-list-v1"), "organizations": .array([.object(PipedriveProviderActionSupport.fakeOrganization())])]);
        case "pipedrive_deal_list": return out(["semanticReadContract": .string("pipedrive-deal-list-v1"), "deals": .array([.object(PipedriveProviderActionSupport.fakeDeal())])]);
        case "pipedrive_deal_get": return out(["semanticReadContract": .string("pipedrive-deal-get-v1"), "deal": .object(PipedriveProviderActionSupport.fakeDeal())]);
        default: throw MarketplaceProviderActionAdapterFailure(code: "pipedrive_fake_action_not_supported", message: "Unsupported Pipedrive action.")
        }
    };
    private func out(_ fields: JSONRecord) -> PipedriveProviderActionClientResult {
        PipedriveProviderActionClientResult(
            result: ["provider": .string("pipedrive"), "adapterBoundary": .string("pipedrive-provider-action-adapter"), "clientMode": .string("fake-pipedrive-api-v2"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-state-excluded")].merging(fields) { _, new in new })
    }
}

public final class LivePipedriveProviderActionClient: PipedriveProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService; private let secrets: SecretService; private let http: any PipedriveProviderHTTPClient
    public init(data: LocalDataService, secrets: SecretService, httpClient: any PipedriveProviderHTTPClient = URLSessionPipedriveProviderHTTPClient()) { self.data = data; self.secrets = secrets; self.http = httpClient }
    public func executePipedriveAction(request: MarketplaceProviderActionAdapterRequest) throws -> PipedriveProviderActionClientResult {
        let auth = try authorization(request);
        switch request.definition.actionKey {
        case "pipedrive_organization_list":
            let root = try get(auth, path: "/api/v2/organizations", query: PipedriveProviderActionSupport.listQuery), values = (root.pipedriveObject?["data"]?.pipedriveArray ?? []).prefix(25).map { JSONValue.object(PipedriveProviderActionSupport.organization($0)) };
            return out(["semanticReadContract": .string("pipedrive-organization-list-v1"), "organizations": .array(Array(values))]);
        case "pipedrive_deal_list":
            let root = try get(auth, path: "/api/v2/deals", query: PipedriveProviderActionSupport.listQuery), values = (root.pipedriveObject?["data"]?.pipedriveArray ?? []).prefix(25).map { JSONValue.object(PipedriveProviderActionSupport.deal($0)) };
            return out(["semanticReadContract": .string("pipedrive-deal-list-v1"), "deals": .array(Array(values))]);
        case "pipedrive_deal_get":
            let id = try PipedriveProviderActionSupport.recordId(request.payload["dealId"]), root = try get(auth, path: "/api/v2/deals/\(id)", query: []);
            return out(["semanticReadContract": .string("pipedrive-deal-get-v1"), "deal": .object(PipedriveProviderActionSupport.deal(root.pipedriveObject?["data"] ?? .null))]);
        default: throw MarketplaceProviderActionAdapterFailure(code: "pipedrive_live_action_not_supported", message: "Unsupported live Pipedrive action.")
        }
    }
    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> (token: String, domain: URL) {
        guard let id = request.auditIdentity.connectionId, let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), connection.appSlug == "pipedrive",
            let ref = connection.credentialRequirements.first(where: { $0.fieldKey == "pipedrive_oauth_access_token" })?.secretReferenceId, let raw = connection.health.diagnostics["apiDomain"]?.string, let domain = PipedriveProviderActionSupport.apiDomain(raw)
        else { throw MarketplaceProviderActionAdapterFailure(code: "pipedrive_connection_not_ready", message: "Pipedrive company connection is not ready.") }; return (try secrets.getSecretValue(ref), domain)
    }
    private func get(_ auth: (token: String, domain: URL), path: String, query: [URLQueryItem]) throws -> JSONValue {
        var c = URLComponents(url: auth.domain.appendingPathComponent(String(path.dropFirst())), resolvingAgainstBaseURL: false)!; c.queryItems = query.isEmpty ? nil : query;
        let response = try http.send(PipedriveProviderHTTPRequest(url: c.url!, headers: ["Authorization": "Bearer " + auth.token, "Accept": "application/json", "User-Agent": "RelayConsole-Pipedrive/1.0"])),
            value = (try? JSONSerialization.jsonObject(with: response.body)).map(PipedriveProviderActionSupport.json) ?? .null
        ;
        guard (200..<300).contains(response.statusCode), value.pipedriveObject?["success"]?.bool != false else {
            throw MarketplaceProviderActionAdapterFailure(
                code: response.statusCode == 401 ? "pipedrive_token_invalid" : response.statusCode == 403 ? "pipedrive_scope_denied" : response.statusCode == 429 ? "pipedrive_rate_limited" : "pipedrive_api_error", message: "Pipedrive API request failed.", providerStatusCode: response.statusCode,
                detail: ["error": value.pipedriveObject?["error"] ?? .null, "retryAfter": response.headers.first { $0.key.lowercased() == "retry-after" }.map { .string(String($0.value.prefix(32))) } ?? .null])
        }; return value
    }
    private func out(_ fields: JSONRecord) -> PipedriveProviderActionClientResult {
        PipedriveProviderActionClientResult(
            result: ["provider": .string("pipedrive"), "adapterBoundary": .string("pipedrive-provider-action-adapter"), "clientMode": .string("live-pipedrive-api-v2"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-state-excluded")].merging(fields) { _, new in new })
    }
}

public struct PipedriveProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = ["pipedrive_organization_list", "pipedrive_deal_list", "pipedrive_deal_get"]; private let client: any PipedriveProviderActionClient; public init(client: any PipedriveProviderActionClient = FakePipedriveProviderActionClient()) { self.client = client };
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "pipedrive", Self.allowed.contains(request.definition.actionKey) else { throw MarketplaceProviderActionAdapterFailure(code: "pipedrive_action_not_allowlisted", message: "Pipedrive action is outside read-only V1.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executePipedriveAction(request: request).result, error: nil, redactionStatus: "private-state-excluded")
    }
}

enum PipedriveProviderActionSupport {
    static let listQuery = [URLQueryItem(name: "limit", value: "25"), URLQueryItem(name: "sort_by", value: "update_time"), URLQueryItem(name: "sort_direction", value: "desc")]
    static func apiDomain(_ raw: String) -> URL? {
        guard let c = URLComponents(string: raw), c.scheme == "https", let host = c.host?.lowercased(), host.hasSuffix(".pipedrive.com"), host != ".pipedrive.com", c.user == nil, c.password == nil, c.port == nil, c.query == nil, c.fragment == nil, c.path.isEmpty || c.path == "/" else { return nil };
        return URL(string: "https://" + host)
    }
    static func recordId(_ value: JSONValue?) throws -> String {
        guard let id = value?.string, let number = Int64(id), number > 0, String(number) == id else { throw MarketplaceProviderActionAdapterFailure(code: "pipedrive_deal_id_invalid", message: "A positive numeric Pipedrive Deal ID is required.") }; return id
    }
    static func scalar(_ value: JSONValue?) -> JSONValue { guard let value else { return .null }; switch value { case .string(let text): return .string(String(text.prefix(512))); case .number, .bool, .null: return value; default: return .null } }
    static func organization(_ value: JSONValue) -> JSONRecord { let o = value.pipedriveObject ?? [:]; return ["OrganizationId": scalar(o["id"]), "Name": scalar(o["name"]), "AddedAt": scalar(o["add_time"]), "UpdatedAt": scalar(o["update_time"])] }
    static func deal(_ value: JSONValue) -> JSONRecord {
        let o = value.pipedriveObject ?? [:];
        return [
            "DealId": scalar(o["id"]), "Title": scalar(o["title"]), "Value": scalar(o["value"]), "Currency": scalar(o["currency"]), "Status": scalar(o["status"]), "StageId": scalar(o["stage_id"]), "PipelineId": scalar(o["pipeline_id"]), "OrganizationId": scalar(o["org_id"]),
            "ExpectedCloseDate": scalar(o["expected_close_date"]), "AddedAt": scalar(o["add_time"]), "UpdatedAt": scalar(o["update_time"]),
        ]
    }
    static func fakeOrganization() -> JSONRecord { ["OrganizationId": .number(1001), "Name": .string("Relay Customer"), "AddedAt": .string("2026-01-01 00:00:00"), "UpdatedAt": .string("2026-07-11 10:00:00")] }
    static func fakeDeal() -> JSONRecord {
        [
            "DealId": .number(2001), "Title": .string("Relay Renewal"), "Value": .number(12000), "Currency": .string("GBP"), "Status": .string("open"), "StageId": .number(3), "PipelineId": .number(1), "OrganizationId": .number(1001), "ExpectedCloseDate": .string("2026-09-30"),
            "AddedAt": .string("2026-01-01 00:00:00"), "UpdatedAt": .string("2026-07-11 10:00:00"),
        ]
    }
    static func json(_ value: Any) -> JSONValue {
        if let v = value as? String { return .string(v) }; if let v = value as? Bool { return .bool(v) }; if let v = value as? Int { return .number(Double(v)) }; if let v = value as? Double { return .number(v) }; if let v = value as? [String: Any] { return .object(v.mapValues(json)) };
        if let v = value as? [Any] { return .array(v.map(json)) }; return .null
    }
}
private extension JSONValue { var pipedriveObject: JSONRecord? { if case .object(let value) = self { return value }; return nil }; var pipedriveArray: [JSONValue]? { if case .array(let value) = self { return value }; return nil } }
