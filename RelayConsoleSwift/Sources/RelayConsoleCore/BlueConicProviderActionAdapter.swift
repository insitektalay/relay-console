import Foundation

public struct BlueConicProviderHTTPRequest: Sendable {
    public let method: String
    public let url: URL
    public let headers: [String: String]
    public let body: Data?
}

public struct BlueConicProviderHTTPResponse: Sendable {
    public let statusCode: Int
    public let body: Data
}

public protocol BlueConicProviderHTTPClient: Sendable {
    func send(_ request: BlueConicProviderHTTPRequest) throws -> BlueConicProviderHTTPResponse
}

private final class BlueConicNoRedirect: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
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

public struct URLSessionBlueConicProviderHTTPClient: BlueConicProviderHTTPClient {
    public init() {}

    public func send(_ request: BlueConicProviderHTTPRequest) throws -> BlueConicProviderHTTPResponse {
        var value = URLRequest(url: request.url)
        value.httpMethod = request.method
        value.httpBody = request.body
        value.timeoutInterval = 30
        request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) }
        let session = URLSession(
            configuration: .ephemeral,
            delegate: BlueConicNoRedirect(),
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
                code: "blueconic_timeout",
                message: "BlueConic timed out."
            )
        }
        session.invalidateAndCancel()
        if let failure { throw failure }
        return BlueConicProviderHTTPResponse(statusCode: status, body: data)
    }
}

public protocol BlueConicProviderActionClient: Sendable {
    func executeBlueConicAction(
        request: MarketplaceProviderActionAdapterRequest
    ) throws -> JSONRecord
}

public struct FakeBlueConicProviderActionClient: BlueConicProviderActionClient {
    public init() {}

    public func executeBlueConicAction(
        request: MarketplaceProviderActionAdapterRequest
    ) throws -> JSONRecord {
        [
            "provider": .string("blueconic"),
            "action": .string(request.definition.actionKey),
            "liveCredentialsUsed": .bool(false)
        ]
    }
}

public final class LiveBlueConicProviderActionClient: BlueConicProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService
    private let secrets: SecretService
    private let http: any BlueConicProviderHTTPClient

    public init(
        data: LocalDataService,
        secrets: SecretService,
        httpClient: any BlueConicProviderHTTPClient = URLSessionBlueConicProviderHTTPClient()
    ) {
        self.data = data
        self.secrets = secrets
        self.http = httpClient
    }

    public func executeBlueConicAction(
        request: MarketplaceProviderActionAdapterRequest
    ) throws -> JSONRecord {
        guard request.definition.actionKey == "blueconic_segment_readiness_summary_get",
              let connectionId = request.auditIdentity.connectionId,
              let connection = try data.getProviderConnection(
                workspaceId: request.context.workspaceId,
                connectionId: connectionId
              ),
              connection.appSlug == "blueconic",
              let tenantRef = connection.credentialRequirements.first(where: {
                $0.fieldKey == "blueconic_tenant_name"
              })?.secretReferenceId,
              let clientRef = connection.credentialRequirements.first(where: {
                $0.fieldKey == "blueconic_client_id"
              })?.secretReferenceId,
              let secretRef = connection.credentialRequirements.first(where: {
                $0.fieldKey == "blueconic_client_secret"
              })?.secretReferenceId else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "blueconic_not_ready",
                message: "BlueConic connection is not ready."
            )
        }
        let tenant = try secrets.getSecretValue(tenantRef).lowercased()
        let clientId = try secrets.getSecretValue(clientRef)
        let clientSecret = try secrets.getSecretValue(secretRef)
        guard tenant.range(
            of: #"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$"#,
            options: .regularExpression
        ) != nil,
              !clientId.isEmpty,
              clientId.count <= 500,
              !clientId.contains("\n"),
              !clientId.contains("\r"),
              !clientSecret.isEmpty,
              clientSecret.count <= 30_000,
              !clientSecret.contains("\n"),
              !clientSecret.contains("\r") else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "blueconic_credentials_invalid",
                message: "BlueConic tenant or client credentials are invalid."
            )
        }
        let origin = "https://www.\(tenant).blueconic.net"
        var form = URLComponents()
        form.queryItems = [
            URLQueryItem(name: "grant_type", value: "client_credentials"),
            URLQueryItem(name: "client_id", value: clientId),
            URLQueryItem(name: "client_secret", value: clientSecret)
        ]
        let tokenResponse = try http.send(
            BlueConicProviderHTTPRequest(
                method: "POST",
                url: URL(string: origin + "/rest/v2/oauth/token")!,
                headers: [
                    "Accept": "application/json",
                    "Content-Type": "application/x-www-form-urlencoded"
                ],
                body: Data((form.percentEncodedQuery ?? "").utf8)
            )
        )
        let tokenObject = try object(tokenResponse)
        guard let token = tokenObject["access_token"] as? String,
              !token.isEmpty,
              token.count <= 30_000,
              !token.contains("\n"),
              !token.contains("\r") else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "blueconic_token_failed",
                message: "BlueConic did not return a usable access token."
            )
        }
        let segmentResponse = try http.send(
            BlueConicProviderHTTPRequest(
                method: "GET",
                url: URL(string: origin + "/rest/v2/segments")!,
                headers: [
                    "Accept": "application/json",
                    "Authorization": "Bearer " + token,
                    "User-Agent": "RelayConsole-BlueConic/1.0"
                ],
                body: nil
            )
        )
        let any = try decoded(segmentResponse)
        let values: [Any]
        if let array = any as? [Any] {
            values = array
        } else if let object = any as? [String: Any],
                  let array = (object["data"] as? [Any])
                    ?? (object["items"] as? [Any])
                    ?? (object["segments"] as? [Any]) {
            values = array
        } else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "blueconic_response_invalid",
                message: "BlueConic returned an unexpected segment-list shape."
            )
        }
        return [
            "segmentCount": .number(Double(values.count)),
            "redactionStatus": .string(
                "tenant-segment-identity-definitions-membership-profile-and-customer-data-excluded"
            )
        ]
    }

    private func decoded(_ response: BlueConicProviderHTTPResponse) throws -> Any {
        guard response.body.count <= 1_000_000 else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "blueconic_response_too_large",
                message: "BlueConic response exceeds 1 MB."
            )
        }
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: response.statusCode == 401
                    ? "blueconic_token_invalid"
                    : response.statusCode == 403 || response.statusCode == 404
                        ? "blueconic_permission_denied"
                        : response.statusCode == 429
                            ? "blueconic_rate_limited"
                            : "blueconic_api_error",
                message: "BlueConic API request failed.",
                providerStatusCode: response.statusCode
            )
        }
        guard let value = try? JSONSerialization.jsonObject(with: response.body) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "blueconic_response_invalid",
                message: "BlueConic returned invalid JSON."
            )
        }
        return value
    }

    private func object(_ response: BlueConicProviderHTTPResponse) throws -> [String: Any] {
        guard let value = try decoded(response) as? [String: Any] else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "blueconic_response_invalid",
                message: "BlueConic returned a non-object token response."
            )
        }
        return value
    }
}

public struct BlueConicProviderActionAdapter: MarketplaceProviderActionAdapter {
    private let client: any BlueConicProviderActionClient

    public init(
        client: any BlueConicProviderActionClient = FakeBlueConicProviderActionClient()
    ) {
        self.client = client
    }

    public func execute(
        request: MarketplaceProviderActionAdapterRequest
    ) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "blueconic" else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "blueconic_not_allowlisted",
                message: "BlueConic action is not allowlisted."
            )
        }
        return MarketplaceProviderActionAdapterResult(
            result: try client.executeBlueConicAction(request: request),
            error: nil,
            redactionStatus:
                "tenant-segment-identity-definitions-membership-profile-and-customer-data-excluded"
        )
    }
}
