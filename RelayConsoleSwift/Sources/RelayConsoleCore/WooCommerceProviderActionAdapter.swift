import Foundation
#if canImport(Darwin)
import Darwin
#else
import Glibc
#endif

public struct WooCommerceProviderActionClientResult: Codable, Equatable, Sendable { public var result: JSONRecord; public init(result: JSONRecord) { self.result = result } }
public protocol WooCommerceProviderActionClient: Sendable { func executeWooCommerceAction(request: MarketplaceProviderActionAdapterRequest) throws -> WooCommerceProviderActionClientResult }
public struct WooCommerceProviderHTTPRequest: Sendable, Equatable {
    public var method: String; public var url: URL; public var headers: [String: String]; public var body: Data?; public init(method: String, url: URL, headers: [String: String], body: Data? = nil) { self.method = method; self.url = url; self.headers = headers; self.body = body }
}
public struct WooCommerceProviderHTTPResponse: Sendable, Equatable {
    public var statusCode: Int; public var headers: [String: String]; public var body: Data; public init(statusCode: Int, headers: [String: String] = [:], body: Data = Data()) { self.statusCode = statusCode; self.headers = headers; self.body = body }
}
public protocol WooCommerceProviderHTTPClient: Sendable { func send(_ request: WooCommerceProviderHTTPRequest) throws -> WooCommerceProviderHTTPResponse }
public protocol WooCommerceOriginResolving: Sendable { func resolvesOnlyToPublicAddresses(host: String) -> Bool }
public struct SystemWooCommerceOriginResolver: WooCommerceOriginResolving {
    public init() {}
    public func resolvesOnlyToPublicAddresses(host: String) -> Bool {
        var hints = addrinfo(); hints.ai_family = AF_UNSPEC; hints.ai_flags = AI_ADDRCONFIG
        #if canImport(Darwin)
        hints.ai_socktype = SOCK_STREAM
        #else
        hints.ai_socktype = Int32(SOCK_STREAM.rawValue)
        #endif
        var result: UnsafeMutablePointer<addrinfo>?; guard getaddrinfo(host, nil, &hints, &result) == 0, let first = result else { return false }; defer { freeaddrinfo(first) }
        var cursor: UnsafeMutablePointer<addrinfo>? = first, found = false
        while let current = cursor {
            if let address = current.pointee.ai_addr {
                var buffer = [CChar](repeating: 0, count: Int(NI_MAXHOST)); guard getnameinfo(address, current.pointee.ai_addrlen, &buffer, socklen_t(buffer.count), nil, 0, NI_NUMERICHOST) == 0 else { return false }; found = true;
                if !WooCommerceProviderActionSupport.publicIPAddress(String(cString: buffer)) { return false }
            }; cursor = current.pointee.ai_next
        }
        return found
    }
}

private final class WooCommerceNoRedirectDelegate: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}
public struct URLSessionWooCommerceProviderHTTPClient: WooCommerceProviderHTTPClient {
    public init() {}
    public func send(_ request: WooCommerceProviderHTTPRequest) throws -> WooCommerceProviderHTTPResponse {
        var value = URLRequest(url: request.url); value.httpMethod = request.method; value.timeoutInterval = 20; value.httpBody = request.body; request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) };
        let session = URLSession(configuration: .ephemeral, delegate: WooCommerceNoRedirectDelegate(), delegateQueue: nil), semaphore = DispatchSemaphore(value: 0); var data: Data?; var response: HTTPURLResponse?; var failure: Error?;
        let task = session.dataTask(with: value) {
            data = $0; response = $1 as? HTTPURLResponse; failure = $2; semaphore.signal()
        }; task.resume(); if semaphore.wait(timeout: .now() + 20) == .timedOut { task.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "woocommerce_http_timeout", message: "WooCommerce REST request timed out.") }; session.invalidateAndCancel(); if let failure { throw failure };
        return WooCommerceProviderHTTPResponse(statusCode: response?.statusCode ?? 0, headers: response?.allHeaderFields.reduce(into: [:]) { $0[String(describing: $1.key)] = String(describing: $1.value) } ?? [:], body: data ?? Data())
    }
}

public struct FakeWooCommerceProviderActionClient: WooCommerceProviderActionClient {
    public init() {}
    public func executeWooCommerceAction(request: MarketplaceProviderActionAdapterRequest) throws -> WooCommerceProviderActionClientResult {
        switch request.definition.actionKey {
        case "woocommerce_product_list": return out(["semanticReadContract": .string("woocommerce-product-list-v1"), "products": .array([.object(WooCommerceProviderActionSupport.fakeProduct())]), "pagination": .object(["total": .number(1), "totalPages": .number(1), "page": .number(1)])]);
        case "woocommerce_product_get": return out(["semanticReadContract": .string("woocommerce-product-get-v1"), "product": .object(WooCommerceProviderActionSupport.fakeProduct())]);
        case "woocommerce_category_list": return out(["semanticReadContract": .string("woocommerce-category-list-v1"), "categories": .array([.object(["id": .number(7), "name": .string("Launch"), "slug": .string("launch"), "count": .number(1)])])]);
        case "woocommerce_product_prepare":
            let normalized = try WooCommerceProviderActionSupport.normalized(request.payload); return out(["draftPreview": .object(["payload": .object(normalized), "payloadHash": .string(MarketplaceProviderActionApprovalService.payloadHash(normalized)), "providerMutation": .bool(false)])]);
        case "woocommerce_product_create_draft", "woocommerce_product_update_draft", "woocommerce_product_publish":
            var product = WooCommerceProviderActionSupport.fakeProduct(); product["status"] = .string(request.definition.actionKey.hasSuffix("publish") ? "publish" : "draft");
            return out(["product": .object(product), "contentState": .string(request.definition.actionKey.hasSuffix("publish") ? "published" : "draft")]);
        default: throw MarketplaceProviderActionAdapterFailure(code: "woocommerce_fake_action_not_supported", message: "Unsupported WooCommerce action.")
        }
    }
    private func out(_ fields: JSONRecord) -> WooCommerceProviderActionClientResult {
        WooCommerceProviderActionClientResult(
            result: ["provider": .string("woocommerce"), "adapterBoundary": .string("woocommerce-provider-action-adapter"), "clientMode": .string("fake-woocommerce-rest-v3"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-state-excluded")].merging(fields) { _, new in
                new
            })
    }
}

public final class LiveWooCommerceProviderActionClient: WooCommerceProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService; private let secrets: SecretService; private let http: any WooCommerceProviderHTTPClient; private let originResolver: any WooCommerceOriginResolving
    public init(data: LocalDataService, secrets: SecretService, httpClient: any WooCommerceProviderHTTPClient = URLSessionWooCommerceProviderHTTPClient(), originResolver: any WooCommerceOriginResolving = SystemWooCommerceOriginResolver()) {
        self.data = data; self.secrets = secrets; self.http = httpClient; self.originResolver = originResolver
    }
    public func executeWooCommerceAction(request: MarketplaceProviderActionAdapterRequest) throws -> WooCommerceProviderActionClientResult {
        if request.definition.actionKey == "woocommerce_product_prepare" { return try FakeWooCommerceProviderActionClient().executeWooCommerceAction(request: request) }
        let auth = try authorization(request), payload = request.payload
        switch request.definition.actionKey {
        case "woocommerce_product_list":
            let page = WooCommerceProviderActionSupport.bound(payload["page"], 1, 10_000), count = WooCommerceProviderActionSupport.bound(payload["maxResults"], 10, 25),
                response = try send(auth, "GET", "/products", [URLQueryItem(name: "page", value: String(page)), URLQueryItem(name: "per_page", value: String(count)), URLQueryItem(name: "orderby", value: "modified"), URLQueryItem(name: "order", value: "desc")])
            ;
            return out([
                "semanticReadContract": .string("woocommerce-product-list-v1"), "products": .array((response.value.wooArray ?? []).prefix(25).map { .object(WooCommerceProviderActionSupport.product($0)) }),
                "pagination": .object([
                    "page": .number(Double(page)), "total": .number(Double(response.headers.value("x-wp-total") ?? "0") ?? 0), "totalPages": .number(Double(response.headers.value("x-wp-totalpages") ?? "0") ?? 0), "link": .string(String((response.headers.value("link") ?? "").prefix(2000))),
                ]),
            ])
        case "woocommerce_product_get":
            let id = try WooCommerceProviderActionSupport.positiveId(payload, "productId"), response = try send(auth, "GET", "/products/\(id)", []);
            return out(["semanticReadContract": .string("woocommerce-product-get-v1"), "product": .object(WooCommerceProviderActionSupport.product(response.value))])
        case "woocommerce_category_list":
            let response = try send(auth, "GET", "/products/categories", [URLQueryItem(name: "per_page", value: "25"), URLQueryItem(name: "orderby", value: "name")]);
            return out(["semanticReadContract": .string("woocommerce-category-list-v1"), "categories": .array((response.value.wooArray ?? []).prefix(25).map { WooCommerceProviderActionSupport.safe($0) })])
        case "woocommerce_product_create_draft":
            let normalized = try WooCommerceProviderActionSupport.normalizedCreate(payload), response = try send(auth, "POST", "/products", [], WooCommerceProviderActionSupport.body(normalized, status: "draft"));
            return out(["product": .object(WooCommerceProviderActionSupport.product(response.value)), "contentState": .string("draft")])
        case "woocommerce_product_update_draft":
            let normalized = try WooCommerceProviderActionSupport.normalizedUpdate(payload), id = Int(normalized["productId"]!.number!); try requireState(auth, id, normalized["expectedDateModifiedGMT"]!.string!);
            let response = try send(auth, "PUT", "/products/\(id)", [], WooCommerceProviderActionSupport.body(normalized, status: "draft")); return out(["product": .object(WooCommerceProviderActionSupport.product(response.value)), "contentState": .string("draft")])
        case "woocommerce_product_publish":
            let normalized = try WooCommerceProviderActionSupport.normalizedPublish(payload), id = Int(normalized["productId"]!.number!); try requireState(auth, id, normalized["expectedDateModifiedGMT"]!.string!); let response = try send(auth, "PUT", "/products/\(id)", [], ["status": "publish"]);
            return out(["product": .object(WooCommerceProviderActionSupport.product(response.value)), "contentState": .string("published")])
        default: throw MarketplaceProviderActionAdapterFailure(code: "woocommerce_live_action_not_supported", message: "Unsupported live WooCommerce action.")
        }
    }
    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> (origin: String, key: String, secret: String) {
        guard let id = request.auditIdentity.connectionId, let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), connection.appSlug == "woocommerce", let origin = connection.health.diagnostics["storeOrigin"]?.string,
            WooCommerceProviderActionSupport.validOrigin(origin), let keyRef = connection.credentialRequirements.first(where: { $0.fieldKey == "woocommerce_consumer_key" })?.secretReferenceId,
            let secretRef = connection.credentialRequirements.first(where: { $0.fieldKey == "woocommerce_consumer_secret" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "woocommerce_connection_not_ready", message: "WooCommerce connection is not ready.") }; return (origin, try secrets.getSecretValue(keyRef), try secrets.getSecretValue(secretRef))
    }
    private func requireState(_ auth: (origin: String, key: String, secret: String), _ id: Int, _ expected: String) throws {
        let product = try send(auth, "GET", "/products/\(id)", []).value.wooObject ?? [:]; guard product["status"]?.string == "draft" else { throw MarketplaceProviderActionAdapterFailure(code: "woocommerce_product_state_conflict", message: "WooCommerce product must be draft.") };
        guard product["date_modified_gmt"]?.string == expected else { throw MarketplaceProviderActionAdapterFailure(code: "woocommerce_product_stale", message: "WooCommerce product changed after review; fetch it again.") }
    }
    private func send(_ auth: (origin: String, key: String, secret: String), _ method: String, _ path: String, _ query: [URLQueryItem], _ object: [String: Any]? = nil) throws -> (value: JSONValue, headers: [String: String]) {
        guard WooCommerceProviderActionSupport.validOrigin(auth.origin), var components = URLComponents(string: auth.origin + "/wp-json/wc/v3" + path), let host = components.host, originResolver.resolvesOnlyToPublicAddresses(host: host) else {
            throw MarketplaceProviderActionAdapterFailure(code: "woocommerce_origin_invalid", message: "WooCommerce store origin must resolve only to public addresses before every request.")
        }; components.queryItems = query.isEmpty ? nil : query;
        let credential = Data((auth.key + ":" + auth.secret).utf8).base64EncodedString(), body = try object.map { try JSONSerialization.data(withJSONObject: $0) },
            response = try http.send(WooCommerceProviderHTTPRequest(method: method, url: components.url!, headers: ["Authorization": "Basic " + credential, "Accept": "application/json", "Content-Type": "application/json"], body: body))
        ;
        guard (200..<300).contains(response.statusCode) else {
            let decoded = (try? JSONSerialization.jsonObject(with: response.body)).map(WooCommerceProviderActionSupport.json) ?? .null;
            throw MarketplaceProviderActionAdapterFailure(
                code: response.statusCode == 401 ? "woocommerce_credentials_invalid" : response.statusCode == 404 ? "woocommerce_resource_not_found" : response.statusCode == 429 ? "woocommerce_rate_limited" : "woocommerce_http_error", message: "WooCommerce REST request failed.",
                providerStatusCode: response.statusCode, detail: ["providerError": WooCommerceProviderActionSupport.safe(decoded)])
        }; return (WooCommerceProviderActionSupport.json(try JSONSerialization.jsonObject(with: response.body)), response.headers)
    }
    private func out(_ fields: JSONRecord) -> WooCommerceProviderActionClientResult {
        WooCommerceProviderActionClientResult(
            result: ["provider": .string("woocommerce"), "adapterBoundary": .string("woocommerce-provider-action-adapter"), "clientMode": .string("live-woocommerce-rest-v3"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-state-excluded")].merging(fields) { _, new in
                new
            })
    }
}

public struct WooCommerceProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = ["woocommerce_product_list", "woocommerce_product_get", "woocommerce_category_list", "woocommerce_product_prepare", "woocommerce_product_create_draft", "woocommerce_product_update_draft", "woocommerce_product_publish"];
    private let client: any WooCommerceProviderActionClient; public init(client: any WooCommerceProviderActionClient = FakeWooCommerceProviderActionClient()) { self.client = client };
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "woocommerce", Self.allowed.contains(request.definition.actionKey) else { throw MarketplaceProviderActionAdapterFailure(code: "woocommerce_action_not_allowlisted", message: "WooCommerce action is outside V1.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executeWooCommerceAction(request: request).result, error: nil, redactionStatus: "private-state-excluded")
    }
}

public enum WooCommerceProviderActionSupport {
    public static func validOrigin(_ value: String) -> Bool {
        guard let url = URL(string: value), url.scheme == "https", url.user == nil, url.password == nil, url.query == nil, url.fragment == nil, (url.path.isEmpty || url.path == "/"), let host = url.host?.lowercased(), host == url.host, !host.isEmpty else { return false };
        let blocked = ["localhost", "localhost.localdomain", "0.0.0.0", "::1", "169.254.169.254"]; if blocked.contains(host) || host.hasSuffix(".local") || host.hasSuffix(".internal") { return false }; let ipv4 = host.split(separator: ".").compactMap { Int($0) };
        if ipv4.count == 4, ipv4[0] == 10 || ipv4[0] == 127 || ipv4[0] == 0 || (ipv4[0] == 169 && ipv4[1] == 254) || (ipv4[0] == 192 && ipv4[1] == 168) || (ipv4[0] == 172 && (16...31).contains(ipv4[1])) { return false }; return true
    }
    static func publicIPAddress(_ value: String) -> Bool {
        var v4 = in_addr();
        if value.withCString({ inet_pton(AF_INET, $0, &v4) }) == 1 {
            let bytes = withUnsafeBytes(of: &v4.s_addr) { Array($0) }; return !(bytes[0] == 0 || bytes[0] == 10 || bytes[0] == 127 || (bytes[0] == 169 && bytes[1] == 254) || (bytes[0] == 172 && (16...31).contains(bytes[1])) || (bytes[0] == 192 && bytes[1] == 168) || bytes[0] >= 224)
        }; var v6 = in6_addr();
        if value.withCString({ inet_pton(AF_INET6, $0, &v6) }) == 1 {
            let bytes = withUnsafeBytes(of: &v6) { Array($0) };
            let allZero = bytes.allSatisfy { $0 == 0 }, loopback = bytes.dropLast().allSatisfy { $0 == 0 } && bytes.last == 1, linkLocal = bytes[0] == 0xfe && (bytes[1] & 0xc0) == 0x80, uniqueLocal = (bytes[0] & 0xfe) == 0xfc, multicast = bytes[0] == 0xff;
            return !(allZero || loopback || linkLocal || uniqueLocal || multicast)
        }; return false
    }
    static func positiveId(_ payload: JSONRecord, _ key: String) throws -> Int { let value = Int(payload[key]?.number ?? 0); guard value > 0 else { throw MarketplaceProviderActionAdapterFailure(code: "woocommerce_missing_field", message: "Positive WooCommerce \(key) is required.") }; return value }
    static func need(_ payload: JSONRecord, _ key: String) throws -> String {
        guard let value = payload[key]?.string?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else { throw MarketplaceProviderActionAdapterFailure(code: "woocommerce_missing_field", message: "WooCommerce \(key) is required.") }; return value
    }
    static func bound(_ value: JSONValue?, _ fallback: Int, _ maximum: Int) -> Int { max(1, min(maximum, value?.number.map(Int.init) ?? fallback)) }
    static func normalized(_ payload: JSONRecord) throws -> JSONRecord {
        switch payload["operation"]?.string ?? "create" {
        case "create": return try normalizedCreate(payload);
        case "update": return try normalizedUpdate(payload);
        case "publish": return try normalizedPublish(payload);
        default: throw MarketplaceProviderActionAdapterFailure(code: "woocommerce_invalid_operation", message: "Use create, update, or publish.")
        }
    }
    static func normalizedCreate(_ payload: JSONRecord) throws -> JSONRecord { var value = try editable(payload); value["operation"] = .string("create"); return value }
    static func normalizedUpdate(_ payload: JSONRecord) throws -> JSONRecord {
        var value = try editable(payload); value["operation"] = .string("update"); value["productId"] = .number(Double(try positiveId(payload, "productId"))); value["expectedDateModifiedGMT"] = .string(try need(payload, "expectedDateModifiedGMT")); return value
    }
    static func normalizedPublish(_ payload: JSONRecord) throws -> JSONRecord { ["operation": .string("publish"), "productId": .number(Double(try positiveId(payload, "productId"))), "expectedDateModifiedGMT": .string(try need(payload, "expectedDateModifiedGMT"))] }
    private static func editable(_ payload: JSONRecord) throws -> JSONRecord {
        var value: JSONRecord = ["name": .string(try need(payload, "name"))]; for key in ["slug", "description", "short_description"] { if let text = payload[key]?.string { value[key] = .string(String(text.prefix(20_000))) } };
        for key in ["categories", "tags"] { if case .array(let ids)? = payload[key] { value[key] = .array(ids.prefix(30).compactMap { $0.number.map(JSONValue.number) }) } }; return value
    }
    static func body(_ payload: JSONRecord, status: String) -> [String: Any] {
        var value: [String: Any] = ["name": payload["name"]!.string!, "status": status]; for key in ["slug", "description", "short_description"] { if let text = payload[key]?.string { value[key] = text } };
        for key in ["categories", "tags"] { if let ids = payload[key]?.wooArray { value[key] = ids.compactMap(\.number).map { ["id": Int($0)] } } }; return value
    }
    static func product(_ value: JSONValue) -> JSONRecord {
        let object = value.wooObject ?? [:],
            keys = [
                "id", "name", "slug", "permalink", "status", "type", "description", "short_description", "sku", "price", "regular_price", "sale_price", "stock_status", "date_created", "date_created_gmt", "date_modified", "date_modified_gmt", "categories", "tags", "images", "attributes",
                "variations",
            ]
        ; return Dictionary(uniqueKeysWithValues: keys.map { ($0, safe(object[$0] ?? .null)) })
    }
    static func safe(_ value: JSONValue, _ depth: Int = 0) -> JSONValue {
        guard depth < 5 else { return .null };
        switch value {
        case .string(let text): return .string(String(text.prefix(20_000)));
        case .array(let values): return .array(values.prefix(30).map { safe($0, depth + 1) });
        case .object(let object): return .object(Dictionary(uniqueKeysWithValues: object.prefix(50).map { ($0.key, safe($0.value, depth + 1)) }));
        default: return value
        }
    }
    static func fakeProduct() -> JSONRecord {
        [
            "id": .number(42), "name": .string("Relay Launch"), "slug": .string("relay-launch"), "permalink": .string("https://shop.example/products/relay-launch"), "status": .string("draft"), "type": .string("simple"), "description": .string("<p>Reviewed product</p>"),
            "short_description": .string("Reviewed"), "sku": .string("RL-1"), "price": .string("12.00"), "regular_price": .string("12.00"), "sale_price": .string(""), "stock_status": .string("instock"), "date_created": .string("2026-07-11T00:00:00"),
            "date_created_gmt": .string("2026-07-10T23:00:00"), "date_modified": .string("2026-07-11T00:00:01"), "date_modified_gmt": .string("2026-07-10T23:00:01"), "categories": .array([]), "tags": .array([]), "images": .array([]), "attributes": .array([]), "variations": .array([]),
        ]
    }
    static func json(_ value: Any) -> JSONValue {
        if let value = value as? String { return .string(value) }; if let value = value as? Bool { return .bool(value) }; if let value = value as? Int { return .number(Double(value)) }; if let value = value as? Double { return .number(value) };
        if let value = value as? [String: Any] { return .object(value.mapValues(json)) }; if let value = value as? [Any] { return .array(value.map(json)) }; return .null
    }
}
private extension JSONValue { var wooObject: JSONRecord? { if case .object(let value) = self { return value }; return nil }; var wooArray: [JSONValue]? { if case .array(let value) = self { return value }; return nil } }
private extension Dictionary where Key == String, Value == String { func value(_ lowercasedKey: String) -> String? { first { $0.key.lowercased() == lowercasedKey }?.value } }
