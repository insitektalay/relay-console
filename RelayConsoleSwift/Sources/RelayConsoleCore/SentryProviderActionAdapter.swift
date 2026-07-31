import Foundation

public struct SentryProviderActionClientResult: Codable, Equatable, Sendable {
    public var result: JSONRecord
    public var redactionStatus: String

    public init(result: JSONRecord, redactionStatus: String = "private-state-excluded") {
        self.result = result
        self.redactionStatus = redactionStatus
    }
}

public protocol SentryProviderActionClient: Sendable {
    func executeSentryAction(request: MarketplaceProviderActionAdapterRequest) throws -> SentryProviderActionClientResult
}

public struct SentryProviderHTTPRequest: Sendable, Equatable {
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

public struct SentryProviderHTTPResponse: Sendable, Equatable {
    public var statusCode: Int
    public var body: Data

    public init(statusCode: Int, body: Data = Data()) {
        self.statusCode = statusCode
        self.body = body
    }
}

public protocol SentryProviderHTTPClient: Sendable {
    func send(_ request: SentryProviderHTTPRequest) throws -> SentryProviderHTTPResponse
}

public struct URLSessionSentryProviderHTTPClient: SentryProviderHTTPClient {
    private let timeoutSeconds: TimeInterval

    public init(timeoutSeconds: TimeInterval = 20) {
        self.timeoutSeconds = timeoutSeconds
    }

    public func send(_ request: SentryProviderHTTPRequest) throws -> SentryProviderHTTPResponse {
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
                code: "sentry_http_timeout",
                message: "Sentry API request timed out.",
                detail: ["urlHost": .string(request.url.host ?? "sentry.io")]
            )
        }
        if let responseError {
            throw responseError
        }
        return SentryProviderHTTPResponse(statusCode: responseStatusCode ?? 0, body: responseData ?? Data())
    }
}

public struct FakeSentryProviderActionClient: SentryProviderActionClient {
    private let failureByActionKey: [String: MarketplaceProviderActionAdapterFailure]

    public init(failureByActionKey: [String: MarketplaceProviderActionAdapterFailure] = [:]) {
        self.failureByActionKey = failureByActionKey
    }

    public func executeSentryAction(request: MarketplaceProviderActionAdapterRequest) throws -> SentryProviderActionClientResult {
        if let failure = failureByActionKey[request.definition.actionKey] {
            throw failure
        }
        switch request.definition.actionKey {
        case "sentry_list_projects":
            return listProjects(request: request)
        case "sentry_search_issues":
            return searchIssues(request: request)
        case "sentry_get_issue":
            return try getIssue(request: request)
        case "sentry_get_event":
            return try getEvent(request: request)
        case "sentry_prepare_issue_update":
            return try prepareIssueUpdate(request: request)
        case "sentry_update_issue":
            return try updateIssue(request: request)
        default:
            throw MarketplaceProviderActionAdapterFailure(
                code: "sentry_fake_action_not_supported",
                message: "The fake Sentry client does not support this action.",
                detail: ["actionKey": .string(request.definition.actionKey)]
            )
        }
    }

    private func listProjects(request: MarketplaceProviderActionAdapterRequest) -> SentryProviderActionClientResult {
        let orgSlug = request.payload["organizationSlug"]?.string?.trimmedNonEmpty ?? "relay-org"
        let projectSlug = request.payload["projectSlug"]?.string?.trimmedNonEmpty ?? "web-app"
        return SentryProviderActionClientResult(result: baseResult(request: request).merging([
            "semanticReadContract": .string("sentry-project-list-v1"),
            "organizationSlug": .string(orgSlug),
            "projects": .array([
                .object([
                    "id": .string("sentry-project-\(Self.stableSuffix(projectSlug))"),
                    "slug": .string(projectSlug),
                    "name": .string("Relay Web App"),
                    "platform": .string("javascript"),
                    "status": .string("active"),
                    "organizationSlug": .string(orgSlug),
                    "permalink": .string("https://sentry.io/organizations/\(orgSlug)/projects/\(projectSlug)/"),
                    "redactionStatus": .string("private-state-excluded")
                ])
            ]),
            "nextCursor": .null
        ]) { _, new in new })
    }

    private func searchIssues(request: MarketplaceProviderActionAdapterRequest) -> SentryProviderActionClientResult {
        let orgSlug = request.payload["organizationSlug"]?.string?.trimmedNonEmpty ?? "relay-org"
        let projectSlug = request.payload["projectSlug"]?.string?.trimmedNonEmpty ?? "web-app"
        let issueId = "SENTRY-\(Self.stableSuffix(request.idempotencyKey).uppercased())"
        return SentryProviderActionClientResult(result: baseResult(request: request).merging([
            "semanticReadContract": .string("sentry-issue-search-v1"),
            "organizationSlug": .string(orgSlug),
            "issues": .array([
                .object([
                    "id": .string(issueId),
                    "shortId": .string(issueId),
                    "title": .string("TypeError: Cannot read properties of undefined"),
                    "culprit": .string("CheckoutView.render"),
                    "permalink": .string("https://sentry.io/organizations/\(orgSlug)/issues/\(issueId)/"),
                    "projectSlug": .string(projectSlug),
                    "status": .string("unresolved"),
                    "priority": .string("high"),
                    "level": .string("error"),
                    "count": .number(42),
                    "userCount": .number(7),
                    "firstSeen": .string("2026-01-01T00:00:00Z"),
                    "lastSeen": .string("2026-01-01T00:15:00Z"),
                    "stats": .object(["24h": .number(42)]),
                    "redactionStatus": .string("private-state-excluded")
                ])
            ]),
            "nextCursor": .null
        ]) { _, new in new })
    }

    private func getIssue(request: MarketplaceProviderActionAdapterRequest) throws -> SentryProviderActionClientResult {
        let issueId = try SentryProviderActionAdapterSupport.requiredPayloadString(request: request, key: "issueId", label: "issue ID")
        return SentryProviderActionClientResult(result: baseResult(request: request).merging([
            "semanticReadContract": .string("sentry-issue-detail-v1"),
            "issue": .object([
                "id": .string(issueId),
                "title": .string("TypeError: Cannot read properties of undefined"),
                "permalink": .string("https://sentry.io/organizations/relay-org/issues/\(issueId)/"),
                "status": .string("unresolved"),
                "substatus": .string("ongoing"),
                "projectSlug": .string("web-app"),
                "platform": .string("javascript"),
                "culprit": .string("CheckoutView.render"),
                "firstSeen": .string("2026-01-01T00:00:00Z"),
                "lastSeen": .string("2026-01-01T00:15:00Z"),
                "count": .number(42),
                "userCount": .number(7),
                "latestEvent": .object([
                    "id": .string("event-\(Self.stableSuffix(issueId))"),
                    "title": .string("TypeError: Cannot read properties of undefined"),
                    "message": .string("Cannot read properties of undefined (reading 'total')")
                ]),
                "redactionStatus": .string("private-state-excluded")
            ])
        ]) { _, new in new })
    }

    private func getEvent(request: MarketplaceProviderActionAdapterRequest) throws -> SentryProviderActionClientResult {
        let eventId = try SentryProviderActionAdapterSupport.requiredPayloadString(request: request, key: "eventId", label: "event ID")
        return SentryProviderActionClientResult(result: baseResult(request: request).merging([
            "semanticReadContract": .string("sentry-event-detail-v1"),
            "event": .object([
                "id": .string(eventId),
                "issueId": request.payload["issueId"] ?? .string("SENTRY-FAKE"),
                "projectSlug": .string(request.payload["projectSlug"]?.string?.trimmedNonEmpty ?? "web-app"),
                "title": .string("TypeError: Cannot read properties of undefined"),
                "message": .string("Cannot read properties of undefined (reading 'total')"),
                "platform": .string("javascript"),
                "timestamp": .string("2026-01-01T00:15:00Z"),
                "level": .string("error"),
                "environment": .string("production"),
                "release": .string("web@1.2.3"),
                "tags": .array([.object(["key": .string("browser"), "value": .string("Chrome")])]),
                "exception": .object(["type": .string("TypeError"), "value": .string("Cannot read properties of undefined")]),
                "stacktraceFrames": .array([
                    .object(["function": .string("render"), "filename": .string("CheckoutView.tsx"), "lineNo": .number(88)])
                ]),
                "truncated": .bool(false),
                "redactionStatus": .string("private-state-excluded")
            ])
        ]) { _, new in new })
    }

    private func prepareIssueUpdate(request: MarketplaceProviderActionAdapterRequest) throws -> SentryProviderActionClientResult {
        let issueId = try SentryProviderActionAdapterSupport.requiredPayloadString(request: request, key: "issueId", label: "issue ID")
        let normalized = try SentryProviderActionAdapterSupport.normalizedIssueUpdatePayload(request.payload)
        return SentryProviderActionClientResult(result: baseResult(request: request).merging([
            "draftPreview": .object([
                "issueId": .string(issueId),
                "normalizedPayload": .object(normalized),
                "payloadHash": .string(MarketplaceProviderActionApprovalService.payloadHash(normalized)),
                "providerMutation": .bool(false),
                "blockedFieldsRemoved": .bool(false)
            ])
        ]) { _, new in new })
    }

    private func updateIssue(request: MarketplaceProviderActionAdapterRequest) throws -> SentryProviderActionClientResult {
        let issueId = try SentryProviderActionAdapterSupport.requiredPayloadString(request: request, key: "issueId", label: "issue ID")
        _ = try SentryProviderActionAdapterSupport.normalizedIssueUpdatePayload(request.payload)
        return SentryProviderActionClientResult(result: baseResult(request: request).merging([
            "issueId": .string(issueId),
            "status": request.payload["status"] ?? .string("resolved"),
            "permalink": .string("https://sentry.io/organizations/relay-org/issues/\(issueId)/"),
            "payloadHash": .string(MarketplaceProviderActionApprovalService.payloadHash(request.payload)),
            "auditId": .string("audit-sentry-\(Self.stableSuffix(issueId + request.idempotencyKey))")
        ]) { _, new in new })
    }

    private func baseResult(request: MarketplaceProviderActionAdapterRequest) -> JSONRecord {
        [
            "fakeAdapter": .bool(true),
            "adapterBoundary": .string("sentry-provider-action-adapter"),
            "clientMode": .string("fake-sentry-client"),
            "provider": .string("sentry"),
            "permission": .string(request.permission.rawValue),
            "payloadHash": .string(MarketplaceProviderActionApprovalService.payloadHash(request.payload)),
            "approved": .bool(request.approvalReference?.status == .approved),
            "idempotencyKey": .string(request.idempotencyKey),
            "liveCredentialsUsed": .bool(false),
            "simulated": .bool(true),
            "rawProviderToolExposure": .bool(false),
            "redactionStatus": .string("private-state-excluded")
        ]
    }

    private static func stableSuffix(_ value: String) -> String {
        SentryProviderActionAdapterSupport.stableSuffix(value)
    }
}

public final class LiveSentryProviderActionClient: SentryProviderActionClient, @unchecked Sendable {
    fileprivate struct Credentials {
        var authToken: String
        var organizationSlug: String
        var baseURL: URL
        var defaultProjectSlug: String?
        var defaultEnvironment: String?
    }

    private let data: LocalDataService
    private let secrets: SecretService
    private let httpClient: any SentryProviderHTTPClient

    public init(
        data: LocalDataService,
        secrets: SecretService,
        httpClient: any SentryProviderHTTPClient = URLSessionSentryProviderHTTPClient()
    ) {
        self.data = data
        self.secrets = secrets
        self.httpClient = httpClient
    }

    public func executeSentryAction(request: MarketplaceProviderActionAdapterRequest) throws -> SentryProviderActionClientResult {
        switch request.definition.actionKey {
        case "sentry_list_projects":
            return try listProjects(request: request)
        case "sentry_search_issues":
            return try searchIssues(request: request)
        case "sentry_get_issue":
            return try getIssue(request: request)
        case "sentry_get_event":
            return try getEvent(request: request)
        case "sentry_prepare_issue_update":
            return try FakeSentryProviderActionClient().executeSentryAction(request: request)
        case "sentry_update_issue":
            return try updateIssue(request: request)
        default:
            throw MarketplaceProviderActionAdapterFailure(
                code: "sentry_live_action_not_implemented",
                message: "Live Sentry provider execution does not support this action.",
                detail: ["actionKey": .string(request.definition.actionKey)]
            )
        }
    }

    private func listProjects(request: MarketplaceProviderActionAdapterRequest) throws -> SentryProviderActionClientResult {
        let credentials = try credentials(for: request)
        let limit = SentryProviderActionAdapterSupport.boundedInt(request.payload["limit"], defaultValue: 10, minValue: 1, maxValue: 10)
        let response = try send(
            method: "GET",
            path: "/api/0/organizations/\(SentryProviderActionAdapterSupport.pathEncode(credentials.organizationSlug))/projects/",
            queryItems: [URLQueryItem(name: "per_page", value: "\(limit)")],
            credentials: credentials
        )
        let parsed = try parseJSON(response)
        return SentryProviderActionClientResult(result: baseResult(request: request, credentials: credentials).merging([
            "semanticReadContract": .string("sentry-project-list-v1"),
            "projects": .array(array(from: parsed).prefix(limit).map { .object(projectSummary($0, organizationSlug: credentials.organizationSlug)) }),
            "nextCursor": .null
        ]) { _, new in new })
    }

    private func searchIssues(request: MarketplaceProviderActionAdapterRequest) throws -> SentryProviderActionClientResult {
        let credentials = try credentials(for: request)
        let limit = SentryProviderActionAdapterSupport.boundedInt(request.payload["limit"], defaultValue: 5, minValue: 1, maxValue: 10)
        var queryItems = [
            URLQueryItem(name: "limit", value: "\(limit)"),
            URLQueryItem(name: "statsPeriod", value: request.payload["statsPeriod"]?.string?.trimmedNonEmpty ?? "24h")
        ]
        if let project = request.payload["projectSlug"]?.string?.trimmedNonEmpty ?? credentials.defaultProjectSlug {
            queryItems.append(URLQueryItem(name: "project", value: project))
        }
        if let environment = request.payload["environment"]?.string?.trimmedNonEmpty ?? credentials.defaultEnvironment {
            queryItems.append(URLQueryItem(name: "environment", value: environment))
        }
        if let query = request.payload["query"]?.string?.trimmedNonEmpty {
            queryItems.append(URLQueryItem(name: "query", value: query))
        }
        if let status = request.payload["status"]?.string?.trimmedNonEmpty {
            queryItems.append(URLQueryItem(name: "status", value: status))
        }
        if let sort = request.payload["sort"]?.string?.trimmedNonEmpty {
            queryItems.append(URLQueryItem(name: "sort", value: sort))
        }
        let response = try send(
            method: "GET",
            path: "/api/0/organizations/\(SentryProviderActionAdapterSupport.pathEncode(credentials.organizationSlug))/issues/",
            queryItems: queryItems,
            credentials: credentials
        )
        let parsed = try parseJSON(response)
        return SentryProviderActionClientResult(result: baseResult(request: request, credentials: credentials).merging([
            "semanticReadContract": .string("sentry-issue-search-v1"),
            "issues": .array(array(from: parsed).prefix(limit).map { .object(issueSummary($0)) }),
            "nextCursor": .null
        ]) { _, new in new })
    }

    private func getIssue(request: MarketplaceProviderActionAdapterRequest) throws -> SentryProviderActionClientResult {
        let credentials = try credentials(for: request)
        let issueId = try SentryProviderActionAdapterSupport.requiredPayloadString(request: request, key: "issueId", label: "issue ID")
        let response = try send(
            method: "GET",
            path: "/api/0/organizations/\(SentryProviderActionAdapterSupport.pathEncode(credentials.organizationSlug))/issues/\(SentryProviderActionAdapterSupport.pathEncode(issueId))/",
            queryItems: [],
            credentials: credentials
        )
        let parsed = try parseJSON(response)
        return SentryProviderActionClientResult(result: baseResult(request: request, credentials: credentials).merging([
            "semanticReadContract": .string("sentry-issue-detail-v1"),
            "issue": .object(issueDetail(parsed))
        ]) { _, new in new })
    }

    private func getEvent(request: MarketplaceProviderActionAdapterRequest) throws -> SentryProviderActionClientResult {
        let credentials = try credentials(for: request)
        let eventId = try SentryProviderActionAdapterSupport.requiredPayloadString(request: request, key: "eventId", label: "event ID")
        let projectSlug = request.payload["projectSlug"]?.string?.trimmedNonEmpty ?? credentials.defaultProjectSlug
        guard let projectSlug else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "sentry_project_required",
                message: "Sentry event reads require a project slug in the payload or selected connection."
            )
        }
        let response = try send(
            method: "GET",
            path: "/api/0/projects/\(SentryProviderActionAdapterSupport.pathEncode(credentials.organizationSlug))/\(SentryProviderActionAdapterSupport.pathEncode(projectSlug))/events/\(SentryProviderActionAdapterSupport.pathEncode(eventId))/",
            queryItems: [],
            credentials: credentials
        )
        let parsed = try parseJSON(response)
        let maxContextChars = SentryProviderActionAdapterSupport.boundedInt(request.payload["maxContextChars"], defaultValue: 6000, minValue: 1, maxValue: 6000)
        return SentryProviderActionClientResult(result: baseResult(request: request, credentials: credentials).merging([
            "semanticReadContract": .string("sentry-event-detail-v1"),
            "event": .object(eventDetail(parsed, maxContextChars: maxContextChars, projectSlug: projectSlug))
        ]) { _, new in new })
    }

    private func updateIssue(request: MarketplaceProviderActionAdapterRequest) throws -> SentryProviderActionClientResult {
        let credentials = try credentials(for: request)
        let issueId = try SentryProviderActionAdapterSupport.requiredPayloadString(request: request, key: "issueId", label: "issue ID")
        let updatePayload = try SentryProviderActionAdapterSupport.normalizedIssueUpdatePayload(request.payload)
        let body = try JSONSerialization.data(withJSONObject: SentryProviderActionAdapterSupport.anyRecord(updatePayload))
        let response = try send(
            method: "PUT",
            path: "/api/0/organizations/\(SentryProviderActionAdapterSupport.pathEncode(credentials.organizationSlug))/issues/\(SentryProviderActionAdapterSupport.pathEncode(issueId))/",
            queryItems: [],
            body: body,
            credentials: credentials
        )
        let parsedValue = try parseJSON(response)
        let parsed: JSONRecord
        if case .object(let record) = parsedValue {
            parsed = record
        } else {
            parsed = [:]
        }
        return SentryProviderActionClientResult(result: baseResult(request: request, credentials: credentials).merging([
            "issueId": parsed["id"] ?? .string(issueId),
            "status": parsed["status"] ?? request.payload["status"] ?? .string("updated"),
            "permalink": parsed["permalink"] ?? .null,
            "payloadHash": .string(MarketplaceProviderActionApprovalService.payloadHash(request.payload)),
            "auditId": .string(request.auditIdentity.dispatchId ?? request.idempotencyKey)
        ]) { _, new in new })
    }

    private func credentials(for request: MarketplaceProviderActionAdapterRequest) throws -> Credentials {
        guard let connectionId = request.auditIdentity.connectionId?.trimmedNonEmpty,
              let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: connectionId),
              connection.appId == request.app.id,
              connection.appSlug == request.app.slug else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "sentry_connection_missing",
                message: "Sentry execution requires a Relay Marketplace provider connection."
            )
        }
        guard connection.status == .connected || connection.status == .healthError else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "sentry_connection_not_ready",
                message: "The Sentry provider connection is not ready.",
                detail: ["connectionStatus": .string(connection.status.rawValue)]
            )
        }
        let token = try secret(fieldKey: connection.credentialOwnership == .relayOwned ? "sentry_oauth_access_token" : "sentry_auth_token", connection: connection)
        let diagnostics = connection.health.diagnostics
        let orgSlug = diagnostics["organizationSlug"]?.string?.trimmedNonEmpty
            ?? connection.connectedHandle?.trimmedNonEmpty
        guard let orgSlug else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "sentry_organization_required",
                message: "Sentry execution requires an organization slug on the selected connection."
            )
        }
        let baseURLString = diagnostics["baseURL"]?.string?.trimmedNonEmpty ?? "https://sentry.io"
        guard let baseURL = SentryProviderActionAdapterSupport.normalizedBaseURL(baseURLString) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "sentry_invalid_base_url",
                message: "Sentry API base URL is invalid."
            )
        }
        return Credentials(
            authToken: token,
            organizationSlug: orgSlug,
            baseURL: baseURL,
            defaultProjectSlug: diagnostics["defaultProjectSlug"]?.string?.trimmedNonEmpty,
            defaultEnvironment: diagnostics["defaultEnvironment"]?.string?.trimmedNonEmpty
        )
    }

    private func secret(fieldKey: String, connection: MarketplaceProviderConnection) throws -> String {
        guard let secretId = connection.credentialRequirements.first(where: { $0.fieldKey == fieldKey })?.secretReferenceId?.trimmedNonEmpty else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "sentry_credentials_missing",
                message: "The Sentry provider connection is missing a required Keychain secret reference.",
                detail: ["fieldKey": .string(fieldKey)]
            )
        }
        do {
            return try secrets.getSecretValue(secretId)
        } catch {
            throw MarketplaceProviderActionAdapterFailure(
                code: "sentry_credentials_unavailable",
                message: "Relay could not read the saved Sentry auth token from the OS secret store. Replace the token in Marketplace.",
                detail: ["secretReferenceId": .string(secretId)]
            )
        }
    }

    private func send(
        method: String,
        path: String,
        queryItems: [URLQueryItem],
        body: Data? = nil,
        credentials: Credentials
    ) throws -> SentryProviderHTTPResponse {
        let base = credentials.baseURL.absoluteString.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        var components = URLComponents(string: base + path)
        components?.queryItems = queryItems.isEmpty ? nil : queryItems
        guard let url = components?.url else {
            throw MarketplaceProviderActionAdapterFailure(code: "sentry_invalid_url", message: "Could not build the Sentry API URL.")
        }
        let response = try httpClient.send(SentryProviderHTTPRequest(
            method: method,
            url: url,
            headers: [
                "Authorization": "Bearer \(credentials.authToken)",
                "Accept": "application/json",
                "Content-Type": "application/json"
            ],
            body: body
        ))
        guard (200..<300).contains(response.statusCode) else {
            throw Self.httpFailure(response)
        }
        return response
    }

    private static func httpFailure(_ response: SentryProviderHTTPResponse) -> MarketplaceProviderActionAdapterFailure {
        let code: String
        let message: String
        switch response.statusCode {
        case 401:
            code = "sentry_invalid_token"
            message = "Sentry rejected the saved auth token."
        case 403:
            code = "sentry_insufficient_scope"
            message = "Sentry denied this action. Confirm token scopes and organization/project access."
        case 404:
            code = "sentry_not_found"
            message = "Sentry could not find the requested organization, project, issue, or event."
        case 429:
            code = "sentry_rate_limited"
            message = "Sentry rate-limited this provider action."
        default:
            code = "sentry_http_error"
            message = "Sentry API returned HTTP \(response.statusCode)."
        }
        return MarketplaceProviderActionAdapterFailure(
            code: code,
            message: message,
            providerStatusCode: response.statusCode
        )
    }

    private func parseJSON(_ response: SentryProviderHTTPResponse) throws -> JSONValue {
        guard !response.body.isEmpty else {
            return .object([:])
        }
        let json = try JSONSerialization.jsonObject(with: response.body)
        return SentryProviderActionAdapterSupport.jsonValue(from: json)
    }

    private func array(from value: JSONValue) -> [JSONRecord] {
        if case .array(let values) = value {
            return values.compactMap { item in
                if case .object(let object) = item { return object }
                return nil
            }
        }
        if case .object(let object) = value,
           case .array(let values)? = object["results"] {
            return values.compactMap { item in
                if case .object(let object) = item { return object }
                return nil
            }
        }
        return []
    }

    private func baseResult(request: MarketplaceProviderActionAdapterRequest, credentials: Credentials) -> JSONRecord {
        [
            "fakeAdapter": .bool(false),
            "adapterBoundary": .string("sentry-provider-action-adapter"),
            "clientMode": .string("live-sentry-rest-api"),
            "provider": .string("sentry"),
            "organizationSlug": .string(credentials.organizationSlug),
            "baseURL": .string(credentials.baseURL.absoluteString),
            "permission": .string(request.permission.rawValue),
            "payloadHash": .string(MarketplaceProviderActionApprovalService.payloadHash(request.payload)),
            "approved": .bool(request.approvalReference?.status == .approved),
            "idempotencyKey": .string(request.idempotencyKey),
            "liveProvider": .bool(true),
            "liveCredentialsUsed": .bool(true),
            "simulated": .bool(false),
            "rawProviderToolExposure": .bool(false),
            "redactionStatus": .string("private-state-excluded")
        ]
    }

    private func projectSummary(_ record: JSONRecord, organizationSlug: String) -> JSONRecord {
        [
            "id": record["id"] ?? .null,
            "slug": record["slug"] ?? .null,
            "name": record["name"] ?? record["slug"] ?? .null,
            "platform": record["platform"] ?? .null,
            "status": record["status"] ?? .null,
            "organizationSlug": .string(organizationSlug),
            "permalink": record["permalink"] ?? .null,
            "redactionStatus": .string("private-state-excluded")
        ]
    }

    private func issueSummary(_ record: JSONRecord) -> JSONRecord {
        [
            "id": record["id"] ?? .null,
            "shortId": record["shortId"] ?? record["shortID"] ?? .null,
            "title": record["title"] ?? .null,
            "culprit": record["culprit"] ?? .null,
            "permalink": record["permalink"] ?? .null,
            "projectSlug": projectSlug(record["project"]),
            "status": record["status"] ?? .null,
            "substatus": record["substatus"] ?? .null,
            "priority": record["priority"] ?? .null,
            "level": record["level"] ?? .null,
            "count": record["count"] ?? .null,
            "userCount": record["userCount"] ?? .null,
            "firstSeen": record["firstSeen"] ?? .null,
            "lastSeen": record["lastSeen"] ?? .null,
            "stats": record["stats"] ?? .null,
            "redactionStatus": .string("private-state-excluded")
        ]
    }

    private func issueDetail(_ record: JSONValue) -> JSONRecord {
        guard case .object(let object) = record else {
            return [:]
        }
        var output = issueSummary(object)
        output["metadata"] = object["metadata"] ?? .null
        output["latestEvent"] = object["latestEvent"] ?? .null
        output["assignedTo"] = object["assignedTo"] ?? .null
        output["isBookmarked"] = object["isBookmarked"] ?? .null
        output["isSubscribed"] = object["isSubscribed"] ?? .null
        return output
    }

    private func eventDetail(_ record: JSONValue, maxContextChars: Int, projectSlug: String) -> JSONRecord {
        guard case .object(let object) = record else {
            return [:]
        }
        return [
            "id": object["eventID"] ?? object["eventId"] ?? object["id"] ?? .null,
            "issueId": object["groupID"] ?? object["groupId"] ?? .null,
            "projectSlug": .string(projectSlug),
            "title": object["title"] ?? object["message"] ?? .null,
            "message": truncatedString(object["message"]?.string, max: maxContextChars),
            "platform": object["platform"] ?? .null,
            "timestamp": object["dateCreated"] ?? object["timestamp"] ?? .null,
            "level": object["level"] ?? .null,
            "type": object["type"] ?? .null,
            "tags": object["tags"] ?? .null,
            "release": object["release"] ?? .null,
            "environment": object["environment"] ?? .null,
            "entries": object["entries"] ?? .null,
            "contexts": truncatedJSON(object["contexts"], max: maxContextChars),
            "truncated": .bool(false),
            "redactionStatus": .string("private-state-excluded")
        ]
    }

    private func projectSlug(_ value: JSONValue?) -> JSONValue {
        guard let value else { return .null }
        if case .object(let object) = value {
            return object["slug"] ?? object["name"] ?? object["id"] ?? .null
        }
        return value
    }

    private func truncatedString(_ value: String?, max: Int) -> JSONValue {
        guard let value else { return .null }
        return .string(String(value.prefix(max)))
    }

    private func truncatedJSON(_ value: JSONValue?, max: Int) -> JSONValue {
        guard let value else { return .null }
        let encoded = (try? String(data: JSONEncoder().encode(value), encoding: .utf8)) ?? ""
        return .string(String(encoded.prefix(max)))
    }
}

public struct SentryProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowlistedActionKeys: Set<String> = [
        "sentry_list_projects",
        "sentry_search_issues",
        "sentry_get_issue",
        "sentry_get_event",
        "sentry_prepare_issue_update",
        "sentry_update_issue"
    ]

    private let client: any SentryProviderActionClient

    public init(client: any SentryProviderActionClient = FakeSentryProviderActionClient()) {
        self.client = client
    }

    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "sentry" else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "sentry_adapter_wrong_provider",
                message: "Sentry adapter can only execute Sentry provider actions.",
                detail: ["appSlug": .string(request.app.slug)]
            )
        }
        guard Self.allowlistedActionKeys.contains(request.definition.actionKey) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "sentry_action_not_allowlisted",
                message: "The requested Sentry action is not in the V1 adapter allowlist.",
                detail: ["actionKey": .string(request.definition.actionKey)]
            )
        }
        let output = try client.executeSentryAction(request: request)
        return MarketplaceProviderActionAdapterResult(result: output.result, error: nil, redactionStatus: output.redactionStatus)
    }
}

public enum SentryProviderActionAdapterSupport {
    public static func requiredPayloadString(request: MarketplaceProviderActionAdapterRequest, key: String, label: String) throws -> String {
        guard let value = request.payload[key]?.string?.trimmedNonEmpty else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "sentry_missing_required_field",
                message: "Sentry \(label) is required.",
                detail: ["field": .string(key)]
            )
        }
        return value
    }

    public static func boundedInt(_ value: JSONValue?, defaultValue: Int, minValue: Int, maxValue: Int) -> Int {
        let raw = value?.number.map(Int.init) ?? value?.string.flatMap(Int.init) ?? defaultValue
        return max(minValue, min(maxValue, raw))
    }

    public static func normalizedIssueUpdatePayload(_ payload: JSONRecord) throws -> JSONRecord {
        guard let issueId = payload["issueId"]?.string?.trimmedNonEmpty else {
            throw MarketplaceProviderActionAdapterFailure(code: "sentry_missing_required_field", message: "Sentry issue ID is required.", detail: ["field": .string("issueId")])
        }
        var output: JSONRecord = ["issueId": .string(issueId)]
        let allowedKeys = ["status", "substatus", "assignedTo", "isBookmarked", "isSubscribed", "priority", "approvalPayloadHash"]
        for key in allowedKeys {
            if let value = payload[key], value != .null {
                output[key] = value
            }
        }
        for blocked in ["isPublic", "delete", "merge", "bulk", "projectId", "organizationId"] where payload[blocked] != nil {
            throw MarketplaceProviderActionAdapterFailure(
                code: "sentry_update_field_blocked",
                message: "Sentry issue update payload contains a blocked V1 field.",
                detail: ["field": .string(blocked)]
            )
        }
        guard output.keys.count > 1 else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "sentry_update_empty",
                message: "Sentry issue update requires at least one bounded workflow field."
            )
        }
        return output
    }

    public static func normalizedBaseURL(_ value: String) -> URL? {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines).trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        guard !trimmed.isEmpty else { return URL(string: "https://sentry.io") }
        guard var components = URLComponents(string: trimmed) else { return nil }
        if components.scheme == nil {
            components.scheme = "https"
        }
        components.path = ""
        components.query = nil
        components.fragment = nil
        guard components.scheme == "https" else { return nil }
        return components.url
    }

    public static func pathEncode(_ value: String) -> String {
        value.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? value
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
        case .string(let string):
            return string
        case .number(let number):
            return number
        case .bool(let bool):
            return bool
        case .object(let object):
            return anyRecord(object)
        case .array(let array):
            return array.map(anyValue(_:))
        case .null:
            return NSNull()
        }
    }

    public static func stableSuffix(_ value: String) -> String {
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
    var trimmedNonEmpty: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}
