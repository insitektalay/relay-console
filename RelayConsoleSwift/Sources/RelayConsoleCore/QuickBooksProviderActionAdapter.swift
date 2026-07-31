import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

public struct QuickBooksProviderHTTPRequest: Sendable {
    public let url: URL; public let headers: [String: String]; public let method: String; public let body: Data?; public init(url: URL, headers: [String: String], method: String = "GET", body: Data? = nil) { self.url = url; self.headers = headers; self.method = method; self.body = body }
}
public struct QuickBooksProviderHTTPResponse: Sendable {
    public let statusCode: Int; public let headers: [String: String]; public let body: Data; public init(statusCode: Int, headers: [String: String] = [:], body: Data = Data()) { self.statusCode = statusCode; self.headers = headers; self.body = body }
}
public protocol QuickBooksProviderHTTPClient: Sendable { func send(_ request: QuickBooksProviderHTTPRequest) throws -> QuickBooksProviderHTTPResponse }
private final class QuickBooksNoRedirectDelegate: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}
public struct URLSessionQuickBooksProviderHTTPClient: QuickBooksProviderHTTPClient {
    public init() {}
    public func send(_ request: QuickBooksProviderHTTPRequest) throws -> QuickBooksProviderHTTPResponse {
        var value = URLRequest(url: request.url); value.httpMethod = request.method; value.httpBody = request.body; value.timeoutInterval = 20; request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) }
        let session = URLSession(configuration: .ephemeral, delegate: QuickBooksNoRedirectDelegate(), delegateQueue: nil), semaphore = DispatchSemaphore(value: 0)
        var data: Data?, response: HTTPURLResponse?, failure: Error?
        let task = session.dataTask(with: value) { data = $0; response = $1 as? HTTPURLResponse; failure = $2; semaphore.signal() }; task.resume()
        if semaphore.wait(timeout: .now() + 20) == .timedOut { task.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "quickbooks_http_timeout", message: "QuickBooks Online API request timed out.") }
        session.invalidateAndCancel(); if let failure { throw failure }
        return QuickBooksProviderHTTPResponse(statusCode: response?.statusCode ?? 0, headers: response?.allHeaderFields.reduce(into: [:]) { $0[String(describing: $1.key)] = String(describing: $1.value) } ?? [:], body: data ?? Data())
    }
}

public struct QuickBooksProviderActionClientResult: Sendable { public let result: JSONRecord; public init(result: JSONRecord) { self.result = result } }
public protocol QuickBooksProviderActionClient: Sendable { func executeQuickBooksAction(request: MarketplaceProviderActionAdapterRequest) throws -> QuickBooksProviderActionClientResult }
public struct FakeQuickBooksProviderActionClient: QuickBooksProviderActionClient {
    public init() {}
    public func executeQuickBooksAction(request: MarketplaceProviderActionAdapterRequest) throws -> QuickBooksProviderActionClientResult {
        switch request.definition.actionKey {
        case "quickbooks_company_info_get": return output(["semanticReadContract": .string("quickbooks-company-info-v1"), "companyInfo": .object(QuickBooksProviderActionSupport.fakeCompany())])
        case "quickbooks_invoice_list": return output(["semanticReadContract": .string("quickbooks-invoice-list-v1"), "invoices": .array([.object(QuickBooksProviderActionSupport.fakeInvoice())]), "startPosition": .number(1), "maxResults": .number(1)])
        case "quickbooks_invoice_get": return output(["semanticReadContract": .string("quickbooks-invoice-get-v1"), "invoice": .object(QuickBooksProviderActionSupport.fakeInvoice())])
        case "quickbooks_payroll_compensations_list": return output(["semanticReadContract": .string("quickbooks-payroll-compensations-v1"), "compensations": .array([.object(QuickBooksProviderActionSupport.fakeCompensation())]), "maxResults": .number(1)])
        case "quickbooks_payment_charge_get": return output(["semanticReadContract": .string("quickbooks-payment-charge-v1"), "charge": .object(QuickBooksProviderActionSupport.fakeCharge())])
        default: throw MarketplaceProviderActionAdapterFailure(code: "quickbooks_fake_action_not_supported", message: "Unsupported QuickBooks action.")
        }
    }
    private func output(_ fields: JSONRecord) -> QuickBooksProviderActionClientResult {
        QuickBooksProviderActionClientResult(
            result: ["provider": .string("quickbooks"), "adapterBoundary": .string("quickbooks-provider-action-adapter"), "clientMode": .string("fake-quickbooks-online-accounting-api"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-state-excluded")].merging(fields) {
                _, new in new
            })
    }
}

public final class LiveQuickBooksProviderActionClient: QuickBooksProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService; private let secrets: SecretService; private let http: any QuickBooksProviderHTTPClient
    public init(data: LocalDataService, secrets: SecretService, httpClient: any QuickBooksProviderHTTPClient = URLSessionQuickBooksProviderHTTPClient()) { self.data = data; self.secrets = secrets; self.http = httpClient }
    public func executeQuickBooksAction(request: MarketplaceProviderActionAdapterRequest) throws -> QuickBooksProviderActionClientResult {
        let auth = try authorization(request), payload = request.payload
        switch request.definition.actionKey {
        case "quickbooks_company_info_get":
            let root = try get(auth, "/companyinfo/" + auth.realmId, []), value = root.qbObject?["CompanyInfo"] ?? .null
            return output(["semanticReadContract": .string("quickbooks-company-info-v1"), "companyInfo": .object(QuickBooksProviderActionSupport.company(value, realmId: auth.realmId, environment: auth.environment))])
        case "quickbooks_invoice_list":
            let start = QuickBooksProviderActionSupport.start(payload["startPosition"]), limit = QuickBooksProviderActionSupport.limit(payload["limit"]), statement = "SELECT * FROM Invoice ORDERBY MetaData.LastUpdatedTime DESC STARTPOSITION \(start) MAXRESULTS \(limit)"
            let root = try get(auth, "/query", [URLQueryItem(name: "query", value: statement)]), response = root.qbObject?["QueryResponse"]?.qbObject ?? [:], invoices: [JSONValue] = (response["Invoice"]?.qbArray ?? []).prefix(25).map { .object(QuickBooksProviderActionSupport.invoice($0)) }
            return output(["semanticReadContract": .string("quickbooks-invoice-list-v1"), "invoices": .array(invoices), "startPosition": .number(Double(start)), "maxResults": .number(Double(invoices.count))])
        case "quickbooks_invoice_get":
            let id = try QuickBooksProviderActionSupport.entityId(payload), root = try get(auth, "/invoice/" + id, []), value = root.qbObject?["Invoice"] ?? .null
            return output(["semanticReadContract": .string("quickbooks-invoice-get-v1"), "invoice": .object(QuickBooksProviderActionSupport.invoice(value))])
        case "quickbooks_payroll_compensations_list":
            guard auth.environment == "production" else { throw MarketplaceProviderActionAdapterFailure(code: "quickbooks_payroll_production_required", message: "QuickBooks Payroll Compensation is available only with production keys.") }
            let employeeId = try QuickBooksProviderActionSupport.employeeId(payload), active = try QuickBooksProviderActionSupport.activeOnly(payload["activeOnly"]), country = try QuickBooksProviderActionSupport.countryCode(payload["countryCode"])
            let query = "query getEmployeeCompensations($filter: Payroll_EmployeeCompensationsFilter!) { payrollEmployeeCompensations(filter: $filter) { edges { node { id active employerCompensation { id name type { key description value } } } } } }"
            let variables: [String: Any] = ["filter": ["employeeId": employeeId, "active": active]], body = try JSONSerialization.data(withJSONObject: ["query": query, "variables": variables])
            let root = try graphql(auth, body: body, countryCode: country), connection = root.qbObject?["data"]?.qbObject?["payrollEmployeeCompensations"]?.qbObject ?? [:],
                compensations: [JSONValue] = (connection["edges"]?.qbArray ?? []).prefix(10).map { JSONValue.object(QuickBooksProviderActionSupport.compensation($0.qbObject?["node"] ?? .null)) }
            return output(["semanticReadContract": .string("quickbooks-payroll-compensations-v1"), "compensations": .array(compensations), "maxResults": .number(Double(compensations.count))])
        case "quickbooks_payment_charge_get":
            let id = try QuickBooksProviderActionSupport.paymentChargeId(payload), value = try paymentGet(auth, chargeId: id)
            return output(["semanticReadContract": .string("quickbooks-payment-charge-v1"), "charge": .object(QuickBooksProviderActionSupport.charge(value))])
        default: throw MarketplaceProviderActionAdapterFailure(code: "quickbooks_live_action_not_supported", message: "Unsupported live QuickBooks action.")
        }
    }
    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> (token: String, realmId: String, environment: String) {
        guard let id = request.auditIdentity.connectionId, let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), connection.appSlug == "quickbooks",
            let ref = connection.credentialRequirements.first(where: { $0.fieldKey == "quickbooks_oauth_access_token" })?.secretReferenceId, let realm = connection.health.diagnostics["realmId"]?.string, QuickBooksProviderActionSupport.numeric(realm),
            let environment = connection.health.diagnostics["environment"]?.string, ["sandbox", "production"].contains(environment)
        else { throw MarketplaceProviderActionAdapterFailure(code: "quickbooks_connection_not_ready", message: "QuickBooks company connection is not ready.") }
        return (try secrets.getSecretValue(ref), realm, environment)
    }
    private func get(_ auth: (token: String, realmId: String, environment: String), _ path: String, _ query: [URLQueryItem]) throws -> JSONValue {
        let host = auth.environment == "sandbox" ? "sandbox-quickbooks.api.intuit.com" : "quickbooks.api.intuit.com"; var components = URLComponents(string: "https://" + host + "/v3/company/" + auth.realmId + path)!; components.queryItems = query + [URLQueryItem(name: "minorversion", value: "75")]
        let response = try http.send(QuickBooksProviderHTTPRequest(url: components.url!, headers: ["Authorization": "Bearer " + auth.token, "Accept": "application/json"])); let value = (try? JSONSerialization.jsonObject(with: response.body)).map(QuickBooksProviderActionSupport.json) ?? .null
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: response.statusCode == 401 ? "quickbooks_token_invalid" : response.statusCode == 403 ? "quickbooks_permission_denied" : response.statusCode == 429 ? "quickbooks_rate_limited" : "quickbooks_http_error", message: "QuickBooks Online Accounting API request failed.",
                providerStatusCode: response.statusCode,
                detail: [
                    "providerError": QuickBooksProviderActionSupport.error(value), "intuitTid": response.headers.first { $0.key.lowercased() == "intuit_tid" }.map { .string(String($0.value.prefix(128))) } ?? .null,
                    "retryAfter": response.headers.first { $0.key.lowercased() == "retry-after" }.map { .string(String($0.value.prefix(32))) } ?? .null,
                ])
        }
        return value
    }
    private func graphql(_ auth: (token: String, realmId: String, environment: String), body: Data, countryCode: String?) throws -> JSONValue {
        var headers = ["Authorization": "Bearer " + auth.token, "Accept": "application/json", "Content-Type": "application/json"]
        if let countryCode { headers["intuit_country"] = countryCode }
        let response = try http.send(QuickBooksProviderHTTPRequest(url: URL(string: "https://qb.api.intuit.com/graphql")!, headers: headers, method: "POST", body: body))
        guard response.body.count <= 1_000_000 else { throw MarketplaceProviderActionAdapterFailure(code: "quickbooks_response_too_large", message: "QuickBooks response exceeded the safe size limit.") }
        let value = (try? JSONSerialization.jsonObject(with: response.body)).map(QuickBooksProviderActionSupport.json) ?? .null, graphErrors = value.qbObject?["errors"]?.qbArray ?? []
        guard (200..<300).contains(response.statusCode), graphErrors.isEmpty else {
            throw MarketplaceProviderActionAdapterFailure(
                code: response.statusCode == 401 ? "quickbooks_token_invalid" : response.statusCode == 403 ? "quickbooks_permission_denied" : response.statusCode == 429 ? "quickbooks_rate_limited" : graphErrors.isEmpty ? "quickbooks_http_error" : "quickbooks_graphql_error",
                message: "QuickBooks Payroll Compensation API request failed.", providerStatusCode: response.statusCode,
                detail: [
                    "providerErrorCodes": .array(graphErrors.prefix(3).map { QuickBooksProviderActionSupport.graphQLError($0) }), "intuitTid": response.headers.first { $0.key.lowercased() == "intuit_tid" }.map { .string(String($0.value.prefix(128))) } ?? .null,
                    "retryAfter": response.headers.first { $0.key.lowercased() == "retry-after" }.map { .string(String($0.value.prefix(32))) } ?? .null,
                ])
        }
        return value
    }
    private func paymentGet(_ auth: (token: String, realmId: String, environment: String), chargeId: String) throws -> JSONValue {
        let host = auth.environment == "sandbox" ? "sandbox.api.intuit.com" : "api.intuit.com", url = URL(string: "https://" + host + "/quickbooks/v4/payments/charges/" + chargeId)!
        let response = try http.send(QuickBooksProviderHTTPRequest(url: url, headers: ["Authorization": "Bearer " + auth.token, "Accept": "application/json", "Content-Type": "application/json"]))
        guard response.body.count <= 1_000_000 else { throw MarketplaceProviderActionAdapterFailure(code: "quickbooks_response_too_large", message: "QuickBooks response exceeded the safe size limit.") }
        let value = (try? JSONSerialization.jsonObject(with: response.body)).map(QuickBooksProviderActionSupport.json) ?? .null
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: response.statusCode == 401 ? "quickbooks_token_invalid" : response.statusCode == 403 ? "quickbooks_permission_denied" : response.statusCode == 429 ? "quickbooks_rate_limited" : "quickbooks_http_error", message: "QuickBooks Payments API request failed.",
                providerStatusCode: response.statusCode,
                detail: [
                    "providerErrors": .array((value.qbObject?["errors"]?.qbArray ?? []).prefix(3).map { QuickBooksProviderActionSupport.paymentError($0) }), "intuitTid": response.headers.first { $0.key.lowercased() == "intuit_tid" }.map { .string(String($0.value.prefix(128))) } ?? .null,
                    "retryAfter": response.headers.first { $0.key.lowercased() == "retry-after" }.map { .string(String($0.value.prefix(32))) } ?? .null,
                ])
        }
        return value
    }
    private func output(_ fields: JSONRecord) -> QuickBooksProviderActionClientResult {
        QuickBooksProviderActionClientResult(
            result: ["provider": .string("quickbooks"), "adapterBoundary": .string("quickbooks-provider-action-adapter"), "clientMode": .string("live-quickbooks-online-accounting-api-v3-minor-75"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-state-excluded")]
                .merging(fields) { _, new in new })
    }
}

public struct QuickBooksProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = ["quickbooks_company_info_get", "quickbooks_invoice_list", "quickbooks_invoice_get", "quickbooks_payroll_compensations_list", "quickbooks_payment_charge_get"]; private let client: any QuickBooksProviderActionClient
    public init(client: any QuickBooksProviderActionClient = FakeQuickBooksProviderActionClient()) { self.client = client }
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "quickbooks", Self.allowed.contains(request.definition.actionKey) else { throw MarketplaceProviderActionAdapterFailure(code: "quickbooks_action_not_allowlisted", message: "QuickBooks action is outside read-only V1.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executeQuickBooksAction(request: request).result, error: nil, redactionStatus: "private-state-excluded")
    }
}

enum QuickBooksProviderActionSupport {
    static func numeric(_ value: String) -> Bool { !value.isEmpty && value.count <= 32 && value.allSatisfy(\.isNumber) }
    static func entityId(_ payload: JSONRecord) throws -> String {
        guard let id = payload["invoiceId"]?.string, numeric(id), id != "0" else { throw MarketplaceProviderActionAdapterFailure(code: "quickbooks_invoice_id_invalid", message: "A positive numeric QuickBooks invoice ID is required.") }; return id
    }
    static func employeeId(_ payload: JSONRecord) throws -> String {
        guard let id = payload["employeeId"]?.string, numeric(id), id != "0" else { throw MarketplaceProviderActionAdapterFailure(code: "quickbooks_employee_id_invalid", message: "A positive numeric QuickBooks employee ID is required.") }; return id
    }
    static func paymentChargeId(_ payload: JSONRecord) throws -> String {
        guard let id = payload["chargeId"]?.string, !id.isEmpty, id.count <= 100, id.allSatisfy({ $0.isASCII && ($0.isLetter || $0.isNumber || $0 == "_" || $0 == "-") }) else {
            throw MarketplaceProviderActionAdapterFailure(code: "quickbooks_payment_charge_id_invalid", message: "A valid QuickBooks Payments charge ID is required.")
        }; return id
    }
    static func activeOnly(_ value: JSONValue?) throws -> Bool { guard let value else { return true }; if case .bool(let active) = value { return active }; throw MarketplaceProviderActionAdapterFailure(code: "quickbooks_input_invalid", message: "QuickBooks activeOnly must be a boolean.") }
    static func countryCode(_ value: JSONValue?) throws -> String? {
        guard let value else { return nil };
        guard case .string(let country) = value, country.count == 2, country.allSatisfy({ $0.isASCII && $0.isUppercase && $0.isLetter }) else {
            throw MarketplaceProviderActionAdapterFailure(code: "quickbooks_country_code_invalid", message: "QuickBooks countryCode must be an uppercase two-letter code.")
        }; return country
    }
    static func start(_ value: JSONValue?) -> Int { max(1, min(1_000_000, value?.number.map(Int.init) ?? 1)) }; static func limit(_ value: JSONValue?) -> Int { max(1, min(25, value?.number.map(Int.init) ?? 10)) }
    static func invoice(_ value: JSONValue) -> JSONRecord {
        let o = value.qbObject ?? [:], meta = o["MetaData"]?.qbObject ?? [:];
        return [
            "Id": scalar(o["Id"] ?? .null), "DocNumber": scalar(o["DocNumber"] ?? .null), "TxnDate": scalar(o["TxnDate"] ?? .null), "DueDate": scalar(o["DueDate"] ?? .null), "Currency": scalar(o["CurrencyRef"]?.qbObject?["value"] ?? .null), "TotalAmt": scalar(o["TotalAmt"] ?? .null),
            "Balance": scalar(o["Balance"] ?? .null), "EmailStatus": scalar(o["EmailStatus"] ?? .null), "PrintStatus": scalar(o["PrintStatus"] ?? .null), "CreateTime": scalar(meta["CreateTime"] ?? .null), "LastUpdatedTime": scalar(meta["LastUpdatedTime"] ?? .null),
            "CustomerId": scalar(o["CustomerRef"]?.qbObject?["value"] ?? .null),
        ]
    }
    static func company(_ value: JSONValue, realmId: String, environment: String) -> JSONRecord {
        let o = value.qbObject ?? [:];
        return [
            "RealmId": .string(realmId), "Environment": .string(environment), "CompanyName": scalar(o["CompanyName"] ?? .null), "LegalName": scalar(o["LegalName"] ?? .null), "Country": scalar(o["Country"] ?? .null), "CompanyStartDate": scalar(o["CompanyStartDate"] ?? .null),
            "FiscalYearStartMonth": scalar(o["FiscalYearStartMonth"] ?? .null), "SupportedLanguages": scalar(o["SupportedLanguages"] ?? .null),
        ]
    }
    static func compensation(_ value: JSONValue) -> JSONRecord {
        let o = value.qbObject ?? [:], employer = o["employerCompensation"]?.qbObject ?? [:], type = employer["type"]?.qbObject ?? [:];
        return [
            "id": scalar(o["id"] ?? .null), "active": scalar(o["active"] ?? .null),
            "employerCompensation": .object(["id": scalar(employer["id"] ?? .null), "name": scalar(employer["name"] ?? .null), "type": .object(["key": scalar(type["key"] ?? .null), "description": scalar(type["description"] ?? .null), "value": scalar(type["value"] ?? .null)])]),
        ]
    }
    static func charge(_ value: JSONValue) -> JSONRecord {
        let o = value.qbObject ?? [:]; return ["id": scalar(o["id"] ?? .null), "status": scalar(o["status"] ?? .null), "amount": scalar(o["amount"] ?? .null), "currency": scalar(o["currency"] ?? .null), "created": scalar(o["created"] ?? .null), "capture": scalar(o["capture"] ?? .null)]
    }
    static func scalar(_ value: JSONValue) -> JSONValue { switch value { case .string(let text): return .string(String(text.prefix(512))); case .number, .bool, .null: return value; default: return .null } }
    static func error(_ value: JSONValue) -> JSONValue {
        let fault = value.qbObject?["Fault"]?.qbObject ?? [:], first = fault["Error"]?.qbArray?.first?.qbObject ?? [:];
        return .object(["type": scalar(fault["type"] ?? .null), "code": scalar(first["code"] ?? .null), "element": scalar(first["element"] ?? .null), "message": scalar(first["Message"] ?? .null), "detail": scalar(first["Detail"] ?? .null)])
    }
    static func graphQLError(_ value: JSONValue) -> JSONValue { .object(["code": scalar(value.qbObject?["extensions"]?.qbObject?["code"] ?? .null)]) }
    static func paymentError(_ value: JSONValue) -> JSONValue { .object(["code": scalar(value.qbObject?["code"] ?? .null), "type": scalar(value.qbObject?["type"] ?? .null)]) }
    static func fakeInvoice() -> JSONRecord {
        [
            "Id": .string("142"), "DocNumber": .string("1037"), "TxnDate": .string("2026-07-01"), "DueDate": .string("2026-07-31"), "Currency": .string("GBP"), "TotalAmt": .number(120.30), "Balance": .number(120.30), "EmailStatus": .string("NeedToSend"), "PrintStatus": .string("NeedToPrint"),
            "CreateTime": .string("2026-07-01T09:00:00Z"), "LastUpdatedTime": .string("2026-07-01T09:00:00Z"), "CustomerId": .string("58"),
        ]
    }
    static func fakeCompany() -> JSONRecord {
        [
            "RealmId": .string("123456789012345"), "Environment": .string("sandbox"), "CompanyName": .string("Relay Books Ltd"), "LegalName": .string("Relay Books Limited"), "Country": .string("GB"), "CompanyStartDate": .string("2024-01-01"), "FiscalYearStartMonth": .string("January"),
            "SupportedLanguages": .string("en"),
        ]
    }
    static func fakeCompensation() -> JSONRecord {
        ["id": .string("1"), "active": .bool(true), "employerCompensation": .object(["id": .string("626270109"), "name": .string("Regular pay"), "type": .object(["key": .string("REGULAR_PAY"), "description": .string("Regular hourly pay"), "value": .string("Hourly")])])]
    }
    static func fakeCharge() -> JSONRecord { ["id": .string("EAQX3720TN5J"), "status": .string("CAPTURED"), "amount": .string("10.55"), "currency": .string("USD"), "created": .string("2026-07-17T18:48:25Z"), "capture": .bool(true)] }
    static func json(_ value: Any) -> JSONValue {
        if let v = value as? String { return .string(v) }; if let v = value as? Bool { return .bool(v) }; if let v = value as? Int { return .number(Double(v)) }; if let v = value as? Double { return .number(v) }; if let v = value as? [String: Any] { return .object(v.mapValues(json)) };
        if let v = value as? [Any] { return .array(v.map(json)) }; return .null
    }
}
private extension JSONValue { var qbObject: JSONRecord? { if case .object(let value) = self { return value }; return nil }; var qbArray: [JSONValue]? { if case .array(let value) = self { return value }; return nil } }
