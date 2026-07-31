import Foundation

public struct StripeProviderActionClientResult: Codable, Equatable, Sendable { public var result: JSONRecord; public init(result: JSONRecord) { self.result = result } }
public protocol StripeProviderActionClient: Sendable { func executeStripeAction(request: MarketplaceProviderActionAdapterRequest) throws -> StripeProviderActionClientResult }
public struct StripeProviderHTTPRequest: Sendable, Equatable { public var url: URL; public var headers: [String: String]; public init(url: URL, headers: [String: String]) { self.url = url; self.headers = headers } }
public struct StripeProviderHTTPResponse: Sendable, Equatable {
    public var statusCode: Int; public var headers: [String: String]; public var body: Data; public init(statusCode: Int, headers: [String: String] = [:], body: Data = Data()) { self.statusCode = statusCode; self.headers = headers; self.body = body }
}
public protocol StripeProviderHTTPClient: Sendable { func send(_ request: StripeProviderHTTPRequest) throws -> StripeProviderHTTPResponse }
private final class StripeNoRedirectDelegate: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}
public struct URLSessionStripeProviderHTTPClient: StripeProviderHTTPClient {
    public init() {};
    public func send(_ request: StripeProviderHTTPRequest) throws -> StripeProviderHTTPResponse {
        var value = URLRequest(url: request.url); value.httpMethod = "GET"; value.timeoutInterval = 20; request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) };
        let session = URLSession(configuration: .ephemeral, delegate: StripeNoRedirectDelegate(), delegateQueue: nil), semaphore = DispatchSemaphore(value: 0); var data: Data?; var response: HTTPURLResponse?; var failure: Error?;
        let task = session.dataTask(with: value) {
            data = $0; response = $1 as? HTTPURLResponse; failure = $2; semaphore.signal()
        }; task.resume(); if semaphore.wait(timeout: .now() + 20) == .timedOut { task.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "stripe_http_timeout", message: "Stripe API request timed out.") }; session.invalidateAndCancel(); if let failure { throw failure };
        return StripeProviderHTTPResponse(statusCode: response?.statusCode ?? 0, headers: response?.allHeaderFields.reduce(into: [:]) { $0[String(describing: $1.key)] = String(describing: $1.value) } ?? [:], body: data ?? Data())
    }
}

public struct FakeStripeProviderActionClient: StripeProviderActionClient {
    public init() {};
    public func executeStripeAction(request: MarketplaceProviderActionAdapterRequest) throws -> StripeProviderActionClientResult {
        switch request.definition.actionKey {
        case "stripe_balance_get": return out(["semanticReadContract": .string("stripe-balance-v1"), "balance": .object(StripeProviderActionSupport.fakeBalance())]);
        case "stripe_payment_intent_list": return out(["semanticReadContract": .string("stripe-payment-intent-list-v1"), "paymentIntents": .array([.object(StripeProviderActionSupport.fakePaymentIntent())]), "hasMore": .bool(false)]);
        case "stripe_payment_intent_get": return out(["semanticReadContract": .string("stripe-payment-intent-get-v1"), "paymentIntent": .object(StripeProviderActionSupport.fakePaymentIntent())]);
        default: throw MarketplaceProviderActionAdapterFailure(code: "stripe_fake_action_not_supported", message: "Unsupported Stripe action.")
        }
    };
    private func out(_ fields: JSONRecord) -> StripeProviderActionClientResult {
        StripeProviderActionClientResult(
            result: ["provider": .string("stripe"), "adapterBoundary": .string("stripe-provider-action-adapter"), "clientMode": .string("fake-stripe-api"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-state-excluded")].merging(fields) { _, new in new })
    }
}

public final class LiveStripeProviderActionClient: StripeProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService; private let secrets: SecretService; private let http: any StripeProviderHTTPClient
    public init(data: LocalDataService, secrets: SecretService, httpClient: any StripeProviderHTTPClient = URLSessionStripeProviderHTTPClient()) { self.data = data; self.secrets = secrets; self.http = httpClient }
    public func executeStripeAction(request: MarketplaceProviderActionAdapterRequest) throws -> StripeProviderActionClientResult {
        let token = try accessToken(request), payload = request.payload;
        switch request.definition.actionKey {
        case "stripe_balance_get": return out(["semanticReadContract": .string("stripe-balance-v1"), "balance": .object(StripeProviderActionSupport.balance(try get(token, "/balance", [])))]);
        case "stripe_payment_intent_list":
            var query = [URLQueryItem(name: "limit", value: String(StripeProviderActionSupport.bound(payload["limit"])))];
            if let cursor = payload["startingAfter"]?.string {
                guard StripeProviderActionSupport.validPaymentIntentId(cursor) else { throw MarketplaceProviderActionAdapterFailure(code: "stripe_cursor_invalid", message: "Stripe startingAfter must be a valid pi_ identifier.") }; query.append(URLQueryItem(name: "starting_after", value: cursor))
            }; let gte = payload["createdGte"]?.number.map(Int.init), lte = payload["createdLte"]?.number.map(Int.init);
            guard gte.map({ $0 > 0 }) ?? true, lte.map({ $0 > 0 }) ?? true, gte == nil || lte == nil || gte! <= lte! else { throw MarketplaceProviderActionAdapterFailure(code: "stripe_created_range_invalid", message: "Stripe created timestamp bounds are invalid.") };
            if let gte { query.append(URLQueryItem(name: "created[gte]", value: String(gte))) }; if let lte { query.append(URLQueryItem(name: "created[lte]", value: String(lte))) }; let status = payload["status"]?.string;
            guard status.map(StripeProviderActionSupport.statuses.contains) ?? true else { throw MarketplaceProviderActionAdapterFailure(code: "stripe_status_invalid", message: "Stripe PaymentIntent status is invalid.") };
            let root = try get(token, "/payment_intents", query).stripeObject ?? [:], values = (root["data"]?.stripeArray ?? []).map(StripeProviderActionSupport.paymentIntent).filter { status == nil || $0["status"]?.string == status };
            return out(["semanticReadContract": .string("stripe-payment-intent-list-v1"), "paymentIntents": .array(values.prefix(25).map(JSONValue.object)), "hasMore": root["has_more"] ?? .bool(false)]);
        case "stripe_payment_intent_get":
            let id = try StripeProviderActionSupport.paymentIntentId(payload); return out(["semanticReadContract": .string("stripe-payment-intent-get-v1"), "paymentIntent": .object(StripeProviderActionSupport.paymentIntent(try get(token, "/payment_intents/" + id, [])))]);
        default: throw MarketplaceProviderActionAdapterFailure(code: "stripe_live_action_not_supported", message: "Unsupported live Stripe action.")
        }
    }
    private func accessToken(_ request: MarketplaceProviderActionAdapterRequest) throws -> String {
        guard let id = request.auditIdentity.connectionId, let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), connection.appSlug == "stripe",
            let ref = connection.credentialRequirements.first(where: { $0.fieldKey == "stripe_apps_oauth_access_token" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "stripe_connection_not_ready", message: "Stripe connection is not ready.") }; return try secrets.getSecretValue(ref)
    }
    private func get(_ token: String, _ path: String, _ query: [URLQueryItem]) throws -> JSONValue {
        var components = URLComponents(string: "https://api.stripe.com/v1" + path)!; components.queryItems = query.isEmpty ? nil : query;
        let response = try http.send(StripeProviderHTTPRequest(url: components.url!, headers: ["Authorization": "Bearer " + token, "Stripe-Version": "2026-06-24.dahlia", "Accept": "application/json"]));
        guard (200..<300).contains(response.statusCode) else {
            let root = (try? JSONSerialization.jsonObject(with: response.body)).map(StripeProviderActionSupport.json) ?? .null;
            throw MarketplaceProviderActionAdapterFailure(
                code: response.statusCode == 401 ? "stripe_token_invalid" : response.statusCode == 403 ? "stripe_permission_denied" : response.statusCode == 429 ? "stripe_rate_limited" : "stripe_http_error", message: "Stripe API request failed.", providerStatusCode: response.statusCode,
                detail: ["providerError": StripeProviderActionSupport.error(root), "retryAfter": response.headers.first { $0.key.lowercased() == "retry-after" }.map { .string($0.value) } ?? .null])
        }; return StripeProviderActionSupport.json(try JSONSerialization.jsonObject(with: response.body))
    }
    private func out(_ fields: JSONRecord) -> StripeProviderActionClientResult {
        StripeProviderActionClientResult(
            result: ["provider": .string("stripe"), "adapterBoundary": .string("stripe-provider-action-adapter"), "clientMode": .string("live-stripe-api-2026-06-24.dahlia"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-state-excluded")].merging(fields) { _, new in new
            })
    }
}

public struct StripeProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = ["stripe_balance_get", "stripe_payment_intent_list", "stripe_payment_intent_get"]; private let client: any StripeProviderActionClient; public init(client: any StripeProviderActionClient = FakeStripeProviderActionClient()) { self.client = client };
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "stripe", Self.allowed.contains(request.definition.actionKey) else { throw MarketplaceProviderActionAdapterFailure(code: "stripe_action_not_allowlisted", message: "Stripe action is outside read-only V1.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executeStripeAction(request: request).result, error: nil, redactionStatus: "private-state-excluded")
    }
}

enum StripeProviderActionSupport {
    static let statuses = Set(["requires_payment_method", "requires_confirmation", "requires_action", "processing", "requires_capture", "canceled", "succeeded"])
    static func bound(_ value: JSONValue?) -> Int { max(1, min(25, value?.number.map(Int.init) ?? 10)) }
    static func validPaymentIntentId(_ value: String) -> Bool { value.hasPrefix("pi_") && value.count <= 128 && value.dropFirst(3).allSatisfy { $0.isLetter || $0.isNumber } }
    static func paymentIntentId(_ payload: JSONRecord) throws -> String {
        guard let value = payload["paymentIntentId"]?.string, validPaymentIntentId(value) else { throw MarketplaceProviderActionAdapterFailure(code: "stripe_payment_intent_id_invalid", message: "A valid Stripe PaymentIntent ID is required.") }; return value
    }
    static func paymentIntent(_ value: JSONValue) -> JSONRecord {
        let o = value.stripeObject ?? [:], keys = ["id", "status", "amount", "amount_capturable", "amount_received", "currency", "capture_method", "confirmation_method", "created", "canceled_at", "cancellation_reason", "livemode", "latest_charge"];
        return Dictionary(uniqueKeysWithValues: keys.map { ($0, safeScalar(o[$0] ?? .null)) })
    }
    static func balance(_ value: JSONValue) -> JSONRecord { let o = value.stripeObject ?? [:]; return ["livemode": safeScalar(o["livemode"] ?? .null), "available": money(o["available"]), "pending": money(o["pending"])] }
    static func money(_ value: JSONValue?) -> JSONValue { .array((value?.stripeArray ?? []).prefix(30).map { let o = $0.stripeObject ?? [:]; return .object(["amount": safeScalar(o["amount"] ?? .null), "currency": safeScalar(o["currency"] ?? .null)]) }) }
    static func safeScalar(_ value: JSONValue) -> JSONValue { switch value { case .string(let s): return .string(String(s.prefix(256))); case .number, .bool, .null: return value; default: return .null } }
    static func error(_ value: JSONValue) -> JSONValue {
        let o = value.stripeObject?["error"]?.stripeObject ?? [:];
        return .object(["type": safeScalar(o["type"] ?? .null), "code": safeScalar(o["code"] ?? .null), "declineCode": safeScalar(o["decline_code"] ?? .null), "param": safeScalar(o["param"] ?? .null), "message": safeScalar(o["message"] ?? .null)])
    }
    static func fakeBalance() -> JSONRecord { ["livemode": .bool(false), "available": .array([.object(["amount": .number(120000), "currency": .string("gbp")])]), "pending": .array([.object(["amount": .number(4500), "currency": .string("gbp")])])] }
    static func fakePaymentIntent() -> JSONRecord {
        [
            "id": .string("pi_relay123"), "status": .string("succeeded"), "amount": .number(1250), "amount_capturable": .number(0), "amount_received": .number(1250), "currency": .string("gbp"), "capture_method": .string("automatic_async"), "confirmation_method": .string("automatic"),
            "created": .number(1_788_998_400), "canceled_at": .null, "cancellation_reason": .null, "livemode": .bool(false), "latest_charge": .string("ch_relay123"),
        ]
    }
    static func json(_ value: Any) -> JSONValue {
        if let v = value as? String { return .string(v) }; if let v = value as? Bool { return .bool(v) }; if let v = value as? Int { return .number(Double(v)) }; if let v = value as? Double { return .number(v) }; if let v = value as? [String: Any] { return .object(v.mapValues(json)) };
        if let v = value as? [Any] { return .array(v.map(json)) }; return .null
    }
}
private extension JSONValue { var stripeObject: JSONRecord? { if case .object(let value) = self { return value }; return nil }; var stripeArray: [JSONValue]? { if case .array(let value) = self { return value }; return nil } }
