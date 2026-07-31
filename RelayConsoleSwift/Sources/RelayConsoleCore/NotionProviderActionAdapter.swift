import Foundation

public struct NotionProviderActionClientResult: Codable, Equatable, Sendable {
    public var result: JSONRecord
    public var redactionStatus: String

    public init(result: JSONRecord, redactionStatus: String = "private-state-excluded") {
        self.result = result
        self.redactionStatus = redactionStatus
    }
}

public protocol NotionProviderActionClient: Sendable {
    func executeNotionAction(request: MarketplaceProviderActionAdapterRequest) throws -> NotionProviderActionClientResult
}

public struct NotionProviderHTTPRequest: Sendable, Equatable {
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

public struct NotionProviderHTTPResponse: Sendable, Equatable {
    public var statusCode: Int
    public var body: Data

    public init(statusCode: Int, body: Data = Data()) {
        self.statusCode = statusCode
        self.body = body
    }
}

public protocol NotionProviderHTTPClient: Sendable {
    func send(_ request: NotionProviderHTTPRequest) throws -> NotionProviderHTTPResponse
}

public struct URLSessionNotionProviderHTTPClient: NotionProviderHTTPClient {
    private let timeoutSeconds: TimeInterval

    public init(timeoutSeconds: TimeInterval = 20) {
        self.timeoutSeconds = timeoutSeconds
    }

    public func send(_ request: NotionProviderHTTPRequest) throws -> NotionProviderHTTPResponse {
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
                code: "notion_http_timeout",
                message: "Notion API request timed out.",
                detail: ["urlHost": .string(request.url.host ?? "api.notion.com")]
            )
        }
        if let responseError {
            throw responseError
        }
        return NotionProviderHTTPResponse(statusCode: responseStatusCode ?? 0, body: responseData ?? Data())
    }
}

public struct FakeNotionProviderActionClient: NotionProviderActionClient {
    private let failureByActionKey: [String: MarketplaceProviderActionAdapterFailure]

    public init(failureByActionKey: [String: MarketplaceProviderActionAdapterFailure] = [:]) {
        self.failureByActionKey = failureByActionKey
    }

    public func executeNotionAction(request: MarketplaceProviderActionAdapterRequest) throws -> NotionProviderActionClientResult {
        if let failure = failureByActionKey[request.definition.actionKey] {
            throw failure
        }
        switch request.definition.actionKey {
        case "notion_search":
            return try search(request: request)
        case "notion_fetch_page":
            return try fetchPage(request: request)
        case "notion_query_data_source":
            return try queryDataSource(request: request)
        case "notion_prepare_page":
            return try preparePage(request: request)
        case "notion_create_page":
            return try createPage(request: request)
        case "notion_update_page":
            return try updatePage(request: request)
        case "notion_create_comment":
            return try createComment(request: request)
        default:
            throw MarketplaceProviderActionAdapterFailure(
                code: "notion_fake_action_not_supported",
                message: "The fake Notion client does not support this action.",
                detail: ["actionKey": .string(request.definition.actionKey)]
            )
        }
    }

    private func search(request: MarketplaceProviderActionAdapterRequest) throws -> NotionProviderActionClientResult {
        let query = request.payload["query"]?.string?.trimmedNonEmpty ?? "shared workspace"
        let limit = NotionProviderActionAdapterSupport.boundedInt(request.payload["limit"], defaultValue: 3, minValue: 1, maxValue: 10)
        let result = baseResult(request: request).merging([
            "query": .string(query),
            "limit": .number(Double(limit)),
            "semanticReadContract": .string("notion-search-summary-v1"),
            "results": .array([
                .object([
                    "id": .string("notion-page-\(Self.stableSuffix(query + request.idempotencyKey))"),
                    "object": .string("page"),
                    "type": .string("page"),
                    "title": .string("Redacted Notion fixture"),
                    "url": .string("https://www.notion.so/fixture-\(Self.stableSuffix(query))"),
                    "parentType": .string("workspace"),
                    "lastEditedTime": .string("2026-01-01T00:00:00.000Z"),
                    "createdTime": .string("2026-01-01T00:00:00.000Z"),
                    "archived": .bool(false),
                    "inTrash": .bool(false),
                    "redactionStatus": .string("private-state-excluded")
                ])
            ]),
            "nextCursor": .null,
            "hasMore": .bool(false)
        ]) { _, new in new }
        return NotionProviderActionClientResult(result: result)
    }

    private func fetchPage(request: MarketplaceProviderActionAdapterRequest) throws -> NotionProviderActionClientResult {
        let pageId = try NotionProviderActionAdapterSupport.requiredPayloadString(
            request: request,
            key: "pageUrlOrId",
            label: "page URL or ID"
        )
        let maxChars = NotionProviderActionAdapterSupport.boundedInt(request.payload["maxMarkdownChars"], defaultValue: 1200, minValue: 1, maxValue: 8000)
        let markdown = String("Fixture Notion page content for \(pageId).".prefix(maxChars))
        let result = baseResult(request: request).merging([
            "semanticReadContract": .string("notion-page-markdown-v1"),
            "page": .object([
                "id": .string(pageId),
                "object": .string("page"),
                "title": .string("Redacted Notion fixture"),
                "url": .string("https://www.notion.so/\(Self.stableSuffix(pageId))"),
                "parentType": .string("workspace"),
                "lastEditedTime": .string("2026-01-01T00:00:00.000Z"),
                "markdownExcerpt": .string(markdown),
                "markdownCharCount": .number(Double(markdown.count)),
                "markdownTruncated": .bool(false),
                "unknownBlockCount": .number(0),
                "redactionStatus": .string("private-state-excluded")
            ])
        ]) { _, new in new }
        return NotionProviderActionClientResult(result: result)
    }

    private func queryDataSource(request: MarketplaceProviderActionAdapterRequest) throws -> NotionProviderActionClientResult {
        let dataSourceId = try NotionProviderActionAdapterSupport.requiredPayloadString(
            request: request,
            key: "dataSourceId",
            label: "data source ID"
        )
        let limit = NotionProviderActionAdapterSupport.boundedInt(request.payload["limit"], defaultValue: 3, minValue: 1, maxValue: 10)
        let rows: [JSONValue] = (1...min(limit, 2)).map { index in
            .object([
                "id": .string("notion-row-\(index)-\(Self.stableSuffix(dataSourceId + request.idempotencyKey))"),
                "object": .string("page"),
                "title": .string("Redacted row \(index)"),
                "url": .string("https://www.notion.so/row-\(index)"),
                "lastEditedTime": .string("2026-01-01T00:00:00.000Z"),
                "properties": .object([
                    "Status": .object([
                        "type": .string("select"),
                        "value": .string(index == 1 ? "In progress" : "Done")
                    ])
                ]),
                "redactionStatus": .string("private-state-excluded")
            ])
        }
        let result = baseResult(request: request).merging([
            "semanticReadContract": .string("notion-data-source-query-v1"),
            "dataSourceId": .string(dataSourceId),
            "limit": .number(Double(limit)),
            "rows": .array(rows),
            "rowCount": .number(Double(rows.count)),
            "nextCursor": .null,
            "hasMore": .bool(false)
        ]) { _, new in new }
        return NotionProviderActionClientResult(result: result)
    }

    private func preparePage(request: MarketplaceProviderActionAdapterRequest) throws -> NotionProviderActionClientResult {
        NotionProviderActionClientResult(result: baseResult(request: request).merging([
            "draftPreview": .object(NotionProviderActionAdapterSupport.draftPreview(request: request))
        ]) { _, new in new })
    }

    private func createPage(request: MarketplaceProviderActionAdapterRequest) throws -> NotionProviderActionClientResult {
        let parentId = try NotionProviderActionAdapterSupport.requiredPayloadString(request: request, key: "parentId", label: "parent ID")
        let parentType = request.payload["parentType"]?.string?.trimmedNonEmpty ?? "page_id"
        let title = try NotionProviderActionAdapterSupport.requiredPayloadString(request: request, key: "title", label: "page title")
        let pageId = "notion-page-\(Self.stableSuffix(parentId + title + request.idempotencyKey))"
        return NotionProviderActionClientResult(result: baseResult(request: request).merging([
            "pageId": .string(pageId),
            "url": .string("https://www.notion.so/\(pageId)"),
            "parentId": .string(parentId),
            "parentType": .string(parentType),
            "title": .string(title),
            "auditId": .string("notion-audit-\(Self.stableSuffix(request.idempotencyKey))"),
            "markdownCharCount": .number(Double(request.payload["markdown"]?.string?.count ?? 0)),
            "created": .bool(true)
        ]) { _, new in new })
    }

    private func updatePage(request: MarketplaceProviderActionAdapterRequest) throws -> NotionProviderActionClientResult {
        let pageId = try NotionProviderActionAdapterSupport.requiredPayloadString(request: request, key: "pageId", label: "page ID")
        let appendMarkdown = request.payload["appendMarkdown"]?.string?.trimmedNonEmpty
        let propertyChanges = NotionProviderActionAdapterSupport.object(request.payload["propertyChanges"])
        guard appendMarkdown != nil || propertyChanges != nil else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "notion_payload_missing_update",
                message: "Notion page updates require propertyChanges or appendMarkdown."
            )
        }
        return NotionProviderActionClientResult(result: baseResult(request: request).merging([
            "pageId": .string(pageId),
            "url": .string("https://www.notion.so/\(Self.stableSuffix(pageId))"),
            "auditId": .string("notion-audit-\(Self.stableSuffix(request.idempotencyKey))"),
            "propertyChangeCount": .number(Double(propertyChanges?.count ?? 0)),
            "appendedMarkdownCharCount": .number(Double(appendMarkdown?.count ?? 0)),
            "updated": .bool(true)
        ]) { _, new in new })
    }

    private func createComment(request: MarketplaceProviderActionAdapterRequest) throws -> NotionProviderActionClientResult {
        let target = try NotionProviderActionAdapterSupport.commentTarget(from: request)
        let markdown = try NotionProviderActionAdapterSupport.requiredPayloadString(request: request, key: "markdown", label: "comment markdown")
        return NotionProviderActionClientResult(result: baseResult(request: request).merging([
            "commentId": .string("notion-comment-\(Self.stableSuffix(target.value + markdown + request.idempotencyKey))"),
            "targetType": .string(target.kind),
            "targetId": .string(target.value),
            "auditId": .string("notion-audit-\(Self.stableSuffix(request.idempotencyKey))"),
            "commentMarkdownCharCount": .number(Double(markdown.count)),
            "commentCreated": .bool(true)
        ]) { _, new in new })
    }

    private func baseResult(request: MarketplaceProviderActionAdapterRequest) -> JSONRecord {
        [
            "adapterBoundary": .string("notion-provider-action-adapter"),
            "clientMode": .string("fake-notion-client"),
            "provider": .string("notion"),
            "permission": .string(request.permission.rawValue),
            "payloadHash": .string(MarketplaceProviderActionApprovalService.payloadHash(request.payload)),
            "approved": .bool(request.approvalReference?.status == .approved),
            "idempotencyKey": .string(request.idempotencyKey),
            "actionKey": .string(request.definition.actionKey),
            "fakeAdapter": .bool(true),
            "liveCredentialsUsed": .bool(false),
            "simulated": .bool(true),
            "redactionStatus": .string("private-state-excluded")
        ]
    }

    private static func stableSuffix(_ value: String) -> String {
        NotionProviderActionAdapterSupport.stableSuffix(value)
    }
}

public final class LiveNotionProviderActionClient: NotionProviderActionClient, @unchecked Sendable {
    private static let apiBaseURL = URL(string: "https://api.notion.com")!
    private static let notionVersion = "2026-03-11"

    private let data: LocalDataService
    private let secrets: SecretService
    private let httpClient: any NotionProviderHTTPClient

    public init(
        data: LocalDataService,
        secrets: SecretService,
        httpClient: any NotionProviderHTTPClient = URLSessionNotionProviderHTTPClient()
    ) {
        self.data = data
        self.secrets = secrets
        self.httpClient = httpClient
    }

    public func executeNotionAction(request: MarketplaceProviderActionAdapterRequest) throws -> NotionProviderActionClientResult {
        let connection = try connection(for: request)
        try requireReady(connection: connection, actionKey: request.definition.actionKey)
        let token = try secret(fieldKey: "notion_api_token", connection: connection)
        switch request.definition.actionKey {
        case "notion_search":
            return try search(request: request, token: token)
        case "notion_fetch_page":
            return try fetchPage(request: request, token: token)
        case "notion_query_data_source":
            return try queryDataSource(request: request, token: token)
        case "notion_create_page":
            return try createPage(request: request, token: token)
        case "notion_update_page":
            return try updatePage(request: request, token: token)
        case "notion_create_comment":
            return try createComment(request: request, token: token)
        default:
            throw MarketplaceProviderActionAdapterFailure(
                code: "notion_action_not_allowlisted",
                message: "The requested Notion action is not in the V1 live adapter allowlist.",
                detail: ["actionKey": .string(request.definition.actionKey)]
            )
        }
    }

    private func search(
        request: MarketplaceProviderActionAdapterRequest,
        token: String
    ) throws -> NotionProviderActionClientResult {
        let query = request.payload["query"]?.string?.trimmedNonEmpty
        let limit = NotionProviderActionAdapterSupport.boundedInt(request.payload["limit"], defaultValue: 5, minValue: 1, maxValue: 10)
        var body: JSONRecord = ["page_size": .number(Double(limit))]
        if let query {
            body["query"] = .string(query)
        }
        if let startCursor = request.payload["startCursor"]?.string?.trimmedNonEmpty {
            body["start_cursor"] = .string(startCursor)
        }
        if let objectType = request.payload["objectType"]?.string?.trimmedNonEmpty {
            let normalized = objectType == "database" ? "data_source" : objectType
            guard normalized == "page" || normalized == "data_source" else {
                throw MarketplaceProviderActionAdapterFailure(
                    code: "notion_invalid_search_object_type",
                    message: "Notion search objectType must be page or data_source.",
                    detail: ["objectType": .string(objectType)]
                )
            }
            body["filter"] = .object([
                "property": .string("object"),
                "value": .string(normalized)
            ])
        }
        if let sort = request.payload["sort"]?.string?.trimmedNonEmpty {
            let direction = sort.lowercased().contains("ascending") ? "ascending" : "descending"
            body["sort"] = .object([
                "timestamp": .string("last_edited_time"),
                "direction": .string(direction)
            ])
        }
        let response = try postJSON(path: "/v1/search", body: body, token: token)
        let record = try Self.parseJSONResponse(response, code: "notion_search_http_error")
        let results = NotionProviderActionAdapterSupport.array(record["results"])
            .prefix(limit)
            .compactMap { NotionProviderActionAdapterSupport.object($0) }
            .map { JSONValue.object(Self.searchSummary(from: $0)) }
        return NotionProviderActionClientResult(result: baseResult(request: request).merging([
            "clientMode": .string("live-notion-api"),
            "query": query.map(JSONValue.string) ?? .null,
            "limit": .number(Double(limit)),
            "semanticReadContract": .string("notion-search-summary-v1"),
            "results": .array(Array(results)),
            "nextCursor": record["next_cursor"] ?? .null,
            "hasMore": record["has_more"] ?? .bool(false)
        ]) { _, new in new })
    }

    private func fetchPage(
        request: MarketplaceProviderActionAdapterRequest,
        token: String
    ) throws -> NotionProviderActionClientResult {
        let pageUrlOrId = try NotionProviderActionAdapterSupport.requiredPayloadString(
            request: request,
            key: "pageUrlOrId",
            label: "page URL or ID"
        )
        let pageId = NotionProviderActionAdapterSupport.notionId(from: pageUrlOrId)
        let maxMarkdownChars = NotionProviderActionAdapterSupport.boundedInt(request.payload["maxMarkdownChars"], defaultValue: 4000, minValue: 1, maxValue: 8000)
        let includeProperties = boolValue(request.payload["includeProperties"]) ?? true
        let includeTranscript = boolValue(request.payload["includeTranscript"]) ?? false
        guard !includeTranscript else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "notion_transcript_fetch_deferred",
                message: "Notion meeting transcript reads are deferred in the V1 adapter."
            )
        }
        let pageResponse = try get(path: "/v1/pages/\(Self.pathEncode(pageId))", query: [], token: token)
        let pageRecord = try Self.parseJSONResponse(pageResponse, code: "notion_fetch_page_http_error")
        let markdownResponse = try get(
            path: "/v1/pages/\(Self.pathEncode(pageId))/markdown",
            query: [URLQueryItem(name: "include_transcript", value: "false")],
            token: token
        )
        let markdownRecord = try Self.parseJSONResponse(markdownResponse, code: "notion_page_markdown_http_error")
        let nestedMarkdown = NotionProviderActionAdapterSupport.object(markdownRecord["page_markdown"])
        let markdown = markdownRecord["markdown"]?.string ?? nestedMarkdown?["markdown"]?.string ?? ""
        let excerpt = String(markdown.prefix(maxMarkdownChars))
        var page = Self.pageSummary(from: pageRecord, fallbackId: pageId, includeProperties: includeProperties)
        page["markdownExcerpt"] = excerpt.isEmpty ? .null : .string(excerpt)
        page["markdownCharCount"] = .number(Double(markdown.count))
        let apiTruncated = markdownRecord["truncated"]?.bool ?? nestedMarkdown?["truncated"]?.bool ?? false
        let unknownBlockIds = NotionProviderActionAdapterSupport.array(markdownRecord["unknown_block_ids"]).isEmpty
            ? NotionProviderActionAdapterSupport.array(nestedMarkdown?["unknown_block_ids"])
            : NotionProviderActionAdapterSupport.array(markdownRecord["unknown_block_ids"])
        page["markdownTruncated"] = .bool(markdown.count > excerpt.count || apiTruncated)
        page["unknownBlockCount"] = .number(Double(unknownBlockIds.count))
        return NotionProviderActionClientResult(result: baseResult(request: request).merging([
            "clientMode": .string("live-notion-api"),
            "semanticReadContract": .string("notion-page-markdown-v1"),
            "page": .object(page)
        ]) { _, new in new })
    }

    private func queryDataSource(
        request: MarketplaceProviderActionAdapterRequest,
        token: String
    ) throws -> NotionProviderActionClientResult {
        let dataSourceId = try NotionProviderActionAdapterSupport.requiredPayloadString(
            request: request,
            key: "dataSourceId",
            label: "data source ID"
        )
        let limit = NotionProviderActionAdapterSupport.boundedInt(request.payload["limit"], defaultValue: 5, minValue: 1, maxValue: 10)
        let propertyNames = NotionProviderActionAdapterSupport.stringArray(request.payload["propertyNames"])
        var body: JSONRecord = ["page_size": .number(Double(limit))]
        if let filter = NotionProviderActionAdapterSupport.object(request.payload["filter"]) {
            body["filter"] = .object(filter)
        }
        if case .array? = request.payload["sorts"] {
            body["sorts"] = request.payload["sorts"]
        }
        if let startCursor = request.payload["startCursor"]?.string?.trimmedNonEmpty {
            body["start_cursor"] = .string(startCursor)
        }
        let response = try postJSON(
            path: "/v1/data_sources/\(Self.pathEncode(dataSourceId))/query",
            body: body,
            token: token
        )
        let record = try Self.parseJSONResponse(response, code: "notion_data_source_query_http_error")
        let rows = NotionProviderActionAdapterSupport.array(record["results"])
            .prefix(limit)
            .compactMap { NotionProviderActionAdapterSupport.object($0) }
            .map { JSONValue.object(Self.rowSummary(from: $0, selectedPropertyNames: propertyNames)) }
        return NotionProviderActionClientResult(result: baseResult(request: request).merging([
            "clientMode": .string("live-notion-api"),
            "semanticReadContract": .string("notion-data-source-query-v1"),
            "dataSourceId": .string(dataSourceId),
            "limit": .number(Double(limit)),
            "rows": .array(Array(rows)),
            "rowCount": .number(Double(rows.count)),
            "nextCursor": record["next_cursor"] ?? .null,
            "hasMore": record["has_more"] ?? .bool(false)
        ]) { _, new in new })
    }

    private func createPage(
        request: MarketplaceProviderActionAdapterRequest,
        token: String
    ) throws -> NotionProviderActionClientResult {
        let parentId = try NotionProviderActionAdapterSupport.requiredPayloadString(request: request, key: "parentId", label: "parent ID")
        let parentType = request.payload["parentType"]?.string?.trimmedNonEmpty ?? "page_id"
        guard parentType == "page_id" || parentType == "data_source_id" else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "notion_invalid_parent_type",
                message: "Notion page creation requires parentType page_id or data_source_id.",
                detail: ["parentType": .string(parentType)]
            )
        }
        let title = try NotionProviderActionAdapterSupport.requiredPayloadString(request: request, key: "title", label: "page title")
        var properties = NotionProviderActionAdapterSupport.object(request.payload["properties"]) ?? [:]
        if parentType == "page_id" || properties.isEmpty {
            properties["title"] = .object(["title": .array([.object(Self.richText(title))])])
        }
        var body: JSONRecord = [
            "parent": .object([parentType: .string(parentId)]),
            "properties": .object(properties)
        ]
        if let markdown = request.payload["markdown"]?.string?.trimmedNonEmpty {
            body["markdown"] = .string(String(markdown.prefix(8000)))
        }
        let response = try postJSON(path: "/v1/pages", body: body, token: token)
        let record = try Self.parseJSONResponse(response, code: "notion_create_page_http_error")
        let pageId = record["id"]?.string ?? "unknown"
        return NotionProviderActionClientResult(result: baseResult(request: request).merging([
            "clientMode": .string("live-notion-api"),
            "pageId": .string(pageId),
            "url": record["url"] ?? .null,
            "parentId": .string(parentId),
            "parentType": .string(parentType),
            "auditId": .string("notion-audit-\(NotionProviderActionAdapterSupport.stableSuffix(request.idempotencyKey))"),
            "markdownCharCount": .number(Double(request.payload["markdown"]?.string?.count ?? 0)),
            "created": .bool(true)
        ]) { _, new in new })
    }

    private func updatePage(
        request: MarketplaceProviderActionAdapterRequest,
        token: String
    ) throws -> NotionProviderActionClientResult {
        let pageId = try NotionProviderActionAdapterSupport.requiredPayloadString(request: request, key: "pageId", label: "page ID")
        let propertyChanges = NotionProviderActionAdapterSupport.object(request.payload["propertyChanges"])
        let appendMarkdown = request.payload["appendMarkdown"]?.string?.trimmedNonEmpty
        guard propertyChanges != nil || appendMarkdown != nil else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "notion_payload_missing_update",
                message: "Notion page updates require propertyChanges or appendMarkdown."
            )
        }
        var lastRecord: JSONRecord = [:]
        if let propertyChanges {
            let response = try patchJSON(
                path: "/v1/pages/\(Self.pathEncode(pageId))",
                body: ["properties": .object(propertyChanges)],
                token: token
            )
            lastRecord = try Self.parseJSONResponse(response, code: "notion_update_page_http_error")
        }
        if let appendMarkdown {
            let position = request.payload["position"]?.string?.trimmedNonEmpty == "start" ? "start" : "end"
            let response = try patchJSON(
                path: "/v1/pages/\(Self.pathEncode(pageId))/markdown",
                body: [
                    "type": .string("insert_content"),
                    "insert_content": .object([
                        "content": .string(String(appendMarkdown.prefix(8000))),
                        "position": .object(["type": .string(position)])
                    ])
                ],
                token: token
            )
            lastRecord = try Self.parseJSONResponse(response, code: "notion_update_page_markdown_http_error")
        }
        var result = baseResult(request: request)
        result["clientMode"] = .string("live-notion-api")
        result["pageId"] = .string(lastRecord["id"]?.string ?? pageId)
        result["url"] = lastRecord["url"] ?? .null
        result["auditId"] = .string("notion-audit-\(NotionProviderActionAdapterSupport.stableSuffix(request.idempotencyKey))")
        result["propertyChangeCount"] = .number(Double(propertyChanges?.count ?? 0))
        result["appendedMarkdownCharCount"] = .number(Double(appendMarkdown?.count ?? 0))
        result["updated"] = .bool(true)
        return NotionProviderActionClientResult(result: result)
    }

    private func createComment(
        request: MarketplaceProviderActionAdapterRequest,
        token: String
    ) throws -> NotionProviderActionClientResult {
        let target = try NotionProviderActionAdapterSupport.commentTarget(from: request)
        let markdown = try NotionProviderActionAdapterSupport.requiredPayloadString(request: request, key: "markdown", label: "comment markdown")
        var body: JSONRecord = [
            "markdown": .string(String(markdown.prefix(2000)))
        ]
        if target.kind == "discussion_id" {
            body["discussion_id"] = .string(target.value)
        } else {
            body["parent"] = .object([target.kind: .string(target.value)])
        }
        let response = try postJSON(path: "/v1/comments", body: body, token: token)
        let record = try Self.parseJSONResponse(response, code: "notion_create_comment_http_error")
        return NotionProviderActionClientResult(result: baseResult(request: request).merging([
            "clientMode": .string("live-notion-api"),
            "commentId": record["id"] ?? .null,
            "targetType": .string(target.kind),
            "targetId": .string(target.value),
            "auditId": .string("notion-audit-\(NotionProviderActionAdapterSupport.stableSuffix(request.idempotencyKey))"),
            "commentMarkdownCharCount": .number(Double(markdown.count)),
            "commentCreated": .bool(true)
        ]) { _, new in new })
    }

    private func connection(for request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderConnection {
        guard let connectionId = request.auditIdentity.connectionId?.trimmedNonEmpty,
              let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: connectionId),
              connection.appId == request.app.id,
              connection.appSlug == request.app.slug else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "notion_connection_missing",
                message: "Notion execution requires a Relay Marketplace provider connection."
            )
        }
        return connection
    }

    private func requireReady(connection: MarketplaceProviderConnection, actionKey: String) throws {
        guard connection.status == .connected || connection.status == .healthError else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "notion_connection_not_ready",
                message: "The Notion provider connection is not ready.",
                detail: ["connectionStatus": .string(connection.status.rawValue)]
            )
        }
        let granted = Set(connection.grantedScopes.map { $0.lowercased() })
        let missing = Self.requiredScopes(for: actionKey).filter { !granted.contains($0.lowercased()) }
        guard missing.isEmpty else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "notion_missing_capability",
                message: "The saved Notion connection is missing required capability/capabilities.",
                detail: [
                    "actionKey": .string(actionKey),
                    "missingScopes": .array(missing.map(JSONValue.string))
                ]
            )
        }
    }

    private static func requiredScopes(for actionKey: String) -> [String] {
        switch actionKey {
        case "notion_search", "notion_fetch_page", "notion_query_data_source":
            return ["read_content"]
        case "notion_create_page":
            return ["insert_content"]
        case "notion_update_page":
            return ["update_content"]
        case "notion_create_comment":
            return ["insert_comments"]
        default:
            return []
        }
    }

    private func secret(fieldKey: String, connection: MarketplaceProviderConnection) throws -> String {
        guard let secretId = connection.credentialRequirements.first(where: { $0.fieldKey == fieldKey })?.secretReferenceId
            ?? connection.secretReferenceIds.first else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "notion_credentials_missing",
                message: "The Notion provider connection is missing a required Keychain secret reference.",
                detail: ["fieldKey": .string(fieldKey)]
            )
        }
        do {
            return try secrets.getSecretValue(secretId)
        } catch {
            markCredentialUnavailable(connection: connection)
            throw MarketplaceProviderActionAdapterFailure(
                code: "notion_credentials_unavailable",
                message: "Relay could not read the saved Notion token from the OS secret store. Replace the Notion token in Marketplace.",
                detail: ["fieldKey": .string(fieldKey)]
            )
        }
    }

    private func markCredentialUnavailable(connection: MarketplaceProviderConnection) {
        var updated = connection
        updated.status = .authRequired
        updated.authorizationState = .error
        updated.reauthorizeRequired = true
        updated.lastCheckedAt = nowIso()
        updated.lastError = "Saved Notion token is unavailable in the OS secret store. Replace the Notion token in Marketplace."
        updated.health = ProviderConnectorHealth(
            state: .error,
            message: "Saved Notion token is unavailable in the OS secret store. Replace the Notion token in Marketplace.",
            lastCheckedAt: updated.lastCheckedAt,
            missingScopes: [],
            unavailableTools: Array(NotionProviderActionAdapter.safeActionKeys.sorted()),
            diagnostics: [
                "provider": .string("notion"),
                "reasonCode": .string("notion_credentials_unavailable"),
                "secretStorage": .string("keychain-reference-only"),
                "redactionStatus": .string("private-state-excluded")
            ],
            redactionStatus: "private-state-excluded"
        )
        updated.credentialRequirements = updated.credentialRequirements.map { requirement in
            var copy = requirement
            if copy.fieldKey == "notion_api_token" {
                copy.status = .unavailable
            }
            return copy
        }
        DispatchQueue.global(qos: .utility).async { [data] in
            _ = try? data.saveProviderConnection(updated)
        }
    }

    private func get(path: String, query: [URLQueryItem], token: String) throws -> NotionProviderHTTPResponse {
        try httpClient.send(NotionProviderHTTPRequest(
            method: "GET",
            url: try Self.url(path: path, query: query),
            headers: Self.headers(token: token, includeContentType: false)
        ))
    }

    private func postJSON(path: String, body: JSONRecord, token: String) throws -> NotionProviderHTTPResponse {
        try httpClient.send(NotionProviderHTTPRequest(
            method: "POST",
            url: try Self.url(path: path, query: []),
            headers: Self.headers(token: token, includeContentType: true),
            body: try Self.jsonBody(body)
        ))
    }

    private func patchJSON(path: String, body: JSONRecord, token: String) throws -> NotionProviderHTTPResponse {
        try httpClient.send(NotionProviderHTTPRequest(
            method: "PATCH",
            url: try Self.url(path: path, query: []),
            headers: Self.headers(token: token, includeContentType: true),
            body: try Self.jsonBody(body)
        ))
    }

    private static func headers(token: String, includeContentType: Bool) -> [String: String] {
        var headers = [
            "Authorization": "Bearer \(token)",
            "Accept": "application/json",
            "Notion-Version": notionVersion
        ]
        if includeContentType {
            headers["Content-Type"] = "application/json"
        }
        return headers
    }

    private static func url(path: String, query: [URLQueryItem]) throws -> URL {
        var components = URLComponents()
        components.scheme = apiBaseURL.scheme
        components.host = apiBaseURL.host
        components.path = path.hasPrefix("/") ? path : "/\(path)"
        components.queryItems = query.isEmpty ? nil : query
        guard let url = components.url else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "notion_url_unavailable",
                message: "Notion API URL could not be constructed."
            )
        }
        return url
    }

    private static func jsonBody(_ body: JSONRecord) throws -> Data {
        do {
            return try jsonEncoder.encode(body)
        } catch {
            throw MarketplaceProviderActionAdapterFailure(
                code: "notion_json_encode_failed",
                message: "Notion request body could not be encoded."
            )
        }
    }

    private func baseResult(request: MarketplaceProviderActionAdapterRequest) -> JSONRecord {
        [
            "adapterBoundary": .string("notion-provider-action-adapter"),
            "provider": .string("notion"),
            "permission": .string(request.permission.rawValue),
            "payloadHash": .string(MarketplaceProviderActionApprovalService.payloadHash(request.payload)),
            "approved": .bool(request.approvalReference?.status == .approved),
            "idempotencyKey": .string(request.idempotencyKey),
            "actionKey": .string(request.definition.actionKey),
            "fakeAdapter": .bool(false),
            "liveCredentialsUsed": .bool(true),
            "simulated": .bool(false),
            "redactionStatus": .string("private-state-excluded")
        ]
    }

    private static func parseJSONResponse(_ response: NotionProviderHTTPResponse, code: String) throws -> JSONRecord {
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: code,
                message: "Notion API returned HTTP \(response.statusCode).",
                providerStatusCode: response.statusCode,
                detail: ["body": .string(NotionProviderActionAdapterSupport.bodySnippet(response.body))]
            )
        }
        if response.body.isEmpty {
            return [:]
        }
        guard let json = try JSONSerialization.jsonObject(with: response.body) as? [String: Any] else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "notion_invalid_json",
                message: "Notion API returned a non-object JSON response."
            )
        }
        return NotionProviderActionAdapterSupport.jsonRecord(from: json)
    }

    private static func searchSummary(from record: JSONRecord) -> JSONRecord {
        [
            "id": record["id"] ?? .null,
            "object": record["object"] ?? .null,
            "type": record["object"] ?? .null,
            "title": .string(title(from: record)),
            "url": record["url"] ?? .null,
            "publicUrl": record["public_url"] ?? .null,
            "parentType": parentType(from: record),
            "lastEditedTime": record["last_edited_time"] ?? .null,
            "createdTime": record["created_time"] ?? .null,
            "archived": record["archived"] ?? record["is_archived"] ?? .null,
            "inTrash": record["in_trash"] ?? .null,
            "redactionStatus": .string("private-state-excluded")
        ]
    }

    private static func pageSummary(from record: JSONRecord, fallbackId: String, includeProperties: Bool) -> JSONRecord {
        var summary: JSONRecord = [
            "id": record["id"] ?? .string(fallbackId),
            "object": record["object"] ?? .string("page"),
            "title": .string(title(from: record)),
            "url": record["url"] ?? .null,
            "publicUrl": record["public_url"] ?? .null,
            "parentType": parentType(from: record),
            "lastEditedTime": record["last_edited_time"] ?? .null,
            "createdTime": record["created_time"] ?? .null,
            "archived": record["archived"] ?? record["is_archived"] ?? .null,
            "inTrash": record["in_trash"] ?? .null,
            "redactionStatus": .string("private-state-excluded")
        ]
        if includeProperties, let properties = NotionProviderActionAdapterSupport.object(record["properties"]) {
            summary["properties"] = .object(propertySummary(from: properties, selectedNames: nil))
        }
        return summary
    }

    private static func rowSummary(from record: JSONRecord, selectedPropertyNames: [String]) -> JSONRecord {
        let properties = NotionProviderActionAdapterSupport.object(record["properties"]) ?? [:]
        return [
            "id": record["id"] ?? .null,
            "object": record["object"] ?? .string("page"),
            "title": .string(title(from: record)),
            "url": record["url"] ?? .null,
            "lastEditedTime": record["last_edited_time"] ?? .null,
            "createdTime": record["created_time"] ?? .null,
            "properties": .object(propertySummary(from: properties, selectedNames: selectedPropertyNames.isEmpty ? nil : Set(selectedPropertyNames))),
            "redactionStatus": .string("private-state-excluded")
        ]
    }

    private static func title(from record: JSONRecord) -> String {
        if let title = plainText(from: record["title"])?.trimmedNonEmpty {
            return title
        }
        if let properties = NotionProviderActionAdapterSupport.object(record["properties"]) {
            for (_, property) in properties {
                guard let object = NotionProviderActionAdapterSupport.object(property),
                      object["type"]?.string == "title" else {
                    continue
                }
                if let title = plainText(from: object["title"])?.trimmedNonEmpty {
                    return String(title.prefix(300))
                }
            }
        }
        return "Untitled"
    }

    private static func propertySummary(from properties: JSONRecord, selectedNames: Set<String>?) -> JSONRecord {
        properties.reduce(into: JSONRecord()) { partial, element in
            if let selectedNames, !selectedNames.contains(element.key) {
                return
            }
            guard let property = NotionProviderActionAdapterSupport.object(element.value) else {
                partial[element.key] = .object(["type": .string("unknown"), "value": .null])
                return
            }
            let type = property["type"]?.string ?? "unknown"
            partial[element.key] = .object([
                "type": .string(type),
                "value": propertyValueSummary(type: type, property: property)
            ])
        }
    }

    private static func propertyValueSummary(type: String, property: JSONRecord) -> JSONValue {
        switch type {
        case "title", "rich_text":
            return plainText(from: property[type]).map { .string(String($0.prefix(300))) } ?? .null
        case "select", "status":
            return NotionProviderActionAdapterSupport.object(property[type])?["name"] ?? .null
        case "multi_select":
            let names = NotionProviderActionAdapterSupport.array(property[type])
                .compactMap { NotionProviderActionAdapterSupport.object($0)?["name"]?.string }
            return .array(names.map(JSONValue.string))
        case "date":
            let date = NotionProviderActionAdapterSupport.object(property[type]) ?? [:]
            return .object(["start": date["start"] ?? .null, "end": date["end"] ?? .null])
        case "number", "checkbox", "url", "email", "phone_number":
            return property[type] ?? .null
        case "people", "relation", "files":
            return .object(["count": .number(Double(NotionProviderActionAdapterSupport.array(property[type]).count))])
        case "created_time", "last_edited_time":
            return property[type] ?? .null
        case "formula", "rollup", "unique_id":
            return NotionProviderActionAdapterSupport.object(property[type])?["type"] ?? .string(type)
        default:
            return .string(type)
        }
    }

    private static func parentType(from record: JSONRecord) -> JSONValue {
        guard let parent = NotionProviderActionAdapterSupport.object(record["parent"]) else {
            return .null
        }
        return parent["type"] ?? .null
    }

    private static func plainText(from value: JSONValue?) -> String? {
        let values = NotionProviderActionAdapterSupport.array(value)
        if values.isEmpty {
            return value?.string
        }
        let text = values.compactMap { item -> String? in
            guard let object = NotionProviderActionAdapterSupport.object(item) else { return nil }
            return object["plain_text"]?.string
                ?? NotionProviderActionAdapterSupport.object(object["text"])?["content"]?.string
        }.joined(separator: "")
        return text.isEmpty ? nil : text
    }

    private static func richText(_ content: String) -> JSONRecord {
        [
            "type": .string("text"),
            "text": .object(["content": .string(content)])
        ]
    }

    private static func pathEncode(_ value: String) -> String {
        value.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? value
    }
}

public struct NotionProviderActionAdapter: MarketplaceProviderActionAdapter {
    fileprivate static let safeActionKeys: Set<String> = [
        "notion_search",
        "notion_fetch_page",
        "notion_query_data_source",
        "notion_prepare_page",
        "notion_create_page",
        "notion_update_page",
        "notion_create_comment"
    ]

    private let client: any NotionProviderActionClient

    public init(client: any NotionProviderActionClient = FakeNotionProviderActionClient()) {
        self.client = client
    }

    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "notion" else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "notion_adapter_wrong_provider",
                message: "Notion adapter can only execute Notion provider actions.",
                detail: ["appSlug": .string(request.app.slug)]
            )
        }
        guard Self.safeActionKeys.contains(request.definition.actionKey) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "notion_action_not_allowlisted",
                message: "The requested Notion action is not in the V1 adapter allowlist.",
                detail: ["actionKey": .string(request.definition.actionKey)]
            )
        }
        if request.definition.actionKey == "notion_prepare_page" {
            return MarketplaceProviderActionAdapterResult(result: [
                "adapterBoundary": .string("notion-provider-action-adapter"),
                "clientMode": .string("local-notion-draft"),
                "provider": .string("notion"),
                "permission": .string(request.permission.rawValue),
                "payloadHash": .string(MarketplaceProviderActionApprovalService.payloadHash(request.payload)),
                "approved": .bool(request.approvalReference?.status == .approved),
                "idempotencyKey": .string(request.idempotencyKey),
                "actionKey": .string(request.definition.actionKey),
                "fakeAdapter": .bool(false),
                "liveCredentialsUsed": .bool(false),
                "simulated": .bool(false),
                "draftPreview": .object(NotionProviderActionAdapterSupport.draftPreview(request: request)),
                "redactionStatus": .string("private-state-excluded")
            ])
        }
        let output = try client.executeNotionAction(request: request)
        return MarketplaceProviderActionAdapterResult(
            result: output.result,
            error: nil,
            redactionStatus: output.redactionStatus
        )
    }
}

private enum NotionProviderActionAdapterSupport {
    static func requiredPayloadString(
        request: MarketplaceProviderActionAdapterRequest,
        key: String,
        label: String
    ) throws -> String {
        guard let value = request.payload[key]?.string?.trimmedNonEmpty else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "notion_payload_missing_\(key)",
                message: "Notion action payload requires a non-empty \(label)."
            )
        }
        return value
    }

    static func boundedInt(_ value: JSONValue?, defaultValue: Int, minValue: Int, maxValue: Int) -> Int {
        let raw: Int?
        if let number = value?.number {
            raw = Int(number)
        } else if let string = value?.string?.trimmedNonEmpty {
            raw = Int(string)
        } else {
            raw = nil
        }
        return min(max(raw ?? defaultValue, minValue), maxValue)
    }

    static func draftPreview(request: MarketplaceProviderActionAdapterRequest) -> JSONRecord {
        let intent = request.payload["intent"]?.string?.trimmedNonEmpty ?? "prepare_page_payload"
        var normalized: JSONRecord = [
            "intent": .string(intent),
            "payloadHash": .string(MarketplaceProviderActionApprovalService.payloadHash(request.payload)),
            "localOnly": .bool(true),
            "redactionStatus": .string("private-state-excluded")
        ]
        for key in ["parentId", "pageId", "blockId", "discussionId", "title"] {
            if let value = request.payload[key]?.string?.trimmedNonEmpty {
                normalized[key] = .string(value)
            }
        }
        if let markdown = request.payload["markdown"]?.string?.trimmedNonEmpty {
            normalized["markdownCharCount"] = .number(Double(markdown.count))
            normalized["markdownExcerpt"] = .string(String(markdown.prefix(700)))
        }
        if let comment = request.payload["comment"]?.string?.trimmedNonEmpty {
            normalized["commentCharCount"] = .number(Double(comment.count))
            normalized["commentExcerpt"] = .string(String(comment.prefix(500)))
        }
        if let properties = object(request.payload["properties"]) {
            normalized["propertyKeys"] = .array(properties.keys.sorted().map(JSONValue.string))
        }
        return normalized
    }

    static func commentTarget(from request: MarketplaceProviderActionAdapterRequest) throws -> (kind: String, value: String) {
        let pageId = request.payload["pageId"]?.string?.trimmedNonEmpty
        let blockId = request.payload["blockId"]?.string?.trimmedNonEmpty
        let discussionId = request.payload["discussionId"]?.string?.trimmedNonEmpty
        let present = [pageId, blockId, discussionId].compactMap { $0 }
        guard present.count == 1 else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "notion_comment_target_required",
                message: "Notion comments require exactly one of pageId, blockId, or discussionId."
            )
        }
        if let pageId { return ("page_id", pageId) }
        if let blockId { return ("block_id", blockId) }
        return ("discussion_id", discussionId ?? "")
    }

    static func notionId(from value: String) -> String {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let url = URL(string: trimmed), url.scheme != nil else {
            return trimmed
        }
        let last = url.lastPathComponent
        let withoutQuery = last.split(separator: "?").first.map(String.init) ?? last
        if let id = withoutQuery.split(separator: "-").last, id.count >= 32 {
            return String(id)
        }
        return withoutQuery
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

    static func stringArray(_ value: JSONValue?) -> [String] {
        array(value).compactMap { $0.string?.trimmedNonEmpty }
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

    static func bodySnippet(_ data: Data) -> String {
        guard let body = String(data: data, encoding: .utf8), !body.isEmpty else {
            return ""
        }
        return String(body.prefix(800))
    }

    static func stableSuffix(_ value: String) -> String {
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
