import Foundation

public struct WebflowProviderActionClientResult: Codable, Equatable, Sendable {
    public var result: JSONRecord
    public init(result: JSONRecord) { self.result = result }
}

public protocol WebflowProviderActionClient: Sendable {
    func executeWebflowAction(request: MarketplaceProviderActionAdapterRequest) throws -> WebflowProviderActionClientResult
}

public struct WebflowProviderHTTPRequest: Sendable, Equatable {
    public var method: String
    public var url: URL
    public var headers: [String: String]
    public var body: Data?
    public init(method: String, url: URL, headers: [String: String] = [:], body: Data? = nil) { self.method = method; self.url = url; self.headers = headers; self.body = body }
}

public struct WebflowProviderHTTPResponse: Sendable, Equatable {
    public var statusCode: Int
    public var headers: [String: String]
    public var body: Data
    public init(statusCode: Int, headers: [String: String] = [:], body: Data = Data()) { self.statusCode = statusCode; self.headers = headers; self.body = body }
}

public protocol WebflowProviderHTTPClient: Sendable { func send(_ request: WebflowProviderHTTPRequest) throws -> WebflowProviderHTTPResponse }

public struct URLSessionWebflowProviderHTTPClient: WebflowProviderHTTPClient {
    public init() {}
    public func send(_ request: WebflowProviderHTTPRequest) throws -> WebflowProviderHTTPResponse {
        var value = URLRequest(url: request.url); value.httpMethod = request.method; value.timeoutInterval = 20; value.httpBody = request.body
        request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) }
        let semaphore = DispatchSemaphore(value: 0); var data: Data?; var response: HTTPURLResponse?; var failure: Error?
        let task = URLSession.shared.dataTask(with: value) { data = $0; response = $1 as? HTTPURLResponse; failure = $2; semaphore.signal() }
        task.resume()
        if semaphore.wait(timeout: .now() + 20) == .timedOut { task.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "webflow_http_timeout", message: "Webflow API request timed out.") }
        if let failure { throw failure }
        let headers = response?.allHeaderFields.reduce(into: [String: String]()) { $0[String(describing: $1.key)] = String(describing: $1.value) } ?? [:]
        return WebflowProviderHTTPResponse(statusCode: response?.statusCode ?? 0, headers: headers, body: data ?? Data())
    }
}

public struct FakeWebflowProviderActionClient: WebflowProviderActionClient {
    public init() {}
    public func executeWebflowAction(request: MarketplaceProviderActionAdapterRequest) throws -> WebflowProviderActionClientResult {
        let p = request.payload
        switch request.definition.actionKey {
        case "webflow_site_list": return output(request, ["semanticReadContract": .string("webflow-site-list-v1"), "sites": .array([.object(WebflowProviderActionSupport.fakeSite())])])
        case "webflow_site_get": var v = WebflowProviderActionSupport.fakeSite(); v["id"] = .string(try WebflowProviderActionSupport.need(p, "siteId")); return output(request, ["semanticReadContract": .string("webflow-site-get-v1"), "site": .object(v)])
        case "webflow_collection_list": return output(request, ["semanticReadContract": .string("webflow-collection-list-v1"), "siteId": .string(try WebflowProviderActionSupport.need(p, "siteId")), "collections": .array([.object(WebflowProviderActionSupport.fakeCollection(includeFields: false))])])
        case "webflow_collection_get":
            var v = WebflowProviderActionSupport.fakeCollection(includeFields: true); v["id"] = .string(try WebflowProviderActionSupport.need(p, "collectionId")); return output(request, ["semanticReadContract": .string("webflow-collection-get-v1"), "collection": .object(v)])
        case "webflow_collection_items":
            return output(
                request,
                [
                    "semanticReadContract": .string("webflow-collection-items-v1"), "collectionId": .string(try WebflowProviderActionSupport.need(p, "collectionId")), "items": .array([.object(WebflowProviderActionSupport.fakeItem())]),
                    "pagination": .object(["limit": .number(10), "offset": .number(0), "total": .number(1)]),
                ])
        case "webflow_item_get": var v = WebflowProviderActionSupport.fakeItem(); v["id"] = .string(try WebflowProviderActionSupport.need(p, "itemId")); return output(request, ["semanticReadContract": .string("webflow-item-get-v1"), "item": .object(v)])
        case "webflow_item_prepare": let n = try WebflowProviderActionSupport.normalized(p), hash = MarketplaceProviderActionApprovalService.payloadHash(n); return output(request, ["draftPreview": .object(["payload": .object(n), "payloadHash": .string(hash), "providerMutation": .bool(false)])])
        case "webflow_item_update":
            let n = try WebflowProviderActionSupport.normalizedUpdate(p), hash = MarketplaceProviderActionApprovalService.payloadHash(n); var v = WebflowProviderActionSupport.fakeItem(); v["id"] = n["itemId"]; v["fieldData"] = n["fieldData"];
            return output(request, ["item": .object(v), "contentState": .string("staged"), "payloadHash": .string(hash), "auditId": .string(request.auditIdentity.dispatchId ?? request.idempotencyKey)])
        case "webflow_item_publish":
            let n = try WebflowProviderActionSupport.normalizedPublish(p), hash = MarketplaceProviderActionApprovalService.payloadHash(n);
            return output(request, ["publishedItemIds": n["itemIds"] ?? .array([]), "errors": .array([]), "contentState": .string("live"), "payloadHash": .string(hash), "auditId": .string(request.auditIdentity.dispatchId ?? request.idempotencyKey)])
        default: throw MarketplaceProviderActionAdapterFailure(code: "webflow_fake_action_not_supported", message: "Fake Webflow client does not support this action.")
        }
    }
    private func output(_ request: MarketplaceProviderActionAdapterRequest, _ fields: JSONRecord) -> WebflowProviderActionClientResult {
        WebflowProviderActionClientResult(
            result: ["provider": .string("webflow"), "adapterBoundary": .string("webflow-provider-action-adapter"), "clientMode": .string("fake-webflow-data-v2"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-state-excluded")].merging(fields) { _, new in new })
    }
}

public final class LiveWebflowProviderActionClient: WebflowProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService; private let secrets: SecretService; private let http: any WebflowProviderHTTPClient
    public init(data: LocalDataService, secrets: SecretService, httpClient: any WebflowProviderHTTPClient = URLSessionWebflowProviderHTTPClient()) { self.data = data; self.secrets = secrets; self.http = httpClient }
    public func executeWebflowAction(request: MarketplaceProviderActionAdapterRequest) throws -> WebflowProviderActionClientResult {
        if request.definition.actionKey == "webflow_item_prepare" { return try FakeWebflowProviderActionClient().executeWebflowAction(request: request) }
        let token = try accessToken(request), p = request.payload
        switch request.definition.actionKey {
        case "webflow_site_list": let o = try send("GET", "/v2/sites", [], nil, token).wfObject ?? [:]; return output(["semanticReadContract": .string("webflow-site-list-v1"), "sites": .array((o["sites"]?.wfArray ?? []).prefix(25).map { .object(WebflowProviderActionSupport.site($0)) })])
        case "webflow_site_get":
            let id = try WebflowProviderActionSupport.need(p, "siteId"), v = try send("GET", "/v2/sites/" + WebflowProviderActionSupport.segment(id), [], nil, token); return output(["semanticReadContract": .string("webflow-site-get-v1"), "site": .object(WebflowProviderActionSupport.site(v))])
        case "webflow_collection_list":
            let id = try WebflowProviderActionSupport.need(p, "siteId"), o = try send("GET", "/v2/sites/" + WebflowProviderActionSupport.segment(id) + "/collections", [], nil, token).wfObject ?? [:];
            return output(["semanticReadContract": .string("webflow-collection-list-v1"), "siteId": .string(id), "collections": .array((o["collections"]?.wfArray ?? []).prefix(25).map { .object(WebflowProviderActionSupport.collection($0)) })])
        case "webflow_collection_get":
            let id = try WebflowProviderActionSupport.need(p, "collectionId"), v = try send("GET", "/v2/collections/" + WebflowProviderActionSupport.segment(id), [], nil, token);
            return output(["semanticReadContract": .string("webflow-collection-get-v1"), "collection": .object(WebflowProviderActionSupport.collection(v))])
        case "webflow_collection_items": return try listItems(request, token)
        case "webflow_item_get":
            let c = try WebflowProviderActionSupport.need(p, "collectionId"), i = try WebflowProviderActionSupport.need(p, "itemId"), locale = p["cmsLocaleId"]?.string,
                v = try send("GET", "/v2/collections/" + WebflowProviderActionSupport.segment(c) + "/items/" + WebflowProviderActionSupport.segment(i), locale.map { [URLQueryItem(name: "cmsLocaleId", value: $0)] } ?? [], nil, token)
            ; return output(["semanticReadContract": .string("webflow-item-get-v1"), "item": .object(WebflowProviderActionSupport.item(v))])
        case "webflow_item_update":
            let n = try WebflowProviderActionSupport.normalizedUpdate(p), c = n["collectionId"]!.string!, i = n["itemId"]!.string!, body = try JSONSerialization.data(withJSONObject: WebflowProviderActionSupport.updateBody(n)),
                v = try send("PATCH", "/v2/collections/" + WebflowProviderActionSupport.segment(c) + "/items/" + WebflowProviderActionSupport.segment(i), [URLQueryItem(name: "skipInvalidFiles", value: "false")], body, token), hash = MarketplaceProviderActionApprovalService.payloadHash(n)
            ; return output(["item": .object(WebflowProviderActionSupport.item(v)), "contentState": .string("staged"), "payloadHash": .string(hash), "auditId": .string(request.auditIdentity.dispatchId ?? request.idempotencyKey)])
        case "webflow_item_publish":
            let n = try WebflowProviderActionSupport.normalizedPublish(p), c = n["collectionId"]!.string!, body = try JSONSerialization.data(withJSONObject: WebflowProviderActionSupport.publishBody(n)),
                o = try send("POST", "/v2/collections/" + WebflowProviderActionSupport.segment(c) + "/items/publish", [], body, token).wfObject ?? [:], hash = MarketplaceProviderActionApprovalService.payloadHash(n)
            ;
            return output(["publishedItemIds": o["publishedItemIds"] ?? .array([]), "errors": WebflowProviderActionSupport.safe(o["errors"] ?? .array([])), "contentState": .string("live"), "payloadHash": .string(hash), "auditId": .string(request.auditIdentity.dispatchId ?? request.idempotencyKey)])
        default: throw MarketplaceProviderActionAdapterFailure(code: "webflow_live_action_not_supported", message: "Live Webflow client does not support this action.")
        }
    }
    private func listItems(_ request: MarketplaceProviderActionAdapterRequest, _ token: String) throws -> WebflowProviderActionClientResult {
        let p = request.payload, c = try WebflowProviderActionSupport.need(p, "collectionId"), limit = WebflowProviderActionSupport.bound(p["maxResults"], 10, 25), offset = max(0, Int(p["offset"]?.number ?? 0));
        var query = [URLQueryItem(name: "limit", value: String(limit)), URLQueryItem(name: "offset", value: String(offset))]
        for key in ["cmsLocaleId", "name", "slug", "sortBy", "sortOrder"] { if let v = p[key]?.string, !v.isEmpty { query.append(URLQueryItem(name: key, value: v)) } }
        let o = try send("GET", "/v2/collections/" + WebflowProviderActionSupport.segment(c) + "/items", query, nil, token).wfObject ?? [:]
        return output([
            "semanticReadContract": .string("webflow-collection-items-v1"), "collectionId": .string(c), "items": .array((o["items"]?.wfArray ?? []).prefix(limit).map { .object(WebflowProviderActionSupport.item($0)) }), "pagination": WebflowProviderActionSupport.safe(o["pagination"] ?? .object([:])),
        ])
    }
    private func accessToken(_ request: MarketplaceProviderActionAdapterRequest) throws -> String {
        guard let id = request.auditIdentity.connectionId, let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), connection.appSlug == "webflow",
            let ref = connection.credentialRequirements.first(where: { $0.fieldKey == "webflow_oauth_access_token" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "webflow_connection_not_ready", message: "Webflow connection is not ready.") }
        return try secrets.getSecretValue(ref)
    }
    private func send(_ method: String, _ path: String, _ query: [URLQueryItem], _ body: Data?, _ token: String) throws -> JSONValue {
        var components = URLComponents(string: "https://api.webflow.com" + path); components?.queryItems = query.isEmpty ? nil : query
        guard let url = components?.url else { throw MarketplaceProviderActionAdapterFailure(code: "webflow_invalid_url", message: "Could not build Webflow API URL.") }
        let response = try http.send(WebflowProviderHTTPRequest(method: method, url: url, headers: ["Authorization": "Bearer " + token, "Accept": "application/json", "Content-Type": "application/json"], body: body))
        guard (200..<300).contains(response.statusCode) else {
            let code =
                response.statusCode == 401
                ? "webflow_token_invalid" : response.statusCode == 403 ? "webflow_scope_or_permission_denied" : response.statusCode == 404 ? "webflow_resource_not_found" : response.statusCode == 409 ? "webflow_cms_conflict" : response.statusCode == 429 ? "webflow_rate_limited" : "webflow_http_error"
                ;
            throw MarketplaceProviderActionAdapterFailure(code: code, message: "Webflow API request failed.", providerStatusCode: response.statusCode, detail: ["retryAfter": response.headers.first { $0.key.lowercased() == "retry-after" }.flatMap { Double($0.value) }.map(JSONValue.number) ?? .null])
        }
        return response.body.isEmpty ? .object([:]) : WebflowProviderActionSupport.json(try JSONSerialization.jsonObject(with: response.body))
    }
    private func output(_ fields: JSONRecord) -> WebflowProviderActionClientResult {
        WebflowProviderActionClientResult(
            result: ["provider": .string("webflow"), "adapterBoundary": .string("webflow-provider-action-adapter"), "clientMode": .string("live-webflow-data-v2"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-state-excluded")].merging(fields) { _, new in new })
    }
}

public struct WebflowProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = ["webflow_site_list", "webflow_site_get", "webflow_collection_list", "webflow_collection_get", "webflow_collection_items", "webflow_item_get", "webflow_item_prepare", "webflow_item_update", "webflow_item_publish"]
    private let client: any WebflowProviderActionClient
    public init(client: any WebflowProviderActionClient = FakeWebflowProviderActionClient()) { self.client = client }
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "webflow" else { throw MarketplaceProviderActionAdapterFailure(code: "webflow_wrong_provider", message: "Webflow adapter requires Webflow.") }
        guard Self.allowed.contains(request.definition.actionKey) else { throw MarketplaceProviderActionAdapterFailure(code: "webflow_action_not_allowlisted", message: "Webflow action is outside the V1 allowlist.") }
        return MarketplaceProviderActionAdapterResult(result: try client.executeWebflowAction(request: request).result, error: nil, redactionStatus: "private-state-excluded")
    }
}

public enum WebflowProviderActionSupport {
    public static func need(_ payload: JSONRecord, _ key: String) throws -> String { guard let value = payload[key]?.string?.wfNonEmpty else { throw MarketplaceProviderActionAdapterFailure(code: "webflow_missing_field", message: "Webflow \(key) is required.") }; return value }
    public static func bound(_ value: JSONValue?, _ defaultValue: Int, _ maximum: Int) -> Int { max(1, min(maximum, value?.number.map(Int.init) ?? defaultValue)) }
    public static func normalized(_ p: JSONRecord) throws -> JSONRecord { (p["operation"]?.string ?? "update") == "publish" ? try normalizedPublish(p) : try normalizedUpdate(p) }
    public static func normalizedUpdate(_ p: JSONRecord) throws -> JSONRecord {
        let c = try need(p, "collectionId"), i = try need(p, "itemId"); guard case .object(let raw)? = p["fieldData"], !raw.isEmpty else { throw MarketplaceProviderActionAdapterFailure(code: "webflow_field_data_required", message: "Webflow fieldData is required.") };
        guard raw.count <= 40 else { throw MarketplaceProviderActionAdapterFailure(code: "webflow_field_data_too_large", message: "Webflow fieldData exceeds 40 fields.") }; let forbidden = ["id", "createdOn", "lastUpdated", "lastPublished", "isArchived", "isDraft", "cmsLocaleId"];
        guard raw.keys.allSatisfy({ !forbidden.contains($0) }) else { throw MarketplaceProviderActionAdapterFailure(code: "webflow_system_field_blocked", message: "Webflow system fields cannot be changed through fieldData.") };
        var o: JSONRecord = ["operation": .string("update"), "collectionId": .string(c), "itemId": .string(i), "fieldData": safe(.object(raw))]; if let locale = p["cmsLocaleId"]?.string?.wfNonEmpty { o["cmsLocaleId"] = .string(locale) }; return o
    }
    public static func normalizedPublish(_ p: JSONRecord) throws -> JSONRecord {
        let c = try need(p, "collectionId"); guard case .array(let raw)? = p["itemIds"] else { throw MarketplaceProviderActionAdapterFailure(code: "webflow_item_ids_required", message: "Webflow itemIds are required.") }; let ids = raw.compactMap(\.string).compactMap(\.wfNonEmpty);
        guard !ids.isEmpty, ids.count <= 25, ids.count == raw.count else { throw MarketplaceProviderActionAdapterFailure(code: "webflow_item_ids_invalid", message: "Publish 1 to 25 explicit Webflow item IDs.") };
        return ["operation": .string("publish"), "collectionId": .string(c), "itemIds": .array(ids.map(JSONValue.string))]
    }
    public static func updateBody(_ p: JSONRecord) -> [String: Any] { var body: [String: Any] = ["fieldData": any(p["fieldData"] ?? .object([:]))]; if let locale = p["cmsLocaleId"]?.string { body["cmsLocaleId"] = locale }; return body }
    public static func publishBody(_ p: JSONRecord) -> [String: Any] { ["itemIds": p["itemIds"]?.wfArray?.compactMap(\.string) ?? []] }
    public static func site(_ v: JSONValue) -> JSONRecord {
        let o = v.wfObject ?? [:],
            domains = (o["customDomains"]?.wfArray ?? []).prefix(10).map { value -> JSONValue in
                let d = value.wfObject ?? [:]; return .object(["id": d["id"] ?? .null, "url": d["url"] ?? .null, "lastPublished": d["lastPublished"] ?? .null])
            }
        ;
        return [
            "id": o["id"] ?? .null, "workspaceId": o["workspaceId"] ?? .null, "displayName": o["displayName"] ?? .null, "shortName": o["shortName"] ?? .null, "createdOn": o["createdOn"] ?? .null, "lastUpdated": o["lastUpdated"] ?? .null, "lastPublished": o["lastPublished"] ?? .null,
            "timeZone": o["timeZone"] ?? .null, "customDomains": .array(domains), "locales": safe(o["locales"] ?? .object([:])),
        ]
    }
    public static func collection(_ v: JSONValue) -> JSONRecord {
        let o = v.wfObject ?? [:],
            fields = (o["fields"]?.wfArray ?? []).prefix(40).map { value -> JSONValue in
                let f = value.wfObject ?? [:];
                return .object(["id": f["id"] ?? .null, "type": f["type"] ?? .null, "displayName": f["displayName"] ?? .null, "slug": f["slug"] ?? .null, "isRequired": f["isRequired"] ?? .null, "isEditable": f["isEditable"] ?? .null, "helpText": safe(f["helpText"] ?? .null)])
            }
        ; return ["id": o["id"] ?? .null, "displayName": o["displayName"] ?? .null, "singularName": o["singularName"] ?? .null, "slug": o["slug"] ?? .null, "createdOn": o["createdOn"] ?? .null, "lastUpdated": o["lastUpdated"] ?? .null, "fields": .array(fields)]
    }
    public static func item(_ v: JSONValue) -> JSONRecord {
        let o = v.wfObject ?? [:];
        return [
            "id": o["id"] ?? .null, "cmsLocaleId": o["cmsLocaleId"] ?? .null, "lastPublished": o["lastPublished"] ?? .null, "lastUpdated": o["lastUpdated"] ?? .null, "createdOn": o["createdOn"] ?? .null, "isArchived": o["isArchived"] ?? .null, "isDraft": o["isDraft"] ?? .null,
            "fieldData": safe(o["fieldData"] ?? .object([:])),
        ]
    }
    public static func safe(_ v: JSONValue, depth: Int = 0) -> JSONValue {
        guard depth < 4 else { return .null };
        switch v {
        case .object(let o): return .object(Dictionary(uniqueKeysWithValues: o.prefix(40).map { ($0.key, safe($0.value, depth: depth + 1)) }));
        case .array(let a): return .array(a.prefix(20).map { safe($0, depth: depth + 1) });
        case .string(let s): return .string(String(s.prefix(4000)));
        default: return v
        }
    }
    public static func fakeSite() -> JSONRecord {
        [
            "id": .string("site1"), "workspaceId": .string("workspace1"), "displayName": .string("Relay Marketing"), "shortName": .string("relay-marketing"), "createdOn": .string("2026-07-11T00:00:00Z"), "lastUpdated": .string("2026-07-11T00:00:01Z"),
            "lastPublished": .string("2026-07-11T00:00:00Z"), "timeZone": .string("Europe/London"), "customDomains": .array([.object(["id": .string("domain1"), "url": .string("relay.example")])]),
            "locales": .object(["primary": .object(["cmsLocaleId": .string("locale1"), "displayName": .string("English")])]),
        ]
    }
    public static func fakeCollection(includeFields: Bool) -> JSONRecord {
        [
            "id": .string("collection1"), "displayName": .string("Launch Articles"), "singularName": .string("Launch Article"), "slug": .string("launch-article"), "createdOn": .string("2026-07-11T00:00:00Z"), "lastUpdated": .string("2026-07-11T00:00:01Z"),
            "fields": includeFields ? .array([.object(["id": .string("field1"), "type": .string("PlainText"), "displayName": .string("Summary"), "slug": .string("summary"), "isRequired": .bool(false), "isEditable": .bool(true)])]) : .array([]),
        ]
    }
    public static func fakeItem() -> JSONRecord {
        [
            "id": .string("item1"), "cmsLocaleId": .string("locale1"), "lastPublished": .string("2026-07-11T00:00:00Z"), "lastUpdated": .string("2026-07-11T00:00:01Z"), "createdOn": .string("2026-07-10T00:00:00Z"), "isArchived": .bool(false), "isDraft": .bool(true),
            "fieldData": .object(["name": .string("Relay Launch"), "slug": .string("relay-launch"), "summary": .string("A bounded Webflow CMS update")]),
        ]
    }
    public static func segment(_ s: String) -> String { s.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? s }
    public static func json(_ v: Any) -> JSONValue {
        if let x = v as? String { return .string(x) }; if let x = v as? Bool { return .bool(x) }; if let x = v as? Int { return .number(Double(x)) }; if let x = v as? Double { return .number(x) }; if let x = v as? [String: Any] { return .object(x.mapValues(json)) };
        if let x = v as? [Any] { return .array(x.map(json)) }; return .null
    }
    public static func any(_ v: JSONValue) -> Any { switch v { case .null: return NSNull(); case .string(let x): return x; case .number(let x): return x; case .bool(let x): return x; case .array(let x): return x.map(any); case .object(let x): return x.mapValues(any) } }
}

private extension JSONValue { var wfObject: JSONRecord? { if case .object(let value) = self { return value }; return nil }; var wfArray: [JSONValue]? { if case .array(let value) = self { return value }; return nil } }
private extension String { var wfNonEmpty: String? { let value = trimmingCharacters(in: .whitespacesAndNewlines); return value.isEmpty ? nil : value } }
