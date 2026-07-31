import Foundation

public struct ConstantContactProviderHTTPRequest: Sendable {
    public let url: URL
    public let headers: [String: String]
    public init(url: URL, headers: [String: String]) { self.url = url; self.headers = headers }
}

public struct ConstantContactProviderHTTPResponse: Sendable {
    public let statusCode: Int
    public let body: Data
    public init(statusCode: Int, body: Data = Data()) { self.statusCode = statusCode; self.body = body }
}

public protocol ConstantContactProviderHTTPClient: Sendable {
    func send(_ request: ConstantContactProviderHTTPRequest) throws -> ConstantContactProviderHTTPResponse
}

private final class ConstantContactNoRedirect: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}

public struct URLSessionConstantContactProviderHTTPClient: ConstantContactProviderHTTPClient {
    public init() {}
    public func send(_ request: ConstantContactProviderHTTPRequest) throws -> ConstantContactProviderHTTPResponse {
        var value = URLRequest(url: request.url); value.httpMethod = "GET"; value.timeoutInterval = 20
        request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) }
        let session = URLSession(configuration: .ephemeral, delegate: ConstantContactNoRedirect(), delegateQueue: nil)
        let semaphore = DispatchSemaphore(value: 0); var data: Data?; var response: HTTPURLResponse?; var failure: Error?
        let task = session.dataTask(with: value) { data = $0; response = $1 as? HTTPURLResponse; failure = $2; semaphore.signal() }
        task.resume()
        if semaphore.wait(timeout: .now() + 20) == .timedOut { task.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "constant_contact_http_timeout", message: "Constant Contact API request timed out.") }
        session.invalidateAndCancel(); if let failure { throw failure }
        return ConstantContactProviderHTTPResponse(statusCode: response?.statusCode ?? 0, body: data ?? Data())
    }
}

public struct ConstantContactProviderActionClientResult: Sendable {
    public let result: JSONRecord
    public init(result: JSONRecord) { self.result = result }
}

public protocol ConstantContactProviderActionClient: Sendable {
    func executeConstantContactAction(request: MarketplaceProviderActionAdapterRequest) throws -> ConstantContactProviderActionClientResult
}

public struct FakeConstantContactProviderActionClient: ConstantContactProviderActionClient {
    public init() {}
    public func executeConstantContactAction(request: MarketplaceProviderActionAdapterRequest) throws -> ConstantContactProviderActionClientResult {
        switch request.definition.actionKey {
        case "constant_contact_account_get": return output(["semanticReadContract": .string("constant-contact-account-get-v1"), "account": .object(ConstantContactSupport.fakeAccount())])
        case "constant_contact_campaign_list_recent": return output(["semanticReadContract": .string("constant-contact-campaign-list-recent-v1"), "campaigns": .array([.object(ConstantContactSupport.fakeCampaign())])])
        case "constant_contact_campaign_summary_list_recent":
            return output(["semanticReadContract": .string("constant-contact-campaign-summary-list-recent-v1"), "summaries": .array([.object(ConstantContactSupport.fakeSummary())]), "aggregatePercents": .object(ConstantContactSupport.fakePercents())])
        default: throw MarketplaceProviderActionAdapterFailure(code: "constant_contact_fake_action_not_supported", message: "Unsupported Constant Contact action.")
        }
    }
    private func output(_ fields: JSONRecord) -> ConstantContactProviderActionClientResult {
        ConstantContactProviderActionClientResult(
            result: ["provider": .string("constant-contact"), "adapterBoundary": .string("constant-contact-provider-action-adapter"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("contact-and-content-excluded")].merging(fields) { _, new in new })
    }
}

public final class LiveConstantContactProviderActionClient: ConstantContactProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService; private let secrets: SecretService; private let http: any ConstantContactProviderHTTPClient
    public init(data: LocalDataService, secrets: SecretService, httpClient: any ConstantContactProviderHTTPClient = URLSessionConstantContactProviderHTTPClient()) { self.data = data; self.secrets = secrets; self.http = httpClient }

    public func executeConstantContactAction(request: MarketplaceProviderActionAdapterRequest) throws -> ConstantContactProviderActionClientResult {
        let auth = try authorization(request)
        switch request.definition.actionKey {
        case "constant_contact_account_get":
            let object = try get(auth.token, path: "/account/summary", query: []).ccObject ?? [:]
            guard object["encoded_account_id"]?.string == auth.accountId else { throw MarketplaceProviderActionAdapterFailure(code: "constant_contact_account_mismatch", message: "Constant Contact returned a different Account than the selected grant.") }
            return output(["semanticReadContract": .string("constant-contact-account-get-v1"), "account": .object(ConstantContactSupport.account(object))])
        case "constant_contact_campaign_list_recent":
            let root = try get(auth.token, path: "/emails", query: [.init(name: "limit", value: "25")])
            let values = (root.ccObject?["campaigns"]?.ccArray ?? []).prefix(25).map { JSONValue.object(ConstantContactSupport.campaign($0.ccObject ?? [:])) }
            return output(["semanticReadContract": .string("constant-contact-campaign-list-recent-v1"), "campaigns": .array(Array(values))])
        case "constant_contact_campaign_summary_list_recent":
            let root = try get(auth.token, path: "/reports/summary_reports/email_campaign_summaries", query: [.init(name: "limit", value: "25")]), object = root.ccObject ?? [:]
            let values = (object["bulk_email_campaign_summaries"]?.ccArray ?? []).prefix(25).map { JSONValue.object(ConstantContactSupport.summary($0.ccObject ?? [:])) }
            return output(["semanticReadContract": .string("constant-contact-campaign-summary-list-recent-v1"), "summaries": .array(Array(values)), "aggregatePercents": .object(ConstantContactSupport.percents(object["aggregate_percents"]?.ccObject ?? [:]))])
        default: throw MarketplaceProviderActionAdapterFailure(code: "constant_contact_live_action_not_supported", message: "Unsupported live Constant Contact action.")
        }
    }

    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> (token: String, accountId: String) {
        guard let id = request.auditIdentity.connectionId,
              let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id),
              connection.appSlug == "constant-contact",
              connection.grantedScopes == ProviderConnectionService.constantContactRelayOwnedOAuthScopes,
              connection.health.diagnostics["apiOrigin"] == .string("https://api.cc.email/v3"),
              connection.health.diagnostics["requiredPrivilegesVerified"] == .bool(true),
              let accountId = connection.health.diagnostics["encodedAccountId"]?.string,
              ConstantContactSupport.safeAccountId(accountId),
              let reference = connection.credentialRequirements.first(where: { $0.fieldKey == "constant_contact_oauth_access_token" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "constant_contact_connection_not_ready", message: "Constant Contact exact Account, scopes and privileges are not ready.") }
        return (try secrets.getSecretValue(reference), accountId)
    }

    private func get(_ token: String, path: String, query: [URLQueryItem]) throws -> JSONValue {
        var components = URLComponents(string: "https://api.cc.email/v3" + path)!; components.queryItems = query.isEmpty ? nil : query
        let response = try http.send(ConstantContactProviderHTTPRequest(url: components.url!, headers: ["Authorization": "Bearer " + token, "Accept": "application/json"])), value = (try? JSONSerialization.jsonObject(with: response.body)).map(ConstantContactSupport.json) ?? .null
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: response.statusCode == 429 ? "constant_contact_rate_limited" : response.statusCode == 401 ? "constant_contact_token_expired_or_invalid" : response.statusCode == 403 ? "constant_contact_scope_or_privilege_denied" : "constant_contact_api_error",
                message: "Constant Contact API request failed.", providerStatusCode: response.statusCode)
        }
        return value
    }

    private func output(_ fields: JSONRecord) -> ConstantContactProviderActionClientResult {
        ConstantContactProviderActionClientResult(
            result: ["provider": .string("constant-contact"), "adapterBoundary": .string("constant-contact-provider-action-adapter"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("contact-and-content-excluded")].merging(fields) { _, new in new })
    }
}

public struct ConstantContactProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = ["constant_contact_account_get", "constant_contact_campaign_list_recent", "constant_contact_campaign_summary_list_recent"]
    private let client: any ConstantContactProviderActionClient
    public init(client: any ConstantContactProviderActionClient = FakeConstantContactProviderActionClient()) { self.client = client }
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "constant-contact", Self.allowed.contains(request.definition.actionKey) else { throw MarketplaceProviderActionAdapterFailure(code: "constant_contact_action_not_allowlisted", message: "Constant Contact action is outside bounded lifecycle/report V1.") }
        return MarketplaceProviderActionAdapterResult(result: try client.executeConstantContactAction(request: request).result, error: nil, redactionStatus: "contact-and-content-excluded")
    }
}

enum ConstantContactSupport {
    static func safeAccountId(_ value: String) -> Bool { (6...128).contains(value.count) && value.allSatisfy { $0.isLetter || $0.isNumber || $0 == "-" || $0 == "_" } }
    static func account(_ object: JSONRecord) -> JSONRecord { ["AccountId": scalar(object["encoded_account_id"]), "OrganizationName": scalar(object["organization_name"])] }
    static func campaign(_ object: JSONRecord) -> JSONRecord { ["CampaignId": scalar(object["campaign_id"]), "Type": scalar(object["type"]), "CurrentStatus": scalar(object["current_status"]), "CreatedAt": scalar(object["created_at"]), "UpdatedAt": scalar(object["updated_at"])] }
    static func summary(_ object: JSONRecord) -> JSONRecord {
        let counts = object["unique_counts"]?.ccObject ?? [:];
        return [
            "CampaignId": scalar(object["campaign_id"]), "CampaignType": scalar(object["campaign_type"]), "LastSentDate": scalar(object["last_sent_date"]), "Sends": scalar(counts["sends"]), "Opens": scalar(counts["opens"]), "Clicks": scalar(counts["clicks"]), "Forwards": scalar(counts["forwards"]),
            "Optouts": scalar(counts["optouts"]), "Abuse": scalar(counts["abuse"]), "Bounces": scalar(counts["bounces"]), "NotOpened": scalar(counts["not_opened"]),
        ]
    }
    static func percents(_ object: JSONRecord) -> JSONRecord { ["Click": scalar(object["click"]), "Open": scalar(object["open"]), "DidNotOpen": scalar(object["did_not_open"]), "Bounce": scalar(object["bounce"]), "Unsubscribe": scalar(object["unsubscribe"])] }
    static func scalar(_ value: JSONValue?) -> JSONValue { guard let value else { return .null }; switch value { case .string, .number, .bool, .null: return value; default: return .null } }
    static func json(_ any: Any) -> JSONValue {
        if any is NSNull { return .null }; if let value = any as? Bool { return .bool(value) }; if let value = any as? String { return .string(value) }; if let value = any as? NSNumber { return .number(value.doubleValue) }; if let value = any as? [Any] { return .array(value.map(json)) };
        if let value = any as? [String: Any] { return .object(value.mapValues(json)) }; return .null
    }
    static func fakeAccount() -> JSONRecord { ["AccountId": .string("p07e1l8cdif9dl"), "OrganizationName": .string("Relay News")] }
    static func fakeCampaign() -> JSONRecord { ["CampaignId": .string("8987dc1a-48ef-433a-b836-7ca4f9aa3481"), "Type": .string("NEWSLETTER"), "CurrentStatus": .string("Done"), "CreatedAt": .string("2026-07-01T09:00:00Z"), "UpdatedAt": .string("2026-07-10T09:00:00Z")] }
    static func fakeSummary() -> JSONRecord {
        [
            "CampaignId": .string("8987dc1a-48ef-433a-b836-7ca4f9aa3481"), "CampaignType": .string("Newsletter"), "LastSentDate": .string("2026-07-10T09:00:00Z"), "Sends": .number(1000), "Opens": .number(500), "Clicks": .number(120), "Forwards": .number(4), "Optouts": .number(3),
            "Abuse": .number(0), "Bounces": .number(20), "NotOpened": .number(480),
        ]
    }
    static func fakePercents() -> JSONRecord { ["Click": .number(12), "Open": .number(50), "DidNotOpen": .number(48), "Bounce": .number(2), "Unsubscribe": .number(0.3)] }
}

private extension JSONValue {
    var ccObject: JSONRecord? { if case .object(let value) = self { return value }; return nil }
    var ccArray: [JSONValue]? { if case .array(let value) = self { return value }; return nil }
}
