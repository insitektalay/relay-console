import Foundation

public struct CloseProviderHTTPRequest: Sendable { public let url: URL; public let headers: [String: String]; public init(url: URL, headers: [String: String]) { self.url = url; self.headers = headers } }
public struct CloseProviderHTTPResponse: Sendable { public let statusCode: Int; public let headers: [String: String]; public let body: Data; public init(statusCode: Int, headers: [String: String] = [:], body: Data = Data()) { self.statusCode = statusCode; self.headers = headers; self.body = body } }
public protocol CloseProviderHTTPClient: Sendable { func send(_ request: CloseProviderHTTPRequest) throws -> CloseProviderHTTPResponse }
private final class CloseNoRedirectDelegate: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}
public struct URLSessionCloseProviderHTTPClient: CloseProviderHTTPClient {
    public init() {};
    public func send(_ request: CloseProviderHTTPRequest) throws -> CloseProviderHTTPResponse {
        var value = URLRequest(url: request.url); value.httpMethod = "GET"; value.timeoutInterval = 20; request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) };
        let session = URLSession(configuration: .ephemeral, delegate: CloseNoRedirectDelegate(), delegateQueue: nil), semaphore = DispatchSemaphore(value: 0); var data: Data?, response: HTTPURLResponse?, failure: Error?;
        let task = session.dataTask(with: value) {
            data = $0; response = $1 as? HTTPURLResponse; failure = $2; semaphore.signal()
        }; task.resume(); if semaphore.wait(timeout: .now() + 20) == .timedOut { task.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "close_http_timeout", message: "Close API request timed out.") }; session.invalidateAndCancel(); if let failure { throw failure };
        return CloseProviderHTTPResponse(statusCode: response?.statusCode ?? 0, headers: response?.allHeaderFields.reduce(into: [:]) { $0[String(describing: $1.key)] = String(describing: $1.value) } ?? [:], body: data ?? Data())
    }
}

public struct CloseProviderActionClientResult: Sendable { public let result: JSONRecord; public init(result: JSONRecord) { self.result = result } }
public protocol CloseProviderActionClient: Sendable { func executeCloseAction(request: MarketplaceProviderActionAdapterRequest) throws -> CloseProviderActionClientResult }
public struct FakeCloseProviderActionClient: CloseProviderActionClient {
    public init() {};
    public func executeCloseAction(request: MarketplaceProviderActionAdapterRequest) throws -> CloseProviderActionClientResult {
        switch request.definition.actionKey {
        case "close_organization_get": return out(["semanticReadContract": .string("close-organization-get-v1"), "organization": .object(CloseProviderActionSupport.fakeOrganization())]);
        case "close_opportunity_list": return out(["semanticReadContract": .string("close-opportunity-list-v1"), "opportunities": .array([.object(CloseProviderActionSupport.fakeOpportunity())])]);
        case "close_opportunity_get": return out(["semanticReadContract": .string("close-opportunity-get-v1"), "opportunity": .object(CloseProviderActionSupport.fakeOpportunity())]);
        default: throw MarketplaceProviderActionAdapterFailure(code: "close_fake_action_not_supported", message: "Unsupported Close action.")
        }
    };
    private func out(_ fields: JSONRecord) -> CloseProviderActionClientResult {
        CloseProviderActionClientResult(
            result: ["provider": .string("close"), "adapterBoundary": .string("close-provider-action-adapter"), "clientMode": .string("fake-close-api-v1"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-state-excluded")].merging(fields) { _, new in new })
    }
}

public final class LiveCloseProviderActionClient: CloseProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService; private let secrets: SecretService; private let http: any CloseProviderHTTPClient
    public init(data: LocalDataService, secrets: SecretService, httpClient: any CloseProviderHTTPClient = URLSessionCloseProviderHTTPClient()) { self.data = data; self.secrets = secrets; self.http = httpClient }
    public func executeCloseAction(request: MarketplaceProviderActionAdapterRequest) throws -> CloseProviderActionClientResult {
        let auth = try authorization(request);
        switch request.definition.actionKey {
        case "close_organization_get": return out(["semanticReadContract": .string("close-organization-get-v1"), "organization": .object(CloseProviderActionSupport.organization(try get(auth.token, path: "/organization/\(auth.organizationId)/", query: [])))]);
        case "close_opportunity_list":
            let root = try get(auth.token, path: "/opportunity/", query: CloseProviderActionSupport.listQuery), values = (root.closeObject?["data"]?.closeArray ?? []).prefix(25).map { JSONValue.object(CloseProviderActionSupport.opportunity($0)) };
            return out(["semanticReadContract": .string("close-opportunity-list-v1"), "opportunities": .array(Array(values))]);
        case "close_opportunity_get":
            let id = try CloseProviderActionSupport.opportunityId(request.payload["opportunityId"]), root = try get(auth.token, path: "/opportunity/\(id)/", query: [URLQueryItem(name: "_fields", value: CloseProviderActionSupport.opportunityFields)]);
            return out(["semanticReadContract": .string("close-opportunity-get-v1"), "opportunity": .object(CloseProviderActionSupport.opportunity(root))]);
        default: throw MarketplaceProviderActionAdapterFailure(code: "close_live_action_not_supported", message: "Unsupported live Close action.")
        }
    }
    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> (token: String, organizationId: String) {
        guard let id = request.auditIdentity.connectionId, let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), connection.appSlug == "close",
            let ref = connection.credentialRequirements.first(where: { $0.fieldKey == "close_oauth_access_token" })?.secretReferenceId, let organizationId = connection.health.diagnostics["organizationId"]?.string, CloseProviderActionSupport.validId(organizationId, prefix: "orga_")
        else { throw MarketplaceProviderActionAdapterFailure(code: "close_connection_not_ready", message: "Close Organization connection is not ready.") }; return (try secrets.getSecretValue(ref), organizationId)
    }
    private func get(_ token: String, path: String, query: [URLQueryItem]) throws -> JSONValue {
        var c = URLComponents(string: "https://api.close.com/api/v1" + path)!; c.queryItems = query.isEmpty ? nil : query;
        let response = try http.send(CloseProviderHTTPRequest(url: c.url!, headers: ["Authorization": "Bearer " + token, "Accept": "application/json", "User-Agent": "RelayConsole-Close/1.0"])),
            value = (try? JSONSerialization.jsonObject(with: response.body)).map(CloseProviderActionSupport.json) ?? .null
        ;
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: response.statusCode == 401 ? "close_token_invalid" : response.statusCode == 403 ? "close_scope_denied" : response.statusCode == 429 ? "close_rate_limited" : "close_api_error", message: "Close API request failed.", providerStatusCode: response.statusCode,
                detail: ["error": value.closeObject?["error"] ?? .null, "retryAfter": response.headers.first { $0.key.lowercased() == "retry-after" }.map { .string(String($0.value.prefix(32))) } ?? .null])
        }; return value
    }
    private func out(_ fields: JSONRecord) -> CloseProviderActionClientResult {
        CloseProviderActionClientResult(
            result: ["provider": .string("close"), "adapterBoundary": .string("close-provider-action-adapter"), "clientMode": .string("live-close-api-v1"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-state-excluded")].merging(fields) { _, new in new })
    }
}

public struct CloseProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = ["close_organization_get", "close_opportunity_list", "close_opportunity_get"]; private let client: any CloseProviderActionClient; public init(client: any CloseProviderActionClient = FakeCloseProviderActionClient()) { self.client = client };
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "close", Self.allowed.contains(request.definition.actionKey) else { throw MarketplaceProviderActionAdapterFailure(code: "close_action_not_allowlisted", message: "Close action is outside read-only V1.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executeCloseAction(request: request).result, error: nil, redactionStatus: "private-state-excluded")
    }
}

enum CloseProviderActionSupport {
    static let opportunityFields = "id,organization_id,lead_id,lead_name,pipeline_id,pipeline_name,status_id,status_label,status_type,value,value_currency,value_period,confidence,expected_value,annualized_value,annualized_expected_value,date_created,date_updated,date_won,date_lost"
    static let listQuery = [URLQueryItem(name: "_limit", value: "25"), URLQueryItem(name: "_order_by", value: "-date_updated"), URLQueryItem(name: "_fields", value: opportunityFields)]
    static func validId(_ value: String, prefix: String) -> Bool { value.hasPrefix(prefix) && value.count > prefix.count && value.count <= 96 && value.dropFirst(prefix.count).allSatisfy { $0.isLetter || $0.isNumber } }
    static func opportunityId(_ value: JSONValue?) throws -> String { guard let id = value?.string, validId(id, prefix: "oppo_") else { throw MarketplaceProviderActionAdapterFailure(code: "close_opportunity_id_invalid", message: "A valid Close oppo_ Opportunity ID is required.") }; return id }
    static func scalar(_ value: JSONValue?) -> JSONValue { guard let value else { return .null }; switch value { case .string(let text): return .string(String(text.prefix(512))); case .number, .bool, .null: return value; default: return .null } }
    static func organization(_ value: JSONValue) -> JSONRecord { let o = value.closeObject ?? [:]; return ["OrganizationId": scalar(o["id"]), "Name": scalar(o["name"]), "PlanType": scalar(o["plan_type"]), "CreatedAt": scalar(o["date_created"]), "UpdatedAt": scalar(o["date_updated"])] }
    static func opportunity(_ value: JSONValue) -> JSONRecord {
        let o = value.closeObject ?? [:];
        return [
            "OpportunityId": scalar(o["id"]), "OrganizationId": scalar(o["organization_id"]), "LeadId": scalar(o["lead_id"]), "LeadName": scalar(o["lead_name"]), "PipelineId": scalar(o["pipeline_id"]), "PipelineName": scalar(o["pipeline_name"]), "StatusId": scalar(o["status_id"]),
            "StatusLabel": scalar(o["status_label"]), "StatusType": scalar(o["status_type"]), "Value": scalar(o["value"]), "ValueCurrency": scalar(o["value_currency"]), "ValuePeriod": scalar(o["value_period"]), "Confidence": scalar(o["confidence"]), "ExpectedValue": scalar(o["expected_value"]),
            "AnnualizedValue": scalar(o["annualized_value"]), "AnnualizedExpectedValue": scalar(o["annualized_expected_value"]), "CreatedAt": scalar(o["date_created"]), "UpdatedAt": scalar(o["date_updated"]), "WonAt": scalar(o["date_won"]), "LostAt": scalar(o["date_lost"]),
        ]
    }
    static func fakeOrganization() -> JSONRecord { ["OrganizationId": .string("orga_Relay123"), "Name": .string("Relay CRM"), "PlanType": .string("business"), "CreatedAt": .string("2026-01-01T00:00:00Z"), "UpdatedAt": .string("2026-07-11T10:00:00Z")] }
    static func fakeOpportunity() -> JSONRecord {
        [
            "OpportunityId": .string("oppo_Relay2001"), "OrganizationId": .string("orga_Relay123"), "LeadId": .string("lead_Relay1001"), "LeadName": .string("Relay Customer"), "PipelineId": .string("pipe_Relay1"), "PipelineName": .string("Sales"), "StatusId": .string("stat_Relay3"),
            "StatusLabel": .string("Active"), "StatusType": .string("active"), "Value": .number(1200000), "ValueCurrency": .string("GBP"), "ValuePeriod": .string("one_time"), "Confidence": .number(75), "ExpectedValue": .number(900000), "AnnualizedValue": .number(1200000),
            "AnnualizedExpectedValue": .number(900000), "CreatedAt": .string("2026-01-01T00:00:00Z"), "UpdatedAt": .string("2026-07-11T10:00:00Z"), "WonAt": .null, "LostAt": .null,
        ]
    }
    static func json(_ value: Any) -> JSONValue {
        if let v = value as? String { return .string(v) }; if let v = value as? Bool { return .bool(v) }; if let v = value as? Int { return .number(Double(v)) }; if let v = value as? Double { return .number(v) }; if let v = value as? [String: Any] { return .object(v.mapValues(json)) };
        if let v = value as? [Any] { return .array(v.map(json)) }; return .null
    }
}
private extension JSONValue { var closeObject: JSONRecord? { if case .object(let value) = self { return value }; return nil }; var closeArray: [JSONValue]? { if case .array(let value) = self { return value }; return nil } }
