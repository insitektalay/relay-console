import Foundation

public struct TelemetryDeckProviderActionClientResult: Codable, Equatable, Sendable {
    public var result: JSONRecord
    public var redactionStatus: String

    public init(result: JSONRecord, redactionStatus: String = "private-state-excluded") {
        self.result = result
        self.redactionStatus = redactionStatus
    }
}

public protocol TelemetryDeckProviderActionClient: Sendable {
    func executeTelemetryDeckAction(request: MarketplaceProviderActionAdapterRequest) throws -> TelemetryDeckProviderActionClientResult
}

public struct TelemetryDeckProviderHTTPRequest: Sendable, Equatable {
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

public struct TelemetryDeckProviderHTTPResponse: Sendable, Equatable {
    public var statusCode: Int
    public var body: Data

    public init(statusCode: Int, body: Data = Data()) {
        self.statusCode = statusCode
        self.body = body
    }
}

public protocol TelemetryDeckProviderHTTPClient: Sendable {
    func send(_ request: TelemetryDeckProviderHTTPRequest) throws -> TelemetryDeckProviderHTTPResponse
}

public struct URLSessionTelemetryDeckProviderHTTPClient: TelemetryDeckProviderHTTPClient {
    private let timeoutSeconds: TimeInterval

    public init(timeoutSeconds: TimeInterval = 45) {
        self.timeoutSeconds = timeoutSeconds
    }

    public func send(_ request: TelemetryDeckProviderHTTPRequest) throws -> TelemetryDeckProviderHTTPResponse {
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
                code: "telemetrydeck_http_timeout",
                message: "TelemetryDeck API request timed out.",
                detail: ["urlHost": .string(request.url.host ?? "api.telemetrydeckapi.com")]
            )
        }
        if let responseError {
            throw responseError
        }
        return TelemetryDeckProviderHTTPResponse(statusCode: responseStatusCode ?? 0, body: responseData ?? Data())
    }
}

public struct FakeTelemetryDeckProviderActionClient: TelemetryDeckProviderActionClient {
    private let failureByActionKey: [String: MarketplaceProviderActionAdapterFailure]

    public init(failureByActionKey: [String: MarketplaceProviderActionAdapterFailure] = [:]) {
        self.failureByActionKey = failureByActionKey
    }

    public func executeTelemetryDeckAction(request: MarketplaceProviderActionAdapterRequest) throws -> TelemetryDeckProviderActionClientResult {
        if let failure = failureByActionKey[request.definition.actionKey] {
            throw failure
        }
        if request.definition.actionKey == "telemetrydeck_tql_query_read" {
            _ = try TelemetryDeckProviderActionAdapter.validateBoundedTQLPayload(request.payload)
        }
        return TelemetryDeckProviderActionClientResult(
            result: baseResult(request: request).merging(fakeResult(for: request)) { _, new in new }
        )
    }

    private func fakeResult(for request: MarketplaceProviderActionAdapterRequest) -> JSONRecord {
        switch request.definition.actionKey {
        case "telemetrydeck_user_info_read":
            return [
                "user": .object(["id": .string("fake-telemetrydeck-user")]),
                "organization": .object(["name": .string("Fake TelemetryDeck Organization")])
            ]
        case "telemetrydeck_tql_query_read":
            return [
                "queryType": request.payload["queryType"] ?? .string("topN"),
                "resultType": .string("topNResult"),
                "columns": .array([.string("label"), .string("count")]),
                "rows": .array([]),
                "rowCount": .number(0),
                "returnedRowCount": .number(0),
                "truncated": .bool(false),
                "warnings": .array([.string("Fake TelemetryDeck adapter returned deterministic empty rows.")])
            ]
        case "telemetrydeck_saved_insight_read":
            return [
                "insight": .object([
                    "id": request.payload["insightId"] ?? .string("fake-telemetrydeck-insight"),
                    "queryType": .string("topN")
                ]),
                "resultType": .string("topNResult"),
                "rows": .array([]),
                "rowCount": .number(0),
                "returnedRowCount": .number(0),
                "truncated": .bool(false)
            ]
        default:
            return [:]
        }
    }

    private func baseResult(request: MarketplaceProviderActionAdapterRequest) -> JSONRecord {
        [
            "fakeAdapter": .bool(true),
            "adapterBoundary": .string("telemetrydeck-provider-action-adapter"),
            "clientMode": .string("fake-telemetrydeck-client"),
            "provider": .string("telemetrydeck"),
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

public final class LiveTelemetryDeckProviderActionClient: TelemetryDeckProviderActionClient, @unchecked Sendable {
    fileprivate struct Credentials {
        var personalAccessToken: String
        var namespace: String
        var appId: String
        var appDisplayName: String?
        var defaultInsightId: String?
    }

    private let data: LocalDataService
    private let secrets: SecretService
    private let httpClient: any TelemetryDeckProviderHTTPClient

    public init(
        data: LocalDataService,
        secrets: SecretService,
        httpClient: any TelemetryDeckProviderHTTPClient = URLSessionTelemetryDeckProviderHTTPClient()
    ) {
        self.data = data
        self.secrets = secrets
        self.httpClient = httpClient
    }

    public func executeTelemetryDeckAction(request: MarketplaceProviderActionAdapterRequest) throws -> TelemetryDeckProviderActionClientResult {
        switch request.definition.actionKey {
        case "telemetrydeck_user_info_read":
            return try readUserInfo(request: request)
        case "telemetrydeck_tql_query_read":
            return try runBoundedTQL(request: request)
        case "telemetrydeck_saved_insight_read":
            return try readSavedInsight(request: request)
        default:
            throw MarketplaceProviderActionAdapterFailure(
                code: "telemetrydeck_live_action_not_implemented",
                message: "Live TelemetryDeck provider execution does not support this action."
            )
        }
    }

    private func readUserInfo(request: MarketplaceProviderActionAdapterRequest) throws -> TelemetryDeckProviderActionClientResult {
        let credentials = try credentials(for: request)
        let response = try getJSON(path: "/api/v3/users/info", credentials: credentials)
        let user = Self.selectedObject(response, keys: ["id", "email", "name", "userID", "userEmail"])
        let organization = Self.selectedObject(response, keys: ["organization", "organizationName", "organizationID", "team", "namespace"])
        return TelemetryDeckProviderActionClientResult(result: Self.baseResult(request: request, credentials: credentials).merging([
            "user": .object(user),
            "organization": .object(organization),
            "namespace": .string(credentials.namespace),
            "telemetryDeckAppId": .string(credentials.appId),
            "checkedAt": .string(nowIso())
        ]) { _, new in new })
    }

    private func runBoundedTQL(request: MarketplaceProviderActionAdapterRequest) throws -> TelemetryDeckProviderActionClientResult {
        let credentials = try credentials(for: request)
        let maxRows = Self.clampedInt(request.payload["maxRows"], defaultValue: 50, minValue: 1, maxValue: 100)
        let query = try Self.validateBoundedTQLPayload(request.payload, credentials: credentials)
        let response = try postJSON(path: "/api/v4/query/tql", body: query, credentials: credentials)
        return TelemetryDeckProviderActionClientResult(result: Self.tqlResult(
            request: request,
            credentials: credentials,
            query: query,
            response: response,
            maxRows: maxRows
        ))
    }

    private func readSavedInsight(request: MarketplaceProviderActionAdapterRequest) throws -> TelemetryDeckProviderActionClientResult {
        let credentials = try credentials(for: request)
        let insightId = try Self.insightId(from: request.payload, credentials: credentials)
        let relativeInterval = try Self.relativeInterval(from: request.payload, defaultDays: 30, maxLookbackDays: 90)
        let generatedQuery = try postJSON(
            path: "/api/v3/insights/\(Self.pathEncode(insightId))/query/",
            body: ["relativeInterval": .object(relativeInterval)],
            credentials: credentials
        )
        let maxRows = Self.clampedInt(request.payload["maxRows"], defaultValue: 50, minValue: 1, maxValue: 100)
        let query = try Self.scopedTQLQuery(
            generatedQuery,
            payload: request.payload,
            credentials: credentials,
            defaultRelativeInterval: relativeInterval
        )
        let response = try postJSON(path: "/api/v4/query/tql", body: query, credentials: credentials)
        return TelemetryDeckProviderActionClientResult(result: Self.tqlResult(
            request: request,
            credentials: credentials,
            query: query,
            response: response,
            maxRows: maxRows
        ).merging([
            "insight": .object([
                "id": .string(insightId),
                "queryType": query["queryType"] ?? .null,
                "generatedQuerySummary": .object(Self.querySummary(query))
            ])
        ]) { _, new in new })
    }

    private func credentials(for request: MarketplaceProviderActionAdapterRequest) throws -> Credentials {
        let connection = try connection(for: request)
        let diagnostics = connection.health.diagnostics
        guard let namespace = diagnostics["namespace"]?.string?.nilIfEmpty else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "telemetrydeck_namespace_missing",
                message: "TelemetryDeck execution requires a saved organization namespace."
            )
        }
        guard let appId = diagnostics["telemetryDeckAppId"]?.string?.nilIfEmpty else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "telemetrydeck_app_id_missing",
                message: "TelemetryDeck execution requires a saved TelemetryDeck app ID."
            )
        }
        return Credentials(
            personalAccessToken: try secret(fieldKey: "telemetrydeck_personal_access_token", connection: connection),
            namespace: namespace,
            appId: appId,
            appDisplayName: diagnostics["appDisplayName"]?.string?.nilIfEmpty,
            defaultInsightId: diagnostics["defaultInsightId"]?.string?.nilIfEmpty
        )
    }

    private func connection(for request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderConnection {
        guard let connectionId = request.auditIdentity.connectionId?.nilIfEmpty,
              let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: connectionId),
              connection.appId == request.app.id,
              connection.appSlug == request.app.slug else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "telemetrydeck_connection_missing",
                message: "TelemetryDeck execution requires a Relay Marketplace provider connection."
            )
        }
        guard connection.status == .connected || connection.status == .healthError else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "telemetrydeck_connection_not_ready",
                message: "The TelemetryDeck provider connection is not ready.",
                detail: ["connectionStatus": .string(connection.status.rawValue)]
            )
        }
        return connection
    }

    private func secret(fieldKey: String, connection: MarketplaceProviderConnection) throws -> String {
        guard let secretId = connection.credentialRequirements.first(where: { $0.fieldKey == fieldKey })?.secretReferenceId else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "telemetrydeck_credentials_missing",
                message: "The TelemetryDeck provider connection is missing a required Keychain PAT reference.",
                detail: ["fieldKey": .string(fieldKey)]
            )
        }
        do {
            return try secrets.getSecretValue(secretId)
        } catch {
            markCredentialUnavailable(fieldKey: fieldKey, connection: connection)
            throw MarketplaceProviderActionAdapterFailure(
                code: "telemetrydeck_credentials_unavailable",
                message: "Relay could not read the saved TelemetryDeck PAT from the OS secret store. Replace the token in Marketplace.",
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
        updated.lastError = "Saved TelemetryDeck PAT is unavailable in the OS secret store. Replace the token in Marketplace."
        updated.health = ProviderConnectorHealth(
            state: .error,
            message: "Saved TelemetryDeck PAT is unavailable in the OS secret store. Replace the token in Marketplace.",
            lastCheckedAt: updated.lastCheckedAt,
            missingScopes: [],
            unavailableTools: ProviderConnectionService.telemetryDeckReadCapabilities,
            diagnostics: [
                "fieldKey": .string(fieldKey),
                "reasonCode": .string("telemetrydeck_credentials_unavailable"),
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

    private func getJSON(path: String, credentials: Credentials) throws -> JSONRecord {
        let response = try httpClient.send(TelemetryDeckProviderHTTPRequest(
            method: "GET",
            url: try Self.telemetryDeckURL(path: path),
            headers: Self.headers(credentials: credentials)
        ))
        return try Self.parseJSONResponse(response)
    }

    private func postJSON(path: String, body: JSONRecord, credentials: Credentials) throws -> JSONRecord {
        let response = try httpClient.send(TelemetryDeckProviderHTTPRequest(
            method: "POST",
            url: try Self.telemetryDeckURL(path: path),
            headers: Self.headers(credentials: credentials).merging(["Content-Type": "application/json"]) { _, new in new },
            body: try jsonEncoder.encode(JSONValue.object(body))
        ))
        return try Self.parseJSONResponse(response)
    }

    private static func baseResult(request: MarketplaceProviderActionAdapterRequest, credentials: Credentials) -> JSONRecord {
        var result: JSONRecord = [
            "adapterBoundary": .string("telemetrydeck-provider-action-adapter"),
            "clientMode": .string("live-telemetrydeck-api"),
            "provider": .string("telemetrydeck"),
            "namespace": .string(credentials.namespace),
            "telemetryDeckAppId": .string(credentials.appId),
            "permission": .string(request.permission.rawValue),
            "payloadHash": .string(MarketplaceProviderActionApprovalService.payloadHash(request.payload)),
            "approved": .bool(request.approvalReference?.status == .approved),
            "idempotencyKey": .string(request.idempotencyKey),
            "fakeAdapter": .bool(false),
            "liveProvider": .bool(true),
            "liveCredentialsUsed": .bool(true),
            "simulated": .bool(false),
            "rawProviderToolExposure": .bool(false),
            "redactionStatus": .string("private-state-excluded")
        ]
        if let appDisplayName = credentials.appDisplayName {
            result["appDisplayName"] = .string(appDisplayName)
        }
        return result
    }

    private static func tqlResult(
        request: MarketplaceProviderActionAdapterRequest,
        credentials: Credentials,
        query: JSONRecord,
        response: JSONRecord,
        maxRows: Int
    ) -> JSONRecord {
        let resultObject = object(response["result"]) ?? [:]
        let extraction = boundedRows(from: resultObject["rows"] ?? response["rows"], maxRows: maxRows)
        var result = Self.baseResult(request: request, credentials: credentials)
        result["actionKey"] = .string(request.definition.actionKey)
        result["queryType"] = query["queryType"] ?? .null
        result["querySummary"] = .object(querySummary(query))
        result["resultType"] = resultObject["type"] ?? response["type"] ?? .null
        result["calculationDuration"] = response["calculationDuration"] ?? .null
        result["calculationFinishedAt"] = response["calculationFinishedAt"] ?? .null
        result["rows"] = .array(extraction.rows)
        result["rowCount"] = .number(Double(extraction.rowCount))
        result["returnedRowCount"] = .number(Double(extraction.returnedRowCount))
        result["truncated"] = .bool(extraction.truncated)
        result["warnings"] = .array([
            .string("TelemetryDeck rows are capped at \(maxRows) for Marketplace runtime context."),
            .string("Relay enforced the saved namespace and app ID before running this read.")
        ])
        return result
    }

    private static func parseJSONResponse(_ response: TelemetryDeckProviderHTTPResponse) throws -> JSONRecord {
        guard (200..<300).contains(response.statusCode) else {
            throw mappedHTTPFailure(response)
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

    private static func mappedHTTPFailure(_ response: TelemetryDeckProviderHTTPResponse) -> MarketplaceProviderActionAdapterFailure {
        let snippet = bodySnippet(response.body)
        switch response.statusCode {
        case 400:
            return MarketplaceProviderActionAdapterFailure(
                code: "telemetrydeck_invalid_request",
                message: "TelemetryDeck rejected the API request parameters.",
                providerStatusCode: response.statusCode,
                detail: ["body": .string(snippet)]
            )
        case 401:
            return MarketplaceProviderActionAdapterFailure(
                code: "telemetrydeck_invalid_pat",
                message: "TelemetryDeck rejected the saved Personal Access Token. Reconnect TelemetryDeck.",
                providerStatusCode: response.statusCode
            )
        case 402:
            return MarketplaceProviderActionAdapterFailure(
                code: "telemetrydeck_paid_plan_required",
                message: "TelemetryDeck API access requires a paid plan.",
                providerStatusCode: response.statusCode
            )
        case 403:
            return MarketplaceProviderActionAdapterFailure(
                code: "telemetrydeck_forbidden",
                message: "TelemetryDeck denied access for the saved PAT, namespace, or app.",
                providerStatusCode: response.statusCode
            )
        case 404:
            return MarketplaceProviderActionAdapterFailure(
                code: "telemetrydeck_not_found",
                message: "TelemetryDeck could not find the requested app, namespace, or saved insight.",
                providerStatusCode: response.statusCode
            )
        case 429:
            return MarketplaceProviderActionAdapterFailure(
                code: "telemetrydeck_rate_limited",
                message: "TelemetryDeck rate-limited the API request.",
                providerStatusCode: response.statusCode
            )
        default:
            return MarketplaceProviderActionAdapterFailure(
                code: "telemetrydeck_http_error",
                message: "TelemetryDeck returned HTTP \(response.statusCode).",
                providerStatusCode: response.statusCode,
                detail: ["body": .string(snippet)]
            )
        }
    }

    fileprivate static func validateBoundedTQLPayload(
        _ payload: JSONRecord,
        credentials: Credentials? = nil
    ) throws -> JSONRecord {
        guard case .object(let rawQuery)? = payload["query"] else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "telemetrydeck_missing_query",
                message: "TelemetryDeck bounded TQL reads require a query object."
            )
        }
        if let credentials {
            return try scopedTQLQuery(rawQuery, payload: payload, credentials: credentials)
        }
        _ = try queryType(rawQuery)
        try validateNoRawScan(rawQuery)
        return rawQuery
    }

    private static func scopedTQLQuery(
        _ rawQuery: JSONRecord,
        payload: JSONRecord,
        credentials: Credentials,
        defaultRelativeInterval: JSONRecord? = nil
    ) throws -> JSONRecord {
        var query = rawQuery
        let type = try queryType(query)
        guard type != "scan" else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "telemetrydeck_scan_query_blocked",
                message: "TelemetryDeck scan queries are blocked in V1 because they can expose raw event rows."
            )
        }
        try validateNoRawScan(query)
        if let dataSource = query["dataSource"]?.string?.nilIfEmpty {
            guard dataSource == credentials.namespace else {
                throw MarketplaceProviderActionAdapterFailure(
                    code: "telemetrydeck_namespace_mismatch",
                    message: "TelemetryDeck query dataSource must match the saved connection namespace."
                )
            }
        } else {
            query["dataSource"] = .string(credentials.namespace)
        }
        let maxLookbackDays = clampedInt(payload["maxLookbackDays"], defaultValue: 90, minValue: 1, maxValue: 90)
        if query["relativeIntervals"] == nil {
            let interval: JSONRecord
            if let defaultRelativeInterval {
                interval = defaultRelativeInterval
            } else {
                interval = try relativeInterval(from: payload, defaultDays: 30, maxLookbackDays: maxLookbackDays)
            }
            query["relativeIntervals"] = .array([.object(interval)])
        }
        try validateRelativeIntervals(query["relativeIntervals"], maxLookbackDays: maxLookbackDays)
        let maxRows = clampedInt(payload["maxRows"], defaultValue: 50, minValue: 1, maxValue: 100)
        if let threshold = intValue(query["threshold"]) {
            query["threshold"] = .number(Double(min(max(threshold, 1), maxRows)))
        } else {
            query["threshold"] = .number(Double(maxRows))
        }
        query["filter"] = try scopedFilter(query["filter"], appId: credentials.appId)
        return query
    }

    private static func queryType(_ query: JSONRecord) throws -> String {
        guard let rawType = query["queryType"]?.string?.nilIfEmpty?.lowercased() else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "telemetrydeck_query_type_required",
                message: "TelemetryDeck bounded TQL reads require queryType."
            )
        }
        let allowed = Set(["timeseries", "topn", "groupby", "funnel", "retention"])
        guard allowed.contains(rawType) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "telemetrydeck_query_type_blocked",
                message: "TelemetryDeck V1 allows only bounded timeseries, topN, groupBy, funnel, and retention queries.",
                detail: ["queryType": .string(rawType)]
            )
        }
        return rawType
    }

    private static func validateNoRawScan(_ value: JSONValue) throws {
        switch value {
        case .string(let string):
            let lower = string.lowercased()
            if lower.contains("\"querytype\":\"scan\"") || lower == "scan" || lower.contains("raw scan") {
                throw MarketplaceProviderActionAdapterFailure(
                    code: "telemetrydeck_raw_scan_blocked",
                    message: "TelemetryDeck raw scan queries are blocked in V1."
                )
            }
        case .object(let object):
            try validateNoRawScan(object)
        case .array(let values):
            for value in values {
                try validateNoRawScan(value)
            }
        case .number, .bool, .null:
            break
        }
    }

    private static func validateNoRawScan(_ record: JSONRecord) throws {
        for (key, value) in record {
            if key.lowercased().contains("scan") {
                throw MarketplaceProviderActionAdapterFailure(
                    code: "telemetrydeck_raw_scan_blocked",
                    message: "TelemetryDeck raw scan queries are blocked in V1."
                )
            }
            try validateNoRawScan(value)
        }
    }

    private static func scopedFilter(_ filter: JSONValue?, appId: String) throws -> JSONValue {
        if let existingAppId = selectorValue(in: filter, dimension: "appID"),
           existingAppId != appId {
            throw MarketplaceProviderActionAdapterFailure(
                code: "telemetrydeck_app_id_mismatch",
                message: "TelemetryDeck query appID filter must match the saved selected app ID."
            )
        }
        if let testMode = selectorValue(in: filter, dimension: "isTestMode"),
           testMode.lowercased() != "false" {
            throw MarketplaceProviderActionAdapterFailure(
                code: "telemetrydeck_test_mode_blocked",
                message: "TelemetryDeck V1 queries default to production data; test-mode reads are deferred."
            )
        }
        let required: [JSONValue] = [
            .object(["dimension": .string("appID"), "type": .string("selector"), "value": .string(appId)]),
            .object(["dimension": .string("isTestMode"), "type": .string("selector"), "value": .string("false")])
        ]
        guard let filter else {
            return .object(["type": .string("and"), "fields": .array(required)])
        }
        guard case .object(var object) = filter else {
            return .object(["type": .string("and"), "fields": .array([filter] + required)])
        }
        if object["type"]?.string?.lowercased() == "and" {
            var fields = array(object["fields"])
            if selectorValue(in: .object(object), dimension: "appID") == nil {
                fields.append(required[0])
            }
            if selectorValue(in: .object(object), dimension: "isTestMode") == nil {
                fields.append(required[1])
            }
            object["fields"] = .array(fields)
            return .object(object)
        }
        return .object(["type": .string("and"), "fields": .array([.object(object)] + required)])
    }

    private static func selectorValue(in value: JSONValue?, dimension: String) -> String? {
        guard let value else { return nil }
        switch value {
        case .object(let object):
            if object["dimension"]?.string == dimension,
               object["type"]?.string?.lowercased() == "selector" {
                return object["value"]?.string
            }
            for child in object.values {
                if let found = selectorValue(in: child, dimension: dimension) {
                    return found
                }
            }
            return nil
        case .array(let values):
            for child in values {
                if let found = selectorValue(in: child, dimension: dimension) {
                    return found
                }
            }
            return nil
        case .string, .number, .bool, .null:
            return nil
        }
    }

    private static func relativeInterval(
        from payload: JSONRecord,
        defaultDays: Int,
        maxLookbackDays: Int
    ) throws -> JSONRecord {
        if case .object(let interval)? = payload["relativeInterval"] {
            try validateRelativeInterval(interval, maxLookbackDays: maxLookbackDays)
            return interval
        }
        let days = clampedInt(payload["relativeDays"], defaultValue: defaultDays, minValue: 1, maxValue: maxLookbackDays)
        return [
            "beginningDate": .object([
                "component": .string("day"),
                "offset": .number(Double(-days)),
                "position": .string("beginning")
            ]),
            "endDate": .object([
                "component": .string("day"),
                "offset": .number(0),
                "position": .string("end")
            ])
        ]
    }

    private static func validateRelativeIntervals(_ value: JSONValue?, maxLookbackDays: Int) throws {
        guard case .array(let intervals)? = value, !intervals.isEmpty else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "telemetrydeck_relative_interval_required",
                message: "TelemetryDeck bounded reads require a relative interval."
            )
        }
        for interval in intervals {
            guard case .object(let record) = interval else {
                throw MarketplaceProviderActionAdapterFailure(
                    code: "telemetrydeck_invalid_relative_interval",
                    message: "TelemetryDeck relative intervals must be objects."
                )
            }
            try validateRelativeInterval(record, maxLookbackDays: maxLookbackDays)
        }
    }

    private static func validateRelativeInterval(_ interval: JSONRecord, maxLookbackDays: Int) throws {
        guard let beginning = object(interval["beginningDate"]),
              let end = object(interval["endDate"]),
              let beginningOffset = intValue(beginning["offset"]),
              let endOffset = intValue(end["offset"]) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "telemetrydeck_invalid_relative_interval",
                message: "TelemetryDeck relative intervals require beginningDate and endDate offsets."
            )
        }
        guard beginningOffset >= -maxLookbackDays, beginningOffset <= 0, endOffset <= 0 else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "telemetrydeck_lookback_exceeds_budget",
                message: "TelemetryDeck V1 queries are capped at 90 days of lookback."
            )
        }
    }

    private static func insightId(from payload: JSONRecord, credentials: Credentials) throws -> String {
        if let insightId = payload["insightId"]?.string?.nilIfEmpty ?? credentials.defaultInsightId {
            return insightId
        }
        throw MarketplaceProviderActionAdapterFailure(
            code: "telemetrydeck_insight_id_required",
            message: "TelemetryDeck saved insight reads require an insight ID or a saved default insight ID."
        )
    }

    private static func boundedRows(from value: JSONValue?, maxRows: Int) -> (rows: [JSONValue], rowCount: Int, returnedRowCount: Int, truncated: Bool) {
        let rows = array(value)
        var output: [JSONValue] = []
        var remaining = maxRows
        var sourceCount = 0
        var returnedCount = 0
        var truncated = false
        for row in rows {
            if case .object(var object) = row,
               case .array(let nested)? = object["result"] {
                sourceCount += nested.count
                if remaining > 0 {
                    let returnedNested = Array(nested.prefix(remaining)).map(sanitized)
                    returnedCount += returnedNested.count
                    remaining -= returnedNested.count
                    truncated = truncated || nested.count > returnedNested.count
                    object["result"] = .array(returnedNested)
                    output.append(sanitized(.object(object)))
                } else if !nested.isEmpty {
                    truncated = true
                }
            } else {
                sourceCount += 1
                if remaining > 0 {
                    returnedCount += 1
                    remaining -= 1
                    output.append(sanitized(row))
                } else {
                    truncated = true
                }
            }
        }
        return (output, sourceCount, returnedCount, truncated || sourceCount > returnedCount)
    }

    private static func querySummary(_ query: JSONRecord) -> JSONRecord {
        var summary: JSONRecord = [:]
        for key in ["queryType", "dataSource", "granularity", "threshold"] {
            if let value = query[key] {
                summary[key] = value
            }
        }
        if let dimension = query["dimension"] {
            summary["dimension"] = sanitized(dimension)
        }
        if let metric = query["metric"] {
            summary["metric"] = sanitized(metric)
        }
        if let aggregations = query["aggregations"] {
            summary["aggregations"] = sanitized(aggregations)
        }
        if let relativeIntervals = query["relativeIntervals"] {
            summary["relativeIntervals"] = sanitized(relativeIntervals)
        }
        return summary
    }

    private static func telemetryDeckURL(path: String) throws -> URL {
        var components = URLComponents()
        components.scheme = "https"
        components.host = "api.telemetrydeckapi.com"
        components.path = path
        guard let url = components.url else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "telemetrydeck_invalid_url",
                message: "Could not build the TelemetryDeck API URL."
            )
        }
        return url
    }

    private static func headers(credentials: Credentials) -> [String: String] {
        [
            "Authorization": "Bearer \(credentials.personalAccessToken)",
            "Accept": "application/json"
        ]
    }

    private static func selectedObject(_ record: JSONRecord, keys: [String]) -> JSONRecord {
        var output: JSONRecord = [:]
        for key in keys {
            if let value = record[key], value != .null {
                output[key] = sanitized(value)
            }
        }
        return output
    }

    private static func sanitized(_ value: JSONValue) -> JSONValue {
        switch value {
        case .string(let string):
            return .string(string.count > 1200 ? String(string.prefix(1197)) + "..." : string)
        case .array(let values):
            return .array(values.map(sanitized))
        case .object(let object):
            return .object(object.reduce(into: JSONRecord()) { output, pair in
                output[pair.key] = sanitized(pair.value)
            })
        case .number, .bool, .null:
            return value
        }
    }

    private static func object(_ value: JSONValue?) -> JSONRecord? {
        guard case .object(let object)? = value else { return nil }
        return object
    }

    private static func array(_ value: JSONValue?) -> [JSONValue] {
        guard case .array(let values)? = value else { return [] }
        return values
    }

    private static func intValue(_ value: JSONValue?) -> Int? {
        if let number = value?.number {
            return Int(number)
        }
        if let string = value?.string?.trimmingCharacters(in: .whitespacesAndNewlines), let int = Int(string) {
            return int
        }
        return nil
    }

    private static func clampedInt(_ value: JSONValue?, defaultValue: Int, minValue: Int, maxValue: Int) -> Int {
        let candidate = intValue(value) ?? defaultValue
        return min(max(candidate, minValue), maxValue)
    }

    private static func pathEncode(_ value: String) -> String {
        var allowed = CharacterSet.urlPathAllowed
        allowed.remove(charactersIn: "/?#[]@!$&'()*+,;=")
        return value.addingPercentEncoding(withAllowedCharacters: allowed) ?? value
    }

    private static func bodySnippet(_ data: Data, limit: Int = 400) -> String {
        guard let text = String(data: data, encoding: .utf8) else { return "" }
        if text.count <= limit { return text }
        return String(text.prefix(limit))
    }
}

public struct TelemetryDeckProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowlistedActionKeys: Set<String> = [
        "telemetrydeck_user_info_read",
        "telemetrydeck_tql_query_read",
        "telemetrydeck_saved_insight_read"
    ]

    private let client: any TelemetryDeckProviderActionClient

    public init(client: any TelemetryDeckProviderActionClient = FakeTelemetryDeckProviderActionClient()) {
        self.client = client
    }

    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "telemetrydeck" else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "telemetrydeck_adapter_wrong_provider",
                message: "TelemetryDeck adapter can only execute TelemetryDeck provider actions."
            )
        }
        guard Self.allowlistedActionKeys.contains(request.definition.actionKey) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "telemetrydeck_action_not_allowlisted",
                message: "The requested TelemetryDeck action is not in the V1 read-only adapter allowlist."
            )
        }
        if request.definition.actionKey == "telemetrydeck_tql_query_read" {
            _ = try Self.validateBoundedTQLPayload(request.payload)
        }
        let output = try client.executeTelemetryDeckAction(request: request)
        return MarketplaceProviderActionAdapterResult(
            result: output.result,
            error: nil,
            redactionStatus: output.redactionStatus
        )
    }

    public static func validateBoundedTQLPayload(_ payload: JSONRecord) throws -> JSONRecord {
        try LiveTelemetryDeckProviderActionClient.validateBoundedTQLPayload(payload)
    }
}

private extension String {
    var nilIfEmpty: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}
