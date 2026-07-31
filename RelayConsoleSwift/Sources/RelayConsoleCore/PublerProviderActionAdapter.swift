import Foundation

public struct PublerProviderHTTPRequest: Sendable { public let url: URL; public let headers: [String: String] }
public struct PublerProviderHTTPResponse: Sendable { public let statusCode: Int; public let body: Data }
public protocol PublerProviderHTTPClient: Sendable { func send(_ request: PublerProviderHTTPRequest) throws -> PublerProviderHTTPResponse }
private final class PublerNoRedirect: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}

public struct URLSessionPublerProviderHTTPClient: PublerProviderHTTPClient {
    public init() {}
    public func send(_ request: PublerProviderHTTPRequest) throws -> PublerProviderHTTPResponse {
        var value = URLRequest(url: request.url); value.httpMethod = "GET"; value.timeoutInterval = 20; request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) }
        let session = URLSession(configuration: .ephemeral, delegate: PublerNoRedirect(), delegateQueue: nil), semaphore = DispatchSemaphore(value: 0); var data = Data(), status = 0, failure: Error?
        let task = session.dataTask(with: value) { data = $0 ?? Data(); status = ($1 as? HTTPURLResponse)?.statusCode ?? 0; failure = $2; semaphore.signal() }; task.resume()
        if semaphore.wait(timeout: .now() + 20) == .timedOut { task.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "publer_http_timeout", message: "Publer request timed out.") }
        session.invalidateAndCancel(); if let failure { throw failure }; return PublerProviderHTTPResponse(statusCode: status, body: data)
    }
}

public protocol PublerProviderActionClient: Sendable { func executePublerAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord }
public struct FakePublerProviderActionClient: PublerProviderActionClient {
    public init() {}
    public func executePublerAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord { ["provider": .string("publer"), "action": .string(request.definition.actionKey), "redactionStatus": .string("identity-and-content-excluded"), "liveCredentialsUsed": .bool(false)] }
}

public final class LivePublerProviderActionClient: PublerProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService; private let secrets: SecretService; private let http: any PublerProviderHTTPClient
    public init(data: LocalDataService, secrets: SecretService, httpClient: any PublerProviderHTTPClient = URLSessionPublerProviderHTTPClient()) { self.data = data; self.secrets = secrets; self.http = httpClient }

    public func executePublerAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        let credentials = try authorization(request), action = request.definition.actionKey, path: String, workspaceHeader: Bool
        if action == "publer_workspace_list" { path = "/api/v1/workspaces"; workspaceHeader = false }
        else if action == "publer_account_structure_list" { path = "/api/v1/accounts"; workspaceHeader = true }
        else { throw MarketplaceProviderActionAdapterFailure(code: "publer_action_not_allowlisted", message: "Publer action is not allowlisted.") }
        var headers = ["Authorization": "Bearer-API " + credentials.key, "Accept": "application/json", "Content-Type": "application/json", "User-Agent": "RelayConsole-Publer/1.0"]; if workspaceHeader { headers["Publer-Workspace-Id"] = credentials.workspace }
        let response = try http.send(PublerProviderHTTPRequest(url: URL(string: "https://app.publer.com" + path)!, headers: headers))
        guard response.body.count <= 1_000_000 else { throw MarketplaceProviderActionAdapterFailure(code: "publer_response_too_large", message: "Publer response exceeded 1 MB.") }
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: response.statusCode == 401 ? "publer_key_invalid" : response.statusCode == 403 || response.statusCode == 404 ? "publer_permission_denied" : response.statusCode == 429 ? "publer_rate_limited" : "publer_api_error", message: "Publer API request failed.",
                providerStatusCode: response.statusCode)
        }
        guard let any = try? JSONSerialization.jsonObject(with: response.body) else { throw MarketplaceProviderActionAdapterFailure(code: "publer_response_invalid", message: "Publer returned invalid JSON.") }
        let root = Self.json(any)
        return action == "publer_workspace_list" ? Self.workspaceResult(root, boundWorkspace: credentials.workspace) : Self.accountResult(root, workspace: credentials.workspace)
    }

    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> (key: String, workspace: String) {
        guard let id = request.auditIdentity.connectionId, let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), connection.appSlug == "publer", connection.health.diagnostics["apiOrigin"]?.string == "https://app.publer.com/api/v1",
            let keyRef = connection.credentialRequirements.first(where: { $0.fieldKey == "publer_api_key" })?.secretReferenceId, let workspaceRef = connection.credentialRequirements.first(where: { $0.fieldKey == "publer_workspace_id" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "publer_connection_not_ready", message: "Publer connection is not ready.") }
        let key = try secrets.getSecretValue(keyRef), workspace = try secrets.getSecretValue(workspaceRef)
        guard !key.isEmpty, Self.safeId(workspace) else { throw MarketplaceProviderActionAdapterFailure(code: "publer_credentials_invalid", message: "Publer credential binding is invalid.") }; return (key, workspace)
    }

    private static func workspaceResult(_ root: JSONValue, boundWorkspace: String) -> JSONRecord {
        let object = root.publerObject ?? [:], source = root.publerArray ?? object["data"]?.publerArray ?? object["workspaces"]?.publerArray ?? []
        let workspaces = source.prefix(25).compactMap { value -> JSONValue? in let item = value.publerObject ?? [:], id = item["id"]?.string ?? item["workspaceId"]?.string; guard let id, safeId(id) else { return nil }; return .object(["workspaceId": .string(id)]) }
        return ["boundWorkspaceId": .string(boundWorkspace), "workspaces": .array(workspaces), "redactionStatus": .string("workspace-identity-excluded")]
    }

    private static func accountResult(_ root: JSONValue, workspace: String) -> JSONRecord {
        let object = root.publerObject ?? [:], source = root.publerArray ?? object["data"]?.publerArray ?? object["accounts"]?.publerArray ?? []
        let accounts = source.prefix(25).compactMap { value -> JSONValue? in
            let item = value.publerObject ?? [:], id = item["id"]?.string ?? item["accountId"]?.string; guard let id, safeId(id) else { return nil }; let provider = item["provider"]?.string.flatMap { safeEnum($0) ? $0 : nil }, type = item["type"]?.string.flatMap { safeEnum($0) ? $0 : nil };
            return .object(["accountId": .string(id), "provider": provider.map(JSONValue.string) ?? .null, "type": type.map(JSONValue.string) ?? .null])
        }
        return ["workspaceId": .string(workspace), "accounts": .array(accounts), "redactionStatus": .string("account-identity-and-content-excluded")]
    }

    private static func safeId(_ value: String) -> Bool { value.range(of: #"^[A-Za-z0-9_-]{1,128}$"#, options: .regularExpression) != nil }
    private static func safeEnum(_ value: String) -> Bool { value.range(of: #"^[A-Za-z0-9_-]{1,64}$"#, options: .regularExpression) != nil }
    private static func json(_ any: Any) -> JSONValue {
        if any is NSNull { return .null }; if let value = any as? Bool { return .bool(value) }; if let value = any as? String { return .string(value) }; if let value = any as? NSNumber { return .number(value.doubleValue) }; if let value = any as? [Any] { return .array(value.map(json)) };
        if let value = any as? [String: Any] { return .object(value.mapValues(json)) }; return .null
    }
}

public struct PublerProviderActionAdapter: MarketplaceProviderActionAdapter {
    private let client: any PublerProviderActionClient
    public init(client: any PublerProviderActionClient = FakePublerProviderActionClient()) { self.client = client }
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "publer" else { throw MarketplaceProviderActionAdapterFailure(code: "publer_action_not_allowlisted", message: "Publer action is not allowlisted.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executePublerAction(request: request), error: nil, redactionStatus: "identity-and-content-excluded")
    }
}

extension JSONValue { fileprivate var publerObject: JSONRecord? { if case .object(let value) = self { return value }; return nil }; fileprivate var publerArray: [JSONValue]? { if case .array(let value) = self { return value }; return nil } }
