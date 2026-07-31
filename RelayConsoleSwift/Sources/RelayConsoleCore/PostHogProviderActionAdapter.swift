import Foundation

public struct PostHogProviderActionClientResult: Codable, Equatable, Sendable {
    public var result: JSONRecord
    public var redactionStatus: String

    public init(result: JSONRecord, redactionStatus: String = "private-state-excluded") {
        self.result = result
        self.redactionStatus = redactionStatus
    }
}

public protocol PostHogProviderActionClient: Sendable {
    func executePostHogAction(request: MarketplaceProviderActionAdapterRequest) throws -> PostHogProviderActionClientResult
}

public struct PostHogProviderHTTPRequest: Sendable, Equatable {
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

public struct PostHogProviderHTTPResponse: Sendable, Equatable {
    public var statusCode: Int
    public var body: Data

    public init(statusCode: Int, body: Data) {
        self.statusCode = statusCode
        self.body = body
    }
}

public protocol PostHogProviderHTTPClient: Sendable {
    func send(_ request: PostHogProviderHTTPRequest) throws -> PostHogProviderHTTPResponse
}

public struct URLSessionPostHogProviderHTTPClient: PostHogProviderHTTPClient {
    private let timeoutSeconds: TimeInterval

    public init(timeoutSeconds: TimeInterval = 20) {
        self.timeoutSeconds = timeoutSeconds
    }

    public func send(_ request: PostHogProviderHTTPRequest) throws -> PostHogProviderHTTPResponse {
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
                code: "posthog_http_timeout",
                message: "PostHog API request timed out.",
                detail: ["urlHost": .string(request.url.host ?? "posthog.com")]
            )
        }
        if let responseError {
            throw responseError
        }
        return PostHogProviderHTTPResponse(statusCode: responseStatusCode ?? 0, body: responseData ?? Data())
    }
}

public struct FakePostHogProviderActionClient: PostHogProviderActionClient {
    private let failureByActionKey: [String: MarketplaceProviderActionAdapterFailure]

    public init(failureByActionKey: [String: MarketplaceProviderActionAdapterFailure] = [:]) {
        self.failureByActionKey = failureByActionKey
    }

    public func executePostHogAction(request: MarketplaceProviderActionAdapterRequest) throws -> PostHogProviderActionClientResult {
        if let failure = failureByActionKey[request.definition.actionKey] {
            throw failure
        }
        if request.definition.actionKey == "posthog_query_bounded" {
            try PostHogProviderActionAdapter.validateBoundedQueryPayload(request.payload)
        }
        return PostHogProviderActionClientResult(result: baseResult(request: request).merging(fakeResult(for: request)) { _, new in new })
    }

    private func fakeResult(for request: MarketplaceProviderActionAdapterRequest) -> JSONRecord {
        switch request.definition.actionKey {
        case "posthog_projects_list":
            return ["projects": .array([]), "nextCursor": .null]
        case "posthog_dashboards_list":
            return ["dashboards": .array([]), "nextCursor": .null]
        case "posthog_dashboard_read":
            return ["dashboard": .object(["id": request.payload["dashboardId"] ?? .string("fake-dashboard")])]
        case "posthog_insights_list":
            return ["insights": .array([]), "nextCursor": .null]
        case "posthog_insight_read":
            return ["insight": .object(["id": request.payload["insightId"] ?? .string("fake-insight")])]
        case "posthog_query_bounded":
            return ["columns": .array([]), "rows": .array([]), "truncated": .bool(false), "warnings": .array([])]
        case "posthog_schema_read":
            return ["events": .array([]), "properties": .array([])]
        default:
            return [:]
        }
    }

    private func baseResult(request: MarketplaceProviderActionAdapterRequest) -> JSONRecord {
        [
            "fakeAdapter": .bool(true),
            "adapterBoundary": .string("posthog-provider-action-adapter"),
            "clientMode": .string("fake-posthog-client"),
            "provider": .string("posthog"),
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
}

public final class LivePostHogProviderActionClient: PostHogProviderActionClient, @unchecked Sendable {
    private struct Credentials {
        var personalAPIKey: String
        var apiBaseURL: String
        var defaultProjectId: String?
    }

    private let data: LocalDataService
    private let secrets: SecretService
    private let httpClient: any PostHogProviderHTTPClient

    public init(
        data: LocalDataService,
        secrets: SecretService,
        httpClient: any PostHogProviderHTTPClient = URLSessionPostHogProviderHTTPClient()
    ) {
        self.data = data
        self.secrets = secrets
        self.httpClient = httpClient
    }

    public func executePostHogAction(request: MarketplaceProviderActionAdapterRequest) throws -> PostHogProviderActionClientResult {
        switch request.definition.actionKey {
        case "posthog_projects_list":
            return try listProjects(request: request)
        case "posthog_dashboards_list":
            return try listDashboards(request: request)
        case "posthog_dashboard_read":
            return try readDashboard(request: request)
        case "posthog_insights_list":
            return try listInsights(request: request)
        case "posthog_insight_read":
            return try readInsight(request: request)
        case "posthog_query_bounded":
            return try runBoundedQuery(request: request)
        case "posthog_schema_read":
            return try readSchema(request: request)
        default:
            throw MarketplaceProviderActionAdapterFailure(
                code: "posthog_live_action_not_implemented",
                message: "Live PostHog provider execution does not support this action."
            )
        }
    }

    private func listProjects(request: MarketplaceProviderActionAdapterRequest) throws -> PostHogProviderActionClientResult {
        let credentials = try credentials(for: request)
        let response = try getJSON(
            path: "/api/projects/",
            query: paginationQuery(payload: request.payload, defaultLimit: 10, maxLimit: 25),
            credentials: credentials
        )
        let projects = Self.items(from: response).map { item in
            Self.selectedObject(item, keys: ["id", "uuid", "name", "api_token", "organization_id", "created_at"])
        }
        return PostHogProviderActionClientResult(result: baseResult(request: request, credentials: credentials).merging([
            "projects": .array(projects.map(JSONValue.object)),
            "count": .number(Double(projects.count)),
            "nextCursor": response["next"] ?? .null
        ]) { _, new in new })
    }

    private func listDashboards(request: MarketplaceProviderActionAdapterRequest) throws -> PostHogProviderActionClientResult {
        let credentials = try credentials(for: request)
        let projectId = try projectId(from: request, credentials: credentials)
        let response = try getJSON(
            path: "/api/environments/\(Self.pathEncode(projectId))/dashboards/",
            query: paginationQuery(payload: request.payload, defaultLimit: 10, maxLimit: 25),
            credentials: credentials
        )
        let dashboards = Self.items(from: response).map { item in
            Self.selectedObject(item, keys: ["id", "name", "description", "items", "created_at", "updated_at"])
        }
        return PostHogProviderActionClientResult(result: baseResult(request: request, credentials: credentials).merging([
            "projectId": .string(projectId),
            "dashboards": .array(dashboards.map(JSONValue.object)),
            "count": .number(Double(dashboards.count)),
            "nextCursor": response["next"] ?? .null
        ]) { _, new in new })
    }

    private func readDashboard(request: MarketplaceProviderActionAdapterRequest) throws -> PostHogProviderActionClientResult {
        let credentials = try credentials(for: request)
        let projectId = try projectId(from: request, credentials: credentials)
        let dashboardId = try Self.requiredString("dashboardId", in: request.payload, provider: "PostHog dashboard")
        let response = try getJSON(
            path: "/api/environments/\(Self.pathEncode(projectId))/dashboards/\(Self.pathEncode(dashboardId))/",
            query: [:],
            credentials: credentials
        )
        let dashboard = Self.selectedObject(response, keys: ["id", "name", "description", "items", "created_at", "updated_at"])
        return PostHogProviderActionClientResult(result: baseResult(request: request, credentials: credentials).merging([
            "projectId": .string(projectId),
            "dashboard": .object(dashboard)
        ]) { _, new in new })
    }

    private func listInsights(request: MarketplaceProviderActionAdapterRequest) throws -> PostHogProviderActionClientResult {
        let credentials = try credentials(for: request)
        let projectId = try projectId(from: request, credentials: credentials)
        var query = paginationQuery(payload: request.payload, defaultLimit: 10, maxLimit: 25)
        if let search = request.payload["query"]?.string?.nilIfEmpty {
            query["search"] = search
        }
        let response = try getJSON(
            path: "/api/environments/\(Self.pathEncode(projectId))/insights/",
            query: query,
            credentials: credentials
        )
        let insights = Self.items(from: response).map { item in
            Self.selectedObject(item, keys: ["id", "short_id", "name", "description", "filters", "query", "created_at", "updated_at"])
        }
        return PostHogProviderActionClientResult(result: baseResult(request: request, credentials: credentials).merging([
            "projectId": .string(projectId),
            "insights": .array(insights.map(JSONValue.object)),
            "count": .number(Double(insights.count)),
            "nextCursor": response["next"] ?? .null
        ]) { _, new in new })
    }

    private func readInsight(request: MarketplaceProviderActionAdapterRequest) throws -> PostHogProviderActionClientResult {
        let credentials = try credentials(for: request)
        let projectId = try projectId(from: request, credentials: credentials)
        let insightId = try Self.requiredString("insightId", in: request.payload, provider: "PostHog insight")
        let response = try getJSON(
            path: "/api/environments/\(Self.pathEncode(projectId))/insights/\(Self.pathEncode(insightId))/",
            query: [:],
            credentials: credentials
        )
        let insight = Self.selectedObject(response, keys: ["id", "short_id", "name", "description", "filters", "query", "result", "created_at", "updated_at"])
        return PostHogProviderActionClientResult(result: baseResult(request: request, credentials: credentials).merging([
            "projectId": .string(projectId),
            "insight": .object(insight)
        ]) { _, new in new })
    }

    private func runBoundedQuery(request: MarketplaceProviderActionAdapterRequest) throws -> PostHogProviderActionClientResult {
        try PostHogProviderActionAdapter.validateBoundedQueryPayload(request.payload)
        let credentials = try credentials(for: request)
        let projectId = try projectId(from: request, credentials: credentials)
        guard case .object(let queryObject)? = request.payload["query"] else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "posthog_missing_query",
                message: "PostHog bounded query reads require a query object."
            )
        }
        let maxRows = Self.clampedInt(request.payload["maxRows"], defaultValue: 50, minValue: 1, maxValue: 100)
        let response = try postJSON(
            path: "/api/projects/\(Self.pathEncode(projectId))/query/",
            body: ["query": .object(queryObject)],
            credentials: credentials
        )
        let columns = Self.columns(from: response)
        let allRows = Self.rows(from: response)
        let boundedRows = Array(allRows.prefix(maxRows))
        return PostHogProviderActionClientResult(result: baseResult(request: request, credentials: credentials).merging([
            "projectId": .string(projectId),
            "columns": .array(columns),
            "rows": .array(boundedRows),
            "rowCount": .number(Double(boundedRows.count)),
            "truncated": .bool(allRows.count > boundedRows.count),
            "warnings": .array([
                .string("Relay blocked raw HogQL and SQL payloads before executing this PostHog read."),
                .string("Rows are capped at \(maxRows) for Marketplace runtime context.")
            ])
        ]) { _, new in new })
    }

    private func readSchema(request: MarketplaceProviderActionAdapterRequest) throws -> PostHogProviderActionClientResult {
        let credentials = try credentials(for: request)
        let projectId = try projectId(from: request, credentials: credentials)
        let limit = Self.clampedInt(request.payload["limit"], defaultValue: 25, minValue: 1, maxValue: 100)
        var eventQuery = ["limit": String(limit)]
        if let query = request.payload["eventQuery"]?.string?.nilIfEmpty {
            eventQuery["search"] = query
        }
        var propertyQuery = ["limit": String(limit)]
        if let query = request.payload["propertyQuery"]?.string?.nilIfEmpty {
            propertyQuery["search"] = query
        }
        let eventsResponse = try getJSON(
            path: "/api/projects/\(Self.pathEncode(projectId))/event_definitions/",
            query: eventQuery,
            credentials: credentials
        )
        let propertiesResponse = try getJSON(
            path: "/api/projects/\(Self.pathEncode(projectId))/property_definitions/",
            query: propertyQuery,
            credentials: credentials
        )
        let events = Self.items(from: eventsResponse).map { item in
            Self.selectedObject(item, keys: ["id", "name", "description", "volume_30_day", "query_usage_30_day", "last_seen_at"])
        }
        let properties = Self.items(from: propertiesResponse).map { item in
            Self.selectedObject(item, keys: ["id", "name", "description", "property_type", "type", "last_seen_at"])
        }
        return PostHogProviderActionClientResult(result: baseResult(request: request, credentials: credentials).merging([
            "projectId": .string(projectId),
            "events": .array(events.map(JSONValue.object)),
            "properties": .array(properties.map(JSONValue.object)),
            "eventCount": .number(Double(events.count)),
            "propertyCount": .number(Double(properties.count))
        ]) { _, new in new })
    }

    private func credentials(for request: MarketplaceProviderActionAdapterRequest) throws -> Credentials {
        let connection = try connection(for: request)
        return Credentials(
            personalAPIKey: try postHogBearerToken(connection: connection),
            apiBaseURL: connection.health.diagnostics["apiBaseURL"]?.string?.nilIfEmpty ?? "https://us.posthog.com",
            defaultProjectId: connection.health.diagnostics["projectId"]?.string?.nilIfEmpty
        )
    }

    private func postHogBearerToken(connection: MarketplaceProviderConnection) throws -> String {
        if connection.credentialOwnership == .relayOwned {
            return try secret(fieldKey: "posthog_oauth_access_token", connection: connection)
        }
        return try secret(fieldKey: "posthog_personal_api_key", connection: connection)
    }

    private func connection(for request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderConnection {
        guard let connectionId = request.auditIdentity.connectionId?.nilIfEmpty,
              let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: connectionId),
              connection.appId == request.app.id,
              connection.appSlug == request.app.slug else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "posthog_connection_missing",
                message: "PostHog execution requires a Relay Marketplace provider connection."
            )
        }
        guard connection.status == .connected || connection.status == .healthError else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "posthog_connection_not_ready",
                message: "The PostHog provider connection is not ready."
            )
        }
        return connection
    }

    private func secret(fieldKey: String, connection: MarketplaceProviderConnection) throws -> String {
        guard let secretId = connection.credentialRequirements.first(where: { $0.fieldKey == fieldKey })?.secretReferenceId else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "posthog_credentials_missing",
                message: "The PostHog provider connection is missing a required Keychain secret reference.",
                detail: ["fieldKey": .string(fieldKey)]
            )
        }
        do {
            return try secrets.getSecretValue(secretId)
        } catch {
            markCredentialUnavailable(fieldKey: fieldKey, connection: connection)
            throw MarketplaceProviderActionAdapterFailure(
                code: "posthog_credentials_unavailable",
                message: "Relay could not read the saved PostHog key from the OS secret store. Replace the key in Marketplace.",
                detail: ["fieldKey": .string(fieldKey)]
            )
        }
    }

    private func markCredentialUnavailable(fieldKey: String, connection: MarketplaceProviderConnection) {
        var updated = connection
        updated.status = .authRequired
        updated.authorizationState = .error
        updated.reauthorizeRequired = true
        updated.lastCheckedAt = nowIso()
        updated.lastError = "Saved PostHog key is unavailable in the OS secret store. Replace the key in Marketplace."
        updated.health = ProviderConnectorHealth(
            state: .error,
            message: "Saved PostHog key is unavailable in the OS secret store. Replace the key in Marketplace.",
            lastCheckedAt: updated.lastCheckedAt,
            missingScopes: [],
            unavailableTools: ["posthog_projects_list", "posthog_dashboards_list", "posthog_insights_list", "posthog_query_bounded", "posthog_schema_read"],
            diagnostics: [
                "fieldKey": .string(fieldKey),
                "reasonCode": .string("posthog_credentials_unavailable"),
                "redactionStatus": .string("private-state-excluded")
            ],
            redactionStatus: "private-state-excluded"
        )
        updated.credentialRequirements = updated.credentialRequirements.map { requirement in
            var copy = requirement
            if copy.fieldKey == fieldKey {
                copy.status = .unavailable
            }
            return copy
        }
        DispatchQueue.global(qos: .utility).async { [data] in
            _ = try? data.saveProviderConnection(updated)
        }
    }

    private func projectId(from request: MarketplaceProviderActionAdapterRequest, credentials: Credentials) throws -> String {
        if let projectId = request.payload["projectId"]?.string?.nilIfEmpty ?? credentials.defaultProjectId {
            return projectId
        }
        throw MarketplaceProviderActionAdapterFailure(
            code: "posthog_project_required",
            message: "PostHog project or environment id is required for this read. Save a selected project id or pass projectId."
        )
    }

    private func getJSON(path: String, query: [String: String], credentials: Credentials) throws -> JSONRecord {
        let url = try Self.postHogURL(baseURL: credentials.apiBaseURL, path: path, query: query)
        let response = try httpClient.send(PostHogProviderHTTPRequest(method: "GET", url: url, headers: Self.headers(credentials: credentials)))
        return try Self.parseJSONResponse(response)
    }

    private func postJSON(path: String, body: JSONRecord, credentials: Credentials) throws -> JSONRecord {
        let url = try Self.postHogURL(baseURL: credentials.apiBaseURL, path: path, query: [:])
        let bodyData = try jsonEncoder.encode(JSONValue.object(body))
        var headers = Self.headers(credentials: credentials)
        headers["Content-Type"] = "application/json"
        let response = try httpClient.send(PostHogProviderHTTPRequest(method: "POST", url: url, headers: headers, body: bodyData))
        return try Self.parseJSONResponse(response)
    }

    private func paginationQuery(payload: JSONRecord, defaultLimit: Int, maxLimit: Int) -> [String: String] {
        var query: [String: String] = [
            "limit": String(Self.clampedInt(payload["limit"], defaultValue: defaultLimit, minValue: 1, maxValue: maxLimit))
        ]
        if let cursor = payload["cursor"]?.string?.nilIfEmpty {
            query["offset"] = cursor
        }
        return query
    }

    private func baseResult(request: MarketplaceProviderActionAdapterRequest, credentials: Credentials) -> JSONRecord {
        [
            "adapterBoundary": .string("posthog-provider-action-adapter"),
            "clientMode": .string("live-posthog-api"),
            "provider": .string("posthog"),
            "apiBaseURL": .string(credentials.apiBaseURL),
            "permission": .string(request.permission.rawValue),
            "payloadHash": .string(MarketplaceProviderActionApprovalService.payloadHash(request.payload)),
            "approved": .bool(request.approvalReference?.status == .approved),
            "idempotencyKey": .string(request.idempotencyKey),
            "fakeAdapter": .bool(false),
            "liveCredentialsUsed": .bool(true),
            "simulated": .bool(false),
            "rawProviderToolExposure": .bool(false),
            "redactionStatus": .string("private-state-excluded")
        ]
    }

    private static func headers(credentials: Credentials) -> [String: String] {
        [
            "Authorization": "Bearer \(credentials.personalAPIKey)",
            "Accept": "application/json"
        ]
    }

    private static func postHogURL(baseURL: String, path: String, query: [String: String]) throws -> URL {
        guard let base = URL(string: baseURL) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "posthog_invalid_base_url",
                message: "PostHog API base URL is invalid."
            )
        }
        var components = URLComponents()
        components.scheme = base.scheme
        components.host = base.host
        components.port = base.port
        components.path = path
        components.queryItems = query.sorted { $0.key < $1.key }.map { URLQueryItem(name: $0.key, value: $0.value) }
        guard let url = components.url else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "posthog_invalid_url",
                message: "Could not build the PostHog API URL."
            )
        }
        return url
    }

    private static func parseJSONResponse(_ response: PostHogProviderHTTPResponse) throws -> JSONRecord {
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "posthog_http_error",
                message: "PostHog API returned HTTP \(response.statusCode).",
                providerStatusCode: response.statusCode,
                detail: ["body": .string(bodySnippet(response.body))]
            )
        }
        guard !response.body.isEmpty else {
            return [:]
        }
        let json = try JSONSerialization.jsonObject(with: response.body)
        if let object = json as? [String: Any] {
            return jsonRecord(from: object)
        }
        if let array = json as? [Any] {
            return ["results": .array(array.map(jsonValue(from:)))]
        }
        return ["value": jsonValue(from: json)]
    }

    private static func bodySnippet(_ data: Data, limit: Int = 400) -> String {
        guard let text = String(data: data, encoding: .utf8) else { return "" }
        if text.count <= limit { return text }
        return String(text.prefix(limit))
    }

    private static func items(from record: JSONRecord) -> [JSONRecord] {
        if case .array(let values)? = record["results"] {
            return values.compactMap(object)
        }
        if case .array(let values)? = record["items"] {
            return values.compactMap(object)
        }
        if case .array(let values)? = record["data"] {
            return values.compactMap(object)
        }
        return []
    }

    private static func selectedObject(_ record: JSONRecord, keys: [String]) -> JSONRecord {
        var output: JSONRecord = [:]
        for key in keys {
            if let value = record[key], value != .null {
                output[key] = value
            }
        }
        return output
    }

    private static func rows(from record: JSONRecord) -> [JSONValue] {
        if case .array(let values)? = record["results"] {
            return values
        }
        if case .array(let values)? = record["rows"] {
            return values
        }
        if case .object(let object)? = record["result"],
           case .array(let values)? = object["rows"] {
            return values
        }
        return []
    }

    private static func columns(from record: JSONRecord) -> [JSONValue] {
        if case .array(let values)? = record["columns"] {
            return values
        }
        if case .object(let object)? = record["result"],
           case .array(let values)? = object["columns"] {
            return values
        }
        return []
    }

    private static func object(_ value: JSONValue) -> JSONRecord? {
        if case .object(let record) = value { return record }
        return nil
    }

    private static func requiredString(_ field: String, in payload: JSONRecord, provider: String) throws -> String {
        guard let value = payload[field]?.string?.nilIfEmpty else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "posthog_missing_required_field",
                message: "\(provider) reads require \(field).",
                detail: ["field": .string(field)]
            )
        }
        return value
    }

    private static func clampedInt(_ value: JSONValue?, defaultValue: Int, minValue: Int, maxValue: Int) -> Int {
        let candidate: Int
        if let number = value?.number {
            candidate = Int(number)
        } else if let string = value?.string, let int = Int(string.trimmingCharacters(in: .whitespacesAndNewlines)) {
            candidate = int
        } else {
            candidate = defaultValue
        }
        return min(max(candidate, minValue), maxValue)
    }

    private static func pathEncode(_ value: String) -> String {
        var allowed = CharacterSet.urlPathAllowed
        allowed.remove(charactersIn: "/?#[]@!$&'()*+,;=")
        return value.addingPercentEncoding(withAllowedCharacters: allowed) ?? value
    }
}

public struct PostHogProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowlistedActionKeys: Set<String> = [
        "posthog_projects_list",
        "posthog_dashboards_list",
        "posthog_dashboard_read",
        "posthog_insights_list",
        "posthog_insight_read",
        "posthog_query_bounded",
        "posthog_schema_read"
    ]

    private let client: any PostHogProviderActionClient

    public init(client: any PostHogProviderActionClient = FakePostHogProviderActionClient()) {
        self.client = client
    }

    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "posthog" else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "posthog_adapter_wrong_provider",
                message: "PostHog adapter can only execute PostHog provider actions."
            )
        }
        guard Self.allowlistedActionKeys.contains(request.definition.actionKey) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "posthog_action_not_allowlisted",
                message: "The requested PostHog action is not in the V1 read-only adapter allowlist."
            )
        }
        if request.definition.actionKey == "posthog_query_bounded" {
            try Self.validateBoundedQueryPayload(request.payload)
        }
        let output = try client.executePostHogAction(request: request)
        return MarketplaceProviderActionAdapterResult(
            result: output.result,
            error: nil,
            redactionStatus: output.redactionStatus
        )
    }

    public static func validateBoundedQueryPayload(_ payload: JSONRecord) throws {
        guard case .object(let query)? = payload["query"] else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "posthog_missing_query",
                message: "PostHog bounded query reads require a query object."
            )
        }
        guard let kind = query["kind"]?.string?.nilIfEmpty else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "posthog_query_kind_required",
                message: "PostHog bounded query reads require an explicit non-HogQL query kind."
            )
        }
        let disallowedKinds = ["HogQLQuery", "ActorsQuery", "SessionsTimelineQuery", "EventsQuery"]
        guard !disallowedKinds.contains(kind) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "posthog_raw_query_blocked",
                message: "Raw HogQL, event, person, session, and replay query shapes are blocked in the V1 PostHog adapter.",
                detail: ["kind": .string(kind)]
            )
        }
        guard !containsRawQuery(query) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "posthog_raw_query_blocked",
                message: "Raw HogQL and SQL strings are blocked in the V1 PostHog adapter."
            )
        }
    }

    private static func containsRawQuery(_ record: JSONRecord) -> Bool {
        record.contains { key, value in
            let lowerKey = key.lowercased()
            if lowerKey == "query" || lowerKey.contains("hogql") || lowerKey.contains("sql") {
                return true
            }
            return containsRawQuery(value)
        }
    }

    private static func containsRawQuery(_ value: JSONValue) -> Bool {
        switch value {
        case .string(let string):
            let lower = string.lowercased()
            return lower.contains("select ")
                || lower.contains(" from ")
                || lower.contains("hogql")
                || lower.contains("sql")
        case .object(let object):
            return containsRawQuery(object)
        case .array(let values):
            return values.contains { containsRawQuery($0) }
        case .number, .bool, .null:
            return false
        }
    }
}

private extension String {
    var nilIfEmpty: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}
