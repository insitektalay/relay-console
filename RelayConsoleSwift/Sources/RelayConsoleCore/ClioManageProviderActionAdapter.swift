import Foundation

public struct ClioManageProviderHTTPRequest: Sendable {
    public let url: URL
    public let headers: [String: String]
}

public struct ClioManageProviderHTTPResponse: Sendable {
    public let statusCode: Int
    public let body: Data
}

public protocol ClioManageProviderHTTPClient: Sendable {
    func send(_ request: ClioManageProviderHTTPRequest) throws -> ClioManageProviderHTTPResponse
}

private final class ClioManageNoRedirect: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) {
        completionHandler(nil)
    }
}

public struct URLSessionClioManageProviderHTTPClient: ClioManageProviderHTTPClient {
    public init() {}
    public func send(_ request: ClioManageProviderHTTPRequest) throws -> ClioManageProviderHTTPResponse {
        var value = URLRequest(url: request.url)
        value.httpMethod = "GET"
        value.timeoutInterval = 20
        request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) }
        let session = URLSession(configuration: .ephemeral, delegate: ClioManageNoRedirect(), delegateQueue: nil)
        let semaphore = DispatchSemaphore(value: 0)
        var data = Data()
        var status = 0
        var failure: Error?
        let task = session.dataTask(with: value) {
            data = $0 ?? Data()
            status = ($1 as? HTTPURLResponse)?.statusCode ?? 0
            failure = $2
            semaphore.signal()
        }
        task.resume()
        if semaphore.wait(timeout: .now() + 20) == .timedOut {
            task.cancel()
            throw MarketplaceProviderActionAdapterFailure(code: "clio_manage_http_timeout", message: "Clio Manage request timed out.")
        }
        session.invalidateAndCancel()
        if let failure { throw failure }
        return ClioManageProviderHTTPResponse(statusCode: status, body: data)
    }
}

public protocol ClioManageProviderActionClient: Sendable {
    func executeClioManageAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord
}

public struct FakeClioManageProviderActionClient: ClioManageProviderActionClient {
    public init() {}
    public func executeClioManageAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        ["provider": .string("clio-manage"), "action": .string(request.definition.actionKey), "redactionStatus": .string("identity-and-legal-practice-data-excluded"), "liveCredentialsUsed": .bool(false)]
    }
}

public final class LiveClioManageProviderActionClient: ClioManageProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService
    private let secrets: SecretService
    private let http: any ClioManageProviderHTTPClient

    public init(data: LocalDataService, secrets: SecretService, httpClient: any ClioManageProviderHTTPClient = URLSessionClioManageProviderHTTPClient()) {
        self.data = data
        self.secrets = secrets
        self.http = httpClient
    }

    public func executeClioManageAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        guard request.definition.actionKey == "clio_manage_connection_authority_get",
              let connectionId = request.auditIdentity.connectionId,
              let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: connectionId),
              connection.appSlug == "clio-manage",
              connection.health.diagnostics["apiOrigin"]?.string == "https://app.clio.com",
              connection.health.diagnostics["apiRegion"]?.string == "us",
              let reference = connection.credentialRequirements.first(where: { $0.fieldKey == "clio_manage_oauth_access_token" })?.secretReferenceId else {
            throw MarketplaceProviderActionAdapterFailure(code: "clio_manage_connection_not_ready", message: "Clio Manage US OAuth connection is not ready.")
        }
        let token = try secrets.getSecretValue(reference)
        guard !token.isEmpty, token.count <= 30_000, !token.contains("\n"), !token.contains("\r") else {
            throw MarketplaceProviderActionAdapterFailure(code: "clio_manage_token_invalid", message: "Clio Manage OAuth access token is invalid.")
        }
        let response = try http.send(ClioManageProviderHTTPRequest(
            url: URL(string: "https://app.clio.com/api/v4/users/who_am_i?fields=id,enabled")!,
            headers: ["Authorization": "Bearer " + token, "Accept": "application/json", "X-API-VERSION": "4.0.13", "User-Agent": "RelayConsole-ClioManage/1.0"]
        ))
        guard response.body.count <= 1_000_000 else {
            throw MarketplaceProviderActionAdapterFailure(code: "clio_manage_response_too_large", message: "Clio Manage response exceeded 1 MB.")
        }
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: response.statusCode == 401 ? "clio_manage_token_invalid" : response.statusCode == 403 ? "clio_manage_permission_denied" : response.statusCode == 429 ? "clio_manage_rate_limited" : "clio_manage_api_error", message: "Clio Manage API request failed.",
                providerStatusCode: response.statusCode)
        }
        guard let root = (try? JSONSerialization.jsonObject(with: response.body)) as? [String: Any],
              let user = root["data"] as? [String: Any],
              let identifier = user["id"] as? NSNumber,
              identifier.int64Value > 0 else {
            throw MarketplaceProviderActionAdapterFailure(code: "clio_manage_response_invalid", message: "Clio Manage returned no valid authenticated-user authority.")
        }
        return [
            "authorized": .bool(true),
            "userEnabled": .bool(user["enabled"] as? Bool == true),
            "apiRegion": .string("us"),
            "apiVersion": .string("4.0.13"),
            "redactionStatus": .string("identity-and-legal-practice-data-excluded")
        ]
    }
}

public struct ClioManageProviderActionAdapter: MarketplaceProviderActionAdapter {
    private let client: any ClioManageProviderActionClient
    public init(client: any ClioManageProviderActionClient = FakeClioManageProviderActionClient()) { self.client = client }
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "clio-manage" else {
            throw MarketplaceProviderActionAdapterFailure(code: "clio_manage_action_not_allowlisted", message: "Clio Manage action is not allowlisted.")
        }
        return MarketplaceProviderActionAdapterResult(result: try client.executeClioManageAction(request: request), error: nil, redactionStatus: "identity-and-legal-practice-data-excluded")
    }
}
