import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

public struct SharePointProviderActionClientResult: Sendable { public var result: JSONRecord; public init(result: JSONRecord) { self.result = result } }
public protocol SharePointProviderActionClient: Sendable { func executeSharePointAction(request: MarketplaceProviderActionAdapterRequest) throws -> SharePointProviderActionClientResult }
public struct FakeSharePointProviderActionClient: SharePointProviderActionClient {
  public init() {}
    public func executeSharePointAction(request: MarketplaceProviderActionAdapterRequest) throws -> SharePointProviderActionClientResult {
        let fields: JSONRecord;
        switch request.definition.actionKey {
        case "sharepoint_site_get": fields = ["site": .object(SharePointProviderActionSupport.fakeSite())];
        case "sharepoint_lists_list": fields = ["lists": .array([.object(SharePointProviderActionSupport.fakeList())]), "resultCount": .number(1)];
        case "sharepoint_drives_list": fields = ["drives": .array([.object(SharePointProviderActionSupport.fakeDrive())]), "resultCount": .number(1)];
        case "sharepoint_default_library_root_list": fields = ["items": .array([.object(SharePointProviderActionSupport.fakeItem())]), "resultCount": .number(1)];
        default: throw MarketplaceProviderActionAdapterFailure(code: "sharepoint_action_not_supported", message: "Unsupported SharePoint action.")
        }; return SharePointProviderActionClientResult(result: SharePointProviderActionSupport.base("fake-microsoft-graph").merging(fields) { _, new in new })
    }
}
public final class LiveSharePointProviderActionClient: SharePointProviderActionClient, @unchecked Sendable {
  private let data: LocalDataService; private let secrets: SecretService
  public init(data: LocalDataService, secrets: SecretService) { self.data = data; self.secrets = secrets }
    public func executeSharePointAction(request: MarketplaceProviderActionAdapterRequest) throws -> SharePointProviderActionClientResult {
        let auth = try authorization(request), root: JSONValue, fields: JSONRecord;
        switch request.definition.actionKey {
        case "sharepoint_site_get": root = try get(token: auth.token, siteId: auth.siteId, suffix: "", query: ["$select": "id,name,displayName,description,webUrl,createdDateTime,lastModifiedDateTime"]); fields = ["site": .object(SharePointProviderActionSupport.site(root))];
        case "sharepoint_lists_list":
            root = try get(token: auth.token, siteId: auth.siteId, suffix: "/lists", query: ["$top": "25", "$select": "id,name,displayName,description,webUrl,createdDateTime,lastModifiedDateTime,list"]);
            let values = SharePointProviderActionSupport.records(root).map(SharePointProviderActionSupport.list); fields = ["lists": .array(values.map(JSONValue.object)), "resultCount": .number(Double(values.count)), "nextPageFollowed": .bool(false)];
        case "sharepoint_drives_list":
            root = try get(token: auth.token, siteId: auth.siteId, suffix: "/drives", query: ["$top": "25", "$select": "id,name,description,driveType,webUrl,createdDateTime,lastModifiedDateTime"]); let values = SharePointProviderActionSupport.records(root).map(SharePointProviderActionSupport.drive);
            fields = ["drives": .array(values.map(JSONValue.object)), "resultCount": .number(Double(values.count)), "nextPageFollowed": .bool(false)];
        case "sharepoint_default_library_root_list":
            root = try get(token: auth.token, siteId: auth.siteId, suffix: "/drive/root/children", query: ["$top": "25", "$select": "id,name,size,createdDateTime,lastModifiedDateTime,webUrl,file,folder,package,deleted"]);
            let values = SharePointProviderActionSupport.records(root).map(SharePointProviderActionSupport.item); fields = ["items": .array(values.map(JSONValue.object)), "resultCount": .number(Double(values.count)), "nextPageFollowed": .bool(false)];
        default: throw MarketplaceProviderActionAdapterFailure(code: "sharepoint_live_action_not_supported", message: "Unsupported live SharePoint action.")
        }; return SharePointProviderActionClientResult(result: SharePointProviderActionSupport.base("live-microsoft-graph").merging(fields) { _, new in new })
    }
    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> (token: String, siteId: String) {
        guard let id = request.auditIdentity.connectionId, let c = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), c.appSlug == "sharepoint", c.appId == request.app.id, c.status == .connected, c.health.state == .ready,
            c.grantedScopes == ProviderConnectionService.sharePointRelayOwnedOAuthScopes, c.health.diagnostics["selectedSiteOnly"]?.bool == true, c.health.diagnostics["siteGrantVerified"]?.bool == true, c.health.diagnostics["contentEnabled"]?.bool == false,
            c.health.diagnostics["writesEnabled"]?.bool == false, c.health.diagnostics["automaticPagination"]?.bool == false, c.health.diagnostics["rawToolsEnabled"]?.bool == false, let siteId = c.health.diagnostics["selectedSiteId"]?.string, SharePointProviderActionSupport.safeSiteId(siteId),
            let ref = c.credentialRequirements.first(where: { $0.fieldKey == "sharepoint_oauth_access_token" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "sharepoint_connection_not_ready", message: "SharePoint requires a ready exact-scope selected-site grant.") }; return (try secrets.getSecretValue(ref), siteId)
    }
    private func get(token: String, siteId: String, suffix: String, query: [String: String]) throws -> JSONValue {
        var components = URLComponents(string: SharePointProviderActionSupport.origin + "/sites/" + siteId + suffix); components?.queryItems = query.sorted { $0.key < $1.key }.map { URLQueryItem(name: $0.key, value: $0.value) };
        guard let url = components?.url, url.scheme == "https", url.host == "graph.microsoft.com", url.path.hasPrefix("/v1.0/sites/\(siteId)"), !url.path.contains("/items"), !url.path.contains("/permissions"), !url.path.contains("/pages"), !url.path.contains("/columns"),
            !url.path.contains("/content"), query.keys.allSatisfy({ ["$select", "$top"].contains($0) }), query["$top"].map({ $0 == "25" }) ?? true
        else { throw MarketplaceProviderActionAdapterFailure(code: "sharepoint_unsafe_url", message: "Unsafe selected-site Graph request.") }; var r = URLRequest(url: url, timeoutInterval: 30); r.httpMethod = "GET"; r.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization");
        let semaphore = DispatchSemaphore(value: 0); var captured: Result<(Data, HTTPURLResponse), Error>?;
        URLSession.shared.dataTask(with: r) { bytes, response, error in
            defer { semaphore.signal() }; if let error { captured = .failure(error); return };
            guard let bytes, let response = response as? HTTPURLResponse else { captured = .failure(MarketplaceProviderActionAdapterFailure(code: "sharepoint_transport_error", message: "Microsoft Graph returned no HTTP response.")); return }; captured = .success((bytes, response))
        }.resume(); guard semaphore.wait(timeout: .now() + 31) == .success, let captured else { throw MarketplaceProviderActionAdapterFailure(code: "sharepoint_timeout", message: "Microsoft Graph request timed out.") }; let (bytes, response) = try captured.get();
        guard (200..<300).contains(response.statusCode) else { throw MarketplaceProviderActionAdapterFailure(code: response.statusCode == 429 ? "sharepoint_rate_limited" : "sharepoint_graph_error", message: "Microsoft Graph SharePoint request failed.", providerStatusCode: response.statusCode) };
        guard bytes.count <= 1_000_000 else { throw MarketplaceProviderActionAdapterFailure(code: "sharepoint_response_too_large", message: "Graph response exceeded 1 MB.") }; return try JSONDecoder().decode(JSONValue.self, from: bytes)
    }
}
public struct SharePointProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = ["sharepoint_site_get", "sharepoint_lists_list", "sharepoint_drives_list", "sharepoint_default_library_root_list"]; private let client: any SharePointProviderActionClient;
    public init(client: any SharePointProviderActionClient = FakeSharePointProviderActionClient()) { self.client = client };
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "sharepoint", Self.allowed.contains(request.definition.actionKey), request.permission == .allowed else {
            throw MarketplaceProviderActionAdapterFailure(code: "sharepoint_action_not_allowlisted", message: "SharePoint V1 permits only four selected-site metadata reads.")
        }; return MarketplaceProviderActionAdapterResult(result: try client.executeSharePointAction(request: request).result, error: nil, redactionStatus: "tenant-search-list-items-content-identities-permissions-writes-other-sites-pagination-raw-excluded")
    }
}
public enum SharePointProviderActionSupport {
  static let origin = "https://graph.microsoft.com/v1.0"
    static func base(_ mode: String) -> JSONRecord {
        [
            "provider": .string("sharepoint"), "adapterBoundary": .string("sharepoint-provider-action-adapter"), "clientMode": .string(mode), "selectedSiteOnly": .bool(true), "metadataOnly": .bool(true), "maxResults": .number(25), "contentEnabled": .bool(false), "tenantSearchEnabled": .bool(false),
            "writesEnabled": .bool(false), "automaticPagination": .bool(false), "rawProviderToolExposure": .bool(false),
        ]
    }
  static func safeSiteId(_ value: String) -> Bool { !value.isEmpty && value.count <= 512 && value.allSatisfy { $0.isLetter || $0.isNumber || ",-_:.".contains($0) } }
    static func object(_ v: JSONValue?) -> JSONRecord { guard case .object(let r)? = v else { return [:] }; return r }; static func array(_ v: JSONValue?) -> [JSONValue] { guard case .array(let a)? = v else { return [] }; return a };
    static func scalar(_ v: JSONValue?, maximum: Int = 512) -> JSONValue { guard let v else { return .null }; if case .string(let s) = v { return .string(String(s.prefix(maximum))) }; if case .number = v { return v }; if case .bool = v { return v }; return .null };
    static func records(_ root: JSONValue?) -> [JSONValue] { Array(array(object(root)["value"]).prefix(25)) }
    static func site(_ v: JSONValue?) -> JSONRecord {
        let r = object(v);
        return [
            "id": scalar(r["id"], maximum: 512), "name": scalar(r["name"]), "displayName": scalar(r["displayName"]), "description": scalar(r["description"], maximum: 2000), "webUrl": scalar(r["webUrl"], maximum: 2048), "createdDateTime": scalar(r["createdDateTime"], maximum: 64),
            "lastModifiedDateTime": scalar(r["lastModifiedDateTime"], maximum: 64),
        ]
    }
    static func list(_ v: JSONValue?) -> JSONRecord {
        let r = object(v), facet = object(r["list"]);
        return [
            "id": scalar(r["id"], maximum: 256), "name": scalar(r["name"]), "displayName": scalar(r["displayName"]), "description": scalar(r["description"], maximum: 2000), "webUrl": scalar(r["webUrl"], maximum: 2048), "template": scalar(facet["template"], maximum: 64),
            "hidden": scalar(facet["hidden"]), "createdDateTime": scalar(r["createdDateTime"], maximum: 64), "lastModifiedDateTime": scalar(r["lastModifiedDateTime"], maximum: 64), "itemsAndFieldsExcluded": .bool(true),
        ]
    }
    static func drive(_ v: JSONValue?) -> JSONRecord {
        let r = object(v);
        return [
            "id": scalar(r["id"], maximum: 256), "name": scalar(r["name"]), "description": scalar(r["description"], maximum: 2000), "driveType": scalar(r["driveType"], maximum: 32), "webUrl": scalar(r["webUrl"], maximum: 2048), "createdDateTime": scalar(r["createdDateTime"], maximum: 64),
            "lastModifiedDateTime": scalar(r["lastModifiedDateTime"], maximum: 64),
        ]
    }
    static func item(_ v: JSONValue?) -> JSONRecord {
        let r = object(v), file = object(r["file"]), folder = object(r["folder"]), package = object(r["package"]);
        return [
            "id": scalar(r["id"], maximum: 256), "name": scalar(r["name"]), "size": scalar(r["size"]), "createdDateTime": scalar(r["createdDateTime"], maximum: 64), "lastModifiedDateTime": scalar(r["lastModifiedDateTime"], maximum: 64), "webUrl": scalar(r["webUrl"], maximum: 2048),
            "itemType": .string(!folder.isEmpty ? "folder" : (!package.isEmpty ? "package" : "file")), "mimeType": scalar(file["mimeType"], maximum: 128), "childCount": scalar(folder["childCount"]), "deleted": .bool(!object(r["deleted"]).isEmpty), "contentReturned": .bool(false),
            "downloadURLReturned": .bool(false), "identitiesExcluded": .bool(true),
        ]
    }
    static func fakeSite() -> JSONRecord {
        [
            "id": .string("contoso.sharepoint.com,site-collection,site-web"), "name": .string("Product"), "displayName": .string("Product Hub"), "description": .string("Product planning and release knowledge"), "webUrl": .string("https://contoso.sharepoint.com/sites/product"),
            "createdDateTime": .string("2026-01-01T00:00:00Z"), "lastModifiedDateTime": .string("2026-07-11T15:00:00Z"),
        ]
    }
    static func fakeList() -> JSONRecord {
        [
            "id": .string("list-001"), "name": .string("Roadmap"), "displayName": .string("Product Roadmap"), "description": .string("Quarterly roadmap records"), "webUrl": .string("https://contoso.sharepoint.com/sites/product/Lists/Roadmap"), "template": .string("genericList"),
            "hidden": .bool(false), "createdDateTime": .string("2026-01-01T00:00:00Z"), "lastModifiedDateTime": .string("2026-07-11T15:00:00Z"), "itemsAndFieldsExcluded": .bool(true),
        ]
    }
    static func fakeDrive() -> JSONRecord {
        [
            "id": .string("drive-001"), "name": .string("Documents"), "description": .string("Shared product documents"), "driveType": .string("documentLibrary"), "webUrl": .string("https://contoso.sharepoint.com/sites/product/Shared%20Documents"), "createdDateTime": .string("2026-01-01T00:00:00Z"),
            "lastModifiedDateTime": .string("2026-07-11T15:00:00Z"),
        ]
    }
    static func fakeItem() -> JSONRecord {
        [
            "id": .string("item-001"), "name": .string("Launch plan.docx"), "size": .number(42000), "createdDateTime": .string("2026-07-01T10:00:00Z"), "lastModifiedDateTime": .string("2026-07-11T15:00:00Z"),
            "webUrl": .string("https://contoso.sharepoint.com/sites/product/Shared%20Documents/Launch%20plan.docx"), "itemType": .string("file"), "mimeType": .string("application/vnd.openxmlformats-officedocument.wordprocessingml.document"), "childCount": .null, "deleted": .bool(false),
            "contentReturned": .bool(false), "downloadURLReturned": .bool(false), "identitiesExcluded": .bool(true),
        ]
    }
}
