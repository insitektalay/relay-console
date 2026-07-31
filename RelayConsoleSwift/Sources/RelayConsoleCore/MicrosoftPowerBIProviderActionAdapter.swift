import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

public struct MicrosoftPowerBIProviderActionClientResult: Sendable { public var result: JSONRecord; public init(result: JSONRecord) { self.result = result } }
public protocol MicrosoftPowerBIProviderActionClient: Sendable { func executeMicrosoftPowerBIAction(request: MarketplaceProviderActionAdapterRequest) throws -> MicrosoftPowerBIProviderActionClientResult }
public struct FakeMicrosoftPowerBIProviderActionClient: MicrosoftPowerBIProviderActionClient {
    public init() {};
    public func executeMicrosoftPowerBIAction(request: MarketplaceProviderActionAdapterRequest) throws -> MicrosoftPowerBIProviderActionClientResult {
        let fields: JSONRecord;
        switch request.definition.actionKey {
        case "microsoft_power_bi_workspace_get": fields = ["workspace": .object(MicrosoftPowerBIProviderActionSupport.fakeWorkspace())];
        case "microsoft_power_bi_reports_list": fields = ["reports": .array([.object(MicrosoftPowerBIProviderActionSupport.fakeReport())]), "resultCount": .number(1)];
        case "microsoft_power_bi_semantic_models_list": fields = ["semanticModels": .array([.object(MicrosoftPowerBIProviderActionSupport.fakeModel())]), "resultCount": .number(1)];
        case "microsoft_power_bi_semantic_model_get": _ = try MicrosoftPowerBIProviderActionSupport.identifier(request.payload["semanticModelId"], "semanticModelId"); fields = ["semanticModel": .object(MicrosoftPowerBIProviderActionSupport.fakeModel())];
        default: throw MarketplaceProviderActionAdapterFailure(code: "microsoft_power_bi_action_not_supported", message: "Unsupported Microsoft Power BI action.")
        }; return MicrosoftPowerBIProviderActionClientResult(result: MicrosoftPowerBIProviderActionSupport.base("fake-power-bi-rest").merging(fields) { _, n in n })
    }
}
public final class LiveMicrosoftPowerBIProviderActionClient: MicrosoftPowerBIProviderActionClient, @unchecked Sendable {
  private let data: LocalDataService; private let secrets: SecretService
  public init(data: LocalDataService, secrets: SecretService) { self.data = data; self.secrets = secrets }
    public func executeMicrosoftPowerBIAction(request: MarketplaceProviderActionAdapterRequest) throws -> MicrosoftPowerBIProviderActionClientResult {
        let auth = try authorization(request), root: JSONValue, fields: JSONRecord;
        switch request.definition.actionKey {
        case "microsoft_power_bi_workspace_get": root = try get(token: auth.token, path: "/groups/\(auth.workspace)"); fields = ["workspace": .object(MicrosoftPowerBIProviderActionSupport.workspace(root))];
        case "microsoft_power_bi_reports_list":
            root = try get(token: auth.token, path: "/groups/\(auth.workspace)/reports"); let values = MicrosoftPowerBIProviderActionSupport.records(root).map(MicrosoftPowerBIProviderActionSupport.report);
            fields = ["reports": .array(values.map(JSONValue.object)), "resultCount": .number(Double(values.count)), "nextPageFollowed": .bool(false)];
        case "microsoft_power_bi_semantic_models_list":
            root = try get(token: auth.token, path: "/groups/\(auth.workspace)/datasets"); let values = MicrosoftPowerBIProviderActionSupport.records(root).map(MicrosoftPowerBIProviderActionSupport.model);
            fields = ["semanticModels": .array(values.map(JSONValue.object)), "resultCount": .number(Double(values.count)), "nextPageFollowed": .bool(false)];
        case "microsoft_power_bi_semantic_model_get":
            let id = try MicrosoftPowerBIProviderActionSupport.identifier(request.payload["semanticModelId"], "semanticModelId"); root = try get(token: auth.token, path: "/groups/\(auth.workspace)/datasets/\(id)");
            fields = ["semanticModel": .object(MicrosoftPowerBIProviderActionSupport.model(root))];
        default: throw MarketplaceProviderActionAdapterFailure(code: "microsoft_power_bi_live_action_not_supported", message: "Unsupported live Microsoft Power BI action.")
        }; return MicrosoftPowerBIProviderActionClientResult(result: MicrosoftPowerBIProviderActionSupport.base("live-power-bi-rest").merging(fields) { _, n in n })
    }
    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> (token: String, workspace: String) {
        guard let id = request.auditIdentity.connectionId, let c = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), c.appSlug == "microsoft-power-bi", c.appId == request.app.id, c.status == .connected, c.health.state == .ready,
            c.grantedScopes == ProviderConnectionService.microsoftPowerBIRelayOwnedOAuthScopes, c.health.diagnostics["selectedWorkspaceVerified"]?.bool == true, c.health.diagnostics["metadataOnly"]?.bool == true, c.health.diagnostics["reportContentEnabled"]?.bool == false,
            c.health.diagnostics["datasetQueriesEnabled"]?.bool == false, c.health.diagnostics["identitiesEnabled"]?.bool == false, c.health.diagnostics["writesEnabled"]?.bool == false, c.health.diagnostics["automaticPagination"]?.bool == false,
            c.health.diagnostics["rawToolsEnabled"]?.bool == false, let workspace = c.health.diagnostics["selectedWorkspaceId"]?.string, let ref = c.credentialRequirements.first(where: { $0.fieldKey == "microsoft_power_bi_oauth_access_token" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "microsoft_power_bi_connection_not_ready", message: "Microsoft Power BI requires a ready selected-workspace metadata-only connection.") };
        return (try secrets.getSecretValue(ref), try MicrosoftPowerBIProviderActionSupport.identifier(.string(workspace), "selectedWorkspaceId"))
    }
    private func get(token: String, path: String) throws -> JSONValue {
        guard let url = URL(string: "https://api.powerbi.com/v1.0/myorg" + path), url.scheme == "https", url.host == "api.powerbi.com", url.path.hasPrefix("/v1.0/myorg/groups/"), url.query == nil, !url.path.contains("/Export"), !url.path.contains("/executeQueries"), !url.path.contains("/users"),
            !url.path.contains("/refreshes")
        else { throw MarketplaceProviderActionAdapterFailure(code: "microsoft_power_bi_unsafe_url", message: "Unsafe Power BI REST request.") }; var req = URLRequest(url: url, timeoutInterval: 30); req.httpMethod = "GET"; req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization");
        let sem = DispatchSemaphore(value: 0); var captured: Result<(Data, HTTPURLResponse), Error>?;
        URLSession.shared.dataTask(with: req) { bytes, response, error in
            defer { sem.signal() }; if let error { captured = .failure(error); return };
            guard let bytes, let response = response as? HTTPURLResponse else { captured = .failure(MarketplaceProviderActionAdapterFailure(code: "microsoft_power_bi_transport_error", message: "Power BI returned no HTTP response.")); return }; captured = .success((bytes, response))
        }.resume(); guard sem.wait(timeout: .now() + 31) == .success, let captured else { throw MarketplaceProviderActionAdapterFailure(code: "microsoft_power_bi_timeout", message: "Power BI request timed out.") }; let (bytes, response) = try captured.get();
        guard (200..<300).contains(response.statusCode) else { throw MarketplaceProviderActionAdapterFailure(code: response.statusCode == 429 ? "microsoft_power_bi_rate_limited" : "microsoft_power_bi_api_error", message: "Power BI REST request failed.", providerStatusCode: response.statusCode) };
        guard bytes.count <= 1_000_000 else { throw MarketplaceProviderActionAdapterFailure(code: "microsoft_power_bi_response_too_large", message: "Power BI response exceeded 1 MB.") }; return try JSONDecoder().decode(JSONValue.self, from: bytes)
    }
}
public struct MicrosoftPowerBIProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = ["microsoft_power_bi_workspace_get", "microsoft_power_bi_reports_list", "microsoft_power_bi_semantic_models_list", "microsoft_power_bi_semantic_model_get"]; private let client: any MicrosoftPowerBIProviderActionClient;
    public init(client: any MicrosoftPowerBIProviderActionClient = FakeMicrosoftPowerBIProviderActionClient()) { self.client = client };
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "microsoft-power-bi", Self.allowed.contains(request.definition.actionKey), request.permission == .allowed else {
            throw MarketplaceProviderActionAdapterFailure(code: "microsoft_power_bi_action_not_allowlisted", message: "Power BI V1 permits only four selected-workspace metadata reads.")
        }; return MarketplaceProviderActionAdapterResult(result: try client.executeMicrosoftPowerBIAction(request: request).result, error: nil, redactionStatus: "content-queries-identities-urls-refresh-export-admin-writes-pagination-raw-excluded")
    }
}
public enum MicrosoftPowerBIProviderActionSupport {
    static func base(_ mode: String) -> JSONRecord {
        [
            "provider": .string("microsoft-power-bi"), "adapterBoundary": .string("microsoft-power-bi-provider-action-adapter"), "clientMode": .string(mode), "selectedWorkspaceOnly": .bool(true), "metadataOnly": .bool(true), "maxResults": .number(25), "writesEnabled": .bool(false),
            "automaticPagination": .bool(false), "rawProviderToolExposure": .bool(false),
        ]
    }
    static func object(_ v: JSONValue?) -> JSONRecord { guard case .object(let r)? = v else { return [:] }; return r }; static func array(_ v: JSONValue?) -> [JSONValue] { guard case .array(let a)? = v else { return [] }; return a };
    static func scalar(_ v: JSONValue?, _ max: Int = 512) -> JSONValue { guard let v else { return .null }; if case .string(let s) = v { return .string(String(s.prefix(max))) }; if case .number = v { return v }; if case .bool = v { return v }; return .null };
    static func records(_ root: JSONValue?) -> [JSONValue] { Array(array(object(root)["value"]).prefix(25)) }
    static func identifier(_ v: JSONValue?, _ field: String) throws -> String {
        guard let s = v?.string, !s.isEmpty, s.count <= 128, s.allSatisfy({ $0.isLetter || $0.isNumber || "-_".contains($0) }) else { throw MarketplaceProviderActionAdapterFailure(code: "microsoft_power_bi_invalid_identifier", message: "An explicit safe \(field) is required.") }; return s
    }
    static func workspace(_ v: JSONValue?) -> JSONRecord {
        let r = object(v); return ["id": scalar(r["id"], 128), "name": scalar(r["name"]), "isReadOnly": scalar(r["isReadOnly"]), "isOnDedicatedCapacity": scalar(r["isOnDedicatedCapacity"]), "capacityDetailsExcluded": .bool(true), "resourceDetailsExcluded": .bool(true)]
    }
    static func report(_ v: JSONValue?) -> JSONRecord {
        let r = object(v);
        return [
            "id": scalar(r["id"], 128), "name": scalar(r["name"]), "reportType": scalar(r["reportType"], 64), "datasetId": scalar(r["datasetId"], 128), "description": scalar(r["description"], 2000), "embedURLExcluded": .bool(true), "webURLExcluded": .bool(true), "usersExcluded": .bool(true),
            "ownershipExcluded": .bool(true),
        ]
    }
    static func model(_ v: JSONValue?) -> JSONRecord {
        let r = object(v);
        return [
            "id": scalar(r["id"], 128), "name": scalar(r["name"]), "isRefreshable": scalar(r["isRefreshable"]), "isEffectiveIdentityRequired": scalar(r["isEffectiveIdentityRequired"]), "isEffectiveIdentityRolesRequired": scalar(r["isEffectiveIdentityRolesRequired"]),
            "isOnPremGatewayRequired": scalar(r["isOnPremGatewayRequired"]), "configuredByExcluded": .bool(true), "usersExcluded": .bool(true), "urlsExcluded": .bool(true), "queryContentExcluded": .bool(true),
        ]
    }
    static func fakeWorkspace() -> JSONRecord { ["id": .string("f089354e-8366-4e18-aea3-4cb4a3a50b48"), "name": .string("Executive Analytics"), "isReadOnly": .bool(true), "isOnDedicatedCapacity": .bool(false), "capacityDetailsExcluded": .bool(true), "resourceDetailsExcluded": .bool(true)] };
    static func fakeReport() -> JSONRecord {
        [
            "id": .string("5b218778-e7a5-4d73-8187-f10824047715"), "name": .string("Sales Performance"), "reportType": .string("PowerBIReport"), "datasetId": .string("cfafbeb1-8037-4d0c-896e-a46fb27ff229"), "description": .string("Monthly sales performance overview"),
            "embedURLExcluded": .bool(true), "webURLExcluded": .bool(true), "usersExcluded": .bool(true), "ownershipExcluded": .bool(true),
        ]
    };
    static func fakeModel() -> JSONRecord {
        [
            "id": .string("cfafbeb1-8037-4d0c-896e-a46fb27ff229"), "name": .string("Sales Semantic Model"), "isRefreshable": .bool(true), "isEffectiveIdentityRequired": .bool(false), "isEffectiveIdentityRolesRequired": .bool(false), "isOnPremGatewayRequired": .bool(false),
            "configuredByExcluded": .bool(true), "usersExcluded": .bool(true), "urlsExcluded": .bool(true), "queryContentExcluded": .bool(true),
        ]
    }
}
