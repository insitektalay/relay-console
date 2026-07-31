import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

public struct OutlookProviderActionClientResult: Sendable { public var result: JSONRecord; public init(result: JSONRecord) { self.result = result } }
public protocol OutlookProviderActionClient: Sendable { func executeOutlookAction(request: MarketplaceProviderActionAdapterRequest) throws -> OutlookProviderActionClientResult }
public struct FakeOutlookProviderActionClient: OutlookProviderActionClient {
  public init() {}
    public func executeOutlookAction(request: MarketplaceProviderActionAdapterRequest) throws -> OutlookProviderActionClientResult {
        let fields: JSONRecord;
        switch request.definition.actionKey {
        case "outlook_mail_folders_list": fields = ["folders": .array([.object(OutlookProviderActionSupport.fakeFolder())]), "resultCount": .number(1)];
        case "outlook_inbox_messages_list", "outlook_unread_messages_list": fields = ["messages": .array([.object(OutlookProviderActionSupport.fakeMessage(includeBody: false))]), "resultCount": .number(1), "unreadOnly": .bool(request.definition.actionKey == "outlook_unread_messages_list")];
        case "outlook_message_get": _ = try OutlookProviderActionSupport.messageId(request.payload["messageId"]); fields = ["message": .object(OutlookProviderActionSupport.fakeMessage(includeBody: true))];
        default: throw MarketplaceProviderActionAdapterFailure(code: "outlook_action_not_supported", message: "Unsupported Outlook action.")
        }; return OutlookProviderActionClientResult(result: OutlookProviderActionSupport.base("fake-microsoft-graph").merging(fields) { _, new in new })
    }
}
public final class LiveOutlookProviderActionClient: OutlookProviderActionClient, @unchecked Sendable {
  private let data: LocalDataService; private let secrets: SecretService
  public init(data: LocalDataService, secrets: SecretService) { self.data = data; self.secrets = secrets }
  public func executeOutlookAction(request: MarketplaceProviderActionAdapterRequest) throws -> OutlookProviderActionClientResult {
    let token = try authorization(request), root: JSONValue, fields: JSONRecord
    switch request.definition.actionKey {
        case "outlook_mail_folders_list":
            root = try send(token: token, path: "/me/mailFolders", query: ["$top": "25", "$select": "id,displayName,parentFolderId,childFolderCount,unreadItemCount,totalItemCount"], textBody: false); let values = OutlookProviderActionSupport.records(root).map(OutlookProviderActionSupport.folder);
            fields = ["folders": .array(values.map(JSONValue.object)), "resultCount": .number(Double(values.count)), "nextPageFollowed": .bool(false)]
        case "outlook_inbox_messages_list", "outlook_unread_messages_list":
            let unread = request.definition.actionKey == "outlook_unread_messages_list"; var query = ["$top": "25", "$orderby": "receivedDateTime desc", "$select": OutlookProviderActionSupport.messageListSelect]; if unread { query["$filter"] = "isRead eq false" };
            root = try send(token: token, path: "/me/mailFolders/inbox/messages", query: query, textBody: true); let values = OutlookProviderActionSupport.records(root).map { OutlookProviderActionSupport.message($0, includeBody: false) };
            fields = ["messages": .array(values.map(JSONValue.object)), "resultCount": .number(Double(values.count)), "unreadOnly": .bool(unread), "nextPageFollowed": .bool(false)]
        case "outlook_message_get":
            let id = try OutlookProviderActionSupport.messageId(request.payload["messageId"]), encoded = id.addingPercentEncoding(withAllowedCharacters: OutlookProviderActionSupport.idPathCharacters)!;
            root = try send(token: token, path: "/me/messages/\(encoded)", query: ["$select": OutlookProviderActionSupport.messageGetSelect], textBody: true); fields = ["message": .object(OutlookProviderActionSupport.message(root, includeBody: true))]
    default: throw MarketplaceProviderActionAdapterFailure(code: "outlook_live_action_not_supported", message: "Unsupported live Outlook action.") }
    return OutlookProviderActionClientResult(result: OutlookProviderActionSupport.base("live-microsoft-graph").merging(fields) { _, new in new })
  }
    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> String {
        guard let id = request.auditIdentity.connectionId, let c = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), c.appSlug == "outlook", c.appId == request.app.id, c.status == .connected, c.health.state == .ready,
            c.grantedScopes == ProviderConnectionService.outlookRelayOwnedOAuthScopes, c.health.diagnostics["delegatedOnly"]?.bool == true, c.health.diagnostics["selfMailboxOnly"]?.bool == true, c.health.diagnostics["sharedMailEnabled"]?.bool == false,
            c.health.diagnostics["applicationPermissionsEnabled"]?.bool == false, c.health.diagnostics["attachmentsEnabled"]?.bool == false, c.health.diagnostics["searchEnabled"]?.bool == false, c.health.diagnostics["writesEnabled"]?.bool == false,
            c.health.diagnostics["automaticPagination"]?.bool == false, c.health.diagnostics["rawToolsEnabled"]?.bool == false, let ref = c.credentialRequirements.first(where: { $0.fieldKey == "outlook_oauth_access_token" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "outlook_connection_not_ready", message: "Outlook requires a ready exact-scope delegated self-mailbox connection.") }; return try secrets.getSecretValue(ref)
    }
    private func send(token: String, path: String, query: [String: String], textBody: Bool) throws -> JSONValue {
        var components = URLComponents(string: OutlookProviderActionSupport.origin + path); components?.queryItems = query.sorted { $0.key < $1.key }.map { URLQueryItem(name: $0.key, value: $0.value) };
        guard let url = components?.url, url.scheme == "https", url.host == "graph.microsoft.com", url.path.hasPrefix("/v1.0/me/"), !url.path.contains("attachments"), !url.path.contains("$value"), query["$search"] == nil, query["$skiptoken"] == nil,
            query["$top"] != nil || path.hasPrefix("/me/messages/")
        else { throw MarketplaceProviderActionAdapterFailure(code: "outlook_unsafe_url", message: "Unsafe Microsoft Graph mail request.") }; var r = URLRequest(url: url, timeoutInterval: 30); r.httpMethod = "GET"; r.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization");
        if textBody { r.setValue("outlook.body-content-type=\"text\"", forHTTPHeaderField: "Prefer") }; let semaphore = DispatchSemaphore(value: 0); var captured: Result<(Data, HTTPURLResponse), Error>?;
        URLSession.shared.dataTask(with: r) { bytes, response, error in
            defer { semaphore.signal() }; if let error { captured = .failure(error); return };
            guard let bytes, let response = response as? HTTPURLResponse else { captured = .failure(MarketplaceProviderActionAdapterFailure(code: "outlook_transport_error", message: "Microsoft Graph returned no HTTP response.")); return }; captured = .success((bytes, response))
        }.resume(); guard semaphore.wait(timeout: .now() + 31) == .success, let captured else { throw MarketplaceProviderActionAdapterFailure(code: "outlook_timeout", message: "Microsoft Graph request timed out.") }; let (bytes, response) = try captured.get();
        guard (200..<300).contains(response.statusCode) else { throw MarketplaceProviderActionAdapterFailure(code: response.statusCode == 429 ? "outlook_rate_limited" : "outlook_graph_error", message: "Microsoft Graph request failed.", providerStatusCode: response.statusCode) };
        guard bytes.count <= 1_000_000 else { throw MarketplaceProviderActionAdapterFailure(code: "outlook_response_too_large", message: "Graph response exceeded 1 MB.") }; return try JSONDecoder().decode(JSONValue.self, from: bytes)
    }
}
public struct OutlookProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = ["outlook_mail_folders_list", "outlook_inbox_messages_list", "outlook_unread_messages_list", "outlook_message_get"]; private let client: any OutlookProviderActionClient;
    public init(client: any OutlookProviderActionClient = FakeOutlookProviderActionClient()) { self.client = client };
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "outlook", Self.allowed.contains(request.definition.actionKey), request.permission == .allowed else { throw MarketplaceProviderActionAdapterFailure(code: "outlook_action_not_allowlisted", message: "Outlook V1 permits only four bounded reads.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executeOutlookAction(request: request).result, error: nil, redactionStatus: "shared-application-attachments-mime-search-export-writes-other-graph-pagination-raw-excluded")
    }
}
public enum OutlookProviderActionSupport {
  static let origin = "https://graph.microsoft.com/v1.0", messageListSelect = "id,subject,from,toRecipients,ccRecipients,receivedDateTime,sentDateTime,isRead,importance,hasAttachments,conversationId,webLink,categories,bodyPreview", messageGetSelect = messageListSelect + ",body"
  static let idPathCharacters: CharacterSet = { var set = CharacterSet.alphanumerics; set.insert(charactersIn: "-_=.~"); return set }()
    static func base(_ mode: String) -> JSONRecord {
        [
            "provider": .string("outlook"), "adapterBoundary": .string("outlook-provider-action-adapter"), "clientMode": .string(mode), "delegatedOnly": .bool(true), "selfMailboxOnly": .bool(true), "maxResults": .number(25), "maxBodyCharacters": .number(8000), "sharedMailEnabled": .bool(false),
            "attachmentsEnabled": .bool(false), "searchEnabled": .bool(false), "writesEnabled": .bool(false), "automaticPagination": .bool(false), "rawProviderToolExposure": .bool(false),
        ]
    }
    static func object(_ v: JSONValue?) -> JSONRecord { guard case .object(let r)? = v else { return [:] }; return r }; static func array(_ v: JSONValue?) -> [JSONValue] { guard case .array(let a)? = v else { return [] }; return a };
    static func scalar(_ v: JSONValue?, maximum: Int = 512) -> JSONValue { guard let v else { return .null }; if case .string(let s) = v { return .string(String(s.prefix(maximum))) }; if case .number = v { return v }; if case .bool = v { return v }; return .null };
    static func records(_ root: JSONValue?) -> [JSONValue] { Array(array(object(root)["value"]).prefix(25)) }
    static func messageId(_ v: JSONValue?) throws -> String {
        guard let s = v?.string, !s.isEmpty, s.count <= 1024, s.allSatisfy({ $0.isLetter || $0.isNumber || "-_=.~".contains($0) }) else { throw MarketplaceProviderActionAdapterFailure(code: "outlook_invalid_message_id", message: "An explicit safe Graph messageId is required.") }; return s
    }
    static func address(_ v: JSONValue?) -> JSONRecord { let e = object(object(v)["emailAddress"]); return ["name": scalar(e["name"]), "address": scalar(e["address"], maximum: 320)] };
    static func addresses(_ v: JSONValue?) -> JSONValue { .array(Array(array(v).prefix(25)).map { .object(address($0)) }) }
    static func folder(_ v: JSONValue) -> JSONRecord {
        let r = object(v);
        return [
            "id": scalar(r["id"], maximum: 1024), "displayName": scalar(r["displayName"]), "parentFolderId": scalar(r["parentFolderId"], maximum: 1024), "childFolderCount": scalar(r["childFolderCount"]), "unreadItemCount": scalar(r["unreadItemCount"]), "totalItemCount": scalar(r["totalItemCount"]),
            "hiddenFoldersExcluded": .bool(true),
        ]
    }
    static func message(_ v: JSONValue?, includeBody: Bool) -> JSONRecord {
        let r = object(v), body = object(r["body"]);
        var result: JSONRecord = [
            "id": scalar(r["id"], maximum: 1024), "subject": scalar(r["subject"]), "from": .object(address(r["from"])), "toRecipients": addresses(r["toRecipients"]), "ccRecipients": addresses(r["ccRecipients"]), "receivedDateTime": scalar(r["receivedDateTime"], maximum: 64),
            "sentDateTime": scalar(r["sentDateTime"], maximum: 64), "isRead": scalar(r["isRead"]), "importance": scalar(r["importance"], maximum: 32), "hasAttachments": scalar(r["hasAttachments"]), "conversationId": scalar(r["conversationId"], maximum: 1024),
            "webLink": scalar(r["webLink"], maximum: 2048), "categories": .array(Array(array(r["categories"]).prefix(25)).map { scalar($0, maximum: 128) }), "bodyPreview": scalar(r["bodyPreview"], maximum: 1000), "attachmentsReturned": .bool(false), "htmlReturned": .bool(false),
        ]
            ;
        if includeBody { result["body"] = scalar(body["content"], maximum: 8000); result["bodyContentType"] = .string("text") }; return result
    }
  static func fakeFolder() -> JSONRecord { ["id": .string("inbox"), "displayName": .string("Inbox"), "parentFolderId": .string("root"), "childFolderCount": .number(0), "unreadItemCount": .number(3), "totalItemCount": .number(42), "hiddenFoldersExcluded": .bool(true)] }
    static func fakeMessage(includeBody: Bool) -> JSONRecord {
        var r: JSONRecord = [
            "id": .string("AAMkExample123="), "subject": .string("Quarterly planning review"), "from": .object(["name": .string("Jordan Lee"), "address": .string("jordan@example.com")]), "toRecipients": .array([.object(["name": .string("Alex"), "address": .string("alex@example.com")])]),
            "ccRecipients": .array([]), "receivedDateTime": .string("2026-07-12T08:00:00Z"), "sentDateTime": .string("2026-07-12T07:59:00Z"), "isRead": .bool(false), "importance": .string("normal"), "hasAttachments": .bool(false), "conversationId": .string("AAQkConversation"),
            "webLink": .string("https://outlook.office.com/mail/deeplink/read/AAMkExample123"), "categories": .array([.string("Planning")]), "bodyPreview": .string("Please review the priorities before Tuesday."), "attachmentsReturned": .bool(false), "htmlReturned": .bool(false),
        ]
            ;
        if includeBody { r["body"] = .string("Please review the priorities before Tuesday and add your comments."); r["bodyContentType"] = .string("text") }; return r
    }
}
