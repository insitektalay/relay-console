import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

public struct MicrosoftListsProviderActionClientResult: Sendable { public var result: JSONRecord; public init(result: JSONRecord) { self.result = result } }
public protocol MicrosoftListsProviderActionClient: Sendable { func executeMicrosoftListsAction(request: MarketplaceProviderActionAdapterRequest) throws -> MicrosoftListsProviderActionClientResult }
public struct FakeMicrosoftListsProviderActionClient: MicrosoftListsProviderActionClient {
    public init() {};
    public func executeMicrosoftListsAction(request: MarketplaceProviderActionAdapterRequest) throws -> MicrosoftListsProviderActionClientResult {
        let fields: JSONRecord;
        switch request.definition.actionKey {
        case "microsoft_lists_list_get": fields = ["list": .object(MicrosoftListsProviderActionSupport.fakeList())];
        case "microsoft_lists_columns_list": fields = ["columns": .array([.object(MicrosoftListsProviderActionSupport.fakeColumn())]), "resultCount": .number(1)];
        case "microsoft_lists_items_list": fields = ["items": .array([.object(MicrosoftListsProviderActionSupport.fakeItem())]), "resultCount": .number(1)];
        case "microsoft_lists_item_get": _ = try MicrosoftListsProviderActionSupport.identifier(request.payload["itemId"], "itemId"); fields = ["item": .object(MicrosoftListsProviderActionSupport.fakeItem())];
        default: throw MarketplaceProviderActionAdapterFailure(code: "microsoft_lists_action_not_supported", message: "Unsupported Microsoft Lists action.")
        }; return MicrosoftListsProviderActionClientResult(result: MicrosoftListsProviderActionSupport.base("fake-microsoft-graph").merging(fields) { _, new in new })
    }
}
public final class LiveMicrosoftListsProviderActionClient: MicrosoftListsProviderActionClient, @unchecked Sendable {
  private let data: LocalDataService; private let secrets: SecretService
  public init(data: LocalDataService, secrets: SecretService) { self.data = data; self.secrets = secrets }
    public func executeMicrosoftListsAction(request: MarketplaceProviderActionAdapterRequest) throws -> MicrosoftListsProviderActionClientResult {
        let authority = try authorization(request), root: JSONValue, fields: JSONRecord, base = "/sites/\(authority.siteId)/lists/\(authority.listId)";
        switch request.definition.actionKey {
        case "microsoft_lists_list_get": root = try get(token: authority.token, path: base, allowedFields: authority.allowedFields); fields = ["list": .object(MicrosoftListsProviderActionSupport.list(root))];
        case "microsoft_lists_columns_list":
            root = try get(token: authority.token, path: base + "/columns", allowedFields: authority.allowedFields);
            let values = MicrosoftListsProviderActionSupport.records(root).filter { authority.allowedFields.contains(MicrosoftListsProviderActionSupport.object($0)["name"]?.string ?? "") }.map(MicrosoftListsProviderActionSupport.column);
            fields = ["columns": .array(values.map(JSONValue.object)), "resultCount": .number(Double(values.count)), "nextPageFollowed": .bool(false)];
        case "microsoft_lists_items_list":
            root = try get(token: authority.token, path: base + "/items", allowedFields: authority.allowedFields); let values = MicrosoftListsProviderActionSupport.records(root).map { MicrosoftListsProviderActionSupport.item($0, allowedFields: authority.allowedFields) };
            fields = ["items": .array(values.map(JSONValue.object)), "resultCount": .number(Double(values.count)), "nextPageFollowed": .bool(false)];
        case "microsoft_lists_item_get":
            let id = try MicrosoftListsProviderActionSupport.identifier(request.payload["itemId"], "itemId"); root = try get(token: authority.token, path: base + "/items/\(id)", allowedFields: authority.allowedFields);
            fields = ["item": .object(MicrosoftListsProviderActionSupport.item(root, allowedFields: authority.allowedFields))];
        default: throw MarketplaceProviderActionAdapterFailure(code: "microsoft_lists_live_action_not_supported", message: "Unsupported live Microsoft Lists action.")
        }; return MicrosoftListsProviderActionClientResult(result: MicrosoftListsProviderActionSupport.base("live-microsoft-graph").merging(fields) { _, new in new })
    }
    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> (token: String, siteId: String, listId: String, allowedFields: Set<String>) {
        guard let id = request.auditIdentity.connectionId, let c = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), c.appSlug == "microsoft-lists", c.appId == request.app.id, c.status == .connected, c.health.state == .ready,
            c.grantedScopes == ProviderConnectionService.microsoftListsRelayOwnedOAuthScopes, c.health.diagnostics["selectedListOnly"]?.bool == true, c.health.diagnostics["listGrantVerified"]?.bool == true, c.health.diagnostics["writesEnabled"]?.bool == false,
            c.health.diagnostics["automaticPagination"]?.bool == false, c.health.diagnostics["rawToolsEnabled"]?.bool == false, let site = c.health.diagnostics["selectedSiteId"]?.string, let list = c.health.diagnostics["selectedListId"]?.string,
            let ref = c.credentialRequirements.first(where: { $0.fieldKey == "microsoft_lists_oauth_access_token" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "microsoft_lists_connection_not_ready", message: "Microsoft Lists requires a ready exact-scope selected-list connection.") }; let fields = MicrosoftListsProviderActionSupport.stringSet(c.health.diagnostics["allowedFieldNames"]);
        guard MicrosoftListsProviderActionSupport.safeSiteId(site), MicrosoftListsProviderActionSupport.safeFieldSet(fields), !fields.isEmpty else {
            throw MarketplaceProviderActionAdapterFailure(code: "microsoft_lists_field_policy_invalid", message: "Microsoft Lists allowed-field policy is invalid.")
        }; return (try secrets.getSecretValue(ref), site, try MicrosoftListsProviderActionSupport.identifier(.string(list), "listId"), fields)
    }
    private func get(token: String, path: String, allowedFields: Set<String>) throws -> JSONValue {
        var components = URLComponents(string: "https://graph.microsoft.com/v1.0" + path); if path.contains("/items") { components?.queryItems = [URLQueryItem(name: "$expand", value: "fields($select=\(allowedFields.sorted().joined(separator: ",")))")] };
        guard let url = components?.url, url.scheme == "https", url.host == "graph.microsoft.com", url.path.hasPrefix("/v1.0/sites/"), url.path.contains("/lists/"), !url.path.contains("/permissions"), !url.path.contains("/operations"), !url.path.contains("/drive"), !url.path.contains("/delta")
        else { throw MarketplaceProviderActionAdapterFailure(code: "microsoft_lists_unsafe_url", message: "Unsafe Microsoft Lists Graph request.") }; var r = URLRequest(url: url, timeoutInterval: 30); r.httpMethod = "GET"; r.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization");
        let semaphore = DispatchSemaphore(value: 0); var captured: Result<(Data, HTTPURLResponse), Error>?;
        URLSession.shared.dataTask(with: r) { bytes, response, error in
            defer { semaphore.signal() }; if let error { captured = .failure(error); return };
            guard let bytes, let response = response as? HTTPURLResponse else { captured = .failure(MarketplaceProviderActionAdapterFailure(code: "microsoft_lists_transport_error", message: "Graph returned no HTTP response.")); return }; captured = .success((bytes, response))
        }.resume(); guard semaphore.wait(timeout: .now() + 31) == .success, let captured else { throw MarketplaceProviderActionAdapterFailure(code: "microsoft_lists_timeout", message: "Graph request timed out.") }; let (bytes, response) = try captured.get();
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(code: response.statusCode == 429 ? "microsoft_lists_rate_limited" : "microsoft_lists_graph_error", message: "Microsoft Lists Graph request failed.", providerStatusCode: response.statusCode)
        }; guard bytes.count <= 1_000_000 else { throw MarketplaceProviderActionAdapterFailure(code: "microsoft_lists_response_too_large", message: "Graph response exceeded 1 MB.") }; return try JSONDecoder().decode(JSONValue.self, from: bytes)
    }
}
public struct MicrosoftListsProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = ["microsoft_lists_list_get", "microsoft_lists_columns_list", "microsoft_lists_items_list", "microsoft_lists_item_get"]; private let client: any MicrosoftListsProviderActionClient;
    public init(client: any MicrosoftListsProviderActionClient = FakeMicrosoftListsProviderActionClient()) { self.client = client };
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "microsoft-lists", Self.allowed.contains(request.definition.actionKey), request.permission == .allowed else {
            throw MarketplaceProviderActionAdapterFailure(code: "microsoft_lists_action_not_allowlisted", message: "Microsoft Lists V1 permits only four selected-list reads.")
        }; return MarketplaceProviderActionAdapterResult(result: try client.executeMicrosoftListsAction(request: request).result, error: nil, redactionStatus: "selected-list-allowed-fields-only-writes-permissions-attachments-pagination-raw-excluded")
    }
}
public enum MicrosoftListsProviderActionSupport {
    static func base(_ mode: String) -> JSONRecord {
        [
            "provider": .string("microsoft-lists"), "adapterBoundary": .string("microsoft-lists-provider-action-adapter"), "clientMode": .string(mode), "selectedListOnly": .bool(true), "maxResults": .number(25), "writesEnabled": .bool(false), "automaticPagination": .bool(false),
            "rawProviderToolExposure": .bool(false),
        ]
    }
    static func identifier(_ v: JSONValue?, _ field: String) throws -> String {
        guard let s = v?.string, !s.isEmpty, s.count <= 512, s.allSatisfy({ $0.isLetter || $0.isNumber || "-_.!~=".contains($0) }) else { throw MarketplaceProviderActionAdapterFailure(code: "microsoft_lists_invalid_identifier", message: "An explicit safe \(field) is required.") }; return s
    }
    static func safeSiteId(_ s: String) -> Bool { !s.isEmpty && s.count <= 512 && s.allSatisfy { $0.isLetter || $0.isNumber || ",-_ .".contains($0) } };
    static func safeFieldSet(_ s: Set<String>) -> Bool { s.count <= 20 && s.allSatisfy { !$0.isEmpty && $0.count <= 64 && $0.allSatisfy { $0.isLetter || $0.isNumber || $0 == "_" } } }
  public static func stringSet(_ value: JSONValue?) -> Set<String> { guard case .array(let values)? = value else { return [] }; return Set(values.compactMap { $0.string }) }
    static func object(_ v: JSONValue?) -> JSONRecord { guard case .object(let r)? = v else { return [:] }; return r }; static func array(_ v: JSONValue?) -> [JSONValue] { guard case .array(let a)? = v else { return [] }; return a };
    static func scalar(_ v: JSONValue?, _ max: Int = 512) -> JSONValue { guard let v else { return .null }; if case .string(let s) = v { return .string(String(s.prefix(max))) }; if case .number = v { return v }; if case .bool = v { return v }; return .null };
    static func records(_ root: JSONValue?) -> [JSONValue] { Array(array(object(root)["value"]).prefix(25)) }
    static func list(_ v: JSONValue?) -> JSONRecord {
        let r = object(v), info = object(r["list"]);
        return [
            "id": scalar(r["id"], 512), "displayName": scalar(r["displayName"]), "description": scalar(r["description"], 1000), "webUrl": scalar(r["webUrl"], 2048), "createdDateTime": scalar(r["createdDateTime"], 64), "lastModifiedDateTime": scalar(r["lastModifiedDateTime"], 64),
            "template": scalar(info["template"], 128),
        ]
    }
    static func column(_ v: JSONValue?) -> JSONRecord {
        let r = object(v); return ["id": scalar(r["id"], 512), "name": scalar(r["name"], 64), "displayName": scalar(r["displayName"], 256), "description": scalar(r["description"], 512), "required": scalar(r["required"]), "readOnly": scalar(r["readOnly"]), "hidden": scalar(r["hidden"])]
    }
    static func item(_ v: JSONValue?, allowedFields: Set<String>) -> JSONRecord {
        let r = object(v), source = object(r["fields"]), safe = source.filter { allowedFields.contains($0.key) }.mapValues { scalar($0, 1000) };
        return ["id": scalar(r["id"], 512), "webUrl": scalar(r["webUrl"], 2048), "createdDateTime": scalar(r["createdDateTime"], 64), "lastModifiedDateTime": scalar(r["lastModifiedDateTime"], 64), "fields": .object(safe), "fieldPolicyApplied": .bool(true)]
    }
    static func fakeList() -> JSONRecord {
        [
            "id": .string("list-001"), "displayName": .string("Launch Tracker"), "description": .string("Tracks launch work"), "webUrl": .string("https://contoso.sharepoint.com/sites/product/Lists/Launch"), "createdDateTime": .string("2026-07-01T10:00:00Z"),
            "lastModifiedDateTime": .string("2026-07-12T08:00:00Z"), "template": .string("genericList"),
        ]
    }; static func fakeColumn() -> JSONRecord { ["id": .string("column-001"), "name": .string("Title"), "displayName": .string("Title"), "description": .null, "required": .bool(true), "readOnly": .bool(false), "hidden": .bool(false)] };
    static func fakeItem() -> JSONRecord {
        [
            "id": .string("1"), "webUrl": .string("https://contoso.sharepoint.com/sites/product/Lists/Launch/1"), "createdDateTime": .string("2026-07-01T10:00:00Z"), "lastModifiedDateTime": .string("2026-07-12T08:00:00Z"), "fields": .object(["Title": .string("Finalize launch")]),
            "fieldPolicyApplied": .bool(true),
        ]
    }
}
