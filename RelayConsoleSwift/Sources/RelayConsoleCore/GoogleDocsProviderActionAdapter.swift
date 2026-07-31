import Foundation

public struct GoogleDocsProviderActionClientResult: Codable, Equatable, Sendable {
    public var result: JSONRecord
    public var redactionStatus: String

    public init(result: JSONRecord, redactionStatus: String = "private-state-excluded") {
        self.result = result
        self.redactionStatus = redactionStatus
    }
}

public protocol GoogleDocsProviderActionClient: Sendable {
    func executeGoogleDocsAction(request: MarketplaceProviderActionAdapterRequest) throws -> GoogleDocsProviderActionClientResult
}

public struct GoogleDocsProviderHTTPRequest: Sendable, Equatable {
    public var method: String
    public var url: URL
    public var headers: [String: String]
    public var body: Data?

    public init(method: String, url: URL, headers: [String: String] = [:], body: Data? = nil) {
        self.method = method
        self.url = url
        self.headers = headers
        self.body = body
    }
}

public struct GoogleDocsProviderHTTPResponse: Sendable, Equatable {
    public var statusCode: Int
    public var body: Data

    public init(statusCode: Int, body: Data = Data()) {
        self.statusCode = statusCode
        self.body = body
    }
}

public protocol GoogleDocsProviderHTTPClient: Sendable {
    func send(_ request: GoogleDocsProviderHTTPRequest) throws -> GoogleDocsProviderHTTPResponse
}

public struct URLSessionGoogleDocsProviderHTTPClient: GoogleDocsProviderHTTPClient {
    private let timeoutSeconds: TimeInterval

    public init(timeoutSeconds: TimeInterval = 30) {
        self.timeoutSeconds = timeoutSeconds
    }

    public func send(_ request: GoogleDocsProviderHTTPRequest) throws -> GoogleDocsProviderHTTPResponse {
        var urlRequest = URLRequest(url: request.url)
        urlRequest.httpMethod = request.method
        urlRequest.timeoutInterval = timeoutSeconds
        urlRequest.httpBody = request.body
        for (key, value) in request.headers {
            urlRequest.setValue(value, forHTTPHeaderField: key)
        }
        let semaphore = DispatchSemaphore(value: 0)
        var responseData: Data?
        var responseStatusCode: Int?
        var responseError: Error?
        let task = URLSession.shared.dataTask(with: urlRequest) { data, response, error in
            responseData = data
            responseStatusCode = (response as? HTTPURLResponse)?.statusCode
            responseError = error
            semaphore.signal()
        }
        task.resume()
        if semaphore.wait(timeout: .now() + timeoutSeconds) == .timedOut {
            task.cancel()
            throw MarketplaceProviderActionAdapterFailure(
                code: "google_docs_http_timeout",
                message: "Google Docs API request timed out.",
                detail: ["urlHost": .string(request.url.host ?? "docs.googleapis.com")]
            )
        }
        if let responseError {
            throw responseError
        }
        return GoogleDocsProviderHTTPResponse(statusCode: responseStatusCode ?? 0, body: responseData ?? Data())
    }
}

public struct MissingGoogleDocsProviderActionClient: GoogleDocsProviderActionClient {
    public init() {}

    public func executeGoogleDocsAction(request: MarketplaceProviderActionAdapterRequest) throws -> GoogleDocsProviderActionClientResult {
        throw MarketplaceProviderActionAdapterFailure(
            code: "google_docs_live_adapter_missing",
            message: "Not executed against Google Docs: live Google Docs API execution is not configured in this runtime.",
            detail: [
                "actionKey": .string(request.definition.actionKey),
                "liveAdapterMissing": .bool(true),
                "provider": .string("google-docs")
            ]
        )
    }
}

public struct FakeGoogleDocsProviderActionClient: GoogleDocsProviderActionClient {
    private let failureByActionKey: [String: MarketplaceProviderActionAdapterFailure]

    public init(failureByActionKey: [String: MarketplaceProviderActionAdapterFailure] = [:]) {
        self.failureByActionKey = failureByActionKey
    }

    public func executeGoogleDocsAction(request: MarketplaceProviderActionAdapterRequest) throws -> GoogleDocsProviderActionClientResult {
        if let failure = failureByActionKey[request.definition.actionKey] {
            throw failure
        }
        switch request.definition.actionKey {
        case "google_docs_read_document":
            let documentId = try GoogleDocsProviderActionAdapterSupport.documentId(from: request.payload)
            let text = request.payload["fakeBody"]?.string?.trimmedNonEmpty
                ?? "Project brief\nLaunch goals include fast setup, bounded document reads, and approval-gated Google Docs edits."
            let maxBodyChars = GoogleDocsProviderActionAdapterSupport.boundedInt(
                request.payload["maxBodyChars"],
                defaultValue: 8000,
                minValue: 200,
                maxValue: 12_000
            )
            return GoogleDocsProviderActionClientResult(result: GoogleDocsProviderActionAdapterSupport.baseResult(
                request: request,
                clientMode: "fake-google-docs-client",
                fakeAdapter: true,
                liveCredentialsUsed: false
            ).merging([
                "semanticReadContract": .string("google-docs-document-summary-v1"),
                "document": .object(GoogleDocsProviderActionAdapterSupport.documentResult(
                    documentId: documentId,
                    title: request.payload["fakeTitle"]?.string?.trimmedNonEmpty ?? "Fake Google Docs Document",
                    revisionId: "fake-revision-\(GoogleDocsProviderActionAdapterSupport.stableSuffix(documentId))",
                    text: text,
                    maxBodyChars: maxBodyChars,
                    headings: ["Project brief"],
                    tableText: []
                ))
            ]) { _, new in new })
        case "google_docs_create_document":
            let payload = try GoogleDocsProviderActionAdapterSupport.documentWritePayload(request: request, requireDocumentId: false)
            return GoogleDocsProviderActionClientResult(result: GoogleDocsProviderActionAdapterSupport.baseResult(
                request: request,
                clientMode: "fake-google-docs-client",
                fakeAdapter: true,
                liveCredentialsUsed: false
            ).merging([
                "documentId": .string("gdoc-\(GoogleDocsProviderActionAdapterSupport.stableSuffix(payload.title + request.idempotencyKey))"),
                "title": .string(payload.title),
                "revisionId": .string("fake-created-revision"),
                "bodyCharacterCount": .number(Double(payload.body.count)),
                "auditId": .string("audit-\(GoogleDocsProviderActionAdapterSupport.stableSuffix(request.idempotencyKey))")
            ]) { _, new in new })
        case "google_docs_apply_document_update":
            let documentId = try GoogleDocsProviderActionAdapterSupport.documentId(from: request.payload)
            return GoogleDocsProviderActionClientResult(result: GoogleDocsProviderActionAdapterSupport.baseResult(
                request: request,
                clientMode: "fake-google-docs-client",
                fakeAdapter: true,
                liveCredentialsUsed: false
            ).merging([
                "documentId": .string(documentId),
                "revisionId": .string("fake-updated-revision-\(GoogleDocsProviderActionAdapterSupport.stableSuffix(request.idempotencyKey))"),
                "requestCount": .number(Double(GoogleDocsProviderActionAdapterSupport.array(request.payload["requests"]).count)),
                "requiredRevisionId": request.payload["requiredRevisionId"] ?? .null,
                "auditId": .string("audit-\(GoogleDocsProviderActionAdapterSupport.stableSuffix(documentId + request.idempotencyKey))")
            ]) { _, new in new })
        default:
            throw MarketplaceProviderActionAdapterFailure(
                code: "google_docs_action_not_allowlisted",
                message: "The requested Google Docs action is not in the V1 fake adapter allowlist.",
                detail: ["actionKey": .string(request.definition.actionKey)]
            )
        }
    }
}

public final class LiveGoogleDocsProviderActionClient: GoogleDocsProviderActionClient, @unchecked Sendable {
    private struct Credentials {
        var clientId: String
        var clientSecret: String
        var refreshToken: String
    }

    private let data: LocalDataService
    private let secrets: SecretService
    private let httpClient: any GoogleDocsProviderHTTPClient
    private let jsonEncoder = JSONEncoder()

    public init(
        data: LocalDataService,
        secrets: SecretService,
        httpClient: any GoogleDocsProviderHTTPClient = URLSessionGoogleDocsProviderHTTPClient()
    ) {
        self.data = data
        self.secrets = secrets
        self.httpClient = httpClient
    }

    public func executeGoogleDocsAction(request: MarketplaceProviderActionAdapterRequest) throws -> GoogleDocsProviderActionClientResult {
        let connection = try connection(for: request)
        try requireReady(connection: connection, actionKey: request.definition.actionKey)
        let accessToken: String
        if connection.credentialOwnership == .relayOwned {
            accessToken = try secret(fieldKey: "google_docs_oauth_access_token", connection: connection)
        } else {
            let credentials = try credentials(for: connection)
            accessToken = try refreshAccessToken(credentials: credentials, connection: connection)
        }
        switch request.definition.actionKey {
        case "google_docs_read_document":
            return try readDocument(request: request, accessToken: accessToken)
        case "google_docs_create_document":
            return try createDocument(request: request, accessToken: accessToken)
        case "google_docs_apply_document_update":
            return try applyDocumentUpdate(request: request, accessToken: accessToken)
        default:
            throw MarketplaceProviderActionAdapterFailure(
                code: "google_docs_action_not_allowlisted",
                message: "The requested Google Docs action is not in the V1 live adapter allowlist.",
                detail: ["actionKey": .string(request.definition.actionKey)]
            )
        }
    }

    private func readDocument(
        request: MarketplaceProviderActionAdapterRequest,
        accessToken: String
    ) throws -> GoogleDocsProviderActionClientResult {
        let documentId = try GoogleDocsProviderActionAdapterSupport.documentId(from: request.payload)
        let maxBodyChars = GoogleDocsProviderActionAdapterSupport.boundedInt(
            request.payload["maxBodyChars"],
            defaultValue: 8000,
            minValue: 200,
            maxValue: 12_000
        )
        let response = try get(path: "/v1/documents/\(Self.pathEncode(documentId))", accessToken: accessToken)
        let record = try Self.parseJSONResponse(response, code: "google_docs_document_read_http_error")
        let extracted = GoogleDocsProviderActionAdapterSupport.extractDocumentText(from: record, maxBodyChars: maxBodyChars)
        return GoogleDocsProviderActionClientResult(result: GoogleDocsProviderActionAdapterSupport.baseResult(
            request: request,
            clientMode: "live-google-docs-api",
            fakeAdapter: false,
            liveCredentialsUsed: true
        ).merging([
            "semanticReadContract": .string("google-docs-document-summary-v1"),
            "document": .object(GoogleDocsProviderActionAdapterSupport.documentResult(
                documentId: record["documentId"]?.string?.trimmedNonEmpty ?? documentId,
                title: record["title"]?.string?.trimmedNonEmpty ?? "Untitled document",
                revisionId: record["revisionId"]?.string,
                text: extracted.text,
                maxBodyChars: maxBodyChars,
                headings: extracted.headings,
                tableText: extracted.tableText
            ))
        ]) { _, new in new })
    }

    private func createDocument(
        request: MarketplaceProviderActionAdapterRequest,
        accessToken: String
    ) throws -> GoogleDocsProviderActionClientResult {
        let payload = try GoogleDocsProviderActionAdapterSupport.documentWritePayload(request: request, requireDocumentId: false)
        let createResponse = try postJSON(
            path: "/v1/documents",
            body: ["title": .string(payload.title)],
            accessToken: accessToken
        )
        let createRecord = try Self.parseJSONResponse(createResponse, code: "google_docs_create_http_error")
        let documentId = createRecord["documentId"]?.string?.trimmedNonEmpty
            ?? createRecord["documentId"]?.string
            ?? ""
        guard !documentId.isEmpty else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "google_docs_create_missing_document_id",
                message: "Google Docs create response did not include a document ID."
            )
        }
        var revisionId = createRecord["revisionId"]?.string
        if !payload.body.isEmpty {
            let updateResponse = try postJSON(
                path: "/v1/documents/\(Self.pathEncode(documentId)):batchUpdate",
                body: [
                    "requests": .array([
                        .object([
                            "insertText": .object([
                                "location": .object(["index": .number(1)]),
                                "text": .string(payload.body)
                            ])
                        ])
                    ])
                ],
                accessToken: accessToken
            )
            let updateRecord = try Self.parseJSONResponse(updateResponse, code: "google_docs_create_body_http_error")
            let writeControl = GoogleDocsProviderActionAdapterSupport.object(updateRecord["writeControl"])
            revisionId = writeControl?["requiredRevisionId"]?.string ?? revisionId
        }
        return GoogleDocsProviderActionClientResult(result: GoogleDocsProviderActionAdapterSupport.baseResult(
            request: request,
            clientMode: "live-google-docs-api",
            fakeAdapter: false,
            liveCredentialsUsed: true
        ).merging([
            "documentId": .string(documentId),
            "title": .string(payload.title),
            "revisionId": revisionId.map(JSONValue.string) ?? .null,
            "bodyCharacterCount": .number(Double(payload.body.count)),
            "auditId": .string("audit-\(GoogleDocsProviderActionAdapterSupport.stableSuffix(documentId + request.idempotencyKey))")
        ]) { _, new in new })
    }

    private func applyDocumentUpdate(
        request: MarketplaceProviderActionAdapterRequest,
        accessToken: String
    ) throws -> GoogleDocsProviderActionClientResult {
        let documentId = try GoogleDocsProviderActionAdapterSupport.documentId(from: request.payload)
        let requests = GoogleDocsProviderActionAdapterSupport.array(request.payload["requests"])
        guard !requests.isEmpty else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "google_docs_update_missing_requests",
                message: "Google Docs update requires at least one Docs API batchUpdate request."
            )
        }
        var body: JSONRecord = ["requests": .array(requests)]
        if let requiredRevisionId = request.payload["requiredRevisionId"]?.string?.trimmedNonEmpty {
            body["writeControl"] = .object(["requiredRevisionId": .string(requiredRevisionId)])
        }
        let response = try postJSON(
            path: "/v1/documents/\(Self.pathEncode(documentId)):batchUpdate",
            body: body,
            accessToken: accessToken
        )
        let record = try Self.parseJSONResponse(response, code: "google_docs_update_http_error")
        let writeControl = GoogleDocsProviderActionAdapterSupport.object(record["writeControl"])
        return GoogleDocsProviderActionClientResult(result: GoogleDocsProviderActionAdapterSupport.baseResult(
            request: request,
            clientMode: "live-google-docs-api",
            fakeAdapter: false,
            liveCredentialsUsed: true
        ).merging([
            "documentId": .string(documentId),
            "revisionId": writeControl?["requiredRevisionId"] ?? record["revisionId"] ?? .null,
            "requestCount": .number(Double(requests.count)),
            "requiredRevisionId": request.payload["requiredRevisionId"] ?? .null,
            "auditId": .string("audit-\(GoogleDocsProviderActionAdapterSupport.stableSuffix(documentId + request.idempotencyKey))")
        ]) { _, new in new })
    }

    private func refreshAccessToken(
        credentials: Credentials,
        connection: MarketplaceProviderConnection
    ) throws -> String {
        guard let url = URL(string: "https://oauth2.googleapis.com/token") else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "google_docs_token_url_unavailable",
                message: "Google OAuth token endpoint is unavailable."
            )
        }
        let body = [
            ("client_id", credentials.clientId),
            ("client_secret", credentials.clientSecret),
            ("refresh_token", credentials.refreshToken),
            ("grant_type", "refresh_token")
        ]
        .map { "\($0.0)=\(Self.formEncode($0.1))" }
        .joined(separator: "&")
        let response = try httpClient.send(GoogleDocsProviderHTTPRequest(
            method: "POST",
            url: url,
            headers: [
                "Accept": "application/json",
                "Content-Type": "application/x-www-form-urlencoded"
            ],
            body: Data(body.utf8)
        ))
        guard (200..<300).contains(response.statusCode) else {
            markConnectionError(
                connection: connection,
                code: "google_docs_oauth_refresh_failed",
                message: "Google rejected the saved Google Docs refresh credentials. Reconnect Google Docs in Marketplace."
            )
            throw MarketplaceProviderActionAdapterFailure(
                code: "google_docs_oauth_refresh_failed",
                message: "Google rejected the saved Google Docs refresh credentials. Reconnect Google Docs in Marketplace.",
                providerStatusCode: response.statusCode,
                detail: ["body": .string(Self.bodySnippet(response.body))]
            )
        }
        let record = try Self.parseJSONResponse(response, code: "google_docs_oauth_refresh_invalid_json")
        guard let accessToken = record["access_token"]?.string?.trimmedNonEmpty else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "google_docs_oauth_refresh_missing_access_token",
                message: "Google OAuth refresh response did not include an access token."
            )
        }
        return accessToken
    }

    private func get(path: String, accessToken: String) throws -> GoogleDocsProviderHTTPResponse {
        var components = URLComponents()
        components.scheme = "https"
        components.host = "docs.googleapis.com"
        components.path = path
        guard let url = components.url else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "google_docs_url_invalid",
                message: "Could not build Google Docs API request URL.",
                detail: ["path": .string(path)]
            )
        }
        return try httpClient.send(GoogleDocsProviderHTTPRequest(
            method: "GET",
            url: url,
            headers: [
                "Authorization": "Bearer \(accessToken)",
                "Accept": "application/json"
            ]
        ))
    }

    private func postJSON(path: String, body: JSONRecord, accessToken: String) throws -> GoogleDocsProviderHTTPResponse {
        var components = URLComponents()
        components.scheme = "https"
        components.host = "docs.googleapis.com"
        components.path = path
        guard let url = components.url else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "google_docs_url_invalid",
                message: "Could not build Google Docs API request URL.",
                detail: ["path": .string(path)]
            )
        }
        let bodyData = try jsonEncoder.encode(JSONValue.object(body))
        return try httpClient.send(GoogleDocsProviderHTTPRequest(
            method: "POST",
            url: url,
            headers: [
                "Authorization": "Bearer \(accessToken)",
                "Accept": "application/json",
                "Content-Type": "application/json"
            ],
            body: bodyData
        ))
    }

    private func connection(for request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderConnection {
        guard let connectionId = request.auditIdentity.connectionId?.trimmedNonEmpty,
              let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: connectionId),
              connection.appId == request.app.id,
              connection.appSlug == request.app.slug else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "google_docs_connection_missing",
                message: "Google Docs execution requires a Relay Marketplace provider connection."
            )
        }
        return connection
    }

    private func requireReady(connection: MarketplaceProviderConnection, actionKey: String) throws {
        guard connection.status == .connected || connection.status == .healthError else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "google_docs_connection_not_ready",
                message: "The Google Docs provider connection is not ready.",
                detail: ["connectionStatus": .string(connection.status.rawValue)]
            )
        }
        if connection.credentialOwnership == .relayOwned {
            guard connection.grantedScopes == ProviderConnectionService.googleDocsRelayOwnedOAuthScopes,
                  connection.health.diagnostics["documentTargetRequired"]?.bool == true,
                  connection.health.diagnostics["apiOrigin"]?.string == "https://docs.googleapis.com/v1"
            else {
                throw MarketplaceProviderActionAdapterFailure(
                    code: "google_docs_relay_owned_boundary_invalid",
                    message: "Google Docs requires an exact-scope document-targeted Relay-owned connection."
                )
            }
        }
        let granted = Set(connection.grantedScopes.map { $0.lowercased() })
        let required = Self.requiredScopes(
            for: actionKey,
            credentialOwnership: connection.credentialOwnership
        )
        let missing = required.filter { !granted.contains($0.lowercased()) }
        guard missing.isEmpty else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "google_docs_missing_scope",
                message: "The saved Google Docs connection is missing required scope(s).",
                detail: [
                    "actionKey": .string(actionKey),
                    "missingScopes": .array(missing.map(JSONValue.string))
                ]
            )
        }
    }

    private static func requiredScopes(
        for actionKey: String,
        credentialOwnership: ProviderCredentialOwnership
    ) -> [String] {
        switch actionKey {
        case "google_docs_read_document", "google_docs_create_document", "google_docs_apply_document_update":
            return credentialOwnership == .relayOwned
                ? ProviderConnectionService.googleDocsRelayOwnedOAuthScopes
                : ProviderConnectionService.googleDocsOAuthScopes
        default:
            return []
        }
    }

    private func credentials(for connection: MarketplaceProviderConnection) throws -> Credentials {
        Credentials(
            clientId: try secret(fieldKey: "google_docs_oauth_client_id", connection: connection),
            clientSecret: try secret(fieldKey: "google_docs_oauth_client_secret", connection: connection),
            refreshToken: try secret(fieldKey: "google_docs_oauth_refresh_token", connection: connection)
        )
    }

    private func secret(fieldKey: String, connection: MarketplaceProviderConnection) throws -> String {
        guard let secretId = connection.credentialRequirements.first(where: { $0.fieldKey == fieldKey })?.secretReferenceId else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "google_docs_credentials_missing",
                message: "The Google Docs provider connection is missing a required Keychain secret reference.",
                detail: ["fieldKey": .string(fieldKey)]
            )
        }
        do {
            return try secrets.getSecretValue(secretId)
        } catch {
            markConnectionError(
                connection: connection,
                code: "google_docs_credentials_unavailable",
                message: "Relay could not read the saved Google Docs credential from the OS secret store. Reconnect Google Docs in Marketplace."
            )
            throw MarketplaceProviderActionAdapterFailure(
                code: "google_docs_credentials_unavailable",
                message: "Relay could not read the saved Google Docs credential from the OS secret store. Reconnect Google Docs in Marketplace.",
                detail: ["fieldKey": .string(fieldKey)]
            )
        }
    }

    private func markConnectionError(connection: MarketplaceProviderConnection, code: String, message: String) {
        var updated = connection
        updated.status = .healthError
        updated.authorizationState = .error
        updated.reauthorizeRequired = true
        updated.lastCheckedAt = nowIso()
        updated.lastError = message
        updated.health = ProviderConnectorHealth(
            state: .error,
            message: message,
            lastCheckedAt: updated.lastCheckedAt,
            missingScopes: [],
            unavailableTools: ["google_docs_read_document", "google_docs_create_document", "google_docs_apply_document_update"],
            diagnostics: [
                "provider": .string("google-docs"),
                "reasonCode": .string(code),
                "redactionStatus": .string("private-state-excluded")
            ],
            redactionStatus: "private-state-excluded"
        )
        DispatchQueue.global(qos: .utility).async { [data] in
            _ = try? data.saveProviderConnection(updated)
        }
    }

    private static func parseJSONResponse(_ response: GoogleDocsProviderHTTPResponse, code: String) throws -> JSONRecord {
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: code,
                message: "Google Docs API returned HTTP \(response.statusCode).",
                providerStatusCode: response.statusCode,
                detail: ["body": .string(bodySnippet(response.body))]
            )
        }
        if response.body.isEmpty {
            return [:]
        }
        guard let json = try JSONSerialization.jsonObject(with: response.body) as? [String: Any] else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "google_docs_invalid_json",
                message: "Google Docs API returned a non-object JSON response."
            )
        }
        return jsonRecord(from: json)
    }

    private static func jsonRecord(from object: [String: Any]) -> JSONRecord {
        object.reduce(into: JSONRecord()) { partial, element in
            partial[element.key] = jsonValue(from: element.value)
        }
    }

    private static func jsonValue(from value: Any) -> JSONValue {
        switch value {
        case let string as String:
            return .string(string)
        case let number as NSNumber:
            if CFGetTypeID(number) == CFBooleanGetTypeID() {
                return .bool(number.boolValue)
            }
            return .number(number.doubleValue)
        case let object as [String: Any]:
            return .object(jsonRecord(from: object))
        case let array as [Any]:
            return .array(array.map(jsonValue(from:)))
        default:
            return .null
        }
    }

    private static func formEncode(_ value: String) -> String {
        value.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? value
    }

    private static func pathEncode(_ value: String) -> String {
        value.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? value
    }

    private static func bodySnippet(_ data: Data) -> String {
        let text = String(data: data, encoding: .utf8) ?? ""
        return String(text.prefix(500))
    }
}

public struct GoogleDocsProviderActionAdapter: MarketplaceProviderActionAdapter {
    fileprivate static let safeActionKeys: Set<String> = [
        "google_docs_read_document",
        "google_docs_prepare_document_update",
        "google_docs_create_document",
        "google_docs_apply_document_update"
    ]

    private let client: any GoogleDocsProviderActionClient

    public init(client: any GoogleDocsProviderActionClient = MissingGoogleDocsProviderActionClient()) {
        self.client = client
    }

    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "google-docs" else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "google_docs_adapter_wrong_provider",
                message: "Google Docs adapter can only execute Google Docs provider actions.",
                detail: ["appSlug": .string(request.app.slug)]
            )
        }
        guard Self.safeActionKeys.contains(request.definition.actionKey) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "google_docs_action_not_allowlisted",
                message: "The requested Google Docs action is not in the V1 adapter allowlist.",
                detail: ["actionKey": .string(request.definition.actionKey)]
            )
        }
        if request.definition.actionKey == "google_docs_prepare_document_update" {
            return MarketplaceProviderActionAdapterResult(result: [
                "adapterBoundary": .string("google-docs-provider-action-adapter"),
                "clientMode": .string("local-google-docs-draft"),
                "provider": .string("google-docs"),
                "permission": .string(request.permission.rawValue),
                "payloadHash": .string(MarketplaceProviderActionApprovalService.payloadHash(request.payload)),
                "approved": .bool(request.approvalReference?.status == .approved),
                "idempotencyKey": .string(request.idempotencyKey),
                "actionKey": .string(request.definition.actionKey),
                "fakeAdapter": .bool(false),
                "liveCredentialsUsed": .bool(false),
                "simulated": .bool(false),
                "draftPreview": .object(GoogleDocsProviderActionAdapterSupport.draftPreview(request: request)),
                "redactionStatus": .string("private-state-excluded")
            ])
        }
        let output = try client.executeGoogleDocsAction(request: request)
        return MarketplaceProviderActionAdapterResult(
            result: output.result,
            error: nil,
            redactionStatus: output.redactionStatus
        )
    }
}

private enum GoogleDocsProviderActionAdapterSupport {
    static func baseResult(
        request: MarketplaceProviderActionAdapterRequest,
        clientMode: String,
        fakeAdapter: Bool,
        liveCredentialsUsed: Bool
    ) -> JSONRecord {
        [
            "adapterBoundary": .string("google-docs-provider-action-adapter"),
            "clientMode": .string(clientMode),
            "provider": .string("google-docs"),
            "permission": .string(request.permission.rawValue),
            "payloadHash": .string(MarketplaceProviderActionApprovalService.payloadHash(request.payload)),
            "approved": .bool(request.approvalReference?.status == .approved),
            "idempotencyKey": .string(request.idempotencyKey),
            "actionKey": .string(request.definition.actionKey),
            "fakeAdapter": .bool(fakeAdapter),
            "liveCredentialsUsed": .bool(liveCredentialsUsed),
            "simulated": .bool(fakeAdapter),
            "redactionStatus": .string("private-state-excluded")
        ]
    }

    static func documentId(from payload: JSONRecord) throws -> String {
        let value = payload["documentIdOrUrl"]?.string?.trimmedNonEmpty
            ?? payload["documentId"]?.string?.trimmedNonEmpty
            ?? payload["url"]?.string?.trimmedNonEmpty
        guard let raw = value else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "google_docs_payload_missing_document_id",
                message: "Google Docs actions require a document ID or URL."
            )
        }
        if raw.contains("/document/d/") {
            let parts = raw.components(separatedBy: "/document/d/")
            if parts.count > 1 {
                let suffix = parts[1]
                let id = suffix.split(separator: "/").first.map(String.init) ?? ""
                if !id.isEmpty {
                    return id
                }
            }
        }
        return raw
            .replacingOccurrences(of: "https://docs.google.com/document/d/", with: "")
            .split(separator: "/")
            .first
            .map(String.init) ?? raw
    }

    static func documentWritePayload(
        request: MarketplaceProviderActionAdapterRequest,
        requireDocumentId: Bool
    ) throws -> (documentId: String?, title: String, body: String) {
        let documentId = requireDocumentId ? try documentId(from: request.payload) : nil
        let title = request.payload["title"]?.string?.trimmedNonEmpty ?? "Untitled Relay document"
        let body = request.payload["body"]?.string ?? request.payload["bodyText"]?.string ?? ""
        guard title.count <= 300 else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "google_docs_title_too_long",
                message: "Google Docs document titles are limited to 300 characters in the V1 adapter."
            )
        }
        guard body.count <= 100_000 else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "google_docs_body_too_long",
                message: "Google Docs document body is too long for the V1 adapter."
            )
        }
        return (documentId, title, body)
    }

    static func draftPreview(request: MarketplaceProviderActionAdapterRequest) -> JSONRecord {
        let operation = request.payload["operation"]?.string?.trimmedNonEmpty ?? "update"
        let title = request.payload["title"]?.string?.trimmedNonEmpty
        let body = request.payload["body"]?.string ?? request.payload["bodyText"]?.string ?? ""
        let preview = String(body.prefix(1200))
        return [
            "operation": .string(operation),
            "documentIdOrUrl": request.payload["documentIdOrUrl"] ?? .null,
            "title": title.map(JSONValue.string) ?? .null,
            "bodyPreview": preview.isEmpty ? .null : .string(preview),
            "bodyCharacterCount": .number(Double(body.count)),
            "bodyTruncated": .bool(body.count > preview.count),
            "requiredRevisionId": request.payload["requiredRevisionId"] ?? .null,
            "approvalPayloadHash": .string(MarketplaceProviderActionApprovalService.payloadHash(request.payload)),
            "redactionStatus": .string("private-state-excluded")
        ]
    }

    static func documentResult(
        documentId: String,
        title: String,
        revisionId: String?,
        text: String,
        maxBodyChars: Int,
        headings: [String],
        tableText: [String]
    ) -> JSONRecord {
        let bounded = String(text.prefix(maxBodyChars))
        return [
            "id": .string(documentId),
            "documentId": .string(documentId),
            "title": .string(title),
            "revisionId": revisionId.map(JSONValue.string) ?? .null,
            "headings": .array(headings.prefix(20).map(JSONValue.string)),
            "text": bounded.isEmpty ? .null : .string(bounded),
            "textCharCount": .number(Double(bounded.count)),
            "textTruncated": .bool(text.count > bounded.count),
            "tableText": .array(tableText.prefix(20).map(JSONValue.string)),
            "semanticFieldsReturned": .array(["documentId", "title", "revisionId", "headings", "text"].map(JSONValue.string)),
            "redactionStatus": .string("private-state-excluded")
        ]
    }

    static func extractDocumentText(from record: JSONRecord, maxBodyChars: Int) -> (text: String, headings: [String], tableText: [String]) {
        guard let body = object(record["body"]) else {
            return ("", [], [])
        }
        let content = array(body["content"])
        var paragraphs: [String] = []
        var headings: [String] = []
        var tables: [String] = []
        for value in content {
            guard let element = object(value) else { continue }
            if let paragraph = object(element["paragraph"]) {
                let text = paragraphText(paragraph)
                if !text.isEmpty {
                    paragraphs.append(text)
                    let style = object(paragraph["paragraphStyle"])
                    if style?["namedStyleType"]?.string?.uppercased().hasPrefix("HEADING") == true {
                        headings.append(text)
                    }
                }
            }
            if let table = object(element["table"]) {
                let tableLine = tableText(table)
                if !tableLine.isEmpty {
                    tables.append(tableLine)
                    paragraphs.append(tableLine)
                }
            }
            if paragraphs.joined(separator: "\n").count >= maxBodyChars {
                break
            }
        }
        return (paragraphs.joined(separator: "\n"), headings, tables)
    }

    private static func paragraphText(_ paragraph: JSONRecord) -> String {
        array(paragraph["elements"]).compactMap { value -> String? in
            guard let element = object(value),
                  let textRun = object(element["textRun"]),
                  let content = textRun["content"]?.string else {
                return nil
            }
            return content
        }
        .joined()
        .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static func tableText(_ table: JSONRecord) -> String {
        array(table["tableRows"]).compactMap { rowValue -> String? in
            guard let row = object(rowValue) else { return nil }
            let cells = array(row["tableCells"]).compactMap { cellValue -> String? in
                guard let cell = object(cellValue) else { return nil }
                let parts = array(cell["content"]).compactMap { contentValue -> String? in
                    guard let content = object(contentValue),
                          let paragraph = object(content["paragraph"]) else {
                        return nil
                    }
                    return paragraphText(paragraph)
                }.filter { !$0.isEmpty }
                return parts.joined(separator: " ")
            }.filter { !$0.isEmpty }
            return cells.joined(separator: " | ")
        }
        .filter { !$0.isEmpty }
        .joined(separator: "\n")
    }

    static func boundedInt(_ value: JSONValue?, defaultValue: Int, minValue: Int, maxValue: Int) -> Int {
        let raw: Int?
        if let number = value?.number {
            raw = Int(number)
        } else if let string = value?.string?.trimmedNonEmpty {
            raw = Int(string)
        } else {
            raw = nil
        }
        return max(minValue, min(maxValue, raw ?? defaultValue))
    }

    static func object(_ value: JSONValue?) -> JSONRecord? {
        if case .object(let object)? = value {
            return object
        }
        return nil
    }

    static func array(_ value: JSONValue?) -> [JSONValue] {
        if case .array(let array)? = value {
            return array
        }
        return []
    }

    static func stableSuffix(_ value: String) -> String {
        var hash: UInt64 = 1469598103934665603
        for byte in value.utf8 {
            hash ^= UInt64(byte)
            hash &*= 1099511628211
        }
        return String(String(hash, radix: 16).suffix(10))
    }
}

private extension String {
    var trimmedNonEmpty: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}
