import Foundation

public struct ConvertKitProviderHTTPRequest: Sendable {
    public let url: URL
    public let headers: [String: String]
    public init(url: URL, headers: [String: String]) { self.url = url; self.headers = headers }
}
public struct ConvertKitProviderHTTPResponse: Sendable {
    public let statusCode: Int
    public let body: Data
    public init(statusCode: Int, body: Data = Data()) { self.statusCode = statusCode; self.body = body }
}
public protocol ConvertKitProviderHTTPClient: Sendable {
    func send(_ request: ConvertKitProviderHTTPRequest) throws -> ConvertKitProviderHTTPResponse
}
private final class ConvertKitNoRedirect: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}
public struct URLSessionConvertKitProviderHTTPClient: ConvertKitProviderHTTPClient {
    public init() {}
    public func send(_ request: ConvertKitProviderHTTPRequest) throws -> ConvertKitProviderHTTPResponse {
        var value = URLRequest(url: request.url); value.httpMethod = "GET"; value.timeoutInterval = 20
        request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) }
        let session = URLSession(configuration: .ephemeral, delegate: ConvertKitNoRedirect(), delegateQueue: nil), semaphore = DispatchSemaphore(value: 0)
        var data: Data?, response: HTTPURLResponse?, failure: Error?
        let task = session.dataTask(with: value) { data = $0; response = $1 as? HTTPURLResponse; failure = $2; semaphore.signal() }
        task.resume()
        if semaphore.wait(timeout: .now() + 20) == .timedOut { task.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "convertkit_http_timeout", message: "Kit API request timed out.") }
        session.invalidateAndCancel(); if let failure { throw failure }
        return ConvertKitProviderHTTPResponse(statusCode: response?.statusCode ?? 0, body: data ?? Data())
    }
}

public struct ConvertKitProviderActionClientResult: Sendable { public let result: JSONRecord; public init(result: JSONRecord) { self.result = result } }
public protocol ConvertKitProviderActionClient: Sendable { func executeConvertKitAction(request: MarketplaceProviderActionAdapterRequest) throws -> ConvertKitProviderActionClientResult }

public struct FakeConvertKitProviderActionClient: ConvertKitProviderActionClient {
    public init() {}
    public func executeConvertKitAction(request: MarketplaceProviderActionAdapterRequest) throws -> ConvertKitProviderActionClientResult {
        switch request.definition.actionKey {
        case "convertkit_account_get": return output(["semanticReadContract": .string("convertkit-account-get-v1"), "account": .object(ConvertKitSupport.fakeAccount())])
        case "convertkit_form_list_active": return output(["semanticReadContract": .string("convertkit-form-list-active-v1"), "forms": .array([.object(ConvertKitSupport.fakeForm())])])
        case "convertkit_broadcast_list_recent": return output(["semanticReadContract": .string("convertkit-broadcast-list-recent-v1"), "broadcasts": .array([.object(ConvertKitSupport.fakeBroadcast())])])
        default: throw MarketplaceProviderActionAdapterFailure(code: "convertkit_fake_action_not_supported", message: "Unsupported Kit action.")
        }
    }
    private func output(_ fields: JSONRecord) -> ConvertKitProviderActionClientResult {
        ConvertKitProviderActionClientResult(
            result: ["provider": .string("convertkit"), "providerBrand": .string("Kit"), "adapterBoundary": .string("convertkit-provider-action-adapter"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("subscriber-and-content-excluded")].merging(fields) { _, new in new })
    }
}

public final class LiveConvertKitProviderActionClient: ConvertKitProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService; private let secrets: SecretService; private let http: any ConvertKitProviderHTTPClient
    public init(data: LocalDataService, secrets: SecretService, httpClient: any ConvertKitProviderHTTPClient = URLSessionConvertKitProviderHTTPClient()) { self.data = data; self.secrets = secrets; self.http = httpClient }
    public func executeConvertKitAction(request: MarketplaceProviderActionAdapterRequest) throws -> ConvertKitProviderActionClientResult {
        let token = try authorization(request)
        switch request.definition.actionKey {
        case "convertkit_account_get":
            let root = try get(token, path: "/account", query: []), account = root.ckObject?["account"]?.ckObject ?? [:]
            return output(["semanticReadContract": .string("convertkit-account-get-v1"), "account": .object(ConvertKitSupport.account(account))])
        case "convertkit_form_list_active":
            let root = try get(token, path: "/forms", query: [.init(name: "per_page", value: "20"), .init(name: "status", value: "active")]), source: [JSONValue] = root.ckObject?["forms"]?.ckArray ?? []
            return output(["semanticReadContract": .string("convertkit-form-list-active-v1"), "forms": .array(source.prefix(20).map { JSONValue.object(ConvertKitSupport.form($0.ckObject ?? [:])) })])
        case "convertkit_broadcast_list_recent":
            let root = try get(token, path: "/broadcasts", query: [.init(name: "per_page", value: "20")]), source: [JSONValue] = root.ckObject?["broadcasts"]?.ckArray ?? []
            return output(["semanticReadContract": .string("convertkit-broadcast-list-recent-v1"), "broadcasts": .array(source.prefix(20).map { JSONValue.object(ConvertKitSupport.broadcast($0.ckObject ?? [:])) })])
        default: throw MarketplaceProviderActionAdapterFailure(code: "convertkit_live_action_not_supported", message: "Unsupported live Kit action.")
        }
    }
    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> String {
        guard let id = request.auditIdentity.connectionId, let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), connection.appSlug == "convertkit", connection.grantedScopes == ProviderConnectionService.convertKitRelayOwnedOAuthScopes,
            connection.health.diagnostics["apiOrigin"] == .string("https://api.kit.com/v4"), let ref = connection.credentialRequirements.first(where: { $0.fieldKey == "convertkit_oauth_access_token" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "convertkit_connection_not_ready", message: "Kit exact Account and public scope are not ready.") }
        return try secrets.getSecretValue(ref)
    }
    private func get(_ token: String, path: String, query: [URLQueryItem]) throws -> JSONValue {
        var components = URLComponents(string: "https://api.kit.com/v4" + path)!; components.queryItems = query.isEmpty ? nil : query
        let response = try http.send(ConvertKitProviderHTTPRequest(url: components.url!, headers: ["Authorization": "Bearer " + token, "Accept": "application/json"])), value = (try? JSONSerialization.jsonObject(with: response.body)).map(ConvertKitSupport.json) ?? .null
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(code: response.statusCode == 429 ? "convertkit_rate_limited" : response.statusCode == 401 ? "convertkit_token_expired_or_invalid" : "convertkit_api_error", message: "Kit API request failed.", providerStatusCode: response.statusCode)
        }; return value
    }
    private func output(_ fields: JSONRecord) -> ConvertKitProviderActionClientResult {
        ConvertKitProviderActionClientResult(
            result: ["provider": .string("convertkit"), "providerBrand": .string("Kit"), "adapterBoundary": .string("convertkit-provider-action-adapter"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("subscriber-and-content-excluded")].merging(fields) { _, new in new })
    }
}

public struct ConvertKitProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = ["convertkit_account_get", "convertkit_form_list_active", "convertkit_broadcast_list_recent"]
    private let client: any ConvertKitProviderActionClient
    public init(client: any ConvertKitProviderActionClient = FakeConvertKitProviderActionClient()) { self.client = client }
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "convertkit", Self.allowed.contains(request.definition.actionKey) else { throw MarketplaceProviderActionAdapterFailure(code: "convertkit_action_not_allowlisted", message: "Kit action is outside bounded metadata-only V1.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executeConvertKitAction(request: request).result, error: nil, redactionStatus: "subscriber-and-content-excluded")
    }
}

enum ConvertKitSupport {
    static func account(_ o: JSONRecord) -> JSONRecord { let timezone = o["timezone"]?.ckObject; return ["AccountId": scalar(o["id"]), "Name": scalar(o["name"]), "PlanType": scalar(o["plan_type"]), "CreatedAt": scalar(o["created_at"]), "Timezone": scalar(timezone?["name"])] }
    static func form(_ o: JSONRecord) -> JSONRecord { ["FormId": scalar(o["id"]), "Name": scalar(o["name"]), "CreatedAt": scalar(o["created_at"]), "Type": scalar(o["type"]), "Format": scalar(o["format"]), "Archived": scalar(o["archived"]), "Uid": scalar(o["uid"])] }
    static func broadcast(_ o: JSONRecord) -> JSONRecord { ["BroadcastId": scalar(o["id"]), "PublicationId": scalar(o["publication_id"]), "CreatedAt": scalar(o["created_at"]), "Public": scalar(o["public"]), "PublishedAt": scalar(o["published_at"]), "SendAt": scalar(o["send_at"])] }
    static func scalar(_ v: JSONValue?) -> JSONValue { guard let v else { return .null }; switch v { case .string, .number, .bool, .null: return v; default: return .null } }
    static func json(_ any: Any) -> JSONValue {
        if any is NSNull { return .null }; if let v = any as? Bool { return .bool(v) }; if let v = any as? String { return .string(v) }; if let v = any as? NSNumber { return .number(v.doubleValue) }; if let v = any as? [Any] { return .array(v.map(json)) };
        if let v = any as? [String: Any] { return .object(v.mapValues(json)) }; return .null
    }
    static func fakeAccount() -> JSONRecord { ["AccountId": .number(29), "Name": .string("Relay Creator"), "PlanType": .string("creator"), "CreatedAt": .string("2024-01-01T00:00:00Z"), "Timezone": .string("Europe/London")] }
    static func fakeForm() -> JSONRecord { ["FormId": .number(51), "Name": .string("Updates"), "CreatedAt": .string("2025-01-01T00:00:00Z"), "Type": .string("embed"), "Format": .null, "Archived": .bool(false), "Uid": .string("f049e3d9ab")] }
    static func fakeBroadcast() -> JSONRecord { ["BroadcastId": .number(3), "PublicationId": .number(3), "CreatedAt": .string("2026-07-10T00:00:00Z"), "Public": .bool(false), "PublishedAt": .null, "SendAt": .string("2026-07-11T08:00:00Z")] }
}
private extension JSONValue { var ckObject: JSONRecord? { if case .object(let v) = self { return v }; return nil }; var ckArray: [JSONValue]? { if case .array(let v) = self { return v }; return nil } }
