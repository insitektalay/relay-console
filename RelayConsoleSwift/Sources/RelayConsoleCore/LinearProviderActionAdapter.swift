import Foundation

public struct LinearProviderActionClientResult: Codable, Equatable, Sendable {
    public var result: JSONRecord
    public var redactionStatus: String

    public init(result: JSONRecord, redactionStatus: String = "private-state-excluded") {
        self.result = result
        self.redactionStatus = redactionStatus
    }
}

public protocol LinearProviderActionClient: Sendable {
    func executeLinearAction(request: MarketplaceProviderActionAdapterRequest) throws -> LinearProviderActionClientResult
}

public struct LinearProviderHTTPRequest: Sendable, Equatable {
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

public struct LinearProviderHTTPResponse: Sendable, Equatable {
    public var statusCode: Int
    public var body: Data

    public init(statusCode: Int, body: Data = Data()) {
        self.statusCode = statusCode
        self.body = body
    }
}

public protocol LinearProviderHTTPClient: Sendable {
    func send(_ request: LinearProviderHTTPRequest) throws -> LinearProviderHTTPResponse
}

public struct URLSessionLinearProviderHTTPClient: LinearProviderHTTPClient {
    private let timeoutSeconds: TimeInterval

    public init(timeoutSeconds: TimeInterval = 20) {
        self.timeoutSeconds = timeoutSeconds
    }

    public func send(_ request: LinearProviderHTTPRequest) throws -> LinearProviderHTTPResponse {
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
                code: "linear_http_timeout",
                message: "Linear API request timed out.",
                detail: ["urlHost": .string(request.url.host ?? "linear.com")]
            )
        }
        if let responseError {
            throw responseError
        }
        return LinearProviderHTTPResponse(statusCode: responseStatusCode ?? 0, body: responseData ?? Data())
    }
}

public struct FakeLinearProviderActionClient: LinearProviderActionClient {
    public init() {}

    public func executeLinearAction(request: MarketplaceProviderActionAdapterRequest) throws -> LinearProviderActionClientResult {
        switch request.definition.actionKey {
        case "linear_issue_search":
            return try issueSearch(request: request)
        case "linear_issue_list":
            return try issueList(request: request)
        case "linear_project_list":
            return try projectList(request: request)
        case "linear_issue_comment_prepare":
            return try commentPrepare(request: request, numberKey: "issueId")
        case "linear_issue_create":
            return try issueCreate(request: request)
        case "linear_issue_comment_create":
            return try issueCommentCreate(request: request, issueKey: "issueId")
        default:
            throw MarketplaceProviderActionAdapterFailure(
                code: "linear_fake_action_not_supported",
                message: "The fake Linear client does not support this action.",
                detail: ["actionKey": .string(request.definition.actionKey)]
            )
        }
    }

    private func issueSearch(request: MarketplaceProviderActionAdapterRequest) throws -> LinearProviderActionClientResult {
        let query = try LinearProviderActionAdapterSupport.requiredPayloadString(request: request, key: "query", label: "issue search query")
        let limit = LinearProviderActionAdapterSupport.boundedInt(request.payload["maxResults"], defaultValue: 5, minValue: 1, maxValue: 25)
        return LinearProviderActionClientResult(result: baseResult(request: request).merging([
            "semanticReadContract": .string("linear-issue-search-v1"),
            "query": .string(query),
            "issues": .array((0..<limit).map { index in
                .object([
                    "identifier": .string("REL-\(index + 1)"),
                    "title": .string("Bounded Linear issue result \(index + 1) for \(query)"),
                    "state": .string("triage"),
                    "webUrl": .string("https://linear.app/relay-demo/issue/\(query.linearSlug)-\(index + 1)"),
                    "updatedAt": .string("2026-07-09T00:00:00Z"),
                    "redactionStatus": .string("private-state-excluded")
                ])
            })
        ]) { _, new in new })
    }

    private func issueList(request: MarketplaceProviderActionAdapterRequest) throws -> LinearProviderActionClientResult {
        let teamKey = try LinearProviderActionAdapterSupport.requiredPayloadString(request: request, key: "teamKey", label: "team key")
        let limit = LinearProviderActionAdapterSupport.boundedInt(request.payload["maxResults"], defaultValue: 10, minValue: 1, maxValue: 50)
        return LinearProviderActionClientResult(result: baseResult(request: request).merging([
            "semanticReadContract": .string("linear-issue-list-v1"),
            "teamKey": .string(teamKey),
            "issues": .array((0..<limit).map { index in
                .object([
                    "id": .number(Double(index + 1)),
                    "title": .string("Bounded Linear issue \(index + 1)"),
                    "state": .string("opened"),
                    "author": .string("relay-user-\(index + 1)"),
                    "webUrl": .string("https://linear.com/\(teamKey)/issues/\(index + 1)"),
                    "bodyExcerpt": .string("Demo issue body excerpt."),
                    "redactionStatus": .string("private-state-excluded")
                ])
            })
        ]) { _, new in new })
    }

    private func projectList(request: MarketplaceProviderActionAdapterRequest) throws -> LinearProviderActionClientResult {
        let teamKey = try LinearProviderActionAdapterSupport.requiredPayloadString(request: request, key: "teamKey", label: "team key")
        let limit = LinearProviderActionAdapterSupport.boundedInt(request.payload["maxResults"], defaultValue: 10, minValue: 1, maxValue: 50)
        return LinearProviderActionClientResult(result: baseResult(request: request).merging([
            "semanticReadContract": .string("linear-project-list-v1"),
            "teamKey": .string(teamKey),
            "projects": .array((0..<limit).map { index in
                .object([
                    "id": .number(Double(index + 1)),
                    "title": .string("Bounded Linear project \(index + 1)"),
                    "state": .string("opened"),
                    "author": .string("relay-user-\(index + 1)"),
                    "webUrl": .string("https://linear.com/\(teamKey)/projects/\(index + 1)"),
                    "bodyExcerpt": .string("Demo project body excerpt."),
                    "redactionStatus": .string("private-state-excluded")
                ])
            })
        ]) { _, new in new })
    }

    private func commentPrepare(request: MarketplaceProviderActionAdapterRequest, numberKey: String) throws -> LinearProviderActionClientResult {
        let normalized = try LinearProviderActionAdapterSupport.normalizedCommentPayload(request.payload, numberKey: numberKey)
        return LinearProviderActionClientResult(result: baseResult(request: request).merging([
            "draftPreview": .object([
                "teamKey": normalized["teamKey"] ?? .null,
                "id": normalized["id"] ?? .null,
                "bodyPreview": normalized["body"] ?? .string(""),
                "payloadHash": .string(MarketplaceProviderActionApprovalService.payloadHash(normalized)),
                "providerMutation": .bool(false),
                "redactionStatus": .string("private-state-excluded")
            ])
        ]) { _, new in new })
    }

    private func issueCreate(request: MarketplaceProviderActionAdapterRequest) throws -> LinearProviderActionClientResult {
        let normalized = try LinearProviderActionAdapterSupport.normalizedIssueCreatePayload(request.payload)
        let suffix = LinearProviderActionAdapterSupport.stableSuffix(MarketplaceProviderActionApprovalService.payloadHash(normalized))
        return LinearProviderActionClientResult(result: baseResult(request: request).merging([
            "issueId": .string("lin_\(suffix)"),
            "identifier": .string("\(normalized["teamKey"]?.string ?? "REL")-\(suffix.prefix(4).uppercased())"),
            "webUrl": .string("https://linear.app/\(normalized["teamKey"]?.string ?? "relay")/issue/\(suffix)"),
            "payloadHash": .string(MarketplaceProviderActionApprovalService.payloadHash(normalized)),
            "auditId": .string(request.auditIdentity.dispatchId ?? request.idempotencyKey),
            "redactionStatus": .string("private-state-excluded")
        ]) { _, new in new })
    }

    private func issueCommentCreate(request: MarketplaceProviderActionAdapterRequest, issueKey: String) throws -> LinearProviderActionClientResult {
        let normalized = try LinearProviderActionAdapterSupport.normalizedCommentPayload(request.payload, numberKey: issueKey)
        let suffix = LinearProviderActionAdapterSupport.stableSuffix(MarketplaceProviderActionApprovalService.payloadHash(normalized))
        return LinearProviderActionClientResult(result: baseResult(request: request).merging([
            "commentId": .string("lin_comment_\(suffix)"),
            "webUrl": .string("https://linear.app/\(normalized["teamKey"]?.string ?? "relay")/issue/\(normalized["id"]?.string ?? "0")#comment-\(suffix)"),
            "payloadHash": .string(MarketplaceProviderActionApprovalService.payloadHash(normalized)),
            "auditId": .string(request.auditIdentity.dispatchId ?? request.idempotencyKey),
            "redactionStatus": .string("private-state-excluded")
        ]) { _, new in new })
    }

    private func baseResult(request: MarketplaceProviderActionAdapterRequest) -> JSONRecord {
        [
            "fakeAdapter": .bool(true),
            "adapterBoundary": .string("linear-provider-action-adapter"),
            "clientMode": .string("fake-linear-client"),
            "provider": .string("linear"),
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

public final class LiveLinearProviderActionClient: LinearProviderActionClient, @unchecked Sendable {
    fileprivate struct Credentials {
        var accessToken: String
        var login: String?
        var organization: String?
    }

    private let data: LocalDataService
    private let secrets: SecretService
    private let httpClient: any LinearProviderHTTPClient

    public init(
        data: LocalDataService,
        secrets: SecretService,
        httpClient: any LinearProviderHTTPClient = URLSessionLinearProviderHTTPClient()
    ) {
        self.data = data
        self.secrets = secrets
        self.httpClient = httpClient
    }

    public func executeLinearAction(request: MarketplaceProviderActionAdapterRequest) throws -> LinearProviderActionClientResult {
        switch request.definition.actionKey {
        case "linear_issue_search":
            return try issueSearch(request: request)
        case "linear_issue_list":
            return try issueList(request: request)
        case "linear_project_list":
            return try projectList(request: request)
        case "linear_issue_comment_prepare":
            return try FakeLinearProviderActionClient().executeLinearAction(request: request)
        case "linear_issue_create":
            return try issueCreate(request: request)
        case "linear_issue_comment_create":
            return try commentCreate(request: request, numberKey: "issueId")
        default:
            throw MarketplaceProviderActionAdapterFailure(
                code: "linear_live_action_not_implemented",
                message: "Live Linear provider execution does not support this action.",
                detail: ["actionKey": .string(request.definition.actionKey)]
            )
        }
    }

    private func issueSearch(request: MarketplaceProviderActionAdapterRequest) throws -> LinearProviderActionClientResult {
        let credentials = try credentials(for: request)
        let query = try LinearProviderActionAdapterSupport.requiredPayloadString(request: request, key: "query", label: "issue search query")
        let limit = LinearProviderActionAdapterSupport.boundedInt(request.payload["maxResults"], defaultValue: 5, minValue: 1, maxValue: 25)
        let parsed = try send(
            method: "GET",
            path: "/issues",
            queryItems: [
                URLQueryItem(name: "q", value: "name ~ \"\(query)\""),
                URLQueryItem(name: "pagelen", value: "\(limit)")
            ],
            credentials: credentials
        )
        let items = parsed.arrayValue ?? parsed.objectValue?["values"]?.arrayValue ?? []
        return LinearProviderActionClientResult(result: baseResult(request: request, credentials: credentials).merging([
            "semanticReadContract": .string("linear-issue-search-v1"),
            "query": .string(query),
            "issues": .array(items.prefix(limit).map { .object(issueSummary($0)) })
        ]) { _, new in new })
    }

    private func issueList(request: MarketplaceProviderActionAdapterRequest) throws -> LinearProviderActionClientResult {
        let credentials = try credentials(for: request)
        let teamKey = try LinearProviderActionAdapterSupport.requiredPayloadString(request: request, key: "teamKey", label: "team key")
        let limit = LinearProviderActionAdapterSupport.boundedInt(request.payload["maxResults"], defaultValue: 10, minValue: 1, maxValue: 50)
        let state = request.payload["state"]?.string?.linearTrimmedNonEmpty ?? "opened"
        let parsed = try send(
            method: "GET",
            path: "/issues/\(LinearProviderActionAdapterSupport.urlPathComponent(teamKey))/issues",
            queryItems: [
                URLQueryItem(name: "state", value: state),
                URLQueryItem(name: "pagelen", value: "\(limit)")
            ],
            credentials: credentials
        )
        let issues = parsed.arrayValue ?? parsed.objectValue?["values"]?.arrayValue ?? []
        return LinearProviderActionClientResult(result: baseResult(request: request, credentials: credentials).merging([
            "semanticReadContract": .string("linear-issue-list-v1"),
            "teamKey": .string(teamKey),
            "issues": .array(issues.prefix(limit).map { .object(issueSummary($0)) })
        ]) { _, new in new })
    }

    private func projectList(request: MarketplaceProviderActionAdapterRequest) throws -> LinearProviderActionClientResult {
        let credentials = try credentials(for: request)
        let teamKey = try LinearProviderActionAdapterSupport.requiredPayloadString(request: request, key: "teamKey", label: "team key")
        let limit = LinearProviderActionAdapterSupport.boundedInt(request.payload["maxResults"], defaultValue: 10, minValue: 1, maxValue: 50)
        let state = request.payload["state"]?.string?.linearTrimmedNonEmpty ?? "opened"
        let parsed = try send(
            method: "GET",
            path: "/issues/\(LinearProviderActionAdapterSupport.urlPathComponent(teamKey))/projects",
            queryItems: [
                URLQueryItem(name: "state", value: state),
                URLQueryItem(name: "pagelen", value: "\(limit)")
            ],
            credentials: credentials
        )
        let projects = parsed.arrayValue ?? parsed.objectValue?["values"]?.arrayValue ?? []
        return LinearProviderActionClientResult(result: baseResult(request: request, credentials: credentials).merging([
            "semanticReadContract": .string("linear-project-list-v1"),
            "teamKey": .string(teamKey),
            "projects": .array(projects.prefix(limit).map { .object(issueSummary($0)) })
        ]) { _, new in new })
    }

    private func issueCreate(request: MarketplaceProviderActionAdapterRequest) throws -> LinearProviderActionClientResult {
        let credentials = try credentials(for: request)
        let normalized = try LinearProviderActionAdapterSupport.normalizedIssueCreatePayload(request.payload)
        let body = try JSONSerialization.data(withJSONObject: [
            "teamKey": normalized["teamKey"]?.string ?? "",
            "title": normalized["title"]?.string ?? "",
            "description": normalized["description"]?.string ?? ""
        ])
        let parsed = try send(
            method: "POST",
            path: "/issues",
            queryItems: [],
            body: body,
            credentials: credentials
        )
        var result = baseResult(request: request, credentials: credentials)
        result["issueId"] = parsed.objectValue?["id"] ?? .null
        result["identifier"] = parsed.objectValue?["identifier"] ?? .null
        result["webUrl"] = parsed.objectValue?["url"] ?? parsed.objectValue?["web_url"] ?? .null
        result["payloadHash"] = .string(MarketplaceProviderActionApprovalService.payloadHash(normalized))
        result["auditId"] = .string(request.auditIdentity.dispatchId ?? request.idempotencyKey)
        result["redactionStatus"] = .string("private-state-excluded")
        return LinearProviderActionClientResult(result: result)
    }

    private func commentCreate(request: MarketplaceProviderActionAdapterRequest, numberKey: String) throws -> LinearProviderActionClientResult {
        let credentials = try credentials(for: request)
        let normalized = try LinearProviderActionAdapterSupport.normalizedCommentPayload(request.payload, numberKey: numberKey)
        let teamKey = normalized["teamKey"]?.string ?? ""
        let id = normalized["id"]?.string ?? ""
        let body = try JSONSerialization.data(withJSONObject: ["content": ["raw": normalized["body"]?.string ?? ""]])
        let parsed = try send(
            method: "POST",
            path: "/issues/\(LinearProviderActionAdapterSupport.urlPathComponent(teamKey))/\(id)/comments",
            queryItems: [],
            body: body,
            credentials: credentials
        )
        var result = baseResult(request: request, credentials: credentials)
        result["commentId"] = parsed.objectValue?["id"] ?? .null
        result["webUrl"] = parsed.objectValue?["web_url"] ?? parsed.objectValue?["html_url"] ?? .null
        result["payloadHash"] = .string(MarketplaceProviderActionApprovalService.payloadHash(normalized))
        result["auditId"] = .string(request.auditIdentity.dispatchId ?? request.idempotencyKey)
        result["redactionStatus"] = .string("private-state-excluded")
        return LinearProviderActionClientResult(result: result)
    }

    private func credentials(for request: MarketplaceProviderActionAdapterRequest) throws -> Credentials {
        guard let connectionId = request.auditIdentity.connectionId?.linearTrimmedNonEmpty,
              let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: connectionId),
              connection.appId == request.app.id,
              connection.appSlug == request.app.slug else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "linear_connection_missing",
                message: "Linear execution requires a Relay Marketplace provider connection."
            )
        }
        guard connection.status == .connected || connection.status == .healthError else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "linear_connection_not_ready",
                message: "The Linear provider connection is not ready.",
                detail: ["connectionStatus": .string(connection.status.rawValue)]
            )
        }
        return Credentials(
            accessToken: try secret(fieldKey: "linear_oauth_access_token", connection: connection),
            login: connection.health.diagnostics["username"]?.string?.linearTrimmedNonEmpty,
            organization: connection.health.diagnostics["workspace"]?.string?.linearTrimmedNonEmpty
        )
    }

    private func secret(fieldKey: String, connection: MarketplaceProviderConnection) throws -> String {
        guard let secretId = connection.credentialRequirements.first(where: { $0.fieldKey == fieldKey })?.secretReferenceId?.linearTrimmedNonEmpty else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "linear_credentials_missing",
                message: "The Linear provider connection is missing a required Keychain secret reference.",
                detail: ["fieldKey": .string(fieldKey)]
            )
        }
        do {
            return try secrets.getSecretValue(secretId)
        } catch {
            throw MarketplaceProviderActionAdapterFailure(
                code: "linear_credentials_unavailable",
                message: "Relay could not read the saved Linear token from the OS secret store. Reconnect Linear in Marketplace.",
                detail: ["fieldKey": .string(fieldKey)]
            )
        }
    }

    private func send(
        method: String,
        path: String,
        queryItems: [URLQueryItem],
        body: Data? = nil,
        credentials: Credentials
    ) throws -> JSONValue {
        var components = URLComponents(string: "https://api.linear.app/graphql\(path)")
        components?.queryItems = queryItems.isEmpty ? nil : queryItems
        guard let url = components?.url else {
            throw MarketplaceProviderActionAdapterFailure(code: "linear_invalid_url", message: "Could not build the Linear API URL.")
        }
        return try parseLinearResponse(httpClient.send(LinearProviderHTTPRequest(
            method: method,
            url: url,
            headers: [
                "Authorization": "Bearer \(credentials.accessToken)",
                "Accept": "application/json",
                "Content-Type": "application/json; charset=utf-8",
                "User-Agent": "RelayConsole"
            ],
            body: body
        )))
    }

    private func parseLinearResponse(_ response: LinearProviderHTTPResponse) throws -> JSONValue {
        guard (200..<300).contains(response.statusCode) else {
            let message = (try? JSONSerialization.jsonObject(with: response.body))
                .map(LinearProviderActionAdapterSupport.jsonValue(from:))?
                .objectValue?["message"]?.string
            throw MarketplaceProviderActionAdapterFailure(
                code: "linear_http_error",
                message: message ?? "Linear API returned an HTTP error.",
                providerStatusCode: response.statusCode
            )
        }
        guard !response.body.isEmpty else {
            return .object([:])
        }
        let json = try JSONSerialization.jsonObject(with: response.body)
        return LinearProviderActionAdapterSupport.jsonValue(from: json)
    }

    private func baseResult(request: MarketplaceProviderActionAdapterRequest, credentials: Credentials) -> JSONRecord {
        [
            "adapterBoundary": .string("linear-provider-action-adapter"),
            "clientMode": .string("live-linear-rest-api"),
            "provider": .string("linear"),
            "username": credentials.login.map(JSONValue.string) ?? .null,
            "workspace": credentials.organization.map(JSONValue.string) ?? .null,
            "permission": .string(request.permission.rawValue),
            "payloadHash": .string(MarketplaceProviderActionApprovalService.payloadHash(request.payload)),
            "approved": .bool(request.approvalReference?.status == .approved),
            "idempotencyKey": .string(request.idempotencyKey),
            "liveCredentialsUsed": .bool(true),
            "rawProviderToolExposure": .bool(false),
            "redactionStatus": .string("private-state-excluded")
        ]
    }

    private func linearItemSummary(_ value: JSONValue) -> JSONRecord {
        let object = value.objectValue ?? [:]
        return [
            "fullName": object["full_name"] ?? object["full_name"] ?? .null,
            "description": .string((object["description"]?.string ?? "").prefixString(500)),
            "visibility": object["visibility"] ?? .null,
            "webUrl": object["web_url"] ?? object["html_url"] ?? .null,
            "defaultBranch": object["default_branch"] ?? .null,
            "updatedAt": object["updated_at"] ?? .null,
            "redactionStatus": .string("private-state-excluded")
        ]
    }

    private func issueSummary(_ value: JSONValue) -> JSONRecord {
        let object = value.objectValue ?? [:]
        let user = object["author"]?.objectValue ?? object["user"]?.objectValue
        let body = (object["description"]?.string ?? object["body"]?.string) ?? ""
        return [
            "id": object["id"] ?? object["number"] ?? .null,
            "title": object["title"] ?? .null,
            "state": object["state"] ?? .null,
            "author": user?["username"] ?? user?["login"] ?? .null,
            "webUrl": object["web_url"] ?? object["html_url"] ?? .null,
            "updatedAt": object["updated_at"] ?? .null,
            "bodyExcerpt": .string(body.prefixString(800)),
            "truncated": .bool(body.count > 800),
            "redactionStatus": .string("private-state-excluded")
        ]
    }
}

public struct LinearProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowlistedActionKeys: Set<String> = [
        "linear_issue_search",
        "linear_issue_list",
        "linear_project_list",
        "linear_issue_comment_prepare",
        "linear_issue_create",
        "linear_issue_comment_create"
    ]

    private let client: any LinearProviderActionClient

    public init(client: any LinearProviderActionClient = FakeLinearProviderActionClient()) {
        self.client = client
    }

    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "linear" else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "linear_adapter_wrong_provider",
                message: "Linear adapter can only execute Linear provider actions.",
                detail: ["appSlug": .string(request.app.slug)]
            )
        }
        guard Self.allowlistedActionKeys.contains(request.definition.actionKey) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "linear_action_not_allowlisted",
                message: "The requested Linear action is not in the V1 adapter allowlist.",
                detail: ["actionKey": .string(request.definition.actionKey)]
            )
        }
        let output = try client.executeLinearAction(request: request)
        return MarketplaceProviderActionAdapterResult(result: output.result, error: nil, redactionStatus: output.redactionStatus)
    }
}

public enum LinearProviderActionAdapterSupport {
    public static func requiredPayloadString(request: MarketplaceProviderActionAdapterRequest, key: String, label: String) throws -> String {
        guard let value = request.payload[key]?.string?.linearTrimmedNonEmpty else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "linear_missing_required_field",
                message: "Linear \(label) is required.",
                detail: ["field": .string(key)]
            )
        }
        return value
    }

    public static func boundedInt(_ value: JSONValue?, defaultValue: Int, minValue: Int, maxValue: Int) -> Int {
        let raw = value?.number.map(Int.init) ?? value?.string.flatMap(Int.init) ?? defaultValue
        return max(minValue, min(maxValue, raw))
    }

    public static func normalizedCommentPayload(_ payload: JSONRecord, numberKey: String) throws -> JSONRecord {
        guard let teamKey = payload["teamKey"]?.string?.linearTrimmedNonEmpty else {
            throw MarketplaceProviderActionAdapterFailure(code: "linear_missing_required_field", message: "Linear team key is required.", detail: ["field": .string("teamKey")])
        }
        let rawNumber = payload[numberKey]?.string?.linearTrimmedNonEmpty
            ?? payload[numberKey]?.number.map { String(Int($0)) }
        guard let number = rawNumber else {
            throw MarketplaceProviderActionAdapterFailure(code: "linear_missing_required_field", message: "Linear issue or project id is required.", detail: ["field": .string(numberKey)])
        }
        guard let body = payload["body"]?.string?.linearTrimmedNonEmpty else {
            throw MarketplaceProviderActionAdapterFailure(code: "linear_missing_required_field", message: "Linear comment body is required.", detail: ["field": .string("body")])
        }
        guard body.count <= 8000 else {
            throw MarketplaceProviderActionAdapterFailure(code: "linear_comment_too_long", message: "Linear comment body is limited to 8000 characters in Relay V1.")
        }
        return [
            "teamKey": .string(teamKey),
            "id": .string(number),
            "body": .string(body)
        ]
    }

    public static func normalizedIssueCreatePayload(_ payload: JSONRecord) throws -> JSONRecord {
        guard let teamKey = payload["teamKey"]?.string?.linearTrimmedNonEmpty else {
            throw MarketplaceProviderActionAdapterFailure(code: "linear_missing_required_field", message: "Linear team key is required.", detail: ["field": .string("teamKey")])
        }
        guard let title = payload["title"]?.string?.linearTrimmedNonEmpty else {
            throw MarketplaceProviderActionAdapterFailure(code: "linear_missing_required_field", message: "Linear issue title is required.", detail: ["field": .string("title")])
        }
        let description = payload["description"]?.string?.linearTrimmedNonEmpty
        guard title.count <= 512 else {
            throw MarketplaceProviderActionAdapterFailure(code: "linear_issue_title_too_long", message: "Linear issue title is limited to 512 characters in Relay V1.")
        }
        if let description, description.count > 16000 {
            throw MarketplaceProviderActionAdapterFailure(code: "linear_issue_description_too_long", message: "Linear issue description is limited to 16000 characters in Relay V1.")
        }
        return [
            "teamKey": .string(teamKey),
            "title": .string(title),
            "description": description.map(JSONValue.string) ?? .null
        ]
    }

    public static func urlPathComponent(_ value: String) -> String {
        value.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed)?
            .replacingOccurrences(of: "?", with: "%3F") ?? value
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
    var linearTrimmedNonEmpty: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    var linearSlug: String {
        lowercased()
            .map { $0.isLetter || $0.isNumber ? String($0) : "-" }
            .joined()
            .trimmingCharacters(in: CharacterSet(charactersIn: "-"))
    }

    func prefixString(_ maxLength: Int) -> String {
        String(prefix(maxLength))
    }
}
