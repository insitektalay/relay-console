import Foundation

public struct BoxProviderActionClientResult: Codable, Equatable, Sendable { public var result: JSONRecord; public var redactionStatus: String; public init(result: JSONRecord, redactionStatus: String = "private-state-excluded") { self.result = result; self.redactionStatus = redactionStatus } }
public protocol BoxProviderActionClient: Sendable { func executeBoxAction(request: MarketplaceProviderActionAdapterRequest) throws -> BoxProviderActionClientResult }
public struct BoxProviderHTTPRequest: Sendable, Equatable {
    public var method: String; public var url: URL; public var headers: [String: String]; public var body: Data?; public init(method: String, url: URL, headers: [String: String] = [:], body: Data? = nil) { self.method = method; self.url = url; self.headers = headers; self.body = body }
}
public struct BoxProviderHTTPResponse: Sendable, Equatable {
    public var statusCode: Int; public var headers: [String: String]; public var body: Data; public init(statusCode: Int, headers: [String: String] = [:], body: Data = Data()) { self.statusCode = statusCode; self.headers = headers; self.body = body }
}
public protocol BoxProviderHTTPClient: Sendable { func send(_ request: BoxProviderHTTPRequest) throws -> BoxProviderHTTPResponse }
public struct URLSessionBoxProviderHTTPClient: BoxProviderHTTPClient {
    private let timeout: TimeInterval; public init(timeoutSeconds: TimeInterval = 20) { timeout = timeoutSeconds }
    public func send(_ request: BoxProviderHTTPRequest) throws -> BoxProviderHTTPResponse {
        var value = URLRequest(url: request.url); value.httpMethod = request.method; value.timeoutInterval = timeout; value.httpBody = request.body; request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) }; let semaphore = DispatchSemaphore(value: 0); var data: Data?;
        var response: HTTPURLResponse?; var failure: Error?;
        let task = URLSession.shared.dataTask(with: value) {
            data = $0; response = $1 as? HTTPURLResponse; failure = $2; semaphore.signal()
        }; task.resume(); if semaphore.wait(timeout: .now() + timeout) == .timedOut { task.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "box_http_timeout", message: "Box API request timed out.") }; if let failure { throw failure };
        let headers = response?.allHeaderFields.reduce(into: [String: String]()) { $0[String(describing: $1.key)] = String(describing: $1.value) } ?? [:]; return BoxProviderHTTPResponse(statusCode: response?.statusCode ?? 0, headers: headers, body: data ?? Data())
    }
}

public struct FakeBoxProviderActionClient: BoxProviderActionClient {
    public init() {}
    public func executeBoxAction(request: MarketplaceProviderActionAdapterRequest) throws -> BoxProviderActionClientResult {
        switch request.definition.actionKey {
        case "box_folder_items":
            let id = request.payload["folderId"]?.string ?? "0", n = BoxProviderActionSupport.bound(request.payload["maxResults"], 5, 50);
            return out(request, ["semanticReadContract": .string("box-folder-items-v1"), "folderId": .string(id), "entries": .array((0..<n).map { .object(BoxProviderActionSupport.fakeItem($0, parentId: id)) }), "nextMarker": .null])
        case "box_file_get", "box_folder_get":
            let id = try BoxProviderActionSupport.need(request.payload, request.definition.actionKey == "box_file_get" ? "fileId" : "folderId"), type = request.definition.actionKey == "box_file_get" ? "file" : "folder";
            return out(request, ["semanticReadContract": .string("box-item-metadata-v1"), "item": .object(BoxProviderActionSupport.fakeItem(0, parentId: "0", id: id, type: type))])
        case "box_content_search":
            let q = try BoxProviderActionSupport.need(request.payload, "query"), n = BoxProviderActionSupport.bound(request.payload["maxResults"], 5, 25);
            return out(request, ["semanticReadContract": .string("box-content-search-v1"), "query": .string(q), "entries": .array((0..<n).map { .object(BoxProviderActionSupport.fakeItem($0, parentId: "0")) }), "nextMarker": .null])
        case "box_text_upload_prepare":
            let p = try BoxProviderActionSupport.normalized(request.payload, "upload"), h = MarketplaceProviderActionApprovalService.payloadHash(p);
            return out(request, ["draftPreview": .object(["payload": .object(p), "textByteCount": .number(Double(p["text"]?.string?.utf8.count ?? 0)), "payloadHash": .string(h), "providerMutation": .bool(false)])])
        case "box_folder_create", "box_text_upload", "box_item_copy", "box_item_move":
            let op = BoxProviderActionSupport.operation(request.definition.actionKey), p = try BoxProviderActionSupport.normalized(request.payload, op), h = MarketplaceProviderActionApprovalService.payloadHash(p), type = p["itemType"]?.string ?? (op == "folder" ? "folder" : "file"),
                id = p["itemId"]?.string ?? "box-created"
            ;
            return out(
                request,
                [
                    "item": .object(BoxProviderActionSupport.fakeItem(0, parentId: p["parentFolderId"]?.string ?? p["destinationFolderId"]?.string ?? "0", id: id, type: type)), "operation": .string(op), "payloadHash": .string(h),
                    "auditId": .string(request.auditIdentity.dispatchId ?? request.idempotencyKey),
                ])
        default: throw MarketplaceProviderActionAdapterFailure(code: "box_fake_action_not_supported", message: "The fake Box client does not support this action.")
        }
    }
    private func out(_ r: MarketplaceProviderActionAdapterRequest, _ fields: JSONRecord) -> BoxProviderActionClientResult {
        let base: JSONRecord = [
            "fakeAdapter": .bool(true), "adapterBoundary": .string("box-provider-action-adapter"), "clientMode": .string("fake-box-api-v2-client"), "provider": .string("box"), "permission": .string(r.permission.rawValue),
            "payloadHash": .string(MarketplaceProviderActionApprovalService.payloadHash(r.payload)), "approved": .bool(r.approvalReference?.status == .approved), "idempotencyKey": .string(r.idempotencyKey), "liveCredentialsUsed": .bool(false), "rawProviderToolExposure": .bool(false),
            "redactionStatus": .string("private-state-excluded"),
        ]
            ;
        return BoxProviderActionClientResult(result: base.merging(fields) { _, n in n })
    }
}

public final class LiveBoxProviderActionClient: BoxProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService; private let secrets: SecretService; private let http: any BoxProviderHTTPClient
    public init(data: LocalDataService, secrets: SecretService, httpClient: any BoxProviderHTTPClient = URLSessionBoxProviderHTTPClient()) { self.data = data; self.secrets = secrets; self.http = httpClient }
    public func executeBoxAction(request: MarketplaceProviderActionAdapterRequest) throws -> BoxProviderActionClientResult {
        if request.definition.actionKey == "box_text_upload_prepare" { return try FakeBoxProviderActionClient().executeBoxAction(request: request) }; let token = try accessToken(request);
        switch request.definition.actionKey {
        case "box_folder_items": return try list(request, token);
        case "box_file_get": return try get(request, token, "file");
        case "box_folder_get": return try get(request, token, "folder");
        case "box_content_search": return try search(request, token);
        case "box_folder_create": return try mutate(request, token, "folder");
        case "box_text_upload": return try mutate(request, token, "upload");
        case "box_item_copy": return try mutate(request, token, "copy");
        case "box_item_move": return try mutate(request, token, "move");
        default: throw MarketplaceProviderActionAdapterFailure(code: "box_live_action_not_supported", message: "Live Box execution does not support this action.")
        }
    }
    private let fields = "id,type,name,description,size,etag,sequence_id,sha1,file_version,parent,path_collection,created_at,modified_at,owned_by,item_status,version_number"
    private func list(_ r: MarketplaceProviderActionAdapterRequest, _ token: String) throws -> BoxProviderActionClientResult {
        let id = r.payload["folderId"]?.string ?? "0", n = BoxProviderActionSupport.bound(r.payload["maxResults"], 10, 50), marker = r.payload["marker"]?.string;
        var q = [URLQueryItem(name: "usemarker", value: "true"), URLQueryItem(name: "limit", value: String(n)), URLQueryItem(name: "fields", value: fields)]; if let marker, !marker.isEmpty { q.append(URLQueryItem(name: "marker", value: marker)) };
        let v = try send("GET", "/2.0/folders/" + BoxProviderActionSupport.segment(id) + "/items", q, nil, token), o = v.boxObject ?? [:];
        return out(r, ["semanticReadContract": .string("box-folder-items-v1"), "folderId": .string(id), "entries": .array((o["entries"]?.boxArray ?? []).prefix(n).map { .object(BoxProviderActionSupport.item($0)) }), "nextMarker": o["next_marker"] ?? .null])
    }
    private func get(_ r: MarketplaceProviderActionAdapterRequest, _ token: String, _ type: String) throws -> BoxProviderActionClientResult {
        let key = type == "file" ? "fileId" : "folderId", id = try BoxProviderActionSupport.need(r.payload, key), v = try send("GET", "/2.0/" + type + "s/" + BoxProviderActionSupport.segment(id), [URLQueryItem(name: "fields", value: fields)], nil, token);
        return out(r, ["semanticReadContract": .string("box-item-metadata-v1"), "item": .object(BoxProviderActionSupport.item(v))])
    }
    private func search(_ r: MarketplaceProviderActionAdapterRequest, _ token: String) throws -> BoxProviderActionClientResult {
        let query = try BoxProviderActionSupport.need(r.payload, "query"), n = BoxProviderActionSupport.bound(r.payload["maxResults"], 10, 25);
        var q = [URLQueryItem(name: "query", value: query), URLQueryItem(name: "usemarker", value: "true"), URLQueryItem(name: "limit", value: String(n)), URLQueryItem(name: "fields", value: fields)];
        if let ids = r.payload["ancestorFolderIds"]?.string?.boxNonEmpty { q.append(URLQueryItem(name: "ancestor_folder_ids", value: ids)) }; if let marker = r.payload["marker"]?.string?.boxNonEmpty { q.append(URLQueryItem(name: "marker", value: marker)) };
        let v = try send("GET", "/2.0/search", q, nil, token), o = v.boxObject ?? [:];
        return out(r, ["semanticReadContract": .string("box-content-search-v1"), "query": .string(query), "entries": .array((o["entries"]?.boxArray ?? []).prefix(n).map { .object(BoxProviderActionSupport.item($0)) }), "nextMarker": o["next_marker"] ?? .null])
    }
    private func mutate(_ r: MarketplaceProviderActionAdapterRequest, _ token: String, _ op: String) throws -> BoxProviderActionClientResult {
        let p = try BoxProviderActionSupport.normalized(r.payload, op), v: JSONValue;
        if op == "upload" {
            v = try upload(p, token)
        } else {
            let body: [String: Any], path: String, method: String;
            if op == "folder" {
                path = "/2.0/folders"; method = "POST"; body = ["name": p["name"]?.string ?? "", "parent": ["id": p["parentFolderId"]?.string ?? "0"]]
            } else if op == "copy" {
                let type = p["itemType"]?.string ?? "file"; path = "/2.0/" + type + "s/" + BoxProviderActionSupport.segment(p["itemId"]?.string ?? "") + "/copy"; method = "POST"; var b: [String: Any] = ["parent": ["id": p["destinationFolderId"]?.string ?? "0"]];
                if let name = p["name"]?.string { b["name"] = name }; body = b
            } else {
                let type = p["itemType"]?.string ?? "file"; path = "/2.0/" + type + "s/" + BoxProviderActionSupport.segment(p["itemId"]?.string ?? ""); method = "PUT"; var b: [String: Any] = ["parent": ["id": p["destinationFolderId"]?.string ?? "0"]];
                if let name = p["name"]?.string { b["name"] = name }; body = b
            }; var headers: [String: String] = [:]; if let etag = p["etag"]?.string { headers["If-Match"] = etag }; v = try send(method, path, [URLQueryItem(name: "fields", value: fields)], try JSONSerialization.data(withJSONObject: body), token, headers)
        }; let o = v.boxObject ?? [:], raw = o["entries"]?.boxArray?.first ?? v, h = MarketplaceProviderActionApprovalService.payloadHash(p);
        return out(r, ["item": .object(BoxProviderActionSupport.item(raw)), "operation": .string(op), "payloadHash": .string(h), "auditId": .string(r.auditIdentity.dispatchId ?? r.idempotencyKey)])
    }
    private func upload(_ p: JSONRecord, _ token: String) throws -> JSONValue {
        let boundary = "RelayBoxBoundary" + BoxProviderActionSupport.suffix(p["name"]?.string ?? "file"), attrs: [String: Any] = ["name": p["name"]?.string ?? "", "parent": ["id": p["parentFolderId"]?.string ?? "0"]], attrsData = try JSONSerialization.data(withJSONObject: attrs),
            attrsText = String(data: attrsData, encoding: .utf8) ?? "{}"
        ; var body = Data(); func add(_ s: String) { body.append(Data(s.utf8)) }; add("--" + boundary + "\r\nContent-Disposition: form-data; name=\"attributes\"\r\nContent-Type: application/json\r\n\r\n" + attrsText + "\r\n");
        add("--" + boundary + "\r\nContent-Disposition: form-data; name=\"file\"; filename=\"" + (p["name"]?.string ?? "file.txt") + "\"\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n"); body.append(Data((p["text"]?.string ?? "").utf8)); add("\r\n--" + boundary + "--\r\n");
        guard let url = URL(string: "https://upload.box.com/api/2.0/files/content?fields=" + fields.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed)!) else { throw MarketplaceProviderActionAdapterFailure(code: "box_invalid_url", message: "Could not build Box upload URL.") };
        return try decode(http.send(BoxProviderHTTPRequest(method: "POST", url: url, headers: ["Authorization": "Bearer " + token, "Content-Type": "multipart/form-data; boundary=" + boundary], body: body)))
    }
    private func send(_ method: String, _ path: String, _ query: [URLQueryItem], _ body: Data?, _ token: String, _ extra: [String: String] = [:]) throws -> JSONValue {
        var c = URLComponents(string: "https://api.box.com" + path); c?.queryItems = query.isEmpty ? nil : query; guard let url = c?.url else { throw MarketplaceProviderActionAdapterFailure(code: "box_invalid_url", message: "Could not build Box API URL.") };
        var headers = ["Authorization": "Bearer " + token, "Accept": "application/json", "Content-Type": "application/json"]; extra.forEach { headers[$0.key] = $0.value }; return try decode(http.send(BoxProviderHTTPRequest(method: method, url: url, headers: headers, body: body)))
    }
    private func decode(_ response: BoxProviderHTTPResponse) throws -> JSONValue {
        guard (200..<300).contains(response.statusCode) else {
            let
                code =
                    response.statusCode == 429 ? "box_rate_limited" : response.statusCode == 401 ? "box_access_token_expired" : response.statusCode == 403 ? "box_permission_denied" : response.statusCode == 409 ? "box_item_conflict" : response.statusCode == 412 ? "box_stale_etag" : "box_http_error",
                retry = response.headers.first { $0.key.lowercased() == "retry-after" }.flatMap { Double($0.value) } ?? 0
            ;
            throw MarketplaceProviderActionAdapterFailure(
                code: code, message: response.statusCode == 401 ? "Box access token expired; serialize rotating refresh or reconnect." : "Box API returned an HTTP error.", providerStatusCode: response.statusCode, detail: ["retryAfterSeconds": .number(retry)])
        }; return response.body.isEmpty ? .object([:]) : BoxProviderActionSupport.json(try JSONSerialization.jsonObject(with: response.body))
    }
    private func accessToken(_ r: MarketplaceProviderActionAdapterRequest) throws -> String {
        guard let id = r.auditIdentity.connectionId?.boxNonEmpty, let c = try data.getProviderConnection(workspaceId: r.context.workspaceId, connectionId: id), c.appSlug == "box", c.appId == r.app.id, c.status == .connected || c.status == .healthError else {
            throw MarketplaceProviderActionAdapterFailure(code: "box_connection_not_ready", message: "Box execution requires a ready Relay connection.")
        }; guard let ref = c.credentialRequirements.first(where: { $0.fieldKey == "box_oauth_access_token" })?.secretReferenceId?.boxNonEmpty else { throw MarketplaceProviderActionAdapterFailure(code: "box_credentials_missing", message: "Box access-token reference is missing.") };
        do { return try secrets.getSecretValue(ref) } catch { throw MarketplaceProviderActionAdapterFailure(code: "box_credentials_unavailable", message: "Relay could not read the Box access token. Refresh or reconnect.") }
    }
    private func out(_ r: MarketplaceProviderActionAdapterRequest, _ fields: JSONRecord) -> BoxProviderActionClientResult {
        let base: JSONRecord = [
            "adapterBoundary": .string("box-provider-action-adapter"), "clientMode": .string("live-box-api-v2"), "provider": .string("box"), "permission": .string(r.permission.rawValue), "payloadHash": .string(MarketplaceProviderActionApprovalService.payloadHash(r.payload)),
            "approved": .bool(r.approvalReference?.status == .approved), "idempotencyKey": .string(r.idempotencyKey), "liveCredentialsUsed": .bool(true), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-state-excluded"),
        ]
            ;
        return BoxProviderActionClientResult(result: base.merging(fields) { _, n in n })
    }
}

public struct BoxProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = ["box_folder_items", "box_file_get", "box_folder_get", "box_content_search", "box_text_upload_prepare", "box_folder_create", "box_text_upload", "box_item_copy", "box_item_move"]; private let client: any BoxProviderActionClient;
    public init(client: any BoxProviderActionClient = FakeBoxProviderActionClient()) { self.client = client };
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "box" else { throw MarketplaceProviderActionAdapterFailure(code: "box_adapter_wrong_provider", message: "Box adapter can execute only Box actions.") };
        guard Self.allowed.contains(request.definition.actionKey) else { throw MarketplaceProviderActionAdapterFailure(code: "box_action_not_allowlisted", message: "The requested Box action is not in the V1 allowlist.") }; let r = try client.executeBoxAction(request: request);
        return MarketplaceProviderActionAdapterResult(result: r.result, error: nil, redactionStatus: r.redactionStatus)
    }
}

public enum BoxProviderActionSupport {
    public static func need(_ p: JSONRecord, _ k: String) throws -> String { guard let v = p[k]?.string?.boxNonEmpty else { throw MarketplaceProviderActionAdapterFailure(code: "box_missing_required_field", message: "Box " + k + " is required.", detail: ["field": .string(k)]) }; return v }
    public static func bound(_ v: JSONValue?, _ d: Int, _ m: Int) -> Int { max(1, min(m, v?.number.map(Int.init) ?? v?.string.flatMap(Int.init) ?? d)) }
    public static func operation(_ k: String) -> String { k == "box_folder_create" ? "folder" : k == "box_text_upload" ? "upload" : k == "box_item_copy" ? "copy" : "move" }
    public static func normalized(_ p: JSONRecord, _ op: String) throws -> JSONRecord {
        var o: JSONRecord = [:]; if op == "folder" { o["parentFolderId"] = .string(p["parentFolderId"]?.string?.boxNonEmpty ?? "0"); o["name"] = .string(try validName(need(p, "name"))) };
        if op == "upload" {
            o["parentFolderId"] = .string(p["parentFolderId"]?.string?.boxNonEmpty ?? "0"); o["name"] = .string(try validName(need(p, "name"))); let text = try need(p, "text");
            guard text.utf8.count <= 262_144 else { throw MarketplaceProviderActionAdapterFailure(code: "box_text_too_large", message: "Box V1 text upload is limited to 256 KiB.") }; o["text"] = .string(text)
        };
        if op == "copy" || op == "move" {
            let type = try need(p, "itemType").lowercased(); guard ["file", "folder"].contains(type) else { throw MarketplaceProviderActionAdapterFailure(code: "box_invalid_item_type", message: "Box itemType must be file or folder.") }; o["itemType"] = .string(type);
            o["itemId"] = .string(try need(p, "itemId")); o["destinationFolderId"] = .string(try need(p, "destinationFolderId")); if let name = p["name"]?.string?.boxNonEmpty { o["name"] = .string(try validName(name)) }; if let etag = p["etag"]?.string?.boxNonEmpty { o["etag"] = .string(etag) }
        }; return o
    }
    public static func validName(_ s: String) throws -> String {
        guard s.count <= 255, s != ".", s != "..", !s.contains("/"), !s.contains("\\"), s.trimmingCharacters(in: .whitespacesAndNewlines) == s else { throw MarketplaceProviderActionAdapterFailure(code: "box_invalid_name", message: "Box item name violates V1/provider restrictions.") }; return s
    }
    public static func item(_ v: JSONValue) -> JSONRecord {
        let o = v.boxObject ?? [:], version = o["file_version"]?.boxObject ?? [:], parent = o["parent"]?.boxObject ?? [:], owner = o["owned_by"]?.boxObject ?? [:], path = o["path_collection"]?.boxObject?["entries"]?.boxArray ?? [];
        return [
            "itemType": o["type"] ?? .null, "id": o["id"] ?? .null, "name": o["name"] ?? .null, "description": o["description"] ?? .null, "size": o["size"] ?? .null, "etag": o["etag"] ?? .null, "sequenceId": o["sequence_id"] ?? .null, "sha1": o["sha1"] ?? .null,
            "fileVersionId": version["id"] ?? .null, "versionNumber": o["version_number"] ?? .null, "parent": .object(["id": parent["id"] ?? .null, "name": parent["name"] ?? .null]),
            "path": .array(
                path.map {
                    let x = $0.boxObject ?? [:]; return .object(["id": x["id"] ?? .null, "name": x["name"] ?? .null])
                }), "createdAt": o["created_at"] ?? .null, "modifiedAt": o["modified_at"] ?? .null, "owner": .object(["id": owner["id"] ?? .null, "name": owner["name"] ?? .null]), "itemStatus": o["item_status"] ?? .null, "redactionStatus": .string("private-state-excluded"),
        ]
    }
    public static func fakeItem(_ i: Int, parentId: String, id: String? = nil, type: String? = nil) -> JSONRecord {
        let t = type ?? (i % 3 == 1 ? "folder" : "file"), n = t == "folder" ? "Projects" : "Box brief " + String(i + 1) + ".txt";
        return [
            "itemType": .string(t), "id": .string(id ?? "box" + String(i + 1)), "name": .string(n), "description": .string("Relay Box content"), "size": t == "file" ? .number(Double(2048 + i)) : .number(0), "etag": .string("etag" + String(i + 1)), "sequenceId": .string(String(i + 1)),
            "sha1": t == "file" ? .string("sha1-" + String(i + 1)) : .null, "fileVersionId": t == "file" ? .string("ver" + String(i + 1)) : .null, "versionNumber": t == "file" ? .string("1") : .null, "parent": .object(["id": .string(parentId), "name": .string("Parent")]),
            "path": .array([.object(["id": .string("0"), "name": .string("All Files")])]), "createdAt": .string("2026-07-11T00:00:00Z"), "modifiedAt": .string("2026-07-11T00:00:01Z"), "owner": .object(["id": .string("usr1"), "name": .string("Relay Owner")]), "itemStatus": .string("active"),
            "redactionStatus": .string("private-state-excluded"),
        ]
    }
    public static func segment(_ s: String) -> String { s.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed)?.replacingOccurrences(of: "/", with: "%2F") ?? s }
    public static func suffix(_ s: String) -> String { var h: UInt64 = 1469598103934665603; for b in s.utf8 { h ^= UInt64(b); h &*= 1099511628211 }; return String(String(h, radix: 16).suffix(10)) }
    public static func json(_ v: Any) -> JSONValue {
        if let x = v as? String { return .string(x) }; if let x = v as? Bool { return .bool(x) }; if let x = v as? Int { return .number(Double(x)) }; if let x = v as? Double { return .number(x) }; if let x = v as? [String: Any] { return .object(x.mapValues(json)) };
        if let x = v as? [Any] { return .array(x.map(json)) }; if v is NSNull { return .null }; return .string(String(describing: v))
    }
}
private extension JSONValue { var boxObject: JSONRecord? { if case .object(let v) = self { return v }; return nil }; var boxArray: [JSONValue]? { if case .array(let v) = self { return v }; return nil } }
private extension String { var boxNonEmpty: String? { let v = trimmingCharacters(in: .whitespacesAndNewlines); return v.isEmpty ? nil : v } }
