import Foundation

public struct FreeAgentProviderHTTPRequest: Sendable {
    public let url: URL
    public let headers: [String: String]
    public init(url: URL, headers: [String: String]) { self.url = url; self.headers = headers }
}

public struct FreeAgentProviderHTTPResponse: Sendable {
    public let statusCode: Int
    public let headers: [String: String]
    public let body: Data
    public init(statusCode: Int, headers: [String: String] = [:], body: Data = Data()) { self.statusCode = statusCode; self.headers = headers; self.body = body }
}

public protocol FreeAgentProviderHTTPClient: Sendable { func send(_ request: FreeAgentProviderHTTPRequest) throws -> FreeAgentProviderHTTPResponse }

private final class FreeAgentNoRedirectDelegate: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}

public struct URLSessionFreeAgentProviderHTTPClient: FreeAgentProviderHTTPClient {
    public init() {}
    public func send(_ request: FreeAgentProviderHTTPRequest) throws -> FreeAgentProviderHTTPResponse {
        var value = URLRequest(url: request.url); value.httpMethod = "GET"; value.timeoutInterval = 20
        request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) }
        let session = URLSession(configuration: .ephemeral, delegate: FreeAgentNoRedirectDelegate(), delegateQueue: nil), semaphore = DispatchSemaphore(value: 0)
        var data: Data?, response: HTTPURLResponse?, failure: Error?
        let task = session.dataTask(with: value) { data = $0; response = $1 as? HTTPURLResponse; failure = $2; semaphore.signal() }
        task.resume()
        if semaphore.wait(timeout: .now() + 20) == .timedOut { task.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "freeagent_http_timeout", message: "FreeAgent API request timed out.") }
        session.invalidateAndCancel()
        if let failure { throw failure }
        return FreeAgentProviderHTTPResponse(statusCode: response?.statusCode ?? 0, headers: response?.allHeaderFields.reduce(into: [:]) { $0[String(describing: $1.key)] = String(describing: $1.value) } ?? [:], body: data ?? Data())
    }
}

public struct FreeAgentProviderActionClientResult: Sendable { public let result: JSONRecord; public init(result: JSONRecord) { self.result = result } }
public protocol FreeAgentProviderActionClient: Sendable { func executeFreeAgentAction(request: MarketplaceProviderActionAdapterRequest) throws -> FreeAgentProviderActionClientResult }

public struct FakeFreeAgentProviderActionClient: FreeAgentProviderActionClient {
    public init() {}
    public func executeFreeAgentAction(request: MarketplaceProviderActionAdapterRequest) throws -> FreeAgentProviderActionClientResult {
        switch request.definition.actionKey {
        case "freeagent_company_get": return output(["semanticReadContract": .string("freeagent-company-v1"), "company": .object(FreeAgentProviderActionSupport.fakeCompany())])
        case "freeagent_invoice_list": return output(["semanticReadContract": .string("freeagent-invoice-list-v1"), "invoices": .array([.object(FreeAgentProviderActionSupport.fakeInvoice())]), "page": .number(1)])
        case "freeagent_invoice_get": return output(["semanticReadContract": .string("freeagent-invoice-get-v1"), "invoice": .object(FreeAgentProviderActionSupport.fakeInvoice())])
        default: throw MarketplaceProviderActionAdapterFailure(code: "freeagent_fake_action_not_supported", message: "Unsupported FreeAgent action.")
        }
    }
    private func output(_ fields: JSONRecord) -> FreeAgentProviderActionClientResult {
        FreeAgentProviderActionClientResult(
            result: ["provider": .string("freeagent"), "adapterBoundary": .string("freeagent-provider-action-adapter"), "clientMode": .string("fake-freeagent-company-rest"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-state-excluded")].merging(fields) { _, new in new
            })
    }
}

public final class LiveFreeAgentProviderActionClient: FreeAgentProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService; private let secrets: SecretService; private let http: any FreeAgentProviderHTTPClient
    public init(data: LocalDataService, secrets: SecretService, httpClient: any FreeAgentProviderHTTPClient = URLSessionFreeAgentProviderHTTPClient()) { self.data = data; self.secrets = secrets; self.http = httpClient }
    public func executeFreeAgentAction(request: MarketplaceProviderActionAdapterRequest) throws -> FreeAgentProviderActionClientResult {
        let auth = try authorization(request)
        switch request.definition.actionKey {
        case "freeagent_company_get":
            let root = try get(auth, path: "/company", query: []), company = root.freeAgentObject?["company"] ?? .null
            return output(["semanticReadContract": .string("freeagent-company-v1"), "company": .object(FreeAgentProviderActionSupport.company(company))])
        case "freeagent_invoice_list":
            let page = FreeAgentProviderActionSupport.page(request.payload["page"]), view = try FreeAgentProviderActionSupport.view(request.payload["view"]),
                query = [URLQueryItem(name: "page", value: String(page)), URLQueryItem(name: "sort", value: "-updated_at")] + (view.map { [URLQueryItem(name: "view", value: $0)] } ?? [])
            let root = try get(auth, path: "/invoices", query: query), values = (root.freeAgentObject?["invoices"]?.freeAgentArray ?? []).prefix(25).map { JSONValue.object(FreeAgentProviderActionSupport.invoice($0)) }
            return output(["semanticReadContract": .string("freeagent-invoice-list-v1"), "invoices": .array(Array(values)), "page": .number(Double(page)), "sort": .string("-updated_at")])
        case "freeagent_invoice_get":
            let id = try FreeAgentProviderActionSupport.invoiceId(request.payload), root = try get(auth, path: "/invoices/\(id)", query: []), invoice = root.freeAgentObject?["invoice"] ?? .null
            return output(["semanticReadContract": .string("freeagent-invoice-get-v1"), "invoice": .object(FreeAgentProviderActionSupport.invoice(invoice))])
        default: throw MarketplaceProviderActionAdapterFailure(code: "freeagent_live_action_not_supported", message: "Unsupported live FreeAgent action.")
        }
    }
    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> (token: String, base: URL) {
        guard let id = request.auditIdentity.connectionId, let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), connection.appSlug == "freeagent",
            let ref = connection.credentialRequirements.first(where: { $0.fieldKey == "freeagent_oauth_access_token" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "freeagent_connection_not_ready", message: "FreeAgent company connection is not ready.") }
        let environment = connection.health.diagnostics["environment"]?.string ?? "production", base = environment == "sandbox" ? "https://api.sandbox.freeagent.com/v2" : "https://api.freeagent.com/v2"
        return (try secrets.getSecretValue(ref), URL(string: base)!)
    }
    private func get(_ auth: (token: String, base: URL), path: String, query: [URLQueryItem]) throws -> JSONValue {
        var components = URLComponents(url: auth.base.appendingPathComponent(String(path.dropFirst())), resolvingAgainstBaseURL: false)!; components.queryItems = query.isEmpty ? nil : query
        let response = try http.send(FreeAgentProviderHTTPRequest(url: components.url!, headers: ["Authorization": "Bearer " + auth.token, "Accept": "application/json", "User-Agent": "RelayConsole-FreeAgent/1.0"]))
        let value = (try? JSONSerialization.jsonObject(with: response.body)).map(FreeAgentProviderActionSupport.json) ?? .null
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: response.statusCode == 401 ? "freeagent_token_invalid" : response.statusCode == 403 ? "freeagent_permission_denied" : response.statusCode == 429 ? "freeagent_rate_limited" : "freeagent_api_error", message: "FreeAgent company API request failed.",
                providerStatusCode: response.statusCode, detail: ["retryAfter": response.headers.first { $0.key.lowercased() == "retry-after" }.map { .string(String($0.value.prefix(32))) } ?? .null])
        }
        return value
    }
    private func output(_ fields: JSONRecord) -> FreeAgentProviderActionClientResult {
        FreeAgentProviderActionClientResult(
            result: ["provider": .string("freeagent"), "adapterBoundary": .string("freeagent-provider-action-adapter"), "clientMode": .string("live-freeagent-company-rest"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-state-excluded")].merging(fields) { _, new in new
            })
    }
}

public struct FreeAgentProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = ["freeagent_company_get", "freeagent_invoice_list", "freeagent_invoice_get"]
    private let client: any FreeAgentProviderActionClient
    public init(client: any FreeAgentProviderActionClient = FakeFreeAgentProviderActionClient()) { self.client = client }
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "freeagent", Self.allowed.contains(request.definition.actionKey) else { throw MarketplaceProviderActionAdapterFailure(code: "freeagent_action_not_allowlisted", message: "FreeAgent action is outside read-only V1.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executeFreeAgentAction(request: request).result, error: nil, redactionStatus: "private-state-excluded")
    }
}

enum FreeAgentProviderActionSupport {
    static let views: Set<String> = ["all", "recent_open_or_overdue", "open", "overdue", "open_or_overdue", "draft", "paid", "scheduled_to_email", "thank_you_emails", "reminder_emails"]
    static func page(_ value: JSONValue?) -> Int { max(1, min(10_000, value?.number.map(Int.init) ?? 1)) }
    static func view(_ value: JSONValue?) throws -> String? {
        guard let raw = value?.string?.trimmingCharacters(in: .whitespacesAndNewlines), !raw.isEmpty else { return nil };
        guard views.contains(raw) || (raw.hasPrefix("last_") && raw.hasSuffix("_months") && Int(raw.dropFirst(5).dropLast(7)).map { (1...120).contains($0) } == true) else {
            throw MarketplaceProviderActionAdapterFailure(code: "freeagent_invoice_view_invalid", message: "FreeAgent invoice view is not allowlisted.")
        }; return raw
    }
    static func invoiceId(_ payload: JSONRecord) throws -> String {
        guard let raw = payload["invoiceId"]?.string?.trimmingCharacters(in: .whitespacesAndNewlines), let value = Int(raw), value > 0, String(value) == raw else {
            throw MarketplaceProviderActionAdapterFailure(code: "freeagent_invoice_id_invalid", message: "A positive numeric FreeAgent invoice ID is required.")
        }; return raw
    }
    static func opaqueId(_ value: JSONValue?) -> JSONValue { guard let text = value?.string, let last = URL(string: text)?.pathComponents.last, Int(last) != nil else { return .null }; return .string(last) }
    static func scalar(_ value: JSONValue?) -> JSONValue { guard let value else { return .null }; switch value { case .string(let text): return .string(String(text.prefix(512))); case .number, .bool, .null: return value; default: return .null } }
    static func company(_ value: JSONValue) -> JSONRecord { let o = value.freeAgentObject ?? [:]; return ["CompanyId": scalar(o["id"]), "Name": scalar(o["name"]), "Type": scalar(o["type"]), "Currency": scalar(o["currency"])] }
    static func invoice(_ value: JSONValue) -> JSONRecord {
        let o = value.freeAgentObject ?? [:];
        return [
            "InvoiceId": opaqueId(o["url"]), "Status": scalar(o["status"]), "Reference": scalar(o["reference"]), "DatedOn": scalar(o["dated_on"]), "DueOn": scalar(o["due_on"]), "Currency": scalar(o["currency"]), "NetValue": scalar(o["net_value"]), "TotalValue": scalar(o["total_value"]),
            "PaidValue": scalar(o["paid_value"]), "DueValue": scalar(o["due_value"]), "ContactId": opaqueId(o["contact"]), "ProjectId": opaqueId(o["project"]),
        ]
    }
    static func fakeCompany() -> JSONRecord { ["CompanyId": .number(42), "Name": .string("Relay Books Ltd"), "Type": .string("UkLimitedCompany"), "Currency": .string("GBP")] }
    static func fakeInvoice() -> JSONRecord {
        [
            "InvoiceId": .string("101"), "Status": .string("Open"), "Reference": .string("INV-101"), "DatedOn": .string("2026-07-01"), "DueOn": .string("2026-07-31"), "Currency": .string("GBP"), "NetValue": .string("800.00"), "TotalValue": .string("960.00"), "PaidValue": .string("0.00"),
            "DueValue": .string("960.00"), "ContactId": .string("22"), "ProjectId": .null,
        ]
    }
    static func json(_ value: Any) -> JSONValue {
        if let v = value as? String { return .string(v) }; if let v = value as? Bool { return .bool(v) }; if let v = value as? Int { return .number(Double(v)) }; if let v = value as? Double { return .number(v) }; if let v = value as? [String: Any] { return .object(v.mapValues(json)) };
        if let v = value as? [Any] { return .array(v.map(json)) }; return .null
    }
}

private extension JSONValue { var freeAgentObject: JSONRecord? { if case .object(let value) = self { return value }; return nil }; var freeAgentArray: [JSONValue]? { if case .array(let value) = self { return value }; return nil } }
