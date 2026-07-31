import Foundation

public struct WaveProviderHTTPRequest: Sendable { public let url: URL; public let headers: [String: String]; public let body: Data; public init(url: URL, headers: [String: String], body: Data) { self.url = url; self.headers = headers; self.body = body } }
public struct WaveProviderHTTPResponse: Sendable { public let statusCode: Int; public let headers: [String: String]; public let body: Data; public init(statusCode: Int, headers: [String: String] = [:], body: Data = Data()) { self.statusCode = statusCode; self.headers = headers; self.body = body } }
public protocol WaveProviderHTTPClient: Sendable { func send(_ request: WaveProviderHTTPRequest) throws -> WaveProviderHTTPResponse }
private final class WaveNoRedirectDelegate: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}
public struct URLSessionWaveProviderHTTPClient: WaveProviderHTTPClient {
    public init() {};
    public func send(_ request: WaveProviderHTTPRequest) throws -> WaveProviderHTTPResponse {
        var value = URLRequest(url: request.url); value.httpMethod = "POST"; value.httpBody = request.body; value.timeoutInterval = 20; request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) };
        let session = URLSession(configuration: .ephemeral, delegate: WaveNoRedirectDelegate(), delegateQueue: nil), semaphore = DispatchSemaphore(value: 0); var data: Data?, response: HTTPURLResponse?, failure: Error?;
        let task = session.dataTask(with: value) {
            data = $0; response = $1 as? HTTPURLResponse; failure = $2; semaphore.signal()
        }; task.resume(); if semaphore.wait(timeout: .now() + 20) == .timedOut { task.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "wave_http_timeout", message: "Wave GraphQL request timed out.") }; session.invalidateAndCancel(); if let failure { throw failure };
        return WaveProviderHTTPResponse(statusCode: response?.statusCode ?? 0, headers: response?.allHeaderFields.reduce(into: [:]) { $0[String(describing: $1.key)] = String(describing: $1.value) } ?? [:], body: data ?? Data())
    }
}
public struct WaveProviderActionClientResult: Sendable { public let result: JSONRecord; public init(result: JSONRecord) { self.result = result } }
public protocol WaveProviderActionClient: Sendable { func executeWaveAction(request: MarketplaceProviderActionAdapterRequest) throws -> WaveProviderActionClientResult }
public struct FakeWaveProviderActionClient: WaveProviderActionClient {
    public init() {};
    public func executeWaveAction(request: MarketplaceProviderActionAdapterRequest) throws -> WaveProviderActionClientResult {
        switch request.definition.actionKey {
        case "wave_business_get": return out(["semanticReadContract": .string("wave-business-v1"), "business": .object(WaveProviderActionSupport.fakeBusiness())]);
        case "wave_invoice_list": return out(["semanticReadContract": .string("wave-invoice-list-v1"), "invoices": .array([.object(WaveProviderActionSupport.fakeInvoice())]), "pageInfo": .object(["currentPage": .number(1), "totalPages": .number(1), "totalCount": .number(1)])]);
        case "wave_invoice_get": return out(["semanticReadContract": .string("wave-invoice-get-v1"), "invoice": .object(WaveProviderActionSupport.fakeInvoice())]);
        default: throw MarketplaceProviderActionAdapterFailure(code: "wave_fake_action_not_supported", message: "Unsupported Wave action.")
        }
    };
    private func out(_ fields: JSONRecord) -> WaveProviderActionClientResult {
        WaveProviderActionClientResult(
            result: ["provider": .string("wave"), "adapterBoundary": .string("wave-provider-action-adapter"), "clientMode": .string("fake-wave-accounting-graphql"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-state-excluded")].merging(fields) { _, new in new })
    }
}

public final class LiveWaveProviderActionClient: WaveProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService; private let secrets: SecretService; private let http: any WaveProviderHTTPClient
    public init(data: LocalDataService, secrets: SecretService, httpClient: any WaveProviderHTTPClient = URLSessionWaveProviderHTTPClient()) { self.data = data; self.secrets = secrets; self.http = httpClient }
    public func executeWaveAction(request: MarketplaceProviderActionAdapterRequest) throws -> WaveProviderActionClientResult {
        let auth = try authorization(request);
        switch request.definition.actionKey {
        case "wave_business_get":
            let root = try graph(auth, WaveProviderActionSupport.businessQuery, ["businessId": .string(auth.businessId)]), business = root.waveObject?["data"]?.waveObject?["business"] ?? .null;
            return out(["semanticReadContract": .string("wave-business-v1"), "business": .object(WaveProviderActionSupport.business(business))]);
        case "wave_invoice_list":
            let page = WaveProviderActionSupport.page(request.payload["page"]), limit = WaveProviderActionSupport.limit(request.payload["limit"]),
                root = try graph(auth, WaveProviderActionSupport.invoiceListQuery, ["businessId": .string(auth.businessId), "page": .number(Double(page)), "pageSize": .number(Double(limit))]), invoices = root.waveObject?["data"]?.waveObject?["business"]?.waveObject?["invoices"]?.waveObject ?? [:],
                nodes: [JSONValue] = (invoices["edges"]?.waveArray ?? []).compactMap { $0.waveObject?["node"] }.prefix(25).map { .object(WaveProviderActionSupport.invoice($0)) }
            ; return out(["semanticReadContract": .string("wave-invoice-list-v1"), "invoices": .array(nodes), "pageInfo": .object(WaveProviderActionSupport.pageInfo(invoices["pageInfo"]))]);
        case "wave_invoice_get":
            let id = try WaveProviderActionSupport.invoiceId(request.payload), root = try graph(auth, WaveProviderActionSupport.invoiceGetQuery, ["businessId": .string(auth.businessId), "invoiceId": .string(id)]),
                invoice = root.waveObject?["data"]?.waveObject?["business"]?.waveObject?["invoice"] ?? .null
            ; return out(["semanticReadContract": .string("wave-invoice-get-v1"), "invoice": .object(WaveProviderActionSupport.invoice(invoice))]);
        default: throw MarketplaceProviderActionAdapterFailure(code: "wave_live_action_not_supported", message: "Unsupported live Wave action.")
        }
    }
    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> (token: String, businessId: String) {
        guard let id = request.auditIdentity.connectionId, let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), connection.appSlug == "wave",
            let ref = connection.credentialRequirements.first(where: { $0.fieldKey == "wave_oauth_access_token" })?.secretReferenceId, let businessId = connection.health.diagnostics["businessId"]?.string, WaveProviderActionSupport.opaqueId(businessId)
        else { throw MarketplaceProviderActionAdapterFailure(code: "wave_connection_not_ready", message: "Wave business connection is not ready.") }; return (try secrets.getSecretValue(ref), businessId)
    }
    private func graph(_ auth: (token: String, businessId: String), _ query: String, _ variables: JSONRecord) throws -> JSONValue {
        let body = try JSONSerialization.data(withJSONObject: ["query": query, "variables": WaveProviderActionSupport.foundation(.object(variables))]),
            response = try http.send(WaveProviderHTTPRequest(url: URL(string: "https://gql.waveapps.com/graphql/public")!, headers: ["Authorization": "Bearer " + auth.token, "Content-Type": "application/json", "Accept": "application/json"], body: body)),
            value = (try? JSONSerialization.jsonObject(with: response.body)).map(WaveProviderActionSupport.json) ?? .null, errors = value.waveObject?["errors"]?.waveArray ?? []
        ;
        guard (200..<300).contains(response.statusCode), errors.isEmpty else {
            throw MarketplaceProviderActionAdapterFailure(
                code: response.statusCode == 401 ? "wave_token_invalid" : response.statusCode == 403 ? "wave_permission_or_subscription_denied" : response.statusCode == 429 ? "wave_rate_limited" : "wave_graphql_error", message: "Wave Accounting GraphQL request failed.",
                providerStatusCode: response.statusCode, detail: ["providerError": WaveProviderActionSupport.error(errors.first), "retryAfter": response.headers.first { $0.key.lowercased() == "retry-after" }.map { .string(String($0.value.prefix(32))) } ?? .null])
        }; return value
    }
    private func out(_ fields: JSONRecord) -> WaveProviderActionClientResult {
        WaveProviderActionClientResult(
            result: ["provider": .string("wave"), "adapterBoundary": .string("wave-provider-action-adapter"), "clientMode": .string("live-wave-accounting-graphql"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-state-excluded")].merging(fields) { _, new in new })
    }
}
public struct WaveProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = ["wave_business_get", "wave_invoice_list", "wave_invoice_get"]; private let client: any WaveProviderActionClient; public init(client: any WaveProviderActionClient = FakeWaveProviderActionClient()) { self.client = client };
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "wave", Self.allowed.contains(request.definition.actionKey) else { throw MarketplaceProviderActionAdapterFailure(code: "wave_action_not_allowlisted", message: "Wave action is outside read-only V1.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executeWaveAction(request: request).result, error: nil, redactionStatus: "private-state-excluded")
    }
}

enum WaveProviderActionSupport {
    static let businessQuery = "query RelayWaveBusiness($businessId: ID!) { business(id: $businessId) { id name isPersonal } }"
    static let invoiceFields = "id status invoiceNumber invoiceDate dueDate createdAt modifiedAt amountDue { value currency { code } } amountPaid { value currency { code } } total { value currency { code } } customer { id }"
    static let invoiceListQuery = "query RelayWaveInvoices($businessId: ID!, $page: Int!, $pageSize: Int!) { business(id: $businessId) { id invoices(page: $page, pageSize: $pageSize, sort: [MODIFIED_AT_DESC]) { pageInfo { currentPage totalPages totalCount } edges { node { \(invoiceFields) } } } } }"
    static let invoiceGetQuery = "query RelayWaveInvoice($businessId: ID!, $invoiceId: ID!) { business(id: $businessId) { id invoice(id: $invoiceId) { \(invoiceFields) } } }"
    static func opaqueId(_ value: String) -> Bool { !value.isEmpty && value.count <= 256 && value.allSatisfy { $0.isLetter || $0.isNumber || "+/=_-".contains($0) } };
    static func invoiceId(_ payload: JSONRecord) throws -> String { guard let id = payload["invoiceId"]?.string, opaqueId(id) else { throw MarketplaceProviderActionAdapterFailure(code: "wave_invoice_id_invalid", message: "A valid opaque Wave invoice ID is required.") }; return id };
    static func page(_ value: JSONValue?) -> Int { max(1, min(10_000, value?.number.map(Int.init) ?? 1)) }; static func limit(_ value: JSONValue?) -> Int { max(1, min(25, value?.number.map(Int.init) ?? 10)) }
    static func business(_ value: JSONValue) -> JSONRecord { let o = value.waveObject ?? [:]; return ["BusinessId": scalar(o["id"] ?? .null), "Name": scalar(o["name"] ?? .null), "IsPersonal": scalar(o["isPersonal"] ?? .null)] };
    static func money(_ value: JSONValue?) -> JSONValue { let o = value?.waveObject ?? [:], currency = o["currency"]?.waveObject ?? [:]; return .object(["value": scalar(o["value"] ?? .null), "currencyCode": scalar(currency["code"] ?? .null)]) };
    static func invoice(_ value: JSONValue) -> JSONRecord {
        let o = value.waveObject ?? [:];
        return [
            "InvoiceId": scalar(o["id"] ?? .null), "Status": scalar(o["status"] ?? .null), "InvoiceNumber": scalar(o["invoiceNumber"] ?? .null), "InvoiceDate": scalar(o["invoiceDate"] ?? .null), "DueDate": scalar(o["dueDate"] ?? .null), "CreatedAt": scalar(o["createdAt"] ?? .null),
            "ModifiedAt": scalar(o["modifiedAt"] ?? .null), "AmountDue": money(o["amountDue"]), "AmountPaid": money(o["amountPaid"]), "Total": money(o["total"]), "CustomerId": scalar(o["customer"]?.waveObject?["id"] ?? .null),
        ]
    }; static func pageInfo(_ value: JSONValue?) -> JSONRecord { let o = value?.waveObject ?? [:]; return ["currentPage": scalar(o["currentPage"] ?? .null), "totalPages": scalar(o["totalPages"] ?? .null), "totalCount": scalar(o["totalCount"] ?? .null)] }
    static func scalar(_ value: JSONValue) -> JSONValue {
        switch value {
        case .string(let text): return .string(String(text.prefix(512)));
        case .number, .bool, .null: return value;
        default: return .null
        }
    }; static func error(_ value: JSONValue?) -> JSONValue { let o = value?.waveObject ?? [:]; return .object(["message": scalar(o["message"] ?? .null), "path": o["path"]?.waveArray.map { .array($0.map(scalar)) } ?? .null, "code": scalar(o["extensions"]?.waveObject?["code"] ?? .null)]) }
    static func fakeBusiness() -> JSONRecord { ["BusinessId": .string("QnVzaW5lc3M6cmVsYXktZGVtby"), "Name": .string("Relay Studio"), "IsPersonal": .bool(false)] };
    static func fakeInvoice() -> JSONRecord {
        [
            "InvoiceId": .string("SW52b2ljZTpyZWxheS0x"), "Status": .string("SENT"), "InvoiceNumber": .string("INV-001"), "InvoiceDate": .string("2026-07-01"), "DueDate": .string("2026-07-31"), "CreatedAt": .string("2026-07-01T09:00:00Z"), "ModifiedAt": .string("2026-07-02T10:00:00Z"),
            "AmountDue": .object(["value": .string("800.00"), "currencyCode": .string("GBP")]), "AmountPaid": .object(["value": .string("0.00"), "currencyCode": .string("GBP")]), "Total": .object(["value": .string("800.00"), "currencyCode": .string("GBP")]),
            "CustomerId": .string("Q3VzdG9tZXI6NTg="),
        ]
    }
    static func json(_ value: Any) -> JSONValue {
        if let v = value as? String { return .string(v) }; if let v = value as? Bool { return .bool(v) }; if let v = value as? Int { return .number(Double(v)) }; if let v = value as? Double { return .number(v) }; if let v = value as? [String: Any] { return .object(v.mapValues(json)) };
        if let v = value as? [Any] { return .array(v.map(json)) }; return .null
    };
    static func foundation(_ value: JSONValue) -> Any {
        switch value {
        case .string(let v): return v;
        case .number(let v): return v;
        case .bool(let v): return v;
        case .array(let v): return v.map(foundation);
        case .object(let v): return v.mapValues(foundation);
        case .null: return NSNull()
        }
    }
}
private extension JSONValue { var waveObject: JSONRecord? { if case .object(let value) = self { return value }; return nil }; var waveArray: [JSONValue]? { if case .array(let value) = self { return value }; return nil } }
