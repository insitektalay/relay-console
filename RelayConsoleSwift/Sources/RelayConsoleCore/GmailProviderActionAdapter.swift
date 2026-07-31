import Foundation

public struct GmailProviderActionClientResult: Codable, Equatable, Sendable {
    public var result: JSONRecord
    public var redactionStatus: String

    public init(result: JSONRecord, redactionStatus: String = "private-state-excluded") {
        self.result = result
        self.redactionStatus = redactionStatus
    }
}

public protocol GmailProviderActionClient: Sendable {
    func executeGmailAction(request: MarketplaceProviderActionAdapterRequest) throws -> GmailProviderActionClientResult
}

public struct GmailProviderHTTPRequest: Sendable, Equatable {
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

public struct GmailProviderHTTPResponse: Sendable, Equatable {
    public var statusCode: Int
    public var body: Data

    public init(statusCode: Int, body: Data = Data()) {
        self.statusCode = statusCode
        self.body = body
    }
}

public protocol GmailProviderHTTPClient: Sendable {
    func send(_ request: GmailProviderHTTPRequest) throws -> GmailProviderHTTPResponse
}

public struct URLSessionGmailProviderHTTPClient: GmailProviderHTTPClient {
    private let timeoutSeconds: TimeInterval

    public init(timeoutSeconds: TimeInterval = 30) {
        self.timeoutSeconds = timeoutSeconds
    }

    public func send(_ request: GmailProviderHTTPRequest) throws -> GmailProviderHTTPResponse {
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
                code: "gmail_http_timeout",
                message: "Gmail API request timed out.",
                detail: ["urlHost": .string(request.url.host ?? "gmail.googleapis.com")]
            )
        }
        if let responseError {
            throw responseError
        }
        return GmailProviderHTTPResponse(statusCode: responseStatusCode ?? 0, body: responseData ?? Data())
    }
}

public struct MissingGmailProviderActionClient: GmailProviderActionClient {
    public init() {}

    public func executeGmailAction(request: MarketplaceProviderActionAdapterRequest) throws -> GmailProviderActionClientResult {
        throw MarketplaceProviderActionAdapterFailure(
            code: "gmail_live_adapter_missing",
            message: "Not executed against Gmail: live Gmail API execution is not configured in this runtime.",
            detail: [
                "actionKey": .string(request.definition.actionKey),
                "liveAdapterMissing": .bool(true),
                "provider": .string("gmail")
            ]
        )
    }
}

public final class LiveGmailProviderActionClient: GmailProviderActionClient, @unchecked Sendable {
    private struct Credentials {
        var clientId: String
        var clientSecret: String
        var refreshToken: String
    }

    private let data: LocalDataService
    private let secrets: SecretService
    private let httpClient: any GmailProviderHTTPClient
    private let jsonEncoder = JSONEncoder()

    public init(
        data: LocalDataService,
        secrets: SecretService,
        httpClient: any GmailProviderHTTPClient = URLSessionGmailProviderHTTPClient()
    ) {
        self.data = data
        self.secrets = secrets
        self.httpClient = httpClient
    }

    public func executeGmailAction(request: MarketplaceProviderActionAdapterRequest) throws -> GmailProviderActionClientResult {
        let connection = try connection(for: request)
        try requireReady(connection: connection, actionKey: request.definition.actionKey)
        let accessToken: String
        if connection.credentialOwnership == .relayOwned {
            accessToken = try secret(fieldKey: "google_oauth_access_token", connection: connection)
        } else {
            accessToken = try refreshAccessToken(credentials: try credentials(for: connection), connection: connection)
        }
        switch request.definition.actionKey {
        case "gmail.messages.search":
            return try searchMessages(request: request, accessToken: accessToken)
        case "gmail.message.read":
            return try readMessage(request: request, accessToken: accessToken)
        case "gmail.labels.list":
            return try listLabels(request: request, accessToken: accessToken)
        case "gmail.draft.create":
            return try createDraft(request: request, accessToken: accessToken)
        case "gmail.email.send":
            return try sendEmail(request: request, accessToken: accessToken)
        default:
            throw MarketplaceProviderActionAdapterFailure(
                code: "gmail_action_not_allowlisted",
                message: "The requested Gmail action is not in the V1 live adapter allowlist.",
                detail: ["actionKey": .string(request.definition.actionKey)]
            )
        }
    }

    private func searchMessages(
        request: MarketplaceProviderActionAdapterRequest,
        accessToken: String
    ) throws -> GmailProviderActionClientResult {
        let query = request.payload["query"]?.string?.nilIfEmpty ?? "in:anywhere newer_than:30d"
        let maxResults = Self.maxResults(from: request.payload, fallback: 5, maximum: 20)
        let response = try get(
            path: "/gmail/v1/users/me/messages",
            query: [
                URLQueryItem(name: "q", value: query),
                URLQueryItem(name: "maxResults", value: String(maxResults))
            ],
            accessToken: accessToken
        )
        let record = try Self.parseJSONResponse(response, code: "gmail_search_http_error")
        let messageRefs = Self.array(record["messages"]).prefix(maxResults).compactMap { value -> JSONRecord? in
            guard let object = Self.object(value) else { return nil }
            return object
        }
        let messages = try messageRefs.compactMap { object -> JSONValue? in
            guard let messageId = object["id"]?.string?.nilIfEmpty else { return nil }
            let detailResponse = try get(
                path: "/gmail/v1/users/me/messages/\(Self.pathEncode(messageId))",
                query: Self.metadataQueryItems(),
                accessToken: accessToken
            )
            let detail = try Self.parseJSONResponse(detailResponse, code: "gmail_search_detail_http_error")
            return .object(Self.messageSummary(
                from: detail,
                requestedMessageId: messageId,
                includeBody: false,
                maxBodyChars: 0
            ))
        }
        return GmailProviderActionClientResult(result: baseResult(request: request).merging([
            "clientMode": .string("live-gmail-api"),
            "fakeAdapter": .bool(false),
            "liveCredentialsUsed": .bool(true),
            "query": .string(query),
            "resultSizeEstimate": record["resultSizeEstimate"] ?? .number(Double(messages.count)),
            "messages": .array(Array(messages)),
            "semanticReadContract": .string("gmail-search-summary-v1")
        ]) { _, new in new })
    }

    private func readMessage(
        request: MarketplaceProviderActionAdapterRequest,
        accessToken: String
    ) throws -> GmailProviderActionClientResult {
        let messageId = try Self.requiredPayloadString(request: request, key: "messageId", label: "message ID")
        let readFormat = Self.readFormat(from: request.payload)
        let includeBody = readFormat != "metadata"
        let maxBodyChars = Self.maxBodyChars(from: request.payload)
        let response = try get(
            path: "/gmail/v1/users/me/messages/\(Self.pathEncode(messageId))",
            query: includeBody ? [URLQueryItem(name: "format", value: "full")] : Self.metadataQueryItems(),
            accessToken: accessToken
        )
        let record = try Self.parseJSONResponse(response, code: "gmail_message_read_http_error")
        return GmailProviderActionClientResult(result: baseResult(request: request).merging([
            "clientMode": .string("live-gmail-api"),
            "fakeAdapter": .bool(false),
            "liveCredentialsUsed": .bool(true),
            "readFormat": .string(readFormat),
            "maxBodyChars": .number(Double(maxBodyChars)),
            "semanticReadContract": .string("gmail-message-summary-v1"),
            "message": .object(Self.messageSummary(
                from: record,
                requestedMessageId: messageId,
                includeBody: includeBody,
                maxBodyChars: maxBodyChars
            ))
        ]) { _, new in new })
    }

    private func listLabels(
        request: MarketplaceProviderActionAdapterRequest,
        accessToken: String
    ) throws -> GmailProviderActionClientResult {
        let response = try get(path: "/gmail/v1/users/me/labels", query: [], accessToken: accessToken)
        let record = try Self.parseJSONResponse(response, code: "gmail_labels_http_error")
        let labels = Self.array(record["labels"]).prefix(40).compactMap { value -> JSONValue? in
            guard let object = Self.object(value) else { return nil }
            let type = object["type"]?.string ?? "unknown"
            let name = object["name"]?.string ?? object["id"]?.string ?? "label"
            return .object([
                "id": object["id"] ?? .null,
                "name": .string(type == "system" ? name : "user-label-redacted"),
                "type": .string(type),
                "redactionStatus": .string("private-state-excluded")
            ])
        }
        return GmailProviderActionClientResult(result: baseResult(request: request).merging([
            "clientMode": .string("live-gmail-api"),
            "fakeAdapter": .bool(false),
            "liveCredentialsUsed": .bool(true),
            "labelCount": .number(Double(Self.array(record["labels"]).count)),
            "labels": .array(Array(labels))
        ]) { _, new in new })
    }

    private func createDraft(
        request: MarketplaceProviderActionAdapterRequest,
        accessToken: String
    ) throws -> GmailProviderActionClientResult {
        let email = try Self.emailPayload(request: request)
        let response = try postJSON(
            path: "/gmail/v1/users/me/drafts",
            body: ["message": .object(["raw": .string(Self.rawMessage(email: email))])],
            accessToken: accessToken
        )
        let record = try Self.parseJSONResponse(response, code: "gmail_draft_create_http_error")
        let message = Self.object(record["message"])
        var result = baseResult(request: request)
        result["clientMode"] = .string("live-gmail-api")
        result["fakeAdapter"] = .bool(false)
        result["liveCredentialsUsed"] = .bool(true)
        result["draftId"] = record["id"] ?? .null
        result["messageId"] = message?["id"] ?? .null
        result["threadId"] = message?["threadId"] ?? .null
        result["toCount"] = .number(Double(email.to.count))
        result["ccCount"] = .number(Double(email.cc.count))
        result["bccCount"] = .number(Double(email.bcc.count))
        result["bodyCharacterCount"] = .number(Double(email.body.count))
        result["sent"] = .bool(false)
        return GmailProviderActionClientResult(result: result)
    }

    private func sendEmail(
        request: MarketplaceProviderActionAdapterRequest,
        accessToken: String
    ) throws -> GmailProviderActionClientResult {
        let email = try Self.emailPayload(request: request)
        let response = try postJSON(
            path: "/gmail/v1/users/me/messages/send",
            body: ["raw": .string(Self.rawMessage(email: email))],
            accessToken: accessToken
        )
        let record = try Self.parseJSONResponse(response, code: "gmail_send_http_error")
        var result = baseResult(request: request)
        result["clientMode"] = .string("live-gmail-api")
        result["fakeAdapter"] = .bool(false)
        result["liveCredentialsUsed"] = .bool(true)
        result["messageId"] = record["id"] ?? .null
        result["threadId"] = record["threadId"] ?? .null
        result["toCount"] = .number(Double(email.to.count))
        result["ccCount"] = .number(Double(email.cc.count))
        result["bccCount"] = .number(Double(email.bcc.count))
        result["bodyCharacterCount"] = .number(Double(email.body.count))
        result["sent"] = .bool(true)
        return GmailProviderActionClientResult(result: result)
    }

    private func refreshAccessToken(
        credentials: Credentials,
        connection: MarketplaceProviderConnection
    ) throws -> String {
        guard let url = URL(string: "https://oauth2.googleapis.com/token") else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "gmail_token_url_unavailable",
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
        let response = try httpClient.send(GmailProviderHTTPRequest(
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
                code: "gmail_oauth_refresh_failed",
                message: "Google rejected the saved Gmail refresh credentials. Reconnect Gmail in Marketplace.",
                unavailableTools: ["gmail.messages.search", "gmail.message.read", "gmail.labels.list", "gmail.draft.create", "gmail.email.send"]
            )
            throw MarketplaceProviderActionAdapterFailure(
                code: "gmail_oauth_refresh_failed",
                message: "Google rejected the saved Gmail refresh credentials. Reconnect Gmail in Marketplace.",
                providerStatusCode: response.statusCode,
                detail: ["body": .string(Self.bodySnippet(response.body))]
            )
        }
        let record = try Self.parseJSONResponse(response, code: "gmail_oauth_refresh_invalid_json")
        guard let accessToken = record["access_token"]?.string?.nilIfEmpty else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "gmail_oauth_refresh_missing_access_token",
                message: "Google OAuth refresh response did not include an access token."
            )
        }
        return accessToken
    }

    private func get(path: String, query: [URLQueryItem], accessToken: String) throws -> GmailProviderHTTPResponse {
        var components = URLComponents()
        components.scheme = "https"
        components.host = "gmail.googleapis.com"
        components.path = path
        components.queryItems = query.isEmpty ? nil : query
        guard let url = components.url else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "gmail_url_invalid",
                message: "Could not build Gmail API request URL.",
                detail: ["path": .string(path)]
            )
        }
        return try httpClient.send(GmailProviderHTTPRequest(
            method: "GET",
            url: url,
            headers: [
                "Authorization": "Bearer \(accessToken)",
                "Accept": "application/json"
            ]
        ))
    }

    private func postJSON(path: String, body: JSONRecord, accessToken: String) throws -> GmailProviderHTTPResponse {
        var components = URLComponents()
        components.scheme = "https"
        components.host = "gmail.googleapis.com"
        components.path = path
        guard let url = components.url else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "gmail_url_invalid",
                message: "Could not build Gmail API request URL.",
                detail: ["path": .string(path)]
            )
        }
        let bodyData = try jsonEncoder.encode(JSONValue.object(body))
        return try httpClient.send(GmailProviderHTTPRequest(
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
        guard let connectionId = request.auditIdentity.connectionId?.nilIfEmpty,
              let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: connectionId),
              connection.appId == request.app.id,
              connection.appSlug == request.app.slug else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "gmail_connection_missing",
                message: "Gmail execution requires a Relay Marketplace provider connection."
            )
        }
        return connection
    }

    private func requireReady(connection: MarketplaceProviderConnection, actionKey: String) throws {
        guard connection.status == .connected || connection.status == .healthError else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "gmail_connection_not_ready",
                message: "The Gmail provider connection is not ready.",
                detail: ["connectionStatus": .string(connection.status.rawValue)]
            )
        }
        let granted = Set(connection.grantedScopes.map { $0.lowercased() })
        let required = Self.requiredScopes(for: actionKey)
        let missing = required.filter { !granted.contains($0.lowercased()) }
        guard missing.isEmpty else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "gmail_missing_scope",
                message: "The saved Gmail connection is missing required scope(s).",
                detail: [
                    "actionKey": .string(actionKey),
                    "missingScopes": .array(missing.map(JSONValue.string))
                ]
            )
        }
    }

    private static func requiredScopes(for actionKey: String) -> [String] {
        switch actionKey {
        case "gmail.messages.search", "gmail.message.read", "gmail.labels.list":
            return ["https://www.googleapis.com/auth/gmail.readonly"]
        case "gmail.draft.create", "gmail.email.send":
            return ["https://www.googleapis.com/auth/gmail.compose"]
        default:
            return []
        }
    }

    private func credentials(for connection: MarketplaceProviderConnection) throws -> Credentials {
        Credentials(
            clientId: try secret(fieldKey: "google_oauth_client_id", connection: connection),
            clientSecret: try secret(fieldKey: "google_oauth_client_secret", connection: connection),
            refreshToken: try secret(fieldKey: "google_oauth_refresh_token", connection: connection)
        )
    }

    private func secret(fieldKey: String, connection: MarketplaceProviderConnection) throws -> String {
        guard let secretId = connection.credentialRequirements.first(where: { $0.fieldKey == fieldKey })?.secretReferenceId else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "gmail_credentials_missing",
                message: "The Gmail provider connection is missing a required Keychain secret reference.",
                detail: ["fieldKey": .string(fieldKey)]
            )
        }
        do {
            return try secrets.getSecretValue(secretId)
        } catch {
            markConnectionError(
                connection: connection,
                code: "gmail_credentials_unavailable",
                message: "Relay could not read the saved Gmail credential from the OS secret store. Reconnect Gmail in Marketplace.",
                unavailableTools: ["gmail.messages.search", "gmail.message.read", "gmail.labels.list", "gmail.draft.create", "gmail.email.send"]
            )
            throw MarketplaceProviderActionAdapterFailure(
                code: "gmail_credentials_unavailable",
                message: "Relay could not read the saved Gmail credential from the OS secret store. Reconnect Gmail in Marketplace.",
                detail: ["fieldKey": .string(fieldKey)]
            )
        }
    }

    private func markConnectionError(
        connection: MarketplaceProviderConnection,
        code: String,
        message: String,
        unavailableTools: [String]
    ) {
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
            unavailableTools: unavailableTools,
            diagnostics: [
                "provider": .string("gmail"),
                "reasonCode": .string(code),
                "redactionStatus": .string("private-state-excluded")
            ],
            redactionStatus: "private-state-excluded"
        )
        DispatchQueue.global(qos: .utility).async { [data] in
            _ = try? data.saveProviderConnection(updated)
        }
    }

    private func baseResult(request: MarketplaceProviderActionAdapterRequest) -> JSONRecord {
        [
            "adapterBoundary": .string("gmail-provider-action-adapter"),
            "provider": .string("gmail"),
            "permission": .string(request.permission.rawValue),
            "payloadHash": .string(MarketplaceProviderActionApprovalService.payloadHash(request.payload)),
            "approved": .bool(request.approvalReference?.status == .approved),
            "idempotencyKey": .string(request.idempotencyKey),
            "actionKey": .string(request.definition.actionKey),
            "redactionStatus": .string("private-state-excluded")
        ]
    }

    private static func emailPayload(request: MarketplaceProviderActionAdapterRequest) throws -> (to: [String], cc: [String], bcc: [String], subject: String, body: String) {
        let to = try recipients(request: request, key: "to", required: true)
        let cc = try recipients(request: request, key: "cc", required: false)
        let bcc = try recipients(request: request, key: "bcc", required: false)
        let subject = sanitizedHeaderValue(try requiredPayloadString(request: request, key: "subject", label: "subject"))
        let body = try requiredPayloadString(request: request, key: "body", label: "body")
        guard subject.count <= 998 else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "gmail_subject_too_long",
                message: "Gmail email subject is too long for the V1 adapter."
            )
        }
        guard body.count <= 100_000 else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "gmail_body_too_long",
                message: "Gmail email body is too long for the V1 adapter."
            )
        }
        return (to, cc, bcc, subject, body)
    }

    private static func recipients(
        request: MarketplaceProviderActionAdapterRequest,
        key: String,
        required: Bool
    ) throws -> [String] {
        if case .array(let values)? = request.payload[key] {
            let recipients = values.compactMap { value -> String? in
                guard let string = value.string?.trimmingCharacters(in: .whitespacesAndNewlines), !string.isEmpty else {
                    return nil
                }
                return sanitizedAddressListItem(string)
            }
            if !recipients.isEmpty {
                return recipients
            }
        }
        if let raw = request.payload[key]?.string?.trimmingCharacters(in: .whitespacesAndNewlines), !raw.isEmpty {
            let recipients = raw
                .split(separator: ",")
                .compactMap { sanitizedAddressListItem(String($0)) }
            if !recipients.isEmpty {
                return recipients
            }
        }
        if required {
            throw MarketplaceProviderActionAdapterFailure(
                code: "gmail_payload_missing_\(key)",
                message: "Gmail email actions require at least one \(key) recipient."
            )
        }
        return []
    }

    private static func requiredPayloadString(
        request: MarketplaceProviderActionAdapterRequest,
        key: String,
        label: String
    ) throws -> String {
        guard let value = request.payload[key]?.string?.trimmingCharacters(in: .whitespacesAndNewlines),
              !value.isEmpty else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "gmail_payload_missing_\(key)",
                message: "Gmail action payload requires a non-empty \(label)."
            )
        }
        return value
    }

    private static func rawMessage(email: (to: [String], cc: [String], bcc: [String], subject: String, body: String)) -> String {
        var lines = [
            "To: \(email.to.joined(separator: ", "))"
        ]
        if !email.cc.isEmpty {
            lines.append("Cc: \(email.cc.joined(separator: ", "))")
        }
        if !email.bcc.isEmpty {
            lines.append("Bcc: \(email.bcc.joined(separator: ", "))")
        }
        lines.append("Subject: \(email.subject)")
        lines.append("Content-Type: text/plain; charset=utf-8")
        lines.append("Content-Transfer-Encoding: 8bit")
        lines.append("")
        lines.append(email.body)
        return base64URLEncoded(Data(lines.joined(separator: "\r\n").utf8))
    }

    private static func sanitizedHeaderValue(_ value: String) -> String {
        value
            .replacingOccurrences(of: "\r", with: " ")
            .replacingOccurrences(of: "\n", with: " ")
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static func sanitizedAddressListItem(_ value: String) -> String? {
        let trimmed = sanitizedHeaderValue(value)
        return trimmed.isEmpty ? nil : trimmed
    }

    private static func base64URLEncoded(_ data: Data) -> String {
        data.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    private static func parseJSONResponse(_ response: GmailProviderHTTPResponse, code: String) throws -> JSONRecord {
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: code,
                message: "Gmail API returned HTTP \(response.statusCode).",
                providerStatusCode: response.statusCode,
                detail: ["body": .string(bodySnippet(response.body))]
            )
        }
        if response.body.isEmpty {
            return [:]
        }
        guard let json = try JSONSerialization.jsonObject(with: response.body) as? [String: Any] else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "gmail_invalid_json",
                message: "Gmail API returned a non-object JSON response."
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

    private static func object(_ value: JSONValue?) -> JSONRecord? {
        if case .object(let object)? = value {
            return object
        }
        return nil
    }

    private static func array(_ value: JSONValue?) -> [JSONValue] {
        if case .array(let array)? = value {
            return array
        }
        return []
    }

    private static func metadataQueryItems() -> [URLQueryItem] {
        [
            URLQueryItem(name: "format", value: "metadata"),
            URLQueryItem(name: "metadataHeaders", value: "From"),
            URLQueryItem(name: "metadataHeaders", value: "To"),
            URLQueryItem(name: "metadataHeaders", value: "Subject"),
            URLQueryItem(name: "metadataHeaders", value: "Date")
        ]
    }

    private static func messageSummary(
        from record: JSONRecord,
        requestedMessageId: String,
        includeBody: Bool,
        maxBodyChars: Int
    ) -> JSONRecord {
        let headers = headerValues(from: record)
        let snippet = sanitizedEmailText(record["snippet"]?.string ?? "")
        var summary: JSONRecord = [
            "id": record["id"] ?? .string(requestedMessageId),
            "threadId": record["threadId"] ?? .null,
            "labelIds": record["labelIds"] ?? .array([]),
            "sizeEstimate": record["sizeEstimate"] ?? .null,
            "internalDate": record["internalDate"] ?? .null,
            "from": headers["from"].map(JSONValue.string) ?? .null,
            "sender": headers["from"].map(JSONValue.string) ?? .null,
            "to": headers["to"].map(JSONValue.string) ?? .null,
            "subject": headers["subject"].map(JSONValue.string) ?? .null,
            "date": headers["date"].map(JSONValue.string) ?? .null,
            "snippet": snippet.isEmpty ? .null : .string(String(snippet.prefix(700))),
            "metadataHeaders": .object(headers.reduce(into: JSONRecord()) { partial, element in
                partial[element.key] = .string(element.value)
            }),
            "metadataHeaderNames": .array(headerNames(from: record).map(JSONValue.string)),
            "bodyReturned": .bool(false),
            "redactionStatus": .string("private-state-excluded")
        ]
        if includeBody {
            let body = bodyExcerpt(from: record, maxChars: maxBodyChars)
            summary["bodyReturned"] = .bool(!body.excerpt.isEmpty)
            summary["bodyExcerpt"] = body.excerpt.isEmpty ? .null : .string(body.excerpt)
            summary["bodyExcerptCharCount"] = .number(Double(body.excerpt.count))
            summary["bodyTruncated"] = .bool(body.truncated)
            summary["bodySource"] = body.source.map(JSONValue.string) ?? .null
            summary["maxBodyChars"] = .number(Double(maxBodyChars))
        }
        summary["semanticFieldsReturned"] = .array(semanticFieldNames(in: summary).map(JSONValue.string))
        return summary
    }

    private static func semanticFieldNames(in summary: JSONRecord) -> [String] {
        ["from", "subject", "date", "snippet", "bodyExcerpt"].filter { key in
            switch summary[key] {
            case .string(let value):
                return !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            default:
                return false
            }
        }
    }

    private static func headerNames(from record: JSONRecord) -> [String] {
        guard let payload = object(record["payload"]),
              case .array(let headers)? = payload["headers"] else {
            return []
        }
        return headers.compactMap { value in
            object(value)?["name"]?.string
        }
    }

    private static func headerValues(from record: JSONRecord) -> [String: String] {
        guard let payload = object(record["payload"]),
              case .array(let headers)? = payload["headers"] else {
            return [:]
        }
        return headers.reduce(into: [String: String]()) { partial, value in
            guard let object = object(value),
                  let name = object["name"]?.string?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(),
                  let headerValue = object["value"]?.string?.trimmingCharacters(in: .whitespacesAndNewlines),
                  !name.isEmpty,
                  !headerValue.isEmpty else {
                return
            }
            partial[name] = sanitizedHeaderValue(headerValue)
        }
    }

    private static func maxResults(from payload: JSONRecord, fallback: Int, maximum: Int) -> Int {
        boundedInteger(from: payload, key: "maxResults", fallback: fallback, maximum: maximum)
    }

    private static func maxBodyChars(from payload: JSONRecord) -> Int {
        boundedInteger(from: payload, key: "maxBodyChars", fallback: 2_000, maximum: 8_000)
    }

    private static func boundedInteger(from payload: JSONRecord, key: String, fallback: Int, maximum: Int) -> Int {
        let raw: Int?
        switch payload[key] {
        case .number(let value):
            raw = Int(value)
        case .string(let value):
            raw = Int(value.trimmingCharacters(in: .whitespacesAndNewlines))
        default:
            raw = nil
        }
        return min(max(raw ?? fallback, 1), maximum)
    }

    private static func readFormat(from payload: JSONRecord) -> String {
        let value = payload["format"]?.string?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        switch value {
        case "metadata":
            return "metadata"
        case "body", "full":
            return "body"
        default:
            return "summary"
        }
    }

    private static func bodyExcerpt(from record: JSONRecord, maxChars: Int) -> (excerpt: String, truncated: Bool, source: String?) {
        guard maxChars > 0,
              let payload = object(record["payload"]),
              let body = preferredBodyText(from: payload) else {
            return ("", false, nil)
        }
        let cleaned = sanitizedEmailText(body.text)
        guard !cleaned.isEmpty else {
            return ("", false, body.mimeType)
        }
        if cleaned.count > maxChars {
            return (String(cleaned.prefix(maxChars)), true, body.mimeType)
        }
        return (cleaned, false, body.mimeType)
    }

    private static func preferredBodyText(from payload: JSONRecord) -> (text: String, mimeType: String)? {
        var plain: [String] = []
        var html: [String] = []
        collectBodyText(from: payload, plain: &plain, html: &html)
        if !plain.isEmpty {
            return (plain.joined(separator: "\n\n"), "text/plain")
        }
        if !html.isEmpty {
            return (html.joined(separator: "\n\n"), "text/html")
        }
        return nil
    }

    private static func collectBodyText(from payload: JSONRecord, plain: inout [String], html: inout [String]) {
        let mimeType = payload["mimeType"]?.string?.lowercased() ?? ""
        if let body = object(payload["body"]),
           body["attachmentId"] == nil,
           let encoded = body["data"]?.string,
           let decoded = base64URLDecodedString(encoded) {
            if mimeType.hasPrefix("text/plain") {
                plain.append(decoded)
            } else if mimeType.hasPrefix("text/html") {
                html.append(decoded)
            }
        }
        if case .array(let parts)? = payload["parts"] {
            for part in parts {
                guard let object = object(part) else { continue }
                collectBodyText(from: object, plain: &plain, html: &html)
            }
        }
    }

    private static func base64URLDecodedString(_ value: String) -> String? {
        var base64 = value
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")
        let padding = base64.count % 4
        if padding > 0 {
            base64.append(String(repeating: "=", count: 4 - padding))
        }
        guard let data = Data(base64Encoded: base64) else {
            return nil
        }
        return String(data: data, encoding: .utf8)
    }

    private static func sanitizedEmailText(_ value: String) -> String {
        var text = value
            .replacingOccurrences(of: "\r\n", with: "\n")
            .replacingOccurrences(of: "\r", with: "\n")
            .replacingOccurrences(of: "<br\\s*/?>", with: "\n", options: .regularExpression)
            .replacingOccurrences(of: "</p>", with: "\n", options: [.regularExpression, .caseInsensitive])
            .replacingOccurrences(of: "<[^>]+>", with: " ", options: .regularExpression)
            .replacingOccurrences(of: "&nbsp;", with: " ")
            .replacingOccurrences(of: "&amp;", with: "&")
            .replacingOccurrences(of: "&lt;", with: "<")
            .replacingOccurrences(of: "&gt;", with: ">")
            .replacingOccurrences(of: "&quot;", with: "\"")
            .replacingOccurrences(of: "&#39;", with: "'")
        text = String(text.unicodeScalars.map { scalar in
            if CharacterSet.controlCharacters.contains(scalar), scalar != "\n" {
                return " "
            }
            return String(scalar)
        }.joined())
        let lines = text
            .components(separatedBy: "\n")
            .map { line in
                line
                    .split(whereSeparator: { $0 == " " || $0 == "\t" })
                    .joined(separator: " ")
                    .trimmingCharacters(in: .whitespacesAndNewlines)
            }
        var compacted: [String] = []
        var previousBlank = false
        for line in lines {
            let isBlank = line.isEmpty
            if isBlank, previousBlank {
                continue
            }
            compacted.append(line)
            previousBlank = isBlank
        }
        return compacted.joined(separator: "\n").trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static func pathEncode(_ value: String) -> String {
        value.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? value
    }

    private static func formEncode(_ value: String) -> String {
        var allowed = CharacterSet.urlQueryAllowed
        allowed.remove(charactersIn: "+&=")
        return value.addingPercentEncoding(withAllowedCharacters: allowed) ?? value
    }

    private static func bodySnippet(_ data: Data) -> String {
        let text = String(data: data, encoding: .utf8) ?? ""
        return String(text.prefix(2_000))
    }
}

public struct FakeGmailProviderActionClient: GmailProviderActionClient {
    public init() {}

    public func executeGmailAction(request: MarketplaceProviderActionAdapterRequest) throws -> GmailProviderActionClientResult {
        switch request.definition.actionKey {
        case "gmail.messages.search":
            let query = request.payload["query"]?.string?.nilIfEmpty ?? "in:anywhere"
            return GmailProviderActionClientResult(result: baseResult(request: request).merging([
                "clientMode": .string("fake-gmail-api"),
                "query": .string(query),
                "semanticReadContract": .string("gmail-search-summary-v1"),
                "messages": .array([
                    .object([
                        "id": .string("gmail-msg-\(Self.stableSuffix(query + request.idempotencyKey))"),
                        "threadId": .string("gmail-thread-\(Self.stableSuffix(query))"),
                        "labelIds": .array([.string("INBOX")]),
                        "from": .string("Fixture Sender <fixture.sender@example.com>"),
                        "sender": .string("Fixture Sender <fixture.sender@example.com>"),
                        "to": .string("Relay User <relay@example.com>"),
                        "subject": .string("Redacted Gmail fixture"),
                        "date": .string("2026-01-01T00:00:00Z"),
                        "internalDate": .string("1760000000000"),
                        "snippet": .string("Redacted Gmail search fixture."),
                        "bodyReturned": .bool(false),
                        "semanticFieldsReturned": .array(["from", "subject", "date", "snippet"].map(JSONValue.string)),
                        "redactionStatus": .string("private-state-excluded")
                    ])
                ])
            ]) { _, new in new })
        case "gmail.message.read":
            let messageId = try Self.requiredPayloadString(request: request, key: "messageId", label: "message ID")
            return GmailProviderActionClientResult(result: baseResult(request: request).merging([
                "clientMode": .string("fake-gmail-api"),
                "semanticReadContract": .string("gmail-message-summary-v1"),
                "message": .object([
                    "id": .string(messageId),
                    "threadId": .string("gmail-thread-\(Self.stableSuffix(messageId))"),
                    "labelIds": .array([.string("INBOX")]),
                    "from": .string("Fixture Sender <fixture.sender@example.com>"),
                    "sender": .string("Fixture Sender <fixture.sender@example.com>"),
                    "to": .string("Relay User <relay@example.com>"),
                    "subject": .string("Redacted Gmail fixture"),
                    "date": .string("2026-01-01T00:00:00Z"),
                    "internalDate": .string("1760000000000"),
                    "snippet": .string("Message body excerpt available from fake provider result."),
                    "bodyReturned": .bool(true),
                    "bodyExcerpt": .string("Message body excerpt available from fake provider result."),
                    "bodyExcerptCharCount": .number(58),
                    "bodyTruncated": .bool(false),
                    "bodySource": .string("text/plain"),
                    "semanticFieldsReturned": .array(["from", "subject", "date", "snippet", "bodyExcerpt"].map(JSONValue.string)),
                    "redactionStatus": .string("private-state-excluded")
                ])
            ]) { _, new in new })
        case "gmail.labels.list":
            return GmailProviderActionClientResult(result: baseResult(request: request).merging([
                "clientMode": .string("fake-gmail-api"),
                "labels": .array([
                    .object(["id": .string("INBOX"), "name": .string("INBOX")]),
                    .object(["id": .string("SENT"), "name": .string("SENT")])
                ])
            ]) { _, new in new })
        case "gmail.draft.create":
            let email = try Self.emailPayload(request: request)
            return GmailProviderActionClientResult(result: baseResult(request: request).merging([
                "clientMode": .string("fake-gmail-api"),
                "draftId": .string("gmail-draft-\(Self.stableSuffix(email.subject + request.idempotencyKey))"),
                "to": .array(email.to.map(JSONValue.string)),
                "subject": .string(email.subject),
                "localOnly": .bool(false),
                "sent": .bool(false),
                "bodyCharacterCount": .number(Double(email.body.count))
            ]) { _, new in new })
        case "gmail.email.send":
            let email = try Self.emailPayload(request: request)
            return GmailProviderActionClientResult(result: baseResult(request: request).merging([
                "clientMode": .string("fake-gmail-api"),
                "messageId": .string("gmail-sent-\(Self.stableSuffix(email.subject + request.idempotencyKey))"),
                "threadId": .string("gmail-thread-\(Self.stableSuffix(email.subject))"),
                "to": .array(email.to.map(JSONValue.string)),
                "subject": .string(email.subject),
                "sent": .bool(true),
                "bodyCharacterCount": .number(Double(email.body.count))
            ]) { _, new in new })
        default:
            throw MarketplaceProviderActionAdapterFailure(
                code: "gmail_fake_action_not_supported",
                message: "The fake Gmail client does not support this action."
            )
        }
    }

    private func baseResult(request: MarketplaceProviderActionAdapterRequest) -> JSONRecord {
        [
            "adapterBoundary": .string("gmail-provider-action-adapter"),
            "provider": .string("gmail"),
            "permission": .string(request.permission.rawValue),
            "payloadHash": .string(MarketplaceProviderActionApprovalService.payloadHash(request.payload)),
            "actionKey": .string(request.definition.actionKey),
            "redactionStatus": .string("private-state-excluded")
        ]
    }

    private static func emailPayload(request: MarketplaceProviderActionAdapterRequest) throws -> (to: [String], subject: String, body: String) {
        let to = try recipients(request: request)
        let subject = try requiredPayloadString(request: request, key: "subject", label: "subject")
        let body = try requiredPayloadString(request: request, key: "body", label: "body")
        return (to, subject, body)
    }

    private static func recipients(request: MarketplaceProviderActionAdapterRequest) throws -> [String] {
        if case .array(let values)? = request.payload["to"] {
            let recipients = values.compactMap { value -> String? in
                guard let string = value.string?.trimmingCharacters(in: .whitespacesAndNewlines), !string.isEmpty else {
                    return nil
                }
                return string
            }
            if !recipients.isEmpty {
                return recipients
            }
        }
        if let raw = request.payload["to"]?.string?.trimmingCharacters(in: .whitespacesAndNewlines), !raw.isEmpty {
            let recipients = raw
                .split(separator: ",")
                .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { !$0.isEmpty }
            if !recipients.isEmpty {
                return recipients
            }
        }
        throw MarketplaceProviderActionAdapterFailure(
            code: "gmail_payload_missing_to",
            message: "Gmail email actions require at least one recipient."
        )
    }

    private static func requiredPayloadString(
        request: MarketplaceProviderActionAdapterRequest,
        key: String,
        label: String
    ) throws -> String {
        guard let value = request.payload[key]?.string?.trimmingCharacters(in: .whitespacesAndNewlines),
              !value.isEmpty else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "gmail_payload_missing_\(key)",
                message: "Gmail action payload requires a non-empty \(label)."
            )
        }
        return value
    }

    private static func stableSuffix(_ value: String) -> String {
        var hash: UInt64 = 1469598103934665603
        for byte in value.utf8 {
            hash ^= UInt64(byte)
            hash &*= 1099511628211
        }
        let hex = String(hash, radix: 16)
        return String(hex.suffix(10))
    }
}

public struct GmailProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowlistedActionKeys: Set<String> = [
        "gmail.messages.search",
        "gmail.message.read",
        "gmail.labels.list",
        "gmail.email.prepare",
        "gmail.draft.create",
        "gmail.email.send"
    ]

    private let client: any GmailProviderActionClient

    public init(client: any GmailProviderActionClient = MissingGmailProviderActionClient()) {
        self.client = client
    }

    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "gmail" else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "gmail_adapter_wrong_provider",
                message: "Gmail adapter can only execute Gmail provider actions."
            )
        }
        guard Self.allowlistedActionKeys.contains(request.definition.actionKey) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "gmail_action_not_allowlisted",
                message: "The requested Gmail action is not in the V1 adapter allowlist."
            )
        }
        if request.definition.actionKey == "gmail.email.prepare" {
            let email = try Self.emailPayload(request: request)
            return MarketplaceProviderActionAdapterResult(result: baseResult(request: request).merging([
                "clientMode": .string("local-gmail-draft"),
                "draftPreviewId": .string("gmail-preview-\(Self.stableSuffix(email.subject + request.idempotencyKey))"),
                "to": .array(email.to.map(JSONValue.string)),
                "subject": .string(email.subject),
                "localOnly": .bool(true),
                "sent": .bool(false),
                "bodyCharacterCount": .number(Double(email.body.count))
            ]) { _, new in new })
        }

        let output = try client.executeGmailAction(request: request)
        return MarketplaceProviderActionAdapterResult(
            result: output.result,
            error: nil,
            redactionStatus: output.redactionStatus
        )
    }

    private func baseResult(request: MarketplaceProviderActionAdapterRequest) -> JSONRecord {
        [
            "adapterBoundary": .string("gmail-provider-action-adapter"),
            "clientMode": .string("local-gmail-draft"),
            "provider": .string("gmail"),
            "permission": .string(request.permission.rawValue),
            "payloadHash": .string(MarketplaceProviderActionApprovalService.payloadHash(request.payload)),
            "actionKey": .string(request.definition.actionKey),
            "redactionStatus": .string("private-state-excluded")
        ]
    }

    private static func emailPayload(request: MarketplaceProviderActionAdapterRequest) throws -> (to: [String], subject: String, body: String) {
        let to = try recipients(request: request)
        let subject = try requiredPayloadString(request: request, key: "subject", label: "subject")
        let body = try requiredPayloadString(request: request, key: "body", label: "body")
        return (to, subject, body)
    }

    private static func recipients(request: MarketplaceProviderActionAdapterRequest) throws -> [String] {
        if case .array(let values)? = request.payload["to"] {
            let recipients = values.compactMap { value -> String? in
                guard let string = value.string?.trimmingCharacters(in: .whitespacesAndNewlines), !string.isEmpty else {
                    return nil
                }
                return string
            }
            if !recipients.isEmpty {
                return recipients
            }
        }
        if let raw = request.payload["to"]?.string?.trimmingCharacters(in: .whitespacesAndNewlines), !raw.isEmpty {
            let recipients = raw
                .split(separator: ",")
                .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { !$0.isEmpty }
            if !recipients.isEmpty {
                return recipients
            }
        }
        throw MarketplaceProviderActionAdapterFailure(
            code: "gmail_payload_missing_to",
            message: "Gmail email actions require at least one recipient."
        )
    }

    private static func requiredPayloadString(
        request: MarketplaceProviderActionAdapterRequest,
        key: String,
        label: String
    ) throws -> String {
        guard let value = request.payload[key]?.string?.trimmingCharacters(in: .whitespacesAndNewlines),
              !value.isEmpty else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "gmail_payload_missing_\(key)",
                message: "Gmail action payload requires a non-empty \(label)."
            )
        }
        return value
    }

    private static func stableSuffix(_ value: String) -> String {
        var hash: UInt64 = 1469598103934665603
        for byte in value.utf8 {
            hash ^= UInt64(byte)
            hash &*= 1099511628211
        }
        let hex = String(hash, radix: 16)
        return String(hex.suffix(10))
    }
}

private extension String {
    var nilIfEmpty: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}
