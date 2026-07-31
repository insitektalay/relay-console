import Foundation

public struct GoogleSearchConsoleProviderActionClientResult: Codable, Equatable, Sendable {
    public var result: JSONRecord
    public var redactionStatus: String

    public init(result: JSONRecord, redactionStatus: String = "private-state-excluded") {
        self.result = result
        self.redactionStatus = redactionStatus
    }
}

public protocol GoogleSearchConsoleProviderActionClient: Sendable {
    func executeGoogleSearchConsoleAction(request: MarketplaceProviderActionAdapterRequest) throws -> GoogleSearchConsoleProviderActionClientResult
}

public struct GoogleSearchConsoleProviderHTTPRequest: Sendable, Equatable {
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

public struct GoogleSearchConsoleProviderHTTPResponse: Sendable, Equatable {
    public var statusCode: Int
    public var body: Data

    public init(statusCode: Int, body: Data = Data()) {
        self.statusCode = statusCode
        self.body = body
    }
}

public protocol GoogleSearchConsoleProviderHTTPClient: Sendable {
    func send(_ request: GoogleSearchConsoleProviderHTTPRequest) throws -> GoogleSearchConsoleProviderHTTPResponse
}

public struct URLSessionGoogleSearchConsoleProviderHTTPClient: GoogleSearchConsoleProviderHTTPClient {
    private let timeoutSeconds: TimeInterval

    public init(timeoutSeconds: TimeInterval = 20) {
        self.timeoutSeconds = timeoutSeconds
    }

    public func send(_ request: GoogleSearchConsoleProviderHTTPRequest) throws -> GoogleSearchConsoleProviderHTTPResponse {
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
                code: "google_search_console_http_timeout",
                message: "Google Search Console API request timed out.",
                detail: ["urlHost": .string(request.url.host ?? "searchconsole.googleapis.com")]
            )
        }
        if let responseError {
            throw responseError
        }
        return GoogleSearchConsoleProviderHTTPResponse(statusCode: responseStatusCode ?? 0, body: responseData ?? Data())
    }
}

public struct MissingGoogleSearchConsoleProviderActionClient: GoogleSearchConsoleProviderActionClient {
    public init() {}

    public func executeGoogleSearchConsoleAction(request: MarketplaceProviderActionAdapterRequest) throws -> GoogleSearchConsoleProviderActionClientResult {
        throw MarketplaceProviderActionAdapterFailure(
            code: "google_search_console_live_adapter_missing",
            message: "Not executed against Google Search Console: live Google Search Console API execution is not configured in this runtime.",
            detail: [
                "actionKey": .string(request.definition.actionKey),
                "liveAdapterMissing": .bool(true),
                "provider": .string("google-search-console")
            ]
        )
    }
}

public struct FakeGoogleSearchConsoleProviderActionClient: GoogleSearchConsoleProviderActionClient {
    private let failureByActionKey: [String: MarketplaceProviderActionAdapterFailure]

    public init(failureByActionKey: [String: MarketplaceProviderActionAdapterFailure] = [:]) {
        self.failureByActionKey = failureByActionKey
    }

    public func executeGoogleSearchConsoleAction(request: MarketplaceProviderActionAdapterRequest) throws -> GoogleSearchConsoleProviderActionClientResult {
        if let failure = failureByActionKey[request.definition.actionKey] {
            throw failure
        }
        let siteUrl = GoogleSearchConsoleProviderActionAdapterSupport.siteUrl(from: request.payload)
        switch request.definition.actionKey {
        case "google_search_console_properties_list":
            let maxResults = GoogleSearchConsoleProviderActionAdapterSupport.boundedInt(request.payload["maxResults"], defaultValue: 25, minValue: 1, maxValue: 25)
            let properties: [JSONValue] = [
                .object(GoogleSearchConsoleProviderActionAdapterSupport.property(
                    siteUrl: siteUrl,
                    permissionLevel: "siteOwner",
                    accountLabel: "Fake Search Console account",
                    selected: true
                )),
                .object(GoogleSearchConsoleProviderActionAdapterSupport.property(
                    siteUrl: "sc-domain:example.org",
                    permissionLevel: "siteRestrictedUser",
                    accountLabel: "Fake Search Console account",
                    selected: false
                ))
            ]
            return GoogleSearchConsoleProviderActionClientResult(result: GoogleSearchConsoleProviderActionAdapterSupport.baseResult(
                request: request,
                clientMode: "fake-google-search-console-client",
                fakeAdapter: true,
                liveCredentialsUsed: false
            ).merging([
                "semanticReadContract": .string("google-search-console-properties-v1"),
                "properties": .array(Array(properties.prefix(maxResults))),
                "propertyCount": .number(Double(properties.count)),
                "maxResults": .number(Double(maxResults)),
                "truncated": .bool(properties.count > maxResults)
            ]) { _, new in new })

        case "google_search_console_property_get":
            return GoogleSearchConsoleProviderActionClientResult(result: GoogleSearchConsoleProviderActionAdapterSupport.baseResult(
                request: request,
                clientMode: "fake-google-search-console-client",
                fakeAdapter: true,
                liveCredentialsUsed: false
            ).merging([
                "semanticReadContract": .string("google-search-console-property-v1"),
                "property": .object(GoogleSearchConsoleProviderActionAdapterSupport.property(
                    siteUrl: siteUrl,
                    permissionLevel: "siteOwner",
                    accountLabel: "Fake Search Console account",
                    selected: true
                ).merging(["accessStatus": .string("accessible")]) { _, new in new })
            ]) { _, new in new })

        case "google_search_console_search_analytics_query":
            let dimensions = GoogleSearchConsoleProviderActionAdapterSupport.dimensions(from: request.payload)
            let rowLimit = GoogleSearchConsoleProviderActionAdapterSupport.boundedInt(request.payload["rowLimit"], defaultValue: 10, minValue: 1, maxValue: 25)
            let dateRange = GoogleSearchConsoleProviderActionAdapterSupport.dateRange(from: request.payload)
            let rows: [JSONValue] = [
                .object(GoogleSearchConsoleProviderActionAdapterSupport.searchAnalyticsRow(
                    dimensions: dimensions,
                    keys: ["relay console", "/"],
                    clicks: 42,
                    impressions: 840,
                    ctr: 0.05,
                    position: 3.2
                )),
                .object(GoogleSearchConsoleProviderActionAdapterSupport.searchAnalyticsRow(
                    dimensions: dimensions,
                    keys: ["relay marketplace", "/marketplace"],
                    clicks: 18,
                    impressions: 360,
                    ctr: 0.05,
                    position: 5.7
                ))
            ]
            return GoogleSearchConsoleProviderActionClientResult(result: GoogleSearchConsoleProviderActionAdapterSupport.baseResult(
                request: request,
                clientMode: "fake-google-search-console-client",
                fakeAdapter: true,
                liveCredentialsUsed: false
            ).merging([
                "semanticReadContract": .string("google-search-console-search-analytics-v1"),
                "siteUrl": .string(siteUrl),
                "dateRange": .object(dateRange),
                "dimensions": .array(dimensions.map(JSONValue.string)),
                "searchType": .string(GoogleSearchConsoleProviderActionAdapterSupport.searchType(from: request.payload)),
                "aggregationType": .string(GoogleSearchConsoleProviderActionAdapterSupport.aggregationType(from: request.payload)),
                "rowLimit": .number(Double(rowLimit)),
                "rows": .array(Array(rows.prefix(rowLimit))),
                "truncated": .bool(rows.count > rowLimit)
            ]) { _, new in new })

        case "google_search_console_url_inspect":
            let inspectionUrl = try GoogleSearchConsoleProviderActionAdapterSupport.requiredString(request: request, key: "inspectionUrl", label: "inspection URL")
            return GoogleSearchConsoleProviderActionClientResult(result: GoogleSearchConsoleProviderActionAdapterSupport.baseResult(
                request: request,
                clientMode: "fake-google-search-console-client",
                fakeAdapter: true,
                liveCredentialsUsed: false
            ).merging([
                "semanticReadContract": .string("google-search-console-url-inspection-v1"),
                "inspection": .object(GoogleSearchConsoleProviderActionAdapterSupport.inspectionResult(
                    siteUrl: siteUrl,
                    inspectionUrl: inspectionUrl,
                    record: [
                        "inspectionResultLink": .string("https://search.google.com/search-console/inspect"),
                        "indexStatusResult": .object([
                            "verdict": .string("PASS"),
                            "coverageState": .string("Submitted and indexed"),
                            "robotsTxtState": .string("ALLOWED"),
                            "indexingState": .string("INDEXING_ALLOWED"),
                            "pageFetchState": .string("SUCCESSFUL"),
                            "lastCrawlTime": .string("2026-01-01T00:00:00Z"),
                            "googleCanonical": .string(inspectionUrl),
                            "userCanonical": .string(inspectionUrl),
                            "sitemap": .array([.string("\(siteUrl)sitemap.xml")]),
                            "referringUrls": .array([.string(siteUrl)])
                        ]),
                        "mobileUsabilityResult": .object([
                            "verdict": .string("PASS"),
                            "issues": .array([])
                        ]),
                        "richResultsResult": .object([
                            "verdict": .string("PASS"),
                            "detectedItems": .array([])
                        ])
                    ]
                ))
            ]) { _, new in new })

        case "google_search_console_sitemaps_list":
            let maxResults = GoogleSearchConsoleProviderActionAdapterSupport.boundedInt(request.payload["maxResults"], defaultValue: 25, minValue: 1, maxValue: 25)
            let sitemaps: [JSONValue] = [
                .object(GoogleSearchConsoleProviderActionAdapterSupport.sitemap(
                    siteUrl: siteUrl,
                    path: "\(siteUrl)sitemap.xml",
                    type: "sitemap",
                    warnings: 0,
                    errors: 0
                )),
                .object(GoogleSearchConsoleProviderActionAdapterSupport.sitemap(
                    siteUrl: siteUrl,
                    path: "\(siteUrl)news-sitemap.xml",
                    type: "news",
                    warnings: 1,
                    errors: 0
                ))
            ]
            return GoogleSearchConsoleProviderActionClientResult(result: GoogleSearchConsoleProviderActionAdapterSupport.baseResult(
                request: request,
                clientMode: "fake-google-search-console-client",
                fakeAdapter: true,
                liveCredentialsUsed: false
            ).merging([
                "semanticReadContract": .string("google-search-console-sitemaps-v1"),
                "siteUrl": .string(siteUrl),
                "sitemaps": .array(Array(sitemaps.prefix(maxResults))),
                "sitemapCount": .number(Double(sitemaps.count)),
                "maxResults": .number(Double(maxResults)),
                "truncated": .bool(sitemaps.count > maxResults)
            ]) { _, new in new })

        case "google_search_console_sitemap_get":
            let feedpath = try GoogleSearchConsoleProviderActionAdapterSupport.requiredString(request: request, key: "feedpath", label: "sitemap feed path")
            return GoogleSearchConsoleProviderActionClientResult(result: GoogleSearchConsoleProviderActionAdapterSupport.baseResult(
                request: request,
                clientMode: "fake-google-search-console-client",
                fakeAdapter: true,
                liveCredentialsUsed: false
            ).merging([
                "semanticReadContract": .string("google-search-console-sitemap-v1"),
                "siteUrl": .string(siteUrl),
                "sitemap": .object(GoogleSearchConsoleProviderActionAdapterSupport.sitemap(
                    siteUrl: siteUrl,
                    path: feedpath,
                    type: "sitemap",
                    warnings: 0,
                    errors: 0
                ))
            ]) { _, new in new })

        default:
            throw MarketplaceProviderActionAdapterFailure(
                code: "google_search_console_fake_action_not_supported",
                message: "The fake Google Search Console client does not support this action.",
                detail: ["actionKey": .string(request.definition.actionKey)]
            )
        }
    }
}

public final class LiveGoogleSearchConsoleProviderActionClient: GoogleSearchConsoleProviderActionClient, @unchecked Sendable {
    private struct Credentials {
        var accessToken: String
    }

    private let data: LocalDataService
    private let secrets: SecretService
    private let httpClient: any GoogleSearchConsoleProviderHTTPClient
    private let jsonEncoder = JSONEncoder()

    public init(
        data: LocalDataService,
        secrets: SecretService,
        httpClient: any GoogleSearchConsoleProviderHTTPClient = URLSessionGoogleSearchConsoleProviderHTTPClient()
    ) {
        self.data = data
        self.secrets = secrets
        self.httpClient = httpClient
    }

    public func executeGoogleSearchConsoleAction(request: MarketplaceProviderActionAdapterRequest) throws -> GoogleSearchConsoleProviderActionClientResult {
        let connection = try connection(for: request)
        try requireReady(connection: connection, actionKey: request.definition.actionKey)
        let credentials = try credentials(for: connection)
        let accessToken = credentials.accessToken
        switch request.definition.actionKey {
        case "google_search_console_properties_list":
            return try listProperties(request: request, connection: connection, accessToken: accessToken)
        case "google_search_console_property_get":
            return try getProperty(request: request, connection: connection, accessToken: accessToken)
        case "google_search_console_search_analytics_query":
            return try querySearchAnalytics(request: request, connection: connection, accessToken: accessToken)
        case "google_search_console_url_inspect":
            return try inspectURL(request: request, connection: connection, accessToken: accessToken)
        case "google_search_console_sitemaps_list":
            return try listSitemaps(request: request, connection: connection, accessToken: accessToken)
        case "google_search_console_sitemap_get":
            return try getSitemap(request: request, connection: connection, accessToken: accessToken)
        default:
            throw MarketplaceProviderActionAdapterFailure(
                code: "google_search_console_action_not_allowlisted",
                message: "The requested Google Search Console action is not in the V1 live adapter allowlist.",
                detail: ["actionKey": .string(request.definition.actionKey)]
            )
        }
    }

    private func listProperties(
        request: MarketplaceProviderActionAdapterRequest,
        connection: MarketplaceProviderConnection,
        accessToken: String
    ) throws -> GoogleSearchConsoleProviderActionClientResult {
        let maxResults = GoogleSearchConsoleProviderActionAdapterSupport.boundedInt(request.payload["maxResults"], defaultValue: 25, minValue: 1, maxValue: 25)
        let response = try get(path: "/webmasters/v3/sites", query: [], host: "www.googleapis.com", accessToken: accessToken)
        let record = try Self.parseJSONResponse(response)
        let selectedSiteUrl = Self.selectedSiteUrl(connection: connection)
        let allProperties = GoogleSearchConsoleProviderActionAdapterSupport.properties(
            from: record,
            selectedSiteUrl: selectedSiteUrl,
            accountLabel: connection.accountLabel
        )
        return GoogleSearchConsoleProviderActionClientResult(result: GoogleSearchConsoleProviderActionAdapterSupport.baseResult(
            request: request,
            clientMode: "live-google-search-console-api",
            fakeAdapter: false,
            liveCredentialsUsed: true
        ).merging([
            "semanticReadContract": .string("google-search-console-properties-v1"),
            "properties": .array(Array(allProperties.prefix(maxResults))),
            "propertyCount": .number(Double(allProperties.count)),
            "maxResults": .number(Double(maxResults)),
            "truncated": .bool(allProperties.count > maxResults)
        ]) { _, new in new })
    }

    private func getProperty(
        request: MarketplaceProviderActionAdapterRequest,
        connection: MarketplaceProviderConnection,
        accessToken: String
    ) throws -> GoogleSearchConsoleProviderActionClientResult {
        let siteUrl = try Self.siteUrl(request: request, connection: connection)
        let response = try get(
            path: "/webmasters/v3/sites/\(Self.pathEncode(siteUrl))",
            query: [],
            host: "www.googleapis.com",
            accessToken: accessToken
        )
        let record = try Self.parseJSONResponse(response)
        return GoogleSearchConsoleProviderActionClientResult(result: GoogleSearchConsoleProviderActionAdapterSupport.baseResult(
            request: request,
            clientMode: "live-google-search-console-api",
            fakeAdapter: false,
            liveCredentialsUsed: true
        ).merging([
            "semanticReadContract": .string("google-search-console-property-v1"),
            "property": .object(GoogleSearchConsoleProviderActionAdapterSupport.property(
                siteUrl: record["siteUrl"]?.string?.trimmedNonEmpty ?? siteUrl,
                permissionLevel: record["permissionLevel"]?.string?.trimmedNonEmpty ?? "unknown",
                accountLabel: connection.accountLabel,
                selected: siteUrl == Self.selectedSiteUrl(connection: connection)
            ).merging(["accessStatus": .string("accessible")]) { _, new in new })
        ]) { _, new in new })
    }

    private func querySearchAnalytics(
        request: MarketplaceProviderActionAdapterRequest,
        connection: MarketplaceProviderConnection,
        accessToken: String
    ) throws -> GoogleSearchConsoleProviderActionClientResult {
        let siteUrl = try Self.siteUrl(request: request, connection: connection)
        let dimensions = GoogleSearchConsoleProviderActionAdapterSupport.dimensions(from: request.payload)
        let rowLimit = GoogleSearchConsoleProviderActionAdapterSupport.boundedInt(request.payload["rowLimit"], defaultValue: 10, minValue: 1, maxValue: 25)
        let dateRange = GoogleSearchConsoleProviderActionAdapterSupport.dateRange(from: request.payload)
        var body: JSONRecord = [
            "startDate": dateRange["startDate"] ?? .string(""),
            "endDate": dateRange["endDate"] ?? .string(""),
            "dimensions": .array(dimensions.map(JSONValue.string)),
            "rowLimit": .number(Double(rowLimit)),
            "searchType": .string(GoogleSearchConsoleProviderActionAdapterSupport.searchType(from: request.payload)),
            "aggregationType": .string(GoogleSearchConsoleProviderActionAdapterSupport.aggregationType(from: request.payload))
        ]
        if let dataState = request.payload["dataState"]?.string?.trimmedNonEmpty {
            body["dataState"] = .string(dataState)
        }
        if let groups = request.payload["dimensionFilterGroups"] {
            body["dimensionFilterGroups"] = groups
        }
        let response = try postJSON(
            path: "/webmasters/v3/sites/\(Self.pathEncode(siteUrl))/searchAnalytics/query",
            body: body,
            host: "www.googleapis.com",
            accessToken: accessToken
        )
        let record = try Self.parseJSONResponse(response)
        let rows = GoogleSearchConsoleProviderActionAdapterSupport.searchAnalyticsRows(
            from: record,
            dimensions: dimensions,
            limit: rowLimit
        )
        return GoogleSearchConsoleProviderActionClientResult(result: GoogleSearchConsoleProviderActionAdapterSupport.baseResult(
            request: request,
            clientMode: "live-google-search-console-api",
            fakeAdapter: false,
            liveCredentialsUsed: true
        ).merging([
            "semanticReadContract": .string("google-search-console-search-analytics-v1"),
            "siteUrl": .string(siteUrl),
            "dateRange": .object(dateRange),
            "dimensions": .array(dimensions.map(JSONValue.string)),
            "searchType": body["searchType"] ?? .string("web"),
            "aggregationType": body["aggregationType"] ?? .string("auto"),
            "rowLimit": .number(Double(rowLimit)),
            "rows": .array(rows),
            "truncated": .bool(GoogleSearchConsoleProviderActionAdapterSupport.array(record["rows"]).count > rowLimit)
        ]) { _, new in new })
    }

    private func inspectURL(
        request: MarketplaceProviderActionAdapterRequest,
        connection: MarketplaceProviderConnection,
        accessToken: String
    ) throws -> GoogleSearchConsoleProviderActionClientResult {
        let siteUrl = try Self.siteUrl(request: request, connection: connection)
        let inspectionUrl = try GoogleSearchConsoleProviderActionAdapterSupport.requiredString(request: request, key: "inspectionUrl", label: "inspection URL")
        var body: JSONRecord = [
            "siteUrl": .string(siteUrl),
            "inspectionUrl": .string(inspectionUrl)
        ]
        if let languageCode = request.payload["languageCode"]?.string?.trimmedNonEmpty {
            body["languageCode"] = .string(languageCode)
        }
        let response = try postJSON(
            path: "/v1/urlInspection/index:inspect",
            body: body,
            host: "searchconsole.googleapis.com",
            accessToken: accessToken
        )
        let record = try Self.parseJSONResponse(response)
        let inspectionRecord = GoogleSearchConsoleProviderActionAdapterSupport.object(record["inspectionResult"]) ?? record
        return GoogleSearchConsoleProviderActionClientResult(result: GoogleSearchConsoleProviderActionAdapterSupport.baseResult(
            request: request,
            clientMode: "live-google-search-console-api",
            fakeAdapter: false,
            liveCredentialsUsed: true
        ).merging([
            "semanticReadContract": .string("google-search-console-url-inspection-v1"),
            "inspection": .object(GoogleSearchConsoleProviderActionAdapterSupport.inspectionResult(
                siteUrl: siteUrl,
                inspectionUrl: inspectionUrl,
                record: inspectionRecord
            ))
        ]) { _, new in new })
    }

    private func listSitemaps(
        request: MarketplaceProviderActionAdapterRequest,
        connection: MarketplaceProviderConnection,
        accessToken: String
    ) throws -> GoogleSearchConsoleProviderActionClientResult {
        let siteUrl = try Self.siteUrl(request: request, connection: connection)
        let maxResults = GoogleSearchConsoleProviderActionAdapterSupport.boundedInt(request.payload["maxResults"], defaultValue: 25, minValue: 1, maxValue: 25)
        let response = try get(
            path: "/webmasters/v3/sites/\(Self.pathEncode(siteUrl))/sitemaps",
            query: [],
            host: "www.googleapis.com",
            accessToken: accessToken
        )
        let record = try Self.parseJSONResponse(response)
        let allSitemaps = GoogleSearchConsoleProviderActionAdapterSupport.sitemaps(from: record, siteUrl: siteUrl)
        return GoogleSearchConsoleProviderActionClientResult(result: GoogleSearchConsoleProviderActionAdapterSupport.baseResult(
            request: request,
            clientMode: "live-google-search-console-api",
            fakeAdapter: false,
            liveCredentialsUsed: true
        ).merging([
            "semanticReadContract": .string("google-search-console-sitemaps-v1"),
            "siteUrl": .string(siteUrl),
            "sitemaps": .array(Array(allSitemaps.prefix(maxResults))),
            "sitemapCount": .number(Double(allSitemaps.count)),
            "maxResults": .number(Double(maxResults)),
            "truncated": .bool(allSitemaps.count > maxResults)
        ]) { _, new in new })
    }

    private func getSitemap(
        request: MarketplaceProviderActionAdapterRequest,
        connection: MarketplaceProviderConnection,
        accessToken: String
    ) throws -> GoogleSearchConsoleProviderActionClientResult {
        let siteUrl = try Self.siteUrl(request: request, connection: connection)
        let feedpath = try GoogleSearchConsoleProviderActionAdapterSupport.requiredString(request: request, key: "feedpath", label: "sitemap feed path")
        let response = try get(
            path: "/webmasters/v3/sites/\(Self.pathEncode(siteUrl))/sitemaps/\(Self.pathEncode(feedpath))",
            query: [],
            host: "www.googleapis.com",
            accessToken: accessToken
        )
        let record = try Self.parseJSONResponse(response)
        return GoogleSearchConsoleProviderActionClientResult(result: GoogleSearchConsoleProviderActionAdapterSupport.baseResult(
            request: request,
            clientMode: "live-google-search-console-api",
            fakeAdapter: false,
            liveCredentialsUsed: true
        ).merging([
            "semanticReadContract": .string("google-search-console-sitemap-v1"),
            "siteUrl": .string(siteUrl),
            "sitemap": .object(GoogleSearchConsoleProviderActionAdapterSupport.sitemap(from: record, siteUrl: siteUrl, fallbackPath: feedpath))
        ]) { _, new in new })
    }

    private func get(
        path: String,
        query: [URLQueryItem],
        host: String,
        accessToken: String
    ) throws -> GoogleSearchConsoleProviderHTTPResponse {
        var components = URLComponents()
        components.scheme = "https"
        components.host = host
        components.percentEncodedPath = path
        components.queryItems = query.isEmpty ? nil : query
        guard let url = components.url else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "google_search_console_url_invalid",
                message: "Could not build Google Search Console API request URL.",
                detail: ["path": .string(path)]
            )
        }
        return try httpClient.send(GoogleSearchConsoleProviderHTTPRequest(
            method: "GET",
            url: url,
            headers: [
                "Authorization": "Bearer \(accessToken)",
                "Accept": "application/json"
            ]
        ))
    }

    private func postJSON(
        path: String,
        body: JSONRecord,
        host: String,
        accessToken: String
    ) throws -> GoogleSearchConsoleProviderHTTPResponse {
        var components = URLComponents()
        components.scheme = "https"
        components.host = host
        components.percentEncodedPath = path
        guard let url = components.url else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "google_search_console_url_invalid",
                message: "Could not build Google Search Console API request URL.",
                detail: ["path": .string(path)]
            )
        }
        let bodyData = try jsonEncoder.encode(JSONValue.object(body))
        return try httpClient.send(GoogleSearchConsoleProviderHTTPRequest(
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
        guard let connectionId = request.auditIdentity.connectionId?.trimmedNonEmpty,
              let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: connectionId),
              connection.appId == request.app.id,
              connection.appSlug == request.app.slug else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "google_search_console_connection_missing",
                message: "Google Search Console execution requires a Relay Marketplace provider connection."
            )
        }
        return connection
    }

    private func requireReady(connection: MarketplaceProviderConnection, actionKey: String) throws {
        guard connection.status == .connected || connection.status == .healthError else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "google_search_console_connection_not_ready",
                message: "The Google Search Console provider connection is not ready.",
                detail: ["connectionStatus": .string(connection.status.rawValue)]
            )
        }
        let granted = Set(connection.grantedScopes.map { $0.lowercased() })
        let required = ["https://www.googleapis.com/auth/webmasters.readonly"]
        let missing = required.filter { !granted.contains($0.lowercased()) }
        guard missing.isEmpty else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "google_search_console_missing_scope",
                message: "The saved Google Search Console connection is missing webmasters.readonly.",
                detail: [
                    "actionKey": .string(actionKey),
                    "missingScopes": .array(missing.map(JSONValue.string))
                ]
            )
        }
    }

    private func credentials(for connection: MarketplaceProviderConnection) throws -> Credentials {
        Credentials(
            accessToken: try secret(fieldKey: "google_search_console_oauth_access_token", connection: connection)
        )
    }

    private func secret(fieldKey: String, connection: MarketplaceProviderConnection) throws -> String {
        guard let secretId = connection.credentialRequirements.first(where: { $0.fieldKey == fieldKey })?.secretReferenceId else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "google_search_console_credentials_missing",
                message: "The Google Search Console provider connection is missing a required Keychain secret reference.",
                detail: ["fieldKey": .string(fieldKey)]
            )
        }
        do {
            return try secrets.getSecretValue(secretId)
        } catch {
            markConnectionError(
                connection: connection,
                code: "google_search_console_credentials_unavailable",
                message: "Relay could not read the saved Google Search Console credential from the OS secret store. Reconnect Google Search Console in Marketplace."
            )
            throw MarketplaceProviderActionAdapterFailure(
                code: "google_search_console_credentials_unavailable",
                message: "Relay could not read the saved Google Search Console credential from the OS secret store. Reconnect Google Search Console in Marketplace.",
                detail: ["fieldKey": .string(fieldKey)]
            )
        }
    }

    private func markConnectionError(connection: MarketplaceProviderConnection, code: String, message: String) {
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
            unavailableTools: Array(GoogleSearchConsoleProviderActionAdapter.safeActionKeys.sorted()),
            diagnostics: [
                "provider": .string("google-search-console"),
                "reasonCode": .string(code),
                "redactionStatus": .string("private-state-excluded")
            ],
            redactionStatus: "private-state-excluded"
        )
        DispatchQueue.global(qos: .utility).async { [data] in
            _ = try? data.saveProviderConnection(updated)
        }
    }

    private static func selectedSiteUrl(connection: MarketplaceProviderConnection) -> String? {
        connection.health.diagnostics["selectedSiteUrl"]?.string?.trimmedNonEmpty
    }

    private static func siteUrl(
        request: MarketplaceProviderActionAdapterRequest,
        connection: MarketplaceProviderConnection
    ) throws -> String {
        if let siteUrl = request.payload["siteUrl"]?.string?.trimmedNonEmpty {
            return siteUrl
        }
        if let siteUrl = selectedSiteUrl(connection: connection) {
            return siteUrl
        }
        throw MarketplaceProviderActionAdapterFailure(
            code: "google_search_console_site_url_missing",
            message: "Google Search Console action requires a selected or explicit siteUrl."
        )
    }

    private static func parseJSONResponse(_ response: GoogleSearchConsoleProviderHTTPResponse) throws -> JSONRecord {
        guard (200..<300).contains(response.statusCode) else {
            throw mappedHTTPFailure(response)
        }
        if response.body.isEmpty {
            return [:]
        }
        guard let json = try JSONSerialization.jsonObject(with: response.body) as? [String: Any] else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "google_search_console_invalid_json",
                message: "Google Search Console API returned a non-object JSON response."
            )
        }
        return GoogleSearchConsoleProviderActionAdapterSupport.jsonRecord(from: json)
    }

    private static func mappedHTTPFailure(
        _ response: GoogleSearchConsoleProviderHTTPResponse,
        defaultCode: String? = nil,
        defaultMessage: String? = nil
    ) -> MarketplaceProviderActionAdapterFailure {
        let record = GoogleSearchConsoleProviderActionAdapterSupport.parseJSONBody(response.body)
        let reason = GoogleSearchConsoleProviderActionAdapterSupport.googleErrorReason(record)?.lowercased()
        let providerMessage = GoogleSearchConsoleProviderActionAdapterSupport.googleErrorMessage(record)
        let code: String
        switch response.statusCode {
        case 401:
            code = "google_search_console_invalid_credentials"
        case 403:
            if reason == "insufficientpermissions" || reason == "insufficientpermission" {
                code = "google_search_console_missing_scope"
            } else if reason == "ratelimitexceeded" || reason == "userratelimitexceeded" || reason == "quotaexceeded" {
                code = "google_search_console_rate_limited"
            } else {
                code = "google_search_console_forbidden"
            }
        case 404:
            code = "google_search_console_property_unavailable"
        case 408:
            code = "google_search_console_http_timeout"
        case 429:
            code = "google_search_console_rate_limited"
        case 500...599:
            code = "google_search_console_service_unavailable"
        default:
            code = defaultCode ?? "google_search_console_http_error"
        }
        return MarketplaceProviderActionAdapterFailure(
            code: defaultCode ?? code,
            message: defaultMessage ?? providerMessage ?? "Google Search Console API returned HTTP \(response.statusCode).",
            providerStatusCode: response.statusCode,
            detail: [
                "reason": reason.map(JSONValue.string) ?? .null,
                "body": .string(GoogleSearchConsoleProviderActionAdapterSupport.bodySnippet(response.body))
            ]
        )
    }

    private static func formEncode(_ value: String) -> String {
        value.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? value
    }

    private static func pathEncode(_ value: String) -> String {
        var allowed = CharacterSet.alphanumerics
        allowed.insert(charactersIn: "-._~")
        return value.addingPercentEncoding(withAllowedCharacters: allowed) ?? value
    }
}

public struct GoogleSearchConsoleProviderActionAdapter: MarketplaceProviderActionAdapter {
    fileprivate static let safeActionKeys: Set<String> = [
        "google_search_console_properties_list",
        "google_search_console_property_get",
        "google_search_console_search_analytics_query",
        "google_search_console_url_inspect",
        "google_search_console_sitemaps_list",
        "google_search_console_sitemap_get"
    ]

    private let client: any GoogleSearchConsoleProviderActionClient

    public init(client: any GoogleSearchConsoleProviderActionClient = MissingGoogleSearchConsoleProviderActionClient()) {
        self.client = client
    }

    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "google-search-console" else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "google_search_console_adapter_wrong_provider",
                message: "Google Search Console adapter can only execute Google Search Console provider actions.",
                detail: ["appSlug": .string(request.app.slug)]
            )
        }
        guard Self.safeActionKeys.contains(request.definition.actionKey) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "google_search_console_action_not_allowlisted",
                message: "The requested Google Search Console action is not in the V1 adapter allowlist.",
                detail: ["actionKey": .string(request.definition.actionKey)]
            )
        }
        let output = try client.executeGoogleSearchConsoleAction(request: request)
        return MarketplaceProviderActionAdapterResult(
            result: output.result,
            error: nil,
            redactionStatus: output.redactionStatus
        )
    }
}

private enum GoogleSearchConsoleProviderActionAdapterSupport {
    static func baseResult(
        request: MarketplaceProviderActionAdapterRequest,
        clientMode: String,
        fakeAdapter: Bool,
        liveCredentialsUsed: Bool
    ) -> JSONRecord {
        [
            "adapterBoundary": .string("google-search-console-provider-action-adapter"),
            "clientMode": .string(clientMode),
            "provider": .string("google-search-console"),
            "permission": .string(request.permission.rawValue),
            "payloadHash": .string(MarketplaceProviderActionApprovalService.payloadHash(request.payload)),
            "approved": .bool(request.approvalReference?.status == .approved),
            "idempotencyKey": .string(request.idempotencyKey),
            "actionKey": .string(request.definition.actionKey),
            "fakeAdapter": .bool(fakeAdapter),
            "liveCredentialsUsed": .bool(liveCredentialsUsed),
            "simulated": .bool(fakeAdapter),
            "rawProviderToolExposure": .bool(false),
            "redactionStatus": .string("private-state-excluded")
        ]
    }

    static func siteUrl(from payload: JSONRecord) -> String {
        payload["siteUrl"]?.string?.trimmedNonEmpty ?? "https://example.com/"
    }

    static func property(
        siteUrl: String,
        permissionLevel: String,
        accountLabel: String?,
        selected: Bool
    ) -> JSONRecord {
        [
            "siteUrl": .string(siteUrl),
            "propertyType": .string(propertyType(siteUrl)),
            "permissionLevel": .string(permissionLevel),
            "accountLabel": accountLabel.map(JSONValue.string) ?? .null,
            "selected": .bool(selected),
            "redactionStatus": .string("private-state-excluded")
        ]
    }

    static func properties(
        from record: JSONRecord,
        selectedSiteUrl: String?,
        accountLabel: String?
    ) -> [JSONValue] {
        array(record["siteEntry"]).compactMap { value -> JSONValue? in
            guard let object = object(value),
                  let siteUrl = object["siteUrl"]?.string?.trimmedNonEmpty else {
                return nil
            }
            return .object(property(
                siteUrl: siteUrl,
                permissionLevel: object["permissionLevel"]?.string?.trimmedNonEmpty ?? "unknown",
                accountLabel: accountLabel,
                selected: selectedSiteUrl == siteUrl
            ))
        }
    }

    static func propertyType(_ siteUrl: String) -> String {
        if siteUrl.hasPrefix("sc-domain:") {
            return "domain"
        }
        if siteUrl.hasPrefix("http://") || siteUrl.hasPrefix("https://") {
            return "url-prefix"
        }
        return "unknown"
    }

    static func dimensions(from payload: JSONRecord) -> [String] {
        let allowed: Set<String> = ["query", "page", "date", "country", "device", "searchAppearance"]
        let requested = stringArray(payload["dimensions"])
        let dimensions = requested.filter { allowed.contains($0) }
        return dimensions.isEmpty ? ["query"] : Array(dimensions.prefix(5))
    }

    static func dateRange(from payload: JSONRecord) -> JSONRecord {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "yyyy-MM-dd"
        let now = Date()
        let end = Calendar(identifier: .gregorian).date(byAdding: .day, value: -3, to: now) ?? now
        let start = Calendar(identifier: .gregorian).date(byAdding: .day, value: -10, to: end) ?? end
        return [
            "startDate": .string(payload["startDate"]?.string?.trimmedNonEmpty ?? formatter.string(from: start)),
            "endDate": .string(payload["endDate"]?.string?.trimmedNonEmpty ?? formatter.string(from: end))
        ]
    }

    static func searchType(from payload: JSONRecord) -> String {
        let allowed = ["web", "image", "video", "news", "discover", "googleNews"]
        let value = payload["searchType"]?.string?.trimmedNonEmpty ?? "web"
        return allowed.contains(value) ? value : "web"
    }

    static func aggregationType(from payload: JSONRecord) -> String {
        let allowed = ["auto", "byPage", "byProperty"]
        let value = payload["aggregationType"]?.string?.trimmedNonEmpty ?? "auto"
        return allowed.contains(value) ? value : "auto"
    }

    static func searchAnalyticsRows(
        from record: JSONRecord,
        dimensions: [String],
        limit: Int
    ) -> [JSONValue] {
        array(record["rows"]).prefix(limit).compactMap { value -> JSONValue? in
            guard let object = object(value) else {
                return nil
            }
            let keys = array(object["keys"]).compactMap(\.string)
            return .object(searchAnalyticsRow(
                dimensions: dimensions,
                keys: keys,
                clicks: number(object["clicks"]),
                impressions: number(object["impressions"]),
                ctr: number(object["ctr"]),
                position: number(object["position"])
            ))
        }
    }

    static func searchAnalyticsRow(
        dimensions: [String],
        keys: [String],
        clicks: Double,
        impressions: Double,
        ctr: Double,
        position: Double
    ) -> JSONRecord {
        var dimensionMap: JSONRecord = [:]
        for (index, dimension) in dimensions.enumerated() {
            if keys.indices.contains(index) {
                dimensionMap[dimension] = .string(keys[index])
            }
        }
        return [
            "keys": .array(keys.map(JSONValue.string)),
            "dimensions": .object(dimensionMap),
            "clicks": .number(clicks),
            "impressions": .number(impressions),
            "ctr": .number(ctr),
            "position": .number(position),
            "semanticFieldsReturned": .array(["keys", "dimensions", "clicks", "impressions", "ctr", "position"].map(JSONValue.string)),
            "redactionStatus": .string("private-state-excluded")
        ]
    }

    static func inspectionResult(siteUrl: String, inspectionUrl: String, record: JSONRecord) -> JSONRecord {
        let index = object(record["indexStatusResult"]) ?? [:]
        let mobile = object(record["mobileUsabilityResult"]) ?? [:]
        let rich = object(record["richResultsResult"]) ?? [:]
        let issueSummary = inspectionIssues(from: mobile) + inspectionIssues(from: rich)
        return [
            "siteUrl": .string(siteUrl),
            "inspectionUrl": .string(inspectionUrl),
            "verdict": index["verdict"] ?? record["verdict"] ?? .null,
            "coverageState": index["coverageState"] ?? .null,
            "robotsTxtState": index["robotsTxtState"] ?? .null,
            "indexingState": index["indexingState"] ?? .null,
            "pageFetchState": index["pageFetchState"] ?? .null,
            "lastCrawlTime": index["lastCrawlTime"] ?? .null,
            "googleCanonical": index["googleCanonical"] ?? .null,
            "userCanonical": index["userCanonical"] ?? .null,
            "sitemaps": index["sitemap"] ?? .array([]),
            "referringUrls": index["referringUrls"] ?? .array([]),
            "mobileUsabilityVerdict": mobile["verdict"] ?? .null,
            "richResultsVerdict": rich["verdict"] ?? .null,
            "inspectionResultLink": record["inspectionResultLink"] ?? .null,
            "issueSummary": .array(issueSummary),
            "semanticFieldsReturned": .array([
                "verdict",
                "coverageState",
                "robotsTxtState",
                "indexingState",
                "pageFetchState",
                "lastCrawlTime",
                "googleCanonical",
                "userCanonical",
                "sitemaps",
                "referringUrls",
                "issueSummary"
            ].map(JSONValue.string)),
            "redactionStatus": .string("private-state-excluded")
        ]
    }

    static func inspectionIssues(from record: JSONRecord) -> [JSONValue] {
        let issueValues = array(record["issues"])
        return issueValues.compactMap { value -> JSONValue? in
            guard let issue = object(value) else {
                return nil
            }
            return .object([
                "issueType": issue["issueType"] ?? issue["name"] ?? .string("issue"),
                "severity": issue["severity"] ?? .null,
                "message": issue["message"] ?? .null
            ])
        }
    }

    static func sitemaps(from record: JSONRecord, siteUrl: String) -> [JSONValue] {
        array(record["sitemap"]).compactMap { value -> JSONValue? in
            guard let object = object(value) else {
                return nil
            }
            return .object(sitemap(from: object, siteUrl: siteUrl, fallbackPath: object["path"]?.string ?? ""))
        }
    }

    static func sitemap(from record: JSONRecord, siteUrl: String, fallbackPath: String) -> JSONRecord {
        let contents = array(record["contents"]).compactMap { value -> JSONValue? in
            guard let object = object(value) else {
                return nil
            }
            return .object([
                "type": object["type"] ?? .null,
                "submitted": object["submitted"] ?? .null,
                "indexed": object["indexed"] ?? .null
            ])
        }
        return [
            "siteUrl": .string(siteUrl),
            "path": record["path"] ?? .string(fallbackPath),
            "type": record["type"] ?? .string("sitemap"),
            "isPending": record["isPending"] ?? .bool(false),
            "isSitemapsIndex": record["isSitemapsIndex"] ?? .bool(false),
            "lastSubmitted": record["lastSubmitted"] ?? .null,
            "lastDownloaded": record["lastDownloaded"] ?? .null,
            "warnings": record["warnings"] ?? .number(0),
            "errors": record["errors"] ?? .number(0),
            "contents": .array(contents),
            "semanticFieldsReturned": .array(["path", "type", "isPending", "lastSubmitted", "lastDownloaded", "warnings", "errors", "contents"].map(JSONValue.string)),
            "redactionStatus": .string("private-state-excluded")
        ]
    }

    static func sitemap(siteUrl: String, path: String, type: String, warnings: Double, errors: Double) -> JSONRecord {
        sitemap(from: [
            "path": .string(path),
            "type": .string(type),
            "isPending": .bool(false),
            "isSitemapsIndex": .bool(false),
            "lastSubmitted": .string("2026-01-01T00:00:00Z"),
            "lastDownloaded": .string("2026-01-02T00:00:00Z"),
            "warnings": .number(warnings),
            "errors": .number(errors),
            "contents": .array([
                .object([
                    "type": .string("web"),
                    "submitted": .number(120),
                    "indexed": .number(118)
                ])
            ])
        ], siteUrl: siteUrl, fallbackPath: path)
    }

    static func requiredString(
        request: MarketplaceProviderActionAdapterRequest,
        key: String,
        label: String
    ) throws -> String {
        guard let value = request.payload[key]?.string?.trimmedNonEmpty else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "google_search_console_payload_missing_\(key)",
                message: "Google Search Console action payload requires a non-empty \(label).",
                detail: ["field": .string(key)]
            )
        }
        return value
    }

    static func boundedInt(_ value: JSONValue?, defaultValue: Int, minValue: Int, maxValue: Int) -> Int {
        let parsed: Int?
        if let number = value?.number {
            parsed = Int(number)
        } else if let string = value?.string {
            parsed = Int(string.trimmingCharacters(in: .whitespacesAndNewlines))
        } else {
            parsed = nil
        }
        return Swift.max(minValue, Swift.min(maxValue, parsed ?? defaultValue))
    }

    static func stringArray(_ value: JSONValue?) -> [String] {
        if case .array(let values)? = value {
            return values.compactMap { $0.string?.trimmedNonEmpty }
        }
        if let string = value?.string?.trimmedNonEmpty {
            return string
                .split(separator: ",")
                .map { String($0).trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { !$0.isEmpty }
        }
        return []
    }

    static func object(_ value: JSONValue?) -> JSONRecord? {
        if case .object(let object)? = value {
            return object
        }
        return nil
    }

    static func array(_ value: JSONValue?) -> [JSONValue] {
        if case .array(let array)? = value {
            return array
        }
        return []
    }

    static func number(_ value: JSONValue?) -> Double {
        if let number = value?.number {
            return number
        }
        if let string = value?.string, let number = Double(string) {
            return number
        }
        return 0
    }

    static func parseJSONBody(_ body: Data) -> JSONRecord {
        guard !body.isEmpty,
              let json = try? JSONSerialization.jsonObject(with: body) as? [String: Any] else {
            return [:]
        }
        return jsonRecord(from: json)
    }

    static func jsonRecord(from object: [String: Any]) -> JSONRecord {
        object.reduce(into: JSONRecord()) { partial, element in
            partial[element.key] = jsonValue(from: element.value)
        }
    }

    static func jsonValue(from value: Any) -> JSONValue {
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

    static func googleErrorReason(_ record: JSONRecord) -> String? {
        guard let error = object(record["error"]) else {
            return nil
        }
        if let reason = array(error["errors"]).compactMap({ object($0)?["reason"]?.string }).first {
            return reason
        }
        return error["status"]?.string ?? error["reason"]?.string
    }

    static func googleErrorMessage(_ record: JSONRecord) -> String? {
        object(record["error"])?["message"]?.string
    }

    static func bodySnippet(_ data: Data) -> String {
        let text = String(data: data, encoding: .utf8) ?? ""
        return String(text.prefix(500))
    }
}

private extension String {
    var trimmedNonEmpty: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}
