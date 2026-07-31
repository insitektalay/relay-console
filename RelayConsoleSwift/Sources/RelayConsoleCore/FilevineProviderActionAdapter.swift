import Foundation

public struct FilevineProviderHTTPRequest: Sendable { public let url: URL; public let headers: [String: String] }
public struct FilevineProviderHTTPResponse: Sendable { public let statusCode: Int; public let body: Data }
public protocol FilevineProviderHTTPClient: Sendable { func send(_ request: FilevineProviderHTTPRequest) throws -> FilevineProviderHTTPResponse }

private final class FilevineNoRedirect: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}

public struct URLSessionFilevineProviderHTTPClient: FilevineProviderHTTPClient {
    public init() {}
    public func send(_ request: FilevineProviderHTTPRequest) throws -> FilevineProviderHTTPResponse {
        var value = URLRequest(url: request.url); value.httpMethod = "GET"; value.timeoutInterval = 20
        request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) }
        let session = URLSession(configuration: .ephemeral, delegate: FilevineNoRedirect(), delegateQueue: nil), semaphore = DispatchSemaphore(value: 0)
        var data = Data(); var status = 0; var failure: Error?
        let task = session.dataTask(with: value) { data = $0 ?? Data(); status = ($1 as? HTTPURLResponse)?.statusCode ?? 0; failure = $2; semaphore.signal() }
        task.resume()
        if semaphore.wait(timeout: .now() + 20) == .timedOut { task.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "filevine_timeout", message: "Filevine request timed out.") }
        session.invalidateAndCancel(); if let failure { throw failure }
        return FilevineProviderHTTPResponse(statusCode: status, body: data)
    }
}

public protocol FilevineProviderActionClient: Sendable { func executeFilevineAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord }
public struct FakeFilevineProviderActionClient: FilevineProviderActionClient {
    public init() {}
    public func executeFilevineAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        ["provider": .string("filevine"), "action": .string(request.definition.actionKey), "redactionStatus": .string("user-firm-project-matter-document-financial-and-legal-practice-data-excluded"), "liveCredentialsUsed": .bool(false)]
    }
}

public final class LiveFilevineProviderActionClient: FilevineProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService; private let secrets: SecretService; private let http: any FilevineProviderHTTPClient
    public init(data: LocalDataService, secrets: SecretService, httpClient: any FilevineProviderHTTPClient = URLSessionFilevineProviderHTTPClient()) { self.data = data; self.secrets = secrets; self.http = httpClient }
    public func executeFilevineAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        guard request.definition.actionKey == "filevine_connection_authority_get", let connectionId = request.auditIdentity.connectionId, let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: connectionId), connection.appSlug == "filevine",
            connection.health.diagnostics["apiOrigin"]?.string == "https://api.filevine.io", connection.health.diagnostics["apiRegion"]?.string == "us", connection.grantedScopes.contains("openid"), connection.grantedScopes.contains("offline_access"),
            connection.grantedScopes.contains("fv.api.gateway.access"), let accessReference = connection.credentialRequirements.first(where: { $0.fieldKey == "filevine_oauth_access_token" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "filevine_not_ready", message: "Filevine OAuth connection is not ready.") }
        let accessToken = try secrets.getSecretValue(accessReference)
        guard !accessToken.isEmpty, accessToken.count <= 30_000, !accessToken.contains("\n"), !accessToken.contains("\r") else { throw MarketplaceProviderActionAdapterFailure(code: "filevine_token_invalid", message: "Filevine OAuth credentials are invalid.") }
        let response = try http.send(FilevineProviderHTTPRequest(url: URL(string: "https://api.filevine.io/v2/projects?limit=1")!, headers: ["Authorization": "Bearer " + accessToken, "Accept": "application/json", "User-Agent": "RelayConsole-Filevine/1.0"]))
        guard response.body.count <= 65_536 else { throw MarketplaceProviderActionAdapterFailure(code: "filevine_response_too_large", message: "Filevine response exceeded 64 KB.") }
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: response.statusCode == 401 ? "filevine_token_invalid" : response.statusCode == 403 || response.statusCode == 404 ? "filevine_permission_denied" : response.statusCode == 429 ? "filevine_rate_limited" : "filevine_api_error", message: "Filevine API request failed.",
                providerStatusCode: response.statusCode)
        }
        guard let object = try? JSONSerialization.jsonObject(with: response.body), object is [String: Any] || object is [Any] else { throw MarketplaceProviderActionAdapterFailure(code: "filevine_response_invalid", message: "Filevine returned an invalid projects authority response.") }
        return ["authorized": .bool(true), "apiRegion": .string("us"), "apiVersion": .string("v2"), "redactionStatus": .string("user-firm-project-matter-document-financial-and-legal-practice-data-excluded")]
    }
}

public struct FilevineProviderActionAdapter: MarketplaceProviderActionAdapter {
    private let client: any FilevineProviderActionClient
    public init(client: any FilevineProviderActionClient = FakeFilevineProviderActionClient()) { self.client = client }
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "filevine" else { throw MarketplaceProviderActionAdapterFailure(code: "filevine_not_allowlisted", message: "Filevine action is not allowlisted.") }
        return MarketplaceProviderActionAdapterResult(result: try client.executeFilevineAction(request: request), error: nil, redactionStatus: "user-firm-project-matter-document-financial-and-legal-practice-data-excluded")
    }
}
