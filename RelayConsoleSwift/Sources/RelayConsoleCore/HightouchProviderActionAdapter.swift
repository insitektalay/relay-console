import Foundation

public struct HightouchProviderHTTPRequest: Sendable {
    public let url: URL
    public let headers: [String: String]
}

public struct HightouchProviderHTTPResponse: Sendable {
    public let statusCode: Int
    public let body: Data
}

public protocol HightouchProviderHTTPClient: Sendable {
    func send(_ request: HightouchProviderHTTPRequest) throws -> HightouchProviderHTTPResponse
}

private final class HightouchNoRedirect: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(
        _ session: URLSession,
        task: URLSessionTask,
        willPerformHTTPRedirection response: HTTPURLResponse,
        newRequest request: URLRequest,
        completionHandler: @escaping (URLRequest?) -> Void
    ) {
        completionHandler(nil)
    }
}

public struct URLSessionHightouchProviderHTTPClient: HightouchProviderHTTPClient {
    public init() {}

    public func send(_ request: HightouchProviderHTTPRequest) throws -> HightouchProviderHTTPResponse {
        var value = URLRequest(url: request.url)
        value.httpMethod = "GET"
        value.timeoutInterval = 30
        request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) }
        let session = URLSession(
            configuration: .ephemeral,
            delegate: HightouchNoRedirect(),
            delegateQueue: nil
        )
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
        if semaphore.wait(timeout: .now() + 30) == .timedOut {
            task.cancel()
            throw MarketplaceProviderActionAdapterFailure(
                code: "hightouch_timeout",
                message: "Hightouch timed out."
            )
        }
        session.invalidateAndCancel()
        if let failure { throw failure }
        return HightouchProviderHTTPResponse(statusCode: status, body: data)
    }
}

public protocol HightouchProviderActionClient: Sendable {
    func executeHightouchAction(
        request: MarketplaceProviderActionAdapterRequest
    ) throws -> JSONRecord
}

public struct FakeHightouchProviderActionClient: HightouchProviderActionClient {
    public init() {}

    public func executeHightouchAction(
        request: MarketplaceProviderActionAdapterRequest
    ) throws -> JSONRecord {
        [
            "provider": .string("hightouch"),
            "action": .string(request.definition.actionKey),
            "liveCredentialsUsed": .bool(false)
        ]
    }
}

public final class LiveHightouchProviderActionClient: HightouchProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService
    private let secrets: SecretService
    private let http: any HightouchProviderHTTPClient

    public init(
        data: LocalDataService,
        secrets: SecretService,
        httpClient: any HightouchProviderHTTPClient = URLSessionHightouchProviderHTTPClient()
    ) {
        self.data = data
        self.secrets = secrets
        self.http = httpClient
    }

    public func executeHightouchAction(
        request: MarketplaceProviderActionAdapterRequest
    ) throws -> JSONRecord {
        guard request.definition.actionKey == "hightouch_model_readiness_summary_get",
              let connectionId = request.auditIdentity.connectionId,
              let connection = try data.getProviderConnection(
                workspaceId: request.context.workspaceId,
                connectionId: connectionId
              ),
              connection.appSlug == "hightouch",
              let keyRef = connection.credentialRequirements.first(where: {
                $0.fieldKey == "hightouch_api_key"
              })?.secretReferenceId else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "hightouch_not_ready",
                message: "Hightouch connection is not ready."
            )
        }
        let apiKey = try secrets.getSecretValue(keyRef)
        guard !apiKey.isEmpty,
              apiKey.count <= 30_000,
              !apiKey.contains("\n"),
              !apiKey.contains("\r") else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "hightouch_key_invalid",
                message: "Hightouch API key is invalid."
            )
        }
        let response = try http.send(
            HightouchProviderHTTPRequest(
                url: URL(string: "https://api.hightouch.com/api/v1/models")!,
                headers: [
                    "Accept": "application/json",
                    "Authorization": "Bearer " + apiKey,
                    "User-Agent": "RelayConsole-Hightouch/1.0"
                ]
            )
        )
        guard response.body.count <= 1_000_000 else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "hightouch_response_too_large",
                message: "Hightouch response exceeds 1 MB."
            )
        }
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: response.statusCode == 401
                    ? "hightouch_key_invalid"
                    : response.statusCode == 403 || response.statusCode == 404
                        ? "hightouch_permission_denied"
                        : response.statusCode == 429
                            ? "hightouch_rate_limited"
                            : "hightouch_api_error",
                message: "Hightouch API request failed.",
                providerStatusCode: response.statusCode
            )
        }
        guard let any = try? JSONSerialization.jsonObject(with: response.body) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "hightouch_response_invalid",
                message: "Hightouch returned invalid JSON."
            )
        }
        let models: [Any]
        if let array = any as? [Any] {
            models = array
        } else if let object = any as? [String: Any],
                  let array = (object["data"] as? [Any]) ?? (object["models"] as? [Any]) {
            models = array
        } else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "hightouch_response_invalid",
                message: "Hightouch returned an unexpected model-list shape."
            )
        }
        return [
            "modelCount": .number(Double(models.count)),
            "redactionStatus": .string(
                "model-identity-definition-query-source-destination-sync-run-and-customer-data-excluded"
            )
        ]
    }
}

public struct HightouchProviderActionAdapter: MarketplaceProviderActionAdapter {
    private let client: any HightouchProviderActionClient

    public init(
        client: any HightouchProviderActionClient = FakeHightouchProviderActionClient()
    ) {
        self.client = client
    }

    public func execute(
        request: MarketplaceProviderActionAdapterRequest
    ) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "hightouch" else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "hightouch_not_allowlisted",
                message: "Hightouch action is not allowlisted."
            )
        }
        return MarketplaceProviderActionAdapterResult(
            result: try client.executeHightouchAction(request: request),
            error: nil,
            redactionStatus:
                "model-identity-definition-query-source-destination-sync-run-and-customer-data-excluded"
        )
    }
}
