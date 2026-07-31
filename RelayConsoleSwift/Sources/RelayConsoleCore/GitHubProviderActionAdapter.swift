import Foundation

public struct GitHubProviderActionClientResult: Codable, Equatable, Sendable {
    public var result: JSONRecord
    public var redactionStatus: String

    public init(result: JSONRecord, redactionStatus: String = "private-state-excluded") {
        self.result = result
        self.redactionStatus = redactionStatus
    }
}

public protocol GitHubProviderActionClient: Sendable {
    func executeGitHubAction(request: MarketplaceProviderActionAdapterRequest) throws -> GitHubProviderActionClientResult
}

public struct GitHubProviderHTTPRequest: Sendable, Equatable {
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

public struct GitHubProviderHTTPResponse: Sendable, Equatable {
    public var statusCode: Int
    public var body: Data

    public init(statusCode: Int, body: Data = Data()) {
        self.statusCode = statusCode
        self.body = body
    }
}

public protocol GitHubProviderHTTPClient: Sendable {
    func send(_ request: GitHubProviderHTTPRequest) throws -> GitHubProviderHTTPResponse
}

public struct URLSessionGitHubProviderHTTPClient: GitHubProviderHTTPClient {
    private let timeoutSeconds: TimeInterval

    public init(timeoutSeconds: TimeInterval = 20) {
        self.timeoutSeconds = timeoutSeconds
    }

    public func send(_ request: GitHubProviderHTTPRequest) throws -> GitHubProviderHTTPResponse {
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
                code: "github_http_timeout",
                message: "GitHub API request timed out.",
                detail: ["urlHost": .string(request.url.host ?? "api.github.com")]
            )
        }
        if let responseError {
            throw responseError
        }
        return GitHubProviderHTTPResponse(statusCode: responseStatusCode ?? 0, body: responseData ?? Data())
    }
}

public struct FakeGitHubProviderActionClient: GitHubProviderActionClient {
    public init() {}

    public func executeGitHubAction(request: MarketplaceProviderActionAdapterRequest) throws -> GitHubProviderActionClientResult {
        switch request.definition.actionKey {
        case "github_repo_search":
            return try repoSearch(request: request)
        case "github_issue_list":
            return try issueList(request: request)
        case "github_pull_request_list":
            return try pullRequestList(request: request)
        case "github_issue_comment_prepare":
            return try issueCommentPrepare(request: request)
        case "github_issue_comment_create":
            return try issueCommentCreate(request: request, issueKey: "issueNumber")
        case "github_pull_request_comment_create":
            return try issueCommentCreate(request: request, issueKey: "pullNumber")
        default:
            throw MarketplaceProviderActionAdapterFailure(
                code: "github_fake_action_not_supported",
                message: "The fake GitHub client does not support this action.",
                detail: ["actionKey": .string(request.definition.actionKey)]
            )
        }
    }

    private func repoSearch(request: MarketplaceProviderActionAdapterRequest) throws -> GitHubProviderActionClientResult {
        let query = try GitHubProviderActionAdapterSupport.requiredPayloadString(request: request, key: "query", label: "repository search query")
        let limit = GitHubProviderActionAdapterSupport.boundedInt(request.payload["maxResults"], defaultValue: 5, minValue: 1, maxValue: 25)
        return GitHubProviderActionClientResult(result: baseResult(request: request).merging([
            "semanticReadContract": .string("github-repo-search-v1"),
            "query": .string(query),
            "repositories": .array((0..<limit).map { index in
                .object([
                    "fullName": .string("relay-demo/\(query.githubSlug)-\(index + 1)"),
                    "description": .string("Bounded GitHub repository result \(index + 1) for \(query)."),
                    "visibility": .string("private-state-excluded"),
                    "htmlUrl": .string("https://github.com/relay-demo/\(query.githubSlug)-\(index + 1)"),
                    "updatedAt": .string("2026-07-09T00:00:00Z"),
                    "redactionStatus": .string("private-state-excluded")
                ])
            })
        ]) { _, new in new })
    }

    private func issueList(request: MarketplaceProviderActionAdapterRequest) throws -> GitHubProviderActionClientResult {
        let owner = try GitHubProviderActionAdapterSupport.requiredPayloadString(request: request, key: "owner", label: "repository owner")
        let repo = try GitHubProviderActionAdapterSupport.requiredPayloadString(request: request, key: "repo", label: "repository name")
        let limit = GitHubProviderActionAdapterSupport.boundedInt(request.payload["maxResults"], defaultValue: 10, minValue: 1, maxValue: 50)
        return GitHubProviderActionClientResult(result: baseResult(request: request).merging([
            "semanticReadContract": .string("github-issue-list-v1"),
            "repository": .string("\(owner)/\(repo)"),
            "issues": .array((0..<limit).map { index in
                .object([
                    "number": .number(Double(index + 1)),
                    "title": .string("Bounded GitHub issue \(index + 1)"),
                    "state": .string("open"),
                    "author": .string("relay-user-\(index + 1)"),
                    "htmlUrl": .string("https://github.com/\(owner)/\(repo)/issues/\(index + 1)"),
                    "bodyExcerpt": .string("Demo issue body excerpt."),
                    "redactionStatus": .string("private-state-excluded")
                ])
            })
        ]) { _, new in new })
    }

    private func pullRequestList(request: MarketplaceProviderActionAdapterRequest) throws -> GitHubProviderActionClientResult {
        let owner = try GitHubProviderActionAdapterSupport.requiredPayloadString(request: request, key: "owner", label: "repository owner")
        let repo = try GitHubProviderActionAdapterSupport.requiredPayloadString(request: request, key: "repo", label: "repository name")
        let limit = GitHubProviderActionAdapterSupport.boundedInt(request.payload["maxResults"], defaultValue: 10, minValue: 1, maxValue: 50)
        return GitHubProviderActionClientResult(result: baseResult(request: request).merging([
            "semanticReadContract": .string("github-pull-request-list-v1"),
            "repository": .string("\(owner)/\(repo)"),
            "pullRequests": .array((0..<limit).map { index in
                .object([
                    "number": .number(Double(index + 1)),
                    "title": .string("Bounded GitHub pull request \(index + 1)"),
                    "state": .string("open"),
                    "author": .string("relay-user-\(index + 1)"),
                    "htmlUrl": .string("https://github.com/\(owner)/\(repo)/pull/\(index + 1)"),
                    "bodyExcerpt": .string("Demo pull request body excerpt."),
                    "redactionStatus": .string("private-state-excluded")
                ])
            })
        ]) { _, new in new })
    }

    private func issueCommentPrepare(request: MarketplaceProviderActionAdapterRequest) throws -> GitHubProviderActionClientResult {
        let normalized = try GitHubProviderActionAdapterSupport.normalizedCommentPayload(request.payload, numberKey: "issueNumber")
        return GitHubProviderActionClientResult(result: baseResult(request: request).merging([
            "draftPreview": .object([
                "repository": .string("\(normalized["owner"]?.string ?? "")/\(normalized["repo"]?.string ?? "")"),
                "number": normalized["number"] ?? .null,
                "bodyPreview": normalized["body"] ?? .string(""),
                "payloadHash": .string(MarketplaceProviderActionApprovalService.payloadHash(normalized)),
                "providerMutation": .bool(false),
                "redactionStatus": .string("private-state-excluded")
            ])
        ]) { _, new in new })
    }

    private func issueCommentCreate(request: MarketplaceProviderActionAdapterRequest, issueKey: String) throws -> GitHubProviderActionClientResult {
        let normalized = try GitHubProviderActionAdapterSupport.normalizedCommentPayload(request.payload, numberKey: issueKey)
        let suffix = GitHubProviderActionAdapterSupport.stableSuffix(MarketplaceProviderActionApprovalService.payloadHash(normalized))
        return GitHubProviderActionClientResult(result: baseResult(request: request).merging([
            "commentId": .string("ghc_\(suffix)"),
            "htmlUrl": .string("https://github.com/\(normalized["owner"]?.string ?? "owner")/\(normalized["repo"]?.string ?? "repo")/issues/\(normalized["number"]?.string ?? "0")#issuecomment-\(suffix)"),
            "payloadHash": .string(MarketplaceProviderActionApprovalService.payloadHash(normalized)),
            "auditId": .string(request.auditIdentity.dispatchId ?? request.idempotencyKey),
            "redactionStatus": .string("private-state-excluded")
        ]) { _, new in new })
    }

    private func baseResult(request: MarketplaceProviderActionAdapterRequest) -> JSONRecord {
        [
            "fakeAdapter": .bool(true),
            "adapterBoundary": .string("github-provider-action-adapter"),
            "clientMode": .string("fake-github-client"),
            "provider": .string("github"),
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

public final class LiveGitHubProviderActionClient: GitHubProviderActionClient, @unchecked Sendable {
    fileprivate struct Credentials {
        var accessToken: String
        var login: String?
        var organization: String?
    }

    private let data: LocalDataService
    private let secrets: SecretService
    private let httpClient: any GitHubProviderHTTPClient

    public init(
        data: LocalDataService,
        secrets: SecretService,
        httpClient: any GitHubProviderHTTPClient = URLSessionGitHubProviderHTTPClient()
    ) {
        self.data = data
        self.secrets = secrets
        self.httpClient = httpClient
    }

    public func executeGitHubAction(request: MarketplaceProviderActionAdapterRequest) throws -> GitHubProviderActionClientResult {
        switch request.definition.actionKey {
        case "github_repo_search":
            return try repoSearch(request: request)
        case "github_issue_list":
            return try issueList(request: request)
        case "github_pull_request_list":
            return try pullRequestList(request: request)
        case "github_issue_comment_prepare":
            return try FakeGitHubProviderActionClient().executeGitHubAction(request: request)
        case "github_issue_comment_create":
            return try commentCreate(request: request, numberKey: "issueNumber")
        case "github_pull_request_comment_create":
            return try commentCreate(request: request, numberKey: "pullNumber")
        default:
            throw MarketplaceProviderActionAdapterFailure(
                code: "github_live_action_not_implemented",
                message: "Live GitHub provider execution does not support this action.",
                detail: ["actionKey": .string(request.definition.actionKey)]
            )
        }
    }

    private func repoSearch(request: MarketplaceProviderActionAdapterRequest) throws -> GitHubProviderActionClientResult {
        let credentials = try credentials(for: request)
        let query = try GitHubProviderActionAdapterSupport.requiredPayloadString(request: request, key: "query", label: "repository search query")
        let limit = GitHubProviderActionAdapterSupport.boundedInt(request.payload["maxResults"], defaultValue: 5, minValue: 1, maxValue: 25)
        let parsed = try send(
            method: "GET",
            path: "/search/repositories",
            queryItems: [
                URLQueryItem(name: "q", value: query),
                URLQueryItem(name: "per_page", value: "\(limit)")
            ],
            credentials: credentials
        )
        let items = parsed.objectValue?["items"]?.arrayValue ?? []
        return GitHubProviderActionClientResult(result: baseResult(request: request, credentials: credentials).merging([
            "semanticReadContract": .string("github-repo-search-v1"),
            "query": .string(query),
            "repositories": .array(items.prefix(limit).map { .object(repositorySummary($0)) })
        ]) { _, new in new })
    }

    private func issueList(request: MarketplaceProviderActionAdapterRequest) throws -> GitHubProviderActionClientResult {
        let credentials = try credentials(for: request)
        let owner = try GitHubProviderActionAdapterSupport.requiredPayloadString(request: request, key: "owner", label: "repository owner")
        let repo = try GitHubProviderActionAdapterSupport.requiredPayloadString(request: request, key: "repo", label: "repository name")
        let limit = GitHubProviderActionAdapterSupport.boundedInt(request.payload["maxResults"], defaultValue: 10, minValue: 1, maxValue: 50)
        let state = request.payload["state"]?.string?.githubTrimmedNonEmpty ?? "open"
        let parsed = try send(
            method: "GET",
            path: "/repos/\(owner)/\(repo)/issues",
            queryItems: [
                URLQueryItem(name: "state", value: state),
                URLQueryItem(name: "per_page", value: "\(limit)")
            ],
            credentials: credentials
        )
        let issues = parsed.arrayValue ?? []
        return GitHubProviderActionClientResult(result: baseResult(request: request, credentials: credentials).merging([
            "semanticReadContract": .string("github-issue-list-v1"),
            "repository": .string("\(owner)/\(repo)"),
            "issues": .array(issues.prefix(limit).map { .object(issueSummary($0)) })
        ]) { _, new in new })
    }

    private func pullRequestList(request: MarketplaceProviderActionAdapterRequest) throws -> GitHubProviderActionClientResult {
        let credentials = try credentials(for: request)
        let owner = try GitHubProviderActionAdapterSupport.requiredPayloadString(request: request, key: "owner", label: "repository owner")
        let repo = try GitHubProviderActionAdapterSupport.requiredPayloadString(request: request, key: "repo", label: "repository name")
        let limit = GitHubProviderActionAdapterSupport.boundedInt(request.payload["maxResults"], defaultValue: 10, minValue: 1, maxValue: 50)
        let state = request.payload["state"]?.string?.githubTrimmedNonEmpty ?? "open"
        let parsed = try send(
            method: "GET",
            path: "/repos/\(owner)/\(repo)/pulls",
            queryItems: [
                URLQueryItem(name: "state", value: state),
                URLQueryItem(name: "per_page", value: "\(limit)")
            ],
            credentials: credentials
        )
        let pulls = parsed.arrayValue ?? []
        return GitHubProviderActionClientResult(result: baseResult(request: request, credentials: credentials).merging([
            "semanticReadContract": .string("github-pull-request-list-v1"),
            "repository": .string("\(owner)/\(repo)"),
            "pullRequests": .array(pulls.prefix(limit).map { .object(issueSummary($0)) })
        ]) { _, new in new })
    }

    private func commentCreate(request: MarketplaceProviderActionAdapterRequest, numberKey: String) throws -> GitHubProviderActionClientResult {
        let credentials = try credentials(for: request)
        let normalized = try GitHubProviderActionAdapterSupport.normalizedCommentPayload(request.payload, numberKey: numberKey)
        let owner = normalized["owner"]?.string ?? ""
        let repo = normalized["repo"]?.string ?? ""
        let number = normalized["number"]?.string ?? ""
        let body = try JSONSerialization.data(withJSONObject: ["body": normalized["body"]?.string ?? ""])
        let parsed = try send(
            method: "POST",
            path: "/repos/\(owner)/\(repo)/issues/\(number)/comments",
            queryItems: [],
            body: body,
            credentials: credentials
        )
        var result = baseResult(request: request, credentials: credentials)
        result["commentId"] = parsed.objectValue?["id"] ?? .null
        result["htmlUrl"] = parsed.objectValue?["html_url"] ?? .null
        result["payloadHash"] = .string(MarketplaceProviderActionApprovalService.payloadHash(normalized))
        result["auditId"] = .string(request.auditIdentity.dispatchId ?? request.idempotencyKey)
        result["redactionStatus"] = .string("private-state-excluded")
        return GitHubProviderActionClientResult(result: result)
    }

    private func credentials(for request: MarketplaceProviderActionAdapterRequest) throws -> Credentials {
        guard let connectionId = request.auditIdentity.connectionId?.githubTrimmedNonEmpty,
              let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: connectionId),
              connection.appId == request.app.id,
              connection.appSlug == request.app.slug else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "github_connection_missing",
                message: "GitHub execution requires a Relay Marketplace provider connection."
            )
        }
        guard connection.status == .connected || connection.status == .healthError else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "github_connection_not_ready",
                message: "The GitHub provider connection is not ready.",
                detail: ["connectionStatus": .string(connection.status.rawValue)]
            )
        }
        return Credentials(
            accessToken: try secret(fieldKey: "github_oauth_access_token", connection: connection),
            login: connection.health.diagnostics["login"]?.string?.githubTrimmedNonEmpty,
            organization: connection.health.diagnostics["organization"]?.string?.githubTrimmedNonEmpty
        )
    }

    private func secret(fieldKey: String, connection: MarketplaceProviderConnection) throws -> String {
        guard let secretId = connection.credentialRequirements.first(where: { $0.fieldKey == fieldKey })?.secretReferenceId?.githubTrimmedNonEmpty else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "github_credentials_missing",
                message: "The GitHub provider connection is missing a required Keychain secret reference.",
                detail: ["fieldKey": .string(fieldKey)]
            )
        }
        do {
            return try secrets.getSecretValue(secretId)
        } catch {
            throw MarketplaceProviderActionAdapterFailure(
                code: "github_credentials_unavailable",
                message: "Relay could not read the saved GitHub token from the OS secret store. Reconnect GitHub in Marketplace.",
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
        var components = URLComponents(string: "https://api.github.com\(path)")
        components?.queryItems = queryItems.isEmpty ? nil : queryItems
        guard let url = components?.url else {
            throw MarketplaceProviderActionAdapterFailure(code: "github_invalid_url", message: "Could not build the GitHub API URL.")
        }
        return try parseGitHubResponse(httpClient.send(GitHubProviderHTTPRequest(
            method: method,
            url: url,
            headers: [
                "Authorization": "Bearer \(credentials.accessToken)",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
                "Content-Type": "application/json; charset=utf-8",
                "User-Agent": "RelayConsole"
            ],
            body: body
        )))
    }

    private func parseGitHubResponse(_ response: GitHubProviderHTTPResponse) throws -> JSONValue {
        guard (200..<300).contains(response.statusCode) else {
            let message = (try? JSONSerialization.jsonObject(with: response.body))
                .map(GitHubProviderActionAdapterSupport.jsonValue(from:))?
                .objectValue?["message"]?.string
            throw MarketplaceProviderActionAdapterFailure(
                code: "github_http_error",
                message: message ?? "GitHub API returned an HTTP error.",
                providerStatusCode: response.statusCode
            )
        }
        guard !response.body.isEmpty else {
            return .object([:])
        }
        let json = try JSONSerialization.jsonObject(with: response.body)
        return GitHubProviderActionAdapterSupport.jsonValue(from: json)
    }

    private func baseResult(request: MarketplaceProviderActionAdapterRequest, credentials: Credentials) -> JSONRecord {
        [
            "adapterBoundary": .string("github-provider-action-adapter"),
            "clientMode": .string("live-github-rest-api"),
            "provider": .string("github"),
            "login": credentials.login.map(JSONValue.string) ?? .null,
            "organization": credentials.organization.map(JSONValue.string) ?? .null,
            "permission": .string(request.permission.rawValue),
            "payloadHash": .string(MarketplaceProviderActionApprovalService.payloadHash(request.payload)),
            "approved": .bool(request.approvalReference?.status == .approved),
            "idempotencyKey": .string(request.idempotencyKey),
            "liveCredentialsUsed": .bool(true),
            "rawProviderToolExposure": .bool(false),
            "redactionStatus": .string("private-state-excluded")
        ]
    }

    private func repositorySummary(_ value: JSONValue) -> JSONRecord {
        let object = value.objectValue ?? [:]
        return [
            "fullName": object["full_name"] ?? .null,
            "description": .string((object["description"]?.string ?? "").prefixString(500)),
            "visibility": object["visibility"] ?? .null,
            "htmlUrl": object["html_url"] ?? .null,
            "defaultBranch": object["default_branch"] ?? .null,
            "updatedAt": object["updated_at"] ?? .null,
            "redactionStatus": .string("private-state-excluded")
        ]
    }

    private func issueSummary(_ value: JSONValue) -> JSONRecord {
        let object = value.objectValue ?? [:]
        let user = object["user"]?.objectValue
        return [
            "number": object["number"] ?? .null,
            "title": object["title"] ?? .null,
            "state": object["state"] ?? .null,
            "author": user?["login"] ?? .null,
            "htmlUrl": object["html_url"] ?? .null,
            "updatedAt": object["updated_at"] ?? .null,
            "bodyExcerpt": .string((object["body"]?.string ?? "").prefixString(800)),
            "truncated": .bool((object["body"]?.string ?? "").count > 800),
            "redactionStatus": .string("private-state-excluded")
        ]
    }
}

public struct GitHubProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowlistedActionKeys: Set<String> = [
        "github_repo_search",
        "github_issue_list",
        "github_pull_request_list",
        "github_issue_comment_prepare",
        "github_issue_comment_create",
        "github_pull_request_comment_create"
    ]

    private let client: any GitHubProviderActionClient

    public init(client: any GitHubProviderActionClient = FakeGitHubProviderActionClient()) {
        self.client = client
    }

    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "github" else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "github_adapter_wrong_provider",
                message: "GitHub adapter can only execute GitHub provider actions.",
                detail: ["appSlug": .string(request.app.slug)]
            )
        }
        guard Self.allowlistedActionKeys.contains(request.definition.actionKey) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "github_action_not_allowlisted",
                message: "The requested GitHub action is not in the V1 adapter allowlist.",
                detail: ["actionKey": .string(request.definition.actionKey)]
            )
        }
        let output = try client.executeGitHubAction(request: request)
        return MarketplaceProviderActionAdapterResult(result: output.result, error: nil, redactionStatus: output.redactionStatus)
    }
}

public enum GitHubProviderActionAdapterSupport {
    public static func requiredPayloadString(request: MarketplaceProviderActionAdapterRequest, key: String, label: String) throws -> String {
        guard let value = request.payload[key]?.string?.githubTrimmedNonEmpty else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "github_missing_required_field",
                message: "GitHub \(label) is required.",
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
        guard let owner = payload["owner"]?.string?.githubTrimmedNonEmpty else {
            throw MarketplaceProviderActionAdapterFailure(code: "github_missing_required_field", message: "GitHub repository owner is required.", detail: ["field": .string("owner")])
        }
        guard let repo = payload["repo"]?.string?.githubTrimmedNonEmpty else {
            throw MarketplaceProviderActionAdapterFailure(code: "github_missing_required_field", message: "GitHub repository name is required.", detail: ["field": .string("repo")])
        }
        let rawNumber = payload[numberKey]?.string?.githubTrimmedNonEmpty
            ?? payload[numberKey]?.number.map { String(Int($0)) }
        guard let number = rawNumber else {
            throw MarketplaceProviderActionAdapterFailure(code: "github_missing_required_field", message: "GitHub issue or pull request number is required.", detail: ["field": .string(numberKey)])
        }
        guard let body = payload["body"]?.string?.githubTrimmedNonEmpty else {
            throw MarketplaceProviderActionAdapterFailure(code: "github_missing_required_field", message: "GitHub comment body is required.", detail: ["field": .string("body")])
        }
        guard body.count <= 8000 else {
            throw MarketplaceProviderActionAdapterFailure(code: "github_comment_too_long", message: "GitHub comment body is limited to 8000 characters in Relay V1.")
        }
        return [
            "owner": .string(owner),
            "repo": .string(repo),
            "number": .string(number),
            "body": .string(body)
        ]
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
    var githubTrimmedNonEmpty: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    var githubSlug: String {
        lowercased()
            .map { $0.isLetter || $0.isNumber ? String($0) : "-" }
            .joined()
            .trimmingCharacters(in: CharacterSet(charactersIn: "-"))
    }

    func prefixString(_ maxLength: Int) -> String {
        String(prefix(maxLength))
    }
}
