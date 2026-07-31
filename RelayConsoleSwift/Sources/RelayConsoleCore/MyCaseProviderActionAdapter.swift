import Foundation

public struct MyCaseProviderHTTPRequest: Sendable {
    public let url: URL
    public let headers: [String: String]
}

public struct MyCaseProviderHTTPResponse: Sendable {
    public let statusCode: Int
    public let body: Data
}

public protocol MyCaseProviderHTTPClient: Sendable {
    func send(_ request: MyCaseProviderHTTPRequest) throws -> MyCaseProviderHTTPResponse
}

private final class MyCaseNoRedirect: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) {
        completionHandler(nil)
    }
}

public struct URLSessionMyCaseProviderHTTPClient: MyCaseProviderHTTPClient {
    public init() {}

    public func send(_ request: MyCaseProviderHTTPRequest) throws -> MyCaseProviderHTTPResponse {
        var value = URLRequest(url: request.url)
        value.httpMethod = "GET"
        value.timeoutInterval = 20
        request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) }
        let session = URLSession(configuration: .ephemeral, delegate: MyCaseNoRedirect(), delegateQueue: nil)
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
            throw MarketplaceProviderActionAdapterFailure(code: "mycase_timeout", message: "MyCase request timed out.")
        }
        session.invalidateAndCancel()
        if let failure { throw failure }
        return MyCaseProviderHTTPResponse(statusCode: status, body: data)
    }
}

public protocol MyCaseProviderActionClient: Sendable {
    func executeMyCaseAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord
}

public struct FakeMyCaseProviderActionClient: MyCaseProviderActionClient {
    public init() {}
    public func executeMyCaseAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        ["provider": .string("mycase"), "action": .string(request.definition.actionKey), "redactionStatus": .string("firm-user-and-legal-practice-data-excluded"), "liveCredentialsUsed": .bool(false)]
    }
}

public final class LiveMyCaseProviderActionClient: MyCaseProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService
    private let secrets: SecretService
    private let http: any MyCaseProviderHTTPClient

    public init(data: LocalDataService, secrets: SecretService, httpClient: any MyCaseProviderHTTPClient = URLSessionMyCaseProviderHTTPClient()) {
        self.data = data
        self.secrets = secrets
        self.http = httpClient
    }

    public func executeMyCaseAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        guard request.definition.actionKey == "mycase_connection_authority_get",
              let connectionId = request.auditIdentity.connectionId,
              let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: connectionId),
              connection.appSlug == "mycase",
              connection.health.diagnostics["apiOrigin"]?.string == "https://external-integrations.mycase.com",
              let tokenRef = connection.credentialRequirements.first(where: { $0.fieldKey == "mycase_access_token" })?.secretReferenceId else {
            throw MarketplaceProviderActionAdapterFailure(code: "mycase_not_ready", message: "MyCase connection is not ready.")
        }
        let token = try secrets.getSecretValue(tokenRef)
        guard !token.isEmpty, token.count <= 30_000, !token.contains("\n"), !token.contains("\r") else {
            throw MarketplaceProviderActionAdapterFailure(code: "mycase_token_invalid", message: "MyCase Open API access token is invalid.")
        }
        let response = try http.send(MyCaseProviderHTTPRequest(
            url: URL(string: "https://external-integrations.mycase.com/v1/firm")!,
            headers: ["Accept": "application/json", "Authorization": "Bearer " + token, "User-Agent": "RelayConsole-MyCase/1.0"]
        ))
        guard response.body.count <= 1_000_000 else {
            throw MarketplaceProviderActionAdapterFailure(code: "mycase_response_too_large", message: "MyCase response exceeded 1 MB.")
        }
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: response.statusCode == 401 ? "mycase_token_invalid" : response.statusCode == 403 || response.statusCode == 404 ? "mycase_permission_denied" : response.statusCode == 429 ? "mycase_rate_limited" : "mycase_api_error", message: "MyCase API request failed.",
                providerStatusCode: response.statusCode)
        }
        guard let root = (try? JSONSerialization.jsonObject(with: response.body)) as? [String: Any] else {
            throw MarketplaceProviderActionAdapterFailure(code: "mycase_response_invalid", message: "MyCase returned invalid JSON.")
        }
        let dataObject = root["data"] as? [String: Any]
        let firmObject = root["firm"] as? [String: Any]
        let firm = dataObject ?? firmObject ?? root
        let numericId = firm["id"] as? NSNumber
        let stringId = firm["id"] as? String
        let validNumeric = numericId.map { $0.int64Value > 0 } ?? false
        let validString = stringId.map { !$0.isEmpty && $0.count <= 64 } ?? false
        guard validNumeric || validString else {
            throw MarketplaceProviderActionAdapterFailure(code: "mycase_response_invalid", message: "MyCase returned no valid authorized-firm authority.")
        }
        return [
            "authorized": .bool(true),
            "apiVersion": .string("v1"),
            "redactionStatus": .string("firm-user-and-legal-practice-data-excluded")
        ]
    }
}

public struct MyCaseProviderActionAdapter: MarketplaceProviderActionAdapter {
    private let client: any MyCaseProviderActionClient
    public init(client: any MyCaseProviderActionClient = FakeMyCaseProviderActionClient()) { self.client = client }
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "mycase" else {
            throw MarketplaceProviderActionAdapterFailure(code: "mycase_not_allowlisted", message: "MyCase action is not allowlisted.")
        }
        return MarketplaceProviderActionAdapterResult(result: try client.executeMyCaseAction(request: request), error: nil, redactionStatus: "firm-user-and-legal-practice-data-excluded")
    }
}
