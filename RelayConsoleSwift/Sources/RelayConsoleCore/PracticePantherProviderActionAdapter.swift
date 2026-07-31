import Foundation

public struct PracticePantherProviderHTTPRequest: Sendable { public let url: URL; public let headers: [String: String] }
public struct PracticePantherProviderHTTPResponse: Sendable { public let statusCode: Int; public let body: Data }
public protocol PracticePantherProviderHTTPClient: Sendable { func send(_ request: PracticePantherProviderHTTPRequest) throws -> PracticePantherProviderHTTPResponse }

private final class PracticePantherNoRedirect: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}

public struct URLSessionPracticePantherProviderHTTPClient: PracticePantherProviderHTTPClient {
    public init() {}
    public func send(_ request: PracticePantherProviderHTTPRequest) throws -> PracticePantherProviderHTTPResponse {
        var value = URLRequest(url: request.url); value.httpMethod = "GET"; value.timeoutInterval = 20
        request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) }
        let session = URLSession(configuration: .ephemeral, delegate: PracticePantherNoRedirect(), delegateQueue: nil), semaphore = DispatchSemaphore(value: 0)
        var data = Data(); var status = 0; var failure: Error?
        let task = session.dataTask(with: value) { data = $0 ?? Data(); status = ($1 as? HTTPURLResponse)?.statusCode ?? 0; failure = $2; semaphore.signal() }
        task.resume()
        if semaphore.wait(timeout: .now() + 20) == .timedOut { task.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "practicepanther_timeout", message: "PracticePanther request timed out.") }
        session.invalidateAndCancel(); if let failure { throw failure }
        return PracticePantherProviderHTTPResponse(statusCode: status, body: data)
    }
}

public protocol PracticePantherProviderActionClient: Sendable { func executePracticePantherAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord }
public struct FakePracticePantherProviderActionClient: PracticePantherProviderActionClient {
    public init() {}
    public func executePracticePantherAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        ["provider": .string("practicepanther"), "action": .string(request.definition.actionKey), "redactionStatus": .string("identity-firm-legal-practice-time-and-financial-data-excluded"), "liveCredentialsUsed": .bool(false)]
    }
}

public final class LivePracticePantherProviderActionClient: PracticePantherProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService; private let secrets: SecretService; private let http: any PracticePantherProviderHTTPClient
    public init(data: LocalDataService, secrets: SecretService, httpClient: any PracticePantherProviderHTTPClient = URLSessionPracticePantherProviderHTTPClient()) { self.data = data; self.secrets = secrets; self.http = httpClient }
    public func executePracticePantherAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        guard request.definition.actionKey == "practicepanther_connection_authority_get", let connectionId = request.auditIdentity.connectionId, let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: connectionId),
            connection.appSlug == "practicepanther", connection.health.diagnostics["apiOrigin"]?.string == "https://app.practicepanther.com", connection.grantedScopes.isEmpty,
            let reference = connection.credentialRequirements.first(where: { $0.fieldKey == "practicepanther_oauth_access_token" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "practicepanther_not_ready", message: "PracticePanther OAuth connection is not ready.") }
        let token = try secrets.getSecretValue(reference)
        guard !token.isEmpty, token.count <= 30_000, !token.contains("\n"), !token.contains("\r") else { throw MarketplaceProviderActionAdapterFailure(code: "practicepanther_token_invalid", message: "PracticePanther OAuth access token is invalid.") }
        let response = try http.send(PracticePantherProviderHTTPRequest(url: URL(string: "https://app.practicepanther.com/api/TimeEntry/$count")!, headers: ["Authorization": "Bearer " + token, "Accept": "text/plain, application/json", "User-Agent": "RelayConsole-PracticePanther/1.0"]))
        guard response.body.count <= 65_536 else { throw MarketplaceProviderActionAdapterFailure(code: "practicepanther_response_too_large", message: "PracticePanther response exceeded 64 KB.") }
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: response.statusCode == 401 ? "practicepanther_token_invalid" : response.statusCode == 403 || response.statusCode == 404 ? "practicepanther_permission_denied" : response.statusCode == 429 ? "practicepanther_rate_limited" : "practicepanther_api_error",
                message: "PracticePanther API request failed.", providerStatusCode: response.statusCode)
        }
        let value = String(data: response.body, encoding: .utf8)?.trimmingCharacters(in: CharacterSet(charactersIn: "\" \n\r\t")) ?? ""
        guard let count = UInt64(value), String(count) == value else { throw MarketplaceProviderActionAdapterFailure(code: "practicepanther_response_invalid", message: "PracticePanther returned an invalid authority response.") }
        return ["authorized": .bool(true), "apiVersion": .string("v1"), "redactionStatus": .string("identity-firm-legal-practice-time-and-financial-data-excluded")]
    }
}

public struct PracticePantherProviderActionAdapter: MarketplaceProviderActionAdapter {
    private let client: any PracticePantherProviderActionClient
    public init(client: any PracticePantherProviderActionClient = FakePracticePantherProviderActionClient()) { self.client = client }
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "practicepanther" else { throw MarketplaceProviderActionAdapterFailure(code: "practicepanther_not_allowlisted", message: "PracticePanther action is not allowlisted.") }
        return MarketplaceProviderActionAdapterResult(result: try client.executePracticePantherAction(request: request), error: nil, redactionStatus: "identity-firm-legal-practice-time-and-financial-data-excluded")
    }
}
