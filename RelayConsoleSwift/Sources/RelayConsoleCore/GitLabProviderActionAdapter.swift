import Foundation

public struct GitLabProviderActionClientResult: Codable, Equatable, Sendable {
    public var result: JSONRecord
    public var redactionStatus: String

    public init(result: JSONRecord, redactionStatus: String = "private-state-excluded") {
        self.result = result
        self.redactionStatus = redactionStatus
    }
}

public protocol GitLabProviderActionClient: Sendable {
    func executeGitLabAction(request: MarketplaceProviderActionAdapterRequest) throws -> GitLabProviderActionClientResult
}

public struct GitLabProviderHTTPRequest: Sendable, Equatable {
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

public struct GitLabProviderHTTPResponse: Sendable, Equatable {
    public var statusCode: Int
    public var body: Data

    public init(statusCode: Int, body: Data = Data()) {
        self.statusCode = statusCode
        self.body = body
    }
}

public protocol GitLabProviderHTTPClient: Sendable {
    func send(_ request: GitLabProviderHTTPRequest) throws -> GitLabProviderHTTPResponse
}

public struct URLSessionGitLabProviderHTTPClient: GitLabProviderHTTPClient {
    private let timeoutSeconds: TimeInterval

    public init(timeoutSeconds: TimeInterval = 20) {
        self.timeoutSeconds = timeoutSeconds
    }

    public func send(_ request: GitLabProviderHTTPRequest) throws -> GitLabProviderHTTPResponse {
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
                code: "gitlab_http_timeout",
                message: "GitLab API request timed out.",
                detail: ["urlHost": .string(request.url.host ?? "gitlab.com")]
            )
        }
        if let responseError {
            throw responseError
        }
        return GitLabProviderHTTPResponse(statusCode: responseStatusCode ?? 0, body: responseData ?? Data())
    }
}

public struct FakeGitLabProviderActionClient: GitLabProviderActionClient {
    public init() {}

    public func executeGitLabAction(request: MarketplaceProviderActionAdapterRequest) throws -> GitLabProviderActionClientResult {
        switch request.definition.actionKey {
        case "gitlab_project_search":
            return try projectSearch(request: request)
        case "gitlab_issue_list":
            return try issueList(request: request)
        case "gitlab_merge_request_list":
            return try mergeRequestList(request: request)
        case "gitlab_issue_comment_prepare":
            return try issueCommentPrepare(request: request)
        case "gitlab_issue_comment_create":
            return try issueCommentCreate(request: request, issueKey: "issueIid")
        case "gitlab_merge_request_comment_create":
            return try issueCommentCreate(request: request, issueKey: "mergeRequestIid")
        default:
            throw MarketplaceProviderActionAdapterFailure(
                code: "gitlab_fake_action_not_supported",
                message: "The fake GitLab client does not support this action.",
                detail: ["actionKey": .string(request.definition.actionKey)]
            )
        }
    }

    private func projectSearch(request: MarketplaceProviderActionAdapterRequest) throws -> GitLabProviderActionClientResult {
        let query = try GitLabProviderActionAdapterSupport.requiredPayloadString(request: request, key: "query", label: "project search query")
        let limit = GitLabProviderActionAdapterSupport.boundedInt(request.payload["maxResults"], defaultValue: 5, minValue: 1, maxValue: 25)
        return GitLabProviderActionClientResult(result: baseResult(request: request).merging([
            "semanticReadContract": .string("gitlab-project-search-v1"),
            "query": .string(query),
            "projects": .array((0..<limit).map { index in
                .object([
                    "fullName": .string("relay-demo/\(query.gitlabSlug)-\(index + 1)"),
                    "description": .string("Bounded GitLab project result \(index + 1) for \(query)."),
                    "visibility": .string("private-state-excluded"),
                    "webUrl": .string("https://gitlab.com/relay-demo/\(query.gitlabSlug)-\(index + 1)"),
                    "updatedAt": .string("2026-07-09T00:00:00Z"),
                    "redactionStatus": .string("private-state-excluded")
                ])
            })
        ]) { _, new in new })
    }

    private func issueList(request: MarketplaceProviderActionAdapterRequest) throws -> GitLabProviderActionClientResult {
        let projectPath = try GitLabProviderActionAdapterSupport.requiredPayloadString(request: request, key: "projectPath", label: "project path")
        let limit = GitLabProviderActionAdapterSupport.boundedInt(request.payload["maxResults"], defaultValue: 10, minValue: 1, maxValue: 50)
        return GitLabProviderActionClientResult(result: baseResult(request: request).merging([
            "semanticReadContract": .string("gitlab-issue-list-v1"),
            "projectPath": .string(projectPath),
            "issues": .array((0..<limit).map { index in
                .object([
                    "iid": .number(Double(index + 1)),
                    "title": .string("Bounded GitLab issue \(index + 1)"),
                    "state": .string("opened"),
                    "author": .string("relay-user-\(index + 1)"),
                    "webUrl": .string("https://gitlab.com/\(projectPath)/-/issues/\(index + 1)"),
                    "bodyExcerpt": .string("Demo issue body excerpt."),
                    "redactionStatus": .string("private-state-excluded")
                ])
            })
        ]) { _, new in new })
    }

    private func mergeRequestList(request: MarketplaceProviderActionAdapterRequest) throws -> GitLabProviderActionClientResult {
        let projectPath = try GitLabProviderActionAdapterSupport.requiredPayloadString(request: request, key: "projectPath", label: "project path")
        let limit = GitLabProviderActionAdapterSupport.boundedInt(request.payload["maxResults"], defaultValue: 10, minValue: 1, maxValue: 50)
        return GitLabProviderActionClientResult(result: baseResult(request: request).merging([
            "semanticReadContract": .string("gitlab-merge-request-list-v1"),
            "projectPath": .string(projectPath),
            "mergeRequests": .array((0..<limit).map { index in
                .object([
                    "iid": .number(Double(index + 1)),
                    "title": .string("Bounded GitLab merge request \(index + 1)"),
                    "state": .string("opened"),
                    "author": .string("relay-user-\(index + 1)"),
                    "webUrl": .string("https://gitlab.com/\(projectPath)/-/merge_requests/\(index + 1)"),
                    "bodyExcerpt": .string("Demo merge request body excerpt."),
                    "redactionStatus": .string("private-state-excluded")
                ])
            })
        ]) { _, new in new })
    }

    private func issueCommentPrepare(request: MarketplaceProviderActionAdapterRequest) throws -> GitLabProviderActionClientResult {
        let normalized = try GitLabProviderActionAdapterSupport.normalizedCommentPayload(request.payload, numberKey: "issueIid")
        return GitLabProviderActionClientResult(result: baseResult(request: request).merging([
            "draftPreview": .object([
                "projectPath": normalized["projectPath"] ?? .null,
                "iid": normalized["iid"] ?? .null,
                "bodyPreview": normalized["body"] ?? .string(""),
                "payloadHash": .string(MarketplaceProviderActionApprovalService.payloadHash(normalized)),
                "providerMutation": .bool(false),
                "redactionStatus": .string("private-state-excluded")
            ])
        ]) { _, new in new })
    }

    private func issueCommentCreate(request: MarketplaceProviderActionAdapterRequest, issueKey: String) throws -> GitLabProviderActionClientResult {
        let normalized = try GitLabProviderActionAdapterSupport.normalizedCommentPayload(request.payload, numberKey: issueKey)
        let suffix = GitLabProviderActionAdapterSupport.stableSuffix(MarketplaceProviderActionApprovalService.payloadHash(normalized))
        return GitLabProviderActionClientResult(result: baseResult(request: request).merging([
            "commentId": .string("glc_\(suffix)"),
            "webUrl": .string("https://gitlab.com/\(normalized["projectPath"]?.string ?? "project")/-/issues/\(normalized["iid"]?.string ?? "0")#note-\(suffix)"),
            "payloadHash": .string(MarketplaceProviderActionApprovalService.payloadHash(normalized)),
            "auditId": .string(request.auditIdentity.dispatchId ?? request.idempotencyKey),
            "redactionStatus": .string("private-state-excluded")
        ]) { _, new in new })
    }

    private func baseResult(request: MarketplaceProviderActionAdapterRequest) -> JSONRecord {
        [
            "fakeAdapter": .bool(true),
            "adapterBoundary": .string("gitlab-provider-action-adapter"),
            "clientMode": .string("fake-gitlab-client"),
            "provider": .string("gitlab"),
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

public final class LiveGitLabProviderActionClient: GitLabProviderActionClient, @unchecked Sendable {
    fileprivate struct Credentials {
        var accessToken: String
        var login: String?
        var organization: String?
    }

    private let data: LocalDataService
    private let secrets: SecretService
    private let httpClient: any GitLabProviderHTTPClient

    public init(
        data: LocalDataService,
        secrets: SecretService,
        httpClient: any GitLabProviderHTTPClient = URLSessionGitLabProviderHTTPClient()
    ) {
        self.data = data
        self.secrets = secrets
        self.httpClient = httpClient
    }

    public func executeGitLabAction(request: MarketplaceProviderActionAdapterRequest) throws -> GitLabProviderActionClientResult {
        switch request.definition.actionKey {
        case "gitlab_project_search":
            return try projectSearch(request: request)
        case "gitlab_issue_list":
            return try issueList(request: request)
        case "gitlab_merge_request_list":
            return try mergeRequestList(request: request)
        case "gitlab_issue_comment_prepare":
            return try FakeGitLabProviderActionClient().executeGitLabAction(request: request)
        case "gitlab_issue_comment_create":
            return try commentCreate(request: request, numberKey: "issueIid")
        case "gitlab_merge_request_comment_create":
            return try commentCreate(request: request, numberKey: "mergeRequestIid")
        default:
            throw MarketplaceProviderActionAdapterFailure(
                code: "gitlab_live_action_not_implemented",
                message: "Live GitLab provider execution does not support this action.",
                detail: ["actionKey": .string(request.definition.actionKey)]
            )
        }
    }

    private func projectSearch(request: MarketplaceProviderActionAdapterRequest) throws -> GitLabProviderActionClientResult {
        let credentials = try credentials(for: request)
        let query = try GitLabProviderActionAdapterSupport.requiredPayloadString(request: request, key: "query", label: "project search query")
        let limit = GitLabProviderActionAdapterSupport.boundedInt(request.payload["maxResults"], defaultValue: 5, minValue: 1, maxValue: 25)
        let parsed = try send(
            method: "GET",
            path: "/projects",
            queryItems: [
                URLQueryItem(name: "search", value: query),
                URLQueryItem(name: "per_page", value: "\(limit)")
            ],
            credentials: credentials
        )
        let items = parsed.arrayValue ?? []
        return GitLabProviderActionClientResult(result: baseResult(request: request, credentials: credentials).merging([
            "semanticReadContract": .string("gitlab-project-search-v1"),
            "query": .string(query),
            "projects": .array(items.prefix(limit).map { .object(projectSummary($0)) })
        ]) { _, new in new })
    }

    private func issueList(request: MarketplaceProviderActionAdapterRequest) throws -> GitLabProviderActionClientResult {
        let credentials = try credentials(for: request)
        let projectPath = try GitLabProviderActionAdapterSupport.requiredPayloadString(request: request, key: "projectPath", label: "project path")
        let limit = GitLabProviderActionAdapterSupport.boundedInt(request.payload["maxResults"], defaultValue: 10, minValue: 1, maxValue: 50)
        let state = request.payload["state"]?.string?.gitlabTrimmedNonEmpty ?? "opened"
        let parsed = try send(
            method: "GET",
            path: "/projects/\(GitLabProviderActionAdapterSupport.urlPathComponent(projectPath))/issues",
            queryItems: [
                URLQueryItem(name: "state", value: state),
                URLQueryItem(name: "per_page", value: "\(limit)")
            ],
            credentials: credentials
        )
        let issues = parsed.arrayValue ?? []
        return GitLabProviderActionClientResult(result: baseResult(request: request, credentials: credentials).merging([
            "semanticReadContract": .string("gitlab-issue-list-v1"),
            "projectPath": .string(projectPath),
            "issues": .array(issues.prefix(limit).map { .object(issueSummary($0)) })
        ]) { _, new in new })
    }

    private func mergeRequestList(request: MarketplaceProviderActionAdapterRequest) throws -> GitLabProviderActionClientResult {
        let credentials = try credentials(for: request)
        let projectPath = try GitLabProviderActionAdapterSupport.requiredPayloadString(request: request, key: "projectPath", label: "project path")
        let limit = GitLabProviderActionAdapterSupport.boundedInt(request.payload["maxResults"], defaultValue: 10, minValue: 1, maxValue: 50)
        let state = request.payload["state"]?.string?.gitlabTrimmedNonEmpty ?? "opened"
        let parsed = try send(
            method: "GET",
            path: "/projects/\(GitLabProviderActionAdapterSupport.urlPathComponent(projectPath))/merge_requests",
            queryItems: [
                URLQueryItem(name: "state", value: state),
                URLQueryItem(name: "per_page", value: "\(limit)")
            ],
            credentials: credentials
        )
        let mergeRequests = parsed.arrayValue ?? []
        return GitLabProviderActionClientResult(result: baseResult(request: request, credentials: credentials).merging([
            "semanticReadContract": .string("gitlab-merge-request-list-v1"),
            "projectPath": .string(projectPath),
            "mergeRequests": .array(mergeRequests.prefix(limit).map { .object(issueSummary($0)) })
        ]) { _, new in new })
    }

    private func commentCreate(request: MarketplaceProviderActionAdapterRequest, numberKey: String) throws -> GitLabProviderActionClientResult {
        let credentials = try credentials(for: request)
        let normalized = try GitLabProviderActionAdapterSupport.normalizedCommentPayload(request.payload, numberKey: numberKey)
        let projectPath = normalized["projectPath"]?.string ?? ""
        let iid = normalized["iid"]?.string ?? ""
        let notesPath = numberKey == "mergeRequestIid" ? "merge_requests" : "issues"
        let body = try JSONSerialization.data(withJSONObject: ["body": normalized["body"]?.string ?? ""])
        let parsed = try send(
            method: "POST",
            path: "/projects/\(GitLabProviderActionAdapterSupport.urlPathComponent(projectPath))/\(notesPath)/\(iid)/notes",
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
        return GitLabProviderActionClientResult(result: result)
    }

    private func credentials(for request: MarketplaceProviderActionAdapterRequest) throws -> Credentials {
        guard let connectionId = request.auditIdentity.connectionId?.gitlabTrimmedNonEmpty,
              let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: connectionId),
              connection.appId == request.app.id,
              connection.appSlug == request.app.slug else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "gitlab_connection_missing",
                message: "GitLab execution requires a Relay Marketplace provider connection."
            )
        }
        guard connection.status == .connected || connection.status == .healthError else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "gitlab_connection_not_ready",
                message: "The GitLab provider connection is not ready.",
                detail: ["connectionStatus": .string(connection.status.rawValue)]
            )
        }
        return Credentials(
            accessToken: try secret(fieldKey: "gitlab_oauth_access_token", connection: connection),
            login: connection.health.diagnostics["username"]?.string?.gitlabTrimmedNonEmpty,
            organization: connection.health.diagnostics["group"]?.string?.gitlabTrimmedNonEmpty
        )
    }

    private func secret(fieldKey: String, connection: MarketplaceProviderConnection) throws -> String {
        guard let secretId = connection.credentialRequirements.first(where: { $0.fieldKey == fieldKey })?.secretReferenceId?.gitlabTrimmedNonEmpty else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "gitlab_credentials_missing",
                message: "The GitLab provider connection is missing a required Keychain secret reference.",
                detail: ["fieldKey": .string(fieldKey)]
            )
        }
        do {
            return try secrets.getSecretValue(secretId)
        } catch {
            throw MarketplaceProviderActionAdapterFailure(
                code: "gitlab_credentials_unavailable",
                message: "Relay could not read the saved GitLab token from the OS secret store. Reconnect GitLab in Marketplace.",
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
        var components = URLComponents(string: "https://gitlab.com/api/v4\(path)")
        components?.queryItems = queryItems.isEmpty ? nil : queryItems
        guard let url = components?.url else {
            throw MarketplaceProviderActionAdapterFailure(code: "gitlab_invalid_url", message: "Could not build the GitLab API URL.")
        }
        return try parseGitLabResponse(httpClient.send(GitLabProviderHTTPRequest(
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

    private func parseGitLabResponse(_ response: GitLabProviderHTTPResponse) throws -> JSONValue {
        guard (200..<300).contains(response.statusCode) else {
            let message = (try? JSONSerialization.jsonObject(with: response.body))
                .map(GitLabProviderActionAdapterSupport.jsonValue(from:))?
                .objectValue?["message"]?.string
            throw MarketplaceProviderActionAdapterFailure(
                code: "gitlab_http_error",
                message: message ?? "GitLab API returned an HTTP error.",
                providerStatusCode: response.statusCode
            )
        }
        guard !response.body.isEmpty else {
            return .object([:])
        }
        let json = try JSONSerialization.jsonObject(with: response.body)
        return GitLabProviderActionAdapterSupport.jsonValue(from: json)
    }

    private func baseResult(request: MarketplaceProviderActionAdapterRequest, credentials: Credentials) -> JSONRecord {
        [
            "adapterBoundary": .string("gitlab-provider-action-adapter"),
            "clientMode": .string("live-gitlab-rest-api"),
            "provider": .string("gitlab"),
            "username": credentials.login.map(JSONValue.string) ?? .null,
            "group": credentials.organization.map(JSONValue.string) ?? .null,
            "permission": .string(request.permission.rawValue),
            "payloadHash": .string(MarketplaceProviderActionApprovalService.payloadHash(request.payload)),
            "approved": .bool(request.approvalReference?.status == .approved),
            "idempotencyKey": .string(request.idempotencyKey),
            "liveCredentialsUsed": .bool(true),
            "rawProviderToolExposure": .bool(false),
            "redactionStatus": .string("private-state-excluded")
        ]
    }

    private func projectSummary(_ value: JSONValue) -> JSONRecord {
        let object = value.objectValue ?? [:]
        return [
            "fullName": object["path_with_namespace"] ?? object["name_with_namespace"] ?? .null,
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
            "iid": object["iid"] ?? object["number"] ?? .null,
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

public struct GitLabProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowlistedActionKeys: Set<String> = [
        "gitlab_project_search",
        "gitlab_issue_list",
        "gitlab_merge_request_list",
        "gitlab_issue_comment_prepare",
        "gitlab_issue_comment_create",
        "gitlab_merge_request_comment_create"
    ]

    private let client: any GitLabProviderActionClient

    public init(client: any GitLabProviderActionClient = FakeGitLabProviderActionClient()) {
        self.client = client
    }

    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "gitlab" else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "gitlab_adapter_wrong_provider",
                message: "GitLab adapter can only execute GitLab provider actions.",
                detail: ["appSlug": .string(request.app.slug)]
            )
        }
        guard Self.allowlistedActionKeys.contains(request.definition.actionKey) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "gitlab_action_not_allowlisted",
                message: "The requested GitLab action is not in the V1 adapter allowlist.",
                detail: ["actionKey": .string(request.definition.actionKey)]
            )
        }
        let output = try client.executeGitLabAction(request: request)
        return MarketplaceProviderActionAdapterResult(result: output.result, error: nil, redactionStatus: output.redactionStatus)
    }
}

public enum GitLabProviderActionAdapterSupport {
    public static func requiredPayloadString(request: MarketplaceProviderActionAdapterRequest, key: String, label: String) throws -> String {
        guard let value = request.payload[key]?.string?.gitlabTrimmedNonEmpty else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "gitlab_missing_required_field",
                message: "GitLab \(label) is required.",
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
        guard let projectPath = payload["projectPath"]?.string?.gitlabTrimmedNonEmpty else {
            throw MarketplaceProviderActionAdapterFailure(code: "gitlab_missing_required_field", message: "GitLab project path is required.", detail: ["field": .string("projectPath")])
        }
        let rawNumber = payload[numberKey]?.string?.gitlabTrimmedNonEmpty
            ?? payload[numberKey]?.number.map { String(Int($0)) }
        guard let number = rawNumber else {
            throw MarketplaceProviderActionAdapterFailure(code: "gitlab_missing_required_field", message: "GitLab issue or merge request iid is required.", detail: ["field": .string(numberKey)])
        }
        guard let body = payload["body"]?.string?.gitlabTrimmedNonEmpty else {
            throw MarketplaceProviderActionAdapterFailure(code: "gitlab_missing_required_field", message: "GitLab comment body is required.", detail: ["field": .string("body")])
        }
        guard body.count <= 8000 else {
            throw MarketplaceProviderActionAdapterFailure(code: "gitlab_comment_too_long", message: "GitLab comment body is limited to 8000 characters in Relay V1.")
        }
        return [
            "projectPath": .string(projectPath),
            "iid": .string(number),
            "body": .string(body)
        ]
    }

    public static func urlPathComponent(_ value: String) -> String {
        value.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed)?
            .replacingOccurrences(of: "/", with: "%2F") ?? value
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
    var gitlabTrimmedNonEmpty: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    var gitlabSlug: String {
        lowercased()
            .map { $0.isLetter || $0.isNumber ? String($0) : "-" }
            .joined()
            .trimmingCharacters(in: CharacterSet(charactersIn: "-"))
    }

    func prefixString(_ maxLength: Int) -> String {
        String(prefix(maxLength))
    }
}
