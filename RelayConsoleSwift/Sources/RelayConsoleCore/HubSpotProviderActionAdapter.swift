import Foundation

public struct HubSpotProviderHTTPRequest: Sendable {
    public let method: String; public let url: URL; public let headers: [String: String]; public let body: Data?; public init(method: String, url: URL, headers: [String: String], body: Data? = nil) { self.method = method; self.url = url; self.headers = headers; self.body = body }
}
public struct HubSpotProviderHTTPResponse: Sendable {
    public let statusCode: Int; public let headers: [String: String]; public let body: Data; public init(statusCode: Int, headers: [String: String] = [:], body: Data = Data()) { self.statusCode = statusCode; self.headers = headers; self.body = body }
}
public protocol HubSpotProviderHTTPClient: Sendable { func send(_ request: HubSpotProviderHTTPRequest) throws -> HubSpotProviderHTTPResponse }
private final class HubSpotNoRedirectDelegate: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}
public struct URLSessionHubSpotProviderHTTPClient: HubSpotProviderHTTPClient {
    public init() {};
    public func send(_ request: HubSpotProviderHTTPRequest) throws -> HubSpotProviderHTTPResponse {
        var value = URLRequest(url: request.url); value.httpMethod = request.method; value.httpBody = request.body; value.timeoutInterval = 20; request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) };
        let session = URLSession(configuration: .ephemeral, delegate: HubSpotNoRedirectDelegate(), delegateQueue: nil), semaphore = DispatchSemaphore(value: 0); var data: Data?, response: HTTPURLResponse?, failure: Error?;
        let task = session.dataTask(with: value) {
            data = $0; response = $1 as? HTTPURLResponse; failure = $2; semaphore.signal()
        }; task.resume(); if semaphore.wait(timeout: .now() + 20) == .timedOut { task.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "hubspot_http_timeout", message: "HubSpot CRM request timed out.") }; session.invalidateAndCancel(); if let failure { throw failure };
        return HubSpotProviderHTTPResponse(statusCode: response?.statusCode ?? 0, headers: response?.allHeaderFields.reduce(into: [:]) { $0[String(describing: $1.key)] = String(describing: $1.value) } ?? [:], body: data ?? Data())
    }
}

public struct HubSpotProviderActionClientResult: Sendable { public let result: JSONRecord; public init(result: JSONRecord) { self.result = result } }
public protocol HubSpotProviderActionClient: Sendable { func executeHubSpotAction(request: MarketplaceProviderActionAdapterRequest) throws -> HubSpotProviderActionClientResult }
public struct FakeHubSpotProviderActionClient: HubSpotProviderActionClient {
    public init() {};
    public func executeHubSpotAction(request: MarketplaceProviderActionAdapterRequest) throws -> HubSpotProviderActionClientResult {
        switch request.definition.actionKey {
        case "hubspot_company_list": return out(["semanticReadContract": .string("hubspot-company-list-v1"), "companies": .array([.object(HubSpotProviderActionSupport.fakeCompany())])]);
        case "hubspot_deal_list": return out(["semanticReadContract": .string("hubspot-deal-list-v1"), "deals": .array([.object(HubSpotProviderActionSupport.fakeDeal())])]);
        case "hubspot_deal_get": return out(["semanticReadContract": .string("hubspot-deal-get-v1"), "deal": .object(HubSpotProviderActionSupport.fakeDeal())]);
        default: throw MarketplaceProviderActionAdapterFailure(code: "hubspot_fake_action_not_supported", message: "Unsupported HubSpot action.")
        }
    };
    private func out(_ fields: JSONRecord) -> HubSpotProviderActionClientResult {
        HubSpotProviderActionClientResult(
            result: ["provider": .string("hubspot"), "adapterBoundary": .string("hubspot-provider-action-adapter"), "clientMode": .string("fake-hubspot-static-crm"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-state-excluded")].merging(fields) { _, new in new })
    }
}

public final class LiveHubSpotProviderActionClient: HubSpotProviderActionClient, @unchecked Sendable {
    public static let apiDateVersion = "2026-03"
    private let data: LocalDataService; private let secrets: SecretService; private let http: any HubSpotProviderHTTPClient
    public init(data: LocalDataService, secrets: SecretService, httpClient: any HubSpotProviderHTTPClient = URLSessionHubSpotProviderHTTPClient()) { self.data = data; self.secrets = secrets; self.http = httpClient }
    public func executeHubSpotAction(request: MarketplaceProviderActionAdapterRequest) throws -> HubSpotProviderActionClientResult {
        let token = try authorization(request);
        switch request.definition.actionKey {
        case "hubspot_company_list":
            let root = try search(token, object: "companies", properties: HubSpotProviderActionSupport.companyProperties), values = (root.hubSpotObject?["results"]?.hubSpotArray ?? []).prefix(25).map { JSONValue.object(HubSpotProviderActionSupport.company($0)) };
            return out(["semanticReadContract": .string("hubspot-company-list-v1"), "companies": .array(Array(values))]);
        case "hubspot_deal_list":
            let root = try search(token, object: "deals", properties: HubSpotProviderActionSupport.dealProperties), values = (root.hubSpotObject?["results"]?.hubSpotArray ?? []).prefix(25).map { JSONValue.object(HubSpotProviderActionSupport.deal($0)) };
            return out(["semanticReadContract": .string("hubspot-deal-list-v1"), "deals": .array(Array(values))]);
        case "hubspot_deal_get": let id = try HubSpotProviderActionSupport.recordId(request.payload["dealId"]), root = try get(token, id: id); return out(["semanticReadContract": .string("hubspot-deal-get-v1"), "deal": .object(HubSpotProviderActionSupport.deal(root))]);
        default: throw MarketplaceProviderActionAdapterFailure(code: "hubspot_live_action_not_supported", message: "Unsupported live HubSpot action.")
        }
    }
    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> String {
        guard let id = request.auditIdentity.connectionId, let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), connection.appSlug == "hubspot",
            let ref = connection.credentialRequirements.first(where: { $0.fieldKey == "hubspot_oauth_access_token" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "hubspot_connection_not_ready", message: "HubSpot account connection is not ready.") }; return try secrets.getSecretValue(ref)
    }
    private func search(_ token: String, object: String, properties: [String]) throws -> JSONValue {
        let body = try JSONSerialization.data(withJSONObject: ["filterGroups": [], "limit": 25, "properties": properties, "sorts": ["hs_lastmodifieddate"]]);
        return try send(
            HubSpotProviderHTTPRequest(
                method: "POST", url: URL(string: "https://api.hubapi.com/crm/objects/\(Self.apiDateVersion)/\(object)/search")!, headers: ["Authorization": "Bearer " + token, "Accept": "application/json", "Content-Type": "application/json", "User-Agent": "RelayConsole-HubSpot/1.0"], body: body))
    }
    private func get(_ token: String, id: String) throws -> JSONValue {
        var c = URLComponents(string: "https://api.hubapi.com/crm/objects/\(Self.apiDateVersion)/deals/\(id)")!; c.queryItems = [URLQueryItem(name: "properties", value: HubSpotProviderActionSupport.dealProperties.joined(separator: ",")), URLQueryItem(name: "archived", value: "false")];
        return try send(HubSpotProviderHTTPRequest(method: "GET", url: c.url!, headers: ["Authorization": "Bearer " + token, "Accept": "application/json", "User-Agent": "RelayConsole-HubSpot/1.0"]))
    }
    private func send(_ request: HubSpotProviderHTTPRequest) throws -> JSONValue {
        let response = try http.send(request), value = (try? JSONSerialization.jsonObject(with: response.body)).map(HubSpotProviderActionSupport.json) ?? .null;
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: response.statusCode == 401 ? "hubspot_token_invalid" : response.statusCode == 403 ? "hubspot_scope_denied" : response.statusCode == 429 ? "hubspot_rate_limited" : "hubspot_api_error", message: "HubSpot CRM request failed.", providerStatusCode: response.statusCode,
                detail: ["category": value.hubSpotObject?["category"] ?? .null, "correlationId": value.hubSpotObject?["correlationId"] ?? .null, "retryAfter": response.headers.first { $0.key.lowercased() == "retry-after" }.map { .string(String($0.value.prefix(32))) } ?? .null])
        }; return value
    }
    private func out(_ fields: JSONRecord) -> HubSpotProviderActionClientResult {
        HubSpotProviderActionClientResult(
            result: [
                "provider": .string("hubspot"), "adapterBoundary": .string("hubspot-provider-action-adapter"), "clientMode": .string("live-hubspot-static-crm"), "apiDateVersion": .string(Self.apiDateVersion), "rawProviderToolExposure": .bool(false),
                "redactionStatus": .string("private-state-excluded"),
            ].merging(fields) { _, new in new })
    }
}

public struct HubSpotProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = ["hubspot_company_list", "hubspot_deal_list", "hubspot_deal_get"]; private let client: any HubSpotProviderActionClient; public init(client: any HubSpotProviderActionClient = FakeHubSpotProviderActionClient()) { self.client = client };
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "hubspot", Self.allowed.contains(request.definition.actionKey) else { throw MarketplaceProviderActionAdapterFailure(code: "hubspot_action_not_allowlisted", message: "HubSpot action is outside read-only V1.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executeHubSpotAction(request: request).result, error: nil, redactionStatus: "private-state-excluded")
    }
}

enum HubSpotProviderActionSupport {
    static let companyProperties = ["name", "domain", "industry", "country", "createdate", "hs_lastmodifieddate"]
    static let dealProperties = ["dealname", "amount", "closedate", "pipeline", "dealstage", "createdate", "hs_lastmodifieddate"]
    static func recordId(_ value: JSONValue?) throws -> String {
        guard let id = value?.string, let number = Int64(id), number > 0, String(number) == id else { throw MarketplaceProviderActionAdapterFailure(code: "hubspot_deal_id_invalid", message: "A positive numeric HubSpot Deal ID is required.") }; return id
    }
    static func scalar(_ value: JSONValue?) -> JSONValue { guard let value else { return .null }; switch value { case .string(let text): return .string(String(text.prefix(512))); case .number, .bool, .null: return value; default: return .null } }
    static func company(_ value: JSONValue) -> JSONRecord {
        let o = value.hubSpotObject ?? [:], p = o["properties"]?.hubSpotObject ?? [:];
        return ["CompanyId": scalar(o["id"]), "Name": scalar(p["name"]), "Domain": scalar(p["domain"]), "Industry": scalar(p["industry"]), "Country": scalar(p["country"]), "CreatedAt": scalar(p["createdate"]), "LastModifiedAt": scalar(p["hs_lastmodifieddate"])]
    }
    static func deal(_ value: JSONValue) -> JSONRecord {
        let o = value.hubSpotObject ?? [:], p = o["properties"]?.hubSpotObject ?? [:];
        return [
            "DealId": scalar(o["id"]), "DealName": scalar(p["dealname"]), "Amount": scalar(p["amount"]), "CloseDate": scalar(p["closedate"]), "PipelineId": scalar(p["pipeline"]), "DealStageId": scalar(p["dealstage"]), "CreatedAt": scalar(p["createdate"]),
            "LastModifiedAt": scalar(p["hs_lastmodifieddate"]),
        ]
    }
    static func fakeCompany() -> JSONRecord {
        ["CompanyId": .string("1001"), "Name": .string("Relay Customer"), "Domain": .string("example.com"), "Industry": .string("TECHNOLOGY_SOFTWARE"), "Country": .string("GB"), "CreatedAt": .string("2026-01-01T00:00:00Z"), "LastModifiedAt": .string("2026-07-11T10:00:00Z")]
    }
    static func fakeDeal() -> JSONRecord {
        [
            "DealId": .string("2001"), "DealName": .string("Relay Renewal"), "Amount": .string("12000.00"), "CloseDate": .string("2026-09-30T00:00:00Z"), "PipelineId": .string("default"), "DealStageId": .string("contractsent"), "CreatedAt": .string("2026-01-01T00:00:00Z"),
            "LastModifiedAt": .string("2026-07-11T10:00:00Z"),
        ]
    }
    static func json(_ value: Any) -> JSONValue {
        if let v = value as? String { return .string(v) }; if let v = value as? Bool { return .bool(v) }; if let v = value as? Int { return .number(Double(v)) }; if let v = value as? Double { return .number(v) }; if let v = value as? [String: Any] { return .object(v.mapValues(json)) };
        if let v = value as? [Any] { return .array(v.map(json)) }; return .null
    }
}
private extension JSONValue { var hubSpotObject: JSONRecord? { if case .object(let value) = self { return value }; return nil }; var hubSpotArray: [JSONValue]? { if case .array(let value) = self { return value }; return nil } }
