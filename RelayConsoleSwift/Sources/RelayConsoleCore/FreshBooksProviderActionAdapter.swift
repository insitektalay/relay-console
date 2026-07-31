import Foundation

public struct FreshBooksProviderHTTPRequest: Sendable { public let url: URL; public let headers: [String: String]; public init(url: URL, headers: [String: String]) { self.url = url; self.headers = headers } }
public struct FreshBooksProviderHTTPResponse: Sendable {
    public let statusCode: Int; public let headers: [String: String]; public let body: Data; public init(statusCode: Int, headers: [String: String] = [:], body: Data = Data()) { self.statusCode = statusCode; self.headers = headers; self.body = body }
}
public protocol FreshBooksProviderHTTPClient: Sendable { func send(_ request: FreshBooksProviderHTTPRequest) throws -> FreshBooksProviderHTTPResponse }
private final class FreshBooksNoRedirectDelegate: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}
public struct URLSessionFreshBooksProviderHTTPClient: FreshBooksProviderHTTPClient {
    public init() {};
    public func send(_ request: FreshBooksProviderHTTPRequest) throws -> FreshBooksProviderHTTPResponse {
        var value = URLRequest(url: request.url); value.httpMethod = "GET"; value.timeoutInterval = 20; request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) };
        let session = URLSession(configuration: .ephemeral, delegate: FreshBooksNoRedirectDelegate(), delegateQueue: nil), semaphore = DispatchSemaphore(value: 0); var data: Data?, response: HTTPURLResponse?, failure: Error?;
        let task = session.dataTask(with: value) {
            data = $0; response = $1 as? HTTPURLResponse; failure = $2; semaphore.signal()
        }; task.resume(); if semaphore.wait(timeout: .now() + 20) == .timedOut { task.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "freshbooks_http_timeout", message: "FreshBooks API request timed out.") }; session.invalidateAndCancel(); if let failure { throw failure };
        return FreshBooksProviderHTTPResponse(statusCode: response?.statusCode ?? 0, headers: response?.allHeaderFields.reduce(into: [:]) { $0[String(describing: $1.key)] = String(describing: $1.value) } ?? [:], body: data ?? Data())
    }
}
public struct FreshBooksProviderActionClientResult: Sendable { public let result: JSONRecord; public init(result: JSONRecord) { self.result = result } }
public protocol FreshBooksProviderActionClient: Sendable { func executeFreshBooksAction(request: MarketplaceProviderActionAdapterRequest) throws -> FreshBooksProviderActionClientResult }
public struct FakeFreshBooksProviderActionClient: FreshBooksProviderActionClient {
    public init() {};
    public func executeFreshBooksAction(request: MarketplaceProviderActionAdapterRequest) throws -> FreshBooksProviderActionClientResult {
        switch request.definition.actionKey {
        case "freshbooks_business_memberships_list": return out(["semanticReadContract": .string("freshbooks-business-memberships-v1"), "businessMemberships": .array([.object(FreshBooksProviderActionSupport.fakeBusiness())])]);
        case "freshbooks_invoice_list": return out(["semanticReadContract": .string("freshbooks-invoice-list-v1"), "invoices": .array([.object(FreshBooksProviderActionSupport.fakeInvoice())]), "page": .number(1)]);
        case "freshbooks_invoice_get": return out(["semanticReadContract": .string("freshbooks-invoice-get-v1"), "invoice": .object(FreshBooksProviderActionSupport.fakeInvoice())]);
        default: throw MarketplaceProviderActionAdapterFailure(code: "freshbooks_fake_action_not_supported", message: "Unsupported FreshBooks action.")
        }
    };
    private func out(_ fields: JSONRecord) -> FreshBooksProviderActionClientResult {
        FreshBooksProviderActionClientResult(
            result: ["provider": .string("freshbooks"), "adapterBoundary": .string("freshbooks-provider-action-adapter"), "clientMode": .string("fake-freshbooks-accounting-api"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-state-excluded")].merging(fields) {
                _, new in new
            })
    }
}

public final class LiveFreshBooksProviderActionClient: FreshBooksProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService; private let secrets: SecretService; private let http: any FreshBooksProviderHTTPClient
    public init(data: LocalDataService, secrets: SecretService, httpClient: any FreshBooksProviderHTTPClient = URLSessionFreshBooksProviderHTTPClient()) { self.data = data; self.secrets = secrets; self.http = httpClient }
    public func executeFreshBooksAction(request: MarketplaceProviderActionAdapterRequest) throws -> FreshBooksProviderActionClientResult {
        let auth = try authorization(request), payload = request.payload;
        switch request.definition.actionKey {
        case "freshbooks_business_memberships_list":
            let root = try get(auth.token, "/auth/api/v1/users/me", []), response = root.fbObject?["response"]?.fbObject ?? [:], memberships: [JSONValue] = (response["business_memberships"]?.fbArray ?? []).prefix(25).map { .object(FreshBooksProviderActionSupport.business($0)) };
            return out(["semanticReadContract": .string("freshbooks-business-memberships-v1"), "businessMemberships": .array(memberships)]);
        case "freshbooks_invoice_list":
            let page = FreshBooksProviderActionSupport.page(payload["page"]), limit = FreshBooksProviderActionSupport.limit(payload["limit"]),
                root = try get(auth.token, "/accounting/account/" + auth.accountId + "/invoices/invoices", [URLQueryItem(name: "page", value: String(page)), URLQueryItem(name: "per_page", value: String(limit)), URLQueryItem(name: "sort", value: "updated_desc")]),
                result = root.fbObject?["response"]?.fbObject?["result"]?.fbObject ?? [:], invoices: [JSONValue] = (result["invoices"]?.fbArray ?? []).prefix(25).map { .object(FreshBooksProviderActionSupport.invoice($0)) }
            ; return out(["semanticReadContract": .string("freshbooks-invoice-list-v1"), "invoices": .array(invoices), "page": .number(Double(page))]);
        case "freshbooks_invoice_get":
            let id = try FreshBooksProviderActionSupport.invoiceId(payload), root = try get(auth.token, "/accounting/account/" + auth.accountId + "/invoices/invoices/" + id, []), result = root.fbObject?["response"]?.fbObject?["result"]?.fbObject ?? [:],
                value = result["invoice"] ?? result["invoices"]?.fbArray?.first ?? .null
            ; return out(["semanticReadContract": .string("freshbooks-invoice-get-v1"), "invoice": .object(FreshBooksProviderActionSupport.invoice(value))]);
        default: throw MarketplaceProviderActionAdapterFailure(code: "freshbooks_live_action_not_supported", message: "Unsupported live FreshBooks action.")
        }
    }
    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> (token: String, accountId: String) {
        guard let id = request.auditIdentity.connectionId, let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), connection.appSlug == "freshbooks",
            let ref = connection.credentialRequirements.first(where: { $0.fieldKey == "freshbooks_oauth_access_token" })?.secretReferenceId, let account = connection.health.diagnostics["accountId"]?.string, FreshBooksProviderActionSupport.account(account)
        else { throw MarketplaceProviderActionAdapterFailure(code: "freshbooks_connection_not_ready", message: "FreshBooks business/account connection is not ready.") }; return (try secrets.getSecretValue(ref), account)
    }
    private func get(_ token: String, _ path: String, _ query: [URLQueryItem]) throws -> JSONValue {
        var components = URLComponents(string: "https://api.freshbooks.com" + path)!; components.queryItems = query.isEmpty ? nil : query;
        let response = try http.send(FreshBooksProviderHTTPRequest(url: components.url!, headers: ["Authorization": "Bearer " + token, "Accept": "application/json"])), value = (try? JSONSerialization.jsonObject(with: response.body)).map(FreshBooksProviderActionSupport.json) ?? .null;
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: response.statusCode == 401 ? "freshbooks_token_invalid" : response.statusCode == 403 ? "freshbooks_permission_denied" : response.statusCode == 429 ? "freshbooks_rate_limited" : "freshbooks_http_error", message: "FreshBooks API request failed.",
                providerStatusCode: response.statusCode, detail: ["providerError": FreshBooksProviderActionSupport.error(value), "retryAfter": response.headers.first { $0.key.lowercased() == "retry-after" }.map { .string(String($0.value.prefix(32))) } ?? .null])
        }; return value
    }
    private func out(_ fields: JSONRecord) -> FreshBooksProviderActionClientResult {
        FreshBooksProviderActionClientResult(
            result: ["provider": .string("freshbooks"), "adapterBoundary": .string("freshbooks-provider-action-adapter"), "clientMode": .string("live-freshbooks-accounting-api"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-state-excluded")].merging(fields) {
                _, new in new
            })
    }
}
public struct FreshBooksProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = ["freshbooks_business_memberships_list", "freshbooks_invoice_list", "freshbooks_invoice_get"]; private let client: any FreshBooksProviderActionClient;
    public init(client: any FreshBooksProviderActionClient = FakeFreshBooksProviderActionClient()) { self.client = client };
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "freshbooks", Self.allowed.contains(request.definition.actionKey) else { throw MarketplaceProviderActionAdapterFailure(code: "freshbooks_action_not_allowlisted", message: "FreshBooks action is outside read-only V1.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executeFreshBooksAction(request: request).result, error: nil, redactionStatus: "private-state-excluded")
    }
}

enum FreshBooksProviderActionSupport {
    static func account(_ value: String) -> Bool { !value.isEmpty && value.count <= 64 && value.allSatisfy { $0.isLetter || $0.isNumber || $0 == "-" || $0 == "_" } };
    static func invoiceId(_ payload: JSONRecord) throws -> String {
        guard let id = payload["invoiceId"]?.string, !id.isEmpty, id.count <= 32, id.allSatisfy(\.isNumber), id != "0" else { throw MarketplaceProviderActionAdapterFailure(code: "freshbooks_invoice_id_invalid", message: "A positive numeric FreshBooks invoice ID is required.") }; return id
    }; static func page(_ value: JSONValue?) -> Int { max(1, min(10_000, value?.number.map(Int.init) ?? 1)) }; static func limit(_ value: JSONValue?) -> Int { max(1, min(25, value?.number.map(Int.init) ?? 10)) }
    static func business(_ value: JSONValue) -> JSONRecord {
        let o = value.fbObject ?? [:], b = o["business"]?.fbObject ?? [:];
        return [
            "MembershipId": scalar(o["id"] ?? .null), "Role": scalar(o["role"] ?? .null), "BusinessId": scalar(b["id"] ?? .null), "BusinessUUID": scalar(b["business_uuid"] ?? .null), "BusinessName": scalar(b["name"] ?? .null), "AccountId": scalar(b["account_id"] ?? .null),
            "Active": scalar(b["active"] ?? .null),
        ]
    }
    static func money(_ value: JSONValue?) -> JSONValue { let o = value?.fbObject ?? [:]; return .object(["amount": scalar(o["amount"] ?? .null), "code": scalar(o["code"] ?? .null)]) }
    static func invoice(_ value: JSONValue) -> JSONRecord {
        let o = value.fbObject ?? [:];
        return [
            "InvoiceId": scalar(o["invoiceid"] ?? o["id"] ?? .null), "InvoiceNumber": scalar(o["invoice_number"] ?? .null), "CreateDate": scalar(o["create_date"] ?? .null), "DueDate": scalar(o["due_date"] ?? .null), "V3Status": scalar(o["v3_status"] ?? .null),
            "DisplayStatus": scalar(o["display_status"] ?? .null), "PaymentStatus": scalar(o["payment_status"] ?? .null), "Amount": money(o["amount"]), "Paid": money(o["paid"]), "Outstanding": money(o["outstanding"]), "DatePaid": scalar(o["date_paid"] ?? .null),
            "CreatedAt": scalar(o["created_at"] ?? .null), "Updated": scalar(o["updated"] ?? .null), "CustomerId": scalar(o["customerid"] ?? .null),
        ]
    }
    static func scalar(_ value: JSONValue) -> JSONValue {
        switch value {
        case .string(let text): return .string(String(text.prefix(512)));
        case .number, .bool, .null: return value;
        default: return .null
        }
    };
    static func error(_ value: JSONValue) -> JSONValue {
        let response = value.fbObject?["response"]?.fbObject ?? [:], errors = response["errors"]?.fbArray ?? []; return .object(["message": scalar(response["error"] ?? response["message"] ?? .null), "firstError": errors.first.map { scalar($0) } ?? .null])
    }
    static func fakeBusiness() -> JSONRecord {
        ["MembershipId": .number(111), "Role": .string("owner"), "BusinessId": .number(240340), "BusinessUUID": .string("046cc001-0002-e93e-1db1-1186b2983879"), "BusinessName": .string("Relay Books Studio"), "AccountId": .string("ABC123"), "Active": .bool(true)]
    };
    static func fakeInvoice() -> JSONRecord {
        [
            "InvoiceId": .number(2201278), "InvoiceNumber": .string("0005"), "CreateDate": .string("2026-07-01"), "DueDate": .string("2026-07-31"), "V3Status": .string("sent"), "DisplayStatus": .string("sent"), "PaymentStatus": .string("unpaid"),
            "Amount": .object(["amount": .string("800.00"), "code": .string("GBP")]), "Paid": .object(["amount": .string("0.00"), "code": .string("GBP")]), "Outstanding": .object(["amount": .string("800.00"), "code": .string("GBP")]), "DatePaid": .null, "CreatedAt": .string("2026-07-01 09:00:00"),
            "Updated": .string("2026-07-01 09:00:00"), "CustomerId": .number(58),
        ]
    }
    static func json(_ value: Any) -> JSONValue {
        if let v = value as? String { return .string(v) }; if let v = value as? Bool { return .bool(v) }; if let v = value as? Int { return .number(Double(v)) }; if let v = value as? Double { return .number(v) }; if let v = value as? [String: Any] { return .object(v.mapValues(json)) };
        if let v = value as? [Any] { return .array(v.map(json)) }; return .null
    }
}
private extension JSONValue { var fbObject: JSONRecord? { if case .object(let value) = self { return value }; return nil }; var fbArray: [JSONValue]? { if case .array(let value) = self { return value }; return nil } }
