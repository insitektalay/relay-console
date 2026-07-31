import Foundation

public struct CopperProviderHTTPRequest: Sendable {
    public let method: String; public let url: URL; public let headers: [String: String]; public let body: Data?; public init(method: String, url: URL, headers: [String: String], body: Data? = nil) { self.method = method; self.url = url; self.headers = headers; self.body = body }
}
public struct CopperProviderHTTPResponse: Sendable {
    public let statusCode: Int; public let headers: [String: String]; public let body: Data; public init(statusCode: Int, headers: [String: String] = [:], body: Data = Data()) { self.statusCode = statusCode; self.headers = headers; self.body = body }
}
public protocol CopperProviderHTTPClient: Sendable { func send(_ request: CopperProviderHTTPRequest) throws -> CopperProviderHTTPResponse }
private final class CopperNoRedirectDelegate: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}
public struct URLSessionCopperProviderHTTPClient: CopperProviderHTTPClient {
    public init() {};
    public func send(_ request: CopperProviderHTTPRequest) throws -> CopperProviderHTTPResponse {
        var value = URLRequest(url: request.url); value.httpMethod = request.method; value.httpBody = request.body; value.timeoutInterval = 20; request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) };
        let session = URLSession(configuration: .ephemeral, delegate: CopperNoRedirectDelegate(), delegateQueue: nil), semaphore = DispatchSemaphore(value: 0); var data: Data?, response: HTTPURLResponse?, failure: Error?;
        let task = session.dataTask(with: value) {
            data = $0; response = $1 as? HTTPURLResponse; failure = $2; semaphore.signal()
        }; task.resume(); if semaphore.wait(timeout: .now() + 20) == .timedOut { task.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "copper_http_timeout", message: "Copper API request timed out.") }; session.invalidateAndCancel(); if let failure { throw failure };
        return CopperProviderHTTPResponse(statusCode: response?.statusCode ?? 0, headers: response?.allHeaderFields.reduce(into: [:]) { $0[String(describing: $1.key)] = String(describing: $1.value) } ?? [:], body: data ?? Data())
    }
}

public struct CopperProviderActionClientResult: Sendable { public let result: JSONRecord; public init(result: JSONRecord) { self.result = result } }
public protocol CopperProviderActionClient: Sendable { func executeCopperAction(request: MarketplaceProviderActionAdapterRequest) throws -> CopperProviderActionClientResult }
public struct FakeCopperProviderActionClient: CopperProviderActionClient {
    public init() {};
    public func executeCopperAction(request: MarketplaceProviderActionAdapterRequest) throws -> CopperProviderActionClientResult {
        switch request.definition.actionKey {
        case "copper_account_get": return out(["semanticReadContract": .string("copper-account-get-v1"), "account": .object(CopperProviderActionSupport.fakeAccount())]);
        case "copper_opportunity_list": return out(["semanticReadContract": .string("copper-opportunity-list-v1"), "opportunities": .array([.object(CopperProviderActionSupport.fakeOpportunity())])]);
        case "copper_opportunity_get": return out(["semanticReadContract": .string("copper-opportunity-get-v1"), "opportunity": .object(CopperProviderActionSupport.fakeOpportunity())]);
        default: throw MarketplaceProviderActionAdapterFailure(code: "copper_fake_action_not_supported", message: "Unsupported Copper action.")
        }
    };
    private func out(_ fields: JSONRecord) -> CopperProviderActionClientResult {
        CopperProviderActionClientResult(
            result: ["provider": .string("copper"), "adapterBoundary": .string("copper-provider-action-adapter"), "clientMode": .string("fake-copper-developer-api-v1"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-state-excluded")].merging(fields) { _, new in new })
    }
}

public final class LiveCopperProviderActionClient: CopperProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService; private let secrets: SecretService; private let http: any CopperProviderHTTPClient
    public init(data: LocalDataService, secrets: SecretService, httpClient: any CopperProviderHTTPClient = URLSessionCopperProviderHTTPClient()) { self.data = data; self.secrets = secrets; self.http = httpClient }
    public func executeCopperAction(request: MarketplaceProviderActionAdapterRequest) throws -> CopperProviderActionClientResult {
        let token = try authorization(request);
        switch request.definition.actionKey {
        case "copper_account_get": return out(["semanticReadContract": .string("copper-account-get-v1"), "account": .object(CopperProviderActionSupport.account(try call(token, method: "GET", path: "/account")))]);
        case "copper_opportunity_list":
            let body = try JSONSerialization.data(withJSONObject: ["page_size": 25, "sort_by": "date_modified", "sort_direction": "desc"], options: [.sortedKeys]), root = try call(token, method: "POST", path: "/opportunities/search", body: body),
                values = (root.copperArray ?? []).prefix(25).map { JSONValue.object(CopperProviderActionSupport.opportunity($0)) }
            ; return out(["semanticReadContract": .string("copper-opportunity-list-v1"), "opportunities": .array(Array(values))]);
        case "copper_opportunity_get":
            let id = try CopperProviderActionSupport.recordId(request.payload["opportunityId"]), root = try call(token, method: "GET", path: "/opportunities/\(id)");
            return out(["semanticReadContract": .string("copper-opportunity-get-v1"), "opportunity": .object(CopperProviderActionSupport.opportunity(root))]);
        default: throw MarketplaceProviderActionAdapterFailure(code: "copper_live_action_not_supported", message: "Unsupported live Copper action.")
        }
    }
    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> String {
        guard let id = request.auditIdentity.connectionId, let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), connection.appSlug == "copper",
            let ref = connection.credentialRequirements.first(where: { $0.fieldKey == "copper_oauth_access_token" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "copper_connection_not_ready", message: "Copper account connection is not ready.") }; return try secrets.getSecretValue(ref)
    }
    private func call(_ token: String, method: String, path: String, body: Data? = nil) throws -> JSONValue {
        let url = URL(string: "https://api.copper.com/developer_api/v1" + path)!,
            response = try http.send(CopperProviderHTTPRequest(method: method, url: url, headers: ["Authorization": "Bearer " + token, "Accept": "application/json", "Content-Type": "application/json", "User-Agent": "RelayConsole-Copper/1.0"], body: body)),
            value = (try? JSONSerialization.jsonObject(with: response.body)).map(CopperProviderActionSupport.json) ?? .null
        ;
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: response.statusCode == 401 ? "copper_token_invalid" : response.statusCode == 403 ? "copper_scope_denied" : response.statusCode == 429 ? "copper_rate_limited" : "copper_api_error", message: "Copper API request failed.", providerStatusCode: response.statusCode,
                detail: ["message": value.copperObject?["message"] ?? .null, "retryAfter": response.headers.first { $0.key.lowercased() == "retry-after" }.map { .string(String($0.value.prefix(32))) } ?? .null])
        }; return value
    }
    private func out(_ fields: JSONRecord) -> CopperProviderActionClientResult {
        CopperProviderActionClientResult(
            result: ["provider": .string("copper"), "adapterBoundary": .string("copper-provider-action-adapter"), "clientMode": .string("live-copper-developer-api-v1"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-state-excluded")].merging(fields) { _, new in new })
    }
}

public struct CopperProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = ["copper_account_get", "copper_opportunity_list", "copper_opportunity_get"]; private let client: any CopperProviderActionClient; public init(client: any CopperProviderActionClient = FakeCopperProviderActionClient()) { self.client = client };
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "copper", Self.allowed.contains(request.definition.actionKey) else { throw MarketplaceProviderActionAdapterFailure(code: "copper_action_not_allowlisted", message: "Copper action is outside read-only V1.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executeCopperAction(request: request).result, error: nil, redactionStatus: "private-state-excluded")
    }
}

enum CopperProviderActionSupport {
    static func recordId(_ value: JSONValue?) throws -> String {
        guard let id = value?.string, let number = Int64(id), number > 0, String(number) == id else { throw MarketplaceProviderActionAdapterFailure(code: "copper_opportunity_id_invalid", message: "A positive numeric Copper Opportunity ID is required.") }; return id
    }
    static func scalar(_ value: JSONValue?) -> JSONValue { guard let value else { return .null }; switch value { case .string(let text): return .string(String(text.prefix(512))); case .number, .bool, .null: return value; default: return .null } }
    static func account(_ value: JSONValue) -> JSONRecord { let o = value.copperObject ?? [:]; return ["AccountId": scalar(o["id"]), "Name": scalar(o["name"]), "PrimaryTimezone": scalar(o["primary_timezone"])] }
    static func opportunity(_ value: JSONValue) -> JSONRecord {
        let o = value.copperObject ?? [:];
        return [
            "OpportunityId": scalar(o["id"]), "Name": scalar(o["name"]), "CompanyId": scalar(o["company_id"]), "CompanyName": scalar(o["company_name"]), "CloseDate": scalar(o["close_date"]), "MonetaryValue": scalar(o["monetary_value"]), "MonetaryUnit": scalar(o["monetary_unit"]),
            "Status": scalar(o["status"]), "Priority": scalar(o["priority"]), "PipelineId": scalar(o["pipeline_id"]), "PipelineStageId": scalar(o["pipeline_stage_id"]), "WinProbability": scalar(o["win_probability"]), "CreatedAt": scalar(o["date_created"]), "ModifiedAt": scalar(o["date_modified"]),
        ]
    }
    static func fakeAccount() -> JSONRecord { ["AccountId": .number(123), "Name": .string("Relay CRM"), "PrimaryTimezone": .string("Europe/London")] }
    static func fakeOpportunity() -> JSONRecord {
        [
            "OpportunityId": .number(2001), "Name": .string("Relay Renewal"), "CompanyId": .number(1001), "CompanyName": .string("Relay Customer"), "CloseDate": .string("09/30/2026"), "MonetaryValue": .number(12000), "MonetaryUnit": .string("GBP"), "Status": .string("Open"),
            "Priority": .string("High"), "PipelineId": .number(1), "PipelineStageId": .number(3), "WinProbability": .number(75), "CreatedAt": .number(1767225600), "ModifiedAt": .number(1783764000),
        ]
    }
    static func json(_ value: Any) -> JSONValue {
        if let v = value as? String { return .string(v) }; if let v = value as? Bool { return .bool(v) }; if let v = value as? Int { return .number(Double(v)) }; if let v = value as? Double { return .number(v) }; if let v = value as? [String: Any] { return .object(v.mapValues(json)) };
        if let v = value as? [Any] { return .array(v.map(json)) }; return .null
    }
}
private extension JSONValue { var copperObject: JSONRecord? { if case .object(let value) = self { return value }; return nil }; var copperArray: [JSONValue]? { if case .array(let value) = self { return value }; return nil } }
