import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

public struct OneDriveProviderActionClientResult: Sendable { public var result: JSONRecord; public init(result: JSONRecord) { self.result = result } }
public protocol OneDriveProviderActionClient: Sendable { func executeOneDriveAction(request: MarketplaceProviderActionAdapterRequest) throws -> OneDriveProviderActionClientResult }

public struct FakeOneDriveProviderActionClient: OneDriveProviderActionClient {
  public init() {}
  public func executeOneDriveAction(request: MarketplaceProviderActionAdapterRequest) throws -> OneDriveProviderActionClientResult {
    let fields: JSONRecord
    switch request.definition.actionKey {
    case "onedrive_drive_get": fields = ["drive": .object(OneDriveProviderActionSupport.fakeDrive())]
    case "onedrive_root_children_list": fields = ["items": .array([.object(OneDriveProviderActionSupport.fakeItem(folder: false))]), "resultCount": .number(1)]
    case "onedrive_folder_children_list": _ = try OneDriveProviderActionSupport.identifier(request.payload["folderId"], field: "folderId"); fields = ["items": .array([.object(OneDriveProviderActionSupport.fakeItem(folder: false))]), "resultCount": .number(1)]
    case "onedrive_item_get": _ = try OneDriveProviderActionSupport.identifier(request.payload["itemId"], field: "itemId"); fields = ["item": .object(OneDriveProviderActionSupport.fakeItem(folder: false))]
    default: throw MarketplaceProviderActionAdapterFailure(code: "onedrive_action_not_supported", message: "Unsupported OneDrive action.")
    }
    return OneDriveProviderActionClientResult(result: OneDriveProviderActionSupport.base("fake-microsoft-graph").merging(fields) { _, new in new })
  }
}

public final class LiveOneDriveProviderActionClient: OneDriveProviderActionClient, @unchecked Sendable {
  private let data: LocalDataService; private let secrets: SecretService
  public init(data: LocalDataService, secrets: SecretService) { self.data = data; self.secrets = secrets }
  public func executeOneDriveAction(request: MarketplaceProviderActionAdapterRequest) throws -> OneDriveProviderActionClientResult {
    let token = try authorization(request), fields: JSONRecord
    switch request.definition.actionKey {
    case "onedrive_drive_get": let root = try get(token: token, path: "/me/drive", query: ["$select": "id,driveType,name,owner,quota,webUrl"]); fields = ["drive": .object(OneDriveProviderActionSupport.drive(root))]
        case "onedrive_root_children_list":
            let root = try get(token: token, path: "/me/drive/root/children", query: ["$top": "25", "$select": OneDriveProviderActionSupport.itemSelect]); let values = OneDriveProviderActionSupport.records(root).map(OneDriveProviderActionSupport.item);
            fields = ["items": .array(values.map(JSONValue.object)), "resultCount": .number(Double(values.count)), "nextPageFollowed": .bool(false)]
        case "onedrive_folder_children_list":
            let id = try OneDriveProviderActionSupport.identifier(request.payload["folderId"], field: "folderId"); let root = try get(token: token, path: "/me/drive/items/\(id)/children", query: ["$top": "25", "$select": OneDriveProviderActionSupport.itemSelect]);
            let values = OneDriveProviderActionSupport.records(root).map(OneDriveProviderActionSupport.item); fields = ["items": .array(values.map(JSONValue.object)), "resultCount": .number(Double(values.count)), "nextPageFollowed": .bool(false)]
        case "onedrive_item_get":
            let id = try OneDriveProviderActionSupport.identifier(request.payload["itemId"], field: "itemId"); let root = try get(token: token, path: "/me/drive/items/\(id)", query: ["$select": OneDriveProviderActionSupport.itemSelect]);
            fields = ["item": .object(OneDriveProviderActionSupport.item(root))]
    default: throw MarketplaceProviderActionAdapterFailure(code: "onedrive_live_action_not_supported", message: "Unsupported live OneDrive action.") }
    return OneDriveProviderActionClientResult(result: OneDriveProviderActionSupport.base("live-microsoft-graph").merging(fields) { _, new in new })
  }
    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> String {
        guard let id = request.auditIdentity.connectionId, let c = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), c.appSlug == "onedrive", c.appId == request.app.id, c.status == .connected, c.health.state == .ready,
            c.grantedScopes == ProviderConnectionService.oneDriveRelayOwnedOAuthScopes, c.health.diagnostics["delegatedOnly"]?.bool == true, c.health.diagnostics["selfDriveOnly"]?.bool == true, c.health.diagnostics["contentDownloadEnabled"]?.bool == false,
            c.health.diagnostics["sharedRemoteEnabled"]?.bool == false, c.health.diagnostics["writesEnabled"]?.bool == false, c.health.diagnostics["automaticPagination"]?.bool == false, c.health.diagnostics["rawToolsEnabled"]?.bool == false,
            let ref = c.credentialRequirements.first(where: { $0.fieldKey == "onedrive_oauth_access_token" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "onedrive_connection_not_ready", message: "OneDrive requires a ready exact-scope delegated own-drive metadata connection.") }; return try secrets.getSecretValue(ref)
    }
  private func get(token: String, path: String, query: [String: String]) throws -> JSONValue {
    var components = URLComponents(string: OneDriveProviderActionSupport.origin + path); components?.queryItems = query.sorted { $0.key < $1.key }.map { URLQueryItem(name: $0.key, value: $0.value) }
        guard let url = components?.url, url.scheme == "https", url.host == "graph.microsoft.com", url.path == "/v1.0/me/drive" || url.path.hasPrefix("/v1.0/me/drive/"), !url.path.contains("/content"), !url.path.contains("/search"), !url.path.contains("/sharedWithMe"),
            !url.path.contains("/permissions"), !url.path.contains("/versions"), query.keys.allSatisfy({ ["$select", "$top"].contains($0) }), query["$top"].map({ $0 == "25" }) ?? true
        else { throw MarketplaceProviderActionAdapterFailure(code: "onedrive_unsafe_url", message: "Unsafe Microsoft Graph OneDrive request.") }
    var r = URLRequest(url: url, timeoutInterval: 30); r.httpMethod = "GET"; r.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    let semaphore = DispatchSemaphore(value: 0); var captured: Result<(Data, HTTPURLResponse), Error>?
        URLSession.shared.dataTask(with: r) { bytes, response, error in
            defer { semaphore.signal() }; if let error { captured = .failure(error); return };
            guard let bytes, let response = response as? HTTPURLResponse else { captured = .failure(MarketplaceProviderActionAdapterFailure(code: "onedrive_transport_error", message: "Microsoft Graph returned no HTTP response.")); return }; captured = .success((bytes, response))
        }.resume()
        guard semaphore.wait(timeout: .now() + 31) == .success, let captured else { throw MarketplaceProviderActionAdapterFailure(code: "onedrive_timeout", message: "Microsoft Graph request timed out.") }; let (bytes, response) = try captured.get();
        guard (200..<300).contains(response.statusCode) else { throw MarketplaceProviderActionAdapterFailure(code: response.statusCode == 429 ? "onedrive_rate_limited" : "onedrive_graph_error", message: "Microsoft Graph OneDrive request failed.", providerStatusCode: response.statusCode) };
        guard bytes.count <= 1_000_000 else { throw MarketplaceProviderActionAdapterFailure(code: "onedrive_response_too_large", message: "Graph response exceeded 1 MB.") }; return try JSONDecoder().decode(JSONValue.self, from: bytes)
  }
}

public struct OneDriveProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = ["onedrive_drive_get", "onedrive_root_children_list", "onedrive_folder_children_list", "onedrive_item_get"]; private let client: any OneDriveProviderActionClient;
    public init(client: any OneDriveProviderActionClient = FakeOneDriveProviderActionClient()) { self.client = client };
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "onedrive", Self.allowed.contains(request.definition.actionKey), request.permission == .allowed else {
            throw MarketplaceProviderActionAdapterFailure(code: "onedrive_action_not_allowlisted", message: "OneDrive V1 permits only four bounded own-drive metadata reads.")
        }; return MarketplaceProviderActionAdapterResult(result: try client.executeOneDriveAction(request: request).result, error: nil, redactionStatus: "content-download-shared-remote-search-permissions-versions-writes-other-drives-pagination-raw-excluded")
    }
}

public enum OneDriveProviderActionSupport {
  static let origin = "https://graph.microsoft.com/v1.0", itemSelect = "id,name,size,createdDateTime,lastModifiedDateTime,webUrl,file,folder,package,deleted"
    static func base(_ mode: String) -> JSONRecord {
        [
            "provider": .string("onedrive"), "adapterBoundary": .string("onedrive-provider-action-adapter"), "clientMode": .string(mode), "delegatedOnly": .bool(true), "selfDriveOnly": .bool(true), "metadataOnly": .bool(true), "maxResults": .number(25), "contentDownloadEnabled": .bool(false),
            "sharedRemoteEnabled": .bool(false), "writesEnabled": .bool(false), "automaticPagination": .bool(false), "rawProviderToolExposure": .bool(false),
        ]
    }
    static func object(_ v: JSONValue?) -> JSONRecord { guard case .object(let r)? = v else { return [:] }; return r }; static func array(_ v: JSONValue?) -> [JSONValue] { guard case .array(let a)? = v else { return [] }; return a };
    static func scalar(_ v: JSONValue?, maximum: Int = 512) -> JSONValue { guard let v else { return .null }; if case .string(let s) = v { return .string(String(s.prefix(maximum))) }; if case .number = v { return v }; if case .bool = v { return v }; return .null };
    static func records(_ root: JSONValue?) -> [JSONValue] { Array(array(object(root)["value"]).prefix(25)) }
    static func identifier(_ v: JSONValue?, field: String) throws -> String {
        guard let s = v?.string, !s.isEmpty, s.count <= 256, s.allSatisfy({ $0.isLetter || $0.isNumber || "-_.!~".contains($0) }) else { throw MarketplaceProviderActionAdapterFailure(code: "onedrive_invalid_identifier", message: "An explicit safe \(field) is required.") }; return s
    }
    static func drive(_ v: JSONValue?) -> JSONRecord {
        let r = object(v), owner = object(object(r["owner"])["user"]), quota = object(r["quota"]);
        return [
            "id": scalar(r["id"], maximum: 256), "name": scalar(r["name"]), "driveType": scalar(r["driveType"], maximum: 32), "ownerDisplayName": scalar(owner["displayName"]), "webUrl": scalar(r["webUrl"], maximum: 2048), "quotaState": scalar(quota["state"], maximum: 32),
            "quotaTotal": scalar(quota["total"]), "quotaUsed": scalar(quota["used"]), "quotaRemaining": scalar(quota["remaining"]), "ownerIdentifiersExcluded": .bool(true),
        ]
    }
    static func item(_ v: JSONValue?) -> JSONRecord {
        let r = object(v), file = object(r["file"]), folder = object(r["folder"]), package = object(r["package"]), hashes = object(file["hashes"]);
        return [
            "id": scalar(r["id"], maximum: 256), "name": scalar(r["name"], maximum: 512), "size": scalar(r["size"]), "createdDateTime": scalar(r["createdDateTime"], maximum: 64), "lastModifiedDateTime": scalar(r["lastModifiedDateTime"], maximum: 64), "webUrl": scalar(r["webUrl"], maximum: 2048),
            "itemType": .string(!folder.isEmpty ? "folder" : (!package.isEmpty ? "package" : "file")), "mimeType": scalar(file["mimeType"], maximum: 128), "quickXorHash": scalar(hashes["quickXorHash"], maximum: 256), "childCount": scalar(folder["childCount"]),
            "deleted": .bool(!object(r["deleted"]).isEmpty), "contentReturned": .bool(false), "downloadURLReturned": .bool(false), "identitySharingMetadataExcluded": .bool(true),
        ]
    }
    static func fakeDrive() -> JSONRecord {
        [
            "id": .string("b!exampleDrive"), "name": .string("Alex's OneDrive"), "driveType": .string("business"), "ownerDisplayName": .string("Alex Example"), "webUrl": .string("https://example-my.sharepoint.com/personal/alex"), "quotaState": .string("normal"), "quotaTotal": .number(1_000_000_000),
            "quotaUsed": .number(250_000_000), "quotaRemaining": .number(750_000_000), "ownerIdentifiersExcluded": .bool(true),
        ]
    }
    static func fakeItem(folder: Bool) -> JSONRecord {
        [
            "id": .string("01EXAMPLEITEM"), "name": .string(folder ? "Projects" : "Roadmap.pdf"), "size": .number(folder ? 0 : 124000), "createdDateTime": .string("2026-07-01T09:00:00Z"), "lastModifiedDateTime": .string("2026-07-11T16:30:00Z"),
            "webUrl": .string("https://example-my.sharepoint.com/:b:/g/example"), "itemType": .string(folder ? "folder" : "file"), "mimeType": folder ? .null : .string("application/pdf"), "quickXorHash": folder ? .null : .string("exampleHash"), "childCount": folder ? .number(3) : .null,
            "deleted": .bool(false), "contentReturned": .bool(false), "downloadURLReturned": .bool(false), "identitySharingMetadataExcluded": .bool(true),
        ]
    }
}
