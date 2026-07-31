import Foundation

public struct CensusProviderHTTPRequest: Sendable {
    public let url: URL
    public let headers: [String: String]
}

public struct CensusProviderHTTPResponse: Sendable {
    public let statusCode: Int
    public let body: Data
}

public protocol CensusProviderHTTPClient: Sendable {
    func send(_ request: CensusProviderHTTPRequest) throws -> CensusProviderHTTPResponse
}

private final class CensusNoRedirect: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) {
        completionHandler(nil)
    }
}

public struct URLSessionCensusProviderHTTPClient: CensusProviderHTTPClient {
    public init() {}

    public func send(_ request: CensusProviderHTTPRequest) throws -> CensusProviderHTTPResponse {
        var value = URLRequest(url: request.url)
        value.httpMethod = "GET"
        value.timeoutInterval = 30
        request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) }
        let session = URLSession(configuration: .ephemeral, delegate: CensusNoRedirect(), delegateQueue: nil)
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
            throw MarketplaceProviderActionAdapterFailure(code: "census_timeout", message: "Census timed out.")
        }
        session.invalidateAndCancel()
        if let failure { throw failure }
        return CensusProviderHTTPResponse(statusCode: status, body: data)
    }
}

public protocol CensusProviderActionClient: Sendable {
    func executeCensusAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord
}

public struct FakeCensusProviderActionClient: CensusProviderActionClient {
    public init() {}
    public func executeCensusAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        ["provider": .string("census"), "action": .string(request.definition.actionKey), "liveCredentialsUsed": .bool(false)]
    }
}

public final class LiveCensusProviderActionClient: CensusProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService
    private let secrets: SecretService
    private let http: any CensusProviderHTTPClient

    public init(data: LocalDataService, secrets: SecretService, httpClient: any CensusProviderHTTPClient = URLSessionCensusProviderHTTPClient()) {
        self.data = data
        self.secrets = secrets
        self.http = httpClient
    }

    public func executeCensusAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        guard request.definition.actionKey == "census_dataset_readiness_summary_get",
              let connectionId = request.auditIdentity.connectionId,
              let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: connectionId),
              connection.appSlug == "census",
              let keyRef = connection.credentialRequirements.first(where: { $0.fieldKey == "census_api_key" })?.secretReferenceId else {
            throw MarketplaceProviderActionAdapterFailure(code: "census_not_ready", message: "Census connection is not ready.")
        }
        let apiKey = try secrets.getSecretValue(keyRef)
        guard !apiKey.isEmpty, apiKey.count <= 30_000, !apiKey.contains("\n"), !apiKey.contains("\r") else {
            throw MarketplaceProviderActionAdapterFailure(code: "census_key_invalid", message: "Census workspace API key is invalid.")
        }
        let response = try http.send(CensusProviderHTTPRequest(url: URL(string: "https://app.getcensus.com/api/v1/datasets?page=1&per_page=1&order=desc")!, headers: ["Accept": "application/json", "Authorization": "Bearer " + apiKey, "User-Agent": "RelayConsole-Census/1.0"]))
        guard response.body.count <= 1_000_000 else {
            throw MarketplaceProviderActionAdapterFailure(code: "census_response_too_large", message: "Census response exceeds 1 MB.")
        }
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: response.statusCode == 401 ? "census_key_invalid" : response.statusCode == 403 || response.statusCode == 404 ? "census_permission_denied" : response.statusCode == 429 ? "census_rate_limited" : "census_api_error", message: "Census API request failed.",
                providerStatusCode: response.statusCode)
        }
        guard let object = (try? JSONSerialization.jsonObject(with: response.body)) as? [String: Any],
              object["status"] as? String == "success",
              object["data"] is [Any],
              let pagination = object["pagination"] as? [String: Any],
              let datasetCount = pagination["total_records"] as? NSNumber,
              datasetCount.doubleValue >= 0,
              datasetCount.doubleValue.rounded() == datasetCount.doubleValue else {
            throw MarketplaceProviderActionAdapterFailure(code: "census_response_invalid", message: "Census returned an unexpected dataset-list shape.")
        }
        return ["datasetCount": .number(datasetCount.doubleValue), "redactionStatus": .string("dataset-identity-query-source-sync-destination-run-and-customer-data-excluded")]
    }
}

public struct CensusProviderActionAdapter: MarketplaceProviderActionAdapter {
    private let client: any CensusProviderActionClient
    public init(client: any CensusProviderActionClient = FakeCensusProviderActionClient()) { self.client = client }
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "census" else {
            throw MarketplaceProviderActionAdapterFailure(code: "census_not_allowlisted", message: "Census action is not allowlisted.")
        }
        return MarketplaceProviderActionAdapterResult(result: try client.executeCensusAction(request: request), error: nil, redactionStatus: "dataset-identity-query-source-sync-destination-run-and-customer-data-excluded")
    }
}
