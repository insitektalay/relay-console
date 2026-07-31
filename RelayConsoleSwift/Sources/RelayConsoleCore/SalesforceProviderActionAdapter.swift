import Foundation

public struct SalesforceProviderHTTPRequest: Sendable { public let url: URL; public let headers: [String: String]; public init(url: URL, headers: [String: String]) { self.url = url; self.headers = headers } }
public struct SalesforceProviderHTTPResponse: Sendable {
    public let statusCode: Int; public let headers: [String: String]; public let body: Data; public init(statusCode: Int, headers: [String: String] = [:], body: Data = Data()) { self.statusCode = statusCode; self.headers = headers; self.body = body }
}
public protocol SalesforceProviderHTTPClient: Sendable { func send(_ request: SalesforceProviderHTTPRequest) throws -> SalesforceProviderHTTPResponse }
private final class SalesforceNoRedirectDelegate: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}
public struct URLSessionSalesforceProviderHTTPClient: SalesforceProviderHTTPClient {
    public init() {}
    public func send(_ request: SalesforceProviderHTTPRequest) throws -> SalesforceProviderHTTPResponse {
        var value = URLRequest(url: request.url); value.httpMethod = "GET"; value.timeoutInterval = 20; request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) };
        let session = URLSession(configuration: .ephemeral, delegate: SalesforceNoRedirectDelegate(), delegateQueue: nil), semaphore = DispatchSemaphore(value: 0); var data: Data?, response: HTTPURLResponse?, failure: Error?;
        let task = session.dataTask(with: value) {
            data = $0; response = $1 as? HTTPURLResponse; failure = $2; semaphore.signal()
        }; task.resume(); if semaphore.wait(timeout: .now() + 20) == .timedOut { task.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "salesforce_http_timeout", message: "Salesforce REST request timed out.") }; session.invalidateAndCancel(); if let failure { throw failure };
        return SalesforceProviderHTTPResponse(statusCode: response?.statusCode ?? 0, headers: response?.allHeaderFields.reduce(into: [:]) { $0[String(describing: $1.key)] = String(describing: $1.value) } ?? [:], body: data ?? Data())
    }
}

public struct SalesforceProviderActionClientResult: Sendable { public let result: JSONRecord; public init(result: JSONRecord) { self.result = result } }
public protocol SalesforceProviderActionClient: Sendable { func executeSalesforceAction(request: MarketplaceProviderActionAdapterRequest) throws -> SalesforceProviderActionClientResult }
public struct FakeSalesforceProviderActionClient: SalesforceProviderActionClient {
    public init() {}
    public func executeSalesforceAction(request: MarketplaceProviderActionAdapterRequest) throws -> SalesforceProviderActionClientResult {
        switch request.definition.actionKey {
        case "salesforce_account_list": return out(["semanticReadContract": .string("salesforce-account-list-v1"), "accounts": .array([.object(SalesforceProviderActionSupport.fakeAccount())])]);
        case "salesforce_opportunity_list": return out(["semanticReadContract": .string("salesforce-opportunity-list-v1"), "opportunities": .array([.object(SalesforceProviderActionSupport.fakeOpportunity())])]);
        case "salesforce_opportunity_get": return out(["semanticReadContract": .string("salesforce-opportunity-get-v1"), "opportunity": .object(SalesforceProviderActionSupport.fakeOpportunity())]);
        default: throw MarketplaceProviderActionAdapterFailure(code: "salesforce_fake_action_not_supported", message: "Unsupported Salesforce action.")
        }
    }
    private func out(_ fields: JSONRecord) -> SalesforceProviderActionClientResult {
        SalesforceProviderActionClientResult(
            result: ["provider": .string("salesforce"), "adapterBoundary": .string("salesforce-provider-action-adapter"), "clientMode": .string("fake-salesforce-static-soql"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-state-excluded")].merging(fields) { _, new in
                new
            })
    }
}

public final class LiveSalesforceProviderActionClient: SalesforceProviderActionClient, @unchecked Sendable {
    public static let apiVersion = "v67.0"
    private let data: LocalDataService; private let secrets: SecretService; private let http: any SalesforceProviderHTTPClient
    public init(data: LocalDataService, secrets: SecretService, httpClient: any SalesforceProviderHTTPClient = URLSessionSalesforceProviderHTTPClient()) { self.data = data; self.secrets = secrets; self.http = httpClient }
    public func executeSalesforceAction(request: MarketplaceProviderActionAdapterRequest) throws -> SalesforceProviderActionClientResult {
        let auth = try authorization(request)
        switch request.definition.actionKey {
        case "salesforce_account_list":
            let root = try query(auth, SalesforceProviderActionSupport.accountListSOQL), values = (root.salesforceObject?["records"]?.salesforceArray ?? []).prefix(25).map { JSONValue.object(SalesforceProviderActionSupport.account($0)) };
            return out(["semanticReadContract": .string("salesforce-account-list-v1"), "accounts": .array(Array(values)), "done": .bool(true)])
        case "salesforce_opportunity_list":
            let root = try query(auth, SalesforceProviderActionSupport.opportunityListSOQL), values = (root.salesforceObject?["records"]?.salesforceArray ?? []).prefix(25).map { JSONValue.object(SalesforceProviderActionSupport.opportunity($0)) };
            return out(["semanticReadContract": .string("salesforce-opportunity-list-v1"), "opportunities": .array(Array(values)), "done": .bool(true)])
        case "salesforce_opportunity_get":
            let id = try SalesforceProviderActionSupport.recordId(request.payload["opportunityId"]), root = try query(auth, SalesforceProviderActionSupport.opportunityGetSOQL(id)), value = root.salesforceObject?["records"]?.salesforceArray?.first ?? .null;
            return out(["semanticReadContract": .string("salesforce-opportunity-get-v1"), "opportunity": .object(SalesforceProviderActionSupport.opportunity(value))])
        default: throw MarketplaceProviderActionAdapterFailure(code: "salesforce_live_action_not_supported", message: "Unsupported live Salesforce action.")
        }
    }
    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> (token: String, instance: URL) {
        guard let id = request.auditIdentity.connectionId, let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), connection.appSlug == "salesforce",
            let ref = connection.credentialRequirements.first(where: { $0.fieldKey == "salesforce_oauth_access_token" })?.secretReferenceId, let raw = connection.health.diagnostics["instanceURL"]?.string, let instance = SalesforceProviderActionSupport.instanceURL(raw)
        else { throw MarketplaceProviderActionAdapterFailure(code: "salesforce_connection_not_ready", message: "Salesforce org connection is not ready.") }; return (try secrets.getSecretValue(ref), instance)
    }
    private func query(_ auth: (token: String, instance: URL), _ soql: String) throws -> JSONValue {
        var components = URLComponents(url: auth.instance.appendingPathComponent("services/data/\(Self.apiVersion)/query"), resolvingAgainstBaseURL: false)!; components.queryItems = [URLQueryItem(name: "q", value: soql)];
        let response = try http.send(SalesforceProviderHTTPRequest(url: components.url!, headers: ["Authorization": "Bearer " + auth.token, "Accept": "application/json", "User-Agent": "RelayConsole-Salesforce/1.0"])),
            value = (try? JSONSerialization.jsonObject(with: response.body)).map(SalesforceProviderActionSupport.json) ?? .null
        ;
        guard (200..<300).contains(response.statusCode) else {
            let code = value.salesforceArray?.first?.salesforceObject?["errorCode"]?.string;
            throw MarketplaceProviderActionAdapterFailure(
                code: response.statusCode == 401 ? "salesforce_token_invalid" : code == "REQUEST_LIMIT_EXCEEDED" ? "salesforce_rate_limited" : response.statusCode == 403 ? "salesforce_permission_denied" : "salesforce_api_error", message: "Salesforce REST query failed.",
                providerStatusCode: response.statusCode, detail: ["providerErrorCode": code.map(JSONValue.string) ?? .null, "apiUsage": response.headers.first { $0.key.lowercased() == "sforce-limit-info" }.map { .string(String($0.value.prefix(128))) } ?? .null])
        }; return value
    }
    private func out(_ fields: JSONRecord) -> SalesforceProviderActionClientResult {
        SalesforceProviderActionClientResult(
            result: [
                "provider": .string("salesforce"), "adapterBoundary": .string("salesforce-provider-action-adapter"), "clientMode": .string("live-salesforce-static-soql"), "apiVersion": .string(Self.apiVersion), "rawProviderToolExposure": .bool(false),
                "redactionStatus": .string("private-state-excluded"),
            ].merging(fields) { _, new in new })
    }
}

public struct SalesforceProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = ["salesforce_account_list", "salesforce_opportunity_list", "salesforce_opportunity_get"]; private let client: any SalesforceProviderActionClient;
    public init(client: any SalesforceProviderActionClient = FakeSalesforceProviderActionClient()) { self.client = client };
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "salesforce", Self.allowed.contains(request.definition.actionKey) else { throw MarketplaceProviderActionAdapterFailure(code: "salesforce_action_not_allowlisted", message: "Salesforce action is outside read-only V1.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executeSalesforceAction(request: request).result, error: nil, redactionStatus: "private-state-excluded")
    }
}

enum SalesforceProviderActionSupport {
    static let accountListSOQL = "SELECT Id, Name, Type, Industry, BillingCountry, LastModifiedDate FROM Account ORDER BY LastModifiedDate DESC LIMIT 25"
    static let opportunityFields = "Id, Name, AccountId, StageName, Amount, CloseDate, Probability, Type, IsClosed, IsWon, LastModifiedDate"
    static let opportunityListSOQL = "SELECT \(opportunityFields) FROM Opportunity ORDER BY LastModifiedDate DESC LIMIT 25"
    static func opportunityGetSOQL(_ id: String) -> String { "SELECT \(opportunityFields) FROM Opportunity WHERE Id = '\(id)' LIMIT 1" }
    static func instanceURL(_ raw: String) -> URL? {
        guard let c = URLComponents(string: raw), c.scheme == "https", let host = c.host?.lowercased(), (host == "salesforce.com" || host.hasSuffix(".salesforce.com")), c.user == nil, c.password == nil, c.port == nil, c.query == nil, c.fragment == nil, c.path.isEmpty || c.path == "/" else {
            return nil
        }; return URL(string: "https://" + host)
    }
    static func recordId(_ value: JSONValue?) throws -> String {
        guard let id = value?.string, [15, 18].contains(id.count), id.allSatisfy({ $0.isLetter || $0.isNumber }) else { throw MarketplaceProviderActionAdapterFailure(code: "salesforce_opportunity_id_invalid", message: "A valid 15- or 18-character Salesforce Opportunity ID is required.") }; return id
    }
    static func scalar(_ value: JSONValue?) -> JSONValue { guard let value else { return .null }; switch value { case .string(let text): return .string(String(text.prefix(512))); case .number, .bool, .null: return value; default: return .null } }
    static func account(_ value: JSONValue) -> JSONRecord {
        let o = value.salesforceObject ?? [:]; return ["AccountId": scalar(o["Id"]), "Name": scalar(o["Name"]), "Type": scalar(o["Type"]), "Industry": scalar(o["Industry"]), "BillingCountry": scalar(o["BillingCountry"]), "LastModifiedDate": scalar(o["LastModifiedDate"])]
    }
    static func opportunity(_ value: JSONValue) -> JSONRecord {
        let o = value.salesforceObject ?? [:];
        return [
            "OpportunityId": scalar(o["Id"]), "Name": scalar(o["Name"]), "AccountId": scalar(o["AccountId"]), "StageName": scalar(o["StageName"]), "Amount": scalar(o["Amount"]), "CloseDate": scalar(o["CloseDate"]), "Probability": scalar(o["Probability"]), "Type": scalar(o["Type"]),
            "IsClosed": scalar(o["IsClosed"]), "IsWon": scalar(o["IsWon"]), "LastModifiedDate": scalar(o["LastModifiedDate"]),
        ]
    }
    static func fakeAccount() -> JSONRecord { ["AccountId": .string("001000000000001AAA"), "Name": .string("Relay Customer"), "Type": .string("Customer"), "Industry": .string("Technology"), "BillingCountry": .string("GB"), "LastModifiedDate": .string("2026-07-11T10:00:00.000+0000")] }
    static func fakeOpportunity() -> JSONRecord {
        [
            "OpportunityId": .string("006000000000001AAA"), "Name": .string("Relay Renewal"), "AccountId": .string("001000000000001AAA"), "StageName": .string("Proposal/Price Quote"), "Amount": .number(12000), "CloseDate": .string("2026-09-30"), "Probability": .number(60),
            "Type": .string("Existing Business"), "IsClosed": .bool(false), "IsWon": .bool(false), "LastModifiedDate": .string("2026-07-11T10:00:00.000+0000"),
        ]
    }
    static func json(_ value: Any) -> JSONValue {
        if let v = value as? String { return .string(v) }; if let v = value as? Bool { return .bool(v) }; if let v = value as? Int { return .number(Double(v)) }; if let v = value as? Double { return .number(v) }; if let v = value as? [String: Any] { return .object(v.mapValues(json)) };
        if let v = value as? [Any] { return .array(v.map(json)) }; return .null
    }
}
private extension JSONValue { var salesforceObject: JSONRecord? { if case .object(let value) = self { return value }; return nil }; var salesforceArray: [JSONValue]? { if case .array(let value) = self { return value }; return nil } }
