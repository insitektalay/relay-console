import Foundation

public struct SmokeballProviderHTTPRequest: Sendable { public let url: URL; public let headers: [String: String] }
public struct SmokeballProviderHTTPResponse: Sendable { public let statusCode: Int; public let body: Data }
public protocol SmokeballProviderHTTPClient: Sendable { func send(_ request: SmokeballProviderHTTPRequest) throws -> SmokeballProviderHTTPResponse }

private final class SmokeballNoRedirect: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}

public struct URLSessionSmokeballProviderHTTPClient: SmokeballProviderHTTPClient {
    public init() {}
    public func send(_ request: SmokeballProviderHTTPRequest) throws -> SmokeballProviderHTTPResponse {
        var value = URLRequest(url: request.url); value.httpMethod = "GET"; value.timeoutInterval = 20
        request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) }
        let session = URLSession(configuration: .ephemeral, delegate: SmokeballNoRedirect(), delegateQueue: nil), semaphore = DispatchSemaphore(value: 0)
        var data = Data(); var status = 0; var failure: Error?
        let task = session.dataTask(with: value) { data = $0 ?? Data(); status = ($1 as? HTTPURLResponse)?.statusCode ?? 0; failure = $2; semaphore.signal() }
        task.resume()
        if semaphore.wait(timeout: .now() + 20) == .timedOut { task.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "smokeball_timeout", message: "Smokeball request timed out.") }
        session.invalidateAndCancel(); if let failure { throw failure }
        return SmokeballProviderHTTPResponse(statusCode: status, body: data)
    }
}

public protocol SmokeballProviderActionClient: Sendable { func executeSmokeballAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord }
public struct FakeSmokeballProviderActionClient: SmokeballProviderActionClient {
    public init() {}
    public func executeSmokeballAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        ["provider": .string("smokeball"), "action": .string(request.definition.actionKey), "redactionStatus": .string("firm-identity-client-matter-document-communication-and-financial-data-excluded"), "liveCredentialsUsed": .bool(false)]
    }
}

public final class LiveSmokeballProviderActionClient: SmokeballProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService; private let secrets: SecretService; private let http: any SmokeballProviderHTTPClient
    public init(data: LocalDataService, secrets: SecretService, httpClient: any SmokeballProviderHTTPClient = URLSessionSmokeballProviderHTTPClient()) { self.data = data; self.secrets = secrets; self.http = httpClient }
    public func executeSmokeballAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        guard request.definition.actionKey == "smokeball_connection_authority_get", let connectionId = request.auditIdentity.connectionId, let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: connectionId), connection.appSlug == "smokeball",
            connection.health.diagnostics["apiOrigin"]?.string == "https://api.smokeball.com", connection.health.diagnostics["apiRegion"]?.string == "us", connection.grantedScopes.isEmpty,
            let accessReference = connection.credentialRequirements.first(where: { $0.fieldKey == "smokeball_oauth_access_token" })?.secretReferenceId, let apiKeyReference = connection.credentialRequirements.first(where: { $0.fieldKey == "smokeball_api_key" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "smokeball_not_ready", message: "Smokeball OAuth connection is not ready.") }
        let accessToken = try secrets.getSecretValue(accessReference), apiKey = try secrets.getSecretValue(apiKeyReference)
        guard !accessToken.isEmpty, accessToken.count <= 30_000, !accessToken.contains("\n"), !accessToken.contains("\r"), !apiKey.isEmpty, apiKey.count <= 2_000, !apiKey.contains("\n"), !apiKey.contains("\r") else {
            throw MarketplaceProviderActionAdapterFailure(code: "smokeball_token_invalid", message: "Smokeball OAuth credentials are invalid.")
        }
        let response = try http.send(SmokeballProviderHTTPRequest(url: URL(string: "https://api.smokeball.com/firm")!, headers: ["Authorization": "Bearer " + accessToken, "x-api-key": apiKey, "Accept": "application/json", "User-Agent": "RelayConsole-Smokeball/1.0"]))
        guard response.body.count <= 65_536 else { throw MarketplaceProviderActionAdapterFailure(code: "smokeball_response_too_large", message: "Smokeball response exceeded 64 KB.") }
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: response.statusCode == 401 ? "smokeball_token_invalid" : response.statusCode == 403 || response.statusCode == 404 ? "smokeball_permission_denied" : response.statusCode == 429 ? "smokeball_rate_limited" : "smokeball_api_error", message: "Smokeball API request failed.",
                providerStatusCode: response.statusCode)
        }
        guard let object = try? JSONSerialization.jsonObject(with: response.body) as? [String: Any], let id = object["id"] as? String, UUID(uuidString: id) != nil else {
            throw MarketplaceProviderActionAdapterFailure(code: "smokeball_response_invalid", message: "Smokeball returned an invalid firm authority response.")
        }
        return ["authorized": .bool(true), "apiRegion": .string("us"), "apiVersion": .string("v1"), "redactionStatus": .string("firm-identity-client-matter-document-communication-and-financial-data-excluded")]
    }
}

public struct SmokeballProviderActionAdapter: MarketplaceProviderActionAdapter {
    private let client: any SmokeballProviderActionClient
    public init(client: any SmokeballProviderActionClient = FakeSmokeballProviderActionClient()) { self.client = client }
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "smokeball" else { throw MarketplaceProviderActionAdapterFailure(code: "smokeball_not_allowlisted", message: "Smokeball action is not allowlisted.") }
        return MarketplaceProviderActionAdapterResult(result: try client.executeSmokeballAction(request: request), error: nil, redactionStatus: "firm-identity-client-matter-document-communication-and-financial-data-excluded")
    }
}
