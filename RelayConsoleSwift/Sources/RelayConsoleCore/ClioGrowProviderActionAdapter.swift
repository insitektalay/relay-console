import Foundation

public struct ClioGrowProviderHTTPRequest: Sendable {
    public let url: URL
    public let headers: [String: String]
}

public struct ClioGrowProviderHTTPResponse: Sendable {
    public let statusCode: Int
    public let body: Data
}

public protocol ClioGrowProviderHTTPClient: Sendable {
    func send(_ request: ClioGrowProviderHTTPRequest) throws -> ClioGrowProviderHTTPResponse
}

private final class ClioGrowNoRedirect: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) {
        completionHandler(nil)
    }
}

public struct URLSessionClioGrowProviderHTTPClient: ClioGrowProviderHTTPClient {
    public init() {}
    public func send(_ request: ClioGrowProviderHTTPRequest) throws -> ClioGrowProviderHTTPResponse {
        var value = URLRequest(url: request.url)
        value.httpMethod = "GET"
        value.timeoutInterval = 20
        request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) }
        let session = URLSession(configuration: .ephemeral, delegate: ClioGrowNoRedirect(), delegateQueue: nil)
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
            throw MarketplaceProviderActionAdapterFailure(code: "clio_grow_http_timeout", message: "Clio Grow request timed out.")
        }
        session.invalidateAndCancel()
        if let failure { throw failure }
        return ClioGrowProviderHTTPResponse(statusCode: status, body: data)
    }
}

public protocol ClioGrowProviderActionClient: Sendable {
    func executeClioGrowAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord
}

public struct FakeClioGrowProviderActionClient: ClioGrowProviderActionClient {
    public init() {}
    public func executeClioGrowAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        ["provider": .string("clio-grow"), "action": .string(request.definition.actionKey), "redactionStatus": .string("identity-firm-and-legal-intake-data-excluded"), "liveCredentialsUsed": .bool(false)]
    }
}

public final class LiveClioGrowProviderActionClient: ClioGrowProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService
    private let secrets: SecretService
    private let http: any ClioGrowProviderHTTPClient

    public init(data: LocalDataService, secrets: SecretService, httpClient: any ClioGrowProviderHTTPClient = URLSessionClioGrowProviderHTTPClient()) {
        self.data = data
        self.secrets = secrets
        self.http = httpClient
    }

    public func executeClioGrowAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        guard request.definition.actionKey == "clio_grow_connection_authority_get",
              let connectionId = request.auditIdentity.connectionId,
              let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: connectionId),
              connection.appSlug == "clio-grow",
              connection.health.diagnostics["apiOrigin"]?.string == "https://api.clio.com",
              connection.health.diagnostics["apiRegion"]?.string == "us",
              connection.grantedScopes == ["grow_user_read"],
              let reference = connection.credentialRequirements.first(where: { $0.fieldKey == "clio_grow_oauth_access_token" })?.secretReferenceId else {
            throw MarketplaceProviderActionAdapterFailure(code: "clio_grow_connection_not_ready", message: "Clio Grow US OAuth connection is not ready.")
        }
        let token = try secrets.getSecretValue(reference)
        guard !token.isEmpty, token.count <= 30_000, !token.contains("\n"), !token.contains("\r") else {
            throw MarketplaceProviderActionAdapterFailure(code: "clio_grow_token_invalid", message: "Clio Grow OAuth access token is invalid.")
        }
        let response = try http.send(ClioGrowProviderHTTPRequest(
            url: URL(string: "https://api.clio.com/grow/users/who_am_i")!,
            headers: ["Authorization": "Bearer " + token, "Accept": "application/json", "User-Agent": "RelayConsole-ClioGrow/1.0"]
        ))
        guard response.body.count <= 1_000_000 else {
            throw MarketplaceProviderActionAdapterFailure(code: "clio_grow_response_too_large", message: "Clio Grow response exceeded 1 MB.")
        }
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: response.statusCode == 401 ? "clio_grow_token_invalid" : response.statusCode == 403 ? "clio_grow_permission_denied" : response.statusCode == 429 ? "clio_grow_rate_limited" : "clio_grow_api_error", message: "Clio Grow API request failed.", providerStatusCode: response.statusCode
            )
        }
        guard let root = (try? JSONSerialization.jsonObject(with: response.body)) as? [String: Any],
              let user = root["data"] as? [String: Any],
              let userId = user["id"] as? NSNumber,
              userId.int64Value > 0,
              let account = user["account"] as? [String: Any],
              let accountId = account["id"] as? NSNumber,
              accountId.int64Value > 0 else {
            throw MarketplaceProviderActionAdapterFailure(code: "clio_grow_response_invalid", message: "Clio Grow returned no valid user and account authority.")
        }
        return [
            "authorized": .bool(true),
            "apiRegion": .string("us"),
            "apiVersion": .string("v2"),
            "redactionStatus": .string("identity-firm-and-legal-intake-data-excluded")
        ]
    }
}

public struct ClioGrowProviderActionAdapter: MarketplaceProviderActionAdapter {
    private let client: any ClioGrowProviderActionClient
    public init(client: any ClioGrowProviderActionClient = FakeClioGrowProviderActionClient()) { self.client = client }
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "clio-grow" else {
            throw MarketplaceProviderActionAdapterFailure(code: "clio_grow_action_not_allowlisted", message: "Clio Grow action is not allowlisted.")
        }
        return MarketplaceProviderActionAdapterResult(result: try client.executeClioGrowAction(request: request), error: nil, redactionStatus: "identity-firm-and-legal-intake-data-excluded")
    }
}
