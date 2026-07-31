import Foundation

public struct DropboxSignProviderHTTPRequest: Sendable { public let url: URL; public let headers: [String: String]; public init(url: URL, headers: [String: String]) { self.url = url; self.headers = headers } }
public struct DropboxSignProviderHTTPResponse: Sendable {
    public let statusCode: Int; public let headers: [String: String]; public let body: Data; public init(statusCode: Int, headers: [String: String] = [:], body: Data = Data()) { self.statusCode = statusCode; self.headers = headers; self.body = body }
}
public protocol DropboxSignProviderHTTPClient: Sendable { func send(_ request: DropboxSignProviderHTTPRequest) throws -> DropboxSignProviderHTTPResponse }
private final class DropboxSignNoRedirectDelegate: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}
public struct URLSessionDropboxSignProviderHTTPClient: DropboxSignProviderHTTPClient {
    public init() {}
    public func send(_ request: DropboxSignProviderHTTPRequest) throws -> DropboxSignProviderHTTPResponse {
        var value = URLRequest(url: request.url); value.httpMethod = "GET"; value.timeoutInterval = 20; request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) };
        let session = URLSession(configuration: .ephemeral, delegate: DropboxSignNoRedirectDelegate(), delegateQueue: nil), semaphore = DispatchSemaphore(value: 0); var data: Data?, response: HTTPURLResponse?, failure: Error?;
        let task = session.dataTask(with: value) {
            data = $0; response = $1 as? HTTPURLResponse; failure = $2; semaphore.signal()
        }; task.resume(); if semaphore.wait(timeout: .now() + 20) == .timedOut { task.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "dropbox_sign_http_timeout", message: "Dropbox Sign API v3 request timed out.") }; session.invalidateAndCancel(); if let failure { throw failure };
        return DropboxSignProviderHTTPResponse(statusCode: response?.statusCode ?? 0, headers: response?.allHeaderFields.reduce(into: [:]) { $0[String(describing: $1.key)] = String(describing: $1.value) } ?? [:], body: data ?? Data())
    }
}

public struct DropboxSignProviderActionClientResult: Sendable { public let result: JSONRecord; public init(result: JSONRecord) { self.result = result } }
public protocol DropboxSignProviderActionClient: Sendable { func executeDropboxSignAction(request: MarketplaceProviderActionAdapterRequest) throws -> DropboxSignProviderActionClientResult }
public struct FakeDropboxSignProviderActionClient: DropboxSignProviderActionClient {
    public init() {}
    public func executeDropboxSignAction(request: MarketplaceProviderActionAdapterRequest) throws -> DropboxSignProviderActionClientResult {
        switch request.definition.actionKey {
        case "dropbox_sign_signature_request_list": return output(["semanticReadContract": .string("dropbox-sign-signature-request-list-v1"), "signatureRequests": .array([.object(DropboxSignProviderActionSupport.fakeRequest())])]);
        case "dropbox_sign_signature_request_list_awaiting": return output(["semanticReadContract": .string("dropbox-sign-signature-request-list-awaiting-v1"), "signatureRequests": .array([.object(DropboxSignProviderActionSupport.fakeRequest())])]);
        case "dropbox_sign_signature_request_get": return output(["semanticReadContract": .string("dropbox-sign-signature-request-get-v1"), "signatureRequest": .object(DropboxSignProviderActionSupport.fakeRequest())]);
        default: throw MarketplaceProviderActionAdapterFailure(code: "dropbox_sign_fake_action_not_supported", message: "Unsupported Dropbox Sign action.")
        }
    }
    private func output(_ fields: JSONRecord) -> DropboxSignProviderActionClientResult {
        DropboxSignProviderActionClientResult(
            result: ["provider": .string("dropbox-sign"), "adapterBoundary": .string("dropbox-sign-provider-action-adapter"), "clientMode": .string("fake-dropbox-sign-api-v3"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-signature-request-state-excluded")].merging(
                fields
            ) { _, new in new })
    }
}

public final class LiveDropboxSignProviderActionClient: DropboxSignProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService; private let secrets: SecretService; private let http: any DropboxSignProviderHTTPClient
    public init(data: LocalDataService, secrets: SecretService, httpClient: any DropboxSignProviderHTTPClient = URLSessionDropboxSignProviderHTTPClient()) { self.data = data; self.secrets = secrets; self.http = httpClient }
    public func executeDropboxSignAction(request: MarketplaceProviderActionAdapterRequest) throws -> DropboxSignProviderActionClientResult {
        let token = try authorization(request)
        switch request.definition.actionKey {
        case "dropbox_sign_signature_request_list", "dropbox_sign_signature_request_list_awaiting":
            let awaiting = request.definition.actionKey == "dropbox_sign_signature_request_list_awaiting", root = try get(token, path: "/signature_request/list", query: DropboxSignProviderActionSupport.listQuery(awaiting: awaiting)),
                values = (root.dropboxSignObject?["signature_requests"]?.dropboxSignArray ?? []).prefix(25).map { JSONValue.object(DropboxSignProviderActionSupport.signatureRequest($0)) }
            return output(["semanticReadContract": .string(awaiting ? "dropbox-sign-signature-request-list-awaiting-v1" : "dropbox-sign-signature-request-list-v1"), "signatureRequests": .array(Array(values))])
        case "dropbox_sign_signature_request_get":
            let id = try DropboxSignProviderActionSupport.identifier(request.payload["signatureRequestId"]), root = try get(token, path: "/signature_request/" + id, query: []), value = root.dropboxSignObject?["signature_request"] ?? root
            return output(["semanticReadContract": .string("dropbox-sign-signature-request-get-v1"), "signatureRequest": .object(DropboxSignProviderActionSupport.signatureRequest(value))])
        default: throw MarketplaceProviderActionAdapterFailure(code: "dropbox_sign_live_action_not_supported", message: "Unsupported live Dropbox Sign action.")
        }
    }
    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> String {
        guard let id = request.auditIdentity.connectionId, let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), connection.appSlug == "dropbox-sign", connection.grantedScopes == ProviderConnectionService.dropboxSignRelayOwnedOAuthScopes,
            let accountId = connection.health.diagnostics["accountId"]?.string, DropboxSignProviderActionSupport.safeAccountId(accountId), let ref = connection.credentialRequirements.first(where: { $0.fieldKey == "dropbox_sign_oauth_access_token" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "dropbox_sign_connection_not_ready", message: "Dropbox Sign exact-account connection is not ready.") }; return try secrets.getSecretValue(ref)
    }
    private func get(_ token: String, path: String, query: [URLQueryItem]) throws -> JSONValue {
        var components = URLComponents(string: "https://api.hellosign.com/v3" + path)!; components.queryItems = query.isEmpty ? nil : query;
        let response = try http.send(DropboxSignProviderHTTPRequest(url: components.url!, headers: ["Authorization": "Bearer " + token, "Accept": "application/json"])), value = (try? JSONSerialization.jsonObject(with: response.body)).map(DropboxSignProviderActionSupport.json) ?? .null;
        guard (200..<300).contains(response.statusCode) else {
            let code =
                response.statusCode == 301 || response.statusCode == 302
                ? "dropbox_sign_redirect_blocked"
                : response.statusCode == 401
                    ? "dropbox_sign_token_invalid_or_expired"
                    : response.statusCode == 402
                        ? "dropbox_sign_plan_required" : response.statusCode == 403 ? "dropbox_sign_scope_or_account_forbidden" : response.statusCode == 404 ? "dropbox_sign_signature_request_not_found" : response.statusCode == 429 ? "dropbox_sign_rate_limited" : "dropbox_sign_api_error";
            throw MarketplaceProviderActionAdapterFailure(
                code: code, message: "Dropbox Sign API v3 request failed.", providerStatusCode: response.statusCode, detail: ["rateLimitRemaining": response.headers.first { $0.key.lowercased() == "x-ratelimit-remaining" }.map { .string(String($0.value.prefix(32))) } ?? .null])
        }; return value
    }
    private func output(_ fields: JSONRecord) -> DropboxSignProviderActionClientResult {
        DropboxSignProviderActionClientResult(
            result: ["provider": .string("dropbox-sign"), "adapterBoundary": .string("dropbox-sign-provider-action-adapter"), "clientMode": .string("live-dropbox-sign-api-v3"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-signature-request-state-excluded")].merging(
                fields
            ) { _, new in new })
    }
}

public struct DropboxSignProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = ["dropbox_sign_signature_request_list", "dropbox_sign_signature_request_list_awaiting", "dropbox_sign_signature_request_get"]
    private let client: any DropboxSignProviderActionClient
    public init(client: any DropboxSignProviderActionClient = FakeDropboxSignProviderActionClient()) { self.client = client }
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "dropbox-sign", Self.allowed.contains(request.definition.actionKey) else { throw MarketplaceProviderActionAdapterFailure(code: "dropbox_sign_action_not_allowlisted", message: "Dropbox Sign action is outside bounded read-only Signature Request V1.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executeDropboxSignAction(request: request).result, error: nil, redactionStatus: "private-signature-request-state-excluded")
    }
}

enum DropboxSignProviderActionSupport {
    static func listQuery(awaiting: Bool) -> [URLQueryItem] { var result = [URLQueryItem(name: "page", value: "1"), URLQueryItem(name: "page_size", value: "25")]; if awaiting { result.append(URLQueryItem(name: "query", value: "awaiting_my_signature:true")) }; return result }
    static func identifier(_ value: JSONValue?) throws -> String {
        guard let raw = value?.string, raw.count >= 24, raw.count <= 64, raw.allSatisfy(\.isHexDigit) else { throw MarketplaceProviderActionAdapterFailure(code: "dropbox_sign_signature_request_id_invalid", message: "An exact safe hexadecimal Dropbox Sign Signature Request ID is required.") };
        return raw.lowercased()
    }
    static func safeAccountId(_ raw: String) -> Bool { raw.count >= 24 && raw.count <= 64 && raw.allSatisfy(\.isHexDigit) }
    static func signatureRequest(_ value: JSONValue) -> JSONRecord {
        let object = value.dropboxSignObject ?? [:], signatures = object["signatures"]?.dropboxSignArray ?? []; var counts: [String: Double] = [:];
        for signature in signatures { if let status = signature.dropboxSignObject?["status_code"]?.string, safeStatus(status) { counts[status, default: 0] += 1 } };
        return [
            "SignatureRequestId": scalar(object["signature_request_id"]), "Title": scalar(object["title"]), "Subject": scalar(object["subject"]), "CreatedAtEpoch": scalar(object["created_at"]), "ExpiresAtEpoch": scalar(object["expires_at"]), "IsComplete": scalar(object["is_complete"]),
            "IsDeclined": scalar(object["is_declined"]), "HasError": scalar(object["has_error"]), "TestMode": scalar(object["test_mode"]), "SignatureCount": .number(Double(signatures.count)), "SignatureStatusCounts": .object(counts.mapValues(JSONValue.number)),
        ]
    }
    static func safeStatus(_ value: String) -> Bool { ["success", "on_hold", "signed", "awaiting_signature", "declined", "error_unknown", "error_file", "error_component_position", "error_text_tag", "on_hold_by_requester", "error_invalid_email", "expired"].contains(value) }
    static func scalar(_ value: JSONValue?) -> JSONValue { guard let value else { return .null }; switch value { case .string, .number, .bool, .null: return value; default: return .null } }
    static func json(_ any: Any) -> JSONValue {
        if any is NSNull { return .null }; if let value = any as? Bool { return .bool(value) }; if let value = any as? String { return .string(value) }; if let value = any as? NSNumber { return .number(value.doubleValue) }; if let value = any as? [Any] { return .array(value.map(json)) };
        if let value = any as? [String: Any] { return .object(value.mapValues(json)) }; return .null
    }
    static func fakeRequest() -> JSONRecord {
        [
            "SignatureRequestId": .string("d10338cad145e1cb68afc828"), "Title": .string("Relay agreement"), "Subject": .string("Please review"), "CreatedAtEpoch": .number(1_783_763_200), "ExpiresAtEpoch": .null, "IsComplete": .bool(false), "IsDeclined": .bool(false), "HasError": .bool(false),
            "TestMode": .bool(false), "SignatureCount": .number(1), "SignatureStatusCounts": .object(["awaiting_signature": .number(1)]),
        ]
    }
}

private extension JSONValue { var dropboxSignObject: JSONRecord? { if case .object(let value) = self { return value }; return nil }; var dropboxSignArray: [JSONValue]? { if case .array(let value) = self { return value }; return nil } }
