import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

public struct OneNoteProviderActionClientResult: Sendable { public var result: JSONRecord; public init(result: JSONRecord) { self.result = result } }
public protocol OneNoteProviderActionClient: Sendable { func executeOneNoteAction(request: MarketplaceProviderActionAdapterRequest) throws -> OneNoteProviderActionClientResult }
public struct FakeOneNoteProviderActionClient: OneNoteProviderActionClient {
    public init() {};
    public func executeOneNoteAction(request: MarketplaceProviderActionAdapterRequest) throws -> OneNoteProviderActionClientResult {
        let fields: JSONRecord;
        switch request.definition.actionKey {
        case "onenote_notebooks_list": fields = ["notebooks": .array([.object(OneNoteProviderActionSupport.fakeNotebook())]), "resultCount": .number(1)];
        case "onenote_notebook_sections_list": _ = try OneNoteProviderActionSupport.identifier(request.payload["notebookId"], "notebookId"); fields = ["sections": .array([.object(OneNoteProviderActionSupport.fakeSection())]), "resultCount": .number(1)];
        case "onenote_section_pages_list": _ = try OneNoteProviderActionSupport.identifier(request.payload["sectionId"], "sectionId"); fields = ["pages": .array([.object(OneNoteProviderActionSupport.fakePage())]), "resultCount": .number(1)];
        case "onenote_page_get": _ = try OneNoteProviderActionSupport.identifier(request.payload["pageId"], "pageId"); fields = ["page": .object(OneNoteProviderActionSupport.fakePage())];
        default: throw MarketplaceProviderActionAdapterFailure(code: "onenote_action_not_supported", message: "Unsupported OneNote action.")
        }; return OneNoteProviderActionClientResult(result: OneNoteProviderActionSupport.base("fake-microsoft-graph").merging(fields) { _, new in new })
    }
}
public final class LiveOneNoteProviderActionClient: OneNoteProviderActionClient, @unchecked Sendable {
  private let data: LocalDataService; private let secrets: SecretService
  public init(data: LocalDataService, secrets: SecretService) { self.data = data; self.secrets = secrets }
    public func executeOneNoteAction(request: MarketplaceProviderActionAdapterRequest) throws -> OneNoteProviderActionClientResult {
        let token = try authorization(request), root: JSONValue, fields: JSONRecord;
        switch request.definition.actionKey {
        case "onenote_notebooks_list":
            root = try get(token: token, path: "/me/onenote/notebooks"); let values = OneNoteProviderActionSupport.records(root).map(OneNoteProviderActionSupport.notebook);
            fields = ["notebooks": .array(values.map(JSONValue.object)), "resultCount": .number(Double(values.count)), "nextPageFollowed": .bool(false)];
        case "onenote_notebook_sections_list":
            let id = try OneNoteProviderActionSupport.identifier(request.payload["notebookId"], "notebookId"); root = try get(token: token, path: "/me/onenote/notebooks/\(id)/sections"); let values = OneNoteProviderActionSupport.records(root).map(OneNoteProviderActionSupport.section);
            fields = ["sections": .array(values.map(JSONValue.object)), "resultCount": .number(Double(values.count)), "nextPageFollowed": .bool(false)];
        case "onenote_section_pages_list":
            let id = try OneNoteProviderActionSupport.identifier(request.payload["sectionId"], "sectionId"); root = try get(token: token, path: "/me/onenote/sections/\(id)/pages"); let values = OneNoteProviderActionSupport.records(root).map(OneNoteProviderActionSupport.page);
            fields = ["pages": .array(values.map(JSONValue.object)), "resultCount": .number(Double(values.count)), "nextPageFollowed": .bool(false)];
        case "onenote_page_get": let id = try OneNoteProviderActionSupport.identifier(request.payload["pageId"], "pageId"); root = try get(token: token, path: "/me/onenote/pages/\(id)"); fields = ["page": .object(OneNoteProviderActionSupport.page(root))];
        default: throw MarketplaceProviderActionAdapterFailure(code: "onenote_live_action_not_supported", message: "Unsupported live OneNote action.")
        }; return OneNoteProviderActionClientResult(result: OneNoteProviderActionSupport.base("live-microsoft-graph").merging(fields) { _, new in new })
    }
    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> String {
        guard let id = request.auditIdentity.connectionId, let c = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), c.appSlug == "onenote", c.appId == request.app.id, c.status == .connected, c.health.state == .ready,
            c.grantedScopes == ProviderConnectionService.oneNoteRelayOwnedOAuthScopes, c.health.diagnostics["delegatedSelfOnly"]?.bool == true, c.health.diagnostics["pageContentEnabled"]?.bool == false, c.health.diagnostics["sharedGroupSiteEnabled"]?.bool == false,
            c.health.diagnostics["writesEnabled"]?.bool == false, c.health.diagnostics["automaticPagination"]?.bool == false, c.health.diagnostics["rawToolsEnabled"]?.bool == false, let ref = c.credentialRequirements.first(where: { $0.fieldKey == "onenote_oauth_access_token" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "onenote_connection_not_ready", message: "OneNote requires a ready exact-scope delegated metadata connection.") }; return try secrets.getSecretValue(ref)
    }
    private func get(token: String, path: String) throws -> JSONValue {
        guard let url = URL(string: "https://graph.microsoft.com/v1.0" + path), url.scheme == "https", url.host == "graph.microsoft.com", url.path.hasPrefix("/v1.0/me/onenote/"), url.query == nil, !url.path.hasSuffix("/content"), !url.path.contains("/resources"), !url.path.contains("/operations")
        else { throw MarketplaceProviderActionAdapterFailure(code: "onenote_unsafe_url", message: "Unsafe OneNote Graph request.") }; var r = URLRequest(url: url, timeoutInterval: 30); r.httpMethod = "GET"; r.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization");
        let semaphore = DispatchSemaphore(value: 0); var captured: Result<(Data, HTTPURLResponse), Error>?;
        URLSession.shared.dataTask(with: r) { bytes, response, error in
            defer { semaphore.signal() }; if let error { captured = .failure(error); return };
            guard let bytes, let response = response as? HTTPURLResponse else { captured = .failure(MarketplaceProviderActionAdapterFailure(code: "onenote_transport_error", message: "Graph returned no HTTP response.")); return }; captured = .success((bytes, response))
        }.resume(); guard semaphore.wait(timeout: .now() + 31) == .success, let captured else { throw MarketplaceProviderActionAdapterFailure(code: "onenote_timeout", message: "Graph request timed out.") }; let (bytes, response) = try captured.get();
        guard (200..<300).contains(response.statusCode) else { throw MarketplaceProviderActionAdapterFailure(code: response.statusCode == 429 ? "onenote_rate_limited" : "onenote_graph_error", message: "OneNote Graph request failed.", providerStatusCode: response.statusCode) };
        guard bytes.count <= 1_000_000 else { throw MarketplaceProviderActionAdapterFailure(code: "onenote_response_too_large", message: "Graph response exceeded 1 MB.") }; return try JSONDecoder().decode(JSONValue.self, from: bytes)
    }
}
public struct OneNoteProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = ["onenote_notebooks_list", "onenote_notebook_sections_list", "onenote_section_pages_list", "onenote_page_get"]; private let client: any OneNoteProviderActionClient;
    public init(client: any OneNoteProviderActionClient = FakeOneNoteProviderActionClient()) { self.client = client };
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "onenote", Self.allowed.contains(request.definition.actionKey), request.permission == .allowed else { throw MarketplaceProviderActionAdapterFailure(code: "onenote_action_not_allowlisted", message: "OneNote V1 permits only four bounded metadata reads.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executeOneNoteAction(request: request).result, error: nil, redactionStatus: "page-content-media-shared-group-site-search-writes-pagination-raw-excluded")
    }
}
public enum OneNoteProviderActionSupport {
    static func base(_ mode: String) -> JSONRecord {
        [
            "provider": .string("onenote"), "adapterBoundary": .string("onenote-provider-action-adapter"), "clientMode": .string(mode), "delegatedSelfOnly": .bool(true), "metadataOnly": .bool(true), "maxResults": .number(25), "writesEnabled": .bool(false), "automaticPagination": .bool(false),
            "rawProviderToolExposure": .bool(false),
        ]
    }
    static func identifier(_ v: JSONValue?, _ field: String) throws -> String {
        guard let s = v?.string, !s.isEmpty, s.count <= 512, s.allSatisfy({ $0.isLetter || $0.isNumber || "-_.!~=".contains($0) }) else { throw MarketplaceProviderActionAdapterFailure(code: "onenote_invalid_identifier", message: "An explicit safe \(field) is required.") }; return s
    }
    static func object(_ v: JSONValue?) -> JSONRecord { guard case .object(let r)? = v else { return [:] }; return r }; static func array(_ v: JSONValue?) -> [JSONValue] { guard case .array(let a)? = v else { return [] }; return a };
    static func scalar(_ v: JSONValue?, _ max: Int = 512) -> JSONValue { guard let v else { return .null }; if case .string(let s) = v { return .string(String(s.prefix(max))) }; if case .number = v { return v }; if case .bool = v { return v }; return .null };
    static func records(_ root: JSONValue?) -> [JSONValue] { Array(array(object(root)["value"]).prefix(25)) }
    static func notebook(_ v: JSONValue?) -> JSONRecord {
        let r = object(v);
        return [
            "id": scalar(r["id"], 512), "displayName": scalar(r["displayName"]), "createdDateTime": scalar(r["createdDateTime"], 64), "lastModifiedDateTime": scalar(r["lastModifiedDateTime"], 64), "isDefault": scalar(r["isDefault"]), "isShared": scalar(r["isShared"]),
            "userRole": scalar(r["userRole"], 64), "webUrl": scalar(object(r["links"])["oneNoteWebUrl"].flatMap { object($0)["href"] }, 2048),
        ]
    }
    static func section(_ v: JSONValue?) -> JSONRecord {
        let r = object(v); return ["id": scalar(r["id"], 512), "displayName": scalar(r["displayName"]), "createdDateTime": scalar(r["createdDateTime"], 64), "lastModifiedDateTime": scalar(r["lastModifiedDateTime"], 64), "isDefault": scalar(r["isDefault"]), "pagesUrl": .null]
    }
    static func page(_ v: JSONValue?) -> JSONRecord {
        let r = object(v);
        return [
            "id": scalar(r["id"], 512), "title": scalar(r["title"]), "createdDateTime": scalar(r["createdDateTime"], 64), "lastModifiedDateTime": scalar(r["lastModifiedDateTime"], 64), "level": scalar(r["level"]), "order": scalar(r["order"]), "contentUrlExcluded": .bool(true),
            "contentExcluded": .bool(true), "previewExcluded": .bool(true), "createdByIdentityExcluded": .bool(true), "lastModifiedByIdentityExcluded": .bool(true),
        ]
    }
    static func fakeNotebook() -> JSONRecord {
        [
            "id": .string("notebook-001"), "displayName": .string("Product Notes"), "createdDateTime": .string("2026-07-01T10:00:00Z"), "lastModifiedDateTime": .string("2026-07-12T08:00:00Z"), "isDefault": .bool(false), "isShared": .bool(false), "userRole": .string("Owner"),
            "webUrl": .string("https://www.onenote.com/notebooks/product"),
        ]
    }; static func fakeSection() -> JSONRecord { ["id": .string("section-001"), "displayName": .string("Launch"), "createdDateTime": .string("2026-07-01T10:00:00Z"), "lastModifiedDateTime": .string("2026-07-12T08:00:00Z"), "isDefault": .bool(false), "pagesUrl": .null] };
    static func fakePage() -> JSONRecord {
        [
            "id": .string("page-001"), "title": .string("Launch checklist"), "createdDateTime": .string("2026-07-01T10:00:00Z"), "lastModifiedDateTime": .string("2026-07-12T08:00:00Z"), "level": .number(0), "order": .number(0), "contentUrlExcluded": .bool(true), "contentExcluded": .bool(true),
            "previewExcluded": .bool(true), "createdByIdentityExcluded": .bool(true), "lastModifiedByIdentityExcluded": .bool(true),
        ]
    }
}
