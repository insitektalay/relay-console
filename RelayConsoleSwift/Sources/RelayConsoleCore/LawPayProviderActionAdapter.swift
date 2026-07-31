import Foundation

public struct LawPayProviderHTTPRequest: Sendable { public let url: URL; public let headers: [String: String] }
public struct LawPayProviderHTTPResponse: Sendable { public let statusCode: Int; public let body: Data }
public protocol LawPayProviderHTTPClient: Sendable { func send(_ request: LawPayProviderHTTPRequest) throws -> LawPayProviderHTTPResponse }

private final class LawPayNoRedirect: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}

public struct URLSessionLawPayProviderHTTPClient: LawPayProviderHTTPClient {
    public init() {}
    public func send(_ request: LawPayProviderHTTPRequest) throws -> LawPayProviderHTTPResponse {
        var value = URLRequest(url: request.url); value.httpMethod = "GET"; value.timeoutInterval = 20
        request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) }
        let session = URLSession(configuration: .ephemeral, delegate: LawPayNoRedirect(), delegateQueue: nil), semaphore = DispatchSemaphore(value: 0)
        var data = Data(); var status = 0; var failure: Error?
        let task = session.dataTask(with: value) { data = $0 ?? Data(); status = ($1 as? HTTPURLResponse)?.statusCode ?? 0; failure = $2; semaphore.signal() }
        task.resume()
        if semaphore.wait(timeout: .now() + 20) == .timedOut { task.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "lawpay_timeout", message: "LawPay request timed out.") }
        session.invalidateAndCancel(); if let failure { throw failure }
        return LawPayProviderHTTPResponse(statusCode: status, body: data)
    }
}

public protocol LawPayProviderActionClient: Sendable { func executeLawPayAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord }
public struct FakeLawPayProviderActionClient: LawPayProviderActionClient {
    public init() {}
    public func executeLawPayAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        ["provider": .string("lawpay"), "action": .string(request.definition.actionKey), "redactionStatus": .string("merchant-identity-account-keys-trust-payment-and-legal-practice-data-excluded"), "liveCredentialsUsed": .bool(false)]
    }
}

public final class LiveLawPayProviderActionClient: LawPayProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService; private let secrets: SecretService; private let http: any LawPayProviderHTTPClient
    public init(data: LocalDataService, secrets: SecretService, httpClient: any LawPayProviderHTTPClient = URLSessionLawPayProviderHTTPClient()) { self.data = data; self.secrets = secrets; self.http = httpClient }
    public func executeLawPayAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        guard request.definition.actionKey == "lawpay_connection_authority_get", let connectionId = request.auditIdentity.connectionId, let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: connectionId), connection.appSlug == "lawpay",
            connection.health.diagnostics["apiOrigin"]?.string == "https://api.8am.com", connection.health.diagnostics["platform"]?.string == "8am-lawpay", connection.grantedScopes.contains("payments"),
            let accessReference = connection.credentialRequirements.first(where: { $0.fieldKey == "lawpay_oauth_access_token" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "lawpay_not_ready", message: "LawPay OAuth connection is not ready.") }
        let accessToken = try secrets.getSecretValue(accessReference)
        guard !accessToken.isEmpty, accessToken.count <= 30_000, !accessToken.contains("\n"), !accessToken.contains("\r") else { throw MarketplaceProviderActionAdapterFailure(code: "lawpay_token_invalid", message: "LawPay OAuth credentials are invalid.") }
        let response = try http.send(LawPayProviderHTTPRequest(url: URL(string: "https://api.8am.com/gateway-credentials")!, headers: ["Authorization": "Bearer " + accessToken, "Accept": "application/json", "User-Agent": "RelayConsole-LawPay/1.0"]))
        guard response.body.count <= 65_536 else { throw MarketplaceProviderActionAdapterFailure(code: "lawpay_response_too_large", message: "LawPay response exceeded 64 KB.") }
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: response.statusCode == 401 ? "lawpay_token_invalid" : response.statusCode == 403 || response.statusCode == 404 ? "lawpay_permission_denied" : response.statusCode == 429 ? "lawpay_rate_limited" : "lawpay_api_error", message: "LawPay API request failed.",
                providerStatusCode: response.statusCode)
        }
        guard let object = try? JSONSerialization.jsonObject(with: response.body) as? [String: Any], object["application"] is String, object["user"] is [String: Any], object["merchant"] is [String: Any], object["test_accounts"] is [Any], object["live_accounts"] is [Any] else {
            throw MarketplaceProviderActionAdapterFailure(code: "lawpay_response_invalid", message: "LawPay returned an invalid gateway-credentials authority response.")
        }
        return ["authorized": .bool(true), "platform": .string("8am-lawpay"), "apiVersion": .string("v1"), "redactionStatus": .string("merchant-identity-account-keys-trust-payment-and-legal-practice-data-excluded")]
    }
}

public struct LawPayProviderActionAdapter: MarketplaceProviderActionAdapter {
    private let client: any LawPayProviderActionClient
    public init(client: any LawPayProviderActionClient = FakeLawPayProviderActionClient()) { self.client = client }
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "lawpay" else { throw MarketplaceProviderActionAdapterFailure(code: "lawpay_not_allowlisted", message: "LawPay action is not allowlisted.") }
        return MarketplaceProviderActionAdapterResult(result: try client.executeLawPayAction(request: request), error: nil, redactionStatus: "merchant-identity-account-keys-trust-payment-and-legal-practice-data-excluded")
    }
}
