import Foundation

public struct MicrosoftClarityProviderHTTPRequest: Sendable, Equatable {
    public var method: String
    public var url: URL
    public var headers: [String: String]

    public init(method: String, url: URL, headers: [String: String] = [:]) {
        self.method = method
        self.url = url
        self.headers = headers
    }
}

public struct MicrosoftClarityProviderHTTPResponse: Sendable, Equatable {
    public var statusCode: Int
    public var body: Data

    public init(statusCode: Int, body: Data = Data()) {
        self.statusCode = statusCode
        self.body = body
    }
}

public protocol MicrosoftClarityProviderHTTPClient: Sendable {
    func send(_ request: MicrosoftClarityProviderHTTPRequest) throws -> MicrosoftClarityProviderHTTPResponse
}

public struct URLSessionMicrosoftClarityProviderHTTPClient: MicrosoftClarityProviderHTTPClient {
    private let timeoutSeconds: TimeInterval

    public init(timeoutSeconds: TimeInterval = 15) {
        self.timeoutSeconds = timeoutSeconds
    }

    public func send(_ request: MicrosoftClarityProviderHTTPRequest) throws -> MicrosoftClarityProviderHTTPResponse {
        var urlRequest = URLRequest(url: request.url)
        urlRequest.httpMethod = request.method
        urlRequest.timeoutInterval = timeoutSeconds
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
                code: "microsoft_clarity_http_timeout",
                message: "Microsoft Clarity Data Export API request timed out.",
                detail: ["urlHost": .string(request.url.host ?? "www.clarity.ms")]
            )
        }
        if let responseError {
            throw responseError
        }
        return MicrosoftClarityProviderHTTPResponse(statusCode: responseStatusCode ?? 0, body: responseData ?? Data())
    }
}

public final class MicrosoftClarityProviderActionAdapter: MarketplaceProviderActionAdapter, @unchecked Sendable {
    private struct LiveInsightsPayload {
        var numOfDays: Int
        var dimensions: [String]
        var maxRowsPerMetric: Int
        var redactUrls: Bool
    }

    private let data: LocalDataService?
    private let secrets: SecretService?
    private let httpClient: any MicrosoftClarityProviderHTTPClient

    public init(
        data: LocalDataService? = nil,
        secrets: SecretService? = nil,
        httpClient: any MicrosoftClarityProviderHTTPClient = URLSessionMicrosoftClarityProviderHTTPClient()
    ) {
        self.data = data
        self.secrets = secrets
        self.httpClient = httpClient
    }

    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "microsoft-clarity" else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "microsoft_clarity_wrong_provider",
                message: "Microsoft Clarity adapter received a request for another provider.",
                detail: ["appSlug": .string(request.app.slug)]
            )
        }
        guard request.definition.actionKey == "microsoft_clarity_get_project_live_insights" else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "microsoft_clarity_action_not_implemented",
                message: "Microsoft Clarity V1 supports only the project live-insights read action.",
                detail: ["actionKey": .string(request.definition.actionKey)]
            )
        }
        let payload = try Self.liveInsightsPayload(from: request.payload)
        let connection = try connection(for: request)
        let token = try secret(fieldKey: "microsoft_clarity_api_token", connection: connection)
        let response = try httpClient.send(MicrosoftClarityProviderHTTPRequest(
            method: "GET",
            url: try Self.liveInsightsURL(payload: payload),
            headers: [
                "Authorization": "Bearer \(token)",
                "Accept": "application/json",
                "Content-Type": "application/json"
            ]
        ))
        let parsed = try Self.parseResponse(response, payload: payload)
        return MarketplaceProviderActionAdapterResult(result: parsed)
    }

    private func connection(for request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderConnection {
        guard let data else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "microsoft_clarity_live_adapter_missing",
                message: "Not executed against Microsoft Clarity: live Data Export API execution is not configured in this runtime.",
                detail: [
                    "provider": .string("microsoft-clarity"),
                    "liveAdapterMissing": .bool(true)
                ]
            )
        }
        guard let connectionId = request.auditIdentity.connectionId?.trimmedNonEmpty,
              let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: connectionId),
              connection.appId == request.app.id,
              connection.appSlug == request.app.slug else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "microsoft_clarity_connection_missing",
                message: "Microsoft Clarity live-insights execution requires a Relay Marketplace provider connection."
            )
        }
        guard connection.status == .connected || connection.status == .healthError else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "microsoft_clarity_connection_not_ready",
                message: "The Microsoft Clarity provider connection is not ready.",
                detail: ["connectionStatus": .string(connection.status.rawValue)]
            )
        }
        return connection
    }

    private func secret(fieldKey: String, connection: MarketplaceProviderConnection) throws -> String {
        guard let secrets else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "microsoft_clarity_live_adapter_missing",
                message: "Not executed against Microsoft Clarity: secret store access is not configured in this runtime.",
                detail: ["provider": .string("microsoft-clarity")]
            )
        }
        guard let secretId = connection.credentialRequirements.first(where: { $0.fieldKey == fieldKey })?.secretReferenceId
            ?? connection.secretReferenceIds.first else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "microsoft_clarity_credentials_missing",
                message: "The Microsoft Clarity provider connection is missing a required Keychain secret reference.",
                detail: ["fieldKey": .string(fieldKey)]
            )
        }
        do {
            return try secrets.getSecretValue(secretId)
        } catch {
            markCredentialUnavailable(connection: connection)
            throw MarketplaceProviderActionAdapterFailure(
                code: "microsoft_clarity_credentials_unavailable",
                message: "Relay could not read the saved Microsoft Clarity credential from the OS secret store. Reconnect Microsoft Clarity in Marketplace.",
                detail: ["fieldKey": .string(fieldKey)]
            )
        }
    }

    private func markCredentialUnavailable(connection: MarketplaceProviderConnection) {
        guard let data else { return }
        var updated = connection
        updated.status = .healthError
        updated.authorizationState = .error
        updated.reauthorizeRequired = true
        updated.lastCheckedAt = nowIso()
        updated.lastError = "Saved Microsoft Clarity credential is unavailable in the OS secret store. Reconnect Microsoft Clarity in Marketplace."
        updated.health = ProviderConnectorHealth(
            state: .error,
            message: updated.lastError ?? "Saved Microsoft Clarity credential is unavailable.",
            lastCheckedAt: updated.lastCheckedAt,
            missingScopes: [],
            unavailableTools: ["microsoft_clarity_get_project_live_insights"],
            diagnostics: [
                "reasonCode": .string("microsoft_clarity_credentials_unavailable"),
                "redactionStatus": .string("private-state-excluded")
            ],
            redactionStatus: "private-state-excluded"
        )
        updated.credentialRequirements = updated.credentialRequirements.map { requirement in
            var copy = requirement
            if copy.fieldKey == "microsoft_clarity_api_token" {
                copy.status = .unavailable
            }
            return copy
        }
        _ = try? data.saveProviderConnection(updated)
    }

    private static func liveInsightsPayload(from record: JSONRecord) throws -> LiveInsightsPayload {
        let numOfDays = intValue(record["numOfDays"]) ?? intValue(record["num_of_days"]) ?? 1
        guard (1...3).contains(numOfDays) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "microsoft_clarity_invalid_day_window",
                message: "Microsoft Clarity Data Export API supports numOfDays values of 1, 2, or 3.",
                detail: ["numOfDays": .number(Double(numOfDays))]
            )
        }
        let dimensions = try normalizedDimensions(from: record)
        let maxRows = min(max(intValue(record["maxRowsPerMetric"]) ?? intValue(record["max_rows_per_metric"]) ?? 25, 1), 100)
        let redactUrls = boolValue(record["redactUrls"]) ?? boolValue(record["redact_urls"]) ?? true
        return LiveInsightsPayload(
            numOfDays: numOfDays,
            dimensions: dimensions.isEmpty ? ["OS"] : dimensions,
            maxRowsPerMetric: maxRows,
            redactUrls: redactUrls
        )
    }

    private static func normalizedDimensions(from record: JSONRecord) throws -> [String] {
        var raw: [String] = []
        if case .array(let values)? = record["dimensions"] {
            raw.append(contentsOf: values.compactMap { $0.string?.trimmedNonEmpty })
        }
        for key in ["dimension1", "dimension2", "dimension3"] {
            if let value = record[key]?.string?.trimmedNonEmpty {
                raw.append(value)
            }
        }
        let unique = raw.reduce(into: [String]()) { output, value in
            let normalized = canonicalDimension(value)
            if !output.contains(normalized) {
                output.append(normalized)
            }
        }
        guard unique.count <= 3 else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "microsoft_clarity_too_many_dimensions",
                message: "Microsoft Clarity Data Export API supports at most three dimensions per request.",
                detail: ["dimensionCount": .number(Double(unique.count))]
            )
        }
        let unsupported = unique.filter { !allowedDimensions.contains($0) }
        guard unsupported.isEmpty else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "microsoft_clarity_invalid_dimension",
                message: "Microsoft Clarity Data Export API does not support one or more requested dimensions.",
                detail: ["unsupportedDimensions": .array(unsupported.map(JSONValue.string))]
            )
        }
        return unique
    }

    private static func liveInsightsURL(payload: LiveInsightsPayload) throws -> URL {
        guard var components = URLComponents(string: "https://www.clarity.ms/export-data/api/v1/project-live-insights") else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "microsoft_clarity_url_unavailable",
                message: "Microsoft Clarity Data Export API URL could not be built."
            )
        }
        var items = [URLQueryItem(name: "numOfDays", value: String(payload.numOfDays))]
        for (index, dimension) in payload.dimensions.enumerated() {
            items.append(URLQueryItem(name: "dimension\(index + 1)", value: dimension))
        }
        components.queryItems = items
        guard let url = components.url else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "microsoft_clarity_url_unavailable",
                message: "Microsoft Clarity Data Export API URL could not be built."
            )
        }
        return url
    }

    private static func parseResponse(
        _ response: MicrosoftClarityProviderHTTPResponse,
        payload: LiveInsightsPayload
    ) throws -> JSONRecord {
        guard (200..<300).contains(response.statusCode) else {
            throw mappedHTTPFailure(response)
        }
        guard !response.body.isEmpty,
              let json = try? JSONSerialization.jsonObject(with: response.body) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "microsoft_clarity_invalid_json",
                message: "Microsoft Clarity returned an empty or unreadable JSON response.",
                providerStatusCode: response.statusCode
            )
        }
        let extraction = metricGroups(from: json, payload: payload)
        return [
            "clientMode": .string("live-microsoft-clarity-data-export-api"),
            "provider": .string("microsoft-clarity"),
            "actionKey": .string("microsoft_clarity_get_project_live_insights"),
            "liveProvider": .bool(true),
            "fakeAdapter": .bool(false),
            "simulated": .bool(false),
            "dayWindow": .number(Double(payload.numOfDays)),
            "dimensions": .array(payload.dimensions.map(JSONValue.string)),
            "metricGroups": .array(extraction.groups),
            "metricGroupCount": .number(Double(extraction.groups.count)),
            "rowCount": .number(Double(extraction.rowCount)),
            "returnedRowCount": .number(Double(extraction.returnedRowCount)),
            "truncated": .bool(extraction.truncated),
            "redactUrls": .bool(payload.redactUrls),
            "quotaWarning": .string("This live read may consume one of the 10 Microsoft Clarity Data Export API requests per project per day."),
            "redactionStatus": .string("private-state-excluded")
        ]
    }

    private static func mappedHTTPFailure(_ response: MicrosoftClarityProviderHTTPResponse) -> MarketplaceProviderActionAdapterFailure {
        let snippet = bodySnippet(response.body)
        switch response.statusCode {
        case 400:
            return MarketplaceProviderActionAdapterFailure(
                code: "microsoft_clarity_invalid_request",
                message: "Microsoft Clarity rejected the live-insights request parameters.",
                providerStatusCode: response.statusCode,
                detail: ["body": .string(snippet)]
            )
        case 401:
            return MarketplaceProviderActionAdapterFailure(
                code: "microsoft_clarity_invalid_token",
                message: "Microsoft Clarity rejected the saved Data Export API token. Reconnect Microsoft Clarity.",
                providerStatusCode: response.statusCode
            )
        case 403:
            return MarketplaceProviderActionAdapterFailure(
                code: "microsoft_clarity_unauthorized",
                message: "Microsoft Clarity token is not authorized for the Data Export API operation.",
                providerStatusCode: response.statusCode
            )
        case 429:
            return MarketplaceProviderActionAdapterFailure(
                code: "microsoft_clarity_quota_exceeded",
                message: "Microsoft Clarity daily Data Export API quota is exhausted for this project.",
                providerStatusCode: response.statusCode,
                detail: ["quota": .string("10 requests/project/day")]
            )
        default:
            return MarketplaceProviderActionAdapterFailure(
                code: "microsoft_clarity_http_error",
                message: "Microsoft Clarity returned HTTP \(response.statusCode).",
                providerStatusCode: response.statusCode,
                detail: ["body": .string(snippet)]
            )
        }
    }

    private static func metricGroups(
        from json: Any,
        payload: LiveInsightsPayload
    ) -> (groups: [JSONValue], rowCount: Int, returnedRowCount: Int, truncated: Bool) {
        let rawGroups: [Any]
        if let array = json as? [Any] {
            rawGroups = array
        } else if let object = json as? [String: Any],
                  let data = object["data"] as? [Any] {
            rawGroups = data
        } else {
            rawGroups = [json]
        }
        var rowCount = 0
        var returnedRowCount = 0
        var truncated = false
        let groups = rawGroups.map { group -> JSONValue in
            let trimmed = truncateInformationRows(group, maxRowsPerMetric: payload.maxRowsPerMetric)
            rowCount += trimmed.rowCount
            returnedRowCount += trimmed.returnedRowCount
            truncated = truncated || trimmed.truncated
            return sanitize(value: jsonValue(from: trimmed.value), currentKey: nil, redactUrls: payload.redactUrls)
        }
        return (groups, rowCount, returnedRowCount, truncated)
    }

    private static func truncateInformationRows(
        _ value: Any,
        maxRowsPerMetric: Int
    ) -> (value: Any, rowCount: Int, returnedRowCount: Int, truncated: Bool) {
        guard var object = value as? [String: Any],
              let information = object["information"] as? [Any] else {
            return (value, 0, 0, false)
        }
        let returned = Array(information.prefix(maxRowsPerMetric))
        object["information"] = returned
        return (object, information.count, returned.count, information.count > returned.count)
    }

    private static func sanitize(value: JSONValue, currentKey: String?, redactUrls: Bool) -> JSONValue {
        switch value {
        case .string(let string):
            return .string(sanitize(string: string, key: currentKey, redactUrls: redactUrls))
        case .array(let array):
            return .array(array.map { sanitize(value: $0, currentKey: currentKey, redactUrls: redactUrls) })
        case .object(let object):
            return .object(object.reduce(into: JSONRecord()) { output, pair in
                output[pair.key] = sanitize(value: pair.value, currentKey: pair.key, redactUrls: redactUrls)
            })
        case .number, .bool, .null:
            return value
        }
    }

    private static func sanitize(string: String, key: String?, redactUrls: Bool) -> String {
        let keyLooksURL = key?.lowercased().contains("url") == true || key?.lowercased().contains("referrer") == true
        if redactUrls, (keyLooksURL || string.lowercased().hasPrefix("http://") || string.lowercased().hasPrefix("https://")),
           let url = URL(string: string),
           let host = url.host {
            var output = "\(url.scheme ?? "https")://\(host)\(url.path)"
            if output.count > 160 {
                output = String(output.prefix(157)) + "..."
            }
            return output
        }
        if string.count > 1200 {
            return String(string.prefix(1197)) + "..."
        }
        return string
    }

    private static func jsonValue(from value: Any) -> JSONValue {
        if value is NSNull { return .null }
        if let bool = value as? Bool { return .bool(bool) }
        if let number = value as? NSNumber { return .number(number.doubleValue) }
        if let string = value as? String { return .string(string) }
        if let array = value as? [Any] { return .array(array.map(jsonValue(from:))) }
        if let object = value as? [String: Any] {
            return .object(object.reduce(into: JSONRecord()) { output, pair in
                output[pair.key] = jsonValue(from: pair.value)
            })
        }
        return .string(String(describing: value))
    }

    private static func intValue(_ value: JSONValue?) -> Int? {
        if let number = value?.number {
            return Int(number)
        }
        if let string = value?.string?.trimmedNonEmpty {
            return Int(string)
        }
        return nil
    }

    private static func boolValue(_ value: JSONValue?) -> Bool? {
        if let bool = value?.bool {
            return bool
        }
        if let string = value?.string?.trimmedNonEmpty?.lowercased() {
            if ["true", "yes", "1"].contains(string) { return true }
            if ["false", "no", "0"].contains(string) { return false }
        }
        return nil
    }

    private static func canonicalDimension(_ value: String) -> String {
        let normalized = value.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        switch normalized {
        case "browser":
            return "Browser"
        case "device":
            return "Device"
        case "country/region", "country", "region":
            return "Country/Region"
        case "os", "operating system", "operating_system":
            return "OS"
        case "source":
            return "Source"
        case "medium":
            return "Medium"
        case "campaign":
            return "Campaign"
        case "channel":
            return "Channel"
        case "url":
            return "URL"
        default:
            return value.trimmingCharacters(in: .whitespacesAndNewlines)
        }
    }

    private static let allowedDimensions = Set([
        "Browser",
        "Device",
        "Country/Region",
        "OS",
        "Source",
        "Medium",
        "Campaign",
        "Channel",
        "URL"
    ])

    private static func bodySnippet(_ data: Data) -> String {
        guard !data.isEmpty else { return "" }
        let raw = String(data: data, encoding: .utf8) ?? "<non-utf8 response>"
        return raw.count > 500 ? String(raw.prefix(500)) + "..." : raw
    }
}

private extension String {
    var trimmedNonEmpty: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}
