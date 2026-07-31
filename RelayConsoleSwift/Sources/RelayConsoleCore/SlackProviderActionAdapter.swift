import Foundation

public struct SlackProviderActionClientResult: Codable, Equatable, Sendable {
    public var result: JSONRecord
    public var redactionStatus: String

    public init(result: JSONRecord, redactionStatus: String = "private-state-excluded") {
        self.result = result
        self.redactionStatus = redactionStatus
    }
}

public protocol SlackProviderActionClient: Sendable {
    func executeSlackAction(request: MarketplaceProviderActionAdapterRequest) throws -> SlackProviderActionClientResult
}

public struct SlackProviderHTTPRequest: Sendable, Equatable {
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

public struct SlackProviderHTTPResponse: Sendable, Equatable {
    public var statusCode: Int
    public var body: Data

    public init(statusCode: Int, body: Data = Data()) {
        self.statusCode = statusCode
        self.body = body
    }
}

public protocol SlackProviderHTTPClient: Sendable {
    func send(_ request: SlackProviderHTTPRequest) throws -> SlackProviderHTTPResponse
}

public struct URLSessionSlackProviderHTTPClient: SlackProviderHTTPClient {
    private let timeoutSeconds: TimeInterval

    public init(timeoutSeconds: TimeInterval = 20) {
        self.timeoutSeconds = timeoutSeconds
    }

    public func send(_ request: SlackProviderHTTPRequest) throws -> SlackProviderHTTPResponse {
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
                code: "slack_http_timeout",
                message: "Slack API request timed out.",
                detail: ["urlHost": .string(request.url.host ?? "slack.com")]
            )
        }
        if let responseError {
            throw responseError
        }
        return SlackProviderHTTPResponse(statusCode: responseStatusCode ?? 0, body: responseData ?? Data())
    }
}

public struct FakeSlackProviderActionClient: SlackProviderActionClient {
    public init() {}

    public func executeSlackAction(request: MarketplaceProviderActionAdapterRequest) throws -> SlackProviderActionClientResult {
        switch request.definition.actionKey {
        case "slack_conversation_search":
            return try conversationSearch(request: request)
        case "slack_conversation_history_read":
            return try conversationHistory(request: request)
        case "slack_message_draft":
            return try messageDraft(request: request)
        case "slack_message_send":
            return try messageSend(request: request)
        case "slack_user_lookup":
            return try userLookup(request: request)
        default:
            throw MarketplaceProviderActionAdapterFailure(
                code: "slack_fake_action_not_supported",
                message: "The fake Slack client does not support this action.",
                detail: ["actionKey": .string(request.definition.actionKey)]
            )
        }
    }

    private func conversationSearch(request: MarketplaceProviderActionAdapterRequest) throws -> SlackProviderActionClientResult {
        let query = try SlackProviderActionAdapterSupport.requiredPayloadString(request: request, key: "query", label: "search query")
        let limit = SlackProviderActionAdapterSupport.boundedInt(request.payload["limit"], defaultValue: 5, minValue: 1, maxValue: 25)
        let channelId = request.payload["channelId"]?.string?.slackTrimmedNonEmpty ?? "C\(SlackProviderActionAdapterSupport.stableSuffix(query).uppercased())"
        return SlackProviderActionClientResult(result: baseResult(request: request).merging([
            "semanticReadContract": .string("slack-conversation-search-v1"),
            "query": .string(query),
            "messages": .array((0..<limit).map { index in
                .object([
                    "channelId": .string(channelId),
                    "channelName": .string("relay-demo"),
                    "messageTs": .string("1760000000.\(String(format: "%06d", index))"),
                    "sender": .string("relay-member-\(index + 1)"),
                    "excerpt": .string("Bounded Slack search result \(index + 1) for \(query)."),
                    "permalink": .string("https://relay.example/slack/\(channelId)/\(index + 1)"),
                    "truncated": .bool(false),
                    "redactionStatus": .string("private-state-excluded")
                ])
            }),
            "nextCursor": .null
        ]) { _, new in new })
    }

    private func conversationHistory(request: MarketplaceProviderActionAdapterRequest) throws -> SlackProviderActionClientResult {
        let channelId = try SlackProviderActionAdapterSupport.requiredPayloadString(request: request, key: "channelId", label: "channel ID")
        let limit = SlackProviderActionAdapterSupport.boundedInt(request.payload["limit"], defaultValue: 10, minValue: 1, maxValue: 50)
        return SlackProviderActionClientResult(result: baseResult(request: request).merging([
            "semanticReadContract": .string("slack-conversation-history-v1"),
            "channelId": .string(channelId),
            "messages": .array((0..<limit).map { index in
                .object([
                    "messageTs": .string("1760000100.\(String(format: "%06d", index))"),
                    "sender": .string("relay-member-\(index + 1)"),
                    "textPreview": .string("Bounded Slack channel history message \(index + 1)."),
                    "truncated": .bool(false),
                    "redactionStatus": .string("private-state-excluded")
                ])
            }),
            "nextCursor": .null
        ]) { _, new in new })
    }

    private func userLookup(request: MarketplaceProviderActionAdapterRequest) throws -> SlackProviderActionClientResult {
        let userId = try SlackProviderActionAdapterSupport.requiredPayloadString(request: request, key: "userId", label: "user ID")
        return SlackProviderActionClientResult(result: baseResult(request: request).merging([
            "semanticReadContract": .string("slack-user-lookup-v1"),
            "user": .object([
                "id": .string(userId),
                "displayName": .string("Relay Demo User"),
                "isBot": .bool(false),
                "redactionStatus": .string("private-state-excluded")
            ])
        ]) { _, new in new })
    }

    private func messageDraft(request: MarketplaceProviderActionAdapterRequest) throws -> SlackProviderActionClientResult {
        let normalized = try SlackProviderActionAdapterSupport.normalizedMessagePayload(request.payload)
        return SlackProviderActionClientResult(result: baseResult(request: request).merging([
            "draftPreview": .object([
                "channelId": normalized["channelId"] ?? .string(""),
                "textPreview": normalized["text"] ?? .string(""),
                "payloadHash": .string(MarketplaceProviderActionApprovalService.payloadHash(normalized)),
                "providerMutation": .bool(false),
                "redactionStatus": .string("private-state-excluded")
            ])
        ]) { _, new in new })
    }

    private func messageSend(request: MarketplaceProviderActionAdapterRequest) throws -> SlackProviderActionClientResult {
        let normalized = try SlackProviderActionAdapterSupport.normalizedMessagePayload(request.payload)
        let channelId = normalized["channelId"]?.string ?? "CUNKNOWN"
        let suffix = SlackProviderActionAdapterSupport.stableSuffix(MarketplaceProviderActionApprovalService.payloadHash(normalized))
        return SlackProviderActionClientResult(result: baseResult(request: request).merging([
            "channelId": .string(channelId),
            "messageTs": .string("1760000200.\(suffix.prefix(6))"),
            "permalink": .string("https://relay.example/slack/\(channelId)/\(suffix)"),
            "payloadHash": .string(MarketplaceProviderActionApprovalService.payloadHash(normalized)),
            "auditId": .string(request.auditIdentity.dispatchId ?? request.idempotencyKey),
            "redactionStatus": .string("private-state-excluded")
        ]) { _, new in new })
    }

    private func baseResult(request: MarketplaceProviderActionAdapterRequest) -> JSONRecord {
        [
            "fakeAdapter": .bool(true),
            "adapterBoundary": .string("slack-provider-action-adapter"),
            "clientMode": .string("fake-slack-client"),
            "provider": .string("slack"),
            "permission": .string(request.permission.rawValue),
            "payloadHash": .string(MarketplaceProviderActionApprovalService.payloadHash(request.payload)),
            "approved": .bool(request.approvalReference?.status == .approved),
            "idempotencyKey": .string(request.idempotencyKey),
            "liveCredentialsUsed": .bool(false),
            "rawProviderToolExposure": .bool(false),
            "redactionStatus": .string("private-state-excluded")
        ]
    }
}

public final class LiveSlackProviderActionClient: SlackProviderActionClient, @unchecked Sendable {
    fileprivate struct Credentials {
        var botToken: String
        var workspaceName: String?
        var teamId: String?
    }

    private let data: LocalDataService
    private let secrets: SecretService
    private let httpClient: any SlackProviderHTTPClient

    public init(
        data: LocalDataService,
        secrets: SecretService,
        httpClient: any SlackProviderHTTPClient = URLSessionSlackProviderHTTPClient()
    ) {
        self.data = data
        self.secrets = secrets
        self.httpClient = httpClient
    }

    public func executeSlackAction(request: MarketplaceProviderActionAdapterRequest) throws -> SlackProviderActionClientResult {
        switch request.definition.actionKey {
        case "slack_conversation_search":
            return try conversationSearch(request: request)
        case "slack_conversation_history_read":
            return try conversationHistory(request: request)
        case "slack_message_draft":
            return try FakeSlackProviderActionClient().executeSlackAction(request: request)
        case "slack_message_send":
            return try messageSend(request: request)
        case "slack_user_lookup":
            return try userLookup(request: request)
        default:
            throw MarketplaceProviderActionAdapterFailure(
                code: "slack_live_action_not_implemented",
                message: "Live Slack provider execution does not support this action.",
                detail: ["actionKey": .string(request.definition.actionKey)]
            )
        }
    }

    private func conversationSearch(request: MarketplaceProviderActionAdapterRequest) throws -> SlackProviderActionClientResult {
        let credentials = try credentials(for: request)
        let query = try SlackProviderActionAdapterSupport.requiredPayloadString(request: request, key: "query", label: "search query")
        let limit = SlackProviderActionAdapterSupport.boundedInt(request.payload["limit"], defaultValue: 5, minValue: 1, maxValue: 25)
        let parsed = try sendForm(
            method: "GET",
            path: "/api/search.messages",
            queryItems: [
                URLQueryItem(name: "query", value: query),
                URLQueryItem(name: "count", value: "\(limit)")
            ],
            credentials: credentials
        )
        let messages = parsed.objectValue?["messages"]?.objectValue?["matches"]?.arrayValue ?? []
        return SlackProviderActionClientResult(result: baseResult(request: request, credentials: credentials).merging([
            "semanticReadContract": .string("slack-conversation-search-v1"),
            "query": .string(query),
            "messages": .array(messages.prefix(limit).map { .object(messageSummary($0)) }),
            "nextCursor": .null
        ]) { _, new in new })
    }

    private func conversationHistory(request: MarketplaceProviderActionAdapterRequest) throws -> SlackProviderActionClientResult {
        let credentials = try credentials(for: request)
        let channelId = try SlackProviderActionAdapterSupport.requiredPayloadString(request: request, key: "channelId", label: "channel ID")
        let limit = SlackProviderActionAdapterSupport.boundedInt(request.payload["limit"], defaultValue: 10, minValue: 1, maxValue: 50)
        let parsed = try sendForm(
            method: "GET",
            path: "/api/conversations.history",
            queryItems: [
                URLQueryItem(name: "channel", value: channelId),
                URLQueryItem(name: "limit", value: "\(limit)")
            ],
            credentials: credentials
        )
        let messages = parsed.objectValue?["messages"]?.arrayValue ?? []
        return SlackProviderActionClientResult(result: baseResult(request: request, credentials: credentials).merging([
            "semanticReadContract": .string("slack-conversation-history-v1"),
            "channelId": .string(channelId),
            "messages": .array(messages.prefix(limit).map { .object(messageSummary($0)) }),
            "nextCursor": parsed.objectValue?["response_metadata"]?.objectValue?["next_cursor"] ?? .null
        ]) { _, new in new })
    }

    private func userLookup(request: MarketplaceProviderActionAdapterRequest) throws -> SlackProviderActionClientResult {
        let credentials = try credentials(for: request)
        let userId = try SlackProviderActionAdapterSupport.requiredPayloadString(request: request, key: "userId", label: "user ID")
        let parsed = try sendForm(
            method: "GET",
            path: "/api/users.info",
            queryItems: [URLQueryItem(name: "user", value: userId)],
            credentials: credentials
        )
        return SlackProviderActionClientResult(result: baseResult(request: request, credentials: credentials).merging([
            "semanticReadContract": .string("slack-user-lookup-v1"),
            "user": parsed.objectValue?["user"] ?? .null
        ]) { _, new in new })
    }

    private func messageSend(request: MarketplaceProviderActionAdapterRequest) throws -> SlackProviderActionClientResult {
        let credentials = try credentials(for: request)
        let normalized = try SlackProviderActionAdapterSupport.normalizedMessagePayload(request.payload)
        let body = try JSONSerialization.data(withJSONObject: SlackProviderActionAdapterSupport.anyRecord(normalized))
        let parsed = try sendJSON(method: "POST", path: "/api/chat.postMessage", body: body, credentials: credentials)
        let parsedObject = parsed.objectValue ?? [:]
        var result = baseResult(request: request, credentials: credentials)
        result["channelId"] = parsedObject["channel"] ?? normalized["channelId"] ?? .null
        result["messageTs"] = parsedObject["ts"] ?? .null
        result["permalink"] = parsedObject["permalink"] ?? .null
        result["payloadHash"] = .string(MarketplaceProviderActionApprovalService.payloadHash(normalized))
        result["auditId"] = .string(request.auditIdentity.dispatchId ?? request.idempotencyKey)
        result["redactionStatus"] = .string("private-state-excluded")
        return SlackProviderActionClientResult(result: result)
    }

    private func credentials(for request: MarketplaceProviderActionAdapterRequest) throws -> Credentials {
        guard let connectionId = request.auditIdentity.connectionId?.slackTrimmedNonEmpty,
              let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: connectionId),
              connection.appId == request.app.id,
              connection.appSlug == request.app.slug else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "slack_connection_missing",
                message: "Slack execution requires a Relay Marketplace provider connection."
            )
        }
        guard connection.status == .connected || connection.status == .healthError else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "slack_connection_not_ready",
                message: "The Slack provider connection is not ready.",
                detail: ["connectionStatus": .string(connection.status.rawValue)]
            )
        }
        return Credentials(
            botToken: try secret(fieldKey: "slack_bot_access_token", connection: connection),
            workspaceName: connection.connectedHandle?.slackTrimmedNonEmpty ?? connection.health.diagnostics["workspaceName"]?.string?.slackTrimmedNonEmpty,
            teamId: connection.health.diagnostics["teamId"]?.string?.slackTrimmedNonEmpty
        )
    }

    private func secret(fieldKey: String, connection: MarketplaceProviderConnection) throws -> String {
        guard let secretId = connection.credentialRequirements.first(where: { $0.fieldKey == fieldKey })?.secretReferenceId?.slackTrimmedNonEmpty else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "slack_credentials_missing",
                message: "The Slack provider connection is missing a required Keychain secret reference.",
                detail: ["fieldKey": .string(fieldKey)]
            )
        }
        do {
            return try secrets.getSecretValue(secretId)
        } catch {
            throw MarketplaceProviderActionAdapterFailure(
                code: "slack_credentials_unavailable",
                message: "Relay could not read the saved Slack token from the OS secret store. Reconnect Slack in Marketplace.",
                detail: ["fieldKey": .string(fieldKey)]
            )
        }
    }

    private func sendForm(method: String, path: String, queryItems: [URLQueryItem], credentials: Credentials) throws -> JSONValue {
        var components = URLComponents(string: "https://slack.com\(path)")
        components?.queryItems = queryItems
        guard let url = components?.url else {
            throw MarketplaceProviderActionAdapterFailure(code: "slack_invalid_url", message: "Could not build the Slack API URL.")
        }
        return try parseSlackResponse(httpClient.send(SlackProviderHTTPRequest(
            method: method,
            url: url,
            headers: [
                "Authorization": "Bearer \(credentials.botToken)",
                "Accept": "application/json"
            ]
        )))
    }

    private func sendJSON(method: String, path: String, body: Data, credentials: Credentials) throws -> JSONValue {
        guard let url = URL(string: "https://slack.com\(path)") else {
            throw MarketplaceProviderActionAdapterFailure(code: "slack_invalid_url", message: "Could not build the Slack API URL.")
        }
        return try parseSlackResponse(httpClient.send(SlackProviderHTTPRequest(
            method: method,
            url: url,
            headers: [
                "Authorization": "Bearer \(credentials.botToken)",
                "Accept": "application/json",
                "Content-Type": "application/json; charset=utf-8"
            ],
            body: body
        )))
    }

    private func parseSlackResponse(_ response: SlackProviderHTTPResponse) throws -> JSONValue {
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "slack_http_error",
                message: "Slack API returned an HTTP error.",
                providerStatusCode: response.statusCode
            )
        }
        let json = try JSONSerialization.jsonObject(with: response.body)
        let value = SlackProviderActionAdapterSupport.jsonValue(from: json)
        if value.objectValue?["ok"]?.bool == false {
            throw MarketplaceProviderActionAdapterFailure(
                code: "slack_api_error",
                message: "Slack rejected the provider action.",
                detail: ["error": value.objectValue?["error"] ?? .string("unknown_error")]
            )
        }
        return value
    }

    private func baseResult(request: MarketplaceProviderActionAdapterRequest, credentials: Credentials) -> JSONRecord {
        [
            "adapterBoundary": .string("slack-provider-action-adapter"),
            "clientMode": .string("live-slack-web-api"),
            "provider": .string("slack"),
            "workspaceName": credentials.workspaceName.map(JSONValue.string) ?? .null,
            "teamId": credentials.teamId.map(JSONValue.string) ?? .null,
            "permission": .string(request.permission.rawValue),
            "payloadHash": .string(MarketplaceProviderActionApprovalService.payloadHash(request.payload)),
            "approved": .bool(request.approvalReference?.status == .approved),
            "idempotencyKey": .string(request.idempotencyKey),
            "liveCredentialsUsed": .bool(true),
            "rawProviderToolExposure": .bool(false),
            "redactionStatus": .string("private-state-excluded")
        ]
    }

    private func messageSummary(_ value: JSONValue) -> JSONRecord {
        let object = value.objectValue ?? [:]
        return [
            "channelId": object["channel"] ?? object["channelId"] ?? .null,
            "channelName": object["channel_name"] ?? .null,
            "messageTs": object["ts"] ?? .null,
            "sender": object["user"] ?? object["username"] ?? .null,
            "textPreview": .string((object["text"]?.string ?? "").prefixString(500)),
            "permalink": object["permalink"] ?? .null,
            "truncated": .bool((object["text"]?.string ?? "").count > 500),
            "redactionStatus": .string("private-state-excluded")
        ]
    }
}

public struct SlackProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowlistedActionKeys: Set<String> = [
        "slack_conversation_search",
        "slack_conversation_history_read",
        "slack_message_draft",
        "slack_message_send",
        "slack_user_lookup"
    ]

    private let client: any SlackProviderActionClient

    public init(client: any SlackProviderActionClient = FakeSlackProviderActionClient()) {
        self.client = client
    }

    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "slack" else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "slack_adapter_wrong_provider",
                message: "Slack adapter can only execute Slack provider actions.",
                detail: ["appSlug": .string(request.app.slug)]
            )
        }
        guard Self.allowlistedActionKeys.contains(request.definition.actionKey) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "slack_action_not_allowlisted",
                message: "The requested Slack action is not in the V1 adapter allowlist.",
                detail: ["actionKey": .string(request.definition.actionKey)]
            )
        }
        let output = try client.executeSlackAction(request: request)
        return MarketplaceProviderActionAdapterResult(result: output.result, error: nil, redactionStatus: output.redactionStatus)
    }
}

public enum SlackProviderActionAdapterSupport {
    public static func requiredPayloadString(request: MarketplaceProviderActionAdapterRequest, key: String, label: String) throws -> String {
        guard let value = request.payload[key]?.string?.slackTrimmedNonEmpty else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "slack_missing_required_field",
                message: "Slack \(label) is required.",
                detail: ["field": .string(key)]
            )
        }
        return value
    }

    public static func boundedInt(_ value: JSONValue?, defaultValue: Int, minValue: Int, maxValue: Int) -> Int {
        let raw = value?.number.map(Int.init) ?? value?.string.flatMap(Int.init) ?? defaultValue
        return max(minValue, min(maxValue, raw))
    }

    public static func normalizedMessagePayload(_ payload: JSONRecord) throws -> JSONRecord {
        let channelId = payload["channelId"]?.string?.slackTrimmedNonEmpty ?? payload["conversationId"]?.string?.slackTrimmedNonEmpty
        guard let channelId else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "slack_missing_required_field",
                message: "Slack message actions require a channelId.",
                detail: ["field": .string("channelId")]
            )
        }
        guard let text = payload["text"]?.string?.slackTrimmedNonEmpty else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "slack_missing_required_field",
                message: "Slack message actions require text.",
                detail: ["field": .string("text")]
            )
        }
        guard text.count <= 4000 else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "slack_message_too_long",
                message: "Slack message text is limited to 4000 characters in Relay V1."
            )
        }
        var output: JSONRecord = ["channel": .string(channelId), "channelId": .string(channelId), "text": .string(text)]
        if let threadTs = payload["threadTs"]?.string?.slackTrimmedNonEmpty {
            output["thread_ts"] = .string(threadTs)
        }
        return output
    }

    public static func jsonValue(from value: Any) -> JSONValue {
        if let value = value as? String { return .string(value) }
        if let value = value as? Bool { return .bool(value) }
        if let value = value as? Int { return .number(Double(value)) }
        if let value = value as? Double { return .number(value) }
        if let value = value as? [String: Any] { return .object(value.mapValues(jsonValue(from:))) }
        if let value = value as? [Any] { return .array(value.map(jsonValue(from:))) }
        if value is NSNull { return .null }
        return .string(String(describing: value))
    }

    public static func anyRecord(_ record: JSONRecord) -> [String: Any] {
        record.mapValues(anyValue(_:))
    }

    public static func anyValue(_ value: JSONValue) -> Any {
        switch value {
        case .string(let string): return string
        case .number(let number): return number
        case .bool(let bool): return bool
        case .object(let object): return anyRecord(object)
        case .array(let array): return array.map(anyValue(_:))
        case .null: return NSNull()
        }
    }

    public static func stableSuffix(_ value: String) -> String {
        var hash: UInt64 = 1469598103934665603
        for byte in value.utf8 {
            hash ^= UInt64(byte)
            hash &*= 1099511628211
        }
        return String(String(hash, radix: 16).suffix(10))
    }
}

private extension JSONValue {
    var objectValue: JSONRecord? {
        if case .object(let record) = self { return record }
        return nil
    }

    var arrayValue: [JSONValue]? {
        if case .array(let values) = self { return values }
        return nil
    }
}

private extension String {
    var slackTrimmedNonEmpty: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    func prefixString(_ maxLength: Int) -> String {
        String(prefix(maxLength))
    }
}
