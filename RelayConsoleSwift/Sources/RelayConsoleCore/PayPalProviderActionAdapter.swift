import Foundation

public struct PayPalProviderActionClientResult: Codable, Equatable, Sendable { public var result: JSONRecord; public init(result: JSONRecord) { self.result = result } }
public protocol PayPalProviderActionClient: Sendable { func executePayPalAction(request: MarketplaceProviderActionAdapterRequest) throws -> PayPalProviderActionClientResult }
public struct PayPalProviderHTTPRequest: Sendable, Equatable {
    public var method: String; public var url: URL; public var headers: [String: String]; public var body: Data?; public init(method: String, url: URL, headers: [String: String], body: Data? = nil) { self.method = method; self.url = url; self.headers = headers; self.body = body }
}
public struct PayPalProviderHTTPResponse: Sendable, Equatable {
    public var statusCode: Int; public var headers: [String: String]; public var body: Data; public init(statusCode: Int, headers: [String: String] = [:], body: Data = Data()) { self.statusCode = statusCode; self.headers = headers; self.body = body }
}
public protocol PayPalProviderHTTPClient: Sendable { func send(_ request: PayPalProviderHTTPRequest) throws -> PayPalProviderHTTPResponse }
private final class PayPalNoRedirectDelegate: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}
public struct URLSessionPayPalProviderHTTPClient: PayPalProviderHTTPClient {
    public init() {}
    public func send(_ request: PayPalProviderHTTPRequest) throws -> PayPalProviderHTTPResponse {
        var value = URLRequest(url: request.url); value.httpMethod = request.method; value.timeoutInterval = 20; value.httpBody = request.body; request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) };
        let session = URLSession(configuration: .ephemeral, delegate: PayPalNoRedirectDelegate(), delegateQueue: nil), semaphore = DispatchSemaphore(value: 0); var data: Data?; var response: HTTPURLResponse?; var failure: Error?;
        let task = session.dataTask(with: value) {
            data = $0; response = $1 as? HTTPURLResponse; failure = $2; semaphore.signal()
        }; task.resume(); if semaphore.wait(timeout: .now() + 20) == .timedOut { task.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "paypal_http_timeout", message: "PayPal API request timed out.") }; session.invalidateAndCancel(); if let failure { throw failure };
        return PayPalProviderHTTPResponse(statusCode: response?.statusCode ?? 0, headers: response?.allHeaderFields.reduce(into: [:]) { $0[String(describing: $1.key)] = String(describing: $1.value) } ?? [:], body: data ?? Data())
    }
}

public struct FakePayPalProviderActionClient: PayPalProviderActionClient {
    public init() {}
    public func executePayPalAction(request: MarketplaceProviderActionAdapterRequest) throws -> PayPalProviderActionClientResult {
        switch request.definition.actionKey {
        case "paypal_transaction_list": return out(["semanticReadContract": .string("paypal-transaction-list-v1"), "transactions": .array([.object(PayPalProviderActionSupport.fakeTransaction())]), "page": .number(1), "totalItems": .number(1), "totalPages": .number(1)]);
        case "paypal_transaction_get": return out(["semanticReadContract": .string("paypal-transaction-get-v1"), "transactions": .array([.object(PayPalProviderActionSupport.fakeTransaction())])]);
        case "paypal_order_get": return out(["semanticReadContract": .string("paypal-order-get-v1"), "order": .object(PayPalProviderActionSupport.fakeOrder())]);
        case "paypal_capture_get": return out(["semanticReadContract": .string("paypal-capture-get-v1"), "capture": .object(PayPalProviderActionSupport.fakeCapture())]);
        default: throw MarketplaceProviderActionAdapterFailure(code: "paypal_fake_action_not_supported", message: "Unsupported PayPal action.")
        }
    }
    private func out(_ fields: JSONRecord) -> PayPalProviderActionClientResult {
        PayPalProviderActionClientResult(
            result: ["provider": .string("paypal"), "adapterBoundary": .string("paypal-provider-action-adapter"), "clientMode": .string("fake-paypal-rest-v1"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-state-excluded")].merging(fields) { _, new in new })
    }
}

public final class LivePayPalProviderActionClient: PayPalProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService; private let secrets: SecretService; private let http: any PayPalProviderHTTPClient
    public init(data: LocalDataService, secrets: SecretService, httpClient: any PayPalProviderHTTPClient = URLSessionPayPalProviderHTTPClient()) { self.data = data; self.secrets = secrets; self.http = httpClient }
    public func executePayPalAction(request: MarketplaceProviderActionAdapterRequest) throws -> PayPalProviderActionClientResult {
        let auth = try authorization(request), token = try accessToken(auth), payload = request.payload
        switch request.definition.actionKey {
        case "paypal_transaction_list":
            let range = try PayPalProviderActionSupport.range(payload), limit = PayPalProviderActionSupport.bound(payload["maxResults"], 25), page = PayPalProviderActionSupport.page(payload["page"]);
            var query = [
                URLQueryItem(name: "start_date", value: range.start), URLQueryItem(name: "end_date", value: range.end), URLQueryItem(name: "fields", value: "transaction_info"), URLQueryItem(name: "balance_affecting_records_only", value: "Y"), URLQueryItem(name: "page", value: String(page)),
                URLQueryItem(name: "page_size", value: String(limit)),
            ];
            if let status = payload["status"]?.string {
                guard ["D", "P", "S", "V"].contains(status) else { throw MarketplaceProviderActionAdapterFailure(code: "paypal_status_invalid", message: "PayPal transaction status is invalid.") }; query.append(URLQueryItem(name: "transaction_status", value: status))
            };
            if let currency = payload["currency"]?.string {
                guard currency.count == 3 && currency.allSatisfy({ $0.isUppercase }) else { throw MarketplaceProviderActionAdapterFailure(code: "paypal_currency_invalid", message: "PayPal currency is invalid.") }; query.append(URLQueryItem(name: "transaction_currency", value: currency))
            }; return out(PayPalProviderActionSupport.transactions(try get(auth, token, "/v1/reporting/transactions", query), limit: limit).merging(["semanticReadContract": .string("paypal-transaction-list-v1")]) { _, new in new })
        case "paypal_transaction_get":
            let range = try PayPalProviderActionSupport.range(payload), id = try PayPalProviderActionSupport.id(payload, "transactionId", minimum: 17, maximum: 24),
                query = [
                    URLQueryItem(name: "start_date", value: range.start), URLQueryItem(name: "end_date", value: range.end), URLQueryItem(name: "transaction_id", value: id), URLQueryItem(name: "fields", value: "transaction_info"), URLQueryItem(name: "balance_affecting_records_only", value: "N"),
                    URLQueryItem(name: "page", value: "1"), URLQueryItem(name: "page_size", value: "25"),
                ]
            ; return out(PayPalProviderActionSupport.transactions(try get(auth, token, "/v1/reporting/transactions", query), limit: 25).merging(["semanticReadContract": .string("paypal-transaction-get-v1"), "transactionId": .string(id)]) { _, new in new })
        case "paypal_order_get":
            let id = try PayPalProviderActionSupport.id(payload, "orderId", minimum: 1, maximum: 36), value = try get(auth, token, "/v2/checkout/orders/" + id, []); return out(["semanticReadContract": .string("paypal-order-get-v1"), "order": .object(PayPalProviderActionSupport.order(value))])
        case "paypal_capture_get":
            let id = try PayPalProviderActionSupport.id(payload, "captureId", minimum: 1, maximum: 64), value = try get(auth, token, "/v2/payments/captures/" + id, []);
            return out(["semanticReadContract": .string("paypal-capture-get-v1"), "capture": .object(PayPalProviderActionSupport.capture(value))])
        default: throw MarketplaceProviderActionAdapterFailure(code: "paypal_live_action_not_supported", message: "Unsupported live PayPal action.")
        }
    }
    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> (origin: String, clientId: String, secret: String, environment: String) {
        guard let id = request.auditIdentity.connectionId, let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), connection.appSlug == "paypal", let clientId = connection.health.diagnostics["clientId"]?.string?.paypalNilIfEmpty,
            let environment = connection.health.diagnostics["environment"]?.string, let origin = PayPalProviderActionSupport.origin(environment), let secretRef = connection.credentialRequirements.first(where: { $0.fieldKey == "paypal_client_secret" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "paypal_connection_not_ready", message: "PayPal connection is not ready.") }; return (origin, clientId, try secrets.getSecretValue(secretRef), environment)
    }
    private func accessToken(_ auth: (origin: String, clientId: String, secret: String, environment: String)) throws -> String {
        let body = Data("grant_type=client_credentials".utf8), basic = Data((auth.clientId + ":" + auth.secret).utf8).base64EncodedString(),
            response = try http.send(PayPalProviderHTTPRequest(method: "POST", url: URL(string: auth.origin + "/v1/oauth2/token")!, headers: ["Authorization": "Basic " + basic, "Accept": "application/json", "Content-Type": "application/x-www-form-urlencoded"], body: body)),
            value = try PayPalProviderActionSupport.decode(response)
        ;
        guard (200..<300).contains(response.statusCode), let token = value.paypalObject?["access_token"]?.string?.paypalNilIfEmpty else {
            throw MarketplaceProviderActionAdapterFailure(code: response.statusCode == 401 ? "paypal_credentials_invalid" : "paypal_token_failed", message: "PayPal access-token exchange failed.", providerStatusCode: response.statusCode)
        }; return token
    }
    private func get(_ auth: (origin: String, clientId: String, secret: String, environment: String), _ token: String, _ path: String, _ query: [URLQueryItem]) throws -> JSONValue {
        guard var components = URLComponents(string: auth.origin + path) else { throw MarketplaceProviderActionAdapterFailure(code: "paypal_url_invalid", message: "PayPal request URL is invalid.") }; components.queryItems = query.isEmpty ? nil : query;
        let response = try http.send(PayPalProviderHTTPRequest(method: "GET", url: components.url!, headers: ["Authorization": "Bearer " + token, "Accept": "application/json", "PayPal-Enforce-ISO8601-Format": "true"])), value = try PayPalProviderActionSupport.decode(response);
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: response.statusCode == 401 ? "paypal_token_invalid" : response.statusCode == 403 ? "paypal_permission_denied" : response.statusCode == 429 ? "paypal_rate_limited" : "paypal_http_error", message: "PayPal API request failed.", providerStatusCode: response.statusCode,
                detail: ["providerError": PayPalProviderActionSupport.error(value)])
        }; return value
    }
    private func out(_ fields: JSONRecord) -> PayPalProviderActionClientResult {
        PayPalProviderActionClientResult(
            result: ["provider": .string("paypal"), "adapterBoundary": .string("paypal-provider-action-adapter"), "clientMode": .string("live-paypal-rest-v1"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-state-excluded")].merging(fields) { _, new in new })
    }
}

public struct PayPalProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = ["paypal_transaction_list", "paypal_transaction_get", "paypal_order_get", "paypal_capture_get"]; private let client: any PayPalProviderActionClient;
    public init(client: any PayPalProviderActionClient = FakePayPalProviderActionClient()) { self.client = client };
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "paypal", Self.allowed.contains(request.definition.actionKey) else { throw MarketplaceProviderActionAdapterFailure(code: "paypal_action_not_allowlisted", message: "PayPal action is outside read-only V1.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executePayPalAction(request: request).result, error: nil, redactionStatus: "private-state-excluded")
    }
}

enum PayPalProviderActionSupport {
    static func origin(_ environment: String) -> String? { environment == "sandbox" ? "https://api-m.sandbox.paypal.com" : environment == "live" ? "https://api-m.paypal.com" : nil }
    static func id(_ payload: JSONRecord, _ key: String, minimum: Int, maximum: Int) throws -> String {
        guard let value = payload[key]?.string, (minimum...maximum).contains(value.count), value.allSatisfy({ $0.isLetter || $0.isNumber || $0 == "_" || $0 == "-" }) else { throw MarketplaceProviderActionAdapterFailure(code: "paypal_id_invalid", message: "PayPal \(key) is invalid.") }; return value
    }
    static func range(_ payload: JSONRecord) throws -> (start: String, end: String) {
        guard let start = payload["startDate"]?.string, let end = payload["endDate"]?.string, let s = ISO8601DateFormatter().date(from: start), let e = ISO8601DateFormatter().date(from: end), e > s, e.timeIntervalSince(s) <= 31 * 86_400 else {
            throw MarketplaceProviderActionAdapterFailure(code: "paypal_date_range_invalid", message: "PayPal date range must be positive and no longer than thirty-one days.")
        }; return (ISO8601DateFormatter().string(from: s), ISO8601DateFormatter().string(from: e))
    }
    static func bound(_ value: JSONValue?, _ fallback: Int) -> Int { max(1, min(25, value?.number.map(Int.init) ?? fallback)) }; static func page(_ value: JSONValue?) -> Int { max(1, min(10_000, value?.number.map(Int.init) ?? 1)) }
    static func transactions(_ value: JSONValue, limit: Int) -> JSONRecord {
        let root = value.paypalObject ?? [:];
        return [
            "transactions": .array((root["transaction_details"]?.paypalArray ?? []).prefix(limit).map { .object(transaction($0)) }), "page": scalar(root["page"] ?? .null), "totalItems": scalar(root["total_items"] ?? .null), "totalPages": scalar(root["total_pages"] ?? .null),
            "startDate": scalar(root["start_date"] ?? .null), "endDate": scalar(root["end_date"] ?? .null),
        ]
    }
    static func transaction(_ value: JSONValue) -> JSONRecord {
        let o = value.paypalObject?["transaction_info"]?.paypalObject ?? [:];
        return [
            "transactionId": scalar(o["transaction_id"] ?? .null), "referenceId": scalar(o["paypal_reference_id"] ?? .null), "referenceType": scalar(o["paypal_reference_id_type"] ?? .null), "eventCode": scalar(o["transaction_event_code"] ?? .null), "status": scalar(o["transaction_status"] ?? .null),
            "initiatedAt": scalar(o["transaction_initiation_date"] ?? .null), "updatedAt": scalar(o["transaction_updated_date"] ?? .null), "amount": money(o["transaction_amount"]), "fee": money(o["fee_amount"]), "net": money(o["net_amount"]),
            "protectionEligibility": scalar(o["protection_eligibility"] ?? .null),
        ]
    }
    static func order(_ value: JSONValue) -> JSONRecord {
        let o = value.paypalObject ?? [:];
        return [
            "id": scalar(o["id"] ?? .null), "status": scalar(o["status"] ?? .null), "intent": scalar(o["intent"] ?? .null), "createTime": scalar(o["create_time"] ?? .null), "updateTime": scalar(o["update_time"] ?? .null),
            "purchaseUnits": .array(
                (o["purchase_units"]?.paypalArray ?? []).prefix(10).map {
                    let u = $0.paypalObject ?? [:]; return .object(["referenceId": scalar(u["reference_id"] ?? .null), "amount": money(u["amount"])])
                }),
        ]
    }
    static func capture(_ value: JSONValue) -> JSONRecord {
        let o = value.paypalObject ?? [:];
        return [
            "id": scalar(o["id"] ?? .null), "status": scalar(o["status"] ?? .null), "amount": money(o["amount"]), "finalCapture": scalar(o["final_capture"] ?? .null), "createTime": scalar(o["create_time"] ?? .null), "updateTime": scalar(o["update_time"] ?? .null),
            "sellerProtectionStatus": scalar(o["seller_protection"]?.paypalObject?["status"] ?? .null),
        ]
    }
    static func money(_ value: JSONValue?) -> JSONValue { let o = value?.paypalObject ?? [:]; return .object(["currencyCode": scalar(o["currency_code"] ?? .null), "value": scalar(o["value"] ?? .null)]) }
    static func scalar(_ value: JSONValue) -> JSONValue { switch value { case .string(let s): return .string(String(s.prefix(256))); case .number, .bool, .null: return value; default: return .null } }
    static func error(_ value: JSONValue) -> JSONValue { let o = value.paypalObject ?? [:], first = o["details"]?.paypalArray?.first?.paypalObject ?? [:]; return .object(["name": scalar(o["name"] ?? .null), "issue": scalar(first["issue"] ?? .null)]) }
    static func decode(_ response: PayPalProviderHTTPResponse) throws -> JSONValue {
        guard response.body.count <= 2_000_000, let object = try? JSONSerialization.jsonObject(with: response.body) else { throw MarketplaceProviderActionAdapterFailure(code: "paypal_response_invalid", message: "PayPal returned an invalid response.") }; return json(object)
    }
    static func json(_ value: Any) -> JSONValue {
        if let v = value as? String { return .string(v) }; if let v = value as? Bool { return .bool(v) }; if let v = value as? Int { return .number(Double(v)) }; if let v = value as? Double { return .number(v) }; if let v = value as? [String: Any] { return .object(v.mapValues(json)) };
        if let v = value as? [Any] { return .array(v.map(json)) }; return .null
    }
    static func fakeTransaction() -> JSONRecord {
        [
            "transactionId": .string("12345678901234567"), "referenceId": .string("98765432109876543"), "referenceType": .string("TXN"), "eventCode": .string("T0006"), "status": .string("S"), "initiatedAt": .string("2026-07-01T12:00:00Z"), "updatedAt": .string("2026-07-01T12:01:00Z"),
            "amount": money(.object(["currency_code": .string("GBP"), "value": .string("10.00")])), "fee": money(.object(["currency_code": .string("GBP"), "value": .string("-0.59")])),
        ]
    }
    static func fakeOrder() -> JSONRecord {
        ["id": .string("5O190127TN364715T"), "status": .string("COMPLETED"), "intent": .string("CAPTURE"), "purchaseUnits": .array([.object(["referenceId": .string("default"), "amount": money(.object(["currency_code": .string("USD"), "value": .string("12.00")]))])])]
    }
    static func fakeCapture() -> JSONRecord { ["id": .string("3C679366HH908993F"), "status": .string("COMPLETED"), "amount": money(.object(["currency_code": .string("USD"), "value": .string("12.00")])), "finalCapture": .bool(true)] }
}
private extension JSONValue { var paypalObject: JSONRecord? { if case .object(let value) = self { return value }; return nil }; var paypalArray: [JSONValue]? { if case .array(let value) = self { return value }; return nil } }
private extension String { var paypalNilIfEmpty: String? { let value = trimmingCharacters(in: .whitespacesAndNewlines); return value.isEmpty ? nil : value } }
