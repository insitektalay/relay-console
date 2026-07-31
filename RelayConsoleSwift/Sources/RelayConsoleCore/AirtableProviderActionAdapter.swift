import Foundation

public struct AirtableProviderActionClientResult: Codable, Equatable, Sendable { public var result: JSONRecord; public var redactionStatus: String; public init(result: JSONRecord, redactionStatus: String = "private-state-excluded") { self.result = result; self.redactionStatus = redactionStatus } }
public protocol AirtableProviderActionClient: Sendable { func executeAirtableAction(request: MarketplaceProviderActionAdapterRequest) throws -> AirtableProviderActionClientResult }
public struct AirtableProviderHTTPRequest: Sendable, Equatable {
    public var method: String; public var url: URL; public var headers: [String: String]; public var body: Data?; public init(method: String, url: URL, headers: [String: String] = [:], body: Data? = nil) { self.method = method; self.url = url; self.headers = headers; self.body = body }
}
public struct AirtableProviderHTTPResponse: Sendable, Equatable {
    public var statusCode: Int; public var headers: [String: String]; public var body: Data; public init(statusCode: Int, headers: [String: String] = [:], body: Data = Data()) { self.statusCode = statusCode; self.headers = headers; self.body = body }
}
public protocol AirtableProviderHTTPClient: Sendable { func send(_ request: AirtableProviderHTTPRequest) throws -> AirtableProviderHTTPResponse }
public struct URLSessionAirtableProviderHTTPClient: AirtableProviderHTTPClient {
    private let timeout: TimeInterval; public init(timeoutSeconds: TimeInterval = 20) { timeout = timeoutSeconds }
    public func send(_ request: AirtableProviderHTTPRequest) throws -> AirtableProviderHTTPResponse {
        var value = URLRequest(url: request.url); value.httpMethod = request.method; value.timeoutInterval = timeout; value.httpBody = request.body; request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) }; let semaphore = DispatchSemaphore(value: 0); var data: Data?;
        var response: HTTPURLResponse?; var failure: Error?;
        let task = URLSession.shared.dataTask(with: value) {
            data = $0; response = $1 as? HTTPURLResponse; failure = $2; semaphore.signal()
        }; task.resume(); if semaphore.wait(timeout: .now() + timeout) == .timedOut { task.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "airtable_http_timeout", message: "Airtable API request timed out.") }; if let failure { throw failure };
        let headers = response?.allHeaderFields.reduce(into: [String: String]()) { $0[String(describing: $1.key)] = String(describing: $1.value) } ?? [:]; return AirtableProviderHTTPResponse(statusCode: response?.statusCode ?? 0, headers: headers, body: data ?? Data())
    }
}

public struct FakeAirtableProviderActionClient: AirtableProviderActionClient {
    public init() {}
    public func executeAirtableAction(request: MarketplaceProviderActionAdapterRequest) throws -> AirtableProviderActionClientResult {
        switch request.definition.actionKey {
        case "airtable_base_list":
            let n = AirtableProviderActionSupport.bound(request.payload["maxResults"], 5, 25);
            return out(request, ["semanticReadContract": .string("airtable-base-list-v1"), "bases": .array((0..<n).map { .object(["id": .string("appBase\($0 + 1)"), "name": .string("Airtable Base \($0 + 1)"), "permissionLevel": .string("create"), "workspace": .string("Relay Workspace")]) })])
        case "airtable_base_schema_get":
            let base = try AirtableProviderActionSupport.need(request.payload, "baseId"); return out(request, ["semanticReadContract": .string("airtable-base-schema-v1"), "base": .object(["id": .string(base), "tables": .array([.object(AirtableProviderActionSupport.fakeTable())])])])
        case "airtable_table_records":
            let base = try AirtableProviderActionSupport.need(request.payload, "baseId"), table = try AirtableProviderActionSupport.need(request.payload, "tableId"), n = AirtableProviderActionSupport.bound(request.payload["maxResults"], 5, 50);
            return out(request, ["semanticReadContract": .string("airtable-table-records-v1"), "baseId": .string(base), "tableId": .string(table), "records": .array((0..<n).map { .object(AirtableProviderActionSupport.fakeRecord($0, base, table)) })])
        case "airtable_record_get":
            let base = try AirtableProviderActionSupport.need(request.payload, "baseId"), table = try AirtableProviderActionSupport.need(request.payload, "tableId"), id = try AirtableProviderActionSupport.need(request.payload, "recordId");
            var record = AirtableProviderActionSupport.fakeRecord(0, base, table); record["id"] = .string(id); record["comments"] = .array([.object(AirtableProviderActionSupport.fakeComment(0))]);
            return out(request, ["semanticReadContract": .string("airtable-record-get-v1"), "record": .object(record)])
        case "airtable_record_comments":
            let id = try AirtableProviderActionSupport.need(request.payload, "recordId"), n = AirtableProviderActionSupport.bound(request.payload["maxResults"], 5, 25);
            return out(request, ["semanticReadContract": .string("airtable-record-comments-v1"), "recordId": .string(id), "comments": .array((0..<n).map { .object(AirtableProviderActionSupport.fakeComment($0)) })])
        case "airtable_record_prepare":
            let normalized = try AirtableProviderActionSupport.normalized(request.payload, request.payload["operation"]?.string ?? "create");
            return out(request, ["draftPreview": .object(["payload": .object(normalized), "payloadHash": .string(MarketplaceProviderActionApprovalService.payloadHash(normalized)), "providerMutation": .bool(false)])])
        case "airtable_record_create", "airtable_record_update", "airtable_record_comment_create":
            let operation = request.definition.actionKey == "airtable_record_create" ? "create" : request.definition.actionKey == "airtable_record_update" ? "update" : "comment";
            let normalized = try AirtableProviderActionSupport.normalized(request.payload, operation), hash = MarketplaceProviderActionApprovalService.payloadHash(normalized);
            return out(
                request,
                [
                    "id": .string(normalized["recordId"]?.string ?? "rec\(AirtableProviderActionSupport.suffix(hash))"), "commentId": operation == "comment" ? .string("com\(AirtableProviderActionSupport.suffix(hash))") : .null, "createdTime": .string("2026-07-11T00:00:00Z"),
                    "fields": normalized["fields"] ?? .object([:]), "textExcerpt": normalized["comment"] ?? .null, "payloadHash": .string(hash), "auditId": .string(request.auditIdentity.dispatchId ?? request.idempotencyKey),
                ])
        default: throw MarketplaceProviderActionAdapterFailure(code: "airtable_fake_action_not_supported", message: "The fake Airtable client does not support this action.")
        }
    }
    private func out(_ request: MarketplaceProviderActionAdapterRequest, _ fields: JSONRecord) -> AirtableProviderActionClientResult { AirtableProviderActionClientResult(result: base(request).merging(fields) { _, n in n }) }
    private func base(_ request: MarketplaceProviderActionAdapterRequest) -> JSONRecord {
        [
            "fakeAdapter": .bool(true), "adapterBoundary": .string("airtable-provider-action-adapter"), "clientMode": .string("fake-airtable-rest-client"), "provider": .string("airtable"), "permission": .string(request.permission.rawValue),
            "payloadHash": .string(MarketplaceProviderActionApprovalService.payloadHash(request.payload)), "approved": .bool(request.approvalReference?.status == .approved), "idempotencyKey": .string(request.idempotencyKey), "liveCredentialsUsed": .bool(false),
            "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-state-excluded"),
        ]
    }
}

public final class LiveAirtableProviderActionClient: AirtableProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService; private let secrets: SecretService; private let http: any AirtableProviderHTTPClient
    public init(data: LocalDataService, secrets: SecretService, httpClient: any AirtableProviderHTTPClient = URLSessionAirtableProviderHTTPClient()) { self.data = data; self.secrets = secrets; self.http = httpClient }
    public func executeAirtableAction(request: MarketplaceProviderActionAdapterRequest) throws -> AirtableProviderActionClientResult {
        if request.definition.actionKey == "airtable_record_prepare" { return try FakeAirtableProviderActionClient().executeAirtableAction(request: request) }; let token = try accessToken(request);
        switch request.definition.actionKey {
        case "airtable_base_list": return try bases(request, token);
        case "airtable_base_schema_get": return try schema(request, token);
        case "airtable_table_records": return try records(request, token);
        case "airtable_record_get": return try record(request, token);
        case "airtable_record_comments": return try comments(request, token);
        case "airtable_record_create": return try write(request, token, "create");
        case "airtable_record_update": return try write(request, token, "update");
        case "airtable_record_comment_create": return try write(request, token, "comment");
        default: throw MarketplaceProviderActionAdapterFailure(code: "airtable_live_action_not_supported", message: "Live Airtable execution does not support this action.")
        }
    }
    private func bases(_ request: MarketplaceProviderActionAdapterRequest, _ token: String) throws -> AirtableProviderActionClientResult {
        let n = AirtableProviderActionSupport.bound(request.payload["maxResults"], 5, 25), json = try send("GET", "/v0/meta/bases", [URLQueryItem(name: "pageSize", value: "\(n)")], nil, token), values = json.airObject?["bases"]?.airArray ?? [];
        return out(request, ["semanticReadContract": .string("airtable-base-list-v1"), "bases": .array(values.prefix(n).map { .object(AirtableProviderActionSupport.base($0)) })])
    }
    private func schema(_ request: MarketplaceProviderActionAdapterRequest, _ token: String) throws -> AirtableProviderActionClientResult {
        let baseId = try AirtableProviderActionSupport.need(request.payload, "baseId"), n = AirtableProviderActionSupport.bound(request.payload["maxTables"], 10, 25), json = try send("GET", "/v0/meta/bases/\(AirtableProviderActionSupport.path(baseId))/tables", [], nil, token),
            values = json.airObject?["tables"]?.airArray ?? []
        ; return out(request, ["semanticReadContract": .string("airtable-base-schema-v1"), "base": .object(["id": .string(baseId), "tables": .array(values.prefix(n).map { .object(AirtableProviderActionSupport.table($0)) })])])
    }
    private func records(_ request: MarketplaceProviderActionAdapterRequest, _ token: String) throws -> AirtableProviderActionClientResult {
        let base = try AirtableProviderActionSupport.need(request.payload, "baseId"), table = try AirtableProviderActionSupport.need(request.payload, "tableId"), n = AirtableProviderActionSupport.bound(request.payload["maxResults"], 10, 50);
        var q = [URLQueryItem(name: "pageSize", value: "\(n)"), URLQueryItem(name: "returnFieldsByFieldId", value: "false")]; if let v = request.payload["viewId"]?.string?.airNonEmpty { q.append(URLQueryItem(name: "view", value: v)) };
        if let f = request.payload["filterFormula"]?.string?.airNonEmpty {
            guard f.count <= 1000 else { throw MarketplaceProviderActionAdapterFailure(code: "airtable_filter_too_large", message: "Airtable filter formula exceeds Relay V1 bounds.") }; q.append(URLQueryItem(name: "filterByFormula", value: f))
        }; let json = try send("GET", "/v0/\(AirtableProviderActionSupport.path(base))/\(AirtableProviderActionSupport.path(table))", q, nil, token), values = json.airObject?["records"]?.airArray ?? [];
        return out(
            request, ["semanticReadContract": .string("airtable-table-records-v1"), "baseId": .string(base), "tableId": .string(table), "records": .array(values.prefix(n).map { .object(AirtableProviderActionSupport.record($0, base, table)) }), "nextOffset": json.airObject?["offset"] ?? .null])
    }
    private func record(_ request: MarketplaceProviderActionAdapterRequest, _ token: String) throws -> AirtableProviderActionClientResult {
        let base = try AirtableProviderActionSupport.need(request.payload, "baseId"), table = try AirtableProviderActionSupport.need(request.payload, "tableId"), id = try AirtableProviderActionSupport.need(request.payload, "recordId"),
            value = try send("GET", "/v0/\(AirtableProviderActionSupport.path(base))/\(AirtableProviderActionSupport.path(table))/\(AirtableProviderActionSupport.path(id))", [URLQueryItem(name: "returnFieldsByFieldId", value: "false")], nil, token)
        ; let commentJSON = try send("GET", "/v0/\(AirtableProviderActionSupport.path(base))/\(AirtableProviderActionSupport.path(table))/\(AirtableProviderActionSupport.path(id))/comments", [URLQueryItem(name: "pageSize", value: "5")], nil, token);
        var summary = AirtableProviderActionSupport.record(value, base, table); summary["comments"] = .array((commentJSON.airObject?["comments"]?.airArray ?? []).prefix(5).map { .object(AirtableProviderActionSupport.comment($0, 1000)) });
        return out(request, ["semanticReadContract": .string("airtable-record-get-v1"), "record": .object(summary)])
    }
    private func comments(_ request: MarketplaceProviderActionAdapterRequest, _ token: String) throws -> AirtableProviderActionClientResult {
        let base = try AirtableProviderActionSupport.need(request.payload, "baseId"), table = try AirtableProviderActionSupport.need(request.payload, "tableId"), id = try AirtableProviderActionSupport.need(request.payload, "recordId"),
            n = AirtableProviderActionSupport.bound(request.payload["maxResults"], 5, 25), text = AirtableProviderActionSupport.bound(request.payload["maxTextChars"], 1000, 4000),
            json = try send("GET", "/v0/\(AirtableProviderActionSupport.path(base))/\(AirtableProviderActionSupport.path(table))/\(AirtableProviderActionSupport.path(id))/comments", [URLQueryItem(name: "pageSize", value: "\(n)")], nil, token), values = json.airObject?["comments"]?.airArray ?? []
        ; return out(request, ["semanticReadContract": .string("airtable-record-comments-v1"), "recordId": .string(id), "comments": .array(values.prefix(n).map { .object(AirtableProviderActionSupport.comment($0, text)) })])
    }
    private func write(_ request: MarketplaceProviderActionAdapterRequest, _ token: String, _ operation: String) throws -> AirtableProviderActionClientResult {
        let normalized = try AirtableProviderActionSupport.normalized(request.payload, operation), base = normalized["baseId"]?.string ?? "", table = normalized["tableId"]?.string ?? "", id = normalized["recordId"]?.string;
        let path =
            operation == "create"
            ? "/v0/\(AirtableProviderActionSupport.path(base))/\(AirtableProviderActionSupport.path(table))"
            : operation == "update"
                ? "/v0/\(AirtableProviderActionSupport.path(base))/\(AirtableProviderActionSupport.path(table))/\(AirtableProviderActionSupport.path(id ?? ""))"
                : "/v0/\(AirtableProviderActionSupport.path(base))/\(AirtableProviderActionSupport.path(table))/\(AirtableProviderActionSupport.path(id ?? ""))/comments";
        var body: [String: Any];
        if operation == "comment" {
            body = ["text": normalized["comment"]?.string ?? ""]; if let parent = normalized["parentCommentId"]?.string { body["parentCommentId"] = parent }
        } else {
            body = ["fields": AirtableProviderActionSupport.foundation(normalized["fields"] ?? .object([:]))]; if let typecast = normalized["typecast"]?.bool { body["typecast"] = typecast }
        }; let value = try send(operation == "update" ? "PATCH" : "POST", path, [], try JSONSerialization.data(withJSONObject: body), token), object = value.airObject ?? [:], hash = MarketplaceProviderActionApprovalService.payloadHash(normalized);
        return out(
            request,
            [
                "id": object["id"] ?? id.map(JSONValue.string) ?? .null, "commentId": operation == "comment" ? object["id"] ?? .null : .null, "createdTime": object["createdTime"] ?? .null, "fields": object["fields"].map { AirtableProviderActionSupport.safe($0) } ?? .object([:]),
                "textExcerpt": object["text"].map { .string(String(($0.string ?? "").prefix(1000))) } ?? .null, "author": object["author"]?.airObject?["name"] ?? .null, "payloadHash": .string(hash), "auditId": .string(request.auditIdentity.dispatchId ?? request.idempotencyKey),
            ])
    }
    private func accessToken(_ request: MarketplaceProviderActionAdapterRequest) throws -> String {
        guard let id = request.auditIdentity.connectionId?.airNonEmpty, let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), connection.appSlug == "airtable", connection.appId == request.app.id,
            connection.status == .connected || connection.status == .healthError
        else { throw MarketplaceProviderActionAdapterFailure(code: "airtable_connection_not_ready", message: "Airtable execution requires a ready Relay Marketplace connection.") };
        guard let ref = connection.credentialRequirements.first(where: { $0.fieldKey == "airtable_oauth_access_token" })?.secretReferenceId?.airNonEmpty else {
            throw MarketplaceProviderActionAdapterFailure(code: "airtable_credentials_missing", message: "The Airtable connection is missing its Keychain access-token reference.")
        }; do { return try secrets.getSecretValue(ref) } catch { throw MarketplaceProviderActionAdapterFailure(code: "airtable_credentials_unavailable", message: "Relay could not read the saved Airtable access token. Refresh or reconnect Airtable.") }
    }
    private func send(_ method: String, _ path: String, _ query: [URLQueryItem], _ body: Data?, _ token: String) throws -> JSONValue {
        var components = URLComponents(string: "https://api.airtable.com\(path)"); components?.queryItems = query.isEmpty ? nil : query; guard let url = components?.url else { throw MarketplaceProviderActionAdapterFailure(code: "airtable_invalid_url", message: "Could not build the Airtable URL.") };
        let response = try http.send(AirtableProviderHTTPRequest(method: method, url: url, headers: ["Authorization": "Bearer \(token)", "Accept": "application/json", "Content-Type": "application/json"], body: body));
        guard (200..<300).contains(response.statusCode) else {
            let code = response.statusCode == 429 ? "airtable_rate_limited" : response.statusCode == 401 ? "airtable_access_token_expired" : "airtable_http_error";
            throw MarketplaceProviderActionAdapterFailure(
                code: code, message: response.statusCode == 401 ? "Airtable access token expired; serialize refresh-token rotation or reconnect." : "Airtable API returned an HTTP error.", providerStatusCode: response.statusCode,
                detail: ["retryAfterSeconds": .number(response.statusCode == 429 ? 30 : 0)])
        }; return response.body.isEmpty ? .object([:]) : AirtableProviderActionSupport.json(try JSONSerialization.jsonObject(with: response.body))
    }
    private func out(_ request: MarketplaceProviderActionAdapterRequest, _ fields: JSONRecord) -> AirtableProviderActionClientResult {
        let base: JSONRecord = [
            "adapterBoundary": .string("airtable-provider-action-adapter"), "clientMode": .string("live-airtable-v0-rest"), "provider": .string("airtable"), "permission": .string(request.permission.rawValue),
            "payloadHash": .string(MarketplaceProviderActionApprovalService.payloadHash(request.payload)), "approved": .bool(request.approvalReference?.status == .approved), "idempotencyKey": .string(request.idempotencyKey), "liveCredentialsUsed": .bool(true),
            "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-state-excluded"),
        ]
            ;
        return AirtableProviderActionClientResult(result: base.merging(fields) { _, n in n })
    }
}

public struct AirtableProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = ["airtable_base_list", "airtable_base_schema_get", "airtable_table_records", "airtable_record_get", "airtable_record_comments", "airtable_record_prepare", "airtable_record_create", "airtable_record_update", "airtable_record_comment_create"];
    private let client: any AirtableProviderActionClient; public init(client: any AirtableProviderActionClient = FakeAirtableProviderActionClient()) { self.client = client };
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "airtable" else { throw MarketplaceProviderActionAdapterFailure(code: "airtable_adapter_wrong_provider", message: "Airtable adapter can execute only Airtable actions.") };
        guard Self.allowed.contains(request.definition.actionKey) else { throw MarketplaceProviderActionAdapterFailure(code: "airtable_action_not_allowlisted", message: "The requested Airtable action is not in the V1 allowlist.") }; let result = try client.executeAirtableAction(request: request);
        return MarketplaceProviderActionAdapterResult(result: result.result, error: nil, redactionStatus: result.redactionStatus)
    }
}

public enum AirtableProviderActionSupport {
    public static func need(_ p: JSONRecord, _ k: String) throws -> String { guard let v = p[k]?.string?.airNonEmpty else { throw MarketplaceProviderActionAdapterFailure(code: "airtable_missing_required_field", message: "Airtable \(k) is required.", detail: ["field": .string(k)]) }; return v }
    public static func bound(_ v: JSONValue?, _ d: Int, _ m: Int) -> Int { max(1, min(m, v?.number.map(Int.init) ?? v?.string.flatMap(Int.init) ?? d)) }
    public static func normalized(_ p: JSONRecord, _ operation: String) throws -> JSONRecord {
        var o: JSONRecord = ["baseId": .string(try need(p, "baseId")), "tableId": .string(try need(p, "tableId"))];
        if operation == "create" { guard case .object(let f)? = p["fields"], !f.isEmpty else { throw MarketplaceProviderActionAdapterFailure(code: "airtable_fields_required", message: "Airtable record creation requires fields.") }; o["fields"] = .object(f) };
        if operation == "update" {
            o["recordId"] = .string(try need(p, "recordId")); guard case .object(let f)? = p["fields"], !f.isEmpty else { throw MarketplaceProviderActionAdapterFailure(code: "airtable_fields_required", message: "Airtable record update requires fields.") }; o["fields"] = .object(f)
        }; if operation == "comment" { o["recordId"] = .string(try need(p, "recordId")); o["comment"] = .string(try need(p, "comment")); if let v = p["parentCommentId"]?.string?.airNonEmpty { o["parentCommentId"] = .string(v) } }; if let v = p["typecast"]?.bool { o["typecast"] = .bool(v) };
        guard o["comment"]?.string?.count ?? 0 <= 8000 else { throw MarketplaceProviderActionAdapterFailure(code: "airtable_comment_too_large", message: "Airtable comment exceeds Relay V1 bounds.") }; return o
    }
    public static func base(_ v: JSONValue) -> JSONRecord {
        let o = v.airObject ?? [:]; return ["id": o["id"] ?? .null, "name": o["name"] ?? .null, "permissionLevel": o["permissionLevel"] ?? .null, "workspace": o["workspaceName"] ?? o["workspace"]?.airObject?["name"] ?? .null, "redactionStatus": .string("private-state-excluded")]
    }
    public static func table(_ v: JSONValue) -> JSONRecord {
        let o = v.airObject ?? [:];
        return [
            "id": o["id"] ?? .null, "name": o["name"] ?? .null, "description": o["description"] ?? .null, "primaryFieldId": o["primaryFieldId"] ?? .null,
            "fields": .array(
                (o["fields"]?.airArray ?? []).map {
                    let f = $0.airObject ?? [:]; return .object(["id": f["id"] ?? .null, "name": f["name"] ?? .null, "type": f["type"] ?? .null, "description": f["description"] ?? .null])
                }),
            "views": .array(
                (o["views"]?.airArray ?? []).map {
                    let x = $0.airObject ?? [:]; return .object(["id": x["id"] ?? .null, "name": x["name"] ?? .null, "type": x["type"] ?? .null])
                }),
        ]
    }
    public static func record(_ v: JSONValue, _ base: String, _ table: String) -> JSONRecord {
        let o = v.airObject ?? [:]; return ["id": o["id"] ?? .null, "createdTime": o["createdTime"] ?? .null, "baseId": .string(base), "tableId": .string(table), "fields": o["fields"].map { safe($0) } ?? .object([:]), "redactionStatus": .string("private-state-excluded")]
    }
    public static func comment(_ v: JSONValue, _ limit: Int) -> JSONRecord {
        let o = v.airObject ?? [:], text = o["text"]?.string ?? "";
        return [
            "id": o["id"] ?? .null, "textExcerpt": .string(String(text.prefix(limit))), "author": o["author"]?.airObject?["name"] ?? .null, "createdTime": o["createdTime"] ?? .null, "lastUpdatedTime": o["lastUpdatedTime"] ?? .null, "parentCommentId": o["parentCommentId"] ?? .null,
            "reactionCount": .number(Double(o["reactions"]?.airArray?.count ?? 0)), "truncated": .bool(text.count > limit), "redactionStatus": .string("private-state-excluded"),
        ]
    }
    public static func safe(_ v: JSONValue, depth: Int = 0) -> JSONValue {
        if depth > 3 { return .string("[TRUNCATED]") };
        switch v {
        case .string(let s): return .string(String(s.prefix(4000)));
        case .array(let a): return .array(a.prefix(25).map { safe($0, depth: depth + 1) });
        case .object(let o): var result: JSONRecord = [:]; for (k, value) in o.prefix(50) { if k.lowercased() == "url" || k.lowercased().contains("thumbnail") { result[k] = .string("[ATTACHMENT_METADATA_REDACTED]") } else { result[k] = safe(value, depth: depth + 1) } }; return .object(result);
        default: return v
        }
    }
    public static func fakeTable() -> JSONRecord {
        [
            "id": .string("tblTasks"), "name": .string("Tasks"), "description": .string("Relay launch work"), "primaryFieldId": .string("fldName"),
            "fields": .array([.object(["id": .string("fldName"), "name": .string("Name"), "type": .string("singleLineText")]), .object(["id": .string("fldStatus"), "name": .string("Status"), "type": .string("singleSelect")])]),
            "views": .array([.object(["id": .string("viwAll"), "name": .string("All tasks"), "type": .string("grid")])]),
        ]
    }
    public static func fakeRecord(_ i: Int, _ b: String, _ t: String) -> JSONRecord {
        [
            "id": .string("rec\(i + 1)"), "createdTime": .string("2026-07-11T00:00:00Z"), "baseId": .string(b), "tableId": .string(t), "fields": .object(["Name": .string("Airtable record \(i + 1)"), "Status": .string("In progress"), "Priority": .number(Double(i + 1))]),
            "redactionStatus": .string("private-state-excluded"),
        ]
    }
    public static func fakeComment(_ i: Int) -> JSONRecord {
        [
            "id": .string("com\(i + 1)"), "textExcerpt": .string("Airtable comment \(i + 1)"), "author": .string("Relay Owner"), "createdTime": .string("2026-07-11T00:00:00Z"), "lastUpdatedTime": .string("2026-07-11T00:00:00Z"), "parentCommentId": .null, "reactionCount": .number(0),
            "truncated": .bool(false),
        ]
    }
    public static func foundation(_ v: JSONValue) -> Any { switch v { case .string(let x): return x; case .number(let x): return x; case .bool(let x): return x; case .array(let x): return x.map(foundation); case .object(let x): return x.mapValues(foundation); case .null: return NSNull() } }
    public static func path(_ s: String) -> String { s.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed)?.replacingOccurrences(of: "?", with: "%3F") ?? s }
    public static func suffix(_ s: String) -> String { var h: UInt64 = 1469598103934665603; for b in s.utf8 { h ^= UInt64(b); h &*= 1099511628211 }; return String(String(h, radix: 16).suffix(10)) }
    public static func json(_ v: Any) -> JSONValue {
        if let x = v as? String { return .string(x) }; if let x = v as? Bool { return .bool(x) }; if let x = v as? Int { return .number(Double(x)) }; if let x = v as? Double { return .number(x) }; if let x = v as? [String: Any] { return .object(x.mapValues(json)) };
        if let x = v as? [Any] { return .array(x.map(json)) }; if v is NSNull { return .null }; return .string(String(describing: v))
    }
}
private extension JSONValue { var airObject: JSONRecord? { if case .object(let v) = self { return v }; return nil }; var airArray: [JSONValue]? { if case .array(let v) = self { return v }; return nil } }
private extension String { var airNonEmpty: String? { let v = trimmingCharacters(in: .whitespacesAndNewlines); return v.isEmpty ? nil : v } }
