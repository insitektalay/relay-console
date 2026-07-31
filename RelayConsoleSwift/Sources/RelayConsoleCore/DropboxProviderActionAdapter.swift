import Foundation

public struct DropboxProviderActionClientResult: Codable, Equatable, Sendable {
    public var result: JSONRecord
    public var redactionStatus: String
    public init(result: JSONRecord, redactionStatus: String = "private-state-excluded") { self.result = result; self.redactionStatus = redactionStatus }
}

public protocol DropboxProviderActionClient: Sendable {
    func executeDropboxAction(request: MarketplaceProviderActionAdapterRequest) throws -> DropboxProviderActionClientResult
}

public struct DropboxProviderHTTPRequest: Sendable, Equatable {
    public var method: String; public var url: URL; public var headers: [String: String]; public var body: Data?
    public init(method: String, url: URL, headers: [String: String] = [:], body: Data? = nil) { self.method = method; self.url = url; self.headers = headers; self.body = body }
}
public struct DropboxProviderHTTPResponse: Sendable, Equatable {
    public var statusCode: Int; public var headers: [String: String]; public var body: Data
    public init(statusCode: Int, headers: [String: String] = [:], body: Data = Data()) { self.statusCode = statusCode; self.headers = headers; self.body = body }
}
public protocol DropboxProviderHTTPClient: Sendable { func send(_ request: DropboxProviderHTTPRequest) throws -> DropboxProviderHTTPResponse }
public struct URLSessionDropboxProviderHTTPClient: DropboxProviderHTTPClient {
    private let timeout: TimeInterval
    public init(timeoutSeconds: TimeInterval = 20) { timeout = timeoutSeconds }
    public func send(_ request: DropboxProviderHTTPRequest) throws -> DropboxProviderHTTPResponse {
        var value = URLRequest(url: request.url); value.httpMethod = request.method; value.timeoutInterval = timeout; value.httpBody = request.body
        request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) }
        let semaphore = DispatchSemaphore(value: 0); var data: Data?; var response: HTTPURLResponse?; var failure: Error?
        let task = URLSession.shared.dataTask(with: value) { data = $0; response = $1 as? HTTPURLResponse; failure = $2; semaphore.signal() }
        task.resume()
        if semaphore.wait(timeout: .now() + timeout) == .timedOut { task.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "dropbox_http_timeout", message: "Dropbox API request timed out.") }
        if let failure { throw failure }
        let headers = response?.allHeaderFields.reduce(into: [String: String]()) { $0[String(describing: $1.key)] = String(describing: $1.value) } ?? [:]
        return DropboxProviderHTTPResponse(statusCode: response?.statusCode ?? 0, headers: headers, body: data ?? Data())
    }
}

public struct FakeDropboxProviderActionClient: DropboxProviderActionClient {
    public init() {}
    public func executeDropboxAction(request: MarketplaceProviderActionAdapterRequest) throws -> DropboxProviderActionClientResult {
        switch request.definition.actionKey {
        case "dropbox_folder_list":
            let path = request.payload["path"]?.string ?? "", count = DropboxProviderActionSupport.bound(request.payload["maxResults"], 5, 50)
            return out(request, ["semanticReadContract": .string("dropbox-folder-entries-v1"), "path": .string(path), "entries": .array((0..<count).map { .object(DropboxProviderActionSupport.fakeEntry($0, path)) }), "cursor": .string("dbx-cursor-\(count)"), "hasMore": .bool(false)])
        case "dropbox_entry_get":
            let path = try DropboxProviderActionSupport.need(request.payload, "path")
            return out(request, ["semanticReadContract": .string("dropbox-entry-metadata-v1"), "entry": .object(DropboxProviderActionSupport.fakeEntry(0, path, exactPath: true))])
        case "dropbox_file_search":
            let query = try DropboxProviderActionSupport.need(request.payload, "query"), count = DropboxProviderActionSupport.bound(request.payload["maxResults"], 5, 25), path = request.payload["path"]?.string ?? ""
            return out(request, ["semanticReadContract": .string("dropbox-file-search-v1"), "query": .string(query), "matches": .array((0..<count).map { .object(["matchType": .string("filename"), "metadata": .object(DropboxProviderActionSupport.fakeEntry($0, path))]) }), "hasMore": .bool(false)])
        case "dropbox_text_upload_prepare":
            let normalized = try DropboxProviderActionSupport.normalized(request.payload, "upload"), hash = MarketplaceProviderActionApprovalService.payloadHash(normalized)
            return out(request, ["draftPreview": .object(["payload": .object(normalized), "textByteCount": .number(Double(normalized["text"]?.string?.utf8.count ?? 0)), "payloadHash": .string(hash), "providerMutation": .bool(false)])])
        case "dropbox_folder_create", "dropbox_text_upload", "dropbox_entry_copy", "dropbox_entry_move":
            let operation = DropboxProviderActionSupport.operation(request.definition.actionKey), normalized = try DropboxProviderActionSupport.normalized(request.payload, operation), hash = MarketplaceProviderActionApprovalService.payloadHash(normalized)
            let destination = normalized["path"]?.string ?? normalized["toPath"]?.string ?? "/Relay"
            return out(request, ["entry": .object(DropboxProviderActionSupport.fakeEntry(0, destination, exactPath: true, folder: operation == "folder")), "operation": .string(operation), "payloadHash": .string(hash), "auditId": .string(request.auditIdentity.dispatchId ?? request.idempotencyKey)])
        default: throw MarketplaceProviderActionAdapterFailure(code: "dropbox_fake_action_not_supported", message: "The fake Dropbox client does not support this action.")
        }
    }
    private func out(_ request: MarketplaceProviderActionAdapterRequest, _ fields: JSONRecord) -> DropboxProviderActionClientResult {
        let base: JSONRecord = [
            "fakeAdapter": .bool(true), "adapterBoundary": .string("dropbox-provider-action-adapter"), "clientMode": .string("fake-dropbox-api-v2-client"), "provider": .string("dropbox"), "permission": .string(request.permission.rawValue),
            "payloadHash": .string(MarketplaceProviderActionApprovalService.payloadHash(request.payload)), "approved": .bool(request.approvalReference?.status == .approved), "idempotencyKey": .string(request.idempotencyKey), "liveCredentialsUsed": .bool(false),
            "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-state-excluded"),
        ]
        return DropboxProviderActionClientResult(result: base.merging(fields) { _, new in new })
    }
}

public final class LiveDropboxProviderActionClient: DropboxProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService; private let secrets: SecretService; private let http: any DropboxProviderHTTPClient
    public init(data: LocalDataService, secrets: SecretService, httpClient: any DropboxProviderHTTPClient = URLSessionDropboxProviderHTTPClient()) { self.data = data; self.secrets = secrets; self.http = httpClient }
    public func executeDropboxAction(request: MarketplaceProviderActionAdapterRequest) throws -> DropboxProviderActionClientResult {
        if request.definition.actionKey == "dropbox_text_upload_prepare" { return try FakeDropboxProviderActionClient().executeDropboxAction(request: request) }
        let token = try accessToken(request)
        switch request.definition.actionKey {
        case "dropbox_folder_list": return try folderList(request, token)
        case "dropbox_entry_get": return try entryGet(request, token)
        case "dropbox_file_search": return try fileSearch(request, token)
        case "dropbox_folder_create": return try mutation(request, token, "folder")
        case "dropbox_text_upload": return try mutation(request, token, "upload")
        case "dropbox_entry_copy": return try mutation(request, token, "copy")
        case "dropbox_entry_move": return try mutation(request, token, "move")
        default: throw MarketplaceProviderActionAdapterFailure(code: "dropbox_live_action_not_supported", message: "Live Dropbox execution does not support this action.")
        }
    }
    private func folderList(_ request: MarketplaceProviderActionAdapterRequest, _ token: String) throws -> DropboxProviderActionClientResult {
        let count = DropboxProviderActionSupport.bound(request.payload["maxResults"], 10, 50), path = request.payload["path"]?.string ?? ""
        let value = try rpc("/2/files/list_folder", ["path": path, "recursive": false, "include_deleted": false, "include_non_downloadable_files": true, "limit": count], token), object = value.dbxObject ?? [:]
        return out(
            request,
            [
                "semanticReadContract": .string("dropbox-folder-entries-v1"), "path": .string(path), "entries": .array((object["entries"]?.dbxArray ?? []).prefix(count).map { .object(DropboxProviderActionSupport.entry($0)) }), "cursor": object["cursor"] ?? .null,
                "hasMore": object["has_more"] ?? .bool(false),
            ])
    }
    private func entryGet(_ request: MarketplaceProviderActionAdapterRequest, _ token: String) throws -> DropboxProviderActionClientResult {
        let path = try DropboxProviderActionSupport.need(request.payload, "path"), value = try rpc("/2/files/get_metadata", ["path": path, "include_media_info": false, "include_deleted": false, "include_has_explicit_shared_members": false], token)
        return out(request, ["semanticReadContract": .string("dropbox-entry-metadata-v1"), "entry": .object(DropboxProviderActionSupport.entry(value))])
    }
    private func fileSearch(_ request: MarketplaceProviderActionAdapterRequest, _ token: String) throws -> DropboxProviderActionClientResult {
        let query = try DropboxProviderActionSupport.need(request.payload, "query"), count = DropboxProviderActionSupport.bound(request.payload["maxResults"], 10, 25), path = request.payload["path"]?.string ?? ""
        var options: [String: Any] = ["max_results": count, "file_status": "active", "filename_only": false]
        if !path.isEmpty { options["path"] = path }
        let value = try rpc("/2/files/search_v2", ["query": query, "options": options], token), object = value.dbxObject ?? [:]
        let matches = (object["matches"]?.dbxArray ?? []).prefix(count).map { value -> JSONValue in
            let match = value.dbxObject ?? [:], metadata = match["metadata"]?.dbxObject?["metadata"] ?? match["metadata"] ?? .object([:]); return .object(["matchType": match["match_type"]?.dbxObject?[".tag"] ?? .null, "metadata": .object(DropboxProviderActionSupport.entry(metadata))])
        }
        return out(request, ["semanticReadContract": .string("dropbox-file-search-v1"), "query": .string(query), "matches": .array(matches), "hasMore": object["has_more"] ?? .bool(false)])
    }
    private func mutation(_ request: MarketplaceProviderActionAdapterRequest, _ token: String, _ operation: String) throws -> DropboxProviderActionClientResult {
        let normalized = try DropboxProviderActionSupport.normalized(request.payload, operation), value: JSONValue
        switch operation {
        case "folder": value = try rpc("/2/files/create_folder_v2", ["path": normalized["path"]?.string ?? "", "autorename": normalized["autorename"]?.bool ?? false], token)
        case "copy": value = try rpc("/2/files/copy_v2", ["from_path": normalized["fromPath"]?.string ?? "", "to_path": normalized["toPath"]?.string ?? "", "autorename": normalized["autorename"]?.bool ?? false, "allow_shared_folder": false], token)
        case "move": value = try rpc("/2/files/move_v2", ["from_path": normalized["fromPath"]?.string ?? "", "to_path": normalized["toPath"]?.string ?? "", "autorename": normalized["autorename"]?.bool ?? false, "allow_shared_folder": false], token)
        default: value = try upload(normalized, token)
        }
        let object = value.dbxObject ?? [:], metadata = object["metadata"] ?? value, hash = MarketplaceProviderActionApprovalService.payloadHash(normalized)
        var fields: JSONRecord = ["operation": .string(operation), "payloadHash": .string(hash), "auditId": .string(request.auditIdentity.dispatchId ?? request.idempotencyKey)]
        if object["async_job_id"] != nil { fields["asyncJobId"] = object["async_job_id"] } else { fields["entry"] = .object(DropboxProviderActionSupport.entry(metadata)) }
        return out(request, fields)
    }
    private func upload(_ normalized: JSONRecord, _ token: String) throws -> JSONValue {
        guard let url = URL(string: "https://content.dropboxapi.com/2/files/upload") else { throw MarketplaceProviderActionAdapterFailure(code: "dropbox_invalid_url", message: "Could not build the Dropbox content URL.") }
        var args: [String: Any] = ["path": normalized["path"]?.string ?? "", "mode": normalized["mode"]?.string ?? "add", "autorename": normalized["autorename"]?.bool ?? true, "mute": true, "strict_conflict": true]
        if let modified = normalized["clientModified"]?.string { args["client_modified"] = modified }
        let arg = String(data: try JSONSerialization.data(withJSONObject: args), encoding: .utf8) ?? "{}"
        let response = try http.send(DropboxProviderHTTPRequest(method: "POST", url: url, headers: ["Authorization": "Bearer \(token)", "Content-Type": "application/octet-stream", "Dropbox-API-Arg": arg], body: Data((normalized["text"]?.string ?? "").utf8)))
        return try decode(response)
    }
    private func rpc(_ path: String, _ body: [String: Any], _ token: String) throws -> JSONValue {
        guard let url = URL(string: "https://api.dropboxapi.com\(path)") else { throw MarketplaceProviderActionAdapterFailure(code: "dropbox_invalid_url", message: "Could not build the Dropbox API URL.") }
        let response = try http.send(DropboxProviderHTTPRequest(method: "POST", url: url, headers: ["Authorization": "Bearer \(token)", "Accept": "application/json", "Content-Type": "application/json"], body: try JSONSerialization.data(withJSONObject: body)))
        return try decode(response)
    }
    private func decode(_ response: DropboxProviderHTTPResponse) throws -> JSONValue {
        guard (200..<300).contains(response.statusCode) else {
            let code = response.statusCode == 429 ? "dropbox_rate_limited" : response.statusCode == 401 ? "dropbox_access_token_expired" : response.statusCode == 409 ? "dropbox_path_conflict" : "dropbox_http_error"
            let retryHeader = response.headers.first { $0.key.lowercased() == "retry-after" }?.value
            let retry = retryHeader.flatMap { Double($0) } ?? 0
            throw MarketplaceProviderActionAdapterFailure(code: code, message: response.statusCode == 401 ? "Dropbox access token expired; refresh or reconnect Dropbox." : "Dropbox API returned an HTTP error.", providerStatusCode: response.statusCode, detail: ["retryAfterSeconds": .number(retry)])
        }
        return response.body.isEmpty ? .object([:]) : DropboxProviderActionSupport.json(try JSONSerialization.jsonObject(with: response.body))
    }
    private func accessToken(_ request: MarketplaceProviderActionAdapterRequest) throws -> String {
        guard let id = request.auditIdentity.connectionId?.dbxNonEmpty, let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), connection.appSlug == "dropbox", connection.appId == request.app.id,
            connection.status == .connected || connection.status == .healthError
        else { throw MarketplaceProviderActionAdapterFailure(code: "dropbox_connection_not_ready", message: "Dropbox execution requires a ready Relay Marketplace connection.") }
        guard let ref = connection.credentialRequirements.first(where: { $0.fieldKey == "dropbox_oauth_access_token" })?.secretReferenceId?.dbxNonEmpty else {
            throw MarketplaceProviderActionAdapterFailure(code: "dropbox_credentials_missing", message: "The Dropbox connection is missing its Keychain access-token reference.")
        }
        do { return try secrets.getSecretValue(ref) } catch { throw MarketplaceProviderActionAdapterFailure(code: "dropbox_credentials_unavailable", message: "Relay could not read the saved Dropbox access token. Refresh or reconnect Dropbox.") }
    }
    private func out(_ request: MarketplaceProviderActionAdapterRequest, _ fields: JSONRecord) -> DropboxProviderActionClientResult {
        let base: JSONRecord = [
            "adapterBoundary": .string("dropbox-provider-action-adapter"), "clientMode": .string("live-dropbox-api-v2"), "provider": .string("dropbox"), "permission": .string(request.permission.rawValue), "payloadHash": .string(MarketplaceProviderActionApprovalService.payloadHash(request.payload)),
            "approved": .bool(request.approvalReference?.status == .approved), "idempotencyKey": .string(request.idempotencyKey), "liveCredentialsUsed": .bool(true), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-state-excluded"),
        ]
        return DropboxProviderActionClientResult(result: base.merging(fields) { _, new in new })
    }
}

public struct DropboxProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = ["dropbox_folder_list", "dropbox_entry_get", "dropbox_file_search", "dropbox_text_upload_prepare", "dropbox_folder_create", "dropbox_text_upload", "dropbox_entry_copy", "dropbox_entry_move"]
    private let client: any DropboxProviderActionClient
    public init(client: any DropboxProviderActionClient = FakeDropboxProviderActionClient()) { self.client = client }
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "dropbox" else { throw MarketplaceProviderActionAdapterFailure(code: "dropbox_adapter_wrong_provider", message: "Dropbox adapter can execute only Dropbox actions.") }
        guard Self.allowed.contains(request.definition.actionKey) else { throw MarketplaceProviderActionAdapterFailure(code: "dropbox_action_not_allowlisted", message: "The requested Dropbox action is not in the V1 allowlist.") }
        let result = try client.executeDropboxAction(request: request); return MarketplaceProviderActionAdapterResult(result: result.result, error: nil, redactionStatus: result.redactionStatus)
    }
}

public enum DropboxProviderActionSupport {
    public static func need(_ payload: JSONRecord, _ key: String) throws -> String {
        guard let value = payload[key]?.string?.dbxNonEmpty else { throw MarketplaceProviderActionAdapterFailure(code: "dropbox_missing_required_field", message: "Dropbox \(key) is required.", detail: ["field": .string(key)]) }; return value
    }
    public static func bound(_ value: JSONValue?, _ fallback: Int, _ maximum: Int) -> Int { max(1, min(maximum, value?.number.map(Int.init) ?? value?.string.flatMap(Int.init) ?? fallback)) }
    public static func operation(_ key: String) -> String { key == "dropbox_folder_create" ? "folder" : key == "dropbox_text_upload" ? "upload" : key == "dropbox_entry_copy" ? "copy" : "move" }
    public static func normalized(_ payload: JSONRecord, _ operation: String) throws -> JSONRecord {
        var result: JSONRecord = [:]
        if operation == "folder" || operation == "upload" { result["path"] = .string(try validPath(need(payload, "path"))) }
        if operation == "upload" {
            let text = try need(payload, "text"); guard text.utf8.count <= 262_144 else { throw MarketplaceProviderActionAdapterFailure(code: "dropbox_text_too_large", message: "Dropbox V1 text upload is limited to 256 KiB.") }; result["text"] = .string(text);
            let mode = payload["mode"]?.string?.lowercased() ?? "add"; guard ["add", "overwrite"].contains(mode) else { throw MarketplaceProviderActionAdapterFailure(code: "dropbox_invalid_write_mode", message: "Dropbox text upload mode must be add or overwrite.") }; result["mode"] = .string(mode)
        }
        if operation == "copy" || operation == "move" { result["fromPath"] = .string(try validPath(need(payload, "fromPath"))); result["toPath"] = .string(try validPath(need(payload, "toPath"))) }
        result["autorename"] = .bool(payload["autorename"]?.bool ?? (operation == "upload"))
        if let modified = payload["clientModified"]?.string?.dbxNonEmpty { result["clientModified"] = .string(modified) }
        return result
    }
    public static func validPath(_ value: String) throws -> String {
        guard value.hasPrefix("/"), value.count <= 1000, value != "/" else { throw MarketplaceProviderActionAdapterFailure(code: "dropbox_invalid_path", message: "Dropbox mutation paths must be absolute, non-root, and at most 1000 characters.") }; return value
    }
    public static func entry(_ value: JSONValue) -> JSONRecord {
        let object = value.dbxObject ?? [:], tag = object[".tag"]?.string ?? "unknown"
        return [
            "entryType": .string(tag), "id": object["id"] ?? .null, "name": object["name"] ?? .null, "pathDisplay": object["path_display"] ?? .null, "pathLower": object["path_lower"] ?? .null, "revision": object["rev"] ?? .null, "size": object["size"] ?? .null,
            "clientModified": object["client_modified"] ?? .null, "serverModified": object["server_modified"] ?? .null, "contentHash": object["content_hash"] ?? .null, "isDownloadable": object["is_downloadable"] ?? .null, "redactionStatus": .string("private-state-excluded"),
        ]
    }
    public static func fakeEntry(_ index: Int, _ parent: String, exactPath: Bool = false, folder: Bool = false) -> JSONRecord {
        let isFolder = folder || (!exactPath && index % 3 == 1), name = exactPath ? (parent.split(separator: "/").last.map(String.init) ?? "Relay.txt") : isFolder ? "Projects" : "Relay brief \(index + 1).txt", path = exactPath ? parent : "\(parent)/\(name)".replacingOccurrences(of: "//", with: "/")
        return [
            "entryType": .string(isFolder ? "folder" : "file"), "id": .string("id:dbx\(index + 1)"), "name": .string(name), "pathDisplay": .string(path), "pathLower": .string(path.lowercased()), "revision": isFolder ? .null : .string("rev\(index + 1)"),
            "size": isFolder ? .null : .number(Double(1024 + index)), "clientModified": isFolder ? .null : .string("2026-07-11T00:00:00Z"), "serverModified": isFolder ? .null : .string("2026-07-11T00:00:01Z"), "contentHash": isFolder ? .null : .string("content-hash-\(index + 1)"),
            "isDownloadable": isFolder ? .null : .bool(true), "redactionStatus": .string("private-state-excluded"),
        ]
    }
    public static func json(_ value: Any) -> JSONValue {
        if let value = value as? String { return .string(value) }; if let value = value as? Bool { return .bool(value) }; if let value = value as? Int { return .number(Double(value)) }; if let value = value as? Double { return .number(value) };
        if let value = value as? [String: Any] { return .object(value.mapValues(json)) }; if let value = value as? [Any] { return .array(value.map(json)) }; if value is NSNull { return .null }; return .string(String(describing: value))
    }
}

private extension JSONValue { var dbxObject: JSONRecord? { if case .object(let value) = self { return value }; return nil }; var dbxArray: [JSONValue]? { if case .array(let value) = self { return value }; return nil } }
private extension String { var dbxNonEmpty: String? { let value = trimmingCharacters(in: .whitespacesAndNewlines); return value.isEmpty ? nil : value } }
