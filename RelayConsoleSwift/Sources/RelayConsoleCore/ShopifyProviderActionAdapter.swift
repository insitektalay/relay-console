import Foundation

public struct ShopifyProviderActionClientResult: Codable, Equatable, Sendable { public var result: JSONRecord; public init(result: JSONRecord) { self.result = result } }
public protocol ShopifyProviderActionClient: Sendable { func executeShopifyAction(request: MarketplaceProviderActionAdapterRequest) throws -> ShopifyProviderActionClientResult }
public struct ShopifyProviderHTTPRequest: Sendable, Equatable { public var url: URL; public var headers: [String: String]; public var body: Data; public init(url: URL, headers: [String: String], body: Data) { self.url = url; self.headers = headers; self.body = body } }
public struct ShopifyProviderHTTPResponse: Sendable, Equatable {
    public var statusCode: Int; public var headers: [String: String]; public var body: Data; public init(statusCode: Int, headers: [String: String] = [:], body: Data = Data()) { self.statusCode = statusCode; self.headers = headers; self.body = body }
}
public protocol ShopifyProviderHTTPClient: Sendable { func send(_ request: ShopifyProviderHTTPRequest) throws -> ShopifyProviderHTTPResponse }

public struct URLSessionShopifyProviderHTTPClient: ShopifyProviderHTTPClient {
    public init() {}
    public func send(_ request: ShopifyProviderHTTPRequest) throws -> ShopifyProviderHTTPResponse {
        var value = URLRequest(url: request.url); value.httpMethod = "POST"; value.timeoutInterval = 20; value.httpBody = request.body
        request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) }
        let semaphore = DispatchSemaphore(value: 0); var data: Data?; var response: HTTPURLResponse?; var failure: Error?
        let task = URLSession.shared.dataTask(with: value) { data = $0; response = $1 as? HTTPURLResponse; failure = $2; semaphore.signal() }
        task.resume()
        if semaphore.wait(timeout: .now() + 20) == .timedOut { task.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "shopify_http_timeout", message: "Shopify Admin GraphQL request timed out.") }
        if let failure { throw failure }
        return ShopifyProviderHTTPResponse(statusCode: response?.statusCode ?? 0, headers: response?.allHeaderFields.reduce(into: [:]) { $0[String(describing: $1.key)] = String(describing: $1.value) } ?? [:], body: data ?? Data())
    }
}

public struct FakeShopifyProviderActionClient: ShopifyProviderActionClient {
    public init() {}
    public func executeShopifyAction(request: MarketplaceProviderActionAdapterRequest) throws -> ShopifyProviderActionClientResult {
        let action = request.definition.actionKey
        if action == "shopify_shop_get" { return out(["semanticReadContract": .string("shopify-shop-get-v1"), "shop": .object(ShopifyProviderActionSupport.fakeShop())]) }
        if action == "shopify_product_list" { return out(["semanticReadContract": .string("shopify-product-list-v1"), "products": .array([.object(ShopifyProviderActionSupport.fakeProduct())]), "pageInfo": .object(["hasNextPage": .bool(false), "endCursor": .null])]) }
        if action == "shopify_product_get" { return out(["semanticReadContract": .string("shopify-product-get-v1"), "product": .object(ShopifyProviderActionSupport.fakeProduct())]) }
        if action == "shopify_publication_list" { return out(["semanticReadContract": .string("shopify-publication-list-v1"), "publications": .array([.object(["id": .string("gid://shopify/Publication/1"), "name": .string("Online Store"), "autoPublish": .bool(false)])])]) }
        if action == "shopify_product_prepare" {
            let normalized = try ShopifyProviderActionSupport.normalized(request.payload); return out(["draftPreview": .object(["payload": .object(normalized), "payloadHash": .string(MarketplaceProviderActionApprovalService.payloadHash(normalized)), "providerMutation": .bool(false)])])
        }
        if ["shopify_product_create_draft", "shopify_product_update_draft", "shopify_product_activate", "shopify_product_publish"].contains(action) {
            var product = ShopifyProviderActionSupport.fakeProduct(); product["status"] = .string(action == "shopify_product_publish" || action == "shopify_product_activate" ? "ACTIVE" : "DRAFT");
            return out(["product": .object(product), "contentState": .string(action == "shopify_product_publish" ? "published" : (action == "shopify_product_activate" ? "active" : "draft")), "userErrors": .array([])])
        }
        throw MarketplaceProviderActionAdapterFailure(code: "shopify_fake_action_not_supported", message: "Unsupported Shopify action.")
    }
    private func out(_ fields: JSONRecord) -> ShopifyProviderActionClientResult {
        ShopifyProviderActionClientResult(
            result: ["provider": .string("shopify"), "adapterBoundary": .string("shopify-provider-action-adapter"), "clientMode": .string("fake-shopify-admin-graphql"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-state-excluded")].merging(fields) { _, new in new })
    }
}

public final class LiveShopifyProviderActionClient: ShopifyProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService; private let secrets: SecretService; private let http: any ShopifyProviderHTTPClient
    public init(data: LocalDataService, secrets: SecretService, httpClient: any ShopifyProviderHTTPClient = URLSessionShopifyProviderHTTPClient()) { self.data = data; self.secrets = secrets; self.http = httpClient }
    public func executeShopifyAction(request: MarketplaceProviderActionAdapterRequest) throws -> ShopifyProviderActionClientResult {
        if request.definition.actionKey == "shopify_product_prepare" { return try FakeShopifyProviderActionClient().executeShopifyAction(request: request) }
        let auth = try authorization(request), payload = request.payload
        switch request.definition.actionKey {
        case "shopify_shop_get":
            return out(try graph(auth, "query RelayShop { shop { id name myshopifyDomain primaryDomain { host url } currencyCode plan { displayName } } }", [:]), "shopify-shop-get-v1", root: "shop")
        case "shopify_product_list":
            let first = ShopifyProviderActionSupport.bound(payload["maxResults"], 10, 25); var variables: [String: Any] = ["first": first]; if let after = payload["after"]?.string { variables["after"] = after }
            let result = try graph(auth, "query RelayProducts($first:Int!,$after:String){ products(first:$first,after:$after,sortKey:UPDATED_AT,reverse:true){ nodes { \(ShopifyProviderActionSupport.productFields) } pageInfo { hasNextPage endCursor } } }", variables)
            let root = result["products"]?.shopObject ?? [:];
            return response(["semanticReadContract": .string("shopify-product-list-v1"), "products": .array((root["nodes"]?.shopArray ?? []).prefix(25).map { .object(ShopifyProviderActionSupport.product($0)) }), "pageInfo": ShopifyProviderActionSupport.safe(root["pageInfo"] ?? .object([:]))])
        case "shopify_product_get":
            let id = try ShopifyProviderActionSupport.need(payload, "productId"), result = try graph(auth, "query RelayProduct($id:ID!){ product(id:$id){ \(ShopifyProviderActionSupport.productFields) } }", ["id": id]);
            return response(["semanticReadContract": .string("shopify-product-get-v1"), "product": .object(ShopifyProviderActionSupport.product(result["product"] ?? .null))])
        case "shopify_publication_list":
            let result = try graph(auth, "query RelayPublications { publications(first:25){ nodes { id name autoPublish catalog { __typename title } } } }", [:]); let nodes = result["publications"]?.shopObject?["nodes"]?.shopArray ?? [];
            return response(["semanticReadContract": .string("shopify-publication-list-v1"), "publications": .array(nodes.map { ShopifyProviderActionSupport.safe($0) })])
        case "shopify_product_create_draft":
            let normalized = try ShopifyProviderActionSupport.normalizedCreate(payload),
                result = try graph(
                    auth, "mutation RelayCreate($product:ProductCreateInput!){ productCreate(product:$product){ product { \(ShopifyProviderActionSupport.productFields) } userErrors { field message } } }",
                    ["product": ShopifyProviderActionSupport.productInput(normalized, includeId: false, forcedStatus: "DRAFT")])
            ; return try mutation(result, key: "productCreate", state: "draft")
        case "shopify_product_update_draft":
            let normalized = try ShopifyProviderActionSupport.normalizedUpdate(payload); try requireState(auth, normalized, status: "DRAFT");
            let result = try graph(
                auth, "mutation RelayUpdate($product:ProductUpdateInput!){ productUpdate(product:$product){ product { \(ShopifyProviderActionSupport.productFields) } userErrors { field message } } }",
                ["product": ShopifyProviderActionSupport.productInput(normalized, includeId: true, forcedStatus: "DRAFT")]);
            return try mutation(result, key: "productUpdate", state: "draft")
        case "shopify_product_activate":
            let normalized = try ShopifyProviderActionSupport.normalizedTransition(payload); try requireState(auth, normalized, status: "DRAFT");
            let result = try graph(auth, "mutation RelayActivate($product:ProductUpdateInput!){ productUpdate(product:$product){ product { \(ShopifyProviderActionSupport.productFields) } userErrors { field message } } }", ["product": ["id": normalized["productId"]!.string!, "status": "ACTIVE"]]);
            return try mutation(result, key: "productUpdate", state: "active")
        case "shopify_product_publish":
            let normalized = try ShopifyProviderActionSupport.normalizedPublish(payload); try requireState(auth, normalized, status: "ACTIVE");
            let result = try graph(
                auth, "mutation RelayPublish($id:ID!,$input:[PublicationInput!]!){ publishablePublish(id:$id,input:$input){ publishable { availablePublicationsCount { count } } userErrors { field message } } }",
                ["id": normalized["productId"]!.string!, "input": [["publicationId": normalized["publicationId"]!.string!]]]);
            return try mutation(result, key: "publishablePublish", state: "published")
        default: throw MarketplaceProviderActionAdapterFailure(code: "shopify_live_action_not_supported", message: "Unsupported live Shopify action.")
        }
    }
    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> (token: String, shop: String) {
        guard let id = request.auditIdentity.connectionId, let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), connection.appSlug == "shopify",
            let ref = connection.credentialRequirements.first(where: { $0.fieldKey == "shopify_oauth_access_token" })?.secretReferenceId, let shop = connection.health.diagnostics["shopDomain"]?.string, ShopifyProviderActionSupport.validShop(shop)
        else { throw MarketplaceProviderActionAdapterFailure(code: "shopify_connection_not_ready", message: "Shopify connection is not ready.") }; return (try secrets.getSecretValue(ref), shop)
    }
    private func requireState(_ auth: (token: String, shop: String), _ payload: JSONRecord, status: String) throws {
        let id = payload["productId"]!.string!, expected = payload["expectedUpdatedAt"]!.string!, result = try graph(auth, "query RelayProductState($id:ID!){ product(id:$id){ id status updatedAt } }", ["id": id]), product = result["product"]?.shopObject ?? [:];
        guard product["status"]?.string == status else { throw MarketplaceProviderActionAdapterFailure(code: "shopify_product_state_conflict", message: "Shopify product must be \(status.lowercased()) for this operation.") };
        guard product["updatedAt"]?.string == expected else { throw MarketplaceProviderActionAdapterFailure(code: "shopify_product_stale", message: "Shopify product changed after review; fetch it again.") }
    }
    private func mutation(_ result: JSONRecord, key: String, state: String) throws -> ShopifyProviderActionClientResult {
        let root = result[key]?.shopObject ?? [:], errors = root["userErrors"]?.shopArray ?? [];
        guard errors.isEmpty else { throw MarketplaceProviderActionAdapterFailure(code: "shopify_user_error", message: "Shopify rejected the mutation.", detail: ["userErrors": .array(errors.map { ShopifyProviderActionSupport.safe($0) })]) };
        var fields: JSONRecord = ["contentState": .string(state), "userErrors": .array([])];
        if let product = root["product"] { fields["product"] = .object(ShopifyProviderActionSupport.product(product)) } else { fields["publication"] = ShopifyProviderActionSupport.safe(root["publishable"] ?? .null) }; return response(fields)
    }
    private func graph(_ auth: (token: String, shop: String), _ query: String, _ variables: [String: Any]) throws -> JSONRecord {
        let url = URL(string: "https://\(auth.shop)/admin/api/2026-07/graphql.json")!, body = try JSONSerialization.data(withJSONObject: ["query": query, "variables": variables]),
            request = ShopifyProviderHTTPRequest(url: url, headers: ["Content-Type": "application/json", "Accept": "application/json", "X-Shopify-Access-Token": auth.token], body: body), response = try http.send(request)
        ;
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(code: response.statusCode == 401 ? "shopify_token_invalid" : response.statusCode == 429 ? "shopify_rate_limited" : "shopify_http_error", message: "Shopify Admin GraphQL request failed.", providerStatusCode: response.statusCode)
        }; let decoded = ShopifyProviderActionSupport.json(try JSONSerialization.jsonObject(with: response.body)).shopObject ?? [:];
        if let errors = decoded["errors"]?.shopArray, !errors.isEmpty { throw MarketplaceProviderActionAdapterFailure(code: "shopify_graphql_error", message: "Shopify GraphQL returned errors.", detail: ["errors": .array(errors.map { ShopifyProviderActionSupport.safe($0) })]) };
        return decoded["data"]?.shopObject ?? [:]
    }
    private func out(_ result: JSONRecord, _ semantic: String, root: String) -> ShopifyProviderActionClientResult { response(["semanticReadContract": .string(semantic), root: ShopifyProviderActionSupport.safe(result[root] ?? .null)]) }
    private func response(_ fields: JSONRecord) -> ShopifyProviderActionClientResult {
        ShopifyProviderActionClientResult(
            result: ["provider": .string("shopify"), "adapterBoundary": .string("shopify-provider-action-adapter"), "clientMode": .string("live-shopify-admin-graphql-2026-07"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-state-excluded")].merging(fields) { _, new in
                new
            })
    }
}

public struct ShopifyProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = ["shopify_shop_get", "shopify_product_list", "shopify_product_get", "shopify_publication_list", "shopify_product_prepare", "shopify_product_create_draft", "shopify_product_update_draft", "shopify_product_activate", "shopify_product_publish"]
    private let client: any ShopifyProviderActionClient
    public init(client: any ShopifyProviderActionClient = FakeShopifyProviderActionClient()) { self.client = client }
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "shopify" else { throw MarketplaceProviderActionAdapterFailure(code: "shopify_wrong_provider", message: "Shopify adapter requires Shopify.") };
        guard Self.allowed.contains(request.definition.actionKey) else { throw MarketplaceProviderActionAdapterFailure(code: "shopify_action_not_allowlisted", message: "Shopify action is outside V1.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executeShopifyAction(request: request).result, error: nil, redactionStatus: "private-state-excluded")
    }
}

public enum ShopifyProviderActionSupport {
    static let productFields = "id title handle description descriptionHtml vendor productType status tags createdAt updatedAt seo { title description } options { id name position values } variants(first:10) { nodes { id title sku price inventoryQuantity } }"
    static func need(_ payload: JSONRecord, _ key: String) throws -> String {
        guard let value = payload[key]?.string?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else { throw MarketplaceProviderActionAdapterFailure(code: "shopify_missing_field", message: "Shopify \(key) is required.") }; return value
    }
    static func bound(_ value: JSONValue?, _ fallback: Int, _ maximum: Int) -> Int { max(1, min(maximum, value?.number.map(Int.init) ?? fallback)) }
    static func validShop(_ value: String) -> Bool { let lower = value.lowercased(); return lower == value && lower.hasSuffix(".myshopify.com") && !lower.contains("/") && lower.count <= 100 }
    static func normalized(_ payload: JSONRecord) throws -> JSONRecord {
        switch payload["operation"]?.string ?? "create" {
        case "create": return try normalizedCreate(payload);
        case "update": return try normalizedUpdate(payload);
        case "activate": return try normalizedTransition(payload);
        case "publish": return try normalizedPublish(payload);
        default: throw MarketplaceProviderActionAdapterFailure(code: "shopify_invalid_operation", message: "Use create, update, activate, or publish.")
        }
    }
    static func normalizedCreate(_ payload: JSONRecord) throws -> JSONRecord { var value = try editable(payload); value["operation"] = .string("create"); return value }
    static func normalizedUpdate(_ payload: JSONRecord) throws -> JSONRecord {
        var value = try editable(payload); value["operation"] = .string("update"); value["productId"] = .string(try need(payload, "productId")); value["expectedUpdatedAt"] = .string(try need(payload, "expectedUpdatedAt")); return value
    }
    static func normalizedTransition(_ payload: JSONRecord) throws -> JSONRecord { ["operation": .string("activate"), "productId": .string(try need(payload, "productId")), "expectedUpdatedAt": .string(try need(payload, "expectedUpdatedAt"))] }
    static func normalizedPublish(_ payload: JSONRecord) throws -> JSONRecord {
        ["operation": .string("publish"), "productId": .string(try need(payload, "productId")), "publicationId": .string(try need(payload, "publicationId")), "expectedUpdatedAt": .string(try need(payload, "expectedUpdatedAt"))]
    }
    private static func editable(_ payload: JSONRecord) throws -> JSONRecord {
        var value: JSONRecord = ["title": .string(try need(payload, "title"))]; for key in ["descriptionHtml", "vendor", "productType", "handle"] { if let text = payload[key]?.string { value[key] = .string(String(text.prefix(10000))) } };
        if case .array(let tags)? = payload["tags"] { value["tags"] = .array(tags.prefix(40).compactMap { $0.string.map { .string(String($0.prefix(100))) } }) }; return value
    }
    static func productInput(_ payload: JSONRecord, includeId: Bool, forcedStatus: String) -> [String: Any] {
        var value: [String: Any] = ["title": payload["title"]!.string!, "status": forcedStatus]; for key in ["descriptionHtml", "vendor", "productType", "handle"] { if let text = payload[key]?.string { value[key] = text } };
        if let tags = payload["tags"]?.shopArray { value["tags"] = tags.compactMap(\.string) }; if includeId { value["id"] = payload["productId"]!.string! }; return value
    }
    static func product(_ value: JSONValue) -> JSONRecord {
        let object = value.shopObject ?? [:];
        return [
            "id": object["id"] ?? .null, "title": object["title"] ?? .null, "handle": object["handle"] ?? .null, "description": safe(object["description"] ?? .null), "descriptionHtml": safe(object["descriptionHtml"] ?? .null), "vendor": object["vendor"] ?? .null,
            "productType": object["productType"] ?? .null, "status": object["status"] ?? .null, "tags": safe(object["tags"] ?? .array([])), "createdAt": object["createdAt"] ?? .null, "updatedAt": object["updatedAt"] ?? .null, "seo": safe(object["seo"] ?? .object([:])),
            "options": safe(object["options"] ?? .array([])), "variants": safe(object["variants"]?.shopObject?["nodes"] ?? .array([])),
        ]
    }
    static func safe(_ value: JSONValue, _ depth: Int = 0) -> JSONValue {
        guard depth < 5 else { return .null };
        switch value {
        case .string(let text): return .string(String(text.prefix(10000)));
        case .array(let values): return .array(values.prefix(30).map { safe($0, depth + 1) });
        case .object(let object): return .object(Dictionary(uniqueKeysWithValues: object.prefix(50).map { ($0.key, safe($0.value, depth + 1)) }));
        default: return value
        }
    }
    static func fakeShop() -> JSONRecord { ["id": .string("gid://shopify/Shop/1"), "name": .string("Relay Test Shop"), "myshopifyDomain": .string("relay-test.myshopify.com"), "currencyCode": .string("GBP")] }
    static func fakeProduct() -> JSONRecord {
        [
            "id": .string("gid://shopify/Product/1"), "title": .string("Relay Launch"), "handle": .string("relay-launch"), "description": .string("Reviewed product"), "descriptionHtml": .string("<p>Reviewed product</p>"), "vendor": .string("Relay"), "productType": .string("Editorial"),
            "status": .string("DRAFT"), "tags": .array([.string("relay")]), "createdAt": .string("2026-07-11T00:00:00Z"), "updatedAt": .string("2026-07-11T00:00:01Z"), "seo": .object(["title": .string("Relay Launch")]), "options": .array([]), "variants": .array([]),
        ]
    }
    static func json(_ value: Any) -> JSONValue {
        if let value = value as? String { return .string(value) }; if let value = value as? Bool { return .bool(value) }; if let value = value as? Int { return .number(Double(value)) }; if let value = value as? Double { return .number(value) };
        if let value = value as? [String: Any] { return .object(value.mapValues(json)) }; if let value = value as? [Any] { return .array(value.map(json)) }; return .null
    }
}

private extension JSONValue { var shopObject: JSONRecord? { if case .object(let value) = self { return value }; return nil }; var shopArray: [JSONValue]? { if case .array(let value) = self { return value }; return nil } }
