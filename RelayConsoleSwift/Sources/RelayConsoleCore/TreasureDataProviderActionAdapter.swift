import Foundation

public struct TreasureDataProviderHTTPRequest: Sendable {
    public let url: URL
    public let headers: [String: String]
}

public struct TreasureDataProviderHTTPResponse: Sendable {
    public let statusCode: Int
    public let body: Data
}

public protocol TreasureDataProviderHTTPClient: Sendable {
    func send(_ request: TreasureDataProviderHTTPRequest) throws -> TreasureDataProviderHTTPResponse
}

private final class TreasureDataNoRedirect: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
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

public struct URLSessionTreasureDataProviderHTTPClient: TreasureDataProviderHTTPClient {
    public init() {}

    public func send(_ request: TreasureDataProviderHTTPRequest) throws -> TreasureDataProviderHTTPResponse {
        var value = URLRequest(url: request.url)
        value.httpMethod = "GET"
        value.timeoutInterval = 30
        request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) }
        let session = URLSession(
            configuration: .ephemeral,
            delegate: TreasureDataNoRedirect(),
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
                code: "treasure_data_timeout",
                message: "Treasure Data timed out."
            )
        }
        session.invalidateAndCancel()
        if let failure { throw failure }
        return TreasureDataProviderHTTPResponse(statusCode: status, body: data)
    }
}

public protocol TreasureDataProviderActionClient: Sendable {
    func executeTreasureDataAction(
        request: MarketplaceProviderActionAdapterRequest
    ) throws -> JSONRecord
}

public struct FakeTreasureDataProviderActionClient: TreasureDataProviderActionClient {
    public init() {}

    public func executeTreasureDataAction(
        request: MarketplaceProviderActionAdapterRequest
    ) throws -> JSONRecord {
        [
            "provider": .string("treasure-data"),
            "action": .string(request.definition.actionKey),
            "liveCredentialsUsed": .bool(false)
        ]
    }
}

public final class LiveTreasureDataProviderActionClient: TreasureDataProviderActionClient, @unchecked Sendable {
    private static let origins = [
        "us": "https://api.treasuredata.com",
        "tokyo": "https://api.treasuredata.co.jp",
        "ap02": "https://api.ap02.treasuredata.com",
        "eu01": "https://api.eu01.treasuredata.com"
    ]

    private let data: LocalDataService
    private let secrets: SecretService
    private let http: any TreasureDataProviderHTTPClient

    public init(
        data: LocalDataService,
        secrets: SecretService,
        httpClient: any TreasureDataProviderHTTPClient = URLSessionTreasureDataProviderHTTPClient()
    ) {
        self.data = data
        self.secrets = secrets
        self.http = httpClient
    }

    public func executeTreasureDataAction(
        request: MarketplaceProviderActionAdapterRequest
    ) throws -> JSONRecord {
        guard request.definition.actionKey == "treasure_data_database_readiness_summary_get",
              let connectionId = request.auditIdentity.connectionId,
              let connection = try data.getProviderConnection(
                workspaceId: request.context.workspaceId,
                connectionId: connectionId
              ),
              connection.appSlug == "treasure-data",
              let keyRef = connection.credentialRequirements.first(where: {
                $0.fieldKey == "treasure_data_api_key"
              })?.secretReferenceId,
              let regionRef = connection.credentialRequirements.first(where: {
                $0.fieldKey == "treasure_data_api_region"
              })?.secretReferenceId else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "treasure_data_not_ready",
                message: "Treasure Data connection is not ready."
            )
        }
        let apiKey = try secrets.getSecretValue(keyRef)
        let region = try secrets.getSecretValue(regionRef).lowercased()
        guard !apiKey.isEmpty,
              apiKey.count <= 30_000,
              !apiKey.contains("\n"),
              !apiKey.contains("\r"),
              let origin = Self.origins[region] else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "treasure_data_credentials_invalid",
                message: "Treasure Data region or API key is invalid."
            )
        }
        let response = try http.send(
            TreasureDataProviderHTTPRequest(
                url: URL(string: origin + "/v3/database/list?require_permissions=true")!,
                headers: [
                    "Accept": "application/json",
                    "Authorization": "TD1 " + apiKey,
                    "User-Agent": "RelayConsole-TreasureData/1.0"
                ]
            )
        )
        guard response.body.count <= 1_000_000 else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "treasure_data_response_too_large",
                message: "Treasure Data response exceeds 1 MB."
            )
        }
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: response.statusCode == 401
                    ? "treasure_data_key_invalid"
                    : response.statusCode == 403 || response.statusCode == 404
                        ? "treasure_data_permission_denied"
                        : response.statusCode == 429
                            ? "treasure_data_rate_limited"
                            : "treasure_data_api_error",
                message: "Treasure Data API request failed.",
                providerStatusCode: response.statusCode
            )
        }
        guard let object = try? JSONSerialization.jsonObject(with: response.body) as? [String: Any],
              let databases = object["databases"] as? [Any] else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "treasure_data_response_invalid",
                message: "Treasure Data returned an unexpected database-list shape."
            )
        }
        let protectedCount = databases.reduce(into: 0) { count, value in
            if (value as? [String: Any])?["delete_protected"] as? Bool == true {
                count += 1
            }
        }
        return [
            "databaseCount": .number(Double(databases.count)),
            "deleteProtectedCount": .number(Double(protectedCount)),
            "redactionStatus": .string(
                "database-identity-record-count-permission-table-schema-query-job-and-customer-data-excluded"
            )
        ]
    }
}

public struct TreasureDataProviderActionAdapter: MarketplaceProviderActionAdapter {
    private let client: any TreasureDataProviderActionClient

    public init(
        client: any TreasureDataProviderActionClient = FakeTreasureDataProviderActionClient()
    ) {
        self.client = client
    }

    public func execute(
        request: MarketplaceProviderActionAdapterRequest
    ) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "treasure-data" else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "treasure_data_not_allowlisted",
                message: "Treasure Data action is not allowlisted."
            )
        }
        return MarketplaceProviderActionAdapterResult(
            result: try client.executeTreasureDataAction(request: request),
            error: nil,
            redactionStatus:
                "database-identity-record-count-permission-table-schema-query-job-and-customer-data-excluded"
        )
    }
}
