import Foundation

public struct BitbucketProviderActionClientResult: Codable, Equatable, Sendable {
    public var result: JSONRecord
    public var redactionStatus: String

    public init(result: JSONRecord, redactionStatus: String = "private-state-excluded") {
        self.result = result
        self.redactionStatus = redactionStatus
    }
}

public protocol BitbucketProviderActionClient: Sendable {
    func executeBitbucketAction(request: MarketplaceProviderActionAdapterRequest) throws -> BitbucketProviderActionClientResult
}

public struct BitbucketProviderHTTPRequest: Sendable, Equatable {
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

public struct BitbucketProviderHTTPResponse: Sendable, Equatable {
    public var statusCode: Int
    public var body: Data

    public init(statusCode: Int, body: Data = Data()) {
        self.statusCode = statusCode
        self.body = body
    }
}

public protocol BitbucketProviderHTTPClient: Sendable {
    func send(_ request: BitbucketProviderHTTPRequest) throws -> BitbucketProviderHTTPResponse
}

public struct URLSessionBitbucketProviderHTTPClient: BitbucketProviderHTTPClient {
    private let timeoutSeconds: TimeInterval

    public init(timeoutSeconds: TimeInterval = 20) {
        self.timeoutSeconds = timeoutSeconds
    }

    public func send(_ request: BitbucketProviderHTTPRequest) throws -> BitbucketProviderHTTPResponse {
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
                code: "bitbucket_http_timeout",
                message: "Bitbucket API request timed out.",
                detail: ["urlHost": .string(request.url.host ?? "bitbucket.org")]
            )
        }
        if let responseError {
            throw responseError
        }
        return BitbucketProviderHTTPResponse(statusCode: responseStatusCode ?? 0, body: responseData ?? Data())
    }
}

public struct FakeBitbucketProviderActionClient: BitbucketProviderActionClient {
    public init() {}

    public func executeBitbucketAction(request: MarketplaceProviderActionAdapterRequest) throws -> BitbucketProviderActionClientResult {
        switch request.definition.actionKey {
        case "bitbucket_repository_search":
            return try repositorySearch(request: request)
        case "bitbucket_issue_list":
            return try issueList(request: request)
        case "bitbucket_pull_request_list":
            return try pullRequestList(request: request)
        case "bitbucket_pull_request_comment_prepare":
            return try commentPrepare(request: request, numberKey: "pullRequestId")
        case "bitbucket_pull_request_comment_create":
            return try issueCommentCreate(request: request, issueKey: "pullRequestId")
        case "bitbucket_issue_comment_create":
            return try issueCommentCreate(request: request, issueKey: "issueId")
        default:
            throw MarketplaceProviderActionAdapterFailure(
                code: "bitbucket_fake_action_not_supported",
                message: "The fake Bitbucket client does not support this action.",
                detail: ["actionKey": .string(request.definition.actionKey)]
            )
        }
    }

    private func repositorySearch(request: MarketplaceProviderActionAdapterRequest) throws -> BitbucketProviderActionClientResult {
        let query = try BitbucketProviderActionAdapterSupport.requiredPayloadString(request: request, key: "query", label: "repository search query")
        let limit = BitbucketProviderActionAdapterSupport.boundedInt(request.payload["maxResults"], defaultValue: 5, minValue: 1, maxValue: 25)
        return BitbucketProviderActionClientResult(result: baseResult(request: request).merging([
            "semanticReadContract": .string("bitbucket-repository-search-v1"),
            "query": .string(query),
            "repositories": .array((0..<limit).map { index in
                .object([
                    "fullName": .string("relay-demo/\(query.bitbucketSlug)-\(index + 1)"),
                    "description": .string("Bounded Bitbucket repository result \(index + 1) for \(query)."),
                    "visibility": .string("private-state-excluded"),
                    "webUrl": .string("https://bitbucket.org/relay-demo/\(query.bitbucketSlug)-\(index + 1)"),
                    "updatedAt": .string("2026-07-09T00:00:00Z"),
                    "redactionStatus": .string("private-state-excluded")
                ])
            })
        ]) { _, new in new })
    }

    private func issueList(request: MarketplaceProviderActionAdapterRequest) throws -> BitbucketProviderActionClientResult {
        let repositoryPath = try BitbucketProviderActionAdapterSupport.requiredPayloadString(request: request, key: "repositoryPath", label: "repository path")
        let limit = BitbucketProviderActionAdapterSupport.boundedInt(request.payload["maxResults"], defaultValue: 10, minValue: 1, maxValue: 50)
        return BitbucketProviderActionClientResult(result: baseResult(request: request).merging([
            "semanticReadContract": .string("bitbucket-issue-list-v1"),
            "repositoryPath": .string(repositoryPath),
            "issues": .array((0..<limit).map { index in
                .object([
                    "id": .number(Double(index + 1)),
                    "title": .string("Bounded Bitbucket issue \(index + 1)"),
                    "state": .string("opened"),
                    "author": .string("relay-user-\(index + 1)"),
                    "webUrl": .string("https://bitbucket.org/\(repositoryPath)/issues/\(index + 1)"),
                    "bodyExcerpt": .string("Demo issue body excerpt."),
                    "redactionStatus": .string("private-state-excluded")
                ])
            })
        ]) { _, new in new })
    }

    private func pullRequestList(request: MarketplaceProviderActionAdapterRequest) throws -> BitbucketProviderActionClientResult {
        let repositoryPath = try BitbucketProviderActionAdapterSupport.requiredPayloadString(request: request, key: "repositoryPath", label: "repository path")
        let limit = BitbucketProviderActionAdapterSupport.boundedInt(request.payload["maxResults"], defaultValue: 10, minValue: 1, maxValue: 50)
        return BitbucketProviderActionClientResult(result: baseResult(request: request).merging([
            "semanticReadContract": .string("bitbucket-pull-request-list-v1"),
            "repositoryPath": .string(repositoryPath),
            "pullRequests": .array((0..<limit).map { index in
                .object([
                    "id": .number(Double(index + 1)),
                    "title": .string("Bounded Bitbucket pull request \(index + 1)"),
                    "state": .string("opened"),
                    "author": .string("relay-user-\(index + 1)"),
                    "webUrl": .string("https://bitbucket.org/\(repositoryPath)/pull-requests/\(index + 1)"),
                    "bodyExcerpt": .string("Demo pull request body excerpt."),
                    "redactionStatus": .string("private-state-excluded")
                ])
            })
        ]) { _, new in new })
    }

    private func commentPrepare(request: MarketplaceProviderActionAdapterRequest, numberKey: String) throws -> BitbucketProviderActionClientResult {
        let normalized = try BitbucketProviderActionAdapterSupport.normalizedCommentPayload(request.payload, numberKey: numberKey)
        return BitbucketProviderActionClientResult(result: baseResult(request: request).merging([
            "draftPreview": .object([
                "repositoryPath": normalized["repositoryPath"] ?? .null,
                "id": normalized["id"] ?? .null,
                "bodyPreview": normalized["body"] ?? .string(""),
                "payloadHash": .string(MarketplaceProviderActionApprovalService.payloadHash(normalized)),
                "providerMutation": .bool(false),
                "redactionStatus": .string("private-state-excluded")
            ])
        ]) { _, new in new })
    }

    private func issueCommentCreate(request: MarketplaceProviderActionAdapterRequest, issueKey: String) throws -> BitbucketProviderActionClientResult {
        let normalized = try BitbucketProviderActionAdapterSupport.normalizedCommentPayload(request.payload, numberKey: issueKey)
        let suffix = BitbucketProviderActionAdapterSupport.stableSuffix(MarketplaceProviderActionApprovalService.payloadHash(normalized))
        return BitbucketProviderActionClientResult(result: baseResult(request: request).merging([
            "commentId": .string("bbc_\(suffix)"),
            "webUrl": .string("https://bitbucket.org/\(normalized["repositoryPath"]?.string ?? "repository")/issues/\(normalized["id"]?.string ?? "0")#comment-\(suffix)"),
            "payloadHash": .string(MarketplaceProviderActionApprovalService.payloadHash(normalized)),
            "auditId": .string(request.auditIdentity.dispatchId ?? request.idempotencyKey),
            "redactionStatus": .string("private-state-excluded")
        ]) { _, new in new })
    }

    private func baseResult(request: MarketplaceProviderActionAdapterRequest) -> JSONRecord {
        [
            "fakeAdapter": .bool(true),
            "adapterBoundary": .string("bitbucket-provider-action-adapter"),
            "clientMode": .string("fake-bitbucket-client"),
            "provider": .string("bitbucket"),
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

public final class LiveBitbucketProviderActionClient: BitbucketProviderActionClient, @unchecked Sendable {
    fileprivate struct Credentials {
        var accessToken: String
        var login: String?
        var organization: String?
    }

    private let data: LocalDataService
    private let secrets: SecretService
    private let httpClient: any BitbucketProviderHTTPClient

    public init(
        data: LocalDataService,
        secrets: SecretService,
        httpClient: any BitbucketProviderHTTPClient = URLSessionBitbucketProviderHTTPClient()
    ) {
        self.data = data
        self.secrets = secrets
        self.httpClient = httpClient
    }

    public func executeBitbucketAction(request: MarketplaceProviderActionAdapterRequest) throws -> BitbucketProviderActionClientResult {
        switch request.definition.actionKey {
        case "bitbucket_repository_search":
            return try repositorySearch(request: request)
        case "bitbucket_issue_list":
            return try issueList(request: request)
        case "bitbucket_pull_request_list":
            return try pullRequestList(request: request)
        case "bitbucket_pull_request_comment_prepare":
            return try FakeBitbucketProviderActionClient().executeBitbucketAction(request: request)
        case "bitbucket_pull_request_comment_create":
            return try commentCreate(request: request, numberKey: "pullRequestId")
        case "bitbucket_issue_comment_create":
            return try commentCreate(request: request, numberKey: "issueId")
        default:
            throw MarketplaceProviderActionAdapterFailure(
                code: "bitbucket_live_action_not_implemented",
                message: "Live Bitbucket provider execution does not support this action.",
                detail: ["actionKey": .string(request.definition.actionKey)]
            )
        }
    }

    private func repositorySearch(request: MarketplaceProviderActionAdapterRequest) throws -> BitbucketProviderActionClientResult {
        let credentials = try credentials(for: request)
        let query = try BitbucketProviderActionAdapterSupport.requiredPayloadString(request: request, key: "query", label: "repository search query")
        let limit = BitbucketProviderActionAdapterSupport.boundedInt(request.payload["maxResults"], defaultValue: 5, minValue: 1, maxValue: 25)
        let parsed = try send(
            method: "GET",
            path: "/user/permissions/repositories",
            queryItems: [
                URLQueryItem(name: "q", value: "repository.name ~ \"\(query)\""),
                URLQueryItem(name: "sort", value: "-repository.updated_on"),
                URLQueryItem(name: "pagelen", value: "\(limit)")
            ],
            credentials: credentials
        )
        let items = parsed.arrayValue ?? parsed.objectValue?["values"]?.arrayValue ?? []
        return BitbucketProviderActionClientResult(result: baseResult(request: request, credentials: credentials).merging([
            "semanticReadContract": .string("bitbucket-repository-search-v1"),
            "query": .string(query),
            "repositories": .array(items.prefix(limit).map {
                .object(repositorySummary($0.objectValue?["repository"] ?? $0))
            })
        ]) { _, new in new })
    }

    private func issueList(request: MarketplaceProviderActionAdapterRequest) throws -> BitbucketProviderActionClientResult {
        let credentials = try credentials(for: request)
        let repositoryPath = try BitbucketProviderActionAdapterSupport.requiredPayloadString(request: request, key: "repositoryPath", label: "repository path")
        let limit = BitbucketProviderActionAdapterSupport.boundedInt(request.payload["maxResults"], defaultValue: 10, minValue: 1, maxValue: 50)
        let state = request.payload["state"]?.string?.bitbucketTrimmedNonEmpty ?? "open"
        let parsed = try send(
            method: "GET",
            path: "/repositories/\(BitbucketProviderActionAdapterSupport.urlPathComponent(repositoryPath))/issues",
            queryItems: [
                URLQueryItem(name: "q", value: "state = \"\(state)\""),
                URLQueryItem(name: "sort", value: "-updated_on"),
                URLQueryItem(name: "pagelen", value: "\(limit)")
            ],
            credentials: credentials
        )
        let issues = parsed.arrayValue ?? parsed.objectValue?["values"]?.arrayValue ?? []
        return BitbucketProviderActionClientResult(result: baseResult(request: request, credentials: credentials).merging([
            "semanticReadContract": .string("bitbucket-issue-list-v1"),
            "repositoryPath": .string(repositoryPath),
            "issues": .array(issues.prefix(limit).map { .object(issueSummary($0)) })
        ]) { _, new in new })
    }

    private func pullRequestList(request: MarketplaceProviderActionAdapterRequest) throws -> BitbucketProviderActionClientResult {
        let credentials = try credentials(for: request)
        let repositoryPath = try BitbucketProviderActionAdapterSupport.requiredPayloadString(request: request, key: "repositoryPath", label: "repository path")
        let limit = BitbucketProviderActionAdapterSupport.boundedInt(request.payload["maxResults"], defaultValue: 10, minValue: 1, maxValue: 50)
        let state = request.payload["state"]?.string?.bitbucketTrimmedNonEmpty ?? "OPEN"
        let parsed = try send(
            method: "GET",
            path: "/repositories/\(BitbucketProviderActionAdapterSupport.urlPathComponent(repositoryPath))/pullrequests",
            queryItems: [
                URLQueryItem(name: "state", value: state),
                URLQueryItem(name: "pagelen", value: "\(limit)")
            ],
            credentials: credentials
        )
        let pullRequests = parsed.arrayValue ?? parsed.objectValue?["values"]?.arrayValue ?? []
        return BitbucketProviderActionClientResult(result: baseResult(request: request, credentials: credentials).merging([
            "semanticReadContract": .string("bitbucket-pull-request-list-v1"),
            "repositoryPath": .string(repositoryPath),
            "pullRequests": .array(pullRequests.prefix(limit).map { .object(issueSummary($0)) })
        ]) { _, new in new })
    }

    private func commentCreate(request: MarketplaceProviderActionAdapterRequest, numberKey: String) throws -> BitbucketProviderActionClientResult {
        let credentials = try credentials(for: request)
        let normalized = try BitbucketProviderActionAdapterSupport.normalizedCommentPayload(request.payload, numberKey: numberKey)
        let repositoryPath = normalized["repositoryPath"]?.string ?? ""
        let id = normalized["id"]?.string ?? ""
        let collectionPath = numberKey == "pullRequestId" ? "pullrequests" : "issues"
        let body = try JSONSerialization.data(withJSONObject: ["content": ["raw": normalized["body"]?.string ?? ""]])
        let parsed = try send(
            method: "POST",
            path: "/repositories/\(BitbucketProviderActionAdapterSupport.urlPathComponent(repositoryPath))/\(collectionPath)/\(id)/comments",
            queryItems: [],
            body: body,
            credentials: credentials
        )
        var result = baseResult(request: request, credentials: credentials)
        result["commentId"] = parsed.objectValue?["id"] ?? .null
        result["webUrl"] = parsed.objectValue?["links"]?.objectValue?["html"]?.objectValue?["href"] ?? .null
        result["payloadHash"] = .string(MarketplaceProviderActionApprovalService.payloadHash(normalized))
        result["auditId"] = .string(request.auditIdentity.dispatchId ?? request.idempotencyKey)
        result["redactionStatus"] = .string("private-state-excluded")
        return BitbucketProviderActionClientResult(result: result)
    }

    private func credentials(for request: MarketplaceProviderActionAdapterRequest) throws -> Credentials {
        guard let connectionId = request.auditIdentity.connectionId?.bitbucketTrimmedNonEmpty,
              let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: connectionId),
              connection.appId == request.app.id,
              connection.appSlug == request.app.slug else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "bitbucket_connection_missing",
                message: "Bitbucket execution requires a Relay Marketplace provider connection."
            )
        }
        guard connection.status == .connected || connection.status == .healthError else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "bitbucket_connection_not_ready",
                message: "The Bitbucket provider connection is not ready.",
                detail: ["connectionStatus": .string(connection.status.rawValue)]
            )
        }
        return Credentials(
            accessToken: try secret(fieldKey: "bitbucket_oauth_access_token", connection: connection),
            login: connection.health.diagnostics["username"]?.string?.bitbucketTrimmedNonEmpty,
            organization: connection.health.diagnostics["workspace"]?.string?.bitbucketTrimmedNonEmpty
        )
    }

    private func secret(fieldKey: String, connection: MarketplaceProviderConnection) throws -> String {
        guard let secretId = connection.credentialRequirements.first(where: { $0.fieldKey == fieldKey })?.secretReferenceId?.bitbucketTrimmedNonEmpty else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "bitbucket_credentials_missing",
                message: "The Bitbucket provider connection is missing a required Keychain secret reference.",
                detail: ["fieldKey": .string(fieldKey)]
            )
        }
        do {
            return try secrets.getSecretValue(secretId)
        } catch {
            throw MarketplaceProviderActionAdapterFailure(
                code: "bitbucket_credentials_unavailable",
                message: "Relay could not read the saved Bitbucket token from the OS secret store. Reconnect Bitbucket in Marketplace.",
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
        var components = URLComponents(string: "https://api.bitbucket.org/2.0\(path)")
        components?.queryItems = queryItems.isEmpty ? nil : queryItems
        guard let url = components?.url else {
            throw MarketplaceProviderActionAdapterFailure(code: "bitbucket_invalid_url", message: "Could not build the Bitbucket API URL.")
        }
        return try parseBitbucketResponse(httpClient.send(BitbucketProviderHTTPRequest(
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

    private func parseBitbucketResponse(_ response: BitbucketProviderHTTPResponse) throws -> JSONValue {
        guard (200..<300).contains(response.statusCode) else {
            let message = (try? JSONSerialization.jsonObject(with: response.body))
                .map(BitbucketProviderActionAdapterSupport.jsonValue(from:))?
                .objectValue?["message"]?.string
            throw MarketplaceProviderActionAdapterFailure(
                code: "bitbucket_http_error",
                message: message ?? "Bitbucket API returned an HTTP error.",
                providerStatusCode: response.statusCode
            )
        }
        guard !response.body.isEmpty else {
            return .object([:])
        }
        let json = try JSONSerialization.jsonObject(with: response.body)
        return BitbucketProviderActionAdapterSupport.jsonValue(from: json)
    }

    private func baseResult(request: MarketplaceProviderActionAdapterRequest, credentials: Credentials) -> JSONRecord {
        [
            "adapterBoundary": .string("bitbucket-provider-action-adapter"),
            "clientMode": .string("live-bitbucket-rest-api"),
            "provider": .string("bitbucket"),
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

    private func repositorySummary(_ value: JSONValue) -> JSONRecord {
        let object = value.objectValue ?? [:]
        let links = object["links"]?.objectValue ?? [:]
        return [
            "fullName": object["full_name"] ?? .null,
            "description": .string((object["description"]?.string ?? "").prefixString(500)),
            "visibility": .string(object["is_private"]?.bool == true ? "private" : "public"),
            "webUrl": links["html"]?.objectValue?["href"] ?? .null,
            "defaultBranch": object["mainbranch"]?.objectValue?["name"] ?? .null,
            "updatedAt": object["updated_on"] ?? .null,
            "redactionStatus": .string("private-state-excluded")
        ]
    }

    private func issueSummary(_ value: JSONValue) -> JSONRecord {
        let object = value.objectValue ?? [:]
        let user = object["author"]?.objectValue ?? object["reporter"]?.objectValue
        let body = object["content"]?.objectValue?["raw"]?.string ?? ""
        let links = object["links"]?.objectValue ?? [:]
        return [
            "id": object["id"] ?? .null,
            "title": object["title"] ?? .null,
            "state": object["state"] ?? .null,
            "author": user?["display_name"] ?? user?["nickname"] ?? .null,
            "webUrl": links["html"]?.objectValue?["href"] ?? .null,
            "updatedAt": object["updated_on"] ?? .null,
            "bodyExcerpt": .string(body.prefixString(800)),
            "truncated": .bool(body.count > 800),
            "redactionStatus": .string("private-state-excluded")
        ]
    }
}

public struct BitbucketProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowlistedActionKeys: Set<String> = [
        "bitbucket_repository_search",
        "bitbucket_issue_list",
        "bitbucket_pull_request_list",
        "bitbucket_pull_request_comment_prepare",
        "bitbucket_pull_request_comment_create",
        "bitbucket_issue_comment_create"
    ]

    private let client: any BitbucketProviderActionClient

    public init(client: any BitbucketProviderActionClient = FakeBitbucketProviderActionClient()) {
        self.client = client
    }

    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "bitbucket" else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "bitbucket_adapter_wrong_provider",
                message: "Bitbucket adapter can only execute Bitbucket provider actions.",
                detail: ["appSlug": .string(request.app.slug)]
            )
        }
        guard Self.allowlistedActionKeys.contains(request.definition.actionKey) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "bitbucket_action_not_allowlisted",
                message: "The requested Bitbucket action is not in the V1 adapter allowlist.",
                detail: ["actionKey": .string(request.definition.actionKey)]
            )
        }
        let output = try client.executeBitbucketAction(request: request)
        return MarketplaceProviderActionAdapterResult(result: output.result, error: nil, redactionStatus: output.redactionStatus)
    }
}

public enum BitbucketProviderActionAdapterSupport {
    public static func requiredPayloadString(request: MarketplaceProviderActionAdapterRequest, key: String, label: String) throws -> String {
        guard let value = request.payload[key]?.string?.bitbucketTrimmedNonEmpty else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "bitbucket_missing_required_field",
                message: "Bitbucket \(label) is required.",
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
        guard let repositoryPath = payload["repositoryPath"]?.string?.bitbucketTrimmedNonEmpty else {
            throw MarketplaceProviderActionAdapterFailure(code: "bitbucket_missing_required_field", message: "Bitbucket repository path is required.", detail: ["field": .string("repositoryPath")])
        }
        let rawNumber = payload[numberKey]?.string?.bitbucketTrimmedNonEmpty
            ?? payload[numberKey]?.number.map { String(Int($0)) }
        guard let number = rawNumber else {
            throw MarketplaceProviderActionAdapterFailure(code: "bitbucket_missing_required_field", message: "Bitbucket issue or pull request id is required.", detail: ["field": .string(numberKey)])
        }
        guard let body = payload["body"]?.string?.bitbucketTrimmedNonEmpty else {
            throw MarketplaceProviderActionAdapterFailure(code: "bitbucket_missing_required_field", message: "Bitbucket comment body is required.", detail: ["field": .string("body")])
        }
        guard body.count <= 8000 else {
            throw MarketplaceProviderActionAdapterFailure(code: "bitbucket_comment_too_long", message: "Bitbucket comment body is limited to 8000 characters in Relay V1.")
        }
        return [
            "repositoryPath": .string(repositoryPath),
            "id": .string(number),
            "body": .string(body)
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
    var bitbucketTrimmedNonEmpty: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    var bitbucketSlug: String {
        lowercased()
            .map { $0.isLetter || $0.isNumber ? String($0) : "-" }
            .joined()
            .trimmingCharacters(in: CharacterSet(charactersIn: "-"))
    }

    func prefixString(_ maxLength: Int) -> String {
        String(prefix(maxLength))
    }
}
