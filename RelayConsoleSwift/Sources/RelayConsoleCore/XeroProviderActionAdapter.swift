import Foundation

public struct XeroProviderActionClientResult: Codable, Equatable, Sendable { public var result: JSONRecord; public init(result: JSONRecord) { self.result = result } }
public protocol XeroProviderActionClient: Sendable { func executeXeroAction(request: MarketplaceProviderActionAdapterRequest) throws -> XeroProviderActionClientResult }
public struct XeroProviderHTTPRequest: Sendable, Equatable { public var url: URL; public var headers: [String: String]; public init(url: URL, headers: [String: String]) { self.url = url; self.headers = headers } }
public struct XeroProviderHTTPResponse: Sendable, Equatable {
    public var statusCode: Int; public var headers: [String: String]; public var body: Data; public init(statusCode: Int, headers: [String: String] = [:], body: Data = Data()) { self.statusCode = statusCode; self.headers = headers; self.body = body }
}
public protocol XeroProviderHTTPClient: Sendable { func send(_ request: XeroProviderHTTPRequest) throws -> XeroProviderHTTPResponse }
private final class XeroNoRedirectDelegate: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}
public struct URLSessionXeroProviderHTTPClient: XeroProviderHTTPClient {
    public init() {};
    public func send(_ request: XeroProviderHTTPRequest) throws -> XeroProviderHTTPResponse {
        var value = URLRequest(url: request.url); value.httpMethod = "GET"; value.timeoutInterval = 20; request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) };
        let session = URLSession(configuration: .ephemeral, delegate: XeroNoRedirectDelegate(), delegateQueue: nil), semaphore = DispatchSemaphore(value: 0); var data: Data?; var response: HTTPURLResponse?; var failure: Error?;
        let task = session.dataTask(with: value) {
            data = $0; response = $1 as? HTTPURLResponse; failure = $2; semaphore.signal()
        }; task.resume(); if semaphore.wait(timeout: .now() + 20) == .timedOut { task.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "xero_http_timeout", message: "Xero API request timed out.") }; session.invalidateAndCancel(); if let failure { throw failure };
        return XeroProviderHTTPResponse(statusCode: response?.statusCode ?? 0, headers: response?.allHeaderFields.reduce(into: [:]) { $0[String(describing: $1.key)] = String(describing: $1.value) } ?? [:], body: data ?? Data())
    }
}

public struct FakeXeroProviderActionClient: XeroProviderActionClient {
    public init() {};
    public func executeXeroAction(request: MarketplaceProviderActionAdapterRequest) throws -> XeroProviderActionClientResult {
        switch request.definition.actionKey {
        case "xero_organisation_get": return out(["semanticReadContract": .string("xero-organisation-v1"), "organisation": .object(XeroProviderActionSupport.fakeOrganisation())]);
        case "xero_invoice_list": return out(["semanticReadContract": .string("xero-invoice-list-v1"), "invoices": .array([.object(XeroProviderActionSupport.fakeInvoice())]), "page": .number(1)]);
        case "xero_invoice_get": return out(["semanticReadContract": .string("xero-invoice-get-v1"), "invoice": .object(XeroProviderActionSupport.fakeInvoice())]);
        default: throw MarketplaceProviderActionAdapterFailure(code: "xero_fake_action_not_supported", message: "Unsupported Xero action.")
        }
    };
    private func out(_ fields: JSONRecord) -> XeroProviderActionClientResult {
        XeroProviderActionClientResult(
            result: ["provider": .string("xero"), "adapterBoundary": .string("xero-provider-action-adapter"), "clientMode": .string("fake-xero-accounting-api"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-state-excluded")].merging(fields) { _, new in new })
    }
}

public final class LiveXeroProviderActionClient: XeroProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService; private let secrets: SecretService; private let http: any XeroProviderHTTPClient
    public init(data: LocalDataService, secrets: SecretService, httpClient: any XeroProviderHTTPClient = URLSessionXeroProviderHTTPClient()) { self.data = data; self.secrets = secrets; self.http = httpClient }
    public func executeXeroAction(request: MarketplaceProviderActionAdapterRequest) throws -> XeroProviderActionClientResult {
        let auth = try authorization(request), payload = request.payload;
        switch request.definition.actionKey {
        case "xero_organisation_get":
            let root = try get(auth, "/Organisation", []).xeroObject ?? [:], value = root["Organisations"]?.xeroArray?.first ?? .null; return out(["semanticReadContract": .string("xero-organisation-v1"), "organisation": .object(XeroProviderActionSupport.organisation(value))]);
        case "xero_invoice_list":
            let page = XeroProviderActionSupport.page(payload["page"]), status = try XeroProviderActionSupport.status(payload["status"]);
            var query = [URLQueryItem(name: "page", value: String(page)), URLQueryItem(name: "pageSize", value: String(XeroProviderActionSupport.limit(payload["limit"]))), URLQueryItem(name: "order", value: "UpdatedDateUTC DESC"), URLQueryItem(name: "summaryOnly", value: "true")];
            if let status { query.append(URLQueryItem(name: "Statuses", value: status)) }; let root = try get(auth, "/Invoices", query).xeroObject ?? [:], invoices: [JSONValue] = (root["Invoices"]?.xeroArray ?? []).prefix(25).map { JSONValue.object(XeroProviderActionSupport.invoice($0)) };
            return out(["semanticReadContract": .string("xero-invoice-list-v1"), "invoices": .array(invoices), "page": .number(Double(page))]);
        case "xero_invoice_get":
            let id = try XeroProviderActionSupport.invoiceId(payload), root = try get(auth, "/Invoices/" + id, []).xeroObject ?? [:], value = root["Invoices"]?.xeroArray?.first ?? .null;
            return out(["semanticReadContract": .string("xero-invoice-get-v1"), "invoice": .object(XeroProviderActionSupport.invoice(value))]);
        default: throw MarketplaceProviderActionAdapterFailure(code: "xero_live_action_not_supported", message: "Unsupported live Xero action.")
        }
    }
    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> (token: String, tenant: String) {
        guard let id = request.auditIdentity.connectionId, let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), connection.appSlug == "xero",
            let ref = connection.credentialRequirements.first(where: { $0.fieldKey == "xero_oauth_access_token" })?.secretReferenceId, let tenant = connection.health.diagnostics["tenantId"]?.string, XeroProviderActionSupport.uuid(tenant)
        else { throw MarketplaceProviderActionAdapterFailure(code: "xero_connection_not_ready", message: "Xero organisation connection is not ready.") }; return (try secrets.getSecretValue(ref), tenant)
    }
    private func get(_ auth: (token: String, tenant: String), _ path: String, _ query: [URLQueryItem]) throws -> JSONValue {
        var components = URLComponents(string: "https://api.xero.com/api.xro/2.0" + path)!; components.queryItems = query.isEmpty ? nil : query;
        let response = try http.send(XeroProviderHTTPRequest(url: components.url!, headers: ["Authorization": "Bearer " + auth.token, "xero-tenant-id": auth.tenant, "Accept": "application/json"]));
        guard (200..<300).contains(response.statusCode) else {
            let value = (try? JSONSerialization.jsonObject(with: response.body)).map(XeroProviderActionSupport.json) ?? .null;
            throw MarketplaceProviderActionAdapterFailure(
                code: response.statusCode == 401 ? "xero_token_invalid" : response.statusCode == 403 ? "xero_permission_denied" : response.statusCode == 429 ? "xero_rate_limited" : "xero_http_error", message: "Xero Accounting API request failed.", providerStatusCode: response.statusCode,
                detail: ["providerError": XeroProviderActionSupport.error(value), "retryAfter": response.headers.first { $0.key.lowercased() == "retry-after" }.map { .string($0.value) } ?? .null])
        }; return XeroProviderActionSupport.json(try JSONSerialization.jsonObject(with: response.body))
    }
    private func out(_ fields: JSONRecord) -> XeroProviderActionClientResult {
        XeroProviderActionClientResult(
            result: ["provider": .string("xero"), "adapterBoundary": .string("xero-provider-action-adapter"), "clientMode": .string("live-xero-accounting-api-2.0"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-state-excluded")].merging(fields) { _, new in new })
    }
}

public struct XeroProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = ["xero_organisation_get", "xero_invoice_list", "xero_invoice_get"]; private let client: any XeroProviderActionClient; public init(client: any XeroProviderActionClient = FakeXeroProviderActionClient()) { self.client = client };
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "xero", Self.allowed.contains(request.definition.actionKey) else { throw MarketplaceProviderActionAdapterFailure(code: "xero_action_not_allowlisted", message: "Xero action is outside read-only V1.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executeXeroAction(request: request).result, error: nil, redactionStatus: "private-state-excluded")
    }
}

enum XeroProviderActionSupport {
    static let statuses = Set(["DRAFT", "SUBMITTED", "AUTHORISED", "PAID", "VOIDED", "DELETED"])
    static func uuid(_ value: String) -> Bool { UUID(uuidString: value) != nil && value.count == 36 }
    static func invoiceId(_ payload: JSONRecord) throws -> String { guard let id = payload["invoiceId"]?.string, uuid(id) else { throw MarketplaceProviderActionAdapterFailure(code: "xero_invoice_id_invalid", message: "A valid Xero invoice UUID is required.") }; return id }
    static func status(_ value: JSONValue?) throws -> String? {
        guard let value else { return nil }; guard let text = value.string, statuses.contains(text) else { throw MarketplaceProviderActionAdapterFailure(code: "xero_invoice_status_invalid", message: "Xero invoice status is invalid.") }; return text
    }
    static func page(_ value: JSONValue?) -> Int { max(1, min(10_000, value?.number.map(Int.init) ?? 1)) }; static func limit(_ value: JSONValue?) -> Int { max(1, min(25, value?.number.map(Int.init) ?? 10)) }
    static func invoice(_ value: JSONValue) -> JSONRecord {
        let o = value.xeroObject ?? [:], keys = ["InvoiceID", "InvoiceNumber", "Type", "Status", "Date", "DueDate", "CurrencyCode", "SubTotal", "TotalTax", "Total", "AmountDue", "AmountPaid", "AmountCredited", "UpdatedDateUTC", "HasAttachments"];
        var result = Dictionary(uniqueKeysWithValues: keys.map { ($0, scalar(o[$0] ?? .null)) }); result["ContactID"] = scalar(o["Contact"]?.xeroObject?["ContactID"] ?? .null); return result
    }
    static func organisation(_ value: JSONValue) -> JSONRecord {
        let o = value.xeroObject ?? [:], keys = ["OrganisationID", "Name", "LegalName", "BaseCurrency", "CountryCode", "Version", "OrganisationType", "PaysTax"]; return Dictionary(uniqueKeysWithValues: keys.map { ($0, scalar(o[$0] ?? .null)) })
    }
    static func scalar(_ value: JSONValue) -> JSONValue { switch value { case .string(let s): return .string(String(s.prefix(512))); case .number, .bool, .null: return value; default: return .null } }
    static func error(_ value: JSONValue) -> JSONValue {
        let o = value.xeroObject ?? [:]; return .object(["type": scalar(o["Type"] ?? o["type"] ?? .null), "status": scalar(o["Status"] ?? o["status"] ?? .null), "message": scalar(o["Message"] ?? o["message"] ?? .null), "errorNumber": scalar(o["ErrorNumber"] ?? .null)])
    }
    static func fakeInvoice() -> JSONRecord {
        [
            "InvoiceID": .string("243216c5-369e-4056-ac67-05388f86dc81"), "InvoiceNumber": .string("INV-001"), "Type": .string("ACCREC"), "Status": .string("AUTHORISED"), "Date": .string("2026-07-01"), "DueDate": .string("2026-07-31"), "CurrencyCode": .string("GBP"), "SubTotal": .number(100),
            "TotalTax": .number(20), "Total": .number(120), "AmountDue": .number(120), "AmountPaid": .number(0), "AmountCredited": .number(0), "UpdatedDateUTC": .string("/Date(1782864000000+0000)/"), "HasAttachments": .bool(false), "ContactID": .string("3138017f-8ddc-420e-a159-e7e1cf9e643d"),
        ]
    }
    static func fakeOrganisation() -> JSONRecord {
        [
            "OrganisationID": .string("6e91a9e7-f5b2-45db-afe9-60bca7dc3075"), "Name": .string("Relay Demo Ltd"), "LegalName": .string("Relay Demo Limited"), "BaseCurrency": .string("GBP"), "CountryCode": .string("GB"), "Version": .string("UK"), "OrganisationType": .string("COMPANY"),
            "PaysTax": .bool(true),
        ]
    }
    static func json(_ value: Any) -> JSONValue {
        if let v = value as? String { return .string(v) }; if let v = value as? Bool { return .bool(v) }; if let v = value as? Int { return .number(Double(v)) }; if let v = value as? Double { return .number(v) }; if let v = value as? [String: Any] { return .object(v.mapValues(json)) };
        if let v = value as? [Any] { return .array(v.map(json)) }; return .null
    }
}
private extension JSONValue { var xeroObject: JSONRecord? { if case .object(let value) = self { return value }; return nil }; var xeroArray: [JSONValue]? { if case .array(let value) = self { return value }; return nil } }
