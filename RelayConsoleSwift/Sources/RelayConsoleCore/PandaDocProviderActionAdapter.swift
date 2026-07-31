import Foundation

public struct PandaDocProviderHTTPRequest: Sendable { public let url: URL; public let headers: [String:String]; public init(url: URL, headers: [String:String]) { self.url=url; self.headers=headers } }
public struct PandaDocProviderHTTPResponse: Sendable { public let statusCode:Int; public let headers:[String:String]; public let body:Data; public init(statusCode:Int, headers:[String:String]=[:], body:Data=Data()){self.statusCode=statusCode;self.headers=headers;self.body=body} }
public protocol PandaDocProviderHTTPClient: Sendable { func send(_ request:PandaDocProviderHTTPRequest)throws->PandaDocProviderHTTPResponse }
private final class PandaDocNoRedirectDelegate: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}
public struct URLSessionPandaDocProviderHTTPClient: PandaDocProviderHTTPClient {
    public init() {};
    public func send(_ request: PandaDocProviderHTTPRequest) throws -> PandaDocProviderHTTPResponse {
        var value = URLRequest(url: request.url); value.httpMethod = "GET"; value.timeoutInterval = 20; request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) };
        let session = URLSession(configuration: .ephemeral, delegate: PandaDocNoRedirectDelegate(), delegateQueue: nil), semaphore = DispatchSemaphore(value: 0); var data: Data?, response: HTTPURLResponse?, failure: Error?;
        let task = session.dataTask(with: value) {
            data = $0; response = $1 as? HTTPURLResponse; failure = $2; semaphore.signal()
        }; task.resume(); if semaphore.wait(timeout: .now() + 20) == .timedOut { task.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "pandadoc_http_timeout", message: "PandaDoc API v1 request timed out.") }; session.invalidateAndCancel(); if let failure { throw failure };
        return PandaDocProviderHTTPResponse(statusCode: response?.statusCode ?? 0, headers: response?.allHeaderFields.reduce(into: [:]) { $0[String(describing: $1.key)] = String(describing: $1.value) } ?? [:], body: data ?? Data())
    }
}

public struct PandaDocProviderActionClientResult:Sendable{public let result:JSONRecord;public init(result:JSONRecord){self.result=result}}
public protocol PandaDocProviderActionClient:Sendable{func executePandaDocAction(request:MarketplaceProviderActionAdapterRequest)throws->PandaDocProviderActionClientResult}
public struct FakePandaDocProviderActionClient: PandaDocProviderActionClient {
    public init() {};
    public func executePandaDocAction(request: MarketplaceProviderActionAdapterRequest) throws -> PandaDocProviderActionClientResult {
        switch request.definition.actionKey {
        case "pandadoc_document_list_recent": return output(["semanticReadContract": .string("pandadoc-document-list-recent-v1"), "documents": .array([.object(PandaDocProviderActionSupport.fakeDocument())])]);
        case "pandadoc_document_status_get": return output(["semanticReadContract": .string("pandadoc-document-status-get-v1"), "document": .object(PandaDocProviderActionSupport.fakeDocument())]);
        case "pandadoc_document_folder_list": return output(["semanticReadContract": .string("pandadoc-document-folder-list-v1"), "folders": .array([.object(PandaDocProviderActionSupport.fakeFolder())])]);
        default: throw MarketplaceProviderActionAdapterFailure(code: "pandadoc_fake_action_not_supported", message: "Unsupported PandaDoc action.")
        }
    };
    private func output(_ fields: JSONRecord) -> PandaDocProviderActionClientResult {
        PandaDocProviderActionClientResult(
            result: ["provider": .string("pandadoc"), "adapterBoundary": .string("pandadoc-provider-action-adapter"), "clientMode": .string("fake-pandadoc-api-v1"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-document-state-excluded")].merging(fields) { _, new in new
            })
    }
}

public final class LivePandaDocProviderActionClient:PandaDocProviderActionClient,@unchecked Sendable{
 private let data:LocalDataService;private let secrets:SecretService;private let http:any PandaDocProviderHTTPClient;private let now:@Sendable()->Date
 public init(data:LocalDataService,secrets:SecretService,httpClient:any PandaDocProviderHTTPClient=URLSessionPandaDocProviderHTTPClient(),now:@escaping @Sendable()->Date={Date()}){self.data=data;self.secrets=secrets;self.http=httpClient;self.now=now}
    public func executePandaDocAction(request: MarketplaceProviderActionAdapterRequest) throws -> PandaDocProviderActionClientResult {
        let token = try authorization(request);
        switch request.definition.actionKey {
        case "pandadoc_document_list_recent":
            let root = try get(token, path: "/documents", query: PandaDocProviderActionSupport.documentQuery(now: now())), values = (root.pandaObject?["results"]?.pandaArray ?? []).prefix(25).map { JSONValue.object(PandaDocProviderActionSupport.document($0)) };
            return output(["semanticReadContract": .string("pandadoc-document-list-recent-v1"), "documents": .array(Array(values))]);
        case "pandadoc_document_status_get":
            let id = try PandaDocProviderActionSupport.identifier(request.payload["documentId"], field: "Document ID"), root = try get(token, path: "/documents/" + id, query: []), value = root.pandaObject?["document"] ?? root;
            return output(["semanticReadContract": .string("pandadoc-document-status-get-v1"), "document": .object(PandaDocProviderActionSupport.document(value))]);
        case "pandadoc_document_folder_list":
            let root = try get(token, path: "/documents/folders", query: [URLQueryItem(name: "count", value: "25"), URLQueryItem(name: "page", value: "1")]), values = (root.pandaObject?["results"]?.pandaArray ?? []).prefix(25).map { JSONValue.object(PandaDocProviderActionSupport.folder($0)) };
            return output(["semanticReadContract": .string("pandadoc-document-folder-list-v1"), "folders": .array(Array(values))]);
        default: throw MarketplaceProviderActionAdapterFailure(code: "pandadoc_live_action_not_supported", message: "Unsupported live PandaDoc action.")
        }
    }
    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> String {
        guard let id = request.auditIdentity.connectionId, let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), connection.appSlug == "pandadoc", connection.grantedScopes == ProviderConnectionService.pandaDocRelayOwnedOAuthScopes,
            let membership = connection.health.diagnostics["membershipId"]?.string, PandaDocProviderActionSupport.safe(membership), let workspace = connection.health.diagnostics["workspaceId"]?.string, PandaDocProviderActionSupport.safe(workspace),
            let ref = connection.credentialRequirements.first(where: { $0.fieldKey == "pandadoc_oauth_access_token" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "pandadoc_connection_not_ready", message: "PandaDoc exact membership/workspace connection is not ready.") }; return try secrets.getSecretValue(ref)
    }
    private func get(_ token: String, path: String, query: [URLQueryItem]) throws -> JSONValue {
        var components = URLComponents(string: "https://api.pandadoc.com/public/v1" + path)!; components.queryItems = query.isEmpty ? nil : query;
        let response = try http.send(PandaDocProviderHTTPRequest(url: components.url!, headers: ["Authorization": "Bearer " + token, "Accept": "application/json"])), value = (try? JSONSerialization.jsonObject(with: response.body)).map(PandaDocProviderActionSupport.json) ?? .null;
        guard (200..<300).contains(response.statusCode) else {
            let code =
                response.statusCode == 301 || response.statusCode == 302
                ? "pandadoc_redirect_blocked"
                : response.statusCode == 401 ? "pandadoc_token_invalid_or_expired" : response.statusCode == 403 ? "pandadoc_scope_or_workspace_forbidden" : response.statusCode == 404 ? "pandadoc_resource_not_found" : response.statusCode == 429 ? "pandadoc_rate_limited" : "pandadoc_api_error";
            throw MarketplaceProviderActionAdapterFailure(code: code, message: "PandaDoc API v1 request failed.", providerStatusCode: response.statusCode)
        }; return value
    }
    private func output(_ fields: JSONRecord) -> PandaDocProviderActionClientResult {
        PandaDocProviderActionClientResult(
            result: ["provider": .string("pandadoc"), "adapterBoundary": .string("pandadoc-provider-action-adapter"), "clientMode": .string("live-pandadoc-api-v1"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-document-state-excluded")].merging(fields) { _, new in new
            })
    }
}

public struct PandaDocProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = ["pandadoc_document_list_recent", "pandadoc_document_status_get", "pandadoc_document_folder_list"]; private let client: any PandaDocProviderActionClient;
    public init(client: any PandaDocProviderActionClient = FakePandaDocProviderActionClient()) { self.client = client };
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "pandadoc", Self.allowed.contains(request.definition.actionKey) else { throw MarketplaceProviderActionAdapterFailure(code: "pandadoc_action_not_allowlisted", message: "PandaDoc action is outside bounded read-only Document V1.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executePandaDocAction(request: request).result, error: nil, redactionStatus: "private-document-state-excluded")
    }
}

enum PandaDocProviderActionSupport{
    static func documentQuery(now: Date) -> [URLQueryItem] {
        let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime];
        return [
            URLQueryItem(name: "created_from", value: f.string(from: now.addingTimeInterval(-14 * 86_400))), URLQueryItem(name: "created_to", value: f.string(from: now)), URLQueryItem(name: "count", value: "25"), URLQueryItem(name: "page", value: "1"),
            URLQueryItem(name: "order_by", value: "-date_created"),
        ]
    }
 static func identifier(_ value:JSONValue?,field:String)throws->String{guard let raw=value?.string,safe(raw)else{throw MarketplaceProviderActionAdapterFailure(code:"pandadoc_identifier_invalid",message:"An exact safe PandaDoc \(field) is required.")};return raw}
 static func safe(_ raw:String)->Bool{!raw.isEmpty&&raw.count<=64&&raw.allSatisfy{$0.isLetter||$0.isNumber||$0=="-"||$0=="_"}}
    static func document(_ value: JSONValue) -> JSONRecord {
        let o = value.pandaObject ?? [:];
        return [
            "DocumentId": first(o["id"], o["uuid"]), "Name": scalar(o["name"]), "Status": scalar(o["status"]), "DateCreated": scalar(o["date_created"]), "DateModified": scalar(o["date_modified"]), "DateStatusChanged": scalar(o["date_status_changed"]), "DateCompleted": scalar(o["date_completed"]),
            "DateExpiration": scalar(o["date_expiration"]),
        ]
    }
 static func folder(_ value:JSONValue)->JSONRecord{let o=value.pandaObject ?? [:];return["FolderUUID":first(o["uuid"],o["id"]),"Name":scalar(o["name"])]}
 static func first(_ values:JSONValue?...)->JSONValue{for value in values{let v=scalar(value);if v != .null{return v}};return .null}
 static func scalar(_ value:JSONValue?)->JSONValue{guard let value else{return .null};switch value{case .string,.number,.bool,.null:return value;default:return .null}}
    static func json(_ any: Any) -> JSONValue {
        if any is NSNull { return .null }; if let v = any as? Bool { return .bool(v) }; if let v = any as? String { return .string(v) }; if let v = any as? NSNumber { return .number(v.doubleValue) }; if let v = any as? [Any] { return .array(v.map(json)) };
        if let v = any as? [String: Any] { return .object(v.mapValues(json)) }; return .null
    }
    static func fakeDocument() -> JSONRecord {
        [
            "DocumentId": .string("BhVzRcxH9Z2LgfPPGXFUBa"), "Name": .string("Relay proposal"), "Status": .string("document.sent"), "DateCreated": .string("2026-07-01T09:00:00Z"), "DateModified": .string("2026-07-11T09:00:00Z"), "DateStatusChanged": .string("2026-07-11T09:00:00Z"),
            "DateCompleted": .null, "DateExpiration": .null,
        ]
    }
 static func fakeFolder()->JSONRecord{["FolderUUID":.string("Nq8htXxFssmhRxAPSP4SBP"),"Name":.string("Proposals")]}
}
private extension JSONValue{var pandaObject:JSONRecord?{if case.object(let v)=self{return v};return nil};var pandaArray:[JSONValue]?{if case.array(let v)=self{return v};return nil}}
